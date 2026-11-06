/* IA de oponente (v2.0): módulos com estratégias nomeadas, duas cadências (tático 1 s, estratégico 60 s),
   avaliação de alvo por defesa, batedores, raids de piratas e muros na estratégia Fortaleza. Só emite comandos; usa o RNG da simulação. */
(function (ARD) {
'use strict';
const S = ARD.sim;

const BUILD_ORDERS = {
  vehnar:  ['reator', 'refinaria', 'quartel', 'nodulo', 'reator', 'fabrica', 'torre', 'reator', 'hangar', 'laboratorio', 'torre', 'nodulo', 'fabrica', 'reator', 'torre'],
  erevane: ['reator', 'quartel', 'refinaria', 'nodulo', 'reator', 'hangar', 'nodulo', 'torre', 'laboratorio', 'fabrica', 'reator', 'torre', 'quartel', 'reator'],
  tessara: ['reator', 'refinaria', 'quartel', 'nodulo', 'hangar', 'reator', 'laboratorio', 'torre', 'fabrica', 'nodulo', 'reator', 'torre', 'quartel'],
  quorith: ['reator', 'refinaria', 'quartel', 'nodulo', 'reator', 'laboratorio', 'fabrica', 'torre', 'reator', 'hangar', 'nodulo', 'torre', 'quartel', 'reator'],
  vorag:   ['reator', 'quartel', 'refinaria', 'nodulo', 'quartel', 'reator', 'nodulo', 'fabrica', 'torre', 'reator', 'hangar', 'laboratorio', 'nodulo', 'quartel', 'reator'],
};
const STRATS = {
  expansao:  { name: 'Expansão',            prod: { infantaria: 0.35, veiculo: 0.25, drone: 0.3, suporte: 0.1 }, col: 3, nodulos: 1, towers: 0, attackMul: 1.25, pirate: 1.0 },
  massa:     { name: 'Massa de Infantaria',  prod: { infantaria: 0.7, veiculo: 0.1, drone: 0.15, suporte: 0.05 }, col: 0, nodulos: 0, towers: 0, attackMul: 0.85, pirate: 0.7 },
  blindados: { name: 'Blindados',            prod: { infantaria: 0.15, veiculo: 0.55, drone: 0.2, suporte: 0.1 }, col: 1, nodulos: 0, towers: 0, attackMul: 1.0, pirate: 0.7 },
  roubo:     { name: 'Roubo',                prod: { infantaria: 0.4, veiculo: 0.15, drone: 0.4, suporte: 0.05 }, col: 1, nodulos: 0, towers: 0, attackMul: 1.35, pirate: 2.5 },
  fortaleza: { name: 'Fortaleza',            prod: { infantaria: 0.35, veiculo: 0.35, drone: 0.2, suporte: 0.1 }, col: 0, nodulos: 0, towers: 2, attackMul: 1.6, pirate: 0.5, walls: true },
};
const PREF = { vehnar: ['blindados', 'fortaleza', 'expansao', 'massa'], erevane: ['roubo', 'expansao', 'massa', 'blindados'], tessara: ['expansao', 'blindados', 'massa', 'roubo'], quorith: ['blindados', 'expansao', 'fortaleza', 'massa'], vorag: ['massa', 'expansao', 'roubo', 'blindados'] };
const CLASS_W = { voz: 'infantaria', agulha: 'infantaria', cria: 'infantaria', cuspidor: 'infantaria', prisma: 'veiculo', monolito: 'veiculo', escaravelho: 'veiculo', brutamonte: 'veiculo', harmonico: 'drone', ferroada: 'drone', diapasao: 'suporte', infantaria: 'infantaria', soldador: 'infantaria', atirador: 'infantaria', quimera: 'infantaria', veiculo: 'veiculo', prensa: 'veiculo', tratorzao: 'veiculo', lamina: 'veiculo', colosso: 'veiculo', drone: 'drone', mosquito: 'drone', esporo: 'drone', suporte: 'suporte', ancora: 'suporte', molde: 'suporte', guindaste: 'suporte' };
const VALUE = { refinaria: 3, nodulo: 2.5, reator: 2, laboratorio: 2, quartel: 1.5, fabrica: 1.5, hangar: 1.5, torre: 1, bastiao: 0.8, nucleo: 1.2, muro: 0.1, portao: 0.2 };

function create(pid, difficulty) {
  return { pid, dn: S.DIFFICULTY[difficulty] ? difficulty : 'normal', diff: S.DIFFICULTY[difficulty] || S.DIFFICULTY.normal, bo: 0, mode: 'defend', attackStart: 0, target: null, known: new Map(),
    lastPirate: 0, lastPropose: -999, lastExtra: 0, enemySeen: { inf: 0, vei: 0, dro: 0, est: 0, sup: 0 }, lastAttackOrder: -99,
    strategy: null, lastStrategic: -999, lostRecent: 0, armyPrev: 0, lastScout: -999, wallsBuilt: false, towersWanted: 0 };
}
function own(sim, pid) { return S.entitiesOf(sim, pid); }
function count(list, pred) { let n = 0; for (const e of list) if (pred(e)) n++; return n; }
function findSpot(sim, pid, def, cx, cy, rmin, rmax, tries) {
  for (let i = 0; i < tries; i++) { const a = sim.rand() * Math.PI * 2, r = rmin + sim.rand() * (rmax - rmin); const x = cx + S.DM.cos(a) * r, y = cy + S.DM.sin(a) * r; if (S.canBuild(sim, pid, def, x, y).ok) return { x, y }; }
  return null;
}
function nearestEnemyNucleoPos(sim, pid) {
  const me = S.nucleoOf(sim, pid); if (!me) return null; let best = null, bd = Infinity;
  for (const q of sim.players) { if (q.id === pid || !q.alive || S.hasPact(sim, pid, q.id)) continue; const n = S.nucleoOf(sim, q.id); if (!n) continue; const d = S.dist(me.x, me.y, n.x, n.y); if (d < bd) { bd = d; best = { x: n.x, y: n.y, owner: q.id, def: 'nucleo' }; } }
  if (!best && sim.modos && sim.modos.cac && S.bossOf) { const b = S.bossOf(sim); if (b && b.alive) { let t = b, td = Infinity; for (const id of (b.boss && b.boss.partes) || []) { const q = sim.byId.get(id); if (!q || !q.alive) continue; const d = S.dist(me.x, me.y, q.x, q.y); if (d < td) { td = d; t = q; } } best = { x: t.x, y: t.y, owner: b.owner, def: 'nucleo' }; } } /* 5.0g: na Caçada não há Núcleo inimigo: a IA aliada vai para o chefão (5.0g junção: primeiro para o ponto fraco vivo mais perto, os pilares e as pernas, que seguram o escudo) */
  return best;
}
function updateKnown(sim, mem) {
  const vis = sim.vis[mem.pid];
  for (const id of vis) { const e = sim.byId.get(id); if (e && e.alive && e.kind === 'building' && e.owner !== sim.mundo /* 5.0h: ruínas e o Acampamento não são alvo */) mem.known.set(id, { x: e.x, y: e.y, def: e.def, owner: e.owner }); }
  for (const [id, k] of mem.known) { const e = sim.byId.get(id); if (!e || !e.alive || !sim.players[k.owner].alive) mem.known.delete(id); }
  for (const k in mem.enemySeen) mem.enemySeen[k] *= 0.9;
  for (const id of vis) { const e = sim.byId.get(id); if (e && e.alive && e.kind === 'unit' && !e.fauna /* 5.0h */ && S.isEnemy(sim, mem.pid, e.owner) && mem.enemySeen[e.cls] !== undefined) mem.enemySeen[e.cls] += 1; }
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
  mem.towersWanted = 2 + (STRATS[mem.strategy].towers || 0) + Math.floor(t / 400); if (mem.diff.maxTowers != null) mem.towersWanted = Math.min(mem.towersWanted, mem.diff.maxTowers); /* 5.0a.1: Fácil constrói menos defesa */
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

/* 5.0h: a IA de antes (v2.0 a 5.0g), intacta: é a da campanha e a do perfil nulo (?perfil=nulo); as 20 missões dão a mesma saída */
function think2(sim, mem) {
  const cmds = []; const p = sim.players[mem.pid]; if (!p.alive || sim.result) return cmds;
  const t = sim.time; const D = mem.diff; const mine = own(sim, mem.pid);
  const nuc = mine.find(e => e.kind === 'building' && e.def === 'nucleo'); if (!nuc) return cmds;
  const builds = mine.filter(e => e.kind === 'building'); const units = mine.filter(e => e.kind === 'unit');
  const era = p.era || 1; const ERA_AT = { facil: [0, 0, 420, 840] /* 5.0a.1: antes 300 e 600 */, normal: [0, 0, 200, 420], dificil: [0, 0, 150, 330], brutal: [0, 0, 120, 280] }[mem.dn || 'normal'] || [0, 0, 200, 420];
  const collectors = units.filter(u => u.def === 'coletor'); const pirates = units.filter(u => u.def === 'pirata'); const army = units.filter(u => S.UNITS[u.def].attack && !u.scripted); // 4.0e: chefes de campanha obedecem só ao roteiro
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

  // --- 4.1d: evolução da Era (antes de gastar com o resto)
  if (era < 3 && !(p.evolveT > 0) && t >= ERA_AT[era + 1] && !S.eraBlock(sim, mem.pid)) { const nx = S.ERAS[era + 1]; const c = Object.assign({}, nx.cost); c.minerio = (c.minerio || 0) + 60; if (S.canAfford(p, c)) emitC({ t: 'evolve' }); }
  const eraDue = era < 3 && !(p.evolveT > 0) && t >= ERA_AT[era + 1] && !S.eraBlock(sim, mem.pid); const eraHold = eraDue ? S.ERAS[era + 1].cost.minerio + 60 : 0; // 4.1d: hora de evoluir: o resto espera o Núcleo
  // --- economia
  let terrNodes = 0, terrAmt = 0, terrMin = 0; for (const e of sim.ents) if (e.alive && e.kind === 'node' && e.amount > 0 && S.inTerritory(sim, mem.pid, e.x, e.y)) { terrNodes++; terrAmt += e.amount; if (e.res === 'minerio') terrMin += e.amount; }
  const lowNodes = terrAmt < 2500 || terrMin < 1200; // 4.1d: o território está secando: expandir já (antes a IA esgotava os nós aos 4 min e parava)
  if (!terrNodes && t - (mem.lastFar || -99) > 8) { mem.lastFar = t; const idle = collectors.filter(u => u.state === 'idle'); if (idle.length) { let best = null, bd = Infinity; for (const e of sim.ents) { if (!e.alive || e.amount <= 0 || (e.kind !== 'node' && e.kind !== 'wreck')) continue; const ow = S.territoryOwner(sim, e.x, e.y); if (ow !== -1 && ow !== mem.pid && S.isEnemy(sim, mem.pid, ow)) continue; const want = p.res.minerio < 400 ? 'minerio' : null; const d = S.dist(nuc.x, nuc.y, e.x, e.y) * (want && e.kind === 'node' && e.res !== want ? 3 : 1); if (d < bd) { bd = d; best = e; } } if (best) emitC({ t: 'harvest', ids: idle.map(u => u.id), target: best.id }); } } // 4.1d: nunca parar a renda
  const wantCol = Math.min(D.maxCol || 16, 6 + nodulos * 2 + strat.col);
  if (collectors.length + count(nuc.queue, q => q.def === 'coletor') < wantCol && nuc.queue.length < 2 && S.canAfford(p, S.UNITS.coletor.cost) && nuc.jumpT <= 0) emitC({ t: 'produce', id: nuc.id, def: 'coletor' });
  const reactors = count(builds, b => b.def === 'reator'); const towers = count(builds, b => b.def === 'torre');
  const needEnergy = p.energy.ratio < 1.1 && reactors < 8 && underConstruction < 2;
  const reserve = t < 240 ? D.reserve : 60;
  const paced = !D.buildEvery || t - (mem.lastBuild == null ? -999 : mem.lastBuild) >= D.buildEvery; // 4.1a: o ritmo vale para tudo, Reatores inclusive
  if (needEnergy && paced && S.canAfford(p, { minerio: S.BUILDINGS.reator.cost.minerio + reserve })) { const s = findSpot(sim, mem.pid, 'reator', nuc.x, nuc.y, 70, 260, 30); if (s) { emitC({ t: 'build', def: 'reator', x: s.x, y: s.y }); mem.lastBuild = t; } }
  else if (underConstruction < 2 && paced) { // 4.1a: Fácil/Normal constroem num ritmo humano
    const order = mem.order || (mem.order = (BUILD_ORDERS[p.faction] || BUILD_ORDERS.vehnar).slice()); let def = order[mem.bo];
    if (def && S.lockReason(sim, mem.pid, 'building', def)) { let j = mem.bo + 1; while (j < order.length && S.lockReason(sim, mem.pid, 'building', order[j])) j++; if (j < order.length) { const tmp = order[mem.bo]; order[mem.bo] = order[j]; order[j] = tmp; def = order[mem.bo]; } } // 4.1d: o trancado espera; adianta o próximo liberado
    while (def === 'torre' && D.maxTowers != null && towers >= D.maxTowers && mem.bo < order.length) { mem.bo++; def = order[mem.bo]; } /* 5.0a.1: Fácil pula as Torres além do limite */
    if (lowNodes && nodulos < 7 && t > 60 && def !== 'nodulo' && t - (mem.lastExpand || -99) > 25) { def = 'nodulo'; mem.emergency = true; } // território secando: expandir antes de tudo
    if (!def || mem.bo >= order.length) {
      if (towers < mem.towersWanted && t - mem.lastExtra > 45) { def = 'torre'; mem.lastExtra = t; }
      else if (nodulos < 2 + strat.nodulos + Math.floor(t / 500) && t - mem.lastExtra > 60) { def = 'nodulo'; mem.lastExtra = t; }
      else if (t - mem.lastExtra > 90 && era >= 2) { def = sim.rand() < 0.5 ? (p.faction === 'vehnar' ? 'fabrica' : 'hangar') : 'quartel'; mem.lastExtra = t; }
      else def = null;
    }
    if (def && S.lockReason(sim, mem.pid, 'building', def)) def = null; // 4.1d: tudo o que resta está trancado: espera a Era
    if (def) {
      const bd = S.BUILDINGS[def]; const cost = Object.assign({}, bd.cost); cost.minerio = (cost.minerio || 0) + (t < 240 ? 40 : 0) + (def === 'nodulo' && lowNodes ? 0 : eraHold);
      if (S.canAfford(p, cost)) {
        let s = null;
        if (def === 'nodulo') { let best = null, bdist = Infinity; for (const e of sim.ents) { if (!e.alive || e.kind !== 'node' || e.amount <= 0 || S.territoryOwner(sim, e.x, e.y) !== -1) continue; const d = S.dist(nuc.x, nuc.y, e.x, e.y); if (d < bdist) { bdist = d; best = e; } } if (best) s = findSpot(sim, mem.pid, 'nodulo', best.x, best.y, 60, 140, 30); if (!s) s = findSpot(sim, mem.pid, 'nodulo', nuc.x, nuc.y, 380, 600, 30); }
        else if (def === 'refinaria') { let sx = 0, sy = 0, n = 0; for (const e of sim.ents) if (e.alive && e.kind === 'node' && S.inTerritory(sim, mem.pid, e.x, e.y)) { sx += e.x; sy += e.y; n++; } if (n) s = findSpot(sim, mem.pid, 'refinaria', sx / n, sy / n, 50, 160, 30); if (!s) s = findSpot(sim, mem.pid, 'refinaria', nuc.x, nuc.y, 90, 300, 30); }
        else if (def === 'torre') { const en = nearestEnemyNucleoPos(sim, mem.pid); if (en) { const a = S.DM.atan2(en.y - nuc.y, en.x - nuc.x) + (sim.rand() - 0.5) * 1.2; s = findSpot(sim, mem.pid, 'torre', nuc.x + S.DM.cos(a) * 250, nuc.y + S.DM.sin(a) * 250, 0, 110, 30); } if (!s) s = findSpot(sim, mem.pid, 'torre', nuc.x, nuc.y, 150, 330, 30); }
        else s = findSpot(sim, mem.pid, def, nuc.x, nuc.y, 90, 320, 40);
        const inOrder = order[mem.bo] === def && !mem.emergency; mem.emergency = false; if (s) { emitC({ t: 'build', def, x: s.x, y: s.y }); mem.lastBuild = t; if (def === 'nodulo') mem.lastExpand = t; if (inOrder && mem.bo < order.length) mem.bo++; }
        else if (inOrder && mem.bo < order.length) mem.bo++;
      }
    }
  }
  // muros na Fortaleza: arco voltado para o inimigo mais próximo, com portão no meio
  if (strat.walls && D.walls !== false && !mem.wallsBuilt && t > 240 && p.res.minerio > 700) { /* 5.0a.1: Fácil sem muros */
    const en = nearestEnemyNucleoPos(sim, mem.pid);
    if (en) { const a0 = S.DM.atan2(en.y - nuc.y, en.x - nuc.x); const R = 300; let n = 0;
      for (let a = a0 - 0.7; a <= a0 + 0.7; a += 16 / R) { const x = nuc.x + S.DM.cos(a) * R, y = nuc.y + S.DM.sin(a) * R; const gate = Math.abs(a - a0) < 0.06; if (S.canBuild(sim, mem.pid, gate ? 'portao' : 'muro', x, y).ok) { emitC({ t: 'build', def: gate ? 'portao' : 'muro', x, y, ang: a + Math.PI / 2 }); n++; } }
      mem.wallsBuilt = true; }
  }
  // --- pesquisa, superarma, sobrecarga
  if (S.hasBuilt(sim, mem.pid, 'laboratorio')) {
    if (Object.keys(p.research).length < (D.research == null ? 3 : D.research)) for (const key of ['armamento', 'blindagem', 'sensores']) if (!p.research[key] && !S.lockReason(sim, mem.pid, 'research', key) && S.canAfford(p, S.RESEARCH[key].cost) && p.res.dados > 160) { emitC({ t: 'research', key }); break; }
    if (era >= 3 && !p.ascended && (D.research == null ? 3 : D.research) >= 2 && S.ASCENSION[p.faction] && S.canAfford(p, { minerio: S.ASCENSION[p.faction].cost.minerio + 150, plasma: S.ASCENSION[p.faction].cost.plasma + 60, dados: S.ASCENSION[p.faction].cost.dados })) emitC({ t: 'ascend' });
    if (D.superweapon !== false && t >= p.superCd && S.canAfford(p, { dados: 300, plasma: 300 })) { const fac = S.FACTIONS[p.faction]; if (fac.superKey === 'fundicao') { const en = nearestEnemyNucleoPos(sim, mem.pid); if (en) { const a = S.DM.atan2(en.y - nuc.y, en.x - nuc.x); const s = findSpot(sim, mem.pid, 'bastiao', nuc.x + S.DM.cos(a) * 300, nuc.y + S.DM.sin(a) * 300, 0, 80, 30); if (s && S.inTerritory(sim, mem.pid, s.x, s.y)) emitC({ t: 'super', x: s.x, y: s.y }); } } else if (fac.superKey === 'eclosao') { if (mem.mode === 'attack' && mem.target) emitC({ t: 'super', x: mem.target.x, y: mem.target.y }); } else if (mem.mode === 'attack') emitC({ t: 'super' }); }
  }
  if (p.energy.regime !== 'pleno' && p.res.plasma > 450 && t >= p.overchargeCd) emitC({ t: 'overcharge' });
  // 4.1d: módulos (um por vez): Fusão nos Reatores, Academia no Quartel, Bateria Pesada nas Torres
  if (era >= 2 && !eraDue && !(mem.lastModule > t - 20) && p.res.minerio > 400) { const cand = builds.find(b => b.built && !b.mod && !(b.upT > 0) && S.BUILDINGS[b.def].module && !S.lockReason(sim, mem.pid, 'module', b.def) && S.canAfford(p, S.BUILDINGS[b.def].module.cost) && (b.def !== 'reator' || p.energy.ratio < 1.4)); if (cand) { emitC({ t: 'upgrade', id: cand.id }); mem.lastModule = t; } }

  // --- produção: estratégia + contras do que foi visto
  const prodBuildings = builds.filter(b => b.built && S.BUILDINGS[b.def].produces && b.def !== 'nucleo');
  const seen = mem.enemySeen; const total = seen.inf + seen.vei + seen.dro + seen.est + seen.sup + 0.01;
  const w = Object.assign({}, strat.prod);
  w.veiculo += 0.5 * (seen.inf + seen.est) / total; w.drone += 0.5 * (seen.vei + seen.sup) / total; w.infantaria += 0.5 * (seen.dro + seen.sup) / total; w.suporte += 0.3 * (seen.vei + seen.est) / total;
  const reserveArmy = (t < 240 ? D.reserve : 40) + (lowNodes && nodulos < 7 ? 140 : 0) + eraHold; // 4.1d: guarda para expandir e para a Era
  let prodOrders = 0; const prodPaced = !D.prodEvery || t - (mem.lastProd == null ? -999 : mem.lastProd) >= D.prodEvery; // 4.1a: ritmo de produção por nível
  for (const b of prodBuildings) {
    if (!prodPaced || b.queue.length >= 2 || prodOrders >= (D.maxProd || 9)) continue; const opts = S.producesFor(b.def, p.faction).filter(u => u !== 'pirata' && u !== 'coletor' && !S.lockReason(sim, mem.pid, 'unit', u));
    let pick = null, best = -1;
    for (const u of opts) { const ud = S.UNITS[u]; const cls = CLASS_W[u] || 'infantaria'; let sc = (w[cls] || 0.1) * (0.7 + sim.rand() * 0.6); if (!ud.attack) sc *= 0.35; if (ud.cost.dados && p.res.dados < (ud.cost.dados + 40)) sc = 0; if (S.unitCost(u) > 300 && t < 420) sc *= 0.3; if (sc > best) { best = sc; pick = u; } }
    if (pick === 'suporte' && p.res.dados < 60) pick = opts.includes('infantaria') ? 'infantaria' : null;
    if (pick) { const c = Object.assign({}, S.UNITS[pick].cost); c.minerio = (c.minerio || 0) + reserveArmy; if (S.canAfford(p, c)) { emitC({ t: 'produce', id: b.id, def: pick }); prodOrders++; mem.lastProd = t; } }
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
  if (D.scout !== false && t - mem.lastScout > 90 && t > 120) { // batedor: uma unidade barata vai olhar a base inimiga (5.0a.1: o Fácil não manda batedor, que caçava coletores)
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
      if (mem.target && t - mem.lastAttackOrder > 5) { mem.lastAttackOrder = t; const frac = D.attackFrac == null ? 1 : D.attackFrac; let sent = frac >= 1 ? ids : ids.filter((id, i) => (i % 10) < Math.round(frac * 10)); if (D.waveMax) sent = sent.slice(0, D.waveMax); /* 5.0a.1: ondas pequenas no Fácil */ if (sent.length) emitC({ t: 'attackmove', ids: sent, x: mem.target.x, y: mem.target.y }); }
      if (!mem.target) mem.mode = 'defend';
    }
  }
  return cmds;
}
// 4.1c: memória da IA no salvamento (a tabela de dificuldade volta pelo nome; o mapa de prédios conhecidos vira lista)
function snapshot(mem) { const o = S.jsonSafe(Object.assign({}, mem, { diff: null, known: null })); o.dn = Object.keys(S.DIFFICULTY).find(k => S.DIFFICULTY[k] === mem.diff) || 'normal'; o.known = [...mem.known].map(([id, k]) => [id, S.jsonSafe(k)]); return o; }
function restore(o) { const mem = S.jsonBack(Object.assign({}, o, { known: null })); mem.diff = S.DIFFICULTY[o.dn] || S.DIFFICULTY.normal; mem.known = new Map(o.known.map(([id, k]) => [id, S.jsonBack(k)])); return mem; }
// ======================= 5.0h: IA 3.0 =======================
/* Personalidade por líder (mem.perfil = a Raça do líder), contra-composição por unidade e por habilidade, microgestão (foco, recuo dos feridos,
   distância das armas de alcance e desvio da telegrafia dos chefões), ataque em duas frentes, assédio aos Coletores, coalizão contra quem está na
   frente e traição calculada, pedidos da IA aliada (comando { t: 'pedido' }), falas pelo retrato ({ t: 'ia', ev: 'fala' }, só interface, fora do
   hash) e ganchos para ruínas, mercenários, módulos, construções únicas e comandantes (5.0h, só quando existirem). Só emite comandos; números só
   do sim.rand() e do tique. Perfil nulo (campanha e ?perfil=nulo) = a IA de antes (think2), sem mudar nada. */
const PERFIS = {
  /* Barão-Forja: fortaleza (Torres e muros cedo), depois o empurrão blindado na Era II */
  vehnar:  { lider: 'Barão-Forja', prefs: ['fortaleza', 'blindados'], empurrao: { t: 480, era: 2 }, torres: 1, muroT: 200, muroMin: 560, prod: { veiculo: 0.3 }, ataque: 1.1, minAtk: 1.0, col: 0, nod: 0, era: 1, pirata: 0.6, assedio: 0, frentes: 0, sinc: 0.5, coalizao: 0.7, trai: 1, super: 'cedo', modulo: 0, recuo: 0.3 },
  /* Vesper Ísk: furtividade, roubo e assédio (Piratas, Coletores e uma segunda frente) */
  erevane: { lider: 'Vesper Ísk', prefs: ['expansao', 'roubo'], torres: 0, prod: { drone: 0.15, infantaria: 0.1 }, ataque: 0.95, minAtk: 0.9, col: 1, nod: 0, era: 1, pirata: 1.0, assedio: 1, frentes: 1, sinc: 0, coalizao: 0.8, trai: 1.5, super: 'ataque', modulo: 1, recuo: 0.35 },
  /* Sylvia Oriel: expansão (Nódulos e Coletores a mais), diplomacia e evolução (Eras antes, pesquisa e Ascensão) */
  tessara: { lider: 'Sylvia Oriel', prefs: ['blindados', 'expansao'], torres: 0, prod: { suporte: 0.05 }, ataque: 0.85, minAtk: 1.0, col: 1, nod: 1, era: 0.9, pesquisa: 3, ascende: true, pirata: 0.8, assedio: 0, frentes: 0, sinc: 0.4, coalizao: 1.6, trai: 0.4, super: 'combate', modulo: 0, recuo: 0.3 },
  /* Zayin Coral: exército sincronizado (reúne antes de atacar, para o Elo) e o Uníssono no meio do combate */
  quorith: { lider: 'Zayin Coral', prefs: ['blindados', 'expansao'], torres: 0, prod: {}, ataque: 1.0, minAtk: 1.0, col: 1, nod: 0, era: 1, pirata: 0.8, assedio: 0, frentes: 0, sinc: 1, coalizao: 1, trai: 0.8, super: 'combate', modulo: 1, recuo: 0.3 },
  /* Oru Voraz: pressa (ataca cedo), enxame (Crias) e a Eclosão em cima do alvo */
  vorag:   { lider: 'Oru Voraz', prefs: ['massa', 'roubo'], torres: 0, prod: { infantaria: 0.15 }, ataque: 0.85, minAtk: 0.8, col: 0, nod: 1, era: 1, pirata: 1, assedio: 1, frentes: 1, sinc: 0, coalizao: 0.6, trai: 1.2, super: 'ataque', modulo: 0, recuo: 0.25 },
};
const CAC_D = { prodEvery: 1, maxProd: 4, buildEvery: 4, reserve: 60 };
const BO_CAC = { /* Caçada: defesa e exército antes de tudo; contra a Forja-Mãe, voadores (o pisão e o calor não pegam quem voa) */
  arauto: ['reator', 'quartel', 'refinaria', 'torre', 'reator', 'fabrica', 'hangar', 'torre', 'laboratorio', 'reator', 'quartel', 'nodulo', 'fabrica', 'reator', 'torre'],
  forja: ['reator', 'quartel', 'refinaria', 'reator', 'hangar', 'hangar', 'reator', 'hangar', 'torre', 'laboratorio', 'reator', 'hangar', 'nodulo', 'reator', 'torre'] };
const CERCO = { prensa: 1, colosso: 1, monolito: 1, brutamonte: 1, catedral: 1, matriarca: 1 };
const CURA = { guindaste: 1, ancora: 1, molde: 1, diapasao: 1 };
/* perfil da IA: ?perfil= (cfg.iaPerfil: 'nulo' = a IA de antes; uma Raça = esse líder para todas as IAs); campanha = nulo; senão, o líder da Raça */
function perfilDe(sim, p) { const c = (sim && sim.cfg) || {}; const k = c.iaPerfil; if (k === 'nulo' || k === 'off' || k === '0') return null; if (k && PERFIS[k]) return k; if (c.campanha) return null; return p && PERFIS[p.faction] ? p.faction : null; }
function think(sim, mem) {
  if (mem.perfil === undefined) mem.perfil = perfilDe(sim, sim.players[mem.pid]); /* salvamento antigo ou IA nova: perfil padrão */
  return mem.perfil && PERFIS[mem.perfil] ? think3(sim, mem) : think2(sim, mem);
}
function v3de(mem) { const v = mem.v3 || (mem.v3 = {}); const d = { fase: 'livre', faseT: 0, ponto: null, flanco: null, raid: null, raidT: -999, prodExtraT: -999, alarme: -999, desvio: {}, ferido: {}, foco: {}, uv: {}, colVisto: null, lider: -1, liderForte: false, liderT: -999, coalT: -999, falaT: -999, falaK: {}, pedidoT: -1, pedido: null, alvoDono: -1, ruina: null, ruinaT: -999, mercT: -999, unicaT: -999, modT: -999, habT: -999, superT: -999, captura: null, nAtaques: 0, inicio: false, chefeFase: 0 };
  for (const k in d) if (v[k] === undefined) v[k] = d[k]; return v; }
/* contra-composição: o que foi visto por unidade (decai 10% por segundo) vira contagem por classe e por habilidade */
function veMundo(sim, mem, v) {
  const vis = sim.vis[mem.pid]; const uv = v.uv; for (const k in uv) { uv[k] *= 0.9; if (uv[k] < 0.05) delete uv[k]; }
  let cx = 0, cy = 0, cn = 0;
  for (const id of vis) { const e = sim.byId.get(id); if (!e || !e.alive) continue;
    if (e.kind === 'building') { if (e.owner !== sim.mundo /* 5.0h junção: ruínas e o Acampamento não são alvo (h-mundo) */) mem.known.set(id, { x: e.x, y: e.y, def: e.def, owner: e.owner }); continue; }
    if (e.kind !== 'unit' || e.fauna /* 5.0h junção: a fauna não entra na contra-composição (h-mundo) */ || !S.isEnemy(sim, mem.pid, e.owner)) continue;
    if (e.def === 'coletor') { cx += e.x; cy += e.y; cn++; continue; }
    uv[e.def] = (uv[e.def] || 0) + 1; }
  for (const [id, k] of mem.known) { const e = sim.byId.get(id); if (!e || !e.alive || !sim.players[k.owner] || !sim.players[k.owner].alive) mem.known.delete(id); }
  if (cn) v.colVisto = { x: cx / cn, y: cy / cn, t: sim.time };
  const s = { inf: 0, vei: 0, dro: 0, est: 0, sup: 0, voo: 0, camuf: 0, cerco: 0, cura: 0, pir: 0, enxame: 0, total: 0 };
  for (const k in uv) { const d = S.UNITS[k]; if (!d) continue; const n = uv[k]; if (s[d.cls] !== undefined) s[d.cls] += n; s.total += n; if (d.flying) s.voo += n; if (CERCO[k] || (d.weapon && S.WEAPONS[d.weapon] && S.WEAPONS[d.weapon].range >= 200)) s.cerco += n; if (CURA[k]) s.cura += n; if (k === 'pirata') s.pir += n; if (S.unitCost(k) <= 75) s.enxame += n;
    if (k === 'ancora' || k === 'atirador' || (d.faction === 'erevane') || k === 'pirata') s.camuf += n * (k === 'ancora' ? 3 : 1); }
  let torres = 0; for (const k of mem.known.values()) if ((k.def === 'torre' || k.def === 'bastiao') && S.isEnemy(sim, mem.pid, k.owner)) torres++; s.est = torres * 3;
  return s;
}
/* quanto uma unidade rende contra o que foi visto: dano que ela causa (tabela de contra) / dano que leva, e as habilidades que pesam */
function contra(def, s, cac) {
  const d = S.UNITS[def]; if (!d || !d.weapon) return 0.6; const C = S.COUNTER; const cls = d.cls; let off = 0, def2 = 0, n = 0;
  for (const k of ['inf', 'vei', 'dro', 'est', 'sup']) { const w = s[k]; if (!w) continue; off += w * ((C[cls] && C[cls][k]) || 1); def2 += w * ((C[k] && C[k][cls]) || 1); n += w; }
  let m = n > 2 ? Math.pow(Math.max(0.5, Math.min(2.2, (off / n) / (def2 / n))), 0.9) : 1;
  if (s.voo > 4 && (def === 'agulha' || (cls === 'inf' && !d.flying))) m *= def === 'agulha' ? 1.5 : 1.15; /* antiaéreo */
  if (s.cerco > 2 && (d.speed >= 120 || d.flying)) m *= 1.25; /* cerco: rápidos e voadores mergulham na artilharia */
  if (s.camuf > 4 && d.sensor >= 220) m *= 1.15; /* camuflagem: sensores longos */
  if (s.enxame > 6) { const w = S.WEAPONS[d.weapon]; if (w && w.splash >= 14) m *= 1 + Math.min(0.9, s.enxame / 25); } /* enxame (Crias, Mosquitos): dano em área */
  if (cac === 'forja') m *= d.flying ? 1.6 : 0.85; /* o pisão, o calor e o rastro da Forja-Mãe não pegam quem voa (mas só voadores dão pouco dano: o chão continua) */
  if (cac === 'arauto' && cls === 'inf' && !d.flying) m *= 1.2;
  return m;
}
const PLASMA_DE = {}; /* parte de Plasma no custo do que cada construção produz (para gastar o Plasma parado) */
function plasmaDe(def, fac) { const k = def + ':' + fac; if (PLASMA_DE[k] == null) { let m = 0; for (const u of S.producesFor(def, fac)) { const c = S.UNITS[u] && S.UNITS[u].cost; if (!c || u === 'coletor' || u === 'pirata') continue; m = Math.max(m, (c.plasma || 0) / ((c.minerio || 0) + (c.plasma || 0) + 1)); } PLASMA_DE[k] = m; } return PLASMA_DE[k]; }
function dentroAviso(a, e) {
  const rr = (e.r || 0) * 0.5;
  if (a.tipo === 'faixa') { const vx = a.x2 - a.x, vy = a.y2 - a.y, L2 = vx * vx + vy * vy; let k = L2 > 0 ? ((e.x - a.x) * vx + (e.y - a.y) * vy) / L2 : 0; k = k < 0 ? 0 : k > 1 ? 1 : k; return S.dist(a.x + vx * k, a.y + vy * k, e.x, e.y) <= a.w * 0.5 + rr + 12; }
  if (a.tipo === 'poco') return S.dist(a.x, a.y, e.x, e.y) <= a.w + rr + 12;
  return S.dist(a.x, a.y, e.x, e.y) <= a.r + rr + 12;
}
function fugaAviso(a, u) { /* ponto fora da forma avisada, pelo lado mais curto */
  const cl = z => Math.max(30, Math.min(S.WORLD - 30, z));
  if (a.tipo === 'faixa') { const vx = a.x2 - a.x, vy = a.y2 - a.y, L = Math.hypot(vx, vy) || 1; let nx = -vy / L, ny = vx / L; const lado = (u.x - a.x) * nx + (u.y - a.y) * ny; if (lado < 0) { nx = -nx; ny = -ny; } const k = Math.abs(lado); const sai = a.w * 0.5 + u.r + 34 - k; return { x: cl(u.x + nx * sai), y: cl(u.y + ny * sai) }; }
  const R = (a.tipo === 'poco' ? a.w : a.r) + u.r + 36; let dx = u.x - a.x, dy = u.y - a.y; let d = Math.hypot(dx, dy); if (d < 1) { dx = 1; dy = 0; d = 1; }
  return { x: cl(a.x + dx / d * R), y: cl(a.y + dy / d * R) };
}
/* fala pelo retrato: evento só de interface (fora do hash), com recarga por IA (35 s) e por fala (150 s) */
function fala(sim, mem, v, chave, para) { const t = sim.time; if (t - v.falaT < 35 || t - (v.falaK[chave] == null ? -999 : v.falaK[chave]) < 150) return; v.falaT = t; v.falaK[chave] = t; sim.events.push({ t: 'ia', ev: 'fala', p: mem.pid, chave, para: para == null ? -1 : para, time: t }); }
function frente(b) { const d = b.r + 170; return { x: Math.max(40, Math.min(S.WORLD - 40, b.x + S.DM.cos(b.ang || 0) * d)), y: Math.max(40, Math.min(S.WORLD - 40, b.y + S.DM.sin(b.ang || 0) * d)) }; }
function chefeVivo(sim) { if (!(sim.modos && sim.modos.cac) || !S.bossOf) return null; const b = S.bossOf(sim); return b && b.alive ? b : null; }
/* alvo de ataque da IA 3.0: valor / (1 + defesa), com o líder (coalizão) e o traído na frente; na Caçada, a parte viva do chefão mais perto */
function alvo3(sim, mem, v, from, P) {
  const boss = chefeVivo(sim);
  if (boss) { let cx = from.x, cy = from.y, cn = 1; for (const q of sim.players) { if (q.id === mem.pid || !q.alive || q.fenda || !S.hasPact(sim, mem.pid, q.id)) continue; const n = S.nucleoOf(sim, q.id); if (n) { cx += n.x; cy += n.y; cn++; } } cx /= cn; cy /= cn; /* o time escolhe a mesma parte: a mais perto do meio das bases */
    let t = boss, td = Infinity; for (const id of (boss.boss && boss.boss.partes) || []) { const q = sim.byId.get(id); if (!q || !q.alive) continue; const d = S.dist(cx, cy, q.x, q.y); if (d < td) { td = d; t = q; } } return { x: t.x, y: t.y, owner: boss.owner, def: 'nucleo', id: t.id, chefe: true }; }
  let best = null, bs = -Infinity; const cands = [];
  for (const [id, k] of mem.known) if (S.isEnemy(sim, mem.pid, k.owner)) cands.push({ x: k.x, y: k.y, def: k.def, owner: k.owner, id });
  const en = nearestEnemyNucleoPos(sim, mem.pid); if (en) { const n = S.nucleoOf(sim, en.owner); cands.push({ x: en.x, y: en.y, def: 'nucleo', owner: en.owner, id: n ? n.id : 0 }); }
  const strat = STRATS[mem.strategy] || STRATS.expansao;
  for (const k of cands) {
    let def = 0;
    for (const o of mem.known.values()) if (o.owner === k.owner && (o.def === 'torre' || o.def === 'bastiao') && S.dist(o.x, o.y, k.x, k.y) < 280) def += o.def === 'bastiao' ? 2 : 1;
    const d = S.dist(from.x, from.y, k.x, k.y); let val = VALUE[k.def] || 1; if (strat.pirate >= 2 && (k.def === 'refinaria' || k.def === 'reator')) val *= 1.5;
    if (k.owner === v.alvoDono) val *= 2; else if (v.liderForte && k.owner === v.lider) val *= 1.5;
    const sc = val / (1 + def) * (1 - Math.min(0.5, d / 4000));
    if (sc > bs) { bs = sc; best = k; }
  }
  return best;
}
function alvoValido(sim, mem, tg) { if (!tg) return false; if (tg.id) { const e = sim.byId.get(tg.id); return !!(e && e.alive && S.isEnemy(sim, mem.pid, e.owner)); } return mem.known.has(tg.id); }

function think3(sim, mem) {
  const cmds = []; const p = sim.players[mem.pid]; if (!p.alive || sim.result) return cmds;
  const P = PERFIS[mem.perfil]; const v = v3de(mem); const boss = chefeVivo(sim); const cac = boss ? boss.boss.tipo : null;
  const t = sim.time; const D = cac ? Object.assign({}, mem.diff, CAC_D) : mem.diff; const mine = own(sim, mem.pid); /* Caçada: a largada é rica (+900 de Minério): gasta no ritmo do Difícil */
  const nuc = mine.find(e => e.kind === 'building' && e.def === 'nucleo'); if (!nuc) return cmds;
  const builds = mine.filter(e => e.kind === 'building'); const units = mine.filter(e => e.kind === 'unit');
  const era = p.era || 1; const ERA_AT = ({ facil: [0, 0, 420, 840], normal: [0, 0, 200, 420], dificil: [0, 0, 150, 330], brutal: [0, 0, 120, 280] }[mem.dn || 'normal'] || [0, 0, 200, 420]).map(x => x * P.era); if (cac) { ERA_AT[2] = Math.min(ERA_AT[2], 50); ERA_AT[3] = cac === 'forja' ? 900 : Math.min(ERA_AT[3], 300); } /* Caçada: a Era II libera o Hangar e a Fábrica */
  const collectors = units.filter(u => u.def === 'coletor'); const pirates = units.filter(u => u.def === 'pirata'); const army = units.filter(u => S.UNITS[u.def].attack && !u.scripted);
  const guardaCol = collectors.length < 4 ? 180 : 70; const gasto = { minerio: 0, plasma: 0, dados: 0 }; for (const b of builds) for (const it of b.queue) if (!it.paid && S.UNITS[it.def]) { const c = S.UNITS[it.def].cost, m = it.mult || 1; gasto.minerio += (c.minerio || 0) * m; gasto.plasma += (c.plasma || 0) * m; gasto.dados += (c.dados || 0) * m; } /* a fila paga quando começa: o que já está nela está comprometido */
  const pode = c => { const q = { minerio: (c.minerio || 0) + guardaCol + gasto.minerio, plasma: (c.plasma || 0) + gasto.plasma, dados: (c.dados || 0) + gasto.dados }; if (!S.canAfford(p, q)) return false; gasto.minerio += c.minerio || 0; gasto.plasma += c.plasma || 0; gasto.dados += c.dados || 0; return true; }; /* 5.0h: o que já foi pedido neste segundo conta; sem Coletores, o último Minério é para eles */
  const nodulos = count(builds, b => b.def === 'nodulo'); const underConstruction = count(builds, b => !b.built);
  const seen = veMundo(sim, mem, v);
  for (const k in mem.enemySeen) mem.enemySeen[k] = seen[k] || 0;
  const emitC = c => { c.p = mem.pid; cmds.push(c); };
  const human = sim.players.find(q => q.human && q.alive);
  if (!v.inicio && t >= 6 + mem.pid * 3) { v.inicio = true; fala(sim, mem, v, cac ? 'chefe' : 'inicio', -1); }
  if (t - mem.lastStrategic >= 60 || !mem.strategy) { mem.lastStrategic = t; strategic3(sim, mem, p, P, v); }
  const strat = STRATS[mem.strategy] || STRATS.expansao; const w0 = Object.assign({}, strat.prod); for (const k in P.prod) w0[k] = (w0[k] || 0) + P.prod[k];
  /* faxina das marcas por unidade (ids mortos ou vencidos) */
  if (sim.tick % 300 === 0) for (const m of [v.desvio, v.ferido, v.foco]) for (const k in m) if (m[k] < t || !sim.byId.get(+k)) delete m[k];

  // --- 5.0h: placar (coalizão contra quem está na frente), a cada 30 s
  if (t - v.liderT >= 30 && (Math.floor(sim.tick / 10) % 7 === mem.pid % 7 || t - v.liderT > 40)) { v.liderT = t; const sc = {}; for (const e of sim.ents) { if (!e.alive || e.owner < 0) continue; if (e.kind === 'building') sc[e.owner] = (sc[e.owner] || 0) + (S.BUILDINGS[e.def].wall ? 10 : 100) + (e.def === 'nodulo' ? 300 : 0); else if (e.kind === 'unit') sc[e.owner] = (sc[e.owner] || 0) + S.unitCost(e.def); }
    const ls = sim.players.filter(q => q.alive && !q.fenda).map(q => ({ id: q.id, s: sc[q.id] || 0 })).sort((a, b) => b.s - a.s || a.id - b.id);
    v.lider = ls.length ? ls[0].id : -1; v.liderForte = ls.length >= 3 && ls[0].s > ls[1].s * 1.3 && ls[0].s > 2500; }
  const coalizao = v.liderForte && v.lider !== mem.pid && !cac; let meuV = 0; for (const u of units) { const d = S.UNITS[u.def]; if (d.attack && !d.epic) meuV += S.unitCost(u.def); } /* = S.armyValue, sem varrer a partida */

  // --- diplomacia: coalizão contra o líder e traição calculada
  for (const pr of sim.pending) {
    if (pr.to !== mem.pid) continue; const other = sim.players[pr.from];
    const myV = meuV, theirV = S.armyValue(sim, pr.from);
    let pAcc = D.acceptP; let pFraco = 0.25; if (coalizao) { if (pr.from === v.lider) pAcc *= 0.3; else { pAcc = Math.min(1, pAcc + 0.3 * P.coalizao); pFraco = 0.25 + 0.3 * P.coalizao; } }
    const accept = other.rep >= -1 && (myV < theirV * 1.15 || sim.rand() < pFraco) && sim.rand() < pAcc;
    emitC({ t: 'respond', to: pr.from, accept }); if (other.human) fala(sim, mem, v, accept ? 'pacto' : 'recusa', pr.from);
  }
  if (!cac) {
    if (human && t > 180 && !S.hasPact(sim, mem.pid, human.id) && t - mem.lastPropose > 150 && meuV < S.armyValue(sim, human.id) * 0.6 && sim.rand() < 0.5) { mem.lastPropose = t; emitC({ t: 'propose', to: human.id }); }
    else if (coalizao && t > 240 && t - v.coalT > 120 / P.coalizao && pode({ minerio: S.pactCost(p) + 200 })) { /* coalizão: propõe pacto a quem não é o líder */
      const q = sim.players.filter(q => q.alive && !q.fenda && q.id !== mem.pid && q.id !== v.lider && !S.hasPact(sim, mem.pid, q.id) && !sim.pending.some(pr => pr.from === mem.pid && pr.to === q.id))[0];
      if (q && sim.rand() < 0.6) { v.coalT = t; emitC({ t: 'propose', to: q.id }); if (q.human) fala(sim, mem, v, 'coalizao', q.id); } }
    for (const k in p.pacts) { const pact = p.pacts[k]; const q = sim.players[k]; if (!q || !q.alive || pact.fixo) continue; if (!(D.breakP > 0) || t - pact.since <= 180) continue;
      const myV = meuV, qV = S.armyValue(sim, q.id);
      const calc = (v.liderForte && q.id === v.lider && myV > qV * 0.9) ? D.breakP / 25 : myV > qV * 1.6 ? D.breakP / 60 : 0; /* o aliado virou o líder: hora de trair */
      if (calc > 0 && sim.rand() < calc * P.trai) { emitC({ t: 'break', with: q.id }); mem.mode = 'attack'; mem.attackStart = myV; mem.target = null; v.alvoDono = q.id; v.fase = 'ataque'; v.faseT = t; if (q.human) fala(sim, mem, v, 'trai', q.id); break; } }
  }
  if (v.alvoDono >= 0 && (!sim.players[v.alvoDono] || !sim.players[v.alvoDono].alive || S.hasPact(sim, mem.pid, v.alvoDono))) v.alvoDono = -1;

  // --- pedido de um aliado (comando 'pedido', guardado em p.pedido pela simulação)
  const ped = p.pedido && t - p.pedido.t < 120 && sim.players[p.pedido.de] && sim.players[p.pedido.de].alive ? p.pedido : null;
  if (ped && v.pedidoT !== ped.t) { v.pedidoT = ped.t; fala(sim, mem, v, 'pedido', ped.de); if (ped.tipo === 'defender') { mem.mode = 'defend'; v.fase = 'livre'; mem.lastAttackOrder = -99; } }

  // --- evolução da Era
  if (era < 3 && !(p.evolveT > 0) && t >= ERA_AT[era + 1] && !S.eraBlock(sim, mem.pid)) { const nx = S.ERAS[era + 1]; const c = Object.assign({}, nx.cost); c.minerio = (c.minerio || 0) + 60; if (pode(c)) emitC({ t: 'evolve' }); }
  const eraDue = era < 3 && !(p.evolveT > 0) && t >= ERA_AT[era + 1] && !S.eraBlock(sim, mem.pid); const eraHold = eraDue ? S.ERAS[era + 1].cost.minerio + 60 : 0;
  // --- economia
  if (!v.terr || (Math.floor(sim.tick / 10) + mem.pid) % 4 === 0) { let n = 0, amt = 0, mi = 0; for (const e of sim.ents) if (e.alive && e.kind === 'node' && e.amount > 0 && S.inTerritory(sim, mem.pid, e.x, e.y)) { n++; amt += e.amount; if (e.res === 'minerio') mi += e.amount; } v.terr = { n, amt, mi }; } /* 5.0h: o território é contado a cada 4 s, cada IA num segundo */
  const terrNodes = v.terr.n, terrAmt = v.terr.amt, terrMin = v.terr.mi;
  const lowNodes = terrAmt < 2500 || terrMin < 1200;
  if (!terrNodes && t - (mem.lastFar || -99) > 8) { mem.lastFar = t; const idle = collectors.filter(u => u.state === 'idle'); if (idle.length) { let best = null, bd = Infinity; for (const e of sim.ents) { if (!e.alive || e.amount <= 0 || (e.kind !== 'node' && e.kind !== 'wreck')) continue; const ow = S.territoryOwner(sim, e.x, e.y); if (ow !== -1 && ow !== mem.pid && S.isEnemy(sim, mem.pid, ow)) continue; const want = p.res.minerio < 400 ? 'minerio' : null; const d = S.dist(nuc.x, nuc.y, e.x, e.y) * (want && e.kind === 'node' && e.res !== want ? 3 : 1); if (d < bd) { bd = d; best = e; } } if (best) emitC({ t: 'harvest', ids: idle.map(u => u.id), target: best.id }); } }
  if (boss && t - (v.colSegT || -99) >= 4) { v.colSegT = t; const alc = cac === 'arauto' ? 960 : boss.r + 260; /* Caçada: Coletores colhem fora do alcance dos golpes */
    const perto = collectors.filter(u => S.dist(u.x, u.y, boss.x, boss.y) < alc && !(v.desvio[u.id] > t)); if (perto.length) { let best = null, bs = -Infinity; for (const e of sim.ents) { if (!e.alive || e.kind !== 'node' || e.amount <= 0 || !S.inTerritory(sim, mem.pid, e.x, e.y)) continue; const db = S.dist(e.x, e.y, boss.x, boss.y); if (db < alc + 60) continue; const sc = -S.dist(e.x, e.y, nuc.x, nuc.y) + (e.res === 'minerio' ? 200 : 0); if (sc > bs) { bs = sc; best = e; } } if (best) emitC({ t: 'harvest', ids: perto.map(u => u.id), target: best.id }); } }
  if (collectors.length < 3 && p.res.minerio < 120 && t - (v.falenciaT || -99) > 5) { v.falenciaT = t; for (const b of builds) { if (b.def === 'nucleo' || !b.queue.length) continue; const defs = []; for (const it of b.queue) if (!defs.includes(it.def)) defs.push(it.def); for (const d of defs) emitC({ t: 'cancel', id: b.id, def: d, all: true }); } } /* quase sem Coletores e sem Minério: a fila de exército devolve o dinheiro, que vai para os Coletores */
  const expandir = ped && ped.tipo === 'expandir';
  const wantCol = Math.min((D.maxCol || 16) + (P.col > 1 ? 2 : 0), 6 + nodulos * 2 + strat.col + P.col + (expandir ? 2 : 0));
  if (collectors.length + count(nuc.queue, q => q.def === 'coletor') < wantCol && nuc.queue.length < 2 && S.canAfford(p, S.UNITS.coletor.cost) && nuc.jumpT <= 0) emitC({ t: 'produce', id: nuc.id, def: 'coletor' });
  const reactors = count(builds, b => b.def === 'reator'); const towers = count(builds, b => b.def === 'torre');
  const needEnergy = p.energy.ratio < 1.1 && reactors < 8 && underConstruction < 2;
  const reserve = t < 240 ? D.reserve : 60;
  const paced = !D.buildEvery || t - (mem.lastBuild == null ? -999 : mem.lastBuild) >= D.buildEvery;
  if (needEnergy && paced && pode({ minerio: S.BUILDINGS.reator.cost.minerio + reserve })) { const s = findSpot(sim, mem.pid, 'reator', nuc.x, nuc.y, 70, 260, 30); if (s) { emitC({ t: 'build', def: 'reator', x: s.x, y: s.y }); mem.lastBuild = t; } }
  else if (underConstruction < 2 && paced) {
    const order = mem.order || (mem.order = (cac ? BO_CAC[cac] || BO_CAC.arauto : BUILD_ORDERS[p.faction] || BUILD_ORDERS.vehnar).slice()); let def = order[mem.bo];
    if (def && S.lockReason(sim, mem.pid, 'building', def)) { let j = mem.bo + 1; while (j < order.length && S.lockReason(sim, mem.pid, 'building', order[j])) j++; if (j < order.length) { const tmp = order[mem.bo]; order[mem.bo] = order[j]; order[j] = tmp; def = order[mem.bo]; } }
    while (def === 'torre' && D.maxTowers != null && towers >= D.maxTowers && mem.bo < order.length) { mem.bo++; def = order[mem.bo]; }
    const nodMax = 7 + P.nod;
    if ((lowNodes || expandir) && nodulos < nodMax && t > 60 && def !== 'nodulo' && t - (mem.lastExpand || -99) > (expandir ? 15 : 25)) { def = 'nodulo'; mem.emergency = true; }
    else if (!cac && t - v.alarme < 45 && t < 720 && towers < 2 + (mem.diff.maxTowers == null ? 1 : 0) && def !== 'torre' && (mem.diff.maxTowers == null || towers < mem.diff.maxTowers)) { def = 'torre'; mem.emergency = true; } /* pressa inimiga: Torre de emergência */
    if (!def || mem.bo >= order.length) {
      if (towers < mem.towersWanted && t - mem.lastExtra > (cac === 'forja' ? 12 : 45)) { def = 'torre'; mem.lastExtra = t; }
      else if (nodulos < 2 + strat.nodulos + P.nod + Math.floor(t / 500) && t - mem.lastExtra > 60) { def = 'nodulo'; mem.lastExtra = t; }
      else if (t - mem.lastExtra > 90 && era >= 2) { def = sim.rand() < 0.5 ? (p.faction === 'vehnar' ? 'fabrica' : 'hangar') : 'quartel'; mem.lastExtra = t; }
      else def = null;
    }
    if (def && S.lockReason(sim, mem.pid, 'building', def)) def = null;
    if (def) {
      const bd = S.BUILDINGS[def]; const cost = Object.assign({}, bd.cost); cost.minerio = (cost.minerio || 0) + (t < 240 ? 40 : 0) + (def === 'nodulo' && lowNodes ? 0 : eraHold);
      if (pode(cost)) {
        let s = null;
        if (def === 'nodulo') { const ox = expandir && ped.x != null ? ped.x : nuc.x, oy = expandir && ped.y != null ? ped.y : nuc.y; let best = null, bdist = Infinity; for (const e of sim.ents) { if (!e.alive || e.kind !== 'node' || e.amount <= 0 || S.territoryOwner(sim, e.x, e.y) !== -1) continue; const d = S.dist(ox, oy, e.x, e.y) + (expandir ? S.dist(nuc.x, nuc.y, e.x, e.y) * 0.3 : 0); if (d < bdist) { bdist = d; best = e; } } if (best) s = findSpot(sim, mem.pid, 'nodulo', best.x, best.y, 60, 140, 30); if (!s) s = findSpot(sim, mem.pid, 'nodulo', nuc.x, nuc.y, 380, 600, 30); }
        else if (def === 'refinaria') { let sx = 0, sy = 0, n = 0; for (const e of sim.ents) if (e.alive && e.kind === 'node' && S.inTerritory(sim, mem.pid, e.x, e.y)) { sx += e.x; sy += e.y; n++; } if (n) s = findSpot(sim, mem.pid, 'refinaria', sx / n, sy / n, 50, 160, 30); if (!s) s = findSpot(sim, mem.pid, 'refinaria', nuc.x, nuc.y, 90, 300, 30); }
        else if (def === 'torre') { const en = boss || nearestEnemyNucleoPos(sim, mem.pid); if (en) { const a = S.DM.atan2(en.y - nuc.y, en.x - nuc.x) + (sim.rand() - 0.5) * 1.2; s = findSpot(sim, mem.pid, 'torre', nuc.x + S.DM.cos(a) * 250, nuc.y + S.DM.sin(a) * 250, 0, 110, 30); } if (!s) s = findSpot(sim, mem.pid, 'torre', nuc.x, nuc.y, 150, 330, 30); }
        else s = findSpot(sim, mem.pid, def, nuc.x, nuc.y, 90, 320, 40);
        const inOrder = order[mem.bo] === def && !mem.emergency; mem.emergency = false; if (s) { emitC({ t: 'build', def, x: s.x, y: s.y }); mem.lastBuild = t; if (def === 'nodulo') mem.lastExpand = t; if (inOrder && mem.bo < order.length) mem.bo++; }
        else if (inOrder && mem.bo < order.length) mem.bo++;
      }
    }
  }
  // Minério sobrando: mais uma fábrica de exército (a classe que a contra-composição pede), para o dinheiro não ficar parado
  if (p.res.minerio > (cac ? 650 : 700) && underConstruction < 3 && t - v.prodExtraT > (cac ? 12 : 25) && t > 75 && count(builds, b => S.BUILDINGS[b.def].produces && b.def !== 'nucleo') < 8) { v.prodExtraT = t;
    const rico = p.res.plasma > 500 && p.res.plasma > p.res.minerio; let def = null, bs = -9; /* a classe que a estratégia pede; com Plasma parado, a Fábrica e o Hangar; a que falta primeiro; no máximo 3 Quartéis */
    for (const [d, cls] of [['quartel', 'infantaria'], ['fabrica', 'veiculo'], ['hangar', 'drone']]) { if (S.lockReason(sim, mem.pid, 'building', d)) continue; const n = count(builds, b => b.def === d); let sc = (w0[cls] || 0) + (n === 0 ? 0.6 : 0) - n * 0.15 + (rico && d !== 'quartel' ? 0.5 : 0); if (d === 'quartel' && n >= 3) continue; if (sc > bs) { bs = sc; def = d; } }
    if (def && pode(S.BUILDINGS[def].cost)) { const s = findSpot(sim, mem.pid, def, nuc.x, nuc.y, 90, 320, 30); if (s) { emitC({ t: 'build', def, x: s.x, y: s.y }); mem.lastBuild = t; } } }
  // muros: o Barão ergue a fortaleza cedo; os outros só na estratégia Fortaleza
  if ((strat.walls || P.muroT) && D.walls !== false && !mem.wallsBuilt && t > (P.muroT || 240) && p.res.minerio > (P.muroMin || 700) && !cac) {
    const en = nearestEnemyNucleoPos(sim, mem.pid);
    if (en) { const a0 = S.DM.atan2(en.y - nuc.y, en.x - nuc.x); const R = 300; let n = 0;
      for (let a = a0 - 0.7; a <= a0 + 0.7; a += 16 / R) { const x = nuc.x + S.DM.cos(a) * R, y = nuc.y + S.DM.sin(a) * R; const gate = Math.abs(a - a0) < 0.06; if (S.canBuild(sim, mem.pid, gate ? 'portao' : 'muro', x, y).ok) { emitC({ t: 'build', def: gate ? 'portao' : 'muro', x, y, ang: a + Math.PI / 2 }); n++; } }
      mem.wallsBuilt = true; }
  }
  // --- pesquisa, Ascensão, superarma na hora certa, sobrecarga
  const engajados = count(army, u => t - u.lastAttack < 3);
  if (builds.some(b => b.def === 'laboratorio' && b.built)) {
    const nPesq = Math.max(D.research == null ? 3 : D.research, P.pesquisa && D.research != null && D.research >= 2 ? P.pesquisa : 0);
    if (Object.keys(p.research).length < nPesq) for (const key of ['armamento', 'blindagem', 'sensores']) if (!p.research[key] && !S.lockReason(sim, mem.pid, 'research', key) && pode(S.RESEARCH[key].cost) && p.res.dados > (P.pesquisa ? 120 : 160)) { emitC({ t: 'research', key }); break; }
    if (era >= 3 && !p.ascended && (D.research == null ? 3 : D.research) >= 2 && S.ASCENSION[p.faction]) { const ac = S.ASCENSION[p.faction].cost; const folga = P.ascende ? 0.5 : 1; if (pode({ minerio: ac.minerio + 150 * folga, plasma: ac.plasma + 60 * folga, dados: ac.dados })) emitC({ t: 'ascend' }); }
    if (D.superweapon !== false && t >= p.superCd && t - v.superT > 5 && pode({ dados: 300, plasma: 300 })) { const fac = S.FACTIONS[p.faction]; const tg = mem.target; const perto = tg && army.length && count(army, u => S.dist(u.x, u.y, tg.x, tg.y) < 600) >= Math.min(6, army.length * 0.5);
      let x = null, y = null, vai = false;
      if (fac.superKey === 'fundicao') { const en = boss || nearestEnemyNucleoPos(sim, mem.pid); if (en) { const a = S.DM.atan2(en.y - nuc.y, en.x - nuc.x); const s = findSpot(sim, mem.pid, 'bastiao', nuc.x + S.DM.cos(a) * 300, nuc.y + S.DM.sin(a) * 300, 0, 80, 30); if (s && S.inTerritory(sim, mem.pid, s.x, s.y)) { x = s.x; y = s.y; vai = true; } } }
      else if (fac.superKey === 'eclosao') { if (mem.mode === 'attack' && tg && perto && S.seesPoint(sim, mem.pid, tg.x, tg.y)) { x = tg.x; y = tg.y; vai = true; } }
      else if (P.super === 'combate') vai = mem.mode === 'attack' ? engajados >= 6 : engajados >= 10; /* Uníssono e Salto no meio do combate */
      else vai = mem.mode === 'attack' && (perto || engajados >= 6);
      if (vai) { v.superT = t; emitC(x != null ? { t: 'super', x, y } : { t: 'super' }); fala(sim, mem, v, 'super', -1); } }
  }
  if (p.energy.regime !== 'pleno' && p.res.plasma > 450 && t >= p.overchargeCd) emitC({ t: 'overcharge' });
  if (era >= 2 && !eraDue && !(mem.lastModule > t - 20) && p.res.minerio > 400) { const cand = builds.find(b => b.built && !b.mod && !(b.upT > 0) && S.BUILDINGS[b.def].module && !S.lockReason(sim, mem.pid, 'module', b.def) && pode(S.BUILDINGS[b.def].module.cost) && (b.def !== 'reator' || p.energy.ratio < 1.4)); if (cand) { emitC({ t: 'upgrade', id: cand.id }); mem.lastModule = t; } }
  ganchos(sim, mem, v, P, D, p, nuc, builds, army, emitC, era);

  // --- produção: estratégia + perfil + contra por unidade e por habilidade
  const prodBuildings = builds.filter(b => b.built && S.BUILDINGS[b.def].produces && b.def !== 'nucleo');
  const total = seen.inf + seen.vei + seen.dro + seen.est + seen.sup + 0.01;
  const w = Object.assign({}, strat.prod); for (const k in P.prod) w[k] = (w[k] || 0) + P.prod[k];
  w.veiculo += 0.35 * (seen.inf + seen.est) / total; w.drone += 0.35 * (seen.vei + seen.sup) / total; w.infantaria += 0.35 * (seen.dro + seen.sup) / total; w.suporte += 0.2 * (seen.vei + seen.est) / total;
  if (cac === 'forja') w.drone += 0.6; else if (cac === 'arauto') { w.infantaria += 0.2; w.veiculo += 0.2; }
  const reserveArmy = (t < 240 ? D.reserve : 40) + (lowNodes && nodulos < 7 ? 140 : 0) + eraHold + (collectors.length < Math.min(6, wantCol) ? 60 : 0) /* 5.0h: sem Coletor não há renda */; const plasmaRico = p.res.plasma > 500 && p.res.plasma > p.res.minerio * 1.5;
  let prodOrders = 0; const prodPaced = !D.prodEvery || t - (mem.lastProd == null ? -999 : mem.lastProd) >= D.prodEvery;
  { const n = prodBuildings.length; if (n > 1) { const r = (v.prodRot = ((v.prodRot || 0) + 1) % n); const rot = prodBuildings.slice(r).concat(prodBuildings.slice(0, r)); /* rodízio: a Fábrica e o Hangar também recebem ordens (antes o Quartel levava todas) */
      if (plasmaRico) rot.sort((a, b) => plasmaDe(b.def, p.faction) - plasmaDe(a.def, p.faction)); prodBuildings.length = 0; prodBuildings.push(...rot); } }
  for (const b of prodBuildings) {
    if (!prodPaced || b.queue.length >= 2 || prodOrders >= (D.maxProd || 9)) continue; const opts = S.producesFor(b.def, p.faction).filter(u => u !== 'pirata' && u !== 'coletor' && !S.lockReason(sim, mem.pid, 'unit', u));
    let pick = null, best = -1;
    for (const u of opts) { const ud = S.UNITS[u]; const cls = CLASS_W[u] || 'infantaria'; let sc = (w[cls] || 0.1) * (0.7 + sim.rand() * 0.6) * contra(u, seen, cac);
      if (plasmaRico) { const c = ud.cost; sc *= 1 + 1.5 * (c.plasma || 0) / ((c.minerio || 0) + (c.plasma || 0) + 1); } /* Plasma parado vira exército */
if (!ud.attack) sc *= 0.35; if (ud.cost.dados && p.res.dados < (ud.cost.dados + 40)) sc = 0; if (S.unitCost(u) > 300 && t < 420) sc *= 0.3; if (sc > best && sc > 0) { best = sc; pick = u; } }
    if (pick === 'suporte' && p.res.dados < 60) pick = opts.includes('infantaria') ? 'infantaria' : null;
    if (pick) { const c = Object.assign({}, S.UNITS[pick].cost); c.minerio = (c.minerio || 0) + reserveArmy; if (pode(c)) { emitC({ t: 'produce', id: b.id, def: pick }); prodOrders++; mem.lastProd = t; } }
  }
  // --- piratas (roubo) e batedores
  const quartel = prodBuildings.find(b => b.def === 'quartel');
  const pirMul = strat.pirate * P.pirata; const pirateEvery = D.pirateEvery / pirMul; const maxPirates = pirMul >= 2 ? 3 : 2;
  if (!cac && quartel && t - mem.lastPirate > pirateEvery && pirates.length < maxPirates && pode({ minerio: 120 + reserveArmy, plasma: 30 }) && quartel.queue.length < 3) { mem.lastPirate = t; emitC({ t: 'produce', id: quartel.id, def: 'pirata' }); }
  for (const pr of pirates) {
    if (pr.state !== 'idle') continue; let best = null, bd = Infinity;
    for (const [id, k] of mem.known) { if ((k.def === 'refinaria' || k.def === 'reator') && S.isEnemy(sim, mem.pid, k.owner)) { const d = S.dist(pr.x, pr.y, k.x, k.y) * (k.owner === v.lider && coalizao ? 0.7 : 1); if (d < bd) { bd = d; best = id; } } }
    if (best && sim.vis[mem.pid].has(best)) emitC({ t: 'siphon', ids: [pr.id], target: best });
    else if (best) { const k = mem.known.get(best); emitC({ t: 'move', ids: [pr.id], x: k.x + (sim.rand() - 0.5) * 80, y: k.y + (sim.rand() - 0.5) * 80 }); }
    else { const en = nearestEnemyNucleoPos(sim, mem.pid); if (en && sim.rand() < 0.5) emitC({ t: 'move', ids: [pr.id], x: en.x + (sim.rand() - 0.5) * 520, y: en.y + (sim.rand() - 0.5) * 520 }); }
  }
  if (D.scout !== false && t - mem.lastScout > 90 && t > 120 && !cac) {
    const en = nearestEnemyNucleoPos(sim, mem.pid); const scout = army.find(u => u.state === 'idle' && (u.def === 'drone' || u.def === 'infantaria' || u.def === 'tratorzao' || u.def === 'esporo'));
    if (en && scout) { mem.lastScout = t; emitC({ t: 'move', ids: [scout.id], x: en.x + (sim.rand() - 0.5) * 300, y: en.y + (sim.rand() - 0.5) * 300 }); }
  }

  // --- microgestão: desvio da telegrafia, foco, recuo dos feridos e distância das armas de alcance
  const rally0 = { x: nuc.x + (S.CX - nuc.x) * 0.12, y: nuc.y + (S.CY - nuc.y) * 0.12 };
  const defPonto = ped && ped.tipo === 'defender' ? (() => { const n = S.nucleoOf(sim, ped.de); return n ? { x: n.x + (S.CX - n.x) * 0.15, y: n.y + (S.CY - n.y) * 0.15 } : null; })() : null;
  const rally = defPonto || rally0;
  micro(sim, mem, v, P, D, army, collectors, rally0, emitC);
  const ocupado = u => v.desvio[u.id] > t || v.ferido[u.id] > t || (v.raid && v.raid.ate > t && v.raid.ids.includes(u.id)) || (v.ruina && v.ruina.ate > t && v.ruina.ids.includes(u.id)) || (v.captura && v.captura.includes(u.id));
  for (const id in v.ferido) { const u = sim.byId.get(+id); if (u && u.alive && u.hp >= u.maxHp * 0.65) delete v.ferido[id]; }
  const livres = army.filter(u => !ocupado(u)); const ids = livres.map(u => u.id);

  // --- assédio aos Coletores (Vesper e Oru): um grupo rápido vai onde os Coletores inimigos foram vistos
  if (P.assedio && !D.noCiv && !cac && t >= (P.minAtk < 0.85 ? 200 : 260) && t - v.raidT > 80 && (!v.raid || v.raid.ate <= t)) {
    const alvo = v.colVisto && t - v.colVisto.t < 120 ? v.colVisto : (() => { let b = null, bd = Infinity; for (const k of mem.known.values()) if ((k.def === 'refinaria' || k.def === 'nodulo') && S.isEnemy(sim, mem.pid, k.owner)) { const d = S.dist(nuc.x, nuc.y, k.x, k.y); if (d < bd) { bd = d; b = k; } } return b; })();
    const rap = livres.filter(u => S.UNITS[u.def].speed >= 115 && u.state !== 'attack' && S.dist(u.x, u.y, nuc.x, nuc.y) < 900).slice(0, 4);
    if (alvo && rap.length >= 2 && (mem.mode === 'defend' || livres.length > 12)) { v.raidT = t; v.raid = { ids: rap.map(u => u.id), ate: t + 45, x: alvo.x, y: alvo.y }; emitC({ t: 'attackmove', ids: v.raid.ids, x: alvo.x, y: alvo.y }); }
  }
  if (v.raid && v.raid.ate <= t) v.raid = null;

  // --- esquadrões: defesa, ataque (com reunião, duas frentes e o pedido do aliado), recuo
  const value = meuV; let threshold = (D.attackAt + Math.max(0, (t - 600) / 60) * 25) * strat.attackMul * P.ataque; let minAtk = D.minAttack * P.minAtk;
  if (cac) { threshold = Math.min(threshold, D.attackAt * 0.55); minAtk = Math.min(minAtk, Math.max(240, D.minAttack * 0.6)); } /* contra a Forja-Mãe, só com o enxame de voadores pronto */
  let attacked = builds.find(b => t - b.lastHitT < 6 && b.lastHitBy !== undefined && b.lastHitBy !== mem.pid);
  if (!attacked && !cac) { const ca = collectors.find(u => t - u.lastHitT < 4 && u.lastHitBy != null && u.lastHitBy >= 0 && u.lastHitBy !== mem.pid && sim.players[u.lastHitBy] && S.isEnemy(sim, mem.pid, u.lastHitBy)); /* Coletores atacados: a defesa vai até eles e eles correm para o Núcleo */
    if (ca && t - (v.colDefT || -99) > 3) { v.colDefT = t; const fogem = collectors.filter(u => t - u.lastHitT < 4 && S.dist(u.x, u.y, ca.x, ca.y) < 260).map(u => u.id); if (fogem.length) emitC({ t: 'move', ids: fogem, x: nuc.x + (S.CX - nuc.x) * 0.05, y: nuc.y + (S.CY - nuc.y) * 0.05 });
      const perto = army.filter(u => !(v.desvio[u.id] > t) && S.dist(u.x, u.y, ca.x, ca.y) < (mem.mode === 'defend' ? 1400 : 700)).sort((a, b) => S.dist(a.x, a.y, ca.x, ca.y) - S.dist(b.x, b.y, ca.x, ca.y) || a.id - b.id).slice(0, mem.mode === 'defend' ? 40 : 6).map(u => u.id); if (perto.length) emitC({ t: 'attackmove', ids: perto, x: ca.x, y: ca.y }); } }
  if (!attacked && cac) { let bd = 2400; for (const k in p.pacts) { const q = sim.players[k]; if (!q || !q.alive || q.fenda) continue; for (const e of S.entitiesOf(sim, q.id)) { if (e.kind !== 'building' || !(t - e.lastHitT < 6) || e.lastHitBy !== sim.fenda) continue; const d = S.dist(nuc.x, nuc.y, e.x, e.y); if (d < bd) { bd = d; attacked = e; } } } } /* Caçada: a base do aliado também se defende */
  if (attacked && sim.players[attacked.lastHitBy] && sim.players[attacked.lastHitBy].human) fala(sim, mem, v, 'atacado', attacked.lastHitBy);
  if (attacked && attacked.owner === mem.pid && sim.players[attacked.lastHitBy] && !sim.players[attacked.lastHitBy].fenda && count(units, u => u.state === 'idle' && S.UNITS[u.def].attack) < 3) v.alarme = t;
  const pedAtk = ped && ped.tipo === 'atacar' ? ped : null;
  if (attacked && ids.length) { if (t - mem.lastAttackOrder > 4) { mem.lastAttackOrder = t; const tb = boss && S.dist(boss.x, boss.y, attacked.x, attacked.y) < boss.r + 400 ? alvo3(sim, mem, v, attacked, P) : null; const e = tb && tb.id ? sim.byId.get(tb.id) : null;
      if (e && e.alive && S.canSee(sim, mem.pid, e)) emitC({ t: 'attack', ids, target: e.id }); else emitC({ t: 'attackmove', ids, x: attacked.x, y: attacked.y }); } if (mem.mode === 'attack' && value < mem.attackStart * 0.5) { mem.mode = 'defend'; v.fase = 'livre'; } }
  else if (pedAtk && ids.length) { /* o aliado pediu: ataca o alvo dele */
    if (t - mem.lastAttackOrder > 4) { mem.lastAttackOrder = t; const e = pedAtk.alvo ? sim.byId.get(pedAtk.alvo) : null; if (e && e.alive && e.owner !== sim.mundo /* 5.0h junção */ && S.isEnemy(sim, mem.pid, e.owner) && S.canSee(sim, mem.pid, e)) emitC({ t: 'attack', ids, target: e.id }); else emitC({ t: 'attackmove', ids, x: e && e.alive ? e.x : pedAtk.x, y: e && e.alive ? e.y : pedAtk.y }); }
  }
  else if (mem.mode === 'defend') {
    if (value >= threshold && ids.length >= 4 && t >= minAtk && !defPonto) { mem.mode = 'attack'; mem.attackStart = value; mem.target = alvo3(sim, mem, v, nuc, P); v.nAtaques++;
      v.fase = P.sinc > 0 && ids.length >= 6 && !cac ? 'reunir' : 'ataque'; v.faseT = t; v.flanco = null;
      if (mem.target) { const tg = mem.target; const f = P.sinc >= 1 ? 0.42 : 0.3; v.ponto = cac === 'forja' ? frente(boss) : { x: nuc.x + (tg.x - nuc.x) * f, y: nuc.y + (tg.y - nuc.y) * f }; if (v.fase === 'reunir') emitC({ t: 'move', ids, x: v.ponto.x, y: v.ponto.y }); const dono = sim.players[tg.owner]; if (dono && dono.human) fala(sim, mem, v, 'ataque', tg.owner); } }
    else if (t - mem.lastAttackOrder > (defPonto ? 5 : 8)) { const far = livres.filter(u => (u.state === 'idle' || (defPonto && u.state !== 'attack')) && S.dist(u.x, u.y, rally.x, rally.y) > (defPonto ? 240 : 160)).map(u => u.id); if (far.length) { mem.lastAttackOrder = t; emitC({ t: 'attackmove', ids: far, x: rally.x, y: rally.y }); } } /* pedido "defender": todos vão para perto do Núcleo do aliado */
  }
  if (mem.mode === 'attack' && !attacked && !pedAtk) {
    if (value < mem.attackStart * (cac ? 0.25 : 0.35) || ids.length === 0) { mem.mode = 'defend'; v.fase = 'livre'; v.flanco = null; if (ids.length) emitC({ t: 'move', ids, x: rally.x, y: rally.y }); const tg = mem.target; if (tg && sim.players[tg.owner] && sim.players[tg.owner].human) fala(sim, mem, v, 'recua', tg.owner); }
    else {
      if (!alvoValido(sim, mem, mem.target) || (mem.target && mem.target.chefe)) mem.target = alvo3(sim, mem, v, nuc, P);
      const tg = mem.target;
      if (tg && v.fase === 'reunir') { /* Zayin: só ataca com o Coro reunido (o Elo pesa); contra a Forja-Mãe, o enxame se junta na frente dela (as Torres ficam atrás) */
        if (cac === 'forja') v.ponto = frente(boss);
        const junto = count(livres, u => S.dist(u.x, u.y, v.ponto.x, v.ponto.y) < 230); if (junto >= livres.length * (P.sinc >= 1 ? 0.8 : 0.6) || t - v.faseT > (P.sinc >= 1 ? 45 : 25)) { v.fase = 'ataque'; v.faseT = t; mem.lastAttackOrder = -99; }
        else if (t - mem.lastAttackOrder > 6) { mem.lastAttackOrder = t; const fora = livres.filter(u => S.dist(u.x, u.y, v.ponto.x, v.ponto.y) > 160).map(u => u.id); if (fora.length) emitC({ t: 'move', ids: fora, x: v.ponto.x, y: v.ponto.y }); } }
      if (tg && v.fase === 'ataque' && t - mem.lastAttackOrder <= 5 && tg.chefe) { const oc = livres.filter(u => u.state === 'idle').map(u => u.id); const e = sim.byId.get(tg.id); if (oc.length && e && e.alive && S.canSee(sim, mem.pid, e)) emitC({ t: 'attack', ids: oc, target: e.id }); } /* contra o chefão, quem ficou parado volta já */
      if (tg && v.fase === 'ataque' && t - mem.lastAttackOrder > 5) { mem.lastAttackOrder = t; const frac = D.attackFrac == null ? 1 : D.attackFrac; let sent = frac >= 1 ? ids : ids.filter((id, i) => (i % 10) < Math.round(frac * 10)); if (D.waveMax) sent = sent.slice(0, D.waveMax);
        /* duas frentes: os rápidos vão a um segundo alvo longe do primeiro */
        if (P.frentes && !cac && sent.length >= 12) { if (!v.flanco || !alvoValido(sim, mem, v.flanco.alvo)) { let b2 = null, bs = -1; for (const [id, k] of mem.known) { if (!S.isEnemy(sim, mem.pid, k.owner) || S.dist(k.x, k.y, tg.x, tg.y) < 450) continue; const sc = (VALUE[k.def] || 1) / (1 + S.dist(k.x, k.y, nuc.x, nuc.y) / 2000); if (sc > bs) { bs = sc; b2 = { x: k.x, y: k.y, def: k.def, owner: k.owner, id }; } } v.flanco = b2 ? { alvo: b2 } : null; }
          if (v.flanco) { const rap = sent.filter(id => { const u = sim.byId.get(id); return u && S.UNITS[u.def].speed >= 110; }); const fl = rap.slice(0, Math.round(sent.length * 0.35)); if (fl.length >= 3) { const set = new Set(fl); sent = sent.filter(id => !set.has(id)); emitC({ t: 'attackmove', ids: fl, x: v.flanco.alvo.x, y: v.flanco.alvo.y }); } } }
        if (cac && boss && boss.boss.tipo === 'forja' && boss.boss.fase === 3) { /* Núcleo exposto: a infantaria cerca a Forja-Mãe (captura) e o resto bate */
          const inf = sent.map(id => sim.byId.get(id)).filter(u => u && u.cls === 'inf' && !S.UNITS[u.def].flying).slice(0, 8).map(u => u.id); if (inf.length >= 5) { v.captura = inf; const set = new Set(inf); sent = sent.filter(id => !set.has(id)); emitC({ t: 'move', ids: inf, x: boss.x + (nuc.x - boss.x) / Math.max(1, S.dist(nuc.x, nuc.y, boss.x, boss.y)) * (boss.r + 50), y: boss.y + (nuc.y - boss.y) / Math.max(1, S.dist(nuc.x, nuc.y, boss.x, boss.y)) * (boss.r + 50) }); } }
        if (sent.length) { const e = tg.id ? sim.byId.get(tg.id) : null; if (e && e.alive && tg.chefe && S.canSee(sim, mem.pid, e)) emitC({ t: 'attack', ids: sent, target: e.id }); else emitC({ t: 'attackmove', ids: sent, x: tg.x, y: tg.y }); } }
      if (!tg) { mem.mode = 'defend'; v.fase = 'livre'; }
    }
  }
  if (v.captura && !(boss && boss.boss.tipo === 'forja' && boss.boss.fase === 3)) v.captura = null;
  if (cac && boss && boss.boss.fase !== v.chefeFase) { if (v.chefeFase) fala(sim, mem, v, 'chefe', -1); v.chefeFase = boss.boss.fase; }
  return cmds;
}
function strategic3(sim, mem, p, P, v) {
  const t = sim.time; const prefs = P.prefs;
  const value = S.armyValue(sim, mem.pid); const lost = mem.armyPrev > 0 ? Math.max(0, (mem.armyPrev - value) / mem.armyPrev) : 0; mem.armyPrev = value;
  let next = mem.strategy;
  if (!next) next = prefs[0];
  else if (P.empurrao && t >= P.empurrao.t && (p.era || 1) >= P.empurrao.era) next = 'blindados'; /* Barão: depois da fortaleza, o empurrão blindado */
  else if (lost > 0.4 && mem.mode === 'defend') next = p.faction === 'vorag' ? 'massa' : 'fortaleza';
  else if (t > 300 && p.res.plasma < 150) next = 'expansao';
  else if (sim.rand() < 0.3) next = prefs[Math.floor(sim.rand() * prefs.length)];
  if (next !== mem.strategy) mem.strategy = next;
  const bossT = chefeVivo(sim); mem.towersWanted = (bossT && bossT.boss.tipo === 'forja' ? 4 : 0) /* a Torre alcança a Forja-Mãe de fora do pisão */ + 2 + (STRATS[mem.strategy].towers || 0) + P.torres + Math.floor(t / 400) + (v.uv && (v.uv.ancora || v.uv.atirador) > 3 ? 1 : 0) + (!bossT && v.uv && ((v.uv.cria || 0) + (v.uv.mosquito || 0) + (v.uv.ferroada || 0)) > 12 ? 2 : 0) /* enxame à vista: Torres (área, e a Fome come as Crias fora do território delas) */; if (mem.diff.maxTowers != null) mem.towersWanted = Math.min(mem.towersWanted, mem.diff.maxTowers);
}
function micro(sim, mem, v, P, D, army, collectors, rally, emitC) {
  const t = sim.time, pid = mem.pid, QG = S._int && S._int.queryGrid; if (!QG) return;
  /* 1) desvio da telegrafia (chefões e meteoros): quem está dentro da forma sai pelo lado mais curto antes do golpe cair */
  if (sim.avisos && sim.avisos.length && !globalThis.__semDesvio) { let n = 0;
    for (const a of sim.avisos) { if (!(a.dano > 0) && a.fonte !== 'meteoro') continue; const te = a.t1 - t; if (te <= 0.05 || te > 3.5) continue;
      const cx = a.tipo === 'faixa' ? (a.x + a.x2) / 2 : a.x, cy = a.tipo === 'faixa' ? (a.y + a.y2) / 2 : a.y; const R = a.tipo === 'faixa' ? S.dist(a.x, a.y, a.x2, a.y2) / 2 + a.w : a.tipo === 'poco' ? a.w : a.r;
      const dentro = []; QG(sim, cx, cy, R + 50, e => { if (e.owner !== pid || e.kind !== 'unit' || !e.alive || e.scripted) return; if (a.chao && S.UNITS[e.def].flying) return; if (v.desvio[e.id] > t) return; if (dentroAviso(a, e)) dentro.push(e); });
      dentro.sort((x, y) => x.id - y.id);
      for (const u of dentro) { if (n >= 60) break; const f = fugaAviso(a, u); emitC({ t: 'move', ids: [u.id], x: f.x, y: f.y }); v.desvio[u.id] = a.t1 + 0.6; n++; } } }
  /* 2) combate: foco no alvo mais fraco ou mais valioso, recuo dos feridos e distância das armas de alcance (até 5 grupos por segundo) */
  const vis = sim.vis[pid]; const feito = new Set(); let grupos = 0; const noCiv = !!D.noCiv; const pl = sim.players[pid];
  const recua = !(sim.modos && sim.modos.cac) || !!(pl.mods && pl.mods.regen) || army.some(u => S.UNITS[u.def].heal); /* contra o chefão, recuar sem cura só tira dano */
  for (const u of army) {
    if (grupos >= 5) break; if (feito.has(u.id) || v.desvio[u.id] > t || v.ferido[u.id] > t) continue; if (t - u.lastHitT > 4 && t - u.lastAttack > 4) continue;
    const foes = [], mates = [];
    QG(sim, u.x, u.y, 260, e => { if (!e.alive) return; if (e.owner === pid) { if (e.kind === 'unit' && S.UNITS[e.def].attack && !e.scripted && S.dist(u.x, u.y, e.x, e.y) < 200) mates.push(e); return; } if ((e.kind !== 'unit' && e.kind !== 'building') || e.owner < 0 || (e.owner === sim.mundo && !(e.fauna && e.fauna.hostil)) /* 5.0h junção: ruína, nave e fauna mansa não são alvo do foco */ || !S.isEnemy(sim, pid, e.owner) || !vis.has(e.id)) return; foes.push(e); });
    for (const m of mates) feito.add(m.id); if (!foes.length) continue; grupos++;
    mates.sort((x, y) => x.id - y.id); foes.sort((x, y) => x.id - y.id);
    const grp = [];
    for (const m of mates) { if (v.desvio[m.id] > t || (v.captura && v.captura.includes(m.id))) continue;
      const cmd = !!m.cmd; if (recua && (m.hp < m.maxHp * P.recuo) && (S.unitCost(m.def) >= 120 || cmd) && m.state !== 'move') { emitC({ t: 'move', ids: [m.id], x: rally.x + ((m.id * 37) % 60) - 30, y: rally.y + ((m.id * 53) % 60) - 30 }); v.ferido[m.id] = t + 25; continue; }
      const wm = S.UNITS[m.def].weapon && S.WEAPONS[S.UNITS[m.def].weapon];
      if (wm && wm.range >= 140) { let near = null, nd = 75; for (const f of foes) { if (f.kind !== 'unit') continue; const wf = S.UNITS[f.def].weapon && S.WEAPONS[S.UNITS[f.def].weapon]; if (!wf || wf.range > 45) continue; const d = S.dist(m.x, m.y, f.x, f.y); if (d < nd) { nd = d; near = f; } }
        if (near) { const dx = m.x - near.x, dy = m.y - near.y, d = Math.hypot(dx, dy) || 1; emitC({ t: 'move', ids: [m.id], x: Math.max(30, Math.min(S.WORLD - 30, m.x + dx / d * 90)), y: Math.max(30, Math.min(S.WORLD - 30, m.y + dy / d * 90)) }); v.desvio[m.id] = t + 1.5; continue; } }
      grp.push(m); }
    if (!grp.length) continue;
    let best = null, bs = 0; const temUn = foes.some(f => f.kind === 'unit' && S.UNITS[f.def].attack);
    for (const f of foes) { let val;
      if (f.kind === 'building') val = temUn ? (f.def === 'torre' || f.def === 'bastiao' ? 0.7 : 0.15) : (VALUE[f.def] || 1);
      else { const d = S.UNITS[f.def]; if (f.boss) val = f.boss.partes && f.boss.partes.some(id => { const q = sim.byId.get(id); return q && q.alive; }) ? 0.1 : 2; else if (f.parte) val = 3; else if (CERCO[f.def]) val = 3; else if (CURA[f.def]) val = 2.5; else if (f.def === 'pirata') val = 2; else if (f.def === 'coletor') val = noCiv ? 0 : 1.1; else if (!d.attack) val = 0.6; else val = 1.2; }
      if (!val) continue; const hpf = f.maxHp ? f.hp / f.maxHp : 1; const sc = (f.boss || f.parte ? val * 2 : val * (1 + 1.5 * (1 - hpf)) / (1 + f.hp / 500)) / (1 + S.dist(u.x, u.y, f.x, f.y) / 300); /* chefão e partes: o valor manda, não a vida */
      if (sc > bs) { bs = sc; best = f; } }
    if (!best) continue;
    const novos = grp.filter(m => m.target !== best.id && !(v.foco[m.id] > t)).map(m => m.id);
    if (novos.length >= Math.max(1, grp.length * 0.4) && S.canSee(sim, pid, best)) { emitC({ t: 'attack', ids: novos, target: best.id }); for (const id of novos) v.foco[id] = t + 3; }
  }
}
/* 5.0h junção: o módulo de cada construção. A economia é a mesma para todos (Prensa, Antena, Linha Rápida, Pós-combustão): com a escolha só pelo perfil,
   Erevane e Quorith pagavam por módulos sem renda e caíam no self-play; o perfil decide no Nódulo (Posto Avançado ou Mina de Pulso) e a Contraespionagem vem com camuflagem vista */
function modEscolha(def, P, mem) { if (def === 'laboratorio') return (mem.v3 && mem.v3.uv && ((mem.v3.uv.ancora || 0) + (mem.v3.uv.atirador || 0) + (mem.v3.uv.espectro || 0)) > 4) ? 'contra' : 'antena';
  if (def === 'nodulo') return P.modulo ? 'mina' : 'posto'; return { refinaria: 'prensa', fabrica: 'linha', hangar: 'posq' }[def]; }
/* 5.0h: a IA usa o mundo neutro (ruínas e mercenários, src/mundo.js), os módulos, as construções únicas e o comandante (src/unicas-sim.js).
   Cada um só age quando a peça existe na partida (S.RUINAS e sim.mundo >= 0, S.MERCS, S.MODULOS, S.BUILDINGS[..].unica, cfg.comandantes e o avatar). */
function ganchos(sim, mem, v, P, D, p, nuc, builds, army, emitC, era) {
  const t = sim.time, pid = mem.pid; const mundo = sim.mundo != null && sim.mundo >= 0 && !!sim.mundoSt;
  /* ruínas: 2–3 infantarias vão capturar a ruína livre (ou inimiga) mais perto do Núcleo pelo comando 'capturar' (param em volta dela) */
  if (mundo && S.RUINAS && t - v.ruinaT >= 20) { v.ruinaT = t; if (v.ruina && (v.ruina.ate <= t || !sim.byId.get(v.ruina.id) || (sim.byId.get(v.ruina.id).ruina || {}).dono === pid)) v.ruina = null;
    if (!v.ruina && mem.mode === 'defend') { let best = null, bd = 1500; for (const id of sim.mundoSt.ruinas || []) { const e = sim.byId.get(id); if (!e || !e.alive || !e.ruina || e.ruina.dono === pid) continue; if (e.ruina.dono >= 0 && !S.isEnemy(sim, pid, e.ruina.dono)) continue; const d = S.dist(nuc.x, nuc.y, e.x, e.y); if (d < bd) { bd = d; best = e; } }
      if (best) { const inf = army.filter(u => u.cls === 'inf' && !u.cmd && !S.UNITS[u.def].flying && u.state === 'idle').slice(0, 3); if (inf.length >= 2) { v.ruina = { id: best.id, ids: inf.map(u => u.id), ate: t + 70 }; emitC({ t: 'capturar', ids: v.ruina.ids, id: best.id }); } } } }
  /* mercenários da Irmandade Corsária: com Dados de sobra, leva uma unidade até perto da nave (600) e contrata; recarga e limite são da simulação */
  if (mundo && S.MERCS && t - v.mercT >= 30 && t > 300) { v.mercT = t; const e = sim.byId.get(sim.mundoSt.acamp); const C = (ARD.mundo && ARD.mundo.CONTRATO) || { raio: 600, max: 3 };
    if (e && e.alive && e.acampamento) { const ms = e.acampamento.mercs || []; let pick = null, vivos = 0; for (const u of army) if (u.merc) vivos++;
      if (vivos < C.max) for (let i = 0; i < ms.length; i++) { const k = ms[(i + pid + (t / 30 | 0)) % ms.length]; const md = S.MERCS[k]; if (!md || !md.custo) continue; if (S.canAfford(p, { dados: (md.custo.dados || 0) + 150 })) { pick = k; break; } }
      if (pick) { let perto = null; for (const o of army) if (S.dist(o.x, o.y, e.x, e.y) <= C.raio - 40) { perto = o; break; } if (!perto) for (const b of builds) if (S.dist(b.x, b.y, e.x, e.y) <= C.raio - 40) { perto = b; break; }
        if (perto) emitC({ t: 'contratar', id: e.id, merc: pick });
        else { const u = army.find(o => !o.cmd && !o.merc && o.state === 'idle' && !S.UNITS[o.def].flying); if (u) { const a = S.DM.atan2(nuc.y - e.y, nuc.x - e.x), rr = C.raio * 0.6; emitC({ t: 'move', ids: [u.id], x: e.x + S.DM.cos(a) * rr, y: e.y + S.DM.sin(a) * rr }); v.mercT = t - 20; } } } } }
  /* módulos com escolha: uma por construção, para sempre (a chave 'a' ou 'b' de S.MODULOS[def]); o perfil escolhe o primeiro (defesa e economia) ou o segundo (ataque e furtividade) */
  if (S.MODULOS && era >= 2 && t - v.modT >= 45 && t > 300 && t - v.alarme > 60 && army.length >= 8) { v.modT = t; /* 5.0h junção: só com a base em paz e exército de pé (no self-play, comprar módulo na virada da Era II deixava Erevane, Tessara e Quorith abertos ao empurrão do Barão-Forja) */ for (const b of builds) { if (!b.built || b.modulo) continue; const arr = S.MODULOS[b.def]; if (!arr || !arr.length) continue; const m = arr.find(x => x.id === modEscolha(b.def, P, mem)) || arr[0]; if (!m || !m.k || era < (m.era || 1)) continue; const c = m.cost || {}; if (!S.canAfford(p, Object.assign({}, c, { minerio: (c.minerio || 0) + 300 }))) continue; emitC({ t: 'modulo', id: b.id, escolha: m.k }); break; } }
  /* construções únicas: uma de cada da Raça quando sobra dinheiro (a Era vem do lockReason) */
  if (S.UNICAS_DE && t > 420 && t - v.unicaT >= 45) { v.unicaT = t; for (const def of S.UNICAS_DE[p.faction] || []) { const bd = S.BUILDINGS[def]; if (!bd || !bd.unica || builds.some(b => b.def === def) || (S.unicaLivre && !S.unicaLivre(sim, pid, def)) || S.lockReason(sim, pid, 'building', def)) continue; const c = Object.assign({}, bd.cost); c.minerio = (c.minerio || 0) + 250; if (!S.canAfford(p, c)) continue; const s = findSpot(sim, pid, def, nuc.x, nuc.y, 100, 300, 30); if (s) { emitC({ t: 'build', def, x: s.x, y: s.y }); break; } } }
  /* comandante em campo: anda com o exército e usa a habilidade pronta no meio do combate (cd[n] = o tempo da partida em que fica pronta) */
  if (sim.cfg && sim.cfg.comandantes && S.avatarDe && t - v.habT >= 3) { const av = S.avatarDe(sim, pid); const H = av && S.habDe(av); if (av && H && Array.isArray(av.cmd.cd) && t - (av.lastAttack || -99) < 4) { const QG = S._int && S._int.queryGrid; let sx = 0, sy = 0, n = 0, alvo = null, ah = Infinity, ferido = 0;
      if (QG) QG(sim, av.x, av.y, 260, e => { if (!e.alive || e.kind !== 'unit') return; if (e.owner === pid) { if (e.hp < e.maxHp * 0.6) ferido++; return; } if (e.owner < 0 || e.fauna || !S.isEnemy(sim, pid, e.owner) || !sim.vis[pid].has(e.id)) return; sx += e.x; sy += e.y; n++; if (e.hp < ah || (e.hp === ah && alvo && e.id < alvo.id)) { ah = e.hp; alvo = e; } });
      if (n >= 2) for (let k = 0; k < H.length; k++) { if (sim.time < av.cmd.cd[k]) continue; const h = H[k]; let x = sx / n, y = sy / n, al = 0;
        if (h.alvo === 'chao') { const d = S.dist(av.x, av.y, x, y); if (d > h.alcance) { const f = h.alcance / d * 0.95; x = av.x + (x - av.x) * f; y = av.y + (y - av.y) * f; } }
        else if (h.alvo === 'unidade') { let bv = null, bs = -1; QG(sim, av.x, av.y, h.alcance + 40, e => { if (!e.alive || e.kind !== 'unit' || e.owner < 0 || e.fauna || !S.isEnemy(sim, pid, e.owner) || !sim.vis[pid].has(e.id) || S.dist(av.x, av.y, e.x, e.y) - e.r > h.alcance) return; const sc = (h.id === 'devorar' ? (e.hp <= (h.dano || 220) ? 3 : 1) : 1) * (S.unitCost(e.def) || 50) / (1 + e.hp / 100); if (sc > bs || (sc === bs && e.id < bv.id)) { bs = sc; bv = e; } }); if (!bv) continue; al = bv.id; x = bv.x; y = bv.y; }
        else { if (h.cura && ferido < 2) continue; /* Reparo e Florescer só com feridos por perto */ x = av.x; y = av.y; }
        v.habT = t; emitC({ t: 'habilidade', id: av.id, n: k, x, y, alvo: al }); break; } } }
}
ARD.ai = { create, think, STRATS, snapshot, restore, PERFIS, perfilDe, FALAS: ['inicio', 'chefe', 'ataque', 'atacado', 'recua', 'pacto', 'recusa', 'coalizao', 'trai', 'super', 'pedido'], _contra: contra }; /* 5.0h: + PERFIS, perfilDe, as chaves das falas e a contra-composição (testes) */
})(globalThis.ARD = globalThis.ARD || {});
