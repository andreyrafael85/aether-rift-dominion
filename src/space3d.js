/* Aether Rift: Dominion — o espaço do Cinturão (4.3h).
   No mapa Cinturão o campo de batalha são plataformas de asteroide sobre o espaço: este módulo desenha o que fica em volta e abaixo
   delas (céu estrelado também abaixo do horizonte, nebulosa, asteroides do cinturão flutuando, rochas e cristais pendurados sob as
   plataformas, a Fenda brilhando no fundo do abismo central). O render3d chama (só no Cinturão):
   - SP.build(sim, T): uma vez, depois do terreno (T = resultado do terrain3d.build: heights, HN, HS, voidH, lakes...; sim.map = plataformas, anel e pontes)
   - SP.update(dt, time, camera): a cada quadro
   Ambiente (env): renderer, scene, camera, FX, fogTex (névoa de guerra), quality() → { resolved, particles, ... }, light() → luz do mapa (sol, céu, noite), H(x, y) = altura do terreno.
   Como funciona (4.3h):
   - "Camada do espaço": tudo o que fica no vazio (raízes de rocha sob as plataformas, quilhas das pontes, estalactites e cristais pendurados,
     asteroides em camadas de profundidade, o redemoinho da Fenda e os feixes que sobem dele) mora numa cena própria, desenhada a cada quadro
     num alvo de render com profundidade própria (ordem certa entre eles, sem a bruma de altura do render3d, que acinzentava tudo lá embaixo)
     e composta na cena do jogo por um quadro de tela cheia na profundidade do céu (1,0): o chão, as unidades e os efeitos desenham por cima.
     O alvo tem o tamanho da tela (no máximo ~2,1 Mpx; metade na qualidade Baixa e no celular).
   - O céu do world3d entra no modo espaço (nebulosa assada num cubemap, estrelas analíticas, faixa da galáxia, planeta gigante, sol sem ar).
   - Pedras soltas perto dos paredões ficam na cena do jogo (podem passar na frente do paredão); poeira e cascalho caindo das bordas e
     faíscas subindo do abismo saem pelo env.FX.
   - A névoa do Cinturão vira poeira escura de espaço: a cor de fundo da cena (de onde o render3d tira a bruma) é trocada aqui.
   - Borda: o terreno recebe um mapa da borda (distância com sinal até o vazio, pontes) e é cortado a 18 da borda (terrain3d, ARD_VAZIO); dali
     para fora quem desenha é esta camada: uma beirada de rocha clara e o paredão seguindo o contorno exato das plataformas (sem os dentes da
     grade de 10 do relevo), que continua na raiz de rocha e some no escuro. SP.off = true desliga tudo (diagnóstico e medida de custo). */
(function (ARD) {
'use strict';
const TAU = Math.PI * 2;
function rng(seed) { let s = (seed >>> 0) || 1; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function h2(ix, iy, s) { let n = (ix * 374761393 + iy * 668265263 + s * 1274126177) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); n ^= n >>> 16; return (n >>> 0) / 4294967296; }
const sm = t => t * t * (3 - 2 * t);
function sstep(a, b, x) { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
function vn(x, y, s) { const ix = Math.floor(x), iy = Math.floor(y); const fx = sm(x - ix), fy = sm(y - iy); const a = h2(ix, iy, s), b = h2(ix + 1, iy, s), c = h2(ix, iy + 1, s), d = h2(ix + 1, iy + 1, s); return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy; }
function fbm(x, y, oct, s) { let v = 0, a = 0.5, t = 0; for (let o = 0; o < oct; o++) { v += a * vn(x, y, s + o * 131); t += a; x = x * 2.03 + 17.13; y = y * 2.03 + 9.71; a *= 0.5; } return v / t; }
/* cor de rocha de cada bioma (a mesma família do paredão do terrain3d): gelo, deserto de pedra, tundra, basalto */
const ROCK = [[0.27, 0.3, 0.36], [0.5, 0.35, 0.25], [0.33, 0.31, 0.28], [0.05, 0.045, 0.052]];

// ---------- trechos de shader da camada do espaço (MeshStandardMaterial + remendos) ----------
const GLSL_N = `
float ardH(vec3 p){ p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
vec3 ardH33(vec3 p){ p = fract(p * vec3(0.1031, 0.1030, 0.0973)); p += dot(p, p.yxz + 33.33); return fract((p.xxy + p.yxx) * p.zyx); }
float ardN3(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(ardH(i), ardH(i + vec3(1.0, 0.0, 0.0)), f.x), mix(ardH(i + vec3(0.0, 1.0, 0.0)), ardH(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
             mix(mix(ardH(i + vec3(0.0, 0.0, 1.0)), ardH(i + vec3(1.0, 0.0, 1.0)), f.x), mix(ardH(i + vec3(0.0, 1.0, 1.0)), ardH(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z); }
`;
/* rocha instanciada: forma única por instância (ruído na esfera + cortes planos de lasca), giro lento na GPU, balanço opcional */
const ROCK_VS = `
#ifdef ARD_ROCHA
{ float sdi = float(gl_InstanceID) * 1.618 + uSeed; vec3 p = normalize(position);
  float n = ardN3(p * 1.5 + sdi) * 0.55 + ardN3(p * 3.4 - sdi * 1.3) * 0.3 + ardN3(p * 7.7 + sdi * 0.7) * 0.15; float r = 0.7 + 0.6 * n;
  for (int k = 0; k < 4; k++) { vec3 cn = normalize(ardH33(vec3(sdi, float(k) * 3.7, 1.9)) * 2.0 - 1.0); float cd = 0.36 + 0.42 * ardH(vec3(sdi, float(k), 7.3)); float dp = r * dot(p, cn); if (dp > cd) r *= cd / dp; }
  transformed = p * r; vObjP = transformed;
  vec3 ax = aSpin.xyz; float ang = aSpin.w * uTime; float c = cos(ang), s = sin(ang); transformed = transformed * c + cross(ax, transformed) * s + ax * dot(ax, transformed) * (1.0 - c);
  #ifdef ARD_BALANCO
  transformed.y += sin(uTime * 0.55 + sdi * 3.0) * 0.22;
  #endif
}
#else
vObjP = position;
#endif
`;
const ROCK_FS_COLOR = `
{ vec3 op = vObjP;
  #ifdef ARD_RAIZ
  op = vSpW * 0.02;
  float band = vSpW.y / 8.5 + ardN3(vSpW * 0.012) * 2.2; float bi = floor(band); float bt = fract(sin(bi * 12.9898 + 78.233) * 43758.5453);
  diffuseColor.rgb *= 0.7 + 0.45 * bt; diffuseColor.rgb *= 0.78 + 0.44 * ardN3(vSpW * vec3(0.06, 0.012, 0.06)); /* estratos e veios verticais como no paredão */
  vec3 wnf = cross(dFdx(vSpW), dFdy(vSpW)); float up = smoothstep(0.55, 0.85, abs(wnf.y) * inversesqrt(max(dot(wnf, wnf), 1e-12)));
  float pit = smoothstep(0.7, 0.84, ardN3(vSpW * 0.62)); diffuseColor.rgb *= mix(1.0, (0.84 + 0.34 * ardN3(vec3(vSpW.x, 0.0, vSpW.z) * 0.13)) * (1.0 - 0.16 * pit), up); /* tampa: grão e covinhas miúdas */
  #endif
  #ifndef ARD_CRISTAL
  float g = ardN3(op * 3.1) * 0.6 + ardN3(op * 9.0) * 0.4; diffuseColor.rgb *= 0.74 + 0.5 * g;
  #endif
  #ifdef ARD_ROCHA
  diffuseColor.rgb *= mix(vec3(1.0), vec3(0.85, 0.92, 1.12), smoothstep(0.55, 0.8, ardN3(op * 1.7 + 4.0)));
  #endif
}
`;
/* fim do fragment: luz da Fenda (vinda do redemoinho lá embaixo) e o esmaecer para a poeira escura com a profundidade e a distância */
const FADE_FS = `
{ vec3 lp = (viewMatrix * vec4(uCore.xyz, 1.0)).xyz; vec3 lv = lp + vViewPosition; float ld = length(lv); lv /= max(ld, 1.0);
  float cl = max(dot(normal, lv), 0.0) * 0.85 + 0.15; float ca = 1.0 - smoothstep(0.0, uCore.w, ld); gl_FragColor.rgb += diffuseColor.rgb * uCoreC.rgb * cl * uCoreC.a * ca * ca;
  float dep = max(0.0, -vSpW.y - uFade.x); float fd = 1.0 - exp(-dep / uFade.y); float fz = 1.0 - exp(-length(vSpW - cameraPosition) / uFade.z);
  float f = min(1.0 - (1.0 - fd) * (1.0 - fz), uFade.w) * uFadeK;
  #ifdef ARD_NEVOA
  gl_FragColor.rgb *= mix(0.06, 1.0, texture2D(uFogMap, vec2(vSpW.x, -vSpW.z) / 3200.0).r); /* névoa de guerra do terreno */
  #endif
  gl_FragColor.rgb = mix(gl_FragColor.rgb, uHaze, f); }
`;

function create(THREE, scene, env) {
  const S = ARD.sim; const W3 = ARD.world3d;
  const SP = { THREE, scene, env, sim: null, T: null, built: false, stats: null };
  const isTouch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  /* uniforms compartilhados pelos materiais do espaço */
  const U = { uTime: { value: 0 }, uSeed: { value: 0 }, uHaze: { value: new THREE.Color(0.006, 0.009, 0.022) }, uFade: { value: new THREE.Vector4(160, 1500, 9000, 0.93) },
    uCore: { value: new THREE.Vector4(1600, -1650, -1600, 650) }, uCoreC: { value: new THREE.Vector4(1.3, 0.32, 0.95, 0.9) }, uFogMap: { value: null } };
  { const w = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1, THREE.RGBAFormat, THREE.UnsignedByteType); w.needsUpdate = true; U.uFogMap.value = w; U._white = w; }
  let space = null, rt = null, comp = null, near = null, backdrop = null, voidTex = null, sky = null, edges = null, tier = null, mats = [], geos = [], frame = 0;
  let lights = null, mainL = null, spaceCam = null; const _c = new THREE.Color(), _v = new THREE.Vector2(), _v3 = new THREE.Vector3(); let vortex = [], shafts = null, emitT = { dust: 0, peb: 0, mote: 0 };
  const tierOf = () => { const q = (env.quality && env.quality()) || {}; return q.resolved === 'baixa' || isTouch ? 'leve' : q.resolved === 'media' ? 'media' : 'alta'; };

  function rockMat(o) { /* o: { inst, raiz, balanco, emissive, fadeK, env } */
    const m = new THREE.MeshStandardMaterial({ color: o.color || 0xffffff, roughness: o.rough || 0.9, metalness: 0.0, flatShading: true, vertexColors: !!o.vcol, envMapIntensity: o.env == null ? 0.35 : o.env, emissive: o.emissive || 0x000000, emissiveIntensity: o.emI || 1, fog: !!o.fog });
    m.userData.fadeK = { value: o.fadeK == null ? 1 : o.fadeK };
    m.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, U); sh.uniforms.uFadeK = m.userData.fadeK;
      const defs = (o.inst ? '#define ARD_ROCHA\n' : '') + (o.raiz ? '#define ARD_RAIZ\n' : '') + (o.balanco ? '#define ARD_BALANCO\n' : '') + (o.cristal ? '#define ARD_CRISTAL\n' : '') + (o.nevoa ? '#define ARD_NEVOA\n' : '');
      sh.vertexShader = defs + 'uniform float uTime; uniform float uSeed; varying vec3 vSpW; varying vec3 vObjP;\n' + (o.inst ? 'attribute vec4 aSpin;\n' : '') + GLSL_N + sh.vertexShader
        .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + ROCK_VS)
        .replace('#include <project_vertex>', '#include <project_vertex>\n{ vec4 ardW = vec4(transformed, 1.0);\n#ifdef USE_INSTANCING\nardW = instanceMatrix * ardW;\n#endif\nvSpW = (modelMatrix * ardW).xyz; }');
      sh.fragmentShader = defs + 'uniform float uTime; uniform vec3 uHaze; uniform vec4 uFade; uniform vec4 uCore; uniform vec4 uCoreC; uniform float uFadeK; uniform sampler2D uFogMap; varying vec3 vSpW; varying vec3 vObjP;\n' + GLSL_N + sh.fragmentShader
        .replace('#include <color_fragment>', '#include <color_fragment>\n' + ROCK_FS_COLOR)
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n#ifdef ARD_CRISTAL\n#ifdef USE_COLOR\ntotalEmissiveRadiance *= vColor.rgb;\n#endif\ntotalEmissiveRadiance *= 0.55 + 0.25 * sin(uTime * 1.4 + vSpW.x * 0.031 + vSpW.z * 0.027) + 0.6 * smoothstep(-0.3, -1.0, vObjP.y);\n#endif')
        .replace('#include <opaque_fragment>', '#include <opaque_fragment>\n' + FADE_FS);
    };
    m.customProgramCacheKey = () => 'ard-espaco-v43h' + (o.inst ? '-i' : '') + (o.raiz ? '-r' : '') + (o.balanco ? '-b' : '') + (o.cristal ? '-c' : '') + (o.fog ? '-f' : '') + (o.nevoa ? '-n' : '');
    mats.push(m); return m;
  }

  // ---------- borda do chão: pontos ao longo de todas as bordas (para poeira, pedras e o mapa da borda) ----------
  function edgePoints(sim) {
    const m = sim.map, xs = [], ys = [], nxs = [], nys = []; const push = (x, y, nx, ny) => { if (S.mapSd(sim, x + nx * 14, y + ny * 14) > -2) return; xs.push(x); ys.push(y); nxs.push(nx); nys.push(ny); };
    const loop = (cx, cy, Rr, sd, out) => { const n = Math.max(24, Math.round(TAU * Rr / 18)); for (let i = 0; i < n; i++) { const a = i / n * TAU, r = S.edgeR(Rr, a, sd), a2 = a + 0.002, r2 = S.edgeR(Rr, a2, sd);
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r; let tx = cx + Math.cos(a2) * r2 - x, ty = cy + Math.sin(a2) * r2 - y; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l; const s = out ? 1 : -1; push(x, y, ty * s, -tx * s); } };
    for (const p of m.plats) loop(p[0], p[1], p[2], p[3], true);
    if (m.ring) { loop(m.ring[0], m.ring[1], m.ring[2], m.ring[4], false); loop(m.ring[0], m.ring[1], m.ring[3], m.ring[4] + 1.3, true); }
    for (const b of m.bridges) { const vx = b[2] - b[0], vy = b[3] - b[1], L = Math.hypot(vx, vy) || 1, ux = vx / L, uy = vy / L; const n = Math.ceil(L / 18);
      for (let i = 0; i <= n; i++) { const t = i / n, w = b[4] * 0.5 * (1 + 0.14 * Math.sin(t * 11 + b[5]) + 0.06 * Math.sin(t * 29 + b[5] * 2)); const cx = b[0] + vx * t, cy = b[1] + vy * t;
        for (const s of [1, -1]) { const nx = -uy * s, ny = ux * s; push(cx + nx * w, cy + ny * w, nx, ny); } } }
    return { x: Float32Array.from(xs), y: Float32Array.from(ys), nx: Float32Array.from(nxs), ny: Float32Array.from(nys), n: xs.length };
  }
  // ---------- mapa da borda para o material do terreno: R = distância com sinal até o vazio (±64), G = ponte ----------
  /* sdRapido: o mesmo cálculo do ARD.sim.mapSd, mas pulando as formas que estão longe demais para mudar o resultado (|sd| > 64 vira 64 no mapa);
     conferido contra o mapSd em 400 pontos — se o sim mudar a fórmula e divergir, volta para o mapSd (mais lento, sempre certo) */
  function sdTools(sim) {
    const m = sim.map, P = m.plats.map(p => ({ x: p[0], y: p[1], R: p[2], s: p[3], rr: (p[2] * 1.15 + 70) ** 2 })), g = m.ring, B = m.bridges.map(b => { const wm = b[4] * 0.5 * 1.2 + 70; return { b, vx: b[2] - b[0], vy: b[3] - b[1], L2: (b[2] - b[0]) ** 2 + (b[3] - b[1]) ** 2, x0: Math.min(b[0], b[2]) - wm, x1: Math.max(b[0], b[2]) + wm, y0: Math.min(b[1], b[3]) - wm, y1: Math.max(b[1], b[3]) + wm }; });
    const T = { br: false };
    T.sd = (x, y) => { let pl = -9999, br = -9999;
      for (const p of P) { const dx = x - p.x, dy = y - p.y, d2 = dx * dx + dy * dy; if (d2 > p.rr) continue; const d = Math.sqrt(d2); const v = d > p.R * 1.6 ? p.R * 1.15 - d : S.edgeR(p.R, Math.atan2(dy, dx), p.s) - d; if (v > pl) pl = v; }
      if (g) { const dx = x - g[0], dy = y - g[1], d = Math.sqrt(dx * dx + dy * dy); if (d < g[3] * 1.15 + 70) { const a = Math.atan2(dy, dx); const v = Math.min(d - S.edgeR(g[2], a, g[4]), S.edgeR(g[3], a, g[4] + 1.3) - d); if (v > pl) pl = v; } }
      for (const q of B) { if (x < q.x0 || x > q.x1 || y < q.y0 || y > q.y1) continue; const b = q.b; let t = ((x - b[0]) * q.vx + (y - b[1]) * q.vy) / (q.L2 || 1); t = t < 0 ? 0 : t > 1 ? 1 : t; const w = b[4] * 0.5 * (1 + 0.14 * Math.sin(t * 11 + b[5]) + 0.06 * Math.sin(t * 29 + b[5] * 2)); const v = w - Math.hypot(b[0] + q.vx * t - x, b[1] + q.vy * t - y); if (v > br) br = v; }
      T.br = br >= 0 && pl < 0; return Math.max(pl, br); };
    let ok = true; const r = rng(77); for (let i = 0; i < 400 && ok; i++) { const x = r() * S.WORLD, y = r() * S.WORLD; const a = Math.max(-64, Math.min(64, T.sd(x, y))), b = Math.max(-64, Math.min(64, S.mapSd(sim, x, y))); if (Math.abs(a - b) > 0.6) ok = false; }
    if (!ok) { console.warn('[ARD] espaço: borda pelo mapSd (a fórmula do sim mudou)'); T.sd = (x, y) => { const v = S.mapSd(sim, x, y); T.br = v > -8 && v < 60 && S.onBridge(m, x, y) && !S.onPlat(m, x, y); return v; }; }
    return T;
  }
  function voidMap(sim) {
    const N = 512, W = S.WORLD, cs = W / N, data = new Uint8Array(N * N * 4), B = 4, NB = N / B; const F = sdTools(sim);
    for (let bj = 0; bj < NB; bj++) for (let bi = 0; bi < NB; bi++) { const cx = (bi + 0.5) * B * cs, cy = (bj + 0.5) * B * cs; const sc = F.sd(cx, cy);
      const far = Math.abs(sc) > 64 + B * cs * 1.5; for (let j = bj * B; j < bj * B + B; j++) for (let i = bi * B; i < bi * B + B; i++) { const k = (j * N + i) * 4; let sd = sc, br = 0;
        if (!far) { sd = F.sd((i + 0.5) * cs, (j + 0.5) * cs); br = F.br ? 255 : 0; }
        data[k] = Math.round(255 * (Math.max(-1, Math.min(1, sd / 64)) * 0.5 + 0.5)); data[k + 1] = br; data[k + 2] = 0; data[k + 3] = 255; } }
    const t = new THREE.DataTexture(data, N, N, THREE.RGBAFormat, THREE.UnsignedByteType); t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.colorSpace = THREE.NoColorSpace; t.needsUpdate = true; return t;
  }
  SP.refreshVoid = function () { if (!voidTex) return; scene.traverse(o => { const ud = o.isMesh && o.material && o.material.userData; if (!ud || !ud.voidMap) return; if (ud.voidMap.value !== voidTex) ud.voidMap.value = voidTex; if (!env.fogTex && ud.terrU && ud.terrU.fogMap && ud.terrU.fogMap.value) U.uFogMap.value = ud.terrU.fogMap.value; }); };

  // ---------- geometria: pilhas de anéis (raízes, quilhas e estalactites) ----------
  function Geo() { return { p: [], c: [], i: [] }; }
  function ringStack(G, rings, apex, colAt, flip, capOf) { /* rings: [[x,y,z,...]], todos com o mesmo número de pontos, fechados no ângulo; capOf(v) = anel da tampa */
    const n = rings[0].length / 3, base = G.p.length / 3;
    for (let v = 0; v < rings.length; v++) { const r = rings[v], cap = capOf ? capOf(v) : 0; for (let k = 0; k < n; k++) { const x = r[k * 3], y = r[k * 3 + 1], z = r[k * 3 + 2]; G.p.push(x, y, z); const c = colAt(x, y, cap); G.c.push(c[0], c[1], c[2]); } }
    for (let v = 0; v < rings.length - 1; v++) for (let k = 0; k < n; k++) { const a = base + v * n + k, b = base + v * n + (k + 1) % n, c = a + n, d = b + n; if (flip) G.i.push(a, b, c, b, d, c); else G.i.push(a, c, b, b, c, d); }
    if (apex) { const ai = G.p.length / 3; G.p.push(apex[0], apex[1], apex[2]); const c = colAt(apex[0], apex[1], 0); G.c.push(c[0], c[1], c[2]); const last = base + (rings.length - 1) * n; for (let k = 0; k < n; k++) G.i.push(last + k, ai, last + (k + 1) % n); }
  }
  function spike(G, x, y, z, rad, len, dx, dz, sides, rnd, colAt) { /* estalactite: cone torto e lascado pendurado em (x, y, z) */
    const rings = [], nv = 4, ph = rnd() * TAU; for (let v = 0; v < nv; v++) { const t = v / nv, r = rad * Math.pow(1 - t, 0.8) * (v ? 0.85 + rnd() * 0.3 : 1), ring = [];
      const cx = x + dx * t * t * len, cz = z + dz * t * t * len, cy = y - len * t; for (let k = 0; k < sides; k++) { const a = ph + k / sides * TAU, j = 0.8 + 0.4 * rnd(); ring.push(cx + Math.cos(a) * r * j, cy, cz - Math.sin(a) * r * j); } rings.push(ring); }
    ringStack(G, rings, [x + dx * len, y - len * 1.04, z + dz * len], colAt);
  }
  function toGeo(G) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(G.p, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(G.c, 3)); g.setIndex(G.p.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(G.i, 1) : new THREE.Uint16BufferAttribute(G.i, 1)); g.computeBoundingSphere(); geos.push(g); return g; } /* sem normais: o material é facetado (normal pela derivada) */

  /* perfil do paredão a partir da borda: [afastamento para fora do vazio (negativo = para dentro do chão), altura]; as três primeiras alturas são
     relativas à beirada (altura do chão ali), as duas últimas absolutas. O terreno é cortado na linha da borda (terrain3d, ARD_VAZIO): o paredão
     visível é este, que segue o contorno exato (sem os dentes da grade) e continua na raiz de rocha. */
  const WALL = [[-26, 0.6, 1], [-9, 0.9, 1], [-2.5, -4.5, 1], [1, -20, 1], [1.6, -55, 0], [0.6, -96, 0]]; const CAP = 2; /* dois primeiros anéis = tampa de rocha da beirada */
  function buildRoots(sim, T, rnd, K) {
    const m = sim.map, G = Geo(), bw = [0, 0, 0, 0]; const seed = sim.seed | 0; const crys = [];
    const HN = T && T.HN, HS = T && T.HS, HH = T && T.heights; const Hb = (x, y) => { if (!HH) return 0; const gx = Math.max(0, Math.min(HN - 1.001, x / HS)), gy = Math.max(0, Math.min(HN - 1.001, y / HS)); const ix = gx | 0, iy = gy | 0, fx = gx - ix, fy = gy - iy; return (HH[iy * HN + ix] * (1 - fx) + HH[iy * HN + ix + 1] * fx) * (1 - fy) + (HH[(iy + 1) * HN + ix] * (1 - fx) + HH[(iy + 1) * HN + ix + 1] * fx) * fy; };
    const rockAt = (x, y) => { if (T && T.bioAt) T.bioAt(x, y, bw); else { bw[0] = 0; bw[1] = 1; bw[2] = 0; bw[3] = 0; } const t = bw[0] + bw[1] + bw[2] + bw[3] || 1; const c = [0, 0, 0]; for (let b = 0; b < 4; b++) { const w = bw[b] / t; c[0] += w * ROCK[b][0]; c[1] += w * ROCK[b][1]; c[2] += w * ROCK[b][2]; } return c; };
    let curRock = [0.3, 0.3, 0.3], curD = 600; const colAt = (x, y, cap) => { const c = curRock, l = (c[0] + c[1] + c[2]) / 3;
      if (cap) return [(c[0] * 0.55 + l * 0.45) * 1.18 + 0.03, (c[1] * 0.55 + l * 0.45) * 1.18 + 0.03, (c[2] * 0.55 + l * 0.45) * 1.18 + 0.03]; /* beirada: rocha gasta, mais clara */
      const t = Math.max(0, Math.min(1, (-30 - y) / curD)); const k = 1 - 0.62 * t, gr = 0.45 * t; return [(c[0] * (1 - gr) + l * gr) * k, (c[1] * (1 - gr) + l * gr) * k, (c[2] * (1 - gr) + l * gr) * k]; };
    const jagW = (th, y, s) => (fbm(th * 9.0, y / 34, 2, s) - 0.5) * 3.2; /* paredão: ±1,6 de rugosidade fora da beirada */
    /* plataformas: paredão + cone de rocha com ombro, estratos em degraus, cristas verticais; estalactites e cristais */
    for (const p of m.plats) { const [px, py, R, sd] = p; const big = R > 400; const D = big ? 860 : 540; const nA = Math.round((big ? 140 : 90) * K), nV = Math.round((big ? 24 : 18) * Math.max(0.7, K)); const sN = (seed * 31 + Math.round(px * 7 + py * 13)) | 0;
      curRock = rockAt(px, py); curD = D; const tx = (rnd() - 0.5) * 0.3 * R, ty = (rnd() - 0.5) * 0.3 * R; const rings = []; const E = new Float32Array(nA), RIM = new Float32Array(nA);
      for (let a = 0; a < nA; a++) { const th = a / nA * TAU, e = S.edgeR(R, th, sd), c = Math.cos(th), sn = Math.sin(th); E[a] = e; RIM[a] = Math.max(Hb(px + c * (e - 12), py + sn * (e - 12)), Hb(px + c * (e - 19), py + sn * (e - 19)), Hb(px + c * (e - 27), py + sn * (e - 27))); }
      for (const [dr, dy, rel] of WALL) { const ring = []; for (let a = 0; a < nA; a++) { const th = a / nA * TAU, y = rel ? RIM[a] + dy : dy; const r = E[a] + dr + (dr > 0 ? jagW(th, y, sN) : 0); ring.push(px + Math.cos(th) * r, y, -(py + Math.sin(th) * r)); } rings.push(ring); }
      for (let v = 1; v <= nV; v++) { const t = Math.pow(v / nV, 1.3), y = -96 - D * t, ring = []; const prof = (1 - 0.13 * sstep(0, 0.28, t)) * Math.pow(Math.max(0, 1 - t), 0.72); const cx = px + tx * t * t, cy = py + ty * t * t;
        for (let a = 0; a < nA; a++) { const th = a / nA * TAU; const r0 = E[a] + 0.6; const st = y / 64 + (fbm(th * 2.3, y / 300, 2, sN + 5) - 0.5) * 1.6; const sf = st - Math.floor(st);
          const jag = sstep(0, 0.1, t) * ((fbm(th * R / 80, y / 150, 3, sN) - 0.5) * 0.42 + (fbm(th * R / 26, y / 50, 2, sN + 7) - 0.5) * 0.16 - 0.045 * sstep(0.62, 0.92, sf));
          const r = Math.max(4, r0 * prof * (1 + jag)); ring.push(cx + Math.cos(th) * r, y, -(cy + Math.sin(th) * r)); }
        rings.push(ring); }
      ringStack(G, rings, [px + tx, -96 - D - 60, -(py + ty)], colAt, false, v => v < CAP);
      const ns = Math.round((big ? 9 : 5) * K); for (let s = 0; s < ns; s++) { const t = 0.22 + rnd() * 0.5, th = rnd() * TAU, y = -96 - D * t, prof = (1 - 0.13 * sstep(0, 0.28, t)) * Math.pow(1 - t, 0.72), r = S.edgeR(R, th, sd) * prof * (0.55 + rnd() * 0.3);
        spike(G, px + tx * t * t + Math.cos(th) * r, y, -(py + ty * t * t + Math.sin(th) * r), R * (0.07 + rnd() * 0.09), D * (0.25 + rnd() * 0.45), Math.cos(th) * 0.12, -Math.sin(th) * 0.12, 7, rnd, colAt); }
      const nc = Math.round((big ? 16 : 9) * K); for (let s = 0; s < nc; s++) { const th = rnd() * TAU, e = S.edgeR(R, th, sd); if (S.mapSd(sim, px + Math.cos(th) * (e + 30), py + Math.sin(th) * (e + 30)) > -4) continue;
        crys.push([px + Math.cos(th) * (e + 1), -40 - rnd() * rnd() * 150, py + Math.sin(th) * (e + 1), Math.cos(th), Math.sin(th), 0]); } }
    /* anel do abismo: paredão de dentro (para o abismo) e de fora, seção em V por baixo (o abismo alarga para baixo), estalactites na quilha */
    if (m.ring) { const [gx, gy, ri, ro, gs] = m.ring; const nA = Math.round(230 * K), nU = Math.round(16 * Math.max(0.7, K)), Dr = 400; curRock = [0.05, 0.045, 0.052]; curD = Dr; const sN = seed * 17 + 3;
      const RI = new Float32Array(nA), RO = new Float32Array(nA), HI = new Float32Array(nA), HO = new Float32Array(nA), MID = new Float32Array(nA), DEP = new Float32Array(nA);
      for (let a = 0; a < nA; a++) { const th = a / nA * TAU, c = Math.cos(th), sn = Math.sin(th); RI[a] = S.edgeR(ri, th, gs); RO[a] = S.edgeR(ro, th, gs + 1.3); HI[a] = Math.max(Hb(gx + c * (RI[a] + 12), gy + sn * (RI[a] + 12)), Hb(gx + c * (RI[a] + 19), gy + sn * (RI[a] + 19)), Hb(gx + c * (RI[a] + 27), gy + sn * (RI[a] + 27))); HO[a] = Math.max(Hb(gx + c * (RO[a] - 12), gy + sn * (RO[a] - 12)), Hb(gx + c * (RO[a] - 19), gy + sn * (RO[a] - 19)), Hb(gx + c * (RO[a] - 27), gy + sn * (RO[a] - 27)));
        MID[a] = (RI[a] + RO[a]) * 0.5 + (fbm(th * 3, 1.7, 2, sN + 9) - 0.5) * 60; DEP[a] = Dr * (0.7 + 0.6 * fbm(th * 4.1, 3.3, 3, sN)); }
      const rings = []; const ringAt = f => { const ring = []; for (let a = 0; a < nA; a++) { const th = a / nA * TAU; const q = f(a, th); ring.push(gx + Math.cos(th) * q[0], q[1], -(gy + Math.sin(th) * q[0])); } rings.push(ring); };
      for (const [dr, dy, rel] of WALL) ringAt((a, th) => { const y = rel ? HI[a] + dy : dy; return [RI[a] - dr - (dr > 0 ? jagW(th, y, sN) : 0), y]; });
      for (let u = 1; u < nU; u++) { const s = u / nU; ringAt((a, th) => { const dep = Math.pow(Math.sin(Math.PI * s), 0.75) * DEP[a]; const r0 = s < 0.5 ? (RI[a] - 0.6) + (MID[a] - RI[a] + 0.6) * sm(s * 2) : MID[a] + (RO[a] + 0.6 - MID[a]) * sm((s - 0.5) * 2); const y = -96 - dep;
        const jag = Math.min(1, dep / 50) * (fbm(th * ro / 70, y / 140, 3, sN + 1) - 0.5) * 0.12; return [r0 * (1 + jag), y]; }); }
      for (let w = WALL.length - 1; w >= 0; w--) { const [dr, dy, rel] = WALL[w]; ringAt((a, th) => { const y = rel ? HO[a] + dy : dy; return [RO[a] + dr + (dr > 0 ? jagW(th + 2.0, y, sN + 3) : 0), y]; }); }
      const nr = rings.length; ringStack(G, rings, null, colAt, true, v => v < CAP || v >= nr - CAP);
      const ns = Math.round(22 * K); for (let s = 0; s < ns; s++) { const a = Math.floor(rnd() * nA), th = a / nA * TAU, r = MID[a], dep = DEP[a] * (0.8 + 0.15 * rnd());
        spike(G, gx + Math.cos(th) * r, -96 - dep + 20, -(gy + Math.sin(th) * r), 26 + rnd() * 40, 120 + rnd() * 300, (rnd() - 0.5) * 0.3, (rnd() - 0.5) * 0.3, 7, rnd, colAt); }
      const nc = Math.round(30 * K); for (let s = 0; s < nc; s++) { const th = rnd() * TAU, inner = rnd() < 0.65, rr = inner ? S.edgeR(ri, th, gs) - 1.5 : S.edgeR(ro, th, gs + 1.3) + 1.5, sgn = inner ? -1 : 1;
        if (!inner && S.mapSd(sim, gx + Math.cos(th) * (rr + 30), gy + Math.sin(th) * (rr + 30)) > -4) continue; crys.push([gx + Math.cos(th) * rr, -40 - rnd() * rnd() * 160, gy + Math.sin(th) * rr, Math.cos(th) * sgn, Math.sin(th) * sgn, inner ? 1 : 0]); } }
    /* pontes: paredões dos dois lados e quilha em V por baixo, mais funda nas pontas; pedras penduradas */
    for (const b of m.bridges) { const vx = b[2] - b[0], vy = b[3] - b[1], L = Math.hypot(vx, vy) || 1, ux = vx / L, uy = vy / L; const nT = Math.max(8, Math.round(L / 20 * Math.max(0.6, K))), nC = 7; const sN = (seed * 13 + Math.round(b[5] * 1000)) | 0;
      curRock = rockAt((b[0] + b[2]) / 2, (b[1] + b[3]) / 2); curD = 260; const rows = [];
      for (let i = 0; i <= nT; i++) { const t = i / nT, w = b[4] * 0.5 * (1 + 0.14 * Math.sin(t * 11 + b[5]) + 0.06 * Math.sin(t * 29 + b[5] * 2)); const K2 = 70 + 80 * Math.abs(Math.cos(Math.PI * t)) + 70 * fbm(t * L / 140, 2.2, 3, sN); const cx = b[0] + vx * t, cy = b[1] + vy * t;
        const hAt = q => Math.max(Hb(cx + uy * q * (w - 12), cy - ux * q * (w - 12)), Hb(cx + uy * q * (w - 19), cy - ux * q * (w - 19)), Hb(cx + uy * q * (w - 27), cy - ux * q * (w - 27)), Hb(cx, cy)); const hL = hAt(1), hR = hAt(-1); const row = []; const put = (lat, y) => row.push(cx - uy * lat, y, -(cy + ux * lat));
        for (const [dr, dy, rel] of WALL) { const y = rel ? hL + dy : dy; put(-(w + dr + (dr > 0 ? jagW(t * 40, y, sN) : 0)), y); }
        for (let c = 1; c < nC; c++) { const s = c / nC, lat = (s * 2 - 1) * (w + 0.6) * (1 - 0.3 * Math.pow(Math.sin(Math.PI * s), 2)), dep = Math.pow(Math.sin(Math.PI * s), 0.7) * K2 * (0.85 + 0.3 * fbm(t * 9, s * 4, 2, sN + 3)); put(lat, -96 - dep); }
        for (let w2 = WALL.length - 1; w2 >= 0; w2--) { const [dr, dy, rel] = WALL[w2]; const y = rel ? hR + dy : dy; put(w + dr + (dr > 0 ? jagW(t * 40 + 9, y, sN + 1) : 0), y); }
        rows.push(row); }
      const n = rows[0].length / 3, base = G.p.length / 3; for (const r of rows) for (let k = 0; k < n; k++) { G.p.push(r[k * 3], r[k * 3 + 1], r[k * 3 + 2]); const c = colAt(r[k * 3], r[k * 3 + 1], k < CAP || k >= n - CAP); G.c.push(c[0], c[1], c[2]); }
      for (let v = 0; v < rows.length - 1; v++) for (let k = 0; k < n - 1; k++) { const a = base + v * n + k, bb = a + 1, c = a + n, d = bb + n; G.i.push(a, bb, c, bb, d, c); }
      const ns = Math.round((2 + L / 220) * K); for (let s = 0; s < ns; s++) { const t = 0.15 + rnd() * 0.7, cx = b[0] + vx * t, cy = b[1] + vy * t, off = (rnd() - 0.5) * b[4] * 0.4;
        spike(G, cx - uy * off, -150 - rnd() * 40, -(cy + ux * off), 10 + rnd() * 18, 50 + rnd() * 120, (rnd() - 0.5) * 0.3, (rnd() - 0.5) * 0.3, 6, rnd, colAt); }
      const nc = Math.round(4 * K); for (let s = 0; s < nc; s++) { const t = 0.12 + rnd() * 0.76, sg = rnd() < 0.5 ? 1 : -1, w = b[4] * 0.5 + 1.5, cx = b[0] + vx * t + uy * w * sg, cy = b[1] + vy * t - ux * w * sg; if (S.mapSd(sim, cx + uy * 30 * sg, cy - ux * 30 * sg) > -4) continue; crys.push([cx, -45 - rnd() * 40, cy, uy * sg, -ux * sg, 0]); } }
    return { geo: toGeo(G), crys };
  }

  // ---------- asteroides: camadas (perto das plataformas, fundo escuro lá embaixo, cinturão em volta do mapa); parte gira devagar na GPU ----------
  function rockInst(geo, list, mat) {
    const n = list.length, im = new THREE.InstancedMesh(geo, mat, Math.max(1, n)); const spin = new Float32Array(Math.max(1, n) * 4); const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), P = new THREE.Vector3(), Sc = new THREE.Vector3(), E = new THREE.Euler(), C = new THREE.Color();
    for (let i = 0; i < n; i++) { const r = list[i]; P.set(r[0], r[1], r[2]); E.set(r[4], r[5], r[6]); Q.setFromEuler(E); Sc.set(r[3] * r[7], r[3] * r[8], r[3] * r[9]); M.compose(P, Q, Sc); im.setMatrixAt(i, M);
      C.setRGB(r[10], r[11], r[12]); im.setColorAt(i, C); const ax = _v3.set(r[13], r[14], r[15]).normalize(); spin[i * 4] = ax.x; spin[i * 4 + 1] = ax.y; spin[i * 4 + 2] = ax.z; spin[i * 4 + 3] = r[16]; }
    im.count = n; geo.setAttribute('aSpin', new THREE.InstancedBufferAttribute(spin, 4)); im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; im.frustumCulled = false; return im;
  }
  function rockRec(rnd, x, y, z, rad, tint) { /* [x, y, z, raio, rx, ry, rz, sx, sy, sz, r, g, b, eixo xyz, velocidade] */
    const l = 0.8 + rnd() * 0.4, c = tint || [0.2, 0.19, 0.19]; const warm = rnd();
    return [x, y, z, rad, rnd() * TAU, rnd() * TAU, rnd() * TAU, 0.75 + rnd() * 0.5, 0.65 + rnd() * 0.45, 0.75 + rnd() * 0.5, c[0] * l * (0.9 + 0.2 * warm), c[1] * l, c[2] * l * (1.1 - 0.2 * warm), rnd() - 0.5, rnd() - 0.5, rnd() - 0.5, rnd() < 0.45 ? (0.015 + rnd() * 0.09) * (rnd() < 0.5 ? -1 : 1) : 0]; }
  function insideRoot(sim, x, y, h, pad) { /* aproximação do volume das raízes (cones) para não cruzar pedra com raiz */
    const m = sim.map; if (h > -40) return S.mapSd(sim, x, y) > -pad;
    for (const p of m.plats) { const D = p[2] > 400 ? 880 : 560, t = (-84 - h) / D; if (t > 1.08) continue; const R = (p[2] * 1.12 + 10) * Math.pow(Math.max(0.02, 1 - Math.min(1, t)), 0.72) + pad; if (Math.hypot(x - p[0], y - p[1]) < R) return true; }
    if (m.ring) { const d = Math.hypot(x - m.ring[0], y - m.ring[1]); if (h > -84 - 620 && d > m.ring[2] - pad - 20 && d < m.ring[3] + pad + 20) return true; }
    for (const b of m.bridges) { if (h < -84 - 300) continue; const vx = b[2] - b[0], vy = b[3] - b[1], L2 = vx * vx + vy * vy; let t = ((x - b[0]) * vx + (y - b[1]) * vy) / (L2 || 1); t = Math.max(0, Math.min(1, t)); if (Math.hypot(b[0] + vx * t - x, b[1] + vy * t - y) < b[4] * 0.6 + pad + 30) return true; }
    return false;
  }

  // ---------- redemoinho da Fenda e feixes de luz (aditivos, só cor: o alfa da camada fica como está) ----------
  function addBlend(m) { m.transparent = true; m.depthWrite = false; m.blending = THREE.CustomBlending; m.blendEquation = THREE.AddEquation; m.blendSrc = THREE.OneFactor; m.blendDst = THREE.OneFactor; m.blendSrcAlpha = THREE.ZeroFactor; m.blendDstAlpha = THREE.OneFactor; return m; }
  const VORTEX_FS = `uniform float uTime; uniform float uDir; uniform float uK; uniform vec3 uC1; uniform vec3 uC2; uniform vec3 uC3; varying vec2 vUv;
float h(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1.0, 0.0)), f.x), mix(h(i + vec2(0.0, 1.0)), h(i + vec2(1.0, 1.0)), f.x), f.y); }
float fb(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * n(p); p = p * 2.07 + vec2(3.1, 1.7); a *= 0.5; } return v; }
void main(){ vec2 p = vUv * 2.0 - 1.0; float r = length(p); if (r > 1.0) discard;
  float tw = uDir * (log(r + 0.03) * 1.9 - uTime * 0.05); float c = cos(tw), s = sin(tw); vec2 q = mat2(c, -s, s, c) * p;
  float arms = fb(q * 3.2 + 1.3); float fil = fb(q * 9.0 - 4.1); float sp = 0.5 + 0.5 * sin(atan(q.y, q.x) * 3.0 + fil * 3.0);
  float body = smoothstep(0.32, 0.8, arms * (0.75 + 0.5 * sp)) * smoothstep(1.0, 0.35, r) * smoothstep(0.0, 0.12, r);
  float lanes = smoothstep(0.45, 0.65, fil);
  vec3 col = mix(uC2, uC3, smoothstep(0.15, 0.9, r)) * body * (0.55 + 0.6 * lanes) * 1.4;
  col += uC1 * (exp(-r * r * 90.0) * 7.0 + exp(-r * 7.0) * 0.9) * (0.85 + 0.15 * sin(uTime * 1.7));
  gl_FragColor = vec4(col * uK, 0.0); }`;
  const SHAFT_FS = `uniform float uTime; uniform float uK; uniform vec3 uC; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
float h(float x){ return fract(sin(x * 127.1) * 43758.5453); } float n(float x){ float i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(h(i), h(i + 1.0), f); }
void main(){ float streak = n(vUv.x * 46.0) * 0.6 + n(vUv.x * 15.0 + uTime * 0.15) * 0.4; streak *= streak * 1.6; float rise = 0.55 + 0.45 * sin(vUv.y * 14.0 - uTime * 1.1 + vUv.x * 31.0);
  float edge = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 1.5); float fade = smoothstep(0.0, 0.1, vUv.y) * (1.0 - smoothstep(0.55, 1.0, vUv.y));
  float a = streak * rise * fade * (0.35 + 0.65 * edge) * uK; gl_FragColor = vec4(uC * a, 0.0); }`;
  function buildVortex(sim) {
    const cx = sim.map.ring ? sim.map.ring[0] : S.CX, cy = sim.map.ring ? sim.map.ring[1] : S.CY; const Y = -380; U.uCore.value.set(cx, Y + 40, -cy, 640); vortex = [];
    const mk = (y, rad, dir, k, c1, c2, c3) => { const mat = addBlend(new THREE.ShaderMaterial({ uniforms: { uTime: U.uTime, uDir: { value: dir }, uK: { value: k }, uC1: { value: new THREE.Color().fromArray(c1) }, uC2: { value: new THREE.Color().fromArray(c2) }, uC3: { value: new THREE.Color().fromArray(c3) } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }', fragmentShader: VORTEX_FS, side: THREE.DoubleSide })); mats.push(mat);
      const g = new THREE.PlaneGeometry(rad * 2, rad * 2); g.rotateX(-Math.PI / 2); geos.push(g); const me = new THREE.Mesh(g, mat); me.position.set(cx, y, -cy); me.renderOrder = 2; me.frustumCulled = false; space.add(me); vortex.push(me); };
    mk(Y, 380, 1, 1, [2.3, 1.15, 1.95], [0.7, 0.17, 0.6], [0.2, 0.05, 0.38]);
    mk(Y + 70, 330, -0.8, 0.35, [0.0, 0.0, 0.0], [0.6, 0.18, 0.75], [0.12, 0.05, 0.36]);
    const sm2 = addBlend(new THREE.ShaderMaterial({ uniforms: { uTime: U.uTime, uK: { value: 0.2 }, uC: { value: new THREE.Color(1.15, 0.38, 1.0) } }, side: THREE.DoubleSide,
      vertexShader: 'varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv = uv; vN = normalMatrix * normal; vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = -mv.xyz; gl_Position = projectionMatrix * mv; }', fragmentShader: SHAFT_FS })); mats.push(sm2);
    const sg = new THREE.CylinderGeometry(150, 250, 420, 40, 1, true); sg.translate(0, 210, 0); geos.push(sg); shafts = []; for (let i = 0; i < 3; i++) { const me = new THREE.Mesh(sg, sm2); me.position.set(cx, Y, -cy); me.scale.set(1 - i * 0.24, 1 + i * 0.12, 1 - i * 0.24); me.rotation.y = i * 1.7; me.renderOrder = 3; me.frustumCulled = false; space.add(me); shafts.push(me); }
  }

  // ---------- montagem ----------
  SP.build = function (sim, T) {
    SP.dispose(); SP.sim = sim; SP.T = T; if (!sim || !sim.map || sim.map.type !== 'cinturao') return;
    const t0 = performance.now(); tier = tierOf(); const K = tier === 'alta' ? 1 : tier === 'media' ? 0.75 : 0.5; const rnd = rng((sim.seed * 2654435761) ^ 0x5eed); U.uSeed.value = (sim.seed % 97) * 0.37;
    space = new THREE.Scene(); space.name = 'ard-espaco';
    /* luzes da camada: cópia do sol e do céu da cena (relidas a cada quadro) e um hemisfério de espaço: céu azul-escuro, baixo magenta (a Fenda) */
    const sun = new THREE.DirectionalLight(0xffffff, 1.5); const hemi = new THREE.HemisphereLight(0x262c38, 0x0e0c10, 0.6); const amb = new THREE.AmbientLight(0x1a2030, 0.3); space.add(sun, sun.target, hemi, amb); lights = { sun, hemi, amb };
    /* raízes, quilhas e estalactites */
    const tq = [performance.now()]; const R = buildRoots(sim, T, rnd, K); tq.push(performance.now()); const rootMat = rockMat({ vcol: true, raiz: true, nevoa: true, rough: 0.94, env: 0.3, fadeK: 1 }); const roots = new THREE.Mesh(R.geo, rootMat); roots.frustumCulled = false; space.add(roots);
    /* cristais pendurados sob as bordas (violeta; no anel de dentro, magenta da Fenda) */
    { const cg = new THREE.CylinderGeometry(1, 0.85, 0.7, 6, 1, true); cg.translate(0, -0.35, 0); const tip = new THREE.ConeGeometry(0.85, 0.3, 6); tip.rotateX(Math.PI); tip.translate(0, -0.85, 0); const top = new THREE.ConeGeometry(1, 0.3, 6); top.translate(0, 0.15, 0); const pos = []; for (const g of [cg, tip, top]) { const a = g.toNonIndexed().attributes.position.array; for (let i = 0; i < a.length; i++) pos.push(a[i]); g.dispose(); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); geos.push(g);
      const cm = rockMat({ color: 0xffffff, emissive: 0xffffff, emI: 1.1, rough: 0.3, env: 0.8, fadeK: 0.8, cristal: true, nevoa: true }); const list = []; const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), P = new THREE.Vector3(), Sc = new THREE.Vector3(), up = new THREE.Vector3(0, -1, 0), dir = new THREE.Vector3(), C = new THREE.Color();
      for (const c of R.crys) { const nn = 2 + Math.floor(rnd() * 3); for (let k = 0; k < nn; k++) list.push(c); }
      const im = new THREE.InstancedMesh(g, cm, Math.max(1, list.length)); let i = 0;
      for (const c of R.crys) { const nn = 2 + Math.floor(rnd() * 3); for (let k = 0; k < nn && i < list.length; k++, i++) { dir.set(c[3] * (0.35 + rnd() * 0.5), -1, -c[4] * (0.35 + rnd() * 0.5)).add(_v3.set(rnd() - 0.5, 0, rnd() - 0.5).multiplyScalar(0.6)).normalize(); Q.setFromUnitVectors(up, dir);
        const L = (c[5] ? 7 : 4.5) + rnd() * (c[5] ? 15 : 9); const wd = L * (0.17 + rnd() * 0.08); P.set(c[0] + (rnd() - 0.5) * 8, c[1] - rnd() * 4, -(c[2] + (rnd() - 0.5) * 8)); Sc.set(wd, L, wd); M.compose(P, Q, Sc); im.setMatrixAt(i, M);
        if (c[5]) C.setRGB(1.0, 0.26 + rnd() * 0.1, 0.72 + rnd() * 0.2); else C.setRGB(0.42 + rnd() * 0.18, 0.36 + rnd() * 0.16, 1.0); im.setColorAt(i, C); } }
      im.count = i; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; im.frustumCulled = false; space.add(im); SP.crystals = im; }
    /* asteroides */
    const rec = { near: [], big: [] }; const m = sim.map, cx0 = m.ring ? m.ring[0] : S.CX, cy0 = m.ring ? m.ring[1] : S.CY;
    { const nMid = Math.round(170 * K); let tries = 0; while (rec.near.length < nMid && tries++ < nMid * 30) { const a = rnd() * TAU, d = Math.sqrt(rnd()) * 2050, x = cx0 + Math.cos(a) * d, y = cy0 + Math.sin(a) * d, h = -120 - Math.pow(rnd(), 0.8) * 860; const rad = 5 + Math.pow(rnd(), 2.6) * 52; if (d < (m.ring ? m.ring[2] + 70 : 0)) continue; /* a coluna do abismo fica livre */
        if (insideRoot(sim, x, y, h, rad + 14)) continue; rec.near.push(rockRec(rnd, x, h, -y, rad, [0.155, 0.148, 0.15])); } }
    { const nDeep = Math.round(430 * K); for (let i = 0; i < nDeep; i++) { const a = rnd() * TAU, d = Math.pow(rnd(), 0.62) * 5400, h = -1120 - Math.pow(rnd(), 0.9) * 2500; if (d < 300 && h > -1900) continue; const rad = 22 + Math.pow(rnd(), 3) * 240;
        rec.near.push(rockRec(rnd, cx0 + Math.cos(a) * d, h, -(cy0 + Math.sin(a) * d), rad, [0.19, 0.19, 0.2])); } } /* fundo: de longe 80 faces bastam */
    { const nFar = Math.round(170 * K); for (let i = 0; i < nFar; i++) { const a = rnd() * TAU, d = 3300 + Math.pow(rnd(), 0.8) * 3900, h = (rnd() - 0.62) * 900 * (0.5 + rnd()); const rad = 60 + Math.pow(rnd(), 2.4) * 420;
        (rad > 180 && tier !== 'leve' ? rec.big : rec.near).push(rockRec(rnd, cx0 + Math.cos(a) * d, h, -(cy0 + Math.sin(a) * d), rad, [0.2, 0.2, 0.21])); } } /* só as grandes do cinturão de fora (aparecem perto do horizonte) têm 320 faces */
    const rm = rockMat({ inst: true, rough: 0.9, env: 0.3 }); const gS = new THREE.IcosahedronGeometry(1, 1), gB = new THREE.IcosahedronGeometry(1, 2); geos.push(gS, gB);
    SP.rocksS = rockInst(gS, rec.near, rm); SP.rocksB = rockInst(gB, rec.big, rm); space.add(SP.rocksS, SP.rocksB);
    tq.push(performance.now()); /* redemoinho da Fenda no fundo do abismo e feixes subindo */
    buildVortex(sim);
    /* pedras soltas perto dos paredões: na cena do jogo (passam na frente do paredão), balançando devagar */
    edges = edgePoints(sim); { const n = Math.round(120 * K), list = []; for (let i = 0; i < n * 3 && list.length < n; i++) { const k = Math.floor(rnd() * edges.n), off = 14 + Math.pow(rnd(), 1.6) * 70, x = edges.x[k] + edges.nx[k] * off, y = edges.y[k] + edges.ny[k] * off;
        if (S.mapSd(sim, x, y) > -10) continue; const inAb = m.ring && Math.hypot(x - m.ring[0], y - m.ring[1]) < m.ring[2]; if (inAb && rnd() < 0.6) continue; /* no abismo, poucas e miúdas */
        const rad = (2.2 + Math.pow(rnd(), 2.2) * 12) * (inAb ? 0.5 : 1), h = -14 - Math.pow(rnd(), 1.4) * 210; list.push(rockRec(rnd, x, h, -y, rad, [0.24, 0.22, 0.21])); }
      const nm = rockMat({ inst: true, balanco: true, nevoa: true, rough: 0.88, env: 0.4, fog: true, fadeK: 0.6 }); near = rockInst(new THREE.IcosahedronGeometry(1, 1), list, nm); geos.push(near.geometry); near.name = 'ard-espaco-pedras'; scene.add(near); }
    /* composição: quadro de tela cheia na profundidade do céu */
    rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, depthBuffer: true, samples: 0 }); rt.texture.colorSpace = THREE.NoColorSpace;
    const cmat = new THREE.ShaderMaterial({ uniforms: { tSpace: { value: rt.texture }, uOn: { value: 1 } }, transparent: true, depthTest: true, depthWrite: false, fog: false,
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
      vertexShader: 'uniform float uOn; varying vec2 vUv; void main(){ vUv = position.xy * 0.5 + 0.5; gl_Position = uOn > 0.5 ? vec4(position.xy, 1.0, 1.0) : vec4(2.0, 2.0, 2.0, 1.0); }',
      fragmentShader: 'uniform sampler2D tSpace; varying vec2 vUv; void main(){ vec4 c = texture2D(tSpace, vUv); gl_FragColor = c;\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}' }); mats.push(cmat);
    const cg = new THREE.PlaneGeometry(2, 2); geos.push(cg); comp = new THREE.Mesh(cg, cmat); comp.frustumCulled = false; comp.renderOrder = -999; comp.name = 'ard-espaco-quadro';
    comp.onBeforeRender = (r, s, cam) => { const on = cam === env.camera ? 1 : 0; if (cmat.uniforms.uOn.value !== on) { cmat.uniforms.uOn.value = on; cmat.uniformsNeedUpdate = true; } }; scene.add(comp);
    /* céu em modo espaço com o fundo assado */
    sky = scene.children.find(o => o.userData && o.userData.mat && o.userData.mat.uniforms && o.userData.mat.uniforms.uSpace) || null;
    if (sky && W3 && W3.spaceBackdrop && env.renderer) { try { backdrop = W3.spaceBackdrop(THREE, env.renderer, { size: tier === 'leve' ? 256 : 384, seed: (sim.seed % 31) * 0.53 }); const u = sky.userData.mat.uniforms; u.uSpace.value = 1; u.uNebula.value = backdrop.tex; u.uPlanet.value.copy(backdrop.planet); if (u.uPlanetL) u.uPlanetL.value.copy(backdrop.planetL); u.uSpaceK.value.set(1, 1, 0, 0); } catch (err) { console.warn('[ARD] fundo do espaço indisponível: ' + err.message); } }
    if (env.fogTex) U.uFogMap.value = env.fogTex; /* névoa de guerra do render3d (a mesma do terreno) */
    /* mapa da borda para o material do terreno */
    tq.push(performance.now()); try { voidTex = voidMap(sim); SP.refreshVoid(); } catch (err) { console.warn('[ARD] mapa da borda indisponível: ' + err.message); } tq.push(performance.now());
    SP.built = true; SP.stats = { ms: Math.round(performance.now() - t0), parts: tq.slice(1).map((v, i) => Math.round(v - tq[i])), tier, roots: R.geo.index.count / 3, crystals: SP.crystals.count, rocksS: SP.rocksS.count, rocksB: SP.rocksB.count, rocksTris: SP.rocksS.count * 80 + SP.rocksB.count * 320, near: near.count, edges: edges.n };
  };

  // ---------- quadro ----------
  function findMainLights() { mainL = { sun: null, hemi: null, amb: null }; for (const o of scene.children) { if (o.isDirectionalLight && !mainL.sun) mainL.sun = o; else if (o.isHemisphereLight && !mainL.hemi) mainL.hemi = o; else if (o.isAmbientLight && !mainL.amb) mainL.amb = o; } }
  SP.update = function (dt, time, camera) {
    if (!SP.built || !space) return; const vis = !SP.off; if (comp.visible !== vis) { comp.visible = vis; near.visible = vis; } if (!vis) return; /* SP.off: desliga a camada (diagnóstico e medida de custo) */
    frame++; const renderer = env.renderer; U.uTime.value = time;
    if (frame % 90 === 0 && tierOf() !== tier) { SP.build(SP.sim, SP.T); return; } /* a qualidade mudou: refaz na versão certa */
    if (frame % 60 === 1) SP.refreshVoid();
    const LS = env.light ? env.light() : null; const nt = LS ? LS.night || 0 : 0;
    /* luzes da camada seguem as da cena (dia e noite, clima) */
    if (!mainL || (!mainL.sun && frame % 120 === 0)) findMainLights();
    if (mainL.sun) { const s = mainL.sun; lights.sun.color.copy(s.color); lights.sun.intensity = s.intensity * 0.9; _v3.subVectors(s.position, s.target.position).normalize(); lights.sun.position.copy(_v3).multiplyScalar(1000); lights.sun.target.position.set(0, 0, 0); }
    lights.hemi.intensity = (mainL.hemi ? mainL.hemi.intensity : 0.5) * 0.9; lights.amb.intensity = (mainL.amb ? mainL.amb.intensity : 0.2) * 0.6;
    space.environment = scene.environment; space.environmentIntensity = scene.environmentIntensity == null ? 0.6 : scene.environmentIntensity; /* o render3d já baixa a intensidade à noite */
    U.uHaze.value.setRGB(0.006 - 0.003 * nt, 0.009 - 0.004 * nt, 0.022 - 0.008 * nt); U.uCoreC.value.w = 1.3 + 0.6 * nt;
    for (const v of vortex) v.material.uniforms.uK.value = (v === vortex[0] ? 1 : 0.35) * (1 + 0.3 * nt);
    if (sky) { const u = sky.userData.mat.uniforms; u.uSpace.value = backdrop ? 1 : 0; u.uSpaceK.value.x = 1 + 0.25 * nt; }
    /* névoa de espaço: a cor de fundo vira a bruma (o render3d lê scene.background depois daqui); sem pós-processamento vale a névoa linear */
    const bg = scene.background; if (bg && bg.isColor) bg.setRGB(0.008 - 0.004 * nt, 0.012 - 0.005 * nt, 0.03 - 0.01 * nt);
    if (scene.fog) { scene.fog.color.setRGB(0.008 - 0.004 * nt, 0.012 - 0.005 * nt, 0.03 - 0.01 * nt); }
    /* camada do espaço → alvo de render do tamanho da tela (metade na qualidade Baixa e no celular) */
    renderer.getDrawingBufferSize(_v); const sc = Math.min(tier === 'leve' ? 0.5 : 1, Math.sqrt(2.1e6 / Math.max(1, _v.x * _v.y))); const w = Math.max(4, Math.round(_v.x * sc)), h = Math.max(4, Math.round(_v.y * sc)); /* no máximo ~2,1 Mpx (1080p): telas 4K reamostram */
    if (rt.width !== w || rt.height !== h) rt.setSize(w, h);
    const prevRT = renderer.getRenderTarget(), prevAuto = renderer.autoClear, prevA = renderer.getClearAlpha(); renderer.getClearColor(_c);
    if (!spaceCam) spaceCam = new THREE.PerspectiveCamera(); spaceCam.position.copy(camera.position); spaceCam.quaternion.copy(camera.quaternion);
    if (spaceCam.fov !== camera.fov || spaceCam.aspect !== camera.aspect || spaceCam.near !== camera.near || spaceCam.zoom !== camera.zoom) { spaceCam.fov = camera.fov; spaceCam.aspect = camera.aspect; spaceCam.near = camera.near; spaceCam.zoom = camera.zoom; spaceCam.far = 24000; spaceCam.updateProjectionMatrix(); } spaceCam.updateMatrixWorld();
    renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.autoClear = false; renderer.clear(true, true, false); renderer.render(space, spaceCam);
    renderer.setRenderTarget(prevRT); renderer.setClearColor(_c, prevA); renderer.autoClear = prevAuto;
    emit(dt, camera);
  };
  /* poeira e cascalho caindo das bordas perto da câmera, faíscas da Fenda subindo pelo abismo (o FX copia os vetores na hora: reaproveita) */
  const _p3 = [0, 0, 0], _v3e = [0, 0, 0], C_DUST = [0.32, 0.29, 0.26], C_PEB = [0.2, 0.18, 0.17], C_MOTE = [1.5, 0.45, 1.15];
  const P3 = (a, b, c) => { _p3[0] = a; _p3[1] = b; _p3[2] = c; return _p3; }, V3 = (a, b, c) => { _v3e[0] = a; _v3e[1] = b; _v3e[2] = c; return _v3e; };
  function emit(dt, camera) {
    const FX = env.FX; if (!FX || !FX.emit || !edges || !edges.n || dt <= 0) return; const mult = FX.mult == null ? 1 : FX.mult; const G = SP.sim;
    const cx = camera.position.x, cz = camera.position.z; let tx = 0, ty = 0; { const e = camera.matrixWorld.elements; const fx = -e[8], fy = -e[9], fz = -e[10]; const tt = fy < -0.05 ? -camera.position.y / fy : 800; tx = cx + fx * tt; ty = -(cz + fz * tt); }
    const vr = Math.max(500, Math.min(2200, camera.position.y * 1.6)); const rnd = Math.random;
    const jump = emitT.tx == null || Math.hypot(tx - emitT.tx, ty - emitT.ty) > 700; emitT.tx = tx; emitT.ty = ty; let pre = 0;
    if (jump) { pre = 1; emitT.dust = 16 * 4.5 * mult; emitT.peb = 4 * 3 * mult; emitT.mote = 7 * 10 * mult; } else { emitT.dust += dt * 16 * mult; emitT.peb += dt * 4 * mult; emitT.mote += dt * 7 * mult; }
    const pick = () => { for (let k = 0; k < 7; k++) { const i = Math.floor(rnd() * edges.n); if (Math.abs(edges.x[i] - tx) < vr && Math.abs(edges.y[i] - ty) < vr) return i; } return -1; };
    while (emitT.dust >= 1) { emitT.dust -= 1; const i = pick(); if (i < 0) continue; const x = edges.x[i], y = edges.y[i], nx = edges.nx[i], ny = edges.ny[i], o = 2 + rnd() * 5;
      const lf = 3.5 + rnd() * 2, sp = 3 + rnd() * 7; FX.emit(FX.alp, P3(x + nx * o, -2 - rnd() * 10, -(y + ny * o)), V3(nx * sp, -4 - rnd() * 8, -ny * sp), lf, 3 + rnd() * 3, 12 + rnd() * 10, 3, C_DUST, 22, 1.6, (rnd() - 0.5) * 0.6, 0.32, -pre * rnd() * lf, -4); }
    while (emitT.peb >= 1) { emitT.peb -= 1; const i = pick(); if (i < 0) continue; const x = edges.x[i], y = edges.y[i], nx = edges.nx[i], ny = edges.ny[i];
      const sp = 6 + rnd() * 14, sz = 1.2 + rnd() * 1.8; FX.emit(FX.alp, P3(x + nx * 3, -3 - rnd() * 6, -(y + ny * 3)), V3(nx * sp, 4 + rnd() * 8, -ny * sp), 3.2, sz, sz, 5, C_PEB, 140, 1, (rnd() - 0.5) * 9, 1, -pre * rnd() * 3.2, 3000); }
    const ring = G && G.map && G.map.ring; if (ring) { const d = Math.hypot(ring[0] - tx, ring[1] - ty); if (d < vr * 1.4) while (emitT.mote >= 1) { emitT.mote -= 1; const a = rnd() * TAU, r = Math.sqrt(rnd()) * ring[2] * 0.7;
        const lf = 7 + rnd() * 4; FX.emit(FX.add, P3(ring[0] + Math.cos(a) * r, -230 + rnd() * 120, -(ring[1] + Math.sin(a) * r)), V3((rnd() - 0.5) * 6, 24 + rnd() * 20, (rnd() - 0.5) * 6), lf, 1.6 + rnd() * 1.6, 3 + rnd() * 2.5, 7, C_MOTE, -1.5, 2, 0, 1, -pre * rnd() * lf, 0); } else emitT.mote = 0; }
  }
  SP.dbg = () => ({ U, space, rt, lights, mats, spaceCam }); /* 4.3h: ganchos para as ferramentas de teste */
  SP.dispose = function () {
    if (near) { scene.remove(near); near = null; } if (comp) { scene.remove(comp); comp = null; } if (rt) { rt.dispose(); rt = null; } if (backdrop) { backdrop.rt.dispose(); backdrop = null; } if (voidTex) { voidTex.dispose(); voidTex = null; }
    if (sky) { const u = sky.userData.mat.uniforms; u.uSpace.value = 0; u.uNebula.value = null; sky = null; }
    for (const g of geos) g.dispose(); for (const m of mats) m.dispose(); geos = []; mats = []; space = null; vortex = []; shafts = null; lights = null; SP.built = false; U.uFogMap.value = U._white;
  };
  return SP;
}
ARD.space3d = { create };
})(globalThis.ARD = globalThis.ARD || {});
