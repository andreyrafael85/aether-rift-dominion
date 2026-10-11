// 4.2b — renderiza a folha de animação (tools/anim-sheet.html) por Raça em <saída>/<raça>-<view>.png
// Uso: NODE_PATH=<playwright> node tools/anim-sheet.cjs <pasta-saida> [raças=todas] [views=u,b] [w=1500] [h=1000]
const path = require('path'); const fs = require('fs'); const root = path.resolve(__dirname, '..'); const { chromium } = require('playwright');
const out = process.argv[2]; const races = (process.argv[3] || 'vehnar,erevane,tessara,quorith,vorag').split(','); const views = (process.argv[4] || 'u,b').split(','); const W = +(process.argv[5] || 1500), H = +(process.argv[6] || 1000);
(async () => { fs.mkdirSync(out, { recursive: true }); const b = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--allow-file-access-from-files', '--disable-dev-shm-usage'] });
  const errs = [];
  for (const race of races) for (const v of views) { if (v === 'n' && race !== races[0]) continue; const p = await b.newPage({ viewport: { width: W, height: H } }); p.on('pageerror', e => errs.push(race + '/' + v + ': ' + e.message.slice(0, 200))); p.on('console', m => { if (m.type() === 'error') errs.push(race + '/' + v + ' console: ' + m.text().slice(0, 200)); });
    await p.goto('file://' + root + '/tools/anim-sheet.html?race=' + race + '&view=' + v + '&w=' + W + '&h=' + H, { waitUntil: 'load' }); await p.waitForFunction(() => window.__done === true, null, { timeout: 300000 });
    const rows = await p.evaluate(() => window.__rows); const f = path.join(out, race + '-' + v + '.png'); if (rows) await p.screenshot({ path: f, timeout: 300000 }); console.log(race + '/' + v + ': ' + rows + ' modelos animados' + (rows ? ' → ' + f : '')); await p.close(); }
  await b.close(); for (const e of errs) console.log('  ' + e); if (!errs.length) console.log('  (sem erros)');
})().catch(e => { console.error('HARNESS FAIL', e.message); process.exit(1); });
