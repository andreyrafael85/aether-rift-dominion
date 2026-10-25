// 5.0a.2: falas numa partida de verdade, antes e depois. Roda partidas IA x IA no Node (src/sim.js + src/ai.js), pega os eventos do
// jogador 0 e chama ARD.audio.say como o src/main.js faz (audioFor/voiceFor), num relógio simulado e com uma voz imitada que leva o tempo
// de uma fala real (0,25 s + 14 caracteres por segundo). Compara o src/audio.js da base (git) com o atual.
// Uso: node tools/vozes/intervalos.cjs [base=fd3c2cd] [partidas=3] [minutos=20]
const path = require('path'), fs = require('fs'), vm = require('vm'), { execSync } = require('child_process'); const root = path.resolve(__dirname, '../..');
const base = process.argv[2] || 'fd3c2cd', partidas = +(process.argv[3] || 3), minutos = +(process.argv[4] || 20);
globalThis.ARD = {}; require(root + '/src/sim.js'); require(root + '/src/ai.js'); const S = ARD.sim, AI = ARD.ai;
const RACAS = ['vehnar', 'erevane', 'tessara', 'quorith', 'vorag'];
function voiceFor(text) { /* cópia de src/main.js */
  const t = text.toUpperCase();
  if (t.includes('SIFÃO')) return 'Alerta de sifão'; if (t.includes('NÚCLEO SOB')) return 'Núcleo sob ataque'; if (t.includes('BASE SOB')) return 'Base sob ataque';
  if (t.includes('QUEBROU')) return 'Pacto quebrado'; if (t.includes('TEMPESTADE')) return 'Tempestade de Éter'; if (t.includes('ELIMINADO')) return text; if (t.includes('PESQUISA')) return 'Pesquisa concluída';
  if (t.includes('PACTO DE NÃO')) return 'Pacto assinado'; if (t.includes('BLECAUTE')) return 'Blecaute'; if (t.includes('FUNDIÇÃO')) return 'Fundição Orbital'; if (t.includes('SALTO')) return 'Salto de Núcleo'; return null;
}
// 1) pedidos de fala de cada partida: [tempo em ms, texto, chave, intervalo]
const jogos = [];
for (let k = 0; k < partidas; k++) {
  const seed = 31 + k * 17, n = 3 + (k % 2); const players = []; for (let i = 0; i < n; i++) { const f = RACAS[(k + i * 2) % 5]; players.push({ name: f[0].toUpperCase() + f.slice(1), faction: f, difficulty: 'normal' }); }
  const sim = S.createSim({ seed, players, minutes: minutos }); const ais = sim.players.map(p => AI.create(p.id, p.difficulty)); const human = 0; const pedidos = [];
  for (let i = 0; i < minutos * 600; i++) {
    if (i % 10 === 0) for (const ai of ais) for (const c of AI.think(sim, ai)) S.enqueue(sim, c);
    const ev = S.step(sim); const t = Math.round(sim.time * 1000);
    for (const e of ev) {
      if (e.t === 'built' && e.p === human) pedidos.push([t, 'Construção concluída', 'built', 4]);
      else if (e.t === 'spawn' && e.p === human) pedidos.push([t, 'Unidade pronta', 'spawn', 5]);
      else if (e.t === 'alert' && e.p === human) { const v = voiceFor(e.text); if (v) pedidos.push([t, v, v, e.kind === 'danger' ? 8 : 15]); }
      else if (e.t === 'eliminated' && e.p !== human) { const left = sim.players.filter(x => x.alive && x.id !== human).length; pedidos.push([t, sim.players[e.p].name + ' eliminado. ' + (left > 0 ? left + (left > 1 ? ' inimigos restantes' : ' inimigo restante') : ''), 'elim', 0]); }
    }
    if (sim.result || !sim.players[human].alive) break;
  }
  jogos.push({ seed, racas: players.map(p => p.faction).join('+'), min: sim.time / 60, pedidos });
}
// 2) roda cada versão do audio.js num contexto isolado com relógio e voz imitados
function roda(src, pedidos) {
  let agora = 0; const timers = []; let seq = 0; const at = (ms, fn) => timers.push({ t: agora + Math.max(0, ms || 0), fn, s: seq++ });
  const until = t => { for (;;) { timers.sort((a, b) => a.t - b.t || a.s - b.s); const x = timers[0]; if (!x || x.t > t) break; timers.shift(); agora = x.t; x.fn(); } agora = t; };
  const M = { iniciadas: [], cortadas: 0, legendas: 0 };
  class U { constructor(t) { this.text = t; this.rate = 1; this.pitch = 1; this.voice = null; } }
  const q = []; let curU = null, endT = null; const pedidoDe = {}; /* hora do último pedido de cada texto: a fala que sai da fila mede o atraso desde o pedido */
  const fire = (u, k, e) => { try { if (u['on' + k]) u['on' + k](Object.assign({ type: k }, e || {})); } catch (er) { M.erro = String(er); } };
  function next() { curU = q.shift() || null; ss.speaking = !!curU; ss.pending = q.length > 0; if (!curU) return; const u = curU; M.iniciadas.push({ t: agora, text: u.text, pedido: u.__t }); fire(u, 'start');
    endT = { u }; const me = endT; at(250 + u.text.length / (14 * (u.rate || 1)) * 1000, () => { if (endT !== me || curU !== u) return; curU = null; fire(u, 'end'); next(); }); }
  const ss = { speaking: false, pending: false, paused: false, getVoices: () => [{ name: 'Microsoft Francisca Online (Natural) - Portuguese (Brazil)', lang: 'pt-BR', voiceURI: 'f' }],
    speak(u) { u.__t = pedidoDe[u.text] != null ? pedidoDe[u.text] : agora; q.push(u); ss.pending = !!curU || q.length > 1; if (!curU) next(); },
    cancel() { const pend = q.splice(0); for (const u of pend) fire(u, 'error', { error: 'canceled' }); if (curU) { const u = curU; curU = null; endT = null; M.cortadas++; fire(u, 'error', { error: 'interrupted' }); } ss.speaking = false; ss.pending = false; },
    resume() {}, addEventListener() {} };
  const ctx = { console, Math, JSON, Date, Set, Map, String, Object, Array, RegExp, Number, Boolean, CustomEvent: class { constructor(t, o) { this.type = t; this.detail = o && o.detail; } },
    localStorage: { getItem: () => null, setItem() {} }, performance: { now: () => agora }, setTimeout: (fn, ms) => at(ms, fn), clearTimeout() {}, speechSynthesis: ss, SpeechSynthesisUtterance: U, dispatchEvent() { return true; } };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.ARD = {}; vm.createContext(ctx); vm.runInContext(src, ctx);
  const A = ctx.ARD.audio; A.onSay = () => { M.legendas++; };
  for (const [t, text, key, cd] of pedidos) { until(t); pedidoDe[text] = t; A.say(text, key, cd); }
  until((pedidos.length ? pedidos[pedidos.length - 1][0] : 0) + 60000);
  return M;
}
function mede(M, minutos) {
  const por = {}; let rep = 0; const ult = {}; let atrasoMax = 0, atrasoSoma = 0, atrasados = 0, perigoAtras = 0;
  for (const x of M.iniciadas) { por[x.text] = (por[x.text] || 0) + 1; if (ult[x.text] != null && x.t - ult[x.text] < 10000) rep++; ult[x.text] = x.t; const a = x.t - (x.pedido != null ? x.pedido : x.t); atrasoSoma += a; atrasoMax = Math.max(atrasoMax, a); if (a > 1500) atrasados++; if (/sob ataque|sifão/i.test(x.text) && a > 800) perigoAtras++; }
  const unidade = por['Unidade pronta'] || 0, obra = por['Construção concluída'] || 0;
  return { falas: M.iniciadas.length, porMin: +(M.iniciadas.length / minutos).toFixed(2), unidadePorMin: +(unidade / minutos).toFixed(2), obraPorMin: +(obra / minutos).toFixed(2), repeticoes10s: rep, atrasoMedioS: +(atrasoSoma / Math.max(1, M.iniciadas.length) / 1000).toFixed(2), atrasoMaxS: +(atrasoMax / 1000).toFixed(1), atrasadas15: atrasados, perigoAtrasado: perigoAtras, cortadas: M.cortadas, legendas: M.legendas, erro: M.erro || null };
}
const antes = execSync('git show ' + base + ':src/audio.js', { cwd: root, encoding: 'utf8' }), depois = fs.readFileSync(root + '/src/audio.js', 'utf8');
const out = { base, partidas: [], total: {} }; const soma = { antes: [], depois: [] }; let minTot = 0, pedTot = 0;
for (const j of jogos) { const a = mede(roda(antes, j.pedidos), j.min), d = mede(roda(depois, j.pedidos), j.min); minTot += j.min; pedTot += j.pedidos.length; soma.antes.push([a, j.min]); soma.depois.push([d, j.min]);
  out.partidas.push({ seed: j.seed, racas: j.racas, minutos: +j.min.toFixed(1), pedidos: j.pedidos.length, antes: a, depois: d });
  console.log(`partida ${j.seed} (${j.racas}, ${j.min.toFixed(1)} min, ${j.pedidos.length} pedidos de fala)`); for (const [n, m] of [['antes ', a], ['depois', d]]) console.log(`  ${n}: ${m.falas} falas (${m.porMin}/min; "Unidade pronta" ${m.unidadePorMin}/min, "Construção concluída" ${m.obraPorMin}/min) · ${m.repeticoes10s} repetidas em <10 s · atraso médio ${m.atrasoMedioS} s, máx. ${m.atrasoMaxS} s, ${m.atrasadas15} com mais de 1,5 s · perigo atrasado ${m.perigoAtrasado} · cortadas ${m.cortadas} · legendas ${m.legendas}${m.erro ? ' · ERRO ' + m.erro : ''}`); }
for (const k of ['antes', 'depois']) { const t = {}; for (const [m] of soma[k]) for (const [c, v] of Object.entries(m)) if (typeof v === 'number') t[c] = (t[c] || 0) + v; out.total[k] = { falas: t.falas, porMin: +(t.falas / minTot).toFixed(2), unidadePorMin: +((t.unidadePorMin ? soma[k].reduce((s, [m, mi]) => s + m.unidadePorMin * mi, 0) : 0) / minTot).toFixed(2), obraPorMin: +(soma[k].reduce((s, [m, mi]) => s + m.obraPorMin * mi, 0) / minTot).toFixed(2), repeticoes10s: t.repeticoes10s, atrasoMaxS: Math.max(...soma[k].map(([m]) => m.atrasoMaxS)), atrasadas15: t.atrasadas15, perigoAtrasado: t.perigoAtrasado, cortadas: t.cortadas, legendas: t.legendas }; }
out.minutos = +minTot.toFixed(1); out.pedidos = pedTot; fs.mkdirSync(root + '/work', { recursive: true }); fs.writeFileSync(root + '/work/intervalos.json', JSON.stringify(out, null, 2));
console.log(`TOTAL ${out.minutos} min, ${pedTot} pedidos · antes ${out.total.antes.falas} falas (${out.total.antes.porMin}/min), ${out.total.antes.repeticoes10s} repetidas <10 s, atraso máx. ${out.total.antes.atrasoMaxS} s · depois ${out.total.depois.falas} falas (${out.total.depois.porMin}/min), ${out.total.depois.repeticoes10s} repetidas <10 s, atraso máx. ${out.total.depois.atrasoMaxS} s`);
