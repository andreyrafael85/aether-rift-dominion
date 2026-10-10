// Renderiza os bustos dos líderes (tools/busts.html) com Playwright e salva dist/busts/<raca>_{big,px}.png.
// Uso: NODE_PATH=<pasta com node_modules/playwright> node tools/busts-render.cjs
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const root = path.resolve(__dirname, '..'); fs.mkdirSync(root + '/dist/busts', { recursive: true });
(async () => { const b = await chromium.launch({ headless: true, args: ['--no-sandbox', '--allow-file-access-from-files'] }); const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + root + '/tools/busts.html'); await p.waitForTimeout(800);
  const ids = await p.evaluate(() => Object.keys(window.__busts || {}));
  for (const id of ids) { const d = await p.evaluate(i => document.getElementById(i).toDataURL('image/png'), id); fs.writeFileSync(root + '/dist/busts/' + id + '.png', Buffer.from(d.split(',')[1], 'base64')); }
  console.log('bustos:', ids.length, '| erros:', errs.join(' | ') || 'nenhum'); await b.close(); })();
