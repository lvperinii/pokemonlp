#!/usr/bin/env node
// server.js — servidor estático local, SEM dependências (só Node.js).
// Serve os arquivos do app com os Content-Type corretos (necessários para
// ES Modules e para o PWA) e abre o navegador automaticamente.
//
// Uso:  node server.js  [porta]
//       npm start
// Variáveis: PORT=8080 node server.js   |  NO_OPEN=1 node server.js (não abre o navegador)

const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const ROOT = __dirname;
const START_PORT = parseInt(process.env.PORT || process.argv[2] || '8000', 10);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

function resolveSafe(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0].split('#')[0]);
  const full = path.join(ROOT, path.normalize(decoded));
  // Impede path traversal para fora da pasta do projeto.
  if (full !== ROOT && !full.startsWith(ROOT + path.sep)) return null;
  return full;
}

const server = http.createServer((req, res) => {
  let full = resolveSafe(req.url);
  if (!full) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('403 Forbidden');
    return;
  }
  fs.stat(full, (err, stat) => {
    if (!err && stat.isDirectory()) full = path.join(full, 'index.html');
    fs.readFile(full, (err2, data) => {
      if (err2) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('404 Not Found');
        return;
      }
      const ext = path.extname(full).toLowerCase();
      res.writeHead(200, {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        'Cache-Control': 'no-cache',
      });
      res.end(data);
    });
  });
});

function openBrowser(url) {
  if (process.env.NO_OPEN === '1') return;
  const p = process.platform;
  try {
    if (p === 'darwin') execFile('open', [url]);
    else if (p === 'win32') execFile('cmd', ['/c', 'start', '', url]);
    else execFile('xdg-open', [url]);
  } catch { /* abertura automática é só conveniência */ }
}

function listen(port, attemptsLeft) {
  server.removeAllListeners('error');
  server.once('error', (e) => {
    if (e.code === 'EADDRINUSE' && attemptsLeft > 0) {
      console.log(`Porta ${port} ocupada — tentando ${port + 1}…`);
      listen(port + 1, attemptsLeft - 1);
    } else {
      console.error('Não foi possível iniciar o servidor:', e.message);
      process.exit(1);
    }
  });
  server.listen(port, () => {
    const url = `http://localhost:${port}`;
    console.log('\n  ┌───────────────────────────────────────────┐');
    console.log('  │  Coleção Pokémon — rodando localmente       │');
    console.log(`  │  ${url.padEnd(41)}│`);
    console.log('  │  (pressione Ctrl+C para parar)              │');
    console.log('  └───────────────────────────────────────────┘\n');
    openBrowser(url);
  });
}

listen(START_PORT, 15);
