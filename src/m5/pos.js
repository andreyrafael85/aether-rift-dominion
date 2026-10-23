/* Aether Rift: Dominion — Motor 5 (5.0a, fase 1): pós-processamento no RenderPipeline do three r186 (o PostProcessing virou RenderPipeline no r183).
   Mesma cadeia do buildPP de hoje: cena → oclusão ambiente (GTAONode; meia resolução no Média) → bruma de altura e perspectiva aérea
   (a ArdAtmo portada para TSL, com sombras de nuvem) → bloom (BloomNode) → gradação por clima, noite e Raça → tons ACES (renderOutput)
   → SMAA (FXAA no celular). Opção preparada: ?m5up=fsr1 troca a resolução dinâmica do renderer pela do passe da cena e sobe com o FSR1.
   O objeto devolvido imita o composer do clássico (render, setSize, dispose) e expõe atmoFx.U e gradeFx.U com as mesmas chaves,
   para o render3d atualizar os uniforms sem mudar de código. */
(function (ARD) {
'use strict';
const M5 = ARD.m5 = ARD.m5 || {};
const Q = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
M5.up = Q.get('m5up') === 'fsr1' ? 'fsr1' : null; /* TAAU fica para quando houver o passe de velocidade (fase 3) */
M5.buildPost = function (X, scene, camera, q, opts) {
  opts = opts || {}; const Tm = window.THREE_M5, L = window.TSL, A = window.THREE_M5_ADDONS; const r = X.renderer;
  const { pass, uniform, texture, float, vec2, vec3, vec4, mix, smoothstep, clamp, max, min, exp, abs, pow, dot, length, distance, uv, getViewPosition, renderOutput, step, luminance, convertToTexture } = L;
  const S = ARD.sim, off = opts.off || new Set();
  const pipe = new Tm.RenderPipeline(r); pipe.outputColorTransform = false; /* tons e espaço de cor no fim da cadeia, antes do SMAA (como no clássico) */
  const sp = pass(scene, camera, { samples: 0 }); /* sem MSAA no passe: a profundidade é lida pelo GTAO e pela bruma */
  const color = sp.getTextureNode('output'), depth = sp.getTextureNode('depth');
  let base = color;
  if (M5.up === 'fsr1' && A.fsr1) base = A.fsr1(color, 0.25, false); /* sobe a cena da escala do passe para a tela (antes da bruma e do bloom) */
  let c = base; let aoN = null;
  if (q.ssao && A.ao && !off.has('ao')) { aoN = A.ao(depth, null, camera); aoN.resolutionScale = q.aoHalf ? 0.5 : 1; aoN.radius.value = 14; aoN.thickness.value = 9; aoN.distanceExponent.value = 1.4; aoN.distanceFallOff.value = 1; aoN.scale.value = 1.25; aoN.samples.value = q.aoHalf ? 12 : q.resolved === 'ultra' ? 24 : 16;
    const ao = aoN.getTextureNode().r; c = vec4(c.rgb.mul(mix(vec3(0.03, 0.025, 0.03), vec3(1), ao)), c.a); } /* sombra de contato puxando para o tom do N8AO de hoje */
  /* bruma de altura com perspectiva aérea (integral exata ao longo do raio), luz do sol espalhada e sombras de nuvem: a ArdAtmo em TSL */
  const U = { uAtProjInv: uniform(new Tm.Matrix4()), uAtCamWorld: uniform(new Tm.Matrix4()), uAtFog: uniform(new Tm.Color(0.6, 0.66, 0.74)), uAtFar: uniform(new Tm.Color(0.6, 0.66, 0.74)), uAtSun: uniform(new Tm.Color(0.25, 0.2, 0.12)), uAtSunDir: uniform(new Tm.Vector3(-0.4, 0.7, 0.5).normalize()), uAtP: uniform(new Tm.Vector4(1 / 2600, 1 / 70, 0, 120)), uAtQ: uniform(new Tm.Vector4(1 / 14000, S ? S.WORLD : 6000, 0, 0.2)), uAtCloud: texture(opts.cloud || M5.tex.nuvem.value), uAtCov: uniform(0) };
  let atmoFx = null;
  if (!off.has('bruma')) {
    const atmo = (ic0, dz) => { /* função JS que monta o grafo, sem ramos (select/If com amostra de textura dentro saía preto nos dois motores) */
      const ic = vec4(max(ic0.rgb, vec3(0)), ic0.a); const cov = U.uAtCov.mul(clamp(float(1).sub(ic.a), 0, 1));
      const vp = getViewPosition(uv(), dz, U.uAtProjInv); const wp = U.uAtCamWorld.mul(vec4(vp, 1)).xyz; const co = U.uAtCamWorld.element(3).xyz;
      const rd0 = wp.sub(co), dist = length(rd0), rd = rd0.div(max(dist, 0.001)); const d = max(0, dist.sub(U.uAtP.w));
      const a = U.uAtP.x.mul(exp(U.uAtP.y.negate().mul(co.y.sub(U.uAtP.z)))); const b = U.uAtP.y.mul(rd.y);
      const x = b.mul(d), xs = max(abs(x), 0.0001).mul(step(0, x).mul(2).sub(1)); const od = a.mul(d).mul(float(1).sub(exp(xs.negate())).div(xs)).add(U.uAtQ.x.mul(d)); /* a·(1−e^(−b·d))/b sem ramo (b·d perto de zero tende a a·d) */
      const fog = min(float(1).sub(exp(max(od, 0).negate())), 0.85); const sd = pow(max(dot(rd, U.uAtSunDir), 0), 7);
      const fc = mix(U.uAtFog, U.uAtFar, smoothstep(700, 2600, dist)).add(U.uAtSun.mul(sd));
      const cl = U.uAtCloud.sample(vec2(wp.x, wp.z.negate()).div(U.uAtQ.y).mul(5).add(vec2(U.uAtQ.z.mul(0.006), U.uAtQ.z.mul(0.0035)))).r;
      const shade = float(1).sub(U.uAtQ.w.mul(float(1).sub(cov)).mul(float(1).sub(cl)).mul(float(1).sub(smoothstep(1800, 2600, dist)))); /* além de 2600 o fator já é 1 */
      let out = vec4(mix(ic.rgb.mul(shade), fc, fog.mul(float(1).sub(cov.mul(0.8)))), 1);
      const dbg = opts.atmoDbg || 0; if (dbg === 1) out = vec4(ic.rgb, 1); else if (dbg === 2) out = vec4(vec3(fog), 1); else if (dbg === 3) out = vec4(vec3(dist.div(3000)), 1); else if (dbg === 4) out = vec4(vec3(shade), 1); else if (dbg === 5) out = vec4(fc, 1); else if (dbg === 6) out = vec4(vec3(dz), 1); else if (dbg === 7) out = vec4(co.div(2000).abs(), 1); else if (dbg === 8) out = vec4(wp.div(6000).abs(), 1); /* diagnóstico (R.m5post) */
      return mix(out, vec4(ic.rgb, 1), step(0.999999, dz)); /* céu (sem profundidade) fica de fora; sem select: o ConditionalNode com amostra de textura dentro saía preto */
    };
    c = atmo(c, depth.r); atmoFx = { U, name: 'ArdAtmo-TSL' };
  } else c = vec4(max(c.rgb, vec3(0)), 1);
  c = convertToTexture(c); /* um alvo só para a cena com AO e bruma: o bloom e a gradação leem a mesma textura (a bruma não roda duas vezes) */
  let bloomN = null;
  if (!off.has('bloom') && A.bloom) { bloomN = A.bloom(c, 0.55, 0.62, 1.0); bloomN.smoothWidth.value = 0.35; c = vec4(c.rgb.add(bloomN.rgb), 1); }
  /* gradação (linear, antes dos tons): ganho por canal, elevação, saturação, contraste em torno de 0,18 e vinheta; muda com o clima, a noite e a Raça */
  const GU = { uGain: uniform(new Tm.Vector3(1.03, 1.0, 0.97)), uLift: uniform(new Tm.Vector3(0, 0, 0.004)), uSat: uniform(1.08), uCon: uniform(1.06), uVig: uniform(0.28) };
  { let col = c.rgb.mul(GU.uGain).add(GU.uLift); const l = luminance(col); col = mix(vec3(l), col, GU.uSat); col = pow(max(col.div(0.18), vec3(0)), vec3(GU.uCon)).mul(0.18); const dv = distance(uv(), vec2(0.5)); col = col.mul(float(1).sub(GU.uVig.mul(smoothstep(0.35, 0.85, dv)))); c = vec4(col, 1); }
  c = renderOutput(c); /* ACES do renderer (toneMapping) e sRGB (outputColorSpace) */
  const touch = matchMedia('(pointer: coarse)').matches;
  if (!off.has('aa')) c = touch ? A.fxaa(c) : A.smaa(c);
  pipe.outputNode = vec4(c.rgb, 1);
  const P = { pipe, scenePass: sp, aoNode: aoN, bloomNode: bloomN, atmoFx, gradeFx: { U: GU, name: 'ArdGrade-TSL' }, scale: 1,
    render() { pipe.render(); },
    setSize() { /* os nós do pós seguem o tamanho do renderer sozinhos */ },
    setPixelRatio() {},
    setScale(s) { P.scale = s; sp.setResolutionScale(s); }, /* só com ?m5up=fsr1 (resolução dinâmica no passe da cena) */
    dispose() { try { pipe.dispose(); sp.dispose(); if (aoN) aoN.dispose(); if (bloomN) bloomN.dispose(); } catch (e) {} } };
  return P;
};
})(globalThis.ARD = globalThis.ARD || {});
