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
  rock: [0.88, 0.02], // 4.3b: rocha esculpida (padrão 6)
  leaf: [0.78, 0], bark: [0.92, 0], petal: [0.66, 0], frost: [0.42, 0.05], snow: [0.93, 0], obsid: [0.07, 0.3], ash: [0.97, 0], // 4.3c: flora do mundo vestido (dress3d)
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
  constructor() { this.main = []; this.emi = []; this.mount = null; this.beam = null; this.base = null; this.fis = []; this.ox = 0; this.oy = 0; this.oz = 0; this._anim = null; } // beam (4.3a): emissor do feixe de mineração, nas coordenadas da receita; base (4.3b): altura do chão (o que fica abaixo afunda no relevo); fis (4.3b): fendas da última rocha esculpida
  // 4.2b: tudo o que for desenhado dentro de fn ganha a mesma animação (spec.t: wheel, spin, leg, recoil, bob, flap, sway, tread; spec.p = pivô)
  anim(spec, fn) { const prev = this._anim; this._anim = spec; try { fn(); } finally { this._anim = prev; } return this; }
  _push(geo, col, mat, o) {
    o = o || {};
    if (geo.index) { const g2 = geo.toNonIndexed(); geo.dispose(); geo = g2; }
    if (geo.attributes.uv) geo.deleteAttribute('uv'); if (geo.attributes.uv2) geo.deleteAttribute('uv2');
    const q = o.q || new T.Quaternion().setFromEuler(new T.Euler(o.rx || 0, o.ry || 0, o.rz || 0, o.order || 'YXZ'));
    const m = new T.Matrix4().compose(new T.Vector3((o.x || 0) + this.ox, (o.y || 0) + this.oy, (o.z || 0) + this.oz), q, new T.Vector3(o.sx || 1, o.sy || 1, o.sz || 1));
    geo.applyMatrix4(m); if (o.flat || !geo.attributes.normal) geo.computeVertexNormals(); if (o.shade) shadeGeo(geo, o.shade); /* 4.3b: sombreado assado nas facetas */
    const c = new T.Color(col); const an = animOf(o.anim || this._anim, this); const wd = o.wind != null ? o.wind : (this._wind || 0); /* 4.3c: peso do vento da peça (só o dress3d lê) */
    if (o.e) { c.multiplyScalar(o.e === true ? 2.4 : o.e); this.emi.push({ geo, c, an, wd }); }
    else this.main.push({ geo, c, rm: Array.isArray(mat) ? mat : (MAT[mat] || MAT.paint), an, pt: o.pat != null ? o.pat : (typeof mat === 'string' ? (PAT[mat] || 0) : 1), wd });
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
  // 4.3b: rocha esculpida (anéis empilhados: estratos com bancadas e recuos, fendas verticais, cortes planos de fratura, topo plano inclinado,
  // saia que alarga e afunda abaixo de y) com cor por vértice; col = cor base ou o.cols = cores dos estratos. Guarda as fendas em K.fis (para cristais e veios)
  crag(x, y, z, w, h, d, col, mat, o) { o = Object.assign({ flat: true }, o, { x, y, z }); const g = cragGeo(w, h, d, col, o); const ry = o.ry || 0, c = Math.cos(ry), s = Math.sin(ry);
    const tr = (px, py, pz) => [x + this.ox + px * c + pz * s, y + this.oy + py, z + this.oz - px * s + pz * c]; this.fis = g.userData.fis.map(f => ({ a: tr(f[0], f[1], f[2]), b: tr(f[3], f[4], f[5]), n: [f[6] * c + f[7] * s, -f[6] * s + f[7] * c] })); return this._push(g, '#FFFFFF', mat, o); }
  // 4.3b: cristal (prisma de o.n faces com ponta piramidal torta, base enterrada); o.shade assa o sombreado das facetas (bom nos emissivos)
  xtal(x, y, z, r, h, col, mat, o) { o = Object.assign({ flat: true }, o, { x, y, z }); if (this.lite) o.n = Math.max(3, (o.n || 6) - 2); /* 4.3c */ return this._push(xtalGeo(r, h, o), col, mat, o); }
  // 4.3c: flora — geometria em coordenadas da receita, cor por vértice (o.c0 base → o.c1 ponta) e normais de copa (o.nc = centro da planta); o.wind = peso do vento
  // lâmina curva (o.shape 'blade' afina até a ponta, 'leaf' fecha nas duas pontas; o.fold vinco central): nasce em (x, y, z), azimute az, inclinação t0 (0 = em pé), curva cv até a ponta
  // 4.3c: versão leve (this.lite, para os blocos longe da câmera): q(n) reduz contagens das receitas e os construtores usam menos trechos e lados
  q(n) { return this.lite ? Math.max(1, Math.round(n * 0.55)) : n; }
  fine(fn) { if (!this.lite) fn(); return this; } /* 4.3d: peças de detalhe fino (rebites, parafusos, antenas, grades miúdas) que somem na versão leve */
  blade(x, y, z, az, t0, cv, L, w, col, mat, o) { o = Object.assign({}, o, { lite: this.lite }); const g = ribbonGeo([x, y, z], az, t0, cv, L, w, o); this.tip = g.userData.tip; this.leafy = true; return this._push(g, col, mat, { e: o.e, wind: o.wind }); }
  // fronde de samambaia: ráquis curva com o.m pares de folíolos triangulares (o.lk = comprimento relativo, o.droop = caimento)
  frond(x, y, z, az, t0, cv, L, col, mat, o) { o = Object.assign({}, o, { lite: this.lite }); const g = frondGeo([x, y, z], az, t0, cv, L, o); this.tip = g.userData.tip; this.leafy = true; return this._push(g, col, mat, { e: o.e, wind: o.wind }); }
  // tronco ou galho afinado por pontos [x, y, z, raio] (raio 0 no fim fecha em ponta); o.n lados, o.bark listras de casca, o.cap fecha o topo
  trunk(pts, col, mat, o) { o = Object.assign({}, o, { lite: this.lite }); return this._push(trunkGeo(pts, o), col, mat, { e: o.e, wind: o.wind }); }
  // bulbo com gomos: perfil [[raio, y], ...] de baixo para cima (raio 0 no topo fecha); o.n lados, o.ribs gomos, o.rk fundura dos gomos; aceita rx/ry/rz
  bulb(prof, x, y, z, col, mat, o) { o = Object.assign({}, o, { lite: this.lite }); return this._push(bulbGeo(prof, o), col, mat, { x, y, z, rx: o.rx, ry: o.ry, rz: o.rz, e: o.e, wind: o.wind }); }
  // espinho: pirâmide fina de o.n lados (3) sem base, de a até b
  spike(a, b, r, col, mat, o) { o = o || {}; return this._push(spikeGeo(a, b, r, o), col, mat, { e: o.e, wind: o.wind, flat: true }); }
  // lascas de cascalho: lista [x, z, raio, altura]; tronco de pirâmide de o.n lados com tampa
  chips(list, col, mat, o) { o = Object.assign({}, o, { lite: this.lite }); return this._push(chipsGeo(list, o), col, mat, { e: o.e, wind: o.wind, flat: true }); }
  // pátina (líquen, geada, cinza) nas faces voltadas para cima da última peça: o.cols cores, k fração das faces, ny inclinação mínima
  patina(cols, k, ny, seed) { const p = this.main[this.main.length - 1]; if (p) patinaGeo(p.geo, cols, k, ny, seed); return this; }
  wind(k, fn) { const prev = this._wind; this._wind = k; try { fn(); } finally { this._wind = prev; } return this; }
  light(x, y, z, s, col, k) { return this.box(x, y, z, s, s, s, col, null, { e: k || 2.6 }); }
  finish(o) {
    o = o || {}; const all = this.main.concat(this.emi); const bb = new T.Box3(); const tmp = new T.Box3();
    for (const p of all) { p.geo.computeBoundingBox(); tmp.copy(p.geo.boundingBox); bb.union(tmp); }
    const vb = this.base == null ? bb : visBox(all, this.base); /* 4.3b: com base, largura e centro só do que fica acima do chão */
    const cx = o.pivot ? o.pivot[0] : (vb.min.x + vb.max.x) / 2, cz = o.pivot ? o.pivot[1] : (vb.min.z + vb.max.z) / 2, y0 = this.base == null ? bb.min.y : this.base;
    const hasAnim = all.some(p => p.an); // 4.2b
    const hasWind = all.some(p => p.wd); /* 4.3c */
    const mk = (list, withRM) => {
      if (!list.length) return null; let n = 0; for (const p of list) n += p.geo.attributes.position.count;
      const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3), rm = withRM ? new Float32Array(n * 2) : null, pt = withRM ? new Float32Array(n) : null; let k = 0;
      const aa = hasAnim ? new Float32Array(n * 4) : null, ab = hasAnim ? new Float32Array(n * 4) : null, wa = hasWind ? new Float32Array(n) : null;
      for (const p of list) { const c = p.geo.attributes.position.count, vc = p.geo.attributes.color; pos.set(p.geo.attributes.position.array, k * 3); nor.set(p.geo.attributes.normal.array, k * 3); for (let i = 0; i < c; i++) { const j = k + i; pos[j * 3] -= cx; pos[j * 3 + 1] -= y0; pos[j * 3 + 2] -= cz; if (vc) { col[j * 3] = p.c.r * vc.getX(i); col[j * 3 + 1] = p.c.g * vc.getY(i); col[j * 3 + 2] = p.c.b * vc.getZ(i); } else { col[j * 3] = p.c.r; col[j * 3 + 1] = p.c.g; col[j * 3 + 2] = p.c.b; } if (pt) pt[j] = p.pt || 0; if (wa) wa[j] = p.wd || 0; if (rm) { rm[j * 2] = p.rm[0]; rm[j * 2 + 1] = p.rm[1]; } /* 4.3b: cor por vértice multiplica a cor da peça */
          if (aa && p.an) { aa[j * 4] = p.an.t; aa[j * 4 + 1] = p.an.p[0] - cx; aa[j * 4 + 2] = p.an.p[1] - y0; aa[j * 4 + 3] = p.an.p[2] - cz; ab[j * 4] = p.an.b[0]; ab[j * 4 + 1] = p.an.b[1]; ab[j * 4 + 2] = p.an.b[2]; ab[j * 4 + 3] = p.an.b[3]; } } k += c; p.geo.dispose(); }
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('normal', new T.BufferAttribute(nor, 3)); g.setAttribute('color', new T.BufferAttribute(col, 3)); if (rm) g.setAttribute('rm', new T.BufferAttribute(rm, 2)); if (pt) g.setAttribute('pt', new T.BufferAttribute(pt, 1));
      if (aa) { g.setAttribute('aAnim', new T.BufferAttribute(aa, 4)); g.setAttribute('aAnimB', new T.BufferAttribute(ab, 4)); } if (wa) g.setAttribute('aWind', new T.BufferAttribute(wa, 1)); g.computeBoundingSphere(); return g;
    };
    const out = { main: mk(this.main, true), em: mk(this.emi, false), width: Math.max(vb.max.x - vb.min.x, vb.max.z - vb.min.z), height: bb.max.y - y0, mount: this.mount == null ? null : this.mount - y0, beam: this.beam ? [this.beam[0] - cx, this.beam[1] - y0, this.beam[2] - cz] : null, mesh: true, anim: hasAnim };
    if (!out.main) { const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(new Float32Array(9), 3)); g.setAttribute('normal', new T.BufferAttribute(new Float32Array(9), 3)); g.setAttribute('color', new T.BufferAttribute(new Float32Array(9), 3)); g.setAttribute('rm', new T.BufferAttribute(new Float32Array(6), 2)); out.main = g; }
    return out;
  }
}
// 4.2b — animação procedural das peças. Tipos (aAnim.x) e parâmetros (aAnimB):
// 1 wheel  gira no eixo z (lateral) pela distância percorrida: b = [raio]
// 2 spin   gira sem parar (mais devagar parado): b = [rad/s, eixo 0=y 1=x 2=z, fase]
// 3 leg    balança no eixo z ao andar (pivô no quadril): b = [amplitude rad, passada, fase]
// 4 recoil recua no eixo x ao disparar: b = [distância]
// 5 bob    sobe e desce: b = [amplitude, velocidade, fase]
// 6 flap   bate no eixo x (asas): b = [amplitude rad, velocidade, fase, lado ±1]
// 7 sway   balança no eixo z, mais quando anda (antenas, caudas, tentáculos): b = [amplitude rad, velocidade, fase]
// 8 tread  rola ao longo de x (esteiras): b = [espaçamento]
const ANIM_T = { wheel: 1, spin: 2, leg: 3, recoil: 4, bob: 5, flap: 6, sway: 7, tread: 8 };
function animOf(sp, K) {
  if (!sp) return null; const t = ANIM_T[sp.t]; if (!t) return null; const p = sp.p || [0, 0, 0]; const ph = sp.ph || 0;
  const b = t === 1 ? [sp.r || 1, 0, 0, 0] : t === 2 ? [sp.speed == null ? 2 : sp.speed, sp.axis === 'x' ? 1 : sp.axis === 'z' ? 2 : 0, ph, 0] : t === 3 ? [sp.amp == null ? 0.4 : sp.amp, sp.stride || 6, ph, 0]
    : t === 4 ? [sp.dist == null ? 0.8 : sp.dist, 0, 0, 0] : t === 5 ? [sp.amp == null ? 0.3 : sp.amp, sp.speed == null ? 2 : sp.speed, ph, 0] : t === 6 ? [sp.amp == null ? 0.5 : sp.amp, sp.speed == null ? 20 : sp.speed, ph, sp.side || 1]
    : t === 7 ? [sp.amp == null ? 0.12 : sp.amp, sp.speed == null ? 2 : sp.speed, ph, 0] : [sp.spacing || 2, 0, 0, 0];
  return { t, p: [p[0] + K.ox, p[1] + K.oy, p[2] + K.oz], b };
}
// trecho de shader compartilhado: material das malhas e o material emissivo do render3d
const ANIM_GLSL = `attribute vec4 aAnim; attribute vec4 aAnimB;
#ifdef USE_INSTANCING
attribute vec4 aInst; attribute float aInstC;
#endif
mat3 ardRX(float a){ float c = cos(a), s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }
mat3 ardRY(float a){ float c = cos(a), s = sin(a); return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c); }
mat3 ardRZ(float a){ float c = cos(a), s = sin(a); return mat3(c, s, 0.0, -s, c, 0.0, 0.0, 0.0, 1.0); }
void ardAnim(out mat3 R, out vec3 Tr) { R = mat3(1.0); Tr = vec3(0.0);
#ifdef USE_INSTANCING
  float ty = aAnim.x; if (ty < 0.5) return; float trav = aInst.x, tim = aInst.y, mov = aInst.z, rec = aInst.w;
  if (ty < 1.5) R = ardRZ(-trav / max(aAnimB.x, 0.05));
  else if (ty < 2.5) { float a = aInstC * aAnimB.x + aAnimB.z; /* relógio integrado na CPU: o ritmo muda sem saltos */ R = aAnimB.y < 0.5 ? ardRY(a) : (aAnimB.y < 1.5 ? ardRX(a) : ardRZ(a)); }
  else if (ty < 3.5) R = ardRZ(aAnimB.x * sin(trav / max(aAnimB.y, 0.1) * 6.2831853 + aAnimB.z) * mov);
  else if (ty < 4.5) Tr = vec3(-aAnimB.x * rec, 0.0, 0.0);
  else if (ty < 5.5) Tr = vec3(0.0, aAnimB.x * sin(tim * aAnimB.y + aAnimB.z), 0.0);
  else if (ty < 6.5) R = ardRX(aAnimB.x * sin(tim * aAnimB.y + aAnimB.z) * aAnimB.w);
  else if (ty < 7.5) R = ardRZ(aAnimB.x * sin(tim * aAnimB.y + aAnimB.z) * (0.35 + 0.65 * mov));
  else Tr = vec3(mod(trav, max(aAnimB.x, 0.1)) - 0.5 * aAnimB.x, 0.0, 0.0);
#endif
}
`;
function animShader(sh) {
  sh.vertexShader = ANIM_GLSL + sh.vertexShader;
  if (sh.vertexShader.includes('#include <beginnormal_vertex>')) sh.vertexShader = sh.vertexShader.replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\n{ mat3 ardR; vec3 ardT; ardAnim(ardR, ardT); objectNormal = ardR * objectNormal; }');
  sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n{ mat3 ardR; vec3 ardT; ardAnim(ardR, ardT); transformed = ardR * (transformed - aAnim.yzw) + aAnim.yzw + ardT; }');
}
const ANIM_DEFAULTS = { aAnim: [0, 0, 0, 0], aAnimB: [0, 0, 0, 0], aInst: [0, 0, 0, 0], aInstC: [0] };
// 4.3a — detalhe de superfície (pt por peça: 1 painéis, 2 borracha, 3 poros, 4 quitina, 5 pedra; 0 liso). uDet é global (qualidade).
const DET = { value: 1 }; const PAT = { steel: 1, metal: 1, paint: 1, dark: 1, gloss: 1, rubber: 2, bone: 3, skin: 3, chitin: 4, wet: 4, stone: 5, matte: 5, rock: 6 }; /* 4.3b: 6 rocha (estratos finos, grão, fissuras) */
const SURF_GLSL = `uniform float uDet; varying float vPt; varying vec3 vLoc; varying vec3 vLocN;
float ardH2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float ardVN(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(ardH2(i), ardH2(i + vec2(1.0, 0.0)), f.x), mix(ardH2(i + vec2(0.0, 1.0)), ardH2(i + vec2(1.0, 1.0)), f.x), f.y); }
vec3 ardPerturb(vec3 sp, vec3 sn, vec2 dh, float fd) { vec3 sx = normalize(dFdx(sp)), sy = normalize(dFdy(sp)); vec3 r1 = cross(sy, sn), r2 = cross(sn, sx); float det = dot(sx, r1) * fd; vec3 g = sign(det) * (dh.x * r1 + dh.y * r2); return normalize(abs(det) * sn - g); }
void ardSurf(out float h, out float alb, out float rgh) {
  h = 0.0; alb = 1.0; rgh = 0.0; int pt = int(vPt + 0.5); if (pt == 0 || uDet <= 0.0) return;
  vec3 an = abs(vLocN); vec2 uv = an.x >= an.y && an.x >= an.z ? vLoc.zy : (an.y >= an.z ? vLoc.xz : vLoc.xy);
  float fw = max(fwidth(uv.x), fwidth(uv.y)); float k = (1.0 - smoothstep(0.035, 0.11, fw)) * uDet; if (k <= 0.0) return;
  if (pt == 1) { vec2 cs = vec2(2.6, 1.6); vec2 c = uv / cs; c.x += 0.37 * mod(floor(c.y), 3.0); vec2 id = floor(c); vec2 f = fract(c);
    float hv = ardH2(id), hw = ardH2(id + 7.3); vec2 e = min(f, 1.0 - f) * cs; float ex = hw < 0.45 ? 9.0 : e.x; /* placas unidas: sem costura vertical */
    float seam = 1.0 - smoothstep(0.012, 0.04, min(ex, e.y));
    vec2 q = abs(f - 0.5) * cs - (cs * 0.5 - 0.16); float rv = hv > 0.55 ? 1.0 - smoothstep(0.025, 0.045, length(q)) : 0.0;
    float vent = hv < 0.12 ? smoothstep(0.35, 0.5, abs(fract(f.y * 7.0) - 0.5)) * step(0.18, f.x) * step(f.x, 0.82) * step(0.15, f.y) * step(f.y, 0.85) : 0.0;
    float pv = hv - 0.5; float grime = ardVN(uv * 3.1) * (1.0 - smoothstep(0.0, 2.4, vLoc.y)) + 0.35 * ardVN(uv * 11.0) * ardVN(uv * 0.9);
    h = -seam * 0.6 + rv * 0.35 - vent * 0.5; alb = (1.0 + pv * 0.09 - seam * 0.26 + rv * 0.08 - vent * 0.3) * (1.0 - 0.2 * grime); rgh = pv * 0.12 + seam * 0.1 + 0.18 * grime; }
  else if (pt == 2) { float g = abs(fract(uv.x * 1.8 + uv.y * 0.2) - 0.5); float gr = smoothstep(0.3, 0.44, g); h = -gr * 0.7; alb = 1.0 - 0.18 * gr; rgh = 0.05 * gr; }
  else if (pt == 3 || pt == 4) { vec2 p = uv * (pt == 3 ? 2.6 : 1.5); vec2 i = floor(p), f = fract(p); float d1 = 8.0, d2 = 8.0;
    for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) { vec2 o = vec2(float(x), float(y)); vec2 r = o + vec2(ardH2(i + o), ardH2(i + o + 17.0)) - f; float d = dot(r, r); if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d; }
    d1 = sqrt(d1); d2 = sqrt(d2);
    if (pt == 3) { float pore = 1.0 - smoothstep(0.0, 0.16, d1); h = -pore * 0.6 + ardVN(uv * 7.0) * 0.25; alb = 1.0 - 0.2 * pore; rgh = 0.1 * pore; }
    else { float edge = 1.0 - smoothstep(0.0, 0.09, d2 - d1); h = -edge * 0.7 + d1 * 0.3; alb = 0.92 + 0.14 * d1 - 0.22 * edge; rgh = -0.08 + 0.18 * edge; } }
  else if (pt == 5) { float n = ardVN(uv * 2.4) * 0.6 + ardVN(uv * 6.5) * 0.4; h = n * 0.8; alb = 0.84 + 0.32 * n; rgh = 0.05 * n; }
  else if (pt == 6) { float sd = 1.0 - smoothstep(0.45, 0.8, an.y); /* 4.3b: rocha — paredes com estratos finos e grão alongado na horizontal, fissuras verticais esparsas; topo com grão e poeira */
    float ly = vLoc.y * 1.25 + ardVN(uv * 0.35) * 0.9; float lt = ardH2(vec2(floor(ly), 5.3)); float tw = abs(fract(ly) - 0.5) * 2.0; float gro = smoothstep(0.55, 1.0, tw) * step(0.5, ardH2(vec2(floor(ly + 0.5), 9.1))); /* sulco escolhido pela junta mais próxima: contínuo dos dois lados (sem serrilhado da derivada) */
    float gr = ardVN(uv * 4.6) * 0.65 + ardVN(uv * 11.0) * 0.35;
    float crk = (1.0 - smoothstep(0.0, 0.05, abs(ardVN(vec2(uv.x * 2.4, uv.y * 0.45) + 7.1) - 0.5))) * smoothstep(0.5, 0.72, ardVN(uv * 0.6 + 2.3)) * sd; /* fissura só na cor: relevo fino serrilha na derivada de tela */
    h = sd * (-gro * 0.6 + (0.5 - tw) * 0.25) + (gr - 0.5) * (0.7 - 0.35 * sd);
    alb = 1.0 + sd * ((lt - 0.5) * 0.2 - gro * 0.2) + (gr - 0.5) * (0.2 - 0.06 * sd) - crk * 0.32; rgh = 0.04 * gr + 0.06 * crk; }
  h *= k; alb = mix(1.0, alb, k); rgh *= k;
}
`; // geometria sem as peças animadas lê zeros (sem animação)
function roundBox(w, h, d, b, segs) {
  b = Math.max(0.01, Math.min(b, w / 2 - 0.02, d / 2 - 0.02, h / 2 - 0.02)); const iw = w - 2 * b, id = d - 2 * b, rc = Math.min(b, iw / 2, id / 2) * 0.8;
  const s = new T.Shape(); const x0 = -iw / 2, x1 = iw / 2, y0 = -id / 2, y1 = id / 2;
  s.moveTo(x0 + rc, y0); s.lineTo(x1 - rc, y0); s.quadraticCurveTo(x1, y0, x1, y0 + rc); s.lineTo(x1, y1 - rc); s.quadraticCurveTo(x1, y1, x1 - rc, y1); s.lineTo(x0 + rc, y1); s.quadraticCurveTo(x0, y1, x0, y1 - rc); s.lineTo(x0, y0 + rc); s.quadraticCurveTo(x0, y0, x0 + rc, y0);
  const g = new T.ExtrudeGeometry(s, { depth: Math.max(0.01, h - 2 * b), bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: LOD < 1 ? 1 : (segs || 2), curveSegments: LOD < 1 ? 2 : 3 });
  g.rotateX(-Math.PI / 2); g.translate(0, b, 0); return g;
}
// ---------- 4.3b: rocha esculpida e cristal ----------
const SUN_DIR = [-0.41, 0.74, 0.51]; // sol do jogo (render3d); os nós não giram, então o sombreado assado casa com a luz
function smooth01(a, b, x) { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
function visBox(parts, base) { const bb = new T.Box3(), v = new T.Vector3(); for (const p of parts) { const a = p.geo.attributes.position; for (let i = 0; i < a.count; i++) if (a.getY(i) >= base - 1e-4) bb.expandByPoint(v.fromBufferAttribute(a, i)); } if (bb.isEmpty()) bb.set(new T.Vector3(-1, base, -1), new T.Vector3(1, base + 1, 1)); return bb; }
function shadeGeo(g, amt) { const n = g.attributes.normal, p = g.attributes.position; let c = g.attributes.color; if (!c) { c = new T.BufferAttribute(new Float32Array(p.count * 3).fill(1), 3); g.setAttribute('color', c); }
  for (let i = 0; i < p.count; i++) { const l = n.getX(i) * SUN_DIR[0] + n.getY(i) * SUN_DIR[1] + n.getZ(i) * SUN_DIR[2]; const k = 1 - amt + amt * (0.3 + 0.95 * Math.max(0, l)); c.setXYZ(i, c.getX(i) * k, c.getY(i) * k, c.getZ(i) * k); } }
function supR(c, s, sq) { return Math.pow(Math.pow(Math.abs(c), sq) + Math.pow(Math.abs(s), sq), -1 / sq); }
// anéis do pé ao topo: saia (y < 0, enterrada), pé com tálus, estratos (paredão, bancada, recuo macio, camada dura saliente) e tampa;
// o.n lados, o.sq superelipse (2 redondo, 6 quase caixa), o.rough ruído do contorno, o.fis fendas, o.strata camadas, o.ledge degrau, o.taper afinamento,
// o.tilt inclinação do topo, o.cuts planos de fratura, o.sink saia (unidades da receita), o.flare alargamento do pé, o.top flat|dome|peak|jag, o.cols, o.dust, o.dark;
// o.skirt anéis da saia, o.sinkFlare alargamento da saia, o.chip lascas do contorno, o.jit ruído por vértice, o.rim borda lascada do topo, o.dustK poeira, o.tiltDir
function cragGeo(w, h, d, col, o) {
  const r = rng((o.seed | 0) * 131 + 17), N = Math.max(5, Math.round((o.n || 16) * LOD)), sq = o.sq || 2.6, rough = o.rough == null ? 0.12 : o.rough, jit = o.jit == null ? 0.035 : o.jit, a = w / 2, b = d / 2;
  const harm = []; for (let k = 2; k <= 5; k++) harm.push([k, (r() - 0.5) * 4 * rough / k, r() * PI * 2]);
  const fis = new Set(); for (let i = 0; i < (o.fis == null ? 2 : o.fis); i++) fis.add(Math.floor(r() * N));
  const th = [], rad = [], ck = [];
  const chip = o.chip == null ? 0.07 : o.chip; for (let i = 0; i < N; i++) { const t = (i + (r() - 0.5) * 0.4) / N * PI * 2; let rr = supR(Math.cos(t), Math.sin(t), sq) * (1 + (r() - 0.5) * 2 * chip); for (const [k, am, ph] of harm) rr *= 1 + am * Math.cos(k * t + ph); const f = fis.has(i) ? 0.13 + r() * 0.15 : 0; th.push(t); rad.push(rr * (1 - f)); ck.push(f); }
  const flare = o.flare == null ? 0.1 : o.flare, taper = o.taper == null ? 0.82 : o.taper, ledge = o.ledge == null ? 0.06 : o.ledge, top = o.top || 'flat', nb = o.strata == null ? 5 : o.strata, rim = o.rim == null ? 0.1 : o.rim;
  const R = []; if (o.sink) { const ns = o.skirt || 1, sf = o.sinkFlare == null ? 0.22 : o.sinkFlare; for (let k = ns; k >= 1; k--) R.push({ y: -o.sink * (k - (k % 2 ? 0 : 0.35 + r() * 0.2)) / ns / h, s: 1 + flare + sf * Math.pow(k / ns, 0.8) + (ns > 1 ? (r() - 0.5) * 0.08 : 0), b: k, sk: 1 }); } // saia: parede irregular abaixo do chão (quase vertical: na encosta do monte não cobre quem passa ao lado)
  R.push({ y: 0, s: 1 + flare, b: 0 }); let y = 0, s = 1, band = 0;
  if (nb > 0) { y = 0.04 + r() * 0.05; R.push({ y, s, b: 0 }); const avg = (1 - y) / nb;
    while (y < 0.999) { band++; let ny = y + avg * (0.55 + r() * 0.9); if (ny > 0.9) ny = 1; const tap = 1 - (1 - taper) * (ny - y), k = r();
      if (k < 0.52) R.push({ y: ny, s: s *= tap, b: band });
      else if (k < 0.76) { R.push({ y: y + 0.006, s: s *= 1 - ledge * (0.5 + r()), b: band, bench: 1 }); R.push({ y: ny, s: s *= tap, b: band }); }
      else if (k < 0.9) { const s2 = s * (1 - ledge * (0.7 + r() * 0.6)); R.push({ y: y + (ny - y) * 0.45, s: s2, b: band }); R.push({ y: ny, s: s = s2 * (1 + ledge * 0.35) * tap, b: band }); }
      else { R.push({ y: y + 0.006, s: s *= 1 + ledge * 0.45, b: band }); R.push({ y: ny, s: s *= tap, b: band }); }
      y = ny; } }
  else R.push({ y: 1, s: s *= taper, b: 1 });
  const cy = top === 'dome' ? [0.08, 0.13] : top === 'peak' ? [0.16, 0.38] : top === 'jag' ? [-0.07, -0.03] : [0.006, 0.014];
  R.push({ y: 1 + cy[0], s: s * (top === 'peak' ? 0.5 : top === 'flat' ? 0.72 : 0.6), b: band, cap: 1 }); R.push({ y: 1 + cy[1], s: 0, b: band, cap: 1 });
  const tilt = o.tilt == null ? 0.1 : o.tilt, ta = o.tiltDir == null ? r() * PI * 2 : o.tiltDir, tx = Math.cos(ta) * tilt, tz = Math.sin(ta) * tilt;
  const P = R.map(g => { if (g.s === 0) { const p = [0, g.y * h, 0]; return th.map(() => p); }
    return th.map((t, i) => { const rr = g.s * rad[i] * (1 + (r() - 0.5) * 2 * jit); const p = [a * rr * Math.cos(t), g.y * h, b * rr * Math.sin(t)]; if (g.y >= 0.999 && !g.cap) { if (top === 'jag') p[1] -= r() * 0.24 * h; else if (top === 'flat' && r() < 0.4) p[1] -= (0.3 + r() * 0.7) * rim * h; } return p; }); }); // borda do topo lascada
  const uniq = []; const seen = new Set(); for (const ring of P) for (const p of ring) if (!seen.has(p)) { seen.add(p); uniq.push(p); }
  for (const p of uniq) if (p[1] > 0) p[1] += (p[1] / h) * (tx * p[0] / a + tz * p[2] / b) * h; // topo inclinado; os estratos mergulham junto
  for (let c = 0; c < (o.cuts == null ? 2 : o.cuts); c++) { const an = r() * PI * 2, ny = -0.12 + r() * 0.42, L = Math.hypot(1, ny), n = [Math.cos(an) / L, ny / L, Math.sin(an) / L];
    const rr = supR(Math.cos(an), Math.sin(an), sq), dist = Math.hypot(a * rr * Math.cos(an), b * rr * Math.sin(an)) * (0.68 + r() * 0.2);
    const hx = Math.cos(an), hz = Math.sin(an), dh = L * dist + ny * h * 0.5 + 0.03 * (a + b) * 0.5; /* abaixo do chão a saia segue o corte na vertical (antes o pé ficava para fora como aba fina) */
    for (const p of uniq) { if (p[1] < 0) { const v = p[0] * hx + p[2] * hz - dh; if (v > 0) { p[0] -= hx * v; p[2] -= hz * v; } continue; } const v = p[0] * n[0] + (p[1] - h * 0.5) * n[1] + p[2] * n[2] - dist; if (v > 0) { p[0] -= n[0] * v; p[1] = Math.max(0, p[1] - n[1] * v); p[2] -= n[2] * v; } } } // corte plano de fratura
  const cols = (o.cols || [col]).map(c => new T.Color(c)), dust = new T.Color(o.dust || '#ADA08A'), dk = o.dark == null ? 0.42 : o.dark, dK = o.dustK == null ? 0.32 : o.dustK;
  const CC = R.map(g => { const bc = cols[g.b % cols.length]; if (g.s === 0) { const c = bc.clone().multiplyScalar(1 - dk * 0.05).lerp(dust, dK); return th.map(() => c); } return th.map((t, i) => { const k = (1 - dk * (g.sk ? 0.75 : 1 - smooth01(-0.25, 0.5, g.y))) * (1 - 1.7 * ck[i]) * (0.9 + 0.2 * r()); const c = bc.clone().multiplyScalar(k); if (g.cap) c.lerp(dust, dK); else if (g.bench) c.lerp(dust, dK * 0.5); return c; }); });
  const pos = [], cl = []; const V = (j, i) => { const p = P[j][i], c = CC[j][i]; pos.push(p[0], p[1], p[2]); cl.push(c.r, c.g, c.b); };
  for (let j = 0; j < R.length - 1; j++) for (let i = 0; i < N; i++) { const i2 = (i + 1) % N; if (R[j].s > 0) { V(j, i); V(j + 1, i); V(j, i2); } if (R[j + 1].s > 0) { V(j + 1, i); V(j + 1, i2); V(j, i2); } }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new T.Float32BufferAttribute(cl, 3));
  const j0 = R.findIndex(q => q.y >= 0), jt = R.length - 3; g.userData.fis = [...fis].map(i => { const p0 = P[j0][i], p1 = P[jt][i]; return [p0[0], p0[1], p0[2], p1[0], p1[1], p1[2], Math.cos(th[i]), Math.sin(th[i])]; }); // fendas: pé, topo e direção para fora
  return g;
}
function xtalGeo(rad, h, o) {
  const r = rng((o.seed | 0) * 53 + 11), N = o.n || 6, tw = r() * PI, sh = o.sh == null ? 0.66 + r() * 0.14 : o.sh;
  const ring = (y, s) => { const a = []; for (let i = 0; i < N; i++) { const t = tw + i / N * PI * 2, k = s * (1 + (r() - 0.5) * 0.22); a.push([Math.cos(t) * rad * k, y, Math.sin(t) * rad * k]); } return a; };
  const A = ring(-h * 0.25, 0.86), B = ring(h * sh, o.top == null ? 1.05 : o.top), C = [(r() - 0.5) * rad * 0.5, h, (r() - 0.5) * rad * 0.5];
  const g0 = o.glow == null ? 0.45 : o.glow; const kk = y => 1 - g0 + g0 * Math.max(0, Math.min(1.25, (y + h * 0.1) / h)) * 1.05; // mais escuro na base, aceso na ponta
  const pos = [], cl = []; const V = p => { pos.push(p[0], p[1], p[2]); const k = kk(p[1]); cl.push(k, k, k); };
  for (let i = 0; i < N; i++) { const i2 = (i + 1) % N; V(A[i]); V(B[i]); V(A[i2]); V(B[i]); V(B[i2]); V(A[i2]); V(B[i]); V(C); V(B[i2]); }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new T.Float32BufferAttribute(cl, 3)); return g;
}

// ---------- 4.3c: flora (lâminas, folhas, frondes, troncos afinados, bulbos com gomos, espinhos, cascalho) ----------
// Geometria não indexada com cor por vértice e normais próprias. Lâminas, folhas e frondes usam normal "de copa": a face misturada com
// "para cima" e "para fora do centro da planta" (o.nc), lida igual dos dois lados (o dress3d desfaz a inversão do verso). Assim a planta
// sombreia como um volume e não como um monte de cartões soltos; o.kf/o.ku/o.ko = pesos de face, cima e fora.
function fbuf(pos, nor, col) { const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(nor, 3)); g.setAttribute('color', new T.Float32BufferAttribute(col, 3)); return g; }
function cnorm(f, p, o) { const c = o.nc || [0, 0.4, 0]; let ox = p[0] - c[0], oy = (p[1] - c[1]) * 0.5, oz = p[2] - c[2]; const ol = Math.hypot(ox, oy, oz) || 1; ox /= ol; oy /= ol; oz /= ol;
  const kf = o.kf == null ? 0.5 : o.kf, ku = o.ku == null ? 0.5 : o.ku, ko = o.ko == null ? 0.4 : o.ko; const sg = f[0] * ox * 0.4 + f[1] * 0.6 + f[2] * oz * 0.4 < 0 ? -kf : kf; /* a face que olha para cima e para fora */
  const nx = f[0] * sg + ox * ko, ny = f[1] * sg + ku + oy * ko, nz = f[2] * sg + oz * ko, l = Math.hypot(nx, ny, nz) || 1; return [nx / l, ny / l, nz / l]; }
function fcross(a, b, c) { const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2]; const x = uy * vz - uz * vy, y = uz * vx - ux * vz, z = ux * vy - uy * vx, l = Math.hypot(x, y, z) || 1; return [x / l, y / l, z / l]; }
// triângulo com normal de copa: a face é orientada pela referência ref (lado de cima da lâmina)
function ftri(out, A, B, C, cA, cB, cC, ref, o) { let f = fcross(A, B, C); if (f[0] * ref[0] + f[1] * ref[1] + f[2] * ref[2] < 0) f = [-f[0], -f[1], -f[2]];
  for (const [P, c] of [[A, cA], [B, cB], [C, cC]]) { out.pos.push(P[0], P[1], P[2]); const n = cnorm(f, P, o); out.nor.push(n[0], n[1], n[2]); out.col.push(c[0], c[1], c[2]); } }
const fmix = (a, b, t, k) => [(a.r + (b.r - a.r) * t) * k, (a.g + (b.g - a.g) * t) * k, (a.b + (b.b - a.b) * t) * k];
// caminho curvo no plano do azimute az: nasce em b, inclinação inicial t0 (0 = vertical), curva cv (rad somados até a ponta, quadrática), comprimento L, n trechos
function curvePath(b, az, t0, cv, L, n) { const ca = Math.cos(az), sa = Math.sin(az), P = [], Tg = []; let r = 0, y = 0;
  for (let i = 0; i <= n; i++) { if (i) { const sm = (i - 0.5) / n, th = t0 + cv * sm * sm; r += Math.sin(th) * L / n; y += Math.cos(th) * L / n; } const s = i / n, th = t0 + cv * s * s;
    P.push([b[0] + r * ca, b[1] + y, b[2] + r * sa]); Tg.push([Math.sin(th) * ca, Math.cos(th), Math.sin(th) * sa]); }
  return { P, Tg, side: [-sa, 0, ca] }; }
const fupper = (side, t) => [-side[2] * t[1], side[2] * t[0] - side[0] * t[2], side[0] * t[1]]; // face de cima da lâmina (side × tangente)
// lâmina ('blade': larga na base) ou folha ('leaf': fecha na base e na ponta); o.n trechos, o.fold vinco central, o.c0/o.c1 cores, o.dk escurece (folhas de dentro), o.ao sombra na base
function ribbonGeo(b, az, t0, cv, L, w, o) {
  const leaf = o.shape === 'leaf', n = o.lite ? Math.max(leaf ? 2 : 1, Math.ceil((o.n || 3) / 2)) : (o.n || 3), fold = o.lite ? 0 : (o.fold || 0), { P, Tg, side } = curvePath(b, az, t0, cv, L, n);
  const c0 = new T.Color(o.c0 || '#FFFFFF'), c1 = new T.Color(o.c1 || o.c0 || '#FFFFFF'), dk = o.dk == null ? 1 : o.dk, ao = o.ao == null ? 0.3 : o.ao, out = { pos: [], nor: [], col: [] };
  const R = P.map((C, i) => { const s = i / n, ww = (leaf ? Math.pow(Math.max(0, Math.sin(PI * s)), 0.75) : 1 - Math.pow(s, 1.4)) * w * 0.5, nf = fupper(side, Tg[i]);
    return { C, nf, w: ww, L: [C[0] - side[0] * ww, C[1], C[2] - side[2] * ww], Rr: [C[0] + side[0] * ww, C[1], C[2] + side[2] * ww], M: [C[0] + nf[0] * fold * ww * 2, C[1] + nf[1] * fold * ww * 2, C[2] + nf[2] * fold * ww * 2],
      c: fmix(c0, c1, Math.pow(s, 0.85), dk * (1 - ao * (1 - s) * (1 - s))) }; });
  for (let i = 0; i < n; i++) { const a = R[i], q = R[i + 1], ref = a.nf, cE = a.c.map(v => v * 0.92), qE = q.c.map(v => v * 0.92); /* bordas um tom abaixo do vinco */
    if (fold) { if (a.w < 1e-5) { ftri(out, a.C, q.L, q.M, a.c, qE, q.c, ref, o); ftri(out, a.C, q.M, q.Rr, a.c, q.c, qE, ref, o); }
      else if (q.w < 1e-5) { ftri(out, a.L, a.M, q.C, cE, a.c, q.c, ref, o); ftri(out, a.M, a.Rr, q.C, a.c, cE, q.c, ref, o); }
      else { ftri(out, a.L, q.L, a.M, cE, qE, a.c, ref, o); ftri(out, a.M, q.L, q.M, a.c, qE, q.c, ref, o); ftri(out, a.M, q.M, a.Rr, a.c, q.c, cE, ref, o); ftri(out, a.Rr, q.M, q.Rr, cE, q.c, qE, ref, o); } }
    else { if (a.w < 1e-5) ftri(out, a.C, q.L, q.Rr, a.c, q.c, q.c, ref, o); else if (q.w < 1e-5) ftri(out, a.L, a.Rr, q.C, a.c, a.c, q.c, ref, o); else { ftri(out, a.L, a.Rr, q.L, a.c, a.c, q.c, ref, o); ftri(out, a.Rr, q.Rr, q.L, a.c, q.c, q.c, ref, o); } } }
  const g = fbuf(out.pos, out.nor, out.col); g.userData.tip = P[n]; return g; }
// fronde: ráquis curva com o.m pares de folíolos triangulares (maiores no meio), caídos (o.droop) e puxados para a ponta
function frondGeo(b, az, t0, cv, L, o) {
  const m = o.lite ? Math.max(3, Math.ceil((o.m || 9) / 2)) : (o.m || 9), { P, Tg, side } = curvePath(b, az, t0, cv, L, m), lk = o.lk || 0.3, dr = o.droop == null ? 0.3 : o.droop, c0 = new T.Color(o.c0 || '#FFFFFF'), c1 = new T.Color(o.c1 || o.c0 || '#FFFFFF'), dk = o.dk == null ? 1 : o.dk, out = { pos: [], nor: [], col: [] };
  for (let i = 1; i <= m; i++) { const s = (i - 0.5) / m, ll = L * lk * Math.pow(Math.sin(PI * Math.min(1, 0.12 + s * 0.92)), 0.7) * (1 - 0.3 * s), A = P[i - 1], B = P[i], t = Tg[i], nf = fupper(side, t);
    const M = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2, (A[2] + B[2]) / 2], cA = fmix(c0, c1, (i - 1) / m, dk * 0.92), cB = fmix(c0, c1, i / m, dk * 0.92), cT = fmix(c0, c1, Math.min(1, s + 0.3), dk * 1.06);
    for (const sg of [-1, 1]) { const tip = [M[0] + side[0] * sg * ll + t[0] * ll * 0.4 - nf[0] * ll * dr, M[1] + side[1] * sg * ll + t[1] * ll * 0.4 - nf[1] * ll * dr, M[2] + side[2] * sg * ll + t[2] * ll * 0.4 - nf[2] * ll * dr]; ftri(out, A, B, tip, cA, cB, cT, nf, o); } }
  const g = fbuf(out.pos, out.nor, out.col); g.userData.tip = P[m]; return g; }
// tronco/galho afinado por pontos [x, y, z, raio]; normal radial (liso); cor o.c0 → o.c1 ao longo, listras de casca o.bark e base mais escura; o.cap fecha o topo
function trunkGeo(pts, o) {
  const n = o.lite ? Math.max(3, (o.n || 6) - 2) : (o.n || 6), N = pts.length, c0 = new T.Color(o.c0 || '#FFFFFF'), c1 = new T.Color(o.c1 || o.c0 || '#FFFFFF'), bark = o.bark || 0, rot = o.rot || 0, sr = rng((o.seed | 0) * 31 + 7);
  const V = p => new T.Vector3(p[0], p[1], p[2]), Ts = pts.map((p, i) => V(pts[Math.min(N - 1, i + 1)]).sub(V(pts[Math.max(0, i - 1)])).normalize());
  let Nn = new T.Vector3().crossVectors(Ts[0], Math.abs(Ts[0].y) < 0.9 ? new T.Vector3(0, 1, 0) : new T.Vector3(1, 0, 0)).normalize(); const rings = [], stripe = [];
  for (let k = 0; k < n; k++) stripe.push(1 - bark * sr());
  for (let i = 0; i < N; i++) { const t = Ts[i]; Nn = Nn.sub(t.clone().multiplyScalar(Nn.dot(t))).normalize(); const B = new T.Vector3().crossVectors(t, Nn); const s = i / (N - 1), r = pts[i][3];
    const base = fmix(c0, c1, s, 1), ring = []; for (let k = 0; k < n; k++) { const ph = rot + k / n * PI * 2, d = Nn.clone().multiplyScalar(Math.cos(ph)).add(B.clone().multiplyScalar(Math.sin(ph))); const ao = pts[i][1] < 0.12 ? 0.7 + 2.5 * Math.max(0, pts[i][1]) : 1;
      ring.push({ p: [pts[i][0] + d.x * r, pts[i][1] + d.y * r, pts[i][2] + d.z * r], n: [d.x, d.y, d.z], c: base.map(v => v * stripe[k] * ao) }); } rings.push(ring); }
  const pos = [], nor = [], col = []; const put = q => { pos.push(q.p[0], q.p[1], q.p[2]); nor.push(q.n[0], q.n[1], q.n[2]); col.push(q.c[0], q.c[1], q.c[2]); };
  for (let i = 0; i < N - 1; i++) for (let k = 0; k < n; k++) { const k2 = (k + 1) % n, a = rings[i][k], b = rings[i][k2], c = rings[i + 1][k], d = rings[i + 1][k2];
    if (pts[i][3] > 1e-5) { put(a); put(b); put(c); } if (pts[i + 1][3] > 1e-5) { put(b); put(d); put(c); } } /* anéis giram no sentido da tangente: frente para fora */
  if (o.cap && pts[N - 1][3] > 1e-5) { const L = rings[N - 1], ct = pts[N - 1], tn = Ts[N - 1], cc = new T.Color(o.cap === true ? o.c1 || '#FFFFFF' : o.cap); for (let k = 0; k < n; k++) { const a = L[k], b = L[(k + 1) % n]; for (const q of [a, b]) { pos.push(q.p[0], q.p[1], q.p[2]); nor.push(tn.x, tn.y, tn.z); col.push(cc.r, cc.g, cc.b); } pos.push(ct[0], ct[1], ct[2]); nor.push(tn.x, tn.y, tn.z); col.push(cc.r * 0.85, cc.g * 0.85, cc.b * 0.85); } }
  return fbuf(pos, nor, col); }
// bulbo com gomos: perfil [[raio, y], ...] de baixo para cima; o.n lados (par = crista/vale alternados com o.ribs = n/2), o.rk fundura, o.jit irregularidade; normais lisas
function bulbGeo(prof, o) {
  const n = o.lite ? Math.max(4, Math.round((o.n || 8) * 0.6)) : (o.n || 8), ribs = o.ribs || n / 2, rk = o.lite ? 0 : (o.rk || 0), jit = o.jit || 0, r = rng((o.seed | 0) * 17 + 3), c0 = new T.Color(o.c0 || '#FFFFFF'), c1 = new T.Color(o.c1 || o.c0 || '#FFFFFF'), M = prof.length, y0 = prof[0][1], y1 = prof[M - 1][1];
  const jt = []; for (let k = 0; k < n; k++) jt.push(1 + (r() - 0.5) * 2 * jit);
  const pos = [], col = [], idx = [];
  for (let j = 0; j < M; j++) { const [pr, py] = prof[j], s = (py - y0) / ((y1 - y0) || 1); for (let k = 0; k < n; k++) { const ph = k / n * PI * 2 + (o.rot || 0), rib = Math.cos(ribs * ph), rr = pr * (1 + rk * rib) * jt[k];
    pos.push(Math.cos(ph) * rr, py, Math.sin(ph) * rr); const c = fmix(c0, c1, Math.max(0, Math.min(1, s)), (1 + rib * (o.ribC == null ? 0.1 : o.ribC)) * (py < 0.1 ? 0.75 + 2.5 * Math.max(0, py) : 1)); col.push(c[0], c[1], c[2]); } }
  for (let j = 0; j < M - 1; j++) for (let k = 0; k < n; k++) { const k2 = (k + 1) % n, a = j * n + k, b = j * n + k2, c = (j + 1) * n + k, d = (j + 1) * n + k2;
    if (prof[j][0] > 1e-5) idx.push(a, c, b); if (prof[j + 1][0] > 1e-5) idx.push(b, c, d); }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new T.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals(); return g; }
// espinho: pirâmide fina sem base (o.n lados), cor o.c0 na base → o.c1 na ponta
function spikeGeo(a, b, r, o) { const n = o.n || 3, A = new T.Vector3(a[0], a[1], a[2]), d = new T.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize(); const u = new T.Vector3().crossVectors(d, Math.abs(d.y) < 0.9 ? new T.Vector3(0, 1, 0) : new T.Vector3(1, 0, 0)).normalize(), v = new T.Vector3().crossVectors(d, u);
  const c0 = new T.Color(o.c0 || '#FFFFFF'), c1 = new T.Color(o.c1 || o.c0 || '#FFFFFF'), ring = []; for (let k = 0; k < n; k++) { const ph = k / n * PI * 2 + (o.rot || 0); ring.push(A.clone().add(u.clone().multiplyScalar(Math.cos(ph) * r)).add(v.clone().multiplyScalar(Math.sin(ph) * r))); }
  const pos = [], col = []; for (let k = 0; k < n; k++) { const p = ring[k], q = ring[(k + 1) % n]; pos.push(p.x, p.y, p.z, q.x, q.y, q.z, b[0], b[1], b[2]); col.push(c0.r, c0.g, c0.b, c0.r, c0.g, c0.b, c1.r, c1.g, c1.b); }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new T.Float32BufferAttribute(col, 3)); return g; }
// cascalho: cada lasca [x, z, raio, altura] vira um tronco de pirâmide de o.n lados (4) meio enterrado, com tampa; topo empoeirado (o.c1) e pé escuro (o.c0)
function chipsGeo(list, o) { const n = o.lite ? 3 : (o.n || 4), r = rng((o.seed | 0) * 7 + 5), c0 = new T.Color(o.c0 || '#FFFFFF'), c1 = new T.Color(o.c1 || o.c0 || '#FFFFFF'), pos = [], col = [];
  for (const [x, z, rad, h] of list) { const tw = r() * PI, B = [], U = []; for (let k = 0; k < n; k++) { const ph = tw + k / n * PI * 2 + (r() - 0.5) * 0.5, rr = rad * (0.8 + r() * 0.4); B.push([x + Math.cos(ph) * rr, -0.06, z + Math.sin(ph) * rr * 0.8]); U.push([x + Math.cos(ph + 0.3) * rr * 0.55, h * (0.75 + r() * 0.3), z + Math.sin(ph + 0.3) * rr * 0.45]); }
    const top = [x + (r() - 0.5) * rad * 0.3, h * 1.05, z + (r() - 0.5) * rad * 0.3], cb = [c0.r, c0.g, c0.b], cu = [c1.r * 0.92, c1.g * 0.92, c1.b * 0.92], ct = [c1.r, c1.g, c1.b];
    const T3 = (p, q, s, cp, cq, cs) => { pos.push(p[0], p[1], p[2], q[0], q[1], q[2], s[0], s[1], s[2]); col.push(...cp, ...cq, ...cs); };
    for (let k = 0; k < n; k++) { const k2 = (k + 1) % n; T3(B[k], U[k], B[k2], cb, cu, cb); T3(B[k2], U[k], U[k2], cb, cu, cu); T3(U[k], top, U[k2], cu, ct, cu); } }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new T.Float32BufferAttribute(col, 3)); return g; }
// pátina: recolore faces voltadas para cima (normal.y > ny) por manchas de ruído (fração k) com as cores cols (líquen, geada, cinza)
function patinaGeo(g, cols, k, ny, seed) { const p = g.attributes.position, c = g.attributes.color; if (!c) return; const C = cols.map(x => new T.Color(x)), h3 = (x, y, z) => { const v = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719 + seed * 4.7) * 43758.5453; return v - Math.floor(v); };
  const sm = (x, y, z) => { const f = 2.2; const a = h3(Math.floor(x * f), Math.floor(y * f), Math.floor(z * f)); return a; };
  for (let i = 0; i < p.count; i += 3) { const A = [p.getX(i), p.getY(i), p.getZ(i)], B = [p.getX(i + 1), p.getY(i + 1), p.getZ(i + 1)], D = [p.getX(i + 2), p.getY(i + 2), p.getZ(i + 2)], f = fcross(A, B, D); if (f[1] < ny) continue;
    const cx = (A[0] + B[0] + D[0]) / 3, cy = (A[1] + B[1] + D[1]) / 3, cz = (A[2] + B[2] + D[2]) / 3; const v = sm(cx, cy, cz) * 0.7 + h3(cx, cy, cz) * 0.3; if (v > k) continue; const cc = C[Math.floor(h3(cz, cx, cy) * C.length) % C.length], t = 0.75 + 0.25 * f[1];
    for (let j = 0; j < 3; j++) c.setXYZ(i + j, c.getX(i + j) * (1 - t) + cc.r * t, c.getY(i + j) * (1 - t) + cc.g * t, c.getZ(i + j) * (1 - t) + cc.b * t); }
  c.needsUpdate = true; }

// ---------- utilitários de forma ----------
const PI = Math.PI, H = Math.PI / 2;
function wheel(K, P, x, y, z, r, w) { K.anim({ t: 'wheel', p: [x, y, z], r }, () => { K.cyl(x, y, z - w / 2, r, r, w, P.d, 'rubber', { rx: H, seg: 14 }); K.cyl(x, y, z - w / 2 - 0.04, r * 0.55, r * 0.55, w + 0.08, P.t || P.b, 'metal', { rx: H, seg: 10 }); K.box(x, y - r * 0.5, z, 0.2, r, w + 0.16, P.b, 'metal'); }); } // 4.2b: o raio de metal deixa o giro visível
function track(K, P, x, z, len, h, w) { K.box(x, 0, z, len, h, w, P.d, 'rubber', { b: Math.min(h, w) * 0.42 }); const n = Math.max(3, Math.round(len / 2.4)); const sz = z > 0 ? 1 : -1; for (let i = 0; i < n; i++) K.cyl(x - len / 2 + (i + 0.5) * len / n, h * 0.5, z + sz * (w / 2) - (sz > 0 ? 0 : 0.14), h * 0.36, h * 0.36, 0.14, P.b, 'metal', { rx: H, seg: 10 }); }
function arch(K, x, y, z, A, Hh, D, phi, r, col, mat, o) { const pts = []; for (let i = 0; i <= 12; i++) { const th = i / 12 * PI; pts.push([x + A * Math.cos(th) * Math.cos(phi), y + Hh * Math.sin(th), z + D * Math.cos(th) * Math.sin(phi)]); } K.tube(pts, r, col, mat, Object.assign({ ts: 18 }, o)); }
function legSpec(base, o) { return Object.assign({ t: 'leg', p: base, amp: 0.32, stride: 7, ph: (base[2] > 0 ? 0 : Math.PI) + ((Math.round(base[0] / 2) & 1) ? Math.PI : 0) }, o || {}); } // 4.2b: pés e garras desenhados à parte usam a mesma passada: K.anim(legSpec(quadril), () => ...)
function leg(K, base, knee, foot, r, col, mat) { K.anim(legSpec(base), () => { K.seg(base, knee, r, col, mat); K.seg(knee, foot, r * 0.85, col, mat, { taper: 0.45 }); }); } // 4.2b: perna balança do quadril; lados alternados
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
  ring(K, P, tc, x, z, R, y) { K.anim({ t: 'spin', p: [x, y, z], speed: (R > 5 ? 1 : -1) * (0.4 + 2 / R) }, () => { K.tor(x, y, z, R, 0.3, P.t, 'metal', { ts: 40 }); ringOf(8, R, (cx, cz) => K.light(x + cx, y + 0.25, z + cz, 0.45, P.l)); }); }, // 4.2b: anel de luzes gira devagar (anéis internos no sentido oposto)
  door(K, P, tc, x, z, w, h, y) { y = y || 0; K.box(x, y, z, 0.5, h, w, P.d, 'dark'); for (let i = 0; i < 5; i++) K.box(x + 0.27, y + h * (0.1 + i * 0.18), z, 0.08, h * 0.08, w * 0.9, P.b, 'metal'); K.light(x + 0.3, y + h + 0.3, z - w / 2 + 0.3, 0.4, '#FF8A3A'); K.light(x + 0.3, y + h + 0.3, z + w / 2 - 0.3, 0.4, '#FF8A3A'); },
  pipe(K, P, tc, pts) { K.tube(pts, 0.32, P.t, 'metal', { ts: 14 }); },
  banner(K, P, tc, x, z, h) { K.seg([x, 0, z], [x, h, z], 0.12, P.t, 'metal'); K.box(x - 0.9, h * 0.55, z, 1.6, h * 0.42, 0.1, tc, 'paint'); },
  crown(K, P, tc, x, z, y, s) { this.tower(K, P, tc, x - 2.4 * s, z + 2.4 * s, 1.1 * s, 5 * s, y); this.tower(K, P, tc, x - 2.4 * s, z - 2.4 * s, 0.9 * s, 4 * s, y); K.seg([x + 1.8 * s, y, z], [x + 1.8 * s, y + 9 * s, z], 0.24 * s, P.t, 'metal', { taper: 0.5 }); K.box(x + 1.8 * s, y + 5.2 * s, z, 2.8 * s, 0.3 * s, 0.3 * s, P.t, 'metal', { anim: { t: 'spin', p: [x + 1.8 * s, y + 5.2 * s, z], speed: 1.2 } }); K.sph(x + 1.8 * s, y + 9.1 * s, z, 0.55 * s, '#FF4A3A', null, { e: 3 }); K.box(x + 2.6 * s, y, z + 2.6 * s, 2.4 * s, 1.6 * s, 2 * s, P.b, 'steel', { b: 0.3 }); },
  reactor(K, P, tc) { this.pad(K, P, tc, 0, 0, 22, 18); K.lathe([[5.4, 0], [4.5, 3], [3.4, 7], [3.6, 9.6], [4.1, 11]], 3.4, 0.6, 0, '#B9B4AA', 'matte', { seg: 28 }); K.cyl(3.4, 10.7, 0, 3.85, 3.85, 0.3, '#FFC080', null, { e: 1.5, seg: 24 }); K.tor(3.4, 11.6, 0, 4.1, 0.16, tc, 'paint', { ts: 36 }); this.block(K, P, tc, -6, 0, 7, 12, 5.4, 0.6); this.pipe(K, P, tc, [[-2.5, 3.6, 3], [0, 3.2, 3.4], [1.6, 2.2, 3.4]]); this.pipe(K, P, tc, [[-2.5, 3.6, -3], [0, 3.2, -3.4], [1.6, 2.2, -3.4]]); this.tower(K, P, tc, -7.5, 4, 0.8, 5, 6); },
  pylon(K, P, tc) { this.pad(K, P, tc, 0, 0, 12, 12); K.cyl(0, 0.6, 0, 2.6, 3.2, 1.6, P.a, 'steel', { seg: 8, facet: true }); for (let i = 0; i < 4; i++) { const a = i * PI / 2 + PI / 4; K.seg([Math.cos(a) * 2.4, 2, Math.sin(a) * 2.4], [Math.cos(a) * 0.5, 15, Math.sin(a) * 0.5], 0.22, P.b, 'metal'); } for (const yy of [6, 10]) K.tor(0, yy, 0, 1.9 - yy * 0.09, 0.12, P.t, 'metal', { ts: 20 }); this.ring(K, P, tc, 0, 0, 3.4, 14); K.sph(0, 16, 0, 0.7, '#FF4A3A', null, { e: 3 }); K.box(0, 3.2, 0, 2.2, 1.2, 2.2, tc, 'paint', { b: 0.2 }); },
  turret(K, P, tc, s, twin) { K.box(0, 0, 0, 5 * s, 2 * s, 4.6 * s, P.a, 'steel', { b: 0.5 * s }); K.box(-0.6 * s, 2 * s, 0, 2.6 * s, 0.6 * s, 2.6 * s, tc, 'paint', { b: 0.2 * s }); for (const zz of twin ? [-1, 1] : [0]) { K.anim({ t: 'recoil', dist: 0.9 * s }, () => { K.seg([2 * s, 1 * s, zz * 1.1 * s], [7.6 * s, 1 * s, zz * 1.1 * s], 0.36 * s, P.b, 'metal', { seg: 10 }); K.cyl(7.6 * s, 1 * s, zz * 1.1 * s, 0.55 * s, 0.55 * s, 1 * s, P.d, 'dark', { rz: -H, seg: 10 }); }); } K.light(-2.4 * s, 1.4 * s, 0, 0.4 * s, '#FF4040'); },
  wall(K, P, tc, gate) { K.box(0, 0, 0, 16, 0.8, 4.2, P.d, 'dark', { b: 0.2 }); if (gate) { for (const s of [-1, 1]) { K.box(s * 6.6, 0.8, 0, 2.8, 6.6, 4, P.a, 'steel', { b: 0.4 }); K.light(s * 6.6, 7.6, 0, 0.6, '#FF8A3A'); } K.box(0, 4.4, 0, 10.4, 0.8, 1.6, P.d, 'dark'); for (let i = -2; i <= 2; i++) K.box(i * 2, 0.8, 0, 0.3, 3.6, 0.3, P.b, 'metal'); } else { K.box(0, 0.8, 0, 15.6, 4.6, 3.4, P.a, 'steel', { b: 0.35 }); K.box(0, 3.6, 0, 15.8, 0.5, 3.5, tc, 'paint'); for (let i = 0; i < 4; i++) K.box(-6 + i * 4, 5.4, 0, 2.2, 0.9, 3.6, P.b, 'steel', { b: 0.15 }); } },
};
// Erevane: placas angulares escuras ("origami"), vidro fosco, costuras luminosas, agulhas com ponta acesa
KITS.erevane = {
  block(K, P, tc, x, z, w, d, h, y) { y = y || 0; const s = Math.min(w * 0.18, h * 0.5);
    K.poly([[-w / 2, 0], [w / 2, 0], [w / 2 - s, h], [-w / 2 + s * 0.6, h]], d, P.a, 'gloss', { x, y, z, b: 0.22 });
    K.poly([[-w * 0.32, 0], [w * 0.28, 0], [-w * 0.02, h * 0.42]], d * 0.86, P.b, 'glass', { x, y: y + h + 0.2, z, b: 0.08 });
    for (const sg of [-1, 1]) K.box(x, y + h * 0.5, z + sg * (d / 2 + 0.24), w * 0.78, 0.13, 0.08, tc, null, { e: 2 });
    K.box(x - w * 0.02, y + h + 0.24 + h * 0.42, z, 0.18, 0.12, d * 0.8, P.l, null, { e: 2.6 }); },
  tower(K, P, tc, x, z, r, h, y) { y = y || 0; K.cone(x, y, z, r, h, P.b, 'glass', { seg: 4, ry: PI / 4, flat: true }); K.oct(x, y + h + 0.3, z, r * 0.3, r * 0.9, P.l, null, { e: 3, anim: { t: 'spin', p: [x, y, z], speed: 1.2 } }); for (let i = 0; i < 2; i++) K.poly([[0, 0], [r * 1.5, 0], [0, h * 0.55]], 0.12, P.a, 'gloss', { x, y, z, ry: i * PI / 2 + PI / 4 }); },
  pillar(K, P, tc, x, z, r, h, y) { y = y || 0; K.cyl(x, y, z, r * 0.7, r * 1.2, h, P.a, 'gloss', { seg: 4, ry: PI / 4, facet: true }); K.box(x + r * 0.62, y + h * 0.3, z, 0.1, h * 0.5, 0.2, tc, null, { e: 2 }); },
  tank(K, P, tc, x, z, r, h, y) { y = y || 0; K.cyl(x, y, z, r * 0.9, r, h, P.a, 'gloss', { seg: 6, facet: true }); K.cone(x, y + h, z, r * 0.9, r * 0.8, P.b, 'glass', { seg: 6, flat: true }); K.tor(x, y + h * 0.55, z, r * 1.0, 0.1, tc, null, { e: 2, ts: 6 }); },
  dome(K, P, tc, x, z, r, y) { y = y || 0; K.sph(x, y, z, r, P.b, 'glass', { half: true, seg: 7, flat: true }); K.tor(x, y + 0.2, z, r * 1.01, 0.12, P.l, null, { e: 2.4, ts: 7 }); },
  pad(K, P, tc, x, z, w, d, y) { y = y || 0; K.prism(x, y, z, 1, 0.5, 6, P.d, 'gloss', { sx: w / 2, sz: d / 2, ry: PI / 6 }); K.prism(x, y + 0.5, z, 1, 0.05, 6, P.c, null, { e: 1.2, sx: w / 2 - 0.4, sz: d / 2 - 0.4, ry: PI / 6, top: 0.98 }); K.prism(x, y + 0.52, z, 1, 0.06, 6, P.d, 'gloss', { sx: w / 2 - 0.8, sz: d / 2 - 0.8, ry: PI / 6 }); },
  ring(K, P, tc, x, z, R, y) { K.tor(x, y, z, R, 0.16, P.l, null, { e: 2.6, ts: 6, anim: { t: 'spin', p: [x, y, z], speed: 0.6 } }); K.tor(x, y - 0.4, z, R * 0.9, 0.22, P.a, 'gloss', { ts: 6, anim: { t: 'spin', p: [x, y - 0.4, z], speed: -0.4 } }); }, // 4.2b: anéis hexagonais giram em sentidos opostos
  door(K, P, tc, x, z, w, h, y) { y = y || 0; K.poly([[0, 0], [0, h * 0.8], [0.01, h]], w, P.d, 'gloss', { x, y, z }); K.box(x + 0.05, y, z, 0.3, h * 0.9, w, P.d, 'gloss'); K.box(x + 0.25, y + h * 0.9, z, 0.12, 0.12, w * 0.9, tc, null, { e: 2.2 }); },
  pipe(K, P, tc, pts) { K.tube(pts, 0.18, P.c, null, { e: 1.6, ts: 12 }); },
  banner(K, P, tc, x, z, h) { K.seg([x, 0, z], [x, h, z], 0.1, P.d, 'gloss'); K.poly([[0, 0], [-1.6, -0.8], [-0.2, -h * 0.45]], 0.08, tc, 'paint', { x, y: h, z, anim: { t: 'sway', p: [x, h, z], amp: 0.08, speed: 1.6, ph: z * 0.4 } }); }, // 4.2b: flâmula balança presa no topo do mastro
  crown(K, P, tc, x, z, y, s) { this.tower(K, P, tc, x, z, 2.2 * s, 12 * s, y); K.anim({ t: 'spin', p: [x, y, z], speed: 0.45 }, () => { ringOf(3, 4.2 * s, (cx, cz, a) => K.poly([[0, 0], [2.4 * s, 0.6 * s], [0.4 * s, 4.6 * s]], 0.16, P.a, 'gloss', { x: x + cx, y: y + 3 * s, z: z + cz, ry: -a, rz: 0.25 })); K.tor(x, y + 6 * s, z, 3.2 * s, 0.14, tc, null, { e: 2.2, ts: 6 }); }); }, // 4.2b: coroa de lâminas gira em volta da agulha
  reactor(K, P, tc) { this.pad(K, P, tc, 0, 0, 20, 18); K.anim({ t: 'spin', p: [0, 3, 0], speed: 0.5 }, () => { K.oct(0, 3, 0, 3.4, 9, P.b, 'glass'); K.oct(0, 4.6, 0, 1.6, 5.4, P.l, null, { e: 2.2, ry: PI / 4 }); }); ringOf(4, 5.4, (cx, cz, a) => K.poly([[-1.6, 0], [1.6, 0], [0.9, 8.5], [-0.6, 7]], 0.3, P.a, 'gloss', { x: cx, y: 0.6, z: cz, ry: -a + H, rx: 0.18 })); K.tor(0, 1.4, 0, 4.2, 0.12, tc, null, { e: 2, ts: 6, anim: { t: 'spin', p: [0, 1.4, 0], speed: -0.4 } }); },
  pylon(K, P, tc) { this.pad(K, P, tc, 0, 0, 12, 12); K.cone(0, 0.5, 0, 2.2, 14, P.b, 'glass', { seg: 4, ry: PI / 4, flat: true }); this.ring(K, P, tc, 0, 0, 3.2, 12); K.oct(0, 15.2, 0, 0.8, 2.2, P.l, null, { e: 3, anim: { t: 'spin', p: [0, 15.2, 0], speed: 1.2 } }); for (let i = 0; i < 4; i++) K.poly([[0, 0], [2.4, 0], [0, 5.5]], 0.12, P.a, 'gloss', { y: 0.5, ry: i * H + PI / 4 }); K.box(1.0, 4, 0, 0.1, 3.4, 0.6, tc, null, { e: 2 }); },
  turret(K, P, tc, s, twin) { K.oct(0, 0, 0, 2.6 * s, 2.6 * s, P.b, 'gloss', { sx: 1.25 }); for (const zz of twin ? [-1, 1] : [0]) { K.anim({ t: 'recoil', dist: 0.75 * s }, () => { K.box(3.8 * s, 1 * s, zz * 1.2 * s + 0.45 * s, 6.4 * s, 0.32 * s, 0.32 * s, P.d, 'metal'); K.box(3.8 * s, 1 * s, zz * 1.2 * s - 0.45 * s, 6.4 * s, 0.32 * s, 0.32 * s, P.d, 'metal'); K.box(3.8 * s, 1 * s, zz * 1.2 * s, 6 * s, 0.12 * s, 0.5 * s, P.l, null, { e: 2.4 }); }); } K.box(-0.6 * s, 1.6 * s, 0, 0.1, 0.4 * s, 2.4 * s, tc, null, { e: 2 }); },
  wall(K, P, tc, gate) { if (gate) { for (const sg of [-1, 1]) { K.cone(sg * 6.4, 0, 0, 1.9, 8.4, P.a, 'gloss', { seg: 4, ry: PI / 4, flat: true }); K.oct(sg * 6.4, 8.6, 0, 0.4, 1.1, P.l, null, { e: 3 }); } K.box(0, 3.4, 0, 10.6, 0.16, 0.3, tc, null, { e: 2.2 }); K.box(0, 0, 0, 16, 0.5, 3.6, P.d, 'gloss'); } else { K.poly([[-8, 0], [8, 0], [7, 5.8], [-7, 5.8]], 2.4, P.a, 'gloss', { b: 0.25 }); for (let i = -3; i <= 3; i++) K.poly([[-1, 0], [1, 0], [0, 2.2]], 0.5, P.b, 'glass', { x: i * 2.1, y: 6, rz: (i % 2) * 0.12 }); K.box(0, 2.6, 1.5, 14, 0.14, 0.08, tc, null, { e: 2 }); K.box(0, 2.6, -1.5, 14, 0.14, 0.08, tc, null, { e: 2 }); } },
};
// Tessara: casco orgânico cor de osso, nervuras, bulbos bioluminescentes, raízes e pétalas
KITS.tessara = {
  block(K, P, tc, x, z, w, d, h, y) { y = y || 0; K.sph(x, y, z, 1, P.a, 'bone', { half: true, sx: w / 2, sy: h * 1.15, sz: d / 2, seg: 22 }); for (let i = 0; i < 3; i++) arch(K, x, y, z, w / 2 * 1.01, h * 1.16, d / 2 * 1.01, i * PI / 3 + PI / 6, Math.max(0.16, w * 0.012), P.t, 'bone'); K.tor(x, y + 0.15, z, w / 2 * 0.98, 0.28, P.d, 'matte', { sz: d / w, ts: 36 }); K.sph(x, y + h * 1.15, z, Math.max(0.6, w * 0.06), tc, 'skin', { seg: 12 }); ringOf(4, Math.min(w, d) * 0.36, (cx, cz) => K.sph(x + cx, y + h * 0.55, z + cz, Math.max(0.3, w * 0.03), P.l, null, { e: 1.6, seg: 8 })); },
  tower(K, P, tc, x, z, r, h, y) { y = y || 0; K.anim({ t: 'sway', p: [x, y, z], amp: 0.06, speed: 1.1, ph: x * 0.5 + z * 0.3 }, () => { K.tube([[x, y, z], [x + r * 0.4, y + h * 0.35, z + r * 0.2], [x - r * 0.3, y + h * 0.7, z], [x, y + h, z]], r * 0.5, P.b, 'bone', { ts: 14, rs: 8 }); K.sph(x, y + h + r * 0.6, z, r * 0.95, P.am, null, { e: 1.6, seg: 12 }); for (let i = 0; i < 3; i++) K.sph(x + Math.cos(i * 2.1) * r * 0.9, y + h * 0.5 + i * r * 0.4, z + Math.sin(i * 2.1) * r * 0.9, r * 0.55, '#6FBF7E', 'skin', { sy: 0.35, seg: 10 }); }); }, // 4.2b: caule vivo balança a partir da base
  pillar(K, P, tc, x, z, r, h, y) { y = y || 0; K.cyl(x, y, z, r * 0.8, r * 1.3, h, P.b, 'bone', { seg: 12 }); for (let i = 0; i < 3; i++) K.tube([[x + Math.cos(i * 2.1) * r * 1.2, y, z + Math.sin(i * 2.1) * r * 1.2], [x + Math.cos(i * 2.1 + 0.6) * r, y + h * 0.5, z + Math.sin(i * 2.1 + 0.6) * r], [x + Math.cos(i * 2.1 + 1.2) * r * 0.85, y + h, z + Math.sin(i * 2.1 + 1.2) * r * 0.85]], 0.22, P.t, 'bone', { ts: 10 }); },
  tank(K, P, tc, x, z, r, h, y) { y = y || 0; K.sph(x, y + h * 0.45, z, r, '#CDEFD6', 'wet', { sy: h / (2 * r) * 1.1, seg: 16 }); K.sph(x, y + h * 0.5, z, r * 0.45, P.l, null, { e: 1.2, seg: 10, sy: 1.6 }); for (let i = 0; i < 3; i++) arch(K, x, y + 0.1, z, r * 1.02, h * 0.9, r * 1.02, i * PI / 3, 0.12, P.t, 'bone', { ts: 12 }); },
  dome(K, P, tc, x, z, r, y) { y = y || 0; K.sph(x, y, z, r, P.b, 'bone', { half: true, seg: 18 }); ringOf(6, r * 0.9, (cx, cz, a) => K.sph(x + cx, y + r * 0.35, z + cz, r * 0.42, '#7FCF8E', 'skin', { sx: 0.5, sy: 1.4, sz: 0.8, ry: -a, seg: 10 })); K.sph(x, y + r, z, r * 0.4, P.l, null, { e: 2, seg: 12 }); },
  pad(K, P, tc, x, z, w, d, y) { y = y || 0; K.cyl(x, y, z, 1, 1.05, 0.5, P.d, 'matte', { sx: w / 2, sz: d / 2, seg: 28 }); ringOf(7, 1, (cx, cz, a) => K.tube([[x + cx * w * 0.4, y + 0.5, z + cz * d * 0.4], [x + cx * w * 0.55, y + 0.4, z + cz * d * 0.58], [x + cx * w * 0.66, y, z + cz * d * 0.7]], 0.3, P.t, 'bone', { ts: 8 })); },
  ring(K, P, tc, x, z, R, y) { K.anim({ t: 'spin', p: [x, y, z], speed: (R > 5 ? 1 : -1) * (0.3 + 1.5 / R) }, () => { K.tor(x, y, z, R, 0.3, P.t, 'bone', { ts: 36 }); ringOf(6, R, (cx, cz) => K.sph(x + cx, y + 0.35, z + cz, 0.42, P.l, null, { e: 2, seg: 8 })); }); }, // 4.2b: halo de bulbos gira devagar
  door(K, P, tc, x, z, w, h, y) { y = y || 0; K.sph(x, y, z, 1, P.d, 'matte', { half: true, sx: 0.6, sy: h, sz: w / 2, seg: 14 }); arch(K, x + 0.2, y, z, 0.01, h * 1.05, w / 2 * 1.05, H, 0.3, P.t, 'bone'); },
  pipe(K, P, tc, pts) { K.tube(pts, 0.3, P.t, 'bone', { ts: 12 }); },
  banner(K, P, tc, x, z, h) { K.anim({ t: 'sway', p: [x, 0, z], amp: 0.08, speed: 1.4, ph: z * 0.4 }, () => { K.tube([[x, 0, z], [x + 0.3, h * 0.5, z], [x, h, z]], 0.14, P.t, 'bone', { ts: 8 }); K.sph(x - 0.6, h * 0.75, z, 0.9, tc, 'skin', { sx: 0.8, sy: 1.3, sz: 0.15, seg: 10 }); }); }, // 4.2b: estandarte orgânico balança da base
  crown(K, P, tc, x, z, y, s) { K.anim({ t: 'sway', p: [x, y, z], amp: 0.06, speed: 0.9 }, () => { K.tube([[x, y, z], [x + 0.6 * s, y + 4 * s, z], [x, y + 7 * s, z]], 0.9 * s, P.b, 'bone', { ts: 10 }); ringOf(6, 2.2 * s, (cx, cz, a) => K.sph(x + cx, y + 7.4 * s, z + cz, 1.6 * s, i6(a) ? '#8FD8A0' : '#B9E8C2', 'skin', { sx: 0.4, sy: 1.5, sz: 0.9, ry: -a, rz: 0.6, seg: 10 })); K.sph(x, y + 7.8 * s, z, 1.5 * s, P.l, null, { e: 2.2, seg: 14 }); }); }, // 4.2b: flor da coroa balança no caule
  reactor(K, P, tc) { this.pad(K, P, tc, 0, 0, 20, 18); K.sph(0, 5, 0, 4.6, '#D98A5A', 'wet', { sy: 1.15, seg: 22 }); for (let i = 0; i < 5; i++) arch(K, 0, 0.5, 0, 4.7, 10, 4.7, i * PI / 5, 0.22, '#7A2E28', 'wet', { ts: 16 }); K.sph(0, 5.3, 0, 1.6, P.am, null, { e: 2.4, seg: 12 }); this.tower(K, P, tc, -6, 4, 0.9, 6, 0.4); this.tower(K, P, tc, 5.5, -4.5, 0.7, 4.5, 0.4); },
  pylon(K, P, tc) { this.pad(K, P, tc, 0, 0, 12, 12); this.tower(K, P, tc, 0, 0, 1.6, 13, 0.4); this.ring(K, P, tc, 0, 0, 3.2, 9.5); K.box(0.9, 3, 0, 0.5, 1.4, 1.6, tc, 'skin', { b: 0.2 }); },
  turret(K, P, tc, s, twin) { K.sph(0, 1.4 * s, 0, 2.4 * s, P.a, 'bone', { sx: 1.25, sy: 0.8, seg: 16 }); for (const zz of twin ? [-1, 1] : [0]) { K.anim({ t: 'recoil', dist: 0.8 * s }, () => { K.seg([1.6 * s, 1.5 * s, zz * 1.1 * s], [7 * s, 1.7 * s, zz * 1.1 * s], 0.5 * s, P.b, 'bone', { taper: 0.7, seg: 10 }); K.sph(7 * s, 1.7 * s, zz * 1.1 * s, 0.4 * s, P.l, null, { e: 2.2, seg: 8 }); }); } K.sph(-1.8 * s, 2.2 * s, 0, 0.8 * s, tc, 'skin', { seg: 10 }); },
  wall(K, P, tc, gate) { if (gate) { for (const sg of [-1, 1]) { this.pillar(K, P, tc, sg * 6.4, 0, 1.2, 7.4, 0); K.sph(sg * 6.4, 8, 0, 1.1, P.l, null, { e: 1.8, seg: 10 }); } arch(K, 0, 0, 0, 6.4, 7.6, 0.01, 0, 0.35, P.t, 'bone'); K.box(0, 0, 0, 16, 0.4, 3.6, P.d, 'matte'); } else { K.box(0, 0, 0, 16, 0.6, 3.4, P.d, 'matte', { b: 0.25 }); for (let i = -3; i <= 3; i++) { arch(K, i * 2.25, 0.4, 0, 0.01, 4.6 - Math.abs(i) * 0.25, 1.3, H, 0.32, P.b, 'bone', { ts: 12 }); K.cone(i * 2.25, 4.2 - Math.abs(i) * 0.25, 0, 0.32, 1.8, P.t, 'bone', { seg: 8, rz: (i % 2) * 0.25 }); } K.seg([-7.4, 2.4, 0], [7.4, 2.4, 0], 0.24, P.t, 'bone'); ringOf(3, 1, (cx, cz, a, i) => K.sph(-5 + i * 5, 3, 0, 0.35, P.l, null, { e: 1.6, seg: 8 })); } },
};
function i6(a) { return Math.round(a * 6 / (PI * 2)) % 2 === 0; }
// Coro Quorith: cristal facetado claro, núcleos de ametista, anéis flutuantes, nada encosta no chão por inteiro
KITS.quorith = {
  block(K, P, tc, x, z, w, d, h, y) { y = y || 0; K.prism(x, y, z, 1, 0.6, 6, P.d, 'gloss', { sx: w / 2 + 0.6, sz: d / 2 + 0.6 }); K.prism(x, y + 0.6, z, 1, h * 0.8, 6, P.a, 'crystal', { sx: w / 2, sz: d / 2, top: 0.86 }); K.prism(x, y + 0.6 + h * 0.8, z, 0.86, h * 0.35, 6, P.b, 'crystal', { sx: w / 2, sz: d / 2, top: 0.35 }); K.prism(x, y + h * 0.45, z, 1.005, 0.22, 6, P.c, null, { e: 2.2, sx: w / 2, sz: d / 2, top: 1 }); K.oct(x, y + 0.6 + h * 1.15 + 0.6, z, Math.min(w, d) * 0.1, Math.min(w, d) * 0.3, tc, null, { e: 1.6, anim: { t: 'bob', amp: 0.3, speed: 1.4, ph: x * 0.4 + z * 0.3 } }); }, // 4.2b: cristal flutuante sobe e desce
  tower(K, P, tc, x, z, r, h, y) { y = y || 0; K.prism(x, y, z, r, h * 0.75, 6, P.a, 'crystal', { top: 0.55 }); K.cone(x, y + h * 0.75, z, r * 0.55, h * 0.3, P.b, 'crystal', { seg: 6, flat: true }); K.oct(x, y + h * 1.12, z, r * 0.4, r * 1.3, P.c, null, { e: 2.6, anim: { t: 'bob', amp: 0.25, speed: 1.6, ph: x * 0.4 + z * 0.3 } }); K.tor(x, y + h * 0.95, z, r * 1.4, 0.12, P.l, null, { e: 2, ts: 6, anim: { t: 'spin', p: [x, y + h * 0.95, z], speed: 0.8 } }); }, // 4.2b: ponta flutua, halo gira
  pillar(K, P, tc, x, z, r, h, y) { y = y || 0; K.prism(x, y, z, r * 1.2, h, 6, P.a, 'crystal', { top: 0.8 }); K.prism(x, y + h * 0.5, z, r * 1.2 * 0.9 + 0.02, 0.3, 6, P.c, null, { e: 2.2, top: 1 }); },
  tank(K, P, tc, x, z, r, h, y) { y = y || 0; K.oct(x, y, z, r, h, P.a, 'crystal'); K.oct(x + r * 0.7, y, z + r * 0.4, r * 0.5, h * 0.6, P.b, 'crystal', { rz: -0.4 }); K.oct(x - r * 0.6, y, z - r * 0.5, r * 0.45, h * 0.55, P.b, 'crystal', { rz: 0.35 }); K.oct(x, y + h * 0.35, z, r * 0.4, h * 0.3, P.c, null, { e: 2 }); },
  dome(K, P, tc, x, z, r, y) { y = y || 0; K.sph(x, y, z, r, P.b, 'crystal', { half: true, seg: 6, flat: true }); K.oct(x, y + r * 1.1, z, r * 0.35, r * 0.9, P.c, null, { e: 2.4, anim: { t: 'spin', p: [x, y + r * 1.1, z], speed: 1 } }); K.tor(x, y + r * 0.9, z, r * 0.9, 0.12, P.l, null, { e: 2, ts: 6, anim: { t: 'spin', p: [x, y + r * 0.9, z], speed: -0.6 } }); }, // 4.2b: cristal e halo giram em sentidos opostos
  pad(K, P, tc, x, z, w, d, y) { y = y || 0; K.prism(x, y, z, 1, 0.5, 6, P.d, 'gloss', { sx: w / 2, sz: d / 2 }); K.prism(x, y + 0.5, z, 1, 0.06, 6, P.c, null, { e: 1.4, sx: w / 2 - 0.5, sz: d / 2 - 0.5 }); K.prism(x, y + 0.52, z, 1, 0.08, 6, P.d, 'gloss', { sx: w / 2 - 0.9, sz: d / 2 - 0.9 }); },
  ring(K, P, tc, x, z, R, y) { K.tor(x, y, z, R, 0.18, P.l, null, { e: 2.4, ts: 6, anim: { t: 'spin', p: [x, y, z], speed: 0.6 } }); K.tor(x, y + 0.6, z, R * 0.8, 0.14, P.a, 'crystal', { ts: 6, rx: 0.2, anim: { t: 'spin', p: [x, y + 0.6, z], speed: -0.9 } }); }, // 4.2b: anéis flutuantes giram (o inclinado oscila)
  door(K, P, tc, x, z, w, h, y) { y = y || 0; K.box(x, y + 0.3, z, 0.3, h, 0.28, P.c, null, { e: 2.2 }); K.oct(x, y + h + 0.6, z, 0.4, 1.2, tc, null, { e: 1.6, anim: { t: 'spin', p: [x, y + h + 0.6, z], speed: 1 } }); },
  pipe(K, P, tc, pts) { K.tube(pts, 0.12, P.l, null, { e: 2.2, ts: 12 }); },
  banner(K, P, tc, x, z, h) { K.oct(x, 0, z, 0.5, h, P.a, 'crystal'); K.oct(x, h * 0.7, z, 0.4, 1.4, tc, null, { e: 1.4 }); },
  crown(K, P, tc, x, z, y, s) { K.oct(x, y + 2.4 * s, z, 3 * s, 9 * s, P.a, 'crystal', { ry: PI / 4 }); K.oct(x, y + 5.2 * s, z, 1.3 * s, 3.6 * s, P.c, null, { e: 2.6 }); K.tor(x, y + 6.8 * s, z, 4.4 * s, 0.2 * s, P.t, 'crystal', { rx: 0.35, ts: 6, anim: { t: 'spin', p: [x, y + 6.8 * s, z], speed: 0.5 } }); K.tor(x, y + 6.8 * s, z, 3.8 * s, 0.14 * s, P.l, null, { e: 2.2, rz: 0.4, ts: 6, anim: { t: 'spin', p: [x, y + 6.8 * s, z], speed: 0.5 } }); }, // 4.2b: anéis da coroa giram juntos como um giroscópio (mesma rotação; em sentidos opostos se atravessariam)
  reactor(K, P, tc) { this.pad(K, P, tc, 0, 0, 20, 18); K.anim({ t: 'bob', amp: 0.35, speed: 1.2 }, () => { K.oct(0, 2, 0, 2.6, 11, P.a, 'crystal'); K.oct(0, 4.6, 0, 1.2, 5.6, P.c, null, { e: 2.8 }); }); K.anim({ t: 'spin', p: [0, 7.5, 0], speed: 0.6 }, () => { K.tor(0, 7.5, 0, 4.4, 0.24, P.t, 'crystal', { rx: 0.5, ts: 6 }); K.tor(0, 7.5, 0, 4.4, 0.24, P.t, 'crystal', { rz: 0.5, ts: 6 }); }); ringOf(5, 6.6, (cx, cz, a) => K.oct(cx, 0.5, cz, 0.9, 3.4, P.b, 'crystal', { rz: Math.cos(a) * 0.3, rx: Math.sin(a) * 0.3 })); },
  pylon(K, P, tc) { this.pad(K, P, tc, 0, 0, 12, 12); K.prism(0, 0.5, 0, 1.8, 3, 6, P.b, 'crystal', { top: 0.6 }); K.anim({ t: 'bob', amp: 0.3, speed: 1.3 }, () => { K.oct(0, 5.2, 0, 1.9, 8.6, P.a, 'crystal'); K.oct(0, 7.5, 0, 0.8, 3.6, P.c, null, { e: 2.6 }); }); this.ring(K, P, tc, 0, 0, 3.1, 13.6); K.oct(0, 15, 0, 0.6, 1.6, tc, null, { e: 1.8, anim: { t: 'bob', amp: 0.25, speed: 1.3, ph: 1.6 } }); }, // 4.2b: cristais flutuantes sobem e descem fora de fase
  turret(K, P, tc, s, twin) { K.prism(0, 0, 0, 2.2 * s, 1.4 * s, 6, P.a, 'crystal', { top: 0.8 }); for (const zz of twin ? [-1, 1] : [0]) K.anim({ t: 'recoil', dist: 0.9 * s }, () => { K.oct(3.4 * s, 0.4 * s, zz * 1.1 * s, 0.7 * s, 1.4 * s, P.a, 'crystal', { rz: -H, sy: 3.4 }); K.oct(6.6 * s, 0.4 * s, zz * 1.1 * s, 0.3 * s, 0.7 * s, P.c, null, { e: 2.6, rz: -H }); }); K.oct(0, 1.4 * s, 0, 0.8 * s, 1.8 * s, tc, null, { e: 1.6 }); },
  wall(K, P, tc, gate) { K.prism(0, 0, 0, 1, 0.5, 6, P.d, 'gloss', { sx: 8.2, sz: 2 }); if (gate) { for (const sg of [-1, 1]) { K.prism(sg * 6.4, 0.5, 0, 1.6, 7.4, 6, P.a, 'crystal', { top: 0.4 }); K.oct(sg * 6.4, 8.4, 0, 0.5, 1.4, P.c, null, { e: 2.4 }); } K.box(0, 4, 0, 10.6, 0.16, 0.16, P.l, null, { e: 2.6 }); K.box(0, 2.2, 0, 10.6, 0.16, 0.16, P.l, null, { e: 2.6 }); } else { for (let i = -3; i <= 3; i++) K.oct(i * 2.25, 0.4, (i % 2) * 0.4, 1.3, 5.8 + (i % 2 ? -0.8 : 0.6), i % 3 ? P.a : P.b, 'crystal', { ry: i * 0.5 }); K.box(0, 2.4, 0, 15, 0.14, 0.14, tc, null, { e: 2 }); } },
};
// Prole Vorag: quitina úmida escura, placas sobrepostas, espinhos de osso, sacos membranosos e poros acesos
KITS.vorag = {
  block(K, P, tc, x, z, w, d, h, y) { y = y || 0; K.sph(x, y, z, 1, P.a, 'chitin', { half: true, sx: w / 2, sy: h * 1.1, sz: d / 2, seg: 20 }); ringOf(5, 1, (cx, cz, a) => K.sph(x + cx * w * 0.28, y + h * 0.35, z + cz * d * 0.28, 1, P.b, 'chitin', { sx: w * 0.24, sy: h * 0.62, sz: d * 0.2, ry: -a, seg: 12 })); ringOf(6, 1, (cx, cz, a) => K.cone(x + cx * w * 0.42, y + h * 0.42, z + cz * d * 0.42, Math.max(0.3, w * 0.04), Math.max(1.6, h * 0.5), P.bo, 'bone', { seg: 8, rz: -cx * 0.7, rx: cz * 0.7 })); ringOf(4, 1, (cx, cz) => K.sph(x + cx * w * 0.3, y + h * 0.82, z + cz * d * 0.3, Math.max(0.3, w * 0.03), P.l, null, { e: 2, seg: 8 })); K.sph(x, y + h * 1.08, z, Math.max(0.5, w * 0.06), tc, 'wet', { seg: 10 }); },
  tower(K, P, tc, x, z, r, h, y) { y = y || 0; const pts = [[x, y, z], [x + r * 0.3, y + h * 0.4, z + r * 0.2], [x + r * 0.9, y + h * 0.8, z], [x + r * 1.8, y + h, z - r * 0.2]]; K.anim({ t: 'sway', p: [x, y, z], amp: 0.07, speed: 1.3, ph: x * 0.5 + z * 0.37 }, () => { for (let i = 0; i < 3; i++) K.seg(pts[i], pts[i + 1], r * (1 - i * 0.28), P.bo, 'bone', { taper: 0.72, seg: 10 }); }); K.sph(x, y + 0.4, z, r * 1.3, P.a, 'chitin', { half: true, seg: 12 }); },
  pillar(K, P, tc, x, z, r, h, y) { y = y || 0; K.cyl(x, y, z, r * 0.7, r * 1.3, h, P.a, 'chitin', { seg: 10 }); for (let i = 0; i < 4; i++) K.tor(x, y + h * (0.2 + i * 0.2), z, r * (1.2 - i * 0.12), 0.25, P.bo, 'bone', { ts: 18 }); },
  tank(K, P, tc, x, z, r, h, y) { y = y || 0; K.sph(x, y + h * 0.5, z, r, P.m, 'wet', { sy: h / (2 * r), seg: 16 }); for (let i = 0; i < 3; i++) arch(K, x, y + 0.2, z, r * 1.02, h * 0.95, r * 1.02, i * PI / 3, 0.1, '#FF8A8A', null, { e: 1.3, ts: 12 }); K.tor(x, y + 0.3, z, r * 0.95, 0.3, P.bo, 'bone', { ts: 20 }); },
  dome(K, P, tc, x, z, r, y) { y = y || 0; K.sph(x, y, z, r, P.m, 'wet', { half: true, seg: 16 }); for (let i = 0; i < 3; i++) arch(K, x, y, z, r * 1.01, r * 1.01, r * 1.01, i * PI / 3, 0.1, '#FF8A8A', null, { e: 1.4, ts: 12 }); K.sph(x, y + r, z, r * 0.25, P.l, null, { e: 2.4, seg: 8 }); },
  pad(K, P, tc, x, z, w, d, y) { y = y || 0; K.sph(x, y, z, 1, '#3A1A28', 'wet', { half: true, sx: w / 2, sy: 0.5, sz: d / 2, seg: 22 }); ringOf(6, 1, (cx, cz) => K.tube([[x + cx * w * 0.3, y + 0.3, z + cz * d * 0.3], [x + cx * w * 0.5, y + 0.25, z + cz * d * 0.46 + 0.6], [x + cx * w * 0.62, y, z + cz * d * 0.6]], 0.26, P.b, 'wet', { ts: 8 })); },
  ring(K, P, tc, x, z, R, y) { K.anim({ t: 'spin', p: [x, y, z], speed: (R > 5 ? 1 : -1) * (0.25 + 1.2 / R) }, () => { ringOf(8, R, (cx, cz) => K.cone(x + cx, y - 0.4, z + cz, 0.32, 1.6, P.bo, 'bone', { seg: 8, rz: -cx / R * 0.4, rx: cz / R * 0.4 })); K.tor(x, y - 0.3, z, R, 0.18, P.l, null, { e: 1.6, ts: 24 }); }); }, // 4.2b: anel de espinhos gira devagar
  door(K, P, tc, x, z, w, h, y) { y = y || 0; K.sph(x, y, z, 1, '#140A0F', 'wet', { half: true, sx: 0.5, sy: h, sz: w / 2, seg: 12 }); for (let i = -2; i <= 2; i++) K.cone(x + 0.2, y + h * 0.9 - Math.abs(i) * h * 0.12, z + i * w * 0.18, 0.18, h * 0.32, P.bo, 'bone', { seg: 6, rz: PI }); },
  pipe(K, P, tc, pts) { K.tube(pts, 0.32, P.b, 'wet', { ts: 12 }); },
  banner(K, P, tc, x, z, h) { this.tower(K, P, tc, x, z, 0.35, h, 0); K.sph(x + 0.3, h * 0.55, z, 0.8, tc, 'wet', { sx: 0.6, sy: 1.2, seg: 10, anim: { t: 'sway', p: [x, 0, z], amp: 0.07, speed: 1.3, ph: x * 0.5 + z * 0.37 } }); }, // 4.2b: mesmo balanço da espinha (tower com y = 0)
  crown(K, P, tc, x, z, y, s) { ringOf(5, 2.4 * s, (cx, cz) => K.sph(x + cx, y + 1.4 * s, z + cz, 1.2 * s, P.bo, 'bone', { sy: 1.5, seg: 12 })); K.sph(x, y + 2.6 * s, z, 2 * s, P.m, 'wet', { sy: 1.4, seg: 16 }); K.sph(x, y + 2.8 * s, z, 0.9 * s, P.l, null, { e: 2.2, seg: 10 }); ringOf(4, 3.6 * s, (cx, cz) => this.tower(K, P, tc, x + cx, z + cz, 0.5 * s, 6 * s, y)); },
  reactor(K, P, tc) { this.pad(K, P, tc, 0, 0, 20, 18); K.sph(0, 5, 0, 4.4, P.m, 'wet', { sy: 1.15, seg: 20 }); for (let i = 0; i < 5; i++) arch(K, 0, 0.4, 0, 4.5, 10.2, 4.5, i * PI / 5, 0.2, '#FF8A8A', null, { e: 1.4, ts: 16 }); K.tor(0, 1, 0, 4.6, 0.5, P.bo, 'bone', { ts: 28 }); ringOf(5, 6.4, (cx, cz) => this.tower(K, P, tc, cx, cz, 0.55, 4.5, 0.2)); },
  pylon(K, P, tc) { this.pad(K, P, tc, 0, 0, 12, 12); this.pillar(K, P, tc, 0, 0, 1.6, 10, 0.3); K.sph(0, 12, 0, 1.8, P.bo, 'bone', { sy: 1.4, seg: 14 }); K.sph(0, 12.2, 0, 0.8, P.l, null, { e: 2.4, seg: 10 }); this.ring(K, P, tc, 0, 0, 3.2, 10.6); K.sph(1.2, 4, 0, 0.6, tc, 'wet', { seg: 8 }); },
  turret(K, P, tc, s, twin) { K.sph(0, 1.2 * s, 0, 2.2 * s, P.a, 'chitin', { sy: 0.75, seg: 14 }); for (const zz of twin ? [-1, 1] : [0]) { K.anim({ t: 'recoil', dist: 0.9 * s }, () => { K.seg([1.4 * s, 1.4 * s, zz * 1.1 * s], [6.4 * s, 1.6 * s, zz * 1.1 * s], 0.55 * s, P.b, 'wet', { taper: 0.6, seg: 10 }); K.sph(6.4 * s, 1.6 * s, zz * 1.1 * s, 0.38 * s, P.ac, null, { e: 2, seg: 8 }); }); } K.sph(-1.5 * s, 1.9 * s, 0, 1 * s, P.m, 'wet', { seg: 12 }); ringOf(4, 1.6 * s, (cx, cz) => K.cone(cx - 0.4 * s, 2 * s, cz, 0.22 * s, 1.4 * s, P.bo, 'bone', { seg: 6 })); },
  wall(K, P, tc, gate) { K.sph(0, 0, 0, 1, '#3A1A28', 'wet', { half: true, sx: 8.4, sy: 0.6, sz: 2.4, seg: 16 }); if (gate) { for (const sg of [-1, 1]) this.pillar(K, P, tc, sg * 6.4, 0, 1.3, 7.2, 0.2); arch(K, 0, 0, 0, 6.4, 7.4, 0.01, 0, 0.4, P.bo, 'bone'); K.sph(0, 7.4, 0, 0.6, P.l, null, { e: 2.2, seg: 8 }); } else { for (let i = -3; i <= 3; i++) K.sph(i * 2.2, 1.6, 0, 1.6, i % 2 ? P.a : P.b, 'chitin', { sy: 1.6, seg: 10 }); for (let i = -3; i <= 3; i++) K.cone(i * 2.2 + 0.6, 3.2, 0, 0.35, 2.8, P.bo, 'bone', { seg: 8, rz: -0.5 }); K.box(0, 2.4, 1.7, 13, 0.14, 0.1, tc, null, { e: 1.4 }); } },
};

// ---------- receitas de construção: mesma planta para todas as Raças, formas do kit da Raça ----------
const QUAD = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const BLD = {
  nucleo(K, k, P, tc, skin) { // 4.0e: três estilos de Núcleo no Hangar — 0 Padrão, 1 Fortaleza (nível 10), 2 Santuário (nível 20)
    skin = skin || 0; k.pad(K, P, tc, 0, 0, skin === 2 ? 32 : 30, skin === 2 ? 32 : 30); k.block(K, P, tc, 0, 0, 22, 22, skin === 1 ? 8.5 : 7, 0.6); const top = skin === 1 ? 9.3 : 7.8; k.block(K, P, tc, 0, 0, 13, 13, skin === 1 ? 6.5 : 5.5, top);
    k.crown(K, P, tc, 0, 0, top + (skin === 1 ? 6.5 : 5.8), skin === 2 ? 1.35 : 1);
    for (const [sx, sz] of QUAD) k.tower(K, P, tc, sx * 12.2, sz * 12.2, skin === 1 ? 1.9 : 1.3, skin === 1 ? 12 : 8, 0.6);
    if (skin === 1) for (const [sx, sz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) k.tower(K, P, tc, sx * 12.6, sz * 12.6, 1.1, 7, 0.6);
    k.door(K, P, tc, 11.4, 0, 5, 4.2, 0.6); k.ring(K, P, tc, 0, 0, 9.4, top + 0.5);
    if (skin === 2) { k.ring(K, P, tc, 0, 0, 13.6, 1.1); K.tor(0, 0.75, 0, 15.2, 0.22, tc, null, { e: 1.8, ts: 48 }); } },
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
  infantaria(K, P, tc, o) { o = o || {}; const V = U.vehnar, ra = o.noRifle ? null : { t: 'recoil', dist: 0.3 }; /* 4.3e: Infantaria Orbital — ciborgue de gravidade alta (corpo V._soldado): capacete-balde com visor aceso e respirador, mochila-fornalha com chaminés gêmeas em brasa, fuzil industrial de tambor no quadril direito (recua no tiro, com a mão) e braço esquerdo livre que balança na passada */
    V._soldado(K, P, tc, { cD: [-0.34, 4.4, 1.56], mD: [0.46, 4.08, 1.42], cE: [-0.12, 4.2, -1.58], mE: [0.16, 3.22, -1.5], solto: true, ra, st: 21 });
    V._capacete(K, P, tc); V._mochila(K, P, tc); if (!o.noRifle) K.anim(ra, () => V._fuzil(K, P, tc)); },
  coletor(K, P, tc) { // 4.3a: carregador de minério pesado — rodas-tambor duplas, chassi chanfrado, motor com chaminés em brasa, caçamba com minério, cabine blindada e cabeça de mineração com emissores gêmeos
    const FO = '#FF7A2E', PK = '#FF5FD2', RED = '#FF4040', ORE = '#3A3F48', CRY = '#3FA9E0', AY = 1.52, ZW = 2.68, AX = [-3.9, 2.45];
    // caixa chanfrada barata: perfil octogonal (cantos cortados em b) extrudado com chanfro nas pontas; base em y, centro em x/z
    const cb = (x, y, z, w, h, d, b, col, mat, o) => { const c = b * 0.6, hw = w / 2 - c, hh = h / 2 - c; K.poly([[-hw + b, -hh], [hw - b, -hh], [hw, -hh + b], [hw, hh - b], [hw - b, hh], [-hw + b, hh], [-hw, hh - b], [-hw, -hh + b]], d - 2 * c, col, mat, Object.assign({ x, y: y + h / 2, z, b: c }, o)); };
    // faixa de perigo: listras amarelas e pretas inclinadas; dir = 'tx' (tampo, ao longo de x), 'tz' (tampo, ao longo de z), 'fz' (face ±x), 'sx' (face ±z)
    const haz = (x, y, z, len, wid, n, dir) => { const o = { tx: { rx: -H }, tz: { rx: -H, ry: H }, fz: { ry: -H }, sx: {} }[dir]; const q = len / (2 * n), sk = Math.min(wid * 0.7, q);
      for (let i = 0; i < 2 * n; i++) { const u = -len / 2 - sk / 2 + i * q; K.poly([[u, -wid / 2], [u + q, -wid / 2], [u + q + sk, wid / 2], [u + sk, wid / 2]], 0.05, i % 2 ? P.d : P.h, 'paint', Object.assign({ x, y, z, pat: 0 }, o)); } };
    // roda-tambor: dois pneus com garras desencontradas, cinta da cor do time no meio, cubo com parafusos e trava amarela (o giro aparece)
    const drum = (x, s) => { const z = s * ZW; K.anim({ t: 'wheel', p: [x, AY, z], r: AY }, () => {
      for (const k of [-1, 1]) { const zt = z + k * 0.4; K.cyl(x, AY, zt - 0.3, 1.4, 1.4, 0.6, P.d, 'rubber', { rx: H, seg: 14 });
        for (let i = 0; i < 6; i++) { const a = (i + (k > 0 ? 0.5 : 0)) / 6 * PI * 2; K.box(x + Math.cos(a) * 1.33, AY + Math.sin(a) * 1.33, zt, 0.56, 0.19, 0.62, P.d, 'rubber', { rz: a - H }); } }
      K.cyl(x, AY, z - 0.12, 1.12, 1.12, 0.24, tc, 'paint', { rx: H, seg: 14 });
      const zo = z + s * 0.7; K.cyl(x, AY, zo, 0.98, 0.98, 0.1, P.b, 'metal', { rx: s * H, seg: 14 }); K.cyl(x, AY, zo + s * 0.1, 0.42, 0.62, 0.17, P.t, 'metal', { rx: s * H, seg: 10 });
      for (let i = 0; i < 5; i++) { const a = i / 5 * PI * 2; K.box(x + Math.cos(a) * 0.8, AY + Math.sin(a) * 0.8 - 0.06, zo + s * 0.12, 0.14, 0.12, 0.08, P.d, 'metal'); }
      K.box(x, AY - 0.08, zo + s * 0.28, 0.56, 0.16, 0.05, P.h, 'paint'); }); };
    for (const x of AX) for (const s of [-1, 1]) drum(x, s);
    // chassi: longarinas escuras, eixos
    cb(-0.85, 0.85, 0, 10.2, 1.0, 3.3, 0.25, P.d, 'dark'); for (const x of AX) K.box(x, 1.12, 0, 0.9, 0.8, 4.3, P.b, 'metal');
    // motor (traseira): bloco chanfrado, ventoinha que gira no tampo, venezianas com brasa, chaminés, corrimão, grade, lanternas, para-choque com faixa
    cb(-4.4, 1.85, 0, 2.8, 2.0, 3.7, 0.3, P.a, 'steel'); K.box(-4.5, 3.8, 0, 2.1, 0.1, 2.9, P.b, 'steel');
    K.cyl(-4.75, 3.86, 0, 0.92, 0.92, 0.1, P.d, 'dark', { seg: 16 }); K.tor(-4.75, 3.98, 0, 0.92, 0.07, P.b, 'metal', { ts: 12, rs: 3 });
    K.anim({ t: 'spin', p: [-4.75, 3.93, 0], speed: 7 }, () => { for (let i = 0; i < 3; i++) K.box(-4.75, 3.92, 0, 1.7, 0.04, 0.32, P.t, 'metal', { ry: i / 3 * PI + 0.3 }); });
    K.box(-4.75, 4.0, 0, 0.08, 0.05, 1.84, P.d, 'dark'); K.box(-4.75, 4.0, 0, 1.84, 0.05, 0.08, P.d, 'dark'); for (const z of [-1.3, -1.08, 1.08, 1.3]) K.box(-4.85, 3.88, z, 1.5, 0.04, 0.12, FO, null, { e: 1.8 });
    for (const s of [-1, 1]) { K.box(-4.55, 2.25, s * 1.86, 1.8, 1.0, 0.06, FO, null, { e: 1.3 }); for (let i = 0; i < 4; i++) K.box(-4.55, 2.31 + i * 0.24, s * 1.9, 1.9, 0.1, 0.12, P.d, 'dark', { rx: s * 0.5 });
      const ex = -3.55, ez = s * 1.35; K.cyl(ex, 3.85, ez, 0.3, 0.34, 1.75, P.r, 'metal', { seg: 10 }); K.cyl(ex, 4.3, ez, 0.39, 0.39, 0.75, P.b, 'metal', { seg: 10 }); K.cyl(ex, 5.6, ez, 0.36, 0.3, 0.2, P.d, 'dark', { seg: 10 }); K.cyl(ex, 5.64, ez, 0.24, 0.24, 0.18, FO, null, { e: 2.4, seg: 8 });
      K.seg([-5.55, 3.85, s * 1.6], [-5.55, 4.45, s * 1.6], 0.05, P.h, 'paint'); K.seg([-5.55, 4.45, s * 1.6], [-4.1, 4.45, s * 1.6], 0.05, P.h, 'paint'); K.seg([-4.1, 3.85, s * 1.6], [-4.1, 4.45, s * 1.6], 0.05, P.h, 'paint');
      K.light(-5.85, 3.25, s * 1.45, 0.3, RED); K.light(-5.85, 2.8, s * 1.45, 0.24, '#FFA03A'); }
    K.seg([-5.55, 4.45, -1.6], [-5.55, 4.45, 1.6], 0.05, P.h, 'paint');
    K.box(-5.78, 2.05, 0, 0.12, 1.5, 2.5, P.d, 'dark'); K.box(-5.86, 2.12, 0, 0.02, 1.36, 2.3, FO, null, { e: 1.1 }); for (let i = 0; i < 5; i++) K.box(-5.92, 2.15 + i * 0.28, 0, 0.08, 0.13, 2.4, P.b, 'metal');
    cb(-5.75, 0.75, 0, 0.55, 0.7, 4.0, 0.12, P.d, 'dark'); haz(-6.05, 1.1, 0, 3.6, 0.5, 5, 'fz');
    // caçamba: berço, corpo da cor do time com nervuras e faixa de aço, aro grosso, pilares claros nos cantos, minério com cristais
    cb(-0.9, 1.85, 0, 4.0, 1.1, 3.4, 0.15, P.b, 'steel'); K.poly([[-2.55, 3.1], [0.75, 3.1], [1.2, 4.8], [-3.0, 4.8]], 4.2, tc, 'paint', { b: 0.15 });
    for (const s of [-1, 1]) { for (const x of [-2.0, -0.9, 0.2]) K.box(x, 3.0, s * 2.27, 0.22, 1.85, 0.14, P.a, 'steel');
      K.box(-0.9, 3.0, s * 2.28, 3.45, 0.3, 0.12, P.b, 'steel'); K.box(-0.9, 4.85, s * 2.08, 4.0, 0.3, 0.42, tc, 'paint');
      K.box(-0.35, 3.85, s * 2.28, 0.8, 0.5, 0.06, P.t, 'paint'); for (const y of [3.95, 4.15]) K.box(-0.35, y, s * 2.31, 0.6, 0.1, 0.04, P.d, 'dark'); }
    for (const [x, y] of [[-2.9, 3.55], [-3.06, 4.25]]) K.box(x, y, 0, 0.14, 0.18, 3.74, P.a, 'steel');
    K.box(1.1, 4.85, 0, 0.42, 0.3, 4.58, tc, 'paint'); K.box(-2.9, 4.85, 0, 0.42, 0.3, 4.58, tc, 'paint');
    for (const [sx, sz] of QUAD) cb(sx > 0 ? 1.17 : -2.97, 2.8, sz * 2.12, 0.5, 2.35, 0.5, 0.1, P.t, 'steel', { rz: -sx * 0.22 });
    K.box(-0.9, 4.86, 0, 3.6, 0.12, 3.75, '#2E3138', 'stone'); K.sph(-0.9, 4.95, 0, 1, ORE, 'stone', { half: true, sx: 1.7, sy: 0.45, sz: 1.55, seg: 12 });
    for (const [x, z, r, sd] of [[-2.1, -1.1, 0.55, 1], [-1.5, 0.9, 0.6, 2], [-0.4, -0.2, 0.7, 3], [0.4, 1.1, 0.5, 4], [0.3, -1.2, 0.55, 5], [-2.3, 0.4, 0.45, 6], [-1.0, -1.3, 0.45, 7]]) K.rock(x, 5.1, z, r, sd % 2 ? ORE : '#454B55', 'stone', { seed: sd, detail: 0, sy: 0.7 });
    for (const [x, z, h, a] of [[-1.3, 0.1, 0.9, 0.3], [0.0, 0.5, 0.75, -0.4], [-2.2, -0.4, 0.6, 0.5], [0.6, -0.5, 0.55, -0.2]]) K.prism(x, 5.0, z, 0.22, h, 6, CRY, 'crystal', { top: 0.15, rz: a, rx: a * 0.6 });
    // laterais entre as rodas: tanque de combustível com cintas (esquerda), caixa de ferramentas com faixa (direita)
    K.cyl(-2.2, 2.05, -2.55, 0.52, 0.52, 2.9, P.t, 'metal', { rz: -H, seg: 12 }); for (const x of [-1.5, -0.1]) K.cyl(x, 2.05, -2.55, 0.55, 0.55, 0.1, P.d, 'dark', { rz: -H, seg: 12 }); K.cyl(-0.8, 2.52, -2.55, 0.12, 0.12, 0.12, P.h, 'paint', { seg: 8 });
    cb(-0.75, 1.35, 2.5, 2.9, 1.25, 1.0, 0.1, P.a, 'steel'); haz(-0.75, 1.75, 3.01, 2.6, 0.35, 5, 'sx'); for (let i = 0; i < 3; i++) K.box(-1.6 + i * 0.25, 2.12, 3.02, 0.1, 0.3, 0.04, P.d, 'dark');
    // cabine: base escura, cabine clara com para-brisa inclinado e grade, janelas, teto com painel elevado da cor do time, barra de luzes, giroflex, antena, pré-filtro de ar, retrovisores, degrau e pega-mão
    cb(2.65, 1.85, 0, 2.6, 1.15, 3.3, 0.2, P.b, 'steel');
    K.poly([[1.4, 2.95], [3.95, 2.95], [3.45, 4.55], [1.45, 4.55]], 3.0, P.t, 'steel', { b: 0.12 });
    K.poly([[4.07, 3.08], [3.65, 4.42], [3.53, 4.42], [3.95, 3.08]], 2.7, P.g, 'glass', { pat: 0 }); K.poly([[1.8, 3.2], [3.6, 3.2], [3.31, 4.15], [1.8, 4.15]], 3.3, P.g, 'glass', { pat: 0 });
    for (const z of [-0.9, 0, 0.9]) K.seg([4.12, 3.0, z], [3.66, 4.5, z], 0.045, P.d, 'metal');
    K.box(2.35, 4.6, 0, 1.85, 0.08, 2.9, P.d, 'dark'); K.box(2.3, 4.66, 0, 1.6, 0.1, 2.6, tc, 'paint'); K.box(3.25, 4.6, 0, 0.3, 0.2, 2.7, P.d, 'dark'); for (const z of [-1.0, -0.35, 0.35, 1.0]) K.light(3.38, 4.62, z, 0.17, P.l, 2.4);
    K.cyl(1.75, 4.74, -1.0, 0.16, 0.2, 0.12, P.d, 'dark', { seg: 8 }); K.sph(1.75, 4.86, -1.0, 0.17, '#FFA03A', null, { e: 2.2, seg: 8 }); K.seg([1.65, 4.74, 1.05], [1.55, 5.8, 1.1], 0.03, P.d, 'metal');
    K.cyl(1.9, 3.6, 1.72, 0.17, 0.17, 1.35, P.b, 'metal', { seg: 8 }); K.cyl(1.9, 4.95, 1.72, 0.26, 0.24, 0.24, P.d, 'dark', { seg: 8 });
    for (const s of [-1, 1]) { K.seg([3.4, 4.0, s * 1.62], [3.65, 4.1, s * 2.05], 0.04, P.d, 'metal'); K.box(3.65, 3.75, s * 2.08, 0.12, 0.45, 0.25, P.d, 'dark');
      K.box(2.6, 1.45, s * 1.78, 0.9, 0.1, 0.4, P.d, 'dark'); K.seg([1.6, 2.2, s * 1.72], [1.6, 3.9, s * 1.72], 0.04, P.h, 'paint'); }
    // cabeça de mineração: suporte, carcaça com boca dentada e grade da cor do time no tampo, faixa de perigo, bochechas claras que protegem dois emissores aletados com lente acesa e anel de foco entre eles
    cb(4.2, 0.75, 0, 1.0, 1.25, 2.4, 0.12, P.d, 'dark'); cb(4.8, 0.7, 0, 1.3, 1.95, 3.0, 0.18, P.a, 'steel');
    K.box(4.68, 2.63, 0, 0.62, 0.05, 1.5, P.d, 'dark'); for (const z of [-0.54, -0.18, 0.18, 0.54]) K.box(4.68, 2.64, z, 0.72, 0.13, 0.13, tc, 'paint'); haz(5.13, 2.66, 0, 2.6, 0.24, 4, 'tz');
    K.box(5.5, 0.42, 0, 0.42, 0.3, 3.2, P.d, 'metal'); haz(5.72, 0.57, 0, 3.0, 0.24, 6, 'fz'); K.box(5.43, 0.85, 0, 0.1, 0.6, 1.4, P.d, 'dark'); for (let i = 0; i < 5; i++) K.cone(5.44, 0.95 + (i % 2) * 0.25, -0.56 + i * 0.28, 0.1, 0.25, P.t, 'metal', { seg: 4, rz: -H });
    for (const s of [-1, 1]) { const ez = s * 0.95, ey = 1.85;
      K.poly([[4.2, 0.8], [5.8, 0.8], [6.25, 1.25], [6.25, 2.2], [5.75, 2.65], [4.2, 2.65]], 0.22, P.t, 'steel', { z: s * 1.62, b: 0.04 }); haz(5.0, 2.7, s * 1.62, 1.4, 0.2, 3, 'tx');
      K.light(5.6, 1.95, s * 1.82, 0.24, P.l); K.light(6.2, 1.5, s * 1.62, 0.22, P.l);
      K.box(4.05, 1.05, s * 1.5, 0.34, 0.42, 0.75, P.d, 'dark'); K.seg([4.05, 1.3, s * 1.88], [4.85, 2.05, s * 1.88], 0.12, P.h, 'paint'); K.seg([4.85, 2.05, s * 1.88], [5.3, 2.47, s * 1.88], 0.055, P.t, 'metal'); for (const [bx, by] of [[4.45, 2.4], [5.65, 1.05], [4.45, 0.95]]) K.box(bx, by, s * 1.79, 0.1, 0.1, 0.05, P.d, 'metal');
      K.cyl(5.4, ey, ez, 0.5, 0.5, 0.22, P.d, 'dark', { rz: -H, seg: 12 }); K.cyl(5.6, ey, ez, 0.34, 0.38, 0.55, P.b, 'metal', { rz: -H, seg: 12 });
      for (const fx of [5.7, 6.0]) K.cyl(fx, ey, ez, 0.48, 0.48, 0.07, P.t, 'metal', { rz: -H, seg: 10 }); K.cyl(5.82, ey, ez, 0.44, 0.44, 0.12, PK, null, { e: 1.7, rz: -H, seg: 10 });
      K.cyl(6.12, ey, ez, 0.4, 0.33, 0.16, P.d, 'dark', { rz: -H, seg: 12 }); K.cyl(6.24, ey, ez, 0.26, 0.26, 0.06, PK, null, { e: 2.6, rz: -H, seg: 10 });
      K.seg([6.05, ey, s * 0.6], [6.05, ey, s * 0.28], 0.06, P.d, 'metal'); }
    K.anim({ t: 'spin', p: [6.08, 1.85, 0], speed: 3, axis: 'x' }, () => { K.tor(6.08, 1.85, 0, 0.26, 0.06, P.t, 'metal', { rz: H, ts: 12, rs: 4 }); for (let i = 0; i < 3; i++) { const a = i / 3 * PI * 2; K.box(6.06, 1.85 + Math.sin(a) * 0.3 - 0.05, Math.cos(a) * 0.3, 0.1, 0.1, 0.1, P.h, 'paint'); } }); K.sph(6.1, 1.85, 0, 0.13, '#FFC4F2', null, { e: 3, seg: 6 }); K.beam = [6.25, 1.85, 0];
  },
  /* ---------- 4.3d: frota Vehnar no nível do coletor 4.3a. Ajudantes internos da Raça (nome com _; chamados como U.vehnar._nome) ---------- */
  _cb(K, x, y, z, w, h, d, b, col, mat, o) { /* 4.3d: caixa chanfrada (perfil octogonal extrudado em z, como no coletor); base em y, centro em x/z, gira pelo centro; na versão leve vira caixa reta (12 triângulos) */
    if (K.lite) return K.poly([[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]], d, col, mat, Object.assign({ x, y: y + h / 2, z }, o));
    const c = b * 0.6, hw = w / 2 - c, hh = h / 2 - c; return K.poly([[-hw + b, -hh], [hw - b, -hh], [hw, -hh + b], [hw, hh - b], [hw - b, hh], [-hw + b, hh], [-hw, hh - b], [-hw, -hh + b]], Math.max(0.02, d - 2 * c), col, mat, Object.assign({ x, y: y + h / 2, z, b: c }, o)); },
  _viga(K, a, b, t, d, bv, col, mat, o) { const dx = b[0] - a[0], dy = b[1] - a[1]; /* 4.3d: viga chanfrada de a até b no plano z = a[2] (t = espessura no plano, d = profundidade em z) */
    return U.vehnar._cb(K, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - t / 2, a[2], Math.hypot(dx, dy), t, d, bv, col, mat, Object.assign({ rz: Math.atan2(dy, dx) }, o)); },
  _haz(K, P, x, y, z, len, wid, n, dir, ex) { const o = Object.assign({ tx: { rx: -H }, tz: { rx: -H, ry: H }, fz: { ry: -H }, sx: {} }[dir], ex); /* 4.3d: faixa de perigo amarela e preta (dir como no coletor); de longe, uma faixa amarela só */
    if (K.lite) return K.poly([[-len / 2, -wid / 2], [len / 2, -wid / 2], [len / 2, wid / 2], [-len / 2, wid / 2]], 0.05, P.h, 'paint', Object.assign({ x, y, z, pat: 0 }, o));
    const q = len / (2 * n), sk = Math.min(wid * 0.7, q); for (let i = 0; i < 2 * n; i++) { const u = -len / 2 - sk / 2 + i * q; K.poly([[u, -wid / 2], [u + q, -wid / 2], [u + q + sk, wid / 2], [u + sk, wid / 2]], 0.05, i % 2 ? P.d : P.h, 'paint', Object.assign({ x, y, z, pat: 0 }, o)); } },
  _pistao(K, P, a, b, r, o) { o = o || {}; const k = o.k || 0.55, m = [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]; /* 4.3d: pistão hidráulico — camisa de aço e haste cromada; colar e olhais só de perto */
    K.seg(a, m, r, o.col || P.b, 'metal', { seg: o.seg || 10 }); K.seg(m, b, r * 0.5, P.t, 'gloss', { seg: 8 });
    K.fine(() => { const e = [m[0] + (b[0] - a[0]) * 0.05, m[1] + (b[1] - a[1]) * 0.05, m[2] + (b[2] - a[2]) * 0.05]; K.seg(m, e, r * 1.14, P.d, 'dark', { seg: 8 }); for (const p of [a, b]) K.box(p[0], p[1] - r * 0.7, p[2], r * 1.5, r * 1.4, r * 1.5, P.d, 'metal'); }); },
  _escape(K, P, x, y, z, h, r) { /* 4.3d: escapamento da Raça — cano enferrujado, cinta de aço, boca escura e brasa da fornalha (como no coletor) */
    K.cyl(x, y, z, r, r * 1.08, h, P.r, 'metal', { seg: 10 }); K.cyl(x, y + h * 0.42, z, r * 1.3, r * 1.3, h * 0.3, P.b, 'metal', { seg: 10 });
    K.cyl(x, y + h, z, r * 1.24, r * 1.02, r * 0.55, P.d, 'dark', { seg: 10 }); K.cyl(x, y + h + r * 0.12, z, r * 0.84, r * 0.84, r * 0.5, '#FF7A2E', null, { e: 2.4, seg: 8 });
    K.fine(() => { K.box(x, y + h * 0.18, z, r * 2.7, r * 0.5, r * 0.6, P.d, 'dark'); K.cyl(x, y + h * 0.37, z, r * 1.38, r * 1.38, h * 0.05, P.d, 'dark', { seg: 10 }); }); },
  _roda(K, P, tc, x, y, z, r, w, s, o) { o = o || {}; const nl = K.q(o.lugs || 10), rt = r * 0.88, zo = z + s * w / 2; /* 4.3d: roda da família do coletor — pneu com garras em espinha de peixe, faixa da cor do time, aro de aço, cubo claro com trava amarela (o giro aparece); y = raio; s = lado de fora */
    K.anim({ t: 'wheel', p: [x, y, z], r }, () => {
      K.cyl(x, y, z - w / 2, rt, rt, w, P.d, 'rubber', { rx: H, seg: 12 });
      for (let i = 0; i < nl; i++) { const a = (i + 0.25) / nl * PI * 2; K.box(x + Math.cos(a) * (rt - 0.05), y + Math.sin(a) * (rt - 0.05), z, r * 0.3, r - rt + 0.05, w * (K.lite ? 0.96 : 0.84), P.d, 'rubber', { rz: a - H, ry: K.lite ? 0 : (i % 2 ? 0.32 : -0.32), order: 'ZXY' }); }
      if (!K.lite) { K.cyl(x, y, zo - s * 0.04, r * 0.7, r * 0.7, 0.1, tc, 'paint', { rx: s * H, seg: 12 }); K.cyl(x, y, zo, r * 0.5, r * 0.54, 0.1, P.b, 'metal', { rx: s * H, seg: 10 }); }
      K.cyl(x, y, zo + s * 0.06, r * 0.24, r * 0.34, 0.16, P.t, 'metal', { rx: s * H, seg: 8 }); K.box(x, y - r * 0.07, zo + s * 0.24, r * 0.66, r * 0.14, 0.05, P.h, 'paint');
      K.fine(() => { for (let i = 0; i < 4; i++) { const a = i / 4 * PI * 2 + 0.3; K.box(x + Math.cos(a) * r * 0.42, y + Math.sin(a) * r * 0.42 - 0.04, zo + s * 0.12, 0.09, 0.08, 0.06, P.d, 'metal'); } });
    }); },
  _cabine(K, P, tc, xb, xf, y0, y1, wz, o) { o = o || {}; const z0 = o.z || 0, h = y1 - y0, sl = h * 0.3, bv = 0.12, xF = y => xf + bv - sl * (y - y0) / h, ya = y0 + h * 0.16, yb = y1 - h * 0.08; /* 4.3d: cabine clara da família do coletor — para-brisa inclinado, janelas, teto da cor do time, barra de luzes; o.visor = venezianas blindadas, o.ambar = giroflex */
    K.poly([[xb, y0], [xf, y0], [xf - sl, y1], [xb, y1]], wz - 2 * bv, P.t, 'steel', { b: bv, z: z0 });
    K.poly([[xF(ya) + 0.03, ya], [xF(yb) + 0.03, yb], [xF(yb) - 0.09, yb], [xF(ya) - 0.09, ya]], wz - 0.62, P.g, 'glass', { pat: 0, z: z0 });
    const ys = y0 + h * 0.3, xs = xb + (xf - xb) * 0.2; K.poly([[xs, ys], [xF(ys) - 0.4, ys], [xF(yb) - 0.4, yb - 0.04], [xs, yb - 0.04]], wz + 0.06, P.g, 'glass', { pat: 0, z: z0 });
    if (o.visor) for (let i = 0; i < 3; i++) { const yy = ya + (yb - ya) * (i + 0.5) / 3; K.box(xF(yy) + 0.06, yy - 0.06, z0, 0.12, 0.12, wz - 0.42, P.d, 'dark'); }
    else K.fine(() => { for (const k of [-0.28, 0, 0.28]) K.seg([xF(ya) + 0.06, ya - 0.04, z0 + k * wz], [xF(yb) + 0.06, yb + 0.04, z0 + k * wz], 0.04, P.d, 'metal', { seg: 5 }); });
    const xr = (xb + xf - sl) / 2, lr = xf - sl - xb; K.box(xr, y1 + bv - 0.04, z0, lr * 0.92, 0.08, wz * 0.9, P.d, 'dark'); K.box(xr - 0.05, y1 + bv + 0.02, z0, lr * 0.76, 0.1, wz * 0.78, tc, 'paint');
    if (o.luz !== false) { const xl = xf - sl - 0.12; K.box(xl, y1 + bv - 0.02, z0, 0.3, 0.2, wz * 0.84, P.d, 'dark'); for (const k of (K.lite ? [-0.24, 0.24] : [-0.36, -0.12, 0.12, 0.36])) K.light(xl + 0.12, y1 + bv + 0.03, z0 + k * wz, 0.17, P.l, 2.4); }
    if (o.ambar) for (const s of [-1, 1]) { K.cyl(xb + 0.32, y1 + bv + 0.02, z0 + s * wz * 0.36, 0.17, 0.2, 0.12, P.d, 'dark', { seg: 8 }); K.sph(xb + 0.32, y1 + bv + 0.2, z0 + s * wz * 0.36, 0.19, '#FFA03A', null, { e: 2.2, seg: 8 }); }
    K.fine(() => { for (const s of [-1, 1]) { const zw = z0 + s * wz / 2; K.seg([xF(y0 + h * 0.55) - 0.1, y0 + h * 0.55, zw], [xF(y0 + h * 0.55) + 0.1, y0 + h * 0.62, zw + s * 0.38], 0.035, P.d, 'metal', { seg: 5 }); K.box(xF(y0 + h * 0.55) + 0.12, y0 + h * 0.42, zw + s * 0.42, 0.1, 0.4, 0.24, P.d, 'dark'); K.seg([xb + 0.18, y0 + 0.25, zw + s * 0.05], [xb + 0.18, y1 - 0.25, zw + s * 0.05], 0.035, P.h, 'paint', { seg: 5 }); }
      K.seg([xb + 0.3, y1 + bv, z0 - wz * 0.38], [xb + 0.2, y1 + bv + 1.0, z0 - wz * 0.38], 0.025, P.d, 'metal', { seg: 5 }); }); },
  _lagarta(K, P, tc, z, s, o) { const L = o.L, Ht = o.Ht, w = o.w, R = o.R, xa = L / 2 - R, cy = Ht - R, xb = o.xb, rw = o.rw, nA = K.lite ? 3 : 6, zo = z + s * w / 2; /* 4.3d: lagarta larga — banda de borracha (sulcos do padrão), rodas de apoio, roda motriz dentada atrás e roda-guia na frente (giram), sapatas do ramo de cima que rolam (tread) */
    const pts = [[-xb, 0], [xb, 0]]; for (let i = 0; i <= nA; i++) { const a = -0.9 + (PI / 2 + 0.9) * i / nA; pts.push([xa + Math.cos(a) * R, cy + Math.sin(a) * R]); } for (let i = 0; i <= nA; i++) { const a = PI / 2 + (PI / 2 + 0.9) * i / nA; pts.push([-xa + Math.cos(a) * R, cy + Math.sin(a) * R]); }
    K.poly(pts, w - 0.16, P.d, 'rubber', { z, b: 0.08 });
    const nr = K.q(6), x0 = -xb + 0.35, x1 = xb - 0.35, wy = rw + 0.24;
    for (let i = 0; i < nr; i++) { const x = x0 + (x1 - x0) * i / (nr - 1); K.anim({ t: 'wheel', p: [x, wy, z], r: rw }, () => {
      K.cyl(x, wy, zo - s * 0.22, rw, rw, 0.32, '#202329', 'rubber', { rx: s * H, seg: 11 }); K.cyl(x, wy, zo + s * 0.08, rw * 0.74, rw * 0.8, 0.1, P.b, 'metal', { rx: s * H, seg: 9 });
      K.fine(() => { K.cyl(x, wy, zo + s * 0.16, rw * 0.2, rw * 0.3, 0.12, P.t, 'metal', { rx: s * H, seg: 6 }); K.box(x, wy - 0.06, zo + s * 0.2, rw * 1.2, 0.12, 0.04, P.d, 'dark'); }); }); }
    K.anim({ t: 'wheel', p: [-xa, cy, z], r: R }, () => { const sr = R - 0.24, nt = K.q(10);
      K.cyl(-xa, cy, zo - s * 0.2, sr, sr, 0.32, P.b, 'metal', { rx: s * H, seg: 12 });
      for (let i = 0; i < nt; i++) { const a = i / nt * PI * 2; K.box(-xa + Math.cos(a) * (sr - 0.04), cy + Math.sin(a) * (sr - 0.04), zo - s * 0.04, 0.26, 0.3, 0.26, P.d, 'metal', { rz: a - H }); }
      K.cyl(-xa, cy, zo + s * 0.1, sr * 0.42, sr * 0.55, 0.16, P.t, 'metal', { rx: s * H, seg: 8 }); });
    K.anim({ t: 'wheel', p: [xa, cy, z], r: R }, () => { const ir = R - 0.26;
      K.cyl(xa, cy, zo - s * 0.2, ir, ir, 0.32, P.b, 'metal', { rx: s * H, seg: 12 }); K.cyl(xa, cy, zo + s * 0.1, ir * 0.4, ir * 0.5, 0.14, P.t, 'metal', { rx: s * H, seg: 8 });
      for (const a of [0.4, 0.4 + PI]) K.box(xa + Math.cos(a) * ir * 0.66, cy + Math.sin(a) * ir * 0.66 - 0.1, zo + s * 0.1, 0.2, 0.2, 0.06, P.d, 'dark'); });
    const ng = K.q(Math.round(2 * xa / 0.75)), sp = 2 * xa / ng;
    K.anim({ t: 'tread', spacing: sp }, () => { for (let i = 0; i < ng; i++) K.box(-xa + (i + 0.5) * sp, Ht - 0.06, z, 0.3, 0.15, w + 0.04, P.b, 'metal'); }); },
  /* ---------- 4.3e: infantaria Vehnar (a receita é um soldado; o jogo desenha esquadrões de três a 62%). Frente +x, lado direito +z, origem no chão entre os pés ---------- */
  _cbl(K, x, y, z, w, h, d, b, col, mat, o) { /* 4.3e: caixa chanfrada enxuta — o mesmo perfil octogonal do V._cb extrudado em z, sem o chanfro das pontas (28 triângulos em vez de 60); na versão leve, caixa reta */
    if (K.lite) return K.poly([[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]], d, col, mat, Object.assign({ x, y: y + h / 2, z }, o));
    const hw = w / 2, hh = h / 2; return K.poly([[-hw + b, -hh], [hw - b, -hh], [hw, -hh + b], [hw, hh - b], [hw - b, hh], [-hw + b, hh], [-hw, hh - b], [-hw, -hh + b]], d, col, mat, Object.assign({ x, y: y + hh, z }, o)); },
  _placa(K, a, b, t, d, bv, col, mat, o) { const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], L = Math.hypot(dx, dy, dz) || 0.001; /* 4.3e: viga chanfrada de a até b em qualquer direção (t = espessura, d = largura; perfil enxuto do V._cbl); o V._viga fica no plano z */
    return U.vehnar._cbl(K, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - t / 2, (a[2] + b[2]) / 2, L, t, d, bv, col, mat, Object.assign({ rz: Math.asin(dy / L), ry: Math.atan2(-dz, dx) }, o)); },
  _soldado(K, P, tc, o) { const V = U.vehnar, st = o.st || 19; /* 4.3e: corpo do soldado — pernas curtas e grossas (coxa de aço, joelheira clara, canela, bota larga com biqueira) que balançam do quadril com os lados alternados, pistão na panturrilha e fivelas de perto; quadril escuro com cinto e faldas; tronco-barril chanfrado com peitoral claro e grade; gola de aço; ombreiras grandes da cor do time sobre placa de aço (rebites de perto); braços blindados até as mãos. o.cD/o.mD = cotovelo e mão direitos, o.cE/o.mE = esquerdos; o.solto = braço esquerdo livre (balança na passada, fase oposta à da perna esquerda); o.ra = animação das mãos na arma (recuo); o.st = passada */
    for (const s of [-1, 1]) { const z = s * 0.7, kn = [0.3, 1.75, s * 0.78], an = [0.04, 0.58, s * 0.82];
      K.anim(legSpec([0, 3.05, z], { amp: 0.46, stride: st }), () => {
        V._placa(K, [-0.02, 3.3, z], [kn[0], kn[1] - 0.12, kn[2]], 0.98, 0.9, 0.2, P.a, 'steel'); if (!K.lite) K.cyl(kn[0], kn[1], kn[2] - 0.4, 0.36, 0.36, 0.8, P.d, 'dark', { rx: H, seg: 6 });
        V._placa(K, [kn[0], kn[1] + 0.1, kn[2]], an, 0.86, 0.84, 0.18, P.b, 'steel'); V._cbl(K, kn[0] + 0.36, kn[1] - 0.52, kn[2], 0.4, 1.0, 0.84, 0.14, P.t, 'steel', { rz: 0.2 });
        V._cbl(K, 0.2, 0.04, an[2], 1.6, 0.6, 1.0, 0.2, P.d, 'dark'); V._cbl(K, 0.72, 0.1, an[2], 0.6, 0.44, 1.06, 0.14, P.b, 'steel'); K.box(0.2, 0, an[2], 1.66, 0.12, 1.06, '#1B1D21', 'rubber');
        K.fine(() => { K.seg([-0.3, 1.62, an[2]], [-0.52, 0.74, an[2]], 0.08, P.t, 'gloss', { seg: 6 }); K.seg([-0.28, 1.74, an[2]], [-0.4, 1.2, an[2]], 0.14, P.b, 'metal', { seg: 6 }); for (const y of [0.22, 0.42]) K.box(0.0, y, an[2], 0.14, 0.08, 1.1, P.h, 'paint'); }); }); }
    V._cbl(K, -0.06, 2.72, 0, 1.45, 0.86, 1.86, 0.22, P.d, 'dark'); K.box(0, 3.2, 0, 1.74, 0.32, 2.02, '#3B342C', 'rubber');
    if (!K.lite) for (const s of [-1, 1]) V._cbl(K, 0.04, 2.48, s * 1.22, 1.3, 0.92, 0.2, 0.18, P.a, 'steel', { rx: s * 0.2 });
    const nt = K.lite ? 6 : 8; K.prism(-0.1, 3.3, 0, 1.12, 2.45, nt, P.a, 'steel', { top: 1.2, sx: 0.8, ry: nt === 6 ? 0 : PI / 8 });
    if (o.avental) { V._cbl(K, 0.84, 3.28, 0, 0.34, 2.36, 1.74, 0.12, '#4A3A2E', 'rubber', { rz: -0.07 }); V._cbl(K, 0.66, 2.3, 0, 0.18, 1.06, 0.42, 0.06, '#4A3A2E', 'rubber'); }
    else { V._cb(K, 0.86, 4.2, 0, 0.42, 1.5, 1.86, 0.2, P.t, 'steel', { rz: -0.07 }); K.box(0.62, 3.36, 0, 0.5, 0.8, 1.3, P.d, 'dark'); }
    K.cyl(0.02, 5.72, 0, 0.66, 0.84, 0.4, P.b, 'metal', { seg: 10 });
    K.fine(() => { if (o.avental) for (const s of [-1, 1]) K.seg([1.0, 5.6, s * 0.7], [0.3, 6.0, s * 0.62], 0.05, P.h, 'paint', { seg: 4 }); else for (let i = 0; i < 3; i++) K.box(1.08, 4.62 + i * 0.22, 0, 0.06, 0.08, 1.1, P.d, 'dark', { rz: -0.07 }); for (const s of [-1, 1]) K.box(0.36, 3.08, s * 1.02, 0.42, 0.42, 0.3, '#5A4632', 'rubber'); if (!o.avental) for (let i = 0; i < 2; i++) K.box(0.9, 3.5 + i * 0.26, 0, 0.06, 0.08, 1.24, P.b, 'metal'); });
    for (const s of [-1, 1]) V._ombreira(K, P, tc, -0.1, 5.46, s * 1.5, s);
    for (const [s, el, hd] of [[1, o.cD, o.mD], [-1, o.cE, o.mE]]) { const sh = [-0.06, 5.32, s * 1.42], livre = s < 0 && o.solto;
      if (!K.lite) K.cyl(sh[0], sh[1], sh[2] - 0.38, 0.4, 0.4, 0.76, P.d, 'dark', { rx: H, seg: 6 });
      K.anim(livre ? legSpec(sh, { amp: 0.36, stride: st, ph: 0 }) : null, () => {
        V._placa(K, sh, el, 0.74, 0.74, 0.18, P.a, 'steel'); if (!K.lite) K.cyl(el[0], el[1], el[2] - 0.3, 0.34, 0.34, 0.6, P.d, 'dark', { rx: H, seg: 6 }); V._placa(K, el, hd, 0.7, 0.68, 0.16, livre ? P.t : P.b, 'steel'); /* 4.3e: antebraço da arma mais escuro (separa do tambor claro); o livre, claro, mostra o balanço */
        if (livre) { V._cbl(K, hd[0] + 0.04, hd[1] - 0.34, hd[2], 0.6, 0.6, 0.56, 0.12, P.d, 'dark'); K.box(hd[0] + 0.3, hd[1] - 0.3, hd[2], 0.14, 0.42, 0.5, P.h, 'paint'); K.fine(() => K.seg([el[0] + 0.05, el[1] - 0.2, el[2] - s * 0.38], [hd[0] - 0.05, hd[1] - 0.05, hd[2] - s * 0.34], 0.07, P.t, 'gloss', { seg: 5 })); }
        else K.anim(o.ra, () => K.box(hd[0], hd[1] - 0.22, hd[2], 0.44, 0.44, 0.42, P.d, 'dark'));
        if (s > 0) K.fine(() => K.seg([el[0] + 0.12, el[1] - 0.28, el[2] + 0.36], [hd[0] - 0.18, hd[1] - 0.1, hd[2] + 0.3], 0.07, P.t, 'gloss', { seg: 5 })); }); } },
  _ombreira(K, P, tc, x, y, z, s) { const o = { rx: s * 0.36, sx: 0.94, sz: 0.74, flat: true }; /* 4.3e: ombreira grande facetada (lê de cima): cúpula baixa torneada em oito faces (seis na leve) da cor do time, inclinada para fora, lâmina de aço por baixo e rebites de perto */
    const sg = K.lite ? 11 : 8; K.lathe([[0.92, -0.28], [0.98, 0.0]], x, y, z, P.b, 'steel', Object.assign({ seg: sg }, o)); K.lathe([[1.02, 0.0], [0.93, 0.19], [0.64, 0.34], [0, 0.4]], x, y, z, tc, 'paint', Object.assign({ seg: sg }, o));
    K.fine(() => { for (const a of [-0.75, 0.75]) { const lx = Math.cos(a) * 0.76, lz = Math.sin(a) * 0.76 * s * 0.74, c = Math.cos(o.rx), n = Math.sin(o.rx), ly = 0.25; K.box(x + lx * 0.94, y + ly * c - lz * n, z + ly * n + lz * c, 0.1, 0.08, 0.1, P.d, 'metal', { rx: o.rx }); } }); },
  _capacete(K, P, tc, solda) { const V = U.vehnar, VIS = '#FFE3A0', n = K.lite ? 6 : 8, ry = n === 6 ? 0 : PI / 8; /* 4.3e: capacete-balde octogonal grande (proporção heroica, lê de cima) com tampo da cor do time e crista de aço; o soldado tem viseira escura com fenda acesa e respirador com filtros; o soldador (solda), máscara de solda com vidro escuro e fenda acesa presa por dobradiças */
    K.prism(0.1, 5.8, 0, 0.88, 1.32, n, P.a, 'steel', { top: 0.86, ry }); K.prism(0.1, 7.12, 0, 0.76, 0.24, n, tc, 'paint', { top: 0.68, ry }); K.box(-0.04, 7.18, 0, 1.46, 0.24, 0.22, P.b, 'steel');
    if (!solda) { V._cbl(K, 0.86, 6.32, 0, 0.3, 0.46, 1.3, 0.08, P.d, 'dark'); K.box(1.01, 6.48, 0, 0.04, 0.13, 1.04, VIS, null, { e: 2.6 }); V._cbl(K, 0.78, 5.76, 0, 0.52, 0.54, 1.0, 0.12, P.b, 'steel');
      K.fine(() => { for (const s of [-1, 1]) K.cyl(0.92, 5.94, s * 0.54 - 0.1, 0.16, 0.16, 0.2, P.d, 'dark', { rx: H, seg: 6 }); K.box(1.04, 5.88, 0, 0.04, 0.26, 0.4, P.d, 'metal'); }); }
    else { V._cbl(K, 0.92, 5.72, 0, 0.26, 1.14, 1.44, 0.1, P.b, 'steel', { rz: 0.12 }); K.box(1.06, 6.24, 0, 0.05, 0.3, 0.9, '#1C2522', 'glass', { rz: 0.12 }); K.box(1.09, 6.33, 0, 0.03, 0.06, 0.76, VIS, null, { e: 2.2, rz: 0.12 }); K.box(0.66, 6.88, 0, 0.36, 0.14, 1.6, P.d, 'dark');
      K.fine(() => { for (const s of [-1, 1]) K.cyl(0.7, 6.95, s * 0.8 - (s < 0 ? 0.12 : 0), 0.12, 0.12, 0.12, P.t, 'metal', { rx: H, seg: 6 }); for (let i = 0; i < 3; i++) K.box(1.05, 5.86 + i * 0.1, 0, 0.04, 0.04, 0.64, P.d, 'dark', { rz: 0.12 }); }); }
    K.fine(() => { for (const s of [-1, 1]) K.cyl(0.02, 6.5, s * 0.82 - (s < 0 ? 0.14 : 0), 0.3, 0.3, 0.14, P.b, 'metal', { rx: H, seg: 6 }); }); },
  _chamine(K, P, x, y, z, h, r) { /* 4.3e: chaminé curta da mochila (versão enxuta do V._escape): cano enferrujado, boca escura (só de perto) e brasa */
    K.cyl(x, y, z, r, r * 1.12, h, P.r, 'metal', { seg: 8 }); if (!K.lite) K.cyl(x, y + h, z, r * 1.3, r * 1.06, r * 0.7, P.d, 'dark', { seg: 8 }); K.cyl(x, y + h + r * 0.4, z, r * 0.8, r * 0.8, r * 0.5, '#FF7A2E', null, { e: 2.5, seg: 6 }); },
  _mochila(K, P, tc) { const V = U.vehnar; /* 4.3e: mochila-fornalha do soldado — caixa de aço chanfrada com tampa da cor do time (lê de cima), grade traseira em brasa, faixa de perigo e chaminés gêmeas com brasa na boca; de perto, fuligem na tampa, luz vermelha de status, venezianas e mangueira até o respirador */
    V._cb(K, -1.38, 3.95, 0, 0.88, 1.95, 1.82, 0.2, P.b, 'steel'); V._cbl(K, -1.36, 5.82, 0, 0.94, 0.22, 1.66, 0.08, tc, 'paint'); K.box(-1.83, 4.36, 0, 0.04, 0.5, 1.12, '#FF7A2E', null, { e: 1.5 }); V._haz(K, P, -1.84, 5.6, 0, 1.5, 0.24, 3, 'fz');
    for (const s of [-1, 1]) V._chamine(K, P, -1.6, 5.05, s * 0.6, 1.45, 0.16);
    K.fine(() => { for (const s of [-1, 1]) K.box(-1.56, 6.04, s * 0.6, 0.62, 0.02, 0.5, '#2A2623', 'matte'); K.light(-1.1, 6.06, 0.0, 0.12, '#FF4040', 2.4); for (let i = 0; i < 3; i++) K.box(-1.86, 4.4 + i * 0.16, 0, 0.05, 0.06, 1.24, P.d, 'metal'); K.tube([[-1.1, 5.7, -0.55], [-0.5, 6.25, -0.82], [0.35, 6.0, -0.8], [0.72, 5.92, -0.55]], 0.07, P.d, 'rubber', { ts: 6, rs: 4 }); }); },
  _fuzil(K, P, tc) { const V = U.vehnar, Z = 1.42, Y = 4.36; /* 4.3e: fuzil industrial no quadril direito (desenhar dentro do recuo) — culatra chanfrada escura com faixa da cor do time no topo, coronha curta, tambor de munição claro, camisa de refrigeração (aletas de perto), freio de boca e boca em brasa; mira com ponto vermelho e mangueira da mochila de perto */
    K.box(-0.5, Y - 0.26, Z, 0.62, 0.42, 0.32, P.d, 'dark'); V._cbl(K, 0.62, Y - 0.32, Z, 1.66, 0.62, 0.44, 0.12, P.d, 'metal'); K.box(0.6, Y + 0.3, Z, 1.2, 0.1, 0.3, tc, 'paint');
    K.cyl(0.8, Y - 0.56, Z - 0.21, 0.4, 0.4, 0.42, P.t, 'metal', { rx: H, seg: 12 }); K.cyl(0.8, Y - 0.56, Z - 0.23, 0.18, 0.18, 0.46, P.d, 'dark', { rx: H, seg: 6 }); K.box(0.42, Y - 0.62, Z, 0.24, 0.42, 0.22, P.d, 'rubber');
    K.cyl(1.4, Y, Z, 0.22, 0.22, 1.5, P.b, 'steel', { rz: -H, seg: 8 }); K.cyl(2.9, Y, Z, 0.1, 0.1, 0.36, P.d, 'metal', { rz: -H, seg: 6 }); K.box(3.42, Y - 0.14, Z, 0.36, 0.28, 0.3, P.d, 'dark'); K.cyl(3.6, Y, Z, 0.08, 0.08, 0.04, '#FF6A3A', null, { e: 2.6, rz: -H, seg: 6 });
    K.fine(() => { for (const x of [1.75, 2.1, 2.45]) K.cyl(x, Y, Z, 0.26, 0.26, 0.06, P.d, 'metal', { rz: -H, seg: 8 }); K.box(1.12, Y + 0.38, Z, 0.34, 0.16, 0.14, P.d, 'dark'); K.box(1.3, Y + 0.43, Z, 0.02, 0.05, 0.05, '#FF4040', null, { e: 2.4 }); K.tube([[-1.2, 4.3, 0.95], [-0.7, 3.9, 1.5], [0.1, 4.0, 1.62], [0.5, 4.2, 1.6]], 0.06, P.d, 'rubber', { ts: 6, rs: 4 }); }); },
  _tanques(K, P, tc) { const V = U.vehnar, TX = -1.56; /* 4.3e: tanques gêmeos do soldador — cilindros amarelos de perigo com cúpula (um torno só) que passam dos ombros (lê de frente e de cima), cintas escuras e cinta da cor do time, berço escuro preso às costas, regulador e mangueira grossa até a lança (pelo quadril direito); válvulas com volante vermelho de perto */
    V._cbl(K, -1.12, 3.75, 0, 0.32, 1.9, 1.6, 0.08, P.d, 'dark');
    for (const s of [-1, 1]) { const z = s * 0.66; K.lathe(K.lite ? [[0.42, 0], [0.5, 0.12], [0.5, 2.9], [0.3, 3.32], [0, 3.4]] : [[0.36, 0], [0.5, 0.12], [0.5, 2.86], [0.42, 3.18], [0.24, 3.36], [0, 3.4]], TX, 3.5, z, P.h, 'paint', { seg: 10 });
      K.cyl(TX, 5.0, z, 0.52, 0.52, 0.26, tc, 'paint', { seg: 10, open: true }); K.cyl(TX, 4.0, z, 0.52, 0.52, 0.16, P.d, 'dark', { seg: 10, open: true }); if (!K.lite) K.cyl(TX, 6.0, z, 0.52, 0.52, 0.16, P.d, 'dark', { seg: 10, open: true });
      K.fine(() => { K.cyl(TX, 6.86, z, 0.06, 0.06, 0.14, P.d, 'metal', { seg: 5 }); K.cyl(TX, 6.98, z, 0.16, 0.16, 0.04, '#C0392B', 'paint', { seg: 8 }); }); }
    K.box(TX, 6.2, 0, 0.36, 0.3, 0.7, P.d, 'metal'); K.tube([[-1.3, 3.6, 0.95], [-0.75, 3.15, 1.62], [-0.05, 3.5, 1.7], [0.0, 3.95, 1.32]], 0.11, P.d, 'rubber', { ts: 8, rs: 5 }); },
  _lanca(K, P, tc) { const V = U.vehnar, Z = 1.34, Y = 4.2; /* 4.3e: lança-chamas do soldador no quadril direito (desenhar dentro do recuo) — corpo da válvula escuro com faixa da cor do time, tubo de aço longo, luva térmica escura (anéis de perto), bico claro alargado com a boca acesa por dentro e acendedor com chama-piloto que tremula (sway; fica fora do recuo) */
    V._cbl(K, 0.3, Y - 0.28, Z, 1.36, 0.54, 0.44, 0.1, P.d, 'metal'); K.box(0.26, Y + 0.26, Z, 0.96, 0.08, 0.32, tc, 'paint'); K.fine(() => K.box(0.36, Y - 0.68, Z, 0.22, 0.42, 0.2, P.d, 'rubber'));
    K.cyl(0.95, Y, Z, 0.13, 0.13, 1.9, P.b, 'steel', { rz: -H, seg: 8 }); K.cyl(2.2, Y, Z, 0.24, 0.24, 0.7, P.d, 'dark', { rz: -H, seg: 10 }); K.cyl(2.9, Y, Z, 0.23, 0.15, 0.5, P.t, 'metal', { rz: -H, seg: 10 }); K.cyl(3.39, Y, Z, 0.16, 0.16, 0.03, '#FF6A3A', null, { e: 1.8, rz: -H, seg: 8 });
    K.box(3.12, Y - 0.36, Z, 0.28, 0.14, 0.14, P.d, 'dark');
    K.anim({ t: 'sway', p: [3.27, Y - 0.29, Z], amp: 0.3, speed: 26 }, () => { K.cone(3.27, Y - 0.29, Z, 0.12, 0.56, '#FFC24A', null, { e: 2.6, rz: -H, seg: 6 }); if (!K.lite) K.sph(3.33, Y - 0.29, Z, 0.085, '#FFF1C4', null, { e: 3.2, seg: 6 }); });
    K.fine(() => { for (const x of [2.32, 2.6]) K.cyl(x, Y, Z, 0.27, 0.27, 0.05, P.b, 'metal', { rz: -H, seg: 8 }); K.cyl(0.55, Y - 0.4, Z + 0.12, 0.12, 0.12, 0.7, P.h, 'paint', { rz: -H, seg: 8 }); }); },
  veiculo_hull(K, P, tc) { /* 4.3d: casco do tanque pesado — lagartas largas (rodas que giram, sapatas que rolam), casco chanfrado com glacis, convés do motor com ventoinha e grelhas em brasa, escapamentos gêmeos, para-lamas com faixa de perigo, faróis, faixas da cor do time no convés */
    const V = U.vehnar, FO = '#FF7A2E', RED = '#FF4040';
    for (const s of [-1, 1]) V._lagarta(K, P, tc, s * 3.6, s, { L: 13.4, Ht: 2.6, w: 2.3, R: 1.15, xb: 4.8, rw: 0.8 });
    K.poly([[-6.2, 0.75], [5.0, 0.75], [6.25, 1.55], [6.25, 2.55], [-6.2, 2.55]], 4.6, P.d, 'dark', { b: 0.12 });
    K.poly([[-6.3, 2.5], [6.2, 2.5], [6.55, 2.75], [4.2, 3.6], [-5.45, 3.6], [-6.3, 3.0]], 6.0, P.a, 'steel', { b: 0.2 });
    K.cyl(0, 3.73, 0, 2.55, 2.6, 0.14, P.d, 'dark', { seg: 22 });
    for (const s of [-1, 1]) { K.box(0.4, 3.75, s * 2.78, 7.2, 0.1, 0.66, tc, 'paint');
      V._cb(K, 6.0, 2.62, s * 4.0, 1.7, 0.15, 1.65, 0.05, P.b, 'steel'); V._haz(K, P, 6.12, 2.8, s * 4.0, 1.45, 1.25, 3, 'tz');
      V._cb(K, -6.0, 2.62, s * 4.0, 1.7, 0.15, 1.65, 0.05, P.b, 'steel'); K.box(-6.78, 1.35, s * 4.0, 0.08, 1.3, 1.5, P.d, 'rubber');
      V._cb(K, 5.62, 3.05, s * 2.5, 0.6, 0.55, 0.72, 0.08, P.d, 'dark'); K.box(5.93, 3.13, s * 2.5, 0.05, 0.36, 0.5, P.l, null, { e: 2.4 });
      K.light(-6.55, 3.05, s * 2.4, 0.28, RED, 2.4); K.light(-6.55, 2.66, s * 2.4, 0.22, '#FFA03A', 2.2);
      V._escape(K, P, -5.9, 2.95, s * 2.72, 1.3, 0.3); /* 4.3d: baixo o bastante para o cano passar por cima quando a torre mira para trás */
      K.box(-4.3, 3.75, s * 1.75, 2.3, 0.08, 1.05, P.d, 'dark'); K.box(-4.3, 3.81, s * 1.75, 2.05, 0.04, 0.8, FO, null, { e: 1.2 });
      for (let i = 0; i < (K.lite ? 2 : 5); i++) K.box(K.lite ? -4.85 + i * 1.1 : -5.2 + i * 0.45, 3.85, s * 1.75, 0.14, 0.1, 0.92, P.b, 'metal', { rz: 0.5 });
      K.fine(() => { for (const x of [5.45, 5.8]) K.box(x, 3.6, s * 2.5, 0.05, 0.05, 0.84, P.d, 'metal'); K.box(6.5, 1.25, s * 1.7, 0.3, 0.3, 0.16, P.d, 'metal'); K.box(-6.6, 1.15, s * 1.6, 0.3, 0.3, 0.16, P.d, 'metal'); K.tube([[-4.9, 3.77, s * 2.25], [-5.5, 3.62, s * 2.6], [-5.9, 3.3, s * 2.72]], 0.13, P.r, 'metal', { ts: 6, rs: 5 }); }); }
    K.cyl(-4.3, 3.73, 0, 0.98, 0.98, 0.12, P.d, 'dark', { seg: 16 });
    K.anim({ t: 'spin', p: [-4.3, 3.81, 0], speed: 6 }, () => { for (let i = 0; i < 3; i++) K.box(-4.3, 3.81, 0, 1.75, 0.04, 0.3, P.t, 'metal', { ry: i / 3 * PI + 0.3 }); });
    K.fine(() => { K.box(-4.3, 3.93, 0, 0.07, 0.05, 1.9, P.d, 'dark'); K.box(-4.3, 3.93, 0, 1.9, 0.05, 0.07, P.d, 'dark'); });
    V._haz(K, P, 6.42, 2.05, 0, 4.2, 0.5, 6, 'fz'); V._haz(K, P, -6.52, 2.2, 0, 2.4, 0.34, 4, 'fz');
    V._cb(K, -6.55, 1.55, 0, 0.42, 0.62, 3.2, 0.08, P.b, 'steel');
    K.cyl(4.75, 3.42, 1.2, 0.5, 0.56, 0.16, P.b, 'steel', { seg: 12, rz: -0.27 }); for (const dz of [-0.26, 0.26]) K.box(5.3, 3.28, 1.2 + dz, 0.18, 0.15, 0.3, P.g, 'glass', { pat: 0, rz: -0.27 });
    K.fine(() => { for (let i = 0; i < 4; i++) K.box(5.55, 3.18, -1.7 + i * 0.52, 0.85, 0.1, 0.42, P.d, 'rubber', { rz: -0.27 }); K.cyl(4.2, 3.72, -1.5, 0.08, 0.08, 0.5, P.d, 'metal', { rz: -H, seg: 6 }); for (let i = 0; i < 6; i++) K.box(-2.6 + i * 1.0, 3.77, 2.05, 0.14, 0.06, 0.14, P.d, 'metal'); });
    K.mount = 3.85; },
  veiculo_turret(K, P, tc) { /* 4.3d: torre soldada em cunha — teto da cor do time e placas laterais claras, mantelete com pistões de elevação, canhão longo com evacuador (faixa da cor do time) e freio de boca que recuam, metralhadora coaxial, cúpula do comandante, lança-fumaças, cesto traseiro com caixas, holofote e antena que balança */
    const V = U.vehnar, sh = [[2.2, 0.9], [1.4, 1.85], [-1.7, 1.95], [-2.6, 1.35], [-2.6, -1.35], [-1.7, -1.95], [1.4, -1.85], [2.2, -0.9]];
    K.cyl(0, -0.3, 0, 2.25, 2.4, 0.5, P.d, 'dark', { seg: 18 });
    K.poly(sh, 1.05, P.a, 'steel', { rx: -H, y: 0.925, b: 0.2 });
    K.poly(sh.map(p => [p[0] * 0.82 - 0.12, p[1] * 0.8]), 0.08, tc, 'paint', { rx: -H, y: 1.72, b: 0.03 });
    for (const s of [-1, 1]) V._cb(K, -0.15, 0.35, s * 2.24, 3.1, 1.05, 0.2, 0.07, P.t, 'steel', { ry: s * 0.032 });
    V._cb(K, 2.65, 0.3, 0, 0.9, 1.3, 1.75, 0.2, P.b, 'steel');
    K.anim({ t: 'recoil', dist: 1.0 }, () => {
      K.cyl(2.95, 0.95, 0, 0.4, 0.44, 0.85, P.d, 'dark', { rz: -H, seg: 12 }); K.seg([3.75, 0.95, 0], [8.75, 0.95, 0], 0.27, P.b, 'metal', { taper: 0.82, seg: 12 });
      K.cyl(5.2, 0.95, 0, 0.41, 0.41, 1.2, P.a, 'steel', { rz: -H, seg: 12 }); K.cyl(5.62, 0.95, 0, 0.43, 0.43, 0.36, tc, 'paint', { rz: -H, seg: 12 });
      V._cb(K, 9.1, 0.68, 0, 0.8, 0.54, 0.84, 0.14, P.d, 'dark'); K.cyl(9.5, 0.95, 0, 0.17, 0.17, 0.03, '#0B0B0E', 'dark', { rz: -H, seg: 8 });
      K.fine(() => { for (const s of [-1, 1]) for (const dx of [-0.16, 0.16]) K.box(9.1 + dx, 0.78, s * 0.43, 0.12, 0.34, 0.03, '#121317', 'dark'); }); });
    K.cyl(-0.85, 1.7, 0.95, 0.6, 0.68, 0.42, P.b, 'steel', { seg: 14 }); K.cyl(-0.85, 2.12, 0.95, 0.5, 0.56, 0.13, P.a, 'steel', { seg: 14 });
    K.cyl(-0.45, 1.73, -0.95, 0.44, 0.47, 0.1, P.b, 'steel', { seg: 12 });
    V._cb(K, -3.25, 0.4, 0.62, 0.9, 0.8, 1.05, 0.08, P.b, 'steel'); V._cb(K, -3.2, 0.4, -0.62, 0.8, 0.72, 0.95, 0.08, '#6E6248', 'paint');
    K.cyl(1.55, 1.9, 1.4, 0.2, 0.2, 0.42, P.d, 'dark', { rz: -H, seg: 8 }); K.cyl(1.97, 1.9, 1.4, 0.17, 0.17, 0.04, P.l, null, { e: 2.4, rz: -H, seg: 8 });
    K.cyl(-2.15, 1.6, -1.3, 0.13, 0.15, 0.2, P.d, 'dark', { seg: 8 });
    K.anim({ t: 'sway', p: [-2.15, 1.75, -1.3], amp: 0.12, speed: 2.6 }, () => { K.seg([-2.15, 1.75, -1.3], [-2.3, 4.25, -1.3], 0.035, P.d, 'metal', { seg: 5 }); K.box(-2.3, 4.21, -1.3, 0.1, 0.12, 0.1, '#FF4040', null, { e: 2.2 }); });
    K.fine(() => { K.seg([3.0, 1.3, 0.62], [4.3, 1.3, 0.62], 0.07, P.d, 'metal', { seg: 6 }); for (const z of [-0.5, 0.5]) V._pistao(K, P, [1.25, 1.8, z], [2.7, 1.51, z], 0.12);
      for (const s of [-1, 1]) for (let i = 0; i < 3; i++) K.cyl(1.0 + i * 0.05, 1.15 + i * 0.22, s * 2.12, 0.09, 0.09, 0.42, P.d, 'dark', { rz: -0.9, seg: 6 });
      ringOf(5, 0.64, (cx, cz, a) => K.box(-0.85 + cx, 1.83, 0.95 + cz, 0.14, 0.14, 0.24, P.g, 'glass', { ry: -a, pat: 0 })); K.seg([-0.4, 2.27, 0.95], [0.55, 2.31, 0.95], 0.05, P.d, 'metal', { seg: 5 });
      for (const z of [-1.15, 1.15]) K.seg([-2.8, 1.3, z], [-3.75, 1.3, z], 0.05, P.d, 'metal', { seg: 5 }); K.seg([-3.75, 1.3, -1.15], [-3.75, 1.3, 1.15], 0.05, P.d, 'metal', { seg: 5 });
      for (const s of [-1, 1]) for (let i = 0; i < 4; i++) K.box(-1.3 + i * 0.75, 1.15, s * 2.36, 0.1, 0.1, 0.05, P.d, 'metal'); }); },
  drone(K, P, tc) { /* 4.3d: drone de ataque pesado — quatro dutos com hélices que giram (sentidos alternados), braços em X e dorso da cor do time, corpo blindado chanfrado, metralhadora rotativa no queixo (gira), olho de sensor, escapamentos gêmeos com brasa, esquis e antena que balança */
    const V = U.vehnar, FO = '#FF7A2E', RED = '#FF4040', DX = 2.95, DZ = 2.95, DY = 1.45;
    K.poly([[-2.5, 1.05], [1.8, 1.05], [2.65, 1.45], [2.6, 1.95], [1.65, 2.4], [-1.95, 2.4], [-2.6, 1.95]], 2.0, P.a, 'steel', { b: 0.17 });
    V._cb(K, -0.25, 2.5, 0, 3.0, 0.3, 1.55, 0.1, tc, 'paint'); V._cb(K, -0.4, 0.72, 0, 2.6, 0.42, 1.5, 0.1, P.d, 'dark');
    for (const [sx, sz] of QUAD) { const cx = sx * DX, cz = sz * DZ, ax = sx * 0.7, az = sz * 0.75, L = Math.hypot(cx - ax, cz - az);
      K.box((ax + cx) / 2, 2.12, (az + cz) / 2, L, 0.3, 0.52, tc, 'paint', { ry: Math.atan2(-(cz - az), cx - ax) });
      K.lathe([[1.22, 0.74], [1.22, 0.04], [1.54, 0.0], [1.58, 0.62], [1.38, 0.8], [1.22, 0.74]], cx, DY, cz, P.a, 'steel', { seg: 18, flat: true }); /* 4.3d: duto facetado (aço usinado) */
      K.fine(() => K.cyl(cx, DY + 0.15, cz, 0.3, 0.36, 0.55, P.d, 'dark', { seg: 8 }));
      K.anim({ t: 'spin', p: [cx, DY, cz], speed: sx * sz * 21 }, () => { const nb = K.q(3); for (let i = 0; i < nb; i++) { const a = i / nb * PI * 2 + 0.4; K.box(cx + Math.cos(a) * 0.66, DY + 0.46, cz - Math.sin(a) * 0.66, 1.02, 0.05, 0.3, '#3A3E46', 'metal', { ry: a, rx: 0.35 }); } K.fine(() => K.cyl(cx, DY + 0.55, cz, 0.16, 0.2, 0.1, P.t, 'metal', { seg: 6 })); });
      K.fine(() => { K.light(cx + sx * 0.4, DY + 0.38, cz + sz * 1.5, 0.16, sz > 0 ? RED : '#FFE2A8', 2.2); for (const a of [PI / 4, -PI / 4]) K.box(cx, DY + 0.2, cz, 2.38, 0.07, 0.1, P.d, 'metal', { ry: a }); K.box(cx + sx * 0.85, DY + 0.8, cz + sz * 0.85, 0.5, 0.06, 0.16, P.h, 'paint', { ry: -sx * sz * PI / 4 }); }); }
    K.sph(1.85, 0.8, 0, 0.48, P.b, 'steel', { seg: 9 });
    K.anim({ t: 'spin', p: [2.1, 0.74, 0], axis: 'x', speed: 9 }, () => { const nb = K.q(6); for (let i = 0; i < nb; i++) { const a = i / nb * PI * 2; K.seg([2.1, 0.74 + Math.sin(a) * 0.13, Math.cos(a) * 0.13], [3.75, 0.74 + Math.sin(a) * 0.13, Math.cos(a) * 0.13], 0.05, P.d, 'metal', { seg: 5 }); }
      K.cyl(2.85, 0.74, 0, 0.23, 0.23, 0.1, P.b, 'metal', { rz: -H, seg: 8 }); K.cyl(3.55, 0.74, 0, 0.22, 0.22, 0.12, P.b, 'metal', { rz: -H, seg: 8 }); });
    K.fine(() => K.cyl(2.62, 1.68, 0, 0.3, 0.34, 0.18, P.d, 'dark', { rz: -H, seg: 10 })); K.cyl(2.78, 1.68, 0, 0.2, 0.2, 0.06, '#FF3A2A', null, { e: 2.6, rz: -H, seg: 8 });
    for (const s of [-1, 1]) { K.cyl(-2.2, 2.05, s * 0.62, 0.2, 0.25, 0.9, P.r, 'metal', { rz: H - 0.4, seg: 8 }); K.cyl(-3.03, 2.4, s * 0.62, 0.15, 0.15, 0.08, FO, null, { e: 2.4, rz: H - 0.4, seg: 8 });
      K.box(-0.35, 0, s * 1.05, 4.0, 0.13, 0.17, P.d, 'dark'); K.fine(() => { K.seg([1.6, 0.07, s * 1.05], [2.05, 0.32, s * 1.05], 0.07, P.d, 'dark', { seg: 5 }); for (const x of [-1.4, 0.8]) K.seg([x, 0.1, s * 1.05], [x + 0.15, 0.95, s * 0.8], 0.065, P.b, 'metal', { seg: 5 }); }); }
    K.light(-2.74, 1.85, 0, 0.2, RED, 2.4);
    K.anim({ t: 'sway', p: [-1.55, 2.8, 0.45], amp: 0.16, speed: 3.2 }, () => K.seg([-1.55, 2.8, 0.45], [-1.85, 3.95, 0.45], 0.03, P.d, 'metal', { seg: 5 }));
    K.fine(() => { K.cyl(0.55, 0.62, -0.95, 0.36, 0.36, 0.55, P.b, 'metal', { rx: H, seg: 10 }); K.tube([[0.9, 0.7, -0.6], [1.4, 0.62, -0.3], [1.8, 0.72, -0.1]], 0.08, P.d, 'metal', { ts: 6, rs: 4 });
      for (const s of [-1, 1]) for (let i = 0; i < 3; i++) K.box(-1.6 + i * 1.1, 2.0, s * 1.19, 0.6, 0.08, 0.04, P.d, 'dark'); K.box(-0.25, 2.82, 0, 1.2, 0.06, 0.12, P.h, 'paint'); K.cyl(0.9, 2.8, 0, 0.22, 0.26, 0.14, P.g, 'glass', { seg: 8 }); }); },
  suporte(K, P, tc) { /* 4.3d: Interferidor — caminhão 4×4 da família do coletor: cabine clara, módulo de equipamento com painéis da cor do time, mesa giratória com antena parabólica (gira como radar, borda da cor do time) e bobina de pulso acesa no foco, macacos hidráulicos atrás, escapamentos gêmeos com brasa, antenas que balançam */
    const V = U.vehnar, PK = '#FF5FD2', RED = '#FF4040', TL = -0.6, DPX = -1.45, DPY = 4.3, c = Math.cos(TL), sn = Math.sin(TL);
    const tl = (lx, ly, lz) => [DPX + lx * c - ly * sn, DPY + lx * sn + ly * c, lz]; /* ponto no referencial da antena (inclinada em z por TL) */
    for (const x of [-2.2, 2.35]) for (const s of [-1, 1]) V._roda(K, P, tc, x, 1.05, s * 2.2, 1.05, 0.95, s, { lugs: 9 });
    V._cb(K, 0.0, 0.7, 0, 7.4, 0.8, 2.8, 0.2, P.d, 'dark');
    V._cb(K, 2.55, 1.4, 0, 2.3, 1.0, 3.3, 0.2, P.b, 'steel'); V._cabine(K, P, tc, 1.5, 3.5, 2.4, 3.85, 3.0, {});
    V._cb(K, 3.85, 0.72, 0, 0.42, 0.62, 3.1, 0.1, P.a, 'steel'); V._haz(K, P, 4.08, 1.03, 0, 2.7, 0.4, 5, 'fz');
    V._cb(K, -1.35, 1.4, 0, 4.5, 1.4, 3.3, 0.22, P.a, 'steel');
    for (const s of [-1, 1]) { K.box(-1.45, 1.72, s * 1.66, 3.3, 0.74, 0.06, tc, 'paint'); V._haz(K, P, -1.45, 1.6, s * 1.69, 3.3, 0.2, 6, 'sx');
      K.box(3.69, 1.62, s * 1.15, 0.08, 0.36, 0.55, P.d, 'dark'); K.box(3.72, 1.68, s * 1.15, 0.03, 0.24, 0.42, P.l, null, { e: 2.4 });
      V._escape(K, P, 1.15, 2.4, s * 1.3, 1.6, 0.2);
      K.box(-3.75, 2.15, s * 1.3, 0.5, 0.35, 0.55, P.d, 'dark'); V._pistao(K, P, [-3.95, 2.55, s * 1.3], [-3.95, 0.82, s * 1.3], 0.15); K.box(-3.95, 0.62, s * 1.3, 0.7, 0.2, 0.7, P.d, 'dark');
      K.light(-3.66, 2.45, s * 0.85, 0.24, RED, 2.4);
      K.anim({ t: 'sway', p: [-3.55, 2.8, s * 1.6], amp: 0.13, speed: 2.4, ph: s }, () => { K.seg([-3.55, 2.8, s * 1.6], [-3.7, 5.5, s * 1.6], 0.03, P.d, 'metal', { seg: 5 }); K.box(-3.7, 5.45, s * 1.6, 0.09, 0.12, 0.09, RED, null, { e: 2.2 }); }); }
    V._haz(K, P, -3.62, 1.65, 0, 1.6, 0.36, 3, 'fz');
    K.cyl(DPX, 2.8, 0, 1.25, 1.35, 0.22, P.d, 'dark', { seg: 18 });
    K.anim({ t: 'spin', p: [DPX, 3.0, 0], speed: 0.9 }, () => {
      K.cyl(DPX, 3.0, 0, 1.0, 1.1, 0.32, P.b, 'steel', { seg: 16 }); for (const s of [-1, 1]) V._cb(K, DPX, 3.25, s * 0.74, 0.62, 1.3, 0.22, 0.07, P.a, 'steel');
      K.cyl(DPX, DPY, -0.86, 0.18, 0.18, 1.72, P.d, 'dark', { rx: H, seg: 8 });
      K.lathe([[0, 0], [1.03, 0.11], [1.84, 0.48], [2.24, 0.76], [2.16, 0.86], [1.72, 0.6], [0.98, 0.31], [0, 0.2]], DPX, DPY, 0, P.t, 'metal', { seg: 20, rz: TL });
      const rc = tl(0, 0.8, 0); K.tor(rc[0], rc[1], 0, 2.22, 0.09, tc, 'paint', { rz: TL, ts: 20, rs: 4 });
      const f = tl(0, 1.75, 0), hb = tl(0, 1.1, 0); for (const a of [H, H + PI * 2 / 3, H + PI * 4 / 3]) K.seg(tl(Math.cos(a) * 2.12, 0.78, Math.sin(a) * 2.12), f, 0.035, P.d, 'metal', { seg: 4 });
      K.cyl(hb[0], hb[1], 0, 0.16, 0.2, 0.42, P.d, 'dark', { rz: TL, seg: 8 }); K.sph(f[0], f[1], 0, 0.26, PK, null, { e: 2.6, seg: 8 });
      K.fine(() => { for (let i = 0; i < 3; i++) { const q = tl(0, 1.4 + i * 0.13, 0); K.tor(q[0], q[1], 0, 0.3 - i * 0.04, 0.035, P.r, 'metal', { rz: TL, ts: 10, rs: 3 }); } for (const s of [-1, 1]) K.tube([[DPX, 3.35, s * 0.62], [DPX - 0.3, 3.9, s * 0.4], hb.slice(0, 2).concat([s * 0.1])], 0.05, P.d, 'rubber', { ts: 6, rs: 4 }); }); });
    K.fine(() => { for (const s of [-1, 1]) { K.cyl(-0.2, 2.1, s * 1.72, 0.32, 0.32, 0.18, P.d, 'dark', { rx: s * H, seg: 10 }); K.box(-2.9, 2.82, s * 1.2, 0.5, 0.16, 0.5, P.b, 'metal'); } for (let i = 0; i < 4; i++) K.box(-3.1 + i * 0.32, 2.82, 0, 0.1, 0.05, 1.6, P.h, 'paint'); }); },
  pirata(K, P, tc) { /* 4.3d: Rebocador — caminhão 6×6 blindado: cabine clara com venezianas e giroflex âmbar, para-choque aríete com faixa de perigo, tanque da carga roubada com cintas da cor do time, braço sifão com bocal aceso (violeta, como o feixe do roubo), lança de reboque em A erguida por pistão, gancho que balança, guincho, caixas de carga, escapamentos gêmeos */
    const V = U.vehnar, PK = '#FF5FD2', RED = '#FF4040', TY = 3.95, TR = 1.72;
    for (const x of [-4.6, -1.85, 3.9]) for (const s of [-1, 1]) V._roda(K, P, tc, x, 1.3, s * 3.0, 1.3, 1.1, s, { lugs: 10 });
    V._cb(K, -0.5, 0.85, 0, 12.6, 1.0, 3.6, 0.25, P.d, 'dark');
    V._cb(K, 4.2, 1.8, 0, 3.4, 1.3, 4.6, 0.25, P.b, 'steel'); V._cabine(K, P, tc, 2.7, 5.4, 3.1, 4.75, 4.0, { visor: true, ambar: true });
    V._cb(K, 6.15, 0.75, 0, 0.75, 1.35, 5.0, 0.18, P.a, 'steel'); V._haz(K, P, 6.55, 1.42, 0, 4.6, 0.7, 6, 'fz');
    for (const s of [-1, 1]) { V._cb(K, 3.9, 2.72, s * 3.0, 2.95, 0.2, 1.4, 0.06, P.a, 'steel'); V._haz(K, P, 3.9, 2.945, s * 3.0, 2.6, 0.5, 4, 'tx');
      K.box(5.88, 2.05, s * 1.75, 0.1, 0.5, 0.62, P.d, 'dark'); K.box(5.92, 2.12, s * 1.75, 0.04, 0.36, 0.48, P.l, null, { e: 2.4 });
      V._escape(K, P, 2.32, 3.0, s * 1.68, 2.2, 0.24);
      K.light(-6.95, 1.25, s * 1.4, 0.26, RED, 2.4);
      V._cb(K, 0.9 - 3.8 * (s < 0 ? 1 : 0), 1.8, 0, 0.6, 0.75, 3.3, 0.12, P.d, 'dark');
      K.seg([-4.15, 1.85, s * 1.55], [-6.05, 6.75, s * 0.42], 0.2, P.h, 'paint', { seg: 8 }); }
    K.cyl(-3.7, TY, 0, TR, TR, 5.4, P.t, 'steel', { rz: -H, seg: 18 });
    for (const [x, dir] of [[1.7, 1], [-3.7, -1]]) K.lathe([[TR, 0], [TR * 0.86, 0.34], [TR * 0.52, 0.6], [0, 0.68]], x, TY, 0, P.t, 'steel', { seg: 18, rz: -dir * H });
    for (const x of [-2.75, 0.45]) K.cyl(x, TY, 0, TR + 0.05, TR + 0.05, 0.6, tc, 'paint', { rz: -H, seg: 18 });
    K.cyl(-1.15, TY + TR - 0.08, 0, 0.5, 0.55, 0.2, P.b, 'steel', { seg: 12 });
    K.cyl(0.95, TY + TR - 0.2, 0, 0.55, 0.65, 0.45, P.b, 'steel', { seg: 12 }); V._viga(K, [0.95, 6.05, 0], [2.45, 6.95, 0], 0.42, 0.46, 0.08, P.h, 'paint');
    K.cyl(2.45, 6.95, 0, 0.36, 0.24, 0.9, P.d, 'dark', { rz: -H - 0.55, seg: 10 }); const nz = [2.45 + 0.9 * Math.cos(-0.55), 6.95 + 0.9 * Math.sin(-0.55)];
    K.tor(nz[0], nz[1], 0, 0.3, 0.07, PK, null, { e: 2.6, rz: -H - 0.55, ts: 12, rs: 4 }); K.sph(nz[0] + 0.05, nz[1] - 0.03, 0, 0.16, '#FFC4F2', null, { e: 3, seg: 6 });
    V._cb(K, -6.1, 6.45, 0, 0.85, 0.75, 1.3, 0.1, P.d, 'dark'); V._pistao(K, P, [-3.35, 2.0, 0], [-5.75, 6.3, 0], 0.22);
    K.cyl(-6.35, 1.6, -1.05, 0.45, 0.45, 2.1, P.b, 'metal', { rx: H, seg: 12 }); K.cyl(-6.35, 1.6, -0.6, 0.5, 0.5, 1.2, P.r, 'metal', { rx: H, seg: 12 });
    K.anim({ t: 'sway', p: [-6.4, 6.45, 0], amp: 0.16, speed: 2.1 }, () => { K.seg([-6.4, 6.45, 0], [-6.4, 3.75, 0], 0.045, P.d, 'metal', { seg: 5 }); V._cb(K, -6.4, 3.05, 0, 0.62, 0.72, 0.52, 0.08, P.h, 'paint'); K.tor(-6.4, 2.68, 0, 0.32, 0.09, P.d, 'metal', { rx: H, ts: 10, rs: 4, arc: PI * 1.4 }); });
    V._cb(K, -5.0, 1.85, 1.0, 1.45, 1.1, 1.5, 0.1, '#7A6A44', 'paint'); V._cb(K, -5.1, 1.85, -1.0, 1.2, 1.3, 1.4, 0.1, P.b, 'steel');
    V._haz(K, P, -6.86, 1.1, 0, 2.6, 0.4, 4, 'fz');
    K.fine(() => { K.tube([[0.95, 5.95, 0.4], [1.9, 6.6, 0.42], [2.6, 6.75, 0.3]], 0.09, P.d, 'rubber', { ts: 8, rs: 4 }); for (const s of [-1, 1]) { K.seg([-3.6, TY + TR + 0.25, s * 0.55], [1.5, TY + TR + 0.25, s * 0.55], 0.04, P.h, 'paint', { seg: 4 }); for (const x of [-3.2, -1.2, 0.8]) K.seg([x, TY + TR - 0.1, s * 0.55], [x, TY + TR + 0.25, s * 0.55], 0.035, P.h, 'paint', { seg: 4 }); K.box(-5.0, 2.95, s * 0.3, 1.5, 0.05, 0.06, tc, 'paint'); }
      K.cyl(-4.38, TY - 0.5, 0, 0.18, 0.18, 0.3, P.d, 'dark', { rz: H, seg: 8 }); K.tor(-4.62, TY - 0.5, 0, 0.26, 0.04, RED, 'paint', { rz: H, ts: 10, rs: 3 }); for (let i = 0; i < 5; i++) K.box(6.6, 0.95, -1.6 + i * 0.8, 0.12, 0.95, 0.14, P.d, 'metal'); }); },
  soldador(K, P, tc) { const V = U.vehnar, ra = { t: 'recoil', dist: 0.14 }; /* 4.3e: Soldador — mesmo corpo da infantaria com máscara de solda e avental de couro (frente escura), tanques gêmeos de combustível amarelos acima dos ombros, mangueira grossa até a lança-chamas no quadril direito (recua pouco, com a mão), bico escurecido aceso por dentro e chama-piloto que tremula; braço esquerdo livre que balança na passada */
    V._soldado(K, P, tc, { cD: [-0.3, 4.36, 1.56], mD: [0.36, 3.96, 1.34], cE: [-0.12, 4.2, -1.58], mE: [0.16, 3.22, -1.5], solto: true, avental: true, ra, st: 17 });
    V._capacete(K, P, tc, true); V._tanques(K, P, tc); K.anim(ra, () => V._lanca(K, P, tc)); },
  guindaste(K, P, tc) { /* 4.3d: Guindaste Armado — chassi 8×8 com para-lamas, cabine clara deslocada à esquerda e gerador com ventoinha (gira), estabilizadores amarelos com macacos hidráulicos, superestrutura com cabine do operador, contrapeso com faixas de perigo e topo da cor do time, escapamentos gêmeos, lança telescópica amarela (cinta da cor do time) erguida por pistão hidráulico, moitão com cabeça de solda acesa que balança */
    const V = U.vehnar, RED = '#FF4040', WLD = '#FFF1C4', th = 0.62, c = Math.cos(th), sn = Math.sin(th), BP = [-3.4, 5.0];
    const at = (d, n) => [BP[0] + c * d - sn * n, BP[1] + sn * d + c * n]; /* ponto ao longo da lança (d) com desvio normal (n) */
    for (const x of [4.75, 2.35, -2.35, -4.75]) for (const s of [-1, 1]) V._roda(K, P, tc, x, 1.15, s * 2.95, 1.15, 0.95, s, { lugs: 8 });
    V._cb(K, -0.1, 0.8, 0, 13.0, 1.05, 3.5, 0.25, P.d, 'dark'); V._cb(K, -0.1, 1.85, 0, 12.6, 0.45, 4.6, 0.12, P.b, 'steel');
    for (const s of [-1, 1]) { for (const xc of [3.55, -3.55]) V._cb(K, xc, 2.36, s * 2.95, 4.95, 0.14, 1.2, 0.05, P.a, 'steel');
      V._cb(K, 0.0, 2.3, s * 2.3, 1.15, 0.5, 1.4, 0.08, P.h, 'paint'); V._pistao(K, P, [0.0, 2.8, s * 2.95], [0.0, 0.75, s * 2.95], 0.2); K.cyl(0.0, 0.52, s * 2.95, 0.5, 0.56, 0.22, P.d, 'dark', { seg: 10 });
      V._cb(K, -6.35, 1.55, s * 2.0, 0.7, 0.65, 1.6, 0.08, P.h, 'paint'); V._pistao(K, P, [-6.45, 2.2, s * 2.55], [-6.45, 0.75, s * 2.55], 0.17); K.cyl(-6.45, 0.52, s * 2.55, 0.42, 0.48, 0.22, P.d, 'dark', { seg: 10 });
      K.light(-6.66, 1.85, s * 1.15, 0.24, RED, 2.4); V._cb(K, -3.1, 3.95, s * 0.74, 1.6, 1.6, 0.22, 0.08, P.b, 'steel');
      V._escape(K, P, -4.75, 4.1, s * 1.55, 1.55, 0.22); }
    V._cabine(K, P, tc, 4.2, 6.3, 2.3, 4.1, 2.3, { z: 1.05 }); K.box(6.33, 2.55, 1.05, 0.08, 0.32, 1.7, P.l, null, { e: 2.4 });
    V._cb(K, 5.15, 2.3, -1.2, 2.1, 1.1, 1.9, 0.14, P.a, 'steel'); K.cyl(5.15, 3.38, -1.2, 0.66, 0.66, 0.08, P.d, 'dark', { seg: 14 });
    K.anim({ t: 'spin', p: [5.15, 3.44, -1.2], speed: 7 }, () => { for (let i = 0; i < 3; i++) K.box(5.15, 3.44, -1.2, 1.15, 0.04, 0.24, P.t, 'metal', { ry: i / 3 * PI + 0.2 }); });
    V._cb(K, 6.6, 1.0, 0, 0.45, 0.7, 4.4, 0.1, P.a, 'steel'); V._haz(K, P, 6.84, 1.35, 0, 4.0, 0.45, 6, 'fz');
    K.cyl(-2.3, 2.3, 0, 2.0, 2.15, 0.35, P.d, 'dark', { seg: 20 }); V._cb(K, -3.45, 2.65, 0, 4.2, 1.45, 4.0, 0.3, P.a, 'steel');
    V._cb(K, -3.6, 4.1, 0.55, 2.9, 0.14, 2.3, 0.05, tc, 'paint');
    V._cabine(K, P, tc, -1.3, 0.5, 2.6, 4.35, 1.35, { z: -1.45, luz: false });
    V._cb(K, -6.0, 2.6, 0, 1.6, 2.0, 4.3, 0.25, P.d, 'dark'); V._haz(K, P, -6.83, 3.15, 0, 3.9, 0.9, 6, 'fz'); V._cb(K, -5.95, 4.6, 0, 1.25, 0.14, 3.9, 0.05, tc, 'paint');
    K.cyl(BP[0], BP[1], -0.95, 0.24, 0.24, 1.9, P.d, 'dark', { rx: H, seg: 10 });
    for (const [d0, d1, hh, ww] of [[-0.3, 4.8, 1.05, 1.15], [4.45, 7.85, 0.84, 0.94], [7.55, 10.0, 0.66, 0.76]]) { const m = at((d0 + d1) / 2, 0); V._cb(K, m[0], m[1] - hh / 2, 0, d1 - d0, hh, ww, 0.12, P.h, 'paint', { rz: th }); }
    { const m = at(2.7, 0); V._cb(K, m[0], m[1] - 0.6, 0, 0.7, 1.2, 1.3, 0.1, tc, 'paint', { rz: th }); }
    const pb = at(3.9, -0.62); V._cb(K, -0.35, 3.3, 0, 0.9, 0.9, 1.0, 0.1, P.b, 'steel'); V._pistao(K, P, [-0.35, 3.8, 0], [pb[0], pb[1], 0], 0.3, { k: 0.5 });
    const tp = at(9.95, 0); K.cyl(tp[0], tp[1], -0.43, 0.38, 0.38, 0.86, P.d, 'dark', { rx: H, seg: 12 }); K.light(tp[0] - 0.1, tp[1] + 0.38, 0, 0.2, RED, 2.6);
    const cx = tp[0] + 0.15, cy = tp[1] - 0.4;
    K.anim({ t: 'sway', p: [cx, cy, 0], amp: 0.13, speed: 1.9 }, () => { K.seg([cx, cy, 0], [cx, 7.3, 0], 0.045, P.d, 'metal', { seg: 5 }); V._cb(K, cx, 6.45, 0, 0.75, 0.85, 0.65, 0.1, P.h, 'paint');
      K.cyl(cx, 6.07, 0, 0.12, 0.12, 0.4, P.d, 'metal', { seg: 6 }); V._cb(K, cx, 5.55, 0, 1.2, 0.55, 0.5, 0.08, P.d, 'dark');
      for (const s of [-1, 1]) { K.seg([cx + s * 0.45, 5.6, 0], [cx + s * 0.75, 5.1, 0], 0.08, P.b, 'metal', { seg: 6 }); K.sph(cx + s * 0.77, 5.07, 0, 0.13, WLD, null, { e: 3, seg: 6 }); }
      K.fine(() => { for (let i = 0; i < 6; i++) { const a = i * 1.7, s = i % 2 ? 1 : -1; K.box(cx + s * (0.8 + 0.25 * Math.cos(a)), 4.9 - 0.18 * (i % 3), 0.25 * Math.sin(a), 0.05, 0.05, 0.05, '#FFD98A', null, { e: 2.6 }); } }); });
    K.fine(() => { for (const d of [1.0, 1.9, 3.6, 4.4]) { const q = at(d, 0.53); K.box(q[0], q[1], 0, 0.5, 0.05, 1.0, P.d, 'paint', { rz: th }); } const w = at(0.8, 0.75); K.box(w[0], w[1], 0, 0.3, 0.25, 0.5, P.d, 'dark'); K.box(w[0] + 0.16, w[1] + 0.03, 0, 0.04, 0.18, 0.4, P.l, null, { e: 2.2 });
      K.cyl(-1.8, 4.1, 1.4, 0.16, 0.19, 0.12, P.d, 'dark', { seg: 8 }); K.sph(-1.8, 4.25, 1.4, 0.17, '#FFA03A', null, { e: 2.2, seg: 8 }); }); },
  tratorzao(K, P, tc) { /* 4.3d: Tratorzão — batedor de rodas gigantes com garras (giram), suspensão de braços com amortecedores hidráulicos amarelos à mostra, banheira blindada com capô e laterais da cor do time, gaiola com teto da cor do time e barra de faróis, metralhadora dupla na gaiola (recua), mastro de sensor longo com radar que gira e antena que balança, motor traseiro com grelha em brasa e escapamentos gêmeos */
    const V = U.vehnar, FO = '#FF7A2E', RED = '#FF4040', WX = 2.95, WZ = 3.05, R = 1.75, WW = 1.45;
    for (const x of [-WX, WX]) for (const s of [-1, 1]) { V._roda(K, P, tc, x, R, s * WZ, R, WW, s, { lugs: 12 });
      K.seg([x * 0.5, 1.35, s * 1.5], [x, R - 0.35, s * (WZ - 0.78)], 0.11, P.d, 'metal', { seg: 6 }); K.seg([x * 0.58, 2.2, s * 1.5], [x, R + 0.3, s * (WZ - 0.78)], 0.09, P.d, 'metal', { seg: 6 });
      K.cyl(x, R, s * (WZ - 1.0), 0.34, 0.34, 0.32, P.b, 'metal', { rx: H, seg: 8 }); V._pistao(K, P, [x * 0.66, 2.95, s * 1.45], [x * 0.92, R - 0.15, s * (WZ - 0.9)], 0.16, { col: P.h }); }
    V._cb(K, 0, 1.0, 0, 6.4, 1.55, 3.2, 0.3, P.a, 'steel');
    V._cb(K, 1.95, 2.45, 0, 2.6, 0.38, 2.9, 0.12, tc, 'paint', { rz: -0.07 });
    V._cb(K, 3.3, 1.2, 0, 0.32, 1.25, 2.7, 0.08, P.d, 'dark');
    for (let i = 0; i < (K.lite ? 2 : 4); i++) K.box(3.48, K.lite ? 1.45 + i * 0.5 : 1.38 + i * 0.25, 0, 0.06, 0.1, 2.35, P.b, 'metal');
    for (const s of [-1, 1]) { K.box(3.47, 2.0, s * 1.05, 0.08, 0.3, 0.5, P.l, null, { e: 2.4 }); K.box(-0.2, 1.5, s * 1.62, 3.8, 0.62, 0.06, tc, 'paint');
      K.seg([3.75, 0.95, s * 1.3], [3.42, 2.25, s * 1.2], 0.09, P.d, 'metal', { seg: 6 }); V._escape(K, P, -3.1, 2.25, s * 0.88, 1.75, 0.2); K.light(-3.25, 1.75, s * 1.3, 0.24, RED, 2.4); }
    K.seg([3.75, 0.95, -1.3], [3.75, 0.95, 1.3], 0.1, P.d, 'metal', { seg: 6 });
    V._cb(K, -0.25, 2.3, 0, 2.5, 0.5, 2.7, 0.1, P.d, 'dark');
    V._cb(K, -2.35, 2.45, 0, 1.75, 0.75, 2.7, 0.14, P.b, 'steel'); K.box(-2.35, 3.2, 0, 1.4, 0.04, 1.9, FO, null, { e: 1.3 });
    for (let i = 0; i < (K.lite ? 2 : 5); i++) K.box(K.lite ? -2.7 + i * 0.7 : -2.9 + i * 0.28, 3.22, 0, 0.12, 0.1, 2.1, P.d, 'dark', { rz: 0.5 });
    const cg = [[1.4, 2.5, 1.45], [1.05, 4.3, 1.3], [-1.45, 4.3, 1.3], [-1.65, 2.5, 1.45]];
    for (const s of [-1, 1]) { const p = cg.map(q => [q[0], q[1], q[2] * s]); for (let i = 0; i < 3; i++) K.seg(p[i], p[i + 1], 0.1, P.d, 'metal', { seg: 6 }); K.fine(() => K.seg(p[0], p[2], 0.07, P.d, 'metal', { seg: 5 })); }
    for (const x of [1.05, -1.45]) K.seg([x, 4.3, -1.3], [x, 4.3, 1.3], 0.1, P.d, 'metal', { seg: 6 });
    V._cb(K, -0.2, 4.3, 0, 2.3, 0.14, 2.45, 0.05, tc, 'paint');
    K.box(1.12, 4.38, 0, 0.25, 0.22, 2.2, P.d, 'dark'); for (const k of (K.lite ? [-0.5, 0.5] : [-0.75, -0.25, 0.25, 0.75])) K.light(1.26, 4.42, k, 0.2, P.l, 2.4);
    K.cyl(-0.25, 4.44, 0, 0.45, 0.5, 0.2, P.d, 'dark', { seg: 12 }); V._cb(K, 0.05, 4.62, 0, 1.1, 0.45, 0.7, 0.08, P.b, 'steel'); K.box(-0.4, 4.62, 0.55, 0.6, 0.45, 0.35, P.h, 'paint');
    K.anim({ t: 'recoil', dist: 0.35 }, () => { for (const z of [-0.17, 0.17]) { K.seg([0.6, 4.85, z], [2.75, 4.85, z], 0.075, P.d, 'metal', { seg: 6 }); K.cyl(2.55, 4.85, z, 0.11, 0.11, 0.3, P.b, 'metal', { rz: -H, seg: 6 }); } });
    K.seg([-2.0, 2.6, -1.15], [-2.0, 6.0, -1.15], 0.09, P.b, 'metal', { seg: 6 });
    K.anim({ t: 'spin', p: [-2.0, 6.0, -1.15], speed: 2.6 }, () => { V._cb(K, -2.0, 6.0, -1.15, 0.3, 0.42, 1.9, 0.06, P.t, 'steel'); K.box(-1.83, 6.05, -1.15, 0.04, 0.32, 1.6, P.d, 'dark'); K.light(-2.0, 6.42, -1.15, 0.12, RED, 2.4); });
    K.anim({ t: 'sway', p: [-2.6, 2.6, 1.2], amp: 0.18, speed: 3 }, () => K.seg([-2.6, 2.6, 1.2], [-2.8, 6.6, 1.2], 0.03, P.d, 'metal', { seg: 5 }));
    K.fine(() => { for (const s of [-1, 1]) { V._cb(K, -0.75, 2.4, s * 0.6, 0.7, 0.5, 0.8, 0.08, P.r, 'paint'); V._cb(K, -1.05, 2.8, s * 0.6, 0.18, 0.75, 0.8, 0.05, P.r, 'paint'); }
      K.tor(0.45, 3.0, 0.6, 0.25, 0.04, P.d, 'metal', { rz: 0.9, ts: 12, rs: 3 }); K.seg([-2.0, 4.5, -1.15], [-1.45, 4.3, -1.3], 0.04, P.d, 'metal', { seg: 4 }); K.tube([[-0.4, 4.85, 0.55], [0.0, 5.05, 0.3], [0.4, 4.9, 0.12]], 0.05, P.d, 'metal', { ts: 6, rs: 4 }); }); },
  prensa(K, P, tc) { /* 4.3d: Prensa — mecha bípede de cerco: pernas com joelho blindado, pistão hidráulico atrás do joelho e pés largos com garras (passada do quadril), tronco-prensa chanfrado com peito claro e visor, teto da cor do time, ombros com canhões-prensa (camisa de aço e aríete cromado que recuam) e cilindros de recuo, tambores de munição, fornalha nas costas com chaminés gêmeas em brasa */
    const V = U.vehnar, FO = '#FF7A2E', RED = '#FF4040', HX = -0.25, HY = 6.5, LZ = 2.75;
    for (const s of [-1, 1]) { const z = s * LZ, hip = [HX, HY, z], knee = [1.45, 3.75, z], ank = [0.15, 1.1, z];
      K.cyl(HX, HY, s * 2.0, 0.98, 0.98, 1.5, P.d, 'dark', { rx: s * H, seg: 14 }); K.cyl(HX, HY, s * 3.45, 0.62, 0.7, 0.18, P.b, 'metal', { rx: s * H, seg: 12 });
      K.anim(legSpec(hip, { amp: 0.36, stride: 9.5 }), () => {
        V._viga(K, hip, knee, 1.5, 1.15, 0.3, P.a, 'steel'); V._viga(K, [hip[0] + 0.2, hip[1] - 0.45, z + s * 0.62], [knee[0] - 0.05, knee[1] + 0.75, z + s * 0.62], 1.15, 0.2, 0.08, P.t, 'steel'); K.box((hip[0] + knee[0]) / 2 + 0.1, (hip[1] + knee[1]) / 2 + 0.1, z + s * 0.73, 0.5, 0.9, 0.04, tc, 'paint', { rz: Math.atan2(knee[1] - hip[1], knee[0] - hip[0]) + H });
        K.cyl(knee[0], knee[1], z - 0.72, 0.75, 0.75, 1.44, P.d, 'dark', { rx: H, seg: 12 });
        V._cb(K, knee[0] + 0.55, knee[1] - 0.95, z, 0.6, 1.95, 1.4, 0.16, P.t, 'steel', { rz: 0.12 }); V._haz(K, P, knee[0] + 0.88, knee[1] - 0.25, z, 1.2, 0.6, 3, 'fz', { rz: 0.12, order: 'ZXY' });
        V._viga(K, knee, ank, 1.25, 1.05, 0.25, P.b, 'steel'); V._viga(K, [knee[0] + 0.1, knee[1] - 1.0, z], [ank[0] + 0.55, ank[1] + 0.45, z], 0.3, 1.25, 0.08, P.a, 'steel'); V._pistao(K, P, [HX - 0.75, HY - 0.75, z], [ank[0] - 0.55, ank[1] + 1.1, z], 0.26);
        K.cyl(ank[0], ank[1], z - 0.65, 0.55, 0.55, 1.3, P.d, 'dark', { rx: H, seg: 10 }); K.cyl(knee[0], knee[1], z + s * 0.72, 0.42, 0.5, 0.14, P.t, 'metal', { rx: s * H, seg: 10 });
        for (const dz of [-0.55, 0.55]) V._pistao(K, P, [ank[0] + 0.45, ank[1] + 0.9, z + dz], [1.35, 0.95, z + dz], 0.12, { seg: 8 });
        V._cb(K, 0.35, 0.02, z, 3.4, 0.75, 2.15, 0.22, P.d, 'dark'); V._cb(K, 0.2, 0.72, z, 2.3, 0.55, 1.65, 0.16, P.a, 'steel');
        for (const dz of [-0.58, 0.58]) V._cb(K, 2.22, 0.1, z + dz, 0.9, 0.5, 0.72, 0.12, P.b, 'steel', { rz: 0.16 }); V._cb(K, -1.7, 0.08, z, 0.8, 0.52, 1.0, 0.1, P.b, 'steel', { rz: -0.15 });
        K.fine(() => { for (const p of [[0.5, 5.0], [0.95, 2.4]]) for (const dz of [-0.4, 0.4]) K.box(p[0], p[1], z + dz, 0.12, 0.12, 0.08, P.d, 'metal'); K.tube([[HX + 0.3, HY - 0.2, z + s * 0.55], [1.2, 4.6, z + s * 0.6], [1.05, 2.9, z + s * 0.5]], 0.07, P.d, 'rubber', { ts: 8, rs: 4 }); for (let i = 0; i < 4; i++) K.box(-0.6 + i * 0.6, 1.22, z, 0.12, 0.05, 1.5, P.d, 'dark'); }); }); }
    V._cb(K, -0.3, 5.55, 0, 2.6, 1.6, 4.0, 0.3, P.d, 'dark'); V._cb(K, 1.05, 4.9, 0, 0.32, 1.7, 1.9, 0.08, P.b, 'steel', { rz: 0.1 }); V._haz(K, P, 1.24, 5.25, 0, 1.6, 0.5, 3, 'fz', { rz: 0.1, order: 'ZXY' });
    V._cb(K, -0.35, 6.9, 0, 5.3, 3.7, 4.5, 0.55, P.a, 'steel'); V._cb(K, 1.95, 6.5, 0, 1.0, 1.05, 3.6, 0.2, P.a, 'steel', { rz: -0.25 });
    for (const s of [-1, 1]) { V._cb(K, -0.6, 6.95, s * 2.33, 4.4, 1.2, 0.22, 0.08, P.b, 'steel'); V._cb(K, 0.75, 4.95, s * 1.55, 1.0, 1.55, 0.22, 0.08, P.b, 'steel', { rz: 0.12 }); V._cb(K, -0.6, 10.05, s * 2.95, 1.2, 0.12, 1.2, 0.04, tc, 'paint'); }
    K.cyl(0.5, 10.85, -0.9, 0.55, 0.6, 0.28, P.b, 'steel', { seg: 12 }); K.cyl(-1.2, 10.85, 0.95, 0.18, 0.22, 0.75, P.d, 'dark', { seg: 8 });
    K.anim({ t: 'spin', p: [-1.2, 11.6, 0.95], speed: 1.6 }, () => { V._cb(K, -1.2, 11.55, 0.95, 0.35, 0.5, 1.5, 0.06, P.t, 'steel'); K.box(-1.0, 11.62, 0.95, 0.04, 0.36, 1.2, P.d, 'dark'); });
    V._cb(K, 2.25, 7.4, 0, 1.0, 2.6, 3.2, 0.3, P.t, 'steel', { rz: 0.12 }); K.box(2.75, 8.85, 0, 0.12, 0.36, 2.3, P.g, 'glass', { pat: 0, rz: 0.12 });
    V._cb(K, -0.6, 10.55, 0, 3.9, 0.36, 3.5, 0.12, tc, 'paint');
    for (const s of [-1, 1]) { const zc = s * 3.32;
      V._cb(K, 0.15, 8.15, s * 2.95, 2.9, 1.9, 1.35, 0.28, P.b, 'steel'); K.box(0.15, 8.45, s * 3.64, 2.3, 1.0, 0.06, tc, 'paint');
      K.cyl(0.55, 9.6, zc, 0.7, 0.7, 3.1, P.b, 'steel', { rz: -H, seg: 18 }); K.cyl(3.5, 9.6, zc, 0.78, 0.78, 0.35, P.d, 'dark', { rz: -H, seg: 18 }); V._cb(K, 2.0, 8.7, zc, 2.2, 0.5, 1.0, 0.1, P.d, 'dark'); V._haz(K, P, 2.05, 10.31, zc, 1.6, 0.6, 3, 'tx');
      K.anim({ t: 'recoil', dist: 1.15 }, () => { K.cyl(3.6, 9.6, zc, 0.44, 0.44, 3.0, P.t, 'gloss', { rz: -H, seg: 16 }); V._cb(K, 7.0, 9.0, zc, 0.95, 1.2, 1.2, 0.2, P.d, 'dark'); K.cyl(7.47, 9.6, zc, 0.26, 0.26, 0.04, '#0B0B0E', 'dark', { rz: -H, seg: 8 }); K.fine(() => { for (const dy of [-0.34, 0.34]) K.box(7.0, 9.6 + dy - 0.06, zc, 0.6, 0.12, 1.24, '#141519', 'dark'); }); });
      V._pistao(K, P, [0.7, 10.45, zc], [3.3, 10.45, zc], 0.17); K.cyl(-0.65, 8.85, s * 3.62, 0.72, 0.72, 0.55, P.b, 'metal', { rx: s * H, seg: 14 }); K.cyl(-0.65, 8.85, s * 3.79, 0.74, 0.74, 0.2, P.h, 'paint', { rx: s * H, seg: 14 });
      K.cyl(2.2, 10.15, s * 1.75, 0.2, 0.22, 0.38, P.d, 'dark', { rz: -H, seg: 8 }); K.cyl(2.56, 10.15, s * 1.75, 0.17, 0.17, 0.04, P.l, null, { e: 2.4, rz: -H, seg: 8 });
      V._escape(K, P, -2.65, 9.6, s * 1.45, 2.0, 0.32); }
    V._cb(K, -3.3, 7.35, 0, 0.9, 2.3, 3.0, 0.2, P.d, 'dark'); K.box(-3.78, 7.7, 0, 0.05, 1.55, 2.3, FO, null, { e: 1.3 });
    for (let i = 0; i < (K.lite ? 3 : 6); i++) K.box(-3.84, K.lite ? 7.85 + i * 0.5 : 7.78 + i * 0.25, 0, 0.08, 0.12, 2.5, P.b, 'metal');
    K.light(-1.5, 10.9, 0, 0.25, RED, 2.4);
    K.anim({ t: 'sway', p: [-2.3, 10.9, -0.6], amp: 0.12, speed: 2.2 }, () => K.seg([-2.3, 10.9, -0.6], [-2.5, 13.0, -0.6], 0.04, P.d, 'metal', { seg: 5 }));
    K.fine(() => { for (let i = 0; i < 3; i++) K.box(2.86, 8.4 + i * 0.3, 0, 0.06, 0.06, 2.4, P.d, 'metal', { rz: 0.12 }); for (const s of [-1, 1]) { for (let i = 0; i < 4; i++) K.box(-2.0 + i * 0.85, 7.5, s * 2.27, 0.5, 1.6, 0.05, P.d, 'dark'); K.seg([-3.0, 8.0, s * 1.2], [-3.0, 10.3, s * 1.2], 0.05, P.h, 'paint', { seg: 4 }); K.tube([[-1.2, 9.4, s * 2.3], [-0.6, 9.9, s * 2.9], [0.4, 9.95, s * 3.0]], 0.09, P.d, 'rubber', { ts: 8, rs: 4 }); }
      for (let i = 0; i < 5; i++) K.box(-3.0, 8.2 + i * 0.42, 0, 0.06, 0.05, 2.2, P.h, 'paint'); }); },
};
U.erevane = {
  /* ---------- 4.3e — Infantaria Erevane (o jogo desenha cada unidade como um esquadrão de três figuras): soldado esguio de pernas digitígradas,
     armadura facetada grafite em camadas (placas brilhantes sobre um núcleo escuro), traje de pele iridescente (cor por faceta: teal → índigo → violeta → magenta),
     capacete varrido para trás em duas metades (largo na viseira, fecha em ponta atrás) com viseira fumê e fenda violeta, ombreiras em lâminas e coroa da cor
     do time, fios teal. Frente em +x, chão em y = 0, direita em +z. Versão leve (K.lite): as mesmas massas e cores sem chanfros, camadas, juntas nem mãos
     (o traje fica sob as placas); miúdos em K.fine ---------- */
  _lp(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }, /* ponto entre a e b */
  _qd(a, b, roll) { const Y = new T.Vector3(0, 1, 0), q = new T.Quaternion().setFromUnitVectors(Y, new T.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize()); if (roll) q.multiply(new T.Quaternion().setFromAxisAngle(Y, roll)); return q; }, /* leva +y para a direção a → b; roll gira as facetas em volta do eixo */
  _pr(K, a, b, r, n, col, mat, o) { return K.prism(a[0], a[1], a[2], r, Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), n, col, mat, Object.assign({ q: U.erevane._qd(a, b, o && o.roll) }, o)); }, /* prisma facetado de a até b (o.top afina a ponta, o.sx/o.sz achatam a seção) */
  _iri(K, f, d, pal) { /* pele iridescente na última peça (difração estrutural, como besouro): a cor de cada faceta segue a direção dela (d = pesos x, y, z e |z|); f escurece; pal = quatro tons (padrão: teal, índigo, violeta, magenta) */
    const p = K.main[K.main.length - 1]; if (!p) return; f = f || 1; d = d || [0.3, 0.8, 0, 0.2]; const n = p.geo.attributes.normal, N = n.count, c = new Float32Array(N * 3), S = (pal || ['#1C8C84', '#2A58B4', '#6844C2', '#A0408F']).map(h => new T.Color(h).multiplyScalar(f));
    for (let i = 0; i < N; i++) { let t = 0.5 - 0.5 * (n.getX(i) * d[0] + n.getY(i) * d[1] + n.getZ(i) * d[2]) + d[3] * Math.abs(n.getZ(i)); t = Math.max(0, Math.min(0.999, t)) * 3; const j = Math.floor(t), w = t - j, A = S[j], B = S[j + 1]; c[i * 3] = A.r + (B.r - A.r) * w; c[i * 3 + 1] = A.g + (B.g - A.g) * w; c[i * 3 + 2] = A.b + (B.b - A.b) * w; }
    p.geo.setAttribute('color', new T.BufferAttribute(c, 3)); p.c = new T.Color(1, 1, 1); },
  _corpo(K, P, tc) { /* corpo sem braços: pernas digitígradas (coxa para a frente, joelho alto, canela para trás até o calcanhar suspenso, tarso e pé de lâmina; a perna toda balança no quadril), bacia, cintura de traje, couraça em V, flancos, gola, pescoço e ombreiras da cor do time */
    const E = U.erevane, lp = E._lp, L = K.lite, SK = [0.32, 0.2], TP = (pts, y, th, col, mat, o) => E._tp(K, pts, y, th, col, mat, o);
    for (const s of [-1, 1]) { const hip = [0, 4.3, s * 0.42], kn = [0.6, 2.62, s * 0.48], an = [-0.34, 1.06, s * 0.47], ft = [0.2, 0.22, s * 0.46];
      K.anim(legSpec(hip, { amp: 0.46, stride: 10 }), () => {
        if (!L) { K.seg(hip, kn, 0.25, '#FFFFFF', SK, { seg: 6, flat: true, pat: 0 }); E._iri(K); K.seg(kn, an, 0.18, '#FFFFFF', SK, { seg: 5, flat: true, pat: 0 }); E._iri(K); } /* coxa e canela de traje (na leve ficam sob as placas) */
        E._pr(K, lp(hip, kn, L ? 0 : 0.08), lp(hip, kn, L ? 1 : 0.86), 0.41, 5, P.a, 'gloss', { top: 0.66, sz: 0.88 }); /* coxote */
        E._pr(K, lp(kn, an, L ? 0 : 0.08), lp(kn, an, L ? 1 : 0.84), 0.31, 4, P.a, 'gloss', { top: 0.62, roll: PI / 4 }); /* caneleira */
        E._pr(K, an, ft, 0.15, L ? 4 : 5, P.b, 'gloss', { top: 0.8 }); /* tarso */
        K.poly([[-0.12, 0], [1.0, 0], [1.16, 0.07], [0.6, 0.3], [0.2, 0.42], [-0.06, 0.3]], 0.34, P.a, 'gloss', { x: ft[0] - 0.2, z: ft[2], b: L ? 0 : 0.05 }); /* pé de lâmina */
        K.fine(() => { K.oct(kn[0] + 0.12, kn[1] - 0.32, kn[2], 0.24, 0.64, P.b, 'gloss'); K.oct(an[0], an[1] - 0.2, an[2], 0.16, 0.4, P.d, 'metal'); K.light(kn[0] + 0.33, kn[1] - 0.04, kn[2], 0.08, P.c, 2.2); K.cone(ft[0] + 1.02, 0.03, ft[2], 0.06, 0.26, P.t, 'metal', { rz: -H, seg: 5 });
          K.seg([0.06, 3.95, s * 0.79], [0.5, 2.95, s * 0.72], 0.025, P.c, null, { e: 2, seg: 4 }); }); /* joelheira, tornozelo, luz do joelho, esporão de latão, fio teal na coxa */
      });
    }
    K.prism(0, 3.98, 0, 0.62, 0.64, 6, P.b, 'gloss', { sx: 0.8, top: 1.12, ry: PI / 6 }); /* bacia */
    K.prism(0, 4.5, 0, 0.47, 1.0, 6, '#FFFFFF', SK, { sx: 0.85, pat: 0 }); E._iri(K); /* cintura de traje */
    K.prism(0, 5.25, 0, 0.76, 1.6, 6, L ? P.a : P.b, 'gloss', { top: 1.38, sx: 0.76, ry: PI / 6 }); /* tronco: núcleo escuro que alarga para os ombros (na leve, já na cor das placas) */
    K.fine(() => { K.prism(0.04, 4.84, 0, 0.55, 0.26, 6, P.a, 'gloss', { sx: 0.78, top: 1.1, ry: PI / 6 }); K.prism(0.05, 5.12, 0, 0.62, 0.22, 6, P.a, 'gloss', { sx: 0.78, top: 1.1, ry: PI / 6 }); K.prism(0, 4.56, 0, 0.6, 0.08, 6, P.t, 'metal', { sx: 0.84, ry: PI / 6 }); /* gomos do abdome e cinto de latão */
      for (const s of [-1, 1]) { K.poly([[-0.1, 5.52], [0.5, 5.47], [0.95, 5.98], [1.0, 6.55], [0.62, 6.96], [-0.1, 7.0]], 0.16, P.a, 'gloss', { z: s * 0.47, ry: s * 0.5, b: 0.05 }); /* couraça em V (duas placas que se encontram na quilha) */
        K.poly([[-0.62, -0.72], [0.38, -0.72], [0.6, 0.1], [0.48, 0.66], [-0.66, 0.66], [-0.76, 0]], 0.1, P.a, 'gloss', { y: 6.15, z: s * 0.79, rx: s * 0.17, b: 0.04 }); /* flancos */
        K.poly([[0.3, 4.62], [0.62, 4.5], [0.5, 3.75], [0.15, 3.6]], 0.1, P.a, 'gloss', { z: s * 0.5, ry: s * 0.6, b: 0.03 }); K.seg([0.62, 6.2, s * 0.24], [0.5, 6.85, s * 0.42], 0.025, P.c, null, { e: 2, seg: 4 }); } /* faldas nos quadris e fios teal na couraça */
      K.prism(0.02, 6.8, 0, 0.27, 0.62, 6, '#FFFFFF', SK, { top: 0.85, pat: 0 }); E._iri(K); K.prism(0, 6.84, 0, 1.02, 0.18, 6, P.a, 'gloss', { top: 0.7, sx: 0.76, ry: PI / 6 }); K.light(0.93, 6.72, 0, 0.1, P.l, 2.2); }); /* pescoço, gola e joia violeta na quilha */
    for (const s of [-1, 1]) { const M = pts => pts.map(p => [p[0], s * p[1]]); /* ombreiras em lâminas escalonadas: a de cima da cor do time, as de baixo grafite (caem para fora) */
      TP(M([[0.56, -0.34], [0.46, 0.3], [0.02, 0.47], [-0.5, 0.4], [-0.64, 0], [-0.46, -0.34]]), 7.02, 0.12, tc, 'paint', { z: s * 1.0, rx: -H + s * 0.5, b: L ? 0 : 0.07 });
      TP(M([[0.5, -0.26], [0.42, 0.26], [-0.44, 0.26], [-0.52, -0.26]]), 6.74, 0.11, P.a, 'gloss', { z: s * 1.33, rx: -H + s * 0.88, b: L ? 0 : 0.05 });
      K.fine(() => TP(M([[0.42, -0.2], [0.35, 0.2], [-0.38, 0.2], [-0.44, -0.2]]), 6.44, 0.08, P.b, 'gloss', { z: s * 1.5, rx: -H + s * 1.18, b: 0.03 }));
    }
  },
  _elmo(K, P, tc, o) { /* capacete em duas metades facetadas (largo na viseira, fecham em ponta atrás), viseira fumê com fenda violeta que contorna a frente, coroa da cor do time; o.capuz = perfil curto (sob o capuz do atirador), sem coroa */
    o = o || {}; const E = U.erevane, L = K.lite, TP = (pts, y, th, col, mat, oo) => E._tp(K, pts, y, th, col, mat, oo);
    const PF = (o.capuz ? [[0.6, 7.38], [0.76, 7.72], [0.7, 8.22], [0.36, 8.6], [-0.3, 8.7], [-0.8, 8.42], [-0.72, 7.9], [-0.42, 7.55], [0.02, 7.3]] : [[0.6, 7.38], [0.76, 7.72], [0.7, 8.22], [0.36, 8.58], [-0.3, 8.7], [-0.95, 8.54], [-1.18, 8.38], [-0.74, 8.04], [-0.46, 7.6], [0.02, 7.3]]).map(p => [p[0] - 0.5, p[1] - 8.5]);
    if (L) K.poly(PF, 0.7, P.a, 'gloss', { x: 0.5, y: 8.5 }); else for (const s of [-1, 1]) K.poly(PF, 0.34, P.a, 'gloss', { x: 0.5, y: 8.5, z: s * 0.2, ry: -s * 0.15, rx: s * 0.14, b: 0.07 }); /* casco: as metades fecham atrás e no queixo (rosto em V) */
    if (!L) TP([[0.9, 0], [0.74, 0.36], [0.34, 0.46], [0.02, 0.45], [0.02, -0.45], [0.34, -0.46], [0.74, -0.36]], 7.95, 0.26, P.g, 'glass'); /* viseira fumê */
    TP([[0.93, 0], [0.77, 0.39], [0.36, 0.49], [0.12, 0.48], [0.12, -0.48], [0.36, -0.49], [0.77, -0.39]], 7.97, 0.05, P.l, null, { e: 2.4 }); /* fenda violeta */
    if (!o.capuz) K.poly([[0.5, 8.34], [0.38, 8.62], [-0.3, 8.78], [-0.85, 8.62], [-1.04, 8.48], [-0.7, 8.44], [-0.3, 8.54], [0.2, 8.44]], 0.32, tc, 'paint', { b: L ? 0 : 0.06 }); /* coroa da cor do time */
    K.fine(() => { for (const s of [-1, 1]) K.light(-0.22, 8.02, s * 0.44, 0.08, P.l, 2.2); /* sensores laterais */
      if (!o.capuz) { K.seg([0.42, 8.66, 0], [-0.3, 8.86, 0], 0.025, P.t, 'metal', { seg: 4 }); K.seg([-0.3, 8.86, 0], [-1.04, 8.56, 0], 0.025, P.t, 'metal', { seg: 4 }); } }); /* friso de latão na crista */
  },
  _braco(K, P, S, Eb, M) { /* braço: traje iridescente, bíceps e antebraço facetados, cotovelo e mão (S ombro, Eb cotovelo, M mão); na leve, só as duas placas */
    const E = U.erevane, lp = E._lp, L = K.lite;
    if (!L) { K.seg(S, Eb, 0.17, '#FFFFFF', [0.32, 0.2], { seg: 6, flat: true, pat: 0 }); E._iri(K); }
    E._pr(K, lp(S, Eb, L ? 0 : 0.2), lp(S, Eb, L ? 1 : 0.88), 0.25, L ? 4 : 5, P.a, 'gloss', { top: 0.78 });
    E._pr(K, lp(Eb, M, L ? 0 : 0.06), lp(Eb, M, L ? 1 : 0.86), 0.26, L ? 4 : 5, P.a, 'gloss', { top: 0.68 });
    K.fine(() => { K.oct(Eb[0], Eb[1] - 0.16, Eb[2], 0.19, 0.32, P.b, 'gloss'); K.box(M[0], M[1] - 0.13, M[2], 0.28, 0.26, 0.22, P.b, 'gloss'); });
  },
  _fuzil(K, P, B, th) { /* fuzil de fenda: coronha vazada, caixa facetada com trilho teal aceso, carregador, capa sextavada com anéis de latão, cano e boca violeta (B = coronha no ombro, th = inclinação); na leve, um contorno só */
    const L = K.lite, c = Math.cos(th), s = Math.sin(th), W = (u, v) => [B[0] + u * c - v * s, B[1] + u * s + v * c, B[2]];
    const PO = (pts, d, col, mat, o) => K.poly(pts, d, col, mat, Object.assign({ x: B[0], y: B[1], z: B[2], rz: th }, o));
    const XA = (u, r, len, n, col, mat, o) => { const p = W(u, 0); K.prism(p[0], p[1], p[2], r, len, n, col, mat, Object.assign({ rz: th - H }, o)); };
    if (L) { PO([[0, -0.22], [0, 0.1], [1.12, 0.23], [2.5, 0.12], [2.5, -0.12], [1.9, -0.58], [1.62, -0.58], [1.6, -0.17], [1.15, -0.5], [0.9, -0.48], [0.14, -0.22]], 0.2, P.a, 'gloss'); XA(2.45, 0.1, 1.55, 5, P.b, 'gloss'); }
    else { PO([[0, -0.22], [0, 0.1], [0.3, 0.15], [0.98, 0.1], [0.98, -0.05], [0.36, -0.08], [0.14, -0.22]], 0.16, P.b, 'gloss'); /* coronha */
      PO([[0.9, -0.13], [0.9, 0.15], [1.12, 0.23], [2.3, 0.21], [2.52, 0.1], [2.52, -0.1], [1.95, -0.17], [1.0, -0.17]], 0.24, P.a, 'gloss', { b: 0.035 }); /* caixa */
      PO([[1.62, -0.1], [1.92, -0.1], [1.86, -0.58], [1.6, -0.54]], 0.16, P.d, 'dark'); PO([[0.98, -0.12], [1.22, -0.12], [1.1, -0.5], [0.9, -0.48]], 0.14, P.d, 'dark'); /* carregador e empunhadura */
      XA(2.45, 0.11, 1.05, 6, P.b, 'gloss'); XA(3.45, 0.055, 0.55, 6, P.d, 'metal'); } /* capa e cano */
    XA(3.98, 0.08, 0.12, 6, P.l, null, { e: 2.6 }); /* boca violeta */
    const r0 = W(1.7, 0.22); K.box(r0[0], r0[1], r0[2], 1.1, 0.05, 0.07, P.c, null, { e: 2.2, rz: th }); /* trilho teal aceso */
    K.fine(() => { const sg = W(1.3, 0.24); K.box(sg[0], sg[1], sg[2], 0.36, 0.14, 0.14, P.g, 'glass', { rz: th }); for (const u of [2.6, 3.3]) XA(u, 0.125, 0.05, 6, P.t, 'metal'); XA(3.42, 0.075, 0.05, 6, P.t, 'metal'); }); /* mira fumê e anéis de latão */
  },
  _mochila(K, P, tc) { /* gerador de véu nas costas: prisma sextavado escuro, tampa da cor do time, fenda teal acesa, aletas e antena com luz violeta (balança) */
    K.prism(-0.88, 5.15, 0, 0.47, 1.6, 6, P.b, 'gloss', { sx: 0.6, top: 0.86, ry: PI / 6 });
    K.prism(-0.88, 6.75, 0, 0.41, 0.16, 6, tc, 'paint', { sx: 0.6, top: 0.72, ry: PI / 6 });
    K.box(-1.18, 5.35, 0, 0.05, 1.15, 0.16, P.c, null, { e: 2.2 });
    K.fine(() => { for (const s of [-1, 1]) K.poly([[0, 0], [0.36, 0], [-0.22, 0.85], [-0.44, 0.78]], 0.05, P.a, 'gloss', { x: -0.92, y: 5.6, z: s * 0.32, rx: s * 0.3 }); /* aletas */
      for (const y of [5.3, 5.58, 5.86, 6.14]) K.box(-1.12, y, 0, 0.06, 0.05, 0.34, P.d, 'metal', { pat: 0 }); K.prism(-0.88, 6.9, 0, 0.12, 0.1, 6, P.t, 'metal'); });
    U.erevane._antena(K, P, [-1.0, 6.88, -0.2], [-1.28, 8.95, -0.28]);
  },
  infantaria(K, P, tc, o) { /* 4.3e: Infantaria Orbital — fuzil em pronto-baixo (coronha no ombro direito, cano um pouco abaixo da horizontal); braços e fuzil recuam juntos no tiro */
    o = o || {}; const E = U.erevane; K.base = 0; /* pé chanfrado afunda 0,05 no chão: completa e leve na mesma altura */
    E._corpo(K, P, tc); E._elmo(K, P, tc);
    K.anim({ t: 'recoil', dist: 0.3 }, () => { E._braco(K, P, [0.02, 6.62, 0.98], [-0.22, 5.5, 1.04], [0.92, 5.81, 0.52]); E._braco(K, P, [0.02, 6.62, -0.98], [0.95, 5.95, -0.55], [2.03, 5.82, 0.4]); if (!o.noRifle) E._fuzil(K, P, [-0.08, 6.28, 0.46], -0.15); });
    E._mochila(K, P, tc);
  },
  coletor(K, P, tc) { // 4.3: esquife-sifão Erevane — casco facetado flutuante, bico sifão com mandíbulas, cabine de vidro fumê, carga em tanques laterais
    const TP = (pts, y, th, col, mat, o) => K.poly(pts.map(p => [p[0], -p[1]]), th, col, mat, Object.assign({ rx: -H, y }, o)); // placa vista de cima: contorno (x, z), centro em y, espessura th + 2b
    const SYM = h => h.concat(h.filter(p => p[1] !== 0).reverse().map(p => [p[0], -p[1]])); // meio contorno (z >= 0, da frente para trás) -> contorno simétrico
    const XC = (x, y, z, rt, rb, h, col, mat, o) => K.cyl(x, y, z, rt, rb, h, col, mat, Object.assign({ rz: -H }, o)); // cilindro ao longo de +x (base rb em x, topo rt em x + h)
    const XP = (x, y, z, r, h, n, col, mat, o) => K.prism(x, y, z, r, h, n, col, mat, Object.assign({ rz: -H }, o));
    const bolt = (x, y, z) => K.cyl(x, y, z, 0.055, 0.065, 0.05, P.t, 'metal', { seg: 6, pat: 0 });
    const bolt2 = (x, y, z, s) => K.cyl(x, y, z, 0.055, 0.065, 0.05, P.t, 'metal', { seg: 6, pat: 0, rx: s * H }); // parafuso em face lateral
    const vent = (x, y, z, w, h, s, n) => { K.box(x, y, z, w, h, 0.06, P.d, 'dark', { pat: 0 }); for (let i = 0; i < n; i++) K.box(x, y + (i + 0.5) * h / n - 0.025, z + s * 0.035, w * 0.92, 0.05, 0.05, P.b, 'metal', { pat: 0 }); }; // grade lateral com aletas
    const pod = (x, z, r, top) => { // casulo antigravidade: carcaça octogonal, anel de latão, aletas, lente teal embaixo, suporte chanfrado
      K.cyl(x, 0.56, z, r, r * 0.78, top - 0.56, P.d, 'dark', { seg: 8, facet: true });
      K.cyl(x, 0.8, z, r * 1.07, r * 1.07, 0.09, P.t, 'metal', { seg: 8, facet: true });
      for (let i = 0; i < 4; i++) K.box(x, 0.6, z, 0.05, 0.42, r * 2.25, P.b, 'gloss', { ry: i * PI / 4 + PI / 8, pat: 0 });
      K.cyl(x, 0.42, z, r * 0.7, r * 0.5, 0.14, P.c, null, { e: 2.4, seg: 8 });
      K.box(x, top - 0.05, z, r * 1.1, 0.32, r * 0.5, P.b, 'gloss', { b: 0.05, bs: 1 });
    };
    const NY = 1.65; // eixo do bico sifão
    K.anim({ t: 'bob', amp: 0.12, speed: 2.4 }, () => {
      // ---- casco: laje facetada (chanfros de 45°), ventre escuro, quilhas com fio teal ----
      TP(SYM([[4.3, 0], [3.8, 0.75], [2.9, 1.1], [-4.8, 1.1], [-5.3, 0.65]]), 1.55, 0.4, P.b, 'dark', { b: 0.36 }); // chassi acetinado: as placas brilhantes por cima se destacam
      TP(SYM([[3.4, 0], [3.0, 0.55], [-4.5, 0.7], [-4.9, 0.35]]), 0.9, 0.08, P.d, 'dark', { b: 0.05 });
      for (const s of [-1, 1]) { K.poly([[-3.6, 0.95], [2.4, 0.95], [1.7, 0.62], [-3.1, 0.62]], 0.1, P.d, 'dark', { z: s * 0.55 }); K.box(-0.6, 0.6, s * 0.55, 4.4, 0.05, 0.13, P.c, null, { e: 2 }); }
      for (const s of [-1, 1]) TP([[4.15, s * 0.12], [3.75, s * 0.78], [3.3, s * 0.9], [3.62, s * 0.18]], 2.12, 0.03, P.a, 'gloss', { b: 0.03 }); // chevrons do nariz
      // saias laterais inclinadas (perfil local em torno de y = 0) com grades e fio de energia
      for (const s of [-1, 1]) {
        K.poly([[-4.7, -0.3], [3.0, -0.3], [3.5, 0], [3.0, 0.32], [-4.7, 0.32], [-5.0, 0]], 0.12, P.a, 'gloss', { y: 1.52, z: s * 1.52, rx: s * 0.28, b: 0.04 });
        K.box(-0.8, 1.2, s * 1.6, 7.2, 0.06, 0.05, P.c, null, { e: 2.2 });
        vent(1.5, 1.36, s * 1.66, 1.1, 0.34, s, 3); vent(-3.6, 1.36, s * 1.66, 0.9, 0.34, s, 3);
      }
      // ---- queixo e faróis ----
      K.poly([[3.2, 0.95], [4.2, 1.05], [4.75, 1.35], [4.6, 1.5], [3.2, 1.5]], 1.5, P.d, 'dark', { b: 0.06 });
      for (const s of [-1, 1]) { XC(4.15, 1.72, s * 0.78, 0.14, 0.16, 0.3, P.t, 'metal', { seg: 8 }); K.box(4.44, 1.64, s * 0.78, 0.04, 0.16, 0.2, P.l, null, { e: 3 }); }
      // ---- cabine: carenagem com juntas, tomadas de ar, aro de latão, vidro fumê facetado com montantes, periscópio ----
      TP(SYM([[3.9, 0], [3.2, 0.62], [1.4, 0.88], [-0.8, 0.88], [-1.1, 0.5]]), 2.3, 0.2, P.a, 'gloss', { b: 0.22 });
      for (const s of [-1, 1]) { K.box(3.15, 2.6, s * 0.72, 0.5, 0.04, 0.05, P.d, 'metal', { ry: s * 0.6 }); K.box(-0.55, 2.6, s * 0.6, 0.05, 0.04, 0.5, P.d, 'metal'); bolt(3.45, 2.6, s * 0.3); bolt(-0.9, 2.6, s * 0.3); }
      TP(SYM([[3.05, 0], [2.45, 0.52], [0.3, 0.64], [-0.4, 0.38]]), 2.66, 0.04, P.t, 'metal', { b: 0.03 });
      TP(SYM([[2.8, 0], [2.25, 0.36], [0.4, 0.44], [-0.1, 0.24]]), 2.97, 0.22, P.g, 'glass', { b: 0.26 });
      K.box(1.3, 3.33, 0, 2.7, 0.04, 0.14, P.d, 'metal', { pat: 0 }); K.box(1.3, 3.36, 0, 2.4, 0.03, 0.06, P.l, null, { e: 2.2 }); for (const [x, w] of [[0.55, 0.82], [1.75, 0.72]]) K.box(x, 3.33, 0, 0.08, 0.04, w, P.d, 'metal', { pat: 0 }); // montantes sobre a face de cima do vidro (y 3.34)
      for (const s of [-1, 1]) { TP([[0.9, s * 0.9], [0.5, s * 1.12], [-0.7, s * 1.12], [-0.9, s * 0.9]], 2.42, 0.2, P.d, 'dark', { b: 0.05 }); for (let i = 0; i < 3; i++) K.box(0.2 - i * 0.35, 2.58, s * 1.0, 0.1, 0.06, 0.22, P.b, 'metal'); }
      K.light(3.55, 2.5, 0, 0.12, P.l);
      for (const s of [-1, 1]) { K.box(0.25, 2.1, s * 1.1, 2.6, 0.06, 0.05, P.c, null, { e: 2.2 }); K.box(2.35, 2.1, s * 1.02, 1.9, 0.06, 0.05, P.c, null, { e: 2.2, ry: s * 0.14 }); K.box(3.72, 2.1, s * 0.52, 1.0, 0.06, 0.05, P.c, null, { e: 2.2, ry: s * 0.73 }); }
      K.cyl(-0.75, 2.6, 0.42, 0.16, 0.2, 0.24, P.b, 'gloss', { seg: 8 }); K.sph(-0.75, 2.84, 0.42, 0.13, P.g, 'glass', { half: true, seg: 8 });
      // ---- bico sifão: carcaça octogonal, colar de latão, cano com bobinas teal e anéis, cabeça emissora ----
      XP(3.75, NY, 0, 0.62, 0.85, 8, P.a, 'gloss', { top: 0.78 });
      XC(4.6, NY, 0, 0.5, 0.5, 0.12, P.t, 'metal', { seg: 8, facet: true });
      XC(4.72, NY, 0, 0.17, 0.3, 1.3, P.b, 'gloss', { seg: 10 });
      for (const [x, r] of [[4.95, 0.33], [5.65, 0.24]]) XC(x, NY, 0, r, r, 0.08, P.t, 'metal', { seg: 10 });
      for (const [x, r] of [[5.18, 0.3], [5.4, 0.28]]) XC(x, NY, 0, r, r, 0.07, P.c, null, { e: 2.4, seg: 8 });
      for (const a of [0, H]) K.box(5.3, NY - 0.02, 0, 0.75, 0.04, 0.78, P.d, 'metal', { rx: a });
      XP(6.0, NY, 0, 0.2, 0.2, 6, P.d, 'dark', { top: 1.35 });
      XC(6.18, NY, 0, 0.24, 0.24, 0.03, P.c, null, { e: 2.6, seg: 8 });
      for (let i = 0; i < 3; i++) { const a = i * 2 * PI / 3 + H; K.seg([5.95, NY + Math.sin(a) * 0.24, Math.cos(a) * 0.24], [6.3, NY + Math.sin(a) * 0.3, Math.cos(a) * 0.3], 0.03, P.t, 'metal', { seg: 6 }); }
      K.cone(6.15, NY, 0, 0.15, 0.27, P.l, null, { e: 3, rz: -H, seg: 8 });
      K.beam = [6.42, NY, 0];
      // mandíbulas do sifão: lâminas com fio de latão, pistões e ponta acesa
      for (const s of [-1, 1]) {
        TP([[3.4, s * 1.0], [4.5, s * 1.22], [6.1, s * 0.6], [6.0, s * 0.44], [4.4, s * 0.7], [3.4, s * 0.62]], NY + 0.12, 0.14, P.a, 'gloss', { b: 0.06 });
        K.seg([4.5, NY + 0.24, s * 1.24], [6.08, NY + 0.24, s * 0.6], 0.035, P.t, 'metal', { seg: 6 });
        K.box(4.4, NY + 0.27, s * 0.78, 1.4, 0.03, 0.05, P.c, null, { e: 2.4, ry: s * 0.36 });
        K.seg([3.5, NY - 0.12, s * 0.62], [4.9, NY - 0.02, s * 0.6], 0.06, P.d, 'metal', { seg: 6 }); K.seg([4.2, NY - 0.09, s * 0.61], [5.0, NY - 0.02, s * 0.6], 0.035, P.t, 'metal', { seg: 6 });
        K.light(6.0, NY + 0.1, s * 0.52, 0.14, P.l);
      }
      // ---- asas dianteiras: placa enflechada, painel interno com grade, faixa do time, bordo de latão, casulo ----
      for (const s of [-1, 1]) {
        TP([[3.5, s * 1.0], [1.7, s * 2.75], [0.3, s * 2.8], [-0.3, s * 1.0]], 1.6, 0.12, P.a, 'gloss', { b: 0.14 });
        TP([[3.0, s * 1.2], [1.6, s * 2.5], [1.0, s * 2.52], [2.35, s * 1.2]], 1.85, 0.03, tc, 'paint', { b: 0.02 });
        TP([[1.9, s * 1.2], [0.75, s * 2.35], [0.35, s * 2.4], [0.1, s * 1.2]], 1.84, 0.03, P.b, 'gloss', { b: 0.02 });
        for (let i = 0; i < 3; i++) K.box(0.75 - i * 0.22, 1.89, s * 1.75, 0.09, 0.04, 0.7, P.d, 'metal', { pat: 0 });
        TP([[3.58, s * 0.98], [1.74, s * 2.83], [1.6, s * 2.8], [3.4, s * 0.98]], 1.82, 0.04, P.t, 'metal', { b: 0.02 });
        bolt(2.55, 1.88, s * 1.35); bolt(1.35, 1.88, s * 2.35); bolt(0.4, 1.79, s * 2.55);
        K.light(1.62, 1.66, s * 2.86, 0.14, P.l);
        pod(1.2, s * 2.15, 0.62, 1.42);
      }
      // ---- caçamba central: placas da cor do time com parafusos, cintas, trilhos, canal de carga aceso, grades ----
      TP(SYM([[-0.5, 0.75], [-0.9, 1.0], [-4.6, 1.0]]), 2.6, 0.6, P.a, 'gloss', { b: 0.25 });
      for (const s of [-1, 1]) for (const [x0, x1] of [[-1.0, -2.6], [-2.82, -4.4]]) { TP([[x0, s * 0.22], [x0 - 0.2, s * 0.84], [x1, s * 0.84], [x1, s * 0.22]], 3.24, 0.08, tc, 'paint', { b: 0.05 }); bolt(x0 - 0.22, 3.32, s * 0.36); bolt(x1 + 0.14, 3.32, s * 0.36); bolt(x1 + 0.14, 3.32, s * 0.7); }
      K.box(-2.7, 3.1, 0, 3.6, 0.12, 0.36, P.d, 'dark');
      for (let i = 0; i < 4; i++) K.box(-1.32 - i * 0.84, 3.17, 0, 0.6, 0.06, 0.2, P.c, null, { e: 2.2 });
      for (const x of [-0.78, -2.71]) { K.box(x, 3.12, 0, 0.16, 0.2, 2.3, P.d, 'metal'); for (const s of [-1, 1]) K.box(x, 2.15, s * 1.27, 0.16, 1.1, 0.07, P.d, 'metal'); }
      for (const s of [-1, 1]) { K.seg([-0.7, 3.24, s * 1.12], [-4.55, 3.24, s * 1.12], 0.05, P.t, 'metal', { seg: 6 }); vent(-1.75, 2.25, s * 1.28, 0.8, 0.5, s, 4); vent(-3.65, 2.25, s * 1.28, 0.8, 0.5, s, 4); }
      // ---- tanques de carga laterais: casco sextavado, placas nas faces, tampas, faixas do time, visor de carga, braçadeiras ----
      for (const s of [-1, 1]) {
        const z = s * 2.45, cy = 2.0, r = 0.8;
        XP(-5.0, cy, z, r, 4.4, 6, P.a, 'gloss');
        for (const k of [-1, 1]) { K.box(-2.9, cy + 0.433 * r, z + k * 0.75 * r, 2.1, 0.05, r * 0.72, P.b, 'gloss', { rx: k * PI / 3 }); K.box(-2.9, cy - 0.433 * r, z + k * 0.75 * r, 2.1, 0.05, r * 0.72, P.b, 'gloss', { rx: k * 2 * PI / 3 }); }
        XP(-0.6, cy, z, r, 0.5, 6, P.b, 'gloss', { top: 0.58 }); XC(-0.62, cy, z, 0.84, 0.84, 0.08, P.t, 'metal', { seg: 6 }); K.light(-0.06, cy, z, 0.16, P.l);
        XP(-5.4, cy, z, 0.6, 0.4, 6, P.d, 'dark', { top: 1.33 }); XC(-5.08, cy, z, 0.84, 0.84, 0.08, P.t, 'metal', { seg: 6 }); XC(-5.43, cy, z, 0.3, 0.3, 0.03, P.l, null, { e: 2, seg: 6 });
        for (const x of [-4.4, -1.6]) { XP(x, cy, z, 0.86, 0.34, 6, tc, 'paint'); bolt(x + 0.17, cy + 0.745, z); }
        K.box(-2.9, cy + 0.69, z, 2.0, 0.06, 0.28, P.c, null, { e: 2.2 }); K.box(-2.9, cy + 0.68, z, 2.2, 0.05, 0.42, P.d, 'metal'); for (const x of [-3.42, -2.9, -2.38]) K.box(x, cy + 0.69, z, 0.07, 0.09, 0.4, P.d, 'metal', { pat: 0 });
        for (const x of [-4.0, -1.8]) { K.box(x, cy - 0.3, s * 1.62, 0.5, 0.5, 0.62, P.d, 'metal', { b: 0.06, bs: 1 }); K.box(x, cy + 0.05, s * 1.6, 0.34, 0.14, 0.8, P.b, 'metal'); bolt(x, cy + 0.19, s * 1.4); }
        pod(-2.9, z, 0.66, 1.42);
      }
      // ---- motor traseiro: convés inclinado rente à caçamba, bocais violeta, grade de exaustão, lemes em V da cor do time ----
      K.poly([[-5.9, 1.1], [-4.5, 1.1], [-4.5, 3.03], [-5.15, 3.03], [-5.95, 2.3]], 2.4, P.a, 'gloss', { b: 0.16 });
      K.poly([[-5.95, 2.2], [-5.2, 2.95], [-5.12, 3.0], [-5.9, 2.25]], 1.6, P.b, 'gloss', { b: 0.04, x: -0.07, y: 0.09 });
      K.box(-6.1, 2.0, 0, 0.06, 0.07, 2.0, tc, null, { e: 2.4 }); for (const s of [-1, 1]) K.light(-6.06, 2.35, s * 1.05, 0.13, P.l);
      K.box(-6.1, 1.35, 0, 0.06, 0.55, 0.55, P.d, 'dark', { pat: 0 }); for (let i = 0; i < 3; i++) K.box(-6.14, 1.42 + i * 0.16, 0, 0.04, 0.05, 0.5, P.b, 'metal', { pat: 0 });
      for (const s of [-1, 1]) { XC(-6.35, 1.7, s * 0.6, 0.27, 0.33, 0.4, P.d, 'dark', { seg: 8 }); XC(-6.12, 1.7, s * 0.6, 0.35, 0.35, 0.06, P.t, 'metal', { seg: 8 }); XC(-6.37, 1.7, s * 0.6, 0.24, 0.24, 0.03, P.l, null, { e: 2.2, seg: 6 }); vent(-5.3, 1.5, s * 1.37, 0.8, 0.6, s, 4); }
      K.box(-4.62, 3.12, 0, 0.16, 0.12, 2.3, P.d, 'metal');
      for (const s of [-1, 1]) { K.poly([[-5.75, 2.25], [-4.65, 2.25], [-4.65, 2.85], [-5.2, 2.85], [-5.6, 2.55]], 0.06, P.b, 'gloss', { z: s * 1.37, b: 0.02 }); bolt2(-4.85, 2.7, s * 1.42, s); bolt2(-5.35, 2.4, s * 1.42, s); K.seg([-4.9, 3.24, s * 0.35], [-5.3, 3.24, s * 0.35], 0.03, P.t, 'metal', { seg: 6 }); }
      for (let i = 0; i < 5; i++) K.box(-4.8 - i * 0.14, 3.15, 0, 0.07, 0.05, 1.1, P.d, 'metal', { pat: 0 });
      for (const s of [-1, 1]) {
        K.poly([[-5.6, 0], [-4.55, 0], [-5.3, 0.85], [-5.75, 0.85]], 0.08, P.a, 'gloss', { y: 3.1, z: s * 0.8, rx: s * 0.4, b: 0.03 });
        K.poly([[-5.45, 0.12], [-4.85, 0.12], [-5.3, 0.62], [-5.6, 0.62]], 0.02, tc, 'paint', { y: 3.13, z: s * 0.726, rx: s * 0.4, b: 0.02 }); // na face interna (vista de cima)
        K.seg([-4.55, 3.12, s * 0.8], [-5.3, 3.12 + 0.88 * Math.cos(0.4), s * (0.8 + 0.88 * Math.sin(0.4))], 0.04, tc, null, { e: 2.4, seg: 6 });
      }
      // mastros de sensor
      K.seg([-0.4, 2.6, -0.62], [-0.8, 4.0, -0.62], 0.05, P.d, 'metal', { seg: 6 }); K.light(-0.8, 4.0, -0.62, 0.14, P.l);
      K.seg([-5.0, 3.1, 0], [-5.3, 3.75, 0], 0.035, P.d, 'metal', { seg: 6 }); K.light(-5.3, 3.75, 0, 0.1, P.c);
    });
    K.box(-1, 0, 0, 0.08, 0.004, 0.08, P.d, 'dark', { pat: 0 }); // âncora no chão (escondida): mantém o vão de flutuação
  },
  /* ---------- 4.3d — Frota Erevane: ajudantes da Raça (nome com _ = ajudante, não é unidade). Mesma linguagem do coletor 4.3a: chapas facetadas em camadas
     (chassi acetinado escuro, placas brilhantes por cima), frisos de latão, vidro fumê, fios teal emissivos, luzes violeta e casulos antigravidade.
     Versão leve (K.lite): chapas finas sem chanfro, casulos e bocais sem anel nem aletas, detalhe miúdo em K.fine ---------- */
  _tp(K, pts, y, th, col, mat, o) { if (K.lite && o && o.b && th <= 0.06) { const b = o.b; o = Object.assign({}, o, { b: 0 }); y += b / 2; th += b; } return K.poly(pts.map(p => [p[0], -p[1]]), th, col, mat, Object.assign({ rx: -H, y }, o)); }, /* placa vista de cima: contorno (x, z), centro em y, espessura th + 2b (na leve, chapa fina sem chanfro com o mesmo topo) */
  _sym(h) { return h.concat(h.filter(p => p[1] !== 0).reverse().map(p => [p[0], -p[1]])); }, /* meio contorno (z >= 0, da frente para trás) -> contorno simétrico */
  _xc(K, x, y, z, rt, rb, h, col, mat, o) { return K.cyl(x, y, z, rt, rb, h, col, mat, Object.assign({ rz: -H }, o)); }, /* cilindro ao longo de +x (base rb em x, topo rt em x + h) */
  _xp(K, x, y, z, r, h, n, col, mat, o) { return K.prism(x, y, z, r, h, n, col, mat, Object.assign({ rz: -H }, o)); },
  _zc(K, x, y, z, r, w, col, mat, o) { return K.cyl(x, y, z - w / 2, r, r, w, col, mat, Object.assign({ rx: H }, o)); }, /* disco ou eixo ao longo de z, centrado em z */
  _bolt(K, P, x, y, z, s) { K.fine(() => K.cyl(x, y, z, 0.055, 0.065, 0.05, P.t, 'metal', { seg: 6, pat: 0, rx: s ? s * H : 0 })); }, /* parafuso (s = ±1: em face lateral ±z) */
  _vent(K, P, x, y, z, w, h, s, n) { K.box(x, y, z, w, h, 0.06, P.d, 'dark', { pat: 0 }); K.fine(() => { for (let i = 0; i < n; i++) K.box(x, y + (i + 0.5) * h / n - 0.025, z + s * 0.035, w * 0.92, 0.05, 0.05, P.b, 'metal', { pat: 0 }); }); }, /* grade lateral com aletas */
  _ventT(K, P, x, y, z, w, d, n) { K.box(x, y, z, w, 0.04, d, P.d, 'dark', { pat: 0 }); K.fine(() => { for (let i = 0; i < n; i++) K.box(x - w / 2 + (i + 0.5) * w / n, y + 0.03, z, 0.05, 0.05, d * 0.9, P.b, 'metal', { pat: 0 }); }); }, /* grade no tampo */
  _seam(K, P, x, y, z, w, d) { K.fine(() => K.box(x, y, z, w, 0.015, d, P.d, 'metal', { pat: 0 })); }, /* junta de painel (friso escuro) */
  _pod(K, P, x, y0, z, r, top) { /* casulo antigravidade (o do coletor): lente teal embaixo (y0), carcaça octogonal até top; na completa, anel de latão, aletas e suporte */
    K.cyl(x, y0 + 0.14, z, r, r * 0.78, top - y0 - 0.14, P.d, 'dark', { seg: K.lite ? 6 : 8, facet: true });
    K.cyl(x, y0, z, r * 0.7, r * 0.5, 0.14, P.c, null, { e: 2.4, seg: 8 });
    K.fine(() => { K.cyl(x, y0 + 0.38, z, r * 1.07, r * 1.07, 0.09, P.t, 'metal', { seg: 8, facet: true }); for (let i = 0; i < 4; i++) K.box(x, y0 + 0.18, z, 0.05, 0.42, r * 2.25, P.b, 'gloss', { ry: i * PI / 4 + PI / 8, pat: 0 }); K.box(x, top - 0.28, z, r * 1.1, 0.32, r * 0.5, P.b, 'gloss', { b: 0.05, bs: 1 }); });
  },
  _bocal(K, P, x, y, z, r) { const E = U.erevane; E._xc(K, x, y, z, r * 0.82, r, 0.42, P.d, 'dark', { seg: 8 }); E._xc(K, x - 0.03, y, z, r * 0.72, r * 0.72, 0.03, P.l, null, { e: 2.4, seg: 6 }); K.fine(() => E._xc(K, x + 0.24, y, z, r * 1.06, r * 1.06, 0.07, P.t, 'metal', { seg: 8 })); }, /* bocal traseiro (voltado para -x): carcaça, disco violeta, anel de latão */
  _antena(K, P, a, b, col) { K.anim({ t: 'sway', p: a, amp: 0.1, speed: 2.4, ph: a[0] + a[2] }, () => { K.seg(a, b, 0.03, P.d, 'metal', { seg: 5 }); K.light(b[0], b[1] - 0.05, b[2], 0.1, col || P.l); }); }, /* antena fina que balança, com luz na ponta */
  veiculo_hull(K, P, tc) { /* 4.3d: tanque flutuante — casco em cunha facetado em camadas, convés com anel da torre, faixas do time nas bordas, para-lamas angulares com casulos antigravidade (balançam como suspensão), queixo com faróis violeta, motor traseiro duplo */
    const E = U.erevane, TP = (pts, y, th, col, mat, o) => E._tp(K, pts, y, th, col, mat, o), SYM = E._sym, XC = (...a) => E._xc(K, ...a);
    K.box(0, 0, 0, 0.08, 0.004, 0.08, P.d, 'dark', { pat: 0 }); /* âncora no chão (escondida): mantém o vão de flutuação igual nas duas versões */
    /* ventre, quilha, chassi acetinado, casco superior brilhante e convés */
    TP(SYM([[5.4, 0], [4.2, 1.5], [-5.0, 1.9], [-5.8, 1.2], [-5.9, 0]]), 1.0, 0.14, P.d, 'dark', { b: 0.05 });
    for (const s of [-1, 1]) K.box(-0.3, 0.84, s * 1.7, 8.4, 0.05, 0.06, P.c, null, { e: 2.2 });
    TP(SYM([[7.0, 0], [6.2, 0.9], [4.4, 2.3], [3.0, 2.8], [-5.4, 2.8], [-6.4, 2.2], [-6.6, 0]]), 1.5, 0.5, P.b, 'dark', { b: 0.3 });
    TP(SYM([[6.3, 0], [4.9, 1.25], [2.8, 2.3], [-4.9, 2.35], [-5.9, 1.8], [-6.0, 0]]), 2.15, 0.36, P.a, 'gloss', { b: 0.22 });
    TP(SYM([[3.4, 0], [2.6, 1.7], [-3.6, 1.75], [-4.5, 1.2], [-4.6, 0]]), 2.72, 0.16, P.b, 'gloss', { b: 0.08 });
    for (const s of [-1, 1]) {
      TP([[2.6, s * 1.95], [2.2, s * 2.4], [-4.7, s * 2.45], [-5.0, s * 1.95]], 2.58, 0.04, tc, 'paint', { b: 0.03 }); /* faixa do time na borda do casco */
      K.box(-1.0, 2.1, s * 2.6, 7.4, 0.05, 0.05, P.c, null, { e: 2.2 }); /* fio teal na lateral do casco */
      TP([[6.2, s * 0.12], [5.5, s * 0.95], [5.25, s * 0.98], [5.95, s * 0.12]], 2.57, 0.02, P.t, 'metal', { b: 0.02 }); /* divisas de latão na proa */
      K.fine(() => { for (const x of [-1.2, 1.0]) E._seam(K, P, x, 2.66, s * 2.2, 0.04, 0.5); E._seam(K, P, 1.2, 2.55, s * 2.65, 3.4, 0.03); K.seg([5.6, 2.6, s * 0.55], [4.7, 2.6, s * 1.1], 0.035, P.t, 'metal', { seg: 5 }); });
    }
    K.cyl(0, 2.5, 0, 2.0, 2.12, 0.6, P.d, 'dark', { seg: 16 }); K.mount = 3.1; /* anel da torre */
    K.fine(() => { K.cyl(0, 3.03, 0, 2.16, 2.16, 0.07, P.t, 'metal', { seg: 16 }); for (let i = 0; i < 8; i++) { const a = i / 8 * PI * 2 + PI / 8; K.box(Math.cos(a) * 2.06, 2.62, Math.sin(a) * 2.06, 0.16, 0.36, 0.16, P.b, 'metal', { ry: -a }); } });
    /* sensor de proa (olho violeta) e juntas do glacis */
    K.prism(5.0, 2.48, 0, 0.36, 0.22, 6, P.b, 'gloss', { top: 0.7 }); K.light(5.3, 2.56, 0, 0.12, P.l, 3);
    K.fine(() => { E._seam(K, P, 4.4, 2.56, 0, 0.04, 2.0); E._seam(K, P, -5.3, 2.56, 0, 0.04, 2.6); });
    /* para-lamas angulares nos quatro cantos, com placa do time, e os casulos antigravidade embaixo (balançam como suspensão) */
    for (const s of [-1, 1]) {
      TP([[4.9, s * 2.3], [4.4, s * 3.75], [2.5, s * 3.9], [2.0, s * 2.3]], 1.62, 0.14, P.a, 'gloss', { b: 0.12 });
      TP([[4.5, s * 2.95], [4.2, s * 3.62], [2.7, s * 3.72], [2.5, s * 2.95]], 1.84, 0.03, tc, 'paint', { b: 0.02 });
      TP([[-3.0, s * 2.3], [-3.3, s * 3.9], [-5.3, s * 3.8], [-5.8, s * 2.3]], 1.62, 0.14, P.a, 'gloss', { b: 0.12 });
      TP([[-3.4, s * 2.95], [-3.6, s * 3.67], [-5.1, s * 3.6], [-5.35, s * 2.95]], 1.84, 0.03, tc, 'paint', { b: 0.02 });
      K.light(4.62, 1.66, s * 3.72, 0.14, P.l);
      K.fine(() => { TP([[4.98, s * 2.3], [4.48, s * 3.82], [4.3, s * 3.82], [4.78, s * 2.3]], 1.83, 0.02, P.t, 'metal', { b: 0.02 }); TP([[-5.45, s * 2.3], [-5.0, s * 3.85], [-5.2, s * 3.85], [-5.65, s * 2.3]], 1.83, 0.02, P.t, 'metal', { b: 0.02 });
        for (const [x, z] of [[3.0, 3.5], [3.9, 3.0], [-3.8, 3.5], [-4.8, 3.05]]) E._bolt(K, P, x, 1.86, s * z);
        K.box(-4.25, 1.88, s * 3.35, 0.7, 0.32, 0.5, P.d, 'dark'); K.box(-4.25, 2.2, s * 3.35, 0.5, 0.04, 0.3, P.b, 'metal'); K.light(-3.88, 1.98, s * 3.35, 0.08, P.c, 2); });
    }
    for (const [x, s] of [[3.45, 1], [3.45, -1], [-4.3, 1], [-4.3, -1]]) K.anim({ t: 'bob', amp: 0.08, speed: 3, ph: (x > 0 ? 0 : PI) + (s > 0 ? 0 : H) }, () => E._pod(K, P, x, 0.34, s * 3.25, 0.68, 1.6));
    /* blindagem lateral vertical entre os para-lamas, com grades e fio de energia */
    for (const s of [-1, 1]) {
      K.poly([[-3.0, 1.05], [2.0, 1.05], [2.3, 1.4], [2.0, 1.85], [-3.0, 1.85], [-3.3, 1.4]], 0.1, P.a, 'gloss', { z: s * 3.18, b: 0.03 });
      K.box(-0.5, 0.98, s * 3.24, 4.6, 0.05, 0.05, P.c, null, { e: 2.2 });
      E._vent(K, P, 0.9, 1.22, s * 3.27, 1.1, 0.42, s, 3); E._vent(K, P, -1.9, 1.22, s * 3.27, 1.1, 0.42, s, 3);
      K.fine(() => { for (const x of [-2.75, -0.5, 1.75]) { E._bolt(K, P, x, 1.72, s * 3.27, s); E._bolt(K, P, x, 1.12, s * 3.27, s); } K.seg([-2.6, 1.9, s * 3.12], [1.6, 1.9, s * 3.12], 0.035, P.t, 'metal', { seg: 5 }); });
    }
    /* queixo com faróis violeta, para-choque e ganchos; escotilha do piloto com periscópios */
    K.poly([[5.5, 0.95], [6.9, 1.05], [7.6, 1.45], [7.3, 1.8], [5.5, 1.8]], 2.0, P.d, 'dark', { b: 0.06 });
    for (const s of [-1, 1]) { K.box(7.27, 1.54, s * 0.72, 0.04, 0.16, 0.2, P.l, null, { e: 3 }); K.fine(() => XC(6.95, 1.62, s * 0.72, 0.13, 0.15, 0.3, P.t, 'metal', { seg: 8 })); }
    K.fine(() => { for (const s of [-1, 1]) K.box(7.0, 1.0, s * 0.4, 0.5, 0.14, 0.12, P.t, 'metal'); K.seg([7.25, 1.15, -1.0], [7.25, 1.15, 1.0], 0.05, P.t, 'metal', { seg: 6 }); K.prism(4.0, 2.5, 0.0, 0.42, 0.1, 6, P.b, 'gloss'); for (const s of [-1, 1]) K.box(4.45, 2.55, s * 0.24, 0.16, 0.12, 0.18, P.g, 'glass'); E._bolt(K, P, 3.7, 2.6, 0.28); E._bolt(K, P, 3.7, 2.6, -0.28); });
    /* motor traseiro: bloco inclinado, grade de exaustão, chaminés curtas, bocais duplos, luzes, empenas em V com a cor do time */
    K.poly([[-7.0, 1.25], [-5.1, 1.25], [-4.75, 2.95], [-6.3, 2.95], [-7.1, 2.25]], 3.2, P.a, 'gloss', { b: 0.12 });
    E._ventT(K, P, -5.7, 3.07, 0, 1.3, 2.4, 6);
    for (const s of [-1, 1]) {
      E._bocal(K, P, -7.6, 1.85, s * 0.85, 0.42);
      K.light(-7.18, 2.4, s * 1.4, 0.14, P.l);
      K.poly([[-6.9, 0], [-5.6, 0], [-6.3, 0.75], [-6.9, 0.75]], 0.08, P.a, 'gloss', { y: 3.0, z: s * 1.5, rx: s * 0.4, b: 0.03 });
      K.poly([[-6.75, 0.1], [-5.95, 0.1], [-6.35, 0.55], [-6.75, 0.55]], 0.02, tc, 'paint', { y: 3.03, z: s * 1.43, rx: s * 0.4, b: K.lite ? 0 : 0.02 });
      K.seg([-5.6, 3.0, s * 1.5], [-6.3, 3.0 + 0.75 * Math.cos(0.4), s * (1.5 + 0.75 * Math.sin(0.4))], 0.035, tc, null, { e: 2.4, seg: 5 });
      K.fine(() => { K.cyl(-6.55, 2.6, s * 0.55, 0.13, 0.16, 0.42, P.d, 'metal', { seg: 8 }); K.cyl(-6.55, 3.0, s * 0.55, 0.15, 0.15, 0.05, P.t, 'metal', { seg: 8 }); });
    }
    K.fine(() => { for (const s of [-1, 1]) { K.box(-5.0, 2.95, s * 1.85, 0.9, 0.25, 0.3, P.d, 'dark'); K.box(-5.0, 3.2, s * 1.85, 0.7, 0.04, 0.2, P.c, null, { e: 2 }); } K.seg([-6.9, 1.2, -1.2], [-6.9, 1.2, 1.2], 0.05, P.t, 'metal', { seg: 6 }); });
    E._antena(K, P, [-5.5, 3.05, -1.25], [-6.05, 5.1, -1.25]);
  },
  veiculo_turret(K, P, tc) { /* 4.3d: torre baixa facetada (saia escura, corpo brilhante com bochechas inclinadas, teto com placa do time, cúpula fumê, nicho traseiro), mantelete e canhão de trilhos que recua: núcleo teal entre dois trilhos, capa com aletas, cintas de latão, boca sextavada com ponta violeta */
    const E = U.erevane, TP = (pts, y, th, col, mat, o) => E._tp(K, pts, y, th, col, mat, o), SYM = E._sym, XC = (...a) => E._xc(K, ...a), XP = (...a) => E._xp(K, ...a);
    K.prism(0, 0, 0, 1.95, 0.34, 8, P.d, 'dark', { ry: PI / 8 });
    TP(SYM([[2.3, 0], [1.9, 1.15], [-1.5, 1.5], [-2.6, 1.15], [-2.8, 0]]), 0.55, 0.3, P.b, 'dark', { b: 0.14 });
    TP(SYM([[2.1, 0], [1.6, 1.0], [-1.4, 1.3], [-2.4, 1.0], [-2.6, 0]]), 1.02, 0.56, P.a, 'gloss', { b: 0.2 });
    TP(SYM([[1.3, 0], [0.95, 0.75], [-1.3, 0.95], [-2.0, 0.7], [-2.1, 0]]), 1.58, 0.1, P.b, 'gloss', { b: 0.1 });
    TP(SYM([[1.1, 0], [0.8, 0.66], [-0.6, 0.82], [-1.2, 0.6], [-1.3, 0]]), 1.77, 0.03, tc, 'paint', { b: 0.03 });
    TP(SYM([[-2.3, 0.3], [-2.45, 1.0], [-3.25, 0.85], [-3.4, 0.3]]), 0.95, 0.36, P.b, 'gloss', { b: 0.1 }); /* nicho traseiro */
    for (const s of [-1, 1]) {
      K.poly([[-1.5, 0.42], [1.3, 0.42], [1.9, 0.85], [1.3, 1.36], [-1.5, 1.36], [-1.9, 0.9]], 0.07, P.a, 'gloss', { z: s * 1.56, rx: -s * 0.2, b: 0.03 }); /* bochecha inclinada */
      K.box(0.0, 1.4, s * 1.5, 2.6, 0.05, 0.05, P.c, null, { e: 2.2, ry: s * 0.05 }); /* fio teal na borda da bochecha */
      K.fine(() => { E._bolt(K, P, -1.2, 1.0, s * 1.68, s); E._bolt(K, P, 1.0, 1.0, s * 1.68, s); E._seam(K, P, -0.2, 1.6, s * 0.88, 1.6, 0.03); });
    }
    K.light(-3.48, 1.0, 0, 0.12, P.l);
    /* mantelete e canhão de trilhos (recua) */
    K.poly([[1.8, 0.45], [2.75, 0.56], [3.0, 1.0], [2.75, 1.42], [1.8, 1.52]], 1.3, P.d, 'dark', { b: 0.06 });
    const BY = 1.0;
    K.fine(() => { E._xc(K, 2.85, 0.62, 0.48, 0.055, 0.065, 0.95, P.d, 'metal', { seg: 6 }); K.box(2.6, 0.5, 0.48, 0.5, 0.22, 0.22, P.b, 'gloss'); }); /* metralhadora coaxial */
    K.anim({ t: 'recoil', dist: 0.75 }, () => {
      XC(2.7, BY, 0, 0.3, 0.36, 1.0, P.b, 'gloss', { seg: 8 });
      for (const s of [-1, 1]) K.box(5.95, BY - 0.17, s * 0.2, 5.5, 0.34, 0.13, P.d, 'metal');
      K.box(5.8, BY - 0.07, 0, 5.1, 0.14, 0.27, P.c, null, { e: 2.0 });
      K.box(4.4, BY + 0.17, 0, 2.6, 0.06, 0.56, P.a, 'gloss');
      for (const x of K.lite ? [3.9, 7.6] : [3.9, 5.2, 6.5, 7.6]) K.box(x, BY - 0.24, 0, 0.14, 0.48, 0.62, P.t, 'metal');
      XP(8.65, BY, 0, 0.28, 0.5, 6, P.d, 'dark', { top: 1.3 });
      XC(9.13, BY, 0, 0.2, 0.2, 0.04, P.l, null, { e: 2.6, seg: 6 });
      K.fine(() => { XC(3.4, BY - 0.36, 0, 0.07, 0.07, 3.6, P.b, 'metal', { seg: 6 }); for (const x of [3.6, 6.8]) K.box(x, BY - 0.42, 0, 0.12, 0.12, 0.12, P.t, 'metal'); for (let i = 0; i < 6; i++) K.box(3.5 + i * 0.36, BY + 0.23, 0, 0.05, 0.1, 0.46, P.d, 'metal', { pat: 0 }); for (const s of [-1, 1]) K.box(8.9, BY - 0.06, s * 0.33, 0.24, 0.12, 0.04, P.d, 'dark', { pat: 0 }); });
    });
    /* sensor no teto (esquerda), lançadores de fumaça (direita), cúpula fumê, escotilha, antena */
    K.box(-1.0, 1.7, -0.62, 0.7, 0.26, 0.36, P.d, 'dark'); K.box(-0.64, 1.76, -0.62, 0.03, 0.14, 0.24, P.l, null, { e: 2.6 });
    K.prism(-1.75, 1.7, 0.55, 0.34, 0.24, 6, P.g, 'glass', { top: 0.72 });
    K.fine(() => { K.cyl(-1.75, 1.68, 0.55, 0.39, 0.39, 0.05, P.t, 'metal', { seg: 6 }); for (let i = 0; i < 3; i++) K.seg([-0.55 + i * 0.3, 1.15, 1.52], [-0.3 + i * 0.3, 1.42, 1.8], 0.08, P.b, 'metal', { seg: 6 }); for (const [x, z] of [[0.9, 0.5], [0.9, -0.5]]) E._bolt(K, P, x, 1.73, z);
      K.prism(-1.75, 1.68, -0.1, 0.3, 0.07, 6, P.b, 'gloss'); K.box(-1.75, 1.75, -0.1, 0.4, 0.04, 0.05, P.t, 'metal'); E._ventT(K, P, -2.85, 1.24, 0, 0.7, 1.1, 4); });
    E._antena(K, P, [-2.9, 1.24, -0.6], [-3.5, 2.9, -0.6]);
  },
  drone(K, P, tc) { /* 4.3d: drone de asa voadora — fuselagem facetada com domo-sensor fumê e tomada de ar, asas enflechadas com bordo de latão e placas do time, duas ventoinhas de sustentação (giram em sentidos opostos), metralhadora dupla no ventre (recua), mísseis sob as asas, empenas com fio teal, bocais violeta */
    const E = U.erevane, TP = (pts, y, th, col, mat, o) => E._tp(K, pts, y, th, col, mat, o), SYM = E._sym, XC = (...a) => E._xc(K, ...a);
    TP(SYM([[3.4, 0], [1.6, 0.62], [-1.9, 0.62], [-2.3, 0]]), 0.86, 0.14, P.d, 'dark', { b: 0.08 });
    TP(SYM([[4.3, 0], [3.3, 0.55], [1.0, 0.95], [-2.3, 0.9], [-2.8, 0]]), 1.3, 0.42, P.a, 'gloss', { b: 0.2 });
    TP(SYM([[2.6, 0], [1.8, 0.45], [-1.6, 0.55], [-2.2, 0]]), 1.86, 0.18, P.b, 'gloss', { b: 0.16 });
    TP(SYM([[2.95, 0], [2.35, 0.42], [0.95, 0.48], [0.45, 0]]), 2.1, 0.04, P.t, 'metal', { b: 0.03 });
    TP(SYM([[2.75, 0], [2.25, 0.27], [1.1, 0.32], [0.65, 0]]), 2.18, 0.1, P.g, 'glass', { b: 0.14 });
    K.poly([[-0.2, 1.95], [0.5, 1.95], [0.3, 2.26], [-0.2, 2.26]], 0.5, P.d, 'dark', { b: 0.03 }); /* tomada de ar dorsal */
    for (const s of [-1, 1]) K.box(0.2, 0.68, s * 0.55, 4.0, 0.04, 0.05, P.c, null, { e: 2 });
    K.fine(() => { E._ventT(K, P, -1.1, 2.1, 0, 1.0, 0.6, 5); for (const s of [-1, 1]) { E._bolt(K, P, 0.4, 2.12, s * 0.42); E._bolt(K, P, -1.7, 2.12, s * 0.42); E._seam(K, P, 3.0, 1.72, s * 0.35, 0.9, 0.03); } E._seam(K, P, -1.9, 2.12, 0, 0.03, 0.7); K.light(-2.95, 1.72, 0, 0.1, P.l); });
    /* asas: placa enflechada, intradorso escuro, bordo de ataque de latão, placa do time, ventoinha, empena, luz de navegação, flape, míssil */
    for (const s of [-1, 1]) {
      TP([[2.4, s * 0.9], [0.5, s * 3.6], [-0.5, s * 4.7], [-1.4, s * 4.85], [-1.85, s * 4.4], [-1.7, s * 0.9]], 1.28, 0.1, P.a, 'gloss', { b: 0.1 });
      TP([[2.0, s * 0.95], [0.3, s * 3.4], [-0.6, s * 4.4], [-1.5, s * 4.3], [-1.5, s * 0.95]], 1.07, 0.06, P.d, 'dark', { b: 0.04 });
      TP([[2.48, s * 0.86], [0.57, s * 3.62], [-0.45, s * 4.76], [-0.62, s * 4.62], [0.38, s * 3.5], [2.2, s * 0.86]], 1.45, 0.03, P.t, 'metal', { b: 0.02 });
      TP([[0.95, s * 2.8], [0.05, s * 3.95], [-0.75, s * 4.15], [-1.25, s * 2.8]], 1.46, 0.03, tc, 'paint', { b: 0.02 });
      const fx = -0.35, fz = s * 1.95;
      K.cyl(fx, 1.3, fz, 0.84, 0.9, 0.38, P.b, 'gloss', { seg: 16 }); K.cyl(fx, 1.68, fz, 0.66, 0.66, 0.02, P.d, 'dark', { seg: 16 });
      K.fine(() => { K.tor(fx, 1.69, fz, 0.76, 0.05, P.t, 'metal', { ts: 24, rs: 4 }); for (let i = 0; i < 4; i++) { const a = i / 4 * PI * 2 + PI / 4; K.box(fx + Math.cos(a) * 0.4, 1.66, fz + Math.sin(a) * 0.4, 0.5, 0.03, 0.05, P.d, 'metal', { ry: -a }); } });
      K.anim({ t: 'spin', p: [fx, 1.72, fz], speed: s * 18 }, () => { K.cyl(fx, 1.7, fz, 0.16, 0.18, 0.1, P.t, 'metal', { seg: 8 }); const nb = K.q(6); for (let i = 0; i < nb; i++) { const a = i / nb * PI * 2; K.box(fx + Math.cos(a) * 0.36, 1.71, fz + Math.sin(a) * 0.36, 0.56, 0.03, 0.17, P.b, 'metal', { ry: -a, rx: 0.35 }); } });
      K.poly([[-0.4, 0], [-1.55, 0], [-1.95, 1.05], [-1.5, 1.05]], 0.08, P.a, 'gloss', { y: 1.38, z: s * 4.62, rx: s * 0.22, b: 0.03 });
      K.seg([-0.45, 1.42, s * 4.63], [-1.5, 2.41, s * 4.85], 0.035, P.c, null, { e: 2.4, seg: 5 });
      K.light(-1.45, 1.3, s * 4.86, 0.12, s > 0 ? P.c : P.l);
      E._bocal(K, P, -3.15, 1.3, s * 0.42, 0.24);
      K.fine(() => { for (let i = 0; i < 3; i++) E._seam(K, P, -0.2 - i * 0.45, 1.44, s * (3.15 + i * 0.25), 0.05, 0.9); E._bolt(K, P, 1.6, 1.46, s * 1.5); E._bolt(K, P, -1.4, 1.46, s * 1.2);
        TP([[-1.55, s * 1.2], [-1.6, s * 2.6], [-2.0, s * 2.55], [-1.95, s * 1.2]], 1.27, 0.05, P.b, 'gloss', { b: 0.02 }); /* flape */
        K.box(0.6, 0.86, s * 3.05, 1.4, 0.14, 0.12, P.d, 'dark'); for (const dz of [-0.16, 0.16]) { XC(-0.2, 0.72, s * 3.05 + dz, 0.08, 0.08, 1.4, P.b, 'gloss', { seg: 6 }); K.cone(1.2, 0.72, s * 3.05 + dz, 0.08, 0.26, P.t, 'metal', { rz: -H, seg: 6 }); } });
      E._antena(K, P, [-1.9, 2.05, s * 0.32], [-3.1, 2.4, s * 0.45], P.c);
    }
    /* casulo da arma no ventre e metralhadora dupla (recua); sensor sob o nariz */
    K.box(2.0, 0.5, 0, 1.5, 0.3, 0.62, P.d, 'dark');
    K.anim({ t: 'recoil', dist: 0.35 }, () => { for (const s of [-1, 1]) { XC(2.7, 0.66, s * 0.17, 0.065, 0.075, 1.5, P.d, 'metal', { seg: 6 }); K.fine(() => XC(4.1, 0.66, s * 0.17, 0.09, 0.09, 0.16, P.t, 'metal', { seg: 6 })); } });
    K.fine(() => { K.sph(3.55, 0.82, 0, 0.2, P.g, 'glass', { seg: 10 }); for (const s of [-1, 1]) K.box(2.0, 0.6, s * 0.33, 1.1, 0.12, 0.04, P.b, 'metal', { pat: 0 }); }); K.light(3.72, 0.74, 0, 0.12, P.l, 3);
  },
  suporte(K, P, tc) { /* 4.3d: suporte/hack — trenó flutuante compacto com aletas traseiras da cor do time e agulha de pulso facetada (coluna sextavada, aletas cruzadas com fio teal), dois anéis hexagonais em sentidos opostos (latão com nós teal; cor do time), cristal violeta flutuando na ponta, prato de varredura que gira, quatro casulos */
    const E = U.erevane, TP = (pts, y, th, col, mat, o) => E._tp(K, pts, y, th, col, mat, o), SYM = E._sym;
    K.box(0, 0, 0, 0.08, 0.004, 0.08, P.d, 'dark', { pat: 0 });
    TP(SYM([[2.0, 0], [1.4, 0.95], [-1.8, 1.15], [-2.2, 0]]), 0.92, 0.12, P.d, 'dark', { b: 0.05 });
    TP(SYM([[2.5, 0], [1.9, 1.0], [0.9, 1.55], [-1.8, 1.6], [-2.4, 1.1], [-2.5, 0]]), 1.3, 0.4, P.b, 'dark', { b: 0.26 });
    TP(SYM([[2.05, 0], [1.5, 0.88], [-1.5, 1.2], [-2.1, 0.8], [-2.15, 0]]), 1.92, 0.2, P.a, 'gloss', { b: 0.18 });
    for (const s of [-1, 1]) {
      TP([[1.75, s * 0.3], [1.45, s * 0.82], [0.8, s * 0.98], [0.8, s * 0.3]], 2.24, 0.03, tc, 'paint', { b: 0.03 });
      TP([[-0.95, s * 1.38], [-1.45, s * 2.38], [-2.2, s * 2.33], [-2.25, s * 1.38]], 1.62, 0.08, P.a, 'gloss', { b: 0.06 }); /* aleta traseira */
      TP([[-1.15, s * 1.66], [-1.55, s * 2.22], [-2.05, s * 2.2], [-2.08, s * 1.66]], 1.76, 0.02, tc, 'paint', { b: 0.02 });
      K.box(-1.6, 1.62, s * 2.4, 0.85, 0.05, 0.05, P.c, null, { e: 2.2, ry: s * 0.06 });
      K.box(-0.4, 1.77, s * 1.8, 3.2, 0.05, 0.05, P.c, null, { e: 2.2 });
      E._vent(K, P, 0.45, 1.0, s * 1.88, 0.9, 0.5, s, 3);
      K.light(2.45, 1.3, s * 0.45, 0.13, P.l);
      E._bocal(K, P, -2.82, 1.35, s * 0.6, 0.26);
      E._antena(K, P, [-1.75, 2.2, s * 0.62], [-2.2, 3.6, s * 0.7]);
      K.fine(() => { for (const x of [1.3, -1.7]) E._bolt(K, P, x, 2.24, s * 1.05); E._vent(K, P, -1.15, 1.0, s * 1.88, 0.8, 0.5, s, 3); E._bolt(K, P, -1.95, 1.72, s * 2.05); E._seam(K, P, 0.4, 2.21, s * 0.7, 0.03, 0.55); });
    }
    for (const [x, s] of [[1.6, 1], [1.6, -1], [-1.65, 1], [-1.65, -1]]) K.anim({ t: 'bob', amp: 0.08, speed: 3, ph: (x > 0 ? 0 : PI) + (s > 0 ? 0 : H) }, () => E._pod(K, P, x, 0.3, s * 1.32, 0.48, 1.1));
    /* agulha de pulso: colar, coluna sextavada com faixa do time, agulha de 4 faces com aletas cruzadas e fios teal */
    const SX = -0.3;
    K.prism(SX, 2.1, 0, 0.98, 0.42, 8, P.d, 'dark', { top: 0.86, ry: PI / 8 });
    K.prism(SX, 2.5, 0, 0.72, 1.3, 6, P.a, 'gloss', { top: 0.82 }); K.prism(SX, 2.95, 0, 0.7, 0.3, 6, tc, 'paint', { top: 0.97 });
    K.prism(SX, 3.8, 0, 0.5, 3.7, 4, P.a, 'gloss', { top: 0.09, ry: PI / 4 });
    for (const a of [PI / 4, 3 * PI / 4]) K.poly([[-1.2, 0], [1.2, 0], [0, 3.4]], 0.08, P.b, 'gloss', { x: SX, y: 2.5, ry: a, b: 0.02 });
    for (const a of [PI / 4, 3 * PI / 4, 5 * PI / 4, 7 * PI / 4]) K.seg([SX + Math.cos(a) * 1.17, 2.55, Math.sin(a) * 1.17], [SX + Math.cos(a) * 0.06, 7.4, Math.sin(a) * 0.06], 0.03, P.c, null, { e: 2.2, seg: 4 });
    K.fine(() => { K.cyl(SX, 2.48, 0, 0.9, 0.9, 0.07, P.t, 'metal', { seg: 8, facet: true, ry: PI / 8 }); K.cyl(SX, 3.78, 0, 0.62, 0.62, 0.06, P.t, 'metal', { seg: 6, facet: true }); for (let i = 0; i < 6; i++) { const a = i / 6 * PI * 2; K.light(SX + Math.cos(a) * 0.9, 2.3, Math.sin(a) * 0.9, 0.09, P.c, 2); } for (let i = 0; i < 4; i++) { const a = i * H; K.box(SX + Math.cos(a) * 0.78, 2.55, Math.sin(a) * 0.78, 0.26, 1.1, 0.06, P.t, 'metal', { ry: -a }); }
      for (const s of [-1, 1]) { K.seg([1.75, 2.22, s * 0.48], [2.25, 2.75, s * 0.6], 0.035, P.t, 'metal', { seg: 5 }); K.light(2.25, 2.7, s * 0.6, 0.08, P.l, 2.6); } });
    K.anim({ t: 'spin', p: [SX, 4.25, 0], speed: 1.6 }, () => { K.tor(SX, 4.25, 0, 1.4, 0.09, P.t, 'metal', { ts: 6, rs: 4 }); ringOf(6, 1.4, (cx, cz) => K.light(SX + cx, 4.17, cz, 0.17, P.c, 2.4)); });
    K.anim({ t: 'spin', p: [SX, 5.55, 0], speed: -2.3 }, () => { K.tor(SX, 5.55, 0, 0.95, 0.07, tc, null, { e: 2, ts: 6, rs: 4 }); ringOf(3, 0.95, (cx, cz) => K.light(SX + cx, 5.48, cz, 0.14, P.l, 2.6)); });
    K.anim({ t: 'bob', amp: 0.16, speed: 2.6 }, () => K.oct(SX, 7.65, 0, 0.34, 0.95, P.l, null, { e: 3 }));
    /* prato de varredura (gira devagar sobre o mastro): costas brilhantes, concha escura, antena do foco; cabo até a agulha */
    K.anim({ t: 'spin', p: [1.3, 2.2, 0], speed: 0.9 }, () => {
      K.cyl(1.3, 2.2, 0, 0.11, 0.15, 0.6, P.d, 'metal', { seg: 8 });
      const dp = [[0.02, 0], [0.3, 0.06], [0.52, 0.18], [0.64, 0.32]];
      K.lathe(dp, 1.35, 2.8, 0, P.b, 'gloss', { seg: 14, rz: -H + 0.35 }); K.lathe(dp.slice().reverse().map(p => [p[0], p[1] + 0.025]), 1.35, 2.8, 0, P.d, 'dark', { seg: 14, rz: -H + 0.35 });
      K.seg([1.37, 2.81, 0], [1.93, 3.0, 0], 0.03, P.t, 'metal', { seg: 5 }); K.light(1.93, 2.95, 0, 0.1, P.l);
    });
    K.fine(() => K.tube([[1.15, 2.25, 0.2], [0.75, 2.3, 0.45], [0.2, 2.45, 0.62]], 0.045, P.d, 'rubber', { ts: 8, rs: 5 }));
  },
  pirata(K, P, tc) { /* 4.3d: Sifonador Erevane — casco longo e baixo de ladrão com cabine-fenda, probóscide-sifão articulada (acena ao andar) com bobinas teal e ponta violeta, dois tanques-bexiga de carga com cintas de latão, faixa do time e janela violeta, vela de camuflagem com fio teal, empenas em V, quatro casulos */
    const E = U.erevane, TP = (pts, y, th, col, mat, o) => E._tp(K, pts, y, th, col, mat, o), SYM = E._sym, XC = (...a) => E._xc(K, ...a), XP = (...a) => E._xp(K, ...a);
    K.box(0, 0, 0, 0.08, 0.004, 0.08, P.d, 'dark', { pat: 0 });
    TP(SYM([[3.4, 0], [2.6, 0.75], [-4.0, 1.15], [-4.6, 0.6], [-4.7, 0]]), 0.92, 0.12, P.d, 'dark', { b: 0.05 });
    for (const s of [-1, 1]) K.box(-0.6, 0.77, s * 1.0, 6.2, 0.04, 0.05, P.c, null, { e: 2.2 });
    TP(SYM([[4.2, 0], [3.4, 0.7], [1.4, 1.35], [-3.9, 1.55], [-5.0, 1.05], [-5.2, 0]]), 1.32, 0.4, P.b, 'dark', { b: 0.28 });
    TP(SYM([[3.7, 0], [2.8, 0.62], [0.9, 1.0], [-0.3, 1.0], [-0.6, 0]]), 1.96, 0.24, P.a, 'gloss', { b: 0.2 });
    TP(SYM([[-0.3, 0.9], [-0.6, 1.35], [-4.4, 1.4], [-5.0, 0.85], [-5.05, 0]]), 1.92, 0.18, P.a, 'gloss', { b: 0.14 });
    TP(SYM([[3.3, 0], [2.7, 0.44], [1.15, 0.54], [0.7, 0]]), 2.27, 0.04, P.t, 'metal', { b: 0.03 });
    TP(SYM([[3.05, 0], [2.55, 0.3], [1.3, 0.4], [0.9, 0]]), 2.36, 0.1, P.g, 'glass', { b: 0.16 });
    K.fine(() => { E._seam(K, P, 3.3, 2.3, 0, 0.03, 0.5); K.cyl(0.55, 2.28, 0, 0.13, 0.15, 0.22, P.b, 'gloss', { seg: 8 }); K.sph(0.55, 2.5, 0, 0.11, P.g, 'glass', { seg: 8, half: true }); E._ventT(K, P, -4.7, 2.15, 0, 0.5, 1.4, 4); });
    for (const s of [-1, 1]) {
      TP([[2.45, s * 0.58], [2.1, s * 0.86], [0.4, s * 1.1], [0.6, s * 0.6]], 2.31, 0.03, tc, 'paint', { b: 0.03 });
      K.box(-1.6, 1.82, s * 1.72, 6.0, 0.05, 0.05, P.c, null, { e: 2.2 });
      K.light(4.05, 1.4, s * 0.55, 0.12, P.l);
      E._vent(K, P, 0.4, 1.0, s * 1.68, 1.1, 0.5, s, 3);
      K.fine(() => { E._vent(K, P, -2.6, 1.0, s * 1.86, 1.0, 0.5, s, 3); for (const x of [1.9, 0.9]) E._bolt(K, P, x, 2.34, s * 0.98); for (const x of [-1.2, -3.8]) E._bolt(K, P, x, 1.6, s * 1.86, s); E._seam(K, P, -1.5, 2.16, s * 1.25, 4.2, 0.03); K.light(-4.6, 1.6, s * 1.6, 0.09, P.c, 2); });
    }
    /* tanques-bexiga de carga sobre o convés: cintas de latão, faixa do time, janela violeta, válvulas, mangueiras até a probóscide */
    for (const s of [-1, 1]) {
      const z = s * 0.86, ty = 2.86;
      K.cap(-2.45, ty, z, 0.7, 2.36, P.g, 'glass', { rz: H, seg: 12 });
      XC(-2.85, ty, z, 0.725, 0.725, 0.5, tc, 'paint', { seg: 12 });
      K.box(-1.82, ty + 0.68, z, 0.95, 0.05, 0.15, P.l, null, { e: 1.8 });
      K.fine(() => { for (const x of [-3.75, -1.25]) XC(x, ty, z, 0.75, 0.75, 0.12, P.t, 'metal', { seg: 12 }); XC(-0.62, ty, z, 0.16, 0.2, 0.22, P.t, 'metal', { seg: 8 }); XC(-4.5, ty, z, 0.2, 0.16, 0.22, P.t, 'metal', { seg: 8 }); K.box(-3.0, 2.1, z, 0.22, 0.2, 0.9, P.d, 'metal'); K.box(-1.9, 2.1, z, 0.22, 0.2, 0.9, P.d, 'metal');
        K.tube([[-0.5, ty, z], [0.3, 2.45, s * 1.25], [2.2, 2.0, s * 1.15], [3.6, 1.8, s * 0.5]], 0.05, P.d, 'rubber', { ts: 10, rs: 5 }); K.cyl(-3.3, ty + 0.66, z, 0.08, 0.1, 0.12, P.t, 'metal', { seg: 6 }); });
    }
    /* véus de camuflagem enflechados nas laterais (caídos para fora), com faixa do time e fio teal no bordo */
    for (const s of [-1, 1]) {
      TP([[0.9, s * 1.3], [-2.9, s * 3.2], [-4.55, s * 3.35], [-4.35, s * 2.5], [-4.8, s * 1.4]], 1.5, 0.06, P.b, 'glass', { b: 0.05, rx: -H + s * 0.12 });
      TP([[-0.1, s * 1.8], [-2.7, s * 3.0], [-3.5, s * 3.05], [-1.2, s * 1.8]], 1.62, 0.02, tc, 'paint', { b: 0.02, rx: -H + s * 0.12 });
      K.seg([0.95, 1.43, s * 1.3], [-2.9, 1.2, s * 3.27], 0.035, P.c, null, { e: 2.4, seg: 5 });
      K.fine(() => { K.seg([-2.9, 1.2, s * 3.27], [-4.55, 1.18, s * 3.42], 0.03, P.t, 'metal', { seg: 5 }); for (let k = 0; k < 3; k++) E._seam(K, P, -1.3 - k * 0.9, 1.56 - (2.0 + k * 0.35) * 0.12 + 0.02, s * (2.0 + k * 0.35), 0.03, 0.6); K.light(-4.5, 1.12, s * 3.38, 0.1, s > 0 ? P.c : P.l); });
    }
    /* vela de camuflagem entre os tanques, com fio teal na borda */
    K.poly([[-4.3, 0], [-0.9, 0], [-1.7, 1.75], [-3.5, 2.2], [-4.6, 1.3]], 0.08, P.b, 'glass', { y: 2.12, b: 0.02 });
    K.seg([-1.0, 2.15, 0], [-1.7, 3.87, 0], 0.03, P.c, null, { e: 2.4, seg: 4 }); K.seg([-1.7, 3.87, 0], [-3.5, 4.32, 0], 0.03, P.c, null, { e: 2.4, seg: 4 });
    K.fine(() => { for (const x of [-1.9, -2.6, -3.3]) K.box(x, 2.4, 0, 0.04, 1.3, 0.12, P.t, 'metal', { pat: 0 }); K.light(-3.5, 4.3, 0, 0.1, P.l, 2.6); });
    /* probóscide-sifão: soquete facetado, colar, bainha com bobinas teal e anéis de latão, agulha com ponta violeta (acena ao andar) */
    XP(3.65, 1.62, 0, 0.44, 0.62, 8, P.a, 'gloss', { top: 0.72 }); XC(4.22, 1.62, 0, 0.36, 0.36, 0.08, P.t, 'metal', { seg: 8 });
    K.anim({ t: 'sway', p: [4.3, 1.62, 0], amp: 0.07, speed: 1.6 }, () => {
      XC(4.3, 1.62, 0, 0.17, 0.27, 1.25, P.b, 'gloss', { seg: 8 });
      for (const [x, r] of [[4.8, 0.27], [5.0, 0.25]]) XC(x, 1.62, 0, r, r, 0.06, P.c, null, { e: 2.4, seg: 8 });
      XC(5.5, 1.62, 0, 0.045, 0.12, 1.15, P.d, 'metal', { seg: 6 });
      K.cone(6.65, 1.62, 0, 0.07, 0.2, P.l, null, { e: 3, rz: -H, seg: 6 });
      K.fine(() => { for (const [x, r] of [[4.55, 0.3], [5.25, 0.22]]) XC(x, 1.62, 0, r, r, 0.07, P.t, 'metal', { seg: 8 }); for (const x of [5.85, 6.2]) XC(x, 1.62, 0, 0.09, 0.09, 0.05, P.t, 'metal', { seg: 6 }); });
    });
    K.fine(() => { for (const s of [-1, 1]) K.anim({ t: 'sway', p: [3.9, 1.45, s * 0.42], amp: 0.12, speed: 2.6, ph: s }, () => K.tube([[3.9, 1.45, s * 0.42], [4.6, 1.3, s * 0.62], [5.3, 1.38, s * 0.5]], 0.035, P.t, 'metal', { ts: 6, rs: 4 })); });
    /* quatro casulos antigravidade (balançam), popa com bocais violeta, faixa do time acesa e empenas em V */
    for (const [x, s, z] of [[2.4, 1, 1.05], [2.4, -1, 1.05], [-3.6, 1, 2.55], [-3.6, -1, 2.55]]) K.anim({ t: 'bob', amp: 0.08, speed: 3, ph: (x > 0 ? 0 : PI) + (s > 0 ? 0 : H) }, () => E._pod(K, P, x, 0.3, s * z, 0.48, 1.05));
    for (const s of [-1, 1]) {
      E._bocal(K, P, -5.62, 1.4, s * 0.55, 0.3);
      K.poly([[-5.5, 0], [-4.5, 0], [-5.1, 0.8], [-5.55, 0.8]], 0.08, P.a, 'gloss', { y: 2.12, z: s * 1.05, rx: s * 0.45, b: 0.03 });
      K.poly([[-5.4, 0.1], [-4.85, 0.1], [-5.15, 0.55], [-5.4, 0.55]], 0.02, tc, 'paint', { y: 2.15, z: s * 0.98, rx: s * 0.45, b: K.lite ? 0 : 0.02 });
      K.seg([-4.5, 2.12, s * 1.05], [-5.1, 2.12 + 0.8 * Math.cos(0.45), s * (1.05 + 0.8 * Math.sin(0.45))], 0.035, tc, null, { e: 2.4, seg: 5 });
    }
    K.box(-5.47, 1.86, 0, 0.06, 0.07, 1.4, tc, null, { e: 2.2 });
    E._antena(K, P, [-0.2, 2.2, -1.05], [-0.65, 3.7, -1.1]);
  },
  lamina(K, P, tc) { /* 4.3d: Lâmina Rodante — dardo baixo sobre duas rodas-lâmina serrilhadas que tocam o chão (giram: rodam e cortam), aríete de latão em cunha na proa, para-lamas em arco com faixa do time presos por escoras, cabine fumê, casulo traseiro e bocais violeta */
    const E = U.erevane, TP = (pts, y, th, col, mat, o) => E._tp(K, pts, y, th, col, mat, o), SYM = E._sym, ZC = (...a) => E._zc(K, ...a);
    K.box(0, 0, 0, 0.08, 0.004, 0.08, P.d, 'dark', { pat: 0 }); /* âncora: a base fica igual nas duas versões (os dentes mudam de número) */
    const BX = 0.7, BY = 2.1, BZ = 2.55, BR = 2.1; /* centro e raio das rodas-lâmina */
    const arc = (r0, r1, a0, a1, n) => { const p = []; for (let i = 0; i <= n; i++) { const a = a0 + i / n * (a1 - a0); p.push([Math.cos(a) * r1, Math.sin(a) * r1]); } for (let i = n; i >= 0; i--) { const a = a0 + i / n * (a1 - a0); p.push([Math.cos(a) * r0, Math.sin(a) * r0]); } return p; };
    for (const s of [-1, 1]) {
      K.anim({ t: 'spin', p: [BX, BY, s * BZ], axis: 'z', speed: -16 }, () => {
        const n = K.q(20), pts = []; for (let i = 0; i < n; i++) { const a = i / n * PI * 2; pts.push([Math.cos(a) * BR * 0.87, Math.sin(a) * BR * 0.87]); const a2 = a + PI * 2 / n * 0.62; pts.push([Math.cos(a2) * BR, Math.sin(a2) * BR]); }
        K.poly(pts, 0.1, '#A9B2BC', 'metal', { x: BX, y: BY, z: s * BZ });
        ZC(BX, BY, s * BZ, 1.5, 0.18, P.b, 'gloss', { seg: 16 });
        ZC(BX, BY, s * BZ, 0.6, 0.42, P.t, 'metal', { seg: 10 });
        K.tor(BX, BY, s * BZ, 1.66, 0.07, P.c, null, { e: 2.2, rx: H, ts: 24, rs: 4 });
        K.fine(() => { for (let i = 0; i < 5; i++) { const a = i / 5 * PI * 2; K.box(BX + Math.cos(a) * 1.05, BY + Math.sin(a) * 1.05, s * (BZ + 0.1), 0.62, 0.05, 0.04, P.t, 'metal', { rz: a + H }); K.box(BX + Math.cos(a + 0.6) * 1.05, BY + Math.sin(a + 0.6) * 1.05, s * (BZ - 0.1), 0.62, 0.05, 0.04, P.t, 'metal', { rz: a + 0.6 + H }); } ZC(BX, BY, s * (BZ + 0.24), 0.3, 0.1, P.d, 'metal', { seg: 8 }); });
      });
      ZC(BX, BY, s * 1.85, 0.24, 1.15, P.d, 'metal', { seg: 10 });
      K.poly(arc(2.22, 2.44, 0.8, 2.65, K.q(8)), 0.56, P.a, 'gloss', { x: BX, y: BY, z: s * BZ, b: 0.04 });
      K.poly(arc(2.44, 2.5, 0.9, 2.55, K.q(8)), 0.4, tc, 'paint', { x: BX, y: BY, z: s * BZ });
      K.seg([-0.55, 2.4, s * 1.25], [-0.95, 3.72, s * 2.3], 0.07, P.b, 'gloss', { seg: 6 }); K.seg([1.6, 2.3, s * 1.2], [2.25, 3.92, s * 2.3], 0.07, P.b, 'gloss', { seg: 6 }); /* escoras do para-lama */
      K.fine(() => { ZC(BX, BY, s * 1.3, 0.36, 0.12, P.t, 'metal', { seg: 10 }); for (const [x, y] of [[-0.95, 3.72], [2.25, 3.92]]) K.sph(x, y, s * 2.3, 0.12, P.t, 'metal', { seg: 8 }); K.light(BX - 2.0, BY + 1.25, s * 2.55, 0.1, P.l); });
    }
    /* casco: chassi acetinado, casco brilhante, cabine fumê com aro de latão, placas do time no convés */
    TP(SYM([[5.0, 0], [3.9, 0.55], [2.0, 1.0], [-3.4, 1.15], [-4.5, 0.8], [-4.7, 0]]), 1.45, 0.4, P.b, 'dark', { b: 0.26 });
    TP(SYM([[4.2, 0], [3.1, 0.5], [1.3, 0.85], [-3.0, 0.95], [-3.9, 0.6], [-4.0, 0]]), 2.1, 0.3, P.a, 'gloss', { b: 0.18 });
    TP(SYM([[2.55, 0], [2.05, 0.48], [0.2, 0.58], [-0.3, 0]]), 2.47, 0.04, P.t, 'metal', { b: 0.03 });
    TP(SYM([[2.3, 0], [1.85, 0.34], [0.35, 0.44], [-0.1, 0]]), 2.58, 0.12, P.g, 'glass', { b: 0.16 });
    K.fine(() => { E._seam(K, P, 1.25, 2.8, 0, 0.04, 0.7); E._ventT(K, P, -3.45, 2.44, 0, 0.5, 0.9, 4); K.box(3.1, 2.42, 0, 0.6, 0.06, 0.3, P.d, 'dark'); });
    for (const s of [-1, 1]) {
      TP([[-0.5, s * 0.22], [-0.7, s * 0.8], [-2.9, s * 0.85], [-3.1, s * 0.22]], 2.48, 0.03, tc, 'paint', { b: 0.03 });
      K.box(-0.8, 1.93, s * 1.3, 5.6, 0.05, 0.05, P.c, null, { e: 2.2 });
      K.light(4.3, 1.55, s * 0.6, 0.12, P.l); K.light(-4.95, 1.95, s * 0.85, 0.12, P.l);
      E._bocal(K, P, -5.15, 1.5, s * 0.5, 0.3);
      K.fine(() => { K.poly([[0, 0], [2.2, 0.25], [2.0, 0.42], [0, 0.2]], 0.05, '#A9B2BC', 'metal', { x: -3.4, y: 1.2, z: s * 1.42 }); E._vent(K, P, -2.4, 1.15, s * 1.43, 0.9, 0.45, s, 3); E._bolt(K, P, -1.6, 2.5, s * 0.6); E._bolt(K, P, 2.6, 2.4, s * 0.62); E._seam(K, P, -1.8, 2.44, s * 0.95, 2.4, 0.03); E._bolt(K, P, 3.2, 1.6, s * 1.0, s); });
    }
    /* aríete: lâmina de latão em quilha e abas em cunha */
    K.poly([[3.9, 1.0], [6.0, 1.3], [6.3, 1.55], [5.9, 1.95], [3.9, 2.1]], 0.16, P.t, 'metal', { b: 0.03 });
    for (const s of [-1, 1]) K.poly([[-0.9, 0.95], [0.9, 1.2], [0.6, 1.9], [-0.9, 2.0]], 0.1, P.a, 'gloss', { x: 4.3, z: s * 0.45, ry: s * 0.5, b: 0.03 });
    K.fine(() => { for (const x of [4.6, 5.3]) K.cyl(x, 1.55, 0.12, 0.05, 0.06, 0.04, P.d, 'metal', { seg: 6, rx: H }); });
    /* aerofólio traseiro sobre duas escoras (placa do time e fio teal), casulo traseiro (balança) e antena */
    for (const s of [-1, 1]) K.seg([-3.55, 2.3, s * 0.55], [-3.85, 2.98, s * 0.75], 0.06, P.d, 'metal', { seg: 6 });
    TP([[-3.45, 0], [-3.6, 1.25], [-4.3, 1.3], [-4.45, 0], [-4.3, -1.3], [-3.6, -1.25]], 3.04, 0.08, P.a, 'gloss', { b: 0.05 });
    TP([[-3.6, 0], [-3.72, 1.05], [-4.2, 1.1], [-4.3, 0], [-4.2, -1.1], [-3.72, -1.05]], 3.17, 0.02, tc, 'paint', { b: 0.02 });
    K.box(-3.5, 2.98, 0, 0.05, 0.05, 2.4, P.c, null, { e: 2.2 });
    K.anim({ t: 'bob', amp: 0.08, speed: 3 }, () => E._pod(K, P, -3.6, 0.3, 0, 0.55, 1.1));
    E._antena(K, P, [-2.9, 2.45, 0.55], [-3.3, 3.9, 0.6]);
  },
  mosquito(K, P, tc) { /* 4.3d: microdrone-inseto — tórax facetado com placa do time e frisos de latão, cabeça com olhos violeta e ferrão que estoca (recua ao picar), abdome em gomos com faixas do time e luz teal, dois pares de asas de vidro com nervura de latão (batem), bolsa de veneno, patinhas e antenas */
    const E = U.erevane, TP = (pts, y, th, col, mat, o) => E._tp(K, pts, y, th, col, mat, o), SYM = E._sym, XC = (...a) => E._xc(K, ...a), XP = (...a) => E._xp(K, ...a);
    K.box(0, 0, 0, 0.06, 0.004, 0.06, P.d, 'dark', { pat: 0 }); /* âncora: base igual nas duas versões (as patinhas só existem na completa) */
    TP(SYM([[0.7, 0], [0.45, 0.4], [-0.5, 0.45], [-0.75, 0]]), 1.05, 0.24, P.b, 'dark', { b: 0.1 });
    TP(SYM([[0.55, 0], [0.3, 0.3], [-0.45, 0.34], [-0.65, 0]]), 1.38, 0.12, P.a, 'gloss', { b: 0.1 });
    TP(SYM([[0.35, 0], [0.15, 0.2], [-0.35, 0.22], [-0.45, 0]]), 1.56, 0.02, tc, 'paint', { b: 0.02 });
    K.oct(0.95, 0.88, 0, 0.32, 0.56, P.b, 'gloss', { sx: 1.25 });
    for (const s of [-1, 1]) K.sph(1.02, 1.18, s * 0.2, 0.13, P.l, null, { e: 2.4, seg: 8 });
    XC(1.25, 1.02, 0, 0.06, 0.1, 0.5, P.t, 'metal', { seg: 6 });
    K.anim({ t: 'recoil', dist: 0.4 }, () => { K.seg([1.7, 1.02, 0], [3.0, 0.93, 0], 0.045, P.d, 'metal', { taper: 0.15, seg: 6 }); K.fine(() => { K.sph(2.95, 0.935, 0, 0.035, P.l, null, { e: 3, seg: 6 }); for (const x of [1.85, 2.15]) XC(x, 1.01 - (x - 1.7) * 0.07, 0, 0.06, 0.06, 0.04, P.t, 'metal', { seg: 6 }); }); });
    /* abdome em gomos: faixas do time alternadas, luz teal na ponta */
    XP(-0.95, 1.12, 0, 0.4, 0.42, 6, tc, 'paint', { top: 1.05 });
    XP(-1.42, 1.1, 0, 0.36, 0.46, 6, P.a, 'gloss', { top: 1.1 });
    XP(-1.86, 1.07, 0, 0.27, 0.43, 6, tc, 'paint', { top: 1.3 });
    XP(-2.25, 1.03, 0, 0.1, 0.38, 6, P.a, 'gloss', { top: 2.6 });
    K.light(-2.32, 0.98, 0, 0.1, P.c, 2.6);
    K.fine(() => { for (const [x, r, y] of [[-0.98, 0.43, 1.12], [-1.46, 0.4, 1.1], [-1.89, 0.3, 1.07]]) XC(x, y, 0, r, r, 0.05, P.t, 'metal', { seg: 6 }); K.sph(-0.4, 0.72, 0, 0.22, P.g, 'glass', { seg: 10 }); K.light(-0.4, 0.5, 0, 0.08, P.l, 2.6);
      for (const s of [-1, 1]) { K.box(0.0, 1.06, s * 0.52, 0.7, 0.22, 0.03, P.t, 'metal'); K.box(0.95, 1.3, s * 0.12, 0.4, 0.05, 0.05, P.t, 'metal', { ry: s * 0.2 }); } K.box(-0.1, 0.78, 0, 0.6, 0.12, 0.34, P.d, 'dark'); K.light(0.2, 0.74, 0, 0.08, P.l); });
    /* asas: dois pares de vidro fumê com nervura de latão no bordo e fio teal na ponta (batem; o par de trás defasado) */
    for (const s of [-1, 1]) {
      K.anim({ t: 'flap', p: [0.15, 1.5, s * 0.3], amp: 0.6, speed: 30, side: -s }, () => {
        TP([[0.4, s * 0.3], [0.15, s * 1.5], [-0.4, s * 2.6], [-0.85, s * 2.55], [-0.65, s * 1.2], [-0.25, s * 0.3]], 1.5, 0.02, P.g, 'glass', { b: 0.015 });
        K.seg([0.38, 1.53, s * 0.3], [0.13, 1.53, s * 1.5], 0.035, P.t, 'metal', { seg: 5 }); K.seg([0.13, 1.53, s * 1.5], [-0.42, 1.53, s * 2.62], 0.03, P.t, 'metal', { seg: 5 });
        K.box(-0.62, 1.51, s * 2.5, 0.42, 0.03, 0.05, P.c, null, { e: 2.2, ry: s * 0.45 });
        K.fine(() => { K.seg([0.0, 1.53, s * 0.4], [-0.7, 1.53, s * 2.35], 0.015, P.d, 'metal', { seg: 4 }); K.seg([-0.15, 1.53, s * 0.9], [-0.6, 1.53, s * 1.2], 0.015, P.d, 'metal', { seg: 4 }); K.seg([-0.3, 1.53, s * 1.6], [-0.75, 1.53, s * 1.9], 0.015, P.d, 'metal', { seg: 4 }); });
      });
      K.anim({ t: 'flap', p: [-0.35, 1.45, s * 0.3], amp: 0.5, speed: 30, ph: 1.6, side: -s }, () => {
        TP([[-0.2, s * 0.3], [-0.4, s * 1.2], [-0.8, s * 1.9], [-1.15, s * 1.8], [-0.95, s * 0.9], [-0.6, s * 0.3]], 1.45, 0.02, P.g, 'glass', { b: 0.015 });
        K.seg([-0.22, 1.48, s * 0.3], [-0.82, 1.48, s * 1.92], 0.03, P.t, 'metal', { seg: 5 });
        K.fine(() => K.seg([-0.5, 1.48, s * 0.45], [-1.05, 1.48, s * 1.7], 0.015, P.d, 'metal', { seg: 4 }));
      });
      /* patinhas penduradas (balançam) e antenas */
      K.fine(() => { for (let i = 0; i < 3; i++) { const x = 0.35 - i * 0.35, hip = [x, 0.86, s * 0.3]; K.anim({ t: 'sway', p: hip, amp: 0.18, speed: 3, ph: i * 1.3 + s }, () => { K.seg(hip, [x + 0.12, 0.48, s * 0.72], 0.03, P.d, 'metal', { seg: 4 }); K.seg([x + 0.12, 0.48, s * 0.72], [x + (i - 1) * 0.25, 0.06, s * 0.88], 0.022, P.d, 'metal', { seg: 4 }); K.sph(x + 0.12, 0.48, s * 0.72, 0.045, P.t, 'metal', { seg: 6 }); }); }
        K.anim({ t: 'sway', p: [1.1, 1.36, s * 0.12], amp: 0.15, speed: 3.4, ph: s }, () => { K.seg([1.1, 1.36, s * 0.12], [1.62, 1.88, s * 0.42], 0.02, P.d, 'metal', { seg: 4 }); K.light(1.62, 1.84, s * 0.42, 0.06, P.l); }); });
    }
  },
  ancora(K, P, tc) { /* 4.3d: Âncora — tripé que crava estacas no chão (coxas blindadas com placa do time, joelhos de latão, canelas com pistão e caneleira, pés com estaca, garras e anel teal), prumo de campo pendurado sob o corpo (pêndulo), núcleo violeta em gaiola de latão, halo hexagonal largo com nós teal (gira devagar), anel do time inclinado (bamboleia), mastro com ponta violeta */
    const E = U.erevane;
    K.base = 0; /* as estacas dos pés afundam no chão */
    const HIP = 4.3;
    [0, 2 * PI / 3, 4 * PI / 3].forEach((a, i) => {
      const ca = Math.cos(a), sa = Math.sin(a), at = (r, y) => [ca * r, y, sa * r];
      const hip = at(0.85, HIP), knee = at(2.75, 5.35), ankle = at(3.4, 0.75), mid = at(1.8, 4.98), shin = at(3.12, 2.9);
      K.anim({ t: 'leg', p: hip, amp: 0.18, stride: 7, ph: i * 2 * PI / 3 }, () => {
        K.seg(hip, knee, 0.3, P.a, 'gloss', { seg: 6 });
        K.box(mid[0], mid[1], mid[2], 2.0, 0.12, 0.62, P.b, 'gloss', { rz: 0.505, ry: -a }); /* blindagem da coxa */
        K.box(mid[0] - ca * 0.04, mid[1] + 0.12, mid[2] - sa * 0.04, 1.6, 0.04, 0.46, tc, 'paint', { rz: 0.505, ry: -a }); /* placa do time */
        K.sph(knee[0], knee[1], knee[2], 0.38, P.t, 'metal', { seg: 10 });
        K.seg(knee, ankle, 0.22, P.b, 'gloss', { seg: 6, taper: 0.7 });
        K.box(shin[0] + ca * 0.16, shin[1], shin[2] + sa * 0.16, 0.08, 1.7, 0.4, P.a, 'gloss', { rz: -0.14, ry: -a }); /* caneleira */
        K.prism(ankle[0], 0.15, ankle[2], 0.42, 0.6, 6, P.d, 'dark', { top: 0.7 });
        K.cone(ankle[0], 0.2, ankle[2], 0.18, 0.75, P.d, 'metal', { rz: PI, seg: 6 });
        K.tor(ankle[0], 0.06, ankle[2], 0.5, 0.05, P.c, null, { e: 2.2, ts: 6, rs: 4 });
        K.fine(() => { K.seg(at(1.6, 4.95), at(3.15, 2.6), 0.07, P.t, 'metal', { seg: 5 }); K.seg(at(1.6, 4.95), at(2.3, 4.0), 0.1, P.d, 'metal', { seg: 6 }); for (let k = 0; k < 3; k++) { const b = a + (k - 1) * 0.9; K.seg([ankle[0] + Math.cos(b) * 0.3, 0.2, ankle[2] + Math.sin(b) * 0.3], [ankle[0] + Math.cos(b) * 0.62, -0.15, ankle[2] + Math.sin(b) * 0.62], 0.05, P.d, 'metal', { taper: 0.3, seg: 4 }); }
          K.cyl(ankle[0], 0.72, ankle[2], 0.3, 0.3, 0.06, P.t, 'metal', { seg: 6 }); K.light(knee[0] + ca * 0.3, knee[1] + 0.2, knee[2] + sa * 0.3, 0.09, P.c, 2); K.box(knee[0], knee[1] + 0.3, knee[2], 0.5, 0.08, 0.42, P.a, 'gloss', { ry: -a }); });
      });
      K.fine(() => { K.cyl(hip[0], hip[1] - 0.2, hip[2], 0.32, 0.32, 0.4, P.t, 'metal', { seg: 8 }); K.tube([at(1.0, 5.2), at(1.9, 5.7), at(2.6, 5.75)], 0.045, P.d, 'rubber', { ts: 8, rs: 5 }); });
    });
    /* corpo: cubo, carcaça sextavada com faixa do time, colar de latão, gaiola com o núcleo violeta (gira), tampa e mastro */
    K.prism(0, 3.7, 0, 0.95, 0.75, 6, P.d, 'dark', { top: 1.35 });
    K.prism(0, 4.45, 0, 1.55, 0.95, 6, P.a, 'gloss', { top: 0.76 });
    K.prism(0, 4.72, 0, 1.47, 0.32, 6, tc, 'paint', { top: 0.95 });
    K.prism(0, 5.38, 0, 1.2, 0.12, 6, P.t, 'metal');
    for (let i = 0; i < 6; i++) { const a = i / 6 * PI * 2 + PI / 6; K.seg([Math.cos(a) * 1.05, 5.45, Math.sin(a) * 1.05], [Math.cos(a) * 0.72, 7.55, Math.sin(a) * 0.72], 0.065, P.t, 'metal', { seg: 5 }); }
    K.anim({ t: 'spin', p: [0, 6.5, 0], speed: 1.3 }, () => K.oct(0, 5.6, 0, 0.62, 1.85, P.l, null, { e: 2.6 }));
    K.prism(0, 7.5, 0, 0.85, 0.24, 6, P.a, 'gloss', { top: 0.65 });
    K.anim({ t: 'sway', p: [0, 7.74, 0], amp: 0.05, speed: 2.2 }, () => { K.prism(0, 7.74, 0, 0.16, 1.5, 4, P.b, 'gloss', { top: 0.35, ry: PI / 4 }); K.oct(0, 9.3, 0, 0.2, 0.55, P.l, null, { e: 3 }); });
    K.fine(() => { for (let i = 0; i < 6; i++) { const a = i / 6 * PI * 2; K.light(Math.cos(a) * 1.5, 4.55, Math.sin(a) * 1.5, 0.12, P.l); E._bolt(K, P, Math.cos(a + 0.5) * 1.12, 5.5, Math.sin(a + 0.5) * 1.12); K.box(Math.cos(a + PI / 6) * 1.3, 5.05, Math.sin(a + PI / 6) * 1.3, 0.05, 0.25, 0.5, P.d, 'metal', { ry: -(a + PI / 6), pat: 0 }); } K.prism(0, 7.74, 0, 0.6, 0.08, 6, P.t, 'metal'); K.prism(0, 3.64, 0, 1.0, 0.07, 6, P.t, 'metal'); for (let i = 0; i < 3; i++) { const a = i / 3 * PI * 2 + PI / 3; K.seg([Math.cos(a) * 0.5, 7.7, Math.sin(a) * 0.5], [Math.cos(a) * 0.6, 8.6, Math.sin(a) * 0.6], 0.03, P.d, 'metal', { seg: 4 }); K.light(Math.cos(a) * 0.6, 8.55, Math.sin(a) * 0.6, 0.08, P.c, 2.4); } });
    /* prumo de campo pendurado sob o corpo (pêndulo): haste de latão, peso facetado, ponta teal que fixa o campo */
    K.anim({ t: 'sway', p: [0, 3.7, 0], amp: 0.06, speed: 1.4 }, () => { K.seg([0, 3.7, 0], [0, 2.35, 0], 0.07, P.t, 'metal', { seg: 6 }); K.oct(0, 1.2, 0, 0.36, 1.2, P.a, 'gloss'); K.oct(0, 0.95, 0, 0.13, 0.4, P.c, null, { e: 2.6 }); K.fine(() => { K.cyl(0, 2.25, 0, 0.2, 0.2, 0.08, P.t, 'metal', { seg: 6 }); K.cyl(0, 1.78, 0, 0.3, 0.3, 0.05, P.c, null, { e: 2, seg: 6 }); }); });
    /* halo hexagonal largo com nós teal (gira devagar) e anel do time inclinado (bamboleia) */
    K.anim({ t: 'spin', p: [0, 6.4, 0], speed: 0.6 }, () => { K.tor(0, 6.4, 0, 3.25, 0.14, P.b, 'gloss', { ts: 6, rs: 4 }); K.tor(0, 6.52, 0, 3.25, 0.05, P.c, null, { e: 2.2, ts: 6, rs: 4 }); ringOf(6, 3.25, (cx, cz) => { K.light(cx, 6.6, cz, 0.18, P.c, 2.4); K.fine(() => { K.prism(cx, 6.2, cz, 0.24, 0.4, 6, P.t, 'metal'); K.prism(cx, 6.1, cz, 0.12, 0.1, 6, P.c, null, { e: 2 }); }); }); });
    K.anim({ t: 'spin', p: [0, 6.9, 0], speed: -1.1 }, () => K.tor(0, 6.9, 0, 1.7, 0.06, tc, null, { e: 1.8, ts: 12, rs: 4, rz: 0.32 }));
  },
  _pano() { return ['#1E2A36', '#25304C', '#3A2E62', '#4C2C5A']; }, /* 4.3e: tons do pano de refração (capa e capuz do atirador): ardósia, índigo, violeta e ameixa escuros */
  _folha(K, G, col, mat, o) { /* 4.3e: folha facetada (dobras de origami) por uma grade de pontos G[linha][coluna] (linhas de cima para baixo, colunas de -z para +z): a frente olha para -x; o.back = cor do avesso; o.iri = brilho da pele iridescente; o.e = emissiva */
    o = o || {}; const fr = [], bk = [];
    for (let r = 0; r < G.length - 1; r++) for (let c = 0; c < G[r].length - 1; c++) { const a = G[r][c], b = G[r][c + 1], d = G[r + 1][c], e = G[r + 1][c + 1]; fr.push(...a, ...d, ...b, ...b, ...d, ...e); bk.push(...a, ...b, ...d, ...b, ...e, ...d); }
    const mk = v => { const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(v, 3)); return g; };
    K._push(mk(fr), col, mat, { flat: true, pat: 0, e: o.e }); if (o.iri && !o.e) U.erevane._iri(K, o.iri, o.dir, o.pal);
    if (o.back) K._push(mk(bk), o.back, o.backMat || mat, { flat: true, pat: 0 });
  },
  _capa(K, P, tc) { /* 4.3e: capa de camuflagem que envolve o corpo (aberta na frente), em dobras de origami de pano de refração escuro com brilho iridescente, presa sob o capuz e as ombreiras, barra dentada com fio teal aceso; balança no ombro ao andar */
    const E = U.erevane, n = K.lite ? 5 : 8, F = 1.95, R = [[7.05, 0.72], [5.7, 1.12], [4.2, 1.22], [2.75, 1.32]], G = R.map(() => []);
    for (let c = 0; c <= n; c++) { const a = -F + c / n * 2 * F, odd = c % 2, ca = Math.cos(a), sa = Math.sin(a);
      R.forEach(([y, r], k) => { const rr = r + (odd && k ? 0.08 * k / 3 + 0.04 : 0); G[k].push([0.1 - rr * ca, k === 3 ? y + (odd ? -0.18 : 0.18) : y, rr * sa]); }); }
    K.anim({ t: 'sway', p: [-0.1, 7.0, 0], amp: 0.08, speed: 2.3 }, () => {
      E._folha(K, G, '#FFFFFF', [0.3, 0.3], { iri: 1, pal: E._pano(), back: P.d });
      E._folha(K, [G[3].map(p => [p[0] * 1.01, p[1] + 0.07, p[2] * 1.01]), G[3].map(p => [p[0] * 1.01, p[1], p[2] * 1.01])], P.c, null, { e: 2.0 });
    });
  },
  _fuzilLongo(K, P, B, th) { /* 4.3e: fuzil longo do atirador — coronha com apoio de rosto, caixa facetada, luneta escura com lente teal, capa com bobinas teal acesas, cano longo, freio de boca com ponta violeta, bipé dobrado (B = coronha no ombro, th = inclinação) */
    const L = K.lite, c = Math.cos(th), s = Math.sin(th), W = (u, v, w) => [B[0] + u * c - v * s, B[1] + u * s + v * c, B[2] + (w || 0)];
    const PO = (pts, d, col, mat, o) => K.poly(pts, d, col, mat, Object.assign({ x: B[0], y: B[1], z: B[2], rz: th }, o));
    const XA = (u, v, r, len, n, col, mat, o) => { const p = W(u, v); K.prism(p[0], p[1], p[2], r, len, n, col, mat, Object.assign({ rz: th - H }, o)); };
    if (L) { PO([[0, -0.3], [0, 0.12], [1.3, 0.22], [2.85, 0.1], [2.85, -0.12], [1.4, -0.13], [1.28, -0.52], [1.08, -0.5], [1.1, -0.15], [0.22, -0.3]], 0.2, P.a, 'gloss'); XA(1.2, 0.42, 0.12, 1.25, 5, P.d, 'dark'); XA(2.8, 0, 0.085, 2.4, 5, P.b, 'gloss'); } /* leve: um contorno, luneta e cano */
    else { PO([[0, -0.3], [0, 0.12], [0.35, 0.17], [1.15, 0.11], [1.15, -0.06], [0.5, -0.1], [0.22, -0.3]], 0.17, P.b, 'gloss'); /* coronha */
      PO([[1.05, -0.14], [1.05, 0.15], [1.3, 0.22], [2.65, 0.2], [2.85, 0.1], [2.85, -0.12], [2.2, -0.18], [1.2, -0.18]], 0.24, P.a, 'gloss', { b: 0.035 }); /* caixa */
      PO([[1.15, -0.13], [1.4, -0.13], [1.28, -0.52], [1.08, -0.5]], 0.14, P.d, 'dark'); /* empunhadura */
      XA(1.2, 0.42, 0.12, 1.25, 8, P.d, 'dark'); XA(2.8, 0, 0.1, 1.0, 6, P.b, 'gloss'); XA(3.8, 0, 0.06, 1.15, 6, P.d, 'metal'); XA(4.95, 0, 0.11, 0.26, 6, P.b, 'gloss'); } /* luneta, capa do cano, cano longo e freio de boca */
    XA(2.45, 0.42, 0.1, 0.04, 8, P.c, null, { e: 1.8 }); XA(5.21, 0, 0.075, 0.06, 6, P.l, null, { e: 2.6 }); /* lente teal e ponta violeta */
    const nb = K.q(3); for (let i = 0; i < nb; i++) XA(2.95 + i * (L ? 0.45 : 0.3), 0, 0.125, 0.06, 6, P.c, null, { e: 2.2 }); /* bobinas teal */
    K.fine(() => { PO([[0.45, 0.12], [1.0, 0.11], [0.95, 0.24], [0.5, 0.22]], 0.12, P.a, 'gloss'); PO([[1.95, -0.12], [2.25, -0.12], [2.2, -0.45], [1.98, -0.42]], 0.15, P.d, 'dark'); /* apoio de rosto e carregador */
      for (const u of [1.5, 2.2]) { const m = W(u, 0.22); K.box(m[0], m[1], m[2], 0.1, 0.18, 0.1, P.t, 'metal', { rz: th }); } XA(1.15, 0.42, 0.135, 0.06, 8, P.t, 'metal'); XA(3.8, 0, 0.085, 0.06, 6, P.t, 'metal'); /* montagens e aros de latão */
      for (const w of [-0.07, 0.07]) K.seg(W(3.9, -0.12, w), W(4.85, -0.16, w * 1.3), 0.025, P.d, 'metal', { seg: 4 }); }); /* bipé dobrado */
  },
  atirador(K, P, tc) { /* 4.3e: Atirador de Fenda — mesmo corpo da infantaria; capuz de duas abas em telhado (pano iridescente escuro) com crista larga da cor do time sobre o capacete curto, olho de luneta violeta, capa de camuflagem em dobras (balança), fuzil longo em pronto-baixo (braços e fuzil recuam mais no tiro) */
    const E = U.erevane, L = K.lite; K.base = 0;
    E._corpo(K, P, tc); E._elmo(K, P, tc, { capuz: true });
    for (const s of [-1, 1]) { K.poly([[0.45, -0.35], [0.2, 0], [-0.5, 0.02], [-1.0, -0.25], [-1.18, -0.95], [-1.0, -1.85], [-0.4, -1.95], [-0.25, -1.1], [0.15, -0.7]], 0.1, '#FFFFFF', [0.3, 0.3], { y: 9.2, z: s * 0.32, rx: -s * 0.3, b: L ? 0 : 0.04 }); E._iri(K, 1, null, E._pano()); } /* abas do capuz */
    K.poly([[-0.36, 9.05], [0.36, 9.05], [0.94, 7.25], [-0.94, 7.25]], 0.1, '#FFFFFF', [0.3, 0.3], { x: -1.1, ry: H }); E._iri(K, 1, null, E._pano()); /* fundo do capuz */
    K.poly([[0.5, 9.0], [0.25, 9.24], [-0.5, 9.27], [-1.02, 9.0], [-1.16, 8.7], [-0.9, 8.8], [-0.45, 9.06], [0.25, 9.02]], 0.66, tc, 'paint', { b: L ? 0 : 0.04 }); /* crista da cor do time */
    E._xc(K, 0.62, 8.06, 0.27, 0.13, 0.15, 0.3, P.d, 'dark', { seg: 8 }); E._xc(K, 0.92, 8.06, 0.27, 0.1, 0.1, 0.03, P.l, null, { e: 2.6, seg: 8 }); /* olho de luneta */
    E._capa(K, P, tc);
    K.anim({ t: 'recoil', dist: 0.45 }, () => { E._braco(K, P, [0.02, 6.62, 0.98], [-0.12, 5.42, 1.06], [1.02, 5.52, 0.47]); E._braco(K, P, [0.02, 6.62, -0.98], [0.78, 5.75, -0.62], [1.76, 5.34, 0.36]); E._fuzilLongo(K, P, [-0.05, 6.32, 0.42], -0.4); });
  },
};
U.tessara = {
  infantaria(K, P, tc, o) { /* 4.3e: Infantaria Orbital — soldado de polímero vivo e osso (uma figura do esquadrão), tronco inclinado em postura de combate: carne escura com peitoral, coxotes e grevas de osso; capuz do capacete, ombreiras e bandoleira da cor do time (ombreira esquerda maior e com espinhos: assimétrico); crânio com nuca alongada, máscara escura, olhos verde-esmeralda enviesados e mandíbulas; fuzil vivo seguro pelos dois braços (recuam juntos no tiro); saco de seiva âmbar nas costas em costelas de osso, com duas folhas que balançam */
    o = o && typeof o === 'object' ? o : {}; const X = U.tessara; /* 4.3e: o build passa a semente no 4º argumento */
    for (const s of [-1, 1]) K.anim(legSpec([0, 3.42, s * 0.48], { amp: 0.5, stride: 8, ph: s > 0 ? 0 : PI }), () => X._pernaSold(K, P, s)); /* 4.3e: pernas balançam do quadril */
    X._ovo(K, 0, 3.6, 0, 0.58, 0.44, 0.8, P.d, 'skin', { seg: 7 }); const m0 = [K.main.length, K.emi.length]; /* 4.3e: quadril; daqui até a mochila tudo inclina para a frente no fim */
    X._ovo(K, -0.06, 4.3, 0, 0.62, 0.85, 0.8, P.d, 'skin', { seg: 7 }); X._ovo(K, 0.2, 4.98, 0, 0.64, 0.7, 0.9, P.b, 'bone', { seg: 10 }); /* 4.3e: tronco de carne e peitoral de osso */
    X._cano(K, [[0.25, 5.62, -0.84], [0.72, 5.12, -0.36], [0.79, 4.6, 0.14], [0.3, 3.78, 0.55]], 0.085, tc, 'skin', { n: 4, k: 2 }); /* 4.3e: bandoleira da cor do time */
    K.fine(() => { for (const s of [-1, 1]) X._ovo(K, 0.5, 5.02, s * 0.4, 0.38, 0.48, 0.42, P.a, 'bone', { seg: 7, rx: s * 0.25 }); }); /* 4.3e: peitorais */
    K.seg([0.02, 5.4, 0], [0.16, 6.1, 0], 0.31, P.d, 'skin', { taper: 0.8, seg: 7 }); X._ovo(K, -0.02, 5.6, 0, 0.42, 0.26, 0.6, P.d, 'skin', { seg: 7 }); /* 4.3e: pescoço grosso e trapézio de carne entre as ombreiras */
    X._ovo(K, 0.17, 6.62, 0, 0.6, 0.6, 0.55, P.a, 'bone', { seg: 11 }); X._ovo(K, -0.3, 6.84, 0, 0.62, 0.34, 0.36, P.b, 'bone', { seg: 9, rz: -0.42 }); /* 4.3e: crânio com a nuca alongada para trás */
    X._ovo(K, -0.04, 6.7, 0, 0.76, 0.58, 0.6, tc, 'skin', { seg: 10, half: true, rz: 0.3 }); /* 4.3e: capuz da cor do time por cima do crânio (deixa a face de osso) */
    K.fine(() => X._ovo(K, 0.55, 6.5, 0, 0.24, 0.3, 0.34, '#2C2620', 'wet', { seg: 8 })); /* 4.3e: máscara escura */
    for (const s of [-1, 1]) { K.box(0.8, 6.54, s * 0.15, 0.12, 0.08, 0.17, '#55E68A', null, { e: 2.2, rx: -s * 0.4 }); X._espinho(K, P, [0.56, 6.28, s * 0.18], [0.84, 5.96, s * 0.09], 0.07); } /* 4.3e: olhos enviesados e mandíbulas */
    K.fine(() => { for (const s of [-1, 1]) { K.box(0.66, 6.7, s * 0.17, 0.22, 0.08, 0.26, P.b, 'bone', { rx: -s * 0.42 }); K.box(0.74, 6.43, s * 0.27, 0.07, 0.05, 0.09, '#55E68A', null, { e: 2.0, rx: -s * 0.4 }); } }); /* 4.3e: sobrancelhas de osso e olhos menores */
    for (let i = 0, n = K.lite ? 2 : 4; i < n; i++) X._espinho(K, P, [0.2 - i * 0.3, 7.22 - i * 0.12, 0], [-0.05 - i * 0.32, 7.62 - i * 0.16, 0], 0.07); /* 4.3e: crista de espinhos de osso no capuz */
    for (const s of [-1, 1]) { const k = s < 0 ? 1.15 : 0.88, z = s * 1.0; X._ovo(K, 0, 5.16, z, 0.7 * k, 0.24 * k, 0.64 * k, P.b, 'bone', { seg: 10, half: true, rx: s * 0.55 }); X._ovo(K, 0, 5.2, z + s * 0.02, 0.62 * k, 0.38 * k, 0.53 * k, tc, 'skin', { seg: 10, half: true, rx: s * 0.55 });
      K.fine(() => X._ovo(K, 0.02, 5.2 + 0.33 * k, z + s * 0.2 * k, 0.52 * k, 0.07, 0.08, P.a, 'bone', { seg: 6, rx: s * 0.55 })); } /* 4.3e: ombreiras — carapaça da cor do time sobre a aba de osso, com quilha de osso */
    for (const [x, h] of [[0.18, 0.55], [-0.18, 0.78]]) X._espinho(K, P, [x, 5.48, -1.26], [x - 0.28, 5.48 + h, -1.62], 0.1); /* 4.3e: espinhos na ombreira esquerda */
    K.fine(() => { for (const s of [-1, 1]) X._foto(K, P, 0.5, 5.36, s * 1.12, 0.07); });
    X._ovo(K, -0.98, 5.0, 0, 0.42, 0.56, 0.5, P.am, 'glass', { seg: 9 }); X._ovo(K, -0.98, 5.07, 0, 0.32, 0.56, 0.38, P.am, null, { seg: 6, e: 1.3, anim: { t: 'bob', amp: 0.05, speed: 3.2 } }); /* 4.3e: saco de seiva âmbar nas costas; o miolo aceso sobe e desce e o brilho no topo pulsa */
    K.fine(() => { for (const z of [-0.22, 0.22]) X._cano(K, [[-0.55, 5.6, z], [-1.12, 5.62, z * 1.25], [-1.46, 5.0, z * 1.3], [-1.12, 4.42, z * 1.25], [-0.55, 4.4, z]], 0.06, P.a, 'bone', { n: 4, k: 1.5 }); }); /* 4.3e: costelas de osso em volta do saco */
    K.cyl(-0.98, 4.9, 0, 0.44, 0.45, 0.16, tc, 'skin', { seg: 10, open: true, sz: 1.17 }); /* 4.3e: cinta da cor do time na mochila (lê de costas) */
    K.oct(-0.95, 5.5, 0, 0.17, 0.26, P.b, 'bone'); for (const [z, az, ph] of [[0.2, PI - 0.75, 0], [-0.2, PI + 0.8, 1.7]]) X._folha(K, -0.98, 5.66, z, az, 0.95, 0.48, 0.18, z > 0 ? '#5DA865' : '#7CC47F', { amp: 0.1, speed: 2.2, ph }); /* 4.3e: broto de osso com duas folhas que balançam */
    X._inclina(K, m0, 0.14, [0, 3.7, 0]); /* 4.3e: tronco, cabeça, ombreiras e mochila inclinam ~8° para a frente */
    if (!o.noRifle) K.anim({ t: 'recoil', dist: 0.32 }, () => X._fuzilSold(K, P)); }, /* 4.3e: braços e fuzil recuam juntos (fora da inclinação: o cano fica nivelado) */
  /* ---------- 4.3e: ajudantes da infantaria (soldado e Quimera) ---------- */
  /* 4.3e: elipsoide com contagem própria (o.seg lados; meia casca com o.half) e menos anéis que K.sph: a figura é pequena; segue o LOD e a versão leve */
  _ovo(K, x, y, z, sx, sy, sz, col, mat, o) { o = o || {}; const w = SG(o.seg || 8), h = o.half ? Math.max(2, Math.round(w * 0.32)) : Math.max(3, Math.round(w * 0.6)); return K._push(new T.SphereGeometry(1, w, h, 0, PI * 2, 0, o.half ? H : PI), col, mat, Object.assign({}, o, { x, y, z, sx, sy, sz })); },
  /* 4.3e: inclina para a frente (giro em z de a radianos em volta do pivô pv) as peças feitas desde a marca m = [main, emi], com os pivôs de animação delas: postura sem refazer as coordenadas */
  _inclina(K, m, a, pv) { const R = new T.Matrix4().makeTranslation(pv[0], pv[1], pv[2]).multiply(new T.Matrix4().makeRotationZ(-a)).multiply(new T.Matrix4().makeTranslation(-pv[0], -pv[1], -pv[2])), v = new T.Vector3();
    for (const p of K.main.slice(m[0]).concat(K.emi.slice(m[1]))) { p.geo.applyMatrix4(R); if (p.an) { v.set(p.an.p[0], p.an.p[1], p.an.p[2]).applyMatrix4(R); p.an.p = [v.x, v.y, v.z]; } } },
  /* 4.3e: perna do soldado (dentro do K.anim da passada): coxa e canela de carne, coxote, joelho e greva de osso, pé de casco com garras */
  _pernaSold(K, P, s) { const X = U.tessara, z = s * 0.5, FD = '#3E3329';
    K.trunk([[0, 3.5, s * 0.47, 0.44], [0.34, 1.98, z, 0.31], [0.0, 0.42, z, 0.23]], '#FFFFFF', 'skin', { n: 7, c0: P.d, c1: '#4A3D31' });
    K.fine(() => X._ovo(K, 0.28, 2.8, z + s * 0.05, 0.34, 0.62, 0.38, P.b, 'bone', { seg: 7, rz: -0.22 }));
    K.oct(0.53, 1.8, z, 0.25, 0.4, P.a, 'bone'); X._ovo(K, 0.29, 1.2, z, 0.24, 0.64, 0.3, P.t, 'bone', { seg: 7, rz: 0.21 }); X._ovo(K, 0.2, 0.2, z, 0.56, 0.24, 0.34, FD, 'bone', { seg: 7 });
    for (const t of (K.lite ? [-1, 1] : [-1, 0, 1])) X._espinho(K, P, [0.56, 0.18, z + t * 0.13], [0.98, 0.02, z + t * 0.22], 0.09, FD);
    K.fine(() => { X._espinho(K, P, [0.62, 2.0, z], [0.95, 2.22, z], 0.07); X._espinho(K, P, [-0.12, 0.3, z], [-0.48, 0.1, z], 0.07, FD); X._veio(K, [[0.05, 3.2, z + s * 0.3], [0.24, 2.55, z + s * 0.32], [0.38, 2.05, z + s * 0.22]], 0.035); }); },
  /* 4.3e: braços e fuzil vivo do soldado (dentro do K.anim do recuo): coronha de osso, câmara de carne, carregador de seiva âmbar, cano de chifre com anéis de osso, boca de dentes e miolo aceso */
  _fuzilSold(K, P) { const X = U.tessara, y = 4.68, z = 0.6, FD = '#3E3329';
    K.trunk([[0.22, 5.3, 1.04, 0.3], [-0.28, 4.8, 1.12, 0.23], [0.3, 4.62, 0.8, 0.18]], '#FFFFFF', 'skin', { n: 6, c0: P.d, c1: '#4A3D31' }); /* braço direito no gatilho */
    K.trunk([[0.26, 5.3, -1.04, 0.3], [0.52, 4.76, -0.98, 0.23], [1.32, 4.6, z - 0.18, 0.18]], '#FFFFFF', 'skin', { n: 6, c0: P.d, c1: '#4A3D31' }); /* braço esquerdo cruza até o guarda-mão */
    K.oct(0.34, 4.46, 0.78, 0.2, 0.34, FD, 'skin'); K.oct(1.36, 4.44, z - 0.15, 0.19, 0.32, FD, 'skin');
    K.fine(() => { K.seg([-0.28, 4.82, 1.12], [0.14, 4.68, 0.88], 0.23, P.b, 'bone', { taper: 0.8, seg: 6 }); K.seg([0.58, 4.74, -0.86], [1.06, 4.65, -0.04], 0.23, P.b, 'bone', { taper: 0.8, seg: 6 }); X._espinho(K, P, [-0.34, 4.86, 1.14], [-0.7, 4.72, 1.24], 0.07); });
    K.seg([-0.55, y + 0.1, z + 0.12], [0.3, y + 0.02, z], 0.14, P.b, 'bone', { taper: 0.75, seg: 5 }); X._ovo(K, 0.78, y, z, 0.62, 0.3, 0.27, P.d, 'skin', { seg: 8 }); X._ovo(K, 0.74, y - 0.32, z, 0.26, 0.22, 0.19, P.am, 'glass', { seg: 7 });
    K.trunk([[1.22, y + 0.02, z, 0.17], [2.0, y + 0.05, z, 0.15], [2.68, y + 0.07, z, 0.14]], '#FFFFFF', 'bone', { n: 7, c0: P.t, c1: P.b });
    for (const x of (K.lite ? [1.75] : [1.55, 2.15])) K.cyl(x, y + 0.04, z, 0.19, 0.19, 0.09, P.a, 'bone', { rz: -H, seg: 8, open: true });
    K.cyl(2.64, y + 0.07, z, 0.24, 0.15, 0.2, P.b, 'bone', { rz: -H, seg: 8, open: true });
    for (let i = 0, n = K.lite ? 2 : 4; i < n; i++) { const a = i / n * PI * 2 + 0.4; X._espinho(K, P, [2.82, y + 0.07 + Math.cos(a) * 0.17, z + Math.sin(a) * 0.17], [3.08, y + 0.07 + Math.cos(a) * 0.06, z + Math.sin(a) * 0.06], 0.05); }
    if (K.lite) K.oct(2.84, y - 0.05, z, 0.12, 0.24, P.am, null, { e: 2.3 }); else X._ovo(K, 2.84, y + 0.07, z, 0.12, 0.12, 0.12, P.am, null, { seg: 6, e: 2.3 });
    K.fine(() => { X._ovo(K, 0.72, y + 0.2, z, 0.46, 0.12, 0.18, P.b, 'bone', { seg: 6 }); X._veio(K, [[0.95, y + 0.17, z + 0.13], [1.6, y + 0.19, z + 0.11], [2.5, y + 0.2, z + 0.09]], 0.03); }); },
  /* 4.3e: perna digitígrada da Quimera (dentro do K.anim da passada): coxa, canela e metatarso de carne, placas de osso, espinho no joelho, esporão e garras */
  _pernaFera(K, P, s) { const X = U.tessara, FD = '#3E3329', z = s * 0.7, hip = [-0.2, 3.1, s * 0.6], kn = [0.4, 2.2, s * 0.72], hk = [-0.4, 1.08, z];
    K.trunk([[hip[0], hip[1], hip[2], 0.46], [kn[0], kn[1], kn[2], 0.34], [hk[0], hk[1], hk[2], 0.22], [0.12, 0.22, z, 0.16]], '#FFFFFF', 'skin', { n: 7, c0: P.d, c1: '#4A3D31' });
    X._ovo(K, 0.12, 2.72, s * 0.84, 0.36, 0.6, 0.3, P.b, 'bone', { seg: 7, rz: -0.6 }); X._espinho(K, P, kn, [kn[0] + 0.35, kn[1] + 0.35, kn[2] + s * 0.08], 0.09); X._espinho(K, P, hk, [hk[0] - 0.42, hk[1] - 0.3, hk[2]], 0.08, FD);
    X._ovo(K, 0.2, 0.18, z, 0.32, 0.17, 0.28, FD, 'bone', { seg: 6 }); for (const t of (K.lite ? [-1, 1] : [-1, 0, 1])) X._espinho(K, P, [0.3, 0.18, z + t * 0.13], [0.78, 0.02, z + t * 0.24], 0.09, FD);
    K.fine(() => { X._ovo(K, -0.06, 1.62, s * 0.74, 0.2, 0.48, 0.24, P.t, 'bone', { seg: 6, rz: 0.62 }); X._veio(K, [[hip[0] + 0.05, hip[1] - 0.2, hip[2] + s * 0.32], [0.15, 2.5, s * 0.98], [kn[0] - 0.05, kn[1] + 0.05, kn[2] + s * 0.2]], 0.035); }); },
  coletor(K, P, tc) { // 4.3: colhedeira viva — flor-mandíbula na frente, carapaça de osso sobre a membrana do time, roseta de folhas no dorso, sacos de seiva âmbar na garupa, seis pernas-raiz
    const LF = '#5DA865', LF2 = '#7CC47F', VN = '#5E7D44';
    const TH = [1.2, 2.45, 2.7, 1.95, 2.4], BR = [3.35, 2.95, 0.95, 0.9, 1.6]; // elipsoides [cx, cy, ax, ay, az] do tórax e da testa
    const on = (x, z, up, E) => { E = E || TH; return [x, E[1] + (E[3] + up) * Math.sqrt(Math.max(0, 1 - ((x - E[0]) / E[2]) ** 2 - (z / E[4]) ** 2)), z]; }; // ponto no topo do elipsoide
    const thorn = (x, y, z, h, rz) => K.cone(x, y, z, 0.11, h, P.t, 'bone', { rz, seg: 5 });
    const spike = (a, b, r, col) => { const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], L = Math.hypot(dx, dy, dz); K.cone(a[0], a[1], a[2], r, L, col || P.t, 'bone', { rz: -Math.asin(dx / L), rx: Math.atan2(dz, dy), seg: 5 }); }; // cone de a apontando para b
    // corpo mole sob as placas
    K.sph(-0.9, 2.1, 0, 1, P.d, 'skin', { sx: 4.85, sy: 1.05, sz: 2.15, seg: 12 });
    // tórax: membrana do time, aba e quilha de osso, nervuras em espinha de peixe, vértebras com espinhos
    K.sph(TH[0], TH[1], 0, 1, tc, 'skin', { half: true, sx: TH[2], sy: TH[3], sz: TH[4], seg: 16 });
    K.sph(TH[0], TH[1] - 0.15, 0, 1, P.b, 'bone', { half: true, sx: TH[2] + 0.25, sy: 0.42, sz: TH[4] + 0.25, seg: 14 });
    K.sph(TH[0], TH[1], 0, 1, P.a, 'bone', { half: true, sx: TH[2] * 1.03, sy: TH[3] * 1.06, sz: 0.55, seg: 12 });
    for (const s of [-1, 1]) for (const x0 of [3.0, 1.9, 0.8, -0.3]) K.tube([0, 0.33, 0.66, 1].map(t => on(x0 - 0.65 * t, s * (0.45 + 1.8 * t), 0.06)), 0.1, P.a, 'bone', { ts: 6, rs: 4 });
    for (const x of [2.9, 1.9, 0.9, -0.1]) { const p = on(x, 0, 0.12); K.sph(p[0], p[1], 0, 0.2, P.b, 'bone', { sy: 0.7, sx: 1.4, seg: 6 }); thorn(p[0] - 0.05, p[1] + 0.08, 0, 0.42, 0.5); }
    for (const s of [-1, 1]) K.sph(2.45, 2.55, s * 1.95, 1, P.a, 'bone', { half: true, sx: 1.0, sy: 0.6, sz: 0.8, rx: s * 0.55, seg: 8 });
    for (const s of [-1, 1]) for (const [x, z] of [[1.89, 1.97], [0.79, 2.02], [-0.25, 1.72]]) { const p = on(x, s * z, 0); K.oct(x, p[1] - 0.12, p[2], 0.17, 0.34, P.l, null, { e: 2.1 }); } // fotóforos entre as nervuras
    // cabeça: testa de osso, viseira de vidro verde, olhos em fileira
    K.sph(3.55, 2.5, 0, 1, P.a, 'bone', { sx: 1.0, sy: 1.25, sz: 1.5, seg: 12 });
    K.sph(BR[0], BR[1], 0, 1, P.b, 'bone', { half: true, sx: BR[2], sy: BR[3], sz: BR[4], seg: 12 });
    K.sph(3.85, 3.05, 0, 1, P.g, 'glass', { sx: 0.7, sy: 0.55, sz: 1.0, seg: 12 });
    for (const s of [-1, 1]) spike([3.35, 3.5, s * 0.7], [2.15, 4.45, s * 1.2], 0.15, P.b);
    for (const s of [-1, 1]) for (const [x, z] of [[3.42, 0.95], [3.7, 0.86], [3.95, 0.72], [3.62, 0.55]]) { const p = on(x, s * z, 0, BR); K.oct(x, p[1] - 0.06, p[2], 0.1, 0.2, P.l, null, { e: 2.2 }); }
    // órgão de colheita: pescoço, cálice inclinado para cima (de cima se vê dentro da flor), pétalas de osso, corola interna da cor do time, estames acesos, mandíbulas-pá
    const FX = 4.55, FY = 2.4, TL = 0.45, cT = Math.cos(TL), sT = Math.sin(TL);
    const fp = (lx, ly, lz) => [FX + lx * cT - ly * sT, FY + lx * sT + ly * cT, lz]; // eixo da flor (x local para fora) → modelo
    K.seg([3.85, 2.5, 0], [FX, FY, 0], 0.55, P.b, 'bone', { taper: 0.9, seg: 10 });
    K.tor(4.2, 2.46, 0, 0.58, 0.11, P.t, 'bone', { rz: H, ts: 10, rs: 4 });
    K.anim({ t: 'sway', p: [FX, FY, 0], amp: 0.06, speed: 1.7 }, () => {
      const c0 = fp(0.12, 0, 0); K.sph(c0[0], c0[1], 0, 0.9, P.t, 'bone', { sx: 0.6, rz: TL, seg: 10 });
      const pet = (al, ph, L, W, col, sg, b) => { const c = fp(b + Math.cos(al) * L, -Math.sin(al) * Math.sin(ph) * L, Math.sin(al) * Math.cos(ph) * L); K.sph(c[0], c[1], c[2], 1, col, 'bone', { sx: L, sy: W, sz: 0.1, ry: -al, rx: ph, rz: TL, order: 'ZXY', seg: sg }); };
      for (let i = 0; i < 6; i++) pet(1.05, -H + i * PI / 3, 0.95, 0.62, i % 2 ? P.a : '#E6DCC4', 8, 0.15);
      for (let i = 0; i < 5; i++) pet(0.72, -H + PI / 5 + i * PI * 0.4, 0.6, 0.38, tc, 6, 0.3);
      const core = fp(0.62, 0, 0); K.sph(core[0], core[1], 0, 0.46, P.l, null, { e: 2.4, seg: 8 });
      for (let i = 0; i < 5; i++) { const a = i * PI * 0.4, b0 = fp(0.85, Math.cos(a) * 0.15, Math.sin(a) * 0.15), tip = fp(1.6, Math.cos(a) * 0.45, Math.sin(a) * 0.45); K.seg(b0, tip, 0.045, P.b, 'bone', { seg: 5 }); K.light(tip[0], tip[1] - 0.08, tip[2], 0.16, P.l, 2.8); } });
    for (const s of [-1, 1]) K.anim({ t: 'sway', p: [4.35, 1.8, s * 0.62], amp: 0.1, speed: 3, ph: s > 0 ? 0 : PI }, () => { const m = [[4.35, 1.8, s * 0.62], [5.1, 1.1, s * 1.5], [5.8, 0.85, s * 1.62], [6.28, 0.78, s * 1.05]];
      K.seg(m[0], m[1], 0.21, P.b, 'bone', { taper: 0.85, seg: 7 }); K.seg(m[1], m[2], 0.18, P.b, 'bone', { taper: 0.8, seg: 7 }); K.seg(m[2], m[3], 0.15, P.a, 'bone', { taper: 0.15, seg: 7 }); K.cone(5.45, 0.95, s * 1.42, 0.08, 0.42, P.a, 'bone', { rx: s * 2.2, seg: 5 }); });
    K.beam = fp(1.1, 0, 0);
    // roseta de folhas fotossintéticas com broto aceso no meio
    K.sph(-1.55, 3.55, 0, 0.55, P.b, 'bone', { sy: 0.9, seg: 8 });
    const leaf = (bx, by, bz, az, el, len, wid, col, ph) => { const c = Math.cos(el), ux = c * Math.cos(az), uy = Math.sin(el), uz = c * Math.sin(az), th = -az;
      K.anim({ t: 'sway', p: [bx, by, bz], amp: 0.05, speed: 1.5, ph }, () => { K.sph(bx + ux * len, by + uy * len, bz + uz * len, 1, col, 'wet', { sx: len, sy: 0.07, sz: wid, ry: th, rz: el, seg: 8 });
        K.seg([bx, by + 0.05, bz], [bx + ux * len * 1.85, by + uy * len * 1.85 + 0.06, bz + uz * len * 1.85], 0.045, '#A9D98F', 'bone', { taper: 0.3, seg: 5 }); }); };
    for (const [az, el, len, wid, col] of [[H, 0.62, 1.2, 0.6, LF], [-H, 0.62, 1.2, 0.6, LF], [PI * 0.78, 0.85, 1.05, 0.52, LF2], [-PI * 0.78, 0.85, 1.05, 0.52, LF2], [0.4, 1.0, 0.85, 0.44, LF2], [-0.4, 1.0, 0.85, 0.44, LF]]) leaf(-1.55, 4.05, 0, az, el, len, wid, col, az);
    K.sph(-1.55, 4.3, 0, 0.32, P.l, null, { e: 1.8, sy: 1.4, seg: 8 });
    // carga: sacos de seiva âmbar (vidro brilhante com miolo aceso aparecendo no topo) num berço de costelas de osso
    const sac = (x, y, z, sx, sy, sz, sg) => { K.sph(x, y, z, 1, P.am, 'glass', { sx, sy, sz, seg: sg }); K.sph(x, y + 0.1, z, 1, P.am, null, { e: 1.6, sx: sx * 0.78, sy, sz: sz * 0.78, seg: sg > 10 ? 10 : 6 }); };
    for (const s of [-1, 1]) sac(-3.15, 2.95, s * 1.05, 1.45, 1.0, 0.95, 12);
    sac(-4.75, 2.8, 0, 0.92, 0.95, 1.3, 12);
    for (const s of [-1, 1]) sac(-4.65, 2.4, s * 1.85, 0.55, 0.55, 0.55, 10);
    for (const [x, D, Hh] of [[-2.0, 2.15, 2.0], [-3.75, 2.2, 1.95], [-5.3, 1.7, 1.6]]) arch(K, x, 2.3, 0, 0.01, Hh, D, H, 0.15, P.a, 'bone', { ts: 12, rs: 5 });
    K.tube([[-2.0, 4.25, 0], [-3.0, 4.2, 0], [-4.1, 4.05, 0], [-4.9, 3.95, 0], [-5.5, 3.4, 0], [-5.75, 2.7, 0]], 0.16, P.a, 'bone', { ts: 12, rs: 6 });
    for (const [x, y] of [[-2.55, 4.3], [-3.2, 4.28], [-4.4, 4.12]]) thorn(x, y, 0, 0.45, 0.45);
    for (const s of [-1, 1]) K.tube([[-1.5, 2.5, s * 2.05], [-3.1, 2.35, s * 2.2], [-4.5, 2.45, s * 2.15], [-5.6, 2.7, s * 1.2]], 0.13, P.b, 'bone', { ts: 7, rs: 4 });
    for (const z of [1.05, -1.05]) K.tube([[-4.3, 3.5, z], [-3.45, 3.95, z + 0.12], [-2.55, 3.88, z - 0.1], [-1.95, 3.45, z]], 0.05, P.t, 'bone', { ts: 8, rs: 4 });
    // cauda: casulo e bico de descarga
    K.sph(-5.6, 2.35, 0, 0.62, P.b, 'bone', { sx: 0.8, seg: 10 });
    K.cyl(-5.9, 2.3, 0, 0.28, 0.38, 0.25, P.t, 'bone', { rz: H, seg: 8 });
    K.light(-6.18, 2.3, 0, 0.24, P.am, 2.4);
    // trepadeiras pelos flancos
    for (const s of [-1, 1]) K.tube([[4.2, 1.9, s * 0.6], [3.4, 1.8, s * 1.45], [2.2, 2.25, s * 2.45], [0.6, 2.6, s * 2.62], [-1.0, 2.3, s * 2.35], [-2.3, 3.15, s * 2.12], [-3.3, 2.35, s * 2.3], [-4.3, 3.05, s * 1.95], [-5.1, 2.45, s * 1.45], [-5.5, 2.6, s * 0.7]], 0.11, VN, 'skin', { ts: 20, rs: 4 });
    for (const s of [-1, 1]) for (const [x, y, z, ry] of [[-2.75, 3.05, 2.35, 0.5], [-4.75, 2.95, 2.0, -0.6]]) K.sph(x, y, s * z, 1, LF, 'wet', { sx: 0.55, sy: 0.05, sz: 0.26, ry: s * ry, rx: s * 0.6, seg: 6 });
    // pernas-raiz grossas de casca sulcada, nó aceso no joelho (trípode: dianteira e traseira juntas, a do meio oposta)
    for (const [hx, hz, kdx, fdx, ph] of [[2.5, 1.55, 0.6, 1.5, 0], [-0.3, 1.9, 0.1, 0.3, PI], [-3.3, 1.8, -0.5, -1.5, 0]]) for (const s of [-1, 1]) {
      const hip = [hx, 2.0, s * hz], knee = [hx + kdx, 2.8, s * 2.95], foot = [hx + fdx, 0.35, s * 3.3];
      K.anim(legSpec(hip, { amp: 0.28, stride: 6, ph: (s > 0 ? 0 : PI) + ph }), () => {
        K.seg(hip, knee, 0.44, P.t, 'rubber', { taper: 0.75, seg: 8 }); K.sph(knee[0], knee[1], knee[2], 0.37, P.t, 'bone', { seg: 6 }); K.oct(knee[0], knee[1] + 0.27, knee[2], 0.14, 0.28, P.l, null, { e: 2.1 });
        K.seg(knee, foot, 0.33, P.t, 'rubber', { taper: 0.45, seg: 8 }); spike(knee, [knee[0] + 0.3, 1.2, s * 3.55], 0.12);
        for (const t of [-1, 0, 1]) spike([foot[0], 0.45, foot[2]], [foot[0] + t * 0.62, 0, foot[2] + s * (0.28 - Math.abs(t) * 0.12)], 0.13); }); } },
  /* ---------- 4.3d: frota Tessara no nível do coletor 4.3a (veículo, drone, suporte, Enxerto, esporo, molde, colosso). Ajudantes com '_' ficam neste bloco (U.tessara._nome) e não viram unidade ---------- */
  // 4.3d: fotóforo (octaedro aceso no verde da Raça; pequeno de propósito: brilho verde grande lê como o recurso Dados)
  _foto(K, P, x, y, z, s, k) { K.oct(x, y - s, z, s * 0.5, s * 2, P.l, null, { e: k || 2.1 }); },
  // 4.3d: espinho de osso de a até b (pirâmide de 4 lados, escura na base e clara na ponta; barato, fica nas duas versões)
  _espinho(K, P, a, b, r, c0) { K.spike(a, b, r, '#FFFFFF', 'bone', { n: 4, c0: c0 || P.t, c1: '#EDE4CC' }); },
  // 4.3d: saco de seiva âmbar (vidro com o miolo aceso aparecendo no topo, como no coletor)
  _saco(K, P, x, y, z, sx, sy, sz, sg, k, col) { K.sph(x, y, z, 1, P.am, 'glass', { sx, sy, sz, seg: sg }); K.sph(x, y + sy * 0.12, z, 1, col || P.am, null, { e: k || 1.5, sx: sx * 0.76, sy, sz: sz * 0.76, seg: Math.max(6, sg - 4) }); },
  // 4.3d: cano liso (curva Catmull-Rom amostrada) montado com trunk: mais barato que tube e com menos lados e trechos na versão leve; raio r → o.r1, o.n lados, o.k amostras por trecho
  _cano(K, pts, r, col, mat, o) { o = o || {}; const c = new T.CatmullRomCurve3(pts.map(p => new T.Vector3(p[0], p[1], p[2]))), m = Math.max(2, Math.round((pts.length - 1) * (o.k || 3) * (K.lite ? 0.5 : 1))), r1 = o.r1 == null ? r : o.r1;
    K.trunk(c.getPoints(m).map((v, i) => [v.x, v.y, v.z, r + (r1 - r) * i / m]), col, mat, { n: o.n || 5, c0: o.c0, c1: o.c1, e: o.e }); },
  // 4.3d: arco (meia elipse em pé no plano de azimute phi; A e D semi-eixos na horizontal, Hh altura, negativo desce) feito com _cano
  _arco(K, x, y, z, A, Hh, D, phi, r, col, mat, o) { const pts = []; for (let i = 0; i <= 6; i++) { const th = i / 6 * PI; pts.push([x + A * Math.cos(th) * Math.cos(phi), y + Hh * Math.sin(th), z + D * Math.cos(th) * Math.sin(phi)]); } U.tessara._cano(K, pts, r, col, mat, Object.assign({ k: 1.3, n: 5 }, o)); },
  // 4.3d: veio aceso (cano fino verde-esmeralda); só na versão completa
  _veio(K, pts, r, k) { K.fine(() => U.tessara._cano(K, pts, r || 0.05, '#55E68A', null, { e: k || 1.5, n: 3, k: 2 })); },
  // 4.3d: folha fotossintética (elipsoide achatado de bx,by,bz no azimute az e elevação el, com nervura) que balança da base
  _folha(K, bx, by, bz, az, el, len, wid, col, o) { o = o || {}; const c = Math.cos(el), ux = c * Math.cos(az), uy = Math.sin(el), uz = c * Math.sin(az);
    const f = () => { K.sph(bx + ux * len, by + uy * len, bz + uz * len, 1, col, 'wet', { sx: len, sy: 0.07, sz: wid, ry: -az, rz: el, seg: 8 }); K.fine(() => K.seg([bx, by + 0.05, bz], [bx + ux * len * 1.85, by + uy * len * 1.85 + 0.06, bz + uz * len * 1.85], 0.035, '#A9D98F', 'bone', { taper: 0.3, seg: 4 })); };
    if (o.sway === false) f(); else K.anim({ t: 'sway', p: [bx, by, bz], amp: o.amp || 0.06, speed: o.speed || 1.5, ph: o.ph != null ? o.ph : az }, f); },
  // 4.3d: escudo de osso hexagonal (placa de casco) assentado no ponto p com a normal n: raio r, espessura h (chanfrado no topo)
  _escudo(K, P, p, n, r, h, col) { const L = Math.hypot(n[0], n[1], n[2]) || 1, nx = n[0] / L, ny = n[1] / L, nz = n[2] / L; K.prism(p[0] - nx * h * 0.35, p[1] - ny * h * 0.35, p[2] - nz * h * 0.35, r, h, 6, col || P.a, 'bone', { top: 0.74, rz: -Math.asin(nx), rx: Math.atan2(nz, ny) }); },
  // 4.3d: casco de escudos hexagonais em grade sobre o domo elipsoide MB = [cx, cy, A, B, C]; ok(x, z, q) escolhe as células, f(p, n, q, i, j) enfeita cada uma
  _escudos(K, P, MB, R, h, ok, f) { const DX = Math.sqrt(3) * R * 1.1, DZ = 1.5 * R * 1.1, nj = Math.ceil(MB[4] / DZ), ni = Math.ceil(MB[2] / DX) + 1;
    for (let j = -nj; j <= nj; j++) for (let i = -ni; i <= ni; i++) { const x = MB[0] + (i + (j & 1 ? 0.5 : 0)) * DX, z = j * DZ, u = (x - MB[0]) / MB[2], w = z / MB[4], q = u * u + w * w; if (q > 1.04 || !ok(x, z, q)) continue;
      const y = MB[1] + MB[3] * Math.sqrt(Math.max(0, 1 - q)), n = [u / MB[2], (y - MB[1]) / (MB[3] * MB[3]), w / MB[4]]; U.tessara._escudo(K, P, [x, y, z], n, R * (q > 0.7 ? 0.84 : 1), h, q > 0.7 ? '#E6DCC4' : (i + j) & 1 ? P.a : P.b); if (f) f([x, y, z], n, q, i, j); } },
  // 4.3d: perna-raiz (família do coletor): coxa de casca sulcada, joelho de osso com fotóforo, canela afinando e garras; balança do quadril (leg)
  _perna(K, P, hip, knee, foot, r, o) { o = o || {}; const s = foot[2] >= 0 ? 1 : -1, X = U.tessara;
    K.anim(legSpec(hip, { amp: o.amp || 0.3, stride: o.stride || 6, ph: o.ph != null ? o.ph : (s > 0 ? 0 : PI) }), () => {
      K.seg(hip, knee, r, o.col || P.t, 'rubber', { taper: 0.8, seg: 8 }); if (K.lite) K.oct(knee[0], knee[1] - r * 0.9, knee[2], r * 0.95, r * 1.8, P.b, 'bone', { ry: 0.4 }); else K.sph(knee[0], knee[1], knee[2], r * 0.92, P.b, 'bone', { seg: 7 }); if (o.foto !== false) X._foto(K, P, knee[0], knee[1] + r * 0.95, knee[2], Math.max(0.09, r * 0.3));
      K.seg(knee, foot, r * 0.8, o.col || P.t, 'rubber', { taper: 0.5, seg: 8 });
      const cl = o.claws == null ? 3 : o.claws; for (let i = 0; i < cl; i++) { const t = cl > 1 ? i / (cl - 1) * 2 - 1 : 0; X._espinho(K, P, [foot[0], foot[1] + r * 0.4, foot[2]], [foot[0] + (t * 1.4 + 0.5) * r, 0, foot[2] + s * (0.6 - Math.abs(t) * 0.35) * r * (cl > 1 ? 1 : 0.2)], r * 0.36); }
      K.fine(() => X._espinho(K, P, knee, [knee[0] - r * 0.5, knee[1] + r * 1.7, knee[2] + s * r * 0.9], r * 0.3)); }); },
  // 4.3d: esteira de músculo — banda de carne em estádio (perfil lateral extrudado em z) com garras de chifre no trecho de cima que rolam com a distância (tread),
  // 4.3d: cubos de osso com raios nas pontas que giram (wheel), capas de chifre sobre as pontas (escondem o salto das garras) e tendão no flanco
  _esteira(K, P, z, L, h, w, o) { o = o || {}; const s = z > 0 ? 1 : -1, r = h / 2, xe = L / 2 - r, b = 0.12, n = K.lite ? 4 : 7, pts = [], X = U.tessara;
    for (let i = 0; i <= n; i++) { const a = -H + i / n * PI; pts.push([xe + Math.cos(a) * (r - b), r + Math.sin(a) * (r - b)]); }
    for (let i = 0; i <= n; i++) { const a = H + i / n * PI; pts.push([-xe + Math.cos(a) * (r - b), r + Math.sin(a) * (r - b)]); }
    K.poly(pts, w - 2 * b, P.d, 'skin', { z, b });
    const nc = K.q(Math.max(4, Math.round(2 * xe / (o.sp || 1.0)))), sp = 2 * xe / nc;
    K.anim({ t: 'tread', spacing: sp }, () => { for (let i = 0; i < nc; i++) K.prism(-xe + (i + 0.5) * sp, h - 0.2, z - (w + 0.1) / 2, 0.24, w + 0.1, K.lite ? 4 : 5, P.t, 'bone', { rx: H }); });
    for (const x of [-xe, xe]) { K.anim({ t: 'wheel', p: [x, r, z], r }, () => { const zo = z + s * (w / 2 - 0.02);
        K.cyl(x, r, zo, r * 0.58, r * 0.66, 0.14, P.b, 'bone', { rx: s * H, seg: 10 });
        for (let i = 0; i < (K.lite ? 1 : 3); i++) { const a = i / 3 * PI * 2 + 0.3; K.box(x + Math.cos(a) * r * 0.3, r + Math.sin(a) * r * 0.3 - 0.06, zo + s * 0.1, r * 0.62, 0.13, 0.12, P.t, 'bone', { rz: a }); }
        K.oct(x, r - r * 0.18, zo + s * 0.16, r * 0.2, r * 0.36, P.t, 'bone', { rx: H }); });
      K.fine(() => K.sph(x + Math.sign(x) * 0.35, h - 0.1, z, 1, P.d, 'bone', { sx: r * 0.62, sy: 0.3, sz: w * 0.54, seg: 8 })); }
    K.fine(() => X._cano(K, [[-xe, r + 0.05, z + s * (w / 2 + 0.03)], [0, r + 0.14, z + s * (w / 2 + 0.07)], [xe, r + 0.05, z + s * (w / 2 + 0.03)]], 0.08, P.t, 'skin', { n: 4, k: 3 })); },
  // 4.3d: corpo baixo de quatro pernas-raiz (suporte e molde): ventre de carne, casco de osso, faixas da cor do time, cabecinha com viseira e olhos
  _base4(K, P, tc, k) { k = k || 1; const X = U.tessara, Y = 1.75 * k;
    K.sph(0, Y, 0, 1, P.d, 'skin', { sx: 2.05 * k, sy: 0.95 * k, sz: 1.5 * k, seg: 12 });
    K.sph(0.05 * k, Y + 0.2 * k, 0, 1, P.a, 'bone', { half: true, sx: 1.95 * k, sy: 0.9 * k, sz: 1.42 * k, seg: 12 });
    for (const s of [-1, 1]) K.sph(-0.1 * k, Y + 0.35 * k, s * 1.12 * k, 1, tc, 'skin', { sx: 1.45 * k, sy: 0.32 * k, sz: 0.3 * k, rx: s * 0.5, seg: 10 });
    K.sph(1.85 * k, Y + 0.1 * k, 0, 1, P.b, 'bone', { sx: 0.62 * k, sy: 0.6 * k, sz: 0.7 * k, seg: 10 }); K.sph(2.3 * k, Y + 0.2 * k, 0, 1, P.g, 'glass', { sx: 0.24 * k, sy: 0.3 * k, sz: 0.5 * k, seg: 8 });
    for (const s of [-1, 1]) X._foto(K, P, 2.15 * k, Y + 0.57 * k, s * 0.34 * k, 0.1 * k);
    for (const [hx, kx, fx, ph] of [[1.05, 1.8, 2.3, 0], [-1.05, -1.75, -2.25, PI]]) for (const s of [-1, 1]) X._perna(K, P, [hx * k, Y - 0.05 * k, s * 1.0 * k], [kx * k, Y + 0.75 * k, s * 2.0 * k], [fx * k, 0.2 * k, s * 2.3 * k], 0.32 * k, { ph: (s > 0 ? 0 : PI) + ph, amp: 0.34, stride: 5 * k });
    for (const s of [-1, 1]) for (const x of [0.9, 0, -0.9]) X._espinho(K, P, [x * k, Y + 1.0 * k, s * 0.75 * k], [(x - 0.35) * k, Y + 1.45 * k, s * 1.0 * k], 0.09 * k); },
  veiculo_hull(K, P, tc) { /* 4.3d: besta-tanque — esteiras de músculo com garras de chifre que rolam, ventre de carne, glacis de osso com quilha e espinhos, membrana do time com costelas grossas em volta do colar da torre, cabeça-aríete com presas e viseira, vinhas com folhas nas bordas, sacos de seiva âmbar na garupa */
    const X = U.tessara, VN = '#4F6B3A', LF = '#5DA865', LF2 = '#7CC47F', ZT = 3.85, TW = 1.9, TH = 2.3, TL = 12.4;
    for (const s of [-1, 1]) X._esteira(K, P, s * ZT, TL, TH, TW);
    // 4.3d: corpo: ventre de carne e membrana do time em domo baixo
    K.sph(-0.2, 1.95, 0, 1, P.d, 'skin', { sx: 6.0, sy: 1.35, sz: 2.95, seg: 14 });
    const MB = [-0.6, 2.35, 5.2, 1.6, 2.8], on = (x, z, up) => [x, MB[1] + (MB[3] + (up || 0)) * Math.sqrt(Math.max(0, 1 - ((x - MB[0]) / MB[2]) ** 2 - (z / MB[4]) ** 2)), z];
    K.sph(MB[0], MB[1], 0, 1, tc, 'skin', { half: true, sx: MB[2], sy: MB[3], sz: MB[4], seg: 16 });
    // 4.3d: glacis: escudos hexagonais de osso sobre a membrana (família do colosso), com espinhos no meio
    X._escudos(K, P, MB, 0.72, 0.36, (x, z) => x > 1.8 && Math.hypot(x, z) > 2.35, (pp, n, q, i, j) => { if (Math.abs(pp[2]) < 0.1) X._espinho(K, P, [pp[0] + 0.1, pp[1] + 0.25, 0], [pp[0] - 0.4, pp[1] + 0.85, 0], 0.15);
      K.fine(() => { if ((i + j) & 1) X._cano(K, [[pp[0] + 0.7, pp[1] - 0.1, pp[2] - 0.15], [pp[0] + 0.1, pp[1] - 0.04, pp[2] + 0.72], [pp[0] - 0.65, pp[1] - 0.1, pp[2] + 0.3]], 0.035, '#55E68A', null, { e: 1.5, n: 3, k: 2 }); }); });
    // 4.3d: costelas grossas em arco sobre a membrana atrás e dos lados do colar
    for (const x of (K.lite ? [-2.45, -3.85] : [-2.2, -3.0, -3.8])) { const p = on(x, 0, 0); X._arco(K, x, MB[1], 0, 0.01, p[1] - MB[1] + 0.12, MB[4] * Math.sqrt(Math.max(0.05, 1 - ((x - MB[0]) / MB[2]) ** 2)) + 0.1, H, 0.2, P.a, 'bone'); }
    for (const s of [-1, 1]) for (const x0 of (K.lite ? [1.1, -0.9] : [1.55, 0.5, -0.55, -1.5])) X._cano(K, [0, 0.5, 1].map(t => on(x0 - 0.35 * t, s * (2.05 + 0.75 * t), 0.08)), 0.12, P.a, 'bone', { n: 4, k: 2 });
    // 4.3d: colar da torre (anel de carne com aro de osso)
    K.cyl(0, 3.3, 0, 1.95, 2.15, 0.62, P.d, 'skin', { seg: 16 }); K.tor(0, 3.88, 0, 1.98, 0.17, P.t, 'bone', { ts: 16, rs: 5 }); K.mount = 3.92;
    // 4.3d: vinhas escuras nas bordas com folhas, fotóforos e veios no flanco
    for (const s of [-1, 1]) { X._cano(K, [[5.4, 2.35, s * 1.85], [4.3, 2.75, s * 2.35], [2.8, 2.95, s * 2.62], [1.2, 2.9, s * 2.72], [-0.7, 2.98, s * 2.7], [-2.5, 2.92, s * 2.62], [-4.0, 2.75, s * 2.45], [-5.4, 2.35, s * 1.95]], 0.09, VN, 'skin', { n: 4, k: 2 });
      for (const [x, y, z, az, col] of [[3.4, 2.98, 2.58, 0.6, LF], [-1.5, 2.98, 2.72, 1.4, LF2], [-4.5, 2.7, 2.35, 2.2, LF]]) X._folha(K, x, y, s * z, s * az, 0.35, 0.42, 0.24, col, { ph: x });
      for (const x of [2.0, -1.0]) X._foto(K, P, x, 2.75, s * 2.82, 0.13); X._veio(K, [[4.2, 2.3, s * 2.6], [2.2, 2.55, s * 2.85], [0, 2.5, s * 2.92], [-2.2, 2.55, s * 2.85], [-4.3, 2.3, s * 2.55]], 0.05); }
    // 4.3d: cabeça-aríete: massa de osso, testa, viseira de vidro, olhos, presas e mandíbulas que balançam
    K.sph(5.75, 1.75, 0, 1, P.b, 'bone', { sx: 1.15, sy: 0.98, sz: 1.3, seg: 12 }); K.sph(5.8, 2.28, 0, 1, P.a, 'bone', { sx: 1.2, sy: 0.55, sz: 1.42, rz: -0.32, seg: 12 });
    K.sph(6.68, 1.95, 0, 1, P.g, 'glass', { sx: 0.4, sy: 0.34, sz: 0.85, seg: 10 }); K.sph(6.55, 1.32, 0, 1, P.d, 'skin', { sx: 0.55, sy: 0.38, sz: 0.75, seg: 8 });
    for (const s of [-1, 1]) { for (const [x, y, z] of [[6.4, 2.55, 0.42], [6.12, 2.7, 0.8], [5.75, 2.76, 1.13]]) X._foto(K, P, x, y, s * z, 0.11);
      K.trunk([[6.45, 1.35, s * 0.95, 0.34], [7.35, 1.35, s * 1.25, 0.24], [8.05, 1.85, s * 1.45, 0.1], [8.3, 2.3, s * 1.45, 0]], '#FFFFFF', 'bone', { n: 7, c0: P.b, c1: '#EDE4CC' });
      K.anim({ t: 'sway', p: [6.6, 1.05, s * 0.5], amp: 0.1, speed: 2.6, ph: s > 0 ? 0 : PI }, () => K.trunk([[6.5, 1.05, s * 0.5, 0.17], [7.3, 0.8, s * 0.42, 0.12], [7.75, 0.95, s * 0.12, 0.02]], P.t, 'bone', { n: 5 })); }
    // 4.3d: garupa: dois sacos de seiva âmbar num berço de costelas, espinhaço até a cauda, respiro aceso
    for (const s of [-1, 1]) X._saco(K, P, -4.8, 2.85, s * 1.12, 1.05, 0.85, 0.92, 12);
    X._arco(K, -5.55, 2.4, 0, 0.01, 1.4, 2.05, H, 0.13, P.a, 'bone');
    X._cano(K, [[-2.0, 3.98, 0], [-3.4, 3.98, 0], [-4.8, 3.78, 0], [-5.75, 3.05, 0], [-6.15, 2.25, 0]], 0.15, P.b, 'bone', { n: 5, k: 2 });
    K.cyl(-6.0, 1.95, 0, 0.32, 0.46, 0.45, P.t, 'bone', { rz: H, seg: 10 }); K.light(-6.5, 1.95, 0, 0.3, P.am, 2.0);
    K.fine(() => { for (const s of [-1, 1]) X._cano(K, [[-3.2, 2.55, s * 2.3], [-4.3, 2.15, s * 2.25], [-5.6, 2.35, s * 1.7]], 0.07, P.t, 'skin', { n: 4, k: 2 }); }); },
  veiculo_turret(K, P, tc) { /* 4.3d: canhão vivo — colar de carne, crânio de osso com crista da cor do time e chifres, cano de chifre escuro em anéis com boca de dentes e miolo aceso (recua), sacos de seiva que alimentam o tiro, bulbo de esporos atrás */
    const X = U.tessara;
    K.cyl(0, 0, 0, 1.72, 1.95, 0.5, P.d, 'skin', { seg: 16 }); K.tor(0, 0.44, 0, 1.76, 0.15, P.t, 'bone', { ts: 16, rs: 5 });
    K.sph(-0.1, 0.95, 0, 1, P.a, 'bone', { sx: 2.35, sy: 1.15, sz: 1.95, seg: 16 });
    K.sph(-0.15, 1.82, 0, 1, tc, 'skin', { half: true, sx: 1.8, sy: 0.55, sz: 0.72, seg: 12 });
    K.fine(() => { for (const s of [-1, 1]) for (let i = 0; i < 5; i++) { const x = 1.3 - i * 0.75, y = 1.95 - Math.abs(x + 0.15) * 0.18; K.oct(x, y - 0.1, s * 1.22, 0.12, 0.2, P.b, 'bone'); } for (const s of [-1, 1]) for (let i = 0; i < 3; i++) K.box(-0.4 - i * 0.42, 0.75, s * 1.9, 0.12, 0.42, 0.1, P.d, 'skin', { ry: s * 0.15 }); });
    for (const s of [-1, 1]) { X._cano(K, [[1.85, 1.45, s * 0.86], [0.6, 2.1, s * 0.98], [-0.9, 2.08, s * 0.98], [-2.15, 1.45, s * 0.8]], 0.15, P.b, 'bone', { n: 5, k: 2 }); X._espinho(K, P, [-1.35, 1.95, s * 0.85], [-2.35, 2.6, s * 1.15], 0.16); }
    K.sph(1.9, 1.42, 0, 1, P.g, 'glass', { sx: 0.3, sy: 0.3, sz: 0.62, rz: -0.5, seg: 10 }); for (const s of [-1, 1]) { X._foto(K, P, 1.72, 1.66, s * 0.66, 0.11); X._foto(K, P, 1.4, 1.86, s * 0.98, 0.1); }
    K.sph(1.95, 0.85, 0, 1, P.d, 'skin', { sx: 0.72, sy: 0.64, sz: 0.78, seg: 10 });
    K.anim({ t: 'recoil', dist: 0.7 }, () => {
      K.trunk([[1.9, 0.95, 0, 0.55], [3.1, 1.0, 0, 0.47], [4.35, 1.05, 0, 0.42], [5.35, 1.1, 0, 0.4], [5.75, 1.1, 0, 0.52]], '#FFFFFF', 'bone', { n: 10, c0: P.t, c1: P.b });
      for (const x of [2.75, 3.85, 4.95]) { const rr = 0.56 - (x - 2.75) * 0.035; K.cyl(x - 0.1, 1.02 + (x - 2.75) * 0.04, 0, rr, rr, 0.2, P.a, 'bone', { rz: -H, seg: 10 }); }
      for (let i = 0; i < K.q(6); i++) { const a = i / K.q(6) * PI * 2 + 0.5; X._espinho(K, P, [5.7, 1.1 + Math.cos(a) * 0.42, Math.sin(a) * 0.42], [6.35, 1.1 + Math.cos(a) * 0.72, Math.sin(a) * 0.72], 0.13); }
      K.sph(5.8, 1.1, 0, 0.3, P.am, null, { e: 2.3, seg: 8 }); X._veio(K, [[2.1, 1.56, 0], [3.8, 1.55, 0], [5.4, 1.56, 0]], 0.05); });
    for (const s of [-1, 1]) { X._saco(K, P, -0.55, 0.72, s * 1.85, 0.8, 0.58, 0.55, 10); X._cano(K, [[-0.2, 0.95, s * 1.62], [0.9, 1.12, s * 1.05], [1.75, 1.0, s * 0.5]], 0.09, P.t, 'skin', { n: 4, k: 2 }); }
    K.bulb([[0.62, 0], [0.88, 0.32], [0.9, 0.75], [0.66, 1.12], [0.26, 1.38], [0, 1.42]], -2.0, 0.95, 0, P.b, 'bone', { n: 10, ribs: 5, rk: 0.08, rz: H });
    K.light(-3.45, 0.95, 0, 0.22, P.am, 2.0); },
  drone(K, P, tc) { /* 4.3d: planador vivo — fuselagem de osso com faixa do time e folhinhas no dorso, asas-folha com dedos de osso e membrana da cor do time (batem), asas de trás de folha, cauda com barbatana que balança, mandíbulas-metralha que recuam, saco de seiva e gavinhas penduradas */
    const X = U.tessara, LF = '#5DA865', LF2 = '#7CC47F';
    K.sph(0, 1.5, 0, 1, P.d, 'skin', { sx: 2.3, sy: 0.68, sz: 0.8, seg: 12 }); K.sph(0.15, 1.62, 0, 1, P.a, 'bone', { half: true, sx: 2.2, sy: 0.72, sz: 0.78, seg: 12 });
    K.sph(-0.35, 2.05, 0, 1, tc, 'skin', { half: true, sx: 1.5, sy: 0.32, sz: 0.42, seg: 10 });
    K.sph(2.2, 1.6, 0, 1, P.b, 'bone', { sx: 0.75, sy: 0.62, sz: 0.66, seg: 10 }); K.sph(2.2, 1.95, 0, 1, P.a, 'bone', { half: true, sx: 0.62, sy: 0.3, sz: 0.68, seg: 8 });
    K.sph(2.82, 1.62, 0, 1, P.g, 'glass', { sx: 0.24, sy: 0.3, sz: 0.48, seg: 8 }); for (const s of [-1, 1]) X._foto(K, P, 2.62, 2.0, s * 0.36, 0.1);
    K.anim({ t: 'recoil', dist: 0.35 }, () => { for (const s of [-1, 1]) { K.trunk([[2.45, 1.2, s * 0.38, 0.17], [3.35, 1.14, s * 0.36, 0.13], [3.85, 1.14, s * 0.34, 0.11]], P.t, 'bone', { n: 6 }); K.light(3.9, 1.08, s * 0.34, 0.17, P.am, 2.2); } });
    for (const s of [-1, 1]) {
      K.anim({ t: 'flap', p: [0.4, 1.95, s * 0.7], amp: 0.32, speed: 7, side: s }, () => {
        if (K.lite) K.sph(-0.05, 2.0, s * 2.9, 1, tc, 'skin', { sx: 1.5, sy: 0.06, sz: 2.35, ry: -s * 0.22, seg: 12 });
        else for (const [x, z, sx, sz, ry] of [[0.25, 4.15, 0.95, 1.25, -0.5], [-0.05, 2.95, 1.25, 1.1, -0.15], [-0.15, 1.6, 1.15, 0.95, 0.15]]) K.sph(x, 2.0, s * z, 1, tc, 'skin', { sx, sy: 0.06, sz, ry: s * ry, seg: 10 });
        X._cano(K, [[0.4, 2.02, s * 0.75], [0.8, 2.14, s * 2.6], [0.3, 2.1, s * 4.4], [-0.25, 2.04, s * 5.2]], 0.11, P.t, 'bone', { n: 5, k: 2, r1: 0.04 });
        for (const [x, z] of [[-0.55, 4.25], [-1.15, 2.7]]) X._cano(K, [[0.35, 2.03, s * 0.8], [(0.35 + x) / 2, 2.07, s * (0.8 + z) / 2], [x, 2.03, s * z]], 0.07, P.b, 'bone', { n: 4, k: 1.5, r1: 0.03 });
        X._foto(K, P, 0.82, 2.25, s * 2.6, 0.11); X._espinho(K, P, [0.8, 2.12, s * 2.6], [1.35, 2.2, s * 2.75], 0.08);
        X._veio(K, [[0.5, 2.09, s * 1.2], [0.1, 2.08, s * 2.8], [-0.4, 2.07, s * 4.2]], 0.035, 1.6); });
      K.anim({ t: 'flap', p: [-1.3, 1.85, s * 0.5], amp: 0.4, speed: 9, ph: 1.3, side: s }, () => {
        K.sph(-1.65, 1.85, s * 1.55, 1, LF2, 'wet', { sx: 0.72, sy: 0.05, sz: 1.12, ry: -s * 0.4, seg: 8 });
        X._cano(K, [[-1.3, 1.88, s * 0.5], [-1.6, 1.9, s * 1.6], [-2.15, 1.88, s * 2.5]], 0.06, P.b, 'bone', { n: 4, k: 1.5, r1: 0.03 }); }); }
    K.anim({ t: 'sway', p: [-2.0, 1.6, 0], amp: 0.12, speed: 2.4 }, () => { K.trunk([[-1.9, 1.6, 0, 0.32], [-2.9, 1.55, 0, 0.22], [-3.8, 1.7, 0, 0.11], [-4.25, 1.82, 0, 0]], '#FFFFFF', 'bone', { n: 6, c0: P.b, c1: P.a });
      K.sph(-3.95, 1.95, 0, 1, LF, 'wet', { sx: 0.55, sy: 0.34, sz: 0.05, rz: 0.3, seg: 8 }); K.fine(() => { for (const s of [-1, 1]) K.sph(-3.85, 1.74, s * 0.32, 1, LF2, 'wet', { sx: 0.42, sy: 0.04, sz: 0.3, ry: -s * 0.3, seg: 6 }); }); });
    K.fine(() => { for (const [x, az] of [[0.55, 2.4], [-0.95, -2.5]]) X._folha(K, x, 2.15, 0, az, 0.55, 0.36, 0.2, LF, { sway: false }); });
    X._saco(K, P, -0.3, 1.0, 0, 0.75, 0.45, 0.55, 10);
    for (const s of [-1, 1]) { K.cyl(-1.75, 1.5, s * 0.42, 0.17, 0.22, 0.3, P.t, 'bone', { rz: H, seg: 8 }); K.light(-2.1, 1.5, s * 0.42, 0.2, P.am, 2.0); }
    for (const [z, ph] of [[0, 0], [0.4, 1.7], [-0.4, 3.1]]) K.anim({ t: 'sway', p: [0.1, 0.95, z], amp: 0.22, speed: 3.2, ph }, () => X._cano(K, [[0.1, 0.95, z], [0.0, 0.35, z * 1.2], [-0.35, -0.35, z * 1.4]], 0.06, P.t, 'skin', { n: 4, k: 2, r1: 0.02 }));
    X._espinho(K, P, [0.9, 2.15, 0], [0.4, 2.65, 0], 0.1); },
  suporte(K, P, tc) { /* 4.3d: suporte/hack vivo — corpo baixo de quatro pernas-raiz, flor-antena virada para cima que gira devagar (pétalas de osso, corola da cor do time, estames e miolo acesos: o emissor do pulso), cérebro com faixas de osso e veios atrás, antenas que balançam */
    const X = U.tessara; X._base4(K, P, tc);
    K.trunk([[-0.2, 2.5, 0, 0.42], [-0.05, 3.25, 0, 0.32], [0.1, 3.95, 0, 0.28]], '#FFFFFF', 'bone', { n: 8, c0: P.t, c1: P.b });
    K.anim({ t: 'spin', p: [0.1, 4.1, 0], speed: 0.8 }, () => { const cx = 0.1, cy = 4.1;
      K.sph(cx, cy, 0, 1, P.b, 'bone', { sx: 0.72, sy: 0.36, sz: 0.72, seg: 10 });
      const np = K.lite ? 6 : 8; for (let i = 0; i < np; i++) { const a = i / np * PI * 2; K.sph(cx + Math.cos(a) * 1.22, cy + 0.42, Math.sin(a) * 1.22, 1, i % 2 ? P.a : '#E6DCC4', 'bone', { sx: 1.0, sy: 0.08, sz: 0.44, ry: -a, rz: 0.42, seg: 8 }); }
      if (K.lite) K.sph(cx, cy + 0.62, 0, 1, tc, 'skin', { sx: 0.95, sy: 0.22, sz: 0.95, seg: 10 }); else for (let i = 0; i < 6; i++) { const a = (i + 0.5) / 6 * PI * 2; K.sph(cx + Math.cos(a) * 0.62, cy + 0.42, Math.sin(a) * 0.62, 1, tc, 'skin', { sx: 0.62, sy: 0.07, sz: 0.3, ry: -a, rz: 0.75, seg: 6 }); }
      K.fine(() => { for (let i = 0; i < 8; i++) { const a = i / 8 * PI * 2, c = Math.cos(a), sn = Math.sin(a); X._cano(K, [[cx + c * 0.45, cy + 0.12, sn * 0.45], [cx + c * 1.2, cy + 0.5, sn * 1.2], [cx + c * 1.9, cy + 0.85, sn * 1.9]], 0.025, '#55E68A', null, { e: 1.3, n: 3, k: 1 });
        X._folha(K, cx + c * 0.4, cy - 0.15, sn * 0.4, a + PI / 8, -0.35, 0.6, 0.22, i % 2 ? '#5DA865' : '#7CC47F', { sway: false }); } });
      K.sph(cx, cy + 0.5, 0, 0.36, P.am, null, { e: 2.0, seg: 8 });
      for (let i = 0; i < K.q(5); i++) { const a = i / K.q(5) * PI * 2 + 0.3, tip = [cx + Math.cos(a) * 0.5, cy + 1.25, Math.sin(a) * 0.5]; K.seg([cx, cy + 0.5, 0], tip, 0.04, P.b, 'bone', { seg: 5 }); K.light(tip[0], tip[1] - 0.07, tip[2], 0.14, '#F6D27A', 2.6); } });
    K.sph(-1.55, 2.7, 0, 1, '#C9A58C', 'wet', { sx: 0.95, sy: 0.72, sz: 0.85, rz: 0.35, seg: 12 }); for (const x of [-1.25, -1.85]) X._arco(K, x, 2.4, 0, 0.01, 0.95, 0.88, H, 0.07, P.b, 'bone', { n: 4 });
    X._veio(K, [[-1.0, 2.65, 0.35], [-1.75, 3.1, 0.3], [-2.25, 2.9, 0.15]], 0.04); X._veio(K, [[-1.0, 2.65, -0.35], [-1.75, 3.1, -0.3], [-2.25, 2.9, -0.15]], 0.04);
    for (const s of [-1, 1]) K.anim({ t: 'sway', p: [2.0, 2.35, s * 0.3], amp: 0.14, speed: 2.8, ph: s > 0 ? 0 : 1.4 }, () => { X._cano(K, [[2.0, 2.35, s * 0.3], [2.4, 3.35, s * 0.6], [2.55, 4.2, s * 0.95]], 0.06, P.t, 'bone', { n: 4, k: 2, r1: 0.03 }); X._foto(K, P, 2.55, 4.32, s * 0.95, 0.11, 2.4); }); },
  pirata(K, P, tc) { /* 4.3d: Enxerto — parasita-carrapato que suga recursos: escudo dorsal da cor do time, abdome inchado de seiva roubada (vidro âmbar com miolo aceso) em gaiola de costelas, probóscide-raiz que balança com ventosa acesa, oito pernas finas escuras, raízes de enxerto arrastando */
    const X = U.tessara, VN = '#4F6B3A';
    // 4.3d: abdome: saco de seiva roubada e costelas
    K.sph(-1.4, 2.0, 0, 1, P.d, 'skin', { sx: 2.4, sy: 1.15, sz: 2.05, seg: 12 });
    X._saco(K, P, -1.45, 2.55, 0, 2.3, 1.55, 2.0, 16, 1.25);
    for (const x of (K.lite ? [-0.6, -2.3] : [-0.35, -1.4, -2.45, -3.3])) { const k = Math.sqrt(Math.max(0.05, 1 - ((x + 1.45) / 2.3) ** 2)); X._arco(K, x, 2.55, 0, 0.01, 1.55 * k + 0.12, 2.0 * k + 0.12, H, 0.12, P.a, 'bone'); }
    X._cano(K, [[-0.2, 4.0, 0], [-1.4, 4.25, 0], [-2.6, 4.0, 0], [-3.55, 3.15, 0], [-3.85, 2.2, 0]], 0.13, P.b, 'bone', { n: 5, k: 2 });
    for (const x of [-0.6, -1.6, -2.6]) X._espinho(K, P, [x, 4.05 + (x === -1.6 ? 0.2 : 0), 0], [x - 0.5, 4.7, 0], 0.12);
    // 4.3d: escudo dorsal (cor do time) com aro de osso, cabeça e olhos
    K.sph(1.15, 2.05, 0, 1, P.b, 'bone', { sx: 1.75, sy: 0.95, sz: 1.68, seg: 12 }); K.sph(1.15, 2.2, 0, 1, tc, 'skin', { half: true, sx: 1.55, sy: 1.0, sz: 1.5, seg: 14 });
    for (const s of [-1, 1]) X._cano(K, [[2.3, 2.6, s * 0.4], [1.3, 3.1, s * 0.85], [0.1, 2.75, s * 1.25]], 0.07, P.b, 'bone', { n: 4, k: 2 });
    K.sph(2.8, 2.0, 0, 1, P.b, 'bone', { sx: 0.8, sy: 0.62, sz: 0.78, seg: 10 }); for (const s of [-1, 1]) { X._foto(K, P, 3.05, 2.5, s * 0.36, 0.1); X._foto(K, P, 2.75, 2.62, s * 0.58, 0.08); }
    for (const s of [-1, 1]) K.anim({ t: 'sway', p: [3.2, 1.75, s * 0.42], amp: 0.16, speed: 3.4, ph: s > 0 ? 0 : 1.6 }, () => K.trunk([[3.2, 1.75, s * 0.42, 0.11], [3.75, 1.35, s * 0.6, 0.07], [4.0, 0.95, s * 0.5, 0.02]], P.t, 'bone', { n: 5 }));
    // 4.3d: probóscide-raiz que balança: anéis, garras e ventosa acesa
    K.anim({ t: 'sway', p: [3.3, 2.1, 0], amp: 0.07, speed: 2.1 }, () => {
      X._cano(K, [[3.2, 2.1, 0], [4.45, 2.5, 0], [5.55, 2.1, 0], [6.25, 1.2, 0], [6.5, 0.6, 0]], 0.3, '#FFFFFF', 'rubber', { n: 8, k: 2.5, r1: 0.14, c0: P.t, c1: VN });
      K.fine(() => { for (const [x, y, a] of [[4.0, 2.42, 0.2], [4.9, 2.38, -0.15], [5.75, 1.85, -0.75]]) K.cyl(x, y, 0, 0.3, 0.3, 0.12, P.b, 'bone', { rz: a - H, seg: 10 }); });
      for (let i = 0; i < 4; i++) { const a = i / 4 * PI * 2 + 0.4; X._espinho(K, P, [6.45, 0.6, 0], [6.5 + Math.cos(a) * 0.45, 0.12, Math.sin(a) * 0.45], 0.08); }
      K.sph(6.5, 0.5, 0, 0.2, P.am, null, { e: 2.3, seg: 8 }); X._veio(K, [[3.5, 2.45, 0], [4.6, 2.78, 0], [5.6, 2.35, 0], [6.25, 1.45, 0]], 0.04); });
    X._veio(K, [[2.4, 2.7, 0.2], [1.2, 3.25, 0.25], [-0.3, 4.05, 0.3], [-1.4, 4.15, 0.45]], 0.045); X._veio(K, [[2.4, 2.7, -0.2], [1.2, 3.25, -0.25], [-0.3, 4.05, -0.3], [-1.4, 4.15, -0.45]], 0.045);
    // 4.3d: oito pernas finas (andar em tetrápode)
    for (const s of [-1, 1]) [[2.0, 0.85, 1.9], [1.15, 0.3, 0.6], [0.25, -0.3, -0.7], [-0.65, -0.85, -1.9]].forEach(([hx, kdx, fdx], i) => X._perna(K, P, [hx, 1.95, s * 1.15], [hx + kdx, 3.05, s * 2.75], [hx + fdx, 0.15, s * 3.65], 0.19, { claws: 1, foto: i % 2 === 0, ph: (s > 0 ? 0 : PI) + (i % 2 ? PI : 0), amp: 0.32, stride: 4.5, col: P.d }));
    // 4.3d: raízes de enxerto arrastando atrás
    for (const [z, ph] of [[0, 0], [0.75, 1.3], [-0.75, 2.4]]) K.anim({ t: 'sway', p: [-3.2, 1.5, z], amp: 0.12, speed: 1.8, ph }, () => { K.trunk([[-3.2, 1.55, z, 0.13], [-3.85, 0.8, z * 1.3, 0.1], [-4.4, 0.25, z * 1.6, 0.07], [-4.85, 0.08, z * 1.85, 0.02]], VN, 'rubber', { n: 5 }); }); },
  quimera(K, P, tc) { /* 4.3e: Quimera — fera adaptativa e curvada: corcunda da membrana do time sob placas hexagonais de osso e fileira de espinhos (os Traços), pernas digitígradas com esporão e garras, cabeça baixa de crânio com chifres para trás, mandíbulas e olhos verde-esmeralda; braço-canhão vivo à direita (recua: anéis de osso, boca de dentes, miolo âmbar e glândula de seiva) e foice de osso à esquerda que balança no passo; cauda com ferrão que balança */
    const X = U.tessara, HB = [-0.1, 4.6, 1.08, 0.92, 1.02]; /* 4.3e: corcunda = elipsoide [cx, cy, A, B, C] */
    const on = (x, z, up) => { const u = (x - HB[0]) / HB[2], w = z / HB[4], y = HB[1] + (HB[3] + (up || 0)) * Math.sqrt(Math.max(0, 1 - u * u - w * w)); return [[x, y, z], [u / HB[2], (y - HB[1]) / (HB[3] * HB[3]), w / HB[4]]]; }; /* ponto e normal no topo da corcunda */
    for (const s of [-1, 1]) K.anim(legSpec([-0.2, 3.1, s * 0.62], { amp: 0.45, stride: 7.5, ph: s > 0 ? 0 : PI }), () => X._pernaFera(K, P, s)); /* 4.3e: pernas digitígradas */
    X._ovo(K, -0.22, 3.2, 0, 0.7, 0.52, 0.82, P.d, 'skin', { seg: 8 }); X._ovo(K, 0.1, 4.05, 0, 0.9, 1.0, 0.94, P.d, 'skin', { seg: 10, rz: -0.5 }); X._ovo(K, 0.7, 4.16, 0, 0.38, 0.54, 0.6, P.b, 'bone', { seg: 10, rz: -0.45 }); /* 4.3e: quadril, tronco inclinado e peito de osso */
    X._ovo(K, HB[0], HB[1], 0, HB[2], HB[3], HB[4], tc, 'skin', { seg: 12, half: true }); /* 4.3e: corcunda da cor do time */
    for (const [x, z, r] of [[0.46, 0, 0.34], [-0.12, 0, 0.36], [-0.7, 0, 0.32]].concat(K.lite ? [] : [[0.14, 0.56, 0.27], [0.14, -0.56, 0.27], [-0.44, 0.6, 0.26], [-0.44, -0.6, 0.26]])) { const [p, n] = on(x, z); X._escudo(K, P, p, n, r, 0.2, z ? P.b : P.a); } /* 4.3e: placas hexagonais de osso (Traços) */
    for (const [x, h] of [[0.17, 0.9], [-0.41, 1.1], [-0.92, 0.8]]) { const [p, n] = on(x, 0, -0.05), L = Math.hypot(n[0], n[1]); X._espinho(K, P, p, [p[0] + (n[0] / L - 0.45) * h, p[1] + n[1] / L * h, 0], 0.12); } /* 4.3e: espinhos dorsais */
    K.fine(() => { for (const s of [-1, 1]) for (const [x, h] of [[-0.15, 0.55], [-0.62, 0.45]]) { const [p, n] = on(x, s * 0.8, -0.04), L = Math.hypot(n[0], n[1], n[2]); X._espinho(K, P, p, [p[0] + (n[0] / L - 0.35) * h, p[1] + n[1] / L * h, p[2] + n[2] / L * h], 0.07); } }); /* 4.3e: espinhos laterais menores (Traços) */
    K.trunk([[0.6, 4.8, 0, 0.36], [1.02, 5.02, 0, 0.3]], '#FFFFFF', 'skin', { n: 6, c0: P.d, c1: P.d }); X._ovo(K, 1.15, 5.08, 0, 0.62, 0.4, 0.45, P.a, 'bone', { seg: 10, rz: -0.12 }); X._ovo(K, 1.66, 4.88, 0, 0.38, 0.22, 0.3, P.b, 'bone', { seg: 8, rz: -0.25 }); /* 4.3e: pescoço, crânio e focinho */
    for (const s of [-1, 1]) { X._espinho(K, P, [1.4, 4.78, s * 0.28], [2.08, 4.46, s * 0.13], 0.1); X._espinho(K, P, [1.02, 5.36, s * 0.24], [0.22, 6.05, s * 0.5], 0.13); K.box(1.68, 5.12, s * 0.24, 0.12, 0.08, 0.13, '#55E68A', null, { e: 2.2, rx: -s * 0.5, ry: s * 0.35 }); } /* 4.3e: mandíbulas, chifres para trás e olhos */
    K.fine(() => { X._ovo(K, 1.55, 4.8, 0, 0.32, 0.1, 0.27, '#2C2620', 'wet', { seg: 7 }); for (const s of [-1, 1]) K.box(1.47, 5.24, s * 0.34, 0.08, 0.05, 0.09, '#55E68A', null, { e: 2.0, rx: -s * 0.5, ry: s * 0.45 }); for (let i = 0; i < 4; i++) X._espinho(K, P, [1.5 + i * 0.1, 4.8, (i - 1.5) * 0.1], [1.52 + i * 0.1, 4.6, (i - 1.5) * 0.09], 0.025); }); /* 4.3e: boca escura, olhos menores e dentes */
    K.fine(() => X._ovo(K, 0.34, 4.74, 1.06, 0.56, 0.28, 0.56, P.b, 'bone', { seg: 10, half: true, rx: 0.55 })); X._ovo(K, 0.34, 4.78, 1.08, 0.47, 0.5, 0.46, tc, 'skin', { seg: 10, half: true, rx: 0.55 }); /* 4.3e: ombreira direita da cor do time */
    X._ovo(K, 0.32, 4.8, -1.06, 0.64, 0.54, 0.62, P.a, 'bone', { seg: 10, half: true, rx: -0.55 }); for (const [x, h, a] of [[0.52, 0.75, 0.2], [0.17, 0.95, 0.45], [-0.13, 0.7, 0.75]]) X._espinho(K, P, [x, 5.15, -1.24], [x - Math.sin(a) * h, 5.15 + Math.cos(a) * h, -1.24 - h * 0.35], 0.1); /* 4.3e: placa de osso com espinhos no ombro esquerdo (Traço) */
    K.anim({ t: 'recoil', dist: 0.26 }, () => { /* 4.3e: braço-canhão vivo (o topo do braço fica sob a ombreira mesmo recuado) */
      K.trunk([[0.42, 4.72, 1.06, 0.29], [0.14, 4.0, 1.24, 0.25], [0.8, 3.92, 1.18, 0.34], [1.55, 3.98, 1.08, 0.3], [1.95, 4.02, 1.02, 0.25]], '#FFFFFF', 'skin', { n: 7, c0: P.d, c1: P.t });
      for (const x of (K.lite ? [1.2] : [0.95, 1.45])) K.cyl(x, 3.96, 1.12, 0.36, 0.36, 0.11, P.a, 'bone', { rz: -H, seg: 9, open: true });
      K.cyl(1.9, 4.02, 1.02, 0.35, 0.24, 0.24, P.b, 'bone', { rz: -H, seg: 9, open: true }); for (let i = 0, n = K.lite ? 3 : 5; i < n; i++) { const a = i / n * PI * 2 + 0.3; X._espinho(K, P, [2.12, 4.02 + Math.cos(a) * 0.27, 1.02 + Math.sin(a) * 0.27], [2.42, 4.02 + Math.cos(a) * 0.09, 1.02 + Math.sin(a) * 0.09], 0.07); }
      if (K.lite) K.oct(2.13, 3.86, 1.02, 0.16, 0.32, P.am, null, { e: 2.3 }); else X._ovo(K, 2.13, 4.02, 1.02, 0.16, 0.16, 0.16, P.am, null, { seg: 6, e: 2.3 }); X._ovo(K, 0.8, 4.32, 1.26, 0.34, 0.24, 0.26, P.am, 'glass', { seg: 8 }); X._ovo(K, 0.8, 4.35, 1.26, 0.26, 0.24, 0.2, P.am, null, { seg: 6, e: 1.4 }); /* 4.3e: sem pulso aqui: a glândula recua com o canhão (uma animação por peça) */ X._veio(K, [[0.4, 4.6, 1.28], [0.85, 4.52, 1.44], [1.6, 4.28, 1.22]], 0.035); K.fine(() => { for (const x of [1.15, 1.55]) X._espinho(K, P, [x, 4.2, 1.08], [x - 0.3, 4.62, 1.12], 0.06); }); });
    K.anim({ t: 'leg', p: [0.32, 4.85, -1.06], amp: 0.34, stride: 7.5, ph: 0 }, () => { /* 4.3e: foice de osso à esquerda (balança no passo, oposta à perna esquerda) */
      K.trunk([[0.32, 4.85, -1.06, 0.3], [0.42, 3.95, -1.28, 0.22], [1.0, 3.6, -1.16, 0.19]], '#FFFFFF', 'skin', { n: 6, c0: P.d, c1: '#4A3D31' });
      X._cano(K, [[0.95, 3.62, -1.16], [1.55, 4.12, -1.12], [2.08, 3.92, -1.06], [2.3, 3.3, -1.0]], 0.15, '#FFFFFF', 'bone', { n: 5, k: 2, r1: 0.015, c0: P.t, c1: '#EDE4CC' }); X._espinho(K, P, [1.0, 3.6, -1.16], [1.45, 3.2, -1.24], 0.08); X._espinho(K, P, [1.0, 3.6, -1.16], [1.35, 3.25, -1.0], 0.08);
      K.fine(() => X._espinho(K, P, [0.4, 4.0, -1.3], [0.07, 3.7, -1.46], 0.08)); });
    K.anim({ t: 'sway', p: [-0.75, 3.25, 0], amp: 0.2, speed: 2.4 }, () => { /* 4.3e: cauda com ferrão */
      K.trunk([[-0.7, 3.3, 0, 0.32], [-1.3, 2.95, 0, 0.24], [-1.8, 2.3, 0, 0.16], [-2.0, 1.6, 0, 0.08]], '#FFFFFF', 'skin', { n: 6, c0: P.d, c1: P.t }); X._espinho(K, P, [-2.0, 1.65, 0], [-2.05, 1.05, 0], 0.09);
      for (const [x, y] of (K.lite ? [[-1.3, 3.12]] : [[-1.05, 3.3], [-1.5, 2.88]])) X._espinho(K, P, [x, y, 0], [x - 0.35, y + 0.35, 0], 0.07); }); },
  esporo(K, P, tc) { /* 4.3d: esporo-sentinela — bexiga de gás em gaiola de costelas de osso, coroa de papilho que gira (de cima lê como estrela) com colar da cor do time, olho-sentinela de vidro com íris acesa, olhos em pedúnculo, ferrão e gavinhas pendurados, esporos-satélite que flutuam */
    const X = U.tessara, BX = '#CFEFD6', C = [0, 2.6, 0];
    K.sph(0, C[1], 0, 1, BX, 'wet', { sx: 1.35, sy: 1.5, sz: 1.35, seg: 16 }); K.sph(0, C[1] + 0.35, 0, 1, tc, 'skin', { half: true, sx: 1.33, sy: 1.18, sz: 1.33, seg: 14 });
    const nm = K.q(3); for (let i = 0; i < nm; i++) { const a = i / nm * PI + 0.3; for (const hh of [1.58, -1.58]) X._arco(K, 0, C[1], 0, 1.42, hh, 1.42, a, 0.075, P.a, 'bone', { n: 4 }); }
    K.tor(0, C[1], 0, 1.4, 0.11, P.t, 'bone', { ts: 20, rs: 5 });
    for (let i = 0; i < K.q(6); i++) { const a = (i + 0.5) / K.q(6) * PI * 2; X._foto(K, P, Math.cos(a) * 1.2, C[1] + 0.75, Math.sin(a) * 1.2, 0.1); }
    // 4.3d: coroa de papilho (gira) com colar da cor do time
    K.anim({ t: 'spin', p: [0, 4.1, 0], speed: 1.1 }, () => {
      K.sph(0, 4.05, 0, 1, P.b, 'bone', { sx: 0.45, sy: 0.3, sz: 0.45, seg: 10 }); K.tor(0, 4.08, 0, 0.5, 0.14, tc, 'skin', { ts: 14, rs: 5 });
      const nf = K.q(12); for (let i = 0; i < nf; i++) { const a = i / nf * PI * 2, tip = [Math.cos(a) * 1.5, 4.7, Math.sin(a) * 1.5]; K.spike([Math.cos(a) * 0.3, 4.2, Math.sin(a) * 0.3], tip, 0.09, P.a, 'bone', { n: 3 }); for (const d of [-0.55, 0, 0.55]) K.spike(tip, [tip[0] + Math.cos(a + d) * 0.4, tip[1] + 0.26, tip[2] + Math.sin(a + d) * 0.4], 0.085, '#FBF7EA', 'bone', { n: 3 }); } });
    // 4.3d: olho-sentinela e olhos em pedúnculo
    K.sph(1.22, 2.5, 0, 1, P.g, 'glass', { sx: 0.4, sy: 0.55, sz: 0.58, seg: 10 }); K.sph(1.5, 2.5, 0, 0.2, P.am, null, { e: 2.4, seg: 8 }); K.cyl(1.05, 2.5, 0, 0.66, 0.6, 0.22, P.b, 'bone', { rz: -H, seg: 12 });
    for (const s of [-1, 1]) K.anim({ t: 'sway', p: [-0.6, 3.3, s * 0.9], amp: 0.14, speed: 2.2, ph: s > 0 ? 0 : 2 }, () => { K.trunk([[-0.6, 3.3, s * 0.9, 0.12], [-1.1, 4.0, s * 1.35, 0.08], [-1.35, 4.35, s * 1.55, 0.06]], P.t, 'bone', { n: 5 }); K.sph(-1.4, 4.45, s * 1.6, 0.2, P.g, 'glass', { seg: 8 }); X._foto(K, P, -1.32, 4.66, s * 1.6, 0.08, 2.4); });
    // 4.3d: ferrão e gavinhas
    K.anim({ t: 'sway', p: [0, 1.15, 0], amp: 0.1, speed: 1.9 }, () => { K.trunk([[0, 1.25, 0, 0.26], [0.05, 0.55, 0, 0.15], [0.2, -0.25, 0, 0]], '#FFFFFF', 'bone', { n: 6, c0: P.t, c1: '#EDE4CC' }); K.light(0.12, 0.05, 0, 0.14, P.am, 2.4); });
    for (let i = 0; i < 4; i++) { const a = i / 4 * PI * 2 + PI / 4; K.anim({ t: 'sway', p: [Math.cos(a) * 0.85, 1.35, Math.sin(a) * 0.85], amp: 0.2, speed: 2.6, ph: i * 1.6 }, () => X._cano(K, [[Math.cos(a) * 0.85, 1.35, Math.sin(a) * 0.85], [Math.cos(a + 0.35) * 1.15, 0.6, Math.sin(a + 0.35) * 1.15], [Math.cos(a + 0.7) * 1.3, -0.15, Math.sin(a + 0.7) * 1.3]], 0.07, P.t, 'skin', { n: 4, k: 2, r1: 0.025 })); }
    // 4.3d: esporos-satélite (flutuam)
    for (let i = 0; i < 3; i++) { const a = i / 3 * PI * 2 + 0.9; K.anim({ t: 'bob', amp: 0.25, speed: 2.2, ph: i * 2.1 }, () => { K.sph(Math.cos(a) * 1.72, 1.85 + i * 0.3, Math.sin(a) * 1.72, 0.2, P.a, 'bone', { seg: 6 }); K.fine(() => X._foto(K, P, Math.cos(a) * 1.72, 2.1 + i * 0.3, Math.sin(a) * 1.72, 0.07, 2.4)); }); } },
  molde(K, P, tc) { /* 4.3d: molde — forma própria sobre a base do suporte (mesmo corpo de quatro pernas): útero de seiva clara com broto aceso dentro, mãos de osso que o moldam, halo da cor do time com espinhos e fotóforos que gira (a aura de +15% de dano), braços-espátula que balançam */
    const X = U.tessara, k = 1.1, W = [-0.15, 3.75, 0]; X._base4(K, P, tc, k);
    K.trunk([[-0.15, 2.55, 0, 0.62], [-0.15, 3.05, 0, 0.5]], P.d, 'skin', { n: 10 });
    X._saco(K, P, W[0], W[1], 0, 1.3, 1.22, 1.3, 16, 1.35, '#F6D27A');
    for (let i = 0; i < 4; i++) { const a = i / 4 * PI * 2 + PI / 4, c = Math.cos(a), sn = Math.sin(a); X._cano(K, [[W[0] + c * 0.55, 2.75, sn * 0.55], [W[0] + c * 1.45, 3.45, sn * 1.45], [W[0] + c * 1.32, 4.55, sn * 1.32], [W[0] + c * 0.72, 5.05, sn * 0.72]], 0.13, P.a, 'bone', { n: 5, k: 2, r1: 0.08 }); X._espinho(K, P, [W[0] + c * 0.72, 5.05, sn * 0.72], [W[0] + c * 0.3, 5.35, sn * 0.3], 0.1); }
    K.anim({ t: 'spin', p: [W[0], 3.6, 0], speed: 0.6 }, () => { K.tor(W[0], 3.6, 0, 2.45, 0.2, tc, 'skin', { ts: 28, rs: 6 });
      for (let i = 0; i < 6; i++) { const a = i / 6 * PI * 2, c = Math.cos(a), sn = Math.sin(a); X._espinho(K, P, [W[0] + c * 2.5, 3.6, sn * 2.5], [W[0] + c * 2.88, 3.98, sn * 2.88], 0.16); X._foto(K, P, W[0] + Math.cos(a + PI / 6) * 2.45, 3.92, Math.sin(a + PI / 6) * 2.45, 0.12, 2.3); } });
    for (const s of [-1, 1]) K.anim({ t: 'sway', p: [1.75, 2.35, s * 0.7], amp: 0.16, speed: 2.0, ph: s > 0 ? 0 : PI }, () => { K.trunk([[1.75, 2.35, s * 0.7, 0.16], [2.4, 2.95, s * 0.95, 0.12], [2.85, 3.15, s * 1.05, 0.09]], P.t, 'bone', { n: 6 }); K.sph(3.05, 3.2, s * 1.08, 1, P.a, 'bone', { sx: 0.32, sy: 0.08, sz: 0.24, rz: 0.4, seg: 8 }); });
    K.fine(() => { for (let i = 0; i < 6; i++) { const a = i / 6 * PI * 2 + 0.25, c = Math.cos(a), sn = Math.sin(a); X._cano(K, [[W[0] + c * 1.05, W[1] - 0.7, sn * 1.05], [W[0] + c * 1.34, W[1] + 0.05, sn * 1.34], [W[0] + c * 1.08, W[1] + 0.75, sn * 1.08], [W[0] + c * 0.45, W[1] + 1.2, sn * 0.45]], 0.035, '#55E68A', null, { e: 1.4, n: 3, k: 2 }); }
      for (let i = 0; i < 12; i++) { const a = (i + 0.5) / 12 * PI * 2; K.sph(W[0] + Math.cos(a) * 2.45, 3.6, Math.sin(a) * 2.45, 0.12, P.b, 'bone', { seg: 6, anim: { t: 'spin', p: [W[0], 3.6, 0], speed: 0.6 } }); } });
    X._veio(K, [[-0.15, 2.7, 1.05], [-0.15, 3.15, 1.3], [-0.15, 4.1, 1.32]], 0.04); X._veio(K, [[-0.15, 2.7, -1.05], [-0.15, 3.15, -1.3], [-0.15, 4.1, -1.32]], 0.04); },
  colosso(K, P, tc) { /* 4.3d: colosso cambiante — tartaruga-titã de cerco: casco em domo de escudos hexagonais de osso com a membrana do time nas juntas, quatro pernas-coluna (coxa de músculo, canela de casca, pé largo com unhas), cabeça de bico com presas, morteiro de chifre anelado no topo (recua), sacos de seiva em alforje, jardim de folhas na garupa */
    const X = U.tessara, LF = '#5DA865', LF2 = '#7CC47F';
    // 4.3d: ventre de carne e domo da membrana do time
    K.sph(-0.3, 6.3, 0, 1, P.d, 'skin', { sx: 5.0, sy: 2.2, sz: 3.15, seg: 16 });
    const MB = [-0.4, 6.8, 4.9, 2.35, 3.2], on = (x, z) => { const u = (x - MB[0]) / MB[2], w = z / MB[4], y = MB[1] + MB[3] * Math.sqrt(Math.max(0, 1 - u * u - w * w)); return [[x, y, z], [u / MB[2], (y - MB[1]) / (MB[3] * MB[3]), w / MB[4]]]; };
    K.sph(MB[0], MB[1], 0, 1, tc, 'skin', { half: true, sx: MB[2], sy: MB[3], sz: MB[4], seg: 18 });
    // 4.3d: escudos hexagonais em grade sobre o domo (a membrana aparece nas juntas); o do meio dá lugar ao morteiro
    X._escudos(K, P, MB, 0.9, 0.46, (x, z) => Math.hypot(x + 0.5, z) >= 1.3, (pp, n, q, i, j) => { if (q < 0.45) X._espinho(K, P, [pp[0] + n[0] * 0.5, pp[1] + 0.3, pp[2] + n[2] * 0.5], [pp[0] - 0.25, pp[1] + 0.72, pp[2] + n[2] * 0.8], 0.16);
      K.fine(() => { if (q < 0.8 && (i + j) % 3 === 0) X._cano(K, [[pp[0] + 0.95, pp[1] - 0.12, pp[2] - 0.2], [pp[0] + 0.15, pp[1] - 0.05, pp[2] + 0.9], [pp[0] - 0.8, pp[1] - 0.1, pp[2] + 0.4]], 0.04, '#55E68A', null, { e: 1.5, n: 3, k: 2 }); }); });
    for (const s of [-1, 1]) { for (const x of [2.6, 0.4, -2.0]) X._foto(K, P, x, 6.55, s * 3.08, 0.16); X._veio(K, [[3.8, 6.2, s * 2.7], [1.8, 6.65, s * 3.12], [-0.3, 6.5, s * 3.2], [-2.5, 6.65, s * 3.1], [-4.3, 6.2, s * 2.55]], 0.06); }
    K.fine(() => { for (const [x, z, az] of [[1.9, 1.15, 0.9], [-1.6, -1.25, -2.0], [2.9, -0.75, -0.5], [-3.0, 1.0, 2.4], [0.6, -2.0, -1.4], [-1.2, 2.1, 1.7]]) { const [pp] = on(x, z); X._folha(K, pp[0], pp[1] + 0.05, pp[2], az, 0.5, 0.42, 0.22, az > 0 ? LF : LF2, { sway: false }); }
      for (let i = 0; i < 8; i++) { const a = (i + 0.5) / 8 * PI * 2; X._foto(K, P, -0.4 + Math.cos(a) * 4.75, 6.95, Math.sin(a) * 3.1, 0.12, 1.8); } });
    // 4.3d: quatro pernas-coluna: coxa de músculo escuro, joelheira de osso, canela de casca sulcada, pé largo com unhas de osso
    for (const [hx, kdx, ph] of [[2.75, 0.5, 0], [-2.95, -0.5, PI]]) for (const s of [-1, 1]) { const hip = [hx, 6.1, s * 2.35], knee = [hx + kdx, 3.35, s * 3.05], foot = [hx + kdx * 0.3, 0, s * 3.2], dk = Math.sign(kdx);
      K.anim(legSpec(hip, { amp: 0.25, stride: 12, ph: (s > 0 ? 0 : PI) + ph }), () => {
        K.trunk([[hip[0], hip[1], hip[2], 1.3], [(hip[0] * 0.55 + knee[0] * 0.45), (hip[1] * 0.55 + knee[1] * 0.45), (hip[2] * 0.55 + knee[2] * 0.45), 1.42], [knee[0], knee[1], knee[2], 0.98]], P.d, 'skin', { n: 10 });
        K.sph(knee[0] + dk * 0.5, knee[1] + 0.15, knee[2], 1, P.a, 'bone', { sx: 0.45, sy: 0.85, sz: 0.85, seg: 10 }); X._foto(K, P, knee[0], knee[1] + 0.35, knee[2] + s * 0.95, 0.15);
        K.trunk([[knee[0], knee[1], knee[2], 0.95], [(knee[0] + foot[0]) / 2, 1.9, (knee[2] + foot[2]) / 2, 0.84], [foot[0], 0.75, foot[2], 0.92]], '#FFFFFF', 'rubber', { n: 10, c0: P.t, c1: '#6E5236' });
        K.cyl(foot[0], 0, foot[2], 1.02, 1.22, 0.82, P.d, 'skin', { seg: 12 });
        K.fine(() => { for (let i = 0; i < 4; i++) { const a = i / 4 * PI * 2 + 0.4, c = Math.cos(a), sn = Math.sin(a); K.trunk([[knee[0] + c * 0.86, knee[1] - 0.2, knee[2] + sn * 0.86, 0.13], [(knee[0] + foot[0]) / 2 + c * 0.8, 1.9, (knee[2] + foot[2]) / 2 + sn * 0.8, 0.15], [foot[0] + c * 0.88, 0.9, foot[2] + sn * 0.88, 0.1]], '#6E5236', 'rubber', { n: 4 }); } });
        for (let i = 0; i < K.q(4); i++) { const a = (K.q(4) > 2 ? -0.75 + i * 0.5 : -0.35 + i * 0.7); K.oct(foot[0] + Math.cos(a) * 1.16, 0.02, foot[2] + Math.sin(a) * 1.16, 0.26, 0.62, '#EDE4CC', 'bone', { sx: 1.25, sz: 0.85, ry: -a, rz: -0.25 }); }
        X._espinho(K, P, [knee[0] + dk * 0.3, knee[1] + 0.7, knee[2] + s * 0.3], [knee[0] - dk * 0.2, knee[1] + 1.8, knee[2] + s * 1.0], 0.2);
        K.fine(() => X._cano(K, [[foot[0] - 0.9, 0.5, foot[2]], [foot[0] - 1.3, 0.24, foot[2] + s * 0.35], [foot[0] - 1.55, 0.12, foot[2] + s * 0.7]], 0.09, P.t, 'rubber', { n: 4, k: 2, r1: 0.05 })); }); }
    // 4.3d: cabeça de bico: pescoço de carne, crânio, testa, bico em gancho, mandíbula que balança, presas e olhos
    K.trunk([[3.9, 6.25, 0, 1.45], [4.75, 5.75, 0, 1.15], [5.35, 5.45, 0, 0.95]], P.d, 'skin', { n: 10 }); K.fine(() => { for (const [x, y, r] of [[4.45, 5.95, 1.3], [4.95, 5.65, 1.12]]) K.tor(x, y, 0, r, 0.1, P.d, 'skin', { rz: H - 0.55, ts: 16, rs: 4 }); });
    K.sph(5.5, 5.45, 0, 1, P.b, 'bone', { sx: 1.25, sy: 1.05, sz: 1.15, seg: 12 }); K.sph(5.6, 6.1, 0, 1, P.a, 'bone', { sx: 1.15, sy: 0.45, sz: 1.25, rz: -0.25, seg: 10 });
    K.trunk([[6.25, 5.55, 0, 0.66], [6.95, 5.25, 0, 0.45], [7.35, 4.75, 0, 0.14], [7.42, 4.45, 0, 0]], '#FFFFFF', 'bone', { n: 8, c0: P.a, c1: '#EDE4CC' });
    K.anim({ t: 'sway', p: [5.8, 4.85, 0], amp: 0.08, speed: 1.8 }, () => { K.trunk([[5.8, 4.85, 0, 0.6], [6.6, 4.6, 0, 0.38], [7.0, 4.55, 0, 0.1]], P.d, 'skin', { n: 7 }); K.fine(() => { for (const z of [-0.3, 0, 0.3]) K.trunk([[6.1, 4.45, z, 0.07], [6.15, 3.9, z * 1.3, 0.05], [6.0, 3.45, z * 1.5, 0.01]], '#4F6B3A', 'rubber', { n: 4 }); }); });
    for (const s of [-1, 1]) { for (const [x, y, z] of [[6.15, 5.78, 0.82], [5.85, 6.0, 1.02]]) X._foto(K, P, x, y, s * z, 0.15);
      K.trunk([[6.0, 4.85, s * 0.8, 0.36], [6.95, 4.55, s * 1.3, 0.27], [7.65, 5.0, s * 1.55, 0.13], [7.85, 5.6, s * 1.55, 0]], '#FFFFFF', 'bone', { n: 7, c0: P.b, c1: '#EDE4CC' }); }
    // 4.3d: morteiro de chifre: monte de carne com aro, cano anelado inclinado para cima (escuro na base, claro na boca), lábio e dentes, miolo aceso, culatra de esporos; recua inteiro
    K.sph(-0.5, 9.0, 0, 1, P.d, 'skin', { sx: 1.6, sy: 0.9, sz: 1.6, seg: 12 }); K.tor(-0.5, 9.55, 0, 1.4, 0.26, P.t, 'bone', { ts: 18, rs: 5 });
    const BA = 0.38, cb = Math.cos(BA), sb = Math.sin(BA), bp = d => [-0.5 + cb * d, 10.05 + sb * d, 0];
    K.anim({ t: 'recoil', dist: 1.0 }, () => {
      const nb = K.lite ? 6 : 12; K.trunk(Array.from({ length: nb + 1 }, (_, i) => { const d = i / nb * 6.0; return bp(d).concat([1.02 - d * 0.03 + (K.lite ? 0 : (i % 2 ? -0.06 : 0.05))]); }), '#FFFFFF', 'bone', { n: 12, c0: P.t, c1: P.a });
      const m = bp(6.0); K.cyl(m[0], m[1], 0, 1.18, 0.9, 0.42, P.a, 'bone', { rz: BA - H, seg: 12 });
      for (let i = 0; i < K.q(7); i++) { const a = i / K.q(7) * PI * 2, ox = -sb * Math.cos(a), oy = cb * Math.cos(a), oz = Math.sin(a); X._espinho(K, P, [m[0] + cb * 0.3 + ox * 0.95, m[1] + sb * 0.3 + oy * 0.95, oz * 0.95], [m[0] + cb * 0.95 + ox * 1.35, m[1] + sb * 0.95 + oy * 1.35, oz * 1.35], 0.2); }
      K.sph(m[0] + cb * 0.3, m[1] + sb * 0.3, 0, 0.62, P.am, null, { e: 2.3, seg: 10 });
      K.bulb([[0.95, 0], [1.25, 0.45], [1.25, 1.05], [0.9, 1.55], [0.35, 1.85], [0, 1.9]], -0.75, 9.85, 0, P.b, 'bone', { n: 12, ribs: 6, rk: 0.08, rz: H + BA });
      X._veio(K, [0.6, 3.0, 5.4].map(d => { const c = bp(d), rr = 1.02 - d * 0.03 + 0.12; return [c[0] - sb * rr, c[1] + cb * rr, 0]; }), 0.07); });
    // 4.3d: sacos de seiva em alforje nos flancos, com tubos até o morteiro e cinta de osso
    for (const s of [-1, 1]) { X._saco(K, P, -0.55, 6.0, s * 3.3, 1.25, 1.0, 0.72, 12); X._cano(K, [[-0.55, 6.9, s * 3.15], [-0.55, 8.4, s * 2.35], [-0.5, 9.35, s * 1.2]], 0.14, P.t, 'skin', { n: 5, k: 2 }); X._arco(K, -0.55, 5.7, s * 3.3, 0.01, 1.15, 0.85, H, 0.1, P.b, 'bone', { n: 4 }); }
    // 4.3d: jardim de folhas fotossintéticas na garupa, broto aceso
    const g = on(-3.5, 0)[0]; K.sph(g[0], g[1] + 0.2, 0, 0.5, P.b, 'bone', { sy: 0.8, seg: 8 });
    for (const [az, el, len, wid, col] of [[PI, 0.55, 1.3, 0.58, LF], [PI * 0.72, 0.75, 1.05, 0.48, LF2], [-PI * 0.72, 0.75, 1.05, 0.48, LF2], [PI * 0.5, 0.95, 0.85, 0.4, LF], [-PI * 0.5, 0.95, 0.85, 0.4, LF]]) X._folha(K, g[0], g[1] + 0.5, 0, az, el, len, wid, col, { amp: 0.06, speed: 1.4 });
    K.sph(g[0], g[1] + 0.8, 0, 0.3, P.l, null, { e: 1.8, sy: 1.4, seg: 8 });
    // 4.3d: cauda curta que balança
    K.anim({ t: 'sway', p: [-5.0, 6.2, 0], amp: 0.1, speed: 1.6 }, () => { K.trunk([[-4.9, 6.3, 0, 0.6], [-5.8, 5.8, 0, 0.42], [-6.4, 4.95, 0, 0.18], [-6.55, 4.35, 0, 0]], '#FFFFFF', 'bone', { n: 8, c0: P.b, c1: P.a }); K.fine(() => { for (const [x, y] of [[-5.3, 6.55], [-5.95, 6.0], [-6.4, 5.25]]) X._espinho(K, P, [x, y, 0], [x - 0.45, y + 0.45, 0], 0.14); }); }); },
};
U.quorith = {
  infantaria(K, P, tc) { /* 4.3e: Corista — soldado de cristal (_soldado) com fuzil de ressonância nas duas mãos: coronha escura, caixa violeta com célula acesa, cano de cristal e boca em diapasão (antebraços, mãos e fuzil recuam juntos); ressonador nas costas com tampa na cor do time e duas antenas que balançam */
    const Q = U.quorith, yr = 2.94, zr = 0.33, X = [1, 0, 0];
    const sh = Q._soldado(K, P, tc, { stride: 10 });
    /* braços de cima (parados): o direito desce ao lado do corpo, o esquerdo cruza para a frente */
    Q._bip(K, sh[1], [-0.12, 2.98, 0.74], 0.17, P.d, 'gloss', { n: 5, st: [[0, 0.85], [0.3, 1], [1, 0.62]] });
    Q._bip(K, sh[0], [0.2, 3.02, -0.68], 0.17, P.d, 'gloss', { n: 5, st: [[0, 0.85], [0.3, 1], [1, 0.62]] });
    K.fine(() => { K.oct(-0.12, 2.86, 0.74, 0.11, 0.26, P.t, 'crystal'); K.oct(0.2, 2.9, -0.68, 0.11, 0.26, P.t, 'crystal'); });
    K.anim({ t: 'recoil', dist: 0.26 }, () => {
      Q._bip(K, [-0.12, 2.98, 0.74], [0.22, yr - 0.08, zr + 0.1], 0.15, P.a, 'crystal', { n: 5, st: [[0, 0.75], [0.35, 1], [1, 0.62]] });
      Q._bip(K, [0.2, 3.02, -0.68], [0.78, yr - 0.02, zr - 0.14], 0.15, P.a, 'crystal', { n: 5, st: [[0, 0.75], [0.35, 1], [1, 0.62]] });
      for (const [x, z] of [[0.24, zr + 0.08], [0.8, zr - 0.15]]) K.oct(x, yr - 0.2, z, 0.13, 0.34, P.d, 'gloss');
      Q._pr(K, -0.46, yr - 0.02, zr, 0.13, 0.6, P.d, 'gloss', { ax: X, top: 1.3 });
      Q._pr(K, 0.12, yr, zr, 0.2, 0.56, P.t, 'crystal', { ax: X, top: 0.8 });
      Q._pr(K, 0.16, yr + 0.15, zr, 0.095, 0.44, P.c, null, { ax: X, e: 2.2 });
      Q._pr(K, 0.66, yr, zr, 0.1, 0.64, P.l, 'crystal', { ax: X });
      Q._dot(K, 1.36, yr, zr, 0.08, P.c, 2.8);
      for (const k of [-1, 1]) Q._bip(K, [1.12, yr + k * 0.07, zr], [1.56, yr + k * 0.15, zr], 0.075, P.a, 'crystal', { n: 4, f: 0.3 });
      K.fine(() => { Q._pr(K, 1.0, yr, zr, 0.15, 0.12, P.c, null, { ax: X, e: 2 });
        Q._bip(K, [0.34, yr - 0.12, zr], [0.5, yr - 0.56, zr], 0.1, P.b, 'crystal', { n: 4, f: 0.4, sq: 0.6 });
        for (const x of [0.8, 0.92]) Q._pr(K, x, yr, zr, 0.12, 0.05, P.t, 'crystal', { ax: X }); Q._bip(K, [-0.4, yr + 0.08, zr], [-0.04, yr + 0.24, zr], 0.06, P.b, 'crystal', { n: 4, f: 0.5 }); for (const k of [-1, 1]) Q._dot(K, 0.4, yr + 0.02, zr + k * 0.2, 0.04, P.l, 2.4); Q._bip(K, [0.18, yr + 0.22, zr], [0.58, yr + 0.3, zr], 0.07, P.l, 'crystal', { n: 4, st: [[0, 0.6], [0.3, 1], [1, 0.5]] }); for (const k of [-1, 1]) Q._bip(K, [0.7, yr, zr + k * 0.08], [0.95, yr, zr + k * 0.2], 0.05, P.b, 'crystal', { n: 4, sq: 0.4, f: 0.3 }); });
    });
    /* ressonador nas costas: caixa escura, tampa na cor do time e antenas que balançam (células acesas e aletas na completa) */
    Q._pr(K, -0.36, 2.66, 0, 0.32, 0.9, P.d, 'gloss', { top: 0.86, sx: 0.66 });
    Q._pr(K, -0.36, 3.56, 0, 0.275, 0.18, tc, 'crystal', { top: 0.62, sx: 0.66 });
    for (const s of [-1, 1]) K.anim({ t: 'sway', p: [-0.42, 3.66, s * 0.14], amp: 0.11, speed: 2.6, ph: s * 1.1 }, () => {
      Q._bip(K, [-0.42, 3.6, s * 0.14], [-0.6, 4.62, s * 0.22], 0.07, P.l, 'crystal', { n: 4, st: [[0, 1], [0.2, 1], [1, 0.3]] });
      Q._dot(K, -0.61, 4.68, s * 0.22, 0.08, P.c, 2.6); });
    K.fine(() => { for (const s of [-1, 1]) { Q._bip(K, [-0.53, 2.78, s * 0.15], [-0.53, 3.46, s * 0.15], 0.085, P.c, null, { e: 2, n: 4, st: [[0, 0.6], [0.5, 1], [1, 0.6]] }); Q._bip(K, [-0.3, 2.72, s * 0.32], [-0.5, 3.5, s * 0.34], 0.08, P.t, 'crystal', { n: 4, f: 0.5 }); } Q._dot(K, -0.6, 3.05, 0, 0.06, P.l, 2.4); for (let i = 0; i < 3; i++) Q._bip(K, [-0.5, 2.78 + i * 0.26, 0], [-0.68, 2.9 + i * 0.26, 0], 0.08, P.b, 'crystal', { n: 4, sq: 0.35, up: [0, 0, 1], f: 0.3 }); });
  },
  coletor(K, P, tc) { // 4.3: colhedor de cristal levitante — núcleo escuro entre placas facetadas, diapasão com lente focal (feixe), cápsulas de ressonância na cor do time, gaiola de carga acesa, aletas harmônicas e lascas em órbita
    const L6 = (x, y, z, L, W, h, top, col, mat, o) => K.prism(x, y, z, 1, h, 6, col, mat, Object.assign({ top, sz: L, sx: W / 0.866, ry: H }, o)); // losango hexagonal ao longo de x (pontas na frente e atrás)
    const X6 = (x, y, z, r, h, col, mat, o) => K.prism(x, y, z, r, h, 6, col, mat, Object.assign({ rz: -H }, o)); // prisma deitado, de x para a frente
    const bar = (a, b, r, col, mat, n) => K.seg(a, b, r, col, mat, { seg: n || 5, flat: true });
    const glo = (a, b, r, col, k) => K.seg(a, b, r, col, null, { e: k || 2.2, seg: 5 });
    const dot = (x, y, z, r, col, k) => K.oct(x, y - r, z, r, r * 2, col, null, { e: k || 2.6 }); // luz facetada
    // planta do dorso (x, meia-largura) e placas: polígono deitado, inclinado para fora a partir da borda interna
    const OUT = [[-2.3, 0], [-1.6, 1.15], [-0.6, 1.85], [1.4, 1.85], [2.6, 1.15], [3.3, 0]];
    const zOut = x => { for (let i = 1; i < OUT.length; i++) if (x <= OUT[i][0]) { const [xa, za] = OUT[i - 1], [xb, zb] = OUT[i]; return za + (zb - za) * (x - xa) / (xb - xa); } return 0; };
    const band = (x0, x1, za, zb, m) => { m = m || 0; const xs = [x0, x1]; for (const [x] of OUT) if (x > x0 && x < x1) xs.push(x); // faixa za..min(zb, contorno − m) entre x0 e x1, como (x, distância da borda interna)
      for (let i = 1; i < OUT.length; i++) { const [xa, z1] = OUT[i - 1], [xb, z2] = OUT[i]; if ((z1 - m - zb) * (z2 - m - zb) < 0) { const xc = xa + (zb + m - z1) / (z2 - z1) * (xb - xa); if (xc > x0 && xc < x1) xs.push(xc); } }
      xs.sort((a, b) => b - a); return [[x0, 0], [x1, 0]].concat(xs.map(x => [x, Math.min(zb, zOut(x) - m) - za])); };
    const plate = (pts, s, y, zi, d, c, col, mat, b) => K.poly(pts.map(([x, w]) => [x, -s * w]), d, col, mat, { y, z: s * zi, rx: -H + s * c, b: b == null ? 0.06 : b, flat: true });
    const fin = (x, y, z, s, th, len, w, col) => K.cone(x, y, z, 1, len, col, 'crystal', { seg: 4, flat: true, rz: H, sx: 0.09, sz: w / 2, ry: s * th }); // lâmina: larga na raiz, ponta para trás
    L6(0.5, 0, 0, 1.5, 0.6, 0.03, 1, P.c, null, { e: 1.1 }); // foco do campo de levitação no chão, sob a quilha
    K.anim({ t: 'spin', p: [0.5, 0, 0], speed: -0.8 }, () => ringOf(8, 3.0, (dx, dz, a, i) => K.oct(0.5 + dx, 0.35, dz, 0.12, 0.75, i % 2 ? P.t : P.a, 'crystal'))); // lascas baixas em órbita
    K.anim({ t: 'bob', amp: 0.14, speed: 1.6 }, () => {
      // casco: quilha, emissores de levitação, pavilhão e núcleo escuro com costura acesa e nervuras
      K.oct(0.5, 0.55, 0, 0.42, 1.3, P.t, 'crystal', { sx: 3 }); dot(0.5, 0.65, 0, 0.12, P.c);
      for (const [x, z] of [[-0.9, 0.85], [-0.9, -0.85], [1.9, 0.85], [1.9, -0.85]]) { K.cone(x, 1.25, z, 0.26, 0.5, P.t, 'crystal', { seg: 6, flat: true, rx: PI }); dot(x, 0.78, z, 0.09, P.c, 2.2); }
      L6(0.5, 0.85, 0, 1.6, 1.0, 0.6, 1.75, P.d, 'gloss'); L6(0.5, 1.45, 0, 2.8, 1.75, 1.85, 0.94, P.d, 'gloss');
      L6(0.5, 2.0, 0, 2.86, 1.8, 0.12, 1, P.c, null, { e: 1.8 });
      for (const s of [-1, 1]) for (let x = -0.7; x < 1.8; x += 0.4) K.box(x, 1.5, s * 1.72, 0.1, 1.25, 0.24, P.t, 'crystal');
      // casca de cristal do dorso: duas fileiras de placas por lado (a de fora mais inclinada), frestas com o núcleo aceso, friso violeta e canal central escuro
      const zi = 0.36, zm = 1.12, zo = 1.22, c1 = 0.14, c2 = 0.55, yi = 3.42, yo = 3.27;
      const rim = (pts, s, y, zp, c, cap) => { const q = pts.slice(2); for (let i = 0; i < q.length - 1; i++) { const [xa, wa] = q[i], [xb, wb] = q[i + 1]; if (cap && wa > cap - 0.01 && wb > cap - 0.01) continue; bar([xa, y - wa * Math.sin(c), s * (zp + wa * Math.cos(c))], [xb, y - wb * Math.sin(c), s * (zp + wb * Math.cos(c))], 0.055, P.t, 'crystal'); } };
      for (const s of [-1, 1]) for (const [x0, x1] of [[-2.0, -0.75], [-0.45, 1.05], [1.35, 3.0]]) {
        const pi = band(x0, x1, zi, zm); plate(pi, s, yi, zi, 0.22, c1, P.b, 'crystal'); rim(pi, s, yi, zi, c1, zm - zi);
        plate(band(x0 + 0.2, x1 - 0.2, zi + 0.15, zm - 0.12, 0.2), s, yi + 0.2, zi + 0.15, 0.07, c1, P.a, 'crystal', 0.05);
        const xg = (x0 + x1) / 2, wg = Math.min(zm, zOut(xg) - 0.2) - zi; L6(xg, yi + 0.3 - (wg * 0.5) * Math.sin(c1), s * (zi + wg * 0.5), Math.min(0.4, (x1 - x0) * 0.22), Math.min(0.2, wg * 0.28), 0.12, 0.55, P.l, 'crystal', { rz: s * c1 });
        const xa = Math.max(x0, -1.3), xb = Math.min(x1, 2.25); if (xb - xa > 0.3) { const po = band(xa, xb, zo, 9); plate(po, s, yo, zo, 0.18, c2, P.b, 'crystal'); rim(po, s, yo, zo, c2); }
      }
      for (const s of [-1, 1]) dot(3.05, 3.55, s * 0.5, 0.07, P.l, 2.4);
      L6(0.5, 3.15, 0, 2.6, 0.32, 0.62, 0.35, tc, 'crystal'); for (const s of [-1, 1]) K.box(0.45, 3.22, s * 0.3, 4.3, 0.12, 0.1, tc, null, { e: 1.2 }); // crista na cor do time entre dois filetes acesos
      K.oct(-1.95, 3.3, 0, 0.16, 1.3, P.t, 'crystal', { rz: H }); // espinho de cauda apontando para a carga
      for (const x of [-0.6, 1.2]) { K.box(x, 3.2, 0, 0.09, 0.12, 3.3, P.c, null, { e: 2.2 }); K.box(x, 3.42, 0, 0.18, 0.4, 0.66, P.t, 'crystal'); }
      // cápsulas de ressonância: aduelas de cristal em volta de um núcleo na cor do time (janela aberta em cima) e aletas harmônicas na cauda
      for (const s of [-1, 1]) { const z = s * 2.8, y = 2.25;
        X6(-1.05, y, z, 0.36, 3.3, tc, null, { e: 1.15 });
        for (let i = 1; i < 6; i++) { const f = i * PI / 3; K.box(0.6, y + 0.42 * Math.cos(f), z + 0.42 * Math.sin(f), 3.0, 0.11, 0.38, P.a, 'crystal', { rx: f }); }
        K.cone(2.1, y, z, 0.55, 1.3, P.a, 'crystal', { seg: 6, flat: true, rz: -H }); K.cone(2.1, y, z, 0.5, 1.1, P.b, 'crystal', { seg: 6, flat: true, rz: -H, rx: PI / 6 }); K.cone(-0.9, y, z, 0.55, 0.8, P.b, 'crystal', { seg: 6, flat: true, rz: H });
        for (const x of [-0.95, 0.55, 1.95]) X6(x, y, z, 0.6, 0.16, P.t, 'crystal');
        dot(3.45, y, z, 0.12, P.l);
        for (const x of [0, 1.4]) bar([x, y, s * 1.55], [x, y, s * 2.3], 0.12, P.t, 'crystal');
        fin(-0.7, 2.05, s * 3.05, s, 0.32, 1.8, 0.8, P.b); fin(-0.8, 2.35, s * 2.9, s, 0.16, 2.3, 0.9, P.a); fin(-0.9, 2.65, s * 2.7, s, 0.02, 1.6, 0.6, P.t);
        glo([-0.8, 2.4, s * 2.9], [-0.8 - 1.9 * Math.cos(0.16), 2.4, s * (2.9 + 1.9 * Math.sin(0.16))], 0.03, P.c, 2); dot(-0.8 - 2.25 * Math.cos(0.16), 2.4, s * (2.9 + 2.25 * Math.sin(0.16)), 0.07, P.l, 2.4);
      }
      // diapasão: câmara de ressonância, duas hastes com dentes e a lente focal presa no anel pela cintura
      L6(3.3, 1.5, 0, 0.72, 1.2, 1.3, 0.8, P.d, 'gloss'); L6(3.75, 1.45, 0, 0.42, 0.5, 0.75, 0.55, P.t, 'crystal'); L6(3.3, 2.78, 0, 0.62, 0.95, 0.22, 0.6, P.t, 'crystal'); K.oct(3.3, 2.9, 0, 0.3, 0.8, tc, 'crystal');
      X6(3.98, 2.25, 0, 0.24, 0.07, P.c, null, { e: 2.2 });
      for (const s of [-1, 1]) { const z = s * 1.12;
        X6(3.15, 2.25, z, 0.46, 0.75, P.b, 'crystal', { top: 0.75 }); X6(3.05, 2.25, z, 0.5, 0.12, P.t, 'crystal'); X6(3.8, 2.25, z, 0.3, 2.5, P.a, 'crystal', { top: 0.5 }); dot(6.3, 2.25, z, 0.1, P.l);
        for (const x of [4.3, 4.85]) X6(x, 2.25, z, 0.31, 0.16, P.t, 'crystal'); X6(5.75, 2.25, z, 0.22, 0.08, P.c, null, { e: 2.4 });
        for (const x of [4.6, 5.15]) K.oct(x, 2.25, s * 0.9, 0.07, 0.3, P.l, 'crystal', { rx: -s * H });
        bar([5.4, 2.25, s * 0.78], [5.4, 2.25, s * 0.95], 0.05, P.t, 'crystal');
        [0.75, 0.6, 0.45].forEach((h, k) => K.oct(4.5 + k * 0.33, 2.32, z, 0.14, h, k % 2 ? P.l : P.b, 'crystal', { sz: 0.4, rz: 0.45 })); // lâminas harmônicas escalonadas
      }
      K.tor(5.4, 2.25, 0, 0.72, 0.08, P.t, 'crystal', { rz: H, ts: 6, rs: 4 }); for (let i = 0; i < 3; i++) { const a = i * PI * 2 / 3 + H; bar([5.4, 2.25 + Math.sin(a) * 0.66, Math.cos(a) * 0.66], [5.4, 2.25 + Math.sin(a) * 0.44, Math.cos(a) * 0.44], 0.035, P.a, 'crystal'); }
      K.oct(4.5, 2.25, 0, 0.5, 1.8, P.l, 'crystal', { rz: -H }); K.oct(4.5, 2.25, 0, 0.5, 1.8, P.c, null, { e: 2.4, rz: -H, rx: PI / 4 }); glo([4.0, 2.25, 0], [4.6, 2.25, 0], 0.06, P.c);
      K.tor(5.95, 2.25, 0, 0.36, 0.035, P.c, null, { e: 2.2, rz: H, ts: 6, rs: 3 });
      K.beam = [6.3, 2.25, 0];
      K.anim({ t: 'spin', p: [6.0, 2.25, 0], axis: 'x', speed: 3 }, () => ringOf(3, 0.6, (dy, dz) => K.oct(5.75, 2.25 + dy, dz, 0.07, 0.5, P.l, null, { e: 2.4, rz: -H })));
      // gaiola de carga: cesto aberto de costelas de cristal em arco (treliça) com a colheita acesa dentro, preso ao casco por um pescoço
      const cx = -4.15;
      L6(-2.3, 1.2, 0, 0.6, 0.5, 1.2, 0.8, P.d, 'gloss');
      L6(cx, 0.75, 0, 0.95, 0.85, 0.7, 1.85, P.d, 'gloss'); L6(cx, 1.43, 0, 1.8, 1.62, 0.12, 1, P.t, 'crystal'); L6(cx, 1.5, 0, 1.5, 1.35, 0.06, 1, P.d, 'gloss'); K.prism(cx, 1.54, 0, 0.9, 0.05, 6, P.c, null, { e: 1.6 });
      K.oct(cx, 0.4, 0, 0.3, 1.1, P.t, 'crystal', { sx: 1.4 }); dot(cx, 0.5, 0, 0.1, P.c);
      for (const [vx, vz] of [[1.8, 0], [0.9, 1.62], [-0.9, 1.62], [-1.8, 0], [-0.9, -1.62], [0.9, -1.62]]) K.oct(cx + vx, 1.45, vz, 0.11, 0.42, P.a, 'crystal');
      const RB = [[1.45, 1.5], [1.72, 2.55], [1.5, 3.6], [0.85, 4.3]], NR = 6; const rp = (i, k) => { const a = (i + 0.5) / NR * PI * 2; return [cx + Math.cos(a) * RB[k][0], RB[k][1], Math.sin(a) * RB[k][0]]; };
      K.tor(cx, RB[1][1], 0, RB[1][0], 0.05, P.t, 'crystal', { ts: 6, rs: 3, ry: PI / 6 }); K.tor(cx, RB[2][1], 0, RB[2][0], 0.04, P.c, null, { e: 2.2, ts: 6, rs: 3, ry: PI / 6 });
      for (let i = 0; i < NR; i++) { for (let k = 0; k < 3; k++) bar(rp(i, k), rp(i, k + 1), 0.1 - k * 0.015, P.b, 'crystal', 6);
        for (const k of [1, 2]) { const [x, y, z] = rp(i, k); K.oct(x, y - 0.18, z, 0.12, 0.36, P.a, 'crystal'); }
        const [x, y, z] = rp(i, 3); dot(x, y + 0.05, z, 0.08, P.l, 2.4); }
      K.anim({ t: 'spin', p: [cx, 0, 0], speed: 0.7 }, () => { K.oct(cx, 1.7, 0, 0.55, 2.5, P.c, null, { e: 1.4 }); ringOf(5, 0.8, (dx, dz, a, i) => K.oct(cx + dx, 1.7, dz, 0.28, 1.1 + (i % 2) * 0.5, i % 2 ? P.t : P.l, 'crystal', { e: i % 2 ? 0 : 1.8, rz: -dx * 0.45, rx: dz * 0.45 })); ringOf(3, 0.45, (dx, dz) => K.oct(cx + dx, 3.4, dz, 0.1, 0.5, P.l, null, { e: 2.6 })); });
    });
    K.anim({ t: 'spin', p: [-4.15, 0, 0], speed: 0.9 }, () => { K.tor(-4.15, 4.8, 0, 2.0, 0.09, tc, null, { e: 1.3, ts: 6, rs: 3 }); ringOf(6, 2.0, (dx, dz, a, i) => { K.oct(-4.15 + dx, 4.4, dz, 0.16, 0.8, P.a, 'crystal'); K.oct(-4.15 + dx * 0.9, 4.55, dz * 0.9, 0.08, 0.42, i % 2 ? P.l : P.t, 'crystal', { rz: -Math.cos(a) * 0.5, rx: Math.sin(a) * 0.5 }); }); }); // anel de lascas em órbita sobre a carga
  },
  /* 4.3d — frota do Coro: ajudantes internos (nome com _ não vira unidade; chame como U.quorith._nome). Frente em +x, chão em y = 0. */
  _L6(K, x, y, z, L, W, h, top, col, mat, o) { return K.prism(x, y, z, 1, h, 6, col, mat, Object.assign({ top, sz: L, sx: W / 0.866, ry: H }, o)); }, /* losango sextavado deitado: pontas em x ± L, faces retas em z ± W */
  _X6(K, x, y, z, r, h, col, mat, o) { return K.prism(x, y, z, r, h, 6, col, mat, Object.assign({ rz: -H }, o)); }, /* prisma sextavado deitado, de x até x + h */
  _bar(K, a, b, r, col, mat, n) { return K.seg(a, b, r, col, mat, { seg: n || 5, flat: true }); },
  _glo(K, a, b, r, col, k) { return K.seg(a, b, r, col, null, { e: k || 2.2, seg: 5 }); }, /* filete aceso */
  _dot(K, x, y, z, r, col, k) { return K.oct(x, y - r, z, r, r * 2, col, null, { e: k || 2.6 }); }, /* luz facetada centrada em y */
  _fin(K, x, y, z, len, w, col, o) { return K.cone(x, y, z, 1, len, col, 'crystal', Object.assign({ seg: 4, flat: true, rz: H, sx: w / 2, sz: 0.08 }, o)); }, /* lâmina em pé: raiz em x, ponta para trás (-x) */
  _placa(K, pts, d, y, zi, s, c, col, mat, o) { return K.poly(pts.map(([x, w]) => [x, -s * w]), d, col, mat, Object.assign({ y, z: s * zi, rx: -H + s * c, b: K.lite ? 0 : 0.05, flat: true }, o)); }, /* placa deitada: contorno em planta [x, w] (w para fora a partir de zi), caída c para fora */
  _campo(K, P, x, z, L, W, k) { U.quorith._L6(K, x, 0, z, L, W, 0.03, 1, P.c, null, { e: k || 0.9 }); }, /* foco do campo de levitação no chão */
  _pino(K, P, x, y, z, r, col) { K.prism(x, y, z, r, r * 0.5, 6, col || P.t, 'crystal', { top: 0.6 }); }, /* cravo sextavado (detalhe fino) */
  _lev(K, P, x, y, z, r, sp, poca) { /* emissor de levitação: cone de cristal invertido, luz na ponta, poça de luz no chão e anel aceso que gira (anel só na completa) */
    K.cone(x, y, z, r, r * 1.8, P.t, 'crystal', { seg: 6, flat: true, rx: PI }); U.quorith._dot(K, x, y - r * 1.8, z, r * 0.4, P.c, 2.4); if (poca !== false) K.prism(x, 0, z, r * 1.5, 0.02, 6, P.c, null, { e: 0.55 });
    K.fine(() => K.tor(x, y - r * 0.75, z, r * 1.15, r * 0.1, P.l, null, { e: 1.7, ts: 6, rs: 3, anim: { t: 'spin', p: [x, y, z], speed: sp || 2.6 } })); },
  _capsula(K, P, tc, x0, x1, y, z, r, o) { /* cápsula de ressonância deitada (x0 → x1): núcleo na cor do time, aduelas de cristal com janela aberta em cima (casca inteira na versão leve), bicos facetados e colares */
    o = o || {}; const Q = U.quorith, L = x1 - x0;
    Q._X6(K, x0, y, z, r * 0.6, L, tc, null, { e: o.k || 0.95 });
    if (K.lite) { for (const s of [-1, 1]) K.box(x0 + L / 2, y - r * 0.55, z + s * r * 0.48, L * 0.94, r * 0.9, r * 0.36, P.b, 'crystal', { rx: s * 0.5 }); }
    else for (let i = 1; i < 6; i++) { const f = i * PI / 3; K.box(x0 + L / 2, y + r * 0.7 * Math.cos(f), z + r * 0.7 * Math.sin(f), L * 0.94, r * 0.2, r * 0.8, i % 2 ? P.a : P.b, 'crystal', { rx: f }); }
    K.cone(x1, y, z, r * 0.98, r * (o.nose || 1.9), P.a, 'crystal', { seg: 6, flat: true, rz: -H }); K.cone(x0, y, z, r * 0.98, r * 1.1, P.b, 'crystal', { seg: 6, flat: true, rz: H });
    for (const f of K.lite ? [0.03, 0.97] : [0.03, 0.5, 0.97]) Q._X6(K, x0 + L * f - r * 0.14, y, z, r * 1.12, r * 0.28, P.t, 'crystal');
    K.fine(() => { Q._dot(K, x1 + r * (o.nose || 1.9) + 0.04, y, z, r * 0.15, P.l, 2.4); for (const f of [0.27, 0.73]) Q._X6(K, x0 + L * f - 0.03, y, z, r * 0.9, 0.06, P.c, null, { e: 1.8 });
      for (const s of [-1, 1]) Q._bar(K, [x0 + L * 0.05, y + r * 0.86, z + s * r * 0.42], [x1 - L * 0.05, y + r * 0.86, z + s * r * 0.42], r * 0.06, P.t, 'crystal', 4);
      K.cone(x1 + r * 0.2, y, z, r * 0.7, r * (o.nose || 1.9) * 0.6, P.l, 'crystal', { seg: 6, flat: true, rz: -H, rx: PI / 6 }); }); },
  _lascas(K, P, x, y, z, R, n, sp, s, o) { /* lascas em órbita (gira em y): n cristais no raio R, tamanho s */
    o = o || {}; K.anim({ t: 'spin', p: [x, y, z], speed: sp }, () => ringOf(n, R, (dx, dz, a, i) => K.oct(x + dx, y - s * 0.5 + (o.wave ? Math.sin(a * 3) * o.wave : 0), z + dz, s * 0.22, s, i % 2 ? (o.c2 || P.t) : (o.c1 || P.a), 'crystal', { rz: -dx / R * (o.lean || 0.3), rx: dz / R * (o.lean || 0.3) }))); },
  _drusa(K, P, x, y, z, s, a, seed) { /* drusa: tufo de três cristais (detalhe fino) */
    const r = rng(seed || 1); for (let i = 0; i < 3; i++) { const t = a + (i - 1) * 0.9, h = s * (1 - i * 0.22 + r() * 0.2); K.oct(x + Math.cos(t) * s * 0.18, y - h * 0.15, z + Math.sin(t) * s * 0.18, s * 0.16, h, i === 1 ? P.l : P.a, 'crystal', { rz: -Math.cos(t) * 0.45, rx: Math.sin(t) * 0.45 }); } },
  _casco(K, P, tc, o) { /* casco flutuante dos tanques (veiculo, prisma): quilha escura com costura acesa, cinta de ametista, glacis de gelo em degraus, cápsulas na cor do time, emissores de levitação, proa e aletas de popa; o.chao = false tira a luz do chão (unidade que o render já faz flutuar) */
    o = o || {}; const Q = U.quorith, L = o.L || 5.6, W = o.W || 2.8, zc = o.zc || 3.75, rc = o.rc || 0.74, ch = o.chao !== false;
    if (ch) Q._campo(K, P, 0.2, 0, L * 0.42, W * 0.5, 0.7);
    Q._L6(K, 0.2, 0.62, 0, L * 0.7, W * 0.7, 0.7, 1.43, P.d, 'gloss');
    Q._L6(K, 0.2, 1.32, 0, L + 0.02, W + 0.02, 0.1, 1, P.c, null, { e: 1.5 });
    Q._L6(K, 0.2, 1.42, 0, L + 0.05, W + 0.05, 0.62, 0.98, P.t, 'crystal');
    Q._L6(K, 0.2, 2.04, 0, L * 0.98, W * 0.98, 0.56, 0.84, P.b, 'crystal');
    Q._L6(K, 0.2, 2.6, 0, L * 0.82, W * 0.82, 0.14, 0.92, P.d, 'gloss');
    /* glacis: placas de gelo deitadas em degrau, chevrons da proa na cor do time, friso aceso e cravos entre as placas */
    for (const s of [-1, 1]) {
      Q._placa(K, [[-4.2, 0], [3.6, 0], [4.4, 0.9], [-3.6, 0.9]], 0.14, 2.62, W * 0.42, s, 0.32, P.a, 'crystal');
      Q._placa(K, [[-4.6, 0], [-1.0, 0], [-1.5, 0.55], [-4.2, 0.55]], 0.1, 2.32, W * 0.78, s, 0.62, P.a, 'crystal');
      Q._placa(K, [[3.0, 0], [5.0, 0], [5.7, 0.55], [3.6, 0.95]], 0.12, 2.36, W * 0.12, s, 0.48, tc, 'crystal');
      K.fine(() => { Q._glo(K, [-3.9, 2.63, s * W * 0.4], [3.4, 2.63, s * W * 0.4], 0.03, P.c, 1.8); Q._glo(K, [-4.3, 2.47, s * W * 0.76], [-1.2, 2.47, s * W * 0.76], 0.025, P.l, 1.6);
        for (let i = 0; i < 6; i++) Q._pino(K, P, -3.5 + i * 1.3, 2.68, s * W * 0.62, 0.11, i % 2 ? P.t : P.b);
        for (const x of [3.3, 4.2]) Q._pino(K, P, x, 2.42, s * W * 0.25, 0.09, P.d); });
    }
    /* cápsulas laterais (núcleo na cor do time) presas por braços, com emissores de levitação embaixo */
    if (o.caps !== false) for (const s of [-1, 1]) { const z = s * zc, y = o.yc || 1.6;
      Q._capsula(K, P, tc, -3.7, 2.9, y, z, rc, { k: 0.95 });
      for (const x of [-2.1, 1.2]) { Q._bar(K, [x, y + 0.1, s * (W - 0.1)], [x, y + 0.1, z - s * rc * 0.6], 0.16, P.t, 'crystal'); K.box(x, y - 0.1, s * (W + 0.25), 0.5, 0.4, 0.3, P.d, 'gloss'); }
      for (const x of [-2.6, 1.8]) Q._lev(K, P, x, y - rc * 0.85, z, 0.32, 0, ch);
      K.fine(() => { Q._glo(K, [-1.0, y + 0.42, s * (W + 0.02)], [-1.0, y + 0.42, z - s * rc * 0.8], 0.035, P.c, 2); for (const x of [-2.1, 1.2]) { Q._dot(K, x, y + 0.36, s * (W + 0.42), 0.06, P.l, 2.4); Q._bar(K, [x - 0.2, y - 0.25, s * (W + 0.1)], [x - 0.2, y - 0.25, z - s * rc * 0.7], 0.06, P.d, 'gloss', 4); } });
    }
    for (const x of [-3.2, 3.6]) Q._lev(K, P, x, 0.66, 0, 0.3, 0, ch);
    /* proa: cunha de cristal em V com uma lente de foco */
    for (const s of [-1, 1]) K.poly([[0, 0], [1.25, 0.45], [0, 1.1]], 0.16, P.a, 'crystal', { x: L - 0.45, y: 1.05, z: s * 0.55, ry: s * 0.62, b: K.lite ? 0 : 0.04, flat: true });
    K.oct(L - 0.3, 1.55, 0, 0.34, 0.85, P.l, 'crystal', { rz: -H, sx: 0.8 }); Q._dot(K, L + 0.02, 1.55, 0, 0.12, P.c, 2.6);
    /* popa: aletas harmônicas, respiros acesos e espinho */
    for (const s of [-1, 1]) K.anim({ t: 'sway', p: [-L + 1.3, 2.35, s * 1.45], amp: 0.09, speed: 2.3, ph: s * 0.9 }, () => { Q._fin(K, -L + 1.3, 2.35, s * 1.45, 1.9, 1.5, P.b, { ry: -s * 0.25 }); K.fine(() => { Q._glo(K, [-L + 1.25, 2.6, s * 1.45], [-L - 0.35, 2.6, s * 1.45 + s * 0.42], 0.03, P.c, 2); Q._fin(K, -L + 1.0, 2.2, s * 2.0, 1.2, 0.9, P.t, { ry: -s * 0.45 }); }); }); /* aletas de popa vibram (também na versão leve) */
    for (let i = -1; i <= 1; i++) K.box(-L + 0.75, 1.62, i * 0.62, 0.12, 0.42, 0.4, P.l, null, { e: 1.9 });
    K.oct(-L + 0.5, 1.8, 0, 0.2, 0.9, P.t, 'crystal', { rz: H });
    /* detalhe fino do convés: dentes de cristal na borda, drusas na popa e luzes de posição */
    K.fine(() => { for (const s of [-1, 1]) { for (const x of [-3.4, -1.9, 1.6, 3.1]) K.oct(x, 2.55, s * (W * 0.86), 0.08, 0.34, P.l, 'crystal'); Q._dot(K, L - 0.9, 2.15, s * 1.15, 0.07, P.l, 2.6); Q._dot(K, -L + 0.6, 2.35, s * 2.1, 0.07, tc, 1.6); Q._drusa(K, P, -L + 1.6, 2.45, s * 2.25, 0.7, s * 1.2, 3 + s); } });
  },
  veiculo_hull(K, P, tc) { /* 4.3d: tanque de cristal — casco flutuante sextavado (_casco), cápsulas laterais na cor do time e anel de assento escuro para a torre */
    U.quorith._casco(K, P, tc, {});
    K.prism(0, 2.6, 0, 2.25, 0.18, 6, P.t, 'crystal', { ry: PI / 6 }); K.fine(() => ringOf(6, 2.05, (dx, dz) => K.box(dx, 2.74, dz, 0.16, 0.08, 0.16, P.c, null, { e: 2 })));
    K.mount = 2.7; },
  veiculo_turret(K, P, tc) { /* 4.3d: torre de ressonância — cabeça facetada com crista na cor do time, bochechas de ametista, câmara de eco na traseira e lança de cristal com garfo harmônico (recua inteira) */
    const Q = U.quorith, yb = 0.92;
    K.prism(0, 0, 0, 1.95, 0.3, 6, P.d, 'gloss', { ry: PI / 6 }); K.prism(0, 0.3, 0, 1.75, 0.08, 6, P.c, null, { e: 1.6, ry: PI / 6 });
    Q._L6(K, 0.15, 0.38, 0, 2.45, 1.62, 0.78, 0.8, P.b, 'crystal'); Q._L6(K, 0.15, 1.16, 0, 1.96, 1.3, 0.34, 0.66, P.a, 'crystal');
    Q._L6(K, 0.0, 1.5, 0, 1.25, 0.6, 0.14, 0.7, tc, 'crystal'); for (const s of [-1, 1]) K.box(0.05, 1.47, s * 0.68, 2.2, 0.08, 0.1, tc, null, { e: 1.1 });
    /* bochechas: placas de ametista inclinadas sobre a cabeça */
    for (const s of [-1, 1]) { Q._placa(K, [[-1.7, 0], [1.4, 0], [2.0, 0.5], [-1.3, 0.62]], 0.12, 1.02, 1.42, s, 0.75, P.t, 'crystal'); K.fine(() => { Q._glo(K, [-1.2, 1.0, s * 1.62], [1.3, 1.0, s * 1.62], 0.03, P.c, 1.8); for (const x of [-1.0, -0.2, 0.6]) Q._pino(K, P, x, 1.2, s * 1.18, 0.1, P.d); }); }
    /* câmara de eco (contrapeso) com anéis acesos e garfo de antena */
    Q._X6(K, -3.05, yb, 0, 0.62, 1.55, P.d, 'gloss'); K.cone(-3.05, yb, 0, 0.62, 0.55, P.t, 'crystal', { seg: 6, flat: true, rz: H });
    for (const x of [-2.75, -2.15]) Q._X6(K, x, yb, 0, 0.7, 0.14, P.c, null, { e: 1.7 });
    K.fine(() => { for (const s of [-1, 1]) K.anim({ t: 'sway', p: [-2.4, 1.5, s * 0.3], amp: 0.1, speed: 2.2, ph: s }, () => { Q._bar(K, [-2.4, 1.4, s * 0.3], [-2.75, 2.75, s * 0.3], 0.045, P.t, 'crystal'); Q._dot(K, -2.78, 2.85, s * 0.3, 0.08, P.l, 2.6); });
      for (let i = 0; i < 6; i++) { const a = i * PI / 3 + PI / 6; K.box(-2.45, yb + Math.cos(a) * 0.6, Math.sin(a) * 0.6, 0.5, 0.07, 0.16, P.t, 'crystal', { rx: a }); } });
    /* mantelete fixo e lança que recua */
    Q._L6(K, 2.1, yb - 0.45, 0, 0.75, 0.62, 0.9, 0.7, P.t, 'crystal');
    K.anim({ t: 'recoil', dist: 0.85 }, () => {
      Q._X6(K, 1.9, yb, 0, 0.36, 4.3, P.a, 'crystal', { top: 0.82 });
      for (const x of [2.55, 3.7, 4.85]) Q._X6(K, x, yb, 0, 0.47, 0.2, P.t, 'crystal');
      Q._X6(K, 5.7, yb, 0, 0.5, 0.38, P.d, 'gloss'); K.cone(6.08, yb, 0, 0.42, 0.95, P.l, 'crystal', { seg: 6, flat: true, rz: -H }); Q._dot(K, 7.05, yb, 0, 0.13, P.c, 2.8);
      for (const s of [-1, 1]) K.cone(3.3, yb, s * 0.56, 1, 3.2, P.b, 'crystal', { seg: 4, flat: true, rz: -H, sx: 0.14, sz: 0.06 });
      K.fine(() => { for (const x of [3.12, 4.27]) Q._X6(K, x, yb, 0, 0.4, 0.07, P.c, null, { e: 2.2 }); for (const s of [-1, 1]) { Q._glo(K, [3.4, yb, s * 0.5], [6.3, yb, s * 0.5], 0.025, P.c, 2.2); Q._dot(K, 6.5, yb, s * 0.56, 0.06, P.l, 2.6); }
        for (let i = 0; i < 4; i++) { const a = i * H + PI / 4; K.cone(5.25, yb + Math.cos(a) * 0.4, Math.sin(a) * 0.4, 1, 0.75, P.t, 'crystal', { seg: 4, flat: true, rz: H, sx: 0.16, sz: 0.04, rx: a }); } });
    });
    K.fine(() => { for (const s of [-1, 1]) Q._drusa(K, P, -0.9, 1.45, s * 0.95, 0.5, s * 1.5, 7 + s); Q._dot(K, 1.25, 1.42, 0, 0.08, P.l, 2.4); for (const s of [-1, 1]) K.poly([[0, 0], [0.9, 0.2], [0.75, 0.5], [0, 0.42]], 0.08, P.a, 'crystal', { x: 1.75, y: 0.62, z: s * 0.86, ry: s * 0.55, flat: true }); });
  },
  drone(K, P, tc) { /* 4.3d: drone de cristal — dardo facetado de asas em pena (gelo sobre ametista, faixa na cor do time), naceles com rotor de lascas e repetidor de estilhaços sob o bico */
    const Q = U.quorith;
    Q._L6(K, 0.2, 0.5, 0, 2.3, 0.62, 0.42, 1.35, P.d, 'gloss'); Q._L6(K, 0.2, 0.92, 0, 3.1, 0.84, 0.08, 1, P.c, null, { e: 1.6 });
    Q._L6(K, 0.2, 1.0, 0, 3.1, 0.84, 0.42, 0.62, P.a, 'crystal'); Q._L6(K, 0.0, 1.42, 0, 1.6, 0.4, 0.2, 0.55, tc, 'crystal');
    Q._L6(K, -0.4, 1.38, 0, 2.3, 0.16, 0.24, 0.4, P.t, 'crystal');
    K.oct(3.15, 0.95, 0, 0.32, 1.2, P.l, 'crystal', { rz: -H, sx: 0.8 }); Q._dot(K, 3.5, 0.98, 0, 0.09, P.c, 2.6);
    K.poly([[0.8, 0], [-2.2, 0], [-1.6, -0.75]], 0.1, P.t, 'crystal', { y: 0.55, b: K.lite ? 0 : 0.03, flat: true });
    for (const s of [-1, 1]) {
      /* asa em pena: lâmina de gelo por cima, lâmina de ametista por baixo e mais para trás, faixa na cor do time e bordo de ataque aceso */
      K.poly([[1.0, 0], [-1.2, 0], [-2.1, 2.55], [-1.2, 2.75]].map(([x, w]) => [x, -s * w]), 0.12, P.a, 'crystal', { y: 1.0, z: s * 0.55, rx: -H - s * 0.1, b: K.lite ? 0 : 0.03, flat: true });
      K.poly([[0.2, 0], [-1.9, 0], [-2.9, 2.2], [-2.2, 2.35]].map(([x, w]) => [x, -s * w]), 0.1, P.t, 'crystal', { y: 0.86, z: s * 0.5, rx: -H - s * 0.04, b: K.lite ? 0 : 0.03, flat: true });
      K.poly([[0.2, 0], [-0.8, 0], [-1.55, 2.05], [-1.05, 2.15]].map(([x, w]) => [x, -s * w]), 0.06, tc, 'crystal', { y: 1.08, z: s * 0.62, rx: -H - s * 0.1, flat: true });
      K.fine(() => { Q._glo(K, [0.95, 1.04, s * 0.6], [-1.2, 1.32, s * 3.25], 0.035, P.l, 2); Q._glo(K, [0.1, 0.9, s * 0.55], [-2.25, 1.08, s * 2.82], 0.025, P.c, 1.8); for (const k of [0.3, 0.55, 0.8]) K.oct(-0.15 - k * 1.25, 1.12 + k * 0.28, s * (0.6 + k * 2.4), 0.06, 0.26, P.l, 'crystal');
        K.poly([[0.6, 0], [-0.6, 0], [-1.1, 0.9], [-0.3, 0.95]].map(([x, w]) => [x, -s * w]), 0.06, P.b, 'crystal', { y: 1.13, z: s * 0.5, rx: -H - s * 0.16, flat: true }); for (const k of [0.25, 0.5, 0.75]) Q._pino(K, P, 0.4 - k * 1.6, 1.13 + k * 0.2, s * (0.75 + k * 1.6), 0.07, P.d); });
      /* nacele na ponta da asa com rotor de três lascas */
      const zn = s * 3.25, yn = 1.18; Q._X6(K, -2.2, yn, zn, 0.26, 1.7, P.d, 'gloss'); K.cone(-0.5, yn, zn, 0.26, 0.6, P.a, 'crystal', { seg: 6, flat: true, rz: -H }); K.cone(-2.2, yn, zn, 0.26, 0.4, P.b, 'crystal', { seg: 6, flat: true, rz: H });
      Q._X6(K, -1.6, yn, zn, 0.3, 0.5, tc, null, { e: 0.9 });
      K.anim({ t: 'spin', p: [-1.35, yn, zn], speed: s * 9 }, () => { ringOf(3, 0.85, (dx, dz) => K.oct(-1.35 + dx, yn + 0.3, zn + dz, 0.07, 0.62, P.l, 'crystal', { rz: H, ry: Math.atan2(-dz, dx), sx: 2.2 })); K.fine(() => K.tor(-1.35, yn + 0.33, zn, 0.85, 0.025, P.c, null, { e: 1.6, ts: 6, rs: 3 })); });
      Q._dot(K, -1.35, yn - 0.32, zn, 0.12, P.c, 2.2);
      K.fine(() => { for (const x of [-2.0, -0.85]) Q._X6(K, x, yn, zn, 0.3, 0.08, P.t, 'crystal'); Q._fin(K, -2.0, yn + 0.15, zn, 0.8, 0.55, P.b, {}); Q._dot(K, -0.42, yn, zn, 0.05, P.l, 2.6); });
      /* repetidor de estilhaços (recua) */
      K.anim({ t: 'recoil', dist: 0.3 }, () => { Q._X6(K, 1.6, 0.55, s * 0.36, 0.11, 1.65, P.t, 'crystal'); K.fine(() => { Q._X6(K, 2.3, 0.55, s * 0.36, 0.15, 0.12, P.d, 'gloss'); Q._X6(K, 2.75, 0.55, s * 0.36, 0.14, 0.1, P.d, 'gloss'); }); Q._dot(K, 3.3, 0.55, s * 0.36, 0.07, P.l, 2.8); });
      /* cauda: lâminas que balançam */
      K.anim({ t: 'sway', p: [-2.6, 1.2, s * 0.35], amp: 0.12, speed: 3.4, ph: s }, () => { Q._fin(K, -2.5, 1.25, s * 0.38, 1.3, 0.7, P.b, { ry: -s * 0.3 }); K.fine(() => Q._dot(K, -3.75, 1.25, s * 0.75, 0.05, P.l, 2.4)); });
    }
    K.fine(() => { for (const s of [-1, 1]) { Q._dot(K, -1.95, 1.0, s * 0.62, 0.06, P.l, 2.4); Q._glo(K, [-1.6, 1.42, s * 0.3], [1.4, 1.42, s * 0.3], 0.02, P.c, 1.8); K.oct(2.35, 0.7, s * 0.45, 0.08, 0.7, P.l, 'crystal', { rz: -H + 0.15, ry: -s * 0.25 }); } K.oct(-2.95, 0.9, 0, 0.12, 0.8, P.t, 'crystal', { rz: H }); Q._drusa(K, P, -1.0, 1.5, 0, 0.45, 0, 11); });
    K.fine(() => { for (const s of [-1, 1]) { const zn = s * 3.25; K.tor(-0.62, 1.18, zn, 0.31, 0.035, P.l, null, { e: 1.8, ts: 6, rs: 3, rz: H }); K.oct(-1.9, 1.18, s * 3.62, 0.06, 0.9, P.l, 'crystal', { rz: H, ry: s * 0.3 }); Q._L6(K, 0.5, 0.62, s * 0.66, 1.1, 0.08, 0.32, 0.8, P.b, 'crystal'); K.cone(-0.6, 0.86, s * 1.7, 0.2, 0.36, P.t, 'crystal', { seg: 6, flat: true, rx: PI }); Q._dot(K, -0.6, 0.48, s * 1.7, 0.07, P.c, 2.4); }
      for (let i = 0; i < 3; i++) K.oct(0.9 - i * 0.55, 1.55, 0, 0.07, 0.3, i % 2 ? P.l : P.a, 'crystal'); K.anim({ t: 'spin', p: [-2.75, 1.0, 0], axis: 'x', speed: 3 }, () => K.tor(-2.75, 1.0, 0, 0.36, 0.03, P.c, null, { e: 2, ts: 6, rs: 3, rz: H })); });
    K.anim({ t: 'bob', amp: 0.12, speed: 2.4 }, () => Q._dot(K, 0.2, 0.32, 0, 0.16, P.c, 2.2));
  },
  suporte(K, P, tc) { /* 4.3d: suporte/hack de cristal — trenó flutuante com prato de pétalas (gelo e ametista, forro na cor do time) que gira em volta de um núcleo de interferência, cápsulas de bloqueio e antenas que balançam */
    const Q = U.quorith;
    Q._campo(K, P, 0, 0, 1.6, 1.0, 0.7);
    Q._L6(K, 0, 0.55, 0, 2.2, 1.3, 0.55, 1.35, P.d, 'gloss'); Q._L6(K, 0, 1.1, 0, 3.0, 1.78, 0.1, 1, P.c, null, { e: 1.5 });
    Q._L6(K, 0, 1.2, 0, 3.05, 1.8, 0.5, 0.86, P.t, 'crystal'); Q._L6(K, 0, 1.7, 0, 2.6, 1.55, 0.12, 0.9, P.d, 'gloss');
    for (const s of [-1, 1]) { Q._placa(K, [[-2.2, 0], [1.9, 0], [2.6, 0.55], [-1.6, 0.7]], 0.1, 1.62, 1.1, s, 0.42, P.a, 'crystal'); Q._lev(K, P, 1.5, 0.75, s * 1.0, 0.25); Q._lev(K, P, -1.5, 0.75, s * 1.0, 0.25); }
    for (const s of [-1, 1]) K.poly([[0, 0], [0.9, 0.3], [0, 0.65]], 0.08, tc, 'crystal', { x: 2.05, y: 1.78, z: s * 0.42, rx: -H, flat: true });
    /* mastro e prato de pétalas (gira devagar), núcleo de interferência aceso que pulsa */
    K.prism(0, 1.82, 0, 0.55, 1.1, 6, P.b, 'crystal', { top: 0.7 }); K.prism(0, 2.2, 0, 0.62, 0.1, 6, P.c, null, { e: 1.8 }); K.fine(() => K.tor(0, 2.55, 0, 0.62, 0.03, P.l, null, { e: 1.8, ts: 6, rs: 3 }));
    K.anim({ t: 'spin', p: [0, 3.2, 0], speed: 0.9 }, () => {
      K.prism(0, 2.85, 0, 0.9, 0.25, 6, P.d, 'gloss', { top: 1.25 });
      ringOf(6, 1.0, (dx, dz, a, i) => { K.poly([[-0.4, 0], [0.4, 0], [0.56, 1.3], [0, 1.65], [-0.56, 1.3]], 0.1, i % 2 ? P.t : P.a, 'crystal', { x: dx, y: 3.0, z: dz, ry: -a + H, rx: 0.58, b: K.lite ? 0 : 0.03, flat: true });
        if (!(i % 2)) K.poly([[-0.24, 0.2], [0.24, 0.2], [0.34, 1.15], [0, 1.4], [-0.34, 1.15]], 0.03, tc, 'crystal', { x: dx * 0.96, y: 3.04, z: dz * 0.96, ry: -a + H, rx: 0.58, flat: true }); });
      K.fine(() => ringOf(6, 1.0, (dx, dz, a, i) => { if (i % 2) Q._glo(K, [dx * 1.05, 3.2, dz * 1.05], [dx * 1.72, 4.3, dz * 1.72], 0.025, P.c, 1.9);
        const tx = -Math.sin(a), tz = Math.cos(a); for (const k of [-1, 1]) Q._bar(K, [dx * 1.0 + tx * k * 0.42, 3.02, dz * 1.0 + tz * k * 0.42], [dx * 1.73 + tx * k * 0.58, 4.12, dz * 1.73 + tz * k * 0.58], 0.035, i % 2 ? P.a : P.t, 'crystal', 4);
        const t1 = a + PI / 6, ct = Math.cos(t1), st = Math.sin(t1); Q._bar(K, [ct * 0.95, 2.95, st * 0.95], [ct * 1.55, 3.95, st * 1.55], 0.05, P.t, 'crystal', 4); Q._dot(K, ct * 1.58, 4.0, st * 1.58, 0.05, P.l, 2.4); K.oct(dx * 0.75, 2.62, dz * 0.75, 0.08, 0.36, P.a, 'crystal', { rx: Math.sin(a) * 2.6, rz: -Math.cos(a) * 2.6 }); }));
      ringOf(6, 1.88, (dx, dz) => Q._dot(K, dx, 4.45, dz, 0.07, P.l, 2.6));
    });
    K.anim({ t: 'bob', amp: 0.18, speed: 2.6 }, () => { K.oct(0, 3.1, 0, 0.6, 1.5, P.l, 'crystal'); K.oct(0, 3.25, 0, 0.42, 1.2, P.c, null, { e: 2.4, ry: PI / 4 }); });
    K.fine(() => K.anim({ t: 'spin', p: [0, 4.9, 0], speed: -2.2 }, () => ringOf(3, 0.5, (dx, dz) => K.oct(dx, 4.75, dz, 0.07, 0.32, P.l, null, { e: 2.2 }))));
    /* projetor de interferência na proa (o pulso sai daqui): tubo sextavado, anéis acesos e lente */
    Q._X6(K, 2.35, 1.55, 0, 0.3, 0.9, P.d, 'gloss'); K.cone(3.25, 1.55, 0, 0.3, 0.55, P.l, 'crystal', { seg: 6, flat: true, rz: -H }); Q._X6(K, 2.55, 1.55, 0, 0.4, 0.12, P.t, 'crystal');
    K.fine(() => { for (const x of [2.85, 3.05]) Q._X6(K, x, 1.55, 0, 0.36, 0.05, P.c, null, { e: 2.2 }); Q._dot(K, 3.85, 1.55, 0, 0.07, P.c, 2.8); for (const s of [-1, 1]) { K.oct(2.6, 1.85, s * 0.3, 0.06, 0.5, P.l, 'crystal', { rz: -0.5 }); for (let i = 0; i < 3; i++) K.box(-1.2 + i * 1.1, 1.3, s * 1.86, 0.5, 0.08, 0.06, P.c, null, { e: 1.8, rx: s * 0.3 }); } });
    K.fine(() => K.anim({ t: 'spin', p: [0, 4.2, 0], speed: -0.6 }, () => ringOf(3, 2.3, (dx, dz) => { K.oct(dx, 3.9, dz, 0.09, 0.5, P.l, 'crystal', { rz: -dx * 0.12, rx: dz * 0.12 }); K.oct(dx * 0.93, 3.95, dz * 0.93, 0.06, 0.32, P.c, null, { e: 2.2 }); })));
    /* cápsulas de bloqueio nas laterais */
    for (const s of [-1, 1]) { Q._capsula(K, P, tc, -1.3, 0.9, 1.15, s * 2.15, 0.42, { k: 0.95, nose: 1.4 }); Q._bar(K, [-0.2, 1.3, s * 1.7], [-0.2, 1.3, s * 1.85], 0.12, P.t, 'crystal'); }
    /* antenas de cristal na popa (balançam) */
    for (const s of [-1, 1]) K.anim({ t: 'sway', p: [-2.3, 1.7, s * 0.6], amp: 0.13, speed: 2.4, ph: s * 0.8 }, () => { Q._bar(K, [-2.3, 1.7, s * 0.6], [-2.75, 4.0, s * 0.75], 0.06, P.t, 'crystal'); K.oct(-2.78, 3.95, s * 0.76, 0.12, 0.55, P.l, 'crystal'); K.fine(() => { Q._dot(K, -2.78, 4.65, s * 0.76, 0.07, P.c, 2.6); K.oct(-2.55, 3.0, s * 0.68, 0.07, 0.3, P.l, 'crystal'); }); });
    K.oct(3.15, 1.25, 0, 0.22, 0.7, P.l, 'crystal', { rz: -H });
    K.fine(() => { for (const s of [-1, 1]) { Q._dot(K, 2.75, 1.5, s * 0.45, 0.07, P.l, 2.6); Q._glo(K, [-2.4, 1.78, s * 0.9], [2.2, 1.78, s * 0.9], 0.03, P.c, 1.6); Q._drusa(K, P, -1.9, 1.75, s * 1.1, 0.55, s, 21 + s);
        for (let i = 0; i < 6; i++) Q._pino(K, P, -2.0 + i * 0.8, 1.82, s * 1.2, 0.08, i % 2 ? P.t : P.b); K.oct(2.9, 1.0, s * 0.85, 0.07, 0.42, P.l, 'crystal', { rz: -H + 0.4 }); } for (let i = 0; i < 6; i++) { const a = i * PI / 3; K.box(Math.cos(a) * 0.5, 2.45, Math.sin(a) * 0.5, 0.06, 0.35, 0.22, P.t, 'crystal', { ry: -a }); } });
  },
  pirata(K, P, tc) { /* 4.3d: Ressonador — corpo flutuante comprido com campânula de desafinação que gira na frente, espiral de lascas tortas, anel partido, células de carga roubada na cor do time e antena torta */
    const Q = U.quorith;
    Q._campo(K, P, -0.4, 0, 2.2, 1.0, 0.7);
    Q._L6(K, -0.6, 0.55, 0, 3.0, 1.15, 0.55, 1.4, P.d, 'gloss'); Q._L6(K, -0.6, 1.1, 0, 4.25, 1.62, 0.1, 1, P.c, null, { e: 1.5 });
    Q._L6(K, -0.6, 1.2, 0, 4.3, 1.66, 0.55, 0.8, P.t, 'crystal'); Q._L6(K, -0.8, 1.75, 0, 3.2, 1.2, 0.3, 0.7, tc, 'crystal');
    for (const s of [-1, 1]) { Q._placa(K, [[-3.8, 0], [1.2, 0], [1.8, 0.55], [-3.1, 0.8]], 0.1, 1.7, 0.95, s, 0.5, P.a, 'crystal'); Q._placa(K, [[-4.3, 0], [0.4, 0], [0.9, 0.4], [-3.8, 0.45]], 0.08, 1.38, 1.5, s, 0.85, P.b, 'crystal'); Q._lev(K, P, 1.4, 0.75, s * 0.85, 0.24); Q._lev(K, P, -2.4, 0.75, s * 0.85, 0.24); Q._lev(K, P, -0.5, 0.72, s * 0.95, 0.2); }
    /* campânula de desafinação: funil de pétalas (gelo e ametista) que gira em x, com espiral de lascas dentro */
    const xb = 2.7, yb = 2.0;
    Q._X6(K, 1.3, yb, 0, 0.42, 1.5, P.d, 'gloss'); for (const x of [1.6, 2.2]) Q._X6(K, x, yb, 0, 0.55, 0.16, x > 2 ? P.c : P.t, x > 2 ? null : 'crystal', x > 2 ? { e: 1.8 } : {});
    K.anim({ t: 'spin', p: [xb, yb, 0], axis: 'x', speed: 1.4 }, () => {
      for (let i = 0; i < 6; i++) { const a = i / 6 * PI * 2; K.poly([[0, -0.34], [0, 0.34], [2.3, 0.78], [2.6, 0], [2.3, -0.78]], 0.08, i % 2 ? P.a : P.t, 'crystal', { x: xb, y: yb + Math.cos(a) * 0.45, z: Math.sin(a) * 0.45, rx: a - H, ry: -0.55, order: 'XYZ', b: K.lite ? 0 : 0.03, flat: true }); }
      K.fine(() => { for (let i = 0; i < 6; i++) { const a = (i + 0.5) / 6 * PI * 2, a0 = i / 6 * PI * 2; Q._bar(K, [xb + 0.3, yb + Math.cos(a0) * 0.62, Math.sin(a0) * 0.62], [xb + 2.0, yb + Math.cos(a0) * 1.62, Math.sin(a0) * 1.62], 0.03, i % 2 ? P.t : P.a, 'crystal', 4); Q._glo(K, [xb + 0.1, yb + Math.cos(a) * 0.5, Math.sin(a) * 0.5], [xb + 2.1, yb + Math.cos(a) * 1.55, Math.sin(a) * 1.55], 0.025, P.c, 2); K.oct(xb + 2.2, yb + Math.cos(a - 0.52) * 1.9, Math.sin(a - 0.52) * 1.9, 0.07, 0.36, P.l, 'crystal', { rx: a - 0.52 }); } });
      K.tor(xb + 2.12, yb, 0, 1.66, 0.06, P.l, null, { e: 1.7, ts: 6, rs: 3, rz: H, rx: PI / 6 }); /* aro aceso na boca (a campânula fica aberta) */
      K.fine(() => { for (let i = 0; i < 6; i++) { const a = (i + 0.5) / 6 * PI * 2; K.poly([[0, -0.22], [0, 0.22], [1.6, 0.42], [1.8, 0], [1.6, -0.42]], 0.05, P.b, 'crystal', { x: xb + 0.15, y: yb + Math.cos(a) * 0.3, z: Math.sin(a) * 0.3, rx: a - H, ry: -0.42, order: 'XYZ', flat: true }); } K.tor(xb + 2.1, yb, 0, 1.78, 0.04, P.t, 'crystal', { ts: 6, rs: 3, rz: H }); });
    });
    K.anim({ t: 'spin', p: [xb, yb, 0], axis: 'x', speed: -4 }, () => { for (let i = 0; i < K.q(5); i++) { const a = i * 2.1, r = 0.18 + i * 0.13; K.oct(xb + 0.5 + i * 0.34, yb + Math.cos(a) * r, Math.sin(a) * r, 0.07, 0.42, i % 2 ? P.l : P.c, null, { e: i % 2 ? 0 : 2.2, rz: -H + 0.4 }); } Q._dot(K, xb + 0.35, yb, 0, 0.16, P.l, 2.6); });
    /* garras de agarrar dos lados da campânula (balançam): braço de ametista, cotovelo aceso e pinça de cristal */
    for (const s of [-1, 1]) K.anim({ t: 'sway', p: [1.4, 1.4, s * 0.9], amp: 0.1, speed: 1.9, ph: s * 1.3 }, () => { Q._bar(K, [1.4, 1.4, s * 0.9], [2.6, 1.15, s * 1.45], 0.09, P.t, 'crystal'); Q._bar(K, [2.6, 1.15, s * 1.45], [3.7, 1.0, s * 1.2], 0.07, P.t, 'crystal'); K.oct(3.75, 1.0, s * 1.2, 0.12, 0.7, P.l, 'crystal', { rz: -H - 0.2, ry: s * 0.4 }); K.oct(3.6, 0.9, s * 1.32, 0.1, 0.55, P.a, 'crystal', { rz: -H + 0.4, ry: s * 0.7 }); K.fine(() => { Q._dot(K, 2.6, 1.15, s * 1.45, 0.08, P.c, 2.4); K.prism(1.4, 1.3, s * 0.9, 0.16, 0.2, 6, P.d, 'gloss'); }); });
    /* anel partido (desafinado) que gira torto em volta do corpo */
    K.anim({ t: 'spin', p: [-0.6, 2.2, 0], speed: 0.7 }, () => { K.tor(-0.6, 2.2, 0, 2.05, 0.05, P.l, null, { e: 1.6, ts: 8, rs: 3, arc: PI * 1.55, rx: 0.3, rz: 0.12 }); K.fine(() => K.oct(-0.6 + 2.05, 2.25, 0.2, 0.08, 0.36, P.c, null, { e: 2.2 })); });
    /* células de carga roubada (na cor do time) num berço de ametista na popa */
    for (const s of [-1, 1]) { K.oct(-2.6, 1.55, s * 1.05, 0.62, 1.6, P.a, 'crystal', { ry: PI / 4 }); K.oct(-2.6, 1.8, s * 1.05, 0.42, 1.1, tc, null, { e: 1.1, ry: PI / 4 }); K.fine(() => K.tor(-2.6, 2.35, s * 1.05, 0.62, 0.035, P.l, null, { e: 1.8, ts: 6, rs: 3 })); Q._bar(K, [-3.3, 1.75, 0], [-2.6, 1.75, s * 1.05], 0.1, P.t, 'crystal'); }
    K.oct(-3.3, 1.75, 0, 0.75, 2.4, tc, 'crystal', { ry: PI / 4, sx: 0.8 }); K.oct(-3.3, 2.2, 0, 0.42, 1.5, P.c, null, { e: 1.8 });
    K.oct(-4.9, 1.4, 0, 0.18, 0.9, P.t, 'crystal', { rz: H });
    /* antena torta (desafinada) que balança */
    K.anim({ t: 'sway', p: [-1.4, 2.0, 0.3], amp: 0.14, speed: 1.7 }, () => { Q._bar(K, [-1.4, 2.0, 0.3], [-1.8, 3.4, 0.55], 0.06, P.t, 'crystal'); Q._bar(K, [-1.8, 3.4, 0.55], [-1.5, 4.3, 0.2], 0.05, P.t, 'crystal'); K.oct(-1.52, 4.2, 0.2, 0.13, 0.6, P.l, 'crystal', { rz: 0.4 }); K.fine(() => Q._dot(K, -1.6, 3.45, 0.55, 0.06, P.c, 2.6)); });
    K.fine(() => { for (const s of [-1, 1]) { Q._glo(K, [-3.9, 1.95, s * 0.7], [1.3, 1.95, s * 0.7], 0.03, P.c, 1.6); for (const x of [-1.9, -0.6, 0.6]) K.oct(x, 1.85, s * 1.42, 0.07, 0.3, P.l, 'crystal'); Q._drusa(K, P, 0.4, 1.9, s * 1.2, 0.5, s * 0.8, 31 + s);
        for (let i = 0; i < 5; i++) Q._pino(K, P, -3.4 + i * 1.1, 1.78, s * 1.5, 0.08, i % 2 ? P.d : P.t); K.tube([[-3.6, 0.9, s * 0.95], [-1.2, 0.72, s * 1.1], [1.2, 0.95, s * 0.7]], 0.07, P.c, null, { e: 1.4, ts: 8, rs: 4 }); }
      for (let i = 0; i < 4; i++) K.oct(-2.6 + i * 0.9, 2.05, 0, 0.1, 0.5, i % 2 ? P.l : P.a, 'crystal'); for (const s of [-1, 1]) { Q._fin(K, -4.1, 1.95, s * 0.6, 1.1, 0.8, P.b, { ry: -s * 0.35 }); Q._bar(K, [-3.95, 1.45, s * 1.05], [-1.9, 1.45, s * 1.05], 0.05, P.t, 'crystal', 4); for (let i = 0; i < 3; i++) K.oct(-3.0 + i * 0.4, 1.95, s * (0.55 + i * 0.12), 0.08, 0.36, i % 2 ? tc : P.l, 'crystal', { rz: s * 0.3 }); for (let i = 0; i < 4; i++) K.box(-2.9 + i * 1.1, 0.95, s * 1.12, 0.45, 0.06, 0.12, P.c, null, { e: 1.8, rx: s * 0.6 }); for (const x of [-2.95, -2.25]) Q._bar(K, [x, 1.2, s * 0.6], [x, 1.2, s * 1.5], 0.05, P.d, 'gloss', 4); } Q._bar(K, [-0.9, 2.0, -0.35], [-1.1, 3.0, -0.5], 0.04, P.t, 'crystal', 4); Q._dot(K, -1.1, 3.05, -0.5, 0.06, P.l, 2.6); Q._drusa(K, P, -1.6, 2.05, 0.1, 0.55, 0.5, 33); });
  },
  diapasao(K, P, tc) { /* 4.3d: Diapasão — garfo afinador alto sobre plataforma sextavada flutuante com garras; hastes vibram (flap), nota acesa sobe e desce entre elas, auréola na cor do time e anel de lascas do Elo (o render gira o modelo inteiro) */
    const Q = U.quorith;
    K.prism(0, 0.5, 0, 1.7, 0.5, 6, P.d, 'gloss', { top: 1.45 }); K.prism(0, 1.0, 0, 2.5, 0.1, 6, P.c, null, { e: 1.5 });
    K.prism(0, 1.1, 0, 2.55, 0.42, 6, P.t, 'crystal', { top: 0.86 }); K.prism(0, 1.52, 0, 2.2, 0.2, 6, tc, 'crystal', { top: 0.8 });
    ringOf(6, 2.0, (dx, dz) => Q._lev(K, P, dx, 0.62, dz, 0.22, 0, false)); /* o render faz flutuar: sem luz no chão */
    /* garras de cristal em volta da haste (três, simetria radial) */
    ringOf(3, 1.0, (dx, dz, a) => { const ca = Math.cos(a), sa = Math.sin(a); K.poly([[0, 0], [1.25, 0], [0.35, 2.7], [0, 2.4]], 0.16, P.b, 'crystal', { x: ca * 0.55, y: 1.65, z: sa * 0.55, ry: -a, b: K.lite ? 0 : 0.04, flat: true }); K.fine(() => { Q._glo(K, [ca * 1.6, 1.75, sa * 1.6], [ca * 0.95, 4.0, sa * 0.95], 0.025, P.c, 1.8); Q._drusa(K, P, Math.cos(a + PI / 3) * 1.6, 1.75, Math.sin(a + PI / 3) * 1.6, 0.6, a + PI / 3, 51); }); });
    /* haste e colares */
    K.prism(0, 1.72, 0, 0.72, 2.6, 6, P.a, 'crystal', { top: 0.8 }); for (const y of [2.25, 3.15, 4.0]) K.prism(0, y, 0, 0.74, 0.16, 6, y === 3.15 ? P.c : P.t, y === 3.15 ? null : 'crystal', y === 3.15 ? { e: 1.8 } : {});
    /* forquilha e hastes que vibram */
    Q._L6(K, 0, 4.25, 0, 0.62, 2.05, 0.55, 1.0, P.t, 'crystal'); Q._L6(K, 0, 4.8, 0, 0.56, 2.0, 0.14, 0.95, P.d, 'gloss');
    K.fine(() => { for (const s of [-1, 1]) { Q._glo(K, [0.45, 4.55, s * 0.3], [0.45, 4.55, s * 1.75], 0.025, P.c, 2); Q._pino(K, P, 0, 4.94, s * 0.75, 0.12, P.b); K.prism(0, 4.94, s * 1.5, 0.56, 0.08, 6, P.c, null, { e: 2 }); K.oct(0, 4.5, s * 2.3, 0.1, 0.62, P.l, 'crystal', { rx: s * H }); Q._dot(K, -0.45, 4.55, s * 1.5, 0.07, P.l, 2.6); } });
    for (const s of [-1, 1]) K.anim({ t: 'flap', p: [0, 4.9, s * 1.5], amp: 0.035, speed: 14, side: s }, () => {
      K.prism(0, 4.92, s * 1.5, 0.5, 6.3, 6, P.a, 'crystal', { top: 0.6 }); K.prism(0, 11.22, s * 1.5, 0.3, 1.0, 6, P.l, 'crystal', { top: 0.01 });
      for (const y of [6.5, 8.5]) K.prism(0, y, s * 1.5, 0.56, 0.16, 6, P.t, 'crystal');
      Q._dot(K, 0, 11.5, s * 1.5, 0.1, P.c, 2.8); Q._glo(K, [0, 5.1, s * 1.08], [0, 10.9, s * 1.25], 0.06, P.c, 2.1);
      K.fine(() => { for (const y of [7.5, 9.5]) K.prism(0, y, s * 1.5, 0.42, 0.05, 6, P.c, null, { e: 2 }); for (const y of [6.0, 8.0, 10.0]) K.oct(0.32, y, s * 1.78, 0.05, 0.26, P.l, 'crystal');
        for (const y of [5.3, 7.0, 9.0]) for (const k of [-1, 1]) K.box(k * 0.38, y, s * 1.5, 0.05, 1.0, 0.36, P.b, 'crystal', { ry: 0 }); for (const y of [6.05, 8.05, 10.3]) K.tor(0, y, s * 1.5, y > 10 ? 0.4 : 0.52, 0.035, P.l, null, { e: 1.6, ts: 6, rs: 3 }); K.prism(0, 10.9, s * 1.5, 0.36, 0.14, 6, P.t, 'crystal'); });
    });
    K.fine(() => { ringOf(6, 0.74, (dx, dz, a) => { const b = a + PI / 6; Q._bar(K, [Math.cos(b) * 0.7, 1.75, Math.sin(b) * 0.7], [Math.cos(b) * 0.58, 4.2, Math.sin(b) * 0.58], 0.05, P.t, 'crystal', 4); }); for (const s of [-1, 1]) Q._drusa(K, P, 0.35, 4.92, s * 0.35, 0.45, s * 1.2, 71 + s); ringOf(3, 2.15, (dx, dz) => { K.prism(dx, 1.72, dz, 0.18, 0.75, 6, P.b, 'crystal', { top: 0.5 }); Q._dot(K, dx, 2.55, dz, 0.07, P.c, 2.6); }); });
    K.fine(() => K.anim({ t: 'spin', p: [0, 5.4, 0], speed: -1.8 }, () => ringOf(6, 1.05, (dx, dz, a, i) => K.oct(dx, 5.25 + (i % 2) * 0.2, dz, 0.06, 0.3, i % 2 ? P.l : P.c, null, { e: 2.2 }))));
    /* nota: cristal aceso que sobe e desce entre as hastes */
    K.anim({ t: 'bob', amp: 0.45, speed: 2.2 }, () => { K.oct(0, 6.6, 0, 0.5, 1.7, P.l, 'crystal'); K.oct(0, 6.75, 0, 0.34, 1.4, P.c, null, { e: 2.6, ry: PI / 4 }); K.fine(() => ringOf(4, 0.62, (dx, dz) => K.oct(dx, 7.25, dz, 0.06, 0.3, P.l, null, { e: 2.2 }))); });
    /* auréola na cor do time (gira inclinada) e anel de lascas do Elo */
    K.anim({ t: 'spin', p: [0, 8.2, 0], speed: 1.3 }, () => { K.tor(0, 8.2, 0, 2.5, 0.07, tc, null, { e: 1.0, ts: 8, rs: 3, rx: 0.2 }); ringOf(K.q(4), 2.5, (dx, dz) => K.oct(dx, 8.2 + dz * 0.2 - 0.2, dz, 0.1, 0.4, P.l, null, { e: 2 })); K.fine(() => ringOf(8, 2.5, (dx, dz, a) => K.oct(dx * 1.05, 8.1 + dz * 0.2, dz * 1.05, 0.05, 0.22, P.a, 'crystal'))); });
    Q._lascas(K, P, 0, 1.45, 0, 2.75, K.q(8), 0.7, 0.9, {});
    K.fine(() => { ringOf(6, 2.3, (dx, dz) => Q._dot(K, dx, 1.47, dz, 0.07, P.l, 2.6)); ringOf(3, 0.75, (dx, dz) => K.oct(dx, 4.05, dz, 0.08, 0.5, P.l, 'crystal')); ringOf(12, 2.45, (dx, dz, a, i) => Q._pino(K, P, dx, 1.42, dz, 0.09, i % 2 ? P.a : P.d)); });
  },
  prisma(K, P, tc) { /* 4.3d: Prisma — casco do tanque (_casco, sem torre) com um grande prisma triangular em pé apontando para a frente (arestas de ametista, faces de gelo, luz por dentro), emissor na popa, lente e leque de raios refratados na proa */
    const Q = U.quorith; Q._casco(K, P, tc, { chao: false }); /* o render faz o Prisma flutuar: sem luz no chão */
    /* berço e prisma triangular: faces de gelo, arestas de ametista, fresta acesa no meio de cada face (segue a inclinação) */
    const px = -0.4, y0 = 2.9, hp = 3.2, R0 = 2.7, R1 = 2.2, tl = Math.atan((R0 - R1) * 0.5 / hp);
    K.prism(px, 2.6, 0, 2.0, 0.3, 6, P.d, 'gloss', { ry: PI / 6 });
    K.prism(px, y0, 0, R0 * 0.93, hp, 3, P.a, 'crystal', { top: R1 / R0, ry: H });
    ringOf(3, 1, (dx, dz, a) => { const c = Math.cos(a), sn = Math.sin(a); Q._bar(K, [px + c * R0, y0, sn * R0], [px + c * R1, y0 + hp, sn * R1], 0.22, P.t, 'crystal', 6); K.fine(() => Q._glo(K, [px + c * (R0 + 0.12), y0 + 0.2, sn * (R0 + 0.12)], [px + c * (R1 + 0.12), y0 + hp - 0.2, sn * (R1 + 0.12)], 0.04, P.l, 2.2));
      const b = a + PI / 3, fc = Math.cos(b), fs = Math.sin(b), ap = R0 * 0.93 * 0.5 + 0.03; K.box(px + fc * ap, y0 + 0.3, fs * ap, 0.07, hp - 0.6, 0.34, P.c, null, { e: 2.2, ry: -b, rz: tl });
      K.fine(() => { for (const k of [-1, 1]) { const w0 = R0 * 0.93 * 0.866 * 0.62, w1 = R1 * 0.93 * 0.866 * 0.62, a0 = R0 * 0.93 * 0.5 + 0.03, a1 = R1 * 0.93 * 0.5 + 0.03; Q._glo(K, [px + fc * a0 - fs * k * w0, y0 + 0.35, fs * a0 + fc * k * w0], [px + fc * a1 - fs * k * w1, y0 + hp - 0.35, fs * a1 + fc * k * w1], 0.025, P.l, 1.7); } }); });
    K.prism(px, y0 + hp * 0.5 - 0.1, 0, R0 * 0.93 * (1 - (1 - R1 / R0) * 0.47) + 0.08, 0.2, 3, P.t, 'crystal', { ry: H });
    K.prism(px, y0 + hp, 0, R1 * 0.98, 0.3, 3, tc, 'crystal', { top: 0.7, ry: H }); Q._dot(K, px, y0 + hp + 0.55, 0, 0.16, P.l, 2.6);
    K.fine(() => ringOf(3, 1, (dx, dz) => K.oct(px + dx * R1 * 0.72, y0 + hp + 0.3, dz * R1 * 0.72, 0.1, 0.5, P.l, 'crystal')));
    /* emissor na popa alimenta o prisma */
    Q._X6(K, -4.7, 3.6, 0, 0.46, 2.2, P.d, 'gloss'); K.cone(-4.7, 3.6, 0, 0.46, 0.55, P.t, 'crystal', { seg: 6, flat: true, rz: H }); for (const x of [-4.2, -3.4]) Q._X6(K, x, 3.6, 0, 0.55, 0.14, P.c, null, { e: 1.8 }); Q._glo(K, [-2.5, 3.6, 0], [-1.7, 3.6, 0], 0.1, P.c, 2.4);
    Q._bar(K, [-3.6, 2.7, 0], [-3.6, 3.2, 0], 0.18, P.t, 'crystal');
    K.fine(() => { for (let i = 0; i < 4; i++) { const a = i * H + PI / 4; K.cone(-4.0, 3.6 + Math.cos(a) * 0.45, Math.sin(a) * 0.45, 1, 0.9, P.b, 'crystal', { seg: 4, flat: true, rz: H, sx: 0.2, sz: 0.04, rx: a }); } });
    /* lente e leque de raios refratados na proa (recua ao disparar) */
    K.anim({ t: 'recoil', dist: 0.45 }, () => {
      Q._X6(K, 2.2, 3.6, 0, 0.36, 1.1, P.t, 'crystal'); K.oct(3.3, 3.6, 0, 0.62, 1.0, P.l, 'crystal', { rz: -H, sx: 0.6 });
      for (let i = -2; i <= 2; i++) { const a = i * 0.2; K.cone(3.9, 3.6, 0, 0.1, 2.3 - Math.abs(i) * 0.3, P.c, null, { e: 2.2, seg: 4, rz: -H, ry: -a }); }
      K.fine(() => { for (const s of [-1, 1]) K.oct(3.0, 3.6, s * 0.55, 0.12, 0.6, P.a, 'crystal', { rz: -H + s * 0.3 }); for (let i = -1; i <= 1; i += 2) K.cone(3.9, 3.6, 0, 0.05, 1.7, P.l, null, { e: 2.4, seg: 4, rz: -H, ry: -i * 0.3 }); Q._X6(K, 2.5, 3.6, 0, 0.42, 0.1, P.c, null, { e: 2 }); });
    });
    Q._bar(K, [2.4, 2.7, 0], [2.4, 3.3, 0], 0.2, P.t, 'crystal');
    K.anim({ t: 'spin', p: [px, 4.5, 0], speed: 1.1 }, () => { K.tor(px, 4.5, 0, 3.05, 0.07, P.l, null, { e: 1.8, ts: 6, rs: 3, rx: 0.22 }); K.fine(() => ringOf(6, 3.05, (dx, dz, a, i) => K.oct(px + dx, 4.3 + dz * 0.22, dz, i % 2 ? 0.08 : 0.12, i % 2 ? 0.34 : 0.5, i % 2 ? P.l : P.a, 'crystal'))); });
  },
  monolito(K, P, tc) { /* 4.3d: Monólito — obelisco sextavado maciço em dois blocos com fresta acesa, sobre estrado em degraus escorado por cristais; ápice flutuante com coroa que gira, canais de notas acesas nas faces e três pedras de cerco em órbita (o render gira e balança o modelo) */
    const Q = U.quorith;
    /* estrado em degraus: escuro, costura acesa, cinta de ametista, faixa na cor do time e degrau escuro */
    K.prism(0, 0.6, 0, 2.8, 0.6, 6, P.d, 'gloss', { top: 1.45 }); K.prism(0, 1.2, 0, 4.05, 0.12, 6, P.c, null, { e: 1.5 }); K.prism(0, 1.32, 0, 4.1, 0.5, 6, P.t, 'crystal', { top: 0.92 }); K.prism(0, 1.82, 0, 3.77, 0.2, 6, tc, 'crystal', { top: 0.94 });
    K.prism(0, 2.02, 0, 3.2, 0.42, 6, P.d, 'gloss', { top: 0.88 }); K.prism(0, 2.44, 0, 2.86, 0.08, 6, P.c, null, { e: 1.6 });
    ringOf(6, 3.2, (dx, dz) => Q._lev(K, P, dx, 0.7, dz, 0.36, 0, false)); /* o render faz flutuar: sem luz no chão */
    /* escoras: cristais encostados nos cantos do obelisco, três grandes e três menores (simetria de 3) */
    ringOf(6, 1, (dx, dz, a, i) => { const ar = a + PI / 6, cx = Math.cos(ar), cz = Math.sin(ar), big = !(i % 2), t = big ? 0.3 : 0.38;
      K.oct(cx * (big ? 3.05 : 3.12), 1.7, cz * (big ? 3.05 : 3.12), big ? 0.86 : 0.6, big ? 5.2 : 3.6, big ? P.b : P.a, 'crystal', { rz: cx * t, rx: -cz * t });
      K.fine(() => { K.oct(cx * 3.6, 1.9, cz * 3.6, 0.3, big ? 2.2 : 1.6, P.t, 'crystal', { rz: cx * 0.1, rx: -cz * 0.1 }); Q._glo(K, [cx * 3.65, 2.1, cz * 3.65], [cx * (big ? 2.5 : 2.7), big ? 6.2 : 4.9, cz * (big ? 2.5 : 2.7)], 0.03, P.c, 1.8); }); });
    /* obelisco: dois blocos com fresta acesa e chanfro no topo; canal aceso com notas em cada face, frisos e placas em relevo (seguem a inclinação) */
    const B = [[2.6, 2.5, 5.0, 2.32], [2.24, 7.8, 3.9, 1.95]];
    B.forEach(([r, y, h, r2], k) => { const ap = f => (r + (r2 - r) * f) * 0.866, tl = Math.atan((r - r2) * 0.866 / h);
      K.prism(0, y, 0, r, h, 6, P.a, 'crystal', { top: r2 / r });
      ringOf(6, 1, (dx, dz, a, i) => { const rr = ap(0.1) + 0.03; K.box(dx * rr, y + h * 0.1, dz * rr, 0.08, h * 0.72, 0.13, P.c, null, { e: 2, ry: -a, rz: tl });
        const ar = a + PI / 6, ca = Math.cos(ar), sa = Math.sin(ar), rv = r * 0.97; Q._bar(K, [ca * rv, y + 0.05, sa * rv], [ca * r2 * 0.97, y + h - 0.05, sa * r2 * 0.97], 0.1, k ? P.b : P.t, 'crystal', 4); });
      K.fine(() => ringOf(6, 1, (dx, dz, a, i) => { const tx = -Math.sin(a), tz = Math.cos(a); for (let g = 0; g < 4; g++) { const f = 0.18 + g * 0.17 + (i % 2) * 0.06, rr = ap(f) + 0.05, sd = (g % 2 ? 1 : -1) * 0.22; K.oct(dx * rr + tx * sd, y + h * f - 0.12, dz * rr + tz * sd, 0.12, 0.26, g === 1 ? P.l : P.c, null, { e: 2, ry: -a + PI / 4 }); }
        const rr = ap(0.9) + 0.05; K.box(dx * rr, y + h * 0.9, dz * rr, 0.14, 0.14, r * 0.92, P.t, 'crystal', { ry: -a, rz: tl });
        if (i % 2) for (const k2 of [-1, 1]) { const rp = ap(0.5) + 0.04; K.box(dx * rp + tx * k2 * r * 0.3, y + h * 0.3, dz * rp + tz * k2 * r * 0.3, 0.06, h * 0.45, r * 0.22, P.b, 'crystal', { ry: -a, rz: tl }); } }));
      K.prism(0, y + h, 0, r2, 0.3, 6, k ? P.l : P.b, 'crystal', { top: 0.8 });
      if (!k) { K.prism(0, y + h + 0.3, 0, r2 * 0.82, 0.22, 6, P.c, null, { e: 2.4 }); K.prism(0, y + h + 0.52, 0, r2 * 0.92, 0.18, 6, tc, 'crystal'); }
    });
    /* ápice: cristal flutuante aceso por dentro, coroa de lascas que gira em volta */
    K.anim({ t: 'bob', amp: 0.3, speed: 1.6 }, () => { K.oct(0, 12.45, 0, 1.15, 3.0, P.l, 'crystal', { ry: PI / 6 }); K.oct(0, 12.8, 0, 0.72, 2.3, P.c, null, { e: 2.4 }); K.fine(() => { ringOf(3, 0.85, (dx, dz) => K.oct(dx, 12.35, dz, 0.17, 0.95, P.a, 'crystal', { rz: dx * 0.5, rx: -dz * 0.5 })); Q._dot(K, 0, 15.62, 0, 0.15, P.c, 2.8); ringOf(3, 0.5, (dx, dz) => K.oct(dx, 14.6, dz, 0.06, 0.34, P.l, null, { e: 2.2 })); }); });
    K.anim({ t: 'spin', p: [0, 13.4, 0], speed: -1.1 }, () => { K.tor(0, 13.4, 0, 2.3, 0.09, P.l, null, { e: 2, ts: 6, rs: 3 }); ringOf(6, 2.3, (dx, dz) => K.oct(dx, 13.0, dz, 0.15, 0.85, P.a, 'crystal')); K.fine(() => ringOf(6, 2.3, (dx, dz, a) => { const b = a + PI / 6; K.oct(Math.cos(b) * 2.3, 13.2, Math.sin(b) * 2.3, 0.07, 0.4, P.l, null, { e: 2.2 }); })); });
    /* colar de palhetas de cristal que gira em volta do bloco de cima (o ressonador do cerco) */
    K.anim({ t: 'spin', p: [0, 9.6, 0], speed: 0.45 }, () => ringOf(6, 2.7, (dx, dz, a, i) => { K.poly([[-0.45, 0], [0.45, 0], [0.32, 2.4], [0, 2.8], [-0.32, 2.4]], 0.14, i % 2 ? P.t : P.a, 'crystal', { x: dx, y: 8.3, z: dz, ry: -a + H, rx: -0.1, b: K.lite ? 0 : 0.04, flat: true });
      K.fine(() => { Q._glo(K, [dx * 0.96, 8.5, dz * 0.96], [dx * 0.99, 10.7, dz * 0.99], 0.03, P.c, 2); Q._dot(K, dx * 1.02, 11.25, dz * 1.02, 0.07, P.l, 2.6); K.prism(dx * 0.93, 8.1, dz * 0.93, 0.2, 0.25, 6, P.d, 'gloss'); K.poly([[-0.25, 0], [0.25, 0], [0.18, 1.5], [0, 1.75], [-0.18, 1.5]], 0.08, i % 2 ? P.a : P.b, 'crystal', { x: dx * 0.9, y: 8.6, z: dz * 0.9, ry: -a + H, rx: -0.05, flat: true }); }); }));
    K.fine(() => K.anim({ t: 'spin', p: [0, 8.0, 0], speed: -0.65 }, () => ringOf(14, 3.7, (dx, dz, a, i) => K.oct(dx, 7.6 + Math.sin(a * 3) * 0.5, dz, 0.1 + (i % 3) * 0.04, 0.45 + (i % 3) * 0.2, i % 2 ? P.a : P.t, 'crystal', { rz: dx * 0.2, rx: -dz * 0.2 }))));
    K.fine(() => { ringOf(6, 2.98, (dx, dz) => Q._glo(K, [dx, 2.5, dz], [dx * 0.86, 8.3, dz * 0.86], 0.03, P.l, 1.7)); ringOf(12, 4.0, (dx, dz, a, i) => K.cone(dx, 1.2, dz, 0.16, 0.5, P.t, 'crystal', { seg: 6, flat: true, rx: PI })); ringOf(6, 1.72, (dx, dz, a, i) => { const b = a + PI / 6; K.prism(Math.cos(b) * 1.72, 11.95, Math.sin(b) * 1.72, 0.16, 0.6, 6, i % 2 ? P.l : P.a, 'crystal', { top: 0.3 }); });
      K.tor(0, 11.9, 0, 1.25, 0.05, P.c, null, { e: 2, ts: 6, rs: 3 }); });
    /* três pedras de cerco em órbita, cada uma um tufo de cristais com núcleo aceso, anel e satélites */
    K.anim({ t: 'spin', p: [0, 7, 0], speed: 0.55 }, () => ringOf(3, 4.85, (dx, dz, a) => { const ca = Math.cos(a), sa = Math.sin(a);
      K.prism(dx, 5.0, dz, 1.05, 2.6, 6, P.t, 'crystal', { top: 0.92, ry: a }); K.cone(dx, 7.6, dz, 0.97, 1.5, P.b, 'crystal', { seg: 6, flat: true, ry: a + PI / 6 }); K.cone(dx, 5.0, dz, 1.05, 1.6, P.t, 'crystal', { seg: 6, flat: true, rx: PI, ry: a + PI / 6 }); for (let j = -1; j <= 1; j++) { const t = a + j * PI / 3, ap = 1.05 * 0.866 + 0.025; K.box(dx + Math.cos(t) * ap, 5.15, dz + Math.sin(t) * ap, 0.07, 1.75, 0.12, P.c, null, { e: 1.9, ry: -t, rz: 0.028 }); } /* fraturas acesas nas faces de fora (sem pontos que pareçam olhos) */ K.oct(dx * 0.86, 4.8, dz * 0.86, 0.72, 2.8, P.a, 'crystal', { ry: a + 0.4, rz: -ca * 0.3, rx: sa * 0.3 }); K.oct(dx * 1.12, 4.5, dz * 1.12, 0.55, 2.2, P.b, 'crystal', { ry: a - 0.5, rz: ca * 0.35, rx: -sa * 0.35 });
      K.fine(() => { K.tor(dx, 7.75, dz, 0.9, 0.05, P.l, null, { e: 1.8, ts: 6, rs: 3 }); for (const k of [-1, 1]) { K.oct(dx + Math.cos(a + k * 0.5) * 0.8, 3.6, dz + Math.sin(a + k * 0.5) * 0.8, 0.2, 1.0, P.b, 'crystal'); K.oct(dx - sa * k * 1.25, 6.4, dz + ca * k * 1.25, 0.12, 0.6, P.l, 'crystal'); K.oct(dx - sa * k * 0.7, 6.9, dz + ca * k * 0.7, 0.16, 0.9, P.a, 'crystal', { rz: -ca * k * 0.4, rx: sa * k * 0.4 }); } Q._dot(K, dx, 3.9, dz, 0.12, P.c, 2.4); Q._drusa(K, P, dx * 0.92, 6.3, dz * 0.92, 0.7, a, 61); Q._glo(K, [dx * 0.8, 5.7, dz * 0.8], [dx * 0.55, 5.9, dz * 0.55], 0.04, P.c, 2.2); Q._dot(K, dx * 0.54, 5.9, dz * 0.54, 0.09, P.l, 2.6); for (let j = 0; j < 4; j++) { const t = a + PI / 2 + j * PI / 2, rr = 1.15; K.prism(dx + Math.cos(t) * rr, 4.4 + (j % 2) * 1.6, dz + Math.sin(t) * rr, 0.16, 0.7, 6, j % 2 ? P.a : P.l, 'crystal', { top: 0.2, rz: Math.cos(t) * 0.5, rx: -Math.sin(t) * 0.5 }); } }); }));
    Q._lascas(K, P, 0, 3.2, 0, 4.3, K.q(9), -0.8, 1.0, { lean: 0.4, c2: P.b });
    K.fine(() => { ringOf(6, 3.8, (dx, dz) => Q._dot(K, dx, 1.84, dz, 0.09, P.l, 2.6)); ringOf(6, 3.0, (dx, dz, a) => Q._drusa(K, P, dx, 2.45, dz, 0.55, a, 41)); ringOf(6, 3.55, (dx, dz, a) => { const b = a + PI / 6; Q._drusa(K, P, Math.cos(b) * 3.75, 2.0, Math.sin(b) * 3.75, 0.5, b, 43); }); ringOf(6, 0.95, (dx, dz, a) => K.box(dx, 11.4, dz, 0.05, 0.42, 0.5, P.l, null, { e: 1.6, ry: -a })); ringOf(18, 3.95, (dx, dz, a, i) => Q._pino(K, P, dx, 1.8, dz, 0.1, i % 3 ? P.b : P.d)); ringOf(12, 2.95, (dx, dz, a, i) => Q._pino(K, P, dx, 2.44, dz, 0.08, i % 2 ? P.t : P.a)); ringOf(6, 2.98, (dx, dz) => { K.prism(dx, 2.02, dz, 0.2, 0.85, 6, P.b, 'crystal', { top: 0.55 }); Q._dot(K, dx, 2.95, dz, 0.07, P.c, 2.6); }); ringOf(6, 2.62, (dx, dz, a) => { const b = a + PI / 6; K.box(Math.cos(b) * 2.62, 2.44, Math.sin(b) * 2.62, 0.5, 0.05, 0.08, P.c, null, { e: 2, ry: -b + H }); }); });
  },
  harmonico(K, P, tc) { /* 4.3d: Harmônico — acorde voador compacto: três vozes de cristal num triângulo de ametista com juntas e filetes acesos, cubo escuro com núcleo na cor do time e anéis giroscópicos justos em sentidos opostos (o render gira o modelo inteiro) */
    const Q = U.quorith, R = 1.75;
    K.prism(0, 0.7, 0, 0.72, 0.42, 6, P.d, 'gloss', { top: 1.25 }); K.prism(0, 1.12, 0, 0.9, 0.08, 6, P.c, null, { e: 1.8 }); K.prism(0, 1.2, 0, 0.9, 0.3, 6, P.d, 'gloss', { top: 0.6 });
    K.oct(0, 0.15, 0, 0.55, 2.6, tc, 'crystal', { ry: PI / 6 }); K.oct(0, 0.75, 0, 0.32, 1.4, P.l, null, { e: 2.2 });
    ringOf(3, R, (dx, dz, a) => { const ca = Math.cos(a), sa = Math.sin(a);
      K.oct(dx, -0.1, dz, 0.48, 2.8, P.a, 'crystal', { rz: -ca * 0.3, rx: sa * 0.3, ry: -a }); K.oct(dx * 1.02, 0.5, dz * 1.02, 0.28, 1.6, P.c, null, { e: 2, rz: -ca * 0.3, rx: sa * 0.3, ry: -a + PI / 4 }); K.oct(dx * 0.86, 0.1, dz * 0.86, 0.26, 1.5, P.t, 'crystal', { rz: -ca * 0.5, rx: sa * 0.5 });
      K.prism(dx * 1.06, 1.25, dz * 1.06, 0.48, 0.18, 6, P.t, 'crystal');
      Q._bar(K, [ca * 0.7, 1.1, sa * 0.7], [dx * 0.88, 1.2, dz * 0.88], 0.1, P.b, 'crystal');
      const b = a + PI * 2 / 3, nx = Math.cos(b) * R, nz = Math.sin(b) * R; Q._bar(K, [dx, 1.32, dz], [nx, 1.32, nz], 0.14, P.t, 'crystal', 6); Q._glo(K, [dx, 1.5, dz], [nx, 1.5, nz], 0.035, P.c, 1.8);
      K.fine(() => { Q._dot(K, dx * 1.16, 2.65, dz * 1.16, 0.08, P.l, 2.6); K.oct(dx * 1.3, 0.75, dz * 1.3, 0.08, 0.5, P.l, 'crystal', { rz: -ca * 0.6, rx: sa * 0.6 }); const mx = (dx + nx) / 2, mz = (dz + nz) / 2; K.oct(mx, 1.0, mz, 0.1, 0.62, P.a, 'crystal'); Q._dot(K, mx, 0.95, mz, 0.05, P.c, 2.4);
        K.tor(dx * 1.06, 0.6, dz * 1.06, 0.42, 0.03, P.l, null, { e: 1.8, ts: 6, rs: 3 }); for (const k of [-1, 1]) K.oct(dx * 1.06 - sa * k * 0.42, 0.2, dz * 1.06 + ca * k * 0.42, 0.1, 0.62, P.b, 'crystal', { rx: ca * k * 0.5, rz: sa * k * 0.5 }); Q._bar(K, [mx, 1.15, mz], [mx * 0.44, 1.15, mz * 0.44], 0.05, P.b, 'crystal', 4);
        K.box(dx * 0.42, 0.95, dz * 0.42, 0.5, 0.36, 0.06, P.t, 'crystal', { ry: -a }); K.prism(dx * 1.12, 2.3, dz * 1.12, 0.12, 0.42, 6, P.l, 'crystal', { top: 0.05 }); Q._glo(K, [dx * 0.94, 0.3, dz * 0.94], [dx * 1.1, 2.1, dz * 1.1], 0.025, P.l, 2); K.oct(dx * 1.12, 1.3, dz * 1.12, 0.07, 0.5, P.a, 'crystal', { rz: H, ry: -a }); K.cone(ca * 0.35, 1.5, sa * 0.35, 1, 0.6, P.b, 'crystal', { seg: 4, flat: true, sx: 0.04, sz: 0.2, ry: -a }); K.prism(dx, 1.22, dz, 0.24, 0.28, 6, P.d, 'gloss'); ringOf(3, 0.16, (ex, ez) => K.oct(dx * 1.16 + ex, 2.2, dz * 1.16 + ez, 0.05, 0.3, P.l, 'crystal')); Q._bar(K, [dx, 0.95, dz], [nx, 0.95, nz], 0.04, P.d, 'gloss', 4); });
    });
    K.anim({ t: 'spin', p: [0, 1.15, 0], speed: -3 }, () => K.tor(0, 1.15, 0, 1.05, 0.05, P.l, null, { e: 2, ts: 6, rs: 3, rx: 0.5 }));
    K.anim({ t: 'spin', p: [0, 1.15, 0], speed: 2.4 }, () => { K.tor(0, 1.15, 0, 1.25, 0.06, tc, null, { e: 1.1, ts: 6, rs: 3, rz: 0.5 }); K.fine(() => ringOf(3, 1.25, (dx, dz) => K.oct(dx, 1.0 + dx * 0.22, dz, 0.07, 0.32, P.l, null, { e: 2 }))); });
    K.anim({ t: 'bob', amp: 0.2, speed: 3 }, () => { K.oct(0, 1.75, 0, 0.24, 0.9, P.l, 'crystal'); K.fine(() => { Q._dot(K, 0, 2.8, 0, 0.08, P.c, 2.6); ringOf(3, 0.3, (dx, dz) => K.oct(dx, 1.6, dz, 0.06, 0.4, P.a, 'crystal')); }); });
    K.fine(() => { Q._dot(K, 0, -0.2, 0, 0.12, P.c, 2.4); ringOf(6, 0.86, (dx, dz, a) => K.box(dx, 0.75, dz, 0.24, 0.36, 0.05, P.t, 'crystal', { ry: -a + H })); K.anim({ t: 'spin', p: [0, 1.3, 0], speed: -1.2 }, () => ringOf(6, 1.98, (dx, dz, a, i) => K.oct(dx, 1.05 + (i % 2) * 0.3, dz, 0.06, 0.34, i % 2 ? P.l : P.a, 'crystal'))); });
  },
  /* 4.3e — soldados do Coro e Catedral Errante: ajudantes internos (mesma convenção da 4.3d: frente em +x, chão em y = 0) */
  _bip(K, a, b, r, col, mat, o) { /* 4.3e: lasca de cristal de a até b — estações o.st [fração, raio relativo] (padrão: ponta, cintura na fração o.f, ponta), o.n lados (a versão leve tira 2 de quem tem mais de 4), o.sq achata a seção na direção de o.up (padrão: cima; frente se a lasca for vertical), o.tw gira a seção */
    o = o || {}; const n0 = o.n || 6, n = K.lite && n0 > 4 ? n0 - 2 : n0, st = o.st || [[0, 0], [o.f == null ? 0.5 : o.f, 1], [1, 0]], sq = o.sq || 1, tw = o.tw || 0;
    const A = new T.Vector3(a[0], a[1], a[2]), d = new T.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]); const L = d.length() || 0.001; d.multiplyScalar(1 / L);
    const ref = o.up ? new T.Vector3(o.up[0], o.up[1], o.up[2]) : Math.abs(d.y) < 0.9 ? new T.Vector3(0, 1, 0) : new T.Vector3(1, 0, 0);
    const u = new T.Vector3().crossVectors(ref, d); if (u.lengthSq() < 1e-8) u.crossVectors(Math.abs(d.y) < 0.9 ? new T.Vector3(0, 1, 0) : new T.Vector3(1, 0, 0), d); u.normalize(); const v = new T.Vector3().crossVectors(d, u).normalize(); /* referência paralela à lasca: usa outra */
    const R = st.map(([f, k]) => { const c = A.clone().addScaledVector(d, f * L), rr = k * r; if (rr <= 1e-5) return { c, p: null }; const p = []; for (let i = 0; i < n; i++) { const t = tw + i / n * PI * 2; p.push(c.clone().addScaledVector(u, Math.cos(t) * rr).addScaledVector(v, Math.sin(t) * rr * sq)); } return { c, p }; });
    const pos = [], V = q => pos.push(q.x, q.y, q.z);
    for (let j = 0; j < R.length - 1; j++) { const r0 = R[j], r1 = R[j + 1]; for (let i = 0; i < n; i++) { const i2 = (i + 1) % n;
      if (r0.p && r1.p) { V(r0.p[i]); V(r0.p[i2]); V(r1.p[i2]); V(r0.p[i]); V(r1.p[i2]); V(r1.p[i]); } else if (r0.p) { V(r0.p[i]); V(r0.p[i2]); V(r1.c); } else if (r1.p) { V(r0.c); V(r1.p[i2]); V(r1.p[i]); } } }
    const f0 = R[0].p, f1 = R[R.length - 1].p; if (f0) for (let i = 1; i < n - 1; i++) { V(f0[0]); V(f0[i + 1]); V(f0[i]); } if (f1) for (let i = 1; i < n - 1; i++) { V(f1[0]); V(f1[i]); V(f1[i + 1]); }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); return K._push(g, col, mat, { e: o.e, anim: o.anim, pat: o.pat, flat: true }); },
  _pr(K, x, y, z, r, h, col, mat, o) { o = o || {}; const a = o.ax || [0, 1, 0]; return U.quorith._bip(K, [x, y, z], [x + a[0] * h, y + a[1] * h, z + a[2] * h], r, col, mat, { n: o.n || 6, st: [[0, 1], [1, o.top == null ? 1 : o.top]], sq: o.sx || 1, tw: o.tw || 0, up: o.up, e: o.e, anim: o.anim }); }, /* 4.3e: prisma de o.n lados (6; 4 na versão leve) de (x, y, z) ao longo do eixo o.ax (cima), base r e topo r·o.top; o.sx achata (na frente, se em pé), o.tw gira a seção */
  _soldado(K, P, tc, o) { /* 4.3e: corpo do soldado de cristal (infantaria e agulha): pernas que andam (leg, do quadril) com coxa escura, joelho violeta e canela de gelo, quadril e cintura escuros, peito em V de gelo com núcleo aceso, gola violeta, ombreiras grandes na cor do time e cabeça de cristal flutuante sem rosto (bob) com faixa acesa e crista na cor do time; na completa (K.fine) dedos, joelheiras, caneleiras, tornozelos acesos, placas do quadril, costura acesa, peitorais, espinha, gola alta, juntas dos ombros e segundo degrau das ombreiras. Devolve os pontos dos ombros [esquerdo, direito] */
    o = o || {}; const Q = U.quorith, b = o.bulk || 1, S = o.stride || 10, hy = 2.15, hz = 0.29 * b;
    for (const s of [-1, 1]) K.anim(legSpec([0, hy, s * hz], { amp: 0.44, stride: S, ph: s > 0 ? 0 : PI }), () => {
      const kn = [0.15, 1.15, s * (hz + 0.04)], ft = [0.0, 0.06, s * (hz + 0.07)];
      Q._bip(K, [0.02, hy + 0.12, s * hz], kn, 0.24 * b, P.d, 'gloss', { n: 5, st: [[0, 0.7], [0.28, 1], [1, 0.5]], sq: 0.85 });
      Q._bip(K, kn, ft, 0.21 * b, P.a, 'crystal', { n: 5, st: [[0, 0.62], [0.22, 1], [1, 0.16]], sq: 0.85 });
      K.oct(kn[0] + 0.03, kn[1] - 0.15, kn[2], 0.15 * b, 0.32, P.t, 'crystal');
      K.fine(() => { Q._bip(K, [-0.18, 0.12, ft[2]], [0.4, 0.04, ft[2]], 0.12 * b, P.l, 'crystal', { n: 4, sq: 0.5, f: 0.3 }); Q._bip(K, [kn[0] + 0.04, kn[1] - 0.2, kn[2]], [kn[0] + 0.3, kn[1] + 0.3, kn[2]], 0.1, P.t, 'crystal', { n: 4, f: 0.35, sq: 0.6 }); K.oct(kn[0] + 0.15, kn[1] - 0.08, kn[2], 0.05, 0.14, P.c, null, { e: 2.4 });
        Q._bip(K, [0.02, hy - 0.2, s * (hz + 0.2 * b)], [0.1, hy - 0.75, s * (hz + 0.22 * b)], 0.1, P.a, 'crystal', { n: 4, sq: 0.45, up: [0, 0, 1], f: 0.3 });
        Q._bip(K, [kn[0] + 0.12, kn[1] - 0.3, kn[2]], [ft[0] + 0.12, 0.4, ft[2]], 0.1, P.l, 'crystal', { n: 4, sq: 0.45, up: [1, 0, 0], f: 0.25 }); K.oct(ft[0] + 0.03, 0.3, ft[2], 0.06, 0.16, P.c, null, { e: 2.2 }); });
    });
    /* quadril e cintura escuros (costura acesa e placas de gelo do quadril só na completa) */
    Q._pr(K, 0, 1.86, 0, 0.3 * b, 0.46, P.d, 'gloss', { top: 1.35, sx: 0.8 });
    Q._pr(K, 0, 2.39, 0, 0.29 * b, 0.36, P.d, 'gloss', { top: 1.2, sx: 0.84 });
    K.fine(() => { Q._pr(K, 0, 2.32, 0, 0.42 * b, 0.07, P.c, null, { sx: 0.8, e: 2 }); for (const s of [-1, 1]) { Q._bip(K, [0, 2.34, s * 0.36 * b], [0.02, 1.72, s * 0.5 * b], 0.2 * b, P.a, 'crystal', { n: 4, sq: 0.35, up: [0, 0, 1], st: [[0, 0.8], [0.35, 1], [1, 0]] }); Q._bip(K, [0.2 * b, 2.36, s * 0.12], [0.3 * b, 1.95, s * 0.16], 0.1, P.b, 'crystal', { n: 4, sq: 0.4, up: [1, 0, 0], st: [[0, 1], [0.4, 1], [1, 0]] }); } });
    /* peito em V (gelo), achatado na frente, núcleo aceso no esterno, gola violeta e pescoço aceso */
    Q._pr(K, 0, 2.68, 0, 0.34 * b, 0.98, P.a, 'crystal', { top: 1.95, sx: 0.66 });
    K.oct(0.22 * b, 2.84, 0, 0.14 * b, 0.62, P.c, null, { e: 2.5 });
    Q._pr(K, 0, 3.62, 0, 0.7 * b, 0.15, P.t, 'crystal', { top: 0.68, sx: 0.66 });
    K.oct(0, 3.74, 0, 0.12, 0.34, P.c, null, { e: 2.6 });
    K.fine(() => { for (const s of [-1, 1]) { Q._bip(K, [0.22 * b, 2.78, s * 0.13], [0.33 * b, 3.62, s * 0.44 * b], 0.09, P.l, 'crystal', { n: 4, f: 0.5, sq: 0.5 }); Q._glo(K, [0.03, 2.48, s * 0.33 * b], [0.03, 3.58, s * 0.6 * b], 0.03, P.c, 1.8); Q._bip(K, [-0.2 * b, 2.75, s * 0.1], [-0.3 * b, 3.6, s * 0.42 * b], 0.09, P.b, 'crystal', { n: 4, f: 0.5, sq: 0.5 });
        Q._bip(K, [-0.1, 3.7, s * 0.22], [-0.16, 4.12, s * 0.3], 0.07, P.l, 'crystal', { n: 4, f: 0.3 }); K.oct(0, 3.4, s * 0.62 * b, 0.14, 0.32, P.d, 'gloss'); }
      for (let i = 0; i < 3; i++) K.oct(-0.26 * b - i * 0.02, 2.5 + i * 0.36, 0, 0.06, 0.24, P.b, 'crystal', { rz: 0.5 }); });
    /* ombreiras grandes na cor do time, inclinadas para fora (borda escura, segundo degrau, lasca de gelo e luz só na completa) */
    const so = 0.82 * b, sy = 3.36, tl = 0.52;
    for (const s of [-1, 1]) { const ax = [0, Math.cos(tl), s * Math.sin(tl)];
      Q._pr(K, 0, sy, s * so, 0.43 * b, 0.46 * b, tc, 'crystal', { ax, up: [1, 0, 0], top: 0.5 });
      K.fine(() => { Q._pr(K, 0, sy - 0.1, s * (so - 0.02), 0.45 * b, 0.12, P.d, 'gloss', { ax, up: [1, 0, 0] }); Q._pr(K, -0.02, sy + 0.32, s * (so + 0.07), 0.27 * b, 0.24 * b, tc, 'crystal', { ax, up: [1, 0, 0], top: 0.4, tw: PI / 6 });
        Q._bip(K, [-0.08, sy + 0.22, s * (so + 0.12)], [-0.2, sy + 0.72, s * (so + 0.36)], 0.1, P.l, 'crystal', { n: 4, f: 0.3 }); Q._dot(K, 0.34 * b, sy + 0.05, s * (so + 0.1), 0.05, P.c, 2.4); }); }
    /* cabeça flutuante: bipirâmide de cristal com faixa acesa no equador e crista na cor do time */
    K.anim({ t: 'bob', amp: 0.045, speed: 2.4 }, () => {
      Q._bip(K, [0, 3.9, 0], [0, 5.02, 0], 0.35, P.l, 'crystal', { n: 6, f: 0.4 });
      Q._pr(K, 0, 4.32, 0, 0.365, 0.065, P.c, null, { e: 2.4 });
      Q._bip(K, [-0.36, 4.55, 0], [0.16, 5.22, 0], 0.17, tc, 'crystal', { n: 4, sq: 0.32, f: 0.42, up: [0, 0, 1] });
      K.fine(() => { for (const s of [-1, 1]) Q._bip(K, [-0.02, 4.36, s * 0.3], [-0.2, 4.7, s * 0.42], 0.05, P.l, 'crystal', { n: 4, f: 0.3 }); });
    });
    return [[0, sy + 0.1, -so + 0.04 * b], [0, sy + 0.1, so - 0.04 * b]];
  },
  voz(K, P, tc) { /* 4.3e: Voz — corista flutuante de simetria radial (o render gira a figura e a faz flutuar): fuso escuro com coração aceso, saia de três lâminas de gelo apontadas para baixo (mais três violeta e frestas acesas na completa), gola sextavada na cor do time (rufo de lascas na completa), cabeça de cristal sem rosto com faixa acesa e coroa na cor do time, auréola inclinada que gira, anel de canto aceso que sobe e desce pelo corpo, três mãos de cristal em órbita e pêndulo aceso que sobe e desce embaixo */
    const Q = U.quorith;
    K.anim({ t: 'bob', amp: 0.09, speed: 2.8 }, () => { Q._bip(K, [0, 0.04, 0], [0, 0.8, 0], 0.15, P.c, null, { e: 2.3, n: 6, f: 0.55 }); K.fine(() => ringOf(3, 0.24, (dx, dz) => K.oct(dx, 0.45, dz, 0.045, 0.26, P.l, null, { e: 2.2 }))); });
    /* corpo: fuso escuro, coração aceso e saia de lâminas */
    Q._bip(K, [0, 0.86, 0], [0, 3.15, 0], 0.32, P.d, 'gloss', { n: 6, st: [[0, 0], [0.72, 1], [1, 0.78]] });
    K.oct(0, 2.0, 0, 0.2, 0.74, P.c, null, { e: 2.4 });
    ringOf(3, 1, (dx, dz) => Q._bip(K, [dx * 0.1, 0.78, dz * 0.1], [dx * 0.44, 2.95, dz * 0.44], 0.3, P.a, 'crystal', { n: 4, sq: 0.3, up: [dx, 0, dz], st: [[0, 0], [0.76, 1], [1, 0.5]] }));
    K.fine(() => { ringOf(3, 1, (dx, dz, a) => { const c = Math.cos(a + PI / 3), s = Math.sin(a + PI / 3);
      Q._bip(K, [c * 0.08, 1.0, s * 0.08], [c * 0.4, 2.9, s * 0.4], 0.22, P.t, 'crystal', { n: 4, sq: 0.3, up: [c, 0, s], st: [[0, 0], [0.72, 1], [1, 0.5]] });
      Q._bip(K, [c * 0.1, 1.25, s * 0.1], [c * 0.4, 2.75, s * 0.4], 0.055, P.c, null, { e: 2.3, n: 4, st: [[0, 0], [0.7, 1], [1, 0.4]] });
      Q._glo(K, [dx * 0.17, 1.1, dz * 0.17], [dx * 0.52, 2.85, dz * 0.52], 0.022, P.l, 1.8); Q._dot(K, dx * 0.46, 2.92, dz * 0.46, 0.05, P.l, 2.4);
      Q._bip(K, [dx * 0.16, 1.05, dz * 0.16], [dx * 0.3, 0.55, dz * 0.3], 0.07, P.b, 'crystal', { n: 4, f: 0.35 }); Q._bip(K, [dx * 0.2, 1.3, dz * 0.2], [dx * 0.54, 2.85, dz * 0.54], 0.05, P.l, 'crystal', { n: 4, st: [[0, 0], [0.15, 1], [0.9, 1], [1, 0]] }); }); });
    /* anel de canto aceso que sobe e desce pelo corpo (o pulso da Voz) */
    K.anim({ t: 'bob', p: [0, 2.2, 0], amp: 0.5, speed: 2.6 }, () => { K.tor(0, 2.2, 0, 0.52, 0.035, P.c, null, { e: 2.2, ts: 6, rs: 3 }); K.fine(() => ringOf(6, 0.52, (dx, dz, a, i) => K.oct(dx, 2.12 + (i % 2) * 0.06, dz, 0.035, 0.18, P.l, null, { e: 2.2 }))); });
    /* gola na cor do time (borda escura, rufo de lascas e luzes na completa) e pescoço aceso */
    Q._pr(K, 0, 3.0, 0, 0.64, 0.26, tc, 'crystal', { top: 0.56 });
    K.oct(0, 3.22, 0, 0.11, 0.32, P.c, null, { e: 2.6 });
    K.fine(() => { Q._pr(K, 0, 3.26, 0, 0.4, 0.12, tc, 'crystal', { top: 0.7, tw: PI / 6 }); for (const y of [1.55, 2.62]) Q._pr(K, 0, y, 0, y > 2 ? 0.33 : 0.27, 0.08, P.t, 'crystal'); ringOf(3, 0.5, (dx, dz) => Q._bip(K, [dx * 0.06, 0.95, dz * 0.06], [dx * 0.45, 0.5, dz * 0.45], 0.04, P.l, 'crystal', { n: 4, st: [[0, 1], [1, 1]] }));
      ringOf(3, 1, (dx, dz) => { for (const f of [0.45, 0.7]) Q._bip(K, [dx * (0.1 + 0.34 * f), 0.78 + 2.17 * f, dz * (0.1 + 0.34 * f)], [dx * (0.3 + 0.34 * f), 0.98 + 2.17 * f, dz * (0.3 + 0.34 * f)], 0.06, P.l, 'crystal', { n: 4, f: 0.3 }); });
      Q._pr(K, 0, 2.94, 0, 0.68, 0.07, P.d, 'gloss'); ringOf(6, 0.46, (dx, dz, a, i) => { Q._bip(K, [dx, 3.1, dz], [dx * 1.5, 3.42 + (i % 2) * 0.12, dz * 1.5], 0.07, i % 2 ? tc : P.l, 'crystal', { n: 4, f: 0.3, sq: 0.5 }); const b = a + PI / 6; Q._dot(K, Math.cos(b) * 0.5, 3.06, Math.sin(b) * 0.5, 0.04, P.c, 2.4); }); });
    /* cabeça flutuante com faixa acesa e coroa de três lascas na cor do time */
    K.anim({ t: 'bob', amp: 0.05, speed: 2.2, ph: 1 }, () => { Q._bip(K, [0, 3.42, 0], [0, 4.46, 0], 0.32, P.l, 'crystal', { n: 6, f: 0.4 }); Q._pr(K, 0, 3.81, 0, 0.335, 0.06, P.c, null, { e: 2.4 });
      ringOf(3, 0.2, (dx, dz) => Q._bip(K, [dx, 4.2, dz], [dx * 2.1, 4.72, dz * 2.1], 0.07, tc, 'crystal', { n: 4, f: 0.3 }));
      K.fine(() => { ringOf(3, 0.28, (dx, dz, a) => { const c = Math.cos(a + PI / 3), s = Math.sin(a + PI / 3); K.oct(c * 0.28, 3.98, s * 0.28, 0.04, 0.16, P.c, null, { e: 2.2 }); Q._bip(K, [c * 0.28, 3.9, s * 0.28], [c * 0.48, 4.25, s * 0.48], 0.045, P.l, 'crystal', { n: 4, f: 0.3 }); }); Q._pr(K, 0, 4.16, 0, 0.2, 0.06, P.t, 'crystal'); }); });
    K.anim({ t: 'spin', p: [0, 4.6, 0], speed: 1.3 }, () => { K.tor(0, 4.6, 0, 0.5, 0.04, P.c, null, { e: 2.2, ts: 6, rs: 3, rx: 0.3 }); K.fine(() => { ringOf(3, 0.5, (dx, dz) => K.oct(dx, 4.51 - dz * Math.sin(0.3), dz * Math.cos(0.3), 0.055, 0.18, P.l, null, { e: 2.4 })); /* sobre o anel inclinado (rx: y = -z·sen) */ ringOf(3, 0.2, (dx, dz, a) => { const c = Math.cos(a + PI / 3), s = Math.sin(a + PI / 3); K.oct(c * 0.2, 4.5, s * 0.2, 0.05, 0.2, P.l, 'crystal'); }); ringOf(3, 0.62, (dx, dz) => K.oct(dx, 4.2 + dz * 0.3, dz, 0.04, 0.16, P.c, null, { e: 2.4 })); }); });
    /* mãos de cristal em órbita (três, a 120°): lasca de gelo com ponta acesa (lascas violeta por dentro na completa) */
    K.anim({ t: 'spin', p: [0, 2.5, 0], speed: -1.1 }, () => ringOf(3, 1.0, (dx, dz) => { const c = dx, s = dz;
      Q._bip(K, [dx, 1.8, dz], [dx + c * 0.16, 3.05, dz + s * 0.16], 0.16, P.l, 'crystal', { n: 4, f: 0.3, sq: 0.6, up: [c, 0, s] });
      Q._dot(K, dx - c * 0.02, 1.7, dz - s * 0.02, 0.08, P.c, 2.6);
      K.fine(() => { for (const k of [-1, 1]) Q._bip(K, [c * 0.8 - s * k * 0.12, 2.05, s * 0.8 + c * k * 0.12], [c * 0.84 - s * k * 0.16, 2.75, s * 0.84 + c * k * 0.16], 0.06, P.t, 'crystal', { n: 4, f: 0.4 }); Q._dot(K, c * 1.12, 2.98, s * 1.12, 0.045, P.l, 2.4); Q._bip(K, [dx + c * 0.02, 2.15, dz + s * 0.02], [dx + c * 0.04, 2.3, dz + s * 0.04], 0.1, P.t, 'crystal', { n: 6, st: [[0, 1], [1, 1]] }); K.oct(dx + c * 0.06, 2.5, dz + s * 0.06, 0.05, 0.2, P.c, null, { e: 2.2 }); }); }));
  },
  agulha(K, P, tc) { /* 4.3e: Agulheiro — soldado de cristal mais robusto (_soldado) com lançador de agulhas apontado para o céu nas duas mãos (tubo escuro, anéis acesos, agulha de cristal; recua com os antebraços) e aljava de cinco agulhas em leque nas costas (pontas acesas, berço escuro com tampa na cor do time) */
    const Q = U.quorith, b = 1.1, al = 0.62, ca = Math.cos(al), sa = Math.sin(al), zr = 0.36;
    const sh = Q._soldado(K, P, tc, { stride: 10, bulk: b });
    const L = (t, dz) => [0.0 + ca * t, 2.9 + sa * t, zr + (dz || 0)]; /* ponto ao longo do lançador (t a partir da culatra) */
    Q._bip(K, sh[1], [-0.12, 2.98, 0.72], 0.17, P.t, 'crystal', { n: 5, st: [[0, 0.85], [0.3, 1], [1, 0.62]] });
    Q._bip(K, sh[0], [0.12, 3.02, -0.66], 0.17, P.t, 'crystal', { n: 5, st: [[0, 0.85], [0.3, 1], [1, 0.62]] });
    K.anim({ t: 'recoil', dist: 0.22 }, () => {
      Q._bip(K, [-0.12, 2.98, 0.72], L(0.25, 0.12), 0.15, P.a, 'crystal', { n: 5, st: [[0, 0.75], [0.35, 1], [1, 0.62]] });
      Q._bip(K, [0.12, 3.02, -0.66], L(0.72, -0.18), 0.15, P.a, 'crystal', { n: 5, st: [[0, 0.75], [0.35, 1], [1, 0.62]] });
      for (const [t, dz] of [[0.25, 0.1], [0.72, -0.18]]) { const p = L(t, dz); K.oct(p[0], p[1] - 0.18, p[2], 0.13, 0.34, P.d, 'gloss'); }
      Q._bip(K, L(-0.45), L(0.92), 0.2, P.d, 'gloss', { n: 6, st: [[0, 0.8], [0.12, 1], [0.9, 1], [1, 0.85]] });
      Q._bip(K, L(0.62), L(0.72), 0.245, P.c, null, { e: 2, n: 6, st: [[0, 1], [1, 1]] });
      Q._bip(K, L(0.92), L(1.66), 0.13, P.l, 'crystal', { n: 4, st: [[0, 1], [0.15, 1], [1, 0]] });
      Q._dot(K, ...L(1.7), 0.08, P.c, 2.8);
      K.fine(() => { Q._bip(K, L(0.05), L(0.15), 0.245, P.c, null, { e: 2, n: 6, st: [[0, 1], [1, 1]] }); Q._bip(K, L(0.3, 0), [L(0.3)[0] - 0.12, L(0.3)[1] - 0.42, zr], 0.08, tc, 'crystal', { n: 4, f: 0.4, sq: 0.6 });
        for (const t of [0.35, 0.5]) Q._bip(K, L(t), L(t + 0.05), 0.225, P.t, 'crystal', { n: 6, st: [[0, 1], [1, 1]] }); for (const k of [-1, 1]) Q._bip(K, L(0.75, k * 0.13), L(1.15, k * 0.17), 0.04, P.a, 'crystal', { n: 4, f: 0.3 }); const m0 = L(0.2), m1 = L(0.62); Q._bip(K, [m0[0] - 0.1, m0[1] + 0.2, zr], [m1[0] - 0.12, m1[1] + 0.22, zr], 0.06, P.l, 'crystal', { n: 4, st: [[0, 0.6], [0.3, 1], [1, 0.5]] }); });
    });
    /* aljava: berço escuro com tampa na cor do time e cinco agulhas em leque (pontas acesas; as duas de fora só na completa) */
    Q._pr(K, -0.4, 2.62, 0, 0.34, 0.92, P.d, 'gloss', { top: 0.92, sx: 0.66 });
    Q._pr(K, -0.4, 3.5, 0, 0.32, 0.18, tc, 'crystal', { top: 0.72, sx: 0.66 });
    const agu = k => { const ak = Math.abs(k), A = [-0.42 - ak * 0.02, 3.45, k * 0.12], B = [-0.66 - ak * 0.08, 5.4 - ak * 0.28, k * 0.29], M = A.map((v, j) => v + (B[j] - v) * 0.72);
      Q._bip(K, A, M, 0.08, ak % 2 ? P.a : P.l, 'crystal', { n: 4, st: [[0, 1], [1, 1]] }); Q._bip(K, M, B, 0.08, P.c, null, { e: 2.3, n: 4, st: [[0, 1], [1, 0]] }); };
    for (const k of [-1, 0, 1]) agu(k); K.fine(() => { agu(-2); agu(2); });
    K.fine(() => { for (const s of [-1, 1]) { Q._glo(K, [-0.62, 2.75, s * 0.2], [-0.62, 3.4, s * 0.22], 0.03, P.c, 2); Q._bip(K, [-0.3, 2.7, s * 0.34], [-0.55, 3.45, s * 0.36], 0.09, P.t, 'crystal', { n: 4, f: 0.5, sq: 0.5 }); } Q._bip(K, [-0.68, 2.7, 0], [-0.7, 3.3, 0], 0.07, P.t, 'crystal', { n: 4, f: 0.5 }); });
  },
  catedral(K, P, tc) { /* 4.3e: Catedral Errante — catedral gótica de cristal sobre casco flutuante em cruz (proa em ponta na frente), andando em seis pilares de cristal que marcham em tripé (leg); telhados na cor do time, vitrais acesos entre contrafortes com arcobotantes, rosáceas no transepto e na fachada, duas torres com campanário aberto (sinos que balançam) e agulhas, torre do cruzeiro com a flecha mais alta, cristal flutuante e auréola de lascas que gira, abside com órgão de tubos acesos (o coro), estandartes de luz na cor do time e quilha de cristal pendurada sob o casco */
    const Q = U.quorith, yb = 10.1, yw = 7.0, yt = yb + yw, xc = -1.6, xa = -9.2, xt = 6.0;
    /* lanceta (janela gótica): painel aceso em arco quebrado com moldura violeta atrás; ry = direção da normal da parede */
    const lanc = (x, y, z, w, h, ry, k, fr) => { const pts = [[-w / 2, 0], [w / 2, 0], [w / 2, h * 0.68], [0, h], [-w / 2, h * 0.68]];
      if (fr !== false && !K.lite) K.poly(pts.map(([a, b]) => [a * 1.32, b * 1.08 - h * 0.04]), 0.12, P.t, 'crystal', { x, y, z, ry, flat: true });
      K.poly(pts, 0.06, P.c, null, { x: x + Math.sin(ry) * 0.05, y, z: z + Math.cos(ry) * 0.05, ry, e: k || 1.7, flat: true }); };
    const pin = (x, y, z, r, h, col) => { Q._pr(K, x, y, z, r, h * 0.35, P.t, 'crystal'); Q._bip(K, [x, y + h * 0.35, z], [x, y + h, z], r * 1.05, col || P.l, 'crystal', { n: 4, st: [[0, 1], [1, 0]] }); };
    const qn = (nx, nz) => new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), new T.Vector3(nx, 0, nz));
    /* rosácea: vidro aceso, aro violeta, raios de cristal e núcleo na cor do time; (nx, nz) = normal da parede */
    const rosa = (x, y, z, R, nx, nz) => { const tx = nz, tz = -nx, n = K.lite ? 6 : 16, at = (c, s, k, o) => [x + nx * o + tx * c * R * k, y + s * R * k, z + nz * o + tz * c * R * k];
      K.cyl(x, y, z, R, R, 0.1, P.c, null, { e: 1.5, q: qn(nx, nz), seg: K.lite ? 8 : 12, facet: true });
      K.tor(x + nx * 0.08, y, z + nz * 0.08, R, 0.16, P.t, 'crystal', { ts: 12, rs: 4, q: qn(nx, nz) });
      for (let i = 0; i < n; i++) { const a = i / n * PI * 2; Q._bip(K, at(Math.cos(a), Math.sin(a), 0.22, 0.12), at(Math.cos(a), Math.sin(a), 0.96, 0.12), 0.07, P.l, 'crystal', { n: 4, st: [[0, 1], [1, 1]] }); }
      Q._bip(K, [x, y, z], [x + nx * 0.5, y, z + nz * 0.5], R * 0.24, tc, 'crystal', { n: 6, st: [[0, 1], [0.6, 1], [1, 0.4]] });
      K.fine(() => { K.tor(x + nx * 0.1, y, z + nz * 0.1, R * 0.55, 0.06, P.l, 'crystal', { ts: 12, rs: 4, q: qn(nx, nz) }); for (let i = 0; i < 12; i++) { const a = (i + 0.5) / 12 * PI * 2; Q._dot(K, ...at(Math.cos(a), Math.sin(a), 0.78, 0.12), 0.09, P.l, 2.4); } }); };

    /* 1. pilares que andam: seis colunas de cristal em tripé, encaixe escuro com anel de levitação aceso, faixas e pé em ponta; poça de luz fixa no chão */
    for (const [x, s] of [[xt, 1], [xc, 1], [-8.9, 1], [xt, -1], [xc, -1], [-8.9, -1]]) { const z = s * 5.2, ph = ((x !== xc) === (s > 0)) ? 0 : PI;
      K.anim(legSpec([x, 7.9, z], { amp: 0.2, stride: 14, ph }), () => {
        Q._pr(K, x, 6.5, z, 1.42, 0.9, P.d, 'gloss', { top: 0.84 }); if (K.lite) Q._pr(K, x, 7.55, z, 1.3, 0.14, P.c, null, { e: 2.2, tw: PI / 6 }); else K.tor(x, 7.66, z, 1.22, 0.1, P.c, null, { e: 2.2, ts: 6, rs: 3 });
        Q._pr(K, x, 1.9, z, 0.84, 4.6, P.a, 'crystal', { top: 1.36, tw: PI / 6 });
        Q._pr(K, x, 4.9, z, 1.12, 0.34, P.t, 'crystal', { tw: PI / 6 }); Q._pr(K, x, 3.2, z, 1.0, 0.22, P.c, null, { e: 2, tw: PI / 6 });
        Q._bip(K, [x, 1.95, z], [x, 0.0, z], 0.9, P.b, 'crystal', { n: 6, tw: PI / 6, st: [[0, 1], [0.25, 1.08], [1, 0]] });
        K.fine(() => { ringOf(3, 0.8, (dx, dz) => { Q._bip(K, [x + dx, 1.4, z + dz], [x + dx * 2.0, 0.08, z + dz * 2.0], 0.24, P.t, 'crystal', { n: 4, f: 0.3 }); Q._glo(K, [x + dx * 1.16, 2.2, z + dz * 1.16], [x + dx * 1.42, 6.3, z + dz * 1.42], 0.06, P.c, 1.8); });
          ringOf(6, 1.25, (dx, dz, a, i) => K.oct(x + dx, 7.05, z + dz, 0.18, 0.56, i % 2 ? P.l : P.b, 'crystal')); Q._pr(K, x, 5.95, z, 1.1, 0.12, P.t, 'crystal', { tw: PI / 6 }); });
      });
      Q._pr(K, x, 0, z, 2.0, 0.03, P.c, null, { e: 0.55 }); }

    /* 2. casco flutuante em cruz com proa em ponta: dois degraus escuros, costura acesa e borda de gelo; quilha de cristal pendurada no cruzeiro (sobe e desce) */
    const OUT = [[10.6, 0], [7.9, 6.1], [1.4, 6.1], [1.4, 8.2], [-1.6, 9.8], [-4.6, 8.2], [-4.6, 6.1], [-9.6, 6.1], [-12.5, 3.4], [-13.1, 0]]; const OL = OUT.concat(OUT.slice(1, -1).reverse().map(([x, z]) => [x, -z]));
    const hull = (y, h, k, col, mat, o) => K.poly(OL.map(([x, z]) => [x * k, z * k]), h, col, mat, Object.assign({ x: -0.6 * (k - 1), y: y + h / 2, z: 0, rx: -H, flat: true }, o));
    hull(8.0, 0.9, 0.9, P.d, 'gloss'); hull(8.9, 0.85, 1, P.d, 'gloss', { b: K.lite ? 0 : 0.12 }); hull(9.75, 0.1, 1.012, P.c, null, { e: 1.6 }); hull(9.85, 0.25, 1.006, P.a, 'crystal');
    K.poly([[10.0, 0], [7.6, 1.0], [7.6, -1.0]], 0.05, P.c, null, { y: 10.13, rx: -H, e: 1.4, flat: true });
    K.anim({ t: 'bob', amp: 0.25, speed: 1.1 }, () => { Q._bip(K, [xc, 8.4, 0], [xc, 3.4, 0], 1.7, P.t, 'crystal', { n: 6, st: [[0, 1], [0.3, 0.86], [1, 0]] }); Q._bip(K, [xc, 7.8, 0], [xc, 4.7, 0], 1.0, P.c, null, { e: 2, n: 6, tw: PI / 6, st: [[0, 1], [1, 0]] }); K.fine(() => ringOf(6, 1.55, (dx, dz) => Q._bip(K, [xc + dx, 7.6, dz], [xc + dx * 1.3, 5.6, dz * 1.3], 0.22, P.b, 'crystal', { n: 4, f: 0.3 }))); });
    K.fine(() => { for (const [x, z, h] of [[3.0, 2.6, 2.6], [3.0, -2.6, 2.2], [-5.4, 2.4, 2.4], [-5.4, -2.4, 2.8], [8.6, 0, 2.0], [-11.4, 0, 2.2], [xc, 7.4, 2.0], [xc, -7.4, 2.0], [-11.0, 2.6, 1.6], [-11.0, -2.6, 1.6]]) Q._bip(K, [x, 8.05, z], [x, 8.05 - h, z], 0.5, P.b, 'crystal', { n: 4, st: [[0, 1], [1, 0]] });
      for (let i = 0; i < 6; i++) for (const s of [-1, 1]) Q._pino(K, P, i < 3 ? -9.0 + i * 1.6 : 1.9 + (i - 3) * 1.6, 10.1, s * 5.75, 0.17, i % 2 ? P.t : P.b);
      for (const s of [-1, 1]) pin(8.4, yb, s * 3.1, 0.3, 2.6); });

    /* 3. nave: paredes altas de gelo com clerestório aceso, naves laterais baixas (meia-água na cor do time, vitrais), contrafortes violeta com pináculos e arcobotantes por cima das naves laterais */
    K.box(-2.2, yb, 0, 14.4, yw, 8.0, P.a, 'crystal'); const ya = 3.3;
    for (const s of [-1, 1]) {
      for (const [x0, x1] of [[0.7, 4.5], [-9.4, -3.9]]) { K.box((x0 + x1) / 2, yb, s * 4.75, x1 - x0, ya, 1.5, P.a, 'crystal'); K.poly([[-s * 5.62, 0], [-s * 3.96, 0], [-s * 3.96, 1.15]], x1 - x0, tc, 'crystal', { x: (x0 + x1) / 2, y: yb + ya, z: 0, ry: H, flat: true }); }
      for (const x of [1.8, 3.6, -5.3, -7.5]) { lanc(x, yb + ya + 1.25, s * 4.03, 1.05, 2.3, s > 0 ? 0 : PI, 1.9); lanc(x, yb + 0.45, s * 5.53, 0.95, 2.3, s > 0 ? 0 : PI, 1.6); K.fine(() => { for (const [y, h, zz] of [[yb + ya + 1.25, 2.2, 4.12], [yb + 0.45, 2.2, 5.62]]) Q._bip(K, [x, y, s * zz], [x, y + h * 0.8, s * zz], 0.06, P.t, 'crystal', { n: 4, st: [[0, 1], [1, 1]] }); }); }
      for (const x of [2.7, -4.4, -6.4, -8.6]) { Q._pr(K, x, yb + ya, s * 4.22, 0.4, yw - ya + 0.5, P.t, 'crystal', { n: 4, tw: PI / 4 }); pin(x, yt + 0.5, s * 4.22, 0.3, 1.8);
        Q._pr(K, x, yb, s * 5.62, 0.55, ya + 1.2, P.b, 'crystal', { n: 4, tw: PI / 4, top: 0.8 }); pin(x, yb + ya + 1.2, s * 5.62, 0.4, 2.2, P.l);
        Q._bip(K, [x, yb + ya + 0.9, s * 5.45], [x, yt - 0.35, s * 4.4], 0.22, P.t, 'crystal', { n: 4, st: [[0, 1], [1, 1]] }); K.fine(() => Q._bip(K, [x, yb + ya + 0.2, s * 5.45], [x, yb + ya + 2.0, s * 4.4], 0.15, P.b, 'crystal', { n: 4, st: [[0, 1], [1, 1]] })); }
      K.fine(() => { for (const [x0, x1] of [[-9.4, -3.9], [0.7, 4.5]]) { Q._glo(K, [x0, yt - 0.25, s * 4.06], [x1, yt - 0.25, s * 4.06], 0.06, P.c, 1.6); Q._glo(K, [x0, yb + ya - 0.2, s * 5.56], [x1, yb + ya - 0.2, s * 5.56], 0.05, P.c, 1.4); } });
    }
    /* telhado da nave na cor do time (losango ao longo de x), cumeeira com cristais e nervuras */
    Q._bip(K, [-9.3, yt, 0], [5.9, yt, 0], 4.35, tc, 'crystal', { n: 4, sq: 0.88, st: [[0, 1], [1, 1]] });
    K.fine(() => { for (const x of [-8.6, -7.0, -5.4, 1.6, 3.2, 4.6]) K.oct(x, yt + 3.65, 0, 0.18, 0.75, P.l, 'crystal'); for (let x = -8.9; x < 5.4; x += 0.55) if (Math.abs(x - xc) > 2.4) K.oct(x, yt + 3.72, 0, 0.07, 0.32, P.c, null, { e: 2 }); for (const z of [-6.6, -5.0, -3.4, 3.4, 5.0, 6.6]) K.oct(xc, yt + 3.65, z, 0.16, 0.65, P.l, 'crystal');
      for (const x of [2.7, -4.4, -6.4, -8.6]) for (const s of [-1, 1]) Q._bip(K, [x, yt + 3.75, s * 0.1], [x, yt + 0.1, s * 4.2], 0.08, P.t, 'crystal', { n: 4, st: [[0, 1], [1, 1]] }); });

    /* 4. transepto: braços com rosácea e portal aceso em cada ponta, contrafortes com pináculos, telhado na cor do time */
    K.box(xc, yb, 0, 4.6, yw, 16.2, P.a, 'crystal');
    Q._bip(K, [xc, yt, -8.02], [xc, yt, 8.02], 2.75, tc, 'crystal', { n: 4, sq: 1.38, st: [[0, 1], [1, 1]], up: [0, 1, 0] });
    for (const s of [-1, 1]) { rosa(xc, yb + 4.2, s * 8.12, 1.75, 0, s); lanc(xc, yb + 0.2, s * 8.13, 1.2, 1.9, s > 0 ? 0 : PI, 2); for (const x of [xc - 2.3, xc + 2.3]) { Q._pr(K, x, yb, s * 8.2, 0.45, yw + 0.4, P.t, 'crystal', { n: 4, tw: PI / 4 }); pin(x, yt + 0.4, s * 8.2, 0.34, 2.2); } }

    /* 5. fachada (frente, +x): duas torres com campanário aberto (sino que balança), agulhas e estandartes de luz; empena com rosácea e portal aceso */
    for (const s of [-1, 1]) { const z = s * 3.9;
      K.box(xt, yb, z, 3.0, 10.4, 3.0, P.a, 'crystal'); Q._pr(K, xt, yb + 10.4, z, 2.26, 0.35, tc, 'crystal', { n: 4, tw: PI / 4 }); Q._pr(K, xt, yb + 14.37, z, 1.9, 0.3, tc, 'crystal', { n: 4, tw: PI / 4, top: 0.85 });
      for (const [dx, dz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) Q._pr(K, xt + dx * 1.05, yb + 10.75, z + dz * 1.05, 0.34, 3.0, P.b, 'crystal', { n: 4, tw: PI / 4 });
      Q._pr(K, xt, yb + 13.75, z, 2.0, 0.32, P.t, 'crystal', { n: 4, tw: PI / 4 }); Q._pr(K, xt, yb + 10.75, z, 1.25, 0.14, P.c, null, { n: 4, tw: PI / 4, e: 1.8 });
      K.anim({ t: 'sway', p: [xt, yb + 13.7, z], amp: 0.13, speed: 1.7, ph: s * 1.3 }, () => { Q._bip(K, [xt, yb + 13.65, z], [xt, yb + 11.6, z], 0.95, P.l, 'crystal', { n: K.lite ? 8 : 12, st: [[0, 0.32], [0.25, 0.55], [0.75, 0.82], [1, 1]] }); K.oct(xt, yb + 11.05, z, 0.24, 0.6, P.c, null, { e: 2.6 }); });
      Q._bip(K, [xt, yb + 14.05, z], [xt, yb + 21.6, z], 1.75, P.a, 'crystal', { n: 4, tw: PI / 4, st: [[0, 1], [0.08, 1], [1, 0]] });
      K.fine(() => { for (const [dx, dz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) pin(xt + dx * 1.3, yb + 14.37, z + dz * 1.3, 0.22, 2.2); Q._pr(K, xt, yb + 16.6, z, 0.8, 0.22, P.c, null, { n: 4, tw: PI / 4, e: 2 }); Q._dot(K, xt, yb + 21.8, z, 0.18, P.c, 2.6);
        for (const y of [yb + 2.0, yb + 6.2]) { lanc(xt + 1.52, y, z, 0.9, 2.8, PI / 2, 1.5); lanc(xt, y, z + s * 1.52, 0.9, 2.8, s > 0 ? 0 : PI, 1.5); } });
      K.anim({ t: 'sway', p: [xt + 1.62, yb + 9.8, z], amp: 0.06, speed: 1.2, ph: s }, () => { K.box(xt + 1.62, yb + 3.6, z, 0.1, 6.2, 1.15, tc, null, { e: 1.5 }); K.fine(() => K.cone(xt + 1.62, yb + 3.6, z, 0.58, 0.7, tc, null, { e: 1.5, seg: 4, rx: PI, sx: 0.17 })); });
    }
    K.box(xt + 0.5, yb, 0, 1.4, 9.6, 4.8, P.a, 'crystal'); K.poly([[-2.4, 0], [2.4, 0], [0, 3.3]], 1.4, P.b, 'crystal', { x: xt + 0.5, y: yb + 9.6, z: 0, ry: PI / 2, flat: true });
    rosa(xt + 1.23, yb + 6.4, 0, 1.6, 1, 0); lanc(xt + 1.25, yb, 0, 1.9, 3.6, PI / 2, 2.2);
    K.fine(() => { pin(xt + 0.5, yb + 12.9, 0, 0.3, 2.4); Q._dot(K, xt + 1.3, yb + 9.0, 0, 0.14, P.l, 2.4);
      for (let i = 0; i < 6; i++) { const z = -1.9 + i * 0.76; if (Math.abs(z) < 0.5) continue; Q._bip(K, [xt + 1.28, yb + 3.9, z], [xt + 1.28, yb + 5.0, z], 0.16, P.l, 'crystal', { n: 4, f: 0.35 }); Q._pr(K, xt + 1.28, yb + 3.75, z, 0.2, 0.15, P.t, 'crystal', { n: 4 }); }
      for (let k = 0; k < 3; k++) K.poly([[8.7 - k * 0.35, 0], [7.25, 1.9 - k * 0.3], [7.25, -1.9 + k * 0.3]], 0.15, k % 2 ? P.a : P.b, 'crystal', { y: 10.18 + k * 0.15, rx: -H, flat: true });
      for (const [x, z] of [[7.95, 1.55], [7.95, -1.55], [8.65, 1.0], [8.65, -1.0]]) { Q._bip(K, [x, yb + 0.1, z], [x, yb + 0.95, z], 0.13, P.l, 'crystal', { n: 4, f: 0.45 }); K.oct(x, yb + 1.0, z, 0.08, 0.24, P.c, null, { e: 2.4 }); } });
    /* anéis de lascas que giram em volta das agulhas das torres (o canto das torres) */
    for (const s of [-1, 1]) K.anim({ t: 'spin', p: [xt, yb + 17.4, s * 3.9], speed: s * 0.9 }, () => { K.tor(xt, yb + 17.4, s * 3.9, 1.7, 0.05, P.c, null, { e: 2, ts: 8, rs: 3, rx: 0.12 * s }); ringOf(K.q(4), 1.7, (dx, dz, a, i) => K.oct(xt + dx, yb + 17.15 - dz * Math.sin(0.12 * s), s * 3.9 + dz * Math.cos(0.12), 0.12, 0.5, i % 2 ? P.l : tc, 'crystal')); });
    /* detalhes finos da arquitetura: contrafortes das torres, gabletes sobre o clerestório, parapeitos, gárgulas, nervuras da flecha, lâmpadas sob o casco e vigias acesas no casco */
    K.fine(() => { for (const s of [-1, 1]) { for (const [dx, dz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) { const x = xt + dx * 1.62, z = s * 3.9 + dz * 1.62; if (dx < 0 && dz === -s) continue; Q._pr(K, x, yb, z, 0.42, 6.2, P.t, 'crystal', { n: 4, tw: PI / 4, top: 0.8 }); Q._pr(K, x, yb + 6.2, z, 0.32, 2.6, P.b, 'crystal', { n: 4, tw: PI / 4, top: 0.7 }); pin(x, yb + 8.8, z, 0.24, 1.6); }
        for (const x of [1.8, 3.6, -5.3, -7.5]) K.poly([[-0.72, 0], [0.72, 0], [0, 1.0]], 0.1, P.l, 'crystal', { x, y: yb + ya + 3.5, z: s * 4.1, ry: s > 0 ? 0 : PI, flat: true });
        for (const [x0, x1] of [[-9.3, -3.9], [0.7, 4.5]]) { Q._bip(K, [x0, yt + 0.22, s * 3.92], [x1, yt + 0.22, s * 3.92], 0.08, P.l, 'crystal', { n: 4, st: [[0, 1], [1, 1]] }); for (let x = x0 + 0.5; x < x1; x += 0.9) Q._pr(K, x, yt, s * 3.92, 0.06, 0.24, P.t, 'crystal', { n: 4 }); }
        for (const x of [-9.0, 0.9, 4.3]) Q._bip(K, [x, yt + 0.1, s * 4.3], [x + 0.2, yt - 0.3, s * 5.0], 0.12, P.t, 'crystal', { n: 4, f: 0.3 });
        for (const x of [-8.8, -7.4, -6.0, 2.6, 4.0, 5.4, 6.8]) lanc(x, 9.0, s * 6.25, 0.36, 0.55, s > 0 ? 0 : PI, 1.8, false); }
      ringOf(6, 1, (dx, dz, a) => { const b = a + PI / 6, ca = Math.cos(b), sa = Math.sin(b); Q._bip(K, [xc + ca * 2.2, yt + 7.7, sa * 2.2], [xc + ca * 0.9, yt + 12.6, sa * 0.9], 0.07, P.t, 'crystal', { n: 4, st: [[0, 1], [1, 1]] }); });
      for (const [x, z] of [[3.6, 3.2], [3.6, -3.2], [-4.6, 3.0], [-4.6, -3.0], [-8.6, 0], [xc, 4.9], [xc, -4.9]]) { Q._bip(K, [x, 8.0, z], [x, 6.4, z], 0.06, P.t, 'crystal', { n: 4, st: [[0, 1], [1, 1]] }); Q._bip(K, [x, 6.5, z], [x, 5.7, z], 0.26, P.c, null, { e: 2.2, n: 6, f: 0.5 }); } });
    /* arauto na proa: obelisco de cristal com núcleo aceso e coroa na cor do time (aponta a frente da Catedral) */
    Q._pr(K, 9.3, yb, 0, 0.5, 0.35, P.t, 'crystal'); Q._bip(K, [9.3, yb + 0.3, 0], [9.3, yb + 3.6, 0], 0.42, P.l, 'crystal', { n: 6, st: [[0, 1], [0.7, 1.15], [1, 0]] }); K.oct(9.3, yb + 2.0, 0, 0.2, 0.8, P.c, null, { e: 2.4 });
    ringOf(3, 0.38, (dx, dz) => Q._bip(K, [9.3 + dx, yb + 2.9, dz], [9.3 + dx * 2.2, yb + 3.9, dz * 2.2], 0.09, tc, 'crystal', { n: 4, f: 0.3 }));
    K.fine(() => { for (const s of [-1, 1]) for (const z of [6.25, 7.4]) { const x0 = xc - 2.32, x1 = xc + 2.32; lanc(x0, yb + 1.0, s * z, 0.75, 3.4, -H, 1.7); lanc(x1, yb + 1.0, s * z, 0.75, 3.4, H, 1.7); }
      for (const a of [PI * 0.83, PI * 1.17]) { const ca = Math.cos(a), sa = Math.sin(a), ox = xa + ca * 3.55, oz = sa * 3.55; Q._pr(K, ox, yb, oz, 0.42, 4.4, P.b, 'crystal', { n: 4, tw: a, top: 0.8 }); pin(ox, yb + 4.4, oz, 0.32, 1.8, P.l); Q._bip(K, [ox - ca * 0.2, yb + 4.1, oz - sa * 0.2], [xa + ca * 2.7, yt - 0.9, sa * 2.7], 0.16, P.t, 'crystal', { n: 4, st: [[0, 1], [1, 1]] }); }
      ringOf(6, 2.3, (dx, dz) => Q._pr(K, xc + dx, yt + 2.7, dz, 0.16, 4.5, P.t, 'crystal', { n: 4 }));
      for (const s of [-1, 1]) for (const dx of [-1, 1]) { const x = xt + dx * 0.8; K.poly([[-0.42, 0], [0.42, 0], [0.42, 1.2], [0, 1.8], [-0.42, 1.2]], 0.08, P.l, 'crystal', { x, y: yb + 11.1, z: s * 3.9 + s * 1.12, ry: s > 0 ? 0 : PI, flat: true }); }
      for (let i = 0; i < 28; i++) { const t = i / 28, k = Math.floor(t * (OL.length - 1)), f = t * (OL.length - 1) - k, A = OL[k], B = OL[k + 1] || OL[0]; const x = A[0] + (B[0] - A[0]) * f, z = A[1] + (B[1] - A[1]) * f; K.oct(x * 1.0, 10.1, z * 1.0, 0.13, 0.5, i % 2 ? P.l : P.b, 'crystal'); } });
    /* crochês: lascas de cristal subindo pelas arestas das agulhas (só na completa) */
    K.fine(() => { for (const s of [-1, 1]) for (const [dx, dz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) for (const f of [0.3, 0.5, 0.7]) { const r = 1.75 * (1 - f) / 0.92 * 0.707, x = xt + dx * r, z = s * 3.9 + dz * r, y = yb + 14.05 + 7.55 * f; K.oct(x, y, z, 0.11, 0.42, P.l, 'crystal', { rz: -dx * 0.5, rx: dz * 0.5 }); }
      for (let i = 0; i < 6; i++) { const a = PI / 6 + i * PI / 3, ca = Math.cos(a), sa = Math.sin(a); for (const f of [0.25, 0.45, 0.65]) { const r = 1.85 * (1 - f), x = xc + sa * r, z = ca * r, y = yt + 7.65 + 11.85 * f; K.oct(x, y, z, 0.12, 0.46, P.a, 'crystal', { rz: -sa * 0.5, rx: ca * 0.5 }); } } });

    /* 6. torre do cruzeiro: lanterna sextavada com vitrais, coroa na cor do time, flecha mais alta, cristal flutuante e auréola de lascas que gira */
    Q._pr(K, xc, yt + 2.6, 0, 2.15, 4.6, P.a, 'crystal', { tw: PI / 6 });
    ringOf(6, 1, (dx, dz, a) => { const b = a + PI / 6, ap = 2.15 * 0.866 + 0.02; lanc(xc + Math.cos(b) * ap, yt + 3.2, Math.sin(b) * ap, 0.9, 3.2, Math.atan2(Math.cos(b), Math.sin(b)), 1.8, false); });
    Q._pr(K, xc, yt + 7.2, 0, 2.3, 0.45, tc, 'crystal', { tw: PI / 6 }); Q._pr(K, xc, yt + 2.4, 0, 2.3, 0.3, P.t, 'crystal', { tw: PI / 6 });
    Q._bip(K, [xc, yt + 7.65, 0], [xc, yt + 19.5, 0], 1.85, P.l, 'crystal', { n: 6, tw: PI / 6, st: [[0, 1], [1, 0]] });
    Q._pr(K, xc, yt + 11.0, 0, 1.33, 0.3, P.c, null, { e: 2.2, tw: PI / 6 });
    K.fine(() => { ringOf(6, 2.35, (dx, dz) => pin(xc + dx, yt + 7.65, dz, 0.24, 2.0)); Q._pr(K, xc, yt + 14.6, 0, 0.75, 0.2, P.t, 'crystal', { tw: PI / 6 }); ringOf(6, 1, (dx, dz, a) => { const b = a + PI / 6; Q._glo(K, [xc + Math.cos(b) * 1.72, yt + 7.8, Math.sin(b) * 1.72], [xc + Math.cos(b) * 0.25, yt + 18.2, Math.sin(b) * 0.25], 0.05, P.c, 1.8); }); });
    K.anim({ t: 'bob', amp: 0.4, speed: 1.3 }, () => { Q._bip(K, [xc, yt + 20.4, 0], [xc, yt + 23.2, 0], 0.62, P.c, null, { e: 2.6, n: 6, f: 0.45 }); K.fine(() => ringOf(3, 0.75, (dx, dz) => K.oct(xc + dx, yt + 21.2, dz, 0.12, 0.7, P.l, null, { e: 2.2 }))); });
    K.anim({ t: 'spin', p: [xc, yt + 12.5, 0], speed: 0.55 }, () => { K.tor(xc, yt + 12.5, 0, 4.6, 0.09, P.c, null, { e: 2, ts: K.lite ? 12 : 24, rs: 3, rx: 0.16 }); ringOf(K.q(8), 4.6, (dx, dz, a, i) => K.oct(xc + dx, yt + 11.9 - dz * Math.sin(0.16), dz * Math.cos(0.16), 0.3, 1.2, i % 2 ? P.l : tc, 'crystal')); /* sobre o anel inclinado */
      K.fine(() => ringOf(8, 4.6, (dx, dz, a) => { const b = a + PI / 8; K.oct(xc + Math.cos(b) * 4.6, yt + 12.25 - Math.sin(b) * 4.6 * Math.sin(0.16), Math.sin(b) * 4.6 * Math.cos(0.16), 0.12, 0.5, P.c, null, { e: 2.4 }); })); });

    /* 7. abside (trás, -x): meia coroa sextavada com vitrais altos, telhado na cor do time e o órgão de tubos de cristal acesos (o coro); capelas radiais na completa */
    Q._pr(K, xa, yb, 0, 3.5, yw - 0.6, P.a, 'crystal');
    for (const a of [PI * 2 / 3, PI, PI * 4 / 3]) { const ap = 3.5 * 0.866 + 0.03; lanc(xa + Math.cos(a) * ap, yb + 1.0, Math.sin(a) * ap, 1.1, 4.0, Math.atan2(Math.cos(a), Math.sin(a)), 1.8); }
    Q._bip(K, [xa, yt - 0.6, 0], [xa, yt + 3.0, 0], 3.75, tc, 'crystal', { n: 6, st: [[0, 1], [1, 0.12]] });
    const no = K.q(9); for (let i = 0; i < no; i++) { const a = PI * (0.62 + 0.76 * i / (no - 1)), r = 2.2, h = 3.2 + 2.6 * Math.sin(PI * i / (no - 1)); Q._bip(K, [xa + Math.cos(a) * r, yt + 1.0, Math.sin(a) * r], [xa + Math.cos(a) * r, yt + 1.0 + h, Math.sin(a) * r], 0.26, i % 2 ? P.l : P.c, i % 2 ? 'crystal' : null, { e: i % 2 ? 0 : 2.2, n: 6, st: [[0, 1], [0.86, 1], [1, 0]] }); }
    K.fine(() => { for (const a of [PI * 0.72, PI * 1.28]) { const cx = xa + Math.cos(a) * 4.0, cz = Math.sin(a) * 4.0; Q._pr(K, cx, yb, cz, 1.2, 3.6, P.a, 'crystal'); Q._bip(K, [cx, yb + 3.6, cz], [cx, yb + 6.0, cz], 1.3, tc, 'crystal', { n: 6, st: [[0, 1], [1, 0]] }); lanc(cx + Math.cos(a) * 1.06, yb + 0.6, cz + Math.sin(a) * 1.06, 0.7, 2.2, Math.atan2(Math.cos(a), Math.sin(a)), 1.7, false); }
      for (let i = 0; i < 9; i++) { const a = PI * (0.62 + 0.76 * i / 8); Q._dot(K, xa + Math.cos(a) * 2.2, yt + 0.95, Math.sin(a) * 2.2, 0.12, P.l, 2.4); } });
  },
};
U.vorag = {
  infantaria(K, P, tc) { /* 4.3e — Guerreiro da Prole: soldado-inseto bípede de quitina — pernas digitígradas grossas com garras, tórax em pé e abdômen pendente que respira, élitros na cor do time como mochila, ombreiras com esporões e elmo com crista na cor do time, olhos compostos acesos, mandíbulas, quatro braços (o par de cima segura o lança-espinhos: cano de osso com anéis que recua e boca de ácido acesa) e saco de munição que pulsa nas costas */
    const V = U.vorag, S2 = [-1, 1], GZ = 0.34, GY = 4.15, BN = '#A89478', AX = [-0.989, 0.149];
    /* pernas digitígradas: coxa, canela, tarso e garras; balançam do quadril com lados alternados */
    for (const s of S2) V._pernaB(K, P, s);
    K.fine(() => K.sph(-0.12, 3.05, 0, 1, P.d, 'chitin', { sx: 0.52, sy: 0.42, sz: 0.8, seg: 8 }));
    /* abdômen pendente em gomos (sway no pecíolo: respira e balança ao andar) */
    K.anim({ t: 'sway', p: [-0.42, 3.2, 0], amp: 0.07, speed: 2.4 }, () => {
      V._ov(K, [-0.42, 3.3, 0], [-1.38, 2.32, 0], 0.52, P.b, 'chitin', { seg: 9 }); V._pico(K, P, [-1.36, 2.36, 0], [-1.78, 1.78, 0], 0.15);
      K.fine(() => { V._casca(K, -0.92, 2.88, 0, 0.44, 0.34, 0.52, P.a, 0.8, { seg: 8 }); for (const s of S2) K.light(-1.02, 2.48, s * 0.42, 0.09, P.l, 2.2); }); });
    /* tórax em pé, inclinado para a frente, com plastrão de osso na frente e espiráculos acesos */
    K.sph(0.08, 4.2, 0, 1, P.a, 'chitin', { sx: 0.88, sy: 1.12, sz: 0.9, rz: -0.18, seg: 9 });
    K.sph(0.6, 3.98, 0, 1, BN, 'bone', { sx: 0.42, sy: 0.78, sz: 0.55, rz: -0.18, seg: 8 });
    K.fine(() => { for (const s of S2) { K.light(-0.1, 3.87, s * 0.86, 0.09, P.l, 2.2); K.light(-0.16, 4.3, s * 0.87, 0.08, P.l, 2.2); } });
    /* élitros na cor do time (a mochila): duas cascas coladas às costas, do ombro ao abdômen; no completo, borda escura e espinhos na costura */
    for (const s of S2) { V._casca(K, -0.4, 4.36, s * 0.36, 1.12, 0.46, 0.5, tc, H - 0.15, { seg: 10, ry: s * 0.22 });
      K.fine(() => V._casca(K, -0.4 - AX[0] * 0.07, 4.36 - AX[1] * 0.07, s * 0.36, 1.18, 0.44, 0.56, P.d, H - 0.15, { seg: 7, ry: s * 0.22 })); }
    for (const s of S2) V._pico(K, P, [-0.62, 5.05, s * 0.3], [-1.25, 5.95, s * 0.42], 0.13); K.fine(() => { for (let i = 0; i < 3; i++) V._pico(K, P, [-0.84 + i * 0.02, 4.85 - i * 0.45, 0], [-1.22 + i * 0.02, 5.1 - i * 0.45, 0], 0.07); });
    /* saco de munição sob os élitros: pele acesa e miolo de sangue que pulsa; no completo, duto de carne até a arma */
    K.fine(() => K.sph(-0.92, 3.47, 0, 1, '#8E2234', null, { e: 1, sx: 0.42, sy: 0.45, sz: 0.5, seg: 8 }));
    K.anim({ t: 'bob', amp: 0.05, speed: 3 }, () => K.sph(-0.94, 3.51, 0, 1, '#FF5A5A', null, { e: 1.12, sx: 0.37, sy: 0.4, sz: 0.44, seg: 7 }));
    K.fine(() => K.tube([[-0.75, 3.6, 0.35], [-0.2, 3.47, 0.84], [0.35, 3.7, 0.72], [0.62, 3.97, GZ + 0.08]], 0.07, P.m, 'wet', { ts: 8, rs: 4 }));
    /* ombreiras na cor do time com esporões de osso; no completo, borda escura */
    for (const s of S2) { V._casca(K, -0.02, 5.08, s * 1.0, 0.66, 0.34, 0.74, tc, -0.12, { seg: 9, rx: s * 0.8 });
      V._casca(K, 0.02, 4.78, s * 1.12, 0.5, 0.26, 0.5, P.b, -0.12, { seg: 7, rx: s * 1.15 });
      K.fine(() => V._casca(K, -0.02, 5.03, s * 0.96, 0.7, 0.32, 0.8, P.d, -0.12, { seg: 7, rx: s * 0.8 }));
      V._pico(K, P, [-0.2, 5.3, s * 1.22], [-0.78, 6.05, s * 1.62], 0.15); K.fine(() => V._pico(K, P, [0.2, 5.38, s * 1.25], [0.12, 5.95, s * 1.66], 0.1)); }
    /* pescoço e cabeça: elmo na cor do time com crista de osso, olhos compostos acesos, mandíbulas que mastigam */
    K.seg([0.32, 5.0, 0], [0.86, 5.66, 0], 0.33, P.d, 'chitin', { seg: 6 });
    K.sph(1.08, 5.8, 0, 1, P.a, 'chitin', { sx: 0.8, sy: 0.52, sz: 0.58, rz: -0.22, seg: 9 });
    V._casca(K, 1.02, 5.9, 0, 0.84, 0.44, 0.5, tc, -0.25, { seg: 9 });
    V._pico(K, P, [0.74, 6.38, 0], [0.0, 7.05, 0], 0.19); K.fine(() => { for (const s of S2) V._pico(K, P, [0.64, 6.28, s * 0.3], [0.12, 6.72, s * 0.48], 0.1); });
    for (const s of S2) { K.oct(1.5, 5.68, s * 0.48, 0.19, 0.36, P.l, null, { e: 1.9, ry: PI / 4 }); K.fine(() => K.oct(1.5, 6.14, s * 0.17, 0.07, 0.13, P.l, null, { e: 2 }));
      K.anim({ t: 'sway', p: [1.38, 5.5, s * 0.24], amp: 0.16, speed: 5, ph: s > 0 ? 0 : PI }, () => { const m = [1.68, 5.43, s * 0.38]; if (K.lite) V._pico(K, P, [1.38, 5.5, s * 0.24], [1.92, 5.39, s * 0.1], 0.1, { n: 3 }); else { K.seg([1.38, 5.5, s * 0.24], m, 0.09, P.bo, 'bone', { seg: 5 }); V._pico(K, P, m, [1.98, 5.36, s * 0.08], 0.09, { n: 3 }); } }); }
    K.fine(() => { for (const s of S2) K.anim({ t: 'sway', p: [1.28, 6.12, s * 0.17], amp: 0.18, speed: 3.5, ph: s > 0 ? 0 : 1.3 }, () => { V._pico(K, P, [1.28, 6.12, s * 0.17], [1.7, 6.82, s * 0.4], 0.05, { n: 3, col: P.d, c0: '#FFFFFF' }); V._pico(K, P, [1.68, 6.8, s * 0.39], [2.22, 6.95, s * 0.62], 0.04, { n: 3, col: P.d, c0: '#FFFFFF' }); }); });
    /* lança-espinhos: corpo de órgão, cano de osso com anéis, boca de carne e brilho de ácido (o cano recua no disparo) */
    if (K.lite) K.seg([0.22, GY - 0.02, GZ], [1.38, GY + 0.05, GZ], 0.28, P.a, 'chitin', { taper: 0.75, seg: 6 }); else V._ov(K, [0.22, GY - 0.02, GZ], [1.38, GY + 0.05, GZ], 0.31, P.a, 'chitin', { seg: 8 });
    K.fine(() => { for (let i = 0; i < 3; i++) V._pico(K, P, [0.5 + i * 0.3, GY + 0.22, GZ], [0.32 + i * 0.3, GY + 0.56, GZ], 0.06); });
    K.anim({ t: 'recoil', dist: 0.36 }, () => { K.seg([1.2, GY + 0.04, GZ], [2.68, GY + 0.1, GZ], 0.16, P.bo, 'bone', { taper: 0.85, seg: 7 });
      for (const x of (K.lite ? [1.85] : [1.5, 1.95, 2.4])) K.cyl(x, GY + 0.06 + (x - 1.5) * 0.04, GZ, 0.21, 0.21, 0.12, P.b, 'chitin', { rz: -H, seg: 8 });
      K.cyl(2.6, GY + 0.1, GZ, 0.26, 0.17, 0.22, P.m, 'wet', { rz: -H, seg: 8 }); if (K.lite) K.oct(2.86, GY - 0.02, GZ, 0.14, 0.24, P.ac, null, { e: 2.4 }); else K.sph(2.86, GY + 0.1, GZ, 0.14, P.ac, null, { e: 2.4, seg: 6 }); });
    /* braços de cima: o direito na empunhadura, o esquerdo apoia o cano por baixo */
    const arm = (sh, el, hd) => { if (K.lite) K.seg(sh, el, 0.21, P.b, 'chitin', { seg: 5 }); else V._ov(K, sh, el, 0.23, P.b, 'chitin', { seg: 6 }); K.seg(el, hd, 0.17, P.a, 'chitin', { taper: 0.8, seg: 5 });
      K.fine(() => { K.sph(hd[0], hd[1], hd[2], 0.17, P.d, 'chitin', { seg: 5 }); const m = [(el[0] + hd[0]) / 2, (el[1] + hd[1]) / 2, (el[2] + hd[2]) / 2]; V._pico(K, P, m, [m[0] - 0.34, m[1] + 0.05, el[2] * 1.32], 0.07); }); };
    arm([0.05, 4.8, 0.95], [-0.08, 3.93, 1.05], [0.6, 4.0, GZ + 0.22]); arm([0.05, 4.8, -0.95], [0.5, 3.95, -0.97], [1.5, GY - 0.14, GZ - 0.2]);
    /* braços de baixo: foices de osso dobradas junto ao corpo (só no completo) */
    K.fine(() => { for (const s of S2) { K.seg([0.38, 3.6, s * 0.66], [0.74, 3.2, s * 0.95], 0.1, P.b, 'chitin', { seg: 5 }); V._pico(K, P, [0.74, 3.2, s * 0.95], [1.34, 3.67, s * 0.86], 0.09); } }); },
  coletor(K, P, tc) { // 4.3 — Semeador: abdômen em placas de quitina sobrepostas, saco digestivo aceso nas costas preso por dedos de osso, sela de placas na cor do time, mandíbulas serrilhadas e goela de ácido (emissor do feixe)
    const SX = -2.2, SY = 3.6, AX = 2.55, AY = 1.75, AZ = 1.85, S2 = [-1, 1];
    const fr = x => Math.sqrt(Math.max(0, 1 - ((x - SX) / AX) ** 2)); // corte do saco em x
    const MX = SX + 0.1, MY = SY + 0.45, BX = AX * 0.86, BY = AY * 0.86, BZ = AZ * 0.84; // miolo aceso (sobressai da membrana no topo)
    const rad = (x, a) => { const f = fr(x), c = Math.cos(a), sn = Math.sin(a); let t = 1 / Math.sqrt((c / (AY * f)) ** 2 + (sn / (AZ * f)) ** 2); const g = 1 - ((x - MX) / BX) ** 2;
      if (g > 0) { const by = BY * Math.sqrt(g), bz = BZ * Math.sqrt(g), oy = MY - SY, A = (c / by) ** 2 + (sn / bz) ** 2, B = oy * c / by ** 2, D = B * B - A * ((oy / by) ** 2 - 1); if (D > 0) t = Math.max(t, (B + Math.sqrt(D)) / A); } return t; }; // raio da pele visível (membrana ∪ miolo)
    const on = (x, a, d) => { const t = rad(x, a) + d; return [x, SY + t * Math.cos(a), t * Math.sin(a)]; }; // ponto na pele do saco (a = 0 topo, ±H lados)
    const spike = (a, b, r) => K.seg(a, b, r, P.bo, 'bone', { taper: 0.06, seg: 5 });
    const plate = (x, y, lx, h, wz, col, tilt) => { K.sph(x - 0.08, y - 0.03, 0, 1, P.d, 'chitin', { half: true, sx: lx + 0.07, sy: h * 0.95, sz: wz + 0.05, rz: tilt, seg: 10 }); K.sph(x, y, 0, 1, col, 'chitin', { half: true, sx: lx, sy: h, sz: wz, rz: tilt, seg: 11 }); };
    // abdômen: base e cinco placas sobrepostas com espinhos laterais e espiráculos acesos
    K.sph(-2.3, 2.0, 0, 1, P.a, 'chitin', { sx: 3.45, sy: 1.15, sz: 2.2, seg: 14 });
    for (let i = 0; i < 5; i++) { const x = 0.35 - 1.2 * i, g = Math.sqrt(1 - ((x + 2.3) / 3.7) ** 2); plate(x, 1.75, 0.8, 1.5 * g, 2.45 * g, i % 2 ? P.b : P.a, -0.12);
      if (i > 0) for (const s of S2) { spike([x - 0.2, 2.45, s * 2.25 * g], [x - 0.55, 2.3, s * (2.25 * g + 0.75)], 0.14); if (i < 4) K.light(x - 0.62, 1.95, s * 2.2 * g, 0.16, P.l, 2.2); } }
    // ventre e tórax
    K.sph(1.7, 1.9, 0, 1, P.b, 'chitin', { sx: 2.3, sy: 0.8, sz: 1.4, seg: 12 });
    K.sph(2.0, 2.5, 0, 1, P.a, 'chitin', { sx: 1.7, sy: 1.05, sz: 1.8, seg: 12 });
    // saco digestivo nas costas: membrana acesa em dois tons e um brilho no topo (luz própria com volume)
    K.sph(SX, SY, 0, 1, '#5E9A22', null, { e: 1, sx: AX, sy: AY, sz: AZ, seg: 16 });
    K.anim({ t: 'bob', amp: 0.08, speed: 2.2 }, () => { K.sph(MX, MY, 0, 1, '#AEE64C', null, { e: 1.12, sx: BX, sy: BY, sz: BZ, seg: 14 }); // miolo pulsa dentro da membrana (com as veias)
      K.sph(SX + 0.35, MY + BY - 0.1, 0, 1, '#DDFF95', null, { e: 1.16, sx: 0.7, sy: 0.15, sz: 0.45, seg: 10 });
      for (const s of S2) { K.tube([on(0.2, s * 0.35, 0.02), on(-0.7, s * 0.55, 0.03), on(-1.6, s * 0.3, 0.03), on(-2.8, s * 0.5, 0.03), on(-3.9, s * 0.35, 0.03), on(-4.6, s * 0.12, 0.02)], 0.05, '#2E5216', 'wet', { ts: 12, rs: 4 });
        K.tube([on(-1.6, s * 0.3, 0.03), on(-2.0, s * 0.85, 0.03), on(-2.7, s * 1.3, 0.02)], 0.04, '#2E5216', 'wet', { ts: 8, rs: 4 }); K.tube([on(-2.8, s * 0.5, 0.03), on(-3.4, s * 0.95, 0.02)], 0.035, '#2E5216', 'wet', { ts: 6, rs: 4 }); } });
    // dedos de osso curvos segurando o saco (folga para o pulso do miolo)
    for (const [x, k] of [[-0.9, 1], [-2.2, 1.1], [-3.5, 0.9]]) for (const s of S2) { const a = on(x + 0.25, s * 1.95, 0.08), b = on(x, s * 1.3, 0.12), c = on(x - 0.35, s * 0.75, 0.13), d = on(x - 0.75, s * 0.32, 0.11);
      K.seg(a, b, 0.17 * k, P.bo, 'bone', { taper: 0.85, seg: 6 }); K.seg(b, c, 0.145 * k, P.bo, 'bone', { taper: 0.7, seg: 6 }); K.seg(c, d, 0.1 * k, P.bo, 'bone', { taper: 0.1, seg: 5 }); }
    // dutos de carne do saco até a boca
    for (const s of S2) K.tube([[-0.3, 2.75, s * 1.35], [0.9, 2.45, s * 1.9], [2.3, 2.5, s * 1.9], [3.4, 2.2, s * 1.45], [4.3, 1.9, s * 1.08]], 0.11, P.m, 'wet', { ts: 12, rs: 5 });
    // cauda
    K.sph(-5.45, 2.3, 0, 1, P.b, 'chitin', { half: true, sx: 0.9, sy: 0.7, sz: 1.0, rz: H, seg: 10 });
    spike([-5.4, 2.9, 0], [-5.95, 3.9, 0], 0.2); for (const s of S2) spike([-5.5, 2.2, s * 0.55], [-6.05, 2.0, s * 1.1], 0.12);
    K.oct(-5.92, 1.83, 0, 0.22, 0.44, P.ac, null, { e: 2.2 });
    // tórax: três placas sobrepostas (as de trás na cor do time) com quilhas e espinhos laterais
    plate(1.05, 2.9, 0.95, 1.05, 1.95, tc, -0.12);
    plate(2.0, 2.95, 0.95, 1.05, 1.95, tc, -0.12);
    plate(2.95, 3.0, 0.95, 0.95, 1.75, P.a, -0.12);
    for (const x of [1.0, 1.95, 2.9]) K.sph(x, 3.82 + (x > 2.5 ? 0 : 0.08), 0, 1, P.a, 'chitin', { sx: 0.8, sy: 0.2, sz: 0.16, rz: -0.12, seg: 8 });
    for (const s of S2) { spike([2.95, 3.3, s * 1.55], [3.55, 3.6, s * 2.45], 0.14); spike([2.0, 3.2, s * 1.75], [2.15, 3.5, s * 2.65], 0.14); }
    // cabeça: cápsula achatada, escudo com crista, clípeo sobre a boca, olhos em cacho e chifres
    K.sph(4.0, 2.25, 0, 1, P.a, 'chitin', { sx: 1.2, sy: 0.85, sz: 1.35, seg: 12 });
    K.sph(3.85, 2.55, 0, 1, P.b, 'chitin', { half: true, sx: 1.25, sy: 0.8, sz: 1.3, rz: -0.2, seg: 11 });
    K.sph(4.85, 2.3, 0, 1, P.a, 'chitin', { half: true, sx: 0.55, sy: 0.35, sz: 0.85, rz: -0.55, seg: 10 });
    K.sph(3.7, 3.25, 0, 1, P.a, 'chitin', { sx: 0.85, sy: 0.17, sz: 0.13, rz: -0.22, seg: 8 });
    for (const s of S2) { K.oct(4.76, 2.5, s * 0.62, 0.21, 0.4, P.l, null, { e: 1.7, ry: PI / 4 }); K.sph(4.56, 2.95, s * 0.6, 1, P.b, 'chitin', { sx: 0.36, sy: 0.1, sz: 0.24, ry: s * 0.5, rz: -0.3, seg: 8 });
      for (const [ex, ey, ez, er] of [[4.45, 3.06, 0.3, 0.12], [4.22, 3.2, 0.46, 0.1], [4.95, 2.42, 0.92, 0.12]]) K.oct(ex, ey - er, s * ez, er, er * 2, P.l, null, { e: 2 });
      spike([3.55, 3.15, s * 0.6], [2.85, 4.2, s * 1.0], 0.17); }
    // goela de ácido entre as mandíbulas (emissor do feixe), anel de dentes e maxilas
    K.tor(5.2, 1.75, 0, 0.36, 0.12, P.d, 'wet', { rz: H, ts: 12, rs: 5 });
    K.sph(5.17, 1.75, 0, 0.32, P.ac, null, { e: 2, seg: 6 });
    for (let k = 0; k < 6; k++) { const a = k * PI / 3 + PI / 6; K.seg([5.24, 1.75 + 0.33 * Math.cos(a), 0.33 * Math.sin(a)], [5.36, 1.75 + 0.1 * Math.cos(a), 0.1 * Math.sin(a)], 0.06, P.bo, 'bone', { taper: 0.05, seg: 4 }); }
    for (const s of S2) K.anim({ t: 'sway', p: [5.15, 1.5, s * 0.36], amp: 0.2, speed: 6, ph: s > 0 ? 0 : PI }, () => K.seg([5.15, 1.5, s * 0.36], [5.75, 1.1, s * 0.28], 0.1, P.bo, 'bone', { taper: 0.2, seg: 5 }));
    K.beam = [5.55, 1.75, 0];
    // mandíbulas serrilhadas em foice, abertas
    const JAW = [[0, 0.3], [0.45, 0.52], [1.0, 0.56], [1.45, 0.42], [1.8, 0.14], [1.98, -0.2], [1.76, -0.04], [1.67, 0.08], [1.49, 0.05], [1.4, 0.2], [1.17, 0.16], [1.08, 0.3], [0.85, 0.25], [0.55, 0.14], [0.27, 0.02], [0, 0]];
    for (const s of S2) { K.sph(4.55, 1.85, s * 1.0, 0.38, P.a, 'chitin', { seg: 8 });
      K.anim({ t: 'sway', p: [4.55, 1.85, s * 1.0], amp: 0.12, speed: 4, ph: s > 0 ? 0 : PI }, () => K.poly(JAW.map(([u, v]) => [u, s * v]), 0.26, P.bo, 'bone', { x: 4.55, y: 1.85, z: s * 1.0, rx: H, b: 0.05 })); }
    // oito patas articuladas: fêmur, joelho com espinho, tíbia e tarso com garra
    [[2.9, 1.3, 1.3, 1.1], [1.6, 0.3, 1.35, 1], [0.3, -0.9, 1.5, 0.95], [-1.1, -2.1, 1.85, 0.9]].forEach(([hx, dx, hz, w], i) => { for (const s of S2) { const fx = hx + dx, hip = [hx, 2.1, s * hz], knee = [hx + dx * 0.6, 3.5, s * 2.85], ank = [fx + dx * 0.1, 1.2, s * 3.3], foot = [fx + dx * 0.15, 0, s * 3.45];
      K.anim(legSpec(hip, { ph: (s > 0 ? 0 : PI) + (i % 2 ? PI : 0) }), () => { K.seg(hip, knee, 0.3 * w, P.b, 'chitin', { seg: 7 }); K.sph(knee[0], knee[1], knee[2], 0.3 * w, P.a, 'chitin', { seg: 6 }); spike(knee, [knee[0] - 0.2, knee[1] + 0.75, knee[2] + s * 0.25], 0.12);
        K.seg(knee, ank, 0.24 * w, P.b, 'chitin', { taper: 0.7, seg: 7 }); K.seg(ank, foot, 0.16 * w, P.d, 'chitin', { taper: 0.3, seg: 6 }); }); } }); },
  /* 4.3d — Frota da Prole (tanque, voadores, suporte, Carniceiro, Escaravelho e Brutamonte) no nível do Semeador 4.3a. Ajudantes com prefixo _ (não são unidades; ficam dentro do bloco) */
  // ponto na pele de um elipsoide de centro c e semieixos a: u = azimute em torno de y (0 = frente, +x), v = ângulo a partir do topo, d = folga para fora
  _el(c, a, u, v, d) { d = d || 0; return [c[0] + (a[0] + d) * Math.sin(v) * Math.cos(u), c[1] + (a[1] + d) * Math.cos(v), c[2] + (a[2] + d) * Math.sin(v) * Math.sin(u)]; },
  // espinho de osso que afina até a ponta
  _esp(K, P, a, b, r, col) { K.seg(a, b, r, col || P.bo, 'bone', { taper: 0.06, seg: 5 }); },
  // placa de quitina sobreposta: a casca e, só no completo, a borda escura por baixo (camadas como no Semeador)
  _placa(K, P, x, y, z, lx, h, wz, col, rz, o) { o = o || {}; const sg = o.seg || 10, rx = o.rx || 0, ry = o.ry || 0;
    K.fine(() => K.sph(x - 0.08, y - 0.03, z, 1, P.d, 'chitin', { half: true, sx: lx + 0.07, sy: h * 0.95, sz: wz + 0.05, rx, ry, rz, seg: sg - 2 }));
    K.sph(x, y, z, 1, col, o.mat || 'chitin', { half: true, sx: lx, sy: h, sz: wz, rx, ry, rz, seg: sg }); },
  // pata articulada que balança do quadril (legSpec): fêmur, joelho, tíbia e tarso-garra; no completo, caneleira e esporão no joelho. w = espessura; o.ph, o.amp, o.stride
  _pata(K, P, hip, knee, ank, foot, w, o) { o = o || {}; const sp = {}; for (const k of ['ph', 'amp', 'stride']) if (o[k] != null) sp[k] = o[k]; const s = hip[2] >= 0 ? 1 : -1, V = U.vorag;
    K.anim(legSpec(hip, sp), () => { K.seg(hip, knee, 0.3 * w, P.b, 'chitin', { taper: 0.82, seg: 7 }); K.sph(knee[0], knee[1], knee[2], 0.27 * w, P.a, 'chitin', { seg: 6 });
      K.seg(knee, ank, 0.23 * w, P.b, 'chitin', { taper: 0.72, seg: 7 }); K.seg(ank, foot, 0.16 * w, P.d, 'chitin', { taper: 0.18, seg: 6 });
      K.fine(() => { const m = [hip[0] + (knee[0] - hip[0]) * 0.55, hip[1] + (knee[1] - hip[1]) * 0.55, hip[2] + (knee[2] - hip[2]) * 0.55]; K.seg(hip, m, 0.36 * w, P.a, 'chitin', { taper: 0.78, seg: 6 }); V._esp(K, P, knee, [knee[0] - 0.2 * w, knee[1] + 0.75 * w, knee[2] + s * 0.3 * w], 0.1 * w); }); }); },
  // saco de membrana aceso: pele com brilho fraco, miolo que pulsa (bob) e sobressai no topo, reflexo e, no completo, veias escuras. cols = [pele, miolo, reflexo]
  _saco(K, P, c, a, cols, o) { o = o || {}; const V = U.vorag, sg = o.seg || 16, up = o.up == null ? 0.2 : o.up;
    K.sph(c[0], c[1], c[2], 1, cols[0], null, { e: o.e0 || 1, sx: a[0], sy: a[1], sz: a[2], seg: sg });
    const ci = [c[0] + a[0] * 0.04, c[1] + a[1] * up, c[2]], ai = [a[0] * 0.86, a[1] * 0.86, a[2] * 0.84];
    K.anim({ t: 'bob', amp: o.amp || 0.08, speed: o.speed || 2.2, ph: o.ph || 0 }, () => {
      K.sph(ci[0], ci[1], ci[2], 1, cols[1], null, { e: o.e1 || 1.12, sx: ai[0], sy: ai[1], sz: ai[2], seg: sg - 2 });
      K.sph(ci[0] + ai[0] * 0.18, ci[1] + ai[1] * 0.94, ci[2], 1, cols[2], null, { e: 1.16, sx: ai[0] * 0.32, sy: ai[1] * 0.1, sz: ai[2] * 0.3, seg: 10 });
      K.fine(() => { const vc = o.vein || '#3A1420', n = o.veins || 5; for (let i = 0; i < n; i++) { const u = i / n * PI * 2 + 0.4; K.tube([V._el(ci, ai, u, 0.18, 0.01), V._el(ci, ai, u + 0.2, 0.42, 0.02), V._el(ci, ai, u + 0.05, 0.66, 0.02), V._el(ci, ai, u + 0.28, 0.86, 0.01)], 0.04 * (o.vr || 1), vc, 'wet', { ts: 8, rs: 4 }); } }); }); },
  // olhos em cacho: um grande aceso e, no completo, três ocelos em volta
  _olhos(K, P, x, y, z, s, sd) { K.oct(x, y - 0.2 * s, z, 0.21 * s, 0.42 * s, P.l, null, { e: 1.8, ry: PI / 4 });
    K.fine(() => { for (const [dx, dy, dz, er] of [[-0.3, 0.38, -0.25, 0.12], [-0.52, 0.5, -0.08, 0.1], [0.15, -0.1, 0.3, 0.11]]) K.oct(x + dx * s, y + dy * s - er * s, z + sd * dz * s, er * s, er * 2 * s, P.l, null, { e: 2 }); }); },
  // perfil de mandíbula (u para a frente, v para fora): a foice serrilhada do Semeador
  _JAW: [[0, 0.3], [0.45, 0.52], [1.0, 0.56], [1.45, 0.42], [1.8, 0.14], [1.98, -0.2], [1.76, -0.04], [1.67, 0.08], [1.49, 0.05], [1.4, 0.2], [1.17, 0.16], [1.08, 0.3], [0.85, 0.25], [0.55, 0.14], [0.27, 0.02], [0, 0]],
  // mandíbula deitada que morde subindo e descendo do pivô da base (sway); s escala, sd lado, o.ry abre para fora
  _mand(K, P, x, y, z, s, sd, o) { o = o || {}; const J = o.J || U.vorag._JAW;
    K.anim({ t: 'sway', p: [x, y, z], amp: o.amp || 0.12, speed: o.speed || 4, ph: sd > 0 ? 0 : PI }, () => K.poly(J.map(([u, v]) => [u * s, sd * v * s]), 0.26 * s * (o.th || 1), o.col || P.bo, 'bone', { x, y, z, rx: H, ry: -sd * (o.ry || 0), b: K.lite || o.b === false ? 0 : 0.05 * s })); },
  // mandíbula trituradora em segmentos: gancho de osso que curva para dentro com dentes na face interna; morde (sway) do pivô da base. s escala, sd lado
  _mandS(K, P, x, y, z, s, sd, o) { o = o || {}; const V = U.vorag, col = o.col || P.bo;
    K.anim({ t: 'sway', p: [x, y, z], amp: o.amp || 0.14, speed: o.speed || 3, ph: sd > 0 ? 0 : PI }, () => { const p0 = [x, y, z], p1 = [x + 0.75 * s, y + 0.08 * s, z + sd * 0.42 * s], p2 = [x + 1.55 * s, y + 0.02 * s, z + sd * 0.3 * s], p3 = [x + 2.0 * s, y - 0.1 * s, z - sd * 0.22 * s];
      K.seg(p0, p1, 0.3 * s, col, 'bone', { taper: 0.9, seg: 8 }); K.seg(p1, p2, 0.27 * s, col, 'bone', { taper: 0.8, seg: 8 }); K.seg(p2, p3, 0.22 * s, col, 'bone', { taper: 0.12, seg: 7 }); K.sph(p1[0], p1[1], p1[2], 0.27 * s, col, 'bone', { seg: 7 });
      const nt = K.q(3); for (let i = 0; i < nt; i++) { const f = (i + 0.5) / nt, b = [p1[0] + (p2[0] - p1[0]) * f, p1[1] + (p2[1] - p1[1]) * f, p1[2] + (p2[2] - p1[2]) * f]; V._esp(K, P, b, [b[0] + 0.05 * s, b[1] - 0.05 * s, b[2] - sd * 0.42 * s], 0.09 * s, '#B9A88C'); } }); },
  // asa de membrana com perfil de inseto e nervuras; nasce em r0 (pivô do bater), envergadura L, corda c, lado sd; o.sw varrida para trás, o.dh diedro
  _ASA: [[0.12, 0], [0.32, 0.12], [0.42, 0.45], [0.4, 0.8], [0.26, 0.97], [0.05, 1], [-0.18, 0.93], [-0.36, 0.72], [-0.44, 0.42], [-0.34, 0.14], [-0.12, 0]],
  _asa(K, P, r0, L, c, sd, o) { o = o || {}; const sw = o.sw || 0.3, dh = o.dh || 0.1, b = -sd * sw, cb = Math.cos(b), sb = Math.sin(b), sh = Math.sin(dh), ch = Math.cos(dh);
    const W = (X, Y) => { const z = sd * Y * ch; return [r0[0] + X * cb + z * sb, r0[1] + Y * sh, r0[2] - X * sb + z * cb]; };
    K.anim({ t: 'flap', p: r0, amp: o.amp || 0.45, speed: o.speed || 26, ph: o.ph || 0, side: sd }, () => {
      K.poly(U.vorag._ASA.map(([u, v]) => [u * c, v * L]), 0.05, o.col || '#E3A0AA', 'wet', { x: r0[0], y: r0[1], z: r0[2], rx: sd * (H - dh), ry: b });
      K.seg(W(0.3 * c, 0), W(0.36 * c, 0.86 * L), 0.075, P.d, 'chitin', { taper: 0.35, seg: 5 });
      K.fine(() => { for (const [a0, a1, b0, b1] of [[0, 0.04, -0.12, 0.8], [-0.06, 0.06, -0.34, 0.52], [0.36, 0.5, -0.2, 0.64], [0.06, 0.3, -0.38, 0.32]]) K.seg(W(a0 * c, a1 * L), W(b0 * c, b1 * L), 0.035, P.b, 'chitin', { taper: 0.6, seg: 5 });
        const t = W(0.28 * c, 0.8 * L); K.sph(t[0], t[1] + 0.03, t[2], 0.13, P.l, null, { e: 1.5, sx: 1.4, sy: 0.35, sz: 1.4, seg: 6 }); }); }); },
  veiculo_hull(K, P, tc) { /* 4.3d — Besta de guerra: casco de seis placas sobrepostas (as duas de trás na cor do time), oito patas grossas e curtas, crânio blindado com presas e goela de ácido; o soquete de carne no dorso segura o órgão-arma (K.mount) */
    const V = U.vorag, S2 = [-1, 1];
    K.sph(-0.8, 2.25, 0, 1, P.a, 'chitin', { sx: 5.7, sy: 1.6, sz: 3.1, seg: 14 });
    K.sph(-0.6, 1.45, 0, 1, P.d, 'chitin', { sx: 5.1, sy: 0.95, sz: 2.6, seg: 12 });
    // carapaça: placas de trás para a frente, com esporões de borda e cravos na quilha (no completo)
    const PX = [-5.5, -4.0, -2.5, -1.0, 0.5, 2.0], PC = [tc, tc, P.b, P.a, P.b, P.a], gx = x => Math.sqrt(1 - ((x + 1.75) / 4.95) ** 2);
    PX.forEach((x, i) => { const g = gx(x); V._placa(K, P, x, 1.95, 0, 1.05, 2.15 * g, 3.9 * g, PC[i], -0.13, { seg: 10 });
      if (i > 0 && i < 4) K.fine(() => { for (const s of S2) V._esp(K, P, [x - 0.3, 2.3, s * 3.6 * g], [x - 0.8, 2.15, s * (3.6 * g + 0.85)], 0.13); }); });
    K.fine(() => { for (const x of [-5.3, -3.8]) V._esp(K, P, [x, 1.95 + 2.0 * gx(x), 0], [x - 0.5, 2.5 + 2.1 * gx(x), 0], 0.14); });
    // soquete do órgão-arma: lábios de carne
    K.tor(0, 3.85, 0, 2.5, 0.36, P.m, 'wet', { ts: 18, rs: 5 });
    K.mount = 3.95;
    // oito patas grossas e curtas em tripé alternado
    [[-4.1, -1.1], [-1.7, -0.45], [0.7, 0.45], [3.0, 1.1]].forEach(([x, dx], i) => { for (const s of S2) V._pata(K, P, [x, 1.8, s * 2.5], [x + dx * 0.5, 3.15, s * 4.0], [x + dx, 1.3, s * 4.75], [x + dx * 1.15, 0, s * 4.95], 1.65, { ph: (s > 0 ? 0 : PI) + (i % 2 ? PI : 0), stride: 9, amp: 0.26 }); });
    K.fine(() => { for (const x of [-3.3, -0.9, 1.4]) for (const s of S2) K.light(x, 1.55, s * 2.9, 0.2, P.l, 2.2); });
    // pescoço e cabeça: cápsula larga, escudo com quilha, clípeo, olhos em cacho, presas de osso, goela de ácido e mandíbulas
    K.sph(3.3, 2.0, 0, 1, P.b, 'chitin', { sx: 1.6, sy: 1.25, sz: 2.25, seg: 12 });
    K.sph(5.0, 1.75, 0, 1, P.a, 'chitin', { sx: 1.6, sy: 1.05, sz: 1.95, seg: 12 });
    V._placa(K, P, 4.7, 1.95, 0, 1.8, 1.2, 2.25, P.b, -0.28, { seg: 10 });
    K.sph(4.5, 3.05, 0, 1, P.bo, 'bone', { sx: 1.35, sy: 0.24, sz: 0.2, rz: -0.32, seg: 8 });
    V._placa(K, P, 6.2, 1.55, 0, 0.75, 0.6, 1.4, P.a, -0.8, { seg: 9 });
    for (const s of S2) { V._olhos(K, P, 5.85, 2.3, s * 1.25, 1.1, s);
      const t0 = [5.9, 1.4, s * 1.2], t1 = [7.1, 1.05, s * 1.55], t2 = [8.2, 1.15, s * 1.62], t3 = [8.85, 1.85, s * 1.4];
      K.seg(t0, t1, 0.36, P.bo, 'bone', { taper: 0.85, seg: 8 }); K.seg(t1, t2, 0.31, P.bo, 'bone', { taper: 0.75, seg: 8 }); K.seg(t2, t3, 0.23, P.bo, 'bone', { taper: 0.08, seg: 7 });
      K.fine(() => K.sph(t1[0], t1[1], t1[2], 0.3, P.bo, 'bone', { seg: 6 })); }
    K.tor(6.75, 1.2, 0, 0.32, 0.11, P.d, 'wet', { rz: H, ts: 10, rs: 5 });
    K.sph(6.72, 1.2, 0, 0.28, P.ac, null, { e: 1.9, seg: 7 });
    for (const s of S2) V._mand(K, P, 6.3, 1.05, s * 0.72, 0.85, s, { ry: 0.15, amp: 0.1, speed: 3, b: false });
    K.fine(() => { for (const s of S2) K.anim({ t: 'sway', p: [6.0, 2.5, s * 0.55], amp: 0.14, speed: 3, ph: s > 0 ? 0 : 1.3 }, () => { K.seg([6.0, 2.5, s * 0.55], [7.0, 3.3, s * 0.9], 0.07, P.d, 'chitin', { seg: 5 }); K.seg([7.0, 3.3, s * 0.9], [8.1, 3.5, s * 1.25], 0.05, P.d, 'chitin', { taper: 0.3, seg: 5 }); }); });
    // cauda: placa terminal, ferrões e um poro aceso
    K.sph(-6.55, 2.1, 0, 1, P.b, 'chitin', { half: true, sx: 1.0, sy: 0.8, sz: 1.35, rz: H * 0.9, seg: 8 });
    V._esp(K, P, [-7.0, 2.6, 0], [-7.8, 3.5, 0], 0.2); for (const s of S2) V._esp(K, P, [-7.0, 2.1, s * 0.6], [-7.7, 1.9, s * 1.25], 0.15);
    K.light(-7.35, 1.85, 0, 0.22, P.l, 2.2); },
  veiculo_turret(K, P, tc) { /* 4.3d — órgão-arma: domo de músculo e quitina com escudo na cor do time, bexiga de sangue aceso atrás (munição que pulsa) presa por dedos de osso, manga de carne e cano grosso de anéis que recua, boca de ácido; olhos na frente */
    const V = U.vorag, S2 = [-1, 1], SC = [-2.3, 1.65, 0], SA = [1.1, 0.95, 1.05], BY = 1.45;
    K.tor(0, 0.25, 0, 2.42, 0.24, P.d, 'wet', { ts: 18, rs: 5 });
    K.sph(0, 0.12, 0, 1, P.b, 'chitin', { half: true, sx: 2.6, sy: 1.95, sz: 2.4, seg: 14 });
    V._placa(K, P, 0.2, 0.62, 0, 2.2, 1.5, 2.05, tc, -0.1, { seg: 12 });
    K.fine(() => K.sph(0.35, 2.1, 0, 1, P.a, 'chitin', { sx: 1.6, sy: 0.16, sz: 0.14, rz: -0.1, seg: 6 }));
    V._saco(K, P, SC, SA, ['#8E2234', '#FF5A5A', '#FFD0D0'], { seg: 12, amp: 0.06, speed: 3, vein: '#4A0A18', veins: 3 });
    for (let k = 0; k < K.q(2); k++) for (const s of S2) { const u = s * (1.1 + k * 0.9), a = V._el(SC, SA, u, 2.0, 0.06), b = V._el(SC, SA, u + s * 0.2, 1.35, 0.1), c = V._el(SC, SA, u + s * 0.4, 0.85, 0.1);
      K.seg(a, b, 0.15, P.bo, 'bone', { taper: 0.8, seg: 6 }); K.seg(b, c, 0.12, P.bo, 'bone', { taper: 0.2, seg: 6 }); }
    // manga de carne fixa e o cano que recua dentro dela
    K.seg([1.3, BY - 0.05, 0], [2.9, BY, 0], 0.78, P.m, 'wet', { taper: 0.82, seg: 12 });
    K.anim({ t: 'recoil', dist: 0.95 }, () => { K.seg([1.5, BY, 0], [6.6, BY + 0.1, 0], 0.56, P.bo, 'bone', { taper: 0.8, seg: 12 });
      const n = K.q(5); for (let i = 0; i < n; i++) { const f = 0.3 + 0.62 * i / Math.max(1, n - 1), x = 1.5 + 5.1 * f; K.cyl(x - 0.14, BY + 0.1 * f, 0, 0.61 - 0.112 * f, 0.61 - 0.112 * f, 0.28, P.a, 'chitin', { rz: -H, seg: 10 }); }
      K.cyl(6.45, BY + 0.1, 0, 0.66, 0.46, 0.65, P.m, 'wet', { rz: -H, seg: 12 });
      K.sph(7.05, BY + 0.1, 0, 0.32, P.ac, null, { e: 2.2, seg: 8 });
      K.fine(() => { K.tube([[1.8, BY + 0.55, 0], [3.6, BY + 0.62, 0], [5.4, BY + 0.55, 0]], 0.11, P.m, 'wet', { ts: 8, rs: 5 }); for (const x of [3.0, 4.2, 5.4]) V._esp(K, P, [x, BY + 0.45, 0], [x - 0.4, BY + 1.05, 0], 0.09); }); });
    for (const s of S2) { V._olhos(K, P, 2.2, 1.25, s * 0.95, 0.85, s); K.seg([0.6, 0.55, s * 1.75], [2.5, BY - 0.15, s * 0.62], 0.17, P.m, 'wet', { taper: 0.7, seg: 6 }); K.fine(() => K.sph(0.6, 0.55, s * 1.75, 0.24, P.bo, 'bone', { seg: 5 })); }
    K.fine(() => { for (let i = 0; i < 3; i++) V._esp(K, P, [-0.85 - i * 0.55, 1.85 - i * 0.14, 0], [-1.15 - i * 0.6, 2.5 - i * 0.2, 0], 0.11); }); },
  drone(K, P, tc) { /* 4.3d — Vespa de guerra: tórax blindado com escudo na cor do time, olhos compostos acesos, dois pares de asas de membrana com nervuras (batem), abdômen em gomos que balança e dois tubos de espinhos sob a cabeça que recuam a cada rajada */
    const V = U.vorag, S2 = [-1, 1];
    K.sph(0, 1.55, 0, 1, P.a, 'chitin', { sx: 1.45, sy: 1.0, sz: 1.1, seg: 14 });
    V._placa(K, P, 0.25, 1.8, 0, 1.25, 0.95, 1.05, tc, -0.12, { seg: 12 });
    V._placa(K, P, -0.95, 1.75, 0, 0.62, 0.72, 0.85, P.b, -0.15, { seg: 10 });
    K.sph(1.8, 1.5, 0, 1, P.b, 'chitin', { sx: 0.72, sy: 0.68, sz: 0.82, seg: 12 });
    for (const s of S2) K.sph(1.98, 1.66, s * 0.5, 1, P.l, null, { e: 1.5, sx: 0.42, sy: 0.5, sz: 0.36, seg: 10 });
    K.fine(() => { for (const s of S2) K.anim({ t: 'sway', p: [2.2, 2.0, s * 0.25], amp: 0.16, speed: 4, ph: s > 0 ? 0 : 1 }, () => { K.seg([2.2, 2.0, s * 0.25], [3.0, 2.55, s * 0.55], 0.05, P.d, 'chitin', { seg: 5 }); K.seg([3.0, 2.55, s * 0.55], [3.8, 2.5, s * 0.8], 0.04, P.d, 'chitin', { taper: 0.3, seg: 5 }); }); });
    // armas: glândula e tubo de espinhos que recua
    for (const s of S2) { K.sph(1.0, 0.95, s * 0.52, 1, P.m, 'wet', { sx: 0.5, sy: 0.32, sz: 0.3, seg: 8 });
      K.anim({ t: 'recoil', dist: 0.45 }, () => { K.seg([1.0, 0.9, s * 0.52], [3.05, 0.95, s * 0.4], 0.16, P.d, 'chitin', { taper: 0.72, seg: 8 }); K.sph(3.08, 0.95, s * 0.4, 0.13, P.ac, null, { e: 2.2, seg: 6 }); }); }
    // abdômen em gomos (um na cor do time) que balança do pecíolo
    K.anim({ t: 'sway', p: [-1.2, 1.5, 0], amp: 0.07, speed: 3 }, () => { K.seg([-0.9, 1.45, 0], [-1.7, 1.4, 0], 0.3, P.d, 'chitin', { seg: 8 });
      K.sph(-3.3, 1.25, 0, 1, P.a, 'chitin', { sx: 1.95, sy: 0.82, sz: 0.88, rz: 0.12, seg: 14 });
      const n = K.q(4); for (let i = 0; i < n; i++) { const f = n > 1 ? i / (n - 1) : 0, x = -1.95 - f * 2.4, g = Math.sqrt(Math.max(0.1, 1 - ((x + 3.3) / 2.05) ** 2)); V._placa(K, P, x, 1.25 + (x + 3.3) * 0.12 - 0.05, 0, 0.55 * 4 / n, 0.95 * g, 1.0 * g, i === 1 ? tc : (i % 2 ? P.b : P.a), -0.1, { seg: 10 }); }
      K.fine(() => { V._esp(K, P, [-5.05, 1.05, 0], [-5.85, 0.85, 0], 0.14); K.sph(-5.15, 1.0, 0, 0.16, P.ac, null, { e: 2, seg: 6 }); }); });
    // asas: par da frente maior, par de trás defasado
    for (const s of S2) { V._asa(K, P, [0.45, 2.2, s * 0.7], 5.0, 1.75, s, { sw: 0.22, dh: 0.12, amp: 0.42, speed: 28 }); V._asa(K, P, [-0.45, 2.1, s * 0.62], 3.9, 1.35, s, { sw: 0.55, dh: 0.06, amp: 0.42, speed: 28, ph: 1.1 }); }
    // patas dobradas sob o tórax
    K.fine(() => { [[0.8, 0.5], [0.1, 0], [-0.6, -0.5]].forEach(([x, dx], i) => { for (const s of S2) K.anim({ t: 'sway', p: [x, 0.95, s * 0.55], amp: 0.12, speed: 2.4, ph: i + (s > 0 ? 0 : 1) }, () => { K.seg([x, 0.95, s * 0.55], [x + dx * 0.4, 0.75, s * 1.15], 0.09, P.b, 'chitin', { seg: 5 }); K.seg([x + dx * 0.4, 0.75, s * 1.15], [x + dx - 0.5, 0.5, s * 1.3], 0.07, P.d, 'chitin', { taper: 0.3, seg: 5 }); }); }); }); },
  suporte(K, P, tc) { /* 4.3d — Bolsa de membrana: besta-carrapato de seis patas que carrega numa taça de quitina uma bexiga nervosa acesa (rosa) presa por costelas de osso, com anel na cor do time na borda; antenas de interferência e uma trombeta de carne na frente que dispara o pulso */
    const V = U.vorag, S2 = [-1, 1], SC = [-0.2, 4.75, 0], SA = [3.0, 2.5, 2.75];
    K.sph(0, 2.0, 0, 1, P.a, 'chitin', { sx: 3.3, sy: 1.3, sz: 2.6, seg: 14 });
    K.sph(0.1, 1.35, 0, 1, P.d, 'chitin', { sx: 2.9, sy: 0.8, sz: 2.2, seg: 12 });
    for (const s of S2) V._placa(K, P, -0.2, 1.7, s * 2.3, 2.2, 1.0, 0.75, P.b, 0, { seg: 9, rx: s * 0.5 });
    V._placa(K, P, -3.0, 1.75, 0, 0.9, 1.0, 1.9, P.b, 0.35, { seg: 9 });
    // bexiga numa taça de quitina; anel na cor do time na borda e costelas de osso por cima (o miolo pulsa por dentro)
    V._saco(K, P, SC, SA, ['#8E2452', '#FF6FA6', '#FFD3E6'], { seg: 18, amp: 0.12, speed: 2.6, up: 0.18, vein: '#5A0F2E', veins: 6, vr: 1.4 });
    K.sph(SC[0], 4.35, 0, 1, P.a, 'chitin', { half: true, rx: PI, sx: 3.2, sy: 2.05, sz: 2.95, seg: 16 });
    K.tor(SC[0], 4.35, 0, 3.12, 0.3, tc, 'chitin', { ts: 28, rs: 5, sz: 0.93 });
    const nr = K.q(6); for (let i = 0; i < nr; i++) { const u = i / nr * PI * 2 + PI / nr, p = [1.62, 1.3, 1.0, 0.72].map(v => V._el(SC, SA, u, v, 0.14));
      for (let k = 0; k < 3; k++) K.seg(p[k], p[k + 1], 0.2 - k * 0.04, P.bo, 'bone', { taper: k === 2 ? 0.25 : 0.85, seg: 6 }); }
    K.fine(() => ringOf(14, 3.3, (cx, cz) => V._esp(K, P, [cx + SC[0], 4.2, cz * 0.93], [(cx * 1.14) + SC[0], 3.7, cz * 1.06], 0.08)));
    // antenas de interferência com pontas acesas
    for (const s of S2) K.anim({ t: 'sway', p: [1.5, 4.3, s * 1.7], amp: 0.09, speed: 2.2, ph: s > 0 ? 0 : 1.6 }, () => { K.seg([1.5, 4.3, s * 1.7], [2.3, 7.0, s * 2.05], 0.12, P.d, 'chitin', { taper: 0.6, seg: 6 }); K.seg([2.3, 7.0, s * 2.05], [2.0, 8.7, s * 2.25], 0.07, P.d, 'chitin', { taper: 0.5, seg: 5 }); K.sph(2.0, 8.75, s * 2.25, 0.16, '#FF6FA6', null, { e: 2.2, seg: 6 }); });
    K.fine(() => K.anim({ t: 'sway', p: [-2.6, 4.3, 0], amp: 0.1, speed: 1.8, ph: 0.7 }, () => { K.seg([-2.6, 4.3, 0], [-3.7, 7.2, 0], 0.1, P.d, 'chitin', { taper: 0.5, seg: 5 }); K.sph(-3.7, 7.25, 0, 0.14, '#FF6FA6', null, { e: 2.2, seg: 6 }); }));
    // cabeça baixa, olhos e palpos
    K.sph(3.45, 1.8, 0, 1, P.b, 'chitin', { sx: 1.0, sy: 0.8, sz: 1.2, seg: 12 });
    V._placa(K, P, 3.3, 1.95, 0, 0.95, 0.75, 1.25, tc, -0.3, { seg: 10 });
    for (const s of S2) V._olhos(K, P, 4.1, 2.05, s * 0.75, 0.75, s);
    K.fine(() => { for (const s of S2) K.anim({ t: 'sway', p: [4.2, 1.4, s * 0.45], amp: 0.2, speed: 5, ph: s > 0 ? 0 : PI }, () => { K.seg([4.2, 1.4, s * 0.45], [4.85, 1.0, s * 0.55], 0.09, P.bo, 'bone', { seg: 5 }); K.seg([4.85, 1.0, s * 0.55], [5.1, 0.5, s * 0.4], 0.07, P.bo, 'bone', { taper: 0.3, seg: 5 }); }); });
    // trombeta do pulso: tubo de carne com boca larga e anel aceso
    K.seg([2.4, 3.1, 0], [3.7, 3.8, 0], 0.45, P.b, 'chitin', { taper: 0.85, seg: 10 });
    K.lathe([[0.38, 0], [0.35, 0.55], [0.44, 1.0], [0.7, 1.3], [0.95, 1.42], [0.78, 1.46], [0.42, 1.3]], 3.55, 3.7, 0, P.m, 'wet', { rz: -H + 0.55, seg: 16 });
    K.sph(4.58, 4.36, 0, 0.44, '#FF6FA6', null, { e: 2.2, sx: 0.5, seg: 10 });
    // seis patas
    [[-1.9, -0.9], [0, 0], [1.9, 0.9]].forEach(([x, dx], i) => { for (const s of S2) V._pata(K, P, [x, 1.8, s * 2.1], [x + dx * 0.4, 3.2, s * 3.6], [x + dx, 1.3, s * 4.2], [x + dx * 1.1, 0, s * 4.35], 1.25, { ph: (s > 0 ? 0 : PI) + (i % 2 ? PI : 0) }); }); },
  pirata(K, P, tc) { /* 4.3d — Carniceiro: papo inchado na frente, pálido como carrapato cheio, com calombos e veias acesas, esticado por sucata engolida que fura a pele; mandíbulas trituradoras, moenda de dentes que gira na boca, braços-gancho que trazem uma chapa de destroço à boca e seis patas; abdômen com placas na cor do time */
    const V = U.vorag, S2 = [-1, 1], CC = [1.15, 2.95, 0], CA = [2.15, 1.85, 2.35];
    K.sph(-3.2, 2.1, 0, 1, P.a, 'chitin', { sx: 2.6, sy: 1.45, sz: 2.0, seg: 14 });
    K.sph(-3.0, 1.5, 0, 1, P.d, 'chitin', { sx: 2.3, sy: 0.85, sz: 1.75, seg: 12 });
    [-4.85, -3.85, -2.85, -1.85].forEach((x, i) => { const g = Math.sqrt(1 - ((x + 3.25) / 2.7) ** 2); V._placa(K, P, x, 1.85, 0, 0.75, 1.9 * g, 2.4 * g, [P.b, tc, tc, P.a][i], -0.14, { seg: 11 });
      if (i > 0) K.fine(() => { for (const s of S2) V._esp(K, P, [x - 0.2, 2.4, s * 2.25 * g], [x - 0.6, 2.25, s * (2.25 * g + 0.7)], 0.12); }); });
    K.sph(-0.75, 2.15, 0, 1, P.b, 'chitin', { sx: 1.3, sy: 1.15, sz: 1.65, seg: 12 });
    V._placa(K, P, -0.9, 2.4, 0, 0.95, 1.05, 1.6, P.a, -0.12, { seg: 10 });
    K.fine(() => { const r = rng(31); for (const [x, z] of [[-3.3, 0.6], [-2.3, -0.75]]) K.box(x, 3.1, z, 0.5 + r() * 0.3, 0.9, 0.12, '#5A5F68', 'metal', { rx: (r() - 0.5) * 0.8, rz: 0.5 + r() * 0.4, ry: r() * PI }); });
    // papo inchado (como um carrapato cheio): pele pálida esticada que pulsa, calombos, veias acesas e sucata escura que fura a pele
    K.anim({ t: 'bob', amp: 0.07, speed: 1.6 }, () => { K.sph(CC[0], CC[1], CC[2], 1, '#D8A49C', 'wet', { sx: CA[0], sy: CA[1], sz: CA[2], seg: 18 });
      for (const [u, v, k] of [[1.9, 1.5, 0.95], [-2.0, 1.35, 0.85], [2.9, 1.2, 0.8]]) { const p = V._el(CC, CA, u, v, -0.35); K.sph(p[0], p[1], p[2], k, '#C98E88', 'wet', { sx: 1.1, sy: 0.85, seg: 10 }); }
      const nv = K.q(7); for (let i = 0; i < nv; i++) { const u = i / nv * PI * 2 + 0.3; K.tube([V._el(CC, CA, u, 0.2, 0.01), V._el(CC, CA, u + 0.25, 0.6, 0.02), V._el(CC, CA, u + 0.05, 1.05, 0.02), V._el(CC, CA, u + 0.3, 1.5, 0.01)], 0.055, '#FF4A5E', null, { e: 1.6, ts: 8, rs: 4 }); }
      K.fine(() => { for (let i = 0; i < 6; i++) { const u = i / 6 * PI * 2 + 0.75; K.tube([V._el(CC, CA, u, 0.85, 0.01), V._el(CC, CA, u + 0.2, 1.2, 0.02), V._el(CC, CA, u + 0.05, 1.55, 0.01)], 0.035, '#8E3A44', 'wet', { ts: 6, rs: 4 }); } }); });
    { const r = rng(77), ns = K.q(7); for (let i = 0; i < ns; i++) { const u = -2.7 + i * (5.4 / Math.max(1, ns - 1)) + (r() - 0.5) * 0.4, v = 0.45 + r() * 0.8, p = V._el(CC, CA, u, v, -0.25), big = i % 3 === 1;
      const col = ['#4E535C', '#6B7079', '#3A3E46'][i % 3], o = { rx: (r() - 0.5) * 1.1, ry: r() * PI, rz: (r() - 0.5) * 1.1 + Math.cos(u) * 0.4 };
      if (big) K.prism(p[0], p[1], p[2], 0.5, 1.5, 3, col, 'metal', Object.assign({ top: 0.12 }, o)); else K.box(p[0], p[1], p[2], 0.45 + r() * 0.4, 0.95 + r() * 0.55, 0.12 + r() * 0.08, col, 'metal', o); }
      const q = V._el(CC, CA, 0.5, 0.8, -0.25); K.fine(() => K.box(q[0], q[1], q[2], 0.8, 1.0, 0.14, '#E8B23A', 'paint', { rx: 0.3, rz: -0.5, ry: 0.4 })); }
    for (let k = 0; k < K.q(2); k++) { const u = k ? 2.3 : -2.3; const p = [2.0, 1.45, 0.95, 0.6].map(v => V._el(CC, CA, u, v, 0.12)); for (let j = 0; j < 3; j++) K.seg(p[j], p[j + 1], 0.18 - j * 0.03, P.bo, 'bone', { taper: j === 2 ? 0.2 : 0.85, seg: 6 }); }
    // cabeça larga e baixa, escudo, olhos
    K.sph(4.05, 1.55, 0, 1, P.a, 'chitin', { sx: 1.25, sy: 0.95, sz: 1.7, seg: 12 });
    V._placa(K, P, 3.9, 1.65, 0, 1.35, 1.0, 1.8, P.b, -0.32, { seg: 11 });
    for (const s of S2) V._olhos(K, P, 4.6, 2.2, s * 1.0, 0.85, s);
    // moenda de dentes que gira na boca e goela de ácido
    K.sph(5.15, 1.4, 0, 0.38, P.ac, null, { e: 1.8, seg: 8 });
    K.anim({ t: 'spin', p: [5.25, 1.4, 0], axis: 'x', speed: 3 }, () => { K.tor(5.25, 1.4, 0, 0.55, 0.13, P.d, 'wet', { rz: H, ts: 14, rs: 5 }); const n = K.q(8); for (let i = 0; i < n; i++) { const a = i / n * PI * 2; V._esp(K, P, [5.3, 1.4 + 0.52 * Math.cos(a), 0.52 * Math.sin(a)], [5.62, 1.4 + 0.2 * Math.cos(a + 0.5), 0.2 * Math.sin(a + 0.5)], 0.09); } });
    // mandíbulas trituradoras
    for (const s of S2) V._mandS(K, P, 4.75, 1.3, s * 1.0, 1.25, s, { col: '#D9C9AE' });
    // braços-gancho: o esquerdo traz uma chapa de destroço à boca
    for (const s of S2) K.anim({ t: 'sway', p: [3.3, 1.85, s * 1.5], amp: 0.13, speed: 2.4, ph: s > 0 ? 0 : 1.9 }, () => { const e = [4.5, 3.25, s * 2.35], w = [5.75, 2.45, s * 1.75];
      K.seg([3.3, 1.85, s * 1.5], e, 0.24, P.b, 'chitin', { taper: 0.85, seg: 7 }); K.sph(e[0], e[1], e[2], 0.22, P.a, 'chitin', { seg: 6 }); K.seg(e, w, 0.19, P.b, 'chitin', { taper: 0.75, seg: 7 });
      V._esp(K, P, w, [6.25, 1.85, s * 1.45], 0.14); K.fine(() => V._esp(K, P, [w[0] - 0.15, w[1], w[2]], [5.95, 1.6, s * 1.85], 0.1));
      if (s < 0) K.box(6.05, 1.55, s * 1.3, 0.9, 1.25, 0.14, '#6B7079', 'metal', { rx: 0.5, ry: -0.6, rz: 0.35 }); });
    // seis patas
    [[-3.0, -1.0], [-1.4, -0.2], [0.2, 0.6]].forEach(([x, dx], i) => { for (const s of S2) V._pata(K, P, [x, 1.9, s * 1.85], [x + dx * 0.5, 3.3, s * 3.6], [x + dx, 1.2, s * 4.3], [x + dx * 1.1, 0, s * 4.5], 1.1, { ph: (s > 0 ? 0 : PI) + (i % 2 ? PI : 0) }); });
    // cauda curta
    K.sph(-5.7, 2.1, 0, 1, P.b, 'chitin', { half: true, sx: 0.75, sy: 0.6, sz: 0.9, rz: H * 0.9, seg: 9 }); V._esp(K, P, [-6.0, 2.4, 0], [-6.6, 3.1, 0], 0.15); },
  escaravelho(K, P, tc) { /* 4.3d — Escaravelho: besta-transporte rápida — élitros na cor do time com quilhas, pronoto blindado com chifre torácico, chifre longo da cabeça para a investida, bolsas de carga com crias nos flancos e seis patas longas de corrida */
    const V = U.vorag, S2 = [-1, 1];
    K.sph(-0.6, 2.0, 0, 1, P.a, 'chitin', { sx: 4.4, sy: 1.5, sz: 2.5, seg: 16 });
    K.sph(-0.4, 1.35, 0, 1, P.d, 'chitin', { sx: 4.0, sy: 0.8, sz: 2.1, seg: 12 });
    // élitros (cor do time), costura escura e quilhas
    for (const s of S2) { V._placa(K, P, -1.65, 2.0, s * 0.95, 3.85, 1.95, 1.75, tc, 0.04, { seg: 16, rx: s * 0.1 });
      K.fine(() => { for (const k of [0.4, 0.78]) K.tube([-0.8, -0.45, 0, 0.45, 0.8].map(t => [-1.65 + t * 3.85, 2.02 + 1.95 * Math.sqrt(Math.max(0, 1 - t * t - k * k)), s * (0.95 + k * 1.75 + 0.1 * k * k)]), 0.07, P.b, 'chitin', { ts: 10, rs: 4 }); }); }
    K.sph(-1.65, 3.5, 0, 1, P.d, 'chitin', { sx: 3.6, sy: 0.16, sz: 0.16, seg: 10 });
    K.sph(-5.15, 1.95, 0, 1, P.b, 'chitin', { half: true, sx: 0.75, sy: 0.7, sz: 1.5, rz: H * 0.85, seg: 10 });
    for (const s of S2) K.sph(-5.0, 2.55, s * 0.75, 1, '#E3A0AA', 'wet', { sx: 1.3, sy: 0.05, sz: 0.55, ry: s * 0.35, rz: 0.12, seg: 10 });
    // pronoto e chifre torácico
    V._placa(K, P, 2.25, 2.1, 0, 1.75, 1.55, 2.3, P.a, -0.2, { seg: 14 });
    K.seg([2.45, 3.45, 0], [3.5, 4.25, 0], 0.3, P.bo, 'bone', { taper: 0.75, seg: 8 }); K.seg([3.5, 4.25, 0], [4.55, 4.35, 0], 0.22, P.bo, 'bone', { taper: 0.1, seg: 7 }); K.fine(() => K.sph(3.5, 4.25, 0, 0.22, P.bo, 'bone', { seg: 6 }));
    // cabeça, chifre longo (investida), olhos, antenas e mandíbulas
    K.sph(4.3, 1.55, 0, 1, P.b, 'chitin', { sx: 1.0, sy: 0.8, sz: 1.15, seg: 12 });
    { const h0 = [4.85, 1.75, 0], h1 = [6.2, 2.15, 0], h2 = [7.3, 3.15, 0], h3 = [7.8, 4.55, 0]; K.seg(h0, h1, 0.42, P.bo, 'bone', { taper: 0.88, seg: 9 }); K.seg(h1, h2, 0.37, P.bo, 'bone', { taper: 0.75, seg: 9 }); K.seg(h2, h3, 0.28, P.bo, 'bone', { taper: 0.1, seg: 8 });
      K.fine(() => { K.sph(h1[0], h1[1], h1[2], 0.37, P.bo, 'bone', { seg: 7 }); K.sph(h2[0], h2[1], h2[2], 0.28, P.bo, 'bone', { seg: 7 }); for (const s of S2) V._esp(K, P, [7.45, 3.6, 0], [7.95, 3.85, s * 0.45], 0.1); }); }
    for (const s of S2) V._olhos(K, P, 4.85, 1.95, s * 0.8, 0.7, s);
    K.fine(() => { for (const s of S2) { K.anim({ t: 'sway', p: [4.9, 1.6, s * 0.55], amp: 0.15, speed: 3.4, ph: s > 0 ? 0 : 1.2 }, () => { K.seg([4.9, 1.6, s * 0.55], [5.6, 2.1, s * 1.2], 0.05, P.d, 'chitin', { seg: 5 }); K.seg([5.6, 2.1, s * 1.2], [6.3, 2.05, s * 1.55], 0.04, P.d, 'chitin', { taper: 0.3, seg: 5 }); }); V._mand(K, P, 4.95, 1.2, s * 0.5, 0.55, s, { amp: 0.12, speed: 4 }); } });
    // bolsas de carga com crias (acesas) presas nos flancos por ganchos de osso
    for (const x of K.lite ? [-1.6] : [-2.6, -0.6]) for (const s of S2) { K.sph(x, 1.55, s * 2.65, 1, '#8E2234', null, { e: 1, sx: K.lite ? 1.6 : 0.85, sy: 0.62, sz: 0.5, seg: 10 }); K.sph(x + 0.05, 1.62, s * 2.75, 1, '#FF7A86', null, { e: 1.1, sx: K.lite ? 1.2 : 0.62, sy: 0.42, sz: 0.38, seg: 8 });
      K.fine(() => { K.seg([x - 0.5, 2.5, s * 2.3], [x - 0.6, 1.1, s * 3.05], 0.08, P.bo, 'bone', { seg: 5 }); K.seg([x + 0.5, 2.5, s * 2.3], [x + 0.6, 1.1, s * 3.05], 0.08, P.bo, 'bone', { seg: 5 }); }); }
    // seis patas longas de corrida
    [[-1.8, -1.6], [0.4, -0.3], [2.2, 1.2]].forEach(([x, dx], i) => { for (const s of S2) V._pata(K, P, [x, 1.7, s * 1.9], [x + dx * 0.45, 3.2, s * 3.7], [x + dx, 1.1, s * 4.4], [x + dx * 1.15, 0, s * 4.6], 1.15, { ph: (s > 0 ? 0 : PI) + (i % 2 ? PI : 0), stride: 9, amp: 0.36 }); }); },
  brutamonte(K, P, tc) { /* 4.3d — Brutamonte: tanque biológico da Era 3 — carapaça de seis placas enormes (duas na cor do time) com esporões, sacos de gás que pulsam nos flancos, crânio-aríete de osso com presas, dois braços-clava (golpe de área) e oito patas-pilar */
    const V = U.vorag, S2 = [-1, 1];
    K.sph(-0.8, 4.0, 0, 1, P.a, 'chitin', { sx: 7.6, sy: 3.0, sz: 5.0, seg: 20 });
    K.sph(-0.6, 2.6, 0, 1, P.d, 'chitin', { sx: 7.0, sy: 1.7, sz: 4.3, seg: 14 });
    const PX = [-7.4, -5.0, -2.6, -0.2, 2.2, 4.6], PC = [P.b, P.a, tc, tc, P.a, P.b];
    PX.forEach((x, i) => { const g = Math.sqrt(1 - ((x + 1.4) / 7.2) ** 2); V._placa(K, P, x, 3.6, 0, 1.6, 4.2 * g, 6.0 * g, PC[i], -0.14, { seg: 14 });
      V._esp(K, P, [x - 0.3, 3.4 + 4.0 * g, 0], [x - 1.1, 4.9 + 4.4 * g, 0], 0.32);
      for (const s of S2) { V._esp(K, P, [x - 0.4, 4.4, s * 5.6 * g], [x - 1.2, 4.2, s * (5.6 * g + 1.5)], 0.24); K.fine(() => { V._esp(K, P, [x - 0.2, 3.4 + 3.1 * g, s * 3.6 * g], [x - 0.9, 4.6 + 3.5 * g, s * 4.4 * g], 0.17); if (PC[i] !== tc) K.oct(x + 0.1, 3.65 + 3.85 * g, s * 2.4 * g, 0.24, 0.48, P.l, null, { e: 2 }); }); } });
    // sacos de gás que pulsam nos flancos (entre as placas)
    for (const x of [-3.8, 1.0]) for (const s of S2) V._saco(K, P, [x, 4.6, s * 4.9], [1.2, 1.0, 0.9], ['#8E2234', '#FF5A5A', '#FFD0D0'], { seg: 12, amp: 0.12, speed: 2 + x * 0.1, ph: s + x, up: 0.1, veins: 3 });
    // pescoço, crânio com elmo de quitina, aríete chato de osso com três chifres, presas e olhos
    K.sph(6.6, 3.7, 0, 1, P.b, 'chitin', { sx: 2.0, sy: 2.0, sz: 3.4, seg: 14 });
    K.sph(8.6, 3.3, 0, 1, P.a, 'chitin', { sx: 2.1, sy: 1.7, sz: 2.9, seg: 14 });
    V._placa(K, P, 8.2, 3.7, 0, 2.3, 1.55, 3.15, P.b, -0.35, { seg: 12 });
    K.sph(10.15, 3.3, 0, 1, '#D6C6AE', 'bone', { sx: 0.6, sy: 1.55, sz: 2.65, seg: 12 });
    K.fine(() => { for (const z of [-1.2, 1.2]) K.sph(10.55, 3.3, z, 1, '#C4B39A', 'bone', { sx: 0.25, sy: 1.1, sz: 0.5, seg: 7 }); });
    V._esp(K, P, [10.4, 4.0, 0], [12.2, 5.2, 0], 0.42, '#D6C6AE'); for (const s of S2) V._esp(K, P, [10.5, 3.6, s * 1.6], [12.0, 4.0, s * 2.1], 0.3, '#D6C6AE');
    for (const s of S2) { const t0 = [9.9, 2.0, s * 1.7], t1 = [11.4, 1.6, s * 2.3], t2 = [12.4, 2.7, s * 2.35]; K.seg(t0, t1, 0.55, P.bo, 'bone', { taper: 0.8, seg: 9 }); K.seg(t1, t2, 0.44, P.bo, 'bone', { taper: 0.08, seg: 8 }); K.fine(() => K.sph(t1[0], t1[1], t1[2], 0.44, P.bo, 'bone', { seg: 7 }));
      V._olhos(K, P, 9.35, 4.05, s * 2.35, 1.1, s); }
    // braços-clava (golpe de área): sobem e descem do ombro
    for (const s of S2) K.anim({ t: 'sway', p: [6.2, 3.4, s * 3.5], amp: 0.1, speed: 2.2, ph: s > 0 ? 0 : 1.4 }, () => { const sh = [6.2, 3.4, s * 3.5], el = [7.9, 5.7, s * 5.0], wr = [10.0, 3.5, s * 4.7];
      K.seg(sh, el, 0.75, P.b, 'chitin', { taper: 0.85, seg: 9 }); K.sph(el[0], el[1], el[2], 0.68, P.a, 'chitin', { seg: 9 }); K.seg(el, wr, 0.6, P.b, 'chitin', { taper: 0.8, seg: 9 });
      V._placa(K, P, 7.0, 4.6, s * 4.3, 1.4, 0.7, 0.8, P.a, -0.9, { seg: 9, rx: s * 0.6 });
      K.rock(10.6, 3.2, s * 4.7, 1.55, P.b, 'chitin', { seed: s > 0 ? 3 : 4, amp: 0.16, detail: K.lite ? 0 : 1 });
      const sp = K.q(5); for (let i = 0; i < sp; i++) { const a = i / sp * PI * 2; V._esp(K, P, [10.6 + 1.1 * Math.cos(a), 3.2 + 1.1 * Math.sin(a), s * 4.7], [10.6 + 2.5 * Math.cos(a), 3.2 + 2.5 * Math.sin(a), s * (4.7 + 0.35)], 0.3); } });
    // oito patas-pilar
    [[-5.6, -1.3], [-2.4, -0.5], [0.8, 0.5], [3.8, 1.2]].forEach(([x, dx], i) => { for (const s of S2) V._pata(K, P, [x, 3.0, s * 4.2], [x + dx * 0.45, 5.0, s * 6.1], [x + dx, 2.2, s * 6.85], [x + dx * 1.05, 0, s * 7.0], 2.75, { ph: (s > 0 ? 0 : PI) + (i % 2 ? PI : 0), stride: 13, amp: 0.2 }); });
    K.fine(() => { for (const x of [-4.0, -0.8, 2.3]) for (const s of S2) K.light(x, 2.9, s * 4.55, 0.3, P.l, 2.2); });
    // cauda com esporões
    K.sph(-9.0, 3.6, 0, 1, P.b, 'chitin', { half: true, sx: 1.6, sy: 1.2, sz: 2.4, rz: H * 0.9, seg: 12 });
    V._esp(K, P, [-9.8, 4.4, 0], [-11.0, 5.6, 0], 0.35); for (const s of S2) V._esp(K, P, [-9.9, 3.4, s * 1.1], [-11.0, 3.0, s * 2.2], 0.28); },
  ferroada(K, P, tc) { /* 4.3d — Ferroada: forma própria (não deriva mais do drone) — voadora esguia de asas longas varridas, patas-foice dobradas, abdômen comprido em gomos que bombeia (sway) e ferrão de osso com gota de veneno acesa */
    const V = U.vorag, S2 = [-1, 1];
    K.sph(0.2, 1.5, 0, 1, P.a, 'chitin', { sx: 1.1, sy: 0.82, sz: 0.82, seg: 12 });
    V._placa(K, P, 0.35, 1.72, 0, 0.95, 0.78, 0.78, tc, -0.12, { seg: 11 });
    K.sph(1.55, 1.48, 0, 1, P.b, 'chitin', { sx: 0.6, sy: 0.55, sz: 0.66, seg: 10 });
    for (const s of S2) K.sph(1.7, 1.6, s * 0.4, 1, P.l, null, { e: 1.6, sx: 0.34, sy: 0.42, sz: 0.3, seg: 9 });
    K.fine(() => { for (const s of S2) K.anim({ t: 'sway', p: [1.85, 1.9, s * 0.2], amp: 0.18, speed: 4.5, ph: s > 0 ? 0 : 1 }, () => K.seg([1.85, 1.9, s * 0.2], [2.9, 2.35, s * 0.6], 0.04, P.d, 'chitin', { taper: 0.4, seg: 5 })); });
    // patas-foice dobradas sob a cabeça
    for (const s of S2) K.anim({ t: 'sway', p: [1.0, 1.05, s * 0.42], amp: 0.12, speed: 3, ph: s > 0 ? 0 : 0.8 }, () => { K.seg([1.0, 1.05, s * 0.42], [1.9, 1.3, s * 0.62], 0.11, P.b, 'chitin', { seg: 6 }); K.seg([1.9, 1.3, s * 0.62], [2.45, 0.65, s * 0.55], 0.09, P.bo, 'bone', { taper: 0.1, seg: 5 }); });
    // abdômen comprido (um gomo na cor do time) e ferrão com veneno
    K.anim({ t: 'sway', p: [-0.75, 1.4, 0], amp: 0.12, speed: 4.5 }, () => { K.seg([-0.6, 1.42, 0], [-1.25, 1.35, 0], 0.2, P.d, 'chitin', { seg: 7 });
      const C = f => [-1.45 - f * 3.3, 1.32 - f * f * 0.85, 0], R = f => 0.56 - f * 0.3, cs = [0, 0.34, 0.67, 1].map(C);
      for (let i = 0; i < 3; i++) { K.seg(cs[i], cs[i + 1], R(i / 3), P.b, 'chitin', { taper: R((i + 1) / 3) / R(i / 3), seg: 10 }); if (i) K.sph(cs[i][0], cs[i][1], 0, R(i / 3), P.b, 'chitin', { seg: 8 }); }
      const n = K.q(5); for (let i = 0; i < n; i++) { const f = n > 1 ? i / (n - 1) * 0.92 : 0.4, c = C(f), r = R(f); V._placa(K, P, c[0], c[1] - 0.06, 0, 0.43 * 5 / n, r * 1.18, r * 1.15, i === 1 ? tc : (i % 2 ? P.b : P.a), Math.atan(0.53 * f) - 0.12, { seg: 10 }); }
      K.sph(-4.65, 0.5, 0, 1, '#5E9A22', null, { e: 1, sx: 0.48, sy: 0.38, sz: 0.4, rz: 0.6, seg: 9 });
      K.seg([-4.85, 0.4, 0], [-5.6, -0.05, 0], 0.24, P.bo, 'bone', { taper: 0.55, seg: 7 }); K.seg([-5.6, -0.05, 0], [-6.15, -0.2, 0], 0.13, P.bo, 'bone', { taper: 0.05, seg: 6 });
      K.sph(-6.1, -0.18, 0, 0.17, P.ac, null, { e: 2.4, seg: 6 });
      K.fine(() => { for (const s of S2) V._esp(K, P, [-5.3, 0.2, s * 0.12], [-5.55, 0.42, s * 0.36], 0.06); }); });
    for (const s of S2) { V._asa(K, P, [0.35, 2.0, s * 0.5], 4.3, 1.1, s, { sw: 0.5, dh: 0.1, amp: 0.5, speed: 34 }); V._asa(K, P, [-0.35, 1.92, s * 0.45], 2.6, 0.8, s, { sw: 0.75, dh: 0.05, amp: 0.5, speed: 34, ph: 1.2 }); } },
  /* ---------- 4.3e: tropa da Prole (infantaria, Cria, Cuspidor) e a Matriarca. Ajudantes novos com prefixo _ (dentro do bloco) ---------- */
  /* elipsoide esticado de a até b (coxas, braços, gomos): raio r, o.ext alonga as pontas para cobrir as juntas */
  _ov(K, a, b, r, col, mat, o) { o = o || {}; const d = new T.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), L = d.length() || 0.001, q = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), d.multiplyScalar(1 / L));
    return K.sph((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, 1, col, mat, Object.assign({}, o, { sx: r * (o.kx || 1), sy: L / 2 * (o.ext || 1.12), sz: r * (o.kz || 1), q })); },
  /* espinho barato (pirâmide de 3 ou 4 lados, sem base) de a até b: osso com a base mais escura */
  _pico(K, P, a, b, r, o) { o = o || {}; return K.spike(a, b, r, o.col || P.bo, o.mat || 'bone', { n: o.n || 4, c0: o.c0 || '#A8967E', c1: '#FFFFFF' }); },
  /* casca de quitina (meia esfera) sem a borda escura: placas, élitros e ombreiras das figuras pequenas */
  _casca(K, x, y, z, lx, h, wz, col, rz, o) { o = o || {}; return K.sph(x, y, z, 1, col, o.mat || 'chitin', { half: true, sx: lx, sy: h, sz: wz, rx: o.rx || 0, ry: o.ry || 0, rz, seg: o.seg || 9 }); },
  /* perna digitígrada do soldado (lado s): coxa grossa, canela, tarso e garras de osso; balança do quadril (legSpec). No completo, esporões no joelho e no jarrete */
  _pernaB(K, P, s, o) { o = o || {}; const V = U.vorag, z = s * 0.62, hip = [-0.15, 3.05, z], kn = [0.52, 2.0, z + s * 0.14], ak = [-0.36, 0.85, z + s * 0.2], ft = [0.08, 0.12, z + s * 0.24];
    K.anim(legSpec(hip, { amp: o.amp || 0.42, stride: o.stride || 11, ph: s > 0 ? 0 : PI }), () => {
      if (K.lite) K.seg(hip, kn, 0.33, P.b, 'chitin', { taper: 0.78, seg: 5 }); else V._ov(K, hip, kn, 0.36, P.b, 'chitin', { seg: 8 });
      K.seg(kn, ak, 0.25, P.a, 'chitin', { taper: 0.62, seg: 6 }); K.seg(ak, ft, 0.16, P.d, 'chitin', { taper: 0.75, seg: 5 });
      for (const dz of (K.lite ? [0] : [-0.17, 0.17])) V._pico(K, P, [ft[0] - 0.05, 0.1, ft[2] + dz * 0.4], [ft[0] + 0.72, 0, ft[2] + dz], 0.12, { n: 3 });
      K.fine(() => { V._pico(K, P, [ft[0], 0.12, ft[2]], [ft[0] - 0.45, 0, ft[2]], 0.08, { n: 3 }); V._pico(K, P, [kn[0] + 0.05, kn[1] + 0.12, kn[2]], [kn[0] + 0.34, kn[1] + 0.66, kn[2] + s * 0.12], 0.1); V._pico(K, P, ak, [ak[0] - 0.44, ak[1] - 0.4, ak[2]], 0.09); }); }); },
  /* pata leve de inseto pequeno (Cria, Cuspidor): fêmur bojudo, tíbia fina e tarso em ponta; balança do quadril. Na versão leve, tíbia e tarso viram um espinho só */
  _patinha(K, P, hip, knee, ank, foot, w, o) { o = o || {}; const sp = { amp: o.amp || 0.36, stride: o.stride || 6 }; if (o.ph != null) sp.ph = o.ph; const s = hip[2] >= 0 ? 1 : -1, V = U.vorag;
    K.anim(legSpec(hip, sp), () => { if (K.lite) { K.seg(hip, knee, 0.16 * w, P.b, 'chitin', { taper: 0.7, seg: 5 }); V._pico(K, P, knee, foot, 0.12 * w, { col: P.a, mat: 'chitin', c0: '#FFFFFF' }); return; }
      V._ov(K, hip, knee, 0.19 * w, P.b, 'chitin', { seg: 7 }); K.seg(knee, ank, 0.12 * w, P.a, 'chitin', { taper: 0.6, seg: 5 }); V._pico(K, P, ank, foot, 0.075 * w, { col: P.d, mat: 'chitin', c0: '#FFFFFF' });
      V._pico(K, P, knee, [knee[0] - 0.08 * w, knee[1] + 0.42 * w, knee[2] + s * 0.14 * w], 0.06 * w); }); },
  cria(K, P, tc) { /* 4.3e — Cria: caçadora do enxame — seis patas altas e finas em arco (joelhos acima do corpo), duas foices de osso erguidas que golpeiam, mandíbulas grandes que mastigam, dorso em placas na cor do time e abdômen em gomos com ferrão */
    const V = U.vorag, S2 = [-1, 1];
    K.sph(-1.05, 1.85, 0, 1, P.a, 'chitin', { sx: 1.22, sy: 0.8, sz: 0.95, rz: 0.12, seg: 10 });
    [[-0.45, 2.15, 0.55, 0.6, 0.94, tc, 0.15], [-1.15, 2.08, 0.52, 0.56, 0.9, tc, 0.25], [-1.82, 1.9, 0.42, 0.46, 0.66, P.b, 0.45]].forEach(([x, y, lx, h, wz, c, rz], i) => { if (i < 2 || !K.lite) V._casca(K, x, y, 0, lx, h, wz, c, rz, { seg: 8 }); });
    V._pico(K, P, [-2.1, 1.8, 0], [-2.45, 2.12, 0], 0.14);
    K.sph(0.5, 2.0, 0, 1, P.b, 'chitin', { sx: 0.8, sy: 0.62, sz: 0.68, seg: 8 }); V._casca(K, 0.5, 2.22, 0, 0.74, 0.45, 0.66, tc, -0.1, { seg: 8 });
    K.sph(1.38, 1.85, 0, 1, P.a, 'chitin', { sx: 0.6, sy: 0.5, sz: 0.56, rz: -0.25, seg: 8 });
    K.fine(() => { V._casca(K, 1.3, 1.98, 0, 0.55, 0.34, 0.5, P.b, -0.4, { seg: 7 }); for (const s of S2) V._pico(K, P, [1.15, 2.25, s * 0.2], [0.65, 2.75, s * 0.32], 0.08); });
    for (const s of S2) { K.oct(1.72, 1.85, s * 0.3, 0.13, 0.24, P.l, null, { e: 2, ry: PI / 4 });
      K.anim({ t: 'sway', p: [1.72, 1.6, s * 0.26], amp: 0.22, speed: 9, ph: s > 0 ? 0 : PI }, () => { const m = [2.18, 1.55, s * 0.6]; if (K.lite) V._pico(K, P, [1.72, 1.6, s * 0.26], [2.55, 1.5, s * 0.2], 0.12, { n: 3 }); else { K.seg([1.72, 1.6, s * 0.26], m, 0.1, P.bo, 'bone', { seg: 5 }); V._pico(K, P, m, [2.6, 1.48, s * 0.14], 0.1, { n: 3 }); } }); }
    /* foices de osso erguidas (golpe: sway no ombro) */
    for (const s of S2) K.anim({ t: 'sway', p: [0.95, 2.15, s * 0.42], amp: 0.22, speed: 7, ph: s > 0 ? 0 : 1.7 }, () => { const sh = [0.95, 2.15, s * 0.42], el = [1.35, 3.05, s * 0.82], tp = [2.3, 2.25, s * 0.72];
      if (K.lite) K.seg(sh, el, 0.12, P.b, 'chitin', { seg: 5 }); else V._ov(K, sh, el, 0.13, P.b, 'chitin', { seg: 6 }); V._pico(K, P, el, tp, 0.12);
      K.fine(() => { for (let i = 0; i < 2; i++) { const f = 0.3 + i * 0.3, b = [el[0] + (tp[0] - el[0]) * f, el[1] + (tp[1] - el[1]) * f, el[2] + (tp[2] - el[2]) * f]; V._pico(K, P, b, [b[0] - 0.12, b[1] - 0.25, b[2]], 0.04, { n: 3 }); } }); });
    /* seis patas altas (tripé alternado) */
    [[0.7, 0.85], [0.1, 0.1], [-0.55, -0.8]].forEach(([x, dx], i) => { for (const s of S2) V._patinha(K, P, [x, 1.75, s * 0.46], [x + dx * 0.4, 2.9, s * 1.38], [x + dx * 0.9, 1.0, s * 1.98], [x + dx * 1.05, 0, s * 2.14], 1.05, { ph: (s > 0 ? 0 : PI) + (i % 2 ? PI : 0), stride: 9, amp: 0.4 }); }); },
  cuspidor(K, P, tc) { /* 4.3e — Cuspidor: artilheiro de ácido com forma própria — seis patas, saco de ácido enorme erguido sobre as costas (membrana lima acesa, miolo que pulsa, veias) preso por faixas de quitina na cor do time, dorso na cor do time, pescoço de carne e tromba de osso que recua no disparo, com a boca acesa */
    const V = U.vorag, S2 = [-1, 1], SC = [-1.05, 3.4, 0], SA = [1.1, 1.2, 1.0];
    K.sph(0.25, 1.75, 0, 1, P.a, 'chitin', { sx: 1.3, sy: 0.72, sz: 0.92, seg: 10 });
    V._casca(K, 0.6, 2.05, 0, 0.75, 0.5, 0.82, tc, -0.12, { seg: 9 }); V._casca(K, -0.35, 2.05, 0, 0.6, 0.48, 0.8, tc, 0.1, { seg: 9 });
    K.seg([-0.55, 1.9, 0], [-0.95, 2.45, 0], 0.4, P.d, 'chitin', { seg: 7 });
    /* saco de ácido: membrana lima acesa, miolo que pulsa (bob), reflexo e, no completo, veias escuras */
    K.sph(SC[0], SC[1], SC[2], 1, '#8CB02C', null, { e: 1.08, sx: SA[0], sy: SA[1], sz: SA[2], seg: 12, shade: 0.75 });
    K.anim({ t: 'bob', amp: 0.1, speed: 2.4 }, () => { const ci = [SC[0] + 0.04, SC[1] + 0.2, 0], ai = [SA[0] * 0.86, SA[1] * 0.88, SA[2] * 0.84];
      K.sph(ci[0], ci[1], ci[2], 1, '#D2F25A', null, { e: 1.15, sx: ai[0], sy: ai[1], sz: ai[2], seg: 10, shade: 0.35 });
      K.fine(() => { K.sph(ci[0] + ai[0] * 0.18, ci[1] + ai[1] * 0.94, 0, 1, '#F6FFC4', null, { e: 1.16, sx: ai[0] * 0.32, sy: ai[1] * 0.1, sz: ai[2] * 0.3, seg: 8 });
        for (let i = 0; i < 3; i++) { const u = i / 3 * PI * 2 + 0.4; K.tube([V._el(ci, ai, u, 0.2, 0.01), V._el(ci, ai, u + 0.2, 0.5, 0.02), V._el(ci, ai, u + 0.05, 0.8, 0.02)], 0.04, '#2E3A0C', 'wet', { ts: 6, rs: 4 }); } }); });
    K.fine(() => { for (const [u, v, r] of [[0.6, 1.2, 0.16], [2.3, 1.0, 0.13], [-1.2, 1.35, 0.15], [-2.6, 0.9, 0.12], [PI * 0.8, 1.1, 0.14]]) { const p = V._el(SC, SA, u, v, -0.05); K.sph(p[0], p[1], p[2], r, '#F2FF9E', null, { e: 1.6, seg: 5 }); } });
    for (const xb of [-0.55, -1.45]) { const g = Math.sqrt(1 - ((xb - SC[0]) / SA[0]) ** 2); arch(K, xb, SC[1] - 0.15, 0, 0, SA[1] * g + 0.1, SA[2] * g + 0.1, H, 0.13, tc, 'chitin', { ts: 12, rs: 5 }); }
    K.fine(() => { for (let i = 0; i < 3; i++) { const x = SC[0] + 0.55 - i * 0.55, y = SC[1] + SA[1] * Math.sqrt(1 - ((x - SC[0]) / SA[0]) ** 2); V._pico(K, P, [x, y - 0.05, 0], [x - 0.35, y + 0.45, 0], 0.08); } });
    /* pescoço, cabeça e tromba que recua */
    K.seg([1.4, 1.9, 0], [1.95, 2.45, 0], 0.3, P.m, 'wet', { taper: 0.8, seg: 7 });
    K.sph(2.1, 2.5, 0, 1, P.b, 'chitin', { sx: 0.52, sy: 0.44, sz: 0.48, seg: 8 }); K.fine(() => V._casca(K, 2.05, 2.62, 0, 0.5, 0.3, 0.46, P.a, -0.3, { seg: 7 }));
    for (const s of S2) { K.oct(2.4, 2.5, s * 0.3, 0.12, 0.22, P.l, null, { e: 2, ry: PI / 4 });
      K.anim({ t: 'sway', p: [2.35, 2.3, s * 0.2], amp: 0.2, speed: 6, ph: s > 0 ? 0 : PI }, () => V._pico(K, P, [2.35, 2.3, s * 0.2], [2.95, 2.18, s * 0.08], 0.07, { n: 3 })); }
    K.anim({ t: 'recoil', dist: 0.45 }, () => { K.seg([2.3, 2.55, 0], [3.35, 2.78, 0], 0.19, P.bo, 'bone', { taper: 0.75, seg: 7 });
      for (let i = 0; i < (K.lite ? 1 : 2); i++) K.cyl(2.6 + i * 0.38, 2.6 + i * 0.08, 0, 0.24, 0.24, 0.12, P.b, 'chitin', { rz: -H + 0.2, seg: 8 });
      K.cyl(3.25, 2.78, 0, 0.26, 0.17, 0.2, P.m, 'wet', { rz: -H + 0.2, seg: 8 }); if (K.lite) K.oct(3.5, 2.7, 0, 0.15, 0.26, P.ac, null, { e: 2.4 }); else K.sph(3.5, 2.83, 0, 0.15, P.ac, null, { e: 2.4, seg: 6 }); });
    [[0.9, 0.75], [0.2, 0.05], [-0.5, -0.7]].forEach(([x, dx], i) => { for (const s of S2) V._patinha(K, P, [x, 1.6, s * 0.55], [x + dx * 0.4, 2.7, s * 1.5], [x + dx * 0.9, 0.95, s * 2.05], [x + dx * 1.05, 0, s * 2.2], 1.15, { ph: (s > 0 ? 0 : PI) + (i % 2 ? PI : 0), stride: 9, amp: 0.34 }); }); },
  matriarca(K, P, tc) { /* 4.3e — Matriarca: rainha da Prole — abdômen enorme de membrana com tergitos na cor do time, fileiras de ovos com embrião aceso, veias acesas, sacos que pulsam nos flancos e ovipositor que balança; tórax erguido com placas, crânio com máscara de osso e coroa de espinhos sobre faixa na cor do time, olhos acesos, mandíbulas em foice, antenas, duas foices enormes erguidas, bracinhos que chocam um ovo, asas vestigiais que batem devagar, oito patas e o morteiro de ovos nas costas que recua */
    const V = U.vorag, S2 = [-1, 1], AC = [-9.5, 6.4, 0], AA = [8.6, 5.0, 6.2], TC = [2.5, 9.9, 0], HC = [6.7, 14.6, 0], MB = '#B86A74', OV = '#F6D2C8', BN = '#C9B89C';
    const top = (x, z) => AC[1] + AA[1] * Math.sqrt(Math.max(0, 1 - ((x - AC[0]) / AA[0]) ** 2 - (z / AA[2]) ** 2)), lerp = (a, b, f) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
    /* abdômen: membrana, ventre escuro e seis tergitos (três na cor do time) com esporões nas bordas */
    K.sph(AC[0], AC[1], AC[2], 1, MB, 'wet', { sx: AA[0], sy: AA[1], sz: AA[2], seg: 24 });
    K.sph(AC[0] + 0.4, AC[1] - 1.9, 0, 1, P.a, 'chitin', { sx: AA[0] * 0.92, sy: AA[1] * 0.62, sz: AA[2] * 0.9, seg: 16 });
    const TX = [-2.6, -5.15, -7.7, -10.25, -12.8, -15.35], TCOL = [P.b, tc, P.a, tc, P.b, tc];
    TX.forEach((x, i) => { const g = Math.sqrt(1 - ((x - AC[0]) / AA[0]) ** 2); V._placa(K, P, x, AC[1] + AA[1] * g * 0.6, 0, 0.98, AA[1] * g * 0.5, AA[2] * g * 1.0, TCOL[i], 0.04 * (i - 2), { seg: 14 });
      K.fine(() => { for (const s of S2) V._pico(K, P, [x - 0.1, AC[1] + AA[1] * g * 0.64, s * AA[2] * g * 0.94], [x - 0.8, AC[1] + AA[1] * g * 0.58, s * (AA[2] * g + 1.1)], 0.22, { n: 5 }); }); });
    /* ovos acesos (pulsam): fileiras de ovos compridos nos vãos entre os tergitos (vista de cima) e um cacho saindo pelo ovipositor; veias acesas nos flancos */
    const ovo = (p, k, ry) => { K.sph(p[0], p[1], p[2], 1, OV, null, { e: 1.05, shade: 0.55, sx: 0.5 * k, sy: 0.42 * k, sz: 0.82 * k, ry: ry || 0, seg: 8 }); K.fine(() => K.sph(p[0], p[1] + 0.3 * k, p[2], 0.15 * k, P.l, null, { e: 1.9, seg: 5 })); }; /* ovo comprido aceso (sombreado assado) e, no completo, o embrião vermelho */
    K.anim({ t: 'bob', amp: 0.06, speed: 1.6 }, () => {
      for (let j = 0; j < 5; j++) { const x = (TX[j] + TX[j + 1]) / 2, g = Math.sqrt(1 - ((x - AC[0]) / AA[0]) ** 2), nz = K.lite ? 2 : 4; for (let k = 0; k < nz; k++) { const zz = (k / (nz - 1) - 0.5) * AA[2] * 1.1 * g; ovo([x, top(x, zz) - 0.28, zz], 1.15 * (K.lite ? 1.3 : 1), zz * 0.05); } }
      const nv = K.q(8); for (let i = 0; i < nv; i++) { const s = i % 2 ? 1 : -1, u = s * (0.6 + (i >> 1) * 0.55); K.tube([V._el(AC, AA, u, 0.55, 0.02), V._el(AC, AA, u + s * 0.12, 0.95, 0.04), V._el(AC, AA, u - s * 0.05, 1.45, 0.04), V._el(AC, AA, u + s * 0.1, 2.0, 0.02)], 0.09, '#FF4A5E', null, { e: 1.5, ts: 8, rs: 4 }); } });
    for (const s of S2) for (const [u, k] of [[1.35, 1], [2.25, 0.85]]) V._saco(K, P, V._el(AC, AA, s * u, 2.0, 0.15), [1.15 * k, 0.95 * k, 0.8 * k], ['#8E2234', '#FF5A5A', '#FFD0D0'], { seg: 12, amp: 0.12, speed: 1.8 + u * 0.2, ph: s + u, up: 0.1, veins: 3 });
    /* ovipositor na ponta do abdômen (balança) */
    K.anim({ t: 'sway', p: [AC[0] - AA[0] + 0.8, AC[1] - 0.6, 0], amp: 0.08, speed: 1.3 }, () => { const a = [AC[0] - AA[0] + 0.8, AC[1] - 0.6, 0], b = [AC[0] - AA[0] - 0.9, AC[1] - 3.1, 0];
      K.seg(a, b, 1.15, P.m, 'wet', { taper: 0.62, seg: 12 }); K.tor(b[0] - 0.05, b[1] + 0.02, 0, 0.72, 0.2, P.d, 'wet', { rz: -0.8, ts: 14, rs: 5 }); K.sph(b[0] - 0.12, b[1] - 0.06, 0, 0.55, P.l, null, { e: 1.8, seg: 8 }); for (const [dx, dy, dz] of (K.lite ? [[0.3, -1.05, 0]] : [[0.3, -1.05, 0], [0.75, -1.2, 0.62], [0.7, -1.15, -0.6]])) K.sph(b[0] + dx, b[1] + dy, dz, 1, OV, null, { e: 1.05, shade: 0.55, sx: 0.62, sy: 0.55, sz: 0.55, seg: 8 });
      K.fine(() => { for (let i = 0; i < 4; i++) { const an = i / 4 * PI * 2 + 0.4; V._pico(K, P, [b[0] + 0.45, b[1] + 0.45 + 0.7 * Math.cos(an), 0.7 * Math.sin(an)], [b[0] - 0.3, b[1] + 0.2 + 1.3 * Math.cos(an), 1.3 * Math.sin(an)], 0.16); } }); });
    /* pecíolo, tórax erguido, placas do dorso (a de cima na cor do time), plastrão de osso em faixas e espiráculos acesos */
    K.seg([-1.4, 6.6, 0], [0.2, 7.9, 0], 1.3, P.d, 'chitin', { seg: 12 }); K.fine(() => K.tor(-0.6, 7.25, 0, 1.35, 0.22, BN, 'bone', { rz: -0.68, ts: 18, rs: 5 }));
    K.sph(TC[0], TC[1], TC[2], 1, P.a, 'chitin', { sx: 3.1, sy: 4.4, sz: 3.6, rz: -0.32, seg: 18 });
    V._placa(K, P, 0.9, 11.8, 0, 2.3, 1.4, 3.2, tc, 0.5, { seg: 14 }); V._placa(K, P, -0.4, 9.4, 0, 2.1, 1.25, 3.3, P.b, 0.9, { seg: 12 }); V._placa(K, P, 2.9, 13.4, 0, 1.6, 1.0, 2.5, P.b, 0.15, { seg: 12 });
    K.sph(4.6, 8.9, 0, 1, '#9A5C62', 'chitin', { sx: 1.1, sy: 2.9, sz: 2.5, rz: -0.32, seg: 12 }); /* plastrão de carne escura em faixas: o osso fica para a máscara */
    K.fine(() => { for (let i = 0; i < 4; i++) K.sph(5.35 - i * 0.36, 7.0 + i * 1.05, 0, 1, P.b, 'chitin', { sx: 0.42, sy: 0.16, sz: 2.05 - i * 0.12, rz: -0.32, seg: 8 });
      for (const s of S2) for (let i = 0; i < 3; i++) { V._pico(K, P, [1.4 - i * 1.1, 10.6 - i * 0.65, s * 3.25], [0.6 - i * 1.1, 11.6 - i * 0.55, s * 4.4], 0.26, { n: 5 }); K.light(2.8 - i * 1.2, 8.0 + i * 0.45, s * 3.4, 0.28, P.l, 2.2); } });
    /* asas vestigiais de membrana (batem devagar) */
    for (const s of S2) V._asa(K, P, [0.2, 13.0, s * 1.8], 4.6, 1.7, s, { sw: 1.1, dh: 0.35, amp: 0.1, speed: 2.6, col: '#D88A98' });
    /* morteiro de ovos nas costas: bulbo de carne e tubo de quitina que recua, boca de ácido acesa */
    K.sph(-0.2, 12.9, 0, 1, P.m, 'wet', { sx: 1.35, sy: 1.1, sz: 1.35, seg: 12 });
    K.anim({ t: 'recoil', dist: 0.9 }, () => { K.seg([-0.1, 13.4, 0], [1.3, 16.8, 0], 0.82, P.b, 'chitin', { taper: 0.82, seg: 12 });
      for (let i = 0; i < K.q(3); i++) { const f = 0.3 + i * 0.25; K.tor(-0.1 + 1.4 * f, 13.4 + 3.4 * f, 0, 0.84 - f * 0.12, 0.17, P.d, 'chitin', { rz: -0.39, ts: 14, rs: 5 }); }
      K.tor(1.32, 16.85, 0, 0.66, 0.24, P.m, 'wet', { rz: -0.39, ts: 14, rs: 6 }); K.sph(1.32, 16.8, 0, 0.5, P.ac, null, { e: 2.2, seg: 9 }); });
    /* pescoço e cabeça: máscara de osso, olhos acesos, mandíbulas em foice, antenas que se curvam para a frente */
    K.seg([3.9, 12.6, 0], [5.9, 14.0, 0], 1.4, P.d, 'chitin', { seg: 12 });
    K.sph(HC[0], HC[1], HC[2], 1, P.a, 'chitin', { sx: 2.2, sy: 1.8, sz: 2.1, rz: -0.22, seg: 16 });
    V._placa(K, P, HC[0] + 1.5, HC[1] - 0.35, 0, 1.55, 0.85, 1.65, '#BFAE92', -H + 0.35, { seg: 12, mat: 'bone' });
    for (const s of S2) { K.sph(HC[0] + 1.45, HC[1] + 0.35, s * 1.45, 1, P.l, null, { e: 1.8, sx: 0.52, sy: 0.64, sz: 0.46, rz: -0.3, seg: 9 }); V._mand(K, P, HC[0] + 1.8, HC[1] - 1.15, s * 0.64, 1.3, s, { ry: 0.32, amp: 0.1, speed: 2.4 }); }
    K.fine(() => { for (const [dx, dy, dz] of [[1.6, 1.05, 0], [1.35, 1.28, 0.44], [1.35, 1.28, -0.44]]) K.oct(HC[0] + dx, HC[1] + dy, dz, 0.16, 0.3, P.l, null, { e: 2 }); });
    for (const s of S2) K.anim({ t: 'sway', p: [HC[0] + 1.2, HC[1] + 1.2, s * 0.55], amp: 0.12, speed: 1.8, ph: s > 0 ? 0 : 1.4 }, () => { const a = [HC[0] + 1.2, HC[1] + 1.2, s * 0.55], b = [HC[0] + 2.7, HC[1] + 2.7, s * 1.5], c = [HC[0] + 4.3, HC[1] + 3.1, s * 2.4];
      K.seg(a, b, 0.18, P.d, 'chitin', { taper: 0.8, seg: 6 }); K.seg(b, c, 0.14, P.d, 'chitin', { taper: 0.35, seg: 6 }); });
    /* coroa de espinhos sobre uma faixa na cor do time; pontas acesas no completo */
    K.tor(HC[0] - 0.45, HC[1] + 1.15, 0, 1.75, 0.38, tc, 'chitin', { rz: -0.35, ts: 22, rs: 6 });
    { const n = K.q(7); for (let i = 0; i < n; i++) { const a = PI * (0.32 + 1.36 * i / (n - 1)), ca = Math.cos(a), sa = Math.sin(a), b = [HC[0] - 0.45 + 1.66 * ca, HC[1] + 1.05 - 0.55 * ca + 0.1, 1.66 * sa], L = i % 2 ? 2.8 : 4.2, t = [b[0] + ca * 0.75 * L - 0.35 * L, b[1] + 0.92 * L, b[2] + sa * 0.55 * L];
      V._esp(K, P, b, t, 0.44 * (i % 2 ? 0.8 : 1)); K.fine(() => K.sph(t[0], t[1], t[2], 0.14, P.l, null, { e: 2.2, seg: 5 })); } }
    /* foices enormes erguidas (sway no ombro) com placa na cor do time no antebraço e serrilha de osso */
    for (const s of S2) K.anim({ t: 'sway', p: [4.3, 11.3, s * 2.7], amp: 0.07, speed: 1.4, ph: s > 0 ? 0 : 1.9 }, () => { const sh = [4.3, 11.3, s * 2.7], el = [5.6, 16.1, s * 5.5], wr = [9.1, 14.5, s * 6.3], m = [10.7, 13.1, s * 6.2], tp = [11.7, 10.6, s * 5.7];
      V._ov(K, sh, el, 0.8, P.b, 'chitin', { seg: 10 }); K.sph(el[0], el[1], el[2], 0.68, P.a, 'chitin', { seg: 9 }); V._ov(K, el, wr, 0.64, P.a, 'chitin', { seg: 10 });
      V._placa(K, P, 7.35, 15.55, s * 5.95, 1.45, 0.45, 0.64, tc, -0.55, { seg: 9, rx: s * 0.35 });
      K.seg(wr, m, 0.52, P.bo, 'bone', { taper: 0.72, seg: 8 }); K.seg(m, tp, 0.38, P.bo, 'bone', { taper: 0.04, seg: 8 }); K.sph(wr[0], wr[1], wr[2], 0.52, P.bo, 'bone', { seg: 8 });
      K.fine(() => { for (let i = 0; i < 4; i++) { const f = 0.15 + i * 0.22, b = f < 0.5 ? lerp(wr, m, f * 2) : lerp(m, tp, f * 2 - 1); V._pico(K, P, b, [b[0] - 0.7, b[1] - 0.35, b[2] - s * 0.15], 0.12, { n: 3 }); } }); });
    /* bracinhos que chocam um ovo aceso diante do peito (só no completo) */
    K.fine(() => { for (const s of S2) { K.seg([4.7, 8.2, s * 1.5], [6.0, 7.3, s * 1.8], 0.28, P.b, 'chitin', { seg: 6 }); K.seg([6.0, 7.3, s * 1.8], [6.8, 7.9, s * 0.75], 0.22, P.a, 'chitin', { taper: 0.6, seg: 6 }); }
      K.sph(7.05, 8.1, 0, 1, OV, 'wet', { sx: 0.95, sy: 1.15, sz: 0.85, seg: 10 }); K.sph(7.3, 8.5, 0, 0.42, P.l, null, { e: 1.6, seg: 6 }); });
    /* oito patas longas em arco (tripé alternado, passada pesada) */
    [[3.4, 7.8, 2.8], [1.4, 7.2, 0.9], [-0.8, 6.7, -1.0], [-3.2, 6.1, -2.8]].forEach(([x, y, dx], i) => { for (const s of S2) V._pata(K, P, [x, y, s * 2.5], [x + dx * 0.45, 11.4, s * 8.2], [x + dx, 4.3, s * 11.2], [x + dx * 1.08, 0, s * 12.0], 2.9, { ph: (s > 0 ? 0 : PI) + (i % 2 ? PI : 0), stride: 16, amp: 0.15 }); }); },
};

// ---------- cenário neutro: nós de recurso, rochas, ruínas, caixas, carcaças e adereços de território ----------
// 4.3b: paletas das rochas por semente (cinza quente a marrom); cada peça embaralha as cores entre os estratos
const ROCK_BASE = ['#7D746A', '#8C8276', '#6B635B', '#857A6D', '#5F5851', '#94897B'], ROCK_TINT = [[0, 0, 0], [0.006, 0.05, -0.01], [0.01, -0.06, 0.03], [-0.012, 0.06, -0.01], [0, -0.04, -0.035], [0.018, 0.07, 0.01]];
function rockPal(v) { const t = ROCK_TINT[v % 6]; return ROCK_BASE.map(c => new T.Color(c).offsetHSL(t[0], t[1], t[2])); } // 4.3b: estratos variam dentro da peça; entre sementes só um leve matiz
function shuf(a, r) { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = b[i]; b[i] = b[j]; b[j] = t; } return b; }
// 4.3b: blocos caídos encostados no pé de uma rocha, meio enterrados; o.depth = raiz (no monte das cordilheiras o pé desce a encosta e nada flutua)
function talus(K, r, cx, cz, R, n, sz, pal, o) { o = o || {};
  for (let i = 0; i < n; i++) { const a = r() * PI * 2, dd = R * ((o.near == null ? 0.84 : o.near) + r() * 0.16), s = sz * (0.6 + r() * 0.6);
    K.crag(cx + Math.cos(a) * dd, (o.y || 0) - s * (0.12 + r() * 0.22), cz + Math.sin(a) * dd, s * (1 + r() * 0.5), s * (0.6 + r() * 0.45), s * (0.8 + r() * 0.4), pal[i % pal.length], o.mat || 'rock',
      { seed: (o.seed | 0) * 17 + i, n: 5 + (r() * 3 | 0), strata: 0, sq: 2.6 + r() * 3, rough: 0.16, jit: 0.07, tilt: 0.25, cuts: 1, flare: 0.04, fis: 0, sink: o.depth || s * 0.9, sinkFlare: o.depth ? 0.06 : 0.1, cols: [pal[i % pal.length], pal[(i + 1) % pal.length]], dust: o.dust, dustK: 0.14, dark: 0.3, ry: r() * PI, rx: (r() - 0.5) * (o.depth ? 0.1 : 0.28), rz: (r() - 0.5) * (o.depth ? 0.1 : 0.28) }); } } /* raiz quase reta e pouco inclinada: a raiz torta e alargada furava o chão em lascas finas ao lado da rocha */
// 4.3b: aglomerado de cristais: o maior no centro e menores tombando para fora (o.dir = cresce para fora de uma fenda); acesos e de vidro alternados
function cluster(K, r, x, y, z, n, H, col, glass, o) { o = o || {};
  for (let i = 0; i < n; i++) { const big = i === 0, a = o.dir ? Math.atan2(o.dir[1], o.dir[0]) + (r() - 0.5) * 2 : r() * PI * 2, lean = big ? (o.dir ? 0.42 : 0.06) + r() * 0.12 : (o.lean == null ? 0.42 : o.lean) + r() * 0.35;
    const hh = H * (big ? 1 : 0.36 + r() * 0.5), rr = hh * (o.fat || 0.17) * (0.85 + r() * 0.3), off = big ? 0 : H * 0.13 * (0.4 + r()), px = x + Math.cos(a) * off, pz = z + Math.sin(a) * off, rx = Math.sin(a) * lean, rz = -Math.cos(a) * lean;
    if ((big && o.emitK !== 0) || r() < (o.emitK == null ? 0.55 : o.emitK)) K.xtal(px, y, pz, rr, hh, col, null, { seed: (o.seed | 0) + i * 7, e: (o.e || 1.9) * (0.85 + r() * 0.3), shade: 0.5, rx, rz, glow: 0.5 });
    else K.xtal(px, y, pz, rr * 1.05, hh * 0.9, glass, 'crystal', { seed: (o.seed | 0) + i * 7 + 3, rx, rz, glow: 0.35 }); } }
// 4.3b: veio aceso ao longo de uma fenda (K.fis): do pé ao topo, um pouco para fora da parede
function vein(K, f, col, e, rad, k) { k = k == null ? 1 : k; const out = (p, d) => [p[0] + f.n[0] * d, p[1], p[2] + f.n[1] * d]; const a = out(f.a, 0.04), b = out([f.a[0] + (f.b[0] - f.a[0]) * k, f.a[1] + (f.b[1] - f.a[1]) * k, f.a[2] + (f.b[2] - f.a[2]) * k], 0.06);
  const m = [(a[0] + b[0]) / 2 + f.n[0] * 0.1, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2 + f.n[1] * 0.1]; a[1] += 0.15; K.seg(a, m, rad, col, null, { e, seg: 5 }); K.seg(m, b, rad * 0.75, col, null, { e: e * 0.9, seg: 5 }); }
// 4.3b: ruínas — pilar em tambores (o.broken: topo partido), muro de blocos em fiadas com borda quebrada, entulho de pedra cortada
function pillar(K, r, x, z, rad, h, pal, o) { o = o || {}; const dh = rad * 1.5; let y = -0.45;
  K.box(x, y, z, rad * 2.7, 0.8, rad * 2.7, pal[3], 'stone', { ry: r() * 0.4 }); y += 0.8; const n = Math.max(1, Math.round(h / dh));
  for (let i = 0; i < n; i++) { const ox = (r() - 0.5) * 0.1 * rad + (o.lean || 0) * y, oz = (r() - 0.5) * 0.1 * rad;
    if (i === n - 1 && o.broken) K.crag(x + ox, y - 0.02, z + oz, rad * 2, dh * (0.8 + r() * 0.6), rad * 2, pal[i % pal.length], 'stone', { seed: (o.seed | 0) * 7 + i, n: 10, sq: 2, rough: 0.03, jit: 0.03, strata: 0, taper: 0.97, flare: 0, top: 'jag', tilt: 0.25, cuts: 1, fis: 1, cols: [pal[i % pal.length]], dust: '#B8B09E', dustK: 0.3, dark: 0.15 });
    else K.cyl(x + ox, y, z + oz, rad * 0.96, rad, dh * 0.97, pal[(i % 2) * 2], 'stone', { seg: 10, facet: true, ry: r() }); y += dh; }
  if (!o.broken) K.box(x + (o.lean || 0) * y, y, z, rad * 2.6, 0.5, rad * 2.6, pal[1], 'stone', { ry: r() * 0.2 }); return y; }
function wall(K, r, x, z, len, h, th, ang, pal, o) { o = o || {}; const bh = 0.8, rows = Math.max(1, Math.round(h / bh)), ca = Math.cos(ang), sa = Math.sin(ang), y0 = o.y == null ? -0.35 : o.y, cut = 0.45 + r() * 0.4;
  for (let k = 0; k < rows; k++) { const nb = Math.max(1, Math.round(len / (1.5 + r() * 0.3))), bl = len / nb, off = k % 2 ? bl * 0.5 : 0, keep = k < 2 ? len : len * (1 - (k - 1) / rows * cut * 1.6);
    for (let i = 0; i <= nb; i++) { let s0 = -len / 2 + i * bl - off, s1 = s0 + bl; s0 = Math.max(s0, -len / 2); s1 = Math.min(s1, len / 2); const sc = (s0 + s1) / 2, yy = y0 + k * bh;
      if (s1 - s0 < 0.3 || s1 > -len / 2 + keep + 0.01 || (k > 0 && r() < 0.07) || (o.win && sc > o.win[0] && sc < o.win[1] && yy > o.win[2] && yy < o.win[3])) continue;
      K.box(x + ca * sc, yy, z - sa * sc, (s1 - s0) * 0.96, bh * 0.94, th * (0.9 + r() * 0.12), pal[(i + k * 2) % pal.length], 'stone', { ry: ang + (r() - 0.5) * 0.06, rz: (r() - 0.5) * 0.04 }); } } }
function rubble(K, r, cx, cz, R, n, sz, pal, o) { o = o || {};
  for (let i = 0; i < n; i++) { const a = r() * PI * 2, d = R * Math.sqrt(0.15 + r() * 0.85), s = sz * (0.5 + r() * 0.7);
    K.crag(cx + Math.cos(a) * d, -s * 0.3, cz + Math.sin(a) * d, s * (1.1 + r() * 0.6), s * 0.75, s, pal[i % pal.length], 'stone', { seed: (o.seed | 0) * 13 + i, n: 4 + (r() * 2 | 0), sq: 2.5 + r() * 2, rough: 0.18, jit: 0.12, chip: 0.15, strata: 0, taper: 0.85, flare: 0.02, tilt: 0.3, cuts: 1, fis: 0, cols: [pal[i % pal.length]], dust: '#B8B09E', dustK: 0.25, dark: 0.25, ry: r() * PI, rx: (r() - 0.5) * 0.5, rz: (r() - 0.5) * 0.5 }); } }
const NEUTRAL = {
  // 4.3b: Plasma = colunas de basalto sobre plataforma vulcânica, poças e fissuras de plasma incandescente, alguns cristais violeta/laranja (leitura quente)
  plasma(K, seed) { const r = rng(seed * 7 + 3), HOT = '#FF7A45', LAVA = '#FF5A1F', HOT2 = '#FF8A3D', VIO = '#C55CFF'; K.base = 0; const pal = ['#2F2A2B', '#3B3436', '#262123', '#433B3C', '#1F1B1C'], ash = '#6A6260';
    const pw = 12 + r() * 1.2, pd = 10.4 + r() * 1.2, ph = 1.7 + r() * 0.5;
    K.crag(0, 0, 0, pw, ph, pd, pal[0], 'rock', { seed: seed * 13, n: 18, strata: 2, cols: pal, dust: ash, dustK: 0.22, tilt: 0.05, sink: 1.6, fis: 4, cuts: 2, ledge: 0.14, dark: 0.5, rough: 0.16 }); const F = K.fis;
    const cx = (r() - 0.5) * 1.6, cz = (r() - 0.5) * 1.6, nC = 10 + (r() * 3 | 0);
    for (let i = 0; i < nC; i++) { const ring = i === 0 ? 0 : i < 7 ? 1 : 2, a = (i - 1) / 6 * PI * 2 + (ring === 2 ? 0.5 : 0) + (r() - 0.5) * 0.25, d = ring * 1.5 + (r() - 0.5) * 0.2;
      const hh = (ring === 0 ? 5.4 : ring === 1 ? 3.1 + r() * 2.2 : 2 + r() * 1.4) * (r() < 0.22 ? 0.6 : 1);
      K.crag(cx + Math.cos(a) * d, ph - 0.6, cz + Math.sin(a) * d, 1.58, hh, 1.58, pal[i % 5], 'rock', { seed: seed * 31 + i, n: 6, sq: 2, rough: 0.03, jit: 0.025, strata: 0, taper: 0.95, flare: 0, tilt: 0.14, cuts: r() < 0.3 ? 1 : 0, fis: 0, cols: [pal[i % 5]], dust: ash, dustK: 0.32, dark: 0.3, sink: 1, ry: (r() - 0.5) * 0.4 }); }
    K.crag(cx, ph - 0.25, cz, 6.2, 0.32, 6.2, '#FFFFFF', null, { seed: seed * 7 + 1, n: 14, strata: 0, rough: 0.2, jit: 0.05, taper: 1, flare: 0, tilt: 0, cuts: 0, fis: 0, cols: [LAVA], dust: '#FF9A40', dustK: 0.45, dark: 0.3, e: 1.5 }); // poça entre as colunas: brilha nas frestas
    for (let i = 0; i < 2; i++) { const a = r() * PI * 2, d = 3.4 + r() * 1.2, s = 1.4 + r() * 1.2; K.crag(cx * 0.3 + Math.cos(a) * d, ph - 0.16, cz * 0.3 + Math.sin(a) * d, s * 1.3, 0.24, s, '#FFFFFF', null, { seed: seed * 7 + 3 + i, n: 10, strata: 0, rough: 0.28, jit: 0.06, taper: 1, flare: 0, tilt: 0, cuts: 0, fis: 0, cols: [LAVA], dust: '#FFA850', dustK: 0.4, dark: 0.35, e: 1.45, ry: r() * PI }); }
    F.forEach(f => vein(K, f, HOT, 1.8, 0.1)); // fissuras acesas nas paredes
    for (let i = 0; i < 4; i++) { const a = r() * PI * 2, d0 = 2.2, rt = 0.84 / Math.hypot(Math.cos(a) / (pw / 2), Math.sin(a) / (pd / 2)) - Math.hypot(cx, cz), len = Math.max(0.6, Math.min(1.6 + r() * 1.6, rt - d0)); K.box(cx + Math.cos(a) * (d0 + len / 2), ph - 0.14, cz + Math.sin(a) * (d0 + len / 2), len, 0.22, 0.16, HOT, null, { e: 1.7, ry: -a }); } // rachaduras acesas no topo
    cluster(K, r, cx + 2.3, ph - 0.1, cz - 1.5, 4, 3, HOT2, VIO, { seed: seed * 60, emitK: 0.45, e: 1.5, lean: 0.5 }); cluster(K, r, cx - 2.2, ph - 0.1, cz + 2, 4, 2.8, VIO, VIO, { seed: seed * 60 + 9, emitK: 0, fat: 0.2 }); // cristais laranja (acesos) e violeta (vidro)
    talus(K, r, 0, 0, Math.min(pw, pd) * 0.5, 4, 0.9, pal, { seed: seed + 60, dust: ash }); },
  // 4.3b: Minério de liga = afloramento baixo de rocha escura estratificada com aglomerados de cristal azul-elétrico brotando das fendas; azul aceso é exclusivo do Minério
  minerio(K, seed) { const r = rng(seed * 7 + 7), C = '#34B2FF', C2 = '#4CC9FF', GL = '#8FDBFF'; K.base = 0; const pal = ['#3A3F48', '#454B55', '#30353D', '#4C525C', '#2A2E35'], dust = '#5F6E80';
    const L = [[[-1.8, -0.6, 8.2, 3.1, 6.6], [2.7, 1.6, 6.4, 2.4, 5.6], [0.4, -3.2, 5.2, 1.7, 4.2]], [[-0.6, 0.4, 9.4, 2.7, 7.2], [3.4, -2.1, 4.8, 2, 4.4], [-3.7, 2.6, 4.6, 1.6, 4]],
      [[-2.2, 0.8, 7, 3.3, 6], [2.4, -0.8, 7.2, 2.5, 6.2], [0.2, 3.5, 4.4, 1.5, 3.6]], [[0, 0, 8.8, 2.9, 8], [-3.9, -2.4, 4.6, 1.9, 4], [3.7, 2.8, 4.2, 1.6, 3.8]]][seed % 4];
    const F = []; L.forEach(([x, z, w, h, d], i) => { K.crag(x, 0, z, w, h, d, pal[0], 'rock', { seed: seed * 13 + i, n: i ? 13 : 16, strata: i ? 2 : 3, cols: shuf(pal, r), dust, dustK: 0.3, tilt: 0.1 + r() * 0.1, sink: h * 0.8, fis: i ? 2 : 3, cuts: 2, ledge: 0.1, dark: 0.5 }); F.push(...K.fis); });
    const [x0, z0, , h0] = L[0], [x1, z1, , h1] = L[1];
    cluster(K, r, x0 + (r() - 0.5), h0 * 0.8, z0 + (r() - 0.5), 7, 5.2 + r(), C, GL, { seed: seed * 50, e: 1.75 }); // aglomerado principal no alto
    cluster(K, r, (x0 + x1) / 2, Math.min(h0, h1) * 0.55, (z0 + z1) / 2, 5, 3.6 + r() * 0.8, C2, GL, { seed: seed * 50 + 9, e: 1.6 }); // na junta das camadas
    const Fs = []; for (const f of F.slice().sort((a, b) => Math.atan2(a.a[2], a.a[0]) - Math.atan2(b.a[2], b.a[0]))) { const an = Math.atan2(f.a[2], f.a[0]); if (Fs.every(g => Math.abs(Math.atan2(Math.sin(an - g.an), Math.cos(an - g.an))) > 1.1)) Fs.push(Object.assign({ an }, f)); } /* fendas espalhadas em volta do nó */
    cluster(K, r, x1 + (r() - 0.5) * 0.6, h1 * 0.75, z1 + (r() - 0.5) * 0.6, 4, 3 + r() * 0.6, C, GL, { seed: seed * 50 + 15, e: 1.6 }); // no alto da segunda camada
    Fs.slice(0, 4).forEach((f, i) => { cluster(K, r, f.a[0] - f.n[0] * 0.2, f.a[1] + 0.2 + r() * 0.5, f.a[2] - f.n[1] * 0.2, 3 + (i % 2), 1.8 + r() * 1.3, i % 2 ? C2 : C, GL, { seed: seed * 50 + 20 + i * 5, dir: f.n, e: 1.55 }); vein(K, f, C, 1.5, 0.08, 0.85); });
    for (let i = 0; i < 6; i++) { const a = r() * PI * 2, d = 5 + r() * 1.3, s = 0.6 + r() * 0.6, rx = Math.sin(a) * 1.2, rz = -Math.cos(a) * 1.2; K.xtal(Math.cos(a) * d, -0.15, Math.sin(a) * d, s * 0.3, s * 1.4, i % 2 ? GL : C, i % 2 ? 'crystal' : null, i % 2 ? { seed: seed * 50 + 40 + i, rx, rz } : { seed: seed * 50 + 40 + i, e: 1.4, shade: 0.5, rx, rz }); } // lascas na base
    talus(K, r, 0, 0, 5.2, 4, 0.9, pal, { seed: seed + 40, dust }); },
  // 4.3b: Dados = monólito antigo de pedra escura com glifos verdes acesos sobre plataforma em degraus, cristais octaédricos e o anel
  dados(K, seed) { const r = rng(seed * 7 + 11), G = '#45D682', G2 = '#7FE3A1', v = seed % 4, DK = '#26302B'; K.base = 0; const pal = ['#33403A', '#3B4A42', '#2A3530', '#435249', '#25302B'], moss = '#71836F';
    let ty = 0; [[11.4, 1, 10.2], [8.4, 0.9, 7.4], [5.6, 0.7, 5]].forEach(([w, h, d], i) => { K.crag(0, ty - (i ? 0.15 : 0), 0, w, h + (i ? 0.15 : 0), d, pal[i], 'rock', { seed: seed * 17 + i, n: 12, sq: 5.5, rough: 0.035, jit: 0.02, strata: 1, ledge: 0.04, taper: 0.97, flare: 0.02, tilt: 0.015, cuts: 1, fis: i ? 1 : 2, cols: [pal[i], pal[(i + 2) % 5]], dust: moss, dustK: 0.22, dark: 0.35, sink: i ? 0.2 : 1, ry: (r() - 0.5) * 0.1 }); ty += h; });
    const mono = (x, z, w, h, d, ry, broken, sd) => { K.crag(x, ty - 0.3, z, w, h + 0.3, d, DK, 'rock', { seed: sd, n: 12, sq: 8, rough: 0.02, jit: 0.015, strata: 0, taper: 0.9, flare: 0.02, tilt: 0.05, cuts: broken ? 1 : 0, fis: 0, top: broken ? 'jag' : 'flat', cols: [DK], dust: '#3E4B44', dustK: 0.3, dark: 0.3, ry });
      const c = Math.cos(ry), s = Math.sin(ry), at = (lx, ly, lz) => [x + lx * c + lz * s, ty + ly, z - lx * s + lz * c], hh = broken ? h * 0.66 : h * 0.92, face = (side, y) => side * (d / 2 * (1 - 0.1 * y / h) + 0.03);
      for (const side of [-1, 1]) for (let y = 0.5; y < hh - 0.3; y += 0.42 + r() * 0.3) { const bw = 0.2 + r() * 0.7, bx = (r() - 0.5) * (w * 0.78 - bw) * (1 - 0.1 * y / h), p = at(bx, y, face(side, y)); K.box(p[0], p[1], p[2], bw, r() < 0.25 ? 0.2 : 0.08, 0.08, r() < 0.3 ? G2 : G, null, { e: 1.45, ry }); } // glifos
      K.seg(at(w * 0.28, 0.35, face(1, 0.35)), at(w * 0.25, hh, face(1, hh)), 0.035, G, null, { e: 1.5, seg: 4 }); }; // canal vertical
    if (v === 0) mono(0, 0, 2.5, 5.2, 1.35, (r() - 0.5) * 0.5, false, seed * 3);
    else if (v === 1) { mono(-1.3, 0.3, 2.1, 4.8, 1.2, 0.25, false, seed * 3); mono(1.5, -0.4, 1.9, 3, 1.1, -0.35, true, seed * 3 + 1); }
    else if (v === 2) { mono(-1.2, -1.2, 2.2, 3, 1.25, 0.2, true, seed * 3); K.crag(-0.9, ty + 0.15, 1, 1.9, 3.6, 1.1, DK, 'rock', { seed: seed * 3 + 2, n: 10, sq: 8, rough: 0.02, strata: 0, taper: 0.92, cuts: 1, fis: 0, top: 'jag', cols: [DK], dust: '#3E4B44', dark: 0.3, rz: -1.5, ry: -0.3 }); K.seg([-0.4, ty + 0.75, 1.15], [2.2, ty + 0.95, 1.95], 0.05, G, null, { e: 1.6, seg: 4 }); } // tombado
    else { for (let i = 0; i < 3; i++) { const a = i / 3 * PI * 2 + 0.3; mono(Math.cos(a) * 2.1, Math.sin(a) * 2.1, 1.3, 3 + r() * 1, 0.8, -a + PI / 2, r() < 0.4, seed * 3 + i); } K.oct(0, ty + 2.2, 0, 0.75, 2.4, G, null, { e: 1.8, shade: 0.5 }); }
    K.tor(0, ty + (v === 3 ? 2.3 : 2.8), 0, v === 1 ? 3.4 : 2.6, 0.09, G, null, { e: 1.6, ts: 28, rs: 5, rx: (r() - 0.5) * 0.32, rz: 0.12 });
    for (let i = 0; i < 5; i++) { const a = i / 5 * PI * 2 + r(), d = 2.8 + r() * 1.2; K.oct(Math.cos(a) * d, ty + 1 + r() * 3, Math.sin(a) * d, 0.3 + r() * 0.22, 1.2 + r() * 1.1, i % 2 ? G2 : G, null, { e: 1.5 + r() * 0.4, shade: 0.5, rz: (r() - 0.5) * 0.6 }); } // cristais de dados flutuando
    for (let i = 0; i < 3; i++) { const a = r() * PI * 2, d = 4.4 + r() * 0.6; K.oct(Math.cos(a) * d, 0.3 + r() * 0.3, Math.sin(a) * d, 0.35, 1.3, G, null, { e: 1.6, shade: 0.5, rz: (r() - 0.5) * 1.2, rx: (r() - 0.5) * 1.2 }); } // encravados nos degraus
    talus(K, r, 0, 0, 5.4, 4, 0.8, pal, { seed: seed + 80, dust: moss }); },
  // 4.3b: rocha das cordilheiras (e pedras soltas) = penhasco fraturado com estratos, topo plano inclinado, blocos caídos no pé e saia funda
  // (no monte do relevo a peça fica no topo e a encosta cai ~45°: tudo desce até ~1,1× a distância do centro para nada flutuar). Variações: mesa larga,
  // dois morros, mesa com agulha, laje inclinada, degraus, bloco fraturado
  rocks(K, seed) { const r = rng(seed * 7 + 13), v = seed % 6, pal = rockPal(v), dust = '#B2A58F'; K.base = 0;
    const PW = 13 + r() * 1.2, PD = 11.8 + r() * 1.2, PH = 2 + r() * 0.8; // pedestal: base contínua entre peças vizinhas e saia em degraus que desce a encosta
    K.crag(0, 0, 0, PW, PH, PD, pal[0], 'rock', { seed: seed * 11, n: 16, strata: 2, taper: 0.88, flare: 0.08, ledge: 0.1, rim: 0.2, tilt: 0.06, sink: PW * 0.62, sinkFlare: 0.06, skirt: 4, cols: shuf(pal, r), dust, dustK: 0.2, fis: 4, cuts: 2, chip: 0.1, jit: 0.06, dark: 0.45 });
    const M = (x, z, w, h, d, o) => K.crag(x, PH - 0.5, z, w, h + 0.5, d, pal[0], 'rock', Object.assign({ seed: seed * 11 + 1 + (o.k || 0), n: 14, strata: 4, taper: 0.7, ledge: 0.08, sink: PH * 0.6, cols: shuf(pal, r), dust, fis: 3, cuts: 3, chip: 0.09, jit: 0.05, ry: r() * PI * 2 }, o));
    const T = (x, z, R, n, sz) => talus(K, r, x, z, R, n, sz, shuf(pal, r), { seed: seed * 5 + n + Math.round(x * 3), dust, near: 0.95, y: PH - 0.2, depth: PH });
    if (v === 0) { M(-0.5, 0, 8.6, 5.8, 7.8, { tilt: 0.08 }); M(3.7, 2.3, 4.4, 2.8, 4, { k: 1, strata: 2, n: 11 }); T(-0.5, 0, 4.2, 4, 1.3); }
    else if (v === 1) { M(-2.6, -0.6, 6.2, 5.6, 5.6, {}); M(2.8, 0.9, 5.6, 4.2, 5.2, { k: 1, strata: 3, tilt: 0.14 }); T(-2.6, -0.6, 3, 3, 1.2); T(2.8, 0.9, 2.8, 2, 1.1); }
    else if (v === 2) { M(-1, 0, 7.6, 3.8, 7, {}); M(3.3, -2, 3.6, 6.2, 3.3, { k: 1, sq: 2.4, n: 10, strata: 4, taper: 0.72, cuts: 2, fis: 1, tilt: 0.16 }); T(-1, 0, 3.8, 4, 1.3); }
    else if (v === 3) { M(0, 0, 9.2, 4.8, 7.6, { strata: 5, tilt: 0.32, taper: 0.78 }); T(0, 0, 4.4, 5, 1.3); }
    else if (v === 4) { M(-2, 0, 6.8, 5.4, 6.4, {}); M(2.4, 1.6, 5.2, 3.2, 4.8, { k: 1, strata: 3, n: 12 }); T(-2, 0, 3.3, 3, 1.2); T(2.4, 1.6, 2.6, 2, 1); }
    else { M(-0.6, 0, 8.2, 5, 7.6, { cuts: 4, fis: 4 }); M(3.9, 0.4, 2.4, 4.2, 5.2, { k: 1, sq: 4, n: 12, strata: 3, tilt: 0.2, rz: -0.14, cuts: 1 }); T(-0.6, 0, 4, 4, 1.3); }
    talus(K, r, 0, 0, Math.min(PW, PD) * 0.5, 3, 1.5, shuf(pal, r), { seed: seed * 9 + 1, dust, near: 0.84, depth: PW * 0.6 }); }, // blocos na borda do pedestal com raiz funda
  // 4.3b: ruína = pilares em tambores e trechos de muro de blocos de uma estrutura antiga, quebrados e meio enterrados, com entulho; lâmpada morna (verde aceso é só dos Dados)
  ruin(K, seed) { const r = rng(seed * 7 + 17), v = seed % 6, pal = v % 2 ? ['#8E8676', '#7D766A', '#9A917F', '#706A60', '#A39A86'] : ['#8A8478', '#7A746A', '#958D7F', '#6F6A61', '#A0977F']; K.base = 0;
    const lamp = (x, y, z) => { K.box(x, y - 0.1, z, 0.66, 0.16, 0.66, '#4A4540', 'dark'); K.light(x, y + 0.06, z, 0.3, '#FFE9C4', 0.9); };
    if (v === 0) { pillar(K, r, -3.6, 0, 0.62, 5.4, pal, { seed }); pillar(K, r, 0, 0.2, 0.62, 3.4, pal, { seed: seed + 1, broken: 1 }); pillar(K, r, 3.6, -0.1, 0.62, 1.4, pal, { seed: seed + 2, broken: 1 }); K.box(1.2, -0.35, 2.4, 5.2, 0.9, 1.3, pal[1], 'stone', { ry: 0.25, rz: 0.08 }); rubble(K, r, 0, 0, 5.2, 7, 0.9, pal, { seed }); lamp(-2.3, 0.06, 1.3); }
    else if (v === 1) { wall(K, r, -0.2, -1.6, 7.6, 3.4, 1, 0, pal); wall(K, r, 3.3, 0.9, 4.6, 2.4, 1, PI / 2, pal); rubble(K, r, 0.4, 1.2, 4.6, 7, 0.9, pal, { seed }); lamp(2.2, 0.06, -0.5); }
    else if (v === 2) { pillar(K, r, -1.6, -0.6, 0.78, 5.6, pal, { seed, broken: 1 }); for (let i = 0; i < 3; i++) K.cyl(0.2 + i * 1.35 + r() * 0.3, 0.55, 0.6 + (r() - 0.5) * 0.6, 0.76, 0.78, 1.1, pal[i % 5], 'stone', { seg: 10, facet: true, rz: PI / 2 + (r() - 0.5) * 0.2, ry: (r() - 0.5) * 0.5 }); rubble(K, r, 0.6, 0.4, 4.6, 6, 0.9, pal, { seed }); lamp(-2.9, 0.06, 0.8); }
    else if (v === 3) { const top = pillar(K, r, -2.3, 0, 0.6, 3.6, pal, { seed }); pillar(K, r, 2.3, 0, 0.6, 3.6, pal, { seed: seed + 1 }); for (let i = 0; i < 8; i++) { if (i === 4 || i === 5) continue; const a = PI - i * PI / 7, R = 2.3; K.box(Math.cos(a) * R, top + 0.45 + Math.sin(a) * R * 0.85, 0, 0.9, 0.7, 1.05, pal[i % 5], 'stone', { rz: a - PI / 2 }); } /* arco com a pedra-chave caída */ for (let i = 0; i < 3; i++) K.box(0.6 + i * 1.1, -0.2, 1.6 + (r() - 0.5), 0.95, 0.72, 1.05, pal[(i + 2) % 5], 'stone', { ry: r() * PI, rz: (r() - 0.5) * 0.6 }); rubble(K, r, 0, 0.6, 4.4, 6, 0.85, pal, { seed }); lamp(0, 0.06, 0.5); }
    else if (v === 4) { wall(K, r, 0, -3, 7.2, 1.6, 0.8, 0, pal); wall(K, r, 0.4, 3, 6.4, 0.8, 0.8, 0, pal); wall(K, r, -3.6, 0, 6, 1.2, 0.8, PI / 2, pal); wall(K, r, 3.6, -0.6, 4.8, 1.6, 0.8, PI / 2, pal); for (let i = 0; i < 3; i++) K.cyl(-1.8 + i * 1.2, 0.4, 0.4 + i * 0.25, 0.55, 0.58, 1.05, pal[i % 5], 'stone', { seg: 10, facet: true, rz: PI / 2, ry: 0.35 }); rubble(K, r, 0, 0, 3.6, 8, 0.8, pal, { seed }); lamp(1.4, 0.06, 0.6); }
    else { wall(K, r, 0, -0.8, 9, 4, 1.1, 0.08, pal, { win: [-0.4, 1.6, 1.4, 3.2] }); pillar(K, r, -5.2, 1.4, 0.6, 2.6, pal, { seed, broken: 1 }); rubble(K, r, 0, 1.6, 4.8, 7, 0.9, pal, { seed }); lamp(0.6, 0.06, 0.4); } },
  // 4.3b: pedra solta barata (matacão com estratos ou pedra/seixo lascado) para o espalhamento do dress3d, no lugar do icosaedro; ver scatter()
  seixo(K, seed) { const big = !(seed & 1), r = rng(seed * 7 + 29); K.base = 0; K.crag(0, -0.12, 0, 2.1 + r() * 0.3, big ? 1.25 + r() * 0.2 : 0.9, 1.8, '#FFFFFF', 'rock', { seed, n: big ? 8 : 6, strata: big ? 2 : 0, sq: 2.6 + r(), rough: 0.14, chip: 0.12, jit: 0.06, tilt: 0.22, cuts: big ? 2 : 1, fis: big ? 1 : 0, flare: 0.04, dark: 0.35, dustK: 0.25, cols: ['#FFFFFF', '#E4E0D9'], dust: '#FFFFFF' }); },
  // ---------- 4.3c: flora e adereços do mundo vestido (dress3d) ----------
  // ~2 de largura, base em y = 0 (o que fica abaixo afunda no chão), altura até ~2,5 (o vento do dress3d pesa pela altura); o dress3d escala pela instância.
  // Cor por vértice (sem cor de material), rugosidade pelo MAT de cada peça e peso do vento por peça; brilho só em peças emissivas fracas (brasa, fungo).
  // tundra: tufo de capim — lâminas finas em dois tons, alturas e curvas diferentes
  capim(K, seed) { const r = rng(seed * 7 + 41); K.base = 0; const nb = K.q(21 + (r() * 3 | 0)), G = ['#3A4620', '#445024', '#4E5626'], P = ['#A2A85C', '#B4B068', '#90A050', '#BEBA7A'], BR = ['#A08250', '#B4965E']; /* lâminas finas; um quarto com ponta bronze */
    for (let i = 0; i < nb; i++) { const a = i / nb * PI * 2 + (r() - 0.5) * 0.7, d = 0.03 + r() * 0.18, tall = r() * r(), L = 0.7 + tall * 1.2, t0 = 0.12 + (1 - tall) * 0.45 + r() * 0.15, cv = 0.5 + r() * 0.9;
      K.blade(Math.cos(a) * d, -0.06, Math.sin(a) * d, a, t0, cv, L, (0.075 + r() * 0.04) * (K.lite ? 1.4 : 1), '#FFFFFF', 'leaf', { n: 3, c0: G[i % 3], c1: i % 4 === 3 ? BR[i % 2] : P[(i * 3 + (r() * 2 | 0)) % 4], nc: [0, 0.2, 0], ku: 0.7, kf: 0.35, ko: 0.3, ao: 0.4, wind: 1 }); } },
  // tundra: arbusto de folhagem — dezenas de folhas pequenas com vinco na casca de um domo e galhos curtos por dentro; variante 1 azul-esverdeada
  folhagem(K, seed) { const r = rng(seed * 7 + 43); K.base = 0; const PAL = [['#323E26', '#6E7E4A'], ['#38482A', '#86985C'], ['#444628', '#9E9C62']]; /* um tom acima: na partida o arbusto ficava quase preto sobre o musgo claro */
    for (let i = 0; i < 4; i++) { const a = i * PI / 2 + r() * 0.8; K.trunk([[0, -0.1, 0, 0.07], [Math.cos(a) * 0.22, 0.32, Math.sin(a) * 0.22, 0.045], [Math.cos(a) * 0.42, 0.62, Math.sin(a) * 0.42, 0.015]], '#FFFFFF', 'bark', { n: 3, c0: '#2A2018', c1: '#4A3C2C', wind: 0.2 }); }
    const cy = 0.6, ls = K.lite ? 1.3 : 1; /* camadas: casca de fora (folhas maiores), casca de dentro (mais escura, aponta para cima) e tufo no topo: de cima não fica oca */
    const shell = (N, RX, RY, L0, W0, dk0, cmin) => { for (let i = 0; i < N; i++) { const u = (i + 0.5) / N, cth = 1 - u * (1 - cmin), sth = Math.sqrt(Math.max(0, 1 - cth * cth)), ph = i * 2.39996 + r() * 0.5, dx = sth * Math.cos(ph), dz = sth * Math.sin(ph), dy = cth, rad = 0.85 + r() * 0.2;
      const px = dx * RX * rad, py = cy + dy * RY * rad, pz = dz * RX * rad, pc = PAL[(r() * 3) | 0], up = Math.acos(Math.max(-1, Math.min(1, dy))) * 0.72 + 0.12;
      K.blade(px - dx * 0.06, py - Math.max(0, dy) * 0.05, pz - dz * 0.06, Math.atan2(dz, dx), up, 0.25 + r() * 0.35, (L0 + r() * 0.12) * ls, (W0 + r() * 0.06) * ls, '#FFFFFF', 'leaf', { shape: 'leaf', n: 2, fold: 0.2, c0: pc[0], c1: pc[1], dk: dk0 * (0.78 + 0.22 * (cth - cmin) / (1 - cmin)), nc: [0, cy * 0.4, 0], ku: 0.8, kf: 0.22, ko: 0.42, ao: 0.1, wind: 0.6 }); } }; /* normal mais para o céu: a copa acende por igual (na partida a sombra própria e o AO já dão o volume) */
    shell(K.q(46), 0.74, 0.5, 0.34, 0.22, 1, -0.3); shell(K.q(18), 0.42, 0.42, 0.3, 0.2, 0.9, 0.1); shell(K.q(7), 0.16, 0.5, 0.28, 0.2, 1.08, 0.6); },
  // tundra: samambaia — frondes arqueadas com folíolos e dois brotos enrolados no centro; variante 1 azul-esverdeada
  samambaia(K, seed) { const r = rng(seed * 7 + 47), v = seed % 2; K.base = 0; const c0 = v ? '#1E3430' : '#222C16', c1 = v ? '#6A9A88' : '#7A8646', nf = 8 + (r() * 3 | 0);
    for (let i = 0; i < nf; i++) { const a = i / nf * PI * 2 + (r() - 0.5) * 0.5, L = 0.95 + r() * 0.35, t0 = 0.3 + r() * 0.35;
      K.frond(Math.cos(a) * 0.05, -0.05, Math.sin(a) * 0.05, a, t0, 1.35 + r() * 0.6, L, '#FFFFFF', 'leaf', { m: 9, lk: 0.3, droop: 0.35, c0, c1, dk: 0.85 + r() * 0.2, nc: [0, 0.35, 0], ku: 0.5, kf: 0.4, ko: 0.4, wind: 0.8 }); }
    for (let i = 0; i < K.q(2); i++) { const a = r() * PI * 2; K.blade(Math.cos(a) * 0.06, -0.03, Math.sin(a) * 0.06, a, 0.05, 4.2, 0.62, 0.09, '#FFFFFF', 'leaf', { n: 5, c0, c1: v ? '#9CC4B2' : '#A09C5C', nc: [0, 0.3, 0], wind: 0.5 }); } },
  // tundra: flores alienígenas sem brilho — roseta de folhas, hastes finas e corolas em estrela (violeta, coral ou creme apagados)
  flor(K, seed) { const r = rng(seed * 7 + 53); K.base = 0; const PP = [['#6E527E', '#B59BC9', '#3A2A44'], ['#9A5E52', '#D9A090', '#4A2E28'], ['#A89C70', '#E2D9B0', '#5A4A30']]; /* cada corola com uma das três cores */
    for (let i = 0; i < K.q(6); i++) { const a = i / 6 * PI * 2 + r() * 0.6; K.blade(0, -0.03, 0, a, 1.05 + r() * 0.2, 0.5, 0.55 + r() * 0.15, 0.2, '#FFFFFF', 'leaf', { shape: 'leaf', n: 2, fold: 0.2, c0: '#24301A', c1: '#66763A', nc: [0, 0, 0], wind: 0.3 }); }
    const ns = 4 + (r() * 3 | 0); for (let i = 0; i < ns; i++) { const a = r() * PI * 2, d = 0.05 + r() * 0.15, hh = 0.75 + r() * 0.85, t0 = 0.12 + r() * 0.3;
      K.blade(Math.cos(a) * d, -0.03, Math.sin(a) * d, a, t0, 0.25, hh, 0.05, '#FFFFFF', 'leaf', { n: 2, c0: '#2E3A1C', c1: '#5A6A34', wind: 1 }); const tp = K.tip, ps = 0.2 + r() * 0.08, P = PP[(i + seed) % 3];
      K.wind(1, () => { for (let k = 0; k < 5; k++) K.blade(tp[0], tp[1], tp[2], k / 5 * PI * 2 + a, 0.85, 0.5, ps, ps * 0.75, '#FFFFFF', 'petal', { shape: 'leaf', n: 2, c0: P[2], c1: k % 2 ? P[1] : P[0], nc: tp, ku: 0.6, kf: 0.4, ko: 0.2, ao: 0 });
        if (!K.lite) K.oct(tp[0], tp[1] - 0.03, tp[2], 0.05, 0.11, P[2], 'petal'); }); } },
  // tundra: pedra com líquen (manchas amarelo-esverdeadas e alaranjadas no topo) e almofadas de musgo no pé
  liquen(K, seed) { const r = rng(seed * 7 + 59), big = !(seed & 1); K.base = 0;
    K.crag(0, -0.12, 0, 2 + r() * 0.3, big ? 1.1 + r() * 0.2 : 0.8, 1.7, '#FFFFFF', 'rock', { seed: seed + 11, n: big ? 8 : 6, strata: big ? 2 : 0, sq: 2.6 + r(), rough: 0.14, chip: 0.12, jit: 0.06, tilt: 0.22, cuts: big ? 2 : 1, fis: big ? 1 : 0, flare: 0.04, dark: 0.35, dustK: 0.2, cols: ['#77736B', '#686460'], dust: '#8E8A80' });
    K.patina(['#8C8A56', '#6E7A4E', '#A08A58', '#7E8656'], 0.32, 0.4, seed);
    for (let i = 0; i < K.q(2); i++) { const a = r() * PI * 2, s = 0.8 + r() * 0.5; K.bulb([[0.26 * s, -0.04], [0.24 * s, 0.07 * s], [0.14 * s, 0.13 * s], [0, 0.15 * s]], Math.cos(a) * 0.95, 0, Math.sin(a) * 0.82, '#FFFFFF', 'leaf', { n: 6, rk: 0.12, c0: '#26301A', c1: '#5E6A30', seed: seed + i }); } },
  // gelo: aglomerado de cristais de gelo fosco (prismas de alturas diferentes, branco-azulado sem brilho próprio) num monte de neve; variante 1 em leque
  cristal(K, seed) { const r = rng(seed * 7 + 61), v = seed % 2; K.base = 0;
    K.crag(0, -0.1, 0, 1.9, 0.34, 1.6, '#FFFFFF', 'snow', { seed: seed * 3 + 1, n: 9, strata: 0, top: 'dome', taper: 0.7, flare: 0.25, rough: 0.12, cuts: 0, fis: 0, tilt: 0.05, dark: 0.22, dustK: 0.55, cols: ['#93A4BE'], dust: '#D6DEEA' });
    const n = 6 + (r() * 2 | 0), fan = r() * PI * 2;
    for (let i = 0; i < n; i++) { const big = i === 0, a = v ? fan + (r() - 0.5) * 1.6 : r() * PI * 2, lean = big ? 0.06 + r() * 0.1 : (v ? 0.5 + r() * 0.3 : 0.32 + r() * 0.42), hh = big ? 1.85 + r() * 0.45 : 0.55 + r() * 0.95, rr = hh * (0.15 + r() * 0.04), off = big ? (v ? -0.3 : 0) : 0.18 + r() * 0.42;
      const ox = big && v ? Math.cos(fan) * off : Math.cos(a) * off, oz = big && v ? Math.sin(fan) * off : Math.sin(a) * off;
      K.xtal(ox, -0.12, oz, rr, hh, i % 3 ? '#B8D0E8' : '#D8E6F4', 'frost', { seed: seed * 13 + i, n: 5, rx: Math.sin(a) * lean, rz: -Math.cos(a) * lean, glow: 0.55 }); } },
  // gelo: arbusto congelado espinhoso — galhos escuros que clareiam de geada, ramos laterais, ponta de gelo e colchão de neve
  espinho(K, seed) { const r = rng(seed * 7 + 67); K.base = 0;
    K.crag(0, -0.1, 0, 1.3, 0.22, 1.2, '#FFFFFF', 'snow', { seed: seed * 5 + 2, n: 8, strata: 0, top: 'dome', taper: 0.7, flare: 0.25, rough: 0.15, cuts: 0, fis: 0, dark: 0.2, dustK: 0.5, cols: ['#93A4BE'], dust: '#D6DEEA' });
    const nb = K.q(9 + (r() * 3 | 0)); for (let i = 0; i < nb; i++) { const a = i / nb * PI * 2 + (r() - 0.5) * 0.5, el = 0.3 + r() * 0.55, L = 0.85 + r() * 0.5, sx = Math.sin(el) * Math.cos(a), sy = Math.cos(el), sz = Math.sin(el) * Math.sin(a);
      const p0 = [Math.cos(a) * 0.06, -0.05, Math.sin(a) * 0.06], p1 = [p0[0] + sx * L, p0[1] + sy * L, p0[2] + sz * L];
      K.spike(p0, p1, 0.13, '#FFFFFF', 'bark', { c0: '#262B36', c1: '#DCE7EE' });
      for (let k = 0; k < K.q(2); k++) { const f = 0.35 + k * 0.25 + r() * 0.1, b = [p0[0] + sx * L * f, p0[1] + sy * L * f, p0[2] + sz * L * f], aa = a + (k ? 0.6 : -0.6) + (r() - 0.5) * 0.3, ee = el + 0.2 + r() * 0.3, ll = L * (0.4 + r() * 0.2);
        K.spike(b, [b[0] + Math.sin(ee) * Math.cos(aa) * ll, b[1] + Math.cos(ee) * ll, b[2] + Math.sin(ee) * Math.sin(aa) * ll], 0.08, '#FFFFFF', 'frost', { c0: '#3E4856', c1: '#E8F0F5' }); }
      if (!K.lite) K.xtal(p1[0], p1[1] - 0.14, p1[2], 0.08, 0.36, '#DCE8F4', 'frost', { seed: seed * 11 + i, n: 3, rx: Math.sin(a) * el, rz: -Math.cos(a) * el, glow: 0.2 }); } },
  // gelo: montinhos de neve (dois ou três domos sobrepostos), às vezes com uma pedra escura aparecendo
  neve(K, seed) { const r = rng(seed * 7 + 71); K.base = 0; const nm = 2 + (r() * 2 | 0);
    for (let i = 0; i < nm; i++) { const a = r() * PI * 2, d = i ? 0.42 + r() * 0.3 : 0, s = i ? 0.55 + r() * 0.3 : 1;
      K.crag(Math.cos(a) * d, -0.1, Math.sin(a) * d, 1.45 * s, 0.5 * s, 1.2 * s, '#FFFFFF', 'snow', { seed: seed * 5 + i, n: 7, strata: 0, top: 'dome', taper: 0.62, flare: 0.3, rough: 0.16, cuts: 0, fis: 0, tilt: 0.12, dark: 0.2, dustK: 0.6, cols: ['#8E9FBA'], dust: '#D4DCE8', ry: r() * PI }); }
    for (let i = 0; i < 2; i++) { const a = r() * PI * 2, s = i ? 0.55 : 0.9; K.crag(Math.cos(a) * 0.45, -0.08, Math.sin(a) * 0.45, 0.7 * s, 0.5 * s, 0.56 * s, '#FFFFFF', 'rock', { seed: seed * 9 + 3 + i, n: 6, strata: 0, sq: 3, rough: 0.15, tilt: 0.3, cuts: 1, fis: 0, dark: 0.3, dustK: 0.35, cols: ['#3A3F4A'], dust: '#DCE4EE' }); }
    for (let i = 0; i < K.q(2); i++) { const a = r() * PI * 2, d = 0.3 + r() * 0.5, hh = 0.3 + r() * 0.35; K.xtal(Math.cos(a) * d, -0.06, Math.sin(a) * d, hh * 0.22, hh, '#9EBCDC', 'frost', { seed: seed * 5 + 40 + i, n: 4, rx: Math.sin(a) * 0.7, rz: -Math.cos(a) * 0.7, glow: 0.45 }); } },
  // gelo: pedra com geada (faces de cima brancas)
  geada(K, seed) { const r = rng(seed * 7 + 73), big = !(seed & 1); K.base = 0;
    K.crag(0, -0.12, 0, 2 + r() * 0.3, big ? 1.15 + r() * 0.2 : 0.85, 1.75, '#FFFFFF', 'rock', { seed: seed + 23, n: big ? 8 : 6, strata: big ? 2 : 0, sq: 2.6 + r(), rough: 0.14, chip: 0.12, jit: 0.06, tilt: 0.22, cuts: big ? 2 : 1, fis: big ? 1 : 0, flare: 0.04, dark: 0.35, dustK: 0.2, cols: ['#5E6470', '#525865'], dust: '#7A808A' });
    K.patina(['#E9F0F4', '#D7E3EB', '#F5F8FA'], 0.8, 0.25, seed); },
  // rocha (deserto de pedra): arbusto seco espinhoso — galhos marrons em leque com gravetos e tufos de folha seca nas pontas
  seco(K, seed) { const r = rng(seed * 7 + 79); K.base = 0; const nb = 7 + (r() * 3 | 0);
    for (let i = 0; i < nb; i++) { const a = i / nb * PI * 2 + (r() - 0.5) * 0.6, el = 0.45 + r() * 0.5, L = 0.75 + r() * 0.45, sx = Math.sin(el) * Math.cos(a), sy = Math.cos(el), sz = Math.sin(el) * Math.sin(a);
      const p0 = [Math.cos(a) * 0.05, -0.08, Math.sin(a) * 0.05], pm = [p0[0] + sx * L * 0.5, p0[1] + sy * L * 0.5 + 0.05, p0[2] + sz * L * 0.5], p1 = [p0[0] + sx * L, p0[1] + sy * L * 0.85, p0[2] + sz * L];
      K.trunk([[p0[0], p0[1], p0[2], 0.08], [pm[0], pm[1], pm[2], 0.055], [p1[0], p1[1], p1[2], 0]], '#FFFFFF', 'bark', { n: 3, c0: '#2E2018', c1: '#6A4E36', wind: 0.25 });
      for (let k = 0; k < K.q(2); k++) { const aa = a + (k ? 0.7 : -0.7), ll = L * 0.45; K.spike(pm, [pm[0] + Math.cos(aa) * ll * 0.8, pm[1] + ll * 0.5, pm[2] + Math.sin(aa) * ll * 0.8], 0.04, '#FFFFFF', 'bark', { c0: '#3A2A1E', c1: '#7E6046', wind: 0.35 }); }
      for (let k = 0; k < K.q(3); k++) K.blade(p1[0], p1[1] - 0.02, p1[2], a + (k - 1) * 0.9, 1.0, 0.6, 0.26, 0.15, '#FFFFFF', 'leaf', { shape: 'leaf', n: 2, c0: '#4A3420', c1: k ? '#7E6A3E' : '#7A3A22', nc: [0, 0.4, 0], wind: 0.5 }); } },
  // rocha: suculentas alienígenas — bulbos com gomos, espinhos claros e botão rosado no maior; variante 1 = roseta de folhas grossas (agave) com haste de botões
  suculenta(K, seed) { const r = rng(seed * 7 + 83), v = seed % 2; K.base = 0;
    if (!v) { const nb = 3 + (r() * 2 | 0); for (let i = 0; i < nb; i++) { const big = i === 0, a = r() * PI * 2, d = big ? 0 : 0.42 + r() * 0.3, s = big ? 1 : 0.5 + r() * 0.25, tilt = big ? 0 : 0.25 + r() * 0.2;
        const prof = [[0.4, -0.1], [0.5, 0.22], [0.42, 0.66], [0.18, 0.95], [0, 1.02]].map(q => [q[0] * s, q[1] * s * 1.1]);
        K.bulb(prof, Math.cos(a) * d, 0, Math.sin(a) * d, '#FFFFFF', 'skin', { n: 8, ribs: 4, rk: 0.15, c0: '#2F4A3E', c1: '#7FA08A', ribC: 0.14, seed: seed * 3 + i, rx: Math.sin(a) * tilt, rz: -Math.cos(a) * tilt });
        if (big) { if (!K.lite) for (let k = 0; k < 4; k++) for (const yy of [0.32, 0.62]) { const ph = k / 4 * PI * 2, rr = (yy > 0.5 ? 0.44 : 0.49) * 1.15; const b = [Math.cos(ph) * rr, yy * 1.1, Math.sin(ph) * rr]; K.spike(b, [b[0] + Math.cos(ph) * 0.2, b[1] + 0.1, b[2] + Math.sin(ph) * 0.2], 0.025, '#FFFFFF', 'bone', { c0: '#B8AE96', c1: '#EDE6D2' }); }
          K.bulb([[0.12, 1.02], [0.14, 1.12], [0.08, 1.22], [0, 1.25]], 0, 0, 0, '#FFFFFF', 'petal', { n: 6, rk: 0.15, c0: '#9A6070', c1: '#D8A0A8', seed }); } } }
    else { const nl = K.q(13 + (r() * 3 | 0)); for (let i = 0; i < nl; i++) { const a = i * 2.39996 + r() * 0.2, k = i / nl, el = 0.25 + k * 0.95, L = 0.65 + (1 - k) * 0.35 + r() * 0.1;
        K.blade(0, 0.02, 0, a, el, 0.35 + r() * 0.3, L, 0.24, '#FFFFFF', 'skin', { n: 3, fold: 0.35, c0: '#2E4436', c1: k > 0.6 ? '#9AAE8A' : '#84A090', nc: [0, 0.3, 0], kf: 0.6, ku: 0.35, ko: 0.4 }); const tp = K.tip; if (!K.lite) K.spike([tp[0], tp[1], tp[2]], [tp[0] + Math.cos(a) * 0.08, tp[1] + 0.02, tp[2] + Math.sin(a) * 0.08], 0.02, '#5A2E28', 'bone'); }
      K.trunk([[0, 0, 0, 0.05], [0.05, 0.8, 0.02, 0.035], [0.08, 1.55, 0.04, 0.02]], '#FFFFFF', 'skin', { n: 4, c0: '#4E5A40', c1: '#8E8E5E', wind: 0.4 });
      for (let i = 0; i < 4; i++) K.oct(0.06 + (r() - 0.5) * 0.14, 1.1 + i * 0.13, 0.03 + (r() - 0.5) * 0.14, 0.05, 0.12, i % 2 ? '#C08890' : '#9A6070', 'petal', { wind: 0.4 }); } },
  // rocha: toco de árvore morta (casca clareada, topo partido em lascas, raízes) ou tronco caído com galho quebrado
  toco(K, seed) { const r = rng(seed * 7 + 89), v = seed % 2; K.base = 0; const C0 = '#463E34', C1 = '#968A76', CUT = '#C8B892';
    if (!v) { const hh = 0.95 + r() * 0.3, lean = (r() - 0.5) * 0.2;
      K.trunk([[0, -0.15, 0, 0.36], [0.02, 0.25, 0, 0.3], [lean * 0.5, 0.6, 0.02, 0.27], [lean, hh, 0.04, 0.24]], '#FFFFFF', 'bark', { n: 7, c0: C0, c1: C1, bark: 0.3, cap: CUT, seed });
      for (let i = 0; i < K.q(4); i++) { const a = i / 4 * PI * 2 + r() * 0.8; K.trunk([[Math.cos(a) * 0.2, 0.18, Math.sin(a) * 0.2, 0.12], [Math.cos(a) * 0.5, 0.06, Math.sin(a) * 0.5, 0.08], [Math.cos(a) * 0.85, -0.08, Math.sin(a) * 0.85, 0.02]], '#FFFFFF', 'bark', { n: 4, c0: C0, c1: '#857A68', bark: 0.25, seed: seed + i }); }
      for (let i = 0; i < K.q(5); i++) { const a = i / 5 * PI * 2 + r() * 0.6, y = hh - 0.04; K.spike([lean + Math.cos(a) * 0.15, y, 0.04 + Math.sin(a) * 0.15], [lean + Math.cos(a) * 0.2, y + 0.2 + r() * 0.32, 0.04 + Math.sin(a) * 0.2], 0.08, '#FFFFFF', 'bark', { c0: C1, c1: CUT }); }
      K.trunk([[lean * 0.6, 0.6, 0.02, 0.11], [lean * 0.6 + 0.42, 0.9, 0.1, 0.065], [lean * 0.6 + 0.66, 1.0, 0.15, 0]], '#FFFFFF', 'bark', { n: 4, c0: C1, c1: '#8E8472', bark: 0.2, seed: seed + 9 }); }
    else { const tw = (r() - 0.5) * 0.2; K.trunk([[0, 0.17, 0, 0.21], [-0.45, 0.19, 0.04, 0.2], [-0.98, 0.16, tw, 0.19]], '#FFFFFF', 'bark', { n: 7, c0: '#8A7E6C', c1: C1, bark: 0.3, cap: CUT, seed });
      K.trunk([[0, 0.17, 0, 0.21], [0.42, 0.18, -0.03, 0.19], [0.9, 0.14, -tw, 0.17]], '#FFFFFF', 'bark', { n: 7, c0: '#8A7E6C', c1: C1, bark: 0.3, cap: CUT, seed: seed + 1 });
      K.trunk([[0.25, 0.3, 0.05, 0.09], [0.4, 0.62, 0.12, 0.06], [0.48, 0.85, 0.2, 0]], '#FFFFFF', 'bark', { n: 4, c0: C1, c1: '#8E8472', seed: seed + 2 });
      for (let i = 0; i < 4; i++) { const a = r() * PI * 2; K.spike([-0.92, 0.16 + Math.sin(a) * 0.12, tw + Math.cos(a) * 0.12], [-1.08 - r() * 0.15, 0.16 + Math.sin(a) * 0.2, tw + Math.cos(a) * 0.2], 0.06, '#FFFFFF', 'bark', { c0: C1, c1: CUT }); }
      K.chips([[0.3, 0.45, 0.14, 0.08], [-0.5, -0.4, 0.12, 0.07], [0.7, -0.35, 0.1, 0.06]], '#FFFFFF', 'bark', { n: 4, seed, c0: '#6E6252', c1: '#B8AC94' }); } },
  // cascalho: lascas pequenas meio enterradas, cor neutra (o dress3d tinge pelo bioma)
  cascalho(K, seed) { const r = rng(seed * 7 + 97); K.base = 0; const L = [], n = 7 + (r() * 3 | 0);
    for (let i = 0; i < K.q(n); i++) { const a = r() * PI * 2, d = Math.sqrt(r()) * 0.82, rad = (0.12 + r() * 0.2 * (1 - d * 0.5)) * (K.lite ? 1.25 : 1); L.push([Math.cos(a) * d, Math.sin(a) * d, rad, rad * (0.6 + r() * 0.5)]); }
    K.chips(L, '#FFFFFF', 'rock', { n: 4, seed, c0: '#8E8A84', c1: '#F2EEE6' }); },
  // basalto: respiro vulcânico — cone de rocha escura com boca, crosta de cinza na borda e brasa fraca lá dentro (o laranja aceso é do Plasma); variante 1 = dois cones
  respiro(K, seed) { const r = rng(seed * 7 + 101), v = seed % 2; K.base = 0;
    const cone = (x, z, s, sd) => { const hk = 1.1 + r() * 0.3; K.bulb([[1.0, -0.12], [0.84, 0.16], [0.6, 0.44], [0.42, 0.62], [0.34, 0.68], [0.27, 0.6], [0.22, 0.52]].map(q => [q[0] * s, q[1] * s * hk]), x, 0, z, '#FFFFFF', 'ash', { n: 10, ribs: 3, rk: 0.06, jit: 0.1, c0: '#1E1A1C', c1: '#5E5552', ribC: 0.25, seed: sd });
      K.bulb([[0.25 * s, 0.53 * s * hk], [0.12 * s, 0.545 * s * hk], [0, 0.55 * s * hk]], x, 0, z, '#E8461A', null, { n: 8, e: 0.55 }); /* poça de brasa fraca na boca rasa: vista de cima (o laranja aceso é do Plasma) */
      for (let i = 0; i < K.q(3); i++) { const a = r() * PI * 2, c = Math.cos(a), sn = Math.sin(a); K.blade(x + c * 0.36 * s, 0.6 * s * hk, z + sn * 0.36 * s, a, 1.95, 0.25, 0.42 * s, 0.035 * s, '#E0501E', null, { n: 2, e: 0.45, c0: '#FFFFFF', c1: '#A03818' }); } }; /* fendas acesas descendo a encosta */
    if (!v) cone(0, 0, 1, seed); else { cone(-0.35, 0.1, 0.72, seed); cone(0.52, -0.28, 0.5, seed + 7); } },
  // basalto: monte de cinza fofa (domos baixos escuros com topo mais claro)
  cinza(K, seed) { const r = rng(seed * 7 + 103); K.base = 0; const nm = 2 + (r() * 2 | 0);
    for (let i = 0; i < nm; i++) { const a = r() * PI * 2, d = i ? 0.4 + r() * 0.3 : 0, s = i ? 0.55 + r() * 0.3 : 1;
      K.crag(Math.cos(a) * d, -0.1, Math.sin(a) * d, 1.5 * s, 0.42 * s, 1.25 * s, '#FFFFFF', 'ash', { seed: seed * 5 + i, n: 9, strata: 0, top: 'dome', taper: 0.62, flare: 0.3, rough: 0.2, cuts: 0, fis: 0, tilt: 0.12, dark: 0.25, dustK: 0.6, cols: ['#575254'], dust: '#A39C9E', ry: r() * PI }); } },
  // basalto: lascas de obsidiana preta brilhante (especular, sem brilho próprio) sobre cascalho escuro
  obsidiana(K, seed) { const r = rng(seed * 7 + 107); K.base = 0; const n = 4 + (r() * 3 | 0);
    for (let i = 0; i < n; i++) { const big = i === 0, a = r() * PI * 2, d = big ? 0 : 0.3 + r() * 0.45, lean = big ? 0.15 + r() * 0.2 : 0.4 + r() * 0.5, hh = big ? 1.3 + r() * 0.5 : 0.45 + r() * 0.7;
      K.xtal(Math.cos(a) * d, -0.12, Math.sin(a) * d, hh * 0.24, hh, i % 2 ? '#2A2436' : '#1E1A26', 'obsid', { seed: seed * 7 + i, n: 4, sh: 0.45 + r() * 0.2, rx: Math.sin(a) * lean, rz: -Math.cos(a) * lean, glow: 0.45 }); }
    const L = []; for (let i = 0; i < K.q(5); i++) { const a = r() * PI * 2, d = 0.5 + r() * 0.4; L.push([Math.cos(a) * d, Math.sin(a) * d, 0.1 + r() * 0.1, 0.08 + r() * 0.06]); } K.chips(L, '#FFFFFF', 'ash', { n: 4, seed, c0: '#1A1719', c1: '#3E3A3C' }); },
  // basalto (perto da Fenda): fungos de chapéu violeta escuro com lamelas e pintas de brilho roxo discreto (cor da bruma da Fenda)
  fungo(K, seed) { const r = rng(seed * 7 + 109); K.base = 0; const n = 4 + (r() * 2 | 0), GL = '#B23CFF';
    for (let i = 0; i < n; i++) { const big = i === 0, a = r() * PI * 2, d = big ? 0 : 0.38 + r() * 0.42, hh = big ? 1.25 + r() * 0.35 : 0.45 + r() * 0.55, cr = hh * 0.42 * (big ? 1 : 1.1), lean = (r() - 0.5) * 0.35, x = Math.cos(a) * d, z = Math.sin(a) * d, tx = x + lean * hh * Math.cos(a), tz = z + lean * hh * Math.sin(a);
      K.trunk([[x, -0.05, z, cr * 0.3], [(x + tx) / 2, hh * 0.55, (z + tz) / 2, cr * 0.22], [tx, hh, tz, cr * 0.2]], '#FFFFFF', 'skin', { n: 4, c0: '#6E6070', c1: '#C9BCC6' });
      K.bulb([[cr, hh - cr * 0.04], [cr * 0.96, hh + cr * 0.12], [cr * 0.66, hh + cr * 0.38], [0, hh + cr * 0.5]], tx, 0, tz, '#FFFFFF', 'skin', { n: 6, rk: 0.05, c0: '#2A1F34', c1: '#5E4A6E', seed: seed + i });
      K.bulb([[cr * 1.005, hh - cr * 0.06], [cr * 0.975, hh + cr * 0.09]], tx, 0, tz, GL, null, { n: 6, e: 0.5 }); /* borda acesa do chapéu (as lamelas de baixo não aparecem nas câmeras do jogo): o brilho aparece de cima e de lado */
      for (let k = 0; k < K.q(big ? 4 : 2); k++) { const pa = r() * PI * 2, pr = cr * (0.25 + r() * 0.45), py = hh + cr * 0.5 * (1 - (pr / cr) * (pr / cr) * 0.9) - 0.01; K.oct(tx + Math.cos(pa) * pr, py, tz + Math.sin(pa) * pr, cr * 0.13, cr * 0.08, GL, null, { e: 0.9 }); } } }, /* pintas acesas em todos os chapéus */
  // marcos: árvores alienígenas grandes e raras (copa ~2 de largura, até ~2,4 de altura; o dress3d escala para 12–30 unidades) que projetam sombra
  // tundra: palmeira alienígena — tronco curvo em gomos com raízes, coroa de frondes compridas caídas e cachos de frutos violeta; variante 1 = guarda-chuva de três galhos
  marco_tundra(K, seed) { const r = rng(seed * 7 + 113), v = seed % 2; K.base = 0; const BK0 = '#3A2E24', BK1 = '#7A6450', F0 = '#1C2C16', F1 = '#7A8E44';
    const crown = (cx, cy, cz, nfr, L) => { nfr = K.q(nfr) + (K.lite ? 2 : 0); for (let i = 0; i < nfr; i++) { const a = i / nfr * PI * 2 + (r() - 0.5) * 0.4; K.frond(cx, cy, cz, a, 0.8 + r() * 0.5, 1.1 + r() * 0.6, L * (0.85 + r() * 0.3), '#FFFFFF', 'leaf', { m: 12, lk: 0.24, droop: 0.4, c0: F0, c1: F1, dk: 0.85 + r() * 0.2, nc: [cx, cy - 0.25, cz], ku: 0.5, kf: 0.4, ko: 0.45, wind: 0.3 }); }
      for (let i = 0; i < K.q(3); i++) K.frond(cx, cy, cz, r() * PI * 2, 0.15 + r() * 0.2, 0.7, L * 0.45, '#FFFFFF', 'leaf', { m: 7, lk: 0.22, c0: F0, c1: '#949E56', nc: [cx, cy - 0.25, cz], wind: 0.3 }); };
    const roots = (n, rr) => { for (let i = 0; i < n; i++) { const a = i / n * PI * 2 + r() * 0.5; K.trunk([[Math.cos(a) * rr * 0.6, 0.28, Math.sin(a) * rr * 0.6, rr * 0.5], [Math.cos(a) * rr * 2, 0.06, Math.sin(a) * rr * 2, rr * 0.32], [Math.cos(a) * rr * 3.4, -0.1, Math.sin(a) * rr * 3.4, 0]], '#FFFFFF', 'bark', { n: 4, c0: BK0, c1: BK1, bark: 0.2, seed: seed + i }); } };
    if (!v) { const H0 = 1.75 + r() * 0.35, bend = (r() - 0.5) * 0.7, pts = []; for (let i = 0; i <= 7; i++) { const s = i / 7; pts.push([bend * s * s * 0.5, -0.15 + s * (H0 + 0.15), bend * s * s * 0.15, (0.15 - 0.075 * s) * (i % 2 ? 1.12 : 1)]); }
      K.trunk(pts, '#FFFFFF', 'bark', { n: 7, c0: BK0, c1: BK1, bark: 0.2, seed }); roots(4, 0.15); const t = pts[7]; crown(t[0], t[1], t[2], 11, 1.15);
      for (let i = 0; i < K.q(5); i++) { const a = i / 5 * PI * 2 + r(); K.frond(t[0], t[1] - 0.06, t[2], a, 2.55 + r() * 0.3, 0.3, 0.55 + r() * 0.2, '#FFFFFF', 'leaf', { m: 6, lk: 0.2, droop: 0.1, c0: '#3A2E1E', c1: '#8A7448', nc: [t[0], t[1], t[2]], wind: 0.15 }); } /* folhas secas penduradas */
      { const a = r() * PI * 2, bx = Math.cos(a) * 0.45, bz = Math.sin(a) * 0.45; K.trunk([[bx, -0.1, bz, 0.07], [bx * 1.1, 0.3, bz * 1.1, 0.05]], '#FFFFFF', 'bark', { n: 5, c0: BK0, c1: BK1, seed: seed + 3 }); for (let i = 0; i < K.q(6); i++) K.frond(bx * 1.1, 0.3, bz * 1.1, i / 6 * PI * 2 + r() * 0.4, 0.5 + r() * 0.3, 1.2, 0.42, '#FFFFFF', 'leaf', { m: 7, lk: 0.24, c0: F0, c1: '#8C9A50', nc: [bx, 0.25, bz], wind: 0.5 }); } /* broto ao pé */
      for (let i = 0; i < K.q(3); i++) { const a = r() * PI * 2; K.bulb([[0, -0.1], [0.07, -0.04], [0.08, 0.04], [0, 0.08]], t[0] + Math.cos(a) * 0.12, t[1] - 0.12 - r() * 0.08, t[2] + Math.sin(a) * 0.12, '#FFFFFF', 'skin', { n: 6, rk: 0.1, c0: '#4A2E50', c1: '#8A6A92', seed: seed + i }); } }
    else { const pts = [[0, -0.15, 0, 0.21], [0.02, 0.35, 0, 0.19], [0.03, 0.8, 0.02, 0.15], [0.02, 1.15, 0.02, 0.12]]; K.trunk(pts, '#FFFFFF', 'bark', { n: 7, c0: BK0, c1: BK1, bark: 0.25, seed }); roots(5, 0.19);
      for (let i = 0; i < 3; i++) { const a = i / 3 * PI * 2 + r() * 0.5, R = 0.5 + r() * 0.2, top = [Math.cos(a) * R, 1.75 + r() * 0.35, Math.sin(a) * R]; K.trunk([[0.02, 1.08, 0.02, 0.1], [Math.cos(a) * R * 0.55, 1.45, Math.sin(a) * R * 0.55, 0.075], [top[0], top[1], top[2], 0.05]], '#FFFFFF', 'bark', { n: 5, c0: BK1, c1: '#8E7660', bark: 0.2, seed: seed + 5 + i }); crown(top[0], top[1], top[2], 7, 0.78); } } },
  // rocha: árvore-espinheira (josué alienígena) — tronco fibroso que se ramifica em galhos tortos terminando em rosetas de folhas-espinho com saia de folhas secas; variante 1 = cacto-candelabro com gomos e espinhos
  marco_rocha(K, seed) { const r = rng(seed * 7 + 127), v = seed % 2; K.base = 0;
    if (!v) { const T0 = '#2E2924', T1 = '#665A4C'; K.trunk([[0, -0.15, 0, 0.19], [0.02, 0.4, 0, 0.16], [0.05, 0.85, 0.03, 0.135]], '#FFFFFF', 'bark', { n: 7, c0: T0, c1: T1, bark: 0.35, seed });
      const rosette = (p, sz) => { const nr = K.q(15); for (let i = 0; i < nr; i++) { const a = i * 2.39996 + r() * 0.3, el = 0.2 + (i / nr) * 1.5; K.blade(p[0], p[1], p[2], a, el, 0.15, sz * (0.75 + r() * 0.3), 0.07 * sz / 0.32 * (K.lite ? 1.3 : 1), '#FFFFFF', 'leaf', { n: 2, fold: 0.3, c0: '#2E3C28', c1: i % 3 ? '#A8AE70' : '#C2B67E', nc: p, ku: 0.45, kf: 0.4, ko: 0.55, wind: 0.25 }); }
        for (let i = 0; i < K.q(7); i++) { const a = i / 7 * PI * 2 + r() * 0.4; K.blade(p[0], p[1] - 0.05, p[2], a, 2.3 + r() * 0.3, 0.2, sz * 0.8, 0.07, '#FFFFFF', 'leaf', { n: 2, c0: '#3A2E20', c1: '#7A6446', nc: p, wind: 0.15 }); } };
      const nbr = 3 + (r() * 2 | 0); for (let i = 0; i < nbr; i++) { const a = i / nbr * PI * 2 + (r() - 0.5) * 0.6, R = 0.55 + r() * 0.35, hy = 1.55 + r() * 0.6, mid = [Math.cos(a) * R * 0.45, 1.05 + r() * 0.2, Math.sin(a) * R * 0.45], tip = [Math.cos(a + 0.25) * R, hy, Math.sin(a + 0.25) * R];
        K.trunk([[0.04, 0.8, 0.03, 0.11], [mid[0], mid[1], mid[2], 0.085], [tip[0], tip[1], tip[2], 0.06]], '#FFFFFF', 'bark', { n: 5, c0: T1, c1: '#7E705E', bark: 0.3, seed: seed + i });
        rosette(tip, 0.32 + r() * 0.08); if (r() < 0.5) { const t2 = [mid[0] + Math.cos(a - 0.9) * 0.35, mid[1] + 0.35, mid[2] + Math.sin(a - 0.9) * 0.35]; K.trunk([[mid[0], mid[1], mid[2], 0.07], [t2[0], t2[1], t2[2], 0.045]], '#FFFFFF', 'bark', { n: 4, c0: T1, c1: '#7E705E', seed: seed + 20 + i }); rosette(t2, 0.24); } } }
    else { const C0 = '#1E3634', C1 = '#5E8C84', SP = ['#C8B8A0', '#F2E8D4']; /* verde-azulado alienígena, não o saguaro da Terra */
      K.bulb([[0.27, -0.12], [0.3, 0.2], [0.29, 1.2], [0.26, 1.75], [0.18, 2.1], [0, 2.2]], 0, 0, 0, '#FFFFFF', 'skin', { n: 12, ribs: 6, rk: 0.12, c0: C0, c1: C1, ribC: 0.16, seed });
      const na = 3 + (r() * 2 | 0); for (let i = 0; i < na; i++) { const a = i / na * PI * 2 + (r() - 0.5) * 0.5, hy = 0.55 + r() * 0.55, R = 0.62 + r() * 0.12, top = 0.55 + r() * 0.45, ex = Math.cos(a), ez = Math.sin(a);
        K.trunk([[ex * 0.2, hy, ez * 0.2, 0.15], [ex * R * 0.7, hy + 0.05, ez * R * 0.7, 0.15], [ex * R, hy + 0.3, ez * R, 0.15]], '#FFFFFF', 'skin', { n: 8, c0: C0, c1: '#46706A', seed: seed + i });
        K.bulb([[0.155, hy + 0.25], [0.16, hy + 0.3 + top * 0.6], [0.12, hy + 0.3 + top * 0.92], [0, hy + 0.3 + top]], ex * R, 0, ez * R, '#FFFFFF', 'skin', { n: 10, ribs: 5, rk: 0.12, c0: '#2E4E4A', c1: C1, ribC: 0.16, seed: seed + 9 + i });
        for (let k = 0; k < K.q(3); k++) { const ph = r() * PI * 2, yy = hy + 0.45 + k * top * 0.25, b = [ex * R + Math.cos(ph) * 0.17, yy, ez * R + Math.sin(ph) * 0.17]; K.spike(b, [b[0] + Math.cos(ph) * 0.12, yy + 0.05, b[2] + Math.sin(ph) * 0.12], 0.02, '#FFFFFF', 'bone', { c0: SP[0], c1: SP[1] }); } }
      for (let k = 0; k < (K.lite ? 6 : 12); k++) { const ph = k / 6 * PI + (k > 5 ? 0.25 : 0), yy = k > 5 ? 1.3 : 0.75, b = [Math.cos(ph) * 0.34, yy, Math.sin(ph) * 0.34]; K.spike(b, [b[0] + Math.cos(ph) * 0.16, yy + 0.06, b[2] + Math.sin(ph) * 0.16], 0.025, '#FFFFFF', 'bone', { c0: SP[0], c1: SP[1] }); }
      for (let i = 0; i < 3; i++) { const a = i / 3 * PI * 2 + r(); K.bulb([[0.07, 2.12], [0.1, 2.2], [0.05, 2.28], [0, 2.3]], Math.cos(a) * 0.1, 0, Math.sin(a) * 0.1, '#FFFFFF', 'petal', { n: 6, rk: 0.15, c0: '#8A5068', c1: '#D490A0', seed: seed + i }); } } },
  // gelo: árvore congelada — tronco morto azul-acinzentado em forquilhas, geada nas faces de cima, pingentes e cristais de gelo nos galhos e neve na base
  marco_gelo(K, seed) { const r = rng(seed * 7 + 131); K.base = 0; const T0 = '#262A33', T1 = '#4E5664', FR = ['#E8F0F5', '#D6E2EA', '#F4F8FA'];
    K.crag(0, -0.1, 0, 1.5, 0.3, 1.3, '#FFFFFF', 'snow', { seed: seed * 3, n: 9, strata: 0, top: 'dome', taper: 0.7, flare: 0.3, rough: 0.14, cuts: 0, fis: 0, dark: 0.2, dustK: 0.55, cols: ['#93A4BE'], dust: '#D6DEEA' });
    K.trunk([[0, -0.15, 0, 0.2], [0.04, 0.45, 0.02, 0.165], [-0.02, 0.95, 0.05, 0.13], [0.03, 1.3, 0.02, 0.1]], '#FFFFFF', 'bark', { n: 7, c0: T0, c1: T1, bark: 0.3, seed }); K.patina(FR, 0.7, 0.3, seed);
    const nb = 4 + (r() * 2 | 0); for (let i = 0; i < nb; i++) { const a = i / nb * PI * 2 + (r() - 0.5) * 0.5, y0 = 0.75 + i * 0.12, R = 0.55 + r() * 0.3, mid = [Math.cos(a) * R * 0.5, y0 + 0.35, Math.sin(a) * R * 0.5], tip = [Math.cos(a) * R, y0 + 0.75 + r() * 0.4, Math.sin(a) * R];
      K.trunk([[0, y0, 0.03, 0.08], [mid[0], mid[1], mid[2], 0.06], [tip[0], tip[1], tip[2], 0.02]], '#FFFFFF', 'bark', { n: 5, c0: T1, c1: '#6A7484', bark: 0.2, seed: seed + i }); K.patina(FR, 0.8, 0.2, seed + i);
      for (const da of [-0.7, 0.6]) { const t2 = [mid[0] + Math.cos(a + da) * 0.4, mid[1] + 0.3 + r() * 0.25, mid[2] + Math.sin(a + da) * 0.4]; K.trunk([[mid[0], mid[1], mid[2], 0.04], [t2[0], t2[1], t2[2], 0.0]], '#FFFFFF', 'bark', { n: 3, c0: T1, c1: '#9AA6B4', seed: seed + 30 + i }); }
      for (let k = 0; k < K.q(3); k++) { const f = 0.25 + k * 0.28, p = [mid[0] * (1 - f) + tip[0] * f, mid[1] * (1 - f) + tip[1] * f - 0.03, mid[2] * (1 - f) + tip[2] * f]; K.spike(p, [p[0], p[1] - 0.18 - r() * 0.24, p[2]], 0.04, '#FFFFFF', 'frost', { c0: '#D2E0EC', c1: '#F4F8FA' }); }
      K.xtal(tip[0], tip[1] - 0.06, tip[2], 0.06, 0.32, '#E6EEF3', 'frost', { seed: seed * 11 + i, n: 4, rx: Math.sin(a) * 0.5, rz: -Math.cos(a) * 0.5, glow: 0.25 }); }
    for (let i = 0; i < K.q(7); i++) { const a = r() * PI * 2, d = 0.35 + r() * 0.45, hh = 0.35 + r() * 0.6, lean = 0.25 + r() * 0.45; K.xtal(Math.cos(a) * d, -0.1, Math.sin(a) * d, hh * 0.17, hh, i % 2 ? '#B8D0E8' : '#D8E6F4', 'frost', { seed: seed * 17 + i, n: 5, rx: Math.sin(a) * lean, rz: -Math.cos(a) * lean, glow: 0.4 }); } },
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
  if (BLD[def]) return (K, P, tc, seed) => BLD[def](K, KITS[race] || KITS.vehnar, P, tc, seed);
  for (const r in U) if (U[r][def]) return (K, P, tc) => U[r][def](K, P, tc);
  return null;
}
function build(def, race, color, seed, opts) { /* 4.3d: opts.lite = versão leve (nível de detalhe 1): menos lados e trechos (K.q, segmentos) e sem as peças de K.fine */
  T = T || globalThis.THREE; if (!T) return null;
  const K = new Kit(), lite = !!(opts && opts.lite), lod0 = LOD; if (lite) { K.lite = true; LOD = Math.min(LOD, 0.55); }
  try {
    if (NEUTRAL[def]) { NEUTRAL[def](K, seed | 0); return K.finish(); }
    if (def.startsWith('prop_')) { const f = PROPS[def.slice(5)]; if (!f) return null; f(K, seed | 0); return K.finish(); }
    race = PAL[race] ? race : 'vehnar'; const P = PAL[race]; const tc = color || '#FF8C1A';
    if (FULL[def]) { const a = recipe(race, FULL[def][0]), b = recipe(race, FULL[def][1]); if (!a || !b) return null; a(K, P, tc); const m = K.mount || 0; K.mount = null; K.oy = m; b(K, P, tc); K.oy = 0; return K.finish({ pivot: [0, 0] }); }
    const f = recipe(race, def); if (!f) return null; f(K, P, tc, seed | 0); return K.finish({ pivot: [0, 0] });
  } catch (err) { console.warn('[ARD] malha ' + def + '/' + race + ' falhou: ' + err.message); return null; } finally { LOD = lod0; }
}
// 4.3b: geometria de pedra solta para o dress3d (kind 'boulder' = matacão com estratos; 'stone'/'pebble' = pedra lascada), base em y=0 e ~2 de largura;
// a cor por vértice (sombra na base, topo claro) é quase branca: multiplica a cor do material se ele usar vertexColors
// 4.3c: a flora do dress3d (FLORA_DEFS, receitas do NEUTRAL com o mesmo nome) também passa por aqui; a parte emissiva (brasa, fungo) vem na mesma
// geometria marcada no atributo aGlow (1 = emite a própria cor), com rugosidade/metal em rm e peso do vento em aWind; userData.leafy = tem folhas (dupla face)
const FLORA_DEFS = ['capim', 'folhagem', 'samambaia', 'flor', 'liquen', 'cristal', 'espinho', 'neve', 'geada', 'seco', 'suculenta', 'toco', 'cascalho', 'respiro', 'cinza', 'obsidiana', 'fungo', 'marco_tundra', 'marco_rocha', 'marco_gelo'];
function mergeEm(a, b) { const na = a.attributes.position.count, nb = b.attributes.position.count, g = new T.BufferGeometry();
  for (const k of new Set([...Object.keys(a.attributes), ...Object.keys(b.attributes)])) { const A = a.attributes[k], B = b.attributes[k], sz = (A || B).itemSize, arr = new Float32Array((na + nb) * sz);
    if (A) arr.set(A.array, 0); else if (k === 'rm') for (let i = 0; i < na; i++) arr[i * 2] = 1;
    if (B) arr.set(B.array, na * sz); else if (k === 'rm') for (let i = 0; i < nb; i++) arr[(na + i) * 2] = 1;
    g.setAttribute(k, new T.BufferAttribute(arr, sz)); }
  const gl = new Float32Array(na + nb); gl.fill(1, na); g.setAttribute('aGlow', new T.BufferAttribute(gl, 1)); g.computeBoundingSphere(); a.dispose(); b.dispose(); return g; }
function scatter(kind, seed, lite) { T = T || globalThis.THREE; if (!T) return null; const K = new Kit(), lod0 = LOD; K.lite = !!lite; if (lite) LOD = Math.min(LOD, 0.6); /* 4.3c: versão leve para longe */ try {
    if (FLORA_DEFS.includes(kind)) NEUTRAL[kind](K, seed | 0); else NEUTRAL.seixo(K, ((seed | 0) << 1) | (kind === 'boulder' ? 0 : 1));
    const f = K.finish(), g = f.em ? mergeEm(f.main, f.em) : f.main; g.userData.leafy = !!K.leafy; g.userData.width = f.width; g.userData.height = f.height; return g; } catch (err) { console.warn('[ARD] adereço ' + kind + ' falhou: ' + err.message); return null; } finally { LOD = lod0; } }
// material padrão das malhas: rugosidade e metal vêm do atributo rm por vértice; rim opcional por Raça
function material(o) { T = T || globalThis.THREE; o = o || {}; const m = new T.MeshStandardMaterial(Object.assign({ vertexColors: true, roughness: 1, metalness: 1, envMapIntensity: o.env == null ? 1 : o.env }, o.params || {}));
  m.onBeforeCompile = sh => {
    sh.uniforms.uDet = DET; // 4.3a
    sh.vertexShader = 'attribute vec2 rm;\nattribute float pt;\nvarying vec2 vRM;\nvarying float vPt; varying vec3 vLoc; varying vec3 vLocN;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvRM = rm; vPt = pt; vLoc = position; vLocN = normal;'); if (!o.noAnim) animShader(sh); // 4.2b; 4.3a: padrão preso à peça (posição de repouso)
    sh.fragmentShader = 'varying vec2 vRM;\n' + SURF_GLSL + sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\nfloat ardHh = 0.0, ardAlb = 1.0, ardRg = 0.0; ardSurf(ardHh, ardAlb, ardRg); diffuseColor.rgb *= ardAlb;').replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = clamp(vRM.x + ardRg, 0.04, 1.0);').replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = vRM.y;').replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nif (ardHh != 0.0) normal = ardPerturb(-vViewPosition, normal, vec2(dFdx(ardHh), dFdy(ardHh)) * 0.9, faceDirection);');
    if (o.rim) sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n{ float rim = pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), ' + o.rim.pow.toFixed(2) + '); totalEmissiveRadiance += vec3(' + o.rim.col.map(v => v.toFixed(3)).join(', ') + ') * (rim * ' + o.rim.amt.toFixed(3) + '); }');
    if (o.onShader) o.onShader(sh);
  };
  m.defaultAttributeValues = Object.assign({}, m.defaultAttributeValues, ANIM_DEFAULTS, { pt: [0] }); m.customProgramCacheKey = () => 'ard-mesh-v43-' + (o.key || 'base') + (o.noAnim ? '-sem-anim' : ''); return m; }
const BUILDING_DEFS = ['nucleo', 'reator', 'refinaria', 'quartel', 'fabrica', 'hangar', 'torre', 'nodulo', 'laboratorio', 'muro', 'portao', 'bastiao'];
const GENERIC_UNITS = ['coletor', 'infantaria', 'veiculo', 'drone', 'suporte', 'pirata'];
function unitsOf(race) { return GENERIC_UNITS.concat(Object.keys(U[race] || {}).filter(d => !GENERIC_UNITS.includes(d) && !d.startsWith('veiculo_') && !d.startsWith('_'))); } /* 4.3d: '_nome' = ajudante interno da Raça, não é unidade */
ARD.meshes = { setLod(v) { LOD = Math.max(0.4, Math.min(1, v)); }, setDetail(v) { DET.value = Math.max(0, Math.min(1, v)); }, /* 4.3a: detalhe de superfície pela qualidade */ build, scatter, /* 4.3b */ FLORA_DEFS, /* 4.3c */ material, animShader, ANIM_DEFAULTS, ANIM_T, PAL, MAT, BUILDING_DEFS, GENERIC_UNITS, unitsOf, NEUTRAL_DEFS: Object.keys(NEUTRAL), PROP_RACES: Object.keys(PROPS), FULL };
})(globalThis.ARD = globalThis.ARD || {});
