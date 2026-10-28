'use strict';
// Tiny static file server for the app. No dependencies except chart.js (served from node_modules).
const http = require('http');
const fs = require('fs');
const path = require('path');

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json' };

function resolveFile(urlPath) {
  if (urlPath === '/') { urlPath = '/index.html'; }
  if (urlPath === '/vendor/chart.js') {
    return path.join(__dirname, '..', 'node_modules', 'chart.js', 'dist', 'chart.umd.js');
  }
  const file = path.normalize(path.join(__dirname, urlPath));
  return file.startsWith(__dirname) ? file : null; // block path traversal
}

function startServer(port) {
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = resolveFile(urlPath);
    if (!file || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(port, () => resolve(server)));
}

module.exports = { startServer };

if (require.main === module) {
  const port = Number(process.env.PORT || new URL(process.env.BASE_URL || 'http://localhost:4173').port || 4173);
  startServer(port).then(() => console.log(`Loan EMI Dashboard on http://localhost:${port}`));
}
