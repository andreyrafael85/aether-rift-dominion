// Self-play de balanceamento (4.0c): partidas IA x IA 1v1 entre Raças, mesma dificuldade, até N minutos.
// Uso: node tools/selfplay.cjs <raçaA> <raçaB> [sementes=4] [minutos=20] [dificuldade=normal]  → uma linha JSON por partida
const path = require('path'); const root = path.resolve(__dirname, '..');
globalThis.ARD = {}; require(root + '/src/sim.js'); require(root + '/src/ai.js'); const S = ARD.sim, AI = ARD.ai;
const [a, b] = process.argv.slice(2); const seeds = +(process.argv[4] || 4), minutes = +(process.argv[5] || 20), diff = process.argv[6] || 'normal';
if (!S.FACTIONS[a] || !S.FACTIONS[b]) { console.error('Raças: ' + Object.keys(S.FACTIONS).join(', ')); process.exit(2); }
for (let k = 0; k < seeds; k++) {
  const seed = 1000 + k * 37 + (a + b).length; const first = k % 2 === 0 ? a : b, second = first === a ? b : a; // alterna o lado para não viciar pela posição inicial
  const sim = S.createSim({ seed, players: [{ name: first, faction: first, difficulty: diff }, { name: second, faction: second, difficulty: diff }], minutes });
  const ais = sim.players.map(p => AI.create(p.id, p.difficulty)); const t0 = Date.now(); const sup = {};
  for (let i = 0; i < minutes * 600; i++) { if (i % 10 === 0) for (const ai of ais) for (const c of AI.think(sim, ai)) S.enqueue(sim, c); for (const e of S.step(sim)) if (e.t === 'super') sup[e.kind] = (sup[e.kind] || 0) + 1; if (sim.result) break; }
  const alive = sim.players.filter(p => p.alive); let winner = alive.length === 1 ? alive[0].faction : null; let how = winner ? 'eliminação' : 'tempo';
  if (!winner) { const sc = sim.players.map(p => ({ f: p.faction, s: S.score(sim, p) })); sc.sort((x, y) => y.s - x.s); winner = sc[0].s > sc[1].s * 1.15 ? sc[0].f : 'empate'; }
  const st = {}; for (const p of sim.players) st[p.faction] = { army: S.armyValue(sim, p.id), kills: p.stats.unitsKilled, lost: p.stats.unitsLost, res: Math.round(p.res.minerio) + '/' + Math.round(p.res.plasma) + '/' + Math.round(p.res.dados), bld: S.entitiesOf(sim, p.id).filter(e => e.kind === 'building').length };
  console.log(JSON.stringify({ a, b, seed, winner, how, t: Math.round(sim.time), ms: Date.now() - t0, sup, st }));
}
