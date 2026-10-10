// Determinismo entre motores JS: roda o mesmo jogo IA x IA no Node (V8) e em Chromium, Firefox e WebKit via Playwright.
// Uso: NODE_PATH=<pasta com node_modules/playwright> node tools/det-test.cjs [seed=7] [ticks=3000]
const path = require('path'); const fs = require('fs'); const root = path.resolve(__dirname, '..');
require(root + '/src/sim.js'); require(root + '/src/ai.js'); require(root + '/tools/det-run.js');
const seed = +(process.argv[2] || 7), ticks = +(process.argv[3] || 3000);
const t0 = Date.now(); const nodeHashes = globalThis.ARD_DET(seed, ticks);
console.log('node (V8): ' + nodeHashes.length + ' amostras em ' + (Date.now() - t0) + ' ms · última ' + nodeHashes[nodeHashes.length - 1]);
fs.mkdirSync(root + '/dist', { recursive: true });
fs.writeFileSync(root + '/dist/det.html', '<!doctype html><meta charset="utf-8"><title>det</title><script src="../src/sim.js"></script><script src="../src/ai.js"></script><script src="../tools/det-run.js"></script>');
const pw = require('playwright');
(async () => {
  for (const name of ['chromium', 'firefox', 'webkit']) {
    try {
      const b = await pw[name].launch({ headless: true, args: name === 'chromium' ? ['--no-sandbox', '--allow-file-access-from-files'] : [] });
      const p = await b.newPage(); await p.goto('file://' + root + '/dist/det.html');
      const hs = await p.evaluate(([s, t]) => ARD_DET(s, t), [seed, ticks]);
      await b.close();
      let first = -1; for (let i = 0; i < Math.max(hs.length, nodeHashes.length); i++) if (hs[i] !== nodeHashes[i]) { first = i; break; }
      console.log(name + ': ' + hs.length + ' amostras · ' + (first < 0 ? 'IGUAL ao Node' : 'DIVERGE na amostra ' + first + ' (' + nodeHashes[first] + ' vs ' + hs[first] + ')'));
    } catch (e) { console.log(name + ': falhou — ' + String(e.message).split('\n')[0].slice(0, 200)); }
  }
})();
