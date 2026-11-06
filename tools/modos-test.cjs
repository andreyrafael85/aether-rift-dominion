// 5.0g — testes dos modos (portão de qualidade, item "modos"): partida sem modo idêntica à 5.0f, cada mutador muda o que deve, cada Evento
// da Fenda acontece e paga a recompensa certa, a agenda dos eventos (6–8 min, Sentinela entre 12 e 15 min, um a cada 3 min), uma Caçada
// curta com semente fixa termina com vitória (medalha e pacto fixo do time), e salvar e voltar no meio de cada modo segue idêntico.
// Uso: node tools/modos-test.cjs [--json]   (cada linha com OK/FAIL conta; a última é o JSON com --json)
const path = require('path'); const root = path.resolve(__dirname, '..');
globalThis.ARD = {}; require(root + '/src/modos.js'); require(root + '/src/chefes-sim.js'); /* 5.0g junção: os chefões de verdade */ require(root + '/src/sim.js'); require(root + '/src/ai.js'); const S = ARD.sim, AI = ARD.ai, MO = ARD.modos;
const JSONOUT = process.argv.includes('--json'); const res = []; const t00 = Date.now();
const ok = (nome, cond, info) => { res.push({ nome, ok: !!cond, info: info || '' }); if (!JSONOUT) console.log((cond ? 'OK   ' : 'FAIL ') + nome + (info ? ' · ' + info : '')); };
const P3 = [{ name: 'A', faction: 'vehnar', difficulty: 'normal', human: true }, { name: 'B', faction: 'vorag', difficulty: 'dificil' }, { name: 'C', faction: 'tessara', difficulty: 'normal' }];
function joga(cfg, n, cada) { const sim = S.createSim(Object.assign({ minutes: 25 }, cfg)); const ais = sim.players.filter(p => !p.fenda /* 5.0g junção */).map(p => AI.create(p.id, p.difficulty)); const evs = [];
  for (let t = 0; t < n; t++) { if (sim.tick % 10 === 0) for (const a of ais) for (const c of AI.think(sim, a)) S.enqueue(sim, c); const ev = S.step(sim); for (const e of ev) if (e.t === 'evento' || e.t === 'chefe' || e.t === 'aviso' || e.t === 'end' || (e.t === 'alert' && e.p === 0)) evs.push(e); if (cada) cada(sim, ev); if (sim.result) break; }
  return { sim, ais, evs }; }
// 1) sem modo: o hash é o da 5.0f (medido em 3e6ffc2 com estas sementes) e nada de sim.modos
{ const a = joga({ seed: 31, players: P3, mapV: 1 }, 4000), b = joga({ seed: 32, players: P3, map: 'cinturao', mapV: 1 }, 3000);
  ok('sem modo: Planície da Fenda igual à 5.0f', S.hash(a.sim) === 1026467344 && !a.sim.modos, 'hash ' + S.hash(a.sim));
  ok('sem modo: Cinturão igual à 5.0f', S.hash(b.sim) === 2701652613 && !b.sim.modos, 'hash ' + S.hash(b.sim));
  ok('sem modo: fotografia sem campo novo', !('modos' in JSON.parse(JSON.stringify(S.snapshot(a.sim)))) && a.sim.fenda < 0 && !a.sim.chefes); }
// 2) mutadores
{ const base = S.createSim({ seed: 5, players: P3, minutes: 25, mapV: 1 }); const u0 = base.ents.find(e => e.kind === 'unit' && e.def === 'infantaria');
  const noite = S.createSim({ seed: 5, players: P3, minutes: 25, mapV: 1, mutadores: ['noite'] }); const u1 = noite.byId.get(u0.id);
  ok('Noite Eterna: visão −25%', Math.abs(S.sensorRadius(noite, u1) / S.sensorRadius(base, u0) - 0.75) < 1e-9 && MO.noite(noite) && !MO.noite(base), (S.sensorRadius(noite, u1) / S.sensorRadius(base, u0)).toFixed(3));
  const tes = S.createSim({ seed: 5, players: [{ faction: 'tessara', difficulty: 'normal' }, { faction: 'vehnar', difficulty: 'normal' }], minutes: 25, mapV: 1, mutadores: ['noite'] }); const tes0 = S.createSim({ seed: 5, players: [{ faction: 'tessara', difficulty: 'normal' }, { faction: 'vehnar', difficulty: 'normal' }], minutes: 25, mapV: 1 });
  for (let i = 0; i < 2; i++) { S.step(tes); S.step(tes0); } ok('Noite Eterna: a Fotossíntese fica na noite', tes.players[0].energy.prod < tes0.players[0].energy.prod, tes.players[0].energy.prod.toFixed(0) + ' < ' + tes0.players[0].energy.prod.toFixed(0));
  const esc = S.createSim({ seed: 5, players: P3, minutes: 25, mapV: 1, mutadores: ['escassos'] }); const n0 = base.ents.filter(e => e.kind === 'node'), n1 = esc.ents.filter(e => e.kind === 'node');
  ok('Recursos Escassos: nós pela metade', n0.length === n1.length && n1.every((e, i) => e.amount === Math.round(n0[i].amount * 0.5) && e.max === e.amount), n1.reduce((a, e) => a + e.amount, 0) + ' de ' + n0.reduce((a, e) => a + e.amount, 0));
  const kv = (sim) => { const v = S.spawnUnit(sim, 1, 'veiculo', 1000, 1000); S.kill(sim, v, 0); const w = sim.ents.find(e => e.kind === 'wreck'); return w ? w.amount : -1; };
  ok('Recursos Escassos: destroço pela metade', kv(esc) === Math.round(kv(S.createSim({ seed: 5, players: P3, minutes: 25, mapV: 1 })) * 0.5));
  const tp = S.createSim({ seed: 5, players: P3, minutes: 25, mapV: 1, mutadores: ['tempestades'] }); ok('Tempestades Frequentes: primeira tempestade antes', tp.nextStorm < base.nextStorm && tp.nextStorm <= 210 && tp.nextStorm >= 150, tp.nextStorm.toFixed(0) + ' s (sem: ' + base.nextStorm.toFixed(0) + ' s)');
  const anda = (sim) => { const u = S.spawnUnit(sim, 0, 'infantaria', 900, 900); S.forceStorm(sim, 900, 900, 0, 90, 420); S.step(sim); u.state = 'move'; u.tx = 900 + 600; u.ty = 900; const x0 = u.x; for (let i = 0; i < 10; i++) S.step(sim); return u.x - x0; };
  const d1 = anda(S.createSim({ seed: 5, players: P3, minutes: 25, mapV: 1, mutadores: ['tempestades'] })), d0 = anda(S.createSim({ seed: 5, players: P3, minutes: 25, mapV: 1 }));
  ok('Tempestades Frequentes: −10% de velocidade dentro da tempestade', Math.abs(d1 / d0 - 0.9) < 0.03, (d1 / d0).toFixed(3));
  { let a = 0, b = 0; const cnt = (cfg) => { let n = 0; const sim = S.createSim(Object.assign({ seed: 6, players: P3, minutes: 25, mapV: 1 }, cfg)); for (let t = 0; t < 9000; t++) { for (const e of S.step(sim)) if (e.t === 'storm' && e.phase === 'active') n++; } return n; }; a = cnt({ mutadores: ['tempestades'] }); b = cnt({}); ok('Tempestades Frequentes: o dobro de tempestades em 15 min', a >= b * 2 - 1 && a > b, a + ' contra ' + b); }
  const ln = S.createSim({ seed: 5, players: [Object.assign({ lente: true }, P3[0]), P3[1], P3[2]], minutes: 25, mapV: 1 }); const u2 = ln.byId.get(u0.id);
  ok('Lente do Arauto: +10% de visão só para quem leva', Math.abs(S.sensorRadius(ln, u2) / S.sensorRadius(base, u0) - 1.1) < 1e-9 && S.sensorRadius(ln, ln.ents.find(e => e.kind === 'unit' && e.owner === 1)) === S.sensorRadius(base, base.ents.find(e => e.kind === 'unit' && e.owner === 1))); }
// 3) cada evento, com a chave de teste (o primeiro evento aos 15 s)
for (const tipo of ['caravana', 'enxame', 'meteoros', 'sentinela']) {
  const fases = []; let pago = null, cristais = 0, dano = 0; const r = joga({ seed: 21, players: P3, mapV: 1, eventosTeste: tipo }, tipo === 'sentinela' ? 900 : 2400, (sim, ev) => {
    if (tipo === 'caravana' && sim.tick === 400) { const c = sim.modos.ev.at && sim.modos.ev.at.ids.map(id => sim.byId.get(id)).find(Boolean); if (c) { c.lastHitBy = 2; c.hp = 1; S.applyDamage(sim, 2, null, c, 50, null); } } /* C derruba um carro */
    if (tipo === 'sentinela' && sim.tick === 600) { const b = S.bossOf(sim); if (b) S.applyDamage(sim, 1, null, b, b.hp + 1, null); } /* B dá o golpe final */
    for (const e of ev) { if (e.t === 'evento') fases.push(e.fase); if (e.t === 'impact' && e.meteoro) dano++; } });
  if (tipo === 'meteoros') cristais = r.sim.ents.filter(e => e.alive && e.kind === 'node' && e.meteoro).length;
  const al = r.evs.filter(e => e.t === 'alert').map(e => e.text);
  const extra = tipo === 'caravana' ? al.some(t => /^C tomou uma carga da Caravana Corsária \(\+380\)$/.test(t)) : tipo === 'sentinela' ? al.some(t => /^B derrubou a Sentinela/.test(t)) && r.sim.players[1].sentinelas === 1 : tipo === 'meteoros' ? dano === MO.METEOROS.n && cristais > 0 : r.evs.some(e => e.t === 'evento' && e.fase === 'chega');
  ok('evento ' + tipo + ': aviso, chegada e fim' + (tipo === 'caravana' ? ', carga para quem destruiu' : tipo === 'sentinela' ? ', recompensa do golpe final' : tipo === 'meteoros' ? ', anéis, dano e cristais' : ''), fases[0] === 'aviso' && fases.includes('chega') && (tipo === 'enxame' || fases.includes('fim')) && extra, fases.join('→') + (tipo === 'meteoros' ? ' · ' + dano + ' quedas, ' + cristais + ' cristais' : '')); }
// 4) agenda: o primeiro evento entre 6 e 8 min, a Sentinela entre 12 e 15 min, no máximo um a cada 3 min (partida sem IA: só a agenda)
{ const ag = []; for (const seed of [3, 4, 5]) { const sim = S.createSim({ seed, players: P3.map(p => Object.assign({}, p)), minutes: 25, mapV: 1, eventos: true }); for (let t = 0; t < 16 * 600; t++) { if (t % 50 === 0) for (const e of sim.ents) if (e.alive && e.kind === 'building') e.hp = e.maxHp; /* sem IA ninguém defende: o enxame derrubaria um Núcleo e a partida acabaria */ for (const e of S.step(sim)) if (e.t === 'evento' && e.fase === 'aviso') ag.push({ seed, ev: e.ev, t: e.time }); } }
  let bom = true; const por = {}; for (const a of ag) (por[a.seed] = por[a.seed] || []).push(a);
  for (const k in por) { const L = por[k]; const s = L.find(a => a.ev === 'sentinela'); if (!s || s.t < 720 || s.t > 900) bom = false; if (!(L[0].t >= 360 && L[0].t <= 480)) bom = false; for (let i = 1; i < L.length; i++) if (L[i].t - L[i - 1].t < 180 - 1e-6) bom = false; }
  ok('agenda dos eventos: 6–8 min, Sentinela 12–15 min, um a cada 3 min', bom, Object.values(por).map(L => L.map(a => a.ev[0] + Math.round(a.t)).join(' ')).join(' | ')); }
/* 5.0g junção: quem está dentro de um golpe avisado (sim.avisos) sai pela borda mais perto, no tique em que o aviso nasce (como o tools/chefes-teste.cjs) */
function desvia(sim) {
  for (const a of sim.avisos) { if (a.visto || !a.dano) continue; a.visto = 1; const R = a.tipo === 'poco' ? a.r : a.tipo === 'faixa' ? a.w * 0.5 : a.r;
    for (const e of sim.ents) { if (!e.alive || e.kind !== 'unit' || e.owner < 0 || e.owner === sim.fenda) continue; let px = a.x, py = a.y;
      if (a.tipo === 'faixa') { const vx = a.x2 - a.x, vy = a.y2 - a.y, L2 = vx * vx + vy * vy; let t = L2 ? ((e.x - a.x) * vx + (e.y - a.y) * vy) / L2 : 0; t = Math.max(0, Math.min(1, t)); px = a.x + vx * t; py = a.y + vy * t; }
      const dx = e.x - px, dy = e.y - py, d = Math.hypot(dx, dy) || 1; if (d > R + e.r) continue;
      S.enqueue(sim, { t: 'move', p: e.owner, ids: [e.id], x: Math.max(30, Math.min(S.WORLD - 30, px + dx / d * (R + 40))), y: Math.max(30, Math.min(S.WORLD - 30, py + dy / d * (R + 40))) }); e.desvio = sim.tick + Math.round((a.t1 - sim.time) / S.TICK) + 5; } } }
// 5) Caçada curta com semente fixa: 2 IAs aliadas e um destacamento que vai direto ao chefão (e às partes dele) termina com vitória
for (const chefe of ['arauto', 'forja']) {
  const players = [{ name: 'A', faction: 'vehnar', difficulty: 'normal', human: true }, { name: 'B', faction: 'tessara', difficulty: 'normal' }, { name: 'C', faction: 'quorith', difficulty: 'normal' }];
  const cfg = { seed: 77, players, minutes: 25, mapV: 1, map: MO.CACADA[chefe].mapa, cacada: { chefe, dif: 'facil' } };
  const r = joga(cfg, 16000, (sim) => {
    desvia(sim); /* 5.0g junção: com os chefões de verdade o destacamento lê a telegrafia (sem desviar, o pisão da Forja-Mãe derruba tudo) */
    if (sim.tick === 1) for (let k = 0; k < 18; k++) { const n = S.nucleoOf(sim, k % 3); if (n) S.spawnUnit(sim, k % 3, k % 3 === 0 ? 'veiculo' : k % 2 ? 'drone' : 'infantaria', n.x + (k % 5) * 18 - 36, n.y + 70); }
    if (sim.tick % 100 === 2) { const f = sim.fenda; let alvo = null, bd = Infinity; const b = S.bossOf(sim); for (const e of sim.ents) if (e.alive && e.owner === f && (e.parte || e === b)) { const d = e.parte ? 0 : 1; if (d < bd) { bd = d; alvo = e; } } if (alvo) for (const p of [0, 1, 2]) { const ids = sim.ents.filter(e => e.alive && e.kind === 'unit' && e.owner === p && S.UNITS[e.def].attack && !(e.desvio > sim.tick)).map(e => e.id); if (ids.length) S.enqueue(sim, { t: 'attack', p, ids, target: alvo.id }); } } });
  const c = r.sim.result && r.sim.result.cacada; const time = r.sim.players.filter(p => !p.fenda && p.alive); /* 5.0g junção: um aliado eliminado pela Forja-Mãe sai do pacto (eliminate) */
  const fixo = time.every(a => time.every(b => a === b || (a.pacts[b.id] && a.pacts[b.id].fixo)));
  S.enqueue(r.sim, { t: 'break', p: 0, with: 1 });
  ok('Caçada curta (' + chefe + ', semente 77): vitória com medalha e time fixo', r.sim.result && r.sim.result.outcome === 'victory' && c && c.medalha && fixo, r.sim.result ? r.sim.result.outcome + ' aos ' + Math.round(r.sim.time) + ' s · medalha ' + (c && c.medalha) + ' · perdas ' + (c && c.perdas) : 'sem fim em ' + r.sim.tick + ' ticks'); }
{ const sim = S.createSim({ seed: 9, players: [{ name: 'A', faction: 'vehnar', human: true }, { name: 'B', faction: 'erevane', human: true }], minutes: 25, mapV: 1, cacada: { chefe: 'arauto', dif: 'normal' } }); S.enqueue(sim, { t: 'break', p: 0, with: 1 }); S.step(sim);
  ok('Caçada cooperativa: o pacto do time não quebra e a Fenda é inimiga', S.hasPact(sim, 0, 1) && S.isEnemy(sim, 0, sim.fenda) && sim.players[0].res.minerio > 1000 && sim.maxTime === MO.CAC_LIMITE);
  for (const p of sim.players) if (!p.fenda) { const n = S.nucleoOf(sim, p.id); S.kill(sim, n, sim.fenda); } for (let i = 0; i < 3; i++) S.step(sim);
  ok('Caçada cooperativa: derrota só quando caem todos os Núcleos', sim.result && sim.result.outcome === 'defeat' && /Todos os Núcleos/.test(sim.result.reason)); }
{ const sim = S.createSim({ seed: 9, players: [{ name: 'A', faction: 'vehnar', human: true }, { name: 'B', faction: 'erevane', human: true }], minutes: 25, mapV: 1, cacada: { chefe: 'arauto', dif: 'normal' } }); S.kill(sim, S.nucleoOf(sim, 0), sim.fenda); for (let i = 0; i < 3; i++) S.step(sim);
  ok('Caçada cooperativa: com um Núcleo de pé a partida segue', !sim.result); }
ok('medalha por tempo e perdas', MO.medalha(600, 10) === 'ouro' && MO.medalha(600, 30) === 'prata' && MO.medalha(1300, 10) === 'bronze' && MO.medalha(1100, 39) === 'prata');
// 6) salvar e voltar no meio de cada modo: a cópia restaurada segue idêntica (hash a cada 50 passos e fotografia inteira no fim)
const rt = o => JSON.parse(JSON.stringify(o));
function par(nome, cfg, antes, depois) { const mk = save => { const sim = S.createSim(Object.assign({ minutes: 25 }, rt(cfg))); if (save) S.restore(sim, save.sim); const ais = save ? save.ais.map(AI.restore) : sim.players.filter(p => !p.fenda /* 5.0g junção */).map(p => AI.create(p.id, p.difficulty)); return { sim, ais, tick() { if (sim.tick % 10 === 0) for (const a of ais) for (const c of AI.think(sim, a)) S.enqueue(sim, c); S.step(sim); }, save: () => ({ sim: S.snapshot(sim), ais: ais.map(AI.snapshot) }) }; };
  const A = mk(null); for (let i = 0; i < antes && !A.sim.result; i++) A.tick(); const save = rt(A.save()); const B = mk(save); let div = S.hash(A.sim) !== S.hash(B.sim) ? 'logo depois de voltar' : null;
  for (let i = 0; i < depois && !div && !A.sim.result; i++) { A.tick(); B.tick(); if (i % 50 === 49 && S.hash(A.sim) !== S.hash(B.sim)) div = 'tick ' + A.sim.tick; }
  if (!div && JSON.stringify(A.save()) !== JSON.stringify(B.save())) div = 'fotografia final';
  ok('salvar e voltar: ' + nome, !div && !!save.sim.modos, (div || 'idêntico') + ' · salvo no tick ' + save.sim.tick); }
par('caravana + Noite Eterna + Recursos Escassos', { seed: 41, players: P3, mapV: 1, eventosTeste: 'caravana', mutadores: ['noite', 'escassos'] }, 420, 700);
par('chuva de meteoros (anéis no chão)', { seed: 42, players: P3, mapV: 1, eventosTeste: 'meteoros' }, 420, 500);
par('Enxame Errante + Tempestades Frequentes', { seed: 43, players: P3, mapV: 1, eventosTeste: 'enxame', mutadores: ['tempestades'] }, 420, 700);
par('Sentinela da Fenda', { seed: 44, players: P3, mapV: 1, eventosTeste: 'sentinela' }, 420, 500);
par('Caçada do Arauto com aliados', { seed: 45, players: P3, mapV: 1, cacada: { chefe: 'arauto', dif: 'normal' } }, 1200, 900);
par('Caçada da Forja-Mãe', { seed: 46, players: P3.slice(0, 2), mapV: 1, map: 'tita', cacada: { chefe: 'forja', dif: 'dificil' } }, 1200, 900);
// 7) determinismo da partida com eventos: duas rodadas iguais (os 4 motores ficam com o tools/det-test.cjs)
{ const cf = { seed: 50, players: P3, mapV: 1, eventos: true, eventosTeste: 'enxame', mutadores: ['noite', 'tempestades', 'escassos'] }; const a = joga(cf, 3000), b = joga(cf, 3000);
  ok('partida com eventos e mutadores: duas rodadas idênticas', S.hash(a.sim) === S.hash(b.sim) && !!a.sim.modos, 'hash ' + S.hash(a.sim)); }
const falhas = res.filter(r => !r.ok).length;
if (JSONOUT) console.log(JSON.stringify({ ok: res.length - falhas, falhas, total: res.length, ms: Date.now() - t00, falhou: res.filter(r => !r.ok).map(r => r.nome + ' · ' + r.info) }));
else console.log(`modos: ${res.length - falhas} ok, ${falhas} falhas · ${Math.round((Date.now() - t00) / 1000)} s`);
process.exit(falhas ? 1 : 0);
