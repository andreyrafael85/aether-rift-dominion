// Renderiza a arte 3D da galeria (tools/arte3d.html) em dist/arte3d/*.jpg com Chromium + SwiftShader.
// Uso: NODE_PATH=<pasta com node_modules/playwright> node tools/arte3d-render.cjs [filtro: bust|insignia|world|layout|logo]
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const root = path.resolve(__dirname, '..'); fs.mkdirSync(root + '/dist/arte3d', { recursive: true }); const only = process.argv[2]; const onlyRace = process.argv[3]; // 4.2f: ex.: head tessara
const RACES = ['vehnar', 'erevane', 'tessara', 'quorith', 'vorag']; const jobs = [];
for (const r of RACES) for (const v of [1, 2, 3]) { jobs.push(['bust', r, v, 520, 620]); jobs.push(['insignia', r, v, 520, 520]); jobs.push(['world', r, v, 960, 600]); }
for (const v of [1, 2, 3]) { jobs.push(['layout', '-', v, 1040, 520]); jobs.push(['logo', '-', v, 1040, 400]); jobs.push(['belt', '-', v, 1040, 520]); jobs.push(['emblem', '-', v, 720, 720]); }
for (const r of RACES) for (const v of [1, 2, 3]) { jobs.push(['head', r, v, 640, 640]); jobs.push(['postal', r, v, 960, 600]); }
for (const v of [1, 2, 3, 4, 5, 6]) jobs.push(['emblem2', '-', v, 720, 720]);
jobs.push(['hero', '-', 3, 3840, 1920]); for (const v of [1, 2]) jobs.push(['emblem3', '-', v, 1024, 1024]);
// 4.3l: 'carregamento' = Postal Dia (a variante 1, a aprovada em assets/world-*.jpg) em 2560x1440, com semente fixa, em assets/load-<raça>.webp
const LOAD = only === 'carregamento'; if (LOAD) { jobs.length = 0; for (const r of RACES) if (!onlyRace || r === onlyRace) jobs.push(['postal', r, 1, 2560, 1440]); }
(async () => { const b = await chromium.launch({ headless: true, args: ['--no-sandbox', '--allow-file-access-from-files', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-dev-shm-usage'] });
  const p = await b.newPage(); p.setDefaultTimeout(180000); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
  await p.goto('file://' + root + '/tools/arte3d.html'); await p.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });
  let ok = 0; const t0 = Date.now();
  for (const j of jobs) { if (only && !LOAD && j[0] !== only) continue; if (onlyRace && j[1] !== onlyRace) continue; const t = Date.now(); const d = await p.evaluate(jj => window.render3d(...jj), LOAD ? j.concat([{ seed: 4300 + RACES.indexOf(j[1]), type: 'image/webp', q: 0.86 }]) : j); const name = LOAD ? 'load-' + j[1] + '.webp' : j[0] + '_' + j[1] + '_' + j[2] + '.jpg';
    if (typeof d === 'string' && d.startsWith('data:')) { fs.writeFileSync(LOAD ? root + '/assets/' + name : root + '/dist/arte3d/' + name, Buffer.from(d.split(',')[1], 'base64')); ok++; console.log(name.padEnd(28), ((Date.now() - t) / 1000).toFixed(1) + 's'); } else console.log(name.padEnd(28), 'FALHOU', String(d).slice(0, 300)); }
  console.log('renderizados:', ok, 'em', ((Date.now() - t0) / 1000).toFixed(0) + 's', '| erros de página:', errs.slice(0, 5).join(' | ') || 'nenhum'); await b.close(); })();
