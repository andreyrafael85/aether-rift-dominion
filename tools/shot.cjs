// Captura determinística com Playwright: abre a página, espera o loading sumir + N ms, imprime erros/console [ARD] e salva PNG.
// Uso: NODE_PATH=<pasta com node_modules/playwright> node tools/shot.cjs <url> <out.png> [settleMs=6000] [w=1000] [h=700]
const { chromium } = require('playwright');
(async () => {
  const [url, out, settle = '6000', w = '1000', h = '700'] = process.argv.slice(2);
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--allow-file-access-from-files', '--disable-dev-shm-usage'] });
  const page = await browser.newPage({ viewport: { width: +w, height: +h } });
  const logs = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning' || m.text().startsWith('[ARD]')) logs.push(m.type() + ': ' + m.text().slice(0, 400)); });
  page.on('pageerror', e => logs.push('PAGEERROR: ' + String(e.stack || e.message).slice(0, 600)));
  const t0 = Date.now();
  await page.goto(url, { waitUntil: 'load' });
  try { await page.waitForFunction(() => { const l = document.getElementById('loading'); return l && l.hidden; }, null, { timeout: 90000 }); } catch (e) { logs.push('TIMEOUT: loading ainda visível após 90 s'); }
  const tLoad = Date.now() - t0;
  await page.waitForTimeout(+settle);
  const hud = await page.evaluate(() => (document.getElementById('hud') || document.body).innerText.replace(/\s+/g, ' ').slice(0, 160));
  await page.screenshot({ path: out, timeout: 180000 });
  await browser.close();
  console.log('load=' + tLoad + 'ms hud="' + hud + '"');
  for (const l of logs) console.log('  ' + l);
  if (!logs.length) console.log('  (sem erros de console/página)');
})().catch(e => { console.error('HARNESS FAIL', e.message); process.exit(1); });
