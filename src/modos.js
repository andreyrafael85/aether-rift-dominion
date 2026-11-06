/* Aether Rift: Dominion — 5.0g: modos da partida na simulação (Caçada, Eventos da Fenda, mutadores e a Lente do Arauto).
   Determinístico como o src/sim.js: sem DOM, sem Math.random, sem Date nem performance.now; só o RNG da partida (sim.rand), a matemática
   determinística (DM) e o tempo do tique. Entra no build ANTES do src/sim.js; as funções só usam ARD.sim na hora da chamada.
   Estado em sim.modos (só existe quando a cfg pede um modo: Caçada, eventos, mutador ou relíquia), salvo no snapshot e misturado no hash.
   Partida sem modo nenhum: sim.modos fica indefinido e nada aqui roda (o hash e as missões ficam idênticos aos da 5.0f). */
(function (ARD) {
'use strict';
const S = () => ARD.sim;
/* ---------- tabelas ---------- */
const MUTADORES = {
  noite: { visao: 0.75 },                      /* Noite Eterna: o ciclo preso à noite e a visão −25% */
  tempestades: { lento: 0.9, freq: 0.5 },      /* Tempestades Frequentes: Tempestade de Éter com o dobro da frequência; dentro dela, −10% de velocidade */
  escassos: { nos: 0.5, destrocos: 0.5 },      /* Recursos Escassos: nós e destroços pela metade */
};
const MUT_IDS = Object.keys(MUTADORES);
/* Caçada: arena de cada chefão e o reforço da base inicial por dificuldade */
const CACADA = { arauto: { mapa: 'fenda' }, forja: { mapa: 'tita' } };
const CAC_DIF = {
  facil:   { res: { minerio: 1200, plasma: 600, dados: 200 }, aliado: 'normal' },
  normal:  { res: { minerio: 900, plasma: 450, dados: 150 }, aliado: 'normal' },
  dificil: { res: { minerio: 700, plasma: 350, dados: 120 }, aliado: 'dificil' },
  brutal:  { res: { minerio: 500, plasma: 250, dados: 100 }, aliado: 'dificil' },
};
const CAC_LIMITE = 40 * 60;                    /* a Caçada termina em derrota aos 40 min */
/* medalha por tempo e perdas (unidades de combate perdidas pelo time) */
const MEDALHAS = { ouro: { t: 12 * 60, perdas: 15 }, prata: { t: 20 * 60, perdas: 40 } };
/* Eventos da Fenda na escaramuça */
const EV = {
  primeiro: [360, 480],        /* o primeiro evento menor entre 6 e 8 min */
  sentinela: [720, 900],       /* a Sentinela entre 12 e 15 min, no centro */
  intervalo: 180,              /* no máximo um evento a cada 3 min (contado do início de cada um) */
  aviso: 20,                   /* aviso antes de cada evento (s) */
  menores: ['caravana', 'enxame', 'meteoros'],
};
const CARAVANA = { n: 3, def: 'pirata', vel: 42, vida: 520, carga: { minerio: 260, plasma: 120 }, dur: 170 };
const ENXAME = { n: 10, def: 'cria', vida: 150, dur: 150, alvoCada: 30 };
const METEOROS = { n: 8, cada: 3, r: 80, dano: 160, aviso: 4, cristal: 240 };
const SENTINELA_PREMIO = { minerio: 700, plasma: 450, dados: 180 };
const LENTE = 1.1;                             /* Lente do Arauto: +10% de visão para quem a leva */

/* ---------- utilidades ---------- */
function emit(sim, ev) { ev.time = sim.time; sim.events.push(ev); }
function alerta(sim, pid, text, x, y, kind) { emit(sim, { t: 'alert', p: pid, text, x, y, kind: kind || 'info' }); }
function alertaTodos(sim, text, x, y, kind) { for (const q of sim.players) if (q.alive && !q.fenda) alerta(sim, q.id, text, x, y, kind); }
const cl = (v, a, b) => v < a ? a : v > b ? b : v;
function lista(v) { return Array.isArray(v) ? v : typeof v === 'string' ? v.split(',') : []; }

/* a parte da cfg que é dos modos, limpa e validada (a mesma na rede, no salvamento e na retomada) */
function cfgDe(c) {
  const o = {}; if (!c) return o;
  if (c.cacada && CACADA[c.cacada.chefe]) o.cacada = { chefe: c.cacada.chefe, dif: CAC_DIF[c.cacada.dif] ? c.cacada.dif : 'normal' };
  if (c.eventos && !o.cacada) o.eventos = true;
  if (c.eventosTeste && EV.menores.concat(['sentinela']).includes(c.eventosTeste)) { o.eventosTeste = c.eventosTeste; if (c.eventosEm > 0) o.eventosEm = Math.round(+c.eventosEm); } /* chaves de teste (?evento= e ?eventoem=) */
  const m = lista(c.mutadores).filter(k => MUTADORES[k]); if (m.length) o.mutadores = MUT_IDS.filter(k => m.includes(k));
  return o;
}
function ativo(cfg) { const c = cfgDe(cfg); return !!(c.cacada || c.eventos || c.eventosTeste || c.mutadores) || !!(cfg && cfg.players && cfg.players.some(p => p && p.lente)); }

/* ---------- 5.0g junção: o jogador Fenda, o S.spawnBoss/S.bossOf e o sim.avisos são do g-sim (src/chefes-sim.js, ARD.chefesSim) ---------- */
function fendaDe(sim) { return S().fendaDe(sim); }       /* cria a Fenda se faltar (a Caçada e os eventos já a têm desde o createSim) */
function avisos(sim) { if (!sim.avisos) sim.avisos = []; return sim.avisos; }

/* ---------- criação (fim do createSim) ---------- */
function criar(sim) {
  const cfg = sim.cfg || {}; if (!ativo(cfg)) return; const c = cfgDe(cfg);
  const M = sim.modos = { v: 1, mut: {}, visao: 1, lento: 1 };
  for (const k of c.mutadores || []) M.mut[k] = true;
  if (M.mut.noite) M.visao = MUTADORES.noite.visao;
  if (M.mut.tempestades) { M.lento = MUTADORES.tempestades.lento; sim.nextStorm = 150 + (sim.nextStorm - 300) * MUTADORES.tempestades.freq; } /* primeira tempestade entre 2,5 e 3,5 min */
  if (M.mut.escassos) for (const e of sim.ents) if (e.kind === 'node') { e.amount = e.max = Math.round(e.amount * MUTADORES.escassos.nos); e.esc = 1; }
  (cfg.players || []).forEach((pc, i) => { if (pc && pc.lente && sim.players[i]) sim.players[i].lente = true; });
  if (c.cacada) criarCacada(sim, c.cacada);
  else if (c.eventos || c.eventosTeste) { fendaDe(sim); M.ev = { prox: c.eventosTeste && c.eventosTeste !== 'sentinela' ? (c.eventosEm || 15) : EV.primeiro[0] + sim.rand() * (EV.primeiro[1] - EV.primeiro[0]), sentT: c.eventosTeste === 'sentinela' ? (c.eventosEm || 15) : EV.sentinela[0] + sim.rand() * (EV.sentinela[1] - EV.sentinela[0]), sentFeita: false, sentId: 0, ultimo: -999, ultimoTipo: null, seq: 0, at: null, teste: c.eventosTeste || null }; }
}
function criarCacada(sim, cac) {
  const s = S(); fendaDe(sim); const D = CAC_DIF[cac.dif] || CAC_DIF.normal;
  const time = sim.players.filter(p => !p.fenda);
  for (const p of time) { for (const k in D.res) p.res[k] += D.res[k]; if (!p.human) p.difficulty = D.aliado; }
  for (let i = 0; i < time.length; i++) for (let j = i + 1; j < time.length; j++) { const a = time[i], b = time[j]; const pact = { a: a.id, b: b.id, until: 1e9, since: 0, caucao: 0, caucaoA: 0, caucaoB: 0, fixo: true }; a.pacts[b.id] = pact; b.pacts[a.id] = pact; } /* o time inteiro do mesmo lado (pacto fixo: não vence nem quebra) */
  sim.maxTime = CAC_LIMITE;
  const u = (sim.chefes && sim.chefes.cacada != null && sim.byId.get(sim.chefes.cacada)) || s.spawnBoss(sim, cac.chefe, s.CX, s.CY, { dif: cac.dif, cacada: true }); /* 5.0g junção: o createSim (ARD.chefesSim.inicio) já pôs o chefão na arena; ele nasce uma vez só */
  sim.modos.cac = { chefe: cac.chefe, dif: cac.dif, bossId: u ? u.id : 0, fim: null, tempo: 0, perdas: 0, captura: false };
}

/* ---------- passo (no fim do step, antes da poda: quem morreu neste passo ainda está em sim.byId com o lastHitBy) ---------- */
function passo(sim, dt) {
  const M = sim.modos; if (!M) return;
  if (M.mut.escassos) for (const ev of sim.events) if (ev.t === 'vein') for (const e of sim.ents) if (e.alive && e.kind === 'node' && !e.esc && e.amount === e.max && S().dist(e.x, e.y, ev.x, ev.y) < 90) { e.amount = e.max = Math.round(e.amount * MUTADORES.escassos.nos); e.esc = 1; } /* veio novo também pela metade */
  if (M.cac) passoCacada(sim);
  if (M.ev) passoEventos(sim, dt);
}
function perdasTime(sim) { let n = 0; for (const p of sim.players) if (!p.fenda) n += p.stats.unitsLost; return n; }
function passoCacada(sim) {
  const C = sim.modos.cac; if (C.fim || !C.bossId) return; const b = sim.byId.get(C.bossId);
  if (b && ((b.boss && b.boss.capturado) || (b.alive && b.owner !== sim.fenda))) C.captura = true; /* recompensa B da Forja-Mãe: o g-sim marca a captura em e.boss.capturado (o progresso é e.boss.capturaT) */
  if (!b || !b.alive || C.captura) { C.fim = 'vitoria'; C.tempo = sim.time; C.perdas = perdasTime(sim); }
}
/* fim da partida da Caçada (chamado pelo checkEnd): vitória ao derrubar o chefão, derrota sem Núcleo (todos no cooperativo) ou no limite de tempo */
function fim(sim) {
  const M = sim.modos; if (!M || !M.cac) return false; if (sim.result) return true; const C = M.cac; const s = S();
  const time = sim.players.filter(p => !p.fenda); const humanos = time.filter(p => p.human); const quem = humanos.length ? humanos : time;
  const scores = time.map(p => ({ id: p.id, name: p.name, score: p.alive ? s.score(sim, p) : 0, alive: p.alive }));
  let outcome = null, reason = '';
  if (C.fim === 'vitoria') { outcome = 'victory'; reason = C.captura ? 'A Forja-Mãe foi capturada: Caçada vencida.' : 'O chefão caiu: Caçada vencida.'; }
  else if (!quem.some(p => p.alive)) { outcome = 'defeat'; reason = quem.length > 1 ? 'Todos os Núcleos do time caíram.' : 'Seu Núcleo foi destruído.'; }
  else if (sim.time >= sim.maxTime) { outcome = 'defeat'; reason = 'O tempo da Caçada acabou: o chefão resistiu.'; }
  if (!outcome) return true;
  const tempo = outcome === 'victory' ? C.tempo : sim.time, perdas = outcome === 'victory' ? C.perdas : perdasTime(sim);
  sim.result = { outcome, reason, scores, cacada: { chefe: C.chefe, dif: C.dif, tempo: Math.round(tempo), perdas, medalha: outcome === 'victory' ? medalha(tempo, perdas) : null, captura: !!C.captura } };
  emit(sim, { t: 'end', result: sim.result }); return true;
}
function medalha(tempo, perdas) { return tempo <= MEDALHAS.ouro.t && perdas <= MEDALHAS.ouro.perdas ? 'ouro' : tempo <= MEDALHAS.prata.t && perdas <= MEDALHAS.prata.perdas ? 'prata' : 'bronze'; }

/* ---------- Eventos da Fenda ---------- */
function pontoChao(sim, a, raios, longe) { /* ponto de chão firme no ângulo a (tenta os raios em ordem), longe dos Núcleos */
  const s = S(); const nucs = sim.ents.filter(e => e.alive && e.kind === 'building' && e.def === 'nucleo');
  for (const r of raios) { const x = cl(s.CX + s.DM.cos(a) * r, 80, s.WORLD - 80), y = cl(s.CY + s.DM.sin(a) * r, 80, s.WORLD - 80);
    if (!s.groundAt(sim, x, y) || sim.nav.blocked[s.navIdx(x, y)] || s.dist(x, y, s.CX, s.CY) < s.RIFT_R + 80) continue;
    if (longe && nucs.some(n => s.dist(x, y, n.x, n.y) < longe)) continue; return { x, y }; }
  return null;
}
function anuncia(sim, tipo, fase, x, y, extra) { emit(sim, Object.assign({ t: 'evento', ev: tipo, fase, x, y }, extra || {})); }
function passoEventos(sim, dt) {
  const s = S(); const E = sim.modos.ev; const t = sim.time;
  /* Sentinela: entre 12 e 15 min (o momento veio do RNG), respeitando o intervalo entre eventos */
  if (!E.sentFeita && !E.at && t >= E.sentT && t - E.ultimo >= EV.intervalo) { E.at = { tipo: 'sentinela', fase: 'aviso', t0: t, x: s.CX, y: s.CY, ids: [] }; E.ultimo = t; E.seq++; anuncia(sim, 'sentinela', 'aviso', s.CX, s.CY); alertaTodos(sim, 'A Sentinela da Fenda está despertando no centro do mapa (' + EV.aviso + ' s)', s.CX, s.CY, 'warn'); }
  else if (!E.at && t >= E.prox && t - E.ultimo >= EV.intervalo && (E.sentFeita || E.sentT - t >= EV.intervalo)) iniciaMenor(sim, E); /* evento menor só se a Sentinela não vier nos próximos 3 min (ela sai sempre entre 12 e 15 min) */
  const A = E.at; if (!A) { vigiaSentinela(sim, E); return; }
  if (A.fase === 'aviso' && t - A.t0 >= EV.aviso) { A.fase = 'chega'; A.t1 = t; chega(sim, E, A); }
  else if (A.fase === 'chega') segue(sim, E, A, dt);
  vigiaSentinela(sim, E);
}
function iniciaMenor(sim, E) {
  const s = S(); const t = sim.time; let tipo = E.teste && E.seq === 0 ? E.teste : null;
  if (!tipo) { const op = EV.menores.filter(k => k !== E.ultimoTipo); tipo = op[Math.floor(sim.rand() * op.length) % op.length]; }
  const a = sim.rand() * Math.PI * 2; let p = tipo === 'meteoros' ? { x: s.CX + s.DM.cos(a) * 700, y: s.CY + s.DM.sin(a) * 700 } : pontoChao(sim, a, [1450, 1350, 1200, 1000, 800, 740], 420) || pontoChao(sim, a + Math.PI / 2, [1450, 1200, 900, 740], 300);
  if (!p) { E.prox = t + 30; return; } /* nenhum ponto bom agora: tenta de novo em 30 s */
  E.at = { tipo, fase: 'aviso', t0: t, x: p.x, y: p.y, a, ids: [], met: [] }; E.ultimo = t; E.ultimoTipo = tipo; E.seq++; E.prox = t + EV.intervalo + sim.rand() * 90;
  anuncia(sim, tipo, 'aviso', p.x, p.y);
  alertaTodos(sim, { caravana: 'Caravana Corsária à vista: ela vai cruzar o mapa (' + EV.aviso + ' s)', enxame: 'Enxame Errante se aproximando (' + EV.aviso + ' s)', meteoros: 'Chuva de meteoros em ' + EV.aviso + ' s: fique longe dos anéis no chão' }[tipo], p.x, p.y, 'warn');
}
function chega(sim, E, A) {
  const s = S(); const f = fendaDe(sim);
  if (A.tipo === 'sentinela') { const u = s.spawnBoss(sim, 'sentinela', s.CX, s.CY, { dif: 'normal', evento: true }); E.sentFeita = true; E.sentId = u ? u.id : 0; E.at = null; anuncia(sim, 'sentinela', 'chega', s.CX, s.CY, { id: E.sentId }); alertaTodos(sim, 'A Sentinela da Fenda despertou no centro! Quem der o golpe final leva a recompensa', s.CX, s.CY, 'danger'); return; }
  if (A.tipo === 'caravana') {
    const b = pontoChao(sim, A.a + Math.PI, [1450, 1350, 1200, 1000, 800, 740], 420) || pontoChao(sim, A.a + Math.PI * 0.75, [1450, 1200, 900, 740], 300) || { x: s.WORLD - A.x, y: s.WORLD - A.y };
    A.bx = b.x; A.by = b.y;
    for (let k = 0; k < CARAVANA.n; k++) { const ox = A.x + s.DM.cos(A.a + Math.PI / 2) * (k - 1) * 34, oy = A.y + s.DM.sin(A.a + Math.PI / 2) * (k - 1) * 34; const u = s.spawnUnit(sim, f, CARAVANA.def, s.groundAt(sim, ox, oy) ? ox : A.x, s.groundAt(sim, ox, oy) ? oy : A.y); if (!u) continue;
      u.maxHp = u.hp = CARAVANA.vida; u.speed = CARAVANA.vel; u.carga = Object.assign({}, CARAVANA.carga); u.evento = 'caravana'; u.state = 'move'; u.tx = A.bx; u.ty = A.by; u.gx = A.bx; u.gy = A.by; A.ids.push(u.id); }
    anuncia(sim, 'caravana', 'chega', A.x, A.y, { x2: A.bx, y2: A.by }); alertaTodos(sim, 'A Caravana Corsária está cruzando o mapa. Quem a destruir fica com a carga', A.x, A.y, 'info'); return; }
  if (A.tipo === 'enxame') {
    for (let k = 0; k < ENXAME.n; k++) { const ang = k * Math.PI * 2 / ENXAME.n, ox = A.x + s.DM.cos(ang) * 40, oy = A.y + s.DM.sin(ang) * 40; const u = s.spawnUnit(sim, f, ENXAME.def, s.groundAt(sim, ox, oy) ? ox : A.x, s.groundAt(sim, ox, oy) ? oy : A.y); if (!u) continue;
      u.maxHp = u.hp = ENXAME.vida; u.tempUntil = sim.time + ENXAME.dur; u.evento = 'enxame'; A.ids.push(u.id); }
    A.alvoT = -99; anuncia(sim, 'enxame', 'chega', A.x, A.y); alertaTodos(sim, 'O Enxame Errante chegou: ele ataca o que estiver mais perto', A.x, A.y, 'danger'); return; }
  if (A.tipo === 'meteoros') { A.prox = sim.time; A.caidos = 0; anuncia(sim, 'meteoros', 'chega', A.x, A.y); alertaTodos(sim, 'Chuva de meteoros! Cristais novos onde eles caem', A.x, A.y, 'danger'); }
}
function segue(sim, E, A, dt) {
  const s = S(); const t = sim.time; const f = sim.fenda;
  if (A.tipo === 'caravana') {
    let vivos = 0;
    for (let i = A.ids.length - 1; i >= 0; i--) { const u = sim.byId.get(A.ids[i]);
      if (!u || !u.alive) { if (u && u.carga) premiaCarga(sim, u); A.ids.splice(i, 1); continue; }
      vivos++; if (s.dist(u.x, u.y, A.bx, A.by) < 60 || t - A.t1 > CARAVANA.dur) { u.alive = false; u.carga = null; A.ids.splice(i, 1); vivos--; continue; } /* chegou do outro lado (ou passou do tempo): sai do mapa com a carga */
      if (u.state === 'idle' && sim.tick % 10 === u.id % 10) { u.state = 'move'; u.tx = A.bx; u.ty = A.by; u.stuck = 0; u.stk = 0; } }
    if (!vivos) { anuncia(sim, 'caravana', 'fim', A.bx, A.by); E.at = null; } return; }
  if (A.tipo === 'enxame') {
    let vivos = 0, cx = 0, cy = 0; for (const id of A.ids) { const u = sim.byId.get(id); if (u && u.alive) { vivos++; cx += u.x; cy += u.y; } }
    if (!vivos) { anuncia(sim, 'enxame', 'fim', A.x, A.y); E.at = null; return; }
    if (sim.tick - (A.alvoK || 0) >= ENXAME.alvoCada) { A.alvoK = sim.tick; cx /= vivos; cy /= vivos; let best = null, bd = Infinity;
      for (const e of sim.ents) { if (!e.alive || e.owner < 0 || e.owner === f || (e.kind !== 'unit' && e.kind !== 'building')) continue; if (e.kind === 'unit' && s.UNITS[e.def].flying) continue; const d = s.dist(cx, cy, e.x, e.y); if (d < bd) { bd = d; best = e; } }
      if (best) for (const id of A.ids) { const u = sim.byId.get(id); if (u && u.alive && (u.state === 'idle' || u.state === 'attackmove' || u.state === 'move')) { u.state = 'attackmove'; u.tx = best.x; u.ty = best.y; u.gx = best.x; u.gy = best.y; u.stuck = 0; u.stk = 0; } } }
    return; }
  if (A.tipo === 'meteoros') {
    const av = avisos(sim);
    if (A.caidos + A.met.length < METEOROS.n && t >= A.prox) { A.prox = t + METEOROS.cada; for (let k = 0; k < 12; k++) { const a = sim.rand() * Math.PI * 2, r = 260 + sim.rand() * 1100; const x = cl(s.CX + s.DM.cos(a) * r, 120, s.WORLD - 120), y = cl(s.CY + s.DM.sin(a) * r, 120, s.WORLD - 120);
        if (!s.groundAt(sim, x, y) || s.dist(x, y, s.CX, s.CY) < s.RIFT_R + METEOROS.r) continue; const id = sim.nextId++; const w = { id, tipo: 'anel', x, y, r: METEOROS.r, x2: x, y2: y, w: 0, t0: t, t1: t + METEOROS.aviso, dono: f, fonte: 'meteoro' };
        av.push(w); A.met.push({ id, x, y, t1: w.t1 }); emit(sim, { t: 'aviso', id, tipo: 'anel', x, y }); break; } }
    for (let i = A.met.length - 1; i >= 0; i--) { const m = A.met[i]; if (t < m.t1) continue; A.met.splice(i, 1); A.caidos++; cai(sim, m); const k = av.findIndex(w => w.id === m.id); if (k >= 0) av.splice(k, 1); }
    if (A.caidos >= METEOROS.n && !A.met.length) { anuncia(sim, 'meteoros', 'fim', A.x, A.y); E.at = null; }
  }
}
function cai(sim, m) { /* o meteoro cai: dano em área para todos e um cristal novo no ponto */
  const s = S(); const R = METEOROS.r; const hit = [];
  for (const e of sim.ents) { if (!e.alive || (e.kind !== 'unit' && e.kind !== 'building') || e.owner < 0) continue; if (e.kind === 'unit' && s.UNITS[e.def].flying) continue; const d = s.dist(m.x, m.y, e.x, e.y) - (e.r || 0); if (d <= R) hit.push([e, d]); }
  for (const [e, d] of hit) if (e.alive) s.applyDamage(sim, sim.fenda, null, e, METEOROS.dano * (d <= 0 ? 1 : 1 - d / R * 0.6), null);
  emit(sim, { t: 'impact', x: m.x, y: m.y, weapon: 'catedral', splash: R, hit: hit.length > 0, owner: sim.fenda, meteoro: true });
  let livre = !sim.nav.blocked[s.navIdx(m.x, m.y)] && s.mapCell(sim, m.x, m.y) === 1; if (livre) for (const e of sim.ents) if (e.alive && (e.kind === 'node' || e.kind === 'building' || e.kind === 'rock') && s.dist(m.x, m.y, e.x, e.y) < e.r + 40) { livre = false; break; }
  if (livre) { const amt = Math.round(METEOROS.cristal * (sim.modos.mut.escassos ? MUTADORES.escassos.nos : 1)); const n = s.addNode(sim, sim.rand() < 0.5 ? 'dados' : 'plasma', m.x, m.y, amt); n.esc = 1; n.meteoro = 1; }
}
function premiaCarga(sim, u) { /* a carga vai para quem destruiu o carro (o último a acertar) */
  const k = u.lastHitBy; const p = k != null && k >= 0 ? sim.players[k] : null; const c = u.carga; u.carga = null; if (!p || p.fenda || !c) return;
  let tot = 0; for (const r in c) { p.res[r] += c[r]; p.stats.collected += c[r]; tot += c[r]; }
  emit(sim, { t: 'float', x: u.x, y: u.y, text: '+' + Math.round(tot), owner: p.id, kind: 'steal' });
  alertaTodos(sim, p.name + ' tomou uma carga da Caravana Corsária (+' + Math.round(tot) + ')', u.x, u.y, 'info');
}
function vigiaSentinela(sim, E) {
  if (!E.sentId) return; const u = sim.byId.get(E.sentId); if (u && u.alive) return;
  const k = u ? u.lastHitBy : -1; const p = k != null && k >= 0 ? sim.players[k] : null; const x = u ? u.x : S().CX, y = u ? u.y : S().CY; E.sentId = 0;
  anuncia(sim, 'sentinela', 'fim', x, y, { por: p && !p.fenda ? p.id : -1 });
  if (p && !p.fenda) { for (const r in SENTINELA_PREMIO) p.res[r] += SENTINELA_PREMIO[r]; p.stats.collected += SENTINELA_PREMIO.minerio + SENTINELA_PREMIO.plasma + SENTINELA_PREMIO.dados; p.sentinelas = (p.sentinelas || 0) + 1; emit(sim, { t: 'float', x, y, text: '+' + (SENTINELA_PREMIO.minerio + SENTINELA_PREMIO.plasma + SENTINELA_PREMIO.dados), owner: p.id, kind: 'gain' }); alertaTodos(sim, p.name + ' derrubou a Sentinela da Fenda e levou a recompensa', x, y, 'good'); }
}

/* ---------- ganchos chamados pelo src/sim.js ---------- */
function visao(sim, p) { return sim.modos.visao * (p && p.lente ? LENTE : 1); }                        /* sensorRadius */
function lento(sim) { return sim.modos.lento; }                                                          /* speedOf, dentro da Tempestade */
function destroco(sim) { return sim.modos.mut.escassos ? MUTADORES.escassos.destrocos : 1; }            /* kill: carcaça saqueável */
function tormenta(sim) { return sim.modos && sim.modos.mut.tempestades ? MUTADORES.tempestades.freq : 1; } /* updateStorm: intervalo até a próxima */
function noite(sim) { return !!(sim && sim.modos && sim.modos.mut.noite); }                              /* render e fotossíntese: a noite parada */
const HORA_NOITE = 375;                                                                                  /* meia-noite do ciclo de 750 s */
function hash(sim, mix) { const M = sim.modos; if (!M) return; const E = M.ev; mix(Math.round((M.visao + M.lento) * 1000));
  if (E) { mix(Math.round(E.prox * 10)); mix(Math.round(E.sentT * 10)); mix(E.seq); mix(E.sentId); mix(E.at ? E.at.ids.length * 16 + (E.at.met ? E.at.met.length : 0) + (E.at.fase === 'chega' ? 1000 : 0) : -1); }
  if (M.cac) { mix(M.cac.bossId); mix(M.cac.fim ? 1 : 0); } }
function snapshot(sim) { const s = S(); return sim.modos ? { modos: s.jsonSafe(sim.modos) } : null; } /* a Fenda, o sim.avisos e os chefões vão no snapshot do g-sim (snap.chefes) */
function restore(sim, snap) { const s = S(); if (!snap || !snap.modos) return; sim.modos = s.jsonBack(snap.modos); }
/* o resumo da partida para a interface (cartão da partida, salvamento e fim) */
function resumo(cfgOuSim) { const cfg = cfgOuSim && cfgOuSim.cfg ? cfgOuSim.cfg : cfgOuSim; const c = cfgDe(cfg); return { cacada: c.cacada || null, eventos: !!c.eventos, mutadores: c.mutadores || [], lente: !!(cfg && cfg.players && cfg.players.some(p => p && p.lente)) }; }

ARD.modos = { MUTADORES, MUT_IDS, CACADA, CAC_DIF, CAC_LIMITE, MEDALHAS, EV, CARAVANA, ENXAME, METEOROS, SENTINELA_PREMIO, LENTE, HORA_NOITE,
  cfgDe, ativo, criar, passo, fim, medalha, visao, lento, destroco, tormenta, noite, hash, snapshot, restore, resumo };
})(globalThis.ARD = globalThis.ARD || {});
