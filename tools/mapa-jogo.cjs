// 4.3h — o mapa na partida: fotografa vistas fixas (do alto, a base, a borda de uma plataforma, uma ponte, um lago, câmera de cinema)
// para julgar o Cinturão, os lagos, o clima e a tempestade.
// Uso: NODE_PATH=<playwright> node tools/mapa-jogo.cjs <mapa=fenda|cinturao> <pasta_saida> [tag] [cenas=alto,base,borda,ponte,lago,cine] [extra_query]
// env: LAGO=plasma|gelo (qual lago a vista 'lago' mostra), NOITE=1 (noite), CLIMA=<auto|toxica|plasma|cristais|aurora|acida>, TEMPESTADE=1 (Tempestade de Éter ativa no centro da vista), OPP=2, VW/VH
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path'); const root = path.resolve(__dirname, '..');
const [MAPA = 'cinturao', OUT = 'dist/mapa', TAG = 'mapa', LIST = 'alto,base,borda,ponte,lago,cine', EXTRA = ''] = process.argv.slice(2); fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--allow-file-access-from-files', '--disable-dev-shm-usage'] });
  const p = await b.newPage({ viewport: { width: +(process.env.VW || 1280), height: +(process.env.VH || 720) } }); p.setDefaultTimeout(2400000);
  const errs = []; p.on('pageerror', e => errs.push('pageerror: ' + e.message.slice(0, 300))); p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 300)); });
  const T0 = Date.now(); const log = m => console.error('[' + ((Date.now() - T0) / 1000).toFixed(0) + ' s] ' + m);
  const q = '?autostart=1&seed=42&opp=' + (process.env.OPP || '2') + '&faction=vehnar&debug=1&q=alta&mapa=' + MAPA + (process.env.NOITE === '1' ? '&noite=1' : '&dia=1') + (process.env.CLIMA ? '&clima=' + process.env.CLIMA : '') + EXTRA;
  await p.goto('file://' + root + '/dist/local.html' + q, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__ARDG && document.getElementById('loading').hidden, null, { polling: 1000 }); log('partida no ar');
  const info = await p.evaluate(({ NOITE, TEMP, LAGO }) => { const G = window.__ARDG, sim = G.sim, S = ARD.sim; G.view.reveal = true; G.speed = 0; G.R.fixedDt = S.TICK;
    if (NOITE) { G.R.forceDay = false; sim.tick = Math.round(375 / S.TICK); sim.time = sim.tick * S.TICK; }
    for (const id of ['hints', 'panel', 'right', 'leader', 'top', 'quick', 'alerts', 'objectives', 'comms']) { const el = document.getElementById(id); if (el) el.style.visibility = 'hidden'; }
    const n0 = S.nucleoOf(sim, G.human), m = sim.map || { type: 'fenda', lakes: [] }; const V = {};
    V.alto = [S.CX, S.CY, 0.5, 1.05, Math.PI / 4]; V.base = [n0.x, n0.y, 1, 0.95, Math.PI / 4];
    const toC = Math.atan2(S.CY - n0.y, S.CX - n0.x); V.borda = [n0.x + Math.cos(toC + 0.9) * 420, n0.y + Math.sin(toC + 0.9) * 420, 2.2, 0.9, Math.PI * 0.3];
    if (m.bridges && m.bridges.length) { const br = m.bridges[0]; V.ponte = [(br[0] + br[2]) / 2, (br[1] + br[3]) / 2, 2.4, 0.85, Math.PI * 0.6]; } else V.ponte = [S.CX + 520, S.CY, 2.2, 0.9, Math.PI / 4];
    const lk = m.lakes && m.lakes.length ? m.lakes.filter(k => !LAGO || k.kind === LAGO).sort((a, b2) => Math.hypot(a.x - n0.x, a.y - n0.y) - Math.hypot(b2.x - n0.x, b2.y - n0.y))[0] : null; V.lago = lk ? [lk.x, lk.y, 2.6, 0.8, Math.PI * 0.35] : V.base;
    V.cine = [n0.x + Math.cos(toC - 0.6) * 380, n0.y + Math.sin(toC - 0.6) * 380, 4.4, 0.95, Math.PI * 0.72];
    if (TEMP) { S.forceStorm(sim, n0.x + Math.cos(toC) * 500, n0.y + Math.sin(toC) * 500, 0, 120, 420); const st = sim.storm; st.phase = 'active'; st.t = 5; G.R.onEvents([{ t: 'storm', phase: 'active', x: st.x, y: st.y, r: st.r }], sim, G.human); V.tempestade = [st.x, st.y, 0.9, 0.95, Math.PI / 4]; V.tempestadeCine = [st.x + 200, st.y + 120, 3.2, 0.9, Math.PI * 0.62]; }
    window.__V = V; return { mapa: m.type, lagos: (m.lakes || []).map(k => k.kind + Math.round(k.r)), vistas: Object.keys(V) }; }, { NOITE: process.env.NOITE === '1', TEMP: process.env.TEMPESTADE === '1', LAGO: process.env.LAGO || '' });
  log(JSON.stringify(info));
  const frames = async n => { const f0 = await p.evaluate(() => (window.__ARDG.R.glInfo() || {}).frame || 0); await p.waitForFunction(([f0, n]) => ((window.__ARDG.R.glInfo() || {}).frame || 0) >= f0 + n, [f0, n], { polling: 200 }); };
  const list = LIST.split(','); if (process.env.TEMPESTADE === '1' && !list.includes('tempestade')) list.push('tempestade', 'tempestadeCine');
  for (const name of list) { const ok = await p.evaluate(name => { const v = window.__V[name]; if (!v) return false; const c = window.__ARDG.view.cam; c.x = v[0]; c.y = v[1]; c.zoom = v[2]; c.pitch = c.pitchT = v[3]; c.yaw = v[4]; return true; }, name); if (!ok) continue; await frames(4); await p.screenshot({ path: `${OUT}/${TAG}-${name}.png` }); log('foto ' + name); }
  const gl = await p.evaluate(() => window.__ARDG.R.glInfo ? window.__ARDG.R.glInfo() : null);
  console.log(JSON.stringify({ info, gl, errs: errs.slice(0, 6) }));
  await b.close();
})().catch(e => { console.error('HARNESS FAIL', e.message); process.exit(1); });
