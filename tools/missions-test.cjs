// Roda cada missão da campanha no Node com a IA jogando também pelo humano: verifica roteiros (falas, ondas, eventos),
// objetivos e fim sem exceções. Uso: node tools/missions-test.cjs [ids separados por vírgula] [minutos-máx=14] [dificuldade=normal]
const path = require('path'); const root = path.resolve(__dirname, '..');
globalThis.ARD = {}; require(root + '/src/sim.js'); require(root + '/src/ai.js'); require(root + '/src/campaign.js'); const S = ARD.sim, AI = ARD.ai, C = ARD.campaign;
const ids = (process.argv[2] && process.argv[2] !== 'todas') ? process.argv[2].split(',') : C.MISSIONS.map(m => m.id); const maxMin = +(process.argv[3] || 14), diff = process.argv[4] || 'normal';
let bad = 0; const warn = console.warn; const warns = []; console.warn = (...a) => warns.push(a.join(' '));
for (const id of ids) {
  const t0 = Date.now(); const prep = C.prepare(id, { race: 'vehnar', difficulty: diff, relics: ['cofre-fendido'] }); const sim = S.createSim(prep.cfg); const run = C.start(sim, prep); run.brief();
  const ais = sim.players.filter(p => !prep.cfg.players[p.id].passive).map(p => AI.create(p.id, p.id === 0 ? 'normal' : p.difficulty)); let said = 0, spawns = 0, err = null;
  try { for (let i = 0; i < maxMin * 600 && !run.result; i++) { if (sim.tick % 10 === 0) for (const a of ais) for (const c of AI.think(sim, a)) S.enqueue(sim, c); const ev = S.step(sim); for (const e of ev) if (e.t === 'spawn' && e.p !== 0) spawns++; run.tick(ev); said += run.takeSaid().length; } } catch (e) { err = e.stack.split('\n').slice(0, 3).join(' | '); }
  const r = run.result; const ob = run.objectives.map(o => (o.done ? '✓' : '·') + o.id).join(' ');
  if (err) bad++;
  console.log(`${id.padEnd(10)} ${err ? 'ERRO ' + err : (r ? (r.won ? 'VENCEU ★' + r.stars : 'perdeu: ' + r.reason) : 'em andamento')} · t=${Math.round(sim.time)}s · falas ${said} · inimigos criados ${spawns} · ${ob} · ${Date.now() - t0} ms`);
}
// 4.2g — missão 6 jogada como Erevane: o inimigo vira outra Raça (Vehnar) e o contrarroubo precisa acontecer mesmo assim (antes a IA Vehnar fazia 1 ou 2 Piratas)
if (ids.includes('a2m1')) {
  const prep = C.prepare('a2m1', { race: 'erevane', difficulty: diff }); const sim = S.createSim(prep.cfg); const run = C.start(sim, prep); const said = run.brief();
  const ais = sim.players.filter(p => !prep.cfg.players[p.id].passive).map(p => AI.create(p.id, p.id === 0 ? 'normal' : p.difficulty)); const pir = new Set(); let siphoning = 0;
  for (let i = 0; i < 12 * 600 && !run.result; i++) { if (sim.tick % 10 === 0) for (const a of ais) for (const c of AI.think(sim, a)) S.enqueue(sim, c); const ev = S.step(sim); run.tick(ev);
    for (const e of sim.ents) if (e.alive && e.kind === 'unit' && e.owner !== 0 && e.def === 'pirata') { pir.add(e.id); if (e.state === 'siphon') siphoning++; } }
  const speaker = said[0] && said[0].race; const ok = pir.size >= 3 && speaker === sim.players[1].faction && sim.players[1].faction !== 'erevane';
  console.log(`a2m1/erevane · inimigo ${sim.players[1].faction} (${sim.players[1].name}) · fala de abertura de ${speaker} · Piratas inimigos em 12 min: ${pir.size} · ticks sifonando ${siphoning} · ${ok ? 'ok' : 'FALHOU'}`); if (!ok) bad++;
}
console.warn = warn; if (warns.length) console.log('avisos do roteiro: ' + [...new Set(warns)].slice(0, 8).join(' | ')); console.log(bad ? bad + ' missões com erro' : 'missões sem erro'); process.exit(bad ? 1 : 0);
