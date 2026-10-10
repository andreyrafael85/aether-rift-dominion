/* Conversor voxel → malha Three.js (compartilhado entre o jogo e a validação 3D). Eixos: vox (x, y, z) → three (x, z, -y). */
(function (ARD) {
'use strict';
const FACES = [
  { n: [0, 0, 1], q: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] }, { n: [0, 0, -1], q: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]] },
  { n: [1, 0, 0], q: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]] }, { n: [-1, 0, 0], q: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]] },
  { n: [0, 1, 0], q: [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]] }, { n: [0, -1, 0], q: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
];
function buildGeometry(model, opts) {
  opts = opts || {};
  const b = model.bounds(); const cx = model.pivot ? model.pivot.x : (b.x0 + b.x1) / 2, cy = model.pivot ? model.pivot.y : (b.y0 + b.y1) / 2;
  const out = { pos: [], nor: [], col: [] }, em = { pos: [], nor: [], col: [] };
  for (const v of model.v.values()) {
    const tgt = v.e ? em : out; const base = [v.c[0] / 255, v.c[1] / 255, v.c[2] / 255];
    for (const f of FACES) {
      if (model.has(v.x + f.n[0], v.y + f.n[1], v.z + f.n[2])) continue;
      if (f.n[2] === -1 && v.z === b.z0 && !opts.bottom) continue; // face de baixo no chão: invisível
      const shade = f.n[2] === 1 ? 1 : f.n[2] === -1 ? 0.6 : 0.88;
      const col = v.e ? [Math.min(1, base[0] * 1.05), Math.min(1, base[1] * 1.05), Math.min(1, base[2] * 1.05)] : [base[0] * shade, base[1] * shade, base[2] * shade];
      const vs = f.q.map(q => [v.x + q[0] - cx, v.z + q[2] - b.z0, -(v.y + q[1] - cy)]);
      const n = [f.n[0], f.n[2], -f.n[1]];
      for (const i of [0, 1, 2, 0, 2, 3]) { tgt.pos.push(...vs[i]); tgt.nor.push(...n); tgt.col.push(...col); }
    }
  }
  const mk = d => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(d.pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(d.nor, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(d.col, 3)); g.computeBoundingSphere(); return g; };
  return { main: mk(out), em: em.pos.length ? mk(em) : null, width: Math.max(b.x1 - b.x0, b.y1 - b.y0), height: b.z1 - b.z0 };
}
ARD.vox3d = { buildGeometry };
})(globalThis.ARD = globalThis.ARD || {});
