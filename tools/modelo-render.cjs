// Renderiza tools/modelo.html (um modelo de perto, quatro ângulos) em PNG e imprime triângulos/medidas.
// Uso: NODE_PATH=<playwright> node tools/modelo-render.cjs <raça> <def> <saida.png> [w=1600] [h=1000] [extra=&anim=0.3]
const path = require('path'); const root = path.resolve(__dirname, '..'); const { chromium } = require('playwright');
const [race, def, out, w = '1600', h = '1000', extra = ''] = process.argv.slice(2);
(async () => { const b = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--allow-file-access-from-files', '--disable-dev-shm-usage'] });
  const p = await b.newPage({ viewport: { width: +w, height: +h } }); const errs = []; p.on('pageerror', e => errs.push(e.message.slice(0, 300))); p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 300)); });
  await p.goto('file://' + root + '/tools/modelo.html?race=' + race + '&def=' + def + '&w=' + w + '&h=' + h + extra, { waitUntil: 'load' });
  try { await p.waitForFunction(() => window.__done === true, null, { timeout: 180000 }); } catch (e) { errs.push('timeout'); }
  await p.screenshot({ path: out, timeout: 180000 }); const info = await p.evaluate(() => window.__info || null); await b.close();
  console.log(JSON.stringify({ out, info, errs }));
})().catch(e => { console.error('HARNESS FAIL', e.message); process.exit(1); });
