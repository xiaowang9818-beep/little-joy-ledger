process.env.PORT = '3002';
require('./sync-server.js');
setTimeout(() => {
  const http = require('http');
  const req = http.get('http://127.0.0.1:3002/health', r => {
    let d = '';
    r.on('data', c => d += c);
    r.on('end', () => { console.log('resp', r.statusCode, d); process.exit(0); });
  });
  req.on('error', e => { console.error('err', e.message); process.exit(1); });
  req.setTimeout(3000, () => { console.error('timeout'); req.destroy(); process.exit(1); });
}, 500);
