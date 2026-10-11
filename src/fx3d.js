/* Aether Rift: Dominion — efeitos 3D na GPU (4.2c).
   Partículas instanciadas: cada uma é um quadrado que o vertex shader vira de frente para a câmera (ou deita no chão, nas ondas
   de choque) e move por conta própria (posição inicial + velocidade·t + gravidade·t²/2). A CPU só escreve quando nasce uma
   partícula; não há laço por partícula a cada quadro. Dois lotes: aditivo (fogo, clarão, faísca, brilho, onda) e
   translúcido (fumaça, poeira, destroço). Formas desenhadas no fragment shader, sem texturas. */
(function (ARD) {
'use strict';
// tipos (iC.w): 0 fogo 1 clarão 2 faísca (esticada na direção do movimento) 3 fumaça 4 poeira 5 destroço 6 onda no chão 7 brilho 8 anel vertical
// atributos por partícula: iA = posição inicial + instante de nascimento; iB = velocidade + vida; iC = tamanho inicial, final, -, tipo;
// iD = gravidade, curva do tamanho, giro, opacidade; iE = cor + semente
function create(THREE, scene, opts) {
  opts = opts || {}; const CAP = opts.cap || 4096;
  const uniforms = { uTime: { value: 0 }, uCamR: { value: new THREE.Vector3(1, 0, 0) }, uCamU: { value: new THREE.Vector3(0, 1, 0) } };
  const quad = new THREE.PlaneGeometry(1, 1);
  const vs = `
attribute vec4 iA; attribute vec4 iB; attribute vec4 iC; attribute vec4 iD; attribute vec4 iE;
uniform float uTime; uniform vec3 uCamR; uniform vec3 uCamU;
varying vec2 vUv; varying float vAge; varying vec3 vCol; varying float vType; varying float vSeed; varying float vA;
void main() {
  float t = uTime - iA.w; float life = max(iB.w, 0.001); float age = t / life; vType = iC.w; vSeed = iE.w;
  if (age < 0.0 || age > 1.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); vAge = 0.0; return; }
  vec3 p = iA.xyz + iB.xyz * t + vec3(0.0, -iD.x * 0.5 * t * t, 0.0);
  float e = 1.0 - pow(1.0 - age, iD.y); float size = mix(iC.x, iC.y, e);
  if (iC.w > 2.5 && iC.w < 4.5) p.y = max(p.y, iA.y + size * 0.42); // fumaça e poeira não atravessam o chão de onde nasceram
  vec3 off;
  if (iC.w > 5.5 && iC.w < 6.5) off = vec3(position.x, 0.0, -position.y) * size;
  else if (iC.w > 7.5) off = (uCamR * position.x + vec3(0.0, 1.0, 0.0) * position.y) * size;
  else { float ang = iD.z * t + iE.w * 6.2831; float c = cos(ang), s = sin(ang); vec2 q = vec2(c * position.x - s * position.y, s * position.x + c * position.y);
    if (iC.w > 1.5 && iC.w < 2.5) { vec3 vel = iB.xyz + vec3(0.0, -iD.x * t, 0.0); vec4 v4 = modelViewMatrix * vec4(vel, 0.0); vec2 d = normalize(v4.xy + vec2(0.0001)); float L = 1.0 + length(v4.xy) * 0.025; q = vec2(position.x * d.x * L - position.y * d.y, position.x * d.y * L + position.y * d.x); }
    off = (uCamR * q.x + uCamU * q.y) * size; }
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p + off, 1.0);
  vUv = position.xy + 0.5; vAge = age; vCol = iE.xyz; vA = iD.w;
}`;
  const fs = `
varying vec2 vUv; varying float vAge; varying vec3 vCol; varying float vType; varying float vSeed; varying float vA;
float hh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float nn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hh(i), hh(i + vec2(1, 0)), f.x), mix(hh(i + vec2(0, 1)), hh(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p) { return nn(p) * 0.55 + nn(p * 2.1 + 3.7) * 0.3 + nn(p * 4.3 + 7.1) * 0.15; }
void main() {
  vec2 c = vUv - 0.5; float r = length(c) * 2.0; float a = 0.0; vec3 col = vCol; float k = vAge;
  if (vType < 0.5) { // fogo: bola com borda irregular; cor esfria com a idade
    float nz = fbm(c * 4.0 + vSeed * 13.0 + k * 2.0); float edge = 1.0 - smoothstep(0.55, 1.0, r + (nz - 0.5) * 0.55);
    float hot = (1.0 - k) * (1.0 - r * 0.8); col = mix(vec3(0.35, 0.08, 0.02), mix(vec3(1.0, 0.45, 0.08), vec3(1.6, 1.25, 0.7), smoothstep(0.35, 0.9, hot)), smoothstep(0.0, 0.5, hot)) * vCol;
    a = edge * (1.0 - smoothstep(0.55, 1.0, k)) * (0.75 + 0.5 * nz);
  } else if (vType < 1.5) { float g = exp(-r * r * 5.0) * (1.0 - smoothstep(0.6, 1.0, r)); a = g * (1.0 - k) * (1.0 - k); col = vCol * (1.0 + 2.0 * g); }
  else if (vType < 2.5) { float g = exp(-r * r * 9.0); a = g * (1.0 - k); col = vCol * 2.0; }
  else if (vType < 3.5) { // fumaça macia
    float nz = fbm(c * 3.0 + vSeed * 11.0 + vec2(k * 0.6, -k)); float body = 1.0 - smoothstep(0.35, 1.0, r + (nz - 0.5) * 0.6);
    a = body * smoothstep(0.0, 0.12, k) * (1.0 - smoothstep(0.45, 1.0, k)) * (0.55 + 0.45 * nz); col = vCol * (0.75 + 0.35 * nz);
  } else if (vType < 4.5) { float nz = fbm(c * 5.0 + vSeed * 7.0); a = (1.0 - smoothstep(0.3, 1.0, r + nz * 0.3)) * (1.0 - k) * 0.8; col = vCol * (0.8 + 0.3 * nz); }
  else if (vType < 5.5) { float sq = max(abs(c.x), abs(c.y)) * 2.0; a = (1.0 - smoothstep(0.6, 0.9, sq)) * (1.0 - smoothstep(0.85, 1.0, k)); col = vCol * (0.6 + 0.4 * hh(floor(vUv * 3.0) + vSeed)); }
  else if (vType < 6.5) { float ring = smoothstep(0.8, 0.95, r) * (1.0 - smoothstep(0.96, 1.0, r)); float inner = (1.0 - smoothstep(0.0, 0.9, r)) * 0.18 * (1.0 - k); a = (ring + inner) * (1.0 - k) * (1.0 - k); col = vCol * 1.6; }
  else if (vType < 7.5) { float g = exp(-r * r * 3.0) * (1.0 - smoothstep(0.6, 1.0, r)); a = g * (1.0 - k); col = vCol * 1.4; }
  else { float ring = smoothstep(0.7, 0.88, r) * (1.0 - smoothstep(0.9, 1.0, r)); a = ring * (1.0 - k); col = vCol * 1.8; }
  if (vType < 0.5 || (vType > 2.5 && vType < 4.5)) a *= 1.0 - smoothstep(0.78, 0.98, r); // ruído nunca chega à borda do quadrado
  a *= vA; if (a < 0.003) discard;
  gl_FragColor = vec4(col, a);
}`;
  function batch(blending) {
    const geo = new THREE.InstancedBufferGeometry(); geo.index = quad.index; geo.setAttribute('position', quad.attributes.position); geo.instanceCount = CAP;
    const at = {}; for (const k of ['iA', 'iB', 'iC', 'iD', 'iE']) { const a = new THREE.InstancedBufferAttribute(new Float32Array(CAP * 4), 4); a.setUsage(THREE.DynamicDrawUsage); geo.setAttribute(k, a); at[k] = a; }
    for (let i = 0; i < CAP; i++) at.iA.array[i * 4 + 3] = -1e6; // nascidas "há muito tempo": invisíveis
    const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: vs, fragmentShader: fs, transparent: true, depthWrite: false, blending, fog: false });
    const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.renderOrder = blending === THREE.AdditiveBlending ? 12 : 10; scene.add(mesh);
    return { geo, at, mesh, i: 0, dirty: false, lo: CAP, hi: -1 };
  }
  const add = batch(THREE.AdditiveBlending), alp = batch(THREE.NormalBlending);
  const FX = { time: 0, mult: 1, add, alp };
  // emite uma partícula: p=[x,y,z] (mundo three), v=[vx,vy,vz], life, s0, s1, type, col=[r,g,b], g=gravidade, ease, spin, alpha, delay
  FX.emit = function (b, p, v, life, s0, s1, type, col, g, ease, spin, alpha, delay) {
    const i = b.i; b.i = (b.i + 1) % CAP; const o = i * 4; const A = b.at;
    A.iA.array[o] = p[0]; A.iA.array[o + 1] = p[1]; A.iA.array[o + 2] = p[2]; A.iA.array[o + 3] = FX.time + (delay || 0);
    A.iB.array[o] = v[0]; A.iB.array[o + 1] = v[1]; A.iB.array[o + 2] = v[2]; A.iB.array[o + 3] = life;
    A.iC.array[o] = s0; A.iC.array[o + 1] = s1; A.iC.array[o + 2] = 0; A.iC.array[o + 3] = type;
    A.iD.array[o] = g || 0; A.iD.array[o + 1] = ease || 2; A.iD.array[o + 2] = spin || 0; A.iD.array[o + 3] = alpha == null ? 1 : alpha;
    A.iE.array[o] = col[0]; A.iE.array[o + 1] = col[1]; A.iE.array[o + 2] = col[2]; A.iE.array[o + 3] = Math.random();
    if (i < b.lo) b.lo = i; if (i > b.hi) b.hi = i; b.dirty = true;
  };
  FX.update = function (time, camera) {
    FX.time = time; uniforms.uTime.value = time;
    const e = camera.matrixWorld.elements; uniforms.uCamR.value.set(e[0], e[1], e[2]).normalize(); uniforms.uCamU.value.set(e[4], e[5], e[6]).normalize();
    for (const b of [add, alp]) { if (!b.dirty) continue; for (const k in b.at) { const a = b.at[k]; a.clearUpdateRanges && a.clearUpdateRanges(); if (a.addUpdateRange) a.addUpdateRange(b.lo * 4, (b.hi - b.lo + 1) * 4); a.needsUpdate = true; } b.dirty = false; b.lo = CAP; b.hi = -1; }
  };
  // ---------- receitas ----------
  const R = Math.random, TAU = Math.PI * 2;
  const jit = (v, k) => v + (R() - 0.5) * 2 * k;
  // explosão em camadas: clarão, bolas de fogo subindo, faíscas, destroços, fumaça atrasada, onda no chão e poeira
  FX.explosion = function (x, y, z, size, o) {
    o = o || {}; const m = FX.mult; const dl = o.delay || 0; const t0 = FX.time; if (dl) FX.time = t0 + dl; try { explode(x, y, z, size, o, m); } finally { FX.time = t0; } };
  function explode(x, y, z, size, o, m) { const tint = o.tint || [1, 1, 1]; const big = size >= 10;
    const fl = size < 10 ? 2.2 : 2.2 * Math.sqrt(10 / size); FX.emit(add, [x, y + size * 0.4, z], [0, 0, 0], 0.14 + size * 0.004, size * fl, size * fl * 1.5, 1, [1.4 * tint[0], 1.15 * tint[1], 0.9 * tint[2]], 0, 1.5, 0, 1); // clarão menor nas grandes: o bloom faz o resto
    const nf = Math.round((5 + size * 0.35) * m); for (let i = 0; i < nf; i++) { const a = R() * TAU, r = R() * size * 0.35; FX.emit(add, [x + Math.cos(a) * r, y + R() * size * 0.3, z + Math.sin(a) * r], [Math.cos(a) * size * 0.9 * R(), size * (0.6 + R() * 1.4), Math.sin(a) * size * 0.9 * R()], 0.45 + R() * 0.45, size * (0.45 + R() * 0.3), size * (1.1 + R() * 0.6), 0, tint, -size * 0.6, 2.4, jit(0, 1.5), 1, R() * 0.06); }
    const ns = Math.round((10 + size * 0.7) * m); for (let i = 0; i < ns; i++) { const a = R() * TAU, sp = size * (3 + R() * 6); FX.emit(add, [x, y + size * 0.3, z], [Math.cos(a) * sp, size * (1.5 + R() * 5), Math.sin(a) * sp], 0.35 + R() * 0.6, 0.6 + R() * 0.9, 0.3, 2, [1.6, 0.9 + R() * 0.4, 0.35], 160 + size * 6, 1, 0, 1); }
    const nd = Math.round((3 + size * 0.22) * m); for (let i = 0; i < nd; i++) { const a = R() * TAU, sp = size * (1.5 + R() * 3.5); const c = 0.08 + R() * 0.1; FX.emit(alp, [x, y + size * 0.3, z], [Math.cos(a) * sp, size * (2.5 + R() * 4), Math.sin(a) * sp], 0.7 + R() * 0.7, 0.8 + R() * 1.2, 0.8, 5, [c, c, c * 1.1], 210, 1, jit(0, 9), 1); }
    const nk = Math.round((4 + size * 0.28) * m); for (let i = 0; i < nk; i++) { const a = R() * TAU, r = R() * size * 0.5; const g = 0.13 + R() * 0.08; FX.emit(alp, [x + Math.cos(a) * r, y + size * 0.4, z + Math.sin(a) * r], [Math.cos(a) * size * 0.3, size * (0.4 + R() * 0.8), Math.sin(a) * size * 0.3], 1.8 + R() * 1.8 + size * 0.05, size * 0.6, size * (1.8 + R()), 3, [g, g * 0.97, g * 0.95], -size * 0.08, 1.6, jit(0, 0.6), 0.85, 0.1 + R() * 0.25); }
    if (big || o.wave) FX.emit(add, [x, y + 0.6, z], [0, 0, 0], 0.5, size * 0.6, size * 4.2, 6, [1.4 * tint[0], 0.9 * tint[1], 0.5 * tint[2]], 0, 2.5, 0, 0.9);
    const nu = Math.round((big ? 8 : 3) * m); for (let i = 0; i < nu; i++) { const a = i / nu * TAU + R() * 0.4; FX.emit(alp, [x + Math.cos(a) * size * 0.4, y + 0.8, z + Math.sin(a) * size * 0.4], [Math.cos(a) * size * 1.8, size * 0.2, Math.sin(a) * size * 1.8], 1.1 + R() * 0.6, size * 0.4, size * 1.3, 4, [0.42, 0.37, 0.31], 0, 2, 0, 0.6); }
  }
  // clarão na boca do cano (curto, sem fumaça)
  FX.muzzle = function (x, y, z, col, s) { s = s || 3; FX.emit(add, [x, y, z], [0, 0, 0], 0.07, s, s * 1.6, 1, col || [1.6, 1.2, 0.7], 0, 1, 0, 1); if (R() < 0.5 * FX.mult) FX.emit(add, [x, y, z], [jit(0, 30), 10 + R() * 25, jit(0, 30)], 0.18, 0.7, 0.2, 2, [1.5, 1.0, 0.4], 120, 1, 0, 1); };
  // impacto: poeira e faíscas; com área, uma explosão pequena
  FX.impact = function (x, y, z, splash, col) {
    if (splash > 0) { FX.explosion(x, y, z, Math.min(16, 3 + splash * 0.3), { tint: col }); return; }
    const n = Math.round(4 * FX.mult); for (let i = 0; i < n; i++) { const a = R() * TAU; FX.emit(add, [x, y + 2, z], [Math.cos(a) * 40 * R(), 20 + R() * 40, Math.sin(a) * 40 * R()], 0.2 + R() * 0.3, 0.6 + R() * 0.5, 0.2, 2, col || [1.4, 0.9, 0.45], 180, 1, 0, 1); }
    FX.emit(alp, [x, y + 1.5, z], [0, 6, 0], 0.6, 2, 6, 4, [0.45, 0.4, 0.34], 0, 2, 0, 0.5);
  };
  // fumaça macia (chaminés, carcaças, estruturas avariadas)
  FX.smoke = function (x, y, z, col, life, vz, size) { const s = size || 6; FX.emit(alp, [x, y, z], [jit(0, 3), vz == null ? 12 : vz, jit(0, 3)], life || 2.5, s * 0.6, s * 2, 3, col, -0.5, 1.5, jit(0, 0.5), 0.8); };
  FX.trail = function (x, y, z) { FX.emit(alp, [x, y, z], [jit(0, 2), 3, jit(0, 2)], 0.7, 1.2, 4, 3, [0.5, 0.48, 0.46], 0, 1.5, 0, 0.45); };
  FX.glow = function (x, y, z, col, size, life, vy) { FX.emit(add, [x, y, z], [0, vy || 0, 0], life || 0.6, size, size * 1.4, 7, col, 0, 2, 0, 1); };
  FX.pulse = function (x, y, z, col, r, life) { FX.emit(add, [x, y + 0.8, z], [0, 0, 0], life || 1.2, r * 0.15, r, 6, col, 0, 2.2, 0, 1); };
  FX.ring = function (x, y, z, col, r, life) { FX.emit(add, [x, y, z], [0, 0, 0], life || 0.9, r * 0.2, r, 8, col, 0, 2.2, 0, 1); };
  FX.spark = function (x, y, z, col, sp, n) { n = Math.max(1, Math.round((n || 1) * FX.mult)); for (let i = 0; i < n; i++) { const a = R() * TAU; FX.emit(add, [x, y, z], [Math.cos(a) * sp * R(), sp * (0.4 + R() * 0.8), Math.sin(a) * sp * R()], 0.35 + R() * 0.5, 0.6 + R() * 0.6, 0.2, 2, col, 200, 1, 0, 1); } };
  return FX;
}
ARD.fx3d = { create };
})(globalThis.ARD = globalThis.ARD || {});
