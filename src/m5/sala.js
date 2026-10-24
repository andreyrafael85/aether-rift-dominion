/* Aether Rift: Dominion — Sala de Comando (5.0b): o fundo vivo da tela inicial no Motor 5 (WebGPURenderer do three r186 com TSL, que volta
   sozinho para WebGL2). Um diorama da base da Raça no mundo natal, com os modelos do jogo, céu físico com nuvens (SkyMesh) e luz de ambiente
   pelo céu (PMREM), uma sombra só sobre o diorama (5.0a.1; antes, cascatas), o líder em holograma sobre o Núcleo (sala-holo.js), os cinco mundos natais como
   planetas só em shader e as partículas fluidas da Fenda num compute shader (sala-mundo.js), a mesa tática e a Academia de Comando
   (sala-mesa.js) e o som 3D (sala-som.js). Pós em RenderPipeline: profundidade de campo, bloom e FXAA. Câmera e transições com GSAP no
   MESMO laço do render (gsap.ticker.remove(gsap.updateRoot) e gsap.updateRoot(t) dentro do setAnimationLoop).
   Versões: completa no computador (ou ?fundo=vivo). 5.0a.1: no toque, com movimento reduzido, com ?logo=estatico e na GPU por software fica
   o pôster de sala-poster.js (render da própria Sala, com movimento 2D no celular); a cena leve de antes só com ?fundo=leve; ?fundo=classico
   volta ao fundo 4.3 (ui-fx). Se o Motor 5 não subir, fica o pôster (sem ele, o ui-fx). A Sala entra por cima do pôster, no mesmo
   enquadramento; stop() para tudo na hora e solta os recursos da GPU assim que a fila dela esvazia. */
(function (ARD) {
'use strict';
/* 5.0b: o build troca este prefixo pelo vendor no dist/local.html; o three.core.js que o three.webgpu.js importa é o mesmo núcleo do jogo (importmap) */
const CDN = 'https://cdn.jsdelivr.net/npm/three@0.186.1/';
const URLS = { webgpu: CDN + 'build/three.webgpu.js', tsl: CDN + 'build/three.tsl.js', sky: CDN + 'examples/jsm/objects/SkyMesh.js', /* 5.0a.1: sem o CSMShadowNode (sombra única) */
  bloom: CDN + 'examples/jsm/tsl/display/BloomNode.js', dof: CDN + 'examples/jsm/tsl/display/DepthOfFieldNode.js', fxaa: CDN + 'examples/jsm/tsl/display/FXAANode.js', gsap: 'https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js' };
const RACES = ['vehnar', 'erevane', 'tessara', 'quorith', 'vorag'];
const FOV0 = 42; /* abertura da câmera em repouso (o voo entre Raças fecha e volta) */
/* fora do celular em pé, a abertura mantém a distância focal de 1920×1080 em px (42° em 1080 de altura, 54° em 1440, menos em telas baixas): a composição em volta do palco fica igual em qualquer tela, o horizonte não sobe por cima dos planetas e as telas baixas não deformam o céu */
function celular() { return innerWidth < 700 || innerHeight < 560; } /* celular em pé ou deitado: palco pequeno, enquadramentos próprios */
function fovBase() { const h = innerHeight; return innerWidth >= 700 ? Math.max(24, Math.min(60, 2 * Math.atan(h / 2 / 1407) * 180 / Math.PI)) : FOV0; }
const COR = { vehnar: 0xff7733, erevane: 0x33ffd0, tessara: 0x55e68a, quorith: 0xb388ff, vorag: 0xe6455a };
const qs = () => new URLSearchParams(location.search);
const coarse = () => { try { return matchMedia('(pointer: coarse)').matches; } catch (e) { return false; } };
const reduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
let LIB = null, S = null, falhou = false;
/* ---------- carga: build WebGPU do three, TSL, addons e GSAP ---------- */
function mapa(k) { try { for (const s of document.querySelectorAll('script[type=importmap]')) { const m = JSON.parse(s.textContent || '{}'); if (m.imports && m.imports[k]) return m.imports[k]; } } catch (e) {} return null; }
function script(src) { return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.async = true; s.onload = () => res(); s.onerror = () => rej(new Error('GSAP indisponível')); document.head.appendChild(s); }); }
let LIBP = null; function libs() { return LIBP || (LIBP = carregarLibs().catch(e => { LIBP = null; throw e; })); } /* 5.0a.1: uma carga só, mesmo pedida duas vezes (preparar e mount) */
async function carregarLibs() { if (LIB) return LIB;
  const temW = !!mapa('three/webgpu'), temT = !!mapa('three/tsl');
  /* os addons do r186 importam "three/webgpu" e "three/tsl": se o importmap da página ainda não tem as chaves (a fundação 5.0a acrescenta), a Sala acrescenta um importmap só com elas */
  if (!temW || !temT) { const im = {}; if (!temW) im['three/webgpu'] = URLS.webgpu; if (!temT) im['three/tsl'] = URLS.tsl; const s = document.createElement('script'); s.type = 'importmap'; s.textContent = JSON.stringify({ imports: im }); document.head.appendChild(s); }
  const W = await import(temW ? 'three/webgpu' : URLS.webgpu);
  const [T, SK, BL, DF, FX] = await Promise.all([import(temT ? 'three/tsl' : URLS.tsl), import(URLS.sky), import(URLS.bloom), import(URLS.dof), import(URLS.fxaa)]);
  if (!window.gsap) await script(URLS.gsap);
  if (!window.gsap) throw new Error('GSAP indisponível');
  LIB = { W, T, SkyMesh: SK.SkyMesh, bloom: BL.bloom, dof: DF.dof, fxaa: FX.fxaa, gsap: window.gsap }; return LIB; }
/* que versão este aparelho recebe: 'vivo' (completa), 'leve' (só com ?fundo=leve) ou null (fica o pôster de sala-poster.js, ou o fundo de antes) */
/* 5.0a.1: toque, movimento reduzido e ?logo=estatico deixaram de montar a cena 3D leve (borrada no celular): ficam com o pôster nítido e um movimento 2D leve */
function want() { const q = qs(), f = q.get('fundo'); if (falhou || f === 'off' || f === 'classico') return null; if (!ARD.salaMundo || !ARD.meshes) return null; if (f === 'vivo' || q.get('poster') === '1') return 'vivo'; if (f === 'leve') return 'leve';
  if (ARD.gpuSoft || (ARD.semWebGL && !navigator.gpu)) return null; if (coarse() || reduced() || q.get('logo') === 'estatico') return null; return 'vivo'; } /* sem WebGL e sem WebGPU não há onde desenhar */
/* ---------- montagem em etapas (5.0a.1) ----------
   1) céu, planetas, Fenda e ar: criados primeiro e já mandados compilar (o processo da GPU compila enquanto a linha principal segue);
   2) o diorama (chão, base, fumaça, busto e mesa) na linha principal, com pausas, e compilado em paralelo à medida que fica pronto;
   3) aquecimento fora da tela: dois quadros de verdade (em densidade baixa) com o canvas invisível criam o que o compileAsync não alcança (pós,
      sombra, compute) e sobem as texturas; a GPU termina esse trabalho antes de a Sala aparecer;
   4) a Sala entra por cima do pôster num cruzamento suave (GSAP), no mesmo enquadramento do pôster, e depois desliza para o desta tela. */
async function mount(host, race) {
  const modo = want(); if (!modo || S || !host || host.hidden) return false; const q = qs();
  const st = S = { modo, vivo: modo === 'vivo', host, race: RACES.includes(race) ? race : 'vehnar', ready: false, frames: 0, t0: performance.now(), disp: [], tw: [], on: [], aba: 'jogar', modoCam: 'repouso', anim: false, prK: 1, slow: 0, forced: q.get('fundo') === 'vivo' || q.get('poster') === '1', posterTool: q.get('poster') === '1', med: {} };
  const alive = () => S === st; const marca = k => { st.med[k] = Math.round(performance.now() - st.t0); };
  try {
    await libs(); if (!alive()) return false; marca('carga');
    const { W, T, gsap } = LIB; const M = ARD.salaMundo;
    const cv = document.createElement('canvas'); cv.id = 'sala-bg'; cv.setAttribute('aria-hidden', 'true'); const pst = document.getElementById('sala-poster'); host.insertBefore(cv, pst && pst.parentNode === host ? pst.nextSibling : (host.children[1] || null)); st.cv = cv; /* por cima do pôster */
    const forceGL = q.get('m5gl') === '1' || q.get('motor') === 'webgl2' || !navigator.gpu;
    const renderer = new W.WebGPURenderer({ canvas: cv, antialias: false, alpha: false, forceWebGL: forceGL, powerPreference: st.vivo ? 'high-performance' : 'low-power' }); st.renderer = renderer;
    await renderer.init(); if (!alive()) { try { renderer.dispose(); } catch (e) {} return false; } marca('init');
    st.gpu = !!renderer.backend.isWebGPUBackend; st.fila = st.gpu && renderer.backend.device ? renderer.backend.device.queue : null; st.libera = () => { st.emVoo = false; }; /* ritmo pela GPU (ver frame) */
    renderer.toneMapping = W.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.95; renderer.shadowMap.enabled = true; renderer.shadowMap.type = W.PCFShadowMap;
    const scene = st.scene = new W.Scene(), camera = st.camera = new W.PerspectiveCamera(40, innerWidth / innerHeight, 1, 6000);
    st.rig = { az: 0, pol: 1.2, rad: 150, tx: 0, ty: 56, tz: 10, fov: fovBase() }; st.par = { x: 0, y: 0 }; st.anc = { x: innerWidth * 0.3, y: innerHeight * 0.45 }; st.tmp = { v: new W.Vector3(), v2: new W.Vector3(), cp: new W.Vector3(), ct: new W.Vector3() };
    const C = st.C = { L: LIB, leve: !st.vivo, nPart: st.vivo ? (st.gpu ? 65536 : 16384) : (st.gpu ? 8192 : 0), U: { sol: T.uniform(new W.Vector3(0, 1, 0)) }, tick: () => (window.scheduler && scheduler.yield ? scheduler.yield() : new Promise(r => setTimeout(r, 0))), st }; st.U = C.U; /* cede a vez entre um modelo e outro (sem depender do ritmo dos quadros) */
    /* 5.0a.1: sol com UMA sombra (2048 na completa) só sobre o diorama, desenhada uma vez por mundo (o que anda não faz sombra): sem as três cascatas do CSM,
       sem o passe de sombra a cada quadro e com shaders menores em tudo o que recebe luz; o busto tem a luz de estúdio dele */
    const sun = st.sun = new W.DirectionalLight(0xffffff, 2.4); sun.castShadow = true; const sm = st.vivo ? 2048 : 1024; sun.shadow.mapSize.set(sm, sm); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.7; sun.shadow.radius = st.vivo ? 3 : 2;
    { const sc = sun.shadow.camera; sc.near = 1; sc.far = 1400; sc.left = -250; sc.right = 250; sc.top = 250; sc.bottom = -250; sc.updateProjectionMatrix(); } sun.shadow.autoUpdate = false; sun.shadow.needsUpdate = true;
    scene.add(sun, sun.target); const hemi = st.hemi = new W.HemisphereLight(0x8fb3ff, 0x2a2018, 0.3); scene.add(hemi);
    C.luzMundo = T.lights([sun, hemi]); C.mats = M.modelos(C);
    /* pós: cena → profundidade de campo (completa) → bloom → tons ACES → FXAA (criado antes de compilar: o alvo da compilação é a passagem da cena) */
    const pipe = st.pipe = new W.RenderPipeline(renderer); pipe.outputColorTransform = false;
    const sp = st.sp = T.pass(scene, camera), col = sp.getTextureNode('output'), viewZ = sp.getViewZNode();
    C.U.foco = T.uniform(130); C.U.focal = T.uniform(st.vivo ? 260 : 300); C.U.bokeh = T.uniform(0); /* em repouso quase nada de desfoque (planetas nítidos); o foco num modelo abre a profundidade de campo */
    const src = st.vivo ? LIB.dof(col, viewZ, C.U.foco, C.U.focal, C.U.bokeh) : col; st.bloomK = st.vivo ? 0.62 : 0.4; st.bloom = LIB.bloom(src, st.bloomK, 0.42, st.vivo ? 0.8 : 0.86);
    pipe.outputNode = LIB.fxaa(T.renderOutput(src.add(st.bloom))); /* um grafo só: trocar o outputNode no r186 recompila bloom e saída a cada troca (medido: 4 a 8 pipelines no quadro) */
    const ab = document.querySelector('.ctab.on'); st.aba = (ab && ab.dataset.tab) || 'jogar';
    /* ETAPA 1: céu, planetas, Fenda (partículas em compute) e ar */
    st.H = M.relevo(st.race); M.chaoDe(C, st.race); M.arDe(C, st.race);
    st.ceu = M.ceu(C); scene.add(st.ceu.sky); st.envScene = new W.Scene(); st.envScene.add(st.ceu.envSky); st.pmrem = new W.PMREMGenerator(renderer);
    st.planetas = M.planetas(C); scene.add(st.planetas.group);
    st.fenda = M.fenda(C, st.H); scene.add(st.fenda.group); st.ar = M.ar(C); scene.add(st.ar.obj);
    st.holo = ARD.salaHolo.criar(C); scene.add(st.holo.group);
    luzDoMundo(st, st.race); resize(); layout(true); aplicarCamera(0, 0);
    const cps = [st.fenda.cInit, st.fenda.cUpd].filter(Boolean); const comp1 = Promise.all([compilarObjs(st, [st.ceu.sky, st.planetas.group, st.fenda.group, st.ar.obj], camera, 4),
      cps.length ? (renderer.compileComputeAsync ? renderer.compileComputeAsync(cps) : Promise.resolve()).then(() => { if (alive() && st.fenda.cInit) renderer.compute(st.fenda.cInit); }) : null]).catch(e => { if (alive()) console.warn('[ARD] Sala: compilação do céu: ' + e.message); });
    marca('etapa1');
    /* ETAPA 2: o diorama na linha principal (o processo da GPU segue compilando a etapa 1) */
    const mundo = await montarMundo(st, st.race, alive, true); if (!alive() || !mundo) return false;
    if (ARD.salaMesa) { st.mesa = ARD.salaMesa.criar(C, st); scene.add(st.mesa.group); }
    st.holo.preparar(st.race); /* o busto da Raça (já montado em montarMundo; aqui só garante) */
    const pb = st.holo.prep[st.race]; const comp2 = compilarObjs(st, [mundo.group, pb ? pb.g : null, st.holo.feixe, st.holo.anel, st.mesa ? st.mesa.group : null], camera, 4);
    marca('diorama'); await Promise.all([comp1, comp2]); if (!alive()) return false; marca('shaders');
    /* troca de Raça pedida antes de a Sala aparecer: o mundo novo é montado e compilado agora (sem voo), para o pôster e a Sala serem da mesma Raça */
    if (st.queroRaca && st.queroRaca !== st.race && RACES.includes(st.queroRaca)) { const outra = await montarMundo(st, st.queroRaca, alive, true); if (!alive() || !outra) return false; await compilar(st, outra); if (!alive()) return false; descartarMundo(mundo); st.scene.remove(mundo.group); trocarMundo(st, outra); }
    else trocarMundo(st, mundo);
    st.qx = gsap.quickTo(st.par, 'x', { duration: 1.4, ease: 'power3.out' }); st.qy = gsap.quickTo(st.par, 'y', { duration: 1.4, ease: 'power3.out' });
    resize(); layout(true); if (!st.posterTool) casarPoster(st); aplicarCamera(0, 0); st.holo.U.revela.value = 1;
    /* ETAPA 3: aquecimento fora da tela (o canvas ainda está invisível) */
    if (!st.posterTool) await aquecerQuadros(st); /* a ferramenta dos pôsteres não precisa (ninguém vê a travada; o SwiftShader agradece) */ if (!alive()) return false;
    for (let k = 0; k < 2 && !st.posterTool && st.queroRaca && st.queroRaca !== st.race && RACES.includes(st.queroRaca); k++) { /* a Raça mudou durante o aquecimento: troca direta (sem voo) e aquece de novo, para o pôster e a Sala entrarem iguais */
      const outra = await montarMundo(st, st.queroRaca, alive, true); if (!alive() || !outra) return false; await compilar(st, outra); if (!alive()) return false; trocarMundo(st, outra); st.casado = null; st.ancLivre = false; resize(); layout(true); casarPoster(st); aplicarCamera(0, 0); await aquecerQuadros(st); if (!alive()) return false; }
    marca('aquecido');
    eventos(st); st.montado = true;
    if (st.vivo) { gsap.ticker.tick(); st.gOff = gsap.ticker.time - performance.now() / 1000; gsap.ticker.remove(gsap.updateRoot); gsap.ticker.lagSmoothing(0); st.gsapNoLaco = true; } /* o relógio do GSAP continua o mesmo (sem salto na troca nem na volta) */
    revelar(st); marca('montagem');
    return true;
  } catch (err) { console.warn('[ARD] Sala de Comando indisponível: ' + (err && err.message)); if (S === st) stop(); falhou = true; return false; }
}
/* representantes para compilar: um objeto por combinação de material, atributos da geometria e tipo (os outros caem no mesmo pipeline) */
function representantes(raizes) { const vistos = new Set(), out = [];
  for (const raiz of raizes) { if (!raiz) continue; raiz.traverse(o => { const g = o.geometry, m = o.material; if (!g || !m || Array.isArray(m)) return;
    const k = m.id + '|' + Object.keys(g.attributes).sort().join(',') + (g.index ? '#' : '') + '|' + (o.isSprite ? 's' : o.isInstancedMesh ? 'n' : o.isPoints ? 'p' : o.isLine ? 'l' : 'm') + (o.receiveShadow ? 'r' : '') + (o.count > 1 ? 'k' : '');
    if (!vistos.has(k)) { vistos.add(k); out.push(o); } }); } return out; }
/* 5.0a.1: compila em paralelo (k compileAsync ao mesmo tempo): no r186 cada compileAsync espera o pipeline de um objeto antes de ir ao próximo;
   vários em paralelo põem os pipelines para compilar juntos no processo da GPU. Cada representante é compilado sozinho, visível e sem
   recorte de câmera (o que estiver fora da vista também compila) */
async function compilarObjs(st, raizes, cam, k) { const fila = representantes(raizes); st.med.reps = (st.med.reps || 0) + fila.length;
  const um = async o => { const fc = o.frustumCulled, vis = o.visible; o.frustumCulled = false; o.visible = true; try { await compilarAlvo(st, o, cam); } catch (e) { if (S === st) console.warn('[ARD] Sala: compilação: ' + e.message); } finally { o.frustumCulled = fc; o.visible = vis; } };
  const rodar = async () => { while (fila.length && S === st) await um(fila.shift()); };
  await Promise.all(Array.from({ length: Math.max(1, k || 4) }, rodar)); }
/* 5.0a.1: aquecimento fora da tela: quadros de verdade com o canvas invisível (pós, sombra, compute e texturas nascem aqui) e a fila da GPU esvazia antes de a Sala aparecer */
async function aquecerQuadros(st) { st.cv.style.transition = 'none'; st.cv.style.opacity = '0';
  /* dois quadros em ¼ da densidade (criam os pipelines de pós, sombra e compute com pouco trabalho de GPU; a profundidade de campo refaz os dela no segundo
     uso, medido: não é o tamanho), e a densidade de verdade volta para o primeiro quadro visível, que já não cria nada */
  const pr0 = st.pr || st.renderer.getPixelRatio(); st.renderer.setPixelRatio(Math.max(0.2, pr0 * 0.25)); st.sun.shadow.needsUpdate = true;
  for (let i = 0; i < 2; i++) { if (S !== st) return; desenhar(st, performance.now()); await gpuOcioso(st); } st.renderer.setPixelRatio(pr0); }
function gpuOcioso(st) { if (st.fila) return st.fila.onSubmittedWorkDone().catch(() => {}); return new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r()))); }
/* monta (ou troca) o mundo de uma Raça: chão, base, fumaça e o busto (céu, ar e Fenda são da Sala inteira) */
async function montarMundo(st, race, alive, oculto) { const { W } = LIB; const M = ARD.salaMundo, C = st.C; const nova = {};
  nova.race = race; nova.H = race === st.race && st.H ? st.H : M.relevo(race); nova.terreno = M.terreno(C, race, nova.H);
  const cor = (ARD.campUI && ARD.campUI.colorFor && ARD.campUI.colorFor(race)) || ((ARD.sim && ARD.sim.RACE_SHADES || {})[race] || [])[0] || '#' + COR[race].toString(16);
  nova.base = await M.base(C, race, nova.H, cor, alive); if (!alive()) { descartarMundo(nova); return null; }
  nova.fumaca = M.fumaca(C, nova.base.fontes);
  const g = new W.Group(); g.name = 'mundo-' + race; for (const o of [nova.terreno, nova.base.group, nova.fumaca && nova.fumaca.obj]) if (o) g.add(o); nova.group = g;
  /* o busto da Raça (montado agora: os materiais compilam junto com o resto) */
  st.holo.preparar(race);
  if (oculto) { g.visible = false; st.scene.add(g); return nova; }
  st.scene.add(g); trocarMundo(st, nova); return nova; }
function trocarMundo(st, nova) { const old = st.mundo; st.mundo = nova; st.race = nova.race; st.H = nova.H; st.base = nova.base; nova.group.visible = true;
  if (old && old !== nova) { st.scene.remove(old.group); descartarMundo(old); }
  ARD.salaMundo.chaoDe(st.C, nova.race); ARD.salaMundo.arDe(st.C, nova.race); if (st.fenda && st.fenda.altura) st.fenda.altura(nova.H); /* 5.0a.1: chão, ar e Fenda são da Sala: só mudam os valores */
  const nuc = nova.base.nucleo; const yTopo = nuc ? nuc.position.y + nuc.userData.h * 0.97 : 36; st.holo.mostrar(nova.race, yTopo, 8.6, 0); if (!st.vivo) st.holo.descartar(old && old.race !== nova.race ? old.race : null); /* na completa os bustos ficam (pipelines aquecidos) */
  if (st.mesa) st.mesa.raca(nova.race, nova.H);
  if (st.sun) st.sun.shadow.needsUpdate = true; /* a sombra do mundo novo é desenhada no próximo quadro */
  if (st.luzRaca !== nova.race) luzDoMundo(st, nova.race); }
function descartarMundo(w) { if (!w) return; const seen = new Set(); const add = d => { if (d && d.dispose && !seen.has(d) && !(d.userData && d.userData.compartilhado)) { seen.add(d); try { d.dispose(); } catch (e) {} } };
  if (w.terreno) { add(w.terreno.geometry); add(w.terreno.material); } if (w.fumaca) for (const d of w.fumaca.disp) add(d); if (w.base) for (const d of w.base.disp) add(d); }
/* céu, sol, névoa e luz de ambiente do mundo (o PMREM é refeito a cada mundo) */
function luzDoMundo(st, race) { const { W } = LIB; const MU = ARD.salaMundo.MUNDOS[race]; const K = MU.ceu; st.ceu.set(race); st.luzRaca = race;
  const d = ARD.salaMundo.solDir(race, st.tmp.v); st.U.sol.value.copy(d); for (const s of [st.ceu.sky, st.ceu.envSky]) s.sunPosition.value.copy(d);
  const elev = K.elev; const day = Math.max(0, Math.min(1, (elev + 4) / 22)), warm = 1 - Math.max(0, Math.min(1, elev / 30));
  st.sun.color.setRGB(1, 0.9 - 0.32 * warm, 0.8 - 0.5 * warm); st.sun.intensity = 0.5 + 2.4 * day; st.sun.position.copy(d).multiplyScalar(600); st.sun.target.position.set(0, 0, -60);
  if (elev < 0) { st.sun.color.setRGB(0.62, 0.66, 1.0); st.sun.intensity = 0.95; st.sun.position.set(-260, 420, -180); }
  st.sun.position.add(st.sun.target.position); st.sun.target.updateMatrixWorld(); /* 5.0a.1: a caixa da sombra única fica centrada no diorama */
  st.hemi.color.setHex(MU.hemi[0]); st.hemi.groundColor.setHex(MU.hemi[1]); st.hemi.intensity = MU.hemi[2];
  st.scene.fog = new W.Fog(MU.nevoa[0], MU.nevoa[1], MU.nevoa[2]);
  st.U.aro.value.setHex(COR[race]); if (st.C.U.floraCor) st.C.U.floraCor.value.setRGB(1, 1, 1);
  try { const rt = st.pmrem.fromScene(st.envScene, 0, 0.1, 1000); st.scene.environment = rt.texture; if (st.envRT) st.envRT.dispose(); st.envRT = rt; } catch (e) { console.warn('[ARD] Sala: luz de ambiente: ' + e.message); }
  if (st.ready && !st.casado) layout(true); }
/* ---------- laço: GSAP, câmera, base, busto, som, compute e render ---------- */
function frame(now) { const st = S; if (!st) return; if (st.emVoo || now < (st.descanso || 0)) return; /* GPU lenta: o quadro anterior ainda está na fila; não empilha outro (a fila curta deixa a partida começar na hora) */
  if (!st.vivo && st.frames > 2) { if (!st.anim && now > st.ate) { st.renderer.setAnimationLoop(null); st.loop = false; return; } /* versão leve: desenha só enquanto algo muda */ if (now - (st.desenho || 0) < 32) return; /* e no máximo a 30 quadros por segundo (bateria) */ }
  const raw = now - (st.last || now); desenhar(st, now); st.frames++;
  /* 5.0a.1: no máximo um quadro na fila da GPU. O aviso de fim é pedido nos quadros lentos, a cada 15 quadros (amostra) e, enquanto a GPU estiver atrás,
     em todos; até ele chegar nada é desenhado. Antes só o intervalo entre quadros acusava a lentidão, e com o ritmo dos quadros normal a fila da GPU crescia */
  /* numa GPU que não passa de 10 quadros por segundo, a Sala descansa entre um quadro e outro (o tempo do próprio quadro; o triplo acima de 1 s): a GPU nunca fica
     ocupada só com a Sala, e o resto da página (e o Iniciar) não espera atrás de uma fila cheia */
  if (st.fila && (raw > 34 || st.gpuAtras || st.frames % 15 === 0)) { st.emVoo = true; const t0 = performance.now(); st.fila.onSubmittedWorkDone().then(() => { const ms = performance.now() - t0; st.gpuAtras = ms > 20; st.gpuMs = ms; st.descanso = ms > 100 && !st.posterTool && !st.cruzando && !st.casado ? performance.now() + ms * (ms > 1000 ? 3 : 1) : 0; /* sem descanso no cruzamento e no deslize */ st.emVoo = false; }, st.libera); }
  if (st.tag && st.foco) posTag(st);
  /* resolução dinâmica: quadros lentos seguidos baixam a densidade um degrau (fora do ?fundo=vivo, que mede a versão completa; nunca durante o cruzamento) */
  if (st.vivo && !st.forced && !st.cruzando && raw > 0 && raw < 400) { st.slow = raw > 40 ? st.slow + 1 : Math.max(0, st.slow - 2); if (st.slow > 45 && st.prK > 0.6) { st.prK = st.prK > 0.9 ? 0.78 : 0.62; st.slow = 0; resize(); } }
  if (now - (st.fpsT || 0) > 1000) { st.fps = st.fpsN ? Math.round(st.fpsN * 1000 / (now - st.fpsT)) : 0; st.fpsT = now; st.fpsN = 0; } st.fpsN = (st.fpsN || 0) + 1; }
/* um quadro: GSAP (no mesmo relógio), câmera, base, busto, mesa, ouvinte do som, compute e render (o laço e o aquecimento usam o mesmo) */
function desenhar(st, now) { st.desenho = now; const raw = now - (st.last || now); const dt = Math.min(0.05, Math.max(0.001, raw / 1000)); st.last = now; const t = now / 1000;
  if (st.gsapNoLaco) LIB.gsap.updateRoot(t + st.gOff);
  aplicarCamera(dt, t);
  ARD.salaMundo.animar(st.base, st.H, t); naFrente(st); st.planetas.spin(st.trocando ? dt * 6 : dt); st.holo.step(now, dt); if (st.mesa) st.mesa.step(dt, t); if (ARD.salaSom) ARD.salaSom.ouvir(st.camera);
  if (st.fenda.cUpd && (st.vivo || st.anim || st.frames < 3)) { st.fenda.dt.value = dt; st.renderer.compute(st.fenda.cUpd); }
  st.pipe.render(); }
/* nos closes (mesa, Academia, foco num prédio ou no líder) drones e unidades que passam entre a câmera e o alvo somem (sem alocação por quadro) */
function naFrente(st) { const b = st.base; if (!b || !b.anim) return; const m = st.modoCam, perto = m === 'mesa' || m === 'academia' || m === 'foco'; const c = st.camera.position, alvo = st.tmp.ct;
  const dx = alvo.x - c.x, dy = alvo.y - c.y, dz = alvo.z - c.z, L2 = dx * dx + dy * dy + dz * dz || 1;
  for (let i = 0; i < b.anim.length; i++) { const o = b.anim[i].o; let vis = true;
    if (perto && o !== st.foco) { const px = o.position.x - c.x, py = o.position.y - c.y, pz = o.position.z - c.z, k = (px * dx + py * dy + pz * dz) / L2; if (k > 0 && k < 0.92) { const qx = px - dx * k, qy = py - dy * k, qz = pz - dz * k; vis = qx * qx + qy * qy + qz * qz > 324; } }
    if (o.visible !== vis) o.visible = vis; } }
function kick(ms) { const st = S; if (!st) return; st.ate = Math.max(st.ate || 0, performance.now() + (ms || 120)); if (!st.montado) return; /* antes do fim da montagem nada desenha (os pipelines ainda estão compilando) */ if (!st.loop) { st.loop = true; st.last = performance.now(); st.renderer.setAnimationLoop(frame); } }
/* 5.0a.1: a Sala aparece. Com o pôster na tela, ela entra por cima num cruzamento suave (GSAP) no mesmo enquadramento dele e depois desliza
   para o enquadramento desta tela; sem pôster, o esmaecer e a entrada de antes. Nada pesado roda no laço durante o cruzamento: o
   aquecimento das outras Raças só começa depois, com o jogador mostrando interesse nas Raças ou com a tela parada */
function revelar(st) { st.ready = true; st.med.pronto = Math.round(performance.now() - st.t0); st.host.classList.add('sala-on'); st.tRev = performance.now() / 1000;
  if (ARD.uiStart && ARD.uiStart.salaPronta) try { ARD.uiStart.salaPronta(true); } catch (e) {}
  st.loop = true; st.last = performance.now(); st.renderer.setAnimationLoop(frame);
  const P = ARD.salaPoster, g = LIB.gsap; const comPoster = !!(P && P.visivel && P.visivel()) && !st.posterTool;
  const fim = () => { if (S !== st) return; st.cruzando = false; st.cv.style.transition = ''; st.cv.style.opacity = ''; st.cv.classList.add('on'); if (comPoster && P.esconder) P.esconder(); if (st.casado) deslizar(st); else depois(st); };
  if (comPoster) { st.cruzando = true; st.cv.style.transition = 'none'; g.fromTo(st.cv, { opacity: 0 }, { opacity: 1, duration: reduced() ? 0.2 : 1.2, ease: 'power1.inOut', onComplete: fim }); }
  else { st.cv.style.transition = ''; st.cv.style.opacity = ''; st.cv.classList.add('on'); if (st.vivo && !st.posterTool) entrada(st); depois(st); } }
/* depois de a Sala aparecer: a Raça pedida no meio do caminho e o aquecimento das outras (só com interesse ou tela parada) */
function depois(st) { if (st.queroRaca && st.queroRaca !== st.race) setTimeout(() => { if (S === st) setRace(st.queroRaca, {}); }, st.vivo ? 600 : 0);
  if (st.vivo && !st.posterTool && qs().get('aquecer') !== '0') { /* começa com o ponteiro ou o foco nos cartões das Raças, ou depois de 20 s na tela: um Iniciar rápido não encontra compilação em voo */
    let ja = false; const ir = () => { if (ja || S !== st) return; ja = true; clearTimeout(st.aqT); aquecer(st); }; st.aqT = setTimeout(ir, 20000); const fc = document.getElementById('fac-cards');
    if (fc) for (const ev of ['pointerenter', 'focusin']) { fc.addEventListener(ev, ir); st.on.push([fc, ev, ir, undefined]); } } }
/* aquecimento em segundo plano (completa): o busto de cada outra Raça é montado e compilado, um objeto por vez, na ordem do Alinhamento, para a troca não
   esperar pipelines (chão, ar, fumaça e Fenda já dividem os programas entre os mundos). Um objeto por vez: se a partida começar, no máximo um pipeline fica em voo */
async function aquecer(st) { const alive = () => S === st; const i0 = RACES.indexOf(st.race); st.aquecidos = st.aquecidos || {};
  const espera = ms => new Promise(r => setTimeout(r, ms)); const ocioso = () => new Promise(r => (window.requestIdleCallback ? requestIdleCallback(() => r(), { timeout: 800 }) : setTimeout(r, 60)));
  for (let k = 1; k < 5; k++) { const race = RACES[(i0 + k) % 5]; while (alive() && (st.trocando || st.cruzando || st.casado)) await espera(500); if (!alive()) return; if (st.aquecidos[race]) continue; await ocioso(); if (!alive()) return;
    const tA = performance.now(); const p = st.holo.preparar(race); const cam = st.refCam || st.camera;
    try { for (const o of representantes([p.g])) { if (!alive()) return; await ocioso(); if (!alive()) return; const fc = o.frustumCulled; o.frustumCulled = false; try { await compilarAlvo(st, o, cam); } finally { o.frustumCulled = fc; } } } catch (e) { if (alive()) console.warn('[ARD] Sala: aquecimento: ' + e.message); }
    if (!alive()) return; st.aquecidos[race] = Math.round(performance.now() - tA); await espera(300); } }
/* entrada sem pôster: a câmera chega de longe e o holograma se materializa */
function entrada(st) { const g = LIB.gsap; if (reduced()) { st.holo.U.revela.value = 1; return; } const r = st.rig, alvo = shot(st, st.aba); r.rad = alvo.rad * 1.7; r.pol = alvo.pol - 0.28; r.az = alvo.az + 0.5;
  st.tw.push(g.to(r, { rad: alvo.rad, pol: alvo.pol, az: alvo.az, duration: 3.2, ease: 'power3.out' })); st.holo.U.revela.value = 0; g.to(st.holo.U.revela, { value: 1, duration: 1.6, delay: 1.0, ease: 'power2.out' }); } /* 5.0a.1: a materialização não é voo de câmera (um voo não a interrompe) */
/* 5.0a.1: a Sala nasce no enquadramento do pôster: a câmera do render do pôster (posição, alvo e abertura), com a escala e o deslocamento em que o
   pôster está nesta tela (o centro de projeção vai para onde o centro do pôster está), e os planetas e o rasgo onde estavam no pôster */
function casarPoster(st) { const P = ARD.salaPoster && ARD.salaPoster.estado && ARD.salaPoster.estado(); if (!P || !P.meta || P.race !== st.race) return false;
  const R = P.meta.racas && P.meta.racas[st.race]; if (!R || !R.cam) return false; const W = LIB.W, r = st.rig;
  const p = new W.Vector3().fromArray(R.cam.p), t = new W.Vector3().fromArray(R.cam.t); const sph = new W.Spherical().setFromVector3(p.clone().sub(t));
  const f = (P.meta.h / 2) / Math.tan(R.cam.fov * Math.PI / 360) * P.s; /* distância focal do pôster em px desta tela */
  Object.assign(r, { tx: t.x, ty: t.y, tz: t.z, rad: sph.radius, pol: sph.phi, az: sph.theta, fov: 2 * Math.atan(innerHeight / 2 / f) * 180 / Math.PI });
  st.anc.x = P.s * R.cam.c[0] + P.tx; st.anc.y = P.s * R.cam.c[1] + P.ty; st.ancLivre = true; st.par.x = st.par.y = 0;
  const de = { planetas: {}, rasgo: null }; for (const k in st.planetas.por) st.planetas.por[k].g.visible = false;
  for (const [race, x, y, z, rr] of R.planetas || []) { const v = new W.Vector3(x, y, z); st.planetas.place(race, v, rr); de.planetas[race] = { p: v.clone(), r: rr }; }
  if (R.rasgo && st.fenda && st.fenda.rasgo) { const rs = st.fenda.rasgo; rs.position.fromArray(R.rasgo.p); rs.quaternion.fromArray(R.rasgo.q); rs.scale.fromArray(R.rasgo.s); de.rasgo = { p: rs.position.clone(), q: rs.quaternion.clone(), s: rs.scale.clone() }; }
  st.casado = { de }; if (st.mesa && st.aba !== 'jogar') { st.mesa.ped.visible = true; st.mesa.ped.scale.setScalar(1); } /* a mesa do pôster some só depois do cruzamento */
  return true; }
/* depois do cruzamento: câmera, planetas e rasgo deslizam do enquadramento do pôster para o desta tela (numa tela do tamanho do pôster, não há o que andar) */
function deslizar(st) { const g = LIB.gsap, W = LIB.W, C0 = st.casado; if (!C0) return depois(st); const a = ancoraPalco(st); st.ancPalco = a; const alvo = Object.assign(shot(st, st.aba), { fov: fovBase() });
  const ceu = ceuAlvos(st); const de = C0.de; const k = { v: 0 }; const tmpQ = new W.Quaternion(), tmpV = new W.Vector3();
  const r = st.rig; let az = alvo.az; while (az - r.az > Math.PI) az -= Math.PI * 2; while (az - r.az < -Math.PI) az += Math.PI * 2;
  const d = reduced() ? 0 : 1.6; const fimD = () => { if (S !== st) return; st.casado = null; st.ancLivre = false; layout(true); if (st.mesa) st.mesa.visivel(st.aba === 'jogar'); depois(st); };
  st.tw.push(g.to(r, { tx: alvo.tx, ty: alvo.ty, tz: alvo.tz, rad: alvo.rad, pol: alvo.pol, az, fov: alvo.fov, duration: d, ease: 'power2.inOut' }), g.to(st.anc, { x: a.x, y: a.y, duration: d, ease: 'power2.inOut' }));
  st.tw.push(g.to(k, { v: 1, duration: d, ease: 'power2.inOut', onUpdate: () => { const e = k.v; for (const race in ceu.planetas) { const A = ceu.planetas[race], B = de.planetas[race]; if (!B) { if (e > 0.5) st.planetas.place(race, A.p, A.r); continue; } st.planetas.place(race, tmpV.copy(B.p).lerp(A.p, e), B.r + (A.r - B.r) * e); }
      for (const race in de.planetas) if (!ceu.planetas[race] && e > 0.5) st.planetas.por[race].g.visible = false;
      if (ceu.rasgo && de.rasgo && st.fenda.rasgo) { const rs = st.fenda.rasgo; rs.position.copy(de.rasgo.p).lerp(ceu.rasgo.p, e); rs.quaternion.copy(tmpQ.copy(de.rasgo.q).slerp(ceu.rasgo.q, e)); rs.scale.copy(de.rasgo.s).lerp(ceu.rasgo.s, e); } }, onComplete: fimD }));
  if (!d) fimD(); }
/* ---------- câmera ---------- */
/* enquadramentos por aba: o alvo e a distância saem do tamanho do palco (o busto ocupa a parte de cima, a mesa tática a de baixo) */
function shot(st, aba) { const H = st.holo, estreito = celular(); const mesa = estreito ? null : st.mesa; /* no celular o palco é pequeno: só o líder */ const topo = H.topo || 80, base = mesa ? mesa.baixo : (H.base || 40) - 8; const ext = topo - base; const k = Math.max(0.2, Math.min(0.95, st.palcoH / innerHeight));
  const fit = ext / (k * 0.86 * 2 * Math.tan(fovBase() * Math.PI / 360)); const meio = (topo + base) / 2;
  if (aba === 'campanha') return { tx: -6, ty: (H.centro || 60) + 4, tz: 4, rad: fit * 0.98, pol: 1.31, az: -0.14 }; /* o céu do Alinhamento continua na faixa de cima */
  if (aba === 'multi') return { tx: 10, ty: meio - 6, tz: -10, rad: fit * 1.5, pol: 1.1, az: -0.4 };
  if (aba === 'ajustes') return { tx: 0, ty: H.centro || 60, tz: 0, rad: fit * 0.78, pol: 1.3, az: 0.3 };
  if (estreito) return { tx: 0, ty: meio, tz: 4, rad: fit * 1.05, pol: 1.47, az: 0.1 }; /* celular: olhar quase na horizontal, o céu do Alinhamento aparece em cima */
  return { tx: mesa ? mesa.pos.x * 0.24 : 0, ty: meio, tz: mesa ? mesa.pos.z * 0.5 : 8, rad: fit * 1.05, pol: 1.27, az: 0.1 }; }
function aplicarCamera(dt, t) { const st = S, r = st.rig, cam = st.camera, T = st.tmp; const vivo = st.vivo && !reduced();
  const sway = vivo && st.modoCam === 'repouso' && !st.posterTool ? Math.sin((t - (st.tRev || t)) * 0.045) * 0.035 : 0; /* 5.0a.1: o balanço começa em zero quando a Sala aparece (o pôster é desenhado sem balanço) */ const voo = st.modoCam === 'voo'; const pol = Math.max(voo ? 0.05 : 0.25, Math.min(voo ? Math.PI - 0.05 : 1.5, r.pol + st.par.y)), az = r.az + st.par.x + sway;
  T.ct.set(r.tx, r.ty, r.tz); T.cp.setFromSphericalCoords(r.rad, pol, az).add(T.ct); if (st.H) { const gy = st.H(T.cp.x, T.cp.z) + 6; if (T.cp.y < gy) T.cp.y = gy; }
  cam.position.copy(T.cp); cam.lookAt(T.ct); if (cam.fov !== r.fov) { cam.fov = r.fov; cam.updateProjectionMatrix(); }
  const w = innerWidth, h = innerHeight, rol = st.host && (st.modoCam === 'repouso' || st.modoCam === 'voo') ? Math.min(h * 0.6, st.host.scrollTop || 0) : 0; /* o palco sobe com a rolagem da página; nos modos de tela cheia (foco, mesa, Academia, Explorar) não */ const ox = w / 2 - (st.ancLivre ? st.anc.x : Math.max(w * 0.15, Math.min(w * 0.85, st.anc.x))), oy = h / 2 - (st.ancLivre ? st.anc.y - rol : Math.max(h * 0.2, Math.min(h * 0.8, st.anc.y - rol))); /* a âncora fica dentro da tela: centro de projeção muito fora do meio deforma as esferas (5.0a.1: menos no começo casado com o pôster, onde o centro é o do pôster) */
  if (Math.abs(ox) > 0.5 || Math.abs(oy) > 0.5) cam.setViewOffset(w, h, ox, oy, w, h); else cam.clearViewOffset();
  cam.updateMatrixWorld(); st.U.foco.value = st.focoD != null ? st.focoD : cam.position.distanceTo(T.ct); }
/* 5.0a.1: um voo no meio do deslize (aba, foco, troca) solta o casamento com o pôster: céu e âncora voltam ao enquadramento desta tela */
function soltarCasado(st) { if (!st || !st.casado) return; st.casado = null; st.ancLivre = false; const a = ancoraPalco(st); st.ancPalco = a; st.anc.x = a.x; st.anc.y = a.y; ceuLayout(st); }
function voar(alvo, dur, ease) { const st = S; if (!st) return; const g = LIB.gsap, r = st.rig; soltarCasado(st); for (const tw of st.tw) tw.kill(); st.tw.length = 0;
  const d = reduced() ? 0 : (dur == null ? 1.6 : dur); let az = alvo.az; if (az != null) { while (az - r.az > Math.PI) az -= Math.PI * 2; while (az - r.az < -Math.PI) az += Math.PI * 2; }
  st.tw.push(g.to(r, { tx: alvo.tx, ty: alvo.ty, tz: alvo.tz, rad: alvo.rad, pol: alvo.pol, az: az != null ? az : r.az, fov: alvo.fov || fovBase(), duration: d, ease: ease || 'power3.inOut', onUpdate: () => kick(80) }));
  if (alvo.anc) st.tw.push(g.to(st.anc, { x: alvo.anc.x, y: alvo.anc.y, duration: d, ease: ease || 'power3.inOut' }));
  kick(d * 1000 + 200); }
/* ---------- layout: palco da vitrine (âncora do holograma), céu do Alinhamento (planetas e rasgo da Fenda) ---------- */
function rect(sel) { const el = document.querySelector(sel); if (!el) return null; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 ? r : null; }
function ancoraPalco(st) { const rol = st.host.scrollTop || 0; const b = rect('#sc-bust'); if (b) { st.palcoH = Math.max(b.height, Math.min(innerHeight * 0.62, (rect('.sc-stage') || b).height)); return { x: b.left + b.width / 2, y: b.top + rol + b.height * 0.56 }; }
  st.palcoH = innerHeight * 0.5; return { x: innerWidth * 0.32, y: innerHeight * 0.45 }; }
function layout(snap) { const st = S; if (!st || !st.holo) return; const a = ancoraPalco(st); st.ancPalco = a; if (st.casado) return; /* 5.0a.1: casada com o pôster, a Sala só sai do enquadramento dele no deslize */
  if (st.modoCam === 'repouso') { const alvo = shot(st, st.aba); if (snap) { Object.assign(st.rig, alvo, { fov: fovBase() }); st.anc.x = a.x; st.anc.y = a.y; } else voar(Object.assign({ anc: a }, alvo), 0.8); }
  ceuLayout(st); kick(200); }
/* os outros quatro mundos na faixa de cima (entre o título e a versão), em fila até o rasgo da Fenda; a câmera de referência é a de repouso */
/* 5.0a.1: o lugar dos planetas e do rasgo é calculado à parte (ceuAlvos) e aplicado por ceuLayout; o deslize depois do pôster anda entre os dois */
function ceuLayout(st) { const A = ceuAlvos(st); for (const k in st.planetas.por) st.planetas.por[k].g.visible = false; for (const race in A.planetas) st.planetas.place(race, A.planetas[race].p, A.planetas[race].r);
  if (A.rasgo && st.fenda && st.fenda.rasgo) { const rs = st.fenda.rasgo; rs.position.copy(A.rasgo.p); rs.quaternion.copy(A.rasgo.q); rs.scale.copy(A.rasgo.s); } }
function ceuAlvos(st) { const { W } = LIB; const w = innerWidth, h = innerHeight; const cam = st.refCam || (st.refCam = new W.PerspectiveCamera()); const r = shot(st, 'jogar'), T = st.tmp; const out = { planetas: {}, rasgo: null };
  cam.fov = fovBase(); cam.aspect = w / h; cam.near = 1; cam.far = 6000; T.ct.set(r.tx, r.ty, r.tz); T.cp.setFromSphericalCoords(r.rad, r.pol, r.az).add(T.ct); cam.position.copy(T.cp); cam.lookAt(T.ct);
  const a = st.ancPalco || st.anc; cam.setViewOffset(w, h, w / 2 - Math.max(w * 0.15, Math.min(w * 0.85, a.x)), h / 2 - Math.max(h * 0.2, Math.min(h * 0.8, a.y)), w, h); cam.updateProjectionMatrix(); cam.updateMatrixWorld();
  const brand = rect('.brand-txt'), ver = rect('.st-ver'), head = rect('.st-head'); const port = w < h; let xa, xb, yc;
  if (brand && head) { xa = brand.right + (port ? 30 : 90); const mesma = ver && ver.top < brand.bottom - 10 && ver.left > xa + 160; xb = mesma ? ver.left - 50 : w - 30; yc = Math.max(34, head.top + Math.min(head.height, brand.height) * 0.45); }
  else { xa = w * 0.35; xb = w * 0.92; yc = h * 0.1; }
  const gap = Math.max(80, xb - xa), r0 = Math.max(port ? 13 : 10, Math.min(head ? head.height * 0.36 : 40, gap / 10, h < 560 ? 24 : 99)); /* celular deitado: planetas menores na faixa curta */ if (head) yc = Math.max(yc, r0 + 14) + (port ? 0 : 10); /* folga para a paralaxe não cortar os planetas no alto */ const outros = []; const i0 = RACES.indexOf(st.race); for (let k = 1; k < 5; k++) outros.push(RACES[(i0 + k) % 5]);
  const ray = (px, py, D, o) => { o.set(px / w * 2 - 1, -(py / h * 2 - 1), 0.5).unproject(cam).sub(cam.position).normalize().multiplyScalar(D).add(cam.position); return o; };
  outros.forEach((race, k) => { const f = k / 3; const px = xa + gap * (0.05 + f * 0.9), py = yc - (f - 0.5) * (f - 0.5) * 34 + 10 * f; const D = 2100 + k * 260; const rpx = r0 * (1.15 - f * 0.55);
    const pos = ray(px, py, D, new W.Vector3()); const rw = rpx / (h / 2) * D * Math.tan(cam.fov * Math.PI / 360); out.planetas[race] = { p: pos, r: rw }; });
  /* o rasgo da Fenda: do horizonte acima do redemoinho, subindo em diagonal */
  if (st.fenda && st.fenda.rasgo) { const F = ARD.salaMundo.FENDA, p0 = T.v.set(F.x, (st.H ? st.H(F.x, F.z) : 0) + 140, F.z).project(cam); const sx = (p0.x + 1) / 2 * w, sy = (1 - p0.y) / 2 * h;
    const b0 = ray(Math.min(w * 0.97, sx), Math.max(-h * 0.1, sy), 2600, new W.Vector3()), b1 = ray(Math.min(w * 1.02, sx + w * 0.16), Math.max(-h * 0.6, sy - h * 0.75), 2600, new W.Vector3());
    const o = new W.Object3D(), len = b0.distanceTo(b1); o.position.copy(b0).add(b1).multiplyScalar(0.5); o.lookAt(cam.position); const up = T.v2.copy(b1).sub(b0).normalize();
    const camUp = new W.Vector3(0, 1, 0).applyQuaternion(o.quaternion), camRight = new W.Vector3(1, 0, 0).applyQuaternion(o.quaternion); o.rotateZ(Math.atan2(-up.dot(camRight), up.dot(camUp))); o.scale.set(len * 0.24, len * 1.25, 1);
    out.rasgo = { p: o.position.clone(), q: o.quaternion.clone(), s: o.scale.clone() }; }
  return out; }
function resize() { const st = S; if (!st || !st.renderer) return; const w = innerWidth, h = innerHeight; const pr = st.posterTool ? Math.min(3, window.devicePixelRatio || 1) /* 5.0a.1: o pôster sai na densidade da tela */ : st.vivo ? Math.max(0.5, Math.min(2, window.devicePixelRatio || 1, Math.sqrt(8.3e6 / Math.max(1, w * h))) * st.prK) : Math.max(0.5, Math.min(1.5, window.devicePixelRatio || 1, Math.sqrt(2.6e6 / Math.max(1, w * h))));
  st.renderer.setPixelRatio(pr); st.renderer.setSize(w, h, false); st.camera.aspect = w / h; st.camera.updateProjectionMatrix(); if (st.csm) try { st.csm.updateFrustums(); } catch (e) {} st.pr = pr; }
/* ---------- troca de Raça: voo até o próximo mundo do Grande Alinhamento ---------- */
async function setRace(race, o) { const st = S; o = o || {}; if (!st || !RACES.includes(race)) return; st.queroRaca = race; if (st.trocando || !st.ready) { if (!st.ready) st.race0 = race; return; } if (race === st.race) return;
  st.trocando = true; soltarCasado(st); const alive = () => S === st; const g = LIB.gsap; const de = st.race;
  if (o.voz) falar(st, race);
  if (ARD.salaSom) { ARD.salaSom.raca(race, nucleoPos(st)); ARD.salaSom.voo(st.camera); }
  try {
    if (!st.vivo || reduced()) { /* versão leve ou movimento reduzido: troca direta com um esmaecer curto */ st.cv.style.opacity = '0.35'; const nova = await montarMundo(st, race, alive, true); if (!alive() || !nova) return; await compilar(st, nova); if (!alive()) return; trocarMundo(st, nova); st.holo.U.revela.value = 1; layout(true); kick(300); setTimeout(() => { if (S === st) st.cv.style.opacity = ''; }, 60); return; }
    /* 1) sobe olhando para o próximo mundo do céu: o planeta cresce até encher a tela (FOV fecha) enquanto a base nova é montada escondida */
    st.anim = true; st.modoCam = 'voo'; const p = st.planetas.por[race]; const alvoP = p.g.position.clone(); const rp = p.g.scale.x; const r = st.rig;
    for (const tw of st.tw) tw.kill(); st.tw.length = 0; g.to(st.holo.U.revela, { value: 0, duration: 0.45, ease: 'power2.in' });
    const cp = st.camera.position.clone(); const dir = alvoP.clone().sub(cp); const dist = dir.length(); dir.normalize(); const sph = new LIB.W.Spherical().setFromVector3(dir);
    /* o alvo da câmera passa a ser um ponto na direção do planeta; a câmera gira até ele e fecha o FOV até o planeta cobrir a imagem */
    const fovFim = Math.max(0.6, 2 * Math.atan(rp * 0.42 / dist) * 180 / Math.PI);
    const t1 = g.timeline(); st.tw.push(t1);
    t1.to(r, { tx: cp.x + dir.x * 220, ty: cp.y + dir.y * 220, tz: cp.z + dir.z * 220, rad: 220, pol: Math.PI - sph.phi, az: sph.theta + Math.PI, duration: 1.1, ease: 'power2.inOut' }, 0)
      .to(r, { fov: fovFim, duration: 0.9, ease: 'power3.in' }, 0.35).to(st.anc, { x: innerWidth / 2, y: innerHeight / 2, duration: 1.0, ease: 'power2.inOut' }, 0);
    st.fase = 'montando'; const montar = montarMundo(st, race, alive, true);
    await new Promise(res => t1.eventCallback('onComplete', res)); if (!alive()) return;
    const nova = await montar; if (!alive() || !nova) return; st.fase = 'compilando'; await compilar(st, nova); if (!alive()) return; st.fase = 'descendo'; flash(st, race);
    /* 2) com o planeta cobrindo a imagem, o mundo troca; a câmera desce do alto até a base nova e o líder se materializa */
    r.fov = fovBase(); trocarMundo(st, nova); const a = ancoraPalco(st); st.ancPalco = a; ceuLayout(st); const alvo = shot(st, st.aba);
    r.tx = alvo.tx; r.ty = alvo.ty + 160; r.tz = alvo.tz; r.rad = alvo.rad * 2.4; r.pol = 0.35; r.az = alvo.az - 0.6; st.anc.x = a.x; st.anc.y = a.y;
    const t2 = g.timeline(); st.tw.push(t2); t2.to(r, { ty: alvo.ty, rad: alvo.rad, pol: alvo.pol, az: alvo.az, tx: alvo.tx, tz: alvo.tz, duration: 1.7, ease: 'power3.out' }, 0).fromTo(st.holo.U.revela, { value: 0 }, { value: 1, duration: 1.1, ease: 'power2.out' }, 0.7);
    await new Promise(res => t2.eventCallback('onComplete', res));
  } catch (e) { console.warn('[ARD] Sala: troca de Raça: ' + e.message); }
  finally { if (S === st) { st.trocando = false; st.fase = null; st.anim = false; st.modoCam = 'repouso'; if (st.queroRaca && st.queroRaca !== st.race) setRace(st.queroRaca, {}); } } }
/* compila para o alvo de verdade (a passagem da cena do RenderPipeline, em meia precisão), não para o canvas: o compileAsync guarda o alvo
   na hora da chamada, então o alvo volta logo em seguida e o laço do render não é afetado enquanto os pipelines compilam */
function compilarAlvo(st, obj, cam) { const r = st.renderer, rt0 = r.getRenderTarget(); r.setRenderTarget(st.sp.renderTarget); let pr; try { pr = r.compileAsync(obj, cam, st.scene); } finally { r.setRenderTarget(rt0); } return pr; }
/* compila o mundo novo (e o busto novo) antes de mostrar: visíveis só durante a compilação, vistos pela câmera de repouso */
async function compilar(st, nova) { const p = st.holo.prep[nova.race]; const cam = st.refCam || st.camera; cam.updateMatrixWorld();
  try { await compilarObjs(st, [nova.group, p ? p.g : null], cam, 3); } catch (e) { if (S === st) console.warn('[ARD] Sala: compilação: ' + e.message); } } /* 5.0a.1: em paralelo, só os representantes (cada um visível só enquanto compila) */
/* entrada na atmosfera do mundo novo: um clarão curto na cor da atmosfera */
function flash(st, race) { if (reduced()) return; const P = ARD.salaMundo.PLANETAS[race]; const el = st.flashEl || (st.flashEl = Object.assign(document.createElement('div'), { id: 'sala-flash' })); if (!el.parentNode) st.host.appendChild(el);
  el.style.background = 'radial-gradient(ellipse at 50% 60%, #' + ('00000' + P.atmo.toString(16)).slice(-6) + 'cc, #' + ('00000' + P.pl[1].toString(16)).slice(-6) + 'ee 70%)'; LIB.gsap.fromTo(el, { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.9, ease: 'power2.out' }); }
function nucleoPos(st) { const n = st.base && st.base.nucleo; return n ? { x: n.position.x, y: n.position.y + 30, z: n.position.z } : { x: 0, y: 40, z: 0 }; }
/* o líder fala ao chegar (voz do sistema; a boca acompanha as palavras) */
function falar(st, race) { const MU = ARD.salaMundo.MUNDOS[race]; if (!MU || !ARD.audio) return; try { if (ARD.audio.voice) ARD.audio.say(MU.fala, 'sala-' + race, 4); else if (st.holo.it) ARD.leaders3d.react(st.holo.it, 'talk', 1.4); } catch (e) {}
  setTimeout(() => { if (S === st && st.holo.it) { ARD.leaders3d.react(st.holo.it, 'nod'); ARD.leaders3d.mood(st.holo.it, 3, 2600); } }, st.vivo ? 2300 : 200); }
/* ---------- abas: um enquadramento por modo e a entrada do painel com GSAP ---------- */
function aba(tab) { const st = S; if (!st || !LIB) return; st.aba = tab;
  const pane = document.querySelector('.cpane[data-pane="' + tab + '"]'); if (pane && !reduced()) LIB.gsap.fromTo(pane.children, { y: 10, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.38, stagger: 0.035, ease: 'power2.out', clearProps: 'transform,opacity,visibility' });
  if (st.mesa) st.mesa.visivel(tab === 'jogar');
  if (st.ready && st.modoCam === 'repouso' && !st.trocando) voar(Object.assign({ anc: st.ancPalco }, shot(st, tab)), 1.5); }
/* ---------- clique no diorama: voo até a construção ou unidade, com o foco da profundidade de campo acompanhando ---------- */
const NOMES = { nucleo: 'Núcleo de Domínio', reator: 'Reator', refinaria: 'Refinaria', quartel: 'Quartel Orbital', fabrica: 'Fábrica de Veículos', hangar: 'Hangar de Drones', laboratorio: 'Laboratório', torre: 'Torre de Defesa' };
function descr(def) { const S2 = ARD.sim; const b = S2 && S2.BUILDINGS[def], u = S2 && S2.UNITS[def]; const d = (b || u || {}).desc || ''; const nome = b ? b.name : u ? S2.unitName(S && S.race, def) : (NOMES[def] || def); const i = d.indexOf('. '); return { nome, d: i > 0 ? d.slice(0, i + 1) : d }; }
function pick(st, x, y) { const { W } = LIB; const ray = st.ray || (st.ray = new W.Raycaster()); const v = st.ndc || (st.ndc = new W.Vector2()); v.set(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1); ray.setFromCamera(v, st.camera);
  const alvos = st.base ? st.base.pick : []; const hit = ray.intersectObjects(alvos, false)[0]; if (hit) return { tipo: 'modelo', g: hit.object.userData.root };
  const pb = st.holo && st.holo.prep[st.holo.race]; if (pb) { const hb = ray.intersectObject(pb.g, true)[0]; if (hb && hb.distance < 900) return { tipo: 'lider' }; }
  if (st.mesa) { const m = st.mesa.acerto(ray); if (m) return { tipo: 'mesa' }; }
  const t = st.mundo && ray.intersectObject(st.mundo.terreno, false)[0]; if (t) return { tipo: 'chao', p: t.point }; return null; }
function focar(st, g) { const W = LIB.W; const h = g.userData.h || 10, w = g.userData.w || 10; st.foco = g; st.modoCam = 'foco'; const rad = Math.max(38, w * 2.6); const r = st.rig;
  const az = Math.atan2(g.position.x - st.camera.position.x, g.position.z - st.camera.position.z) + Math.PI; const a = st.explorar ? { x: innerWidth / 2, y: innerHeight * 0.55 } : st.ancPalco;
  voar({ tx: g.position.x, ty: g.position.y + h * 0.45, tz: g.position.z, rad, pol: 1.12, az, anc: a }, 1.8); if (st.vivo) { LIB.gsap.to(st.U.bokeh, { value: 3.2, duration: 1.8, ease: 'power2.inOut' }); LIB.gsap.to(st.U.focal, { value: Math.max(30, rad * 0.5), duration: 1.8 }); } const D = descr(g.userData.def);
  const tag = st.tag || (st.tag = Object.assign(document.createElement('div'), { id: 'sala-tag' })); tag.setAttribute('role', 'status'); tag.innerHTML = '<b></b><small></small>'; tag.firstChild.textContent = D.nome; tag.lastChild.textContent = D.d; if (!tag.parentNode) st.host.appendChild(tag); tag.classList.add('on');
  if (ARD.salaSom) ARD.salaSom.foco(g.position); }
/* clique no holograma: a câmera chega perto do rosto (profundidade de campo no líder) e ele fala */
function focarLider(st) { const H = st.holo; if (!H.it || !st.ready || st.trocando) return; const W = LIB.W; if (!st.explorar && celular()) { explorar(true); st.modoCam = 'foco'; } /* no celular o palco é pequeno: o close do líder vem em tela cheia */ const h = H.U.h.value; const yc = H.topo - h * 0.36; const rad = Math.max(40, h * 1.9);
  st.foco = st.focoLider || (st.focoLider = { position: new W.Vector3(), userData: { h: 0, def: 'lider' } }); st.foco.position.set(0, H.base + h * 0.1, 0); st.modoCam = 'foco'; /* o rótulo fica na altura do peito: no close o alto da cabeça sai da tela */
  voar({ tx: 0, ty: yc, tz: 0, rad, pol: 1.45, az: 0.14, anc: st.explorar ? { x: innerWidth / 2, y: innerHeight * 0.45 } : st.ancPalco }, 1.6); if (st.vivo) { st.focoD = Math.max(12, rad - h * 0.2); LIB.gsap.to(st.U.bokeh, { value: 1.2, duration: 1.6 }); LIB.gsap.to(st.U.focal, { value: Math.max(30, rad * 0.8), duration: 1.6 }); } /* fundo levemente desfocado, foco na frente do rosto */
  if (st.bloom && st.bloom.strength) LIB.gsap.to(st.bloom.strength, { value: st.bloomK * 0.4, duration: 1.4 }); /* de perto o rosto ocupa a tela: o bloom de repouso apagaria os traços */
  const MU = ARD.salaMundo.MUNDOS[st.race]; const tag = st.tag || (st.tag = Object.assign(document.createElement('div'), { id: 'sala-tag' })); tag.setAttribute('role', 'status'); tag.innerHTML = '<b></b><small></small>'; tag.firstChild.textContent = MU.lider; tag.lastChild.textContent = 'Em transmissão de ' + MU.nome + ' · clique no chão ou Esc para voltar'; if (!tag.parentNode) st.host.appendChild(tag); tag.classList.add('on');
  falar(st, st.race); }
function posTag(st) { const v = st.tmp.v2.set(st.foco.position.x, st.foco.position.y + (st.foco.userData.h || 10) * 1.1, st.foco.position.z).project(st.camera); const w = innerWidth, meia = Math.min(160, w * 0.4) + 8; /* o rótulo nunca sai da tela */
  const x = Math.max(meia, Math.min(w - meia, Math.round((v.x + 1) / 2 * w))), y = Math.max(90, Math.min(innerHeight - 20, Math.round((1 - v.y) / 2 * innerHeight))); if (st.tagX !== x || st.tagY !== y) { st.tagX = x; st.tagY = y; st.tag.style.transform = 'translate(' + x + 'px,' + y + 'px) translate(-50%,-115%)'; } } /* texto novo só quando o rótulo anda */
function rotuloMesa(on) { const b = document.getElementById('btn-mesa'); if (b) { b.textContent = on ? 'Voltar' : 'Ver na mesa'; b.setAttribute('aria-pressed', on ? 'true' : 'false'); } }
function voltar() { const st = S; if (!st) return; rotuloMesa(false); st.foco = null; st.focoD = null; if (st.bloom && st.bloom.strength) LIB.gsap.to(st.bloom.strength, { value: st.bloomK, duration: 1.2 }); if (st.vivo) { LIB.gsap.to(st.U.bokeh, { value: 0, duration: 1.4 }); LIB.gsap.to(st.U.focal, { value: 260, duration: 1.4 }); } if (st.tag) st.tag.classList.remove('on'); if (st.modoCam === 'academia' && ARD.salaMesa) ARD.salaMesa.sairModelo && ARD.salaMesa.sairModelo(st); st.modoCam = st.explorar ? 'explorar' : 'repouso';
  voar(Object.assign({ anc: st.explorar ? { x: innerWidth / 2, y: innerHeight * 0.5 } : st.ancPalco }, shot(st, st.aba)), 1.4); }
/* fundo da tela inicial: o clique só vale onde não há interface por cima */
const UI = 'button,a,input,select,textarea,label,summary,details,.console,.sc-info,.fac-cards,.notes,.st-head,.modal,#academia,.site-foot,#sala-sair,#st-cta,.sc-pick';
function eventos(st) { const on = (el, ev, f, o) => { el.addEventListener(ev, f, o); st.on.push([el, ev, f, o]); };
  on(window, 'resize', () => { resize(); layout(true); });
  if (st.host) on(st.host, 'scroll', () => { if (!st.vivo) kick(160); }, { passive: true }); /* versão leve: o palco acompanha a rolagem (desenha só enquanto ela anda) */
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (S === st) layout(true); });
  if (window.ResizeObserver) { const b = document.querySelector('#sc-bust'); if (b) { let primeiro = true; st.ro = new ResizeObserver(() => { if (primeiro) { primeiro = false; return; } /* 5.0a.1: o aviso inicial do observador não é mudança de layout */ if (S === st && st.ready && !st.trocando) layout(false); }); st.ro.observe(b); } }
  on(window, 'pointermove', e => { if (!st.ready) return; if (e.pointerType === 'mouse' && !reduced() && st.vivo) { st.qx((e.clientX / innerWidth - 0.5) * 0.14); st.qy(Math.max(0, e.clientY / innerHeight - 0.5) * 0.05); } /* paralaxe curta; no alto ela só desce (os planetas da faixa de cima nunca saem da tela) */
    if (st.holo.it && st.ancPalco) ARD.leaders3d.gaze(st.holo.it, (e.clientX - st.ancPalco.x) / 320, -(e.clientY - st.ancPalco.y + (st.host.scrollTop || 0)) / 260, 900);
    if (st.fenda && st.fenda.stirP) { const p = pick2(st, e.clientX, e.clientY); if (p) { st.fenda.stirP.value.copy(p); st.fenda.stirK.value = 1; } }
    if (st.explorar && st.drag) { const dx = e.clientX - st.drag.x, dy = e.clientY - st.drag.y; st.drag.x = e.clientX; st.drag.y = e.clientY; st.rig.az -= dx * 0.005; st.rig.pol = Math.max(0.35, Math.min(1.45, st.rig.pol - dy * 0.004)); st.drag.moveu = (st.drag.moveu || 0) + Math.abs(dx) + Math.abs(dy); kick(200); } }, { passive: true });
  on(st.host, 'click', e => { if (!st.ready || st.trocando) return; if (e.target.closest && e.target.closest(UI)) return; if (st.drag && st.drag.moveu > 6) return; const h = pick(st, e.clientX, e.clientY); if (!h) return;
    if (h.tipo === 'modelo') focar(st, h.g); else if (h.tipo === 'lider') { focarLider(st); } else if (h.tipo === 'mesa') { explorar(true, { alvo: 'mesa' }); }
    else if (h.tipo === 'chao') { if (st.foco || st.modoCam === 'foco') voltar(); else if (st.modoCam === 'mesa') explorar(true); else if (st.fenda.pulseP) { pulso(st, h.p); } } });
  on(st.cv, 'pointerdown', e => { if (st.explorar) { st.drag = { x: e.clientX, y: e.clientY, moveu: 0 }; try { st.cv.setPointerCapture(e.pointerId); } catch (er) {} } });
  on(st.cv, 'pointerup', () => { setTimeout(() => { st.drag = null; }, 0); });
  on(st.cv, 'wheel', e => { if (!st.explorar) return; e.preventDefault(); st.rig.rad = Math.max(40, Math.min(520, st.rig.rad * (1 + Math.sign(e.deltaY) * 0.08))); kick(200); }, { passive: false });
  on(document, 'keydown', e => { if (e.key === 'Escape' && !(ARD.salaAcademia && ARD.salaAcademia.aberta())) { if (st.explorar) explorar(false, { de: st.modoCam }); else if (st.foco) voltar(); } });
  /* som 3D: só depois de um gesto do jogador e se o som estiver ligado */
  const gesto = () => { if (S !== st) return; if (ARD.salaSom && ARD.audio && ARD.audio.enabled && !ARD.salaSom.ativo()) { const F = ARD.salaMundo.FENDA; ARD.salaSom.iniciar({ fenda: { x: F.x, y: st.H(F.x, F.z) + 30, z: F.z }, nucleo: nucleoPos(st), race: st.race }); } };
  st.gesto = gesto; for (const ev of ['pointerdown', 'keydown', 'touchstart']) on(document, ev, gesto, { passive: true });
  on(st.host, 'click', e => { const b = e.target.closest && e.target.closest('.ctab,button,.fac-card,.mapc,.seg button'); if (b && ARD.salaSom && ARD.salaSom.ativo() && ARD.audio.enabled) ARD.salaSom.clique(st.camera, e.clientX, b.classList.contains('fac-card') ? 'raca' : 'ui'); }, true);
  on(document, 'visibilitychange', () => { if (!document.hidden && S === st) kick(300); }); }
/* ponto do ponteiro no plano da Fenda (para mexer as partículas) */
function pick2(st, x, y) { const { W } = LIB; const ray = st.ray || (st.ray = new W.Raycaster()); const v = st.ndc || (st.ndc = new W.Vector2()); v.set(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1); ray.setFromCamera(v, st.camera);
  const c = st.fenda.centro, o = ray.ray.origin, d = ray.ray.direction; const pl = st.plano || (st.plano = new W.Plane()); const nrm = st.tmp.v2.set(d.x, 0, d.z).normalize(); pl.setFromNormalAndCoplanarPoint(nrm, c); const out = st.ptStir || (st.ptStir = new W.Vector3());
  if (!ray.ray.intersectPlane(pl, out)) return null; if (Math.hypot(out.x - c.x, out.z - c.z) > 160 || out.y < c.y - 30 || out.y > c.y + 230) return null; return out; }
function pulso(st, p) { st.fenda.pulseP.value.copy(p); st.fenda.pulseK.value = 1; LIB.gsap.to(st.fenda.pulseK, { value: 0, duration: 1.6, ease: 'power2.out' }); if (ARD.salaSom) ARD.salaSom.pulso(p); kick(1700); }
/* ---------- modo Explorar e mesa de perto: a interface sai, a câmera fica livre (arrastar gira, roda aproxima, clique foca) ---------- */
function explorar(on, o) { const st = S; if (!st || !st.ready) return; o = o || {}; on = on == null ? !st.explorar : !!on; const naMesa = on && o.alvo === 'mesa' && !!st.mesa; const g = LIB.gsap; const wrap = st.host.querySelector('.start-wrap'); const abrir = on && !st.explorar;
  st.explorar = on; st.host.classList.toggle('sala-explorar', on);
  if (abrir || !on) { if (wrap && !reduced()) g.to(wrap, { autoAlpha: on ? 0 : 1, duration: 0.5, ease: 'power2.out' }); else if (wrap) wrap.style.visibility = on ? 'hidden' : ''; }
  let bar = document.getElementById('sala-sair'); if (on && !bar) { bar = document.createElement('div'); bar.id = 'sala-sair'; bar.setAttribute('role', 'region'); bar.setAttribute('aria-label', 'Sala de Comando'); bar.innerHTML = '<span></span><button type="button" class="btn primary">Voltar ao menu</button>'; bar.querySelector('button').addEventListener('click', () => explorar(false)); st.host.appendChild(bar); }
  if (bar) { bar.hidden = !on; const leg = document.getElementById('mesa-txt'); bar.firstChild.textContent = naMesa ? 'Mesa tática · ' + (leg ? leg.textContent : '') + ' · arraste para girar' : 'Arraste para girar · roda para aproximar · clique numa construção ou na mesa'; }
  const port = innerWidth < innerHeight;
  if (on) { if (naMesa) { st.modoCam = 'mesa'; rotuloMesa(true); if (!st.mesa.ped.visible || st.mesa.ped.scale.x < 0.5) st.mesa.visivel(true); const c = st.mesa.centro; voar({ tx: c.x, ty: c.y - 1, tz: c.z, rad: Math.max(46, 15 / (Math.tan(fovBase() * Math.PI / 360) * innerWidth / innerHeight)), pol: 0.82, az: 0.2, anc: { x: innerWidth / 2, y: innerHeight * (port ? 0.4 : 0.48) } }, 1.6); if (ARD.salaSom) ARD.salaSom.foco(c); }
    else { st.modoCam = 'explorar'; rotuloMesa(false); voar({ tx: 0, ty: 30, tz: -20, rad: shot(st, 'jogar').rad * (port ? 1.1 : 1.5), pol: 1.08, az: 0.25, anc: { x: innerWidth / 2, y: innerHeight * 0.52 } }, 1.6); }
    if (abrir && bar) bar.querySelector('button').focus(); }
  else { st.foco = null; st.focoD = null; if (st.bloom && st.bloom.strength) g.to(st.bloom.strength, { value: st.bloomK, duration: 1.2 }); if (st.tag) st.tag.classList.remove('on'); rotuloMesa(false); st.modoCam = 'repouso'; if (st.mesa) st.mesa.visivel(st.aba === 'jogar'); if (st.vivo) { g.to(st.U.bokeh, { value: 0, duration: 1.2 }); g.to(st.U.focal, { value: 260, duration: 1.2 }); } voar(Object.assign({ anc: st.ancPalco }, shot(st, st.aba)), 1.4); const b = document.getElementById(o.de === 'mesa' ? 'btn-mesa' : 'btn-explorar'); if (b) b.focus(); }
  if (!st.vivo) { st.anim = on; kick(1800); } }
/* ---------- parada: solta o laço e TODOS os recursos da GPU (antes da partida) ---------- */
function stop(o) { const st = S; if (!st) return; S = null; const partida = !!(o && o.partida); /* começo da partida: nada volta para a vitrine */
  try { if (st.renderer && st.renderer._initialized) { const pl = st.renderer.setAnimationLoop(null); if (pl && pl.catch) pl.catch(() => {}); } } catch (e) {} /* 5.0a.1: sem iniciar (sem WebGL nem WebGPU) o setAnimationLoop tentava o init de novo e a rejeição escapava */
  /* 5.0a.1: no clique a Sala para por inteiro (laço, voos, aquecimento e compilações: tudo checa S) e o canvas sai da página na hora. A GPU é solta assim que
     a fila dela esvazia: destruir o device com um quadro ainda na fila prendia o processo da GPU até o quadro acabar, e a partida esperava ali para criar o
     contexto WebGL dela (31 s no SwiftShader com a máquina carregada). Na GPU de verdade a fila esvazia em milissegundos */
  if (st.cv && st.cv.parentNode) st.cv.parentNode.removeChild(st.cv);
  for (const tw of st.tw) { try { tw.kill(); } catch (e) {} } if (LIB && LIB.gsap) { try { LIB.gsap.killTweensOf([st.rig, st.anc, st.par, st.cv]); if (st.holo) LIB.gsap.killTweensOf(st.holo.U.revela); if (st.U) LIB.gsap.killTweensOf([st.U.bokeh, st.U.focal]); if (st.bloom && st.bloom.strength) LIB.gsap.killTweensOf(st.bloom.strength); if (st.fenda && st.fenda.pulseK) LIB.gsap.killTweensOf(st.fenda.pulseK); } catch (e) {}
    if (st.gsapNoLaco) { const tk = LIB.gsap.ticker; tk.add(LIB.gsap.updateRoot); tk.tick(); tk.lagSmoothing(500, 33); } } /* o GSAP volta ao relógio dele já sincronizado: as animações da partida começam na hora */
  for (const [el, ev, f, o] of st.on) el.removeEventListener(ev, f, o); if (st.ro) st.ro.disconnect(); clearTimeout(st.aqT);
  if (ARD.salaSom) ARD.salaSom.parar();
  if (st.tag && st.tag.parentNode) st.tag.parentNode.removeChild(st.tag); if (st.flashEl && st.flashEl.parentNode) st.flashEl.remove(); const bar = document.getElementById('sala-sair'); if (bar) bar.remove();
  if (st.host) { st.host.classList.remove('sala-on', 'sala-explorar'); const wrap = st.host.querySelector('.start-wrap'); if (wrap) { wrap.style.opacity = ''; wrap.style.visibility = ''; } }
  if (!partida && ARD.uiStart && ARD.uiStart.salaPronta) try { ARD.uiStart.salaPronta(false); } catch (e) {} /* falha: o busto 3D da vitrine volta; na partida, não (ele montaria um WebGL que ninguém soltaria) */
  let feito = false; const soltar = () => { if (feito) return; feito = true; liberar(st); };
  if (partida && st.fila) { st.fila.onSubmittedWorkDone().then(soltar, soltar); setTimeout(soltar, 120000); } else soltar(); }
/* solta tudo: mesa, bustos, mundo, cena, materiais, PMREM, pós e, por fim, o renderizador (que destrói o device do WebGPU) */
function liberar(st) {
  try { if (st.mesa) st.mesa.dispose(); } catch (e) {} try { if (st.holo) st.holo.dispose(); } catch (e) {} descartarMundo(st.mundo);
  try { if (st.scene) st.scene.traverse(o => { if (o.geometry && o.geometry.dispose) o.geometry.dispose(); const m = o.material; if (m) (Array.isArray(m) ? m : [m]).forEach(x => x.dispose && x.dispose()); }); } catch (e) {}
  try { if (st.planetas) for (const g of st.planetas.geos) g.dispose(); if (st.C && st.C.mats) for (const k in st.C.mats) st.C.mats[k].dispose(); for (const d of st.disp) if (d && d.dispose) d.dispose(); } catch (e) {}
  try { if (st.envRT) st.envRT.dispose(); if (st.pmrem) st.pmrem.dispose(); if (st.csm) st.csm.dispose(); if (st.pipe) st.pipe.dispose(); if (st.bloom && st.bloom.dispose) st.bloom.dispose(); } catch (e) {}
  try { if (st.scene) { st.scene.environment = null; st.scene.background = null; const cortar = o => { const ch = o.children; for (let i = ch.length - 1; i >= 0; i--) cortar(ch[i]); ch.length = 0; o.parent = null; }; cortar(st.scene); } } catch (e) {} /* caches globais do three guardam o último material e o último objeto desenhados: com o grafo cortado eles não seguram a cena inteira */
  try { if (st.renderer) { const r = st.renderer; if (!r._initialized) esvaziar(r); /* 5.0a.1: sem iniciar (sem WebGL nem WebGPU), o dispose do r186 tentava o init de novo e a rejeição escapava */ else Promise.resolve(r.dispose()).then(() => esvaziar(r), () => esvaziar(r)); } } catch (e) {} try { if (LIB && LIB.T && LIB.T.toneMappingExposure) LIB.T.toneMappingExposure.reference = null; const pp = st.pipe, cd = pp && pp._contextData; if (cd) { cd.renderPipeline = null; cd.renderPipelineState = null; cd.onBeforePipelineCallbacks.length = 0; cd.onAfterPipelineCallbacks.length = 0; } if (pp) { pp.renderer = null; pp.outputNode = null; } } catch (e) {} /* nós globais do three (exposição e os quads do bloom e do pós) guardam o último renderizador e o pipeline: sem isso a Sala inteira ficaria presa na memória durante a partida */
}
/* depois do dispose (assíncrono no r186), o renderizador solta os gerentes internos: nós globais do three (a LUT do PBR, a exposição) seguram o objeto, e sem isso a cena inteira ficaria presa durante a partida */
function esvaziar(r) { for (const k of Object.keys(r)) { if (k === 'backend' || k === 'info' || k === 'domElement' || k === 'onDeviceLost' || k === '_isDeviceLost') continue; try { r[k] = null; } catch (e) {} } }
/* 5.0a.1: o que tools/sala-posteres.cjs grava junto com cada pôster (assets/sala-posteres.json): o tamanho da tela, a âncora do palco, a câmera
   (posição, alvo, abertura e centro de projeção), os planetas e o rasgo, e onde ficam na imagem o holograma e a Fenda (para o movimento 2D do celular) */
function posterInfo() { const st = S; if (!st || !st.ready) return null; const W = LIB.W, cam = st.camera, w = innerWidth, h = innerHeight; const a = ancoraPalco(st);
  const v = cam.view && cam.view.enabled ? cam.view : null; const c = v ? [w / 2 - v.offsetX, h / 2 - v.offsetY] : [w / 2, h / 2]; const arr = x => x.toArray().map(n => Math.round(n * 1000) / 1000);
  const tela = p => { const q = p.clone().project(cam); return [Math.round((q.x + 1) / 2 * w * 10) / 10, Math.round((1 - q.y) / 2 * h * 10) / 10]; };
  const planetas = []; for (const k in st.planetas.por) { const p = st.planetas.por[k]; if (p.g.visible) planetas.push([k].concat(arr(p.g.position), Math.round(p.g.scale.x * 1000) / 1000)); }
  const rs = st.fenda && st.fenda.rasgo; const pb = st.holo.prep[st.race]; let holo = null; if (pb) { const bx = new W.Box3().setFromObject(pb.g); const cs = []; for (const x of [bx.min.x, bx.max.x]) for (const y of [bx.min.y, bx.max.y]) for (const z of [bx.min.z, bx.max.z]) cs.push(tela(new W.Vector3(x, y, z)));
    const xs = cs.map(q => q[0]), ys = cs.map(q => q[1]); holo = [Math.min(...xs), Math.min(...ys), Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)].map(n => Math.round(n)); }
  return { w, h, dpr: Math.round((window.devicePixelRatio || 1) * 100) / 100, pr: st.pr, anc: [Math.round(a.x * 10) / 10, Math.round(a.y * 10) / 10], palcoH: Math.round(st.palcoH * 10) / 10, race: st.race,
    cam: { p: arr(cam.position), t: arr(st.tmp.ct), fov: Math.round(cam.fov * 10000) / 10000, c: c.map(n => Math.round(n * 10) / 10) }, planetas,
    rasgo: rs ? { p: arr(rs.position), q: arr(rs.quaternion), s: arr(rs.scale) } : null, fx: { holo, fenda: st.fenda ? tela(st.fenda.centro.clone().setY(st.fenda.centro.y + 34)) : null, nucleo: tela(new W.Vector3(0, (st.holo.base || 40), 0)) } }; }
function info() { const st = S; if (!st) return null; const r = st.renderer && st.renderer.info; return { modo: st.modo, motor: st.gpu ? 'WebGPU' : 'WebGL2', ready: st.ready, frames: st.frames, race: st.race, fps: st.fps || 0, pr: st.pr, particulas: st.C ? st.C.nPart : 0,
  chamadas: r ? (r.render.drawCalls || r.render.calls || 0) : 0, triangulos: r ? r.render.triangles : 0, memoria: r && r.memory ? { geometrias: r.memory.geometries, texturas: r.memory.textures } : null, tempos: Object.assign({}, st.med), aba: st.aba, camera: st.modoCam, cruzando: !!st.cruzando, casado: !!st.casado, trocando: !!st.trocando, fase: st.fase || null, explorar: !!st.explorar, aquecidos: Object.assign({}, st.aquecidos || {}) }; }
/* 5.0a.1: o three WebGPU, o TSL, os addons e o GSAP começam a baixar já com a vitrine na tela (no computador); a Sala monta depois do load e da sonda */
function preparar() { const q = qs(), f = q.get('fundo'); if (LIB || f === 'off' || f === 'classico' || coarse() || reduced() || q.get('logo') === 'estatico') return; libs().catch(() => {}); }
ARD.sala = { want, mount, preparar, sombra: () => { if (S && S.sun) { S.sun.shadow.needsUpdate = true; kick(120); } }, stop, setRace, aba, explorar, voltar, voar, kick, info, posterInfo, rotuloMesa, focarLider: () => { if (S) focarLider(S); }, som: () => { if (S && S.gesto) S.gesto(); }, active: () => !!S && S.ready, ctx: () => S, libs: () => LIB, pulso: (x, z) => { if (S && S.fenda && S.fenda.pulseP) pulso(S, new LIB.W.Vector3(x, S.fenda.centro.y + 30, z)); } };
})(globalThis.ARD = globalThis.ARD || {});
