/* Aether Rift: Dominion — mundo vestido (4.2d; 4.3c flora esculpida).
   Adereços espalhados por bioma, instanciados e determinísticos pela semente do mapa, escurecidos pela névoa de guerra como o terreno, com vento;
   e estradas de terra ligando cada Núcleo às próprias estruturas. Só visual: a simulação não muda.
   4.3c: geometrias do kit do meshes.js (capim, folhagem, samambaia, flores, cristais e arbustos de gelo, suculentas, tocos, respiros, fungos e
   árvores-marco), cor e rugosidade por vértice, brilho só nas peças emissivas fracas, composição em manchas com satélites (capim em volta da
   samambaia, cinza em volta do respiro...) e instâncias em blocos de 400×400 com recorte pela câmera; miúdos somem de longe. */
(function (ARD) {
'use strict';
const S = ARD.sim;
/* 4.3c: tipos por bioma: [tipo, quantidade por tile (×densidade), papel]. Papel 'v' = vegetação (mais nas manchas verdes), 'p' = pedra (mais fora delas) */
const BY_BIOME = {
  gelo: [['cristal', 0.3, 'v'], ['espinho', 0.24, 'v'], ['neve', 0.2, 'p'], ['geada', 0.22, 'p']],
  rocha: [['seco', 0.6, 'v'], ['suculenta', 0.3, 'v'], ['toco', 0.15, 'v'], ['cascalho', 0.12, 'p'], ['pebble', 0.14, 'p'], ['boulder', 0.1, 'p']], /* o chão novo já tem cascalho e placas: aqui vale mais a planta */
  tundra: [['capim', 1.8, 'v'], ['folhagem', 0.42, 'v'], ['samambaia', 0.38, 'v'], ['flor', 0.28, 'v'], ['liquen', 0.22, 'p']],
  basalto: [['respiro', 0.24, 'v'], ['cinza', 0.4, 'p'], ['obsidiana', 0.32, 'p'], ['fungo', 0.26, 'v'], ['cascalho', 0.15, 'p']],
};
/* satélites: [tipo, quantos (média), raio em unidades, escala relativa] em volta de cada peça do tipo: grupos em vez de peças soltas */
const COMP = { samambaia: [['capim', 2.2, 14, 0.85], ['samambaia', 0.5, 12, 0.7], ['flor', 0.3, 12, 0.85]], folhagem: [['capim', 1.6, 14, 0.85], ['folhagem', 0.5, 12, 0.7], ['flor', 0.4, 13, 0.9]],
  flor: [['flor', 1.0, 9, 0.75], ['capim', 0.5, 10, 0.8]], liquen: [['capim', 0.8, 10, 0.8], ['samambaia', 0.2, 11, 0.7]],
  suculenta: [['suculenta', 0.6, 10, 0.65], ['cascalho', 0.6, 10, 0.8], ['seco', 0.25, 12, 0.8]], toco: [['seco', 0.8, 12, 0.85], ['cascalho', 0.6, 10, 0.8], ['suculenta', 0.3, 11, 0.7]],
  seco: [['cascalho', 0.4, 9, 0.7], ['seco', 0.4, 10, 0.7]], boulder: [['cascalho', 1.0, 14, 0.9], ['suculenta', 0.25, 14, 0.7], ['seco', 0.3, 14, 0.8]], pebble: [['cascalho', 0.3, 8, 0.7]],
  cristal: [['cristal', 0.9, 11, 0.6], ['neve', 0.4, 12, 0.8]], espinho: [['espinho', 0.4, 10, 0.7], ['neve', 0.4, 10, 0.7]], geada: [['cristal', 0.25, 10, 0.5], ['neve', 0.3, 11, 0.7]],
  respiro: [['cinza', 1.8, 13, 0.75], ['obsidiana', 0.5, 13, 0.6], ['respiro', 0.3, 16, 0.6]], fungo: [['fungo', 1.6, 9, 0.6]], obsidiana: [['obsidiana', 0.5, 9, 0.6], ['cascalho', 0.4, 9, 0.7]] };
/* manchas por bioma: piso, limiar, largura e máximo da vegetação pela riqueza do tile — tundra em prados com chão nu entre eles; deserto ralo mas em toda parte */
const PATCH = { tundra: [0, 0.4, 0.25, 2.6], rocha: [0.6, 0.2, 0.5, 1.3], gelo: [0.15, 0.28, 0.4, 2.1], basalto: [0.25, 0.2, 0.45, 1.9] }; /* [piso, limiar, largura, máximo] */
const MARCO = { tundra: 'marco_tundra', rocha: 'marco_rocha', gelo: 'marco_gelo' }; /* árvores raras em grupos pequenos (projetam sombra) */
const MARCO_P = { tundra: 0.4, rocha: 0.2, gelo: 0.14 }; /* chance por célula de 192 unidades */
/* escala da instância [mín, máx] (geometria ~2 de largura): largura no mundo ≈ 2 × escala */
const SIZE = { capim: [4.2, 7.2], folhagem: [4.8, 8], samambaia: [5.2, 8.8], flor: [3.4, 5.4], liquen: [3, 6], cristal: [3.6, 7.5], espinho: [4, 7], neve: [3.4, 6.5], geada: [3, 6],
  seco: [4.4, 7.4], suculenta: [3.8, 6.4], toco: [4, 6.8], cascalho: [2.8, 5], pebble: [1.6, 3.8], boulder: [6, 11], respiro: [5, 9.5], cinza: [3.4, 6.4], obsidiana: [4, 7.5], fungo: [2.8, 5.2],
  marco_tundra: [7, 11.5], marco_rocha: [6.5, 10.5], marco_gelo: [6.5, 10] };
const VARS = { cristal: 2, suculenta: 2, toco: 2, marco_tundra: 2, marco_rocha: 2, marco_gelo: 2 }; /* variantes = blocos a mais: só onde a forma muda de verdade */
const MINI = new Set(['capim', 'cascalho', 'pebble', 'flor']); /* miúdos: caem mais rápido nas qualidades baixas e somem de longe */
const SHADOW = new Set(['marco_tundra', 'marco_rocha', 'marco_gelo']); /* sempre projetam sombra */
const SHADOW_HI = new Set(['folhagem', 'samambaia', 'cristal', 'suculenta', 'toco', 'boulder', 'respiro', 'fungo']); /* sombra só com densidade ≥ 1 (alta e ultra) e só onde ela lê (volumes; galhos finos e lascas não) */
/* variação de cor por instância: [claro/escuro, matiz A, matiz B] (multiplica a cor por vértice) */
const TINT = { capim: [0.14, [1.08, 1.0, 0.8], [0.88, 1.0, 0.95]], folhagem: [0.12, [1.1, 1.0, 0.72], [0.68, 0.95, 1.6]], samambaia: [0.12, [1.1, 1.0, 0.72], [0.7, 0.95, 1.55]], /* oliva a azul-esverdeado alienígena (poucos) */ flor: [0.1],
  seco: [0.12, [1.05, 0.98, 0.9], [0.95, 0.95, 1.0]], suculenta: [0.1, [1.0, 0.98, 1.04], [0.96, 1.04, 0.96]], cristal: [0.06, [0.98, 1.0, 1.03], [1.0, 1.0, 1.0]], liquen: [0.1], geada: [0.08], neve: [0.04],
  espinho: [0.08], toco: [0.1], respiro: [0.08], cinza: [0.1], obsidiana: [0.12], fungo: [0.1, [1.05, 0.95, 1.05], [0.95, 1.0, 1.06]], boulder: [0.1], pebble: [0.14], cascalho: [0.12], marco_tundra: [0.08, [1.05, 1.0, 0.9], [0.92, 1.0, 1.02]], marco_rocha: [0.08], marco_gelo: [0.05] };
/* albedo linear das pedras e do cascalho (geometria quase branca) por bioma */
const ROCK_COL = { gelo: [0.093, 0.122, 0.195], rocha: [0.26, 0.155, 0.095], tundra: [0.156, 0.144, 0.112], basalto: [0.027, 0.024, 0.03] }; /* 4.3c: quentes no deserto, azuladas no gelo, negras no basalto */
const CELL = 400; /* blocos de instâncias: um InstancedMesh por tipo/variante e por bloco, recortado pela câmera */
const MIN_BLOCK = 6; /* abaixo disto o grupo vai para o bloco maior */
/* distâncias da câmera até a caixa do bloco: além de FAR_* o bloco não é desenhado (miúdos, médios, grandes = árvores e matacões); além de LITE_D usa a geometria leve */
const FAR_MINI = 950, FAR_MID = 1800, FAR_ALL = 3300, LITE_D = 500, SHADOW_FAR = 700; /* sombra: até 700 (árvores e matacões até 1400) */
const BIG = new Set(['boulder', 'marco_tundra', 'marco_rocha', 'marco_gelo']);
function create(THREE, scene, opts) {
  opts = opts || {}; const D = { meshes: [], uTime: { value: 0 }, sig: '', roadSig: '' };
  const uni = { fogMap: { value: opts.fogTex }, worldSize: { value: S.WORLD }, uTime: D.uTime };
  /* 4.3c: material único dos adereços (cor, rugosidade/metal e brilho por vértice; vento por peça; névoa de guerra igual à do terreno).
     o.leaf: dupla face com a normal "de copa" do kit lida igual dos dois lados (folhas e lâminas) */
  function mat(o) {
    const m = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 1, metalness: 0, side: o.leaf ? THREE.DoubleSide : THREE.FrontSide });
    m.onBeforeCompile = sh => { Object.assign(sh.uniforms, uni);
      sh.vertexShader = 'uniform float worldSize; uniform float uTime; attribute vec2 rm; attribute float aWind; attribute float aGlow; varying vec2 vDRM; varying float vDGlow; varying vec2 vDWuv;\n' + sh.vertexShader
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvDRM = rm; vDGlow = aGlow;\n{ vec4 iw = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0); float k = aWind * max(0.0, position.y); float gx = sin(uTime * 1.7 + iw.x * 0.05 + iw.z * 0.03) * 0.09 + sin(uTime * 4.6 + position.x * 6.0 + iw.z * 0.21) * 0.022; float gz = cos(uTime * 1.3 + iw.z * 0.05) * 0.06 + cos(uTime * 4.1 + position.z * 6.0 + iw.x * 0.17) * 0.018; transformed.x += gx * k; transformed.z += gz * k; }')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n{ vec4 wp = modelMatrix * instanceMatrix * vec4(transformed, 1.0); vDWuv = vec2(wp.x / worldSize, -wp.z / worldSize); }');
      sh.fragmentShader = 'uniform sampler2D fogMap; varying vec2 vDWuv; varying vec2 vDRM; varying float vDGlow;\n' + sh.fragmentShader
        .replace('#include <color_fragment>', '#include <color_fragment>\nfloat dFog = texture2D(fogMap, vDWuv).r; vec3 dEm = diffuseColor.rgb * vDGlow; diffuseColor.rgb *= mix(0.06, 1.0, dFog) * (1.0 - vDGlow);')
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = vDRM.x;')
        .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = vDRM.y;')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += dEm; totalEmissiveRadiance *= dFog * dFog;');
      if (o.leaf) sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n#ifdef DOUBLE_SIDED\nnormal *= faceDirection;\n#endif'); /* desfaz a inversão do verso */
    };
    m.defaultAttributeValues = Object.assign({}, m.defaultAttributeValues, { rm: [0.9, 0], aWind: [0], aGlow: [0] }); /* geometria sem o atributo (recuo antigo) lê estes valores */
    m.customProgramCacheKey = () => 'ard-dress-43c-' + (o.leaf ? 'f' : 's'); return m;
  }
  const mats = opts.m5 ? { solido: opts.m5.adereco({}), folha: opts.m5.adereco({ leaf: true }) } : { solido: mat({}), folha: mat({ leaf: true }) }; /* 5.0a: no Motor 5, material TSL sem vento (o vento é da fase 2) */
  D.mats = mats; /* 4.2h: o render3d põe estes materiais na curva da noite */
  /* geometrias: uma por tipo e variante, do kit do meshes.js (4.3c); sem ele, formas simples de recuo */
  const SG = (kind, seed, lite) => { try { return (ARD.meshes && ARD.meshes.scatter && ARD.meshes.scatter(kind, seed, lite)) || null; } catch (e) { return null; } };
  const tint = (g, c) => { if (g.index) g = g.toNonIndexed(); const n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) a.set(c, i * 3); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); g.computeVertexNormals(); return g; };
  const FALL = { /* recuo (sem o kit): formas da 4.2d com cor fixa */
    cone: c => tint(new THREE.ConeGeometry(0.5, 1.6, 5).translate(0, 0.8, 0), c), ico: (c, sy) => tint(new THREE.IcosahedronGeometry(1, 0).scale(1, sy || 0.55, 0.85).translate(0, 0.25, 0), c) };
  const FCOL = { capim: [0.45, 0.55, 0.3], folhagem: [0.3, 0.42, 0.24], samambaia: [0.32, 0.45, 0.25], flor: [0.5, 0.4, 0.55], seco: [0.45, 0.35, 0.25], suculenta: [0.35, 0.48, 0.4], cristal: [0.85, 0.9, 0.95], espinho: [0.5, 0.55, 0.62], neve: [0.92, 0.95, 0.97], respiro: [0.14, 0.12, 0.12], cinza: [0.25, 0.23, 0.24], obsidiana: [0.06, 0.05, 0.07], fungo: [0.35, 0.28, 0.4], toco: [0.55, 0.5, 0.44] };
  const geo = {}, geoLite = {}, keys = {}; /* keys[tipo] = lista de chaves de geometria (tipo#variante); geoLite = versão leve (blocos longe da câmera) */
  for (const list of Object.values(BY_BIOME)) for (const [k] of list) keys[k] = keys[k] || [];
  for (const k of Object.values(MARCO)) keys[k] = [];
  const seedOf = (k, v) => k === 'pebble' ? 2 : k === 'boulder' ? 1 : v; /* a variante é a semente (as receitas trocam de forma por semente % 2); pedras: sementes da 4.3b */
  for (const k in keys) { const nv = VARS[k] || 1; for (let v = 0; v < nv; v++) { const key = k + '#' + v; let g = SG(k, seedOf(k, v));
      if (!g) g = FCOL[k] ? (/capim|samambaia|flor|cristal|espinho|fungo/.test(k) ? FALL.cone(FCOL[k]) : FALL.ico(FCOL[k])) : FALL.ico([0.62, 0.6, 0.58], k === 'boulder' ? 0.8 : 0.55);
      g.computeBoundingSphere(); geo[key] = g; keys[k].push(key); const gl = SG(k, seedOf(k, v), true); geoLite[key] = gl && gl.attributes.position.count < g.attributes.position.count ? gl : g; } }
  D.geo = geo; D.geoLite = geoLite;
  /* posições determinísticas por tile */
  function hash(a, b, c) { let n = (a * 374761393 + b * 668265263 + c * 1274126177) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); n ^= n >>> 16; return (n >>> 0) / 4294967296; }
  function vnoise(x, y, s) { const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy); const a = hash(ix, iy, s), b = hash(ix + 1, iy, s), c = hash(ix, iy + 1, s), d = hash(ix + 1, iy + 1, s); return (a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy; }
  D.pv = (tx, ty, seed) => vnoise(tx / 4.3, ty / 4.3, seed + 17) * 0.75 + vnoise(tx / 1.7, ty / 1.7, seed + 29) * 0.25; /* riqueza da mancha no tile (0..1) */
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0), _c = new THREE.Color();
  function compose(o, H, scale) { _p.set(o.x, o.gy, -o.y); _q.setFromAxisAngle(UP, o.a); const sc = scale == null ? o.sc : scale; _s.set(sc, sc * o.sy, sc); return _m.compose(_p, _q, _s); }
  D.build = function (sim, H, density, bioAt) { /* 4.3c: bioAt (do terrain3d) = pesos de bioma no ponto, pela borda orgânica desenhada no chão */
    const _bw = [0, 0, 0, 0];
    for (const m of D.meshes) { scene.remove(m.mesh); m.mesh.dispose(); } D.meshes = []; if (!density) return;
    const TILE = 64, TILES = S.WORLD / TILE, seed = sim.seed | 0, mini = density * Math.min(1, density); /* 4.3c: miúdos caem mais rápido nas qualidades média e baixa */
    const blockers = sim.ents.filter(e => e.alive && (e.kind === 'node' || e.kind === 'rock')).map(e => ({ x: e.x, y: e.y, r: e.r + (e.kind === 'node' ? 30 : 10) })); /* 4.2h: chão limpo em volta dos nós */
    const nucs = []; for (const p of sim.players) { const n = S.nucleoOf(sim, p.id); if (n) { blockers.push({ x: n.x, y: n.y, r: 110 }); nucs.push(n); } }
    const grid = new Map(), GC = 128; for (const b of blockers) { const r = Math.ceil(b.r / GC); const cx = (b.x / GC) | 0, cy = (b.y / GC) | 0; for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const k = (cx + dx) + (cy + dy) * 4096; (grid.get(k) || grid.set(k, []).get(k)).push(b); } }
    const RR = S.RIFT_R + 70, MAPX = !!(S.mapCell && sim.map && (sim.map.type === 'cinturao' || (sim.map.lakes && sim.map.lakes.length))), blocked = (x, y, pad) => { if (x < 4 || y < 4 || x > S.WORLD - 4 || y > S.WORLD - 4) return true; if (MAPX && (S.mapCell(sim, x, y) !== 1 || (sim.map.type === 'cinturao' && S.mapSd(sim, x, y) < 10 + pad))) return true; /* 4.3h: nada sobre o abismo nem nos lagos */ const fx = x - S.CX, fy = y - S.CY, fr = RR + pad; if (fx * fx + fy * fy < fr * fr) return true; const L = grid.get(((x / GC) | 0) + ((y / GC) | 0) * 4096); if (L) for (const o of L) { const dx = x - o.x, dy = y - o.y, rr = o.r + pad; if (dx * dx + dy * dy < rr * rr) return true; } return false; };
    const items = [];
    const ground = (x, y, rad) => { const r = rad * 0.7; return Math.min(H(x, y), H(x + r, y), H(x - r, y), H(x, y + r), H(x, y - r)); }; /* encosta: assenta pelo ponto mais baixo do pé */
    const add = (k, x, y, h1, h2, h3, sm, biome) => { const [s0, s1] = SIZE[k], sc = (s0 + (s1 - s0) * h1) * (sm || 1), ks = keys[k]; const key = ks[(((h3 * 9.73) % 1) * ks.length) | 0] || ks[0], rad = sc * 1.05;
      if (blocked(x, y, rad * 0.35)) return null; if (bioAt && biome) { bioAt(x, y, _bw); const bi = S.BIOMES.indexOf(biome), bt = _bw[0] + _bw[1] + _bw[2] + _bw[3] || 1; if (bi >= 0 && _bw[bi] / bt < 0.34) return null; } /* 4.3c: peça só onde o chão desenhado é do bioma dela */ const tj = TINT[k] || [0.1], L = tj[0], ca = tj[1] || [1, 1, 1], cb = tj[2] || [1, 1, 1], u = Math.pow((h2 * 7.31) % 1, 2.2), val = 1 - L + 2 * L * h2; /* matiz puxado para A: o B (alienígena) é minoria */
      const base = (k === 'cascalho' || k === 'pebble' || k === 'boulder') ? (ROCK_COL[biome] || ROCK_COL.rocha) : [1, 1, 1];
      const col = [0, 1, 2].map(i => (ca[i] + (cb[i] - ca[i]) * u) * val * base[i]); const o = { k: key, kind: k, x, y, a: h3 * 113.7 % (Math.PI * 2), sc, sy: SHADOW.has(k) ? 0.85 + 0.3 * h1 : 0.8 + 0.4 * ((h1 * 3.7) % 1), col, rad };
      o.gy = ground(x, y, Math.min(rad, 14)) - 0.04 * sc; items.push(o); return o; };
    for (let ty = 0; ty < TILES; ty++) for (let tx = 0; tx < TILES; tx++) {
      const ti = ty * TILES + tx; const mix = sim.biomeMix[ti]; const pv = D.pv(tx, ty, seed); /* manchas de vegetação */
      for (const [bi, share] of [[sim.biome[ti], 1 - mix], [sim.biome2[ti], mix]]) { if (share <= 0.001) continue; const biome = S.BIOMES[bi], list = BY_BIOME[biome]; if (!list) continue;
        const dr = Math.hypot((tx + 0.5) * TILE - S.CX, (ty + 0.5) * TILE - S.CY);
        const pp = PATCH[biome]; list.forEach(([k, w, role], ki) => { const dens = MINI.has(k) ? mini : density, pk = role === 'v' ? pp[0] + (pp[3] - pp[0]) * Math.pow(Math.max(0, Math.min(1, (pv - pp[1]) / pp[2])), 1.5) : 0.45 + Math.max(0, Math.min(1, (0.6 - pv) / 0.25)); /* vegetação em manchas, pedras no chão nu */ const E = w * dens * share * pk * (k === 'fungo' ? (dr < 430 ? 1.6 : 0.35) : 1); /* fungos junto da Fenda */ let n = Math.floor(E); if (hash(tx, ty, seed + ki * 41 + bi * 7 + 3) < E - n) n++;
          for (let j = 0; j < n; j++) { const sd = seed + ki * 97 + bi * 389 + j * 13; const x = (tx + hash(tx, ty, sd + 1)) * TILE, y = (ty + hash(tx, ty, sd + 2)) * TILE; const o = add(k, x, y, hash(tx, ty, sd + 4), hash(tx, ty, sd + 8), hash(tx, ty, sd + 6), 1, biome); if (!o) continue;
            const comp = COMP[k]; if (comp) comp.forEach(([ck, cn, cr, cs], ci) => { const cdens = MINI.has(ck) ? mini : density; const cE = cn * Math.min(1.2, cdens); let m = Math.floor(cE); if (hash(tx, ty, sd + 50 + ci) < cE - m) m++;
              for (let q = 0; q < m; q++) { const h = hash(tx, ty, sd + 60 + ci * 11 + q * 3), ang = h * Math.PI * 2 + q * 2.4, d = cr * (0.55 + 0.45 * hash(tx, ty, sd + 61 + ci * 11 + q * 3)) * (o.sc / ((SIZE[k][0] + SIZE[k][1]) / 2)); add(ck, x + Math.cos(ang) * d, y + Math.sin(ang) * d, hash(tx, ty, sd + 62 + ci * 11 + q * 3) * 0.7, hash(tx, ty, sd + 63 + ci * 11 + q * 3), hash(tx, ty, sd + 64 + ci * 11 + q * 3), cs, biome); } }); } }); } }
    /* marcos: árvores grandes, raras, em grupos de 1 a 3, longe das bases, nós, cordilheiras e da Fenda */
    const MC = 192, MN = Math.ceil(S.WORLD / MC), md = Math.min(1, density);
    for (let gy = 0; gy < MN; gy++) for (let gx = 0; gx < MN; gx++) { const cx = (gx + 0.2 + 0.6 * hash(gx, gy, seed + 701)) * MC, cy = (gy + 0.2 + 0.6 * hash(gx, gy, seed + 702)) * MC; const ti = Math.min(TILES - 1, (cy / TILE) | 0) * TILES + Math.min(TILES - 1, (cx / TILE) | 0);
      if (sim.biomeMix[ti] > 0.3) continue; const biome = S.BIOMES[sim.biome[ti]], k = MARCO[biome]; if (!k || hash(gx, gy, seed + 703) > MARCO_P[biome] * md) continue;
      if (nucs.some(n => Math.hypot(cx - n.x, cy - n.y) < 300) || blocked(cx, cy, 45) || Math.hypot(cx - S.CX, cy - S.CY) < 700 || (sim.props || []).some(pr => Math.hypot(cx - pr.x, cy - pr.y) < 40 + 17 * pr.scale)) continue;
      const nt = 1 + (hash(gx, gy, seed + 704) * 2.6 | 0); for (let i = 0; i < nt; i++) { const a = hash(gx, gy, seed + 710 + i) * Math.PI * 2, d = i ? 22 + hash(gx, gy, seed + 720 + i) * 16 : 0, x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d;
        if (Math.abs(H(x + 8, y) - H(x - 8, y)) + Math.abs(H(x, y + 8) - H(x, y - 8)) > 7) continue; /* só em chão quase plano */ add(k, x, y, i ? 0.25 * hash(gx, gy, seed + 730 + i) : 0.4 + 0.6 * hash(gx, gy, seed + 730), hash(gx, gy, seed + 740 + i), hash(gx, gy, seed + 750 + i), 1, biome); } }
    /* blocos: um InstancedMesh por chave (tipo#variante) e por célula de 400×400 */
    /* grupos com poucas peças (tipo raro ou borda de bioma) sobem para blocos de 800: menos desenhos quase vazios */
    let pend = items; const groups = new Map();
    for (const cs of [CELL, CELL * 2]) { const gm = new Map(); for (const o of pend) { const gk = o.k + '|' + cs + ':' + ((o.x / cs) | 0) + ',' + ((o.y / cs) | 0); (gm.get(gk) || gm.set(gk, []).get(gk)).push(o); }
      pend = []; for (const [gk, L] of gm) { if (L.length >= MIN_BLOCK || cs === CELL * 2) groups.set(gk, L); else pend.push(...L); } }
    const hi = density >= 1;
    for (const [gk, L] of groups) { const key = gk.split('|')[0], kind = L[0].kind, g = geo[key]; const im = new THREE.InstancedMesh(g, g.userData.leafy ? mats.folha : mats.solido, L.length);
      let maxS = 0; L.forEach((o, i) => { im.setMatrixAt(i, compose(o)); _c.setRGB(o.col[0], o.col[1], o.col[2]); im.setColorAt(i, _c); maxS = Math.max(maxS, o.sc); });
      im.computeBoundingSphere(); im.boundingSphere.radius += 2 + maxS * 0.4; /* folga para o vento */ im.frustumCulled = true; im.receiveShadow = !(g.userData.leafy && !SHADOW.has(kind)); /* folhagem pequena projeta no chão mas não recebe a própria sombra (ficava quase preta); árvores recebem */ im.castShadow = SHADOW.has(kind) || (hi && SHADOW_HI.has(kind));
      const s0 = SIZE[kind][0], s1 = SIZE[kind][1]; im.userData = { kind, key, list: L, s0, s1 }; scene.add(im);
      const box = new THREE.Box3(); for (const o of L) { const m = o.sc * 1.2 + 4; box.expandByPoint(_p.set(o.x - m, o.gy - 2, -o.y - m)); box.expandByPoint(_p.set(o.x + m, o.gy + o.sc * o.sy * 2.6 + 2, -o.y + m)); }
      if (im.castShadow) { box.min.x -= 30; box.min.z -= 30; box.max.x += 30; box.max.z += 30; } /* sombra de quem está logo fora da tela ainda entra nela */
      D.meshes.push({ mesh: im, kind, list: L, box, far: MINI.has(kind) ? FAR_MINI : BIG.has(kind) ? FAR_ALL : FAR_MID, gF: g, gL: geoLite[key] || g, cast: im.castShadow, big: BIG.has(kind) }); }
    D.count = items.length; D.sig = '';
  };
  /* 4.3c: recorte por distância (miúdos de longe não aparecem; o resto além da bruma), antes de cada desenho da cena */
  /* a esfera de um bloco chato de 400×400 tem ±290 de altura e cruza a pirâmide da câmera abaixo do chão, longe do que aparece; a caixa do bloco
     (com folga para sombra e vento) recorta de verdade. O three ainda testa a esfera em cada passe (inclusive o da sombra) */
  const _fr = new THREE.Frustum(), _pv = new THREE.Matrix4();
  D.cull = function (cam) { const p = cam.position; _fr.setFromProjectionMatrix(_pv.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    for (const b of D.meshes) { const d = b.box.distanceToPoint(p); /* distância até a caixa do bloco */
      b.mesh.visible = d < b.far && _fr.intersectsBox(b.box); if (!b.mesh.visible) continue; const g = d > LITE_D ? b.gL : b.gF; if (b.mesh.geometry !== g) b.mesh.geometry = g;
      b.mesh.castShadow = b.cast && d < (b.big ? SHADOW_FAR * 2 : SHADOW_FAR); } }; /* longe: versão leve da geometria; sombra só perto (a de longe mal aparece e custa um desenho a mais por bloco) */
  const prevBR = scene.onBeforeRender; scene.onBeforeRender = function (r, sc, cam, rt) { if (prevBR) prevBR.call(this, r, sc, cam, rt); if (cam && cam.isPerspectiveCamera && D.meshes.length) D.cull(cam); };
  /* esconde adereços que ficaram debaixo de estruturas (chamado quando o conjunto de estruturas muda); escondido = escala zero no mesmo lugar (a esfera do bloco continua valendo) */
  D.hideUnder = function (sim, H) {
    const bs = sim.ents.filter(e => e.alive && e.kind === 'building'); const sig = bs.length + ':' + (bs.length ? bs[bs.length - 1].id : 0); if (sig === D.sig) return; D.sig = sig;
    const cell = 128, grid = new Map(); for (const b of bs) { const k = ((b.x / cell) | 0) + ',' + ((b.y / cell) | 0); (grid.get(k) || grid.set(k, []).get(k)).push(b); }
    for (const m of D.meshes) { const im = m.mesh; let changed = false;
      m.list.forEach((o, i) => { let hide = false; const cx = (o.x / cell) | 0, cy = (o.y / cell) | 0, pad = 6 + Math.min(30, o.rad * 0.45); for (let dy = -1; dy <= 1 && !hide; dy++) for (let dx = -1; dx <= 1 && !hide; dx++) { const L = grid.get((cx + dx) + ',' + (cy + dy)); if (L) for (const b of L) if (Math.hypot(o.x - b.x, o.y - b.y) < b.r + pad) { hide = true; break; } }
        if (hide !== !!o.hid) { o.hid = hide; changed = true; im.setMatrixAt(i, compose(o, H, hide ? 0 : null)); } });
      if (changed) im.instanceMatrix.needsUpdate = true; }
  };
  /* estradas de terra: do Núcleo até cada estrutura pronta dentro do território (pedaços curtos que acompanham o relevo) */
  const roadGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const roadMat = opts.m5 ? opts.m5.estrada() /* 5.0a: estrada em TSL */ : new THREE.ShaderMaterial({ uniforms: { fogMap: uni.fogMap, worldSize: uni.worldSize }, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2,
    vertexShader: 'uniform float worldSize; varying vec2 vUv; varying vec2 vW; void main(){ vUv = uv; vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0); vW = vec2(wp.x / worldSize, -wp.z / worldSize); gl_Position = projectionMatrix * viewMatrix * wp; }',
    fragmentShader: 'uniform sampler2D fogMap; varying vec2 vUv; varying vec2 vW; float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); } float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); } void main(){ float side = abs(vUv.x - 0.5) * 2.0; float nz = n(vW * 900.0); float edge = 1.0 - smoothstep(0.55 + nz * 0.25, 1.0, side); float rut = smoothstep(0.08, 0.0, abs(side - 0.45)) * 0.18; vec3 col = mix(vec3(0.33, 0.29, 0.24), vec3(0.42, 0.37, 0.3), nz) * (1.0 - rut); float fl = texture2D(fogMap, vW).r; gl_FragColor = vec4(col * mix(0.06, 1.0, fl), edge * 0.62); }' });
  const roads = new THREE.InstancedMesh(roadGeo, roadMat, 2048); roads.count = 0; roads.frustumCulled = false; roads.renderOrder = 2; scene.add(roads); D.roads = roads;
  D.updateRoads = function (sim, H, vis) {
    const bs = sim.ents.filter(e => e.alive && e.kind === 'building' && e.built && e.def !== 'muro' && e.def !== 'portao' && e.def !== 'nucleo');
    const sig = bs.length + ':' + bs.reduce((s, b) => (s + b.id * 7) % 1000003, 0); if (sig === D.roadSig) return; D.roadSig = sig;
    let n = 0;
    for (const p of sim.players) { const nu = S.nucleoOf(sim, p.id); if (!nu) continue; const terr = S.territoryOf(sim, nu);
      for (const b of bs) { if (b.owner !== p.id) continue; const d = Math.hypot(b.x - nu.x, b.y - nu.y); if (d > terr || d < nu.r + b.r + 8) continue;
        const ang = Math.atan2(b.y - nu.y, b.x - nu.x); const x0 = nu.x + Math.cos(ang) * (nu.r + 4), y0 = nu.y + Math.sin(ang) * (nu.r + 4), x1 = b.x - Math.cos(ang) * (b.r + 2), y1 = b.y - Math.sin(ang) * (b.r + 2); const L = Math.hypot(x1 - x0, y1 - y0); const pieces = Math.max(1, Math.ceil(L / 36));
        for (let i = 0; i < pieces && n < 2048; i++) { const f = (i + 0.5) / pieces; const px = x0 + (x1 - x0) * f, py = y0 + (y1 - y0) * f; _p.set(px, H(px, py) + 0.35, -py); _q.setFromAxisAngle(UP, ang + Math.PI / 2); _s.set(11, 1, L / pieces + 2); _m.compose(_p, _q, _s); roads.setMatrixAt(n++, _m); } } }
    roads.count = n; roads.instanceMatrix.needsUpdate = true;
  };
  D.update = function (time, cam) { D.uTime.value = time; if (cam && cam.isPerspectiveCamera && D.meshes.length) D.cull(cam); }; /* 4.3c: o render3d pode passar a câmera (o gancho da cena continua valendo) */
  return D;
}
ARD.dress3d = { create, BY_BIOME, SIZE }; /* 4.3c: tabelas expostas para o laboratório e para medir */
})(globalThis.ARD = globalThis.ARD || {});
