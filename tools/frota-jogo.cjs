// 4.3d — a frota de uma Raça dentro da partida (terreno, luz, pós, sombras): gera as unidades da Raça perto da base,
// pausa e fotografa em zoom 1 (visão padrão: versão leve), zoom 3,5 (versão completa) e na câmera de cinema.
// Uso: NODE_PATH=<playwright> node tools/frota-jogo.cjs <raça> <pasta_saida> [tag] [cenas=z1,z35,cine] [extra_query]
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path'); const root = path.resolve(__dirname, '..');
const [race = 'vehnar', OUT = 'dist/frota', TAG = 'frota', LIST = 'z1,z35,cine', EXTRA = ''] = process.argv.slice(2); fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--allow-file-access-from-files', '--disable-dev-shm-usage'] });
  const p = await b.newPage({ viewport: { width: +(process.env.VW || 1280), height: +(process.env.VH || 720) } }); p.setDefaultTimeout(600000);
  const errs = []; p.on('pageerror', e => errs.push('pageerror: ' + e.message.slice(0, 300))); p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 300)); });
  await p.goto('file://' + root + '/dist/local.html?autostart=1&seed=42&opp=1&faction=' + race + '&debug=1&dia=1&q=alta' + EXTRA, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__ARDG && document.getElementById('loading').hidden);
  await p.waitForFunction(() => window.__ARDG.sim.time > 0.3);
  const info = await p.evaluate(() => { const G = window.__ARDG, sim = G.sim, S = ARD.sim; G.view.reveal = true; G.speed = 0;
    for (const id of ['hints', 'panel', 'right', 'leader', 'top', 'quick', 'alerts', 'objectives', 'comms']) { const el = document.getElementById(id); if (el) el.style.visibility = 'hidden'; }
    const me = sim.players[G.human]; const n0 = S.nucleoOf(sim, G.human); const fac = me.faction;
    const defs = ['veiculo', 'drone', 'suporte', 'pirata'].concat(Object.keys(S.UNITS).filter(d => S.UNITS[d].faction === fac && S.UNITS[d].cls !== 'inf' && d !== 'catedral' && d !== 'matriarca'));
    const cx = n0.x + 210, cy = n0.y + 30; const out = [];
    defs.forEach((d, i) => { const a = (i / defs.length) * Math.PI * 2, rr = 70; const u = S.spawnUnit(sim, G.human, d, cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); if (u) { u.px = u.x; u.py = u.y; u.ang = a + Math.PI / 2; out.push([d, u.id]); } });
    window.__fc = [cx, cy]; return { is3d: !!G.R.is3d, defs: out }; });
  if (!info.is3d) { console.error('RENDER 3D NÃO SUBIU'); process.exit(2); }
  const SC = { z1: [1, 0.95, Math.PI / 4], z35: [3.5, 0.95, Math.PI / 4], cine: [4.4, 0.95, Math.PI * 0.72], z6: [5.6, 0.95, Math.PI * 0.3] };
  for (const name of LIST.split(',')) { const s = SC[name]; if (!s) continue;
    await p.evaluate(({ s }) => { const G = window.__ARDG; const c = G.view.cam; c.x = window.__fc[0]; c.y = window.__fc[1]; c.zoom = s[0]; c.pitch = c.pitchT = s[1]; c.yaw = s[2]; }, { s });
    await p.waitForTimeout(3500); await p.screenshot({ path: `${OUT}/${TAG}-${name}.png` }); }
  const gl = await p.evaluate(() => window.__ARDG.R.glInfo ? window.__ARDG.R.glInfo() : null);
  console.log(JSON.stringify({ info, gl, errs: errs.slice(0, 6) }));
  await b.close();
})().catch(e => { console.error('HARNESS FAIL', e.message); process.exit(1); });
