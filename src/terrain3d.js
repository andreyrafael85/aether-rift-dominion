/* Aether Rift: Dominion — terreno esculpido (4.3c).
   Relevo em grade fina (dunas de areia e de neve, crateras, ondulação da tundra, cratera da Fenda em terraços e o abismo dela,
   monte sob as cordilheiras), biomas com borda orgânica (pesos por vértice deformados por ruído), oclusão de cavidade e
   curvatura calculadas do próprio relevo, texturas de detalhe geradas na GPU (ondulações de areia, cascalho, fendas, musgo,
   cinza, grão de rocha), material em camadas por bioma misturadas pela altura de cada camada, rocha com estratos nas encostas
   (projeção triplanar), brasa nas fendas do basalto perto da Fenda, paredões do abismo e cordilheira de mesas além do mapa com
   o mesmo material. Só visual: a simulação não muda. */
(function (ARD) {
'use strict';
const S = ARD.sim;
const TAU = Math.PI * 2;
function h2(ix, iy, s) { let n = (ix * 374761393 + iy * 668265263 + s * 1274126177) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); n ^= n >>> 16; return (n >>> 0) / 4294967296; }
const sm = t => t * t * (3 - 2 * t);
function vn(x, y, s) { const ix = Math.floor(x), iy = Math.floor(y); const fx = sm(x - ix), fy = sm(y - iy); const a = h2(ix, iy, s), b = h2(ix + 1, iy, s), c = h2(ix, iy + 1, s), d = h2(ix + 1, iy + 1, s); return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy; }
function fbm(x, y, oct, s) { let v = 0, a = 0.5, t = 0; for (let o = 0; o < oct; o++) { v += a * vn(x, y, s + o * 131); t += a; x = x * 2.03 + 17.13; y = y * 2.03 + 9.71; a *= 0.5; } return v / t; }
function sstep(a, b, x) { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
// paleta média de cada bioma (cor do chão para a bruma, o reflexo e o radar)
const BIO_MEAN = [[0.78, 0.83, 0.9], [0.6, 0.46, 0.32], [0.27, 0.3, 0.18], [0.16, 0.15, 0.16]];
const RIFT = { abyss: -235, rimR: 186, bowlR: 470, bowlD: 40 };

// ---------- relevo ----------
function build(sim, HN) {
  const W = S.WORLD, HS = W / (HN - 1), seed = sim.seed;
  const base = (x, y) => 0.6 * vn(x, y, seed) + 0.3 * vn(x * 2.1 + 7.3, y * 2.1 + 3.1, seed) + 0.1 * vn(x * 4.3 + 1.7, y * 4.3 + 9.2, seed); // o mesmo de antes: o desenho dos mapas continua
  const nucs = sim.players.map(p => S.nucleoOf(sim, p.id)).filter(Boolean);
  const rocks = sim.ents.filter(e => e.alive && e.kind === 'rock'), nodes = sim.ents.filter(e => e.alive && e.kind === 'node');
  const RC = 64, RN = Math.ceil(W / RC) + 1, rgrid = new Map(); for (const r of rocks) { const k = ((r.x / RC) | 0) + ((r.y / RC) | 0) * RN; (rgrid.get(k) || rgrid.set(k, []).get(k)).push(r); }
  // crateras de meteoro: longe de Núcleos, nós, rochas, Fenda, bordas e umas das outras
  const craters = []; { let s = (seed * 7919 + 104729) >>> 0; const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
    for (let k = 0; k < 220 && craters.length < 24; k++) { const r = 24 + rnd() * rnd() * 86; const x = rnd() * W, y = rnd() * W;
      if (x < r + 110 || y < r + 110 || x > W - r - 110 || y > W - r - 110) continue; if (Math.hypot(x - S.CX, y - S.CY) < r + 520) continue;
      if (nucs.some(n => Math.hypot(x - n.x, y - n.y) < r + 430) || nodes.some(n => Math.hypot(x - n.x, y - n.y) < r + 70) || rocks.some(o => Math.hypot(x - o.x, y - o.y) < r + 60) || craters.some(c => Math.hypot(x - c.x, y - c.y) < r + c.r + 50)) continue;
      craters.push({ x, y, r, d: Math.min(10, r * 0.13), rim: Math.min(4.5, r * 0.055) }); } }
  // pesos de bioma por vértice: interpolação entre centros de tile com o ponto deslocado por ruído (borda orgânica, não quadrada)
  const TILE = 64, TL = W / TILE, tileW = new Float32Array(TL * TL * 4);
  for (let i = 0; i < TL * TL; i++) { const m = sim.biomeMix[i]; tileW[i * 4 + sim.biome[i]] += 1 - m; tileW[i * 4 + sim.biome2[i]] += m; }
  const bioAt = (x, y, out) => {
    const wx = x + (fbm(x / 260, y / 260, 3, seed + 7) - 0.5) * 160, wy = y + (fbm(x / 260 + 5.2, y / 260 + 1.3, 3, seed + 11) - 0.5) * 160;
    const gx = Math.max(0, Math.min(TL - 1.001, wx / TILE - 0.5)), gy = Math.max(0, Math.min(TL - 1.001, wy / TILE - 0.5)); const ix = gx | 0, iy = gy | 0, fx = sm(gx - ix), fy = sm(gy - iy);
    for (let c = 0; c < 4; c++) { const a = tileW[(iy * TL + ix) * 4 + c], b = tileW[(iy * TL + ix + 1) * 4 + c], d = tileW[((iy + 1) * TL + ix) * 4 + c], e = tileW[((iy + 1) * TL + ix + 1) * 4 + c]; out[c] = (a * (1 - fx) + b * fx) * (1 - fy) + (d * (1 - fx) + e * fx) * fy; }
  };
  const heights = new Float32Array(HN * HN), bio = new Float32Array(HN * HN * 4), bw = [0, 0, 0, 0];
  const CIN = !!(sim.map && sim.map.type === 'cinturao' && S.mapSd), VOID_H = -320; /* 4.3h: no Cinturão o chão acaba num paredão sobre o espaço */
  for (let iy = 0; iy < HN; iy++) for (let ix = 0; ix < HN; ix++) {
    const x = ix * HS, y = iy * HS, i = iy * HN + ix;
    let h = (base(x / 520, y / 520) - 0.5) * 36 + (base(x / 110, y / 110) - 0.5) * 7;
    bioAt(x, y, bw); for (let c = 0; c < 4; c++) bio[i * 4 + c] = bw[c];
    // dunas: areia no deserto de pedra, neve no gelo; sobe devagar a barlavento e cai rápido a sotavento
    const duneK = bw[1] + bw[0] > 0.01 ? (bw[1] + bw[0] * 0.7) * sstep(0.44, 0.6, fbm(x / 720, y / 720, 2, seed + 23)) : 0; if (duneK > 0.01) { const t = (x * 0.94 + y * 0.34) / 112 + (fbm(x / 250, y / 250, 3, seed + 29) - 0.5) * 2.4; const f = t - Math.floor(t); const pr = f < 0.76 ? sm(f / 0.76) : 1 - sm((f - 0.76) / 0.24); h += duneK * (pr - 0.5) * 8; }
    if (bw[2] > 0.01) h += bw[2] * (fbm(x / 170, y / 170, 3, seed + 31) - 0.5) * 7; // ondulação da tundra
    { /* leitos secos (uádis): curvas de nível de um ruído deformado, rasos e com margem suave; areia e cascalho no fundo pela curvatura */
      const wv = fbm(x / 1050 + (fbm(x / 380, y / 380, 2, seed + 103) - 0.5) * 0.9, y / 1050 + (fbm(x / 380 + 4.1, y / 380 + 7.7, 2, seed + 107) - 0.5) * 0.9, 3, seed + 101); const ch = 1 - Math.abs(wv - 0.5) * 2;
      const bed = sstep(0.93, 0.985, ch); if (bed > 0) h -= bed * 5.5 * (bw[1] + bw[2] * 0.85 + bw[0] * 0.55); }
    { /* degraus de estrato no deserto de pedra: patamares baixos (3,5) que a luz rasante desenha */
      const tk = bw[1] > 0.01 ? bw[1] * sstep(0.5, 0.62, fbm(x / 640 + 3.3, y / 640 + 1.9, 2, seed + 109)) : 0; if (tk > 0.01) { const st = 3.5, v = h / st, f = v - Math.floor(v); h = h * (1 - tk) + st * (Math.floor(v) + sstep(0.62, 0.92, f)) * tk; } }
    if (bw[0] > 0.01) h += bw[0] * (fbm(x / 90, y / 90, 2, seed + 37) - 0.5) * 2.5; // montinhos de neve
    for (const c of craters) { const q = Math.hypot(x - c.x, y - c.y) / c.r; if (q < 1.7) h += q < 1 ? c.d * (q * q - 1) + c.rim * q * q * q * q : c.rim * Math.exp(-(((q - 1) / 0.32) ** 2)); }
    // Fenda: abismo intransponível, paredão e cratera em terraços (onde as unidades andam a encosta é suave)
    const dr = Math.hypot(x - S.CX, y - S.CY); if (dr < 560) { const ang = Math.atan2(y - S.CY, x - S.CX); const r = dr + riftJag(ang, seed);
      const q = Math.max(0, Math.min(1, (r - RIFT.rimR) / (RIFT.bowlR - RIFT.rimR))); const qs = (Math.floor(q * 7) + sstep(0.58, 0.9, q * 7 - Math.floor(q * 7))) / 7; const qq = q * 0.35 + qs * 0.65;
      let ch = -RIFT.bowlD * Math.pow(1 - qq, 1.35) + 3.5 * Math.exp(-(((r - RIFT.bowlR) / 34) ** 2)) + (fbm(x / 60, y / 60, 2, seed + 43) - 0.5) * 3 * (1 - q);
      if (r < RIFT.rimR + 2) ch = -RIFT.bowlD + (RIFT.abyss + RIFT.bowlD) * sstep(RIFT.rimR + 2, RIFT.rimR - 30, r) + (fbm(x / 40, y / 40, 2, seed + 47) - 0.5) * 12 * sstep(RIFT.rimR - 10, RIFT.rimR - 60, r);
      h = h + (ch - h * 0.6) * sstep(560, 470, dr); }
    // cordilheiras: monte sob as rochas (as rochas esculpidas da 4.3b assentam nele; até ~44 de altura)
    const kx = (x / RC) | 0, ky = (y / RC) | 0; for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) { const L = rgrid.get((kx + ox) + (ky + oy) * RN); if (L) for (const r of L) { const dd = Math.hypot(x - r.x, y - r.y); if (dd < 60) h += 26 * (1 - dd / 60) * (1 - dd / 60); } }
    if (CIN) { const sd = S.mapSd(sim, x, y); if (sd < 6) { const k = sstep(6, -28, sd); h = h * (1 - k) + VOID_H * k; } else if (sd < 16) h -= (16 - sd) * 0.14; } /* borda chanfrada e paredão até o vazio */
    heights[i] = h;
  }
  const Hb = (x, y) => { const gx = Math.max(0, Math.min(HN - 1.001, x / HS)), gy = Math.max(0, Math.min(HN - 1.001, y / HS)); const ix = gx | 0, iy = gy | 0, fx = gx - ix, fy = gy - iy; return (heights[iy * HN + ix] * (1 - fx) + heights[iy * HN + ix + 1] * fx) * (1 - fy) + (heights[(iy + 1) * HN + ix] * (1 - fx) + heights[(iy + 1) * HN + ix + 1] * fx) * fy; };
  // bases planas em volta dos Núcleos (como antes) e chão assentado sob os nós
  for (const n of nucs) { const hn = Hb(n.x, n.y); const g0 = Math.max(0, ((n.x - 400) / HS) | 0), g1 = Math.min(HN - 1, Math.ceil((n.x + 400) / HS)), j0 = Math.max(0, ((n.y - 400) / HS) | 0), j1 = Math.min(HN - 1, Math.ceil((n.y + 400) / HS));
    for (let iy = j0; iy <= j1; iy++) for (let ix = g0; ix <= g1; ix++) { const d = Math.hypot(ix * HS - n.x, iy * HS - n.y); if (d < 400) { const k = d < 300 ? 1 : sm(1 - (d - 300) / 100); heights[iy * HN + ix] = heights[iy * HN + ix] * (1 - k) + hn * k; } } }
  for (const n of nodes) { const hn = Hb(n.x, n.y); const R0 = 46; const g0 = Math.max(0, ((n.x - R0) / HS) | 0), g1 = Math.min(HN - 1, Math.ceil((n.x + R0) / HS)), j0 = Math.max(0, ((n.y - R0) / HS) | 0), j1 = Math.min(HN - 1, Math.ceil((n.y + R0) / HS));
    for (let iy = j0; iy <= j1; iy++) for (let ix = g0; ix <= g1; ix++) { const d = Math.hypot(ix * HS - n.x, iy * HS - n.y); if (d < R0) { const k = 0.7 * sm(1 - d / R0); heights[iy * HN + ix] = heights[iy * HN + ix] * (1 - k) + hn * k; } } }
  // 4.3h: lagos — o nível da água é o ponto mais baixo da margem (nunca transborda) e a bacia é escavada abaixo dele
  const lakes = ((sim.map && sim.map.lakes) || []).map(k => Object.assign({}, k));
  for (const k of lakes) { let lv = Infinity; for (let a = 0; a < 32; a++) { const ang = a / 32 * TAU, rr = S.edgeR(k.r, ang, k.seed); lv = Math.min(lv, Hb(k.x + Math.cos(ang) * rr, k.y + Math.sin(ang) * rr)); } k.level = lv - (k.kind === 'plasma' ? 1.6 : 0.5); const depth = k.kind === 'plasma' ? 9 : 2.5, R = k.r * 1.5;
    const g0 = Math.max(0, ((k.x - R) / HS) | 0), g1 = Math.min(HN - 1, Math.ceil((k.x + R) / HS)), j0 = Math.max(0, ((k.y - R) / HS) | 0), j1 = Math.min(HN - 1, Math.ceil((k.y + R) / HS));
    for (let iy = j0; iy <= j1; iy++) for (let ix = g0; ix <= g1; ix++) { const dx = ix * HS - k.x, dy = iy * HS - k.y, sd = S.edgeR(k.r, Math.atan2(dy, dx), k.seed) - Math.hypot(dx, dy); if (sd < -12) continue; const i = iy * HN + ix; if (sd < -1 && k.kind === 'plasma') heights[i] = Math.max(heights[i], k.level + 1.2 * sstep(-12, -5, sd)); /* dique de lava solidificada: a borda nunca fica abaixo do nível */ if (sd < -4) continue; heights[i] = Math.min(heights[i], k.level + 0.8 - (depth + 0.8) * sstep(-4, 16, sd)); } }
  // oclusão de cavidade (horizonte médio em 8 direções) e curvatura (+ bacia, − crista)
  const aoc = new Float32Array(HN * HN * 2); const HH = (gx, gy) => heights[Math.max(0, Math.min(HN - 1, gy)) * HN + Math.max(0, Math.min(HN - 1, gx))];
  const steps = [1, 2, 4, 7, 11]; const dirs = []; for (let k = 0; k < 8; k++) dirs.push([Math.cos(k / 8 * TAU), Math.sin(k / 8 * TAU)]);
  for (let iy = 0; iy < HN; iy++) for (let ix = 0; ix < HN; ix++) { const i = iy * HN + ix, h0 = heights[i]; let occ = 0;
    for (const [cx, cy] of dirs) { let mx = 0; for (const s of steps) { const sl = (HH(Math.round(ix + cx * s), Math.round(iy + cy * s)) - h0) / (s * HS); if (sl > mx) mx = sl; } occ += mx / Math.sqrt(1 + mx * mx); }
    aoc[i * 2] = Math.max(0.25, 1 - 0.85 * occ / 8);
    const lap = (HH(ix - 2, iy) + HH(ix + 2, iy) + HH(ix, iy - 2) + HH(ix, iy + 2) - 4 * h0) / (4 * HS * HS); aoc[i * 2 + 1] = Math.max(-1, Math.min(1, lap * 70)); }
  let mr = 0, mg = 0, mb = 0; for (let i = 0; i < HN * HN; i++) { const t = bio[i * 4] + bio[i * 4 + 1] + bio[i * 4 + 2] + bio[i * 4 + 3] || 1; for (let c = 0; c < 4; c++) { const w = bio[i * 4 + c] / t; mr += w * BIO_MEAN[c][0]; mg += w * BIO_MEAN[c][1]; mb += w * BIO_MEAN[c][2]; } }
  const n2 = HN * HN; return { HN, HS, heights, bio, aoc, craters, bioAt, mean: [mr / n2, mg / n2, mb / n2], lakes, voidH: CIN ? VOID_H : null };
}
function riftJag(ang, seed) { return (fbm(Math.cos(ang) * 2.6 + 11, Math.sin(ang) * 2.6 + 4, 3, seed + 41) - 0.5) * 30 + (fbm(Math.cos(ang) * 9 + 3, Math.sin(ang) * 9 + 7, 2, seed + 53) - 0.5) * 10; }

// geometria em grade: só as células em que keep(x, y) é verdadeiro; posições em coordenadas do three (x, h, −y)
function gridGeo(THREE, x0, y0, nx, ny, cell, hAt, bioAt, keep, aocAt) {
  const nv = (nx + 1) * (ny + 1), pos = new Float32Array(nv * 3), bio = new Float32Array(nv * 4), aoc = new Float32Array(nv * 2), bw = [0, 0, 0, 0], used = new Uint8Array(nv);
  const idx = []; for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const x = x0 + (i + 0.5) * cell, y = y0 + (j + 0.5) * cell; if (!keep(x, y)) continue; const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1; idx.push(a, b, c, b, d, c); used[a] = used[b] = used[c] = used[d] = 1; }
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) { const v = j * (nx + 1) + i, x = x0 + i * cell, y = y0 + j * cell; pos[v * 3] = x; pos[v * 3 + 2] = -y; if (!used[v]) continue; pos[v * 3 + 1] = hAt(x, y); bioAt(x, y, bw); for (let c = 0; c < 4; c++) bio[v * 4 + c] = bw[c]; if (aocAt) aocAt(x, y, aoc, v); else { aoc[v * 2] = 1; aoc[v * 2 + 1] = 0; } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('bio', new THREE.BufferAttribute(bio, 4)); g.setAttribute('aoc', new THREE.BufferAttribute(aoc, 2));
  g.setIndex(nv > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1)); g.computeVertexNormals(); g.computeBoundingSphere(); return g;
}

// malha do mapa jogável direto das grades calculadas em build() (sem recalcular ruído)
function mapGeo(THREE, T) {
  const HN = T.HN, HS = T.HS, nv = HN * HN, pos = new Float32Array(nv * 3);
  for (let j = 0; j < HN; j++) for (let i = 0; i < HN; i++) { const v = j * HN + i; pos[v * 3] = i * HS; pos[v * 3 + 1] = T.heights[v]; pos[v * 3 + 2] = -j * HS; }
  const idx = new Uint32Array((HN - 1) * (HN - 1) * 6); let k = 0; for (let j = 0; j < HN - 1; j++) for (let i = 0; i < HN - 1; i++) { const a = j * HN + i, b = a + 1, c = a + HN, d = c + 1; idx[k++] = a; idx[k++] = b; idx[k++] = c; idx[k++] = b; idx[k++] = d; idx[k++] = c; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('bio', new THREE.BufferAttribute(T.bio, 4)); g.setAttribute('aoc', new THREE.BufferAttribute(T.aoc, 2)); g.setIndex(new THREE.BufferAttribute(idx, 1)); g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(nv * 3), 3)); refresh(T, g, 0, HN - 1, 0, HN - 1); g.attributes.position.clearUpdateRanges(); g.attributes.normal.clearUpdateRanges(); g.computeBoundingSphere(); return g;
}

// ---------- texturas de detalhe (geradas uma vez na GPU, repetíveis, com mipmaps) ----------
const GEN_FS = `uniform float uWhich; varying vec2 vUv;
float hs(vec2 p){ p = fract(p * vec2(0.1031, 0.1030)); p += dot(p, p.yx + 33.33); return fract((p.x + p.y) * p.x); }
vec2 hs2(vec2 p){ vec3 q = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); q += dot(q, q.yzx + 33.33); return fract((q.xx + q.yz) * q.zy); }
float vno(vec2 p, float P){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f); float a = hs(mod(i, P)), b = hs(mod(i + vec2(1.0, 0.0), P)), c = hs(mod(i + vec2(0.0, 1.0), P)), d = hs(mod(i + vec2(1.0, 1.0), P)); return mix(mix(a, b, u.x), mix(c, d, u.x), u.y); }
float fbm(vec2 p, float P, int oct){ float v = 0.0, a = 0.5, t = 0.0; for (int o = 0; o < 6; o++) { if (o >= oct) break; v += a * vno(p, P); t += a; p *= 2.0; P *= 2.0; a *= 0.5; } return v / t; }
vec3 voro(vec2 p, float P){ vec2 i = floor(p), f = fract(p); float f1 = 9.0, f2 = 9.0, id = 0.0; for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) { vec2 g = vec2(float(x), float(y)); vec2 c = mod(i + g, P); vec2 r = g + hs2(c) - f; float d = dot(r, r); if (d < f1) { f2 = f1; f1 = d; id = hs(c + 7.0); } else if (d < f2) f2 = d; } return vec3(sqrt(f1), sqrt(f2), id); }
void main(){ vec2 p = vUv;
  if (uWhich < 0.5) {
    float w = fbm(p * 4.0, 4.0, 3); float t = (p.y + (w - 0.5) * 0.1) * 36.0; float fr = fract(t); float rip = fr < 0.7 ? smoothstep(0.0, 0.7, fr) : 1.0 - smoothstep(0.7, 1.0, fr); rip = mix(rip, fbm(p * 64.0, 64.0, 2), 0.18);
    vec3 v = voro(p * 20.0, 20.0); float peb = (1.0 - smoothstep(0.0, 0.5 + 0.28 * v.z, v.x)) * (0.55 + 0.45 * v.z); vec3 v3 = voro(p * 44.0, 44.0); peb = max(peb, (1.0 - smoothstep(0.0, 0.42, v3.x)) * 0.55 * step(0.35, v3.z));
    vec3 v2 = voro(p * 6.0, 6.0); float crack = 1.0 - smoothstep(0.0, 0.07, v2.y - v2.x); crack *= 0.6 + 0.4 * fbm(p * 24.0, 24.0, 2);
    float soft = fbm(p * 8.0, 8.0, 5);
    gl_FragColor = vec4(rip, peb, crack, soft);
  } else {
    float m = fbm(p * 10.0, 10.0, 4); float tuft = smoothstep(0.42, 0.72, m); vec3 vv = voro(p * 52.0, 52.0); float dots = (1.0 - smoothstep(0.0, 0.38, vv.x)) * step(0.5, vv.z); float moss = clamp(tuft * 0.75 + dots * 0.45 + fbm(p * 96.0, 96.0, 2) * 0.2, 0.0, 1.0);
    float ash = fbm(p * 64.0, 64.0, 3) * 0.55 + fbm(p * 12.0, 12.0, 4) * 0.45;
    float rg = 1.0 - abs(fbm(p * 10.0, 10.0, 5) * 2.0 - 1.0); rg = rg * rg * 0.7 + fbm(p * 48.0, 48.0, 3) * 0.3;
    float macro = fbm(p * 3.0, 3.0, 5);
    gl_FragColor = vec4(moss, ash, rg, macro);
  } }`;
function detailTextures(THREE, renderer) {
  const N = 512; const mk = () => { const rt = new THREE.WebGLRenderTarget(N, N, { type: THREE.UnsignedByteType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, wrapS: THREE.RepeatWrapping, wrapT: THREE.RepeatWrapping, depthBuffer: false }); rt.texture.colorSpace = THREE.NoColorSpace; return rt; };
  const scene = new THREE.Scene(), cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const mat = new THREE.ShaderMaterial({ uniforms: { uWhich: { value: 0 } }, vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }', fragmentShader: GEN_FS, depthTest: false, depthWrite: false });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat); quad.frustumCulled = false; scene.add(quad);
  const a = mk(), b = mk(), prev = renderer.getRenderTarget();
  mat.uniforms.uWhich.value = 0; renderer.setRenderTarget(a); renderer.render(scene, cam);
  mat.uniforms.uWhich.value = 1; renderer.setRenderTarget(b); renderer.render(scene, cam);
  renderer.setRenderTarget(prev); quad.geometry.dispose(); mat.dispose();
  return { a: a.texture, b: b.texture, rts: [a, b] };
}

// ---------- material em camadas (MeshStandardMaterial + remendos de shader) ----------
// uniforms compartilhados com o render3d: fogMap, terrMap, cloudMap, microMap, uNear, uCloudT, uCloudK (como no terreno antigo)
const TERR_PARS = `uniform sampler2D uTexA; uniform sampler2D uTexB; uniform sampler2D fogMap; uniform sampler2D terrMap; uniform sampler2D cloudMap; uniform sampler2D microMap;
uniform sampler2D scarMap; uniform float uNear; uniform float uCloudT; uniform float uCloudK; uniform float uTime; uniform vec2 uRift; uniform float worldSize;
varying vec4 vBio; varying vec2 vAoc; varying vec3 vWP; varying vec3 vWN; varying vec2 vWuv;
vec3 ardTPerturb(vec3 sp, vec3 sn, vec2 dh, float fd) { vec3 sx = dFdx(sp), sy = dFdy(sp); sx *= inversesqrt(max(dot(sx, sx), 1e-24)); sy *= inversesqrt(max(dot(sy, sy), 1e-24)); vec3 r1 = cross(sy, sn), r2 = cross(sn, sx); float det = dot(sx, r1) * fd; vec3 g = sign(det) * (dh.x * r1 + dh.y * r2); vec3 n = abs(det) * sn - g; float l = dot(n, n); return l > 1e-12 ? n * inversesqrt(l) : sn; } /* 4.3g: sem normalize de vetor nulo (NaN) — o terreno cobre a tela de perto */
#ifdef ARD_VAZIO
uniform sampler2D uVoidMap; /* 4.3h: R = distância com sinal até o vazio (±64), G = ponte */
#endif
vec4 ardHB(vec4 h, vec4 w) { vec4 s = (h + w * 1.6) * step(0.001, w); float m = max(max(s.x, s.y), max(s.z, s.w)) - 0.22; vec4 k = max(s - m, 0.0); return k / max(0.0001, k.x + k.y + k.z + k.w); }
`;
const TERR_COLOR = `
float tRough = 0.9, tH = 0.0; vec3 tEmis = vec3(0.0);
{
  vec2 gp = vec2(vWP.x, -vWP.z); float vd = length(vViewPosition); float nearK = 1.0 - smoothstep(260.0, 1300.0, vd);
  vec4 Bw = vBio / max(0.0001, vBio.x + vBio.y + vBio.z + vBio.w);
  vec3 wn = normalize(vWN); float slope = 1.0 - clamp(wn.y, 0.0, 1.0); float cav = vAoc.y;
  vec4 Bk0 = texture2D(uTexB, gp / 310.0 + 0.53); vec2 wr = mat2(0.94, -0.34, 0.34, 0.94) * gp + (Bk0.rg - 0.5) * 7.0;
  /* escalas em unidades do mapa: ondulação ~2,6 (90/36), seixo ~1,5, fenda ~5, tufo ~3 */
  vec4 Ar = texture2D(uTexA, wr / 94.0), Ap = texture2D(uTexA, gp / 31.0 + 0.21), As = texture2D(uTexA, gp / 150.0 + 0.37), Bt = texture2D(uTexB, gp / 34.0), Bm = texture2D(uTexB, gp / 1900.0 + 0.11), Bk = Bk0, Bt2 = texture2D(uTexB, mat2(0.6, -0.8, 0.8, 0.6) * gp / 91.0 + 0.41);
  float macro = Bm.a, mid = Bk.a;
  float fk = 0.35 + 0.65 * nearK; float hSand = mix(As.r, Ar.r * 0.75 + As.r * 0.25, fk), hGrav = mix(As.a, Ap.g, fk), hCrk = Ap.b * fk, hSnow = As.a * 0.7 + Ap.a * 0.3, hMoss = mix(Bt2.r, Bt.r * 0.55 + Bt2.r * 0.45, fk) * (0.75 + 0.5 * Bk.r), hAsh = mix(Bt2.g, Bt.g, fk), soft = As.a;
  float band = vWP.y / 3.4 + (Bm.r - 0.5) * 1.4 + (soft - 0.5) * 0.5; float bi = floor(band), bf = fract(band); float bt = fract(sin(bi * 12.9898 + 78.233) * 43758.5453);
  #ifdef ARD_LEVE
  float gr = texture2D(uTexB, gp / 40.0).b;
  #else
  vec3 an = abs(wn); an = an / (an.x + an.y + an.z);
  float gr = texture2D(uTexB, vWP.zy / 40.0).b * an.x + texture2D(uTexB, vWP.xz / 40.0).b * an.y + texture2D(uTexB, vWP.xy / 40.0).b * an.z;
  #endif
  float ledge = smoothstep(0.0, 0.1, bf) * (1.0 - smoothstep(0.82, 1.0, bf));
  #ifdef ARD_LEVE
  float streak = 1.0;
  #else
  float streak = 0.8 + 0.34 * (texture2D(uTexB, vec2(vWP.z / 37.0, vWP.y / 210.0)).a * an.x + texture2D(uTexB, vec2(vWP.x / 37.0, vWP.y / 210.0) + 0.3).a * an.z + 0.5 * an.y);
  #endif
  float hRock = 0.45 + 0.35 * gr + 0.2 * ledge;
  float rk = smoothstep(0.15, 0.38, slope + max(0.0, -cav) * 0.16 + (macro - 0.5) * 0.12);
  vec3 alb = vec3(0.0); float rough = 0.0, hgt = 0.0;
  /* alturas do relevo fino em unidades do mapa (para o relevo por derivada): areia 0,22, seixo 0,45, rocha 0,7, neve 0,15, musgo 0,25, cinza 0,15, fenda −0,3 */
  /* gelo: neve, gelo liso nas baixadas, rocha azulada nas encostas */
  if (Bw.x > 0.001) { vec2 ws = mat2(0.94, -0.34, 0.34, 0.94) * gp; float sas = texture2D(uTexA, vec2(ws.x / 260.0, ws.y / 46.0) + 0.17).a; float rpG = smoothstep(0.6, 0.7, mid) * 0.85;
    vec4 k = ardHB(vec4(hSnow * 0.6 + sas * 0.4, soft * 0.5 + 0.2, hRock, 0.0), vec4(1.0, smoothstep(0.12, 0.5, cav + (mid - 0.5) * 0.5) * 0.9, max(rk, rpG) * 1.2, 0.0));
    vec3 snow = mix(vec3(0.42, 0.5, 0.63), vec3(0.74, 0.79, 0.86), hSnow * 0.45 + sas * 0.35 + Ar.r * 0.2 * fk) * mix(vec3(1.0), vec3(0.72, 0.84, 1.08), clamp(cav * 1.6 + (1.0 - vAoc.x) * 2.0, 0.0, 1.0)); vec3 ice = mix(vec3(0.38, 0.52, 0.66), vec3(0.6, 0.73, 0.84), soft); vec3 rock = mix(vec3(0.2, 0.23, 0.28), vec3(0.36, 0.4, 0.46), bt) * (0.72 + 0.4 * gr) * streak;
    alb += Bw.x * (k.x * snow + k.y * ice + k.z * rock); rough += Bw.x * dot(k, vec4(0.62, 0.2, 0.86, 0.0)); hgt += Bw.x * dot(k, vec4(hSnow * 0.1 + sas * 0.35 + Ar.r * 0.16 * fk, 0.03, hRock * 0.7, 0.0)); }
  /* rocha: deserto de pedra quente, areia nas baixadas e dunas, cascalho, placas e paredões de rocha estratificada */
  if (Bw.y > 0.001) { float rp = smoothstep(0.64, 0.74, mid) * 0.7; vec4 k = ardHB(vec4(hSand, hGrav, hRock, soft), vec4(0.35 + smoothstep(-0.15, 0.35, cav) * 0.65, 0.5 * (1.0 - smoothstep(0.05, 0.4, cav)) + smoothstep(0.55, 0.7, Bk.g) * 0.4, max(rk, rp) * 1.2, 0.25));
    vec3 sand = mix(vec3(0.5, 0.36, 0.22), vec3(0.78, 0.62, 0.42), As.r * 0.55 + soft * 0.25 + 0.1) * (0.9 + 0.2 * macro) * (0.93 + 0.12 * Ar.r * fk); vec3 grav = mix(vec3(0.36, 0.27, 0.19), vec3(0.64, 0.52, 0.39), hGrav); vec3 rock = mix(vec3(0.42, 0.26, 0.17), vec3(0.66, 0.5, 0.36), bt) * (0.7 + 0.42 * gr) * streak; vec3 dirt = mix(vec3(0.34, 0.26, 0.19), vec3(0.5, 0.4, 0.3), soft) * (1.0 - 0.3 * hCrk);
    alb += Bw.y * (k.x * sand + k.y * grav + k.z * rock + k.w * dirt); rough += Bw.y * dot(k, vec4(0.92, 0.88, 0.84, 0.94)); hgt += Bw.y * dot(k, vec4(Ar.r * 0.28 * fk + As.r * 0.1, hGrav * 0.45, hRock * 0.7, soft * 0.1 - hCrk * 0.3)); }
  /* tundra: musgo e capim baixo, terra nas baixadas, cascalho, rocha nas encostas */
  if (Bw.z > 0.001) { vec4 k = ardHB(vec4(hMoss, soft, hGrav, hRock), vec4(0.85 * (1.0 - smoothstep(0.15, 0.5, cav)) * (0.65 + 0.35 * mid), 0.25 + smoothstep(0.0, 0.4, cav) * 0.7, smoothstep(0.6, 0.72, Bk.g) * 0.5, rk * 1.2));
    vec3 moss = mix(vec3(0.095, 0.125, 0.06), vec3(0.205, 0.235, 0.115), hMoss) * mix(vec3(1.0), vec3(1.12, 1.0, 0.72), smoothstep(0.55, 0.8, macro)); vec3 dirt = mix(vec3(0.22, 0.17, 0.12), vec3(0.36, 0.29, 0.21), soft) * (1.0 - 0.3 * hCrk); vec3 grav = mix(vec3(0.25, 0.24, 0.22), vec3(0.47, 0.45, 0.41), hGrav); vec3 rock = mix(vec3(0.26, 0.25, 0.23), vec3(0.44, 0.42, 0.38), bt) * (0.72 + 0.4 * gr) * streak;
    alb += Bw.z * (k.x * moss + k.y * dirt + k.z * grav + k.w * rock); rough += Bw.z * dot(k, vec4(0.95, 0.93, 0.86, 0.85)); hgt += Bw.z * dot(k, vec4(hMoss * 0.25, soft * 0.1 - hCrk * 0.25, hGrav * 0.45, hRock * 0.7)); }
  /* basalto: cinza, rocha negra, lascas de obsidiana e fendas em brasa perto da Fenda */
  if (Bw.w > 0.001) { vec4 k = ardHB(vec4(hAsh, hRock, hGrav, 0.0), vec4(0.85, rk * 1.3 + smoothstep(0.6, 0.7, mid) * 0.5, 0.35 * smoothstep(0.4, 0.7, Bk.g), 0.0));
    vec3 ash = mix(vec3(0.028, 0.026, 0.03), vec3(0.075, 0.068, 0.074), hAsh); vec3 rock = mix(vec3(0.022, 0.02, 0.026), vec3(0.07, 0.06, 0.068), bt) * (0.7 + 0.5 * gr); vec3 obs = vec3(0.016, 0.016, 0.024);
    alb += Bw.w * (k.x * ash + k.y * rock + k.z * obs); rough += Bw.w * dot(k, vec4(0.96, 0.8, 0.22, 0.0)); hgt += Bw.w * dot(k, vec4(hAsh * 0.15, hRock * 0.7, hGrav * 0.4, 0.0));
    #ifndef ARD_FORA
    float rd = length(gp - uRift); float rift = 1.0 - smoothstep(260.0, 640.0, rd); float cw = As.b; float ck = smoothstep(0.62, 0.92, cw) * smoothstep(0.52, 0.68, mid) * rift * (1.0 - smoothstep(0.1, 0.28, slope)) * (0.6 + 0.4 * Bk.r); /* fendas largas (~25 de célula), só em manchas e no chão plano: brasa em veios, sem ladrilho */ float pulse = 0.65 + 0.35 * sin(uTime * 1.3 + gp.x * 0.013 + gp.y * 0.017);
    tEmis += Bw.w * vec3(1.15, 0.28, 0.7) * ck * pulse * 1.15; alb *= 1.0 - Bw.w * ck * 0.45;
    #endif
  }
  /* abismo da Fenda: as paredes fundas recebem a luz que sobe lá de baixo */
  #ifndef ARD_FORA
  { float deep = smoothstep(-80.0, -225.0, vWP.y) * (1.0 - smoothstep(230.0, 300.0, length(gp - uRift))); float fl = 0.6 + 0.4 * sin(uTime * 0.9 + vWP.y * 0.05 + gp.x * 0.02); float vein = smoothstep(0.6, 0.9, Bk.b) + 0.3 * smoothstep(0.6, 0.9, As.b); tEmis += vec3(1.2, 0.3, 0.75) * deep * deep * deep * (0.12 + 0.9 * vein) * fl * 1.6; alb *= 1.0 - 0.6 * deep; }
  { vec4 sc = texture2D(scarMap, gp / worldSize); float tr = sc.r; alb *= 1.0 - tr * (0.34 + 0.16 * Bw.y + 0.12 * Bw.z); alb = mix(alb, alb * vec3(0.76, 0.85, 1.08), tr * Bw.x * 0.7); /* rastros: chão compactado (na neve, sombra azulada) */
    float bu = smoothstep(0.0, 0.85, sc.g); alb = mix(alb, vec3(0.06, 0.05, 0.042) * (0.75 + 0.5 * soft), clamp(bu * 0.85, 0.0, 0.85)); /* 4.3g: fuligem marrom-acinzentada, gradiente até a borda */ rough = mix(rough, 0.6, bu * 0.4); hgt += -tr * 0.18 - sc.b * 1.6; /* queimado e cratera */
    tEmis += vec3(1.4, 0.45, 0.12) * smoothstep(0.35, 1.0, sc.a) * (0.65 + 0.35 * sin(uTime * 9.0 + gp.x * 0.7)) * (0.5 + 0.5 * hCrk); } /* brasa recente */
  #endif
  alb *= 0.86 + 0.28 * macro; alb *= mix(vec3(1.0), vec3(1.06, 1.0, 0.92), smoothstep(0.4, 0.8, mid) * 0.6);
  #ifdef ARD_FORA
  { float sl = smoothstep(250.0, 340.0, vWP.y + (macro - 0.5) * 90.0) * (1.0 - smoothstep(0.35, 0.6, slope)); alb = mix(alb, vec3(0.78, 0.82, 0.88) * (0.9 + 0.1 * soft), sl); rough = mix(rough, 0.7, sl); } /* neve no alto das montanhas distantes */
  #endif
  diffuseColor.rgb = alb; tRough = rough; tH = hgt * mix(0.25, 1.0, nearK);
  diffuseColor.rgb *= mix(0.72, 1.0, vAoc.x);
  #ifdef ARD_VAZIO
  { /* 4.3h: Cinturão — o chão vira rocha gasta perto do corte (encontra a beirada do space3d) e as pontes ganham cascalho */
    vec4 vm = texture2D(uVoidMap, gp / worldSize); float esd = (vm.r - 0.5) * 128.0; float ponte = vm.g; float crumb = smoothstep(0.3, 0.75, Ap.g + (As.r - 0.5) * 0.7);
    float lip = smoothstep(34.0, 19.0, esd + (crumb - 0.5) * 8.0); vec3 pale = mix(diffuseColor.rgb, vec3(dot(diffuseColor.rgb, vec3(0.3333))) * 1.12 + 0.04, 0.5) * (0.84 + 0.28 * crumb); diffuseColor.rgb = mix(diffuseColor.rgb, pale, lip * 0.65);
    diffuseColor.rgb = mix(diffuseColor.rgb, mix(vec3(0.27, 0.245, 0.22), vec3(0.47, 0.43, 0.38), Ap.g) * (0.8 + 0.4 * macro), ponte * 0.5 * smoothstep(18.0, 26.0, esd));
  }
  #endif
  #if defined(ARD_DBG)
  diffuseColor.rgb = ARD_DBG == 1 ? Bw.xyz : ARD_DBG == 2 ? vec3(vAoc.x) : ARD_DBG == 3 ? vec3(0.5 + 0.5 * vAoc.y) : ARD_DBG == 4 ? vec3(Ar.r, Ap.g, Bt.r) : diffuseColor.rgb; tRough = ARD_DBG == 5 ? tRough : 1.0; if (ARD_DBG != 7) tH = 0.0;
  #endif
}
#ifndef ARD_FORA
float ardMh = 0.0;
if (uNear > 0.0) { vec3 m1 = texture2D(microMap, vWuv * 260.0).rgb; vec3 m2 = texture2D(microMap, vWuv * 84.0 + 0.31).rgb; float pe = max(m1.r * 0.6, m2.r);
  diffuseColor.rgb *= mix(1.0, (0.86 + 0.28 * mix(m1.g, m2.g, step(0.25, m2.r))) * (1.0 - 0.35 * max(m1.b, m2.b * 0.8)) * (1.0 + 0.1 * pe), uNear * 0.7); ardMh = (m1.r * 0.3 + m2.r * 0.7 - (m1.b + m2.b) * 0.25) * uNear; }
{ vec4 tc = texture2D(terrMap, vWuv); diffuseColor.rgb = mix(diffuseColor.rgb, tc.rgb, tc.a * 0.14); float fl = texture2D(fogMap, vWuv).r; diffuseColor.rgb *= mix(0.06, 1.0, fl); tEmis *= fl;
  float cl = texture2D(cloudMap, vWuv * 5.0 + vec2(uCloudT * 0.006, uCloudT * 0.0035)).r; diffuseColor.rgb *= 1.0 - uCloudK * 0.2 * (1.0 - cl); }
#else
float ardMh = 0.0;
{ float cl = texture2D(cloudMap, vWuv * 5.0 + vec2(uCloudT * 0.006, uCloudT * 0.0035)).r; diffuseColor.rgb *= 1.0 - uCloudK * 0.2 * (1.0 - cl); }
#endif
`;
let VOID0 = null; function voidNeutral(THREE) { if (!VOID0) { VOID0 = new THREE.DataTexture(new Uint8Array([255, 0, 0, 255]), 1, 1, THREE.RGBAFormat, THREE.UnsignedByteType); VOID0.needsUpdate = true; } return VOID0; } /* 4.3h */
function material(THREE, U, o) {
  o = o || {}; const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0.02, envMapIntensity: 0.22 });
  if (o.vazio) { m.userData.vazio = true; m.userData.voidMap = { value: voidNeutral(THREE) }; m.userData.terrU = U; } /* 4.3h: mapa da borda do Cinturão (o space3d põe o de verdade e lê a névoa de guerra) */
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U); if (o.vazio) sh.uniforms.uVoidMap = m.userData.voidMap; if (o.onShader) o.onShader(sh);
    const dbg = +(new URLSearchParams(globalThis.location ? location.search : '').get('terrdbg') || 0); const defs = (o.fora ? '#define ARD_FORA\n' : '') + (o.leve ? '#define ARD_LEVE\n' : '') + (o.vazio ? '#define ARD_VAZIO\n' : '') + (dbg ? '#define ARD_DBG ' + dbg + '\n' : '');
    sh.vertexShader = 'attribute vec4 bio; attribute vec2 aoc; uniform float worldSize; varying vec4 vBio; varying vec2 vAoc; varying vec3 vWP; varying vec3 vWN; varying vec2 vWuv;\n' + sh.vertexShader
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n{ vec4 ardW = modelMatrix * vec4(transformed, 1.0); vWP = ardW.xyz; vWN = normalize(mat3(modelMatrix) * objectNormal); vBio = bio; vAoc = aoc; vWuv = vec2(ardW.x / worldSize, -ardW.z / worldSize); }');
    sh.fragmentShader = defs + (U.uFlash ? 'uniform sampler2D uFlash; uniform vec4 uFlashR;\n' : '') + TERR_PARS + sh.fragmentShader
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + (o.vazio ? 'if (vWP.y < -90.0) discard; /* 4.3h: abaixo do paredão é o espaço */\nif ((texture2D(uVoidMap, vec2(vWP.x, -vWP.z) / worldSize).r - 0.5) * 128.0 < 18.0) discard; /* 4.3h: corta a 18 da borda: dali para fora é a beirada de rocha e o paredão do space3d (contorno exato, sem os dentes da grade) */\n' : '') + TERR_COLOR)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = tRough;')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n{ vec2 dh = vec2(dFdx(tH), dFdy(tH)) + (ardMh != 0.0 ? vec2(dFdx(ardMh), dFdy(ardMh)) * 0.5 : vec2(0.0)); normal = ardTPerturb(-vViewPosition, normal, dh, faceDirection); } /* tH em unidades do mapa */')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += tEmis;' + (U.uFlash ? '\n{ vec2 fu = (vWP.xz - uFlashR.xy) / uFlashR.zw; if (fu.x > 0.0 && fu.y > 0.0 && fu.x < 1.0 && fu.y < 1.0) { vec3 fl = texture2D(uFlash, fu).rgb; totalEmissiveRadiance += diffuseColor.rgb * fl / (1.0 + 0.3 * fl) * (0.35 + 0.65 * max(vWN.y, 0.0)); } } /* 4.3g: clarões no chão (compressão suave) */' : ''))
      .replace('#include <aomap_fragment>', '#include <aomap_fragment>\nreflectedLight.indirectDiffuse *= vAoc.x; reflectedLight.indirectSpecular *= mix(0.4, 1.0, vAoc.x);');
    if (globalThis.__ardTerrDbg) globalThis.__ardTerrDbg.push({ vs: sh.vertexShader, fs: sh.fragmentShader });
  };
  m.customProgramCacheKey = () => 'ard-terreno-v43c' + (o.fora ? '-fora' : '') + (o.leve ? '-leve' : '') + (o.vazio ? '-vazio' : ''); m.userData.env = 0.22; return m;
}

// ---------- paredões do abismo da Fenda ----------
function riftWalls(THREE, sim, Hat) {
  const NA = 220, NV = 30, top = [], seed = sim.seed; const pos = [], bio = [], aoc = [], idx = [];
  for (let a = 0; a <= NA; a++) { const ang = a / NA * TAU; const r0 = RIFT.rimR - riftJag(ang, seed); top.push(r0); }
  for (let v = 0; v <= NV; v++) { const t = v / NV; for (let a = 0; a <= NA; a++) { const ang = a / NA * TAU, r0 = top[a]; const yTop = Hat(S.CX + Math.cos(ang) * (r0 + 6), S.CY + Math.sin(ang) * (r0 + 6)) + 1.5; const y = yTop + (RIFT.abyss - 10 - yTop) * t;
      const band = Math.floor(y / 14), bh = h2(band, 3, seed) - 0.5; const led = (h2(band, Math.floor(ang * 5), seed + 9) - 0.5) * 9 + bh * 10 + (vn(ang * 18, y / 9, seed + 61) - 0.5) * 7; const r = r0 + 3 - t * 14 + led * Math.min(1, t * 6);
      const x = S.CX + Math.cos(ang) * r, yy = S.CY + Math.sin(ang) * r; pos.push(x, y, -yy); bio.push(0, 0, 0, 1); aoc.push(1 - 0.55 * t, -0.2); } }
  for (let v = 0; v < NV; v++) for (let a = 0; a < NA; a++) { const p = v * (NA + 1) + a, q = p + NA + 1; idx.push(p, p + 1, q, p + 1, q + 1, q); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('bio', new THREE.Float32BufferAttribute(bio, 4)); g.setAttribute('aoc', new THREE.Float32BufferAttribute(aoc, 2)); g.setIndex(idx); g.computeVertexNormals(); g.computeBoundingSphere(); return g;
}

// ---------- cordilheira de mesas além do mapa (mesmo material, sem névoa de guerra) ----------
function backdrop(THREE, sim, T, edgeH, leve) {
  const W = S.WORLD, seed = sim.seed; const bw = [0, 0, 0, 0];
  const out = (x, y) => Math.max(0, -x, x - W, -y, y - W); // distância para fora do retângulo do mapa (norma do máximo)
  const terr = v => (Math.floor(v) + sstep(0.78, 0.93, v - Math.floor(v))); // degraus de mesa: topo plano e paredão
  const hAt = (x, y) => { const e = out(x, y); const cx = Math.max(0, Math.min(W, x)), cy = Math.max(0, Math.min(W, y)); const h0 = edgeH(cx, cy);
    const rise = sstep(90, 760, e); const lv = rise > 0 ? terr(Math.max(0, fbm(x / 980, y / 980, 4, seed + 77) - 0.34) * 9) * 62 * rise : 0;
    const fk = sstep(1600, 4200, e); const far = fk > 0 ? fk * (260 + 520 * Math.pow(fbm(x / 1700, y / 1700, 4, seed + 83), 1.4)) : 0; const det = rise > 0 ? ((fbm(x / 70, y / 70, 3, seed + 89) - 0.5) * 9 + (fbm(x / 260, y / 260, 3, seed + 97) - 0.5) * 26) * rise : 0;
    return h0 * (1 - sstep(0, 160, e)) + (lv + far + det) * sstep(20, 220, e) - 4 * sstep(0, 60, e) * (1 - rise); };
  const bioAt = (x, y, o) => { const cx = Math.max(1, Math.min(W - 1, x)), cy = Math.max(1, Math.min(W - 1, y)); T.bioAt(cx, cy, o); };
  const c1 = leve ? 40 : 20, c2 = leve ? 160 : 80; /* celular: metade da resolução */
  const near = gridGeo(THREE, -1600, -1600, 6400 / c1, 6400 / c1, c1, hAt, bioAt, (x, y) => out(x, y) > 0.01);
  const far = gridGeo(THREE, -6400, -6400, 16000 / c2, 16000 / c2, c2, hAt, bioAt, (x, y) => out(x, y) > 1600 - c2 / 2 - 1);
  return [near, far];
}

// ---------- cicatrizes de batalha: rastros, queimados e crateras num mapa do mundo que some devagar ----------
const SCAR_VS = 'attribute vec4 aK; varying vec2 vUv; varying vec4 vK; void main(){ vUv = uv; vK = aK; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }';
const SCAR_FS = `varying vec2 vUv; varying vec4 vK;
float hs(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main(){ float kind = vK.x, k = vK.y, len = vK.z; vec2 u = vUv; vec4 o = vec4(0.0);
  if (kind < 0.5) { float a = abs(u.x - 0.5); float band = smoothstep(0.13, 0.17, a) * (1.0 - smoothstep(0.38, 0.44, a)); float st = 0.62 + 0.38 * step(0.5, fract(u.y * len / 1.7)); o.r = band * st * k; }
  else if (kind < 1.5) { float a = abs(u.x - 0.5); float band = 1.0 - smoothstep(0.12, 0.5, a); float dots = 0.45 + 0.55 * step(0.45, fract(u.y * len / 3.2 + step(0.5, u.x) * 0.5)); o.r = band * dots * k * 0.75; }
  else { vec2 q = u * 2.0 - 1.0; float r = length(q); float ang = atan(q.y, q.x); float a7 = ang * 7.0 / 6.2831853 + 3.5, a17 = ang * 17.0 / 6.2831853 + 8.5; float n1 = mix(hs(vec2(floor(a7), vK.w)), hs(vec2(floor(a7) + 1.0, vK.w)), smoothstep(0.0, 1.0, fract(a7))), n2 = hs(vec2(floor(a17), vK.w + 3.1)); float jag = 0.66 + 0.24 * n1 + 0.1 * n2; float rr = r / jag; /* 4.3g: borda irregular em duas frequências e riscos de estilhaço */
    float ray = smoothstep(0.55, 0.95, hs(vec2(floor(ang * 23.0 / 6.2831853 + 11.5), vK.w + 7.7))) * (1.0 - smoothstep(0.45, 1.0, r)) * smoothstep(0.2, 0.45, r); o.g = max(1.0 - smoothstep(0.1, 1.0, rr), ray * 0.55) * k; o.b = (1.0 - smoothstep(0.0, 0.8, rr)) * k * vK.z; o.a = (1.0 - smoothstep(0.05, 0.5, rr)) * k; }
  gl_FragColor = o; }`;
function scars(THREE, renderer, W, N) {
  const FIXAS = /marcasfixas=1/.test(globalThis.location ? location.search : '');
  const rt = new THREE.WebGLRenderTarget(N, N, { type: THREE.HalfFloatType, depthBuffer: false, generateMipmaps: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter }); rt.texture.colorSpace = THREE.NoColorSpace;
  const scene = new THREE.Scene(), cam = new THREE.OrthographicCamera(0, W, W, 0, -1, 1); const MAX = 1024;
  const kAttr = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 4), 4); kAttr.setUsage(THREE.DynamicDrawUsage);
  const geo = new THREE.PlaneGeometry(1, 1); geo.setAttribute('aK', kAttr);
  const mat = new THREE.ShaderMaterial({ vertexShader: SCAR_VS, fragmentShader: SCAR_FS, depthTest: false, depthWrite: false, transparent: true, blending: THREE.CustomBlending, blendEquation: THREE.MaxEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor });
  const inst = new THREE.InstancedMesh(geo, mat, MAX); inst.frustumCulled = false; inst.count = 0; scene.add(inst);
  const fadeScene = new THREE.Scene(); const fadeMat = new THREE.MeshBasicMaterial({ color: 0xffffff, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.ZeroFactor, blendDst: THREE.SrcColorFactor, depthTest: false, depthWrite: false, transparent: true, toneMapped: false });
  const fq = new THREE.Mesh(new THREE.PlaneGeometry(W, W), fadeMat); fq.position.set(W / 2, W / 2, 0); fq.frustumCulled = false; fadeScene.add(fq);
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), Z = new THREE.Vector3(0, 0, 1);
  let n = 0, fadeT = 0, cleared = false;
  const push = (x, y, ang, w, l, kind, k, extra, seed) => { if (n >= MAX) return; _p.set(x, y, 0); _q.setFromAxisAngle(Z, ang - Math.PI / 2); _s.set(w, l, 1); _m.compose(_p, _q, _s); inst.setMatrixAt(n, _m); kAttr.setXYZW(n, kind, k, extra, seed || 0); n++; };
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
}

// ---------- chão assentado sob construções (o relevo da grade muda e a malha é atualizada só na janela) ----------
function flatten(T, geo, x, y, r) {
  const HN = T.HN, HS = T.HS, R1 = r + 14; const i0 = Math.max(1, Math.floor((x - R1) / HS)), i1 = Math.min(HN - 2, Math.ceil((x + R1) / HS)), j0 = Math.max(1, Math.floor((y - R1) / HS)), j1 = Math.min(HN - 2, Math.ceil((y + R1) / HS));
  if (i0 > i1 || j0 > j1) return; let sum = 0, cnt = 0; for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const d = Math.hypot(i * HS - x, j * HS - y); if (d <= r) { sum += T.heights[j * HN + i]; cnt++; } }
  const hc = cnt ? sum / cnt : T.heights[Math.round(y / HS) * HN + Math.round(x / HS)];
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const d = Math.hypot(i * HS - x, j * HS - y); if (d < R1) { const k = d <= r ? 1 : sm(1 - (d - r) / (R1 - r)); const v = j * HN + i; T.heights[v] = T.heights[v] * (1 - k) + hc * k; } }
  refresh(T, geo, i0 - 1, i1 + 1, j0 - 1, j1 + 1);
}
function refresh(T, geo, i0, i1, j0, j1) {
  const HN = T.HN, HS = T.HS, h = T.heights, pos = geo.attributes.position, nor = geo.attributes.normal; i0 = Math.max(0, i0); j0 = Math.max(0, j0); i1 = Math.min(HN - 1, i1); j1 = Math.min(HN - 1, j1);
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const v = j * HN + i; pos.array[v * 3 + 1] = h[v]; const hx = (h[j * HN + Math.min(HN - 1, i + 1)] - h[j * HN + Math.max(0, i - 1)]) / (2 * HS), hy = (h[Math.min(HN - 1, j + 1) * HN + i] - h[Math.max(0, j - 1) * HN + i]) / (2 * HS); const l = Math.hypot(hx, 1, hy); nor.array[v * 3] = -hx / l; nor.array[v * 3 + 1] = 1 / l; nor.array[v * 3 + 2] = hy / l; }
  const a = j0 * HN, b = (j1 + 1) * HN; pos.clearUpdateRanges(); pos.addUpdateRange(a * 3, (b - a) * 3); pos.needsUpdate = true; nor.clearUpdateRanges(); nor.addUpdateRange(a * 3, (b - a) * 3); nor.needsUpdate = true;
}

ARD.terrain3d = { build, mapGeo, gridGeo, detailTextures, material, riftWalls, backdrop, scars, flatten, RIFT, BIO_MEAN };
})(globalThis.ARD = globalThis.ARD || {});
