/* Aether Rift: Dominion — 5.0h (agente h-mundo): o mundo neutro da Fenda na simulação.
   Fauna (Pastadores que fogem, Guardiões dos nós ricos e Enxames noturnos), Ruínas dos Construtores capturáveis com infantaria
   (Observatório, Forja Antiga, Portal em par e Torre de Éter), o Acampamento da Irmandade Corsária (3 mercenários pagos em Dados) e o
   Surto de éter (renda dobrada numa zona, anunciado antes), com a chuva de meteoros da 5.0g (src/modos.js) ligada a este modo.
   Determinístico como o src/sim.js: sem DOM, sem Math.random, sem Date nem performance.now; RNG próprio semeado e guardado no estado
   (sim.mundoSt.rng), a matemática determinística (DM) e o tempo do tique. Entra no build ANTES do src/sim.js; liga-se a ele pelo
   ARD.mundo.instala (no fim do sim.js), como o src/chefes-sim.js.
   Contrato (o mesmo do RELATORIO da 5.0h):
   - cfg.mundo = { fauna, ruinas, corsarios, surto } (booleanos; true liga tudo), igual no createSim, na rede e no salvamento (cfgDe).
   - sim.mundo = índice do jogador neutro (-1 sem mundo). p.mundo = true (e p.fenda = true: fica fora de placar, vitória, diplomacia,
     IA de Raça, alertas e cores como a Fenda), sem Núcleo e sem economia.
   - S.RUINAS = { observatorio, forja, portal, torre }; a ruína é uma construção do jogador neutro com e.ruina = { tipo, dono, capT, par,
     capP, disputa } (dono = -1 enquanto livre). Captura: infantaria parada perto dela; leva tempo, pode ser contestada; o bônus vale
     enquanto o dono a mantiver. Invulnerável.
   - Acampamento: e.acampamento = { mercs: [...] }; comando { t: 'contratar', id, merc } pago em Dados; S.MERCS.
   - Surto: sim.surtos = [{ id, x, y, r, t0, t1 }] (renda dobrada dentro do círculo entre t0 e t1; o aviso sai em t0 − 30 s).
   - Eventos: { t: 'mundo', ev: 'captura'|'perde'|'contrato'|'surto'|'fauna'|'portal'|'disputa', ... }.
   - Comandos: { t: 'capturar', ids, id }, { t: 'portal', ids, id } e { t: 'contratar', id, merc } (pela fila, no multiplayer também).
   Partida sem cfg.mundo: nada aqui roda (sim.mundo = -1, sem sim.mundoSt nem sim.surtos): o hash, as missões e a fotografia ficam iguais. */
(function (ARD) {
'use strict';
let S = null, I = null;
const PI = Math.PI, TAU = PI * 2;
const COR = '#C8B27A'; /* areia dos Construtores: fora das cores de time */

/* ---------- tabelas ---------- */
const RUINAS = {
  observatorio: { def: 'ruina_observatorio', visao: 900 },   /* visão larga em volta para o dono */
  forja:        { def: 'ruina_forja', desconto: 0.8 },       /* veículos 20% mais baratos para o dono */
  portal:       { def: 'ruina_portal' },                     /* teleporte entre as pontas do par (entrada do dono) */
  torre:        { def: 'ruina_torre', energia: 40 },         /* +40 de energia para o dono */
};
const RUINA_TIPOS = ['observatorio', 'forja', 'portal', 'torre'];
const CAP = { t: 20, raio: 70, decai: 0.5, maxN: 5, visao: 220 }; /* captura em 20 s com 1 infantaria (até 2× mais rápida com 5); visão das outras ruínas */
const MERCS = {
  saqueador:  { def: 'merc_saqueador', custo: { dados: 80 } },
  artilheiro: { def: 'merc_artilheiro', custo: { dados: 140 } },
  atirador:   { def: 'merc_atirador', custo: { dados: 100 } },
};
const MERC_IDS = Object.keys(MERCS);
const CONTRATO = { cd: 60, max: 3, raio: 600, dura: 300 }; /* recarga por jogador, mercenários vivos por jogador, alcance para contratar, tempo de serviço */
const SURTO = { primeiro: 300, cada: 150, aviso: 30, dura: 90, r: 230, raio: 760, meteoroAviso: 20 }; /* agenda: surto e chuva de meteoros se alternam a cada 150 s */
const FAUNA = {
  pastador: { def: 'fauna_pastador', casa: 150, medo: 120, fuga: 220, longe: 500, renasce: 120, premio: { minerio: 40 } },
  guardiao: { def: 'fauna_guardiao', raio: 170, coleira: 380, regen: 0.01, extra: 400, premio: { minerio: 220, dados: 110 } },
  enxame:   { def: 'fauna_enxame', raio: 260, coleira: 420, ronda: 120, noite: 0.62, dia: 0.42, eterna: 240, premio: 8 },
};
const LIMITE = { pastador: 9, guardiao: 4, enxame: 9 }; /* teto por mapa: a fauna anima o mapa e não vira exército */
const R_RUINA = 28, R_ACAMP = 34;

/* unidades e construções novas (S.UNITS e S.BUILDINGS); faction própria e epic tiram tudo das listas de produção, do teste de desempenho e do aquecimento por Raça */
const DEFS_U = {
  fauna_pastador:  { name: 'Pastador da Fenda', key: '', cls: 'civ', hp: 200, r: 11, speed: 70, cost: {}, time: 0, energyUse: 0, sensor: 140, faction: 'mundo', fauna: true, epic: true, desc: 'Herbívoro manso das planícies da Fenda. Foge de quem chega perto; caído, deixa uma caixa pequena.' },
  fauna_guardiao:  { name: 'Guardião do Veio', key: '', cls: 'vei', hp: 1200, r: 16, speed: 62, cost: {}, time: 0, energyUse: 0, weapon: 'garra_guardiao', sensor: 200, faction: 'mundo', fauna: true, epic: true, desc: 'Fera blindada de cristal que defende um nó rico. Ataca quem chega perto do nó; caída, solta um bônus.' },
  fauna_enxame:    { name: 'Enxame Noturno', key: '', cls: 'dro', hp: 70, r: 6, speed: 120, cost: {}, time: 0, energyUse: 0, weapon: 'ferrao_enxame', sensor: 220, faction: 'mundo', flying: true, fauna: true, epic: true, desc: 'Mariposas de éter que saem dos ninhos perto da Fenda à noite e atacam quem passa.' },
  merc_saqueador:  { name: 'Saqueador Corsário', key: '', cls: 'vei', hp: 320, r: 10, speed: 125, cost: { dados: 80 }, time: 0, energyUse: 0, weapon: 'laminas', sensor: 200, faction: 'corsario', merc: true, desc: 'Mercenário rápido de ataque corpo a corpo. Serve por 5 min.' },
  merc_artilheiro: { name: 'Artilheiro Corsário', key: '', cls: 'vei', hp: 420, r: 11, speed: 68, cost: { dados: 140 }, time: 0, energyUse: 0, weapon: 'bombarda', sensor: 230, faction: 'corsario', merc: true, desc: 'Mercenário de cerco: tiro longo com área. Serve por 5 min.' },
  merc_atirador:   { name: 'Atirador Corsário', key: '', cls: 'inf', hp: 150, r: 7, speed: 92, cost: { dados: 100 }, time: 0, energyUse: 0, weapon: 'fuzil_longo', sensor: 280, faction: 'corsario', merc: true, desc: 'Mercenário de tiro longo; como infantaria, também captura ruínas. Serve por 5 min.' },
};
const DEFS_B = {
  ruina_observatorio: { name: 'Observatório', key: '', hp: 5000, r: R_RUINA, cost: {}, buildTime: 0, energyUse: 0, sensor: 0, mundo: true, ruina: 'observatorio', desc: 'Ruína dos Construtores. Capturada com infantaria parada ao lado, dá visão larga em volta dela.' },
  ruina_forja:        { name: 'Forja Antiga', key: '', hp: 5000, r: R_RUINA, cost: {}, buildTime: 0, energyUse: 0, sensor: 0, mundo: true, ruina: 'forja', desc: 'Ruína dos Construtores. Capturada, deixa os veículos do dono 20% mais baratos.' },
  ruina_portal:       { name: 'Portal', key: '', hp: 5000, r: R_RUINA, cost: {}, buildTime: 0, energyUse: 0, sensor: 0, mundo: true, ruina: 'portal', desc: 'Ruína dos Construtores, em par. Capturada, leva as unidades do dono até a outra ponta.' },
  ruina_torre:        { name: 'Torre de Éter', key: '', hp: 5000, r: R_RUINA, cost: {}, buildTime: 0, energyUse: 0, sensor: 0, mundo: true, ruina: 'torre', desc: 'Ruína dos Construtores. Capturada, dá +40 de energia ao dono.' },
  acampamento:        { name: 'Acampamento da Irmandade Corsária', key: '', hp: 6000, r: R_ACAMP, cost: {}, buildTime: 0, energyUse: 0, sensor: 0, mundo: true, desc: 'Nave corsária ancorada sobre a Fenda. Com uma unidade sua a até 600 dela, contrate mercenários pagos em Dados.' },
};
const ARMAS = {
  garra_guardiao: { dmg: 20, range: 36, cd: 1.0, proj: 'beam', speed: 0, inacc: 0, splash: 0, cls: 'vei' },
  ferrao_enxame:  { dmg: 5, range: 80, cd: 0.6, proj: 'bullet', speed: 700, inacc: 4, splash: 0, cls: 'dro' },
};

function instala(sim0) {
  if (!sim0 || !sim0._int || S === sim0) return; S = sim0; I = sim0._int;
  for (const k in ARMAS) if (!S.WEAPONS[k]) { const w = ARMAS[k]; w.versus = Object.assign({ inf: 1, vei: 1, dro: 1, est: 1, sup: 1, civ: 1 }, S.COUNTER[w.cls] || {}); S.WEAPONS[k] = w; }
  for (const k in DEFS_U) if (!S.UNITS[k]) { const d = DEFS_U[k]; if (d.weapon) d.attack = S.WEAPONS[d.weapon]; S.UNITS[k] = d; }
  for (const k in DEFS_B) if (!S.BUILDINGS[k]) S.BUILDINGS[k] = DEFS_B[k];
  S.RUINAS = RUINAS; S.MERCS = MERCS;
}

/* ---------- utilidades ---------- */
const cl = (v, a, b) => v < a ? a : v > b ? b : v;
function emit(sim, ev) { ev.time = sim.time; sim.events.push(ev); }
function alerta(sim, pid, text, x, y, kind) { emit(sim, { t: 'alert', p: pid, text, x, y, kind: kind || 'info' }); }
function alertaTodos(sim, text, x, y, kind, salvo) { for (const q of sim.players) if (q.alive && !q.fenda && q.id !== salvo) alerta(sim, q.id, text, x, y, kind); }
function aviso(sim, pid, text) { if (sim.players[pid] && sim.players[pid].human) emit(sim, { t: 'notice', p: pid, text }); }
function vivo(sim, id) { const e = id ? sim.byId.get(id) : null; return e && e.alive ? e : null; }
function rnd(M) { let t = (M.rng = (M.rng + 0x6D2B79F5) >>> 0); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; } /* mulberry32 próprio: a fauna não mexe no sim.rand das outras regras */
function real(sim, pid) { const q = sim.players[pid]; return !!(q && !q.fenda && !q.mundo); }
/* textos da simulação em pt-BR (a tela traduz pelas chaves sim.mundo.* dos dicionários) */
const TXT = {
  cap: { observatorio: 'Observatório capturado: visão larga em volta dele', forja: 'Forja Antiga capturada: veículos 20% mais baratos', portal: 'Portal capturado: mande unidades para a outra ponta', torre: 'Torre de Éter capturada: +40 de energia' },
  capOutro: { observatorio: '{nome} capturou o Observatório', forja: '{nome} capturou a Forja Antiga', portal: '{nome} capturou um Portal', torre: '{nome} capturou uma Torre de Éter' },
  tomada: { observatorio: 'Seu Observatório está sendo tomado', forja: 'Sua Forja Antiga está sendo tomada', portal: 'Seu Portal está sendo tomado', torre: 'Sua Torre de Éter está sendo tomada' },
  perdeu: { observatorio: 'Você perdeu o Observatório', forja: 'Você perdeu a Forja Antiga', portal: 'Você perdeu um Portal', torre: 'Você perdeu uma Torre de Éter' },
};

/* a parte da cfg que é do mundo, limpa e validada (a mesma na rede, no salvamento e na retomada) */
function cfgDe(c) {
  const src = c && c.resume && c.resume.simCfg ? c.resume.simCfg : (c || {}); const m = src.mundo; if (!m || src.cacada || src.campaign) return {};
  let o = null;
  if (m === true || m === 1 || m === '1' || m === 'tudo') o = { fauna: true, ruinas: true, corsarios: true, surto: true };
  else if (typeof m === 'string') { const l = m.split(','); o = { fauna: l.includes('fauna'), ruinas: l.includes('ruinas'), corsarios: l.includes('corsarios'), surto: l.includes('surto') }; }
  else if (typeof m === 'object') o = { fauna: !!m.fauna, ruinas: !!m.ruinas, corsarios: !!m.corsarios, surto: !!m.surto };
  if (!o || !(o.fauna || o.ruinas || o.corsarios || o.surto)) return {};
  return { mundo: o };
}
function ativo(cfg) { return !!cfgDe(cfg).mundo; }

/* ---------- o jogador neutro ---------- */
function criaJogador(sim) {
  const id = sim.players.length;
  const p = { id, name: 'Mundo', faction: 'vehnar', color: COR, human: false, difficulty: 'normal', alive: true, mundo: true, fenda: true,
    res: { plasma: 0, minerio: 0, dados: 0 }, energy: { prod: 0, cons: 0, ratio: 1, regime: 'pleno' },
    overchargeT: 0, overchargeCd: 0, superCd: 0, blackoutT: 0, speedBuffT: 0, golpeT: 0, unissonoT: 0,
    era: 1, evolveT: 0, ascended: false, research: {}, rep: 0, pacts: {}, jumpsLeft: 0, lastBaseAlert: -99, lastNucleoAlert: -99, saltoT: 0, traits: {}, traitXp: {},
    stats: { collected: 0, stolen: 0, lost: 0, unitsKilled: 0, unitsLost: 0, buildingsDestroyed: 0, buildingsLost: 0, treaties: 0, betrayals: 0, dmg: 0 }, startAngle: 0 };
  sim.players.push(p); sim.vis.push(new Set()); sim.explored.push(new Uint8Array(S.TILES * S.TILES));
  if (sim.auras) sim.auras.push({ anchors: [], moldes: [], diapasoes: [] });
  if (sim.chefes && sim.chefes.ecos) while (sim.chefes.ecos.length < sim.players.length) sim.chefes.ecos.push([]);
  sim.mundo = id; return id;
}

/* ---------- posições justas: as mesmas coordenadas (raio R, lado L) no quadro de cada vaga entre dois jogadores vizinhos ---------- */
function vagas(sim) { const ps = sim.players.filter(p => !p.fenda && !p.mundo); const n = ps.length; return ps.map(p => { const a = p.startAngle + PI / n; return { a, ux: S.DM.cos(a), uy: S.DM.sin(a) }; }); }
function noQuadro(v, R, L) { return { x: S.CX + v.ux * R - v.uy * L, y: S.CY + v.uy * R + v.ux * L }; }
function nucleos(sim) { return sim.ents.filter(e => e.alive && e.kind === 'building' && e.def === 'nucleo'); }
function chaoFirme(sim, x, y) { if (S.mapCell(sim, x, y) !== 1) return false; if (sim.map && sim.map.type === 'cinturao' && !S.onPlat(sim.map, x, y)) return false; return true; }
function pontoLivre(sim, x, y, r, outros, gap) { /* chão firme sob a pegada inteira, longe da Fenda, dos Núcleos, de nós, rochas, construções e do que já foi posto */
  if (x < r + 90 || y < r + 90 || x > S.WORLD - r - 90 || y > S.WORLD - r - 90) return false;
  if (S.dist(x, y, S.CX, S.CY) < S.RIFT_R + r + 50) return false;
  if (!chaoFirme(sim, x, y)) return false;
  for (let k = 0; k < 8; k++) { const a = k * PI / 4; if (!chaoFirme(sim, x + S.DM.cos(a) * (r + 18), y + S.DM.sin(a) * (r + 18))) return false; }
  for (const e of sim.ents) { if (!e.alive) continue;
    if (e.kind === 'building' && e.def === 'nucleo') { if (S.dist(x, y, e.x, e.y) < 460) return false; continue; }
    if (e.kind === 'node' || e.kind === 'rock' || e.kind === 'building') { if (S.dist(x, y, e.x, e.y) < e.r + r + (gap == null ? 34 : gap)) return false; } }
  for (const o of outros) if (S.dist(x, y, o.x, o.y) < o.r + r + 60) return false;
  return true;
}
const OFFS = (() => { const o = [[0, 0]]; for (let d = 30; d <= 390; d += 30) { const n = Math.max(8, Math.round(d / 15)); for (let j = 0; j < n; j++) { const a = j / n * TAU; o.push([Math.round(d * Math.cos(a) * 100) / 100, Math.round(d * Math.sin(a) * 100) / 100]); } } return o; })(); /* deslocamentos em anéis (fixos: Math só na carga, valores arredondados) */
function acessivel(sim, alvos) { /* cada alvo tem uma célula livre em volta alcançável a partir do primeiro Núcleo */
  const ns = nucleos(sim); if (!ns.length) return true; I.rebuildNav(sim); if (!I.connected(sim, ns)) return false;
  const n0 = ns[0]; let src = -1; for (let k = 0; k < 16 && src < 0; k++) { const a = k * PI / 8; const i = S.navIdx(n0.x + S.DM.cos(a) * (n0.r + 40), n0.y + S.DM.sin(a) * (n0.r + 40)); if (S.passable(sim, i, -2)) src = i; }
  if (src < 0) return false; const f = S.flowField(sim, src, -2);
  for (const t of alvos) { let ok = false; for (let k = 0; k < 12 && !ok; k++) { const a = k * PI / 6; const i = S.navIdx(t.x + S.DM.cos(a) * (t.r + 30), t.y + S.DM.sin(a) * (t.r + 30)); if (f.cost[i] >= 0) ok = true; } if (!ok) return false; }
  return true;
}
/* põe um grupo simétrico: o mesmo (R, L) em todas as vagas de 'ks'; devolve as posições (uma por vaga) ou null */
function grupo(sim, vs, ks, R0, L0, r, outros, valida) {
  const parcial = ks.length < vs.length; /* só parte das vagas: sem deslocamento de lado, senão um dos vizinhos fica mais perto */
  for (const [dR, dL] of OFFS) { if (parcial && dL !== 0) continue; const ps = []; let ok = true;
    for (const k of ks) { const p = noQuadro(vs[k], R0 + dR, L0 + dL); if (!(valida ? valida(p.x, p.y) : pontoLivre(sim, p.x, p.y, r, outros.concat(ps)))) { ok = false; break; } p.r = r; ps.push(p); }
    if (ok) return ps; }
  return null;
}

/* ---------- criação (fim do createSim; mapa, nav e terreno prontos) ---------- */
function criar(sim) {
  if (sim.mundo == null) sim.mundo = -1;
  const c = cfgDe(sim.cfg).mundo; if (!c || !S) return;
  if (c.surto && ARD.modos && ARD.modos.chega && S.fendaDe && !(sim.cfg && sim.cfg.eventos)) S.fendaDe(sim); /* a chuva de meteoros da 5.0g usa o jogador Fenda (avisos no chão e o dano) */
  criaJogador(sim);
  const M = sim.mundoSt = { v: 1, cfg: c, rng: (Math.imul(sim.seed | 0, 2654435761) ^ 0x5BD1E995) >>> 0, ruinas: [], acamp: 0, portais: [],
    herds: [], guardas: [], ninhos: [], contratos: sim.players.map(() => ({ cd: 0 })), porta: [], ag: null, nSurto: 0, avisoT: {} };
  const vs = vagas(sim), n = vs.length, outros = []; const todos = vs.map((v, k) => k);
  if (c.ruinas) {
    const add = (ks, R, L, tipoDe) => { const ps = grupo(sim, vs, ks, R, L, R_RUINA, outros); if (!ps) return [];
      const es = ps.map((p, i) => { const tipo = tipoDe(ks[i], i); const e = S.addBuilding(sim, sim.mundo, RUINAS[tipo].def, p.x, p.y, true); e.ruina = { tipo, dono: -1, capT: 0, capP: -1, par: 0, disputa: false }; outros.push({ x: p.x, y: p.y, r: R_RUINA }); return e; });
      if (!acessivel(sim, es)) { for (const e of es) { e.alive = false; sim.byId.delete(e.id); outros.pop(); } sim.ents = sim.ents.filter(e => e.alive); I.rebuildNav(sim); return null; } return es; };
    const tenta = (ks, Rs, L, tipoDe) => { for (const R of Rs) { const es = add(ks, R, L, tipoDe); if (es && es.length) return es; } return []; }; /* raios em ordem de preferência (no Cinturão, o que cai em plataforma) */
    const T = ['observatorio', 'forja', 'torre', 'forja'];
    const fora = tenta(todos, [1000, 900, 1100, 800], 0, k => n === 2 ? (k === 0 ? 'observatorio' : 'forja') : T[k % T.length]);
    const longe = n === 2 ? tenta(todos, [1420, 1300, 1180, 860, 700, 1500], 0, () => 'torre') : [];
    const portais = tenta(todos, [540, 620, 460, 700], 0, () => 'portal'); /* um Portal por vaga: todos os vizinhos ficam com a mesma distância */
    for (let i = 0; i < portais.length && portais.length >= 2; i++) portais[i].ruina.par = portais[n === 4 ? (i + 2) % 4 : (i + 1) % portais.length].id; /* o par: com 2, um ao outro; com 3, um ciclo; com 4, os opostos (0↔2 e 1↔3) */
    if (portais.length < 2) for (const e of portais) { e.alive = false; sim.byId.delete(e.id); } sim.ents = sim.ents.filter(e => e.alive);
    for (const e of fora.concat(longe, portais)) if (e.alive) { M.ruinas.push(e.id); if (e.ruina.tipo === 'portal') M.portais.push(e.id); }
  }
  if (c.corsarios) { const e = S.addBuilding(sim, sim.mundo, 'acampamento', S.CX, S.CY, true); e.acampamento = { mercs: MERC_IDS.slice() }; M.acamp = e.id; } /* a nave fica sobre a Fenda: a mesma distância de todo Núcleo */
  if (c.fauna) {
    const size = n <= 2 ? 4 : n === 3 ? 3 : 2;
    const casas = grupo(sim, vs, todos, 1250, 0, 30, outros, (x, y) => pontoLivre(sim, x, y, 30, outros, 60)) || grupo(sim, vs, todos, 900, 0, 30, outros, (x, y) => pontoLivre(sim, x, y, 30, outros, 60));
    if (casas) casas.forEach((h, k) => { const herd = { x: h.x, y: h.y, n: size, ids: [], prox: 0 }; for (let j = 0; j < size; j++) { const u = novaFauna(sim, M, 'pastador', h.x + S.DM.cos(j * TAU / size) * 34, h.y + S.DM.sin(j * TAU / size) * 34, h.x, h.y); herd.ids.push(u.id); } M.herds.push(herd); });
    for (const v of vs) { let no = null, bd = 120; const p = noQuadro(v, 640, 0); for (const e of sim.ents) if (e.alive && e.kind === 'node' && e.res === 'dados') { const d = S.dist(e.x, e.y, p.x, p.y); if (d < bd) { bd = d; no = e; } }
      if (!no || M.guardas.length >= LIMITE.guardiao) continue; no.amount += FAUNA.guardiao.extra; no.max += FAUNA.guardiao.extra; no.rico = 1;
      const g = novaFauna(sim, M, 'guardiao', no.x - v.ux * 34, no.y - v.uy * 34, no.x, no.y); g.fauna.no = no.id; no.guarda = g.id; M.guardas.push(g.id); }
    const sw = Math.max(2, Math.floor(LIMITE.enxame / n)); for (const v of vs) { const p = noQuadro(v, 440, 0); M.ninhos.push({ x: Math.round(p.x), y: Math.round(p.y), n: sw, ids: [], noite: -1 }); }
  }
  if (c.surto) { sim.surtos = []; M.ag = { prox: SURTO.primeiro - SURTO.aviso, seq: 0, met: null, metOk: !!(ARD.modos && ARD.modos.chega && sim.fenda >= 0 && !(sim.cfg && sim.cfg.eventos)) }; }
  I.rebuildNav(sim);
}
function novaFauna(sim, M, tipo, x, y, cx, cy) {
  const u = I.addUnit(sim, sim.mundo, FAUNA[tipo].def, cl(x, 40, S.WORLD - 40), cl(y, 40, S.WORLD - 40));
  u.fauna = { tipo, cx, cy, est: tipo === 'guardiao' ? 'guarda' : 'ronda', mx: u.x, my: u.y, mv: 0, t: sim.time + rnd(M) * 4, ate: 0, alvo: 0, hostil: tipo === 'enxame' };
  u.ang = rnd(M) * TAU; u.state = 'idle'; return u;
}

/* ---------- passo (no fim do step, antes da poda) ---------- */
function passo(sim, dt) {
  const M = sim.mundoSt; if (!M) return;
  if (M.ruinas.length && sim.tick % 5 === 0) capturas(sim, M, 0.5);
  if (M.porta.length && sim.tick % 2 === 0) portais(sim, M);
  if (M.cfg.fauna) fauna(sim, M);
  if (M.ag) agenda(sim, M, dt);
}

/* captura: infantaria parada (sem andar nos 2 últimos tiques) a até CAP.raio da borda; um dono só avança, dois ou mais contestam */
function capturas(sim, M, dt) {
  for (const id of M.ruinas) { const e = vivo(sim, id); if (!e) continue; const R = e.ruina;
    if (R.dono >= 0 && !(sim.players[R.dono] && sim.players[R.dono].alive)) { const old = R.dono; R.dono = -1; R.capT = 0; R.capP = -1; emit(sim, { t: 'mundo', ev: 'perde', id: e.id, tipo: R.tipo, p: old, por: -1, x: e.x, y: e.y }); }
    let o1 = -1, n1 = 0, multi = false;
    I.queryGrid(sim, e.x, e.y, e.r + CAP.raio + 30, u => { if (u.kind !== 'unit' || !u.alive || u.cls !== 'inf' || !real(sim, u.owner)) return; if (u.mvTick != null && u.mvTick >= sim.tick - 2) return; if (S.dist(u.x, u.y, e.x, e.y) - u.r > e.r + CAP.raio) return; if (o1 < 0 || o1 === u.owner) { o1 = u.owner; n1++; } else multi = true; });
    const disp = multi; if (disp !== R.disputa) { R.disputa = disp; if (disp) emit(sim, { t: 'mundo', ev: 'disputa', id: e.id, tipo: R.tipo, x: e.x, y: e.y }); }
    if (multi) continue;
    const rate = Math.min(2, 1 + 0.25 * (Math.min(CAP.maxN, n1) - 1)) * dt;
    if (o1 < 0) { if (R.dono < 0) { R.capT = Math.max(0, R.capT - CAP.decai * dt); if (R.capT <= 0) R.capP = -1; } else R.capT = Math.min(CAP.t, R.capT + dt); continue; }
    if (R.dono === o1) { R.capT = Math.min(CAP.t, R.capT + rate); R.capP = o1; continue; }
    if (R.dono >= 0) { /* tirando do dono: a barra dele cai até zero e a ruína volta a ser livre */
      if (R.capT >= CAP.t - 1e-9 && (M.avisoT[e.id] || -99) < sim.time - 30) { M.avisoT[e.id] = sim.time; alerta(sim, R.dono, TXT.tomada[R.tipo], e.x, e.y, 'danger'); }
      R.capT = Math.max(0, R.capT - rate); R.capP = o1;
      if (R.capT <= 0) { const old = R.dono; R.dono = -1; R.capT = 0; emit(sim, { t: 'mundo', ev: 'perde', id: e.id, tipo: R.tipo, p: old, por: o1, x: e.x, y: e.y }); alerta(sim, old, TXT.perdeu[R.tipo], e.x, e.y, 'danger'); }
      continue; }
    if (R.capP !== o1) { R.capT = Math.max(0, R.capT - rate); if (R.capT <= 0) R.capP = o1; continue; } /* outro tinha começado: primeiro a barra dele volta a zero */
    R.capT = Math.min(CAP.t, R.capT + rate);
    if (R.capT >= CAP.t) { R.dono = o1; R.capT = CAP.t; emit(sim, { t: 'mundo', ev: 'captura', id: e.id, tipo: R.tipo, p: o1, x: e.x, y: e.y });
      alerta(sim, o1, TXT.cap[R.tipo], e.x, e.y, 'good');
      alertaTodos(sim, TXT.capOutro[R.tipo].replace('{nome}', sim.players[o1].name), e.x, e.y, 'warn', o1); }
  }
}
function portais(sim, M) {
  for (let i = M.porta.length - 1; i >= 0; i--) { const u = vivo(sim, M.porta[i]); const e = u && u.portal ? vivo(sim, u.portal) : null;
    if (!u || !e || !e.ruina || e.ruina.dono !== u.owner) { if (u) u.portal = 0; M.porta.splice(i, 1); continue; }
    if (S.dist(u.x, u.y, e.x, e.y) <= e.r + u.r + 26) {
      const d = vivo(sim, e.ruina.par); if (!d) { u.portal = 0; M.porta.splice(i, 1); continue; }
      const k = M.nPorta = (M.nPorta || 0) + 1; const a0 = S.DM.atan2(S.CY - d.y, S.CX - d.x) + ((k % 7) - 3) * 0.42; let x = d.x + S.DM.cos(a0) * (d.r + u.r + 22), y = d.y + S.DM.sin(a0) * (d.r + u.r + 22);
      if (!S.UNITS[u.def].flying && !S.groundAt(sim, x, y)) { x = d.x + S.DM.cos(a0 + PI) * (d.r + u.r + 22); y = d.y + S.DM.sin(a0 + PI) * (d.r + u.r + 22); }
      const x0 = u.x, y0 = u.y; u.x = u.px = x; u.y = u.py = y; u.state = 'idle'; u.tx = x; u.ty = y; u.target = null; u.resume = null; u.portal = 0; u.stuck = 0; u.stk = 0; u.pc = -1; u.sx = null; u.sy = null; M.porta.splice(i, 1);
      emit(sim, { t: 'mundo', ev: 'portal', id: e.id, para: d.id, uid: u.id, p: u.owner, x: x0, y: y0, x2: x, y2: y }); continue; }
    if (u.state === 'idle') { u.portal = 0; M.porta.splice(i, 1); } }
}

/* ---------- fauna: decisões a cada 5 tiques (escalonadas pelo id) e movimento no laço das unidades (unidade) ---------- */
function noite(sim) { if (ARD.modos && ARD.modos.noite && ARD.modos.noite(sim)) return 1; return (1 - S.DM.cos(TAU * sim.time / 750)) / 2; } /* a mesma hora do render (ciclo de 750 s; Noite Eterna presa à noite) */
function eterna(sim) { return !!(ARD.modos && ARD.modos.noite && ARD.modos.noite(sim)); }
function maisPerto(sim, x, y, raio, pred) { let best = null, bd = raio; I.queryGrid(sim, x, y, raio + 40, e => { if (!e.alive || e.kind !== 'unit' || !real(sim, e.owner) || (pred && !pred(e))) return; const d = S.dist(x, y, e.x, e.y) - e.r; if (d < bd) { bd = d; best = e; } }); return best; }
function ponto(sim, M, u, cx, cy, raio) { /* ponto de chão a até 'raio' de (cx, cy) com linha livre a partir da unidade */
  const voa = S.UNITS[u.def].flying;
  for (let k = 0; k < 6; k++) { const a = rnd(M) * TAU, d = raio * (0.3 + 0.7 * rnd(M)); const x = cl(cx + S.DM.cos(a) * d, 40, S.WORLD - 40), y = cl(cy + S.DM.sin(a) * d, 40, S.WORLD - 40);
    if (voa) return { x, y }; if (S.groundAt(sim, x, y) && S.lineFree(sim, u.x, u.y, x, y, u.owner, u.r)) return { x, y }; }
  return null;
}
function fauna(sim, M) {
  const t = sim.time, nt = noite(sim), et = eterna(sim);
  for (const e of sim.ents) { if (!e.alive || !e.fauna || (e.id + sim.tick) % 5) continue; const F = e.fauna;
    if (F.tipo === 'pastador') pensaPastador(sim, M, e, F, t);
    else if (F.tipo === 'guardiao') pensaGuardiao(sim, M, e, F, t);
    else if (F.tipo === 'enxame') pensaEnxame(sim, M, e, F, t, nt, et); }
  if (sim.tick % 10 === 0) { /* manadas renascem devagar (uma cabeça a cada 2 min, sem passar do tamanho) e os ninhos soltam o enxame uma vez por noite */
    for (const h of M.herds) { h.ids = h.ids.filter(id => vivo(sim, id)); if (h.ids.length < h.n && t >= h.prox) { if (h.prox > 0) { const u = novaFauna(sim, M, 'pastador', h.x, h.y, h.x, h.y); h.ids.push(u.id); emit(sim, { t: 'spawn', p: sim.mundo, x: u.x, y: u.y, def: u.def }); } h.prox = t + FAUNA.pastador.renasce; } else if (h.ids.length >= h.n) h.prox = t + FAUNA.pastador.renasce; }
    const ciclo = et ? Math.floor(t / FAUNA.enxame.eterna) : Math.floor((t + 375) / 750); let saiu = false;
    for (const ni of M.ninhos) { ni.ids = ni.ids.filter(id => vivo(sim, id));
      if (nt >= FAUNA.enxame.noite && !ni.ids.length && ni.noite !== ciclo) { ni.noite = ciclo;
        for (let j = 0; j < ni.n; j++) { const u = novaFauna(sim, M, 'enxame', ni.x + S.DM.cos(j * TAU / ni.n) * 18, ni.y + S.DM.sin(j * TAU / ni.n) * 18, ni.x, ni.y); ni.ids.push(u.id); }
        emit(sim, { t: 'mundo', ev: 'fauna', tipo: 'enxame', fase: 'chega', x: ni.x, y: ni.y }); saiu = true; }
      if (nt < FAUNA.enxame.dia && ni.ids.length) { for (const id of ni.ids) { const u = vivo(sim, id); if (u) u.alive = false; } ni.ids = []; emit(sim, { t: 'mundo', ev: 'fauna', tipo: 'enxame', fase: 'parte', x: ni.x, y: ni.y }); } }
    if (saiu) alertaTodos(sim, 'Anoiteceu: enxames noturnos saíram dos ninhos perto da Fenda', S.CX, S.CY, 'warn'); }
}
function pensaPastador(sim, M, u, F, t) {
  const P = FAUNA.pastador; const ferido = t - u.lastHitT < 3;
  const ameaca = ferido ? (maisPerto(sim, u.x, u.y, 320, e => e.owner === u.lastHitBy) || maisPerto(sim, u.x, u.y, 320)) : maisPerto(sim, u.x, u.y, P.medo);
  if (ameaca && (F.est !== 'foge' || t >= F.ate - 2)) { /* foge para o lado oposto (tenta desviar se a reta bate em algo) */
    const a0 = S.DM.atan2(u.y - ameaca.y, u.x - ameaca.x);
    for (const da of [0, 0.7, -0.7, 1.4, -1.4]) { let x = u.x + S.DM.cos(a0 + da) * P.fuga, y = u.y + S.DM.sin(a0 + da) * P.fuga; const dh = S.dist(x, y, F.cx, F.cy); if (dh > P.longe) { x = F.cx + (x - F.cx) * P.longe / dh; y = F.cy + (y - F.cy) * P.longe / dh; }
      x = cl(x, 40, S.WORLD - 40); y = cl(y, 40, S.WORLD - 40); if (S.groundAt(sim, x, y) && S.lineFree(sim, u.x, u.y, x, y, u.owner, u.r)) { F.est = 'foge'; F.mx = x; F.my = y; F.mv = 1; F.ate = t + 4; break; } }
    return; }
  if (F.est === 'foge' && t < F.ate) return;
  if (F.est === 'foge') { F.est = 'ronda'; F.mv = 0; F.t = t + 2; }
  if (!F.mv && t >= F.t) { const p = ponto(sim, M, u, F.cx, F.cy, P.casa); if (p) { F.mx = p.x; F.my = p.y; F.mv = 1; } F.t = t + 6 + rnd(M) * 8; }
}
function pensaGuardiao(sim, M, u, F, t) {
  const G = FAUNA.guardiao; const ferido = t - u.lastHitT < 2;
  if (F.est === 'ataca') { const a = vivo(sim, F.alvo);
    if (!a || !real(sim, a.owner) || S.dist(a.x, a.y, F.cx, F.cy) > G.coleira) { const n = maisPerto(sim, F.cx, F.cy, G.raio); if (n) F.alvo = n.id; else { F.est = 'volta'; F.alvo = 0; F.hostil = false; F.mx = F.cx; F.my = F.cy; F.mv = 1; } }
    return; }
  const n = maisPerto(sim, F.cx, F.cy, G.raio) || (ferido && real(sim, u.lastHitBy) ? maisPerto(sim, u.x, u.y, 320, e => e.owner === u.lastHitBy) : null);
  if (n) { F.est = 'ataca'; F.alvo = n.id; F.hostil = true; if (t - (F.avisoT || -99) > 20) { F.avisoT = t; emit(sim, { t: 'mundo', ev: 'fauna', tipo: 'guardiao', fase: 'ataca', id: u.id, p: n.owner, x: u.x, y: u.y }); } return; }
  if (F.est === 'volta' && S.dist(u.x, u.y, F.cx, F.cy) < 40) { F.est = 'guarda'; F.mv = 0; }
  if (F.est === 'guarda' && t - u.lastHitT > 5 && u.hp < u.maxHp) u.hp = Math.min(u.maxHp, u.hp + u.maxHp * G.regen * 0.5); /* em casa e em paz: 1%/s */
}
function pensaEnxame(sim, M, u, F, t, nt, et) {
  const X = FAUNA.enxame;
  if (F.est === 'ataca') { const a = vivo(sim, F.alvo); if (!a || !real(sim, a.owner) || S.dist(a.x, a.y, F.cx, F.cy) > X.coleira) { const n = maisPerto(sim, F.cx, F.cy, X.raio); if (n) F.alvo = n.id; else { F.est = 'ronda'; F.alvo = 0; F.mv = 0; } } return; }
  const n = maisPerto(sim, F.cx, F.cy, X.raio) || (t - u.lastHitT < 2 ? maisPerto(sim, u.x, u.y, 300) : null);
  if (n) { F.est = 'ataca'; F.alvo = n.id; return; }
  if (!F.mv && t >= F.t) { const p = ponto(sim, M, u, F.cx, F.cy, X.ronda); if (p) { F.mx = p.x; F.my = p.y; F.mv = 1; } F.t = t + 2 + rnd(M) * 3; }
}
/* a unidade da fauna (no laço das unidades, no lugar do updateUnit): anda em linha reta até o ponto escolhido e ataca o alvo */
function anda(sim, u, x, y, sp) {
  const dx = x - u.x, dy = y - u.y, d = S.DM.hypot(dx, dy); if (d < 2) return true; const s = Math.min(d, sp * S.TICK);
  const nx = u.x + dx / d * s, ny = u.y + dy / d * s; if (!S.UNITS[u.def].flying && !S.groundAt(sim, nx, ny)) return true;
  u.x = nx; u.y = ny; u.ang = S.DM.atan2(dy, dx); u.mvTick = sim.tick; return false;
}
function unidade(sim, u, dt) {
  if (u.cd > 0) u.cd -= dt; const F = u.fauna; if (!F) return;
  if (F.est === 'ataca') { const a = vivo(sim, F.alvo); const w = S.UNITS[u.def].attack; if (!a || !w) return;
    const d = S.dist(u.x, u.y, a.x, a.y);
    if (d <= w.range + a.r + u.r * 0.5) { u.ang = S.DM.atan2(a.y - u.y, a.x - u.x); if (u.cd <= 0) I.fire(sim, u, a); }
    else if (S.UNITS[u.def].flying || S.lineFree(sim, u.x, u.y, a.x, a.y, u.owner, 0)) anda(sim, u, a.x, a.y, u.speed);
    return; }
  if (F.mv) { const sp = F.est === 'foge' ? u.speed * 1.6 : F.est === 'volta' ? u.speed : u.speed * 0.45; if (anda(sim, u, F.mx, F.my, sp)) F.mv = 0; }
}
/* morte de uma criatura (kill): o prêmio do caçador */
function caixa(sim, x, y, carga) { const c = { id: sim.nextId++, kind: 'crate', x, y, r: 9, alive: true, owner: -1, cargo: Object.assign({ plasma: 0, minerio: 0, dados: 0 }, carga), stolen: false, bornT: sim.time }; sim.ents.push(c); sim.byId.set(c.id, c); emit(sim, { t: 'crate', x, y }); return c; }
function morte(sim, e, killer) {
  const M = sim.mundoSt; if (!M || !e.fauna) return; const F = e.fauna;
  if (F.tipo === 'pastador') caixa(sim, e.x, e.y, FAUNA.pastador.premio);
  else if (F.tipo === 'guardiao') { caixa(sim, e.x, e.y, FAUNA.guardiao.premio); const no = vivo(sim, F.no); if (no) no.guarda = 0;
    emit(sim, { t: 'mundo', ev: 'fauna', tipo: 'guardiao', fase: 'cai', id: e.id, p: killer, x: e.x, y: e.y }); if (real(sim, killer)) alerta(sim, killer, 'Guardião do Veio derrubado: o bônus dele ficou no chão e o nó rico está livre', e.x, e.y, 'good'); }
  else if (F.tipo === 'enxame' && real(sim, killer)) { const p = sim.players[killer]; p.res.dados += FAUNA.enxame.premio; p.stats.collected += FAUNA.enxame.premio; emit(sim, { t: 'float', x: e.x, y: e.y, text: '+' + FAUNA.enxame.premio, owner: killer, kind: 'gain' }); }
}

/* ---------- comandos (pela fila: capturar, portal, contratar) ---------- */
function minhas(sim, pid, ids) { const out = []; if (!Array.isArray(ids)) return out; for (const id of ids) { const u = sim.byId.get(id); if (u && u.alive && u.kind === 'unit' && u.owner === pid && !u.fauna) out.push(u); } return out; }
function vai(u, x, y) { u.state = 'move'; u.tx = cl(x, 20, S.WORLD - 20); u.ty = cl(y, 20, S.WORLD - 20); u.target = null; u.resume = null; u.node = null; u.stuck = 0; u.stk = 0; u.gx = null; u.gy = null; u.gn = 0; }
function comando(sim, c) {
  const M = sim.mundoSt; if (!M || !real(sim, c.p)) return; const p = sim.players[c.p];
  if (c.t === 'capturar' || c.t === 'portal') { const e = vivo(sim, c.id); if (!e || !e.ruina) return; const us = minhas(sim, c.p, c.ids); if (!us.length) return;
    if (c.t === 'portal') { if (e.ruina.tipo !== 'portal' || e.ruina.dono !== c.p) { aviso(sim, c.p, 'Capture este Portal primeiro'); return; }
      us.forEach((u, i) => { const a = S.DM.atan2(u.y - e.y, u.x - e.x) + ((i % 5) - 2) * 0.25; vai(u, e.x + S.DM.cos(a) * (e.r + u.r + 10), e.y + S.DM.sin(a) * (e.r + u.r + 10)); if (!u.portal) M.porta.push(u.id); u.portal = e.id; });
      return; }
    us.forEach((u, i) => { const a = (i / us.length) * TAU + S.DM.atan2(us[0].y - e.y, us[0].x - e.x); const rr = e.r + (u.cls === 'inf' ? 34 : 70) + (i >= 8 ? 26 : 0); vai(u, e.x + S.DM.cos(a) * rr, e.y + S.DM.sin(a) * rr); });
    return; }
  if (c.t === 'contratar') { const e = vivo(sim, c.id); const m = MERCS[c.merc]; if (!e || !e.acampamento || !m) return; const k = M.contratos[c.p] || (M.contratos[c.p] = { cd: 0 });
    if (sim.time < k.cd) { aviso(sim, c.p, 'Irmandade Corsária: aguarde ' + Math.ceil(k.cd - sim.time) + ' s para contratar de novo'); return; }
    let vivos = 0, perto = false; for (const o of sim.ents) { if (!o.alive || o.owner !== c.p) continue; if (o.kind === 'unit' && o.merc) vivos++; if ((o.kind === 'unit' || o.kind === 'building') && S.dist(o.x, o.y, e.x, e.y) <= CONTRATO.raio) perto = true; }
    if (!perto) { aviso(sim, c.p, 'Leve uma unidade até perto do Acampamento Corsário para contratar'); return; }
    if (vivos >= CONTRATO.max) { aviso(sim, c.p, 'Limite de mercenários: ' + CONTRATO.max + ' ao mesmo tempo'); return; }
    if (!S.canAfford(p, m.custo)) { aviso(sim, c.p, 'Requer ' + m.custo.dados + ' Dados'); return; }
    for (const r in m.custo) p.res[r] -= m.custo[r];
    const n = S.nucleoOf(sim, c.p); let a = n ? S.DM.atan2(n.y - e.y, n.x - e.x) : 0, x = 0, y = 0; /* sai da nave para o lado do Núcleo de quem contratou, num ponto de chão (no Cinturão, o anel do Plasma) */
    for (let k = 0; k < 13; k++) { const ak = a + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.3, rr = S.RIFT_R + 130; x = e.x + S.DM.cos(ak) * rr; y = e.y + S.DM.sin(ak) * rr; if (S.groundAt(sim, x, y) && !sim.nav.blocked[S.navIdx(x, y)]) { a = ak; break; } }
    const u = S.spawnUnit(sim, c.p, m.def, x, y); if (!u) return; u.merc = c.merc; u.tempUntil = sim.time + CONTRATO.dura; vai(u, x + S.DM.cos(a) * 110, y + S.DM.sin(a) * 110);
    k.cd = sim.time + CONTRATO.cd;
    emit(sim, { t: 'mundo', ev: 'contrato', p: c.p, merc: c.merc, id: u.id, x: u.x, y: u.y });
    alerta(sim, c.p, { saqueador: 'Saqueador Corsário contratado por 5 min', artilheiro: 'Artilheiro Corsário contratado por 5 min', atirador: 'Atirador Corsário contratado por 5 min' }[c.merc], u.x, u.y, 'good'); }
}

/* ---------- agenda do Surto de éter e da chuva de meteoros ---------- */
function agenda(sim, M, dt) {
  const A = M.ag, t = sim.time; const L = sim.surtos;
  for (let i = L.length - 1; i >= 0; i--) { const z = L[i];
    if (!z.on && t >= z.t0) { z.on = 1; emit(sim, { t: 'mundo', ev: 'surto', fase: 'comeca', id: z.id, x: z.x, y: z.y, r: z.r, t0: z.t0, t1: z.t1 }); alertaTodos(sim, 'Surto de éter! A renda dobra dentro do círculo por ' + SURTO.dura + ' s', z.x, z.y, 'good'); }
    if (t >= z.t1) { L.splice(i, 1); emit(sim, { t: 'mundo', ev: 'surto', fase: 'fim', id: z.id, x: z.x, y: z.y, r: z.r }); } }
  const E = A.met; if (E && E.at) { const X = E.at; if (X.fase === 'aviso' && t - X.t0 >= SURTO.meteoroAviso) { X.fase = 'chega'; X.t1 = t; ARD.modos.chega(sim, E, X); } else if (X.fase === 'chega') ARD.modos.segue(sim, E, X, dt); if (!E.at) A.met = null; }
  if (t < A.prox) return;
  A.seq++; A.prox = t + SURTO.cada;
  if (A.seq % 2 === 0 && A.metOk && !A.met) { /* chuva de meteoros (a mesma da 5.0g: avisos no chão, dano em área e cristais novos) */
    const a = rnd(M) * TAU; const x = S.CX + S.DM.cos(a) * 700, y = S.CY + S.DM.sin(a) * 700;
    A.met = { at: { tipo: 'meteoros', fase: 'aviso', t0: t, x, y, a, ids: [], met: [] } };
    emit(sim, { t: 'evento', ev: 'meteoros', fase: 'aviso', x, y, mundo: true }); alertaTodos(sim, 'Chuva de meteoros em ' + SURTO.meteoroAviso + ' s: fique longe dos anéis no chão', x, y, 'warn'); return; }
  const vs = vagas(sim); if (!vs.length) return; const v = vs[M.nSurto++ % vs.length]; const p = noQuadro(v, SURTO.raio, 0); /* cada surto numa vaga entre vizinhos, em rodízio */
  const z = { id: sim.nextId++, x: Math.round(p.x), y: Math.round(p.y), r: SURTO.r, t0: t + SURTO.aviso, t1: t + SURTO.aviso + SURTO.dura }; L.push(z);
  emit(sim, { t: 'mundo', ev: 'surto', fase: 'aviso', id: z.id, x: z.x, y: z.y, r: z.r, t0: z.t0, t1: z.t1 }); alertaTodos(sim, 'Surto de éter em ' + SURTO.aviso + ' s: a renda dobra dentro do círculo marcado', z.x, z.y, 'warn');
}

/* ---------- ganchos chamados pelo src/sim.js (sempre atrás de sim.mundo >= 0 ou sim.mundoSt) ---------- */
function hostil(e) { return !!(e.fauna && e.fauna.hostil); }                                      /* acquire: só a fauna hostil vira alvo automático */
function visao(sim, e) { const R = e.ruina; if (!R || R.dono < 0) return 0; return R.tipo === 'observatorio' ? RUINAS.observatorio.visao : CAP.visao; } /* sensorRadius de uma ruína (do dono) */
function energia(sim, p) { const M = sim.mundoSt; if (!M) return 0; let n = 0; for (const id of M.ruinas) { const e = sim.byId.get(id); if (e && e.alive && e.ruina.tipo === 'torre' && e.ruina.dono === p.id) n++; } return n * RUINAS.torre.energia; }
function forja(sim, pid) { const M = sim.mundoSt; if (!M) return 1; for (const id of M.ruinas) { const e = sim.byId.get(id); if (e && e.alive && e.ruina.tipo === 'forja' && e.ruina.dono === pid) return RUINAS.forja.desconto; } return 1; }
function surto(sim, x, y) { const L = sim.surtos; if (!L) return false; const t = sim.time; for (const z of L) if (t >= z.t0 && t < z.t1 && S.dist(x, y, z.x, z.y) <= z.r) return true; return false; }
function guardado(sim, n) { const g = n.guarda ? sim.byId.get(n.guarda) : null; return !!(g && g.alive); }   /* coleta automática pula o nó com Guardião vivo */
function hash(sim, mix) { const M = sim.mundoSt; if (!M) return; mix(sim.mundo); mix(M.rng | 0); mix(M.porta.length); mix(M.nSurto);
  for (const id of M.ruinas) { const e = sim.byId.get(id); if (!e) continue; mix(e.ruina.dono); mix(Math.round(e.ruina.capT * 10)); mix(e.ruina.capP); }
  for (const k of M.contratos) mix(Math.round((k ? k.cd : 0) * 10));
  if (M.ag) { mix(Math.round(M.ag.prox * 10)); mix(M.ag.seq); mix(M.ag.met && M.ag.met.at ? M.ag.met.at.met.length + (M.ag.met.at.fase === 'chega' ? 100 : 0) : -1); }
  if (sim.surtos) for (const z of sim.surtos) { mix(z.id); mix(z.x); mix(z.y); mix(Math.round(z.t0 * 10)); }
  for (const e of sim.ents) if (e.alive && e.fauna) { const F = e.fauna; mix(e.id); mix(F.alvo); mix(F.mv); mix(F.est.length); } }
function snapshot(sim) { return sim.mundoSt ? S.jsonSafe({ idx: sim.mundo, st: sim.mundoSt, surtos: sim.surtos || null }) : null; }
function restore(sim, d) { /* d = snap.mundo (JSON); salvamento antigo ou sem mundo: tudo no padrão */
  if (!d) { sim.mundo = -1; sim.mundoSt = undefined; sim.surtos = undefined; return; }
  const o = S.jsonBack(d); sim.mundo = o.idx; sim.mundoSt = o.st; if (o.surtos) sim.surtos = o.surtos; else delete sim.surtos;
}
/* o resumo para a interface (cartão da partida e salvamento) */
function resumo(cfgOuSim) { const cfg = cfgOuSim && cfgOuSim.cfg ? cfgOuSim.cfg : cfgOuSim; return cfgDe(cfg).mundo || null; }
/* medida da justiça das posições: para cada Núcleo, a distância até a ruína mais perto (e até o portal, o Observatório etc.) */
function justica(sim) { const M = sim.mundoSt; const ns = sim.players.filter(p => !p.fenda).map(p => S.nucleoOf(sim, p.id)).filter(Boolean); const rs = M ? M.ruinas.map(id => sim.byId.get(id)).filter(Boolean) : [];
  return ns.map(n => { let d = Infinity; for (const r of rs) d = Math.min(d, S.dist(n.x, n.y, r.x, r.y)); return { p: n.owner, ruina: Math.round(d) }; }); }

ARD.mundo = { versao: '5.0h', RUINAS, RUINA_TIPOS, MERCS, MERC_IDS, CAP, CONTRATO, SURTO, FAUNA, LIMITE, DEFS_U, DEFS_B, ARMAS, COR,
  instala, cfgDe, ativo, criar, passo, unidade, morte, comando, hostil, visao, energia, forja, surto, guardado, noite, hash, snapshot, restore, resumo, justica };
})(globalThis.ARD = globalThis.ARD || {});
