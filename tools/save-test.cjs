// 4.1c — teste de salvamento e retomada: joga até um ponto, salva (passando por JSON, como no aparelho), restaura num sim novo
// e roda as duas cópias lado a lado; o estado completo tem de continuar idêntico (hash a cada 50 passos e fotografia inteira no fim).
// Uso: node tools/save-test.cjs [escaramucas=4] [missoes=todas|ids] [passosAntes=1800] [passosDepois=1800]
const path = require('path'); const root = path.resolve(__dirname, '..');
globalThis.ARD = {}; require(root + '/src/sim.js'); require(root + '/src/ai.js'); require(root + '/src/campaign.js'); const S = ARD.sim, AI = ARD.ai, C = ARD.campaign;
const nSk = +(process.argv[2] || 4); const mArg = process.argv[3] || 'todas'; const before = +(process.argv[4] || 1800), after = +(process.argv[5] || 1800);
const RACES = ['vehnar', 'erevane', 'tessara', 'quorith', 'vorag']; let fails = 0, oks = 0; const t00 = Date.now();
const roundtrip = o => JSON.parse(JSON.stringify(o));
function pair(label, mk) {
  const t0 = Date.now(); let A = mk(null); // A: partida original
  for (let i = 0; i < before && !A.done(); i++) A.tick();
  if (A.done()) { const half = Math.max(20, Math.floor(A.sim.tick / 2)); A = mk(null); for (let i = 0; i < half && !A.done(); i++) A.tick(); } // terminou antes: salva na metade
  const save = roundtrip(A.save()); const bytes = JSON.stringify(save).length; const B = mk(save); // B: retomada a partir do salvamento
  let diverged = null; const hA0 = S.hash(A.sim), hB0 = S.hash(B.sim); if (hA0 !== hB0) diverged = 'logo após restaurar: ' + hA0 + ' vs ' + hB0;
  for (let i = 0; i < after && !diverged && !A.done(); i++) { A.tick(); B.tick(); if (i % 50 === 49 || A.done()) { const a = S.hash(A.sim), b = S.hash(B.sim); if (a !== b) diverged = 'tick ' + A.sim.tick + ': ' + a + ' vs ' + b; } }
  if (!diverged) { const sa = JSON.stringify(A.save()), sb = JSON.stringify(B.save()); if (sa !== sb) { let k = 0; while (k < sa.length && sa[k] === sb[k]) k++; diverged = 'fotografia final difere perto de: …' + sa.slice(Math.max(0, k - 80), k + 40) + '… vs …' + sb.slice(Math.max(0, k - 80), k + 40); } }
  if (diverged) fails++; else oks++;
  console.log(`${label.padEnd(34)} ${diverged ? 'FAIL ' + diverged : 'OK'} · salvo no tick ${save.sim.tick} · ${Math.round(bytes / 1024)} KB · fim no tick ${A.sim.tick} · ${Date.now() - t0} ms`);
}
// escaramuças: IA joga por todos (inclusive pelo humano), 2 a 4 jogadores
for (let k = 0; k < nSk; k++) {
  const n = 2 + (k % 3); const seed = 11 + k * 7; const players = []; for (let i = 0; i < n; i++) players.push({ name: 'P' + i, faction: RACES[(k + i * 2) % 5], human: i === 0, difficulty: ['facil', 'normal', 'dificil', 'brutal'][(k + i) % 4] });
  pair(`escaramuça ${n}p seed ${seed}`, save => {
    const sim = S.createSim({ seed, players, minutes: 25 }); if (save) S.restore(sim, save.sim);
    const ais = save ? save.ais.map(AI.restore) : sim.players.map(p => AI.create(p.id, p.difficulty));
    return { sim, done: () => !!sim.result, tick() { if (sim.tick % 10 === 0) for (const a of ais) for (const c of AI.think(sim, a)) S.enqueue(sim, c); S.step(sim); }, save: () => ({ sim: S.snapshot(sim), ais: ais.map(AI.snapshot) }) };
  });
}
// missões: o roteiro também é salvo e retomado
const ids = mArg === 'nenhuma' ? [] : mArg === 'todas' ? C.MISSIONS.map(m => m.id) : mArg.split(',');
for (const id of ids) {
  pair(`missão ${id}`, save => {
    const prep = C.prepare(id, { race: RACES[ids.indexOf(id) % 5], difficulty: 'normal', relics: ['cofre-fendido'] }); const sim = S.createSim(prep.cfg);
    if (save) S.restore(sim, save.sim); const run = C.start(sim, prep, save ? save.run : null); if (!save) run.brief();
    const ais = save ? save.ais.map(AI.restore) : sim.players.filter(p => !prep.cfg.players[p.id].passive).map(p => AI.create(p.id, p.id === 0 ? 'normal' : p.difficulty));
    return { sim, done: () => !!run.result, tick() { if (sim.tick % 10 === 0) for (const a of ais) for (const c of AI.think(sim, a)) S.enqueue(sim, c); const ev = S.step(sim); run.tick(ev); run.takeSaid(); }, save: () => ({ sim: S.snapshot(sim), ais: ais.map(AI.snapshot), run: run.save() }) };
  });
}
console.log(`salvamento: ${oks} ok, ${fails} falhas · ${Math.round((Date.now() - t00) / 1000)} s`); process.exit(fails ? 1 : 0);
