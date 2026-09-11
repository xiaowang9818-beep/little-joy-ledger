'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const parsedPort = process.env.STATIC_PORT === undefined ? 8081 : Number(process.env.STATIC_PORT);
const PORT = Number.isInteger(parsedPort) && parsedPort >= 0 && parsedPort <= 65535 ? parsedPort : 8081;
const HOST = process.env.STATIC_HOST || '0.0.0.0';
const FILES = new Map([
  ['/', 'index.html'],
  ['/index.html', 'index.html'],
  ['/cute-themes.css', 'cute-themes.css'],
  ['/payment.css', 'payment.css'],
  ['/growth.css', 'growth.css'],
  ['/ui-icons.css', 'ui-icons.css'],
  ['/enhancements.js', 'enhancements.js'],
  ['/ui-icons.js', 'ui-icons.js'],
  ['/manifest.webmanifest', 'manifest.webmanifest'],
  ['/app-icon.svg', 'app-icon.svg'],
  ['/sw.js', 'sw.js'],
  ['/assets/payment/wechat-pay.jpg', 'assets/payment/wechat-pay.jpg'],
  ['/assets/payment/alipay.jpg', 'assets/payment/alipay.jpg'],
  ['/assets/payment/wechat-contact.jpg', 'assets/payment/wechat-contact.jpg'],
  ['/admin', 'admin/index.html'],
  ['/admin/', 'admin/index.html'],
  ['/admin/index.html', 'admin/index.html'],
  ['/admin/admin.css', 'admin/admin.css'],
  ['/admin/admin.js', 'admin/admin.js']
]);
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.webmanifest': 'application/manifest+json; charset=utf-8', '.svg': 'image/svg+xml; charset=utf-8', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };

const server = http.createServer((req, res) => {
  if (!['GET', 'HEAD'].includes(req.method || '')) {
    res.writeHead(405, { Allow: 'GET, HEAD', 'Cache-Control': 'no-store' });
    res.end();
    return;
  }
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url || '/', 'http://localhost').pathname); }
  catch (_) { res.writeHead(400, { 'Cache-Control': 'no-store' }); res.end('Bad Request'); return; }
  const relative = FILES.get(pathname);
  if (!relative) { res.writeHead(404, { 'Cache-Control': 'no-store' }); res.end('Not Found'); return; }
  const target = path.join(ROOT, relative);
  fs.readFile(target, (error, data) => {
    if (error) { res.writeHead(error.code === 'ENOENT' ? 404 : 500, { 'Cache-Control': 'no-store' }); res.end(); return; }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(target).toLowerCase()] || 'application/octet-stream',
      'Content-Length': data.length,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'strict-origin-when-cross-origin'
    });
    res.end(req.method === 'HEAD' ? undefined : data);
  });
});

server.listen(PORT, HOST, () => console.log(`记账本网页服务已启动：http://127.0.0.1:${server.address().port}`));
module.exports = { server, FILES };
