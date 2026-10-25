// 5.0a.2: confere work/vozes-escolha.html como o dono vai usar: servida por HTTP (como a página publicada), com o esqueleto que a publicação
// acrescenta. Toca um botão da mesa, mede cada cadeia de Raça renderizada offline (OfflineAudioContext) sobre a melhor voz — nível, tom médio,
// brilho (cruzamentos por zero), estéreo e cauda — e tira as fotos da página no computador e no celular.
// Uso: NODE_PATH=<node_modules com playwright> node tools/vozes/pagina-teste.cjs
const path = require('path'), fs = require('fs'), http = require('http'); const root = path.resolve(__dirname, '../..'); const work = path.join(root, 'work');
const pw = require('playwright');
const TIPOS = { '.html': 'text/html; charset=utf-8', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.json': 'application/json', '.png': 'image/png' };
const SKEL = '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)}body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}</style></head><body>';
const srv = http.createServer((q, s) => { const u = decodeURIComponent(q.url.split('?')[0]); const f = path.join(work, u === '/' ? 'vozes-escolha.html' : u); if (!f.startsWith(work) || !fs.existsSync(f)) { s.writeHead(404); return s.end(); }
  let body = fs.readFileSync(f); if (f.endsWith('vozes-escolha.html')) body = SKEL + body.toString('utf8') + '</body></html>'; s.writeHead(200, { 'content-type': TIPOS[path.extname(f)] || 'application/octet-stream' }); s.end(body); });
srv.listen(0, '127.0.0.1', async () => {
  const port = srv.address().port, url = 'http://127.0.0.1:' + port + '/'; const out = {};
  const b = await pw.chromium.launch({ headless: true, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required', '--disable-dev-shm-usage'] });
  try {
    const p = await b.newPage({ viewport: { width: 1280, height: 900 } }); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    p.setDefaultTimeout(180000); await p.goto(url, { waitUntil: 'networkidle' });
    out.mesa = await p.evaluate(() => ({ linhas: document.querySelectorAll('#mesa .row').length, botoes: document.querySelectorAll('#mesa .vb').length, ext: window.__vozes.ext, titulo: document.title }));
    await p.click('#mesa .row .vb.rec'); await p.waitForTimeout(600); out.tocando = await p.evaluate(() => !!document.querySelector('.vb.tocando'));
    out.racas = await p.evaluate(async () => {
      const D = JSON.parse(document.getElementById('dados').textContent); const v = D.melhor, f = '09-barao-forja-1';
      const ab = await (await fetch('vozes/' + v + '/' + f + '.' + window.__vozes.ext)).arrayBuffer(); const tmp = new OfflineAudioContext(2, 48000, 48000); const buf = await tmp.decodeAudioData(ab);
      const med = (x, sr) => { let s = 0, pk = 0, z = 0; for (let i = 0; i < x.length; i++) { s += x[i] * x[i]; pk = Math.max(pk, Math.abs(x[i])); if (i && (x[i] >= 0) !== (x[i - 1] >= 0)) z++; } return { rms: 10 * Math.log10(s / x.length + 1e-12), pk: 20 * Math.log10(pk + 1e-12), zcr: z / (x.length / sr) }; };
      const f0 = (x, sr) => { const n = Math.floor(sr * 0.04), h = n >> 1, lo = Math.floor(sr / 400), hi = Math.floor(sr / 60), vals = []; let ref = 0; for (let i = 0; i < x.length; i++) ref = Math.max(ref, Math.abs(x[i]));
        for (let i = 0; i + n < x.length; i += h) { let m = 0; for (let j = 0; j < n; j++) m += x[i + j]; m /= n; let e = 0; for (let j = 0; j < n; j++) e += (x[i + j] - m) ** 2; if (Math.sqrt(e / n) < ref * 0.08) continue;
          let best = 0, bk = 0; for (let k = lo; k < hi; k++) { let c = 0; for (let j = 0; j + k < n; j++) c += (x[i + j] - m) * (x[i + j + k] - m); c /= e; if (c > best) { best = c; bk = k; } } if (best > 0.5) vals.push(sr / bk); }
        vals.sort((a, b) => a - b); return vals.length ? Math.round(vals[vals.length >> 1]) : null; };
      const res = {};
      for (const r of ['seco', 'vehnar', 'erevane', 'tessara', 'quorith', 'vorag']) {
        const sr = 48000, len = Math.ceil((buf.duration + 3) * sr), oc = new OfflineAudioContext(2, len, sr); const src = oc.createBufferSource(); src.buffer = buf; const cad = window.__vozes.montar(oc, r, src, buf.duration); cad.saida.connect(oc.destination); cad.iniciar(0); src.start(cad.pre);
        const ren = await oc.startRendering(); const L = ren.getChannelData(0), R = ren.getChannelData(1); const mono = new Float32Array(L.length), side = new Float32Array(L.length); for (let i = 0; i < L.length; i++) { mono[i] = (L[i] + R[i]) / 2; side[i] = (L[i] - R[i]) / 2; }
        const m = med(mono, sr), sd = med(side, sr); let fim = 0; const lim = Math.pow(10, -55 / 20); for (let i = mono.length - 1; i >= 0; i--) if (Math.abs(mono[i]) > lim) { fim = i; break; }
        res[r] = { rmsDb: +m.rms.toFixed(1), picoDb: +m.pk.toFixed(1), cruzamentosPorS: Math.round(m.zcr), estereoDb: +(sd.rms - m.rms).toFixed(1), caudaS: +((fim / sr) - cad.pre - buf.duration).toFixed(2), f0Hz: f0(mono, sr) }; }
      return { voz: v, fala: f, duracaoS: +buf.duration.toFixed(2), medidas: res };
    });
    const M = out.racas.medidas, s = M.seco; const st = (a, bb) => 12 * Math.log2(a / bb);
    out.checks = { vorag_desce: M.vorag.f0Hz && s.f0Hz ? +st(M.vorag.f0Hz, s.f0Hz).toFixed(1) : null, quorith_estereo: M.quorith.estereoDb, erevane_cauda: M.erevane.caudaS, vehnar_chiado: M.vehnar.cruzamentosPorS - s.cruzamentosPorS, tessara_brilho: M.tessara.cruzamentosPorS - s.cruzamentosPorS };
    out.ok = out.mesa.linhas === 12 && out.mesa.botoes === 72 && out.tocando && out.checks.vorag_desce != null && out.checks.vorag_desce < -2.5 && M.quorith.estereoDb > -25 && M.erevane.caudaS > 0.5 && out.checks.vehnar_chiado > 0 && out.checks.tessara_brilho < 0 && Object.values(M).every(x => x.picoDb < -0.5 && Math.abs(x.rmsDb - s.rmsDb) <= 4) /* sem estourar e com o volume casado com a voz seca (±4 dB) */ && !errs.length;
    fs.mkdirSync(work + '/fotos', { recursive: true }); await p.screenshot({ path: work + '/fotos/pagina-escuta-computador.png', fullPage: true });
    const c = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); await c.goto(url, { waitUntil: 'networkidle' }); out.celular = await c.evaluate(() => ({ larguraPagina: document.documentElement.scrollWidth, larguraTela: innerWidth }));
    out.ok = out.ok && out.celular.larguraPagina <= out.celular.larguraTela; await c.screenshot({ path: work + '/fotos/pagina-escuta-celular.png', fullPage: true }); for (const [sel, nome] of [['header', 'topo'], ['#mesa', 'mesa'], ['.racas', 'racas']]) { await c.locator(sel).first().scrollIntoViewIfNeeded(); await c.screenshot({ path: work + '/fotos/pagina-escuta-celular-' + nome + '.png' }); } /* uma tela do celular por seção */ out.erros = errs.slice(0, 5);
  } finally { await b.close(); srv.close(); }
  fs.writeFileSync(work + '/pagina-teste.json', JSON.stringify(out, null, 2)); console.log(JSON.stringify(out, null, 1)); console.log('página: ' + (out.ok ? 'ok' : 'FALHOU')); process.exitCode = out.ok ? 0 : 1;
});
