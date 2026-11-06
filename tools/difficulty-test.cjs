// Validação das dificuldades (4.1a; 4.1d mede também quando a IA chega às Eras II e III e à Ascensão; 5.0h: refeito para a IA 3.0, com duas referências
// e em paralelo). Cada nível (Fácil, Normal, Difícil, Brutal) joga 1×1 contra a MESMA IA de referência, com Raças espelhadas (só a dificuldade muda):
//   - 'defensor': o jogador iniciante e defensivo de sempre (constrói, defende, nunca ataca), no lugar do humano; mede se e quando ele cai;
//   - 'normal': a IA Normal (a 5.0h, com o perfil do líder) no lugar do humano; mede a taxa de vitória do nível contra ela.
// Uso: node tools/difficulty-test.cjs [--partidas=10] [--min=18] [--ref=defensor,normal] [--procs=6] [--raiz=<pasta com src/>] [--json]
//      node tools/difficulty-test.cjs <dificuldade> [partidas] [minutos]   (forma antiga: uma linha JSON por partida, contra o defensor)
const path = require('path'); const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const R = ['vehnar', 'erevane', 'tessara', 'quorith', 'vorag']; const NIVEIS = ['facil', 'normal', 'dificil', 'brutal'];
const PROXY = { name: 'Defensor', income: 1, attackAt: 1e9, minAttack: 1e9, acceptP: 0, breakP: 0, pirateEvery: 1e9, reserve: 150, buildEvery: 8, attackFrac: 0, research: 2, superweapon: false, maxProd: 2 }; // jogador iniciante e defensivo: constrói, defende, nunca ataca
const arg = (k, d) => { const a = process.argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
function carrega(raiz) { globalThis.ARD = {}; for (const f of ['modos.js', 'chefes-sim.js', 'mundo.js', 'unicas-sim.js', 'sim.js', 'ai.js']) { const p = path.join(raiz, 'src', f); try { require.resolve(p); } catch (e) { continue; } require(p); } return globalThis.ARD; }
function joga(A, j) {
  const S = A.sim, AI = A.ai; const ra = R[j.k % 5]; const ladoRef = j.k % 2; /* o lado alterna */
  const pl = [null, null]; pl[ladoRef] = { name: 'Ref', faction: ra, human: true }; pl[1 - ladoRef] = { name: 'IA', faction: ra, difficulty: j.diff };
  const sim = S.createSim({ seed: 3100 + j.k * 17, players: pl, minutes: j.min }); const iRef = ladoRef, iIA = 1 - ladoRef;
  const ref = AI.create(iRef, 'normal'); if (j.ref === 'defensor') ref.diff = PROXY; else ref.diff = Object.assign({}, S.DIFFICULTY.normal, { acceptP: 0, breakP: 0 }); /* a referência não faz pacto */ const ai = AI.create(iIA, j.diff); const m = { firstAttack: null, b300: null, a300: null, a480: null, peak: 0, fell: null, e2: null, e3: null, asc: null };
  for (let i = 0; i < j.min * 600 && !sim.result; i++) { if (sim.tick % 10 === 0) { for (const c of AI.think(sim, ref)) S.enqueue(sim, c); for (const c of AI.think(sim, ai)) S.enqueue(sim, c); if (m.firstAttack == null && ai.mode === 'attack') m.firstAttack = Math.round(sim.time); if (m.firstAttack == null) m.peak = Math.max(m.peak, S.armyValue(sim, iIA)); }
    S.step(sim); const q = sim.players[iIA]; if (m.e2 == null && q.era >= 2) m.e2 = Math.round(sim.time); if (m.e3 == null && q.era >= 3) m.e3 = Math.round(sim.time); if (m.asc == null && q.ascended) m.asc = Math.round(sim.time);
    if (m.b300 == null && sim.time >= 300) m.b300 = S.entitiesOf(sim, iIA).filter(e => e.kind === 'building').length; if (m.a480 == null && sim.time >= 480) m.a480 = S.armyValue(sim, iIA); if (m.a300 == null && sim.time >= 300) m.a300 = S.armyValue(sim, iIA); if (m.fell == null && !sim.players[iRef].alive) m.fell = Math.round(sim.time); }
  const sc = sim.players.map(p => p.alive ? S.score(sim, p) : -1); let win = 'empate'; if (!sim.players[iIA].alive) win = 'ref'; else if (!sim.players[iRef].alive) win = 'ia'; else if (sc[iRef] > sc[iIA] * 1.15) win = 'ref'; else if (sc[iIA] > sc[iRef] * 1.15) win = 'ia';
  return Object.assign({ diff: j.diff, ref: j.ref, ra, win, t: Math.round(sim.time) }, m);
}
if (!isMainThread) { const A = carrega(workerData.raiz); parentPort.on('message', j => { if (!j) process.exit(0); let r; try { r = joga(A, j); } catch (e) { r = { erro: String(e && e.stack || e).slice(0, 300), j }; } parentPort.postMessage(r); }); }
else if (process.argv[2] && !process.argv[2].startsWith('--')) { /* forma antiga */ const A = carrega(path.join(__dirname, '..')); const diff = process.argv[2], N = +(process.argv[3] || 6), min = +(process.argv[4] || 18); for (let k = 0; k < N; k++) console.log(JSON.stringify(joga(A, { diff, k, min, ref: 'defensor' }))); }
else (async () => {
  const raiz = path.resolve(arg('raiz', path.join(__dirname, '..'))); const N = +arg('partidas', 10), min = +arg('min', 18), refs = arg('ref', 'defensor,normal').split(','), procs = +arg('procs', 6);
  const jobs = []; for (const ref of refs) for (const diff of NIVEIS) for (let k = 0; k < N; k++) jobs.push({ diff, k, min, ref }); const res = []; let next = 0; const t0 = Date.now();
  await new Promise(fim => { let vivos = 0; for (let w = 0; w < Math.min(procs, jobs.length); w++) { const wk = new Worker(__filename, { workerData: { raiz } }); vivos++; const manda = () => wk.postMessage(next < jobs.length ? jobs[next++] : null); wk.on('message', r => { res.push(r); manda(); }); wk.on('exit', () => { if (--vivos === 0) fim(); }); manda(); } });
  const med = a => a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : null; const mm = s => s == null ? '—' : (s / 60).toFixed(1); const out = { raiz, N, min, refs: {} };
  for (const ref of refs) { const linhas = []; for (const d of NIVEIS) { const rs = res.filter(r => r.ref === ref && r.diff === d && !r.erro); const w = rs.filter(r => r.win === 'ia').length, e = rs.filter(r => r.win === 'empate').length; const fell = rs.filter(r => r.fell).map(r => r.fell); const fa = rs.filter(r => r.firstAttack).map(r => r.firstAttack);
      linhas.push({ d, n: rs.length, vitorias: w, empates: e, taxa: rs.length ? Math.round((w + e / 2) / rs.length * 100) : 0, caiu: fell.length, minQueda: mm(med(fell)), b300: med(rs.map(r => r.b300 || 0)), a300: med(rs.map(r => r.a300 || 0)), primeiroAtaque: mm(med(fa)), e2: mm(med(rs.filter(r => r.e2).map(r => r.e2))), e3: mm(med(rs.filter(r => r.e3).map(r => r.e3))) }); }
    out.refs[ref] = linhas; }
  const ordem = l => l.every((x, i) => i === 0 || x.taxa >= l[i - 1].taxa); out.crescente = refs.every(r => ordem(out.refs[r])); out.seg = Math.round((Date.now() - t0) / 1000); out.erros = res.filter(r => r.erro).slice(0, 2);
  if (process.argv.includes('--json')) { console.log(JSON.stringify(out)); return; }
  for (const ref of refs) { console.log(`Referência: ${ref === 'defensor' ? 'o defensor (constrói e defende, nunca ataca)' : 'a IA Normal (5.0h)'} · ${N} partidas por nível, ${min} min · raiz ${raiz}`);
    console.log('| Nível | Vitórias da IA | Empates | Taxa | Referência cai | Minuto da queda | Construções aos 5 min | Exército aos 5 min | 1º ataque | Era II | Era III |'); console.log('|---|---|---|---|---|---|---|---|---|---|---|');
    for (const l of out.refs[ref]) console.log(`| ${l.d} | ${l.vitorias}/${l.n} | ${l.empates} | ${l.taxa}% | ${l.caiu}/${l.n} | ${l.minQueda} | ${l.b300} | ${l.a300} | ${l.primeiroAtaque} min | ${l.e2} min | ${l.e3} min |`); }
  console.log('Fácil < Normal < Difícil < Brutal: ' + (out.crescente ? 'sim' : 'NÃO') + ' · ' + out.seg + ' s' + (out.erros.length ? ' · ERROS ' + out.erros[0].erro : ''));
})();
