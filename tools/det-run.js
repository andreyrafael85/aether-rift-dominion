/* Laço determinístico IA x IA compartilhado entre Node e navegadores (usado por tools/det-test.cjs):
   mesma semente e mesmos comandos em todo motor JS; devolve o hash do estado a cada 10 ticks. */
(function (g) {
  g.ARD_DET = function (seed, ticks) {
    const S = g.ARD.sim, AI = g.ARD.ai;
    const run = (players, extra, n, tag) => {
      const sim = S.createSim(Object.assign({ seed, players, minutes: 25 }, extra));
      const ais = sim.players.filter(p => !p.fenda).map(p => AI.create(p.id, p.difficulty)); /* 5.0g: ninguém pensa pela Fenda */
      const out = [];
      for (let t = 0; t < n; t++) {
        if (sim.tick % 10 === 0) for (const a of ais) for (const c of AI.think(sim, a)) S.enqueue(sim, c);
        S.step(sim);
        if (sim.tick % 10 === 0) out.push(tag + sim.tick + ':' + S.hash(sim));
        if (sim.result) break;
      }
      return out;
    };
    const players = [{ name: 'A', faction: 'vehnar', difficulty: 'normal' }, { name: 'B', faction: 'erevane', difficulty: 'normal' }, { name: 'C', faction: 'quorith', difficulty: 'normal' }, { name: 'D', faction: 'vorag', difficulty: 'normal' }]; // 4.0c: as Raças novas entram no teste entre motores
    const belt = [{ name: 'T', faction: 'tessara', difficulty: 'normal' }, { name: 'V', faction: 'vehnar', difficulty: 'normal' }, { name: 'Q', faction: 'quorith', difficulty: 'normal' }];
    const out = run(players, {}, ticks, '').concat(run(belt, { map: 'cinturao', mapV: 1 }, Math.round(ticks / 2), 'cinturão ')); /* 4.3h: o Cinturão com lagos também entra no teste entre motores */
    if (g.ARD.chefesSim) { /* 5.0g: os chefões (o Arauto na Planície; a Forja-Mãe no Destroço do Titã) entram depois das partidas de sempre, que seguem com o hash da 5.0f */
      const duo = [{ name: 'E', faction: 'erevane', difficulty: 'dificil' }, { name: 'R', faction: 'vorag', difficulty: 'dificil' }];
      out.push.apply(out, run(players.slice(0, 3), { mapV: 1, chefe: 'arauto' }, Math.round(ticks / 2), 'arauto ').concat(run(duo, { map: 'tita', mapV: 1, chefe: 'forja' }, Math.round(ticks / 2), 'forja '))); }
    if (g.ARD.modos) { /* 5.0g: Eventos da Fenda (cada um começa aos 15 s com a chave de teste), os mutadores e a Caçada também entram no teste entre motores, depois das partidas de sempre */
      const M = ['noite', 'tempestades', 'escassos']; ['caravana', 'enxame', 'meteoros', 'sentinela'].forEach((ev, i) => { out.push.apply(out, run(players.slice(0, 3), { mapV: 1, eventosTeste: ev, mutadores: [M[i % 3]] }, 600, 'evento ' + ev + ' ')); });
      out.push.apply(out, run(belt.slice(0, 2), { mapV: 1, cacada: { chefe: 'arauto', dif: 'facil' } }, 600, 'caçada '));
      out.push.apply(out, run(players.slice(0, 3), { map: 'tita', mapV: 1, cacada: { chefe: 'forja', dif: 'brutal' } }, 900, 'caçada forja ')); } /* 5.0g.1: Caçada com 3 jogadores (a espinha gira) e o despertar (60 s na Brutal) dentro dos 900 tiques */
    return out;
  };
})(globalThis);
