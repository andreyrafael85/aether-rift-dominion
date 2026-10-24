/* Aether Rift: Dominion — Motor 5 (5.0a, fase 1): materiais em TSL (valem no WebGPU e na reserva WebGL2 do WebGPURenderer).
   modelo e emissivo (unidades e construções), chão básico, adereços, estradas, céu, halo dos planetas, feixes da Fenda,
   bandeira e lagos simples. O detalhe fino (superfície por peça, animação por peça, vento, camadas do chão) é da fase 2:
   cada material deixa o gancho em ARD.m5.ganchos. Nada aqui toca a simulação. */
(function (ARD) {
'use strict';
const M5 = ARD.m5 = ARD.m5 || {};
const T = () => window.THREE_M5, L = () => window.TSL;
const RIM_CONST = typeof location !== 'undefined' && /[?&]m5rim=const/.test(location.search); /* 5.0a.1: medida — rim em constantes (um WGSL por Raça, como na 5.0a) */
const QS = new URLSearchParams(typeof location !== 'undefined' ? location.search : ''); const CORTE = +(QS.get('m5corte') || -6), PAR0 = +(QS.get('m5par0') || 50), PAR1 = +(QS.get('m5par1') || 150); /* 5.0a.1: Cinturão — corte do chão 6 além da borda (o paredão desce ~90, como o do clássico até −96, e o vazio entre as plataformas fica aberto) e onde o paredão escurece (50 a 150 de profundidade); ?m5corte, ?m5par0, ?m5par1 para ajuste */
/* atributo da geometria com valor padrão quando a geometria não tem (sem aviso do three e sem shader quebrado) */
M5.attr = function (name, def) { const { Fn, attribute } = L(); return Fn(b => (b.geometry && b.geometry.hasAttribute(name) ? attribute(name) : def))(); };
/* ruído de valor barato (o mesmo hash dos shaders GLSL de hoje) */
M5.hash2 = p => { const { fract, sin, dot, vec2 } = L(); return fract(sin(dot(p, vec2(127.1, 311.7))).mul(43758.5453)); };
M5.vnoise2 = p => { const { floor, fract, mix, vec2 } = L(); const i = floor(p), f = fract(p), u = f.mul(f).mul(f.mul(-2).add(3)), h = M5.hash2; return mix(mix(h(i), h(i.add(vec2(1, 0))), u.x), mix(h(i.add(vec2(0, 1))), h(i.add(vec2(1, 1))), u.x), u.y); };
/* 5.0a.1: instâncias por atributo (M5.Inst, src/m5/core.js): matriz em iM0..iM3 e cor em iC na geometria. Num InstancedMesh de verdade o three
   já aplicou matriz e cor (vInstanceColor) e os nós abaixo não fazem nada. A matriz vai no positionNode (a sombra copia o positionNode do
   material) e a normal no setupPosition do material; base = posição local da fase 2 (gancho de animação), antes da instância */
M5.instMat = function (m, base) { const { Fn, attribute, mat4, vec4, positionLocal, normalLocal, transformNormal } = L();
  const iM = mat4(attribute('iM0', 'vec4'), attribute('iM1', 'vec4'), attribute('iM2', 'vec4'), attribute('iM3', 'vec4'));
  m.positionNode = Fn(b => { const p = base || positionLocal; return b.object && b.object.isM5Inst ? iM.mul(vec4(p, 1)).xyz : p; })();
  const sp = m.setupPosition; m.setupPosition = function (b) { if (b.object && b.object.isM5Inst && b.hasGeometryAttribute('normal')) normalLocal.assign(transformNormal(normalLocal, iM)); return sp.call(this, b); };
  m.userData.m5Inst = true; return m; }; /* a fábrica M5.instancia só cria M5.Inst para material marcado */
M5.instCor = function (cor) { const { Fn, attribute } = L(); return Fn(b => (b.object && b.object.isM5Inst ? cor.mul(attribute('iC', 'vec3')) : cor))(); };

/* ---------- unidades e construções: cor, rugosidade e metal por vértice (color, rm), cor do time e tinta por instância, rim por Raça, clarões ----------
   o: as mesmas opções do ARD.meshes.material ({ env, key, rim: { col, pow, amt }, noAnim, onShader }); onShader (GLSL) é ignorado aqui */
M5.modelo = function (o) {
  o = o || {}; const { uniform, clamp, float, pow, abs, dot, normalize, normalView, positionViewDirection, diffuseColor } = L(); const Tm = T();
  const m = new Tm.MeshStandardNodeMaterial({ vertexColors: true, roughness: 1, metalness: 1 }); m.envMapIntensity = o.env == null ? 1 : o.env;
  const rm = M5.attr('rm', L().vec2(0.8, 0.1));
  m.roughnessNode = clamp(rm.x, 0.04, 1.0); m.metalnessNode = rm.y;
  let em = diffuseColor.rgb.mul(M5.sample.clarao()).mul(0.8); /* clarões: a luz do mapa de cima soma ao albedo (como o FLASH_ADD de hoje) */
  /* 5.0a.1: rim por Raça em uniforms (cor, expoente, força; o neutro tem força 0): o material neutro e os das Raças geram o mesmo WGSL e dividem módulo e pipeline */
  const ri = o.rim || { col: [0, 0, 0], pow: 2, amt: 0 }; const K = RIM_CONST ? x => L().float(x) : x => uniform(x); const rU = m.userData.rim = { col: RIM_CONST ? L().vec3(ri.col[0], ri.col[1], ri.col[2]) : uniform(new Tm.Color(ri.col[0], ri.col[1], ri.col[2])), pow: K(ri.pow), amt: K(ri.amt) }; /* ?m5rim=const: constantes (medida) */
  { const rim = pow(clamp(float(1).sub(abs(dot(normalize(normalView), positionViewDirection))), 0, 1), rU.pow); em = em.add(rU.col.mul(rim.mul(rU.amt))); }
  const G = M5.ganchos && M5.ganchos.modelo; const ctx = { m, o, em };
  if (G && G.superficie) G.superficie(ctx); /* fase 2: detalhe de superfície (colorNode/normalNode/roughnessNode) */
  if (G && G.emissivo) em = G.emissivo(ctx) || em;
  let pAnim = null; if (G && G.posicao && !o.noAnim) pAnim = G.posicao(ctx) || null; /* fase 2: animação por peça, na posição local do modelo (a sombra usa o mesmo positionNode) */
  M5.instMat(m, pAnim); m.colorNode = M5.instCor(L().materialColor); /* 5.0a.1: M5.Inst */
  m.emissiveNode = em;
  return M5.registrar('modelo-' + (o.key || 'base'), m);
};
/* 5.0a: o nome do plano para o material dos modelos; chama o M5.modelo da hora (a fase 2 pode trocá-lo) */
M5.modelMaterial = function (o) { return M5.modelo(o); };
/* parte emissiva dos modelos (janelas, luzes, cristais): cor por vértice × tinta por instância × material.color (o render3d acende à noite) */
M5.emissivo = function (o) {
  o = o || {}; const m = new (T().MeshBasicNodeMaterial)({ vertexColors: true });
  const G = M5.ganchos && M5.ganchos.modelo; let pAnim = null; if (G && G.posicao && !o.noAnim) pAnim = G.posicao({ m, o, emissivo: true }) || null;
  M5.instMat(m, pAnim); m.colorNode = M5.instCor(L().materialColor); /* 5.0a.1: M5.Inst */
  return M5.registrar('emissivo-' + (o.key || 'base'), m);
};

/* ---------- 5.0a.1: peças do chão que valem para qualquer material de chão do Motor 5 (o da fase 2 também deve chamar) ----------
   luzFendaChao(normal no mundo, posição no mundo) → nó vec3 de luz para multiplicar pelo albedo e somar ao emissivo: a PointLight da Fenda do
   clássico (M5.u.fendaLuz: posição e alcance; M5.u.fendaCor: cor × intensidade), difusa de Lambert com 1/d² e o corte suave do three. A luz
   não fica na cena (cada luz pontual entraria em todo shader iluminado).
   vazioMascara(posição no mundo) → nó bool do maskNode do Cinturão: some só onde o mapa do vazio (M5.tex.vazio) diz, nunca pela altura. */
M5.luzFendaChao = function (wn, pw) { const { float, max, dot, length, clamp, pow } = L(); const FL = M5.u.fendaLuz, lv = FL.xyz.sub(pw), ld = length(lv); const corte = clamp(float(1).sub(pow(ld.div(FL.w), 4)), 0, 1);
  return M5.u.fendaCor.mul(float(1 / Math.PI).mul(max(dot(wn, lv.div(max(ld, 0.001))), 0)).mul(corte.mul(corte)).div(max(ld.mul(ld), 0.01))); };
M5.vazioMascara = function (pw) { return M5.tex.vazio.sample(M5.mapUV(pw)).r.sub(0.5).mul(128).greaterThanEqual(CORTE); };

/* ---------- uniforms do chão no formato do terrU do render3d (cada um com .value) ---------- */
M5.terrUniforms = function (tx) {
  const { texture } = L(); const U = M5.u, X = M5.tex;
  if (tx.fog) X.nevoa.value = tx.fog; if (tx.terr) X.territorio.value = tx.terr; if (tx.scar) X.cicatrizes.value = tx.scar; if (tx.cloud) X.nuvem.value = tx.cloud; if (tx.micro) X.micro.value = tx.micro;
  return { uFlash: X.clarao, uFlashR: U.claraoRet, scarMap: X.cicatrizes, uTexA: texture(tx.cloud), uTexB: texture(tx.cloud), fogMap: X.nevoa, terrMap: X.territorio, cloudMap: X.nuvem, microMap: X.micro, uNear: U.perto, uCloudT: U.tempo, uCloudK: U.nuvemK, uTime: U.tempo, uRift: U.fenda, worldSize: U.mundo };
};

/* ---------- chão (básico da fase 1): camadas por bioma (atributo bio), rocha nas encostas, cavidade (aoc), variação pelo ruído de nuvem,
   brasa nas fendas do basalto e luz do abismo perto da Fenda, cicatrizes, microdetalhe de perto, território, névoa de guerra, clarões.
   o: { fora (cordilheira além do mapa), leve, vazio (Cinturão: corta abaixo de −90) } */
M5.chao = function (U, o) {
  o = o || {}; const { float, vec2, vec3, mix, smoothstep, clamp, max, length, sin, positionWorld, normalWorld, pow, step, dot } = L();
  const m = new (T().MeshStandardNodeMaterial)({ roughness: 0.9, metalness: 0.02 }); m.envMapIntensity = 0.22;
  const pw = positionWorld, bio = M5.attr('bio', L().vec4(0, 1, 0, 0)), aoc = M5.attr('aoc', vec2(1, 0));
  const Bw = bio.div(max(bio.x.add(bio.y).add(bio.z).add(bio.w), 0.0001));
  const gp = vec2(pw.x, pw.z.negate()); const wn = normalWorld; const slope = float(1).sub(clamp(wn.y, 0, 1)); const cav = aoc.y;
  const nz = U.cloudMap; const macro = nz.sample(gp.div(1900).add(0.11)).r, mid = nz.sample(gp.div(310).add(0.53)).r, fine = nz.sample(gp.div(94)).r, soft = nz.sample(gp.div(150).add(0.37)).r;
  const rk = smoothstep(0.15, 0.38, slope.add(max(cav.negate(), 0).mul(0.16)).add(macro.sub(0.5).mul(0.12)));
  const band = pw.y.div(3.4).add(macro.sub(0.5).mul(1.4)); const bt = M5.hash2(vec2(band.floor(), 78.233)); /* estratos das encostas */
  /* gelo: neve, gelo liso nas baixadas, rocha azulada */
  const snow = mix(vec3(0.42, 0.5, 0.63), vec3(0.74, 0.79, 0.86), fine.mul(0.5).add(soft.mul(0.35))).mul(mix(vec3(1), vec3(0.72, 0.84, 1.08), clamp(cav.mul(1.6).add(float(1).sub(aoc.x).mul(2)), 0, 1)));
  const ice = mix(vec3(0.38, 0.52, 0.66), vec3(0.6, 0.73, 0.84), soft); const rockG = mix(vec3(0.2, 0.23, 0.28), vec3(0.36, 0.4, 0.46), bt);
  const gelo = mix(mix(snow, ice, smoothstep(0.12, 0.5, cav.add(mid.sub(0.5).mul(0.5))).mul(0.6)), rockG, rk);
  /* rocha: areia nas baixadas, cascalho, paredões estratificados */
  const sand = mix(vec3(0.5, 0.36, 0.22), vec3(0.78, 0.62, 0.42), fine.mul(0.55).add(soft.mul(0.25)).add(0.1)).mul(macro.mul(0.2).add(0.9));
  const grav = mix(vec3(0.36, 0.27, 0.19), vec3(0.64, 0.52, 0.39), mid); const rockR = mix(vec3(0.42, 0.26, 0.17), vec3(0.66, 0.5, 0.36), bt);
  const rocha = mix(mix(sand, grav, smoothstep(0.55, 0.75, mid).mul(0.6)), rockR, rk);
  /* tundra: musgo, terra nas baixadas, rocha */
  const moss = mix(vec3(0.095, 0.125, 0.06), vec3(0.205, 0.235, 0.115), fine); const dirt = mix(vec3(0.22, 0.17, 0.12), vec3(0.36, 0.29, 0.21), soft); const rockT = mix(vec3(0.26, 0.25, 0.23), vec3(0.44, 0.42, 0.38), bt);
  const tundra = mix(mix(moss, dirt, smoothstep(0.0, 0.4, cav).mul(0.7)), rockT, rk);
  /* basalto: cinza e rocha negra */
  const ash = mix(vec3(0.028, 0.026, 0.03), vec3(0.075, 0.068, 0.074), fine); const rockB = mix(vec3(0.022, 0.02, 0.026), vec3(0.07, 0.06, 0.068), bt);
  const basalto = mix(ash, rockB, rk);
  let alb = gelo.mul(Bw.x).add(rocha.mul(Bw.y)).add(tundra.mul(Bw.z)).add(basalto.mul(Bw.w));
  let rough = Bw.x.mul(mix(0.55, 0.86, rk)).add(Bw.y.mul(0.9)).add(Bw.z.mul(0.93)).add(Bw.w.mul(mix(0.96, 0.8, rk)));
  let tEmis = vec3(0);
  if (!o.fora) {
    const rd = length(gp.sub(U.uRift)); const rift = float(1).sub(smoothstep(260, 640, rd)); const ck = smoothstep(0.62, 0.92, fine).mul(smoothstep(0.52, 0.68, mid)).mul(rift).mul(float(1).sub(smoothstep(0.1, 0.28, slope)));
    const pulse = sin(U.uTime.mul(1.3).add(gp.x.mul(0.013)).add(gp.y.mul(0.017))).mul(0.35).add(0.65);
    tEmis = tEmis.add(vec3(1.15, 0.28, 0.7).mul(ck.mul(pulse).mul(1.15).mul(Bw.w))); alb = alb.mul(float(1).sub(Bw.w.mul(ck).mul(0.45)));
    const deep = float(1).sub(smoothstep(-225, -80, pw.y)).mul(float(1).sub(smoothstep(230, 300, rd))); /* 5.0a.1: bordas do smoothstep em ordem */ const fl = sin(U.uTime.mul(0.9).add(pw.y.mul(0.05)).add(gp.x.mul(0.02))).mul(0.4).add(0.6); const vein = smoothstep(0.6, 0.9, mid).add(smoothstep(0.6, 0.9, fine).mul(0.3));
    tEmis = tEmis.add(vec3(1.2, 0.3, 0.75).mul(pow(deep, 3)).mul(vein.mul(0.9).add(0.12)).mul(fl).mul(1.6)); alb = alb.mul(float(1).sub(deep.mul(0.6)));
    const sc = M5.sample.cicatrizes(); alb = alb.mul(float(1).sub(sc.r.mul(Bw.y.mul(0.16).add(Bw.z.mul(0.12)).add(0.34))));
    const bu = smoothstep(0.0, 0.85, sc.g); alb = mix(alb, vec3(0.06, 0.05, 0.042).mul(soft.mul(0.5).add(0.75)), clamp(bu.mul(0.85), 0, 0.85)); rough = mix(rough, 0.6, bu.mul(0.4));
    tEmis = tEmis.add(vec3(1.4, 0.45, 0.12).mul(smoothstep(0.35, 1.0, sc.a)).mul(sin(U.uTime.mul(9).add(gp.x.mul(0.7))).mul(0.35).add(0.65)));
  }
  alb = alb.mul(macro.mul(0.28).add(0.86));
  if (o.fora) { const sl = smoothstep(250, 340, pw.y.add(macro.sub(0.5).mul(90))).mul(float(1).sub(smoothstep(0.35, 0.6, slope))); alb = mix(alb, vec3(0.78, 0.82, 0.88).mul(soft.mul(0.1).add(0.9)), sl); rough = mix(rough, 0.7, sl); }
  alb = alb.mul(mix(0.72, 1.0, aoc.x));
  if (o.vazio) { const paredao = smoothstep(PAR0, PAR1, pw.y.negate()); alb = alb.mul(float(1).sub(paredao)); rough = mix(rough, 0.85, paredao); tEmis = tEmis.add(vec3(0.006, 0.009, 0.022).mul(float(1).sub(M5.u.noite.mul(0.4))).mul(paredao)); } /* Cinturão sem o space3d: o paredão de rocha vai para a poeira escura do espaço perto do fundo (a mesma do clássico), sem luz (5.0a.1: o corte agora é no vazio, não na altura) */
  const CG = M5.ganchos && M5.ganchos.chao; if (CG && CG.cor) alb = CG.cor({ m, o, alb, Bw, gp }) || alb; /* fase 2: camadas e triplanar */
  if (!o.fora) {
    const wuv = vec2(gp.x.div(U.worldSize), gp.y.div(U.worldSize));
    if (!o.leve) { const m1 = U.microMap.sample(wuv.mul(260)).rgb, m2 = U.microMap.sample(wuv.mul(84).add(0.31)).rgb; const pe = max(m1.r.mul(0.6), m2.r);
      alb = alb.mul(mix(float(1), mix(m1.g, m2.g, step(0.25, m2.r)).mul(0.28).add(0.86).mul(float(1).sub(max(m1.b, m2.b.mul(0.8)).mul(0.35))).mul(pe.mul(0.1).add(1)), U.uNear.mul(0.7))); }
    const tc = M5.sample.territorio(); alb = mix(alb, tc.rgb, tc.a.mul(0.14));
    const fv = M5.sample.nevoa(); alb = alb.mul(mix(0.06, 1.0, fv)); tEmis = tEmis.mul(fv);
  }
  alb = alb.mul(float(1).sub(U.uCloudK.mul(0.2).mul(float(1).sub(M5.sample.nuvem()))));
  m.colorNode = alb; m.roughnessNode = rough; m.aoNode = aoc.x;
  let luz = M5.sample.clarao().mul(max(wn.y, 0).mul(0.65).add(0.35)); /* clarões no chão (encosta recebe menos) */
  if (!o.fora) luz = luz.add(M5.luzFendaChao(wn, pw)); /* 5.0a.1: a luz da Fenda (era uma PointLight) */
  m.emissiveNode = tEmis.add(alb.mul(luz));
  if (o.vazio) m.maskNode = M5.vazioMascara(pw); /* 5.0a.1: Cinturão — o chão some só onde o mapa do vazio diz (antes era abaixo de −90 de altura) */
  m.userData.env = 0.22;
  return M5.registrar('chao' + (o.fora ? '-fora' : '') + (o.leve ? '-leve' : '') + (o.vazio ? '-vazio' : ''), m);
};

/* ---------- adereços do dress3d: cor e rm por vértice, brilho (aGlow), névoa de guerra; vento fica para a fase 2 (gancho adereco.posicao) ---------- */
M5.adereco = function (o) {
  o = o || {}; const { float, mix, vertexColor } = L(); const Tm = T();
  const m = new Tm.MeshStandardNodeMaterial({ vertexColors: true, roughness: 1, metalness: 0, side: o.leaf ? Tm.DoubleSide : Tm.FrontSide });
  const rm = M5.attr('rm', L().vec2(0.9, 0)), glow = M5.attr('aGlow', float(0)); const fv = M5.sample.nevoa();
  m.colorNode = M5.instCor(L().vec3(mix(0.06, 1.0, fv).mul(float(1).sub(glow)))); m.roughnessNode = rm.x; m.metalnessNode = rm.y; /* 5.0a.1: cor de instância do M5.Inst */
  m.emissiveNode = vertexColor().rgb.mul(glow).mul(fv.mul(fv));
  const G = M5.ganchos && M5.ganchos.adereco; let pVento = null; if (G && G.posicao) pVento = G.posicao({ m, o }) || null; M5.instMat(m, pVento); /* 5.0a.1: M5.Inst (o vento da fase 2 entra na posição local) */
  return M5.registrar('adereco-' + (o.leaf ? 'folha' : 'solido'), m, { env: 1 });
};
/* estradas de terra (dress3d): faixa com borda irregular, sulcos e névoa de guerra */
M5.estrada = function () {
  const { float, vec3, vec4, mix, smoothstep, abs, uv, positionWorld } = L(); const Tm = T();
  const m = new Tm.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }); m.fog = false;
  const side = abs(uv().x.sub(0.5)).mul(2); const wuv = L().vec2(positionWorld.x.div(M5.u.mundo), positionWorld.z.negate().div(M5.u.mundo)); const nz = M5.vnoise2(wuv.mul(900));
  const edge = float(1).sub(smoothstep(nz.mul(0.25).add(0.55), 1.0, side)); const rut = float(1).sub(smoothstep(0.0, 0.08, abs(side.sub(0.45)))).mul(0.18); /* 5.0a.1: bordas do smoothstep em ordem (invertidas são erro no WGSL com constantes) */
  const col = mix(vec3(0.33, 0.29, 0.24), vec3(0.42, 0.37, 0.3), nz).mul(float(1).sub(rut)).mul(mix(0.06, 1.0, M5.sample.nevoa()));
  m.colorNode = col; m.opacityNode = edge.mul(0.62); M5.instMat(m); /* 5.0a.1: M5.Inst */
  return M5.registrar('estrada', m);
};

/* ---------- céu: gradiente de hoje (horizonte, topo, chão), nuvens que derivam, sol, estrelas à noite; modo espaço no Cinturão ----------
   devolve a malha com userData.mat.uniforms no formato do céu GLSL (uTop, uHor, uBot, uSunDir, uSunCol, uNight, uTime, uSpace) */
M5.ceu = function (o) {
  o = o || {}; const Tm = T(); const { uniform, float, vec2, vec3, mix, pow, clamp, smoothstep, max, dot, normalize, positionLocal, floor, step, sin } = L();
  const u = { uTop: uniform(new Tm.Color(0x3a5f8f)), uHor: uniform(new Tm.Color(0x9fb0c4)), uBot: uniform(new Tm.Color(0x30343a)), uSunDir: uniform(new Tm.Vector3(-0.4, 0.7, 0.5).normalize()), uSunCol: uniform(new Tm.Color(1, 0.9, 0.75)), uNight: uniform(0), uTime: uniform(0), uSpace: uniform(o.espaco ? 1 : 0) };
  const m = new Tm.MeshBasicNodeMaterial({ side: Tm.BackSide, depthWrite: false }); m.fog = false;
  const d = normalize(positionLocal), y = d.y;
  if (o.espaco && M5.espaco && M5.espaco.cor) { /* 5.0a.1: Cinturão — o céu de espaço do clássico (nebulosa assada, estrelas, faixa da galáxia, sol); só este mapa paga esse shader */
    m.colorNode = M5.espaco.cor(d, u, o.nebulosa || null); m.uniforms = u;
    const mesh = new Tm.Mesh(new Tm.SphereGeometry(4800, 32, 20), m); mesh.frustumCulled = false; mesh.renderOrder = -1000; mesh.userData.mat = m; M5.registrar('ceu-espaco', m); return mesh; }
  const grad = mix(mix(u.uHor, u.uBot, clamp(y.negate().mul(4), 0, 1)), mix(u.uHor, u.uTop, pow(clamp(y, 0, 1), 0.5)), step(0, y)); /* sem select (ramos do ConditionalNode) */
  let cp = d.xz.div(max(y, 0.0).add(0.16)).mul(1.4).add(vec2(u.uTime.mul(0.0035), u.uTime.mul(0.0018))); let cn = float(0), ca = 0.55;
  for (let i = 0; i < 4; i++) { cn = cn.add(M5.vnoise2(cp).mul(ca)); cp = cp.mul(2.07).add(vec2(1.7, 9.2)); ca *= 0.5; }
  const cv = smoothstep(0.5, 0.82, cn).mul(smoothstep(0.0, 0.22, y)).mul(float(1).sub(u.uNight.mul(0.55)));
  const sl = pow(max(dot(d, u.uSunDir), 0), 6); const cc = mix(u.uHor.mul(1.08).add(0.06), u.uSunCol.mul(0.9).add(u.uHor.mul(0.4)), sl.mul(0.6)).mul(float(1).sub(u.uNight.mul(0.82)));
  let col = mix(grad, cc, cv.mul(0.78));
  const sd = max(dot(d, u.uSunDir), 0); col = col.add(u.uSunCol.mul(pow(sd, 600).mul(4).add(pow(sd, 18).mul(0.18))).mul(float(1).sub(u.uNight.mul(0.9))));
  const star = (sc, dens) => { const q = d.mul(sc), c = floor(q); const h = L().fract(sin(dot(c, vec3(127.1, 311.7, 74.7))).mul(43758.5453)); return [step(dens, h), h]; };
  const [st, sh] = star(420, 0.9972); const tw = sin(u.uTime.mul(1.7).add(sh.mul(60))).mul(0.35).add(0.65);
  col = col.add(vec3(0.9, 0.95, 1.0).mul(st.mul(smoothstep(0.02, 0.2, y)).mul(tw).mul(u.uNight.mul(1.35).add(0.25))));
  m.colorNode = col; /* 5.0a.1: o modo espaço saiu daqui (o Cinturão usa M5.ceu({ espaco })): os outros mapas não pagam o espaço no shader do céu */
  m.uniforms = u; /* formato do céu GLSL */
  const mesh = new Tm.Mesh(new Tm.SphereGeometry(4800, 32, 20), m); mesh.frustumCulled = false; mesh.renderOrder = -1000; mesh.userData.mat = m;
  M5.registrar('ceu', m); return mesh;
};

/* ---------- halo dos planetas (troca a atmosfera GLSL do world3d por Fresnel em TSL), dentro de um grupo pronto ---------- */
M5.atmo = function (col, pw, it) {
  const Tm = T(); const { uniform, float, pow, max, abs, dot, normalize, normalView, positionViewDirection } = L();
  const m = new Tm.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: Tm.AdditiveBlending, side: Tm.BackSide }); m.fog = false;
  const c = uniform(new Tm.Color(col)); const f = pow(max(float(1).sub(abs(dot(normalize(normalView), positionViewDirection))), 0), pw);
  m.colorNode = c.mul(f).mul(it); m.opacityNode = f.mul(it); return M5.registrar('atmo', m);
};
M5.fixHalos = function (group) { if (!group) return; group.traverse(o => { const mm = o.material; if (!mm || !mm.isShaderMaterial) return; const U = mm.uniforms || {}; const col = U.col ? U.col.value : 0xffffff, pw = U.pw ? U.pw.value : 2, it = U.it ? U.it.value : 1; mm.dispose(); o.material = M5.atmo(col, pw, it); }); };

/* ---------- feixes de luz subindo da Fenda (era ShaderMaterial): faixas que sobem devagar, mais fortes à noite ---------- */
M5.feixeFenda = function () {
  const Tm = T(); const { uniform, float, vec3, sin, smoothstep, uv, fract, floor, mix } = L();
  const u = { uTime: uniform(0), uNight: uniform(0) };
  const h = x => fract(sin(x.mul(127.1)).mul(43758.5453)); const n = x => { const i = floor(x), f = fract(x), s = f.mul(f).mul(f.mul(-2).add(3)); return mix(h(i), h(i.add(1)), s); };
  const vu = uv(); const streak = n(vu.x.mul(40)).mul(0.6).add(n(vu.x.mul(13).add(u.uTime.mul(0.2))).mul(0.4)); const rise = sin(vu.y.mul(9).sub(u.uTime.mul(1.2)).add(vu.x.mul(20))).mul(0.4).add(0.6);
  const fade = smoothstep(0.0, 0.12, vu.y).mul(float(1).sub(smoothstep(0.35, 1.0, vu.y))); const a = streak.mul(rise).mul(fade).mul(u.uNight.mul(0.08).add(0.05));
  const m = new Tm.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: Tm.AdditiveBlending, side: Tm.DoubleSide }); m.fog = false;
  m.colorNode = vec3(1.0, 0.45, 0.9).mul(a); m.opacityNode = a; m.uniforms = u; return M5.registrar('feixe-fenda', m);
};

/* ---------- lagos (substituto simples do lakes3d na fase 1): disco na cota do lago com a borda orgânica do mapa ----------
   gelo: azul fundo com geada branca na borda e o céu refletido pelo PMREM; plasma: brasa que ondula com crosta escura na borda */
M5.lagosSimples = function (scene, T3, S) {
  const Tm = T(); const { float, vec3, sin, mix, positionWorld, smoothstep, attribute } = L(); const out = [];
  const lakes = (T3 && T3.lakes) || []; if (!lakes.length) return out;
  const borda = attribute('aBorda', 'float'), fv = M5.sample.nevoa(), esc = mix(0.06, 1, fv);
  const plasma = new Tm.MeshStandardNodeMaterial({ roughness: 0.45, metalness: 0 }); { const w = sin(M5.u.tempo.mul(1.1).add(positionWorld.x.mul(0.04)).add(positionWorld.z.mul(0.03))).mul(0.25).add(0.75); const crosta = smoothstep(0.78, 1.0, borda);
    plasma.colorNode = mix(vec3(0.12, 0.03, 0.02), vec3(0.05, 0.04, 0.04), crosta).mul(esc); plasma.emissiveNode = vec3(1.7, 0.45, 0.12).mul(w).mul(float(1).sub(crosta.mul(0.85))).mul(fv); }
  const ice = new Tm.MeshStandardNodeMaterial({ roughness: 0.16, metalness: 0 }); { const geada = smoothstep(0.8, 1.0, borda); ice.colorNode = mix(vec3(0.05, 0.19, 0.34), vec3(0.8, 0.86, 0.92), geada).mul(esc); ice.roughnessNode = mix(float(0.12), float(0.7), geada); }
  M5.registrar('lago-plasma', plasma, { env: 0.6 }); M5.registrar('lago-gelo', ice, { env: 1.0 });
  for (const k of lakes) { const N = 72, pos = [0, 0, 0], bd = [0], idx = []; for (let a = 0; a <= N; a++) { const ang = a / N * Math.PI * 2; const rr = (S.edgeR ? S.edgeR(k.r, ang, k.seed) : k.r) * 1.04; pos.push(Math.cos(ang) * rr, 0, -Math.sin(ang) * rr); bd.push(1); if (a) idx.push(0, a, a + 1); }
    const g = new Tm.BufferGeometry(); g.setAttribute('position', new Tm.Float32BufferAttribute(pos, 3)); g.setAttribute('aBorda', new Tm.Float32BufferAttribute(bd, 1)); g.setIndex(idx); const nrm = new Float32Array(pos.length); for (let i = 1; i < nrm.length; i += 3) nrm[i] = 1; g.setAttribute('normal', new Tm.BufferAttribute(nrm, 3)); g.computeBoundingSphere();
    const mesh = new Tm.Mesh(g, k.kind === 'plasma' ? plasma : ice); mesh.position.set(k.x, k.level + (k.kind === 'plasma' ? 0.6 : 0.2), -k.y); mesh.receiveShadow = true; mesh.renderOrder = 1; scene.add(mesh); out.push(mesh); }
  return out;
};
})(globalThis.ARD = globalThis.ARD || {});
