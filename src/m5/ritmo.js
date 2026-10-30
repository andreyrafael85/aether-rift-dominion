/* Aether Rift: Dominion — Motor 5 (5.0b.1): ritmo de quadros da partida e as chaves de teste do dono.
   O laço da partida (src/main.js, frame) nunca esperou a GPU: nenhum onSubmittedWorkDone, e as consultas de tempo (trackTimestamp) só leem
   o resultado de forma assíncrona (resolveTimestampsAsync → mapAsync, a cada 30 quadros; a cada 2 no teste de desempenho) sem segurar o
   desenho. O que a Sala tinha na 5.0a.1 (esperar a resposta da GPU e não desenhar) não existe aqui. Este arquivo põe na partida os dois
   modos de ritmo da Sala da 5.0a.2 (sem a troca automática numa placa de verdade) e as chaves para medir no aparelho:
   - ?ritmo=livre    o laço nunca espera a GPU e não pergunta nada a ela (nenhuma amostra de onSubmittedWorkDone);
   - ?ritmo=contido  no máximo um quadro na fila da GPU: enquanto o anterior não termina, o quadro de tela passa sem desenhar (a regra
                     da Sala na 5.0a.1);
   - sem a chave     contido só na GPU por software (SwiftShader, llvmpipe, lavapipe, WARP: lá a fila crescia sem limite); numa placa de
                     verdade, sempre livre: uma amostra da fila a cada 30 quadros desenhados só mede (quanto a resposta demora e quantos
                     quadros havia na fila, para a linha do teste de desempenho) e nunca troca o modo. A troca automática da Sala (45
                     quadros sem resposta ou fila acima de 12) não entra na partida: no Firefox o aviso de fim pode chegar atrasado sem a
                     GPU estar atrasada, e a troca faria o laço esperar à toa; o navegador já segura o rAF quando a GPU não acompanha;
   - ?ts=0           sem as consultas de tempo da GPU (o renderizador nasce com trackTimestamp desligado: nenhum timestampWrites nos passes,
                     nenhum resolveTimestampsAsync nem mapAsync); o teste de desempenho mostra "GPU por quadro: desligado";
   - ?laco=animloop  o quadro do jogo é chamado pelo laço do three (renderer.setAnimationLoop, um requestAnimationFrame só) no lugar do
                     requestAnimationFrame do jogo (?laco=raf, o padrão: o three roda o dele ao lado desde o init).
   O teste de desempenho grava a combinação em res.laco e mostra a linha "Laço (Motor 5)". Só visual e só o Motor 5: o clássico não passa aqui. */
(function (ARD) {
'use strict';
const M5 = ARD.m5 = ARD.m5 || {};
const Q = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
const pr = Q.get('ritmo');
M5.ritmoPedido = pr === 'livre' || pr === 'contido' ? pr : 'auto';
M5.semTs = Q.get('ts') === '0';
M5.laco = Q.get('laco') === 'animloop' ? 'animloop' : 'raf';
const SOFT = /swiftshader|llvmpipe|lavapipe|softpipe|software|warp|basic render/i;

/* o renderizador do jogo nasce no M5.create3d (src/m5/core.js); aqui ele ganha o estado do ritmo e, com ?ts=0, sem consultas de tempo */
const criar = M5.create3d;
if (typeof criar === 'function' && !criar.ardRitmo) {
  M5.create3d = function (canvas, R) {
    const X = criar.apply(this, arguments);
    if (M5.semTs && X.renderer && X.renderer.backend) X.renderer.backend.trackTimestamp = false; /* antes do init: o backend do r186 só liga o rastreio se a chave estiver ligada aqui */
    const st = X.ritmo = { pedido: M5.ritmoPedido, modo: M5.ritmoPedido === 'contido' ? 'contido' : 'livre', soft: false, fila: null, emVoo: false, amostra: null,
      n: 0, esperas: 0, respostas: [], filaMax: 0, trocas: [] }; /* esperas: quadros de tela que passaram sem desenhar (contido) */
    X.ready.then(() => { const be = X.renderer.backend; st.fila = X.isWebGPU && be && be.device ? be.device.queue : null;
      const ad = be && (be.device && be.device.adapterInfo || be.adapter && be.adapter.info); const nome = ad ? [ad.vendor, ad.architecture, ad.device, ad.description].join(' ') : '';
      st.soft = !!(ARD.gpuSoft || (ad && (ad.isFallbackAdapter || SOFT.test(nome)))); st.adaptador = nome.trim() || null;
      if (st.pedido === 'auto' && st.soft) troca(st, 'contido', 'GPU por software'); }, () => {});
    const af = X.afterFrame; X.afterFrame = function () { const r = af.apply(this, arguments); depois(st); return r; }; /* fim do R.draw: o quadro foi enviado */
    return X;
  };
  M5.create3d.ardRitmo = true;
}
function troca(st, modo, porque) { if (st.modo === modo) return; st.modo = modo; st.amostra = null; if (st.trocas.length < 20) st.trocas.push(modo + ' (' + porque + ')'); }
/* depois de cada quadro desenhado: contido pede o aviso de fim (o próximo quadro só desenha depois dele); livre automático amostra a fila */
function depois(st) {
  const f = st.fila; if (!f) return; st.n++;
  if (st.modo === 'contido') { if (st.emVoo) return; st.emVoo = true; const t0 = performance.now();
    f.onSubmittedWorkDone().then(() => { nota(st, performance.now() - t0, 1); st.emVoo = false; }, () => { st.emVoo = false; }); /* contido só por pedido ou na GPU por software (que não sai dele) */
    return; }
  if (st.pedido !== 'auto') return; /* ?ritmo=livre: nenhuma pergunta à GPU */
  const a0 = st.amostra; if (a0) { a0.n++; return; } /* quadros desenhados até a resposta: a fila */
  if (st.n % 30 !== 0) return;
  const a = st.amostra = { n: 0, t0: performance.now() }; /* só mede: numa placa de verdade o modo não muda */
  f.onSubmittedWorkDone().then(() => { if (st.amostra !== a) return; st.amostra = null; nota(st, performance.now() - a.t0, a.n); }, () => { if (st.amostra === a) st.amostra = null; });
}
function nota(st, ms, q) { if (st.respostas.length < 4000) st.respostas.push(Math.round(ms * 10) / 10); if (q > st.filaMax) st.filaMax = q; }

/* src/main.js: no começo do quadro (true = este quadro de tela passa sem desenhar: o anterior ainda está na GPU) */
M5.ritmoEspera = function (R) { const X = R && R.m5, st = X && X.ritmo; if (!st || st.modo !== 'contido' || !st.emVoo) return false; st.esperas++; return true; };
/* src/main.js: o próximo quadro (requestAnimationFrame do jogo, ou o laço do three com ?laco=animloop) */
M5.agendar = function (R, fn) { const X = R && R.m5;
  if (X && M5.laco === 'animloop' && X.renderer && X.renderer.setAnimationLoop) { if (X.laco !== fn) { X.laco = fn; X.renderer.setAnimationLoop(fn); } return; }
  requestAnimationFrame(fn); };
M5.pararLaco = function (R) { const X = R && R.m5; if (X && X.laco) { X.laco = null; X.renderer.setAnimationLoop(null); } };
/* teste de desempenho: a combinação ligada e o que o ritmo viu (desde a marca do começo da medida) */
M5.ritmoMarca = function (R) { const st = R && R.m5 && R.m5.ritmo; if (!st) return; st.esp0 = st.esperas; st.resp0 = st.respostas.length; st.n0 = st.n; };
M5.ritmoInfo = function (R) { const X = R && R.m5, st = X && X.ritmo; if (!st) return null;
  const rs = st.respostas.slice(st.resp0 || 0).sort((a, b) => a - b), md = rs.length ? rs[rs.length >> 1] : null;
  return { ritmo: st.modo, pedido: st.pedido, ts: !!X.timestamp, laco: M5.laco, esperas: st.esperas - (st.esp0 || 0), desenhos: st.n - (st.n0 || 0), respostas: rs.length, respostaMs: md, respostaMax: rs.length ? rs[rs.length - 1] : null, filaMax: st.filaMax, trocas: st.trocas.slice(), soft: st.soft }; };
M5.ritmoTexto = function (l) { if (!l) return '—';
  return 'ritmo ' + l.ritmo + (l.pedido === 'auto' ? ' (automático)' : ' (?ritmo=' + l.pedido + ')') + ' · consultas de tempo ' + (l.ts ? 'ligadas' : M5.semTs ? 'desligadas (?ts=0)' : 'indisponíveis') +
    ' · laço ' + (l.laco === 'animloop' ? 'setAnimationLoop (?laco=animloop)' : 'requestAnimationFrame') + (l.esperas ? ' · ' + l.esperas + ' quadros esperando a GPU' : '') +
    (l.respostaMs != null ? ' · resposta da GPU ' + l.respostaMs + ' ms (máx. ' + l.respostaMax + ')' : '') + (l.trocas.length ? ' · trocou: ' + l.trocas.join(', ') : ''); };
})(globalThis.ARD = globalThis.ARD || {});
