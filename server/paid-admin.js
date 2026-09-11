'use strict';

const crypto = require('crypto');
const net = require('net');

const ADMIN_COOKIE = 'littlejoy_admin';
const ADMIN_SESSION_MS = Math.max(1, Math.min(30, Number(process.env.ADMIN_SESSION_DAYS) || 1)) * 86400000;
const ADMIN_ROLES = new Set(['super_admin', 'billing_admin', 'ai_operator', 'support', 'auditor']);
const ENTITLEMENT_KEYS = new Set(['cloud.sync', 'ledger.share', 'theme.premium', 'ai.receipt', 'ai.batch_receipt', 'ai.voice', 'ai.writing']);
const AI_FEATURES = new Set(['ai.receipt', 'ai.batch_receipt', 'ai.voice', 'ai.writing']);
const AI_CAPABILITIES = new Set(['vision', 'stt', 'text']);
const PAID_BILLING_CHANNELS = new Set(['offline', 'wechat_manual', 'alipay_manual', 'bank']);
const TRIAL_PLAN_ID = 'trial_new_user_3d';
const TRIAL_DURATION_MS = 3 * 86400000;
const ADMIN_RATE_LIMITS = new Map();
let ADMIN_SCRYPT_ACTIVE = 0;
const OFFICIAL_AI_HOSTS = new Set([
  'ark.cn-beijing.volces.com',
  'api.openai.com',
  'api.hunyuan.cloud.tencent.com',
  'hunyuan.tencentcloudapi.com'
]);
for (const host of String(process.env.PLATFORM_AI_HOSTS || '').split(',')) {
  const normalized = host.trim().toLowerCase();
  if (normalized) OFFICIAL_AI_HOSTS.add(normalized);
}

const THEME_SEEDS = [
  ['premium-moon-cat', '月光猫咖', '猫爪菜单、月亮卡片与咖啡热气'],
  ['premium-sakura-post', '樱花邮局', '邮票按钮、信封账单与花瓣动效'],
  ['premium-forest-spirit', '森林精灵', '叶片导航、萤火虫与森林小屋'],
  ['premium-caramel-pudding', '奶油布丁', '布丁卡片、焦糖渐变与轻弹动效'],
  ['premium-cloud-sheep', '云朵绵羊', '云朵菜单、绵羊吉祥物与柔软圆角'],
  ['premium-galaxy-unicorn', '银河独角兽', '极光渐变、星尘与玻璃卡片'],
  ['premium-sea-jellyfish', '海盐水母', '半透明水波、水母漂浮与气泡菜单'],
  ['premium-black-gold-cat', '黑金招财猫', '黑色磨砂、金币图表与招财猫'],
  ['premium-gingerbread', '圣诞姜饼屋', '姜饼按钮、雪花与礼盒菜单'],
  ['premium-koi-new-year', '新年锦鲤', '锦鲤、祥云、鎏金边框与红包卡片'],
  ['premium-zodiac-golden-dragon', '金龙献瑞', '十二生肖限定：祥龙、祥云与鎏金如意纹'],
  ['premium-zodiac-jade-rabbit', '玉兔望月', '十二生肖限定：玉兔、桂影与月华流光'],
  ['premium-dunhuang-flying-apsara', '敦煌飞天', '中国文化限定：飞天飘带、壁画朱砂与沙金'],
  ['premium-blue-white-porcelain', '青花瓷韵', '中国文化限定：青花缠枝、瓷白卡片与水墨蓝']
];

const PAID_PLAN_SEEDS = [
  { id: 'member_month_1290', name: '限定会员·月卡', description: '首发内测价：限定主题与平台 AI 月额度', active: true, priceCents: 1290, durationDays: 30 },
  { id: 'member_quarter_3590', name: '限定会员·季卡', description: '首发内测价：连续 90 天限定主题与平台 AI 月额度', active: true, priceCents: 3590, durationDays: 90 },
  { id: 'member_year_11800', name: '限定会员·年卡', description: '首发内测价：连续 365 天限定主题与平台 AI 月额度', active: true, priceCents: 11800, durationDays: 365 }
];

function paidPlanEntitlements() {
  return {
    'theme.premium': { enabled: true },
    'ai.receipt': { enabled: true, monthlyQuota: 60 },
    'ai.batch_receipt': { enabled: true, monthlyQuota: 20 },
    'ai.voice': { enabled: true, monthlyQuota: 60 },
    'ai.writing': { enabled: true, monthlyQuota: 40 }
  };
}

function trialPlanEntitlements() {
  return {
    'theme.premium': { enabled: true },
    'ai.receipt': { enabled: true, monthlyQuota: 3 },
    'ai.batch_receipt': { enabled: true, monthlyQuota: 1 },
    'ai.voice': { enabled: true, monthlyQuota: 3 },
    'ai.writing': { enabled: true, monthlyQuota: 5 }
  };
}

function fail(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function id(prefix) { return prefix + '_' + crypto.randomBytes(12).toString('hex'); }
function hash(value) { return crypto.createHash('sha256').update(String(value)).digest('hex'); }
function safeEqual(a, b) {
  const aa = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function cleanText(value, max, label, allowEmpty = true) {
  const text = String(value || '').trim().replace(/[\u0000-\u001f\u007f]/g, '');
  if ((!allowEmpty && !text) || text.length > max) throw fail(400, `${label}格式无效`);
  return text;
}
function validKey(value, max = 100) {
  const text = String(value || '').trim();
  if (!new RegExp(`^[A-Za-z0-9_.-]{1,${max}}$`).test(text)) throw fail(400, '标识格式无效');
  return text;
}
function integer(value, min, max, label) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < min || number > max) throw fail(400, `${label}必须是有效整数`);
  return number;
}
function parseCookies(req) {
  const out = {};
  for (const item of String(req.headers.cookie || '').split(';')) {
    const index = item.indexOf('=');
    if (index < 1) continue;
    try { out[item.slice(0, index).trim()] = decodeURIComponent(item.slice(index + 1).trim()); } catch (_) {}
  }
  return out;
}
function adminCookie(token, clear = false) {
  const secure = process.env.COOKIE_SECURE === '1' || process.env.NODE_ENV === 'production';
  return `${ADMIN_COOKIE}=${encodeURIComponent(token || '')}; Path=/api/admin; HttpOnly; SameSite=Strict; ${secure ? 'Secure; ' : ''}Max-Age=${clear ? 0 : Math.floor(ADMIN_SESSION_MS / 1000)}`;
}
function isLoopback(req, authClientKey) {
  const address = String(authClientKey(req) || '').replace(/^::ffff:/, '');
  return address === '127.0.0.1' || address === '::1';
}
function normalizeEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw fail(400, '请输入有效邮箱');
  return email;
}
function validatePassword(value) {
  const password = String(value || '');
  if (password.length < 10 || password.length > 128 || !/[A-Za-z\u3400-\u9fff]/.test(password) || !/\d/.test(password)) {
    throw fail(400, '密码需为 10 至 128 位，并同时包含字母（或中文）和数字');
  }
  return password;
}
function scrypt(password, salt) {
  return new Promise((resolve, reject) => crypto.scrypt(String(password), String(salt), 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (error, key) => error ? reject(error) : resolve(key.toString('hex'))));
}
async function passwordRecord(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  return { passwordSalt: salt, passwordHash: await scrypt(validatePassword(password), salt), passwordAlgo: 'scrypt-v1' };
}
async function verifyPassword(record, password) {
  const salt = record && record.passwordSalt ? record.passwordSalt : 'a12e0d8c47022c187b648a4f773aa165';
  const expected = record && record.passwordHash ? record.passwordHash : '0'.repeat(128);
  return !!(record && safeEqual(await scrypt(String(password || ''), salt), expected));
}

function ensureDb(db) {
  const objectTables = ['plans', 'subscriptions', 'entitlementGrants', 'manualPayments', 'themeCatalog', 'aiProviders', 'aiRoutes', 'aiUsageEvents', 'adminUsers', 'adminSessions', 'featureFlags', 'trialClaims'];
  for (const table of objectTables) if (!db[table] || typeof db[table] !== 'object' || Array.isArray(db[table])) db[table] = {};
  if (!Array.isArray(db.auditLogs)) db.auditLogs = [];
  const now = Date.now();
  for (const [themeId, name, description] of THEME_SEEDS) {
    if (!db.themeCatalog[themeId]) db.themeCatalog[themeId] = { id: themeId, name, description, premium: true, requiredEntitlement: 'theme.premium', enabled: true, sortOrder: THEME_SEEDS.findIndex(x => x[0] === themeId) + 1, createdAt: now, updatedAt: now };
  }
  if (!db.plans.premium_monthly) {
    db.plans.premium_monthly = {
      id: 'premium_monthly', name: '限定会员（月度）', description: '限定主题与 AI 月额度', active: false,
      priceCents: 0, durationDays: 30,
      entitlements: {
        'theme.premium': { enabled: true },
        'ai.receipt': { enabled: true, monthlyQuota: 100 },
        'ai.batch_receipt': { enabled: true, monthlyQuota: 20 },
        'ai.voice': { enabled: true, monthlyQuota: 100 },
        'ai.writing': { enabled: true, monthlyQuota: 60 }
      }, createdAt: now, updatedAt: now
    };
  }
  // These use new, versioned IDs so an operator's legacy plan — including one
  // already sold — is never silently overwritten by a future application boot.
  for (const seed of PAID_PLAN_SEEDS) {
    if (!db.plans[seed.id]) db.plans[seed.id] = { ...clone(seed), entitlements: paidPlanEntitlements(), createdAt: now, updatedAt: now };
    else if (Number(db.plans[seed.id].priceCents) === seed.priceCents && Number(db.plans[seed.id].durationDays) === seed.durationDays && db.plans[seed.id].entitlements && !db.plans[seed.id].entitlements['ai.writing']) db.plans[seed.id].entitlements['ai.writing'] = { enabled: true, monthlyQuota: 40 };
  }
  if (!db.plans[TRIAL_PLAN_ID]) {
    db.plans[TRIAL_PLAN_ID] = {
      id: TRIAL_PLAN_ID,
      name: '新用户 3 天会员体验',
      description: '首次邮箱注册自动获得；不可购买、不可重复领取',
      active: false,
      priceCents: 0,
      durationDays: 3,
      entitlements: trialPlanEntitlements(),
      internal: true,
      createdAt: now,
      updatedAt: now
    };
  }
  if (db.plans[TRIAL_PLAN_ID] && db.plans[TRIAL_PLAN_ID].entitlements && !db.plans[TRIAL_PLAN_ID].entitlements['ai.writing']) db.plans[TRIAL_PLAN_ID].entitlements['ai.writing'] = { enabled: true, monthlyQuota: 5 };
  if (!db.featureFlags.guest_direct_access) db.featureFlags.guest_direct_access = { key: 'guest_direct_access', enabled: true, public: true, updatedAt: now };
  if (!db.featureFlags.paid_ai) db.featureFlags.paid_ai = { key: 'paid_ai', enabled: true, public: true, updatedAt: now };
  if (!db.featureFlags.premium_themes) db.featureFlags.premium_themes = { key: 'premium_themes', enabled: true, public: true, updatedAt: now };
}

function publicAdmin(admin) {
  return admin ? { id: admin.id, email: admin.email, displayName: admin.displayName, role: admin.role, active: admin.active !== false, createdAt: admin.createdAt, lastLoginAt: admin.lastLoginAt || 0 } : null;
}
function publicPlan(plan) {
  if (!plan) return null;
  return { id: plan.id, name: plan.name, description: plan.description || '', active: !!plan.active, internal: plan.internal === true, priceCents: Number(plan.priceCents) || 0, durationDays: Number(plan.durationDays) || 0, entitlements: clone(plan.entitlements || {}), updatedAt: plan.updatedAt || 0 };
}
function publicTheme(theme) {
  return { id: theme.id, name: theme.name, description: theme.description || '', premium: !!theme.premium, requiredEntitlement: theme.requiredEntitlement || '', enabled: theme.enabled !== false, sortOrder: Number(theme.sortOrder) || 0, availableFrom: theme.availableFrom || null, availableUntil: theme.availableUntil || null };
}
function publicSubscription(subscription) {
  if (!subscription) return null;
  const isTrial = subscription.source === 'trial';
  const status = subscription.status === 'active' && subscription.endsAt && Number(subscription.endsAt) <= Date.now() ? 'expired' : subscription.status;
  return { id: subscription.id, planId: subscription.planId, status, source: subscription.source, isTrial, label: isTrial ? '新用户 3 天会员体验' : '', startsAt: subscription.startsAt, endsAt: subscription.endsAt, createdAt: subscription.createdAt, updatedAt: subscription.updatedAt };
}

function claimRegistrationTrial(db, user, email, now = Date.now()) {
  ensureDb(db);
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!user || !user.id || !normalizedEmail || user.email !== normalizedEmail || !db.users[user.id]) throw fail(500, '无法创建新用户体验权益');
  // Account deletion deliberately preserves this domain-separated hash. It is
  // sufficient to reject a second claim without retaining another email copy.
  const claimKey = hash(`new-user-trial:v1\0${normalizedEmail}`);
  if (db.trialClaims[claimKey]) return null;
  if (!db.plans[TRIAL_PLAN_ID]) throw fail(500, '新用户体验套餐尚未初始化');
  const subscription = {
    id: id('sub'), userId: user.id, planId: TRIAL_PLAN_ID, status: 'active', source: 'trial',
    startsAt: now, endsAt: now + TRIAL_DURATION_MS,
    metadata: { trial: true, version: 1 }, createdAt: now, updatedAt: now
  };
  db.subscriptions[subscription.id] = subscription;
  db.trialClaims[claimKey] = { emailHash: claimKey, firstUserId: user.id, subscriptionId: subscription.id, claimedAt: now, version: 1 };
  return subscription;
}
function publicProvider(provider) {
  return { id: provider.id, name: provider.name, baseUrl: provider.baseUrl, enabled: provider.enabled !== false, capabilities: provider.capabilities || [], keyConfigured: !!provider.apiKeyEncrypted, keyLast4: provider.keyLast4 || '', timeoutMs: provider.timeoutMs || 90000, inputPerMillionCents: provider.inputPerMillionCents || 0, outputPerMillionCents: provider.outputPerMillionCents || 0, updatedAt: provider.updatedAt || 0 };
}

function encryptionKey() {
  const raw = String(process.env.AI_KEY_ENCRYPTION_KEY || '').trim();
  if (!raw) throw fail(503, '未配置 AI_KEY_ENCRYPTION_KEY');
  let key;
  if (/^[a-f0-9]{64}$/i.test(raw)) key = Buffer.from(raw, 'hex');
  else {
    try { key = Buffer.from(raw.replace(/-/g, '+').replace(/_/g, '/'), 'base64'); } catch (_) { key = null; }
  }
  if (!key || key.length !== 32) throw fail(503, 'AI_KEY_ENCRYPTION_KEY 必须是 32 字节密钥（64 位十六进制或 Base64）');
  return key;
}
function encryptSecret(secret) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(String(secret), 'utf8'), cipher.final()]);
  return `v1.${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${ciphertext.toString('base64url')}`;
}
function decryptSecret(payload) {
  const parts = String(payload || '').split('.');
  if (parts.length !== 4 || parts[0] !== 'v1') throw fail(503, 'AI 密钥数据格式无效');
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(parts[1], 'base64url'));
    decipher.setAuthTag(Buffer.from(parts[2], 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(parts[3], 'base64url')), decipher.final()]).toString('utf8');
  } catch (_) { throw fail(503, 'AI 密钥无法解密，请检查服务器加密密钥'); }
}
function normalizeProviderUrl(value) {
  let url;
  try { url = new URL(String(value || '')); } catch (_) { throw fail(400, 'AI 接口地址无效'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.hash) throw fail(400, 'AI 接口必须使用无凭据的 HTTPS 地址');
  const hostname = url.hostname.toLowerCase();
  if (!OFFICIAL_AI_HOSTS.has(hostname)) throw fail(403, 'AI 接口域名不在服务器白名单');
  url.hostname = hostname;
  return url.toString();
}

function monthKey(timestamp = Date.now()) { return new Date(timestamp).toISOString().slice(0, 7); }
function normalizeVisionImage(value) {
  const image = typeof value === 'string' ? value : '';
  if (!image || image.length > 1800000) throw fail(413, '图片过大，请压缩后再上传');
  const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/i.exec(image);
  if (!match || match[2].length % 4 !== 0) throw fail(400, '只支持 JPEG、PNG 或 WebP 图片');
  const bytes = Buffer.from(match[2], 'base64');
  if (!bytes.length || bytes.length > 1300000) throw fail(413, '图片过大，请压缩后再上传');
  const type = match[1].toLowerCase();
  const jpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const png = bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const webp = bytes.length >= 12 && bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP';
  if ((type === 'jpeg' && !jpeg) || (type === 'png' && !png) || (type === 'webp' && !webp)) throw fail(400, '图片内容与格式不一致');
  return { image, bytes: bytes.length };
}
function platformVisionRequest(image, useResponses, model, maxOutputTokens) {
  const prompt = '你是中文票据与借还款识别助手。识别消费账单、收入凭证、借条、借款合同、转账和还款凭证，只返回一个 JSON 对象，不要 Markdown。字段：documentType 只能是 expense、income、loan_out、loan_in、repayment_received、repayment_paid、unknown；merchant 商家或账单名称；itemName 事项摘要；amount 本次实际发生金额；type 只能是 out 或 in；category 常用记账分类；date 为 YYYY-MM-DD；remark 补充信息；confidence 为 0 到 1；person 借还对象；principal 本金；interestType 只能是 none、fixed、annual；interestRate、fee 为数字；firstDueDate 为约定还款日；installments 默认 1；frequency 只能是 once、monthly、weekly；purpose 用途。金额优先取实付、本次借款或本次还款；没有明确证据时 documentType 为 unknown，文本为空，数值为 0。';
  if (useResponses) return {
    model,
    input: [{ role: 'user', content: [{ type: 'input_text', text: prompt }, { type: 'input_image', image_url: image, detail: 'high' }] }],
    max_output_tokens: maxOutputTokens
  };
  return {
    model,
    messages: [{ role: 'system', content: prompt }, { role: 'user', content: [{ type: 'text', text: '请识别并分类这张图片。' }, { type: 'image_url', image_url: { url: image, detail: 'high' } }] }],
    max_tokens: maxOutputTokens
  };
}
function normalizeWritingInput(body) {
  const task = body && body.task === 'diary' ? 'diary' : body && body.task === 'inspiration' ? 'inspiration' : '';
  if (!task) throw fail(400, 'AI 写作类型无效');
  const content = String(body && body.content || '').trim();
  if (content.length < 2) throw fail(400, '请先写下一些内容');
  if (content.length > 12000) throw fail(413, '内容过长，请控制在 12000 字以内');
  return { task, content };
}
function platformWritingRequest(task, content, useResponses, model, maxOutputTokens) {
  const instruction = task === 'diary'
    ? '你是中文私人日记编辑助手。润色用户日记，使表达自然、真诚、层次清楚；必须保留原有事实、人名、日期、事件和情绪，不得编造经历，不得说教，不得改变立场。只输出润色后的日记正文，不要标题、解释、Markdown 或引号；长度不超过原文的 1.5 倍。'
    : '你是中文创意发散助手。基于用户的原始灵感进行有用但克制的扩展，不要虚构用户已经完成的事情。输出纯文本，依次包含：核心想法、三个可行方向、最小下一步、建议关键词。使用短段落和清晰编号，不要 Markdown 标题，不超过 900 个汉字。';
  if (useResponses) return { model, instructions: instruction, input: content, max_output_tokens: maxOutputTokens };
  return { model, messages: [{ role: 'system', content: instruction }, { role: 'user', content }], max_tokens: maxOutputTokens };
}
function extractWritingText(raw) {
  let data; try { data = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch (_) { return String(raw || '').trim(); }
  if (typeof data.output_text === 'string') return data.output_text.trim();
  const chat = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  if (typeof chat === 'string') return chat.trim();
  if (Array.isArray(chat)) return chat.map(item => typeof item === 'string' ? item : item && item.text || '').join('\n').trim();
  if (Array.isArray(data.output)) {
    const parts=[]; for (const item of data.output) for (const part of item && Array.isArray(item.content) ? item.content : []) if (part && typeof part.text === 'string') parts.push(part.text);
    if (parts.length) return parts.join('\n').trim();
  }
  if (typeof data.text === 'string') return data.text.trim();
  return '';
}
function activeAt(item, now = Date.now()) {
  return item && item.status !== 'cancelled' && item.status !== 'disabled' && Number(item.startsAt || 0) <= now && (!item.endsAt || Number(item.endsAt) > now);
}
function mergeEntitlement(target, feature, config, source) {
  if (!ENTITLEMENT_KEYS.has(feature) || !config) return;
  const enabled = config === true || config.enabled === true;
  if (!enabled) return;
  const incoming = config.monthlyQuota === null || config.monthlyQuota === undefined ? null : Math.max(0, Number(config.monthlyQuota) || 0);
  const current = target[feature] || { enabled: false, monthlyQuota: 0, sources: [] };
  current.enabled = true;
  if (incoming === null || current.monthlyQuota === null) current.monthlyQuota = null;
  else current.monthlyQuota = Math.max(Number(current.monthlyQuota) || 0, incoming);
  current.sources.push(source);
  target[feature] = current;
}
function resolveEntitlements(db, userId, now = Date.now()) {
  const entitlements = {
    'cloud.sync': { enabled: true, monthlyQuota: null, sources: ['registered'] },
    'ledger.share': { enabled: true, monthlyQuota: null, sources: ['registered'] },
    'theme.premium': { enabled: false, monthlyQuota: 0, sources: [] },
    'ai.receipt': { enabled: false, monthlyQuota: 0, sources: [] },
    'ai.batch_receipt': { enabled: false, monthlyQuota: 0, sources: [] },
    'ai.voice': { enabled: false, monthlyQuota: 0, sources: [] },
    'ai.writing': { enabled: false, monthlyQuota: 0, sources: [] }
  };
  const subscriptions = Object.values(db.subscriptions).filter(item => item && item.userId === userId && activeAt(item, now));
  for (const subscription of subscriptions) {
    const plan = db.plans[subscription.planId];
    if (!plan) continue;
    for (const [feature, config] of Object.entries(plan.entitlements || {})) mergeEntitlement(entitlements, feature, config, `subscription:${subscription.id}`);
  }
  const grants = Object.values(db.entitlementGrants).filter(item => item && item.userId === userId && activeAt(item, now)).sort((a, b) => Number(a.createdAt) - Number(b.createdAt));
  for (const grant of grants) {
    if (!ENTITLEMENT_KEYS.has(grant.feature)) continue;
    if (grant.enabled === false) entitlements[grant.feature] = { enabled: false, monthlyQuota: 0, sources: [`grant:${grant.id}`] };
    else mergeEntitlement(entitlements, grant.feature, { enabled: true, monthlyQuota: grant.monthlyQuota }, `grant:${grant.id}`);
  }
  return entitlements;
}
function usagePeriod(db, entitlement, month) {
  const sources = entitlement && Array.isArray(entitlement.sources) ? entitlement.sources : [];
  const trialWindows = [];
  let hasNonTrialSource = false;
  for (const source of sources) {
    if (String(source).startsWith('subscription:')) {
      const subscription = db.subscriptions[String(source).slice('subscription:'.length)];
      if (subscription && subscription.source === 'trial') {
        trialWindows.push({ startsAt: Number(subscription.startsAt) || 0, endsAt: Number(subscription.endsAt) || 0 });
      } else {
        hasNonTrialSource = true;
      }
    } else if (String(source).startsWith('grant:')) {
      hasNonTrialSource = true;
    }
  }
  if (trialWindows.length && !hasNonTrialSource) {
    return {
      kind: 'trial',
      windows: trialWindows,
      startsAt: Math.min(...trialWindows.map(item => item.startsAt)),
      endsAt: Math.max(...trialWindows.map(item => item.endsAt))
    };
  }
  const match = /^(\d{4})-(\d{2})$/.exec(String(month || ''));
  const startsAt = match ? Date.UTC(Number(match[1]), Number(match[2]) - 1, 1) : null;
  const endsAt = match ? Date.UTC(Number(match[1]), Number(match[2]), 1) : null;
  return { kind: 'month', windows: [], startsAt, endsAt };
}
function usageFor(db, userId, entitlements, month = monthKey(), now = Date.now()) {
  const cutoff = now - 15 * 60 * 1000;
  const events = Object.values(db.aiUsageEvents);
  const out = {};
  for (const feature of AI_FEATURES) {
    const entitlement = entitlements[feature];
    const limit = entitlement && entitlement.enabled ? entitlement.monthlyQuota : 0;
    const period = usagePeriod(db, entitlement, month);
    let used = 0;
    for (const event of events) {
      if (!event || event.userId !== userId || event.feature !== feature) continue;
      if (event.status !== 'succeeded' && !(event.status === 'reserved' && Number(event.createdAt) > cutoff)) continue;
      if (period.kind === 'trial') {
        const createdAt = Number(event.createdAt) || 0;
        if (!period.windows.some(window => createdAt >= window.startsAt && (!window.endsAt || createdAt < window.endsAt))) continue;
      } else if (event.month !== month) continue;
      used++;
    }
    out[feature] = {
      used,
      limit,
      remaining: limit === null ? null : Math.max(0, Number(limit) - used),
      period: period.kind,
      periodStartsAt: period.startsAt,
      periodEndsAt: period.endsAt
    };
  }
  return out;
}
function currentSubscription(db, userId, now = Date.now()) {
  const items = Object.values(db.subscriptions).filter(item => item && item.userId === userId && activeAt(item, now)).sort((a, b) => Number(b.endsAt || Number.MAX_SAFE_INTEGER) - Number(a.endsAt || Number.MAX_SAFE_INTEGER));
  return items[0] || null;
}

function createPaidAdminModule(deps) {
  const { getDb, setDb, persist, send, readBody, authenticateContext, publicUser, authClientKey, requestUpstream, endpointUrl, readLimited, parseMultipart, buildMultipart, maxAudioBody, allowPrivateUpstream } = deps;
  ensureDb(getDb());

  function enforceAdminRate(req, subject) {
    const now = Date.now(); const client = authClientKey(req); const keys = [[`${client}:*`, 40], [`${client}:${String(subject || '').slice(0, 254)}`, 10]];
    for (const [key, limit] of keys) {
      const current = ADMIN_RATE_LIMITS.get(key);
      if (!current || current.resetAt <= now) ADMIN_RATE_LIMITS.set(key, { count: 1, resetAt: now + 15 * 60 * 1000 });
      else if (++current.count > limit) throw fail(429, '管理员登录尝试过多，请稍后再试');
    }
    if (ADMIN_RATE_LIMITS.size > 2000) {
      for (const [entryKey, item] of ADMIN_RATE_LIMITS) if (item.resetAt <= now) ADMIN_RATE_LIMITS.delete(entryKey);
      while (ADMIN_RATE_LIMITS.size > 2000) ADMIN_RATE_LIMITS.delete(ADMIN_RATE_LIMITS.keys().next().value);
    }
  }
  function clearAdminRate(req, subject) { ADMIN_RATE_LIMITS.delete(`${authClientKey(req)}:${String(subject || '').slice(0, 254)}`); }

  function transaction(mutator) {
    const before = JSON.stringify(getDb());
    try {
      const result = mutator(getDb());
      persist();
      return result;
    } catch (error) {
      setDb(JSON.parse(before));
      throw error;
    }
  }
  function audit(db, admin, action, targetType, targetId, details = {}) {
    db.auditLogs.push({ id: id('audit'), adminId: admin.id, adminRole: admin.role, action, targetType, targetId: String(targetId || ''), details: clone(details), createdAt: Date.now() });
    if (db.auditLogs.length > 10000) db.auditLogs.splice(0, db.auditLogs.length - 10000);
  }
  function requireAdmin(req, roles) {
    const token = parseCookies(req)[ADMIN_COOKIE];
    if (!token || token.length < 32 || token.length > 256) throw fail(401, '管理员未登录');
    const db = getDb();
    const tokenKey = hash(token);
    const session = db.adminSessions[tokenKey];
    const admin = session && db.adminUsers[session.adminId];
    if (!session || !admin || admin.active === false || Number(session.expiresAt) <= Date.now()) {
      if (session) delete db.adminSessions[tokenKey];
      throw fail(401, '管理员登录已失效');
    }
    if (roles && admin.role !== 'super_admin' && !roles.includes(admin.role)) throw fail(403, '当前管理员角色无权执行此操作');
    session.lastSeenAt = Date.now();
    return { admin, session, tokenKey };
  }
  function requireSuper(req) {
    const context = requireAdmin(req);
    if (context.admin.role !== 'super_admin') throw fail(403, '仅超级管理员可以执行此操作');
    return context;
  }
  function requireCsrf(req, body, context) {
    const token = String(req.headers['x-csrf-token'] || (body && body.csrfToken) || '');
    if (!token || !safeEqual(hash(token), context.session.csrfHash)) throw fail(403, 'CSRF 校验失败，请刷新后台后重试');
  }
  async function requireConfirmation(admin, password) {
    const expected = admin.passwordHash;
    if (!await verifyPassword(admin, password) || getDb().adminUsers[admin.id] !== admin || admin.passwordHash !== expected) throw fail(401, '管理员二次密码确认失败');
  }
  function createAdminSession(db, adminId) {
    const token = crypto.randomBytes(32).toString('base64url');
    const csrf = crypto.randomBytes(24).toString('base64url');
    const now = Date.now();
    for (const [key, session] of Object.entries(db.adminSessions)) if (!session || Number(session.expiresAt) <= now) delete db.adminSessions[key];
    db.adminSessions[hash(token)] = { adminId, csrfHash: hash(csrf), createdAt: now, lastSeenAt: now, expiresAt: now + ADMIN_SESSION_MS };
    return { token, csrf };
  }
  function userContext(req, body) { return authenticateContext(req, body, true); }
  function userPayload(context) {
    const db = getDb();
    const entitlements = resolveEntitlements(db, context.userId);
    const subscription = currentSubscription(db, context.userId);
    return { user: publicUser(context.auth.user), subscription: publicSubscription(subscription), entitlements, usage: usageFor(db, context.userId, entitlements) };
  }

  async function setupAdmin(req, res, body) {
    const db = getDb();
    if (Object.keys(db.adminUsers).length) throw fail(409, '管理员已经初始化');
    const configuredToken = String(process.env.ADMIN_SETUP_TOKEN || '');
    const suppliedToken = String(body.setupToken || req.headers['x-admin-setup-token'] || '');
    if (!configuredToken) throw fail(503, '服务器尚未配置 ADMIN_SETUP_TOKEN');
    if (!suppliedToken || !safeEqual(configuredToken, suppliedToken)) throw fail(403, '首次初始化口令错误');
    const email = normalizeEmail(body.email);
    const record = await passwordRecord(body.password);
    if (Object.keys(getDb().adminUsers).length) throw fail(409, '管理员已经初始化');
    const admin = { id: id('adm'), email, displayName: cleanText(body.displayName || '超级管理员', 50, '管理员名称', false), role: 'super_admin', active: true, ...record, createdAt: Date.now(), updatedAt: Date.now() };
    let session;
    transaction(current => {
      current.adminUsers[admin.id] = admin;
      session = createAdminSession(current, admin.id);
      audit(current, admin, 'admin.setup', 'admin', admin.id, { role: admin.role });
    });
    return send(res, 201, { admin: publicAdmin(admin), csrfToken: session.csrf }, { 'Set-Cookie': adminCookie(session.token) });
  }

  function findUser(body) {
    const db = getDb();
    if (body.userId && db.users[String(body.userId)]) return db.users[String(body.userId)];
    if (body.email) {
      const email = normalizeEmail(body.email);
      return Object.values(db.users).find(user => user && user.email === email) || null;
    }
    return null;
  }

  async function handleAdmin(req, res, route) {
    if (route === '/api/admin/status' && req.method === 'GET') {
      return send(res, 200, { configured: Object.keys(getDb().adminUsers).length > 0, setupRequiresToken: true });
    }
    if (route === '/api/admin/setup' && req.method === 'POST') return setupAdmin(req, res, await readBody(req));
    if (route === '/api/admin/login' && req.method === 'POST') {
      const body = await readBody(req);
      const email = normalizeEmail(body.email);
      enforceAdminRate(req, email);
      const admin = Object.values(getDb().adminUsers).find(item => item && item.email === email);
      if (ADMIN_SCRYPT_ACTIVE >= 4) throw fail(429, '管理员登录请求过多，请稍后再试');
      let passwordOk = false; ADMIN_SCRYPT_ACTIVE++;
      try { passwordOk = await verifyPassword(admin, body.password); } finally { ADMIN_SCRYPT_ACTIVE--; }
      if (!passwordOk || admin.active === false) throw fail(401, '管理员邮箱或密码错误');
      const currentAdmin = getDb().adminUsers[admin.id];
      if (!currentAdmin || currentAdmin.passwordHash !== admin.passwordHash) throw fail(409, '管理员信息已变化，请重试');
      let session;
      transaction(db => {
        admin.lastLoginAt = Date.now();
        session = createAdminSession(db, admin.id);
        audit(db, admin, 'admin.login', 'admin', admin.id);
      });
      clearAdminRate(req, email);
      return send(res, 200, { admin: publicAdmin(admin), csrfToken: session.csrf }, { 'Set-Cookie': adminCookie(session.token) });
    }
    if (route === '/api/admin/me' && req.method === 'GET') {
      const context = requireAdmin(req);
      return send(res, 200, { admin: publicAdmin(context.admin) });
    }
    if (route === '/api/admin/logout' && req.method === 'POST') {
      const body = await readBody(req); const context = requireAdmin(req); requireCsrf(req, body, context);
      transaction(db => { delete db.adminSessions[context.tokenKey]; audit(db, context.admin, 'admin.logout', 'admin', context.admin.id); });
      return send(res, 200, { ok: true }, { 'Set-Cookie': adminCookie('', true) });
    }
    if (route === '/api/admin/bootstrap' && req.method === 'GET') {
      const context = requireAdmin(req);
      const db = getDb();
      const canSeeAi = context.admin.role === 'super_admin' || context.admin.role === 'ai_operator' || context.admin.role === 'auditor';
      const canSeeBilling = context.admin.role === 'super_admin' || context.admin.role === 'billing_admin' || context.admin.role === 'support' || context.admin.role === 'auditor';
      return send(res, 200, {
        admin: publicAdmin(context.admin),
        stats: { users: Object.keys(db.users).length, activeSubscriptions: Object.values(db.subscriptions).filter(item => activeAt(item)).length, paymentsCents: Object.values(db.manualPayments).reduce((sum, item) => sum + (item.status === 'confirmed' ? Number(item.amountCents) || 0 : 0), 0), aiThisMonth: Object.values(db.aiUsageEvents).filter(item => item && item.month === monthKey() && item.status === 'succeeded').length },
        plans: canSeeBilling ? Object.values(db.plans).map(publicPlan) : [],
        subscriptions: canSeeBilling ? Object.values(db.subscriptions).slice(-100) : [],
        payments: canSeeBilling ? Object.values(db.manualPayments).slice(-100) : [],
        themes: Object.values(db.themeCatalog).map(publicTheme).sort((a, b) => a.sortOrder - b.sortOrder),
        aiProviders: canSeeAi ? Object.values(db.aiProviders).map(publicProvider) : [],
        aiRoutes: canSeeAi ? Object.values(db.aiRoutes).map(clone) : [],
        featureFlags: clone(db.featureFlags),
        auditLogs: context.admin.role === 'super_admin' || context.admin.role === 'auditor' ? db.auditLogs.slice(-200).reverse() : []
      });
    }
    if (route === '/api/admin/users/search' && req.method === 'POST') {
      const context = requireAdmin(req, ['billing_admin', 'support', 'auditor']);
      const body = await readBody(req); const query = cleanText(body.query, 254, '搜索内容').toLowerCase();
      const users = Object.values(getDb().users).filter(user => !query || user.email.includes(query) || String(user.displayName || '').toLowerCase().includes(query)).slice(0, 50).map(user => {
        const entitlements = resolveEntitlements(getDb(), user.id);
        return { ...publicUser(user), subscription: currentSubscription(getDb(), user.id), paid: !!(entitlements['theme.premium'] && entitlements['theme.premium'].enabled), usage: usageFor(getDb(), user.id, entitlements) };
      });
      return send(res, 200, { users });
    }
    if (route === '/api/admin/plans/upsert' && req.method === 'POST') {
      const body = await readBody(req); const context = requireAdmin(req, ['billing_admin']); requireCsrf(req, body, context); await requireConfirmation(context.admin, body.confirmPassword);
      const planId = validKey(body.id);
      if (planId === TRIAL_PLAN_ID) throw fail(403, '新用户体验是系统内部套餐，不能改为公开售卖套餐');
      const entitlements = {};
      for (const [feature, config] of Object.entries(body.entitlements || {})) {
        if (!ENTITLEMENT_KEYS.has(feature)) throw fail(400, `未知权益：${feature}`);
        const enabled = config === true || config.enabled === true;
        const monthlyQuota = config && config.monthlyQuota !== undefined && config.monthlyQuota !== null ? integer(config.monthlyQuota, 0, 1000000, '月额度') : null;
        entitlements[feature] = { enabled, ...(AI_FEATURES.has(feature) ? { monthlyQuota } : {}) };
      }
      let plan;
      transaction(db => {
        const existing = db.plans[planId]; const now = Date.now();
        plan = { id: planId, name: cleanText(body.name, 80, '套餐名称', false), description: cleanText(body.description, 500, '套餐说明'), active: body.active === true, priceCents: integer(body.priceCents, 0, 100000000, '价格（分）'), durationDays: integer(body.durationDays, 1, 3650, '有效天数'), entitlements, createdAt: existing ? existing.createdAt : now, updatedAt: now };
        db.plans[planId] = plan;
        audit(db, context.admin, existing ? 'plan.update' : 'plan.create', 'plan', planId, { active: plan.active, priceCents: plan.priceCents, durationDays: plan.durationDays, entitlementKeys: Object.keys(entitlements) });
      });
      return send(res, 200, { plan: publicPlan(plan) });
    }
    if (route === '/api/admin/billing/apply' && req.method === 'POST') {
      const body = await readBody(req); const context = requireAdmin(req, ['billing_admin']); requireCsrf(req, body, context); await requireConfirmation(context.admin, body.confirmPassword);
      const user = findUser(body); if (!user) throw fail(404, '用户不存在');
      const action = String(body.action || 'activate');
      if (!['activate', 'renew', 'gift', 'deactivate'].includes(action)) throw fail(400, '收费操作无效');
      let subscription = null; let payment = null;
      transaction(db => {
        const now = Date.now();
        if (action === 'deactivate') {
          for (const item of Object.values(db.subscriptions)) if (item && item.userId === user.id && activeAt(item, now)) { item.status = 'disabled'; item.disabledAt = now; item.updatedAt = now; }
          audit(db, context.admin, 'subscription.deactivate', 'user', user.id, { reason: cleanText(body.note, 500, '备注') });
          return;
        }
        const planId = validKey(body.planId); const plan = db.plans[planId];
        if (!plan) throw fail(404, '套餐不存在');
        if (plan.internal === true || planId === TRIAL_PLAN_ID) throw fail(400, '新用户体验套餐不能手动收费或重复赠送');
        let amountCents = body.amountCents === undefined ? 0 : integer(body.amountCents, 0, 100000000, '收款金额（分）');
        let channel = '';
        let reference = '';
        if (action === 'gift') {
          if (amountCents !== 0) throw fail(400, '赠送会员的金额必须为 0，且不会生成收费流水');
        } else {
          if (amountCents <= 0) throw fail(400, '开通或续费必须填写大于 0 的实收金额');
          channel = cleanText(body.channel, 50, '收款渠道', false);
          if (!PAID_BILLING_CHANNELS.has(channel)) throw fail(400, '请选择有效的收款渠道');
          if (!String(body.reference || '').trim()) throw fail(400, '开通或续费必须填写唯一付款参考号');
          reference = cleanText(body.reference, 100, '付款参考号', false);
          if (Object.values(db.manualPayments).some(item => item && item.reference === reference)) throw fail(409, '该付款参考号已经登记');
        }
        const durationDays = body.durationDays === undefined ? Number(plan.durationDays) : integer(body.durationDays, 1, 3650, '有效天数');
        const existing = currentSubscription(db, user.id, now);
        const startsAt = now;
        const base = action === 'renew' && existing && Number(existing.endsAt) > now ? Number(existing.endsAt) : now;
        const endsAt = base + durationDays * 86400000;
        subscription = { id: id('sub'), userId: user.id, planId, status: 'active', source: action === 'gift' ? 'gift' : 'manual', startsAt, endsAt, createdByAdminId: context.admin.id, note: cleanText(body.note, 500, '备注'), createdAt: now, updatedAt: now };
        db.subscriptions[subscription.id] = subscription;
        if (action !== 'gift') {
          payment = { id: id('pay'), userId: user.id, subscriptionId: subscription.id, planId, amountCents, currency: 'CNY', channel, reference, note: cleanText(body.note, 500, '备注'), status: 'confirmed', receivedAt: now, createdByAdminId: context.admin.id, createdAt: now };
          db.manualPayments[payment.id] = payment;
        }
        audit(db, context.admin, action === 'gift' ? 'subscription.gift' : `subscription.${action}`, 'user', user.id, { planId, subscriptionId: subscription.id, paymentId: payment && payment.id, amountCents: payment ? payment.amountCents : 0, endsAt });
      });
      return send(res, 200, { ok: true, user: publicUser(user), subscription, payment });
    }
    if (route === '/api/admin/entitlements/grant' && req.method === 'POST') {
      const body = await readBody(req); const context = requireAdmin(req, ['billing_admin']); requireCsrf(req, body, context); await requireConfirmation(context.admin, body.confirmPassword);
      const user = findUser(body); if (!user) throw fail(404, '用户不存在');
      const feature = String(body.feature || ''); if (!ENTITLEMENT_KEYS.has(feature)) throw fail(400, '权益键无效');
      const durationDays = body.durationDays === undefined || body.durationDays === null ? null : integer(body.durationDays, 1, 3650, '有效天数');
      const monthlyQuota = body.monthlyQuota === undefined || body.monthlyQuota === null ? null : integer(body.monthlyQuota, 0, 1000000, '月额度');
      let grant;
      transaction(db => {
        const now = Date.now(); grant = { id: id('grant'), userId: user.id, feature, enabled: body.enabled !== false, monthlyQuota, startsAt: now, endsAt: durationDays ? now + durationDays * 86400000 : null, source: body.source === 'compensation' ? 'compensation' : 'manual', note: cleanText(body.note, 500, '备注'), createdByAdminId: context.admin.id, createdAt: now, updatedAt: now };
        db.entitlementGrants[grant.id] = grant; audit(db, context.admin, 'entitlement.grant', 'user', user.id, { grantId: grant.id, feature, enabled: grant.enabled, monthlyQuota, endsAt: grant.endsAt });
      });
      return send(res, 200, { grant });
    }
    if (route === '/api/admin/themes/upsert' && req.method === 'POST') {
      const body = await readBody(req); const context = requireSuper(req); requireCsrf(req, body, context); await requireConfirmation(context.admin, body.confirmPassword);
      const themeId = validKey(body.id); let theme;
      transaction(db => {
        const existing = db.themeCatalog[themeId] || {}; const now = Date.now();
        const availableFrom = body.availableFrom ? Number(body.availableFrom) : null; const availableUntil = body.availableUntil ? Number(body.availableUntil) : null;
        if ((availableFrom !== null && !Number.isSafeInteger(availableFrom)) || (availableUntil !== null && !Number.isSafeInteger(availableUntil)) || (availableFrom && availableUntil && availableUntil <= availableFrom)) throw fail(400, '主题上架时间无效');
        theme = { id: themeId, name: cleanText(body.name, 80, '主题名称', false), description: cleanText(body.description, 300, '主题说明'), premium: body.premium !== false, requiredEntitlement: body.premium === false ? '' : 'theme.premium', enabled: body.enabled !== false, sortOrder: body.sortOrder === undefined ? (existing.sortOrder || 0) : integer(body.sortOrder, -10000, 10000, '主题排序'), availableFrom, availableUntil, createdAt: existing.createdAt || now, updatedAt: now };
        db.themeCatalog[themeId] = theme; audit(db, context.admin, existing.id ? 'theme.update' : 'theme.create', 'theme', themeId, { enabled: theme.enabled, premium: theme.premium, sortOrder: theme.sortOrder, availableFrom, availableUntil });
      });
      return send(res, 200, { theme: publicTheme(theme) });
    }
    if (route === '/api/admin/ai/providers/upsert' && req.method === 'POST') {
      const body = await readBody(req); const context = requireAdmin(req, ['ai_operator']); requireCsrf(req, body, context); await requireConfirmation(context.admin, body.confirmPassword);
      const providerId = validKey(body.id); let provider;
      transaction(db => {
        const existing = db.aiProviders[providerId] || {}; const now = Date.now();
        const capabilities = Array.isArray(body.capabilities) ? [...new Set(body.capabilities.map(String).filter(item => AI_CAPABILITIES.has(item)))] : (existing.capabilities || []);
        if (!capabilities.length) throw fail(400, '至少选择一种 AI 能力');
        const apiKey = String(body.apiKey || '');
        provider = { id: providerId, name: cleanText(body.name, 80, '服务商名称', false), baseUrl: normalizeProviderUrl(body.baseUrl), enabled: body.enabled !== false, capabilities, timeoutMs: body.timeoutMs === undefined ? (existing.timeoutMs || 90000) : integer(body.timeoutMs, 5000, 180000, '超时'), inputPerMillionCents: body.inputPerMillionCents === undefined ? (existing.inputPerMillionCents || 0) : integer(body.inputPerMillionCents, 0, 100000000, '输入成本'), outputPerMillionCents: body.outputPerMillionCents === undefined ? (existing.outputPerMillionCents || 0) : integer(body.outputPerMillionCents, 0, 100000000, '输出成本'), apiKeyEncrypted: apiKey ? encryptSecret(apiKey) : existing.apiKeyEncrypted, keyLast4: apiKey ? apiKey.slice(-4) : existing.keyLast4, createdAt: existing.createdAt || now, updatedAt: now };
        if (!provider.apiKeyEncrypted) throw fail(400, '首次配置服务商必须填写 API Key');
        db.aiProviders[providerId] = provider;
        audit(db, context.admin, existing.id ? 'ai.provider.update' : 'ai.provider.create', 'aiProvider', providerId, { baseHost: new URL(provider.baseUrl).hostname, enabled: provider.enabled, capabilities });
      });
      return send(res, 200, { provider: publicProvider(provider) });
    }
    if (route === '/api/admin/ai/routes/upsert' && req.method === 'POST') {
      const body = await readBody(req); const context = requireAdmin(req, ['ai_operator']); requireCsrf(req, body, context); await requireConfirmation(context.admin, body.confirmPassword);
      const capability = String(body.capability || ''); if (!AI_CAPABILITIES.has(capability)) throw fail(400, 'AI 能力无效');
      const providerId = validKey(body.providerId); if (!getDb().aiProviders[providerId]) throw fail(404, 'AI 服务商不存在');
      let routeConfig;
      transaction(db => {
        routeConfig = { capability, providerId, model: cleanText(body.model, 160, '模型名', false), enabled: body.enabled !== false, maxOutputTokens: body.maxOutputTokens === undefined ? 1200 : integer(body.maxOutputTokens, 1, 32000, '最大输出 Token'), updatedAt: Date.now() };
        db.aiRoutes[capability] = routeConfig;
        audit(db, context.admin, 'ai.route.update', 'aiRoute', capability, { providerId, model: routeConfig.model, enabled: routeConfig.enabled });
      });
      return send(res, 200, { route: routeConfig });
    }
    if (route === '/api/admin/feature-flags/set' && req.method === 'POST') {
      const body = await readBody(req); const context = requireSuper(req); requireCsrf(req, body, context); await requireConfirmation(context.admin, body.confirmPassword);
      const key = validKey(body.key),note = cleanText(body.note, 240, '变更原因'); let flag;
      transaction(db => { flag = { key, enabled: body.enabled === true, public: body.public !== false, value: body.value === undefined ? null : clone(body.value), updatedAt: Date.now(), updatedByAdminId: context.admin.id }; db.featureFlags[key] = flag; audit(db, context.admin, 'featureFlag.set', 'featureFlag', key, { enabled: flag.enabled, public: flag.public, note }); });
      return send(res, 200, { flag });
    }
    if (route === '/api/admin/admins/create' && req.method === 'POST') {
      const body = await readBody(req); const context = requireSuper(req); requireCsrf(req, body, context); await requireConfirmation(context.admin, body.confirmPassword);
      const email = normalizeEmail(body.email); const role = String(body.role || ''); if (!ADMIN_ROLES.has(role)) throw fail(400, '管理员角色无效');
      if (Object.values(getDb().adminUsers).some(item => item && item.email === email)) throw fail(409, '管理员邮箱已存在');
      const pass = await passwordRecord(body.password); let admin;
      transaction(db => { admin = { id: id('adm'), email, displayName: cleanText(body.displayName, 50, '管理员名称', false), role, active: true, ...pass, createdAt: Date.now(), updatedAt: Date.now() }; db.adminUsers[admin.id] = admin; audit(db, context.admin, 'admin.create', 'admin', admin.id, { role }); });
      return send(res, 201, { admin: publicAdmin(admin) });
    }
    return false;
  }

  function configuredAiRoute(capability) {
    const db = getDb(); const route = db.aiRoutes[capability] || (capability === 'text' ? db.aiRoutes.vision : null); const provider = route && db.aiProviders[route.providerId];
    const supported = provider && Array.isArray(provider.capabilities) && (provider.capabilities.includes(capability) || (capability === 'text' && provider.capabilities.includes('vision')));
    if (!route || route.enabled === false || !provider || provider.enabled === false || !supported || !provider.apiKeyEncrypted) return null;
    try { decryptSecret(provider.apiKeyEncrypted); } catch (_) { return null; }
    return { route, provider };
  }
  function reserveUsage(userId, feature, capability, requestId, inputBytes) {
    const db = getDb();
    if (db.featureFlags.paid_ai && db.featureFlags.paid_ai.enabled === false) throw fail(503, '平台 AI 正在维护，请稍后再试');
    const requestIdHash = hash(`${userId}\0${requestId}`); const existing = db.aiUsageEvents[requestIdHash];
    if (existing) return { duplicate: existing };
    const entitlements = resolveEntitlements(db, userId); const entitlement = entitlements[feature];
    if (!entitlement || !entitlement.enabled) throw fail(402, '此 AI 功能需要开通会员');
    const usage = usageFor(db, userId, entitlements); if (usage[feature].remaining !== null && usage[feature].remaining <= 0) throw fail(429, '本月 AI 额度已用完');
    const config = configuredAiRoute(capability); if (!config) throw fail(503, 'AI 服务暂未配置');
    const event = { id: id('usage'), requestIdHash, userId, feature, capability, providerId: config.provider.id, model: config.route.model, month: monthKey(), status: 'reserved', inputBytes: Math.max(0, Number(inputBytes) || 0), createdAt: Date.now(), updatedAt: Date.now() };
    transaction(current => { if (current.aiUsageEvents[requestIdHash]) throw fail(409, '该请求正在处理'); current.aiUsageEvents[requestIdHash] = event; });
    return { event, ...config };
  }
  function finishUsage(requestIdHash, status, extra) {
    transaction(db => { const event = db.aiUsageEvents[requestIdHash]; if (event) Object.assign(event, extra || {}, { status, updatedAt: Date.now() }); });
  }
  function usageMetadata(text, provider) {
    let data = null; try { data = JSON.parse(text); } catch (_) {}
    const usage = data && data.usage || {};
    const inputTokens = Number(usage.input_tokens || usage.prompt_tokens) || 0;
    const outputTokens = Number(usage.output_tokens || usage.completion_tokens) || 0;
    const costCents = Math.ceil(inputTokens * (Number(provider.inputPerMillionCents) || 0) / 1000000 + outputTokens * (Number(provider.outputPerMillionCents) || 0) / 1000000);
    return { inputTokens, outputTokens, costCents };
  }
  function duplicateResponse(res, event) {
    return send(res, event.status === 'failed' ? 409 : 200, { duplicate: true, status: event.status, usageId: event.id, message: event.status === 'succeeded' ? '该请求已经成功处理，为保护账单内容不在服务端缓存原始结果' : '该请求已经存在' });
  }

  async function handleUser(req, res, route) {
    if (['/api/bootstrap', '/api/entitlements', '/api/subscription', '/api/usage', '/api/ai/status'].includes(route) && req.method === 'POST') {
      const body = await readBody(req); const context = userContext(req, body); const payload = userPayload(context); const db = getDb();
      if (route === '/api/bootstrap') {
        const now = Date.now(),premiumThemesEnabled=!db.featureFlags.premium_themes||db.featureFlags.premium_themes.enabled !== false; const themes = Object.values(db.themeCatalog).filter(theme => theme.enabled !== false && (premiumThemesEnabled || !theme.premium) && (!theme.availableFrom || Number(theme.availableFrom) <= now) && (!theme.availableUntil || Number(theme.availableUntil) > now)).map(publicTheme).sort((a, b) => a.sortOrder - b.sortOrder);
        return send(res, 200, { ...payload, paid: !!(payload.entitlements['theme.premium'] && payload.entitlements['theme.premium'].enabled), plans: Object.values(db.plans).filter(plan => plan.active).map(publicPlan), themes, featureFlags: Object.fromEntries(Object.values(db.featureFlags).filter(flag => flag && flag.public).map(flag => [flag.key, { enabled: !!flag.enabled, value: flag.value === undefined ? null : flag.value }])) });
      }
      if (route === '/api/entitlements') return send(res, 200, { entitlements: payload.entitlements, subscription: payload.subscription });
      if (route === '/api/subscription') return send(res, 200, { subscription: payload.subscription, history: Object.values(db.subscriptions).filter(item => item && item.userId === context.userId).sort((a, b) => Number(b.createdAt) - Number(a.createdAt)).map(publicSubscription) });
      if (route === '/api/usage') return send(res, 200, { month: monthKey(), usage: payload.usage, limits: Object.fromEntries(Object.entries(payload.entitlements).filter(([key]) => AI_FEATURES.has(key)).map(([key, value]) => [key, value.monthlyQuota])) });
      const vision = configuredAiRoute('vision'); const stt = configuredAiRoute('stt'); const writing = configuredAiRoute('text'); const enabled = !db.featureFlags.paid_ai || db.featureFlags.paid_ai.enabled !== false;
      return send(res, 200, { online: enabled && !!(vision || stt || writing), maintenance: !enabled, capabilities: { vision: { configured: !!vision, online: enabled && !!vision }, stt: { configured: !!stt, online: enabled && !!stt }, writing: { configured: !!writing, online: enabled && !!writing } }, entitlements: payload.entitlements, usage: payload.usage, checkedAt: Date.now() });
    }
    if (route === '/api/models' && req.method === 'POST' && !allowPrivateUpstream) {
      const body = await readBody(req); userContext(req, body);
      return send(res, 200, { models: Object.values(getDb().aiRoutes).filter(item => item && item.enabled !== false).map(item => item.model).filter(Boolean), routes: Object.values(getDb().aiRoutes).filter(item => item && item.enabled !== false).map(item => ({ capability: item.capability, model: item.model })) });
    }
    if (route === '/api/vision' && req.method === 'POST' && !allowPrivateUpstream) {
      const body = await readBody(req); const context = userContext(req, body);
      const requestId = validKey(body.requestId, 160); const feature = body.capability === 'ai.batch_receipt' ? 'ai.batch_receipt' : 'ai.receipt';
      const normalizedImage = normalizeVisionImage(body.image);
      const reservation = reserveUsage(context.userId, feature, 'vision', requestId, normalizedImage.bytes);
      if (reservation.duplicate) return duplicateResponse(res, reservation.duplicate);
      const started = Date.now(); const eventKey = reservation.event.requestIdHash;
      try {
        const apiKey = decryptSecret(reservation.provider.apiKeyEncrypted); const target = endpointUrl(reservation.provider.baseUrl, 'vision'); const useResponses = /\/responses$/.test(new URL(target).pathname);
        const payload = JSON.stringify(platformVisionRequest(normalizedImage.image, useResponses, reservation.route.model, reservation.route.maxOutputTokens || 1200));
        const upstream = await requestUpstream(target, { method: 'POST', headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }, body: payload, timeout: reservation.provider.timeoutMs || 90000 });
        if (upstream.status >= 300) { finishUsage(eventKey, 'failed', { upstreamStatus: upstream.status, latencyMs: Date.now() - started, errorCode: 'upstream_error' }); return send(res, 502, { error: 'AI 服务暂时不可用', status: upstream.status }); }
        finishUsage(eventKey, 'succeeded', { upstreamStatus: upstream.status, latencyMs: Date.now() - started, ...usageMetadata(upstream.text, reservation.provider) });
        try { return send(res, 200, JSON.parse(upstream.text)); } catch (_) { return send(res, 200, { text: upstream.text }); }
      } catch (error) {
        finishUsage(eventKey, 'failed', { latencyMs: Date.now() - started, errorCode: error.statusCode ? 'configuration_error' : 'network_error' });
        throw error;
      }
    }
    if (route === '/api/write' && req.method === 'POST' && !allowPrivateUpstream) {
      const body = await readBody(req); const context = userContext(req, body); const requestId = validKey(body.requestId, 160); const input = normalizeWritingInput(body);
      const reservation = reserveUsage(context.userId, 'ai.writing', 'text', requestId, Buffer.byteLength(input.content));
      if (reservation.duplicate) return duplicateResponse(res, reservation.duplicate);
      const started = Date.now(); const eventKey = reservation.event.requestIdHash;
      try {
        const apiKey = decryptSecret(reservation.provider.apiKeyEncrypted); const target = endpointUrl(reservation.provider.baseUrl, 'vision'); const useResponses = /\/responses$/.test(new URL(target).pathname);
        const payload = JSON.stringify(platformWritingRequest(input.task, input.content, useResponses, reservation.route.model, Math.min(2400, reservation.route.maxOutputTokens || 1200)));
        const upstream = await requestUpstream(target, { method: 'POST', headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }, body: payload, timeout: reservation.provider.timeoutMs || 90000 });
        if (upstream.status >= 300) { finishUsage(eventKey, 'failed', { upstreamStatus: upstream.status, latencyMs: Date.now() - started, errorCode: 'upstream_error' }); return send(res, 502, { error: 'AI 写作服务暂时不可用', status: upstream.status }); }
        const text = extractWritingText(upstream.text); if (!text) { finishUsage(eventKey, 'failed', { upstreamStatus: upstream.status, latencyMs: Date.now() - started, errorCode: 'empty_output' }); return send(res, 502, { error: 'AI 没有返回可用文字' }); }
        finishUsage(eventKey, 'succeeded', { upstreamStatus: upstream.status, latencyMs: Date.now() - started, ...usageMetadata(upstream.text, reservation.provider) });
        return send(res, 200, { text: text.slice(0, 16000), task: input.task, usageId: reservation.event.id });
      } catch (error) { finishUsage(eventKey, 'failed', { latencyMs: Date.now() - started, errorCode: error.statusCode ? 'configuration_error' : 'network_error' }); throw error; }
    }
    if (route === '/api/stt' && req.method === 'POST' && !allowPrivateUpstream) {
      const ct = req.headers['content-type'] || ''; const boundaryM = ct.match(/boundary=(?:"([^"]+)"|([^;]+))/i); if (!boundaryM) throw fail(400, '缺少上传边界');
      const raw = await readLimited(req, maxAudioBody); const parts = parseMultipart(raw, (boundaryM[1] || boundaryM[2]).trim()); const field = name => { const part = parts.find(item => item.name === name); return part ? part.body.toString('utf8').trim() : ''; }; const filePart = parts.find(item => item.name === 'file');
      const body = { deviceId: field('deviceId'), deviceToken: field('deviceToken'), sessionToken: field('sessionToken') }; const context = userContext(req, body); const requestId = validKey(field('requestId'), 160); if (!filePart || !filePart.body.length) throw fail(400, '缺少音频文件');
      const reservation = reserveUsage(context.userId, 'ai.voice', 'stt', requestId, filePart.body.length); if (reservation.duplicate) return duplicateResponse(res, reservation.duplicate);
      const started = Date.now(); const eventKey = reservation.event.requestIdHash;
      try {
        const apiKey = decryptSecret(reservation.provider.apiKeyEncrypted); const target = endpointUrl(reservation.provider.baseUrl, 'stt'); const built = buildMultipart([{ name: 'file', filename: filePart.filename || 'audio.webm', contentType: filePart.contentType || 'application/octet-stream', body: filePart.body }, { name: 'model', body: Buffer.from(reservation.route.model) }]);
        const upstream = await requestUpstream(target, { method: 'POST', headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'multipart/form-data; boundary=' + built.boundary, 'Content-Length': built.body.length }, body: built.body, timeout: reservation.provider.timeoutMs || 90000 });
        if (upstream.status >= 300) { finishUsage(eventKey, 'failed', { upstreamStatus: upstream.status, latencyMs: Date.now() - started, errorCode: 'upstream_error' }); return send(res, 502, { error: '语音服务暂时不可用', status: upstream.status }); }
        finishUsage(eventKey, 'succeeded', { upstreamStatus: upstream.status, latencyMs: Date.now() - started, ...usageMetadata(upstream.text, reservation.provider) });
        try { return send(res, 200, JSON.parse(upstream.text)); } catch (_) { return send(res, 200, { text: upstream.text }); }
      } catch (error) { finishUsage(eventKey, 'failed', { latencyMs: Date.now() - started, errorCode: error.statusCode ? 'configuration_error' : 'network_error' }); throw error; }
    }
    return false;
  }

  async function handle(req, res, route) {
    if (route.startsWith('/api/admin/')) return handleAdmin(req, res, route);
    return handleUser(req, res, route);
  }

  return {
    handle,
    resolveEntitlements: userId => resolveEntitlements(getDb(), userId),
    claimRegistrationTrial: (user, email, now) => claimRegistrationTrial(getDb(), user, email, now),
    publicProvider
  };
}

module.exports = { createPaidAdminModule, ensureDb, resolveEntitlements, usageFor, claimRegistrationTrial, encryptSecret, decryptSecret };
