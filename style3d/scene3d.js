/* Prova de conceito 3D (Three.js r160): modelos voxel do jogo como malhas, luz, sombras, relevo e cena animada. */
(function (ARD) {
'use strict';
const MD = ARD.models; const T = 16; const P1 = '#2E6BE6', P2 = '#C8322E';
const FACES = [
  { n: [0, 0, 1], q: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] }, { n: [0, 0, -1], q: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]] },
  { n: [1, 0, 0], q: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]] }, { n: [-1, 0, 0], q: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]] },
  { n: [0, 1, 0], q: [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]] }, { n: [0, -1, 0], q: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
];
const geoCache = new Map();
function buildGeometry(key, model) {
  if (geoCache.has(key)) return geoCache.get(key);
  const b = model.bounds(); const cx = model.pivot ? model.pivot.x : (b.x0 + b.x1) / 2, cy = model.pivot ? model.pivot.y : (b.y0 + b.y1) / 2;
  const out = { pos: [], nor: [], col: [] }, em = { pos: [], nor: [], col: [] };
  for (const v of model.v.values()) {
    const tgt = v.e ? em : out; const base = [v.c[0] / 255, v.c[1] / 255, v.c[2] / 255];
    for (const f of FACES) {
      if (model.has(v.x + f.n[0], v.y + f.n[1], v.z + f.n[2])) continue;
      const shade = f.n[2] === 1 ? 1 : f.n[2] === -1 ? 0.6 : 0.88;
      const col = v.e ? [Math.min(1, base[0] * 1.05), Math.min(1, base[1] * 1.05), Math.min(1, base[2] * 1.05)] : [base[0] * shade, base[1] * shade, base[2] * shade];
      const vs = f.q.map(q => [v.x + q[0] - cx, v.z + q[2] - b.z0, -(v.y + q[1] - cy)]); // vox (x,y,z) → three (x, z, -y)
      const n = [f.n[0], f.n[2], -f.n[1]];
      for (const i of [0, 1, 2, 0, 2, 3]) { tgt.pos.push(...vs[i]); tgt.nor.push(...n); tgt.col.push(...col); }
    }
  }
  const mk = d => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(d.pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(d.nor, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(d.col, 3)); g.computeBoundingSphere(); return g; };
  const r = { main: mk(out), em: em.pos.length ? mk(em) : null, width: Math.max(b.x1 - b.x0, b.y1 - b.y0), height: b.z1 - b.z0 };
  geoCache.set(key, r); return r;
}
const matMain = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0.12 });
const matEm = new THREE.MeshBasicMaterial({ vertexColors: true });
function meshOf(key, model) {
  const g = buildGeometry(key, model); const grp = new THREE.Group();
  const m = new THREE.Mesh(g.main, matMain); m.castShadow = true; m.receiveShadow = true; grp.add(m);
  if (g.em) { const e = new THREE.Mesh(g.em, matEm); grp.add(e); grp.userData.em = e; }
  grp.userData.geo = g; return grp;
}
const toV3 = (x, y, z) => new THREE.Vector3(x, z || 0, -y);
function noise2(x, y) { const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; const a = s - Math.floor(s); const s2 = Math.sin(x * 0.5 + y * 0.31) * 0.5 + 0.5; return a * 0.35 + s2 * 0.65; }
function smoothNoise(x, y) { const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy; const sm = t => t * t * (3 - 2 * t); const h = (a, b) => { const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return v - Math.floor(v); }; const u = sm(fx), w = sm(fy); return (h(ix, iy) * (1 - u) + h(ix + 1, iy) * u) * (1 - w) + (h(ix, iy + 1) * (1 - u) + h(ix + 1, iy + 1) * u) * w; }

function create(canvas) {
  const S = { state: { night: false, shadows: true, orbit: true }, time: 0 };
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true }); renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.95;
  const scene = new THREE.Scene(); const G = 11 * T; const center = toV3(G / 2, G / 2, 0);
  const camera = new THREE.PerspectiveCamera(38, 1, 1, 3000);
  const cam = { yaw: 0.8, pitch: 0.92, dist: 270, target: center.clone() };
  function placeCamera() { camera.position.set(cam.target.x + Math.sin(cam.yaw) * Math.cos(cam.pitch) * cam.dist, cam.target.y + Math.sin(cam.pitch) * cam.dist, cam.target.z + Math.cos(cam.yaw) * Math.cos(cam.pitch) * cam.dist); camera.lookAt(cam.target); }
  function resize() { const w = canvas.clientWidth, h = canvas.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  window.addEventListener('resize', resize); resize();
  // luzes
  const hemi = new THREE.HemisphereLight(0x9fb8d6, 0x2a2a30, 0.7); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffe9c4, 2.4); sun.position.set(center.x - 140, 240, center.z + 180); sun.target.position.copy(center); scene.add(sun); scene.add(sun.target);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); const sc = sun.shadow.camera; sc.left = -170; sc.right = 170; sc.top = 170; sc.bottom = -170; sc.near = 50; sc.far = 700; sun.shadow.bias = -0.0008;
  const amb = new THREE.AmbientLight(0x404860, 0.3); scene.add(amb);
  scene.fog = new THREE.Fog(0x9fb0c4, 520, 1300);
  // terreno com relevo e biomas por cor de vértice; base plana com placas metálicas
  const segs = 150; const pg = new THREE.PlaneGeometry(G * 2.6, G * 2.6, segs, segs); pg.rotateX(-Math.PI / 2);
  const pp = pg.attributes.position; const cols = new Float32Array(pp.count * 3);
  for (let i = 0; i < pp.count; i++) {
    const x = pp.getX(i) + G / 2, z = pp.getZ(i) - G / 2; const wx = x, wy = -z; // voxel-world coords
    const inBase = wx > 1.3 * T && wx < 9.2 * T && wy > 1.3 * T && wy < 9.2 * T;
    const edge = Math.min(Math.abs(wx - 1.3 * T), Math.abs(wx - 9.2 * T), Math.abs(wy - 1.3 * T), Math.abs(wy - 9.2 * T));
    let h = (smoothNoise(wx / 70, wy / 70) - 0.5) * 16 + (smoothNoise(wx / 23, wy / 23) - 0.5) * 3; if (inBase) h *= Math.min(1, edge / 20) * 0.1;
    pp.setY(i, h);
    const nb = smoothNoise(wx / 150 + 3, wy / 150 + 7); let c = nb < 0.42 ? [0.66, 0.73, 0.8] : nb < 0.6 ? [0.41, 0.42, 0.45] : [0.34, 0.42, 0.34];
    if (inBase) c = [0.2, 0.22, 0.26]; const g = 0.9 + (smoothNoise(wx / 7, wy / 7) - 0.5) * 0.25; cols[i * 3] = c[0] * g; cols[i * 3 + 1] = c[1] * g; cols[i * 3 + 2] = c[2] * g;
  }
  pg.setAttribute('color', new THREE.BufferAttribute(cols, 3)); pg.computeVertexNormals();
  const ground = new THREE.Mesh(pg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0.02 })); ground.position.set(G / 2, 0, -G / 2); ground.receiveShadow = true; scene.add(ground);
  function groundH(wx, wy) { const inBase = wx > 1.3 * T && wx < 9.2 * T && wy > 1.3 * T && wy < 9.2 * T; const edge = Math.min(Math.abs(wx - 1.3 * T), Math.abs(wx - 9.2 * T), Math.abs(wy - 1.3 * T), Math.abs(wy - 9.2 * T)); let h = (smoothNoise(wx / 70, wy / 70) - 0.5) * 16 + (smoothNoise(wx / 23, wy / 23) - 0.5) * 3; if (inBase) h *= Math.min(1, edge / 20) * 0.1; return h; }
  // objetos
  const pointLights = [];
  function addLight(x, y, z, color, intensity, dist) { const l = new THREE.PointLight(color, intensity, dist, 2); l.position.copy(toV3(x, y, z)); scene.add(l); pointLights.push({ l, base: intensity }); return l; }
  function place(key, model, x, y, ang, opts) { const m = meshOf(key, model); const g = m.userData.geo; const px = x + (opts && opts.origin ? 0 : 0); m.position.copy(toV3(x, y, (opts && opts.z) || groundH(x, y))); m.rotation.y = ang || 0; scene.add(m); return m; }
  const objs = [
    ['nucleus', MD.nucleus(P1), 5.5 * T, 5.5 * T], ['refinery', MD.refinery(P1), 2.9 * T, 2.7 * T], ['reactor', MD.reactor(P1), 7.5 * T, 2.7 * T], ['reactor', MD.reactor(P1), 8.3 * T, 4.4 * T],
    ['barracks', MD.barracks(P1), 3.0 * T, 7.1 * T], ['lab', MD.lab(P1), 7.4 * T, 7.4 * T],
  ];
  for (const o of objs) place(o[0] + P1, o[1], o[2], o[3], 0);
  const towers = [];
  for (const [x, y] of [[1.7 * T, 1.5 * T], [8.8 * T, 1.5 * T], [1.7 * T, 9.0 * T], [8.8 * T, 9.0 * T]]) { const base = place('tbase' + P1, MD.towerBase(P1), x, y, 0); const tur = meshOf('ttur' + P1, MD.towerTurret(P1)); tur.position.set(0, 12, 0); base.add(tur); towers.push({ base, tur, x, y }); }
  for (let i = 0; i < 8; i++) { const x = (1.6 + i) * T + 8; place('wall' + P1, MD.wall(P1, 'vehnar', false), x, 1.5 * T + 8, 0); if (i === 4) place('gate' + P1, MD.wall(P1, 'vehnar', true), x, 8.9 * T + 8, 0); else place('wall' + P1, MD.wall(P1, 'vehnar', false), x, 8.9 * T + 8, 0); }
  for (let i = 0; i < 8; i++) { const y = (1.6 + i) * T + 8; place('wall' + P1, MD.wall(P1, 'vehnar', false), 1.4 * T + 8, y, Math.PI / 2); place('wall' + P1, MD.wall(P1, 'vehnar', false), 8.9 * T + 8, y, Math.PI / 2); }
  for (const [x, y, s] of [[9.3 * T, 7.4 * T, 5], [10 * T, 8.6 * T, 9], [0.3 * T, 8.2 * T, 3], [9.5 * T, 9.7 * T, 7]]) { place('cry' + s, MD.crystals(s), x, y, 0); addLight(x + 6, y + 6, 8, s % 2 ? 0xd64cff : 0xff6a3d, 0, 60); }
  for (const [x, y, s] of [[0.3 * T, 1.0 * T, 2], [9.6 * T, 0.4 * T, 4], [0.9 * T, 9.6 * T, 6], [9.3 * T, 5.0 * T, 8], [5.2 * T, 0.2 * T, 3], [10.3 * T, 3.3 * T, 1]]) place('rock' + s, MD.rocks(s), x, y, 0);
  place('ruin1', MD.ruin(1), 0.2 * T, 5.4 * T, 0.4); place('ruin2', MD.ruin(2), 10.2 * T, 10.4 * T, -0.7);
  const wreck = place('wreck', MD.wreck(), 7.0 * T, 9.5 * T, 0.6); const fireLight = addLight(7.0 * T + 6, 9.5 * T + 4, 6, 0xff7a30, 0, 50);
  const coreLight = addLight(5.5 * T + 15, 5.5 * T + 15, 30, 0xff6a3d, 0, 120); const reLights = [addLight(7.5 * T + 14, 2.7 * T + 4, 20, 0xff8c1a, 0, 60), addLight(8.3 * T + 14, 4.4 * T + 4, 20, 0xff8c1a, 0, 60)];
  const lampLights = [addLight(3.2 * T, 7.6 * T, 14, 0xffe08a, 0, 90), addLight(7.6 * T, 3.0 * T, 14, 0xffe08a, 0, 90), addLight(3.2 * T, 3.0 * T, 14, 0xffe08a, 0, 90)];
  // unidades
  const units = [];
  function unit(def, col, path, sp, t0, opts) { const u = Object.assign({ def, col, path, sp, t: t0 || 0 }, opts || {}); let grp;
    if (def === 'tank') { grp = meshOf('hull' + col, MD.tankHull(col)); const tur = meshOf('tur' + col, MD.tankTurret(col)); tur.position.set(0, 6, 0); grp.add(tur); u.tur = tur; }
    else grp = meshOf(def + col, MD[def](col));
    scene.add(grp); u.m = grp; units.push(u); return u; }
  unit('harvester', P1, [[8.4 * T, 5.3 * T], [9.6 * T, 7.9 * T], [8.4 * T, 5.3 * T]], 9, 0);
  unit('harvester', P1, [[3.4 * T, 3.4 * T], [0.9 * T, 8.4 * T], [3.4 * T, 3.4 * T]], 9, 0.5);
  unit('tank', P1, [[5.6 * T, 9.9 * T], [5.6 * T, 6.4 * T], [7.6 * T, 6.4 * T], [5.6 * T, 9.9 * T]], 14, 0.2, { firing: true, aim: [10.4 * T, 10.4 * T] });
  unit('tank', P1, [[6.3 * T, 10.3 * T], [6.3 * T, 6.9 * T], [7.9 * T, 7.0 * T], [6.3 * T, 10.3 * T]], 14, 0.25, { firing: true, aim: [10.6 * T, 9.1 * T] });
  unit('mech', P1, [[4.2 * T, 7.9 * T], [6.8 * T, 7.9 * T], [4.2 * T, 7.9 * T]], 6, 0);
  unit('drone', P1, [[3.4 * T, 4.2 * T], [7.6 * T, 5.0 * T], [6.2 * T, 8.6 * T], [3.4 * T, 4.2 * T]], 24, 0.1, { fly: 16 });
  unit('drone', P1, [[7.8 * T, 9.4 * T], [9.4 * T, 2.6 * T], [7.8 * T, 9.4 * T]], 24, 0.6, { fly: 18 });
  const raider = unit('raider', P2, [[0.5 * T, 3.9 * T], [1.9 * T, 3.3 * T], [0.5 * T, 3.9 * T]], 10, 0, { siphon: true });
  unit('tank', P2, [[10.4 * T, 10.4 * T], [8.4 * T, 9.9 * T], [10.4 * T, 10.4 * T]], 11, 0.3, { firing: true, aim: [6.3 * T, 9.4 * T] });
  unit('tank', P2, [[10.6 * T, 9.1 * T], [9.2 * T, 9.6 * T], [10.6 * T, 9.1 * T]], 11, 0.7, { firing: true, aim: [5.6 * T, 9.9 * T] });
  for (let i = 0; i < 6; i++) unit('infantry', P1, [[5.4 * T + (i % 3) * 5, 9.4 * T + Math.floor(i / 3) * 5], [7.9 * T + (i % 3) * 5, 9.4 * T + Math.floor(i / 3) * 5], [5.4 * T + (i % 3) * 5, 9.4 * T + Math.floor(i / 3) * 5]], 7, 0.05 * i, { firing: i < 3, aim: [10.7 * T, 8.1 * T] });
  for (let i = 0; i < 4; i++) unit('infantry', P2, [[10.7 * T - i * 4, 8.1 * T + i * 6], [9.8 * T - i * 4, 8.6 * T + i * 6], [10.7 * T - i * 4, 8.1 * T + i * 6]], 6, 0.3 + i * 0.1, { firing: true, aim: [7.9 * T, 9.4 * T] });
  // efeitos: projéteis, explosões, fumaça, sifão
  const projGeo = new THREE.SphereGeometry(0.9, 6, 6); const projMat = new THREE.MeshBasicMaterial({ color: 0xffd9a0 }); const projs = [];
  const boomGeo = new THREE.SphereGeometry(1, 10, 8); const booms = [];
  const SMOKE_N = 420; const sPos = new Float32Array(SMOKE_N * 3); const sLife = new Float32Array(SMOKE_N); const sVel = new Float32Array(SMOKE_N * 3); let sIdx = 0;
  const smokeGeo = new THREE.BufferGeometry(); smokeGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3)); const smoke = new THREE.Points(smokeGeo, new THREE.PointsMaterial({ color: 0x5a5f68, size: 5, transparent: true, opacity: 0.35, depthWrite: false, sizeAttenuation: true })); scene.add(smoke);
  const FIRE_N = 120; const fPos = new Float32Array(FIRE_N * 3); const fLife = new Float32Array(FIRE_N); let fIdx = 0; const fireGeo = new THREE.BufferGeometry(); fireGeo.setAttribute('position', new THREE.BufferAttribute(fPos, 3)); const firePts = new THREE.Points(fireGeo, new THREE.PointsMaterial({ color: 0xff8a3c, size: 3, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending })); scene.add(firePts);
  function puff(x, y, z) { const i = sIdx++ % SMOKE_N; sPos[i * 3] = x; sPos[i * 3 + 1] = z; sPos[i * 3 + 2] = -y; sLife[i] = 2.5; sVel[i * 3] = (Math.random() - .5) * 3; sVel[i * 3 + 1] = 8 + Math.random() * 4; sVel[i * 3 + 2] = (Math.random() - .5) * 3; }
  function spark(x, y, z) { const i = fIdx++ % FIRE_N; fPos[i * 3] = x; fPos[i * 3 + 1] = z; fPos[i * 3 + 2] = -y; fLife[i] = 0.5 + Math.random() * 0.4; }
  const beamMat = new THREE.LineBasicMaterial({ color: 0xd64cff, transparent: true, opacity: 0.9 }); const beamGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]); const beam = new THREE.Line(beamGeo, beamMat); scene.add(beam);
  const flash = new THREE.PointLight(0xffc878, 0, 70, 2); scene.add(flash); let flashT = 0;
  function pathPos(u) { const segs = u.path.length - 1; let total = 0; const lens = []; for (let i = 0; i < segs; i++) { const l = Math.hypot(u.path[i + 1][0] - u.path[i][0], u.path[i + 1][1] - u.path[i][1]); lens.push(l); total += l; } let d = (u.t * total) % total; for (let i = 0; i < segs; i++) { if (d <= lens[i]) { const k = lens[i] ? d / lens[i] : 0; const a = u.path[i], b = u.path[i + 1]; return { x: a[0] + (b[0] - a[0]) * k, y: a[1] + (b[1] - a[1]) * k, ang: Math.atan2(b[1] - a[1], b[0] - a[0]) }; } d -= lens[i]; } return { x: u.path[0][0], y: u.path[0][1], ang: 0 }; }
  function fire(from, to, z0) { projs.push({ x: from.x, y: from.y, tx: to[0] + (Math.random() - .5) * 14, ty: to[1] + (Math.random() - .5) * 14, t: 0, dur: 0.45 + Math.random() * 0.2, z0, m: new THREE.Mesh(projGeo, projMat) }); scene.add(projs[projs.length - 1].m); flash.position.copy(toV3(from.x, from.y, z0 + 2)); flashT = 0.06; }
  function boom(x, y) { const m = new THREE.Mesh(boomGeo, new THREE.MeshBasicMaterial({ color: 0xffb070, transparent: true, opacity: 0.8 })); m.position.copy(toV3(x, y, groundH(x, y) + 2)); scene.add(m); booms.push({ m, t: 0 }); for (let i = 0; i < 4; i++) spark(x + (Math.random() - .5) * 6, y + (Math.random() - .5) * 6, groundH(x, y) + 2); puff(x, y, groundH(x, y) + 3); }
  // controles de câmera
  let drag = null; const touches = new Map(); let pinch = null;
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('pointerdown', e => { canvas.setPointerCapture(e.pointerId); touches.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (touches.size === 2) { const p = [...touches.values()]; pinch = { d: Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y), dist: cam.dist }; drag = null; return; } drag = { x: e.clientX, y: e.clientY, b: e.button }; S.state.orbit = false; const ob = document.getElementById('b-orbit'); if (ob) ob.classList.remove('on'); });
  canvas.addEventListener('pointermove', e => { const t = touches.get(e.pointerId); if (t) { t.x = e.clientX; t.y = e.clientY; } if (pinch && touches.size === 2) { const p = [...touches.values()]; const d = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y); cam.dist = Math.max(120, Math.min(700, pinch.dist * pinch.d / d)); return; } if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
    if (drag.b === 2 || drag.b === 1) { const right = new THREE.Vector3(Math.cos(cam.yaw), 0, -Math.sin(cam.yaw)); const fwd = new THREE.Vector3(-Math.sin(cam.yaw), 0, -Math.cos(cam.yaw)); cam.target.addScaledVector(right, -dx * 0.5 * cam.dist / 300); cam.target.addScaledVector(fwd, -dy * 0.5 * cam.dist / 300); }
    else { cam.yaw -= dx * 0.006; cam.pitch = Math.max(0.5, Math.min(1.3, cam.pitch + dy * 0.004)); } });
  const endP = e => { touches.delete(e.pointerId); if (touches.size < 2) pinch = null; drag = null; };
  canvas.addEventListener('pointerup', endP); canvas.addEventListener('pointercancel', endP);
  canvas.addEventListener('wheel', e => { e.preventDefault(); cam.dist = Math.max(120, Math.min(700, cam.dist * Math.exp(e.deltaY * 0.0012))); }, { passive: false });
  // dia e noite
  S.setNight = function (on) { S.state.night = on; sun.intensity = on ? 0.18 : 2.4; sun.color.set(on ? 0x8aa0ff : 0xffe9c4); hemi.intensity = on ? 0.22 : 0.7; amb.intensity = on ? 0.12 : 0.3; scene.background = new THREE.Color(on ? 0x05070f : 0x9fb0c4); scene.fog.color.set(on ? 0x05070f : 0x9fb0c4);
    for (const p of pointLights) p.l.intensity = on ? (p.l === coreLight ? 900 : p.l === fireLight ? 220 : 160) : 0; renderer.toneMappingExposure = on ? 0.9 : 1.05; };
  S.setShadows = function (on) { S.state.shadows = on; renderer.shadowMap.enabled = on; sun.castShadow = on; scene.traverse(o => { if (o.material) o.material.needsUpdate = true; }); };
  S.setNight(false);
  let last = performance.now(), frames = 0, fpsT = 0, fps = 0;
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000); last = now; S.time += dt; frames++; fpsT += dt; if (fpsT >= 1) { fps = frames / fpsT; frames = 0; fpsT = 0; }
    if (S.state.orbit) cam.yaw += dt * 0.12; placeCamera();
    for (const u of units) {
      u.t += dt * u.sp / 400; const p = pathPos(u); const h = u.fly ? u.fly : groundH(p.x, p.y);
      u.m.position.copy(toV3(p.x, p.y, h + (u.def === 'mech' ? Math.abs(Math.sin(S.time * 6)) * 1.2 : u.def === 'infantry' ? Math.abs(Math.sin(S.time * 10 + u.t * 50)) * 0.6 : 0))); u.m.rotation.y = p.ang;
      if (u.tur && u.aim) { const a = Math.atan2(u.aim[1] - p.y, u.aim[0] - p.x); u.tur.rotation.y = a - p.ang; }
      if (u.firing && Math.random() < dt * 1.6) { const a = u.aim ? Math.atan2(u.aim[1] - p.y, u.aim[0] - p.x) : p.ang; fire({ x: p.x + Math.cos(a) * 7, y: p.y + Math.sin(a) * 7 }, u.aim || [p.x + Math.cos(a) * 90, p.y + Math.sin(a) * 90], h + (u.def === 'tank' ? 7 : 4)); }
      if (u.siphon) { const q = [2.9 * T + 13, 2.7 * T + 10]; beam.geometry.setFromPoints([toV3(p.x, p.y, h + 4), toV3(q[0], q[1], groundH(q[0], q[1]) + 8)]); beamMat.opacity = 0.6 + 0.4 * Math.sin(S.time * 12); }
    }
    for (const t of towers) { const a = Math.atan2(10 * T - t.y, 10 * T - t.x) + Math.sin(S.time * 0.7 + t.x) * 0.4; t.tur.rotation.y = a; if (Math.random() < dt * 0.5) fire({ x: t.x + Math.cos(a) * 8, y: t.y + Math.sin(a) * 8 }, [t.x + Math.cos(a) * 120, t.y + Math.sin(a) * 120], groundH(t.x, t.y) + 15); }
    for (let i = projs.length - 1; i >= 0; i--) { const pr = projs[i]; pr.t += dt; const k = Math.min(1, pr.t / pr.dur); const x = pr.x + (pr.tx - pr.x) * k, y = pr.y + (pr.ty - pr.y) * k; const z = pr.z0 + Math.sin(k * Math.PI) * 14 * (1 - pr.z0 / 20) + (groundH(pr.tx, pr.ty) - pr.z0 + 2) * k; pr.m.position.copy(toV3(x, y, z)); if (k >= 1) { scene.remove(pr.m); projs.splice(i, 1); boom(pr.tx, pr.ty); } }
    for (let i = booms.length - 1; i >= 0; i--) { const b = booms[i]; b.t += dt; const k = b.t / 0.35; b.m.scale.setScalar(2 + k * 9); b.m.material.opacity = 0.8 * (1 - k); if (k >= 1) { scene.remove(b.m); b.m.material.dispose(); booms.splice(i, 1); } }
    if (flashT > 0) { flashT -= dt; flash.intensity = flashT > 0 ? 500 : 0; }
    if (Math.random() < dt * 6) { puff(7.5 * T + 14.5, 2.7 * T + 4.5, 22); } if (Math.random() < dt * 6) puff(8.3 * T + 14.5, 4.4 * T + 4.5, 22);
    if (Math.random() < dt * 8) { spark(7.0 * T + 6 + (Math.random() - .5) * 6, 9.5 * T + 4 + (Math.random() - .5) * 6, groundH(7 * T, 9.5 * T) + 3); if (Math.random() < 0.3) puff(7.0 * T + 6, 9.5 * T + 4, groundH(7 * T, 9.5 * T) + 5); }
    for (let i = 0; i < SMOKE_N; i++) { if (sLife[i] <= 0) { sPos[i * 3 + 1] = -999; continue; } sLife[i] -= dt; sPos[i * 3] += sVel[i * 3] * dt; sPos[i * 3 + 1] += sVel[i * 3 + 1] * dt; sPos[i * 3 + 2] += sVel[i * 3 + 2] * dt; }
    for (let i = 0; i < FIRE_N; i++) { if (fLife[i] <= 0) { fPos[i * 3 + 1] = -999; continue; } fLife[i] -= dt; fPos[i * 3 + 1] += 14 * dt; }
    smokeGeo.attributes.position.needsUpdate = true; fireGeo.attributes.position.needsUpdate = true;
    if (S.state.night) { fireLight.intensity = 160 + Math.random() * 120; coreLight.intensity = 800 + Math.sin(S.time * 2) * 150; }
    renderer.render(scene, camera);
    const st = document.getElementById('stats'); if (st && frames % 10 === 0) st.textContent = `${fps.toFixed(0)} fps · ${renderer.info.render.calls} draw calls · ${(renderer.info.render.triangles / 1000).toFixed(0)}k triângulos · ${units.length} unidades`;
    requestAnimationFrame(frame);
  }
  S.start = () => requestAnimationFrame(frame);
  return S;
}
ARD.scene3d = { create, buildGeometry };
})(globalThis.ARD = globalThis.ARD || {});
