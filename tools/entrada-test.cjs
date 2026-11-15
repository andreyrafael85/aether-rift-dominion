// 5.5a — testes da porta de entrada, no Node (sem navegador): o modo Blitz (bases mais perto, bônus dos jogadores, a IA ataca cedo, a partida
// acaba em até 10 minutos, mesma partida = mesmo hash, salvar e voltar no meio segue idêntico, e sem cfg.blitz nada muda) e a primeira partida
// guiada (um robô cumpre os seis objetivos na ordem com as cinco Raças e vence em menos de 7 minutos; a mesma partida dá o mesmo hash; parada,
// a partida não acaba sozinha antes da hora).
// Uso: node tools/entrada-test.cjs [--json]   (cada linha com OK/FAIL conta; a última é o JSON com --json)
const path = require('path'); const root = path.resolve(__dirname, '..');
globalThis.ARD = {}; for (const f of ['modos', 'chefes-sim', 'mundo', 'unicas-sim', 'sim', 'ai', 'campaign', 'guia', 'fim']) require(root + '/src/' + f + '.js');
const S = ARD.sim, AI = ARD.ai, MO = ARD.modos, C = ARD.campaign, GU = ARD.guia;
const JSONOUT = process.argv.includes('--json'); const res = []; const t00 = Date.now();
const ok = (nome, cond, info) => { res.push({ nome, ok: !!cond, info: info || '' }); if (!JSONOUT) console.log((cond ? 'OK   ' : 'FAIL ') + nome + (info ? ' · ' + info : '')); };
const P2 = () => [{ name: 'A', faction: 'vehnar', difficulty: 'normal' }, { name: 'B', faction: 'tessara', difficulty: 'normal' }];
const distFenda = (sim, pid) => { const n = S.nucleoOf(sim, pid); return Math.round(S.dist(n.x, n.y, S.CX, S.CY)); };
const naBase = sim => sim.ents.some(e => e.alive && e.kind === 'building' && e.lastHitBy != null && e.lastHitBy >= 0 && e.lastHitBy !== e.owner); /* alguma construção já levou tiro de outro jogador: o primeiro ataque a uma base */
const G0 = {}; /* o "G" mínimo das amostras do gráfico */
function joga(cfg, n, cada) { const sim = S.createSim(cfg); G0.sim = sim; const ais = sim.players.filter(p => !p.fenda).map(p => AI.create(p.id, p.difficulty)); let primeiro = null;
  for (let t = 0; t < n && !sim.result; t++) { if (sim.tick % 10 === 0) for (const a of ais) for (const c of AI.think(sim, a)) S.enqueue(sim, c); S.step(sim); if (primeiro == null && sim.tick % 10 === 0 && naBase(sim)) primeiro = sim.time; if (cada) cada(sim, ais); }
  return { sim, ais, primeiro }; }
const cfgBlitz = seed => ({ seed, players: MO.blitzJogadores(P2()), minutes: MO.BLITZ.minutos, map: 'fenda', mapV: 1, blitz: true });
const cfgNormal = seed => ({ seed, players: P2(), minutes: 25, map: 'fenda', mapV: 1 });

/* ---------- Blitz ---------- */
{ const a = S.createSim(cfgNormal(11)), b = S.createSim(cfgBlitz(11));
  ok('sem Blitz: Núcleos a 1180 da Fenda', distFenda(a, 0) === 1180 && distFenda(a, 1) === 1180, distFenda(a, 0) + ' e ' + distFenda(a, 1));
  ok('Blitz: Núcleos a ' + MO.BLITZ.r0 + ' da Fenda (bases a ' + MO.BLITZ.r0 * 2 + ' uma da outra)', distFenda(b, 0) === MO.BLITZ.r0 && distFenda(b, 1) === MO.BLITZ.r0, distFenda(b, 0) + ' e ' + distFenda(b, 1));
  ok('Blitz: recursos iniciais e bônus dos jogadores', b.players.every(p => p.res.minerio === 500 + MO.BLITZ.res.minerio && p.res.plasma === 300 + MO.BLITZ.res.plasma && p.mods.harvestMul === MO.BLITZ.coleta && p.mods.prodMul === MO.BLITZ.producao), 'Minério ' + b.players[0].res.minerio + ', Plasma ' + b.players[0].res.plasma);
  ok('Blitz: relógio de ' + MO.BLITZ.minutos + ' minutos', b.maxTime === MO.BLITZ.minutos * 60, b.maxTime + ' s');
  ok('sem Blitz: jogadores sem bônus e relógio de 25 minutos', a.players.every(p => !p.mods) && a.maxTime === 1500);
  ok('Blitz não cria sim.modos (a partida continua sem modo)', b.modos === undefined && MO.cfgDe({ blitz: true }).blitz === true && MO.resumo({ blitz: true }).blitz === true);
  const j = MO.blitzJogadores(MO.blitzJogadores(P2())); ok('Blitz: os bônus não dobram na retomada (idempotente)', j[0].mods.startRes.minerio === MO.BLITZ.res.minerio && j[0].mods.harvestMul === MO.BLITZ.coleta); }
{ let fins = [], primeiros = [], hashes = [];
  for (const seed of [11, 23, 37]) { const r = joga(cfgBlitz(seed), 6100); fins.push(Math.round(r.sim.time)); primeiros.push(r.primeiro == null ? -1 : Math.round(r.primeiro)); hashes.push(S.hash(r.sim)); ok('Blitz IA × IA (semente ' + seed + ') acaba em até 10 minutos', !!r.sim.result && r.sim.time <= 600.05, 'fim aos ' + Math.round(r.sim.time) + ' s · ' + r.sim.result.reason + ' · primeiro ataque a uma base aos ' + (r.primeiro == null ? '—' : Math.round(r.primeiro) + ' s')); }
  const n = joga(cfgNormal(11), 6100); ok('Blitz: o primeiro ataque a uma base vem mais cedo que na partida normal', primeiros.every(t => t >= 0 && t < 360) && (n.primeiro == null || primeiros[0] < n.primeiro), 'Blitz ' + primeiros.join(', ') + ' s × normal ' + (n.primeiro == null ? 'nenhum em 10 min' : Math.round(n.primeiro) + ' s'));
  const r2 = joga(cfgBlitz(11), 6100); ok('Blitz: a mesma partida dá o mesmo hash', S.hash(r2.sim) === hashes[0], hashes[0] + ' × ' + S.hash(r2.sim)); }
{ /* salvar no meio e voltar: as duas cópias seguem idênticas */
  const a = joga(cfgBlitz(23), 1500); const snap = JSON.parse(JSON.stringify(S.snapshot(a.sim))); const mem = JSON.parse(JSON.stringify(a.ais.map(AI.snapshot))); const simCfg = JSON.parse(JSON.stringify(S.jsonSafe(a.sim.cfg)));
  const b = S.createSim(Object.assign({}, simCfg, MO.cfgDe(simCfg))); S.restore(b, snap); const aisB = mem.map(AI.restore); let igual = S.hash(a.sim) === S.hash(b); let n = 0;
  for (let t = 0; t < 900 && igual && !a.sim.result; t++) { for (const [sim, ais] of [[a.sim, a.ais], [b, aisB]]) { if (sim.tick % 10 === 0) for (const m of ais) for (const c of AI.think(sim, m)) S.enqueue(sim, c); S.step(sim); } if (a.sim.tick % 50 === 0) { n++; igual = S.hash(a.sim) === S.hash(b); } }
  ok('Blitz: salvar aos 150 s e voltar segue idêntico', igual && n >= 10 && b.cfg.blitz === true && distFenda(b, 0) === MO.BLITZ.r0, n + ' comparações · hash ' + S.hash(b)); }
{ const a = joga(cfgNormal(7), 600), b = joga(Object.assign(cfgNormal(7), { blitz: false }), 600); ok('sem cfg.blitz a partida é a de sempre (mesmo hash com e sem a chave desligada)', S.hash(a.sim) === S.hash(b.sim), String(S.hash(a.sim))); }

/* ---------- primeira partida guiada ---------- */
function lugar(sim, def) { const n = S.nucleoOf(sim, 0); const a0 = S.DM.atan2(S.CY - n.y, S.CX - n.x) + (def === 'quartel' ? 0.9 : -0.9); for (const d of [150, 180, 120, 210, 240]) for (const da of [0, 0.4, -0.4, 0.8, -0.8, 1.3, -1.3, 2, -2, 2.8]) { const x = n.x + S.DM.cos(a0 + da) * d, y = n.y + S.DM.sin(a0 + da) * d; if (S.canBuild(sim, 0, def, x, y).ok) return { x, y }; } return null; }
function guia(race, robo, maxS) { const prep = GU.preparar({ race }); const sim = S.createSim(prep.cfg); const run = C.start(sim, prep, null); const feito = {}; const fez = {}; let erro = null;
  const cmd = c => S.enqueue(sim, Object.assign({ p: 0 }, c)); const predio = def => sim.ents.find(e => e.alive && e.kind === 'building' && e.owner === 0 && e.def === def);
  try { for (let i = 0; i < maxS * 10 && !run.result; i++) {
    if (robo && sim.tick % 10 === 0) { const o = id => run.objectives.find(x => x.id === id).done; const nuc = S.nucleoOf(sim, 0);
      if (!o('coletores')) { if (!fez.col) { fez.col = 1; cmd({ t: 'produce', id: nuc.id, def: 'coletor', n: 2 }); } }
      else if (!o('reator')) { if (!predio('reator')) { const p = lugar(sim, 'reator'); if (p) cmd({ t: 'build', def: 'reator', x: p.x, y: p.y }); } }
      else if (!o('quartel')) { if (!predio('quartel')) { const p = lugar(sim, 'quartel'); if (p) cmd({ t: 'build', def: 'quartel', x: p.x, y: p.y }); } }
      else if (!o('tropa')) { const q = predio('quartel'); if (q && q.built && !fez.inf) { fez.inf = 1; cmd({ t: 'produce', id: q.id, def: 'infantaria', n: 4 }); } }
      else if (o('defesa') && !o('nucleo') && sim.tick % 50 === 0) { const en = S.nucleoOf(sim, 1); const ids = sim.ents.filter(e => e.alive && e.kind === 'unit' && e.owner === 0 && S.UNITS[e.def].attack).map(e => e.id); if (en && ids.length) cmd({ t: 'attackmove', ids, x: en.x, y: en.y }); } }
    const ev = S.step(sim); run.tick(ev); run.takeSaid(); for (const ob of run.objectives) if (ob.done && feito[ob.id] == null) feito[ob.id] = Math.round(sim.time); } } catch (e) { erro = e.stack.split('\n').slice(0, 2).join(' | '); }
  return { sim, run, feito, erro, prep }; }
{ const hashes = {};
  for (const race of ['vehnar', 'erevane', 'tessara', 'quorith', 'vorag']) { const g = guia(race, true, 420); const r = g.run.result; const ordem = GU.PASSOS.map(id => g.feito[id]); const crescente = ordem.every((t, i) => t != null && (i === 0 || t >= ordem[i - 1])); hashes[race] = S.hash(g.sim);
    ok('guiada (' + race + '): o robô cumpre os 6 objetivos na ordem e vence em menos de 7 minutos', !g.erro && r && r.won && crescente && g.sim.time < 420, g.erro || ((r ? (r.won ? 'venceu' : 'perdeu: ' + r.reason) : 'não acabou') + ' aos ' + Math.round(g.sim.time) + ' s · ' + GU.PASSOS.map((id, i) => id + ' ' + (ordem[i] == null ? '—' : ordem[i] + ' s')).join(', '))); }
  const g2 = guia('vehnar', true, 420); ok('guiada: a mesma partida dá o mesmo hash', S.hash(g2.sim) === hashes.vehnar, hashes.vehnar + ' × ' + S.hash(g2.sim));
  const g = guia('vehnar', true, 420); const sim = g.sim; ok('guiada: bases perto (como no Blitz), inimigo sem IA e sem bônus de Blitz no jogador', distFenda(S.createSim(g.prep.cfg), 0) === MO.BLITZ.r0 && g.prep.cfg.players[1].passive === true && !g.prep.cfg.players[0].mods.harvestMul, 'Núcleo a ' + distFenda(S.createSim(g.prep.cfg), 0));
  ok('guiada: o ataque do roteiro veio (3 unidades) e os reforços chegaram', g.run.ctx.st.ataque === true && g.run.ctx.st.reforco === true && Object.keys(g.run.ctx.waveIds).length === 3, Object.keys(g.run.ctx.waveIds).length + ' na onda');
  const p = guia('vehnar', false, 420); ok('guiada sem ninguém jogar: 7 minutos depois a partida continua de pé (nada ataca antes da tropa)', !p.erro && !p.run.result && !!S.nucleoOf(p.sim, 0) && p.sim.players[0].stats.unitsLost === 0, 't=' + Math.round(p.sim.time) + ' s');
  const f = guia('vehnar', false, GU.MINUTOS * 60 + 5); ok('guiada sem ninguém jogar: o relógio de ' + GU.MINUTOS + ' minutos fecha a partida sem erro', !f.erro && !!f.run.result && f.sim.time >= GU.MINUTOS * 60, f.erro || (f.run.result ? f.run.result.reason : 'não acabou')); }

/* ---------- tela final: as amostras do gráfico e "a virada" (funções puras do src/fim.js) ---------- */
{ const F = ARD.fim; const h = (eu, ini) => ({ t: eu.map((_, i) => i * 5), f: [eu, ini] });
  const v1 = F.virada(h([100, 120, 150, 200, 260, 300, 420, 700, 900, 1100], [100, 300, 500, 700, 800, 800, 600, 500, 300, 0]), 0, true);
  ok('virada: atrás por um bom tempo e depois à frente → o instante em que passou', !!v1 && v1.i === 7 && v1.t === 35, v1 ? 'aos ' + v1.t + ' s' : 'nenhuma');
  ok('virada: sempre à frente → não há virada', F.virada(h([100, 300, 500, 700, 900, 1100, 1300, 1500], [100, 150, 200, 250, 300, 300, 200, 0]), 0, true) === null);
  const v3 = F.virada(h([100, 400, 700, 900, 900, 800, 500, 300, 100, 0], [100, 200, 300, 400, 500, 800, 900, 1000, 1200, 1300]), 0, false);
  ok('virada na derrota: o instante em que o inimigo passou à frente', !!v3 && v3.i === 6, v3 ? 'aos ' + v3.t + ' s' : 'nenhuma');
  ok('virada: partida curta demais (menos de 6 amostras) → nada', F.virada(h([1, 2, 3], [3, 2, 1]), 0, true) === null);
  const r = joga(cfgBlitz(11), 1200, sim => { if (sim.tick % F.CADA === 0) F.amostra(G0); }); function nada() {} nada();
  ok('amostras do gráfico: uma a cada 5 s de jogo, por jogador', G0.hist && G0.hist.t.length === Math.floor(r.sim.time / 5) && G0.hist.f.length === 2 && G0.hist.f[0].length === G0.hist.t.length, (G0.hist ? G0.hist.t.length : 0) + ' amostras em ' + Math.round(r.sim.time) + ' s');
  const ns = F.numeros(r.sim, 0); ok('os três números da partida saem das estatísticas do jogador', ns.length === 3 && ns[0].k === 'abatidas' && (ns[1].k === 'dominio' || ns[1].k === 'estruturas') && (ns[2].k === 'coletados' || ns[2].k === 'roubados'), ns.map(n => n.k + ' ' + n.v).join(' · ')); }

const bad = res.filter(r => !r.ok).length;
if (JSONOUT) console.log(JSON.stringify({ ok: res.length - bad, falhas: bad, total: res.length, falhou: res.filter(r => !r.ok).map(r => r.nome), s: Math.round((Date.now() - t00) / 1000) })); /* o mesmo formato do tools/modos-test.cjs */
else console.log('entrada: ' + (res.length - bad) + ' ok, ' + bad + ' falhas · ' + Math.round((Date.now() - t00) / 1000) + ' s');
process.exit(bad ? 1 : 0);
