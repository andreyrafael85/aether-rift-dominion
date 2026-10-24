/* Aether Rift: Dominion — Motor 5 (5.0a.1): espaço mínimo do Cinturão enquanto o space3d não é portado (o espaço completo é da fase 2).
   - mapaVazio(sim): o mesmo mapa da borda do space3d (R = distância com sinal até o vazio, ±64; G = ponte): o chão do Motor 5 corta só
     no vazio (antes cortava abaixo de −90 de altura);
   - nebulosa(renderer, size, seed): a nebulosa do world3d.spaceBackdrop em TSL, assada uma vez num cubemap meio-float;
   - cor(d, u, neb): o céu em modo espaço do world3d (nebulosa, estrelas em três camadas, faixa da galáxia e o sol sem ar), usado pelo
     M5.ceu({ espaco }) só no Cinturão (os outros mapas não pagam nada disso no shader do céu);
   - quadro(bg, fog, nt): fundo e névoa de poeira escura de espaço, os mesmos valores do SP.update do clássico.
   O planeta gigante, os asteroides, as raízes de rocha e o redemoinho da Fenda ficam para a fase 2. Só visual: nada aqui toca a simulação. */
(function (ARD) {
'use strict';
const M5 = ARD.m5 = ARD.m5 || {};
const E = M5.espaco = M5.espaco || {};

/* ---------- mapa do vazio (cópia do voidMap/sdTools do space3d, que continua sendo a fonte no clássico) ---------- */
function rng(seed) { let s = (seed >>> 0) || 1; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function sdTools(sim) {
  const S = ARD.sim, m = sim.map, P = m.plats.map(p => ({ x: p[0], y: p[1], R: p[2], s: p[3], rr: (p[2] * 1.15 + 70) ** 2 })), g = m.ring, B = m.bridges.map(b => { const wm = b[4] * 0.5 * 1.2 + 70; return { b, vx: b[2] - b[0], vy: b[3] - b[1], L2: (b[2] - b[0]) ** 2 + (b[3] - b[1]) ** 2, x0: Math.min(b[0], b[2]) - wm, x1: Math.max(b[0], b[2]) + wm, y0: Math.min(b[1], b[3]) - wm, y1: Math.max(b[1], b[3]) + wm }; });
  const T = { br: false };
  T.sd = (x, y) => { let pl = -9999, br = -9999;
    for (const p of P) { const dx = x - p.x, dy = y - p.y, d2 = dx * dx + dy * dy; if (d2 > p.rr) continue; const d = Math.sqrt(d2); const v = d > p.R * 1.6 ? p.R * 1.15 - d : S.edgeR(p.R, Math.atan2(dy, dx), p.s) - d; if (v > pl) pl = v; }
    if (g) { const dx = x - g[0], dy = y - g[1], d = Math.sqrt(dx * dx + dy * dy); if (d < g[3] * 1.15 + 70) { const a = Math.atan2(dy, dx); const v = Math.min(d - S.edgeR(g[2], a, g[4]), S.edgeR(g[3], a, g[4] + 1.3) - d); if (v > pl) pl = v; } }
    for (const q of B) { if (x < q.x0 || x > q.x1 || y < q.y0 || y > q.y1) continue; const b = q.b; let t = ((x - b[0]) * q.vx + (y - b[1]) * q.vy) / (q.L2 || 1); t = t < 0 ? 0 : t > 1 ? 1 : t; const w = b[4] * 0.5 * (1 + 0.14 * Math.sin(t * 11 + b[5]) + 0.06 * Math.sin(t * 29 + b[5] * 2)); const v = w - Math.hypot(b[0] + q.vx * t - x, b[1] + q.vy * t - y); if (v > br) br = v; }
    T.br = br >= 0 && pl < 0; return Math.max(pl, br); };
  let ok = true; const r = rng(77); for (let i = 0; i < 400 && ok; i++) { const x = r() * S.WORLD, y = r() * S.WORLD; const a = Math.max(-64, Math.min(64, T.sd(x, y))), b = Math.max(-64, Math.min(64, S.mapSd(sim, x, y))); if (Math.abs(a - b) > 0.6) ok = false; }
  if (!ok) T.sd = (x, y) => { const v = S.mapSd(sim, x, y); T.br = v > -8 && v < 60 && S.onBridge(m, x, y) && !S.onPlat(m, x, y); return v; }; /* a fórmula do sim mudou: o mapSd (mais lento, sempre certo) */
  return T;
}
E.mapaVazio = function (sim, N) {
  const Tm = window.THREE_M5, S = ARD.sim; N = N || 512; const W = S.WORLD, cs = W / N, data = new Uint8Array(N * N * 4), Bk = 4, NB = N / Bk; const F = sdTools(sim); const t0 = performance.now();
  for (let bj = 0; bj < NB; bj++) for (let bi = 0; bi < NB; bi++) { const sc = F.sd((bi + 0.5) * Bk * cs, (bj + 0.5) * Bk * cs); const far = Math.abs(sc) > 64 + Bk * cs * 1.5;
    for (let j = bj * Bk; j < bj * Bk + Bk; j++) for (let i = bi * Bk; i < bi * Bk + Bk; i++) { const k = (j * N + i) * 4; let sd = sc, br = 0; if (!far) { sd = F.sd((i + 0.5) * cs, (j + 0.5) * cs); br = F.br ? 255 : 0; }
      data[k] = Math.round(255 * (Math.max(-1, Math.min(1, sd / 64)) * 0.5 + 0.5)); data[k + 1] = br; data[k + 2] = 0; data[k + 3] = 255; } }
  const t = new Tm.DataTexture(data, N, N, Tm.RGBAFormat, Tm.UnsignedByteType); t.magFilter = Tm.LinearFilter; t.minFilter = Tm.LinearFilter; t.wrapS = t.wrapT = Tm.ClampToEdgeWrapping; t.colorSpace = Tm.NoColorSpace; t.needsUpdate = true; t.name = 'ard-vazio';
  E.vazioMs = Math.round(performance.now() - t0); return t;
};

/* ---------- ruído 3D com funções de verdade no WGSL (setLayout): o código fica pequeno mesmo com 7 oitavas ---------- */
let NZ = null;
function ruido() {
  if (NZ) return NZ; const L = window.TSL; const { Fn, vec3, float, floor, fract, dot, mix } = L;
  const h31 = Fn(([p0]) => { const p = fract(vec3(p0).mul(0.1031)).toVar(); p.addAssign(dot(p, p.zyx.add(31.32))); return fract(p.x.add(p.y).mul(p.z)); }).setLayout({ name: 'ardEspH31', type: 'float', inputs: [{ name: 'p0', type: 'vec3' }] });
  const vn3 = Fn(([p]) => { const i = floor(p), f = fract(p), u = f.mul(f).mul(f.mul(-2).add(3));
    const a = h31(i), b = h31(i.add(vec3(1, 0, 0))), c = h31(i.add(vec3(0, 1, 0))), d = h31(i.add(vec3(1, 1, 0))), e = h31(i.add(vec3(0, 0, 1))), g = h31(i.add(vec3(1, 0, 1))), h = h31(i.add(vec3(0, 1, 1))), k = h31(i.add(vec3(1, 1, 1)));
    return mix(mix(mix(a, b, u.x), mix(c, d, u.x), u.y), mix(mix(e, g, u.x), mix(h, k, u.x), u.y), u.z); }).setLayout({ name: 'ardEspVn3', type: 'float', inputs: [{ name: 'p', type: 'vec3' }] });
  const fbm = n => Fn(([p0]) => { let p = vec3(p0), v = float(0), a = 0.5, t = 0; for (let i = 0; i < n; i++) { v = v.add(vn3(p).mul(a)); t += a; p = p.mul(2.03).add(vec3(1.7, 9.2, 4.1)); a *= 0.5; } return v.div(t); }).setLayout({ name: 'ardEspFbm' + n, type: 'float', inputs: [{ name: 'p0', type: 'vec3' }] });
  NZ = { h31, vn3, f4: fbm(4), f5: fbm(5), f6: fbm(6) }; return NZ;
}

/* ---------- nebulosa assada (o BACKDROP_FS do world3d em TSL), uma vez, num cubemap ---------- */
E.nebulosa = function (renderer, size, seed) {
  const Tm = window.THREE_M5, L = window.TSL; const { vec3, float, dot, mix, smoothstep, pow, exp, normalize, positionLocal } = L; const N = ruido(); const t0 = performance.now();
  const s = float(seed || 0), d = normalize(positionLocal);
  const w = vec3(N.f4(d.mul(1.6).add(s)), N.f4(d.mul(1.6).add(s).add(5.3)), N.f4(d.mul(1.6).add(s).add(9.7))).sub(0.5);
  const n1 = N.f6(d.mul(2.4).add(w.mul(1.8)).add(3.1)), n2 = N.f6(d.mul(4.2).sub(w.mul(1.4)).add(7.7)), n3 = N.f5(d.mul(9.0).add(w.mul(0.8)));
  const bd = dot(d, vec3(0.38, 0.33, 0.865)), band = exp(bd.mul(bd).mul(-16));
  const neb = smoothstep(0.47, 0.8, n1.add(band.mul(0.1))), wisp = pow(smoothstep(0.35, 0.95, n2), 2), lane = smoothstep(0.5, 0.7, n3).mul(band);
  let col = vec3(0.0010, 0.0015, 0.0032).mul(n2.mul(0.6).add(0.7));
  col = col.add(mix(vec3(0.007, 0.028, 0.115), vec3(0.048, 0.013, 0.082), smoothstep(0.35, 0.75, n2)).mul(neb).mul(wisp.mul(0.5).add(0.5)));
  col = col.add(vec3(0.004, 0.036, 0.046).mul(neb).mul(smoothstep(0.05, 0.35, w.y)).mul(0.8));
  col = col.add(vec3(0.065, 0.014, 0.038).mul(pow(neb, 3)).mul(smoothstep(0.58, 0.85, n3)).mul(0.7));
  col = col.add(vec3(0.018, 0.019, 0.027).mul(band).mul(n3.mul(0.6).add(0.4)).mul(float(1).sub(lane.mul(0.8))));
  const mat = new Tm.MeshBasicNodeMaterial({ side: Tm.BackSide, depthTest: false, depthWrite: false }); mat.fog = false; mat.toneMapped = false; mat.colorNode = col; M5.registrar('nebulosa-assada', mat);
  const rt = new Tm.CubeRenderTarget(size || 384, { type: Tm.HalfFloatType, generateMipmaps: false, minFilter: Tm.LinearFilter, magFilter: Tm.LinearFilter, depthBuffer: false }); rt.texture.name = 'ard-nebulosa';
  const sc = new Tm.Scene(), box = new Tm.Mesh(new Tm.BoxGeometry(10, 10, 10), mat); sc.add(box); const cam = new Tm.CubeCamera(0.1, 100, rt);
  const prev = renderer.getRenderTarget(); cam.update(renderer, sc); renderer.setRenderTarget(prev); box.geometry.dispose(); mat.dispose();
  E.nebulosaMs = Math.round(performance.now() - t0); return rt;
};

/* ---------- céu em modo espaço (o ardEspaco do world3d, sem o planeta gigante): d = direção normalizada, u = uniforms do céu ---------- */
E.cor = function (d, u, neb) {
  const L = window.TSL; const { vec3, float, floor, fract, dot, mix, smoothstep, step, pow, exp, max, min, length, fwidth, cubeTexture } = L;
  const hs3 = p => { const q = fract(p.mul(0.1031)); const q2 = q.add(dot(q, q.zyx.add(31.32))); return fract(q2.x.add(q2.y).mul(q2.z)); };
  const hs33 = p => { const q = fract(p.mul(vec3(0.1031, 0.1030, 0.0973))); const q2 = q.add(dot(q, q.yxz.add(33.33))); return fract(q2.xxy.add(q2.yxx).mul(q2.zyx)); };
  const star = (dd, sc, dens, rad, gain) => { const q = dd.mul(sc), c = floor(q); const keep = step(hs3(c.add(11.7)), dens); const h = hs33(c); const dist = length(q.sub(c.add(0.3).add(h.mul(0.4))));
    const r = max(float(rad), max(length(fwidth(q)), 1e-4).mul(0.7)); const k = float(1).sub(smoothstep(r.mul(0.2), r, dist)).mul(min(1, float(rad * rad).div(r.mul(r)))); /* smoothstep com as bordas em ordem (no WGSL e no Metal a ordem invertida é indefinida) */
    const b = pow(h.y, 9).mul(5).add(0.22).mul(gain); const tc = mix(mix(vec3(0.7, 0.82, 1.0), vec3(1), h.z.div(0.62)), mix(vec3(1), vec3(1.0, 0.76, 0.5), h.z.sub(0.62).div(0.38)), step(0.62, h.z));
    return tc.mul(k.mul(b).mul(keep)); };
  let col = neb ? cubeTexture(neb, d).rgb.mul(u.uNight.mul(0.25).add(1)) : vec3(0.0012, 0.0018, 0.004); /* o clássico clareia a nebulosa 25% à noite (uSpaceK.x) */
  const bd = dot(d, vec3(0.38, 0.33, 0.865)), band = exp(bd.mul(bd).mul(-16));
  const st = star(d, 280, band.mul(0.22).add(0.05), 0.17, 0.5).add(star(d.zxy, 110, 0.035, 0.11, 1.5)).add(star(d.yzx, 560, band.mul(0.35).add(0.06), 0.2, 0.2));
  col = col.add(st.mul(u.uNight.mul(0.5).add(0.8)));
  const sd = max(dot(d, u.uSunDir), 0); col = col.add(u.uSunCol.mul(pow(sd, 2400).mul(36).add(pow(sd, 160).mul(0.5)).add(pow(sd, 12).mul(0.03))).mul(float(1).sub(u.uNight.mul(0.85))));
  return col;
};

/* ---------- por quadro (Cinturão sem o space3d): fundo e névoa viram poeira escura de espaço, como no clássico ---------- */
E.quadro = function (bg, fog, nt) { bg.setRGB(0.008 - 0.004 * nt, 0.012 - 0.005 * nt, 0.03 - 0.01 * nt); if (fog) fog.color.copy(bg); };
})(globalThis.ARD = globalThis.ARD || {});
