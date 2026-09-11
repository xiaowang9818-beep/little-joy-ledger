'use strict';

const assert = require('assert');
const http = require('http');

process.env.STATIC_HOST = '127.0.0.1';
process.env.STATIC_PORT = '0';
const { server } = require('./static-server');

function request(pathname, method = 'GET') {
  return new Promise((resolve, reject) => {
    const address = server.address();
    const req = http.request({ hostname: '127.0.0.1', port: address.port, path: pathname, method }, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => { const buffer = Buffer.concat(chunks); resolve({ status: res.statusCode, headers: res.headers, body: buffer.toString('utf8'), buffer }); });
    });
    req.on('error', reject);
    req.end();
  });
}

server.on('listening', async () => {
  try {
    const front = await request('/index.html');
    assert.strictEqual(front.status, 200);
    assert.match(front.headers['content-type'], /^text\/html/);
    assert.ok(front.body.includes('小确幸'));

    const admin = await request('/admin/');
    assert.strictEqual(admin.status, 200);
    assert.ok(admin.body.includes('小确幸运营后台'));

    const paymentStyle = await request('/payment.css');
    const growthStyle = await request('/growth.css');
    const iconStyle = await request('/ui-icons.css');
    const iconScript = await request('/ui-icons.js');
    assert.strictEqual(paymentStyle.status, 200);
    assert.strictEqual(growthStyle.status, 200);
    assert.strictEqual(iconStyle.status, 200);
    assert.strictEqual(iconScript.status, 200);
    assert.match(paymentStyle.headers['content-type'], /^text\/css/);
    assert.match(iconStyle.headers['content-type'], /^text\/css/);
    assert.match(iconScript.headers['content-type'], /javascript/);
    const paymentQr = await request('/assets/payment/wechat-pay.jpg');
    assert.strictEqual(paymentQr.status, 200);
    assert.strictEqual(paymentQr.headers['content-type'], 'image/jpeg');
    assert.ok(paymentQr.buffer.length > 50000);
    assert.strictEqual(paymentQr.buffer[0], 0xff);
    assert.strictEqual(paymentQr.buffer[1], 0xd8);

    const sensitive = await request('/server/data.json');
    assert.strictEqual(sensitive.status, 404);
    const traversal = await request('/%2e%2e/server/data.json');
    assert.strictEqual(traversal.status, 404);
    const post = await request('/index.html', 'POST');
    assert.strictEqual(post.status, 405);
    console.log('STATIC_SERVER_TESTS_OK');
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    server.close();
  }
});
