// 4.3e — infantaria das cinco Raças na partida (esquadrões), com e sem dano; fotografa em zoom 1, 3,5 e na câmera de cinema.
// Uso: NODE_PATH=<playwright> node tools/tropa-jogo.cjs <pasta_saida> [tag] [cenas=z1,z35,cine] [extra_query] [raça=todas]
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path'); const root = path.resolve(__dirname, '..');
const [OUT = 'dist/tropa', TAG = 'tropa', LIST = 'z1,z35,cine', EXTRA = '', RACE = ''] = process.argv.slice(2); fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--allow-file-access-from-files', '--disable-dev-shm-usage'] });
  const p = await b.newPage({ viewport: { width: +(process.env.VW || 1280), height: +(process.env.VH || 720) } }); p.setDefaultTimeout(600000);
  const errs = []; p.on('pageerror', e => errs.push('pageerror: ' + e.message.slice(0, 300))); p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 300)); });
  await p.goto('file://' + root + '/dist/local.html?autostart=1&seed=42&opp=4&faction=' + (RACE || 'vehnar') + '&debug=1&dia=1&q=alta' + EXTRA, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__ARDG && document.getElementById('loading').hidden);
  const info = await p.evaluate(RACE => { const G = window.__ARDG, sim = G.sim, S = ARD.sim; G.view.reveal = true; G.speed = 0;
    for (const id of ['hints', 'panel', 'right', 'leader', 'top', 'quick', 'alerts', 'objectives', 'comms']) { const el = document.getElementById(id); if (el) el.style.visibility = 'hidden'; }
    const n0 = S.nucleoOf(sim, G.human); const cx = n0.x + 200, cy = n0.y + 20; const out = [];
    const players = RACE ? [sim.players[G.human]] : sim.players;
    players.forEach((pl, k) => { const defs = ['infantaria'].concat(Object.keys(S.UNITS).filter(d => S.UNITS[d].faction === pl.faction && S.UNITS[d].cls === 'inf'));
      defs.forEach((d, i) => { for (let j = 0; j < 2; j++) { const x = cx + (i - 1) * 46 + j * 22, y = cy + (k - (players.length - 1) / 2) * 52; const u = S.spawnUnit(sim, pl.id, d, x, y); if (u) { u.px = u.x; u.py = u.y; u.ang = -Math.PI / 4; if (j) u.hp = u.maxHp * 0.5; out.push([pl.faction, d]); } } }); });
    window.__tc = [cx + 20, cy]; return { is3d: !!G.R.is3d, n: out.length }; }, RACE);
  if (!info.is3d) { console.error('RENDER 3D NÃO SUBIU'); process.exit(2); }
  const SC = { z1: [1, 0.95, Math.PI / 4], z35: [3.5, 0.95, Math.PI / 4], cine: [4.6, 0.95, Math.PI * 0.72], z6: [6, 0.95, Math.PI * 0.3] };
  for (const name of LIST.split(',')) { const s = SC[name]; if (!s) continue;
    await p.evaluate(({ s }) => { const G = window.__ARDG; const c = G.view.cam; c.x = window.__tc[0]; c.y = window.__tc[1]; c.zoom = s[0]; c.pitch = c.pitchT = s[1]; c.yaw = s[2]; }, { s });
    const f0 = await p.evaluate(() => (window.__ARDG.R.glInfo() || {}).frame || 0); await p.waitForFunction(f0 => ((window.__ARDG.R.glInfo() || {}).frame || 0) >= f0 + 4, f0, { timeout: 600000, polling: 500 });
    await p.screenshot({ path: `${OUT}/${TAG}-${name}.png` }); }
  console.log(JSON.stringify({ info, errs: errs.slice(0, 6) }));
  await b.close();
})().catch(e => { console.error('HARNESS FAIL', e.message); process.exit(1); });
