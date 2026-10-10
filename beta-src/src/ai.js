/* IA de oponente — decide a cada 1 s de jogo, só por comandos; usa o RNG da simulação (determinístico). */
(function (ARD) {
'use strict';
const S = ARD.sim;

const BUILD_ORDERS = {
  vehnar:  ['reator', 'refinaria', 'quartel', 'nodulo', 'reator', 'fabrica', 'torre', 'reator', 'hangar', 'laboratorio', 'torre', 'nodulo', 'fabrica', 'reator', 'torre'],
  erevane: ['reator', 'quartel', 'refinaria', 'nodulo', 'reator', 'hangar', 'nodulo', 'torre', 'laboratorio', 'fabrica', 'reator', 'torre', 'quartel', 'reator'],
};

function create(pid, difficulty) {
  return { pid, diff: S.DIFFICULTY[difficulty] || S.DIFFICULTY.normal, bo: 0, mode: 'defend', attackStart: 0, target: null, known: new Map(),
    lastPirate: 0, lastPropose: -999, lastExtra: 0, lastThink: -1, enemySeen: { inf: 0, vei: 0, dro: 0, est: 0, sup: 0 }, lastAttackOrder: -99 };
}

function own(sim, pid) { return S.entitiesOf(sim, pid); }
function count(list, pred) { let n = 0; for (const e of list) if (pred(e)) n++; return n; }

function findSpot(sim, pid, def, cx, cy, rmin, rmax, tries) {
  const d = S.BUILDINGS[def];
  for (let i = 0; i < tries; i++) {
    const a = sim.rand() * Math.PI * 2, r = rmin + sim.rand() * (rmax - rmin);
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
    if (S.canBuild(sim, pid, def, x, y).ok) return { x, y };
  }
  return null;
}
function nearestEnemyNucleoPos(sim, pid) {
  const me = S.nucleoOf(sim, pid); if (!me) return null;
  let best = null, bd = Infinity;
  for (const q of sim.players) {
    if (q.id === pid || !q.alive || S.hasPact(sim, pid, q.id)) continue;
    const n = S.nucleoOf(sim, q.id); if (!n) continue;
    const d = S.dist(me.x, me.y, n.x, n.y); if (d < bd) { bd = d; best = { x: n.x, y: n.y, owner: q.id }; }
  }
  return best;
}
function updateKnown(sim, mem) {
  const vis = sim.vis[mem.pid];
  for (const id of vis) { const e = sim.byId.get(id); if (e && e.alive && e.kind === 'building') mem.known.set(id, { x: e.x, y: e.y, def: e.def, owner: e.owner }); }
  for (const [id, k] of mem.known) { const e = sim.byId.get(id); if (!e || !e.alive || !sim.players[k.owner].alive) mem.known.delete(id); }
  // enemy composition seen (decayed)
  for (const k in mem.enemySeen) mem.enemySeen[k] *= 0.9;
  for (const id of vis) { const e = sim.byId.get(id); if (e && e.alive && e.kind === 'unit' && S.isEnemy(sim, mem.pid, e.owner) && mem.enemySeen[e.cls] !== undefined) mem.enemySeen[e.cls] += 1; }
}

function think(sim, mem) {
  const cmds = [];
  const p = sim.players[mem.pid]; if (!p.alive || sim.result) return cmds;
  const t = sim.time; const D = mem.diff;
  const mine = own(sim, mem.pid);
  const nuc = mine.find(e => e.kind === 'building' && e.def === 'nucleo'); if (!nuc) return cmds;
  const builds = mine.filter(e => e.kind === 'building');
  const units = mine.filter(e => e.kind === 'unit');
  const collectors = units.filter(u => u.def === 'coletor');
  const pirates = units.filter(u => u.def === 'pirata');
  const army = units.filter(u => S.UNITS[u.def].attack);
  const nodulos = count(builds, b => b.def === 'nodulo');
  const underConstruction = count(builds, b => !b.built);
  updateKnown(sim, mem);
  const emit = c => { c.p = mem.pid; cmds.push(c); };

  // --- pending proposals to me
  for (const pr of sim.pending) {
    if (pr.to !== mem.pid) continue;
    const other = sim.players[pr.from];
    const myV = S.armyValue(sim, mem.pid), theirV = S.armyValue(sim, pr.from);
    const accept = other.rep >= -1 && (myV < theirV * 1.15 || sim.rand() < 0.25) && sim.rand() < D.acceptP;
    emit({ t: 'respond', to: pr.from, accept });
  }
  // --- propose when weaker
  const human = sim.players.find(q => q.human && q.alive);
  if (human && t > 180 && !S.hasPact(sim, mem.pid, human.id) && t - mem.lastPropose > 150 && S.armyValue(sim, mem.pid) < S.armyValue(sim, human.id) * 0.6 && sim.rand() < 0.5) {
    mem.lastPropose = t; emit({ t: 'propose', to: human.id });
  }
  // --- betray when much stronger
  for (const k in p.pacts) {
    const pact = p.pacts[k]; const q = sim.players[k];
    if (!q.alive) continue;
    if (D.breakP > 0 && t - pact.since > 180 && S.armyValue(sim, mem.pid) > S.armyValue(sim, q.id) * 1.6 && sim.rand() < D.breakP / 60) {
      emit({ t: 'break', with: q.id }); mem.mode = 'attack'; mem.attackStart = S.armyValue(sim, mem.pid); mem.target = null;
    }
  }

  // --- economy: collectors
  const wantCol = Math.min(14, 6 + nodulos * 2);
  if (collectors.length + count(nuc.queue, q => q.def === 'coletor') < wantCol && nuc.queue.length < 2 && S.canAfford(p, S.UNITS.coletor.cost) && nuc.jumpT <= 0) emit({ t: 'produce', id: nuc.id, def: 'coletor' });

  // --- energy first
  const reactors = count(builds, b => b.def === 'reator');
  const needEnergy = p.energy.ratio < 1.1 && reactors < 7 && underConstruction < 2;
  const reserve = t < 240 ? D.reserve : 60;
  if (needEnergy && S.canAfford(p, { minerio: S.BUILDINGS.reator.cost.minerio + reserve })) {
    const s = findSpot(sim, mem.pid, 'reator', nuc.x, nuc.y, 70, 260, 30); if (s) emit({ t: 'build', def: 'reator', x: s.x, y: s.y });
  } else if (underConstruction < 2) {
    // --- build order
    const order = BUILD_ORDERS[p.faction] || BUILD_ORDERS.vehnar;
    let def = order[mem.bo];
    if (!def && t - mem.lastExtra > 90) { def = sim.rand() < 0.5 ? 'nodulo' : (sim.rand() < 0.5 ? 'torre' : (p.faction === 'vehnar' ? 'fabrica' : 'hangar')); mem.lastExtra = t; }
    if (def) {
      const bd = S.BUILDINGS[def];
      const cost = Object.assign({}, bd.cost); cost.minerio = (cost.minerio || 0) + (t < 240 ? 40 : 0);
      if (S.canAfford(p, cost)) {
        let s = null;
        if (def === 'nodulo') {
          // nearest unclaimed node
          let best = null, bdist = Infinity;
          for (const e of sim.ents) {
            if (!e.alive || e.kind !== 'node' || e.amount <= 0) continue;
            if (S.territoryOwner(sim, e.x, e.y) !== -1) continue;
            const d = S.dist(nuc.x, nuc.y, e.x, e.y); if (d < bdist) { bdist = d; best = e; }
          }
          if (best) s = findSpot(sim, mem.pid, 'nodulo', best.x, best.y, 60, 140, 30);
          if (!s) s = findSpot(sim, mem.pid, 'nodulo', nuc.x, nuc.y, 380, 600, 30);
        } else if (def === 'refinaria') {
          // near centroid of own-territory nodes
          let sx = 0, sy = 0, n = 0;
          for (const e of sim.ents) if (e.alive && e.kind === 'node' && S.inTerritory(sim, mem.pid, e.x, e.y)) { sx += e.x; sy += e.y; n++; }
          if (n) s = findSpot(sim, mem.pid, 'refinaria', sx / n, sy / n, 50, 160, 30);
          if (!s) s = findSpot(sim, mem.pid, 'refinaria', nuc.x, nuc.y, 90, 300, 30);
        } else if (def === 'torre') {
          const en = nearestEnemyNucleoPos(sim, mem.pid);
          if (en) { const a = Math.atan2(en.y - nuc.y, en.x - nuc.x); s = findSpot(sim, mem.pid, 'torre', nuc.x + Math.cos(a) * 240, nuc.y + Math.sin(a) * 240, 0, 110, 30); }
          if (!s) s = findSpot(sim, mem.pid, 'torre', nuc.x, nuc.y, 150, 330, 30);
        } else s = findSpot(sim, mem.pid, def, nuc.x, nuc.y, 90, 320, 40);
        if (s) { emit({ t: 'build', def, x: s.x, y: s.y }); if (mem.bo < order.length) mem.bo++; }
        else if (mem.bo < order.length) mem.bo++; // skip impossible step
      }
    }
  }

  // --- research & super
  if (S.hasBuilt(sim, mem.pid, 'laboratorio')) {
    for (const key of ['armamento', 'blindagem', 'sensores']) if (!p.research[key] && S.canAfford(p, S.RESEARCH[key].cost) && p.res.dados > 160) { emit({ t: 'research', key }); break; }
    if (t >= p.superCd && S.canAfford(p, { dados: 300, plasma: 300 })) {
      const fac = S.FACTIONS[p.faction];
      if (fac.superKey === 'fundicao') {
        const en = nearestEnemyNucleoPos(sim, mem.pid);
        if (en) { const a = Math.atan2(en.y - nuc.y, en.x - nuc.x); const s = findSpot(sim, mem.pid, 'bastiao', nuc.x + Math.cos(a) * 300, nuc.y + Math.sin(a) * 300, 0, 80, 30); if (s && S.inTerritory(sim, mem.pid, s.x, s.y)) emit({ t: 'super', x: s.x, y: s.y }); }
      } else if (mem.mode === 'attack') emit({ t: 'super' });
    }
  }
  if (p.energy.regime !== 'pleno' && p.res.plasma > 450 && t >= p.overchargeCd) emit({ t: 'overcharge' });

  // --- army production
  const prodBuildings = builds.filter(b => b.built && S.BUILDINGS[b.def].produces && b.def !== 'nucleo');
  const seen = mem.enemySeen; const total = seen.inf + seen.vei + seen.dro + seen.est + seen.sup + 0.01;
  const w = { infantaria: 0.35, veiculo: 0.3, drone: 0.3, suporte: 0.05 };
  w.veiculo += 0.5 * (seen.inf + seen.est) / total; w.drone += 0.5 * (seen.vei + seen.sup) / total; w.infantaria += 0.5 * (seen.dro + seen.sup) / total; w.suporte += 0.3 * (seen.vei + seen.est) / total;
  const reserveArmy = t < 240 ? D.reserve : 40;
  for (const b of prodBuildings) {
    if (b.queue.length >= 2) continue;
    const opts = S.BUILDINGS[b.def].produces.filter(u => u !== 'pirata' && u !== 'coletor');
    let pick = null, best = -1;
    for (const u of opts) { const sc = (w[u] || 0.1) * (0.7 + sim.rand() * 0.6); if (sc > best) { best = sc; pick = u; } }
    if (pick === 'suporte' && p.res.dados < 60) pick = 'infantaria';
    if (pick) { const c = Object.assign({}, S.UNITS[pick].cost); c.minerio = (c.minerio || 0) + reserveArmy; if (S.canAfford(p, c)) emit({ t: 'produce', id: b.id, def: pick }); }
  }
  // --- pirates
  const quartel = prodBuildings.find(b => b.def === 'quartel');
  if (quartel && t - mem.lastPirate > D.pirateEvery && pirates.length < 2 && S.canAfford(p, { minerio: 120 + reserveArmy, plasma: 30 }) && quartel.queue.length < 3) { mem.lastPirate = t; emit({ t: 'produce', id: quartel.id, def: 'pirata' }); }
  for (const pr of pirates) {
    if (pr.state !== 'idle') continue;
    let best = null, bd = Infinity;
    for (const [id, k] of mem.known) { if ((k.def === 'refinaria' || k.def === 'reator') && S.isEnemy(sim, mem.pid, k.owner)) { const d = S.dist(pr.x, pr.y, k.x, k.y); if (d < bd) { bd = d; best = id; } } }
    if (best && sim.vis[mem.pid].has(best)) emit({ t: 'siphon', ids: [pr.id], target: best });
    else if (best) { const k = mem.known.get(best); emit({ t: 'move', ids: [pr.id], x: k.x + (sim.rand() - 0.5) * 80, y: k.y + (sim.rand() - 0.5) * 80 }); }
    else { const en = nearestEnemyNucleoPos(sim, mem.pid); if (en && sim.rand() < 0.3) emit({ t: 'move', ids: [pr.id], x: en.x + (sim.rand() - 0.5) * 500, y: en.y + (sim.rand() - 0.5) * 500 }); }
  }

  // --- army control
  const value = S.armyValue(sim, mem.pid);
  const threshold = D.attackAt + Math.max(0, (t - 600) / 60) * 25;
  const attacked = builds.find(b => t - b.lastHitT < 6 && b.lastHitBy !== undefined && b.lastHitBy !== mem.pid);
  const rally = { x: nuc.x + (S.CX - nuc.x) * 0.12, y: nuc.y + (S.CY - nuc.y) * 0.12 };
  const ids = army.map(u => u.id);
  if (attacked && ids.length) {
    if (t - mem.lastAttackOrder > 4) { mem.lastAttackOrder = t; emit({ t: 'attackmove', ids, x: attacked.x, y: attacked.y }); }
    if (mem.mode === 'attack' && value < mem.attackStart * 0.5) mem.mode = 'defend';
  } else if (mem.mode === 'defend') {
    if (value >= threshold && ids.length >= 4 && t >= D.minAttack) {
      mem.mode = 'attack'; mem.attackStart = value; mem.target = null;
    } else if (t - mem.lastAttackOrder > 8) {
      const far = army.filter(u => u.state === 'idle' && S.dist(u.x, u.y, rally.x, rally.y) > 160).map(u => u.id);
      if (far.length) { mem.lastAttackOrder = t; emit({ t: 'attackmove', ids: far, x: rally.x, y: rally.y }); }
    }
  }
  if (mem.mode === 'attack' && !attacked) {
    if (value < mem.attackStart * 0.35 || ids.length === 0) { mem.mode = 'defend'; if (ids.length) emit({ t: 'move', ids, x: rally.x, y: rally.y }); }
    else {
      // choose target: nearest known enemy building, else enemy nucleo
      let tgt = null, bd = Infinity;
      for (const [id, k] of mem.known) if (S.isEnemy(sim, mem.pid, k.owner)) { const d = S.dist(nuc.x, nuc.y, k.x, k.y); if (d < bd) { bd = d; tgt = { x: k.x, y: k.y }; } }
      if (!tgt) tgt = nearestEnemyNucleoPos(sim, mem.pid);
      if (tgt && t - mem.lastAttackOrder > 5) { mem.lastAttackOrder = t; emit({ t: 'attackmove', ids, x: tgt.x, y: tgt.y }); }
      if (!tgt) mem.mode = 'defend';
    }
  }
  return cmds;
}

ARD.ai = { create, think };
})(globalThis.ARD = globalThis.ARD || {});
