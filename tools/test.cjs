globalThis.ARD = {};
require('../src/sim.js'); require('../src/ai.js');
const S = ARD.sim, AI = ARD.ai;
function run(seed, players, minutes, log) {
  const sim = S.createSim({ seed, players, minutes });
  const ais = sim.players.filter(p => !p.human).map(p => AI.create(p.id, p.difficulty));
  const counts = {}; let shots = 0, siphons = 0, deaths = 0, alerts = 0, pacts = 0, betr = 0, builtN = 0, crates = 0;
  const ticks = minutes * 600;
  for (let i = 0; i < ticks; i++) {
    if (i % 10 === 0) for (const a of ais) for (const c of AI.think(sim, a)) S.enqueue(sim, c);
    const ev = S.step(sim);
    for (const e of ev) { counts[e.t] = (counts[e.t] || 0) + 1; if (e.t === 'shot') shots++; if (e.t === 'siphon') siphons++; if (e.t === 'death') deaths++; if (e.t === 'alert') alerts++; if (e.t === 'pact') pacts++; if (e.t === 'betrayal') betr++; if (e.t === 'built') builtN++; if (e.t === 'crate') crates++; }
    // invariants
    for (const p of sim.players) for (const k in p.res) if (!(p.res[k] >= -1e-6) || Number.isNaN(p.res[k])) throw new Error('negative/NaN resource ' + k + ' for ' + p.name + ' at t=' + sim.time);
    for (const e of sim.ents) if (e.alive && (Number.isNaN(e.x) || Number.isNaN(e.y))) throw new Error('NaN position ' + e.kind + ' ' + e.def);
    if (sim.result) break;
  }
  if (log) {
    console.log(`seed=${seed} t=${sim.time.toFixed(0)}s ents=${sim.ents.length} shots=${shots} siphons=${siphons} deaths=${deaths} alerts=${alerts} pacts=${pacts} betrayals=${betr} built=${builtN} crates=${crates}`);
    for (const p of sim.players) {
      const b = S.entitiesOf(sim, p.id).filter(e => e.kind === 'building').map(e => e.def[0]).join('');
      const u = S.entitiesOf(sim, p.id).filter(e => e.kind === 'unit').length;
      console.log(`  ${p.name} [${p.faction}] alive=${p.alive} res=${Math.round(p.res.plasma)}/${Math.round(p.res.minerio)}/${Math.round(p.res.dados)} energy=${p.energy.regime} ${p.energy.prod.toFixed(0)}/${p.energy.cons.toFixed(0)} buildings=${b} units=${u} army=${S.armyValue(sim, p.id)} collected=${Math.round(p.stats.collected)} stolen=${Math.round(p.stats.stolen)} lost=${Math.round(p.stats.lost)} rep=${p.rep}`);
    }
    if (sim.result) console.log('  RESULT', sim.result.outcome, sim.result.reason);
  }
  return { hash: S.hash(sim), sim, counts };
}
// 1) AI vs AI, 4 players, 12 minutes
const t0 = Date.now();
const r1 = run(42, [{ name: 'Humano(IA)', faction: 'vehnar', human: false, difficulty: 'normal' }, { name: 'IA Erevane', faction: 'erevane', difficulty: 'normal' }, { name: 'IA Tessara', faction: 'tessara', difficulty: 'dificil' }, { name: 'IA Erevane 2', faction: 'erevane', difficulty: 'facil' }], 12, true);
console.log('elapsed ms', Date.now() - t0);
// 2) determinism
const a = run(7, [{ faction: 'erevane', difficulty: 'normal' }, { faction: 'vehnar', difficulty: 'dificil' }], 6, false).hash;
const b = run(7, [{ faction: 'erevane', difficulty: 'normal' }, { faction: 'vehnar', difficulty: 'dificil' }], 6, false).hash;
console.log('determinism', a === b ? 'OK' : 'FAIL', a, b);
// 3) 2 player long game to see an ending
const r3 = run(3, [{ name: 'A', faction: 'vehnar', difficulty: 'dificil' }, { name: 'B', faction: 'erevane', difficulty: 'facil' }], 25, true);
console.log('events', JSON.stringify(r3.counts));
// 4) navegação: unidade cercada por muros com um portão deve sair pelo portão
{
  const sim = S.createSim({ seed: 11, players: [{ name: 'A', faction: 'vehnar', human: false }, { name: 'B', faction: 'erevane', human: false }], minutes: 5 });
  const nuc = S.nucleoOf(sim, 0); const u = sim.ents.find(e => e.kind === 'unit' && e.owner === 0 && e.def === 'infantaria');
  // anel de muros a 150 de distância do núcleo, com portão a leste
  const cx = nuc.x, cy = nuc.y; let placed = 0;
  for (let a = 0; a < Math.PI * 2; a += 16 / 150) { const x = cx + Math.cos(a) * 150, y = cy + Math.sin(a) * 150; const gate = Math.abs(a) < 0.12; S.enqueue(sim, { t: 'build', p: 0, def: gate ? 'portao' : 'muro', x, y, ang: a + Math.PI / 2 }); placed++; }
  sim.players[0].res.minerio = 99999; S.step(sim);
  const walls = sim.ents.filter(e => e.kind === 'building' && (e.def === 'muro' || e.def === 'portao'));
  for (const w of walls) { w.built = true; w.progress = 1; } sim.navDirty = true;
  const target = { x: Math.max(80, cx - 600), y: cy }; // oeste: lado oposto ao portão
  S.enqueue(sim, { t: 'move', p: 0, ids: [u.id], x: target.x, y: target.y });
  let reached = false; for (let i = 0; i < 1200; i++) { S.step(sim); if (S.dist(u.x, u.y, target.x, target.y) < 40) { reached = true; break; } }
  console.log('navegação muro+portão:', reached ? 'OK (saiu pelo portão)' : 'FAIL', 'muros=' + walls.length, 'pos=' + Math.round(u.x) + ',' + Math.round(u.y), 'alvo=' + Math.round(target.x) + ',' + Math.round(target.y));
}
// 5) 4.0c — Quorith x Vorag: invariantes, Elo, devorar, Crias em pares, superarmas novas e determinismo
{
  const r5 = run(19, [{ name: 'Q', faction: 'quorith', difficulty: 'dificil' }, { name: 'V', faction: 'vorag', difficulty: 'dificil' }], 12, true);
  const c = r5.counts; console.log('  eventos 4.0c', JSON.stringify({ super: c.super || 0, siphon: c.siphon || 0, spawn: c.spawn || 0, death: c.death || 0 }));
  const h1 = run(23, [{ faction: 'vorag', difficulty: 'normal' }, { faction: 'quorith', difficulty: 'normal' }], 5, false).hash, h2 = run(23, [{ faction: 'vorag', difficulty: 'normal' }, { faction: 'quorith', difficulty: 'normal' }], 5, false).hash;
  console.log('determinismo 4.0c', h1 === h2 ? 'OK' : 'FAIL');
  // Carniceiro devora uma carcaça e um Nódulo inimigo; Crias eclodem em pares; Elo conta vizinhos
  const sim = S.createSim({ seed: 31, players: [{ name: 'V', faction: 'vorag', human: true }, { name: 'Q', faction: 'quorith', human: false }], minutes: 5 });
  const nucV = S.nucleoOf(sim, 0), nucQ = S.nucleoOf(sim, 1); sim.players[0].res.minerio = 9999; sim.players[0].res.plasma = 9999; sim.players[1].res.minerio = 9999; sim.players[1].res.plasma = 9999;
  S.enqueue(sim, { t: 'produce', p: 0, id: nucV.id, def: 'coletor' }); // só para validar que o Núcleo segue normal
  const q = sim.ents.find(e => e.kind === 'building' && e.owner === 0 && e.def === 'nucleo');
  // quartel Vorag pronto, produz 1 Cria → 2 unidades
  const b = S.enqueue(sim, { t: 'build', p: 0, def: 'quartel', x: nucV.x + 90, y: nucV.y, }); S.step(sim);
  const qb = sim.ents.find(e => e.kind === 'building' && e.owner === 0 && e.def === 'quartel'); qb.built = true; qb.progress = 1; qb.hp = qb.maxHp;
  S.enqueue(sim, { t: 'produce', p: 0, id: qb.id, def: 'cria' }); for (let i = 0; i < 60; i++) S.step(sim);
  const crias = sim.ents.filter(e => e.alive && e.kind === 'unit' && e.owner === 0 && e.def === 'cria');
  console.log('Crias em pares:', crias.length === 2 ? 'OK' : 'FAIL (' + crias.length + ')');
  // carcaça + Carniceiro
  const wreck = { id: sim.nextId++, kind: 'wreck', x: nucV.x + 160, y: nucV.y + 40, r: 10, ang: 0, alive: true, owner: -1, res: 'minerio', amount: 100, max: 100, bornT: sim.time, def: 'veiculo' }; sim.ents.push(wreck); sim.byId.set(wreck.id, wreck);
  S.enqueue(sim, { t: 'produce', p: 0, id: qb.id, def: 'pirata' }); for (let i = 0; i < 120; i++) S.step(sim);
  const carn = sim.ents.find(e => e.alive && e.kind === 'unit' && e.owner === 0 && e.def === 'pirata'); const m0 = sim.players[0].res.minerio;
  S.enqueue(sim, { t: 'devour', p: 0, ids: [carn.id], target: wreck.id }); for (let i = 0; i < 200; i++) S.step(sim);
  console.log('Carniceiro devora carcaça:', (wreck.amount <= 0.01 && sim.players[0].res.minerio > m0 + 100) ? 'OK (+' + Math.round(sim.players[0].res.minerio - m0) + ')' : 'FAIL amount=' + wreck.amount.toFixed(1) + ' ganho=' + (sim.players[0].res.minerio - m0).toFixed(1));
  // Nódulo inimigo perto do Carniceiro
  const nod = S.enqueue(sim, { t: 'build', p: 1, def: 'nodulo', x: nucV.x + 230, y: nucV.y + 60 }); S.step(sim);
  let nd = sim.ents.find(e => e.kind === 'building' && e.owner === 1 && e.def === 'nodulo');
  if (!nd) { console.log('Nódulo inimigo: não pôde ser construído perto (ok, pulando)'); } else { nd.built = true; nd.progress = 1; nd.hp = nd.maxHp; const hp0 = nd.hp; S.enqueue(sim, { t: 'devour', p: 0, ids: [carn.id], target: nd.id }); for (let i = 0; i < 100; i++) S.step(sim); console.log('Carniceiro corrói Nódulo:', nd.hp < hp0 - 50 ? 'OK (' + Math.round(hp0 - nd.hp) + ' de dano)' : 'FAIL hp=' + nd.hp); }
  // Elo: três Vozes juntas
  const qq = S.enqueue(sim, { t: 'build', p: 1, def: 'quartel', x: nucQ.x + 90, y: nucQ.y }); S.step(sim);
  const qbq = sim.ents.find(e => e.kind === 'building' && e.owner === 1 && e.def === 'quartel'); qbq.built = true; qbq.progress = 1; qbq.hp = qbq.maxHp;
  for (let k = 0; k < 3; k++) S.enqueue(sim, { t: 'produce', p: 1, id: qbq.id, def: 'voz' }); for (let i = 0; i < 260; i++) S.step(sim);
  const vozes = sim.ents.filter(e => e.alive && e.kind === 'unit' && e.owner === 1 && e.def === 'voz');
  console.log('Elo de Sincronia:', vozes.length === 3 && vozes.every(v => v.elo >= 2) ? 'OK (3 Vozes, acorde ' + vozes.map(v => v.elo).join('/') + ')' : 'FAIL vozes=' + vozes.length + ' elo=' + vozes.map(v => v.elo).join('/'));
}
