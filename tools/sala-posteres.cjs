/* Aether Rift: Dominion — pôsteres da Sala de Comando (5.0a.1). Renderiza a própria Sala (Motor 5, WebGPU) num Chromium sem janela, uma foto
   por Raça e por tela, sem a interface por cima, e grava:
     assets/sala-<raça>-pc2560.webp   2560×1440 (computador grande)
     assets/sala-<raça>-pc1920.webp   1920×1080 (computador)
     assets/sala-<raça>-pe.webp       390×844 em 3x = 1170×2532 (celular em pé)
     assets/sala-<raça>-deitado.webp  844×390 em 3x = 2532×1170 (celular deitado)
     assets/sala-posteres.json        a âncora do palco, a câmera (posição, alvo, abertura e centro de projeção), os planetas, o rasgo e onde
                                      ficam o holograma e a Fenda em cada pôster (o build embute como ARD.SALA_POSTERES)
   A página abre com ?poster=1: a Sala completa, sem a entrada de câmera, sem balanço, na densidade da tela e com as partículas da Fenda já
   assentadas. Uso: NODE_PATH=<node_modules com playwright> node tools/sala-posteres.cjs [racas=vehnar,tessara] [telas=pc1920,pe] [paralelo=2] [qualidade=0.86]
   Na GPU por software (SwiftShader) cada pôster leva de 1 a 4 min. Depois rode node tools/build.mjs (copia para dist/assets e embute os dados). */
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path'); const { execFileSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..'); const ARGS = Object.fromEntries(process.argv.slice(2).map(a => a.split('=')));
const RACAS = (ARGS.racas || 'vehnar,erevane,tessara,quorith,vorag').split(',');
const TELAS = { pc2560: { viewport: { width: 2560, height: 1440 }, deviceScaleFactor: 1 }, pc1920: { viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 },
  pe: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }, deitado: { viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true } };
const QUAL = { pc2560: 0.84, pc1920: 0.86, pe: 0.84, deitado: 0.84 }; const QK = ARGS.qualidade ? +ARGS.qualidade : null;
const JSONF = path.join(ROOT, 'assets', 'sala-posteres.json');
const FLAGS = ['--no-sandbox', '--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-webgpu-adapter=swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--allow-file-access-from-files', '--disable-dev-shm-usage'];
const ESCONDE = '#start .start-wrap,#start .st-veil,#st-cta,#sala-tag,#sala-sair,#academia,#sala-flash{visibility:hidden!important}';
async function um(b, race, tela) { const t0 = Date.now(); const ctx = await b.newContext(TELAS[tela]); const p = await ctx.newPage(); p.setDefaultTimeout(1800000); const erros = [];
  p.on('pageerror', e => erros.push(e.message.slice(0, 200))); p.on('console', m => { if (m.type() === 'error') erros.push(m.text().slice(0, 200)); });
  await p.addInitScript(r => { try { localStorage.setItem('ard-beta-prefs', JSON.stringify({ faction: r })); } catch (e) {} }, race); /* a vitrine abre na Raça do pôster */
  await p.goto('file://' + ROOT + '/dist/local.html?poster=1&vitrine=3d', { waitUntil: 'load' });
  await p.waitForFunction(() => { const i = window.ARD && ARD.sala && ARD.sala.info(); return i && i.ready && i.frames > 0; }, null, { timeout: 1800000, polling: 1000 });
  await p.evaluate(() => document.fonts && document.fonts.ready);
  /* as partículas da Fenda assentam (4 s de simulação em passos de 1/30 s) e a interface sai da frente (o layout fica: visibility) */
  await p.evaluate(async esc => { const c = ARD.sala.ctx(); if (c.fenda && c.fenda.cUpd) { for (let i = 0; i < 120; i++) { c.fenda.dt.value = 1 / 30; c.renderer.compute(c.fenda.cUpd); } }
    const s = document.createElement('style'); s.textContent = esc; document.head.appendChild(s); ARD.sala.kick(4000); if (c.fila) await c.fila.onSubmittedWorkDone(); }, ESCONDE);
  const f0 = await p.evaluate(() => ARD.sala.info().frames); await p.waitForFunction(f => ARD.sala.info().frames >= f + 2, f0, { timeout: 1800000, polling: 500 }); await p.waitForTimeout(500);
  const meta = await p.evaluate(() => ARD.sala.posterInfo()); const png = await p.screenshot({ type: 'png' });
  /* WebP pelo próprio Chromium (canvas.toDataURL), na resolução da foto */
  const webp = await p.evaluate(async ([b64, q]) => { const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode(); const cv = document.createElement('canvas'); cv.width = im.naturalWidth; cv.height = im.naturalHeight; cv.getContext('2d').drawImage(im, 0, 0); return cv.toDataURL('image/webp', q).split(',')[1]; }, [png.toString('base64'), QK || QUAL[tela]]);
  const arq = 'sala-' + race + '-' + tela + '.webp'; const buf = Buffer.from(webp, 'base64'); fs.writeFileSync(path.join(ROOT, 'assets', arq), buf);
  await ctx.close(); console.log('  ' + arq + ' · ' + Math.round(buf.length / 1024) + ' KB · ' + meta.w + '×' + meta.h + ' em ' + meta.dpr + 'x · ' + Math.round((Date.now() - t0) / 1000) + ' s' + (erros.length ? ' · erros: ' + erros.slice(0, 3).join(' | ') : ''));
  if (erros.length) throw new Error(arq + ': ' + erros[0]); return { race, tela, meta, arq, bytes: buf.length }; }
(async () => { if (ARGS.build !== '0') console.log(execFileSync(process.execPath, ['tools/build.mjs'], { cwd: ROOT, encoding: 'utf8' }).trim());
  const fila = []; for (const tela of (ARGS.telas || 'pc1920,pc2560,pe,deitado').split(',')) for (const race of RACAS) fila.push([race, tela]); const total = fila.length;
  const D = fs.existsSync(JSONF) ? JSON.parse(fs.readFileSync(JSONF, 'utf8')) : { variantes: {} }; const feitos = [];
  const trab = async () => { const b = await chromium.launch({ headless: true, args: FLAGS }); try { while (fila.length) { const [race, tela] = fila.shift(); let r = null; for (let k = 0; k < 2 && !r; k++) { try { r = await um(b, race, tela); } catch (e) { console.log('  falhou ' + race + '/' + tela + ' (' + e.message.slice(0, 160) + ')' + (k ? '' : ', de novo')); } } if (r) feitos.push(r); } } finally { await b.close(); } };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(2, +(ARGS.paralelo || 1))) }, trab)); /* no máximo 2 navegadores ao mesmo tempo (máquina dividida) */
  for (const { race, tela, meta, arq, bytes } of feitos) { const V = D.variantes[tela] = D.variantes[tela] || {}; V.w = meta.w; V.h = meta.h; V.dpr = meta.dpr; V.racas = V.racas || {};
    V.racas[race] = { arquivo: arq, bytes, anc: meta.anc, palcoH: meta.palcoH, cam: meta.cam, planetas: meta.planetas, rasgo: meta.rasgo, fx: meta.fx }; }
  D.versao = '5.0a.1'; D.gerado = new Date().toISOString().slice(0, 16) + 'Z'; D.ferramenta = 'tools/sala-posteres.cjs'; fs.writeFileSync(JSONF, JSON.stringify(D, null, 1) + '\n');
  console.log('pôsteres: ' + feitos.length + ' de ' + total + ' · dados em assets/sala-posteres.json · rode node tools/build.mjs'); process.exit(feitos.length ? 0 : 1); })();
