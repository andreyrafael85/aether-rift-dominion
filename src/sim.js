/* Aether Rift: Dominion — simulação determinística (beta 0.1)
   Comandos entram, estado sai. Sem DOM. Roda em Node e no navegador. */
(function (ARD) {
'use strict';

const TICK = 0.1;
const WORLD = 3200;
const CX = WORLD / 2, CY = WORLD / 2;
const RIFT_R = 170;
const PLAYER_COLORS = ['#FF8C1A', '#38D1E0', '#B98BFF', '#7FE3A1'];

const FACTIONS = {
  vehnar: {
    id: 'vehnar', name: 'Consórcio Vehnar', short: 'Vehnar',
    tagline: 'Eficiência industrial. Linhas de Montagem, Lotes e Reatores que fumegam.',
    pirateName: 'Rebocador', lineBonus: true, lotes: true, smoke: true, structNeutralVsVehicle: true,
    stolenMult: 1.0, cloak: {}, jumps: 1, jumpCostFrac: 0.4,
    superKey: 'fundicao', superName: 'Fundição Orbital',
    superDesc: 'Derruba um Bastião pré-construído em território próprio (3 s). Custa 300 Dados + 200 Plasma.',
  },
  erevane: {
    id: 'erevane', name: 'Erevane', short: 'Erevane',
    tagline: 'Furtividade e roubo. Nódulos camuflados, Sifonadores e recursos roubados limpos.',
    pirateName: 'Sifonador', lineBonus: false, lotes: false, smoke: false, structNeutralVsVehicle: false,
    stolenMult: 1.2, cloak: { nodulo: true, infantaria: true, pirata: true }, jumps: 2, jumpCostFrac: 0.2,
    superKey: 'blecaute', superName: 'Blecaute',
    superDesc: 'Sensores e energia inimigos a zero por 20 s; suas unidades +30% de velocidade. Custa 300 Dados + 200 Plasma.',
  },
};

const BUILDINGS = {
  nucleo:      { name: 'Núcleo de Domínio', key: '', hp: 8000, r: 38, cost: {}, buildTime: 0, energyProd: 60, energyUse: 0, sensor: 420, detect: 120, deposit: true, territory: 380, produces: ['coletor'], desc: 'Centro da colônia. Produz coletores. Se cair, você é eliminado.' },
  reator:      { name: 'Reator', key: 'R', hp: 700, r: 20, cost: { minerio: 120 }, buildTime: 12, energyProd: 35, plasmaBurn: 0.3, energyUse: 0, sensor: 120, desc: '+35 de energia queimando 0,3 Plasma/s. Vehnar: emite Fumaça visível a todos.' },
  refinaria:   { name: 'Refinaria', key: 'F', hp: 1000, r: 24, cost: { minerio: 150 }, buildTime: 15, energyUse: 6, sensor: 140, deposit: true, desc: 'Ponto de entrega perto dos nós. Alvo de Sifão.' },
  quartel:     { name: 'Quartel Orbital', key: 'Q', hp: 1150, r: 26, cost: { minerio: 200 }, buildTime: 18, energyUse: 8, sensor: 140, produces: ['infantaria', 'suporte', 'pirata'], desc: 'Produz Infantaria, Suporte/Hack e Piratas.' },
  fabrica:     { name: 'Fábrica de Veículos', key: 'V', hp: 1300, r: 28, cost: { minerio: 300, plasma: 60 }, buildTime: 22, energyUse: 12, sensor: 140, produces: ['veiculo'], desc: 'Produz Veículos Pesados.' },
  hangar:      { name: 'Hangar de Drones', key: 'H', hp: 1150, r: 26, cost: { minerio: 280, plasma: 60 }, buildTime: 22, energyUse: 12, sensor: 160, produces: ['drone'], desc: 'Produz Drones Aéreos.' },
  torre:       { name: 'Torre de Defesa', key: 'T', hp: 1100, r: 16, cost: { minerio: 180, plasma: 40 }, buildTime: 14, energyUse: 10, sensor: 260, detect: 140, attack: { dmg: 30, range: 230, cd: 1.0 }, desc: 'Forte vs Infantaria e Drones. Detecta camuflagem em 140.' },
  nodulo:      { name: 'Nódulo de Avanço', key: 'N', hp: 650, r: 16, cost: { minerio: 120, plasma: 20 }, buildTime: 10, energyUse: 4, sensor: 260, territory: 320, desc: 'Reclama território em 320 e libera nós para coleta automática. Pode ser colocado até 650 de qualquer estrutura sua.' },
  laboratorio: { name: 'Laboratório', key: 'L', hp: 900, r: 24, cost: { minerio: 220, plasma: 60, dados: 40 }, buildTime: 20, energyUse: 10, sensor: 140, desc: 'Pesquisas e superarma, pagas com Fragmentos de Dados.' },
  bastiao:     { name: 'Bastião', key: '', hp: 2200, r: 24, cost: {}, buildTime: 3, energyUse: 12, sensor: 300, detect: 160, attack: { dmg: 60, range: 260, cd: 0.9 }, desc: 'Fortaleza da Fundição Orbital.' },
};

const UNITS = {
  coletor:    { name: 'Coletor', key: 'C', cls: 'civ', hp: 90, r: 7, speed: 85, cost: { minerio: 60 }, time: 8, energyUse: 1, capacity: 50, harvestRate: 12, sensor: 110, desc: 'Coleta automaticamente nós no seu território e entrega na Refinaria ou Núcleo mais próximo.' },
  infantaria: { name: 'Infantaria Orbital', key: 'I', cls: 'inf', hp: 120, r: 7, speed: 90, cost: { minerio: 50 }, time: 6, energyUse: 1, attack: { dmg: 12, range: 110, cd: 0.8 }, sensor: 160, desc: 'Forte vs Drones e Suporte. Fraca vs Veículos e Estruturas.' },
  veiculo:    { name: 'Veículo Pesado', key: 'V', cls: 'vei', hp: 420, r: 12, speed: 65, cost: { minerio: 160, plasma: 40 }, time: 12, energyUse: 3, attack: { dmg: 40, range: 150, cd: 1.4 }, sensor: 170, desc: 'Forte vs Infantaria e Estruturas. Fraco vs Drones e Suporte.' },
  drone:      { name: 'Drone Aéreo', key: 'D', cls: 'dro', hp: 160, r: 8, speed: 150, cost: { minerio: 120, plasma: 50 }, time: 10, energyUse: 2, flying: true, attack: { dmg: 18, range: 120, cd: 0.9 }, sensor: 220, desc: 'Forte vs Veículos e Suporte. Fraco vs Infantaria e Estruturas. Sobrevoa a Fenda.' },
  suporte:    { name: 'Suporte / Hack', key: 'S', cls: 'sup', hp: 100, r: 8, speed: 80, cost: { minerio: 90, dados: 20 }, time: 9, energyUse: 2, attack: { dmg: 10, range: 170, cd: 1.5, stun: true }, sensor: 200, desc: 'Forte vs Veículos e Estruturas, e os atrasa. Fraco vs Infantaria e Drones.' },
  pirata:     { name: 'Pirata de Extração', key: 'P', cls: 'sup', hp: 140, r: 9, speed: 100, cost: { minerio: 120, plasma: 30 }, time: 10, energyUse: 2, sensor: 180, siphonRange: 46, siphonRate: 7, siphonMax: 40, cargoCap: 300, desc: 'Sifona Refinarias e Reatores inimigos por até 40 s. Erevane: camuflado e +20% no roubo. Vehnar: Rebocador, lento e resistente, carrega 2x.' },
};

const COUNTER = {
  inf: { vei: 0.65, dro: 1.5, est: 0.65, sup: 1.5 },
  vei: { inf: 1.5, dro: 0.65, est: 1.5, sup: 0.65 },
  dro: { inf: 0.65, vei: 1.5, est: 0.65, sup: 1.5 },
  est: { inf: 1.5, vei: 0.65, dro: 1.5, sup: 0.65 },
  sup: { inf: 0.65, vei: 1.5, dro: 0.65, est: 1.5 },
};
const CLASS_NAMES = { inf: 'Infantaria', vei: 'Veículos', dro: 'Drones', est: 'Estruturas', sup: 'Suporte/Hack', civ: 'Civil' };

const RESEARCH = {
  armamento: { name: 'Armamento', cost: { dados: 150 }, desc: '+15% de dano para todas as unidades e torres.' },
  blindagem: { name: 'Blindagem', cost: { dados: 150 }, desc: '−13% de dano recebido por unidades e estruturas.' },
  sensores:  { name: 'Sensores', cost: { dados: 100 }, desc: '+25% de alcance de sensores.' },
};

const SUPER_COST = { dados: 300, plasma: 200 };
const SUPER_CD = 600;
const OVERCHARGE_COST = 200, OVERCHARGE_T = 60, OVERCHARGE_CD = 300;
const PACT_DURATION = 600, PACT_CAUCAO = 150, PROPOSAL_TTL = 30;
const JUMP_CHANNEL = 60;
const REP_NAMES = { 2: 'Palavra de Ferro', 1: 'Confiável', 0: 'Neutro', '-1': 'Volátil', '-2': 'Traidor Conhecido' };

const REGIME = {
  pleno:     { prodF: 1.0,  sensF: 1.0, defF: 1.0,  name: 'Pleno' },
  racionado: { prodF: 0.75, sensF: 0.8, defF: 0.9,  name: 'Racionado' },
  colapso:   { prodF: 0.5,  sensF: 0.6, defF: 0.65, name: 'Colapso' },
};

const DIFFICULTY = {
  facil:   { name: 'Fácil',   income: 0.85, attackAt: 1500, minAttack: 600, acceptP: 0.8,  breakP: 0.0,  pirateEvery: 150, reserve: 200 },
  normal:  { name: 'Normal',  income: 1.0,  attackAt: 1100, minAttack: 420, acceptP: 0.65, breakP: 0.12, pirateEvery: 100, reserve: 150 },
  dificil: { name: 'Difícil', income: 1.2,  attackAt: 850,  minAttack: 240, acceptP: 0.5,  breakP: 0.35, pirateEvery: 70,  reserve: 100 },
};

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

function createSim(cfg) {
  const sim = {
    cfg, tick: 0, time: 0, seed: cfg.seed || 1, ents: [], byId: new Map(), nextId: 1,
    players: [], events: [], cmdQueue: [], pending: [], vis: [], result: null,
    maxTime: (cfg.minutes || 25) * 60, grid: new Map(),
  };
  sim.rand = mulberry32(sim.seed);
  const n = cfg.players.length;
  const rot = sim.rand() * Math.PI * 2;
  for (let i = 0; i < n; i++) {
    const pc = cfg.players[i];
    const fac = FACTIONS[pc.faction] || FACTIONS.vehnar;
    const p = {
      id: i, name: pc.name || (pc.human ? 'Você' : 'IA ' + i), faction: fac.id, color: PLAYER_COLORS[i % PLAYER_COLORS.length],
      human: !!pc.human, difficulty: pc.difficulty || 'normal', alive: true,
      res: { plasma: 300, minerio: 500, dados: 40 },
      energy: { prod: 40, cons: 0, ratio: 1, regime: 'pleno' },
      overchargeT: 0, overchargeCd: 0, superCd: 0, blackoutT: 0, speedBuffT: 0, golpeT: 0,
      research: {}, rep: 0, pacts: {}, jumpsLeft: fac.jumps, lastBaseAlert: -99, lastNucleoAlert: -99,
      stats: { collected: 0, stolen: 0, lost: 0, unitsKilled: 0, unitsLost: 0, buildingsDestroyed: 0, buildingsLost: 0, treaties: 0, betrayals: 0, dmg: 0 },
      startAngle: rot + (Math.PI * 2 * i) / n,
    };
    sim.players.push(p);
    sim.vis.push(new Set());
  }
  generateMap(sim);
  computeVisibility(sim);
  return sim;
}

function generateMap(sim) {
  const R0 = 1180;
  // Plasma ring around the Rift
  for (let k = 0; k < 8; k++) {
    const a = (Math.PI * 2 * k) / 8 + Math.PI / 8;
    addNode(sim, 'plasma', CX + Math.cos(a) * 330, CY + Math.sin(a) * 330, 1800);
  }
  // Data anomalies between players on a mid ring
  const n = sim.players.length;
  for (let i = 0; i < n; i++) {
    const a = sim.players[i].startAngle + Math.PI / n;
    addNode(sim, 'dados', CX + Math.cos(a) * 640, CY + Math.sin(a) * 640, 600);
    addNode(sim, 'minerio', CX + Math.cos(a + 0.18) * 800, CY + Math.sin(a + 0.18) * 800, 1600);
    addNode(sim, 'minerio', CX + Math.cos(a - 0.18) * 800, CY + Math.sin(a - 0.18) * 800, 1600);
  }
  if (n < 4) { // extra data for small games
    for (let k = 0; k < 4 - n; k++) {
      const a = sim.rand() * Math.PI * 2;
      addNode(sim, 'dados', CX + Math.cos(a) * 520, CY + Math.sin(a) * 520, 500);
    }
  }
  for (let i = 0; i < n; i++) {
    const p = sim.players[i];
    const sx = CX + Math.cos(p.startAngle) * R0, sy = CY + Math.sin(p.startAngle) * R0;
    const nuc = addBuilding(sim, p.id, 'nucleo', sx, sy, true);
    nuc.hp = nuc.maxHp;
    // three minério nodes around the start, one small plasma, one dados a bit away
    for (let k = 0; k < 3; k++) {
      const a = p.startAngle + Math.PI + (k - 1) * 0.75 + (sim.rand() - 0.5) * 0.3;
      const d = 190 + sim.rand() * 60;
      addNode(sim, 'minerio', sx + Math.cos(a) * d, sy + Math.sin(a) * d, 2200);
    }
    const ap = p.startAngle + Math.PI + (sim.rand() < 0.5 ? 1.5 : -1.5);
    addNode(sim, 'plasma', sx + Math.cos(ap) * 250, sy + Math.sin(ap) * 250, 1500);
    const ad = p.startAngle + (sim.rand() < 0.5 ? 1.1 : -1.1);
    addNode(sim, 'dados', sx + Math.cos(ad) * 420, sy + Math.sin(ad) * 420, 350);
    // starting units
    for (let k = 0; k < 3; k++) {
      const u = addUnit(sim, p.id, 'coletor', sx + Math.cos(p.startAngle + Math.PI + k * 0.5) * 60, sy + Math.sin(p.startAngle + Math.PI + k * 0.5) * 60);
      u.state = 'idle';
    }
    const u1 = addUnit(sim, p.id, 'infantaria', sx + Math.cos(p.startAngle) * 70, sy + Math.sin(p.startAngle) * 70);
    const u2 = addUnit(sim, p.id, 'infantaria', sx + Math.cos(p.startAngle + 0.4) * 70, sy + Math.sin(p.startAngle + 0.4) * 70);
    u1.state = u2.state = 'idle';
  }
  // scattered extra minério
  let tries = 0;
  for (let k = 0; k < 6 && tries < 200; tries++) {
    const a = sim.rand() * Math.PI * 2, d = 450 + sim.rand() * 550;
    const x = CX + Math.cos(a) * d, y = CY + Math.sin(a) * d;
    if (nearestEntity(sim, x, y, 150, e => e.kind !== 'unit')) continue;
    addNode(sim, 'minerio', x, y, 1200); k++;
  }
}

function addNode(sim, res, x, y, amount) {
  const e = { id: sim.nextId++, kind: 'node', res, x: clamp(x, 60, WORLD - 60), y: clamp(y, 60, WORLD - 60), r: 18, amount, max: amount, alive: true, owner: -1 };
  sim.ents.push(e); sim.byId.set(e.id, e); return e;
}
function addBuilding(sim, owner, def, x, y, built) {
  const d = BUILDINGS[def];
  const e = {
    id: sim.nextId++, kind: 'building', def, cls: 'est', owner, x, y, px: x, py: y, r: d.r,
    maxHp: d.hp, hp: built ? d.hp : d.hp * 0.3, built: !!built, progress: built ? 1 : 0, queue: [], cd: 0,
    alive: true, lastHitT: -99, lastAttack: -99, cloaked: false, revealT: 0, rally: null, jumpT: 0, jumpTo: null, lotes: {},
  };
  sim.ents.push(e); sim.byId.set(e.id, e); return e;
}
function addUnit(sim, owner, def, x, y) {
  const d = UNITS[def];
  const p = sim.players[owner];
  const fac = FACTIONS[p.faction];
  const e = {
    id: sim.nextId++, kind: 'unit', def, cls: d.cls, owner, x, y, px: x, py: y, r: d.r, ang: p.startAngle,
    maxHp: d.hp, hp: d.hp, speed: d.speed, state: 'idle', tx: x, ty: y, target: null, resume: null, cd: 0,
    cargo: { plasma: 0, minerio: 0, dados: 0 }, cargoTotal: 0, stolen: false, cargoCap: d.cargoCap || d.capacity || 0,
    siphonT: 0, alive: true, lastHitT: -99, lastAttack: -99, cloaked: false, revealT: 0, node: null,
  };
  if (def === 'pirata' && fac.id === 'vehnar') { e.maxHp = e.hp = 260; e.speed = 72; e.cargoCap = 600; e.r = 11; }
  sim.ents.push(e); sim.byId.set(e.id, e); return e;
}

function nearestEntity(sim, x, y, rad, pred) {
  let best = null, bd = rad;
  for (const e of sim.ents) {
    if (!e.alive) continue;
    if (pred && !pred(e)) continue;
    const d = dist(x, y, e.x, e.y) - (e.r || 0);
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

// ---------- spatial hash ----------
const CELL = 100;
function rebuildGrid(sim) {
  sim.grid.clear();
  for (const e of sim.ents) {
    if (!e.alive || e.kind === 'node') continue;
    const k = ((e.x / CELL) | 0) * 4096 + ((e.y / CELL) | 0);
    let arr = sim.grid.get(k); if (!arr) { arr = []; sim.grid.set(k, arr); }
    arr.push(e);
  }
}
function queryGrid(sim, x, y, rad, fn) {
  const x0 = ((x - rad) / CELL) | 0, x1 = ((x + rad) / CELL) | 0, y0 = ((y - rad) / CELL) | 0, y1 = ((y + rad) / CELL) | 0;
  for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) {
    const arr = sim.grid.get(cx * 4096 + cy); if (!arr) continue;
    for (const e of arr) if (e.alive) fn(e);
  }
}

// ---------- helpers ----------
function facOf(sim, pid) { return FACTIONS[sim.players[pid].faction]; }
function regimeOf(sim, pid) { return REGIME[sim.players[pid].energy.regime]; }
function canAfford(p, cost) { for (const k in cost) if ((p.res[k] || 0) < cost[k]) return false; return true; }
function pay(p, cost, mult) { mult = mult || 1; for (const k in cost) p.res[k] = Math.max(0, p.res[k] - cost[k] * mult); }
function refund(p, cost, mult) { mult = mult || 1; for (const k in cost) p.res[k] += cost[k] * mult; }
function hasPact(sim, a, b) { return !!sim.players[a].pacts[b]; }
function isEnemy(sim, a, b) { return a !== b && !hasPact(sim, a, b); }
function sensorRadius(sim, e) {
  const p = sim.players[e.owner];
  const d = e.kind === 'unit' ? UNITS[e.def] : BUILDINGS[e.def];
  let r = e.kind === 'building' && !e.built ? 60 : d.sensor;
  r *= regimeOf(sim, e.owner).sensF;
  if (p.research.sensores) r *= 1.25;
  if (p.blackoutT > 0) r *= 0.15;
  return r;
}
function speedOf(sim, u) {
  const p = sim.players[u.owner];
  let s = u.speed;
  if (p.speedBuffT > 0) s *= 1.3;
  return s;
}
function inTerritory(sim, pid, x, y) {
  for (const e of sim.ents) {
    if (!e.alive || e.kind !== 'building' || e.owner !== pid || !e.built) continue;
    const t = BUILDINGS[e.def].territory;
    if (t && dist(x, y, e.x, e.y) <= t) return true;
  }
  return false;
}
function territoryOwner(sim, x, y) { // first owner whose territory covers; -1 if none
  for (const e of sim.ents) {
    if (!e.alive || e.kind !== 'building' || !e.built) continue;
    const t = BUILDINGS[e.def].territory;
    if (t && dist(x, y, e.x, e.y) <= t) return e.owner;
  }
  return -1;
}
function canBuild(sim, pid, def, x, y) {
  const d = BUILDINGS[def]; if (!d) return { ok: false, why: 'Desconhecido' };
  if (x < 60 || y < 60 || x > WORLD - 60 || y > WORLD - 60) return { ok: false, why: 'Fora do mapa' };
  if (dist(x, y, CX, CY) < RIFT_R + d.r + 12) return { ok: false, why: 'Dentro da Fenda' };
  for (const e of sim.ents) {
    if (!e.alive || e.kind === 'unit' || e.kind === 'crate') continue;
    if (dist(x, y, e.x, e.y) < e.r + d.r + 10) return { ok: false, why: 'Sobreposição' };
  }
  if (def === 'nodulo') {
    let near = false;
    for (const e of sim.ents) if (e.alive && e.kind === 'building' && e.owner === pid && dist(x, y, e.x, e.y) <= 650) { near = true; break; }
    if (!near) return { ok: false, why: 'Longe demais das suas estruturas (650)' };
    const to = territoryOwner(sim, x, y);
    if (to !== -1 && to !== pid) return { ok: false, why: 'Território inimigo' };
  } else if (def !== 'bastiao' && !inTerritory(sim, pid, x, y)) return { ok: false, why: 'Fora do seu território' };
  return { ok: true };
}
function canSee(sim, pid, e) { return e.owner === pid || e.kind === 'node' || sim.vis[pid].has(e.id); }
function emit(sim, ev) { ev.time = sim.time; sim.events.push(ev); }
function alertTo(sim, pid, text, x, y, kind) { emit(sim, { t: 'alert', p: pid, text, x, y, kind: kind || 'info' }); }

// ---------- commands ----------
function enqueue(sim, cmd) { sim.cmdQueue.push(cmd); }

function ownUnits(sim, pid, ids) {
  const out = [];
  if (!ids) return out;
  for (const id of ids) { const e = sim.byId.get(id); if (e && e.alive && e.kind === 'unit' && e.owner === pid) out.push(e); }
  return out;
}
function formation(units, x, y) {
  const n = units.length; if (n === 0) return [];
  const cols = Math.ceil(Math.sqrt(n)); const sp = 24;
  const out = [];
  for (let i = 0; i < n; i++) {
    const c = i % cols, r = (i / cols) | 0;
    out.push({ x: x + (c - (cols - 1) / 2) * sp, y: y + (r - (Math.ceil(n / cols) - 1) / 2) * sp });
  }
  return out;
}
function processCommand(sim, c) {
  const p = sim.players[c.p]; if (!p || !p.alive) return;
  switch (c.t) {
    case 'move': case 'attackmove': {
      const us = ownUnits(sim, c.p, c.ids); const f = formation(us, c.x, c.y);
      us.forEach((u, i) => { u.state = c.t === 'move' ? 'move' : 'attackmove'; u.tx = clamp(f[i].x, 20, WORLD - 20); u.ty = clamp(f[i].y, 20, WORLD - 20); u.target = null; u.resume = null; u.node = null; });
      break; }
    case 'stop': ownUnits(sim, c.p, c.ids).forEach(u => { u.state = 'idle'; u.target = null; u.resume = null; }); break;
    case 'attack': {
      const t = sim.byId.get(c.target); if (!t || !t.alive || t.owner === c.p || t.kind === 'node' || !canSee(sim, c.p, t)) return;
      if (t.owner >= 0 && hasPact(sim, c.p, t.owner)) return; // UI must break the pact first
      ownUnits(sim, c.p, c.ids).forEach(u => { if (UNITS[u.def].attack) { u.state = 'attack'; u.target = t.id; u.resume = null; } else { u.state = 'move'; u.tx = t.x; u.ty = t.y; } });
      break; }
    case 'harvest': {
      const t = sim.byId.get(c.target); if (!t || !t.alive || t.kind !== 'node') return;
      ownUnits(sim, c.p, c.ids).forEach(u => { if (u.def === 'coletor') { u.state = 'harvest'; u.node = t.id; u.target = null; } else { u.state = 'move'; u.tx = t.x; u.ty = t.y; } });
      break; }
    case 'siphon': {
      const t = sim.byId.get(c.target); if (!t || !t.alive || t.kind !== 'building' || t.owner === c.p || !canSee(sim, c.p, t)) return;
      if (!(t.def === 'refinaria' || t.def === 'reator') || hasPact(sim, c.p, t.owner)) return;
      ownUnits(sim, c.p, c.ids).forEach(u => { if (u.def === 'pirata') { u.state = 'siphon'; u.target = t.id; u.siphonT = 0; } else { u.state = 'move'; u.tx = t.x; u.ty = t.y; } });
      break; }
    case 'pickup': {
      const t = sim.byId.get(c.target); if (!t || !t.alive || t.kind !== 'crate') return;
      ownUnits(sim, c.p, c.ids).forEach(u => { u.state = 'pickup'; u.target = t.id; });
      break; }
    case 'build': {
      const d = BUILDINGS[c.def]; if (!d || !d.key) return;
      const ok = canBuild(sim, c.p, c.def, c.x, c.y); if (!ok.ok) { if (p.human) emit(sim, { t: 'notice', p: c.p, text: ok.why }); return; }
      if (!canAfford(p, d.cost)) { if (p.human) emit(sim, { t: 'notice', p: c.p, text: 'Recursos insuficientes' }); return; }
      pay(p, d.cost); addBuilding(sim, c.p, c.def, c.x, c.y, false);
      emit(sim, { t: 'place', p: c.p, x: c.x, y: c.y, def: c.def });
      break; }
    case 'produce': {
      const b = sim.byId.get(c.id); if (!b || !b.alive || b.kind !== 'building' || b.owner !== c.p || !b.built) return;
      const bd = BUILDINGS[b.def]; if (!bd.produces || !bd.produces.includes(c.def)) return;
      if (b.queue.length >= 6) return;
      const ud = UNITS[c.def]; let mult = 1;
      if (facOf(sim, c.p).lotes) { const same = b.queue.filter(q => q.def === c.def).length; if (same >= 4) mult = 0.5; }
      if (!canAfford(p, scaleCost(ud.cost, mult))) { if (p.human) emit(sim, { t: 'notice', p: c.p, text: 'Recursos insuficientes' }); return; }
      pay(p, ud.cost, mult); b.queue.push({ def: c.def, t: 0, total: ud.time, mult });
      break; }
    case 'cancel': {
      const b = sim.byId.get(c.id); if (!b || !b.alive || b.owner !== c.p) return;
      const it = b.queue[c.index]; if (!it) return; refund(p, UNITS[it.def].cost, it.mult); b.queue.splice(c.index, 1);
      break; }
    case 'rally': { const b = sim.byId.get(c.id); if (b && b.alive && b.owner === c.p && b.kind === 'building') b.rally = { x: c.x, y: c.y }; break; }
    case 'research': {
      const r = RESEARCH[c.key]; if (!r || p.research[c.key]) return;
      if (!hasBuilt(sim, c.p, 'laboratorio')) { if (p.human) emit(sim, { t: 'notice', p: c.p, text: 'Requer Laboratório' }); return; }
      if (!canAfford(p, r.cost)) { if (p.human) emit(sim, { t: 'notice', p: c.p, text: 'Fragmentos de Dados insuficientes' }); return; }
      pay(p, r.cost); p.research[c.key] = true; alertTo(sim, c.p, 'Pesquisa concluída: ' + r.name, null, null, 'good');
      break; }
    case 'overcharge': {
      if (sim.time < p.overchargeCd || p.res.plasma < OVERCHARGE_COST) { if (p.human) emit(sim, { t: 'notice', p: c.p, text: sim.time < p.overchargeCd ? 'Sobrecarga em recarga' : 'Requer 200 Plasma' }); return; }
      p.res.plasma -= OVERCHARGE_COST; p.overchargeT = OVERCHARGE_T; p.overchargeCd = sim.time + OVERCHARGE_CD;
      alertTo(sim, c.p, 'Sobrecarga: +50% de energia por 60 s', null, null, 'good');
      break; }
    case 'super': {
      const fac = facOf(sim, c.p);
      if (!hasBuilt(sim, c.p, 'laboratorio')) { if (p.human) emit(sim, { t: 'notice', p: c.p, text: 'Requer Laboratório' }); return; }
      if (sim.time < p.superCd) { if (p.human) emit(sim, { t: 'notice', p: c.p, text: 'Superarma em recarga' }); return; }
      if (!canAfford(p, SUPER_COST)) { if (p.human) emit(sim, { t: 'notice', p: c.p, text: 'Requer 300 Dados e 200 Plasma' }); return; }
      if (fac.superKey === 'fundicao') {
        const ok = canBuild(sim, c.p, 'bastiao', c.x, c.y);
        if (!ok.ok || !inTerritory(sim, c.p, c.x, c.y)) { if (p.human) emit(sim, { t: 'notice', p: c.p, text: ok.ok ? 'Fora do seu território' : ok.why }); return; }
        pay(p, SUPER_COST); p.superCd = sim.time + SUPER_CD;
        addBuilding(sim, c.p, 'bastiao', c.x, c.y, false);
        emit(sim, { t: 'super', p: c.p, kind: 'fundicao', x: c.x, y: c.y });
        for (const q of sim.players) if (q.alive) alertTo(sim, q.id, (q.id === c.p ? 'Fundição Orbital a caminho' : p.name + ' ativou Fundição Orbital!'), c.x, c.y, q.id === c.p ? 'good' : 'danger');
      } else {
        pay(p, SUPER_COST); p.superCd = sim.time + SUPER_CD; p.speedBuffT = 20;
        for (const q of sim.players) if (q.alive && q.id !== c.p) { q.blackoutT = 20; alertTo(sim, q.id, p.name + ' ativou Blecaute! Sensores e energia a zero por 20 s', null, null, 'danger'); }
        alertTo(sim, c.p, 'Blecaute ativo: inimigos cegos por 20 s', null, null, 'good');
        emit(sim, { t: 'super', p: c.p, kind: 'blecaute' });
      }
      break; }
    case 'jump': {
      const nuc = nucleoOf(sim, c.p); if (!nuc || nuc.jumpT > 0) return;
      if (p.jumpsLeft <= 0) { if (p.human) emit(sim, { t: 'notice', p: c.p, text: 'Sem Saltos restantes' }); return; }
      const ok = canBuild(sim, c.p, 'bastiao', c.x, c.y); // generic placement check (bounds, rift, overlap)
      if (!ok.ok) { if (p.human) emit(sim, { t: 'notice', p: c.p, text: ok.why }); return; }
      const to = territoryOwner(sim, c.x, c.y); if (to !== -1 && to !== c.p) { if (p.human) emit(sim, { t: 'notice', p: c.p, text: 'Território inimigo' }); return; }
      const frac = facOf(sim, c.p).jumpCostFrac;
      for (const k in p.res) p.res[k] = Math.floor(p.res[k] * (1 - frac));
      p.jumpsLeft--; nuc.jumpT = JUMP_CHANNEL; nuc.jumpTo = { x: c.x, y: c.y };
      for (const q of sim.players) if (q.alive) alertTo(sim, q.id, q.id === c.p ? 'Salto de Núcleo iniciado (60 s)' : p.name + ' iniciou um Salto de Núcleo!', nuc.x, nuc.y, q.id === c.p ? 'good' : 'warn');
      break; }
    case 'propose': {
      const q = sim.players[c.to]; if (!q || !q.alive || c.to === c.p || hasPact(sim, c.p, c.to)) return;
      if (sim.pending.some(pr => pr.from === c.p && pr.to === c.to)) return;
      if (!canAfford(p, { minerio: PACT_CAUCAO })) { if (p.human) emit(sim, { t: 'notice', p: c.p, text: 'Caução: 150 Minério' }); return; }
      sim.pending.push({ from: c.p, to: c.to, t: sim.time });
      emit(sim, { t: 'proposal', p: c.to, from: c.p });
      alertTo(sim, c.to, p.name + ' propõe Não-agressão (10 min, Caução 150)', null, null, 'info');
      if (p.human) emit(sim, { t: 'notice', p: c.p, text: 'Proposta enviada a ' + q.name });
      break; }
    case 'respond': {
      const idx = sim.pending.findIndex(pr => pr.to === c.p && pr.from === c.to); if (idx < 0) return;
      sim.pending.splice(idx, 1);
      const a = sim.players[c.to];
      if (!c.accept) { alertTo(sim, c.to, p.name + ' recusou o pacto', null, null, 'warn'); return; }
      if (!canAfford(a, { minerio: PACT_CAUCAO }) || !canAfford(p, { minerio: PACT_CAUCAO })) { alertTo(sim, c.to, 'Pacto falhou: Caução insuficiente', null, null, 'warn'); return; }
      a.res.minerio -= PACT_CAUCAO; p.res.minerio -= PACT_CAUCAO;
      const pact = { a: a.id, b: p.id, until: sim.time + PACT_DURATION, since: sim.time, caucao: PACT_CAUCAO };
      a.pacts[p.id] = pact; p.pacts[a.id] = pact; a.stats.treaties++; p.stats.treaties++;
      alertTo(sim, a.id, 'Pacto de Não-agressão com ' + p.name + ' (10 min)', null, null, 'good');
      alertTo(sim, p.id, 'Pacto de Não-agressão com ' + a.name + ' (10 min)', null, null, 'good');
      emit(sim, { t: 'pact', a: a.id, b: p.id });
      break; }
    case 'break': {
      const pact = p.pacts[c.with]; if (!pact) return;
      const v = sim.players[c.with];
      delete p.pacts[c.with]; delete v.pacts[c.p];
      v.res.minerio += pact.caucao * 2; // victim gets both deposits
      p.rep = Math.max(-2, p.rep - 1); p.golpeT = 45; p.stats.betrayals++;
      alertTo(sim, c.with, p.name + ' QUEBROU O PACTO! Golpe de Traição ativo por 45 s', null, null, 'danger');
      alertTo(sim, c.p, 'Você quebrou o pacto: +20% de dano por 45 s. Reputação ↓ (' + REP_NAMES[p.rep] + ')', null, null, 'warn');
      emit(sim, { t: 'betrayal', by: c.p, victim: c.with });
      break; }
  }
}
function scaleCost(cost, m) { const o = {}; for (const k in cost) o[k] = cost[k] * m; return o; }
function hasBuilt(sim, pid, def) { for (const e of sim.ents) if (e.alive && e.kind === 'building' && e.owner === pid && e.def === def && e.built) return true; return false; }
function nucleoOf(sim, pid) { for (const e of sim.ents) if (e.alive && e.kind === 'building' && e.owner === pid && e.def === 'nucleo') return e; return null; }

// ---------- per-tick systems ----------
function computeEnergy(sim, p, dt) {
  let prod = 0, cons = 0;
  for (const e of sim.ents) {
    if (!e.alive || e.owner !== p.id) continue;
    if (e.kind === 'building') {
      const d = BUILDINGS[e.def];
      if (!e.built) continue;
      if (d.energyProd) {
        if (d.plasmaBurn) { if (p.res.plasma > 0) { prod += d.energyProd; p.res.plasma = Math.max(0, p.res.plasma - d.plasmaBurn * dt); } }
        else prod += d.energyProd;
      }
      cons += d.energyUse || 0;
    } else if (e.kind === 'unit') cons += UNITS[e.def].energyUse || 0;
  }
  if (p.overchargeT > 0) prod *= 1.5;
  if (p.blackoutT > 0) prod = 0;
  const ratio = cons > 0 ? prod / cons : 1;
  p.energy.prod = prod; p.energy.cons = cons; p.energy.ratio = ratio;
  const prev = p.energy.regime;
  p.energy.regime = ratio >= 1 ? 'pleno' : ratio >= 0.7 ? 'racionado' : 'colapso';
  if (prev !== p.energy.regime && p.human) emit(sim, { t: 'regime', p: p.id, regime: p.energy.regime });
}

function counterMult(sim, a, t) {
  const ac = a.cls, tc = t.kind === 'building' ? 'est' : t.cls;
  if (tc === 'civ' || ac === 'civ') return 1;
  let m = (COUNTER[ac] && COUNTER[ac][tc]) || 1;
  if (t.kind === 'building' && facOf(sim, t.owner).structNeutralVsVehicle && ac === 'vei') m = 1;
  if (a.kind === 'building' && facOf(sim, a.owner).structNeutralVsVehicle && tc === 'vei') m = 1;
  return m;
}
function fire(sim, a, t) {
  const p = sim.players[a.owner], q = sim.players[t.owner];
  const atk = a.kind === 'unit' ? UNITS[a.def].attack : BUILDINGS[a.def].attack;
  let dmg = atk.dmg * counterMult(sim, a, t);
  if (p.research.armamento) dmg *= 1.15;
  if (p.golpeT > 0) dmg *= 1.2;
  if (a.kind === 'building') dmg *= regimeOf(sim, a.owner).defF;
  let ambush = false;
  if (a.kind === 'unit' && a.cloaked && a.def === 'infantaria') { dmg *= 1.5; ambush = true; }
  if (q && q.research.blindagem) dmg *= 0.87;
  t.hp -= dmg; t.lastHitT = sim.time; t.lastHitBy = a.owner;
  p.stats.dmg += dmg;
  a.cd = atk.cd; a.lastAttack = sim.time; a.cloaked = false;
  if (atk.stun && (t.cls === 'vei' || t.kind === 'building')) t.cd = Math.max(t.cd || 0, 1.0);
  emit(sim, { t: 'shot', x1: a.x, y1: a.y, x2: t.x, y2: t.y, cls: a.cls, owner: a.owner, ambush });
  if (t.kind === 'building' && q) {
    if (t.def === 'nucleo' && sim.time - q.lastNucleoAlert > 10) { q.lastNucleoAlert = sim.time; alertTo(sim, q.id, 'NÚCLEO SOB ATAQUE!', t.x, t.y, 'danger'); }
    else if (sim.time - q.lastBaseAlert > 12) { q.lastBaseAlert = sim.time; alertTo(sim, q.id, 'Base sob ataque', t.x, t.y, 'danger'); }
  }
  if (t.hp <= 0) kill(sim, t, a.owner);
}
function kill(sim, e, killer) {
  if (!e.alive) return;
  e.alive = false;
  const p = sim.players[e.owner];
  emit(sim, { t: 'death', x: e.x, y: e.y, r: e.r, kind: e.kind, def: e.def, owner: e.owner, cls: e.cls });
  if (e.kind === 'unit') {
    if (p) p.stats.unitsLost++;
    if (killer >= 0 && killer !== e.owner) sim.players[killer].stats.unitsKilled++;
    if (e.cargoTotal > 0) {
      const c = { id: sim.nextId++, kind: 'crate', x: e.x, y: e.y, r: 9, alive: true, owner: -1, cargo: Object.assign({}, e.cargo), stolen: e.stolen, bornT: sim.time };
      sim.ents.push(c); sim.byId.set(c.id, c);
      emit(sim, { t: 'crate', x: e.x, y: e.y });
      if (p && p.human) alertTo(sim, p.id, 'Caixa derrubada: ' + Math.round(e.cargoTotal) + ' em recursos', e.x, e.y, 'warn');
    }
  } else if (e.kind === 'building') {
    if (p) p.stats.buildingsLost++;
    if (killer >= 0 && killer !== e.owner) sim.players[killer].stats.buildingsDestroyed++;
    if (e.def === 'nucleo') eliminate(sim, e.owner, killer);
  }
}
function eliminate(sim, pid, killer) {
  const p = sim.players[pid]; if (!p.alive) return;
  p.alive = false;
  for (const e of sim.ents) if (e.alive && e.owner === pid) { e.alive = false; emit(sim, { t: 'death', x: e.x, y: e.y, r: e.r, kind: e.kind, def: e.def, owner: pid, cls: e.cls }); }
  for (const k in p.pacts) { const q = sim.players[k]; delete q.pacts[pid]; } p.pacts = {};
  for (const q of sim.players) if (q.alive) alertTo(sim, q.id, p.name + ' foi eliminado' + (killer >= 0 && killer !== pid ? ' por ' + sim.players[killer].name : ''), null, null, q.id === killer ? 'good' : 'warn');
  emit(sim, { t: 'eliminated', p: pid });
}

function acquire(sim, u, rad, unitsOnly) {
  let best = null, bd = Infinity;
  const vis = sim.vis[u.owner];
  queryGrid(sim, u.x, u.y, rad + 40, e => {
    if (e.owner === u.owner || e.owner < 0 || e.kind === 'crate') return;
    if (!isEnemy(sim, u.owner, e.owner)) return;
    if (!vis.has(e.id)) return;
    if (unitsOnly && e.kind !== 'unit') return;
    const d = dist(u.x, u.y, e.x, e.y) - e.r;
    if (d > rad) return;
    const score = d + (e.kind === 'building' ? 200 : 0) + (e.cls === 'civ' ? 60 : 0);
    if (score < bd) { bd = score; best = e; }
  });
  return best;
}
function moveToward(sim, u, tx, ty, dt) {
  const dx = tx - u.x, dy = ty - u.y; const d = Math.hypot(dx, dy);
  const sp = speedOf(sim, u) * dt;
  if (d <= Math.max(sp, 4)) { u.x = tx; u.y = ty; return true; }
  u.x += dx / d * sp; u.y += dy / d * sp; u.ang = Math.atan2(dy, dx); return false;
}
function nearestDeposit(sim, u) {
  let best = null, bd = Infinity;
  for (const e of sim.ents) {
    if (!e.alive || e.kind !== 'building' || e.owner !== u.owner || !e.built || !BUILDINGS[e.def].deposit) continue;
    const d = dist(u.x, u.y, e.x, e.y); if (d < bd) { bd = d; best = e; }
  }
  return best;
}
function pickNode(sim, u) {
  const p = sim.players[u.owner];
  // weight: prefer resource with lowest stock
  const stock = p.res; const w = { minerio: 1, plasma: 1, dados: 0.8 };
  const lowest = ['minerio', 'plasma', 'dados'].sort((a, b) => stock[a] - stock[b])[0];
  w[lowest] *= 0.6;
  let best = null, bd = Infinity;
  for (const e of sim.ents) {
    if (!e.alive || e.kind !== 'node' || e.amount <= 0) continue;
    if (!inTerritory(sim, u.owner, e.x, e.y)) continue;
    const d = dist(u.x, u.y, e.x, e.y) * w[e.res];
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}
function deliver(sim, u) {
  const p = sim.players[u.owner];
  const mult = p.human ? 1 : (DIFFICULTY[p.difficulty] || DIFFICULTY.normal).income;
  let total = 0;
  for (const k in u.cargo) {
    let v = u.cargo[k];
    if (u.stolen) v *= facOf(sim, u.owner).stolenMult; else v *= mult;
    p.res[k] += v; total += v;
  }
  if (u.stolen) {
    p.stats.stolen += total;
    emit(sim, { t: 'float', x: u.x, y: u.y, text: 'ROUBO +' + Math.round(total), owner: u.owner, kind: 'steal' });
    if (!facOf(sim, u.owner).cleanTheft && u.victim >= 0 && sim.players[u.victim].alive) {
      // Rastro: victim learns where the stolen resources went
      const nuc = nucleoOf(sim, u.owner);
      if (nuc) alertTo(sim, u.victim, 'Rastro: recursos roubados entregues na base de ' + p.name, nuc.x, nuc.y, 'warn');
    }
  } else {
    p.stats.collected += total;
    emit(sim, { t: 'float', x: u.x, y: u.y, text: '+' + Math.round(total), owner: u.owner, kind: 'gain' });
  }
  u.cargo = { plasma: 0, minerio: 0, dados: 0 }; u.cargoTotal = 0; u.stolen = false; u.victim = -1;
}

function updateUnit(sim, u, dt) {
  const d = UNITS[u.def];
  if (u.cd > 0) u.cd -= dt;
  if (u.revealT > 0) u.revealT -= dt;
  const fac = facOf(sim, u.owner);
  u.cloaked = !!fac.cloak[u.def] && u.state !== 'siphon' && (sim.time - u.lastAttack) > 3;
  switch (u.state) {
    case 'idle': {
      if (d.attack) { const t = acquire(sim, u, d.attack.range + 70, false); if (t) { u.target = t.id; u.state = 'attack'; u.resume = null; } }
      else if (u.def === 'coletor') { const n = pickNode(sim, u); if (n) { u.node = n.id; u.state = 'harvest'; } }
      break; }
    case 'move': if (moveToward(sim, u, u.tx, u.ty, dt)) u.state = 'idle'; break;
    case 'attackmove': {
      if (d.attack) { const t = acquire(sim, u, d.attack.range + 90, false); if (t) { u.target = t.id; u.state = 'attack'; u.resume = { x: u.tx, y: u.ty }; break; } }
      if (moveToward(sim, u, u.tx, u.ty, dt)) u.state = 'idle';
      break; }
    case 'attack': {
      const t = sim.byId.get(u.target);
      if (!t || !t.alive || !d.attack || !sim.vis[u.owner].has(t.id) && t.owner !== u.owner || !isEnemy(sim, u.owner, t.owner)) {
        if (u.resume) { u.state = 'attackmove'; u.tx = u.resume.x; u.ty = u.resume.y; u.resume = null; } else u.state = 'idle';
        u.target = null; break;
      }
      const dd = dist(u.x, u.y, t.x, t.y);
      if (dd <= d.attack.range + t.r) { u.ang = Math.atan2(t.y - u.y, t.x - u.x); if (u.cd <= 0) fire(sim, u, t); }
      else moveToward(sim, u, t.x, t.y, dt);
      break; }
    case 'harvest': {
      const n = sim.byId.get(u.node);
      if (!n || !n.alive || n.amount <= 0) { const m = pickNode(sim, u); if (m) u.node = m.id; else u.state = u.cargoTotal > 0 ? 'return' : 'idle'; break; }
      if (dist(u.x, u.y, n.x, n.y) <= u.r + n.r + 8) {
        const take = Math.min(d.harvestRate * dt, n.amount, d.capacity - u.cargoTotal);
        n.amount -= take; u.cargo[n.res] += take; u.cargoTotal += take;
        if (u.cargoTotal >= d.capacity - 0.01 || n.amount <= 0) u.state = 'return';
      } else moveToward(sim, u, n.x, n.y, dt);
      break; }
    case 'return': {
      const dep = nearestDeposit(sim, u);
      if (!dep) { u.state = 'idle'; break; }
      if (dist(u.x, u.y, dep.x, dep.y) <= u.r + dep.r + 10) {
        deliver(sim, u);
        if (u.def === 'coletor') { const n = sim.byId.get(u.node); if (n && n.alive && n.amount > 0) u.state = 'harvest'; else { const m = pickNode(sim, u); if (m) { u.node = m.id; u.state = 'harvest'; } else u.state = 'idle'; } }
        else u.state = 'idle';
      } else moveToward(sim, u, dep.x, dep.y, dt);
      break; }
    case 'siphon': {
      const b = sim.byId.get(u.target);
      if (!b || !b.alive || !isEnemy(sim, u.owner, b.owner)) { u.state = u.cargoTotal > 0 ? 'return' : 'idle'; u.target = null; break; }
      if (dist(u.x, u.y, b.x, b.y) <= d.siphonRange + b.r) {
        const v = sim.players[b.owner];
        if (u.siphonT === 0) {
          const delay = v.energy.regime === 'pleno' ? 3 : v.energy.regime === 'racionado' ? 4 : 5;
          u.alertAt = sim.time + delay; u.alerted = false;
        }
        u.siphonT += dt;
        if (!u.alerted && sim.time >= u.alertAt) { u.alerted = true; alertTo(sim, b.owner, 'ALERTA DE SIFÃO em ' + BUILDINGS[b.def].name, b.x, b.y, 'danger'); u.revealT = 2; }
        const rate = d.siphonRate * dt;
        for (const k of ['plasma', 'minerio']) {
          const take = Math.min(rate, v.res[k], u.cargoCap - u.cargoTotal);
          if (take > 0) { v.res[k] -= take; u.cargo[k] += take; u.cargoTotal += take; v.stats.lost += take; }
        }
        u.stolen = u.cargoTotal > 0; u.victim = b.owner;
        emit(sim, { t: 'siphon', x1: u.x, y1: u.y, x2: b.x, y2: b.y, owner: u.owner });
        if (u.siphonT >= d.siphonMax || u.cargoTotal >= u.cargoCap - 0.01) { u.state = 'return'; u.siphonT = 0; }
      } else moveToward(sim, u, b.x, b.y, dt);
      break; }
    case 'pickup': {
      const c = sim.byId.get(u.target);
      if (!c || !c.alive) { u.state = 'idle'; break; }
      if (dist(u.x, u.y, c.x, c.y) > u.r + c.r + 6) moveToward(sim, u, c.x, c.y, dt); else u.state = 'idle';
      break; }
  }
}
function pickupCrates(sim) {
  for (const c of sim.ents) {
    if (!c.alive || c.kind !== 'crate') continue;
    let taker = null;
    queryGrid(sim, c.x, c.y, 30, e => { if (!taker && e.kind === 'unit' && e.alive && dist(e.x, e.y, c.x, c.y) <= e.r + c.r + 6) taker = e; });
    if (taker) {
      const p = sim.players[taker.owner]; let total = 0;
      for (const k in c.cargo) { p.res[k] += c.cargo[k]; total += c.cargo[k]; }
      p.stats.stolen += c.stolen ? total : 0; if (!c.stolen) p.stats.collected += total;
      c.alive = false;
      emit(sim, { t: 'float', x: c.x, y: c.y, text: 'CAIXA +' + Math.round(total), owner: taker.owner, kind: 'steal' });
      if (p.human) alertTo(sim, p.id, 'Caixa recolhida: +' + Math.round(total), c.x, c.y, 'good');
    } else if (sim.time - c.bornT > 120) c.alive = false;
  }
}
function updateBuilding(sim, b, dt) {
  const d = BUILDINGS[b.def]; const p = sim.players[b.owner];
  if (b.cd > 0) b.cd -= dt;
  if (b.revealT > 0) b.revealT -= dt;
  b.cloaked = !!facOf(sim, b.owner).cloak[b.def];
  const reg = regimeOf(sim, b.owner);
  if (!b.built) {
    const dp = Math.min(1 - b.progress, (d.buildTime > 0 ? dt / d.buildTime : 1) * reg.prodF);
    b.progress += dp; b.hp = Math.min(b.maxHp, b.hp + b.maxHp * 0.7 * dp);
    if (b.progress >= 0.999) { b.built = true; b.progress = 1; emit(sim, { t: 'built', p: b.owner, x: b.x, y: b.y, def: b.def }); }
    return;
  }
  if (b.jumpT > 0) {
    b.jumpT -= dt;
    if (b.jumpT <= 0) {
      const from = { x: b.x, y: b.y };
      b.x = b.jumpTo.x; b.y = b.jumpTo.y; b.px = b.x; b.py = b.y; b.jumpTo = null; b.jumpT = 0;
      emit(sim, { t: 'jump', p: b.owner, from, to: { x: b.x, y: b.y } });
      for (const q of sim.players) if (q.alive) alertTo(sim, q.id, q.id === b.owner ? 'Salto de Núcleo concluído' : p.name + ' saltou o Núcleo!', b.x, b.y, q.id === b.owner ? 'good' : 'warn');
    }
    return; // no production while jumping
  }
  if (b.queue.length) {
    let mult = reg.prodF;
    if (facOf(sim, b.owner).lineBonus && d.produces && b.def !== 'nucleo') {
      let n = 0; queryGrid(sim, b.x, b.y, 160, e => { if (e !== b && e.kind === 'building' && e.owner === b.owner && e.built && BUILDINGS[e.def].produces && e.def !== 'nucleo' && dist(e.x, e.y, b.x, b.y) <= 150) n++; });
      mult *= 1 + 0.12 * Math.min(4, n);
    }
    const it = b.queue[0]; it.t += dt * mult;
    if (it.t >= it.total) {
      b.queue.shift();
      const ang = b.rally ? Math.atan2(b.rally.y - b.y, b.rally.x - b.x) : Math.atan2(CY - b.y, CX - b.x);
      const u = addUnit(sim, b.owner, it.def, b.x + Math.cos(ang) * (b.r + 14), b.y + Math.sin(ang) * (b.r + 14));
      if (b.rally) { u.state = 'move'; u.tx = b.rally.x + (sim.rand() - 0.5) * 30; u.ty = b.rally.y + (sim.rand() - 0.5) * 30; }
      emit(sim, { t: 'spawn', p: b.owner, x: u.x, y: u.y, def: it.def });
    }
  }
  if (d.attack && b.cd <= 0) {
    const t = acquire(sim, b, d.attack.range, false);
    if (t) fire(sim, b, t);
  }
}
function separate(sim) {
  const units = [];
  for (const e of sim.ents) if (e.alive && e.kind === 'unit') units.push(e);
  for (const u of units) {
    let fx = 0, fy = 0;
    queryGrid(sim, u.x, u.y, 40, e => {
      if (e === u || !e.alive) return;
      if (e.kind === 'unit') {
        if (UNITS[e.def].flying !== UNITS[u.def].flying) return;
        const dx = u.x - e.x, dy = u.y - e.y; const dd = Math.hypot(dx, dy) || 0.01; const min = u.r + e.r + 1;
        if (dd < min) { const push = (min - dd) * 0.5; fx += dx / dd * push; fy += dy / dd * push; }
      } else if (e.kind === 'building') {
        if (UNITS[u.def].flying) return;
        const dx = u.x - e.x, dy = u.y - e.y; const dd = Math.hypot(dx, dy) || 0.01; const min = u.r + e.r + 2;
        if (dd < min) { fx += dx / dd * (min - dd); fy += dy / dd * (min - dd); }
      }
    });
    if (!UNITS[u.def].flying) {
      const dx = u.x - CX, dy = u.y - CY; const dd = Math.hypot(dx, dy) || 0.01; const min = RIFT_R + u.r;
      if (dd < min) { fx += dx / dd * (min - dd); fy += dy / dd * (min - dd); }
    }
    if (fx || fy) { u.x = clamp(u.x + fx, 10, WORLD - 10); u.y = clamp(u.y + fy, 10, WORLD - 10); }
  }
}
function computeVisibility(sim) {
  for (const p of sim.players) {
    const vis = sim.vis[p.id]; vis.clear();
    if (!p.alive) continue;
    const circles = [], detectors = [];
    for (const e of sim.ents) {
      if (!e.alive || e.owner !== p.id) continue;
      circles.push([e.x, e.y, sensorRadius(sim, e)]);
      if (e.kind === 'building' && e.built && BUILDINGS[e.def].detect) detectors.push([e.x, e.y, BUILDINGS[e.def].detect]);
    }
    for (const e of sim.ents) {
      if (!e.alive || e.owner === p.id || e.kind === 'node') continue;
      let seen = false;
      if (e.kind === 'building' && e.built && e.def === 'reator' && facOf(sim, e.owner).smoke) seen = true;
      if (!seen) for (const c of circles) { if (dist(e.x, e.y, c[0], c[1]) <= c[2] + e.r) { seen = true; break; } }
      if (seen && e.cloaked && !(e.revealT > 0)) {
        seen = false;
        for (const c of detectors) { if (dist(e.x, e.y, c[0], c[1]) <= c[2] + e.r) { seen = true; break; } }
      }
      if (seen) vis.add(e.id);
    }
  }
}
function updatePacts(sim) {
  for (let i = sim.pending.length - 1; i >= 0; i--) if (sim.time - sim.pending[i].t > PROPOSAL_TTL) sim.pending.splice(i, 1);
  const done = new Set();
  for (const p of sim.players) for (const k in p.pacts) {
    const pact = p.pacts[k]; if (done.has(pact)) continue;
    if (sim.time >= pact.until) {
      done.add(pact);
      const a = sim.players[pact.a], b = sim.players[pact.b];
      delete a.pacts[b.id]; delete b.pacts[a.id];
      a.res.minerio += pact.caucao; b.res.minerio += pact.caucao;
      a.rep = Math.min(2, a.rep + 1); b.rep = Math.min(2, b.rep + 1);
      if (a.alive) alertTo(sim, a.id, 'Pacto cumprido com ' + b.name + '. Caução devolvida. Reputação ↑ (' + REP_NAMES[a.rep] + ')', null, null, 'good');
      if (b.alive) alertTo(sim, b.id, 'Pacto cumprido com ' + a.name + '. Caução devolvida. Reputação ↑ (' + REP_NAMES[b.rep] + ')', null, null, 'good');
    }
  }
}
function score(sim, p) {
  let s = 0;
  for (const e of sim.ents) {
    if (!e.alive || e.owner !== p.id) continue;
    if (e.kind === 'building') { s += 100; if (e.def === 'nodulo') s += 300; if (e.def === 'nucleo') s += 200; }
    else if (e.kind === 'unit') { const c = UNITS[e.def].cost; s += (c.minerio || 0) + (c.plasma || 0) + (c.dados || 0); }
  }
  s += p.res.plasma + p.res.minerio + p.res.dados;
  return Math.round(s);
}
function checkEnd(sim) {
  if (sim.result) return;
  const humans = sim.players.filter(p => p.human), ais = sim.players.filter(p => !p.human);
  const humanAlive = humans.some(p => p.alive), aiAlive = ais.some(p => p.alive);
  const scores = sim.players.map(p => ({ id: p.id, name: p.name, score: p.alive ? score(sim, p) : 0, alive: p.alive }));
  if (humans.length === 0) { // headless mode: last one standing or time
    const aliveN = sim.players.filter(p => p.alive).length;
    if (aliveN <= 1) sim.result = { outcome: 'headless', reason: 'Último sobrevivente', scores };
    else if (sim.time >= sim.maxTime) sim.result = { outcome: 'headless', reason: 'Tempo', scores };
    if (sim.result) emit(sim, { t: 'end', result: sim.result });
    return;
  }
  if (!humanAlive) sim.result = { outcome: 'defeat', reason: 'Seu Núcleo foi destruído.', scores };
  else if (!aiAlive) sim.result = { outcome: 'victory', reason: 'Todos os Núcleos inimigos caíram.', scores };
  else if (sim.time >= sim.maxTime) {
    const best = scores.slice().sort((a, b) => b.score - a.score)[0];
    const h = humans[0];
    sim.result = { outcome: best.id === h.id ? 'victory' : 'defeat', reason: 'Fim do Ciclo de Maré: vitória por Domínio de ' + best.name + '.', scores };
  }
  if (sim.result) emit(sim, { t: 'end', result: sim.result });
}

function step(sim) {
  const dt = TICK;
  sim.events = [];
  if (sim.result) return sim.events;
  for (const e of sim.ents) if (e.kind !== 'node') { e.px = e.x; e.py = e.y; }
  rebuildGrid(sim);
  const cmds = sim.cmdQueue; sim.cmdQueue = [];
  for (const c of cmds) processCommand(sim, c);
  for (const p of sim.players) {
    if (!p.alive) continue;
    if (p.overchargeT > 0) p.overchargeT -= dt;
    if (p.blackoutT > 0) p.blackoutT -= dt;
    if (p.speedBuffT > 0) p.speedBuffT -= dt;
    if (p.golpeT > 0) p.golpeT -= dt;
    computeEnergy(sim, p, dt);
  }
  updatePacts(sim);
  for (const e of sim.ents) { if (!e.alive) continue; if (e.kind === 'building') updateBuilding(sim, e, dt); }
  for (const e of sim.ents) { if (!e.alive) continue; if (e.kind === 'unit') updateUnit(sim, e, dt); }
  separate(sim);
  pickupCrates(sim);
  // prune
  if (sim.tick % 10 === 0) {
    const keep = [];
    for (const e of sim.ents) { if (e.alive) keep.push(e); else sim.byId.delete(e.id); }
    sim.ents = keep;
  }
  computeVisibility(sim);
  sim.tick++; sim.time = sim.tick * TICK;
  checkEnd(sim);
  return sim.events;
}

// ---------- queries for UI/AI ----------
function entitiesOf(sim, pid) { const out = []; for (const e of sim.ents) if (e.alive && e.owner === pid) out.push(e); return out; }
function armyValue(sim, pid) {
  let v = 0;
  for (const e of sim.ents) if (e.alive && e.owner === pid && e.kind === 'unit' && UNITS[e.def].attack) { const c = UNITS[e.def].cost; v += (c.minerio || 0) + (c.plasma || 0) + (c.dados || 0); }
  return v;
}
function hash(sim) { // cheap state hash for determinism tests
  let h = 2166136261;
  const mix = v => { h ^= (v | 0); h = Math.imul(h, 16777619) >>> 0; };
  for (const e of sim.ents) { if (!e.alive) continue; mix(e.id); mix(Math.round(e.x * 10)); mix(Math.round(e.y * 10)); mix(Math.round((e.hp || 0) * 10)); mix(Math.round((e.amount || 0) * 10)); }
  for (const p of sim.players) { mix(Math.round(p.res.plasma * 10)); mix(Math.round(p.res.minerio * 10)); mix(Math.round(p.res.dados * 10)); mix(p.rep); }
  return h >>> 0;
}

ARD.sim = {
  TICK, WORLD, CX, CY, RIFT_R, FACTIONS, BUILDINGS, UNITS, COUNTER, CLASS_NAMES, RESEARCH, REGIME, DIFFICULTY, REP_NAMES,
  SUPER_COST, SUPER_CD, OVERCHARGE_COST, OVERCHARGE_CD, PACT_CAUCAO, PACT_DURATION, JUMP_CHANNEL, PLAYER_COLORS,
  createSim, step, enqueue, canBuild, canAfford, inTerritory, territoryOwner, canSee, entitiesOf, armyValue, hasBuilt, nucleoOf, score, hash, dist, hasPact, isEnemy, sensorRadius,
};
})(globalThis.ARD = globalThis.ARD || {});
