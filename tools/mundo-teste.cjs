// 5.0h — testes do mundo neutro (portão de qualidade, item "mundo"): partida sem cfg.mundo idêntica à 5.0g (hash da base em tools/chefes-ref.json,
// fotografia sem campo novo), posições justas nos três mapas (distância de cada Núcleo à ruína mais perto) e alcançáveis, captura com infantaria
// parada, contestação e tomada, os quatro bônus (visão, Forja, Portal, Torre), contratação (custo, recarga, limite, alcance e fim do contrato),
// surto (renda dobrada só dentro do círculo e só no tempo), chuva de meteoros ligada ao surto, fauna (fuga, Guardião que defende e solta o bônus,
// enxame à noite que some de dia, teto por mapa), a IA de hoje sem alvo infinito, mesma partida = mesmo hash, salvar e voltar idêntico e o custo por tique.
// Uso: node tools/mundo-teste.cjs [--json]   (cada linha com OK/FAIL conta; a última é o JSON com --json)
const path = require('path'); const root = path.resolve(__dirname, '..'); const { performance } = require('perf_hooks');
globalThis.ARD = {}; require(root + '/src/modos.js'); require(root + '/src/chefes-sim.js'); require(root + '/src/mundo.js'); require(root + '/src/unicas-sim.js'); /* 5.0h junção */ require(root + '/src/sim.js'); require(root + '/src/ai.js'); require(root + '/tools/det-run.js');
const S = ARD.sim, AI = ARD.ai, MU = ARD.mundo; const JSONOUT = process.argv.includes('--json'); const res = []; const t00 = Date.now(); const medidas = {};
const ok = (nome, cond, info) => { res.push({ nome, ok: !!cond, info: info || '' }); if (!JSONOUT) console.log((cond ? 'OK   ' : 'FAIL ') + nome + (info ? ' · ' + info : '')); };
const P = n => ['vehnar', 'erevane', 'tessara', 'vorag'].slice(0, n).map((f, i) => ({ name: 'P' + i, faction: f, difficulty: 'normal', human: i === 0 }));
const novo = (o) => S.createSim(Object.assign({ seed: 9, players: P(2), minutes: 25, mapV: 1, mundo: true }, o || {}));
const passa = (sim, n, cada) => { const evs = []; for (let i = 0; i < n; i++) { const ev = S.step(sim); for (const e of ev) evs.push(e); if (cada) cada(sim); } return evs; };
const ruina = (sim, tipo, k) => sim.mundoSt.ruinas.map(id => sim.byId.get(id)).filter(e => e && e.ruina.tipo === tipo)[k || 0];
const perto = (sim, e, d, a) => ({ x: e.x + Math.cos(a || 0) * (e.r + d), y: e.y + Math.sin(a || 0) * (e.r + d) });
const tropa = (sim, pid, def, x, y) => { const u = S.spawnUnit(sim, pid, def, x, y); u.state = 'idle'; return u; };
const roundtrip = o => JSON.parse(JSON.stringify(o));

// 1) desligado: o hash da base (5.0g = 5.0f nas partidas sem chefão) e nada novo
{ const ref = require(root + '/tools/chefes-ref.json'); const c = ref.casos['7/2000']; const h = ARD_DET(7, 2000, { iaPerfil: 'nulo', soBase: true } /* 5.0h junção: com a IA de antes; a IA 3.0 tem a referência dela (ia3) */).slice(0, c.n); let d = -1; for (let i = 0; i < h.length; i++) if (h[i] !== c.todos[i]) { d = i; break; }
  ok('desligado: hash igual ao da base (7/2000, ' + h.length + ' amostras, com o mundo.js carregado)', d < 0 && h.length === c.n, d < 0 ? h[h.length - 1] : 'diverge na amostra ' + d);
  const sim = S.createSim({ seed: 31, players: P(3), minutes: 25, mapV: 1 }); for (let i = 0; i < 600; i++) S.step(sim); const snap = roundtrip(S.snapshot(sim));
  ok('desligado: sem jogador neutro, sem estado e fotografia sem campo novo', sim.mundo === -1 && !sim.mundoSt && !('surtos' in sim) && !('mundo' in snap) && sim.players.length === 3);
  ok('desligado: cfg.mundo vazia ou na Caçada não liga nada', !MU.cfgDe({ mundo: {} }).mundo && !MU.cfgDe({ mundo: true, cacada: { chefe: 'arauto' } }).mundo && MU.cfgDe({ mundo: 'fauna,surto' }).mundo.surto === true && MU.cfgDe({ mundo: 'fauna,surto' }).mundo.ruinas === false); }

// 2) posições justas e alcançáveis nos três mapas
{ const casos = [['fenda', 2], ['fenda', 3], ['fenda', 4], ['cinturao', 2], ['cinturao', 3], ['cinturao', 4], ['tita', 2], ['tita', 3]]; const L = [];
  for (const [map, n] of casos) for (const seed of [9, 42]) { const sim = S.createSim({ seed, players: P(n), minutes: 25, mapV: 1, map, mundo: true }); const j = MU.justica(sim).map(x => x.ruina); const mn = Math.min(...j), mx = Math.max(...j);
    const M = sim.mundoSt; const tipos = new Set(M.ruinas.map(id => sim.byId.get(id).ruina.tipo)); const port = M.portais.length; const fauna = sim.ents.filter(e => e.fauna);
    const cont = { pastador: 0, guardiao: 0 }; for (const e of fauna) cont[e.fauna.tipo]++;
    const ok1 = mx / mn <= 1.02 && tipos.size === 4 && port >= 2 && !!M.acamp && cont.pastador <= MU.LIMITE.pastador && cont.guardiao <= MU.LIMITE.guardiao && cont.guardiao === n;
    L.push(map + ' ' + n + 'p s' + seed + ': ' + mn + '–' + mx + (ok1 ? '' : ' (tipos ' + tipos.size + ', portais ' + port + ', guardiões ' + cont.guardiao + ')')); if (!ok1) L.bad = true;
    medidas['justica ' + map + ' ' + n + 'p s' + seed] = j; }
  ok('posições justas: distância de cada Núcleo à ruína mais perto igual (±2%) e as 4 ruínas, o par de Portais, o Acampamento e um Guardião por vaga', !L.bad, L.join(' · ')); }

// 3) captura, contestação e tomada
{ const sim = novo(); const e = ruina(sim, 'observatorio'); const a = perto(sim, e, 30, 0.3), b = perto(sim, e, 30, 2.5); const evs = [];
  { const pc = { a: 0, b: 1, until: 1e9, since: 0, caucao: 0, caucaoA: 0, caucaoB: 0, fixo: true }; sim.players[0].pacts[1] = pc; sim.players[1].pacts[0] = pc; } /* em pacto, para as infantarias não brigarem: contestar vale mesmo entre aliados */
  const u1 = tropa(sim, 0, 'infantaria', a.x, a.y); evs.push(...passa(sim, 100)); const meio = e.ruina.capT;
  evs.push(...passa(sim, 110)); ok('captura: 1 infantaria parada leva ~20 s', e.ruina.dono === 0 && meio > 8 && meio < 12 && evs.some(x => x.t === 'mundo' && x.ev === 'captura' && x.p === 0), 'dono ' + e.ruina.dono + ' · 10 s: ' + meio.toFixed(1));
  const longe = tropa(sim, 1, 'veiculo', e.x + 600, e.y); passa(sim, 2); const r0 = S.sensorRadius(sim, e);
  ok('Observatório: visão de 900 para o dono (vê o veículo inimigo a 600)', r0 === 900 && sim.vis[0].has(longe.id), 'raio ' + r0); longe.alive = false;
  const u2 = tropa(sim, 1, 'infantaria', b.x, b.y); passa(sim, 50); const c0 = e.ruina.capT; const t2 = tropa(sim, 0, 'infantaria', a.x + 6, a.y + 6); passa(sim, 50);
  ok('contestação: com infantaria dos dois lados a barra para', e.ruina.disputa && Math.abs(e.ruina.capT - c0) < 1e-9 && e.ruina.dono === 0, 'barra ' + e.ruina.capT.toFixed(2));
  u1.alive = false; t2.alive = false; const ev2 = passa(sim, 450);
  ok('tomada: sozinho, o outro tira a ruína (perde) e depois captura', e.ruina.dono === 1 && ev2.some(x => x.t === 'mundo' && x.ev === 'perde' && x.p === 0) && ev2.some(x => x.t === 'mundo' && x.ev === 'captura' && x.p === 1), 'dono ' + e.ruina.dono);
  const sim2 = novo(); const e2 = ruina(sim2, 'torre'); const q = perto(sim2, e2, 30, 1); const mv = tropa(sim2, 0, 'infantaria', q.x - 300, q.y); mv.state = 'move'; mv.tx = q.x + 200; mv.ty = q.y; passa(sim2, 30);
  ok('captura: infantaria andando não captura', e2.ruina.capT === 0 && e2.ruina.dono < 0); }

// 4) bônus: Torre de Éter, Forja Antiga e Portal
{ const sim = novo(); const t = ruina(sim, 'torre'); passa(sim, 3); const e0 = sim.players[0].energy.prod; t.ruina.dono = 0; t.ruina.capT = MU.CAP.t; passa(sim, 3);
  ok('Torre de Éter: +40 de energia para o dono', Math.abs(sim.players[0].energy.prod - e0 - 40) < 1e-6, (sim.players[0].energy.prod - e0).toFixed(1));
  const f = ruina(sim, 'forja'); const nuc = S.nucleoOf(sim, 0); const fab = S.addBuilding(sim, 0, 'fabrica', nuc.x + 120, nuc.y + 40, true); const p = sim.players[0]; p.era = 2; p.res.minerio = 5000; p.res.plasma = 5000;
  const custo = () => { const m0 = p.res.minerio; S.enqueue(sim, { t: 'produce', p: 0, id: fab.id, def: 'veiculo' }); passa(sim, 2); return m0 - p.res.minerio; };
  const sem = custo(); f.ruina.dono = 0; f.ruina.capT = MU.CAP.t; fab.queue.length = 0; const com = custo();
  ok('Forja Antiga: veículo 20% mais barato (e o cancelamento devolve o pago)', Math.abs(com - sem * 0.8) < 1e-6, sem + ' → ' + com);
  const m1 = p.res.minerio; S.enqueue(sim, { t: 'cancel', p: 0, id: fab.id, def: 'veiculo', all: true }); passa(sim, 1); ok('Forja Antiga: cancelar devolve exatamente o pago', Math.abs(p.res.minerio - m1 - com) < 1e-6, (p.res.minerio - m1).toFixed(1));
  const [pa, pb] = sim.mundoSt.portais.map(id => sim.byId.get(id)); const q = perto(sim, pa, 60, 0); const us = [0, 1, 2].map(i => tropa(sim, 0, 'infantaria', q.x + i * 10, q.y));
  S.enqueue(sim, { t: 'portal', p: 0, ids: us.map(u => u.id), id: pa.id }); passa(sim, 30); const negado = us.every(u => S.dist(u.x, u.y, pb.x, pb.y) > 300);
  pa.ruina.dono = 0; pa.ruina.capT = MU.CAP.t; const evs = []; S.enqueue(sim, { t: 'portal', p: 0, ids: us.map(u => u.id), id: pa.id }); evs.push(...passa(sim, 120));
  ok('Portal: sem a posse não leva; com a posse leva as unidades até a outra ponta', negado && us.every(u => S.dist(u.x, u.y, pb.x, pb.y) < pb.r + 80) && evs.filter(x => x.t === 'mundo' && x.ev === 'portal').length === 3, us.map(u => Math.round(S.dist(u.x, u.y, pb.x, pb.y))).join(',')); }

// 5) Irmandade Corsária: contratação
{ const sim = novo(); const ac = sim.byId.get(sim.mundoSt.acamp); const p = sim.players[0]; p.res.dados = 1000; const avisos = [];
  const pede = merc => { S.enqueue(sim, { t: 'contratar', p: 0, id: ac.id, merc }); const ev = passa(sim, 1); for (const e of ev) if (e.t === 'notice') avisos.push(e.text); return ev.find(e => e.t === 'mundo' && e.ev === 'contrato'); };
  const longe = pede('saqueador'); const a = S.nucleoOf(sim, 0); const ang = Math.atan2(a.y - ac.y, a.x - ac.x); const u = tropa(sim, 0, 'infantaria', ac.x + Math.cos(ang) * 420, ac.y + Math.sin(ang) * 420);
  const d0 = p.res.dados; const c1 = pede('artilheiro'); const merc = c1 && sim.byId.get(c1.id);
  ok('contratar: longe do Acampamento não; perto, paga em Dados e o mercenário sai da nave para o lado de quem contratou', !longe && !!merc && merc.def === 'merc_artilheiro' && merc.owner === 0 && d0 - p.res.dados === 140 && S.dist(merc.x, merc.y, a.x, a.y) < S.dist(ac.x, ac.y, a.x, a.y), avisos[0] || '');
  const c2 = pede('atirador'); passa(sim, 600); const c3 = pede('atirador'); passa(sim, 600); const c4 = pede('saqueador'); passa(sim, 600); const c5 = pede('saqueador');
  ok('contratar: recarga de 60 s e no máximo 3 mercenários ao mesmo tempo', !c2 && !!c3 && !!c4 && !c5 && sim.ents.filter(e => e.alive && e.merc && e.owner === 0).length === 3, avisos.slice(1).join(' | '));
  passa(sim, 3000 - 1800 + 20); ok('contratar: o contrato acaba em 5 min', !merc.alive && sim.ents.filter(e => e.alive && e.merc && e.owner === 0).length === 2); }

// 6) surto: renda dobrada só dentro e só no tempo; a chuva de meteoros ligada ao surto
{ const sim = novo(); const evs = passa(sim, 5200); const av = evs.find(e => e.t === 'mundo' && e.ev === 'surto' && e.fase === 'aviso'); const co = evs.find(e => e.t === 'mundo' && e.ev === 'surto' && e.fase === 'comeca');
  ok('surto: aviso 30 s antes, começa no tempo e dura 90 s', !!av && !!co && Math.abs(co.time - av.time - 30) < 0.15 && Math.abs(av.t1 - av.t0 - 90) < 1e-6 && Math.abs(av.time - 270) < 0.15, av ? 'aviso aos ' + av.time.toFixed(1) + ' s' : '');
  const met = evs.filter(e => e.t === 'evento' && e.ev === 'meteoros'); ok('surto: a chuva de meteoros da 5.0g vem junto (aviso, queda e fim, com a Fenda)', sim.fenda >= 0 && met.some(e => e.fase === 'aviso') && met.some(e => e.fase === 'chega') && met.some(e => e.fase === 'fim'), met.map(e => e.fase + '@' + Math.round(e.time)).join(','));
  const s2 = novo({ seed: 13 }); passa(s2, 3050); const z = s2.surtos[0]; const nd = S.addNode(s2, 'minerio', z.x, z.y, 3000), nf = S.addNode(s2, 'minerio', z.x + z.r + 400, z.y, 3000);
  const col = (n) => { const u = S.spawnUnit(s2, 0, 'coletor', n.x + 20, n.y); u.state = 'harvest'; u.node = n.id; return u; }; const ci = col(nd), cf = col(nf); passa(s2, 20);
  const dentro = ci.cargoTotal, fora = cf.cargoTotal, gasto = 3000 - nd.amount;
  ok('surto: dentro do círculo a coleta rende o dobro (o nó perde a metade), fora não', Math.abs(dentro - 2 * fora) < 1e-6 && Math.abs(gasto - dentro / 2) < 1e-6, 'dentro ' + dentro.toFixed(1) + ' · fora ' + fora.toFixed(1)); }

// 7) fauna
{ const sim = novo(); const pa = sim.ents.find(e => e.fauna && e.fauna.tipo === 'pastador'); const x0 = pa.x, y0 = pa.y; const u = tropa(sim, 0, 'infantaria', pa.x + 60, pa.y); passa(sim, 30);
  ok('Pastador: foge de quem chega perto', pa.fauna.est === 'foge' && S.dist(pa.x, pa.y, u.x, u.y) > 90, 'distância ' + Math.round(S.dist(pa.x, pa.y, u.x, u.y)));
  ok('Pastador: manso (não vira alvo automático nem ataca)', !pa.fauna.hostil && !S.UNITS.fauna_pastador.attack);
  const g = sim.ents.find(e => e.fauna && e.fauna.tipo === 'guardiao'); const no = sim.byId.get(g.fauna.no); const v = tropa(sim, 0, 'infantaria', no.x + 60, no.y + 60); passa(sim, 40);
  ok('Guardião: defende o nó (ataca quem chega perto) e fica hostil', g.fauna.est === 'ataca' && g.fauna.hostil && v.hp < v.maxHp, 'vida ' + Math.round(v.hp));
  ok('Guardião: nó rico (+400) fora da coleta automática enquanto ele vive', no.rico === 1 && no.max >= 1000 && MU.guardado(sim, no));
  const cx = sim.ents.filter(e => e.kind === 'crate').length; S.kill(sim, g, 0); passa(sim, 1); const cr = sim.ents.filter(e => e.alive && e.kind === 'crate'); const cg = cr.find(c => S.dist(c.x, c.y, g.x, g.y) < 5);
  ok('Guardião: caído, solta o bônus (caixa de 220 Minério + 110 Dados) e libera o nó', !!cg && cg.cargo.minerio === 220 && cg.cargo.dados === 110 && !MU.guardado(sim, no) && cr.length > cx);
  const s2 = novo({ seed: 5 }); let max = 0; const ev = passa(s2, 6000, s => { const n = s.ents.filter(e => e.alive && e.fauna && e.fauna.tipo === 'enxame').length; if (n > max) max = n; });
  const ch = ev.find(e => e.t === 'mundo' && e.ev === 'fauna' && e.tipo === 'enxame' && e.fase === 'chega'), pt = ev.find(e => e.t === 'mundo' && e.ev === 'fauna' && e.tipo === 'enxame' && e.fase === 'parte');
  ok('Enxame: sai à noite e some de dia (ciclo de 750 s), dentro do teto', !!ch && !!pt && ch.time > 180 && ch.time < 330 && pt.time > ch.time && max <= MU.LIMITE.enxame && max > 0, (ch ? 'sai ' + Math.round(ch.time) : '') + (pt ? ' · some ' + Math.round(pt.time) : '') + ' · até ' + max);
  const s3 = novo({ seed: 5, mutadores: ['noite'] }); passa(s3, 60); ok('Enxame: com a Noite Eterna sai logo', s3.ents.some(e => e.alive && e.fauna && e.fauna.tipo === 'enxame'));
  const s4 = novo({ players: P(4) }); let fmax = 0; passa(s4, 3000, s => { const n = s.ents.filter(e => e.alive && e.fauna).length; if (n > fmax) fmax = n; }); ok('fauna: teto por mapa (nunca um exército)', fmax <= MU.LIMITE.pastador + MU.LIMITE.guardiao + MU.LIMITE.enxame, 'máximo ' + fmax); }

// 8) a IA de hoje: sem alvo infinito nas ruínas nem no Acampamento, e a partida segue
{ for (const [map, n] of [['fenda', 3], ['cinturao', 3], ['tita', 2]]) { const sim = S.createSim({ seed: 17, players: P(n).map(p => Object.assign({}, p, { human: false })), minutes: 25, mapV: 1, map, mundo: true }); const ais = sim.players.filter(p => !p.fenda).map(p => AI.create(p.id, p.difficulty)); let mira = 0, mortes = 0;
    const neutros = new Set(sim.mundoSt.ruinas.concat([sim.mundoSt.acamp]));
    for (let t = 0; t < 9000 && !sim.result; t++) { if (sim.tick % 10 === 0) for (const a of ais) for (const c of AI.think(sim, a)) { if (c.target && neutros.has(c.target)) mira++; S.enqueue(sim, c); } for (const e of S.step(sim)) if (e.t === 'death' && e.kind === 'unit') mortes++; if (sim.tick % 50 === 0) for (const e of sim.ents) if (e.alive && e.kind === 'unit' && e.target && neutros.has(e.target)) mira++; }
    const conhecidas = ais.some(a => [...a.known.values()].some(k => k.owner === sim.mundo));
    ok('IA 3.0 com o mundo ligado (' + map + '): nenhuma ordem nem alvo em ruína ou Acampamento, e a partida anda', !mira && !conhecidas && mortes > 20, mortes + ' mortes em ' + Math.round(sim.time / 60) + ' min'); } }

// 9) determinismo: mesma partida, mesmo hash; salvar e voltar idêntico (com capturas, contratos, surto e fauna em andamento)
{ const joga = (seed, map, n, cb) => { const sim = S.createSim({ seed, players: P(n), minutes: 25, mapV: 1, map, mundo: true }); const ais = sim.players.filter(p => !p.fenda).map(p => AI.create(p.id, p.difficulty)); const hs = [];
    for (let t = 0; t < 3600; t++) { if (sim.tick % 10 === 0) for (const a of ais) for (const c of AI.think(sim, a)) S.enqueue(sim, c); if (cb) cb(sim, t); S.step(sim); if (sim.tick % 300 === 0) hs.push(S.hash(sim)); } return { sim, ais, hs }; };
  const mexe = (sim, t) => { if (t === 400) { const e = ruina(sim, 'forja'); const q = perto(sim, e, 30, 1); tropa(sim, 0, 'infantaria', q.x, q.y); tropa(sim, 0, 'infantaria', q.x + 8, q.y + 8); sim.players[0].res.dados += 500; const ac = sim.byId.get(sim.mundoSt.acamp); tropa(sim, 0, 'drone', ac.x + 250, ac.y); S.enqueue(sim, { t: 'contratar', p: 0, id: ac.id, merc: 'saqueador' }); } };
  for (const [map, n] of [['fenda', 3], ['cinturao', 3], ['tita', 2]]) { const a = joga(23, map, n, mexe), b = joga(23, map, n, mexe); ok('mesma partida, mesmo hash (' + map + ')', a.hs.join() === b.hs.join() && a.hs.length === 12, a.hs[a.hs.length - 1]); }
  const A = joga(29, 'fenda', 3, mexe); const snap = roundtrip(S.snapshot(A.sim)); const aiS = roundtrip(A.ais.map(AI.snapshot));
  const B = S.restore(S.createSim(roundtrip(A.sim.cfg)), snap); const bais = aiS.map(AI.restore); ok('salvar e voltar: fotografia com o mundo (jogador, ruínas, contratos e surtos)', B.mundo === A.sim.mundo && !!B.mundoSt && S.hash(B) === S.hash(A.sim) && !!snap.mundo);
  let igual = true; for (let t = 0; t < 1500; t++) { for (const [s, as] of [[A.sim, A.ais], [B, bais]]) { if (s.tick % 10 === 0) for (const a of as) for (const c of AI.think(s, a)) S.enqueue(s, c); S.step(s); } if (s0(A.sim) !== s0(B)) { igual = false; break; } }
  function s0(s) { return S.hash(s); }
  ok('salvar e voltar: 150 s depois segue idêntico', igual, S.hash(A.sim) + ' / ' + S.hash(B));
  const velho = roundtrip(S.snapshot(S.createSim({ seed: 3, players: P(2), minutes: 25, mapV: 1 }))); const V = S.restore(S.createSim({ seed: 3, players: P(2), minutes: 25, mapV: 1 }), velho); ok('salvamento sem mundo abre igual (sim.mundo = -1)', V.mundo === -1 && !V.mundoSt); }

// 10) custo por tique (mundo.js inteiro: passo e fauna) nos três mapas
{ let tm = 0; const orig = {}; for (const k of ['passo', 'unidade']) { orig[k] = MU[k]; MU[k] = function () { const t = performance.now(); const r = orig[k].apply(this, arguments); tm += performance.now() - t; return r; }; }
  const L = []; let pior = 0;
  for (const [map, n] of [['fenda', 3], ['cinturao', 3], ['tita', 2]]) { const sim = S.createSim({ seed: 21, players: P(n).map(p => Object.assign({}, p, { human: false })), minutes: 25, mapV: 1, map, mundo: true }); const ais = sim.players.filter(p => !p.fenda).map(p => AI.create(p.id, p.difficulty)); tm = 0; let ts = 0;
    for (let t = 0; t < 6000 && !sim.result; t++) { if (sim.tick % 10 === 0) for (const a of ais) for (const c of AI.think(sim, a)) S.enqueue(sim, c); const t0 = performance.now(); S.step(sim); ts += performance.now() - t0; }
    const mt = tm / sim.tick, st = ts / sim.tick; medidas['tique ' + map] = { mundo_ms: +mt.toFixed(4), passo_ms: +st.toFixed(3), parte: +(mt / st).toFixed(4) }; pior = Math.max(pior, mt / st); L.push(map + ' ' + mt.toFixed(3) + ' ms/tique (' + (100 * mt / st).toFixed(1) + '% do passo)'); }
  for (const k in orig) MU[k] = orig[k];
  ok('custo por tique do mundo neutro pequeno (abaixo de 6% do passo)', pior < 0.06, L.join(' · ')); }

const falhou = res.filter(r => !r.ok).map(r => r.nome);
if (!JSONOUT) console.log('mundo: ' + (res.length - falhou.length) + ' ok, ' + falhou.length + ' falhas · ' + Math.round((Date.now() - t00) / 1000) + ' s');
else console.log(JSON.stringify({ ok: res.length - falhou.length, falhas: falhou.length, total: res.length, falhou, medidas }));
process.exit(falhou.length ? 1 : 0);
