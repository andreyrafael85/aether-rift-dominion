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
  infantaria(K, P, tc, o) { o = o || {};
    for (const s of [-1, 1]) K.anim(legSpec([0.15, 3.2, s * 0.75], { amp: 0.4, stride: 5 }), () => { K.seg([0, 0.4, s * 0.8], [0.15, 3.2, s * 0.75], 0.55, P.d, 'dark'); K.box(0.35, 0, s * 0.8, 1.7, 0.6, 1.1, P.d, 'rubber', { b: 0.2 }); });
    K.box(0, 3, 0, 2.4, 3.2, 3, P.a, 'steel', { b: 0.45 }); K.box(0.95, 3.5, 0, 0.6, 2.2, 2.3, tc, 'paint', { b: 0.15 });
    for (const s of [-1, 1]) K.sph(0, 5.9, s * 1.7, 0.85, tc, 'paint', { seg: 12 });
    K.box(-1.55, 3.4, 0, 1.2, 2.6, 2.2, P.b, 'steel', { b: 0.3 }); K.sph(0.1, 6.9, 0, 1.15, P.b, 'steel', { seg: 14 }); K.box(1.15, 6.62, 0, 0.5, 0.5, 1.5, P.g, null, { e: 1.8 });
    K.seg([0.1, 5.5, 1.5], [1.3, 4.6, 1.0], 0.38, P.a, 'steel'); K.seg([0.1, 5.5, -1.5], [1.7, 4.6, 0.3], 0.38, P.a, 'steel');
    if (!o.noRifle) K.anim({ t: 'recoil', dist: 0.4 }, () => { K.box(2.2, 4.3, 0.95, 4, 0.55, 0.55, P.d, 'metal', { b: 0.12 }); K.box(3.7, 4.15, 0.95, 1.4, 0.85, 0.5, P.b, 'metal'); }); },
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
  veiculo_hull(K, P, tc) { for (const s of [-1, 1]) track(K, P, 0, s * 3.5, 13, 2.4, 2.2);
    K.poly([[-6.2, 1.2], [5.2, 1.2], [6.6, 2.6], [5.4, 4.0], [-5.6, 4.0], [-6.4, 2.8]], 5.2, P.a, 'steel', { b: 0.3 });
    K.box(-0.4, 4.25, 0, 7.6, 0.2, 5, tc, 'paint'); K.light(6.25, 3.1, 2, 0.45, P.l); K.light(6.25, 3.1, -2, 0.45, P.l); K.light(-6.45, 3.0, 0, 0.5, '#FF4040'); K.mount = 4.3; },
  veiculo_turret(K, P, tc) { KITS.vehnar.turret(K, P, tc, 0.85, false); },
  drone(K, P, tc) { K.box(0, 1.2, 0, 4, 1.6, 3, P.a, 'steel', { b: 0.5 }); K.box(0.4, 2.8, 0, 2, 0.5, 2, tc, 'paint', { b: 0.2 });
    for (const [sx, sz] of QUAD) { K.seg([0, 2, 0], [sx * 3.4, 2.3, sz * 3.4], 0.25, P.d, 'metal'); K.anim({ t: 'spin', p: [sx * 3.4, 2.3, sz * 3.4], speed: sx * sz * 26 }, () => { K.tor(sx * 3.4, 2.3, sz * 3.4, 1.6, 0.14, P.d, 'metal', { ts: 20 }); K.cyl(sx * 3.4, 2.15, sz * 3.4, 1.5, 1.5, 0.06, '#9AA3AD', 'glass'); K.light(sx * 3.4, 2.5, sz * 3.4, 0.3, P.l); }); }
    K.box(1.6, 0, 0, 1.4, 1.2, 0.8, P.d, 'metal'); K.seg([2.2, 0.5, 0], [4.2, 0.5, 0], 0.18, P.d, 'metal', { anim: { t: 'recoil', dist: 0.4 } }); K.light(-2.1, 1.8, 0, 0.4, '#FF4040'); },
  suporte(K, P, tc) { K.box(0, 0.6, 0, 7, 1.8, 5, P.a, 'steel', { b: 0.5 }); K.box(0, 2.4, 0, 5, 0.6, 3.6, tc, 'paint', { b: 0.2 });
    K.cyl(-0.5, 3, 0, 0.4, 0.5, 2.2, P.b, 'metal'); K.anim({ t: 'spin', p: [-0.5, 5.2, 0], speed: 1.2 }, () => { K.lathe([[0.2, 0], [1.4, 0.35], [2.4, 1.1], [2.6, 1.3], [2.4, 1.38], [1.3, 0.62], [0, 0.32]], -0.5, 5.2, 0, P.t, 'metal', { rz: -0.5 }); K.sph(-0.2, 5.8, 0, 0.35, '#7FE3A1', null, { e: 2.6 }); });
    for (const s of [-1, 1]) K.cyl(0, 0, s * 1.8, 1.2, 1.4, 0.6, '#3FE6CF', null, { e: 1.4, anim: { t: 'bob', amp: 0.1, speed: 4, ph: s > 0 ? 0 : PI } }); K.light(3.6, 1.6, 0, 0.45, P.l); },
  pirata(K, P, tc) { for (const x of [-4, -1.2, 3.6]) for (const s of [-1, 1]) wheel(K, P, x, 1.3, s * 3.6, 1.3, 1.1);
    K.box(0, 1.2, 0, 12, 1.4, 6, P.d, 'dark', { b: 0.3 }); K.box(3.8, 2.6, 0, 3.6, 3.4, 5.6, tc, 'paint', { b: 0.5 }); K.box(5.25, 3.8, 0, 0.9, 1.6, 4.6, P.g, 'glass', { b: 0.2 });
    K.box(-2, 2.6, 0, 6, 1.2, 5.6, P.a, 'steel', { b: 0.3 }); K.cyl(-3.4, 3.8, 0, 1.1, 1.3, 1.2, P.b, 'metal'); K.seg([-3.4, 4.6, 0], [-6.8, 8.4, 0], 0.45, P.h, 'paint'); K.anim({ t: 'sway', p: [-6.8, 8.4, 0], amp: 0.15, speed: 2.2 }, () => { K.seg([-6.8, 8.4, 0], [-7.4, 5.4, 0], 0.1, P.d, 'metal'); K.tor(-7.4, 5.0, 0, 0.5, 0.14, P.t, 'metal', { rx: H }); });
    K.light(5.65, 5.6, 1.9, 0.4, P.l); K.light(5.65, 5.6, -1.9, 0.4, P.l); K.light(5.65, 5.6, 0, 0.4, '#FFA03A'); },
  soldador(K, P, tc) { U.vehnar.infantaria(K, P, tc, { noRifle: true }); for (const s of [-1, 1]) K.cyl(-1.95, 3.1, s * 0.7, 0.62, 0.62, 3.4, P.h, 'paint', { seg: 12 });
    K.anim({ t: 'recoil', dist: 0.3 }, () => { K.seg([1, 4.3, 1], [4.4, 4.1, 1], 0.32, P.d, 'metal'); K.cyl(4.4, 4.1, 1, 0.52, 0.34, 0.9, P.b, 'metal', { rz: -H }); K.light(5.45, 4.1, 1, 0.34, '#FF7A2E', 3); }); K.tube([[-1.9, 3.6, 0.6], [-0.6, 3, 1.4], [1, 4.1, 1.1]], 0.15, P.d, 'rubber'); },
  guindaste(K, P, tc) { for (const x of [-4, 0, 4]) for (const s of [-1, 1]) wheel(K, P, x, 1.2, s * 3.5, 1.2, 1);
    K.box(0, 1.1, 0, 12, 1.4, 6, P.d, 'dark', { b: 0.3 }); K.box(4.2, 2.5, 0, 3.4, 3.2, 5.6, P.h, 'paint', { b: 0.5 }); K.box(5.55, 3.6, 0, 0.9, 1.5, 4.6, P.g, 'glass', { b: 0.2 });
    K.cyl(-2, 2.5, 0, 1.6, 1.9, 1.4, P.b, 'metal'); K.seg([-2, 3.6, 0], [-7, 10, 0], 0.5, P.h, 'paint'); K.seg([-2.4, 3.6, 0.5], [-6.8, 9.6, 0.5], 0.14, P.d, 'metal'); K.seg([-7, 10, 0], [-7, 6.4, 0], 0.08, P.d, 'metal', { anim: { t: 'sway', p: [-7, 10, 0], amp: 0.14, speed: 2 } });
    K.anim({ t: 'sway', p: [-7, 10, 0], amp: 0.14, speed: 2 }, () => { K.box(-7, 5.4, 0, 1.2, 1, 1.2, P.d, 'metal'); K.sph(-7, 5.2, 0, 0.45, '#7FE3A1', null, { e: 2.2 }); }); K.box(-3, 2.5, 0, 5, 0.8, 5.4, tc, 'paint', { b: 0.2 });
    K.light(6.05, 5.4, 2, 0.4, P.l); K.light(6.05, 5.4, -2, 0.4, P.l); K.light(4.2, 5.9, 0, 0.5, '#FFA03A'); },
  tratorzao(K, P, tc) { for (const x of [-3, 3]) for (const s of [-1, 1]) wheel(K, P, x, 1.6, s * 3.4, 1.6, 1.3);
    K.box(0, 1.4, 0, 8.4, 1.2, 4.4, P.a, 'steel', { b: 0.4 }); K.box(1.6, 2.6, 0, 2.4, 0.4, 4, tc, 'paint', { b: 0.15 });
    for (const s of [-1, 1]) { K.seg([-2.4, 2.6, s * 1.8], [-1, 5, s * 1.6], 0.16, P.d, 'metal'); K.seg([1.4, 2.6, s * 1.8], [-0.2, 5, s * 1.6], 0.16, P.d, 'metal'); }
    K.seg([-1, 5, -1.6], [-1, 5, 1.6], 0.16, P.d, 'metal'); K.seg([-0.2, 5, -1.6], [-0.2, 5, 1.6], 0.16, P.d, 'metal'); K.box(-0.6, 5.1, 0, 1.2, 0.6, 1, P.b, 'metal'); K.seg([0, 5.5, 0], [2.8, 5.5, 0], 0.16, P.d, 'metal', { anim: { t: 'recoil', dist: 0.4 } });
    K.light(4.3, 2.2, 1.4, 0.4, P.l); K.light(4.3, 2.2, -1.4, 0.4, P.l); },
  prensa(K, P, tc) { for (const s of [-1, 1]) { leg(K, [0, 6.4, s * 2.4], [1.4, 3.4, s * 2.8], [0, 0.6, s * 2.8], 0.8, P.b, 'steel'); K.anim(legSpec([0, 6.4, s * 2.4]), () => K.box(0.6, 0, s * 2.8, 3.2, 0.8, 2, P.d, 'dark', { b: 0.3 })); }
    K.box(0, 6, 0, 4, 1.6, 5.4, P.d, 'dark', { b: 0.4 }); K.box(0, 7.4, 0, 5.4, 3.8, 5, P.a, 'steel', { b: 0.6 }); K.box(2.65, 8.6, 0, 0.6, 1.2, 3, P.g, 'glass', { b: 0.2 }); K.box(-0.4, 11.2, 0, 3.6, 0.5, 3.6, tc, 'paint', { b: 0.2 });
    for (const s of [-1, 1]) { K.box(0.4, 8.2, s * 3.4, 3, 2, 1.6, P.b, 'steel', { b: 0.3 }); K.anim({ t: 'recoil', dist: 0.9 }, () => { K.seg([1.8, 9.1, s * 3.4], [7.4, 9.1, s * 3.4], 0.42, P.d, 'metal'); K.cyl(7.4, 9.1, s * 3.4, 0.6, 0.6, 0.9, P.d, 'dark', { rz: -H }); }); }
    K.light(-2.85, 9.6, 0, 0.5, '#FF4040'); },
};
U.erevane = {
  infantaria(K, P, tc, o) { o = o || {};
    for (const s of [-1, 1]) { K.anim(legSpec([0.1, 3.4, s * 0.6], { amp: 0.38, stride: 5 }), () => { K.seg([0, 0.3, s * 0.7], [0.1, 3.4, s * 0.6], 0.42, P.b, 'gloss'); K.box(0.3, 0, s * 0.7, 1.3, 0.45, 0.8, P.d, 'rubber', { b: 0.15 }); }); }
    K.poly([[-1.1, 0], [1.1, 0], [0.8, 3], [-0.9, 3.2]], 2.4, P.a, 'gloss', { y: 3.2, b: 0.15 }); K.box(0.95, 4.3, 0, 0.12, 1.6, 1.8, tc, null, { e: 1.6 });
    K.oct(0.1, 6.2, 0, 0.95, 1.9, P.b, 'gloss'); K.box(0.8, 7.05, 0, 0.3, 0.16, 1.1, P.l, null, { e: 3 }); K.poly([[0, 0], [-1.6, -2.6], [-0.4, -2.8]], 0.12, P.d, 'gloss', { x: -1, y: 6.2, anim: { t: 'sway', p: [-1, 6.2, 0], amp: 0.12, speed: 2.5 } });
    K.seg([0.1, 6, 1.3], [1.3, 4.9, 0.95], 0.3, P.a, 'gloss'); K.seg([0.1, 6, -1.3], [1.6, 4.9, 0.3], 0.3, P.a, 'gloss');
    if (!o.noRifle) K.anim({ t: 'recoil', dist: 0.35 }, () => { K.box(2.4, 4.6, 0.9, 4.6, 0.36, 0.36, P.d, 'metal'); K.box(4.8, 4.6, 0.9, 0.5, 0.2, 0.2, P.c, null, { e: 2.2 }); }); },
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
  veiculo_hull(K, P, tc) { K.poly([[-6.6, 1.4], [5, 1.4], [7, 2.4], [4.6, 3.6], [-5.4, 3.6], [-6.8, 2.6]], 7.4, P.a, 'gloss', { b: 0.25 });
    for (const [x, s] of [[-4, 1], [-4, -1], [3.4, 1], [3.4, -1]]) K.anim({ t: 'bob', amp: 0.12, speed: 3, ph: (x > 0 ? 0 : PI) + (s > 0 ? 0 : H) }, () => { K.cyl(x, 0.6, s * 3, 1.3, 1.5, 0.8, P.d, 'dark'); K.cyl(x, 0.45, s * 3, 1.1, 1.1, 0.16, P.c, null, { e: 2 }); });
    K.box(-0.6, 3.62, 3.9, 9, 0.12, 0.12, tc, null, { e: 1.8 }); K.box(-0.6, 3.62, -3.9, 9, 0.12, 0.12, tc, null, { e: 1.8 }); K.mount = 3.75; },
  veiculo_turret(K, P, tc) { KITS.erevane.turret(K, P, tc, 0.8, false); },
  drone(K, P, tc) { K.anim({ t: 'bob', amp: 0.35, speed: 2.4 }, () => { K.poly([[4, 0], [-2.6, 4.8], [-1.2, 0], [-2.6, -4.8]], 0.5, P.a, 'gloss', { rx: -H, y: 2, b: 0.1 }); K.oct(-0.4, 1.4, 0, 1, 1.6, P.b, 'glass', { sx: 1.8 });
    for (const s of [-1, 1]) K.seg([4, 2.25, 0], [-2.6, 2.25, s * 4.8], 0.08, tc, null, { e: 2 }); K.light(-1.2, 2.5, 0, 0.4, P.l); }); },
  suporte(K, P, tc) { const hv = { t: 'bob', amp: 0.22, speed: 2.2 }; K.anim(hv, () => { K.prism(0, 1.4, 0, 2.8, 2.2, 3, P.a, 'gloss', { top: 0.6 }); K.cone(0, 3.6, 0, 0.5, 3.4, P.b, 'gloss', { seg: 4 }); K.oct(0, 7.2, 0, 0.4, 0.8, P.l, null, { e: 3 }); }); K.cyl(0, 0.6, 0, 2, 2.2, 0.2, P.c, null, { e: 1.4 }); K.box(1.45, 2.6, 0, 0.12, 0.6, 1.6, tc, null, { e: 1.8, anim: hv }); },
  pirata(K, P, tc) { K.poly([[-5.4, 0.9], [4.4, 0.9], [6, 1.8], [3, 3], [-4.8, 3]], 5.2, P.a, 'gloss', { b: 0.2 });
    for (const x of [-3.4, 3]) for (const s of [-1, 1]) K.anim({ t: 'bob', amp: 0.1, speed: 3, ph: (x > 0 ? 0 : PI) + (s > 0 ? 0 : H) }, () => { K.cyl(x, 0.4, s * 2.7, 0.9, 1, 0.6, P.d, 'dark'); K.cyl(x, 0.3, s * 2.7, 0.75, 0.75, 0.12, P.c, null, { e: 1.8 }); });
    K.cyl(-1.8, 3, 0, 1.4, 1.4, 2.2, P.g, 'glass', { seg: 6, facet: true }); K.tor(-1.8, 4.1, 0, 1.42, 0.08, P.l, null, { e: 2.4, ts: 6, anim: { t: 'spin', p: [-1.8, 4.1, 0], speed: 1 } }); K.anim({ t: 'sway', p: [-1.8, 5, 0], amp: 0.02, speed: 2.2 }, () => { K.tube([[-1.8, 5, 0], [1, 5.4, 0], [4, 3.6, 0], [6.2, 2.4, 0]], 0.22, P.d, 'rubber'); K.light(6.2, 2.2, 0, 0.4, P.l); }); },
  atirador(K, P, tc) { U.erevane.infantaria(K, P, tc, { noRifle: true }); K.anim({ t: 'recoil', dist: 0.5 }, () => { K.box(3.2, 4.7, 0.9, 7.4, 0.3, 0.3, P.d, 'metal'); K.cyl(1.6, 5.05, 0.9, 0.22, 0.22, 1.6, P.b, 'gloss', { rz: -H }); K.box(6.95, 4.7, 0.9, 0.5, 0.18, 0.18, P.c, null, { e: 2.4 }); K.box(-0.2, 4.5, 0.9, 1.2, 0.8, 0.4, P.b, 'gloss'); }); },
  lamina(K, P, tc) { K.poly([[-5, 0.8], [3.4, 0.8], [6.4, 1.2], [2, 2.8], [-4.4, 2.6]], 4.4, P.a, 'gloss', { b: 0.2 });
    for (const s of [-1, 1]) K.anim({ t: 'spin', p: [1.2, 1.6, s * 2.75], axis: 'z', speed: -22 }, () => { K.cyl(1.2, 1.6, s * 2.75 - 0.15, 2.2, 2.2, 0.3, '#7D8794', 'metal', { rx: H, seg: 20 }); K.tor(1.2, 1.6, s * 2.75, 2.25, 0.08, P.l, null, { e: 2.4, rx: H, ts: 24 }); });
    K.box(-1.6, 2.75, 0, 3, 0.2, 2, tc, null, { e: 1.6 }); K.cyl(-3.6, 0.3, 0, 1.2, 1.2, 0.2, P.c, null, { e: 1.6 }); },
  mosquito(K, P, tc) { K.oct(0, 1.2, 0, 0.8, 1.2, P.a, 'gloss', { sx: 2 }); for (const s of [-1, 1]) K.poly([[0, 0], [-1.6, s * 2.6], [-0.4, s * 2.8]], 0.08, P.b, 'glass', { rx: -H, y: 1.8, anim: { t: 'flap', p: [0, 1.8, -s * 0.6], amp: 0.5, speed: 28, side: -s } }); K.light(1.45, 1.7, 0, 0.3, P.l); K.light(-1.45, 1.7, 0, 0.25, tc); },
  ancora(K, P, tc) { ringOf(3, 2.8, (cx, cz) => K.seg([cx, 0, cz], [cx * 0.25, 5.2, cz * 0.25], 0.32, P.d, 'gloss', { anim: legSpec([cx * 0.25, 5.2, cz * 0.25], { amp: 0.22 }) })); K.sph(0, 6.4, 0, 1.7, P.b, 'glass', { seg: 16 }); K.tor(0, 6.4, 0, 3, 0.12, P.l, null, { e: 2.6, rx: 0.3, ts: 32, anim: { t: 'spin', p: [0, 6.4, 0], speed: 2.4 } }); K.tor(0, 6.4, 0, 2.6, 0.08, tc, null, { e: 2, rz: 0.5, ts: 32, anim: { t: 'spin', p: [0, 6.4, 0], speed: -3 } }); K.anim({ t: 'sway', p: [0, 7.9, 0], amp: 0.08, speed: 2.4 }, () => { K.cone(0, 7.9, 0, 0.35, 2.4, P.a, 'gloss', { seg: 4 }); K.oct(0, 10.4, 0, 0.3, 0.7, P.l, null, { e: 3 }); }); },
};
U.tessara = {
  infantaria(K, P, tc, o) { o = o || {};
    for (const s of [-1, 1]) K.anim(legSpec([0, 3.4, s * 0.8], { amp: 0.38, stride: 5 }), () => { K.seg([-0.4, 0, s * 0.8], [0.5, 1.6, s * 0.8], 0.42, P.b, 'bone'); K.seg([0.5, 1.6, s * 0.8], [0, 3.4, s * 0.75], 0.5, P.b, 'bone'); });
    K.sph(0, 4.6, 0, 1, P.a, 'bone', { sx: 1.25, sy: 1.6, sz: 1.35, seg: 14 }); K.sph(-1.05, 5, 0, 0.75, '#A8EBB8', null, { e: 1.2, seg: 12 });
    K.sph(0.4, 6.8, 0, 0.85, P.a, 'bone', { sx: 1.2, seg: 12 }); K.light(1.35, 6.95, 0.35, 0.22, P.l); K.light(1.35, 6.95, -0.35, 0.22, P.l); K.box(0.6, 5.7, 0, 0.5, 0.5, 2.5, tc, 'skin', { b: 0.2 });
    K.seg([0.2, 5.6, 1.3], [1.3, 4.7, 1.1], 0.32, P.b, 'bone'); K.seg([0.2, 5.6, -1.3], [1.6, 4.7, 0.4], 0.32, P.b, 'bone');
    if (!o.noRifle) { K.seg([0.6, 4.6, 1.1], [4.2, 4.8, 1.1], 0.3, P.t, 'bone', { taper: 0.7, anim: { t: 'recoil', dist: 0.35 } }); K.sph(1.2, 4.6, 1.1, 0.55, P.l, null, { e: 1.4, seg: 10 }); } },
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
  veiculo_hull(K, P, tc) { K.sph(0, 1.4, 0, 1, P.a, 'bone', { half: true, sx: 6.4, sy: 3.2, sz: 4.4, seg: 20 }); for (let i = 0; i < 3; i++) arch(K, 0, 1.4, 0, 6.5, 3.25, 4.5, i * PI / 3 + PI / 6, 0.2, P.t, 'bone');
    K.tor(0, 1.5, 0, 6.2, 0.4, P.d, 'matte', { sz: 0.7, ts: 30 }); for (const [x, s] of [[-3.6, 1], [-3.6, -1], [3.2, 1], [3.2, -1]]) leg(K, [x, 2, s * 3.6], [x + 0.6, 1.4, s * 5], [x + 0.4, 0, s * 5.2], 0.7, P.b, 'bone');
    K.sph(6.4, 2, 0, 1.5, P.b, 'bone', { sx: 1.2, seg: 12 }); K.light(7.75, 2.4, 0.6, 0.3, P.l); K.light(7.75, 2.4, -0.6, 0.3, P.l); K.box(-1, 4.4, 0, 5, 0.3, 2, tc, 'skin', { b: 0.12 }); K.mount = 4.4; },
  veiculo_turret(K, P, tc) { KITS.tessara.turret(K, P, tc, 0.8, false); },
  drone(K, P, tc) { K.sph(0, 2, 0, 1.3, P.a, 'bone', { sx: 2, seg: 14 }); K.sph(2.4, 2.2, 0, 0.8, P.b, 'bone', { seg: 10 }); K.light(3.15, 2.4, 0.35, 0.22, P.l); K.light(3.15, 2.4, -0.35, 0.22, P.l);
    for (const s of [-1, 1]) { K.sph(0.4, 2.8, s * 2.6, 1, '#CFF3D8', 'wet', { sx: 1.1, sy: 0.08, sz: 2.4, ry: s * 0.3, seg: 12, anim: { t: 'flap', p: [0.4, 2.8, s * 0.9], amp: 0.6, speed: 24, side: s } }); K.sph(-1.2, 2.6, s * 2.2, 1, '#BFE8C8', 'wet', { sx: 0.8, sy: 0.07, sz: 1.8, ry: -s * 0.4, seg: 12, anim: { t: 'flap', p: [-1.2, 2.6, s * 0.9], amp: 0.5, speed: 24, ph: 1.2, side: s } }); }
    K.sph(-2.3, 2, 0, 0.6, P.l, null, { e: 1.6, seg: 10 }); K.box(0, 3.2, 0, 1.6, 0.2, 0.6, tc, 'skin'); },
  suporte(K, P, tc) { K.sph(0, 2.4, 0, 1.8, P.a, 'bone', { sy: 1.2, seg: 14 }); ringOf(5, 1.9, (cx, cz, a) => K.sph(cx, 3.6, cz, 1.2, '#8FD8A0', 'skin', { sx: 0.35, sy: 1.5, sz: 0.8, ry: -a, seg: 10, anim: { t: 'sway', p: [cx, 2.4, cz], amp: 0.12, speed: 2.2, ph: a } })); K.sph(0, 4.6, 0, 0.8, P.l, null, { e: 2.2, seg: 12 }); K.cyl(0, 0.5, 0, 1.6, 1.8, 0.2, P.l, null, { e: 1.2 }); K.box(0, 1.2, 0, 2, 0.3, 2, tc, 'skin', { b: 0.1 }); },
  pirata(K, P, tc) { K.sph(0, 1.2, 0, 1, P.a, 'bone', { half: true, sx: 4.4, sy: 2.6, sz: 3, seg: 16 }); for (const x of [-2.4, 0, 2.4]) for (const s of [-1, 1]) leg(K, [x, 1.6, s * 2.4], [x + 0.6, 1.4, s * 3.8], [x + 0.4, 0, s * 4], 0.3, P.b, 'bone');
    K.sph(-2, 3.3, 0, 1.4, '#9EE6B0', null, { e: 1.1, seg: 12 }); K.anim({ t: 'sway', p: [1.4, 3.4, 0], amp: 0.08, speed: 2.4 }, () => { K.tube([[1.4, 3.4, 0], [3, 5.6, 0], [5.4, 5.4, 0], [6.4, 3.2, 0]], 0.3, P.t, 'bone', { ts: 14 }); K.cone(6.4, 3.4, 0, 0.45, 1.6, P.l, null, { e: 2, rz: PI }); }); K.box(0, 3.8, 0, 3, 0.3, 1.4, tc, 'skin'); },
  quimera(K, P, tc) { U.tessara.infantaria(K, P, tc); for (const s of [-1, 1]) K.cone(-0.7, 5.6, s * 1.1, 0.3, 1.8, P.t, 'bone', { rx: s * -0.6, rz: 0.5, seg: 8 }); K.cone(-0.2, 7.4, 0, 0.25, 1.4, P.t, 'bone', { rz: 0.4, seg: 8 }); },
  esporo(K, P, tc) { K.sph(0, 2.6, 0, 1.8, '#CFEFD6', 'wet', { seg: 14 }); ringOf(6, 1.62, (cx, cz, a) => K.sph(cx, 2.6 + (cx > 0 ? 0.5 : -0.4), cz, 0.35, P.l, null, { e: 1.8, seg: 8, anim: { t: 'bob', amp: 0.1, speed: 3, ph: a * 2 } }));
    for (let i = 0; i < 4; i++) { const a = i * H; K.tube([[Math.cos(a) * 0.8, 1.2, Math.sin(a) * 0.8], [Math.cos(a + 0.4) * 1.3, 0.4, Math.sin(a + 0.4) * 1.3], [Math.cos(a + 0.8) * 1.5, -0.6, Math.sin(a + 0.8) * 1.5]], 0.12, P.t, 'bone', { ts: 8, anim: { t: 'sway', p: [Math.cos(a) * 0.8, 1.2, Math.sin(a) * 0.8], amp: 0.16, speed: 2.6, ph: i * 1.6 } }); } K.box(0, 4.3, 0, 1, 0.3, 1, tc, 'skin', { b: 0.1 }); },
  molde(K, P, tc) { U.tessara.suporte(K, P, tc); K.tor(0, 2.4, 0, 2.6, 0.18, P.l, null, { e: 1.8, ts: 28, anim: { t: 'bob', amp: 0.3, speed: 2 } }); K.sph(0, 5.6, 0, 0.5, P.am, null, { e: 2.4, seg: 10 }); },
  colosso(K, P, tc) { for (const s of [-1, 1]) { leg(K, [0, 7, s * 3], [1.8, 3.8, s * 3.6], [0.4, 0.4, s * 3.6], 1.1, P.b, 'bone'); K.sph(0.8, 0.2, s * 3.6, 1.4, P.d, 'matte', { half: true, sx: 1.6, seg: 12, anim: legSpec([0, 7, s * 3]) }); }
    K.sph(0, 9, 0, 3.6, P.a, 'bone', { sx: 1.25, sy: 0.95, seg: 18 }); for (let i = 0; i < 3; i++) arch(K, 0, 8.4, 0, 4.6, 4, 3.7, i * PI / 3 + PI / 6, 0.22, P.t, 'bone');
    K.sph(3.8, 9.8, 0, 1.4, P.b, 'bone', { seg: 12 }); K.light(5.05, 10.2, 0.5, 0.3, P.l); K.light(5.05, 10.2, -0.5, 0.3, P.l);
    for (const s of [-1, 1]) K.anim({ t: 'recoil', dist: 0.9 }, () => { K.seg([1, 9, s * 4.2], [8.2, 9.4, s * 4.2], 0.9, P.b, 'bone', { taper: 0.6, seg: 12 }); K.sph(8.2, 9.4, s * 4.2, 0.6, P.l, null, { e: 2.2, seg: 10 }); });
    K.sph(-2.6, 11.4, 0, 1.6, '#9EE6B0', null, { e: 1.2, seg: 12 }); K.box(0, 12.2, 0, 3, 0.4, 2, tc, 'skin', { b: 0.15 }); },
};
U.quorith = {
  infantaria(K, P, tc) { K.prism(0, 0, 0, 1.4, 0.3, 6, P.c, null, { e: 1.6 }); K.oct(0, 1.2, 0, 1.3, 5.2, P.a, 'crystal'); K.tor(0, 3.8, 0, 1.12, 0.1, P.c, null, { e: 2.6, ts: 6 }); for (const s of [-1, 1]) K.oct(0.3, 3, s * 2, 0.45, 1.8, P.b, 'crystal', { rx: s * 0.3, anim: { t: 'bob', amp: 0.3, speed: 3, ph: s > 0 ? 0 : PI } }); K.oct(1.4, 3.4, 0, 0.3, 1.4, tc, null, { e: 1.8, rz: -H, anim: { t: 'recoil', dist: 0.4 } }); },
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
  veiculo_hull(K, P, tc) { K.prism(0, 1.6, 0, 1, 1.6, 6, P.a, 'crystal', { sx: 6.4, sz: 4.2, top: 0.82 }); K.cone(0, 1.6, 0, 1, 1.4, P.b, 'crystal', { seg: 6, flat: true, rx: PI, sx: 6.4, sz: 4.2 }); K.prism(0, 2.3, 0, 1.01, 0.2, 6, tc, null, { e: 1.8, sx: 6.4, sz: 4.2, top: 1 }); K.tor(0, 0.4, 0, 2.2, 0.14, P.l, null, { e: 2.4, ts: 6, anim: { t: 'spin', p: [0, 0.4, 0], speed: 1.4 } }); K.mount = 3.2; },
  veiculo_turret(K, P, tc) { KITS.quorith.turret(K, P, tc, 0.85, false); },
  drone(K, P, tc) { K.oct(-2, 1.6, 0, 1.1, 4.4, P.a, 'crystal', { rz: -H }); for (const s of [-1, 1]) K.oct(-1.6, 1.6, s * 2.4, 0.6, 2.6, P.b, 'crystal', { rz: -H, ry: s * 0.25, anim: { t: 'bob', amp: 0.2, speed: 4, ph: s > 0 ? 0 : PI } }); K.tor(0, 1.6, 0, 2.6, 0.1, P.l, null, { e: 2.4, ts: 6, rx: 0.4, anim: { t: 'sway', p: [0, 1.6, 0], amp: 0.15, speed: 3 } }); K.oct(0.2, 2.6, 0, 0.35, 1, tc, null, { e: 2 }); },
  suporte(K, P, tc) { K.prism(0, 0.6, 0, 1.8, 0.5, 6, P.d, 'gloss'); K.prism(0, 1.1, 0, 0.6, 2.4, 6, P.b, 'crystal'); K.box(0, 3.4, 0, 0.5, 0.5, 2.6, P.a, 'crystal'); for (const s of [-1, 1]) K.anim({ t: 'flap', p: [0, 3.4, s * 1.1], amp: 0.05, speed: 12, side: s }, () => { K.prism(0, 3.4, s * 1.1, 0.4, 4.6, 6, P.a, 'crystal', { top: 0.5 }); K.oct(0, 8.2, s * 1.1, 0.3, 0.8, P.l, null, { e: 2.6 }); }); K.tor(0, 0.3, 0, 1.6, 0.12, tc, null, { e: 1.8, ts: 6, anim: { t: 'spin', p: [0, 0.3, 0], speed: 1.2 } }); },
  pirata(K, P, tc) { K.prism(0, 1, 0, 1, 1.4, 6, P.a, 'crystal', { sx: 5, sz: 3.2, top: 0.8 }); K.cone(0, 1, 0, 1, 0.9, P.b, 'crystal', { seg: 6, flat: true, rx: PI, sx: 5, sz: 3.2 }); K.anim({ t: 'recoil', dist: 0.8 }, () => { K.oct(4.4, 1.6, 0, 1, 4, P.b, 'crystal', { rz: -H }); K.oct(8.3, 1.6, 0, 0.35, 1.2, P.c, null, { e: 2.6, rz: -H }); });
    K.oct(-1.4, 2.4, 0, 0.9, 2.6, P.a, 'crystal'); K.oct(-1.4, 5.1, 0, 0.3, 0.9, P.c, null, { e: 2.4 }); K.prism(0, 1.9, 0, 1.01, 0.18, 6, tc, null, { e: 1.8, sx: 5, sz: 3.2, top: 1 }); K.tor(0, 0.2, 0, 1.8, 0.12, P.l, null, { e: 2, ts: 6, anim: { t: 'spin', p: [0, 0.2, 0], speed: 1.4 } }); },
  voz(K, P, tc) { K.oct(0, 1.4, 0, 1.6, 6.2, P.a, 'crystal'); K.tor(0, 4.5, 0, 1.72, 0.12, P.c, null, { e: 2.6, ts: 6 }); ringOf(3, 2.6, (cx, cz, a) => K.oct(cx, 3.2 + (a > 3 ? 0.8 : 0), cz, 0.4, 1.4, P.b, 'crystal', { rz: 0.3, anim: { t: 'spin', p: [0, 3.2, 0], speed: 1.2 } })); K.tor(0, 0.4, 0, 1.4, 0.1, tc, null, { e: 2, ts: 6, anim: { t: 'spin', p: [0, 0.4, 0], speed: 1.4 } }); K.oct(0, 7.9, 0, 0.3, 0.8, P.c, null, { e: 2.6, anim: { t: 'bob', amp: 0.2, speed: 3 } }); },
  agulha(K, P, tc) { K.prism(0, 0.4, 0, 1.6, 0.5, 6, P.d, 'gloss'); K.oct(0, 0.9, 0, 1.3, 3.8, P.a, 'crystal'); for (const [x, z, a] of [[0.8, 0.8, 0.3], [0.8, -0.8, 0.3], [-0.8, 0.8, -0.3], [-0.8, -0.8, -0.3]]) K.oct(x, 2, z, 0.28, 5.4, P.b, 'crystal', { rz: -a, rx: z * 0.3 }); K.oct(1.2, 2.4, 0, 0.3, 4, P.l, null, { e: 2.4, rz: -1.1, anim: { t: 'recoil', dist: 0.5 } }); K.tor(0, 2.6, 0, 1.5, 0.1, tc, null, { e: 2, ts: 6, anim: { t: 'spin', p: [0, 2.6, 0], speed: 1.2 } }); },
  diapasao(K, P, tc) { K.prism(0, 0, 0, 2.6, 0.6, 6, P.d, 'gloss'); K.prism(0, 0.6, 0, 1.6, 0.6, 6, P.b, 'crystal'); K.prism(0, 1.2, 0, 0.7, 3, 6, P.a, 'crystal'); K.box(0, 4.2, 0, 0.8, 0.8, 3.8, P.a, 'crystal');
    for (const s of [-1, 1]) K.anim({ t: 'flap', p: [0, 4.2, s * 1.6], amp: 0.04, speed: 12, side: s }, () => { K.prism(0, 4.2, s * 1.6, 0.5, 8, 6, P.a, 'crystal', { top: 0.6 }); K.oct(0, 12.2, s * 1.6, 0.4, 1.2, P.l, null, { e: 2.8 }); }); K.oct(0, 5.4, 0, 0.45, 1.4, P.c, null, { e: 2.6, anim: { t: 'bob', amp: 0.35, speed: 2.2 } }); K.tor(0, 0.7, 0, 2.2, 0.12, tc, null, { e: 1.8, ts: 6, anim: { t: 'spin', p: [0, 0.7, 0], speed: -1.4 } }); },
  prisma(K, P, tc) { U.quorith.veiculo_hull(K, P, tc); K.mount = null; K.oct(-0.6, 3, 0, 2.2, 6.4, P.a, 'crystal', { ry: PI / 4 }); K.anim({ t: 'recoil', dist: 0.8 }, () => { K.oct(2.4, 4.4, 0, 0.7, 6, P.b, 'crystal', { rz: -H }); K.oct(8.5, 4.4, 0, 0.3, 1.2, P.c, null, { e: 2.8, rz: -H }); }); K.tor(-0.6, 6, 0, 2.6, 0.12, P.l, null, { e: 2.4, ts: 6, rx: 0.3, anim: { t: 'spin', p: [-0.6, 6, 0], speed: 1.5 } }); },
  monolito(K, P, tc) { K.prism(0, 0, 0, 1, 0.8, 6, P.d, 'gloss', { sx: 5.4, sz: 4 }); K.tor(0, 1.2, 0, 3.2, 0.16, P.l, null, { e: 2.4, ts: 6, anim: { t: 'spin', p: [0, 1.2, 0], speed: -0.8 } }); K.box(0, 1.8, 0, 3.6, 13, 2.6, P.a, 'crystal', { b: 0.2, bs: 1 });
    K.box(0, 3, 1.33, 0.3, 10, 0.06, P.c, null, { e: 2.6 }); K.box(0, 3, -1.33, 0.3, 10, 0.06, P.c, null, { e: 2.6 }); K.box(1.83, 3, 0, 0.06, 10, 0.3, P.c, null, { e: 2.6 }); K.oct(0, 14.8, 0, 1.2, 2.8, P.b, 'crystal');
    ringOf(4, 4.2, (cx, cz) => K.oct(cx, 0.6, cz, 0.7, 3.2, P.b, 'crystal', { rz: -cx * 0.08, rx: cz * 0.08, anim: { t: 'spin', p: [0, 0.6, 0], speed: 0.5 } })); K.oct(0, 18.2, 0, 0.4, 1, tc, null, { e: 2, anim: { t: 'bob', amp: 0.3, speed: 2 } }); },
  catedral(K, P, tc) { // épico: catedral de cristal que caminha sobre três pilares flutuantes, com sinos de cristal e coro aceso
    K.prism(0, 0, 0, 1, 1.2, 6, P.d, 'gloss', { sx: 12, sz: 10 }); ringOf(3, 8, (cx, cz, a) => K.oct(cx, 0.6, cz, 2.2, 9, P.b, 'crystal', { anim: { t: 'bob', amp: 0.5, speed: 2.4, ph: a } }));
    K.prism(0, 4, 0, 1, 7, 6, P.a, 'crystal', { sx: 9, sz: 7.5, top: 0.8 }); K.prism(0, 11, 0, 0.8, 5, 6, P.b, 'crystal', { sx: 9, sz: 7.5, top: 0.4 }); K.prism(0, 7.4, 0, 1.01, 0.4, 6, P.c, null, { e: 2.4, sx: 9, sz: 7.5, top: 1 });
    K.oct(0, 15, 0, 3, 14, P.a, 'crystal', { ry: PI / 6 }); K.oct(0, 19, 0, 1.4, 6, P.c, null, { e: 2.8 }); for (const [x, z, h] of [[-5, -4, 10], [5, -4, 9], [-5, 4, 9], [5, 4, 10], [0, 6.5, 8]]) { K.oct(x, 10, z, 1.4, h, P.a, 'crystal'); K.oct(x, 10 + h * 0.55, z, 0.5, 2, P.l, null, { e: 2.6 }); }
    K.tor(0, 22, 0, 6.5, 0.4, P.t, 'crystal', { rx: 0.3, ts: 6, anim: { t: 'spin', p: [0, 22, 0], speed: 0.6 } }); K.tor(0, 22, 0, 6, 0.25, P.l, null, { e: 2.4, rz: 0.4, ts: 6, anim: { t: 'spin', p: [0, 22, 0], speed: 0.6 } }); K.tor(0, 2.2, 0, 10, 0.3, tc, null, { e: 1.8, ts: 6, anim: { t: 'spin', p: [0, 2.2, 0], speed: 0.4 } });
    ringOf(6, 7.4, (cx, cz) => K.oct(cx, 3.5, cz, 0.7, 10, P.b, 'crystal', { rz: cx / 7.4 * 0.32, rx: -cz / 7.4 * 0.32 })); // 4.2e: contrafortes de cristal inclinados para o corpo
    K.prism(0, 10.7, 0, 1.03, 0.35, 6, tc, null, { e: 1.5, sx: 9, sz: 7.5, top: 1 }); // faixa na cor do dono
    K.anim({ t: 'spin', p: [0, 25, 0], speed: 0.8 }, () => ringOf(6, 8.5, (cx, cz) => K.oct(cx, 24, cz, 0.6, 2.6, P.l, null, { e: 2.4 }))); // auréola de cristais orbitando
    ringOf(3, 5.6, (cx, cz, a) => K.anim({ t: 'sway', p: [cx, 19.5, cz], amp: 0.06, speed: 1.2, ph: a }, () => K.box(cx, 13, cz, 0.14, 6.4, 1.7, P.c, null, { e: 1.5, ry: -a }))); }, // estandartes de luz
  harmonico(K, P, tc) { ringOf(3, 1.8, (cx, cz, a) => K.oct(cx, 1, cz, 0.7, 3.4, P.a, 'crystal', { rx: Math.sin(a) * 0.4, rz: -Math.cos(a) * 0.4 })); K.oct(0, 1.6, 0, 0.5, 1.8, P.c, null, { e: 2.8, anim: { t: 'bob', amp: 0.25, speed: 3 } }); K.tor(0, 2.4, 0, 2.8, 0.1, P.l, null, { e: 2.4, ts: 6, anim: { t: 'spin', p: [0, 2.4, 0], speed: -1.8 } }); K.tor(0, 2.4, 0, 2.2, 0.08, tc, null, { e: 2, ts: 6, anim: { t: 'spin', p: [0, 2.4, 0], speed: 1.6 } }); },
};
U.vorag = {
  infantaria(K, P, tc) { for (const s of [-1, 1]) leg(K, [-0.4, 3.2, s * 0.9], [0.8, 1.8, s * 1.2], [-0.2, 0, s * 1.2], 0.42, P.b, 'chitin');
    K.sph(-0.3, 4.4, 0, 1.5, P.a, 'chitin', { sx: 1.3, sy: 1.1, seg: 14, rz: 0.4 }); K.sph(1.4, 5.6, 0, 0.95, P.a, 'chitin', { sx: 1.3, seg: 12 });
    for (const s of [-1, 1]) { K.cone(2.4, 5.2, s * 0.45, 0.22, 1.2, P.bo, 'bone', { rz: -2, seg: 6, anim: { t: 'sway', p: [2.4, 5.2, s * 0.45], amp: 0.16, speed: 6, ph: s > 0 ? 0 : PI } }); K.light(2.35, 6, s * 0.5, 0.22, P.l); K.anim({ t: 'sway', p: [0.6, 5, s * 1.3], amp: 0.14, speed: 3.5, ph: s > 0 ? 0 : PI }, () => { K.seg([0.6, 5, s * 1.3], [2.6, 3.6, s * 1.4], 0.26, P.b, 'chitin'); K.cone(2.6, 3.6, s * 1.4, 0.24, 1.4, P.bo, 'bone', { rz: -2.2, seg: 6 }); }); }
    ringOf(3, 0.6, (cx, cz) => K.cone(-1 + cx, 5.4, cz, 0.22, 1.4, P.bo, 'bone', { rz: 0.6, seg: 6 })); K.sph(-1.25, 4.6, 0, 0.6, tc, 'wet', { seg: 10 }); },
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
  veiculo_hull(K, P, tc) { K.sph(0, 2.2, 0, 1, P.a, 'chitin', { sx: 6.4, sy: 2.4, sz: 4, seg: 18 }); for (let i = 0; i < 4; i++) K.sph(-3.6 + i * 2.4, 3.6, 0, 1, P.b, 'chitin', { sx: 1.6, sy: 0.9, sz: 3.6, seg: 12 });
    for (const x of [-4, -1.2, 1.6, 4.2]) for (const s of [-1, 1]) leg(K, [x, 2, s * 3.2], [x + 0.8, 1.8, s * 4.8], [x + 0.4, 0, s * 5], 0.42, P.b, 'chitin');
    K.sph(6.6, 2.4, 0, 1.6, P.a, 'chitin', { sx: 1.2, seg: 12 }); for (const s of [-1, 1]) { K.cone(7.6, 2, s * 0.8, 0.35, 2, P.bo, 'bone', { rz: -2, seg: 6, anim: { t: 'sway', p: [7.6, 2, s * 0.8], amp: 0.12, speed: 4, ph: s > 0 ? 0 : PI } }); K.light(8.4, 2.9, s * 0.6, 0.26, P.l); } K.sph(-3, 4.4, 0, 0.6, tc, 'wet', { seg: 8 }); K.mount = 4.4; },
  veiculo_turret(K, P, tc) { KITS.vorag.turret(K, P, tc, 0.85, false); },
  drone(K, P, tc, o) { o = o || {}; K.sph(0, 2, 0, 1.2, P.a, 'chitin', { sx: 1.8, seg: 12 }); K.anim({ t: 'sway', p: [-1.2, 1.9, 0], amp: 0.1, speed: 3 }, () => { K.sph(-2.6, 1.8, 0, 1, P.b, 'chitin', { sx: 1.6, sy: 0.9, seg: 12 }); K.cone(-4.3, 1.7, 0, 0.3, o.sting || 1.6, P.bo, 'bone', { rz: H, seg: 6 }); }); K.sph(2.1, 2.2, 0, 0.75, P.a, 'chitin', { seg: 10 });
    for (const s of [-1, 1]) { K.light(2.75, 2.5, s * 0.35, 0.22, P.l); K.sph(0.2, 2.9, s * 2.4, 1, '#E8A0A8', 'wet', { sx: 1, sy: 0.06, sz: 2.4, ry: s * 0.25, seg: 12, anim: { t: 'flap', p: [0, 2.9, s * 0.6], amp: 0.4, speed: 26, side: s } }); if (o.wings4) K.sph(-1, 2.8, s * 2, 1, '#E8A0A8', 'wet', { sx: 0.7, sy: 0.05, sz: 1.8, ry: -s * 0.35, seg: 12, anim: { t: 'flap', p: [-0.4, 2.8, s * 0.5], amp: 0.5, speed: 26, ph: 0.5, side: s } }); }
    K.sph(0, 2.9, 0, 0.4, tc, 'wet', { seg: 8 }); },
  suporte(K, P, tc) { K.sph(0, 3.2, 0, 2, P.m, 'wet', { sy: 0.85, seg: 16 }); for (let i = 0; i < 3; i++) arch(K, 0, 2.4, 0, 2.05, 1.7, 2.05, i * PI / 3, 0.1, '#FF8A8A', null, { e: 1.4, ts: 10 }); ringOf(5, 1.2, (cx, cz, a) => K.tube([[cx, 2, cz], [cx * 1.5, 1, cz * 1.5], [cx * 1.2, 0, cz * 1.2]], 0.14, P.b, 'wet', { ts: 8, anim: { t: 'sway', p: [cx, 2, cz], amp: 0.14, speed: 2.4, ph: a } })); K.sph(0, 4.8, 0, 0.5, P.l, null, { e: 2.4, seg: 10 }); K.tor(0, 2.4, 0, 2, 0.16, P.bo, 'bone', { ts: 20 }); K.sph(1.6, 3.6, 0, 0.45, tc, 'wet', { seg: 8 }); },
  pirata(K, P, tc) { K.sph(-0.4, 3, 0, 2.4, P.a, 'chitin', { sx: 1.3, sy: 1.1, seg: 16 }); K.sph(-2.4, 4.2, 0, 1.6, P.m, 'wet', { seg: 14 }); for (const x of [-2, 0.4, 2.2]) for (const s of [-1, 1]) leg(K, [x, 2.4, s * 2], [x + 0.6, 2, s * 3.4], [x + 0.3, 0, s * 3.6], 0.36, P.b, 'chitin');
    K.sph(2.6, 3, 0, 1.4, P.b, 'chitin', { sx: 1.3, seg: 12 }); for (const s of [-1, 1]) { K.seg([3.2, 2.6, s * 0.9], [5.2, 1.6, s * 0.5], 0.3, P.bo, 'bone', { taper: 0.3, anim: { t: 'sway', p: [3.2, 2.6, s * 0.9], amp: 0.14, speed: 5, ph: s > 0 ? 0 : PI } }); K.light(4.1, 3.6, s * 0.5, 0.24, P.l); }
    ringOf(4, 1, (cx, cz) => K.cone(-0.6 + cx, 5.2, cz, 0.28, 1.8, P.bo, 'bone', { seg: 6, rz: 0.5 })); K.sph(-0.4, 5.4, 0, 0.5, tc, 'wet', { seg: 8 }); },
  cria(K, P, tc) { K.sph(0, 1.6, 0, 1.2, P.a, 'chitin', { sx: 1.5, sy: 0.9, seg: 12 }); K.sph(1.8, 1.7, 0, 0.75, P.b, 'chitin', { seg: 10 }); for (const s of [-1, 1]) { K.cone(2.4, 1.3, s * 0.35, 0.18, 0.9, P.bo, 'bone', { rz: -2, seg: 6, anim: { t: 'sway', p: [2.4, 1.3, s * 0.35], amp: 0.18, speed: 7, ph: s > 0 ? 0 : PI } }); K.light(2.45, 2, s * 0.35, 0.18, P.l); }
    for (const x of [-0.8, 0.2, 1]) for (const s of [-1, 1]) leg(K, [x, 1.4, s * 0.8], [x + 0.4, 1.4, s * 1.8], [x + 0.2, 0, s * 2], 0.16, P.b, 'chitin'); K.sph(-0.8, 2.3, 0, 0.35, tc, 'wet', { seg: 8 }); },
  cuspidor(K, P, tc) { U.vorag.cria(K, P, tc); K.sph(-1.2, 2.8, 0, 1.3, P.ac, null, { e: 1.2, seg: 12 }); K.anim({ t: 'recoil', dist: 0.5 }, () => { K.seg([1.8, 2, 0], [3.6, 2.6, 0], 0.32, P.b, 'chitin', { taper: 0.6 }); K.sph(3.6, 2.6, 0, 0.28, P.ac, null, { e: 2.2, seg: 8 }); }); },
  escaravelho(K, P, tc) { K.sph(0, 2.2, 0, 1, P.a, 'chitin', { sx: 5.4, sy: 2.6, sz: 3.6, seg: 18 }); K.sph(0, 2.6, 0, 1, P.b, 'chitin', { half: true, sx: 5, sy: 2.6, sz: 0.4, seg: 12 });
    for (const x of [-3, 0, 3]) for (const s of [-1, 1]) leg(K, [x, 2, s * 3], [x + 0.8, 1.6, s * 4.4], [x + 0.4, 0, s * 4.6], 0.4, P.b, 'chitin');
    K.sph(5.4, 2.2, 0, 1.4, P.b, 'chitin', { seg: 12 }); K.seg([6, 2.6, 0], [8.4, 5.2, 0], 0.5, P.bo, 'bone', { taper: 0.2 }); for (const s of [-1, 1]) K.light(6.6, 2.8, s * 0.6, 0.24, P.l); K.sph(-2.6, 4.4, 0, 0.6, tc, 'wet', { seg: 8 }); },
  brutamonte(K, P, tc) { K.sph(0, 3.4, 0, 1, P.a, 'chitin', { sx: 8, sy: 4.4, sz: 5.6, seg: 20 }); for (let i = 0; i < 4; i++) K.sph(-4.8 + i * 3.2, 6.2, 0, 1, P.b, 'chitin', { sx: 2, sy: 1.3, sz: 5, seg: 12 });
    ringOf(7, 1, (cx, cz) => { if (cx > -0.95) K.cone(cx * 5.4, 6.4, cz * 3.6, 0.5, 3.2, P.bo, 'bone', { seg: 8, rz: -cx * 0.5, rx: cz * 0.5 }); });
    for (const x of [-5, -1.6, 1.8, 5]) for (const s of [-1, 1]) leg(K, [x, 3, s * 4.6], [x + 1, 2.6, s * 6.4], [x + 0.6, 0, s * 6.8], 0.8, P.b, 'chitin');
    K.sph(8.2, 3.6, 0, 2.4, P.b, 'chitin', { sx: 1.1, seg: 14 }); for (const s of [-1, 1]) { K.seg([9.4, 3, s * 1.4], [12, 4.6, s * 2.2], 0.5, P.bo, 'bone', { taper: 0.25, anim: { t: 'sway', p: [9.4, 3, s * 1.4], amp: 0.1, speed: 3, ph: s > 0 ? 0 : PI } }); K.light(10.6, 4.6, s * 0.8, 0.32, P.l); }
    K.sph(-4, 7.6, 0, 0.9, tc, 'wet', { seg: 10 }); K.sph(-6.6, 5.4, 0, 1.8, P.m, 'wet', { seg: 12 }); },
  ferroada(K, P, tc) { U.vorag.drone(K, P, tc, { sting: 2.6, wings4: true }); },
  matriarca(K, P, tc) { // épica: rainha da Prole, abdômen enorme de ovos e coroa de espinhos
    K.anim({ t: 'sway', p: [-1.5, 4.6, 0], amp: 0.05, speed: 1.4 }, () => { K.sph(-7, 4.6, 0, 1, P.m, 'wet', { sx: 9, sy: 5, sz: 6.5, seg: 22 }); for (let i = 0; i < 4; i++) arch(K, -7, 0.4, 0, 9.1, 9.2, 6.6, i * PI / 4, 0.3, '#FF8A8A', null, { e: 1.4, ts: 16 }); ringOf(7, 1, (cx, cz) => K.sph(-7 + cx * 7, 4 + Math.abs(cz) * 2, cz * 5, 1.2, P.bo, 'bone', { sy: 1.4, seg: 10 }));
      for (const sd of [-1, 1]) { for (let i = 0; i < 4; i++) { const x = -10.5 + i * 2.1, y = 2.4 + (i % 2) * 0.9, z = sd * (6.15 - Math.abs(i - 1.5) * 0.35); K.sph(x, y, z, 1.05, '#F2C6A6', 'wet', { seg: 10 }); K.sph(x, y, z + sd * 0.45, 0.38, P.l, null, { e: 1.7, seg: 6 }); } // 4.2e: sacos de ovos com brilho
        K.tube([[-14.5, 5.5, sd * 1.2], [-11, 8.4, sd * 2.8], [-6.5, 9.4, sd * 2.2], [-2.6, 8, sd * 0.8]], 0.14, '#FF5A6A', null, { e: 1.6, ts: 12 }); K.tube([[-13, 3.2, sd * 4.6], [-9, 5.6, sd * 5.8], [-4.5, 6, sd * 5.2]], 0.11, '#FF5A6A', null, { e: 1.4, ts: 10 }); } }); // veias acesas no abdômen
    K.sph(2, 5, 0, 1, P.a, 'chitin', { sx: 5.5, sy: 4.4, sz: 5, seg: 20 }); for (let i = 0; i < 3; i++) K.sph(0 + i * 2.4, 8.4, 0, 1, P.b, 'chitin', { sx: 1.6, sy: 1, sz: 4.4, seg: 12 }); for (const sd of [-1, 1]) for (let i = 0; i < 3; i++) K.sph(-0.5 + i * 2.6, 6.2 - i * 0.3, sd * 4.1, 1, P.d, 'chitin', { half: true, sx: 1.5, sy: 0.8, sz: 1.4, rx: sd * 0.9, seg: 10 }); // 4.2e: placas laterais da carapaça
    for (const x of [-1, 2, 5]) for (const s of [-1, 1]) leg(K, [x, 4, s * 4], [x + 1.6, 4.4, s * 8], [x + 1, 0, s * 9], 0.9, P.b, 'chitin');
    K.sph(8.4, 6, 0, 2.6, P.b, 'chitin', { seg: 16 }); ringOf(6, 2.2, (cx, cz) => K.cone(8 + cx * 0.4, 8, cz, 0.45, 3.6, P.bo, 'bone', { seg: 8, rz: -cx * 0.25, rx: cz * 0.25 })); for (const s of [-1, 1]) { K.seg([10, 5.4, s * 1.4], [13.6, 3, s * 2.6], 0.6, P.bo, 'bone', { taper: 0.2, anim: { t: 'sway', p: [10, 5.4, s * 1.4], amp: 0.1, speed: 2.5, ph: s > 0 ? 0 : PI } }); K.light(10.8, 6.8, s * 1, 0.45, P.l); }
    K.sph(-1, 9.6, 0, 1.1, tc, 'wet', { seg: 10 }); },
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
