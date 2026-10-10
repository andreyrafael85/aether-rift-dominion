// Renderiza a arte 3D da galeria (tools/arte3d.html) em dist/arte3d/*.jpg com Chromium + SwiftShader.
// Uso: NODE_PATH=<pasta com node_modules/playwright> node tools/arte3d-render.cjs [filtro: bust|insignia|world|layout|logo]
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const root = path.resolve(__dirname, '..'); fs.mkdirSync(root + '/dist/arte3d', { recursive: true }); const only = process.argv[2];
const RACES = ['vehnar', 'erevane', 'tessara', 'quorith', 'vorag']; const jobs = [];
for (const r of RACES) for (const v of [1, 2, 3]) { jobs.push(['bust', r, v, 520, 620]); jobs.push(['insignia', r, v, 520, 520]); jobs.push(['world', r, v, 960, 600]); }
for (const v of [1, 2, 3]) { jobs.push(['layout', '-', v, 1040, 520]); jobs.push(['logo', '-', v, 1040, 400]); jobs.push(['belt', '-', v, 1040, 520]); jobs.push(['emblem', '-', v, 720, 720]); }
for (const r of RACES) for (const v of [1, 2, 3]) { jobs.push(['head', r, v, 640, 640]); jobs.push(['postal', r, v, 960, 600]); }
(async () => { const b = await chromium.launch({ headless: true, args: ['--no-sandbox', '--allow-file-access-from-files', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-dev-shm-usage'] });
  const p = await b.newPage(); p.setDefaultTimeout(180000); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
  await p.goto('file://' + root + '/tools/arte3d.html'); await p.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });
  let ok = 0; const t0 = Date.now();
  for (const j of jobs) { if (only && j[0] !== only) continue; const t = Date.now(); const d = await p.evaluate(jj => window.render3d(...jj), j); const name = j[0] + '_' + j[1] + '_' + j[2] + '.jpg';
    if (typeof d === 'string' && d.startsWith('data:')) { fs.writeFileSync(root + '/dist/arte3d/' + name, Buffer.from(d.split(',')[1], 'base64')); ok++; console.log(name.padEnd(28), ((Date.now() - t) / 1000).toFixed(1) + 's'); } else console.log(name.padEnd(28), 'FALHOU', String(d).slice(0, 300)); }
  console.log('renderizados:', ok, 'em', ((Date.now() - t0) / 1000).toFixed(0) + 's', '| erros de página:', errs.slice(0, 5).join(' | ') || 'nenhum'); await b.close(); })();
