const assert = require('assert');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { once } = require('events');

const testData = path.join(__dirname, `test-data-${process.pid}.json`);
process.env.PORT = '0';
process.env.DATA_FILE = testData;
process.env.ALLOW_PRIVATE_UPSTREAM = '1';
process.env.NODE_ENV = 'test';
process.env.HOST = '127.0.0.1';

const { server, endpointUrl, isPrivateAddress } = require('./sync-server.js');

function request(port, route, body, method = 'POST') {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? null : Buffer.from(JSON.stringify(body));
    const req = http.request({
      hostname: '127.0.0.1', port, path: route, method,
      headers: data ? { 'Content-Type': 'application/json', 'Content-Length': data.length } : {}
    }, res => {
      let text = '';
      res.on('data', c => text += c);
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(text); } catch (_) {}
        resolve({ status: res.statusCode, body: parsed, text });
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  if (!server.listening) await once(server, 'listening');
  const port = server.address().port;
  const now = Date.now();
  const deviceA = 'dev_regression_A';
  const deviceB = 'dev_regression_B';
  const tokenA = 'a'.repeat(64);
  const tokenB = 'b'.repeat(64);
  const authA = extra => ({ deviceId: deviceA, deviceToken: tokenA, ...extra });
  const authB = extra => ({ deviceId: deviceB, deviceToken: tokenB, ...extra });
  const ledgerA = { id: 'lg_regression_A', name: 'A', owner: deviceA, members: [deviceA], shared: false, updatedAt: now };
  const ledgerB = { id: 'lg_regression_B', name: 'B', owner: deviceB, members: [deviceB], shared: false, updatedAt: now };

  let r = await request(port, '/health', undefined, 'GET');
  assert.equal(r.status, 200);

  r = await request(port, '/api/sync', authA({ state: { ledgers: [ledgerA], transactions: [], escrows: [], usages: [], debts: [] } }));
  assert.equal(r.status, 200);
  r = await request(port, '/api/sync', { deviceId: deviceA, deviceToken: 'x'.repeat(64), state: {} });
  assert.equal(r.status, 403, '错误设备凭证必须被拒绝');

  r = await request(port, '/api/sync', authB({ state: { ledgers: [ledgerB], transactions: [], escrows: [], usages: [], debts: [] } }));
  assert.equal(r.status, 200);
  r = await request(port, '/api/share/create', authB({ ledgerId: ledgerA.id }));
  assert.equal(r.status, 403, '非所有者不能共享别人的账本');

  const tx = { id: 'tx_regression', ledger: ledgerA.id, owner: deviceA, amount: 1, type: 'out', date: '2026-08-13', updatedAt: now + 10 };
  r = await request(port, '/api/sync', authA({ state: { ledgers: [ledgerA], transactions: [tx], escrows: [], usages: [], debts: [] } }));
  assert.equal(r.status, 200);
  r = await request(port, '/api/sync', authA({ state: { ledgers: [ledgerA], transactions: [{ ...tx, deleted: true, deletedAt: now + 20, updatedAt: now + 20 }], escrows: [], usages: [], debts: [] } }));
  assert.equal(r.status, 200);
  assert(r.body.state.transactions.find(x => x.id === tx.id).deleted, '删除墓碑必须保留');
  r = await request(port, '/api/sync', authA({ state: { ledgers: [], transactions: [], escrows: [], usages: [], debts: [] } }));
  assert(r.body.state.transactions.find(x => x.id === tx.id).deleted, '后续同步不能复活已删除记录');

  const escrow = { id: 'esc_regression', ledger: ledgerA.id, owner: deviceA, totalAmount: 10, updatedAt: now + 30 };
  await request(port, '/api/sync', authA({ state: { ledgers: [ledgerA], transactions: [], escrows: [escrow], usages: [], debts: [] } }));
  r = await request(port, '/api/sync', authA({ state: { ledgers: [ledgerA], transactions: [], escrows: [{ ...escrow, totalAmount: 20, updatedAt: now + 40 }], usages: [], debts: [] } }));
  assert.equal(r.body.state.escrows.find(x => x.id === escrow.id).totalAmount, 20, '较新的修改必须覆盖服务器旧值');

  const account = { id: 'ac_regression', ledger: ledgerA.id, owner: deviceA, name: '现金', openingBalance: 100, updatedAt: now + 50 };
  const budget = { id: 'bu_regression', ledger: ledgerA.id, owner: deviceA, month: '2026-08', category: '__all__', amount: 1000, updatedAt: now + 51 };
  const recurring = { id: 'rr_regression', ledger: ledgerA.id, owner: deviceA, name: '房租', amount: 1800, nextDate: '2026-09-01', updatedAt: now + 52 };
  r = await request(port, '/api/sync', authA({ state: { accounts: [account], budgets: [budget], recurringRules: [recurring] } }));
  assert.equal(r.status, 200);
  assert(r.body.state.accounts.some(x => x.id === account.id), '账户必须参与同步');
  assert(r.body.state.budgets.some(x => x.id === budget.id), '预算必须参与同步');
  assert(r.body.state.recurringRules.some(x => x.id === recurring.id), '周期账单必须参与同步');
  const personalPlan = { id: 'pp_regression', owner: deviceA, private: true, title: '健身跑步', date: '2026-08-14', startTime: '18:00', endTime: '19:00', repeat: 'none', updatedAt: now + 53 };
  r = await request(port, '/api/sync', authA({ state: { personalPlans: [personalPlan] } }));
  assert.equal(r.status, 200);
  assert(r.body.state.personalPlans.some(x => x.id === personalPlan.id), '个人计划必须参与同步');

  r = await request(port, '/api/share/create', authA({ ledgerId: ledgerA.id }));
  assert.equal(r.status, 200);
  const code = r.body.code;
  r = await request(port, '/api/share/join', authB({ code }));
  assert.equal(r.status, 200);
  const sharedLedger = r.body.ledger;
  const memberTx = { id: 'tx_member', ledger: ledgerA.id, owner: deviceB, amount: 2, type: 'out', date: '2026-08-13', updatedAt: Date.now() };
  r = await request(port, '/api/sync', authB({ state: { ledgers: [{ ...sharedLedger, name: 'unauthorized rename', updatedAt: Date.now() + 1 }], transactions: [memberTx], escrows: [], usages: [], debts: [] } }));
  assert.equal(r.status, 200, '共享成员上传只读账本元数据不应阻断记账');
  assert(r.body.state.transactions.some(x => x.id === memberTx.id));
  assert(!r.body.state.personalPlans.some(x => x.id === personalPlan.id), '个人私密计划不能暴露给共享账本成员');

  r = await request(port, '/api/push/public-key', undefined, 'GET');
  assert.equal(r.status, 200);
  assert.equal(typeof r.body.enabled, 'boolean', '推送能力必须明确报告启用状态');

  let seenPath = '', seenVisionBody = null;
  const upstream = http.createServer((req, res) => {
    seenPath = req.url;
    let raw = '';
    req.on('data', c => raw += c);
    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      if (req.url === '/v1/responses') {
        seenVisionBody = JSON.parse(raw);
        res.end(JSON.stringify({ output: [
          { type: 'reasoning', content: [{ type: 'text', text: '不要把这段思考当结果' }] },
          { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: '{"documentType":"loan_out","amount":1000,"confidence":0.98}' }] }
        ] }));
      } else res.end(JSON.stringify({ data: [{ id: 'safe-model' }] }));
    });
  });
  upstream.listen(0, '127.0.0.1');
  await once(upstream, 'listening');
  const upstreamPort = upstream.address().port;
  r = await request(port, '/api/models', authA({ apiKey: 'test', baseUrl: `http://127.0.0.1:${upstreamPort}/v1` }));
  assert.equal(r.status, 200);
  r = await request(port, '/api/models', authA({ apiKey: 'test', baseUrl: `http://localhost:${upstreamPort}/v1` }));
  assert.equal(r.status, 200, '域名上游在 Node 自动地址族选择模式下不能出现 Invalid IP address: undefined');
  assert.equal(seenPath, '/v1/models', '模型列表必须保留 /v1');
  r = await request(port, '/api/vision', authA({ apiKey: 'test', baseUrl: `http://127.0.0.1:${upstreamPort}/v1/responses`, model: 'mock-vision', input: [{ role: 'user', content: [{ type: 'input_text', text: '识别' }, { type: 'input_image', image_url: 'data:image/jpeg;base64,AA==' }] }] }));
  assert.equal(r.status, 200);
  assert.equal(seenPath, '/v1/responses', 'Responses 图片请求不能被改写为 chat/completions');
  assert.equal(seenVisionBody.input[0].content[1].type, 'input_image', '代理必须原样转发图片输入');
  assert.equal(r.body.output[1].content[0].type, 'output_text', '代理必须保留 Responses 最终文本结构');
  assert.throws(() => endpointUrl('https://api.openai.com/v1/responses', 'stt'), /own API base URL/);
  assert.equal(endpointUrl('https://api.openai.com/v1', 'stt'), 'https://api.openai.com/v1/audio/transcriptions');
  assert.equal(isPrivateAddress('127.0.0.1'), true);
  upstream.close();

  console.log('REGRESSION_TESTS_OK');
}

main().catch(e => {
  console.error(e.stack || e);
  process.exitCode = 1;
}).finally(async () => {
  if (server.listening) await new Promise(resolve => server.close(resolve));
  try { fs.unlinkSync(testData); } catch (_) {}
  try { fs.unlinkSync(testData + '.tmp'); } catch (_) {}
});
