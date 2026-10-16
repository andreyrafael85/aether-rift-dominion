// Renderiza tools/frota.html (a frota de uma Raça lado a lado, no tamanho do jogo) em PNG e imprime triângulos e medidas.
// Uso: NODE_PATH=<playwright> node tools/frota-render.cjs <raça> <saida.png> [view=partida|34|lado] [lite=0|1|2] [extra=&defs=a,b&zoom=1.5]
const path = require('path'); const root = path.resolve(__dirname, '..'); const { chromium } = require('playwright');
const [race, out, view = 'partida', lite = '0', extra = ''] = process.argv.slice(2);
(async () => { const b = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--allow-file-access-from-files', '--disable-dev-shm-usage'] });
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 } }); const errs = []; p.on('pageerror', e => errs.push(e.message.slice(0, 300))); p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 300)); });
  await p.goto('file://' + root + '/tools/frota.html?race=' + race + '&view=' + view + '&lite=' + lite + extra, { waitUntil: 'load' });
  try { await p.waitForFunction(() => window.__done === true, null, { timeout: 300000 }); } catch (e) { errs.push('timeout'); }
  await p.screenshot({ path: out, timeout: 300000 }); const info = await p.evaluate(() => window.__info || null); await b.close();
  console.log(JSON.stringify({ out, info, errs }));
})().catch(e => { console.error('HARNESS FAIL', e.message); process.exit(1); });
