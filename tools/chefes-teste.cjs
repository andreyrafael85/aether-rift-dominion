// 5.0g — chefões na simulação, no Node (sem navegador): cada chefão passa pelas fases e cai diante de um exército de teste dentro do tempo-limite;
// a mesma partida dá o mesmo hash; salvar no meio da fase 2 e voltar segue idêntico; as partidas sem chefão dão o hash da base 5.0f (tools/chefes-ref.json);
// avisos com o mínimo de 1,5 s (2 s na Fácil); superarma tira no máximo 20%; a Fenda fica fora do placar; o Destroço do Titã fica conectado.
// Uso: node tools/chefes-teste.cjs [--json] [--rapido]
const path = require('path'); const root = path.resolve(__dirname, '..');
globalThis.ARD = {}; require(root + '/src/modos.js'); /* 5.0g junção: a regra da Caçada (g-modos) também roda aqui */ require(root + '/src/chefes-sim.js'); require(root + '/src/mundo.js'); require(root + '/src/unicas-sim.js'); /* 5.0h junção: carregado como no jogo (a IA 3.0 usa as únicas e os módulos) */ /* 5.0h */ require(root + '/src/sim.js'); require(root + '/src/ai.js'); require(root + '/tools/det-run.js');
const S = ARD.sim, AI = ARD.ai, CH = ARD.chefesSim; const JSONOUT = process.argv.includes('--json'), RAPIDO = process.argv.includes('--rapido'); const SO = (process.argv.find(a => a.startsWith('--so=')) || '').slice(5); /* --so=forja/capturar: só essa luta (desenvolvimento) */
const R = []; const log = (...a) => { if (!JSONOUT) console.log(...a); };
const ok = (nome, cond, info) => { R.push({ nome, ok: !!cond, info: info || '' }); log((cond ? 'OK   ' : 'FAIL ') + nome + (info ? ' · ' + info : '')); };
const ref = require(root + '/tools/chefes-ref.json'); const medidas = {};

// ---------- 1) partidas sem chefão: o hash de antes ----------
if (!SO) { const h = ARD_DET(7, 2000, { iaPerfil: 'nulo', soBase: true } /* 5.0h: com a IA de antes (perfil nulo); a referência é a da 5.0f refeita com o Vorag novo (tools/ia-ref.cjs; a 5.0f fica em casos5f) */).slice(0, ref.casos['7/2000'].n); let d = -1; for (let i = 0; i < h.length; i++) if (h[i] !== ref.casos['7/2000'].todos[i]) { d = i; break; }
  ok('sem chefão: hash igual à referência da IA de antes (7/2000, ' + h.length + ' amostras)', d < 0 && h.length === ref.casos['7/2000'].n, d < 0 ? h[h.length - 1] : 'diverge na amostra ' + d);
  if (!RAPIDO) { const c = ref.casos['11/4000']; const h2 = ARD_DET(11, 4000, { iaPerfil: 'nulo', soBase: true }); ok('sem chefão: hash igual à referência da IA de antes (11/4000)', h2[c.n - 1] === c.ultimo && h2[Math.floor(c.n / 3)] === c.meio, h2[c.n - 1]); }
  if (ref.ia3) { const c = ref.ia3['7/2000']; const h3 = ARD_DET(7, 2000, { soBase: true }); let d3 = -1; for (let i = 0; i < c.todos.length; i++) if (h3[i] !== c.todos[i]) { d3 = i; break; } /* 5.0h: a IA 3.0 (perfil do líder) muda o hash de propósito: a referência nova é a da 5.0h */
    ok('IA 3.0: hash igual ao da referência 5.0h (7/2000, ' + c.todos.length + ' amostras)', d3 < 0 && h3.length === c.todos.length, d3 < 0 ? h3[h3.length - 1] : 'diverge na amostra ' + d3); } }

// ---------- 2) a luta: exército de teste com roteiro sem estado (tudo derivado da simulação: serve para salvar e voltar) ----------
const ARMY = { veiculo: 26, infantaria: 18, drone: 8 };
function setup(tipo, o) { o = o || {};
  const players = [{ name: 'H', faction: 'vehnar', human: true }]; for (let i = 1; i < (o.humanos || 1); i++) players.push({ name: 'H' + i, faction: 'erevane', human: true });
  return { seed: o.seed || 42, players, minutes: 30, map: tipo === 'forja' ? 'tita' : 'fenda', mapV: 1, cacada: { chefe: tipo, dif: o.dif || 'normal' } }; }
function reforca(sim) { /* produção simulada: a cada 30 s o exército volta ao tamanho de teste, saindo do Núcleo */
  const n = S.nucleoOf(sim, 0); if (!n) return; const have = {}; for (const e of sim.ents) if (e.alive && e.owner === 0 && e.kind === 'unit') have[e.def] = (have[e.def] || 0) + 1;
  let k = 0; for (const def in ARMY) for (let i = have[def] || 0; i < ARMY[def]; i++, k++) { const a = sim.players[0].startAngle + Math.PI + (k % 12) * 0.2, d = 90 + (k / 12 | 0) * 22; S.spawnUnit(sim, 0, def, n.x + Math.cos(a) * d, n.y + Math.sin(a) * d); } }
function desvia(sim) { /* o jogador de teste lê a telegrafia: quem está dentro de um golpe avisado sai pela borda mais perto (um aviso por vez, no tique em que nasce) */
  for (const a of sim.avisos) { if (a.visto || !a.dano) continue; a.visto = 1; const R = a.tipo === 'poco' ? a.r : a.tipo === 'faixa' ? a.w * 0.5 : a.r;
    for (const e of sim.ents) { if (!e.alive || e.owner !== 0 || e.kind !== 'unit') continue; let px = a.x, py = a.y;
      if (a.tipo === 'faixa') { const vx = a.x2 - a.x, vy = a.y2 - a.y, L2 = vx * vx + vy * vy; let t = L2 ? ((e.x - a.x) * vx + (e.y - a.y) * vy) / L2 : 0; t = Math.max(0, Math.min(1, t)); px = a.x + vx * t; py = a.y + vy * t; }
      const dx = e.x - px, dy = e.y - py, d = Math.hypot(dx, dy) || 1; if (d > R + e.r) continue;
      S.enqueue(sim, { t: 'move', p: 0, ids: [e.id], x: Math.max(30, Math.min(S.WORLD - 30, px + dx / d * (R + 40))), y: Math.max(30, Math.min(S.WORLD - 30, py + dy / d * (R + 40))) }); e.desvio = sim.tick + Math.round((a.t1 - sim.time) / S.TICK) + 5; } } }
function roteiro(sim, modo) { /* ordens do exército de teste (1 por segundo) */
  if (sim.tick % 300 === 0) reforca(sim);
  desvia(sim);
  if (sim.tick % 10 !== 0) return; const b = S.bossOf(sim); if (!b) return; const B = b.boss;
  const army = sim.ents.filter(e => e.alive && e.owner === 0 && e.kind === 'unit' && S.UNITS[e.def].attack && !(e.desvio > sim.tick)); const ids = army.map(e => e.id); if (!ids.length) return;
  const partes = B.partes.map(id => sim.byId.get(id)).filter(e => e && e.alive);
  const cx = army.reduce((a, e) => a + e.x, 0) / army.length, cy = army.reduce((a, e) => a + e.y, 0) / army.length;
  const pertoDe = l => l.slice().sort((p, q) => S.dist(cx, cy, p.x, p.y) - S.dist(cx, cy, q.x, q.y) || p.id - q.id)[0];
  if (B.tipo === 'forja' && B.fase === 3 && modo === 'capturar') { /* só a infantaria cerca o núcleo; o resto recua; desvia do anel de calor */
    const inf = army.filter(e => e.def === 'infantaria'), outros = army.filter(e => e.def !== 'infantaria');
    const calor = sim.avisos.find(a => a.golpe === 'calor'); const raio = calor ? b.r + 260 : b.r + 50;
    inf.forEach((e, i) => { const a = i / inf.length * Math.PI * 2; S.enqueue(sim, { t: 'move', p: 0, ids: [e.id], x: b.x + Math.cos(a) * raio, y: b.y + Math.sin(a) * raio }); });
    if (outros.length) { const n = S.nucleoOf(sim, 0) || b, dx = n.x - b.x, dy = n.y - b.y, d = Math.hypot(dx, dy) || 1, ax = dx / d, ay = dy / d; /* recuam para longe do núcleo exposto (fora do alcance) */ S.enqueue(sim, { t: 'move', p: 0, ids: outros.map(e => e.id), x: Math.max(80, Math.min(S.WORLD - 80, b.x + ax * 700 - ay * 200)), y: Math.max(80, Math.min(S.WORLD - 80, b.y + ay * 700 + ax * 200)) }); }
    return; }
  let alvo = b; if (partes.length && ((B.tipo === 'arauto' && B.fase === 1) || (B.tipo === 'forja' && B.fase === 2))) alvo = pertoDe(partes);
  if (sim.vis[0].has(alvo.id) && S.dist(cx, cy, alvo.x, alvo.y) < 350) S.enqueue(sim, { t: 'attack', p: 0, ids, target: alvo.id });
  else S.enqueue(sim, { t: 'attackmove', p: 0, ids, x: alvo.x, y: alvo.y });
}
function luta(tipo, o) { o = o || {};
  const cfg = setup(tipo, o); const sim = S.createSim(cfg); reforca(sim);
  const st = { fases: new Set([1]), morreu: false, capturado: false, eventos: {}, avisoMin: 99, maxEnts: 0, ms: 0, ticks: 0, t: 0, recompensa: null };
  const lim = (o.min || 20) * 600; const t0 = process.hrtime.bigint();
  for (let i = 0; i < lim && !sim.result; i++) {
    roteiro(sim, o.modo); const ev = S.step(sim);
    for (const e of ev) { if (e.t === 'chefe') { st.eventos[e.ev] = (st.eventos[e.ev] || 0) + 1; if (e.ev === 'fase') st.fases.add(e.fase); if (e.ev === 'morre') { st.morreu = true; st.capturado = !!e.capturado; } if (e.ev === 'recompensa') st.recompensa = e.escolha || 'ok'; }
      if (e.t === 'aviso') st.avisoMin = Math.min(st.avisoMin, e.t1 - e.t0); }
    if (sim.tick % 20 === 0) { let n = 0; for (const e of sim.ents) if (e.alive && (e.kind === 'unit' || e.kind === 'building' || e.kind === 'proj')) n++; st.maxEnts = Math.max(st.maxEnts, n); }
    if (o.ate && o.ate(sim)) break;
  }
  st.ms = Number(process.hrtime.bigint() - t0) / 1e6; st.ticks = sim.tick; st.t = Math.round(sim.time); st.hash = S.hash(sim); st.sim = sim; st.result = sim.result; return st;
}
for (const [tipo, modo, n] of [['arauto', null, 3], ['forja', 'destruir', 3], ['forja', 'capturar', 3], ['sentinela', null, 1]]) { if (SO && SO !== tipo + (modo ? '/' + modo : '')) continue;
  const st = luta(tipo, { modo }); const fs = [...st.fases].sort().join(',');
  medidas[tipo + (modo ? '/' + modo : '')] = { t: st.t, msPorTique: +(st.ms / st.ticks).toFixed(3), maxEntidades: st.maxEnts, avisoMin: +st.avisoMin.toFixed(2), eventos: st.eventos };
  ok(tipo + (modo ? ' (' + modo + ')' : '') + ': passa pelas ' + n + ' fases e cai em até 20 min', st.fases.size === n && st.morreu && (modo !== 'capturar' || st.capturado) && (modo !== 'destruir' || !st.capturado) && st.result && st.result.outcome === 'victory',
    'fases ' + fs + ' · ' + (st.capturado ? 'capturada' : st.morreu ? 'caiu' : 'de pé') + ' aos ' + st.t + ' s · recompensa ' + st.recompensa + (st.result && st.result.outcome !== 'victory' ? ' · fim: ' + st.result.reason : '') + (st.sim.chefes && st.sim.byId.get(st.sim.chefes.lista[0]) ? ' · captura ' + st.sim.byId.get(st.sim.chefes.lista[0]).boss.capturaT.toFixed(1) : '') + ' · aviso mínimo ' + st.avisoMin.toFixed(1) + ' s · até ' + st.maxEnts + ' entidades · ' + (st.ms / st.ticks).toFixed(2) + ' ms/tique');
  ok(tipo + (modo ? ' (' + modo + ')' : '') + ': todo golpe forte avisado com 1,5 s ou mais', st.avisoMin >= 1.5 - 1e-9 && st.avisoMin < 99, st.avisoMin.toFixed(2) + ' s');
  if (tipo === 'arauto') { const st2 = luta(tipo, { modo }); ok('arauto: a mesma luta dá o mesmo hash', st2.hash === st.hash && st2.t === st.t, st.hash + ' / ' + st2.hash); }
}
if (SO) { console.log(JSON.stringify(medidas)); process.exit(0); }
// ---------- 3) salvar no meio da fase 2 e voltar: o mesmo hash depois de N tiques; e uma Sentinela de evento numa escaramuça de IAs ----------
for (const tipo of ['arauto', 'forja']) {
  const a = luta(tipo, { modo: 'destruir', ate: sim => { const b = S.bossOf(sim); return b && b.boss.fase === 2 && b.boss.faseT > 6; } });
  const sim = a.sim; const snap = JSON.parse(JSON.stringify(S.snapshot(sim))); const hs = [];
  for (let i = 0; i < 900 && !sim.result; i++) { roteiro(sim, 'destruir'); S.step(sim); if (sim.tick % 100 === 0) hs.push(S.hash(sim)); }
  const s2 = S.createSim(setup(tipo, {})); S.restore(s2, JSON.parse(JSON.stringify(snap))); const h2 = [];
  for (let i = 0; i < 900 && !s2.result; i++) { roteiro(s2, 'destruir'); S.step(s2); if (s2.tick % 100 === 0) h2.push(S.hash(s2)); }
  let d = -1; for (let i = 0; i < Math.max(hs.length, h2.length); i++) if (hs[i] !== h2[i]) { d = i; break; }
  ok(tipo + ': salvar na fase 2 e voltar segue idêntico (' + hs.length * 100 + ' tiques)', d < 0 && hs.length > 0 && s2.fenda === sim.fenda && S.hash(s2) === S.hash(sim), d < 0 ? hs[hs.length - 1] : 'diverge na amostra ' + d);
}
{ const cfg = { seed: 12, players: [{ name: 'A', faction: 'vehnar', difficulty: 'dificil' }, { name: 'B', faction: 'erevane', difficulty: 'dificil' }], minutes: 25, mapV: 1, eventos: true };
  const go = (sim, ais, n) => { const hs = []; for (let i = 0; i < n && !sim.result; i++) { if (sim.tick % 10 === 0) for (const a of ais) for (const c of AI.think(sim, a)) S.enqueue(sim, c); if (sim.tick === 600) S.spawnBoss(sim, 'sentinela', S.CX - 230, S.CY); S.step(sim); if (sim.tick % 100 === 0) hs.push(S.hash(sim)); } return hs; };
  const sim = S.createSim(cfg); const ais = sim.players.filter(p => !p.fenda).map(p => AI.create(p.id, p.difficulty)); go(sim, ais, 900);
  const snap = JSON.parse(JSON.stringify(S.snapshot(sim))); const aiSnap = JSON.parse(JSON.stringify(ais.map(AI.snapshot))); const hs = go(sim, ais, 1200);
  const s2 = S.createSim(cfg); S.restore(s2, snap); const h2 = go(s2, aiSnap.map(AI.restore), 1200); let d = -1; for (let i = 0; i < hs.length; i++) if (hs[i] !== h2[i]) { d = i; break; }
  ok('evento: Sentinela numa escaramuça de IAs, salvar e voltar segue idêntico (1200 tiques)', d < 0 && hs.length === h2.length && hs.length > 0, d < 0 ? hs[hs.length - 1] : 'diverge na amostra ' + d); }
// ---------- 4) avisos na Fácil (2 s), vida no cooperativo, superarma (20%), Fenda fora do placar, salvamento antigo ----------
{ const st = luta('sentinela', { dif: 'facil', min: 2 }); ok('Fácil: aviso mínimo de 2 s', st.avisoMin >= 2 - 1e-9 && st.avisoMin < 99, st.avisoMin.toFixed(2) + ' s'); }
{ const v = n => { const sim = S.createSim(setup('arauto', { humanos: n })); return S.bossOf(sim).maxHp; }; const v1 = v(1), v2 = v(2), v4 = v(4);
  ok('cooperativo: a vida acompanha os humanos (1, 2 e 4)', v2 === Math.round(v1 * 1.6) && v4 === Math.round(v1 * 2.8), v1 + ' · ' + v2 + ' · ' + v4); }
{ const sim = S.createSim({ seed: 9, players: [{ name: 'E', faction: 'erevane', human: true }, { name: 'X', faction: 'vorag', difficulty: 'normal' }], minutes: 30, mapV: 1, chefe: 'arauto' }); const b = S.bossOf(sim);
  for (const id of b.boss.partes) S.kill(sim, sim.byId.get(id), 0); const p = sim.players[0]; p.era = 3; p.res.dados += 2000; p.res.plasma += 2000; S.addBuilding(sim, 0, 'laboratorio', S.nucleoOf(sim, 0).x + 90, S.nucleoOf(sim, 0).y, true);
  S.step(sim); const h0 = b.hp; S.enqueue(sim, { t: 'super', p: 0 }); S.step(sim); const perda = (h0 - b.hp) / b.maxHp;
  ok('superarma fere o chefão, mas no máximo 20% da vida', perda > 0.05 && perda <= 0.2 + 1e-9, (perda * 100).toFixed(1) + '% (Blecaute)'); }
{ const cfg = { seed: 5, players: [{ name: 'A', faction: 'vehnar', difficulty: 'normal' }, { name: 'B', faction: 'tessara', difficulty: 'normal' }], minutes: 2, mapV: 1, eventos: true }; const sim = S.createSim(cfg);
  const ais = sim.players.filter(p => !p.fenda).map(p => AI.create(p.id, p.difficulty)); let spawned = false;
  for (let i = 0; i < 1300 && !sim.result; i++) { if (sim.tick % 10 === 0) for (const a of ais) for (const c of AI.think(sim, a)) S.enqueue(sim, c); if (sim.tick === 300) { S.spawnBoss(sim, 'sentinela', S.CX + 230, S.CY); spawned = true; } S.step(sim); }
  const r = sim.result; ok('eventos: a Fenda existe, mas fica fora do placar e do fim', spawned && sim.fenda === 2 && r && r.scores.length === 2 && !r.scores.some(s => s.id === sim.fenda), r ? r.reason + ' · ' + r.scores.length + ' no placar' : 'sem resultado'); }
{ const sim = S.createSim({ seed: 3, players: [{ name: 'A', faction: 'vorag', difficulty: 'normal' }, { name: 'B', faction: 'quorith', difficulty: 'normal' }], minutes: 25, mapV: 1 }); const ais = sim.players.map(p => AI.create(p.id, p.difficulty));
  for (let i = 0; i < 400; i++) { if (sim.tick % 10 === 0) for (const a of ais) for (const c of AI.think(sim, a)) S.enqueue(sim, c); S.step(sim); }
  const snap = JSON.parse(JSON.stringify(S.snapshot(sim))); delete snap.chefes; const s2 = S.createSim({ seed: 3, players: [{ name: 'A', faction: 'vorag', difficulty: 'normal' }, { name: 'B', faction: 'quorith', difficulty: 'normal' }], minutes: 25, mapV: 1 }); S.restore(s2, snap);
  ok('salvamento antigo (sem o campo chefes) abre igual', S.hash(s2) === S.hash(sim) && s2.fenda === -1 && Array.isArray(s2.avisos), S.hash(s2)); }
// ---------- 5) Destroço do Titã: carcaça, recursos e todos os Núcleos conectados (2 a 5 jogadores) ----------
{ const F = ['vehnar', 'erevane', 'tessara', 'quorith', 'vorag']; let bad = []; let info = [];
  for (let n = 1; n <= 5; n++) for (const seed of [1, 7, 42]) { const sim = S.createSim({ seed, players: F.slice(0, n).map((f, i) => ({ name: 'P' + i, faction: f, human: i === 0 })), minutes: 25, map: 'tita', mapV: 1 });
    const nucs = sim.players.map(p => S.nucleoOf(sim, p.id)).filter(Boolean); const ossos = sim.ents.filter(e => e.alive && e.osso); const cost = ossos.filter(e => e.osso === 1).length;
    const conn = S._int.connected(sim, nucs); if (!conn || cost < 40 || !sim.map.arena) bad.push(n + 'j/' + seed); if (seed === 7) info.push(n + 'j ' + ossos.length + ' peças'); }
  ok('Destroço do Titã: carcaça montada e Núcleos conectados (1 a 5 jogadores, 3 sementes)', !bad.length, bad.length ? 'falhou: ' + bad.join(', ') : info.join(' · ')); }
// ---------- 6) custo por tique: o tempo dentro do src/chefes-sim.js numa luta inteira, e uma escaramuça de 3 IAs com e sem a Sentinela (iguais até o evento) ----------
{ const W = ['passo', 'depois', 'unidade', 'dano', 'morte']; let acc = 0; const orig = {}; for (const k of W) { orig[k] = CH[k]; CH[k] = function () { const t0 = process.hrtime.bigint(); try { return orig[k].apply(this, arguments); } finally { acc += Number(process.hrtime.bigint() - t0) / 1e6; } }; }
  const st = luta('arauto', {}); for (const k of W) CH[k] = orig[k];
  medidas.lutaArauto = { msPorTique: +(st.ms / st.ticks).toFixed(3), msChefesPorTique: +(acc / st.ticks).toFixed(3), maxEntidades: st.maxEnts };
  const cus = chefe => { const sim = S.createSim({ seed: 21, players: [{ name: 'A', faction: 'vehnar', difficulty: 'dificil' }, { name: 'B', faction: 'vorag', difficulty: 'dificil' }, { name: 'C', faction: 'quorith', difficulty: 'dificil' }], minutes: 25, mapV: 1, eventos: true });
    const ais = sim.players.filter(p => !p.fenda).map(p => AI.create(p.id, p.difficulty)); let ms = 0, n = 0, maxE = 0; const N = RAPIDO ? 3000 : 6000, T0 = 2400;
    for (let i = 0; i < N && !sim.result; i++) { if (sim.tick % 10 === 0) for (const a of ais) for (const c of AI.think(sim, a)) S.enqueue(sim, c); if (chefe && sim.tick === T0) S.spawnBoss(sim, 'sentinela', S.CX + 230, S.CY);
      const t0 = process.hrtime.bigint(); S.step(sim); if (sim.tick > T0) { ms += Number(process.hrtime.bigint() - t0) / 1e6; n++; } if (sim.tick % 50 === 0) maxE = Math.max(maxE, sim.ents.filter(e => e.alive && e.kind !== 'node' && e.kind !== 'rock').length); }
    return { ms: ms / Math.max(1, n), maxE }; };
  const a = cus(false), b = cus(true); medidas.custo = { semChefe: +a.ms.toFixed(3), comSentinela: +b.ms.toFixed(3), maxEntSem: a.maxE, maxEntCom: b.maxE };
  ok('custo do passo medido', st.ticks > 0 && a.ms > 0 && b.ms > 0, 'luta do Arauto ' + (st.ms / st.ticks).toFixed(2) + ' ms/tique, dos quais ' + (acc / st.ticks).toFixed(3) + ' no src/chefes-sim.js · escaramuça de 3 IAs depois dos 4 min: sem evento ' + a.ms.toFixed(2) + ' ms/tique, com a Sentinela ' + b.ms.toFixed(2) + ' (até ' + b.maxE + ' entidades vivas)'); }

const nOk = R.filter(r => r.ok).length;
if (JSONOUT) console.log(JSON.stringify({ ok: nOk, total: R.length, falhas: R.filter(r => !r.ok).map(r => r.nome + ' · ' + r.info), medidas }));
else console.log('chefões: ' + nOk + ' ok, ' + (R.length - nOk) + ' falhas'); process.exit(nOk === R.length ? 0 : 1);
