// 5.0h — custo do ARD.ai.think por chamada e por tique, com 1, 3 e 7 IAs (mais um jogador humano parado, para a partida não acabar),
// no Node (V8) e no Firefox (SpiderMonkey, via Playwright). Mede a média por chamada, a média por tique (a IA pensa a cada 10 tiques) e o pico
// de um tique de IA depois do primeiro minuto (o aquecimento do JIT fica de fora). Mesma semente e mesmos comandos nos dois motores.
// Uso: NODE_PATH=<node_modules com playwright> node tools/ia-custo.cjs [--min=12] [--raiz=<pasta com src/>] [--sem-firefox] [--json]
const path = require('path'); const fs = require('fs');
const arg = (k, d) => { const a = process.argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const raiz = path.resolve(arg('raiz', path.join(__dirname, '..'))); const min = +arg('min', 12); const JSONOUT = process.argv.includes('--json');
/* o laço medido (o mesmo texto roda no Node e na página) */
const MEDE = function (n, min, agora) {
  const S = globalThis.ARD.sim, AI = globalThis.ARD.ai; const R = ['vehnar', 'erevane', 'tessara', 'quorith', 'vorag', 'vehnar', 'erevane'];
  const players = [{ name: 'Eu', faction: 'tessara', human: true }].concat(R.slice(0, n).map((f, i) => ({ name: f + i, faction: f, difficulty: 'normal' })));
  const sim = S.createSim({ seed: 42, players, minutes: 30, mapV: 1 }); const ais = sim.players.filter(p => !p.human).map(p => AI.create(p.id, p.difficulty));
  let total = 0, chamadas = 0, pico = 0, picoT = 0, somaTiques = 0, step = 0;
  for (let i = 0; i < min * 600 && !sim.result; i++) {
    if (sim.tick % 10 === 0) { const t0 = agora(); for (const a of ais) { for (const c of AI.think(sim, a)) S.enqueue(sim, c); chamadas++; } const d = agora() - t0; total += d; if (sim.time >= 60 && d > pico) { pico = d; picoT = Math.round(sim.time); } }
    const s0 = agora(); S.step(sim); step += agora() - s0; somaTiques++; }
  return { n, chamadas, msPorChamada: +(total / chamadas).toFixed(3), msPorTique: +(total / somaTiques).toFixed(3), picoTiqueIA: +pico.toFixed(2), picoEm: picoT, stepMsPorTique: +(step / somaTiques).toFixed(2), tiques: somaTiques };
};
const out = { raiz, min, node: [], firefox: null };
globalThis.ARD = {}; for (const f of ['modos.js', 'chefes-sim.js', 'mundo.js', 'unicas-sim.js', 'sim.js', 'ai.js']) { const p = path.join(raiz, 'src', f); if (fs.existsSync(p)) require(p); }
const { performance } = require('perf_hooks'); for (const n of [1, 3, 7]) out.node.push(MEDE(n, min, () => performance.now()));
(async () => {
  if (!process.argv.includes('--sem-firefox')) { let pw = null; try { pw = require('playwright'); } catch (e) {}
    if (pw) { const html = path.join(raiz, 'dist', 'ia-custo.html'); fs.mkdirSync(path.dirname(html), { recursive: true });
      fs.writeFileSync(html, '<!doctype html><meta charset="utf-8"><title>ia-custo</title>' + ['modos.js', 'chefes-sim.js', 'mundo.js', 'unicas-sim.js', 'sim.js', 'ai.js'].filter(f => fs.existsSync(path.join(raiz, 'src', f))).map(f => '<script src="../src/' + f + '"></script>').join('') + '<script>window.MEDE = ' + MEDE.toString() + ';</script>');
      try { const b = await pw.firefox.launch({ headless: true }); const p = await b.newPage(); p.setDefaultTimeout(1800000); await p.goto('file://' + html); out.firefox = [];
        for (const n of [1, 3, 7]) out.firefox.push(await p.evaluate(([n, m]) => window.MEDE(n, m, () => performance.now()), [n, min])); await b.close(); } catch (e) { out.firefox = { erro: String(e.message).split('\n')[0].slice(0, 200) }; } } }
  if (JSONOUT) { console.log(JSON.stringify(out)); return; }
  console.log('Custo do ARD.ai.think · ' + min + ' min de partida · raiz ' + raiz + ' (performance.now do Firefox tem resolução de 1 ms: a média por chamada vale, o pico é arredondado)');
  console.log('| Motor | IAs | ms por chamada | ms por tique (média) | pico de um tique de IA (depois de 1 min) | step ms por tique |'); console.log('|---|---|---|---|---|---|');
  for (const [m, rs] of [['Node', out.node], ['Firefox', out.firefox]]) if (Array.isArray(rs)) for (const r of rs) console.log(`| ${m} | ${r.n} | ${r.msPorChamada} | ${r.msPorTique} | ${r.picoTiqueIA} (aos ${r.picoEm} s) | ${r.stepMsPorTique} |`); else if (rs) console.log('| ' + m + ' | erro | ' + rs.erro + ' |');
})();
