/**
 * 记账本同步服务（仅使用 Node.js 内置模块）
 * - 设备凭证鉴权，避免仅凭 deviceId 冒充其他设备
 * - 按 id + updatedAt 合并，支持 deleted 软删除
 * - 共享账本写入权限校验
 * - 视觉、模型列表和语音接口的安全上游代理
 */
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const dns = require('dns').promises;
const net = require('net');
let webPush = null;
try { webPush = require('web-push'); } catch (_) {}

const DATA = process.env.DATA_FILE ? path.resolve(process.env.DATA_FILE) : path.join(__dirname, 'data.json');
const PORT = process.env.PORT === undefined ? 3000 : Number(process.env.PORT);
const HOST = process.env.HOST || '0.0.0.0';
const MAX_JSON_BODY = Number(process.env.MAX_JSON_BODY) || 2 * 1024 * 1024;
const MAX_AUDIO_BODY = Number(process.env.MAX_AUDIO_BODY) || 25 * 1024 * 1024;
const MAX_UPSTREAM_BODY = Number(process.env.MAX_UPSTREAM_BODY) || 5 * 1024 * 1024;
const ALLOW_PRIVATE_UPSTREAM = process.env.ALLOW_PRIVATE_UPSTREAM === '1' && process.env.NODE_ENV === 'test' && ['127.0.0.1', '::1', 'localhost'].includes(HOST);
const TRUST_PROXY = process.env.TRUST_PROXY === '1';
const REQUIRE_ACCOUNT = process.env.REQUIRE_ACCOUNT === '1';
const UPSTREAM_HOSTS = new Set((process.env.UPSTREAM_HOSTS || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean));
const RECORD_COLLECTIONS = ['transactions', 'escrows', 'usages', 'debts', 'accounts', 'categories', 'budgets', 'recurringRules', 'personalPlans', 'repaymentPlans', 'goals', 'inspirations', 'diaries', 'focusSessions'];
const COLLECTIONS = [...RECORD_COLLECTIONS, 'ledgers'];
const SESSION_TTL_MS = Math.max(1, Math.min(365, Number(process.env.SESSION_TTL_DAYS) || 30)) * 86400000;
const PASSWORD_SCRYPT = Object.freeze({ N: 16384, r: 8, p: 1, keylen: 64, maxmem: 64 * 1024 * 1024 });
const AUTH_RATE_LIMITS = new Map();
const DUMMY_PASSWORD_SALT = '8c2c77a2b0fa34bfffe3a59cf85281a1';
const PAID_DB_TABLES = ['plans', 'subscriptions', 'entitlementGrants', 'manualPayments', 'themeCatalog', 'aiProviders', 'aiRoutes', 'aiUsageEvents', 'adminUsers', 'adminSessions', 'featureFlags', 'trialClaims'];

function emptyDb() {
  const db = { users: {}, sessions: {}, devices: {}, shares: {}, pushSubscriptions: {}, pushSchedules: {}, pushConfig: null, auditLogs: [], _g: null };
  PAID_DB_TABLES.forEach(name => { if (name !== 'auditLogs') db[name] = {}; });
  return db;
}
function loadDb() {
  if (!fs.existsSync(DATA)) return emptyDb();
  try {
    const parsed = JSON.parse(fs.readFileSync(DATA, 'utf8'));
    parsed.users = parsed.users && typeof parsed.users === 'object' ? parsed.users : {};
    parsed.sessions = parsed.sessions && typeof parsed.sessions === 'object' ? parsed.sessions : {};
    parsed.devices = parsed.devices && typeof parsed.devices === 'object' ? parsed.devices : {};
    parsed.shares = parsed.shares && typeof parsed.shares === 'object' ? parsed.shares : {};
    parsed.pushSubscriptions = parsed.pushSubscriptions && typeof parsed.pushSubscriptions === 'object' ? parsed.pushSubscriptions : {};
    parsed.pushSchedules = parsed.pushSchedules && typeof parsed.pushSchedules === 'object' ? parsed.pushSchedules : {};
    PAID_DB_TABLES.forEach(name => {
      if (name === 'auditLogs') parsed[name] = Array.isArray(parsed[name]) ? parsed[name] : [];
      else parsed[name] = parsed[name] && typeof parsed[name] === 'object' && !Array.isArray(parsed[name]) ? parsed[name] : {};
    });
    return parsed;
  } catch (e) {
    const backup = DATA + '.corrupt-' + Date.now();
    try { fs.copyFileSync(DATA, backup); } catch (_) {}
    console.error('data.json 无法解析，已保留损坏文件副本：', backup, e.message);
    return emptyDb();
  }
}
let DB = loadDb();
let LAST_DURABLE_DB_JSON = JSON.stringify(DB);

function persist() {
  const temp = DATA + '.tmp';
  let serialized;
  try {
    serialized = JSON.stringify(DB);
    fs.writeFileSync(temp, serialized, 'utf8');
    fs.renameSync(temp, DATA);
    LAST_DURABLE_DB_JSON = serialized;
    return;
  } catch (primary) {
    try {
      serialized = serialized === undefined ? JSON.stringify(DB) : serialized;
      fs.writeFileSync(DATA, serialized, 'utf8');
      LAST_DURABLE_DB_JSON = serialized;
      try { if (fs.existsSync(temp)) fs.unlinkSync(temp); } catch (_) {}
      return;
    } catch (fallback) {
      // Never acknowledge a mutation that was not durably written. Restoring the
      // last confirmed snapshot also prevents a later successful request from
      // accidentally persisting this failed request's in-memory changes.
      DB = JSON.parse(LAST_DURABLE_DB_JSON);
      try { if (fs.existsSync(temp)) fs.unlinkSync(temp); } catch (_) {}
      const error = new Error('data persistence failed');
      error.statusCode = 503;
      error.cause = fallback;
      console.error('save fail', fallback && fallback.message ? fallback.message : fallback);
      throw error;
    }
  }
}

function initPush() {
  if (!webPush) return false;
  if (!DB.pushConfig || !DB.pushConfig.publicKey || !DB.pushConfig.privateKey) {
    DB.pushConfig = webPush.generateVAPIDKeys();
    persist();
  }
  webPush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@localhost.invalid', DB.pushConfig.publicKey, DB.pushConfig.privateKey);
  return true;
}
const PUSH_ENABLED = initPush();

function send(res, code, obj, extraHeaders = {}) {
  const configuredOrigin = process.env.CORS_ORIGIN || '*';
  const requestOrigin = String(res.__requestOrigin || '');
  const localPreviewOrigin = /^http:\/\/(?:127\.0\.0\.1|localhost|\[::1\]|10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2}):8081$/i.test(requestOrigin);
  const responseOrigin = configuredOrigin === '*' ? (!requestOrigin ? '*' : localPreviewOrigin ? requestOrigin : 'null') : configuredOrigin;
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': responseOrigin,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Device-Id, X-Device-Token, X-CSRF-Token',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
    'Vary': 'Origin',
    'Cache-Control': 'no-store',
    ...extraHeaders
  });
  res.end(JSON.stringify(obj));
}

function fail(statusCode, message) {
  const e = new Error(message);
  e.statusCode = statusCode;
  return e;
}

function readLimited(req, maxBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let tooLarge = false;
    req.on('data', chunk => {
      const b = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += b.length;
      if (size > maxBytes) { tooLarge = true; return; }
      chunks.push(b);
    });
    req.on('end', () => tooLarge ? reject(fail(413, 'request body too large')) : resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function readBody(req) {
  const raw = await readLimited(req, MAX_JSON_BODY);
  try { return JSON.parse(raw.toString('utf8') || '{}'); }
  catch (_) { throw fail(400, 'invalid json'); }
}

function parseMultipart(buf, boundary) {
  const parts = [];
  const sep = Buffer.from('--' + boundary);
  let start = buf.indexOf(sep);
  while (start !== -1) {
    start += sep.length;
    let end = buf.indexOf(sep, start);
    if (end === -1) end = buf.length;
    const part = buf.slice(start, end);
    const hdEnd = part.indexOf('\r\n\r\n');
    if (hdEnd === -1) { start = end; continue; }
    const header = part.slice(0, hdEnd).toString('utf8');
    const bodyEnd = part.length >= 2 && part[part.length - 2] === 13 && part[part.length - 1] === 10 ? part.length - 2 : part.length;
    const nameM = header.match(/name="([^"]+)"/);
    const fileM = header.match(/filename="([^"]*)"/);
    const ctM = header.match(/Content-Type:\s*([^\r\n]+)/i);
    parts.push({
      name: nameM ? nameM[1] : '',
      filename: fileM ? path.basename(fileM[1]) : '',
      contentType: ctM ? ctM[1].trim() : '',
      body: part.slice(hdEnd + 4, bodyEnd)
    });
    start = end;
  }
  return parts;
}

function buildMultipart(parts) {
  const boundary = '----NodeBoundary' + crypto.randomBytes(12).toString('hex');
  const chunks = [];
  parts.forEach(p => {
    let hd = `--${boundary}\r\nContent-Disposition: form-data; name="${String(p.name).replace(/["\r\n]/g, '')}"`;
    if (p.filename) hd += `; filename="${String(p.filename).replace(/["\r\n]/g, '')}"`;
    hd += '\r\n';
    if (p.contentType) hd += `Content-Type: ${String(p.contentType).replace(/[\r\n]/g, '')}\r\n`;
    chunks.push(Buffer.from(hd + '\r\n'), p.body, Buffer.from('\r\n'));
  });
  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  return { boundary, body: Buffer.concat(chunks) };
}

function isPrivateAddress(address) {
  if (net.isIPv4(address)) {
    const p = address.split('.').map(Number);
    return p[0] === 0 || p[0] === 10 || p[0] === 127 ||
      (p[0] === 100 && p[1] >= 64 && p[1] <= 127) ||
      (p[0] === 169 && p[1] === 254) ||
      (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
      (p[0] === 192 && p[1] === 168) ||
      (p[0] === 198 && (p[1] === 18 || p[1] === 19)) || p[0] >= 224;
  }
  if (net.isIPv6(address)) {
    const a = address.toLowerCase();
    if (a === '::' || a === '::1' || a.startsWith('fc') || a.startsWith('fd') || /^fe[89ab]/.test(a)) return true;
    const mapped = a.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    return mapped ? isPrivateAddress(mapped[1]) : false;
  }
  return true;
}

async function validateUpstream(targetUrl) {
  let u;
  try { u = new URL(targetUrl); } catch (_) { throw fail(400, 'invalid upstream url'); }
  if (u.username || u.password) throw fail(400, 'upstream url must not contain credentials');
  if (!ALLOW_PRIVATE_UPSTREAM && u.protocol !== 'https:') throw fail(400, 'upstream must use https');
  if (!['http:', 'https:'].includes(u.protocol)) throw fail(400, 'unsupported upstream protocol');
  const hostname = u.hostname.toLowerCase();
  if (UPSTREAM_HOSTS.size && !UPSTREAM_HOSTS.has(hostname)) throw fail(403, 'upstream host is not allowed');
  const answers = net.isIP(hostname) ? [{ address: hostname, family: net.isIPv4(hostname) ? 4 : 6 }] : await dns.lookup(hostname, { all: true, verbatim: true });
  if (!answers.length) throw fail(502, 'upstream dns lookup returned no address');
  if (!ALLOW_PRIVATE_UPSTREAM && answers.some(x => isPrivateAddress(x.address))) throw fail(403, 'private or reserved upstream address is blocked');
  return { u, addresses: answers.map(x => ({ address: x.address, family: x.family })) };
}

function pinnedLookup(addresses) {
  return (_host, options, callback) => {
    // Node 20+ 的自动地址族选择会以 { all:true } 请求地址数组；旧实现始终返回
    // (address, family)，会让运行时读取到 undefined 并抛出 Invalid IP address。
    if (options && typeof options === 'object' && options.all) {
      callback(null, addresses);
      return;
    }
    callback(null, addresses[0].address, addresses[0].family);
  };
}

async function requestUpstream(targetUrl, options = {}) {
  const { u, addresses } = await validateUpstream(targetUrl);
  const mod = u.protocol === 'https:' ? https : http;
  return new Promise((resolve, reject) => {
    let settled = false;
    const finishReject = e => { if (!settled) { settled = true; reject(e); } };
    const req = mod.request({
      hostname: u.hostname,
      port: u.port || (u.protocol === 'https:' ? 443 : 80),
      path: u.pathname + u.search,
      method: options.method || 'GET',
      headers: options.headers || {},
      timeout: options.timeout || 30000,
      lookup: pinnedLookup(addresses)
    }, resp => {
      const chunks = [];
      let size = 0;
      resp.on('data', c => {
        const b = Buffer.isBuffer(c) ? c : Buffer.from(c);
        size += b.length;
        if (size > MAX_UPSTREAM_BODY) { resp.destroy(); finishReject(fail(502, 'upstream response too large')); return; }
        chunks.push(b);
      });
      resp.on('end', () => {
        if (settled) return;
        settled = true;
        resolve({ status: resp.statusCode, headers: resp.headers, text: Buffer.concat(chunks).toString('utf8') });
      });
      resp.on('error', finishReject);
    });
    req.on('error', finishReject);
    req.on('timeout', () => { req.destroy(); finishReject(fail(504, 'upstream timeout')); });
    if (options.body) req.write(options.body);
    req.end();
  });
}

function uid() { return crypto.randomBytes(8).toString('hex').toUpperCase(); }
function tokenHash(token) { return crypto.createHash('sha256').update(String(token)).digest('hex'); }
function safeEqual(a, b) {
  const aa = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}

function authenticateDevice(deviceId, deviceToken, allowCreate = true) {
  if (typeof deviceId !== 'string' || !/^dev_[A-Za-z0-9_-]{8,200}$/.test(deviceId)) throw fail(401, 'invalid deviceId');
  if (typeof deviceToken !== 'string' || deviceToken.length < 32 || deviceToken.length > 256) throw fail(401, 'invalid device token');
  const hash = tokenHash(deviceToken);
  const existing = DB.devices[deviceId];
  if (existing && existing.tokenHash && !safeEqual(existing.tokenHash, hash)) throw fail(403, 'device authentication failed');
  if (!existing || !existing.tokenHash) {
    if (!allowCreate) throw fail(401, 'unknown device');
    DB.devices[deviceId] = { ...(existing || {}), tokenHash: hash, createdAt: (existing && existing.createdAt) || Date.now() };
    persist();
  }
  DB.devices[deviceId].lastSeen = Date.now();
}

function store() {
  if (!DB._g || typeof DB._g !== 'object') DB._g = {};
  COLLECTIONS.forEach(c => { if (!DB._g[c] || typeof DB._g[c] !== 'object') DB._g[c] = {}; });
  return DB._g;
}

function normalizeEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  if (email.length < 3 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw fail(400, '请输入有效的邮箱地址');
  return email;
}

function validatePassword(value, label = '密码') {
  const password = String(value || '');
  if (password.length < 8 || password.length > 128) throw fail(400, `${label}长度需为 8 到 128 位`);
  if (!/[A-Za-z\u3400-\u9fff]/.test(password) || !/\d/.test(password)) throw fail(400, `${label}需同时包含字母（或中文）和数字`);
  return password;
}

function normalizeDisplayName(value, email) {
  const fallback = String(email || '').split('@')[0] || '记账用户';
  const name = String(value || fallback).trim().replace(/[\u0000-\u001f\u007f]/g, '');
  if (!name || name.length > 50) throw fail(400, '昵称需为 1 到 50 个字符');
  return name;
}

function scryptDerive(password, salt) {
  return new Promise((resolve, reject) => {
    const { N, r, p, maxmem, keylen } = PASSWORD_SCRYPT;
    crypto.scrypt(String(password), String(salt), keylen, { N, r, p, maxmem }, (error, derived) => error ? reject(error) : resolve(derived.toString('hex')));
  });
}

async function makePasswordRecord(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  return { passwordSalt: salt, passwordHash: await scryptDerive(password, salt), passwordAlgo: 'scrypt-v1' };
}

async function verifyPassword(user, password) {
  const salt = user && user.passwordSalt ? user.passwordSalt : DUMMY_PASSWORD_SALT;
  const expected = user && user.passwordHash ? user.passwordHash : '0'.repeat(PASSWORD_SCRYPT.keylen * 2);
  const actual = await scryptDerive(String(password || ''), salt);
  return !!(user && safeEqual(actual, expected));
}

function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName || String(user.email || '').split('@')[0] || '记账用户',
    avatar: user.avatar || '',
    bio: user.bio || '',
    timezone: user.timezone || 'Asia/Shanghai',
    createdAt: Number(user.createdAt) || 0,
    updatedAt: Number(user.updatedAt) || Number(user.createdAt) || 0,
    lastLoginAt: Number(user.lastLoginAt) || 0
  };
}

function findUserByEmail(email) {
  return Object.values(DB.users || {}).find(user => user && user.email === email) || null;
}

function authClientKey(req) {
  const socketAddress = String((req.socket && req.socket.remoteAddress) || '');
  const normalizedSocket = socketAddress.replace(/^::ffff:/, '');
  const fromLoopbackProxy = normalizedSocket === '127.0.0.1' || normalizedSocket === '::1';
  if (TRUST_PROXY && fromLoopbackProxy) {
    const forwarded = String(req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || '').split(',')[0].trim().replace(/^::ffff:/, '');
    if (net.isIP(forwarded)) return forwarded;
  }
  return (normalizedSocket || 'unknown').slice(0, 100);
}

function enforceAuthRate(req, scope, subject, limit, windowMs) {
  const now = Date.now();
  const key = `${scope}:${authClientKey(req)}:${String(subject || '').slice(0, 260)}`;
  const current = AUTH_RATE_LIMITS.get(key);
  if (!current || current.resetAt <= now) {
    AUTH_RATE_LIMITS.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  current.count++;
  if (current.count > limit) throw fail(429, '尝试次数过多，请稍后再试');
  if (AUTH_RATE_LIMITS.size > 5000) {
    for (const [entryKey, entry] of AUTH_RATE_LIMITS) if (entry.resetAt <= now) AUTH_RATE_LIMITS.delete(entryKey);
  }
}

function clearAuthRate(req, scope, subject) {
  AUTH_RATE_LIMITS.delete(`${scope}:${authClientKey(req)}:${String(subject || '').slice(0, 260)}`);
}

function sessionTokenFrom(req, body) {
  if (body && typeof body.sessionToken === 'string' && body.sessionToken) return body.sessionToken;
  const authorization = String(req.headers.authorization || '');
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
}

function removeUserSessions(userId, exceptHash) {
  for (const [hash, session] of Object.entries(DB.sessions || {})) {
    if (session && session.userId === userId && hash !== exceptHash) delete DB.sessions[hash];
  }
}

function createSession(userId, deviceId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const now = Date.now();
  for (const [hash, session] of Object.entries(DB.sessions)) if (!session || Number(session.expiresAt) <= now) delete DB.sessions[hash];
  const userSessions = Object.entries(DB.sessions).filter(([, session]) => session && session.userId === userId).sort((a, b) => Number(a[1].createdAt) - Number(b[1].createdAt));
  while (userSessions.length >= 20) delete DB.sessions[userSessions.shift()[0]];
  DB.sessions[tokenHash(token)] = { userId, deviceId, createdAt: now, lastSeen: now, expiresAt: now + SESSION_TTL_MS };
  return token;
}

function requireSession(req, body) {
  const token = sessionTokenFrom(req, body);
  if (!token || token.length < 32 || token.length > 256) throw fail(401, '请先登录');
  const hash = tokenHash(token);
  const session = DB.sessions[hash];
  if (!session || !session.userId || !DB.users[session.userId]) throw fail(401, '登录状态已失效，请重新登录');
  if (Number(session.expiresAt) <= Date.now()) {
    delete DB.sessions[hash];
    persist();
    throw fail(401, '登录状态已过期，请重新登录');
  }
  if (body && body.deviceId && session.deviceId !== body.deviceId) throw fail(403, '登录状态与当前设备不匹配');
  if (session.deviceId && DB.devices[session.deviceId] && DB.devices[session.deviceId].userId && DB.devices[session.deviceId].userId !== session.userId) throw fail(401, '登录状态已失效，请重新登录');
  session.lastSeen = Date.now();
  if (session.expiresAt - Date.now() < SESSION_TTL_MS / 2) session.expiresAt = Date.now() + SESSION_TTL_MS;
  return { token, hash, session, user: DB.users[session.userId] };
}

function accountMemberId(userId) { return userId ? `user:${userId}` : ''; }

function claimLegacyDeviceData(deviceId, userId) {
  const g = store();
  Object.values(g.ledgers).forEach(ledger => {
    if (!ledger || typeof ledger !== 'object') return;
    if (!ledger.userId && !ledger.ownerUserId && ledger.owner === deviceId) {
      ledger.userId = userId;
      ledger.ownerUserId = userId;
    }
    if (Array.isArray(ledger.members) && ledger.members.includes(deviceId)) {
      ledger.members = ledger.members.filter(member => member !== deviceId);
      if (!ledger.members.includes(accountMemberId(userId))) ledger.members.push(accountMemberId(userId));
    }
  });
  RECORD_COLLECTIONS.forEach(coll => Object.values(g[coll]).forEach(record => {
    if (record && !record.userId && (record.owner === deviceId || record.deviceId === deviceId)) record.userId = userId;
  }));
}

function associateDeviceWithUser(deviceId, userId, claimLegacy = false) {
  const device = DB.devices[deviceId];
  if (!device) throw fail(401, 'invalid device');
  if (!device.userId && claimLegacy) claimLegacyDeviceData(deviceId, userId);
  // A device membership is a guest identity. Once an account is active it must not
  // remain as a second, account-independent path into shared ledgers.
  Object.values(store().ledgers).forEach(ledger => {
    if (ledger && Array.isArray(ledger.members)) ledger.members = ledger.members.filter(member => member !== deviceId);
  });
  if (device.userId && device.userId !== userId) {
    delete DB.pushSubscriptions[deviceId];
    delete DB.pushSchedules[deviceId];
    for (const [hash, session] of Object.entries(DB.sessions)) if (session && session.deviceId === deviceId && session.userId !== userId) delete DB.sessions[hash];
  }
  device.userId = userId;
  device.accountLinkedAt = Date.now();
  delete device.accountDeletedAt;
}

function authenticateContext(req, body, sessionRequired = false) {
  const hasSession = !!sessionTokenFrom(req, body);
  if (!hasSession && (sessionRequired || REQUIRE_ACCOUNT)) throw fail(401, '云端功能需要先登录邮箱账号');
  // Session-protected calls may only use a device created by register/login. This
  // prevents rejected public requests from filling the devices table.
  authenticateDevice(body.deviceId, body.deviceToken, !hasSession);
  if (!hasSession) {
    if (DB.devices[body.deviceId] && DB.devices[body.deviceId].accountDeletedAt) throw fail(401, '该设备上的账号已注销，请重新注册或登录');
    return { deviceId: body.deviceId, userId: null, auth: null };
  }
  const auth = requireSession(req, body);
  associateDeviceWithUser(body.deviceId, auth.user.id, false);
  return { deviceId: body.deviceId, userId: auth.user.id, auth };
}

function normalizeAvatar(value) {
  const avatar = String(value || '').trim();
  const cuteAvatars = new Set(['🍓', '🍑', '🐰', '🦄', '🐳', '🐻', '🌷', '🌙', '🍀', '🧁']);
  if (avatar.length > 256 * 1024) throw fail(400, '头像文件过大');
  if (!avatar || cuteAvatars.has(avatar) || /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=\s]+$/i.test(avatar)) return avatar;
  try {
    const url = new URL(avatar);
    if (url.protocol === 'https:' && !url.username && !url.password) return url.toString();
  } catch (_) {}
  throw fail(400, '头像仅支持应用内可爱头像、HTTPS 图片或 JPEG、PNG、WebP 图片文件');
}

function deleteAccountData(userId) {
  const g = store();
  const deletionAt = Date.now();
  const memberKey = accountMemberId(userId);
  const deviceIds = Object.entries(DB.devices).filter(([, device]) => device && device.userId === userId).map(([id]) => id);
  const deviceSet = new Set(deviceIds);
  const ownedLedgers = new Set(Object.values(g.ledgers).filter(ledger => ownsRecord(ledger, '', userId)).map(ledger => ledger.id));
  const deletedLedgers = new Set();

  for (const [ledgerId, ledger] of Object.entries(g.ledgers)) {
    if (!ledger || typeof ledger !== 'object') continue;
    const remainingMembers = Array.isArray(ledger.members) ? ledger.members.filter(member => member !== memberKey && !deviceSet.has(member)) : [];
    if (ownedLedgers.has(ledgerId) && ledger.shared && remainingMembers.length) {
      // Keep collaborators' data. Ownership is transferred deterministically to an
      // existing account member (preferred) or legacy device member.
      const nextAccountMember = remainingMembers.find(member => /^user:usr_/.test(member));
      if (nextAccountMember) {
        const nextUserId = nextAccountMember.slice(5);
        const nextDeviceId = Object.keys(DB.devices).find(id => DB.devices[id] && DB.devices[id].userId === nextUserId);
        ledger.userId = nextUserId;
        ledger.ownerUserId = nextUserId;
        if (nextDeviceId) ledger.owner = nextDeviceId;
      } else {
        const nextDeviceId = remainingMembers[0];
        ledger.owner = nextDeviceId;
        ledger.deviceId = nextDeviceId;
        delete ledger.userId;
        delete ledger.ownerUserId;
      }
      ledger.members = remainingMembers;
      ledger.updatedAt = deletionAt;
    } else if (ownedLedgers.has(ledgerId)) {
      deletedLedgers.add(ledgerId);
      delete g.ledgers[ledgerId];
    } else {
      if (Array.isArray(ledger.members)) ledger.members = remainingMembers;
    }
  }
  RECORD_COLLECTIONS.forEach(coll => {
    for (const [id, record] of Object.entries(g[coll])) {
      const legacyOwned = record && !record.userId && (deviceSet.has(record.owner) || deviceSet.has(record.deviceId));
      const deletedUserOwned = record && (record.userId === userId || legacyOwned);
      const ledgerStillExists = record && record.ledger && g.ledgers[record.ledger];
      if (deletedUserOwned && ledgerStillExists) {
        const updatedAt = Math.max(deletionAt, (Number(record.updatedAt) || 0) + 1);
        g[coll][id] = minimalTombstone({ ...record, deleted: true, deletedAt: deletionAt, updatedAt }, record, coll);
      } else if (record && (deletedUserOwned || deletedLedgers.has(record.ledger))) delete g[coll][id];
    }
  });
  for (const [code, share] of Object.entries(DB.shares)) if (share && deletedLedgers.has(share.ledgerId)) delete DB.shares[code];
  for (const deviceId of deviceIds) {
    delete DB.pushSubscriptions[deviceId];
    delete DB.pushSchedules[deviceId];
    delete DB.devices[deviceId].userId;
    DB.devices[deviceId].accountDeletedAt = Date.now();
  }
  removeUserSessions(userId);
  for (const [id, item] of Object.entries(DB.subscriptions || {})) if (item && item.userId === userId) delete DB.subscriptions[id];
  for (const [id, item] of Object.entries(DB.entitlementGrants || {})) if (item && item.userId === userId) delete DB.entitlementGrants[id];
  for (const [id, item] of Object.entries(DB.aiUsageEvents || {})) if (item && item.userId === userId) delete DB.aiUsageEvents[id];
  for (const item of Object.values(DB.manualPayments || {})) {
    if (!item || item.userId !== userId) continue;
    item.deletedUserRef = tokenHash('deleted-user:' + userId);
    delete item.userId;
  }
  delete DB.users[userId];
}

function validId(id) { return typeof id === 'string' && /^[A-Za-z0-9_-]{1,160}$/.test(id); }
function minimalTombstone(out, existing, coll) {
  return {
    id: out.id,
    ...(out.ledger ? { ledger: out.ledger } : {}),
    ...(out.owner ? { owner: out.owner } : {}),
    ...(out.deviceId ? { deviceId: out.deviceId } : {}),
    ...(out.userId ? { userId: out.userId } : {}),
    ...(out.ownerUserId ? { ownerUserId: out.ownerUserId } : {}),
    ...((out.private === true || (existing && existing.private === true)) ? { private: true } : {}),
    ...((out.escrowId || (existing && existing.escrowId)) ? { escrowId: out.escrowId || existing.escrowId } : {}),
    ...(coll === 'ledgers' && (out.shared || (existing && existing.shared)) ? {
      shared: true,
      members: Array.isArray(existing && existing.members) ? [...new Set(existing.members)] : (Array.isArray(out.members) ? [...new Set(out.members)] : [])
    } : {}),
    deleted: true,
    deletedAt: Number(out.deletedAt) || out.updatedAt,
    updatedAt: out.updatedAt
  };
}
function normalizeRecord(x, deviceId, userId, coll) {
  if (!x || typeof x !== 'object' || Array.isArray(x) || !validId(x.id)) throw fail(400, 'invalid record');
  const out = JSON.parse(JSON.stringify(x));
  const existing = coll && store()[coll] ? store()[coll][out.id] : null;
  if (existing && existing.ledger && !out.ledger) out.ledger = existing.ledger;
  const now = Date.now();
  const ts = Number(out.updatedAt);
  out.updatedAt = Number.isFinite(ts) && ts > 0 ? Math.min(ts, now + 5 * 60 * 1000) : now;
  // Ownership fields are server-controlled. Existing shared records keep their original
  // creator; newly uploaded records belong to the authenticated account (or legacy device).
  out.deviceId = existing && existing.deviceId ? existing.deviceId : deviceId;
  out.owner = existing && existing.owner ? existing.owner : deviceId;
  if (existing && existing.userId) out.userId = existing.userId;
  else if (userId) out.userId = userId;
  else delete out.userId;
  if (coll === 'ledgers') {
    if (existing && existing.ownerUserId) out.ownerUserId = existing.ownerUserId;
    else if (userId) out.ownerUserId = userId;
    else delete out.ownerUserId;
  }
  if (out.deleted) {
    // 删除记录只保留同步、归属和权限判断所需字段，避免照片、联系人、备注等
    // 敏感内容继续滞留在 data.json 或账号导出文件中。
    return minimalTombstone(out, existing, coll);
  }
  return out;
}
function ownsRecord(record, deviceId, userId) {
  if (!record) return false;
  const accountOwner = record.ownerUserId || record.userId;
  if (userId) return accountOwner === userId;
  if (accountOwner) return false;
  return record.owner === deviceId || record.deviceId === deviceId;
}
function isMember(ledgerId, deviceId, userId) {
  const l = store().ledgers[ledgerId];
  if (!l || !Array.isArray(l.members)) return false;
  return userId ? l.members.includes(accountMemberId(userId)) : l.members.includes(deviceId);
}
function isShared(ledgerId) { const l = store().ledgers[ledgerId]; return !!(l && l.shared); }
function canWriteLedger(record, deviceId, userId) {
  const existing = store().ledgers[record.id];
  if (existing) return ownsRecord(existing, deviceId, userId);
  return ownsRecord(record, deviceId, userId);
}
function canWriteRecord(coll, record, deviceId, userId) {
  const existing = store()[coll][record.id];
  const oldLedgerId = existing && existing.ledger;
  const ledgerId = record.ledger || oldLedgerId;
  if (existing && oldLedgerId && ledgerId !== oldLedgerId) {
    const oldLedger = store().ledgers[oldLedgerId];
    const newLedger = store().ledgers[ledgerId];
    // 只有同时拥有原账本和目标账本的所有者才能移动既有记录。
    return !!(oldLedger && newLedger && ownsRecord(oldLedger, deviceId, userId) && ownsRecord(newLedger, deviceId, userId));
  }
  if (!ledgerId) return (!existing || ownsRecord(existing, deviceId, userId)) && ownsRecord(record, deviceId, userId);
  const ledger = store().ledgers[ledgerId];
  if (!ledger) return false;
  return ledger.shared ? isMember(ledgerId, deviceId, userId) : ownsRecord(ledger, deviceId, userId);
}
function mergeOne(coll, record) {
  const table = store()[coll];
  const existing = table[record.id];
  const accepted = !existing || (!existing.deleted || record.deleted) && record.updatedAt > (Number(existing.updatedAt) || 0);
  if (accepted) table[record.id] = record;
  if (accepted && coll === 'ledgers' && record.deleted) {
    RECORD_COLLECTIONS.forEach(childColl => {
      const childTable = store()[childColl];
      Object.entries(childTable).forEach(([id, child]) => {
        if (!child || child.ledger !== record.id) return;
        const updatedAt = Math.max(Number(record.updatedAt) || Date.now(), (Number(child.updatedAt) || 0) + 1);
        childTable[id] = minimalTombstone({ ...child, deleted: true, deletedAt: Number(record.deletedAt) || updatedAt, updatedAt }, child, childColl);
      });
    });
  }
}
function mergeState(state, deviceId, userId) {
  if (!state || typeof state !== 'object') return;
  for (const coll of ['ledgers', ...RECORD_COLLECTIONS]) {
    if (state[coll] === undefined) continue;
    if (!Array.isArray(state[coll])) throw fail(400, `${coll} must be an array`);
    if (state[coll].length > 10000) throw fail(413, `${coll} contains too many records`);
  }

  const mergeCollection = (coll, rows) => {
    for (const raw of rows) {
      const record = normalizeRecord(raw, deviceId, userId, coll);
      if (coll !== 'ledgers' && record.ledger) {
        const targetLedger = store().ledgers[record.ledger];
        if (targetLedger && targetLedger.deleted) continue;
      }
      const allowed = coll === 'ledgers' ? canWriteLedger(record, deviceId, userId) : canWriteRecord(coll, record, deviceId, userId);
      // 共享成员会把只读的账本元数据一并上传；忽略即可，不能让它阻断成员自己的记账同步。
      if (coll === 'ledgers' && !allowed) continue;
      if (!allowed) throw fail(403, `not allowed to write ${coll}:${record.id}`);
      mergeOne(coll, record);
    }
  };

  // A ledger deletion may share one sync request with moves into another ledger.
  // Create/update destination ledgers first, then apply record moves, and only then
  // tombstone the source ledger and children that still point to it.
  const ledgerRows = Array.isArray(state.ledgers) ? state.ledgers : [];
  mergeCollection('ledgers', ledgerRows.filter(row => !(row && row.deleted)));
  RECORD_COLLECTIONS.forEach(coll => mergeCollection(coll, Array.isArray(state[coll]) ? state[coll] : []));
  mergeCollection('ledgers', ledgerRows.filter(row => row && row.deleted));
}

function pullFor(deviceId, userId) {
  const g = store();
  const out = Object.fromEntries(COLLECTIONS.map(c => [c, []]));
  RECORD_COLLECTIONS.forEach(c => {
    Object.values(g[c]).forEach(x => {
      if (['personalPlans', 'repaymentPlans', 'goals', 'inspirations', 'diaries', 'focusSessions'].includes(c) && x.private !== false) { if (ownsRecord(x, deviceId, userId)) out[c].push(x); }
      else if (x.ledger && isShared(x.ledger)) { if (isMember(x.ledger, deviceId, userId)) out[c].push(x); }
      else if (ownsRecord(x, deviceId, userId)) out[c].push(x);
    });
  });
  Object.values(g.ledgers).forEach(l => {
    if (l.shared) { if (isMember(l.id, deviceId, userId)) out.ledgers.push(l); }
    else if (ownsRecord(l, deviceId, userId)) out.ledgers.push(l);
  });
  return out;
}

function normalizePushSubscription(input) {
  if (!input || typeof input !== 'object' || typeof input.endpoint !== 'string' || !/^https:\/\//.test(input.endpoint) || input.endpoint.length > 2048) throw fail(400, 'invalid push subscription');
  const keys = input.keys && typeof input.keys === 'object' ? input.keys : {};
  if (typeof keys.p256dh !== 'string' || typeof keys.auth !== 'string') throw fail(400, 'invalid push keys');
  return { endpoint: input.endpoint, expirationTime: input.expirationTime || null, keys: { p256dh: keys.p256dh.slice(0, 256), auth: keys.auth.slice(0, 128) } };
}
function normalizePushJobs(input) {
  if (!Array.isArray(input) || input.length > 500) throw fail(400, 'invalid push jobs');
  const now = Date.now();
  return input.map(x => {
    if (!x || typeof x !== 'object' || !validId(x.id)) throw fail(400, 'invalid push job');
    const fireAt = Number(x.fireAt);
    if (!Number.isFinite(fireAt) || fireAt < now - 7 * 86400000 || fireAt > now + 120 * 86400000) throw fail(400, 'invalid push time');
    return { id: x.id, fireAt, title: String(x.title || '计划提醒').slice(0, 120), body: String(x.body || '').slice(0, 300), url: /^\/index\.html\?/.test(String(x.url || '')) ? String(x.url).slice(0, 500) : '/index.html', sentAt: 0 };
  });
}
async function processPushSchedules() {
  if (!PUSH_ENABLED) return;
  const now = Date.now();let changed = false;
  for (const [deviceId, jobs] of Object.entries(DB.pushSchedules || {})) {
    const subscriptions = Array.isArray(DB.pushSubscriptions[deviceId]) ? DB.pushSubscriptions[deviceId] : [];
    for (const job of Array.isArray(jobs) ? jobs : []) {
      if (job.sentAt || job.fireAt > now || job.fireAt < now - 86400000 || !subscriptions.length) continue;
      const payload = JSON.stringify({ title: job.title, body: job.body, tag: 'planner-' + job.id, url: job.url });
      const dead = new Set();let delivered = 0;
      await Promise.all(subscriptions.map(async sub => { try { await webPush.sendNotification(sub, payload, { TTL: 86400, urgency: 'normal' });delivered++; } catch (e) { if (e && (e.statusCode === 404 || e.statusCode === 410)) dead.add(sub.endpoint); else console.warn('push send fail:', e && e.message); } }));
      if (dead.size) DB.pushSubscriptions[deviceId] = subscriptions.filter(s => !dead.has(s.endpoint));
      if (delivered) { job.sentAt = now;changed = true; }
    }
    const fresh = (Array.isArray(jobs) ? jobs : []).filter(j => !j.sentAt || j.sentAt > now - 7 * 86400000);
    if (fresh.length !== jobs.length) { DB.pushSchedules[deviceId] = fresh;changed = true; }
  }
  if (changed) persist();
}
function runPushSchedulesSafely() {
  processPushSchedules().catch(error => console.error('push schedule processing failed:', error && error.message ? error.message : error));
}

function endpointUrl(baseUrl, type) {
  let u;
  try { u = new URL(baseUrl); } catch (_) { throw fail(400, 'invalid baseUrl'); }
  u.hash = '';
  u.search = '';
  let p = u.pathname.replace(/\/+$/, '');
  if (type === 'vision') {
    if (!/\/(?:responses|chat\/completions)$/.test(p)) p += '/chat/completions';
  } else if (type === 'models') {
    p = p.replace(/\/(?:responses|chat\/completions)$/, '');
    p += '/models';
  } else if (type === 'stt') {
    if (/\/(?:responses|chat\/completions)$/.test(p)) throw fail(400, 'STT must use its own API base URL');
    if (!/\/audio\/transcriptions$/.test(p)) p += '/audio/transcriptions';
  }
  u.pathname = p.replace(/\/{2,}/g, '/');
  return u.toString();
}

const { createPaidAdminModule } = require('./paid-admin');
const paidAdmin = createPaidAdminModule({
  getDb: () => DB,
  setDb: value => { DB = value; },
  persist,
  send,
  readBody,
  authenticateContext,
  publicUser,
  authClientKey,
  requestUpstream,
  endpointUrl,
  readLimited,
  parseMultipart,
  buildMultipart,
  maxAudioBody: MAX_AUDIO_BODY,
  // Client-supplied model credentials survive only for the existing local mock
  // regression harness. Production always uses administrator-managed providers.
  allowPrivateUpstream: ALLOW_PRIVATE_UPSTREAM
});

const server = http.createServer(async (req, res) => {
  res.__requestOrigin = req.headers.origin || '';
  if (req.method === 'OPTIONS') return send(res, 204, {});
  const route = (req.url || '').split('?')[0];
  try {
    if (route === '/' || route === '/health') return send(res, 200, { ok: true, ts: Date.now() });

    const paidHandled = await paidAdmin.handle(req, res, route);
    if (paidHandled !== false) return;

    if (route === '/api/auth/register' && req.method === 'POST') {
      const body = await readBody(req);
      const email = normalizeEmail(body.email);
      enforceAuthRate(req, 'register-ip', '*', 20, 60 * 60 * 1000);
      enforceAuthRate(req, 'register', email, 8, 60 * 60 * 1000);
      if (findUserByEmail(email)) return send(res, 409, { error: '该邮箱已注册，请直接登录' });
      const password = validatePassword(body.password);
      const displayName = normalizeDisplayName(body.displayName, email);
      const avatar = normalizeAvatar(body.avatar);
      authenticateDevice(body.deviceId, body.deviceToken);
      const now = Date.now();
      const user = {
        id: 'usr_' + crypto.randomBytes(12).toString('hex'),
        email,
        displayName,
        avatar,
        bio: '',
        timezone: 'Asia/Shanghai',
        ...(await makePasswordRecord(password)),
        createdAt: now,
        updatedAt: now,
        lastLoginAt: now
      };
      // scrypt is asynchronous; another request may have registered this normalized
      // email while the password hash was being computed.
      if (findUserByEmail(email)) return send(res, 409, { error: '该邮箱已注册，请直接登录' });
      const beforeRegistration = JSON.stringify(DB);
      let sessionToken;
      try {
        DB.users[user.id] = user;
        // Account, one-time trial claim, subscription and session are one durable
        // mutation. A failed write cannot consume a trial or leave a partial user.
        paidAdmin.claimRegistrationTrial(user, email, now);
        associateDeviceWithUser(body.deviceId, user.id, body.claimLocalData !== false);
        sessionToken = createSession(user.id, body.deviceId);
        persist();
      } catch (error) {
        DB = JSON.parse(beforeRegistration);
        throw error;
      }
      clearAuthRate(req, 'register', email);
      return send(res, 201, { user: publicUser(user), sessionToken });
    }

    if (route === '/api/auth/login' && req.method === 'POST') {
      const body = await readBody(req);
      const email = normalizeEmail(body.email);
      enforceAuthRate(req, 'login-ip', '*', 40, 15 * 60 * 1000);
      enforceAuthRate(req, 'login', email, 12, 15 * 60 * 1000);
      const user = findUserByEmail(email);
      const credentialHash = user && user.passwordHash;
      if (!await verifyPassword(user, body.password)) return send(res, 401, { error: '邮箱或密码不正确' });
      if (!user || DB.users[user.id] !== user || user.passwordHash !== credentialHash) return send(res, 401, { error: '邮箱或密码不正确' });
      authenticateDevice(body.deviceId, body.deviceToken);
      user.lastLoginAt = Date.now();
      user.updatedAt = Number(user.updatedAt) || user.lastLoginAt;
      associateDeviceWithUser(body.deviceId, user.id, body.claimLocalData === true);
      const sessionToken = createSession(user.id, body.deviceId);
      clearAuthRate(req, 'login', email);
      persist();
      return send(res, 200, { user: publicUser(user), sessionToken });
    }

    if (route === '/api/auth/me' && req.method === 'POST') {
      const body = await readBody(req);
      const context = authenticateContext(req, body, true);
      persist();
      return send(res, 200, { user: publicUser(context.auth.user) });
    }

    if (route === '/api/auth/logout' && req.method === 'POST') {
      const body = await readBody(req);
      const context = authenticateContext(req, body, true);
      delete DB.sessions[context.auth.hash];
      delete DB.pushSubscriptions[body.deviceId];
      delete DB.pushSchedules[body.deviceId];
      persist();
      return send(res, 200, { ok: true, user: publicUser(context.auth.user) });
    }

    if (route === '/api/auth/profile' && req.method === 'POST') {
      const body = await readBody(req);
      const context = authenticateContext(req, body, true);
      const user = context.auth.user;
      const nextUser = { ...user };
      if (Object.prototype.hasOwnProperty.call(body, 'displayName')) nextUser.displayName = normalizeDisplayName(body.displayName, user.email);
      if (Object.prototype.hasOwnProperty.call(body, 'avatar')) nextUser.avatar = normalizeAvatar(body.avatar);
      if (Object.prototype.hasOwnProperty.call(body, 'bio')) {
        const bio = String(body.bio || '').trim();
        if (bio.length > 500) throw fail(400, '个人简介不能超过 500 个字符');
        nextUser.bio = bio;
      }
      if (Object.prototype.hasOwnProperty.call(body, 'timezone')) {
        const timezone = String(body.timezone || '').trim();
        if (!/^[A-Za-z_+\-/]{1,64}$/.test(timezone)) throw fail(400, '时区格式无效');
        nextUser.timezone = timezone;
      }
      nextUser.updatedAt = Date.now();
      Object.assign(user, nextUser);
      persist();
      return send(res, 200, { user: publicUser(user) });
    }

    if (route === '/api/auth/password' && req.method === 'POST') {
      const body = await readBody(req);
      const context = authenticateContext(req, body, true);
      const user = context.auth.user;
      enforceAuthRate(req, 'password', user.id, 8, 30 * 60 * 1000);
      const credentialHash = user.passwordHash;
      if (!await verifyPassword(user, body.currentPassword)) return send(res, 401, { error: '当前密码不正确' });
      if (DB.users[user.id] !== user || user.passwordHash !== credentialHash) throw fail(409, '账号信息已发生变化，请重试');
      const nextPassword = validatePassword(body.newPassword, '新密码');
      if (safeEqual(String(body.currentPassword), nextPassword)) throw fail(400, '新密码不能与当前密码相同');
      const nextPasswordRecord = await makePasswordRecord(nextPassword);
      if (DB.users[user.id] !== user || user.passwordHash !== credentialHash) throw fail(409, '账号信息已发生变化，请重试');
      Object.assign(user, nextPasswordRecord, { updatedAt: Date.now() });
      removeUserSessions(user.id);
      const sessionToken = createSession(user.id, body.deviceId);
      clearAuthRate(req, 'password', user.id);
      persist();
      return send(res, 200, { user: publicUser(user), sessionToken });
    }

    if (route === '/api/auth/export' && req.method === 'POST') {
      const body = await readBody(req);
      const context = authenticateContext(req, body, true);
      persist();
      return send(res, 200, { user: publicUser(context.auth.user), exportedAt: new Date().toISOString(), schemaVersion: 1, state: pullFor(body.deviceId, context.userId) });
    }

    if (route === '/api/auth/delete' && req.method === 'POST') {
      const body = await readBody(req);
      const context = authenticateContext(req, body, true);
      const user = context.auth.user;
      enforceAuthRate(req, 'delete', user.id, 5, 60 * 60 * 1000);
      const credentialHash = user.passwordHash;
      if (!await verifyPassword(user, body.password)) return send(res, 401, { error: '密码不正确，账号未删除' });
      if (DB.users[user.id] !== user || user.passwordHash !== credentialHash) throw fail(409, '账号信息已发生变化，请重试');
      const deletedUser = publicUser(user);
      deleteAccountData(user.id);
      persist();
      return send(res, 200, { ok: true, user: deletedUser });
    }

    if (route === '/api/push/public-key' && req.method === 'GET') return send(res, 200, { enabled: PUSH_ENABLED, publicKey: PUSH_ENABLED ? DB.pushConfig.publicKey : '' });

    if (route === '/api/push/subscribe' && req.method === 'POST') {
      if (!PUSH_ENABLED) return send(res, 503, { error: 'push service is not installed' });
      const body = await readBody(req);authenticateContext(req, body, false);
      const subscription = normalizePushSubscription(body.subscription),list = Array.isArray(DB.pushSubscriptions[body.deviceId]) ? DB.pushSubscriptions[body.deviceId] : [];
      DB.pushSubscriptions[body.deviceId] = [...list.filter(x => x.endpoint !== subscription.endpoint), subscription].slice(-8);persist();
      return send(res, 200, { ok: true });
    }

    if (route === '/api/push/schedule' && req.method === 'POST') {
      if (!PUSH_ENABLED) return send(res, 503, { error: 'push service is not installed' });
      const body = await readBody(req);authenticateContext(req, body, false);
      DB.pushSchedules[body.deviceId] = normalizePushJobs(body.jobs);persist();setTimeout(runPushSchedulesSafely, 10);
      return send(res, 200, { ok: true, count: DB.pushSchedules[body.deviceId].length });
    }

    if (route === '/api/sync' && req.method === 'POST') {
      const body = await readBody(req);
      const context = authenticateContext(req, body, false);
      const stateBeforeMerge = JSON.stringify(store());
      try { mergeState(body.state, body.deviceId, context.userId); }
      catch (error) { DB._g = JSON.parse(stateBeforeMerge); throw error; }
      DB.devices[body.deviceId].lastSync = Date.now();
      persist();
      return send(res, 200, { state: pullFor(body.deviceId, context.userId) });
    }

    if (route === '/api/share/create' && req.method === 'POST') {
      const body = await readBody(req);
      const context = authenticateContext(req, body, false);
      const ledger = store().ledgers[body.ledgerId];
      if (!ledger || ledger.deleted) return send(res, 404, { error: 'ledger not found' });
      if (!ownsRecord(ledger, body.deviceId, context.userId)) return send(res, 403, { error: 'only the ledger owner can share it' });
      ledger.shared = true;
      ledger.members = Array.isArray(ledger.members) ? ledger.members : [body.deviceId];
      const accountMember = accountMemberId(context.userId);
      if (accountMember) {
        ledger.members = ledger.members.filter(member => member !== body.deviceId);
        if (!ledger.members.includes(accountMember)) ledger.members.push(accountMember);
      } else if (!ledger.members.includes(body.deviceId)) ledger.members.push(body.deviceId);
      ledger.updatedAt = Date.now();
      const code = uid();
      DB.shares[code] = { ledgerId: ledger.id, createdAt: Date.now() };
      persist();
      return send(res, 200, { code, ledger });
    }

    if (route === '/api/share/join' && req.method === 'POST') {
      const body = await readBody(req);
      const context = authenticateContext(req, body, false);
      const share = DB.shares[String(body.code || '').trim().toUpperCase()];
      if (!share) return send(res, 404, { error: 'invalid code' });
      const ledger = store().ledgers[share.ledgerId];
      if (!ledger || ledger.deleted) return send(res, 404, { error: 'ledger gone' });
      ledger.shared = true;
      ledger.members = Array.isArray(ledger.members) ? ledger.members : [ledger.owner];
      const accountMember = accountMemberId(context.userId);
      if (accountMember) {
        ledger.members = ledger.members.filter(member => member !== body.deviceId);
        if (!ledger.members.includes(accountMember)) ledger.members.push(accountMember);
      } else if (!ledger.members.includes(body.deviceId)) ledger.members.push(body.deviceId);
      ledger.updatedAt = Date.now();
      persist();
      return send(res, 200, { ledger });
    }

    if (route === '/api/share/leave' && req.method === 'POST') {
      const body = await readBody(req);
      const context = authenticateContext(req, body, false);
      const ledger = store().ledgers[body.ledgerId];
      if (!ledger || ledger.deleted) return send(res, 404, { error: 'ledger not found' });
      if (ownsRecord(ledger, body.deviceId, context.userId)) return send(res, 409, { error: '账本所有者不能退出共享，请先删除账本或转移所有权' });
      const member = context.userId ? accountMemberId(context.userId) : body.deviceId;
      if (!Array.isArray(ledger.members) || !ledger.members.includes(member)) return send(res, 403, { error: '你不是该共享账本的成员' });
      ledger.members = ledger.members.filter(item => item !== member);
      ledger.updatedAt = Date.now();
      persist();
      return send(res, 200, { ok: true, ledgerId: ledger.id });
    }

    if (route === '/api/vision' && req.method === 'POST') {
      const body = await readBody(req);
      authenticateContext(req, body, false);
      const { apiKey, baseUrl, model, messages, input } = body;
      if (!apiKey || !baseUrl || !model || (!messages && !input)) return send(res, 400, { error: 'missing apiKey/baseUrl/model/messages|input' });
      const target = endpointUrl(baseUrl, 'vision');
      const useResponses = /\/responses$/.test(new URL(target).pathname);
      const payload = JSON.stringify(useResponses ? { model, input, max_output_tokens: 1200 } : { model, messages, max_tokens: 1200 });
      const upstream = await requestUpstream(target, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
        body: payload,
        timeout: 90000
      });
      if (upstream.status >= 300) return send(res, 502, { error: 'upstream error', status: upstream.status, detail: upstream.text.slice(0, 2000) });
      try { return send(res, 200, JSON.parse(upstream.text)); } catch (_) { return send(res, 200, { text: upstream.text }); }
    }

    if (route === '/api/stt' && req.method === 'POST') {
      const ct = req.headers['content-type'] || '';
      const boundaryM = ct.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
      if (!boundaryM) return send(res, 400, { error: 'no boundary' });
      const raw = await readLimited(req, MAX_AUDIO_BODY);
      const parts = parseMultipart(raw, (boundaryM[1] || boundaryM[2]).trim());
      const field = name => { const p = parts.find(x => x.name === name); return p ? p.body.toString('utf8').trim() : ''; };
      const filePart = parts.find(p => p.name === 'file');
      const deviceId = field('deviceId');
      const deviceToken = field('deviceToken');
      const sessionToken = field('sessionToken');
      authenticateContext(req, { deviceId, deviceToken, sessionToken }, false);
      const apiKey = field('apiKey');
      const baseUrl = field('baseUrl');
      const model = field('model') || 'whisper-1';
      if (!filePart || !filePart.body.length || !apiKey || !baseUrl) return send(res, 400, { error: 'missing file/apiKey/baseUrl' });
      const target = endpointUrl(baseUrl, 'stt');
      const upParts = [
        { name: 'file', filename: filePart.filename || 'audio.webm', contentType: filePart.contentType || 'application/octet-stream', body: filePart.body },
        { name: 'model', body: Buffer.from(model) }
      ];
      const built = buildMultipart(upParts);
      const upstream = await requestUpstream(target, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'multipart/form-data; boundary=' + built.boundary, 'Content-Length': built.body.length },
        body: built.body,
        timeout: 90000
      });
      if (upstream.status >= 300) return send(res, 502, { error: 'upstream error', status: upstream.status, detail: upstream.text.slice(0, 1000) });
      try { return send(res, 200, JSON.parse(upstream.text)); } catch (_) { return send(res, 200, { text: upstream.text }); }
    }

    if (route === '/api/models' && req.method === 'POST') {
      const body = await readBody(req);
      authenticateContext(req, body, false);
      if (!body.apiKey || !body.baseUrl) return send(res, 400, { error: 'missing apiKey/baseUrl' });
      const target = endpointUrl(body.baseUrl, 'models');
      const upstream = await requestUpstream(target, { method: 'GET', headers: { Authorization: 'Bearer ' + body.apiKey, 'Content-Type': 'application/json' } });
      if (upstream.status >= 300) return send(res, 502, { error: 'upstream error', status: upstream.status, detail: upstream.text.slice(0, 2000) });
      let data;
      try { data = JSON.parse(upstream.text); } catch (_) { return send(res, 502, { error: 'bad json', detail: upstream.text.slice(0, 500) }); }
      let ids = [];
      if (Array.isArray(data.data)) ids = data.data.map(m => m && m.id).filter(x => typeof x === 'string');
      else if (Array.isArray(data.models)) ids = data.models.map(m => m && m.id).filter(x => typeof x === 'string');
      else if (Array.isArray(data)) ids = data.map(m => typeof m === 'string' ? m : m && m.id).filter(x => typeof x === 'string');
      return send(res, 200, { models: ids.slice(0, 500) });
    }

    return send(res, 404, { error: 'not found' });
  } catch (e) {
    const code = Number(e.statusCode) || 500;
    return send(res, code, { error: code >= 500 ? 'server error' : e.message, detail: code >= 500 ? String(e.message || e) : undefined });
  }
});

server.listen(PORT, HOST, () => {
  const address = server.address();
  console.log('记账本同步服务器已启动：http://localhost:' + (address && address.port));
  if (ALLOW_PRIVATE_UPSTREAM) console.warn('警告：ALLOW_PRIVATE_UPSTREAM=1，已允许访问本机/内网的上游地址。');
  if (PUSH_ENABLED) console.log('个人计划云端推送已启用。');
});

const pushTimer = setInterval(runPushSchedulesSafely, 30000);
if (pushTimer.unref) pushTimer.unref();

module.exports = { server, endpointUrl, isPrivateAddress, pinnedLookup, processPushSchedules, authClientKey };
