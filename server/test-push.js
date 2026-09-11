const assert = require('assert');
const http = require('http');
const fs = require('fs');
const path = require('path');
const Module = require('module');
const { once } = require('events');

const sent = [];
const pushStub = {
  generateVAPIDKeys: () => ({ publicKey: 'test-public-key', privateKey: 'test-private-key' }),
  setVapidDetails: () => {},
  sendNotification: async (subscription, payload) => { sent.push({ subscription, payload: JSON.parse(payload) }); }
};
const originalLoad = Module._load;
Module._load = function(request, parent, isMain) { return request === 'web-push' ? pushStub : originalLoad.call(this, request, parent, isMain); };

const testData = path.join(__dirname, `test-push-${process.pid}.json`);
process.env.PORT = '0';
process.env.DATA_FILE = testData;
const { server, processPushSchedules } = require('./sync-server.js');

function request(port, route, body, method = 'POST') {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? null : Buffer.from(JSON.stringify(body));
    const req = http.request({ hostname: '127.0.0.1', port, path: route, method, headers: data ? { 'Content-Type': 'application/json', 'Content-Length': data.length } : {} }, res => {
      let text = '';res.on('data', c => text += c);res.on('end', () => { let parsed = null;try { parsed = JSON.parse(text); } catch (_) {}resolve({ status: res.statusCode, body: parsed }); });
    });
    req.on('error', reject);if (data) req.write(data);req.end();
  });
}

async function main() {
  if (!server.listening) await once(server, 'listening');
  const port = server.address().port,deviceId = 'dev_push_test',deviceToken = 'p'.repeat(64),auth = extra => ({ deviceId, deviceToken, ...extra });
  let r = await request(port, '/api/sync', auth({ state: {} }));assert.equal(r.status, 200);
  r = await request(port, '/api/push/public-key', undefined, 'GET');assert.equal(r.status, 200);assert.equal(r.body.enabled, true);assert.equal(r.body.publicKey, 'test-public-key');
  r = await request(port, '/api/push/subscribe', auth({ subscription: { endpoint: 'https://push.example.test/abc', keys: { p256dh: 'key', auth: 'auth' } } }));assert.equal(r.status, 200);
  r = await request(port, '/api/push/schedule', auth({ jobs: [{ id: 'pp_test_2026-08-14', fireAt: Date.now() - 100, title: '🏃 健身跑步', body: '18:00–19:00', url: '/index.html?planDate=2026-08-14&planId=pp_test' }] }));assert.equal(r.status, 200);
  await processPushSchedules();assert.equal(sent.length, 1);assert.equal(sent[0].payload.title, '🏃 健身跑步');assert(sent[0].payload.url.includes('planId=pp_test'));
  console.log('PUSH_TESTS_OK');
}

main().catch(e => { console.error(e.stack || e);process.exitCode = 1; }).finally(async () => {
  Module._load = originalLoad;if (server.listening) await new Promise(resolve => server.close(resolve));
  try { fs.unlinkSync(testData); } catch (_) {}try { fs.unlinkSync(testData + '.tmp'); } catch (_) {}
});
