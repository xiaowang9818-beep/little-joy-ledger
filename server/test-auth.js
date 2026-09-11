const assert = require('assert');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { once } = require('events');

const testData = path.join(__dirname, `test-auth-data-${process.pid}.json`);
process.env.PORT = '0';
process.env.DATA_FILE = testData;
process.env.TRUST_PROXY = '1';

const { server, authClientKey } = require('./sync-server.js');

function request(port, route, body) {
  return new Promise((resolve, reject) => {
    const data = Buffer.from(JSON.stringify(body || {}));
    const req = http.request({
      hostname: '127.0.0.1', port, path: route, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': data.length }
    }, res => {
      let text = '';
      res.on('data', chunk => text += chunk);
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(text); } catch (_) {}
        resolve({ status: res.statusCode, body: parsed, text });
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function withTwoWriteFailures(action) {
  const originalWriteFileSync = fs.writeFileSync;
  let remaining = 2;
  fs.writeFileSync = function injectedWriteFailure(...args) {
    if (remaining-- > 0) throw new Error('injected persistence failure');
    return originalWriteFileSync.apply(this, args);
  };
  try { return await action(); }
  finally { fs.writeFileSync = originalWriteFileSync; }
}

async function main() {
  assert.equal(authClientKey({ socket: { remoteAddress: '127.0.0.1' }, headers: { 'x-real-ip': '203.0.113.10' } }), '203.0.113.10');
  assert.equal(authClientKey({ socket: { remoteAddress: '127.0.0.1' }, headers: { 'x-forwarded-for': '203.0.113.11, 10.0.0.1' } }), '203.0.113.11');
  assert.equal(authClientKey({ socket: { remoteAddress: '198.51.100.20' }, headers: { 'x-real-ip': '203.0.113.12' } }), '198.51.100.20', 'forwarded headers are ignored unless the direct peer is loopback');
  if (!server.listening) await once(server, 'listening');
  const port = server.address().port;
  const deviceA = { deviceId: 'dev_auth_user_A_01', deviceToken: 'a'.repeat(64) };
  const deviceA2 = { deviceId: 'dev_auth_user_A_02', deviceToken: 'b'.repeat(64) };
  const deviceB = { deviceId: 'dev_auth_user_B_01', deviceToken: 'c'.repeat(64) };
  const deviceC = { deviceId: 'dev_auth_user_C_01', deviceToken: 'd'.repeat(64) };
  const passwordA = 'AccountA123!';
  const passwordA2 = 'AccountA456!';
  const passwordB = 'AccountB123!';
  const passwordC = 'AccountC123!';

  let r = await request(port, '/api/auth/register', { ...deviceA, email: 'bad-email', password: passwordA, displayName: 'A' });
  assert.equal(r.status, 400, 'invalid email must be rejected');

  const atomicTrialDevice = { deviceId: 'dev_auth_trial_atomic_01', deviceToken: 'v'.repeat(64) };
  r = await request(port, '/api/sync', { ...atomicTrialDevice, state: {} });
  assert.equal(r.status, 200, 'pre-existing guest device is needed to isolate the final registration commit');
  const beforeFailedTrial = JSON.parse(fs.readFileSync(testData, 'utf8'));
  r = await withTwoWriteFailures(() => request(port, '/api/auth/register', {
    ...atomicTrialDevice,
    email: 'atomic-trial@example.com',
    password: 'AtomicTrial123!',
    displayName: 'Atomic trial'
  }));
  assert.equal(r.status, 503, 'registration must fail if its account and trial cannot be durably committed');
  const afterFailedTrial = JSON.parse(fs.readFileSync(testData, 'utf8'));
  assert.equal(Object.keys(afterFailedTrial.users).length, Object.keys(beforeFailedTrial.users).length, 'failed registration leaves no user');
  assert.equal(Object.keys(afterFailedTrial.subscriptions).length, Object.keys(beforeFailedTrial.subscriptions).length, 'failed registration leaves no trial subscription');
  assert.equal(Object.keys(afterFailedTrial.trialClaims).length, Object.keys(beforeFailedTrial.trialClaims).length, 'failed registration does not consume the one-time trial');
  r = await request(port, '/api/auth/register', {
    ...atomicTrialDevice,
    email: 'atomic-trial@example.com',
    password: 'AtomicTrial123!',
    displayName: 'Atomic trial'
  });
  assert.equal(r.status, 201, 'the same email can claim its first trial after a failed atomic commit');
  r = await request(port, '/api/bootstrap', { ...atomicTrialDevice, sessionToken: r.body.sessionToken });
  assert.equal(r.status, 200);
  assert.equal(r.body.subscription.source, 'trial');
  assert.equal(r.body.entitlements['ai.receipt'].monthlyQuota, 3);

  const concurrent = await Promise.all([
    request(port, '/api/auth/register', { deviceId: 'dev_auth_race_001', deviceToken: 'r'.repeat(64), email: 'race@example.com', password: 'RacePass123!', displayName: 'Race 1' }),
    request(port, '/api/auth/register', { deviceId: 'dev_auth_race_002', deviceToken: 's'.repeat(64), email: 'RACE@example.com', password: 'RacePass123!', displayName: 'Race 2' })
  ]);
  assert.deepEqual(concurrent.map(item => item.status).sort(), [201, 409], 'concurrent registration must create only one normalized email account');

  r = await request(port, '/api/auth/register', { ...deviceA, email: 'UserA@example.com', password: passwordA, displayName: '小 A', avatar: '🍓' });
  assert.equal(r.status, 201);
  let sessionA = r.body.sessionToken;
  assert(sessionA && sessionA.length >= 32);
  assert.equal(r.body.user.email, 'usera@example.com');
  assert.equal(r.body.user.displayName, '小 A');
  assert.equal(r.body.user.avatar, '🍓');
  assert(!JSON.stringify(r.body.user).includes('passwordHash'), 'password hash must never be returned');

  r = await request(port, '/api/auth/register', { ...deviceA2, email: 'USERA@example.com', password: passwordA, displayName: 'duplicate' });
  assert.equal(r.status, 409, 'normalized duplicate email must be rejected');

  r = await request(port, '/api/auth/me', { ...deviceA, sessionToken: sessionA });
  assert.equal(r.status, 200);
  assert.equal(r.body.user.displayName, '小 A');

  const unknownDevice = { deviceId: 'dev_auth_unknown_01', deviceToken: 'u'.repeat(64) };
  r = await request(port, '/api/auth/me', unknownDevice);
  assert.equal(r.status, 401);
  const persistedAfterRejectedMe = JSON.parse(fs.readFileSync(testData, 'utf8'));
  assert(!persistedAfterRejectedMe.devices[unknownDevice.deviceId], 'rejected protected request must not create a device row');

  r = await request(port, '/api/auth/login', { ...deviceA2, email: 'usera@example.com', password: 'WrongPass123!' });
  assert.equal(r.status, 401);
  r = await request(port, '/api/auth/login', { ...deviceA2, email: 'usera@example.com', password: passwordA });
  assert.equal(r.status, 200);
  const sessionA2 = r.body.sessionToken;

  const now = Date.now();
  const ledgerA = { id: 'lg_auth_A', name: 'A 的账本', owner: deviceA.deviceId, members: [deviceA.deviceId], updatedAt: now };
  const privateLedgerA = { id: 'lg_auth_A_private', name: 'A private', owner: deviceA.deviceId, members: [deviceA.deviceId], updatedAt: now + 1 };
  const txA = { id: 'tx_auth_A', ledger: ledgerA.id, owner: deviceA.deviceId, amount: 88, type: 'out', photo: 'data:image/png;base64,ACCOUNTSECRET', remark: 'deleted account secret', updatedAt: now + 1 };
  const planA = { id: 'plan_auth_A', owner: deviceA.deviceId, private: true, title: 'A 的私人计划', date: '2026-08-14', updatedAt: now + 2 };
  const goalA = { id: 'goal_auth_A', owner: deviceA.deviceId, private: true, title: 'A 的买房目标', kind: 'money', targetValue: 1000000, currentValue: 10000, dueDate: '2026-12-31', updatedAt: now + 2 };
  const inspirationA = { id: 'idea_auth_A', owner: deviceA.deviceId, private: true, content: 'A 的项目灵感', tags: ['项目'], updatedAt: now + 2 };
  const diaryA = { id: 'diary_auth_A', owner: deviceA.deviceId, private: true, date: '2026-08-22', content: 'A 的私人日记', updatedAt: now + 2 };
  const focusA = { id: 'focus_auth_A', owner: deviceA.deviceId, private: true, task: 'A 的专注任务', durationMinutes: 25, date: '2026-08-22', updatedAt: now + 2 };
  r = await request(port, '/api/sync', { ...deviceA, sessionToken: sessionA, state: { ledgers: [ledgerA, privateLedgerA], transactions: [txA], personalPlans: [planA], goals: [goalA], inspirations: [inspirationA], diaries: [diaryA], focusSessions: [focusA] } });
  assert.equal(r.status, 200);
  assert(r.body.state.transactions.some(item => item.id === txA.id));
  const sensitiveTx = { id: 'tx_auth_deleted_sensitive', ledger: ledgerA.id, owner: deviceA.deviceId, amount: 9, type: 'out', photo: 'data:image/png;base64,SECRET', remark: 'private-note', updatedAt: now + 3 };
  r = await request(port, '/api/sync', { ...deviceA, sessionToken: sessionA, state: { transactions: [sensitiveTx] } });
  r = await request(port, '/api/sync', { ...deviceA, sessionToken: sessionA, state: { transactions: [{ ...sensitiveTx, deleted: true, deletedAt: now + 4, updatedAt: now + 4 }] } });
  const deletedSensitive = r.body.state.transactions.find(item => item.id === sensitiveTx.id);
  assert(deletedSensitive && deletedSensitive.deleted, 'deleted record must remain as a tombstone');
  assert(!('photo' in deletedSensitive) && !('remark' in deletedSensitive) && !('amount' in deletedSensitive), 'tombstone must not retain sensitive business data');

  r = await request(port, '/api/sync', { ...deviceA2, sessionToken: sessionA2, state: {} });
  assert.equal(r.status, 200);
  assert(r.body.state.ledgers.some(item => item.id === ledgerA.id), 'same account on a second device must see its ledger');
  assert(r.body.state.personalPlans.some(item => item.id === planA.id), 'same account must see its private plan');
  assert(r.body.state.goals.some(item => item.id === goalA.id), 'same account must see its private goal');
  assert(r.body.state.inspirations.some(item => item.id === inspirationA.id), 'same account must see its private inspiration');
  assert(r.body.state.diaries.some(item => item.id === diaryA.id), 'same account must see its private diary');
  assert(r.body.state.focusSessions.some(item => item.id === focusA.id), 'same account must see its private focus session');

  r = await request(port, '/api/auth/register', { ...deviceB, email: 'userb@example.com', password: passwordB, displayName: '小 B' });
  assert.equal(r.status, 201);
  const sessionB = r.body.sessionToken;
  r = await request(port, '/api/sync', { ...deviceB, sessionToken: sessionB, state: {} });
  assert.equal(r.status, 200);
  assert(!r.body.state.ledgers.some(item => item.id === ledgerA.id), 'another account must not see A ledger');
  assert(!r.body.state.personalPlans.some(item => item.id === planA.id), 'another account must not see A private plan');
  assert(!r.body.state.goals.some(item => item.id === goalA.id), 'another account must not see A private goal');
  assert(!r.body.state.inspirations.some(item => item.id === inspirationA.id), 'another account must not see A private inspiration');
  assert(!r.body.state.diaries.some(item => item.id === diaryA.id), 'another account must not see A private diary');
  assert(!r.body.state.focusSessions.some(item => item.id === focusA.id), 'another account must not see A private focus session');

  const rollbackRecord = { id: 'tx_auth_should_rollback', owner: deviceB.deviceId, amount: 1, type: 'out', updatedAt: Date.now() + 10 };
  const forbiddenRecord = { id: 'tx_auth_forbidden', ledger: privateLedgerA.id, owner: deviceB.deviceId, amount: 2, type: 'out', updatedAt: Date.now() + 11 };
  r = await request(port, '/api/sync', { ...deviceB, sessionToken: sessionB, state: { transactions: [rollbackRecord, forbiddenRecord] } });
  assert.equal(r.status, 403);
  r = await request(port, '/api/sync', { ...deviceB, sessionToken: sessionB, state: {} });
  assert(!r.body.state.transactions.some(item => item.id === rollbackRecord.id), 'failed sync must roll back records merged before the rejected record');

  const persistenceFailureRecord = { id: 'tx_auth_persist_failure', owner: deviceB.deviceId, amount: 3, type: 'out', updatedAt: Date.now() + 12 };
  r = await withTwoWriteFailures(() => request(port, '/api/sync', { ...deviceB, sessionToken: sessionB, state: { transactions: [persistenceFailureRecord] } }));
  assert.equal(r.status, 503, 'sync must not report success when both persistence writes fail');
  r = await request(port, '/api/sync', { ...deviceB, sessionToken: sessionB, state: {} });
  assert(!r.body.state.transactions.some(item => item.id === persistenceFailureRecord.id), 'failed persistence must restore pre-sync in-memory state');

  r = await request(port, '/api/auth/profile', { ...deviceA, sessionToken: sessionA, displayName: 'A 新昵称', bio: '只属于 A 的资料' });
  assert.equal(r.status, 200);
  assert.equal(r.body.user.displayName, 'A 新昵称');
  assert.equal(r.body.user.bio, '只属于 A 的资料');
  r = await request(port, '/api/auth/profile', { ...deviceA, sessionToken: sessionA, displayName: '不应保存的昵称', timezone: '<invalid>' });
  assert.equal(r.status, 400);
  r = await request(port, '/api/auth/me', { ...deviceA, sessionToken: sessionA });
  assert.equal(r.body.user.displayName, 'A 新昵称', 'a rejected profile update must be atomic');

  r = await request(port, '/api/auth/export', { ...deviceA, sessionToken: sessionA });
  assert.equal(r.status, 200);
  assert.equal(r.body.user.email, 'usera@example.com');
  assert(r.body.state.transactions.some(item => item.id === txA.id));
  assert(!JSON.stringify(r.body).includes('passwordHash'));

  r = await request(port, '/api/share/create', { ...deviceA, sessionToken: sessionA, ledgerId: ledgerA.id });
  assert.equal(r.status, 200);
  assert(!r.body.ledger.members.includes(deviceA.deviceId), 'account sharing must not retain a guest-capable device member');
  const shareCode = r.body.code;
  r = await request(port, '/api/share/leave', { ...deviceA, sessionToken: sessionA, ledgerId: ledgerA.id });
  assert.equal(r.status, 409, 'ledger owner cannot leave their own shared ledger');
  r = await request(port, '/api/share/join', { ...deviceB, sessionToken: sessionB, code: shareCode });
  assert.equal(r.status, 200);
  assert(!r.body.ledger.members.includes(deviceB.deviceId), 'account join must replace the device member with user identity');

  r = await request(port, '/api/auth/register', { ...deviceC, email: 'userc@example.com', password: passwordC, displayName: 'User C' });
  assert.equal(r.status, 201);
  const sessionC = r.body.sessionToken;
  r = await request(port, '/api/share/join', { ...deviceC, sessionToken: sessionC, code: shareCode });
  assert.equal(r.status, 200);
  const txC = { id: 'tx_auth_C_shared', ledger: ledgerA.id, owner: deviceC.deviceId, amount: 66, photo: 'data:image/png;base64,CSECRET', remark: 'C secret', updatedAt: Date.now() + 15 };
  r = await request(port, '/api/sync', { ...deviceC, sessionToken: sessionC, state: { transactions: [txC] } });
  assert.equal(r.status, 200);
  r = await withTwoWriteFailures(() => request(port, '/api/auth/delete', { ...deviceC, sessionToken: sessionC, password: passwordC }));
  assert.equal(r.status, 503, 'account deletion must not report success when persistence fails');
  r = await request(port, '/api/auth/me', { ...deviceC, sessionToken: sessionC });
  assert.equal(r.status, 200, 'failed account deletion must restore the user and session in memory');
  r = await request(port, '/api/auth/delete', { ...deviceC, sessionToken: sessionC, password: passwordC });
  assert.equal(r.status, 200);
  r = await request(port, '/api/sync', { ...deviceA, sessionToken: sessionA, state: { transactions: [txC] } });
  const deletedMemberTombstone = r.body.state.transactions.find(item => item.id === txC.id);
  assert(deletedMemberTombstone && deletedMemberTombstone.deleted, 'owner cache must not revive a record after a shared member deletes their account');
  assert(!('photo' in deletedMemberTombstone) && !('remark' in deletedMemberTombstone), 'deleted member record must be a minimal tombstone');

  const goneLedger = { id: 'lg_auth_deleted_shared', name: 'Deleted shared', owner: deviceA.deviceId, members: [deviceA.deviceId], updatedAt: Date.now() + 20 };
  const goneTx = { id: 'tx_auth_deleted_shared', ledger: goneLedger.id, owner: deviceA.deviceId, amount: 55, photo: 'data:image/png;base64,SECRET', remark: 'must disappear', updatedAt: Date.now() + 21 };
  r = await request(port, '/api/sync', { ...deviceA, sessionToken: sessionA, state: { ledgers: [goneLedger], transactions: [goneTx] } });
  assert.equal(r.status, 200);
  r = await request(port, '/api/share/create', { ...deviceA, sessionToken: sessionA, ledgerId: goneLedger.id });
  const goneShareCode = r.body.code;
  r = await request(port, '/api/share/join', { ...deviceB, sessionToken: sessionB, code: goneShareCode });
  assert.equal(r.status, 200);
  const goneMemberTx = { id: 'tx_auth_deleted_shared_member', ledger: goneLedger.id, owner: deviceB.deviceId, amount: 7, photo: 'data:image/png;base64,MEMBERSECRET', remark: 'member secret', updatedAt: Date.now() + 22 };
  r = await request(port, '/api/sync', { ...deviceB, sessionToken: sessionB, state: { transactions: [goneMemberTx] } });
  assert.equal(r.status, 200);
  const targetLedger = { id: 'lg_auth_move_target', name: 'Move target', owner: deviceA.deviceId, members: [deviceA.deviceId], updatedAt: Date.now() + 30 };
  const movedGoneTx = { ...goneTx, ledger: targetLedger.id, updatedAt: Date.now() + 31 };
  const deletedGoneLedger = { ...goneLedger, deleted: true, updatedAt: Date.now() + 32, deletedAt: Date.now() + 32 };
  r = await request(port, '/api/sync', { ...deviceA, sessionToken: sessionA, state: { ledgers: [targetLedger, deletedGoneLedger], transactions: [movedGoneTx] } });
  assert.equal(r.status, 200);
  const staleNewTx = { id: 'tx_auth_after_ledger_delete', ledger: goneLedger.id, owner: deviceB.deviceId, amount: 1, updatedAt: Date.now() + 40 };
  r = await request(port, '/api/sync', { ...deviceB, sessionToken: sessionB, state: { transactions: [goneMemberTx, staleNewTx] } });
  assert.equal(r.status, 200, 'stale member sync against a deleted ledger must not fail');
  const goneLedgerTombstone = r.body.state.ledgers.find(item => item.id === goneLedger.id);
  const goneTxTombstone = r.body.state.transactions.find(item => item.id === goneMemberTx.id);
  assert(goneLedgerTombstone && goneLedgerTombstone.deleted && goneLedgerTombstone.shared && goneLedgerTombstone.members.length, 'all shared members must receive the ledger tombstone');
  assert(goneTxTombstone && goneTxTombstone.deleted && !('photo' in goneTxTombstone) && !('remark' in goneTxTombstone), 'deleting a ledger must cascade minimal child tombstones');
  assert(!r.body.state.transactions.some(item => item.id === staleNewTx.id), 'writes into a deleted ledger must be ignored');
  r = await request(port, '/api/sync', { ...deviceA, sessionToken: sessionA, state: {} });
  const movedRecord = r.body.state.transactions.find(item => item.id === goneTx.id);
  assert(movedRecord && !movedRecord.deleted && movedRecord.ledger === targetLedger.id, 'record moved in the same sync must survive source ledger deletion');

  const txB = { id: 'tx_auth_B_shared', ledger: ledgerA.id, owner: deviceB.deviceId, amount: 12, type: 'in', updatedAt: Date.now() };
  r = await request(port, '/api/sync', { ...deviceB, sessionToken: sessionB, state: { transactions: [txB] } });
  assert.equal(r.status, 200);
  assert(r.body.state.transactions.some(item => item.id === txA.id), 'shared member must see ledger records');
  assert(!r.body.state.personalPlans.some(item => item.id === planA.id), 'sharing a ledger must not expose private plans');
  assert(!r.body.state.goals.some(item => item.id === goalA.id), 'sharing a ledger must not expose private goals');

  const strippedLedgerTx = { ...txA, ledger: '', amount: 99, updatedAt: Date.now() + 100 };
  r = await request(port, '/api/sync', { ...deviceB, sessionToken: sessionB, state: { transactions: [strippedLedgerTx] } });
  assert.equal(r.status, 200);
  assert.equal(r.body.state.transactions.find(item => item.id === txA.id).ledger, ledgerA.id, 'a shared member cannot detach an existing record from its ledger');

  r = await request(port, '/api/share/leave', { ...deviceB, sessionToken: sessionB, ledgerId: ledgerA.id });
  assert.equal(r.status, 200);
  r = await request(port, '/api/sync', { ...deviceB, sessionToken: sessionB, state: {} });
  assert(!r.body.state.ledgers.some(item => item.id === ledgerA.id), 'member must lose access immediately after leaving');
  r = await request(port, '/api/share/join', { ...deviceB, sessionToken: sessionB, code: shareCode });
  assert.equal(r.status, 200, 'member can join again with a valid share code');

  r = await request(port, '/api/auth/logout', { ...deviceA, sessionToken: sessionA });
  assert.equal(r.status, 200);
  r = await request(port, '/api/sync', { ...deviceA, state: {} });
  assert.equal(r.status, 200);
  assert(!r.body.state.ledgers.some(item => item.id === ledgerA.id), 'logged-out guest must not inherit account shared access through deviceId');
  r = await request(port, '/api/auth/login', { ...deviceA, email: 'usera@example.com', password: passwordA });
  assert.equal(r.status, 200);
  sessionA = r.body.sessionToken;

  r = await request(port, '/api/auth/password', { ...deviceA, sessionToken: sessionA, currentPassword: passwordA, newPassword: passwordA2 });
  assert.equal(r.status, 200);
  const sessionAfterPassword = r.body.sessionToken;
  assert(sessionAfterPassword);
  r = await request(port, '/api/auth/me', { ...deviceA2, sessionToken: sessionA2 });
  assert.equal(r.status, 401, 'password change must revoke other sessions');
  r = await request(port, '/api/auth/login', { ...deviceA2, email: 'usera@example.com', password: passwordA });
  assert.equal(r.status, 401, 'old password must stop working');
  r = await request(port, '/api/auth/login', { ...deviceA2, email: 'usera@example.com', password: passwordA2 });
  assert.equal(r.status, 200);

  r = await request(port, '/api/auth/delete', { ...deviceA, sessionToken: sessionAfterPassword, password: passwordA2 });
  assert.equal(r.status, 200);
  r = await request(port, '/api/auth/me', { ...deviceA, sessionToken: sessionAfterPassword });
  assert.equal(r.status, 401, 'deleted account sessions must be revoked');
  r = await request(port, '/api/sync', { ...deviceA, state: {} });
  assert.equal(r.status, 401, 'a deleted account device must not resurrect old data as a guest');

  // Collaborator keeps the shared ledger and their own record after A deletes the account.
  r = await request(port, '/api/sync', { ...deviceB, sessionToken: sessionB, state: { transactions: [strippedLedgerTx] } });
  assert.equal(r.status, 200);
  assert(r.body.state.ledgers.some(item => item.id === ledgerA.id), 'shared ledger must survive owner account deletion');
  assert(r.body.state.transactions.some(item => item.id === txB.id), 'collaborator data must survive owner account deletion');
  const deletedAccountTombstone = r.body.state.transactions.find(item => item.id === txA.id);
  assert(deletedAccountTombstone && deletedAccountTombstone.deleted, 'stale collaborator cache must not revive a deleted account record');
  assert(!('photo' in deletedAccountTombstone) && !('remark' in deletedAccountTombstone) && !('amount' in deletedAccountTombstone), 'deleted account tombstone must not retain sensitive fields');

  console.log('AUTH_TESTS_OK');
}

main().catch(error => {
  console.error(error.stack || error);
  process.exitCode = 1;
}).finally(async () => {
  if (server.listening) await new Promise(resolve => server.close(resolve));
  try { fs.unlinkSync(testData); } catch (_) {}
  try { fs.unlinkSync(testData + '.tmp'); } catch (_) {}
});
