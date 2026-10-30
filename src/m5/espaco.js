/* Aether Rift: Dominion — Motor 5 (5.0b, fase 2): o espaço do Cinturão em TSL. O src/space3d.js escolhe este caminho no Motor 5 e continua dono
   da geometria (raízes, quilhas, estalactites, cristais, asteroides, redemoinho e feixes), da cena e do alvo da camada do espaço, do mapa da borda
   e dos efeitos; aqui ficam os materiais:
   - rocha (raízes e paredões no contorno exato, cristais, asteroides): o MeshStandard facetado com os remendos de 4.3h em TSL — estratos e veios
     nas raízes, grão, tinta fria nos asteroides, cristal que pulsa, luz da Fenda vinda do redemoinho e o esmaecer para a poeira escura pela
     profundidade e pela distância (outputNode, depois da luz, como o remendo em opaque_fragment);
   - asteroides com forma e giro no shader: o Motor 5 aplica a instância antes do positionNode, então os asteroides são uma malha com
     InstancedBufferGeometry e a matriz de cada um em quatro atributos (a forma única por instância nasce do índice da instância, como o gl_InstanceID);
     os cristais são um ARD.m5.Inst (M5.instMat/instCor);
   - redemoinho da Fenda e feixes (aditivos de duas faces numa passada, só cor: o alfa da camada fica como está) e o quadro que cola a camada na
     profundidade do céu;
   - no céu e no chão (5.0a.1 absorvida, sem duplicar): o céu de espaço continua o M5.ceu({ espaco }) do src/m5/espaco-min.js (nebulosa assada,
     estrelas, sol), agora com o planeta gigante (o do M5.ceu do src/m5/terreno.js; 5.0b.1: o M5.espacoPlaneta daqui saiu); o mapa do vazio é o mapaVazio de lá no M5.tex.vazio
     compartilhado; o chão corta como o ARD_VAZIO do clássico (no M5.chao do src/m5/terreno.js; 5.0b.1: o M5.espacoBorda daqui saiu); o ruído 3D é o mesmo (M5.espaco.ruido).
   Contrato com o space3d: U = uniforms compartilhados no formato do GLSL (nós do TSL com .value). Só visual. */
(function (ARD) {
'use strict';
const M5 = ARD.m5 = ARD.m5 || {};
let F = null; /* funções de ruído 3D (sem uniforms dentro: funções com setLayout não levam uniforms para o grupo do material) */
function fns() {
  if (F) return F; const L = window.TSL; const { Fn, float, vec2, vec3, fract, floor, dot, mix } = L;
  const NZ = M5.espaco.ruido(); const h = NZ.h31, n3 = NZ.vn3; /* hash e ruído de valor 3D: as funções do céu de espaço (src/m5/espaco-min.js), as mesmas do GLSL_N */
  const h33 = Fn(([p0]) => { const p = fract(p0.mul(vec3(0.1031, 0.1030, 0.0973))).toVar(); p.addAssign(dot(p, p.yxz.add(33.33))); return fract(p.xxy.add(p.yxx).mul(p.zyx)); }).setLayout({ name: 'ardH33', type: 'vec3', inputs: [{ name: 'p0', type: 'vec3' }] });
  /* ruído 2D do redemoinho (o mesmo hash do lago) e fbm de 5 oitavas sem normalizar */
  const h2 = Fn(([p]) => { const q = fract(vec3(p.x, p.y, p.x).mul(0.1031)).toVar(); q.addAssign(dot(q, q.yzx.add(33.33))); return fract(q.x.add(q.y).mul(q.z)); }).setLayout({ name: 'vxH', type: 'float', inputs: [{ name: 'p', type: 'vec2' }] });
  const n2 = Fn(([p]) => { const i = floor(p).toVar(), f0 = fract(p); const f = f0.mul(f0).mul(f0.mul(-2).add(3)).toVar(); return mix(mix(h2(i), h2(i.add(vec2(1, 0))), f.x), mix(h2(i.add(vec2(0, 1))), h2(i.add(vec2(1, 1))), f.x), f.y); }).setLayout({ name: 'vxN', type: 'float', inputs: [{ name: 'p', type: 'vec2' }] });
  const fb5 = Fn(([p0]) => { const p = vec2(p0).toVar(); const v = float(0).toVar(); let a = 0.5; for (let i = 0; i < 5; i++) { v.addAssign(n2(p).mul(a)); p.assign(p.mul(2.07).add(vec2(3.1, 1.7))); a *= 0.5; } return v; }).setLayout({ name: 'vxF', type: 'float', inputs: [{ name: 'p0', type: 'vec2' }] });
  F = { h, h33, n3, n2, fb5, L }; return F;
}

/* uniforms compartilhados no formato do GLSL */
M5.espacoUniforms = function () {
  const T = window.THREE_M5, L = window.TSL; const { uniform } = L; M5.shared && M5.shared();
  return { uTime: uniform(0), uSeed: uniform(0), uHaze: uniform(new T.Color(0.006, 0.009, 0.022)), uFade: uniform(new T.Vector4(160, 1500, 9000, 0.93)), uCore: uniform(new T.Vector4(1600, -1650, -1600, 650)), uCoreC: uniform(new T.Vector4(1.3, 0.32, 0.95, 0.9)), uFogMap: M5.tex.nevoa };
};

/* rocha: o: { inst (asteroide: forma e giro no shader), raiz, balanco, cristal, nevoa, fog, vcol, color, emissive, emI, rough, env, fadeK } */
M5.espacoRocha = function (U, o) {
  const T = window.THREE_M5, f = fns(), L = f.L;
  const { float, vec2, vec3, vec4, mat4, attribute, varying, instanceIndex, select, positionGeometry, positionWorld, positionView, normalView, cameraPosition, cameraViewMatrix, output, diffuseColor, normalize, dot, cross, cos, sin, max, min, mix, smoothstep, length, exp, abs, floor, fract, inverseSqrt, dFdx, dFdy, uniform } = L;
  const m = new T.MeshStandardNodeMaterial({ color: o.color || 0xffffff, roughness: o.rough || 0.9, metalness: 0, flatShading: true, vertexColors: !!o.vcol, emissive: o.emissive || 0x000000, emissiveIntensity: o.emI || 1 });
  m.envMapIntensity = o.env == null ? 0.35 : o.env; m.fog = !!o.fog;
  const fadeK = uniform(o.fadeK == null ? 1 : o.fadeK); m.userData.fadeK = fadeK;
  let objP = positionGeometry, iCol = null;
  if (o.inst) { /* forma única por instância (ruído na esfera + cortes planos de lasca), giro lento e balanço opcional; depois a matriz da instância */
    /* sem atribuições: o grafo é montado aqui e só vira código no vértice (cada passo numa variável) */
    const sdi = float(instanceIndex).mul(1.618).add(U.uSeed).toVar('rkSdi'); const p = normalize(positionGeometry).toVar('rkP');
    const n = f.n3(p.mul(1.5).add(sdi)).mul(0.55).add(f.n3(p.mul(3.4).sub(sdi.mul(1.3))).mul(0.3)).add(f.n3(p.mul(7.7).add(sdi.mul(0.7))).mul(0.15));
    let r = n.mul(0.6).add(0.7).toVar('rkR0');
    for (let k = 0; k < 4; k++) { const cn = normalize(f.h33(vec3(sdi, k * 3.7, 1.9)).mul(2).sub(1)); const cd = f.h(vec3(sdi, k, 7.3)).mul(0.42).add(0.36).toVar('rkCd' + k); const dp = r.mul(dot(p, cn)).toVar('rkDp' + k); r = r.mul(select(dp.greaterThan(cd), cd.div(dp), float(1))).toVar('rkR' + (k + 1)); } /* lasca: if (dp > cd) r *= cd / dp */
    const sh = p.mul(r).toVar('rkSh'); objP = varying(sh, 'vObjP');
    const sp = attribute('aSpin', 'vec4'); const ang = sp.w.mul(U.uTime); const c = cos(ang).toVar('rkC'), s = sin(ang).toVar('rkS'); const ax = sp.xyz;
    let rot = sh.mul(c).add(cross(ax, sh).mul(s)).add(ax.mul(dot(ax, sh)).mul(c.oneMinus()));
    if (o.balanco) rot = rot.add(vec3(0, sin(U.uTime.mul(0.55).add(sdi.mul(3))).mul(0.22), 0));
    const IM = mat4(attribute('iMa', 'vec4'), attribute('iMb', 'vec4'), attribute('iMc', 'vec4'), attribute('iMd', 'vec4'));
    m.positionNode = IM.mul(vec4(rot, 1)).xyz; /* malha com matriz identidade: o local já é o mundo */
    iCol = varying(attribute('iCol', 'vec3'), 'vICol');
  }
  /* cor (o ROCK_FS_COLOR): estratos e veios nas raízes, grão, tinta fria nos asteroides */
  let k3 = vec3(1);
  let op = objP;
  if (o.raiz) { const W = positionWorld; op = W.mul(0.02);
    const band = W.y.div(8.5).add(f.n3(W.mul(0.012)).mul(2.2)); const bi = floor(band); const bt = fract(sin(bi.mul(12.9898).add(78.233)).mul(43758.5453));
    k3 = k3.mul(bt.mul(0.45).add(0.7)).mul(f.n3(W.mul(vec3(0.06, 0.012, 0.06))).mul(0.44).add(0.78)); /* estratos e veios verticais como no paredão */
    const wnf = cross(dFdx(W), dFdy(W)); const up = smoothstep(0.55, 0.85, abs(wnf.y).mul(inverseSqrt(max(dot(wnf, wnf), 1e-12))));
    const pit = smoothstep(0.7, 0.84, f.n3(W.mul(0.62))); k3 = k3.mul(mix(float(1), f.n3(vec3(W.x, 0, W.z).mul(0.13)).mul(0.34).add(0.84).mul(pit.mul(0.16).oneMinus()), up)); } /* tampa: grão e covinhas miúdas */
  if (!o.cristal) { const g = f.n3(op.mul(3.1)).mul(0.6).add(f.n3(op.mul(9.0)).mul(0.4)); k3 = k3.mul(g.mul(0.5).add(0.74)); }
  if (o.inst) k3 = k3.mul(mix(vec3(1), vec3(0.85, 0.92, 1.12), smoothstep(0.55, 0.8, f.n3(op.mul(1.7).add(4)))));
  let col = vec3(m.color.r, m.color.g, m.color.b).mul(k3); if (iCol) col = col.mul(iCol);
  if (o.cristal) { /* cristal: M5.Inst (matriz e cor por atributo); emissivo × cor de instância (o vColor do GLSL) e pulso que acende a ponta de baixo */
    M5.instMat(m); col = M5.instCor(col);
    const pulse = sin(U.uTime.mul(1.4).add(positionWorld.x.mul(0.031)).add(positionWorld.z.mul(0.027))).mul(0.25).add(0.55).add(smoothstep(-1.0, -0.3, positionGeometry.y).oneMinus().mul(0.6));
    m.emissiveNode = M5.instCor(vec3(m.emissive.r, m.emissive.g, m.emissive.b).mul(m.emissiveIntensity)).mul(pulse); }
  m.colorNode = col;
  /* fim: luz da Fenda vinda do redemoinho lá embaixo e o esmaecer para a poeira escura com a profundidade e a distância */
  const lp = cameraViewMatrix.mul(vec4(U.uCore.xyz, 1)).xyz; const lv0 = lp.sub(positionView); const ld = length(lv0); const lv = lv0.div(max(ld, 1));
  const cl = max(dot(normalView, lv), 0).mul(0.85).add(0.15); const ca = smoothstep(0.0, U.uCore.w, ld).oneMinus();
  let rgb = output.rgb.add(diffuseColor.rgb.mul(U.uCoreC.rgb).mul(cl).mul(U.uCoreC.w).mul(ca).mul(ca));
  const dep = max(0, positionWorld.y.negate().sub(U.uFade.x)); const fd = exp(dep.negate().div(U.uFade.y)).oneMinus(); const fz = exp(length(positionWorld.sub(cameraPosition)).negate().div(U.uFade.z)).oneMinus();
  const fk = min(fd.oneMinus().mul(fz.oneMinus()).oneMinus(), U.uFade.w).mul(fadeK);
  if (o.nevoa) rgb = rgb.mul(mix(0.06, 1.0, M5.sample.nevoa(positionWorld))); /* névoa de guerra do terreno */
  m.outputNode = vec4(mix(rgb, U.uHaze, fk), output.a);
  return M5.registrar('espaco-' + (o.inst ? 'asteroide' : o.cristal ? 'cristal' : o.raiz ? 'raiz' : 'rocha') + (o.balanco ? '-pedra' : ''), m);
};
/* asteroides: malha com instâncias por atributo (matriz em quatro vec4, cor, eixo e velocidade do giro); list = registros do space3d (rockRec) */
M5.espacoAsteroides = function (geo, list, mat) {
  const T = window.THREE_M5; const n = list.length, N = Math.max(1, n); const g = new T.InstancedBufferGeometry(); g.index = geo.index; for (const k of ['position', 'normal']) if (geo.attributes[k]) g.setAttribute(k, geo.attributes[k]);
  const A = ['iMa', 'iMb', 'iMc', 'iMd'].map(() => new Float32Array(N * 4)), col = new Float32Array(N * 3), spin = new Float32Array(N * 4);
  const M = new T.Matrix4(), Q = new T.Quaternion(), P = new T.Vector3(), Sc = new T.Vector3(), E = new T.Euler(), ax = new T.Vector3();
  for (let i = 0; i < n; i++) { const r = list[i]; P.set(r[0], r[1], r[2]); E.set(r[4], r[5], r[6]); Q.setFromEuler(E); Sc.set(r[3] * r[7], r[3] * r[8], r[3] * r[9]); M.compose(P, Q, Sc); const e = M.elements;
    for (let c = 0; c < 4; c++) for (let k = 0; k < 4; k++) A[c][i * 4 + k] = e[c * 4 + k];
    col[i * 3] = r[10]; col[i * 3 + 1] = r[11]; col[i * 3 + 2] = r[12]; ax.set(r[13], r[14], r[15]).normalize(); spin[i * 4] = ax.x; spin[i * 4 + 1] = ax.y; spin[i * 4 + 2] = ax.z; spin[i * 4 + 3] = r[16]; }
  ['iMa', 'iMb', 'iMc', 'iMd'].forEach((k, c) => g.setAttribute(k, new T.InstancedBufferAttribute(A[c], 4))); g.setAttribute('iCol', new T.InstancedBufferAttribute(col, 3)); g.setAttribute('aSpin', new T.InstancedBufferAttribute(spin, 4));
  g.instanceCount = n; g.boundingSphere = new T.Sphere(new T.Vector3(), 1e6);
  const me = new T.Mesh(g, mat); me.frustumCulled = false; me.count = n; me.visible = n > 0; /* sem instâncias: escondido (desenho vazio avisa a cada quadro) */ return me;
};

/* redemoinho da Fenda: espiral com braços e fiapos, núcleo aceso; aditivo só na cor */
M5.espacoVortice = function (U, dir, k, c1, c2, c3) {
  const T = window.THREE_M5, f = fns(), L = f.L; const { Fn, uniform, float, vec2, vec3, vec4, uv, length, log, cos, sin, atan, exp, smoothstep, mix, Discard, If } = L;
  const u = { uDir: uniform(dir), uK: uniform(k), uC1: uniform(new T.Color().fromArray(c1)), uC2: uniform(new T.Color().fromArray(c2)), uC3: uniform(new T.Color().fromArray(c3)) }; const t = U.uTime;
  const m = new T.MeshBasicNodeMaterial({ side: T.DoubleSide, transparent: true, depthWrite: false, blending: T.CustomBlending, blendEquation: T.AddEquation, blendSrc: T.OneFactor, blendDst: T.OneFactor, blendSrcAlpha: T.ZeroFactor, blendDstAlpha: T.OneFactor }); m.fog = false;
  m.fragmentNode = Fn(() => { const p = uv().mul(2).sub(1).toVar(); const r = length(p).toVar(); If(r.greaterThan(1), () => { Discard(); });
    const tw = u.uDir.mul(log(r.add(0.03)).mul(1.9).sub(t.mul(0.05))).toVar(); const c = cos(tw), s = sin(tw); const q = vec2(c.mul(p.x).add(s.mul(p.y)), s.negate().mul(p.x).add(c.mul(p.y))).toVar(); /* mat2(c, −s, s, c) · p */
    const arms = f.fb5(q.mul(3.2).add(1.3)); const fil = f.fb5(q.mul(9.0).sub(4.1)).toVar(); const sp = sin(atan(q.y, q.x).mul(3).add(fil.mul(3))).mul(0.5).add(0.5);
    const body = smoothstep(0.32, 0.8, arms.mul(sp.mul(0.5).add(0.75))).mul(smoothstep(0.35, 1.0, r).oneMinus()).mul(smoothstep(0.0, 0.12, r));
    const lanes = smoothstep(0.45, 0.65, fil);
    const col = mix(u.uC2, u.uC3, smoothstep(0.15, 0.9, r)).mul(body).mul(lanes.mul(0.6).add(0.55)).mul(1.4).add(u.uC1.mul(exp(r.mul(r).mul(-90)).mul(7).add(exp(r.mul(-7)).mul(0.9))).mul(sin(t.mul(1.7)).mul(0.15).add(0.85)));
    return vec4(col.mul(u.uK), 0); })();
  m.uniforms = u; /* o space3d muda uK (noite) */
  m.forceSinglePass = true; /* soma: a ordem das faces não importa (um pipeline, não dois) */
  return M5.registrar('espaco-redemoinho', m);
};
/* feixes de luz subindo do redemoinho */
M5.espacoFeixes = function (U) {
  const T = window.THREE_M5, L = window.TSL; const { uniform, float, vec4, uv, floor, fract, sin, mix, pow, abs, dot, normalize, smoothstep, normalViewGeometry, positionViewDirection } = L;
  const u = { uK: uniform(0.2), uC: uniform(new T.Color(1.15, 0.38, 1.0)) }; const t = U.uTime;
  const h = x => fract(sin(x.mul(127.1)).mul(43758.5453)); const n = x => { const i = floor(x), f = fract(x); const s = f.mul(f).mul(f.mul(-2).add(3)); return mix(h(i), h(i.add(1)), s); };
  const vu = uv(); const st0 = n(vu.x.mul(46)).mul(0.6).add(n(vu.x.mul(15).add(t.mul(0.15))).mul(0.4)); const streak = st0.mul(st0).mul(1.6);
  const rise = sin(vu.y.mul(14).sub(t.mul(1.1)).add(vu.x.mul(31))).mul(0.45).add(0.55);
  const edge = pow(abs(dot(normalize(normalViewGeometry), positionViewDirection)).oneMinus(), 1.5); const fade = smoothstep(0.0, 0.1, vu.y).mul(smoothstep(0.55, 1.0, vu.y).oneMinus());
  const a = streak.mul(rise).mul(fade).mul(edge.mul(0.65).add(0.35)).mul(u.uK);
  const m = new T.MeshBasicNodeMaterial({ side: T.DoubleSide, transparent: true, depthWrite: false, blending: T.CustomBlending, blendEquation: T.AddEquation, blendSrc: T.OneFactor, blendDst: T.OneFactor, blendSrcAlpha: T.ZeroFactor, blendDstAlpha: T.OneFactor }); m.fog = false;
  m.fragmentNode = vec4(u.uC.mul(a), 0); m.uniforms = u; m.forceSinglePass = true; /* soma de duas faces numa passada */
  return M5.registrar('espaco-feixes', m);
};
/* quadro de tela cheia na profundidade do céu: cola a camada do espaço (cor pré-multiplicada) por baixo de tudo o que a cena desenha */
M5.espacoQuadro = function (tex) {
  const T = window.THREE_M5, L = window.TSL; const { vec4, positionGeometry, texture, screenUV } = L;
  const m = new T.MeshBasicNodeMaterial({ transparent: true, depthTest: true, depthWrite: false, blending: T.CustomBlending, blendEquation: T.AddEquation, blendSrc: T.OneFactor, blendDst: T.OneMinusSrcAlphaFactor, blendSrcAlpha: T.ZeroFactor, blendDstAlpha: T.OneFactor }); m.fog = false;
  m.vertexNode = vec4(positionGeometry.xy, 1, 1); /* z = w: profundidade 1 (o céu); só aparece onde nada foi desenhado */
  m.fragmentNode = texture(tex, screenUV);
  return M5.registrar('espaco-quadro', m);
};

/* 5.0b.1: o M5.espacoPlaneta (o planeta gigante no E.cor do src/m5/espaco-min.js) saiu: o céu da partida e o da bancada são o M5.ceu do src/m5/terreno.js, que tem o planeta dele; o E.cor só servia ao céu da fundação, que ninguém monta */
/* o Cinturão tem o space3d completo nesta partida (beirada, paredões e raízes no contorno exato): o chão corta como no clássico */
M5.espacoPleno = () => !!(M5.cur && M5.cur.R && M5.cur.R.SPC);
/* 5.0b.1: o M5.espacoBorda saiu (só o chão da fundação chamava, com o space3d na partida, e lá o chão é o do src/m5/terreno.js, que corta sozinho) */
})(globalThis.ARD = globalThis.ARD || {});
