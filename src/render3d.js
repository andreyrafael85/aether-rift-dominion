/* Renderizador 3D do jogo (Three.js, v3.0a): mesma interface do renderizador 2D. Câmera RTS, instancing por modelo,
   relevo real (biomas, cordilheiras, Fenda), névoa projetada no terreno, sombras, dia e noite, efeitos. Só lê a simulação. */
(function (ARD) {
'use strict';
const S = ARD.sim, V = ARD.vox, MD = ARD.models, X = ARD.vox3d;
const TAU = Math.PI * 2; const TILE = 64, TILES = S.WORLD / TILE; const FOGN = 100, FOGC = S.WORLD / FOGN;
const NODE_MODEL = { plasma: 'crystals', minerio: 'ore', dados: 'datashards' };
const NODE_COLOR = { plasma: '#FF6A3D', minerio: '#8FA3B8', dados: '#7FE3A1' };
const BIOME_RGB = { gelo: [0.66, 0.73, 0.8], rocha: [0.41, 0.42, 0.45], tundra: [0.36, 0.43, 0.36], basalto: [0.23, 0.21, 0.24] };
const BIOME_MINI = { gelo: '#5C6B7A', rocha: '#4A4E56', tundra: '#3E5242', basalto: '#2A262C' };
function hexToRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function rgba(h, a) { const c = hexToRgb(h); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; }
function create(canvas, overlay, mini) {
  const _v = new THREE.Vector3(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _c = new THREE.Color(); const UP = new THREE.Vector3(0, 1, 0);
  const R = { canvas, w: 0, h: 0, dpr: 1, K: 1.7, zoomMin: 0.55, zoomMax: 2.4, supportsYaw: true, fx: { floats: [], rings: [] }, time: 0, shake: 0, icons: new Map(), geos: new Map(), inst: new Map(), sim: null, night: 0, spriteCache: new Map(), is3d: true };
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  const isTouch = matchMedia('(pointer: coarse)').matches;
  renderer.setPixelRatio(Math.min(isTouch ? 1.5 : 2, window.devicePixelRatio || 1));
  renderer.shadowMap.enabled = !isTouch; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  const ADD = window.THREE_ADDONS || null; let composer = null, bloomPass = null, ssaoPass = null;
  R.quality = { name: 'media', shadows: !isTouch, shadowMap: 2048, post: !!ADD && !isTouch, ssao: false, pr: Math.min(isTouch ? 1.5 : 2, window.devicePixelRatio || 1), particles: 1 };
  function buildComposer() {
    if (composer) { composer.dispose && composer.dispose(); composer = null; bloomPass = null; ssaoPass = null; }
    if (!ADD || !R.quality.post) return;
    composer = new ADD.EffectComposer(renderer); composer.setPixelRatio(R.quality.pr);
    // r160: SSAOPass nao renderiza a cena; ele le o buffer do passe anterior. O RenderPass precisa vir SEMPRE antes.
    composer.addPass(new ADD.RenderPass(scene, camera));
    if (R.quality.ssao) { ssaoPass = new ADD.SSAOPass(scene, camera, R.w || 800, R.h || 600); ssaoPass.kernelRadius = 24; ssaoPass.minDistance = 0.0006; ssaoPass.maxDistance = 0.04; if (R.ssaoOut != null) ssaoPass.output = R.ssaoOut;
      // Os passes de tela cheia do SSAO (oclusao e blur) nao precisam de depth; com depth test ligado o blur reprovava no proprio alvo e a saida ficava preta.
      [ssaoPass.ssaoMaterial, ssaoPass.blurMaterial].forEach(m => { m.depthTest = false; m.depthWrite = false; });
      composer.addPass(ssaoPass); }
    bloomPass = new ADD.UnrealBloomPass(new THREE.Vector2(R.w || 800, R.h || 600), 0.42, 0.5, 1.3); composer.addPass(bloomPass);
    composer.addPass(new ADD.OutputPass());
    if (R.w) composer.setSize(R.w, R.h);
  }
  R.setQuality = function (name, over) {
    const q = R.quality; q.name = name; over = over || {};
    if (name === 'auto') name = isTouch ? 'baixa' : 'media';
    if (name === 'baixa') { q.shadows = false; q.post = false; q.ssao = false; q.pr = 1; q.particles = 0.5; }
    else if (name === 'alta') { q.shadows = true; q.shadowMap = 4096; q.post = !!ADD; q.ssao = !!ADD; q.pr = Math.min(2, window.devicePixelRatio || 1); q.particles = 1; }
    else { q.shadows = !isTouch; q.shadowMap = 2048; q.post = !!ADD; q.ssao = false; q.pr = Math.min(isTouch ? 1.5 : 2, window.devicePixelRatio || 1); q.particles = 1; }
    if (over.ssao != null) q.ssao = over.ssao && !!ADD; if (over.shadowMap) q.shadowMap = over.shadowMap; if (over.post != null) q.post = over.post && !!ADD;
    renderer.shadowMap.enabled = q.shadows; renderer.setPixelRatio(q.pr); if (typeof sun !== 'undefined') { sun.castShadow = q.shadows; sun.shadow.mapSize.set(q.shadowMap, q.shadowMap); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
    scene.traverse(o => { if (o.isInstancedMesh || o.isMesh) o.castShadow = o.castShadow && q.shadows; });
    buildComposer();
  };
  const octx = overlay.getContext('2d'); const mctx = mini.getContext('2d'); const mfog = document.createElement('canvas'); const mfctx = mfog.getContext('2d');
  const scene = new THREE.Scene(); const camera = new THREE.PerspectiveCamera(38, 1, 30, 6000);
  const CAM = { pitch: 0.95, baseDist: 760 };
  // ---------- luzes ----------
  const hemi = new THREE.HemisphereLight(0x9fb8d6, 0x2a2a30, 0.55); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffe9c4, 1.6); sun.castShadow = !isTouch; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0006; scene.add(sun); scene.add(sun.target);
  const amb = new THREE.AmbientLight(0x404860, 0.3); scene.add(amb);
  scene.fog = new THREE.Fog(0x9fb0c4, 1500, 3200);
  R.setQuality('auto');
  const lightPool = []; for (let i = 0; i < 10; i++) { const l = new THREE.PointLight(0xffc070, 0, 220, 2); scene.add(l); lightPool.push(l); }
  const flashLight = new THREE.PointLight(0xffc878, 0, 160, 2); scene.add(flashLight); let flashT = 0;

  // ---------- terreno ----------
  let heights = null; const HN = 101; const HS = S.WORLD / (HN - 1);
  function H(x, y) { // altura bilinear
    if (!heights) return 0; const gx = Math.max(0, Math.min(HN - 1.001, x / HS)), gy = Math.max(0, Math.min(HN - 1.001, y / HS)); const ix = gx | 0, iy = gy | 0, fx = gx - ix, fy = gy - iy;
    const a = heights[iy * HN + ix], b = heights[iy * HN + ix + 1], c = heights[(iy + 1) * HN + ix], d = heights[(iy + 1) * HN + ix + 1];
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
  }
  R.H = H;
  const fogData = new Uint8Array(FOGN * FOGN * 4); const fogTex = new THREE.DataTexture(fogData, FOGN, FOGN, THREE.RGBAFormat); fogTex.magFilter = THREE.LinearFilter; fogTex.minFilter = THREE.LinearFilter; fogTex.colorSpace = THREE.NoColorSpace;
  const terrData = new Uint8Array(TILES * TILES * 4); const terrTex = new THREE.DataTexture(terrData, TILES, TILES, THREE.RGBAFormat); terrTex.magFilter = THREE.LinearFilter; terrTex.minFilter = THREE.LinearFilter; terrTex.colorSpace = THREE.NoColorSpace;
  let terrain = null; R.poolLights = []; R.mist = [];
  function buildTerrain(sim) {
    const seed = sim.seed; const hash = (ix, iy) => { let n = (ix * 374761393 + iy * 668265263 + seed * 1274126177) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); n ^= n >>> 16; return (n >>> 0) / 4294967296; };
    const sm = t => t * t * (3 - 2 * t); const val = (x, y) => { const ix = Math.floor(x), iy = Math.floor(y); const fx = sm(x - ix), fy = sm(y - iy); const a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1); return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy; };
    const noise = (x, y) => 0.6 * val(x, y) + 0.3 * val(x * 2.1 + 7.3, y * 2.1 + 3.1) + 0.1 * val(x * 4.3 + 1.7, y * 4.3 + 9.2);
    heights = new Float32Array(HN * HN); const nucs = sim.players.map(p => S.nucleoOf(sim, p.id)).filter(Boolean); const rocks = sim.ents.filter(e => e.alive && e.kind === 'rock');
    for (let iy = 0; iy < HN; iy++) for (let ix = 0; ix < HN; ix++) {
      const x = ix * HS, y = iy * HS; let h = (noise(x / 520, y / 520) - 0.5) * 36 + (noise(x / 110, y / 110) - 0.5) * 7;
      const d = Math.hypot(x - S.CX, y - S.CY); if (d < 420) h -= 70 * Math.pow(1 - d / 420, 1.6);
      for (const r of rocks) { const dr = Math.hypot(x - r.x, y - r.y); if (dr < 60) h += 26 * (1 - dr / 60) * (1 - dr / 60); }
      heights[iy * HN + ix] = h;
    }
    for (const n of nucs) { const hn = H(n.x, n.y); for (let iy = 0; iy < HN; iy++) for (let ix = 0; ix < HN; ix++) { const x = ix * HS, y = iy * HS; const d = Math.hypot(x - n.x, y - n.y); if (d < 400) { const k = d < 300 ? 1 : 1 - (d - 300) / 100; heights[iy * HN + ix] = heights[iy * HN + ix] * (1 - k) + hn * k; } } }
    const geo = new THREE.PlaneGeometry(S.WORLD, S.WORLD, HN - 1, HN - 1); geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position; const cols = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) + S.WORLD / 2, y = -(pos.getZ(i)) + S.WORLD / 2; pos.setY(i, H(x, y));
      const tx = Math.min(TILES - 1, (x / TILE) | 0), ty = Math.min(TILES - 1, (y / TILE) | 0); const ti = ty * TILES + tx;
      const b1 = BIOME_RGB[S.BIOMES[sim.biome[ti]]], b2 = BIOME_RGB[S.BIOMES[sim.biome2[ti]]], mix = sim.biomeMix[ti];
      const g = 0.9 + (noise(x / 9, y / 9) - 0.5) * 0.3; let c = [b1[0] * (1 - mix) + b2[0] * mix, b1[1] * (1 - mix) + b2[1] * mix, b1[2] * (1 - mix) + b2[2] * mix];
      const d = Math.hypot(x - S.CX, y - S.CY); if (d < 420) { const k = 1 - d / 420; c = [c[0] * (1 - k) + 0.12 * k, c[1] * (1 - k) + 0.08 * k, c[2] * (1 - k) + 0.1 * k]; }
      cols[i * 3] = c[0] * g; cols[i * 3 + 1] = c[1] * g; cols[i * 3 + 2] = c[2] * g;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3)); geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0.02 });
    mat.onBeforeCompile = sh => {
      sh.uniforms.fogMap = { value: fogTex }; sh.uniforms.terrMap = { value: terrTex }; sh.uniforms.worldSize = { value: S.WORLD };
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vWuv;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n{ vec4 wp = modelMatrix * vec4(position, 1.0); vWuv = vec2(wp.x / worldSize, -wp.z / worldSize); }');
      sh.vertexShader = sh.vertexShader.replace('uniform float worldSize', 'uniform float worldSize'); if (!sh.vertexShader.includes('uniform float worldSize')) sh.vertexShader = 'uniform float worldSize;\n' + sh.vertexShader;
      sh.fragmentShader = ('uniform sampler2D fogMap; uniform sampler2D terrMap; varying vec2 vWuv;\n' + sh.fragmentShader).replace('#include <color_fragment>', '#include <color_fragment>\n{ vec4 tc = texture2D(terrMap, vWuv); diffuseColor.rgb = mix(diffuseColor.rgb, tc.rgb, tc.a * 0.2); float fl = texture2D(fogMap, vWuv).r; diffuseColor.rgb *= mix(0.06, 1.0, fl); }');
    };
    if (terrain) scene.remove(terrain);
    terrain = new THREE.Mesh(geo, mat); terrain.position.set(S.WORLD / 2, 0, -S.WORLD / 2); terrain.receiveShadow = true; scene.add(terrain);
    // Fenda: anel emissivo e luz
    const ring = new THREE.Mesh(new THREE.TorusGeometry(S.RIFT_R * 0.9, 6, 8, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 1.0, 0.5) })); ring.rotation.x = Math.PI / 2; ring.position.set(S.CX, H(S.CX, S.CY) + 4, -S.CY); scene.add(ring);
    // lagos de plasma no anel de basalto (só visuais)
    const poolMat = new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 } }, transparent: true, depthWrite: false,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform float uTime; varying vec2 vUv; float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); } float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); } void main(){ vec2 c = vUv - 0.5; float d = length(c) * 2.0; float v = n(vUv * 6.0 + uTime * 0.15) * 0.6 + n(vUv * 14.0 - uTime * 0.25) * 0.4; vec3 col = mix(vec3(2.4, 0.55, 0.25), vec3(1.6, 0.35, 2.2), smoothstep(0.35, 0.75, v)); float a = smoothstep(1.0, 0.72, d); gl_FragColor = vec4(col * (0.8 + 0.5 * v), a); }' });
    R.poolMat = poolMat;
    for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + 0.35, rr = 390 + (i % 2) * 110; const px = S.CX + Math.cos(a) * rr, py = S.CY + Math.sin(a) * rr; if (sim.ents.some(e => e.alive && e.kind === 'node' && S.dist(e.x, e.y, px, py) < 90)) continue; const pool = new THREE.Mesh(new THREE.CircleGeometry(28 + (i % 3) * 10, 32).rotateX(-Math.PI / 2), poolMat); pool.position.set(px, H(px, py) + 0.9, -py); scene.add(pool); const pl = new THREE.PointLight(0xff7a40, 0, 160, 2); pl.position.set(px, H(px, py) + 12, -py); scene.add(pl); R.poolLights.push(pl); }
    // névoa volumétrica barata: sprites aditivos na cratera da Fenda e na Tempestade
    const mistCv = document.createElement('canvas'); mistCv.width = 128; mistCv.height = 128; const mc = mistCv.getContext('2d'); const g = mc.createRadialGradient(64, 64, 4, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,0.55)'); g.addColorStop(0.5, 'rgba(255,255,255,0.18)'); g.addColorStop(1, 'rgba(255,255,255,0)'); mc.fillStyle = g; mc.fillRect(0, 0, 128, 128);
    const mistTex = new THREE.CanvasTexture(mistCv); mistTex.colorSpace = THREE.SRGBColorSpace;
    for (let i = 0; i < 16; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: mistTex, color: i % 2 ? 0xff7a4a : 0xb23cff, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false })); const a = Math.random() * TAU, rr = Math.random() * 300; sp.userData = { x: S.CX + Math.cos(a) * rr, y: S.CY + Math.sin(a) * rr, z: 10 + Math.random() * 60, s: 120 + Math.random() * 160, ph: Math.random() * TAU, kind: 'rift' }; scene.add(sp); R.mist.push(sp); }
    for (let i = 0; i < 16; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: mistTex, color: 0x9a7cff, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false })); sp.visible = false; sp.userData = { kind: 'storm', ph: Math.random() * TAU, ox: Math.random(), oy: Math.random(), z: 20 + Math.random() * 60, s: 160 + Math.random() * 160 }; scene.add(sp); R.mist.push(sp); }
    const rl = new THREE.PointLight(0xff5e3a, 2500, 900, 2); rl.position.set(S.CX, H(S.CX, S.CY) + 60, -S.CY); scene.add(rl);
  }
  // ---------- geometrias e instancing ----------
  const matMain = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0.12 });
  const matEm = new THREE.MeshBasicMaterial({ vertexColors: true });
  const matGhost = new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, opacity: 0.55, roughness: 0.9 });
  function modelFor(def, pid, seed) {
    if (NODE_MODEL[def]) return MD[NODE_MODEL[def]](seed);
    if (def === 'crate') return MD.crate(); if (def === 'wreck') return MD.wreck(); if (def === 'rocks') return MD.rocks(seed); if (def === 'ruin') return MD.ruin(seed);
    const p = R.sim.players[pid]; const fn = (def === 'pirata' && p.faction === 'vehnar') ? MD.BY_DEF.pirata_vehnar : MD.BY_DEF[def]; return fn(p.color, p.faction);
  }
  function geoOf(def, pid, seed) { const key = def + '|' + pid + '|' + (seed || 0); let g = R.geos.get(key); if (!g) { g = X.buildGeometry(modelFor(def, pid, seed), { emBoost: 1.8 }); R.geos.set(key, g); } return g; }
  function instOf(def, pid, seed, ghost) {
    const key = def + '|' + pid + '|' + (seed || 0) + (ghost ? '|g' : ''); let it = R.inst.get(key); if (it) return it;
    const g = geoOf(def, pid, seed); const cap = 64;
    const mk = (geo, mat) => { const m = new THREE.InstancedMesh(geo, mat, cap); m.count = 0; m.frustumCulled = false; m.castShadow = !ghost && !isTouch; m.receiveShadow = !ghost; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(m); return m; };
    it = { geo: g, main: mk(g.main, ghost ? matGhost : matMain), em: g.em && !ghost ? mk(g.em, matEm) : null, n: 0, cap }; R.inst.set(key, it); return it;
  }
  function grow(it) { const cap = it.cap * 2; for (const k of ['main', 'em']) { const old = it[k]; if (!old) continue; const m = new THREE.InstancedMesh(old.geometry, old.material, cap); m.frustumCulled = false; m.castShadow = old.castShadow; m.receiveShadow = old.receiveShadow; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.remove(old); old.dispose(); scene.add(m); it[k] = m; } it.cap = cap; }
  function put(it, x, y, z, ang, scale, scaleY, tint) {
    if (it.n >= it.cap) grow(it);
    _p.set(x, H(x, y) + (z || 0), -y); _q.setFromAxisAngle(UP, ang || 0); _s.set(scale, scale * (scaleY == null ? 1 : scaleY), scale); _m.compose(_p, _q, _s);
    it.main.setMatrixAt(it.n, _m); _c.setScalar(tint == null ? 1 : tint); it.main.setColorAt(it.n, _c);
    if (it.em) { it.em.setMatrixAt(it.n, _m); it.em.setColorAt(it.n, _c); }
    it.n++;
  }
  function fitOf(e, g) { const foot = e.kind === 'node' ? 2 * e.r * 1.2 * (0.55 + 0.45 * (e.max ? e.amount / e.max : 1)) : e.kind === 'wreck' ? 2 * e.r * 1.3 : e.kind === 'rock' ? 2 * e.r * 1.9 : 2 * e.r * 1.25; return foot / g.width; }
  // sprites 2D só para ícones do HUD
  R.sprite = function (def, pid, facing, dmg, seed) { const key = def + '|' + pid + '|' + (seed || 0); let sp = R.spriteCache.get(key); if (!sp) { const m = modelFor(def, pid, seed); sp = V.renderSprite(m, 0, 4, {}); R.spriteCache.set(key, sp); } return sp; };
  R.icon = function (def, pid) { const key = def + '|' + pid; let u = R.icons.get(key); if (u) return u; const sp = R.sprite(def, pid, 0, false, 0); const cv = document.createElement('canvas'); cv.width = 48; cv.height = 48; const c = cv.getContext('2d'); const sc = Math.min(44 / sp.w, 44 / sp.h); c.imageSmoothingEnabled = sc < 1; c.drawImage(sp.canvas, (48 - sp.w * sc) / 2, (48 - sp.h * sc) / 2, sp.w * sc, sp.h * sc); u = cv.toDataURL(); R.icons.set(key, u); return u; };
  R.prepare = function (sim, onProgress, onDone) {
    R.sim = sim; buildTerrain(sim); const jobs = [];
    for (const p of sim.players) { for (const def in S.BUILDINGS) jobs.push([def, p.id, 0]); for (const def of ['infantaria', 'coletor', 'veiculo_hull', 'veiculo_turret', 'torre_base', 'torre_turret', 'drone', 'suporte', 'pirata', 'bastiao_base', 'bastiao_turret']) jobs.push([def, p.id, 0]); }
    for (const res in NODE_MODEL) for (let s = 0; s < 4; s++) jobs.push([res, -1, s]);
    for (let s = 0; s < 6; s++) { jobs.push(['rocks', -1, s]); jobs.push(['ruin', -1, s]); } jobs.push(['crate', -1, 0]); jobs.push(['wreck', -1, 0]);
    let i = 0; function chunk() { const t0 = performance.now(); while (i < jobs.length && performance.now() - t0 < 24) { const j = jobs[i++]; geoOf(j[0], j[1], j[2]); } if (onProgress) onProgress(i / jobs.length); if (i < jobs.length) requestAnimationFrame(chunk); else if (onDone) onDone(); } chunk();
  };
  // ---------- projeção ----------
  function updateCamera(cam) {
    const d = CAM.baseDist / cam.zoom; const yaw = cam.yaw == null ? Math.PI / 4 : cam.yaw; const ty = H(cam.x, cam.y);
    camera.position.set(cam.x + Math.sin(yaw) * Math.cos(CAM.pitch) * d + R.shakeX, ty + Math.sin(CAM.pitch) * d, -cam.y + Math.cos(yaw) * Math.cos(CAM.pitch) * d + R.shakeY);
    camera.lookAt(cam.x, ty, -cam.y); camera.updateMatrixWorld(); camera.updateProjectionMatrix();
    sun.position.set(cam.x - 420, ty + 760, -cam.y + 520); sun.target.position.set(cam.x, ty, -cam.y); sun.target.updateMatrixWorld();
    const sc = sun.shadow.camera; const ext = Math.min(900, d * 1.1); sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.near = 100; sc.far = 2200; sc.updateProjectionMatrix();
  }
  R.shakeX = 0; R.shakeY = 0;
  R.worldToScreen = function (cam, x, y, z) { _v.set(x, H(x, y) + (z || 0), -y).project(camera); return [(_v.x + 1) / 2 * R.w, (1 - _v.y) / 2 * R.h]; };
  const ray = new THREE.Raycaster(); const plane = new THREE.Plane(UP, 0); const hit = new THREE.Vector3(); const ndc = new THREE.Vector2();
  R.screenToWorld = function (cam, sx, sy) { ndc.set(sx / R.w * 2 - 1, 1 - sy / R.h * 2); ray.setFromCamera(ndc, camera); plane.constant = 0; if (!ray.ray.intersectPlane(plane, hit)) return [cam.x, cam.y]; let wx = hit.x, wy = -hit.z; plane.constant = -H(wx, wy); if (ray.ray.intersectPlane(plane, hit)) { wx = hit.x; wy = -hit.z; } return [wx, wy]; };
  R.screenDeltaToWorld = function (cam, dx, dy) { const a = R.screenToWorld(cam, R.w / 2, R.h / 2), b = R.screenToWorld(cam, R.w / 2 + dx, R.h / 2 + dy); return [b[0] - a[0], b[1] - a[1]]; };
  function miniM() { return mini.width / (2 * S.WORLD); }
  R.worldToMini = function (x, y) { const m = miniM(); return [(x - y) * m + mini.width / 2, (x + y) * m / 2 + mini.width / 4]; };
  R.miniToWorld = function (nx, ny) { const m = miniM(); const X2 = (nx * mini.width - mini.width / 2) / m, Y2 = (ny * mini.width - mini.width / 4) * 2 / m; return [(X2 + Y2) / 2, (Y2 - X2) / 2]; };
  R.resize = function () { const dpr = Math.min(2, window.devicePixelRatio || 1); const w = canvas.clientWidth, h = canvas.clientHeight; R.w = w; R.h = h; R.dpr = dpr; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); if (composer) { composer.setSize(w, h); if (ssaoPass) ssaoPass.setSize(w, h); } if (overlay.width !== Math.round(w * dpr)) { overlay.width = Math.round(w * dpr); overlay.height = Math.round(h * dpr); } const ms = mini.clientWidth || 184; if (mini.width !== ms * dpr) { mini.width = ms * dpr; mini.height = ms * dpr; mfog.width = mini.width; mfog.height = mini.height; } };

  // ---------- efeitos ----------
  const PN = 2200; const pPos = new Float32Array(PN * 3), pCol = new Float32Array(PN * 3); const P = { x: new Float32Array(PN), y: new Float32Array(PN), z: new Float32Array(PN), vx: new Float32Array(PN), vy: new Float32Array(PN), vz: new Float32Array(PN), t: new Float32Array(PN), life: new Float32Array(PN), kind: new Uint8Array(PN), i: 0 };
  const pGeo = new THREE.BufferGeometry(); pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3)); pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
  const smokePts = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 9, vertexColors: true, transparent: true, opacity: 0.5, depthWrite: false, sizeAttenuation: true })); smokePts.frustumCulled = false; scene.add(smokePts);
  const SN = 600; const sPos = new Float32Array(SN * 3), sCol = new Float32Array(SN * 3); const SP = { x: new Float32Array(SN), y: new Float32Array(SN), z: new Float32Array(SN), vx: new Float32Array(SN), vy: new Float32Array(SN), vz: new Float32Array(SN), t: new Float32Array(SN), life: new Float32Array(SN), i: 0 };
  const sGeo = new THREE.BufferGeometry(); sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3)); sGeo.setAttribute('color', new THREE.BufferAttribute(sCol, 3));
  const sparkPts = new THREE.Points(sGeo, new THREE.PointsMaterial({ size: 3.2, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })); sparkPts.frustumCulled = false; scene.add(sparkPts);
  function smoke(x, y, z, col, life, vz) { const i = P.i++ % PN; P.x[i] = x; P.y[i] = y; P.z[i] = z; P.vx[i] = (Math.random() - .5) * 6; P.vy[i] = (Math.random() - .5) * 6; P.vz[i] = vz == null ? 14 : vz; P.t[i] = 0; P.life[i] = life || 2.5; P.kind[i] = 0; pCol[i * 3] = col[0]; pCol[i * 3 + 1] = col[1]; pCol[i * 3 + 2] = col[2]; }
  function snow(x, y) { const i = P.i++ % PN; P.x[i] = x; P.y[i] = y; P.z[i] = 90 + Math.random() * 40; P.vx[i] = 25; P.vy[i] = 8; P.vz[i] = -45; P.t[i] = 0; P.life[i] = 3.2; P.kind[i] = 1; pCol[i * 3] = 0.9; pCol[i * 3 + 1] = 0.93; pCol[i * 3 + 2] = 1; }
  function spark(x, y, z, col, sp, g) { const i = SP.i++ % SN; const a = Math.random() * TAU; SP.x[i] = x; SP.y[i] = y; SP.z[i] = z; SP.vx[i] = Math.cos(a) * sp * Math.random(); SP.vy[i] = Math.sin(a) * sp * Math.random(); SP.vz[i] = sp * (0.4 + Math.random() * 0.8); SP.t[i] = 0; SP.life[i] = 0.4 + Math.random() * 0.6; sCol[i * 3] = col[0]; sCol[i * 3 + 1] = col[1]; sCol[i * 3 + 2] = col[2]; }
  const boomGeo = new THREE.SphereGeometry(1, 10, 8); const boomMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.5, 0.8), transparent: true, opacity: 0.8, depthWrite: false }); const booms = new THREE.InstancedMesh(boomGeo, boomMat, 48); booms.count = 0; booms.frustumCulled = false; scene.add(booms); const boomList = [];
  const decalGeo = new THREE.CircleGeometry(1, 18); decalGeo.rotateX(-Math.PI / 2); const decals = new THREE.InstancedMesh(decalGeo, new THREE.MeshBasicMaterial({ color: 0x0b0908, transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }), 160); decals.count = 0; decals.frustumCulled = false; scene.add(decals); const decalList = [];
  const ringGeo = new THREE.RingGeometry(0.82, 1, 28); ringGeo.rotateX(-Math.PI / 2); const selRings = new THREE.InstancedMesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 }), 256); selRings.count = 0; selRings.frustumCulled = false; scene.add(selRings);
  const rangeRings = new THREE.InstancedMesh(new THREE.RingGeometry(0.98, 1, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 }), 32); rangeRings.count = 0; rangeRings.frustumCulled = false; scene.add(rangeRings);
  const shellGeo = new THREE.SphereGeometry(1.6, 6, 6); const shells = new THREE.InstancedMesh(shellGeo, new THREE.MeshBasicMaterial({ color: 0xffd9a0 }), 256); shells.count = 0; shells.frustumCulled = false; scene.add(shells);
  const BL = 512; const blPos = new Float32Array(BL * 6); const blGeo = new THREE.BufferGeometry(); blGeo.setAttribute('position', new THREE.BufferAttribute(blPos, 3)); const bullets = new THREE.LineSegments(blGeo, new THREE.LineBasicMaterial({ color: 0xffe6a8, transparent: true, opacity: 0.9 })); bullets.frustumCulled = false; scene.add(bullets);
  const beamGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]); const beamMat = new THREE.LineBasicMaterial({ color: 0xd64cff, transparent: true, opacity: 0.9 }); const BEAMS = 16; const beams = []; for (let i = 0; i < BEAMS; i++) { const l = new THREE.Line(beamGeo.clone(), beamMat); l.visible = false; l.frustumCulled = false; scene.add(l); beams.push(l); }
  const stormDisc = new THREE.Mesh(new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x7a5cff, transparent: true, opacity: 0.12, depthWrite: false })); stormDisc.visible = false; scene.add(stormDisc);
  let lightning = 0;
  function addDecal(x, y, r) { decalList.push({ x, y, r, t: 0, life: 200 }); if (decalList.length > 160) decalList.shift(); }

  R.onEvents = function (events, sim, human) {
    for (const e of events) {
      switch (e.t) {
        case 'shot': flashLight.position.set(e.x1, H(e.x1, e.y1) + 8, -e.y1); flashT = 0.06; if (e.beam) R.fx.rings.push({ x: e.x2, y: e.y2, r0: 4, r1: 18, col: '#9FE8FF', t: 0, life: 0.2 }); break;
        case 'impact': { const big = e.splash > 0; for (let i = 0; i < (big ? 14 : 4); i++) spark(e.x, e.y, 3, [1, 0.75, 0.4], big ? 90 : 50, true); if (big) { boomList.push({ x: e.x, y: e.y, t: 0 }); smoke(e.x, e.y, 5, [0.35, 0.32, 0.3], 1.6, 20); if (!e.hit) addDecal(e.x, e.y, e.splash * 0.7); } break; }
        case 'death': { const big = e.kind === 'building'; const col = e.owner >= 0 ? hexToRgb(sim.players[e.owner].color).map(v => v / 255) : [0.7, 0.7, 0.7]; for (let i = 0; i < (big ? 36 : 12); i++) spark(e.x, e.y, 4, Math.random() < 0.5 ? col : [1, 0.6, 0.35], big ? 160 : 80, true); for (let i = 0; i < (big ? 8 : 2); i++) smoke(e.x + (Math.random() - .5) * e.r, e.y + (Math.random() - .5) * e.r, 6, [0.16, 0.16, 0.18], 2 + Math.random() * 2, 25); boomList.push({ x: e.x, y: e.y, t: 0, big }); addDecal(e.x, e.y, big ? e.r * 1.3 : e.r * 1.2); if (big && e.owner === human) R.shake = Math.min(1, R.shake + 0.5); break; }
        case 'float': if (e.owner === human || e.kind === 'steal') R.fx.floats.push({ x: e.x, y: e.y, text: e.text, col: e.kind === 'steal' ? '#FF6A3D' : '#E8E2D6', t: 0, life: 1.3 }); break;
        case 'promote': if (e.owner === human) R.fx.floats.push({ x: e.x, y: e.y, text: ['', '★ Veterano', '★★ Elite', '★★★ Lenda'][e.rank], col: '#F2C230', t: 0, life: 1.8 }); break;
        case 'alert': if (e.p === human && e.x != null) R.fx.rings.push({ x: e.x, y: e.y, r0: 20, r1: 170, col: e.kind === 'danger' ? '#FF5E3A' : e.kind === 'good' ? '#7FE3A1' : '#F2C230', t: 0, life: 1.6, ping: true }); break;
        case 'super': if (e.kind === 'fundicao') R.fx.rings.push({ x: e.x, y: e.y, r0: 10, r1: 240, col: '#FF8C1A', t: 0, life: 3, ping: true }); else R.shake = 1; break;
        case 'jump': R.fx.rings.push({ x: e.from.x, y: e.from.y, r0: 40, r1: 300, col: '#B23CFF', t: 0, life: 1.2 }); R.fx.rings.push({ x: e.to.x, y: e.to.y, r0: 300, r1: 40, col: '#B23CFF', t: 0, life: 1.2 }); break;
        case 'built': if (e.p === human) R.fx.rings.push({ x: e.x, y: e.y, r0: 10, r1: 60, col: '#7FE3A1', t: 0, life: 0.6 }); break;
        case 'place': for (let i = 0; i < 6; i++) smoke(e.x + (Math.random() - .5) * 30, e.y + (Math.random() - .5) * 30, 1, [0.6, 0.6, 0.6], 1.2, 18); break;
        case 'crate': R.fx.rings.push({ x: e.x, y: e.y, r0: 5, r1: 50, col: '#F2C230', t: 0, life: 0.8 }); break;
        case 'storm': if (e.phase === 'active') lightning = 0.6; break;
      }
    }
  };
  function updateFx(dt) {
    for (const arr of [R.fx.floats, R.fx.rings]) for (let i = arr.length - 1; i >= 0; i--) { const o = arr[i]; o.t += dt; if (o.t >= o.life) arr.splice(i, 1); }
    for (let i = 0; i < PN; i++) { if (P.t[i] >= P.life[i]) { pPos[i * 3 + 1] = -9999; continue; } P.t[i] += dt; P.x[i] += P.vx[i] * dt; P.y[i] += P.vy[i] * dt; P.z[i] += P.vz[i] * dt; if (P.kind[i] === 0) P.vz[i] = Math.max(6, P.vz[i] - dt * 5); else if (P.z[i] <= 0) P.t[i] = P.life[i]; pPos[i * 3] = P.x[i]; pPos[i * 3 + 1] = H(P.x[i], P.y[i]) + P.z[i]; pPos[i * 3 + 2] = -P.y[i]; }
    for (let i = 0; i < SN; i++) { if (SP.t[i] >= SP.life[i]) { sPos[i * 3 + 1] = -9999; continue; } SP.t[i] += dt; SP.x[i] += SP.vx[i] * dt; SP.y[i] += SP.vy[i] * dt; SP.z[i] += SP.vz[i] * dt; SP.vz[i] -= 220 * dt; if (SP.z[i] < 0) { SP.z[i] = 0; SP.vz[i] = 0; SP.vx[i] *= 0.5; SP.vy[i] *= 0.5; } sPos[i * 3] = SP.x[i]; sPos[i * 3 + 1] = H(SP.x[i], SP.y[i]) + SP.z[i]; sPos[i * 3 + 2] = -SP.y[i]; }
    pGeo.attributes.position.needsUpdate = true; pGeo.attributes.color.needsUpdate = true; sGeo.attributes.position.needsUpdate = true; sGeo.attributes.color.needsUpdate = true;
    let n = 0; for (let i = boomList.length - 1; i >= 0; i--) { const b = boomList[i]; b.t += dt; const k = b.t / 0.35; if (k >= 1) { boomList.splice(i, 1); continue; } if (n < 48) { _p.set(b.x, H(b.x, b.y) + 3, -b.y); _s.setScalar((b.big ? 6 : 3) + k * (b.big ? 26 : 12)); _q.identity(); _m.compose(_p, _q, _s); booms.setMatrixAt(n++, _m); } } booms.count = n; booms.instanceMatrix.needsUpdate = true; boomMat.opacity = 0.6;
    n = 0; for (let i = decalList.length - 1; i >= 0; i--) { const d = decalList[i]; d.t += dt; if (d.t > d.life) { decalList.splice(i, 1); continue; } _p.set(d.x, H(d.x, d.y) + 0.5, -d.y); _s.set(d.r, 1, d.r); _q.identity(); _m.compose(_p, _q, _s); decals.setMatrixAt(n++, _m); } decals.count = n; decals.instanceMatrix.needsUpdate = true;
    R.shake = Math.max(0, R.shake - dt * 2); lightning = Math.max(0, lightning - dt * 3); if (flashT > 0) { flashT -= dt; flashLight.intensity = flashT > 0 ? 400 : 0; }
  }
  function lerp(e, a) { return [e.px + (e.x - e.px) * a, e.py + (e.y - e.py) * a]; }

  // ---------- quadro ----------
  R.draw = function (sim, view, alpha, dt) {
    R.sim = sim; R.time += dt; updateFx(dt);
    const cam = view.cam, human = view.human, me = sim.players[human]; const vis = view.reveal ? { has: () => true } : sim.vis[human]; const explored = sim.explored[human];
    R.night = (1 - Math.cos(TAU * sim.time / 750)) / 2;
    R.shakeX = R.shake > 0 ? (Math.random() - .5) * 10 * R.shake : 0; R.shakeY = R.shake > 0 ? (Math.random() - .5) * 10 * R.shake : 0;
    updateCamera(cam);
    // dia e noite
    const nt = R.night; sun.intensity = 1.6 * (1 - nt) + 0.14 * nt; sun.color.setRGB(1 - 0.45 * nt, 0.91 - 0.3 * nt, 0.77 + 0.2 * nt); hemi.intensity = 0.55 * (1 - nt) + 0.2 * nt + lightning * 0.5; amb.intensity = 0.22 * (1 - nt) + 0.1 * nt + lightning * 0.6;
    const bg = new THREE.Color().setRGB(0.62 * (1 - nt) + 0.02 * nt, 0.69 * (1 - nt) + 0.03 * nt, 0.77 * (1 - nt) + 0.06 * nt); scene.background = bg; scene.fog.color.copy(bg);
    // névoa de guerra e território → texturas do terreno
    for (let iy = 0; iy < FOGN; iy++) for (let ix = 0; ix < FOGN; ix++) { const i = (iy * FOGN + ix) * 4; const tx = (ix * FOGC / TILE) | 0, ty = (iy * FOGC / TILE) | 0; const ex = view.reveal || explored[ty * TILES + tx]; fogData[i] = ex ? 110 : 0; fogData[i + 3] = 255; }
    if (!view.reveal) for (const e of sim.ents) { if (!e.alive || e.owner !== human || (e.kind !== 'unit' && e.kind !== 'building')) continue; const r = S.sensorRadius(sim, e); const x0 = Math.max(0, ((e.x - r) / FOGC) | 0), x1 = Math.min(FOGN - 1, ((e.x + r) / FOGC) | 0), y0 = Math.max(0, ((e.y - r) / FOGC) | 0), y1 = Math.min(FOGN - 1, ((e.y + r) / FOGC) | 0); for (let iy = y0; iy <= y1; iy++) for (let ix = x0; ix <= x1; ix++) { const d = Math.hypot((ix + 0.5) * FOGC - e.x, (iy + 0.5) * FOGC - e.y); if (d <= r) { const i = (iy * FOGN + ix) * 4; const v = d > r * 0.75 ? 110 + 145 * (1 - (d - r * 0.75) / (r * 0.25)) : 255; if (v > fogData[i]) fogData[i] = v; } } }
    else fogData.fill(255);
    fogTex.needsUpdate = true;
    terrData.fill(0);
    for (const e of sim.ents) { if (!e.alive || e.kind !== 'building' || !e.built) continue; const t = S.BUILDINGS[e.def].territory; if (!t) continue; if (e.owner !== human && !vis.has(e.id) && !view.memory.has(e.id)) continue; const col = hexToRgb(sim.players[e.owner].color); const x0 = Math.max(0, ((e.x - t) / TILE) | 0), x1 = Math.min(TILES - 1, ((e.x + t) / TILE) | 0), y0 = Math.max(0, ((e.y - t) / TILE) | 0), y1 = Math.min(TILES - 1, ((e.y + t) / TILE) | 0); for (let iy = y0; iy <= y1; iy++) for (let ix = x0; ix <= x1; ix++) { if (Math.hypot((ix + 0.5) * TILE - e.x, (iy + 0.5) * TILE - e.y) <= t) { const i = (iy * TILES + ix) * 4; terrData[i] = col[0]; terrData[i + 1] = col[1]; terrData[i + 2] = col[2]; terrData[i + 3] = 255; } } }
    terrTex.needsUpdate = true;
    // instâncias
    for (const it of R.inst.values()) it.n = 0;
    let nSel = 0, nRange = 0, nShell = 0, nBul = 0, nBeam = 0; const hpList = []; const emitters = [];
    for (const e of sim.ents) {
      if (!e.alive) continue; const own = e.owner === human;
      if (e.kind === 'node') { const it = instOf(e.res, -1, e.id % 4); const g = it.geo; put(it, e.x, e.y, 0, 0, fitOf(e, g)); if (view.sel.has(e.id)) nSel = ring(nSel, e.x, e.y, e.r + 6); continue; }
      if (e.kind === 'rock') { const it = instOf('rocks', -1, e.seed % 6); put(it, e.x, e.y, 0, (e.seed % 8) * 0.8, fitOf(e, it.geo)); continue; }
      if (e.kind === 'crate') { if (!vis.has(e.id)) continue; const it = instOf('crate', -1, 0); put(it, e.x, e.y, 0, R.time, (2 * e.r * 1.6) / it.geo.width); continue; }
      if (e.kind === 'wreck') { if (!vis.has(e.id)) continue; const it = instOf('wreck', -1, 0); put(it, e.x, e.y, 0, e.ang || 0, fitOf(e, it.geo), 1, 0.6 + 0.4 * (e.max ? e.amount / e.max : 1)); if (sim.time - e.bornT < 25 && Math.random() < 0.25) { smoke(e.x, e.y, 6, [0.2, 0.2, 0.22], 1.6, 16); spark(e.x, e.y, 3, [1, 0.5, 0.2], 20, true); } if (view.sel.has(e.id)) nSel = ring(nSel, e.x, e.y, e.r + 6); continue; }
      if (e.kind === 'proj') { if (!own && !vis.has(e.id)) continue; const w = S.WEAPONS[e.weapon]; const [wx, wy] = lerp(e, alpha); if (w.proj === 'shell') { if (nShell < 256) { _p.set(wx, H(wx, wy) + e.z, -wy); _s.setScalar(1); _q.identity(); _m.compose(_p, _q, _s); shells.setMatrixAt(nShell++, _m); } } else if (nBul < BL) { const o = nBul * 6; blPos[o] = wx - e.vx * 0.03; blPos[o + 1] = H(wx, wy) + e.z; blPos[o + 2] = -(wy - e.vy * 0.03); blPos[o + 3] = wx; blPos[o + 4] = H(wx, wy) + e.z; blPos[o + 5] = -wy; nBul++; } continue; }
      if (!own && !vis.has(e.id)) continue;
      const isUnit = e.kind === 'unit'; const [wx, wy] = isUnit ? lerp(e, alpha) : [e.x, e.y]; const ud = isUnit ? S.UNITS[e.def] : S.BUILDINGS[e.def];
      const parts = MD.PARTS[e.def]; const hullDef = parts ? parts.hull : e.def; const it = instOf(hullDef, e.owner, 0); const g = it.geo; const fit = fitOf(e, g);
      const zz = isUnit && ud.flying ? 14 : 0; const moving = isUnit && (e.x !== e.px || e.y !== e.py); const bob = moving && (e.def === 'infantaria' || e.def === 'quimera' || e.def === 'soldador' || e.def === 'atirador') ? Math.abs(Math.sin(R.time * 11 + e.id)) * 1.2 : moving && (e.def === 'prensa' || e.def === 'colosso') ? Math.abs(Math.sin(R.time * 5 + e.id)) * 2.2 : 0;
      const dmg = !isUnit && e.built && e.hp < e.maxHp * 0.5; const tint = e.cloaked ? 0.55 : dmg ? 0.6 : 1;
      put(it, wx, wy, zz + bob, isUnit || ud.wall ? (e.ang || 0) : 0, fit, isUnit ? 1 : (e.built ? 1 : 0.1 + 0.9 * e.progress), tint);
      if (parts && (isUnit || e.built)) { const tt = instOf(parts.turret, e.owner, 0); put(tt, wx, wy, zz + bob + parts.z * fit, e.aimAng != null ? e.aimAng : (e.ang || 0), fit, 1, tint); }
      if (view.sel.has(e.id)) { nSel = ring(nSel, wx, wy, e.r + 5); if (!isUnit && ud.attack && nRange < 32) { _p.set(wx, H(wx, wy) + 0.6, -wy); _s.set(ud.attack.range, 1, ud.attack.range); _q.identity(); _m.compose(_p, _q, _s); rangeRings.setMatrixAt(nRange++, _m); } }
      if (e.hp < e.maxHp - 0.5 || view.sel.has(e.id) || (isUnit && e.rank > 0)) hpList.push({ x: wx, y: wy, z: zz + g.height * fit + 4, w: Math.max(16, e.r * 1.4), frac: e.hp / e.maxHp, rank: isUnit ? e.rank : 0, cloak: e.cloaked && own, r: e.r });
      if (!isUnit && e.built && (e.def === 'nucleo' || e.def === 'reator' || e.def === 'laboratorio' || e.def === 'bastiao')) emitters.push({ x: wx, y: wy, z: e.def === 'nucleo' ? 40 * fit / 1 : g.height * fit * 0.9, col: e.def === 'reator' ? 0xff8c1a : e.def === 'laboratorio' ? 0x7fe3a1 : 0xff6a3d, d: Math.hypot(wx - cam.x, wy - cam.y) });
      if (!isUnit && e.built && (e.def === 'reator' && Math.random() < 0.1 || dmg && Math.random() < 0.08)) smoke(wx + (e.def === 'reator' ? e.r * 0.35 : (Math.random() - .5) * e.r), wy - (e.def === 'reator' ? e.r * 0.3 : (Math.random() - .5) * e.r), e.def === 'reator' ? e.r * 1.1 : e.r * 0.6, dmg ? [0.15, 0.15, 0.17] : [0.4, 0.42, 0.46], 2.2 + Math.random(), 16);
      if (isUnit && e.state === 'siphon' && nBeam < BEAMS) { const t = sim.byId.get(e.target); if (t && S.dist(e.x, e.y, t.x, t.y) <= S.UNITS.pirata.siphonRange + t.r + 2) { const l = beams[nBeam++]; l.visible = true; const pa = l.geometry.attributes.position; pa.setXYZ(0, wx, H(wx, wy) + 5, -wy); pa.setXYZ(1, t.x, H(t.x, t.y) + t.r * 0.6, -t.y); pa.needsUpdate = true; if (Math.random() < 0.4) spark(t.x, t.y, t.r * 0.6, [0.85, 0.5, 1], 12, true); } }
    }
    for (let i = nBeam; i < BEAMS; i++) beams[i].visible = false;
    for (const [id, m] of view.memory) { if (vis.has(id)) continue; const it = instOf(MD.PARTS[m.def] ? MD.PARTS[m.def].hull : m.def, m.owner, 0); put(it, m.x, m.y, 0, 0, 2 * S.BUILDINGS[m.def].r * 1.25 / it.geo.width, 1, 0.45); }
    if (sim.props) for (const pr of sim.props) { if (!view.reveal && !explored[((pr.y / TILE) | 0) * TILES + ((pr.x / TILE) | 0)]) continue; const it = instOf(pr.kind, -1, pr.seed % 6); put(it, pr.x, pr.y, 0, (pr.seed % 7) * 0.9, 34 * pr.scale / it.geo.width); }
    if (view.ghost) { const gh = view.ghost; const d = S.BUILDINGS[gh.def]; const it = instOf(MD.PARTS[gh.def] ? MD.PARTS[gh.def].hull : gh.def, human, 0, true); put(it, gh.x, gh.y, 0, gh.ang || 0, 2 * d.r * 1.25 / it.geo.width, 1, gh.ok ? 1 : 0.5); nSel = ring(nSel, gh.x, gh.y, d.r + 4); if (d.territory && nRange < 32) { _p.set(gh.x, H(gh.x, gh.y) + 0.6, -gh.y); _s.set(d.territory, 1, d.territory); _q.identity(); _m.compose(_p, _q, _s); rangeRings.setMatrixAt(nRange++, _m); } }
    if (view.wallGhost && view.ghost) for (const g2 of view.wallGhost) { const it = instOf(view.ghost.def, human, 0, true); put(it, g2.x, g2.y, 0, g2.ang, 20 / it.geo.width, 1, g2.ok ? 1 : 0.5); }
    for (const it of R.inst.values()) { it.main.count = it.n; it.main.instanceMatrix.needsUpdate = true; if (it.main.instanceColor) it.main.instanceColor.needsUpdate = true; if (it.em) { it.em.count = it.n; it.em.instanceMatrix.needsUpdate = true; if (it.em.instanceColor) it.em.instanceColor.needsUpdate = true; } }
    selRings.count = nSel; selRings.instanceMatrix.needsUpdate = true; rangeRings.count = nRange; rangeRings.instanceMatrix.needsUpdate = true; shells.count = nShell; shells.instanceMatrix.needsUpdate = true;
    for (let i = nBul * 6; i < BL * 6; i++) blPos[i] = -9999; blGeo.attributes.position.needsUpdate = true; blGeo.setDrawRange(0, nBul * 2);
    // luzes pontuais: as mais próximas da câmera, à noite
    emitters.sort((a, b) => a.d - b.d); for (let i = 0; i < lightPool.length; i++) { const l = lightPool[i]; const em = emitters[i]; if (em && nt > 0.1) { l.position.set(em.x, H(em.x, em.y) + em.z, -em.y); l.color.set(em.col); l.intensity = 700 * nt; } else l.intensity = 0; }
    // tempestade
    const st = sim.storm; if (st && st.phase === 'active') { stormDisc.visible = true; stormDisc.position.set(st.x, H(st.x, st.y) + 2, -st.y); stormDisc.scale.set(st.r, 1, st.r); for (let i = 0; i < 8 * R.quality.particles; i++) { const a = Math.random() * TAU, rr = Math.sqrt(Math.random()) * st.r; snow(st.x + Math.cos(a) * rr, st.y + Math.sin(a) * rr); } if (Math.random() < 0.012) lightning = 1; } else stormDisc.visible = false;
    if (R.poolMat) R.poolMat.uniforms.uTime.value = R.time; for (const pl of R.poolLights) pl.intensity = 120 * nt + 20;
    for (const sp of R.mist) { const u = sp.userData; if (u.kind === 'rift') { const zz = u.z + Math.sin(R.time * 0.3 + u.ph) * 8; sp.position.set(u.x + Math.sin(R.time * 0.2 + u.ph) * 20, H(u.x, u.y) + zz, -u.y); sp.scale.set(u.s, u.s * 0.7, 1); sp.material.opacity = 0.16 + 0.1 * nt; } else { if (st && st.phase === 'active') { sp.visible = true; const a = u.ox * TAU + R.time * 0.05, rr = u.oy * st.r * 0.9; const px = st.x + Math.cos(a) * rr, py = st.y + Math.sin(a) * rr; sp.position.set(px, H(px, py) + u.z, -py); sp.scale.set(u.s, u.s * 0.6, 1); } else sp.visible = false; } }
    if (composer) { composer.render(); } else renderer.render(scene, camera);
    drawOverlay(sim, view, hpList, me);
    drawMinimap(sim, view);
  };
  function ring(n, x, y, r) { if (n >= 256) return n; _p.set(x, H(x, y) + 0.7, -y); _s.set(r, 1, r); _q.identity(); _m.compose(_p, _q, _s); selRings.setMatrixAt(n, _m); return n + 1; }
  function drawOverlay(sim, view, hpList, me) {
    const c = octx; c.setTransform(R.dpr, 0, 0, R.dpr, 0, 0); c.clearRect(0, 0, R.w, R.h); const cam = view.cam; const z = Math.max(0.6, cam.zoom);
    for (const h of hpList) { const p = R.worldToScreen(cam, h.x, h.y, h.z); if (p[0] < -40 || p[0] > R.w + 40 || p[1] < -40 || p[1] > R.h + 40) continue; const w = h.w * z; c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(p[0] - w / 2, p[1], w, 3); c.fillStyle = h.frac > 0.5 ? '#7FE3A1' : h.frac > 0.25 ? '#F2C230' : '#FF5E3A'; c.fillRect(p[0] - w / 2, p[1], w * Math.max(0, h.frac), 3); if (h.rank) { c.fillStyle = '#F2C230'; for (let i = 0; i < h.rank; i++) { const cx = p[0] - (h.rank - 1) * 4 + i * 8; c.beginPath(); c.moveTo(cx - 3, p[1] - 3); c.lineTo(cx, p[1] - 7); c.lineTo(cx + 3, p[1] - 3); c.lineTo(cx, p[1] - 4.5); c.closePath(); c.fill(); } } if (h.cloak) { const g = R.worldToScreen(cam, h.x, h.y, 0); c.strokeStyle = 'rgba(255,255,255,0.4)'; c.setLineDash([2, 3]); c.lineWidth = 1; c.beginPath(); c.ellipse(g[0], g[1], (h.r + 4) * z * 1.2, (h.r + 4) * z * 0.7, 0, 0, TAU); c.stroke(); c.setLineDash([]); } }
    for (const r of R.fx.rings) { const kk = r.t / r.life; const rr = (r.r0 + (r.r1 - r.r0) * kk) * z * 1.2; const p = R.worldToScreen(cam, r.x, r.y, 0); c.strokeStyle = rgba(r.col, (1 - kk) * (r.ping ? 0.9 : 0.6)); c.lineWidth = r.ping ? 3 : 2; c.beginPath(); c.ellipse(p[0], p[1], rr, rr * 0.6, 0, 0, TAU); c.stroke(); }
    for (const f of R.fx.floats) { const kk = f.t / f.life; const p = R.worldToScreen(cam, f.x, f.y, 14); c.fillStyle = rgba(f.col, 1 - kk); c.font = 'bold 13px IBM Plex Mono, monospace'; c.textAlign = 'center'; c.fillText(f.text, p[0], p[1] - kk * 30); }
    if (view.marker) { const m = view.marker; const kk = Math.min(1, (R.time - m.t) / 0.6); if (kk < 1) { const p = R.worldToScreen(cam, m.x, m.y, 0); c.strokeStyle = rgba(m.col, 1 - kk); c.lineWidth = 2; c.beginPath(); c.ellipse(p[0], p[1], (6 + 26 * (1 - kk)) * z, (6 + 26 * (1 - kk)) * z * 0.6, 0, 0, TAU); c.stroke(); } }
    if (view.box) { const b = view.box; c.strokeStyle = 'rgba(255,255,255,0.8)'; c.fillStyle = 'rgba(255,255,255,0.08)'; c.lineWidth = 1; c.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0); c.strokeRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0); }
    const reg = me.energy.regime; if (reg !== 'pleno') { const col = reg === 'colapso' ? '255,94,58' : '242,194,48'; const a = reg === 'colapso' ? 0.25 + 0.15 * Math.sin(R.time * 5) : 0.15; const g = c.createRadialGradient(R.w / 2, R.h / 2, Math.min(R.w, R.h) * 0.35, R.w / 2, R.h / 2, Math.max(R.w, R.h) * 0.75); g.addColorStop(0, `rgba(${col},0)`); g.addColorStop(1, `rgba(${col},${a})`); c.fillStyle = g; c.fillRect(0, 0, R.w, R.h); }
    if (me.blackoutT > 0) { c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(0, 0, R.w, R.h); }
  }
  function drawMinimap(sim, view) {
    const c = mctx; const size = mini.width; const human = view.human; const vis = view.reveal ? { has: () => true } : sim.vis[human]; const m = miniM(); const ex = sim.explored[human]; const M = (x, y) => R.worldToMini(x, y);
    const dia = (ctx2, px, py, hw, hh) => { ctx2.beginPath(); ctx2.moveTo(px, py - hh); ctx2.lineTo(px + hw, py); ctx2.lineTo(px, py + hh); ctx2.lineTo(px - hw, py); ctx2.closePath(); };
    c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = '#0B0D11'; c.fillRect(0, 0, size, size);
    if (!R.miniBase || R.miniBase.width !== size) { const mb = document.createElement('canvas'); mb.width = size; mb.height = size; const bc = mb.getContext('2d'); const tm = TILE * m; for (let ty = 0; ty < TILES; ty++) for (let tx = 0; tx < TILES; tx++) { const d = Math.hypot((tx + 0.5) * TILE - S.CX, (ty + 0.5) * TILE - S.CY); if (d < S.RIFT_R + 24) continue; const p = M((tx + 0.5) * TILE, (ty + 0.5) * TILE); bc.fillStyle = BIOME_MINI[S.BIOMES[sim.biome[ty * TILES + tx]]] || '#15181F'; dia(bc, p[0], p[1], tm + 0.6, tm * 0.5 + 0.6); bc.fill(); } for (const e of sim.ents) if (e.alive && e.kind === 'rock') { const p = M(e.x, e.y); bc.fillStyle = '#8A9098'; bc.fillRect(p[0] - 1, p[1] - 1, 2, 2); } R.miniBase = mb; }
    c.drawImage(R.miniBase, 0, 0);
    { const p = M(S.CX, S.CY); c.fillStyle = 'rgba(255,94,58,0.35)'; c.beginPath(); c.ellipse(p[0], p[1], S.RIFT_R * 2 * m, S.RIFT_R * m, 0, 0, TAU); c.fill(); c.fillStyle = '#05040A'; c.beginPath(); c.ellipse(p[0], p[1], S.RIFT_R * m, S.RIFT_R * m * 0.5, 0, 0, TAU); c.fill(); }
    for (const e of sim.ents) { if (!e.alive) continue; if (e.kind === 'node') { const p = M(e.x, e.y); c.fillStyle = NODE_COLOR[e.res]; c.fillRect(p[0] - 1.5, p[1] - 1.5, 3, 3); continue; } if (e.kind !== 'unit' && e.kind !== 'building') continue; const own = e.owner === human; if (!(own || vis.has(e.id))) continue; const col = sim.players[e.owner].color; const p = M(e.x, e.y); if (e.kind === 'building') { const t = S.BUILDINGS[e.def].territory; if (t && e.built) { c.fillStyle = rgba(col, 0.1); c.beginPath(); c.ellipse(p[0], p[1], t * m, t * m * 0.5, 0, 0, TAU); c.fill(); } c.fillStyle = col; const r = e.def === 'nucleo' ? 4 : S.BUILDINGS[e.def].wall ? 1.5 : 2.5; c.fillRect(p[0] - r, p[1] - r, r * 2, r * 2); } else { c.fillStyle = col; c.fillRect(p[0] - 1, p[1] - 1, 2, 2); } }
    for (const [id, mm] of view.memory) if (!vis.has(id)) { const p = M(mm.x, mm.y); c.fillStyle = rgba(sim.players[mm.owner].color, 0.5); c.fillRect(p[0] - 2, p[1] - 2, 4, 4); }
    if (sim.storm) { const p = M(sim.storm.x, sim.storm.y); c.strokeStyle = sim.storm.phase === 'active' ? 'rgba(178,60,255,0.9)' : `rgba(178,60,255,${0.4 + 0.4 * Math.sin(R.time * 6)})`; c.lineWidth = 1.5; c.beginPath(); c.ellipse(p[0], p[1], sim.storm.r * m, sim.storm.r * m * 0.5, 0, 0, TAU); c.stroke(); }
    mfctx.setTransform(1, 0, 0, 1, 0, 0); mfctx.globalCompositeOperation = 'source-over'; mfctx.clearRect(0, 0, size, size); mfctx.fillStyle = 'rgba(6,8,12,0.72)'; dia(mfctx, size / 2, size / 2, size / 2, size / 4); mfctx.fill();
    if (!view.reveal) { mfctx.fillStyle = 'rgba(2,3,6,0.8)'; const tm = TILE * m; for (let ty = 0; ty < TILES; ty++) for (let tx = 0; tx < TILES; tx++) { if (ex[ty * TILES + tx]) continue; const p = M((tx + 0.5) * TILE, (ty + 0.5) * TILE); dia(mfctx, p[0], p[1], tm + 0.5, tm * 0.5 + 0.5); mfctx.fill(); } }
    mfctx.globalCompositeOperation = 'destination-out'; for (const e of sim.ents) { if (!e.alive || e.owner !== human || (e.kind !== 'unit' && e.kind !== 'building')) continue; const r = S.sensorRadius(sim, e) * m; const p = M(e.x, e.y); mfctx.beginPath(); mfctx.ellipse(p[0], p[1], r, r * 0.5, 0, 0, TAU); mfctx.fill(); }
    c.drawImage(mfog, 0, 0);
    for (const r of R.fx.rings) if (r.ping) { const kk = r.t / r.life; const p = M(r.x, r.y); c.strokeStyle = rgba(r.col, 1 - kk); c.lineWidth = 1.5; c.beginPath(); c.arc(p[0], p[1], 3 + 10 * kk, 0, TAU); c.stroke(); }
    const cam = view.cam; const cs = [R.screenToWorld(cam, 0, 0), R.screenToWorld(cam, R.w, 0), R.screenToWorld(cam, R.w, R.h), R.screenToWorld(cam, 0, R.h)].map(p => M(p[0], p[1]));
    c.strokeStyle = 'rgba(255,255,255,0.75)'; c.lineWidth = 1; c.beginPath(); cs.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath(); c.stroke();
  }
  return R;
}
ARD.render3d = { create, NODE_COLOR };
})(globalThis.ARD = globalThis.ARD || {});
