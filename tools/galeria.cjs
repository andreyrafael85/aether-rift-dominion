// Galeria da documentação: renderiza cada unidade, construção e chefão com os modelos do próprio jogo (tools/galeria.html) em WebP,
// em docs/imagens/<raça>/<def>.webp e docs/imagens/chefoes/<def>.webp. A lista sai da simulação (src/sim.js): o que cada construção
// produz para cada Raça (producesFor), as construções e os modelos dos chefões (src/chefes-modelos.js).
// Uso: NODE_PATH=<pasta com node_modules/playwright> node tools/galeria.cjs [filtro: vehnar|erevane|tessara|quorith|vorag|chefoes] [w=560] [h=420]
// Precisa do three vendorizado em dist/vendor/ (node tools/vendor.mjs). Um navegador só, uma página só (SwiftShader).
'use strict';
const path = require('path'); const fs = require('fs'); const root = path.resolve(__dirname, '..');
const { chromium } = require('playwright');
globalThis.ARD = {}; require(root + '/src/modos.js'); require(root + '/src/chefes-sim.js'); require(root + '/src/sim.js');
const S = ARD.sim; const RACES = Object.keys(S.FACTIONS);
const only = process.argv[2] && process.argv[2] !== 'todas' && !process.argv[2].startsWith('--') ? process.argv[2].split(',') : null; const W = +(process.argv[3] || 560), H = +(process.argv[4] || 420);
const PRODUTORAS = ['nucleo', 'quartel', 'fabrica', 'hangar'];
function unidadesDe(r) { const out = []; for (const b of PRODUTORAS) for (const u of S.producesFor(b, r)) if (!out.includes(u)) out.push(u); return out; }
function construcoesDe(r) { return Object.keys(S.BUILDINGS).filter(b => b !== 'bastiao' || S.FACTIONS[r].superKey === 'fundicao'); }
/* chefões: o modelo de cada fase que a documentação mostra (o Arauto nas três fases e com o olho aberto; a Forja-Mãe, a perna e as baias abertas) */
const CHEFOES = [['chefe_arauto_1', 'fenda'], ['chefe_arauto_2', 'fenda'], ['chefe_arauto_3', 'fenda'], ['chefe_arauto_j', 'fenda'], ['chefe_pilar', 'fenda'], ['chefe_forja', 'fenda'], ['chefe_forja_b', 'fenda'], ['chefe_forja_perna', 'fenda'], ['chefe_sentinela', 'fenda'], ['catedral', 'quorith'], ['matriarca', 'vorag']];
/* a Forja-Mãe inteira: o corpo e as quatro pernas nos cantos do casco, como o src/chefes.js desenha (CANTOS e o ângulo de cada perna) */
const CANTOS = [[15, 12], [15, -12], [-15, 12], [-15, -12]]; const PERNAS = CANTOS.map(([x, z]) => ({ def: 'chefe_forja_perna', x, z, rot: Math.atan2(-z, x) }));
const jobs = [];
/* --giro=<def>[,<def>…]: animação de vitrine (o modelo gira com a animação do jogo correndo), quadros em dist/capturas-docs/giro-<def>/ para tools/animacao-montar.py */
const GIRO = (process.argv.find(a => a.startsWith('--giro=')) || '').slice(7);
if (GIRO) { for (const d of GIRO.split(',')) for (let i = 0; i < 60; i++) jobs.push({ race: 'vehnar', def: d, color: '#FF5E3A', out: 'dist/capturas-docs/giro-' + d.replace(/^chefe_/, '') + '/' + String(i).padStart(4, '0') + '.jpg', pitch: 0.38, yaw: Math.PI * 0.78 + i * (Math.PI * 2 / 60), anim: i / 12, partes: /^chefe_forja(_b)?$/.test(d) ? PERNAS : undefined, largura: /^chefe_forja(_b)?$/.test(d) ? 70 : undefined, jpg: true }); }
if (!GIRO) for (const r of RACES) { if (only && !only.includes(r)) continue; const cor = S.RACE_SHADES[r][0];
  for (const d of unidadesDe(r)) jobs.push({ race: r, def: d, color: cor, out: 'docs/imagens/' + r + '/' + d + '.webp' });
  for (const d of construcoesDe(r)) jobs.push({ race: r, def: d, color: cor, out: 'docs/imagens/' + r + '/' + d + '.webp', pitch: 0.62 }); }
if (!GIRO && (!only || only.includes('chefoes'))) for (const [d, r] of CHEFOES) jobs.push({ race: r === 'fenda' ? 'vehnar' : r, def: d, color: r === 'fenda' ? '#FF5E3A' : S.RACE_SHADES[r][0], out: 'docs/imagens/chefoes/' + d.replace(/^chefe_/, '') + '.webp', pitch: 0.42, partes: /^chefe_forja(_b)?$/.test(d) ? PERNAS : undefined, largura: /^chefe_forja(_b)?$/.test(d) ? 70 : undefined, yaw: d === 'chefe_forja_b' ? 0.35 : undefined });
(async () => {
  const t0 = Date.now(); const b = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--allow-file-access-from-files', '--disable-dev-shm-usage'] });
  const errs = []; let bytes = 0, n = 0;
  try {
    const p = await b.newPage({ viewport: { width: W, height: H } }); p.on('pageerror', e => errs.push(e.message.slice(0, 200))); p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
    await p.goto('file://' + root + '/tools/galeria.html', { waitUntil: 'load' }); await p.waitForFunction(() => window.__done === true, null, { timeout: 120000 });
    for (const j of jobs) {
      let r; try { r = await p.evaluate(o => window.foto(o), Object.assign({ w: W, h: H }, j)); } catch (e) { errs.push(j.out + ': ' + e.message.slice(0, 160)); continue; }
      const buf = Buffer.from(r.url.split(',')[1], 'base64'); if (!j.jpg && !/^RIFF....WEBP/s.test(buf.slice(0, 12).toString('latin1'))) { errs.push(j.out + ': não saiu WebP'); continue; }
      fs.mkdirSync(path.dirname(root + '/' + j.out), { recursive: true }); fs.writeFileSync(root + '/' + j.out, buf); bytes += buf.length; n++;
    }
  } finally { await b.close(); }
  console.log('galeria: ' + n + '/' + jobs.length + ' imagens, ' + (bytes / 1048576).toFixed(2) + ' MB, ' + ((Date.now() - t0) / 1000).toFixed(0) + ' s | erros: ' + (errs.join(' ; ') || 'nenhum'));
  if (errs.length) process.exitCode = 1;
})().catch(e => { console.error('galeria falhou:', e.message); process.exit(1); });
