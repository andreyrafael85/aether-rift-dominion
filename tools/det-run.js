/* Laço determinístico IA x IA compartilhado entre Node e navegadores (usado por tools/det-test.cjs):
   mesma semente e mesmos comandos em todo motor JS; devolve o hash do estado a cada 10 ticks. */
(function (g) {
  g.ARD_DET = function (seed, ticks, base) { /* 5.0h: base = campos a mais na cfg de toda partida (ex.: { iaPerfil: 'nulo' }, a IA de antes) */
    const S = g.ARD.sim, AI = g.ARD.ai;
    const run = (players, extra, n, tag, hook) => { /* 5.0h: hook(sim) antes de cada passo (roteiro sem estado, derivado da simulação) */
      const sim = S.createSim(Object.assign({ seed, players, minutes: 25 }, base || {}, extra));
      const ais = sim.players.filter(p => !p.fenda).map(p => AI.create(p.id, p.difficulty)); /* 5.0g: ninguém pensa pela Fenda */
      const out = [];
      for (let t = 0; t < n; t++) {
        if (sim.tick % 10 === 0) for (const a of ais) for (const c of AI.think(sim, a)) S.enqueue(sim, c);
        if (hook) hook(sim);
        S.step(sim);
        if (sim.tick % 10 === 0) out.push(tag + sim.tick + ':' + S.hash(sim));
        if (sim.result) break;
      }
      return out;
    };
    const players = [{ name: 'A', faction: 'vehnar', difficulty: 'normal' }, { name: 'B', faction: 'erevane', difficulty: 'normal' }, { name: 'C', faction: 'quorith', difficulty: 'normal' }, { name: 'D', faction: 'vorag', difficulty: 'normal' }]; // 4.0c: as Raças novas entram no teste entre motores
    const belt = [{ name: 'T', faction: 'tessara', difficulty: 'normal' }, { name: 'V', faction: 'vehnar', difficulty: 'normal' }, { name: 'Q', faction: 'quorith', difficulty: 'normal' }];
    const out = run(players, {}, ticks, '').concat(run(belt, { map: 'cinturao', mapV: 1 }, Math.round(ticks / 2), 'cinturão ')); /* 4.3h: o Cinturão com lagos também entra no teste entre motores */
    if (base && base.soBase) return out; /* 5.0h: só as partidas de sempre (o teste da IA de antes) */
    if (g.ARD.chefesSim) { /* 5.0g: os chefões (o Arauto na Planície; a Forja-Mãe no Destroço do Titã) entram depois das partidas de sempre, que seguem com o hash da 5.0f */
      const duo = [{ name: 'E', faction: 'erevane', difficulty: 'dificil' }, { name: 'R', faction: 'vorag', difficulty: 'dificil' }];
      out.push.apply(out, run(players.slice(0, 3), { mapV: 1, chefe: 'arauto' }, Math.round(ticks / 2), 'arauto ').concat(run(duo, { map: 'tita', mapV: 1, chefe: 'forja' }, Math.round(ticks / 2), 'forja '))); }
    if (g.ARD.modos) { /* 5.0g: Eventos da Fenda (cada um começa aos 15 s com a chave de teste), os mutadores e a Caçada também entram no teste entre motores, depois das partidas de sempre */
      const M = ['noite', 'tempestades', 'escassos']; ['caravana', 'enxame', 'meteoros', 'sentinela'].forEach((ev, i) => { out.push.apply(out, run(players.slice(0, 3), { mapV: 1, eventosTeste: ev, mutadores: [M[i % 3]] }, 600, 'evento ' + ev + ' ')); });
      out.push.apply(out, run(belt.slice(0, 2), { mapV: 1, cacada: { chefe: 'arauto', dif: 'facil' } }, 600, 'caçada '));
      out.push.apply(out, run(players.slice(0, 3), { map: 'tita', mapV: 1, cacada: { chefe: 'forja', dif: 'brutal' } }, 900, 'caçada forja ')); } /* 5.0g.1: Caçada com 3 jogadores (a espinha gira) e o despertar (60 s na Brutal) dentro dos 900 tiques */
    if (g.ARD.mundo) { /* 5.0h: Mundo vivo nos três mapas (fauna, ruínas, Corsários e surto com a chuva de meteoros), depois das partidas de sempre */
      out.push.apply(out, run(players.slice(0, 3), { mapV: 1, mundo: true }, 1200, 'mundo ').concat(run(belt, { map: 'cinturao', mapV: 1, mundo: true }, 900, 'mundo cinturão '), run([{ name: 'E', faction: 'erevane', difficulty: 'normal' }, { name: 'R', faction: 'vorag', difficulty: 'normal' }], { map: 'tita', mapV: 1, mundo: 'ruinas,fauna,surto' }, 900, 'mundo titã '))); }
    if (g.ARD.unicas) { /* 5.0h: comandantes em campo nas 5 Raças, com as 3 habilidades, uma única e um módulo por jogador (roteiro sem estado) */
      const todas = players.concat([{ name: 'T', faction: 'tessara', difficulty: 'normal' }]);
      const roteiro = sim => { if (sim.tick % 40 === 20) for (const p of sim.players) { const u = S.avatarDe(sim, p.id); if (!u) continue; const n = (sim.tick / 40 | 0) % 3, h = S.habDe(u)[n]; let alvo = null, best = 1e9;
          for (const e of sim.ents) if (e.alive && e.kind === 'unit' && e.owner >= 0 && e.owner !== p.id && sim.vis[p.id].has(e.id)) { const d = S.dist(u.x, u.y, e.x, e.y); if (d < best) { best = d; alvo = e; } }
          if (h.alvo !== 'proprio' && (!alvo || best > h.alcance)) continue; S.enqueue(sim, { t: 'habilidade', p: p.id, id: u.id, n, x: alvo ? alvo.x : u.x, y: alvo ? alvo.y : u.y, alvo: alvo ? alvo.id : null }); }
        if (sim.tick === 300) for (const p of sim.players) { const n = S.nucleoOf(sim, p.id); if (!n) continue; p.era = Math.max(p.era, 2); p.res.minerio += 900; p.res.plasma += 300; p.res.dados += 100; const L = S.UNICAS_DE[p.faction];
          for (let k = 0; k < 16; k++) { const a = k * 0.7, x = n.x + Math.cos(a) * 150, y = n.y + Math.sin(a) * 150; if (S.canBuild(sim, p.id, L[1], x, y).ok) { S.enqueue(sim, { t: 'build', p: p.id, def: L[1], x, y }); break; } }
          const r = sim.ents.find(e => e.alive && e.owner === p.id && e.kind === 'building' && e.built && S.MODULOS[e.def] && !e.modulo); if (r) S.enqueue(sim, { t: 'modulo', p: p.id, id: r.id, escolha: p.id % 2 ? 'b' : 'a' }); } };
      out.push.apply(out, run(todas, { mapV: 1, comandantes: true }, 900, 'comandantes ', roteiro));
      if (g.ARD.mundo && g.ARD.modos) { /* 5.0h junção: tudo ligado — Mundo vivo, comandantes, únicas e módulos (o roteiro), a IA 3.0 usando as peças reais e os Eventos da Fenda; e a Caçada com comandantes */
        out.push.apply(out, run(players, { mapV: 1, mundo: true, comandantes: true, eventos: true, eventosTeste: 'sentinela', mutadores: ['noite'] }, 1200, 'tudo ', roteiro));
        out.push.apply(out, run(players.slice(0, 3), { map: 'tita', mapV: 1, comandantes: true, cacada: { chefe: 'forja', dif: 'brutal' } }, 900, 'caçada tudo ')); } }
    return out;
  };
})(globalThis);
