/* Aether Rift: Dominion — Motor 5 (5.0b, fase 2): o Modo Foto no RenderPipeline do three r186.
   O src/photo3d.js (câmera livre, painel, tempo, luz, entrada e saída) chama isto quando a partida roda no Motor 5 (R.m5).
   - Uma cadeia de pós própria do foto (P.cadeia de src/m5/pos.js: os mesmos uniforms da partida, nós próprios) com a profundidade de
     campo do TSL (dof) entre a cena em HDR (AO e bruma) e o bloom, e o filtro ArdFoto no fim (depois do AA): cena → GTAO → bruma →
     dof → bloom → gradação → tons → AA → filtro, a mesma ordem do clássico. Nós divididos entre dois RenderPipeline se remontam a cada
     troca (o setup recria nós como o uniformArray do bloom e do dof, e o código muda), então a cadeia do foto não divide nó nenhum com
     a da partida. Filtro, abertura, foco, brilho e exposição são uniforms; desligar o desfoque zera um uniform e pula os passes dele
     (nenhum pipeline novo).
   - Filtro ArdFoto em TSL: a mesma conta do GLSL do clássico (FOTO_FS do photo3d), sem ramos (aberração, grão, tom e faixas pelo valor).
     Entra depois do AA já em sRGB: volta ao linear e segue a conta do clássico (que recebia linear) até a codificação sRGB do fim.
   - Captura: o quadro da foto é desenhado num alvo do tamanho pedido e lido com readRenderTargetPixelsAsync; o canvas na tela não muda.
     Com o pós, os nós (que se medem por renderer.getDrawingBufferSize) veem o tamanho da foto só durante esse desenho; sem o pós (Baixa),
     o alvo da foto vira o alvo de saída do renderer (a cena desenha no alvo intermediário de sempre e a conversão de tons sai na foto).
   - Foco por toque: um quad 1×1 lê a profundidade do passe da cena (empacotada em 24 bits, como no clássico).
   - Aquecimento na primeira entrada ("Preparando o Modo Foto…", F.passo): a cadeia do foto desenha quadro a quadro (com e sem desfoque,
     quase tudo num alvo 16×16, o quad final também na tela) até nenhum pipeline novo nascer (o pós do r186 se refaz nos primeiros
     quadros), com o quad final no alvo RGBA8 da captura e o quad da profundidade; depois disso entrar, sair, trocar filtro e fotografar
     não criam pipeline. Fora da carga de propósito (regras de carga da 5.0a.1): a partida não paga nada pelo modo; ?m5foto=carga
     aquece na carga (aquecer, chamado pelo render3d).
   - Sombras em cascata: csm() refaz as cascatas quando a lente, a proporção ou o plano próximo da câmera do foto mudam; no quadro da foto
     todas redesenham (a 5.0a.1 alterna as de longe entre os quadros).
   Só visual: nada aqui lê ou muda a simulação. */
(function (ARD) {
'use strict';
const M5 = ARD.m5 = ARD.m5 || {};
M5.porte = M5.porte || {}; M5.porte.foto = true; /* 5.0b: Modo Foto portado (o main volta a criar o photo3d e a mostrar o 📷 e a tecla J no Motor 5) */
if (Array.isArray(M5.pendencias)) M5.pendencias = M5.pendencias.filter(p => p.modulo !== 'photo3d');
const FOTO = M5.foto = M5.foto || {};
FOTO.naCarga = typeof location !== 'undefined' && new URLSearchParams(location.search).get('m5foto') === 'carga'; /* 5.0b: o aquecimento do foto fica na primeira entrada; ?m5foto=carga leva para a carga (medida) */

/* addon da profundidade de campo (three/addons pelo importmap, a mesma cópia do build WebGPU) */
let dofP = null;
FOTO.dof = function () {
  if (!dofP) dofP = (M5.addon ? M5.addon('tsl/display/DepthOfFieldNode.js') : Promise.reject(new Error('sem ARD.m5.addon')))
    .then(m => (FOTO.dofFn = m.dof || null), err => { console.warn('[ARD] Modo Foto: profundidade de campo indisponível no Motor 5: ' + (err && err.message)); FOTO.dofFn = null; return null; });
  return dofP;
};
/* a exposição do tone mapping em uso num uniform compartilhado e documentado: ARD.m5.u.exposicao (float) = renderer.toneMappingExposure —
   1 na partida; no Modo Foto, a exposição do painel (2^EV). O porte dos efeitos imita a saída sem pós com a inversa exata dela assumindo
   exposição 1: a junção da 5.0b liga os dois por aqui. Nasce com o Motor 5 (m5-ready), antes de qualquer material */
FOTO.exposicao = function (v) { const L = window.TSL; if (!M5.u) M5.u = {}; if (!M5.u.exposicao && L && L.uniform) M5.u.exposicao = L.uniform(1); if (M5.u.exposicao && v != null) M5.u.exposicao.value = v; return M5.u.exposicao || null; };
if (typeof window !== 'undefined') window.addEventListener('m5-ready', () => { if (M5.ok) { FOTO.exposicao(); FOTO.dof(); } }); /* a carga do addon começa junto com a do Motor 5 */

/* uniforms do filtro: as mesmas chaves do efeito do clássico (o photo3d escreve igual nos dois motores) e uRes (tamanho da imagem) */
function filtroU(T, L) {
  const u = L.uniform;
  return { uWB: u(new T.Vector3(1, 1, 1)), uCon: u(1), uSat: u(1), uMono: u(0), uMonoW: u(new T.Vector3(0.2126, 0.7152, 0.0722)), uSh: u(new T.Vector3(1, 1, 1)), uHi: u(new T.Vector3(1, 1, 1)),
    uSplit: u(0), uFade: u(0), uCurve: u(0), uVig: u(0), uGrain: u(0), uCA: u(0), uBars: u(0), uSeed: u(0), uRes: u(new T.Vector2(1, 1)) };
}
/* hash e ruído de valor do grão como funções de verdade no WGSL (Fn().setLayout: regra de carga da 5.0a.1), montadas uma vez */
let FNS = null;
function fotoFns(L) {
  if (FNS) return FNS; const { Fn, vec2, vec3, dot, mix, fract, floor } = L;
  const hash = Fn(([q2]) => { const q = fract(vec3(q2.x, q2.y, q2.x).mul(0.1031)).toVar(); q.addAssign(dot(q, q.yzx.add(33.33))); return fract(q.x.add(q.y).mul(q.z)); }).setLayout({ name: 'fotoHash', type: 'float', inputs: [{ name: 'p', type: 'vec2' }] });
  const ruido = Fn(([q]) => { const i = floor(q), f0 = fract(q), f = f0.mul(f0).mul(vec2(3).sub(f0.mul(2))); return mix(mix(hash(i), hash(i.add(vec2(1, 0))), f.x), mix(hash(i.add(vec2(0, 1))), hash(i.add(vec2(1, 1))), f.x), f.y); }).setLayout({ name: 'fotoRuido', type: 'float', inputs: [{ name: 'p', type: 'vec2' }] });
  FNS = { hash, ruido }; return FNS;
}
/* o filtro ArdFoto (photo3d FOTO_FS) em TSL; t = textura do AA (sRGB) */
function filtro(L, t, U) {
  const { uv, vec2, vec3, vec4, float, dot, mix, max, min, clamp, pow, smoothstep, step, length, fract, floor, abs, sRGBTransferEOTF, sRGBTransferOETF } = L;
  const LW = vec3(0.2126, 0.7152, 0.0722);
  const fns = fotoFns(L), ruido = fns.ruido;
  const p = uv(), dc = p.sub(0.5);
  const o = dc.mul(dot(dc, dc)).mul(U.uCA).mul(0.05); /* aberração cromática radial (o = 0 sem aberração: as três leituras caem no mesmo ponto) */
  let c = vec3(t.sample(p.sub(o)).r, t.sample(p).g, t.sample(p.add(o)).b);
  c = sRGBTransferEOTF(c); /* o AA sai em sRGB; o filtro do clássico recebia linear */
  c = pow(max(c, vec3(0)), vec3(0.4545)).mul(U.uWB);
  c = mix(c, vec3(dot(c, U.uMonoW)), U.uMono);
  c = max(mix(vec3(dot(c, LW)), c, U.uSat), vec3(0));
  c = clamp(c.sub(0.45).mul(U.uCon).add(0.45), 0, 1); c = mix(c, c.mul(c).mul(vec3(3).sub(c.mul(2))), U.uCurve);
  { let tt = mix(U.uSh, U.uHi, smoothstep(0.15, 0.85, dot(c, LW))); tt = tt.div(max(dot(tt, LW), 0.001)); c = mix(c, c.mul(tt), U.uSplit); } /* tom em sombras e luzes (uSplit 0 = sem) */
  c = mix(vec3(U.uFade), vec3(float(1).sub(U.uFade.mul(0.3))), c);
  const ar = U.uRes.x.div(max(U.uRes.y, 1));
  const dv = length(dc.mul(vec2(ar, 1))).div(length(vec2(ar.mul(0.5), 0.5))); c = c.mul(float(1).sub(U.uVig.mul(0.92).mul(smoothstep(0.3, 1, dv))));
  { const gp = p.mul(U.uRes).div(max(U.uRes.y.div(1100), 1).mul(1.25)).add(U.uSeed.mul(57)); const n = ruido(gp).add(ruido(gp.mul(1.93).add(11.7)).mul(0.6)).sub(0.8); const lt = dot(c, LW);
    c = c.add(n.mul(U.uGrain).mul(0.17).mul(float(0.35).add(float(0.65).mul(float(1).sub(min(1, abs(lt.sub(0.5)).mul(1.6))))))); } /* grão (uGrain 0 = sem) */
  { const fx = step(0.0001, U.uBars).mul(step(ar, U.uBars)).mul(step(ar.mul(0.5).div(max(U.uBars, 0.0001)), abs(dc.y))); c = c.mul(float(1).sub(fx)); } /* faixas 2,39:1 */
  return vec4(sRGBTransferOETF(pow(clamp(c, 0, 1), vec3(2.2))), 1);
}

/* a composição do desfoque com a mistura do pmndrs (o DepthOfFieldEffect do clássico): campos de perto e de longe com min(CoC × bokeh, 1).
   A do dof do TSL usa min(CoC × 2, 1), que borra menos o que está pouco fora de foco com a lente aberta e na foto maior (o bokeh cresce
   junto). Troca só o fragmentNode do material da composição, depois de cada setup do nó; sem esses campos (outro three), fica a do TSL */
function compor(dn, L) {
  const n = dn._blur16NearTextureNode, f = dn._blur16FarTextureNode, m = dn._compositeMaterial, s = dn.bokehScaleNode;
  if (!n || !f || !m || !s || typeof n.sample !== 'function' || typeof f.sample !== 'function') return;
  const { Fn, uv, vec4, mix, min } = L;
  m.fragmentNode = Fn(() => { const p = uv(), perto = n.sample(p), longe = f.sample(p), cena = dn.textureNode.sample(p);
    const c = mix(cena.rgb, longe.rgb, min(longe.a.mul(s), 1)); return vec4(mix(c, perto.rgb, min(perto.a.mul(s), 1)), 1); })();
  m.needsUpdate = true;
}

/* ---------- o objeto do foto para um pós (P = o objeto de src/m5/pos.js; null = sem o pós) ---------- */
function criar(X, P) {
  const T = X.T, L = X.L, r = X.renderer, dofFn = FOTO.dofFn || null;
  const F = { X, P, pronto: false, etapa: 0, p0: 0, fase: 'mini', ciclos: 0, tela: 0, U: filtroU(T, L), D: { foco: L.uniform(300), alcance: L.uniform(150), bokeh: L.uniform(2), on: L.uniform(1) },
    pipe: null, ch: null, dofN: null, dofOn: true, s0: 0.55, capRT0: null, capRT: null, dsRT: null, dq: null, uUv: null, erro: null };
  const reg = (n, m) => { if (M5.registrar) M5.registrar(n, m); else m.name = 'ard-' + n; return m; }; /* ARD.m5.registrar: nome ard-… nos pipelines (?m5pipes) e na lista do motor */
  const nome = (pp, n) => { try { reg(n, pp._quadMesh.material); } catch (e) {} };
  const comoTex = n => n.isTextureNode ? n : typeof n.getTextureNode === 'function' ? n.getTextureNode() : L.convertToTexture(n); /* o SMAA já devolve a textura; FXAA e sem AA passam por um alvo */
  if (P && P.cadeia) {
    try {
      const ch = F.ch = P.cadeia((hdr, sp) => {
        if (!dofFn) return hdr;
        const dn = F.dofN = dofFn(hdr, sp.getViewZNode(), F.D.foco, F.D.alcance, F.D.bokeh);
        const ub = dn.updateBefore; dn.updateBefore = function (frame) { if (F.dofOn) return ub.call(this, frame); }; /* desfoque desligado: os passes dele não rodam (o mix com 0 ignora o resultado velho) */
        const su = dn.setup; dn.setup = function (b) { const o = su.call(this, b); compor(this, L); return o; }; /* a mistura do clássico (compor) */
        return L.mix(hdr, dn, F.D.on);
      });
      if (ch.bloomN) F.s0 = ch.bloomN.strength.value;
      F.pipe = new T.RenderPipeline(r); F.pipe.outputColorTransform = false; F.pipe.outputNode = filtro(L, comoTex(ch.aa), F.U); nome(F.pipe, 'foto');
      const dt = ch.sp.renderTarget && ch.sp.renderTarget.depthTexture;
      if (dt) { const { texture, uniform, vec3, vec4, fract, mix, step } = L; F.uUv = uniform(new T.Vector2(0.5, 0.5)); const d = texture(dt, F.uUv).r;
        const e0 = fract(vec3(d, d, d).mul(vec3(1, 255, 65025))), e = e0.sub(e0.yzz.mul(vec3(1 / 255, 1 / 255, 0)));
        F.dq = new T.QuadMesh(new T.NodeMaterial()); F.dq.material.fragmentNode = mix(vec4(e, 0), vec4(1), step(0.9999999, d)); reg('foto-prof', F.dq.material);
        F.dsRT = new T.RenderTarget(1, 1, { depthBuffer: false }); F.dsRT.texture.name = 'ard-foto-prof'; } /* profundidade de um pixel 0..1 em RGBA8 (céu = branco) */
    } catch (err) { F.erro = err; console.warn('[ARD] Modo Foto: desfoque e filtros indisponíveis no Motor 5: ' + err.message); F.pipe = null; F.ch = null; F.dofN = null; }
  }
  /* alvo 16×16 do aquecimento, guardado enquanto o pós vive: segura o pipeline do quad final em RGBA8 (sem o pós, o alvo intermediário
     dele e a conversão de tons); cada foto usa um alvo novo do mesmo formato (mesmo pipeline) e o libera depois da leitura */
  F.capRT0 = new T.RenderTarget(16, 16, { depthBuffer: false }); F.capRT0.texture.name = 'ard-foto-aquece';
  const _v2 = new T.Vector2();
  /* 5.0b.1: sem o pós (Baixa), os efeitos depois da conversão de tons, como o clássico. Lá os efeitos são ShaderMaterial crus somados na
     imagem final do canvas (já em tons e sRGB), e a exposição do painel não passa por eles; aqui a 5.0b somava os efeitos em linear antes
     do ACES (com a inversa da saída e ÷ exposição): exato sobre o preto, mas com o fundo empurrado para o ombro da curva (+EV) a soma
     visível encolhia (a +1,5 EV, sobre fundo claro, 2,7 contra 12,4 do clássico). Agora, no quadro do foto sem pós:
     1) a cena sem os efeitos desenha no alvo intermediário do próprio renderer (_getFrameBufferTarget: o mesmo formato, MSAA e
        profundidade de sempre, então os mesmos pipelines), 2) a conversão de tons (renderOutput: ACES com a exposição e sRGB, a conta
        da saída do r186) vai para um alvo RGBA8 (a foto, ou um alvo do tamanho da tela), 3) essa imagem volta para a cor do alvo
        intermediário (a profundidade da cena fica), 4) só os efeitos desenham por cima, crus (o "sem pós" deles em 0 só nesse passe:
        sem a inversa e sem a exposição) e com o teste de profundidade da cena, 5) o resultado vai sem conversão para a tela ou a foto.
     Os efeitos usam os pipelines de sempre; nascem 4 (conversão, cópia para o alvo, cópia para a tela e para o RGBA8), no preparo da
     primeira entrada. Memória: um alvo RGBA8 do tamanho da tela enquanto o modo está aberto (o alvo intermediário é o de sempre).
     ?m5fotofx=antes volta ao jeito da 5.0b (comparação). */
  const SP = { tons: null, q: null, conv: null, convTex: null, camada: 1 << 30, cena: null, antes: typeof location !== 'undefined' && new URLSearchParams(location.search).get('m5fotofx') === 'antes' };
  const efeitosFx = () => { const R = X.R, Lm = [], Us = []; for (const m of [R && R.FX, R && R.CB]) if (m && m.m5Malhas && m.m5SemPos) { for (const o of m.m5Malhas) if (o) Lm.push(o); Us.push(m.m5SemPos); } return Lm.length ? { L: Lm, U: Us } : null; };
  function spPrepara() {
    if (SP.q) return; const { texture, vec4, renderOutput } = L;
    const mq = (nome, no) => { const m = new T.NodeMaterial(); m.fragmentNode = no; m.depthTest = false; m.depthWrite = false; m.blending = T.NoBlending; reg(nome, m); return new T.QuadMesh(m); };
    SP.tons = new T.RenderTarget(1, 1, { depthBuffer: false }); SP.tons.texture.name = 'ard-foto-tons'; /* RGBA8: a imagem em tons do tamanho da tela */
    SP.convTex = texture(SP.tons.texture); SP.conv = mq('foto-tons', renderOutput(SP.convTex, T.ACESFilmicToneMapping, T.SRGBColorSpace)); /* a conta do quad de saída do r186 (exposição pelo toneMappingExposure) */
    SP.cpTex = texture(SP.tons.texture); SP.q = mq('foto-copia', vec4(SP.cpTex.rgb, 1)); /* cópia crua (para o alvo intermediário, para a tela e para a foto) */
  }
  F.semPos = function (scene, camera, saida) { /* saida: o alvo RGBA8 da foto (null = a tela) */
    const ef = SP.antes || !r._getFrameBufferTarget ? null : efeitosFx(); const o0 = r.getOutputRenderTarget(), rt0 = r.getRenderTarget();
    if (!ef) { try { r.setRenderTarget(null); r.setOutputRenderTarget(saida || o0); r.render(scene, camera); } finally { r.setOutputRenderTarget(o0); r.setRenderTarget(rt0); } return; } /* como na 5.0b */
    spPrepara(); const cam0 = camera.layers.mask, bg = scene.background, ac = r.autoClear, tm = r.toneMapping, cs = r.outputColorSpace;
    const m0 = ef.L.map(o => o.layers.mask), v0 = ef.U.map(u => u.value);
    try {
      r.setRenderTarget(null); r.setOutputRenderTarget(saida || null); const fbt = r._getFrameBufferTarget(); /* o alvo intermediário da tela (ou o da foto) */
      if (!fbt) { r.setOutputRenderTarget(saida || o0); r.render(scene, camera); return; } /* sem conversão de tons não há o que separar */
      r.setOutputRenderTarget(null); const tons = saida || SP.tons; if (!saida && (tons.width !== fbt.width || tons.height !== fbt.height)) tons.setSize(fbt.width, fbt.height);
      for (const o of ef.L) o.layers.mask = SP.camada; /* 1) a cena sem os efeitos (a câmera só vê a camada 0) */
      r.setRenderTarget(fbt); r.render(scene, camera);
      r.autoClear = false;
      SP.convTex.value = fbt.texture; r.setRenderTarget(tons); SP.conv.render(r); /* 2) tons e sRGB */
      SP.cpTex.value = tons.texture; r.setRenderTarget(fbt); SP.q.render(r); /* 3) a imagem em tons volta para o alvo; a profundidade fica */
      if (SP.cena !== scene) { SP.cena = scene; scene.traverse(o => { if (o.isLight) o.layers.enable(30); }); } /* as luzes também na camada 30 (continuam na 0): a lista de luzes do passe dos efeitos fica a de sempre e o r186 não remonta os materiais deles (com o código em outra ordem nasciam módulo e pipeline novos) */
      camera.layers.mask = SP.camada; scene.background = null; for (const u of ef.U) { u.value = 0; u.fixo = true; } /* 5.0b.1 (junção): fixo segura o 0 contra o onRenderUpdate do ARD.m5.u.semPos */ /* 4) só os efeitos, crus; sem a cor de fundo (forçaria limpar) */
      r.render(scene, camera);
      camera.layers.mask = cam0; scene.background = bg;
      SP.cpTex.value = fbt.texture; /* 5) para a foto, ou para a tela sem conversão nenhuma */
      if (saida) { r.setRenderTarget(saida); SP.q.render(r); } else { r.toneMapping = T.NoToneMapping; r.outputColorSpace = T.LinearSRGBColorSpace; r.setRenderTarget(null); SP.q.render(r); }
    } finally {
      for (let i = 0; i < ef.L.length; i++) ef.L[i].layers.mask = m0[i]; for (let i = 0; i < ef.U.length; i++) { ef.U[i].value = v0[i]; ef.U[i].fixo = false; }
      camera.layers.mask = cam0; scene.background = bg; r.autoClear = ac; r.toneMapping = tm; r.outputColorSpace = cs; r.setOutputRenderTarget(o0); r.setRenderTarget(rt0);
    }
  };
  /* desenho de um quadro do foto na tela (ou no alvo atual) */
  F.render = function (scene, camera, comDof) {
    F.dofOn = !!(comDof && F.dofN); F.D.on.value = F.dofOn ? 1 : 0;
    if (F.pipe) F.pipe.render(); else if (F.P) F.P.render(); else F.semPos(scene, camera, null); /* 5.0b.1: sem o pós, os efeitos depois dos tons (era r.render) */
  };
  F.bloom = function (k) { if (F.ch && F.ch.bloomN) F.ch.bloomN.strength.value = F.s0 * k; }; /* brilho do painel: intensidade do bloom da cadeia do foto */
  F.res = function (w, h) { if (w == null) { r.getDrawingBufferSize(_v2); w = _v2.x; h = _v2.y; } F.U.uRes.value.set(w, h); };
  /* desenho no alvo da foto, com o tamanho W×H para os nós do pós (o canvas e o tamanho do renderer não mudam) */
  function noAlvo(W, H, fn) {
    const ct = r.getCanvasTarget ? r.getCanvasTarget() : null; const prev = r.getRenderTarget();
    if (ct) ct.getDrawingBufferSize = function (t) { return t.set(W, H); };
    try { fn(); } finally { if (ct) delete ct.getDrawingBufferSize; r.setRenderTarget(prev); }
  }
  /* a 5.0a.1 redesenha as cascatas de longe em quadros alternados (M5.frame): no quadro da foto todas redesenham, com a lente e a
     proporção da foto (sem isso a de longe podia ficar com o recorte do quadro anterior e faltar sombra na borda da foto) */
  const cascatas = () => { const c = X.csm; if (!c || !c.lights) return; for (const l of c.lights) if (l && l.shadow) l.shadow.needsUpdate = true; };
  /* captura: desenha o quadro inteiro em W×H no alvo da foto e devolve a promessa dos pixels { data, W, H, stride, flip } */
  F.capturar = function (W, H, scene, camera, comDof, k) {
    F.soltar(); F.capRT = new T.RenderTarget(W, H, { depthBuffer: false }); F.capRT.texture.name = 'ard-foto-captura'; /* RGBA8: a foto sai em bytes, sem conversão */
    if (F.pipe) {
      const b0 = F.D.bokeh.value, bl = F.ch.bloomN, bk = bl && bl.getResolutionScale ? bl.getResolutionScale() : 0.5;
      F.D.bokeh.value = b0 * (k || 1); if (bl && bl.setResolutionScale) bl.setResolutionScale(bk / Math.max(1, k || 1)); F.U.uRes.value.set(W, H); /* desfoque e bloom com o mesmo tamanho relativo da tela */
      cascatas(); try { noAlvo(W, H, () => { r.setRenderTarget(F.capRT); F.render(scene, camera, comDof); }); }
      finally { F.D.bokeh.value = b0; if (bl && bl.setResolutionScale) bl.setResolutionScale(bk); F.res(); }
    } else {
      const o = r.getOutputRenderTarget(), prev = r.getRenderTarget();
      cascatas(); if (!F.P) F.semPos(scene, camera, F.capRT); /* 5.0b.1: sem o pós, os efeitos depois dos tons */ else try { r.setRenderTarget(null); r.setOutputRenderTarget(F.capRT); F.P.render(); } finally { r.setOutputRenderTarget(o); r.setRenderTarget(prev); }
    }
    const gpu = !!r.backend.isWebGPUBackend, stride = gpu ? Math.ceil(W * 4 / 256) * 256 : W * 4; /* WebGPU: linhas alinhadas em 256 bytes, de cima para baixo; WebGL2: juntas, de baixo para cima */
    return r.readRenderTargetPixelsAsync(F.capRT, 0, 0, W, H).then(data => ({ data, W, H, stride, flip: !gpu }));
  };
  F.soltar = function () { if (F.capRT) { F.capRT.dispose(); F.capRT = null; } }; /* libera o alvo grande depois da leitura */
  /* profundidade do pixel (u, v com v = 0 no alto) no último quadro do foto: promessa de 0..1 (1 = céu) ou −1 sem o pós */
  F.prof = function (u, v) {
    if (!F.dq || !F.pronto) return Promise.resolve(-1);
    F.uUv.value.set(u, v); const prev = r.getRenderTarget();
    try { r.setRenderTarget(F.dsRT); F.dq.render(r); } finally { r.setRenderTarget(prev); }
    return r.readRenderTargetPixelsAsync(F.dsRT, 0, 0, 1, 1).then(b => (b[0] === 255 && b[1] === 255 && b[2] === 255 ? 1 : b[0] / 255 + b[1] / 65025 + b[2] / 16581375), () => -1);
  };
  /* aquecimento, um passo por quadro: os nós do pós do r186 se remontam nos primeiros quadros (e cada remontagem do bloom e do dof
     muda o código), então a cadeia do foto desenha em ciclos de dois quadros (desfoque ligado e desligado) no alvo RGBA8 de 16×16 da
     captura, com o quad da profundidade, até um ciclo inteiro sem pipeline novo (no mínimo 2); depois dois quadros na tela (o quad
     final na tela) e mais um ciclo pequeno para conferir (se algo nasceu, volta a ciclar; no máximo 40 quadros); depois encolhe os alvos */
  const pronto = () => { F.res(); F.encolher(); F.pronto = true; return true; };
  F.passo = function (scene, camera) {
    if (F.pronto) return true;
    try {
      if (F.pipe) {
        const e = F.etapa++;
        if (e >= 40) return pronto();
        if (F.fase === 'tela') { F.res(); F.render(scene, camera, F.tela === 0); if (++F.tela >= 2) { F.fase = 'confere'; F.ciclos = 0; } return false; }
        if ((e & 1) === 0) { /* começo de um ciclo pequeno */
          if (F.ciclos > 0 && X.pipes === F.p0) { if (F.fase === 'mini' && F.ciclos >= 2) { F.fase = 'tela'; F.tela = 0; F.res(); F.render(scene, camera, true); F.tela = 1; return false; } if (F.fase === 'confere') return pronto(); }
          else if (F.ciclos > 0 && F.fase === 'confere') F.fase = 'mini';
          F.p0 = X.pipes; F.ciclos++;
        }
        noAlvo(16, 16, () => { F.U.uRes.value.set(16, 16); r.setRenderTarget(F.capRT0); F.render(scene, camera, (e & 1) === 0); if (F.dq) { r.setRenderTarget(F.dsRT); F.dq.render(r); } });
        return false;
      }
      const o = r.getOutputRenderTarget(), prev = r.getRenderTarget(); /* sem o pós: a conversão de tons no alvo RGBA8 */
      if (!F.P) { F.semPos(scene, camera, F.capRT0); F.semPos(scene, camera, null); } /* 5.0b.1: sem o pós, o caminho dos efeitos depois dos tons na foto (RGBA8) e na tela: os 4 pipelines dele nascem aqui */ else try { r.setRenderTarget(null); r.setOutputRenderTarget(F.capRT0); F.P.render(); } finally { r.setOutputRenderTarget(o); r.setRenderTarget(prev); }
    } catch (err) { F.erro = err; console.warn('[ARD] Modo Foto: aquecimento do Motor 5 falhou: ' + err.message); }
    return pronto();
  };
  /* alvos da cadeia do foto de volta a quase nada fora do Modo Foto: o próximo quadro do foto redimensiona (nenhum pipeline novo) */
  F.encolher = function () {
    const ch = F.ch; if (!ch) return; const sz = (n, w, h) => { try { if (n && n.setSize) n.setSize(w, h); } catch (e) {} };
    sz(ch.sp, 2, 2); sz(ch.aoN, 2, 2); sz(ch.hdr, 2, 2); sz(ch.bloomN, 64, 64); sz(ch.aa, 2, 2); if (ch.aa && ch.aa.textureNode) sz(ch.aa.textureNode, 2, 2);
    if (F.dofN) { sz(F.dofN, 2, 2); sz(F.dofN._CoCBlurNode, 2, 2); }
    if (SP.tons) SP.tons.setSize(1, 1); /* 5.0b.1: o alvo dos tons sem o pós volta a 1×1 fora do modo (o próximo quadro do foto redimensiona) */
  };
  F.descartar = function () {
    try { if (F.pipe) F.pipe.dispose(); const ch = F.ch; if (ch) { ch.sp.dispose(); if (ch.aoN) ch.aoN.dispose(); if (ch.bloomN) ch.bloomN.dispose(); if (ch.aa && ch.aa.dispose) ch.aa.dispose(); } if (F.dofN) F.dofN.dispose(); if (F.dq) F.dq.material.dispose(); if (F.dsRT) F.dsRT.dispose(); F.soltar(); F.capRT0.dispose(); if (SP.tons) { SP.tons.dispose(); SP.q.material.dispose(); SP.conv.material.dispose(); SP.tons = null; SP.q = null; } /* 5.0b.1 */ } catch (e) {}
    F.pipe = null; F.ch = null; F.pronto = false;
  };
  return F;
}
/* o objeto do foto do pós atual (P: R.ppFx().composer; null sem o pós); um novo (sem aquecer) se o pós mudou */
FOTO.obter = function (X, P) {
  if (!X) return null; P = P || null;
  if (X.foto && X.foto.P === P) return X.foto;
  if (X.foto) X.foto.descartar();
  X.foto = criar(X, P); return X.foto;
};
/* aquecimento na carga, só com ?m5foto=carga (o render3d chama no fim do aquecimento do Motor 5): F.passo quadro a quadro, cada passo no seu
   requestAnimationFrame; X.fotoMs e X.fotoPipes guardam o tempo e os pipelines do aquecimento (medida). Sem o parâmetro, o mesmo F.passo
   roda na primeira entrada do Modo Foto (src/photo3d.js, renderM5) */
FOTO.aquecer = function (X, R, scene, camera) {
  const fx = R && R.ppFx ? R.ppFx() : {}, P = R && R.pp ? fx.composer || null : null; const t0 = performance.now(), p0 = X.pipes;
  return FOTO.dof().then(() => new Promise(res => {
    const F = FOTO.obter(X, P); const raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : f => setTimeout(f, 16);
    const um = () => { let fim = true; try { fim = F.passo(scene, camera); } catch (err) { console.warn('[ARD] Modo Foto (aquecimento): ' + err.message); fim = true; } if (!fim) raf(um); else { X.fotoMs = Math.round(performance.now() - t0); X.fotoPipes = X.pipes - p0; res(F); } };
    raf(um);
  })).catch(err => { console.warn('[ARD] Modo Foto (aquecimento): ' + (err && err.message)); return null; });
};
/* sombras em cascata com a câmera do foto: alcance pela distância (csmFrame) e cascatas refeitas quando a lente muda */
FOTO.csm = function (X, camera, dist) {
  if (!X || !X.csm) return; if (M5.csmFrame) M5.csmFrame(X, dist);
  const c = X.csm, k = X.fotoLente || (X.fotoLente = { fov: 0, asp: 0, near: 0 });
  if (Math.abs(camera.fov - k.fov) > 0.05 || Math.abs(camera.aspect - k.asp) > 0.0005 || Math.abs(camera.near - k.near) > 0.01) { k.fov = camera.fov; k.asp = camera.aspect; k.near = camera.near; if (c.camera) c.updateFrustums(); }
};
FOTO.csmSolta = function (X) { if (X && X.fotoLente) { X.fotoLente.fov = 0; X.fotoLente.asp = 0; X.fotoLente.near = 0; } };
})(globalThis.ARD = globalThis.ARD || {});
