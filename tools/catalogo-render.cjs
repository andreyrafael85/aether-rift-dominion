// Renderiza o catálogo 3D (tools/catalogo3d.html) por Raça em dist/catalogo3d/<raça>-<b|u>.png e o cenário neutro.
// Uso: NODE_PATH=<playwright> node tools/catalogo-render.cjs [raças=todas] [views=b,u] [w=1600] [h=900]
const path = require('path'); const fs = require('fs'); const root = path.resolve(__dirname, '..'); const { chromium } = require('playwright');
const races = (process.argv[2] || 'vehnar,erevane,tessara,quorith,vorag').split(','); const views = (process.argv[3] || 'b,u').split(','); const W = +(process.argv[4] || 1600), H = +(process.argv[5] || 900);
(async () => { fs.mkdirSync(root + '/dist/catalogo3d', { recursive: true }); const b = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--allow-file-access-from-files', '--disable-dev-shm-usage'] });
  const errs = []; const t0 = Date.now(); let n = 0;
  for (const race of races) for (const v of views) { if (v === 'n' && race !== races[0]) continue; const p = await b.newPage({ viewport: { width: W, height: H } }); p.on('pageerror', e => errs.push(race + '/' + v + ': ' + e.message.slice(0, 200))); p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(race + '/' + v + ' console: ' + m.text().slice(0, 200)); });
    await p.goto('file://' + root + '/tools/catalogo3d.html?race=' + race + '&view=' + v + '&w=' + W + '&h=' + H, { waitUntil: 'load' }); await p.waitForFunction(() => window.__done === true, null, { timeout: 120000 }); await p.waitForTimeout(300);
    await p.screenshot({ path: root + '/dist/catalogo3d/' + (v === 'n' ? 'cenario' : race + '-' + v) + '.png', timeout: 120000 }); await p.close(); n++; }
  await b.close(); console.log('catálogo: ' + n + ' imagens em ' + ((Date.now() - t0) / 1000).toFixed(0) + ' s | erros: ' + (errs.join(' ; ') || 'nenhum'));
})();
