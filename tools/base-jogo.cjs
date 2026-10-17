// 4.3f — a base de uma Raça dentro da partida: gera as construções da Raça (grade 3 × 3) e um trecho de muro com portão perto do Núcleo,
// pausa e fotografa em zoom 1 (versão leve longe), 2,2, 3,5, na câmera de cinema e de perto do Núcleo.
// DANO=1: metade das construções com avaria (metade da vida e 20% da vida). RUINA=0.4,1.2,6: destrói as construções e fotografa a queda nesses instantes (s).
// DEFS=a,b troca a lista; SKIN=1|2 troca o estilo do Núcleo; OBRA=1 deixa as construções em obra (25%, 55% e 85%) para ver a assinatura da Raça.
// Uso: NODE_PATH=<playwright> node tools/base-jogo.cjs <raça> <pasta_saida> [tag] [cenas=z1,z22,z35,cine,nucleo] [extra_query]
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path'); const root = path.resolve(__dirname, '..');
const [race = 'vehnar', OUT = 'dist/base', TAG = 'base', LIST = 'z1,z22,z35,cine,nucleo', EXTRA = ''] = process.argv.slice(2); fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--allow-file-access-from-files', '--disable-dev-shm-usage'] });
  const p = await b.newPage({ viewport: { width: +(process.env.VW || 1280), height: +(process.env.VH || 720) } }); p.setDefaultTimeout(2400000); const T0 = Date.now(); const log = m => console.error('[' + ((Date.now() - T0) / 1000).toFixed(0) + ' s] ' + m); /* progresso no stderr: a máquina pode estar carregada */
  const errs = []; p.on('pageerror', e => errs.push('pageerror: ' + e.message.slice(0, 300))); p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 300)); });
  await p.goto('file://' + root + '/dist/local.html?autostart=1&seed=42&opp=1&faction=' + race + '&debug=1&dia=1&q=alta' + EXTRA, { waitUntil: 'load' });
  log('carregando'); await p.waitForFunction(() => window.__ARDG && document.getElementById('loading').hidden, null, { polling: 1000 });
  log('partida no ar'); await p.waitForFunction(() => window.__ARDG.sim.time > 0.3, null, { polling: 500 }); log('simulação andando');
  const info = await p.evaluate(({ DEFS, DANO, SKIN, OBRA }) => { const G = window.__ARDG, sim = G.sim, S = ARD.sim; G.view.reveal = true; G.speed = 0;
    for (const id of ['hints', 'panel', 'right', 'leader', 'top', 'quick', 'alerts', 'objectives', 'comms']) { const el = document.getElementById(id); if (el) el.style.visibility = 'hidden'; }
    if (SKIN && G.R.skins) G.R.skins[G.human] = SKIN;
    const n0 = S.nucleoOf(sim, G.human); const defs = DEFS || ['reator', 'refinaria', 'quartel', 'fabrica', 'hangar', 'laboratorio', 'torre', 'nodulo', 'bastiao'];
    const cx = n0.x + 170, cy = n0.y - 100; const out = [];
    defs.forEach((d, i) => { if (!S.BUILDINGS[d]) return; const bx = cx + (i % 3) * 112, by = cy + Math.floor(i / 3) * 112; const e = S.addBuilding(sim, G.human, d, bx, by, !OBRA); if (OBRA) e.progress = [0.25, 0.55, 0.85][i % 3]; if (DANO && i % 2) e.hp = e.maxHp * (i % 4 === 1 ? 0.5 : 0.2); out.push([d, e.id]); });
    for (let k = 0; k < 7; k++) { const d = k === 3 ? 'portao' : 'muro'; const e = S.addBuilding(sim, G.human, d, cx - 80, cy - 50 + k * 20, true); e.ang = Math.PI / 2; out.push([d, e.id]); }
    window.__bc = [cx + 112, cy + 112]; window.__nc = [n0.x, n0.y]; window.__ids = out.map(o => o[1]);
    return { is3d: !!G.R.is3d, defs: out.map(o => o[0]) }; }, { DEFS: process.env.DEFS ? process.env.DEFS.split(',') : null, DANO: process.env.DANO === '1', SKIN: +(process.env.SKIN || 0), OBRA: process.env.OBRA === '1' });
  if (!info.is3d) { console.error('RENDER 3D NÃO SUBIU'); process.exit(2); }
  const SC = { z1: [1, 0.95, Math.PI / 4, 'b'], z22: [2.2, 0.95, Math.PI / 4, 'b'], z35: [3.5, 0.95, Math.PI / 4, 'b'], cine: [4.4, 0.95, Math.PI * 0.72, 'b'], nucleo: [2.6, 0.95, Math.PI * 0.3, 'n'] };
  const frames = async n => { const f0 = await p.evaluate(() => (window.__ARDG.R.glInfo() || {}).frame || 0); await p.waitForFunction(([f0, n]) => ((window.__ARDG.R.glInfo() || {}).frame || 0) >= f0 + n, [f0, n], { timeout: 2400000, polling: 300 }); };
  const aim = s => p.evaluate(({ s }) => { const G = window.__ARDG; const c = G.view.cam; const f = s[3] === 'n' ? window.__nc : window.__bc; c.x = f[0]; c.y = f[1]; c.zoom = s[0]; c.pitch = c.pitchT = s[1]; c.yaw = s[2]; }, { s });
  for (const name of LIST.split(',')) { const s = SC[name]; if (!s) continue; await aim(s); await frames(4); await p.screenshot({ path: `${OUT}/${TAG}-${name}.png` }); log('cena ' + name); }
  if (process.env.RUINA) { /* destrói as construções (menos o Núcleo) e fotografa a queda em cada instante pedido, na vista de 2,2 */
    await aim(SC.z22); await frames(2);
    await p.evaluate(() => { const G = window.__ARDG, sim = G.sim, S = ARD.sim; const before = sim.events.length; for (const id of window.__ids) { const e = sim.byId.get(id); if (e && e.alive) S.kill(sim, e, -1); } G.R.onEvents(sim.events.slice(before), sim, G.human); });
    for (const t of process.env.RUINA.split(',').map(Number)) { await p.evaluate(t => { window.__ARDG.R.ruinT = t; }, t); await frames(2); await p.screenshot({ path: `${OUT}/${TAG}-ruina-${t}.png` }); } await p.evaluate(() => { window.__ARDG.R.ruinT = null; }); }
  const gl = await p.evaluate(() => window.__ARDG.R.glInfo ? window.__ARDG.R.glInfo() : null);
  console.log(JSON.stringify({ info, gl, errs: errs.slice(0, 6) }));
  await b.close();
})().catch(e => { console.error('HARNESS FAIL', e.message); process.exit(1); });
