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
// 4.3h — mapas e lagos: Cinturão (chão firme, Núcleos ligados, o abismo para quem anda e não para quem voa), lagos (o plasma bloqueia, o gelo se atravessa), obra fora do abismo e do lago, determinismo
{
  const facs = ['vehnar', 'erevane', 'tessara', 'quorith', 'vorag'], NC = 32, NWc = S.WORLD / NC;
  const mk = (map, n, seed) => { const players = []; for (let i = 0; i < n; i++) players.push({ name: 'P' + i, faction: facs[i], human: i === 0, difficulty: 'normal' }); return S.createSim({ seed, players, minutes: 25, map, mapV: 1 }); };
  const reach = sim => { const b = sim.nav.blocked, idx = (x, y) => Math.floor(y / NC) * NWc + Math.floor(x / NC), seen = new Uint8Array(NWc * NWc), q = [];
    const near = (x, y, ok) => { const c = idx(x, y); for (let r = 0; r < 6; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const i = c + dy * NWc + dx; if (i >= 0 && i < NWc * NWc && ok(i)) return i; } return -1; };
    const nucs = sim.players.map(p => S.nucleoOf(sim, p.id)); const s0 = near(nucs[0].x, nucs[0].y, i => !b[i]); if (s0 < 0) return false; q.push(s0); seen[s0] = 1;
    while (q.length) { const i = q.pop(), x = i % NWc, y = (i / NWc) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= NWc || ny >= NWc) continue; const j = ny * NWc + nx; if (!seen[j] && !b[j]) { seen[j] = 1; q.push(j); } } }
    return nucs.every(nc => near(nc.x, nc.y, i => seen[i]) >= 0); };
  let okPlat = true, okLink = true; const why = [];
  for (const n of [2, 3, 4, 5]) { const sim = mk('cinturao', n, 42); S.step(sim);
    const bad = sim.ents.filter(e => (e.kind === 'node' || e.kind === 'building' || e.kind === 'unit') && S.mapCell(sim, e.x, e.y) !== 1); if (bad.length) { okPlat = false; why.push(n + 'p: ' + bad.length + ' fora do chão'); }
    const blk = sim.nav.blocked.reduce((a, v) => a + v, 0); if (!blk || !reach(sim)) { okLink = false; why.push(n + 'p: Núcleos sem caminho (bloqueadas ' + blk + ')'); } }
  console.log('Cinturão: tudo em chão firme (2 a 5 jogadores):', okPlat ? 'OK' : 'FAIL ' + why.join('; '));
  console.log('Cinturão: os Núcleos se alcançam a pé pelas pontes:', okLink ? 'OK' : 'FAIL ' + why.join('; '));
  // o abismo segura quem anda e deixa passar quem voa
  { const sim = mk('cinturao', 2, 42); S.step(sim); const n0 = S.nucleoOf(sim, 0); let vx = 0, vy = 0;
    let best = 0; for (let a = 0; a < 6.28; a += 0.1) for (let d = 450; d <= 800; d += 25) { const x = n0.x + Math.cos(a) * d, y = n0.y + Math.sin(a) * d; if (x < 150 || y < 150 || x > S.WORLD - 150 || y > S.WORLD - 150) continue; const sd = S.mapSd(sim, x, y); if (S.mapCell(sim, x, y) === 0 && sd < best) { best = sd; vx = x; vy = y; } }
    const ground = Object.keys(S.UNITS).find(k => !S.UNITS[k].flying && !S.UNITS[k].faction && k !== 'coletor'), air = 'drone';
    const g = S.spawnUnit(sim, 0, ground, n0.x + 120, n0.y), f = S.spawnUnit(sim, 0, air, n0.x + 120, n0.y + 30); let fell = 0;
    S.enqueue(sim, { t: 'move', p: 0, ids: [g.id], x: vx, y: vy }); S.enqueue(sim, { t: 'move', p: 0, ids: [f.id], x: vx, y: vy });
    for (let i = 0; i < 400; i++) { S.step(sim); if (g.alive && S.mapCell(sim, g.x, g.y) === 0) fell++; }
    const df = Math.hypot(f.x - vx, f.y - vy); console.log('Cinturão: abismo para quem anda e não para quem voa:', vx && !fell && df < 80 ? 'OK (' + ground + ' parou na borda; drone a ' + Math.round(df) + ' do alvo)' : 'FAIL vazio=' + Math.round(vx) + ' caiu=' + fell + ' drone=' + Math.round(df)); }
  // lagos: o plasma bloqueia, o gelo se atravessa; nada se constrói no abismo nem no lago
  { const sim = mk('fenda', 2, 42); S.step(sim); const L = sim.map.lakes, pl = L.find(k => k.kind === 'plasma'), ge = L.find(k => k.kind === 'gelo'); const ci = (x, y) => Math.floor(y / NC) * NWc + Math.floor(x / NC);
    const okKinds = !!pl && !!ge && S.mapCell(sim, pl.x, pl.y) === 2 && S.mapCell(sim, ge.x, ge.y) === 3 && sim.nav.blocked[ci(pl.x, pl.y)] === 1 && sim.nav.blocked[ci(ge.x, ge.y)] === 0 && S.groundAt(sim, ge.x, ge.y) && !S.groundAt(sim, pl.x, pl.y);
    const ground = Object.keys(S.UNITS).find(k => !S.UNITS[k].flying && !S.UNITS[k].faction && k !== 'coletor');
    const sx = ge.x + Math.cos(0.4) * (ge.r + 90), sy = ge.y + Math.sin(0.4) * (ge.r + 90); const u = S.spawnUnit(sim, 0, ground, sx, sy); S.enqueue(sim, { t: 'move', p: 0, ids: [u.id], x: ge.x, y: ge.y });
    const px = pl.x + (pl.r + 70), py = pl.y; const w = S.spawnUnit(sim, 0, ground, px, py); S.enqueue(sim, { t: 'move', p: 0, ids: [w.id], x: pl.x, y: pl.y }); let inLava = 0;
    for (let i = 0; i < 500; i++) { S.step(sim); if (w.alive && S.mapCell(sim, w.x, w.y) === 2) inLava++; }
    const du = Math.hypot(u.x - ge.x, u.y - ge.y);
    console.log('Lagos: o plasma bloqueia e o gelo se atravessa:', okKinds && du < 60 && !inLava ? 'OK (a ' + Math.round(du) + ' do centro do gelo; ninguém entrou na lava)' : 'FAIL tipos=' + okKinds + ' gelo=' + Math.round(du) + ' lava=' + inLava);
    const c1 = S.canBuild(sim, 0, 'quartel', pl.x, pl.y), c2 = S.canBuild(sim, 0, 'quartel', ge.x, ge.y); const sc = mk('cinturao', 2, 42); let vx = 0, vy = 0; for (let a = 0; a < 6.28 && !vx; a += 0.05) { const x = S.CX + Math.cos(a) * 820, y = S.CY + Math.sin(a) * 820; if (S.mapCell(sc, x, y) === 0) { vx = x; vy = y; } } const c3 = S.canBuild(sc, 0, 'quartel', vx, vy);
    console.log('Obras fora do lago e do abismo:', !c1.ok && !c2.ok && !c3.ok && c3.why === 'Sobre o abismo' ? 'OK (' + c1.why + ' / ' + c2.why + ' / ' + c3.why + ')' : 'FAIL ' + JSON.stringify([c1, c2, c3])); }
  // mesma semente, mesmo Cinturão
  { const go = () => { const sim = mk('cinturao', 3, 9); const ais = sim.players.map(p => AI.create(p.id, 'normal')); for (let i = 0; i < 1800; i++) { if (i % 10 === 0) for (const a of ais) for (const c of AI.think(sim, a)) S.enqueue(sim, c); S.step(sim); } return S.hash(sim); };
    const h1 = go(), h2 = go(); console.log('Cinturão determinístico (3 IAs, 3 min):', h1 === h2 ? 'OK' : 'FAIL ' + h1 + ' vs ' + h2); }
}
