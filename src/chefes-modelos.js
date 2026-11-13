/* Aether Rift: Dominion — 5.0g (agente g-visual), refeitos na 5.0h.2 (agente i-chefoes2, Chefões 2.0): os modelos dos chefões, no mesmo construtor
   (Kit) e no mesmo formato das malhas de hoje (src/meshes.js): cor, rugosidade e metal por vértice, partes emissivas separadas e animação por peça
   (spin, leg, bob, flap, sway) na GPU. Entram pelo gancho ARD.meshes.receitas (a função recipe do src/meshes.js procura aqui primeiro), então valem
   nos dois motores com o material e as instâncias de sempre: nenhum material nem pipeline novo (no Motor 5 o formato da geometria é o mesmo de
   qualquer modelo). Cada variante é um modelo à parte (o render3d escolhe pela fase, src/chefes.js), todos montados na carga só com chefão.
   5.0h.2 — direção de arte: o que vem da Fenda não é de nenhuma das cinco Raças. Os Despertos (o Arauto e a Sentinela) são Éter que acordou:
   vidro-da-Fenda (obsidiana violeta, quase preta, com relevo de células), ouro heráldico antigo, veias de Éter (ciano) e o plasma cru da Fenda
   (magenta) no miolo; peças que flutuam soltas, presas por força e não por juntas (geometria impossível). Os Construtores (a Forja-Mãe) são um
   colosso antigo de bronze escuro e ouro velho, uma fábrica-fera de quatro patas com costuras de metal derretido, bocarra de fornalha e chaminés
   como espinhos do dorso. Formas próprias (casca varrida, esculpido com ruído, grupos com transformação) feitas aqui, no padrão procedural do jogo.
   - O Arauto: botão de pétalas de vidro em volta do olho, coroa, dois anéis de runas, asas de lâminas soltas, véus pendentes e a quilha.
       chefe_arauto_1 (Três Pilares: botão fechado, olho em fresta, escudo geodésico), _2 (Ecos: pétalas abrindo e rachando, anéis partidos, asas com
       o eco atrás), _3 (Colapso: o miolo vira um buraco negro com disco de acreção e jatos; pétalas e lâminas arrancadas no redemoinho), _j (janela de
       dano: o olho aberto e exausto, pétalas caídas, alvo âmbar no olho). A Sentinela (chefe_sentinela e _j): o Arauto menor, âmbar, sem escudo.
   - Pilar do Arauto (chefe_pilar): coluna de blocos de vidro que levitam um sobre o outro, raízes de cristal no chão e o cristal da coroa girando.
   - A Forja-Mãe: corpo sem as pernas (chefe_forja na Marcha; _b na Linha de montagem, com as placas do dorso abertas em grelha, a bocarra aberta e
     as baias de trás acesas), a perna inteira (chefe_forja_perna, desenhada quatro vezes pelo src/chefes.js e que cai quando é destruída), a perna
     caída, o corpo desabado (chefe_forja_caida: costelas abertas em volta do núcleo, placas no chão, metal escorrendo), a escora do ponto fraco
     (chefe_junta: o pistão de cada perna com a bobina acesa à mostra) e o núcleo exposto (chefe_nucleo: crosta rachada sobre o metal em fusão).
     Marca de ponto fraco: chefe_marca (losango âmbar que gira acima da parte). Ecos: chefe_eco (a coroa de cacos sobre as cópias espectrais).
   Versão leve (K.lite, e toda montagem quando ARD.chefesForma.leve: qualidade Baixa e celular): menos pétalas, véus, lâminas, runas e segmentos. */
(function (ARD) {
'use strict';
const PI = Math.PI, TAU = PI * 2;
const TH = () => globalThis.THREE;
const FORMA = ARD.chefesForma = ARD.chefesForma || { leve: false }; /* src/chefes.js liga o leve na qualidade Baixa e no celular, antes da carga */
/* Despertos (Arauto e Sentinela) */
const VID = '#120E1D', VID2 = '#2B2147', VID3 = '#4E3C80', OURO = '#C9A55A', OURO2 = '#7C5F2C', ETER = '#7FE8FF', ETER2 = '#D4FBFF', FEN = '#E07CFF', FEN2 = '#FFD9FF', FENV = '#B23BFF', AMB = '#FFC24A', AMB2 = '#FFE9B8';
/* Construtores (Forja-Mãe) */
const BRONZE = [0.42, 0.62], BRZ = '#4B3A2D', BRZ2 = '#6E563F', ACO = '#3F444D', ACO2 = '#626872', ESC = '#1B1D21', OV = '#A8874A', COB = '#8E5B3A', BRASA = '#FF6A1A', BRASA2 = '#FFC66A', BRANCO = '#FFF1D0', PER = '#FFD23F', SOLDA = '#CFF4FF';
const VIDRO = [0.16, 0.06], VIDRO_F = [0.24, 0.05]; /* rugosidade e metal do vidro-da-Fenda (relevo de células: padrão 4) */

/* ---------- utilidades ---------- */
function rng(seed) { let a = (seed | 0) >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function h3(x, y, z) { let n = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(z | 0, 1274126177)) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); n ^= n >>> 16; return (n & 0x7fffffff) / 0x7fffffff; }
function vn(x, y, z) { const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z); let fx = x - xi, fy = y - yi, fz = z - zi; fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy); fz = fz * fz * (3 - 2 * fz);
  const L = (a, b, t) => a + (b - a) * t; const c = (i, j, k) => h3(xi + i, yi + j, zi + k);
  return L(L(L(c(0, 0, 0), c(1, 0, 0), fx), L(c(0, 1, 0), c(1, 1, 0), fx), fy), L(L(c(0, 0, 1), c(1, 0, 1), fx), L(c(0, 1, 1), c(1, 1, 1), fx), fy), fz); }
function fbm(x, y, z, o) { let v = 0, a = 0.5, f = 1, s = 0; for (let i = 0; i < (o || 3); i++) { v += a * vn(x * f, y * f, z * f); s += a; a *= 0.5; f *= 2.03; } return v / s; }
const cor = h => { const c = new (TH().Color)(h); return [c.r, c.g, c.b]; };
const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const sst = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const leve = K => !!(K.lite || FORMA.leve);
const nq = (K, n, k) => leve(K) ? Math.max(1, Math.round(n * (k || 0.55))) : n;
const ns = (K, n) => leve(K) ? Math.max(4, Math.round(n * 0.5)) : n;
const fino = (K, fn) => { if (!leve(K)) fn(); };
function mat4(x, y, z, rx, ry, rz, s) { const T = TH(); return new T.Matrix4().compose(new T.Vector3(x || 0, y || 0, z || 0), new T.Quaternion().setFromEuler(new T.Euler(rx || 0, ry || 0, rz || 0, 'YXZ')), new T.Vector3(s || 1, s || 1, s || 1)); }
function giro(px, py, pz, rx, ry, rz) { const T = TH(); return new T.Matrix4().makeTranslation(px, py, pz).multiply(mat4(0, 0, 0, rx, ry, rz)).multiply(new T.Matrix4().makeTranslation(-px, -py, -pz)); }
/* grupo com transformação: tudo o que fn desenhar (peças e pivôs de animação) passa pela matriz M; os eixos da animação não giram */
function grupo(K, M, fn, fixo) { const a = K.main.length, b = K.emi.length; fn(); const v = new (TH().Vector3)(); /* fixo: os pivôs ficam (peça que orbita em volta do pivô de fora) */
  for (const p of K.main.slice(a).concat(K.emi.slice(b))) { p.geo.applyMatrix4(M); if (p.an && !fixo) { v.set(p.an.p[0], p.an.p[1], p.an.p[2]).applyMatrix4(M); p.an.p = [v.x, v.y, v.z]; } } }
function geo(pos, col, idx) { const T = TH(); const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new T.Float32BufferAttribute(col, 3)); if (idx) g.setIndex(idx); g.computeVertexNormals(); return g; }
/* varredura: casca de perfil lenticular ao longo de pts = [[x, y, z, meia-largura, meia-espessura], ...]; o.lado = vetor da largura (ou função
   do índice), o.conc = concavidade (bordas dobram para o lado de o.dentro), o.c0/o.c1 = cor da base e da ponta, o.borda = brilho das arestas,
   o.c2 = cor da face de dentro; devolve a geometria e o quadro (centro, lado, normal) de cada ponto (para veias, rachaduras e bordas) */
function varre(pts, o) { o = o || {}; const T = TH(); const n = o.n || 10, N = pts.length; const V = p => new T.Vector3(p[0], p[1], p[2]);
  const c0 = cor(o.c0 || '#FFFFFF'), c1 = cor(o.c1 || o.c0 || '#FFFFFF'), c2 = o.c2 ? cor(o.c2) : null; const pos = [], col = [], idx = [], quad = [];
  for (let i = 0; i < N; i++) { const p = pts[i], t = V(pts[Math.min(N - 1, i + 1)]).sub(V(pts[Math.max(0, i - 1)])).normalize();
    const l0 = typeof o.lado === 'function' ? o.lado(i, p) : (o.lado || [0, 0, 1]); let S = V(l0); S.sub(t.clone().multiplyScalar(S.dot(t))); if (S.lengthSq() < 1e-6) S = new T.Vector3(1, 0, 0).cross(t); S.normalize();
    const Nn = new T.Vector3().crossVectors(t, S).normalize(); if (o.dentro) { const d = V(o.dentro).sub(V(p)); if (Nn.dot(d) > 0) { Nn.negate(); S.negate(); } }
    quad.push({ c: V(p), s: S, n: Nn, w: p[3], h: p[4] }); const u = i / (N - 1), base = mixc(c0, c1, u);
    for (let k = 0; k < n; k++) { const ph = k / n * TAU, cs = Math.cos(ph), sn = Math.sin(ph); const lx = cs * p[3], ly = sn * p[4] - (o.conc || 0) * p[3] * (cs * cs - 0.35);
      const q = V(p).add(S.clone().multiplyScalar(lx)).add(Nn.clone().multiplyScalar(ly)); pos.push(q.x, q.y, q.z);
      let cc = sn < 0 && c2 ? mixc(base, c2, Math.min(1, -sn * 1.6)) : base; const ed = Math.pow(Math.abs(cs), 10) * (o.borda || 0); cc = [cc[0] * (1 + ed), cc[1] * (1 + ed), cc[2] * (1 + ed)];
      const ao = o.ao ? 1 - o.ao * (1 - u) : 1; col.push(cc[0] * ao, cc[1] * ao, cc[2] * ao); } }
  for (let i = 0; i < N - 1; i++) for (let k = 0; k < n; k++) { const k2 = (k + 1) % n, a = i * n + k, b = i * n + k2, c = (i + 1) * n + k, d = (i + 1) * n + k2; idx.push(a, c, b, b, c, d); }
  if (o.tampa) { for (const [i, sg] of [[0, -1], [N - 1, 1]]) { const ci = pos.length / 3; const p = pts[i]; pos.push(p[0], p[1], p[2]); const b = mixc(c0, c1, i ? 1 : 0); col.push(b[0] * 0.8, b[1] * 0.8, b[2] * 0.8); for (let k = 0; k < n; k++) { const k2 = (k + 1) % n; if (sg > 0) idx.push(ci, i * n + k, i * n + k2); else idx.push(ci, i * n + k2, i * n + k); } } }
  const g = geo(pos, col, idx); g.userData.quad = quad; return g; }
/* bezier cúbica amostrada (pontos 2D ou 3D) */
function bez(P, n) { const out = []; for (let i = 0; i < n; i++) { const t = i / (n - 1), a = (1 - t) ** 3, b = 3 * t * (1 - t) ** 2, c = 3 * t * t * (1 - t), d = t ** 3; out.push(P[0].map((_, j) => a * P[0][j] + b * P[1][j] + c * P[2][j] + d * P[3][j])); } return out; }
/* esculpido: esfera deformada por f(nx, ny, nz) (raio relativo) e colorida por fc(nx, ny, nz, r) */
function esculpe(ws, hs, rx, ry, rz, f, fc) { const T = TH(); const g = new T.SphereGeometry(1, ws, hs); const p = g.attributes.position, col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const r = f ? f(x, y, z) : 1; p.setXYZ(i, x * r * rx, y * r * ry, z * r * rz); const c = fc ? fc(x, y, z, r) : [1, 1, 1]; col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2]; }
  g.setAttribute('color', new T.BufferAttribute(col, 3)); g.deleteAttribute('normal'); g.computeVertexNormals(); return g; }
/* faixa de anel (seção retangular): face de fora, de dentro, topo e base; arco a0..a0 + al */
function faixa(R, h, th, seg, a0, al) { const T = TH(); a0 = a0 || 0; al = al == null ? TAU : al; const pos = [], idx = [], col = [];
  const anel = (rr, y) => { const o = pos.length / 3; for (let i = 0; i <= seg; i++) { const a = a0 + al * i / seg; pos.push(Math.cos(a) * rr, y, Math.sin(a) * rr); col.push(1, 1, 1); } return o; };
  const q = (A, B, inv) => { for (let i = 0; i < seg; i++) { const a = A + i, b = A + i + 1, c = B + i, d = B + i + 1; if (inv) idx.push(a, b, c, b, d, c); else idx.push(a, c, b, b, c, d); } };
  const Ro = R + th / 2, Ri = R - th / 2; const ob = anel(Ro, -h / 2), ot = anel(Ro, h / 2), ib = anel(Ri, -h / 2), it = anel(Ri, h / 2), tb = anel(Ri, h / 2), to = anel(Ro, h / 2), bb = anel(Ri, -h / 2), bo = anel(Ro, -h / 2);
  q(ob, ot, false); q(ib, it, true); q(tb, to, true); q(bb, bo, false);
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new T.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals(); return g; }
function poe(K, g, c, mat, o) { return K._push(g, c, mat, Object.assign({}, o || {})); }
/* 5.0h.2 (ajuste do miolo): emissivo com cara de energia. A parte acesa usa o material emissivo de sempre (cor do vértice × brilho), sem
   sombreamento: uma esfera de cor única vira uma mancha chapada vista de cima. Aqui a cor de cada vértice vem de um ruído na direção do vértice:
   veios escuros, corpo médio, pontos quentes e os filetes claros do meio do ruído; girando (spin), o desenho corre como plasma */
function mancha(g, c0, c1, c2, f, sd) { const p = g.attributes.position, col = new Float32Array(p.count * 3), A = cor(c0), B = cor(c1), C = cor(c2);
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), l = Math.hypot(x, y, z) || 1; const n = fbm(x / l * f + sd, y / l * f + sd * 0.7, z / l * f, 3);
    const fil = Math.max(0, 1 - Math.abs(n - 0.52) * 11); let c = mixc(A, B, sst(0.28, 0.62, n)); c = mixc(c, C, Math.max(fil * 0.8, sst(0.7, 0.86, n))); col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2]; }
  g.setAttribute('color', new (TH().BufferAttribute)(col, 3)); return g; }
/* degradê na altura (jatos e gemas): claro numa ponta, escuro na outra, para a peça acesa ler a forma sem bloom */
function degrade(g, c0, c1, k) { const p = g.attributes.position; g.computeBoundingBox(); const y0 = g.boundingBox.min.y, y1 = g.boundingBox.max.y, A = cor(c0), B = cor(c1), col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) { const u = Math.pow((p.getY(i) - y0) / ((y1 - y0) || 1), k || 1); const c = mixc(A, B, u); col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2]; }
  g.setAttribute('color', new (TH().BufferAttribute)(col, 3)); return g; }
function gema(K, x, y, z, r, h, cb, ct, e) { const g = new (TH().OctahedronGeometry)(1, 0).scale(r, h / 2, r).translate(0, h / 2, 0); poe(K, degrade(g, cb, ct, 0.8), '#FFFFFF', null, { e, x, y, z, flat: true }); }

/* ---------- Despertos: o Arauto e a Sentinela ---------- */
/* pétala de vidro: espinha bezier no plano (raio, altura) no azimute a; meia-largura máxima w; o = { conc, rach (rachaduras acesas), veia, borda } */
function petala(K, a, B, w, t, o) { o = o || {}; const ca = Math.cos(a), sa = Math.sin(a); const n = ns(K, 16);
  const sp = bez(B, n).map((q, i) => { const u = i / (n - 1); const ww = w * Math.pow(Math.sin(PI * (0.12 + 0.88 * u)), 0.75) + 0.02, tt = t * (1 - 0.65 * u) + 0.02; return [ca * q[0], q[1], sa * q[0], ww, tt]; });
  const g = varre(sp, { n: ns(K, 10), lado: [-sa, 0, ca], dentro: [0, o.yc || 0, 0], conc: o.conc == null ? 0.18 : o.conc, c0: o.c0 || VID, c1: o.c1 || VID2, c2: o.c2 || VID3, borda: 0.9, ao: 0.35 });
  const Q = g.userData.quad; poe(K, g, '#FFFFFF', VIDRO, { pat: 4 });
  /* bordas acesas e a veia do meio (Éter) */
  const lin = (f, r, cc, e, step) => { const pts = []; for (let i = 0; i < Q.length; i += step || 1) { const q = Q[i]; const v = f(q, i / (Q.length - 1)); pts.push([v.x, v.y, v.z, r]); } if (pts.length > 2) K.trunk(pts, '#FFFFFF', null, { n: leve(K) ? 3 : 4, c0: cc, c1: cc, e }); };
  const ed = o.borda || ETER; if (!o.semBorda) for (const sg of [1, -1]) lin((q, u) => q.c.clone().addScaledVector(q.s, sg * q.w * 0.97).addScaledVector(q.n, q.h * 0.25 - (o.conc == null ? 0.18 : o.conc) * q.w * 0.63), 0.075, ed, o.ek || 1.7);
  if (o.veia) fino(K, () => lin(q => q.c.clone().addScaledVector(q.n, q.h * 1.04), 0.06, o.veia, 1.4, 1));
  fino(K, () => { const nr = []; for (let i = 1; i < Q.length - 1; i++) { const q = Q[i]; const v = q.c.clone().addScaledVector(q.n, q.h * 0.95); nr.push([v.x, v.y, v.z, q.h * 0.55]); } K.trunk(nr, '#FFFFFF', VIDRO, { n: 4, c0: VID3, c1: VID2 }); }); /* nervura de vidro (relevo, sem luz) */
  if (o.rach) { const r = rng(o.seed || 1); for (let k = 0; k < o.rach; k++) { const i0 = 2 + Math.floor(r() * (Q.length - 6)), len = 3 + Math.floor(r() * 3); const pts = []; let v = (r() - 0.5) * 1.2;
      for (let i = i0; i < Math.min(Q.length - 1, i0 + len); i++) { const q = Q[i]; v = Math.max(-0.8, Math.min(0.8, v + (r() - 0.5) * 0.9)); const p = q.c.clone().addScaledVector(q.s, v * q.w).addScaledVector(q.n, q.h * 1.08); pts.push([p.x, p.y, p.z, 0.09]); }
      if (pts.length > 2) K.trunk(pts, '#FFFFFF', null, { n: 3, c0: o.rcor || FEN, c1: o.rcor || FEN2, e: 2.6 }); } }
  return Q; }
/* lâmina da asa: do ombro na direção d (unitária), comprimento L, largura w; face voltada para cima/fora; borda de ataque acesa */
function lamina(K, sh, d, L, w, o) { o = o || {}; const n = ns(K, 10); const pts = []; const bx = o.recua || -0.18;
  for (let i = 0; i < n; i++) { const u = i / (n - 1); const curv = Math.sin(u * PI * 0.5); pts.push([sh[0] + d[0] * L * u + bx * L * curv * 0.35, sh[1] + d[1] * L * u, sh[2] + d[2] * L * u, w * Math.pow(Math.sin(PI * (0.1 + 0.9 * u)), 0.6) + 0.02, 0.32 * (1 - 0.6 * u) + 0.02]); }
  const g = varre(pts, { n: ns(K, 8), lado: [1, 0, 0], conc: 0.08, c0: o.c0 || VID2, c1: o.c1 || VID, c2: VID3, borda: 1.1 }); const Q = g.userData.quad; poe(K, g, '#FFFFFF', VIDRO, { pat: 4 });
  if (!o.semBorda) { const pe = []; for (let i = 1; i < Q.length; i++) { const q = Q[i]; const v = q.c.clone().addScaledVector(q.s, q.w * 0.95); pe.push([v.x, v.y, v.z, 0.12 * (1 - 0.5 * i / Q.length)]); } K.trunk(pe, '#FFFFFF', null, { n: 3, c0: o.borda || ETER, c1: o.borda2 || ETER2, e: 2.4 }); }
  return Q; }
/* contorno de lâmina só em luz (o eco das asas na fase 2) */
function laminaEco(K, sh, d, L, w, c) { const pts = [], pe = [], n = 6; for (let i = 0; i < n; i++) { const u = i / (n - 1), ww = w * Math.pow(Math.sin(PI * (0.1 + 0.9 * u)), 0.6); const x = sh[0] + d[0] * L * u - 0.06 * L * Math.sin(u * PI * 0.5), y = sh[1] + d[1] * L * u, z = sh[2] + d[2] * L * u; pts.push([x + ww, y, z, 0.07]); pe.push([x - ww, y, z, 0.07]); }
  K.trunk(pts, '#FFFFFF', null, { n: 3, c0: c, c1: c, e: 1.7 }); K.trunk(pe, '#FFFFFF', null, { n: 3, c0: c, c1: c, e: 1.2 }); }
/* anel de runas (faixa de ouro, runas acesas na face de fora), inclinado e girando em y; arcos = [[a0, al], ...] (partido nos Ecos) */
function anelRunas(K, yc, R, tilt, rz, speed, o) { o = o || {}; const arcos = o.arcos || [[0, TAU]]; const seg = ns(K, 72);
  K.anim({ t: 'spin', p: [0, 0, 0], speed, ph: o.ph || 0 }, () => grupo(K, new (TH().Matrix4)().makeTranslation(0, yc, 0).multiply(mat4(0, 0, 0, tilt, 0, rz)), () => {
    for (const [a0, al] of arcos) { poe(K, faixa(R, o.h || 1.1, o.th || 0.55, Math.max(6, Math.round(seg * al / TAU)), a0, al), o.cor || OURO, 'metal');
      if (!leve(K) || al > 1) { const ng = Math.max(1, Math.round((leve(K) ? 3 : 6) * al / TAU)), nr = ng * 3; for (let i = 0; i < nr; i++) { const a = a0 + (Math.floor(i / 3) + 0.5) / ng * al + ((i % 3) - 1) * 0.9 / R; const rr = R + (o.th || 0.55) / 2 + 0.04;
          K.box(Math.cos(a) * rr, -(o.h || 1.1) * 0.3, Math.sin(a) * rr, 0.16, (o.h || 1.1) * 0.6, 0.42, o.runa || ETER, null, { e: 2.3, ry: -a }); } } }
    fino(K, () => { poe(K, faixa(R - (o.th || 0.55) * 0.5 - 0.2, 0.3, 0.2, seg, 0, TAU), OURO2, 'metal'); }); })); }
/* olho: esclera de vidro, íris e pupila acesas; abre de 0 (fresta) a 1 (escancarado); olha para +x e um pouco para baixo */
function olho(K, c, r, abre, o) { o = o || {}; const T = TH(); grupo(K, new T.Matrix4().makeTranslation(c[0], c[1], c[2]).multiply(mat4(0, 0, 0, 0, 0, o.inclina == null ? -0.42 : o.inclina)), () => {
  const ir = o.iris || FEN, ir2 = o.iris2 || FEN2;
  K.sph(0, 0, 0, r, '#160C22', 'gloss', { seg: ns(K, 24) });
  K.tor(r * 0.93, 0, 0, r * (0.42 + 0.22 * abre), r * 0.08, ir, null, { e: 3.0, rz: PI / 2, ts: ns(K, 28) });
  K.cyl(r * 0.9, 0, 0, r * (0.4 + 0.2 * abre), r * (0.4 + 0.2 * abre), 0.12, '#2A0A3A', 'gloss', { rz: -PI / 2, seg: ns(K, 22) });
  if (abre > 0.6) { K.cyl(r * 0.97, 0, 0, r * 0.2, r * 0.2, 0.1, ir2, null, { e: 3.4, rz: -PI / 2, seg: ns(K, 16) }); fino(K, () => { for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; K.box(r * 0.98, Math.sin(a) * r * 0.33, Math.cos(a) * r * 0.33, 0.06, 0.1, r * 0.16, ir, null, { e: 2.2, rx: -a }); } }); }
  else K.box(r * 0.98, -r * 0.34, 0, 0.08, r * 0.68, 0.24, ir2, null, { e: 3.4 }); /* pupila em fenda */
  /* pálpebras: duas cascas que cobrem cima e baixo, deixando a fresta */
  const ab = 0.18 + 1.05 * abre; for (const sg of [1, -1]) { const g = new T.SphereGeometry(r * 1.08, ns(K, 22), ns(K, 10), PI / 2, PI, 0, PI / 2 - ab * 0.5); if (sg < 0) g.rotateX(PI); poe(K, g, VID, VIDRO_F, { pat: 4 });
    const e = new T.TorusGeometry(r * 1.08 * Math.sin(PI / 2 - ab * 0.5), 0.09, 4, ns(K, 24), PI); e.rotateX(PI / 2); e.rotateY(PI / 2); e.translate(0, sg * r * 1.08 * Math.cos(PI / 2 - ab * 0.5), 0); poe(K, e, o.palp || ETER, null, { e: 2.4 }); }
  if (o.alvo) { K.tor(r * 1.02, 0, 0, r * 1.18, 0.14, PER, null, { e: 3.0, rz: PI / 2, ts: ns(K, 32) }); fino(K, () => { for (let i = 0; i < 4; i++) { const a = i * PI / 2 + PI / 4; K.box(r * 1.05, Math.sin(a) * r * 1.45 - 0.2, Math.cos(a) * r * 1.45 - 0.08, 0.1, 0.4, 0.16, PER, null, { e: 3.0, rx: -a }); } }); } }); }
/* véu (tentáculo de vidro e luz) que pende da base; tipo: 'pende', 'puxado' (Colapso) ou 'murcho' (janela) */
function veu(K, a, r0, y0, L, tipo, sd) { const r = rng(sd); const ca = Math.cos(a), sa = Math.sin(a); const j = 0.6 + r() * 0.8; const pts = [];
  const P = tipo === 'puxado' ? [[r0, y0], [r0 + 3, y0 + 1.5], [r0 + 7 + j, y0 + 4], [r0 + 12 + j * 2, y0 + 6.5]] : tipo === 'murcho' ? [[r0, y0], [r0 + 0.8, y0 - L * 0.3], [r0 + 1.4 + j * 0.5, y0 - L * 0.7], [r0 + 1.2, y0 - L * 1.05]] : [[r0, y0], [r0 + 2.2, y0 - L * 0.25], [r0 + 3.6 + j, y0 - L * 0.62], [r0 + 3.2 + j, y0 - L]];
  const n = ns(K, 9); const S = bez(P, n); for (let i = 0; i < n; i++) { const u = i / (n - 1); pts.push([ca * S[i][0], S[i][1], sa * S[i][0], 0.55 * (1 - u) + 0.08]); }
  const anim = Math.abs(ca) > Math.abs(sa) ? { t: 'sway', p: [ca * r0, y0, sa * r0], amp: 0.1 + r() * 0.06, speed: 0.8 + r() * 0.5, ph: r() * TAU } : { t: 'flap', p: [ca * r0, y0, sa * r0], amp: 0.1 + r() * 0.06, speed: 0.8 + r() * 0.5, ph: r() * TAU, side: sa > 0 ? 1 : -1 };
  K.anim(tipo === 'puxado' ? { t: 'bob', amp: 0.5, speed: 1.6, ph: r() * TAU } : anim, () => { K.trunk(pts, '#FFFFFF', 'wet', { n: leve(K) ? 4 : 6, c0: VID2, c1: '#3FA9C8' });
    const tp = pts[n - 1]; K.sph(tp[0], tp[1], tp[2], 0.42, ETER2, null, { e: 3.0, seg: 8 });
    fino(K, () => { for (const f of [0.35, 0.62]) { const q = pts[Math.round(f * (n - 1))]; K.sph(q[0], q[1], q[2], 0.26, ETER, null, { e: 2.4, seg: 6 }); } }); }); }
/* corpo de um Desperto. v: '1' | '2' | '3' | 'j'; o.s escala; o.sent = Sentinela (âmbar, menor, sem escudo) */
function desperto(K, v, o) { o = o || {}; const s = o.s || 1, sent = !!o.sent; const YC = 27 * s; const ED = sent ? AMB : ETER, ED2 = sent ? AMB2 : ETER2;
  const NP = sent ? nq(K, 6, 0.67) : nq(K, 8, 0.75); const r = rng(sent ? 11 : 7);
  /* brilho interno (aparece entre as pétalas) */
  if (v === '1' || v === '2') { /* 5.0h.2 (ajuste): plasma atrás do olho (sem atravessar a frente dele), veios escuros e filetes claros girando, e os filamentos até as pétalas */
    const rr = (v === '2' ? 3.9 : 4.3) * s, cx = -2.6 * s, cA = sent ? '#2A1004' : '#16051F', cB = sent ? '#E0701A' : '#9A2BE0', cC = sent ? '#FFE6B0' : '#FFE0FF';
    K.anim({ t: 'spin', p: [cx, YC, 0], speed: 0.6 }, () => { poe(K, mancha(new (TH().SphereGeometry)(rr, ns(K, 30), ns(K, 20)), cA, cB, cC, 2.4, sent ? 7 : 3), '#FFFFFF', null, { e: v === '2' ? 1.7 : 1.3, x: cx, y: YC });
      fino(K, () => { for (let i = 0; i < 6; i++) { const a = (i + 0.5) / 6 * TAU * 0.78 + TAU * 0.11, ca = Math.cos(a), sa = Math.sin(a); const pts = []; for (let k = 0; k <= 4; k++) { const f = k / 4, rad = rr * 0.9 + f * 5.5 * s, j = (k % 2 ? 1 : -1) * 0.6 * s * Math.sin(f * PI);
          pts.push([cx + ca * rad - sa * j, YC + (f * (i % 2 ? 3 : -2.5) + Math.sin(i + k) * 0.6) * s, sa * rad + ca * j, 0.09 * s * (1 - 0.5 * f) + 0.03]); } K.trunk(pts, '#FFFFFF', null, { n: 3, c0: cC, c1: cB, e: 2.0 }); } }); }); }
  /* núcleo: olho (fases 1, 2 e janela) ou buraco negro (Colapso) */
  if (v === '3') {
    K.sph(0, YC, 0, 4.4 * s, '#05030A', [0.04, 0.6], { seg: ns(K, 24) });
    K.anim({ t: 'spin', p: [0, YC, 0], speed: 2.4 }, () => { K.tor(0, YC, 0, 5.0 * s, 0.32 * s, FEN2, null, { e: 3.6, ts: ns(K, 40), rx: 0.12 }); K.tor(0, YC, 0, 5.6 * s, 0.14 * s, '#FFFFFF', null, { e: 3.0, ts: ns(K, 40), rx: -0.2, rz: 0.15 }); });
    /* disco de acreção: braços em espiral (branco quente → magenta → violeta), duas faces */
    K.anim({ t: 'spin', p: [0, YC, 0], speed: 1.9 }, () => { const T = TH(); const NA = nq(K, 6, 0.67), NS = ns(K, 26); for (let k = 0; k < NA; k++) { const pos = [], col = [], idx = []; const a0 = k / NA * TAU;
        for (let i = 0; i <= NS; i++) { const u = i / NS, rr = (6.0 + 15 * Math.pow(u, 1.25)) * s, th = a0 + u * 2.6, wd = (0.6 + 2.4 * Math.sin(PI * Math.min(1, u * 1.15))) * s * 0.55; const cA = mixc(cor('#FFFFFF'), cor(FEN), sst(0, 0.45, u)), cB = mixc(cA, cor('#3A0E66'), sst(0.5, 1, u));
          for (const sg of [-1, 1]) { const rr2 = rr + sg * wd; pos.push(Math.cos(th) * rr2, YC + (sg * 0.05 - 0.04 * u) * s, Math.sin(th) * rr2); const f = 1 - 0.35 * Math.abs(sg); col.push(cB[0] * f, cB[1] * f, cB[2] * f); } }
        for (let i = 0; i < NS; i++) { const a = i * 2, b = a + 1, c = a + 2, d = a + 3; idx.push(a, b, c, b, d, c, a, c, b, b, c, d); }
        const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new T.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals(); poe(K, g, '#FFFFFF', null, { e: 2.6 }); } });
    /* jatos para cima e para baixo */
    { const T = TH(); poe(K, degrade(new T.ConeGeometry(0.9 * s, 26 * s, 10).translate(0, 13 * s, 0), '#FFFFFF', '#3A6E8C', 0.7), '#FFFFFF', null, { e: 2.5, y: YC + 4 * s }); poe(K, degrade(new T.ConeGeometry(0.8 * s, 20 * s, 10).translate(0, 10 * s, 0), '#FFFFFF', '#3A6E8C', 0.7), '#FFFFFF', null, { e: 2.3, y: YC - 4 * s, rx: PI });
      fino(K, () => poe(K, degrade(new T.ConeGeometry(1.7 * s, 15 * s, 12, 1, true).translate(0, 7.5 * s, 0), '#C27BFF', '#1A0628', 0.6), '#FFFFFF', null, { e: 1.2, y: YC + 4 * s })); } /* 5.0h.2 (ajuste): jatos claros no pé e apagando na ponta */
  } else { olho(K, [2.6 * s, YC + (v === 'j' ? 1.5 : 0) * s, 0], (v === 'j' ? 5.4 : 4.5) * s, v === 'j' ? 1 : v === '2' ? 0.35 : 0.08, { iris: sent ? AMB : FEN, iris2: sent ? AMB2 : FEN2, palp: ED, alvo: v === 'j', inclina: v === 'j' ? 0.75 : 0.2 }); /* olha para cima e para a frente: a câmera da partida vê o olho */ }
  /* pétalas do manto */
  const Bs = { '1': [[3.6, -7.5], [11.8, -5], [12.6, 10.5], [3.4, 18.5]], '2': [[3.6, -7.5], [13, -6], [17, 6], [16.5, 15.5]], 'j': [[3.6, -7.5], [14, -6.5], [20, -3], [23.5, 2]] };
  const abre = v === '1' ? 0 : 1; const span = sent ? TAU * 0.78 : TAU * 0.78; const a0 = (TAU - span) / 2;
  for (let i = 0; i < NP; i++) { const a = a0 + span * i / (NP - 1); const ph = i * 0.8;
    if (v === '3') { /* Colapso: a pétala se parte; a base fica, a ponta gira no redemoinho */
      const B = Bs['2'].map(q => [q[0] * s, q[1] * s + YC]); const Bb = [B[0], [B[0][0] + 3 * s, B[0][1] + 0.5 * s], [B[0][0] + 6 * s, B[0][1] + 3 * s], [B[0][0] + 7.5 * s, B[0][1] + 6 * s]];
      petala(K, a, Bb, 2.4 * s, 0.5 * s, { yc: YC, rach: 2, seed: i + 3 });
      K.anim({ t: 'spin', p: [0, YC, 0], speed: 1.25 + (i % 3) * 0.2 }, () => grupo(K, giro(0, YC, 0, 0.25 * Math.sin(i * 1.7), 0.5 + r() * 0.4, 0.18), () => grupo(K, new (TH().Matrix4)().makeTranslation(Math.cos(a) * (4 + r() * 3) * s, (r() - 0.4) * 5 * s, Math.sin(a) * (4 + r() * 3) * s), () =>
        petala(K, a, [[B[2][0] - 2 * s, B[2][1] - 3 * s], [B[2][0], B[2][1]], [B[3][0], B[3][1] - 2 * s], [B[3][0] + 1 * s, B[3][1]]], 2.6 * s, 0.4 * s, { yc: YC, rach: 1, seed: i + 9, borda: FEN }), true))); continue; }
    const B = Bs[v === 'j' ? 'j' : v].map(q => [q[0] * s, q[1] * s + YC]);
    K.anim({ t: 'bob', amp: (v === 'j' ? 0.18 : 0.32) * s, speed: v === 'j' ? 0.7 : 1.05, ph }, () => petala(K, a, B, (abre ? 4.6 : 4.3) * s, 0.8 * s, { yc: YC, rach: v === '2' ? 2 : v === 'j' ? 3 : 0, seed: i + 1, borda: ED, rcor: v === 'j' ? FEN2 : FEN }));
  }
  /* cálice: sépalas grossas de vidro que dobram para baixo (a massa do corpo), com o friso de ouro */
  if (v !== '3') { const NS = sent ? 5 : nq(K, 7, 0.72); for (let i = 0; i < NS; i++) { const a = (i + 0.5) / NS * TAU + 0.2; const B = (v === 'j' ? [[3.6, -8], [10, -9.5], [14.5, -14], [15, -19]] : [[3.6, -8], [9.5, -9], [13.5, -12], [14.5, -16.5]]).map(q => [q[0] * s, q[1] * s + YC]);
      K.anim(Math.abs(Math.cos(a)) > Math.abs(Math.sin(a)) ? { t: 'sway', p: [Math.cos(a) * 3.6 * s, YC - 8 * s, Math.sin(a) * 3.6 * s], amp: 0.045, speed: 0.8, ph: i } : { t: 'flap', p: [Math.cos(a) * 3.6 * s, YC - 8 * s, Math.sin(a) * 3.6 * s], amp: 0.045, speed: 0.8, ph: i, side: Math.sin(a) > 0 ? 1 : -1 }, () => {
        const Q = petala(K, a, B, 4.2 * s, 1.0 * s, { yc: YC - 14 * s, conc: -0.12, semBorda: true, c0: VID, c1: VID2, c2: VID });
        const pe = []; for (let k = 1; k < Q.length; k++) { const q = Q[k]; const v2 = q.c.clone().addScaledVector(q.s, q.w * 0.6).addScaledVector(q.n, q.h * 0.9); pe.push([v2.x, v2.y, v2.z, 0.22 * s]); } K.trunk(pe, OURO, 'metal', { n: 5 });
        const tp = Q[Q.length - 2].c; K.oct(tp.x, tp.y - 1.2 * s, tp.z, 0.5 * s, 2 * s, ED, null, { e: 2.4 }); }); } }
  /* colar da base das pétalas e a quilha embaixo */
  K.tor(0, YC - 8 * s, 0, 3.6 * s, 0.45 * s, OURO, 'metal', { ts: ns(K, 28) });
  fino(K, () => { for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; K.box(Math.cos(a) * 3.95 * s, YC - 8.35 * s, Math.sin(a) * 3.95 * s, 0.5 * s, 0.7 * s, 0.25 * s, ED, null, { e: 2.0, ry: -a }); } });
  for (let i = 0; i < (sent ? 4 : nq(K, 6, 0.67)); i++) { const a = i / (sent ? 4 : nq(K, 6, 0.67)) * TAU + 0.3; K.spike([Math.cos(a) * 2.2 * s, YC - 7.5 * s, Math.sin(a) * 2.2 * s], [Math.cos(a) * 3.6 * s, YC - (13 + (i % 3) * 2) * s, Math.sin(a) * 3.6 * s], 0.75 * s, '#FFFFFF', VIDRO, { n: 4, c0: VID2, c1: VID3 }); }
  K.spike([0, YC - 7 * s, 0], [0, YC - 19 * s, 0], 1.1 * s, '#FFFFFF', VIDRO, { n: 5, c0: VID2, c1: VID3 }); K.sph(0, YC - 19 * s, 0, 0.45 * s, ED2, null, { e: 3.0, seg: 8 });
  /* véus */
  const NV = sent ? nq(K, 7, 0.6) : nq(K, 12, 0.55); for (let i = 0; i < NV; i++) { const a = (i + 0.5) / NV * TAU; veu(K, a, (v === '3' ? 4.1 : 7.5 + (i % 2) * 2.5) * s, (v === '3' ? YC - 8 * s : YC - (11 + (i % 2) * 1.5) * s), (sent ? 13 : 17 + (i % 3) * 1.6) * s, v === '3' ? 'puxado' : v === 'j' ? 'murcho' : 'pende', i * 13 + (sent ? 5 : 1)); }
  /* coroa */
  const yk = YC + (v === 'j' ? 23 : v === '3' ? 20 : 21) * s;
  if (v === '3') grupo(K, giro(0, yk, 0, 0.6, 0, 0.45), () => coroa(K, yk, s, ED, 2.6, sent));
  else coroa(K, yk, s, ED, v === 'j' ? 0.25 : 0.45, sent);
  /* anéis de runas */
  const RS = v === '1' ? [17.5, 21] : v === '2' ? [19, 23] : v === '3' ? [8.5, 10.2] : [24, 28]; const SP = v === '3' ? [3.0, -3.6] : v === 'j' ? [0.22, -0.28] : v === '2' ? [0.9, -1.1] : [0.6, -0.75];
  const arc = v === '2' ? k => [[0.2 + k, 1.7], [2.25 + k, 1.6], [4.2 + k, 1.75]] : () => null;
  anelRunas(K, YC + 1 * s, RS[0] * s, 0.38, 0, SP[0], { arcos: arc(0), runa: ED, h: 1.2 * s, th: 0.6 * s }); if (!sent) anelRunas(K, YC + 1 * s, RS[1] * s, -0.3, 1.25, SP[1], { arcos: arc(0.8), runa: ED, h: 1.0 * s, th: 0.5 * s, ph: 1.3 });
  /* asas de lâminas soltas (Arauto: 4 por lado; Sentinela: 2) */
  const NL = sent ? 2 : nq(K, 4, 0.75); const LS = sent ? [10, 8] : [17, 21, 18.5, 13.5]; const ANG = v === '1' ? [-1.05, -1.3, -1.55, -1.8] : v === '2' ? [0.15, 0.45, 0.75, 1.05] : [-0.2, -0.02, 0.18, 0.38];
  for (const sg of [1, -1]) { const SH = [-1.5 * s, YC + 4 * s, sg * 7.2 * s];
    gema(K, SH[0], SH[1] - 1.2 * s, SH[2], 1.2 * s, 2.8 * s, sent ? '#5A2A06' : '#3A0A52', sent ? AMB2 : FEN2, 2.6); /* a gema do ombro, solta */
    if (v === '3') { /* Colapso: as lâminas arrancadas giram longe, no anel de fora */
      K.anim({ t: 'spin', p: [0, YC, 0], speed: -0.95 }, () => { for (let k = 0; k < NL; k++) { const a = (sg > 0 ? 0 : PI) + k * 0.7; grupo(K, giro(0, YC, 0, 0.35 * sg, a, 0.1), () => lamina(K, [0, YC + (k - 1.5) * 1.6 * s, 17 * s], [0.4, 0.05 * sg, 0.9 * sg].map((x, i, A) => x / Math.hypot(A[0], A[1], A[2])), LS[k] * 0.7 * s, 1.6 * s, { borda: FEN, borda2: FEN2 })); } }); continue; }
    K.anim({ t: 'flap', p: SH, amp: v === 'j' ? 0.07 : 0.16, speed: v === 'j' ? 2.2 : 1.2, side: sg }, () => { for (let k = 0; k < NL; k++) { const th = ANG[sent ? k + 1 : k]; const d = [-0.22, Math.sin(th), sg * Math.cos(th)]; const m = Math.hypot(d[0], d[1], d[2]); d[0] /= m; d[1] /= m; d[2] /= m;
        lamina(K, [SH[0] - k * 0.4 * s, SH[1] - k * 0.3 * s, SH[2]], d, LS[k] * s, (sent ? 1.8 : 2.7) * s, { borda: ED, borda2: ED2 }); } });
    if (v === '2' && !leve(K)) K.anim({ t: 'flap', p: SH, amp: 0.16, speed: 1.2, side: sg, ph: -0.7 }, () => { for (let k = 0; k < NL; k++) { const th = ANG[k] + 0.12; const d = [-0.3, Math.sin(th), sg * Math.cos(th)]; const m = Math.hypot(d[0], d[1], d[2]); laminaEco(K, [SH[0] - 2.6 * s, SH[1] + 0.8 * s, SH[2]], [d[0] / m, d[1] / m, d[2] / m], LS[k] * 1.03 * s, 1.8 * s, FEN); } });
  }
  /* escudo geodésico dos Três Pilares */
  if (v === '1' && !sent) K.anim({ t: 'spin', p: [0, YC + 2, 0], speed: 0.18 }, () => { const T = TH(); const ic = new T.IcosahedronGeometry(19.5, 0); const p = ic.attributes.position; const seen = new Set(), vs = new Map();
      for (let i = 0; i < p.count; i += 3) for (let k = 0; k < 3; k++) { const A = [p.getX(i + k), p.getY(i + k) + YC + 2, p.getZ(i + k)], B = [p.getX(i + (k + 1) % 3), p.getY(i + (k + 1) % 3) + YC + 2, p.getZ(i + (k + 1) % 3)]; const ka = A.map(x => x.toFixed(2)).join(), kb = B.map(x => x.toFixed(2)).join(); vs.set(ka, A); const key = ka < kb ? ka + '|' + kb : kb + '|' + ka; if (seen.has(key)) continue; seen.add(key); K.seg(A, B, 0.13, ETER, null, { e: 1.25, seg: 5 }); }
      ic.dispose(); for (const A of vs.values()) K.oct(A[0], A[1] - 0.4, A[2], 0.36, 0.8, ETER2, null, { e: 2.6 }); });
}
function coroa(K, y, s, ED, speed, sent) { K.anim({ t: 'spin', p: [0, y, 0], speed }, () => { poe(K, faixa(4.4 * s, 0.9 * s, 0.6 * s, ns(K, 40)).translate(0, y, 0), OURO, 'metal');
  const n = sent ? 6 : nq(K, 10, 0.6); for (let i = 0; i < n; i++) { const a = i / n * TAU; const h = (i % 2 ? 3.2 : 4.8) * s; K.oct(Math.cos(a) * 4.4 * s, y + 0.2 * s, Math.sin(a) * 4.4 * s, 0.5 * s, h, i % 2 ? VID3 : ED, i % 2 ? VIDRO : null, i % 2 ? { rz: Math.cos(a) * 0.25, rx: -Math.sin(a) * 0.25 } : { e: 2.6, rz: Math.cos(a) * 0.25, rx: -Math.sin(a) * 0.25 }); }
  gema(K, 0, y + 3.2 * s, 0, 1.2 * s, 4.2 * s, sent ? '#6A3408' : '#4A1066', sent ? AMB2 : FEN2, 3.0); }); }
function arauto(v) { return K => { K.base = 0; desperto(K, v, { s: 1 }); }; }
function sentinela(v) { return K => { K.base = 0; desperto(K, v === 'j' ? 'j' : '1', { s: 0.72, sent: true }); }; }

/* pilar dos Três Pilares: blocos de vidro que levitam um sobre o outro (cada um respira no seu ritmo), raízes de cristal e a coroa girando */
function pilar(K) { K.base = 0; const r = rng(23);
  for (let i = 0; i < nq(K, 7, 0.6); i++) { const a = i / nq(K, 7, 0.6) * TAU + 0.3, L = 6 + r() * 3.5; K.spike([Math.cos(a) * 1.8, 0.2, Math.sin(a) * 1.8], [Math.cos(a) * L, -0.6, Math.sin(a) * L], 1.4, '#FFFFFF', VIDRO, { n: 4, c0: VID, c1: VID3 });
    fino(K, () => K.seg([Math.cos(a) * 2.4, 0.15, Math.sin(a) * 2.4], [Math.cos(a) * (L - 1), 0.05, Math.sin(a) * (L - 1)], 0.09, ETER, null, { e: 2.0, seg: 4 })); }
  K.prism(0, -0.5, 0, 4.4, 2.5, 6, '#2B2733', 'rock', { top: 0.82 }); K.tor(0, 1.9, 0, 3.7, 0.2, OURO, 'metal', { ts: ns(K, 24) });
  const H = [4.6, 4.2, 3.8, 3.4, 3.0], W = [3.1, 2.8, 2.5, 2.2, 1.9]; let y = 2.6;
  for (let i = 0; i < H.length; i++) { const yy = y, w = W[i], h = H[i];
    K.anim({ t: 'bob', amp: 0.25 + i * 0.06, speed: 0.9 + i * 0.13, ph: i * 1.1 }, () => grupo(K, giro(0, yy, 0, 0, i * 0.32, 0), () => {
      K.prism(0, yy, 0, w, h, 6, VID, VIDRO_F, { top: 0.88, pat: 4 }); K.prism(0, yy + h - 0.25, 0, w * 0.9 + 0.05, 0.3, 6, OURO, 'metal', { top: 0.95 });
      for (let k = 0; k < 6; k++) { const a = k / 6 * TAU + PI / 6; if ((k + i) % 2 && leve(K)) continue; K.box(Math.cos(a) * w * 0.86, yy + h * 0.25, Math.sin(a) * w * 0.86, 0.14, h * 0.5, 0.5, ETER, null, { e: 2.2, ry: -a }); }
      K.cyl(0, yy - 0.5, 0, w * 0.55, w * 0.55, 0.5, ETER2, null, { e: 1.8, seg: 6 }); })); y += h + 0.7; }
  K.anim({ t: 'spin', p: [0, y + 3, 0], speed: 1.3 }, () => { K.oct(0, y + 0.3, 0, 2.3, 7.4, ETER2, null, { e: 2.8 }); K.oct(0, y + 1.3, 0, 1.2, 5.2, '#FFFFFF', null, { e: 3.2 }); poe(K, faixa(4.0, 0.5, 0.3, ns(K, 32)).rotateX(0.35).translate(0, y + 4, 0), OURO, 'metal');
    for (let k = 0; k < 3; k++) { const a = k * 2.094; K.oct(Math.cos(a) * 4.6, y + 2.4 + k * 0.8, Math.sin(a) * 4.6, 0.6, 2.2, VID3, VIDRO, { rz: 0.4 }); } }); }
/* marca do ponto fraco: losango âmbar girando, aro e a seta para baixo */
function marca(K) { K.base = 0; K.anim({ t: 'spin', p: [0, 0, 0], speed: 2.2 }, () => { K.oct(0, 0, 0, 1.6, 4.4, PER, null, { e: 3.2, seg: 4 }); K.tor(0, 2.2, 0, 2.6, 0.18, PER, null, { e: 2.6, ts: 24 }); K.cyl(0, -0.4, 0, 0.35, 0.35, 0.8, '#1C1A18', 'dark', { seg: 6 }); /* 5.0g junção: miolo escondido não emissivo — com parte principal a malha ganha o atributo pt e divide o pipeline do material da Raça (só emissiva, era uma variante a mais + a sombra dela) */
  for (let k = 0; k < 4; k++) { const a = k * PI / 2; K.box(Math.cos(a) * 3.3, 1.6, Math.sin(a) * 3.3, 0.9, 0.22, 0.22, PER, null, { e: 2.4, ry: -a }); } }); }

/* ---------- A Forja-Mãe (Construtores) ---------- */
let PAL_F = null; /* as cores lineares nascem na primeira montagem (o three carrega depois deste arquivo) */
function bronze(x, y, z, k) { if (!PAL_F) PAL_F = { PB: cor(BRZ), PB2: cor(BRZ2), PA: cor(ACO) }; const { PB, PB2, PA } = PAL_F; const n = fbm(x * 0.35 + 3, y * 0.35, z * 0.35, 3); const t = sst(0.35, 0.75, n); let c = mixc(PB, PB2, t * 0.8); c = mixc(c, PA, sst(0.6, 0.85, fbm(x * 0.9, y * 0.9 + 5, z * 0.9, 2)) * 0.5); const ao = 0.55 + 0.45 * sst(-0.9, 0.4, k == null ? 0 : k); return [c[0] * ao, c[1] * ao, c[2] * ao]; }
/* placa do dorso (arco por cima, de um lado ao outro), com o friso de ouro na frente; aberta = gira em volta da borda da frente */
function placa(K, xk, w, aberta, Y) { const n = ns(K, 14); const pts = []; for (let i = 0; i < n; i++) { const z = -15.6 + 31.2 * i / (n - 1), c = Math.cos(z / 16.2 * PI / 2); pts.push([xk, Y + 6 * Math.pow(Math.max(0, c), 1.1) - (Math.abs(xk) > 12 ? 1.6 : 0), z, w, 1.15]); }
  const g = varre(pts, { n: ns(K, 10), lado: [Math.cos(0.28), Math.sin(0.28), 0], dentro: [xk, Y - 6, 0], conc: -0.08, c0: BRZ, c1: BRZ, c2: ESC, borda: 0.5 });
  const col = g.attributes.color, p = g.attributes.position; for (let i = 0; i < p.count; i++) { const b = bronze(p.getX(i), p.getY(i), p.getZ(i), 0.4); const lz = 1.25 + 0.5 * Math.pow(Math.max(0, Math.cos(p.getZ(i) / 16.2 * PI / 2)), 3); col.setXYZ(i, b[0] * 1.45 * lz, b[1] * 1.45 * lz, b[2] * 1.45 * lz); }
  const M = aberta ? new (TH().Matrix4)().makeTranslation(0, 1.2, 0).multiply(giro(xk + w * 0.9, Y, 0, 0, 0, -0.62)) : new (TH().Matrix4)(); grupo(K, M, () => { poe(K, g, '#FFFFFF', BRONZE, { pat: 1 }); const Q = g.userData.quad;
    const fr = []; for (const q of Q) { const v = q.c.clone().addScaledVector(q.s, q.w * 0.98).addScaledVector(q.n, 0.15); fr.push([v.x, v.y, v.z, 0.32]); } K.trunk(fr, OV, 'metal', { n: 5 });
    const qm = Q[Math.floor(Q.length / 2)], vm = qm.c.clone().addScaledVector(qm.n, 0.9); K.spike([vm.x, vm.y - 0.4, vm.z - 0.9], [vm.x - 1.4, vm.y + (Math.abs(xk) > 12 ? 2.6 : 4.2), vm.z], 1.1, '#FFFFFF', BRONZE, { n: 4, c0: BRZ2, c1: OV });
    fino(K, () => { for (let i = 2; i < Q.length - 2; i += 3) { if (Math.abs(i - Q.length / 2) < 2) continue; const q = Q[i]; const v = q.c.clone().addScaledVector(q.n, 0.9); K.oct(v.x, v.y - 0.2, v.z, 0.45, 1.6, OV, 'metal'); } }); }); }
function chamine(K, x, y, z, r, h, tilt) { grupo(K, giro(x, y, z, 0, 0, tilt), () => { K.cyl(x, y, z, r * 0.82, r, h, ESC, 'dark', { seg: ns(K, 14) }); for (const f of [0.3, 0.62]) K.tor(x, y + h * f, z, r * 0.96, 0.26, OV, 'metal', { ts: ns(K, 18) });
  K.tor(x, y + h, z, r * 0.84, 0.32, BRASA, null, { e: 2.6, ts: ns(K, 18) }); K.cyl(x, y + h - 0.25, z, r * 0.66, r * 0.66, 0.3, BRASA2, null, { e: 3.0, seg: ns(K, 12) });
  fino(K, () => { for (let k = 0; k < 4; k++) { const a = k * PI / 2 + 0.4; K.box(x + Math.cos(a) * r * 0.9, y + h * 0.82, z + Math.sin(a) * r * 0.9, 0.35, 1.6, 0.35, ESC, 'dark', { ry: -a }); } }); }); }
/* braço-guindaste (mandíbula) com a tocha de solda na ponta */
function braco(K, sg, aberto) { const S = [13, 27, sg * 11.5], E = aberto ? [20, 33, sg * 13.8] : [19.5, 31, sg * 13], P = aberto ? [25.5, 27.5, sg * 9.5] : [24, 25.5, sg * 8];
  K.anim({ t: 'sway', p: S, amp: 0.07, speed: 1.6, ph: sg > 0 ? 0 : 1.9 }, () => { K.sph(S[0], S[1], S[2], 1.9, BRZ2, 'metal', { seg: ns(K, 14) });
    K.trunk([[S[0], S[1], S[2], 1.25], [(S[0] + E[0]) / 2, (S[1] + E[1]) / 2 + 0.8, (S[2] + E[2]) / 2, 1.05], [E[0], E[1], E[2], 0.9]], '#FFFFFF', 'metal', { n: ns(K, 8), c0: BRZ, c1: BRZ2 });
    K.sph(E[0], E[1], E[2], 1.2, OV, 'metal', { seg: ns(K, 12) }); K.trunk([[E[0], E[1], E[2], 0.8], [(E[0] + P[0]) / 2, (E[1] + P[1]) / 2 + 0.4, (E[2] + P[2]) / 2, 0.7], [P[0], P[1], P[2], 0.5]], '#FFFFFF', 'metal', { n: ns(K, 7), c0: BRZ2, c1: ACO2 });
    fino(K, () => K.seg([S[0] + 0.5, S[1] - 1.2, S[2]], [(E[0] + P[0]) / 2, (E[1] + P[1]) / 2 - 0.6, (E[2] + P[2]) / 2], 0.28, COB, 'metal', { seg: 6 }));
    for (let k = 0; k < 3; k++) { const a = k * TAU / 3; K.spike([P[0] - 0.3, P[1] + Math.cos(a) * 0.5, P[2] + Math.sin(a) * 0.5], [P[0] + 1.7, P[1] + Math.cos(a) * 1.1 - 0.4, P[2] + Math.sin(a) * 1.1], 0.32, '#FFFFFF', 'metal', { n: 3, c0: BRZ2, c1: OV }); }
    K.cone(P[0] + 0.2, P[1], P[2], 0.35, 1.5, SOLDA, null, { e: 3.4, seg: 8, rz: -PI / 2 }); }); }
function forjaCorpo(fase) { return K => { const caida = fase === 3, b = fase === 2; K.base = caida ? 1.5 : 0; const r = rng(31);
  if (caida) return forjaCaida(K);
  const Y = 20.5;
  /* casco: bloco esculpido (quase uma caixa arredondada), barriga achatada, bronze com pátina */
  poe(K, esculpe(ns(K, 40), ns(K, 22), 19.5, 8, 15, (x, y, z) => { const p = 3.2; let rr = 1 / Math.pow(Math.pow(Math.abs(x), p) + Math.pow(Math.abs(y), p) + Math.pow(Math.abs(z), p), 1 / p); if (y < 0) rr *= 0.9 + 0.1 * (1 + y); return rr * (1 + 0.025 * (fbm(x * 4, y * 4, z * 4, 2) - 0.5)); }, (x, y, z) => bronze(x * 19.5, y * 8, z * 15, y)).translate(0, Y, 0), '#FFFFFF', BRONZE, { pat: 1 });
  /* placas do dorso e as costuras de metal derretido entre elas */
  const XS = [14.2, 8.6, 3.0, -2.6, -8.2, -13.8]; for (const xk of XS) placa(K, xk, 3.4, b, Y + 4.6);
  for (let i = 0; i < XS.length - 1; i++) { const xs = (XS[i] + XS[i + 1]) / 2 + 0.6, n = ns(K, 10), pts = []; for (let k = 0; k < n; k++) { const z = -14 + 28 * k / (n - 1), c = Math.cos(z / 16.2 * PI / 2); pts.push([xs, Y + 3.6 + 6 * Math.pow(Math.max(0, c), 1.1) - (Math.abs(xs) > 12 ? 1.6 : 0), z, b ? 0.85 : 0.5]); } K.trunk(pts, '#FFFFFF', null, { n: 4, c0: b ? BRASA2 : BRASA, c1: b ? BRASA2 : BRASA, e: b ? 3.0 : 2.3 }); }
  /* encaixes das pernas nos quatro cantos */
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { K.sph(sx * 15, 22.5, sz * 12, 4.3, BRZ2, 'metal', { seg: ns(K, 18), sy: 0.92 }); K.tor(sx * 15, 21.2, sz * 12, 4.1, 0.38, BRASA, null, { e: 2.2, ts: ns(K, 22) });
    fino(K, () => { for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; K.box(sx * 15 + Math.cos(a) * 3.7, 25.4, sz * 12 + Math.sin(a) * 3.7, 0.7, 0.5, 1.3, OV, 'metal', { ry: -a }); } }); }
  /* bocarra da frente: maxilares, dentes de prensa, a fornalha lá dentro */
  K.anim({ t: 'spin', p: [16.8, 19.5, 0], speed: 0.7, axis: 'x' }, () => poe(K, mancha(new (TH().SphereGeometry)(4.6, ns(K, 22), ns(K, 14)), '#2A0800', '#FF5A12', '#FFE6A0', 2.2, 11), '#FFFFFF', null, { e: b ? 2.4 : 1.8, x: 16.8, y: 19.5, sx: 0.7 })); /* 5.0h.2 (ajuste): fornalha com veios */ K.tor(18.2, 19.5, 0, 4.9, 0.5, ESC, 'dark', { rz: PI / 2, ts: ns(K, 24) });
  const ja = b ? 0.5 : 0.04, jb = b ? -0.34 : -0.03;
  K.anim(b ? { t: 'sway', p: [15, 23, 0], amp: 0.05, speed: 2.6 } : null, () => grupo(K, giro(15, 23, 0, 0, 0, ja), () => { K.box(19.5, 22.3, 0, 9, 3.2, 17, BRZ, 'metal', { b: 0.6 }); K.box(23.6, 21.6, 0, 1.6, 1.4, 15, OV, 'metal', { b: 0.3 });
    for (let k = 0; k < nq(K, 7, 0.6); k++) K.box(22.6, 21.0, -6.6 + 13.2 * k / (nq(K, 7, 0.6) - 1), 1.2, 1.6, 1.3, ACO2, 'steel', { b: 0.15 }); }));
  grupo(K, giro(15, 17, 0, 0, 0, jb), () => { K.box(19.5, 14.6, 0, 9, 2.6, 16, BRZ, 'metal', { b: 0.5 }); for (let k = 0; k < nq(K, 6, 0.6); k++) K.box(22.6, 17.0, -6 + 12 * k / (nq(K, 6, 0.6) - 1), 1.2, 1.4, 1.3, ACO2, 'steel', { b: 0.15 }); });
  if (b) { for (let k = 0; k < 3; k++) K.anim({ t: 'spin', p: [15.5 + k * 1.6, 17.6, 0], speed: 4, axis: 'z' }, () => K.cyl(15.5 + k * 1.6, 17.6, -6.5, 0.6, 0.6, 13, ACO2, 'steel', { rx: PI / 2, seg: 10 })); for (let k = 0; k < 4; k++) K.box(16 + k * 1.2, 18.3, -4 + k * 2.4, 0.9, 0.5, 0.9, BRASA2, null, { e: 3.0 }); }
  /* fronte: placa da testa, três olhos de lente antiga e os chifres-antena */
  poe(K, esculpe(ns(K, 28), ns(K, 18), 6.4, 4.6, 7.2, (x, y, z) => 1 + 0.16 * Math.max(0, y) * (1 - Math.abs(z)) - 0.12 * Math.max(0, -x) + 0.03 * (fbm(x * 5, y * 5, z * 5, 2) - 0.5), (x, y, z) => bronze(x * 6 + 19, y * 4 + 26, z * 7, y + 0.3)).translate(19.2, 26.4, 0), '#FFFFFF', BRONZE, { pat: 1 });
  K.box(19, 29.6, 0, 7.5, 1.4, 12.5, OV, 'metal', { b: 0.5, rz: -0.18 }); /* a sobrancelha de ouro velho */
  for (const [ez, ey, er] of [[-2.9, 26.6, 1.15], [2.9, 26.6, 1.15], [0, 28.3, 0.9]]) { K.sph(24.6, ey, ez, er, BRASA2, null, { e: 3.0, seg: ns(K, 12) }); K.tor(24.7, ey, ez, er * 1.18, 0.26, ESC, 'dark', { rz: PI / 2, ts: ns(K, 16) }); }
  for (const sg of [1, -1]) K.trunk([[18, 29.8, sg * 4.6, 1.35], [14.5, 34.5, sg * 6.8, 1.0], [9.5, 37.5, sg * 9, 0.6], [5, 37.6, sg * 10.6, 0.1]], '#FFFFFF', 'metal', { n: ns(K, 8), c0: BRZ2, c1: OV });
  /* chaminés do dorso, inclinadas para trás */
  chamine(K, -5, 29.5, -6.6, 2.1, 11.5, 0.24); chamine(K, -5, 29.5, 6.6, 2.1, 11.5, 0.24); chamine(K, -11.2, 28.5, -4.8, 2.5, 15, 0.3); chamine(K, -11.2, 28.5, 4.8, 2.5, 15, 0.3); fino(K, () => chamine(K, -16.5, 25.5, 0, 1.5, 9, 0.36));
  /* braços-guindaste */
  braco(K, 1, b); braco(K, -1, b);
  /* flancos: canos de cobre, a escrita antiga acesa e as aletas */
  for (const sg of [1, -1]) { K.trunk([[14, 17.5, sg * 14.6, 0.5], [6, 16.8, sg * 15.4, 0.5], [-4, 17.2, sg * 15.4, 0.5], [-14, 18.2, sg * 14.4, 0.5]], '#FFFFFF', 'metal', { n: 6, c0: COB, c1: COB });
    fino(K, () => { for (let k = 0; k < 16; k++) { const x = -13 + k * 1.7; if (k % 5 === 4) continue; K.box(x, 21 + (k % 2) * 0.35, sg * 15.25, 0.55, 0.5 + (k % 3) * 0.18, 0.2, BRASA2, null, { e: 1.5 }); } });
    for (let k = 0; k < 4; k++) K.box(-9 + k * 2.4, 13.6, sg * 12.6, 0.5, 3.2, 3.6, ESC, 'dark', { rz: 0.15 }); }
  /* traseira: três baias de produção (abertas e acesas na Linha de montagem) */
  for (const z of [-7, 0, 7]) { if (b) { K.box(-19.6, 15.5, z, 0.6, 6.5, 5, BRASA, null, { e: 2.6 }); K.box(-20.6, 22.6, z, 1.0, 0.6, 5.4, ACO2, 'steel', { rz: 0.6 }); }
    else { K.box(-19.7, 15.5, z, 0.9, 6.5, 5, ACO2, 'steel', { b: 0.2 }); K.box(-20.2, 18.4, z, 0.3, 0.45, 4.8, BRASA, null, { e: 1.8 }); } }
  /* barriga: costelas de baixo e correntes */
  fino(K, () => { for (let k = 0; k < 4; k++) { const x = -9 + k * 6; K.trunk([[x, 14.4, -11, 0.45], [x, 12.4, -5, 0.5], [x, 12.0, 0, 0.5], [x, 12.4, 5, 0.5], [x, 14.4, 11, 0.45]], '#FFFFFF', 'metal', { n: 5, c0: ESC, c1: BRZ }); }
    for (let k = 0; k < 5; k++) { const x = -12 + k * 6 + r() * 2, z = (r() - 0.5) * 16; K.trunk([[x, 13.2, z, 0.18], [x + 0.6, 9.5 + r() * 2, z + 0.4, 0.16]], ACO, 'metal', { n: 4 }); } });
}; }
function forjaCaida(K) { const r = rng(41);
  grupo(K, giro(0, 0, 0, -0.05, 0, 0.06), () => {
    poe(K, esculpe(ns(K, 36), ns(K, 18), 19.5, 6.6, 15, (x, y, z) => { const p = 3.0; let rr = 1 / Math.pow(Math.pow(Math.abs(x), p) + Math.pow(Math.abs(y), p) + Math.pow(Math.abs(z), p), 1 / p); return rr * (1 + 0.06 * (fbm(x * 3, y * 3, z * 3, 3) - 0.5)); }, (x, y, z) => { const c = bronze(x * 19.5, y * 6.6, z * 15, y); return [c[0] * 0.8, c[1] * 0.75, c[2] * 0.75]; }).translate(0, 5.2, 0), '#FFFFFF', 'metal', { pat: 1 });
    /* a cavidade aberta: brasa no fundo e as costelas em volta do núcleo */
    poe(K, mancha(new (TH().SphereGeometry)(7.0, ns(K, 26), ns(K, 10), 0, TAU, 0, PI / 2), '#200600', '#E04A0E', '#FFD27A', 2.0, 21), '#FFFFFF', null, { e: 1.8, y: 8.2, sy: 0.5 }); /* 5.0h.2 (ajuste) */
    for (let k = 0; k < nq(K, 6, 0.67); k++) { const x = -7 + k * 2.8; K.trunk([[x, 10, -9.5, 0.6], [x + 0.4, 15.5, -6.5, 0.55], [x + 0.8, 18.5, -1.5 - k * 0.2, 0.45], [x + 1.2, 17, 2.5, 0.35], [x + 1.4, 14.5, 4.2, 0.12]], '#FFFFFF', 'metal', { n: 6, c0: BRZ, c1: OV }); }
    /* as placas que ficaram, tortas e soltas; rachaduras acesas no casco */
    for (const [xk, rx, rz] of [[-8.2, 0.18, 0.2], [-13.8, -0.25, 0.3], [9.4, -0.3, -0.35], [14.6, 0.22, -0.5]]) grupo(K, giro(xk, 9, 0, rx, 0, rz), () => placa(K, xk, 3.4, false, 3.6));
    for (let i = 0; i < nq(K, 9, 0.6); i++) { const a = r() * TAU, rr = 0.55 + r() * 0.35; const x0 = Math.cos(a) * 19.5 * rr, z0 = Math.sin(a) * 15 * rr; const pts = []; let x = x0, z = z0; for (let k = 0; k < 5; k++) { const yy = 5.2 + 6.6 * Math.sqrt(Math.max(0, 1 - (x / 19.5) ** 2 - (z / 15) ** 2)) * 0.98; pts.push([x, yy + 0.15, z, 0.16]); x += (r() - 0.5) * 3.2 - Math.cos(a) * 1.2; z += (r() - 0.5) * 3.2 - Math.sin(a) * 1.2; } K.trunk(pts, '#FFFFFF', null, { n: 3, c0: BRASA2, c1: BRASA, e: 2.6 }); }
    for (const sg of [1, -1]) { K.trunk([[13, 9, sg * 11.5, 1.2], [18, 6, sg * 14.5, 1.0], [21, 1.2, sg * 16.5, 0.8]], '#FFFFFF', BRONZE, { n: ns(K, 8), c0: BRZ, c1: BRZ2 }); K.sph(21, 1.2, sg * 16.5, 1.1, OV, 'metal', { seg: 10 }); K.trunk([[16.5, 10.6, sg * 4.6, 1.2], [13.5, 13.2, sg * 6.8, 0.9], [11.5, 13.6, sg * 7.6, 0.25]], '#FFFFFF', 'metal', { n: ns(K, 6), c0: BRZ2, c1: OV }); }
    /* bocarra caída, os olhos quase apagados, chaminés quebradas */
    grupo(K, giro(15, 8, 0, 0.12, 0, -0.35), () => { K.box(19.5, 6.6, 0, 9, 3.2, 17, BRZ, 'metal', { b: 0.6 }); K.box(17.5, 9.6, 0, 6.5, 2.6, 12, BRZ2, 'metal', { b: 0.6 }); for (const ez of [-2.9, 2.9]) K.sph(20.8, 10.5, ez, 1.0, '#7A3A12', null, { e: 1.2, seg: 10 }); });
    poe(K, mancha(new (TH().SphereGeometry)(4.0, ns(K, 18), ns(K, 12)), '#1E0600', '#C8400C', '#FFC66A', 2.0, 23), '#FFFFFF', null, { e: 1.5, x: 16.6, y: 6.5, sx: 0.6 });
    chamine(K, -11.2, 9.5, -4.6, 2.0, 6.5, 0.55); fino(K, () => chamine(K, -5, 10, 6.3, 1.7, 3.5, -0.4));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { K.cyl(sx * 15, 2, sz * 12, 2.6, 3.2, 4.5, ESC, 'dark', { seg: ns(K, 12) }); K.cyl(sx * 15, 6.4, sz * 12, 2.0, 2.0, 0.3, BRASA, null, { e: 2.2, seg: ns(K, 10) }); }
  });
  /* chaminé tombada, placas arrancadas no chão, metal derretido escorrendo e poças */
  K.cyl(-19, 1.6, -15, 1.9, 2.1, 11, ESC, 'dark', { seg: ns(K, 12), rz: PI / 2 - 0.12, ry: 0.6 });
  grupo(K, giro(10, 0, -19, 1.2, 0.4, 0), () => placa(K, 10, 3.2, false, -2.2)); fino(K, () => grupo(K, giro(-4, 0, 20, -1.25, -0.3, 0), () => placa(K, -4, 3.2, false, -2.2)));
  for (let i = 0; i < nq(K, 7, 0.6); i++) { const a = i * 0.9 + 0.3, x0 = Math.cos(a) * 9, z0 = Math.sin(a) * 8, x1 = Math.cos(a) * 15, z1 = Math.sin(a) * 13.5;
    K.trunk([[x0, 7.5, z0, 0.4], [(x0 + x1) / 2, 4.5, (z0 + z1) / 2, 0.35], [x1, 0.3, z1, 0.5]], '#FFFFFF', null, { n: 4, c0: BRASA2, c1: BRASA, e: 2.6 }); K.cyl(x1, 0, z1, 2.2 + r(), 2.6 + r(), 0.2, BRASA, null, { e: 2.2, seg: ns(K, 12) }); }
  fino(K, () => { for (let i = 0; i < 14; i++) { const a = r() * TAU, d = 16 + r() * 9; K.box(Math.cos(a) * d, 0, Math.sin(a) * d, 0.5 + r() * 0.6, 0.4, 0.5 + r() * 0.6, i % 3 ? ESC : BRASA, i % 3 ? 'dark' : null, i % 3 ? { ry: r() * 3 } : { e: 2.4, ry: r() * 3 }); } });
}
/* a perna inteira: quadril em (0, 22, 0), joelho alto e pé no chão a +x; leg na GPU (passo). Coxa blindada, joelho com o anel aceso e o espigão,
   canela com placas e o pistão, pé de três garras com o esporão */
function pernaPecas(K, ac) { const Hp = [0, 22, 0], Kn = [9, 30.5, 0], An = [15.6, 3.6, 0], Ft = [17, 0.9, 0];
  K.sph(Hp[0], Hp[1], Hp[2], 2.9, BRZ2, 'metal', { seg: ns(K, 16) });
  K.trunk([[Hp[0], Hp[1], 0, 3.0], [4.5, 27.4, 0, 3.3], [Kn[0] - 1, Kn[1] - 0.3, 0, 2.4]], '#FFFFFF', BRONZE, { n: ns(K, 12), c0: BRZ, c1: BRZ2 });
  const coxa = varre([[0.2, 25.4, 0, 0.4, 0.3], [2.5, 28.6, 0, 3.4, 0.7], [5.5, 31.6, 0, 3.1, 0.6], [8.4, 33.6, 0, 0.4, 0.3]], { n: ns(K, 10), lado: [0, 0, 1], dentro: [4, 26, 0], conc: 0.45, c0: BRZ2, c1: BRZ, borda: 0.6 }); poe(K, coxa, '#FFFFFF', BRONZE, { pat: 1 });
  K.sph(Kn[0], Kn[1], Kn[2], 3.2, ESC, 'dark', { seg: ns(K, 16) }); K.tor(Kn[0], Kn[1], Kn[2], 3.25, 0.4, ac ? BRASA : '#5A2A10', null, { e: ac ? 2.4 : 0.9, rz: PI / 2, ts: ns(K, 22) });
  K.spike([Kn[0] + 0.5, Kn[1] + 1.8, 0], [Kn[0] + 4.2, Kn[1] + 5.2, 0], 0.9, '#FFFFFF', 'metal', { n: 4, c0: BRZ2, c1: OV });
  K.trunk([[Kn[0], Kn[1], 0, 2.9], [12.6, 18, 0, 2.4], [An[0], An[1], 0, 1.7]], '#FFFFFF', BRONZE, { n: ns(K, 14), c0: ACO, c1: BRZ });
  for (const f of [0.3, 0.55, 0.78]) { const x = Kn[0] + (An[0] - Kn[0]) * f, y = Kn[1] + (An[1] - Kn[1]) * f; K.tor(x, y, 0, 2.75 - f * 1.1, 0.32, OV, 'metal', { ts: ns(K, 18), rz: -0.26 }); }
  { const jo = varre([[Kn[0] - 3, Kn[1] + 1.2, 0, 0.5, 0.3], [Kn[0] - 0.5, Kn[1] + 3.6, 0, 3.4, 0.7], [Kn[0] + 2.4, Kn[1] + 1.6, 0, 3.0, 0.6], [Kn[0] + 3.4, Kn[1] - 2.5, 0, 0.5, 0.3]], { n: ns(K, 10), lado: [0, 0, 1], dentro: [Kn[0], Kn[1], 0], conc: 0.6, c0: BRZ2, c1: BRZ, borda: 0.8 }); poe(K, jo, '#FFFFFF', BRONZE, { pat: 1 }); } /* joelheira */
  { const cn = varre([[Kn[0] + 1.2, Kn[1] - 1, 0, 0.5, 0.3], [11.6, 23, 0, 3.6, 0.7], [13.9, 13, 0, 3.1, 0.6], [15.6, 6, 0, 0.5, 0.3]].map(q => [q[0] + 1.3, q[1], q[2], q[3], q[4]]), { n: ns(K, 10), lado: [0, 0, 1], dentro: [10, 15, 0], conc: 0.55, c0: BRZ, c1: BRZ2, borda: 0.6 }); poe(K, cn, '#FFFFFF', BRONZE, { pat: 1 }); } /* caneleira */
  K.seg([2.2, 24.5, 1.5], [11.8, 21.5, 1.5], 0.55, ACO2, 'steel', { seg: ns(K, 8) }); K.seg([6.5, 23.5, 1.5], [12.2, 15, 1.5], 0.38, COB, 'metal', { seg: ns(K, 8) }); /* pistão */
  fino(K, () => { K.trunk([[0.5, 23, -1.6, 0.25], [4, 24.5, -2.6, 0.25], [7.5, 28, -2.3, 0.22]], ESC, 'rubber', { n: 4 }); K.trunk([[1, 22, 1.8, 0.22], [5, 22.5, 2.6, 0.22], [9, 26.5, 2.2, 0.2]], ESC, 'rubber', { n: 4 }); });
  K.sph(An[0], An[1], An[2], 1.5, ESC, 'dark', { seg: ns(K, 12) });
  for (const [dx, dz] of [[1, 0], [0.7, 0.75], [0.7, -0.75]]) K.trunk([[An[0], An[1] - 0.6, 0, 1.2], [An[0] + dx * 3, 1.4, dz * 3, 0.95], [An[0] + dx * 5.6, 0.15, dz * 5.2, 0.1]], '#FFFFFF', BRONZE, { n: ns(K, 7), c0: BRZ2, c1: OV });
  K.trunk([[An[0], An[1] - 0.6, 0, 0.7], [An[0] - 2.2, 1, 0, 0.45], [An[0] - 3.4, 0.1, 0, 0.06]], '#FFFFFF', 'metal', { n: ns(K, 5), c0: BRZ, c1: OV }); }
function forjaPerna(K) { K.base = 0; K.anim({ t: 'leg', p: [0, 22, 0], amp: 0.22, stride: 14, ph: 0 }, () => pernaPecas(K, true)); }
function forjaPernaCaida(K) { K.base = 0; grupo(K, new (TH().Matrix4)().makeTranslation(0, 2.4, 0).multiply(mat4(0, 0.5, 0, PI / 2 - 0.06, 0, 0)).multiply(new (TH().Matrix4)().makeTranslation(0, -16, 0)), () => pernaPecas(K, false)); }
/* escora do ponto fraco (a parte 'perna' da simulação, sob o canto do casco): pistão blindado com a bobina acesa à mostra */
function junta(K) { K.base = 0; K.cyl(0, 0, 0, 3.6, 4.0, 1.4, ESC, 'dark', { seg: ns(K, 14) }); K.cyl(0, 1.4, 0, 2.3, 2.5, 3.6, BRZ, 'metal', { seg: ns(K, 14) });
  for (let k = 0; k < 4; k++) { const a = k * PI / 2 + PI / 4; K.box(Math.cos(a) * 2.4, 1.4, Math.sin(a) * 2.4, 0.6, 3.6, 0.6, OV, 'metal', { ry: -a }); }
  K.anim({ t: 'bob', amp: 0.18, speed: 3.6 }, () => { for (let k = 0; k < (leve(K) ? 3 : 5); k++) K.tor(0, 5.4 + k * 0.75, 0, 1.75, 0.26, k % 2 ? COB : BRASA2, k % 2 ? 'metal' : null, k % 2 ? { ts: ns(K, 18) } : { e: 2.3, ts: ns(K, 18) }); poe(K, mancha(new (TH().CylinderGeometry)(1.2, 1.2, 4.2, ns(K, 12), 4).translate(0, 2.1, 0), '#2A0800', '#FF5A12', '#FFE6A0', 2.6, 31), '#FFFFFF', null, { e: 1.8, y: 5 }); });
  K.cyl(0, 9.4, 0, 1.0, 1.0, 1.6, ACO2, 'steel', { seg: ns(K, 10) }); K.cyl(0, 10.6, 0, 2.6, 2.2, 1.4, BRZ2, 'metal', { seg: ns(K, 14) });
  fino(K, () => { for (const sg of [1, -1]) K.trunk([[sg * 2.4, 2.6, 0.6, 0.28], [sg * 3.4, 6.5, 1.0, 0.28], [sg * 2.2, 10.8, 0.6, 0.26]], ESC, 'rubber', { n: 4 }); }); }
/* o núcleo exposto: metal em fusão sob a crosta rachada, gaiola de anéis antigos girando, aletas na base */
function nucleo(K) { K.base = 0; K.cyl(0, 0, 0, 7, 8, 3, ESC, 'dark', { seg: ns(K, 16) }); K.tor(0, 3, 0, 7.1, 0.4, OV, 'metal', { ts: ns(K, 24) });
  K.anim({ t: 'bob', amp: 0.4, speed: 3.2 }, () => { poe(K, mancha(new (TH().SphereGeometry)(5.0, ns(K, 26), ns(K, 18)), '#5A1800', '#FF7A1A', '#FFF1C8', 2.6, 41), '#FFFFFF', null, { e: 2.4, y: 8 });
    const T = TH(); const g = new T.IcosahedronGeometry(5.55, leve(K) ? 2 : 3); const p = g.attributes.position, keep = [], col = []; /* crosta: só as placas onde o ruído é alto (o resto é rachadura acesa) */
    for (let i = 0; i < p.count; i += 3) { let sx = 0, sy = 0, sz = 0; for (let k = 0; k < 3; k++) { sx += p.getX(i + k); sy += p.getY(i + k); sz += p.getZ(i + k); } const n = fbm(sx * 0.35 + 9, sy * 0.35, sz * 0.35, 3); if (n < 0.4) continue;
      for (let k = 0; k < 3; k++) { const x = p.getX(i + k), y = p.getY(i + k), z = p.getZ(i + k), b = 1 + (n - 0.4) * 0.6; keep.push(x * b, y * b + 8, z * b); const c = 0.45 + 0.8 * (n - 0.4); col.push(0.32 * c, 0.2 * c, 0.15 * c); } }
    g.dispose(); const cr = new T.BufferGeometry(); cr.setAttribute('position', new T.Float32BufferAttribute(keep, 3)); cr.setAttribute('color', new T.Float32BufferAttribute(col, 3)); poe(K, cr, '#FFFFFF', 'rock', { flat: true });
    }); /* (sem casca acesa por fora: a luz sai pelas rachaduras) */
  for (const [ax, sp, rr] of [['y', 0.8, 7.6], ['x', 0.55, 8.3], ['z', -0.65, 9.0]]) { if (leve(K) && ax === 'z') continue; K.anim({ t: 'spin', p: [0, 8, 0], speed: sp, axis: ax }, () => { const fx = faixa(rr, 0.7, 0.45, ns(K, 40)); if (ax === 'x') fx.rotateX(PI / 2); if (ax === 'z') fx.rotateZ(PI / 2); poe(K, fx.translate(0, 8, 0), OV, 'metal');
    fino(K, () => { for (let k = 0; k < 10; k++) { const a = k / 10 * TAU; const v = new (TH().Vector3)(Math.cos(a) * (rr + 0.25), 0, Math.sin(a) * (rr + 0.25)); if (ax === 'x') v.applyAxisAngle(new (TH().Vector3)(1, 0, 0), PI / 2); if (ax === 'z') v.applyAxisAngle(new (TH().Vector3)(0, 0, 1), PI / 2); K.box(v.x, v.y + 8 - 0.18, v.z, 0.3, 0.36, 0.3, BRASA2, null, { e: 2.2 }); } }); }); }
  for (let i = 0; i < 8; i++) { const a = i * PI / 4; K.box(Math.cos(a) * 7.5, 1, Math.sin(a) * 7.5, 1.0, 5, 2.4, BRZ, 'metal', { ry: -a, b: 0.2 }); } }

/* coroa de cacos da Fenda sobre cada cópia espectral (os Ecos do Arauto): três cacos de vidro e a gema magenta, girando */
function eco(K) { K.base = 0; K.anim({ t: 'spin', p: [0, 0, 0], speed: 1.6 }, () => { for (let k = 0; k < 3; k++) { const a = k * TAU / 3; K.oct(Math.cos(a) * 2.2, 0.2, Math.sin(a) * 2.2, 0.55, 2.6, VID3, VIDRO, { rz: Math.cos(a) * 0.35, rx: -Math.sin(a) * 0.35 }); K.box(Math.cos(a) * 2.2, 1.2, Math.sin(a) * 2.2, 0.12, 0.9, 0.3, FEN, null, { e: 2.4, ry: -a }); }
  gema(K, 0, 0.4, 0, 0.75, 2.0, '#2A0640', FEN2, 1.8); K.tor(0, 1.0, 0, 2.4, 0.1, FEN, null, { e: 2.0, ts: 20 }); }); }

const RX = ARD.meshes && ARD.meshes.receitas ? ARD.meshes.receitas : {};
Object.assign(RX, {
  chefe_arauto_1: arauto('1'), chefe_arauto_2: arauto('2'), chefe_arauto_3: arauto('3'), chefe_arauto_j: arauto('j'),
  chefe_sentinela: sentinela('1'), chefe_sentinela_j: sentinela('j'), chefe_pilar: pilar, chefe_marca: marca,
  chefe_forja: forjaCorpo(1), chefe_forja_b: forjaCorpo(2), chefe_forja_caida: forjaCorpo(3),
  chefe_forja_perna: forjaPerna, chefe_forja_perna_caida: forjaPernaCaida, chefe_junta: junta, chefe_nucleo: nucleo, chefe_eco: eco,
});
if (ARD.meshes) ARD.meshes.receitas = RX;
ARD.chefesModelos = Object.keys(RX).filter(k => k.startsWith('chefe_'));
/* pontos dos modelos que o src/chefes.js usa para os efeitos (nas coordenadas da receita, antes do ajuste de tamanho) */
ARD.chefesForma.pontos = {
  arauto: { olho: [7.0, 27.9, 0], nucleo: [0, 27, 0] }, sentinela: { olho: [5.0, 20.1, 0], nucleo: [0, 19.4, 0] },
  forja: { tochas: [[27.2, 27.5, 9.5], [27.2, 27.5, -9.5], [25.7, 25.5, 8], [25.7, 25.5, -8]], chamines: [[-7.7, 40.7, -6.6], [-7.7, 40.7, 6.6], [-15.6, 42.8, -4.8], [-15.6, 42.8, 4.8]], boca: [21, 19.5, 0], olhos: [25, 27, 0] },
};
})(globalThis.ARD = globalThis.ARD || {});
