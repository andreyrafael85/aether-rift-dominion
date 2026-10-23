/* Aether Rift: Dominion — Motor 5 (5.0a, fase 1): texturas compartilhadas desenhadas na GPU.
   Mapa de clarões (o flashInit/flashRender do render3d em TSL: discos e cones de luz num alvo 512² meia precisão visto de cima)
   e mapa de cicatrizes do chão (o TR.scars em TSL: rastros, queimados e crateras num mapa do mundo que some devagar).
   Convenção do TSL para alvos de render: uv.y = 0 é o alto da imagem nos dois motores; os passes aqui escrevem já invertidos para
   que a amostragem use o mesmo uv do clássico ((x, z) − retângulo para os clarões; (x, y) do mapa / mundo para as cicatrizes). */
(function (ARD) {
'use strict';
const M5 = ARD.m5 = ARD.m5 || {};
/* clarões: monta o alvo, as geometrias instanciadas e os dois materiais; o resto (lista, vida, envio dos atributos, desenho) é o mesmo flashRender do render3d */
M5.flashInit = function (FL, FL_N, FLC_N, ME2) {
  const Tm = window.THREE_M5, L = window.TSL; const { attribute, positionGeometry, vec2, vec4, float, dot, smoothstep, abs, cos, sin, varying } = L;
  FL.rt = new Tm.RenderTarget(512, 512, { type: Tm.HalfFloatType, depthBuffer: false, magFilter: Tm.LinearFilter, minFilter: Tm.LinearFilter, generateMipmaps: false }); FL.rt.texture.name = 'ard-claroes';
  FL.rect = M5.u.claraoRet.value; /* o mesmo Vector4 do uniform compartilhado: o flashRender ajusta e os materiais leem */
  const q = new Tm.PlaneGeometry(1, 1); const g = new Tm.InstancedBufferGeometry(); g.index = q.index; g.setAttribute('position', q.attributes.position); g.instanceCount = 0;
  FL.fa = new Tm.InstancedBufferAttribute(new Float32Array(FL_N * 4), 4); FL.fc = new Tm.InstancedBufferAttribute(new Float32Array(FL_N * 3), 3); FL.fa.setUsage(Tm.DynamicDrawUsage); FL.fc.setUsage(Tm.DynamicDrawUsage); g.setAttribute('fA', FL.fa); g.setAttribute('fC', FL.fc); FL.geo = g;
  const rect = M5.u.claraoRet;
  const mat = new Tm.MeshBasicNodeMaterial({ transparent: true, depthTest: false, depthWrite: false, blending: Tm.AdditiveBlending }); mat.fog = false; mat.toneMapped = false;
  { const fA = attribute('fA', 'vec4'); const p2 = positionGeometry.xy.mul(2); const w = fA.xy.add(p2.mul(fA.z)); const n = w.sub(rect.xy).div(rect.zw).mul(2).sub(1);
    mat.vertexNode = vec4(n.x, n.y.negate(), 0, 1); const vQ = varying(p2); const d = dot(vQ, vQ); const f = float(1).sub(d);
    mat.maskNode = d.lessThanEqual(1); mat.colorNode = attribute('fC', 'vec3').mul(f.mul(f)); mat.opacityNode = float(1); }
  FL.mesh = new Tm.Mesh(g, mat); FL.mesh.frustumCulled = false; FL.scene = new Tm.Scene(); FL.scene.add(FL.mesh); FL.cam = new Tm.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const gc = new Tm.InstancedBufferGeometry(); gc.index = q.index; gc.setAttribute('position', q.attributes.position); gc.instanceCount = 0; FL.ca = new Tm.InstancedBufferAttribute(new Float32Array(FLC_N * 4), 4); FL.cc = new Tm.InstancedBufferAttribute(new Float32Array(FLC_N * 4), 4); FL.ca.setUsage(Tm.DynamicDrawUsage); FL.cc.setUsage(Tm.DynamicDrawUsage); gc.setAttribute('cA', FL.ca); gc.setAttribute('cC', FL.cc); FL.cgeo = gc;
  const matC = new Tm.MeshBasicNodeMaterial({ transparent: true, depthTest: false, depthWrite: false, blending: Tm.AdditiveBlending }); matC.fog = false; matC.toneMapped = false;
  { const cA = attribute('cA', 'vec4'), cC = attribute('cC', 'vec4'); const along = positionGeometry.y.add(0.5); const dd = vec2(cos(cA.z), sin(cA.z).negate()), pp = vec2(dd.y.negate(), dd.x);
    const w = cA.xy.add(dd.mul(along.mul(cA.w))).add(pp.mul(positionGeometry.x.mul(cC.w))); const n = w.sub(rect.xy).div(rect.zw).mul(2).sub(1); matC.vertexNode = vec4(n.x, n.y.negate(), 0, 1);
    const vL = varying(vec2(positionGeometry.x.mul(2), along)); const al = vL.y, ww = abs(vL.x); const cone = float(1).sub(smoothstep(al.mul(0.7).add(0.2), al.mul(0.65).add(0.35), ww)); const a = cone.mul(float(1).sub(al)).mul(float(1).sub(al)).mul(smoothstep(0.0, 0.12, al));
    matC.colorNode = cC.rgb.mul(a); matC.opacityNode = float(1); }
  FL.cmesh = new Tm.Mesh(gc, matC); FL.cmesh.frustumCulled = false; FL.scene.add(FL.cmesh);
  M5.tex.clarao.value = FL.rt.texture; if (ME2) { ME2.uFlash.value = FL.rt.texture; ME2.uFlashR.value = FL.rect; }
  M5.registrar('claroes-disco', mat); M5.registrar('claroes-cone', matC);
  return true;
};

/* cicatrizes do chão: mesma API do TR.scars (tex, track, burn, flush, dispose) */
M5.scars = function (renderer, W, N) {
  const Tm = window.THREE_M5, L = window.TSL; const { attribute, uv, vec2, vec4, float, abs, step, fract, floor, smoothstep, length, atan, mix, sin, dot, max } = L;
  const FIXAS = /marcasfixas=1/.test(location.search);
  const rt = new Tm.RenderTarget(N, N, { type: Tm.HalfFloatType, depthBuffer: false, generateMipmaps: false, minFilter: Tm.LinearFilter, magFilter: Tm.LinearFilter }); rt.texture.name = 'ard-cicatrizes';
  const scene = new Tm.Scene(), cam = new Tm.OrthographicCamera(0, W, 0, W, -1, 1); /* alto = 0, baixo = W: y do mapa cresce para baixo na imagem (uv.y = y / W) */ const MAX = 1024;
  const kAttr = new Tm.InstancedBufferAttribute(new Float32Array(MAX * 4), 4); kAttr.setUsage(Tm.DynamicDrawUsage);
  const geo = new Tm.PlaneGeometry(1, 1); geo.setAttribute('aK', kAttr);
  const mat = new Tm.MeshBasicNodeMaterial({ depthTest: false, depthWrite: false, transparent: true, side: Tm.DoubleSide, blending: Tm.CustomBlending, blendEquation: Tm.MaxEquation, blendSrc: Tm.OneFactor, blendDst: Tm.OneFactor, blendEquationAlpha: Tm.MaxEquation, blendSrcAlpha: Tm.OneFactor, blendDstAlpha: Tm.OneFactor }); mat.fog = false; mat.toneMapped = false;
  { const K = attribute('aK', 'vec4'); const kind = K.x, k = K.y, len = K.z, sd = K.w; const u = uv();
    const hs = p => fract(sin(dot(p, vec2(127.1, 311.7))).mul(43758.5453));
    const a = abs(u.x.sub(0.5));
    const trk = smoothstep(0.13, 0.17, a).mul(float(1).sub(smoothstep(0.38, 0.44, a))).mul(step(0.5, fract(u.y.mul(len).div(1.7))).mul(0.38).add(0.62)).mul(k); /* lagarta e rodas */
    const org = float(1).sub(smoothstep(0.12, 0.5, a)).mul(step(0.45, fract(u.y.mul(len).div(3.2).add(step(0.5, u.x).mul(0.5)))).mul(0.55).add(0.45)).mul(k).mul(0.75); /* pegadas das criaturas */
    const qv = u.mul(2).sub(1), rr0 = length(qv), ang = atan(qv.y, qv.x); const a7 = ang.mul(7 / 6.2831853).add(3.5), a17 = ang.mul(17 / 6.2831853).add(8.5);
    const n1 = mix(hs(vec2(floor(a7), sd)), hs(vec2(floor(a7).add(1), sd)), smoothstep(0, 1, fract(a7))), n2 = hs(vec2(floor(a17), sd.add(3.1))); const jag = n1.mul(0.24).add(n2.mul(0.1)).add(0.66); const rr = rr0.div(jag);
    const ray = smoothstep(0.55, 0.95, hs(vec2(floor(ang.mul(23 / 6.2831853).add(11.5)), sd.add(7.7)))).mul(float(1).sub(smoothstep(0.45, 1.0, rr0))).mul(smoothstep(0.2, 0.45, rr0));
    const burnG = max(float(1).sub(smoothstep(0.1, 1.0, rr)), ray.mul(0.55)).mul(k), burnB = float(1).sub(smoothstep(0.0, 0.8, rr)).mul(k).mul(len), burnA = float(1).sub(smoothstep(0.05, 0.5, rr)).mul(k);
    const isT = step(kind, 0.5), isO = step(0.5, kind).mul(step(kind, 1.5)), isB = step(1.5, kind);
    const o = vec4(trk.mul(isT).add(org.mul(isO)), burnG.mul(isB), burnB.mul(isB), burnA.mul(isB));
    mat.colorNode = o.rgb; mat.opacityNode = o.a; }
  const inst = new Tm.InstancedMesh(geo, mat, MAX); inst.frustumCulled = false; inst.count = 0; scene.add(inst);
  const fadeScene = new Tm.Scene(); const fadeMat = new Tm.MeshBasicNodeMaterial({ color: 0xffffff, blending: Tm.CustomBlending, blendEquation: Tm.AddEquation, blendSrc: Tm.ZeroFactor, blendDst: Tm.SrcColorFactor, blendEquationAlpha: Tm.AddEquation, blendSrcAlpha: Tm.ZeroFactor, blendDstAlpha: Tm.SrcAlphaFactor, depthTest: false, depthWrite: false, transparent: true, side: Tm.DoubleSide }); fadeMat.fog = false; fadeMat.toneMapped = false;
  const fq = new Tm.Mesh(new Tm.PlaneGeometry(W, W), fadeMat); fq.position.set(W / 2, W / 2, 0); fq.frustumCulled = false; fadeScene.add(fq);
  const _m = new Tm.Matrix4(), _q = new Tm.Quaternion(), _p = new Tm.Vector3(), _s = new Tm.Vector3(), Z = new Tm.Vector3(0, 0, 1);
  let n = 0, fadeT = 0, cleared = false;
  const push = (x, y, ang, w, l, kind, k, extra, seed) => { if (n >= MAX) return; _p.set(x, y, 0); _q.setFromAxisAngle(Z, ang - Math.PI / 2); _s.set(w, l, 1); _m.compose(_p, _q, _s); inst.setMatrixAt(n, _m); kAttr.setXYZW(n, kind, k, extra, seed || 0); n++; };
  M5.tex.cicatrizes.value = rt.texture; M5.registrar('cicatrizes', mat); M5.registrar('cicatrizes-esmaece', fadeMat);
  return { tex: rt.texture,
    track(x, y, ang, w, len, k, organic) { push(x, y, ang, w, len, organic ? 1 : 0, k, len); },
    burn(x, y, r, k, crater) { push(x, y, 0, r * 2, r * 2, 2, k, crater || 0, (x * 7 + y * 13) % 97); },
    flush(dt) { const prev = renderer.getRenderTarget(), pa = renderer.autoClear;
      renderer.setRenderTarget(rt); renderer.autoClear = false;
      if (!cleared) { renderer.setClearColor(0x000000, 0); renderer.clear(true, false, false); cleared = true; }
      fadeT += dt; if (fadeT > 0.5) { const f = fadeT; fadeT = 0; if (!FIXAS) { fadeMat.color.setRGB(Math.pow(0.9962, f), Math.pow(0.9981, f), Math.pow(0.9989, f)); fadeMat.opacity = Math.pow(0.87, f); renderer.render(fadeScene, cam); } }
      if (n) { inst.count = n; inst.instanceMatrix.needsUpdate = true; kAttr.needsUpdate = true; renderer.render(scene, cam); n = 0; }
      renderer.setRenderTarget(prev); renderer.autoClear = pa; },
    dispose() { rt.dispose(); geo.dispose(); mat.dispose(); fadeMat.dispose(); fq.geometry.dispose(); } };
};
})(globalThis.ARD = globalThis.ARD || {});
