/* Aether Rift: Dominion — Motor 5 (5.0b, fase 2): lagos de plasma e de gelo em TSL. O src/lakes3d.js escolhe este caminho no Motor 5
   (ARD.m5.active()) e continua dono da geometria, dos dados de cada lago, das bolhas, dos efeitos e do passe do reflexo; aqui ficam:
   - os quatro materiais (plasma, gelo, margem queimada, neve da margem): a mesma conta dos remendos GLSL de 4.3h, escrita em TSL, com as
     funções de ruído, Voronoi e relevo por derivada como funções de verdade do shader (Fn com setLayout: uma cópia só no WGSL e no GLSL);
   - o reflexo do gelo dentro do modelo de luz (PhysicalLightingModel com indirect() próprio): mexe no especular e no difuso indiretos e no
     difuso direto como o remendo em lights_fragment_end; sem o passe de reflexo, o céu pelo mapa de ambiente com fresnel;
   - o alvo do reflexo (cor e profundidade, os mesmos formatos do passe da cena do pós: os objetos refletidos usam os pipelines da cena).
   Contrato com o lakes3d: G = uniforms compartilhados (nós do TSL com .value, mesmas chaves do GLSL), U = uniforms de cada lago (idem).
   Nada aqui aloca por quadro nem cria material depois do build. Só visual. */
(function (ARD) {
'use strict';
const M5 = ARD.m5 = ARD.m5 || {};
let F = null; /* funções comuns, criadas na primeira chamada (o TSL só existe depois do m5-ready) */
function fns() {
  if (F) return F; const L = window.TSL;
  const { Fn, float, vec2, vec3, vec4, fract, floor, dot, mix, sin, sqrt, If, normalize, cross, sign, abs, dFdx, dFdy, length, step, smoothstep, pow, max, reflect } = L;
  const h1 = Fn(([p]) => { const q = fract(vec3(p.x, p.y, p.x).mul(0.1031)).toVar(); q.addAssign(dot(q, q.yzx.add(33.33))); return fract(q.x.add(q.y).mul(q.z)); }).setLayout({ name: 'lkH1', type: 'float', inputs: [{ name: 'p', type: 'vec2' }] });
  const h2 = Fn(([p]) => { const q = fract(vec3(p.x, p.y, p.x).mul(vec3(0.1031, 0.1030, 0.0973))).toVar(); q.addAssign(dot(q, q.yzx.add(33.33))); return fract(q.xx.add(q.yz).mul(q.zy)); }).setLayout({ name: 'lkH2', type: 'vec2', inputs: [{ name: 'p', type: 'vec2' }] });
  const n = Fn(([p]) => { const i = floor(p).toVar(), f0 = fract(p); const f = f0.mul(f0).mul(f0.mul(-2).add(3)).toVar(); return mix(mix(h1(i), h1(i.add(vec2(1, 0))), f.x), mix(h1(i.add(vec2(0, 1))), h1(i.add(vec2(1, 1))), f.x), f.y); }).setLayout({ name: 'lkN', type: 'float', inputs: [{ name: 'p', type: 'vec2' }] });
  const rot = p => vec2(p.x.mul(1.6).sub(p.y.mul(1.2)), p.x.mul(1.2).add(p.y.mul(1.6))).add(vec2(1.7, 9.2)); /* mat2(1.6, 1.2, −1.2, 1.6) · p + (1,7; 9,2) */
  const fb = Fn(([p0]) => { const p = vec2(p0).toVar(); const v = float(0).toVar(); let a = 0.5; for (let i = 0; i < 4; i++) { v.addAssign(n(p).mul(a)); p.assign(rot(p)); a *= 0.5; } return v.div(0.9375); }).setLayout({ name: 'lkF', type: 'float', inputs: [{ name: 'p', type: 'vec2' }] });
  const fb2 = Fn(([p]) => n(p).mul(0.5).add(n(rot(p)).mul(0.25)).div(0.75)).setLayout({ name: 'lkF2', type: 'float', inputs: [{ name: 'p', type: 'vec2' }] });
  /* Voronoi: x F1, y F2 − F1 (perto de 0 na aresta), z id da célula, w id da vizinha (a aresta é o par) */
  const vor = Fn(([p, t, jit]) => {
    const ip = floor(p).toVar(), fp = fract(p).toVar(); const d1 = float(9).toVar(), d2 = float(9).toVar(), id = float(0).toVar(), id2 = float(0).toVar();
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const g = vec2(i, j); const h = h2(ip.add(g)).toVar(); const o = vec2(0.5).add(h.sub(0.5).mul(jit)).add(sin(h.mul(6.2831).add(t)).mul(0.16)); const r = g.add(o).sub(fp); const d = dot(r, r).toVar();
      If(d.lessThan(d1), () => { d2.assign(d1); id2.assign(id); d1.assign(d); id.assign(h.x); }).ElseIf(d.lessThan(d2), () => { d2.assign(d); id2.assign(h.x); }); }
    const s1 = sqrt(d1).toVar(); return vec4(s1, sqrt(d2).sub(s1), id, id2);
  }).setLayout({ name: 'lkV', type: 'vec4', inputs: [{ name: 'p', type: 'vec2' }, { name: 't', type: 'float' }, { name: 'jit', type: 'float' }] });
  const edge = v => h1(vec2(v.z.add(v.w), v.z.mul(v.w)).mul(97)); /* sorteio por aresta (o mesmo dos dois lados) */
  /* relevo por derivadas de tela (o lkBump do GLSL): sp posição na vista, sn normal na vista, dh derivadas da altura, fd lado da face */
  const bump = Fn(([sp, sn, dh, fd]) => { const sx = normalize(dFdx(sp)).toVar(), sy = normalize(dFdy(sp)).toVar(); const r1 = cross(sy, sn).toVar(), r2 = cross(sn, sx).toVar(); const det = dot(sx, r1).mul(fd).toVar(); const g = sign(det).mul(dh.x.mul(r1).add(dh.y.mul(r2))); return normalize(abs(det).mul(sn).sub(g)); })
    .setLayout({ name: 'lkBump', type: 'vec3', inputs: [{ name: 'sp', type: 'vec3' }, { name: 'sn', type: 'vec3' }, { name: 'dh', type: 'vec2' }, { name: 'fd', type: 'float' }] });
  F = { h1, h2, n, fb, fb2, vor, edge, bump, rot, L, glit: null };
  return F;
}
/* cristais de neve que piscam com o sol (lkGlit); o sol entra como parâmetro (uniform dentro de função com setLayout não entra no grupo do material) */
function glitFn() {
  const f = fns(); if (f.glit) return f.glit; const { Fn, vec2, vec3, floor, fract, length, normalize, pow, max, dot, reflect, step, smoothstep } = f.L;
  f.glit = Fn(([P, V, Ls]) => { const gp = P.mul(0.8).toVar(); const gc = floor(gp).toVar(); const on = step(0.93, f.h1(gc.add(3.7))); const d = length(fract(gp).sub(0.25).sub(f.h2(gc.add(5.1)).mul(0.5)));
    const gn = normalize(vec3(f.h1(gc.add(1.1)).sub(0.5), 0.9, f.h1(gc.add(2.3)).sub(0.5))); return on.mul(pow(max(dot(reflect(Ls.negate(), gn), V), 0), 48)).mul(smoothstep(0.08, 0.3, d).oneMinus()); })
    .setLayout({ name: 'lkGlit', type: 'float', inputs: [{ name: 'P', type: 'vec2' }, { name: 'V', type: 'vec3' }, { name: 'Ls', type: 'vec3' }] });
  return f.glit;
}

/* uniforms compartilhados no formato do GLSL (G) — o lakes3d continua escrevendo .value como antes */
M5.aguaUniforms = function (S, qs) {
  const T = window.THREE_M5, L = window.TSL; const { uniform, texture } = L; M5.shared && M5.shared();
  const blank = (r, g, b, a) => { const t = new T.DataTexture(new Uint8Array([r, g, b, a]), 1, 1); t.needsUpdate = true; return t; };
  return { uTime: M5.u.tempo, uDetail: uniform(1), uNight: uniform(0), uFog: M5.tex.nevoa, uWorld: M5.u.mundo, uSunDir: uniform(new T.Vector3(-0.47, 0.64, 0.6).normalize()), uSky: uniform(new T.Color(0.62, 0.69, 0.77)),
    uRefl: texture(blank(0, 0, 0, 255)), uReflDepth: null /* nasce com o alvo (textura de profundidade: o tipo entra no shader) */, uReflMat: uniform(new T.Matrix4()), uReflBox: uniform(new T.Vector4(0, 0, 1, 1)), uReflK: uniform(+((qs.match(/[?&]reflexok=([0-9.]+)/) || [])[1] || 1)), _blank: blank };
};
/* dados de cada lago lidos por objeto (5.0b, regra 3 da carga): um material só por tipo de lago para todos os lagos (um WGSL, um pipeline). Cada malha
   leva no userData.lkU o U do lakes3d (os mesmos { value } do GLSL: textura de dados, retângulo, info, 6 bolhas ou o reflexo ligado) e estes nós
   trocam de valor a cada objeto desenhado. Antes era um material por lago: o uniformArray das bolhas põe o id do nó no nome da estrutura e a 1ª
   montagem sai com outra ordem de declarações, então cada lago virava um WGSL e um pipeline. tex0 = a textura de dados do 1º lago (mesmo formato) */
function porObjeto(kind, tex0) {
  const T = window.THREE_M5, L = window.TSL; const { uniform, texture } = L; const lk = o => o.userData.lkU;
  const U = { uLkData: texture(tex0).onObjectUpdate(({ object }) => lk(object).uLkData.value), uLkRect: uniform(new T.Vector4()).onObjectUpdate(({ object }) => lk(object).uLkRect.value), uLkInfo: uniform(new T.Vector4()).onObjectUpdate(({ object }) => lk(object).uLkInfo.value) };
  if (kind === 'plasma') { U.uBub = []; for (let i = 0; i < 6; i++) U.uBub.push(uniform(new T.Vector4(0, 0, -99, 0)).onObjectUpdate(({ object }) => lk(object).uBub.value[i])); }
  if (kind === 'gelo') U.uReflOn = uniform(0).onObjectUpdate(({ object }) => lk(object).uReflOn.value);
  return U;
}
/* alvo do reflexo: cor em meia precisão e profundidade (separa céu de objeto), como o passe da cena do pós */
M5.aguaAlvo = function (G) {
  const T = window.THREE_M5, L = window.TSL;
  const rt = new T.RenderTarget(64, 64, { type: T.HalfFloatType, depthBuffer: true, stencilBuffer: false, generateMipmaps: false, minFilter: T.LinearFilter, magFilter: T.LinearFilter }); rt.depthTexture = new T.DepthTexture(64, 64); rt.texture.name = 'reflexo-lagos';
  G.uRefl.value = rt.texture; G.uReflDepth = L.texture(rt.depthTexture); return rt;
};

/* ---------- material de cada tipo ---------- */
M5.aguaMaterial = function (kind, G, decal, envK, tex0) {
  const T = window.THREE_M5, f = fns(), L = f.L; const U = porObjeto(kind, tex0);
  const { Fn, float, vec2, vec3, vec4, mix, smoothstep, clamp, max, min, sin, exp, length, abs, step, fract, floor, dot, If, fwidth, positionWorld, positionView, normalView, faceDirection, dFdx, dFdy, diffuseColor, cameraPosition, normalize, pow } = L;
  const isGelo = kind === 'gelo';
  let m;
  if (isGelo) { /* o reflexo entra no modelo de luz (depois do indireto, antes de somar): o mesmo lugar do remendo em lights_fragment_end */
    const A = M5._aguaClasses || (M5._aguaClasses = (() => {
      class LuzGelo extends T.PhysicalLightingModel { constructor(fx) { super(); this.ardFx = fx; } indirect(builder) { super.indirect(builder); this.ardFx(builder.context); } }
      class MatGelo extends T.MeshStandardNodeMaterial { setupLightingModel() { return new LuzGelo(this.ardFx); } }
      return { MatGelo };
    })());
    m = new A.MatGelo({ color: 0xffffff, roughness: 0.8, metalness: 0 });
  } else m = new T.MeshStandardNodeMaterial({ color: 0xffffff, roughness: 0.8, metalness: 0, transparent: !!decal, depthWrite: !decal });
  m.envMapIntensity = envK; m.userData.env = envK;
  if (decal) { m.polygonOffset = true; m.polygonOffsetFactor = 0; m.polygonOffsetUnits = -2; } /* o decalque já fica 0,05 acima do chão e não pode passar na frente do gelo (0,12 acima) */
  /* cabeça comum: posição no mapa, dados do lago, névoa de guerra e tamanho do pixel em unidades do mapa */
  const P = vec2(positionWorld.x, positionWorld.z.negate()).toVar('lkP');
  const lkD = U.uLkData.sample(P.sub(U.uLkRect.xy).div(U.uLkRect.zw)).toVar('lkD'); const s = lkD.r.toVar('lkS');
  const fogK = G.uFog.sample(P.div(G.uWorld)).r.toVar('lkFog'); const lkFw = length(fwidth(P)).toVar('lkFw');
  const t = G.uTime, sd = U.uLkInfo.w;
  const decalK = kind === 'queimado' || kind === 'neve'; const bumpK = { plasma: 1.3, gelo: 0.7, queimado: 0.8, neve: 0.6 }[kind]; const flash = kind !== 'plasma';
  if (decalK) m.maskNode = s.lessThanEqual(0.4); /* dentro da lava ou do gelo o decalque fica por baixo dele */
  /* saídas do corpo (variáveis do shader): a cor roda primeiro na montagem do material, o resto (rugosidade, relevo, emissivo, reflexo) lê daqui */
  const O = { col: vec3(0).toVar('lkCol'), rough: float(0.8).toVar('lkRough'), ht: float(0).toVar('lkHt'), em: vec3(0).toVar('lkEm'), alpha: float(1).toVar('lkAlpha'), refK: float(0).toVar('lkRefK') };
  const corpo = () => { let col, rough, ht, em, alpha = null, refK = null;
  if (kind === 'plasma') {
    const q = P.mul(0.016).add(vec2(sd.mul(3.1), sd.mul(1.7))).toVar();
    const wv = vec2(f.fb2(q.add(vec2(t.mul(0.010), t.mul(-0.007)))), f.fb2(q.mul(1.3).add(vec2(5.2, 1.3)).sub(vec2(t.mul(0.008), t.mul(0.011))))).sub(0.5).toVar('lkWv');
    const heat = float(0).toVar('lkHeat'); heat.assign(f.fb(q.mul(1.35).add(wv.mul(1.8)).add(vec2(t.mul(0.005), t.mul(-0.003)))));
    heat.assign(clamp(heat.sub(0.36).mul(1.8).add(smoothstep(3.0, 26.0, s).mul(0.18)), 0, 1)); /* manchas quentes que mudam devagar; o fundo é mais quente */
    heat.mulAssign(smoothstep(1.5, 12.0, s).mul(0.7).add(0.3)); /* a margem esfria */
    const fine = smoothstep(0.9, 2.2, lkFw).oneMinus().toVar('lkFine'); /* detalhe fino só de perto */
    const pw = P.add(wv.mul(8)).add(vec2(f.n(P.mul(0.09).add(3)), f.n(P.mul(0.09).add(17))).sub(0.5).mul(6)).toVar('lkPw'); /* placas tortas, de tamanhos diferentes */
    const vc = f.vor(pw.div(10), t.mul(0.1), float(0.9)).toVar('lkVc'); const ek = f.edge(vc).toVar('lkEk'); /* cada aresta sorteia se está aberta (lava) ou soldada (crosta) */
    const cw = mix(0.03, 0.3, heat).mul(ek.mul(0.9).add(0.55)).mul(sin(t.mul(0.5).add(vc.z.mul(6.2831))).mul(0.15).add(0.85)).toVar('lkCw');
    const crack = smoothstep(cw.mul(0.3), cw, vc.y).oneMinus().mul(mix(0.5, 1.0, fine)).mul(smoothstep(0.5, 0.75, ek.add(heat.mul(0.45)))).toVar('lkCrack'); /* na parte fria só parte das arestas abre */
    const vb = f.vor(pw.div(36).add(3.7), t.mul(0.04), float(0.9)).toVar('lkVb'); /* blocos grandes (~36 un): fendas largas, nem todas abertas */
    const crackB = smoothstep(0.01, heat.mul(0.11).add(0.03).mul(f.n(P.mul(0.07).add(2)).add(0.5)), vb.y).oneMinus().mul(step(0.35, f.edge(vb)));
    const open = smoothstep(0.7, 0.92, heat).toVar('lkOpen'); /* lava exposta, sem crosta */
    const molten = clamp(max(max(crack, crackB), open), 0, 1).toVar('lkMolten');
    /* bolhas guiadas pela CPU: crescem (pele escura com aro aceso), estouram (clarão) e deixam um anel que se abre */
    const bub = float(0).toVar('lkBub'), bubRim = float(0).toVar('lkBubRim'), bubSkin = float(0).toVar('lkBubSkin'); const BA = U.uBub;
    for (let i = 0; i < 6; i++) { const b = BA[i].toVar(); const age = t.sub(b.z).toVar(); const d = length(P.sub(b.xy)).toVar();
      If(b.w.greaterThan(0).and(age.greaterThanEqual(0)).and(age.lessThanEqual(2.5)), () => {
        If(age.lessThan(1.6), () => { const r = b.w.mul(smoothstep(0.0, 1.6, age).mul(0.75).add(0.25)); const inb = smoothstep(r.mul(0.8), r, d).oneMinus(); bubSkin.assign(max(bubSkin, inb)); bubRim.assign(max(bubRim, inb.mul(smoothstep(r.mul(0.45), r.mul(0.9), d)).mul(smoothstep(0.8, 1.6, age).mul(0.5).add(0.5)))); })
          .Else(() => { const a2 = age.sub(1.6).div(0.9); const rr = b.w.mul(a2.mul(2.4).add(1)); bub.assign(max(bub, smoothstep(0.0, b.w.mul(1.1), d).oneMinus().mul(a2.oneMinus()).mul(1.4))); bubRim.assign(max(bubRim, smoothstep(0.0, a2.mul(1.2).add(0.5), abs(d.sub(rr))).oneMinus().mul(a2.oneMinus()))); }); }); }
    /* microbolhas: pontinhos que acendem e estouram nas partes quentes */
    const mb = float(0).toVar('lkMb');
    If(G.uDetail.greaterThan(0.3), () => { const mp = P.div(3.4); const mi = floor(mp).toVar(); const mh = f.h2(mi.add(41)).toVar(); const per = mh.x.mul(5).add(3); const ph = fract(t.add(mh.y.mul(17)).div(per)).toVar(); const mc = mi.add(0.25).add(f.h2(mi.add(7)).mul(0.5));
      const mr = smoothstep(0.0, 0.85, ph).mul(smoothstep(0.85, 1.0, ph).oneMinus()).mul(0.3).toVar(); const mr2 = max(mr, 1e-4); mb.assign(smoothstep(mr2.mul(0.5), mr2, length(mp.sub(mc))).oneMinus().mul(step(0.7, mh.y)).mul(smoothstep(0.45, 0.85, heat)).mul(molten).mul(fine)); });
    /* cor da lava: vermelho escuro -> laranja -> amarelo; correntes e veios que andam por baixo */
    const flowN = f.fb2(P.mul(0.09).add(wv.mul(3)).add(vec2(t.mul(0.05), t.mul(-0.04))));
    const veins = smoothstep(0.55, 0.85, f.fb2(P.mul(0.22).add(wv.mul(4)).add(vec2(t.mul(-0.08), t.mul(0.06))))).toVar('lkVeins');
    const lv = clamp(heat.mul(0.55).add(0.12).add(flowN.sub(0.5).mul(0.45)).add(veins.mul(0.25)).add(bub.mul(0.7)).add(mb.mul(0.5)), 0, 1).toVar('lkLv');
    const lavaC = mix(vec3(0.35, 0.03, 0.004), vec3(2.0, 0.42, 0.045), smoothstep(0.05, 0.6, lv)).toVar('lkLavaC'); lavaC.assign(mix(lavaC, vec3(3.0, 1.35, 0.35), smoothstep(0.66, 1.0, lv)));
    lavaC.mulAssign(mix(1.0, 0.55, open.mul(veins.oneMinus()))); /* lava aberta: mais escura entre os veios (a pele esfria) */
    /* crosta: basalto escuro em corda (pahoehoe); o calor aparece como brilho vermelho na beira das placas */
    const cn = f.n(P.mul(0.7).add(3)).toVar('lkCn'), cn2 = f.n(P.mul(2.3).add(9)).toVar('lkCn2');
    const rope = sin(dot(pw, vec2(0.8, 0.6)).mul(1.4).add(f.n(pw.mul(0.15)).mul(6)).add(vc.z.mul(20))).mul(0.5).add(0.5);
    const crustC = vec3(0.05, 0.043, 0.041).mul(cn.mul(0.5).add(0.55).add(cn2.mul(0.35)));
    const edgeGlow = exp(vc.y.negate().div(max(cw, 0.02)).mul(1.2)).mul(crack.oneMinus()).mul(heat.add(0.2)).mul(fine).mul(ek);
    /* margem: costura acesa (em trechos) onde a lava encosta na rocha; crosta grossa e fria logo atrás */
    const seamN = smoothstep(0.55, 0.85, f.n(P.mul(0.05).add(vec2(t.mul(0.03), sd)))).toVar();
    const seam = smoothstep(0.1, seamN.add(1), s).oneMinus().mul(smoothstep(-0.6, 0.1, s)).mul(seamN);
    const shoreCrust = smoothstep(1.4, cn.mul(4).add(8), s).oneMinus().toVar('lkShore');
    molten.mulAssign(shoreCrust.mul(0.9).oneMinus()); molten.assign(max(molten, bub.mul(0.9)));
    const skin = bubSkin.mul(bub.oneMinus()).toVar('lkSkin');
    em = lavaC.mul(molten).add(vec3(0.8, 0.1, 0.012).mul(edgeGlow)).add(lavaC.mul(bubRim).mul(0.9)).add(vec3(1.0, 0.16, 0.02).mul(skin).mul(0.35)).add(vec3(1.2, 0.34, 0.05).mul(seam)).add(vec3(2.6, 1.0, 0.22).mul(mb).mul(0.7)).mul(fogK);
    col = mix(crustC, vec3(0.025, 0.012, 0.004), max(molten, skin.mul(0.6))).mul(mix(0.06, 1.0, fogK));
    rough = mix(cn2.mul(0.15).add(0.72), 0.45, max(molten, skin));
    ht = max(molten, open).oneMinus().mul(smoothstep(0.0, 0.3, vc.y).mul(0.9).add(cn.mul(0.25)).add(rope.mul(0.3).mul(fine))).add(skin.mul(0.9)).sub(shoreCrust.mul(0.15)); /* placas abauladas que descem para as fendas */
  } else if (isGelo) {
    const Vw = normalize(cameraPosition.sub(positionWorld)).toVar('lkVw'); const par = vec2(Vw.x, Vw.z.negate()).div(max(Vw.y, 0.28)).toVar('lkPar'); /* paralaxe das camadas de dentro */
    const fine = smoothstep(0.7, 1.8, lkFw).oneMinus().toVar('lkFine');
    const nN = f.fb(P.mul(0.05).add(sd.mul(7))).toVar('lkNN'); const nB = f.fb(P.mul(0.012).add(sd.mul(3)).add(11)).toVar('lkNB'); /* manchas grandes: gelo limpo (escuro) ou leitoso */
    /* neve na borda do gelo (irregular) e poucos rastros de neve levados pelo vento */
    const snowEdge = smoothstep(nN.mul(3).add(0.8), nN.mul(7).add(2.6), s).oneMinus();
    const wd = vec2(0.94, 0.34); const ws = vec2(dot(P, wd), dot(P, vec2(-0.34, 0.94)));
    const streak = smoothstep(0.7, 0.86, f.fb(ws.mul(vec2(0.018, 0.1)).add(7.7).add(sd))).mul(smoothstep(5.0, 22.0, s)).mul(smoothstep(0.4, 0.65, nB));
    const frost = smoothstep(0.55, 0.85, f.fb(P.mul(0.02).add(3.3).add(sd))).mul(0.6).toVar('lkFrost');
    const snow = clamp(max(snowEdge, streak.mul(0.35)), 0, 1).toVar('lkSnow');
    /* rachaduras na superfície: só algumas arestas de células de ~30 un (sorteio por aresta) — trechos retos que se encontram em ângulo; trincas finas em volta */
    const c0 = f.vor(P.div(30).add(1.3).add(sd), float(0), float(0.95)).toVar('lkC0'); const e0 = f.edge(c0).toVar();
    const crk0 = smoothstep(0.0, nN.mul(0.012).add(0.018), c0.y).oneMinus().mul(step(0.58, e0)).mul(fine).toVar('lkCrk0');
    const near0 = smoothstep(0.0, 0.16, c0.y).oneMinus().mul(step(0.58, e0)).toVar();
    const crkH = float(0).toVar('lkCrkH'), crk1 = float(0).toVar('lkCrk1'), crk2 = float(0).toVar('lkCrk2');
    If(G.uDetail.greaterThan(0.3), () => { const ch = f.vor(P.div(7).add(3.1), float(0), float(0.9)).toVar(); crkH.assign(smoothstep(0.0, 0.035, ch.y).oneMinus().mul(step(0.5, f.edge(ch))).mul(near0).mul(fine).mul(0.7));
      /* fraturas por dentro, com paralaxe (rasa e funda), esparsas e suaves */
      const c1 = f.vor(P.sub(par.mul(0.9)).div(16).add(5.1), float(0), float(0.85)).toVar(); crk1.assign(smoothstep(0.0, 0.16, c1.y).oneMinus().mul(step(0.7, f.edge(c1))).mul(smoothstep(0.55, 0.78, f.n(P.mul(0.02).add(31)))).mul(fine)); /* só em algumas manchas */
      If(G.uDetail.greaterThan(0.5), () => { const c2 = f.vor(P.sub(par.mul(2.2)).div(9).add(9.7), float(0), float(0.8)).toVar(); crk2.assign(smoothstep(0.0, 0.22, c2.y).oneMinus().mul(step(0.66, f.edge(c2))).mul(smoothstep(0.5, 0.75, f.n(P.mul(0.025).add(47)))).mul(fine)); }); }); /* Baixa e celular: só as rachaduras grandes */
    crk0.assign(max(crk0, crkH));
    /* bolhas presas: cachos em manchas, duas profundidades */
    const bubs = float(0).toVar('lkBubs'); const bz = smoothstep(0.62, 0.8, f.n(P.mul(0.03).add(21))).toVar();
    for (let li = 0; li < 2; li++) { const dz = li === 0 ? 0.6 : 1.6; const bp = P.sub(par.mul(dz)).div(li === 0 ? 1.8 : 2.8).add(li * 13.7).toVar(); const bi = floor(bp).toVar(); const bh = f.h2(bi.add(17)).toVar();
      If(bh.x.greaterThan(0.84), () => { const bc = bi.add(0.25).add(f.h2(bi.add(3)).mul(0.5)); const br = bh.y.mul(0.2).add(0.12).toVar(); const bd = length(bp.sub(bc)).toVar(); bubs.assign(max(bubs, smoothstep(br.mul(0.6), br, bd).oneMinus().mul(smoothstep(br.mul(0.15), br.mul(0.75), bd).mul(0.4).add(0.6)).mul(li === 0 ? 1.0 : 0.55))); }); }
    bubs.mulAssign(bz.mul(smoothstep(0.35, 0.9, lkFw).oneMinus()).mul(smoothstep(4.0, 12.0, s)));
    /* cor: o gelo limpo é escuro (vê-se a água funda), mais claro perto da margem e onde é leitoso */
    const deep = smoothstep(2.0, clamp(U.uLkInfo.z.mul(0.2), 10.0, 24.0), s); const milky = smoothstep(0.55, 0.8, nB).mul(0.45).toVar('lkMilky'); /* lago pequeno escurece mais perto da margem */
    const iceC = mix(vec3(0.16, 0.37, 0.46), vec3(0.008, 0.06, 0.13), deep).toVar('lkIceC');
    iceC.assign(mix(iceC, vec3(0.3, 0.5, 0.6), milky.mul(0.5)));
    iceC.addAssign(vec3(0.1, 0.22, 0.28).mul(crk2).mul(0.16).add(vec3(0.22, 0.38, 0.46).mul(crk1).mul(0.16)).add(vec3(0.5, 0.66, 0.74).mul(bubs).mul(0.5)));
    iceC.assign(mix(iceC, vec3(0.72, 0.8, 0.86), crk0.mul(0.85)));
    iceC.assign(mix(iceC, vec3(0.5, 0.62, 0.7), frost.mul(0.6)));
    const sp = f.n(P.mul(0.45).add(2)).toVar(); const snowC = vec3(0.76, 0.81, 0.88).mul(sp.mul(0.1).add(0.9));
    col = mix(iceC, snowC, snow).mul(mix(0.06, 1.0, fogK));
    const r0 = mix(mix(0.04, 0.3, max(frost, milky.mul(0.5))), 0.8, snow); rough = max(r0, crk0.mul(0.4));
    refK = snow.oneMinus().mul(frost.mul(0.6).oneMinus()).mul(crk0.mul(0.7).oneMinus()).mul(milky.mul(0.35).oneMinus()).mul(fogK);
    ht = crk0.mul(-0.5).add(snow.mul(nN.mul(0.6).add(0.5))).add(frost.mul(0.08).mul(sp));
    em = vec3(1.7, 1.8, 1.9).mul(glitFn()(P, Vw, G.uSunDir)).mul(max(snow, frost.mul(0.5))).mul(smoothstep(0.6, 1.6, lkFw).oneMinus()).mul(G.uNight.mul(0.6).oneMinus()).mul(fogK);
  } else if (kind === 'queimado') {
    const o = s.negate(); /* distância para fora da margem */
    const nN = f.fb(P.mul(0.045).add(sd.mul(5))).toVar('lkNN'); const cn = f.n(P.mul(0.6).add(1)).toVar('lkCn');
    const a = smoothstep(nN.mul(12).add(5), nN.mul(22).add(12), o).oneMinus();
    const vc = f.vor(P.div(6.5).add(nN), float(0), float(0.9)).toVar('lkVc'); const cr = smoothstep(0.0, nN.mul(0.04).add(0.06), vc.y).oneMinus().mul(step(0.7, f.edge(vc))).toVar('lkCr'); /* só algumas arestas: fendas, não rede */
    const hot = smoothstep(0.0, nN.mul(4).add(2.5), o).oneMinus().toVar('lkHot'); const pulse = sin(t.mul(0.8).add(vc.z.mul(6.2831))).mul(0.3).add(0.7);
    const burnt = mix(vec3(0.032, 0.028, 0.027), vec3(0.075, 0.062, 0.055), cn).mul(cr.mul(0.25).oneMinus());
    col = burnt.mul(mix(0.06, 1.0, fogK)); alpha = clamp(a.mul(hot.mul(0.22).add(0.78)), 0, 1);
    em = vec3(2.0, 0.42, 0.05).mul(cr).mul(hot).mul(hot).mul(pulse).mul(smoothstep(0.9, 2.5, lkFw).oneMinus().mul(0.6).add(0.4)).add(vec3(1.4, 0.3, 0.03).mul(smoothstep(0.0, 2.2, o).oneMinus()).mul(0.8).mul(smoothstep(0.4, 0.75, f.n(P.mul(0.06).add(vec2(t.mul(0.02), sd)))))).mul(fogK); /* rocha em brasa colada na lava, em trechos */
    rough = hot.mul(-0.25).add(0.9); ht = cn.mul(0.5).sub(cr.mul(0.6));
  } else { /* neve da margem */
    const o = s.negate(); const nN = f.fb(P.mul(0.04).add(sd.mul(5))).toVar('lkNN'); const sp = f.n(P.mul(0.5).add(4)).toVar();
    const thr = nN.mul(nN).mul(15).add(3).toVar(); const ny = normalize(L.normalWorldGeometry).y; /* borda irregular: de 1 a ~20 un da margem; pouca neve no paredão */
    const a = smoothstep(thr.sub(2.5), thr.add(2.0), o).oneMinus().mul(mix(0.3, 1.0, smoothstep(0.5, 0.85, ny))).toVar('lkA');
    col = vec3(0.76, 0.81, 0.88).mul(sp.mul(0.12).add(0.88)).mul(mix(0.06, 1.0, fogK)); alpha = clamp(a, 0, 1).mul(0.95);
    em = vec3(1.7, 1.8, 1.9).mul(glitFn()(P, normalize(cameraPosition.sub(positionWorld)), G.uSunDir)).mul(a).mul(smoothstep(0.6, 1.6, lkFw).oneMinus()).mul(G.uNight.mul(0.6).oneMinus()).mul(fogK);
    rough = float(0.8); ht = nN.mul(0.8).add(sp.mul(0.15));
  }
  O.rough.assign(rough); O.ht.assign(ht); O.em.assign(em); if (alpha) O.alpha.assign(alpha); if (refK) O.refK.assign(refK); O.col.assign(col); return O.col; };
  m.colorNode = Fn(corpo)(); if (decalK) m.opacityNode = O.alpha;
  m.roughnessNode = O.rough; m.metalnessNode = float(0);
  m.normalNode = f.bump(positionView, normalView, vec2(dFdx(O.ht), dFdy(O.ht)).mul(bumpK), faceDirection);
  m.emissiveNode = flash ? O.em.add(diffuseColor.rgb.mul(M5.sample.clarao()).mul(0.8)) : O.em; /* clarões: o mapa de cima acende o gelo e as margens (o plasma já brilha) */
  if (isGelo) { /* reflexo: plano (passe do reflexo) ou céu pelo mapa de ambiente; fresnel exagerado de propósito (gelo polido) */
    const { positionViewDirection, normalWorld } = L; const rk = O.refK, uOn = U.uReflOn;
    m.ardFx = ctx => {
      const nV = normalView; const NdV = clamp(dot(nV, positionViewDirection), 0, 1); const g4 = pow(NdV.oneMinus(), 4).toVar();
      const fr = g4.mul(0.84).add(0.16).toVar(); /* céu: pouco reflexo de cima (o gelo fica fundo e azul) e muito rasante */
      const rc = G.uReflMat.mul(vec4(positionWorld, 1)).toVar(); const ruv = clamp(rc.xy.div(max(rc.w, 1e-4)).add(normalWorld.xz.mul(vec2(0.02, -0.02))), G.uReflBox.xy, G.uReflBox.zw).toVar();
      const on = step(0.5, uOn); const rflP = G.uRefl.sample(ruv).rgb.toVar('lkRflP'); /* amostras fora de ramo (regra da carga: textura dentro de If ou select sai preta no r186); com o passe desligado o mix fica com o céu */
      const isObj = step(G.uReflDepth.sample(ruv).r, 0.99995).mul(on).toVar('lkIsObj'); /* unidades, margens e construções refletem forte: o reflexo aparece sem lavar o azul */
      const rflC = mix(ctx.radiance.mul(1.5), G.uSky.mul(1.3), G.uNight); /* o mapa de ambiente é o céu de dia: à noite vale a cor do céu do quadro */
      const rfl = mix(rflC, rflP, on); const frT = mix(fr, mix(fr, g4.mul(0.5).add(0.5), isObj), on);
      const k = clamp(rk.mul(frT).mul(G.uReflK), 0, 1).toVar('lkK'); const rl = ctx.reflectedLight;
      rl.indirectSpecular.assign(mix(rl.indirectSpecular, rfl.mul(vec3(0.82, 0.94, 1.0)), k)); rl.indirectDiffuse.mulAssign(k.mul(0.6).oneMinus()); rl.directDiffuse.mulAssign(k.mul(0.4).oneMinus());
    };
  }
  return M5.registrar('lago-' + kind, m);
};
/* chão simplificado em volta do gelo, só no passe do reflexo (cor do bioma por vértice) */
M5.aguaProxy = function () { const T = window.THREE_M5; const m = new T.MeshStandardNodeMaterial({ vertexColors: true, roughness: 0.95, metalness: 0.02 }); m.envMapIntensity = 0.22; m.userData.env = 0.22; return M5.registrar('lago-chao-reflexo', m); };
})(globalThis.ARD = globalThis.ARD || {});
