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
    fragmentShader: 'uniform vec3 col; uniform float pw; uniform float it; varying vec3 vN; varying vec3 vV; void main(){ float d = abs(dot(normalize(vN), normalize(vV))); float f = pow(1.0 - d, pw); gl_FragColor = vec4(col * f * it, f * it); }' });
  return new THREE.Mesh(new THREE.SphereGeometry(r, 48, 32), mat);
}
// céu: cúpula em gradiente com brilho do sol e estrelas que aparecem à noite; acompanha a câmera (fica "no infinito")
function makeSky(THREE) {
  const mat = new THREE.ShaderMaterial({ uniforms: { uTop: { value: new THREE.Color(0x3a5f8f) }, uHor: { value: new THREE.Color(0x9fb0c4) }, uBot: { value: new THREE.Color(0x30343a) }, uSunDir: { value: new THREE.Vector3(-0.4, 0.7, 0.5).normalize() }, uSunCol: { value: new THREE.Color(1, 0.9, 0.75) }, uNight: { value: 0 }, uTime: { value: 0 } },
    depthWrite: false, side: THREE.BackSide, fog: false,
    vertexShader: 'varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }',
    fragmentShader: 'uniform vec3 uTop; uniform vec3 uHor; uniform vec3 uBot; uniform vec3 uSunDir; uniform vec3 uSunCol; uniform float uNight; uniform float uTime; varying vec3 vDir;\nfloat hh(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }\nfloat ardH2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); } float ardVn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(ardH2(i), ardH2(i + vec2(1.0, 0.0)), f.x), mix(ardH2(i + vec2(0.0, 1.0)), ardH2(i + vec2(1.0, 1.0)), f.x), f.y); }\nvoid main(){ vec3 d = normalize(vDir); float y = d.y; vec3 col = y > 0.0 ? mix(uHor, uTop, pow(clamp(y, 0.0, 1.0), 0.5)) : mix(uHor, uBot, clamp(-y * 4.0, 0.0, 1.0));\n if (y > 0.0) { vec2 cp = d.xz / (y + 0.16) * 1.4 + vec2(uTime * 0.0035, uTime * 0.0018); float cn = 0.0, ca = 0.55; for (int i = 0; i < 4; i++) { cn += ca * ardVn(cp); cp = cp * 2.07 + vec2(1.7, 9.2); ca *= 0.5; } float cv = smoothstep(0.5, 0.82, cn) * smoothstep(0.0, 0.22, y) * (1.0 - uNight * 0.55);\n  float sl = pow(max(dot(d, uSunDir), 0.0), 6.0); vec3 cc = mix(uHor * 1.08 + vec3(0.06), uSunCol * 0.9 + uHor * 0.4, sl * 0.6) * (1.0 - uNight * 0.82); col = mix(col, cc, cv * 0.78); } /* 4.3b: nuvens no céu, derivando */\n float sd = max(dot(d, uSunDir), 0.0); col += uSunCol * (pow(sd, 600.0) * 4.0 + pow(sd, 18.0) * 0.18) * (1.0 - uNight * 0.9);\n vec3 q = d * 420.0; vec3 cc = floor(q); float s = hh(cc); float st = step(0.9972, s) * smoothstep(0.02, 0.2, y); float tw = 0.65 + 0.35 * sin(uTime * 1.7 + s * 60.0); col += vec3(0.9, 0.95, 1.0) * st * tw * (0.25 + 1.35 * uNight);\n gl_FragColor = vec4(col, 1.0);\n #include <tonemapping_fragment>\n #include <colorspace_fragment>\n}' });
  const m = new THREE.Mesh(new THREE.SphereGeometry(4800, 32, 20), mat); m.frustumCulled = false; m.renderOrder = -1000; m.userData.mat = mat; return m;
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
ARD.world3d = { PLANETS, detailTexture, microTexture, planetTexture, makeSky, makeHomeWorld, makeHorizon, fbm };
})(globalThis.ARD = globalThis.ARD || {});
