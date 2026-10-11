/* Aether Rift: Dominion — líderes vivos (4.1e).
   Bustos 3D das cinco Raças (os mesmos da arte de identidade, tools/arte3d.html) montados com "rig": olhos, sobrancelhas,
   boca e cabeça se mexem. Um renderizador WebGL só, fora da tela, desenha cada busto no próprio <canvas> 2D (cartões da
   tela inicial e retrato do HUD). Humor: 1 sereno, 2 furioso, 3 triunfante, 4 preocupado. Reações: piscar, olhar para o
   ponteiro, acenar (sim), negar (não), falar, susto. Celular e "reduzir movimento" ficam com o retrato 2D. */
(function (ARD) {
'use strict';
const T = () => window.THREE;
const COL = { vehnar: { c: 0xff7733, dk: 0x1a1210 }, erevane: { c: 0x33ffd0, dk: 0x0a1218 }, tessara: { c: 0x55e68a, dk: 0x0c1a10 }, quorith: { c: 0xb388ff, dk: 0x120e22 }, vorag: { c: 0xe6455a, dk: 0x1a0a0e } };
const EXPR = { 1: { open: 0.95, brow: 0.0, mouth: 'smile', look: [0, 0], pupil: 1 }, 2: { open: 0.5, brow: 0.6, mouth: 'open', look: [0, -0.3], pupil: 0.7 }, 3: { open: 1.12, brow: -0.35, mouth: 'grin', look: [0.2, 0.3], pupil: 1.15 }, 4: { open: 0.8, brow: -0.3, mouth: 'frown', look: [0, -0.45], pupil: 0.9 } };
let renderer = null, envTex = null, failed = false, raf = 0; const items = [];
const RES = 256;
function canUse() { if (failed) return false; try { if (matchMedia('(prefers-reduced-motion: reduce)').matches) return false; } catch (e) {} return !!T(); }
function ensure() {
  if (renderer || failed) return !!renderer; const THREE = T(); if (!THREE) return false;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' }); renderer.setPixelRatio(1); renderer.setSize(RES, RES, false); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05; renderer.setClearColor(0x000000, 0);
    if (THREE.RoomEnvironment) { const pm = new THREE.PMREMGenerator(renderer); envTex = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; pm.dispose(); }
    renderer.domElement.addEventListener('webglcontextlost', e => { e.preventDefault(); failed = true; for (const it of items.slice()) unmount(it); });
  } catch (e) { console.warn('[ARD] líderes 3D indisponíveis:', e.message); failed = true; renderer = null; }
  return !!renderer;
}
// ---------- peças do rosto (iguais às da arte de identidade) ----------
function parts(THREE) {
  const matSkin = (color, extra) => new THREE.MeshPhysicalMaterial(Object.assign({ color, roughness: 0.42, metalness: 0, clearcoat: 0.7, clearcoatRoughness: 0.25, envMapIntensity: 0.6 }, extra || {}));
  const eye = (grp, x, y, z, r, iris, open, look, pupil, glow) => { const e = new THREE.Group(); e.position.set(x, y, z); open = Math.max(0.12, open);
    const white = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 18), new THREE.MeshPhysicalMaterial({ color: 0xf6f7ff, roughness: 0.18, clearcoat: 1 })); white.scale.y = open; e.add(white);
    const ir = new THREE.Mesh(new THREE.SphereGeometry(r * 0.56, 18, 12), new THREE.MeshStandardMaterial({ color: iris, emissive: iris, emissiveIntensity: glow == null ? 0.6 : glow, roughness: 0.3 })); ir.position.set(look[0] * r * 0.3, look[1] * r * 0.3 * open, r * 0.7); ir.scale.set(1, open, 0.5); e.add(ir);
    const pu = new THREE.Mesh(new THREE.SphereGeometry(r * 0.27 * pupil, 12, 10), new THREE.MeshStandardMaterial({ color: 0x050608, roughness: 0.2 })); pu.position.set(look[0] * r * 0.34, look[1] * r * 0.34 * open, r * 0.93); pu.scale.set(1, Math.min(1, open * 1.1), 0.4); e.add(pu);
    const hl = new THREE.Mesh(new THREE.SphereGeometry(r * 0.13, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff })); hl.position.set(-r * 0.2, r * 0.26 * open, r * 1.0); e.add(hl);
    grp.add(e); e.userData.r = r; return e; };
  const brow = (grp, x, y, z, angle, w, color, thick) => { const b = new THREE.Mesh(new THREE.CapsuleGeometry(thick || 0.07, w, 4, 10), new THREE.MeshStandardMaterial({ color, roughness: 0.6 })); b.position.set(x, y, z); b.rotation.z = Math.PI / 2 + angle; b.userData.base = b.rotation.z; b.userData.side = Math.sign(x) || 1; grp.add(b); return b; };
  const mouth = (grp, type, y, z, w, color) => {
    if (type === 'open' || type === 'grin') { const sh = new THREE.Shape(); sh.moveTo(-w, 0); sh.quadraticCurveTo(0, type === 'grin' ? -w * 0.55 : -w * 1.0, w, 0); sh.quadraticCurveTo(0, type === 'grin' ? w * 0.3 : w * 0.12, -w, 0); const m = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.22, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03 }), new THREE.MeshStandardMaterial({ color: 0x24060c, roughness: 0.55 })); m.position.set(0, y, z - 0.12); grp.add(m);
      if (type === 'grin') { const t = new THREE.Mesh(new THREE.BoxGeometry(w * 1.5, w * 0.22, 0.08), new THREE.MeshStandardMaterial({ color: 0xf4f0e6, roughness: 0.3 })); t.position.set(0, y - w * 0.05, z + 0.1); grp.add(t); } return m; }
    const pts = type === 'smirk' ? [[-w, -0.02 * w], [-w * 0.5, -0.08 * w], [0, -0.05 * w], [w * 0.5, 0.06 * w], [w, 0.32 * w]] : type === 'smile' ? [[-w, 0.18 * w], [-w * 0.5, -0.06 * w], [0, -0.16 * w], [w * 0.5, -0.06 * w], [w, 0.18 * w]] : [[-w, -0.16 * w], [-w * 0.5, 0.04 * w], [0, 0.1 * w], [w * 0.5, 0.04 * w], [w, -0.16 * w]]; // smirk: sorriso torto (4.2f)
    const curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(p[0], y + p[1], z))); const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, w * 0.09, 8, false), new THREE.MeshStandardMaterial({ color, roughness: 0.6 })); grp.add(m); return m; };
  const tooth = (grp, x, y, z, h, r, up, color) => { const t = new THREE.Mesh(new THREE.ConeGeometry(r, h, 8), new THREE.MeshStandardMaterial({ color: color || 0xf0e6d2, roughness: 0.4 })); t.position.set(x, y, z); if (!up) t.rotation.x = Math.PI; grp.add(t); return t; };
  return { matSkin, eye, brow, mouth, tooth };
}
// ---------- busto com rig ----------
function buildHead(race, mood) {
  const THREE = T(); const X = EXPR[mood] || EXPR[1]; const P = parts(THREE); const { matSkin, eye, brow, tooth } = P;
  const g = new THREE.Group(); const rig = { eyes: [], brows: [], mouth: null, jaw: null, slits: [] };
  const mouthG = new THREE.Group(); g.add(mouthG); rig.mouth = mouthG; const mouth = (grp, ...a) => P.mouth(mouthG, ...a);
  const dark = new THREE.MeshStandardMaterial({ color: 0x1b1e26, roughness: 0.5, metalness: 0.6 });
  const E = (...a) => { const e = eye(...a); rig.eyes.push(e); return e; }, B = (...a) => { const b = brow(...a); rig.brows.push(b); return b; };
  if (race === 'vehnar') {
    const head = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 28), matSkin(0xa88a70)); head.scale.set(1, 0.92, 0.95); g.add(head);
    const helm = new THREE.Mesh(new THREE.SphereGeometry(1.1, 40, 28, 0, Math.PI * 2, 0, Math.PI * 0.55), new THREE.MeshStandardMaterial({ color: 0x59627a, roughness: 0.35, metalness: 0.85, envMapIntensity: 0.9 })); helm.position.y = 0.12; g.add(helm);
    const brim = new THREE.Mesh(new THREE.TorusGeometry(1.06, 0.08, 10, 48), new THREE.MeshStandardMaterial({ color: 0x3a4150, metalness: 0.9, roughness: 0.3 })); brim.rotation.x = Math.PI / 2; brim.position.y = 0.2; g.add(brim);
    for (let k = 0; k < 6; k++) { const a = -0.9 + k * 0.36; const rv = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshStandardMaterial({ color: 0xb0b8c6, metalness: 1, roughness: 0.3 })); rv.position.set(Math.sin(a) * 1.08, 0.22, Math.cos(a) * 1.08); g.add(rv); }
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.34, 0.1), new THREE.MeshStandardMaterial({ color: 0x7d8795, metalness: 0.9, roughness: 0.35 })); plate.position.set(0.62, -0.12, 0.72); plate.rotation.y = 0.6; g.add(plate);
    E(g, -0.36, 0.05, 0.86, 0.25, 0xff7733, X.open, X.look, X.pupil, 1.2); E(g, 0.36, 0.05, 0.86, 0.25, 0xff7733, X.open, X.look, X.pupil, 1.2);
    B(g, -0.38, 0.42, 0.9, -X.brow, 0.3, 0x2a2f38, 0.06); B(g, 0.38, 0.42, 0.9, X.brow, 0.3, 0x2a2f38, 0.06);
    const vis = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.06, 0.08), new THREE.MeshStandardMaterial({ color: 0xff7733, emissive: 0xff7733, emissiveIntensity: 1.6 })); vis.position.set(0, 0.3, 0.98); g.add(vis); rig.glow = vis;
    if (X.mouth === 'open') mouth(g, 'open', -0.5, 0.95, 0.32); else { for (let k = -2; k <= 2; k++) { const bar = new THREE.Mesh(new THREE.BoxGeometry(0.07, X.mouth === 'grin' ? 0.22 : 0.16, 0.08), dark); bar.position.set(k * 0.13, -0.5 + (X.mouth === 'grin' ? -Math.abs(k) * 0.03 : X.mouth === 'frown' ? Math.abs(k) * 0.025 : 0), 0.93); mouthG.add(bar); } }
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.25, 0.9, 28), new THREE.MeshStandardMaterial({ color: 0x4a5261, metalness: 0.7, roughness: 0.4 })); torso.position.y = -1.3; g.add(torso); rig.body = torso;
    for (const sx of [-1, 1]) { const st = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.9, 16), new THREE.MeshStandardMaterial({ color: 0x9a4a2a, roughness: 0.6 })); st.position.set(sx * 1.05, -0.75, 0.1); g.add(st); const em = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), new THREE.MeshStandardMaterial({ color: 0xffc08a, emissive: 0xffa040, emissiveIntensity: 2.2 })); em.position.set(sx * 1.05, -0.3, 0.1); g.add(em); (rig.embers = rig.embers || []).push(em); }
  } else if (race === 'erevane') {
    const head = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 36), matSkin(0x1f3a52, { clearcoat: 1, clearcoatRoughness: 0.08, iridescence: 1, iridescenceIOR: 1.6, roughness: 0.3 })); head.scale.set(1, 1.38, 0.95); head.position.y = 0.25; g.add(head);
    const lens = new THREE.Mesh(new THREE.SphereGeometry(0.46, 32, 22), new THREE.MeshPhysicalMaterial({ color: 0x08202c, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.05 })); lens.scale.set(1.55, 0.62, 0.7); lens.position.set(0, 0.2, 0.86); g.add(lens);
    const eyeG = new THREE.Group(); eyeG.position.set(0, 0.2, 1.15); g.add(eyeG); rig.eyes.push(eyeG); eyeG.userData.r = 0.5;
    const slit = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.05 + 0.2 * X.open, 0.08), new THREE.MeshBasicMaterial({ color: new THREE.Color(0x33ffd0).multiplyScalar(2.2), toneMapped: false })); slit.position.set(X.look[0] * 0.1, X.look[1] * 0.08, 0); slit.rotation.z = mood === 2 ? 0.12 : mood === 3 ? -0.06 : mood === 4 ? -0.1 : 0; eyeG.add(slit); rig.glow = slit;
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.09 * X.pupil, 12, 10), new THREE.MeshBasicMaterial({ color: 0x031016 })); pupil.position.set(X.look[0] * 0.2, X.look[1] * 0.06, 0.05); pupil.scale.y = 0.35 + 0.6 * X.open; eyeG.add(pupil);
    const hl = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff })); hl.position.set(-0.32, 0.36, 1.2); g.add(hl);
    B(g, -0.42, 0.62, 0.92, -X.brow * 0.8 + 0.1, 0.34, 0x0d1a24, 0.05); B(g, 0.42, 0.62, 0.92, X.brow * 0.8 - 0.1, 0.34, 0x0d1a24, 0.05);
    mouth(g, X.mouth === 'open' ? 'open' : X.mouth === 'frown' ? 'frown' : 'smile', -0.42, 0.92, X.mouth === 'open' ? 0.22 : 0.3, 0x0d1a24);
    for (const sx of [-1, 1]) { const fin = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.8, 0.5), matSkin(0x2a4a5e, { clearcoat: 1 })); fin.position.set(sx * 1.05, 0.25, -0.1); fin.rotation.z = sx * -0.35; g.add(fin); (rig.fins = rig.fins || []).push(fin); }
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.6, 0.8, 24), matSkin(0x13202b)); neck.position.y = -1.25; g.add(neck); rig.body = neck;
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.12, 12, 36), new THREE.MeshStandardMaterial({ color: 0x4a7a9e, metalness: 0.8, roughness: 0.3 })); collar.rotation.x = Math.PI / 2; collar.position.y = -1.0; g.add(collar);
    for (let k = 0; k < 7; k++) { const sp = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(0x9fe8ff).multiplyScalar(2), toneMapped: false })); const a = k * 0.9; sp.position.set(Math.sin(a) * 0.98, 0.5 + Math.cos(a * 1.3) * 0.6, Math.cos(a) * 0.9); g.add(sp); (rig.sparks = rig.sparks || []).push(sp); }
  } else if (race === 'tessara') {
    const head = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 28), matSkin(0x3f9a5e)); head.scale.set(1.05, 1, 1); g.add(head);
    for (const sx of [-1, 1]) { const so = new THREE.Mesh(new THREE.SphereGeometry(0.37, 18, 12), matSkin(0x0f2a18)); so.scale.set(1.1, 0.66, 0.34); so.position.set(sx * 0.38, 0.15, 0.86); so.rotation.z = sx * 0.28; g.add(so); for (const [dy, len] of [[0, 0.42], [-0.18, 0.3]]) { const th = new THREE.Mesh(new THREE.ConeGeometry(0.08, len, 6), matSkin(0x1d4a2c)); th.position.set(sx * 0.86, -0.18 + dy, 0.5); th.rotation.z = -sx * (Math.PI / 2 + 0.35); g.add(th); } } // 4.2f: órbitas escuras e espinhos no lugar das bochechas
    const eL = E(g, -0.38, 0.12, 0.84, 0.3, 0xd6e04a, X.open * 0.72, X.look, X.pupil * 0.85, 0.55), eR = E(g, 0.38, 0.12, 0.84, 0.3, 0xd6e04a, X.open * 0.72, X.look, X.pupil * 0.85, 0.55); // olhos semicerrados
    for (const e of [eL, eR]) { e.children[0].material.color.setHex(0xb9c47e); e.children[1].material.color.setHex(0xd6e04a); e.children[1].material.emissive.setHex(0xd6e04a); e.children[2].scale.x *= 0.34; e.children[2].scale.y = Math.min(1.3, e.children[2].scale.y * 1.4); e.children[3].visible = false; } // 4.2f: íris amarelo-tóxica, pupila em fenda, sem brilho "fofo"
    B(g, -0.4, 0.46, 0.88, -Math.min(0.72, X.brow * 0.5 + 0.42), 0.32, 0x123522, 0.06); B(g, 0.4, 0.46, 0.88, Math.min(0.72, X.brow * 0.5 + 0.42), 0.32, 0x123522, 0.06); // sobrancelhas em V
    mouth(g, X.mouth === 'smile' ? 'smirk' : X.mouth, -0.5, 0.9, X.mouth === 'open' ? 0.26 : 0.36, 0x123522);
    for (const sx of [-1, 1]) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.17, 6), new THREE.MeshStandardMaterial({ color: 0xede6c8, roughness: 0.4 })); f.rotation.x = Math.PI; f.position.set(sx * 0.15 + 0.04, -0.56, 0.93); mouthG.add(f); } // presas
    rig.fronds = [];
    for (const [fx, fz, h, tilt] of [[-0.45, 0.1, 1.0, -0.35], [-0.15, -0.2, 1.3, -0.1], [0.2, 0.1, 1.15, 0.15], [0.5, -0.1, 0.95, 0.4], [0, 0.35, 0.8, 0]]) { const fg = new THREE.Group(); fg.position.set(fx, 0.95, fz); fg.rotation.z = tilt; g.add(fg); const fr = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, h, 4, 10), matSkin(0x2f7a49)); fr.position.y = h / 2; fg.add(fr); const tip = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 8), new THREE.MeshStandardMaterial({ color: 0xe6b85c, emissive: 0xe6b85c, emissiveIntensity: 1.8 })); tip.position.y = h + 0.05; fg.add(tip); fg.userData.tilt = tilt; rig.fronds.push(fg); }
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.75, 0.9, 24), matSkin(0x2f7a49)); neck.position.y = -1.3; g.add(neck); rig.body = neck;
    for (let k = 0; k < 6; k++) { const a = k * 1.05; const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), matSkin(0x55b86a)); leaf.scale.set(1, 0.4, 1.6); leaf.position.set(Math.sin(a) * 0.75, -0.95, Math.cos(a) * 0.75); leaf.rotation.y = a; g.add(leaf); }
    const sap = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 10), new THREE.MeshStandardMaterial({ color: 0xe6b85c, emissive: 0xe6b85c, emissiveIntensity: 1.5 })); sap.position.set(0, -1.3, 0.7); g.add(sap); rig.glow = sap;
  } else if (race === 'quorith') {
    const cry = new THREE.MeshPhysicalMaterial({ color: 0xb388ff, roughness: 0.06, metalness: 0.05, transmission: 0.45, thickness: 1.2, transparent: true, emissive: 0x6a40c0, emissiveIntensity: 0.35, envMapIntensity: 0.9 });
    const head = new THREE.Mesh(new THREE.OctahedronGeometry(1.2, 0), cry); head.scale.set(0.85, 1.1, 0.85); head.position.y = 0.2; g.add(head);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(head.geometry), new THREE.LineBasicMaterial({ color: 0xefeaff, transparent: true, opacity: 0.5 })); edges.scale.copy(head.scale); edges.position.copy(head.position); g.add(edges);
    for (const sx of [-1, 1]) { const eg = new THREE.Group(); eg.position.set(sx * 0.3, 0.32, 0.86 - 0.14); eg.rotation.y = sx * 0.6; g.add(eg); eg.userData.r = 0.2; rig.eyes.push(eg); const sl = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.09 + 0.1 * X.open, 0.08), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffffff).multiplyScalar(2.2), toneMapped: false })); sl.rotation.z = sx * (X.brow * 0.6 + (mood === 3 ? -0.2 : mood === 4 ? 0.25 : 0)); eg.add(sl); }
    for (let k = -1; k <= 1; k++) { const bar = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.14 + Math.abs(k) * (X.mouth === 'open' ? 0.18 : 0.04) + (X.mouth === 'grin' ? 0.1 : 0), 0.06), new THREE.MeshBasicMaterial({ color: new THREE.Color(X.mouth === 'open' ? 0xff8a5c : 0xb388ff).multiplyScalar(2), toneMapped: false })); bar.position.set(k * 0.14, -0.22 + (X.mouth === 'frown' ? -Math.abs(k) * 0.04 : 0), 0.78); mouthG.add(bar); }
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 1.05, 0.3, 6), new THREE.MeshStandardMaterial({ color: 0x3a2f5e, metalness: 0.7, roughness: 0.35 })); base.position.y = -1.35; g.add(base); rig.body = base;
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xd4b8ff).multiplyScalar(2.2), toneMapped: false })); core.position.y = -1.05; g.add(core); rig.glow = core;
    rig.shards = [];
    for (const [x, y, z, s] of [[-1.3, 0.6, 0.2, 0.22], [1.25, 0.1, -0.1, 0.28], [-0.9, -0.5, 0.6, 0.16], [1.0, 1.2, 0.3, 0.14]]) { const sh = new THREE.Mesh(new THREE.OctahedronGeometry(s, 0), cry); sh.position.set(x, y, z); sh.rotation.set(0.4, 0.3, 0.2); sh.userData.p = [x, y, z]; g.add(sh); rig.shards.push(sh); }
  } else {
    const head = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 28), matSkin(0xb8384a, { roughness: 0.5, clearcoat: 0.5 })); head.scale.set(1.3, 0.85, 1); g.add(head);
    const cara = new THREE.Mesh(new THREE.SphereGeometry(1.08, 40, 28, 0, Math.PI * 2, 0, Math.PI * 0.42), new THREE.MeshStandardMaterial({ color: 0x7a2030, roughness: 0.55, metalness: 0.2 })); cara.scale.set(1.3, 0.85, 1); cara.position.y = 0.06; g.add(cara);
    for (const [x, z] of [[-0.7, 0.1], [0, 0.2], [0.7, 0.1], [-0.35, -0.4], [0.35, -0.4]]) { const sp = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.42, 8), new THREE.MeshStandardMaterial({ color: 0xe8dcc8, roughness: 0.4 })); sp.position.set(x, 0.9, z); sp.rotation.z = -x * 0.3; g.add(sp); }
    E(g, -0.5, 0.12, 0.84, 0.25, 0xffb347, X.open, X.look, X.pupil, 1.4); E(g, 0.5, 0.12, 0.84, 0.25, 0xffb347, X.open, X.look, X.pupil, 1.4);
    E(g, -0.85, 0.35, 0.6, 0.12, 0xffb347, X.open, X.look, X.pupil, 1.4); E(g, 0.85, 0.35, 0.6, 0.12, 0xffb347, X.open, X.look, X.pupil, 1.4);
    B(g, -0.52, 0.45, 0.86, -X.brow - 0.15, 0.32, 0x4a0c16, 0.07); B(g, 0.52, 0.45, 0.86, X.brow + 0.15, 0.32, 0x4a0c16, 0.07);
    const openA = X.mouth === 'open' ? 0.75 : X.mouth === 'grin' ? 0.45 : X.mouth === 'frown' ? 0.1 : 0.18;
    const jawG = new THREE.Group(); jawG.position.set(0, -0.3, 0.12); g.add(jawG); rig.jaw = jawG; jawG.userData.base = openA; jawG.rotation.x = openA;
    const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.95, 32, 22, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5), matSkin(0x9a2a3c, { roughness: 0.5 })); jaw.scale.set(1.25, 0.75, 1); jawG.add(jaw);
    const gum = new THREE.Mesh(new THREE.SphereGeometry(0.9, 24, 18, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5), new THREE.MeshStandardMaterial({ color: 0x2a070c, roughness: 0.8 })); gum.scale.set(1.2, 0.3, 0.95); jawG.add(gum);
    for (let k = -3; k <= 3; k++) { tooth(g, k * 0.26, -0.3, 0.95 + Math.abs(k) * -0.06, 0.22, 0.07, false); tooth(jawG, k * 0.26 + 0.13, 0.05, 1.0 - Math.abs(k) * 0.06, 0.2, 0.065, true); }
    for (const sx of [-1, 1]) { const md = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.09, 10, 18, Math.PI * 0.8), new THREE.MeshStandardMaterial({ color: 0xff5e70, roughness: 0.5 })); md.position.set(sx * 1.25, -0.35, 0.55); md.rotation.set(0.4, sx * -1.2, sx * 0.6); md.userData.rz = sx * 0.6; g.add(md); (rig.mandibles = rig.mandibles || []).push(md); const tp = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.3, 8), new THREE.MeshStandardMaterial({ color: 0xe8dcc8 })); tp.position.set(sx * 1.55, -0.65, 0.95); tp.rotation.z = sx * 0.8; g.add(tp); }
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.9, 0.8, 24), matSkin(0x7a2030)); neck.position.y = -1.4; g.add(neck); rig.body = neck;
  }
  for (const e of rig.eyes) e.userData.baseScale = e.scale.y;
  if (mouthG.children.length) { const c = new THREE.Box3().setFromObject(mouthG).getCenter(new THREE.Vector3()); mouthG.position.copy(c); for (const ch of mouthG.children) ch.position.sub(c); } // a boca abre a partir do próprio centro
  return { g, rig };
}
function sceneFor(race) {
  const THREE = T(); const sc = new THREE.Scene(); if (envTex) sc.environment = envTex; const C = COL[race] || COL.vehnar;
  const key = new THREE.DirectionalLight(0xfff1e0, 2.4); key.position.set(-2.5, 3.5, 4); sc.add(key);
  const fill = new THREE.DirectionalLight(C.c, 0.9); fill.position.set(3, 0.5, 2.5); sc.add(fill);
  const rim = new THREE.DirectionalLight(0xffffff, 1.6); rim.position.set(0.5, 2.5, -3); sc.add(rim);
  sc.add(new THREE.HemisphereLight(0x9aa8c8, 0x1a1210, 0.5));
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 50); return { sc, cam };
}
// ---------- montagem num <canvas> 2D ----------
// opts: { size, framing: 'card' | 'hud', mood, fps, yaw }
function mount(canvas, race, opts) {
  if (!canUse() || !ensure()) return null; opts = opts || {};
  const { sc, cam } = sceneFor(race); const it = { canvas, ctx: canvas.getContext('2d'), race, sc, cam, mood: opts.mood || 1, baseMood: opts.mood || 1, head: null, t0: performance.now(), last: 0, fps: opts.fps || 24, framing: opts.framing || 'card', yaw: opts.yaw == null ? 0.22 : opts.yaw,
    st: { look: [0, 0], lookT: [0, 0], nextBlink: 1 + Math.random() * 3, blink: 0, nod: 0, shake: 0, talk: 0, jolt: 0, until: 0, gaze: null, gazeUntil: 0, nextGlance: 2 + Math.random() * 3 } };
  setHead(it, it.mood);
  if (it.framing === 'hud') { cam.position.set(1.0, 0.55, 5.1); cam.lookAt(0, -0.1, 0); } else { cam.position.set(1.1, 0.6, 5.0); cam.lookAt(0, -0.15, 0); }
  items.push(it); loop(); return it;
}
function setHead(it, mood) {
  if (it.head) { it.sc.remove(it.head.g); it.head.g.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); }
  it.head = buildHead(it.race, mood); it.sc.add(it.head.g); it.mood = mood;
}
function unmount(it) { const i = items.indexOf(it); if (i >= 0) items.splice(i, 1); if (it.head) it.head.g.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); it.head = null; }
function stopAll() { for (const it of items.slice()) unmount(it); }
// ---------- reações ----------
// mood(it, m, ms): troca o humor por ms (depois volta ao humor de base); react(it, kind): 'nod' | 'shake' | 'talk' | 'jolt'
function mood(it, m, ms) { if (!it) return; if (m !== it.mood) setHead(it, m); it.st.until = ms ? performance.now() + ms : 0; }
function baseMood(it, m) { if (!it) return; it.baseMood = m; if (!it.st.until && m !== it.mood) setHead(it, m); }
function react(it, kind, amount) { if (!it) return; const s = it.st; if (kind === 'nod') s.nod = 1; else if (kind === 'shake') s.shake = 1; else if (kind === 'talk') s.talk = Math.max(s.talk, amount || 1.6); else if (kind === 'jolt') s.jolt = 1; }
function gaze(it, x, y, ms) { if (!it) return; it.st.gaze = [Math.max(-1, Math.min(1, x)), Math.max(-1, Math.min(1, y))]; it.st.gazeUntil = performance.now() + (ms || 1500); }
function animate(it, now, dt) {
  const s = it.st, rig = it.head.rig, g = it.head.g, t = (now - it.t0) / 1000;
  if (s.until && now > s.until) { s.until = 0; if (it.mood !== it.baseMood) setHead(it, it.baseMood); }
  // olhar: alvo do ponteiro, ou espiadas ao acaso
  s.nextGlance -= dt; if (s.gaze && now < s.gazeUntil) s.lookT = s.gaze; else if (s.nextGlance <= 0) { s.nextGlance = 1.8 + Math.random() * 3.5; s.lookT = Math.random() < 0.35 ? [0, 0] : [(Math.random() - 0.5) * 1.4, (Math.random() - 0.5) * 0.8]; }
  s.look[0] += (s.lookT[0] - s.look[0]) * Math.min(1, dt * 7); s.look[1] += (s.lookT[1] - s.look[1]) * Math.min(1, dt * 7);
  // piscar
  s.nextBlink -= dt; if (s.nextBlink <= 0) { s.blink = 0.16; s.nextBlink = 2.2 + Math.random() * 3.8; if (Math.random() < 0.18) s.nextBlink = 0.25; }
  const bl = s.blink > 0 ? Math.max(0.08, Math.abs(s.blink - 0.08) / 0.08) : 1; if (s.blink > 0) s.blink -= dt;
  for (const e of rig.eyes) { e.scale.y = (e.userData.baseScale || 1) * bl; e.rotation.y = s.look[0] * 0.45; e.rotation.x = -s.look[1] * 0.35; }
  // sobrancelhas acompanham o olhar e a fala
  for (const b of rig.brows) b.rotation.z = b.userData.base + Math.sin(t * 1.3 + b.userData.side) * 0.03 + (s.talk > 0 ? Math.sin(t * 9) * 0.05 * b.userData.side : 0);
  // fala
  if (s.talk > 0) { s.talk -= dt; const k = 0.5 + 0.5 * Math.abs(Math.sin(t * 17) * Math.sin(t * 7.3)); if (rig.jaw) rig.jaw.rotation.x = rig.jaw.userData.base + k * 0.35; if (rig.mouth) rig.mouth.scale.y = 1 + k * 0.7; } else { if (rig.jaw) rig.jaw.rotation.x = rig.jaw.userData.base + Math.sin(t * 1.7) * 0.02; if (rig.mouth) rig.mouth.scale.y += (1 - rig.mouth.scale.y) * Math.min(1, dt * 10); }
  // cabeça: respiração, balanço, aceno, negação, susto
  if (s.nod > 0) s.nod = Math.max(0, s.nod - dt * 1.4); if (s.shake > 0) s.shake = Math.max(0, s.shake - dt * 1.3); if (s.jolt > 0) s.jolt = Math.max(0, s.jolt - dt * 2.2);
  const nod = s.nod > 0 ? Math.sin((1 - s.nod) * Math.PI * 4) * 0.22 * s.nod : 0, shake = s.shake > 0 ? Math.sin((1 - s.shake) * Math.PI * 5) * 0.3 * s.shake : 0, jolt = s.jolt * 0.12;
  g.rotation.y = it.yaw + Math.sin(t * 0.5) * 0.07 + s.look[0] * 0.25 + shake;
  g.rotation.x = Math.sin(t * 0.7) * 0.03 - s.look[1] * 0.12 + nod - jolt * 0.6 + (it.mood === 4 ? 0.12 : 0);
  g.rotation.z = Math.sin(t * 0.4) * 0.03 + (it.mood === 3 ? 0.05 : 0);
  g.position.y = 0.1 + Math.sin(t * 1.6) * 0.025 + jolt * 0.3; g.scale.setScalar(1 + Math.sin(t * 1.6) * 0.008);
  // detalhes por Raça
  if (rig.embers) for (const e of rig.embers) e.material.emissiveIntensity = 1.6 + Math.sin(t * 7 + e.position.x * 3) * 0.6 + Math.random() * 0.3;
  if (rig.fronds) rig.fronds.forEach((f, i) => { f.rotation.z = f.userData.tilt + Math.sin(t * 1.4 + i) * 0.08; });
  if (rig.shards) rig.shards.forEach((sh, i) => { const p = sh.userData.p; sh.position.set(p[0], p[1] + Math.sin(t * 1.1 + i * 1.7) * 0.12, p[2]); sh.rotation.y = t * (0.4 + i * 0.1); });
  if (rig.mandibles) rig.mandibles.forEach((m, i) => { m.rotation.z = m.userData.rz + Math.sin(t * (s.talk > 0 ? 12 : 2.2) + i * Math.PI) * (s.talk > 0 ? 0.18 : 0.06); });
  if (rig.sparks) rig.sparks.forEach((sp, i) => { sp.visible = Math.sin(t * 3 + i * 1.3) > -0.3; });
  if (rig.glow && rig.glow.material && rig.glow.material.emissiveIntensity != null) rig.glow.material.emissiveIntensity = 1.3 + Math.sin(t * 2.2) * 0.3 + (it.mood === 2 ? 0.6 : 0);
}
function loop() {
  if (raf) return;
  const step = now => { raf = 0; if (!items.length || !renderer) return;
    let any = false;
    for (const it of items.slice()) {
      if (!it.canvas.isConnected) { unmount(it); continue; }
      if (document.hidden || !it.canvas.offsetParent) continue;
      any = true; if (now - it.last < 1000 / it.fps) continue; const dt = Math.min(0.1, it.last ? (now - it.last) / 1000 : 0.016); it.last = now;
      try { animate(it, now, dt);
        const w = it.canvas.width, h = it.canvas.height; const rw = Math.min(RES, w), rh = Math.min(RES, h); it.cam.aspect = rw / rh; it.cam.updateProjectionMatrix();
        renderer.setViewport(0, 0, rw, rh); renderer.setScissor(0, 0, rw, rh); renderer.setScissorTest(true); renderer.clear(); renderer.render(it.sc, it.cam);
        it.ctx.clearRect(0, 0, w, h); it.ctx.drawImage(renderer.domElement, 0, RES - rh, rw, rh, 0, 0, w, h);
      } catch (e) { console.warn('[ARD] líder 3D:', e.message); unmount(it); }
    }
    if (items.length) raf = requestAnimationFrame(step); };
  raf = requestAnimationFrame(step);
}
ARD.leaders3d = { canUse, mount, unmount, stopAll, mood, baseMood, react, gaze, EXPR };
})(globalThis.ARD = globalThis.ARD || {});
