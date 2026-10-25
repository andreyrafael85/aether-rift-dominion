/* Aether Rift: Dominion — Motor 5 (5.0b, fase 2): Tempestade de Éter em TSL. O src/storm3d.js escolhe este caminho no Motor 5 e continua dono
   das fases, dos raios, da chuva, do mapa de alturas, do ruído 3D (gerado na CPU em fatias) e dos efeitos; aqui ficam os quatro materiais:
   - volume: a mesma marcha de raio curta do GLSL de 4.3h (dossel que gira, torres, base escura, olho, funil, névoa da área, cortina e poeira
     da borda, luz do sol com sombra no próprio ruído, clarão do relâmpago espalhado). Os dois trechos da marcha (dossel e embaixo, na ordem do
     raio) correm num laço só, com uma cópia só do meio (o shader fica com metade do tamanho e o mesmo número de passos). Amostras de textura com
     nível explícito (dentro de laço e de ramo); o alfa sai como cobertura (1 − cobertura no alvo do pós, que a bruma lê);
   - borda colada no relevo, chuva em instâncias (gota e respingo calculados no vértice) e raios (segmentos com golpes de retorno no vértice).
   A saída é linear: o WebGPURenderer aplica ACES e sRGB na tela (o GLSL fazia isso à mão quando desenhava direto na tela).
   Contrato com o storm3d: os uniforms são nós do TSL com .value (as mesmas chaves do GLSL), criados por ARD.m5.tempestadeUniforms. Só visual. */
(function (ARD) {
'use strict';
const M5 = ARD.m5 = ARD.m5 || {};
const RP = 1.22; /* raio do cilindro do volume (× raio da área); o mesmo do storm3d */
const blendPre = T => ({ transparent: true, depthWrite: false, depthTest: true, blending: T.CustomBlending, blendEquation: T.AddEquation, blendSrc: T.OneFactor, blendDst: T.OneMinusSrcAlphaFactor, blendEquationAlpha: T.AddEquation, blendSrcAlpha: T.ZeroFactor, blendDstAlpha: T.OneMinusSrcAlphaFactor });

/* uniforms no formato do GLSL: UV (volume), UR (borda), URn (chuva), UBo (raios); hm4 é o mesmo Vector4 que o storm3d reescreve */
M5.tempestadeUniforms = function (tmp3, hmTex, hm4) {
  const T = window.THREE_M5, L = window.TSL; const { uniform, texture, texture3D } = L;
  const UV = { uN: texture3D(tmp3), uHm: texture(hmTex), uC: uniform(new T.Vector4()), uHm4: uniform(hm4), uA: uniform(new T.Vector4()), uB: uniform(new T.Vector4(0, 0, 0, 1)), uD: uniform(new T.Vector4(20, 0, 0, 0)), uE: uniform(new T.Vector4(0.6, 1, 0, 470)), uF: uniform(new T.Vector4()),
    uSunD: uniform(new T.Vector3(-0.47, 0.64, 0.6).normalize()), uSunC: uniform(new T.Color(1.6, 1.45, 1.2)), uSkyC: uniform(new T.Color(0.6, 0.66, 0.74)), uT: uniform(0) };
  const UR = { uN: texture3D(tmp3), uK: uniform(new T.Vector4()), uScr: uniform(0) };
  const URn = { uHm: texture(hmTex), uHm4: UV.uHm4, uC: UV.uC, uR: uniform(new T.Vector4()), uT: uniform(0), uScr: uniform(0) };
  const UBo = { uT: uniform(0), uScr: uniform(0) };
  return { UV, UR, URn, UBo };
};

/* ---------- volume ---------- */
M5.tempestadeVolume = function (UV, side) {
  const T = window.THREE_M5, L = window.TSL;
  const { Fn, float, int, uint, vec2, vec3, vec4, uvec2, If, Loop, Break, Discard, select, mix, smoothstep, clamp, max, min, abs, sqrt, exp, log, pow, sin, cos, atan, dot, length, normalize, ceil, step, positionWorld, cameraPosition, screenCoordinate } = L;
  const ETER = vec3(0.62, 0.24, 1.35), ELET = vec3(0.42, 0.66, 1.65), ALB = vec3(0.42, 0.34, 0.64);
  const { uC, uHm4, uA, uB, uD, uE, uF, uSunD, uSunC, uSkyC, uT } = UV;
  const nTex = uvw => UV.uN.sample(uvw).level(0); /* nível explícito: amostra dentro de laço e de ramo */
  const gnd = xz => uHm4.y.add(UV.uHm.sample(xz.mul(uHm4.x).add(0.5)).level(0).r.mul(uHm4.z));
  const slab = (oy, dy, y0, y1) => { const tiny = abs(dy).lessThan(1e-5); const dd = select(tiny, float(1), dy); const a = y0.sub(oy).div(dd), b = y1.sub(oy).div(dd); const dentro = oy.greaterThanEqual(y0).and(oy.lessThanEqual(y1));
    return select(tiny, select(dentro, vec2(-1e9, 1e9), vec2(1e9, -1e9)), vec2(min(a, b), max(a, b))); };
  /* densidade (por unidade de mundo) e cor do meio num ponto local p (y = altura sobre G); hg = altura sobre o chão; devolve vec4(cor, densidade) */
  const med = (p, hg, gRd, gNfC) => {
    const R = uC.w.mul(uB.w); const rr = length(p.xz).toVar(); const rho = rr.div(R).toVar(); const h = p.y;
    const dTot = float(0).toVar(), cTot = vec3(0).toVar();
    If(rho.lessThanEqual(1.22), () => {
      const fl = uF.xyz.sub(p); const fk = uF.w.div(dot(fl, fl).mul(1 / 17000).add(1)).toVar(); /* luz do relâmpago espalhada */
      const lift = uB.z;
      /* dossel: base escura e chata, camada média rala com braços em espiral, torres altas no anel perto da borda (pegam o sol), olho aberto */
      If(h.greaterThan(lift.add(100)), () => {
        const ang = uB.x.add(uB.y.div(rho.add(0.42))).add(h.mul(0.0016)).toVar(); const ca = cos(ang).toVar(), sa = sin(ang).toVar();
        const q = vec2(ca.mul(p.x).sub(sa.mul(p.z)), sa.mul(p.x).add(ca.mul(p.z)));
        const nq = vec3(q.x, h.mul(1.5), q.y).mul(0.0016).toVar(); const n1 = nTex(nq).r.toVar();
        const tw = exp(rho.sub(0.79).mul(rho.sub(0.79)).mul(-34)).toVar();
        const hb = lift.add(148).sub(n1.mul(26)).add(smoothstep(0.88, 1.12, rho).mul(24)).toVar();
        const hT = lift.mul(1.3).add(205).add(tw.mul(n1.mul(190).add(70))).add(n1.sub(0.4).mul(40)).sub(smoothstep(0.12, 0.45, rho).oneMinus().mul(60)).toVar();
        If(h.greaterThan(hb.sub(26)).and(h.lessThan(hT)), () => {
          const n2 = float(0).toVar(); If(uD.x.lessThan(10), () => { n2.assign(n1.mul(0.3).add(0.35)); }).Else(() => { n2.assign(nTex(nq.mul(2.6).add(vec3(uT.mul(0.0021), uT.mul(-0.0034), 0))).g); }); /* versão leve: sem a busca do detalhe */
          const v = smoothstep(hb.sub(26), hb.add(38), h).mul(smoothstep(hT.sub(80), hT, h).oneMinus()); /* base macia: vista de lado não vira um corte reto */
          const edge = smoothstep(tw.mul(0.08).add(0.98), 1.16, rho.add(n2.sub(0.5).mul(0.14))).oneMinus();
          const eye = smoothstep(0.1, 0.36, rho.add(n1.sub(0.5).mul(0.2)));
          const th = atan(p.z, p.x); const arms = sin(th.add(uB.x).mul(3).add(log(rho.add(0.05)).mul(5.5))).mul(smoothstep(0.2, 0.5, rho)).mul(tw.oneMinus());
          const c1 = n1.mul(0.85).add(tw.mul(0.3)).add(arms.mul(0.22)).sub(v.mul(edge).mul(eye).oneMinus().mul(0.75)).toVar();
          const c2 = c1.sub(n2.sub(0.35).mul(0.45).mul(float(1.15).sub(c1)));
          const den = smoothstep(uE.x, uE.x.add(0.16), c2).toVar();
          If(den.greaterThan(0.002), () => {
            const d = den.mul(tw.mul(0.0168).add(0.0132)).mul(uA.x).mul(gNfC).toVar();
            const hn = clamp(h.sub(hb).div(max(hT.sub(hb), 1)), 0, 1).toVar();
            const sd = normalize(uSunD.xz.add(vec2(1e-5))); const bq = dot(p.xz, sd).toVar(), rc = R.mul(1.12); const s = bq.negate().add(sqrt(max(bq.mul(bq).sub(rr.mul(rr)).add(rc.mul(rc)), 0)));
            const od = min(hT.sub(h).div(max(uSunD.y, 0.25)), s.div(max(length(uSunD.xz), 0.25))).mul(0.04).mul(den.add(0.15));
            const sunT = exp(od.negate()).toVar();
            If(uD.x.greaterThan(9.5), () => { const Lv = vec3(ca.mul(uSunD.x).sub(sa.mul(uSunD.z)), uSunD.y.mul(1.5), sa.mul(uSunD.x).add(ca.mul(uSunD.z))).mul(34.0 * 0.0016); const nS = nTex(nq.add(Lv)).r; sunT.mulAssign(clamp(n1.sub(nS).mul(3.2).add(0.55), 0.12, 1.25)); });
            const ph = pow(max(dot(gRd, uSunD), 0), 6).mul(0.9).add(0.8), ao = smoothstep(0.0, 0.6, hn).mul(0.65).add(0.35);
            const c = vec3(0.4, 0.3, 0.68).mul(uSunC).mul(sunT).mul(ph).mul(ao).mul(0.82).add(ALB.mul(uSkyC).mul(vec3(0.45, 0.55, 1.05)).mul(hn.mul(0.22).add(0.04))).toVar();
            const vein = pow(clamp(abs(n2.sub(0.52)).mul(3.2).oneMinus(), 0, 1), 5).mul(smoothstep(0.3, 0.8, den)).mul(smoothstep(0.5, 0.68, n1)); /* veios de éter só em manchas */
            c.addAssign(ETER.mul(uE.y).mul(uD.w.mul(0.04).add(0.02).mul(hn.oneMinus()).add(vein.mul(uD.w.mul(0.16).add(0.14)).mul(hn.mul(0.6).oneMinus()))));
            c.addAssign(ELET.mul(fk).mul(hn.oneMinus().mul(0.5).add(0.5)).mul(1.5));
            dTot.addAssign(d); cTot.addAssign(c.mul(d));
          });
        });
      });
      /* embaixo: névoa da área, funil, cortina e poeira da borda */
      If(h.lessThan(lift.add(175)), () => {
        const ang = uB.x.mul(1.7).add(uB.y.mul(1.3).div(rho.add(0.3))).add(h.mul(0.004)).toVar(); const ca = cos(ang).toVar(), sa = sin(ang).toVar();
        const q = vec2(ca.mul(p.x).sub(sa.mul(p.z)), sa.mul(p.x).add(ca.mul(p.z)));
        const n = nTex(vec3(q.x, h.mul(0.55).sub(uT.mul(5)), q.y).mul(0.0021)).rg.toVar();
        const inA = smoothstep(0.985, 1.0, rho).oneMinus().toVar();
        const cab = float(0.5).toVar(); /* quanto de dossel há em cima deste ponto (mesmo giro do dossel, na altura da base) */
        If(uD.x.greaterThan(9.5), () => { const a2 = uB.x.add(uB.y.div(rho.add(0.42))).add(0.26).toVar(); const c2 = cos(a2), s2 = sin(a2); const q2 = vec2(c2.mul(p.x).sub(s2.mul(p.z)), s2.mul(p.x).add(c2.mul(p.z))); cab.assign(smoothstep(0.38, 0.68, nTex(vec3(q2.x, 255.0, q2.y).mul(0.0016)).r).mul(smoothstep(0.1, 0.4, rho))); });
        const hz = uA.y.mul(inA).mul(exp(hg.negate().div(30)).mul(0.9).add(0.36)).mul(n.x.mul(0.9).add(0.55)).mul(cab.mul(0.9).add(0.7)).mul(smoothstep(130.0, 175.0, h.sub(lift.mul(0.5))).oneMinus()).toVar();
        If(hz.greaterThan(0.001), () => { const d = hz.mul(0.009); const c = uSkyC.mul(0.05).add(vec3(0.02, 0.008, 0.05)).add(ETER.mul(0.014).mul(uD.w)).add(ELET.mul(fk).mul(0.9)); dTot.addAssign(d); cTot.addAssign(c.mul(d)); });
        const rs = uA.y.mul(inA).mul(cab).mul(cab).mul(smoothstep(0.35, 0.8, n.y)).mul(smoothstep(120.0, 165.0, h.sub(lift)).oneMinus()).toVar();
        If(rs.greaterThan(0.001), () => { const d = rs.mul(0.006); const c = ALB.mul(uSkyC).mul(0.32).add(ETER.mul(0.05)).add(ELET.mul(fk).mul(0.7)); dTot.addAssign(d); cTot.addAssign(c.mul(d)); });
        const bw0 = rho.sub(1).mul(uC.w).div(10); const bw = exp(bw0.mul(bw0).negate());
        const cur = uE.z.mul(bw).mul(exp(max(hg, 0).negate().div(34))).mul(n.y.mul(1.1).add(0.35)).toVar();
        If(cur.greaterThan(0.001), () => { const d = cur.mul(0.012); const c = ETER.mul(n.y.mul(0.8).add(0.9)).add(ELET.mul(fk)); dTot.addAssign(d); cTot.addAssign(c.mul(d)); });
        const fb = mix(175.0, -40.0, uA.z).toVar(); /* fundo do funil: desce do dossel até o chão quando a tempestade abre */
        If(uA.z.greaterThan(0.001).and(h.greaterThan(fb.sub(30))), () => {
          const rcf = smoothstep(-10.0, 170.0, h).mul(0.16).add(0.045).add(sin(h.mul(0.05).add(uT.mul(1.7))).mul(0.03));
          const x = rho.div(rcf).add(n.y.sub(0.5).mul(0.55)).toVar();
          const df = smoothstep(0.55, 1.05, x).oneMinus().mul(smoothstep(fb.sub(30), fb.add(25), h)).mul(uA.z).toVar();
          If(df.greaterThan(0.001), () => { const st = sin(atan(p.z, p.x).mul(3).add(h.mul(0.06)).sub(uT.mul(2.4)).add(n.x.mul(3))).mul(0.5).add(0.5).toVar(); df.mulAssign(st.mul(0.85).add(0.45)); const d = df.mul(0.022); const core = exp(x.mul(x).mul(-3)); const vein = pow(clamp(abs(n.y.sub(0.5)).mul(3).oneMinus(), 0, 1), 4).mul(st);
            const c = ALB.mul(uSkyC.mul(0.18).add(uSunC.mul(0.05))).add(ETER.mul(core.mul(0.25).add(0.05).add(vein.mul(1.1))).mul(n.x.mul(0.6).add(0.6)).mul(uE.y)).add(ELET.mul(core.mul(0.12).add(fk))); dTot.addAssign(d); cTot.addAssign(c.mul(d)); });
        });
        const dr0 = rho.sub(1.03).mul(7.5); const dr = exp(dr0.mul(dr0).negate()).mul(exp(max(hg, 0).negate().div(15))).mul(uA.w).mul(smoothstep(0.42, 0.78, n.x)).toVar();
        If(dr.greaterThan(0.001), () => { const d = dr.mul(0.011); const c = vec3(0.4, 0.34, 0.33).mul(uSunC.mul(0.3).add(uSkyC.mul(0.55))).add(ETER.mul(0.05)).add(ELET.mul(fk).mul(0.5)); dTot.addAssign(d); cTot.addAssign(c.mul(d)); });
      });
    });
    return [cTot.div(max(dTot, 1e-20)), dTot];
  };
  const frag = Fn(() => {
    const ro = cameraPosition.sub(uC.xyz).toVar(); const rd = normalize(positionWorld.sub(cameraPosition)).toVar();
    const Rp = uC.w.mul(RP).toVar();
    const a = dot(rd.xz, rd.xz).toVar(), b = dot(ro.xz, rd.xz).toVar(), cc = dot(ro.xz, ro.xz).sub(Rp.mul(Rp)).toVar(); const disc = b.mul(b).sub(a.mul(cc)).toVar();
    If(disc.lessThanEqual(0).or(a.lessThan(1e-8)), () => { Discard(); });
    const sq = sqrt(max(disc, 0)).toVar(); const ty = slab(ro.y, rd.y, uHm4.w, uE.w).toVar();
    const tf = length(positionWorld.sub(cameraPosition)).toVar();
    const t0 = max(max(b.negate().sub(sq).div(a), ty.x), select(uD.y.greaterThan(0.5), tf, tf.sub(2))).toVar(); const t1 = min(b.negate().add(sq).div(a), ty.y).toVar();
    If(rd.y.lessThan(0), () => { t1.assign(min(t1, uHm4.y.sub(2).sub(ro.y).div(rd.y))); });
    If(t1.lessThanEqual(t0), () => { Discard(); });
    /* ruído branco por pixel (grão sem padrão): o mesmo hash inteiro do GLSL */
    const ui = uvec2(screenCoordinate.xy); const hs = ui.x.mul(uint(1973)).add(ui.y.mul(uint(9277))).toVar(); hs.assign(hs.shiftLeft(uint(13)).bitXor(hs)); hs.assign(hs.mul(hs.mul(hs).mul(uint(15731)).add(uint(789221))).add(uint(1376312589)));
    const j = float(hs.bitAnd(uint(0xffff))).div(65536).toVar();
    const dentro = uD.y.greaterThan(0.5); const nfx = select(dentro, tf, float(-1e4)).toVar(), nfy = select(dentro, float(1), float(0)).toVar(); /* x: início; y: 1 dentro (esmaece perto da câmera), 0 fora */
    const yb = uB.z.add(108); const tb = slab(ro.y, rd.y, yb, uE.w).toVar(), tl = slab(ro.y, rd.y, uHm4.w, yb).toVar();
    const b0 = max(t0, tb.x), b1 = min(t1, tb.y), l0 = max(t0, tl.x), l1 = min(t1, tl.y);
    /* passo alvo pela qualidade (uD.x): dossel 12/20/40, embaixo 18/30/60 unidades; teto de passos por trecho */
    const sb = select(uD.x.greaterThan(20), float(12), select(uD.x.greaterThan(12), float(20), float(40))), sl = sb.mul(1.5);
    const mb = select(uD.x.greaterThan(20), float(40), select(uD.x.greaterThan(12), float(28), float(12))), ml = select(uD.x.greaterThan(20), float(24), select(uD.x.greaterThan(12), float(14), float(8)));
    /* os dois trechos na ordem do raio (descendo: dossel e depois embaixo; subindo: o contrário) num laço só */
    const desce = rd.y.lessThan(0);
    const ta1 = select(desce, b0, l0).toVar(), tb1 = select(desce, b1, l1).toVar(), st1 = select(desce, sb, sl), mx1 = select(desce, mb, ml);
    const ta2 = select(desce, l0, b0).toVar(), tb2 = select(desce, l1, b1).toVar(), st2 = select(desce, sl, sb), mx2 = select(desce, ml, mb);
    const n1 = select(tb1.greaterThan(ta1), clamp(ceil(tb1.sub(ta1).div(st1)), 2, mx1), float(0)).toVar(), n2 = select(tb2.greaterThan(ta2), clamp(ceil(tb2.sub(ta2).div(st2)), 2, mx2), float(0)).toVar();
    const dt1 = tb1.sub(ta1).div(max(n1, 1)).toVar(), dt2 = tb2.sub(ta2).div(max(n2, 1)).toVar(); const nt = n1.add(n2).toVar();
    const gT = float(1).toVar(), cAcc = vec3(0).toVar();
    Loop({ start: int(0), end: int(80), type: 'int', condition: '<' }, ({ i }) => {
      const fi = float(i);
      If(fi.greaterThanEqual(nt).or(gT.lessThan(0.03)), () => { Break(); });
      const seg2 = step(n1, fi); const k = fi.sub(n1.mul(seg2)); const dtc = mix(dt1, dt2, seg2).toVar(); const t = mix(ta1, ta2, seg2).add(dtc.mul(j.add(k))).toVar();
      const p = ro.add(rd.mul(t)).toVar(); const g = gnd(p.xz).toVar();
      If(p.y.lessThan(g), () => { Break(); }); /* bateu no chão: acaba a marcha (o trecho seguinte nem começa) */
      const gNfC = mix(float(1), smoothstep(nfx.add(40), nfx.add(230), t), nfy); /* perto da câmera dentro do volume; fora dele vale 1 (bordas do smoothstep sempre em ordem) */
      const [c, d0] = med(p, p.y.sub(g), rd, gNfC); const d = d0.mul(mix(float(1), smoothstep(nfx, nfx.add(110), t), nfy)).toVar();
      If(d.greaterThan(0), () => { const al = exp(d.mul(dtc).negate()).oneMinus().toVar(); cAcc.addAssign(gT.mul(al).mul(c)); gT.mulAssign(al.oneMinus()); });
    });
    const al = gT.oneMinus().toVar(); If(al.lessThan(0.003), () => { Discard(); });
    return vec4(cAcc, al); /* cor pré-multiplicada (cAcc já é cor × cobertura); alfa = cobertura. Sem o pós o Motor 5 mistura em linear e o clássico em sRGB
       depois dos tons: a mistura linear fica a +0,03…0,06 do clássico no valor final; elevar a transmitância a 2,2 só acerta com o fundo preto e escurece o resto */
  });
  const m = new T.MeshBasicNodeMaterial(Object.assign(blendPre(T), { side })); m.fog = false;
  m.fragmentNode = frag();
  return M5.registrar('tempestade-volume', m);
};

/* ---------- selo do alfa: sem o pós, a cobertura que o volume grava no alfa chegaria à tela (o quadro sai escuro onde a nuvem cobre);
   um quadro de tela cheia depois de tudo devolve alfa 1 sem tocar na cor. Com o pós (que lê a cobertura para a bruma) fica escondido. ---------- */
M5.tempestadeSelo = function () {
  const T = window.THREE_M5, L = window.TSL; const { vec4, positionGeometry } = L;
  const m = new T.MeshBasicNodeMaterial({ transparent: true, depthTest: false, depthWrite: false, blending: T.CustomBlending, blendEquation: T.AddEquation, blendSrc: T.ZeroFactor, blendDst: T.OneFactor, blendEquationAlpha: T.AddEquation, blendSrcAlpha: T.OneFactor, blendDstAlpha: T.ZeroFactor }); m.fog = false;
  m.vertexNode = vec4(positionGeometry.xy, 0, 1); m.fragmentNode = vec4(0, 0, 0, 1);
  const me = new T.Mesh(new T.PlaneGeometry(2, 2), M5.registrar('tempestade-selo', m)); me.frustumCulled = false; me.renderOrder = 1e4; me.visible = false; me.name = 'tempestade-selo-alfa'; return me;
};

/* ---------- borda (faixa colada no relevo) ---------- */
M5.tempestadeBorda = function (UR) {
  const T = window.THREE_M5, L = window.TSL; const { float, vec3, vec4, attribute, exp, mix, smoothstep, fract, sin, select } = L;
  const vU = attribute('aU', 'vec3'); const off = vU.y, u = vU.x, K = UR.uK;
  const core = exp(off.mul(off).div(-4.5)), inner = select(off.lessThan(0), exp(off.div(15)), exp(off.negate().div(3.5)));
  const fl = UR.uN.sample(vec3(u.mul(7).add(K.w.mul(1.1)), off.mul(0.012), K.z.mul(0.015))).level(0).g;
  const fl2 = UR.uN.sample(vec3(u.mul(19).sub(K.z.mul(0.02)), off.mul(0.03).add(0.3), K.z.mul(0.03).add(0.5))).level(0).r;
  const fr = fract(u.mul(72).add(K.w.mul(3)));
  const dash = mix(float(1), smoothstep(0.25, 0.4, fr).mul(smoothstep(0.75, 0.9, fr).oneMinus()), K.y);
  const pulse = mix(float(1), sin(K.z.mul(K.y.mul(5).add(3.5))).mul(0.45).add(0.55), K.y);
  const col = vec3(0.6, 0.78, 1.9).mul(core).mul(fl2.mul(1.6).add(1.4)).mul(dash).add(vec3(0.62, 0.25, 1.45).mul(inner).mul(fl.mul(fl).mul(1.3).add(0.2)).mul(0.55)).mul(K.x.mul(pulse).mul(vU.z));
  const m = new T.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: T.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }); m.fog = false;
  m.fragmentNode = vec4(col, 1);
  return M5.registrar('tempestade-borda', m);
};

/* ---------- chuva de éter (riscos e respingos na GPU) ---------- */
M5.tempestadeChuva = function (URn) {
  const T = window.THREE_M5, L = window.TSL;
  const { Fn, float, vec2, vec3, vec4, attribute, positionGeometry, cameraPosition, cameraProjectionMatrix, cameraViewMatrix, varying, fract, floor, sin, cos, sqrt, max, mix, smoothstep, clamp, normalize, cross, length, select, step, abs, Discard, If } = L;
  const aR = attribute('aR', 'vec4'); const pos = positionGeometry; const uR = URn.uR, uC = URn.uC, uHm4 = URn.uHm4, uT = URn.uT;
  const h1 = n => fract(sin(n).mul(43758.5453));
  const fall = aR.z.mul(25).add(175), spd = aR.y.mul(140).add(330), per = fall.div(spd).add(0.12);
  const cyc = uT.div(per).add(aR.w.mul(17)); const k = fract(cyc), ci = floor(cyc);
  const s1 = h1(aR.x.mul(911).add(ci.mul(12.9898))), s2 = h1(aR.x.mul(577).add(ci.mul(78.233)));
  const rr = sqrt(s1).mul(0.985).mul(uC.w), th = s2.mul(6.2831853);
  const lp = vec2(cos(th), sin(th)).mul(rr); const tg = vec2(lp.y, lp.x.negate()).div(max(rr, 1));
  const g = uHm4.y.add(URn.uHm.sample(lp.mul(uHm4.x).add(0.5)).level(0).r.mul(uHm4.z)); const yTop = max(fall, g.add(40)); const vd = step(uHm4.w.sub(3), g).oneMinus(); /* abismo: sem respingo (g < piso − 3) */
  const kf = fall.add(spd.mul(0.12)).div(fall); const kk = k.mul(kf); /* parte do ciclo caindo; o resto é o respingo */
  const C = uC.xyz;
  /* gota caindo */
  const y = mix(yTop, g, kk); const w = tg.mul(uR.y); const xz = lp.add(w.mul(kk.oneMinus()).mul(per).mul(0.6));
  const head = C.add(vec3(xz.x, y, xz.y)); const vel = normalize(vec3(w.x, spd.negate(), w.y)); const len = aR.y.mul(9).add(9);
  const tail = head.sub(vel.mul(len)); const mid = mix(tail, head, pos.y.add(0.5));
  const side = normalize(cross(vel, cameraPosition.sub(mid))); const wd = max(0.45, length(cameraPosition.sub(mid)).mul(0.0019));
  const Pq = mid.add(side.mul(pos.x).mul(wd)); const aQ = pos.y.add(0.5).mul(smoothstep(0.0, 0.08, kk)).mul(vd.mul(smoothstep(0.5, 1.0, kk)).oneMinus()).mul(uR.z);
  /* respingo */
  const ks = clamp(clamp(fract(cyc).mul(kf).sub(1), 0, 1).div(max(kf.sub(1), 0.01)), 0, 1);
  const s = ks.mul(2.6).add(0.8); const Pr = C.add(vec3(lp.x.add(pos.x.mul(2).mul(s)), g.add(0.8), lp.y.sub(pos.y.mul(2).mul(s)))); const aS = ks.oneMinus().mul(uR.z).mul(vd.oneMinus()).mul(step(0.6, fract(aR.z.mul(7)))).mul(0.8);
  const cai = kk.lessThan(1); const P = select(cai, Pq, Pr);
  const vis = aR.x.lessThanEqual(uR.x);
  const vA = varying(select(vis, select(cai, aQ, aS), float(0))), vS = varying(select(cai, float(0), float(1))), vQ = varying(pos.xy);
  const m = new T.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: T.AdditiveBlending }); m.fog = false;
  m.vertexNode = select(vis, cameraProjectionMatrix.mul(cameraViewMatrix).mul(vec4(P, 1)), vec4(2, 2, 2, 1));
  m.fragmentNode = Fn(() => { const r = length(vQ).mul(2); const x = abs(vQ.x).mul(2); const a = select(vS.greaterThan(0.5), smoothstep(0.55, 0.85, r).mul(smoothstep(0.85, 1.0, r).oneMinus()).mul(vA).mul(0.9), x.mul(x).oneMinus().mul(vA)).toVar();
    If(a.lessThan(0.004), () => { Discard(); }); return vec4(vec3(0.34, 0.36, 1.2).mul(a).mul(0.62), 1); })();
  return M5.registrar('tempestade-chuva', m);
};

/* ---------- raios: canal com ramos, líder descendo e golpes de retorno ---------- */
M5.tempestadeRaios = function (UBo) {
  const T = window.THREE_M5, L = window.TSL;
  const { Fn, float, vec2, vec3, vec4, attribute, positionGeometry, cameraPosition, cameraProjectionMatrix, cameraViewMatrix, varying, fract, floor, exp, mix, smoothstep, clamp, normalize, cross, length, select, max, abs, Discard, If } = L;
  const aA = attribute('aA', 'vec4'), aB = attribute('aB', 'vec4'), aC = attribute('aC', 'vec4'); const pos = positionGeometry; const uT = UBo.uT;
  const strokes = (t, sd) => { const t2 = t.sub(0.06).sub(sd.mul(0.03)), t3 = t.sub(0.15).sub(sd.mul(0.05)), t4 = t.sub(0.28).sub(sd.mul(0.06));
    return exp(t.mul(-26)).add(select(t2.greaterThan(0), exp(t2.mul(-24)).mul(0.85), float(0))).add(select(t3.greaterThan(0), exp(t3.mul(-20)).mul(0.6), float(0))).add(select(t4.greaterThan(0), exp(t4.mul(-12)).mul(0.4), float(0))); };
  const age = uT.sub(aC.x); const along = fract(aC.w), sd = floor(aC.w).div(100);
  const off = aC.y.lessThanEqual(0).or(age.lessThan(0)).or(age.greaterThan(aC.y)).or(along.greaterThan(clamp(age.div(0.05), 0, 1).add(0.001)));
  const I = select(age.lessThan(0.05), float(0.35), strokes(age.sub(0.05), sd)).mul(smoothstep(max(aC.y, 0.001).mul(0.7), max(aC.y, 0.001), age).oneMinus()).mul(aC.z); /* trecho sem raio (vida 0): bordas distintas */
  const P0 = mix(aA.xyz, aB.xyz, pos.y.add(0.5)); const dir = normalize(aB.xyz.sub(aA.xyz)); const side = normalize(cross(dir, cameraPosition.sub(P0)));
  const w = max(mix(aA.w, aB.w, pos.y.add(0.5)).mul(9), length(cameraPosition.sub(P0)).mul(0.012));
  const P = P0.add(side.mul(pos.x).mul(w));
  const vQ = varying(vec2(pos.x.mul(2), pos.y.add(0.5))), vI = varying(select(off, float(0), I));
  const m = new T.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: T.AdditiveBlending }); m.fog = false;
  m.vertexNode = select(off, vec4(2, 2, 2, 1), cameraProjectionMatrix.mul(cameraViewMatrix).mul(vec4(P, 1)));
  m.fragmentNode = Fn(() => { const x = abs(vQ.x); const core = exp(x.mul(x).mul(-110)), glow = exp(x.mul(x).mul(-9)).mul(0.32).add(exp(x.mul(-3.2)).mul(0.1));
    const col = vec3(0.85, 0.9, 1.0).mul(core).mul(7).add(vec3(0.55, 0.36, 1.35).mul(glow).mul(2.6)).mul(vI).toVar(); If(col.x.add(col.y).add(col.z).lessThan(0.004), () => { Discard(); }); return vec4(col, 1); })();
  return M5.registrar('tempestade-raios', m);
};
})(globalThis.ARD = globalThis.ARD || {});
