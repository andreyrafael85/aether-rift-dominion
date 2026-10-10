/* Teste de estilo: pipeline de sprites voxel pré-renderizados em isométrico (2:1), gerados em tempo de carga. Sem assets externos. */
(function (ARD) {
'use strict';
const SQ3 = Math.sqrt(3);
const VIEW = [-1 / SQ3, -1 / SQ3, 1 / SQ3];          // direção para a câmera
const LIGHT = norm([-0.55, -0.9, 1.25]);               // sol: alto, atrás-esquerda
function norm(v) { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; }
function hex(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function rgb(c, f, add) { add = add || 0; return `rgb(${Math.min(255, Math.max(0, c[0] * f + add)) | 0},${Math.min(255, Math.max(0, c[1] * f + add)) | 0},${Math.min(255, Math.max(0, c[2] * f + add)) | 0})`; }

function Model() { this.v = new Map(); this.lights = []; }
Model.prototype.set = function (x, y, z, c, e) { this.v.set(x + ',' + y + ',' + z, { x, y, z, c: typeof c === 'string' ? hex(c) : c, e: !!e }); if (e) this.lights.push([x + .5, y + .5, z + .5, typeof c === 'string' ? c : '#fff']); return this; };
Model.prototype.box = function (x0, y0, z0, w, d, h, c, f, e) { for (let x = x0; x < x0 + w; x++) for (let y = y0; y < y0 + d; y++) for (let z = z0; z < z0 + h; z++) if (!f || f(x - x0, y - y0, z - z0, w, d, h)) this.set(x, y, z, c, e); return this; };
Model.prototype.cyl = function (cx, cy, z0, r, h, c, e) { for (let x = Math.floor(cx - r); x <= cx + r; x++) for (let y = Math.floor(cy - r); y <= cy + r; y++) if ((x + .5 - cx) ** 2 + (y + .5 - cy) ** 2 <= r * r) for (let z = z0; z < z0 + h; z++) this.set(x, y, z, c, e); return this; };
Model.prototype.sphere = function (cx, cy, cz, r, c, e) { for (let x = Math.floor(cx - r); x <= cx + r; x++) for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let z = Math.floor(cz - r); z <= cz + r; z++) if ((x + .5 - cx) ** 2 + (y + .5 - cy) ** 2 + (z + .5 - cz) ** 2 <= r * r) this.set(x, y, z, c, e); return this; };
Model.prototype.has = function (x, y, z) { return this.v.has(x + ',' + y + ',' + z); };
Model.prototype.bounds = function () { let b = { x0: 1e9, y0: 1e9, z0: 1e9, x1: -1e9, y1: -1e9, z1: -1e9 }; for (const v of this.v.values()) { b.x0 = Math.min(b.x0, v.x); b.y0 = Math.min(b.y0, v.y); b.z0 = Math.min(b.z0, v.z); b.x1 = Math.max(b.x1, v.x + 1); b.y1 = Math.max(b.y1, v.y + 1); b.z1 = Math.max(b.z1, v.z + 1); } return b; };

// 6 faces: normal, 4 vértices (offsets), vizinho
const FACES = [
  { n: [0, 0, 1], q: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], nb: [0, 0, 1] },
  { n: [1, 0, 0], q: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]], nb: [1, 0, 0] },
  { n: [-1, 0, 0], q: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], nb: [-1, 0, 0] },
  { n: [0, 1, 0], q: [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]], nb: [0, 1, 0] },
  { n: [0, -1, 0], q: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], nb: [0, -1, 0] },
];

/* Renderiza um modelo em um canvas offscreen. angle em radianos (rotação em z). s = px por voxel. */
function renderSprite(model, angle, s, opt) {
  opt = opt || {};
  const b = model.bounds(); const cx = model.pivot ? model.pivot.x : (b.x0 + b.x1) / 2, cy = model.pivot ? model.pivot.y : (b.y0 + b.y1) / 2;
  const ca = Math.cos(angle), sa = Math.sin(angle);
  const rot = (x, y) => [cx + (x - cx) * ca - (y - cy) * sa, cy + (x - cx) * sa + (y - cy) * ca];
  const proj = (x, y, z) => { const [xr, yr] = rot(x, y); return [(xr - yr) * s, (xr + yr) * s * 0.5 - z * s]; };
  // bounds em tela
  let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
  for (const [x, y, z] of [[b.x0, b.y0, b.z0], [b.x1, b.y0, b.z0], [b.x0, b.y1, b.z0], [b.x1, b.y1, b.z0], [b.x0, b.y0, b.z1], [b.x1, b.y0, b.z1], [b.x0, b.y1, b.z1], [b.x1, b.y1, b.z1]]) { const p = proj(x, y, z); minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]); minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); }
  const pad = 4; const w = Math.ceil(maxX - minX) + pad * 2, h = Math.ceil(maxY - minY) + pad * 2;
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const c = cv.getContext('2d');
  const ox = -minX + pad, oy = -minY + pad;
  const vox = [...model.v.values()];
  for (const v of vox) { const [xr, yr] = rot(v.x + .5, v.y + .5); v.d = xr + yr + v.z * 1.0001; }
  vox.sort((a, b2) => a.d - b2.d);
  const faces = FACES.map(f => { const n = [f.n[0] * ca - f.n[1] * sa, f.n[0] * sa + f.n[1] * ca, f.n[2]]; const vis = n[0] * VIEW[0] + n[1] * VIEW[1] + n[2] * VIEW[2] > 0.02; const lit = Math.max(0, n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]); return Object.assign({}, f, { vis, shade: 0.42 + 0.62 * lit }); });
  const dmg = opt.damage || 0;
  for (const v of vox) {
    for (const f of faces) {
      if (!f.vis) continue;
      if (model.has(v.x + f.nb[0], v.y + f.nb[1], v.z + f.nb[2])) continue;
      c.beginPath();
      for (let i = 0; i < 4; i++) { const q = f.q[i]; const p = proj(v.x + q[0], v.y + q[1], v.z + q[2]); if (i === 0) c.moveTo(p[0] + ox, p[1] + oy); else c.lineTo(p[0] + ox, p[1] + oy); }
      c.closePath();
      let col;
      if (v.e) col = rgb(v.c, 1.05, 25);
      else { let cc = v.c; if (dmg) cc = [cc[0] * (1 - dmg * .6), cc[1] * (1 - dmg * .7), cc[2] * (1 - dmg * .7)]; col = rgb(cc, f.shade, f.n[2] ? 6 : 0); }
      c.fillStyle = col; c.fill();
      // leve contorno interno para legibilidade em escala pequena
      c.strokeStyle = 'rgba(0,0,0,0.12)'; c.lineWidth = 0.5; c.stroke();
    }
  }
  // luzes emissivas (brilho)
  const lights = [];
  for (const l of model.lights) { const p = proj(l[0], l[1], l[2]); const L = { x: p[0] + ox, y: p[1] + oy, c: l[3] }; if (!lights.some(k => Math.abs(k.x - L.x) < 7 && Math.abs(k.y - L.y) < 7)) lights.push(L); }
  const base = proj(cx, cy, b.z0);
  return { canvas: cv, ox, oy, w, h, lights, s, cx, cy, ax: base[0] + ox, ay: base[1] + oy, hz: (b.z1 - b.z0) };
}

/* Ambiente: luz vem do alto; sombra projetada no chão deslocada (sol atrás-esquerda) */
function drawShadow(ctx, x, y, w, h) { ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(x + w * 0.12, y + 2, w * 0.55, h * 0.28, 0, 0, 7); ctx.fill(); ctx.restore(); }

ARD.vox = { Model, renderSprite, drawShadow, hex, rgb };
})(globalThis.ARD = globalThis.ARD || {});
