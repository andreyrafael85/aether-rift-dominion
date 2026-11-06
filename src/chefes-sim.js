/* Aether Rift: Dominion — 5.0g: chefões na simulação (O Arauto, A Forja-Mãe e a Sentinela da Fenda), o jogador neutro "Fenda",
   a telegrafia dos golpes (sim.avisos), o chão que muda (sim.terreno) e o mapa Destroço do Titã (cfg.map = 'tita').
   Simulação pura: sem DOM, sem Math.random e sem relógio; só sim.rand(), a matemática determinística (DM) e o tique.
   Entra no build antes do src/sim.js; os dois se ligam por ARD.chefesSim.instala(ARD.sim), em qualquer ordem de carga.
   Partida sem chefão, sem evento e sem o mapa novo não passa por nada daqui (o mesmo hash de antes). */
(function (ARD) {
'use strict';
let S = null, I = null; /* ARD.sim e as funções internas dele (ARD.sim._int) */
const PI = Math.PI, TAU = PI * 2;

/* ---------- tabela dos chefões ----------
   vida: base na Normal com 1 humano (escala por dificuldade e por humanos no cooperativo); raio; fases: limiar de vida (fração) e nome;
   golpes: aviso (s), forma e dano; recompensa: o que o g-modos entrega (o sim só avisa no evento). Textos: chefe.<tipo>.nome, .titulo e .fase.<n>. */
const BOSSES = {
  arauto: { ordem: 3, faccao: 'despertos', def: 'arauto', vida: 22000, raio: 46, voa: true, velocidade: 26, orbita: 230,
    fases: [{ limiar: 1, nome: 'Três Pilares' }, { limiar: 0.66, nome: 'Ecos' }, { limiar: 0.33, nome: 'Colapso' }],
    pilares: 3, pilarVida: 2600, pilarR: 700, guardas: 5, guardasCada: 45, ecoCada: 15, ecoMax: 3,
    golpes: { anel: { aviso: 1.6, r: 85, dano: 170, cada: 9 }, faixa: { aviso: 1.8, w: 64, L: 720, dano: 210, cada: 8 }, eco: { aviso: 1.6, r: 46 },
      poco: { aviso: 5, r: 520, w: 250, dano: 360, puxa: 34, cada: 20, janela: 7 } },
    recompensa: { reliquia: 'lente-do-arauto', efeito: 'visao', titulo: 'arauto' } },
  forja: { ordem: 3, faccao: 'construtores', def: 'forja', vida: 40000, raio: 64, voa: false, velocidade: 10,
    fases: [{ limiar: 1, nome: 'Marcha' }, { limiar: 0.66, nome: 'Linha de montagem' }, { limiar: 0.34, nome: 'Núcleo exposto' }],
    torreCada: 30, torresMax: 8, pernas: 4, pernaVida: 2200, pernaDano: 0.08, lentidao: 0.25, drones: { cada: 20, n: 4, max: 16 },
    captura: { t: 30, inf: 5, r: 110 }, rastro: { cada: 2.5, r: 36, dura: 25, dps: 10 },
    golpes: { pisao: { aviso: 1.7, r: 110, dano: 260, estr: 1.6, cada: 6 }, solda: { aviso: 1.8, w: 56, L: 640, dano: 200, cada: 9 }, calor: { aviso: 2, dr: 150, dano: 140, cada: 9 } },
    recompensa: { A: { escolha: 'destruir', reliquia: 'coracao-da-forja' }, B: { escolha: 'capturar', projeto: 'drone-construtor' } } },
  sentinela: { ordem: 1, faccao: 'despertos', def: 'sentinela', vida: 12000, raio: 32, voa: true, velocidade: 30, orbita: 230,
    fases: [{ limiar: 1, nome: 'Vigia' }], guardas: 4, guardasCada: 25, guardasMax: 8,
    golpes: { anel: { aviso: 1.6, r: 80, dano: 140, cada: 9 }, faixa: { aviso: 1.8, w: 56, L: 620, dano: 170, cada: 9 } },
    recompensa: { recursos: { minerio: 800, plasma: 400, dados: 150 } } },
};
/* dificuldade: vida, dano dos golpes, ritmo (multiplica o intervalo entre golpes) e aviso mínimo (2 s na Fácil, 1,5 s nas outras) */
const DIF = { facil: { vida: 0.7, dano: 0.75, ritmo: 1.25, avisoMin: 2 }, normal: { vida: 1, dano: 1, ritmo: 1, avisoMin: 1.5 },
  dificil: { vida: 1.35, dano: 1.2, ritmo: 0.9, avisoMin: 1.5 }, brutal: { vida: 1.75, dano: 1.4, ritmo: 0.8, avisoMin: 1.5 } };
/* 5.0g.1: Caçada — o chefão dorme na arena até o despertar (s, por dificuldade, contado do começo) ou até ser atacado; o Arauto só golpeia
   dentro da arena dele (a cratera e o anel dos pilares, ARENA_ARAUTO do centro): a base só é alvo pela regra da fase (a Marcha da Forja, os Ecos) */
const DESPERTA = { facil: 120, normal: 90, dificil: 75, brutal: 60 };
const ARENA_ARAUTO = 820;
const SUPER_MAX = 0.2; /* nenhuma superarma tira mais que 20% da vida de um chefão */
const SUPER_DANO = { fundicao: { frac: 0.15, raio: 320 }, eclosao: { frac: 0.08, raio: 320 }, blecaute: { frac: 0.1, raio: 0, calma: 8 } };
const FENDA_COR = '#C23BFF';

/* unidades novas (S.UNITS): os chefões e as partes; faction 'fenda' e epic tiram tudo das listas de produção, do teste de desempenho e do aquecimento por Raça */
const DEFS = {
  arauto:      { name: 'O Arauto', key: '', cls: 'chefe', hp: 22000, r: 46, speed: 26, cost: {}, time: 0, energyUse: 0, weapon: 'olho_arauto', sensor: 520, faction: 'fenda', flying: true, boss: true, epic: true, desc: 'Monólito-lente dos Despertos, o primeiro a atravessar a Fenda.' },
  forja:       { name: 'A Forja-Mãe', key: '', cls: 'chefe', hp: 40000, r: 64, speed: 10, cost: {}, time: 0, energyUse: 0, weapon: 'forja_canhao', sensor: 480, faction: 'fenda', boss: true, epic: true, desc: 'Fábrica antiga dos Construtores que anda sobre quatro pernas.' },
  sentinela:   { name: 'Sentinela da Fenda', key: '', cls: 'chefe', hp: 12000, r: 32, speed: 30, cost: {}, time: 0, energyUse: 0, weapon: 'olho_sentinela', sensor: 420, faction: 'fenda', flying: true, boss: true, epic: true, desc: 'Um Arauto menor que vigia a Fenda.' },
  pilar_fenda: { name: 'Pilar da Fenda', key: '', cls: 'est', hp: 2600, r: 20, speed: 0, cost: {}, time: 0, energyUse: 0, sensor: 220, faction: 'fenda', parte: true, epic: true, desc: 'Alimenta o escudo do Arauto.' },
  perna_forja: { name: 'Perna da Forja', key: '', cls: 'vei', hp: 2200, r: 16, speed: 0, cost: {}, time: 0, energyUse: 0, sensor: 160, faction: 'fenda', parte: true, epic: true, desc: 'Ponto fraco da Forja-Mãe: cada perna destruída a deixa 25% mais lenta.' },
};
const ARMAS = {
  olho_arauto:    { dmg: 26, range: 280, cd: 1.0, proj: 'beam', speed: 0, inacc: 0, splash: 0, cls: 'chefe' },
  forja_canhao:   { dmg: 60, range: 230, cd: 1.6, proj: 'shell', speed: 300, inacc: 10, splash: 30, cls: 'chefe' },
  olho_sentinela: { dmg: 18, range: 240, cd: 1.0, proj: 'beam', speed: 0, inacc: 0, splash: 0, cls: 'chefe' },
};

function instala(sim0) {
  if (!sim0 || !sim0._int || S === sim0) return; S = sim0; I = sim0._int;
  for (const k in ARMAS) if (!S.WEAPONS[k]) { const w = ARMAS[k]; w.versus = { inf: 1, vei: 1, dro: 1, est: 1, sup: 1, civ: 1, chefe: 1 }; S.WEAPONS[k] = w; }
  for (const k in DEFS) if (!S.UNITS[k]) { const d = DEFS[k]; if (d.weapon) d.attack = S.WEAPONS[d.weapon]; S.UNITS[k] = d; }
  S.CLASS_NAMES.chefe = 'Chefões'; S.MAPS.tita = 'Destroço do Titã';
  S.BOSSES = BOSSES; S.spawnBoss = spawnBoss; S.bossOf = bossOf; S.fendaDe = fendaDe; S.isBoss = e => !!(e && e.boss);
}

const cl = (v, a, b) => v < a ? a : v > b ? b : v;
const mmss = t => { t = Math.max(0, Math.round(t)); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); };
function tq(sim, s) { return (sim.tick + Math.max(1, Math.round(s / S.TICK))) * S.TICK; } /* tempo da simulação arredondado ao tique */
function difDe(sim, o) { const c = sim.cfg || {}; const k = (o && o.dif) || (c.cacada && c.cacada.dif) || c.chefeDif || (sim.players.find(p => !p.human && !p.fenda) || {}).difficulty || 'normal'; return DIF[k] ? k : 'normal'; }
function humanos(sim) { let n = 0; for (const p of sim.players) if (p.human && !p.fenda) n++; return Math.max(1, Math.min(4, n)); }
function vivo(sim, id) { const e = sim.byId.get(id); return e && e.alive ? e : null; }

/* ---------- o jogador "Fenda" ---------- */
function fendaDe(sim) {
  if (sim.fenda != null && sim.fenda >= 0 && sim.players[sim.fenda]) return sim.fenda;
  const id = sim.players.length;
  const p = { id, name: 'Fenda', faction: 'vehnar', color: FENDA_COR, human: false, difficulty: 'normal', alive: true, fenda: true,
    res: { plasma: 0, minerio: 0, dados: 0 }, energy: { prod: 0, cons: 0, ratio: 1, regime: 'pleno' },
    overchargeT: 0, overchargeCd: 0, superCd: 0, blackoutT: 0, speedBuffT: 0, golpeT: 0, unissonoT: 0,
    era: 1, evolveT: 0, ascended: false, research: {}, rep: 0, pacts: {}, jumpsLeft: 0, lastBaseAlert: -99, lastNucleoAlert: -99, saltoT: 0, traits: {}, traitXp: {},
    stats: { collected: 0, stolen: 0, lost: 0, unitsKilled: 0, unitsLost: 0, buildingsDestroyed: 0, buildingsLost: 0, treaties: 0, betrayals: 0, dmg: 0 }, startAngle: 0 };
  sim.players.push(p); sim.vis.push(new Set()); sim.explored.push(new Uint8Array(S.TILES * S.TILES));
  if (sim.auras) sim.auras.push({ anchors: [], moldes: [], diapasoes: [] });
  sim.fenda = id;
  if (!sim.chefes) sim.chefes = novoEstado(sim);
  while (sim.chefes.ecos.length < sim.players.length) sim.chefes.ecos.push([]);
  return id;
}
function novoEstado(sim) { return { lista: [], ecos: sim.players.map(() => []), cacada: null }; }

/* chamado no fim do createSim (mapa, nav e terreno prontos): cria a Fenda se a partida tem chefão ou evento, e o chefão da Caçada ou da chave de teste */
function inicio(sim, cfg) {
  if (sim.fenda == null) sim.fenda = -1; if (!sim.avisos) sim.avisos = []; if (!sim.terreno) sim.terreno = []; /* não apaga o que outro módulo (g-modos) já criou */
  const cac = cfg.cacada && BOSSES[cfg.cacada.chefe] ? cfg.cacada : null, dbg = typeof cfg.chefe === 'string' && BOSSES[cfg.chefe] ? cfg.chefe : null;
  if (!cac && !dbg && !cfg.eventos) return;
  fendaDe(sim);
  if (cac) { const pos = arena(sim, cac.chefe, -1); spawnBoss(sim, cac.chefe, pos.x, pos.y, { dif: cac.dif, cacada: true }); }
  if (dbg) { const pos = arena(sim, dbg, 0); spawnBoss(sim, dbg, pos.x, pos.y, { dif: cfg.chefeDif }); }
}
/* onde o chefão nasce: o Arauto e a Sentinela na órbita da cratera (perto = do lado do jogador indicado; -1 = do lado oposto ao jogador 0);
   a Forja na arena do Destroço do Titã (ou, em outro mapa, a 560 do centro), ou a 650 do Núcleo do jogador indicado, na direção do centro */
function arena(sim, tipo, perto) {
  const B = BOSSES[tipo]; const p0 = sim.players[perto >= 0 ? perto : 0]; const a0 = p0 ? p0.startAngle : 0;
  if (B.orbita) { const a = perto >= 0 ? a0 : a0 + PI; return { x: S.CX + S.DM.cos(a) * B.orbita, y: S.CY + S.DM.sin(a) * B.orbita }; }
  if (perto >= 0 && !(sim.map && sim.map.arena)) { const n = I.nucleoOf(sim, perto); /* no Titã a Forja de teste nasce na arena (a marcha até a base leva ~2 min) */ if (n) { const d = S.dist(n.x, n.y, S.CX, S.CY) || 1, k = Math.min(650, d - S.RIFT_R - B.raio - 120) / d; return { x: n.x + (S.CX - n.x) * k, y: n.y + (S.CY - n.y) * k }; } }
  if (sim.map && sim.map.arena) return { x: sim.map.arena.x, y: sim.map.arena.y };
  return { x: S.CX + S.DM.cos(a0 + PI) * 560, y: S.CY + S.DM.sin(a0 + PI) * 560 };
}

/* ---------- API: S.spawnBoss(sim, tipo, x, y, o) devolve a unidade (o.dif, o.vida = multiplicador extra, o.cacada) ---------- */
function spawnBoss(sim, tipo, x, y, o) {
  const B = BOSSES[tipo]; if (!B) return null; o = o || {};
  const f = fendaDe(sim);
  if (o.cacada && sim.chefes.cacada != null) { const c = vivo(sim, sim.chefes.cacada); if (c) return c; } /* o chefão da Caçada nasce uma vez só (o createSim já o cria pela cfg.cacada; pedir de novo devolve o mesmo) */ const dk = difDe(sim, o), D = DIF[dk];
  x = cl(x, 80, S.WORLD - 80); y = cl(y, 80, S.WORLD - 80);
  const u = I.addUnit(sim, f, B.def, x, y);
  u.maxHp = u.hp = Math.round(B.vida * D.vida * (1 + 0.6 * (humanos(sim) - 1)) * (o.vida || 1)); u.r = B.raio; u.speed = B.velocidade; u.state = 'chefe';
  u.ang = S.DM.atan2(S.CY - y, S.CX - x); u.aimAng = u.ang;
  u.boss = { tipo, fase: 1, fases: B.fases.length, faseT: 0, escudo: 0, escudoMax: 0, janela: false, janelaAte: 0, dif: dk, cacada: !!o.cacada,
    prox: sim.time + 4, prox2: sim.time + 7, calma: 0, furia: false, partes: [], pontos: 0, fx: x, fy: y,
    orb: S.DM.atan2(y - S.CY, x - S.CX), alvo: null, chegada: 0, lento: 1, torreT: 0, dronesT: 0, rastroT: 0, ecoT: 0, criasT: 0, capturaT: 0, capturaP: -1, capturaMax: 0, capturado: false, pocoId: 0 };
  sim.chefes.lista.push(u.id); if (o.cacada) sim.chefes.cacada = u.id;
  const b = u.boss;
  if (o.cacada) { b.dorme = tq(sim, DESPERTA[dk] || DESPERTA.normal); b.aviso30 = false; } /* 5.0g.1: tempo de preparo da Caçada */
  if (tipo === 'arauto') { criaPilares(sim, u); b.criasT = sim.time + B.guardasCada; }
  if (tipo === 'sentinela') { b.criasT = sim.time + 6; }
  if (tipo === 'forja') { b.torreT = sim.time + B.torreCada; escolheAlvo(sim, u); b.capturaMax = B.captura.t; }
  I.emit(sim, { t: 'chefe', ev: 'entra', id: u.id, tipo, fase: 1, x: u.x, y: u.y });
  if (!o.evento) for (const q of sim.players) if (q.alive && !q.fenda) I.alertTo(sim, q.id, B.def === 'sentinela' ? 'A Sentinela da Fenda despertou no centro do mapa' : (DEFS[B.def].name + ' atravessou a Fenda'), u.x, u.y, 'danger');
  if (b.dorme) for (const q of sim.players) if (q.alive && !q.fenda) I.alertTo(sim, q.id, DEFS[B.def].name + ' desperta em ' + mmss(b.dorme - sim.time), u.x, u.y, 'warn'); /* 5.0g.1 */
  return u;
}
/* S.bossOf(sim): o chefão vivo mais importante (maior ordem; empate = o mais antigo), ou null */
function bossOf(sim) {
  if (!sim || !sim.chefes) return null; let best = null;
  for (const id of sim.chefes.lista) { const e = vivo(sim, id); if (!e || !e.boss) continue; if (!best || BOSSES[e.boss.tipo].ordem > BOSSES[best.boss.tipo].ordem) best = e; }
  return best;
}

/* ---------- ajudas ---------- */
function livre(sim, x, y, r) { /* ponto livre para pilar ou torre: chão firme, fora da Fenda e longe de estruturas, rochas e nós */
  if (x < r + 80 || y < r + 80 || x > S.WORLD - r - 80 || y > S.WORLD - r - 80) return false;
  if (S.dist(x, y, S.CX, S.CY) < S.RIFT_R + r + 40) return false;
  if (sim.map && S.mapCell(sim, x, y) !== 1) return false;
  for (const e of sim.ents) if (e.alive && (e.kind === 'building' || e.kind === 'rock' || e.kind === 'node' || (e.kind === 'unit' && e.parte)) && S.dist(x, y, e.x, e.y) < e.r + r + 24) return false;
  return true;
}
function inimigoDeFenda(sim, e) { return e.alive && e.owner >= 0 && e.owner !== sim.fenda && (e.kind === 'unit' || e.kind === 'building') && !(sim.players[e.owner] && sim.players[e.owner].fenda); }
/* alvo de golpe: um inimigo sorteado (RNG da partida) entre os que estão a até `raio`; unidades primeiro, depois estruturas */
function sorteiaAlvo(sim, x, y, raio, soChao, arena) {
  const us = [], bs = [];
  I.queryGrid(sim, x, y, raio + 40, e => { if (!inimigoDeFenda(sim, e) || S.dist(x, y, e.x, e.y) > raio) return; if (arena && S.dist(S.CX, S.CY, e.x, e.y) > arena) return; /* 5.0g.1 */ if (e.kind === 'unit') { if (soChao && S.UNITS[e.def].flying) return; us.push(e); } else bs.push(e); });
  const l = us.length ? us : bs; if (!l.length) return null; return l[Math.floor(sim.rand() * l.length) % l.length];
}
function maisPerto(sim, x, y, raio, pred) { let best = null, bd = raio; I.queryGrid(sim, x, y, raio + 40, e => { if (!inimigoDeFenda(sim, e) || (pred && !pred(e))) return; const d = S.dist(x, y, e.x, e.y) - (e.r || 0); if (d < bd) { bd = d; best = e; } }); return best; }
function aviso(sim, u, tipo, golpe, o) {
  const D = DIF[u.boss.dif] || DIF.normal; const t1 = tq(sim, Math.max(D.avisoMin, o.aviso || 0));
  const a = { id: sim.nextId++, tipo, /* mesmo espaço de ids das entidades (os meteoros do g-modos também entram em sim.avisos) */ x: o.x, y: o.y, r: o.r || 0, x2: o.x2 == null ? o.x : o.x2, y2: o.y2 == null ? o.y : o.y2, w: o.w || 0, t0: sim.time, t1, dono: u.id,
    golpe, dano: Math.round((o.dano || 0) * D.dano), chao: !!o.chao, estr: o.estr || 1, puxa: o.puxa || 0 };
  sim.avisos.push(a); I.emit(sim, { t: 'aviso', id: a.id, tipo, x: a.x, y: a.y, x2: a.x2, y2: a.y2, r: a.r, w: a.w, t0: a.t0, t1: a.t1, dono: u.id, golpe });
  return a;
}
function intervalo(sim, u, s) { const D = DIF[u.boss.dif] || DIF.normal; return s * D.ritmo * (u.boss.furia ? 0.7 : 1); }
function dentro(a, e) { /* a forma avisada contém a entidade? */
  const rr = (e.r || 0) * 0.5;
  if (a.tipo === 'faixa') { const vx = a.x2 - a.x, vy = a.y2 - a.y, L2 = vx * vx + vy * vy; let t = L2 > 0 ? ((e.x - a.x) * vx + (e.y - a.y) * vy) / L2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t; return S.dist(a.x + vx * t, a.y + vy * t, e.x, e.y) <= a.w * 0.5 + rr; }
  if (a.tipo === 'poco') return S.dist(a.x, a.y, e.x, e.y) <= a.w + rr;
  return S.dist(a.x, a.y, e.x, e.y) <= a.r + rr;
}
function cai(sim, a) { /* o golpe cai em t1, só dentro da forma avisada */
  const u = vivo(sim, a.dono); I.emit(sim, { t: 'golpe', id: a.id, tipo: a.tipo, golpe: a.golpe, x: a.x, y: a.y, x2: a.x2, y2: a.y2, r: a.r, w: a.w, dono: a.dono });
  if (a.golpe === 'eco') { if (u) ecoSurge(sim, u, a); return; }
  if (!a.dano) return;
  const R = a.tipo === 'faixa' ? S.dist(a.x, a.y, a.x2, a.y2) / 2 + a.w : a.tipo === 'poco' ? a.w : a.r; const cx = a.tipo === 'faixa' ? (a.x + a.x2) / 2 : a.x, cy = a.tipo === 'faixa' ? (a.y + a.y2) / 2 : a.y;
  const hit = []; I.queryGrid(sim, cx, cy, R + 60, e => { if (!inimigoDeFenda(sim, e)) return; if (a.chao && e.kind === 'unit' && S.UNITS[e.def].flying) return; if (dentro(a, e)) hit.push(e); });
  for (const e of hit) if (e.alive) I.applyDamage(sim, sim.fenda, null, e, a.dano * (e.kind === 'building' ? a.estr : 1), null);
  if (a.golpe === 'poco' && u) { /* depois da implosão o chão racha e o olho abre: janela de dano */
    for (let k = 0; k < 3; k++) { const ang = sim.rand() * TAU, d = 60 + sim.rand() * (a.w - 60); terreno(sim, 'racha', a.x + S.DM.cos(ang) * d, a.y + S.DM.sin(ang) * d, 58, 30, 6); }
    abreJanela(sim, u, BOSSES[u.boss.tipo].golpes.poco.janela);
  }
}
function terreno(sim, tipo, x, y, r, dura, dps) {
  if (sim.terreno.length >= 40) sim.terreno.shift();
  const z = { id: sim.nextId++, tipo, x, y, r, t0: sim.time, t1: tq(sim, dura), dps };
  sim.terreno.push(z); return z;
}
function abreJanela(sim, u, s) { const b = u.boss; b.janela = true; b.janelaAte = tq(sim, s); I.emit(sim, { t: 'chefe', ev: 'janela', id: u.id, tipo: b.tipo, fase: b.fase, aberta: true, ate: b.janelaAte }); }
function fechaJanela(sim, u) { const b = u.boss; b.janela = false; I.emit(sim, { t: 'chefe', ev: 'janela', id: u.id, tipo: b.tipo, fase: b.fase, aberta: false }); }
function setFase(sim, u, n) {
  const b = u.boss, B = BOSSES[b.tipo]; if (n <= b.fase || n > B.fases.length) return;
  b.fase = n; b.faseT = 0; b.furia = false; b.prox = sim.time + 3; b.prox2 = sim.time + 6;
  I.emit(sim, { t: 'chefe', ev: 'fase', id: u.id, tipo: b.tipo, fase: n, x: u.x, y: u.y });
  for (const q of sim.players) if (q.alive && !q.fenda) I.alertTo(sim, q.id, 'Nova fase de ' + DEFS[B.def].name + ': ' + B.fases[n - 1].nome, u.x, u.y, 'warn');
  if (b.tipo === 'arauto' && n === 2) { b.escudo = 0; b.ecoT = sim.time + 3; }
  if (b.tipo === 'arauto' && n === 3) { b.prox = sim.time + 2; b.prox2 = sim.time + 8; }
  if (b.tipo === 'forja' && n === 2) { criaPernas(sim, u); b.dronesT = sim.time + 4; }
  if (b.tipo === 'forja' && n === 3) { for (const e of sim.ents) if (e.alive && e.cria === u.id && e.def === 'drone') I.kill(sim, e, -1); /* a linha de montagem para: os drones caem */ u.hp = Math.min(u.hp, u.maxHp * B.fases[2].limiar); b.janela = true; b.janelaAte = 0; b.alvo = null; b.chegada = 0; I.emit(sim, { t: 'chefe', ev: 'janela', id: u.id, tipo: b.tipo, fase: 3, aberta: true, ate: 0 }); }
}

/* ---------- partes: pilares do Arauto e pernas da Forja (unidades com e.parte, presas no lugar depois do separate) ---------- */
function parteNova(sim, u, def, x, y, tipo, extra) {
  const p = I.addUnit(sim, sim.fenda, def, x, y); const D = DIF[u.boss.dif] || DIF.normal;
  p.maxHp = p.hp = Math.round(DEFS[def].hp * D.vida * (1 + 0.4 * (humanos(sim) - 1))); p.state = 'chefe'; p.ang = u.ang;
  p.parte = Object.assign({ chefe: u.id, tipo, x, y }, extra || {}); u.boss.partes.push(p.id); u.boss.pontos++; return p;
}
function criaPilares(sim, u) {
  const B = BOSSES.arauto, b = u.boss; const rot = sim.rand() * TAU;
  for (let k = 0; k < B.pilares; k++) {
    let pos = null;
    for (let t = 0; t < 24 && !pos; t++) { const a = rot + k * TAU / B.pilares + (t % 2 ? 1 : -1) * 0.09 * ((t + 1) >> 1), rr = B.pilarR + ((t % 3) - 1) * 70; const x = S.CX + S.DM.cos(a) * rr, y = S.CY + S.DM.sin(a) * rr; if (livre(sim, x, y, 30)) pos = { x, y }; }
    if (!pos) { const a = rot + k * TAU / B.pilares; pos = { x: S.CX + S.DM.cos(a) * B.pilarR, y: S.CY + S.DM.sin(a) * B.pilarR }; }
    const p = parteNova(sim, u, 'pilar_fenda', pos.x, pos.y, 'pilar', { i: k });
    for (let i = 0; i < B.guardas; i++) guarda(sim, u, p, i, B.guardas);
  }
  b.escudoMax = Math.round(u.maxHp * 0.25); b.escudo = b.escudoMax; b.pilares = B.pilares; sim.navDirty = true;
}
function guarda(sim, u, p, i, n) { const a = i / n * TAU + 0.3, x = p.x + S.DM.cos(a) * 58, y = p.y + S.DM.sin(a) * 58; const c = I.addUnit(sim, sim.fenda, 'cria', cl(x, 40, S.WORLD - 40), cl(y, 40, S.WORLD - 40)); c.cria = u.id; c.guarda = { x: p.x, y: p.y, r: 280 }; c.state = 'idle'; return c; }
function criaPernas(sim, u) {
  const B = BOSSES.forja, b = u.boss; b.pernas = 0;
  for (let k = 0; k < B.pernas; k++) { const off = PI / 4 + k * PI / 2; const p = parteNova(sim, u, 'perna_forja', u.x + S.DM.cos(u.ang + off) * u.r * 0.95, u.y + S.DM.sin(u.ang + off) * u.r * 0.95, 'perna', { i: k, off, d: u.r * 0.95 }); p.ang = u.ang + off; b.pernas++; }
  I.emit(sim, { t: 'chefe', ev: 'parte', id: u.id, tipo: 'forja', parte: 'pernas', n: b.pernas });
}

/* ---------- golpes por chefão ---------- */
function golpeAnel(sim, u, G, x, y, extra) { return aviso(sim, u, 'anel', extra && extra.golpe || 'anel', Object.assign({ aviso: G.aviso, x, y, r: G.r, dano: G.dano }, extra || {})); }
function golpeFaixa(sim, u, G, alvo, nome) { /* faixa que sai do chefão na direção do alvo e passa dele */
  const a = S.DM.atan2(alvo.y - u.y, alvo.x - u.x); const x2 = cl(u.x + S.DM.cos(a) * G.L, 20, S.WORLD - 20), y2 = cl(u.y + S.DM.sin(a) * G.L, 20, S.WORLD - 20);
  return aviso(sim, u, 'faixa', nome || 'faixa', { aviso: G.aviso, x: u.x, y: u.y, x2, y2, w: G.w, dano: G.dano });
}
function logicaArauto(sim, u, dt) {
  const b = u.boss, B = BOSSES[b.tipo], G = B.golpes; const sentinela = b.tipo === 'sentinela'; const ar = b.cacada ? ARENA_ARAUTO : 0; /* 5.0g.1: na Caçada só golpeia dentro da arena */
  if (!sentinela && b.fase === 1) { b.escudo = b.pilares > 0 ? Math.round(b.escudoMax * b.pilares / B.pilares) : 0;
    if (sim.time >= b.criasT) { b.criasT = sim.time + intervalo(sim, u, B.guardasCada); for (const pid of b.partes) { const p = vivo(sim, pid); if (!p || p.parte.tipo !== 'pilar') continue; let n = 0; for (const e of sim.ents) if (e.alive && e.cria === u.id && e.guarda && e.guarda.x === p.x && e.guarda.y === p.y) n++; for (let i = n; i < B.guardas; i++) guarda(sim, u, p, i, B.guardas); } } }
  if (sentinela && sim.time >= b.criasT) { b.criasT = sim.time + intervalo(sim, u, B.guardasCada); let n = 0; for (const e of sim.ents) if (e.alive && e.cria === u.id) n++;
    for (let i = 0; i < B.guardas && n < B.guardasMax; i++, n++) { const a = sim.rand() * TAU; const c = I.addUnit(sim, sim.fenda, 'cria', cl(u.x + S.DM.cos(a) * 90, 40, S.WORLD - 40), cl(u.y + S.DM.sin(a) * 90, 40, S.WORLD - 40)); c.cria = u.id; c.guarda = { x: u.x, y: u.y, r: 520 }; if (!S.groundAt(sim, c.x, c.y) || S.dist(c.x, c.y, S.CX, S.CY) < S.RIFT_R + 12) { c.x = S.CX + S.DM.cos(a) * (S.RIFT_R + 40); c.y = S.CY + S.DM.sin(a) * (S.RIFT_R + 40); } } }
  if (b.calma > sim.time) return;
  if (b.fase === 3) { /* Colapso: poço gravitacional e, entre um e outro, faixas */
    const poco = sim.avisos.find(a => a.id === b.pocoId);
    if (!poco && sim.time >= b.prox && !b.janela) { const a = aviso(sim, u, 'poco', 'poco', { aviso: G.poco.aviso, x: u.x, y: u.y, r: G.poco.r, w: G.poco.w, dano: G.poco.dano, puxa: G.poco.puxa }); b.pocoId = a.id; b.prox = a.t1 + G.poco.janela + intervalo(sim, u, G.poco.cada - G.poco.janela - G.poco.aviso); }
    if (!poco && !b.janela && sim.time >= b.prox2) { const t = sorteiaAlvo(sim, u.x, u.y, 800, false, ar); if (t) golpeFaixa(sim, u, G.faixa, t); b.prox2 = sim.time + intervalo(sim, u, 6); }
    return;
  }
  if (sim.time >= b.prox) { const t = sorteiaAlvo(sim, u.x, u.y, 900, false, ar); if (t) { const useFaixa = (b.fase === 2 || sentinela) && sim.rand() < 0.5; if (useFaixa) golpeFaixa(sim, u, G.faixa, t); else golpeAnel(sim, u, G.anel, t.x, t.y); b.prox = sim.time + intervalo(sim, u, useFaixa ? G.faixa.cada : G.anel.cada); } else b.prox = sim.time + 2; }
  if (!sentinela && b.fase === 2 && sim.time >= b.ecoT) { b.ecoT = sim.time + intervalo(sim, u, B.ecoCada); ecoAbre(sim, u); }
}
/* Ecos: duas fendas pequenas perto do exército de um jogador (rodízio); em t1 saem cópias espectrais das últimas unidades que ele produziu, com metade da vida */
function ecoAbre(sim, u) {
  const vivos = sim.players.filter(p => p.alive && !p.fenda); if (!vivos.length) return;
  const st = sim.chefes; st.ecoVez = ((st.ecoVez || 0) + 1) % vivos.length; const p = vivos[st.ecoVez];
  let sx = 0, sy = 0, n = 0; for (const e of sim.ents) if (e.alive && e.owner === p.id && e.kind === 'unit' && S.UNITS[e.def].attack) { sx += e.x; sy += e.y; n++; }
  const nuc = I.nucleoOf(sim, p.id); if (!n) { if (!nuc) return; sx = nuc.x; sy = nuc.y; n = 1; } sx /= n; sy /= n;
  for (let k = 0; k < 2; k++) { let x = sx, y = sy; for (let t = 0; t < 10; t++) { const a = sim.rand() * TAU, d = 140 + sim.rand() * 160; x = cl(sx + S.DM.cos(a) * d, 60, S.WORLD - 60); y = cl(sy + S.DM.sin(a) * d, 60, S.WORLD - 60); if (S.groundAt(sim, x, y) && S.dist(x, y, S.CX, S.CY) > S.RIFT_R + 60) break; }
    const a = aviso(sim, u, 'sombra', 'eco', { aviso: BOSSES.arauto.golpes.eco.aviso, x, y, r: BOSSES.arauto.golpes.eco.r }); a.alvoP = p.id; }
}
function ecoSurge(sim, u, a) {
  const p = sim.players[a.alvoP]; if (!p) return; const lst = (sim.chefes.ecos[a.alvoP] || []).slice(-6); const defs = lst.length ? lst : ['cria'];
  const nuc = I.nucleoOf(sim, a.alvoP);
  for (let k = 0; k < BOSSES.arauto.ecoMax; k++) { const def = defs[(defs.length - 1 - k + defs.length * 4) % defs.length]; if (!S.UNITS[def]) continue;
    const ang = k * TAU / BOSSES.arauto.ecoMax; const c = I.addUnit(sim, sim.fenda, def, cl(a.x + S.DM.cos(ang) * 22, 30, S.WORLD - 30), cl(a.y + S.DM.sin(ang) * 22, 30, S.WORLD - 30));
    c.maxHp = c.hp = Math.round(c.maxHp * 0.5); c.eco = a.alvoP; /* cópia espectral: e.eco = o jogador copiado (a cor do desenho) */ c.cria = u.id; c.tempUntil = sim.time + 45; c.state = 'attackmove'; c.tx = nuc ? nuc.x : a.x; c.ty = nuc ? nuc.y : a.y;
    I.emit(sim, { t: 'spawn', p: sim.fenda, x: c.x, y: c.y, def, eco: true }); }
}
function escolheAlvo(sim, u) { /* Forja: o Núcleo vivo mais perto (sem Núcleo, a estrutura mais perto) */
  let best = null, bd = Infinity;
  for (const e of sim.ents) { if (!e.alive || e.kind !== 'building' || !inimigoDeFenda(sim, e)) continue; const d = S.dist(u.x, u.y, e.x, e.y) - (e.def === 'nucleo' ? 4000 : 0); if (d < bd) { bd = d; best = e; } }
  u.boss.alvo = best ? { id: best.id, x: best.x, y: best.y } : null;
}
function logicaForja(sim, u, dt) {
  const b = u.boss, B = BOSSES.forja, G = B.golpes;
  if (b.fase < 3) {
    if (!b.alvo || !vivo(sim, b.alvo.id)) escolheAlvo(sim, u);
    if (b.fase === 1 && sim.time >= b.torreT) { b.torreT = sim.time + intervalo(sim, u, B.torreCada); let n = 0; for (const e of sim.ents) if (e.alive && e.cria === u.id && e.kind === 'building') n++;
      if (n < B.torresMax) for (let t = 0; t < 8; t++) { const a = u.ang + PI + (t % 2 ? 1 : -1) * 0.5 * ((t + 1) >> 1), x = u.x + S.DM.cos(a) * (u.r + 40), y = u.y + S.DM.sin(a) * (u.r + 40); if (!livre(sim, x, y, 18)) continue;
        const tw = S.addBuilding(sim, sim.fenda, 'torre', x, y, true); tw.cria = u.id; I.emit(sim, { t: 'chefe', ev: 'torre', id: u.id, tipo: 'forja', x, y, tid: tw.id }); break; } }
    if (b.fase === 2 && sim.time >= b.dronesT) { b.dronesT = sim.time + intervalo(sim, u, B.drones.cada); let n = 0; for (const e of sim.ents) if (e.alive && e.cria === u.id && e.def === 'drone') n++;
      for (let k = 0; k < B.drones.n && n < B.drones.max; k++, n++) { const a = u.ang + PI + (k - 1.5) * 0.5; const d = I.addUnit(sim, sim.fenda, 'drone', u.x + S.DM.cos(a) * (u.r + 10), u.y + S.DM.sin(a) * (u.r + 10)); d.cria = u.id; d.state = 'idle'; I.emit(sim, { t: 'spawn', p: sim.fenda, x: d.x, y: d.y, def: 'drone' }); }
      I.emit(sim, { t: 'chefe', ev: 'onda', id: u.id, tipo: 'forja', n: B.drones.n }); }
  } else captura(sim, u, dt);
  if (b.calma > sim.time) return;
  if (b.fase === 3) { if (sim.time >= b.prox) { aviso(sim, u, 'anel', 'calor', { aviso: G.calor.aviso, x: u.x, y: u.y, r: u.r + G.calor.dr, dano: G.calor.dano, chao: true }); b.prox = sim.time + intervalo(sim, u, G.calor.cada); } return; }
  if (sim.time >= b.prox) { const t = sorteiaAlvo(sim, u.x, u.y, u.r + 160, true); if (t) { golpeAnel(sim, u, G.pisao, t.x, t.y, { golpe: 'pisao', chao: true, estr: G.pisao.estr }); b.prox = sim.time + intervalo(sim, u, G.pisao.cada); } else b.prox = sim.time + 1.5; }
  if (b.fase === 2 && sim.time >= b.prox2) { const t = sorteiaAlvo(sim, u.x, u.y, 600); if (t) golpeFaixa(sim, u, G.solda, t, 'solda'); b.prox2 = sim.time + intervalo(sim, u, G.solda.cada); }
}
/* Núcleo exposto: infantaria de um jogador em volta (5 ou mais, a até 110 da borda) enche a captura; 30 s = capturada (recompensa B) */
function captura(sim, u, dt) {
  const b = u.boss, C = BOSSES.forja.captura; const cnt = new Map();
  I.queryGrid(sim, u.x, u.y, u.r + C.r + 40, e => { if (!inimigoDeFenda(sim, e) || e.kind !== 'unit' || e.cls !== 'inf' || S.dist(u.x, u.y, e.x, e.y) > u.r + C.r) return; cnt.set(e.owner, (cnt.get(e.owner) || 0) + 1); });
  let lead = -1, ln = 0; for (const [pid, n] of [...cnt].sort((a, c) => a[0] - c[0])) if (n > ln) { ln = n; lead = pid; }
  if (ln >= C.inf) { if (b.capturaP !== lead) { b.capturaP = lead; b.capturaT = 0; } b.capturaT += dt; }
  else b.capturaT = Math.max(0, b.capturaT - dt * 0.5);
  if (b.capturaT >= C.t) { b.capturado = true; const pid = b.capturaP; I.emit(sim, { t: 'chefe', ev: 'captura', id: u.id, tipo: 'forja', p: pid }); recompensa(sim, u, 'B', pid); I.kill(sim, u, pid); }
}
function recompensa(sim, u, k, pid) { const R = BOSSES[u.boss.tipo].recompensa; I.emit(sim, { t: 'chefe', ev: 'recompensa', id: u.id, tipo: u.boss.tipo, escolha: k === 'B' ? 'capturar' : k === 'A' ? 'destruir' : null, p: pid, recompensa: k ? R[k] : R }); }

/* ---------- por tique ---------- */
function passo(sim, dt) {
  const st = sim.chefes; if (!st) return;
  for (const ev of sim.events) if (ev.t === 'super' && ev.time === sim.time) superarma(sim, ev);
  for (let i = 0; i < sim.avisos.length;) { const a = sim.avisos[i];
    if (sim.tick >= Math.round(a.t1 / S.TICK)) { sim.avisos.splice(i, 1); cai(sim, a); continue; }
    if (a.tipo === 'poco' && a.puxa) puxa(sim, a, dt); i++; }
  if (sim.terreno.length) { const fz = sim.tick % 5 === 0;
    for (let i = sim.terreno.length - 1; i >= 0; i--) { const z = sim.terreno[i]; if (sim.tick >= Math.round(z.t1 / S.TICK)) { sim.terreno.splice(i, 1); continue; }
      if (fz && z.dps) { const hit = []; I.queryGrid(sim, z.x, z.y, z.r + 40, e => { if (inimigoDeFenda(sim, e) && e.kind === 'unit' && !S.UNITS[e.def].flying && S.dist(z.x, z.y, e.x, e.y) <= z.r) hit.push(e); }); for (const e of hit) if (e.alive) I.applyDamage(sim, sim.fenda, null, e, z.dps * S.TICK * 5, null); } } }
  for (const id of st.lista) { const u = vivo(sim, id); if (!u || !u.boss) continue; const b = u.boss, B = BOSSES[b.tipo];
    if (b.dorme && !acorda(sim, u)) continue; /* 5.0g.1: Caçada, preparo */
    b.faseT += dt; if (!b.furia && b.faseT > 150) { b.furia = true; I.emit(sim, { t: 'chefe', ev: 'furia', id: u.id, tipo: b.tipo, fase: b.fase }); }
    if (b.janela && b.janelaAte && sim.time >= b.janelaAte) fechaJanela(sim, u);
    const porVida = !(b.tipo === 'forja' && b.fase === 2); /* na Linha de montagem quem vira a fase são as pernas */
    if (b.fase < B.fases.length && porVida && (b.virar || u.hp <= u.maxHp * B.fases[b.fase].limiar + 0.001)) setFase(sim, u, b.fase + 1); b.virar = false;
    if (b.tipo === 'forja') logicaForja(sim, u, dt); else logicaArauto(sim, u, dt);
  }
  if (sim.tick % 10 === 5) cerebro(sim);
}
/* 5.0g.1: o chefão da Caçada dorme até b.dorme (tempo da simulação) ou até ser atacado (ele ou uma parte); devolve true quando acorda neste tique */
function acorda(sim, u) {
  const b = u.boss, B = BOSSES[b.tipo]; let atacado = !!b.provoca || u.hp < u.maxHp;
  if (!atacado) for (const pid of b.partes) { const p = vivo(sim, pid); if (p && p.hp < p.maxHp) { atacado = true; break; } }
  if (!atacado && sim.time < b.dorme) {
    if (!b.aviso30 && b.dorme - sim.time <= 30) { b.aviso30 = true; for (const q of sim.players) if (q.alive && !q.fenda) I.alertTo(sim, q.id, DEFS[B.def].name + ' desperta em ' + mmss(b.dorme - sim.time), u.x, u.y, 'warn'); }
    return false; }
  b.dorme = 0; b.provoca = false; b.faseT = 0; b.prox = sim.time + 3; b.prox2 = sim.time + 6;
  if (b.tipo === 'arauto') b.criasT = sim.time + B.guardasCada; if (b.tipo === 'forja') { b.torreT = sim.time + B.torreCada; escolheAlvo(sim, u); }
  I.emit(sim, { t: 'chefe', ev: 'desperta', id: u.id, tipo: b.tipo, atacado, x: u.x, y: u.y });
  for (const q of sim.players) if (q.alive && !q.fenda) I.alertTo(sim, q.id, DEFS[B.def].name + (atacado ? ' despertou com o ataque!' : ' despertou!'), u.x, u.y, 'danger');
  return true;
}
function puxa(sim, a, dt) { /* Colapso: o poço puxa pelo passo de movimento, sem física à parte (só posição, na ordem de sim.ents) */
  const k = a.puxa * dt;
  I.queryGrid(sim, a.x, a.y, a.r + 40, e => { if (e.kind !== 'unit' || !e.alive || e.boss || e.parte) return; const dx = a.x - e.x, dy = a.y - e.y, d = S.DM.hypot(dx, dy); if (d > a.r || d < 6) return;
    let nx = e.x + dx / d * Math.min(k, d - 4), ny = e.y + dy / d * Math.min(k, d - 4);
    if (!S.UNITS[e.def].flying && sim.mapGrid && !S.groundAt(sim, nx, ny)) { if (S.groundAt(sim, nx, e.y)) ny = e.y; else if (S.groundAt(sim, e.x, ny)) nx = e.x; else return; }
    e.x = cl(nx, 10, S.WORLD - 10); e.y = cl(ny, 10, S.WORLD - 10); });
}
function superarma(sim, ev) { /* as superarmas ferem o chefão, mas cada uma tira no máximo 20% da vida dele */
  const sd = SUPER_DANO[ev.kind]; if (!sd) return;
  for (const id of sim.chefes.lista) { const u = vivo(sim, id); if (!u || !u.boss) continue;
    if (sd.raio && !(typeof ev.x === 'number' && S.dist(ev.x, ev.y, u.x, u.y) <= sd.raio + u.r)) continue;
    const frac = Math.min(SUPER_MAX, sd.frac); sim.chefes.superDano = true; try { I.applyDamage(sim, ev.p, null, u, frac * u.maxHp, null); } finally { sim.chefes.superDano = false; }
    if (sd.calma) u.boss.calma = tq(sim, sd.calma);
    I.emit(sim, { t: 'chefe', ev: 'superarma', id: u.id, tipo: u.boss.tipo, kind: ev.kind, p: ev.p, frac }); }
}
/* crias, drones e ecos: ordens simples a cada segundo (atacar-mover; os guardas não se afastam do pilar) */
function cerebro(sim) {
  const f = sim.fenda;
  for (const u of sim.ents) { if (!u.alive || u.kind !== 'unit' || u.owner !== f || u.boss || u.parte || !S.UNITS[u.def].attack) continue;
    if (u.guarda) { const g = u.guarda; const t = maisPerto(sim, g.x, g.y, g.r);
      if (t) { if (u.state !== 'attack') { u.state = 'attackmove'; u.tx = t.x; u.ty = t.y; u.target = null; u.resume = null; u.stuck = 0; u.stk = 0; u.gx = null; } }
      else if (S.dist(u.x, u.y, g.x, g.y) > 110 && u.state !== 'move') { u.state = 'move'; u.tx = g.x; u.ty = g.y; u.target = null; u.stuck = 0; u.stk = 0; u.gx = null; }
      continue; }
    if (u.state === 'idle') { const t = maisPerto(sim, u.x, u.y, 1600) || maisPerto(sim, u.x, u.y, 4600, e => e.kind === 'building'); if (t) { u.state = 'attackmove'; u.tx = t.x; u.ty = t.y; u.target = null; u.resume = null; u.stuck = 0; u.stk = 0; u.gx = null; } } }
}
/* a unidade do chefão (no laço das unidades, no lugar do updateUnit): movimento e arma pela simulação de hoje */
function unidade(sim, u, dt) {
  if (u.cd > 0) u.cd -= dt;
  if (u.parte) return;
  const b = u.boss; if (!b) return; const B = BOSSES[b.tipo];
  if (b.dorme) { b.fx = u.x; b.fy = u.y; return; } /* 5.0g.1: dormindo na arena */
  if (B.orbita) { /* o Arauto e a Sentinela flutuam sobre a cratera; no poço param */
    const parado = sim.avisos.some(a => a.dono === u.id && a.tipo === 'poco');
    if (!parado) b.orb += (u.speed / B.orbita) * dt * (b.fase === 3 ? 0.5 : 1);
    const tx = S.CX + S.DM.cos(b.orb) * B.orbita, ty = S.CY + S.DM.sin(b.orb) * B.orbita; I.moveToward(sim, u, tx, ty, dt);
  } else if (b.fase < 3 && b.alvo) { /* a Forja anda por cima de muros e rochas (uma fábrica-aranha), mas contorna a Fenda */
    const t = b.alvo, dGoal = S.dist(u.x, u.y, t.x, t.y), stop = u.r + 150;
    if (dGoal > stop) { let gx = t.x, gy = t.y; const wp = desvioFenda(u.x, u.y, gx, gy, u.r + 40); if (wp) { gx = wp.x; gy = wp.y; }
      const dx = gx - u.x, dy = gy - u.y, d = S.DM.hypot(dx, dy) || 1, sp = u.speed * b.lento * dt;
      u.x = cl(u.x + dx / d * Math.min(sp, d), 20, S.WORLD - 20); u.y = cl(u.y + dy / d * Math.min(sp, d), 20, S.WORLD - 20); u.ang = S.DM.atan2(dy, dx); u.mvTick = sim.tick;
      b.chegada = Math.round((dGoal - stop) / Math.max(1, u.speed * b.lento));
      if (sim.time >= b.rastroT) { b.rastroT = sim.time + B.rastro.cada; terreno(sim, 'metal', u.x - S.DM.cos(u.ang) * u.r * 0.6, u.y - S.DM.sin(u.ang) * u.r * 0.6, B.rastro.r, B.rastro.dura, B.rastro.dps); } }
    else b.chegada = 0;
  }
  if (u.cd <= 0 && S.UNITS[u.def].attack && !(b.tipo === 'forja' && b.fase === 3)) { /* desabada, a Forja não atira: só o calor do núcleo */ const w = S.UNITS[u.def].attack; const t = maisPerto(sim, u.x, u.y, w.range + u.r, e => !(e.kind === 'building' && S.BUILDINGS[e.def].wall)) || maisPerto(sim, u.x, u.y, w.range + u.r);
    if (t) { u.ang = B.orbita ? S.DM.atan2(t.y - u.y, t.x - u.x) : u.ang; I.fire(sim, u, t); } }
  b.fx = u.x; b.fy = u.y;
}
function desvioFenda(x, y, gx, gy, folga) { /* ponto de passagem quando a reta até o alvo cruza a Fenda */
  const R = S.RIFT_R + folga, vx = gx - x, vy = gy - y, L2 = vx * vx + vy * vy; if (L2 < 1) return null;
  let t = ((S.CX - x) * vx + (S.CY - y) * vy) / L2; if (t <= 0 || t >= 1) return null;
  const qx = x + vx * t, qy = y + vy * t, d = S.dist(qx, qy, S.CX, S.CY); if (d >= R) return null;
  const nx = d > 1 ? (qx - S.CX) / d : -vy / Math.sqrt(L2), ny = d > 1 ? (qy - S.CY) / d : vx / Math.sqrt(L2);
  return { x: S.CX + nx * (R + 30), y: S.CY + ny * (R + 30) };
}
/* depois do separate: partes presas no lugar (pernas acompanham o corpo), o chefão no ponto dele; e a lista dos Ecos (o que cada jogador produziu) */
function depois(sim) {
  const st = sim.chefes; if (!st) return;
  for (const id of st.lista) { const u = vivo(sim, id); if (!u || !u.boss) continue; const b = u.boss; u.x = b.fx; u.y = b.fy;
    for (const pid of b.partes) { const p = vivo(sim, pid); if (!p) continue; const q = p.parte;
      if (q.tipo === 'perna') { q.x = u.x + S.DM.cos(u.ang + q.off) * q.d; q.y = u.y + S.DM.sin(u.ang + q.off) * q.d; p.ang = u.ang + q.off; }
      p.x = q.x; p.y = q.y; } }
  for (const ev of sim.events) if (ev.t === 'spawn' && !ev.eco && ev.time === sim.time && ev.p !== sim.fenda && ev.p >= 0 && S.UNITS[ev.def] && S.UNITS[ev.def].attack) { const l = st.ecos[ev.p]; if (l) { l.push(ev.def); if (l.length > 6) l.shift(); } }
}

/* dano que chega ao chefão (applyDamage): fases não se pulam, escudo dos pilares, pernas, janela do olho; superarma só limitada pelo piso da fase */
function dano(sim, t, dmg, atk) {
  const b = t.boss; if (!b) return dmg; const B = BOSSES[b.tipo];
  if (b.dorme && atk) b.provoca = true; /* 5.0g.1: atacado, desperta no próximo tique */
  if (!sim.chefes || !sim.chefes.superDano) {
    if (b.tipo === 'forja' && b.fase === 3 && atk && atk.kind === 'unit' && atk.cls === 'inf') return 0; /* núcleo exposto: a infantaria segura (captura), quem destrói são veículos, drones e torres */
    if (b.tipo === 'arauto' && b.fase === 1 && b.pilares > 0) dmg = 0;
    else if (b.tipo === 'arauto' && b.fase === 3) dmg *= b.janela ? 1.6 : 0.4;
    else if (b.tipo === 'forja' && b.fase === 2 && b.pernas > 0) dmg *= 0.2;
    else if (b.tipo === 'forja' && b.fase === 3) dmg *= 1.4;
  }
  if (dmg <= 0) return 0;
  let piso = 0; if (b.fase < B.fases.length) piso = B.fases[b.fase].limiar * t.maxHp; if (b.tipo === 'forja' && b.fase === 2 && b.pernas > 0) piso = B.fases[2].limiar * t.maxHp;
  if (t.hp - dmg < piso) { dmg = Math.max(0, t.hp - piso); if (!(b.tipo === 'forja' && b.fase === 2)) b.virar = true; }
  return dmg;
}
/* morte de um chefão ou de uma parte (kill) */
function morte(sim, e, killer) {
  if (e.parte) { const u = vivo(sim, e.parte.chefe); if (!u || !u.boss) return; const b = u.boss; b.pontos = Math.max(0, b.pontos - 1);
    I.emit(sim, { t: 'chefe', ev: 'parte', id: u.id, tipo: b.tipo, parte: e.parte.tipo, pid: e.id, p: killer, x: e.x, y: e.y });
    if (e.parte.tipo === 'pilar') { b.pilares = Math.max(0, (b.pilares || 0) - 1); if (!b.pilares) { b.escudo = 0; I.emit(sim, { t: 'chefe', ev: 'escudo', id: u.id, tipo: b.tipo, fase: b.fase, aberto: false }); for (const q of sim.players) if (q.alive && !q.fenda) I.alertTo(sim, q.id, 'O escudo do Arauto caiu!', u.x, u.y, 'good'); } }
    if (e.parte.tipo === 'perna') { const B = BOSSES.forja; b.pernas = Math.max(0, (b.pernas || 0) - 1); b.lento *= 1 - B.lentidao;
      u.hp = Math.max(u.maxHp * B.fases[2].limiar, u.hp - u.maxHp * B.pernaDano); u.lastHitT = sim.time; u.lastHitBy = killer;
      if (!b.pernas && b.fase === 2) setFase(sim, u, 3); }
    return; }
  if (!e.boss) return; const b = e.boss;
  I.emit(sim, { t: 'chefe', ev: 'morre', id: e.id, tipo: b.tipo, fase: b.fase, p: killer, capturado: !!b.capturado, x: e.x, y: e.y });
  if (b.tipo === 'forja' && !b.capturado) recompensa(sim, e, 'A', killer); else if (b.tipo !== 'forja') recompensa(sim, e, null, killer);
  for (const q of sim.players) if (q.alive && !q.fenda) I.alertTo(sim, q.id, (b.capturado ? 'Chefão capturado: ' : 'Chefão derrotado: ') + DEFS[BOSSES[b.tipo].def].name, e.x, e.y, 'good');
  sim.avisos = sim.avisos.filter(a => a.dono !== e.id);
  for (const o of sim.ents) if (o.alive && ((o.parte && o.parte.chefe === e.id) || o.cria === e.id)) I.kill(sim, o, -1); /* partes, crias, ecos e torres se apagam com ele */
}

/* fim da partida no modo Caçada (checkEnd): vitória quando o chefão da Caçada cai; derrota quando todos os Núcleos humanos caem ou o tempo acaba.
   Sem humanos (testes): resultado 'headless'. Devolve true quando cuidou do fim (o resto do checkEnd não roda na Caçada). */
function fim(sim) {
  const st = sim.chefes; if (!st || !sim.cfg || !sim.cfg.cacada) return false;
  if (ARD.modos && ARD.modos.fim && sim.modos && sim.modos.cac) return ARD.modos.fim(sim); /* a regra da Caçada é do g-modos (medalha, perdas, tempo-limite); esta fica de reserva */
  const ps = sim.players.filter(p => !p.fenda); const hs = ps.filter(p => p.human); const scores = ps.map(p => ({ id: p.id, name: p.name, score: p.alive ? S.score(sim, p) : 0, alive: p.alive }));
  const u = st.cacada != null ? sim.byId.get(st.cacada) : null; const caiu = !u || !u.alive;
  const vivos = (hs.length ? hs : ps).some(p => p.alive);
  let r = null;
  if (caiu) r = { outcome: hs.length ? 'victory' : 'headless', reason: 'O chefão caiu.', scores, chefe: u ? u.boss.tipo : null, capturado: !!(u && u.boss && u.boss.capturado), tempo: sim.time };
  else if (!vivos) r = { outcome: hs.length ? 'defeat' : 'headless', reason: 'Seu Núcleo foi destruído.', scores };
  else if (sim.time >= sim.maxTime) r = { outcome: hs.length ? 'defeat' : 'headless', reason: 'O chefão resistiu até o fim do Alinhamento.', scores };
  if (r) { sim.result = r; I.emit(sim, { t: 'end', result: r }); }
  return true;
}

/* ---------- hash, fotografia e retomada ---------- */
function hash(sim, mix) {
  mix(sim.fenda); mix(sim.avisos.length); mix(sim.terreno.length);
  for (const a of sim.avisos) { mix(a.id); mix(Math.round(a.x * 10)); mix(Math.round(a.y * 10)); mix(Math.round(a.t1 * 10)); mix(a.dano); }
  for (const z of sim.terreno) { mix(z.id); mix(Math.round(z.x * 10)); mix(Math.round(z.y * 10)); mix(Math.round(z.t1 * 10)); }
  const st = sim.chefes; mix(st.lista.length); mix(st.ecoVez || 0); mix(st.cacada || 0);
  for (const id of st.lista) { const e = sim.byId.get(id); if (!e || !e.alive || !e.boss) continue; const b = e.boss; mix(b.fase); mix(Math.round(b.escudo)); mix(b.janela ? 1 : 0); mix(Math.round(b.capturaT * 10)); mix(Math.round(b.prox * 10)); mix(Math.round(b.lento * 1000)); mix(b.pontos); if (b.cacada) mix(Math.round((b.dorme || 0) * 10)); }
  for (const l of st.ecos) { mix(l.length); for (const d of l) mix(d.length); }
}
function foto(sim) { return sim.chefes ? { fenda: sim.fenda, st: sim.chefes, avisos: sim.avisos, terreno: sim.terreno } : null; }
function volta(sim, d) { /* d = jsonBack(snap.chefes); salvamento antigo: tudo no padrão (sem Fenda) */
  if (!d) { sim.fenda = -1; sim.chefes = null; sim.avisos = []; sim.terreno = []; return; }
  sim.fenda = d.fenda; sim.chefes = d.st; sim.avisos = d.avisos || []; sim.terreno = d.terreno || [];
}

/* ---------- mapa Destroço do Titã (cfg.map = 'tita') ----------
   A carcaça de um titã caído sobre a Fenda: a espinha corta o mapa entre dois jogadores, as costelas quebradas saem dela em arco (bloqueio,
   com passagem entre elas e a espinha), placas de blindagem soltas, o crânio numa ponta e o "ventre" na outra (arena da Forja-Mãe).
   As peças são rochas (kind 'rock') com e.osso (1 costela, 2 placa, 3 vértebra, 4 crânio) e e.ang (direção); bloqueiam como as rochas das cordilheiras. */
function planoTita(sim) {
  const n = sim.players.length, a = sim.players[0].startAngle + PI / n + (sim.cfg && sim.cfg.cacada && n % 2 ? PI : 0); const ax = S.DM.cos(a), ay = S.DM.sin(a);
  /* 5.0g.1: na Caçada com 1 ou 3 jogadores a espinha gira meia volta: o ventre (a arena da Forja) fica entre as bases, não na frente de uma delas (era a 680 do Núcleo solo) */
  return { type: 'tita', lakes: [], ax, ay, ang: a, arena: { x: S.CX - ax * 500, y: S.CY - ay * 500, r: 170 }, costelas: [], cranio: { x: S.CX + ax * 820, y: S.CY + ay * 820 } };
}
function ossosTita(sim, nucs) {
  const m = sim.map; const ax = m.ax, ay = m.ay, nx = -ay, ny = ax; const RN = 13;
  const ok = (x, y, rr) => { if (x < 70 || y < 70 || x > S.WORLD - 70 || y > S.WORLD - 70) return false; if (S.dist(x, y, S.CX, S.CY) < S.RIFT_R + 70) return false;
    if (nucs.some(c => S.dist(x, y, c.x, c.y) < 430)) return false; if (I.lakeAt(m, x, y)) return false;
    for (const e of sim.ents) if (e.alive && ((e.kind === 'node' && S.dist(x, y, e.x, e.y) < 70) || (e.kind === 'building' && S.dist(x, y, e.x, e.y) < 120))) return false; return true; };
  const rock = (x, y, r, osso, ang, _) => { const e = { id: sim.nextId++, kind: 'rock', x, y, r, alive: true, owner: -1, seed: Math.floor(sim.rand() * 1000), osso, ang }; sim.ents.push(e); sim.byId.set(e.id, e); return e; };
  const sp = t => ({ x: S.CX + ax * t, y: S.CY + ay * t });
  /* recursos do titã: metal antigo (Minério) entre as costelas e o coração de Plasma no crânio */
  for (const [t, s] of [[360, 1], [-360, -1], [620, -1], [-640, 1]]) { const p = sp(t), x = p.x + nx * s * 210, y = p.y + ny * s * 210; if (ok(x, y, 30)) I.addNode(sim, 'minerio', x, y, 1400); }
  { const c = m.cranio; for (const s of [-1, 1]) { const x = c.x + nx * s * 110 - ax * 40, y = c.y + ny * s * 110 - ay * 40; if (ok(x, y, 30)) I.addNode(sim, 'plasma', x, y, 1200); } }
  /* vértebras: a cada 110 ao longo da espinha (com vão para passar), fora da Fenda e da arena */
  for (let t = -760; t <= 760; t += 110) { const p = sp(t); if (!ok(p.x, p.y, 20) || S.dist(p.x, p.y, m.arena.x, m.arena.y) < m.arena.r) continue; rock(p.x, p.y, 18, 3, m.ang); }
  /* costelas: arcos dos dois lados, quebrados perto da espinha (o vão de ~110 entre a espinha e a costela é a passagem ao longo da carcaça) */
  const nucList = nucs;
  for (const t of [300, 420, 560, 700, -300, -420, -560, -700]) for (const s of [-1, 1]) {
    const L = 400 - Math.abs(t) * 0.22, base = sp(t), rib = []; let phi = S.DM.atan2(ny * s, nx * s); const curv = s * 0.0011; /* todas varrem para a cauda, como costelas de verdade */ let x = base.x + nx * s * 26, y = base.y + ny * s * 26;
    for (let k = 0; k <= L; k += 26) { if (k >= 110) { if (ok(x, y, RN)) rib.push(rock(x, y, RN, 1, phi)); else if (rib.length) break; } phi += curv * 26 * (1 + k / L); x += S.DM.cos(phi) * 26; y += S.DM.sin(phi) * 26; }
    if (rib.length > 2) { const tip = rib[rib.length - 1]; if (sim.rand() < 0.55) { const pa = phi + (sim.rand() - 0.5) * 1.2, px = tip.x + S.DM.cos(pa) * 46, py = tip.y + S.DM.sin(pa) * 46; if (ok(px, py, 22)) rib.push(rock(px, py, 22, 2, pa)); } }
    I.rebuildNav(sim); if (nucList.length && !I.connected(sim, nucList)) { for (const r of rib) { r.alive = false; sim.byId.delete(r.id); } I.rebuildNav(sim); continue; }
    if (rib.length) m.costelas.push(rib.map(r => r.id));
  }
  /* crânio: a peça grande no fim da espinha (olhando para fora), com lascas em volta */
  { const c = m.cranio; const main = ok(c.x, c.y, 44) ? rock(c.x, c.y, 44, 4, m.ang, 0) : null; if (main) main.seed = 4 * (main.seed >> 2); /* variação 0 = o crânio inteiro */
    for (let k = 0; k < 4; k++) { const a = m.ang + PI * 0.5 + k * PI / 3, x = c.x + S.DM.cos(a) * 92, y = c.y + S.DM.sin(a) * 92; if (ok(x, y, 18)) { const e = rock(x, y, 18, 4, a + PI / 2); if (e.seed % 4 === 0) e.seed++; } }
    I.rebuildNav(sim); if (nucList.length && !I.connected(sim, nucList)) { for (const e of sim.ents) if (e.osso === 4) { e.alive = false; sim.byId.delete(e.id); } I.rebuildNav(sim); } }
  /* placas de blindagem soltas no campo */
  for (let k = 0; k < 6; k++) { const t = (sim.rand() - 0.5) * 1500, s = sim.rand() < 0.5 ? -1 : 1, d = 120 + sim.rand() * 380, p = sp(t), x = p.x + nx * s * d, y = p.y + ny * s * d, pa = sim.rand() * TAU;
    if (!ok(x, y, 26) || sim.ents.some(e => e.alive && e.kind === 'rock' && S.dist(x, y, e.x, e.y) < 60)) continue; rock(x, y, 22, 2, pa); I.rebuildNav(sim); if (nucList.length && !I.connected(sim, nucList)) { const r = sim.ents[sim.ents.length - 1]; r.alive = false; sim.byId.delete(r.id); I.rebuildNav(sim); } }
  /* chão escuro (basalto) em volta da carcaça e nada de adereço em cima dos ossos; ruínas como cenário perto das pontas */
  const bones = sim.ents.filter(e => e.alive && e.osso);
  for (let ty = 0; ty < S.TILES; ty++) for (let tx = 0; tx < S.TILES; tx++) { const cx = (tx + 0.5) * S.TILE, cy = (ty + 0.5) * S.TILE; let dmin = 9999; for (const e of bones) { const d = S.dist(cx, cy, e.x, e.y); if (d < dmin) dmin = d; if (dmin < 60) break; }
    const i = ty * S.TILES + tx; if (dmin < 90) { sim.biome[i] = 3; sim.biome2[i] = 3; sim.biomeMix[i] = 0; } else if (dmin < 170 && sim.biome[i] !== 3) { sim.biome2[i] = 3; sim.biomeMix[i] = Math.max(sim.biomeMix[i], (170 - dmin) / 80 * 0.6); } }
  sim.props = sim.props.filter(p => !bones.some(e => S.dist(p.x, p.y, e.x, e.y) < e.r + 34));
  for (const rib of m.costelas) { const e = sim.byId.get(rib[rib.length - 1]); if (!e || sim.rand() < 0.5) continue; const a = sim.rand() * TAU, x = e.x + S.DM.cos(a) * 70, y = e.y + S.DM.sin(a) * 70; if (ok(x, y, 20)) sim.props.push({ x, y, kind: 'ruin', seed: Math.floor(sim.rand() * 1000), scale: 0.5 + sim.rand() * 0.2 }); }
}

/* main.js: as chaves da partida que vão para o createSim (também na retomada, pela cfg salva com a partida) */
function cfgDe(cfg) { const src = cfg && cfg.resume && cfg.resume.simCfg ? cfg.resume.simCfg : (cfg || {}); const o = {}; for (const k of ['chefe', 'chefeDif']) /* 5.0g junção: Caçada, eventos e mutadores são do ARD.modos.cfgDe (uma regra só) */ if (src[k] != null) o[k] = src[k]; return o; }

ARD.chefesSim = { instala, cfgDe, BOSSES, DIF, DEFS, ARMAS, SUPER_MAX, inicio, spawnBoss, bossOf, fendaDe, passo, depois, unidade, dano, morte, fim, hash, foto, volta, planoTita, ossosTita, arena };
if (ARD.sim && ARD.sim._int) instala(ARD.sim);
})(globalThis.ARD = globalThis.ARD || {});
