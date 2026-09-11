const http = require('http');
const deviceId = 'dev_endpoint_test';
const deviceToken = 'e'.repeat(64);

function post(path, headers, body) {
  return new Promise((res, rej) => {
    const opts = { hostname: '127.0.0.1', port: 3000, path, method: 'POST', headers };
    const req = http.request(opts, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => res({ status: r.statusCode, body: d })); });
    req.on('error', rej);
    req.setTimeout(8000, () => { req.destroy(); rej(new Error('timeout')); });
    req.write(body);
    req.end();
  });
}

(async () => {
  const r1 = await post('/api/vision', { 'Content-Type': 'application/json' }, JSON.stringify({ deviceId, deviceToken, apiKey: 'sk-test', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', messages: [] }));
  console.log('vision', r1.status, r1.body.slice(0, 120));

  const boundary = '----TestBoundary';
  const body = Buffer.from([
    `--${boundary}`,
    'Content-Disposition: form-data; name="apiKey"',
    '',
    'sk-test',
    `--${boundary}`,
    'Content-Disposition: form-data; name="baseUrl"',
    '',
    'https://api.openai.com/v1',
    `--${boundary}`,
    'Content-Disposition: form-data; name="deviceId"',
    '',
    deviceId,
    `--${boundary}`,
    'Content-Disposition: form-data; name="deviceToken"',
    '',
    deviceToken,
    `--${boundary}`,
    'Content-Disposition: form-data; name="file"; filename="a.webm"',
    'Content-Type: audio/webm',
    '',
    'abc',
    `--${boundary}--`,
    ''
  ].join('\r\n'));
  const r2 = await post('/api/stt', { 'Content-Type': 'multipart/form-data; boundary=' + boundary, 'Content-Length': body.length }, body);
  console.log('stt', r2.status, r2.body.slice(0, 120));
})();
