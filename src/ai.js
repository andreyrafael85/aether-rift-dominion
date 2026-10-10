/* IA de oponente (v2.0): módulos com estratégias nomeadas, duas cadências (tático 1 s, estratégico 60 s),
   avaliação de alvo por defesa, batedores, raids de piratas e muros na estratégia Fortaleza. Só emite comandos; usa o RNG da simulação. */
(function (ARD) {
'use strict';
const S = ARD.sim;

const BUILD_ORDERS = {
  vehnar:  ['reator', 'refinaria', 'quartel', 'nodulo', 'reator', 'fabrica', 'torre', 'reator', 'hangar', 'laboratorio', 'torre', 'nodulo', 'fabrica', 'reator', 'torre'],
  erevane: ['reator', 'quartel', 'refinaria', 'nodulo', 'reator', 'hangar', 'nodulo', 'torre', 'laboratorio', 'fabrica', 'reator', 'torre', 'quartel', 'reator'],
  tessara: ['reator', 'refinaria', 'quartel', 'nodulo', 'hangar', 'reator', 'laboratorio', 'torre', 'fabrica', 'nodulo', 'reator', 'torre', 'quartel'],
};
const STRATS = {
  expansao:  { name: 'Expansão',            prod: { infantaria: 0.35, veiculo: 0.25, drone: 0.3, suporte: 0.1 }, col: 3, nodulos: 1, towers: 0, attackMul: 1.25, pirate: 1.0 },
  massa:     { name: 'Massa de Infantaria',  prod: { infantaria: 0.7, veiculo: 0.1, drone: 0.15, suporte: 0.05 }, col: 0, nodulos: 0, towers: 0, attackMul: 0.85, pirate: 0.7 },
  blindados: { name: 'Blindados',            prod: { infantaria: 0.15, veiculo: 0.55, drone: 0.2, suporte: 0.1 }, col: 1, nodulos: 0, towers: 0, attackMul: 1.0, pirate: 0.7 },
  roubo:     { name: 'Roubo',                prod: { infantaria: 0.4, veiculo: 0.15, drone: 0.4, suporte: 0.05 }, col: 1, nodulos: 0, towers: 0, attackMul: 1.35, pirate: 2.5 },
  fortaleza: { name: 'Fortaleza',            prod: { infantaria: 0.35, veiculo: 0.35, drone: 0.2, suporte: 0.1 }, col: 0, nodulos: 0, towers: 2, attackMul: 1.6, pirate: 0.5, walls: true },
};
const PREF = { vehnar: ['blindados', 'fortaleza', 'expansao', 'massa'], erevane: ['roubo', 'expansao', 'massa', 'blindados'], tessara: ['expansao', 'blindados', 'massa', 'roubo'] };
const CLASS_W = { infantaria: 'infantaria', soldador: 'infantaria', atirador: 'infantaria', quimera: 'infantaria', veiculo: 'veiculo', prensa: 'veiculo', tratorzao: 'veiculo', lamina: 'veiculo', colosso: 'veiculo', drone: 'drone', mosquito: 'drone', esporo: 'drone', suporte: 'suporte', ancora: 'suporte', molde: 'suporte', guindaste: 'suporte' };
const VALUE = { refinaria: 3, nodulo: 2.5, reator: 2, laboratorio: 2, quartel: 1.5, fabrica: 1.5, hangar: 1.5, torre: 1, bastiao: 0.8, nucleo: 1.2, muro: 0.1, portao: 0.2 };

function create(pid, difficulty) {
  return { pid, diff: S.DIFFICULTY[difficulty] || S.DIFFICULTY.normal, bo: 0, mode: 'defend', attackStart: 0, target: null, known: new Map(),
    lastPirate: 0, lastPropose: -999, lastExtra: 0, enemySeen: { inf: 0, vei: 0, dro: 0, est: 0, sup: 0 }, lastAttackOrder: -99,
    strategy: null, lastStrategic: -999, lostRecent: 0, armyPrev: 0, lastScout: -999, wallsBuilt: false, towersWanted: 0 };
}
function own(sim, pid) { return S.entitiesOf(sim, pid); }
function count(list, pred) { let n = 0; for (const e of list) if (pred(e)) n++; return n; }
function findSpot(sim, pid, def, cx, cy, rmin, rmax, tries) {
  for (let i = 0; i < tries; i++) { const a = sim.rand() * Math.PI * 2, r = rmin + sim.rand() * (rmax - rmin); const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r; if (S.canBuild(sim, pid, def, x, y).ok) return { x, y }; }
  return null;
}
function nearestEnemyNucleoPos(sim, pid) {
  const me = S.nucleoOf(sim, pid); if (!me) return null; let best = null, bd = Infinity;
  for (const q of sim.players) { if (q.id === pid || !q.alive || S.hasPact(sim, pid, q.id)) continue; const n = S.nucleoOf(sim, q.id); if (!n) continue; const d = S.dist(me.x, me.y, n.x, n.y); if (d < bd) { bd = d; best = { x: n.x, y: n.y, owner: q.id, def: 'nucleo' }; } }
  return best;
}
function updateKnown(sim, mem) {
  const vis = sim.vis[mem.pid];
  for (const id of vis) { const e = sim.byId.get(id); if (e && e.alive && e.kind === 'building') mem.known.set(id, { x: e.x, y: e.y, def: e.def, owner: e.owner }); }
  for (const [id, k] of mem.known) { const e = sim.byId.get(id); if (!e || !e.alive || !sim.players[k.owner].alive) mem.known.delete(id); }
  for (const k in mem.enemySeen) mem.enemySeen[k] *= 0.9;
  for (const id of vis) { const e = sim.byId.get(id); if (e && e.alive && e.kind === 'unit' && S.isEnemy(sim, mem.pid, e.owner) && mem.enemySeen[e.cls] !== undefined) mem.enemySeen[e.cls] += 1; }
}
// --- estratégico (a cada 60 s): escolhe a estratégia com heurísticas e um pouco de aleatório
function strategic(sim, mem, p, army) {
  const t = sim.time; const prefs = PREF[p.faction] || PREF.vehnar;
  const value = S.armyValue(sim, mem.pid); const lost = mem.armyPrev > 0 ? Math.max(0, (mem.armyPrev - value) / mem.armyPrev) : 0; mem.armyPrev = value;
  const human = sim.players.find(q => q.human && q.alive); const hv = human ? S.armyValue(sim, human.id) : 0;
  let next = mem.strategy;
  if (!next) next = sim.rand() < 0.6 ? prefs[0] : prefs[1 + Math.floor(sim.rand() * (prefs.length - 1))];
  else if (lost > 0.4 && mem.mode === 'defend') next = 'fortaleza';
  else if (t > 300 && p.res.plasma < 150) next = 'expansao';
  else if (hv > 0 && value > hv * 1.8) next = p.faction === 'erevane' ? 'roubo' : 'blindados';
  else if (sim.rand() < 0.3) next = prefs[Math.floor(sim.rand() * prefs.length)];
  if (next !== mem.strategy) { mem.strategy = next; emit(mem, sim, { t: 'aistrat', p: mem.pid, strategy: STRATS[next].name }); }
  mem.towersWanted = 2 + (STRATS[mem.strategy].towers || 0) + Math.floor(t / 400);
}
function emit(mem, sim, ev) { /* eventos informativos da IA aparecem só em depuração */ }
function assessTargets(sim, mem, from) {
  // melhor alvo = valor / (1 + defesa) com leve preferência por proximidade
  let best = null, bs = -Infinity;
  const cands = [...mem.known.values()].filter(k => S.isEnemy(sim, mem.pid, k.owner));
  const en = nearestEnemyNucleoPos(sim, mem.pid); if (en) cands.push(en);
  for (const k of cands) {
    let def = 0;
    for (const o of mem.known.values()) if (o.owner === k.owner && (o.def === 'torre' || o.def === 'bastiao') && S.dist(o.x, o.y, k.x, k.y) < 280) def += o.def === 'bastiao' ? 2 : 1;
    for (const id of sim.vis[mem.pid]) { const e = sim.byId.get(id); if (e && e.alive && e.kind === 'unit' && e.owner === k.owner && S.UNITS[e.def].attack && S.dist(e.x, e.y, k.x, k.y) < 220) def += 0.5; }
    const d = S.dist(from.x, from.y, k.x, k.y); const strat = STRATS[mem.strategy] || STRATS.expansao;
    let val = VALUE[k.def] || 1; if (strat.pirate >= 2 && (k.def === 'refinaria' || k.def === 'reator')) val *= 1.5;
    const sc = val / (1 + def) * (1 - Math.min(0.5, d / 4000));
    if (sc > bs) { bs = sc; best = k; }
  }
  return best;
}

function think(sim, mem) {
  const cmds = []; const p = sim.players[mem.pid]; if (!p.alive || sim.result) return cmds;
  const t = sim.time; const D = mem.diff; const mine = own(sim, mem.pid);
  const nuc = mine.find(e => e.kind === 'building' && e.def === 'nucleo'); if (!nuc) return cmds;
  const builds = mine.filter(e => e.kind === 'building'); const units = mine.filter(e => e.kind === 'unit');
  const collectors = units.filter(u => u.def === 'coletor'); const pirates = units.filter(u => u.def === 'pirata'); const army = units.filter(u => S.UNITS[u.def].attack);
  const nodulos = count(builds, b => b.def === 'nodulo'); const underConstruction = count(builds, b => !b.built);
  updateKnown(sim, mem);
  const emitC = c => { c.p = mem.pid; cmds.push(c); };
  if (t - mem.lastStrategic >= 60 || !mem.strategy) { mem.lastStrategic = t; strategic(sim, mem, p, army); }
  const strat = STRATS[mem.strategy] || STRATS.expansao;

  // --- diplomacia
  for (const pr of sim.pending) {
    if (pr.to !== mem.pid) continue; const other = sim.players[pr.from];
    const myV = S.armyValue(sim, mem.pid), theirV = S.armyValue(sim, pr.from);
    const accept = other.rep >= -1 && (myV < theirV * 1.15 || sim.rand() < 0.25) && sim.rand() < D.acceptP;
    emitC({ t: 'respond', to: pr.from, accept });
  }
  const human = sim.players.find(q => q.human && q.alive);
  if (human && t > 180 && !S.hasPact(sim, mem.pid, human.id) && t - mem.lastPropose > 150 && S.armyValue(sim, mem.pid) < S.armyValue(sim, human.id) * 0.6 && sim.rand() < 0.5) { mem.lastPropose = t; emitC({ t: 'propose', to: human.id }); }
  for (const k in p.pacts) { const pact = p.pacts[k]; const q = sim.players[k]; if (!q.alive) continue; if (D.breakP > 0 && t - pact.since > 180 && S.armyValue(sim, mem.pid) > S.armyValue(sim, q.id) * 1.6 && sim.rand() < D.breakP / 60) { emitC({ t: 'break', with: q.id }); mem.mode = 'attack'; mem.attackStart = S.armyValue(sim, mem.pid); mem.target = null; } }

  // --- economia
  const wantCol = Math.min(16, 6 + nodulos * 2 + strat.col);
  if (collectors.length + count(nuc.queue, q => q.def === 'coletor') < wantCol && nuc.queue.length < 2 && S.canAfford(p, S.UNITS.coletor.cost) && nuc.jumpT <= 0) emitC({ t: 'produce', id: nuc.id, def: 'coletor' });
  const reactors = count(builds, b => b.def === 'reator'); const towers = count(builds, b => b.def === 'torre');
  const needEnergy = p.energy.ratio < 1.1 && reactors < 8 && underConstruction < 2;
  const reserve = t < 240 ? D.reserve : 60;
  if (needEnergy && S.canAfford(p, { minerio: S.BUILDINGS.reator.cost.minerio + reserve })) { const s = findSpot(sim, mem.pid, 'reator', nuc.x, nuc.y, 70, 260, 30); if (s) emitC({ t: 'build', def: 'reator', x: s.x, y: s.y }); }
  else if (underConstruction < 2) {
    const order = BUILD_ORDERS[p.faction] || BUILD_ORDERS.vehnar; let def = order[mem.bo];
    if (!def || mem.bo >= order.length) {
      if (towers < mem.towersWanted && t - mem.lastExtra > 45) { def = 'torre'; mem.lastExtra = t; }
      else if (nodulos < 2 + strat.nodulos + Math.floor(t / 500) && t - mem.lastExtra > 60) { def = 'nodulo'; mem.lastExtra = t; }
      else if (t - mem.lastExtra > 90) { def = sim.rand() < 0.5 ? (p.faction === 'vehnar' ? 'fabrica' : 'hangar') : 'quartel'; mem.lastExtra = t; }
      else def = null;
    }
    if (def) {
      const bd = S.BUILDINGS[def]; const cost = Object.assign({}, bd.cost); cost.minerio = (cost.minerio || 0) + (t < 240 ? 40 : 0);
      if (S.canAfford(p, cost)) {
        let s = null;
        if (def === 'nodulo') { let best = null, bdist = Infinity; for (const e of sim.ents) { if (!e.alive || e.kind !== 'node' || e.amount <= 0 || S.territoryOwner(sim, e.x, e.y) !== -1) continue; const d = S.dist(nuc.x, nuc.y, e.x, e.y); if (d < bdist) { bdist = d; best = e; } } if (best) s = findSpot(sim, mem.pid, 'nodulo', best.x, best.y, 60, 140, 30); if (!s) s = findSpot(sim, mem.pid, 'nodulo', nuc.x, nuc.y, 380, 600, 30); }
        else if (def === 'refinaria') { let sx = 0, sy = 0, n = 0; for (const e of sim.ents) if (e.alive && e.kind === 'node' && S.inTerritory(sim, mem.pid, e.x, e.y)) { sx += e.x; sy += e.y; n++; } if (n) s = findSpot(sim, mem.pid, 'refinaria', sx / n, sy / n, 50, 160, 30); if (!s) s = findSpot(sim, mem.pid, 'refinaria', nuc.x, nuc.y, 90, 300, 30); }
        else if (def === 'torre') { const en = nearestEnemyNucleoPos(sim, mem.pid); if (en) { const a = Math.atan2(en.y - nuc.y, en.x - nuc.x) + (sim.rand() - 0.5) * 1.2; s = findSpot(sim, mem.pid, 'torre', nuc.x + Math.cos(a) * 250, nuc.y + Math.sin(a) * 250, 0, 110, 30); } if (!s) s = findSpot(sim, mem.pid, 'torre', nuc.x, nuc.y, 150, 330, 30); }
        else s = findSpot(sim, mem.pid, def, nuc.x, nuc.y, 90, 320, 40);
        if (s) { emitC({ t: 'build', def, x: s.x, y: s.y }); if (mem.bo < order.length) mem.bo++; }
        else if (mem.bo < order.length) mem.bo++;
      }
    }
  }
  // muros na Fortaleza: arco voltado para o inimigo mais próximo, com portão no meio
  if (strat.walls && !mem.wallsBuilt && t > 240 && p.res.minerio > 700) {
    const en = nearestEnemyNucleoPos(sim, mem.pid);
    if (en) { const a0 = Math.atan2(en.y - nuc.y, en.x - nuc.x); const R = 300; let n = 0;
      for (let a = a0 - 0.7; a <= a0 + 0.7; a += 16 / R) { const x = nuc.x + Math.cos(a) * R, y = nuc.y + Math.sin(a) * R; const gate = Math.abs(a - a0) < 0.06; if (S.canBuild(sim, mem.pid, gate ? 'portao' : 'muro', x, y).ok) { emitC({ t: 'build', def: gate ? 'portao' : 'muro', x, y, ang: a + Math.PI / 2 }); n++; } }
      mem.wallsBuilt = true; }
  }
  // --- pesquisa, superarma, sobrecarga
  if (S.hasBuilt(sim, mem.pid, 'laboratorio')) {
    for (const key of ['armamento', 'blindagem', 'sensores']) if (!p.research[key] && S.canAfford(p, S.RESEARCH[key].cost) && p.res.dados > 160) { emitC({ t: 'research', key }); break; }
    if (t >= p.superCd && S.canAfford(p, { dados: 300, plasma: 300 })) { const fac = S.FACTIONS[p.faction]; if (fac.superKey === 'fundicao') { const en = nearestEnemyNucleoPos(sim, mem.pid); if (en) { const a = Math.atan2(en.y - nuc.y, en.x - nuc.x); const s = findSpot(sim, mem.pid, 'bastiao', nuc.x + Math.cos(a) * 300, nuc.y + Math.sin(a) * 300, 0, 80, 30); if (s && S.inTerritory(sim, mem.pid, s.x, s.y)) emitC({ t: 'super', x: s.x, y: s.y }); } } else if (mem.mode === 'attack') emitC({ t: 'super' }); }
  }
  if (p.energy.regime !== 'pleno' && p.res.plasma > 450 && t >= p.overchargeCd) emitC({ t: 'overcharge' });

  // --- produção: estratégia + contras do que foi visto
  const prodBuildings = builds.filter(b => b.built && S.BUILDINGS[b.def].produces && b.def !== 'nucleo');
  const seen = mem.enemySeen; const total = seen.inf + seen.vei + seen.dro + seen.est + seen.sup + 0.01;
  const w = Object.assign({}, strat.prod);
  w.veiculo += 0.5 * (seen.inf + seen.est) / total; w.drone += 0.5 * (seen.vei + seen.sup) / total; w.infantaria += 0.5 * (seen.dro + seen.sup) / total; w.suporte += 0.3 * (seen.vei + seen.est) / total;
  const reserveArmy = t < 240 ? D.reserve : 40;
  for (const b of prodBuildings) {
    if (b.queue.length >= 2) continue; const opts = S.producesFor(b.def, p.faction).filter(u => u !== 'pirata' && u !== 'coletor');
    let pick = null, best = -1;
    for (const u of opts) { const ud = S.UNITS[u]; const cls = CLASS_W[u] || 'infantaria'; let sc = (w[cls] || 0.1) * (0.7 + sim.rand() * 0.6); if (!ud.attack) sc *= 0.35; if (ud.cost.dados && p.res.dados < (ud.cost.dados + 40)) sc = 0; if (S.unitCost(u) > 300 && t < 420) sc *= 0.3; if (sc > best) { best = sc; pick = u; } }
    if (pick === 'suporte' && p.res.dados < 60) pick = 'infantaria';
    if (pick) { const c = Object.assign({}, S.UNITS[pick].cost); c.minerio = (c.minerio || 0) + reserveArmy; if (S.canAfford(p, c)) emitC({ t: 'produce', id: b.id, def: pick }); }
  }
  // --- piratas (raids) e batedores
  const quartel = prodBuildings.find(b => b.def === 'quartel');
  const pirateEvery = D.pirateEvery / strat.pirate; const maxPirates = strat.pirate >= 2 ? 3 : 2;
  if (quartel && t - mem.lastPirate > pirateEvery && pirates.length < maxPirates && S.canAfford(p, { minerio: 120 + reserveArmy, plasma: 30 }) && quartel.queue.length < 3) { mem.lastPirate = t; emitC({ t: 'produce', id: quartel.id, def: 'pirata' }); }
  for (const pr of pirates) {
    if (pr.state !== 'idle') continue; let best = null, bd = Infinity;
    for (const [id, k] of mem.known) { if ((k.def === 'refinaria' || k.def === 'reator') && S.isEnemy(sim, mem.pid, k.owner)) { const d = S.dist(pr.x, pr.y, k.x, k.y); if (d < bd) { bd = d; best = id; } } }
    if (best && sim.vis[mem.pid].has(best)) emitC({ t: 'siphon', ids: [pr.id], target: best });
    else if (best) { const k = mem.known.get(best); emitC({ t: 'move', ids: [pr.id], x: k.x + (sim.rand() - 0.5) * 80, y: k.y + (sim.rand() - 0.5) * 80 }); }
    else { const en = nearestEnemyNucleoPos(sim, mem.pid); if (en && sim.rand() < 0.5) emitC({ t: 'move', ids: [pr.id], x: en.x + (sim.rand() - 0.5) * 520, y: en.y + (sim.rand() - 0.5) * 520 }); }
  }
  if (t - mem.lastScout > 90 && t > 120) { // batedor: uma unidade barata vai olhar a base inimiga
    const en = nearestEnemyNucleoPos(sim, mem.pid); const scout = army.find(u => u.state === 'idle' && (u.def === 'drone' || u.def === 'infantaria'));
    if (en && scout) { mem.lastScout = t; emitC({ t: 'move', ids: [scout.id], x: en.x + (sim.rand() - 0.5) * 300, y: en.y + (sim.rand() - 0.5) * 300 }); }
  }
  // --- esquadrões: defesa, ataque por avaliação de alvo, recuo
  const value = S.armyValue(sim, mem.pid); const threshold = (D.attackAt + Math.max(0, (t - 600) / 60) * 25) * strat.attackMul;
  const attacked = builds.find(b => t - b.lastHitT < 6 && b.lastHitBy !== undefined && b.lastHitBy !== mem.pid);
  const rally = { x: nuc.x + (S.CX - nuc.x) * 0.12, y: nuc.y + (S.CY - nuc.y) * 0.12 };
  const ids = army.map(u => u.id);
  if (attacked && ids.length) { if (t - mem.lastAttackOrder > 4) { mem.lastAttackOrder = t; emitC({ t: 'attackmove', ids, x: attacked.x, y: attacked.y }); } if (mem.mode === 'attack' && value < mem.attackStart * 0.5) mem.mode = 'defend'; }
  else if (mem.mode === 'defend') {
    if (value >= threshold && ids.length >= 4 && t >= D.minAttack) { mem.mode = 'attack'; mem.attackStart = value; mem.target = assessTargets(sim, mem, nuc); }
    else if (t - mem.lastAttackOrder > 8) { const far = army.filter(u => u.state === 'idle' && S.dist(u.x, u.y, rally.x, rally.y) > 160).map(u => u.id); if (far.length) { mem.lastAttackOrder = t; emitC({ t: 'attackmove', ids: far, x: rally.x, y: rally.y }); } }
  }
  if (mem.mode === 'attack' && !attacked) {
    if (value < mem.attackStart * 0.35 || ids.length === 0) { mem.mode = 'defend'; if (ids.length) emitC({ t: 'move', ids, x: rally.x, y: rally.y }); }
    else {
      if (!mem.target || (mem.target.def !== 'nucleo' && ![...mem.known.values()].some(k => k.x === mem.target.x && k.y === mem.target.y))) mem.target = assessTargets(sim, mem, nuc);
      if (mem.target && t - mem.lastAttackOrder > 5) { mem.lastAttackOrder = t; emitC({ t: 'attackmove', ids, x: mem.target.x, y: mem.target.y }); }
      if (!mem.target) mem.mode = 'defend';
    }
  }
  return cmds;
}
ARD.ai = { create, think, STRATS };
})(globalThis.ARD = globalThis.ARD || {});
