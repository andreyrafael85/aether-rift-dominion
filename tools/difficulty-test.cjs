// Validação das dificuldades (4.1a): um jogador de referência (IA com os parâmetros do antigo Normal, no lugar do humano,
// sem bônus de renda) enfrenta a IA de cada nível em 1v1. Mede vitórias, ritmo de construção, exército e o primeiro ataque.
// Uso: node tools/difficulty-test.cjs <dificuldade> [partidas=6] [minutos=18]  → uma linha JSON por partida
const path = require('path'); const root = path.resolve(__dirname, '..');
globalThis.ARD = {}; require(root + '/src/sim.js'); require(root + '/src/ai.js'); const S = ARD.sim, AI = ARD.ai;
const diff = process.argv[2] || 'normal', N = +(process.argv[3] || 6), minutes = +(process.argv[4] || 18);
const PROXY = { name: 'Defensor', income: 1, attackAt: 1e9, minAttack: 1e9, acceptP: 0, breakP: 0, pirateEvery: 1e9, reserve: 150, buildEvery: 8, attackFrac: 0, research: 2, superweapon: false, maxProd: 2 }; // jogador iniciante e defensivo: constrói, defende, nunca ataca
const R = ['vehnar', 'erevane', 'tessara', 'quorith', 'vorag'];
for (let k = 0; k < N; k++) {
  const ra = R[k % 5], rb = ra; // Raças espelhadas: só a dificuldade muda
  const sim = S.createSim({ seed: 3100 + k * 17, players: [{ name: 'Ref', faction: ra, human: true }, { name: 'IA', faction: rb, difficulty: diff }], minutes });
  const ref = AI.create(0, 'normal'); ref.diff = PROXY; const ai = AI.create(1, diff); const m = { firstAttack: null, b300: null, a480: null, a300: null, peak: 0, fell: null };
  for (let i = 0; i < minutes * 600 && !sim.result; i++) { if (sim.tick % 10 === 0) { for (const c of AI.think(sim, ref)) S.enqueue(sim, c); for (const c of AI.think(sim, ai)) S.enqueue(sim, c); if (m.firstAttack == null && ai.mode === 'attack') m.firstAttack = Math.round(sim.time); if (m.firstAttack == null) m.peak = Math.max(m.peak, S.armyValue(sim, 1)); }
    S.step(sim); if (m.b300 == null && sim.time >= 300) m.b300 = S.entitiesOf(sim, 1).filter(e => e.kind === 'building').length; if (m.a480 == null && sim.time >= 480) m.a480 = S.armyValue(sim, 1); if (m.a300 == null && sim.time >= 300) m.a300 = S.armyValue(sim, 1); if (m.fell == null && !sim.players[0].alive) m.fell = Math.round(sim.time); }
  const sc = sim.players.map(p => ({ id: p.id, s: p.alive ? S.score(sim, p) : -1 })); let win = 'empate'; if (!sim.players[1].alive) win = 'ref'; else if (!sim.players[0].alive) win = 'ia'; else if (sc[0].s > sc[1].s * 1.15) win = 'ref'; else if (sc[1].s > sc[0].s * 1.15) win = 'ia';
  console.log(JSON.stringify({ diff, ra, rb, win, t: Math.round(sim.time), firstAttack: m.firstAttack, b300: m.b300, a300: m.a300, a480: m.a480, peak: m.peak, fell: m.fell }));
}
