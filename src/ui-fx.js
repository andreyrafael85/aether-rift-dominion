/* Aether Rift: Dominion — fundo vivo da tela inicial (4.3k): "O Grande Alinhamento". Os cinco mundos natais em fila diante
   da Fenda aberta, sobre a nebulosa do Cinturão (a mesma da partida, world3d.spaceBackdrop), com asteroides e poeira na
   frente. O mundo da Raça escolhida vem para a frente, atrás do líder; trocar de Raça desloca a fila. Cena WebGL leve:
   ~17 chamadas de desenho, sem pós-processamento, até 30 quadros por segundo e resolução limitada a 1920 de largura.
   Versão leve (celular, ?logo=estatico, prefers-reduced-motion, GPU por software): desenha um quadro e para; ao trocar
   de Raça refaz a cena (com uma transição curta só quando há movimento). stop() libera tudo antes da partida.
   4.3l — alta definição: antialias, densidade real da tela (até 2x, teto de ~8,3 milhões de pixels; a versão viva
   cai um degrau sozinha se os quadros ficarem lentos), nebulosa assada em 1024 por face (768 na versão parada),
   planetas com textura de 1024 px no mundo em destaque e 512 nos outros, com relevo, geradas em fatias no tempo
   ocioso, e pontilhado no céu contra as faixas de cor do degradê escuro. */
(function (ARD) {
'use strict';
const RACES = ['vehnar', 'erevane', 'tessara', 'quorith', 'vorag'];
let st = null;
const qs = () => new URLSearchParams(location.search);
const reduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
const coarse = () => { try { return matchMedia('(pointer: coarse)').matches; } catch (e) { return false; } };
const idle = (f, t) => (window.requestIdleCallback ? requestIdleCallback(f, { timeout: t || 300 }) : setTimeout(f, 16));
const ease = x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

const SKY_VS = 'varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }';
const SKY_FS = `uniform samplerCube uNeb; uniform float uExp; uniform float uTime; uniform vec3 uTint; uniform vec3 uRift; uniform float uHasNeb; varying vec3 vDir;
float h31(vec3 p){ p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float stars(vec3 d, float s, float th){ vec3 q = d * s; vec3 c = floor(q); float r = h31(c); if (r < th) return 0.0; vec3 o = vec3(h31(c + 7.1), h31(c + 3.3), h31(c + 9.9)) * 0.6 + 0.2; float l = length(fract(q) - o); float tw = 0.65 + 0.35 * sin(uTime * (1.0 + r * 3.0) + r * 60.0); return smoothstep(0.11, 0.0, l) * (r - th) / (1.0 - th) * tw; }
void main(){ vec3 d = normalize(vDir);
  vec3 col = uHasNeb > 0.5 ? textureCube(uNeb, d).rgb * uExp : vec3(0.004, 0.006, 0.014);
  float s = stars(d, 160.0, 0.975) * 1.6 + stars(d, 330.0, 0.986) * 1.1 + stars(d, 640.0, 0.992) * 0.7;
  col += vec3(0.85, 0.9, 1.0) * s;
  float g = max(dot(d, normalize(uRift)), 0.0);
  col += mix(vec3(0.7, 0.2, 0.55), uTint, 0.55) * pow(g, 34.0) * 0.12 + vec3(1.0, 0.5, 0.3) * pow(g, 220.0) * 0.25;
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  gl_FragColor.rgb += (h31(vec3(gl_FragCoord.xy, 7.0)) - 0.5) / 255.0; /* 4.3l: pontilhado contra faixas no degradê escuro */
}`;
/* a Fenda: rasgo vertical com núcleo branco, borda laranja e halo violeta, serrilhado por ruído que corre devagar */
const RIFT_VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
const RIFT_FS = `uniform float uTime; uniform vec3 uTint; varying vec2 vUv;
float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float n1(float x){ float i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(h21(vec2(i, 1.3)), h21(vec2(i + 1.0, 1.3)), f); }
float fb(float x){ return n1(x) * 0.55 + n1(x * 2.3 + 4.1) * 0.3 + n1(x * 5.1 + 9.7) * 0.15; }
void main(){ float y = vUv.y; float t = uTime * 0.18;
  float off = (fb(y * 7.0 + t) - 0.5) * 0.16 + (fb(y * 23.0 - t * 2.0) - 0.5) * 0.05;
  float taper = smoothstep(0.0, 0.22, y) * smoothstep(1.0, 0.7, y);
  float w = 0.012 + 0.03 * taper * (0.6 + 0.4 * fb(y * 3.0 + 2.0));
  float x = abs(vUv.x - 0.5 - off);
  float core = smoothstep(w, 0.0, x) * taper;
  float halo = exp(-x * x / (0.02 + 0.05 * taper)) * taper;
  vec3 col = vec3(1.0, 0.94, 0.86) * core * 2.4 + vec3(1.0, 0.37, 0.2) * smoothstep(w * 4.0, 0.0, x) * taper * 1.1 + mix(vec3(0.7, 0.24, 1.0), uTint, 0.3) * halo * 0.55;
  float a = clamp(max(core, halo * 0.8), 0.0, 1.0);
  gl_FragColor = vec4(col, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
const ATMO_VS = 'varying vec3 vN; varying vec3 vV; void main(){ vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }';
const ATMO_FS = `uniform vec3 col; uniform float it; varying vec3 vN; varying vec3 vV; void main(){ float d = abs(dot(normalize(vN), normalize(vV))); float f = pow(max(1.0 - d, 0.0), 2.6) * it; gl_FragColor = vec4(col * f, f);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
function softwareGL(renderer) { try { const gl = renderer.getContext(); const ext = gl.getExtension('WEBGL_debug_renderer_info'); const n = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)); return /swiftshader|llvmpipe|software|softpipe/i.test(n); } catch (e) { return false; } }

function mount(host, race) {
  const THREE = window.THREE, W3 = ARD.world3d; const q = qs();
  if (st || !THREE || !W3 || !host || host.hidden) return false;
  if (q.get('fundo') === 'off') return false;
  let renderer = null;
  try {
    const cv = document.createElement('canvas'); cv.id = 'ui-bg'; cv.setAttribute('aria-hidden', 'true');
    renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: false, powerPreference: 'low-power', stencil: false }); /* 4.3l: com antialias (bordas dos planetas e dos anéis) */
    renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
    const live = q.get('fundo') === 'vivo' || (!coarse() && !reduced() && q.get('logo') !== 'estatico' && !softwareGL(renderer));
    const scene = new THREE.Scene(); const cam = new THREE.PerspectiveCamera(36, 1, 0.1, 600);
    const tint = new THREE.Color(0xff7733), RIFT = new THREE.Vector3(0.15, 0.12, -1).normalize();
    /* céu: nebulosa do Cinturão (cubemap assado uma vez na GPU) + estrelas analíticas + brilho da Fenda */
    const skyU = { uNeb: { value: null }, uHasNeb: { value: 0 }, uExp: { value: 7.5 }, uTime: { value: 0 }, uTint: { value: tint }, uRift: { value: RIFT } };
    const sky = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), new THREE.ShaderMaterial({ uniforms: skyU, vertexShader: SKY_VS, fragmentShader: SKY_FS, side: THREE.BackSide, depthWrite: false, depthTest: false }));
    sky.frustumCulled = false; sky.renderOrder = -10; scene.add(sky);
    /* a Fenda ao fundo */
    const riftU = { uTime: { value: 0 }, uTint: { value: tint } };
    const rift = new THREE.Mesh(new THREE.PlaneGeometry(26, 120), new THREE.ShaderMaterial({ uniforms: riftU, vertexShader: RIFT_VS, fragmentShader: RIFT_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    rift.renderOrder = -5; cam.add(rift); scene.add(cam);
    /* luzes: a Fenda por trás (contorno quente), a chave fria de cima e o contorno da Raça por baixo */
    const amb = new THREE.AmbientLight(0x1a2234, 0.55); scene.add(amb);
    const key = new THREE.DirectionalLight(0xdfe8ff, 2.1); key.position.set(-6, 5, 4); scene.add(key);
    const back = new THREE.DirectionalLight(0xff8a5c, 2.6); back.position.copy(RIFT).multiplyScalar(10); scene.add(back);
    const rim = new THREE.DirectionalLight(0xff7733, 1.6); rim.position.set(3, -4, 2); scene.add(rim);
    /* os cinco mundos (as posições vêm das vagas calculadas em layout()) */
    const ring = new THREE.Group(); scene.add(ring);
    const flatBump = new THREE.DataTexture(new Uint8Array([128, 128, 128, 255]), 1, 1); flatBump.needsUpdate = true; /* 4.3l: relevo neutro até a textura chegar */
    const flatMap = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1); flatMap.colorSpace = THREE.SRGBColorSpace; flatMap.needsUpdate = true; /* 4.3l: cor lisa até a textura chegar (o shader já nasce com mapa e não recompila) */
    const planets = RACES.map((rid, i) => { const P = W3.PLANETS[rid]; const g = new THREE.Group(); ring.add(g);
      const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(P.pl[2]), roughness: 0.92, metalness: 0, emissive: new THREE.Color(P.pl[1]), emissiveIntensity: 0.12, map: flatMap, emissiveMap: flatMap, bumpMap: flatBump, bumpScale: BUMP_K }); /* 4.3l: mapa e relevo desde o início (o shader compila uma vez só) */
      const sph = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), mat); sph.rotation.z = 0.35 + i * 0.4; g.add(sph);
      const atU = { col: { value: new THREE.Color(P.atmo) }, it: { value: 1.25 } };
      const at = new THREE.Mesh(new THREE.SphereGeometry(1.09, 48, 32), new THREE.ShaderMaterial({ uniforms: atU, vertexShader: ATMO_VS, fragmentShader: ATMO_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.BackSide })); g.add(at);
      if (P.bands) { const rg = new THREE.Mesh(new THREE.RingGeometry(1.45, 2.05, 96, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color(P.pl[3]), transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false })); rg.rotation.x = 1.25; rg.rotation.y = 0.2; g.add(rg); }
      return { rid, g, sph, mat, atU, base: 1, idx: i, texW: 0, busy: 0 }; });
    /* asteroides do Cinturão na frente (três formas, instanciadas) e poeira na cor da Raça */
    const rocks = []; const rmat = new THREE.MeshStandardMaterial({ color: 0x3d3833, roughness: 1, metalness: 0, flatShading: true });
    let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let k = 0; k < 3; k++) { const geo = new THREE.IcosahedronGeometry(1, 1); const p = geo.attributes.position; for (let i = 0; i < p.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(p, i); const n = 0.72 + 0.5 * rnd(); p.setXYZ(i, v.x * n * (1 + 0.3 * k), v.y * n, v.z * n * (1.15 - 0.15 * k)); } geo.computeVertexNormals();
      const N = 46; const im = new THREE.InstancedMesh(geo, rmat, N); const data = [];
      for (let i = 0; i < N; i++) { const z = -7 - rnd() * 26; const x = (rnd() * 2 - 1) * (10 + -z * 0.9); const y = -2.6 - rnd() * 4.5 + (-z) * 0.05 * (rnd() - 0.3); data.push({ x, y, z, s: 0.06 + rnd() * rnd() * 0.75, rx: rnd() * 6, ry: rnd() * 6, w: (rnd() - 0.5) * 0.4, v: 0.08 + rnd() * 0.2 }); }
      scene.add(im); rocks.push({ im, data }); }
    const DN = 520; const dpos = new Float32Array(DN * 3); for (let i = 0; i < DN; i++) { dpos[i * 3] = (rnd() * 2 - 1) * 40; dpos[i * 3 + 1] = (rnd() * 2 - 1) * 22; dpos[i * 3 + 2] = -4 - rnd() * 60; }
    const dgeo = new THREE.BufferGeometry(); dgeo.setAttribute('position', new THREE.BufferAttribute(dpos, 3));
    const dust = new THREE.Points(dgeo, new THREE.PointsMaterial({ color: tint, size: 0.07, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending })); scene.add(dust);
    host.insertBefore(cv, host.children[1] || null);
    st = { tmp: { M: new THREE.Matrix4(), Q: new THREE.Quaternion(), E: new THREE.Euler(), V: new THREE.Vector3(), SV: new THREE.Vector3() }, THREE, renderer, scene, cam, cv, host, live, planets, ring, rocks, dust, rift, sky, skyU, riftU, tint, rim, raf: 0, last: 0, t0: performance.now(), sel: RACES.indexOf(race) < 0 ? 0 : RACES.indexOf(race), ang: 0, angFrom: 0, angTo: 0, animT: 1, mouse: [0, 0], mt: [0, 0], dirty: true, frames: 0, disposables: [flatBump, flatMap], ready: false, prK: 1, slow: 0, forced: q.get('fundo') === 'vivo', aniso: Math.min(8, renderer.capabilities.getMaxAnisotropy ? renderer.capabilities.getMaxAnisotropy() : 1) };
    st.off = st.offFrom = st.offTo = st.sel; st.slots = []; st.RIFT = RIFT;
    setTint(race, true);
    const resize = () => { if (!st) return; const w = innerWidth, h = innerHeight; const pr = Math.max(0.5, Math.min(2, window.devicePixelRatio || 1, Math.sqrt(8.3e6 / Math.max(1, w * h))) * st.prK); /* 4.3l: densidade real da tela até 2x, com teto de pixels (4K) e o degrau da versão viva */ renderer.setPixelRatio(pr); renderer.setSize(w, h, false); cam.aspect = w / h; cam.fov = w < h ? 54 : 36; cam.updateProjectionMatrix(); layout(); st.dirty = true; if (!st.live) kick(); };
    st.resize = resize; addEventListener('resize', resize); resize(); if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (st) resize(); }); /* as fontes mudam a posição do busto e do título */
    st.onMove = ev => { st.mt[0] = (ev.clientX / innerWidth) * 2 - 1; st.mt[1] = (ev.clientY / innerHeight) * 2 - 1; };
    if (live) addEventListener('pointermove', st.onMove, { passive: true });
    st.onVis = () => { if (st && !document.hidden && st.live) loop(); }; document.addEventListener('visibilitychange', st.onVis);
    /* nebulosa assada uma vez (GPU) e texturas dos planetas uma por vez, no tempo ocioso */
    idle(() => { if (!st) return; try { const bd = W3.spaceBackdrop(THREE, renderer, { size: st.live ? 1024 : 768, seed: 3.7, planetR: 0.0001, planetDir: [0.2, -0.9, -0.3] }); /* 4.3l: 1024 por face (era 384) */ skyU.uNeb.value = bd.tex; skyU.uHasNeb.value = 1; st.disposables.push(bd.rt); } catch (e) { console.warn('[ARD] fundo: nebulosa indisponível: ' + e.message); } st.dirty = true; if (!st.live) kick(); }, 200);
    /* 4.3l: o mundo em destaque primeiro; todos em 512 (256 nos pequenos da versão parada) e depois o destaque em 1024 */
    const first = [planets[st.sel]].concat(planets.filter((p, i) => i !== st.sel)); let pi = 0;
    const nextTex = () => { if (!st) return; if (pi >= first.length) { st.ready = true; st.dirty = true; if (!st.live) kick(); hdFeatured(); return; } const p = first[pi++]; planetTex(p, p === planets[st.sel] || st.live ? 512 : 256, nextTex); };
    idle(nextTex, 400);
    if (live) loop(); else { kick(); setTimeout(() => { if (st && !st.ready) { st.dirty = true; kick(); } }, 2500); }
    return true;
  } catch (err) { console.warn('[ARD] fundo vivo indisponível: ' + err.message); try { if (renderer) { renderer.dispose(); renderer.forceContextLoss(); } } catch (e) {} st = null; return false; }
}
/* 4.3l — texturas dos planetas: o mesmo desenho do world3d.planetTexture (mesmo ruído, paleta e semente), com uma oitava a mais
   em 1024, e um mapa de relevo junto. Geradas num Web Worker (fora da linha principal: a página não trava e a vitrine segue
   lisa); sem Worker, em fatias no tempo ocioso (no mínimo 10 ms a cada 60 ms, para andar mesmo com a página ocupada). */
const BUMP_K = 3;
/* cópia fiel do ruído do world3d (hash3, vnoise, fbm): o mesmo padrão sai no Worker (pelo texto destas funções) e na linha principal */
function nzHash(x, y, z) { let n = (x * 374761393 + y * 668265263 + z * 2147483647) | 0; n = (n ^ (n >> 13)) * 1274126177; n = n ^ (n >> 16); return (n & 0x7fffffff) / 0x7fffffff; }
function nzSm(t) { return t * t * (3 - 2 * t); }
function nzValue(x, y, z) { const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z); const fx = nzSm(x - xi), fy = nzSm(y - yi), fz = nzSm(z - zi); const l = (a, b, t) => a + (b - a) * t;
  return l(l(l(nzHash(xi, yi, zi), nzHash(xi + 1, yi, zi), fx), l(nzHash(xi, yi + 1, zi), nzHash(xi + 1, yi + 1, zi), fx), fy), l(l(nzHash(xi, yi, zi + 1), nzHash(xi + 1, yi, zi + 1), fx), l(nzHash(xi, yi + 1, zi + 1), nzHash(xi + 1, yi + 1, zi + 1), fx), fy), fz); }
function nzFbm(x, y, z, oct) { let v = 0, a = 0.5, f = 1, s = 0; for (let i = 0; i < (oct || 5); i++) { v += a * nzValue(x * f, y * f, z * f); s += a; a *= 0.5; f *= 2.1; } return v / s; }
/* linhas y0..y1 da textura (cor em d, relevo em bd) */
function nzRows(o, d, bd, y0, y1) { const W = o.W, H = W / 2, n = o.stops.length - 1, hd = W >= 1024;
  for (let y = y0; y < y1; y++) { const ny = y / H * 4.4; for (let x = 0; x < W; x++) { const u = x / W * Math.PI * 2; const nx = Math.cos(u) * 2.2 + o.seed, nz = Math.sin(u) * 2.2;
    let t = o.bands ? nzFbm(nx * 0.25, ny * 2.6 + nzFbm(nx, ny, nz, hd ? 4 : 3) * 1.2, nz * 0.25, hd ? 5 : 4) : nzFbm(nx, ny, nz, hd ? 6 : 5); t = Math.min(1, Math.max(0, (t - 0.32) * 1.9));
    const k = Math.min(n - 1, Math.max(0, Math.floor(t * n))), f = t * n - k, a = o.stops[k], b = o.stops[k + 1], i = (y * W + x) * 4;
    d[i] = a[0] + (b[0] - a[0]) * f; d[i + 1] = a[1] + (b[1] - a[1]) * f; d[i + 2] = a[2] + (b[2] - a[2]) * f; d[i + 3] = 255; bd[i] = bd[i + 1] = bd[i + 2] = 60 + t * 190; bd[i + 3] = 255; } } }
const WORKER_SRC = [nzHash, nzSm, nzValue, nzFbm, nzRows].map(f => f.toString()).join('\n') + '\nonmessage = e => { const o = e.data, W = o.W, H = W / 2; const d = new Uint8ClampedArray(W * H * 4), bd = new Uint8ClampedArray(W * H * 4); nzRows(o, d, bd, 0, H); postMessage({ id: o.id, d, bd }, [d.buffer, bd.buffer]); };';
function texWorker(s0) { if (s0.worker !== undefined) return s0.worker; s0.worker = null;
  try { if (!window.Worker || !window.Blob || !window.URL) return null; const url = URL.createObjectURL(new Blob([WORKER_SRC], { type: 'text/javascript' }));
    const w = new Worker(url); URL.revokeObjectURL(url); s0.wjobs = {}; s0.wid = 0;
    w.onmessage = e => { const j = s0.wjobs[e.data.id]; delete s0.wjobs[e.data.id]; if (j && st === s0) j(e.data.d, e.data.bd); };
    w.onerror = ev => { /* Worker indisponível (política da página): os pedidos pendentes voltam para a linha principal */ if (ev && ev.preventDefault) ev.preventDefault(); const pend = s0.wjobs || {}; s0.wjobs = {}; try { w.terminate(); } catch (e) {} s0.worker = null; for (const id in pend) pend[id](null, null); };
    s0.worker = w; } catch (e) { s0.worker = null; }
  return s0.worker; }
function planetTex(p, W, done) { const s0 = st; if (!s0) return; if (p.texW >= W || p.busy >= W) { if (done) idle(done, 200); return; } p.busy = W;
  const W3 = ARD.world3d, P = W3.PLANETS[p.rid] || W3.PLANETS.vehnar, H = W / 2;
  const o = { W, seed: 3 + p.idx * 2.7, bands: !!P.bands, stops: P.pl.map(c => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]) };
  const apply = (dd, bb) => { if (st !== s0) return; const THREE = s0.THREE;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; cv.getContext('2d').putImageData(new ImageData(dd, W, H), 0, 0);
    const bc = document.createElement('canvas'); bc.width = W; bc.height = H; bc.getContext('2d').putImageData(new ImageData(bb, W, H), 0, 0);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = s0.aniso; const bt = new THREE.CanvasTexture(bc); bt.anisotropy = s0.aniso;
    const m = p.mat, keep = s0.disposables.slice(0, 2), old = [m.map, m.bumpMap].filter(x => x && !keep.includes(x));
    m.map = tex; m.emissiveMap = tex; m.bumpMap = bt; if (!p.texW) { m.emissive.setRGB(1, 1, 1); m.emissiveIntensity = 0.07; m.color.setRGB(1, 1, 1); }
    for (const x of old) { x.dispose(); const j = s0.disposables.indexOf(x); if (j >= 0) s0.disposables.splice(j, 1); }
    s0.disposables.push(tex, bt); p.texW = W; p.busy = 0; s0.dirty = true; if (!s0.live) kick(); if (done) idle(done, 100); };
  const local = () => { if (st !== s0) return;
    const dd = new Uint8ClampedArray(W * H * 4), bb = new Uint8ClampedArray(W * H * 4); let y = 0;
    const step = dl => { if (st !== s0) return; const t0 = performance.now(); const budget = dl && !dl.didTimeout && dl.timeRemaining ? Math.max(4, Math.min(14, dl.timeRemaining() - 1)) : 10;
      while (y < H && performance.now() - t0 < budget) { nzRows(o, dd, bb, y, y + 1); y++; }
      if (y < H) idle(step, 60); else apply(dd, bb); };
    idle(step, 60); };
  const w = texWorker(s0);
  if (w) { const id = ++s0.wid; s0.wjobs[id] = (dd, bb) => (dd ? apply(dd, bb) : local()); try { w.postMessage(Object.assign({ id }, o)); } catch (e) { delete s0.wjobs[id]; local(); } }
  else local(); }
function hdFeatured() { if (st && st.ready) planetTex(st.planets[st.sel], 1024); }
/* vagas na tela (NDC x, y, profundidade, raio em NDC de altura): a 0 é a do mundo escolhido, atrás do líder; as outras
   quatro sobem em fila pela faixa de cima (o Alinhamento), acima dos textos. A Fenda é um rasgo diagonal ao fundo. */
const SLOTS = {
  land: [[-0.6, 0.14, 18, 0.27], [-0.3, 0.82, 34, 0.068], [-0.06, 0.86, 44, 0.054], [0.16, 0.89, 54, 0.045], [0.36, 0.9, 64, 0.038]],
  mid: [[-0.6, 0.3, 18, 0.22], [-0.05, 0.84, 34, 0.06], [0.18, 0.87, 44, 0.05], [0.4, 0.89, 54, 0.042], [0.62, 0.9, 64, 0.036]],
  port: [[-0.6, 0.52, 18, 0.16], [0.3, 0.93, 40, 0.035], [0.5, 0.88, 48, 0.03], [0.68, 0.83, 56, 0.026], [0.84, 0.78, 64, 0.022]] };
const RIFTS = { land: [[0.0, 1.08], [0.3, 0.66]], mid: [[0.12, 1.08], [0.44, 0.68]], port: [[0.4, 1.06], [0.95, 0.74]] };
function domRect(sel) { const el = document.querySelector(sel); if (!el) return null; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 ? r : null; }
function layout() { if (!st) return; const w = innerWidth, h = innerHeight; const kind = w < h ? 'port' : w < 1100 ? 'mid' : 'land'; const cam = st.cam; const ty = Math.tan(cam.fov * Math.PI / 360), tx = ty * cam.aspect;
  const nd = (px, py) => [px / w * 2 - 1, 1 - py / h * 2]; const S = SLOTS[kind].map(a => a.slice());
  /* a vaga da frente acompanha o busto da vitrine; as outras quatro ficam na faixa livre entre o título e a versão (no celular, à direita do título) */
  const bust = domRect('#sc-bust'), brand = domRect('.brand-txt'), ver = domRect('.st-ver'), head = domRect('.st-head');
  if (bust) { const [nx, ny] = nd(bust.left + bust.width / 2, bust.top + bust.height * 0.4); S[0] = [nx, ny, 18, Math.min(0.46, bust.width * (kind === 'port' ? 0.5 : 0.36) / (h / 2))]; }
  if (brand && head) { const xa = brand.right + (kind === 'port' ? 26 : 84); /* folga para o anel dos mundos com anéis não encostar no título */ const sameRow = ver && ver.top < brand.bottom - 10 && ver.left > xa + 160; const xb = sameRow ? ver.left - 40 : w - 22; const yc = Math.max(28, head.top + Math.min(head.height, brand.height) * 0.42);
    const gap = Math.max(60, xb - xa); const r0 = Math.max(9, Math.min(36, gap / 10)); for (let k = 1; k < 5; k++) { const f = (k - 1) / 3; const [nx, ny] = nd(xa + gap * (0.04 + f * 0.92), yc - (f - 0.5) * (f - 0.5) * 30 + 8 * f); S[k] = [nx, ny, 30 + k * 9, (r0 * (1 - f * 0.5)) / (h / 2)]; } }
  st.slots = S.map(([nx, ny, d, r]) => ({ x: nx * tx * d, y: ny * ty * d, z: -d, r: r * ty * d }));
  const [a, b] = RIFTS[kind]; const D = 150; const ax = a[0] * tx * D, ay = a[1] * ty * D, bx = b[0] * tx * D, by = b[1] * ty * D; const len = Math.hypot(bx - ax, by - ay);
  st.rift.position.set((ax + bx) / 2, (ay + by) / 2, -D); st.rift.rotation.set(0, 0, Math.atan2(-(bx - ax), by - ay)); st.rift.scale.set(len / 120 * 0.8, len / 120 * 1.15, 1);
  st.RIFT.set((ax + bx) / 2, (ay + by) / 2, -D).normalize(); }
function slotAt(u) { const S = st.slots, n = S.length; u = ((u % n) + n) % n; const k = Math.floor(u), f = u - k, A = S[k], B = S[(k + 1) % n]; const e = f * f * (3 - 2 * f);
  if (k === n - 1) { /* da última vaga de volta à da frente: passa por trás, longe (encolhe e volta) */ const cx = (A.x + B.x) / 2, cy = Math.max(A.y, B.y) + 4, cz = Math.min(A.z, B.z) - 70; const t = e, mt = 1 - t;
    return { x: mt * mt * A.x + 2 * mt * t * cx + t * t * B.x, y: mt * mt * A.y + 2 * mt * t * cy + t * t * B.y, z: mt * mt * A.z + 2 * mt * t * cz + t * t * B.z, r: A.r + (B.r - A.r) * e, front: t > 0.5 ? (t - 0.5) * 2 : 0 }; }
  return { x: A.x + (B.x - A.x) * e, y: A.y + (B.y - A.y) * e + Math.sin(f * Math.PI) * 0.6, z: A.z + (B.z - A.z) * e, r: A.r + (B.r - A.r) * e, front: k === 0 ? 1 - e : 0 }; }
function place(dt) { const { planets } = st; for (let i = 0; i < planets.length; i++) { const p = planets[i]; const q = slotAt(i - st.off);
    p.g.position.set(q.x, q.y, q.z); p.g.scale.setScalar(q.r); p.atU.it.value = 0.95 + 1.1 * q.front; p.sph.rotation.y += dt * (0.03 + 0.05 * q.front); } }
function setTint(race, now) { if (!st) return; const COL = { vehnar: 0xff7733, erevane: 0x33ffd0, tessara: 0x55e68a, quorith: 0xb388ff, vorag: 0xe6455a }; const c = new st.THREE.Color(COL[race] || 0xff7733);
  st.tintTo = c; if (now) { st.tint.copy(c); st.rim.color.copy(c); st.dust.material.color.copy(c); } }
function setRace(race) { if (!st) return; const i = RACES.indexOf(race); if (i < 0 || i === st.sel) return;
  /* o anel gira pelo caminho mais curto até o mundo escolhido ficar na frente */
  let d = (i - st.sel) % 5; if (d > 2) d -= 5; if (d < -2) d += 5; st.sel = i; st.offFrom = st.off; st.offTo = st.off + d; st.animT = 0; setTint(race, false); hdFeatured(); /* 4.3l */
  if (!st.live) { if (reduced() || softwareGL(st.renderer)) { st.off = st.offTo; st.animT = 1; setTint(race, true); st.dirty = true; kick(); } else loop(1200); } }
let pending = 0;
function kick() { if (!st || pending) return; pending = requestAnimationFrame(() => { pending = 0; if (!st) return; render(performance.now(), 0); }); }
function render(now, dt) { const s = st; const t = (now - s.t0) / 1000; const { M, Q, E, V, SV } = s.tmp;
  if (s.animT < 1) { s.animT = Math.min(1, s.animT + dt / 1.15); s.off = s.offFrom + (s.offTo - s.offFrom) * ease(s.animT); }
  if (s.tintTo) { const k = s.animT < 1 ? Math.min(1, dt * 3) : 1; s.tint.lerp(s.tintTo, k); s.rim.color.copy(s.tint); s.dust.material.color.copy(s.tint); }
  place(dt);
  s.mouse[0] += (s.mt[0] - s.mouse[0]) * Math.min(1, dt * 2); s.mouse[1] += (s.mt[1] - s.mouse[1]) * Math.min(1, dt * 2);
  const fl = s.live ? 1 : 0; s.cam.position.set(Math.sin(t * 0.07) * 0.6 * fl + s.mouse[0] * 0.9, Math.sin(t * 0.05) * 0.35 * fl - s.mouse[1] * 0.5, 0); s.cam.lookAt(s.mouse[0] * 0.6, -s.mouse[1] * 0.3, -40);
  s.skyU.uTime.value = t; s.riftU.uTime.value = t;
  for (const r of s.rocks) { const { im, data } = r; for (let i = 0; i < data.length; i++) { const o = data[i]; let x = o.x + (s.live ? t * o.v : 0); const span = 20 + -o.z * 1.8; x = ((x + span) % (2 * span) + 2 * span) % (2 * span) - span;
      E.set(o.rx + t * o.w, o.ry + t * o.w * 0.7, 0); Q.setFromEuler(E); V.set(x, o.y, o.z); SV.setScalar(o.s); M.compose(V, Q, SV); im.setMatrixAt(i, M); } im.instanceMatrix.needsUpdate = true; }
  s.dust.rotation.y = t * 0.004; s.dust.position.x = Math.sin(t * 0.03) * 0.8;
  s.sky.position.copy(s.cam.position);
  s.renderer.render(s.scene, s.cam); s.frames++; s.dirty = false;
  if (!s.cv.classList.contains('on') && ((s.ready && s.skyU.uHasNeb.value) || now - s.t0 > 3000)) s.cv.classList.add('on'); }
function loop(ms) { if (!st || st.raf) return; const until = ms ? performance.now() + ms : 0;
  const step = now => { st.raf = 0; if (!st) return; if (document.hidden || st.host.hidden) return; const dt = st.last ? Math.min(0.1, (now - st.last) / 1000) : 0.016;
    if (st.live || until) { if (now - st.last >= 32) { if (st.live && st.last && !st.forced) { const ms = now - st.last; st.slow = ms > 52 && ms < 400 ? st.slow + 1 : Math.max(0, st.slow - 2); if (st.slow > 40 && st.prK > 0.55) { st.prK = st.prK > 0.9 ? 0.75 : 0.5; st.slow = 0; st.resize(); } } /* 4.3l: quadros lentos seguidos baixam a densidade um degrau */ st.last = now; render(now, dt); } } if (st.live || (until && now < until)) st.raf = requestAnimationFrame(step); else { st.last = 0; st.animT = 1; st.off = st.offTo; if (st.tintTo) st.tint.copy(st.tintTo); render(now, 0); } };
  st.raf = requestAnimationFrame(step); }
function stop() { if (!st) return; const s = st; st = null; cancelAnimationFrame(s.raf); if (s.worker) { try { s.worker.terminate(); } catch (e) {} } /* 4.3l */ if (pending) { cancelAnimationFrame(pending); pending = 0; } removeEventListener('resize', s.resize); removeEventListener('pointermove', s.onMove); document.removeEventListener('visibilitychange', s.onVis);
  try { s.scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); for (const d of s.disposables) if (d && d.dispose) d.dispose(); s.renderer.dispose(); s.renderer.forceContextLoss(); } catch (e) {}
  if (s.cv.parentNode) s.cv.parentNode.removeChild(s.cv); }
ARD.uiFx = { mount, setRace, stop, active: () => !!st, info: () => st ? { live: st.live, frames: st.frames, ready: st.ready, neb: !!st.skyU.uHasNeb.value, pr: st.renderer.getPixelRatio(), prK: st.prK, tex: st.planets.map(p => p.texW), sel: st.sel, worker: !!st.worker } : null }; /* 4.3l: densidade, texturas, mundo em destaque e se o Worker está gerando */
})(globalThis.ARD = globalThis.ARD || {});
