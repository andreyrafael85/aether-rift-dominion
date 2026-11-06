// Self-play de equilíbrio (4.0c; 5.0h: refeito para a IA 3.0). Roda no Node, sem navegador: partidas de IA contra IA e mede a taxa de vitória por Raça e a duração.
// Uso: node tools/selfplay.cjs [--sementes=6] [--min=20] [--dif=normal] [--q4=5] [--procs=6] [--cacada=3] [--curto] [--json] [--raiz=<pasta com src/>] [--perfil=nulo]
//   1×1: as 10 duplas das 5 Raças, cada uma com N sementes, alternando o lado (o mesmo par joga dos dois lados do mapa);
//   --q4=K: K partidas de 4 jogadores (Raças em rodízio); --cacada=K: Caçada só de IAs (2 IAs no Normal contra o Arauto e a Forja-Mãe, K sementes cada);
//   --curto: a versão do portão (tools/qa.cjs): 2 sementes por dupla, 14 min, sem 4 jogadores e sem Caçada (uma Caçada até o limite de 40 min sozinha passa de 60 s);
//   --raiz: roda com a simulação e a IA de outra cópia (o "antes", por exemplo a base 5.0g extraída do git);
//   --perfil=nulo: a IA de antes da 5.0h (perfil nulo, o comportamento da campanha) também na escaramuça;
//   --ajuste='{"vorag":{"ataque":1.2}}': muda campos dos perfis só nesta rodada (para calibrar o equilíbrio); --so=vorag: só as duplas com essa Raça.
//   5.0h junção: --mundo=1 (Mundo vivo inteiro), --cmd=1 (comandantes em campo); --sem=espelho,mina,devorar (a IA não usa essas peças: construção única,
//   módulo ou habilidade, pelo id; ou 'unicas', 'modulos', 'habilidades' inteiros), para medir se uma peça decide a partida sozinha; a saída traz,
//   por peça, quantas vezes cada lado a teve e a taxa de vitória de quem a teve.
// Vitória: eliminação; no fim do tempo, quem tiver placar 15% acima do outro; senão empate (meio ponto para cada).
const path = require('path'); const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const R = ['vehnar', 'erevane', 'tessara', 'quorith', 'vorag'];
const arg = (k, d) => { const a = process.argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const tem = k => process.argv.includes('--' + k);

function carrega(raiz) { globalThis.ARD = {}; for (const f of ['modos.js', 'chefes-sim.js', 'mundo.js', 'unicas-sim.js', 'sim.js', 'ai.js']) { const p = path.join(raiz, 'src', f); try { require.resolve(p); } catch (e) { continue; } require(p); } return globalThis.ARD; }
function joga(A, job) {
  const S = A.sim, AI = A.ai; const t0 = Date.now();
  const cfg = { seed: job.seed, players: job.racas.map((f, i) => ({ name: f + i, faction: f, difficulty: job.dif })), minutes: job.min, mapV: 1 };
  if (job.cacada) { cfg.map = A.modos && A.modos.CACADA && A.modos.CACADA[job.cacada] ? A.modos.CACADA[job.cacada].mapa : undefined; cfg.cacada = { chefe: job.cacada, dif: 'normal' }; cfg.minutes = 45; }
  if (job.perfil) cfg.iaPerfil = job.perfil; /* 5.0h: chave de teste (mesma do ?perfil=) */
  if (job.mundo) cfg.mundo = true; if (job.cmd) cfg.comandantes = true; /* 5.0h junção */
  const sim = S.createSim(cfg); const ais = sim.players.filter(p => !p.fenda).map(p => AI.create(p.id, p.difficulty));
  const sem = new Set(job.sem || []); const pecas = sim.players.map(() => ({})); const marca = (pid, k) => { if (pecas[pid]) pecas[pid][k] = (pecas[pid][k] || 0) + 1; };
  const filtra = c => { if (!sem.size) return true; const M = S.MODULOS; if (c.t === 'build' && S.BUILDINGS[c.def] && S.BUILDINGS[c.def].unica && (sem.has('unicas') || sem.has(c.def))) return false;
    if (c.t === 'modulo') { if (sem.has('modulos')) return false; const b = sim.byId.get(c.id); const m = b && M && M[b.def] && M[b.def].find(x => x.k === c.escolha); if (m && sem.has(m.id)) return false; }
    if (c.t === 'habilidade') { if (sem.has('habilidades')) return false; const u = sim.byId.get(c.id); const h = u && S.habDe && S.habDe(u); if (h && h[c.n] && sem.has(h[c.n].id)) return false; } return true; };
  const N = (job.cacada ? 45 : job.min) * 600; let thinkMs = 0;
  for (let i = 0; i < N && !sim.result; i++) { if (sim.tick % 10 === 0) { const a0 = process.hrtime.bigint(); for (const ai of ais) for (const c of AI.think(sim, ai)) if (filtra(c)) S.enqueue(sim, c); thinkMs += Number(process.hrtime.bigint() - a0) / 1e6; }
    for (const e of S.step(sim)) { if (e.t === 'cmd' && e.ev === 'habilidade') marca(e.p, 'hab:' + e.hab); else if (e.t === 'unica' && e.ev === 'modulo') { const M = S.MODULOS && S.MODULOS[e.def]; const m = M && M.find(x => x.k === e.k); marca(e.p, 'mod:' + (m ? m.id : e.def + e.k)); } else if (e.t === 'mundo' && e.ev === 'contrato') marca(e.p, 'merc:' + e.merc); else if (e.t === 'mundo' && e.ev === 'captura') marca(e.p, 'ruina:' + e.tipo); else if (e.t === 'built' && S.BUILDINGS[e.def] && S.BUILDINGS[e.def].unica && pecas[e.p]) pecas[e.p]['unica:' + e.def] = 1; } }
  const pl = sim.players.filter(p => !p.fenda);
  if (job.cacada) { const r = sim.result; return { tipo: 'cacada', chefe: job.cacada, seed: job.seed, racas: job.racas, fim: r ? r.outcome : 'sem fim', t: Math.round(sim.time), ms: Date.now() - t0 }; }
  const alive = pl.filter(p => p.alive); let pontos = {}; let how;
  if (alive.length === 1) { how = 'eliminação'; pontos[alive[0].id] = 1; }
  else { how = 'tempo'; const sc = pl.map(p => ({ id: p.id, s: p.alive ? S.score(sim, p) : -1 })).sort((x, y) => y.s - x.s); if (sc[0].s > sc[1].s * 1.15) pontos[sc[0].id] = 1; else { const emp = sc.filter(x => x.s * 1.15 >= sc[0].s && x.s >= 0); for (const x of emp) pontos[x.id] = 1 / emp.length; } }
  return { tipo: job.racas.length === 2 ? '1x1' : job.racas.length + 'p', seed: job.seed, racas: job.racas, pontos: pl.map(p => pontos[p.id] || 0), pecas: pl.map(p => pecas[p.id] || {}), how, t: Math.round(sim.time), ms: Date.now() - t0, thinkMs: Math.round(thinkMs), ticks: sim.tick };
}
if (!isMainThread) { const A = carrega(workerData.raiz); if (workerData.ajuste && A.ai.PERFIS) for (const k in workerData.ajuste) Object.assign(A.ai.PERFIS[k], workerData.ajuste[k]); /* --ajuste='{"vorag":{"ataque":1.2}}': prova de ajuste de perfil, sem mexer no arquivo */ parentPort.on('message', job => { if (!job) { process.exit(0); } let r; try { r = joga(A, job); } catch (e) { r = { erro: String(e && e.stack || e).slice(0, 400), job }; } parentPort.postMessage(r); }); }
else (async () => {
  const curto = tem('curto'); const raiz = path.resolve(arg('raiz', path.join(__dirname, '..'))); const sementes = +arg('sementes', curto ? 2 : 6), min = +arg('min', curto ? 14 : 20), dif = arg('dif', 'normal');
  const q4 = +arg('q4', curto ? 0 : 5), cac = +arg('cacada', 0), procs = Math.max(1, +arg('procs', 6)); const perfil = arg('perfil', null); const JSONOUT = tem('json'); const mundo = arg('mundo', '0') === '1', cmd = arg('cmd', '0') === '1', sem = arg('sem', '') ? arg('sem', '').split(',') : []; /* 5.0h junção */
  const jobs = [];
  const so = arg('so', null); for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) for (let k = 0; k < sementes; k++) { const a = R[i], b = R[j]; if (so && a !== so && b !== so) continue; jobs.push({ racas: k % 2 === 0 ? [a, b] : [b, a], seed: 1000 + k * 37 + i * 7 + j, min, dif, perfil, mundo, cmd, sem }); }
  for (let k = 0; k < q4; k++) jobs.push({ racas: [0, 1, 2, 3].map(x => R[(x + k) % 5]), seed: 5000 + k * 53, min: Math.max(min, 25), dif, perfil, mundo, cmd, sem });
  const duplas = [['vehnar', 'tessara'], ['quorith', 'vorag'], ['erevane', 'vehnar']]; for (const chefe of ['arauto', 'forja']) for (let k = 0; k < cac; k++) jobs.push({ racas: duplas[k % duplas.length], seed: 7700 + k * 31 + (chefe === 'forja' ? 1 : 0), cacada: chefe, dif: 'normal', perfil });
  const res = []; const t0 = Date.now(); let next = 0;
  await new Promise(fim => { let vivos = 0; const n = Math.min(procs, jobs.length); if (!n) return fim();
    for (let w = 0; w < n; w++) { const wk = new Worker(__filename, { workerData: { raiz, ajuste: arg('ajuste', null) ? JSON.parse(arg('ajuste')) : null }, argv: [] }); vivos++; const manda = () => { if (next < jobs.length) wk.postMessage(jobs[next++]); else wk.postMessage(null); };
      wk.on('message', r => { res.push(r); if (!JSONOUT && process.env.SELFPLAY_LOG) console.error(JSON.stringify(r)); manda(); }); wk.on('exit', () => { if (--vivos === 0) fim(); }); wk.on('error', e => { res.push({ erro: String(e) }); }); manda(); } });
  const erros = res.filter(r => r.erro);
  // 1×1 por Raça
  const tab = {}; for (const f of R) tab[f] = { n: 0, pts: 0, v: 0, e: 0, d: 0 }; const dur = []; let elim = 0, n11 = 0, thinkMs = 0, ticks = 0;
  const pares = {};
  for (const r of res) if (r.tipo === '1x1') { n11++; if (r.how === 'eliminação') { elim++; dur.push(r.t); } thinkMs += r.thinkMs; ticks += r.ticks;
    r.racas.forEach((f, i) => { const T = tab[f]; T.n++; T.pts += r.pontos[i]; if (r.pontos[i] === 1) T.v++; else if (r.pontos[i] > 0) T.e++; else T.d++; });
    const key = [...r.racas].sort().join('×'); const pr = pares[key] || (pares[key] = {}); r.racas.forEach((f, i) => { pr[f] = (pr[f] || 0) + r.pontos[i]; }); }
  const pec = {}; for (const r of res) if (r.tipo === '1x1' && r.pecas) r.racas.forEach((f, i) => { const o = r.pecas[i] || {}; for (const k in o) { const q = pec[k] || (pec[k] = { n: 0, pts: 0, usos: 0, racas: {} }); q.n++; q.pts += r.pontos[i]; q.usos += o[k]; q.racas[f] = (q.racas[f] || 0) + 1; } }); /* 5.0h junção: por peça, em quantas partidas o lado a teve e quanto ele ganhou */
  const taxa = f => tab[f].n ? tab[f].pts / tab[f].n : 0; const faixa = R.every(f => taxa(f) >= 0.4 && taxa(f) <= 0.6); const sanidade = R.every(f => taxa(f) > 0.05 && taxa(f) < 0.95); /* no portão (8 partidas por Raça) o ruído é grande: o portão pega só a IA quebrada (uma Raça que nunca ganha ou nunca perde); a faixa 40–60% vem na rodada longa */
  const t4 = {}; for (const f of R) t4[f] = { n: 0, pts: 0 }; const dur4 = []; for (const r of res) if (r.tipo === '4p') { r.racas.forEach((f, i) => { t4[f].n++; t4[f].pts += r.pontos[i]; }); dur4.push(r.t); }
  const cacs = res.filter(r => r.tipo === 'cacada'); const cacOk = cacs.every(r => r.fim === 'victory' && r.t < 20 * 60);
  const med = a => a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : null; const mmss = s => s == null ? '—' : Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  const out = { raiz, sementes, min, dif, perfil, mundo, cmd, sem, pecas: Object.fromEntries(Object.entries(pec).sort().map(([k, q]) => [k, { n: q.n, taxa: Math.round(q.pts / q.n * 1000) / 10, usos: q.usos, racas: q.racas }])), partidas1x1: n11, faixa, sanidade, taxas: Object.fromEntries(R.map(f => [f, Math.round(taxa(f) * 1000) / 10])), tab, pares, eliminacao: elim, duracaoMedia: med(dur), q4: { t4, duracaoMedia: med(dur4) }, cacada: cacs.map(r => ({ chefe: r.chefe, racas: r.racas, fim: r.fim, t: r.t })), cacadaOk: cacOk, erros: erros.slice(0, 3), seg: Math.round((Date.now() - t0) / 1000), thinkMsPorChamada: ticks ? Math.round(thinkMs / (ticks / 10) / 2 * 1000) / 1000 : null };
  if (JSONOUT) { console.log(JSON.stringify(out)); process.exit(erros.length ? 1 : 0); }
  console.log(`Self-play ${n11} partidas 1×1 (${sementes} sementes por dupla, ${min} min, ${dif}${perfil ? ', perfil ' + perfil : ''}) · raiz ${raiz}`);
  console.log('| Raça | Partidas | Vitórias | Empates | Derrotas | Taxa |'); console.log('|---|---|---|---|---|---|');
  for (const f of R) { const T = tab[f]; console.log(`| ${f} | ${T.n} | ${T.v} | ${T.e} | ${T.d} | ${(taxa(f) * 100).toFixed(1)}% |`); }
  console.log(`Eliminações ${elim}/${n11}, duração média das eliminações ${mmss(med(dur))} · faixa 40–60%: ${faixa ? 'dentro' : 'FORA'}`);
  console.log('Duplas: ' + Object.entries(pares).map(([k, v]) => k + ' ' + Object.entries(v).map(([f, p]) => f + ' ' + p).join('/')).join(' · '));
  if (q4) console.log('4 jogadores (' + dur4.length + ' partidas, duração média ' + mmss(med(dur4)) + '): ' + R.map(f => f + ' ' + t4[f].pts.toFixed(1) + '/' + t4[f].n).join(' · '));
  if (Object.keys(pec).length) console.log('Peças (partidas em que o lado a teve · taxa de vitória de quem teve · usos): ' + Object.entries(pec).sort().map(([k, q]) => k + ' ' + q.n + ' · ' + (q.pts / q.n * 100).toFixed(0) + '% · ' + q.usos).join(' | '));
  if (cacs.length) console.log('Caçada só de IAs (Normal): ' + cacs.map(r => r.chefe + ' ' + r.racas.join('+') + ' ' + r.fim + ' ' + mmss(r.t)).join(' · ') + (cacOk ? ' · todas abaixo de 20 min' : ' · ALGUMA ACIMA DE 20 MIN OU SEM VITÓRIA'));
  console.log(`ARD.ai.think: ${out.thinkMsPorChamada} ms por chamada (média) · ${out.seg} s no total${erros.length ? ' · ERROS: ' + erros.length + ' ' + erros[0].erro : ''}`);
})();
