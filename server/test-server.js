const http = require('http');
const fs = require('fs');
const path = require('path');

// Minimal inline copy of sync-server for testing
const DATA = path.join(__dirname, 'data.json');
let DB = fs.existsSync(DATA) ? JSON.parse(fs.readFileSync(DATA)) : { devices: {}, shares: {}, _g: null };
function send(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(obj));
}
function readBody(req) {
  return new Promise(res => {
    let b = '';
    req.on('data', c => b += c);
    req.on('end', () => { try { res(JSON.parse(b || '{}')); } catch (e) { res({}); } });
  });
}
const server = http.createServer(async (req, res) => {
  console.log('request', req.method, req.url);
  if (req.method === 'OPTIONS') return send(res, 204, {});
  const url = (req.url || '').split('?')[0];
  try {
    const body = await readBody(req);
    console.log('body len', JSON.stringify(body).length);
    if (url === '/' || url === '/health') return send(res, 200, { ok: true });
    return send(res, 404, { error: 'not found' });
  } catch (e) { console.error('err', e); return send(res, 500, { error: String(e) }); }
});
server.listen(3001, '127.0.0.1', () => {
  console.log('test server on 3001');
  http.get('http://127.0.0.1:3001/health', r => {
    let d = '';
    r.on('data', c => d += c);
    r.on('end', () => { console.log('resp', r.statusCode, d); process.exit(0); });
  }).on('error', e => { console.error('client err', e.message); process.exit(1); });
});
