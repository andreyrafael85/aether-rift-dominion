/* Aether Rift: Dominion — Engine gráfica 2 (4.0d): malhas 3D suaves por Raça.
   Modelos procedurais com cor, rugosidade e metal por vértice e partes emissivas separadas, no mesmo formato do vox3d
   ({ main, em, width, height, mount }) para o instancing do render3d. Autoria nos eixos do three: +x frente, +y cima, z lado.
   Cada Raça tem um "kit" de arquitetura (Vehnar aço chanfrado, Erevane placas angulares, Tessara casco orgânico,
   Quorith cristal facetado, Vorag quitina úmida); as receitas de construção e unidade usam o kit da Raça dona. */
(function (ARD) {
'use strict';
let T = null; // THREE, resolvido na primeira construção (o módulo three carrega depois deste script)
let LOD = 1; // 1 = completo; ~0.6 em celular (menos segmentos nas curvas)
const SG = n => Math.max(5, Math.round(n * LOD));
const MAT = { // [rugosidade, metal]
  metal: [0.3, 0.78], steel: [0.42, 0.42], paint: [0.48, 0.18], dark: [0.58, 0.3], rubber: [0.9, 0], glass: [0.06, 0.3], gloss: [0.22, 0.45],
  bone: [0.62, 0], chitin: [0.2, 0.05], crystal: [0.12, 0.18], skin: [0.48, 0], stone: [0.9, 0], ice: [0.12, 0.02], wet: [0.14, 0.02], matte: [0.82, 0.04],
};
const PAL = {
  vehnar:  { a: '#7C8490', b: '#59606B', d: '#2B2E35', t: '#BCC2CA', r: '#8A5A3A', h: '#E8B23A', l: '#FFD27A', g: '#8FC9F0', ma: 'steel' },
  erevane: { a: '#3A404B', b: '#262A31', d: '#121418', t: '#C9B458', l: '#E05CFF', c: '#3FE6CF', g: '#1D2A33', ma: 'gloss' },
  tessara: { a: '#CFC3AA', b: '#B4A588', d: '#5E4F3C', t: '#8E623A', l: '#7FE3A1', am: '#F2A93B', g: '#A9E3BA', ma: 'bone' },
  quorith: { a: '#C9BFEA', b: '#A797DC', d: '#342B4A', t: '#7E62D0', l: '#DCCBFF', c: '#B388FF', ma: 'crystal' },
  vorag:   { a: '#5C2B37', b: '#7C3546', d: '#26121A', bo: '#E8DCC8', l: '#FF5A5A', m: '#E6455A', ac: '#B8E66A', ma: 'chitin' },
};
function rng(seed) { let r = ((seed | 0) * 7919 + 104729) >>> 0; return () => { r = (Math.imul(r, 1103515245) + 12345) >>> 0; return (r >>> 8) / 16777216; }; }

// ---------- construtor ----------
class Kit {
  constructor() { this.main = []; this.emi = []; this.mount = null; this.ox = 0; this.oy = 0; this.oz = 0; }
  _push(geo, col, mat, o) {
    o = o || {};
    if (geo.index) { const g2 = geo.toNonIndexed(); geo.dispose(); geo = g2; }
    if (geo.attributes.uv) geo.deleteAttribute('uv'); if (geo.attributes.uv2) geo.deleteAttribute('uv2');
    const q = o.q || new T.Quaternion().setFromEuler(new T.Euler(o.rx || 0, o.ry || 0, o.rz || 0, o.order || 'YXZ'));
    const m = new T.Matrix4().compose(new T.Vector3((o.x || 0) + this.ox, (o.y || 0) + this.oy, (o.z || 0) + this.oz), q, new T.Vector3(o.sx || 1, o.sy || 1, o.sz || 1));
    geo.applyMatrix4(m); if (o.flat) geo.computeVertexNormals();
    const c = new T.Color(col);
    if (o.e) { c.multiplyScalar(o.e === true ? 2.4 : o.e); this.emi.push({ geo, c }); }
    else this.main.push({ geo, c, rm: Array.isArray(mat) ? mat : (MAT[mat] || MAT.paint) });
    return this;
  }
  // caixa com base em y; o.b = chanfro (cantos arredondados na planta, bordas chanfradas em cima e embaixo)
  box(x, y, z, w, h, d, col, mat, o) { o = Object.assign({}, o, { x, y, z }); const g = o.b ? roundBox(w, h, d, o.b, o.bs) : new T.BoxGeometry(w, h, d).translate(0, h / 2, 0); return this._push(g, col, mat, o); }
  cyl(x, y, z, rt, rb, h, col, mat, o) { o = Object.assign({}, o, { x, y, z }); const g = new T.CylinderGeometry(rt, rb, h, o.facet ? (o.seg || 16) : SG(o.seg || 16), 1, !!o.open).translate(0, h / 2, 0); if (o.facet) o.flat = true; return this._push(g, col, mat, o); }
  sph(x, y, z, r, col, mat, o) { o = Object.assign({}, o, { x, y, z }); const s = SG(o.seg || 16); const g = new T.SphereGeometry(r, s, Math.max(5, Math.round(s * 0.6)), 0, Math.PI * 2, 0, o.half ? Math.PI / 2 : Math.PI); return this._push(g, col, mat, o); }
  cone(x, y, z, r, h, col, mat, o) { o = Object.assign({}, o, { x, y, z }); const g = new T.ConeGeometry(r, h, (o.seg || 14) <= 6 ? o.seg : SG(o.seg || 14)).translate(0, h / 2, 0); return this._push(g, col, mat, o); }
  tor(x, y, z, R, r, col, mat, o) { o = Object.assign({}, o, { x, y, z }); const g = new T.TorusGeometry(R, r, SG(o.rs || 8), (o.ts || 32) <= 8 ? o.ts : SG(o.ts || 32), o.arc || Math.PI * 2).rotateX(Math.PI / 2); return this._push(g, col, mat, o); }
  oct(x, y, z, r, h, col, mat, o) { o = Object.assign({ flat: true }, o, { x, y, z }); const g = new T.OctahedronGeometry(1, 0).scale(r, h / 2, r).translate(0, h / 2, 0); return this._push(g, col, mat, o); }
  prism(x, y, z, r, h, n, col, mat, o) { o = Object.assign({ flat: true }, o, { x, y, z }); const g = new T.CylinderGeometry(r * (o.top == null ? 1 : o.top), r, h, n, 1).translate(0, h / 2, 0); return this._push(g, col, mat, o); }
  cap(x, y, z, r, len, col, mat, o) { o = Object.assign({}, o, { x, y, z }); const g = new T.CapsuleGeometry(r, len, 3, SG(o.seg || 10)); return this._push(g, col, mat, o); }
  lathe(pts, x, y, z, col, mat, o) { o = Object.assign({}, o, { x, y, z }); const g = new T.LatheGeometry(pts.map(p => new T.Vector2(p[0], p[1])), SG(o.seg || 18)); return this._push(g, col, mat, o); }
  tube(pts, r, col, mat, o) { o = o || {}; const curve = new T.CatmullRomCurve3(pts.map(p => new T.Vector3(p[0], p[1], p[2]))); const g = new T.TubeGeometry(curve, SG(o.ts || 10), r, Math.max(4, Math.round((o.rs || 6) * LOD)), false); return this._push(g, col, mat, o); }
  // segmento (cilindro) de a até b, com afinamento opcional; bom para pernas, canos, patas e lanças
  seg(a, b, r, col, mat, o) { o = o || {}; const A = new T.Vector3(a[0], a[1], a[2]), dir = new T.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]); const len = dir.length() || 0.001; const g = new T.CylinderGeometry(r * (o.taper == null ? 1 : o.taper), r, len, SG(o.seg || 8)).translate(0, len / 2, 0); const q = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), dir.normalize()); return this._push(g, col, mat, Object.assign({}, o, { x: A.x, y: A.y, z: A.z, q })); }
  // polígono no plano XY (perfil lateral) extrudado em Z, centrado em z; o.b = chanfro
  poly(pts, depth, col, mat, o) { o = Object.assign({}, o); const s = new T.Shape(pts.map(p => new T.Vector2(p[0], p[1]))); const g = new T.ExtrudeGeometry(s, { depth, bevelEnabled: !!o.b, bevelThickness: o.b || 0, bevelSize: o.b || 0, bevelSegments: o.bs || 1, curveSegments: 4 }).translate(0, 0, -depth / 2); return this._push(g, col, mat, o); }
  // rocha/ovo facetado com relevo determinístico
  rock(x, y, z, r, col, mat, o) { o = Object.assign({ flat: true }, o, { x, y, z }); const g = new T.IcosahedronGeometry(r, o.detail == null ? 1 : o.detail); const p = g.attributes.position; const rnd = o.amp || 0.22; for (let i = 0; i < p.count; i++) { const vx = p.getX(i), vy = p.getY(i), vz = p.getZ(i); const hsh = Math.sin(vx * 12.9898 + vy * 78.233 + vz * 37.719 + (o.seed || 0) * 3.7) * 43758.5453; const k = 1 + (hsh - Math.floor(hsh) - 0.5) * 2 * rnd; p.setXYZ(i, vx * k, vy * k, vz * k); } return this._push(g, col, mat, o); }
  light(x, y, z, s, col, k) { return this.box(x, y, z, s, s, s, col, null, { e: k || 2.6 }); }
  finish(o) {
    o = o || {}; const all = this.main.concat(this.emi); const bb = new T.Box3(); const tmp = new T.Box3();
    for (const p of all) { p.geo.computeBoundingBox(); tmp.copy(p.geo.boundingBox); bb.union(tmp); }
    const cx = o.pivot ? o.pivot[0] : (bb.min.x + bb.max.x) / 2, cz = o.pivot ? o.pivot[1] : (bb.min.z + bb.max.z) / 2, y0 = bb.min.y;
    const mk = (list, withRM) => {
      if (!list.length) return null; let n = 0; for (const p of list) n += p.geo.attributes.position.count;
      const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3), rm = withRM ? new Float32Array(n * 2) : null; let k = 0;
      for (const p of list) { const c = p.geo.attributes.position.count; pos.set(p.geo.attributes.position.array, k * 3); nor.set(p.geo.attributes.normal.array, k * 3); for (let i = 0; i < c; i++) { const j = k + i; pos[j * 3] -= cx; pos[j * 3 + 1] -= y0; pos[j * 3 + 2] -= cz; col[j * 3] = p.c.r; col[j * 3 + 1] = p.c.g; col[j * 3 + 2] = p.c.b; if (rm) { rm[j * 2] = p.rm[0]; rm[j * 2 + 1] = p.rm[1]; } } k += c; p.geo.dispose(); }
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('normal', new T.BufferAttribute(nor, 3)); g.setAttribute('color', new T.BufferAttribute(col, 3)); if (rm) g.setAttribute('rm', new T.BufferAttribute(rm, 2)); g.computeBoundingSphere(); return g;
    };
    const out = { main: mk(this.main, true), em: mk(this.emi, false), width: Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z), height: bb.max.y - bb.min.y, mount: this.mount == null ? null : this.mount - y0, mesh: true };
    if (!out.main) { const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(new Float32Array(9), 3)); g.setAttribute('normal', new T.BufferAttribute(new Float32Array(9), 3)); g.setAttribute('color', new T.BufferAttribute(new Float32Array(9), 3)); g.setAttribute('rm', new T.BufferAttribute(new Float32Array(6), 2)); out.main = g; }
    return out;
  }
}
function roundBox(w, h, d, b, segs) {
  b = Math.max(0.01, Math.min(b, w / 2 - 0.02, d / 2 - 0.02, h / 2 - 0.02)); const iw = w - 2 * b, id = d - 2 * b, rc = Math.min(b, iw / 2, id / 2) * 0.8;
  const s = new T.Shape(); const x0 = -iw / 2, x1 = iw / 2, y0 = -id / 2, y1 = id / 2;
  s.moveTo(x0 + rc, y0); s.lineTo(x1 - rc, y0); s.quadraticCurveTo(x1, y0, x1, y0 + rc); s.lineTo(x1, y1 - rc); s.quadraticCurveTo(x1, y1, x1 - rc, y1); s.lineTo(x0 + rc, y1); s.quadraticCurveTo(x0, y1, x0, y1 - rc); s.lineTo(x0, y0 + rc); s.quadraticCurveTo(x0, y0, x0 + rc, y0);
  const g = new T.ExtrudeGeometry(s, { depth: Math.max(0.01, h - 2 * b), bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: LOD < 1 ? 1 : (segs || 2), curveSegments: LOD < 1 ? 2 : 3 });
  g.rotateX(-Math.PI / 2); g.translate(0, b, 0); return g;
}

// ---------- utilitários de forma ----------
const PI = Math.PI, H = Math.PI / 2;
function wheel(K, P, x, y, z, r, w) { K.cyl(x, y, z - w / 2, r, r, w, P.d, 'rubber', { rx: H, seg: 14 }); K.cyl(x, y, z - w / 2 - 0.04, r * 0.55, r * 0.55, w + 0.08, P.t || P.b, 'metal', { rx: H, seg: 10 }); }
function track(K, P, x, z, len, h, w) { K.box(x, 0, z, len, h, w, P.d, 'rubber', { b: Math.min(h, w) * 0.42 }); const n = Math.max(3, Math.round(len / 2.4)); const sz = z > 0 ? 1 : -1; for (let i = 0; i < n; i++) K.cyl(x - len / 2 + (i + 0.5) * len / n, h * 0.5, z + sz * (w / 2) - (sz > 0 ? 0 : 0.14), h * 0.36, h * 0.36, 0.14, P.b, 'metal', { rx: H, seg: 10 }); }
function arch(K, x, y, z, A, Hh, D, phi, r, col, mat, o) { const pts = []; for (let i = 0; i <= 12; i++) { const th = i / 12 * PI; pts.push([x + A * Math.cos(th) * Math.cos(phi), y + Hh * Math.sin(th), z + D * Math.cos(th) * Math.sin(phi)]); } K.tube(pts, r, col, mat, Object.assign({ ts: 18 }, o)); }
function leg(K, base, knee, foot, r, col, mat) { K.seg(base, knee, r, col, mat); K.seg(knee, foot, r * 0.85, col, mat, { taper: 0.45 }); }
function ringOf(n, R, fn) { for (let i = 0; i < n; i++) { const a = i / n * PI * 2; fn(Math.cos(a) * R, Math.sin(a) * R, a, i); } }

// ---------- kits de arquitetura por Raça ----------
const KITS = {};
// Consórcio Vehnar: aço chanfrado, faixas de equipe, chaminés com brasa, tanques com cintas, listras de perigo
KITS.vehnar = {
  block(K, P, tc, x, z, w, d, h, y) { y = y || 0;
    K.box(x, y, z, w + 1, 0.7, d + 1, P.d, 'dark', { b: 0.3 }); K.box(x, y + 0.7, z, w, h - 0.7, d, P.a, 'steel', { b: 0.5 });
    K.box(x, y + h * 0.66, z, w + 0.16, 0.55, d + 0.16, tc, 'paint'); K.box(x, y + h, z, w - 1.2, 0.45, d - 1.2, P.b, 'steel', { b: 0.15 });
    const nx = Math.max(1, Math.round(w / 4.5)); for (let i = 0; i < nx; i++) { const px = x - w / 2 + (i + 0.5) * w / nx; for (const s of [-1, 1]) K.box(px, y + 1.1, z + s * (d / 2 + 0.05), 0.3, h * 0.42, 0.2, P.b, 'metal'); }
    K.box(x - w * 0.2, y + h + 0.45, z + d * 0.16, Math.min(3, w * 0.22), 0.9, Math.min(2.2, d * 0.22), P.d, 'dark', { b: 0.15 }); },
  tower(K, P, tc, x, z, r, h, y) { y = y || 0; K.cyl(x, y, z, r * 0.82, r, h, P.b, 'steel', { seg: 16 }); for (let i = 1; i <= 3; i++) K.tor(x, y + h * i / 4, z, r * (1 - 0.18 * i / 4) + 0.06, Math.max(0.12, r * 0.1), P.d, 'metal', { ts: 24, rs: 6 }); K.cyl(x, y + h, z, r * 0.92, r * 0.82, Math.max(0.4, r * 0.3), P.d, 'dark', { seg: 16 }); K.cyl(x, y + h + 0.06, z, r * 0.62, r * 0.62, Math.max(0.42, r * 0.3), '#FF7A2E', null, { e: 2.4, seg: 12 }); },
  pillar(K, P, tc, x, z, r, h, y) { y = y || 0; K.cyl(x, y, z, r, r * 1.15, h, P.b, 'steel', { seg: 12 }); K.tor(x, y + h * 0.5, z, r * 1.05, 0.2, tc, 'paint', { ts: 24 }); K.cyl(x, y + h - 0.6, z, r * 1.25, r * 1.1, 0.6, P.d, 'dark', { seg: 12 }); },
  tank(K, P, tc, x, z, r, h, y) { y = y || 0; K.cyl(x, y, z, r, r, h, P.t, 'metal', { seg: 18 }); K.sph(x, y + h, z, r, P.t, 'metal', { half: true, seg: 18 }); K.tor(x, y + h * 0.28, z, r + 0.04, 0.16, P.d, 'dark', { ts: 28 }); K.tor(x, y + h * 0.78, z, r + 0.04, 0.2, tc, 'paint', { ts: 28 }); K.box(x + r * 0.98, y, z, 0.25, h + r * 0.4, 0.55, P.d, 'dark'); },
  dome(K, P, tc, x, z, r, y) { y = y || 0; K.cyl(x, y, z, r * 1.02, r * 1.1, 0.8, P.b, 'steel', { seg: 24 }); K.sph(x, y + 0.8, z, r, P.g, 'glass', { half: true, seg: 24 }); for (let i = 0; i < 4; i++) arch(K, x, y + 0.8, z, r * 1.01, r * 1.01, r * 1.01, i * PI / 4, 0.12, P.t, 'metal', { ts: 14 }); },
  pad(K, P, tc, x, z, w, d, y) { y = y || 0; K.box(x, y, z, w, 0.6, d, P.d, 'dark', { b: 0.2 }); const n = Math.max(3, Math.round(w / 1.6)); for (let i = 0; i < n; i += 2) K.box(x - w / 2 + (i + 0.5) * w / n, y + 0.6, z + d / 2 - 0.4, w / n * 0.9, 0.06, 0.55, P.h, 'paint'); },
  ring(K, P, tc, x, z, R, y) { K.tor(x, y, z, R, 0.3, P.t, 'metal', { ts: 40 }); ringOf(8, R, (cx, cz) => K.light(x + cx, y + 0.25, z + cz, 0.45, P.l)); },
  door(K, P, tc, x, z, w, h, y) { y = y || 0; K.box(x, y, z, 0.5, h, w, P.d, 'dark'); for (let i = 0; i < 5; i++) K.box(x + 0.27, y + h * (0.1 + i * 0.18), z, 0.08, h * 0.08, w * 0.9, P.b, 'metal'); K.light(x + 0.3, y + h + 0.3, z - w / 2 + 0.3, 0.4, '#FF8A3A'); K.light(x + 0.3, y + h + 0.3, z + w / 2 - 0.3, 0.4, '#FF8A3A'); },
  pipe(K, P, tc, pts) { K.tube(pts, 0.32, P.t, 'metal', { ts: 14 }); },
  banner(K, P, tc, x, z, h) { K.seg([x, 0, z], [x, h, z], 0.12, P.t, 'metal'); K.box(x - 0.9, h * 0.55, z, 1.6, h * 0.42, 0.1, tc, 'paint'); },
  crown(K, P, tc, x, z, y, s) { this.tower(K, P, tc, x - 2.4 * s, z + 2.4 * s, 1.1 * s, 5 * s, y); this.tower(K, P, tc, x - 2.4 * s, z - 2.4 * s, 0.9 * s, 4 * s, y); K.seg([x + 1.8 * s, y, z], [x + 1.8 * s, y + 9 * s, z], 0.24 * s, P.t, 'metal', { taper: 0.5 }); K.box(x + 1.8 * s, y + 5.2 * s, z, 2.8 * s, 0.3 * s, 0.3 * s, P.t, 'metal'); K.sph(x + 1.8 * s, y + 9.1 * s, z, 0.55 * s, '#FF4A3A', null, { e: 3 }); K.box(x + 2.6 * s, y, z + 2.6 * s, 2.4 * s, 1.6 * s, 2 * s, P.b, 'steel', { b: 0.3 }); },
  reactor(K, P, tc) { this.pad(K, P, tc, 0, 0, 22, 18); K.lathe([[5.4, 0], [4.5, 3], [3.4, 7], [3.6, 9.6], [4.1, 11]], 3.4, 0.6, 0, '#B9B4AA', 'matte', { seg: 28 }); K.cyl(3.4, 10.7, 0, 3.85, 3.85, 0.3, '#FFC080', null, { e: 1.5, seg: 24 }); K.tor(3.4, 11.6, 0, 4.1, 0.16, tc, 'paint', { ts: 36 }); this.block(K, P, tc, -6, 0, 7, 12, 5.4, 0.6); this.pipe(K, P, tc, [[-2.5, 3.6, 3], [0, 3.2, 3.4], [1.6, 2.2, 3.4]]); this.pipe(K, P, tc, [[-2.5, 3.6, -3], [0, 3.2, -3.4], [1.6, 2.2, -3.4]]); this.tower(K, P, tc, -7.5, 4, 0.8, 5, 6); },
  pylon(K, P, tc) { this.pad(K, P, tc, 0, 0, 12, 12); K.cyl(0, 0.6, 0, 2.6, 3.2, 1.6, P.a, 'steel', { seg: 8, facet: true }); for (let i = 0; i < 4; i++) { const a = i * PI / 2 + PI / 4; K.seg([Math.cos(a) * 2.4, 2, Math.sin(a) * 2.4], [Math.cos(a) * 0.5, 15, Math.sin(a) * 0.5], 0.22, P.b, 'metal'); } for (const yy of [6, 10]) K.tor(0, yy, 0, 1.9 - yy * 0.09, 0.12, P.t, 'metal', { ts: 20 }); this.ring(K, P, tc, 0, 0, 3.4, 14); K.sph(0, 16, 0, 0.7, '#FF4A3A', null, { e: 3 }); K.box(0, 3.2, 0, 2.2, 1.2, 2.2, tc, 'paint', { b: 0.2 }); },
  turret(K, P, tc, s, twin) { K.box(0, 0, 0, 5 * s, 2 * s, 4.6 * s, P.a, 'steel', { b: 0.5 * s }); K.box(-0.6 * s, 2 * s, 0, 2.6 * s, 0.6 * s, 2.6 * s, tc, 'paint', { b: 0.2 * s }); for (const zz of twin ? [-1, 1] : [0]) { K.seg([2 * s, 1 * s, zz * 1.1 * s], [7.6 * s, 1 * s, zz * 1.1 * s], 0.36 * s, P.b, 'metal', { seg: 10 }); K.cyl(7.6 * s, 1 * s, zz * 1.1 * s, 0.55 * s, 0.55 * s, 1 * s, P.d, 'dark', { rz: -H, seg: 10 }); } K.light(-2.4 * s, 1.4 * s, 0, 0.4 * s, '#FF4040'); },
  wall(K, P, tc, gate) { K.box(0, 0, 0, 16, 0.8, 4.2, P.d, 'dark', { b: 0.2 }); if (gate) { for (const s of [-1, 1]) { K.box(s * 6.6, 0.8, 0, 2.8, 6.6, 4, P.a, 'steel', { b: 0.4 }); K.light(s * 6.6, 7.6, 0, 0.6, '#FF8A3A'); } K.box(0, 4.4, 0, 10.4, 0.8, 1.6, P.d, 'dark'); for (let i = -2; i <= 2; i++) K.box(i * 2, 0.8, 0, 0.3, 3.6, 0.3, P.b, 'metal'); } else { K.box(0, 0.8, 0, 15.6, 4.6, 3.4, P.a, 'steel', { b: 0.35 }); K.box(0, 3.6, 0, 15.8, 0.5, 3.5, tc, 'paint'); for (let i = 0; i < 4; i++) K.box(-6 + i * 4, 5.4, 0, 2.2, 0.9, 3.6, P.b, 'steel', { b: 0.15 }); } },
};
// Erevane: placas angulares escuras ("origami"), vidro fosco, costuras luminosas, agulhas com ponta acesa
KITS.erevane = {
  block(K, P, tc, x, z, w, d, h, y) { y = y || 0; const s = Math.min(w * 0.18, h * 0.5);
    K.poly([[-w / 2, 0], [w / 2, 0], [w / 2 - s, h], [-w / 2 + s * 0.6, h]], d, P.a, 'gloss', { x, y, z, b: 0.22 });
    K.poly([[-w * 0.32, 0], [w * 0.28, 0], [-w * 0.02, h * 0.42]], d * 0.86, P.b, 'glass', { x, y: y + h + 0.2, z, b: 0.08 });
    for (const sg of [-1, 1]) K.box(x, y + h * 0.5, z + sg * (d / 2 + 0.24), w * 0.78, 0.13, 0.08, tc, null, { e: 2 });
    K.box(x - w * 0.02, y + h + 0.24 + h * 0.42, z, 0.18, 0.12, d * 0.8, P.l, null, { e: 2.6 }); },
  tower(K, P, tc, x, z, r, h, y) { y = y || 0; K.cone(x, y, z, r, h, P.b, 'glass', { seg: 4, ry: PI / 4, flat: true }); K.oct(x, y + h + 0.3, z, r * 0.3, r * 0.9, P.l, null, { e: 3 }); for (let i = 0; i < 2; i++) K.poly([[0, 0], [r * 1.5, 0], [0, h * 0.55]], 0.12, P.a, 'gloss', { x, y, z, ry: i * PI / 2 + PI / 4 }); },
  pillar(K, P, tc, x, z, r, h, y) { y = y || 0; K.cyl(x, y, z, r * 0.7, r * 1.2, h, P.a, 'gloss', { seg: 4, ry: PI / 4, facet: true }); K.box(x + r * 0.62, y + h * 0.3, z, 0.1, h * 0.5, 0.2, tc, null, { e: 2 }); },
  tank(K, P, tc, x, z, r, h, y) { y = y || 0; K.cyl(x, y, z, r * 0.9, r, h, P.a, 'gloss', { seg: 6, facet: true }); K.cone(x, y + h, z, r * 0.9, r * 0.8, P.b, 'glass', { seg: 6, flat: true }); K.tor(x, y + h * 0.55, z, r * 1.0, 0.1, tc, null, { e: 2, ts: 6 }); },
  dome(K, P, tc, x, z, r, y) { y = y || 0; K.sph(x, y, z, r, P.b, 'glass', { half: true, seg: 7, flat: true }); K.tor(x, y + 0.2, z, r * 1.01, 0.12, P.l, null, { e: 2.4, ts: 7 }); },
  pad(K, P, tc, x, z, w, d, y) { y = y || 0; K.prism(x, y, z, 1, 0.5, 6, P.d, 'gloss', { sx: w / 2, sz: d / 2, ry: PI / 6 }); K.prism(x, y + 0.5, z, 1, 0.05, 6, P.c, null, { e: 1.2, sx: w / 2 - 0.4, sz: d / 2 - 0.4, ry: PI / 6, top: 0.98 }); K.prism(x, y + 0.52, z, 1, 0.06, 6, P.d, 'gloss', { sx: w / 2 - 0.8, sz: d / 2 - 0.8, ry: PI / 6 }); },
  ring(K, P, tc, x, z, R, y) { K.tor(x, y, z, R, 0.16, P.l, null, { e: 2.6, ts: 6 }); K.tor(x, y - 0.4, z, R * 0.9, 0.22, P.a, 'gloss', { ts: 6 }); },
  door(K, P, tc, x, z, w, h, y) { y = y || 0; K.poly([[0, 0], [0, h * 0.8], [0.01, h]], w, P.d, 'gloss', { x, y, z }); K.box(x + 0.05, y, z, 0.3, h * 0.9, w, P.d, 'gloss'); K.box(x + 0.25, y + h * 0.9, z, 0.12, 0.12, w * 0.9, tc, null, { e: 2.2 }); },
  pipe(K, P, tc, pts) { K.tube(pts, 0.18, P.c, null, { e: 1.6, ts: 12 }); },
  banner(K, P, tc, x, z, h) { K.seg([x, 0, z], [x, h, z], 0.1, P.d, 'gloss'); K.poly([[0, 0], [-1.6, -0.8], [-0.2, -h * 0.45]], 0.08, tc, 'paint', { x, y: h, z }); },
  crown(K, P, tc, x, z, y, s) { this.tower(K, P, tc, x, z, 2.2 * s, 12 * s, y); ringOf(3, 4.2 * s, (cx, cz, a) => K.poly([[0, 0], [2.4 * s, 0.6 * s], [0.4 * s, 4.6 * s]], 0.16, P.a, 'gloss', { x: x + cx, y: y + 3 * s, z: z + cz, ry: -a, rz: 0.25 })); K.tor(x, y + 6 * s, z, 3.2 * s, 0.14, tc, null, { e: 2.2, ts: 6 }); },
  reactor(K, P, tc) { this.pad(K, P, tc, 0, 0, 20, 18); K.oct(0, 3, 0, 3.4, 9, P.b, 'glass'); K.oct(0, 4.6, 0, 1.6, 5.4, P.l, null, { e: 2.2, ry: PI / 4 }); ringOf(4, 5.4, (cx, cz, a) => K.poly([[-1.6, 0], [1.6, 0], [0.9, 8.5], [-0.6, 7]], 0.3, P.a, 'gloss', { x: cx, y: 0.6, z: cz, ry: -a + H, rx: 0.18 })); K.tor(0, 1.4, 0, 4.2, 0.12, tc, null, { e: 2, ts: 6 }); },
  pylon(K, P, tc) { this.pad(K, P, tc, 0, 0, 12, 12); K.cone(0, 0.5, 0, 2.2, 14, P.b, 'glass', { seg: 4, ry: PI / 4, flat: true }); this.ring(K, P, tc, 0, 0, 3.2, 12); K.oct(0, 15.2, 0, 0.8, 2.2, P.l, null, { e: 3 }); for (let i = 0; i < 4; i++) K.poly([[0, 0], [2.4, 0], [0, 5.5]], 0.12, P.a, 'gloss', { y: 0.5, ry: i * H + PI / 4 }); K.box(1.0, 4, 0, 0.1, 3.4, 0.6, tc, null, { e: 2 }); },
  turret(K, P, tc, s, twin) { K.oct(0, 0, 0, 2.6 * s, 2.6 * s, P.b, 'gloss', { sx: 1.25 }); for (const zz of twin ? [-1, 1] : [0]) { K.box(3.8 * s, 1 * s, zz * 1.2 * s + 0.45 * s, 6.4 * s, 0.32 * s, 0.32 * s, P.d, 'metal'); K.box(3.8 * s, 1 * s, zz * 1.2 * s - 0.45 * s, 6.4 * s, 0.32 * s, 0.32 * s, P.d, 'metal'); K.box(3.8 * s, 1 * s, zz * 1.2 * s, 6 * s, 0.12 * s, 0.5 * s, P.l, null, { e: 2.4 }); } K.box(-0.6 * s, 1.6 * s, 0, 0.1, 0.4 * s, 2.4 * s, tc, null, { e: 2 }); },
  wall(K, P, tc, gate) { if (gate) { for (const sg of [-1, 1]) { K.cone(sg * 6.4, 0, 0, 1.9, 8.4, P.a, 'gloss', { seg: 4, ry: PI / 4, flat: true }); K.oct(sg * 6.4, 8.6, 0, 0.4, 1.1, P.l, null, { e: 3 }); } K.box(0, 3.4, 0, 10.6, 0.16, 0.3, tc, null, { e: 2.2 }); K.box(0, 0, 0, 16, 0.5, 3.6, P.d, 'gloss'); } else { K.poly([[-8, 0], [8, 0], [7, 5.8], [-7, 5.8]], 2.4, P.a, 'gloss', { b: 0.25 }); for (let i = -3; i <= 3; i++) K.poly([[-1, 0], [1, 0], [0, 2.2]], 0.5, P.b, 'glass', { x: i * 2.1, y: 6, rz: (i % 2) * 0.12 }); K.box(0, 2.6, 1.5, 14, 0.14, 0.08, tc, null, { e: 2 }); K.box(0, 2.6, -1.5, 14, 0.14, 0.08, tc, null, { e: 2 }); } },
};
// Tessara: casco orgânico cor de osso, nervuras, bulbos bioluminescentes, raízes e pétalas
KITS.tessara = {
  block(K, P, tc, x, z, w, d, h, y) { y = y || 0; K.sph(x, y, z, 1, P.a, 'bone', { half: true, sx: w / 2, sy: h * 1.15, sz: d / 2, seg: 22 }); for (let i = 0; i < 3; i++) arch(K, x, y, z, w / 2 * 1.01, h * 1.16, d / 2 * 1.01, i * PI / 3 + PI / 6, Math.max(0.16, w * 0.012), P.t, 'bone'); K.tor(x, y + 0.15, z, w / 2 * 0.98, 0.28, P.d, 'matte', { sz: d / w, ts: 36 }); K.sph(x, y + h * 1.15, z, Math.max(0.6, w * 0.06), tc, 'skin', { seg: 12 }); ringOf(4, Math.min(w, d) * 0.36, (cx, cz) => K.sph(x + cx, y + h * 0.55, z + cz, Math.max(0.3, w * 0.03), P.l, null, { e: 1.6, seg: 8 })); },
  tower(K, P, tc, x, z, r, h, y) { y = y || 0; K.tube([[x, y, z], [x + r * 0.4, y + h * 0.35, z + r * 0.2], [x - r * 0.3, y + h * 0.7, z], [x, y + h, z]], r * 0.5, P.b, 'bone', { ts: 14, rs: 8 }); K.sph(x, y + h + r * 0.6, z, r * 0.95, P.am, null, { e: 1.6, seg: 12 }); for (let i = 0; i < 3; i++) K.sph(x + Math.cos(i * 2.1) * r * 0.9, y + h * 0.5 + i * r * 0.4, z + Math.sin(i * 2.1) * r * 0.9, r * 0.55, '#6FBF7E', 'skin', { sy: 0.35, seg: 10 }); },
  pillar(K, P, tc, x, z, r, h, y) { y = y || 0; K.cyl(x, y, z, r * 0.8, r * 1.3, h, P.b, 'bone', { seg: 12 }); for (let i = 0; i < 3; i++) K.tube([[x + Math.cos(i * 2.1) * r * 1.2, y, z + Math.sin(i * 2.1) * r * 1.2], [x + Math.cos(i * 2.1 + 0.6) * r, y + h * 0.5, z + Math.sin(i * 2.1 + 0.6) * r], [x + Math.cos(i * 2.1 + 1.2) * r * 0.85, y + h, z + Math.sin(i * 2.1 + 1.2) * r * 0.85]], 0.22, P.t, 'bone', { ts: 10 }); },
  tank(K, P, tc, x, z, r, h, y) { y = y || 0; K.sph(x, y + h * 0.45, z, r, '#CDEFD6', 'wet', { sy: h / (2 * r) * 1.1, seg: 16 }); K.sph(x, y + h * 0.5, z, r * 0.45, P.l, null, { e: 1.2, seg: 10, sy: 1.6 }); for (let i = 0; i < 3; i++) arch(K, x, y + 0.1, z, r * 1.02, h * 0.9, r * 1.02, i * PI / 3, 0.12, P.t, 'bone', { ts: 12 }); },
  dome(K, P, tc, x, z, r, y) { y = y || 0; K.sph(x, y, z, r, P.b, 'bone', { half: true, seg: 18 }); ringOf(6, r * 0.9, (cx, cz, a) => K.sph(x + cx, y + r * 0.35, z + cz, r * 0.42, '#7FCF8E', 'skin', { sx: 0.5, sy: 1.4, sz: 0.8, ry: -a, seg: 10 })); K.sph(x, y + r, z, r * 0.4, P.l, null, { e: 2, seg: 12 }); },
  pad(K, P, tc, x, z, w, d, y) { y = y || 0; K.cyl(x, y, z, 1, 1.05, 0.5, P.d, 'matte', { sx: w / 2, sz: d / 2, seg: 28 }); ringOf(7, 1, (cx, cz, a) => K.tube([[x + cx * w * 0.4, y + 0.5, z + cz * d * 0.4], [x + cx * w * 0.55, y + 0.4, z + cz * d * 0.58], [x + cx * w * 0.66, y, z + cz * d * 0.7]], 0.3, P.t, 'bone', { ts: 8 })); },
  ring(K, P, tc, x, z, R, y) { K.tor(x, y, z, R, 0.3, P.t, 'bone', { ts: 36 }); ringOf(6, R, (cx, cz) => K.sph(x + cx, y + 0.35, z + cz, 0.42, P.l, null, { e: 2, seg: 8 })); },
  door(K, P, tc, x, z, w, h, y) { y = y || 0; K.sph(x, y, z, 1, P.d, 'matte', { half: true, sx: 0.6, sy: h, sz: w / 2, seg: 14 }); arch(K, x + 0.2, y, z, 0.01, h * 1.05, w / 2 * 1.05, H, 0.3, P.t, 'bone'); },
  pipe(K, P, tc, pts) { K.tube(pts, 0.3, P.t, 'bone', { ts: 12 }); },
  banner(K, P, tc, x, z, h) { K.tube([[x, 0, z], [x + 0.3, h * 0.5, z], [x, h, z]], 0.14, P.t, 'bone', { ts: 8 }); K.sph(x - 0.6, h * 0.75, z, 0.9, tc, 'skin', { sx: 0.8, sy: 1.3, sz: 0.15, seg: 10 }); },
  crown(K, P, tc, x, z, y, s) { K.tube([[x, y, z], [x + 0.6 * s, y + 4 * s, z], [x, y + 7 * s, z]], 0.9 * s, P.b, 'bone', { ts: 10 }); ringOf(6, 2.2 * s, (cx, cz, a) => K.sph(x + cx, y + 7.4 * s, z + cz, 1.6 * s, i6(a) ? '#8FD8A0' : '#B9E8C2', 'skin', { sx: 0.4, sy: 1.5, sz: 0.9, ry: -a, rz: 0.6, seg: 10 })); K.sph(x, y + 7.8 * s, z, 1.5 * s, P.l, null, { e: 2.2, seg: 14 }); },
  reactor(K, P, tc) { this.pad(K, P, tc, 0, 0, 20, 18); K.sph(0, 5, 0, 4.6, '#D98A5A', 'wet', { sy: 1.15, seg: 22 }); for (let i = 0; i < 5; i++) arch(K, 0, 0.5, 0, 4.7, 10, 4.7, i * PI / 5, 0.22, '#7A2E28', 'wet', { ts: 16 }); K.sph(0, 5.3, 0, 1.6, P.am, null, { e: 2.4, seg: 12 }); this.tower(K, P, tc, -6, 4, 0.9, 6, 0.4); this.tower(K, P, tc, 5.5, -4.5, 0.7, 4.5, 0.4); },
  pylon(K, P, tc) { this.pad(K, P, tc, 0, 0, 12, 12); this.tower(K, P, tc, 0, 0, 1.6, 13, 0.4); this.ring(K, P, tc, 0, 0, 3.2, 9.5); K.box(0.9, 3, 0, 0.5, 1.4, 1.6, tc, 'skin', { b: 0.2 }); },
  turret(K, P, tc, s, twin) { K.sph(0, 1.4 * s, 0, 2.4 * s, P.a, 'bone', { sx: 1.25, sy: 0.8, seg: 16 }); for (const zz of twin ? [-1, 1] : [0]) { K.seg([1.6 * s, 1.5 * s, zz * 1.1 * s], [7 * s, 1.7 * s, zz * 1.1 * s], 0.5 * s, P.b, 'bone', { taper: 0.7, seg: 10 }); K.sph(7 * s, 1.7 * s, zz * 1.1 * s, 0.4 * s, P.l, null, { e: 2.2, seg: 8 }); } K.sph(-1.8 * s, 2.2 * s, 0, 0.8 * s, tc, 'skin', { seg: 10 }); },
  wall(K, P, tc, gate) { if (gate) { for (const sg of [-1, 1]) { this.pillar(K, P, tc, sg * 6.4, 0, 1.2, 7.4, 0); K.sph(sg * 6.4, 8, 0, 1.1, P.l, null, { e: 1.8, seg: 10 }); } arch(K, 0, 0, 0, 6.4, 7.6, 0.01, 0, 0.35, P.t, 'bone'); K.box(0, 0, 0, 16, 0.4, 3.6, P.d, 'matte'); } else { K.box(0, 0, 0, 16, 0.6, 3.4, P.d, 'matte', { b: 0.25 }); for (let i = -3; i <= 3; i++) { arch(K, i * 2.25, 0.4, 0, 0.01, 4.6 - Math.abs(i) * 0.25, 1.3, H, 0.32, P.b, 'bone', { ts: 12 }); K.cone(i * 2.25, 4.2 - Math.abs(i) * 0.25, 0, 0.32, 1.8, P.t, 'bone', { seg: 8, rz: (i % 2) * 0.25 }); } K.seg([-7.4, 2.4, 0], [7.4, 2.4, 0], 0.24, P.t, 'bone'); ringOf(3, 1, (cx, cz, a, i) => K.sph(-5 + i * 5, 3, 0, 0.35, P.l, null, { e: 1.6, seg: 8 })); } },
};
function i6(a) { return Math.round(a * 6 / (PI * 2)) % 2 === 0; }
// Coro Quorith: cristal facetado claro, núcleos de ametista, anéis flutuantes, nada encosta no chão por inteiro
KITS.quorith = {
  block(K, P, tc, x, z, w, d, h, y) { y = y || 0; K.prism(x, y, z, 1, 0.6, 6, P.d, 'gloss', { sx: w / 2 + 0.6, sz: d / 2 + 0.6 }); K.prism(x, y + 0.6, z, 1, h * 0.8, 6, P.a, 'crystal', { sx: w / 2, sz: d / 2, top: 0.86 }); K.prism(x, y + 0.6 + h * 0.8, z, 0.86, h * 0.35, 6, P.b, 'crystal', { sx: w / 2, sz: d / 2, top: 0.35 }); K.prism(x, y + h * 0.45, z, 1.005, 0.22, 6, P.c, null, { e: 2.2, sx: w / 2, sz: d / 2, top: 1 }); K.oct(x, y + 0.6 + h * 1.15 + 0.6, z, Math.min(w, d) * 0.1, Math.min(w, d) * 0.3, tc, null, { e: 1.6 }); },
  tower(K, P, tc, x, z, r, h, y) { y = y || 0; K.prism(x, y, z, r, h * 0.75, 6, P.a, 'crystal', { top: 0.55 }); K.cone(x, y + h * 0.75, z, r * 0.55, h * 0.3, P.b, 'crystal', { seg: 6, flat: true }); K.oct(x, y + h * 1.12, z, r * 0.4, r * 1.3, P.c, null, { e: 2.6 }); K.tor(x, y + h * 0.95, z, r * 1.4, 0.12, P.l, null, { e: 2, ts: 6 }); },
  pillar(K, P, tc, x, z, r, h, y) { y = y || 0; K.prism(x, y, z, r * 1.2, h, 6, P.a, 'crystal', { top: 0.8 }); K.prism(x, y + h * 0.5, z, r * 1.2 * 0.9 + 0.02, 0.3, 6, P.c, null, { e: 2.2, top: 1 }); },
  tank(K, P, tc, x, z, r, h, y) { y = y || 0; K.oct(x, y, z, r, h, P.a, 'crystal'); K.oct(x + r * 0.7, y, z + r * 0.4, r * 0.5, h * 0.6, P.b, 'crystal', { rz: -0.4 }); K.oct(x - r * 0.6, y, z - r * 0.5, r * 0.45, h * 0.55, P.b, 'crystal', { rz: 0.35 }); K.oct(x, y + h * 0.35, z, r * 0.4, h * 0.3, P.c, null, { e: 2 }); },
  dome(K, P, tc, x, z, r, y) { y = y || 0; K.sph(x, y, z, r, P.b, 'crystal', { half: true, seg: 6, flat: true }); K.oct(x, y + r * 1.1, z, r * 0.35, r * 0.9, P.c, null, { e: 2.4 }); K.tor(x, y + r * 0.9, z, r * 0.9, 0.12, P.l, null, { e: 2, ts: 6 }); },
  pad(K, P, tc, x, z, w, d, y) { y = y || 0; K.prism(x, y, z, 1, 0.5, 6, P.d, 'gloss', { sx: w / 2, sz: d / 2 }); K.prism(x, y + 0.5, z, 1, 0.06, 6, P.c, null, { e: 1.4, sx: w / 2 - 0.5, sz: d / 2 - 0.5 }); K.prism(x, y + 0.52, z, 1, 0.08, 6, P.d, 'gloss', { sx: w / 2 - 0.9, sz: d / 2 - 0.9 }); },
  ring(K, P, tc, x, z, R, y) { K.tor(x, y, z, R, 0.18, P.l, null, { e: 2.4, ts: 6 }); K.tor(x, y + 0.6, z, R * 0.8, 0.14, P.a, 'crystal', { ts: 6, rx: 0.2 }); },
  door(K, P, tc, x, z, w, h, y) { y = y || 0; K.box(x, y + 0.3, z, 0.3, h, 0.28, P.c, null, { e: 2.2 }); K.oct(x, y + h + 0.6, z, 0.4, 1.2, tc, null, { e: 1.6 }); },
  pipe(K, P, tc, pts) { K.tube(pts, 0.12, P.l, null, { e: 2.2, ts: 12 }); },
  banner(K, P, tc, x, z, h) { K.oct(x, 0, z, 0.5, h, P.a, 'crystal'); K.oct(x, h * 0.7, z, 0.4, 1.4, tc, null, { e: 1.4 }); },
  crown(K, P, tc, x, z, y, s) { K.oct(x, y + 2.4 * s, z, 3 * s, 9 * s, P.a, 'crystal', { ry: PI / 4 }); K.oct(x, y + 5.2 * s, z, 1.3 * s, 3.6 * s, P.c, null, { e: 2.6 }); K.tor(x, y + 6.8 * s, z, 4.4 * s, 0.2 * s, P.t, 'crystal', { rx: 0.35, ts: 6 }); K.tor(x, y + 6.8 * s, z, 3.8 * s, 0.14 * s, P.l, null, { e: 2.2, rz: 0.4, ts: 6 }); },
  reactor(K, P, tc) { this.pad(K, P, tc, 0, 0, 20, 18); K.oct(0, 2, 0, 2.6, 11, P.a, 'crystal'); K.oct(0, 4.6, 0, 1.2, 5.6, P.c, null, { e: 2.8 }); K.tor(0, 7.5, 0, 4.4, 0.24, P.t, 'crystal', { rx: 0.5, ts: 6 }); K.tor(0, 7.5, 0, 4.4, 0.24, P.t, 'crystal', { rz: 0.5, ts: 6 }); ringOf(5, 6.6, (cx, cz, a) => K.oct(cx, 0.5, cz, 0.9, 3.4, P.b, 'crystal', { rz: Math.cos(a) * 0.3, rx: Math.sin(a) * 0.3 })); },
  pylon(K, P, tc) { this.pad(K, P, tc, 0, 0, 12, 12); K.prism(0, 0.5, 0, 1.8, 3, 6, P.b, 'crystal', { top: 0.6 }); K.oct(0, 5.2, 0, 1.9, 8.6, P.a, 'crystal'); K.oct(0, 7.5, 0, 0.8, 3.6, P.c, null, { e: 2.6 }); this.ring(K, P, tc, 0, 0, 3.1, 13.6); K.oct(0, 15, 0, 0.6, 1.6, tc, null, { e: 1.8 }); },
  turret(K, P, tc, s, twin) { K.prism(0, 0, 0, 2.2 * s, 1.4 * s, 6, P.a, 'crystal', { top: 0.8 }); for (const zz of twin ? [-1, 1] : [0]) { K.oct(3.4 * s, 0.4 * s, zz * 1.1 * s, 0.7 * s, 1.4 * s, P.a, 'crystal', { rz: -H, sy: 3.4 }); K.oct(6.6 * s, 0.4 * s, zz * 1.1 * s, 0.3 * s, 0.7 * s, P.c, null, { e: 2.6, rz: -H }); } K.oct(0, 1.4 * s, 0, 0.8 * s, 1.8 * s, tc, null, { e: 1.6 }); },
  wall(K, P, tc, gate) { K.prism(0, 0, 0, 1, 0.5, 6, P.d, 'gloss', { sx: 8.2, sz: 2 }); if (gate) { for (const sg of [-1, 1]) { K.prism(sg * 6.4, 0.5, 0, 1.6, 7.4, 6, P.a, 'crystal', { top: 0.4 }); K.oct(sg * 6.4, 8.4, 0, 0.5, 1.4, P.c, null, { e: 2.4 }); } K.box(0, 4, 0, 10.6, 0.16, 0.16, P.l, null, { e: 2.6 }); K.box(0, 2.2, 0, 10.6, 0.16, 0.16, P.l, null, { e: 2.6 }); } else { for (let i = -3; i <= 3; i++) K.oct(i * 2.25, 0.4, (i % 2) * 0.4, 1.3, 5.8 + (i % 2 ? -0.8 : 0.6), i % 3 ? P.a : P.b, 'crystal', { ry: i * 0.5 }); K.box(0, 2.4, 0, 15, 0.14, 0.14, tc, null, { e: 2 }); } },
};
// Prole Vorag: quitina úmida escura, placas sobrepostas, espinhos de osso, sacos membranosos e poros acesos
KITS.vorag = {
  block(K, P, tc, x, z, w, d, h, y) { y = y || 0; K.sph(x, y, z, 1, P.a, 'chitin', { half: true, sx: w / 2, sy: h * 1.1, sz: d / 2, seg: 20 }); ringOf(5, 1, (cx, cz, a) => K.sph(x + cx * w * 0.28, y + h * 0.35, z + cz * d * 0.28, 1, P.b, 'chitin', { sx: w * 0.24, sy: h * 0.62, sz: d * 0.2, ry: -a, seg: 12 })); ringOf(6, 1, (cx, cz, a) => K.cone(x + cx * w * 0.42, y + h * 0.42, z + cz * d * 0.42, Math.max(0.3, w * 0.04), Math.max(1.6, h * 0.5), P.bo, 'bone', { seg: 8, rz: -cx * 0.7, rx: cz * 0.7 })); ringOf(4, 1, (cx, cz) => K.sph(x + cx * w * 0.3, y + h * 0.82, z + cz * d * 0.3, Math.max(0.3, w * 0.03), P.l, null, { e: 2, seg: 8 })); K.sph(x, y + h * 1.08, z, Math.max(0.5, w * 0.06), tc, 'wet', { seg: 10 }); },
  tower(K, P, tc, x, z, r, h, y) { y = y || 0; const pts = [[x, y, z], [x + r * 0.3, y + h * 0.4, z + r * 0.2], [x + r * 0.9, y + h * 0.8, z], [x + r * 1.8, y + h, z - r * 0.2]]; for (let i = 0; i < 3; i++) K.seg(pts[i], pts[i + 1], r * (1 - i * 0.28), P.bo, 'bone', { taper: 0.72, seg: 10 }); K.sph(x, y + 0.4, z, r * 1.3, P.a, 'chitin', { half: true, seg: 12 }); },
  pillar(K, P, tc, x, z, r, h, y) { y = y || 0; K.cyl(x, y, z, r * 0.7, r * 1.3, h, P.a, 'chitin', { seg: 10 }); for (let i = 0; i < 4; i++) K.tor(x, y + h * (0.2 + i * 0.2), z, r * (1.2 - i * 0.12), 0.25, P.bo, 'bone', { ts: 18 }); },
  tank(K, P, tc, x, z, r, h, y) { y = y || 0; K.sph(x, y + h * 0.5, z, r, P.m, 'wet', { sy: h / (2 * r), seg: 16 }); for (let i = 0; i < 3; i++) arch(K, x, y + 0.2, z, r * 1.02, h * 0.95, r * 1.02, i * PI / 3, 0.1, '#FF8A8A', null, { e: 1.3, ts: 12 }); K.tor(x, y + 0.3, z, r * 0.95, 0.3, P.bo, 'bone', { ts: 20 }); },
  dome(K, P, tc, x, z, r, y) { y = y || 0; K.sph(x, y, z, r, P.m, 'wet', { half: true, seg: 16 }); for (let i = 0; i < 3; i++) arch(K, x, y, z, r * 1.01, r * 1.01, r * 1.01, i * PI / 3, 0.1, '#FF8A8A', null, { e: 1.4, ts: 12 }); K.sph(x, y + r, z, r * 0.25, P.l, null, { e: 2.4, seg: 8 }); },
  pad(K, P, tc, x, z, w, d, y) { y = y || 0; K.sph(x, y, z, 1, '#3A1A28', 'wet', { half: true, sx: w / 2, sy: 0.5, sz: d / 2, seg: 22 }); ringOf(6, 1, (cx, cz) => K.tube([[x + cx * w * 0.3, y + 0.3, z + cz * d * 0.3], [x + cx * w * 0.5, y + 0.25, z + cz * d * 0.46 + 0.6], [x + cx * w * 0.62, y, z + cz * d * 0.6]], 0.26, P.b, 'wet', { ts: 8 })); },
  ring(K, P, tc, x, z, R, y) { ringOf(8, R, (cx, cz) => K.cone(x + cx, y - 0.4, z + cz, 0.32, 1.6, P.bo, 'bone', { seg: 8, rz: -cx / R * 0.4, rx: cz / R * 0.4 })); K.tor(x, y - 0.3, z, R, 0.18, P.l, null, { e: 1.6, ts: 24 }); },
  door(K, P, tc, x, z, w, h, y) { y = y || 0; K.sph(x, y, z, 1, '#140A0F', 'wet', { half: true, sx: 0.5, sy: h, sz: w / 2, seg: 12 }); for (let i = -2; i <= 2; i++) K.cone(x + 0.2, y + h * 0.9 - Math.abs(i) * h * 0.12, z + i * w * 0.18, 0.18, h * 0.32, P.bo, 'bone', { seg: 6, rz: PI }); },
  pipe(K, P, tc, pts) { K.tube(pts, 0.32, P.b, 'wet', { ts: 12 }); },
  banner(K, P, tc, x, z, h) { this.tower(K, P, tc, x, z, 0.35, h, 0); K.sph(x + 0.3, h * 0.55, z, 0.8, tc, 'wet', { sx: 0.6, sy: 1.2, seg: 10 }); },
  crown(K, P, tc, x, z, y, s) { ringOf(5, 2.4 * s, (cx, cz) => K.sph(x + cx, y + 1.4 * s, z + cz, 1.2 * s, P.bo, 'bone', { sy: 1.5, seg: 12 })); K.sph(x, y + 2.6 * s, z, 2 * s, P.m, 'wet', { sy: 1.4, seg: 16 }); K.sph(x, y + 2.8 * s, z, 0.9 * s, P.l, null, { e: 2.2, seg: 10 }); ringOf(4, 3.6 * s, (cx, cz) => this.tower(K, P, tc, x + cx, z + cz, 0.5 * s, 6 * s, y)); },
  reactor(K, P, tc) { this.pad(K, P, tc, 0, 0, 20, 18); K.sph(0, 5, 0, 4.4, P.m, 'wet', { sy: 1.15, seg: 20 }); for (let i = 0; i < 5; i++) arch(K, 0, 0.4, 0, 4.5, 10.2, 4.5, i * PI / 5, 0.2, '#FF8A8A', null, { e: 1.4, ts: 16 }); K.tor(0, 1, 0, 4.6, 0.5, P.bo, 'bone', { ts: 28 }); ringOf(5, 6.4, (cx, cz) => this.tower(K, P, tc, cx, cz, 0.55, 4.5, 0.2)); },
  pylon(K, P, tc) { this.pad(K, P, tc, 0, 0, 12, 12); this.pillar(K, P, tc, 0, 0, 1.6, 10, 0.3); K.sph(0, 12, 0, 1.8, P.bo, 'bone', { sy: 1.4, seg: 14 }); K.sph(0, 12.2, 0, 0.8, P.l, null, { e: 2.4, seg: 10 }); this.ring(K, P, tc, 0, 0, 3.2, 10.6); K.sph(1.2, 4, 0, 0.6, tc, 'wet', { seg: 8 }); },
  turret(K, P, tc, s, twin) { K.sph(0, 1.2 * s, 0, 2.2 * s, P.a, 'chitin', { sy: 0.75, seg: 14 }); for (const zz of twin ? [-1, 1] : [0]) { K.seg([1.4 * s, 1.4 * s, zz * 1.1 * s], [6.4 * s, 1.6 * s, zz * 1.1 * s], 0.55 * s, P.b, 'wet', { taper: 0.6, seg: 10 }); K.sph(6.4 * s, 1.6 * s, zz * 1.1 * s, 0.38 * s, P.ac, null, { e: 2, seg: 8 }); } K.sph(-1.5 * s, 1.9 * s, 0, 1 * s, P.m, 'wet', { seg: 12 }); ringOf(4, 1.6 * s, (cx, cz) => K.cone(cx - 0.4 * s, 2 * s, cz, 0.22 * s, 1.4 * s, P.bo, 'bone', { seg: 6 })); },
  wall(K, P, tc, gate) { K.sph(0, 0, 0, 1, '#3A1A28', 'wet', { half: true, sx: 8.4, sy: 0.6, sz: 2.4, seg: 16 }); if (gate) { for (const sg of [-1, 1]) this.pillar(K, P, tc, sg * 6.4, 0, 1.3, 7.2, 0.2); arch(K, 0, 0, 0, 6.4, 7.4, 0.01, 0, 0.4, P.bo, 'bone'); K.sph(0, 7.4, 0, 0.6, P.l, null, { e: 2.2, seg: 8 }); } else { for (let i = -3; i <= 3; i++) K.sph(i * 2.2, 1.6, 0, 1.6, i % 2 ? P.a : P.b, 'chitin', { sy: 1.6, seg: 10 }); for (let i = -3; i <= 3; i++) K.cone(i * 2.2 + 0.6, 3.2, 0, 0.35, 2.8, P.bo, 'bone', { seg: 8, rz: -0.5 }); K.box(0, 2.4, 1.7, 13, 0.14, 0.1, tc, null, { e: 1.4 }); } },
};

// ---------- receitas de construção: mesma planta para todas as Raças, formas do kit da Raça ----------
const QUAD = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const BLD = {
  nucleo(K, k, P, tc) { k.pad(K, P, tc, 0, 0, 30, 30); k.block(K, P, tc, 0, 0, 22, 22, 7, 0.6); k.block(K, P, tc, 0, 0, 13, 13, 5.5, 7.8); k.crown(K, P, tc, 0, 0, 13.6, 1); for (const [sx, sz] of QUAD) k.tower(K, P, tc, sx * 12.2, sz * 12.2, 1.3, 8, 0.6); k.door(K, P, tc, 11.4, 0, 5, 4.2, 0.6); k.ring(K, P, tc, 0, 0, 9.4, 8.3); },
  reator(K, k, P, tc) { k.reactor(K, P, tc); },
  refinaria(K, k, P, tc) { k.pad(K, P, tc, 0, 0, 24, 20); k.block(K, P, tc, -5, 0, 10, 14, 5.2, 0.6); k.tank(K, P, tc, 5, -4.6, 2.9, 6, 0.6); k.tank(K, P, tc, 5, 4.6, 2.9, 6, 0.6); k.pipe(K, P, tc, [[-1.5, 4.2, -2.5], [1.2, 6.8, -3.6], [3.4, 7.4, -4.6]]); k.pipe(K, P, tc, [[-1.5, 4.2, 2.5], [1.2, 6.8, 3.6], [3.4, 7.4, 4.6]]); k.door(K, P, tc, 0.2, 0, 4, 3, 0.6); },
  quartel(K, k, P, tc) { k.pad(K, P, tc, 0, 0, 26, 22); k.block(K, P, tc, -2, 0, 18, 14, 6, 0.6); k.block(K, P, tc, -4, 0, 9, 8, 3.2, 6.8); k.door(K, P, tc, 7.2, 0, 5, 4, 0.6); k.banner(K, P, tc, 9.4, 6.6, 7.4); k.banner(K, P, tc, 9.4, -6.6, 7.4); k.tower(K, P, tc, -10.6, -8.4, 1.1, 6.5, 0.6); },
  fabrica(K, k, P, tc) { k.pad(K, P, tc, 0, 0, 28, 24); k.block(K, P, tc, -3, 0, 20, 17, 8, 0.6); k.door(K, P, tc, 7.2, 0, 9, 6, 0.6); k.tower(K, P, tc, -11.6, 9.6, 1.3, 10, 0.6); k.tower(K, P, tc, -11.6, -9.6, 1.0, 7.5, 0.6); k.pipe(K, P, tc, [[-11, 8.6, 6], [-4, 10.6, 2], [4, 9.4, -2]]); k.tank(K, P, tc, 10.6, -9.2, 1.8, 3.4, 0.6); },
  hangar(K, k, P, tc) { k.pad(K, P, tc, 0, 0, 26, 26); k.block(K, P, tc, -8, 0, 8, 22, 7, 0.6); k.ring(K, P, tc, 4.5, 0, 6, 0.9); k.ring(K, P, tc, 4.5, 0, 3.4, 0.9); k.tower(K, P, tc, -11.4, 11.4, 1, 12, 0.6); k.dome(K, P, tc, 10.4, -10, 1.8, 0.6); },
  torre_base(K, k, P, tc) { k.pad(K, P, tc, 0, 0, 11, 11); k.block(K, P, tc, 0, 0, 8.6, 8.6, 2.8, 0.6); k.pillar(K, P, tc, 0, 0, 2.4, 8, 3.4); K.mount = 11.4; },
  torre_turret(K, k, P, tc) { k.turret(K, P, tc, 0.9, false); },
  bastiao_base(K, k, P, tc) { k.pad(K, P, tc, 0, 0, 20, 20); k.block(K, P, tc, 0, 0, 16, 16, 9, 0.6); for (const [sx, sz] of QUAD) k.tower(K, P, tc, sx * 8.4, sz * 8.4, 1.4, 11, 0.6); k.pillar(K, P, tc, 0, 0, 3.2, 3.4, 9.6); K.mount = 13; },
  bastiao_turret(K, k, P, tc) { k.turret(K, P, tc, 1.35, true); },
  nodulo(K, k, P, tc) { k.pylon(K, P, tc); },
  laboratorio(K, k, P, tc) { k.pad(K, P, tc, 0, 0, 24, 20); k.block(K, P, tc, -3, 0, 16, 14, 5, 0.6); k.dome(K, P, tc, 6.4, 0, 4.2, 0.6); k.tower(K, P, tc, -9.6, 6.4, 0.9, 9, 0.6); k.tank(K, P, tc, -9.6, -6, 1.6, 3, 0.6); k.pipe(K, P, tc, [[3, 2.6, 3.4], [5, 3.2, 3.6], [6.6, 4.4, 2.6]]); },
  muro(K, k, P, tc) { k.wall(K, P, tc, false); },
  portao(K, k, P, tc) { k.wall(K, P, tc, true); },
};

// ---------- receitas de unidade por Raça ----------
const U = {};
U.vehnar = {
  infantaria(K, P, tc, o) { o = o || {};
    for (const s of [-1, 1]) { K.seg([0, 0.4, s * 0.8], [0.15, 3.2, s * 0.75], 0.55, P.d, 'dark'); K.box(0.35, 0, s * 0.8, 1.7, 0.6, 1.1, P.d, 'rubber', { b: 0.2 }); }
    K.box(0, 3, 0, 2.4, 3.2, 3, P.a, 'steel', { b: 0.45 }); K.box(0.95, 3.5, 0, 0.6, 2.2, 2.3, tc, 'paint', { b: 0.15 });
    for (const s of [-1, 1]) K.sph(0, 5.9, s * 1.7, 0.85, tc, 'paint', { seg: 12 });
    K.box(-1.55, 3.4, 0, 1.2, 2.6, 2.2, P.b, 'steel', { b: 0.3 }); K.sph(0.1, 6.9, 0, 1.15, P.b, 'steel', { seg: 14 }); K.box(1.15, 6.62, 0, 0.5, 0.5, 1.5, P.g, null, { e: 1.8 });
    K.seg([0.1, 5.5, 1.5], [1.3, 4.6, 1.0], 0.38, P.a, 'steel'); K.seg([0.1, 5.5, -1.5], [1.7, 4.6, 0.3], 0.38, P.a, 'steel');
    if (!o.noRifle) { K.box(2.2, 4.3, 0.95, 4, 0.55, 0.55, P.d, 'metal', { b: 0.12 }); K.box(3.7, 4.15, 0.95, 1.4, 0.85, 0.5, P.b, 'metal'); } },
  coletor(K, P, tc) { for (const x of [-3.5, 0, 3.5]) for (const s of [-1, 1]) wheel(K, P, x, 1.1, s * 3.2, 1.1, 0.9);
    K.box(0, 1.1, 0, 10, 1.4, 5.6, P.d, 'dark', { b: 0.3 }); K.box(3.4, 2.5, 0, 3.2, 3, 5, P.a, 'steel', { b: 0.5 }); K.box(4.75, 3.6, 0, 0.9, 1.4, 4.2, P.g, 'glass', { b: 0.2 });
    K.box(-1.6, 2.5, 0, 6, 2.6, 5.4, tc, 'paint', { b: 0.4 }); K.box(-1.6, 5.1, 0, 5.4, 0.3, 4.8, P.b, 'steel');
    K.poly([[0, 0], [1.6, 0.4], [1.6, 2.4], [0, 2.8]], 5.8, P.t, 'metal', { x: 5.2, y: 0.4 });
    K.light(5.05, 4.9, 1.8, 0.4, P.l); K.light(5.05, 4.9, -1.8, 0.4, P.l); K.light(-4.7, 2.8, 0, 0.5, '#FF4040'); },
  veiculo_hull(K, P, tc) { for (const s of [-1, 1]) track(K, P, 0, s * 3.5, 13, 2.4, 2.2);
    K.poly([[-6.2, 1.2], [5.2, 1.2], [6.6, 2.6], [5.4, 4.0], [-5.6, 4.0], [-6.4, 2.8]], 5.2, P.a, 'steel', { b: 0.3 });
    K.box(-0.4, 4.25, 0, 7.6, 0.2, 5, tc, 'paint'); K.light(6.25, 3.1, 2, 0.45, P.l); K.light(6.25, 3.1, -2, 0.45, P.l); K.light(-6.45, 3.0, 0, 0.5, '#FF4040'); K.mount = 4.3; },
  veiculo_turret(K, P, tc) { KITS.vehnar.turret(K, P, tc, 0.85, false); },
  drone(K, P, tc) { K.box(0, 1.2, 0, 4, 1.6, 3, P.a, 'steel', { b: 0.5 }); K.box(0.4, 2.8, 0, 2, 0.5, 2, tc, 'paint', { b: 0.2 });
    for (const [sx, sz] of QUAD) { K.seg([0, 2, 0], [sx * 3.4, 2.3, sz * 3.4], 0.25, P.d, 'metal'); K.tor(sx * 3.4, 2.3, sz * 3.4, 1.6, 0.14, P.d, 'metal', { ts: 20 }); K.cyl(sx * 3.4, 2.15, sz * 3.4, 1.5, 1.5, 0.06, '#9AA3AD', 'glass'); K.light(sx * 3.4, 2.5, sz * 3.4, 0.3, P.l); }
    K.box(1.6, 0, 0, 1.4, 1.2, 0.8, P.d, 'metal'); K.seg([2.2, 0.5, 0], [4.2, 0.5, 0], 0.18, P.d, 'metal'); K.light(-2.1, 1.8, 0, 0.4, '#FF4040'); },
  suporte(K, P, tc) { K.box(0, 0.6, 0, 7, 1.8, 5, P.a, 'steel', { b: 0.5 }); K.box(0, 2.4, 0, 5, 0.6, 3.6, tc, 'paint', { b: 0.2 });
    K.cyl(-0.5, 3, 0, 0.4, 0.5, 2.2, P.b, 'metal'); K.lathe([[0.2, 0], [1.4, 0.35], [2.4, 1.1], [2.6, 1.3], [2.4, 1.38], [1.3, 0.62], [0, 0.32]], -0.5, 5.2, 0, P.t, 'metal', { rz: -0.5 }); K.sph(-0.2, 5.8, 0, 0.35, '#7FE3A1', null, { e: 2.6 });
    for (const s of [-1, 1]) K.cyl(0, 0, s * 1.8, 1.2, 1.4, 0.6, '#3FE6CF', null, { e: 1.4 }); K.light(3.6, 1.6, 0, 0.45, P.l); },
  pirata(K, P, tc) { for (const x of [-4, -1.2, 3.6]) for (const s of [-1, 1]) wheel(K, P, x, 1.3, s * 3.6, 1.3, 1.1);
    K.box(0, 1.2, 0, 12, 1.4, 6, P.d, 'dark', { b: 0.3 }); K.box(3.8, 2.6, 0, 3.6, 3.4, 5.6, tc, 'paint', { b: 0.5 }); K.box(5.25, 3.8, 0, 0.9, 1.6, 4.6, P.g, 'glass', { b: 0.2 });
    K.box(-2, 2.6, 0, 6, 1.2, 5.6, P.a, 'steel', { b: 0.3 }); K.cyl(-3.4, 3.8, 0, 1.1, 1.3, 1.2, P.b, 'metal'); K.seg([-3.4, 4.6, 0], [-6.8, 8.4, 0], 0.45, P.h, 'paint'); K.seg([-6.8, 8.4, 0], [-7.4, 5.4, 0], 0.1, P.d, 'metal'); K.tor(-7.4, 5.0, 0, 0.5, 0.14, P.t, 'metal', { rx: H });
    K.light(5.65, 5.6, 1.9, 0.4, P.l); K.light(5.65, 5.6, -1.9, 0.4, P.l); K.light(5.65, 5.6, 0, 0.4, '#FFA03A'); },
  soldador(K, P, tc) { U.vehnar.infantaria(K, P, tc, { noRifle: true }); for (const s of [-1, 1]) K.cyl(-1.95, 3.1, s * 0.7, 0.62, 0.62, 3.4, P.h, 'paint', { seg: 12 });
    K.seg([1, 4.3, 1], [4.4, 4.1, 1], 0.32, P.d, 'metal'); K.cyl(4.4, 4.1, 1, 0.52, 0.34, 0.9, P.b, 'metal', { rz: -H }); K.light(5.45, 4.1, 1, 0.34, '#FF7A2E', 3); K.tube([[-1.9, 3.6, 0.6], [-0.6, 3, 1.4], [1, 4.1, 1.1]], 0.15, P.d, 'rubber'); },
  guindaste(K, P, tc) { for (const x of [-4, 0, 4]) for (const s of [-1, 1]) wheel(K, P, x, 1.2, s * 3.5, 1.2, 1);
    K.box(0, 1.1, 0, 12, 1.4, 6, P.d, 'dark', { b: 0.3 }); K.box(4.2, 2.5, 0, 3.4, 3.2, 5.6, P.h, 'paint', { b: 0.5 }); K.box(5.55, 3.6, 0, 0.9, 1.5, 4.6, P.g, 'glass', { b: 0.2 });
    K.cyl(-2, 2.5, 0, 1.6, 1.9, 1.4, P.b, 'metal'); K.seg([-2, 3.6, 0], [-7, 10, 0], 0.5, P.h, 'paint'); K.seg([-2.4, 3.6, 0.5], [-6.8, 9.6, 0.5], 0.14, P.d, 'metal'); K.seg([-7, 10, 0], [-7, 6.4, 0], 0.08, P.d, 'metal');
    K.box(-7, 5.4, 0, 1.2, 1, 1.2, P.d, 'metal'); K.sph(-7, 5.2, 0, 0.45, '#7FE3A1', null, { e: 2.2 }); K.box(-3, 2.5, 0, 5, 0.8, 5.4, tc, 'paint', { b: 0.2 });
    K.light(6.05, 5.4, 2, 0.4, P.l); K.light(6.05, 5.4, -2, 0.4, P.l); K.light(4.2, 5.9, 0, 0.5, '#FFA03A'); },
  tratorzao(K, P, tc) { for (const x of [-3, 3]) for (const s of [-1, 1]) wheel(K, P, x, 1.6, s * 3.4, 1.6, 1.3);
    K.box(0, 1.4, 0, 8.4, 1.2, 4.4, P.a, 'steel', { b: 0.4 }); K.box(1.6, 2.6, 0, 2.4, 0.4, 4, tc, 'paint', { b: 0.15 });
    for (const s of [-1, 1]) { K.seg([-2.4, 2.6, s * 1.8], [-1, 5, s * 1.6], 0.16, P.d, 'metal'); K.seg([1.4, 2.6, s * 1.8], [-0.2, 5, s * 1.6], 0.16, P.d, 'metal'); }
    K.seg([-1, 5, -1.6], [-1, 5, 1.6], 0.16, P.d, 'metal'); K.seg([-0.2, 5, -1.6], [-0.2, 5, 1.6], 0.16, P.d, 'metal'); K.box(-0.6, 5.1, 0, 1.2, 0.6, 1, P.b, 'metal'); K.seg([0, 5.5, 0], [2.8, 5.5, 0], 0.16, P.d, 'metal');
    K.light(4.3, 2.2, 1.4, 0.4, P.l); K.light(4.3, 2.2, -1.4, 0.4, P.l); },
  prensa(K, P, tc) { for (const s of [-1, 1]) { leg(K, [0, 6.4, s * 2.4], [1.4, 3.4, s * 2.8], [0, 0.6, s * 2.8], 0.8, P.b, 'steel'); K.box(0.6, 0, s * 2.8, 3.2, 0.8, 2, P.d, 'dark', { b: 0.3 }); }
    K.box(0, 6, 0, 4, 1.6, 5.4, P.d, 'dark', { b: 0.4 }); K.box(0, 7.4, 0, 5.4, 3.8, 5, P.a, 'steel', { b: 0.6 }); K.box(2.65, 8.6, 0, 0.6, 1.2, 3, P.g, 'glass', { b: 0.2 }); K.box(-0.4, 11.2, 0, 3.6, 0.5, 3.6, tc, 'paint', { b: 0.2 });
    for (const s of [-1, 1]) { K.box(0.4, 8.2, s * 3.4, 3, 2, 1.6, P.b, 'steel', { b: 0.3 }); K.seg([1.8, 9.1, s * 3.4], [7.4, 9.1, s * 3.4], 0.42, P.d, 'metal'); K.cyl(7.4, 9.1, s * 3.4, 0.6, 0.6, 0.9, P.d, 'dark', { rz: -H }); }
    K.light(-2.85, 9.6, 0, 0.5, '#FF4040'); },
};
U.erevane = {
  infantaria(K, P, tc, o) { o = o || {};
    for (const s of [-1, 1]) { K.seg([0, 0.3, s * 0.7], [0.1, 3.4, s * 0.6], 0.42, P.b, 'gloss'); K.box(0.3, 0, s * 0.7, 1.3, 0.45, 0.8, P.d, 'rubber', { b: 0.15 }); }
    K.poly([[-1.1, 0], [1.1, 0], [0.8, 3], [-0.9, 3.2]], 2.4, P.a, 'gloss', { y: 3.2, b: 0.15 }); K.box(0.95, 4.3, 0, 0.12, 1.6, 1.8, tc, null, { e: 1.6 });
    K.oct(0.1, 6.2, 0, 0.95, 1.9, P.b, 'gloss'); K.box(0.8, 7.05, 0, 0.3, 0.16, 1.1, P.l, null, { e: 3 }); K.poly([[0, 0], [-1.6, -2.6], [-0.4, -2.8]], 0.12, P.d, 'gloss', { x: -1, y: 6.2 });
    K.seg([0.1, 6, 1.3], [1.3, 4.9, 0.95], 0.3, P.a, 'gloss'); K.seg([0.1, 6, -1.3], [1.6, 4.9, 0.3], 0.3, P.a, 'gloss');
    if (!o.noRifle) { K.box(2.4, 4.6, 0.9, 4.6, 0.36, 0.36, P.d, 'metal'); K.box(4.8, 4.6, 0.9, 0.5, 0.2, 0.2, P.c, null, { e: 2.2 }); } },
  coletor(K, P, tc) { K.poly([[-5, 0.8], [4, 0.8], [5.4, 1.8], [3.4, 3.2], [-4.6, 3.2]], 5, P.a, 'gloss', { b: 0.2 }); K.box(0, 0.2, 0, 8, 0.25, 4, P.c, null, { e: 1.6 });
    K.prism(-1.6, 3.2, 0, 1.5, 2.2, 6, P.g, 'glass', { top: 0.85 }); K.tor(-1.6, 4.4, 0, 1.42, 0.08, tc, null, { e: 2.2, ts: 6 }); K.box(4.45, 2, 0, 0.2, 0.5, 4.2, P.l, null, { e: 2.4 }); },
  veiculo_hull(K, P, tc) { K.poly([[-6.6, 1.4], [5, 1.4], [7, 2.4], [4.6, 3.6], [-5.4, 3.6], [-6.8, 2.6]], 7.4, P.a, 'gloss', { b: 0.25 });
    for (const [x, s] of [[-4, 1], [-4, -1], [3.4, 1], [3.4, -1]]) { K.cyl(x, 0.6, s * 3, 1.3, 1.5, 0.8, P.d, 'dark'); K.cyl(x, 0.45, s * 3, 1.1, 1.1, 0.16, P.c, null, { e: 2 }); }
    K.box(-0.6, 3.62, 3.9, 9, 0.12, 0.12, tc, null, { e: 1.8 }); K.box(-0.6, 3.62, -3.9, 9, 0.12, 0.12, tc, null, { e: 1.8 }); K.mount = 3.75; },
  veiculo_turret(K, P, tc) { KITS.erevane.turret(K, P, tc, 0.8, false); },
  drone(K, P, tc) { K.poly([[4, 0], [-2.6, 4.8], [-1.2, 0], [-2.6, -4.8]], 0.5, P.a, 'gloss', { rx: -H, y: 2, b: 0.1 }); K.oct(-0.4, 1.4, 0, 1, 1.6, P.b, 'glass', { sx: 1.8 });
    for (const s of [-1, 1]) K.seg([4, 2.25, 0], [-2.6, 2.25, s * 4.8], 0.08, tc, null, { e: 2 }); K.light(-1.2, 2.5, 0, 0.4, P.l); },
  suporte(K, P, tc) { K.prism(0, 1.4, 0, 2.8, 2.2, 3, P.a, 'gloss', { top: 0.6 }); K.cone(0, 3.6, 0, 0.5, 3.4, P.b, 'gloss', { seg: 4 }); K.oct(0, 7.2, 0, 0.4, 0.8, P.l, null, { e: 3 }); K.cyl(0, 0.6, 0, 2, 2.2, 0.2, P.c, null, { e: 1.4 }); K.box(1.45, 2.6, 0, 0.12, 0.6, 1.6, tc, null, { e: 1.8 }); },
  pirata(K, P, tc) { K.poly([[-5.4, 0.9], [4.4, 0.9], [6, 1.8], [3, 3], [-4.8, 3]], 5.2, P.a, 'gloss', { b: 0.2 });
    for (const x of [-3.4, 3]) for (const s of [-1, 1]) { K.cyl(x, 0.4, s * 2.7, 0.9, 1, 0.6, P.d, 'dark'); K.cyl(x, 0.3, s * 2.7, 0.75, 0.75, 0.12, P.c, null, { e: 1.8 }); }
    K.cyl(-1.8, 3, 0, 1.4, 1.4, 2.2, P.g, 'glass', { seg: 6, facet: true }); K.tor(-1.8, 4.1, 0, 1.42, 0.08, P.l, null, { e: 2.4, ts: 6 }); K.tube([[-1.8, 5, 0], [1, 5.4, 0], [4, 3.6, 0], [6.2, 2.4, 0]], 0.22, P.d, 'rubber'); K.light(6.2, 2.2, 0, 0.4, P.l); },
  atirador(K, P, tc) { U.erevane.infantaria(K, P, tc, { noRifle: true }); K.box(3.2, 4.7, 0.9, 7.4, 0.3, 0.3, P.d, 'metal'); K.cyl(1.6, 5.05, 0.9, 0.22, 0.22, 1.6, P.b, 'gloss', { rz: -H }); K.box(6.95, 4.7, 0.9, 0.5, 0.18, 0.18, P.c, null, { e: 2.4 }); K.box(-0.2, 4.5, 0.9, 1.2, 0.8, 0.4, P.b, 'gloss'); },
  lamina(K, P, tc) { K.poly([[-5, 0.8], [3.4, 0.8], [6.4, 1.2], [2, 2.8], [-4.4, 2.6]], 4.4, P.a, 'gloss', { b: 0.2 });
    for (const s of [-1, 1]) { K.cyl(1.2, 1.6, s * 2.75 - 0.15, 2.2, 2.2, 0.3, '#7D8794', 'metal', { rx: H, seg: 20 }); K.tor(1.2, 1.6, s * 2.75, 2.25, 0.08, P.l, null, { e: 2.4, rx: H, ts: 24 }); }
    K.box(-1.6, 2.75, 0, 3, 0.2, 2, tc, null, { e: 1.6 }); K.cyl(-3.6, 0.3, 0, 1.2, 1.2, 0.2, P.c, null, { e: 1.6 }); },
  mosquito(K, P, tc) { K.oct(0, 1.2, 0, 0.8, 1.2, P.a, 'gloss', { sx: 2 }); for (const s of [-1, 1]) K.poly([[0, 0], [-1.6, s * 2.6], [-0.4, s * 2.8]], 0.08, P.b, 'glass', { rx: -H, y: 1.8 }); K.light(1.45, 1.7, 0, 0.3, P.l); K.light(-1.45, 1.7, 0, 0.25, tc); },
  ancora(K, P, tc) { ringOf(3, 2.8, (cx, cz) => K.seg([cx, 0, cz], [cx * 0.25, 5.2, cz * 0.25], 0.32, P.d, 'gloss')); K.sph(0, 6.4, 0, 1.7, P.b, 'glass', { seg: 16 }); K.tor(0, 6.4, 0, 3, 0.12, P.l, null, { e: 2.6, rx: 0.3, ts: 32 }); K.tor(0, 6.4, 0, 2.6, 0.08, tc, null, { e: 2, rz: 0.5, ts: 32 }); K.cone(0, 7.9, 0, 0.35, 2.4, P.a, 'gloss', { seg: 4 }); K.oct(0, 10.4, 0, 0.3, 0.7, P.l, null, { e: 3 }); },
};
U.tessara = {
  infantaria(K, P, tc, o) { o = o || {};
    for (const s of [-1, 1]) { K.seg([-0.4, 0, s * 0.8], [0.5, 1.6, s * 0.8], 0.42, P.b, 'bone'); K.seg([0.5, 1.6, s * 0.8], [0, 3.4, s * 0.75], 0.5, P.b, 'bone'); }
    K.sph(0, 4.6, 0, 1, P.a, 'bone', { sx: 1.25, sy: 1.6, sz: 1.35, seg: 14 }); K.sph(-1.05, 5, 0, 0.75, '#A8EBB8', null, { e: 1.2, seg: 12 });
    K.sph(0.4, 6.8, 0, 0.85, P.a, 'bone', { sx: 1.2, seg: 12 }); K.light(1.35, 6.95, 0.35, 0.22, P.l); K.light(1.35, 6.95, -0.35, 0.22, P.l); K.box(0.6, 5.7, 0, 0.5, 0.5, 2.5, tc, 'skin', { b: 0.2 });
    K.seg([0.2, 5.6, 1.3], [1.3, 4.7, 1.1], 0.32, P.b, 'bone'); K.seg([0.2, 5.6, -1.3], [1.6, 4.7, 0.4], 0.32, P.b, 'bone');
    if (!o.noRifle) { K.seg([0.6, 4.6, 1.1], [4.2, 4.8, 1.1], 0.3, P.t, 'bone', { taper: 0.7 }); K.sph(1.2, 4.6, 1.1, 0.55, P.l, null, { e: 1.4, seg: 10 }); } },
  coletor(K, P, tc) { K.sph(0, 1.2, 0, 1, P.a, 'bone', { half: true, sx: 5, sy: 3.2, sz: 3.4, seg: 18 }); K.sph(0, 1.2, 0, 1, P.d, 'matte', { half: true, sx: 5.15, sy: 0.6, sz: 3.55, seg: 18 });
    for (const x of [-2.6, 0, 2.6]) for (const s of [-1, 1]) K.seg([x, 1.6, s * 2.8], [x + 0.6, 0, s * 4.4], 0.3, P.d, 'bone');
    K.sph(-3, 3.4, 0, 1.5, '#9EE6B0', null, { e: 1.1, seg: 12 }); K.sph(4.8, 1.6, 0, 1.4, P.b, 'bone', { sx: 1.2, seg: 12 }); for (const s of [-1, 1]) K.seg([5.6, 1.2, s * 0.8], [7, 0.4, s * 1.2], 0.25, P.t, 'bone', { taper: 0.4 }); K.box(0, 4.35, 0, 4, 0.3, 1.2, tc, 'skin', { b: 0.1 }); },
  veiculo_hull(K, P, tc) { K.sph(0, 1.4, 0, 1, P.a, 'bone', { half: true, sx: 6.4, sy: 3.2, sz: 4.4, seg: 20 }); for (let i = 0; i < 3; i++) arch(K, 0, 1.4, 0, 6.5, 3.25, 4.5, i * PI / 3 + PI / 6, 0.2, P.t, 'bone');
    K.tor(0, 1.5, 0, 6.2, 0.4, P.d, 'matte', { sz: 0.7, ts: 30 }); for (const [x, s] of [[-3.6, 1], [-3.6, -1], [3.2, 1], [3.2, -1]]) leg(K, [x, 2, s * 3.6], [x + 0.6, 1.4, s * 5], [x + 0.4, 0, s * 5.2], 0.7, P.b, 'bone');
    K.sph(6.4, 2, 0, 1.5, P.b, 'bone', { sx: 1.2, seg: 12 }); K.light(7.75, 2.4, 0.6, 0.3, P.l); K.light(7.75, 2.4, -0.6, 0.3, P.l); K.box(-1, 4.4, 0, 5, 0.3, 2, tc, 'skin', { b: 0.12 }); K.mount = 4.4; },
  veiculo_turret(K, P, tc) { KITS.tessara.turret(K, P, tc, 0.8, false); },
  drone(K, P, tc) { K.sph(0, 2, 0, 1.3, P.a, 'bone', { sx: 2, seg: 14 }); K.sph(2.4, 2.2, 0, 0.8, P.b, 'bone', { seg: 10 }); K.light(3.15, 2.4, 0.35, 0.22, P.l); K.light(3.15, 2.4, -0.35, 0.22, P.l);
    for (const s of [-1, 1]) { K.sph(0.4, 2.8, s * 2.6, 1, '#CFF3D8', 'wet', { sx: 1.1, sy: 0.08, sz: 2.4, ry: s * 0.3, seg: 12 }); K.sph(-1.2, 2.6, s * 2.2, 1, '#BFE8C8', 'wet', { sx: 0.8, sy: 0.07, sz: 1.8, ry: -s * 0.4, seg: 12 }); }
    K.sph(-2.3, 2, 0, 0.6, P.l, null, { e: 1.6, seg: 10 }); K.box(0, 3.2, 0, 1.6, 0.2, 0.6, tc, 'skin'); },
  suporte(K, P, tc) { K.sph(0, 2.4, 0, 1.8, P.a, 'bone', { sy: 1.2, seg: 14 }); ringOf(5, 1.9, (cx, cz, a) => K.sph(cx, 3.6, cz, 1.2, '#8FD8A0', 'skin', { sx: 0.35, sy: 1.5, sz: 0.8, ry: -a, seg: 10 })); K.sph(0, 4.6, 0, 0.8, P.l, null, { e: 2.2, seg: 12 }); K.cyl(0, 0.5, 0, 1.6, 1.8, 0.2, P.l, null, { e: 1.2 }); K.box(0, 1.2, 0, 2, 0.3, 2, tc, 'skin', { b: 0.1 }); },
  pirata(K, P, tc) { K.sph(0, 1.2, 0, 1, P.a, 'bone', { half: true, sx: 4.4, sy: 2.6, sz: 3, seg: 16 }); for (const x of [-2.4, 0, 2.4]) for (const s of [-1, 1]) leg(K, [x, 1.6, s * 2.4], [x + 0.6, 1.4, s * 3.8], [x + 0.4, 0, s * 4], 0.3, P.b, 'bone');
    K.sph(-2, 3.3, 0, 1.4, '#9EE6B0', null, { e: 1.1, seg: 12 }); K.tube([[1.4, 3.4, 0], [3, 5.6, 0], [5.4, 5.4, 0], [6.4, 3.2, 0]], 0.3, P.t, 'bone', { ts: 14 }); K.cone(6.4, 3.4, 0, 0.45, 1.6, P.l, null, { e: 2, rz: PI }); K.box(0, 3.8, 0, 3, 0.3, 1.4, tc, 'skin'); },
  quimera(K, P, tc) { U.tessara.infantaria(K, P, tc); for (const s of [-1, 1]) K.cone(-0.7, 5.6, s * 1.1, 0.3, 1.8, P.t, 'bone', { rx: s * -0.6, rz: 0.5, seg: 8 }); K.cone(-0.2, 7.4, 0, 0.25, 1.4, P.t, 'bone', { rz: 0.4, seg: 8 }); },
  esporo(K, P, tc) { K.sph(0, 2.6, 0, 1.8, '#CFEFD6', 'wet', { seg: 14 }); ringOf(6, 1.62, (cx, cz) => K.sph(cx, 2.6 + (cx > 0 ? 0.5 : -0.4), cz, 0.35, P.l, null, { e: 1.8, seg: 8 }));
    for (let i = 0; i < 4; i++) { const a = i * H; K.tube([[Math.cos(a) * 0.8, 1.2, Math.sin(a) * 0.8], [Math.cos(a + 0.4) * 1.3, 0.4, Math.sin(a + 0.4) * 1.3], [Math.cos(a + 0.8) * 1.5, -0.6, Math.sin(a + 0.8) * 1.5]], 0.12, P.t, 'bone', { ts: 8 }); } K.box(0, 4.3, 0, 1, 0.3, 1, tc, 'skin', { b: 0.1 }); },
  molde(K, P, tc) { U.tessara.suporte(K, P, tc); K.tor(0, 2.4, 0, 2.6, 0.18, P.l, null, { e: 1.8, ts: 28 }); K.sph(0, 5.6, 0, 0.5, P.am, null, { e: 2.4, seg: 10 }); },
  colosso(K, P, tc) { for (const s of [-1, 1]) { leg(K, [0, 7, s * 3], [1.8, 3.8, s * 3.6], [0.4, 0.4, s * 3.6], 1.1, P.b, 'bone'); K.sph(0.8, 0.2, s * 3.6, 1.4, P.d, 'matte', { half: true, sx: 1.6, seg: 12 }); }
    K.sph(0, 9, 0, 3.6, P.a, 'bone', { sx: 1.25, sy: 0.95, seg: 18 }); for (let i = 0; i < 3; i++) arch(K, 0, 8.4, 0, 4.6, 4, 3.7, i * PI / 3 + PI / 6, 0.22, P.t, 'bone');
    K.sph(3.8, 9.8, 0, 1.4, P.b, 'bone', { seg: 12 }); K.light(5.05, 10.2, 0.5, 0.3, P.l); K.light(5.05, 10.2, -0.5, 0.3, P.l);
    for (const s of [-1, 1]) { K.seg([1, 9, s * 4.2], [8.2, 9.4, s * 4.2], 0.9, P.b, 'bone', { taper: 0.6, seg: 12 }); K.sph(8.2, 9.4, s * 4.2, 0.6, P.l, null, { e: 2.2, seg: 10 }); }
    K.sph(-2.6, 11.4, 0, 1.6, '#9EE6B0', null, { e: 1.2, seg: 12 }); K.box(0, 12.2, 0, 3, 0.4, 2, tc, 'skin', { b: 0.15 }); },
};
U.quorith = {
  infantaria(K, P, tc) { K.prism(0, 0, 0, 1.4, 0.3, 6, P.c, null, { e: 1.6 }); K.oct(0, 1.2, 0, 1.3, 5.2, P.a, 'crystal'); K.tor(0, 3.8, 0, 1.12, 0.1, P.c, null, { e: 2.6, ts: 6 }); for (const s of [-1, 1]) K.oct(0.3, 3, s * 2, 0.45, 1.8, P.b, 'crystal', { rx: s * 0.3 }); K.oct(1.4, 3.4, 0, 0.3, 1.4, tc, null, { e: 1.8, rz: -H }); },
  coletor(K, P, tc) { K.prism(0, 2.2, 0, 2.6, 2.4, 6, P.a, 'crystal', { top: 0.7 }); K.cone(0, 4.6, 0, 1.82, 1.8, P.b, 'crystal', { seg: 6, flat: true }); K.cone(0, 2.2, 0, 2.6, 1.8, P.b, 'crystal', { seg: 6, flat: true, rx: PI });
    K.prism(0, 3.2, 0, 2.47, 0.2, 6, P.c, null, { e: 2.2, top: 1 }); K.tor(0, 0.8, 0, 2.4, 0.16, P.l, null, { e: 2.6, ts: 6 }); K.tor(0, 1.1, 0, 3.2, 0.12, tc, null, { e: 1.8, ts: 6 }); K.oct(2.6, 2.6, 0, 0.6, 2.2, P.b, 'crystal', { rz: -H }); },
  veiculo_hull(K, P, tc) { K.prism(0, 1.6, 0, 1, 1.6, 6, P.a, 'crystal', { sx: 6.4, sz: 4.2, top: 0.82 }); K.cone(0, 1.6, 0, 1, 1.4, P.b, 'crystal', { seg: 6, flat: true, rx: PI, sx: 6.4, sz: 4.2 }); K.prism(0, 2.3, 0, 1.01, 0.2, 6, tc, null, { e: 1.8, sx: 6.4, sz: 4.2, top: 1 }); K.tor(0, 0.4, 0, 2.2, 0.14, P.l, null, { e: 2.4, ts: 6 }); K.mount = 3.2; },
  veiculo_turret(K, P, tc) { KITS.quorith.turret(K, P, tc, 0.85, false); },
  drone(K, P, tc) { K.oct(-2, 1.6, 0, 1.1, 4.4, P.a, 'crystal', { rz: -H }); for (const s of [-1, 1]) K.oct(-1.6, 1.6, s * 2.4, 0.6, 2.6, P.b, 'crystal', { rz: -H, ry: s * 0.25 }); K.tor(0, 1.6, 0, 2.6, 0.1, P.l, null, { e: 2.4, ts: 6, rx: 0.4 }); K.oct(0.2, 2.6, 0, 0.35, 1, tc, null, { e: 2 }); },
  suporte(K, P, tc) { K.prism(0, 0.6, 0, 1.8, 0.5, 6, P.d, 'gloss'); K.prism(0, 1.1, 0, 0.6, 2.4, 6, P.b, 'crystal'); K.box(0, 3.4, 0, 0.5, 0.5, 2.6, P.a, 'crystal'); for (const s of [-1, 1]) { K.prism(0, 3.4, s * 1.1, 0.4, 4.6, 6, P.a, 'crystal', { top: 0.5 }); K.oct(0, 8.2, s * 1.1, 0.3, 0.8, P.l, null, { e: 2.6 }); } K.tor(0, 0.3, 0, 1.6, 0.12, tc, null, { e: 1.8, ts: 6 }); },
  pirata(K, P, tc) { K.prism(0, 1, 0, 1, 1.4, 6, P.a, 'crystal', { sx: 5, sz: 3.2, top: 0.8 }); K.cone(0, 1, 0, 1, 0.9, P.b, 'crystal', { seg: 6, flat: true, rx: PI, sx: 5, sz: 3.2 }); K.oct(4.4, 1.6, 0, 1, 4, P.b, 'crystal', { rz: -H }); K.oct(8.3, 1.6, 0, 0.35, 1.2, P.c, null, { e: 2.6, rz: -H });
    K.oct(-1.4, 2.4, 0, 0.9, 2.6, P.a, 'crystal'); K.oct(-1.4, 5.1, 0, 0.3, 0.9, P.c, null, { e: 2.4 }); K.prism(0, 1.9, 0, 1.01, 0.18, 6, tc, null, { e: 1.8, sx: 5, sz: 3.2, top: 1 }); K.tor(0, 0.2, 0, 1.8, 0.12, P.l, null, { e: 2, ts: 6 }); },
  voz(K, P, tc) { K.oct(0, 1.4, 0, 1.6, 6.2, P.a, 'crystal'); K.tor(0, 4.5, 0, 1.72, 0.12, P.c, null, { e: 2.6, ts: 6 }); ringOf(3, 2.6, (cx, cz, a) => K.oct(cx, 3.2 + (a > 3 ? 0.8 : 0), cz, 0.4, 1.4, P.b, 'crystal', { rz: 0.3 })); K.tor(0, 0.4, 0, 1.4, 0.1, tc, null, { e: 2, ts: 6 }); K.oct(0, 7.9, 0, 0.3, 0.8, P.c, null, { e: 2.6 }); },
  agulha(K, P, tc) { K.prism(0, 0.4, 0, 1.6, 0.5, 6, P.d, 'gloss'); K.oct(0, 0.9, 0, 1.3, 3.8, P.a, 'crystal'); for (const [x, z, a] of [[0.8, 0.8, 0.3], [0.8, -0.8, 0.3], [-0.8, 0.8, -0.3], [-0.8, -0.8, -0.3]]) K.oct(x, 2, z, 0.28, 5.4, P.b, 'crystal', { rz: -a, rx: z * 0.3 }); K.oct(1.2, 2.4, 0, 0.3, 4, P.l, null, { e: 2.4, rz: -1.1 }); K.tor(0, 2.6, 0, 1.5, 0.1, tc, null, { e: 2, ts: 6 }); },
  diapasao(K, P, tc) { K.prism(0, 0, 0, 2.6, 0.6, 6, P.d, 'gloss'); K.prism(0, 0.6, 0, 1.6, 0.6, 6, P.b, 'crystal'); K.prism(0, 1.2, 0, 0.7, 3, 6, P.a, 'crystal'); K.box(0, 4.2, 0, 0.8, 0.8, 3.8, P.a, 'crystal');
    for (const s of [-1, 1]) { K.prism(0, 4.2, s * 1.6, 0.5, 8, 6, P.a, 'crystal', { top: 0.6 }); K.oct(0, 12.2, s * 1.6, 0.4, 1.2, P.l, null, { e: 2.8 }); } K.oct(0, 5.4, 0, 0.45, 1.4, P.c, null, { e: 2.6 }); K.tor(0, 0.7, 0, 2.2, 0.12, tc, null, { e: 1.8, ts: 6 }); },
  prisma(K, P, tc) { U.quorith.veiculo_hull(K, P, tc); K.mount = null; K.oct(-0.6, 3, 0, 2.2, 6.4, P.a, 'crystal', { ry: PI / 4 }); K.oct(2.4, 4.4, 0, 0.7, 6, P.b, 'crystal', { rz: -H }); K.oct(8.5, 4.4, 0, 0.3, 1.2, P.c, null, { e: 2.8, rz: -H }); K.tor(-0.6, 6, 0, 2.6, 0.12, P.l, null, { e: 2.4, ts: 6, rx: 0.3 }); },
  monolito(K, P, tc) { K.prism(0, 0, 0, 1, 0.8, 6, P.d, 'gloss', { sx: 5.4, sz: 4 }); K.tor(0, 1.2, 0, 3.2, 0.16, P.l, null, { e: 2.4, ts: 6 }); K.box(0, 1.8, 0, 3.6, 13, 2.6, P.a, 'crystal', { b: 0.2, bs: 1 });
    K.box(0, 3, 1.33, 0.3, 10, 0.06, P.c, null, { e: 2.6 }); K.box(0, 3, -1.33, 0.3, 10, 0.06, P.c, null, { e: 2.6 }); K.box(1.83, 3, 0, 0.06, 10, 0.3, P.c, null, { e: 2.6 }); K.oct(0, 14.8, 0, 1.2, 2.8, P.b, 'crystal');
    ringOf(4, 4.2, (cx, cz) => K.oct(cx, 0.6, cz, 0.7, 3.2, P.b, 'crystal', { rz: -cx * 0.08, rx: cz * 0.08 })); K.oct(0, 18.2, 0, 0.4, 1, tc, null, { e: 2 }); },
  harmonico(K, P, tc) { ringOf(3, 1.8, (cx, cz, a) => K.oct(cx, 1, cz, 0.7, 3.4, P.a, 'crystal', { rx: Math.sin(a) * 0.4, rz: -Math.cos(a) * 0.4 })); K.oct(0, 1.6, 0, 0.5, 1.8, P.c, null, { e: 2.8 }); K.tor(0, 2.4, 0, 2.8, 0.1, P.l, null, { e: 2.4, ts: 6 }); K.tor(0, 2.4, 0, 2.2, 0.08, tc, null, { e: 2, ts: 6 }); },
};
U.vorag = {
  infantaria(K, P, tc) { for (const s of [-1, 1]) leg(K, [-0.4, 3.2, s * 0.9], [0.8, 1.8, s * 1.2], [-0.2, 0, s * 1.2], 0.42, P.b, 'chitin');
    K.sph(-0.3, 4.4, 0, 1.5, P.a, 'chitin', { sx: 1.3, sy: 1.1, seg: 14, rz: 0.4 }); K.sph(1.4, 5.6, 0, 0.95, P.a, 'chitin', { sx: 1.3, seg: 12 });
    for (const s of [-1, 1]) { K.cone(2.4, 5.2, s * 0.45, 0.22, 1.2, P.bo, 'bone', { rz: -2, seg: 6 }); K.light(2.35, 6, s * 0.5, 0.22, P.l); K.seg([0.6, 5, s * 1.3], [2.6, 3.6, s * 1.4], 0.26, P.b, 'chitin'); K.cone(2.6, 3.6, s * 1.4, 0.24, 1.4, P.bo, 'bone', { rz: -2.2, seg: 6 }); }
    ringOf(3, 0.6, (cx, cz) => K.cone(-1 + cx, 5.4, cz, 0.22, 1.4, P.bo, 'bone', { rz: 0.6, seg: 6 })); K.sph(-1.25, 4.6, 0, 0.6, tc, 'wet', { seg: 10 }); },
  coletor(K, P, tc) { K.sph(0, 1.8, 0, 1, P.a, 'chitin', { sx: 4.4, sy: 1.6, sz: 3, seg: 16 }); K.sph(-1, 3.4, 0, 2.2, P.m, 'wet', { sy: 0.9, seg: 16 }); for (let i = 0; i < 3; i++) arch(K, -1, 2.4, 0, 2.25, 2, 2.25, i * PI / 3, 0.1, '#FF8A8A', null, { e: 1.3, ts: 10 });
    for (const x of [-2.6, 0, 2.6]) for (const s of [-1, 1]) leg(K, [x, 1.8, s * 2.4], [x + 0.6, 1.6, s * 3.8], [x + 0.2, 0, s * 4.2], 0.28, P.b, 'chitin');
    K.sph(4, 1.8, 0, 1.2, P.b, 'chitin', { sx: 1.2, seg: 12 }); for (const s of [-1, 1]) { K.cone(4.8, 1.4, s * 0.6, 0.25, 1.4, P.bo, 'bone', { rz: -2, seg: 6 }); K.light(5.15, 2.2, s * 0.5, 0.22, P.l); } K.box(1.4, 3.3, 0, 1.6, 0.25, 1.4, tc, 'wet'); },
  veiculo_hull(K, P, tc) { K.sph(0, 2.2, 0, 1, P.a, 'chitin', { sx: 6.4, sy: 2.4, sz: 4, seg: 18 }); for (let i = 0; i < 4; i++) K.sph(-3.6 + i * 2.4, 3.6, 0, 1, P.b, 'chitin', { sx: 1.6, sy: 0.9, sz: 3.6, seg: 12 });
    for (const x of [-4, -1.2, 1.6, 4.2]) for (const s of [-1, 1]) leg(K, [x, 2, s * 3.2], [x + 0.8, 1.8, s * 4.8], [x + 0.4, 0, s * 5], 0.42, P.b, 'chitin');
    K.sph(6.6, 2.4, 0, 1.6, P.a, 'chitin', { sx: 1.2, seg: 12 }); for (const s of [-1, 1]) { K.cone(7.6, 2, s * 0.8, 0.35, 2, P.bo, 'bone', { rz: -2, seg: 6 }); K.light(8.4, 2.9, s * 0.6, 0.26, P.l); } K.sph(-3, 4.4, 0, 0.6, tc, 'wet', { seg: 8 }); K.mount = 4.4; },
  veiculo_turret(K, P, tc) { KITS.vorag.turret(K, P, tc, 0.85, false); },
  drone(K, P, tc, o) { o = o || {}; K.sph(0, 2, 0, 1.2, P.a, 'chitin', { sx: 1.8, seg: 12 }); K.sph(-2.6, 1.8, 0, 1, P.b, 'chitin', { sx: 1.6, sy: 0.9, seg: 12 }); K.cone(-4.3, 1.7, 0, 0.3, o.sting || 1.6, P.bo, 'bone', { rz: H, seg: 6 }); K.sph(2.1, 2.2, 0, 0.75, P.a, 'chitin', { seg: 10 });
    for (const s of [-1, 1]) { K.light(2.75, 2.5, s * 0.35, 0.22, P.l); K.sph(0.2, 2.9, s * 2.4, 1, '#E8A0A8', 'wet', { sx: 1, sy: 0.06, sz: 2.4, ry: s * 0.25, seg: 12 }); if (o.wings4) K.sph(-1, 2.8, s * 2, 1, '#E8A0A8', 'wet', { sx: 0.7, sy: 0.05, sz: 1.8, ry: -s * 0.35, seg: 12 }); }
    K.sph(0, 2.9, 0, 0.4, tc, 'wet', { seg: 8 }); },
  suporte(K, P, tc) { K.sph(0, 3.2, 0, 2, P.m, 'wet', { sy: 0.85, seg: 16 }); for (let i = 0; i < 3; i++) arch(K, 0, 2.4, 0, 2.05, 1.7, 2.05, i * PI / 3, 0.1, '#FF8A8A', null, { e: 1.4, ts: 10 }); ringOf(5, 1.2, (cx, cz) => K.tube([[cx, 2, cz], [cx * 1.5, 1, cz * 1.5], [cx * 1.2, 0, cz * 1.2]], 0.14, P.b, 'wet', { ts: 8 })); K.sph(0, 4.8, 0, 0.5, P.l, null, { e: 2.4, seg: 10 }); K.tor(0, 2.4, 0, 2, 0.16, P.bo, 'bone', { ts: 20 }); K.sph(1.6, 3.6, 0, 0.45, tc, 'wet', { seg: 8 }); },
  pirata(K, P, tc) { K.sph(-0.4, 3, 0, 2.4, P.a, 'chitin', { sx: 1.3, sy: 1.1, seg: 16 }); K.sph(-2.4, 4.2, 0, 1.6, P.m, 'wet', { seg: 14 }); for (const x of [-2, 0.4, 2.2]) for (const s of [-1, 1]) leg(K, [x, 2.4, s * 2], [x + 0.6, 2, s * 3.4], [x + 0.3, 0, s * 3.6], 0.36, P.b, 'chitin');
    K.sph(2.6, 3, 0, 1.4, P.b, 'chitin', { sx: 1.3, seg: 12 }); for (const s of [-1, 1]) { K.seg([3.2, 2.6, s * 0.9], [5.2, 1.6, s * 0.5], 0.3, P.bo, 'bone', { taper: 0.3 }); K.light(4.1, 3.6, s * 0.5, 0.24, P.l); }
    ringOf(4, 1, (cx, cz) => K.cone(-0.6 + cx, 5.2, cz, 0.28, 1.8, P.bo, 'bone', { seg: 6, rz: 0.5 })); K.sph(-0.4, 5.4, 0, 0.5, tc, 'wet', { seg: 8 }); },
  cria(K, P, tc) { K.sph(0, 1.6, 0, 1.2, P.a, 'chitin', { sx: 1.5, sy: 0.9, seg: 12 }); K.sph(1.8, 1.7, 0, 0.75, P.b, 'chitin', { seg: 10 }); for (const s of [-1, 1]) { K.cone(2.4, 1.3, s * 0.35, 0.18, 0.9, P.bo, 'bone', { rz: -2, seg: 6 }); K.light(2.45, 2, s * 0.35, 0.18, P.l); }
    for (const x of [-0.8, 0.2, 1]) for (const s of [-1, 1]) leg(K, [x, 1.4, s * 0.8], [x + 0.4, 1.4, s * 1.8], [x + 0.2, 0, s * 2], 0.16, P.b, 'chitin'); K.sph(-0.8, 2.3, 0, 0.35, tc, 'wet', { seg: 8 }); },
  cuspidor(K, P, tc) { U.vorag.cria(K, P, tc); K.sph(-1.2, 2.8, 0, 1.3, P.ac, null, { e: 1.2, seg: 12 }); K.seg([1.8, 2, 0], [3.6, 2.6, 0], 0.32, P.b, 'chitin', { taper: 0.6 }); K.sph(3.6, 2.6, 0, 0.28, P.ac, null, { e: 2.2, seg: 8 }); },
  escaravelho(K, P, tc) { K.sph(0, 2.2, 0, 1, P.a, 'chitin', { sx: 5.4, sy: 2.6, sz: 3.6, seg: 18 }); K.sph(0, 2.6, 0, 1, P.b, 'chitin', { half: true, sx: 5, sy: 2.6, sz: 0.4, seg: 12 });
    for (const x of [-3, 0, 3]) for (const s of [-1, 1]) leg(K, [x, 2, s * 3], [x + 0.8, 1.6, s * 4.4], [x + 0.4, 0, s * 4.6], 0.4, P.b, 'chitin');
    K.sph(5.4, 2.2, 0, 1.4, P.b, 'chitin', { seg: 12 }); K.seg([6, 2.6, 0], [8.4, 5.2, 0], 0.5, P.bo, 'bone', { taper: 0.2 }); for (const s of [-1, 1]) K.light(6.6, 2.8, s * 0.6, 0.24, P.l); K.sph(-2.6, 4.4, 0, 0.6, tc, 'wet', { seg: 8 }); },
  brutamonte(K, P, tc) { K.sph(0, 3.4, 0, 1, P.a, 'chitin', { sx: 8, sy: 4.4, sz: 5.6, seg: 20 }); for (let i = 0; i < 4; i++) K.sph(-4.8 + i * 3.2, 6.2, 0, 1, P.b, 'chitin', { sx: 2, sy: 1.3, sz: 5, seg: 12 });
    ringOf(7, 1, (cx, cz) => { if (cx > -0.95) K.cone(cx * 5.4, 6.4, cz * 3.6, 0.5, 3.2, P.bo, 'bone', { seg: 8, rz: -cx * 0.5, rx: cz * 0.5 }); });
    for (const x of [-5, -1.6, 1.8, 5]) for (const s of [-1, 1]) leg(K, [x, 3, s * 4.6], [x + 1, 2.6, s * 6.4], [x + 0.6, 0, s * 6.8], 0.8, P.b, 'chitin');
    K.sph(8.2, 3.6, 0, 2.4, P.b, 'chitin', { sx: 1.1, seg: 14 }); for (const s of [-1, 1]) { K.seg([9.4, 3, s * 1.4], [12, 4.6, s * 2.2], 0.5, P.bo, 'bone', { taper: 0.25 }); K.light(10.6, 4.6, s * 0.8, 0.32, P.l); }
    K.sph(-4, 7.6, 0, 0.9, tc, 'wet', { seg: 10 }); K.sph(-6.6, 5.4, 0, 1.8, P.m, 'wet', { seg: 12 }); },
  ferroada(K, P, tc) { U.vorag.drone(K, P, tc, { sting: 2.6, wings4: true }); },
};

// ---------- cenário neutro: nós de recurso, rochas, ruínas, caixas, carcaças e adereços de território ----------
const NEUTRAL = {
  plasma(K, seed) { const r = rng(seed + 3); K.rock(0, 0.3, 0, 3, '#3A2A2E', 'stone', { sy: 0.35, seed });
    for (let i = 0; i < 8; i++) { const a = r() * PI * 2, d = 0.6 + r() * 3, h = 3 + r() * 6, hot = r() < 0.55; K.prism(Math.cos(a) * d, 0.2, Math.sin(a) * d, 0.45 + r() * 0.5, h, 6, hot ? '#FF7A45' : '#C55CFF', 'crystal', { top: 0.12, rz: (r() - 0.5) * 0.6, rx: (r() - 0.5) * 0.6, e: hot ? 1.5 : 0 }); } },
  minerio(K, seed) { const r = rng(seed + 7); for (let i = 0; i < 5; i++) K.rock((r() - 0.5) * 6, 0.6 + r(), (r() - 0.5) * 6, 1.6 + r() * 1.6, ['#6E7682', '#5A616B', '#7E8794'][i % 3], 'stone', { seed: seed + i, sy: 0.75 });
    for (let i = 0; i < 9; i++) K.oct((r() - 0.5) * 6, 0.8 + r() * 1.6, (r() - 0.5) * 6, 0.35 + r() * 0.3, 1 + r() * 1.2, '#C9D8E8', 'metal', { rz: (r() - 0.5) * 1.4, rx: (r() - 0.5) * 1.4 }); },
  dados(K, seed) { const r = rng(seed + 11); K.rock(0, 0.2, 0, 2.6, '#33403A', 'stone', { sy: 0.3, seed }); K.tor(0, 1, 0, 2.6, 0.1, '#7FE3A1', null, { e: 2, ts: 24 });
    for (let i = 0; i < 5; i++) { const a = i / 5 * PI * 2 + r(); K.oct(Math.cos(a) * (0.8 + r() * 1.6), 1.6 + r() * 3, Math.sin(a) * (0.8 + r() * 1.6), 0.35 + r() * 0.25, 1.6 + r() * 1.6, '#7FE3A1', null, { e: 1.6 + r(), rz: (r() - 0.5) * 0.8 }); } },
  rocks(K, seed) { const r = rng(seed + 13); for (let i = 0; i < 4; i++) K.rock((r() - 0.5) * 7, 0.8 + i * 0.4, (r() - 0.5) * 7, 1.8 + r() * 2.2, ['#5D5A57', '#6B6560', '#4E4B49'][i % 3], 'stone', { seed: seed * 3 + i, sy: 0.7 + r() * 0.5, amp: 0.28 }); },
  ruin(K, seed) { const r = rng(seed + 17); for (let i = 0; i < 3; i++) K.box((r() - 0.5) * 7, 0, (r() - 0.5) * 7, 1.6, 3 + r() * 6, 1.6, '#8A8478', 'stone', { b: 0.15, rz: (r() - 0.5) * 0.35, rx: (r() - 0.5) * 0.35 });
    K.box((r() - 0.5) * 4, 0, (r() - 0.5) * 4, 5, 0.9, 1.8, '#7A746A', 'stone', { b: 0.15, ry: r() * PI, rz: 0.12 }); for (let i = 0; i < 4; i++) K.rock((r() - 0.5) * 8, 0.3, (r() - 0.5) * 8, 0.5 + r() * 0.6, '#77716A', 'stone', { seed: seed + i }); K.light(0, 0.4, 0, 0.3, '#7FE3A1', 1.4); },
  crate(K) { K.box(0, 0, 0, 6, 4.6, 5, '#B8862B', 'paint', { b: 0.35 }); for (const x of [-1.6, 1.6]) K.box(x, -0.05, 0, 0.5, 4.75, 5.12, '#4A3A20', 'dark'); K.box(0, 4.6, 0, 1.6, 0.3, 1.6, '#F2C230', null, { e: 1.6 }); },
  wreck(K) { K.box(0, 0, 0, 12, 2.4, 6, '#2A2624', 'dark', { b: 0.4, rz: 0.08, rx: 0.1 }); K.box(-1, 2.2, 0.4, 4.6, 1.6, 4, '#3A3430', 'dark', { b: 0.4, ry: 0.5, rz: -0.2 }); K.seg([1, 3, 0.2], [6.4, 1.2, 2.2], 0.36, '#1E1C1B', 'metal');
    for (let i = 0; i < 3; i++) K.light(-3 + i * 2.6, 2.4, (i - 1) * 1.6, 0.35, '#FF7A2E', 2); },
};
const PROPS = {
  vehnar(K, s) { const r = rng(s); const P = Object.assign({}, PAL.vehnar, { b: '#9AA2AD' }); if (s % 2) { KITS.vehnar.tower(K, P, '#7C8490', 0, 0, 0.8 + r() * 0.3, 4 + r() * 2.5, 0); K.box(1.7, 0, 0.8, 1.6, 1.2, 1.4, PAL.vehnar.a, 'steel', { b: 0.2 }); } else { K.box(0, 0, 0, 4.6, 2.2, 2.2, ['#B8862B', '#7C8490', '#8A5A3A'][s % 3], 'paint', { b: 0.2 }); K.box(0.6, 2.2, 0.2, 3.4, 1.8, 2, ['#59606B', '#B8862B', '#7C8490'][s % 3], 'paint', { b: 0.2, ry: 0.2 }); K.light(2.4, 1.2, 0, 0.3, PAL.vehnar.l, 1.8); } },
  erevane(K, s) { const r = rng(s); K.cone(0, 0, 0, 0.9 + r() * 0.4, 6 + r() * 4, '#9FC7D6', 'ice', { seg: 5, flat: true, rz: (r() - 0.5) * 0.3 }); K.cone(1.2, 0, 0.6, 0.5, 3 + r() * 2, '#BFDDE6', 'ice', { seg: 5, flat: true, rz: -0.3 }); K.oct(0, 0.4, -1, 0.4, 1.4, PAL.erevane.c, null, { e: 1.6 }); },
  tessara(K, s) { const r = rng(s); KITS.tessara.tower(K, PAL.tessara, '#888', 0, 0, 0.8 + r() * 0.3, 4 + r() * 3, 0); },
  quorith(K, s) { const r = rng(s); K.oct(0, 0, 0, 1 + r() * 0.5, 5 + r() * 4, PAL.quorith.a, 'crystal', { rz: (r() - 0.5) * 0.4 }); K.oct(1.2, 0, 0.4, 0.5, 2.6, PAL.quorith.b, 'crystal', { rz: -0.5 }); K.oct(-0.9, 0.2, -0.6, 0.3, 1.2, PAL.quorith.c, null, { e: 2.2 }); },
  vorag(K, s) { const r = rng(s); for (let i = 0; i < 3; i++) K.sph((r() - 0.5) * 2.4, 0.8, (r() - 0.5) * 2.4, 0.9 + r() * 0.5, PAL.vorag.bo, 'bone', { sy: 1.4, seg: 10 }); K.sph(0, 0, 0, 1.8, '#3A1A28', 'wet', { half: true, sy: 0.3, seg: 12 }); K.sph(0.3, 1.8, 0.2, 0.25, PAL.vorag.l, null, { e: 2, seg: 8 }); },
};

// ---------- API ----------
const FULL = { veiculo: ['veiculo_hull', 'veiculo_turret'], torre: ['torre_base', 'torre_turret'], bastiao: ['bastiao_base', 'bastiao_turret'] };
function recipe(race, def) {
  const u = U[race]; if (u && u[def]) return (K, P, tc) => u[def](K, P, tc);
  if (BLD[def]) return (K, P, tc) => BLD[def](K, KITS[race] || KITS.vehnar, P, tc);
  for (const r in U) if (U[r][def]) return (K, P, tc) => U[r][def](K, P, tc);
  return null;
}
function build(def, race, color, seed) {
  T = T || globalThis.THREE; if (!T) return null;
  const K = new Kit();
  try {
    if (NEUTRAL[def]) { NEUTRAL[def](K, seed | 0); return K.finish(); }
    if (def.startsWith('prop_')) { const f = PROPS[def.slice(5)]; if (!f) return null; f(K, seed | 0); return K.finish(); }
    race = PAL[race] ? race : 'vehnar'; const P = PAL[race]; const tc = color || '#FF8C1A';
    if (FULL[def]) { const a = recipe(race, FULL[def][0]), b = recipe(race, FULL[def][1]); if (!a || !b) return null; a(K, P, tc); const m = K.mount || 0; K.mount = null; K.oy = m; b(K, P, tc); K.oy = 0; return K.finish({ pivot: [0, 0] }); }
    const f = recipe(race, def); if (!f) return null; f(K, P, tc); return K.finish({ pivot: [0, 0] });
  } catch (err) { console.warn('[ARD] malha ' + def + '/' + race + ' falhou: ' + err.message); return null; }
}
// material padrão das malhas: rugosidade e metal vêm do atributo rm por vértice; rim opcional por Raça
function material(o) { T = T || globalThis.THREE; o = o || {}; const m = new T.MeshStandardMaterial(Object.assign({ vertexColors: true, roughness: 1, metalness: 1, envMapIntensity: o.env == null ? 1 : o.env }, o.params || {}));
  m.onBeforeCompile = sh => {
    sh.vertexShader = 'attribute vec2 rm;\nvarying vec2 vRM;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvRM = rm;');
    sh.fragmentShader = 'varying vec2 vRM;\n' + sh.fragmentShader.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = vRM.x;').replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = vRM.y;');
    if (o.rim) sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n{ float rim = pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), ' + o.rim.pow.toFixed(2) + '); totalEmissiveRadiance += vec3(' + o.rim.col.map(v => v.toFixed(3)).join(', ') + ') * (rim * ' + o.rim.amt.toFixed(3) + '); }');
    if (o.onShader) o.onShader(sh);
  };
  m.customProgramCacheKey = () => 'ard-mesh-' + (o.key || 'base'); return m; }
const BUILDING_DEFS = ['nucleo', 'reator', 'refinaria', 'quartel', 'fabrica', 'hangar', 'torre', 'nodulo', 'laboratorio', 'muro', 'portao', 'bastiao'];
const GENERIC_UNITS = ['coletor', 'infantaria', 'veiculo', 'drone', 'suporte', 'pirata'];
function unitsOf(race) { return GENERIC_UNITS.concat(Object.keys(U[race] || {}).filter(d => !GENERIC_UNITS.includes(d) && !d.startsWith('veiculo_'))); }
ARD.meshes = { setLod(v) { LOD = Math.max(0.4, Math.min(1, v)); }, build, material, PAL, MAT, BUILDING_DEFS, GENERIC_UNITS, unitsOf, NEUTRAL_DEFS: Object.keys(NEUTRAL), PROP_RACES: Object.keys(PROPS), FULL };
})(globalThis.ARD = globalThis.ARD || {});
