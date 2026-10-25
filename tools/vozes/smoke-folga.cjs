// 5.0a.2: roda o MESMO smoke do tools/qa.cjs (o script do passo 6, lido do próprio qa.cjs, sem mudar nada) com mais tempo: o qa.cjs dá
// 15 min a esse passo, e com a máquina dividida (carga 40 a 55, uma partida levando ~3 min para carregar) ele estoura sem saída nenhuma.
// Uso: NODE_PATH=<node_modules com playwright> node tools/vozes/smoke-folga.cjs [minutos=60]
const { spawnSync } = require('child_process'); const fs = require('fs'); const path = require('path'); const root = path.resolve(__dirname, '../..');
const qa = fs.readFileSync(path.join(root, 'tools/qa.cjs'), 'utf8'); const ini = qa.indexOf("// 6) smoke no navegador"); const m = qa.slice(ini).match(/spawnSync\(process\.execPath, \['-e', `([\s\S]*?)`\], \{ cwd: root, encoding: 'utf8', timeout: (\d+)/);
if (!m) { console.error('não achei o script do smoke no qa.cjs'); process.exit(2); }
const script = m[1].replace(/\$\{JSON\.stringify\(root\)\}/g, JSON.stringify(root)); const min = +(process.argv[2] || 60); const t0 = Date.now();
const res = spawnSync(process.execPath, ['-e', script], { cwd: root, encoding: 'utf8', timeout: min * 60000, maxBuffer: 64 * 1024 * 1024, env: process.env });
let R = null; try { R = JSON.parse((res.stdout || '').trim().split('\n').pop()); } catch (e) { R = { erro: (res.stderr || res.stdout || '').slice(0, 400), sinal: res.signal }; }
const sm = R && R.racas ? Object.values(R.racas).filter(x => x.ok).length : 0; const ok = sm === 5 && R.inicio && R.inicio.ok && R.bench && R.bench.ok;
fs.writeFileSync(path.join(root, 'work/smoke-folga.json'), JSON.stringify(Object.assign({ limiteQaS: +m[2] / 1000, duracaoS: Math.round((Date.now() - t0) / 1000) }, R), null, 2));
console.log(`smoke (mesmo script do qa.cjs, limite ${min} min em vez de ${+m[2] / 60000}): ${ok ? '✅' : '❌'} ${sm}/5 Raças + tela inicial ${R.inicio && R.inicio.ok ? 'ok' : 'falhou'} + teste de desempenho ${R.bench && R.bench.ok ? 'ok' : 'falhou'} · ${Math.round((Date.now() - t0) / 1000)} s`); process.exit(ok ? 0 : 1);
