// 5.0a.2 (2ª rodada): o "antes" do caráter das Raças. Abre a página de escuta v1 (a publicada, guardada em work/antes/vozes-escolha-v1.html)
// servida por HTTP, e roda as cadeias ao vivo dela (window.__vozes.montar) num OfflineAudioContext sobre as falas da faixa das Raças na voz
// Alex (os mesmos OGG que o dono ouviu). Grava WAV estéreo de 48 kHz em .tools/vozes/tmp/antes/<raça>/<fala>.wav para o gerar.py (--etapa antes)
// medir e pôr o antes do Vehnar e do Vorag na página. Uso: NODE_PATH=<node_modules com playwright> node tools/vozes/racas-antes.cjs
const path = require('path'), fs = require('fs'), http = require('http'); const root = path.resolve(__dirname, '../..'); const work = path.join(root, 'work');
const pw = require('playwright'); const saida = path.join(root, '.tools/vozes/tmp/antes');
const LINHAS = ['01-unidade-pronta', '03-base-sob-ataque', '06-unidade-selecionada', '10-barao-forja-2'], RACAS = ['seco', 'vehnar', 'erevane', 'tessara', 'quorith', 'vorag'];
const SKEL = '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>';
function wav(canais, sr) { const n = canais[0].length, c = canais.length, b = Buffer.alloc(44 + n * c * 2); b.write('RIFF', 0); b.writeUInt32LE(36 + n * c * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(c, 22); b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * c * 2, 28); b.writeUInt16LE(c * 2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * c * 2, 40);
  for (let i = 0; i < n; i++) for (let k = 0; k < c; k++) b.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(canais[k][i] * 32767))), 44 + (i * c + k) * 2); return b; }
const srv = http.createServer((q, s) => { const u = decodeURIComponent(q.url.split('?')[0]); const f = u === '/v1.html' ? path.join(work, 'antes/vozes-escolha-v1.html') : path.join(work, u);
  if (!f.startsWith(work) || !fs.existsSync(f)) { s.writeHead(404); return s.end(); } let body = fs.readFileSync(f); if (u === '/v1.html') body = SKEL + body.toString('utf8') + '</body></html>';
  s.writeHead(200, { 'content-type': u.endsWith('.html') ? 'text/html; charset=utf-8' : u.endsWith('.ogg') ? 'audio/ogg' : 'application/octet-stream' }); s.end(body); });
srv.listen(0, '127.0.0.1', async () => {
  const b = await pw.chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  try {
    const p = await b.newPage(); p.setDefaultTimeout(300000); await p.goto('http://127.0.0.1:' + srv.address().port + '/v1.html', { waitUntil: 'load' });
    for (const L of LINHAS) for (const r of RACAS) {
      const out = await p.evaluate(async ([L, r]) => {
        const ab = await (await fetch('vozes/kokoro-pm_alex/' + L + '.ogg')).arrayBuffer(); const sr = 48000; const tmp = new OfflineAudioContext(2, sr, sr); const buf = await tmp.decodeAudioData(ab);
        const oc = new OfflineAudioContext(2, Math.ceil((buf.duration + 3) * sr), sr); const src = oc.createBufferSource(); src.buffer = buf; const cad = window.__vozes.montar(oc, r, src, buf.duration);
        cad.saida.connect(oc.destination); cad.iniciar(0); src.start(cad.pre); const ren = await oc.startRendering();
        const b64 = a => { const u = new Uint8Array(a.buffer); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
        return { pre: cad.pre, L: b64(ren.getChannelData(0)), R: b64(ren.getChannelData(1)) };
      }, [L, r]);
      const f32 = s => { const bb = Buffer.from(s, 'base64'); return new Float32Array(bb.buffer, bb.byteOffset, bb.length / 4); };
      fs.mkdirSync(path.join(saida, r), { recursive: true }); fs.writeFileSync(path.join(saida, r, L + '.wav'), wav([f32(out.L), f32(out.R)], 48000)); console.log('antes', r, L, 'início da fala', out.pre, 's');
    }
  } finally { await b.close(); srv.close(); }
});
