/* Aether Rift: Dominion — Sala de Comando (5.0b): o mundo do diorama. Os cinco mundos natais (céu, hora, chão, flora e partículas
   próprias), o relevo do diorama, os planetas só em shader (sem textura: nítidos em qualquer tela), a Fenda (cratera, coração orgânico,
   calor que refrata a cena, rasgo no céu e partículas fluidas num compute shader) e a base da Raça com os modelos do jogo (src/meshes.js)
   em material TSL. Tudo procedural; nada aqui toca a simulação. Usado por src/m5/sala.js (C = contexto da Sala). */
(function (ARD) {
'use strict';
/* mundos natais (nomes aprovados): hora e céu (elevação e azimute do sol em graus, SkyMesh), chão (cores e rugosidade), brilho do chão,
   flora (receitas neutras do meshes.js), partículas do ar e a fala do líder ao chegar */
const MUNDOS = {
  vehnar: { lider: 'Barão-Forja', nome: 'Kessari', tip: 'mundo-forja das fundições', ceu: { elev: 6.5, az: 214, turb: 9.5, ray: 1.4, mie: 0.007, g: 0.86, nuv: 0.46, den: 0.6, ganho: 0.075, tinta: [1.0, 0.84, 0.7] }, hemi: [0xffb27a, 0x2a1a12, 0.3],
    chao: [0x3b2c24, 0x77553a, 0x1a1411], rocha: 0x4b403b, brilho: 0xff5a14, rug: 0.93, relevo: { amp: 13, f: 0.011, crista: 64 }, flora: ['obsidiana', 'respiro', 'cinza', 'boulder', 'respiro'], ar: 'brasa', nevoa: [0x3a2418, 260, 1500],
    fala: 'Barão-Forja na linha. As fornalhas de Kessari estão acesas, comandante.' },
  erevane: { lider: 'Vesper Ísk', nome: 'Ísk', tip: 'arquipélago das refinarias', ceu: { elev: 1.2, az: 200, turb: 3.2, ray: 2.6, mie: 0.004, g: 0.8, nuv: 0.32, den: 0.42, ganho: 0.14, tinta: [0.78, 0.92, 1.0] }, hemi: [0x9fd0ff, 0x10202c, 0.34],
    chao: [0x8a99a6, 0xd4e2ea, 0x3b4a56], rocha: 0x37434e, brilho: 0x33ffd0, rug: 0.32, relevo: { amp: 5, f: 0.009, crista: 52 }, flora: ['geada', 'cristal', 'boulder', 'geada'], ar: 'neve', nevoa: [0x1c2a38, 300, 1700],
    fala: 'Vesper Ísk. Ninguém nos vê chegar. Ninguém nos vê partir.' },
  tessara: { lider: 'Sylva Oriel', nome: 'Oriel', tip: 'estufas e jardins vivos', ceu: { elev: 11, az: 228, turb: 6, ray: 2.0, mie: 0.006, g: 0.8, nuv: 0.5, den: 0.5, ganho: 0.12, tinta: [0.86, 1.0, 0.86] }, hemi: [0xbaffc8, 0x14260f, 0.32],
    chao: [0x2f4a26, 0x5c7a3a, 0x1c2a17], rocha: 0x4a5040, brilho: 0x7bff9a, rug: 0.88, relevo: { amp: 11, f: 0.013, crista: 58 }, flora: ['folhagem', 'samambaia', 'flor', 'fungo', 'folhagem'], ar: 'esporo', nevoa: [0x1f3324, 240, 1500],
    fala: 'Sylva Oriel. Oriel cresce. E quem resiste vira adubo.' },
  quorith: { lider: 'Zayin Coral', nome: 'Quor', tip: 'cavernas de cristal ressonante', ceu: { elev: -2.5, az: 208, turb: 2.4, ray: 3.2, mie: 0.003, g: 0.76, nuv: 0.26, den: 0.36, ganho: 0.2, tinta: [0.9, 0.8, 1.0] }, hemi: [0xb79cff, 0x140f24, 0.42],
    chao: [0x2a2340, 0x5a4a86, 0x15111f], rocha: 0x3b3456, brilho: 0xc08cff, rug: 0.55, relevo: { amp: 9, f: 0.012, crista: 70 }, flora: ['cristal', 'marco_rocha', 'cristal', 'boulder'], ar: 'cristal', nevoa: [0x1a1430, 260, 1600],
    fala: 'Zayin Coral. O Coro canta em uma só voz. Afine-se, comandante.' },
  vorag: { lider: 'Oru Voraz', nome: 'Velk', tip: 'ninhos sob a crosta', ceu: { elev: 4, az: 222, turb: 11, ray: 1.1, mie: 0.009, g: 0.88, nuv: 0.52, den: 0.62, ganho: 0.11, tinta: [1.0, 0.74, 0.7] }, hemi: [0xff8a7a, 0x260c0e, 0.3],
    chao: [0x3a1a1c, 0x6a2e2c, 0x1c0b0c], rocha: 0x4a2a2a, brilho: 0xff3a4a, rug: 0.62, relevo: { amp: 12, f: 0.014, crista: 60 }, flora: ['fungo', 'espinho', 'seco', 'fungo'], ar: 'esporo-vermelho', nevoa: [0x2a1012, 240, 1450],
    fala: 'Oru Voraz. A fome de Velk não tem fim.' },
};
const RACES = ['vehnar', 'erevane', 'tessara', 'quorith', 'vorag'];
/* cores dos planetas (as mesmas paletas do world3d.PLANETS: escuro → claro) e o que cada um tem */
const PLANETAS = {
  vehnar: { pl: [0x1a120c, 0x5a3a22, 0xa06a3a, 0xe6b070], atmo: 0xff9a4a, noite: 0xff6a1a, anel: 0xc8a27a },
  erevane: { pl: [0x070c14, 0x14283a, 0x2f5a78, 0x9fd8f0], atmo: 0x5ae8ff, noite: 0x33ffd0 },
  tessara: { pl: [0x0a1a10, 0x1f4a2e, 0x3f9a5e, 0xc8f0a0], atmo: 0x8affb0, noite: 0x7bff9a },
  quorith: { pl: [0x0e0a1c, 0x2a2140, 0x6a50b0, 0xe0d0ff], atmo: 0xc8a8ff, noite: 0xb07cff, anel: 0xb8a8e8 },
  vorag: { pl: [0x140608, 0x3b1420, 0x8e2a3a, 0xffb090], atmo: 0xff6a7c, noite: 0xff2a3a },
};
/* ---------- relevo (CPU, determinístico) ---------- */
const hh = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
const vn = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf); const a = hh(xi, yi), b = hh(xi + 1, yi), c = hh(xi, yi + 1), d = hh(xi + 1, yi + 1); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; };
const fbm = (x, y) => { let s = 0, a = 0.5, f = 1; for (let i = 0; i < 5; i++) { s += a * vn(x * f, y * f); f *= 2.03; a *= 0.5; } return s; };
const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
/* a Fenda fica ao fundo, à direita da base (a câmera em repouso olha para −Z) */
const FENDA = { x: 120, z: -560, r: 48 };
/* canteiros da base: [def, x, z, giro]; o Núcleo no centro; a mesa tática fica à frente (sala-mesa.js) */
const PADS = [['nucleo', 0, 0, 0.2], ['reator', -54, -46, 0.6], ['refinaria', 58, -40, -0.5], ['quartel', -108, -12, 1.15], ['fabrica', -92, -92, 0.75], ['hangar', 100, -6, -1.1], ['laboratorio', 16, -96, 0.1], ['torre', -96, 50, 0.35], ['torre', 74, 46, -0.4], ['reator', -18, -76, 0.9]];
function relevo(race) { const k = (MUNDOS[race] || MUNDOS.vehnar).relevo, sx = RACES.indexOf(race) * 13.7 + 3.1;
  const base = (x, z) => { const rB = Math.hypot(x, z * 0.8); let h = (fbm(x * k.f + sx, z * k.f + 7.7) - 0.5) * k.amp * (0.25 + 0.75 * ss(70, 170, rB));
    const dR = Math.hypot(x - FENDA.x, z - FENDA.z); h += ss(300, 520, Math.hypot(x - 40, z + 120)) * ss(FENDA.r + 50, FENDA.r + 170, dR) * ss(460, 320, z) * k.crista * (0.55 + 0.9 * fbm(x * 0.006 + sx, z * 0.006 + 1.3)); /* cristas no horizonte (abertas em volta da Fenda; nenhuma atrás da câmera, no chão que vai até z = 700) */ h -= 34 * ss(FENDA.r + 40, FENDA.r - 4, dR); h += 7 * Math.exp(-(((dR - FENDA.r - 20) / 11) ** 2)); /* cratera da Fenda com borda */
    return h; };
  const pads = PADS.map(p => [p[1], p[2], p[0] === 'nucleo' ? 34 : 18, base(p[1], p[2])]); pads.push([-50, 20, 22, base(-50, 20)]); /* pedestal da mesa tática */
  return (x, z) => { let h = base(x, z); for (const p of pads) { const k2 = ss(p[2] + 14, p[2] + 2, Math.hypot(x - p[0], z - p[1])); h += (p[3] - h) * k2; } return h; }; }
/* ---------- terreno ---------- */
function terreno(C, race, H) { const { W, T } = C.L; const M = MUNDOS[race] || MUNDOS.vehnar; const seg = C.leve ? 150 : 240;
  const g = new W.PlaneGeometry(1200, 1500, seg, Math.round(seg * 1.36)); g.rotateX(-Math.PI / 2); g.translate(60, 0, -50); /* 5.0a.1: o chão vai até z = 700 (antes 300): no celular em pé a câmera da Quorith (busto alto, câmera mais longe) ficava além da borda e o pôster mostrava o vazio embaixo */
  const a = g.attributes.position; for (let i = 0; i < a.count; i++) a.setY(i, H(a.getX(i), a.getZ(i))); g.computeVertexNormals();
  const m = terrenoMat(C); const mesh = new W.Mesh(g, m); mesh.receiveShadow = true; mesh.name = 'terreno'; return mesh; }
/* 5.0a.1: UM material de chão para os cinco mundos (cores, veios e pulso por uniform): o código do shader é o mesmo em todas as Raças,
   então a troca de Raça não compila outro pipeline (antes eram cinco chãos, cada um com o seu programa) */
const VEIO = { vehnar: [0.02, 0.012, 0, 1.5], erevane: [0.01, 0.012, 0, 0.45], tessara: [0.016, 0.012, 0, 0.7], quorith: [0.014, 0.02, 0, 1.1], vorag: [0.018, 0.012, 0.05, 1.1] }; /* largura, frequência, tempo e força dos veios */
const PULSO = { vehnar: [0.9, 0, 0.04, 0.2, 0.9], vorag: [1.7, 0.05, 0, 0.35, 0.75] }; /* tempo, x, z, amplitude e base do pulso dos veios (os outros mundos: 0.85 fixo) */
function terrenoMat(C) { if (C.chaoMat) return C.chaoMat; const { W, T } = C.L; const m = new W.MeshStandardNodeMaterial(); m.userData.compartilhado = true;
  const { float, vec3, color, mix, smoothstep, abs, sin, length, uniform, positionWorld: pw, normalWorld: nw, time, mx_noise_float, mx_fractal_noise_float } = T;
  const U = C.U.chao = { c0: uniform(new W.Color()), c1: uniform(new W.Color()), c2: uniform(new W.Color()), rocha: uniform(new W.Color()), brilho: uniform(new W.Color()), rug: uniform(0.9), rug2: uniform(1), larg: uniform(0.015), vf: uniform(0.012), vt: uniform(0), kv: uniform(1), pa: uniform(0), px: uniform(0), pz: uniform(0), pamp: uniform(0), poff: uniform(0.85) };
  const slope = float(1).sub(nw.y), det = mx_fractal_noise_float(pw.xz.mul(0.03), 4, 2.0, 0.5), grain = mx_noise_float(vec3(pw.xz.mul(0.9), 0));
  let c = mix(U.c0, U.c1, smoothstep(-0.45, 0.55, det));
  c = mix(c, U.rocha, smoothstep(0.2, 0.46, slope.add(det.mul(0.08))));
  const fundo = smoothstep(-4.0, -26.0, pw.y); c = mix(c, U.c2, fundo.mul(0.85)); /* a cratera escurece para o fundo */
  m.colorNode = c.mul(det.mul(0.16).add(0.94)).mul(grain.mul(0.07).add(1));
  m.roughnessNode = mix(U.rug, U.rug2, smoothstep(0.2, 0.5, slope));
  const longe = smoothstep(95.0, 150.0, length(pw.xz)); /* nada de brilho embaixo da base */
  const zona = smoothstep(0.1, 0.42, mx_fractal_noise_float(vec3(pw.xz.mul(0.0045), 1.7), 2, 2.0, 0.5));
  const veio = float(1).sub(smoothstep(0.0, U.larg, abs(mx_noise_float(vec3(pw.xz.mul(U.vf), time.mul(U.vt)))))).mul(longe).mul(zona).mul(float(1).sub(smoothstep(0.22, 0.45, slope)));
  const pulso = sin(time.mul(U.pa).add(pw.x.mul(U.px)).add(pw.z.mul(U.pz))).mul(U.pamp).add(U.poff);
  const fendaGlow = color(0xd94bd0).mul(smoothstep(-10.0, -30.0, pw.y)).mul(sin(time.mul(1.3)).mul(0.25).add(0.9)).mul(2.0);
  m.emissiveNode = U.brilho.mul(veio).mul(pulso).mul(U.kv).add(fendaGlow);
  if (C.luzMundo) m.lightsNode = C.luzMundo; C.chaoMat = m; return m; }
/* os valores do chão de um mundo (chamado na troca: o chão novo e o velho dividem o material) */
function chaoDe(C, race) { terrenoMat(C); const U = C.U.chao, M = MUNDOS[race] || MUNDOS.vehnar, V = VEIO[race] || VEIO.vehnar, P = PULSO[race] || [0, 0, 0, 0, 0.85];
  U.c0.value.setHex(M.chao[0]); U.c1.value.setHex(M.chao[1]); U.c2.value.setHex(M.chao[2]); U.rocha.value.setHex(M.rocha); U.brilho.value.setHex(M.brilho);
  U.rug.value = M.rug; U.rug2.value = Math.min(1, M.rug + 0.1); U.larg.value = V[0]; U.vf.value = V[1]; U.vt.value = V[2]; U.kv.value = V[3];
  U.pa.value = P[0]; U.px.value = P[1]; U.pz.value = P[2]; U.pamp.value = P[3]; U.poff.value = P[4]; }
/* ---------- céu físico (SkyMesh em TSL, com nuvens) com ganho, tinta e estrelas por mundo; o mesmo céu, menor, assa a luz de ambiente ---------- */
function ceu(C) { const { W, T, SkyMesh } = C.L; const { vec3, vec4, float, normalize, positionWorld, cameraPosition, floor, fract, dot, smoothstep, max, sin, time, hash, length } = T;
  const U = { ganho: T.uniform(0.12), tinta: T.uniform(new W.Color(1, 1, 1)), estrelas: T.uniform(0.0) };
  const stars = (dir, sc, th) => { const q = dir.mul(sc), c = floor(q), r = hash(c.x.add(c.y.mul(57.0)).add(c.z.mul(113.0))); const o = vec3(hash(c.x.add(7.1)), hash(c.y.add(3.3)), hash(c.z.add(9.9))).mul(0.6).add(0.2);
    const l = length(fract(q).sub(o)); return smoothstep(0.12, 0.0, l).mul(smoothstep(th, 1.0, r)).mul(sin(time.mul(r.mul(3.0).add(1.0)).add(r.mul(60.0))).mul(0.3).add(0.7)); };
  const make = (scale, comEstrelas) => { const s = new SkyMesh(); s.scale.setScalar(scale); const base = s.material.colorNode; const dir = normalize(positionWorld.sub(cameraPosition));
    let col = base.rgb.mul(U.ganho).mul(U.tinta); if (comEstrelas) col = col.add(vec3(0.85, 0.9, 1.0).mul(stars(dir, 170.0, 0.965).mul(1.4).add(stars(dir, 360.0, 0.982))).mul(U.estrelas).mul(smoothstep(-0.02, 0.2, dir.y)));
    s.material.colorNode = vec4(col, 1); s.material.fog = false; s.frustumCulled = false; return s; };
  const sky = make(4000, true), envSky = make(400, false); envSky.cloudCoverage.value = 0.2;
  const set = race => { const K = (MUNDOS[race] || MUNDOS.vehnar).ceu; for (const s of [sky, envSky]) { s.turbidity.value = K.turb; s.rayleigh.value = K.ray; s.mieCoefficient.value = K.mie; s.mieDirectionalG.value = K.g; }
    sky.cloudCoverage.value = K.nuv; sky.cloudDensity.value = K.den; U.ganho.value = K.ganho; U.tinta.value.setRGB(K.tinta[0], K.tinta[1], K.tinta[2]); U.estrelas.value = K.elev < 3 ? 1 : K.elev < 8 ? 0.45 : 0.15; };
  return { sky, envSky, U, set }; }
/* direção do sol do mundo (para o céu, a luz e os planetas) */
function solDir(race, out) { const K = (MUNDOS[race] || MUNDOS.vehnar).ceu; const phi = (90 - K.elev) * Math.PI / 180, th = K.az * Math.PI / 180; out.setFromSphericalCoords(1, phi, th); return out; }
/* ---------- planetas só em shader ---------- */
function planetaMat(C, race, sol) { const { W, T } = C.L; const P = PLANETAS[race] || PLANETAS.vehnar; const m = new W.MeshBasicNodeMaterial(); m.fog = false;
  const { float, vec3, color, mix, smoothstep, abs, max, dot, pow, normalize, sin, reflect, time, positionLocal, normalWorld, positionWorld, cameraPosition, mx_noise_float, mx_fractal_noise_float, mx_worley_noise_vec2, mx_cell_noise_float, floor } = T;
  const n = normalize(positionLocal), nw = normalize(normalWorld), V = normalize(cameraPosition.sub(positionWorld));
  const ndl = dot(nw, sol), dia = smoothstep(-0.16, 0.28, ndl), lam = max(ndl, 0).pow(0.8);
  const c0 = color(P.pl[0]), c1 = color(P.pl[1]), c2 = color(P.pl[2]), c3 = color(P.pl[3]); let alb, noite = vec3(0), spec = float(0), nuv = float(0);
  const det = mx_fractal_noise_float(n.mul(9.0), 3, 2.0, 0.5).mul(0.12);
  if (race === 'vehnar') { const reg = mx_fractal_noise_float(n.mul(1.6), 5, 2.0, 0.55), b = mx_fractal_noise_float(vec3(n.x.mul(0.9), n.y.mul(5.0), n.z.mul(0.9)), 3, 2.0, 0.5);
    alb = mix(mix(c0, c1, smoothstep(-0.5, 0.0, reg)), mix(c2, c3, smoothstep(0.1, 0.6, b.add(det))), smoothstep(-0.15, 0.25, reg.add(det)));
    const lava = float(1).sub(smoothstep(0.0, 0.025, abs(mx_noise_float(n.mul(3.2))))).mul(smoothstep(0.0, -0.35, reg)); noite = color(P.noite).mul(lava).mul(1.6); }
  else if (race === 'erevane') { const cont = mx_fractal_noise_float(n.mul(1.7), 5, 2.0, 0.55), land = smoothstep(0.08, 0.13, cont.add(det.mul(0.5)));
    alb = mix(mix(c0, c1, smoothstep(-0.7, 0.05, cont)), mix(c2, c3, smoothstep(0.12, 0.5, cont.add(det))), land); spec = float(1).sub(land);
    nuv = smoothstep(0.12, 0.55, mx_fractal_noise_float(vec3(n.x.mul(2.4), n.y.mul(4.0), n.z.mul(2.4)).add(vec3(time.mul(0.003), 0, 0)), 4, 2.0, 0.5)).mul(0.7);
    noite = color(P.noite).mul(smoothstep(0.94, 0.97, mx_cell_noise_float(floor(n.mul(70.0))))).mul(land).mul(0.9); }
  else if (race === 'tessara') { const cont = mx_fractal_noise_float(n.mul(1.5).add(vec3(3.1, 0, 1.7)), 5, 2.0, 0.55), land = smoothstep(-0.02, 0.04, cont.add(det.mul(0.5)));
    alb = mix(mix(c0, c1, 0.55), mix(c1, c2, smoothstep(-0.1, 0.45, mx_fractal_noise_float(n.mul(4.0), 3, 2.0, 0.5).add(cont))), land); spec = float(1).sub(land).mul(0.5);
    nuv = smoothstep(0.05, 0.5, mx_fractal_noise_float(vec3(n.x.mul(2.2), n.y.mul(3.6), n.z.mul(2.2)).add(vec3(0, time.mul(0.004), 0)), 4, 2.0, 0.5)).mul(0.8);
    noite = color(P.noite).mul(float(1).sub(smoothstep(0.0, 0.02, abs(mx_noise_float(n.mul(5.0)))))).mul(land).mul(1.0); }
  else if (race === 'quorith') { const w = mx_worley_noise_vec2(n.mul(2.6)), edge = w.y.sub(w.x), cell = mx_cell_noise_float(floor(n.mul(2.6)));
    alb = mix(mix(c1, c2, cell), c3, smoothstep(0.7, 1.0, cell).mul(0.5)).mul(smoothstep(0.0, 0.3, edge).mul(0.3).add(0.7)).add(det.mul(0.3));
    noite = color(P.noite).mul(float(1).sub(smoothstep(0.0, 0.03, edge))).mul(1.2); spec = float(0.3); }
  else { const r = float(1).sub(abs(mx_fractal_noise_float(n.mul(1.8), 4, 2.0, 0.5))), v = float(1).sub(smoothstep(0.0, 0.02, abs(mx_noise_float(n.mul(4.0).add(vec3(0, 0, time.mul(0.01)))))));
    alb = mix(mix(c0, c1, smoothstep(0.3, 0.8, r)), mix(c2, c3, 0.2), smoothstep(0.75, 0.98, r.add(det))).mul(v.mul(-0.3).add(1)); noite = color(P.noite).mul(v).mul(sin(time.mul(1.4)).mul(0.25).add(0.9)).mul(1.0); }
  const fino = mx_fractal_noise_float(n.mul(42.0), 3, 2.0, 0.5).mul(0.09); /* detalhe fino: só aparece quando a câmera mergulha no planeta (voo entre Raças) */
  let cor = alb.mul(fino.add(1)).mul(lam.mul(1.5).add(0.018));
  cor = mix(cor, vec3(0.92, 0.95, 1.0).mul(lam.mul(1.35).add(0.012)), nuv);
  const R = reflect(sol.negate(), nw); cor = cor.add(vec3(1.0, 0.95, 0.85).mul(pow(max(dot(R, V), 0), 60.0)).mul(spec).mul(float(1).sub(nuv)).mul(dia).mul(1.6));
  cor = cor.add(noite.mul(float(1).sub(dia)).mul(float(1).sub(nuv.mul(0.7))));
  const fres = float(1).sub(max(dot(nw, V), 0)).pow(4.0); cor = cor.add(color(P.atmo).mul(fres).mul(dia.mul(0.9).add(0.03)).mul(1.0));
  m.colorNode = cor; return m; }
/* 5.0a.1: halo e anel com a cor por uniform (o mesmo programa nos cinco planetas e nos dois anéis) */
/* 5.0a.1: os vidros e brilhos de dois lados (anéis, rasgo, calor, feixe e anel do projetor, mesa) desenham numa passada só (forceSinglePass): no r186 o
   compileAsync não prepara as duas passadas (costas e frente) dos transparentes de dois lados, e elas nasciam no primeiro quadro (travada) */
function halo(C, race, sol) { const { W, T } = C.L; const P = PLANETAS[race] || PLANETAS.vehnar; const { uniform, abs, dot, normalize, smoothstep, max, cameraPosition, positionWorld, normalWorld } = T;
  const m = new W.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: W.BackSide, blending: W.AdditiveBlending }); m.fog = false;
  const nw = normalize(normalWorld), V = normalize(cameraPosition.sub(positionWorld)), k = smoothstep(0.0, 0.48, abs(dot(nw, V))).pow(2.2), lit = smoothstep(-0.35, 0.4, dot(nw, sol));
  m.colorNode = uniform(new W.Color(P.atmo)).mul(k).mul(lit.mul(0.8).add(0.05)).mul(0.9); return m; }
function anel(C, race, sol, centro, raio) { const { W, T } = C.L; const P = PLANETAS[race]; const { float, vec3, uniform, length, smoothstep, mx_fractal_noise_float, positionLocal, positionWorld, dot, max, sqrt } = T;
  const m = new W.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: W.DoubleSide, forceSinglePass: true }); m.fog = false;
  const r = length(positionLocal.xy), bands = mx_fractal_noise_float(vec3(r.mul(26.0), 0.5, 0.5), 3, 2.0, 0.5).mul(0.5).add(0.5);
  const toC = centro.sub(positionWorld), t = max(dot(toC, sol), 0), d = length(toC.sub(sol.mul(t))), sombra = smoothstep(raio.mul(0.96), raio.mul(1.04), d).max(float(1).sub(smoothstep(0.0, 1.0, t)));
  m.colorNode = uniform(new W.Color(P.anel)).mul(bands.mul(0.8).add(0.35)).mul(sombra.mul(0.95).add(0.05)).mul(1.2);
  m.opacityNode = smoothstep(1.42, 1.5, r).mul(smoothstep(2.36, 2.2, r)).mul(bands.mul(0.7).add(0.15)).mul(smoothstep(1.86, 1.9, r).oneMinus().mul(0.55).add(0.45)); return m; }
function planetas(C) { const { W, T } = C.L; C.U.solP = C.U.solP || T.uniform(new W.Vector3(0.5, 0.38, 0.78).normalize()); /* a luz dos planetas vem de fora do diorama: lado de dia para a câmera */ const geo = new W.SphereGeometry(1, C.leve ? 64 : 96, C.leve ? 44 : 64), geoH = new W.SphereGeometry(1.14, 48, 32); const out = { group: new W.Group(), por: {}, geos: [geo, geoH] };
  for (const race of RACES) { const g = new W.Group(); const centro = T.uniform(new W.Vector3()), raio = T.uniform(1);
    const sph = new W.Mesh(geo, planetaMat(C, race, C.U.solP)); sph.rotation.z = 0.32 + RACES.indexOf(race) * 0.37; g.add(sph); const h = new W.Mesh(geoH, halo(C, race, C.U.solP)); g.add(h);
    let ring = null; if (PLANETAS[race].anel) { const rg = new W.RingGeometry(1.42, 2.36, 160, 1); out.geos.push(rg); ring = new W.Mesh(rg, anel(C, race, C.U.solP, centro, raio)); ring.rotation.set(1.22, 0.18, 0.1); g.add(ring); }
    g.visible = false; out.group.add(g); out.por[race] = { g, sph, ring, centro, raio }; }
  out.place = (race, pos, r) => { const p = out.por[race]; p.g.position.copy(pos); p.g.scale.setScalar(r); p.centro.value.copy(pos); p.raio.value = r; p.g.visible = true; };
  out.spin = dt => { for (const k in out.por) out.por[k].sph.rotation.y += dt * 0.012; };
  return out; }
/* ---------- a Fenda: coração orgânico, calor que refrata, rasgo no céu e partículas fluidas em compute ---------- */
function fenda(C, H) { const { W, T } = C.L; const { Fn, If, float, vec2, vec3, color, mix, smoothstep, abs, sin, cos, length, max, normalize, hash, time, instancedArray, instanceIndex, uniform, shapeCircle, positionLocal, normalLocal, positionWorld, mx_noise_vec3, mx_noise_float, mx_fractal_noise_float, viewportSharedTexture, screenUV, uv } = T;
  /* 5.0a.1: a Fenda é UMA só na Sala (não muda com o mundo): só a altura acompanha o relevo de cada mundo (altura(H)), com o centro das partículas por uniform; a troca de Raça não refaz o compute nem os materiais */
  const out = { group: new W.Group(), disp: [] }; const fy = H(FENDA.x, FENDA.z); out.centro = new W.Vector3(FENDA.x, fy - 26, FENDA.z); out.c0 = uniform(new W.Vector3(FENDA.x, fy - 18, FENDA.z));
  /* coração: deslocamento por ruído na GPU e veias que pulsam (o mesmo do laboratório) */
  const blobMat = new W.MeshStandardNodeMaterial({ roughness: 0.3, metalness: 0 }); { const p = positionLocal, n = normalLocal;
    const d = mx_fractal_noise_float(p.mul(0.28).add(vec3(0, time.mul(0.35), 0)), 3, 2.0, 0.5).mul(2.4).add(sin(time.mul(1.6)).mul(0.4)); blobMat.positionNode = p.add(n.mul(d));
    const vein = float(1).sub(smoothstep(0.0, 0.07, abs(mx_noise_float(p.mul(0.7).add(vec3(time.mul(0.12))))))); blobMat.colorNode = mix(color(0x2b1030), color(0x5a1d4f), d.mul(0.3).add(0.5));
    blobMat.emissiveNode = color(0xff4fc1).mul(vein).mul(sin(time.mul(2.1).add(p.y.mul(0.4))).mul(0.5).add(0.9)).mul(3.0); if (C.luzMundo) blobMat.lightsNode = C.luzMundo; }
  const bg = new W.IcosahedronGeometry(9, C.leve ? 18 : 40); out.disp.push(bg); const blob = new W.Mesh(bg, blobMat); blob.position.copy(out.centro).y += 6; out.group.add(blob); out.disp.push(blobMat); out.blob = blob;
  /* calor: a cena atrás é refratada por ruído (só na versão completa) */
  if (!C.leve) { const m = new W.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: W.DoubleSide, forceSinglePass: true }); m.fog = false;
    const hy = positionLocal.y.div(70).add(0.5), fade = smoothstep(0.0, 0.25, hy).mul(float(1).sub(smoothstep(0.55, 1.0, hy)));
    const off = vec2(mx_noise_float(vec3(positionWorld.xz.mul(0.05), time.mul(0.7))), mx_noise_float(vec3(positionWorld.zy.mul(0.05), time.mul(0.6).add(4)))).mul(0.012).mul(fade);
    m.colorNode = viewportSharedTexture(screenUV.add(off)).rgb; m.opacityNode = fade; const cg = new W.CylinderGeometry(34, 44, 70, 48, 1, true); out.disp.push(cg, m);
    const haze = new W.Mesh(cg, m); haze.position.set(FENDA.x, fy + 10, FENDA.z); haze.renderOrder = 5; out.group.add(haze); out.haze = haze; }
  /* rasgo no céu: núcleo branco, borda laranja e halo violeta, serrilhado por ruído que corre devagar (o desenho do fundo 4.3 em TSL) */
  { const m = new W.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: W.AdditiveBlending, side: W.DoubleSide, forceSinglePass: true }); m.fog = false; const u = uv(), y = u.y, t = time.mul(0.18);
    const fb = x => mx_fractal_noise_float(vec3(x, 1.3, 0.7), 3, 2.1, 0.5).mul(0.5).add(0.5);
    const off = fb(y.mul(7.0).add(t)).sub(0.5).mul(0.16).add(fb(y.mul(23.0).sub(t.mul(2.0))).sub(0.5).mul(0.05)); const taper = smoothstep(0.0, 0.22, y).mul(smoothstep(1.0, 0.7, y));
    const w = float(0.012).add(taper.mul(0.03).mul(fb(y.mul(3.0).add(2.0)).mul(0.4).add(0.6))), x = abs(u.x.sub(0.5).sub(off));
    const core = smoothstep(w, 0.0, x).mul(taper), hal = T.exp(x.mul(x).div(taper.mul(0.05).add(0.02)).negate()).mul(taper);
    m.colorNode = vec3(1.0, 0.94, 0.86).mul(core).mul(4.0).add(vec3(1.0, 0.37, 0.2).mul(smoothstep(w.mul(4.0), 0.0, x)).mul(taper).mul(1.6)).add(vec3(0.7, 0.24, 1.0).mul(hal).mul(0.7));
    const pg = new W.PlaneGeometry(1, 1); out.disp.push(pg, m); out.rasgo = new W.Mesh(pg, m); out.rasgo.renderOrder = -1; out.rasgo.frustumCulled = false; out.group.add(out.rasgo); }
  /* partículas fluidas: simuladas num compute shader (TSL → WGSL no WebGPU, GLSL na reserva WebGL2); o ponteiro mexe e o clique empurra */
  const N = C.nPart; out.N = N;
  if (N > 0) { const P = instancedArray(N, 'vec3'), V = instancedArray(N, 'vec3'), L = instancedArray(N, 'float'); const c0 = out.c0;
    out.dt = uniform(1 / 60); out.pulseP = uniform(new W.Vector3()); out.pulseK = uniform(0); out.stirP = uniform(new W.Vector3()); out.stirK = uniform(0);
    const spawn = Fn(([s]) => { const a = hash(s).mul(Math.PI * 2), r = hash(s.add(17.0)).mul(16).add(4); return c0.add(vec3(cos(a).mul(r), hash(s.add(31.0)).mul(-8), sin(a).mul(r))); });
    out.cInit = Fn(() => { const i = instanceIndex, s = i.toFloat(); P.element(i).assign(spawn(s).add(vec3(0, hash(s.add(9.0)).mul(230), 0))); V.element(i).assign(vec3(0)); L.element(i).assign(hash(s.add(5.0))); })().compute(N);
    out.cUpd = Fn(() => { const i = instanceIndex; const p = P.element(i).toVar(), v = V.element(i).toVar(), life = L.element(i).toVar(); const q = p.sub(c0), r = max(length(q.xz), 0.6), alt = max(q.y, 0.0);
      const tang = vec3(q.z.negate(), 0, q.x).div(r).mul(float(90).div(r.add(7)));
      const flow = mx_noise_vec3(p.mul(0.03).add(vec3(0, time.mul(0.16), 0))).mul(7);
      const alvo = float(10).add(alt.mul(0.16)), pull = vec3(q.x, 0, q.z).div(r).mul(smoothstep(alvo, alvo.add(14.0), r)).mul(-7);
      const lift = vec3(0, float(7.0).sub(alt.mul(0.02)), 0);
      const d = p.sub(out.pulseP), dl = max(length(d), 0.5), push = d.div(dl).mul(out.pulseK.mul(2600).div(dl.mul(dl).add(60)));
      const e = p.sub(out.stirP), el = max(length(e), 0.5), stir = vec3(e.z, 0, e.x.negate()).div(el).mul(out.stirK.mul(380).div(el.mul(el).add(140)));
      v.assign(v.mul(0.955).add(tang.add(flow).add(pull).add(lift).add(push).add(stir).mul(out.dt)));
      p.addAssign(v.mul(out.dt)); life.subAssign(out.dt.mul(0.045));
      If(life.lessThan(0).or(q.y.greaterThan(260)), () => { p.assign(spawn(i.toFloat().add(time.mul(60).floor()))); v.assign(vec3(0)); life.assign(1); });
      P.element(i).assign(p); V.element(i).assign(v); L.element(i).assign(life); })().compute(N);
    const m = new W.SpriteNodeMaterial({ transparent: true, depthWrite: false, blending: W.AdditiveBlending }); m.fog = false; const sp = length(V.toAttribute()), lf = L.toAttribute();
    m.positionNode = P.toAttribute(); m.colorNode = mix(color(0xff3fb8), color(0x6fe9ff), smoothstep(4.0, 22.0, sp)).mul(0.95);
    m.opacityNode = shapeCircle().mul(smoothstep(0.0, 0.25, lf)).mul(0.55); m.scaleNode = float(C.leve ? 1.3 : 0.9).mul(lf.mul(0.5).add(0.5));
    const s = new W.Sprite(m); s.count = N; s.frustumCulled = false; s.renderOrder = 6; out.group.add(s); out.disp.push(m); out.sprites = s; }
  /* a cratera de cada mundo tem outra altura: o coração, o calor e o funil das partículas descem ou sobem junto */
  out.altura = H2 => { const y = H2(FENDA.x, FENDA.z); out.centro.set(FENDA.x, y - 26, FENDA.z); out.c0.value.set(FENDA.x, y - 18, FENDA.z); blob.position.copy(out.centro).y += 6; if (out.haze) out.haze.position.set(FENDA.x, y + 10, FENDA.z); };
  return out; }
/* ---------- partículas do ar por mundo (brasas, neve, esporos, pó de cristal): posição calculada na GPU pelo índice e pelo tempo, sem CPU por quadro ---------- */
/* 5.0a.1: UM céu de partículas para a Sala inteira, com o jeito de cada mundo por uniform (velocidade, subida ou queda, cor, tamanho):
   o mesmo programa nas cinco Raças (antes, um material por mundo) */
const AR = { brasa: { cor: 0xff7a2a, vel: 0.07, alt: 110, neve: 0, sw: 3, k: 1.6, op: 0.8, sc: 0.3 }, neve: { cor: 0xdff4ff, vel: 0.05, alt: 70, neve: 1, sw: 6, k: 0.9, op: 0.55, sc: 0.45 },
  esporo: { cor: 0x9dff8a }, cristal: { cor: 0xd2b4ff }, 'esporo-vermelho': { cor: 0xff6a5a } };
function ar(C) { if (C.arObj) return C.arObj; const { W, T } = C.L; const { float, vec3, uniform, sin, cos, fract, hash, time, instanceIndex, shapeCircle, smoothstep, mix } = T; const N = C.leve ? 140 : 380;
  const U = C.U.ar = { cor: uniform(new W.Color(1, 1, 1)), vel: uniform(0.025), alt: uniform(70), neve: uniform(0), sw: uniform(6), op: uniform(0.8), sc: uniform(0.36) };
  const m = new W.SpriteNodeMaterial({ transparent: true, depthWrite: false, blending: W.AdditiveBlending }); m.fog = false; m.userData.compartilhado = true; const i = instanceIndex.toFloat();
  const age = fract(time.mul(U.vel).mul(hash(i.add(3.0)).mul(0.6).add(0.7)).add(hash(i)));
  const x = hash(i.add(11.0)).sub(0.5).mul(460).add(10), z = hash(i.add(23.0)).sub(0.5).mul(380).sub(90), alt = mix(age.mul(U.alt).add(2), float(140).mul(float(1).sub(age)), U.neve);
  const sw = sin(time.mul(0.6).add(i)).mul(U.sw), sw2 = cos(time.mul(0.5).add(i.mul(1.7))).mul(5);
  m.positionNode = vec3(x.add(sw), alt, z.add(sw2));
  m.colorNode = U.cor.mul(sin(time.mul(3.0).add(i.mul(7.0))).mul(0.3).add(0.8));
  m.opacityNode = shapeCircle().mul(smoothstep(0.0, 0.12, age)).mul(smoothstep(1.0, 0.75, age)).mul(U.op);
  m.scaleNode = U.sc.mul(hash(i.add(5.0)).mul(0.8).add(0.6));
  const s = new W.Sprite(m); s.count = N; s.frustumCulled = false; s.renderOrder = 4; s.name = 'ar'; C.arObj = { obj: s, disp: [m], U }; return C.arObj; }
function arDe(C, race) { const A = ar(C), M = MUNDOS[race] || MUNDOS.vehnar, K = Object.assign({ vel: 0.025, alt: 70, neve: 0, sw: 6, k: 1.6, op: 0.8, sc: 0.36 }, AR[M.ar] || {});
  A.U.cor.value.setHex(K.cor || 0xffffff).multiplyScalar(K.k); A.U.vel.value = K.vel; A.U.alt.value = K.alt; A.U.neve.value = K.neve; A.U.sw.value = K.sw; A.U.op.value = K.op; A.U.sc.value = K.sc; }
/* fumaça das chaminés (Vehnar e Reatores): bolhas que sobem, crescem e somem, calculadas na GPU */
function fumaca(C, fontes) { const { W, T } = C.L; const { float, vec3, color, sin, fract, hash, time, instanceIndex, shapeCircle, smoothstep, uniformArray } = T; if (!fontes.length) return null;
  /* 5.0a.1: a lista de chaminés tem sempre 2 lugares (o mesmo programa em todos os mundos; as que sobram ficam sem partícula) */ const fx = fontes.slice(0, 2); while (fx.length < 2) fx.push([0, -999, 0]);
  const PER = C.leve ? 14 : 34, N = PER * Math.min(2, fontes.length); const arr = uniformArray(fx.map(p => new W.Vector3(p[0], p[1], p[2])), 'vec3');
  const m = new W.SpriteNodeMaterial({ transparent: true, depthWrite: false }); m.fog = false; const i = instanceIndex.toFloat(), k = i.div(PER).floor().toInt(), age = fract(time.mul(0.085).add(hash(i)));
  const o = arr.element(k); m.positionNode = o.add(vec3(sin(i.mul(3.1).add(time.mul(0.3))).mul(age.mul(5)).add(age.mul(age).mul(16)), age.mul(46), hash(i.add(9.0)).sub(0.5).mul(age).mul(10)));
  m.colorNode = color(0x2b2622).mul(float(1).add(smoothstep(0.25, 0.0, age).mul(5.0)));
  m.opacityNode = shapeCircle().mul(smoothstep(0.0, 0.08, age)).mul(smoothstep(1.0, 0.45, age)).mul(0.42); m.scaleNode = age.mul(13).add(2.5);
  const s = new W.Sprite(m); s.count = N; s.frustumCulled = false; s.renderOrder = 3; return { obj: s, disp: [m] }; }
/* ---------- materiais dos modelos do jogo em TSL (cor, rugosidade e metal por vértice, como no laboratório) ---------- */
function modelos(C) { const { W, T } = C.L; const { vertexColor, attribute, uniform, float, color, mix, pow, max, dot, normalize, cameraPosition, positionWorld, normalWorld } = T;
  const main = new W.MeshStandardNodeMaterial(); main.colorNode = vertexColor().rgb; { const rm = attribute('rm', 'vec2'); main.roughnessNode = rm.x.max(0.04); main.metalnessNode = rm.y; }
  const V = normalize(cameraPosition.sub(positionWorld)); C.U.aro = C.U.aro || uniform(new W.Color(1, 0.5, 0.2)); main.emissiveNode = C.U.aro.mul(pow(float(1).sub(max(dot(normalWorld, V), 0)), 4.0)).mul(0.22); /* contorno leve na cor da Raça */
  const em = new W.MeshStandardNodeMaterial({ roughness: 0.4, metalness: 0 }); em.colorNode = vertexColor().rgb.mul(0.25); em.emissiveNode = vertexColor().rgb.mul(C.U.emis || (C.U.emis = uniform(2.6)));
  const flora = new W.MeshStandardNodeMaterial(); flora.colorNode = vertexColor().rgb.mul(C.U.floraCor || (C.U.floraCor = uniform(new W.Color(1, 1, 1)))); { const rm = attribute('rm', 'vec2'); flora.roughnessNode = rm.x.max(0.05); flora.metalnessNode = rm.y; flora.emissiveNode = vertexColor().rgb.mul(attribute('aGlow', 'float')).mul(2.2); }
  for (const m of [main, em, flora]) { if (C.luzMundo) m.lightsNode = C.luzMundo; }
  return { main, em, flora }; }
/* ---------- a base da Raça: modelos do jogo montados um por quadro (a página não trava) ---------- */
const UNID = r => ({ vehnar: ['prensa', 'soldador', 'tratorzao'], erevane: ['lamina', 'atirador', 'ancora'], tessara: ['colosso', 'quimera', 'molde'], quorith: ['monolito', 'prisma', 'voz'], vorag: ['brutamonte', 'escaravelho', 'cuspidor'] }[r] || []);
async function base(C, race, H, cor, alive) { const { W } = C.L; const ME = ARD.meshes; const g = new W.Group(); g.name = 'base-' + race; const out = { group: g, pick: [], anim: [], fontes: [], disp: [] }; if (!ME) return out;
  let seed = 3; const place = (def, x, z, ang, o) => { const r = ME.build(def, race, cor, seed++); if (!r || !r.main) return null; const gg = new W.Group();
    const a = new W.Mesh(r.main, C.mats.main); a.castShadow = !(o && o.sombra === false); /* 5.0a.1: o que anda não faz sombra (o mapa de sombra é desenhado uma vez por mundo) */ a.receiveShadow = true; gg.add(a); out.disp.push(r.main);
    if (r.em && r.em.attributes.position.count) { const e = new W.Mesh(r.em, C.mats.em); gg.add(e); out.disp.push(r.em); } else if (r.em) r.em.dispose();
    gg.position.set(x, H(x, z) + ((o && o.y) || 0), z); gg.rotation.y = ang; if (o && o.s) gg.scale.setScalar(o.s); gg.userData = { def, w: r.width, h: r.height }; a.userData.root = gg; g.add(gg); out.pick.push(a); return gg; };
  const yieldF = () => C.tick ? C.tick() : null;
  for (const p of PADS) { if (!alive()) return out; const m = place(p[0], p[1], p[2], p[3]); if (m && p[0] === 'nucleo') out.nucleo = m;
    if (m && p[0] === 'reator' && (race === 'vehnar' || seed < 6)) out.fontes.push([p[1] - 3, m.position.y + m.userData.h * 0.95, p[2] + 2]); await yieldF(); }
  /* coletores indo e voltando entre a Refinaria e os cristais; drones em órbita; unidades da Raça paradas em formação */
  const cristal = [118, -118]; const ref = [58, -40];
  for (let k = 0; k < 2; k++) { if (!alive()) return out; const m = place('coletor', ref[0], ref[1], 0, { sombra: false }); if (m) out.anim.push({ o: m, tipo: 'vaivem', a: [ref[0] + 14 + k * 8, ref[1] - 12 - k * 10], b: [cristal[0] - 6 + k * 10, cristal[1] + 8 - k * 6], per: 15 + k * 4, fase: k * 0.47 }); await yieldF(); }
  for (let k = 0; k < 5; k++) { if (!alive()) return out; const a = k / 5 * Math.PI * 2; const fl = ARD.meshes.scatter('cristal', 7 + k); if (fl) { fl.computeBoundingSphere(); if (!fl.getAttribute('aGlow')) fl.setAttribute('aGlow', new W.BufferAttribute(new Float32Array(fl.attributes.position.count), 1)); const mm = new W.Mesh(fl, C.mats.flora); const x = cristal[0] + Math.cos(a) * 10, z = cristal[1] + Math.sin(a) * 8; mm.position.set(x, H(x, z), z); mm.scale.setScalar(5 + (k % 2) * 2.5); mm.rotation.y = a * 2.3; g.add(mm); out.disp.push(fl); } }
  const dr = race === 'erevane' ? 'mosquito' : race === 'tessara' ? 'esporo' : race === 'quorith' ? 'harmonico' : race === 'vorag' ? 'ferroada' : 'drone';
  for (let k = 0; k < 3; k++) { if (!alive()) return out; const m = place(dr, 0, 0, 0, { s: 1.15, sombra: false }); if (m) out.anim.push({ o: m, tipo: 'orbita', c: [k === 2 ? 60 : -10, k === 2 ? -30 : -18], r: 70 + k * 24, h: 34 + k * 9, w: (k % 2 ? -1 : 1) * (0.16 + k * 0.03), fase: k * 2.1 }); await yieldF(); }
  const U3 = UNID(race); const pos = [[66, 36, -0.5], [44, 52, -0.2], [30, 30, 0.1], [-40, 70, 0.6], [100, 22, -0.3]];
  for (let k = 0; k < pos.length; k++) { if (!alive()) return out; const def = k === 0 ? U3[0] : k < 3 ? U3[1] : (k === 3 ? 'veiculo' : U3[2]); const [x, z, ang] = pos[k]; const m = place(def, x, z, ang, k > 2 ? { sombra: false } : null); if (m && k > 2) out.anim.push({ o: m, tipo: 'ronda', x0: x, z0: z, amp: 6 + k, per: 22 + k * 3, fase: k }); await yieldF(); }
  /* flora do mundo em volta (sem tocar nos canteiros) */
  const F = (MUNDOS[race] || MUNDOS.vehnar).flora; let n = 0;
  for (let k = 0; k < (C.leve ? 26 : 60); k++) { const a = hh(k, 3.3) * Math.PI * 2, d = 120 + hh(k, 9.1) * 230; const x = Math.cos(a) * d * 1.15 + 20, z = Math.sin(a) * d - 90; if (Math.hypot(x - FENDA.x, z - FENDA.z) < FENDA.r + 30) continue;
    const kind = F[k % F.length]; const geo = ARD.meshes.scatter(kind, k + 1); if (!geo) continue; if (!geo.getAttribute('aGlow')) geo.setAttribute('aGlow', new W.BufferAttribute(new Float32Array(geo.attributes.position.count), 1));
    const mm = new W.Mesh(geo, C.mats.flora); mm.position.set(x, H(x, z) - 0.3, z); mm.scale.setScalar((kind === 'boulder' || kind.startsWith('marco') ? 7 : 4) * (0.7 + hh(k, 1.7) * 0.9)); mm.rotation.y = a * 3.1; mm.castShadow = kind === 'boulder' || kind.startsWith('marco'); mm.receiveShadow = true; g.add(mm); out.disp.push(geo); if (++n % 12 === 0) { await yieldF(); if (!alive()) return out; } }
  return out; }
/* movimento simples das unidades (sem alocar): vaivém dos coletores, órbita dos drones, ronda curta da tropa */
function animar(b, H, t) { for (let i = 0; i < b.anim.length; i++) { const a = b.anim[i], o = a.o;
  if (a.tipo === 'vaivem') { const u = ((t / a.per + a.fase) % 1), k = u < 0.5 ? u * 2 : 2 - u * 2, e = k * k * (3 - 2 * k); const x = a.a[0] + (a.b[0] - a.a[0]) * e, z = a.a[1] + (a.b[1] - a.a[1]) * e; const dx = (a.b[0] - a.a[0]) * (u < 0.5 ? 1 : -1), dz = (a.b[1] - a.a[1]) * (u < 0.5 ? 1 : -1);
    o.position.set(x, H(x, z) + Math.abs(Math.sin(t * 9 + i)) * 0.15, z); o.rotation.y = Math.atan2(dx, dz); }
  else if (a.tipo === 'orbita') { const an = t * a.w + a.fase; const x = a.c[0] + Math.cos(an) * a.r, z = a.c[1] + Math.sin(an) * a.r * 0.7; o.position.set(x, a.h + Math.sin(t * 1.3 + i) * 2, z); o.rotation.y = Math.atan2(-Math.sin(an) * a.w, Math.cos(an) * a.w * 0.7) + Math.PI / 2 * Math.sign(a.w); o.rotation.z = -0.25 * Math.sign(a.w); }
  else if (a.tipo === 'ronda') { const u = Math.sin((t / a.per + a.fase) * Math.PI * 2); const x = a.x0 + u * a.amp, z = a.z0; o.position.set(x, H(x, z), z); o.rotation.y = Math.cos((t / a.per + a.fase) * Math.PI * 2) > 0 ? Math.PI / 2 : -Math.PI / 2; } } }
/* 5.0a.1: chão, ar, fumaça e Fenda dividem os programas entre os mundos; o que muda de uma Raça para outra é só o busto (sala-holo.js) */
ARD.salaMundo = { MUNDOS, PLANETAS, RACES, FENDA, PADS, relevo, terreno, chaoDe, ceu, solDir, planetas, fenda, ar, arDe, fumaca, modelos, base, animar };
})(globalThis.ARD = globalThis.ARD || {});
