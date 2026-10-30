/* Aether Rift: Dominion — pôsteres da Sala de Comando (5.0a.1; 5.0a.2: refeitos com a luz nova e com a luz de cada um no registro; 5.0b.1: a Sala um pouco mais clara, e o registro da luz ganha a metade esquerda, o holograma sobre o fundo e o bloom). Renderiza a própria Sala (Motor 5, WebGPU) num Chromium sem janela, uma foto
   por Raça e por tela, sem a interface por cima, e grava:
     assets/sala-<raça>-pc2560.webp   2560×1440 (computador grande)
     assets/sala-<raça>-pc1920.webp   1920×1080 (computador)
     assets/sala-<raça>-pe.webp       390×844 em 3x = 1170×2532 (celular em pé)
     assets/sala-<raça>-deitado.webp  844×390 em 3x = 2532×1170 (celular deitado)
     assets/sala-posteres.json        a âncora do palco, a câmera (posição, alvo, abertura e centro de projeção), os planetas, o rasgo e onde
                                      ficam o holograma e a Fenda em cada pôster (o build embute como ARD.SALA_POSTERES)
   A página abre com ?poster=1: a Sala completa, sem a entrada de câmera, sem balanço, na densidade da tela e com as partículas da Fenda já
   assentadas. Uso: NODE_PATH=<node_modules com playwright> node tools/sala-posteres.cjs [racas=vehnar,tessara] [telas=pc1920,pe] [paralelo=2] [qualidade=0.86]
   Na GPU por software (SwiftShader) cada pôster leva de 1 a 4 min. Depois rode node tools/build.mjs (copia para dist/assets e embute os dados).
   5.0b.1: [fotos=<pasta>] guarda também, para medir (work/dev/medir.py): a foto sem o véu e com o véu da página, a cena HDR e o bloom lidos da GPU. */
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path'); const { execFileSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..'); const ARGS = Object.fromEntries(process.argv.slice(2).map(a => a.split('=')));
const RACAS = (ARGS.racas || 'vehnar,erevane,tessara,quorith,vorag').split(',');
const TELAS = { pc2560: { viewport: { width: 2560, height: 1440 }, deviceScaleFactor: 1 }, pc1920: { viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 },
  pe: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }, deitado: { viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true } };
const QUAL = { pc2560: 0.84, pc1920: 0.86, pe: 0.84, deitado: 0.84 }; const QK = ARGS.qualidade ? +ARGS.qualidade : null;
const JSONF = path.join(ROOT, 'assets', 'sala-posteres.json');
const FLAGS = ['--no-sandbox', '--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-webgpu-adapter=swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--allow-file-access-from-files', '--disable-dev-shm-usage'];
const ESCONDE = '#start .start-wrap,#start .st-veil,#st-cta,#sala-tag,#sala-sair,#academia,#sala-flash{visibility:hidden!important}';
/* 5.0b.1: o contexto do navegador fecha também quando a foto falha (antes, a página que falhou seguia desenhando no SwiftShader ao lado da nova tentativa) */
async function um(b, race, tela) { const ctx = await b.newContext(TELAS[tela]); try { return await foto(ctx, race, tela); } finally { await ctx.close().catch(() => {}); } }
async function foto(ctx, race, tela) { const t0 = Date.now(); const p = await ctx.newPage(); p.setDefaultTimeout(1800000); const erros = [];
  p.on('pageerror', e => erros.push(e.message.slice(0, 200))); p.on('console', m => { if (m.type() === 'error') erros.push(m.text().slice(0, 200)); });
  await p.addInitScript(r => { try { localStorage.setItem('ard-beta-prefs', JSON.stringify({ faction: r })); } catch (e) {} }, race); /* a vitrine abre na Raça do pôster */
  await p.goto('file://' + ROOT + '/dist/local.html?poster=1&vitrine=3d', { waitUntil: 'load' });
  await p.waitForFunction(() => { const i = window.ARD && ARD.sala && ARD.sala.info(); return i && i.ready && i.frames > 0; }, null, { timeout: 1800000, polling: 1000 });
  await p.evaluate(() => document.fonts && document.fonts.ready);
  /* as partículas da Fenda assentam (4 s de simulação em passos de 1/30 s) e a interface sai da frente (o layout fica: visibility) */
  await p.evaluate(async esc => { const c = ARD.sala.ctx(); if (c.fenda && c.fenda.cUpd) { for (let i = 0; i < 120; i++) { c.fenda.dt.value = 1 / 30; c.renderer.compute(c.fenda.cUpd); } }
    const s = document.createElement('style'); s.textContent = esc; document.head.appendChild(s); ARD.sala.kick(4000); if (c.fila) await c.fila.onSubmittedWorkDone(); }, ESCONDE);
  /* 5.0a.2: um quadro novo (já com as partículas assentadas e a interface fora) terminado na GPU basta (antes, dois quadros inteiros: no SwiftShader, minutos a mais por pôster) */
  const f0 = await p.evaluate(() => ARD.sala.info().frames); await p.waitForFunction(f => ARD.sala.info().frames >= f + 1, f0, { timeout: 1800000, polling: 250 });
  await p.evaluate(async () => { const c = ARD.sala.ctx(); c.renderer.setAnimationLoop(null); c.loop = false; /* 5.0b.1: o laço para depois desse quadro: a foto e a leitura do bloom são dele (sem esperar outro quadro em voo, minutos no SwiftShader) */
    if (c.fila) await c.fila.onSubmittedWorkDone(); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); }); await p.waitForTimeout(500);
  const meta = await p.evaluate(() => ARD.sala.posterInfo()); const png = await p.screenshot({ type: 'png' });
  /* 5.0b.1: o que o bloom soma, lido da GPU (luminância HDR antes da curva de tons e da exposição): média da tela e da metade esquerda. Com o clarão da 5.0a.1
     a metade esquerda do Kessari em 2560×1440 recebia 0,61; desde a 5.0a.2, cerca de 0,02. Com fotos=<pasta>, a cena e o bloom vão crus para a pasta */
  const fotos = ARGS.fotos ? path.resolve(ROOT, ARGS.fotos) : null; const nomeF = fotos ? path.join(fotos, 'depois-' + race + '-' + tela + '-r0') : null;
  const hdr = await p.evaluate(async cru => { const c = ARD.sala.ctx(), r = c.renderer; const out = { exposicao: r.toneMappingExposure * (c.U && c.U.expo ? c.U.expo.value : 1) /* a do mundo (C.U.expo, sala.js) */, limiar: c.bloom.threshold.value };
    const ler = async rt => { const w = rt.width, h = rt.height, a = await r.readRenderTargetPixelsAsync(rt, 0, 0, w, h); return { w, h, a }; };
    const h2f = v => { const e = (v >> 10) & 31, f = v & 1023, s = v & 32768 ? -1 : 1; return e === 0 ? s * f * 5.960464477539063e-8 : e === 31 ? 0 : s * Math.pow(2, e - 15) * (1 + f / 1024); };
    const b64 = a => { const u8 = new Uint8Array(a.buffer, a.byteOffset, a.byteLength); let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
    try { const B = await ler(c.bloom._renderTargetsHorizontal[0]); const passo = Math.ceil(B.w * 8 / 256) * 128, meio = B.w >> 1; let s = 0, se = 0; /* linhas alinhadas a 256 bytes (rgba16float: 8 bytes por pixel) */
      for (let y = 0; y < B.h; y++) for (let x = 0, i = y * passo; x < B.w; x++, i += 4) { const L = 0.2126 * h2f(B.a[i]) + 0.7152 * h2f(B.a[i + 1]) + 0.0722 * h2f(B.a[i + 2]); s += L; if (x < meio) se += L; }
      out.bloom = Math.round(s / (B.w * B.h) * 1000) / 1000; out.bloomEsq = Math.round(se / (meio * B.h) * 1000) / 1000;
      if (cru) { const C = await ler(c.sp.renderTarget); out.cena = { w: C.w, h: C.h, b64: b64(C.a) }; out.bloomCru = { w: B.w, h: B.h, b64: b64(B.a) }; } } catch (e) { out.erro = e.message; }
    return out; }, !!fotos);
  if (fotos) { fs.mkdirSync(fotos, { recursive: true }); fs.writeFileSync(nomeF + '-semveu.png', png); const ev = await p.addStyleTag({ content: '#start .st-veil{visibility:visible!important}' }); await p.screenshot({ path: nomeF + '.png' }); await ev.evaluate(n => n.remove());
    for (const [k, v] of [['cena', hdr.cena], ['bloom', hdr.bloomCru]]) if (v) { fs.writeFileSync(nomeF + '-' + k + '.f16', Buffer.from(v.b64, 'base64')); delete v.b64; } }
  /* WebP pelo próprio Chromium (canvas.toDataURL), na resolução da foto */
  /* 5.0a.2: a luz do pôster no registro: luma média (0 a 1), % da imagem estourada (algum canal >= 250) e, no holograma, a luma média e a estourada */
  const [webp, luz] = await p.evaluate(async ([b64, q, holo, dpr]) => { const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode(); const cv = document.createElement('canvas'); cv.width = im.naturalWidth; cv.height = im.naturalHeight; const g = cv.getContext('2d'); g.drawImage(im, 0, 0);
    const d = g.getImageData(0, 0, cv.width, cv.height).data; let s = 0, e = 0, sh = 0, eh = 0, nh = 0, se = 0, sa = 0, na = 0; const [hx, hy, hw, hh] = (holo || [0, 0, 0, 0]).map(v => Math.round(v * dpr)), meio = cv.width >> 1;
    const ax = hx - hw * 0.35, ay = hy - hh * 0.35, aw = hw * 1.7, ah = hh * 1.7; /* 5.0b.1: o anel em volta do holograma (a caixa crescida 35% para cada lado, menos a caixa), como na 5.0a.2 */
    for (let y = 0, i = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++, i += 4) { const L = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255, es = d[i] >= 250 || d[i + 1] >= 250 || d[i + 2] >= 250; s += L; if (es) e++; if (x < meio) se += L;
      if (x >= hx && x < hx + hw && y >= hy && y < hy + hh) { sh += L; nh++; if (es) eh++; } else if (x >= ax && x < ax + aw && y >= ay && y < ay + ah) { sa += L; na++; } }
    const n = cv.width * cv.height, r3 = v => Math.round(v * 1000) / 1000; return [cv.toDataURL('image/webp', q).split(',')[1], { luma: r3(s / n), lumaEsq: r3(se / (meio * cv.height)) /* 5.0b.1 */, estourado: Math.round(e / n * 10000) / 100, holoLuma: nh ? r3(sh / nh) : null, holoEstourado: nh ? Math.round(eh / nh * 10000) / 100 : null,
      holoFundo: na ? r3(sa / na) : null /* 5.0b.1: a luma do anel em volta; holoLuma ÷ holoFundo = o líder sobre o fundo (não pode cair) */ }]; },
    [png.toString('base64'), QK || QUAL[tela], meta.fx && meta.fx.holo, meta.dpr || 1]); meta.luz = luz;
  Object.assign(luz, { bloom: hdr.bloom, bloomEsq: hdr.bloomEsq, exposicao: Math.round(hdr.exposicao * 1000) / 1000 }); /* 5.0b.1: o bloom (HDR, antes da exposição) e a exposição da Sala no registro */
  if (fotos) fs.writeFileSync(path.join(fotos, 'depois-' + race + '-' + tela + '.json'), JSON.stringify({ race, tela, modo: 'poster', pagina: 'local', vp: TELAS[tela].viewport, dpr: TELAS[tela].deviceScaleFactor, pi: meta,
    rolagens: [{ y: 0, real: 0, holo: meta.fx && meta.fx.holo, hdr: { exp: hdr.exposicao, limiar: hdr.limiar, cena: hdr.cena, bloom: hdr.bloomCru } }] }, null, 1)); /* 5.0b.1: o mesmo formato de work/dev/medir.cjs */
  const arq = 'sala-' + race + '-' + tela + '.webp'; const buf = Buffer.from(webp, 'base64'); fs.writeFileSync(path.join(ROOT, 'assets', arq), buf);
  console.log('  ' + arq + ' · ' + Math.round(buf.length / 1024) + ' KB · ' + meta.w + '×' + meta.h + ' em ' + meta.dpr + 'x · ' + Math.round((Date.now() - t0) / 1000) + ' s · luma ' + luz.luma + ' · estourado ' + luz.estourado + '% · holograma ' + luz.holoLuma + ' (estourado ' + luz.holoEstourado + '%) sobre ' + luz.holoFundo + ' · bloom na metade esquerda ' + luz.bloomEsq /* 5.0b.1 */ + (erros.length ? ' · erros: ' + erros.slice(0, 3).join(' | ') : ''));
  if (erros.length) throw new Error(arq + ': ' + erros[0]); return { race, tela, meta, arq, bytes: buf.length }; }
(async () => { if (ARGS.build !== '0') console.log(execFileSync(process.execPath, ['tools/build.mjs'], { cwd: ROOT, encoding: 'utf8' }).trim());
  const fila = []; for (const tela of (ARGS.telas || 'pc1920,pc2560,pe,deitado').split(',')) for (const race of RACAS) fila.push([race, tela]); const total = fila.length;
  const feitos = [];
  /* 5.0a.2: cada pôster pronto entra no JSON na hora (lido de novo e trocado de uma vez, por arquivo temporário): uma rodada interrompida não perde os dados
     dos pôsteres que já fez, e duas rodadas com Raças ou telas diferentes podem andar juntas */
  const grava = r => { const { race, tela, meta, arq, bytes } = r; const D = fs.existsSync(JSONF) ? JSON.parse(fs.readFileSync(JSONF, 'utf8')) : { variantes: {} }; const V = D.variantes[tela] = D.variantes[tela] || {}; V.w = meta.w; V.h = meta.h; V.dpr = meta.dpr; V.racas = V.racas || {};
    V.racas[race] = { arquivo: arq, bytes, anc: meta.anc, palcoH: meta.palcoH, cam: meta.cam, planetas: meta.planetas, rasgo: meta.rasgo, fx: meta.fx, luz: meta.luz };
    D.versao = '5.0c' /* 5.0b.1: era '5.0a.2'; 5.0c: refeitos com o fundo em resolução cheia (a profundidade de campo em repouso) */; D.gerado = new Date().toISOString().slice(0, 16) + 'Z'; D.ferramenta = 'tools/sala-posteres.cjs'; const tmp = JSONF + '.' + process.pid + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(D, null, 1) + '\n'); fs.renameSync(tmp, JSONF); };
  const trab = async () => { const b = await chromium.launch({ headless: true, args: FLAGS }); try { while (fila.length) { const [race, tela] = fila.shift(); let r = null; for (let k = 0; k < 2 && !r; k++) { try { r = await um(b, race, tela); } catch (e) { console.log('  falhou ' + race + '/' + tela + ' (' + e.message.slice(0, 160) + ')' + (k ? '' : ', de novo')); } } if (r) { feitos.push(r); grava(r); } } } finally { await b.close(); } };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(2, +(ARGS.paralelo || 1))) }, trab)); /* no máximo 2 navegadores ao mesmo tempo (máquina dividida) */

  console.log('pôsteres: ' + feitos.length + ' de ' + total + ' · dados em assets/sala-posteres.json · rode node tools/build.mjs'); process.exit(feitos.length ? 0 : 1); })();
