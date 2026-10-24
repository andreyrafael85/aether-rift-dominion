/* Aether Rift: Dominion — Motor 5 (5.0a, fase 1: fundação).
   WebGPURenderer do three r186 com materiais, pós e sombras em TSL, voltando sozinho para WebGL2 onde não houver WebGPU.
   Este arquivo: escolha do motor, carga do build WebGPU, renderizador, uniforms e texturas compartilhados, contadores
   (pipelines, tempo de GPU pelo timestamp do WebGPU), sombras em cascata, aquecimento e o registro de pendências da fase 2.
   Os outros: src/m5/materiais.js (materiais TSL), src/m5/pos.js (RenderPipeline) e src/m5/texturas.js (clarões e cicatrizes).
   Contrato da fase 2 em work/RELATORIO.md (cópia da fundação) e no comentário de ARD.m5.registrar. Só visual: nada aqui lê ou muda a simulação. */
(function (ARD) {
'use strict';
const Q = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
/* ---------- escolha do motor: ?motor=5 | ?motor=classico | Ajustes (ard-beta-prefs.motor) | padrão clássico ---------- */
function prefMotor() { try { return (JSON.parse(localStorage.getItem('ard-beta-prefs') || '{}') || {}).motor || null; } catch (e) { return null; } }
const pedido = Q.get('motor') || prefMotor();
ARD.motor = pedido === '5' || pedido === 'm5' || pedido === 'webgpu' ? '5' : 'classico';
const M5 = ARD.m5 = ARD.m5 || {};
M5.versao = '5.0a.1';
M5.gl = Q.get('m5gl') === '1'; /* força a reserva WebGL2 do WebGPURenderer (teste do caminho de quem não tem WebGPU) */
M5.u = M5.u || {}; M5.tex = M5.tex || {}; M5.sample = M5.sample || {};
M5.ready = () => !!(window.THREE_M5 && window.TSL && window.THREE_M5_ADDONS);
M5.active = () => ARD.motor === '5' && M5.ready();
M5.motorNome = () => ARD.motor !== '5' ? 'Clássico' : M5.cur ? (M5.cur.isWebGPU ? '5 (WebGPU)' : '5 (WebGL2)') : '5';
M5.setMotor = function (m) { ARD.motor = m === '5' ? '5' : 'classico'; if (ARD.motor === '5') M5.load(); };

/* ---------- carga: three/webgpu, three/tsl e os addons TSL (mesmo núcleo three.core do build clássico, pelo importmap) ---------- */
M5.load = function () {
  if (M5._load) return M5._load;
  const add = p => import('three/addons/' + p);
  M5._load = Promise.all([import('three/webgpu'), import('three/tsl'), add('tsl/display/BloomNode.js'), add('tsl/display/GTAONode.js'), add('tsl/display/SMAANode.js'), add('tsl/display/FXAANode.js'), add('csm/CSMShadowNode.js'), add('tsl/display/FSR1Node.js'), add('objects/SkyMesh.js')])
    .then(([W, L, B, AO, SM, FX, CSM, FSR, SKY]) => {
      window.THREE_M5 = W; window.TSL = L;
      window.THREE_M5_ADDONS = { bloom: B.bloom, BloomNode: B.default, ao: AO.ao, GTAONode: AO.default, smaa: SM.smaa, fxaa: FX.fxaa, CSMShadowNode: CSM.CSMShadowNode, fsr1: FSR.fsr1, SkyMesh: SKY.SkyMesh };
      if (W.REVISION !== (window.THREE && window.THREE.REVISION)) console.warn('[ARD] Motor 5: three/webgpu r' + W.REVISION + ' e three r' + (window.THREE && window.THREE.REVISION) + ' diferentes');
      M5.ok = true; return true;
    })
    .catch(err => { M5.ok = false; M5.err = err; window.THREE_M5 = null; console.warn('[ARD] Motor 5 indisponível (o jogo segue no clássico): ' + (err && err.message)); return false; })
    .then(ok => { try { window.dispatchEvent(new Event('m5-ready')); } catch (e) {} return ok; });
  return M5._load;
};
/* addons da fase 2 sob demanda (profundidade de campo, TRAA, TAAU, LUT, godrays…): ARD.m5.addon('tsl/display/DepthOfFieldNode.js').then(m => …) */
M5.addon = p => import('three/addons/' + p);

/* ---------- registro de pendências da fase 2 (o que no Motor 5 ainda está desligado ou simplificado) ----------
   chave: o que o render3d consulta em ARD.m5.portado(chave); o agente da fase 2 liga a chave quando o porte TSL estiver pronto
   (ARD.m5.porte.<chave> = true no próprio módulo, ou export <módulo>.m5 = true para os módulos de src/*3d.js). */
M5.porte = Object.assign({ fx3d: false, combat3d: false, storm3d: false, lakes3d: false, space3d: false, ruinas: false, obras: false, holograma: false, escudos: false, bandeiras: false, foto: false, faroisGlsl: false, detalheChao: false }, M5.porte || {});
M5.portado = k => !!(M5.porte[k] || (ARD[k] && ARD[k].m5));
M5.pendencias = [
  { modulo: 'fx3d', arquivo: 'src/fx3d.js', funcao: 'create (material das partículas)', linha: 'ShaderMaterial único do sistema de partículas', faz: 'partículas simuladas no shader (explosões em camadas, fogo, fumaça iluminada, faíscas, rastros, pulsos) com tint por Raça e mapa de clarões', motor5: 'desligado: o render3d usa o recuo antigo (bolas de explosão, marcas no chão, pontos de 1 px)', agente: 'Efeitos e combate' },
  { modulo: 'combat3d', arquivo: 'src/combat3d.js', funcao: 'create (traçantes, feixes, projéteis)', linha: 'ShaderMaterial dos traçantes + alvo próprio', faz: 'balas na tela desde o disparo, traçantes por Raça, feixes, lança-chamas, projéteis com rastro', motor5: 'desligado (depende do fx3d): disparos e impactos acendem o chão pelo mapa de clarões; balas em linhas do recuo', agente: 'Efeitos e combate' },
  { modulo: 'storm3d', arquivo: 'src/storm3d.js', funcao: 'create (volume da Tempestade de Éter)', linha: '6 ShaderMaterial/RawShaderMaterial (marcha de raio, 4 programas) + ruído 3D', faz: 'tempestade volumétrica, cobertura no alfa para a bruma, raios com trovão (onStrike)', motor5: 'desligado: volta o disco antigo, os sprites de névoa e a chuva de pontos', agente: 'Água, espaço e tempestade' },
  { modulo: 'lakes3d', arquivo: 'src/lakes3d.js', funcao: 'create/build (lagos de plasma e de gelo)', linha: '2 onBeforeCompile + reflexo próprio (RenderTarget)', faz: 'superfície dos lagos, reflexo do gelo com câmera espelhada, plasma emissivo', motor5: 'substituto simples em src/m5/materiais.js (lagosSimples): disco na cota do lago com a borda do mapa; plasma emissivo com crosta, gelo azul com geada na borda e o céu refletido pelo PMREM (sem o reflexo da cena)', agente: 'Água, espaço e tempestade' },
  { modulo: 'space3d', arquivo: 'src/space3d.js', funcao: 'create/build (espaço do Cinturão)', linha: '3 ShaderMaterial + 1 onBeforeCompile + cena e alvo próprios', faz: 'asteroides, faces de baixo das plataformas, redemoinho da Fenda, mapa da borda (uVoidMap) do chão', motor5: 'desligado: o céu TSL entra em modo espaço (estrelas e fundo escuro) e o chão corta abaixo de −90', agente: 'Água, espaço e tempestade' },
  { modulo: 'world3d', arquivo: 'src/world3d.js', funcao: 'makeSky / spaceBackdrop / atmo', linha: 'ShaderMaterial do céu (~l.82), cubemap da nebulosa (~l.108), atmosfera por Fresnel (~l.35)', faz: 'céu com nuvens e estrelas, nebulosa assada, halo dos planetas', motor5: 'céu em TSL (materiais.js ceu), halo dos planetas em TSL (materiais.js atmo); nebulosa do Cinturão pendente', agente: 'Terreno e mundo' },
  { modulo: 'terrain3d', arquivo: 'src/terrain3d.js', funcao: 'material / detailTextures / scars', linha: 'material ~l.239 (onBeforeCompile com TERR_COLOR), GEN_FS ~l.110 (ShaderMaterial), SCAR_FS ~l.287', faz: 'chão em camadas por bioma com altura de camada, triplanar, estratos, brasa no basalto, relevo fino por derivada, texturas de detalhe geradas na GPU', motor5: 'chão TSL básico (materiais.js chao: bioma, encosta, cavidade, névoa de guerra, território, clarões, cicatrizes, brasa da Fenda); texturas de detalhe da GPU pendentes (usa o ruído de nuvem); cicatrizes portadas (texturas.js)', agente: 'Terreno e mundo' },
  { modulo: 'dress3d', arquivo: 'src/dress3d.js', funcao: 'mat / roadMat', linha: 'mat ~l.53 (onBeforeCompile: vento, rm, brilho, névoa), roadMat ~l.155 (ShaderMaterial)', faz: 'adereços com vento por peça e névoa de guerra; estradas de terra', motor5: 'material TSL dos adereços sem vento (materiais.js adereco) e estradas em TSL simples', agente: 'Terreno e mundo' },
  { modulo: 'meshes', arquivo: 'src/meshes.js', funcao: 'material / animShader / SURF_GLSL / ruinShader', linha: 'material ~l.6073, ANIM_GLSL ~l.131, SURF_GLSL ~l.191, RUIN_GLSL ~l.157', faz: 'detalhe de superfície por peça (painéis, borracha, poros, quitina, pedra, rocha), animação por peça (rodas, lagartas, pernas, rotores, recuo), ruína que desaba', motor5: 'material TSL dos modelos (materiais.js modelo: cor, rm, emissivo, rim por Raça, clarões) com ganchos ARD.m5.ganchos.modelo.posicao/superficie vazios', agente: 'Modelos' },
  { modulo: 'render3d (ruínas)', arquivo: 'src/render3d.js', funcao: 'ruinMat / ruinEm / ruinDepth / drawRuins', linha: '~l.332-345', faz: 'construção destruída vira peças que voam e assentam, miolo que desaba e brasas', motor5: 'desligado (portado(\'ruinas\')): carcaças usam o modelo genérico de destroço', agente: 'Modelos' },
  { modulo: 'render3d (obras)', arquivo: 'src/render3d.js', funcao: 'obraMat / obraOf / holoPut / matHolo', linha: '~l.347-378', faz: 'invólucros de obra por Raça (andaime, casulo com veias, cristais, casulo úmido) e holograma da planta (Erevane)', motor5: 'desligado (portado(\'obras\'), portado(\'holograma\')): a obra só cresce em degraus como no recuo', agente: 'Modelos' },
  { modulo: 'render3d (escudos)', arquivo: 'src/render3d.js', funcao: 'shieldMat / shieldPut', linha: '~l.380-388', faz: 'bolha de Fresnel com grade hexagonal do Uníssono do Coro e brilho no golpe', motor5: 'desligado (portado(\'escudos\'))', agente: 'Modelos' },
  { modulo: 'render3d (bandeiras)', arquivo: 'src/render3d.js', funcao: 'clothFor', linha: '~l.488-495', faz: 'pano com a Insígnia ondulando no vento (onBeforeCompile)', motor5: 'pano parado (o material legado sem o remendo da onda); a onda em TSL é da fase 2', agente: 'Modelos' },
  { modulo: 'render3d (faróis)', arquivo: 'src/render3d.js', funcao: 'beamMat2 / headlights', linha: '~l.506-510', faz: 'cone aditivo dos faróis (recuo, quando o mapa de clarões falta)', motor5: 'fora da cena: os faróis vão para o mapa de clarões (flashCone), como no clássico', agente: 'Efeitos e combate' },
  { modulo: 'render3d (feixes da Fenda)', arquivo: 'src/render3d.js', funcao: 'finishTerrain rayMat', linha: '~l.274', faz: 'feixes de luz subindo da Fenda', motor5: 'portado em TSL (materiais.js feixeFenda)', agente: '—' },
  { modulo: 'photo3d', arquivo: 'src/photo3d.js', funcao: 'create (Modo Foto)', linha: 'ShaderMaterial de desfoque + alvos próprios + renderer.getContext', faz: 'câmera livre, profundidade de campo, filtros, captura 2K/4K', motor5: 'botão e tecla J escondidos até a fase 2', agente: 'Modo Foto' },
];

/* ---------- uniforms e texturas compartilhados (contrato da fase 2) ----------
   ARD.m5.u.*: nós uniform do TSL, um por jogo, atualizados pelo render3d a cada quadro (ARD.m5.u.tempo.value etc.)
   ARD.m5.tex.*: nós texture do TSL (base); para amostrar use ARD.m5.sample.*(posição no mundo) ou ARD.m5.tex.X.sample(uv) */
function shared() {
  if (M5._shared) return; const T = window.THREE_M5, L = window.TSL; const S = ARD.sim; const W = S ? S.WORLD : 6000;
  const { uniform, texture, vec2, vec3, vec4, float, positionWorld, step, clamp } = L;
  const blank = (r, g, b, a) => { const t = new T.DataTexture(new Uint8Array([r, g, b, a]), 1, 1); t.needsUpdate = true; return t; };
  const U = M5.u;
  U.tempo = uniform(0);            /* segundos do visual (R.time: para na pausa, anda no Modo Foto) */
  U.noite = uniform(0);            /* 0 dia … 1 noite (R.night) */
  U.solDir = uniform(new T.Vector3(-0.47, 0.64, 0.6).normalize()); /* direção do sol (normalizada; R.sunDir) */
  U.solCor = uniform(new T.Color(1, 0.91, 0.77)); /* cor da luz do sol no quadro (com noite e clima) */
  U.ceuCor = uniform(new T.Color(0.62, 0.69, 0.77)); /* cor do céu/fundo do quadro */
  U.clima = uniform(new T.Vector4(0, 0, 0, 0)); /* rgb = tinta do clima, a = mistura (0 sem clima) */
  U.mundo = uniform(W);            /* tamanho do mapa (S.WORLD) */
  U.fenda = uniform(new T.Vector2(S ? S.CX : W / 2, S ? S.CY : W / 2)); /* centro da Fenda (coordenadas do mapa) */
  U.perto = uniform(0);            /* 0 longe … 1 câmera colada (microdetalhe do chão) */
  U.nuvemK = uniform(1);           /* sombra de nuvem no material (0 quando a bruma do pós já faz) */
  U.emissivo = uniform(1);         /* ganho das luzes das construções (1 + 0,9·noite) */
  U.detalhe = uniform(1);          /* detalhe de superfície pela qualidade (ME.setDetail) */
  U.raio = uniform(0);             /* relâmpago (0…1) */
  U.claraoRet = uniform(new T.Vector4(0, 0, 1, 1)); /* retângulo do mapa de clarões no mundo three: x0, z0, largura, altura */
  U.fendaLuz = uniform(new T.Vector4(S ? S.CX : W / 2, -60, S ? -S.CY : -W / 2, 900)); /* 5.0a.1: luz da Fenda no chão (posição no mundo three e alcance; M5.luzFenda) */
  U.fendaCor = uniform(new T.Color(0, 0, 0)); /* 5.0a.1: cor × intensidade da luz da Fenda (0 até o render3d passar a luz) */
  const X = M5.tex;
  X.clarao = texture(blank(0, 0, 0, 255));   /* mapa de clarões (alvo 512² meia precisão, visto de cima) */
  X.nevoa = texture(blank(255, 0, 0, 255));  /* névoa de guerra (R: 0 nunca visto, 110 explorado, 255 à vista) */
  X.territorio = texture(blank(0, 0, 0, 0)); /* território (rgb = cor do dono, a = 1 dentro) */
  X.cicatrizes = texture(blank(0, 0, 0, 0)); /* cicatrizes do chão (r rastros, g queimado, b cratera, a brasa) */
  X.nuvem = texture(blank(255, 255, 255, 255)); /* ruído de nuvem repetível 256² */
  X.micro = texture(blank(128, 128, 0, 255));  /* microdetalhe do chão (R seixos, G tom, B fendas) */
  X.vazio = texture(blank(255, 0, 0, 255));   /* 5.0a.1: mapa do vazio do Cinturão (R = distância com sinal até o vazio, ±64; G = ponte); neutro fora dele */
  const mapUV = p => vec2(p.x.div(U.mundo), p.z.negate().div(U.mundo)); /* mundo three → uv do mapa (x, −z) */
  M5.mapUV = mapUV;
  M5.sample.nevoa = (p = positionWorld) => X.nevoa.sample(mapUV(p)).r; /* 0…1 */
  M5.sample.territorio = (p = positionWorld) => X.territorio.sample(mapUV(p));
  M5.sample.cicatrizes = (p = positionWorld) => X.cicatrizes.sample(mapUV(p));
  M5.sample.nuvem = (p = positionWorld) => X.nuvem.sample(mapUV(p).mul(5).add(vec2(U.tempo.mul(0.006), U.tempo.mul(0.0035)))).r;
  M5.sample.clarao = (p = positionWorld) => { const fu = p.xz.sub(U.claraoRet.xy).div(U.claraoRet.zw); const dentro = step(0, fu.x).mul(step(0, fu.y)).mul(step(fu.x, 1)).mul(step(fu.y, 1)); const fl = X.clarao.sample(fu).rgb.mul(dentro); return fl.div(fl.add(1 / 0.3).mul(0.3)); }; /* luz já com a compressão suave fl/(1+0,3·fl) */
  M5.blank = blank;
  M5._shared = true;
}
M5.shared = shared;
/* 5.0a.1: a PointLight da Fenda do clássico vira emissivo no material do chão (mesma posição, cor, intensidade e alcance); a luz não entra na cena */
M5.luzFenda = function (l) { shared(); const U = M5.u; U.fendaLuz.value.set(l.position.x, l.position.y, l.position.z, l.distance || 900); U.fendaCor.value.copy(l.color).multiplyScalar(l.intensity); };

/* ---------- renderizador ---------- */
function gpuProbe() { try { const c = document.createElement('canvas'); const gl = c.getContext('webgl2') || c.getContext('webgl'); if (!gl) return '?'; const e = gl.getExtension('WEBGL_debug_renderer_info'); const n = String(e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)); const lose = gl.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext(); return n; } catch (e) { return '?'; } }
/* cria o WebGPURenderer do jogo (o render3d chama no lugar do WebGLRenderer); X.ready resolve depois do await renderer.init() */
M5.create3d = function (canvas, R) {
  const T = window.THREE_M5; shared();
  const forceGL = M5.gl || !navigator.gpu;
  const renderer = new T.WebGPURenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance', forceWebGL: forceGL, trackTimestamp: !forceGL }); /* timestamp só no WebGPU: na reserva WebGL2 as consultas aninhadas do pós dão 'query is already active' */
  const X = { renderer, T, L: window.TSL, A: window.THREE_M5_ADDONS, R, forceGL, isWebGPU: false, initMs: 0, gpuName: gpuProbe(), pipes: 0, pipesFrame: 0, programs: 0, gpu: { on: false, ms: [], last: 0, n: 0, busy: false }, errors: [], pipeLog: [], warmDone: false };
  M5.cur = X;
  const t0 = performance.now();
  X.ready = renderer.init().then(() => {
    X.initMs = Math.round(performance.now() - t0); X.isWebGPU = !!renderer.backend.isWebGPUBackend; X.backend = X.isWebGPU ? 'WebGPU' : 'WebGL2';
    const be = renderer.backend; /* contador honesto: cada pipeline de desenho ou compute criado (cache do three errou) */
    if (!X.isWebGPU && be.trackTimestamp) be.trackTimestamp = false; /* reserva WebGL2 automática (adaptador WebGPU falhou): sem consultas de tempo aninhadas */
    if (be.capabilities && be.capabilities.getUniformBufferLimit) be.capabilities.getUniformBufferLimit = () => 0; /* matrizes das instâncias sempre como atributo (como no clássico): com o bloco de uniforms o tamanho do InstancedMesh entra no shader e cada capacidade (64, 160, 256, os blocos do dress3d…) virava um programa novo */
    for (const k of ['createRenderPipeline', 'createComputePipeline']) { const f = be[k]; if (typeof f === 'function') be[k] = function (ro) { X.pipes++; X.pipesFrame++; if ((X.warmDone || X.debugPipes === 2) && X.pipeLog.length < (X.debugPipes === 2 ? 800 : 60)) { try { const rt = ro && ro.context && ro.context.renderTarget; const u = be.utils; X.pipeLog.push((ro && ro.material ? (ro.material.name || ro.material.type) : k) + ' · ' + (ro && ro.object ? (ro.object.name || ro.object.type) : '') + ' · ' + (rt ? (rt.texture && rt.texture.name) || 'alvo' : 'tela') + (X.debugPipes && u && u.getCurrentColorFormat && ro && ro.context ? ' · ' + [u.getCurrentColorFormat(ro.context), u.getSampleCountRenderContext(ro.context), u.getCurrentDepthStencilFormat(ro.context), rt ? rt.width + 'x' + rt.height : '', X.frameNo].join('/') : ' · quadro ' + X.frameNo)); } catch (e) {} } return f.apply(this, arguments); }; } /* X.pipeLog: o que nasceu depois do aquecimento (diagnóstico) */
    { const f = be.createProgram; if (typeof f === 'function') be.createProgram = function () { X.programs++; return f.apply(this, arguments); }; }
    if (X.isWebGPU && be.device) { be.device.addEventListener('uncapturederror', ev => { const m = 'WebGPU: ' + String(ev.error && ev.error.message || ev.error).slice(0, 300); X.errors.push(m); if (R && R.shaderErrors) R.shaderErrors.push(m); console.error('[ARD] ' + m); });
      const ad = be.adapter || null; const inf = ad && ad.info; if (inf) X.adapter = [inf.vendor, inf.architecture, inf.description].filter(Boolean).join(' · '); }
    X.timestamp = !!(be.trackTimestamp && renderer.hasFeature && renderer.hasFeature('timestamp-query')); /* sem rastreio ligado, o resolve só avisa no console */
    if (X.debugPipes && renderer._pipelines) { const P = renderer._pipelines, rel = P._releasePipeline; X.relLog = []; P._releasePipeline = function (pl) { if (X.warmDone && X.relLog.length < 30) X.relLog.push('libera ' + (pl && pl.cacheKey ? String(pl.cacheKey).slice(0, 40) : '') + ' @ ' + String(new Error().stack).split('\n').slice(2, 9).map(l => l.trim().replace(/^at /, '').replace(/\(.*\//, '(')).join(' < ')); return rel.apply(this, arguments); };
      const base = X.T.Material.prototype; const d0 = Object.getOwnPropertyDescriptor(base, 'needsUpdate'); if (d0 && d0.set) Object.defineProperty(base, 'needsUpdate', { configurable: true, get: d0.get, set(v) { if (v === true && X.warmDone && X.relLog.length < 60 && /GTAO|RTT|Bloom/.test(this.name || '')) X.relLog.push('needsUpdate ' + this.name + ' @ ' + String(new Error().stack).split('\n').slice(2, 10).map(l => l.trim().replace(/^at /, '').replace(/\(.*\//, '(')).join(' < ')); d0.set.call(this, v); } }); } /* diagnóstico ?m5pipes=1 */
    console.log('[ARD] Motor 5: ' + X.backend + (forceGL && !M5.gl ? ' (sem navigator.gpu)' : '') + ' · início ' + X.initMs + ' ms · GPU ' + (X.adapter || X.gpuName) + ' · timestamp ' + (X.timestamp ? 'sim' : 'não'));
    return X;
  }, err => { X.failed = err; console.error('[ARD] Motor 5: renderer.init() falhou: ' + (err && err.message)); throw err; });
  /* tempo de GPU do quadro pelo timestamp do WebGPU (timestamp-query); na reserva WebGL2 fica desligado (consultas aninhadas do pós) */
  X.gpuTimer = on => { X.gpu.on = !!(on && X.timestamp); X.gpu.ms.length = 0; return X.gpu.on; };
  X.marcas = []; X.marca = rot => { const t = performance.now(); X.marcas.push([rot, Math.round(t - (X.marcaT || t)), X.pipes]); X.marcaT = t; }; /* 5.0a.1: passos do aquecimento (ms desde o passo anterior, pipelines até ali) */
  X.frameNo = 0; X.debugPipes = /m5pipes=2/.test(location.search) ? 2 : /m5pipes=1/.test(location.search); /* 1: o que nasce depois do aquecimento; 2: todos */
  const tsOk = v => { const G = X.gpu; G.busy = false; if (typeof v === 'number' && v > 0) { G.last = v; if (G.on && G.ms.length < 20000) G.ms.push(v); } }, tsErr = () => { X.gpu.busy = false; }; /* funções criadas uma vez (sem fechar escopo novo por quadro) */
  X.afterFrame = () => { X.frameNo++; const G = X.gpu; G.n++; if (!X.timestamp || G.busy) return; if (G.on ? G.n % 2 !== 0 : G.n % 30 !== 0) return; G.busy = true; /* no teste, a cada 2 quadros (o three soma o último quadro resolvido); fora dele, a cada 30 */
    renderer.resolveTimestampsAsync('render').then(tsOk, tsErr); };
  return X;
};

/* ---------- sombras em cascata (CSMShadowNode): o WebGPURenderer não tem PCFSoftShadowMap; a suavidade vem do raio do PCF ----------
   Média: 2 cascatas de 1536²; Alta: 3 de 2048²; Ultra: 4 de 2048². As cascatas nascem na carga (shadowsBuild, depois do init) com a
   qualidade final; no meio da partida a troca de qualidade só liga/desliga e muda o tamanho do mapa. */
const csmCfg = q => ({ casc: +(Q.get('m5casc') || 0) || (q.resolved === 'ultra' ? 4 : q.resolved === 'alta' ? 3 : 2), size: q.resolved === 'ultra' || q.resolved === 'alta' ? 2048 : 1536 }); /* 5.0a.1: ?m5casc=N (medida) */
M5.shadows = function (X, sun, q) {
  const r = X.renderer; r.shadowMap.enabled = !!q.shadows; r.shadowMap.type = X.T.PCFShadowMap; sun.castShadow = !!q.shadows; X.shadowQ = q; X.sun = sun;
  if (!q.shadows) return; if (X.csmOff) { const n = q.shadowMap || 2048; sun.shadow.mapSize.set(n, n); return; } if (!X.csm) { if (X.built) M5.shadowsBuild(X, sun); return; }
  const c = csmCfg(q); for (const l of X.csm.lights) l.shadow.mapSize.set(c.size, c.size);
};
M5.csmModo = Q.get('m5csm'); /* '0' sombra única (a caixa do clássico que segue a câmera), '1' cascatas; sem parâmetro: cascatas no WebGPU */
M5.shadowsBuild = function (X, sun) {
  X.built = true; const q = X.shadowQ; if (!q || !q.shadows || X.csm) return; const A = window.THREE_M5_ADDONS; const c = csmCfg(q);
  if (M5.csmModo === '0' || (M5.csmModo !== '1' && !X.isWebGPU)) { const n = q.shadowMap || 2048; sun.shadow.mapSize.set(n, n); sun.shadow.bias = -0.0006; sun.shadow.radius = 2; X.csmOff = true; return; } /* sombra única: o updateCamera do render3d ajusta a caixa como no clássico */
  sun.shadow.mapSize.set(c.size, c.size); sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.35; sun.shadow.radius = 2; sun.shadow.camera.near = 1; sun.shadow.camera.far = 6000;
  const csm = new A.CSMShadowNode(sun, { cascades: c.casc, maxFar: 2400, mode: 'practical', lightMargin: 700 }); csm.fade = Q.get('m5fade') !== '0'; sun.shadow.shadowNode = csm; /* 5.0a.1: ?m5fade=0 (medida) */ X.csm = csm; X.csmFar = 2400; X.csmCasc = c.casc;
};
/* a cada quadro: alcance das cascatas pela distância da câmera; câmeras das cascatas com perto/longe do mundo do jogo */
M5.csmFrame = function (X, camDist) {
  const csm = X.csm; if (!csm) return; if (csm.lights.length && !X.csmCam) { for (const l of csm.lights) { const c = l.shadow.camera; c.near = 1; c.far = 6000; c.updateProjectionMatrix(); } X.csmCam = true; }
  const want = Math.max(700, Math.min(3200, camDist * 2.3)); if (csm.camera && Math.abs(want - X.csmFar) / X.csmFar > 0.12) { X.csmFar = want; csm.maxFar = want; csm.updateFrustums(); }
};
M5.csmResize = function (X) { if (X.csm && X.csm.camera) X.csm.updateFrustums(); };

/* ---------- por quadro: os uniforms compartilhados seguem o render3d (dia e noite com as mesmas curvas de hoje) ---------- */
M5.frame = function (X, R, nt, sun, bg, cl, lightning) {
  const U = M5.u; U.tempo.value = R.time; U.noite.value = nt; U.solDir.value.set(R.sunDir[0], R.sunDir[1], R.sunDir[2]).normalize(); U.solCor.value.copy(sun.color); U.ceuCor.value.copy(bg);
  if (cl && cl.tint) U.clima.value.set(cl.tint[0], cl.tint[1], cl.tint[2], cl.mix); else U.clima.value.set(0, 0, 0, 0); U.emissivo.value = 1 + 0.9 * nt; U.raio.value = Math.min(1, lightning || 0);
  X.pipesFrame = 0; /* o detetive lê quantos pipelines nasceram neste quadro (X.pipesFrame depois do desenho) */
  /* 5.0a.1: cascatas de sombra longe redesenham em quadros alternados (cada cascata redesenha a cena inteira; a de perto segue a cada quadro).
     O mapa e a matriz da cascata mudam juntos (o three só refaz os dois quando redesenha), então a sombra não escorrega; ?m5sombra=todas desliga */
  const csm = X.csm; if (csm && csm.lights && csm.lights.length > 1 && M5.sombraAlterna) { const tudo = !X.warmDone || R.warming; for (let i = 1; i < csm.lights.length; i++) { const sh = csm.lights[i].shadow; if (!sh) continue; sh.autoUpdate = false; sh.needsUpdate = tudo || (X.frameNo + i) % 2 === 0; } }
};
M5.sombraAlterna = Q.get('m5sombra') !== 'todas';

/* ---------- luz de ambiente pelo céu do mapa (PMREM do céu TSL com o chão do mapa), refeita quando o clima muda ----------
   um PMREMGenerator só e o mesmo alvo reaproveitado (sem pipelines novos a cada troca); fromScene depois do init (o fromSceneAsync está obsoleto) */
M5.skyEnv = function (X, scene, cl, R) {
  const Tm = X.T; if (!X.renderer.hasInitialized || !X.renderer.hasInitialized()) return;
  if (!X.envScene) { const es = new Tm.Scene(); const sk = M5.ceu(); sk.scale.setScalar(0.02); es.add(sk); const gm = new Tm.MeshBasicNodeMaterial({ color: 0x404040 }); gm.fog = false; const gd = new Tm.Mesh(new Tm.CircleGeometry(90, 40), gm); gd.rotation.x = -Math.PI / 2; gd.position.y = -8; es.add(gd); X.envScene = es; X.envSky = sk; X.envGround = gd; X.pmrem = new Tm.PMREMGenerator(X.renderer); }
  const bgD = new Tm.Color().setRGB(0.62, 0.69, 0.77); if (cl) bgD.lerp(new Tm.Color().setRGB(cl.tint[0], cl.tint[1], cl.tint[2]), cl.mix); const gcol = R.groundCol || new Tm.Color(0.3, 0.28, 0.26);
  const u = X.envSky.userData.mat.uniforms; u.uHor.value.copy(bgD).lerp(new Tm.Color().copy(gcol).multiplyScalar(1.5), 0.28); u.uTop.value.copy(bgD).multiplyScalar(0.55).lerp(new Tm.Color(0.12, 0.2, 0.36), 0.5); u.uBot.value.copy(gcol).multiplyScalar(0.7); u.uNight.value = 0; u.uSunDir.value.set(R.sunDir[0], R.sunDir[1], R.sunDir[2]).normalize(); u.uSunCol.value.setRGB(1.0, 0.91, 0.77).multiplyScalar(1.6); u.uSpace.value = 0;
  X.envGround.material.color.copy(gcol).multiplyScalar(0.8);
  const t0 = performance.now(); X.envRT = X.pmrem.fromScene(X.envScene, 0.025, 0.1, 400, X.envRT ? { renderTarget: X.envRT } : {}); X.envMs = Math.round(performance.now() - t0);
  scene.environment = X.envRT.texture; scene.environmentIntensity = R.envSkyK; R.envK0 = R.envSkyK; R.envSky = true;
};

/* ---------- registro de material TSL (contrato da fase 2) ----------
   ARD.m5.registrar(nome, material, { env, noite }) → material: dá o nome (aparece nos pipelines e no diagnóstico), guarda na
   lista do motor e, com opts.env (número), entra na curva da noite do render3d (envMapIntensity · (1 − 0,72·noite)).
   Um material TSL vale nos dois motores do WebGPURenderer (WGSL no WebGPU, GLSL na reserva WebGL2). Tudo o que estiver na cena
   (mesmo escondido) é compilado no carregamento pelo aquecimento; objeto criado no meio da partida precisa nascer escondido na carga. */
M5.lista = M5.lista || [];
M5.registrar = function (nome, m, o) { o = o || {}; m.name = 'ard-' + nome; if (o.env != null) { m.userData.env = o.env; if (M5.cur && M5.cur.envMats) M5.cur.envMats.push(m); } if (M5.lista.length < 400) M5.lista.push(nome); return m; };
/* ganchos para a fase 2: funções (ctx) → nó, chamadas na montagem do material (null = sem efeito) */
M5.ganchos = M5.ganchos || { modelo: { posicao: null, superficie: null, emissivo: null }, chao: { cor: null }, adereco: { posicao: null } };

/* ---------- 5.0a.1: M5.Inst — instâncias por atributo da geometria: uma montagem de nós para todas as malhas do mesmo material ----------
   No r186 cada InstancedMesh monta o grafo TSL do zero (a chave de cache dos nós leva o uuid do objeto: as matrizes de instância entram no
   grafo como nós daquele objeto). A carga tinha ~650 InstancedMesh (blocos de adereços e modelos de cada Raça e jogador) = ~650 montagens
   iguais, a maior parte do tempo de "shaders e pipelines". M5.Inst imita a API do InstancedMesh que o render3d e o dress3d usam (setMatrixAt,
   setColorAt, instanceMatrix, count, computeBoundingSphere, troca de geometria) e guarda matriz e cor de instância numa InstancedBufferGeometry
   própria (iM0..iM3 num buffer intercalado, iC): para o three é uma malha comum, e as que dividem material e formato de geometria dividem a
   montagem. Os materiais do jogo leem os atributos quando o objeto é M5.Inst (M5.instMat e M5.instCor em src/m5/materiais.js). */
let InstC = null;
M5.Inst = function () {
  if (InstC) return InstC; const T = window.THREE_M5; const _m = new T.Matrix4(), _s = new T.Sphere(), _b = new T.Box3();
  InstC = class Inst extends T.Mesh {
    constructor(geometry, material, count) {
      super(geometry, material); const cap = Math.max(1, count | 0);
      this.isM5Inst = true; this.type = 'M5Inst';
      this.instanceMatrix = new T.InstancedInterleavedBuffer(new Float32Array(cap * 16), 16, 1); for (let i = 0; i < cap; i++) _m.identity().toArray(this.instanceMatrix.array, i * 16);
      this._iC = new T.InstancedBufferAttribute(new Float32Array(cap * 3).fill(1), 3); this._cSujo = -1; this._wraps = new Map(); this._n = cap; this._base = null; this._g = null;
      this.boundingSphere = null; this.boundingBox = null; this._ok = true; const g0 = this._pend; this._pend = null; this.geometry = g0; this.onBeforeRender = InstC.antes; }
    get geometry() { return this._g || this._pend; }
    set geometry(g) { if (!this._ok) { this._pend = g; return; } this._base = g || null; this._g = g ? this._wrap(g) : null; if (this._g) this._g.instanceCount = this._n; }
    get count() { return 1; } /* o three lê count > 1 como "instâncias do objeto" e põe o uuid na chave dos nós; o número de verdade vai na geometria */
    set count(v) { if (!this._ok) return; this._n = v; if (this._g) this._g.instanceCount = v; }
    _wrap(g) { let w = this._wraps.get(g); if (w) return w; w = new T.InstancedBufferGeometry(); w.index = g.index;
      for (const k in g.attributes) { const a = g.attributes[k]; if (!a.isInstancedBufferAttribute) w.setAttribute(k, a); } /* os atributos por instância da animação GLSL (aInst) ficam de fora: o formato é o mesmo antes e depois deles */
      w.groups = g.groups; w.drawRange = g.drawRange; w.userData = g.userData; w.boundingSphere = g.boundingSphere; w.boundingBox = g.boundingBox; w.name = g.name;
      for (let c = 0; c < 4; c++) w.setAttribute('iM' + c, new T.InterleavedBufferAttribute(this.instanceMatrix, 4, c * 4)); w.setAttribute('iC', this._iC); this._wraps.set(g, w); return w; }
    setMatrixAt(i, m) { m.toArray(this.instanceMatrix.array, i * 16); }
    getMatrixAt(i, m) { return m.fromArray(this.instanceMatrix.array, i * 16); }
    setColorAt(i, c) { c.toArray(this._iC.array, i * 3); if (i > this._cSujo) this._cSujo = i; }
    getColorAt(i, c) { return c.fromArray(this._iC.array, i * 3); }
    computeBoundingSphere() { const g = this._base; if (!this.boundingSphere) this.boundingSphere = new T.Sphere(); if (!g) return; if (!g.boundingSphere) g.computeBoundingSphere(); this.boundingSphere.makeEmpty(); for (let i = 0; i < this._n; i++) { this.getMatrixAt(i, _m); _s.copy(g.boundingSphere).applyMatrix4(_m); this.boundingSphere.union(_s); } }
    computeBoundingBox() { const g = this._base; if (!this.boundingBox) this.boundingBox = new T.Box3(); if (!g) return; if (!g.boundingBox) g.computeBoundingBox(); this.boundingBox.makeEmpty(); for (let i = 0; i < this._n; i++) { this.getMatrixAt(i, _m); _b.copy(g.boundingBox).applyMatrix4(_m); this.boundingBox.union(_b); } }
    dispose() { this.dispatchEvent({ type: 'dispose' }); return this; } };
  InstC.antes = function () { if (this._cSujo < 0) return; const a = this._iC; a.clearUpdateRanges(); a.addUpdateRange(0, (this._cSujo + 1) * 3); a.needsUpdate = true; this._cSujo = -1; }; /* a cor de instância sobe só na parte usada, antes do desenho */
  return InstC;
};
/* fábrica com a assinatura do InstancedMesh: M5.Inst só para material que lê os atributos de instância (M5.instMat marca userData.m5Inst);
   material que não lê (um de fora, ou um que a fase 2 trocar sem adaptar) segue num InstancedMesh de verdade: desenha certo, só monta por objeto */
M5.instancia = function (THREE) { const I = M5.Inst(); return function InstancedMesh(g, mat, n) { return mat && mat.userData && mat.userData.m5Inst ? new I(g, mat, n) : new THREE.InstancedMesh(g, mat, n); }; };
/* o dress3d recebe um THREE com o InstancedMesh trocado pela fábrica (sem mudar o dress3d) */
M5.ns = function (THREE) { const ns = Object.create(THREE); Object.defineProperty(ns, 'InstancedMesh', { value: M5.instancia(THREE), writable: true, enumerable: true, configurable: true }); return ns; }; /* defineProperty: o THREE é um módulo (propriedades só de leitura na herança) */
M5.instOff = Q.get('m5inst') === '0'; /* medida: ?m5inst=0 volta ao InstancedMesh (uma montagem de nós por malha) */

/* ---------- mesma lista de atributos em todas as variantes de uma geometria (inteira e leve): o shader do TSL lê o atributo que existe,
   então geometrias com conjuntos diferentes viram programas diferentes; o dress3d troca a inteira pela leve no meio da partida ---------- */
M5.normalizaAtributos = function (geos, defs) { const Tm = window.THREE_M5; let n = 0; for (const g of geos) { if (!g || !g.attributes || !g.attributes.position) continue; const cnt = g.attributes.position.count;
  for (const k in defs) { if (g.attributes[k]) continue; const d = defs[k], arr = new Float32Array(cnt * d.length); for (let i = 0; i < cnt; i++) arr.set(d, i * d.length); g.setAttribute(k, new Tm.BufferAttribute(arr, d.length)); n++; } } return n; };

/* ---------- aquecimento: todos os pipelines criados no carregamento (nenhum compila no meio da partida) ----------
   1) compileAsync da cena pelo passe da cena do pós (mesmo alvo e MRT: mesma chave de pipeline), com os escondidos ligados;
   2) o render3d desenha um quadro de verdade (R.warming) e mais um com tudo ligado: cria os pipelines das sombras e do pós. */
M5.warmExtra = Q.get('m5aquecer') != null ? +Q.get('m5aquecer') : 3; /* quadros a mais no aquecimento do Motor 5: o 1º desenha tudo ligado e sem recorte (cada um no seu requestAnimationFrame: os nós do pós atualizam uma vez por quadro) */
/* 5.0a.1: pipelines em paralelo. O compileAsync do r186 trata um objeto por vez: monta os nós, cria o pipeline, ESPERA ele ficar pronto
   e só então passa ao próximo, cedendo a vez ao navegador entre um e outro (sem scheduler.yield, como no Safari, cada cedida espera um
   quadro inteiro: ~6800 cedidas na carga). Aqui as promessas dos pipelines vão para uma lista só (o laço segue sem esperar e a GPU
   compila todos ao mesmo tempo) e, sem scheduler.yield, a cedida vira uma mensagem (MessageChannel) com um quadro a cada 50 ms para a
   tela de carregamento respirar. ?m5seq=1 volta ao jeito do r186 (medida). */
M5.seq = Q.get('m5seq') === '1';
M5.luzes = Q.get('m5luzes') === '1'; /* 5.0a.1: medida — ?m5luzes=1 põe de volta as 15 luzes pontuais na cena do Motor 5 */
function cedidaCurta() { const mc = new MessageChannel(), fila = []; let ult = performance.now(); mc.port1.onmessage = () => { const f = fila.shift(); if (f) f(); };
  return () => new Promise(res => { const t = performance.now(); if (t - ult > 50) { requestAnimationFrame(() => { ult = performance.now(); res(); }); return; } fila.push(res); mc.port2.postMessage(0); }); }
/* 5.0a.1: quantos quadros extras o aquecimento desenha. Eles existem pelo pós (o RenderPipeline do r186 se refaz nos dois primeiros quadros) e
   pelas cascatas de sombra; sem pós e sem sombra (Baixa) nenhum pipeline nasce neles, e cada um é um quadro inteiro com tudo ligado */
M5.quadrosExtra = R => (Q.get('m5aquecer') != null ? M5.warmExtra : (R.pp || (R.quality && R.quality.shadows) ? M5.warmExtra : 0));
M5.compile = async function (X, scene, camera) {
  const t0 = performance.now(), p0 = X.pipes; X.marcaT = t0; X.scene = scene; X.camera = camera; /* o render3d liga tudo antes (tudoVisivel); cena e câmera ficam para o diagnóstico */
  const r = X.renderer, PL = r._pipelines, todas = [], C = X.carga = { modo: M5.seq ? 'sequencial' : 'paralelo', cedida: 'nativa' };
  let gfr = null, sch = null, schDono = false;
  if (!M5.seq && PL && typeof PL.getForRender === 'function') { gfr = PL.getForRender; PL.getForRender = function (ro, promises) { return gfr.call(this, ro, promises ? todas : promises); }; } /* a lista local do laço fica vazia: nada de esperar objeto a objeto */
  if (!M5.seq && !(window.scheduler && typeof window.scheduler.yield === 'function')) { C.cedida = 'MessageChannel'; if (window.scheduler) { sch = window.scheduler; sch.yield = cedidaCurta(); } else { window.scheduler = { yield: cedidaCurta() }; schDono = true; } }
  try { const sp = X.post && X.post.scenePass; if (sp && sp.compileAsync) await sp.compileAsync(r); else await r.compileAsync(scene, camera); C.nosMs = Math.round(performance.now() - t0); C.emVoo = todas.length; await Promise.all(todas); } catch (err) { console.warn('[ARD] Motor 5: compileAsync falhou: ' + err.message); }
  finally { if (gfr) PL.getForRender = gfr; if (schDono) { try { delete window.scheduler; } catch (e) { window.scheduler = undefined; } } else if (sch) delete sch.yield; }
  X.compileMs = Math.round(performance.now() - t0); X.compilePipes = X.pipes - p0; C.ms = X.compileMs; C.pipes = X.compilePipes; return X.compileMs;
};
})(globalThis.ARD = globalThis.ARD || {});
