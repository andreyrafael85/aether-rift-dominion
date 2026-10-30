/* Aether Rift: Dominion — Motor 5 (5.0b, fase 2): terreno e mundo em TSL (valem no WebGPU e na reserva WebGL2 do WebGPURenderer).
   - Texturas de detalhe do chão geradas na GPU uma vez na carga (o GEN_FS do terrain3d num passe TSL para dois alvos 512² com mipmaps).
   - Chão completo (o TERR_COLOR do terrain3d): camadas por bioma misturadas pela altura de cada camada, rocha estratificada em projeção
     triplanar com riscos verticais nos paredões, brasa nas fendas do basalto, veios no fundo do abismo, dunas e ondulação da areia,
     cicatrizes, microdetalhe, território, névoa de guerra, nuvem, clarões, a luz da Fenda (5.0a.1: emissivo, sem luz pontual) e o relevo
     fino por derivada (normal perturbada).
   - Adereços do dress3d: vento por peça (aWind, fase pela posição da instância, no espaço da geometria antes da matriz de instância do
     M5.Inst), brilho por vértice (aGlow) com a tinta da instância, folhas de dupla face e névoa de guerra.
   - Céu (o makeSky do world3d): dia, nuvens e estrelas; no Cinturão o modo espaço com a nebulosa assada (src/m5/espaco-min.js), o planeta
     gigante analítico abaixo do horizonte, o halo, as estrelas em três camadas e o sol sem atmosfera.
   Mesmas contas do GLSL do clássico (a mesma imagem, provada na bancada work/bancada-terreno.html). Carga: ruídos em funções de verdade no
   WGSL (Fn().setLayout), variantes por uniform, nenhuma luz. Custo: amostras sem a matriz de textura e só onde a camada que as usa existe
   (derivadas explícitas dentro dos ramos por pixel). Só visual: nada aqui lê ou muda a simulação. */
(function (ARD) {
'use strict';
const M5 = ARD.m5 = ARD.m5 || {};
const T = () => window.THREE_M5, L = () => window.TSL;
const QS = new URLSearchParams(typeof location !== 'undefined' ? location.search : ''); const PAR0 = +(QS.get('m5par0') || 50), PAR1 = +(QS.get('m5par1') || 150); /* paredão do Cinturão: os mesmos ajustes de src/m5/materiais.js */
M5.fase1 = { chao: M5.chao, adereco: M5.adereco, ceu: M5.ceu, terrUniforms: M5.terrUniforms }; /* os materiais básicos da fundação (só para medir e comparar: ?chao=fase1 na bancada) */
/* porte da fase 2: texturas de detalhe do chão em TSL (o render3d gera na carga) e os itens terrain3d, dress3d e world3d saem das pendências */
M5.porte = Object.assign(M5.porte || {}, { detalheChao: true });
if (M5.pendencias) M5.pendencias = M5.pendencias.filter(p => !/^(terrain3d|dress3d|world3d)$/.test(p.modulo));

/* ---------- ruídos 2D periódicos do gerador (o GEN_FS do terrain3d), em funções de verdade no WGSL ---------- */
let RD = null;
function ruido2() {
  if (RD) return RD; const { Fn, float, vec2, vec3, floor, fract, dot, mix, mod, sqrt, select } = L();
  const hs = Fn(([p0]) => { const p = fract(vec2(p0).mul(vec2(0.1031, 0.1030))).toVar(); p.addAssign(dot(p, p.yx.add(33.33))); return fract(p.x.add(p.y).mul(p.x)); }).setLayout({ name: 'ardDetHs', type: 'float', inputs: [{ name: 'p0', type: 'vec2' }] });
  const hs2 = Fn(([p0]) => { const q = fract(vec3(p0.x, p0.y, p0.x).mul(vec3(0.1031, 0.1030, 0.0973))).toVar(); q.addAssign(dot(q, q.yzx.add(33.33))); return fract(vec2(q.x, q.x).add(q.yz).mul(q.zy)); }).setLayout({ name: 'ardDetHs2', type: 'vec2', inputs: [{ name: 'p0', type: 'vec2' }] });
  const vno = Fn(([p, P]) => { const i = floor(p), f = fract(p), u = f.mul(f).mul(f.mul(-2).add(3)), PP = vec2(P, P);
    const a = hs(mod(i, PP)), b = hs(mod(i.add(vec2(1, 0)), PP)), c = hs(mod(i.add(vec2(0, 1)), PP)), d = hs(mod(i.add(vec2(1, 1)), PP)); return mix(mix(a, b, u.x), mix(c, d, u.x), u.y); })
    .setLayout({ name: 'ardDetVno', type: 'float', inputs: [{ name: 'p', type: 'vec2' }, { name: 'P', type: 'float' }] });
  const fbm = n => Fn(([p0, P0]) => { let p = vec2(p0), P = float(P0), v = float(0), a = 0.5, t = 0; for (let o = 0; o < n; o++) { v = v.add(vno(p, P).mul(a)); t += a; p = p.mul(2); P = P.mul(2); a *= 0.5; } return v.div(t); })
    .setLayout({ name: 'ardDetFbm' + n, type: 'float', inputs: [{ name: 'p0', type: 'vec2' }, { name: 'P0', type: 'float' }] });
  const voro = Fn(([p, P]) => { const i = floor(p), f = fract(p), PP = vec2(P, P); let f1 = float(9), f2 = float(9), id = float(0); /* a menor e a segunda menor distância e o id da célula, como o voro do GLSL */
    for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) { const g = vec2(x, y); const c = mod(i.add(g), PP); const r = g.add(hs2(c)).sub(f); const d = dot(r, r); const lt1 = d.lessThan(f1);
      const nf2 = select(lt1, f1, select(d.lessThan(f2), d, f2)); id = select(lt1, hs(c.add(7)), id); f1 = select(lt1, d, f1); f2 = nf2; }
    return vec3(sqrt(f1), sqrt(f2), id); }).setLayout({ name: 'ardDetVoro', type: 'vec3', inputs: [{ name: 'p', type: 'vec2' }, { name: 'P', type: 'float' }] });
  RD = { hs, hs2, vno, voro, f2: fbm(2), f3: fbm(3), f4: fbm(4), f5: fbm(5) }; return RD;
}
/* o gerador: A = ondulação, seixo, fenda, macio; B = musgo, cinza, grão de rocha, macro. Um shader só, a textura escolhida pelo uniform (ramo uniforme) */
function genNode(qual) {
  const { Fn, If, float, vec4, fract, mix, smoothstep, abs, clamp, step, select, uv } = L(); const N = ruido2(); const fb = { 2: N.f2, 3: N.f3, 4: N.f4, 5: N.f5 }; const fbm = (p, P, n) => fb[n](p, float(P));
  return Fn(() => { const p = uv(); const out = vec4(0).toVar('dOut');
    If(qual.lessThan(0.5), () => {
      const w = fbm(p.mul(4), 4, 3); const fr = fract(p.y.add(w.sub(0.5).mul(0.1)).mul(36));
      const rip = mix(select(fr.lessThan(0.7), smoothstep(0.0, 0.7, fr), float(1).sub(smoothstep(0.7, 1.0, fr))), fbm(p.mul(64), 64, 2), 0.18); /* sobe devagar e cai rápido */
      const v = N.voro(p.mul(20), float(20)); const v3 = N.voro(p.mul(44), float(44)); const peb = float(1).sub(smoothstep(0.0, v.z.mul(0.28).add(0.5), v.x)).mul(v.z.mul(0.45).add(0.55)).max(float(1).sub(smoothstep(0.0, 0.42, v3.x)).mul(0.55).mul(step(0.35, v3.z)));
      const v2 = N.voro(p.mul(6), float(6)); const crack = float(1).sub(smoothstep(0.0, 0.07, v2.y.sub(v2.x))).mul(fbm(p.mul(24), 24, 2).mul(0.4).add(0.6));
      out.assign(vec4(rip, peb, crack, fbm(p.mul(8), 8, 5)));
    }).Else(() => {
      const tuft = smoothstep(0.42, 0.72, fbm(p.mul(10), 10, 4)); const vv = N.voro(p.mul(52), float(52)); const dots = float(1).sub(smoothstep(0.0, 0.38, vv.x)).mul(step(0.5, vv.z)); const moss = clamp(tuft.mul(0.75).add(dots.mul(0.45)).add(fbm(p.mul(96), 96, 2).mul(0.2)), 0.0, 1.0);
      const ash = fbm(p.mul(64), 64, 3).mul(0.55).add(fbm(p.mul(12), 12, 4).mul(0.45));
      const rg0 = float(1).sub(abs(fbm(p.mul(10), 10, 5).mul(2).sub(1))); const rg = rg0.mul(rg0).mul(0.7).add(fbm(p.mul(48), 48, 3).mul(0.3));
      out.assign(vec4(moss, ash, rg, fbm(p.mul(3), 3, 5)));
    });
    return out; })();
}
/* gera as duas texturas na GPU (QuadMesh: uv.y = 0 no alto do alvo, a mesma convenção da amostragem: a textura sai igual à do clássico) */
M5.texturasDetalhe = function (renderer) {
  const Tm = T(), N = 512; const t0 = performance.now(); const { uniform, texture } = L();
  const mk = nome => { const rt = new Tm.RenderTarget(N, N, { type: Tm.UnsignedByteType, generateMipmaps: true, minFilter: Tm.LinearMipmapLinearFilter, magFilter: Tm.LinearFilter, wrapS: Tm.RepeatWrapping, wrapT: Tm.RepeatWrapping, depthBuffer: false }); rt.texture.colorSpace = Tm.NoColorSpace; rt.texture.name = nome; return rt; };
  const a = mk('ard-detalhe-a'), b = mk('ard-detalhe-b'), prev = renderer.getRenderTarget(); const qual = uniform(0);
  const m = new Tm.MeshBasicNodeMaterial({ depthTest: false, depthWrite: false }); m.fog = false; m.toneMapped = false; m.fragmentNode = genNode(qual); /* fragmentNode: o alfa (macio, macro) sai como foi calculado (no colorNode o material opaco força alfa 1) */
  M5.registrar('detalhe', m); const q = new Tm.QuadMesh(m);
  qual.value = 0; renderer.setRenderTarget(a); q.render(renderer); qual.value = 1; renderer.setRenderTarget(b); q.render(renderer);
  renderer.setRenderTarget(prev); m.dispose();
  M5.detalheMs = Math.round(performance.now() - t0);
  M5.tex.detalheA = texture(a.texture); M5.tex.detalheB = texture(b.texture);
  return { a: a.texture, b: b.texture, rts: [a, b] };
};

/* amostra sem a matriz de textura (o .sample() do r186 herda updateMatrix e faz mat3 × uv a cada leitura, com um uniform por leitura atualizado por objeto
   a cada quadro): as texturas do chão não têm repetição nem deslocamento, como no GLSL do clássico (texture2D direto) */
const amostra = (tn, uv) => tn.sample(uv).setUpdateMatrix(false);
/* amostra dentro de ramo por pixel: uv e derivadas calculados fora (textureSampleGrad vale em fluxo não uniforme; nada de amostra com derivada implícita no ramo) */
const coord = uv => { const { dFdx, dFdy } = L(); const u = uv.toVar(); return { uv: u, gx: dFdx(u).toVar(), gy: dFdy(u).toVar() }; };
const amostraG = (tn, c) => tn.sample(c.uv).grad(c.gx, c.gy).setUpdateMatrix(false);
const amostras = () => { const X = M5.tex, U = M5.u, { vec2, step, positionWorld } = L(); const muv = p => vec2(p.x.div(U.mundo), p.z.negate().div(U.mundo));
  return { nevoa: (p = positionWorld) => amostra(X.nevoa, muv(p)).r, territorio: (p = positionWorld) => amostra(X.territorio, muv(p)), cicatrizes: (p = positionWorld) => amostra(X.cicatrizes, muv(p)),
    nuvem: (p = positionWorld) => amostra(X.nuvem, muv(p).mul(5).add(vec2(U.tempo.mul(0.006), U.tempo.mul(0.0035)))).r,
    clarao: (p = positionWorld) => { const fu = p.xz.sub(U.claraoRet.xy).div(U.claraoRet.zw); const dentro = step(0, fu.x).mul(step(0, fu.y)).mul(step(fu.x, 1)).mul(step(fu.y, 1)); const fl = amostra(X.clarao, fu).rgb.mul(dentro); return fl.div(fl.mul(0.3).add(1)); } }; };

/* ---------- uniforms do chão no formato do terrU do render3d (cada um com .value); uTexA/uTexB = texturas de detalhe da GPU ---------- */
M5.terrUniforms = function (tx) {
  const { texture } = L(); const U = M5.u, X = M5.tex;
  if (tx.fog) X.nevoa.value = tx.fog; if (tx.terr) X.territorio.value = tx.terr; if (tx.scar) X.cicatrizes.value = tx.scar; if (tx.cloud) X.nuvem.value = tx.cloud; if (tx.micro) X.micro.value = tx.micro;
  const nz = X.nuvem ? X.nuvem : texture(tx.cloud);
  return { uFlash: X.clarao, uFlashR: U.claraoRet, scarMap: X.cicatrizes, uTexA: X.detalheA || nz, uTexB: X.detalheB || nz, fogMap: X.nevoa, terrMap: X.territorio, cloudMap: X.nuvem, microMap: X.micro, uNear: U.perto, uCloudT: U.tempo, uCloudK: U.nuvemK, uTime: U.tempo, uRift: U.fenda, worldSize: U.mundo };
};

/* ---------- chão completo: o TERR_COLOR do terrain3d em TSL ----------
   o: { fora (cordilheira de mesas além do mapa: sem névoa de guerra, neve no alto), leve (sem projeção triplanar: celular e Baixa),
        vazio (Cinturão: corta pelo mapa do vazio, M5.vazioMascara; borda gasta e pontes de cascalho como no clássico; paredão para a poeira de espaço) }
   Luz igual à do clássico: oclusão de cavidade só na luz indireta (difusa × aoc, especular × mix(0,4; 1; aoc)), relevo fino pela derivada da altura das camadas,
   clarões e a luz da Fenda (M5.luzFendaChao, que era uma PointLight) no emissivo. */
let TerrLM = null; /* modelo de luz do chão: a oclusão de cavidade como no remendo aomap do clássico */
let HB = null; const ardHB = (h, w) => { if (!HB) { const { Fn, vec4, max, step } = L(); HB = Fn(([h0, w0]) => { const s = h0.add(w0.mul(1.6)).mul(step(vec4(0.001), w0)).toVar(); const mm = max(max(s.x, s.y), max(s.z, s.w)).sub(0.22); const k = max(s.sub(mm), vec4(0)).toVar(); return k.div(max(k.x.add(k.y).add(k.z).add(k.w), 0.0001)); })
  .setLayout({ name: 'ardChaoHB', type: 'vec4', inputs: [{ name: 'h0', type: 'vec4' }, { name: 'w0', type: 'vec4' }] }); } return HB(h, w); }; /* mistura pela altura de cada camada */
M5.chao = function (U, o) {
  o = o || {}; const Tm = T(); const TL = L();
  const { Fn, If, float, vec2, vec3, vec4, mix, smoothstep, clamp, max, abs, floor, fract, sin, dot, length, step, select, cross, sign, inverseSqrt, dFdx, dFdy, positionWorld, positionView, normalView, normalWorld, normalWorldGeometry, faceDirection } = TL;
  const m = new Tm.MeshStandardNodeMaterial({ roughness: 0.9, metalness: 0.02 }); m.envMapIntensity = 0.22;
  if (!TerrLM) TerrLM = class extends Tm.PhysicalLightingModel { ambientOcclusion(builder) { const { ambientOcclusion, reflectedLight } = builder.context; reflectedLight.indirectDiffuse.mulAssign(ambientOcclusion); reflectedLight.indirectSpecular.mulAssign(mix(0.4, 1.0, ambientOcclusion)); } };
  m.setupLightingModel = () => new TerrLM();
  const bio = M5.attr('bio', vec4(0, 1, 0, 0)), aoc = M5.attr('aoc', vec2(1, 0));
  const TA = U.uTexA, TB = U.uTexB, W = U.worldSize || M5.u.mundo, rift = U.uRift || M5.u.fenda, tempo = U.uTime || M5.u.tempo;
  const vMap = o.vazio ? M5.tex.vazio : null; /* 5.0a.1: mapa do vazio compartilhado (o render3d põe o do espaço mínimo; o space3d portado pode trocar o .value) */
  const pleno = !!(o.vazio && M5.espacoPleno && M5.espacoPleno()); /* 5.0b (junção): com o space3d completo na partida (src/m5/espaco.js), o chão corta como o ARD_VAZIO do clássico: a 18 da borda e abaixo de −90, sem o paredão para a poeira (a beirada, o paredão e as raízes são do space3d) */
  const m2 = (a, b, c, d, v) => vec2(v.x.mul(a).add(v.y.mul(c)), v.x.mul(b).add(v.y.mul(d))); /* mat2(a, b, c, d) * v do GLSL (colunas) */
  /* 5.0b.1: o chão e o chão de fora (as mesas além do mapa) num shader só: o que só um dos dois tem passa a pesar por um uniform do material (uFora:
     0 no chão, 1 nas mesas) em vez de um if do JavaScript, com pesos exatos (×1 e ×0, mix com 0 ou 1): a mesma imagem e o mesmo WGSL (um módulo de
     ~45 KB e um pipeline a menos). ?m5fora=1 volta aos dois shaders (medida) */
  const UNI = !(QS.get('m5fora') === '1'), uFora = TL.uniform(o.fora ? 1 : 0), kf = float(1).sub(uFora); const dentro = UNI || !o.fora, fora = UNI || o.fora;
  const A = amostras(); const saida = b => b.__ardChao || (b.__ardChao = {}); /* saídas da cor para as outras partes do material (rugosidade, normal, emissivo), por montagem */
  const cor = Fn((b) => { const S = saida(b);
    const pw = positionWorld; const gp = vec2(pw.x, pw.z.negate()).toVar('tGp');
    const vd = length(positionView); const nearK = float(1).sub(smoothstep(260.0, 1300.0, vd)).toVar('tNear');
    const Bw = bio.div(max(bio.x.add(bio.y).add(bio.z).add(bio.w), 0.0001)).toVar('tBw');
    const wn = normalWorldGeometry; const slope = float(1).sub(clamp(wn.y, 0.0, 1.0)).toVar('tSlope'); const cav = aoc.y;
    const Bk = amostra(TB, gp.div(310.0).add(0.53)).toVar('tBk'); const wr = m2(0.94, -0.34, 0.34, 0.94, gp).add(Bk.rg.sub(0.5).mul(7.0));
    /* escalas em unidades do mapa: ondulação ~2,6 (90/36), seixo ~1,5, fenda ~5, tufo ~3 */
    const Ap = amostra(TA, gp.div(31.0).add(0.21)).toVar('tAp'), As = amostra(TA, gp.div(150.0).add(0.37)).toVar('tAs'), Bm = amostra(TB, gp.div(1900.0).add(0.11)).toVar('tBm');
    /* cada textura só onde a camada que a usa existe (a mesma imagem do clássico, que lê todas em todo pixel): ondulação no gelo e no deserto,
       musgo e cinza na tundra e no basalto, grão e riscos da rocha só onde alguma rocha pesa (encosta ou placas: fora disso a altura dela não entra na mistura) */
    const cAr = coord(wr.div(94.0)), cBt = coord(gp.div(34.0)), cBt2 = coord(m2(0.6, -0.8, 0.8, 0.6, gp).div(91.0).add(0.41));
    const Ar = vec4(0).toVar('tAr'), Bt = vec4(0).toVar('tBt'), Bt2 = vec4(0).toVar('tBt2');
    If(Bw.x.add(Bw.y).greaterThan(0.001), () => { Ar.assign(amostraG(TA, cAr)); });
    If(Bw.z.add(Bw.w).greaterThan(0.001), () => { Bt.assign(amostraG(TB, cBt)); Bt2.assign(amostraG(TB, cBt2)); });
    const macro = Bm.a, mid = Bk.a;
    const fk = nearK.mul(0.65).add(0.35); const hSand = mix(As.r, Ar.r.mul(0.75).add(As.r.mul(0.25)), fk).toVar(), hGrav = mix(As.a, Ap.g, fk).toVar(), hCrk = Ap.b.mul(fk).toVar(), hSnow = As.a.mul(0.7).add(Ap.a.mul(0.3)).toVar(), hMoss = mix(Bt2.r, Bt.r.mul(0.55).add(Bt2.r.mul(0.45)), fk).mul(Bk.r.mul(0.5).add(0.75)).toVar(), hAsh = mix(Bt2.g, Bt.g, fk).toVar(), soft = As.a;
    const band = pw.y.div(3.4).add(Bm.r.sub(0.5).mul(1.4)).add(soft.sub(0.5).mul(0.5)); const bi = floor(band), bf = fract(band); const bt = fract(sin(bi.mul(12.9898).add(78.233)).mul(43758.5453)).toVar('tBt0');
    const rk = smoothstep(0.15, 0.38, slope.add(max(cav.negate(), 0.0).mul(0.16)).add(macro.sub(0.5).mul(0.12))).toVar('tRk');
    const temRocha = max(rk, smoothstep(0.6, 0.74, mid)).greaterThan(0.0); /* rocha de encosta (rk) ou placas (mid > 0,6) em algum bioma */
    const gr = float(0).toVar('tGr'), streak = float(1).toVar('tStreak');
    if (o.leve) { const cG = coord(gp.div(40.0)); If(temRocha, () => { gr.assign(amostraG(TB, cG).b); }); }
    else { const an0 = abs(wn); const an = an0.div(an0.x.add(an0.y).add(an0.z)).toVar('tAn');
      const c1 = coord(pw.zy.div(40.0)), c2 = coord(pw.xz.div(40.0)), c3 = coord(pw.xy.div(40.0)), c4 = coord(vec2(pw.z.div(37.0), pw.y.div(210.0))), c5 = coord(vec2(pw.x.div(37.0), pw.y.div(210.0)).add(0.3));
      If(temRocha, () => { gr.assign(amostraG(TB, c1).b.mul(an.x).add(amostraG(TB, c2).b.mul(an.y)).add(amostraG(TB, c3).b.mul(an.z))); /* grão de rocha nas três projeções */
        streak.assign(amostraG(TB, c4).a.mul(an.x).add(amostraG(TB, c5).a.mul(an.z)).add(an.y.mul(0.5)).mul(0.34).add(0.8)); }); } /* riscos verticais nos paredões */
    const ledge = smoothstep(0.0, 0.1, bf).mul(float(1).sub(smoothstep(0.82, 1.0, bf)));
    const hRock = gr.mul(0.35).add(0.45).add(ledge.mul(0.2)).toVar('tHRock');
    const vmS = vMap ? amostra(vMap, gp.div(W)).toVar('tVm') : null;
    const alb = vec3(0).toVar('tAlb'), rough = float(0).toVar('tRough'), hgt = float(0).toVar('tHgt'), tEmis = vec3(0).toVar('tEmis');
    /* gelo: neve, gelo liso nas baixadas, rocha azulada nas encostas */
    const ws = m2(0.94, -0.34, 0.34, 0.94, gp); const cSas = coord(vec2(ws.x.div(260.0), ws.y.div(46.0)).add(0.17));
    If(Bw.x.greaterThan(0.001), () => { const rpG = smoothstep(0.6, 0.7, mid).mul(0.85); const sas = amostraG(TA, cSas).a.toVar(); /* dunas de neve */
      const k = ardHB(vec4(hSnow.mul(0.6).add(sas.mul(0.4)), soft.mul(0.5).add(0.2), hRock, 0.0), vec4(1.0, smoothstep(0.12, 0.5, cav.add(mid.sub(0.5).mul(0.5))).mul(0.9), max(rk, rpG).mul(1.2), 0.0)).toVar();
      const snow = mix(vec3(0.42, 0.5, 0.63), vec3(0.74, 0.79, 0.86), hSnow.mul(0.45).add(sas.mul(0.35)).add(Ar.r.mul(0.2).mul(fk))).mul(mix(vec3(1.0), vec3(0.72, 0.84, 1.08), clamp(cav.mul(1.6).add(float(1).sub(aoc.x).mul(2.0)), 0.0, 1.0)));
      const ice = mix(vec3(0.38, 0.52, 0.66), vec3(0.6, 0.73, 0.84), soft); const rock = mix(vec3(0.2, 0.23, 0.28), vec3(0.36, 0.4, 0.46), bt).mul(gr.mul(0.4).add(0.72)).mul(streak);
      alb.addAssign(snow.mul(k.x).add(ice.mul(k.y)).add(rock.mul(k.z)).mul(Bw.x)); rough.addAssign(dot(k, vec4(0.62, 0.2, 0.86, 0.0)).mul(Bw.x)); hgt.addAssign(dot(k, vec4(hSnow.mul(0.1).add(sas.mul(0.35)).add(Ar.r.mul(0.16).mul(fk)), 0.03, hRock.mul(0.7), 0.0)).mul(Bw.x)); });
    /* rocha: deserto de pedra quente, areia nas baixadas e dunas, cascalho, placas e paredões de rocha estratificada */
    If(Bw.y.greaterThan(0.001), () => { const rp = smoothstep(0.64, 0.74, mid).mul(0.7);
      const k = ardHB(vec4(hSand, hGrav, hRock, soft), vec4(smoothstep(-0.15, 0.35, cav).mul(0.65).add(0.35), float(1).sub(smoothstep(0.05, 0.4, cav)).mul(0.5).add(smoothstep(0.55, 0.7, Bk.g).mul(0.4)), max(rk, rp).mul(1.2), 0.25)).toVar();
      const sand = mix(vec3(0.5, 0.36, 0.22), vec3(0.78, 0.62, 0.42), As.r.mul(0.55).add(soft.mul(0.25)).add(0.1)).mul(macro.mul(0.2).add(0.9)).mul(Ar.r.mul(0.12).mul(fk).add(0.93)); const grav = mix(vec3(0.36, 0.27, 0.19), vec3(0.64, 0.52, 0.39), hGrav);
      const rock = mix(vec3(0.42, 0.26, 0.17), vec3(0.66, 0.5, 0.36), bt).mul(gr.mul(0.42).add(0.7)).mul(streak); const dirt = mix(vec3(0.34, 0.26, 0.19), vec3(0.5, 0.4, 0.3), soft).mul(float(1).sub(hCrk.mul(0.3)));
      alb.addAssign(sand.mul(k.x).add(grav.mul(k.y)).add(rock.mul(k.z)).add(dirt.mul(k.w)).mul(Bw.y)); rough.addAssign(dot(k, vec4(0.92, 0.88, 0.84, 0.94)).mul(Bw.y)); hgt.addAssign(dot(k, vec4(Ar.r.mul(0.28).mul(fk).add(As.r.mul(0.1)), hGrav.mul(0.45), hRock.mul(0.7), soft.mul(0.1).sub(hCrk.mul(0.3)))).mul(Bw.y)); });
    /* tundra: musgo e capim baixo, terra nas baixadas, cascalho, rocha nas encostas */
    If(Bw.z.greaterThan(0.001), () => {
      const k = ardHB(vec4(hMoss, soft, hGrav, hRock), vec4(float(1).sub(smoothstep(0.15, 0.5, cav)).mul(0.85).mul(mid.mul(0.35).add(0.65)), smoothstep(0.0, 0.4, cav).mul(0.7).add(0.25), smoothstep(0.6, 0.72, Bk.g).mul(0.5), rk.mul(1.2))).toVar();
      const moss = mix(vec3(0.095, 0.125, 0.06), vec3(0.205, 0.235, 0.115), hMoss).mul(mix(vec3(1.0), vec3(1.12, 1.0, 0.72), smoothstep(0.55, 0.8, macro))); const dirt = mix(vec3(0.22, 0.17, 0.12), vec3(0.36, 0.29, 0.21), soft).mul(float(1).sub(hCrk.mul(0.3)));
      const grav = mix(vec3(0.25, 0.24, 0.22), vec3(0.47, 0.45, 0.41), hGrav); const rock = mix(vec3(0.26, 0.25, 0.23), vec3(0.44, 0.42, 0.38), bt).mul(gr.mul(0.4).add(0.72)).mul(streak);
      alb.addAssign(moss.mul(k.x).add(dirt.mul(k.y)).add(grav.mul(k.z)).add(rock.mul(k.w)).mul(Bw.z)); rough.addAssign(dot(k, vec4(0.95, 0.93, 0.86, 0.85)).mul(Bw.z)); hgt.addAssign(dot(k, vec4(hMoss.mul(0.25), soft.mul(0.1).sub(hCrk.mul(0.25)), hGrav.mul(0.45), hRock.mul(0.7))).mul(Bw.z)); });
    /* basalto: cinza, rocha negra, lascas de obsidiana e fendas em brasa perto da Fenda */
    If(Bw.w.greaterThan(0.001), () => {
      const k = ardHB(vec4(hAsh, hRock, hGrav, 0.0), vec4(0.85, rk.mul(1.3).add(smoothstep(0.6, 0.7, mid).mul(0.5)), smoothstep(0.4, 0.7, Bk.g).mul(0.35), 0.0)).toVar();
      const ash = mix(vec3(0.028, 0.026, 0.03), vec3(0.075, 0.068, 0.074), hAsh); const rock = mix(vec3(0.022, 0.02, 0.026), vec3(0.07, 0.06, 0.068), bt).mul(gr.mul(0.5).add(0.7)); const obs = vec3(0.016, 0.016, 0.024);
      alb.addAssign(ash.mul(k.x).add(rock.mul(k.y)).add(obs.mul(k.z)).mul(Bw.w)); rough.addAssign(dot(k, vec4(0.96, 0.8, 0.22, 0.0)).mul(Bw.w)); hgt.addAssign(dot(k, vec4(hAsh.mul(0.15), hRock.mul(0.7), hGrav.mul(0.4), 0.0)).mul(Bw.w));
      if (dentro) { const rd = length(gp.sub(rift)); const rf = float(1).sub(smoothstep(260.0, 640.0, rd)).mul(UNI ? kf : float(1)); const cw = As.b; /* 5.0b.1: ×(1 − uFora) */
        const ck = smoothstep(0.62, 0.92, cw).mul(smoothstep(0.52, 0.68, mid)).mul(rf).mul(float(1).sub(smoothstep(0.1, 0.28, slope))).mul(Bk.r.mul(0.4).add(0.6)); /* fendas largas (~25 de célula), só em manchas e no chão plano: brasa em veios */
        const pulse = sin(tempo.mul(1.3).add(gp.x.mul(0.013)).add(gp.y.mul(0.017))).mul(0.35).add(0.65);
        tEmis.addAssign(vec3(1.15, 0.28, 0.7).mul(ck.mul(pulse).mul(1.15).mul(Bw.w))); alb.mulAssign(float(1).sub(Bw.w.mul(ck).mul(0.45))); } });
    if (dentro) {
      /* abismo da Fenda: as paredes fundas recebem a luz que sobe lá de baixo (veios); bordas do smoothstep em ordem (invertidas são erro no WGSL) */
      { const deep = float(1).sub(smoothstep(-225.0, -80.0, pw.y)).mul(float(1).sub(smoothstep(230.0, 300.0, length(gp.sub(rift))))).mul(UNI ? kf : float(1)); /* 5.0b.1: ×(1 − uFora) */ const fl = sin(tempo.mul(0.9).add(pw.y.mul(0.05)).add(gp.x.mul(0.02))).mul(0.4).add(0.6); const vein = smoothstep(0.6, 0.9, Bk.b).add(smoothstep(0.6, 0.9, As.b).mul(0.3));
        tEmis.addAssign(vec3(1.2, 0.3, 0.75).mul(deep.mul(deep).mul(deep)).mul(vein.mul(0.9).add(0.12)).mul(fl).mul(1.6)); alb.mulAssign(float(1).sub(deep.mul(0.6))); }
      /* cicatrizes: rastros (chão compactado; na neve, sombra azulada), queimado com fuligem, cratera e brasa recente */
      { const sc = (UNI ? A.cicatrizes().mul(kf) : A.cicatrizes()).toVar('tSc'); /* 5.0b.1: nas mesas, cicatriz 0 (nada muda) */ const tr = sc.r; alb.mulAssign(float(1).sub(tr.mul(Bw.y.mul(0.16).add(Bw.z.mul(0.12)).add(0.34)))); alb.assign(mix(alb, alb.mul(vec3(0.76, 0.85, 1.08)), tr.mul(Bw.x).mul(0.7)));
        const bu = smoothstep(0.0, 0.85, sc.g); alb.assign(mix(alb, vec3(0.06, 0.05, 0.042).mul(soft.mul(0.5).add(0.75)), clamp(bu.mul(0.85), 0.0, 0.85))); rough.assign(mix(rough, 0.6, bu.mul(0.4))); hgt.addAssign(tr.mul(-0.18).sub(sc.b.mul(1.6)));
        tEmis.addAssign(vec3(1.4, 0.45, 0.12).mul(smoothstep(0.35, 1.0, sc.a)).mul(sin(tempo.mul(9.0).add(gp.x.mul(0.7))).mul(0.35).add(0.65)).mul(hCrk.mul(0.5).add(0.5))); }
    }
    alb.mulAssign(macro.mul(0.28).add(0.86)); alb.mulAssign(mix(vec3(1.0), vec3(1.06, 1.0, 0.92), smoothstep(0.4, 0.8, mid).mul(0.6)));
    if (fora) { const sl = smoothstep(250.0, 340.0, pw.y.add(macro.sub(0.5).mul(90.0))).mul(float(1).sub(smoothstep(0.35, 0.6, slope))).mul(UNI ? uFora : float(1)); /* 5.0b.1: ×uFora */ alb.assign(mix(alb, vec3(0.78, 0.82, 0.88).mul(soft.mul(0.1).add(0.9)), sl)); rough.assign(mix(rough, 0.7, sl)); } /* neve no alto das montanhas distantes */
    const CG = M5.ganchos && M5.ganchos.chao; if (CG && CG.cor) { const nc = CG.cor({ m, o, alb, Bw, gp }); if (nc) alb.assign(nc); } /* gancho da fase 2 (camadas extras) */
    const dif = alb.mul(mix(0.72, 1.0, aoc.x)).toVar('tDif');
    const DBG = +(QS.get('terrdbg') || 0); /* ?terrdbg=N: os mesmos modos de diagnóstico do clássico (1 bioma, 2 cavidade, 3 curvatura, 4 texturas, 5 rugosidade, 7 relevo fino) */
    if (DBG) { if (DBG === 1) dif.assign(Bw.xyz); else if (DBG === 2) dif.assign(vec3(aoc.x)); else if (DBG === 3) dif.assign(vec3(aoc.y.mul(0.5).add(0.5))); else if (DBG === 4) dif.assign(vec3(Ar.r, Ap.g, Bt.r)); if (DBG !== 5) rough.assign(1.0); if (DBG !== 7) hgt.assign(0.0); }
    if (o.vazio) { /* 4.3h: Cinturão — o chão vira rocha gasta perto do corte (encontra a beirada do espaço) e as pontes ganham cascalho; bordas do smoothstep em ordem */
      const esd = vmS.r.sub(0.5).mul(128.0), ponte = vmS.g; const crumb = smoothstep(0.3, 0.75, Ap.g.add(As.r.sub(0.5).mul(0.7)));
      const lip = float(1).sub(smoothstep(19.0, 34.0, esd.add(crumb.sub(0.5).mul(8.0)))); const pale = mix(dif, vec3(dot(dif, vec3(0.3333))).mul(1.12).add(0.04), 0.5).mul(crumb.mul(0.28).add(0.84)); dif.assign(mix(dif, pale, lip.mul(0.65)));
      dif.assign(mix(dif, mix(vec3(0.27, 0.245, 0.22), vec3(0.47, 0.43, 0.38), Ap.g).mul(macro.mul(0.4).add(0.8)), ponte.mul(0.5).mul(smoothstep(18.0, 26.0, esd))));
      if (!pleno) { const paredao = smoothstep(PAR0, PAR1, pw.y.negate()); dif.mulAssign(float(1).sub(paredao)); rough.assign(mix(rough, 0.85, paredao)); tEmis.addAssign(vec3(0.006, 0.009, 0.022).mul(float(1).sub(M5.u.noite.mul(0.4))).mul(paredao)); } } /* 5.0a.1: sem o space3d, o paredão de rocha vai para a poeira escura do espaço perto do fundo; 5.0b (junção): com o space3d, sem ele (como o clássico) */
    const mh = float(0).toVar('tMh');
    if (dentro) {
      const wuv = vec2(gp.x.div(W), gp.y.div(W)); /* microdetalhe de perto (seixos, tom, fendas) */ const nk = UNI ? U.uNear.mul(kf) : U.uNear; /* 5.0b.1: nas mesas, sem microdetalhe */
      const mt = U.microMap || M5.tex.micro;
      If(U.uNear.greaterThan(0.0), () => { const m1 = amostra(mt, wuv.mul(260.0)).rgb.toVar(), m2v = amostra(mt, wuv.mul(84.0).add(0.31)).rgb.toVar(); const pe = max(m1.r.mul(0.6), m2v.r); /* ramo uniforme (a câmera inteira): de longe nem amostra */
        dif.mulAssign(mix(float(1), mix(m1.g, m2v.g, step(0.25, m2v.r)).mul(0.28).add(0.86).mul(float(1).sub(max(m1.b, m2v.b.mul(0.8)).mul(0.35))).mul(pe.mul(0.1).add(1.0)), nk.mul(0.7)));
        mh.assign(m1.r.mul(0.3).add(m2v.r.mul(0.7)).sub(m1.b.add(m2v.b).mul(0.25)).mul(nk)); });
      const tc = A.territorio(); dif.assign(mix(dif, tc.rgb, tc.a.mul(0.14).mul(UNI ? kf : float(1)))); const fv = A.nevoa(); dif.mulAssign(UNI ? mix(mix(0.06, 1.0, fv), 1.0, uFora) : mix(0.06, 1.0, fv)); tEmis.mulAssign(UNI ? mix(fv, 1.0, uFora) : fv); /* 5.0b.1: território e névoa de guerra só no chão (nas mesas, ×1) */
    }
    dif.mulAssign(float(1).sub(U.uCloudK.mul(0.2).mul(float(1).sub(A.nuvem())))); /* sombra de nuvem no material (0 quando a bruma do pós já faz) */
    S.rough = rough; S.tH = hgt.mul(mix(0.25, 1.0, nearK)).toVar('tH'); S.mh = mh; S.tEmis = tEmis; S.wn = wn;
    return dif;
  });
  const dif = cor();
  m.colorNode = dif;
  m.roughnessNode = Fn((b) => saida(b).rough)(); /* a cor monta antes (setupDiffuseColor) e deixa as variáveis prontas */
  m.aoNode = aoc.x;
  /* relevo fino por derivada (o ardTPerturb do clássico, sem normalize de vetor nulo): tH das camadas em unidades do mapa + microdetalhe */
  m.normalNode = Fn((b) => { const S = saida(b);
    const dh = vec2(dFdx(S.tH), dFdy(S.tH)).add(vec2(dFdx(S.mh), dFdy(S.mh)).mul(0.5)); const sp = positionView, sn = normalView;
    const sx0 = dFdx(sp), sy0 = dFdy(sp); const sx = sx0.mul(inverseSqrt(max(dot(sx0, sx0), 1e-24))), sy = sy0.mul(inverseSqrt(max(dot(sy0, sy0), 1e-24)));
    const r1 = cross(sy, sn), r2 = cross(sn, sx); const det = dot(sx, r1).mul(faceDirection); const g = sign(det).mul(r1.mul(dh.x).add(r2.mul(dh.y)));
    const n = sn.mul(abs(det)).sub(g); const l2 = dot(n, n); return select(l2.greaterThan(1e-12), n.mul(inverseSqrt(max(l2, 1e-30))), sn);
  })();
  /* clarões no chão (compressão suave; encosta recebe menos) e a luz da Fenda (5.0a.1: era uma PointLight; difusa de Lambert com 1/d² na normal final, como a luz do clássico) */
  m.emissiveNode = Fn((b) => { const S = saida(b); let luz = A.clarao().mul(max(S.wn.y, 0.0).mul(0.65).add(0.35)); if (dentro && M5.luzFendaChao) luz = luz.add(UNI ? M5.luzFendaChao(normalWorld, positionWorld).mul(kf) : M5.luzFendaChao(normalWorld, positionWorld)); /* 5.0b.1: a luz da Fenda só no chão */ return S.tEmis.add(dif.mul(luz)); })();
  if (o.vazio) { m.maskNode = pleno ? positionWorld.y.greaterThan(-90.0).and(amostra(M5.tex.vazio, vec2(positionWorld.x, positionWorld.z.negate()).div(W)).r.sub(0.5).mul(128.0).greaterThanEqual(18.0)) /* 5.0b (junção): o corte do clássico (if (vWP.y < −90) discard; esd < 18 discard), que o M5.espacoBorda da água fazia no chão da fundação */
      : M5.vazioMascara ? M5.vazioMascara(positionWorld) : positionWorld.y.greaterThan(-90.0); /* 5.0a.1: some só onde o mapa do vazio diz (nunca pela altura) */
    m.userData.vazio = true; m.userData.voidMap = vMap; m.userData.terrU = U; } /* o space3d (refreshVoid) troca userData.voidMap.value: é o mesmo M5.tex.vazio */
  m.userData.env = 0.22; m.userData.ardFora = uFora;
  if (UNI) m.receivedShadowNode = sh => sh.add(uFora.mul(float(1).sub(sh))); /* 5.0b.1: as mesas recebem sombra no Motor 5 (o mesmo shader do chão) com a sombra em 1, como sem receber */
  return M5.registrar('chao' + (o.fora ? '-fora' : '') + (o.leve ? '-leve' : '') + (o.vazio ? '-vazio' : ''), m);
};

/* ---------- atributos por vértice num buffer só (intercalados): menos buffers de vértice por pipeline (o WebGPU aceita no máximo 8; os adereços com
   matriz e cor de instância do M5.Inst usavam 8: posição, normal, cor, rm, aWind, aGlow, iM, iC). Com rm, aWind e aGlow juntos ficam 6. ---------- */
M5.intercala = function (geos, nomes) { const Tm = T(); let n = 0;
  for (const g of geos) { if (!g || !g.attributes || !g.attributes.position) continue; if (nomes.some(k => !g.attributes[k] || g.attributes[k].isInterleavedBufferAttribute)) continue;
    const cnt = g.attributes.position.count, tam = nomes.map(k => g.attributes[k].itemSize), stride = tam.reduce((a, b) => a + b, 0), arr = new Float32Array(cnt * stride);
    for (let i = 0; i < cnt; i++) { let o = i * stride; for (let j = 0; j < nomes.length; j++) { const a = g.attributes[nomes[j]], t = tam[j]; for (let c = 0; c < t; c++) arr[o + c] = a.getComponent ? a.getComponent(i, c) : a.array[i * t + c]; o += t; } }
    const ib = new Tm.InterleavedBuffer(arr, stride); let off = 0; for (let j = 0; j < nomes.length; j++) { g.setAttribute(nomes[j], new Tm.InterleavedBufferAttribute(ib, tam[j], off)); off += tam[j]; } n++; }
  return n; };

/* ---------- adereços do dress3d (o mat do dress3d em TSL): cor e rm por vértice, brilho (aGlow) com a tinta da instância, névoa de guerra,
   folha de dupla face com a normal "de copa" igual dos dois lados, e vento por peça: a peça balança pela altura (aWind × y), com a fase pela posição
   da instância (iM3, a translação do M5.Inst), e o deslocamento entra na posição da geometria antes da matriz de instância (M5.instMat), como o
   transformed += do clássico. A sombra fica parada, como no clássico (o material de profundidade de lá não tem o vento). ---------- */
M5.adereco = function (o) {
  o = o || {}; const Tm = T(); const { Fn, float, vec2, vec3, vec4, mat4, mix, max, sin, cos, attribute, vertexColor, varyingProperty, positionLocal, normalViewGeometry } = L();
  const m = new Tm.MeshStandardNodeMaterial({ vertexColors: true, roughness: 1, metalness: 0, side: o.leaf ? Tm.DoubleSide : Tm.FrontSide });
  const rm = M5.attr('rm', vec2(0.9, 0)), glow = M5.attr('aGlow', float(0)), wind = M5.attr('aWind', float(0)); const fv = amostras().nevoa();
  m.colorNode = M5.instCor(vec3(mix(0.06, 1.0, fv).mul(float(1).sub(glow)))); m.roughnessNode = rm.x; m.metalnessNode = rm.y;
  const corInst = Fn(b => (b.object && b.object.isM5Inst ? attribute('iC', 'vec3') : b.object && b.object.instanceColor ? varyingProperty('vec3', 'vInstanceColor') : vec3(1)))();
  m.emissiveNode = vertexColor().rgb.mul(corInst).mul(glow).mul(fv.mul(fv)); /* peça emissiva: a própria cor (com a tinta da instância), apagada na névoa */
  if (o.leaf) m.normalNode = normalViewGeometry; /* o clássico desfaz a inversão do verso: folhas e lâminas iluminadas igual dos dois lados */
  if (o.leaf) { const semSombra = L().uniform(0).onObjectUpdate(({ object }) => (object.userData && object.userData.ardSemSombra ? 1 : 0)); m.receivedShadowNode = s => s.add(semSombra.mul(float(1).sub(s))); } /* 5.0b.1: um shader só para as folhas: todo bloco recebe sombra no Motor 5 e a folhagem pequena (ardSemSombra, do dress3d) fica com a sombra em 1, como sem receber (antes eram dois WGSL: com e sem sombra) */
  const vento = Fn(b => { if (!(b.object && b.object.isM5Inst)) return positionLocal; /* InstancedMesh de verdade (?m5inst=0): o three já aplicou a instância; sem vento */
    const iw = attribute('iM3', 'vec4'), t = M5.u.tempo, p = positionLocal; const k = wind.mul(max(p.y, 0.0));
    const gx = sin(t.mul(1.7).add(iw.x.mul(0.05)).add(iw.z.mul(0.03))).mul(0.09).add(sin(t.mul(4.6).add(p.x.mul(6.0)).add(iw.z.mul(0.21))).mul(0.022));
    const gz = cos(t.mul(1.3).add(iw.z.mul(0.05))).mul(0.06).add(cos(t.mul(4.1).add(p.z.mul(6.0)).add(iw.x.mul(0.17))).mul(0.018));
    return p.add(vec3(gx.mul(k), 0.0, gz.mul(k))); })();
  const G = M5.ganchos && M5.ganchos.adereco; let pos = vento; if (G && G.posicao) { const pp = G.posicao({ m, o, vento }); if (pp) pos = pp; }
  M5.instMat(m, pos); /* 5.0a.1: matriz e cor da instância por atributo (uma montagem de nós para todos os blocos) */
  const iM = mat4(attribute('iM0', 'vec4'), attribute('iM1', 'vec4'), attribute('iM2', 'vec4'), attribute('iM3', 'vec4'));
  m.castShadowPositionNode = Fn(b => (b.object && b.object.isM5Inst ? iM.mul(vec4(positionLocal, 1)).xyz : positionLocal))(); /* sombra parada (sem vento) */
  return M5.registrar('adereco-' + (o.leaf ? 'folha' : 'solido'), m, { env: 1 });
};

/* ---------- sem pós (Baixa, celular): o clássico desenha a estrada e o halo dos planetas (ShaderMaterial sem os includes de saída) direto no canvas,
   em sRGB de 8 bits, sem tone mapping; o Motor 5 soma em linear e faz o tone mapping no fim. Para a mesma imagem, sem pós a cor sai de volta para o
   linear (≈ ^2,2: o ACES quase não mexe nessa faixa) e o alfa aditivo vai a 2,2 (a regra 11 da carga). A escolha é por uniform, a cada render: sem pós
   o r186 desenha a cena no alvo interno de saída (isPostProcessingRenderTarget) e converte no fim; com pós a cena vai para o alvo do passe (vale 0).
   Um shader só para os dois casos, sem pipeline novo se o pós liga ou desliga no meio da partida ---------- */
const semPos = () => M5.u.semPos || (M5.u.semPos = L().uniform(0).onRenderUpdate(({ renderer }) => { const rt = renderer.getRenderTarget(); return rt !== null && rt.isPostProcessingRenderTarget === true ? 1 : 0; }));
let EXPO = null; const expo = () => EXPO || (EXPO = (M5.foto && M5.foto.exposicao && M5.foto.exposicao()) || L().uniform(1)); /* 5.0b (junção): a exposição em uso (ARD.m5.u.exposicao do Modo Foto; 1 na partida): o roadMat e o halo do clássico saem crus, sem exposição */
/* estradas de terra (dress3d): a mesma conta do roadMat do clássico (faixa com borda irregular, sulcos e névoa de guerra), com M5.Inst */
M5.estrada = function () {
  const Tm = T(); const { float, vec2, vec3, mix, smoothstep, abs, pow, uv, positionWorld } = L();
  const m = new Tm.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }); m.fog = false;
  const side = abs(uv().x.sub(0.5)).mul(2); const nz = M5.vnoise2(vec2(positionWorld.x.div(M5.u.mundo), positionWorld.z.negate().div(M5.u.mundo)).mul(900));
  const edge = float(1).sub(smoothstep(nz.mul(0.25).add(0.55), 1.0, side)); const rut = float(1).sub(smoothstep(0.0, 0.08, abs(side.sub(0.45)))).mul(0.18); /* bordas em ordem */
  const col = mix(vec3(0.33, 0.29, 0.24), vec3(0.42, 0.37, 0.3), nz).mul(float(1).sub(rut)).mul(mix(0.06, 1.0, amostras().nevoa()));
  m.colorNode = mix(col, pow(col, vec3(2.2)).div(expo()), semPos()); /* 5.0b (junção): ÷ exposição sem pós */ m.opacityNode = edge.mul(0.62); M5.instMat(m);
  return M5.registrar('estrada', m);
};
/* halo dos planetas (a atmosfera por Fresnel do world3d): cor, expoente e força em uniform (a lua e o planeta dividem o shader); sem pós, alfa a 2,2 */
M5.atmo = function (col, pw, it) {
  const Tm = T(); const { uniform, float, mix, pow, max, abs, dot, normalize, normalView, positionViewDirection } = L();
  const m = new Tm.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: Tm.AdditiveBlending, side: Tm.BackSide }); m.fog = false;
  const c = uniform(new Tm.Color(col)), uPw = uniform(pw), uIt = uniform(it); const f = pow(max(float(1).sub(abs(dot(normalize(normalView), positionViewDirection))), 0), uPw);
  m.colorNode = c.mul(f).mul(uIt).div(mix(float(1), expo(), semPos())); /* 5.0b (junção): ÷ exposição sem pós */ const a = f.mul(uIt); m.opacityNode = mix(a, pow(a, 2.2), semPos()); m.userData.atmo = { c, pw: uPw, it: uIt }; return M5.registrar('atmo', m);
};

/* ---------- céu ----------
   M5.ceu(o) devolve a malha com userData.mat.uniforms no formato do céu GLSL (uTop, uHor, uBot, uSunDir, uSunCol, uNight, uTime, uSpace, uNebula, uPlanet,
   uPlanetL, uSpaceK). o.espaco (Cinturão): o céu de espaço do clássico; o.nebulosa: o cubemap assado (M5.espaco.nebulosa); o.planeta === false tira o
   planeta gigante (padrão: o do spaceBackdrop, como o space3d usa). Sem o.espaco, o céu de dia com nuvens, sol e estrelas (sem o ramo do espaço no shader). */
let RC = null;
function ruido3() { /* ruído 3D do planeta (o ardV3/ardF3 do world3d) em funções de verdade no WGSL */
  if (RC) return RC; const { Fn, vec3, float, floor, fract, dot, mix } = L();
  const h31 = Fn(([p0]) => { const p = fract(vec3(p0).mul(0.1031)).toVar(); p.addAssign(dot(p, p.zyx.add(31.32))); return fract(p.x.add(p.y).mul(p.z)); }).setLayout({ name: 'ardCeuH31', type: 'float', inputs: [{ name: 'p0', type: 'vec3' }] });
  const vn3 = Fn(([p]) => { const i = floor(p), f = fract(p), u = f.mul(f).mul(f.mul(-2).add(3));
    const a = h31(i), b = h31(i.add(vec3(1, 0, 0))), c = h31(i.add(vec3(0, 1, 0))), d = h31(i.add(vec3(1, 1, 0))), e = h31(i.add(vec3(0, 0, 1))), g = h31(i.add(vec3(1, 0, 1))), h = h31(i.add(vec3(0, 1, 1))), k = h31(i.add(vec3(1, 1, 1)));
    return mix(mix(mix(a, b, u.x), mix(c, d, u.x), u.y), mix(mix(e, g, u.x), mix(h, k, u.x), u.y), u.z); }).setLayout({ name: 'ardCeuVn3', type: 'float', inputs: [{ name: 'p', type: 'vec3' }] });
  const f5 = Fn(([p0]) => { let p = vec3(p0), v = float(0), a = 0.5, t = 0; for (let i = 0; i < 5; i++) { v = v.add(vn3(p).mul(a)); t += a; p = p.mul(2.03).add(vec3(1.7, 9.2, 4.1)); a *= 0.5; } return v.div(t); }).setLayout({ name: 'ardCeuFbm5', type: 'float', inputs: [{ name: 'p0', type: 'vec3' }] });
  const hs33 = Fn(([p0]) => { const p = fract(vec3(p0).mul(vec3(0.1031, 0.1030, 0.0973))).toVar(); p.addAssign(dot(p, p.yxz.add(33.33))); return fract(p.xxy.add(p.yxx).mul(p.zyx)); }).setLayout({ name: 'ardCeuH33', type: 'vec3', inputs: [{ name: 'p0', type: 'vec3' }] });
  RC = { h31, vn3, f5, hs33 }; return RC;
}
/* cubemap vazio (1², limpo) para o céu de espaço ter o que amostrar antes da nebulosa */
M5.cuboVazio = function () { if (M5._cuboVazio) return M5._cuboVazio; const Tm = T(), r = M5.cur && M5.cur.renderer; const rt = new Tm.CubeRenderTarget(1, { type: Tm.HalfFloatType, generateMipmaps: false, depthBuffer: false }); rt.texture.name = 'ard-cubo-vazio';
  if (r) { const prev = r.getRenderTarget(), cc = r.getClearColor(new Tm.Color()), ca = r.getClearAlpha(); r.setClearColor(0x000000, 1); for (let f = 0; f < 6; f++) { r.setRenderTarget(rt, f); r.clear(true, false, false); } r.setRenderTarget(prev); r.setClearColor(cc, ca); }
  return (M5._cuboVazio = rt.texture); };
const PLANETA0 = { dir: [-0.94, -0.3, -0.16], r: 0.27, luz: [-0.47, 0.64, 0.6] }; /* o planeta gigante do spaceBackdrop (o space3d usa o padrão) */
M5.ceu = function (o) {
  o = o || {}; const Tm = T(); const { Fn, If, uniform, float, vec2, vec3, mix, pow, clamp, smoothstep, max, dot, normalize, positionLocal, floor, fract, step, sin, sqrt, exp, acos, length, fwidth, select, cubeTexture } = L();
  const Pd = new Tm.Vector3().fromArray(PLANETA0.dir).normalize(), Pl = new Tm.Vector3().fromArray(PLANETA0.luz).normalize(); const comPlaneta = o.espaco && o.planeta !== false;
  const u = { uTop: uniform(new Tm.Color(0x3a5f8f)), uHor: uniform(new Tm.Color(0x9fb0c4)), uBot: uniform(new Tm.Color(0x30343a)), uSunDir: uniform(new Tm.Vector3(-0.4, 0.7, 0.5).normalize()), uSunCol: uniform(new Tm.Color(1, 0.9, 0.75)), uNight: uniform(0), uTime: uniform(0),
    uSpace: uniform(o.espaco ? 1 : 0), uNebula: o.espaco ? cubeTexture(o.nebulosa || M5.cuboVazio()) : null, uPlanet: uniform(comPlaneta ? new Tm.Vector4(Pd.x, Pd.y, Pd.z, Math.cos(PLANETA0.r)) : new Tm.Vector4(0, -1, 0, 2)), uPlanetL: uniform(comPlaneta ? Pl : new Tm.Vector3(0, 1, 0)), uSpaceK: uniform(new Tm.Vector4(1, 1, 0, 0)) };
  const m = new Tm.MeshBasicNodeMaterial({ side: Tm.BackSide, depthWrite: false }); m.fog = false;
  if (o.espaco) { const R3 = ruido3();
    const estrela = Fn(([d, sc, dens, rad, gain]) => { /* ardStar: uma estrela por célula, nítida em qualquer resolução (raio mínimo pela derivada); célula vazia sai cedo */
      const q = d.mul(sc).toVar(), c = floor(q).toVar(); const pw = max(length(fwidth(q)), 1e-4).mul(0.7).toVar(); const st = vec3(0).toVar();
      If(R3.h31(c.add(11.7)).lessThanEqual(dens), () => { const r = max(rad, pw); const h = R3.hs33(c); const dist = length(q.sub(c.add(0.3).add(h.mul(0.4))));
        const k = float(1).sub(smoothstep(r.mul(0.2), r, dist)).mul(clamp(rad.mul(rad).div(r.mul(r)), 0.0, 1.0)); /* bordas do smoothstep em ordem */
        const b = pow(h.y, 9.0).mul(5.0).add(0.22).mul(gain); const tc = mix(mix(vec3(0.7, 0.82, 1.0), vec3(1.0), h.z.div(0.62)), mix(vec3(1.0), vec3(1.0, 0.76, 0.5), h.z.sub(0.62).div(0.38)), step(0.62, h.z));
        st.assign(tc.mul(k).mul(b)); });
      return st; }).setLayout({ name: 'ardCeuEstrela', type: 'vec3', inputs: [{ name: 'd', type: 'vec3' }, { name: 'sc', type: 'float' }, { name: 'dens', type: 'float' }, { name: 'rad', type: 'float' }, { name: 'gain', type: 'float' }] });
    m.colorNode = Fn(() => {
      const d = normalize(positionLocal).toVar('cD'); const sd = max(dot(d, u.uSunDir), 0.0).toVar('cSd');
      const col = u.uNebula.sample(d).rgb.mul(mix(u.uNight.mul(0.25).add(1.0), u.uSpaceK.x, u.uSpaceK.z)).toVar('cCol'); const pm = float(0).toVar('cPm'); /* o clássico clareia a nebulosa 25% à noite (o space3d põe uSpaceK.x = 1 + 0,25·noite; com uSpaceK.z = 1 vale o x dele) */
      const P = u.uPlanet; const cp = dot(d, P.xyz).toVar('cCp'); const sr = sqrt(max(P.w.mul(P.w).oneMinus(), 0.0)); const disc = cp.mul(cp).sub(sr.mul(sr).oneMinus()).toVar('cDisc'); const pw = max(fwidth(cp), 1e-5).toVar('cPw');
      If(P.w.lessThan(1.0), () => { /* planeta gigante abaixo do horizonte (o ardPlaneta e o ardHalo do world3d) */
        const hz = acos(clamp(cp, -1.0, 1.0)).sub(acos(clamp(P.w, -1.0, 1.0))); const dd = d.sub(P.xyz.mul(cp)); const l2 = select(dot(dd, dd).greaterThan(1e-8), dot(normalize(dd), u.uPlanetL), float(0));
        col.addAssign(select(hz.greaterThan(0.0).and(hz.lessThanEqual(0.12)), vec3(0.04, 0.11, 0.3).mul(exp(hz.mul(-50.0))).mul(smoothstep(-0.45, 0.5, l2)).mul(0.9), vec3(0))); /* atmosfera fina do lado do sol */
        If(cp.greaterThan(0.0).and(disc.greaterThan(pw.mul(-4.0))), () => { /* disco analítico (borda nítida pela derivada), faixas e tempestades, terminador */
          const t = cp.sub(sqrt(max(disc, 0.0))); const N = d.mul(t).sub(P.xyz).div(sr).toVar('cN');
          const lat = dot(N, vec3(0.18, 1.0, -0.22).normalize()); const tb = R3.f5(N.mul(3.0).add(1.3));
          const bands = R3.f5(vec3(lat.mul(7.0).add(tb.mul(0.9)), lat.mul(2.0), 4.2)); const storms = smoothstep(0.64, 0.8, R3.f5(N.mul(7.0).add(2.0)));
          const pc = mix(mix(vec3(0.014, 0.032, 0.07), vec3(0.08, 0.14, 0.21), smoothstep(0.3, 0.75, bands)), vec3(0.15, 0.12, 0.19), storms.mul(0.5));
          const lit = dot(N, u.uPlanetL); const rim = pow(float(1).sub(max(dot(N, d.negate()), 0.0)), 4.0);
          const pcol = pc.mul(smoothstep(-0.08, 0.6, lit)).mul(1.5).add(vec3(0.05, 0.15, 0.4).mul(rim).mul(smoothstep(-0.25, 0.3, lit)).mul(1.3)).add(pc.mul(0.012));
          const pa = smoothstep(pw.mul(-2.0), pw.mul(2.0), disc); col.assign(mix(col, pcol, pa)); pm.assign(pa); }); });
      const bd = dot(d, vec3(0.38, 0.33, 0.865)); const band = exp(bd.mul(bd).mul(-16.0)); /* faixa da galáxia */
      const st = estrela(d, float(280.0), band.mul(0.22).add(0.05), float(0.17), float(0.5)).add(estrela(d.zxy, float(110.0), float(0.035), float(0.11), float(1.5))).add(estrela(d.yzx, float(560.0), band.mul(0.35).add(0.06), float(0.2), float(0.2)));
      col.addAssign(st.mul(u.uSpaceK.y).mul(u.uNight.mul(0.5).add(0.8)).mul(pm.oneMinus()));
      col.addAssign(u.uSunCol.mul(pow(sd, 2400.0).mul(36.0).add(pow(sd, 160.0).mul(0.5)).add(pow(sd, 12.0).mul(0.03))).mul(float(1).sub(u.uNight.mul(0.85))).mul(pm.oneMinus())); /* o sol sem atmosfera */
      return col; })();
    m.uniforms = u; const mesh = new Tm.Mesh(new Tm.SphereGeometry(4800, 32, 20), m); mesh.frustumCulled = false; mesh.renderOrder = -1000; mesh.userData.mat = m; M5.registrar('ceu-espaco', m); return mesh;
  }
  m.colorNode = Fn(() => { /* o céu de dia do makeSky: gradiente, nuvens que derivam, sol e estrelas que aparecem à noite */
    const d = normalize(positionLocal).toVar('cD'); const y = d.y; const sd = max(dot(d, u.uSunDir), 0.0).toVar('cSd');
    const col = select(y.greaterThan(0.0), mix(u.uHor, u.uTop, pow(clamp(y, 0.0, 1.0), 0.5)), mix(u.uHor, u.uBot, clamp(y.negate().mul(4.0), 0.0, 1.0))).toVar('cCol');
    If(y.greaterThan(0.0), () => { /* 4.3b: nuvens no céu, derivando */
      const cp = vec2(d.x, d.z).div(y.add(0.16)).mul(1.4).add(vec2(u.uTime.mul(0.0035), u.uTime.mul(0.0018))).toVar('cCp'); const cn = float(0).toVar('cCn'); let ca = 0.55;
      for (let i = 0; i < 4; i++) { cn.addAssign(M5.vnoise2(cp).mul(ca)); cp.assign(cp.mul(2.07).add(vec2(1.7, 9.2))); ca *= 0.5; }
      const cv = smoothstep(0.5, 0.82, cn).mul(smoothstep(0.0, 0.22, y)).mul(float(1).sub(u.uNight.mul(0.55)));
      const cc = mix(u.uHor.mul(1.08).add(0.06), u.uSunCol.mul(0.9).add(u.uHor.mul(0.4)), pow(sd, 6.0).mul(0.6)).mul(float(1).sub(u.uNight.mul(0.82))); col.assign(mix(col, cc, cv.mul(0.78))); });
    col.addAssign(u.uSunCol.mul(pow(sd, 600.0).mul(4.0).add(pow(sd, 18.0).mul(0.18))).mul(float(1).sub(u.uNight.mul(0.9))));
    const c = floor(d.mul(420.0)); const s = fract(sin(dot(c, vec3(127.1, 311.7, 74.7))).mul(43758.5453)); const st = step(0.9972, s).mul(smoothstep(0.02, 0.2, y)); const tw = sin(u.uTime.mul(1.7).add(s.mul(60.0))).mul(0.35).add(0.65);
    col.addAssign(vec3(0.9, 0.95, 1.0).mul(st).mul(tw).mul(u.uNight.mul(1.35).add(0.25)));
    return col; })();
  m.uniforms = u; /* formato do céu GLSL */
  const mesh = new Tm.Mesh(new Tm.SphereGeometry(4800, 32, 20), m); mesh.frustumCulled = false; mesh.renderOrder = -1000; mesh.userData.mat = m;
  M5.registrar('ceu', m); return mesh;
};
/* o spaceBackdrop do world3d no Motor 5: a nebulosa assada é a do espaço mínimo (M5.espaco.nebulosa, uma implementação só), com o retorno do clássico */
M5.espacoFundo = function (renderer, o) { o = o || {}; const Tm = T(); const rt = M5.espaco.nebulosa(renderer, o.size || 384, o.seed || 0);
  const P = new Tm.Vector3().fromArray(o.planetDir || PLANETA0.dir).normalize(), cosR = Math.cos(o.planetR || PLANETA0.r), PL = new Tm.Vector3().fromArray(o.planetL || PLANETA0.luz).normalize();
  return { tex: rt.texture, rt, planet: new Tm.Vector4(P.x, P.y, P.z, cosR), planetL: PL }; };
})(globalThis.ARD = globalThis.ARD || {});
