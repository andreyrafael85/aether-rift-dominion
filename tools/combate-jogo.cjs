// 4.3g — batalha na partida: dois exércitos (Raças A e B) frente a frente perto do Núcleo de A; a simulação anda um passo (TICK) por quadro
// desenhado, com o tempo dos efeitos fixo, para fotografar traçantes, feixes, projéteis, clarões e explosões no meio do voo.
// Uso: NODE_PATH=<playwright> node tools/combate-jogo.cjs <raçaA> <raçaB> <pasta_saida> [tag] [cenas=z22,cine]
// env: PASSOS=24 (passos antes da 1ª foto), ENTRE=3 (passos entre fotos), NOITE=1 (noite), EXERCITO=misto|inf|vei|tudo, VW/VH, EXTRA='&sem=...', ESCUDO=1 (Uníssono no lado B)
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path'); const root = path.resolve(__dirname, '..');
const [A = 'vehnar', B = 'vorag', OUT = 'dist/combate', TAG = 'combate', LIST = 'z22,cine'] = process.argv.slice(2); fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--allow-file-access-from-files', '--disable-dev-shm-usage'] });
  const p = await b.newPage({ viewport: { width: +(process.env.VW || 1280), height: +(process.env.VH || 720) } }); p.setDefaultTimeout(2400000);
  const errs = []; p.on('pageerror', e => errs.push('pageerror: ' + e.message.slice(0, 300))); p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 300)); });
  const T0 = Date.now(); const log = m => console.error('[' + ((Date.now() - T0) / 1000).toFixed(0) + ' s] ' + m);
  await p.goto('file://' + root + '/dist/local.html?autostart=1&seed=42&opp=4&faction=' + A + '&debug=1&q=alta' + (process.env.NOITE === '1' ? '&noite=1' : '&dia=1') + (process.env.EXTRA || ''), { waitUntil: 'load' });
  await p.waitForFunction(() => window.__ARDG && document.getElementById('loading').hidden, null, { polling: 1000 }); log('partida no ar');
  const info = await p.evaluate(({ B, EX, NOITE, ESC }) => { const G = window.__ARDG, sim = G.sim, S = ARD.sim; G.view.reveal = true; G.speed = 0; if (NOITE) { G.R.forceDay = false; sim.tick = Math.round(375 / S.TICK); sim.time = sim.tick * S.TICK; } /* meia-noite do ciclo de 750 s (o passo recalcula o tempo pelo contador) */
    for (const id of ['hints', 'panel', 'right', 'leader', 'top', 'quick', 'alerts', 'objectives', 'comms']) { const el = document.getElementById(id); if (el) el.style.visibility = 'hidden'; }
    const pa = sim.players[G.human], pb = sim.players.find(q => q.faction === B && q.id !== G.human) || sim.players.find(q => q.id !== G.human);
    const n0 = S.nucleoOf(sim, G.human); const cx = n0.x + 230, cy = n0.y + 40; window.__c = [cx, cy];
    const army = fac => { const own = Object.keys(S.UNITS).filter(d => S.UNITS[d].faction === fac && S.UNITS[d].cls !== 'col' && d !== 'catedral' && d !== 'matriarca' && S.UNITS[d].weapon); const gen = ['infantaria', 'veiculo', 'drone', 'suporte'];
      const all = gen.concat(own.filter(d => !gen.includes(d))); if (EX === 'inf') return all.filter(d => S.UNITS[d].cls === 'inf'); if (EX === 'vei') return all.filter(d => S.UNITS[d].cls !== 'inf'); if (EX === 'tudo') return all; return all.slice(0, 7); };
    const out = { A: pa.faction, B: pb.faction, units: [] };
    for (const [pl, side] of [[pa, -1], [pb, 1]]) { const defs = army(pl.faction); defs.forEach((d, i) => { for (let j = 0; j < 2; j++) { const x = cx + side * (62 + (i % 2) * 26 + j * 14), y = cy + (i - defs.length / 2) * 24 + j * 9; const u = S.spawnUnit(sim, pl.id, d, x, y); if (u) { u.px = u.x; u.py = u.y; u.ang = side > 0 ? Math.PI : 0; out.units.push(pl.faction + ':' + d); } } }); }
    if (ESC) pb.unissonoT = 18; /* escudo do Uníssono no lado B */ G.R.fixedDt = S.TICK; return out; }, { B, EX: process.env.EXERCITO || 'misto', NOITE: process.env.NOITE === '1', ESC: process.env.ESCUDO === '1' });
  log('exércitos: ' + info.A + ' × ' + info.B + ' (' + info.units.length + ' unidades)');
  const frames = async n => { const f0 = await p.evaluate(() => (window.__ARDG.R.glInfo() || {}).frame || 0); await p.waitForFunction(([f0, n]) => ((window.__ARDG.R.glInfo() || {}).frame || 0) >= f0 + n, [f0, n], { polling: 200 }); };
  const step = async n => { for (let i = 0; i < n; i++) { await p.evaluate(() => { const G = window.__ARDG, sim = G.sim, S = ARD.sim; const ev = S.step(sim); G.R.onEvents(ev || [], sim, G.human); }); await frames(1); } };
  const SC = { z1: [1, 0.95, Math.PI / 4], z22: [2.2, 0.95, Math.PI / 4], z35: [3.5, 0.95, Math.PI / 4], cine: [4.4, 0.95, Math.PI * 0.72], lado: [3.2, 0.95, Math.PI * 0.5] };
  await p.evaluate(s => { const c = window.__ARDG.view.cam; c.x = window.__c[0]; c.y = window.__c[1]; c.zoom = s[0]; c.pitch = c.pitchT = s[1]; c.yaw = s[2]; }, SC.z22);
  await step(+(process.env.PASSOS || 24)); log('combate andando');
  let k = 0; for (const name of LIST.split(',')) { const s = SC[name]; if (!s) continue; await p.evaluate(s => { const c = window.__ARDG.view.cam; c.zoom = s[0]; c.pitch = c.pitchT = s[1]; c.yaw = s[2]; }, s); await step(+(process.env.ENTRE || 3)); await p.screenshot({ path: `${OUT}/${TAG}-${name}.png` }); log('foto ' + name); k++; }
  const gl = await p.evaluate(() => window.__ARDG.R.glInfo ? window.__ARDG.R.glInfo() : null);
  console.log(JSON.stringify({ info: { A: info.A, B: info.B, n: info.units.length }, gl, errs: errs.slice(0, 6) }));
  await b.close();
})().catch(e => { console.error('HARNESS FAIL', e.message); process.exit(1); });
