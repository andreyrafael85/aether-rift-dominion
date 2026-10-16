/* Aether Rift: Dominion — mundo vestido (4.2d).
   Adereços pequenos espalhados por bioma (cristais de gelo, seixos, tufos de capim, respiros de lava), instanciados e
   determinísticos pela semente do mapa, escurecidos pela névoa de guerra como o terreno, com vento nos tufos; e estradas de
   terra ligando cada Núcleo às próprias estruturas. Só visual: a simulação não muda. */
(function (ARD) {
'use strict';
const S = ARD.sim;
// tipos por bioma: [nome, quantidade relativa]
const BY_BIOME = { gelo: [['shard', 1.1], ['stone', 0.35]], rocha: [['pebble', 0.9], ['boulder', 0.3]], tundra: [['tuft', 2.2], ['shrub', 0.6], ['pebble', 0.3]], basalto: [['vent', 0.35], ['ash', 0.8]] };
function create(THREE, scene, opts) {
  opts = opts || {}; const D = { meshes: [], uTime: { value: 0 }, sig: '', roadSig: '' };
  const uni = { fogMap: { value: opts.fogTex }, worldSize: { value: S.WORLD }, uTime: D.uTime };
  // materiais com névoa de guerra (mesmo critério do terreno) e vento opcional
  function mat(params, o) {
    const m = new THREE.MeshStandardMaterial(params); o = o || {};
    m.onBeforeCompile = sh => { Object.assign(sh.uniforms, uni);
      sh.vertexShader = 'uniform float worldSize; uniform float uTime; varying vec2 vDWuv;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n' + (o.wind ? '{ vec4 iw = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0); float k = max(0.0, position.y); transformed.x += sin(uTime * 1.7 + iw.x * 0.05 + iw.z * 0.03) * 0.09 * k; transformed.z += cos(uTime * 1.3 + iw.z * 0.05) * 0.06 * k; }\n' : ''))
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n{ vec4 wp = modelMatrix * instanceMatrix * vec4(transformed, 1.0); vDWuv = vec2(wp.x / worldSize, -wp.z / worldSize); }');
      sh.fragmentShader = 'uniform sampler2D fogMap; varying vec2 vDWuv;\n' + sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\nfloat dFog = texture2D(fogMap, vDWuv).r; diffuseColor.rgb *= mix(0.06, 1.0, dFog);').replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance *= dFog * dFog;');
    };
    m.customProgramCacheKey = () => 'ard-dress-' + (o.wind ? 'w' : 'n') + (params.emissive ? 'e' : ''); return m;
  }
  const g = {
    shard: new THREE.OctahedronGeometry(1, 0).scale(0.45, 1.6, 0.45).translate(0, 1.1, 0),
    stone: new THREE.IcosahedronGeometry(1, 0).scale(1, 0.6, 0.9).translate(0, 0.3, 0),
    pebble: new THREE.IcosahedronGeometry(1, 0).scale(1, 0.55, 0.85).translate(0, 0.25, 0),
    boulder: new THREE.IcosahedronGeometry(1, 1).scale(1.1, 0.8, 1).translate(0, 0.45, 0),
    tuft: (() => { const parts = []; for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; const c = new THREE.ConeGeometry(0.12, 1.4 + (i % 3) * 0.3, 4).translate(0, 0.7, 0); c.rotateZ(0.35 * Math.cos(a)); c.rotateX(0.35 * Math.sin(a)); c.translate(Math.cos(a) * 0.25, 0, Math.sin(a) * 0.25); parts.push(c.index ? c.toNonIndexed() : c); } return merge(THREE, parts); })(),
    shrub: (() => { const parts = []; for (let i = 0; i < 4; i++) { const s = new THREE.IcosahedronGeometry(0.55 + (i % 2) * 0.2, 0).translate(Math.cos(i * 1.7) * 0.5, 0.55 + (i % 2) * 0.25, Math.sin(i * 1.7) * 0.5); parts.push(s.index ? s.toNonIndexed() : s); } return merge(THREE, parts); })(),
    vent: new THREE.IcosahedronGeometry(1, 0).scale(1.3, 0.35, 1.1).translate(0, 0.15, 0),
    ash: new THREE.IcosahedronGeometry(1, 0).scale(0.9, 0.4, 0.8).translate(0, 0.18, 0),
  };
  for (const k in g) g[k].computeVertexNormals();
  const mats = {
    shard: mat({ color: 0xdfe6ec, roughness: 0.3, metalness: 0.05, flatShading: true }), // 4.2h: gelo fosco sem brilho (azul aceso é só do Minério)
    stone: mat({ color: 0xa8a29a, roughness: 0.85, flatShading: true }),
    pebble: mat({ color: 0x7b756d, roughness: 0.95, flatShading: true }),
    boulder: mat({ color: 0x6b645c, roughness: 0.95, flatShading: true }),
    tuft: mat({ color: 0x7d8f4f, roughness: 0.85, side: THREE.DoubleSide }, { wind: true }),
    shrub: mat({ color: 0x4f6a3d, roughness: 0.9, flatShading: true }, { wind: true }),
    vent: mat({ color: 0x241f20, roughness: 0.9, emissive: 0x3a0d06, emissiveIntensity: 0.2, flatShading: true }), // brasa discreta: rocha escura que mal brilha
    ash: mat({ color: 0x3a3537, roughness: 0.95, flatShading: true }),
  };
  D.mats = mats; // 4.2h: o render3d põe estes materiais na curva da noite
  const SIZE = { shard: [3, 7], stone: [2.5, 5], pebble: [1.6, 3.8], boulder: [6, 11], tuft: [3, 6], shrub: [3, 6], vent: [4, 8], ash: [1.8, 3.4] };
  const COLJ = { shard: 0.12, stone: 0.08, pebble: 0.14, boulder: 0.1, tuft: 0.22, shrub: 0.18, vent: 0.1, ash: 0.1 };
  // posições determinísticas por tile
  function hash(a, b, c) { let n = (a * 374761393 + b * 668265263 + c * 1274126177) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); n ^= n >>> 16; return (n >>> 0) / 4294967296; }
  D.build = function (sim, H, density) {
    for (const m of D.meshes) { scene.remove(m.mesh); m.mesh.dispose(); } D.meshes = []; if (!density) return;
    const lists = {}; const TILE = 64, TILES = S.WORLD / TILE; const seed = sim.seed;
    const blockers = sim.ents.filter(e => e.alive && (e.kind === 'node' || e.kind === 'rock')).map(e => ({ x: e.x, y: e.y, r: e.r + (e.kind === 'node' ? 30 : 10) })); // 4.2h: chão limpo em volta dos nós
    for (const p of sim.players) { const n = S.nucleoOf(sim, p.id); if (n) blockers.push({ x: n.x, y: n.y, r: 110 }); }
    for (let ty = 0; ty < TILES; ty++) for (let tx = 0; tx < TILES; tx++) {
      const ti = ty * TILES + tx; const b1 = S.BIOMES[sim.biome[ti]], b2 = S.BIOMES[sim.biome2[ti]]; const mix = sim.biomeMix[ti];
      for (let j = 0; j < 8; j++) { const r0 = hash(tx, ty, seed + j * 31); const biome = r0 < mix ? b2 : b1; const kinds = BY_BIOME[biome]; if (!kinds) continue;
        const kk = kinds[(hash(tx, ty, seed + j * 17 + 5) * kinds.length) | 0]; if (hash(tx, ty, seed + j * 7 + 3) > kk[1] * density * 0.22) continue;
        const x = (tx + hash(tx, ty, seed + j * 11 + 1)) * TILE, y = (ty + hash(tx, ty, seed + j * 13 + 2)) * TILE;
        if (Math.hypot(x - S.CX, y - S.CY) < S.RIFT_R + 70) continue; if (blockers.some(o => Math.hypot(x - o.x, y - o.y) < o.r)) continue;
        (lists[kk[0]] = lists[kk[0]] || []).push({ x, y, s: hash(tx, ty, seed + j * 19 + 4), a: hash(tx, ty, seed + j * 23 + 6) * Math.PI * 2, c: hash(tx, ty, seed + j * 29 + 8) });
      }
    }
    const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0), _c = new THREE.Color();
    for (const k in lists) { const L = lists[k]; const im = new THREE.InstancedMesh(g[k], mats[k], L.length); im.frustumCulled = false; im.receiveShadow = true; im.castShadow = false;
      const [s0, s1] = SIZE[k]; L.forEach((o, i) => { const sc = s0 + (s1 - s0) * o.s; _p.set(o.x, H(o.x, o.y) - 0.2, -o.y); _q.setFromAxisAngle(UP, o.a); _s.set(sc, sc * (0.8 + 0.4 * o.s), sc); _m.compose(_p, _q, _s); im.setMatrixAt(i, _m); _c.setScalar(1 - COLJ[k] + 2 * COLJ[k] * o.c); im.setColorAt(i, _c); });
      im.userData = { kind: k, list: L, s0, s1 }; scene.add(im); D.meshes.push({ mesh: im, kind: k, list: L }); }
    D.sig = '';
  };
  // esconde adereços que ficaram debaixo de estruturas (chamado quando o conjunto de estruturas muda)
  D.hideUnder = function (sim, H) {
    const bs = sim.ents.filter(e => e.alive && e.kind === 'building'); const sig = bs.length + ':' + (bs.length ? bs[bs.length - 1].id : 0); if (sig === D.sig) return; D.sig = sig;
    const cell = 128, grid = new Map(); for (const b of bs) { const k = ((b.x / cell) | 0) + ',' + ((b.y / cell) | 0); (grid.get(k) || grid.set(k, []).get(k)).push(b); }
    const _m = new THREE.Matrix4(); const Z = new THREE.Matrix4().makeScale(0, 0, 0); const _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
    for (const m of D.meshes) { const im = m.mesh, { s0, s1 } = im.userData; let changed = false;
      m.list.forEach((o, i) => { let hide = false; const cx = (o.x / cell) | 0, cy = (o.y / cell) | 0; for (let dy = -1; dy <= 1 && !hide; dy++) for (let dx = -1; dx <= 1 && !hide; dx++) { const L = grid.get((cx + dx) + ',' + (cy + dy)); if (L) for (const b of L) if (Math.hypot(o.x - b.x, o.y - b.y) < b.r + 6) { hide = true; break; } }
        if (hide !== !!o.hid) { o.hid = hide; changed = true; if (hide) im.setMatrixAt(i, Z); else { const sc = s0 + (s1 - s0) * o.s; _p.set(o.x, H(o.x, o.y) - 0.2, -o.y); _q.setFromAxisAngle(UP, o.a); _s.set(sc, sc * (0.8 + 0.4 * o.s), sc); _m.compose(_p, _q, _s); im.setMatrixAt(i, _m); } } });
      if (changed) im.instanceMatrix.needsUpdate = true; }
  };
  // estradas de terra: do Núcleo até cada estrutura pronta dentro do território (pedaços curtos que acompanham o relevo)
  const roadGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const roadMat = new THREE.ShaderMaterial({ uniforms: { fogMap: uni.fogMap, worldSize: uni.worldSize }, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2,
    vertexShader: 'uniform float worldSize; varying vec2 vUv; varying vec2 vW; void main(){ vUv = uv; vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0); vW = vec2(wp.x / worldSize, -wp.z / worldSize); gl_Position = projectionMatrix * viewMatrix * wp; }',
    fragmentShader: 'uniform sampler2D fogMap; varying vec2 vUv; varying vec2 vW; float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); } float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); } void main(){ float side = abs(vUv.x - 0.5) * 2.0; float nz = n(vW * 900.0); float edge = 1.0 - smoothstep(0.55 + nz * 0.25, 1.0, side); float rut = smoothstep(0.08, 0.0, abs(side - 0.45)) * 0.18; vec3 col = mix(vec3(0.33, 0.29, 0.24), vec3(0.42, 0.37, 0.3), nz) * (1.0 - rut); float fl = texture2D(fogMap, vW).r; gl_FragColor = vec4(col * mix(0.06, 1.0, fl), edge * 0.62); }' });
  const roads = new THREE.InstancedMesh(roadGeo, roadMat, 2048); roads.count = 0; roads.frustumCulled = false; roads.renderOrder = 2; scene.add(roads); D.roads = roads;
  D.updateRoads = function (sim, H, vis) {
    const bs = sim.ents.filter(e => e.alive && e.kind === 'building' && e.built && e.def !== 'muro' && e.def !== 'portao' && e.def !== 'nucleo');
    const sig = bs.length + ':' + bs.reduce((s, b) => (s + b.id * 7) % 1000003, 0); if (sig === D.roadSig) return; D.roadSig = sig;
    const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0); let n = 0;
    for (const p of sim.players) { const nu = S.nucleoOf(sim, p.id); if (!nu) continue; const terr = S.territoryOf(sim, nu);
      for (const b of bs) { if (b.owner !== p.id) continue; const d = Math.hypot(b.x - nu.x, b.y - nu.y); if (d > terr || d < nu.r + b.r + 8) continue;
        const ang = Math.atan2(b.y - nu.y, b.x - nu.x); const x0 = nu.x + Math.cos(ang) * (nu.r + 4), y0 = nu.y + Math.sin(ang) * (nu.r + 4), x1 = b.x - Math.cos(ang) * (b.r + 2), y1 = b.y - Math.sin(ang) * (b.r + 2); const L = Math.hypot(x1 - x0, y1 - y0); const pieces = Math.max(1, Math.ceil(L / 36));
        for (let i = 0; i < pieces && n < 2048; i++) { const f = (i + 0.5) / pieces; const px = x0 + (x1 - x0) * f, py = y0 + (y1 - y0) * f; _p.set(px, H(px, py) + 0.35, -py); _q.setFromAxisAngle(UP, ang + Math.PI / 2); _s.set(11, 1, L / pieces + 2); _m.compose(_p, _q, _s); roads.setMatrixAt(n++, _m); } } }
    roads.count = n; roads.instanceMatrix.needsUpdate = true;
  };
  D.update = function (time) { D.uTime.value = time; };
  return D;
}
function merge(THREE, parts) { let n = 0; for (const p of parts) n += p.attributes.position.count; const pos = new Float32Array(n * 3); let k = 0; for (const p of parts) { pos.set(p.attributes.position.array, k * 3); k += p.attributes.position.count; } const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); return g; }
ARD.dress3d = { create };
})(globalThis.ARD = globalThis.ARD || {});
