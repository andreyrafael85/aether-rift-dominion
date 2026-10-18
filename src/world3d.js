/* Aether Rift: Dominion — Engine gráfica 2 (4.0d): céu, planeta-mãe, horizonte além do mapa e detalhe do terreno.
   Reaproveita os geradores da galeria (tools/arte3d.html): ruído fBm, planetas com faixas e atmosfera por Fresnel.
   Tudo aqui é só visual: nada lê ou altera a simulação. */
(function (ARD) {
'use strict';
const PLANETS = { // paletas dos mundos natais aprovados (Postal Dia)
  vehnar:  { pl: ['#1a120c', '#5a3a22', '#a06a3a', '#e6b070'], atmo: 0xff9a4a, bands: true, moon: '#b9a690' },
  erevane: { pl: ['#070c14', '#14283a', '#2f5a78', '#9fd8f0'], atmo: 0x33ffd0, bands: false, moon: '#9fb6c4' },
  tessara: { pl: ['#0a1a10', '#1f4a2e', '#3f9a5e', '#c8f0a0'], atmo: 0x8affb0, bands: false, moon: '#b8c9a8' },
  quorith: { pl: ['#0e0a1c', '#2a2140', '#6a50b0', '#e0d0ff'], atmo: 0xc8a8ff, bands: true, moon: '#c4bce0' },
  vorag:   { pl: ['#140608', '#3b1420', '#8e2a3a', '#ffb090'], atmo: 0xff6a7c, bands: false, moon: '#c9a2a2' },
};
function hash3(x, y, z) { let n = (x * 374761393 + y * 668265263 + z * 2147483647) | 0; n = (n ^ (n >> 13)) * 1274126177; n = n ^ (n >> 16); return (n & 0x7fffffff) / 0x7fffffff; }
const sm = t => t * t * (3 - 2 * t);
function vnoise(x, y, z) { const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z); const fx = sm(x - xi), fy = sm(y - yi), fz = sm(z - zi); const l = (a, b, t) => a + (b - a) * t;
  return l(l(l(hash3(xi, yi, zi), hash3(xi + 1, yi, zi), fx), l(hash3(xi, yi + 1, zi), hash3(xi + 1, yi + 1, zi), fx), fy), l(l(hash3(xi, yi, zi + 1), hash3(xi + 1, yi, zi + 1), fx), l(hash3(xi, yi + 1, zi + 1), hash3(xi + 1, yi + 1, zi + 1), fx), fy), fz); }
function fbm(x, y, z, oct) { let v = 0, a = 0.5, f = 1, s = 0; for (let i = 0; i < (oct || 5); i++) { v += a * vnoise(x * f, y * f, z * f); s += a; a *= 0.5; f *= 2.1; } return v / s; }
const pstr = s => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
function ramp(stops, t) { const n = stops.length - 1; const i = Math.min(n - 1, Math.max(0, Math.floor(t * n))); const u = t * n - i; const a = stops[i], b = stops[i + 1]; return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u]; }

// textura de detalhe do terreno, repetível: R = grão fino, G = manchas médias, B = rachaduras (ruído em crista)
function detailTexture(THREE) {
  const N = 256; const cv = document.createElement('canvas'); cv.width = cv.height = N; const c = cv.getContext('2d'); const img = c.createImageData(N, N); const d = img.data;
  const h2 = (x, y, s) => hash3(x, y, s); const vn = (x, y, p, s) => { const xi = Math.floor(x), yi = Math.floor(y); const fx = sm(x - xi), fy = sm(y - yi); const w = a => ((a % p) + p) % p; const l = (a, b, t) => a + (b - a) * t; return l(l(h2(w(xi), w(yi), s), h2(w(xi + 1), w(yi), s), fx), l(h2(w(xi), w(yi + 1), s), h2(w(xi + 1), w(yi + 1), s), fx), fy); };
  const tile = (x, y, f0, oct, s) => { let v = 0, a = 0.5, f = f0, t = 0; for (let o = 0; o < oct; o++) { v += a * vn(x / N * f, y / N * f, f, s + o); t += a; a *= 0.5; f *= 2; } return v / t; };
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const i = (y * N + x) * 4; const r = tile(x, y, 16, 4, 1), g = tile(x, y, 4, 4, 9); const cr = 1 - Math.abs(tile(x, y, 8, 3, 21) * 2 - 1); d[i] = 255 * r; d[i + 1] = 255 * g; d[i + 2] = 255 * Math.pow(cr, 6); d[i + 3] = 255; }
  c.putImageData(img, 0, 0); const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.NoColorSpace; return t;
}
function planetTexture(THREE, race, seed, W) {
  const P = PLANETS[race] || PLANETS.vehnar; W = W || 384; const Hh = W / 2; const cv = document.createElement('canvas'); cv.width = W; cv.height = Hh; const c = cv.getContext('2d'); const img = c.createImageData(W, Hh); const d = img.data; const stops = P.pl.map(pstr);
  for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) { const u = x / W * Math.PI * 2, vv = y / Hh; const nx = Math.cos(u) * 2.2 + seed, nz = Math.sin(u) * 2.2, ny = vv * 4.4;
    let t = P.bands ? fbm(nx * 0.25, ny * 2.6 + fbm(nx, ny, nz, 3) * 1.2, nz * 0.25, 4) : fbm(nx, ny, nz, 5); t = Math.min(1, Math.max(0, (t - 0.32) * 1.9)); const [r, g, b] = ramp(stops, t); const i = (y * W + x) * 4; d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255; }
  c.putImageData(img, 0, 0); const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; return tex;
}
function atmo(THREE, r, color, power, intensity) {
  const mat = new THREE.ShaderMaterial({ uniforms: { col: { value: new THREE.Color(color) }, pw: { value: power }, it: { value: intensity } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.BackSide, fog: false,
    vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position,1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform vec3 col; uniform float pw; uniform float it; varying vec3 vN; varying vec3 vV; void main(){ float d = abs(dot(normalize(vN), normalize(vV))); float f = pow(max(1.0 - d, 0.0), pw); /* 4.3f: sem NaN */ gl_FragColor = vec4(col * f * it, f * it); }' });
  return new THREE.Mesh(new THREE.SphereGeometry(r, 48, 32), mat);
}
// céu: cúpula em gradiente com brilho do sol e estrelas que aparecem à noite; acompanha a câmera (fica "no infinito")
// 4.3h: modo espaço (uSpace = 1, ligado pelo space3d no Cinturão): fundo de nebulosa assado num cubemap (spaceBackdrop), estrelas
// analíticas em três camadas (nítidas em qualquer resolução), faixa da galáxia e o sol sem atmosfera, também abaixo do horizonte
const SKY_SPACE = `uniform float uSpace; uniform samplerCube uNebula; uniform vec4 uPlanet; uniform vec3 uPlanetL; uniform vec4 uSpaceK;
float ardHs3(vec3 p){ p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
vec3 ardHs33(vec3 p){ p = fract(p * vec3(0.1031, 0.1030, 0.0973)); p += dot(p, p.yxz + 33.33); return fract((p.xxy + p.yxx) * p.zyx); }
vec3 ardStar(vec3 d, float sc, float dens, float rad, float gain) {
  vec3 q = d * sc; vec3 c = floor(q); if (ardHs3(c + 11.7) > dens) return vec3(0.0);
  vec3 h = ardHs33(c); vec3 sp = c + 0.3 + 0.4 * h; float dist = length(q - sp);
  float pw = max(length(fwidth(q)), 1e-4) * 0.7; float r = max(rad, pw);
  float k = smoothstep(r, r * 0.2, dist) * min(1.0, rad * rad / (r * r));
  float b = gain * (0.22 + 5.0 * pow(h.y, 9.0));
  vec3 tc = h.z < 0.62 ? mix(vec3(0.7, 0.82, 1.0), vec3(1.0), h.z / 0.62) : mix(vec3(1.0), vec3(1.0, 0.76, 0.5), (h.z - 0.62) / 0.38);
  return tc * k * b; }
float ardV3(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(ardHs3(i), ardHs3(i + vec3(1.0, 0.0, 0.0)), f.x), mix(ardHs3(i + vec3(0.0, 1.0, 0.0)), ardHs3(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
             mix(mix(ardHs3(i + vec3(0.0, 0.0, 1.0)), ardHs3(i + vec3(1.0, 0.0, 1.0)), f.x), mix(ardHs3(i + vec3(0.0, 1.0, 1.0)), ardHs3(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z); }
float ardF3(vec3 p){ float v = 0.0, a = 0.5, t = 0.0; for (int i = 0; i < 5; i++) { v += a * ardV3(p); t += a; p = p * 2.03 + vec3(1.7, 9.2, 4.1); a *= 0.5; } return v / t; }
/* planeta gigante abaixo do horizonte: disco analítico (borda nítida), faixas e tempestades, terminador e atmosfera do lado do sol */
vec4 ardPlaneta(vec3 d) {
  float cp = dot(d, uPlanet.xyz); float sr = sqrt(max(1.0 - uPlanet.w * uPlanet.w, 0.0)); float disc = cp * cp - (1.0 - sr * sr); float pw = max(fwidth(cp), 1e-5);
  if (cp <= 0.0 || disc <= -pw * 4.0) return vec4(0.0);
  float t = cp - sqrt(max(disc, 0.0)); vec3 N = (d * t - uPlanet.xyz) / sr;
  vec3 ax = normalize(vec3(0.18, 1.0, -0.22)); float lat = dot(N, ax); float tb = ardF3(N * 3.0 + 1.3);
  float bands = ardF3(vec3(lat * 7.0 + tb * 0.9, lat * 2.0, 4.2)); float storms = smoothstep(0.64, 0.8, ardF3(N * 7.0 + 2.0));
  vec3 pc = mix(vec3(0.014, 0.032, 0.07), vec3(0.08, 0.14, 0.21), smoothstep(0.3, 0.75, bands)); pc = mix(pc, vec3(0.15, 0.12, 0.19), storms * 0.5);
  float lit = dot(N, uPlanetL); float diff = smoothstep(-0.08, 0.6, lit); float rim = pow(1.0 - max(dot(N, -d), 0.0), 4.0);
  vec3 col = pc * diff * 1.5 + vec3(0.05, 0.15, 0.4) * rim * smoothstep(-0.25, 0.3, lit) * 1.3 + pc * 0.012;
  return vec4(col, smoothstep(-pw * 2.0, pw * 2.0, disc)); }
vec3 ardHalo(vec3 d) { float cp = dot(d, uPlanet.xyz); float hz = acos(clamp(cp, -1.0, 1.0)) - acos(clamp(uPlanet.w, -1.0, 1.0)); if (hz <= 0.0 || hz > 0.12) return vec3(0.0);
  vec3 dd = d - uPlanet.xyz * cp; float l2 = dot(dd, dd) > 1e-8 ? dot(normalize(dd), uPlanetL) : 0.0; return vec3(0.04, 0.11, 0.3) * exp(-hz * 50.0) * smoothstep(-0.45, 0.5, l2) * 0.9; }
vec3 ardEspaco(vec3 d, vec3 sunDir, vec3 sunCol, float night) {
  vec3 col = textureCube(uNebula, d).rgb * uSpaceK.x;
  vec4 pl = vec4(0.0); if (uPlanet.w < 1.0) { pl = ardPlaneta(d); col = mix(col + ardHalo(d), pl.rgb, pl.a); } float pm = pl.a; /* o planeta gigante tapa as estrelas */
  float bd = dot(d, vec3(0.38, 0.33, 0.865)); float band = exp(-bd * bd * 16.0);
  vec3 st = ardStar(d, 280.0, 0.05 + 0.22 * band, 0.17, 0.5) + ardStar(d.zxy, 110.0, 0.035, 0.11, 1.5) + ardStar(d.yzx, 560.0, 0.06 + 0.35 * band, 0.2, 0.2);
  col += st * uSpaceK.y * (0.8 + 0.5 * night) * (1.0 - pm);
  float sd = max(dot(d, sunDir), 0.0); col += sunCol * (pow(sd, 2400.0) * 36.0 + pow(sd, 160.0) * 0.5 + pow(sd, 12.0) * 0.03) * (1.0 - night * 0.85) * (1.0 - pm);
  return col; }
`;
function makeSky(THREE) {
  const mat = new THREE.ShaderMaterial({ uniforms: { uTop: { value: new THREE.Color(0x3a5f8f) }, uHor: { value: new THREE.Color(0x9fb0c4) }, uBot: { value: new THREE.Color(0x30343a) }, uSunDir: { value: new THREE.Vector3(-0.4, 0.7, 0.5).normalize() }, uSunCol: { value: new THREE.Color(1, 0.9, 0.75) }, uNight: { value: 0 }, uTime: { value: 0 },
      uSpace: { value: 0 }, uNebula: { value: null }, uPlanet: { value: new THREE.Vector4(0, -1, 0, 2) }, uPlanetL: { value: new THREE.Vector3(0, 1, 0) }, uSpaceK: { value: new THREE.Vector4(1, 1, 0, 0) } }, /* 4.3h: modo espaço */
    depthWrite: false, side: THREE.BackSide, fog: false,
    vertexShader: 'varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }',
    fragmentShader: 'uniform vec3 uTop; uniform vec3 uHor; uniform vec3 uBot; uniform vec3 uSunDir; uniform vec3 uSunCol; uniform float uNight; uniform float uTime; varying vec3 vDir;\nfloat hh(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }\nfloat ardH2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); } float ardVn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(ardH2(i), ardH2(i + vec2(1.0, 0.0)), f.x), mix(ardH2(i + vec2(0.0, 1.0)), ardH2(i + vec2(1.0, 1.0)), f.x), f.y); }\n' + SKY_SPACE + 'void main(){ vec3 d = normalize(vDir); vec3 col;\n if (uSpace > 0.5) col = ardEspaco(d, uSunDir, uSunCol, uNight); /* 4.3h */ else {\n float y = d.y; col = y > 0.0 ? mix(uHor, uTop, pow(clamp(y, 0.0, 1.0), 0.5)) : mix(uHor, uBot, clamp(-y * 4.0, 0.0, 1.0));\n if (y > 0.0) { vec2 cp = d.xz / (y + 0.16) * 1.4 + vec2(uTime * 0.0035, uTime * 0.0018); float cn = 0.0, ca = 0.55; for (int i = 0; i < 4; i++) { cn += ca * ardVn(cp); cp = cp * 2.07 + vec2(1.7, 9.2); ca *= 0.5; } float cv = smoothstep(0.5, 0.82, cn) * smoothstep(0.0, 0.22, y) * (1.0 - uNight * 0.55);\n  float sl = pow(max(dot(d, uSunDir), 0.0), 6.0); vec3 cc = mix(uHor * 1.08 + vec3(0.06), uSunCol * 0.9 + uHor * 0.4, sl * 0.6) * (1.0 - uNight * 0.82); col = mix(col, cc, cv * 0.78); } /* 4.3b: nuvens no céu, derivando */\n float sd = max(dot(d, uSunDir), 0.0); col += uSunCol * (pow(sd, 600.0) * 4.0 + pow(sd, 18.0) * 0.18) * (1.0 - uNight * 0.9);\n vec3 q = d * 420.0; vec3 cc = floor(q); float s = hh(cc); float st = step(0.9972, s) * smoothstep(0.02, 0.2, y); float tw = 0.65 + 0.35 * sin(uTime * 1.7 + s * 60.0); col += vec3(0.9, 0.95, 1.0) * st * tw * (0.25 + 1.35 * uNight);\n  }\n gl_FragColor = vec4(col, 1.0);\n #include <tonemapping_fragment>\n #include <colorspace_fragment>\n}' });
  const m = new THREE.Mesh(new THREE.SphereGeometry(4800, 32, 20), mat); m.frustumCulled = false; m.renderOrder = -1000; m.userData.mat = mat; return m;
}
// 4.3h — fundo do espaço assado uma vez num cubemap (meio-float, linear): nebulosa azul e violeta com fiapos, faixa da galáxia com poeira
// escura. O céu lê com textureCube (barato por quadro); o planeta gigante é analítico no próprio céu (borda nítida).
const BACKDROP_FS = `uniform vec4 uPlanet; uniform vec3 uPlanetL; uniform float uSeed; varying vec3 vDir;
float h31(vec3 p){ p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float vn3(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h31(i), h31(i + vec3(1.0, 0.0, 0.0)), f.x), mix(h31(i + vec3(0.0, 1.0, 0.0)), h31(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
             mix(mix(h31(i + vec3(0.0, 0.0, 1.0)), h31(i + vec3(1.0, 0.0, 1.0)), f.x), mix(h31(i + vec3(0.0, 1.0, 1.0)), h31(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z); }
float fbm3(vec3 p, int o){ float v = 0.0, a = 0.5, t = 0.0; for (int i = 0; i < 7; i++) { if (i >= o) break; v += a * vn3(p); t += a; p = p * 2.03 + vec3(1.7, 9.2, 4.1); a *= 0.5; } return v / t; }
void main(){ vec3 d = normalize(vDir);
  vec3 w = vec3(fbm3(d * 1.6 + uSeed, 4), fbm3(d * 1.6 + uSeed + 5.3, 4), fbm3(d * 1.6 + uSeed + 9.7, 4)) - 0.5;
  float n1 = fbm3(d * 2.4 + w * 1.8 + 3.1, 6), n2 = fbm3(d * 4.2 - w * 1.4 + 7.7, 6), n3 = fbm3(d * 9.0 + w * 0.8, 5);
  float bd = dot(d, vec3(0.38, 0.33, 0.865)); float band = exp(-bd * bd * 16.0);
  float neb = smoothstep(0.47, 0.8, n1 + band * 0.1); float wisp = pow(smoothstep(0.35, 0.95, n2), 2.0); float lane = smoothstep(0.5, 0.7, n3) * band;
  vec3 col = vec3(0.0010, 0.0015, 0.0032) * (0.7 + 0.6 * n2);
  col += mix(vec3(0.007, 0.028, 0.115), vec3(0.048, 0.013, 0.082), smoothstep(0.35, 0.75, n2)) * neb * (0.5 + 0.5 * wisp);
  col += vec3(0.004, 0.036, 0.046) * neb * smoothstep(0.05, 0.35, w.y) * 0.8;
  col += vec3(0.065, 0.014, 0.038) * pow(neb, 3.0) * smoothstep(0.58, 0.85, n3) * 0.7;
  col += vec3(0.018, 0.019, 0.027) * band * (0.4 + 0.6 * n3) * (1.0 - 0.8 * lane);
  gl_FragColor = vec4(col, 1.0); }`;
function spaceBackdrop(THREE, renderer, o) {
  o = o || {}; const size = o.size || 384; const P = new THREE.Vector3().fromArray(o.planetDir || [-0.94, -0.3, -0.16]).normalize(); const cosR = Math.cos(o.planetR || 0.27);
  const L = new THREE.Vector3().fromArray(o.planetL || [-0.47, 0.64, 0.6]).normalize();
  const rt = new THREE.WebGLCubeRenderTarget(size, { type: THREE.HalfFloatType, generateMipmaps: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false });
  const scene = new THREE.Scene(); const mat = new THREE.ShaderMaterial({ uniforms: { uPlanet: { value: new THREE.Vector4(P.x, P.y, P.z, cosR) }, uPlanetL: { value: L }, uSeed: { value: o.seed || 0 } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }', fragmentShader: BACKDROP_FS, side: THREE.BackSide, depthTest: false, depthWrite: false });
  const box = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10), mat); scene.add(box); const cam = new THREE.CubeCamera(0.1, 100, rt);
  const prev = renderer.getRenderTarget(); cam.update(renderer, scene); renderer.setRenderTarget(prev); box.geometry.dispose(); mat.dispose();
  return { tex: rt.texture, rt, planet: new THREE.Vector4(P.x, P.y, P.z, cosR), planetL: L };
}
// planeta-mãe da Raça do jogador e uma lua, baixos no horizonte; aparecem ao inclinar a câmera
function makeHomeWorld(THREE, race, seed) {
  const P = PLANETS[race] || PLANETS.vehnar; const g = new THREE.Group();
  const ptex = planetTexture(THREE, race, seed); const planet = new THREE.Mesh(new THREE.SphereGeometry(640, 64, 40), new THREE.MeshStandardMaterial({ map: ptex, emissiveMap: ptex, emissive: 0xffffff, emissiveIntensity: 0.16, roughness: 0.92, metalness: 0, fog: false, envMapIntensity: 0 })); planet.rotation.z = 0.35; planet.rotation.x = 0.2; g.add(planet);
  g.add(atmo(THREE, 690, P.atmo, 2.2, 1.25));
  const moon = new THREE.Mesh(new THREE.SphereGeometry(120, 32, 20), new THREE.MeshStandardMaterial({ color: P.moon, roughness: 0.95, fog: false, envMapIntensity: 0 })); moon.position.set(-1350, 520, 300); g.add(moon); const mg = atmo(THREE, 132, 0xffffff, 3, 0.35); mg.position.copy(moon.position); g.add(mg);
  g.userData.planet = planet; return g;
}
// cordilheiras além da borda do mapa: grade grande alinhada às bordas; dentro do mapa fica escondida sob o terreno
function makeHorizon(THREE, WORLD, H, seed, tint) {
  const SEG = 60, SIZE = WORLD * 5, CELL = SIZE / SEG, OFF = (SIZE - WORLD) / 2; const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG); geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position; const col = new Float32Array(pos.count * 3); const rock = new THREE.Color(tint || 0x4a4c52), snow = new THREE.Color(0xc9d2dc), deep = new THREE.Color(0x26282d);
  for (let i = 0; i < pos.count; i++) { const x = pos.getX(i) + SIZE / 2 - OFF, y = -pos.getZ(i) + SIZE / 2 - OFF; // coordenadas do mundo do jogo
    const dx = Math.max(0, -x, x - WORLD), dy = Math.max(0, -y, y - WORLD); const dist = Math.hypot(dx, dy); const inside = x > 1 && x < WORLD - 1 && y > 1 && y < WORLD - 1; const edge = !inside && dist < 1;
    let h; if (inside) h = -70; else if (edge) h = H(Math.min(WORLD, Math.max(0, x)), Math.min(WORLD, Math.max(0, y))) - 3; else { const n = fbm(x / 900 + seed, y / 900, seed * 0.7, 4), r = 1 - Math.abs(fbm(x / 520, y / 520 + seed, 3.1, 3) * 2 - 1); h = -6 + Math.min(1, dist / 2200) * (90 + 520 * Math.pow(n, 1.6) + 260 * r * r); }
    pos.setY(i, h); const k = Math.min(1, Math.max(0, (h - 260) / 260)); const c = deep.clone().lerp(rock, Math.min(1, dist / 700 + 0.3)).lerp(snow, k * 0.85); const v = 0.85 + 0.3 * fbm(x / 140, y / 140, 5.5, 2); col[i * 3] = c.r * v; col[i * 3 + 1] = c.g * v; col[i * 3 + 2] = c.b * v; }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0, envMapIntensity: 0.15, flatShading: true })); m.position.set(WORLD / 2, 0, -WORLD / 2); m.receiveShadow = false; return m;
}
function microTexture(THREE) { /* 4.3a: microdetalhe do chão (R altura de seixos + grão, G tom, B fendas), repetível, 512² */
  const N = 512; const cv = document.createElement('canvas'); cv.width = cv.height = N; const c = cv.getContext('2d'); const img = c.createImageData(N, N); const d = img.data;
  let s = 987654321; const rnd = () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return (s >>> 8) / 16777216; };
  const G = 18, pts = []; for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) pts.push([(i + 0.15 + rnd() * 0.7) / G, (j + 0.15 + rnd() * 0.7) / G, 0.25 + rnd() * 0.75, rnd()]);
  const G2 = 6, crk = []; for (let j = 0; j < G2; j++) for (let i = 0; i < G2; i++) crk.push([(i + rnd()) / G2, (j + rnd()) / G2]);
  const wrap = v => v - Math.floor(v); const dw = (a, b) => { let x = Math.abs(a - b); return x > 0.5 ? 1 - x : x; };
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const u = x / N, v = y / N; const ci = Math.floor(u * G), cj = Math.floor(v * G);
    let best = 9, bs = 0, bt = 0; for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) { const p = pts[((cj + oy + G) % G) * G + ((ci + ox + G) % G)]; const dx = dw(u, p[0]) * G, dy = dw(v, p[1]) * G; const dd = Math.sqrt(dx * dx + dy * dy) / (0.28 + 0.3 * p[2]); if (dd < best) { best = dd; bs = p[2]; bt = p[3]; } }
    const peb = best < 1 ? Math.sqrt(1 - best * best) : 0; const k1 = Math.floor(u * G2), k2 = Math.floor(v * G2); let f1 = 9, f2 = 9;
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) { const p = crk[((k2 + oy + G2) % G2) * G2 + ((k1 + ox + G2) % G2)]; const dx = dw(u, p[0]) * G2, dy = dw(v, p[1]) * G2; const dd = Math.sqrt(dx * dx + dy * dy); if (dd < f1) { f2 = f1; f1 = dd; } else if (dd < f2) f2 = dd; }
    const crack = Math.max(0, 1 - (f2 - f1) / 0.05); const grit = hash3(x, y, 77);
    const i = (y * N + x) * 4; d[i] = 255 * Math.min(1, peb * (0.5 + 0.5 * bs) * 0.85 + grit * 0.15); d[i + 1] = 255 * (peb > 0 ? 0.35 + 0.5 * bt : 0.45 + 0.2 * grit); d[i + 2] = 255 * crack * (1 - peb); d[i + 3] = 255; }
  c.putImageData(img, 0, 0); const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.NoColorSpace; return t;
}
ARD.world3d = { PLANETS, detailTexture, microTexture, planetTexture, makeSky, makeHomeWorld, makeHorizon, fbm, spaceBackdrop };
})(globalThis.ARD = globalThis.ARD || {});
