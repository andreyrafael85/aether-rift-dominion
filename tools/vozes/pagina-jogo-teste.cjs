/* 5.0c.1: confere a página das vozes gravadas (work/vozes-jogo.html) servida com o mesmo leiaute da publicação (work/vozes-jogo-publicar.json:
   caminho publicado → arquivo): todos os áudios citados respondem, um botão de cada tipo toca (o tempo do áudio anda), não há rolagem lateral
   a 390 px e não há erro no console, no tema claro e no escuro. Fotos em work/fotos/vozes-jogo-*.png. Resultado em work/vozes-jogo-teste.json.
   Uso: NODE_PATH=<pasta com node_modules/playwright> node tools/vozes/pagina-jogo-teste.cjs */
'use strict';
const fs = require('fs'), path = require('path'), http = require('http');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..', '..');
const pub = JSON.parse(fs.readFileSync(path.join(root, 'work', 'vozes-jogo-publicar.json'), 'utf8'));
const TIPOS = { '.html': 'text/html; charset=utf-8', '.ogg': 'audio/ogg' };
const srv = http.createServer((q, s) => { const u = decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/, '');
  const f = u === '' || u === 'index.html' ? pub.pagina : pub.files[u] ? path.join(root, pub.files[u]) : null;
  if (!f || !fs.existsSync(f)) { s.writeHead(404); return s.end(); }
  let b = fs.readFileSync(f); if (u === '' || u === 'index.html') b = Buffer.concat([Buffer.from('<!doctype html><meta charset="utf-8">'), b]); /* o esqueleto que a publicação põe */
  s.writeHead(200, { 'content-type': TIPOS[path.extname(f)] || 'application/octet-stream', 'content-length': b.length }); s.end(b); });
(async () => {
  await new Promise(r => srv.listen(0, '127.0.0.1', r)); const url = `http://127.0.0.1:${srv.address().port}/`;
  const br = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] }); const out = { url, temas: {} }; fs.mkdirSync(path.join(root, 'work', 'fotos'), { recursive: true });
  for (const tema of ['dark', 'light']) {
    const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, colorScheme: tema }); const pg = await ctx.newPage(); const erros = [];
    pg.on('console', m => { if (m.type() === 'error') erros.push(m.text()); }); pg.on('pageerror', e => erros.push(String(e)));
    await pg.goto(url, { waitUntil: 'networkidle' });
    const r = await pg.evaluate(async () => { const bs = [...document.querySelectorAll('.vb[data-ogg]')]; const srcs = [...new Set(bs.map(b => b.dataset.ogg))];
      const ok = await Promise.all(srcs.map(s => fetch(s, { method: 'HEAD' }).then(x => x.ok).catch(() => false)));
      return { botoes: bs.length, audios: srcs.length, faltam: srcs.filter((s, i) => !ok[i]), cartoes: document.querySelectorAll('.card[data-r]').length, rolagem: document.documentElement.scrollWidth > innerWidth + 1, fundo: getComputedStyle(document.body).backgroundColor }; });
    const tocou = [];
    for (const sel of ['.row[data-tipo=aviso] .vb[data-ogg]', '.row[data-tipo=unidade] .vb[data-ogg]', '.row[data-tipo=lider] .vb[data-ogg]']) {
      const b = await pg.$(sel); if (!b) { tocou.push({ sel, ok: false, motivo: 'sem botão' }); continue; }
      await b.click(); await pg.waitForTimeout(700);
      tocou.push(await pg.evaluate(s => { const a = document.querySelector('.vb.tocando'); return { sel: s, ok: !!a, src: a && a.dataset.ogg }; }, sel));
    }
    const t = await pg.evaluate(() => new Promise(res => { const a = new Audio(document.querySelector('.vb[data-ogg]').dataset.ogg); a.muted = true; a.play().then(() => setTimeout(() => res({ tempo: a.currentTime, dur: a.duration }), 500)).catch(e => res({ erro: String(e) })); }));
    await pg.screenshot({ path: path.join(root, 'work', 'fotos', `vozes-jogo-${tema}.png`), fullPage: false });
    out.temas[tema] = Object.assign(r, { tocou, tempo: t, erros }); await ctx.close();
  }
  await br.close(); srv.close();
  const T = Object.values(out.temas); out.ok = T.every(x => x.botoes > 0 && !x.faltam.length && !x.rolagem && !x.erros.length && x.tocou.every(y => y.ok) && x.tempo.tempo > 0);
  fs.writeFileSync(path.join(root, 'work', 'vozes-jogo-teste.json'), JSON.stringify(out, null, 1));
  console.log(`página das vozes: ${out.ok ? 'ok' : 'FALHOU'} · ` + Object.entries(out.temas).map(([k, x]) => `${k}: ${x.botoes} botões, ${x.audios} áudios (${x.faltam.length} faltando), rolagem ${x.rolagem ? 'sim' : 'não'}, tocou ${x.tocou.filter(y => y.ok).length}/3, tempo ${x.tempo.tempo}, erros ${x.erros.length}`).join(' · '));
  process.exit(out.ok ? 0 : 1);
})().catch(e => { console.error(e); srv.close(); process.exit(1); });
