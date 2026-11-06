// 5.0h — testes da IA 3.0 (src/ai.js) no Node: perfil por líder (campanha e ?perfil=nulo com a IA de antes), contra-composição por unidade e por
// habilidade, desvio da telegrafia, pedidos à IA aliada (comando 'pedido' pela fila), falas com recarga e fora do hash, salvar e voltar (com o estado
// novo e com um salvamento antigo, sem perfil) e os ganchos para ruínas, mercenários, módulos, construções únicas e comandantes, com o código real (src/mundo.js e src/unicas-sim.js; 5.0h junção).
// Uso: node tools/ia-teste.cjs [--json]
const path = require('path'); const root = path.resolve(__dirname, '..');
globalThis.ARD = {}; require(root + '/src/modos.js'); require(root + '/src/chefes-sim.js'); require(root + '/src/mundo.js'); require(root + '/src/unicas-sim.js'); /* 5.0h junção */ require(root + '/src/sim.js'); require(root + '/src/ai.js'); require(root + '/src/campaign.js');
const S = ARD.sim, AI = ARD.ai, C = ARD.campaign; const JSONOUT = process.argv.includes('--json'), RAP = process.argv.includes('--rapido'); /* --rapido: partidas mais curtas (portão de qualidade) */ const res = []; const fs = require('fs');
const ok = (nome, cond, info) => { res.push({ nome, ok: !!cond, info }); if (!JSONOUT) console.log((cond ? 'OK   ' : 'FAIL ') + nome + (info != null ? ' · ' + info : '')); };
const P2 = [{ name: 'A', faction: 'vehnar', difficulty: 'normal' }, { name: 'B', faction: 'vorag', difficulty: 'normal' }];
const joga = (sim, ais, n, cada) => { for (let i = 0; i < n && !sim.result; i++) { if (sim.tick % 10 === 0) for (const a of ais) for (const c of AI.think(sim, a)) S.enqueue(sim, c); if (cada) cada(sim); S.step(sim); } };

// 1) perfil: escaramuça = líder da Raça; campanha e ?perfil=nulo = a IA de antes; ?perfil=<Raça> vale para todas
{ const sim = S.createSim({ seed: 3, players: P2, minutes: 25 }); const ais = sim.players.map(p => AI.create(p.id, 'normal')); joga(sim, ais, 20);
  ok('perfil por líder na escaramuça', ais[0].perfil === 'vehnar' && ais[1].perfil === 'vorag', ais.map(a => a.perfil).join(','));
  const prep = C.prepare(C.MISSIONS[2].id, { difficulty: 'normal' }); const s2 = S.createSim(prep.cfg); const a2 = s2.players.filter(p => !prep.cfg.players[p.id].passive).map(p => AI.create(p.id, p.difficulty)); joga(s2, a2, 20);
  ok('campanha: perfil nulo (a IA de antes)', a2.every(a => a.perfil === null && !a.v3), a2.map(a => a.perfil).join(','));
  const s3 = S.createSim({ seed: 3, players: P2, minutes: 25, iaPerfil: 'nulo' }); const a3 = s3.players.map(p => AI.create(p.id, 'normal')); joga(s3, a3, 20);
  const s4 = S.createSim({ seed: 3, players: P2, minutes: 25, iaPerfil: 'quorith' }); const a4 = s4.players.map(p => AI.create(p.id, 'normal')); joga(s4, a4, 20);
  ok('?perfil=nulo e ?perfil=quorith', a3.every(a => a.perfil === null) && a4.every(a => a.perfil === 'quorith'), a3.map(a => a.perfil).join(',') + ' / ' + a4.map(a => a.perfil).join(',')); }
// 2) a IA de antes intacta: com perfil nulo, a partida dá o hash da base (tools/chefes-ref.json, medido na 5.0f/5.0g sem chefão)
{ require(root + '/tools/det-run.js'); const ref = require(root + '/tools/chefes-ref.json'); const h = ARD_DET(7, 2000, { iaPerfil: 'nulo', soBase: true }).slice(0, ref.casos['7/2000'].n); let d = -1; for (let i = 0; i < h.length; i++) if (h[i] !== ref.casos['7/2000'].todos[i]) { d = i; break; }
  ok('perfil nulo: hash igual ao da base (7/2000)', d < 0 && h.length === ref.casos['7/2000'].n, d < 0 ? h[h.length - 1] : 'diverge na amostra ' + d); }
// 3) contra-composição por unidade e por habilidade
{ const ct = AI._contra; const base = { inf: 0, vei: 0, dro: 0, est: 0, sup: 0, voo: 0, camuf: 0, cerco: 0, cura: 0, pir: 0, enxame: 0, total: 0 };
  const voo = Object.assign({}, base, { dro: 12, voo: 12, total: 12 }); const enx = Object.assign({}, base, { inf: 20, enxame: 20, total: 20 }); const cerco = Object.assign({}, base, { vei: 6, cerco: 6, total: 6 });
  ok('antiaéreo: contra muitos voadores a Agulha vale mais que o Prisma', ct('agulha', voo) > ct('prisma', voo) * 1.5, ct('agulha', voo).toFixed(2) + ' vs ' + ct('prisma', voo).toFixed(2));
  ok('enxame: contra Crias o Soldador (área) vale mais que a Infantaria', ct('soldador', enx) > ct('infantaria', enx) * 1.3, ct('soldador', enx).toFixed(2) + ' vs ' + ct('infantaria', enx).toFixed(2));
  ok('cerco: contra artilharia os rápidos e voadores sobem', ct('tratorzao', cerco) > ct('veiculo', cerco), ct('tratorzao', cerco).toFixed(2) + ' vs ' + ct('veiculo', cerco).toFixed(2));
  ok('Forja-Mãe: voadores valem mais, quem anda no chão perde um pouco', ct('drone', base, 'forja') > ct('infantaria', base, 'forja') * 1.5, ct('drone', base, 'forja').toFixed(2) + ' vs ' + ct('infantaria', base, 'forja').toFixed(2)); }
// 4) desvio da telegrafia: unidades da IA dentro de um aviso saem antes do golpe cair
{ const sim = S.createSim({ seed: 5, players: P2, minutes: 25 }); const ais = sim.players.map(p => AI.create(p.id, 'normal')); const n0 = S.nucleoOf(sim, 0); const us = [];
  for (let k = 0; k < 8; k++) us.push(S.spawnUnit(sim, 0, 'infantaria', n0.x + 150 + (k % 4) * 14, n0.y + 120 + Math.floor(k / 4) * 14));
  for (let i = 0; i < 9; i++) S.step(sim); const cx = n0.x + 171, cy = n0.y + 127; const a = { id: sim.nextId++, tipo: 'anel', x: cx, y: cy, r: 70, x2: cx, y2: cy, w: 0, t0: sim.time, t1: sim.time + 2, dono: -1, golpe: 'teste', dano: 100, chao: false };
  sim.avisos.push(a); const cmds = AI.think(sim, ais[0]); const moves = cmds.filter(c => c.t === 'move'); for (const c of cmds) S.enqueue(sim, c); for (let i = 0; i < 19; i++) S.step(sim); sim.avisos.length = 0;
  const fora = us.filter(u => S.dist(u.x, u.y, cx, cy) > 70 + u.r * 0.5).length; ok('desvio da telegrafia: as 8 Infantarias saem do anel em 2 s', moves.length >= 8 && fora === 8, moves.length + ' ordens, ' + fora + '/8 fora'); }
// 5) pedidos à IA aliada (comando 'pedido' pela fila, com pacto); sem pacto, a simulação ignora
{ const sim = S.createSim({ seed: 8, players: [{ name: 'Eu', faction: 'tessara', human: true }, { name: 'IA', faction: 'quorith', difficulty: 'normal' }, { name: 'Inimigo', faction: 'vorag', difficulty: 'normal' }], minutes: 25 });
  const ia = AI.create(1, 'normal'); S.enqueue(sim, { t: 'pedido', p: 0, para: 1, tipo: 'atacar', x: 500, y: 500 }); S.step(sim); ok('pedido sem pacto é ignorado', !sim.players[1].pedido);
  const pact = { a: 0, b: 1, until: 1e9, since: 0, caucao: 0, caucaoA: 0, caucaoB: 0 }; sim.players[0].pacts[1] = pact; sim.players[1].pacts[0] = pact;
  const n1 = S.nucleoOf(sim, 1); for (let k = 0; k < 6; k++) S.spawnUnit(sim, 1, 'voz', n1.x + 60 + k * 12, n1.y + 60); const nE = S.nucleoOf(sim, 2); const alvo = S.addBuilding(sim, 2, 'reator', nE.x + 120, nE.y, true);
  const ev = []; S.enqueue(sim, { t: 'pedido', p: 0, para: 1, tipo: 'atacar', x: alvo.x, y: alvo.y, alvo: alvo.id }); for (const e of S.step(sim)) ev.push(e); while (sim.tick % 10) S.step(sim);
  const cs = AI.think(sim, ia); const atk = cs.find(c => (c.t === 'attackmove' || c.t === 'attack') && c.ids.length >= 6 && (c.target === alvo.id || S.dist(c.x || 0, c.y || 0, alvo.x, alvo.y) < 5));
  const fala = sim.events.find(e => e.t === 'ia' && e.ev === 'fala' && e.chave === 'pedido' && e.para === 0);
  ok('pedido "atacar meu alvo": a IA aliada manda o exército e responde pelo retrato', !!sim.players[1].pedido && ev.some(e => e.t === 'pedido') && !!atk && !!fala, (atk ? atk.t : 'sem ordem') + (fala ? ' + fala' : ' sem fala'));
  S.enqueue(sim, { t: 'pedido', p: 0, para: 1, tipo: 'defender', x: 0, y: 0 }); S.step(sim); while (sim.tick % 10) S.step(sim); for (let i = 0; i < 32; i++) { for (const c of AI.think(sim, ia)) S.enqueue(sim, c); for (let k = 0; k < 10; k++) S.step(sim); } /* as bases ficam a ~2000: a 92 por segundo, uns 25 s */
  const n0 = S.nucleoOf(sim, 0); const perto = S.entitiesOf(sim, 1).filter(e => e.kind === 'unit' && e.def === 'voz' && S.dist(e.x, e.y, n0.x, n0.y) < 700).length;
  ok('pedido "defender minha base": o exército vai para perto do Núcleo do aliado', perto >= 4, perto + '/6 a até 700 do Núcleo');
  sim.players[1].res.minerio += 3000; S.enqueue(sim, { t: 'pedido', p: 0, para: 1, tipo: 'expandir', x: n0.x, y: n0.y }); S.step(sim); while (sim.tick % 10) S.step(sim); let nod = null;
  for (let i = 0; i < 40 && !nod; i++) { for (const c of AI.think(sim, ia)) { S.enqueue(sim, c); if (c.t === 'build' && c.def === 'nodulo') nod = c; } for (let k = 0; k < 10; k++) S.step(sim); }
  ok('pedido "expandir": a IA aliada abre um Nódulo', !!nod, nod ? 'Nódulo em ' + Math.round(nod.x) + ',' + Math.round(nod.y) : 'nenhum'); }
// 6) falas: saem com recarga (35 s por IA, 150 s por fala), não mexem no hash e têm texto nos três idiomas
{ const P4 = [{ name: 'A', faction: 'vehnar', difficulty: 'dificil' }, { name: 'B', faction: 'erevane', difficulty: 'dificil' }, { name: 'C', faction: 'tessara', difficulty: 'dificil' }, { name: 'D', faction: 'quorith', difficulty: 'dificil' }, { name: 'E', faction: 'vorag', difficulty: 'dificil' }];
  const sim = S.createSim({ seed: 21, players: P4, minutes: 25 }); const ais = sim.players.map(p => AI.create(p.id, 'dificil')); const falas = []; let semEv = null;
  for (let i = 0; i < (RAP ? 5400 : 9000) && !sim.result; i++) { if (sim.tick % 10 === 0) for (const a of ais) for (const c of AI.think(sim, a)) S.enqueue(sim, c); for (const e of S.step(sim)) if (e.t === 'ia') falas.push(e); }
  let curto = 0; const ult = {}; for (const f of falas) { if (ult[f.p] != null && f.time - ult[f.p] < 35 - 1e-6) curto++; ult[f.p] = f.time; }
  const dic = {}; for (const l of ['pt-BR', 'en', 'es']) { const src = fs.readFileSync(root + '/src/i18n/' + l + '.js', 'utf8'); dic[l] = src; }
  const faltam = []; for (const f of S.FACTIONS ? Object.keys(S.FACTIONS) : []) for (const ch of AI.FALAS) for (const n of [0, 1]) for (const l in dic) if (!dic[l].includes('"ia.fala.' + f + '.' + ch + '.' + n + '"')) faltam.push(l + ':' + f + '.' + ch + '.' + n);
  ok('falas com recarga e texto nos três idiomas', falas.length >= (RAP ? 3 : 5) && curto === 0 && !faltam.length, falas.length + ' falas em ' + (RAP ? 9 : 15) + ' min, ' + curto + ' em menos de 35 s, ' + faltam.length + ' textos faltando');
  const a = S.createSim({ seed: 21, players: P4, minutes: 25 }), b = S.createSim({ seed: 21, players: P4, minutes: 25 }); const aa = a.players.map(p => AI.create(p.id, 'dificil')), ab = b.players.map(p => AI.create(p.id, 'dificil'));
  for (let i = 0; i < (RAP ? 1500 : 3000); i++) { if (a.tick % 10 === 0) { for (const x of aa) for (const c of AI.think(a, x)) S.enqueue(a, c); for (const x of ab) for (const c of AI.think(b, x)) S.enqueue(b, c); b.events = b.events.filter(e => e.t !== 'ia'); } S.step(a); S.step(b); }
  ok('falas fora do hash (apagar os eventos de fala não muda a partida)', S.hash(a) === S.hash(b), S.hash(a)); }
// 7) salvar e voltar com o estado novo da IA, e um salvamento antigo (memória sem perfil nem v3) abre com o perfil padrão
{ const P3 = [{ name: 'A', faction: 'erevane', difficulty: 'normal' }, { name: 'B', faction: 'quorith', difficulty: 'normal' }, { name: 'C', faction: 'vorag', difficulty: 'normal' }];
  const A = S.createSim({ seed: 12, players: P3, minutes: 25, mapV: 1 }); const aa = A.players.map(p => AI.create(p.id, 'normal')); joga(A, aa, RAP ? 3600 : 5200);
  const save = JSON.parse(JSON.stringify({ sim: S.snapshot(A), ais: aa.map(AI.snapshot) })); const B = S.createSim({ seed: 12, players: P3, minutes: 25, mapV: 1 }); S.restore(B, save.sim); const ab = save.ais.map(AI.restore);
  let div = -1; for (let i = 0; i < (RAP ? 800 : 1500) && div < 0; i++) { if (A.tick % 10 === 0) { for (const x of aa) for (const c of AI.think(A, x)) S.enqueue(A, c); for (const x of ab) for (const c of AI.think(B, x)) S.enqueue(B, c); } S.step(A); S.step(B); if (S.hash(A) !== S.hash(B)) div = A.tick; }
  ok('salvar e voltar com a IA 3.0 (' + (RAP ? 800 : 1500) + ' tiques idênticos)', div < 0 && !!save.ais[0].v3 && save.ais[0].perfil === 'erevane', div < 0 ? 'hash ' + S.hash(A) : 'diverge no tique ' + div);
  const velho = save.ais.map(o => { const c = Object.assign({}, o); delete c.perfil; delete c.v3; return c; }); const Cs = S.createSim({ seed: 12, players: P3, minutes: 25, mapV: 1 }); S.restore(Cs, save.sim); const ac = velho.map(AI.restore); let erro = null;
  try { joga(Cs, ac, RAP ? 600 : 1200); } catch (e) { erro = e.message; } ok('salvamento antigo (sem o estado da 5.0h) abre com o perfil padrão', !erro && ac.every((a, i) => a.perfil === P3[i].faction), erro || ac.map(a => a.perfil).join(',')); }
// 8) ganchos com o código real (5.0h junção): ruínas e mercenários (src/mundo.js), módulos, construções únicas e o comandante (src/unicas-sim.js), cada comando pela simulação
{ const sim = S.createSim({ seed: 30, players: [{ name: 'A', faction: 'vehnar', difficulty: 'normal' }, { name: 'B', faction: 'tessara', difficulty: 'normal' }], minutes: 25, mapV: 1, mundo: { ruinas: true, corsarios: true }, comandantes: true }); const ai = AI.create(0, 'normal');
  const p = sim.players[0]; p.res.minerio = 9000; p.res.plasma = 3000; p.res.dados = 900; p.era = 2;
  const n0 = S.nucleoOf(sim, 0); const ref = S.addBuilding(sim, 0, 'refinaria', n0.x + 150, n0.y - 40, true);
  for (let k = 0; k < 10; k++) S.spawnUnit(sim, 0, 'infantaria', n0.x + 80 + (k % 5) * 14, n0.y + 90 + Math.floor(k / 5) * 14); const av = S.avatarDe(sim, 0); /* 10: o módulo pede exército de pé (8+) */
  for (let i = 0; i < 4; i++) S.step(sim); while (sim.tick % 10) S.step(sim);
  av.x = n0.x + 200; av.y = n0.y + 200; for (let k = 0; k < 3; k++) S.spawnUnit(sim, 1, 'quimera', av.x + 60 + k * 10, av.y + 20);
  for (const u of S.entitiesOf(sim, 0)) if (u.def === 'infantaria') u.state = 'idle'; sim.tick = 5000; sim.time = 500; /* a partida pula para os 8:20 (o passo segue do tique) */ ai.lastStrategic = sim.time; ai.strategy = 'expansao';
  const acamp = sim.byId.get(sim.mundoSt.acamp); const tipos = {}, todos = [], ev = [];
  for (let r = 0; r < 6; r++) { av.lastAttack = sim.time; for (const c of AI.think(sim, ai)) { tipos[c.t + (c.t === 'build' ? ':' + c.def : '')] = tipos[c.t + (c.t === 'build' ? ':' + c.def : '')] || c; todos.push(c); S.enqueue(sim, c); } for (let k = 0; k < 10; k++) for (const e of S.step(sim)) ev.push(e); }
  const cap = todos.find(c => c.t === 'capturar' && c.ids.length >= 2 && sim.byId.get(c.id) && sim.byId.get(c.id).ruina);
  ok('gancho: infantaria vai capturar a ruína livre mais perto (comando capturar)', !!cap, cap ? cap.ids.length + ' infantarias, ' + sim.byId.get(cap.id).ruina.tipo : Object.keys(tipos).join(','));
  const vaiNave = todos.find(c => c.t === 'move' && c.ids.length === 1 && acamp && S.dist(c.x, c.y, acamp.x, acamp.y) < 600);
  ok('gancho: sem ninguém perto da nave, leva uma unidade até o Acampamento Corsário', !!vaiNave, vaiNave ? Math.round(S.dist(vaiNave.x, vaiNave.y, acamp.x, acamp.y)) + ' da nave' : 'nenhum');
  const u1 = S.entitiesOf(sim, 0).find(u => u.kind === 'unit' && u.def === 'infantaria' && !(cap && cap.ids.includes(u.id))); if (u1 && acamp) { const a = Math.atan2(n0.y - acamp.y, n0.x - acamp.x); u1.x = acamp.x + Math.cos(a) * 380; u1.y = acamp.y + Math.sin(a) * 380; }
  ai.v3.mercT = -999; const evc = []; for (let r = 0; r < 4; r++) { for (const c of AI.think(sim, ai)) { if (c.t === 'contratar') tipos.contratar = c; S.enqueue(sim, c); } for (let k = 0; k < 10; k++) for (const e of S.step(sim)) evc.push(e); }
  const merc = evc.find(e => e.t === 'mundo' && e.ev === 'contrato' && e.p === 0);
  ok('gancho: contrata um mercenário com uma chave real de S.MERCS e a simulação aceita', !!(tipos.contratar && S.MERCS[tipos.contratar.merc] && merc), tipos.contratar ? tipos.contratar.merc + (merc ? ' contratado' : ' recusado') : 'nenhum');
  ok('gancho: escolhe o módulo (chave a/b de S.MODULOS) e a simulação instala', !!(tipos.modulo && tipos.modulo.id === ref.id && (tipos.modulo.escolha === 'a' || tipos.modulo.escolha === 'b') && ref.modulo && ref.modulo.k === tipos.modulo.escolha), tipos.modulo ? JSON.stringify({ escolha: tipos.modulo.escolha, instalado: !!ref.modulo }) : 'nenhum');
  ok('gancho: ergue uma construção única da Raça (S.UNICAS_DE)', Object.keys(tipos).some(k => k.startsWith('build:') && S.BUILDINGS[k.slice(6)] && S.BUILDINGS[k.slice(6)].unica && S.BUILDINGS[k.slice(6)].fac === 'vehnar'), Object.keys(tipos).filter(k => k.startsWith('build:')).join(',') || 'nenhuma');
  const hab = ev.find(e => e.t === 'cmd' && e.ev === 'habilidade' && e.p === 0);
  ok('gancho: o comandante usa a habilidade pronta no combate (cd = tempo da partida em que fica pronta) e a simulação aceita', !!(tipos.habilidade && tipos.habilidade.id === av.id && hab && av.cmd.cd[tipos.habilidade.n] > sim.time - 10), tipos.habilidade ? 'habilidade ' + tipos.habilidade.n + (hab ? ' usada' : ' recusada') : 'nenhum'); }
// 9) 5.0h junção: tudo ligado (Mundo vivo, comandantes, Eventos da Fenda, a IA 3.0 usando as peças reais): salvar e voltar segue idêntico, e o neutro (p.fenda e p.mundo) não se confunde com a Fenda
{ const P4 = ['vehnar', 'erevane', 'tessara', 'vorag'].map((f, i) => ({ name: 'P' + i, faction: f, difficulty: 'normal' })); const cfg = { seed: 11, players: P4, minutes: 25, mapV: 1, mundo: true, comandantes: true, eventos: true, eventosTeste: 'sentinela' };
  const A = S.createSim(cfg); const aa = A.players.filter(p => !p.fenda).map(p => AI.create(p.id, p.difficulty)); joga(A, aa, RAP ? 3000 : 4800);
  ok('tudo ligado: a Fenda e o neutro são jogadores diferentes, e só o neutro tem p.mundo', A.fenda >= 0 && A.mundo >= 0 && A.fenda !== A.mundo && A.players[A.mundo].mundo && !A.players[A.fenda].mundo && aa.length === 4, 'Fenda ' + A.fenda + ', neutro ' + A.mundo);
  const save = JSON.parse(JSON.stringify({ sim: S.snapshot(A), ais: aa.map(AI.snapshot) })); const B = S.createSim(cfg); S.restore(B, save.sim); const ab = save.ais.map(AI.restore);
  let div = -1; for (let i = 0; i < (RAP ? 600 : 1200) && div < 0; i++) { if (A.tick % 10 === 0) { for (const x of aa) for (const c of AI.think(A, x)) S.enqueue(A, c); for (const x of ab) for (const c of AI.think(B, x)) S.enqueue(B, c); } S.step(A); S.step(B); if (S.hash(A) !== S.hash(B)) div = A.tick; }
  ok('tudo ligado: salvar e voltar (' + (RAP ? 600 : 1200) + ' tiques idênticos)', div < 0, div < 0 ? 'hash ' + S.hash(A) : 'diverge no tique ' + div); }
const nOk = res.filter(r => r.ok).length; if (JSONOUT) console.log(JSON.stringify({ ok: nOk, total: res.length, falhou: res.filter(r => !r.ok).map(r => r.nome + ' · ' + r.info) }));
else console.log('IA 3.0: ' + nOk + '/' + res.length);
process.exit(nOk === res.length ? 0 : 1);
