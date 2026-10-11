// 4.2 — capturas da engine: roda o teste de desempenho em tempo virtual (?benchpasso) e fotografa os mesmos pontos do trajeto
// (base A, batalha de perto, órbita, panorama, base B). Serve para comparar antes/depois de cada incremento da v4.2.
// Uso: NODE_PATH=<pasta com node_modules/playwright> node tools/engine-shots.cjs <url-da-página> <pasta-saida> [qualidade=media] [extra-query]
const pw = require('playwright');
(async () => {
  const [base, out, q = 'media', extra = ''] = process.argv.slice(2); const fs = require('fs'); fs.mkdirSync(out, { recursive: true });
  const b = await pw.chromium.launch({ headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
  await p.goto(base + '?bench=1&benchpasso=400&q=' + q + '&debug=1' + (extra ? '&' + extra : ''), { waitUntil: 'load', timeout: 180000 });
  await p.waitForFunction(() => document.getElementById('loading').hidden && window.__ARDG && window.__ARDG.bench, null, { timeout: 240000 });
  for (const [k, name] of [[0.02, '1-base'], [0.22, '2-batalha'], [0.42, '3-orbita'], [0.7, '4-panorama'], [0.97, '5-base-b']]) {
    await p.waitForFunction(k => (window.__ARDG.bench.k || 0) >= k || window.__benchResult, k, { timeout: 600000 });
    await p.evaluate(() => { window.__ARDG.paused = true; }); await p.waitForTimeout(300);
    await p.screenshot({ path: out + '/' + name + '.png', timeout: 180000 }); await p.evaluate(() => { window.__ARDG.paused = false; });
    console.log('captura ' + name + ' k=' + (await p.evaluate(() => (window.__ARDG.bench.k || 0).toFixed(2))));
  }
  console.log('erros:', errs.slice(0, 5)); await b.close();
})().catch(e => { console.error('HARNESS FAIL', e.message); process.exit(1); });
