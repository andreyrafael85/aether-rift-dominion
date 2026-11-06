// 5.0h — refaz a referência de hash das partidas com IA depois de mudar a IA de propósito (a IA 3.0): grava em tools/chefes-ref.json o caso
// ia3['7/2000'] (ARD_DET só com as partidas de sempre) e o hash da Planície sem modo no tools/modos-test.cjs (IA3_PLANICIE). As referências da
// 5.0f continuam valendo com a IA de antes (perfil nulo). Uso: node tools/ia-ref.cjs   (só depois de congelar a IA; diga no relatório por que mudou)
const path = require('path'); const fs = require('fs'); const root = path.resolve(__dirname, '..');
globalThis.ARD = {}; require(root + '/src/modos.js'); require(root + '/src/chefes-sim.js'); require(root + '/src/mundo.js'); require(root + '/src/unicas-sim.js'); /* 5.0h junção: carregado como no jogo */ require(root + '/src/sim.js'); require(root + '/src/ai.js'); require(root + '/tools/det-run.js');
const S = ARD.sim, AI = ARD.ai;
const refP = root + '/tools/chefes-ref.json'; const ref = JSON.parse(fs.readFileSync(refP, 'utf8'));
/* 5.0h junção: o Vorag novo (Cria 6 s, Cuspidor 55/35/6 s) muda também as partidas com a IA de antes: os casos da 5.0f (3e6ffc2) ficam guardados em
   casos5f e os casos passam a ser os da 5.0h (perfil nulo, mesmas sementes). Com --so-ia3, só a IA 3.0. */
if (!process.argv.includes('--so-ia3')) { if (!ref.casos5f) ref.casos5f = JSON.parse(JSON.stringify(ref.casos)); const novo = {};
  for (const k in ref.casos5f) { const [sd, tk] = k.split('/').map(Number); const h = ARD_DET(sd, tk, { iaPerfil: 'nulo', soBase: true }); const n = ref.casos5f[k].n; novo[k] = { n, ultimo: h[n - 1], meio: h[Math.floor(n / 3)] }; if (ref.casos5f[k].todos) novo[k].todos = h.slice(0, n); }
  ref.casos = novo; ref.base = '5.0h'; ref.nota = 'hashes sem chefão com a IA de antes (iaPerfil nulo): ARD_DET(seed, ticks, { iaPerfil: \'nulo\', soBase: true }). 5.0h: refeitos com o Vorag novo (Cria 6 s, Cuspidor 55/35/6 s); os da 5.0f (3e6ffc2) ficam em casos5f'; }
const todos = ARD_DET(7, 2000, { soBase: true }); ref.ia3 = { nota: 'hashes da IA 3.0 (5.0h, perfil do líder), sem chefão: ARD_DET(7, 2000, { soBase: true }); a IA de antes (iaPerfil nulo) segue nos casos da 5.0f', '7/2000': { todos } };
fs.writeFileSync(refP, JSON.stringify(ref));
const mp = root + '/tools/modos-test.cjs'; const src = fs.readFileSync(mp, 'utf8'); const m = src.match(/const P3 = (\[[^\n]*?\]);/); if (!m) throw new Error('P3 do modos-test não encontrado');
const P3m = eval(m[1]); const sim = S.createSim({ minutes: 25, seed: 31, players: P3m, mapV: 1 }); const ais = sim.players.filter(p => !p.fenda).map(p => AI.create(p.id, p.difficulty));
for (let t = 0; t < 4000; t++) { if (sim.tick % 10 === 0) for (const a of ais) for (const c of AI.think(sim, a)) S.enqueue(sim, c); S.step(sim); if (sim.result) break; }
const nulo = (seed, extra, n) => { const s2 = S.createSim(Object.assign({ minutes: 25, seed, players: P3m, mapV: 1, iaPerfil: 'nulo' }, extra)); const a2 = s2.players.filter(p => !p.fenda).map(p => AI.create(p.id, p.difficulty)); for (let t = 0; t < n; t++) { if (s2.tick % 10 === 0) for (const a of a2) for (const c of AI.think(s2, a)) S.enqueue(s2, c); S.step(s2); if (s2.result) break; } return S.hash(s2); };
let src2 = src.replace(/const IA3_PLANICIE = \d+;/, 'const IA3_PLANICIE = ' + S.hash(sim) + ';');
if (!process.argv.includes('--so-ia3')) src2 = src2.replace(/const NULO_PLANICIE = \d+, NULO_CINTURAO = \d+;/, 'const NULO_PLANICIE = ' + nulo(31, {}, 4000) + ', NULO_CINTURAO = ' + nulo(32, { map: 'cinturao' }, 3000) + ';');
fs.writeFileSync(mp, src2);
console.log('ia3 7/2000: ' + todos.length + ' amostras, última ' + todos[todos.length - 1] + ' · Planície sem modo (IA 3.0): ' + S.hash(sim));
