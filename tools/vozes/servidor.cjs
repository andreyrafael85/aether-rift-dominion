// 5.0c.1: servidor HTTP mínimo para os testes das vozes gravadas (o fetch não lê file://): serve a pasta do jogo em 127.0.0.1, numa porta livre,
// e conta os pedidos (para conferir que o jogo sem vozes não pede nada de assets/vozes/ e quanto cada tela baixa).
const http = require('http'), fs = require('fs'), path = require('path');
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json', '.css': 'text/css', '.ogg': 'audio/ogg', '.opus': 'audio/ogg', '.webm': 'audio/webm', '.m4a': 'audio/mp4', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.webmanifest': 'application/manifest+json' };
function servir(raiz, o) { o = o || {}; const pedidos = []; const bloquear = o.bloquear || null;
  const srv = http.createServer((req, res) => { let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); const arq = path.join(raiz, p); const item = { url: req.url, status: 200, bytes: 0, quando: Date.now() }; pedidos.push(item);
    if (!arq.startsWith(raiz) || (bloquear && bloquear.test(p))) { item.status = 404; res.writeHead(404); res.end(); return; }
    fs.stat(arq, (e, st) => { if (e || !st.isFile()) { item.status = 404; res.writeHead(404); res.end(); return; } item.bytes = st.size; res.writeHead(200, { 'Content-Type': TIPOS[path.extname(arq).toLowerCase()] || 'application/octet-stream', 'Content-Length': st.size, 'Cache-Control': 'no-cache' }); fs.createReadStream(arq).pipe(res); }); });
  return new Promise(ok => srv.listen(0, '127.0.0.1', () => ok({ url: 'http://127.0.0.1:' + srv.address().port, pedidos, fechar: () => new Promise(r => srv.close(() => r())) }))); }
module.exports = { servir };
