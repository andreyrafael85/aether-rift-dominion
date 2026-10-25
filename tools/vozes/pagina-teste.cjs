// 5.0a.2: confere work/vozes-escolha.html como o dono vai usar: servida por HTTP (como a página publicada), com o esqueleto que a publicação
// acrescenta. 2ª rodada: a mesa (12 × 6), o elenco (5 líderes e 10 avisos de locutor), a faixa das Raças com os arquivos assados (a Tessara
// com a Dora por padrão), o antes do Vehnar e do Vorag, nenhum filtro ao vivo; todo arquivo citado existe e toca; fotos no computador e no
// celular, sem rolagem lateral. Uso: NODE_PATH=<node_modules com playwright> node tools/vozes/pagina-teste.cjs
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
    out.pagina = await p.evaluate(() => ({ titulo: document.title, linhas: document.querySelectorAll('#mesa .row').length, mesa: document.querySelectorAll('#mesa .vb').length, elenco: document.querySelectorAll('.elc').length, elencoBotoes: document.querySelectorAll('.elc button[data-arq]').length,
      racas: document.querySelectorAll('.rb').length, antes: document.querySelectorAll('[data-antes]').length, aoVivo: typeof window.__vozes.montar, ext: window.__vozes.ext, sylvia: /Sylvia Oriel/.test(document.body.textContent) && !/Sylva Oriel/.test(document.body.textContent),
      decisao: /24\/10\/2026/.test(document.body.textContent), padraoTessara: window.__vozes.arqRaca('tessara'), padraoVehnar: window.__vozes.arqRaca('vehnar') }));
    /* todo arquivo que a página pode tocar existe */
    out.arquivos = await p.evaluate(async () => { const arqs = new Set(); document.querySelectorAll('[data-arq]').forEach(b => arqs.add(b.dataset.arq)); const vozSel = document.getElementById('r-voz'), falaSel = document.getElementById('r-fala');
      for (const v of [...vozSel.options].map(o => o.value)) for (const L of [...falaSel.options].map(o => o.value)) { vozSel.value = v; falaSel.value = L; for (const r of ['seco', 'vehnar', 'erevane', 'tessara', 'quorith', 'vorag']) arqs.add(window.__vozes.arqRaca(r)); for (const r of ['vehnar', 'vorag']) arqs.add('vozes/racas-antes/' + r + '/' + L); }
      vozSel.value = 'padrao'; falaSel.value = '10-barao-forja-2'; const falta = [];
      for (const a of arqs) for (const ext of ['ogg', 'mp3']) { const r = await fetch(a + '.' + ext, { method: 'HEAD' }); if (!r.ok) falta.push(a + '.' + ext); }
      return { total: arqs.size, falta: falta.slice(0, 10), nFalta: falta.length }; });
    const toca = async sel => { await p.click(sel); await p.waitForTimeout(700); return p.evaluate(() => !!document.querySelector('.tocando')); };
    out.toca = { mesa: await toca('#mesa .row .vb.rec'), vehnar: await toca('.rb[data-r=vehnar]'), antesVorag: await toca('[data-antes=vorag]'), elenco: await toca('.elc[data-r=tessara] button[data-arq]') };
    out.ok = out.pagina.titulo === 'Vozes do Aether Rift' && out.pagina.linhas === 12 && out.pagina.mesa === 72 && out.pagina.elenco === 5 && out.pagina.elencoBotoes === 15 && out.pagina.racas === 6 && out.pagina.antes === 2 && out.pagina.aoVivo === 'undefined'
      && out.pagina.sylvia && out.pagina.decisao && /kokoro-pf_dora/.test(out.pagina.padraoTessara) && /kokoro-pm_alex/.test(out.pagina.padraoVehnar) && out.arquivos.nFalta === 0 && Object.values(out.toca).every(Boolean) && !errs.length;
    fs.mkdirSync(work + '/fotos', { recursive: true }); await p.screenshot({ path: work + '/fotos/pagina-escuta-computador.png', fullPage: true });
    const c = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); await c.goto(url, { waitUntil: 'networkidle' }); out.celular = await c.evaluate(() => ({ larguraPagina: document.documentElement.scrollWidth, larguraTela: innerWidth }));
    out.ok = out.ok && out.celular.larguraPagina <= out.celular.larguraTela; await c.screenshot({ path: work + '/fotos/pagina-escuta-celular.png', fullPage: true });
    for (const [sel, nome] of [['.wrap>header', 'topo'], ['.elenco', 'elenco'], ['.racas', 'racas'], ['#t-med', 'medidas'], ['#mesa', 'mesa']]) { await c.locator(sel).first().scrollIntoViewIfNeeded(); await c.screenshot({ path: work + '/fotos/pagina-escuta-celular-' + nome + '.png' }); }
    out.erros = errs.slice(0, 5);
  } finally { await b.close(); srv.close(); }
  fs.writeFileSync(work + '/pagina-teste.json', JSON.stringify(out, null, 2)); console.log(JSON.stringify(out, null, 1)); console.log('página: ' + (out.ok ? 'ok' : 'FALHOU')); process.exitCode = out.ok ? 0 : 1;
});
