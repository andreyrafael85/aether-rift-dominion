/* Laço determinístico IA x IA compartilhado entre Node e navegadores (usado por tools/det-test.cjs):
   mesma semente e mesmos comandos em todo motor JS; devolve o hash do estado a cada 10 ticks. */
(function (g) {
  g.ARD_DET = function (seed, ticks) {
    const S = g.ARD.sim, AI = g.ARD.ai;
    const players = [{ name: 'A', faction: 'vehnar', difficulty: 'normal' }, { name: 'B', faction: 'erevane', difficulty: 'normal' }, { name: 'C', faction: 'quorith', difficulty: 'normal' }, { name: 'D', faction: 'vorag', difficulty: 'normal' }]; // 4.0c: as Raças novas entram no teste entre motores
    const sim = S.createSim({ seed, players, minutes: 25 });
    const ais = sim.players.map(p => AI.create(p.id, p.difficulty));
    const out = [];
    for (let t = 0; t < ticks; t++) {
      if (sim.tick % 10 === 0) for (const a of ais) for (const c of AI.think(sim, a)) S.enqueue(sim, c);
      S.step(sim);
      if (sim.tick % 10 === 0) out.push(sim.tick + ':' + S.hash(sim));
      if (sim.result) break;
    }
    return out;
  };
})(globalThis);
