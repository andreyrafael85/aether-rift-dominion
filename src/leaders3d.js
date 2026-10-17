/* Aether Rift: Dominion — líderes vivos (4.1e; bustos refeitos na 4.3e).
   Bustos 3D de comandante das cinco Raças, esculpidos à mão em código (esferas e tornos deformados, sem asset externo), com
   "rig": olhos com pálpebras, sobrancelhas, boca/mandíbula, cabeça e peças da Raça se mexem. Um renderizador WebGL só, fora da
   tela, desenha cada busto no próprio <canvas> 2D (cartões da tela inicial e retrato do HUD). Humor: 1 sereno, 2 furioso,
   3 triunfante, 4 preocupado. Reações: piscar, olhar para o ponteiro, acenar (sim), negar (não), falar, susto.
   4.3e: setLight(it, L) dá ao retrato do HUD a luz do mapa; buildHead é a fonte única também da arte 2D (tools/arte3d.html).
   Celular e "reduzir movimento" ficam com o retrato 2D. */
(function (ARD) {
'use strict';
const T = () => window.THREE;
const COL = { vehnar: { c: 0xff7733, dk: 0x1a1210 }, erevane: { c: 0x33ffd0, dk: 0x0a1218 }, tessara: { c: 0x55e68a, dk: 0x0c1a10 }, quorith: { c: 0xb388ff, dk: 0x120e22 }, vorag: { c: 0xe6455a, dk: 0x1a0a0e } };
/* 4.3e: cada humor = sobrancelha (ang: + franze em V, − ergue o meio), pálpebras (up: abertura de cima, lo: de baixo, tilt: + desce no canto de dentro),
   boca (tipo), pupila, olhar de base e postura da cabeça (px: + baixa o queixo, pz: inclina, py: vira) */
const EXPR = {
  1: { name: 'sereno', brow: 0.08, browY: 0, arch: 0.25, up: 0.62, lo: 0.30, tilt: 0.06, mouth: 'smile', pupil: 1, look: [0, 0.04], px: -0.04, py: 0, pz: 0.03, glow: 1 },
  2: { name: 'furioso', brow: 0.42, browY: -0.07, arch: -0.05, up: 0.36, lo: 0.36, tilt: 0.42, mouth: 'snarl', pupil: 0.62, look: [0, 0.16], px: 0.13, py: -0.06, pz: 0, glow: 1.55 },
  3: { name: 'triunfante', brow: -0.12, browY: 0.07, arch: 0.45, up: 0.66, lo: 0.52, tilt: -0.05, mouth: 'grin', pupil: 1.12, look: [0.12, 0.1], px: -0.13, py: 0.05, pz: 0.08, glow: 1.3 },
  4: { name: 'preocupado', brow: -0.36, browY: 0.08, arch: 0.1, up: 0.8, lo: 0.24, tilt: -0.34, mouth: 'frown', pupil: 1.25, look: [-0.3, -0.22], px: 0.1, py: 0.1, pz: -0.07, glow: 0.7 } };
let renderer = null, envTex = null, failed = false, raf = 0; const items = [];
/* 4.3c.2: no Firefox a cópia do canvas WebGL para o canvas 2D (drawImage) falhava de vez em quando no Windows e o retrato piscava vazio; lá a cópia vira leitura explícita dos pixels (readPixels + putImageData), em ritmo menor. ?retrato=leitura força em qualquer navegador */
const READ = (() => { try { return /firefox\//i.test(navigator.userAgent) || new URLSearchParams(location.search).get('retrato') === 'leitura'; } catch (e) { return false; } })(); let pbuf = null, tmpCv = null;
function copyPixels(it, rw, rh, w, h) {
  const gl = renderer.getContext(); const n = rw * rh * 4; if (!pbuf || pbuf.length < n) pbuf = new Uint8Array(n);
  gl.readPixels(0, 0, rw, rh, gl.RGBA, gl.UNSIGNED_BYTE, pbuf);
  if (!it.img || it.img.width !== rw || it.img.height !== rh) it.img = it.ctx.createImageData(rw, rh);
  const d = it.img.data, row = rw * 4; /* o WebGL lê de baixo para cima e com alfa pré-multiplicado: inverte as linhas e desfaz o pré-multiplicado (brilho aditivo sobre o fundo vazio vira alfa) */
  for (let y = 0; y < rh; y++) { let sI = (rh - 1 - y) * row, o = y * row; for (let x = 0; x < row; x += 4, sI += 4, o += 4) { const r = pbuf[sI], g = pbuf[sI + 1], b = pbuf[sI + 2]; let a = pbuf[sI + 3]; const mx = r > g ? (r > b ? r : b) : (g > b ? g : b); if (mx > a) a = mx;
    if (a === 0) { d[o] = d[o + 1] = d[o + 2] = d[o + 3] = 0; } else if (a === 255) { d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = 255; } else { const k = 255 / a; d[o] = r * k; d[o + 1] = g * k; d[o + 2] = b * k; d[o + 3] = a; } } }
  if (w === rw && h === rh) it.ctx.putImageData(it.img, 0, 0);
  else { if (!tmpCv) tmpCv = document.createElement('canvas'); if (tmpCv.width !== rw || tmpCv.height !== rh) { tmpCv.width = rw; tmpCv.height = rh; } tmpCv.getContext('2d').putImageData(it.img, 0, 0); it.ctx.clearRect(0, 0, w, h); it.ctx.drawImage(tmpCv, 0, 0, rw, rh, 0, 0, w, h); }
}
const RES = 256;
function canUse() { if (failed) return false; try { if (matchMedia('(prefers-reduced-motion: reduce)').matches) return false; } catch (e) {} return !!T(); }
/* 4.3e: no jogo window.THREE é o namespace do módulo e não traz o RoomEnvironment (ele mora em THREE_ADDONS): antes os bustos do jogo saíam sem mapa de ambiente e os metais ficavam chapados */
function roomEnv() { const a = T(), b = window.THREE_ADDONS; return (a && a.RoomEnvironment) || (b && b.RoomEnvironment) || null; }
/* ambiente de estúdio: o RoomEnvironment com paredes e caixas escurecidas (ficam só os painéis de luz): reflexo nítido de softbox sem o véu leitoso da sala branca */
function makeEnv(THREE, rend) { const RE = roomEnv(); if (!RE) return null; const pm = new THREE.PMREMGenerator(rend); const room = new RE();
  room.traverse(o => { if (o.isMesh && o.material && o.material.isMeshStandardMaterial) o.material.color.setScalar(0.045); if (o.isPointLight) o.intensity *= 0.35; });
  const tex = pm.fromScene(room, 0.035).texture; pm.dispose(); if (room.dispose) room.dispose(); return tex; }
function ensure() {
  if (renderer || failed) return !!renderer; const THREE = T(); if (!THREE) return false;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' }); renderer.setPixelRatio(1); renderer.setSize(RES, RES, false); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0; renderer.setClearColor(0x000000, 0);
    envTex = makeEnv(THREE, renderer);
    renderer.domElement.addEventListener('webglcontextlost', e => { e.preventDefault(); failed = true; for (const it of items.slice()) unmount(it); });
  } catch (e) { console.warn('[ARD] líderes 3D indisponíveis:', e.message); failed = true; renderer = null; }
  return !!renderer;
}
/* ---------- utilidades determinísticas (o build não usa Math.random) ---------- */
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const clamp = (v, a, b) => v < a ? a : v > b ? b : v, lerp = (a, b, t) => a + (b - a) * t, sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
/* gaussiana anisotrópica: pincel macio de escultura */
const G3 = (x, y, z, cx, cy, cz, sx, sy, sz) => { const dx = (x - cx) / sx, dy = (y - cy) / sy, dz = (z - cz) / sz; return Math.exp(-0.5 * (dx * dx + dy * dy + dz * dz)); };
function hash3(x, y, z) { let n = (x * 374761393 + y * 668265263 + z * 1274126177) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); n ^= n >>> 16; return (n & 0x7fffffff) / 0x7fffffff; }
function vnoise(x, y, z) { const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z); let fx = x - xi, fy = y - yi, fz = z - zi; fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy); fz = fz * fz * (3 - 2 * fz);
  const c00 = lerp(hash3(xi, yi, zi), hash3(xi + 1, yi, zi), fx), c10 = lerp(hash3(xi, yi + 1, zi), hash3(xi + 1, yi + 1, zi), fx), c01 = lerp(hash3(xi, yi, zi + 1), hash3(xi + 1, yi, zi + 1), fx), c11 = lerp(hash3(xi, yi + 1, zi + 1), hash3(xi + 1, yi + 1, zi + 1), fx);
  return lerp(lerp(c00, c10, fy), lerp(c01, c11, fy), fz); }
function fbm(x, y, z, o) { let v = 0, a = 0.5, f = 1, s = 0; for (let i = 0; i < (o || 4); i++) { v += a * vnoise(x * f, y * f, z * f); s += a; a *= 0.5; f *= 2.03; } return v / s; }
/* ---------- 4.3e: kit de geometria (script clássico, sem addons): transformar, juntar por material, varrer tubos afinados, esculpir esferas ---------- */
let _m4 = null, _q = null, _e = null, _v1 = null, _v2 = null, _v3 = null;
function tmp(THREE) { if (!_m4) { _m4 = new THREE.Matrix4(); _q = new THREE.Quaternion(); _e = new THREE.Euler(); _v1 = new THREE.Vector3(); _v2 = new THREE.Vector3(); _v3 = new THREE.Vector3(); } }
/* xf(g, [px,py,pz], [rx,ry,rz] | Quaternion, [sx,sy,sz] | s): aplica a transformação na própria geometria */
function xf(g, p, r, s) { const THREE = T(); tmp(THREE); if (r && r.isQuaternion) _q.copy(r); else { _e.set(r ? r[0] : 0, r ? r[1] : 0, r ? r[2] : 0); _q.setFromEuler(_e); }
  if (s == null) s = 1; if (typeof s === 'number') _v2.set(s, s, s); else _v2.set(s[0], s[1], s[2]); _v1.set(p ? p[0] : 0, p ? p[1] : 0, p ? p[2] : 0); _m4.compose(_v1, _q, _v2); g.applyMatrix4(_m4); return g; }
/* quaternion que leva +Y para a direção n (peças "plantadas" numa superfície) */
function qUp(n, spin) { const THREE = T(); const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(n[0], n[1], n[2]).normalize()); if (spin) q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), spin)); return q; }
/* deixa a geometria indexada com posição, normal, uv e cor (a cor de vértice carrega a sombra pintada e o tom) */
function prep(g, tint) { const THREE = T(); if (!g.index) { const n = g.getAttribute('position').count; const idx = new (n > 65535 ? Uint32Array : Uint16Array)(n); for (let i = 0; i < n; i++) idx[i] = i; g.setIndex(new THREE.BufferAttribute(idx, 1)); }
  const n = g.getAttribute('position').count; if (!g.getAttribute('normal')) g.computeVertexNormals(); if (!g.getAttribute('uv')) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2));
  let c = g.getAttribute('color'); if (!c) { c = new THREE.Float32BufferAttribute(new Float32Array(n * 3).fill(1), 3); g.setAttribute('color', c); }
  if (tint != null) { const tc = typeof tint === 'number' ? new THREE.Color(tint) : tint; const a = c.array; for (let i = 0; i < n; i++) { a[i * 3] *= tc.r; a[i * 3 + 1] *= tc.g; a[i * 3 + 2] *= tc.b; } }
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv' && k !== 'color') g.deleteAttribute(k); return g; }
function merge(list) { const THREE = T(); let nv = 0, ni = 0; for (const g of list) { nv += g.getAttribute('position').count; ni += g.index.count; }
  const P = new Float32Array(nv * 3), N = new Float32Array(nv * 3), U = new Float32Array(nv * 2), C = new Float32Array(nv * 3), I = new (nv > 65535 ? Uint32Array : Uint16Array)(ni); let ov = 0, oi = 0;
  for (const g of list) { const n = g.getAttribute('position').count; P.set(g.getAttribute('position').array, ov * 3); N.set(g.getAttribute('normal').array, ov * 3); U.set(g.getAttribute('uv').array, ov * 2); C.set(g.getAttribute('color').array, ov * 3); const ix = g.index.array; for (let i = 0; i < ix.length; i++) I[oi + i] = ix[i] + ov; ov += n; oi += ix.length; g.dispose(); }
  const m = new THREE.BufferGeometry(); m.setAttribute('position', new THREE.BufferAttribute(P, 3)); m.setAttribute('normal', new THREE.BufferAttribute(N, 3)); m.setAttribute('uv', new THREE.BufferAttribute(U, 2)); m.setAttribute('color', new THREE.BufferAttribute(C, 3)); m.setIndex(new THREE.BufferAttribute(I, 1)); m.computeBoundingSphere(); return m; }
/* Bag: peças estáticas agrupadas por material viram UMA malha por material (menos chamadas de desenho) */
function Bag() { this.m = new Map(); }
Bag.prototype.add = function (mat, g, tint) { prep(g, tint); let l = this.m.get(mat); if (!l) this.m.set(mat, l = []); l.push(g); return g; };
Bag.prototype.flush = function (parent, name) { const THREE = T(); const out = []; for (const [mat, l] of this.m) { if (!l.length) continue; const me = new THREE.Mesh(merge(l), mat); me.name = (name || 'peca') + ':' + (mat.name || ''); me.matrixAutoUpdate = false; me.updateMatrix(); parent.add(me); out.push(me); } this.m.clear(); return out; };
/* varredura: tubo de seção elíptica afinada ao longo de uma curva (sobrancelhas, lábios, cabos, chifres, frondes, mandíbulas). r(t) -> [raio no binormal, raio na "normal" (para cima)] */
function sweep(pts, o) { const THREE = T(); o = o || {}; const n = o.n || 24, m = o.m || 10; const cv = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(p[0], p[1], p[2])), !!o.closed, 'centripetal');
  const up = o.up || [0, 0, 1]; const P = [], N = [], UV = [], I = []; const tg = new THREE.Vector3(), nn = new THREE.Vector3(), bb = new THREE.Vector3(), c = new THREE.Vector3(), u0 = new THREE.Vector3();
  for (let i = 0; i <= n; i++) { const t = i / n; cv.getPointAt(t, c); cv.getTangentAt(t, tg); const uu = typeof up === 'function' ? up(t) : up; u0.set(uu[0], uu[1], uu[2]);
    nn.copy(u0).addScaledVector(tg, -u0.dot(tg)); if (nn.lengthSq() < 1e-8) nn.set(0, 1, 0); nn.normalize(); bb.crossVectors(tg, nn).normalize();
    const rr = typeof o.r === 'function' ? o.r(t) : (o.r || [0.05, 0.05]); const ra = Array.isArray(rr) ? rr[0] : rr, rb = Array.isArray(rr) ? rr[1] : rr;
    for (let j = 0; j <= m; j++) { const a = j / m * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a); P.push(c.x + bb.x * ca * ra + nn.x * sa * rb, c.y + bb.y * ca * ra + nn.y * sa * rb, c.z + bb.z * ca * ra + nn.z * sa * rb);
      const ex = bb.x * ca * rb + nn.x * sa * ra, ey = bb.y * ca * rb + nn.y * sa * ra, ez = bb.z * ca * rb + nn.z * sa * ra, el = Math.hypot(ex, ey, ez) || 1; N.push(ex / el, ey / el, ez / el); UV.push(t, j / m); } }
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) { const a = i * (m + 1) + j, b = a + m + 1; I.push(a, b, a + 1, b, b + 1, a + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2)); g.setIndex(I); if (o.smooth) { g.computeVertexNormals(); weld(g); } return g; }
/* torno com perfil [[raio, y], ...] em volta de Y */
function lathe(prof, seg, phi0, phiLen) { const THREE = T(); return new THREE.LatheGeometry(prof.map(p => new THREE.Vector2(Math.max(0.0001, p[0]), p[1])), seg || 32, phi0 || 0, phiLen == null ? Math.PI * 2 : phiLen); }
/* normais suaves através das costuras (vértices repetidos na mesma posição) */
function weld(g) { const p = g.getAttribute('position').array, n = g.getAttribute('normal').array, map = new Map(); const cnt = p.length / 3;
  for (let i = 0; i < cnt; i++) { const k = Math.round(p[i * 3] * 1e4) + ',' + Math.round(p[i * 3 + 1] * 1e4) + ',' + Math.round(p[i * 3 + 2] * 1e4); let l = map.get(k); if (!l) map.set(k, l = []); l.push(i); }
  for (const l of map.values()) { if (l.length < 2) continue; let x = 0, y = 0, z = 0; for (const i of l) { x += n[i * 3]; y += n[i * 3 + 1]; z += n[i * 3 + 2]; } const s = Math.hypot(x, y, z) || 1; for (const i of l) { n[i * 3] = x / s; n[i * 3 + 1] = y / s; n[i * 3 + 2] = z / s; } } return g; }
/* escultura: esfera unitária (costura atrás) cujo raio em cada direção vem de R(dx,dy,dz); "cav" guarda a cavidade (para pintar sombra) */
let CAV = 0;
/* post(p) opcional: deformação depois do raio (órbitas dos olhos), devolve cavidade extra; vale também na consulta at() */
function sculpt(R, cx, cy, cz, ws, hs, post) { const THREE = T(); const g = new THREE.SphereGeometry(1, ws, hs); g.rotateY(-Math.PI / 2); const p = g.getAttribute('position'), a = p.array, cav = new Float32Array(p.count); const q = [0, 0, 0];
  for (let i = 0; i < p.count; i++) { const x = a[i * 3], y = a[i * 3 + 1], z = a[i * 3 + 2], l = Math.hypot(x, y, z) || 1; CAV = 0; const r = R(x / l, y / l, z / l); let cv = CAV; q[0] = cx + x / l * r; q[1] = cy + y / l * r; q[2] = cz + z / l * r; if (post) cv = Math.min(cv, cv + post(q)); cav[i] = cv; a[i * 3] = q[0]; a[i * 3 + 1] = q[1]; a[i * 3 + 2] = q[2]; }
  g.computeVertexNormals(); weld(g); g.userData.cav = cav;
  /* consulta da superfície vista de frente: ponto e normal em (x, y) — para plantar sobrancelhas, lábios, placas e espinhos */
  const inside = (x, y, z) => { const dx = x - cx, dy = y - cy, dz = z - cz, l = Math.hypot(dx, dy, dz) || 1; return l < R(dx / l, dy / l, dz / l); };
  const zAt = (x, y) => { let lo = cz - 0.2, hi = cz + 3; if (!inside(x, y, lo)) return null; for (let k = 0; k < 26; k++) { const mid = (lo + hi) / 2; if (inside(x, y, mid)) lo = mid; else hi = mid; } return lo; };
  const P3 = (x, y) => { const z = zAt(x, y); if (z == null) return null; const v = [x, y, z]; if (post) post(v); return v; };
  g.userData.at = (x, y, out) => { const p0 = P3(x, y); if (!p0) return null; const e = 0.012, px = P3(x + e, y), py = P3(x, y + e); let nx = 0, ny = 0, nz = 1; if (px && py) { const ax = px[0] - p0[0], ay = px[1] - p0[1], az = px[2] - p0[2], bx = py[0] - p0[0], by = py[1] - p0[1], bz = py[2] - p0[2]; nx = ay * bz - az * by; ny = az * bx - ax * bz; nz = ax * by - ay * bx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l; if (nz < 0) { nx = -nx; ny = -ny; nz = -nz; } } const o = out || {}; o.p = p0; o.n = [nx, ny, nz]; return o; };
  /* ponto da superfície numa direção qualquer (linhas acesas sobre o crânio, chifres, frondes) */
  const SP = (dx, dy, dz) => { const l = Math.hypot(dx, dy, dz) || 1; const r = R(dx / l, dy / l, dz / l); const v = [cx + dx / l * r, cy + dy / l * r, cz + dz / l * r]; if (post) post(v); return v; };
  g.userData.pt = (dx, dy, dz) => { const p0 = SP(dx, dy, dz), e = 0.01; let ux = -dz, uy = 0, uz = dx; if (Math.abs(dy) > 0.9) { ux = 1; uy = 0; uz = 0; } const ul = Math.hypot(ux, uy, uz) || 1; ux /= ul; uz /= ul; uy /= ul; const vx = dy * uz - dz * uy, vy = dz * ux - dx * uz, vz = dx * uy - dy * ux;
    const a = SP(dx + ux * e, dy + uy * e, dz + uz * e), b = SP(dx + vx * e, dy + vy * e, dz + vz * e); const ax = a[0] - p0[0], ay = a[1] - p0[1], az = a[2] - p0[2], bx = b[0] - p0[0], by = b[1] - p0[1], bz = b[2] - p0[2];
    let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx; const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl; if (nx * dx + ny * dy + nz * dz < 0) { nx = -nx; ny = -ny; nz = -nz; } return { p: p0, n: [nx, ny, nz] }; };
  return g; }
/* pintura de vértice: f(x,y,z,nx,ny,nz,i) -> fator (número) ou [r,g,b] */
function paint(g, f) { const p = g.getAttribute('position').array, n = g.getAttribute('normal').array, c = g.getAttribute('color').array, cnt = p.length / 3;
  for (let i = 0; i < cnt; i++) { const v = f(p[i * 3], p[i * 3 + 1], p[i * 3 + 2], n[i * 3], n[i * 3 + 1], n[i * 3 + 2], i); if (v == null) continue; if (typeof v === 'number') { c[i * 3] *= v; c[i * 3 + 1] *= v; c[i * 3 + 2] *= v; } else { c[i * 3] *= v[0]; c[i * 3 + 1] *= v[1]; c[i * 3 + 2] *= v[2]; } } return g; }
/* oclusão ambiente analítica por esferas-sonda [cx,cy,cz,r]: escurece o que fica sob a aba, o pescoço sob o queixo, a gola etc. */
function ao(g, prox, k, floor) { k = k == null ? 1 : k; floor = floor == null ? 0.35 : floor; return paint(g, (x, y, z, nx, ny, nz) => { let occ = 0; for (const s of prox) { const dx = s[0] - x, dy = s[1] - y, dz = s[2] - z, d2 = dx * dx + dy * dy + dz * dz, d = Math.sqrt(d2) || 1; if (d < s[3] * 0.98) continue; const c = (nx * dx + ny * dy + nz * dz) / d; if (c <= 0) continue; occ += c * s[3] * s[3] / d2; } return Math.max(floor, 1 - k * occ * 0.62); }); }
/* primitivas curtas */
const SPH = (r, w, h, a, b, c, d) => new (T().SphereGeometry)(r, w || 16, h || 12, a, b, c, d);
const CYL = (rt, rb, h, s, hs, open) => new (T().CylinderGeometry)(rt, rb, h, s || 16, hs || 1, !!open);
const BOX = (w, h, d) => new (T().BoxGeometry)(w, h, d);
const TOR = (R, r, rs, ts, arc) => new (T().TorusGeometry)(R, r, rs || 8, ts || 24, arc == null ? Math.PI * 2 : arc);
const CONE = (r, h, s) => new (T().ConeGeometry)(r, h, s || 8);
/* caixa arredondada barata: esfera "quadrada" (superelipse) */
function rbox(w, h, d, e, seg) { const g = SPH(1, seg || 16, seg || 12); const a = g.getAttribute('position').array; const ex = 2 / (e || 6);
  for (let i = 0; i < a.length; i += 3) { const x = a[i], y = a[i + 1], z = a[i + 2]; const f = v => Math.sign(v) * Math.pow(Math.abs(v), ex); a[i] = f(x) * w / 2; a[i + 1] = f(y) * h / 2; a[i + 2] = f(z) * d / 2; } g.computeVertexNormals(); weld(g); return g; }
/* ---------- 4.3e: kit de materiais e texturas por busto (os quatro humores dividem tudo; nada é recriado ao trocar de humor) ---------- */
function newKit(race, o) { o = o || {}; const kit = { race, hi: !!o.hi, env: o.env !== undefined ? o.env : envTex, mats: [], tex: [], geo: new Map(), glows: [], basics: [], q: o.hi ? 1.7 : 1 };
  kit.g = (key, fn) => { let g = kit.geo.get(key); if (!g) { g = fn(); kit.geo.set(key, g); } return g; };
  kit.seg = n => Math.max(3, Math.round(n * kit.q)); return kit; }
/* material registrado no kit; com mapa de ambiente próprio (no r186 o envMapIntensity do material só vale com material.envMap) */
function MAT(kit, type, name, o, glow) { const THREE = T(); const m = new THREE[type](o); m.name = name; if (kit.env && m.isMeshStandardMaterial) m.envMap = kit.env;
  m.userData.env0 = m.envMapIntensity == null ? 1 : m.envMapIntensity; m.userData.e0 = m.emissiveIntensity == null ? 0 : m.emissiveIntensity; if (m.isMeshBasicMaterial || m.isPointsMaterial) m.userData.c0 = m.color.clone(); kit.mats.push(m); if (glow) (m.isMeshBasicMaterial || m.isPointsMaterial ? kit.basics : kit.glows).push(m); return m; }
function cnv(n, m) { const c = document.createElement('canvas'); c.width = n; c.height = m || n; return c; }
/* 4.3e: os desenhos procedurais (olhos, mapas de normal, rampas) são feitos uma vez por página e guardados; cada kit só embrulha o canvas numa textura sua (descarte seguro) */
const CVC = new Map(); function cached(key, fn) { let c = CVC.get(key); if (!c) { c = fn(); CVC.set(key, c); } return c; }
function TEX(kit, cv, srgb, rep) { const THREE = T(); const t = new THREE.CanvasTexture(cv); t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = 4; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); } kit.tex.push(t); return t; }
const hex = c => '#' + ('000000' + (c >>> 0).toString(16)).slice(-6);
/* olho pintado: esclera, íris com estrias e anel, pupila redonda ou em fenda, e o reflexo (no mapa emissivo, para ler pequeno) */
function eyeTex(kit, k) { return kit.g('eyetex:' + k.kind, () => { const pair = cached('olho:' + k.kind + ':' + (kit.hi ? 1 : 0), () => eyeCanvas(k, kit.hi ? 256 : 128)); return { map: TEX(kit, pair[0], true), emi: TEX(kit, pair[1], true) }; }); }
function eyeCanvas(k, S) { { const c = S / 2, ri = S * 0.29 * (k.iris || 1), r = rng(k.seed || 7);
  const A = cnv(S), a = A.getContext('2d'), E = cnv(S), e = E.getContext('2d'); e.fillStyle = '#000'; e.fillRect(0, 0, S, S);
  let gr = a.createRadialGradient(c, c, S * 0.1, c, c, S * 0.5); gr.addColorStop(0, hex(k.sclera)); gr.addColorStop(1, hex(k.scleraEdge || k.sclera)); a.fillStyle = gr; a.fillRect(0, 0, S, S);
  if (k.veins) { a.strokeStyle = 'rgba(150,30,30,0.35)'; a.lineWidth = S / 160; for (let i = 0; i < 9; i++) { let x = c + Math.cos(i * 0.7) * S * 0.47, y = c + Math.sin(i * 0.7) * S * 0.47; a.beginPath(); a.moveTo(x, y); for (let j = 0; j < 5; j++) { x += (c - x) * 0.18 + (r() - 0.5) * S * 0.05; y += (c - y) * 0.18 + (r() - 0.5) * S * 0.05; a.lineTo(x, y); } a.stroke(); } }
  const iris = (ctx, glow) => { let g2 = ctx.createRadialGradient(c, c, ri * 0.15, c, c, ri); g2.addColorStop(0, hex(glow ? k.glowIn : k.irisIn)); g2.addColorStop(0.55, hex(glow ? k.glowMid : k.irisMid)); g2.addColorStop(1, hex(glow ? k.glowOut : k.irisOut)); ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(c, c, ri, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.arc(c, c, ri, 0, Math.PI * 2); ctx.clip(); const N = k.lens ? 9 : 70;
    for (let i = 0; i < N; i++) { const an = k.lens ? i / N * Math.PI * 2 : r() * Math.PI * 2; ctx.strokeStyle = k.lens ? (glow ? 'rgba(0,0,0,0.55)' : 'rgba(20,20,24,0.8)') : (glow ? 'rgba(255,255,255,' + (0.08 + r() * 0.18) + ')' : 'rgba(0,0,0,' + (0.1 + r() * 0.25) + ')'); ctx.lineWidth = k.lens ? S / 70 : S / 200 + r() * S / 220;
      ctx.beginPath(); if (k.lens) { ctx.moveTo(c + Math.cos(an) * ri * 0.2, c + Math.sin(an) * ri * 0.2); ctx.lineTo(c + Math.cos(an + 0.9) * ri * 0.75, c + Math.sin(an + 0.9) * ri * 0.75); } else { ctx.moveTo(c + Math.cos(an) * ri * 0.35, c + Math.sin(an) * ri * 0.35); ctx.lineTo(c + Math.cos(an + (r() - 0.5) * 0.2) * ri * 0.98, c + Math.sin(an) * ri * 0.98); } ctx.stroke(); }
    if (k.lens) for (const rr of [0.82, 0.62]) { ctx.strokeStyle = glow ? 'rgba(255,240,200,0.5)' : 'rgba(0,0,0,0.6)'; ctx.lineWidth = S / 90; ctx.beginPath(); ctx.arc(c, c, ri * rr, 0, Math.PI * 2); ctx.stroke(); }
    ctx.restore(); ctx.strokeStyle = glow ? 'rgba(0,0,0,0.7)' : hex(k.limbus || 0x000000); ctx.lineWidth = ri * 0.13; ctx.beginPath(); ctx.arc(c, c, ri * 0.95, 0, Math.PI * 2); ctx.stroke(); };
  iris(a, false); if (k.glowIn != null) iris(e, true);
  const pup = ctx => { ctx.fillStyle = '#020203'; ctx.beginPath(); if (k.slit) ctx.ellipse(c, c, ri * 0.13 * k.slit, ri * 0.82, 0, 0, Math.PI * 2); else if (k.lens) { const n = 6; for (let i = 0; i <= n; i++) { const an = i / n * Math.PI * 2 + 0.3; const x = c + Math.cos(an) * ri * 0.36, y = c + Math.sin(an) * ri * 0.36; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } } else ctx.arc(c, c, ri * 0.4, 0, Math.PI * 2); ctx.fill(); };
  pup(a); pup(e);
  /* reflexo: uma janela forte em cima à esquerda e um ponto menor embaixo à direita */
  for (const [dx, dy, rr, al] of [[-0.42, -0.46, 0.2, 1], [0.38, 0.4, 0.09, 0.7]]) { for (const ctx of [a, e]) { const g3 = ctx.createRadialGradient(c + dx * ri, c + dy * ri, 0, c + dx * ri, c + dy * ri, rr * ri); g3.addColorStop(0, 'rgba(255,255,255,' + al + ')'); g3.addColorStop(0.6, 'rgba(255,255,255,' + al * 0.85 + ')'); g3.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g3; ctx.beginPath(); ctx.arc(c + dx * ri, c + dy * ri, rr * ri, 0, Math.PI * 2); ctx.fill(); } }
  return [A, E]; } }
/* nervura acesa ao longo de uma lâmina varrida (u = comprimento, v = volta): linha no meio das duas faces, mais forte para a ponta */
function veinTex(kit, key, col) { return kit.g('veia:' + key, () => { const C = cached('veia:' + key, () => { const W = 128, Hh = 32, c = cnv(W, Hh), x = c.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, W, Hh);
    for (let i = 0; i < W; i++) { const u = i / W, k = Math.pow(u, 1.4); for (const vc of [0.25, 0.75]) { const g = x.createLinearGradient(0, (vc - 0.09) * Hh, 0, (vc + 0.09) * Hh); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, 'rgba(' + col.join(',') + ',' + (0.25 + 0.75 * k) + ')'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(i, (vc - 0.09) * Hh, 1, 0.18 * Hh); } }
    return c; }); return TEX(kit, C, true); }); }
/* sprite redondo de brilho (faíscas, brasas, esporos) */
function spriteTex(kit) { return kit.g('sprite', () => TEX(kit, cached('sprite', () => { const S = 64, C = cnv(S), x = C.getContext('2d'); const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.85)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, S, S); return C; }), true)); }
/* rampa horizontal (u): pontas acesas das frondes, faixas de luz */
function rampTex(kit, key, stops) { return kit.g('ramp:' + key, () => { const C = cached('ramp:' + key, () => { const C2 = cnv(128, 4), x = C2.getContext('2d'); const g = x.createLinearGradient(0, 0, 128, 0); for (const [t, c] of stops) g.addColorStop(t, c); x.fillStyle = g; x.fillRect(0, 0, 128, 4); return C2; }); const t = TEX(kit, C, true); t.generateMipmaps = false; t.minFilter = T().LinearFilter; return t; }); }
/* mapa de normal a partir de uma altura procedural h(u,v) (0..1, ladrilhável) — poros, rugas, riscos, escamas */
function normalTex(kit, key, S, h, k, rep) { return kit.g('nrm:' + key, () => TEX(kit, cached('nrm:' + key + ':' + S, () => { const C = cnv(S), x = C.getContext('2d'), im = x.createImageData(S, S), d = im.data, H = new Float32Array(S * S);
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) H[j * S + i] = h(i / S, j / S);
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) { const l = H[j * S + (i + S - 1) % S], rr = H[j * S + (i + 1) % S], u = H[((j + S - 1) % S) * S + i], dd = H[((j + 1) % S) * S + i]; let nx = (l - rr) * k, ny = (dd - u) * k, nz = 1; const s = Math.hypot(nx, ny, nz); const o = (j * S + i) * 4; d[o] = (nx / s * 0.5 + 0.5) * 255; d[o + 1] = (ny / s * 0.5 + 0.5) * 255; d[o + 2] = (nz / s * 0.5 + 0.5) * 255; d[o + 3] = 255; }
  x.putImageData(im, 0, 0); return C; }), false, rep)); }
/* detalhes por material (ladrilháveis): poros e rugas, metal martelado, quitina picotada, nervuras de folha, escamas finas */
const DET = {
  poros: (u, v) => 0.5 * tnoise(u, v, 48, 11) + 0.3 * tnoise(u, v, 112, 12) - 0.35 * Math.pow(1 - Math.abs(tnoise(u, v, 14, 13) - 0.5) * 2, 8),
  metal: (u, v) => 0.6 * tnoise(u, v, 10, 21) + 0.18 * tnoise(u, v, 70, 22) + 0.2 * (Math.abs(((u * 7 + v * 3) % 1) - 0.5) < 0.004 ? 1 : 0),
  quitina: (u, v) => { const a = tnoise(u, v, 22, 31), b = tnoise(u, v, 60, 32); return 1 - Math.abs(a - 0.5) * 2 + 0.3 * b; },
  folha: (u, v) => 0.45 * tnoise(u, v, 56, 41) + 0.3 * tnoise(u, v, 128, 42) - 0.3 * Math.pow(1 - Math.abs(tnoise(u, v, 10, 43) - 0.5) * 2, 10),
  escama: (u, v) => { const x = u * 48, y = v * 48 + (Math.floor(u * 48) % 2) * 0.5; const fx = x - Math.floor(x) - 0.5, fy = y - Math.floor(y) - 0.5; return 1 - Math.min(1, Math.hypot(fx, fy) * 1.6) + 0.15 * tnoise(u, v, 30, 51); },
  casca: (u, v) => { const w = u + 0.04 * tnoise(u, v, 6, 61) + 0.015 * tnoise(u, v, 24, 63); return 0.75 * Math.pow(Math.abs(Math.sin(w * Math.PI * 18)), 0.45) + 0.25 * tn2(u, v, 12, 4, 62); } };
/* ruído periódico com frequências diferentes em u e v (fios de pelo ao longo do tubo) */
function tn2(u, v, fu, fv, seed) { const x = u * fu, y = v * fv, xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy), wu = k => ((k % fu) + fu) % fu, wv = k => ((k % fv) + fv) % fv;
  const h = (a, b) => hash3(wu(a), wv(b), seed); return lerp(lerp(h(xi, yi), h(xi + 1, yi), sx), lerp(h(xi, yi + 1), h(xi + 1, yi + 1), sx), sy); }
DET.pelo = (u, v) => 0.6 * tn2(u, v, 3, 90, 71) + 0.3 * tn2(u, v, 7, 160, 72) + 0.15 * tnoise(u, v, 20, 73);
function detail(kit, key, rep, k) { return normalTex(kit, key, kit.hi ? 512 : 256, DET[key], k || 2, rep); }
/* ruído ladrilhável (para os mapas de normal): valor periódico em p */
function tnoise(u, v, f, seed) { const x = u * f, y = v * f, xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy), w = k => ((k % f) + f) % f;
  const h = (a, b) => hash3(w(a), w(b), seed); return lerp(lerp(h(xi, yi), h(xi + 1, yi), sx), lerp(h(xi, yi + 1), h(xi + 1, yi + 1), sx), sy); }
/* ---------- 4.3e: peças do rosto com rig — olho (globo pintado + córnea), pálpebras, sobrancelhas, boca/mandíbula, órbita ---------- */
/* órbita (função de ponto para a escultura): perto do olho a pele abraça a esfera da pálpebra por dentro (as pálpebras ficam por cima, sem costura) e,
   dentro do cone de abertura, some atrás do globo; devolve a cavidade (sombra pintada da órbita) */
function sockFn(eyes) { return p => { let cv = 0; for (const E of eyes) { const dx = p[0] - E.c[0], dy = p[1] - E.c[1], dz = p[2] - E.c[2], d = Math.hypot(dx, dy, dz); if (d > E.rl * 2.1 || d < 1e-6) continue;
    const cosA = (dx * E.f[0] + dy * E.f[1] + dz * E.f[2]) / d; const rt = cosA > Math.cos(E.cone || 0.84) ? E.re * 0.82 : E.rl * 0.985; const w = 1 - sstep(E.rl * 1.18, E.rl * 2.1, d); const nd = lerp(d, rt, w);
    p[0] = E.c[0] + dx / d * nd; p[1] = E.c[1] + dy / d * nd; p[2] = E.c[2] + dz / d * nd; cv = Math.min(cv, -0.5 * w * (E.dark == null ? 1 : E.dark)); } return cv; }; }
/* globo ocular com UV plano de frente (a íris pintada fica no centro do mapa) */
function eyeballGeo(kit, re) { return kit.g('globo:' + re.toFixed(3), () => { const g = SPH(re, kit.seg(26), kit.seg(20)); const p = g.getAttribute('position').array, uv = g.getAttribute('uv').array; for (let i = 0; i < p.length / 3; i++) { uv[i * 2] = 0.5 + 0.5 * p[i * 3] / re; uv[i * 2 + 1] = 0.5 + 0.5 * p[i * 3 + 1] / re; } return g; }); }
function corneaGeo(kit, re) { return kit.g('cornea:' + re.toFixed(3), () => { const g = SPH(re * 1.02, kit.seg(20), kit.seg(8), 0, Math.PI * 2, 0, 0.78); g.rotateX(Math.PI / 2); g.scale(1, 1, 1.1); return g; }); }
/* pálpebra: casca de esfera em volta do olho, borda definida por e(az) (elevação em rad), com margem enrolada e linha escura dos cílios */
function lidGeo(kit, re, rl, upper, edge, o) { const THREE = T(); o = o || {}; const nu = kit.seg(o.nu || 22), azM = o.azMax || 1.5, elF = o.elFar || 1.25, sg = upper ? 1 : -1; const P = [], C = [], I = [];
  const rows = [[-0.035, re * 1.004, upper ? 0.12 : 0.55], [0.0, lerp(re, rl, 0.72), upper ? 0.22 : 0.72], [0.07, rl, upper ? 0.62 : 0.92]]; const nr = 6; for (let k = 1; k <= nr; k++) rows.push([0.07 + (k / nr) * 1.0, rl * (1 + (o.crease || 0.035) * Math.sin(k / nr * Math.PI) * (upper ? 1 : 0.4)), k === 1 ? (upper ? 0.85 : 1) : 1]);
  for (let j = 0; j < rows.length; j++) for (let i = 0; i <= nu; i++) { const az = -azM + 2 * azM * i / nu, e0 = edge(az), r = rows[j]; let el = j < 3 ? e0 + sg * r[0] : lerp(e0 + sg * 0.07, sg * elF, (j - 2) / nr); if (sg > 0 ? el > elF : el < -elF) el = sg * elF;
    const ce = Math.cos(el); P.push(Math.sin(az) * ce * r[1], Math.sin(el) * r[1], Math.cos(az) * ce * r[1]); const shade = r[2] * (o.dark && j < 2 ? o.dark : 1); C.push(shade, shade, shade); }
  for (let j = 0; j < rows.length - 1; j++) for (let i = 0; i < nu; i++) { const a = j * (nu + 1) + i, b = a + nu + 1; if (upper) I.push(a, a + 1, b, a + 1, b + 1, b); else I.push(a, b, a + 1, a + 1, b, b + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.setIndex(I); g.computeVertexNormals(); return prep(g); }
/* bordas das pálpebras por humor (X = EXPR), lado (-1 olho à esquerda da tela) e "cant" (canto de fora mais alto) */
function lidEdges(X, side, o) { o = o || {}; const azO = o.azOpen || 0.72, cant = o.cant || 0, up = o.up != null ? o.up : X.up, lo = o.lo != null ? o.lo : X.lo, tilt = (o.tilt != null ? o.tilt : X.tilt) * (o.tiltK || 1);
  const shape = az => { const u = clamp(az / azO, -1, 1); return Math.pow(Math.max(0, 1 - u * u), 0.62); }, inner = az => clamp(-side * az / azO, -1.2, 1.2);
  const cor = az => -0.04 - cant * 0.16 * inner(az);
  const eu0 = lerp(-0.06, 0.66, up), dl = lerp(0.62, -0.16, lo);
  return { up: az => cor(az) + (eu0 - cor(0)) * shape(az) - tilt * 0.34 * Math.max(0, inner(az)) * shape(az) + (tilt < 0 ? tilt * 0.12 * Math.max(0, -inner(az)) * shape(az) : 0),
    lo: az => cor(az) - dl * shape(az) + (lo > 0.6 ? 0 : tilt * 0.06 * Math.max(0, inner(az)) * shape(az)), close: eu0 + 0.62 }; }
/* olho completo num "encaixe" orientado (o grupo do olho gira para olhar; as pálpebras giram para piscar) */
function eyeRig(kit, rig, parent, o) { const THREE = T(); const sock = new THREE.Group(); sock.position.set(o.c[0], o.c[1], o.c[2]); sock.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(o.f[0], o.f[1], o.f[2]).normalize()); parent.add(sock);
  const eye = new THREE.Group(); sock.add(eye); eye.add(new THREE.Mesh(eyeballGeo(kit, o.re), o.mat)); if (o.cornea) eye.add(new THREE.Mesh(corneaGeo(kit, o.re), o.cornea));
  eye.userData.r = o.re; eye.userData.bx = o.look ? -o.look[1] * 0.35 : 0; eye.userData.by = o.look ? o.look[0] * 0.45 : 0; eye.rotation.set(eye.userData.bx, eye.userData.by, 0); rig.eyes.push(eye);
  if (o.lidMat) { const ed = o.edges; for (const up of [true, false]) { const lg = lidGeo(kit, o.re, o.rl, up, up ? ed.up : ed.lo, o.lid); const m = new THREE.Mesh(lg, o.lidMat); sock.add(m); (rig.lids = rig.lids || []).push(m); m.userData.up = up; m.userData.k = up ? ed.close : 0.12; } }
  return { sock, eye }; }
/* sobrancelha: tubo afinado que segue a pele (pivô no centro: o animate gira em z a partir de userData.base) */
function browRig(kit, rig, parent, at, o) { const THREE = T(); const side = o.side, n = 7, pts = [], hit = {}; const x0 = o.x0, x1 = o.x1; let cx = 0, cy = 0, cz = 0;
  for (let i = 0; i < n; i++) { const t = i / (n - 1), x = lerp(x0, x1, t) * side, y = o.y + o.arch * Math.sin(t * Math.PI) * 0.1 + (o.lift || 0) * t; const s = at(x, y, hit); const off = o.off || 0.02; const p = s ? [s.p[0] + s.n[0] * off, s.p[1] + s.n[1] * off, s.p[2] + s.n[2] * off] : [x, y, o.z || 0.9]; pts.push(p); cx += p[0]; cy += p[1]; cz += p[2]; }
  cx /= n; cy /= n; cz /= n; for (const p of pts) { p[0] -= cx; p[1] -= cy; p[2] -= cz; }
  const g = sweep(pts, { n: kit.seg(18), m: kit.seg(8), up: [0, 0.15, 1], r: t => { const h = lerp(o.h0, o.h1, t) * (0.5 + 0.5 * sstep(0, 0.18, t)) * (1 - 0.82 * sstep(0.68, 1, t)); return [h, (o.th || 0.03) * (1 - 0.55 * sstep(0.55, 1, t))]; }, smooth: true });
  const m = new THREE.Mesh(prep(g, o.tint), o.mat); m.position.set(cx, cy + (o.dy || 0), cz); m.rotation.z = o.ang; m.userData.base = o.ang; m.userData.side = side; m.userData.y0 = m.position.y; parent.add(m); rig.brows.push(m); return m; }
/* boca: lábios (tubos), interior escuro e dentes; a parte de baixo vai num grupo de mandíbula que gira para abrir */
function mouthRig(kit, rig, parent, at, o) { const THREE = T(); const mg = new THREE.Group(); parent.add(mg); const jaw = new THREE.Group(); const w = o.w, y0 = o.y, hit = {};
  const S = (x, y, off) => { const s = at(x, y, hit); if (!s) return [x, y, 0.9]; return [s.p[0] + s.n[0] * off, s.p[1] + s.n[1] * off, s.p[2] + s.n[2] * off]; };
  const sh = o.shape; /* sh: { cl, cr: altura dos cantos; up: [abertura do lábio de cima no meio, a 1/2]; lo: [idem de baixo]; skew } */
  const N = 9, upP = [], loP = []; for (let i = 0; i < N; i++) { const t = i / (N - 1), u = t * 2 - 1, x = u * w, corner = lerp(sh.cl, sh.cr, t), bell = 1 - u * u, mid = Math.pow(bell, 0.8);
    upP.push([x, y0 + corner * (1 - mid) + sh.up * mid + (sh.skew || 0) * u * mid]); loP.push([x, y0 + corner * (1 - mid) - sh.lo * mid + (sh.skew || 0) * u * mid]); }
  const center = S(0, y0 + (sh.up - sh.lo) * 0.5, 0); mg.position.set(center[0], center[1], center[2]); const rel = p => [p[0] - center[0], p[1] - center[1], p[2] - center[2]];
  const lipR = o.lip || 0.035, lt = o.lipTint; const tube = (pts2, r0, dy, dz) => sweep(pts2.map(p => rel(S(p[0], p[1] + dy, lipR * 0.8 + (dz || 0)))), { n: kit.seg(22), m: kit.seg(8), up: [0, 0.2, 1], r: t => { const k = Math.pow(Math.sin(t * Math.PI), 0.5); return [r0 * (0.35 + 0.65 * k), lipR * (0.5 + 0.5 * k)]; }, smooth: true });
  const open = sh.up + sh.lo > 0.04;
  if (open) { /* interior: faixa entre as duas curvas, um pouco para dentro */ const P = [], I = []; for (let i = 0; i < N; i++) { const a = rel(S(upP[i][0], upP[i][1] - lipR * 0.3, -0.03)), b = rel(S(loP[i][0], loP[i][1] + lipR * 0.3, -0.03)); P.push(...a, ...b); } for (let i = 0; i < N - 1; i++) { const a = i * 2; I.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const ig = new THREE.BufferGeometry(); ig.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); ig.setIndex(I); ig.computeVertexNormals(); mg.add(new THREE.Mesh(prep(ig), o.inside)); }
  else { mg.add(new THREE.Mesh(prep(sweep(upP.map(p => rel(S(p[0], p[1], 0.006))), { n: kit.seg(20), m: 6, up: [0, 0.2, 1], r: t => { const k = Math.sin(t * Math.PI); return [lipR * 0.32 * (0.4 + 0.6 * k), lipR * 0.3]; } })), o.inside)); }
  mg.add(new THREE.Mesh(prep(tube(upP, lipR * (o.upperK || 1.05), lipR * 0.55), lt), o.skin));
  const pivot = rel(S(0, y0 + 0.06, -0.55)); jaw.position.set(pivot[0], pivot[1], pivot[2]); mg.add(jaw); const relJ = p => [p[0] - pivot[0], p[1] - pivot[1], p[2] - pivot[2]];
  const lo = new THREE.Mesh(prep(tube(loP, lipR * (o.lowerK || 1.2), -lipR * 0.55), lt), o.skin); lo.geometry.translate(-pivot[0], -pivot[1], -pivot[2]); jaw.add(lo);
  if (o.teeth && open) { const tb = new Bag(); const tw = o.teeth;
    const row = (curve, down, nT, size, inJaw) => { for (let i = 0; i < nT; i++) { const t = (i + 0.5) / nT, u = t * 2 - 1; const idx = t * (N - 1), i0 = Math.floor(idx), f = idx - i0; const p0 = curve[Math.min(N - 1, i0)], p1 = curve[Math.min(N - 1, i0 + 1)]; const x = lerp(p0[0], p1[0], f), y = lerp(p0[1], p1[1], f);
      const fang = tw.fangs && Math.abs(Math.abs(u) - tw.fangs) < 0.13; const hh = size * (fang ? 2.0 : 1) * (1 - 0.35 * u * u), ww = size * 0.78 * (1 - 0.25 * u * u); let p = rel(S(x, y + (down ? -1 : 1) * (lipR * 0.2), -0.012));
      const tg = fang ? CONE(ww * 0.55, hh * 1.25, 8) : rbox(ww, hh, ww * 0.8, 3, 8); if (fang && down) tg.rotateX(Math.PI); xf(tg, [p[0], p[1] + (down ? -hh * 0.42 : hh * 0.42), p[2]], [0, -u * 0.6, 0]); if (inJaw) tg.translate(-pivot[0], -pivot[1], -pivot[2]); tb.add(o.tooth, tg); } };
    row(upP, true, tw.up || 8, tw.size || 0.05, false); const upM = tb.flush(mg, 'dentes');
    if (tw.lo) { row(loP, false, tw.lo, (tw.size || 0.05) * 0.85, true); tb.flush(jaw, 'dentes'); } }
  jaw.rotation.x = o.jawOpen || 0; jaw.userData.base = jaw.rotation.x; rig.mouth = mg; rig.jaw = jaw; return { mg, jaw }; }
/* formas de boca por humor (largura relativa) */
function mouthShape(kind, w) { switch (kind) {
  case 'snarl': return { cl: -0.035, cr: -0.035, up: 0.085, lo: 0.075, skew: 0 };
  case 'grin': return { cl: 0.07, cr: 0.07, up: 0.02, lo: 0.105, skew: 0 };
  case 'frown': return { cl: -0.06, cr: -0.06, up: 0.008, lo: 0.012, skew: 0 };
  case 'smirk': return { cl: -0.005, cr: 0.05, up: 0, lo: 0, skew: 0.01 };
  default: return { cl: 0.028, cr: 0.028, up: 0, lo: 0, skew: 0 }; } }
/* ---------- 4.3e: montagem do busto: raiz (balanço) → corpo (fixo) + pivô do pescoço (cabeça: postura, aceno, olhar) ---------- */
Bag.prototype.list = function () { const out = []; for (const [mat, l] of this.m) if (l.length) out.push({ geo: merge(l), mat }); this.m.clear(); return out; };
function inst(parent, list, name) { const THREE = T(); const out = []; for (const s of list) { const me = new THREE.Mesh(s.geo, s.mat); me.name = (name || 'fixo') + ':' + (s.mat.name || ''); me.matrixAutoUpdate = false; me.updateMatrix(); parent.add(me); out.push(me); } return out; }
/* placa curva que segue a superfície at(): superelipse (a, b, expoente e) com espessura, para bochechas, máscaras, emblemas */
function plate(at, cx, cy, a, b, e, off, th, nr, nf, warp) { const THREE = T(); nr = nr || 5; nf = nf || 24; const P = [], I = [], hit = {}; const ex = 2 / (e || 4);
  const pt = (rho, f, o2) => { const cf = Math.cos(f), sf = Math.sin(f); let x = cx + a * rho * Math.sign(cf) * Math.pow(Math.abs(cf), ex), y = cy + b * rho * Math.sign(sf) * Math.pow(Math.abs(sf), ex); if (warp) { const w = warp(x, y); x = w[0]; y = w[1]; } const s = at(x, y, hit); if (!s) return [x, y, 0.9]; return [s.p[0] + s.n[0] * o2, s.p[1] + s.n[1] * o2, s.p[2] + s.n[2] * o2]; };
  const ring = (rho, o2) => { const r0 = P.length / 3; for (let j = 0; j < nf; j++) P.push(...pt(rho, j / nf * Math.PI * 2, o2)); return r0; };
  P.push(...pt(0, 0, off)); const rings = [0]; for (let k = 1; k <= nr; k++) rings.push(ring(k / nr, off)); const back = ring(1, off - th);
  for (let j = 0; j < nf; j++) { const j1 = (j + 1) % nf; I.push(0, rings[1] + j, rings[1] + j1); for (let k = 1; k < nr; k++) { const a0 = rings[k] + j, a1 = rings[k] + j1, b0 = rings[k + 1] + j, b1 = rings[k + 1] + j1; I.push(a0, b0, b1, a0, b1, a1); }
    const o0 = rings[nr] + j, o1 = rings[nr] + j1, c0 = back + j, c1 = back + j1; I.push(o0, c0, c1, o0, c1, o1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setIndex(I); g.computeVertexNormals(); return g; }
/* rebites em volta de uma placa ou ao longo de pontos com normal */
let RIV = [6, 2]; /* 4.3e: rebite barato (24 triângulos); a arte (hi) usa mais */
function rivetsOn(bag, mat, pts, r, tint) { for (const s of pts) { const g = SPH(r, RIV[0], RIV[1], 0, Math.PI * 2, 0, Math.PI / 2); xf(g, s.p, qUp(s.n)); bag.add(mat, g, tint); } }
function ringPts(at, cx, cy, a, b, e, rho, n, off) { const out = [], ex = 2 / (e || 4), hit = {}; for (let j = 0; j < n; j++) { const f = j / n * Math.PI * 2 + 0.3, cf = Math.cos(f), sf = Math.sin(f); const x = cx + a * rho * Math.sign(cf) * Math.pow(Math.abs(cf), ex), y = cy + b * rho * Math.sign(sf) * Math.pow(Math.abs(sf), ex); const s = at(x, y, hit); if (s) out.push({ p: [s.p[0] + s.n[0] * off, s.p[1] + s.n[1] * off, s.p[2] + s.n[2] * off], n: s.n.slice() }); } return out; }
/* pontos ao redor de um torno (anel de rebites numa gola, num capacete) */
function lathePts(r, y, n, phi0, phiLen, tr) { const out = []; for (let j = 0; j < n; j++) { const f = (phi0 || 0) + (phiLen == null ? Math.PI * 2 : phiLen) * (phiLen == null ? j / n : j / Math.max(1, n - 1)); const p = [Math.sin(f) * r, y, Math.cos(f) * r]; const nn = [Math.sin(f), 0, Math.cos(f)]; if (tr) tr(p, nn); out.push({ p, n: nn }); } return out; }
/* partículas (faíscas, brasas, esporos): um Points só = uma chamada de desenho; o animate só reescreve posições */
function particles(kit, n, color, size, opac) { const THREE = T(); const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3)); g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  const m = kit.g('pmat:' + color + ':' + size, () => MAT(kit, 'PointsMaterial', 'particulas', { color, size, map: spriteTex(kit), vertexColors: true, transparent: true, opacity: opac == null ? 1 : opac, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }, true));
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; return pts; }
/* auras: pontos de brilho aditivos atrás/à frente dos emissivos (no jogo não há bloom no retrato) */
function glowPts(kit, list, color, size) { const THREE = T(); const g = new THREE.BufferGeometry(); const P = new Float32Array(list.length * 3), C = new Float32Array(list.length * 3); list.forEach((q, i) => { P[i * 3] = q[0]; P[i * 3 + 1] = q[1]; P[i * 3 + 2] = q[2]; C[i * 3] = C[i * 3 + 1] = C[i * 3 + 2] = q[3] == null ? 1 : q[3]; });
  g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('color', new THREE.BufferAttribute(C, 3)); const m = kit.g('aura:' + color + ':' + size, () => MAT(kit, 'PointsMaterial', 'aura', { color, size, map: spriteTex(kit), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }, true));
  const p = new THREE.Points(g, m); p.frustumCulled = false; p.userData.aura = true; return p; }
const BUILD = {};
/* buildHead(raça, humor, { hi, env, kit }) → { g, rig } ; determinístico; os humores do mesmo kit dividem materiais e geometria fixa */
function buildHead(race, mood, opts) { const THREE = T(); opts = opts || {}; const X = EXPR[mood] || EXPR[1]; const kit = opts.kit || newKit(race, opts);
  const g = new THREE.Group(); const body = new THREE.Group(); const neck = new THREE.Group(); const head = new THREE.Group(); g.add(body); g.add(neck); neck.add(head);
  const rig = { eyes: [], brows: [], lids: [], mouth: null, jaw: null, glow: null, body, head: neck, kit, mood, X, extra: [] };
  const fn = BUILD[race] || BUILD.vehnar; RIV = kit.hi ? [10, 4] : [6, 2]; const piv = fn(kit, X, mood, head, body, rig) || -0.72;
  const pk = rig.poseK == null ? 1 : rig.poseK; neck.position.y = piv; head.position.y = -piv; neck.userData.base = [X.px * pk, X.py * pk, X.pz * pk]; neck.rotation.set(X.px * pk, X.py * pk, X.pz * pk);
  if (rig.mouth && !rig.mouth.userData.c) rig.mouth.userData.c = 1; for (const e of rig.eyes) e.userData.baseScale = e.scale.y;
  g.userData.race = race; g.userData.mood = mood; return { g, rig, kit }; }
const nrm = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
/* transformação reutilizável: aplica em geometrias e em pontos/normais (rebites que acompanham a peça) */
function trf(p, r, s) { const THREE = T(); const m = new THREE.Matrix4(); const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(r[0], r[1], r[2])); const sc = typeof s === 'number' ? new THREE.Vector3(s, s, s) : new THREE.Vector3(s[0], s[1], s[2]); m.compose(new THREE.Vector3(p[0], p[1], p[2]), q, sc); const nm = new THREE.Matrix3().getNormalMatrix(m); const v = new THREE.Vector3();
  return { m, g: geo => geo.applyMatrix4(m), p: (pt, n) => { v.set(pt[0], pt[1], pt[2]).applyMatrix4(m); pt[0] = v.x; pt[1] = v.y; pt[2] = v.z; if (n) { v.set(n[0], n[1], n[2]).applyMatrix3(nm).normalize(); n[0] = v.x; n[1] = v.y; n[2] = v.z; } }, pts: list => { for (const s2 of list) { v.set(s2.p[0], s2.p[1], s2.p[2]).applyMatrix4(m); s2.p = [v.x, v.y, v.z]; v.set(s2.n[0], s2.n[1], s2.n[2]).applyMatrix3(nm).normalize(); s2.n = [v.x, v.y, v.z]; } return list; } }; }
/* faixa entre duas curvas sobre uma superfície (boca acesa, interior) */
function ribbon(at, w, y0, sh, off, N, ctr) { const THREE = T(); N = N || 13; const hit = {}, P = [], I = []; const c = ctr || [0, 0, 0];
  for (let i = 0; i < N; i++) { const t = i / (N - 1), u = t * 2 - 1, x = u * w, corner = lerp(sh.cl, sh.cr, t), mid = Math.pow(1 - u * u, 0.8);
    for (const yy of [y0 + corner * (1 - mid) + sh.up * mid, y0 + corner * (1 - mid) - sh.lo * mid]) { const s = at(x, yy, hit); const p = s ? [s.p[0] + s.n[0] * off, s.p[1] + s.n[1] * off, s.p[2] + s.n[2] * off] : [x, yy, 0.9]; P.push(p[0] - c[0], p[1] - c[1], p[2] - c[2]); } }
  for (let i = 0; i < N - 1; i++) { const a = i * 2; I.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setIndex(I); g.computeVertexNormals(); return g; }
/* ---------- Barão-Forja (Consórcio Vehnar): ciborgue industrial de pele curtida, capacete-cúpula rebitado, viseira acesa, olhos de lente,
   placa na bochecha, respirador com grade (a boca é o fogo da fornalha atrás das barras), chaminés com brasa nos ombros, couraça de aço ---------- */
BUILD.vehnar = function (kit, X, mood, H, Bd, rig) { const THREE = T();
  const M = kit.g('mats', () => { const et = eyeTex(kit, { kind: 'lente', lens: true, sclera: 0x4a4038, scleraEdge: 0x16110e, irisIn: 0xffd2a0, irisMid: 0xff8a3a, irisOut: 0x5a2410, glowIn: 0xffa040, glowMid: 0xff6c14, glowOut: 0x3a0e02, limbus: 0x1a1a1e, iris: 1.3, seed: 3 });
    return { skin: MAT(kit, 'MeshPhysicalMaterial', 'pele', { color: 0xa86a48, normalMap: detail(kit, 'poros', [7, 3.5], 2.2), normalScale: new THREE.Vector2(0.55, 0.55), roughness: 0.62, clearcoat: 0.12, clearcoatRoughness: 0.5, sheen: 0.4, sheenRoughness: 0.5, sheenColor: new THREE.Color(0xff9a6a), vertexColors: true, envMapIntensity: 0.3 }),
      steel: MAT(kit, 'MeshStandardMaterial', 'aco', { color: 0x666e7c, normalMap: detail(kit, 'metal', [6, 4], 1.6), normalScale: new THREE.Vector2(0.22, 0.22), metalness: 0.84, roughness: 0.4, vertexColors: true, envMapIntensity: 1.25 }),
      dark: MAT(kit, 'MeshStandardMaterial', 'aco-escuro', { color: 0x363c46, normalMap: detail(kit, 'metal', [6, 4], 1.6), normalScale: new THREE.Vector2(0.22, 0.22), metalness: 0.84, roughness: 0.42, vertexColors: true, envMapIntensity: 1.3 }),
      brass: MAT(kit, 'MeshStandardMaterial', 'latao', { color: 0xd09a48, metalness: 0.85, roughness: 0.3, vertexColors: true, envMapIntensity: 1.4 }),
      rubber: MAT(kit, 'MeshStandardMaterial', 'borracha', { color: 0x2a2c31, roughness: 0.7, vertexColors: true, envMapIntensity: 0.45 }),
      hair: MAT(kit, 'MeshStandardMaterial', 'pelo', { color: 0x6a6158, normalMap: detail(kit, 'pelo', [1, 1], 4), normalScale: new THREE.Vector2(1.2, 1.2), roughness: 0.85, vertexColors: true, envMapIntensity: 0.2 }),
      halo: MAT(kit, 'MeshBasicMaterial', 'halo-forno', { color: new THREE.Color(0xff7a2a).multiplyScalar(0.9), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }, true),
      glow: MAT(kit, 'MeshStandardMaterial', 'viseira', { color: 0x3a1206, emissive: 0xff7426, emissiveIntensity: 2.6, roughness: 0.35 }, true),
      forno: MAT(kit, 'MeshStandardMaterial', 'forno', { color: 0x1a0600, emissive: 0xff7a1c, emissiveIntensity: 3.6, roughness: 0.6 }, true),
      ember: MAT(kit, 'MeshStandardMaterial', 'brasa', { color: 0x2a0c00, emissive: 0xffa040, emissiveIntensity: 2.8 }, true),
      eye: MAT(kit, 'MeshPhysicalMaterial', 'olho', { map: et.map, emissiveMap: et.emi, emissive: 0xffffff, emissiveIntensity: 1.5, roughness: 0.32, clearcoat: 0, envMapIntensity: 0.8 }, true),
      cornea: MAT(kit, 'MeshPhysicalMaterial', 'cornea', { color: 0x000000, roughness: 0.05, metalness: 0, specularIntensity: 1, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, envMapIntensity: 2.2 }) /* 4.3e: só o reflexo molhado (aditivo): a córnea translúcida comum velava o olho de branco */ }; });
  const ST = kit.g('st', () => { const r = rng(11);
    const E = [{ c: [-0.33, 0.085, 0.735], re: 0.142, f: nrm([-0.17, 0.02, 1]) }, { c: [0.335, 0.085, 0.728], re: 0.156, f: nrm([0.17, 0.02, 1]) }]; for (const e of E) { e.rl = e.re * 1.13; e.dark = 1.3; }
    const R = (dx, dy, dz) => { const r0 = 1 / Math.sqrt((dx / 0.93) ** 2 + (dy / 1.0) ** 2 + (dz / 0.92) ** 2); const x = dx * r0, y = dy * r0, z = dz * r0, ax = Math.abs(x);
      const hollow = G3(ax, y, z, 0.45, -0.3, 0.68, 0.11, 0.14, 0.2), temple = G3(ax, y, z, 0.76, 0.2, 0.32, 0.17, 0.2, 0.3), furrow = G3(x, y, z, 0, 0.255, 0.95, 0.035, 0.06, 0.12);
      const ridge = G3(x, y, z, 0, 0.3, 0.84, 0.46, 0.065, 0.25), nose = G3(x, y, z, 0, -0.14, 0.92, 0.11, 0.1, 0.18), cheek = G3(ax, y, z, 0.48, -0.06, 0.68, 0.15, 0.09, 0.22), bag = G3(ax, y, z, 0.33, -0.1, 0.84, 0.12, 0.035, 0.2);
      const jawc = G3(ax, y, z, 0.6, -0.62, 0.3, 0.16, 0.14, 0.4), side = G3(ax, y, z, 0.72, -0.32, 0.2, 0.1, 0.3, 0.4);
      const d = 0.14 * jawc - 0.045 * side + 0.12 * G3(x, y, z, 0, -0.86, 0.5, 0.25, 0.12, 0.3) + 0.18 * ridge - 0.035 * furrow + 0.14 * G3(x, y, z, 0, 0.06, 0.9, 0.065, 0.15, 0.2) + 0.32 * nose + 0.1 * G3(ax, y, z, 0.13, -0.19, 0.83, 0.065, 0.055, 0.15)
        + 0.11 * cheek + 0.035 * bag - 0.07 * hollow - 0.085 * temple - 0.08 * G3(x, y, z, 0, -1.02, 0, 0.55, 0.2, 0.5);
      CAV = -hollow * 0.7 - temple * 0.5 - furrow * 0.9 - side * 0.3 + (nose + cheek + ridge) * 0.16; return r0 + d; };
    const hg = sculpt(R, 0, 0, 0, kit.seg(84), kit.seg(64), sockFn(E)); const at = hg.userData.at, cav = hg.userData.cav; prep(hg);
    paint(hg, (x, y, z, nx, ny, nz, i) => { let k = 1 + clamp(cav[i], -0.75, 0.25) * 1.25; k *= 1 - 0.5 * sstep(0.2, 0.42, y) - 0.3 * G3(Math.abs(x), y, z, 0.33, 0.09, 0.8, 0.2, 0.14, 0.3); k *= lerp(0.5, 1, sstep(-0.45, 0.55, nz));
      const wr = y > 0.33 && y < 0.5 ? 1 - 0.25 * Math.pow(Math.max(0, Math.sin((y - 0.33) * 75)), 6) : 1;
      const fl = G3(x, y, z, 0, -0.15, 0.98, 0.13, 0.12, 0.2) + 0.8 * G3(Math.abs(x), y, z, 0.44, -0.16, 0.75, 0.15, 0.12, 0.25); const st = sstep(-0.4, -0.62, y) * sstep(0.15, 0.4, Math.abs(x)) * 0.42;
      const nst = G3(Math.abs(x), y, z, 0.075, -0.215, 0.9, 0.028, 0.02, 0.1); const sd = Math.abs((x + 0.43) * 0.83 - (y + 0.12) * 0.55); const sc = x < -0.25 && x > -0.62 && y < 0.02 && y > -0.36 ? 1 - sstep(0.008, 0.024, sd) : 0; const n = 0.92 + 0.16 * fbm(x * 11, y * 11, z * 11, 3);
      const nk2 = 1 - 0.8 * nst; return [k * wr * n * nk2 * (1 + fl * 0.3 + sc * 0.25) * (1 - st), k * wr * n * nk2 * (1 - fl * 0.08 + sc * 0.04) * (1 - st), k * wr * n * nk2 * (1 - fl * 0.14 + sc * 0.04) * (1 - st * 0.7)]; });
    ao(hg, [[0, 0.6, 0.76, 0.34], [0.6, 0.54, 0.54, 0.32], [-0.6, 0.54, 0.54, 0.32], [0.95, 0.3, 0, 0.3], [-0.95, 0.3, 0, 0.3], [0, -0.52, 0.72, 0.27], [0.97, -0.02, -0.02, 0.24], [-0.97, -0.02, -0.02, 0.24], [0, 0.42, 0.95, 0.12]], 1.1);
    const hb = new Bag(); hb.add(M.skin, hg);
    /* capacete: cúpula + faixa + aba larga rebitada + crista + viseira acesa num rasgo */
    const HT = trf([0, 0.30, -0.02], [-0.10, 0, 0], [1, 1, 0.95]); const grime = (lo, hi) => (x, y, z) => lerp(lo, hi, sstep(0.2, 1.3, y)) * (0.9 + 0.2 * fbm(x * 5, y * 5, z * 5, 3));
    const dome = lathe([[1.075, 0], [1.1, 0.03], [1.1, 0.13], [1.06, 0.165], [1.045, 0.3], [1.0, 0.5], [0.9, 0.72], [0.72, 0.92], [0.48, 1.05], [0.24, 1.11], [0.001, 1.13]], kit.seg(60)); HT.g(dome); hb.add(M.dark, dome); paint(dome, (x, y, z) => lerp(0.55, 1.25, sstep(0.3, 1.25, y)) * (0.85 + 0.3 * fbm(x * 5, y * 5, z * 5, 3)) * (Math.abs(x) < 0.16 && z > 0 ? 1.15 : 1));
    const brim = lathe([[1.06, 0.0], [1.29, -0.012], [1.318, -0.036], [1.29, -0.062], [1.06, -0.052], [1.06, 0.0]], kit.seg(60)); HT.g(brim); hb.add(M.dark, brim); paint(brim, (x, y, z, nx, ny) => ny > 0.3 ? 1 : 0.55);
    rivetsOn(hb, M.brass, HT.pts(lathePts(1.205, -0.004, 22).map(s => (s.n = [0, 1, 0], s))), 0.026);
    rivetsOn(hb, M.steel, HT.pts(lathePts(1.104, 0.075, 18, 1.15, 4.0)), 0.02, 0.9);
    const crest = sweep([[0, 0.17, 1.062], [0, 0.6, 0.98], [0, 1.0, 0.62], [0, 1.15, 0.0], [0, 1.0, -0.62], [0, 0.6, -0.98], [0, 0.17, -1.062]], { n: kit.seg(40), m: 8, up: t => [0, Math.sin(t * Math.PI), Math.cos(t * Math.PI)], r: [0.13, 0.03] }); HT.g(crest); hb.add(M.dark, crest);
    rivetsOn(hb, M.brass, HT.pts([0.22, 0.38, 0.62, 0.8].map(t => { const a = t * Math.PI; return { p: [0, 0.17 + Math.sin(a) * 0.98 + 0.045, Math.cos(a) * 1.062], n: [0, Math.sin(a), Math.cos(a)] }; })), 0.022);
    for (const [y0, y1] of [[0.028, 0.044], [0.092, 0.108]]) { const lip = lathe([[1.098, y0], [1.122, y0], [1.122, y1], [1.098, y1], [1.098, y0]], kit.seg(40), -1.02, 2.04); HT.g(lip); hb.add(M.dark, lip); }
    const vis = lathe([[1.108, 0.044], [1.112, 0.068], [1.108, 0.092]], kit.seg(40), -0.98, 1.96); HT.g(vis); hb.add(M.glow, vis);
    /* protetores de orelha com respiro */
    for (const s of [-1, 1]) { const ear = lathe([[0.001, 0.075], [0.17, 0.08], [0.22, 0.065], [0.245, 0.0], [0.24, -0.06], [0.2, -0.075]], kit.seg(28)); xf(ear, [s * 0.95, -0.02, -0.03], [0, 0, -s * Math.PI / 2], [0.85, 1, 0.85]); hb.add(M.dark, ear);
      for (let k = -1; k <= 1; k++) { const v = BOX(0.03, 0.02, 0.17); xf(v, [s * 1.02, -0.02 + k * 0.05, -0.03]); hb.add(M.rubber, v, 0.4); }
      const er = TOR(0.2, 0.018, 8, kit.seg(28)); xf(er, [s * 0.96, -0.02, -0.03], [0, Math.PI / 2, 0]); hb.add(M.dark, er); }
    /* placa na bochecha (lado direito da tela) com rebites e um cabo até o protetor */
    const pl = plate(at, 0.565, -0.2, 0.165, 0.125, 5, 0.012, 0.035, 4, kit.seg(30)); hb.add(M.steel, pl); paint(pl, (x, y) => 0.85 + 0.25 * sstep(-0.3, -0.1, y));
    rivetsOn(hb, M.brass, ringPts(at, 0.565, -0.2, 0.165, 0.125, 5, 0.78, 6, 0.045), 0.02);
    hb.add(M.rubber, sweep([[0.71, -0.13, 0.5], [0.82, -0.1, 0.36], [0.92, -0.07, 0.16], [0.97, -0.04, 0.05]], { n: 14, m: 6, r: [0.028, 0.028], up: [0, 1, 0] }));
    /* monóculo de latão em volta do olho maior */
    { const e = E[1]; const ring = TOR(e.re * 1.24, 0.026, 10, kit.seg(32)); xf(ring, [e.c[0] + e.f[0] * e.re * 0.5, e.c[1] + e.f[1] * e.re * 0.5, e.c[2] + e.f[2] * e.re * 0.5], new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(...e.f))); hb.add(M.brass, ring);
      for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 4; const sc = SPH(0.014, 6, 4); xf(sc, [e.c[0] + Math.cos(a) * e.re * 1.24, e.c[1] + Math.sin(a) * e.re * 1.24, e.c[2] + e.re * 0.62]); hb.add(M.dark, sc); } }
    /* respirador: focinho de aço com grade de barras; filtros nos lados e mangueiras corrugadas até o peito */
    const Rm = (dx, dy, dz) => 1 / Math.pow(Math.pow(Math.abs(dx) / 0.37, 3.2) + Math.pow(Math.abs(dy) / 0.265, 3.2) + Math.pow(Math.abs(dz) / 0.56, 3.2), 1 / 3.2);
    const mk = sculpt(Rm, 0, -0.52, 0.40, kit.seg(40), kit.seg(30)); const maskAt = mk.userData.at; prep(mk); paint(mk, (x, y, z, nx, ny, nz) => lerp(0.5, 1.05, sstep(-0.3, 0.6, nz)) * lerp(0.75, 1, sstep(-0.78, -0.4, y))); hb.add(M.dark, mk);
    for (let k = -3; k <= 3; k++) { const x = k * 0.062; const pts = []; for (let j = 0; j <= 5; j++) { const s2 = maskAt(x, -0.36 - j * 0.066); if (s2) pts.push([s2.p[0] + s2.n[0] * 0.012, s2.p[1] + s2.n[1] * 0.012, s2.p[2] + s2.n[2] * 0.012]); } if (pts.length > 2) hb.add(M.steel, sweep(pts, { n: 10, m: 6, r: [0.0095, 0.012], up: [0, 0, 1] }), 0.85); }
    const frame = []; for (let j = 0; j <= 24; j++) { const a = j / 24 * Math.PI * 2, x = Math.sign(Math.cos(a)) * Math.pow(Math.abs(Math.cos(a)), 0.5) * 0.245, y = -0.53 + Math.sign(Math.sin(a)) * Math.pow(Math.abs(Math.sin(a)), 0.5) * 0.18; const s2 = maskAt(x, y); if (s2) frame.push([s2.p[0] + s2.n[0] * 0.01, s2.p[1] + s2.n[1] * 0.01, s2.p[2] + s2.n[2] * 0.01]); }
    hb.add(M.steel, sweep(frame, { n: 48, m: 6, r: [0.02, 0.018], up: [0, 0, 1], closed: true }));
    for (const s of [-1, 1]) { const pts = []; for (const [x, y, rr] of [[0.02, -0.235, 0], [0.12, -0.255, 0], [0.24, -0.29, 0], [0.36, -0.36, 0], [0.45, -0.47, 0], [0.48, -0.58, 0]]) { const a = at(s * x, y), b = maskAt(s * x, y); const zf = a ? a.p[2] + 0.045 : 0.9, zm = b ? b.p[2] + 0.035 : -9; pts.push([s * x, y, Math.max(zf, zm)]); }
      const mu = sweep(pts, { n: 24, m: 10, up: [0, 0.3, 1], r: t => { const tuft = 1 + 0.18 * Math.sin(t * 31) * Math.sin(t * 13); return [0.095 * (1 - t * 0.8) * (0.72 + 0.28 * Math.sin(Math.min(1, t * 3) * Math.PI / 2)) * tuft, 0.055 * (1 - t * 0.65) * tuft]; }, smooth: true }); hb.add(M.hair, mu); paint(mu, (x2, y2) => lerp(0.75, 1.35, sstep(-0.3, -0.55, y2)) * (0.85 + 0.3 * fbm(x2 * 40, y2 * 40, 1, 2))); }
    for (const s of [-1, 1]) { const can = lathe([[0.001, 0.1], [0.08, 0.1], [0.1, 0.085], [0.106, 0.06], [0.094, 0.05], [0.106, 0.035], [0.094, 0.02], [0.106, 0.005], [0.094, -0.01], [0.106, -0.025], [0.1, -0.07], [0.07, -0.09], [0.001, -0.09]], kit.seg(20)); xf(can, [s * 0.39, -0.61, 0.69], qUp([s * 0.78, -0.12, 0.62])); hb.add(M.dark, can);
      const cap = CYL(0.07, 0.07, 0.02, kit.seg(16)); xf(cap, [s * (0.39 + 0.78 * 0.1), -0.61 - 0.012, 0.69 + 0.62 * 0.1], qUp([s * 0.78, -0.12, 0.62])); hb.add(M.brass, cap);
      const hose = [[s * 0.35, -0.7, 0.62], [s * 0.4, -0.92, 0.55], [s * 0.47, -1.16, 0.6], [s * 0.47, -1.42, 0.72]]; hb.add(M.rubber, sweep(hose, { n: kit.seg(40), m: 8, up: [1, 0, 0], r: t => { const k = 0.045 * (1 + 0.2 * Math.max(0, Math.sin(t * Math.PI * 2 * 13))); return [k, k]; } })); }
    const headList = hb.list();
    /* corpo: ombros maciços que sobem até o queixo, gola alta rebitada, couraça de barril, porta da fornalha no peito, ombreiras fechadas com borda de latão, chaminés */
    const bb = new Bag(); const wear = (lo, hi, y0, y1, f) => (x, y, z) => lerp(lo, hi, sstep(y0, y1, y)) * (0.86 + 0.28 * fbm(x * (f || 4), y * (f || 4), z * (f || 4), 3));
    const nk = lathe([[0.42, -0.45], [0.47, -0.7], [0.55, -0.95], [0.62, -1.1]], kit.seg(32)); xf(nk, [0, 0, -0.1]); bb.add(M.skin, nk); paint(nk, (x, y, z, nx, ny, nz) => lerp(0.3, 0.7, sstep(-0.95, -0.55, y)));
    const Rt = (dx, dy, dz) => 1 / Math.pow(Math.pow(Math.abs(dx) / 1.42, 2.4) + Math.pow(Math.abs(dy) / 1.05, 2.4) + Math.pow(Math.abs(dz) / 0.78, 2.4), 1 / 2.4);
    const to = sculpt(Rt, 0, -1.95, -0.2, kit.seg(48), kit.seg(34)); prep(to); bb.add(M.dark, to);
    paint(to, (x, y, z, nx, ny, nz) => { const band = Math.abs(((y + 3) % 0.34) - 0.17) < 0.011 ? 0.5 : 1; const seam = Math.abs(x) < 0.018 ? 0.55 : 1; return band * seam * lerp(0.4, 1.05, sstep(-2.5, -1.1, y)) * (0.86 + 0.28 * fbm(x * 4, y * 4, z * 4, 3)); });
    const col = lathe([[0.6, -0.6], [0.66, -0.6], [0.72, -0.66], [0.8, -0.8], [0.9, -0.98], [1.02, -1.12], [0.6, -1.15]], kit.seg(48)); xf(col, [0, 0, -0.12], null, [1, 1, 0.92]); bb.add(M.steel, col); paint(col, wear(0.55, 1.05, -1.1, -0.65));
    const crim = TOR(0.64, 0.045, 10, kit.seg(48)); crim.rotateX(Math.PI / 2); xf(crim, [0, -0.6, -0.12], null, [1, 1, 0.92]); bb.add(M.brass, crim);
    rivetsOn(bb, M.brass, lathePts(0.8, -0.8, 14).map(q => { q.p[2] = q.p[2] * 0.92 - 0.12; q.n = nrm([q.n[0], 0.5, q.n[2]]); return q; }), 0.022);
    { const toAt = to.userData.at; const cp = plate(toAt, 0, -1.5, 0.56, 0.36, 4, 0.02, 0.05, 4, kit.seg(32)); bb.add(M.steel, cp); paint(cp, (x, y, z) => lerp(0.6, 1.1, sstep(-1.85, -1.2, y)) * (0.85 + 0.3 * fbm(x * 5, y * 5, z * 5, 3))); rivetsOn(bb, M.brass, ringPts(toAt, 0, -1.5, 0.56, 0.36, 4, 0.86, 14, 0.07), 0.026); }
    { const pr = TOR(0.17, 0.036, 10, kit.seg(32)); const nP = nrm([0, 0.38, 1]); xf(pr, [0, -1.42, 0.6], new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(...nP))); bb.add(M.brass, pr);
      const core = SPH(0.16, kit.seg(20), 10, 0, Math.PI * 2, 0, Math.PI / 2); xf(core, [0, -1.42, 0.58], qUp(nP), [1, 0.4, 1]); bb.add(M.forno, core);
      rivetsOn(bb, M.steel, lathePts(0.235, 0, 8).map(q => { const qq = qUp(nP); const v = new THREE.Vector3(...q.p).applyQuaternion(qq); return { p: [v.x, v.y - 1.42, v.z + 0.6], n: nP }; }), 0.02); }
    for (const s of [-1, 1]) { const Rp = (dx, dy, dz) => 1 / Math.pow(Math.pow(Math.abs(dx) / 0.66, 2.3) + Math.pow(Math.abs(dy) / 0.42, 2.3) + Math.pow(Math.abs(dz) / 0.64, 2.3), 1 / 2.3);
      const pd = sculpt((dx, dy, dz) => Rp(dx, dy, dz) + 0.05 * Math.exp(-((dz / 0.12) ** 2)) * Math.max(0, dy), 0, 0, 0, kit.seg(36), kit.seg(26)); prep(pd); const PT = trf([s * 1.22, -0.98, -0.12], [0, 0, -s * 0.36], 1); PT.g(pd); bb.add(M.steel, pd); paint(pd, (x, y, z) => { const band = Math.abs(y + 0.86) < 0.018 || Math.abs(y + 0.72) < 0.014 ? 0.45 : 1; return band * lerp(0.42, 1.1, sstep(-1.3, -0.62, y)) * (0.84 + 0.32 * fbm(x * 4, y * 4, z * 4, 3)); });
      const lame = SPH(1, kit.seg(32), 12); lame.scale(0.7, 0.2, 0.68); xf(lame, [s * 1.36, -1.3, -0.12], [0, 0, -s * 0.5]); bb.add(M.dark, lame); paint(lame, wear(0.4, 0.9, -1.45, -1.15));
      const tr = TOR(0.62, 0.045, 8, kit.seg(44)); tr.rotateX(Math.PI / 2); tr.scale(1.03, 1, 0.99); PT.g(tr); bb.add(M.brass, tr);
      rivetsOn(bb, M.brass, PT.pts(lathePts(0.5, 0.25, 9, -1.9, 3.8).map(q => (q.n = nrm([q.n[0] * 0.5, 1, q.n[2] * 0.5]), q))), 0.032);
      const ch = lathe([[0.15, -1.1], [0.13, -0.85], [0.125, -0.05], [0.145, 0.05], [0.17, 0.15], [0.158, 0.19], [0.125, 0.18], [0.105, 0.08]], kit.seg(24)); xf(ch, [s * 1.3, 0, -0.5], [0, 0, -s * 0.07]); bb.add(M.steel, ch);
      paint(ch, (x, y) => y > 0.02 ? lerp(0.22, 0.6, sstep(0.18, 0.02, y)) : lerp(0.6, 1, sstep(-0.9, -0.2, y)));
      for (const yb of [-0.62, -0.25]) { const band = TOR(0.136, 0.024, 6, kit.seg(20)); band.rotateX(Math.PI / 2); xf(band, [s * (1.3 + 0.07 * yb), yb, -0.5], [0, 0, -s * 0.07]); bb.add(M.brass, band); } }
    const bodyList = bb.list(); return { E, at, maskAt, headList, bodyList }; });
  /* ---- montagem por humor ---- */
  const hm = inst(H, ST.headList, 'cabeca'); inst(Bd, ST.bodyList, 'corpo'); rig.glow = hm.find(m => m.material === M.glow) || null;
  ST.E.forEach((e, i) => { const side = i ? 1 : -1; eyeRig(kit, rig, H, { c: e.c, f: e.f, re: e.re, rl: e.rl, mat: M.eye, cornea: M.cornea, lidMat: M.skin, look: X.look, edges: lidEdges(X, side, { cant: 0.08 }), lid: { crease: 0.05 } }); });
  for (const side of [-1, 1]) browRig(kit, rig, H, ST.at, { side, x0: 0.1, x1: 0.57, y: 0.295, arch: X.arch * 0.5, dy: X.browY + (side > 0 && mood === 1 ? 0.025 : 0), ang: side * X.brow * 0.8, h0: 0.088, h1: 0.058, th: 0.05, off: 0.036, mat: M.hair });
  /* a "boca": o fogo atrás da grade desenha o humor */
  const VS = { 1: { cl: 0.035, cr: 0.035, up: 0.03, lo: 0.03 }, 2: { cl: -0.06, cr: -0.06, up: 0.105, lo: 0.1 }, 3: { cl: 0.085, cr: 0.085, up: 0.03, lo: 0.13 }, 4: { cl: -0.075, cr: -0.075, up: 0.028, lo: 0.03 } }[mood];
  const c0 = ST.maskAt(0, -0.53).p; const mg = new THREE.Group(); mg.position.set(c0[0], c0[1], c0[2]); H.add(mg); mg.add(new THREE.Mesh(prep(ribbon(ST.maskAt, 0.215, -0.53, VS, 0.004, 15, c0)), M.forno)); mg.add(new THREE.Mesh(prep(ribbon(ST.maskAt, 0.25, -0.53, { cl: VS.cl, cr: VS.cr, up: VS.up * 1.7 + 0.02, lo: VS.lo * 1.7 + 0.02 }, 0.03, 15, c0)), M.halo)); rig.mouth = mg; rig.talkGlow = M.forno;
  /* brasas nas chaminés + faíscas subindo */
  rig.embers = []; for (const s of [-1, 1]) { const em = new THREE.Mesh(kit.g('brasa', () => SPH(0.095, 12, 8)), M.ember); em.position.set(s * (1.3 + 0.07 * 0.12), 0.12, -0.5); Bd.add(em); rig.embers.push(em); }
  const au = glowPts(kit, [[-0.36, 0.41, 0.97, 0.28], [0, 0.43, 1.03, 0.32], [0.36, 0.41, 0.97, 0.28], [0, -0.53, 1.04, mood === 2 ? 0.55 : 0.32], [-0.33, 0.085, 0.9, 0.2], [0.34, 0.085, 0.92, 0.22]], 0xff7a2a, 0.5); H.add(au); const au2 = glowPts(kit, [[0, -1.42, 0.72, 0.4], [-1.31, 0.18, -0.4, 0.5], [1.31, 0.18, -0.4, 0.5]], 0xff7a2a, 0.62); Bd.add(au2); rig.auras = [au, au2];
  const sp = particles(kit, 26, 0xffa24a, 0.055); sp.userData.src = [[-1.31, 0.17, -0.5], [1.31, 0.17, -0.5]]; sp.userData.h = 0.9; sp.userData.kind = 'fagulha'; Bd.add(sp); rig.sparks = [sp];
  return -0.72; };
/* ---------- Vesper Ísk (Erevane): cabeça alta e esguia de pele iridescente com linhas acesas, viseira de lente escura com a fenda teal
   (a fenda É o olhar: muda de forma com o humor), nadadeiras de membrana, gola alta aberta na frente, casaco escuro, faíscas de estática ---------- */
BUILD.erevane = function (kit, X, mood, H, Bd, rig) { const THREE = T(); const CY = 0.15;
  const M = kit.g('mats', () => ({
    skin: MAT(kit, 'MeshPhysicalMaterial', 'pele', { color: 0x1f4f6a, normalMap: detail(kit, 'escama', [10, 5], 1.2), normalScale: new THREE.Vector2(0.25, 0.25), roughness: 0.34, clearcoat: 0.6, clearcoatRoughness: 0.16, iridescence: 0.8, iridescenceIOR: 1.45, iridescenceThicknessRange: [180, 560], sheen: 0.35, sheenRoughness: 0.4, sheenColor: new THREE.Color(0x40ffd0), vertexColors: true, envMapIntensity: 0.95 }),
    skinD: MAT(kit, 'MeshPhysicalMaterial', 'pele-escura', { color: 0x0c1c26, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.12, vertexColors: true, envMapIntensity: 0.9 }),
    glass: MAT(kit, 'MeshPhysicalMaterial', 'lente', { color: 0x050c12, metalness: 0.35, roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.02, vertexColors: true, envMapIntensity: 1.6 }),
    metal: MAT(kit, 'MeshStandardMaterial', 'metal', { color: 0x3e6070, metalness: 0.9, roughness: 0.32, vertexColors: true, envMapIntensity: 0.85 }),
    cloth: MAT(kit, 'MeshPhysicalMaterial', 'casaco', { color: 0x16242e, roughness: 0.78, sheen: 1, sheenRoughness: 0.42, sheenColor: new THREE.Color(0x3f7f8c), vertexColors: true, envMapIntensity: 0.4 }),
    memb: MAT(kit, 'MeshPhysicalMaterial', 'membrana', { color: 0x2a8a90, roughness: 0.25, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false, emissive: 0x33ffd0, emissiveIntensity: 0.55, envMapIntensity: 1.0 }, true),
    brow: MAT(kit, 'MeshPhysicalMaterial', 'crista', { color: 0x7fd0dc, metalness: 0.5, roughness: 0.28, clearcoat: 1, emissive: 0x33ffd0, emissiveIntensity: 0.25, vertexColors: true, envMapIntensity: 1.0 }, true),
    line: MAT(kit, 'MeshBasicMaterial', 'linha', { color: new THREE.Color(0x33ffd0).multiplyScalar(1.5), toneMapped: false }, true),
    slit: MAT(kit, 'MeshBasicMaterial', 'fenda', { color: new THREE.Color(0x33ffd0).multiplyScalar(2.6), toneMapped: false }, true),
    pupil: MAT(kit, 'MeshBasicMaterial', 'pupila', { color: new THREE.Color(0xe8fff8).multiplyScalar(3), toneMapped: false }, true),
    halo: MAT(kit, 'MeshBasicMaterial', 'halo', { color: new THREE.Color(0x33ffd0).multiplyScalar(0.9), transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }, true),
    gem: MAT(kit, 'MeshStandardMaterial', 'gema', { color: 0x06302a, emissive: 0x33ffd0, emissiveIntensity: 2.2, roughness: 0.2, metalness: 0.2 }, true),
    tooth: MAT(kit, 'MeshPhysicalMaterial', 'dente', { color: 0xdff4f0, roughness: 0.3, clearcoat: 0.6, envMapIntensity: 0.6 }),
    inside: MAT(kit, 'MeshStandardMaterial', 'boca', { color: 0x04090c, roughness: 0.7, vertexColors: true }) }));
  const ST = kit.g('st', () => {
    const R = (dx, dy, dz) => { const r0 = 1 / Math.sqrt((dx / 0.8) ** 2 + (dy / 1.2) ** 2 + (dz / 0.88) ** 2); const x = dx * r0, y = dy * r0, z = dz * r0, ax = Math.abs(x);
      const back = G3(x, y, z, 0, 0.72, -0.55, 0.36, 0.5, 0.42), jaw = G3(ax, y, z, 0.6, -0.62, 0.15, 0.28, 0.34, 0.42), chin = G3(x, y, z, 0, -1.12, 0.4, 0.12, 0.12, 0.3), cheek = G3(ax, y, z, 0.5, -0.27, 0.56, 0.13, 0.08, 0.2);
      const hollow = G3(ax, y, z, 0.42, -0.5, 0.58, 0.12, 0.13, 0.2), ridge = G3(x, y, z, 0, 0.27, 0.78, 0.42, 0.07, 0.25), nose = G3(x, y, z, 0, -0.3, 0.86, 0.05, 0.12, 0.2), crest = G3(x, y, z, 0, 0.95, 0.05, 0.065, 0.6, 0.9), vis = G3(x, y, z, 0, 0.05, 0.85, 0.5, 0.12, 0.3);
      CAV = -hollow * 0.6 + cheek * 0.2 + ridge * 0.1; return r0 + 0.32 * back - 0.14 * jaw + 0.08 * chin + 0.14 * cheek - 0.11 * hollow + 0.06 * ridge + 0.07 * nose + 0.05 * crest - 0.04 * vis; };
    const hg = sculpt(R, 0, CY, 0, kit.seg(80), kit.seg(64)); const at = hg.userData.at, pt = hg.userData.pt, cav = hg.userData.cav; prep(hg);
    paint(hg, (x, y, z, nx, ny, nz, i) => { const k = (1 + clamp(cav[i], -0.7, 0.3) * 1.1) * lerp(0.45, 1.08, sstep(-0.9, 0.9, y)) * lerp(0.6, 1, sstep(-0.5, 0.5, nz)); const n = 0.9 + 0.2 * fbm(x * 6, y * 6, z * 6, 3); return [k * n * 0.95, k * n, k * n * 1.04]; });
    ao(hg, [[0, 0.2, 0.86, 0.2], [0, -1.15, -0.1, 0.5]], 0.8); const hb = new Bag(); hb.add(M.skin, hg);
    /* linhas acesas sobre o crânio e marcas de "lágrima" sob a viseira */
    const line = (dirs, n, w) => { const pts = []; for (let i = 0; i <= n; i++) { const t = i / n, f = t * (dirs.length - 1), k = Math.min(dirs.length - 2, Math.floor(f)), u = f - k; const a = dirs[k], b = dirs[k + 1]; const s2 = pt(lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)); pts.push([s2.p[0] + s2.n[0] * 0.004, s2.p[1] + s2.n[1] * 0.004, s2.p[2] + s2.n[2] * 0.004]); }
      hb.add(M.line, sweep(pts, { n: n * 2, m: 5, up: [0, 1, 0], r: t => { const k = Math.sin(Math.min(1, t * 1.05) * Math.PI) * 0.7 + 0.3; return [w * k, w * k]; } })); };
    line([[0, 0.35, 0.94], [0, 0.8, 0.6], [0, 1, 0.05], [0, 0.7, -0.7]], 20, 0.011);
    for (const s of [-1, 1]) { line([[s * 0.42, 0.42, 0.8], [s * 0.6, 0.75, 0.3], [s * 0.5, 0.75, -0.35], [s * 0.35, 0.45, -0.85]], 20, 0.009); line([[s * 0.36, -0.1, 0.92], [s * 0.42, -0.3, 0.86], [s * 0.45, -0.48, 0.78]], 8, 0.008); }
    /* viseira: lente escura que abraça o rosto, com moldura de metal */
    const vy = 0.2, va = 0.64, vb = 0.135; const vis = plate(at, 0, vy, va, vb, 6, 0.05, 0.05, 5, kit.seg(40)); hb.add(M.glass, vis); paint(vis, (x, y) => lerp(0.7, 1.25, sstep(vy - vb, vy + vb, y)));
    const fr = ringPts(at, 0, vy, va, vb, 6, 1.0, 44, 0.06).map(q => q.p); hb.add(M.metal, sweep(fr, { n: 88, m: 6, r: [0.02, 0.016], up: [0, 0, 1], closed: true }));
    /* nadadeiras: costelas e membrana */
    const finG = []; for (const s of [-1, 1]) { const root = [s * 0.72, 0.28, -0.2]; const tips = [[s * 1.02, 1.12, -0.7], [s * 1.28, 0.7, -0.9], [s * 1.32, 0.26, -0.95], [s * 1.08, -0.18, -0.7]]; const ribs = tips.map(tp => { const mid = [lerp(root[0], tp[0], 0.5) + s * 0.1, lerp(root[1], tp[1], 0.5), lerp(root[2], tp[2], 0.5) + 0.08]; return new THREE.CatmullRomCurve3([root, mid, tp].map(p => new THREE.Vector3(p[0] - root[0], p[1] - root[1], p[2] - root[2]))); });
      const fb = new Bag(); for (const c of ribs) { const pts = []; for (let i = 0; i <= 10; i++) { const v = c.getPoint(i / 10); pts.push([v.x, v.y, v.z]); } fb.add(M.brow, sweep(pts, { n: 14, m: 6, up: [s, 0, 0], r: t => [0.026 * (1 - t * 0.8), 0.018 * (1 - t * 0.8)], smooth: true })); }
      const P = [], I = []; const NS = 10; for (let k = 0; k < ribs.length - 1; k++) { const b0 = P.length / 3; for (let i = 0; i <= NS; i++) { const a = ribs[k].getPoint(i / NS), b = ribs[k + 1].getPoint(i / NS); const sag = Math.sin(i / NS * Math.PI) * 0.06; P.push(a.x, a.y, a.z, (a.x + b.x) / 2 - s * sag * 0.3, (a.y + b.y) / 2, (a.z + b.z) / 2 + sag * 0.2, b.x, b.y, b.z); }
        for (let i = 0; i < NS; i++) for (let j = 0; j < 2; j++) { const a = b0 + i * 3 + j, b = a + 3; I.push(a, b, a + 1, a + 1, b, b + 1); } }
      const mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); mg.setIndex(I); mg.computeVertexNormals(); fb.add(M.memb, mg); finG.push({ s, root, list: fb.list() }); }
    /* crista: barbatana fina no alto da cabeça, varrida para trás, com filete aceso na borda */
    { const P = [], I = [], NS = 14, edge = []; for (let i = 0; i <= NS; i++) { const t = i / NS, a = lerp(0.35, 2.55, t); const s2 = pt(0, Math.sin(a), Math.cos(a)); const h = 0.05 + 0.22 * Math.sin(t * Math.PI * 0.85) * (1 - t * 0.25); const top = [s2.p[0], s2.p[1] + s2.n[1] * h, s2.p[2] + s2.n[2] * h + (t > 0.5 ? -(t - 0.5) * 0.25 : 0)]; P.push(s2.p[0], s2.p[1] - s2.n[1] * 0.02, s2.p[2] - s2.n[2] * 0.02, ...top); edge.push(top); }
      for (let i = 0; i < NS; i++) { const a = i * 2; I.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); } const cg = new THREE.BufferGeometry(); cg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); cg.setIndex(I); cg.computeVertexNormals(); hb.add(M.memb, cg); hb.add(M.line, sweep(edge, { n: 28, m: 5, r: [0.008, 0.008], up: [1, 0, 0] })); }
    const headList = hb.list();
    /* corpo: pescoço longo, gola alta aberta em V com filete aceso, casaco, ombreiras afiadas, gema no peito */
    const bb = new Bag(); const nk = lathe([[0.3, -0.55], [0.33, -0.85], [0.38, -1.1], [0.48, -1.3]], kit.seg(28)); xf(nk, [0, 0, -0.06]); bb.add(M.skin, nk); paint(nk, (x, y) => lerp(0.35, 0.8, sstep(-1.2, -0.6, y)));
    const cl = lathe([[0.52, -1.25], [0.6, -1.0], [0.72, -0.6], [0.82, -0.26], [0.85, -0.18], [0.79, -0.21], [0.68, -0.58], [0.56, -0.95], [0.49, -1.2]], kit.seg(48), 0.7, Math.PI * 2 - 1.4); xf(cl, [0, 0, -0.08]); bb.add(M.metal, cl); paint(cl, (x, y) => lerp(0.45, 1.05, sstep(-1.2, -0.4, y)));
    { const pts = []; for (let i = 0; i <= 40; i++) { const f = 0.7 + (Math.PI * 2 - 1.4) * i / 40; pts.push([Math.sin(f) * 0.86, -0.175, Math.cos(f) * 0.86 - 0.08]); } bb.add(M.line, sweep(pts, { n: 60, m: 5, r: [0.013, 0.013], up: [0, 1, 0] })); }
    for (const s of [-1, 1]) bb.add(M.line, sweep([[s * 0.5, -0.98, 0.42], [s * 0.3, -1.25, 0.5], [s * 0.04, -1.5, 0.48]], { n: 16, m: 5, r: [0.012, 0.012], up: [0, 0, 1] }));
    const Rt = (dx, dy, dz) => 1 / Math.pow(Math.pow(Math.abs(dx) / 1.2, 2.4) + Math.pow(Math.abs(dy) / 0.95, 2.4) + Math.pow(Math.abs(dz) / 0.62, 2.4), 1 / 2.4);
    const to = sculpt(Rt, 0, -1.9, -0.15, kit.seg(48), kit.seg(36)); prep(to); bb.add(M.cloth, to); paint(to, (x, y, z) => lerp(0.4, 1, sstep(-2.6, -1.2, y)) * (Math.abs(x) < 0.05 && y < -1.35 ? 0.5 : 1));
    for (const s of [-1, 1]) { [[0, 1], [-0.13, 0.86], [-0.25, 0.72]].forEach(([dy, sc], li) => { const Rs = (dx, dy2, dz) => 1 / Math.pow(Math.pow(Math.abs(dx) / 0.6, 5) + Math.pow(Math.abs(dy2) / 0.1, 3) + Math.pow(Math.abs(dz) / 0.5, 5), 1 / 4);
        const sp = sculpt(Rs, 0, 0, 0, kit.seg(28), kit.seg(12)); prep(sp); { const a = sp.getAttribute('position').array; for (let i = 0; i < a.length; i += 3) a[i + 1] += 0.18 * Math.max(0, 1 - Math.abs(a[i]) / 0.6) * (a[i + 2] > 0 ? 0.2 : 0) - 0.12 * (a[i] / 0.6) * (a[i] / 0.6); sp.computeVertexNormals(); }
        xf(sp, [s * (0.98 + li * 0.1), -1.12 + dy, -0.12], [0, 0, -s * 0.5], sc); bb.add(M.metal, sp); paint(sp, (x, y) => lerp(0.5, 1.15, sstep(-1.55, -0.95, y)));
        const edge = []; for (let i = 0; i <= 16; i++) { const a = -1.25 + 2.5 * i / 16; edge.push([0.6 * Math.sin(a), -0.02 - 0.12 * Math.sin(a) * Math.sin(a), 0.5 * Math.cos(a)]); } const eg = sweep(edge, { n: 24, m: 5, r: [0.009, 0.009], up: [0, 1, 0] }); xf(eg, [s * (0.98 + li * 0.1), -1.12 + dy, -0.12], [0, 0, -s * 0.5], sc); bb.add(M.line, eg); }); }
    return { at, pt, headList, bodyList: bb.list(), finG }; });
  const hm = inst(H, ST.headList, 'cabeca'); inst(Bd, ST.bodyList, 'corpo');
  /* fenda por humor: A (+ canto de dentro desce), C (+ arqueia para cima), espessura */
  const SL = { 1: [0.08, -0.25, 0.03], 2: [0.8, 0, 0.024], 3: [0.08, 0.95, 0.034], 4: [-0.62, 0.35, 0.04] }[mood]; const hit = {}; const haloB = new Bag();
  for (const s of [-1, 1]) { const pts = []; for (let k = 0; k <= 6; k++) { const u = k / 6, x = s * lerp(0.07, 0.43, u), y = 0.2 + SL[0] * (u - 0.5) * 0.3 + SL[1] * Math.sin(u * Math.PI) * 0.05 - SL[1] * 0.02; const q = ST.at(x, y, hit); pts.push(q ? [q.p[0] + q.n[0] * 0.058, q.p[1] + q.n[1] * 0.058, q.p[2] + q.n[2] * 0.058] : [x, y, 0.95]); }
    const c = pts[3].slice(); const rel = pts.map(p => [p[0] - c[0], p[1] - c[1], p[2] - c[2]]); const eg = new THREE.Group(); eg.position.set(c[0], c[1], c[2]); H.add(eg);
    eg.add(new THREE.Mesh(prep(sweep(rel, { n: 20, m: 6, up: [0, 0, 1], r: t => [SL[2] * (0.3 + 0.7 * Math.pow(Math.sin(t * Math.PI), 0.45)), 0.006] })), M.slit));
    haloB.add(M.halo, sweep(pts, { n: 16, m: 6, up: [0, 0, 1], r: t => [SL[2] * 3.2 * (0.35 + 0.65 * Math.sin(t * Math.PI)), 0.004] }));
    const pu = new THREE.Mesh(kit.g('pupila', () => { const g2 = SPH(0.026, 10, 8); g2.scale(1, 0.8, 0.4); return g2; }), M.pupil); pu.position.set(s * -0.02, 0, 0.008); eg.add(pu);
    eg.userData.r = 0.16; eg.userData.slide = pu; eg.userData.p0 = [pu.position.x, pu.position.y, pu.position.z]; eg.userData.lim = 0.11; rig.eyes.push(eg); }
  haloB.flush(H, 'halo');
  for (const side of [-1, 1]) browRig(kit, rig, H, ST.at, { side, x0: 0.08, x1: 0.52, y: 0.405, arch: X.arch * 0.5 + 0.05, dy: X.browY * 1.1, ang: side * X.brow * 1.0, h0: 0.055, h1: 0.03, th: 0.04, off: 0.03, mat: M.brow });
  const k6 = 0.62, msh = mouthShape({ 1: 'smirk', 2: 'snarl', 3: 'grin', 4: 'frown' }[mood]); for (const q of ['cl', 'cr', 'up', 'lo', 'skew']) msh[q] = (msh[q] || 0) * k6;
  mouthRig(kit, rig, H, ST.at, { w: 0.16, y: -0.47, shape: msh, lip: 0.022, skin: M.skinD, lipTint: 0x9fb6c0, inside: M.inside, tooth: M.tooth, teeth: { up: 8, lo: 6, size: 0.03 }, jawOpen: 0, upperK: 0.9, lowerK: 1.1 });
  rig.fins = []; for (const F of ST.finG) { const fg = new THREE.Group(); fg.position.set(F.root[0], F.root[1], F.root[2]); H.add(fg); inst(fg, F.list, 'nadadeira'); const ry = F.s * ({ 1: 0, 2: 0.32, 3: 0.14, 4: -0.26 }[mood]); fg.rotation.y = ry; fg.rotation.z = F.s * ({ 1: 0, 2: 0.12, 3: 0.06, 4: -0.14 }[mood]); fg.userData.ry = ry; fg.userData.side = F.s; rig.fins.push(fg); }
  const gm = new THREE.Mesh(kit.g('gema', () => { const g2 = new THREE.OctahedronGeometry(0.075, 0); g2.scale(0.8, 1.25, 0.6); return g2; }), M.gem); gm.position.set(0, -1.25, 0.42); Bd.add(gm); rig.glow = gm;
  const au = glowPts(kit, [[-0.24, 0.2, 1.0, 0.3], [0.24, 0.2, 1.0, 0.3], [0, -1.25, 0.55, 0.4]], 0x33ffd0, 0.5); H.add(au); rig.auras = [au];
  const sp = particles(kit, 18, 0x9ff8ff, 0.045); sp.userData.src = [[-1.05, 0.45, -0.55, 0.55], [1.05, 0.45, -0.55, 0.55], [0, -0.75, 0.25, 0.9]]; sp.userData.kind = 'faisca'; H.add(sp); rig.sparks = [sp];
  return -0.68; };
/* ---------- Sylva Oriel (Tessara): vilã de carne vegetal — sobrancelhas em V, olhos semicerrados amarelo-tóxicos de pupila em fenda, órbitas escuras,
   espinhos no lugar das bochechas, sorriso torto com presas, frondes com bulbos acesos, gola de folhas, saco de seiva âmbar aceso, armadura de casca ---------- */
BUILD.tessara = function (kit, X, mood, H, Bd, rig) { const THREE = T(); const CY = 0.05;
  const M = kit.g('mats', () => { const et = eyeTex(kit, { kind: 'toxico', sclera: 0xc9d08a, scleraEdge: 0x3e4a18, irisIn: 0xfff59a, irisMid: 0xd8e24a, irisOut: 0x5a6a0a, glowIn: 0xe8f048, glowMid: 0xb4d020, glowOut: 0x1a2600, limbus: 0x1a2408, slit: 0.9, iris: 1.22, seed: 5 });
    return { skin: MAT(kit, 'MeshPhysicalMaterial', 'pele', { color: 0x3f8f52, normalMap: detail(kit, 'folha', [5, 2.5], 1.6), normalScale: new THREE.Vector2(0.22, 0.22), roughness: 0.52, sheen: 0.7, sheenRoughness: 0.45, sheenColor: new THREE.Color(0xa8f080), clearcoat: 0.25, clearcoatRoughness: 0.4, vertexColors: true, envMapIntensity: 0.4 }),
      lip: MAT(kit, 'MeshPhysicalMaterial', 'labio', { color: 0x3a1838, roughness: 0.4, clearcoat: 0.6, clearcoatRoughness: 0.2, vertexColors: true, envMapIntensity: 0.5 }),
      dk: MAT(kit, 'MeshPhysicalMaterial', 'folha-escura', { color: 0x1c3a24, roughness: 0.55, clearcoat: 0.3, vertexColors: true, envMapIntensity: 0.5 }),
      leaf: MAT(kit, 'MeshPhysicalMaterial', 'folha', { color: 0x3f8a4c, roughness: 0.45, clearcoat: 0.4, clearcoatRoughness: 0.3, side: THREE.DoubleSide, vertexColors: true, envMapIntensity: 0.6 }),
      bark: MAT(kit, 'MeshStandardMaterial', 'casca', { color: 0x4a3828, normalMap: detail(kit, 'casca', [2, 1], 3), normalScale: new THREE.Vector2(0.7, 0.7), roughness: 0.85, vertexColors: true, envMapIntensity: 0.35 }),
      thorn: MAT(kit, 'MeshPhysicalMaterial', 'espinho', { color: 0xe8e2b8, roughness: 0.4, clearcoat: 0.5, vertexColors: true, envMapIntensity: 0.5 }),
      frond: MAT(kit, 'MeshPhysicalMaterial', 'fronde', { color: 0x163f26, roughness: 0.42, clearcoat: 0.4, clearcoatRoughness: 0.3, side: THREE.DoubleSide, emissive: 0xffffff, emissiveMap: veinTex(kit, 'ambar', [255, 170, 40]), emissiveIntensity: 2.4, vertexColors: true, envMapIntensity: 0.5 }, true),
      sap: MAT(kit, 'MeshPhysicalMaterial', 'seiva', { color: 0x7a4a08, emissive: 0xffa828, emissiveIntensity: 2.0, roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 0.8 }, true),
      eye: MAT(kit, 'MeshPhysicalMaterial', 'olho', { map: et.map, emissiveMap: et.emi, emissive: 0xffffff, emissiveIntensity: 1.1, roughness: 0.32, clearcoat: 0, envMapIntensity: 0.7 }, true),
      cornea: MAT(kit, 'MeshPhysicalMaterial', 'cornea', { color: 0x000000, roughness: 0.05, metalness: 0, specularIntensity: 1, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, envMapIntensity: 2.2 }) /* 4.3e: só o reflexo molhado (aditivo): a córnea translúcida comum velava o olho de branco */,
      tooth: MAT(kit, 'MeshPhysicalMaterial', 'dente', { color: 0xf0e8c8, roughness: 0.32, clearcoat: 0.6, envMapIntensity: 0.6 }),
      inside: MAT(kit, 'MeshStandardMaterial', 'boca', { color: 0x1a0a12, roughness: 0.6, vertexColors: true }) }; });
  const ST = kit.g('st', () => {
    const E = [-1, 1].map(s => ({ c: [s * 0.335, CY + 0.1, 0.69], re: 0.165, f: nrm([s * 0.2, 0.02, 1]), dark: 2.2 })); for (const e of E) e.rl = e.re * 1.13;
    const R = (dx, dy, dz) => { const r0 = 1 / Math.sqrt((dx / 0.86) ** 2 + (dy / 1.02) ** 2 + (dz / 0.9) ** 2); const x = dx * r0, y = dy * r0, z = dz * r0, ax = Math.abs(x);
      const jaw = G3(ax, y, z, 0.6, -0.58, 0.2, 0.28, 0.3, 0.42), chin = G3(x, y, z, 0, -1.0, 0.44, 0.1, 0.1, 0.3), cheek = G3(ax, y, z, 0.5, -0.08, 0.6, 0.13, 0.08, 0.22), hollow = G3(ax, y, z, 0.42, -0.36, 0.6, 0.12, 0.13, 0.2);
      const ridge = G3(x, y, z, 0, 0.32, 0.8, 0.44, 0.065, 0.25), nose = G3(x, y, z, 0, -0.1, 0.9, 0.05, 0.11, 0.18), tip = G3(x, y, z, 0, -0.21, 0.92, 0.05, 0.04, 0.15), crown = G3(x, y, z, 0, 0.92, -0.1, 0.5, 0.25, 0.5);
      CAV = -hollow * 0.8 + cheek * 0.3 + ridge * 0.1; return r0 - 0.19 * jaw + 0.11 * chin + 0.16 * cheek - 0.13 * hollow + 0.08 * ridge + 0.06 * nose + 0.05 * tip + 0.05 * crown; };
    const hg = sculpt(R, 0, CY, 0, kit.seg(84), kit.seg(64), sockFn(E)); const at = hg.userData.at, pt = hg.userData.pt, cav = hg.userData.cav; prep(hg);
    paint(hg, (x, y, z, nx, ny, nz, i) => { const c = cav[i]; let k = (1 + clamp(c, -0.8, 0.3) * 1.1) * lerp(0.55, 1.05, sstep(-0.5, 0.5, nz)); const vein = Math.abs(Math.sin(x * 15 + y * 5 + fbm(x * 3, y * 3, z * 3, 2) * 5)); const vv = vein < 0.1 ? 0.8 : 1; const n = 0.9 + 0.2 * fbm(x * 8, y * 8, z * 8, 3);
      const orb = clamp(-c * 1.6, 0, 1); return [k * vv * n * lerp(1, 0.55, orb), k * vv * n * lerp(1, 0.22, orb), k * vv * n * lerp(1, 0.48, orb)]; });
    ao(hg, [[0, -1.0, -0.1, 0.5]], 0.7); const hb = new Bag(); hb.add(M.skin, hg);
    /* espinhos nas maçãs do rosto */
    for (const s of [-1, 1]) for (const [x, y, len, rr] of [[0.53, -0.12, 0.44, 0.062], [0.57, -0.27, 0.32, 0.05], [0.5, -0.39, 0.2, 0.036]]) { const q = at(s * x, CY + y); if (!q) continue; const d = nrm([q.n[0] + s * 0.7, q.n[1] - 0.25, q.n[2] + 0.1]);
      const p0 = q.p, p1 = [p0[0] + d[0] * len * 0.5, p0[1] + d[1] * len * 0.5, p0[2] + d[2] * len * 0.5], p2 = [p0[0] + d[0] * len + s * 0.02, p0[1] + d[1] * len + 0.05, p0[2] + d[2] * len]; const th = sweep([[p0[0] - d[0] * 0.03, p0[1] - d[1] * 0.03, p0[2] - d[2] * 0.03], p1, p2], { n: 10, m: 7, up: [0, 1, 0], r: t => [rr * (1 - t) + 0.002, rr * (1 - t) + 0.002], smooth: true });
      hb.add(M.thorn, th); paint(th, (x2, y2, z2) => { const t = clamp(Math.hypot(x2 - p0[0], y2 - p0[1], z2 - p0[2]) / len, 0, 1); return [lerp(0.25, 1, t), lerp(0.42, 1, t), lerp(0.22, 0.85, t)]; }); }
    const headList = hb.list();
    /* frondes: lâminas de folha com bulbo aceso na ponta (rampa emissiva no fim da lâmina) */
    /* frondes como cabeleira: doze folhas longas nascem na linha do cabelo, sobem, caem para trás e, nas têmporas, emolduram o rosto até os ombros; nervura âmbar acesa */
    const fr = []; const NF = 10; for (let i = 0; i < NF; i++) { const u = i / (NF - 1) * 2 - 1, a = u * 1.28; const q = pt(Math.sin(a) * 0.86, Math.cos(a) * 0.78 + 0.12, 0.3 - Math.abs(u) * 0.12); const root = q.p; const len = 1.2 + 0.32 * Math.abs(u) + 0.08 * Math.cos(i * 2.3); const P = [[0, -0.05, 0.04]]; const UP = [nrm(q.n)]; let p = [0, 0, 0];
      for (let k = 1; k <= 9; k++) { const t = k / 9; const sa = Math.abs(Math.sin(a)); const dir = nrm([Math.sin(a) * (0.32 + 0.3 * t), Math.cos(a) * 1.15 * (1 - 1.8 * t) - 1.0 * t * sa * sa, -0.45 - 0.45 * t + sa * 0.3 * (1 - t)]); p = [p[0] + dir[0] * len / 9, p[1] + dir[1] * len / 9, p[2] + dir[2] * len / 9]; P.push(p.slice()); UP.push(nrm([root[0] + p[0], root[1] + p[1] - CY, root[2] + p[2] + 0.1])); }
      const W = 0.2 - 0.03 * Math.abs(u); const blade = sweep(P, { n: kit.seg(24), m: 8, up: t => UP[Math.min(UP.length - 1, Math.round(t * (UP.length - 1)))], r: t => [0.025 + W * Math.pow(Math.sin(Math.min(1, t * 1.05) * Math.PI), 0.7) * (1 - t * 0.35), 0.013 * (1 - t * 0.6) + 0.003], smooth: true }); prep(blade);
      const parts = [blade]; if (i % 3 === 1 && i > 0 && i < NF - 1) { const bulb = SPH(0.05, 10, 8); xf(bulb, P[P.length - 1]); prep(bulb); const uv = bulb.getAttribute('uv').array; for (let j = 0; j < uv.length; j += 2) { uv[j] = 0.995; uv[j + 1] = 0.25; } parts.push(bulb); }
      paint(blade, (x2, y2, z2, nx, ny, nz, j) => { const v = blade.getAttribute('uv').array[j * 2 + 1]; return (0.5 + 0.55 * Math.min(1, Math.hypot(x2, y2, z2) / len)) * lerp(0.72, 1.08, Math.abs(Math.cos(v * Math.PI * 2))) * (i % 2 ? 0.85 : 1); }); fr.push({ root, geo: parts.length > 1 ? merge(parts) : blade, tilt: u * 0.04 }); }
    const pods = [-1, 1].map(s => { const q = pt(s * 0.86, 0.12, 0.2); return { root: [q.p[0] + s * 0.02, q.p[1] - 0.02, q.p[2]], s }; });
    /* corpo: pescoço esguio com cipós, gola de folhas, armadura de casca com sulcos, saco de seiva */
    const bb = new Bag(); const nk = lathe([[0.34, -0.58], [0.36, -0.85], [0.42, -1.1], [0.52, -1.3]], kit.seg(28)); xf(nk, [0, 0, -0.06]); bb.add(M.skin, nk); paint(nk, (x, y) => lerp(0.35, 0.85, sstep(-1.2, -0.6, y)));
    for (let k = 0; k < 2; k++) { const pts = []; for (let i = 0; i <= 30; i++) { const t = i / 30, a = t * Math.PI * 3.2 + k * Math.PI, y = -0.62 - t * 0.6; const rr = 0.37 + t * 0.12; pts.push([Math.sin(a) * rr, y, Math.cos(a) * rr - 0.06]); } bb.add(M.dk, sweep(pts, { n: 60, m: 6, r: [0.026, 0.026], up: [0, 1, 0] })); }
    const Rt = (dx, dy, dz) => { const a = Math.atan2(dx, dz); return 1 / Math.pow(Math.pow(Math.abs(dx) / 0.98, 2.4) + Math.pow(Math.abs(dy) / 0.95, 2.4) + Math.pow(Math.abs(dz) / 0.56, 2.4), 1 / 2.4) + 0.018 * Math.sin(a * 22 + fbm(dx * 3, dy * 3, dz * 3, 2) * 6); };
    const to = sculpt(Rt, 0, -1.92, -0.15, kit.seg(56), kit.seg(40)); prep(to); bb.add(M.bark, to); paint(to, (x, y, z) => lerp(0.35, 1, sstep(-2.6, -1.2, y)) * (0.75 + 0.5 * fbm(x * 9, y * 3, z * 9, 3)));
    for (const s of [-1, 1]) for (let k = 0; k < 4; k++) { const b0 = [s * (0.62 + k * 0.1), -0.98 - k * 0.04, -0.3 + k * 0.17]; const dir = nrm([s * 1, -0.42 - k * 0.08, 0.12 + k * 0.1]); const len = 0.78 - k * 0.08; const pts = []; for (let i = 0; i <= 6; i++) { const t = i / 6; pts.push([b0[0] + dir[0] * len * t, b0[1] + dir[1] * len * t + Math.sin(t * Math.PI) * 0.14, b0[2] + dir[2] * len * t]); }
      const lf = sweep(pts, { n: 16, m: 8, up: [0, 1, 0.2], r: t => [0.03 + 0.17 * Math.sin(Math.min(1, t * 1.1) * Math.PI) * (1 - t * 0.25), 0.016] }); bb.add(M.leaf, lf, k % 2 ? 0x9fd09a : 0xffffff); paint(lf, (x2, y2, z2, nx, ny, nz, i) => { const v = lf.getAttribute('uv').array[i * 2 + 1]; return lerp(0.6, 1.05, Math.abs(Math.cos(v * Math.PI * 2))) * (0.75 + 0.35 * (ny > 0 ? 1 : 0.5)); }); }
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) { const b0 = [s * (0.5 - k * 0.08), -1.0 - k * 0.22, 0.42 + k * 0.03]; const pts = []; for (let i = 0; i <= 5; i++) { const t = i / 5; pts.push([b0[0] - s * t * 0.42, b0[1] - t * 0.5, b0[2] + Math.sin(t * Math.PI) * 0.06 + t * 0.04]); }
      const lf = sweep(pts, { n: 12, m: 8, up: [0, 0.2, 1], r: t => [0.03 + 0.12 * Math.sin(Math.min(1, t * 1.1) * Math.PI) * (1 - t * 0.3), 0.012] }); bb.add(M.leaf, lf, k % 2 ? 0x8cc890 : 0xffffff); paint(lf, (x2, y2, z2, nx, ny, nz, i) => { const v = lf.getAttribute('uv').array[i * 2 + 1]; return lerp(0.55, 1.05, Math.abs(Math.cos(v * Math.PI * 2))); }); }
    for (const s of [-1, 1]) { const Rp = (dx, dy, dz) => { const a = Math.atan2(dx, dz); return 1 / Math.pow(Math.pow(Math.abs(dx) / 0.58, 2.2) + Math.pow(Math.abs(dy) / 0.36, 2.2) + Math.pow(Math.abs(dz) / 0.56, 2.2), 1 / 2.2) + 0.018 * Math.sin(a * 14 + dy * 8); };
      const pd = sculpt(Rp, 0, 0, 0, kit.seg(36), kit.seg(24)); prep(pd); xf(pd, [s * 0.98, -1.22, -0.18], [0, 0, -s * 0.42], 0.66); bb.add(M.bark, pd); paint(pd, (x, y, z) => lerp(0.4, 1.05, sstep(-1.35, -0.8, y)) * (0.75 + 0.5 * fbm(x * 8, y * 8, z * 8, 3)));
      for (const [ox, oy, l2] of [[0.15, 0.3, 0.3], [0.38, 0.18, 0.22]]) { const b0 = [s * (1.1 + ox), -1.08 + oy, -0.1]; const th = sweep([b0, [b0[0] + s * 0.05, b0[1] + l2 * 0.6, b0[2]], [b0[0] + s * 0.14, b0[1] + l2, b0[2] - 0.04]], { n: 8, m: 6, up: [0, 0, 1], r: t => [0.05 * (1 - t) + 0.002, 0.05 * (1 - t) + 0.002], smooth: true }); bb.add(M.thorn, th); paint(th, (x2, y2) => lerp(0.35, 1, sstep(b0[1], b0[1] + l2, y2))); } }
    for (let k = 0; k < 13; k++) { const a = Math.PI * 0.32 + (k / 12) * Math.PI * 1.36; const ra = [Math.sin(a), 0, Math.cos(a)]; const back = Math.max(0, -Math.cos(a)); const r0 = 0.44, y0 = -0.86 - (k % 2) * 0.05; const len = 0.72 + back * 0.75 + (k % 3) * 0.06;
      const pts = []; for (let i = 0; i <= 6; i++) { const t = i / 6; const rr = r0 + t * len * (0.55 - back * 0.25), yy = y0 + t * len * (0.6 + back * 0.4) - t * t * len * 0.25; pts.push([ra[0] * rr, yy, ra[2] * rr - 0.06]); }
      const lf = sweep(pts, { n: 16, m: 8, up: [ra[0], 0.25, ra[2]], r: t => [0.025 + (0.15 + back * 0.05) * Math.sin(Math.min(1, t * 1.1) * Math.PI) * (1 - t * 0.3), 0.012] }); bb.add(M.leaf, lf, k % 2 ? 0x7ab87c : 0xffffff);
      paint(lf, (x2, y2, z2, nx, ny, nz, i) => { const v = lf.getAttribute('uv').array[i * 2 + 1]; const rib = Math.abs(Math.cos(v * Math.PI * 2)); return lerp(0.45, 1.1, sstep(y0, y0 + len * 0.6, y2)) * lerp(0.65, 1.05, rib); }); }
    return { E, at, pt, headList, bodyList: bb.list(), fr, pods }; });
  const hm = inst(H, ST.headList, 'cabeca'); inst(Bd, ST.bodyList, 'corpo');
  ST.E.forEach((e, i) => { const side = i ? 1 : -1; eyeRig(kit, rig, H, { c: e.c, f: e.f, re: e.re, rl: e.rl, mat: M.eye, cornea: M.cornea, lidMat: M.skin, look: X.look, edges: lidEdges(X, side, { cant: 0.32, up: X.up * 0.7 + 0.04 }), lid: { crease: 0.06, dark: 0.55 } }); });
  for (const side of [-1, 1]) browRig(kit, rig, H, ST.at, { side, x0: 0.09, x1: 0.54, y: CY + 0.36, arch: 0.1 + X.arch * 0.3, lift: 0.05, dy: X.browY * 0.8, ang: side * ({ 1: 0.36, 2: 0.66, 3: 0.24, 4: -0.3 }[mood] || 0.36), h0: 0.065, h1: 0.022, th: 0.04, off: 0.028, mat: M.dk });
  const msh = mouthShape({ 1: 'smirk', 2: 'snarl', 3: 'grin', 4: 'frown' }[mood]); for (const q of ['cl', 'cr', 'up', 'lo', 'skew']) msh[q] = (msh[q] || 0) * 1.0;
  mouthRig(kit, rig, H, ST.at, { w: 0.25, y: CY - 0.56, shape: msh, lip: 0.03, skin: M.lip, lipTint: 0xffffff, inside: M.inside, tooth: M.tooth, teeth: { up: 8, lo: 6, size: 0.036, fangs: 0.55 }, jawOpen: 0, upperK: 1.0, lowerK: 1.15 });
  if (mood === 1 || mood === 4) { const fb = new Bag(), mp = rig.mouth.position; for (const s of [-1, 1]) { const q = ST.at(s * 0.12 + 0.03, CY - 0.585); if (!q) continue; const f = CONE(0.018, 0.075, 8); f.rotateX(Math.PI); xf(f, [q.p[0] - mp.x, q.p[1] - 0.03 - mp.y, q.p[2] + 0.012 - mp.z]); fb.add(M.tooth, f); } fb.flush(rig.mouth, 'presas'); }
  rig.fronds = []; for (const F of ST.fr) { const fg = new THREE.Group(); fg.position.set(F.root[0], F.root[1], F.root[2]); const m = new THREE.Mesh(F.geo, M.frond); fg.add(m); H.add(fg); fg.rotation.z = F.tilt; fg.userData.tilt = F.tilt; fg.userData.tx = mood === 2 ? 0.1 : mood === 4 ? -0.08 : mood === 3 ? 0.04 : 0; fg.rotation.x = fg.userData.tx; rig.fronds.push(fg); }
  rig.sway = []; for (const P of ST.pods) { const pg = new THREE.Group(); pg.position.set(P.root[0], P.root[1], P.root[2]); H.add(pg); const st = new THREE.Mesh(kit.g('caule', () => { const g2 = sweep([[0, 0, 0], [0.01, -0.08, 0.02], [0, -0.16, 0.03]], { n: 6, m: 5, r: [0.012, 0.012], up: [0, 0, 1] }); return prep(g2); }), M.dk); pg.add(st);
    const pod = new THREE.Mesh(kit.g('vagem', () => { const g2 = SPH(0.06, 12, 10); const a = g2.getAttribute('position').array; for (let i = 0; i < a.length; i += 3) { const y = a[i + 1]; const k = y > 0 ? 1 - y / 0.06 * 0.55 : 1; a[i] *= k; a[i + 2] *= k; a[i + 1] *= 1.5; } g2.computeVertexNormals(); g2.translate(0, -0.24, 0.03); return g2; }), M.sap); pg.add(pod); pg.userData.a = 0.09; rig.sway.push(pg); }
  const sac = new THREE.Mesh(kit.g('saco', () => { const g2 = SPH(0.17, 18, 14); g2.scale(1, 1.15, 0.8); return g2; }), M.sap); sac.position.set(0, -1.28, 0.42); Bd.add(sac); rig.glow = sac;
  const au = glowPts(kit, [[0, -1.28, 0.62, 0.55], ...ST.pods.map(P => [P.root[0], P.root[1] - 0.24, P.root[2] + 0.12, 0.3])], 0xffa030, 0.62); H.add(au); rig.auras = [au];
  const sp = particles(kit, 16, 0xffd080, 0.05); sp.userData.src = [[0, 1.2, -0.3, 1.1], [0, -0.8, 0.25, 1.3]]; sp.userData.h = 0.8; sp.userData.kind = 'esporo'; H.add(sp); rig.sparks = [sp];
  return -0.66; };
/* ---------- Zayin Coral (Coro Quorith): cabeça-octaedro de cristal (transmissão: o núcleo aceso e um cristal interno aparecem por dentro), arestas claras,
   olhos-fenda de luz, sobrancelhas de estilhaço, "boca" de barras de luz que pulsam, base sextavada com runa, corpo de rocha facetada, cachos de cristal nos ombros,
   estilhaços orbitando e um anel de ressonância ---------- */
function polyGeo(V, F, bulge) { const THREE = T(); const P = [], N = []; const push = (a, b, c) => { const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2]; let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l; P.push(...a, ...b, ...c); for (let i = 0; i < 3; i++) N.push(nx, ny, nz); };
  for (const f of F) { const a = V[f[0]], b = V[f[1]], c = V[f[2]]; if (!bulge) { push(a, b, c); continue; } const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2]; const n = nrm([uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx]);
    const m = [(a[0] + b[0] + c[0]) / 3 + n[0] * bulge, (a[1] + b[1] + c[1]) / 3 + n[1] * bulge, (a[2] + b[2] + c[2]) / 3 + n[2] * bulge]; push(a, b, m); push(b, c, m); push(c, a, m); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); return prep(g); }
function rod(a, b, r, seg) { const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], l = Math.hypot(d[0], d[1], d[2]); const g = CYL(r, r, l, seg || 6); xf(g, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], qUp(d)); return g; }
BUILD.quorith = function (kit, X, mood, H, Bd, rig) { const THREE = T();
  const M = kit.g('mats', () => ({
    cry: MAT(kit, 'MeshPhysicalMaterial', 'cristal', { color: 0xdcc8ff, roughness: 0.05, metalness: 0, transmission: 0.92, thickness: 1.3, ior: 1.55, attenuationColor: new THREE.Color(0x9a6aff), attenuationDistance: 1.3, iridescence: 0.5, iridescenceIOR: 1.6, clearcoat: 0.6, clearcoatRoughness: 0.06, specularIntensity: 0.7, envMapIntensity: 0.8 }),
    cry2: MAT(kit, 'MeshPhysicalMaterial', 'cristal-opaco', { color: 0xa98ae6, roughness: 0.12, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.05, emissive: 0x5a30c0, emissiveIntensity: 0.45, vertexColors: true, envMapIntensity: 1.2 }, true),
    inner: MAT(kit, 'MeshStandardMaterial', 'cristal-interno', { color: 0x2a1650, emissive: 0x9a6cff, emissiveIntensity: 1.5, roughness: 0.25, metalness: 0.2 }, true),
    mask: MAT(kit, 'MeshPhysicalMaterial', 'placa', { color: 0x0e0818, metalness: 0.6, roughness: 0.14, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.0 }),
    halo: MAT(kit, 'MeshBasicMaterial', 'anel', { color: new THREE.Color(0xd8c8ff).multiplyScalar(0.75), toneMapped: false, transparent: true, opacity: 0.7 }, true),
    core: MAT(kit, 'MeshStandardMaterial', 'nucleo', { color: 0x4a2a80, emissive: 0xe6d6ff, emissiveIntensity: 3.2, roughness: 0.3 }, true),
    rock: MAT(kit, 'MeshStandardMaterial', 'rocha', { color: 0x2c2448, roughness: 0.38, metalness: 0.35, vertexColors: true, envMapIntensity: 0.9 }),
    edge: MAT(kit, 'MeshBasicMaterial', 'aresta', { color: new THREE.Color(0xf0e6ff).multiplyScalar(1.5), toneMapped: false }, true),
    slit: MAT(kit, 'MeshBasicMaterial', 'fenda', { color: new THREE.Color(0xf6efff).multiplyScalar(2.6), toneMapped: false }, true),
    slitR: MAT(kit, 'MeshBasicMaterial', 'fenda-furia', { color: new THREE.Color(0xff7ab8).multiplyScalar(2.4), toneMapped: false }, true),
    pupil: MAT(kit, 'MeshBasicMaterial', 'pupila', { color: new THREE.Color(0xffffff).multiplyScalar(3.2), toneMapped: false }, true),
    bar: MAT(kit, 'MeshBasicMaterial', 'barra', { color: new THREE.Color(0xc9a8ff).multiplyScalar(2.3), toneMapped: false }, true),
    barR: MAT(kit, 'MeshBasicMaterial', 'barra-furia', { color: new THREE.Color(0xff8a6a).multiplyScalar(2.2), toneMapped: false }, true) }));
  const V = { T: [0, 1.62, -0.12], B: [0, -0.92, 0.22], FL: [-0.74, 0.22, 0.62], FR: [0.74, 0.22, 0.62], BR: [0.74, 0.22, -0.62], BL: [-0.74, 0.22, -0.62] };
  const zU = y => 0.62 - (y - 0.22) * 0.5286, nU = nrm([0, 1.095, 2.072]), zL = y => 0.62 - (0.22 - y) * 0.351, nL = nrm([0, -0.592, 1.687]);
  const onU = (x, y, o) => [x + nU[0] * o, y + nU[1] * o, zU(y) + nU[2] * o], onL = (x, y, o) => [x + nL[0] * o, y + nL[1] * o, zL(y) + nL[2] * o];
  const ST = kit.g('st', () => { const vs = [V.T, V.B, V.FL, V.FR, V.BR, V.BL]; const F = [[2, 3, 0], [3, 4, 0], [4, 5, 0], [5, 2, 0], [3, 2, 1], [4, 3, 1], [5, 4, 1], [2, 5, 1]];
    const head = polyGeo(vs, F, 0.1); const hb = new Bag(); hb.add(M.cry, head);
    const band = (pts, on) => { const P = pts.map(q => on(q[0], q[1], 0.008)); const c = [0, 0, 0]; for (const q of P) { c[0] += q[0] / P.length; c[1] += q[1] / P.length; c[2] += q[2] / P.length; } const V2 = [c, ...P], F2 = []; for (let i = 0; i < P.length; i++) F2.push([0, 1 + i, 1 + (i + 1) % P.length]); return polyGeo(V2, F2, 0); };
    hb.add(M.mask, band([[-0.47, 0.36], [0.47, 0.36], [0.56, 0.52], [0.47, 0.67], [-0.47, 0.67], [-0.56, 0.52]], onU)); hb.add(M.mask, band([[-0.36, -0.29], [0.36, -0.29], [0.43, -0.02], [-0.43, -0.02]], onL));
    for (const [a, b] of [[0, 2], [0, 3], [0, 4], [0, 5], [1, 2], [1, 3], [1, 4], [1, 5], [2, 3], [3, 4], [4, 5], [5, 2]]) hb.add(M.edge, rod(vs[a], vs[b], 0.017, 6));
    for (const [k, rot, cy] of [[0.42, 0.55, 0.36], [0.26, -0.3, 0.9]]) { const C = [0, cy, 0.0], ivs = vs.map(v => { const x = v[0] * k, y = (v[1] - 0.35) * k * 1.2, z = (v[2] - 0.05) * k; const c = Math.cos(rot), s = Math.sin(rot); return [C[0] + x * c + z * s, C[1] + y, C[2] - x * s + z * c]; }); hb.add(M.inner, polyGeo(ivs, F, 0.03)); }
    const headList = hb.list();
    const bb = new Bag(); const base = CYL(0.62, 0.86, 0.34, 6, 1).toNonIndexed(); base.computeVertexNormals(); xf(base, [0, -1.19, 0], [0, Math.PI / 6, 0]); bb.add(M.rock, base); paint(base, (x, y) => lerp(0.55, 1.15, sstep(-1.36, -1.02, y)));
    const hexR = []; for (let k = 0; k <= 6; k++) { const a = k / 6 * Math.PI * 2 + Math.PI / 6 + Math.PI / 6; hexR.push([Math.sin(a) * 0.63, -1.015, Math.cos(a) * 0.63]); } for (let k = 0; k < 6; k++) bb.add(M.edge, rod(hexR[k], hexR[k + 1], 0.016, 5));
    const Rt = (dx, dy, dz) => 1 / Math.pow(Math.pow(Math.abs(dx) / 1.25, 2.3) + Math.pow(Math.abs(dy) / 0.95, 2.3) + Math.pow(Math.abs(dz) / 0.7, 2.3), 1 / 2.3) * (0.94 + 0.12 * vnoise(dx * 3 + 5, dy * 3, dz * 3));
    const to = sculpt(Rt, 0, -2.08, -0.15, 12, 9).toNonIndexed(); to.computeVertexNormals(); prep(to); bb.add(M.rock, to); paint(to, (x, y, z) => lerp(0.35, 1.05, sstep(-2.7, -1.3, y)) * (0.8 + 0.4 * hash3(Math.floor(x * 5), Math.floor(y * 5), Math.floor(z * 5))));
    const rr = rng(21); for (const s of [-1, 1]) for (let k = 0; k < 7; k++) { const h = 0.32 + rr() * 0.42, r = 0.06 + rr() * 0.06; const d = nrm([s * (0.5 + rr() * 0.7), 0.7 + rr() * 0.6, (rr() - 0.5) * 0.8]); const b0 = [s * (0.78 + rr() * 0.42), -1.32 + rr() * 0.22, -0.1 + (rr() - 0.5) * 0.4];
      const pr = CYL(r, r * 1.08, h, 6).toNonIndexed(); pr.computeVertexNormals(); const tip = CONE(r, r * 2.2, 6).toNonIndexed(); tip.computeVertexNormals(); tip.translate(0, h / 2 + r * 1.1, 0); const q = qUp(d, rr() * 3); xf(pr, [b0[0] + d[0] * h / 2, b0[1] + d[1] * h / 2, b0[2] + d[2] * h / 2], q); xf(tip, [b0[0] + d[0] * h / 2, b0[1] + d[1] * h / 2, b0[2] + d[2] * h / 2], q);
      bb.add(M.cry2, pr, 0.75 + rr() * 0.3); bb.add(M.cry2, tip, 1.1); }
    return { headList, bodyList: bb.list() }; });
  inst(H, ST.headList, 'cabeca'); inst(Bd, ST.bodyList, 'corpo');
  const core = new THREE.Mesh(kit.g('nucleo', () => SPH(0.17, 16, 12)), M.core); core.position.set(0, 0.36, 0.06); H.add(core); rig.glow = core;
  const core2 = new THREE.Mesh(kit.g('nucleo2', () => SPH(0.12, 12, 10)), M.core); core2.position.set(0, -0.99, 0.08); Bd.add(core2);
  /* olhos-fenda: A (+ canto de dentro desce), C (+ arqueia), espessura */
  const SL = { 1: [0.12, -0.25, 0.05], 2: [1.0, 0.05, 0.044], 3: [0.06, 1.0, 0.058], 4: [-0.8, 0.3, 0.066] }[mood];
  for (const s of [-1, 1]) { const pts = []; for (let k = 0; k <= 6; k++) { const u = k / 6, x = s * lerp(0.07, 0.46, u), y = 0.51 + SL[0] * (u - 0.5) * 0.34 + SL[1] * Math.sin(u * Math.PI) * 0.06 - SL[1] * 0.025; pts.push(onU(x, y, 0.02)); }
    const c = pts[3].slice(); const eg = new THREE.Group(); eg.position.set(c[0], c[1], c[2]); H.add(eg); eg.add(new THREE.Mesh(prep(sweep(pts.map(p => [p[0] - c[0], p[1] - c[1], p[2] - c[2]]), { n: 18, m: 6, up: nU, r: t => [SL[2] * (0.3 + 0.7 * Math.pow(Math.sin(t * Math.PI), 0.45)), 0.008] })), mood === 2 ? M.slitR : M.slit));
    const pu = new THREE.Mesh(kit.g('pupila', () => { const g2 = SPH(0.028, 10, 8); g2.scale(1, 0.85, 0.4); return g2; }), M.pupil); pu.position.set(0, 0, 0.01); eg.add(pu); eg.userData.r = 0.16; eg.userData.slide = pu; eg.userData.p0 = [0, 0, 0.01]; eg.userData.lim = 0.1; rig.eyes.push(eg); }
  /* sobrancelhas de estilhaço sobre a face de cima */
  for (const s of [-1, 1]) { const p = onU(s * 0.27, 0.76 + X.browY * 0.7, 0.05); const b = new THREE.Mesh(kit.g('sobr', () => { const g2 = new THREE.OctahedronGeometry(1, 0); g2.scale(0.17, 0.04, 0.04); return g2; }), M.cry2); b.position.set(p[0], p[1], p[2]); b.rotation.order = 'XYZ'; b.rotation.x = -0.485; const ang = s * X.brow * 0.85; b.rotation.z = ang; b.userData.base = ang; b.userData.side = s; b.userData.y0 = p[1]; H.add(b); rig.brows.push(b); }
  /* boca: barras de luz numa curva que muda com o humor */
  const mg = new THREE.Group(); const mc = onL(0, -0.13, 0.012); mg.position.set(mc[0], mc[1], mc[2]); H.add(mg); const bars = new Bag();
  for (let k = 0; k < 7; k++) { const u = k / 3 - 1; let yc, h; if (mood === 2) { yc = -0.15 - 0.02 * u * u; h = 0.15 * (0.65 + 0.35 * Math.abs(Math.sin(k * 1.7))); } else if (mood === 3) { yc = -0.15 + 0.075 * u * u; h = 0.09 + 0.06 * (1 - u * u); } else if (mood === 4) { yc = -0.1 - 0.065 * u * u; h = 0.035 + 0.01 * (1 - u * u); } else { yc = -0.13 + 0.045 * u * u; h = 0.05 + 0.025 * (1 - u * u); }
    const p = onL(u * 0.25, yc, 0.014); const bx = rbox(0.046, h, 0.022, 4, 8); xf(bx, [p[0] - mc[0], p[1] - mc[1], p[2] - mc[2]], [0.337, 0, 0]); bars.add(mood === 2 ? M.barR : M.bar, bx); }
  bars.flush(mg, 'barras'); rig.mouth = mg; rig.mouthK = 0.9;
  rig.shards = []; const SH = [[-1.28, 0.95, 0.15, 0.15], [1.32, 0.55, -0.05, 0.17], [-1.08, -0.38, 0.45, 0.11], [1.12, 1.28, 0.1, 0.12], [-0.62, 1.62, 0.32, 0.09]];
  SH.forEach(([x, y, z, sz], i) => { const sh = new THREE.Mesh(kit.g('estilhaco:' + i, () => { const g2 = new THREE.OctahedronGeometry(sz, 0); g2.scale(0.7, 1.5, 0.7); return g2; }), M.cry2); sh.position.set(x, y, z); sh.rotation.set(0.3 + i, 0.2 * i, 0.25 - i * 0.2); sh.userData.p = [x, y, z]; sh.userData.ry = i; H.add(sh); rig.shards.push(sh); });
  const halo = new THREE.Group(); halo.position.set(0, 0.45, -0.72); H.add(halo); halo.add(new THREE.Mesh(kit.g('halo', () => { const b2 = new Bag(); b2.add(M.halo, TOR(1.22, 0.008, 4, 72)); for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; const s2 = SPH(0.028, 8, 6); s2.translate(Math.cos(a) * 1.22, Math.sin(a) * 1.22, 0); b2.add(M.halo, s2); } return b2.list()[0].geo; }), M.halo)); halo.userData.w = 0.25; rig.spin = [halo];
  const au = glowPts(kit, [[0, 0.36, 0.25, 0.55], [-0.27, 0.51, 0.52, 0.3], [0.27, 0.51, 0.52, 0.3], [0, -0.99, 0.3, 0.45]], 0xc8a0ff, 0.8); H.add(au); const gl = glowPts(kit, [[V.T[0], V.T[1] + 0.02, V.T[2] + 0.04, 0.9], [V.FL[0] - 0.02, V.FL[1], V.FL[2] + 0.03, 0.7], [V.FR[0] + 0.02, V.FR[1], V.FR[2] + 0.03, 0.7], [V.B[0], V.B[1] - 0.02, V.B[2] + 0.04, 0.6]], 0xf4ecff, 0.26); H.add(gl); const au2 = glowPts(kit, [[0, 0.5, -0.9, 0.22]], 0x9a6cff, 3.2); H.add(au2); rig.auras = [au, au2, gl];
  const sp = particles(kit, 22, 0xd8c0ff, 0.045); sp.userData.src = [[0, 0.4, -0.1, 1.25]]; sp.userData.kind = 'orbita'; H.add(sp); rig.sparks = [sp];
  rig.poseK = 0.45; return -0.95; };
/* ---------- Oru Voraz (Prole Vorag): cabeça larga de quitina vermelha molhada sob carapaça escura em placas, coroa de espinhos de osso, quatro olhos âmbar
   (dois grandes, dois pequenos) com pálpebras de membrana, mandíbula que abre com fileiras de dentes, palpos laterais, pescoço segmentado, ombros com pústulas acesas ---------- */
BUILD.vorag = function (kit, X, mood, H, Bd, rig) { const THREE = T();
  const M = kit.g('mats', () => { const et = eyeTex(kit, { kind: 'ambar', sclera: 0xff9a2a, scleraEdge: 0x6a1c00, irisIn: 0xffe6a0, irisMid: 0xffb030, irisOut: 0x8a3000, glowIn: 0xffb838, glowMid: 0xff7c10, glowOut: 0x3a0c00, limbus: 0x3a0a00, slit: 0.75, iris: 1.45, seed: 9 });
    return { skin: MAT(kit, 'MeshPhysicalMaterial', 'quitina', { color: 0x7c1a28, normalMap: detail(kit, 'quitina', [6, 3], 2.4), normalScale: new THREE.Vector2(0.5, 0.5), roughness: 0.4, clearcoat: 0.7, clearcoatRoughness: 0.24, vertexColors: true, envMapIntensity: 0.8 }),
      shell: MAT(kit, 'MeshPhysicalMaterial', 'carapaca', { color: 0x34121c, normalMap: detail(kit, 'quitina', [6, 3], 2.4), normalScale: new THREE.Vector2(0.4, 0.4), roughness: 0.32, metalness: 0.1, clearcoat: 0.75, clearcoatRoughness: 0.16, vertexColors: true, envMapIntensity: 1.2 }),
      bone: MAT(kit, 'MeshPhysicalMaterial', 'osso', { color: 0xe8d8be, roughness: 0.45, clearcoat: 0.3, vertexColors: true, envMapIntensity: 0.55 }),
      inside: MAT(kit, 'MeshPhysicalMaterial', 'goela', { color: 0x4a0a12, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.2, vertexColors: true, envMapIntensity: 0.6 }),
      pus: MAT(kit, 'MeshStandardMaterial', 'pustula', { color: 0x5a1000, emissive: 0xff5a2a, emissiveIntensity: 1.7, roughness: 0.25 }, true),
      eye: MAT(kit, 'MeshPhysicalMaterial', 'olho', { map: et.map, emissiveMap: et.emi, emissive: 0xffffff, emissiveIntensity: 1.4, roughness: 0.32, clearcoat: 0, envMapIntensity: 0.8 }, true),
      cornea: MAT(kit, 'MeshPhysicalMaterial', 'cornea', { color: 0x000000, roughness: 0.05, metalness: 0, specularIntensity: 1, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, envMapIntensity: 2.2 }) /* 4.3e: só o reflexo molhado (aditivo): a córnea translúcida comum velava o olho de branco */ }; });
  const ST = kit.g('st', () => {
    const E = [{ c: [-0.41, 0.1, 0.81], re: 0.17, f: nrm([-0.32, 0.06, 1]) }, { c: [0.41, 0.1, 0.81], re: 0.17, f: nrm([0.32, 0.06, 1]) }, { c: [-0.74, 0.25, 0.6], re: 0.1, f: nrm([-0.7, 0.26, 0.75]) }, { c: [0.74, 0.25, 0.6], re: 0.1, f: nrm([0.7, 0.26, 0.75]) }]; for (const e of E) { e.rl = e.re * 1.13; e.dark = 1.2; }
    const R = (dx, dy, dz) => { const r0 = 1 / Math.sqrt((dx / 1.25) ** 2 + (dy / 0.84) ** 2 + (dz / 0.98) ** 2); const x = dx * r0, y = dy * r0, z = dz * r0, ax = Math.abs(x);
      const brow = G3(ax, y, z, 0.42, 0.32, 0.78, 0.26, 0.075, 0.25), snout = G3(x, y, z, 0, -0.14, 0.9, 0.44, 0.16, 0.25), cheek = G3(ax, y, z, 0.86, -0.12, 0.48, 0.24, 0.16, 0.3), cut = G3(x, y, z, 0, -0.8, 0.25, 0.95, 0.2, 0.7), nos = G3(ax, y, z, 0.13, -0.06, 0.95, 0.05, 0.04, 0.12);
      CAV = -nos * 0.9 - cut * 0.4 + brow * 0.15; return r0 + 0.1 * brow + 0.12 * snout + 0.06 * cheek - 0.26 * cut - 0.035 * nos; };
    const hg = sculpt(R, 0, 0, 0, kit.seg(88), kit.seg(64), sockFn(E)); const at = hg.userData.at, cav = hg.userData.cav; prep(hg);
    paint(hg, (x, y, z, nx, ny, nz, i) => { const k = (1 + clamp(cav[i], -0.8, 0.3) * 1.1) * lerp(0.45, 1.05, sstep(-0.6, 0.4, nz)) * lerp(0.6, 1, sstep(-0.5, 0.0, y)); const sp = fbm(x * 7, y * 7, z * 7, 3); return [k * (0.85 + 0.3 * sp), k * (0.8 + 0.25 * sp), k * (0.82 + 0.25 * sp)]; });
    const hb = new Bag(); hb.add(M.skin, hg);
    /* carapaça em placas com quilha e borda grossa */
    const capT = 1.5, tMax = az => lerp(1.48, 1.1, Math.pow(Math.max(0, Math.cos(az)), 1.4)) + 0.06 * Math.abs(Math.sin(az * 6)) + 0.16 * Math.exp(-((az / 0.3) ** 2)); const cap = SPH(1, kit.seg(64), kit.seg(26), 0, Math.PI * 2, 0, capT); { const a = cap.getAttribute('position').array; for (let i = 0; i < a.length; i += 3) { const l0 = Math.hypot(a[i], a[i + 1], a[i + 2]) || 1, th = Math.acos(clamp(a[i + 1] / l0, -1, 1)), az = Math.atan2(a[i], a[i + 2]), nt = th / capT * tMax(az); const dx = Math.sin(nt) * Math.sin(az), dy = Math.cos(nt), dz = Math.sin(nt) * Math.cos(az); CAV = 0; const r = R(dx, dy, dz) + 0.05 + 0.06 * Math.exp(-((dx / 0.08) ** 2)) * Math.max(0, dy) + 0.025 * sstep(0.2, 0.0, Math.abs(dz - 0.3)) + 0.025 * sstep(0.2, 0.0, Math.abs(dz + 0.2)); a[i] = dx * r; a[i + 1] = dy * r; a[i + 2] = dz * r; } cap.computeVertexNormals(); weld(cap); }
    hb.add(M.shell, cap); paint(cap, (x, y, z) => { const g1 = Math.abs(z - 0.42) < 0.03 || Math.abs(z + 0.1) < 0.03 ? 0.25 : 1; const keel = Math.abs(x) < 0.04 ? 1.5 : 1; return g1 * keel * lerp(0.7, 1.15, sstep(0.2, 0.8, y)) * (0.85 + 0.3 * fbm(x * 6, y * 6, z * 6, 3)); });
    { const ring = []; for (let k = 0; k < 64; k++) { const f = k / 64 * Math.PI * 2, tt = tMax(f); const dx = Math.sin(tt) * Math.sin(f), dy = Math.cos(tt), dz = Math.sin(tt) * Math.cos(f); const l = Math.hypot(dx, dy, dz); const r = R(dx / l, dy / l, dz / l) + 0.06; ring.push([dx / l * r, dy / l * r, dz / l * r]); } hb.add(M.shell, sweep(ring, { n: 128, m: 8, r: [0.055, 0.05], up: [0, 1, 0], closed: true }), 0.8); }
    /* coroa de espinhos de osso */
    for (const [dx, dy, dz, len, rr] of [[0, 0.72, 0.68, 0.5, 0.075], [-0.4, 0.78, 0.48, 0.4, 0.065], [0.4, 0.78, 0.48, 0.4, 0.065], [-0.76, 0.6, 0.2, 0.34, 0.058], [0.76, 0.6, 0.2, 0.34, 0.058], [-0.42, 0.86, -0.28, 0.32, 0.055], [0.42, 0.86, -0.28, 0.32, 0.055]]) { const l = Math.hypot(dx, dy, dz); const r0 = R(dx / l, dy / l, dz / l) + 0.07; const b0 = [dx / l * r0, dy / l * r0, dz / l * r0]; const n = nrm([dx * 0.8, dy + 0.4, dz * 0.5 - 0.2]);
      const p1 = [b0[0] + n[0] * len * 0.55, b0[1] + n[1] * len * 0.55, b0[2] + n[2] * len * 0.55], p2 = [b0[0] + n[0] * len + dx * 0.08, b0[1] + n[1] * len * 0.9, b0[2] + n[2] * len - 0.12]; const sp = sweep([[b0[0] - n[0] * 0.05, b0[1] - n[1] * 0.05, b0[2] - n[2] * 0.05], p1, p2], { n: 12, m: 8, up: [0, 0, 1], r: t => [rr * Math.pow(1 - t, 0.8) + 0.003, rr * Math.pow(1 - t, 0.8) + 0.003], smooth: true });
      hb.add(M.bone, sp); paint(sp, (x2, y2, z2) => lerp(0.45, 1.08, clamp(Math.hypot(x2 - b0[0], y2 - b0[1], z2 - b0[2]) / len, 0, 1))); }
    /* arcada de cima: gengiva escura e presas; a goela escura por trás */
    const thr = SPH(0.5, 24, 16); xf(thr, [0, -0.44, 0.38], null, [1.05, 0.7, 0.9]); hb.add(M.inside, thr, 0.6);
    const gum = []; for (let i = 0; i <= 12; i++) { const x = -0.66 + 1.32 * i / 12; const q = at(x, -0.31); if (q) gum.push([q.p[0], q.p[1] + 0.01, q.p[2] - 0.02]); } if (gum.length > 3) hb.add(M.inside, sweep(gum, { n: 30, m: 8, r: [0.04, 0.04], up: [0, 1, 0] }));
    for (let i = 0; i < 11; i++) { const x = -0.6 + 1.2 * i / 10; const q = at(x, -0.32); if (!q) continue; const fang = Math.abs(Math.abs(x) - 0.36) < 0.07; const h = fang ? 0.24 : 0.12 + 0.03 * Math.cos(x * 3), r = fang ? 0.05 : 0.035; const t = CONE(r, h, 8); t.rotateX(Math.PI); xf(t, [q.p[0], q.p[1] - h / 2 + 0.01, q.p[2] - 0.03], [-0.15, 0, x * 0.3]); hb.add(M.bone, t); paint(t, (x2, y2) => lerp(1.05, 0.7, clamp((q.p[1] - y2) / h, 0, 1))); }
    const headList = hb.list();
    /* mandíbula de baixo (gira para abrir), com duas fileiras de dentes e língua */
    const PV = [0, -0.22, -0.1]; const jb = new Bag(); const jw = SPH(1, kit.seg(48), kit.seg(16), 0, Math.PI * 2, Math.PI / 2, Math.PI / 2); xf(jw, [0 - PV[0], -0.34 - PV[1], 0.12 - PV[2]], null, [1.08, 0.46, 0.9]); jb.add(M.skin, jw); paint(jw, (x, y) => lerp(0.3, 0.85, sstep(-0.95 - PV[1], -0.4 - PV[1], y)));
    const tg = SPH(1, 20, 10); xf(tg, [0, -0.36 - PV[1], 0.18 - PV[2]], null, [0.78, 0.13, 0.62]); jb.add(M.inside, tg, 0.9);
    const jrim = []; for (let k = 0; k <= 24; k++) { const f = Math.PI * 0.12 + Math.PI * 0.76 * k / 24; jrim.push([Math.cos(f) * 1.06 - PV[0], -0.335 - PV[1], 0.12 + Math.sin(f) * 0.88 - PV[2]]); } jb.add(M.inside, sweep(jrim, { n: 40, m: 6, r: [0.035, 0.03], up: [0, 1, 0] }));
    for (const [row, rad, hh] of [[0, 1.0, 0.13], [1, 0.84, 0.08]]) for (let k = 0; k < (row ? 7 : 11); k++) { const f = Math.PI * 0.2 + Math.PI * 0.6 * k / ((row ? 7 : 11) - 1); const fang = !row && (k === 2 || k === 8); const h = fang ? 0.22 : hh, r = fang ? 0.05 : row ? 0.026 : 0.034; const t = CONE(r, h, 8); xf(t, [Math.cos(f) * rad * 1.05 - PV[0], -0.33 + h / 2 - PV[1], 0.12 + Math.sin(f) * rad * 0.86 - PV[2]], [0.2, 0, -Math.cos(f) * 0.3]); jb.add(M.bone, t); }
    const jawList = jb.list();
    /* corpo: pescoço em anéis, tronco de quitina, ombros com espinhos e pústulas */
    const bb = new Bag(); for (const [y, r] of [[-0.5, 0.62], [-0.72, 0.7], [-0.94, 0.8]]) { const rg = lathe([[r * 0.92, y + 0.1], [r, y + 0.06], [r * 1.02, y - 0.04], [r * 0.9, y - 0.12]], kit.seg(40)); xf(rg, [0, 0, -0.12], null, [1.1, 1, 0.92]); bb.add(M.shell, rg); paint(rg, (x, y2) => lerp(0.5, 1.1, sstep(y - 0.12, y + 0.08, y2))); }
    const nk = lathe([[0.5, -0.35], [0.6, -0.7], [0.72, -1.05]], kit.seg(32)); xf(nk, [0, 0, -0.12], null, [1.1, 1, 0.92]); bb.add(M.inside, nk, 0.8);
    for (const prof of [[[0.5, -0.86], [0.8, -0.95], [1.02, -1.08], [1.09, -1.24], [1.03, -1.38], [0.9, -1.43]], [[0.95, -1.32], [1.12, -1.4], [1.2, -1.6], [1.13, -1.78], [1.0, -1.83]], [[1.08, -1.72], [1.22, -1.82], [1.28, -2.05], [1.21, -2.3], [1.05, -2.37]], [[1.14, -2.2], [1.26, -2.3], [1.3, -2.55], [1.24, -2.85], [1.1, -2.92]]]) { const sg = lathe(prof, kit.seg(48)); xf(sg, [0, 0, -0.2], null, [1.22, 1, 0.76]); bb.add(M.shell, sg); const y0 = prof[0][1], y1 = prof[prof.length - 1][1]; paint(sg, (x, y, z) => lerp(0.4, 1.2, sstep(y1, y0, y)) * (0.85 + 0.3 * fbm(x * 6, y * 6, z * 6, 3)) * (Math.abs(x) < 0.05 && z > 0 ? 1.4 : 1)); }
    for (const [y, l] of [[-1.15, 0.16], [-1.52, 0.2], [-1.92, 0.22]]) { const b0 = [0, y, 0.62 + (y + 1.15) * 0.12]; const sp2 = sweep([b0, [0, y + l * 0.55, b0[2] + l * 0.4], [0, y + l, b0[2] + l * 0.55]], { n: 8, m: 7, up: [1, 0, 0], r: t => [0.05 * Math.pow(1 - t, 0.8) + 0.003, 0.05 * Math.pow(1 - t, 0.8) + 0.003], smooth: true }); bb.add(M.bone, sp2); paint(sp2, (x2, y2) => lerp(0.5, 1.08, sstep(y, y + l, y2))); }
    const Rt = (dx, dy, dz) => 1 / Math.pow(Math.pow(Math.abs(dx) / 1.0, 3) + Math.pow(Math.abs(dy) / 0.72, 3) + Math.pow(Math.abs(dz) / 0.55, 3), 1 / 3);
    const to = sculpt(Rt, 0, -1.75, -0.3, kit.seg(40), kit.seg(28)); prep(to); bb.add(M.shell, to); paint(to, (x, y, z) => { const band = Math.abs(((y + 3) % 0.3) - 0.15) < 0.025 ? [2.2, 0.9, 0.9] : [1, 1, 1]; const k = lerp(0.45, 1.1, sstep(-2.6, -1.2, y)) * (0.85 + 0.3 * fbm(x * 5, y * 5, z * 5, 3)); return [band[0] * k, band[1] * k, band[2] * k]; });
    const pusP = []; for (const s of [-1, 1]) { const Rp = (dx, dy, dz) => 1 / Math.pow(Math.pow(Math.abs(dx) / 0.66, 2.2) + Math.pow(Math.abs(dy) / 0.4, 2.2) + Math.pow(Math.abs(dz) / 0.64, 2.2), 1 / 2.2);
      const pd = sculpt(Rp, 0, 0, 0, kit.seg(36), kit.seg(24)); prep(pd); xf(pd, [s * 1.26, -0.95, -0.15], [0, 0, -s * 0.4]); bb.add(M.shell, pd); paint(pd, (x, y, z) => lerp(0.5, 1.15, sstep(-1.3, -0.6, y)) * (0.85 + 0.3 * fbm(x * 6, y * 6, z * 6, 3)));
      for (const [ox, oy, oz, len] of [[0.05, 0.36, -0.05, 0.42], [0.36, 0.22, 0.05, 0.3]]) { const b0 = [s * (1.26 + ox), -0.95 + oy, -0.15 + oz]; const sp = sweep([b0, [b0[0] + s * 0.06, b0[1] + len * 0.6, b0[2] - 0.04], [b0[0] + s * 0.18, b0[1] + len, b0[2] - 0.12]], { n: 10, m: 7, up: [0, 0, 1], r: t => [0.06 * Math.pow(1 - t, 0.8) + 0.003, 0.06 * Math.pow(1 - t, 0.8) + 0.003], smooth: true }); bb.add(M.bone, sp); paint(sp, (x2, y2) => lerp(0.45, 1.08, sstep(b0[1], b0[1] + len, y2))); }
      for (const [ox, oy, oz, r] of [[-0.18, 0.2, 0.36, 0.085], [0.1, 0.28, 0.32, 0.07], [0.3, 0.12, 0.34, 0.06]]) pusP.push([s * (1.26 + ox), -0.95 + oy, -0.15 + oz, r]); }
    const pusG = merge(pusP.map(p => { const g2 = SPH(p[3], 12, 10); g2.translate(p[0], p[1], p[2]); return prep(g2); }));
    return { E, at, headList, jawList, bodyList: bb.list(), pusG }; });
  inst(H, ST.headList, 'cabeca'); inst(Bd, ST.bodyList, 'corpo');
  ST.E.forEach((e, i) => { const side = e.c[0] < 0 ? -1 : 1, small = i > 1; eyeRig(kit, rig, H, { c: e.c, f: e.f, re: e.re, rl: e.rl, mat: M.eye, cornea: small ? null : M.cornea, lidMat: M.skin, look: X.look, edges: lidEdges(X, side, { cant: -0.05, up: small ? X.up * 0.9 + 0.08 : X.up }), lid: { crease: 0.03, dark: 0.6, nu: small ? 14 : 22 } }); });
  for (const side of [-1, 1]) browRig(kit, rig, H, ST.at, { side, x0: 0.17, x1: 0.68, y: 0.335, arch: X.arch * 0.4, dy: X.browY, ang: side * X.brow * 0.85, h0: 0.09, h1: 0.055, th: 0.055, off: 0.04, mat: M.shell });
  const jaw = new THREE.Group(); jaw.position.set(0, -0.22, -0.1); H.add(jaw); inst(jaw, ST.jawList, 'mandibula'); const open = { 1: 0.3, 2: 0.66, 3: 0.52, 4: 0.1 }[mood]; jaw.rotation.x = open; jaw.userData.base = open; rig.jaw = jaw; rig.jawK = 0.25;
  const mg = new THREE.Group(); mg.position.set(0, -0.36, 0.9); H.add(mg); rig.mouth = mg; rig.mouthK = 0;
  rig.mandibles = []; for (const s of [-1, 1]) { const g2 = new THREE.Group(); g2.position.set(s * 0.88, -0.36, 0.52); H.add(g2); g2.add(new THREE.Mesh(kit.g('palpo:' + s, () => { const b2 = new Bag(); const pts = [[0, 0, 0], [s * 0.24, -0.14, 0.14], [s * 0.2, -0.42, 0.34], [s * 0.02, -0.52, 0.5]]; const sw = sweep(pts, { n: 16, m: 8, up: [0, 0, 1], r: t => [0.085 * (1 - t * 0.88) + 0.004, 0.075 * (1 - t * 0.88) + 0.004], smooth: true }); b2.add(M.skin, sw); paint(sw, (x, y) => y < -0.4 ? 2.4 : lerp(0.9, 0.45, sstep(-0.05, -0.4, y)));
      const jt = SPH(0.09, 10, 8); jt.translate(s * 0.24, -0.14, 0.14); b2.add(M.skin, jt, 0.55); return b2.list()[0].geo; }), M.skin)); const rz = s * ({ 1: 0, 2: 0.32, 3: 0.18, 4: -0.2 }[mood]); g2.rotation.z = rz; g2.userData.rz = rz; g2.userData.side = s; rig.mandibles.push(g2); }
  const pus = new THREE.Mesh(ST.pusG, M.pus); Bd.add(pus); rig.glow = pus;
  const au = glowPts(kit, [...ST.E.map((e, i) => [e.c[0] + e.f[0] * e.re * 1.4, e.c[1] + e.f[1] * e.re * 1.4, e.c[2] + e.f[2] * e.re * 1.4, i > 1 ? 0.22 : 0.34])], 0xffa030, 0.5); H.add(au); const au2 = glowPts(kit, [[-1.2, -0.72, 0.2, 0.4], [1.2, -0.72, 0.2, 0.4]], 0xff5a2a, 0.7); Bd.add(au2); rig.auras = [au, au2];
  const sp = particles(kit, 16, 0xffa070, 0.045); sp.userData.src = [[-1.25, -0.7, -0.1, 0.6], [1.25, -0.7, -0.1, 0.6], [0, 0.9, -0.4, 1.2]]; sp.userData.h = 0.7; sp.userData.kind = 'esporo'; Bd.add(sp); rig.sparks = [sp];
  return -0.62; };
/* ---------- 4.3e: luz de estúdio (cartões) e luz da partida (setLight) — sempre as mesmas seis luzes: trocar cor e força não recompila shader ---------- */
const FR = { vehnar: { y: -0.24, d: 6.2 }, erevane: { y: -0.12, d: 6.3 }, tessara: { y: -0.12, d: 6.3 }, quorith: { y: -0.12, d: 6.4 }, vorag: { y: -0.3, d: 6.25 } };
const STUDIO = { key: [1, 0.92, 0.82, 3.0], fill: 0.3, rimA: [0.84, 0.9, 1, 3.0], rimB: 3.6, hemi: [0.6, 0.68, 0.84, 0.12, 0.09, 0.08, 0.38], cons: 0.42 };
function sceneFor(race) { const THREE = T(); const sc = new THREE.Scene(); const C = new THREE.Color((COL[race] || COL.vehnar).c);
  const L = { key: new THREE.DirectionalLight(0xffffff, 1), fill: new THREE.DirectionalLight(0xffffff, 1), rimA: new THREE.DirectionalLight(0xffffff, 1), rimB: new THREE.DirectionalLight(C, 1), hemi: new THREE.HemisphereLight(0xffffff, 0x222222, 1), cons: new THREE.DirectionalLight(C, 1) };
  L.key.position.set(-3.3, 3.4, 2.5); L.fill.position.set(3.4, 0.2, 2.0); L.rimA.position.set(-3.0, 2.6, -3.0); L.rimB.position.set(3.4, 1.2, -2.6); L.cons.position.set(0.3, -3.2, 2.4);
  for (const k in L) sc.add(L[k]); const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 60);
  const base = { race: C, fillC: new THREE.Color(0xffffff).lerp(C, 0.4) }; const W = new THREE.Color(0xffffff); return { sc, cam, L, base, W }; }
function studio(it) { const L = it.L, S = STUDIO, b = it.base; L.key.color.setRGB(S.key[0], S.key[1], S.key[2]); L.key.intensity = S.key[3]; L.fill.color.copy(b.fillC); L.fill.intensity = S.fill;
  L.rimA.color.setRGB(S.rimA[0], S.rimA[1], S.rimA[2]); L.rimA.intensity = S.rimA[3]; L.rimB.color.copy(b.race); L.rimB.intensity = S.rimB; L.hemi.color.setRGB(S.hemi[0], S.hemi[1], S.hemi[2]); L.hemi.groundColor.setRGB(S.hemi[3], S.hemi[4], S.hemi[5]); L.hemi.intensity = S.hemi[6];
  L.cons.color.copy(b.race); L.cons.intensity = S.cons; it.glowK = 1; it.envK = 1; it.exposure = 0.96; it.lit = false; envApply(it); }
function envApply(it) { const k = it.envK == null ? 1 : it.envK; if (!it.kit) return; const ms = it.kit.mats; for (let i = 0; i < ms.length; i++) if (ms[i].envMap) ms[i].envMapIntensity = ms[i].userData.env0 * k; }
/* setLight(it, L): L = { sun:[r,g,b] (linear, 0..~1.5), sunI (0.55 noite .. 1.6 dia), sky:[r,g,b], ground:[r,g,b], night 0..1, flash 0..1 }.
   A luz principal toma a cor e a força do sol com limites (o rosto sempre lê); preenchimento e hemisfério tomam o céu; à noite o rosto escurece,
   os emissivos da Raça e a luz de console (cor da Raça, de baixo) ganham peso; o contorno segue separando o busto do fundo. Sem alocar. */
function setLight(it, P) { if (!it || !it.L || !P) return; const L = it.L, b = it.base; const nt = clamp(+P.night || 0, 0, 1), fl = clamp(+P.flash || 0, 0, 1); const s = P.sun || STUDIO.key, k = P.sky || STUDIO.hemi, gr = P.ground || [0.16, 0.16, 0.18];
  let mx = Math.max(s[0], s[1], s[2], 1e-3); L.key.color.setRGB(lerp(1, s[0] / mx, 0.7), lerp(1, s[1] / mx, 0.7), lerp(1, s[2] / mx, 0.7)); if (fl > 0) L.key.color.lerp(it.W, fl * 0.7);
  L.key.intensity = clamp(0.55 + (P.sunI == null ? 1.2 : +P.sunI) * 1.35, 1.15, 2.85) * (1 - 0.18 * nt) + fl * 3.2;
  mx = Math.max(k[0], k[1], k[2], 1e-3); L.fill.color.setRGB(lerp(b.fillC.r, k[0] / mx, 0.55), lerp(b.fillC.g, k[1] / mx, 0.55), lerp(b.fillC.b, k[2] / mx, 0.55)); L.fill.intensity = 0.42 + 0.3 * (1 - nt);
  const hk = 0.9 / mx; L.hemi.color.setRGB(clamp(k[0] * hk, 0.06, 1.2), clamp(k[1] * hk, 0.06, 1.2), clamp(k[2] * hk, 0.06, 1.2)); L.hemi.groundColor.setRGB(clamp(gr[0], 0.02, 0.6), clamp(gr[1], 0.02, 0.6), clamp(gr[2], 0.02, 0.6)); L.hemi.intensity = 0.38 + 0.3 * (1 - nt) + fl * 0.4;
  L.rimA.color.setRGB(lerp(0.9, k[0] / mx, 0.45), lerp(0.94, k[1] / mx, 0.45), lerp(1, k[2] / mx, 0.45)); L.rimA.intensity = 1.9 + 0.5 * nt; L.rimB.color.copy(b.race); L.rimB.intensity = 2.3 + 1.0 * nt;
  L.cons.color.copy(b.race); L.cons.intensity = 0.3 + 1.7 * nt; it.glowK = 1 + 0.6 * nt + fl * 0.3; it.envK = 1 - 0.45 * nt; it.exposure = 1 - 0.1 * nt + fl * 0.15; it.lit = true; envApply(it); }
function frame(it) { const F = frameFor(it.race, it.framing); it.cam.position.set(F.pos[0], F.pos[1], F.pos[2]); it.cam.lookAt(F.look[0], F.look[1], F.look[2]); }
/* ---------- montagem num <canvas> 2D ---------- */
// opts: { size, framing: 'card' | 'hud', mood, fps, yaw, still (foto estável: sem piscar, sem balanço) }
function mount(canvas, race, opts) {
  if (!canUse() || !ensure()) return null; opts = opts || {}; race = COL[race] ? race : 'vehnar';
  const S = sceneFor(race); const it = { canvas, ctx: canvas.getContext('2d'), race, sc: S.sc, cam: S.cam, L: S.L, base: S.base, W: S.W, kit: newKit(race, {}), mood: opts.mood || 1, baseMood: opts.mood || 1, head: null, t0: performance.now(), last: 0, n: 0, fps: opts.fps || 24, framing: opts.framing || 'card', yaw: opts.yaw == null ? 0.22 : opts.yaw, still: !!opts.still, stats: { tris: 0, calls: 0 },
    st: { look: [0, 0], lookT: [0, 0], nextBlink: 1 + Math.random() * 3, blink: 0, nod: 0, shake: 0, talk: 0, jolt: 0, until: 0, gaze: null, gazeUntil: 0, nextGlance: 2 + Math.random() * 3, pose: [0, 0, 0] } };
  studio(it); frame(it); it.pending = true; /* 4.3e: o busto é montado no laço, um por quadro (a tela inicial sobe cinco de uma vez sem travar) */
  if (opts.now) build(it); items.push(it); loop(); return it;
}
function build(it) { it.pending = false; setHead(it, it.mood); envApply(it); /* materiais nasceram agora: vale a luz já pedida por setLight */ if (it.framing === 'hud') prewarm(it); /* 4.3d: no HUD o líder troca de humor durante a partida */ }
function setHead(it, mood) { /* 4.3d: as cabeças de cada humor ficam guardadas; 4.3e: e todas dividem o mesmo kit (materiais, texturas, peças fixas) */
  if (it.head) it.sc.remove(it.head.g);
  it.heads = it.heads || {}; it.head = it.heads[mood] || (it.heads[mood] = buildHead(it.race, mood, { kit: it.kit })); it.sc.add(it.head.g); it.mood = mood;
}
function prewarm(it) { /* 4.3d: monta os quatro humores e compila os shaders de uma vez, fora do quadro (assíncrono quando o navegador permite) */
  try { it.heads = it.heads || {}; const extra = []; for (const m of [1, 2, 3, 4]) { if (!it.heads[m]) it.heads[m] = buildHead(it.race, m, { kit: it.kit }); if (it.heads[m] !== it.head) { it.sc.add(it.heads[m].g); extra.push(it.heads[m].g); } }
    const done = () => { for (const g of extra) if (!it.head || g !== it.head.g) it.sc.remove(g); };
    const par = !!(renderer.extensions && renderer.extensions.has && renderer.extensions.has('KHR_parallel_shader_compile')); /* sem a extensão o three avisa no console (e a caixa de erros mostra): compila direto */
    if (par && renderer.compileAsync) renderer.compileAsync(it.sc, it.cam).then(done, done); else { renderer.compile(it.sc, it.cam); done(); } } catch (e) { console.warn('[ARD] líder 3D (pré-compilação):', e.message); } }
function disposeKit(kit) { if (!kit) return; for (const g of kit.geo.values()) if (g && g.dispose) g.dispose(); for (const t of kit.tex) t.dispose(); for (const m of kit.mats) m.dispose(); kit.geo.clear(); kit.tex.length = 0; kit.mats.length = 0; }
function disposeHead(h) { if (!h) return; h.g.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
function unmount(it) { const i = items.indexOf(it); if (i >= 0) items.splice(i, 1); const all = new Set(Object.values(it.heads || {})); if (it.head) all.add(it.head); for (const h of all) { it.sc.remove(h.g); disposeHead(h); } disposeKit(it.kit); it.kit = null; it.heads = null; it.head = null; }
function stopAll() { for (const it of items.slice()) unmount(it); }
/* ---------- reações ---------- */
// mood(it, m, ms): troca o humor por ms (depois volta ao humor de base); react(it, kind): 'nod' | 'shake' | 'talk' | 'jolt'
function mood(it, m, ms) { if (!it || !it.kit) return; if (it.pending) build(it); if (m !== it.mood) setHead(it, m); it.st.until = ms ? performance.now() + ms : 0; }
function baseMood(it, m) { if (!it || !it.kit) return; if (it.pending) build(it); it.baseMood = m; if (!it.st.until && m !== it.mood) setHead(it, m); }
function react(it, kind, amount) { if (!it) return; const s = it.st; if (kind === 'nod') s.nod = 1; else if (kind === 'shake') s.shake = 1; else if (kind === 'talk') s.talk = Math.max(s.talk, amount || 1.6); else if (kind === 'jolt') s.jolt = 1; }
function gaze(it, x, y, ms) { if (!it) return; const s = it.st; if (!s.gaze) s.gaze = [0, 0]; s.gaze[0] = Math.max(-1, Math.min(1, x)); s.gaze[1] = Math.max(-1, Math.min(1, y)); s.gazeUntil = performance.now() + (ms || 1500); }
/* partículas: posições e brilho reescritos no lugar (sem alocar) */
function stepParticles(p, t, k) { const pos = p.geometry.attributes.position, col = p.geometry.attributes.color, a = pos.array, c = col.array, n = pos.count, src = p.userData.src, h = p.userData.h || 1, kind = p.userData.kind;
  for (let i = 0; i < n; i++) { const ph = hash3(i, 7, 3), sp = src[i % src.length]; let x, y, z, b;
    if (kind === 'fagulha') { const age = (t * (0.55 + ph * 0.5) + ph) % 1; x = sp[0] + Math.sin(t * 2.6 + i) * 0.05 * age + (ph - 0.5) * 0.12 * age; y = sp[1] + age * h; z = sp[2] + (hash3(i, 2, 9) - 0.5) * 0.12 * age; b = (1 - age) * (1 - age) * (0.6 + 0.4 * Math.sin(t * 19 + i * 3)); }
    else if (kind === 'faisca') { const cyc = (t * (1.3 + ph) + ph * 5) % 1; const j = Math.floor(t * (1.3 + ph) + ph * 5); x = sp[0] + (hash3(i, j, 1) - 0.5) * sp[3]; y = sp[1] + (hash3(i, j, 2) - 0.5) * sp[3] * 1.4; z = sp[2] + (hash3(i, j, 4) - 0.5) * sp[3] * 0.6; b = cyc < 0.22 ? (1 - cyc / 0.22) * 1.4 : 0; }
    else if (kind === 'orbita') { const an = t * (0.35 + ph * 0.3) + ph * 6.283; const r = sp[3] * (0.75 + 0.35 * hash3(i, 5, 5)); x = sp[0] + Math.cos(an) * r; y = sp[1] + Math.sin(an * 1.3 + ph * 4) * 0.35 + (hash3(i, 6, 6) - 0.5) * 0.8; z = sp[2] + Math.sin(an) * r * 0.6; b = 0.45 + 0.4 * Math.sin(t * 3 + i); }
    else { const age = (t * (0.08 + ph * 0.06) + ph) % 1; x = sp[0] + (hash3(i, 3, 3) - 0.5) * sp[3] + Math.sin(t * 0.7 + i) * 0.05; y = sp[1] + age * h; z = sp[2] + (hash3(i, 4, 4) - 0.5) * sp[3] * 0.6; b = Math.sin(age * Math.PI) * (0.5 + 0.3 * Math.sin(t * 2 + i)); }
    a[i * 3] = x; a[i * 3 + 1] = y; a[i * 3 + 2] = z; b *= k; c[i * 3] = b; c[i * 3 + 1] = b; c[i * 3 + 2] = b; }
  pos.needsUpdate = true; col.needsUpdate = true; }
function animate(it, now, dt) {
  const s = it.st, H = it.head, rig = H.rig, g = H.g, X = rig.X, still = it.still, t = still ? 0 : (now - it.t0) / 1000;
  if (s.until && now > s.until) { s.until = 0; if (it.mood !== it.baseMood) { setHead(it, it.baseMood); return animate(it, now, dt); } }
  /* olhar: alvo do ponteiro, ou espiadas ao acaso */
  if (!still) { s.nextGlance -= dt; if (s.gaze && now < s.gazeUntil) { s.lookT[0] = s.gaze[0]; s.lookT[1] = s.gaze[1]; } else if (s.nextGlance <= 0) { s.nextGlance = 1.8 + Math.random() * 3.5; if (Math.random() < 0.35) { s.lookT[0] = 0; s.lookT[1] = 0; } else { s.lookT[0] = (Math.random() - 0.5) * 1.4; s.lookT[1] = (Math.random() - 0.5) * 0.8; } } }
  const kl = still ? 1 : Math.min(1, dt * 7); s.look[0] += (s.lookT[0] - s.look[0]) * kl; s.look[1] += (s.lookT[1] - s.look[1]) * kl;
  /* piscar: as pálpebras descem; olhos sem pálpebra (fenda, cristal) achatam em y */
  if (!still) { s.nextBlink -= dt; if (s.nextBlink <= 0) { s.blink = 0.17; s.nextBlink = 2.2 + Math.random() * 3.8; if (Math.random() < 0.18) s.nextBlink = 0.25; } }
  let bc = 0; if (s.blink > 0) { bc = Math.sin(Math.PI * (1 - s.blink / 0.17)); s.blink -= dt; if (s.blink < 0) s.blink = 0; }
  const lidded = rig.lids.length > 0; for (let i = 0; i < rig.eyes.length; i++) { const e = rig.eyes[i], u = e.userData; e.scale.y = (u.baseScale || 1) * (lidded ? 1 : Math.max(0.08, 1 - bc * 0.94));
    if (u.slide) { u.slide.position.x = u.p0[0] + clamp(s.look[0], -1, 1) * u.lim; u.slide.position.y = u.p0[1] + clamp(s.look[1], -1, 1) * u.lim * 0.2; continue; } /* olho-fenda: o ponto de luz corre dentro da fenda */
    e.rotation.y = (u.by || 0) + s.look[0] * 0.45; e.rotation.x = (u.bx || 0) - s.look[1] * 0.35; }
  for (let i = 0; i < rig.lids.length; i++) { const l = rig.lids[i]; l.rotation.x = l.userData.up ? l.userData.k * bc : -l.userData.k * bc; }
  /* sobrancelhas acompanham a fala e um respiro */
  const tk = s.talk > 0 ? Math.sin(t * 9) : 0; for (let i = 0; i < rig.brows.length; i++) { const b = rig.brows[i]; b.rotation.z = b.userData.base + Math.sin(t * 1.3 + b.userData.side) * 0.025 + tk * 0.045 * b.userData.side; b.position.y = b.userData.y0 + (s.talk > 0 ? Math.max(0, tk) * 0.012 : 0) + s.jolt * 0.03; }
  /* fala */
  let open = 0; if (s.talk > 0) { s.talk -= dt; open = 0.5 + 0.5 * Math.abs(Math.sin(t * 17) * Math.sin(t * 7.3)); }
  if (rig.jaw) rig.jaw.rotation.x = rig.jaw.userData.base + open * (rig.jawK || 0.22) + (still ? 0 : Math.sin(t * 1.7) * 0.01);
  if (rig.mouth) { const target = 1 + open * (rig.mouthK == null ? (rig.jaw ? 0.15 : 0.7) : rig.mouthK); rig.mouth.scale.y = still ? 1 : rig.mouth.scale.y + (target - rig.mouth.scale.y) * Math.min(1, dt * 14); }
  /* cabeça (pivô do pescoço): postura do humor + olhar + aceno, negação e susto; a raiz respira e balança */
  if (s.nod > 0) s.nod = Math.max(0, s.nod - dt * 1.4); if (s.shake > 0) s.shake = Math.max(0, s.shake - dt * 1.3); if (s.jolt > 0) s.jolt = Math.max(0, s.jolt - dt * 2.2);
  const nod = s.nod > 0 ? Math.sin((1 - s.nod) * Math.PI * 4) * 0.2 * s.nod : 0, shake = s.shake > 0 ? Math.sin((1 - s.shake) * Math.PI * 5) * 0.28 * s.shake : 0, jolt = s.jolt * 0.12;
  const nb = rig.head.userData.base; const kp = still ? 1 : Math.min(1, dt * 5); s.pose[0] += (nb[0] - s.pose[0]) * kp; s.pose[1] += (nb[1] - s.pose[1]) * kp; s.pose[2] += (nb[2] - s.pose[2]) * kp;
  rig.head.rotation.x = s.pose[0] + Math.sin(t * 0.7) * 0.02 - s.look[1] * 0.1 + nod - jolt * 0.5 + (s.talk > 0 ? tk * 0.012 : 0);
  rig.head.rotation.y = s.pose[1] + s.look[0] * 0.2 + shake + Math.sin(t * 0.45) * 0.03; rig.head.rotation.z = s.pose[2] + Math.sin(t * 0.4) * 0.02;
  g.rotation.y = it.yaw + Math.sin(t * 0.5) * 0.035 + s.look[0] * 0.06; g.position.y = Math.sin(t * 1.6) * 0.012 + jolt * 0.2; rig.body.scale.y = 1 + Math.sin(t * 1.6) * 0.006;
  /* brilhos: a luz da partida (glowK) e o humor (X.glow) pesam nos emissivos da Raça */
  const kit = it.kit, gk = it.glowK || 1, mg = X.glow || 1; for (let i = 0; i < kit.glows.length; i++) { const m = kit.glows[i]; m.emissiveIntensity = m.userData.e0 * gk * (0.85 + 0.15 * mg); }
  for (let i = 0; i < kit.basics.length; i++) { const m = kit.basics[i]; if (m.userData.c0 && !m.isPointsMaterial) m.color.copy(m.userData.c0).multiplyScalar(gk * (0.9 + 0.1 * mg)); }
  if (rig.glow && rig.glow.material && rig.glow.material.emissiveIntensity != null) rig.glow.material.emissiveIntensity = rig.glow.material.userData.e0 * gk * mg * (1 + Math.sin(t * 2.2) * 0.1 + open * 0.25);
  if (rig.talkGlow) rig.talkGlow.emissiveIntensity = rig.talkGlow.userData.e0 * gk * mg * (0.9 + open * 0.6 + (still ? 0 : Math.sin(t * 5.3) * 0.08));
  if (rig.embers) for (let i = 0; i < rig.embers.length; i++) { const e = rig.embers[i]; e.material.emissiveIntensity = e.material.userData.e0 * gk * (0.75 + 0.25 * Math.sin(t * 7 + i * 3) + (still ? 0 : Math.random() * 0.15)); }
  if (rig.fronds) for (let i = 0; i < rig.fronds.length; i++) { const f = rig.fronds[i]; f.rotation.z = f.userData.tilt + Math.sin(t * 1.4 + i) * 0.07 + open * 0.03 * Math.sin(t * 9 + i); f.rotation.x = (f.userData.tx || 0) + Math.sin(t * 1.1 + i * 2) * 0.04; }
  if (rig.shards) for (let i = 0; i < rig.shards.length; i++) { const sh = rig.shards[i], p = sh.userData.p; sh.position.set(p[0] + Math.cos(t * 0.6 + i * 1.9) * 0.05, p[1] + Math.sin(t * 1.1 + i * 1.7) * 0.1, p[2]); sh.rotation.y = (sh.userData.ry || 0) + t * (0.4 + i * 0.1); }
  if (rig.mandibles) for (let i = 0; i < rig.mandibles.length; i++) { const m = rig.mandibles[i]; m.rotation.z = m.userData.rz + Math.sin(t * (s.talk > 0 ? 12 : 2.2) + i * Math.PI) * (s.talk > 0 ? 0.16 : 0.05) * (m.userData.side || 1); }
  if (rig.fins) for (let i = 0; i < rig.fins.length; i++) { const f = rig.fins[i]; f.rotation.y = (f.userData.ry || 0) + Math.sin(t * 1.7 + i) * 0.05 * (f.userData.side || 1); }
  if (rig.spin) for (let i = 0; i < rig.spin.length; i++) { const sp = rig.spin[i]; sp.rotation.z = (sp.userData.r0 || 0) + t * (sp.userData.w || 0.3); }
  if (rig.sway) for (let i = 0; i < rig.sway.length; i++) { const sw = rig.sway[i]; sw.rotation.x = (sw.userData.bx || 0) + Math.sin(t * 1.2 + i * 1.7) * (sw.userData.a || 0.05); sw.rotation.z = (sw.userData.bz || 0) + Math.sin(t * 0.9 + i) * (sw.userData.a || 0.05) * 0.6; }
  if (rig.sparks) for (let i = 0; i < rig.sparks.length; i++) if (rig.sparks[i].isPoints) stepParticles(rig.sparks[i], t + (still ? 0.37 : 0), gk);
  if (rig.auras) for (let i = 0; i < rig.auras.length; i++) { const a = rig.auras[i]; a.material.color.copy(a.material.userData.c0).multiplyScalar(gk * (0.75 + 0.25 * mg) * (1 + Math.sin(t * 2.2 + 1) * 0.08 + open * 0.2)); }
}
function loop() {
  if (raf) return;
  const step = now => { raf = 0; if (!items.length || !renderer) return;
    let built = false;
    for (let ii = items.length - 1; ii >= 0; ii--) { const it = items[ii]; if (!it) continue; /* 4.3e: de trás para a frente, sem copiar a lista a cada quadro (unmount tira do array) */
      if (!it.canvas.isConnected) { unmount(it); continue; }
      if (document.hidden || !it.canvas.offsetParent) continue;
      if (it.pending) { if (built) continue; try { build(it); } catch (e) { console.warn('[ARD] líder 3D (montagem):', e.message); unmount(it); continue; } built = true; }
      let fps = READ ? Math.min(it.fps, it.framing === 'hud' ? 20 : 12) : it.fps; if (it.cost > 30) fps = Math.min(fps, it.cost > 120 ? 2 : 6); /* 4.3e: GPU lenta (software): o busto baixa o ritmo sozinho e não segura o jogo */
      if (now - it.last < 1000 / fps) continue; const dt = Math.min(0.1, it.last ? (now - it.last) / 1000 : 0.016); it.last = now; const tc = performance.now();
      try { animate(it, now, dt);
        const w = it.canvas.width, h = it.canvas.height; const rw = Math.min(RES, w), rh = Math.min(RES, h); it.cam.aspect = rw / rh; it.cam.updateProjectionMatrix();
        renderer.toneMappingExposure = it.exposure || 1; renderer.setViewport(0, 0, rw, rh); renderer.setScissor(0, 0, rw, rh); renderer.setScissorTest(true); renderer.clear(); renderer.render(it.sc, it.cam);
        const ri = renderer.info.render; it.stats.tris = ri.triangles; it.stats.calls = ri.calls; it.n++;
        if (READ) copyPixels(it, rw, rh, w, h); else { it.ctx.clearRect(0, 0, w, h); it.ctx.drawImage(renderer.domElement, 0, RES - rh, rw, rh, 0, 0, w, h); }
        const c = performance.now() - tc; if (it.n > 3) it.cost = it.cost == null ? c : it.cost * 0.8 + c * 0.2; /* os primeiros quadros compilam shaders: não contam */
      } catch (e) { console.warn('[ARD] líder 3D:', e.message); unmount(it); }
    }
    if (items.length) raf = requestAnimationFrame(step); };
  raf = requestAnimationFrame(step);
}
/* arte 2D (tools/arte3d.html): pose de repouso de um busto montado fora do laço (partículas, auras e postura do humor no lugar) */
function restPose(b, yaw) { const it = { st: { look: [0, 0], lookT: [0, 0], nextBlink: 9, blink: 0, nod: 0, shake: 0, talk: 0, jolt: 0, until: 0, gaze: null, gazeUntil: 0, nextGlance: 9, pose: [0, 0, 0] }, head: b, kit: b.kit, still: true, yaw: yaw || 0, glowK: 1, mood: b.rig.mood, baseMood: b.rig.mood, t0: 0 }; animate(it, 0, 0); return b; }
function frameFor(race, framing) { const f = FR[race] || FR.vehnar, d = framing === 'arte' ? f.d * 1.12 : f.d, y = f.y - (framing === 'arte' ? 0.2 : 0); return { pos: [d * 0.12, y + 0.45, d], look: [0, y, 0] }; }
/* arte 2D (tools/arte3d.html): mesma luz de estúdio, num renderizador de fora */
function studioRig(scene, race) { const S = sceneFor(race); const it = { L: S.L, base: S.base, W: S.W, kit: null }; studio(it); for (const k in S.L) { scene.add(S.L[k]); } return S.L; }
/* diagnóstico: n renders seguidos do busto com sincronização (lê 1 pixel), em ms por render — custo de GPU de um busto */
function bench(it, n) { if (!it || !renderer) return null; if (it.pending) build(it); const gl = renderer.getContext(), px = new Uint8Array(4); const t0 = performance.now(); n = n || 10;
  for (let i = 0; i < n; i++) { animate(it, performance.now(), 0.04); renderer.toneMappingExposure = it.exposure || 1; renderer.setViewport(0, 0, RES, RES); renderer.setScissor(0, 0, RES, RES); renderer.setScissorTest(true); renderer.clear(); renderer.render(it.sc, it.cam); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); }
  return { ms: (performance.now() - t0) / n, tris: renderer.info.render.triangles, calls: renderer.info.render.calls, programs: renderer.info.programs ? renderer.info.programs.length : null }; }
ARD.leaders3d = { canUse, mount, unmount, stopAll, mood, baseMood, react, gaze, setLight, buildHead, newKit, studioRig, restPose, frameFor, envFor: rend => makeEnv(T(), rend), bench, EXPR, COL,
  info: () => renderer ? { programs: renderer.info.programs ? renderer.info.programs.length : null, items: items.length, stats: items.map(it => ({ race: it.race, mood: it.mood, tris: it.stats.tris, calls: it.stats.calls, ms: it.cost == null ? null : Math.round(it.cost * 10) / 10 })) } : null }; /* info: diagnóstico (4.3d; 4.3e: triângulos e chamadas por busto) */
})(globalThis.ARD = globalThis.ARD || {});
