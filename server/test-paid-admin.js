const assert = require('assert');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { once } = require('events');

const testData = path.join(__dirname, `test-paid-admin-data-${process.pid}.json`);
process.env.PORT = '0';
process.env.DATA_FILE = testData;
process.env.AI_KEY_ENCRYPTION_KEY = '11'.repeat(32);
process.env.ADMIN_SETUP_TOKEN = 'setup-token-' + '7'.repeat(40);

const { server } = require('./sync-server.js');
const { ensureDb, resolveEntitlements, usageFor } = require('./paid-admin.js');

function request(port, route, body, options = {}) {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? null : Buffer.from(JSON.stringify(body));
    const headers = { ...(options.headers || {}) };
    if (data) Object.assign(headers, { 'Content-Type': 'application/json', 'Content-Length': data.length });
    const req = http.request({ hostname: '127.0.0.1', port, path: route, method: options.method || 'POST', headers }, res => {
      let text = '';
      res.on('data', chunk => text += chunk);
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(text); } catch (_) {}
        resolve({ status: res.statusCode, body: parsed, text, headers: res.headers });
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  const legacyMonthly = { id: 'premium_monthly', name: '已售旧套餐', active: true, priceCents: 7777, durationDays: 45, entitlements: {} };
  const customizedSeed = { id: 'member_month_1290', name: '运营自定义月卡', active: true, priceCents: 888, durationDays: 31, entitlements: {} };
  const compatibilityDb = { plans: { premium_monthly: { ...legacyMonthly }, member_month_1290: { ...customizedSeed } } };
  ensureDb(compatibilityDb);
  assert.deepEqual(compatibilityDb.plans.premium_monthly, legacyMonthly, 'legacy or already-sold plans must never be overwritten');
  assert.deepEqual(compatibilityDb.plans.member_month_1290, customizedSeed, 'an operator-customized seeded plan must not be overwritten on restart');

  const quotaDb = { plans: {}, subscriptions: {}, entitlementGrants: {}, aiUsageEvents: {} };
  ensureDb(quotaDb);
  const quotaUserId = 'usr_trial_cross_month';
  const trialStartsAt = Date.UTC(2026, 0, 31, 12, 0, 0);
  const trialEndsAt = trialStartsAt + 3 * 86400000;
  const trialSubscription = { id: 'sub_trial_cross_month', userId: quotaUserId, planId: 'trial_new_user_3d', status: 'active', source: 'trial', startsAt: trialStartsAt, endsAt: trialEndsAt, createdAt: trialStartsAt, updatedAt: trialStartsAt };
  quotaDb.subscriptions[trialSubscription.id] = trialSubscription;
  const addUsage = (id, feature, createdAt) => { quotaDb.aiUsageEvents[id] = { id, userId: quotaUserId, feature, month: new Date(createdAt).toISOString().slice(0, 7), status: 'succeeded', createdAt, updatedAt: createdAt }; };
  addUsage('usage_trial_january', 'ai.receipt', trialStartsAt + 3600000);
  addUsage('usage_trial_february_1', 'ai.receipt', Date.UTC(2026, 1, 1, 9));
  addUsage('usage_trial_february_2', 'ai.receipt', Date.UTC(2026, 1, 2, 9));
  const trialNow = Date.UTC(2026, 1, 2, 12);
  let quotaEntitlements = resolveEntitlements(quotaDb, quotaUserId, trialNow);
  let quotaUsage = usageFor(quotaDb, quotaUserId, quotaEntitlements, '2026-02', trialNow);
  assert.equal(quotaUsage['ai.receipt'].period, 'trial');
  assert.equal(quotaUsage['ai.receipt'].used, 3, 'trial usage must aggregate the whole three-day window across a natural month boundary');
  assert.equal(quotaUsage['ai.receipt'].remaining, 0, 'cross-month trial usage must not reset the 3-call allowance');
  quotaDb.subscriptions.sub_paid_after_trial = { id: 'sub_paid_after_trial', userId: quotaUserId, planId: 'member_month_1290', status: 'active', source: 'manual', startsAt: Date.UTC(2026, 1, 1), endsAt: Date.UTC(2026, 2, 3), createdAt: Date.UTC(2026, 1, 1), updatedAt: Date.UTC(2026, 1, 1) };
  quotaEntitlements = resolveEntitlements(quotaDb, quotaUserId, trialNow);
  quotaUsage = usageFor(quotaDb, quotaUserId, quotaEntitlements, '2026-02', trialNow);
  assert.equal(quotaUsage['ai.receipt'].period, 'month', 'an active paid entitlement switches usage back to a calendar-month period');
  assert.equal(quotaUsage['ai.receipt'].used, 2, 'paid monthly usage excludes the prior-month trial call');
  assert.equal(quotaUsage['ai.receipt'].remaining, 58);

  if (!server.listening) await once(server, 'listening');
  const port = server.address().port;
  const device = { deviceId: 'dev_paid_admin_test_01', deviceToken: 'p'.repeat(64) };
  const userPassword = 'UserPaid123!';
  const adminPassword = 'AdminSecure123!';
  const apiSecret = 'sk-platform-secret-never-plaintext';

  let r = await request(port, '/api/auth/register', { ...device, email: 'paid-user@example.com', password: userPassword, displayName: '付费测试用户' });
  assert.equal(r.status, 201);
  const sessionToken = r.body.sessionToken;
  const userId = r.body.user.id;
  const userAuth = { ...device, sessionToken };

  r = await request(port, '/api/bootstrap', userAuth);
  assert.equal(r.status, 200);
  assert.equal(r.body.entitlements['theme.premium'].enabled, true, 'first registration receives the three-day theme trial');
  assert.equal(r.body.entitlements['ai.receipt'].enabled, true, 'first registration receives a small AI trial');
  assert.equal(r.body.entitlements['ai.receipt'].monthlyQuota, 3);
  assert.equal(r.body.entitlements['ai.batch_receipt'].monthlyQuota, 1);
  assert.equal(r.body.entitlements['ai.voice'].monthlyQuota, 3);
  assert.equal(r.body.entitlements['ai.writing'].monthlyQuota, 5);
  assert.equal(r.body.subscription.source, 'trial');
  assert.equal(r.body.subscription.isTrial, true);
  assert.equal(r.body.subscription.label, '新用户 3 天会员体验');
  assert(r.body.subscription.endsAt - r.body.subscription.startsAt === 3 * 86400000, 'trial must last exactly three days');
  assert.equal(r.body.entitlements['cloud.sync'].enabled, true, 'registered users keep free cloud sync');
  assert.equal(r.body.themes.filter(theme => theme.premium).length, 14, 'fourteen premium themes must be catalogued');
  assert.deepEqual(
    r.body.plans.map(item => [item.id, item.priceCents, item.durationDays]).sort(),
    [
      ['member_month_1290', 1290, 30],
      ['member_quarter_3590', 3590, 90],
      ['member_year_11800', 11800, 365]
    ],
    'bootstrap must expose only the three recommended sale plans'
  );
  for (const salePlan of r.body.plans) {
    assert.equal(salePlan.entitlements['theme.premium'].enabled, true);
    assert.equal(salePlan.entitlements['ai.receipt'].monthlyQuota, 60);
    assert.equal(salePlan.entitlements['ai.batch_receipt'].monthlyQuota, 20);
    assert.equal(salePlan.entitlements['ai.voice'].monthlyQuota, 60);
    assert.equal(salePlan.entitlements['ai.writing'].monthlyQuota, 40);
  }
  for (const themeId of ['premium-zodiac-golden-dragon', 'premium-zodiac-jade-rabbit', 'premium-dunhuang-flying-apsara', 'premium-blue-white-porcelain']) {
    const theme = r.body.themes.find(item => item.id === themeId);
    assert(theme && theme.premium && theme.requiredEntitlement === 'theme.premium', `${themeId} must remain member-only`);
  }

  r = await request(port, '/api/subscription', userAuth);
  assert.equal(r.status, 200);
  assert.equal(r.body.history.length, 1);
  assert.equal(r.body.history[0].source, 'trial');
  assert.equal(r.body.history[0].isTrial, true, 'subscription history clearly identifies the trial');

  r = await request(port, '/api/admin/setup', { email: 'owner@example.com', displayName: 'Owner', password: adminPassword });
  assert.equal(r.status, 403, 'first administrator setup always requires the one-time setup token');
  r = await request(port, '/api/admin/setup', { email: 'owner@example.com', displayName: 'Owner', password: adminPassword, setupToken: process.env.ADMIN_SETUP_TOKEN });
  assert.equal(r.status, 201);
  assert.equal(r.body.admin.role, 'super_admin');
  assert(r.body.csrfToken && r.body.csrfToken.length > 20);
  assert(!JSON.stringify(r.body).includes('passwordHash'));
  const setCookie = r.headers['set-cookie'][0];
  assert(/HttpOnly/i.test(setCookie) && /SameSite=Strict/i.test(setCookie), 'admin session cookie must be HttpOnly and strict');
  const cookie = setCookie.split(';')[0];
  const csrfToken = r.body.csrfToken;
  const adminHeaders = { Cookie: cookie, 'X-CSRF-Token': csrfToken };

  r = await request(port, '/api/admin/setup', { email: 'second@example.com', password: adminPassword });
  assert.equal(r.status, 409, 'first-admin setup is one-time only');

  r = await request(port, '/api/admin/bootstrap', undefined, { method: 'GET', headers: { Cookie: cookie } });
  assert.equal(r.status, 200);
  assert.equal(r.body.stats.users, 1);
  assert.equal(r.body.themes.length, 14);
  assert.equal(r.body.plans.find(item => item.id === 'trial_new_user_3d').internal, true, 'admin bootstrap must identify the internal trial plan');

  const firstTrialDevice = { deviceId: 'dev_trial_reclaim_01', deviceToken: 't'.repeat(64) };
  const secondTrialDevice = { deviceId: 'dev_trial_reclaim_02', deviceToken: 'u'.repeat(64) };
  const reclaimPassword = 'TrialReuse123!';
  r = await request(port, '/api/auth/register', { ...firstTrialDevice, email: 'trial-reuse@example.com', password: reclaimPassword, displayName: 'Trial first' });
  assert.equal(r.status, 201);
  const firstTrialSession = r.body.sessionToken;
  r = await request(port, '/api/auth/delete', { ...firstTrialDevice, sessionToken: firstTrialSession, password: reclaimPassword });
  assert.equal(r.status, 200);
  const claimsAfterDelete = Object.keys(JSON.parse(fs.readFileSync(testData, 'utf8')).trialClaims).length;
  r = await request(port, '/api/auth/register', { ...secondTrialDevice, email: 'TRIAL-REUSE@example.com', password: reclaimPassword, displayName: 'Trial second' });
  assert.equal(r.status, 201);
  const secondTrialAuth = { ...secondTrialDevice, sessionToken: r.body.sessionToken };
  r = await request(port, '/api/bootstrap', secondTrialAuth);
  assert.equal(r.status, 200);
  assert.equal(r.body.subscription, null, 'deleting and re-registering the same normalized email cannot claim another trial');
  assert.equal(r.body.entitlements['theme.premium'].enabled, false);
  assert.equal(Object.keys(JSON.parse(fs.readFileSync(testData, 'utf8')).trialClaims).length, claimsAfterDelete, 'trial claim survives account deletion without duplication');

  const plan = {
    id: 'premium_test', name: '测试会员', description: 'test', active: true, priceCents: 990, durationDays: 30,
    entitlements: {
      'theme.premium': { enabled: true },
      'ai.receipt': { enabled: true, monthlyQuota: 5 },
      'ai.batch_receipt': { enabled: true, monthlyQuota: 1 },
      'ai.voice': { enabled: true, monthlyQuota: 3 },
      'ai.writing': { enabled: true, monthlyQuota: 4 }
    }
  };
  r = await request(port, '/api/admin/plans/upsert', { ...plan, confirmPassword: adminPassword }, { headers: { Cookie: cookie } });
  assert.equal(r.status, 403, 'admin writes require CSRF');
  r = await request(port, '/api/admin/plans/upsert', { ...plan, csrfToken, confirmPassword: 'WrongAdmin123!' }, { headers: { Cookie: cookie } });
  assert.equal(r.status, 401, 'critical writes require a second password confirmation');
  r = await request(port, '/api/admin/plans/upsert', { ...plan, confirmPassword: adminPassword }, { headers: adminHeaders });
  assert.equal(r.status, 200);
  assert.equal(r.body.plan.priceCents, 990);
  r = await request(port, '/api/admin/plans/upsert', { ...plan, id: 'trial_new_user_3d', confirmPassword: adminPassword }, { headers: adminHeaders });
  assert.equal(r.status, 403, 'the internal trial plan cannot be converted into a public sale plan');
  r = await request(port, '/api/admin/billing/apply', { userId, planId: 'trial_new_user_3d', action: 'gift', confirmPassword: adminPassword }, { headers: adminHeaders });
  assert.equal(r.status, 400, 'administrators cannot manually issue repeat trial subscriptions');

  r = await request(port, '/api/admin/ai/providers/upsert', {
    id: 'openai_main', name: '主视觉线路', baseUrl: 'https://api.openai.com/v1', apiKey: apiSecret,
    capabilities: ['vision', 'stt', 'text'], enabled: true, confirmPassword: adminPassword
  }, { headers: adminHeaders });
  assert.equal(r.status, 200);
  assert.equal(r.body.provider.keyLast4, apiSecret.slice(-4));
  assert.equal(r.body.provider.keyConfigured, true);
  assert(!JSON.stringify(r.body).includes(apiSecret) && !JSON.stringify(r.body).includes('apiKeyEncrypted'), 'provider response must not expose secrets');

  r = await request(port, '/api/admin/ai/providers/upsert', {
    id: 'bad_host', name: 'Bad', baseUrl: 'https://127.0.0.1/v1', apiKey: 'secret', capabilities: ['vision'], confirmPassword: adminPassword
  }, { headers: adminHeaders });
  assert.equal(r.status, 403, 'provider host must be allowlisted');

  r = await request(port, '/api/admin/ai/routes/upsert', { capability: 'vision', providerId: 'openai_main', model: 'gpt-4o-mini', enabled: true, confirmPassword: adminPassword }, { headers: adminHeaders });
  assert.equal(r.status, 200);
  r = await request(port, '/api/admin/ai/routes/upsert', { capability: 'stt', providerId: 'openai_main', model: 'whisper-1', enabled: true, confirmPassword: adminPassword }, { headers: adminHeaders });
  assert.equal(r.status, 200);
  r = await request(port, '/api/admin/ai/routes/upsert', { capability: 'text', providerId: 'openai_main', model: 'gpt-4o-mini', enabled: true, confirmPassword: adminPassword }, { headers: adminHeaders });
  assert.equal(r.status, 200);

  const beforeInvalidBilling = JSON.parse(fs.readFileSync(testData, 'utf8'));
  r = await request(port, '/api/admin/billing/apply', { userId, planId: plan.id, action: 'activate', amountCents: 9.9, channel: 'offline', confirmPassword: adminPassword }, { headers: adminHeaders });
  assert.equal(r.status, 400, 'money is accepted only as integer cents');
  r = await request(port, '/api/admin/billing/apply', { userId, planId: plan.id, action: 'activate', amountCents: 0, channel: 'offline', reference: 'ORDER-ZERO-001', confirmPassword: adminPassword }, { headers: adminHeaders });
  assert.equal(r.status, 400, 'activate cannot record a zero-amount payment');
  assert.equal(r.body.error, '开通或续费必须填写大于 0 的实收金额');
  r = await request(port, '/api/admin/billing/apply', { userId, planId: plan.id, action: 'renew', amountCents: 990, channel: 'offline', reference: '', confirmPassword: adminPassword }, { headers: adminHeaders });
  assert.equal(r.status, 400, 'renew requires a non-empty payment reference');
  assert.equal(r.body.error, '开通或续费必须填写唯一付款参考号');
  r = await request(port, '/api/admin/billing/apply', { userId, planId: plan.id, action: 'activate', amountCents: 990, channel: 'gift', reference: 'ORDER-BAD-CHANNEL-001', confirmPassword: adminPassword }, { headers: adminHeaders });
  assert.equal(r.status, 400, 'charged actions accept only real payment channels');
  assert.equal(r.body.error, '请选择有效的收款渠道');
  r = await request(port, '/api/admin/billing/apply', { userId, planId: plan.id, action: 'gift', amountCents: 1, note: 'invalid paid gift', confirmPassword: adminPassword }, { headers: adminHeaders });
  assert.equal(r.status, 400, 'gift cannot carry a positive payment amount');
  assert.equal(r.body.error, '赠送会员的金额必须为 0，且不会生成收费流水');
  const afterInvalidBilling = JSON.parse(fs.readFileSync(testData, 'utf8'));
  assert.equal(Object.keys(afterInvalidBilling.subscriptions).length, Object.keys(beforeInvalidBilling.subscriptions).length, 'failed billing must roll back');
  assert.equal(Object.keys(afterInvalidBilling.manualPayments).length, Object.keys(beforeInvalidBilling.manualPayments).length, 'invalid billing must not create payment records');

  r = await request(port, '/api/admin/billing/apply', { userId, planId: plan.id, action: 'gift', amountCents: 0, note: 'member gift', confirmPassword: adminPassword }, { headers: adminHeaders });
  assert.equal(r.status, 200);
  assert.equal(r.body.subscription.source, 'gift');
  assert.equal(r.body.payment, null, 'a zero-amount gift creates no manual payment record');
  assert.equal(Object.keys(JSON.parse(fs.readFileSync(testData, 'utf8')).manualPayments).length, Object.keys(beforeInvalidBilling.manualPayments).length);

  r = await request(port, '/api/admin/billing/apply', { userId, planId: plan.id, action: 'activate', amountCents: 990, channel: 'offline', reference: 'ORDER-PAID-001', note: '线下收款', confirmPassword: adminPassword }, { headers: adminHeaders });
  assert.equal(r.status, 200);
  assert.equal(r.body.payment.amountCents, 990);
  assert.equal(r.body.subscription.userId, userId);

  const concurrentBilling = await Promise.all([
    request(port, '/api/admin/billing/apply', { userId, planId: plan.id, action: 'renew', amountCents: 990, channel: 'offline', reference: 'ORDER-CONCURRENT-001', confirmPassword: adminPassword }, { headers: adminHeaders }),
    request(port, '/api/admin/billing/apply', { userId, planId: plan.id, action: 'renew', amountCents: 990, channel: 'offline', reference: 'ORDER-CONCURRENT-001', confirmPassword: adminPassword }, { headers: adminHeaders })
  ]);
  assert.deepEqual(concurrentBilling.map(item => item.status).sort(), [200, 409], 'concurrent duplicate payment references must commit exactly once');
  const concurrentPersisted = JSON.parse(fs.readFileSync(testData, 'utf8'));
  assert.equal(Object.values(concurrentPersisted.manualPayments).filter(item => item.reference === 'ORDER-CONCURRENT-001').length, 1);

  r = await request(port, '/api/bootstrap', userAuth);
  assert.equal(r.status, 200);
  assert.equal(r.body.entitlements['theme.premium'].enabled, true);
  assert.equal(r.body.entitlements['ai.receipt'].monthlyQuota, 5);
  assert.equal(r.body.usage['ai.receipt'].remaining, 5);
  assert.equal(r.body.entitlements['ai.writing'].monthlyQuota, 5, 'active trial and paid sources use the larger writing quota');

  r = await request(port, '/api/ai/status', userAuth);
  assert.equal(r.status, 200);
  assert.equal(r.body.online, true);
  assert.equal(r.body.capabilities.vision.configured, true);
  assert.equal(r.body.capabilities.writing.configured, true);
  assert(!JSON.stringify(r.body).includes(apiSecret));

  r = await request(port, '/api/admin/feature-flags/set', { key: 'premium_themes', enabled: false, public: true, note: 'maintenance test', confirmPassword: adminPassword }, { headers: adminHeaders });
  assert.equal(r.status, 200);
  r = await request(port, '/api/bootstrap', userAuth);
  assert.equal(r.status, 200);
  assert.equal(r.body.themes.filter(theme => theme.premium).length, 0, 'disabled premium theme catalogue must not be delivered');
  r = await request(port, '/api/admin/feature-flags/set', { key: 'paid_ai', enabled: false, public: true, note: 'maintenance test', confirmPassword: adminPassword }, { headers: adminHeaders });
  assert.equal(r.status, 200);
  r = await request(port, '/api/ai/status', userAuth);
  assert.equal(r.status, 200);
  assert.equal(r.body.online, false);
  assert.equal(r.body.maintenance, true);
  r = await request(port, '/api/vision', { ...userAuth, requestId: 'maintenance_vision_01', capability: 'ai.receipt', image: 'data:image/jpeg;base64,/9j/2Q==' });
  assert.equal(r.status, 503, 'AI feature flag must stop requests before contacting an upstream model');
  r = await request(port, '/api/write', { ...userAuth, requestId: 'maintenance_write_01', task: 'diary', content: '今天完成了项目开发。' });
  assert.equal(r.status, 503, 'AI feature flag must stop writing requests before contacting an upstream model');
  r = await request(port, '/api/admin/feature-flags/set', { key: 'premium_themes', enabled: true, public: true, note: 'restore after test', confirmPassword: adminPassword }, { headers: adminHeaders });
  assert.equal(r.status, 200);
  r = await request(port, '/api/admin/feature-flags/set', { key: 'paid_ai', enabled: true, public: true, note: 'restore after test', confirmPassword: adminPassword }, { headers: adminHeaders });
  assert.equal(r.status, 200);

  r = await request(port, '/api/models', { ...userAuth, apiKey: 'malicious-client-key', baseUrl: 'https://evil.example/v1' });
  assert.equal(r.status, 200);
  assert(r.body.models.includes('gpt-4o-mini'));
  assert(!JSON.stringify(r.body).includes('malicious-client-key'), 'client AI configuration is ignored');

  r = await request(port, '/api/admin/billing/apply', { userId, action: 'deactivate', note: 'test', confirmPassword: adminPassword }, { headers: adminHeaders });
  assert.equal(r.status, 200);
  r = await request(port, '/api/entitlements', userAuth);
  assert.equal(r.status, 200);
  assert.equal(r.body.entitlements['theme.premium'].enabled, false);

  r = await request(port, '/api/admin/entitlements/grant', { userId, feature: 'theme.premium', enabled: true, durationDays: 7, source: 'compensation', confirmPassword: adminPassword }, { headers: adminHeaders });
  assert.equal(r.status, 200);
  r = await request(port, '/api/entitlements', userAuth);
  assert.equal(r.body.entitlements['theme.premium'].enabled, true, 'manual entitlement grants take effect');

  r = await request(port, '/api/admin/admins/create', { email: 'audit@example.com', displayName: 'Auditor', role: 'auditor', password: 'AuditSecure123!', confirmPassword: adminPassword }, { headers: adminHeaders });
  assert.equal(r.status, 201);
  r = await request(port, '/api/admin/login', { email: 'audit@example.com', password: 'AuditSecure123!' });
  assert.equal(r.status, 200);
  const auditorCookie = r.headers['set-cookie'][0].split(';')[0];
  r = await request(port, '/api/admin/plans/upsert', { ...plan, confirmPassword: 'AuditSecure123!', csrfToken: r.body.csrfToken }, { headers: { Cookie: auditorCookie } });
  assert.equal(r.status, 403, 'auditors cannot change plans');

  const persisted = JSON.parse(fs.readFileSync(testData, 'utf8'));
  for (const key of ['plans', 'subscriptions', 'entitlementGrants', 'manualPayments', 'themeCatalog', 'aiProviders', 'aiRoutes', 'aiUsageEvents', 'auditLogs', 'adminUsers', 'adminSessions', 'featureFlags', 'trialClaims']) assert(Object.prototype.hasOwnProperty.call(persisted, key), `missing compatible table ${key}`);
  assert(Object.values(persisted.trialClaims).every(item => !Object.prototype.hasOwnProperty.call(item, 'email')), 'trial claims store only normalized-email hashes');
  const persistedText = JSON.stringify(persisted);
  assert(!persistedText.includes(apiSecret), 'plaintext platform API key must never be stored');
  assert(!persistedText.includes(adminPassword), 'plaintext admin password must never be stored');
  assert(persisted.auditLogs.length >= 8, 'critical admin mutations must be audited');

  await new Promise(resolve => server.close(resolve));
  try { fs.unlinkSync(testData); } catch (_) {}
  try { fs.unlinkSync(testData + '.tmp'); } catch (_) {}
  console.log('PAID_ADMIN_TESTS_OK');
}

main().catch(async error => {
  console.error(error);
  if (server.listening) await new Promise(resolve => server.close(resolve));
  try { fs.unlinkSync(testData); } catch (_) {}
  process.exitCode = 1;
});
