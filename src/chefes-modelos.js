/* Aether Rift: Dominion — os modelos dos chefões (Chefões 3.0, 5.0h.5, agente k-chefoes3), no construtor (Kit) e no formato das malhas do jogo
   (src/meshes.js): cor, rugosidade e metal por vértice, partes acesas separadas e animação por peça na GPU. Entram pelo gancho ARD.meshes.receitas,
   então valem nos dois motores com o material e as instâncias de sempre: nenhum material nem pipeline novo. Cada variante (fase, janela de dano,
   aviso de golpe) é um modelo à parte; o src/chefes.js escolhe. Versão leve: K.lite e ARD.chefesForma.leve (qualidade Baixa e celular).
   Este arquivo é gerado por work/vitrine/integra.py a partir de work/conceitos/ (não edite o bloco à mão). */
(function (ARD) { 'use strict'; ARD.chefesForma = ARD.chefesForma || { leve: false }; /* o src/chefes.js liga o leve na Baixa e no celular, antes da carga */ if (ARD.meshes && !ARD.meshes.receitas) ARD.meshes.receitas = {}; })(globalThis.ARD = globalThis.ARD || {});
/* ==== 5.0h.5 Chefões 3.0 (agente k-chefoes3): INÍCIO do bloco gerado por work/vitrine/integra.py ==== */
/* Aether Rift: Dominion — conceitos dos chefões 3.0 (agente k-chefoes3, vitrine para escolha; não entra no jogo sem a escolha do dono).
   Base comum dos nove conceitos: mesmas regras dos modelos de hoje (src/chefes-modelos.js): construtor Kit do src/meshes.js, cor, rugosidade
   e metal por vértice, parte acesa separada (cor do vértice × brilho, sem sombreamento) e animação por peça na GPU (spin, bob, flap, sway).
   Nenhum material novo, nenhuma textura, nenhum asset externo: tudo é geometria procedural. Cada conceito entra pelo gancho ARD.meshes.receitas
   com o nome kch_<chefão>_<conceito> (pose normal) e kch_<chefão>_<conceito>_f (pose da fase final).
   Convenções das receitas do jogo: frente em +x, y para cima, origem no chão; os que voam já trazem a altura no modelo. */
(function (ARD) {
'use strict';
const PI = Math.PI, TAU = PI * 2;
const TH = () => globalThis.THREE;
/* paleta comum (a mesma família de cores dos chefões de hoje): vidro-da-Fenda, Éter, plasma da Fenda e o âmbar do ponto fraco */
const C = { VID: '#120E1D', VID2: '#2B2147', VID3: '#4E3C80', ETER: '#7FE8FF', ETER2: '#D4FBFF', FEN: '#E07CFF', FEN2: '#FFD9FF', FENV: '#B23BFF', AMB: '#FFC24A', AMB2: '#FFE9B8', AMB0: '#7A3A06',
  OSSO: '#D9CCB4', OSSO2: '#8C7B66', BRASA: '#FF6A1A', BRASA2: '#FFC66A', NOITE: '#07060D', ROCHA: '#1E1A26', ROCHA2: '#3A3444' };
const VIDRO = [0.3, 0.06], PELE = [0.42, 0.04], UMIDO = [0.22, 0.02], PEDRA = [0.86, 0.02], OSSOM = [0.62, 0.0], CRIST = [0.1, 0.12];

function rng(seed) { let a = (seed | 0) >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function h3(x, y, z) { let n = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(z | 0, 1274126177)) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); n ^= n >>> 16; return (n & 0x7fffffff) / 0x7fffffff; }
function vn(x, y, z) { const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z); let fx = x - xi, fy = y - yi, fz = z - zi; fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy); fz = fz * fz * (3 - 2 * fz);
  const L = (a, b, t) => a + (b - a) * t; const c = (i, j, k) => h3(xi + i, yi + j, zi + k);
  return L(L(L(c(0, 0, 0), c(1, 0, 0), fx), L(c(0, 1, 0), c(1, 1, 0), fx), fy), L(L(c(0, 0, 1), c(1, 0, 1), fx), L(c(0, 1, 1), c(1, 1, 1), fx), fy), fz); }
function fbm(x, y, z, o) { let v = 0, a = 0.5, f = 1, s = 0; for (let i = 0; i < (o || 3); i++) { v += a * vn(x * f, y * f, z * f); s += a; a *= 0.5; f *= 2.03; } return v / s; }
const cor = h => { if (Array.isArray(h)) return h; const c = new (TH().Color)(h); return [c.r, c.g, c.b]; };
const mixc = (a, b, t) => { a = cor(a); b = cor(b); return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; };
const mul = (a, k) => { a = cor(a); return [a[0] * k, a[1] * k, a[2] * k]; };
const sst = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const leve = K => !!(K.lite || (ARD.chefesForma && ARD.chefesForma.leve));
const nq = (K, n, k) => leve(K) ? Math.max(1, Math.round(n * (k || 0.55))) : n;
const ns = (K, n) => leve(K) ? Math.max(4, Math.round(n * 0.5)) : n;
const fino = (K, fn) => { if (!leve(K)) fn(); };
function mat4(x, y, z, rx, ry, rz, s) { const T = TH(); const sc = Array.isArray(s) ? new T.Vector3(s[0], s[1], s[2]) : new T.Vector3(s || 1, s || 1, s || 1); return new T.Matrix4().compose(new T.Vector3(x || 0, y || 0, z || 0), new T.Quaternion().setFromEuler(new T.Euler(rx || 0, ry || 0, rz || 0, 'YXZ')), sc); }
/* grupo com transformação: tudo o que fn desenhar (peças e pivôs de animação) passa pela matriz M */
function grupo(K, M, fn, fixo) { const a = K.main.length, b = K.emi.length; fn(); const v = new (TH().Vector3)();
  for (const p of K.main.slice(a).concat(K.emi.slice(b))) { p.geo.applyMatrix4(M); if (p.an && !fixo) { v.set(p.an.p[0], p.an.p[1], p.an.p[2]).applyMatrix4(M); p.an.p = [v.x, v.y, v.z]; } } }
function geo(pos, col, idx) { const T = TH(); const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new T.Float32BufferAttribute(col, 3)); if (idx) g.setIndex(idx); g.computeVertexNormals(); return g; }
function poe(K, g, c, mat, o) { return K._push(g, c || '#FFFFFF', mat, Object.assign({}, o || {})); }
function bez(P, n) { const out = []; for (let i = 0; i < n; i++) { const t = i / (n - 1), a = (1 - t) ** 3, b = 3 * t * (1 - t) ** 2, c = 3 * t * t * (1 - t), d = t ** 3; out.push(P[0].map((_, j) => a * P[0][j] + b * P[1][j] + c * P[2][j] + d * P[3][j])); } return out; }

/* varredura: casca de perfil lenticular ao longo de pts = [[x, y, z, meia-largura, meia-espessura], ...] (pétalas, costelas, presas, barbatanas);
   o.lado = vetor da largura, o.conc = concavidade, o.c0/o.c1 = cor da base e da ponta, o.c2 = cor da face de dentro, o.borda = brilho das arestas */
function varre(pts, o) { o = o || {}; const T = TH(); const n = o.n || 10, N = pts.length; const V = p => new T.Vector3(p[0], p[1], p[2]);
  const c0 = cor(o.c0 || '#FFFFFF'), c1 = cor(o.c1 || o.c0 || '#FFFFFF'), c2 = o.c2 ? cor(o.c2) : null; const pos = [], col = [], idx = [], quad = [];
  for (let i = 0; i < N; i++) { const p = pts[i], t = V(pts[Math.min(N - 1, i + 1)]).sub(V(pts[Math.max(0, i - 1)])).normalize();
    const l0 = typeof o.lado === 'function' ? o.lado(i, p) : (o.lado || [0, 0, 1]); let S = V(l0); S.sub(t.clone().multiplyScalar(S.dot(t))); if (S.lengthSq() < 1e-6) S = new T.Vector3(1, 0, 0).cross(t); S.normalize();
    const Nn = new T.Vector3().crossVectors(t, S).normalize(); if (o.dentro) { const d = V(o.dentro).sub(V(p)); if (Nn.dot(d) > 0) { Nn.negate(); S.negate(); } }
    quad.push({ c: V(p), s: S, n: Nn, w: p[3], h: p[4] }); const u = i / (N - 1), base = mixc(c0, c1, o.pot ? Math.pow(u, o.pot) : u);
    for (let k = 0; k < n; k++) { const ph = k / n * TAU, cs = Math.cos(ph), sn = Math.sin(ph); const lx = cs * p[3], ly = sn * p[4] - (o.conc || 0) * p[3] * (cs * cs - 0.35);
      const q = V(p).add(S.clone().multiplyScalar(lx)).add(Nn.clone().multiplyScalar(ly)); pos.push(q.x, q.y, q.z);
      let cc = sn < 0 && c2 ? mixc(base, c2, Math.min(1, -sn * 1.6)) : base; const ed = Math.pow(Math.abs(cs), 10) * (o.borda || 0); cc = [cc[0] * (1 + ed), cc[1] * (1 + ed), cc[2] * (1 + ed)];
      const ao = o.ao ? 1 - o.ao * (1 - u) : 1; col.push(cc[0] * ao, cc[1] * ao, cc[2] * ao); } }
  for (let i = 0; i < N - 1; i++) for (let k = 0; k < n; k++) { const k2 = (k + 1) % n, a = i * n + k, b = i * n + k2, c = (i + 1) * n + k, d = (i + 1) * n + k2; idx.push(a, c, b, b, c, d); }
  const g = geo(pos, col, idx); g.userData.quad = quad; return g; }

/* esculpido: esfera deformada por f(nx, ny, nz) (raio relativo) e colorida por fc(nx, ny, nz, r) */
function esculpe(ws, hs, rx, ry, rz, f, fc, furo) { const T = TH(); const g = new T.SphereGeometry(1, ws, hs); const p = g.attributes.position, col = new Float32Array(p.count * 3);
  if (furo) { const ix = g.index.array, keep = []; for (let i = 0; i < ix.length; i += 3) { const x = (p.getX(ix[i]) + p.getX(ix[i + 1]) + p.getX(ix[i + 2])) / 3, y = (p.getY(ix[i]) + p.getY(ix[i + 1]) + p.getY(ix[i + 2])) / 3, z = (p.getZ(ix[i]) + p.getZ(ix[i + 1]) + p.getZ(ix[i + 2])) / 3; if (!furo(x, y, z)) keep.push(ix[i], ix[i + 1], ix[i + 2]); } g.setIndex(keep); } /* furo(x, y, z): tira as faces (buracos, bocas, fissuras) */
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const r = f ? f(x, y, z) : 1; p.setXYZ(i, x * r * rx, y * r * ry, z * r * rz); const c = fc ? cor(fc(x, y, z, r)) : [1, 1, 1]; col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2]; }
  g.setAttribute('color', new T.BufferAttribute(col, 3)); g.deleteAttribute('normal'); g.deleteAttribute('uv'); const g2 = soldar(g); g2.computeVertexNormals(); return g2; }
/* solda os vértices repetidos da costura e dos polos (normais lisas, sem risco) */
function soldar(g) { const p = g.attributes.position, c = g.attributes.color, map = new Map(), pos = [], col = [], rem = new Int32Array(p.count);
  for (let i = 0; i < p.count; i++) { const k = Math.round(p.getX(i) * 1e3) + '_' + Math.round(p.getY(i) * 1e3) + '_' + Math.round(p.getZ(i) * 1e3); let j = map.get(k); if (j == null) { j = pos.length / 3; map.set(k, j); pos.push(p.getX(i), p.getY(i), p.getZ(i)); col.push(c.getX(i), c.getY(i), c.getZ(i)); } rem[i] = j; }
  const src = g.index ? g.index.array : null, n = src ? src.length : p.count, idx = []; for (let i = 0; i < n; i += 3) { const a = rem[src ? src[i] : i], b = rem[src ? src[i + 1] : i + 1], d = rem[src ? src[i + 2] : i + 2]; if (a !== b && b !== d && a !== d) idx.push(a, b, d); }
  g.dispose(); return geo(pos, col, idx); }

/* casca de revolução: perfil [[raio, y], ...]; o.n lados, o.a0/o.al arco (setor), o.f(a, v, r, y) → [r, y] deforma, o.cor(a, v, r, y) → cor,
   o.inv inverte a face (perfil de cima para baixo), o.furo(a, v) abre buracos, o.esp espessura (gera a face de dentro, cor o.corIn) */
function casca(prof, o) { o = o || {}; const n = o.n || 32, a0 = o.a0 || 0, al = o.al == null ? TAU : o.al, full = al >= TAU - 1e-6, cols = full ? n : n + 1, M = prof.length; const pos = [], col = [], idx = [];
  const lado = (din, inv) => { const o0 = pos.length / 3; for (let j = 0; j < M; j++) { const v = j / (M - 1); for (let k = 0; k < cols; k++) { const a = a0 + al * k / n; let r = prof[j][0], y = prof[j][1]; if (o.f) { const d = o.f(a, v, r, y); r = d[0]; y = d[1]; }
        if (din) { r = Math.max(0, r - o.esp * (o.espR == null ? 1 : o.espR)); y -= o.esp * (o.espY || 0); } pos.push(Math.cos(a) * r, y, Math.sin(a) * r); const c = din && o.corIn ? cor(o.corIn(a, v, r, y)) : (o.cor ? cor(o.cor(a, v, r, y)) : [1, 1, 1]); col.push(c[0], c[1], c[2]); } }
    const at = (j, k) => o0 + j * cols + (full ? k % n : k); for (let j = 0; j < M - 1; j++) for (let k = 0; k < n; k++) { if (o.furo && o.furo(a0 + al * (k + 0.5) / n, (j + 0.5) / (M - 1))) continue; const a = at(j, k), b = at(j, k + 1), c = at(j + 1, k), d = at(j + 1, k + 1); if (inv) idx.push(a, b, c, b, d, c); else idx.push(a, c, b, b, c, d); } };
  lado(false, !!o.inv); if (o.esp) lado(true, !o.inv); return geo(pos, col, idx); }

/* folha com espessura: superfície fn(u, v) → [x, y, z] (u, v em 0..1), th(u, v) espessura; cor(u, v) em cima, cor2(u, v) embaixo.
   A face de cima é a de du × dv; o.inv troca. Asas, mantos, véus largos, placas de carapaça */
function folha(fn, nu, nv, o) { o = o || {}; const T = TH(); const pos = [], col = [], idx = []; const W = nu + 1;
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) { const u = i / nu, v = j / nv, p = fn(u, v); pos.push(p[0], p[1], p[2]); const c = o.cor ? cor(o.cor(u, v)) : [1, 1, 1]; col.push(c[0], c[1], c[2]); }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = j * W + i, b = a + 1, c = a + W, d = c + 1; if (o.inv) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c); }
  const top = geo(pos, col, idx); const nr = top.attributes.normal, N0 = pos.length / 3;
  if (o.th) { for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) { const k = j * W + i, u = i / nu, v = j / nv, t = typeof o.th === 'function' ? o.th(u, v) : o.th; pos.push(pos[k * 3] - nr.getX(k) * t, pos[k * 3 + 1] - nr.getY(k) * t, pos[k * 3 + 2] - nr.getZ(k) * t); const c = o.cor2 ? cor(o.cor2(u, v)) : [col[k * 3], col[k * 3 + 1], col[k * 3 + 2]]; col.push(c[0], c[1], c[2]); }
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = N0 + j * W + i, b = a + 1, c = a + W, d = c + 1; if (o.inv) idx.push(a, b, c, b, d, c); else idx.push(a, c, b, b, c, d); }
    /* fecha as bordas */ const lig = (p, q) => { if (o.inv) idx.push(p, q, p + N0, q, q + N0, p + N0); else idx.push(p, p + N0, q, q, p + N0, q + N0); };
    for (let i = 0; i < nu; i++) { lig(i + 1, i); lig(nv * W + i, nv * W + i + 1); } for (let j = 0; j < nv; j++) { lig(j * W, (j + 1) * W); lig((j + 1) * W + nu, j * W + nu); } }
  top.dispose(); return geo(pos, col, idx); }

/* disco plano com cor por vértice (acreção, nebulosa, véu de poeira): fc(u, a) → cor (u = 0 dentro, 1 fora), o.y(u, a) altura; duas faces */
function disco(R0, R1, seg, an, fc, o) { o = o || {}; const pos = [], col = [], idx = []; const W = seg + 1, a0 = o.a0 || 0, al = o.al == null ? TAU : o.al;
  for (let j = 0; j <= an; j++) for (let i = 0; i <= seg; i++) { const u = j / an, a = a0 + al * i / seg + (o.tw || 0) * u, r = R0 + (R1 - R0) * u; pos.push(Math.cos(a) * r, o.y ? o.y(u, a) : 0, Math.sin(a) * r); const c = cor(fc(u, a)); col.push(c[0], c[1], c[2]); }
  const N0 = pos.length / 3; for (let k = 0; k < N0 * 3; k++) pos.push(pos[k]); for (let k = 0; k < N0 * 3; k++) col.push(col[k] * (o.verso == null ? 1 : o.verso));
  for (let j = 0; j < an; j++) for (let i = 0; i < seg; i++) { const a = j * W + i, b = a + 1, c = a + W, d = c + 1; idx.push(a, c, b, b, c, d, N0 + a, N0 + b, N0 + c, N0 + b, N0 + d, N0 + c); }
  return geo(pos, col, idx); }

/* emissivo com cara de energia: a cor de cada vértice vem de um ruído (veios escuros, corpo, pontos quentes); girando, corre como plasma */
function mancha(g, c0, c1, c2, f, sd) { const p = g.attributes.position, col = new Float32Array(p.count * 3), A = cor(c0), B = cor(c1), Cc = cor(c2);
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), l = Math.hypot(x, y, z) || 1; const n = fbm(x / l * f + sd, y / l * f + sd * 0.7, z / l * f, 3);
    const fil = Math.max(0, 1 - Math.abs(n - 0.52) * 11); let c = mixc(A, B, sst(0.28, 0.62, n)); c = mixc(c, Cc, Math.max(fil * 0.8, sst(0.7, 0.86, n))); col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2]; }
  g.setAttribute('color', new (TH().BufferAttribute)(col, 3)); return g; }
function degrade(g, c0, c1, k, eixo) { const p = g.attributes.position; g.computeBoundingBox(); const ax = eixo || 'y', y0 = g.boundingBox.min[ax], y1 = g.boundingBox.max[ax], A = cor(c0), B = cor(c1), col = new Float32Array(p.count * 3); const get = ax === 'x' ? i => p.getX(i) : ax === 'z' ? i => p.getZ(i) : i => p.getY(i);
  for (let i = 0; i < p.count; i++) { const u = Math.pow((get(i) - y0) / ((y1 - y0) || 1), k || 1); const c = mixc(A, B, u); col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2]; }
  g.setAttribute('color', new (TH().BufferAttribute)(col, 3)); return g; }

/* fio/tentáculo por pontos [x, y, z]: raio r0 → r1 (o.pot curva do afinamento); o.e = aceso */
function fio(K, pts, r0, r1, o) { o = o || {}; const N = pts.length; const p4 = pts.map((p, i) => { const u = i / (N - 1); return [p[0], p[1], p[2], (r0 + (r1 - r0) * Math.pow(u, o.pot || 1)) * (o.rf ? o.rf(u) : 1)]; });
  return K.trunk(p4, '#FFFFFF', o.mat === undefined ? UMIDO : o.mat, { n: leve(K) ? Math.max(3, (o.n || 6) - 2) : (o.n || 6), c0: o.c0 || C.VID2, c1: o.c1 || o.c0 || C.VID2, e: o.e, cap: o.cap }); }
/* curva ondulada entre a e b (com flecha e ondas): devolve n pontos */
function onda(a, b, n, o) { o = o || {}; const T = TH(); const A = new T.Vector3(a[0], a[1], a[2]), Bv = new T.Vector3(b[0], b[1], b[2]), d = Bv.clone().sub(A), L = d.length(); d.normalize();
  const up = Math.abs(d.y) < 0.95 ? new T.Vector3(0, 1, 0) : new T.Vector3(1, 0, 0), s1 = new T.Vector3().crossVectors(d, up).normalize(), s2 = new T.Vector3().crossVectors(d, s1); const out = [], ph = o.ph || 0, fr = o.fr || 1.5, amp = (o.amp == null ? 0.08 : o.amp) * L;
  for (let i = 0; i < n; i++) { const u = i / (n - 1), w = Math.sin(u * PI) * (o.flecha || 0) * L, env = Math.pow(u, o.env == null ? 0.8 : o.env); const p = A.clone().addScaledVector(d, L * u).addScaledVector(s1, Math.sin(u * fr * TAU + ph) * amp * env).addScaledVector(s2, Math.cos(u * fr * TAU * 0.8 + ph * 1.7) * amp * env * (o.esp == null ? 1 : o.esp)); if (o.fd) p.add(new T.Vector3(o.fd[0], o.fd[1], o.fd[2]).multiplyScalar(w)); out.push([p.x, p.y, p.z]); }
  return out; }
/* cristal: prisma de n lados com ponta, de a até b; cor da base e da ponta por vértice, facetado */
function cristal(K, a, b, r, o) { o = o || {}; const T = TH(); const A = new T.Vector3(a[0], a[1], a[2]), d = new T.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]); const L = d.length() || 0.001; d.normalize();
  const pf = o.duplo ? [[0, 0], [r * 0.8, L * 0.16], [r, L * 0.5], [r * 0.7, L * 0.82], [0, L]] : [[r * 0.75, 0], [r, L * 0.3], [r * (o.topo == null ? 0.62 : o.topo), L * (o.om || 0.78)], [0, L]];
  const g = new T.LatheGeometry(pf.map(p => new T.Vector2(p[0], p[1])), o.n || 5, o.rot || 0); g.deleteAttribute('uv'); degrade(g, o.c0 || C.VID2, o.c1 || C.VID3, o.k || 1);
  const q = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), d); return K._push(g, '#FFFFFF', o.e ? null : (o.mat || CRIST), { x: a[0], y: a[1], z: a[2], q, flat: true, e: o.e, pat: o.pat == null ? 0 : o.pat }); }
/* olho: esclera escura e a íris acesa (calota com estrias); abre 0..1 = tamanho da pupila em fenda; olha para +x; o.ry/o.rz giram o olhar */
function olho(K, c, r, o) { o = o || {}; const T = TH(); const i1 = cor(o.iris || C.FEN), i2 = cor(o.iris2 || C.FEN2), i0 = cor(o.iris0 || '#2A0A3A'), ab = o.abre == null ? 0.5 : o.abre;
  grupo(K, mat4(c[0], c[1], c[2], 0, o.ry || 0, o.rz == null ? -0.3 : o.rz), () => {
    K.sph(0, 0, 0, r, o.esclera || '#0E0816', 'gloss', { seg: ns(K, 24) });
    const th = o.tam || 0.95, g = new T.SphereGeometry(r * 1.02, ns(K, 40), ns(K, 12), 0, TAU, 0, th); const p = g.attributes.position, col = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const rho = Math.acos(Math.max(-1, Math.min(1, y / (r * 1.02)))) / th, ph = Math.atan2(z, -x); const px = rho * Math.sin(ph), py = rho * Math.cos(ph);
      const pw = 0.07 + 0.3 * ab, phh = 0.5 + 0.12 * ab; const d = Math.hypot(px / pw, py / phh); const st = fbm(Math.cos(ph) * 5 + 3, Math.sin(ph) * 5, rho * 1.2, 2);
      let cc = mixc(i0, i1, sst(0.1, 0.75, st) * (1 - 0.35 * rho)); cc = mixc(cc, i2, Math.max(0, 1 - Math.abs(d - 1.12) * 3.2) * 0.9 + sst(0.72, 0.9, st) * 0.5); cc = mul(cc, 1 - 0.75 * sst(0.8, 1, rho)); if (d < 1) cc = [0.004, 0.002, 0.008];
      col[i * 3] = cc[0]; col[i * 3 + 1] = cc[1]; col[i * 3 + 2] = cc[2]; }
    g.setAttribute('color', new T.BufferAttribute(col, 3)); g.rotateZ(-PI / 2); poe(K, g, '#FFFFFF', null, { e: o.e || 2.6 });
    if (o.alvo) { K.tor(r * 0.62, 0, 0, r * 1.05, r * 0.035, C.AMB, null, { e: 3.0, rz: PI / 2, ts: ns(K, 36), rs: 5 }); } }); }
/* gema acesa (octaedro com degradê) */
function gema(K, x, y, z, r, h, cb, ct, e, o) { const g = new (TH().OctahedronGeometry)(1, 0).scale(r, h / 2, r); poe(K, degrade(g, cb, ct, 0.8), '#FFFFFF', null, Object.assign({ e, x, y, z, flat: true }, o || {})); }
/* poeira presa: n grãos acesos (tetraedros) nas posições de fn(i, r) → [x, y, z, tamanho, cor] */
function poeira(K, n, sd, fn, e) { const T = TH(), r = rng(sd); const pos = [], col = []; const base = new T.TetrahedronGeometry(1, 0), bp = base.attributes.position; const m = new T.Matrix4(), v = new T.Vector3();
  for (let i = 0; i < n; i++) { const q = fn(i, r); if (!q) continue; const c = cor(q[4] || C.ETER2); m.compose(new T.Vector3(q[0], q[1], q[2]), new T.Quaternion().setFromEuler(new T.Euler(r() * TAU, r() * TAU, 0)), new T.Vector3(q[3], q[3], q[3])); for (let k = 0; k < bp.count; k++) { v.set(bp.getX(k), bp.getY(k), bp.getZ(k)).applyMatrix4(m); pos.push(v.x, v.y, v.z); col.push(c[0], c[1], c[2]); } }
  if (pos.length) poe(K, geo(pos, col, null), '#FFFFFF', null, { e: e || 2.4, flat: true }); }
/* pedra/caco facetado: icosaedro amassado por ruído, cor por vértice clara em cima */
function pedra(K, x, y, z, r, o) { o = o || {}; const T = TH(); const g0 = new T.IcosahedronGeometry(1, o.det == null ? 1 : o.det); g0.deleteAttribute('uv'); g0.deleteAttribute('normal'); const c0 = cor(o.c0 || C.ROCHA), c1 = cor(o.c1 || C.ROCHA2), sd = o.seed || 1; const p = g0.attributes.position, col = new Float32Array(p.count * 3), s = o.s || [1, 1, 1];
  for (let i = 0; i < p.count; i++) { const px = p.getX(i), py = p.getY(i), pz = p.getZ(i); const k = 0.62 + 0.75 * fbm(px * 1.3 + sd, py * 1.3 + sd * 0.3, pz * 1.3, 2); p.setXYZ(i, px * k * r * s[0], py * k * r * s[1], pz * k * r * s[2]); const cc = mixc(c0, c1, 0.5 + 0.5 * py); col[i * 3] = cc[0]; col[i * 3 + 1] = cc[1]; col[i * 3 + 2] = cc[2]; }
  g0.setAttribute('color', new T.BufferAttribute(col, 3)); return poe(K, g0, '#FFFFFF', o.e ? null : (o.mat || PEDRA), { x, y, z, rx: o.rx, ry: o.ry, rz: o.rz, flat: true, e: o.e, pat: o.pat == null ? 6 : o.pat }); }
/* animação de tentáculo conforme o lado (as rotações da GPU são nos eixos x e z do modelo) */
function balanca(a, p, amp, speed, ph) { const ca = Math.cos(a), sa = Math.sin(a); return Math.abs(ca) > Math.abs(sa) ? { t: 'sway', p, amp, speed, ph } : { t: 'flap', p, amp, speed, ph, side: sa > 0 ? 1 : -1 }; }
/* registra as receitas de um conceito e a ficha (nome, frase, o que muda) que a página de escolha lê */
const RX = ARD.meshes && ARD.meshes.receitas ? ARD.meshes.receitas : {}; if (ARD.meshes) ARD.meshes.receitas = RX;
const FICHAS = {};
function registra(id, ficha, receitas) { FICHAS[id] = ficha; Object.assign(RX, receitas); }

ARD.kch = { PI, TAU, TH, C, VIDRO, PELE, UMIDO, PEDRA, OSSOM, CRIST, rng, fbm, vn, cor, mixc, mul, sst, leve, nq, ns, fino, mat4, grupo, geo, poe, bez, varre, esculpe, soldar, casca, folha, disco, mancha, degrade, fio, onda, cristal, olho, gema, poeira, pedra, balanca, registra, FICHAS, RX };
})(globalThis.ARD = globalThis.ARD || {});
/* Conceito do Arauto A — "A Medusa do Vazio" (orgânico). Um sino de vidro-da-Fenda vivo, com o olho pendurado embaixo e os fios compridos.
   kch_arauto_medusa (pose normal) e kch_arauto_medusa_f (fase final: sino rasgado e tombado, olho escancarado em âmbar). */
(function (ARD) {
'use strict';
const B = ARD.kch, { PI, TAU, TH, C, VIDRO, PELE, UMIDO, rng, fbm, mixc, mul, sst, leve, nq, ns, fino, mat4, grupo, poe, varre, casca, disco, fio, onda, olho, poeira, balanca } = B;
const NL = 16; /* lóbulos da borda do sino */
let GX = 1, GY = 1; /* contração do sino (antes do golpe o sino aperta e sobe); só valem durante a montagem de um modelo */
function sup(a, t, off) { t = Math.max(0, Math.min(0.995, t)); const ang = t * PI / 2, w = 1 - t; const r0 = 17 * GX * Math.pow(Math.cos(ang), 0.8), y0 = 29.5 + 12 * GY * Math.pow(Math.sin(ang), 1.05);
  const r = r0 * (1 + 0.05 * Math.cos(NL * a) * w * w) * (0.97 + 0.06 * fbm(Math.cos(a) * 1.5 + 5, Math.sin(a) * 1.5, t * 2, 2)) + (off || 0) * Math.cos(ang), y = y0 - 1.1 * (0.5 + 0.5 * Math.cos(NL * a)) * w * w * w + (off || 0) * Math.sin(ang); return [r, y]; }
const P3 = (a, t, off) => { const s = sup(a, t, off); return [Math.cos(a) * s[0], s[1], Math.sin(a) * s[0]]; };
/* est: '1' Três Pilares (sino baixo e fechado sobre o olho), '2' Ecos (aberta: a pose normal), '3' Colapso (sino rasgando, olho arregalado), 'j' janela de dano (a pose final) */
/* O.golpe: a pose do aviso de golpe (o sino contrai, as veias e os ganchos acendem, os dois olhos arregalam) */
function medusa(est, O) { O = O || {}; const golpe = !!O.golpe, gk = golpe ? 1.8 : 1; est = est === true ? 'j' : (est || '2'); const fim = est === 'j', col = est === '3', fech = est === '1', DY = fech ? -4.4 : 0; return function (K) { GX = golpe ? 0.84 : 1; GY = golpe ? 1.14 : 1; try { corpo(K); } finally { GX = 1; GY = 1; } };
  function corpo(K) { K.base = 0; const T = TH(); const r = rng(fim ? 23 : 17); const IR = fim ? C.AMB : C.FEN, CAN = fim ? '#FF7A3A' : C.ETER;
  const furo = (fim || col) ? (a, v) => { const n = fbm(Math.cos(a) * 2.2 + 9, Math.sin(a) * 2.2, v * 3.0, 2); return v > 0.1 && v < 0.86 && n > (col ? 0.68 : 0.6); } : null;
  /* o sino (tombado para trás na fase final, deixando o olho à mostra) */
  const sino = () => { const M = ns(K, 15), prof = []; for (let j = 0; j < M; j++) prof.push([1, j / (M - 1)]);
    poe(K, casca(prof, { n: ns(K, 64), esp: 0.5, espR: 1, espY: 0.4, furo, f: (a, v) => sup(a, v * 0.985),
      cor: (a, v) => { const st = 0.5 + 0.5 * Math.cos(NL * a); let c = mixc(C.VID2, C.VID, sst(0.1, 0.9, v)); c = mixc(c, C.VID3, st * (1 - v) * 0.6); return mul(c, 0.5 + 0.4 * fbm(Math.cos(a) * 4, Math.sin(a) * 4, v * 5, 2)); },
      corIn: (a, v) => mixc(C.FENV, C.VID2, 0.35 + 0.5 * v) }), '#FFFFFF', VIDRO, { pat: 4 });
    /* o brilho de baixo do sino (o plasma da Fenda preso lá dentro) */
    poe(K, disco(2.5, 15.4 * GX, ns(K, 48), 5, (u, a) => { const st = fbm(Math.cos(a) * 6, Math.sin(a) * 6, u * 2, 2); return mul(mixc(fim ? '#FF9A3A' : C.FEN2, fim ? '#3A0A12' : '#3A0E66', sst(0.0, 0.95, u) * (0.75 + 0.5 * st)), fim ? 0.7 : 1); }, { y: u => 34.2 - 4.8 * u * u }), '#FFFFFF', null, { e: fim ? 1.3 : 1.7 });
    /* canais radiais acesos e os olhinhos da borda */
    for (let k = 0; k < NL; k++) { if (leve(K) && k % 2) continue; const a = (k + 0.5) * TAU / NL; if (fim && r() < 0.35) continue; const pts = []; for (let i = 0; i <= 10; i++) pts.push(P3(a + Math.sin(i * 0.9 + k) * 0.012, 0.02 + 0.9 * i / 10, 0.12)); fio(K, pts, 0.2, 0.08, { c0: CAN, c1: fim ? '#7A1A0A' : C.ETER, e: fim ? 1.3 : 1.5, n: 4 }); }
    for (let k = 0; k < NL; k++) { const p = P3(k * TAU / NL, 0.0, 0.1); K.sph(p[0], p[1] - 0.2, p[2], 0.5, fim ? C.AMB0 : C.ETER2, null, { e: fim ? 1.2 : 2.0, seg: 8 });
      /* a coroa de espinhos da borda (lê de cima): um gancho escuro por lóbulo, com a ponta de Fenda acesa */
      if (!leve(K) || k % 4 === 0) { const a = k * TAU / NL, ca = Math.cos(a), sa = Math.sin(a), L = (k % 2 ? 2.6 : 4.2) * (golpe ? 1.25 : 1); B.cristal(K, [p[0] - ca * 0.6, p[1] + 0.3, p[2] - sa * 0.6], [p[0] + ca * L, p[1] + L * 0.42, p[2] + sa * L], 0.5, { n: 4, c0: C.VID, c1: C.VID3, mat: VIDRO, pat: 4 }); K.sph(p[0] + ca * L, p[1] + L * 0.42, p[2] + sa * L, 0.2, fim ? C.AMB0 : C.FEN, null, { e: (fim ? 1.0 : 2.0) * gk, seg: 6 }); } }
    /* os quatro órgãos em ferradura no alto do sino (a marca que se lê de cima) */
    for (let k = 0; k < 4; k++) { const ak = k * TAU / 4 + 0.4, pts = []; const nn = ns(K, 14); for (let i = 0; i <= nn; i++) { const th = -0.35 * PI + 1.7 * PI * i / nn; pts.push(P3(ak + 0.4 * Math.cos(th), 0.52 + 0.17 * Math.sin(th), 0.3)); } fio(K, pts, 0.5, 0.5, { c0: fim ? '#B8401A' : C.FEN, c1: fim ? '#5A1408' : C.FEN2, e: fim ? 1.4 : 2.3, n: 5, rf: u => 0.55 + 0.6 * Math.sin(u * PI) }); }
    const ap = P3(0, 0.97, 0.2); K.tor(0, ap[1] - 0.9, 0, 3.9, 0.3, fim ? C.AMB0 : C.ETER, null, { e: 2.2, ts: ns(K, 24), rs: 5 });
    /* o olho do alto do sino: na câmera do jogo (de cima) é este que encara o jogador; o de baixo é o ponto fraco */
    for (let k = 0; k < (leve(K) ? 0 : 6); k++) { const a = k * TAU / 6 + 0.3, q0 = P3(a, 0.74, 0.1), q1 = P3(a, 0.62, golpe ? 3.6 : 2.6); B.cristal(K, q0, q1, 0.55, { n: 4, c0: C.VID, c1: C.VID3, mat: VIDRO, pat: 4 }); }
    olho(K, [0, ap[1] - 2.9, 0], 3.8, { rz: PI / 2, abre: fim ? 1 : (col ? 0.7 : (golpe ? 0.5 : (fech ? 0.03 : 0.14))), iris: IR, iris2: fim ? C.AMB2 : C.FEN2, iris0: fim ? '#4A1C02' : '#2A0A3A', e: fim ? 1.6 : 2.2, tam: 0.8 });
    /* veias de Fenda no sino: riscos magenta irregulares entre os canais (mais fortes no Colapso) */
    const qv = rng(91); for (let k = 0; k < nq(K, col ? 16 : 12, 0.34); k++) { let a = qv() * TAU, t = 0.1 + qv() * 0.25; const pts = []; for (let i = 0; i < 7; i++) { pts.push(P3(a, t, 0.14)); a += (qv() - 0.5) * 0.22; t += 0.05 + qv() * 0.06; } fio(K, pts, golpe ? 0.4 : 0.3, 0.06, { c0: fim ? '#7A2A3A' : C.FEN2, c1: fim ? '#5A1A2A' : C.FEN, e: (fim ? 0.9 : (col ? 2.2 : 1.6)) * gk, n: 3, rf: u => 0.3 + Math.sin(u * PI) }); } };
  if (fim) grupo(K, mat4(-5.5, 2.2, 1.5, 0.12, 0, 0.52).multiply(new T.Matrix4().makeTranslation(0, -3, 0)), sino); else if (fech) grupo(K, mat4(0, DY, 0), sino); else sino();
  /* o talo e o olho pendurado */
  const EY = fim ? 22.2 : 21.8, EX = fim ? 2.6 : 1.2, RZ = fim ? -0.2 : -0.36, ER = 6.6;
  fio(K, [[fim ? -3 : 0, 33 + DY, 0], [fim ? -1.5 : 0, 30.5 + DY * 0.6, 0], [EX * 0.6, 28, 0], [EX, EY + 3, 0]], 3.4, 4.3, { c0: C.VID, c1: C.VID2, mat: PELE, n: ns(K, 12) });
  olho(K, [EX, EY, 0], ER, { rz: RZ, abre: fim ? 1 : (col ? 0.7 : (golpe ? 0.5 : (fech ? 0.04 : 0.16))), iris: IR, iris2: fim ? C.AMB2 : C.FEN2, iris0: fim ? '#4A1C02' : '#2A0A3A', alvo: fim, e: fim ? 2.1 : 2.2, tam: fim ? 1.05 : 0.95 });
  grupo(K, mat4(EX, EY, 0, 0, 0, RZ), () => { const th = fim ? 1.72 : (fech ? 2.3 : (col ? 1.85 : 2.02)); const g = new T.SphereGeometry(ER * 1.1, ns(K, 28), ns(K, 12), 0, TAU, 0, th); g.rotateZ(PI / 2); B.degrade(g, C.VID2, C.VID, 1, 'x'); poe(K, g, '#FFFFFF', PELE, { pat: 3 });
    K.tor(-ER * 1.1 * Math.cos(th), 0, 0, ER * 1.1 * Math.sin(th), 0.2, fim ? C.AMB : C.ETER, null, { e: 2.4, rz: PI / 2, ts: ns(K, 32), rs: 5 });
    /* a sobrancelha dura: duas placas escuras em V sobre o olho (o cenho fechado); na janela de dano, erguidas */
    for (const sg of [1, -1]) { const sb = B.bez([[ER * 0.72, ER * (fim ? 0.75 : 0.5), sg * 0.5], [ER * 0.95, ER * (fim ? 1.1 : 0.82), sg * ER * 0.45], [ER * 0.7, ER * (fim ? 1.3 : 1.05), sg * ER * 0.85], [ER * 0.25, ER * (fim ? 1.25 : 1.1), sg * ER * 1.15]], 8).map((p, i) => [p[0], p[1], p[2], ER * 0.3 * Math.sin(PI * (0.25 + 0.7 * i / 7)) + 0.05, 0.42]); poe(K, varre(sb, { n: 6, lado: [1, 0.4, 0], c0: C.VID, c1: C.VID2, c2: C.VID, borda: 0.9 }), '#FFFFFF', VIDRO, { pat: 4 }); } });
  /* braços orais: fitas largas e franzidas em volta do olho */
  const NB = nq(K, 5, 0.6); for (let k = 0; k < NB; k++) { const a = k * TAU / NB + 2.2, ca = Math.cos(a), sa = Math.sin(a); if (Math.abs(a % TAU - TAU) < 0.7 || ca > 0.75) continue; const L = (fim ? 13 : 17) + r() * 5, n = ns(K, 16), pts = []; const ab = fim ? 1.7 : 1;
    for (let i = 0; i < n; i++) { const u = i / (n - 1), rr = 4.2 + (2.5 * ab) * Math.sin(u * PI * 0.9) + u * 1.5 * ab, tw = a + u * (fim ? 0.3 : 1.1); pts.push([Math.cos(tw) * rr, 29.5 - L * u, Math.sin(tw) * rr, (1.9 * Math.pow(Math.sin(PI * (0.15 + 0.85 * u)), 0.7) + 0.05) * (1 + 0.25 * Math.sin(u * 19 + k)), 0.16]); }
    K.anim(balanca(a, [ca * 4, 29.5, sa * 4], 0.07, 0.7 + r() * 0.3, r() * TAU), () => { const g = varre(pts, { n: ns(K, 8), lado: (i, p) => [-p[2], 0, p[0]], conc: 0.55, c0: C.VID2, c1: fim ? '#5A2A3A' : C.VID3, c2: fim ? '#7A2A2A' : C.FENV, borda: 0.8 }); poe(K, g, '#FFFFFF', UMIDO, { pat: 4 });
      const Q = g.userData.quad, pe = []; for (let i = 1; i < Q.length; i++) { const q = Q[i]; const v = q.c.clone().addScaledVector(q.s, q.w * 0.98); pe.push([v.x, v.y, v.z]); } fio(K, pe, 0.1, 0.05, { c0: fim ? '#C8501A' : C.FEN, c1: fim ? '#C8501A' : C.FEN2, e: fim ? 1.3 : 1.9, n: 3 }); }); }
  /* os fios compridos da borda (com contas de luz) e os curtos de dentro */
  const fios = (n, R, y0, Lm, rr, sd) => { const q = rng(sd); for (let k = 0; k < n; k++) { const a = (k + 0.5) * TAU / n + (q() - 0.5) * 0.12, ca = Math.cos(a), sa = Math.sin(a); const L = Lm * (0.7 + 0.5 * q()) * (fech ? 0.62 : 1); if (fim && q() < 0.45) continue; if (col && q() < 0.25) continue; if (!fim && ca > 0.86) continue; /* a cortina abre na frente do olho */
      const b0 = fim ? [ca * R - 5, y0 + (ca < 0 ? -4 : 6) * Math.abs(ca), sa * R] : [ca * R, y0, sa * R], b1 = fim ? [b0[0] + ca * 1.5, Math.max(1.5, b0[1] - L * 1.1), b0[2] + sa * 1.5] : [ca * (R * 0.82), Math.max(2.5, y0 - L), sa * (R * 0.82)];
      const pts = onda(b0, b1, ns(K, 14), { amp: fim ? 0.015 : 0.05, fr: 1.2 + q(), ph: q() * TAU, flecha: fim ? 0 : 0.1, fd: [ca, 0, sa] });
      K.anim(balanca(a, b0, fim ? 0.03 : 0.09 + q() * 0.05, 0.7 + q() * 0.5, q() * TAU), () => { fio(K, pts, rr, 0.07, { c0: C.VID3, c1: fim ? '#6A3A2A' : '#3FA9C8', n: 5 }); const tp = pts[pts.length - 1]; K.sph(tp[0], tp[1], tp[2], 0.42, fim ? C.AMB0 : C.ETER2, null, { e: fim ? 1.4 : 2.2, seg: 8 }); if (k % 2 === 0 && rr > 0.3) { const t1 = pts[pts.length - 2]; B.cristal(K, tp, [tp[0] + ca * 1.5 + (tp[0] - t1[0]), tp[1] + 1.3, tp[2] + sa * 1.5 + (tp[2] - t1[2])], 0.3, { n: 4, c0: C.VID3, c1: fim ? '#7A5A3A' : C.FEN2, e: (fim ? 0.8 : 1.3) * gk }); }
        fino(K, () => { for (const f of [0.4, 0.68]) { const p = pts[Math.round(f * (pts.length - 1))]; K.sph(p[0], p[1], p[2], 0.27, fim ? C.AMB0 : C.ETER, null, { e: fim ? 1.2 : 1.7, seg: 6 }); } }); }); } };
  fios(nq(K, 20, 0.4), 16.2 * GX, 29.4 + DY, 24, 0.34, 5); fino(K, () => fios(9, 10.5 * GX, 30.5 + DY, 13, 0.24, 9));
  /* plâncton de luz preso sob o sino; na fase final, o plasma que vaza pelos rasgos e sobe */
  K.anim({ t: 'spin', p: [0, 0, 0], speed: fim ? 0.5 : 0.22 }, () => poeira(K, nq(K, fim ? 90 : 60, 0.5), 3, (i, q) => { const a = q() * TAU, rr = fim ? 3 + q() * 13 : 6 + q() * 9; return fim ? [Math.cos(a) * rr - 5, 30 + q() * 22, Math.sin(a) * rr, 0.16 + q() * 0.3, q() < 0.5 ? C.FEN : C.AMB] : [Math.cos(a) * rr, 12 + q() * 17, Math.sin(a) * rr, 0.12 + q() * 0.2, q() < 0.7 ? C.ETER2 : C.FEN2]; }, 2.6));
  if (fim) fino(K, () => { for (let k = 0; k < 7; k++) { const a = r() * TAU, t0 = 0.2 + r() * 0.5; const pts = []; let aa = a, tt = t0; for (let i = 0; i < 6; i++) { pts.push(P3(aa, tt, 0.15)); aa += (r() - 0.5) * 0.3; tt += 0.05 + r() * 0.05; } grupo(K, mat4(-5.5, 2.2, 1.5, 0.12, 0, 0.52).multiply(new T.Matrix4().makeTranslation(0, -3, 0)), () => fio(K, pts, 0.16, 0.05, { c0: C.FEN2, c1: C.FEN, e: 2.6, n: 3 })); } });
}; }
B.registra('arauto_medusa', { chefe: 'arauto', ordem: 1, nome: 'A Medusa do Vazio', eixo: 'Orgânico, criatura viva',
  frase: 'Uma água-viva do tamanho de uma cidade, que atravessou a Fenda à deriva e traz um único olho pendurado sob o sino.',
  fases: 'Três Pilares: o sino fica baixo e fechado sobre o olho (só uma fresta de luz embaixo). Ecos: o sino sobe, o olho aparece e os órgãos em ferradura do alto pulsam. Colapso e janela de dano: o sino rasga e tomba para trás, o plasma vaza para cima e o olho fica escancarado em âmbar, sem proteção.',
  golpes: 'Anel: os lóbulos da borda acendem em sequência antes da onda. Faixa: o olho estreita a pupila e os braços se afastam. Poço: todos os fios são puxados para o centro.',
  fraco: 'O olho. Na pose normal é magenta e meio coberto pela pálpebra; na janela de dano vira âmbar, com o aro âmbar em volta.',
  risco: 'Baixo. Usa as mesmas peças dos chefões de hoje (cascas, fios com balanço, partes acesas). O sino é opaco (o jogo não tem vidro transparente): a transparência é sugerida pelo brilho de baixo.' },
  { kch_arauto_medusa: medusa('2'), kch_arauto_medusa_f: medusa('j') });
B.jogo = B.jogo || {}; B.jogo.medusa = medusa;
})(globalThis.ARD = globalThis.ARD || {});
/* Rodada 2 — Sentinela da Fenda, a Raia com cara de vilã. Duas variantes do mesmo "mar do vazio" da Medusa (pele quase preta, luz própria, fios):
   kch_sentinela_ceifadora ("a predadora elegante": asas em foice com a borda de trás serrilhada, pinças de osso na frente, olho em fenda sob uma
   sobrancelha de osso, cicatrizes de Fenda no lugar das pintas e a cauda erguida em bote, com lâmina) e kch_sentinela_devoradora ("o pesadelo":
   manto rasgado com dedos de osso e garras, cacho de olhos, a boca redonda de dentes por baixo, pústulas de Fenda no dorso e tentáculos com ganchos).
   Cada uma com a pose da janela de dano (_f). */
(function (ARD) {
'use strict';
const B = ARD.kch, { PI, TAU, TH, C, rng, fbm, mixc, mul, sst, leve, nq, ns, fino, mat4, grupo, geo, poe, bez, varre, folha, mancha, fio, onda, olho, poeira, cristal } = B;
const YC = 19.4, MZ = 14.6, P0 = '#040308', P1 = '#0F0B1C', P2 = '#221A3C', BAR = '#2C2840', OS1 = '#1E1A1E', OS2 = '#463E3A', OS3 = '#8A7F70', CIC = '#FF4FB8', CIC2 = '#FFC8F0', PRESA = '#D8CCB4';
const MP = [0.36, 0.05], MO = [0.7, 0.02];
/* O.golpe: a pose do aviso de golpe (as mandíbulas abrem, as presas descem, a gengiva e o olho central acendem) */
function raia2(V, fim, O) { const golpe = !!(O && O.golpe); return function (K) { K.base = 0; const T = TH(); const r = rng(300 + V * 10 + (fim ? 1 : 0)); const dev = V === 2; const die = fim ? -5.5 : (dev ? 1.6 : 4.4);
  const serra = s => dev ? 0.55 * Math.pow(Math.abs(Math.sin(s * 8.5 + 0.6)), 0.45) + 0.45 * (0.5 + 0.5 * Math.sin(s * 23)) : 1 - 0.2 * Math.abs(((Math.abs(s) * 7) % 1) - 0.5) * 2;
  const sup = (s, v) => { const as = Math.abs(s); let c, xle; if (dev) { c = 19 * Math.pow(1 - Math.pow(as, 2.2), 0.6) + 0.5; xle = 8.8 - 7.5 * Math.pow(as, 2.0); c *= 1 - (1 - serra(s)) * 0.42 * sst(0.1, 0.5, as); } else { xle = 8.4 - 15 * Math.pow(as, 1.25) + 11.5 * Math.pow(as, 3.2); c = (18 * Math.pow(1 - Math.pow(as, 1.3), 1.05) + 0.25) * (as > 0.12 ? serra(s) : 1); }
    return [xle - v * c, YC + 2.5 * (1 - as * as) * Math.pow(Math.sin(PI * Math.min(1, v * 1.15)), 0.7) * (1 - as) + die * Math.pow(as, 1.5) + (dev ? 0.9 * Math.sin(s * 8.5 + v * 3) * as : 0) + 0.8 * Math.sin(v * PI) * as * (fim ? -1 : 1), s * MZ]; };
  const esp = (s, v) => (0.1 + (dev ? 4.8 : 3.8) * Math.pow(1 - Math.abs(s), dev ? 1.4 : 1.9)) * Math.pow(Math.sin(PI * (0.03 + 0.94 * v)), 0.75) * (1 - 0.45 * v);
  const ACC = fim ? '#6A2A4A' : CIC, ACC2 = fim ? '#8A4A6A' : CIC2, AMBv = fim ? '#8A4A1A' : C.AMB;
  for (const sg of [1, -1]) K.anim({ t: 'flap', p: [0, YC, 0], amp: fim ? 0.03 : 0.1, speed: dev ? 0.8 : 1.2, side: sg }, () => {
    poe(K, folha((u, v) => sup(sg * u, v), leve(K) ? 16 : (dev ? 30 : 46), leve(K) ? 12 : (dev ? 22 : 34), { inv: sg > 0, th: (u, v) => esp(u, v),
      cor: (u, v) => { const n = fbm(u * 6 + (sg > 0 ? 0 : 9), v * 7, 3, 3); let c = mixc(P1, P0, sst(0.0, 0.5, v) * 0.8 + 0.2 * u); c = mixc(c, P2, sst(0.6, 0.85, n) * 0.6 + 0.5 * Math.pow(u, 4)); return mul(c, 0.7 + 0.6 * n); },
      cor2: (u, v) => mul(mixc(BAR, P1, sst(0.15, 0.9, u)), 0.7 + 0.3 * Math.sin(v * 40) * (1 - u)) }), '#FFFFFF', MP, { pat: 3 });
    /* a borda da frente: gume de luz fino (âmbar frio na elegante, cicatriz magenta no pesadelo) */
    const le = []; for (let i = 0; i <= 16; i++) { const u = 0.08 + 0.92 * i / 16, p = sup(sg * u, 0.012); le.push([p[0] + 0.1, p[1] + 0.08, p[2]]); } fio(K, le, dev ? 0.24 : 0.13, dev ? 0.06 : 0.03, { c0: dev ? ACC : AMBv, c1: dev ? ACC2 : AMBv, e: fim ? 0.8 : (dev ? 2.0 : 1.5), n: 4 });
    /* cicatrizes de Fenda no dorso: riscos irregulares, no lugar das pintas */
    const NCc = nq(K, dev ? 7 : 6, 0.6); for (let k = 0; k < NCc; k++) { let u = 0.12 + r() * 0.5, v = 0.15 + r() * 0.5; const pts = [], du = 0.05 + r() * 0.05, dv = (r() - 0.35) * 0.09; for (let i = 0; i < 7; i++) { const p = sup(sg * u, v); pts.push([p[0], p[1] + 0.09, p[2]]); u = Math.min(0.94, u + du * (0.6 + r() * 0.8)); v = Math.max(0.06, Math.min(0.92, v + dv + (r() - 0.5) * 0.07)); } fio(K, pts, 0.17, 0.03, { c0: ACC2, c1: ACC, e: fim ? 0.7 : 1.7, n: 3, rf: q => 0.3 + Math.sin(q * PI) }); }
    fino(K, () => poeira(K, 26, sg > 0 ? 4 : 6, (i, q) => { const u = 0.1 + q() * 0.8, v = 0.2 + q() * 0.6, p = sup(sg * u, v); return [p[0], p[1] + 0.12, p[2], 0.08 + q() * 0.12, fim ? '#5A3A4A' : C.ETER2]; }, fim ? 0.8 : 1.8));
    /* as guelras âmbar de baixo (abrem com brilho na janela de dano) */
    for (let k = 0; k < 4; k++) { const v0 = 0.3 + k * 0.1, pts = []; for (let i = 0; i <= 5; i++) { const u = 0.1 + 0.24 * i / 5, p = sup(sg * u, v0 + 0.05 * i / 5); pts.push([p[0], p[1] - esp(u, v0) - 0.08, p[2]]); } fio(K, pts, fim ? 0.38 : 0.16, 0.08, { c0: C.AMB, c1: fim ? C.AMB2 : '#8A4212', e: fim ? 2.4 : 1.0, n: 4 }); }
    if (!dev) { /* a pinça de osso da frente: gancho comprido que fecha para dentro, com serrilha */
      const pz = curvaP(sg, fim); poe(K, varre(pz, { n: ns(K, 8), lado: [0, 1, 0], conc: 0.1, dentro: [12, YC, 0], c0: OS1, c1: OS3, c2: OS2, borda: 0.5, pot: 1.6 }), '#FFFFFF', MO, { pat: 3 });
      fino(K, () => { for (let i = 3; i < pz.length - 2; i += 2) { const p = pz[i]; cristal(K, [p[0], p[1], p[2] - sg * p[3] * 0.6], [p[0] + 0.5, p[1] - 0.2, p[2] - sg * (p[3] + 1.3)], 0.22, { n: 4, c0: OS2, c1: OS3, mat: MO, pat: 3 }); } });
      /* a ponta da asa em foice: gume de osso */
      const tp = []; for (let i = 0; i <= 6; i++) { const u = 0.8 + 0.2 * i / 6, p = sup(sg * u, 0.02); tp.push([p[0] + 0.25, p[1] + 0.1, p[2], 0.5 * (1 - i / 7) + 0.05, 0.18]); } poe(K, varre(tp, { n: 6, lado: [1, 0, 0], c0: OS2, c1: OS3 }), '#FFFFFF', MO, { pat: 3 }); }
    else { /* os dedos de osso do manto (como de asa de morcego), que passam da borda em garras */
      const ND = nq(K, 4, 0.75); for (let k = 0; k < ND; k++) { const uu = 0.42 + k * 0.17, v1 = 0.98 - k * 0.2, pts = []; const n = ns(K, 10); for (let i = 0; i <= n; i++) { const t = i / n, u = 0.06 + (uu - 0.06) * t, v = 0.32 + (v1 - 0.32) * t * t, p = sup(sg * u, v); pts.push([p[0], p[1] + esp(u, v) * 0.1 + 0.25, p[2]]); } const e = pts[n], e1 = pts[n - 1]; pts.push([e[0] + (e[0] - e1[0]) * 1.4, e[1] - 1.0, e[2] + (e[2] - e1[2]) * 1.4], [e[0] + (e[0] - e1[0]) * 2.4 + 0.6, e[1] - 3.0, e[2] + (e[2] - e1[2]) * 2.0]);
        fio(K, pts, 0.7, 0.07, { c0: OS2, c1: PRESA, mat: MO, n: 5, pot: 1.4, rf: q => 1 + 0.25 * Math.abs(Math.sin(q * 16)) }); }
      /* pústulas de Fenda no dorso */
      for (let k = 0; k < nq(K, 3, 0.67); k++) { const u = 0.2 + k * 0.17, v = 0.5 + 0.12 * k, p = sup(sg * u, v), rr = 0.85 - k * 0.15; K.anim({ t: 'bob', amp: 0.06, speed: 1.5 + r(), ph: r() * 6 }, () => poe(K, mancha(new T.SphereGeometry(rr, ns(K, 12), ns(K, 8)), '#3A0A3A', fim ? '#6A2A4A' : CIC, fim ? '#8A4A6A' : '#FFE0F6', 2.2, k + 3), '#FFFFFF', null, { e: fim ? 0.7 : 1.6, x: p[0], y: p[1] + rr * 0.15, z: p[2], sy: 0.7 })); } } });
  function curvaP(sg, fm) { return bez([[7.0, YC + 0.4, sg * 3.0], [12, YC + 0.8, sg * 6.5], [17.5, YC - 0.5 - (fm ? 2.5 : 0), sg * (fm ? 6.5 : 4.4)], [19.5, YC - 2.2 - (fm ? 4 : 0), sg * (fm ? 4.5 : 0.7)]], ns(K, 12)).map((p, i, a) => { const u = i / (a.length - 1); return [p[0], p[1], p[2], 1.25 * Math.pow(1 - u, 0.8) + 0.06, 0.55 * (1 - 0.7 * u) + 0.06]; }); }
  /* a crista de espinhos de osso na linha do dorso */
  for (let i = 0; i < nq(K, dev ? 7 : 8, 0.6); i++) { const v = (dev ? 0.42 : 0.3) + (dev ? 0.5 : 0.62) * i / (dev ? 6 : 7), p = sup(0, v), L = (dev ? 2.0 : 1.6) + (dev ? 2.2 : 1.8) * Math.sin(PI * (0.15 + 0.75 * i / (dev ? 6 : 7))); cristal(K, [p[0], p[1] - 0.2, 0], [p[0] - L * 0.8, p[1] + L, (dev ? (r() - 0.5) * 1.2 : 0)], dev ? 0.5 : 0.36, { n: 4, c0: OS1, c1: OS3, mat: MO, pat: 3, k: 1.5 }); }
  /* os olhos: fenda de predador sob a sobrancelha de osso (elegante) ou um cacho de olhos (pesadelo); âmbar, o ponto fraco */
  const pe = sup(0, 0.15), EX = pe[0] + 0.3, EY = pe[1] + 0.35, ER = dev ? 3.7 : 2.4, RZ = 0.62;
  const umOlho = (x, y, z, rr, ry, ab) => { olho(K, [x, y, z], rr, { rz: RZ, ry, abre: fim ? 1 : ab, iris: C.AMB, iris2: '#FFE9B8', iris0: fim ? '#5A2402' : '#6A1A02', alvo: fim && rr > 2, e: fim ? 2.4 : (golpe ? 3.0 : 2.5), tam: fim ? 1.15 : 0.95 });
    grupo(K, mat4(x, y, z, 0, ry, RZ), () => { const th = fim ? 1.5 : (rr > 2.6 ? 1.5 : 2.05); const g = new T.SphereGeometry(rr * 1.1, ns(K, 20), ns(K, 10), 0, TAU, 0, th); g.rotateZ(PI / 2); B.degrade(g, P1, P0, 1, 'x'); poe(K, g, '#FFFFFF', MP, { pat: 3 }); }); };
  if (!dev) { umOlho(EX, EY, 0, ER, 0, 0.02);
    for (const sg of [1, -1]) { const sb = bez([[EX - 1.6, EY + 1.2, sg * 0.3], [EX + 0.6, EY + 3.0 + (fim ? 0.6 : 0), sg * 1.6], [EX + 2.8, EY + 2.6, sg * 2.8], [EX + 4.6, EY + (fim ? 1.6 : 0.6), sg * 2.6]], 9).map((p, i) => [p[0], p[1], p[2], 0.75 * Math.sin(PI * (0.25 + 0.7 * i / 8)) + 0.05, 0.4]); poe(K, varre(sb, { n: 7, lado: [0, 0, 1], c0: OS1, c1: OS3, c2: OS1 }), '#FFFFFF', MO, { pat: 3 }); } }
  else { umOlho(EX, EY, 0, ER, 0, golpe ? 0.55 : 0.08); for (const [dx, dy, dz, rr] of [[2.3, -1.5, 3.3, 0.95], [2.3, -1.5, -3.3, 0.95], [-0.2, -0.6, 4.5, 0.75], [-0.2, -0.6, -4.5, 0.75]]) { if (leve(K) && rr < 1) continue; umOlho(EX + dx, EY + dy, dz, rr, -dz * 0.22, 0.1); }
    /* a boca na borda da frente (para aparecer na câmera do jogo): a gengiva de Fenda acesa, a fileira de presas compridas para a frente e as duas mandíbulas de osso que abrem para os lados */
    const gg = []; for (let i = 0; i <= 10; i++) { const s0 = -0.34 + 0.68 * i / 10, p = sup(s0, 0.03); gg.push([p[0] + 0.25, p[1] - esp(s0, 0.03) * 0.5 - 0.35, p[2]]); } fio(K, gg, golpe ? 0.75 : 0.5, golpe ? 0.75 : 0.5, { c0: fim ? '#6A2A4A' : CIC, c1: fim ? '#8A4A6A' : CIC2, e: fim ? 0.8 : (golpe ? 3.0 : 2.2), n: 5, rf: u => 0.5 + 0.7 * Math.sin(u * PI) });
    const NPr = nq(K, 11, 0.6); for (let i = 0; i < NPr; i++) { const s0 = -0.36 + 0.72 * i / (NPr - 1), p = sup(s0, 0.02), L = ((i % 2 ? 2.4 : 4.4) * (1 - 0.5 * Math.abs(s0) / 0.36) + 1.2) * (golpe ? 1.3 : 1); cristal(K, [p[0] - 0.3, p[1] - 0.5, p[2]], [p[0] + L, p[1] - 1.1 - (fim ? 1.5 : (golpe ? 1.7 : 0.3)) - L * 0.18, p[2] * 1.05], 0.36, { n: 4, c0: OS2, c1: PRESA, mat: MO, pat: 3 }); }
    for (const sg of [1, -1]) { const md = bez([[6.2, YC + 0.2, sg * 5.2], [10.5, YC + 0.6, sg * 9.2], [15.5, YC - 0.8 - (fim ? 2.5 : 0), sg * (fim ? 9.5 : (golpe ? 10.8 : 7.6))], [17.2, YC - 2.4 - (fim ? 3.5 : 0), sg * (fim ? 7.5 : (golpe ? 9.2 : 3.6))]], ns(K, 12)).map((p, i, a) => { const u = i / (a.length - 1); return [p[0], p[1], p[2], 1.15 * Math.pow(1 - u, 0.8) + 0.06, 0.5 * (1 - 0.7 * u) + 0.06]; });
      poe(K, varre(md, { n: ns(K, 8), lado: [0, 1, 0], conc: 0.1, dentro: [12, YC, 0], c0: OS2, c1: PRESA, c2: OS2, borda: 0.5, pot: 1.6 }), '#FFFFFF', MO, { pat: 3 }); fino(K, () => { for (let i = 3; i < md.length - 1; i += 2) { const p = md[i]; cristal(K, [p[0], p[1], p[2] - sg * p[3] * 0.6], [p[0] + 0.5, p[1] - 0.2, p[2] - sg * (p[3] + 1.4)], 0.22, { n: 4, c0: OS2, c1: PRESA, mat: MO, pat: 3 }); } }); } }
  /* a cauda: erguida em bote por cima do dorso, com a lâmina (elegante); ou tentáculos com ganchos, como os da Medusa (pesadelo) */
  const t0 = sup(0, 0.97);
  if (!dev) { const cd = fim ? bez([[t0[0], t0[1], 0], [t0[0] - 5, t0[1] - 2, 1], [t0[0] - 7, t0[1] - 9, 2], [t0[0] - 6, 3.5, 1.5]], 16) : bez([[t0[0], t0[1], 0], [t0[0] - 10, t0[1] + 2, 0], [t0[0] - 9, t0[1] + 15, 0.5], [t0[0] + 3.5, t0[1] + 12.5, 0]], 18);
    K.anim({ t: 'sway', p: [t0[0], t0[1], 0], amp: fim ? 0.02 : 0.05, speed: 0.9 }, () => { fio(K, cd, 1.15, 0.28, { c0: P1, c1: P2, mat: MP, n: 7, pot: 0.8, rf: u => 1 + 0.16 * Math.abs(Math.sin(u * 30)) }); for (let i = 2; i < cd.length - 1; i += 2) cristal(K, cd[i], [cd[i][0] - 0.9, cd[i][1] + 0.6, cd[i][2] + (i % 4 ? 1.3 : -1.3)], 0.2, { n: 4, c0: OS2, c1: OS3, mat: MO, pat: 3 });
      const e = cd[cd.length - 1], e1 = cd[cd.length - 3], d = [e[0] - e1[0], e[1] - e1[1], e[2] - e1[2]], dl = Math.hypot(d[0], d[1], d[2]), L = 7.5; const lam = []; for (let i = 0; i <= 8; i++) { const u = i / 8; lam.push([e[0] + d[0] / dl * L * u, e[1] + d[1] / dl * L * u - (fim ? 0 : 2.6 * u * u), e[2] + d[2] / dl * L * u, 1.25 * Math.pow(Math.sin(PI * (0.2 + 0.78 * u)), 0.8) * (1 - 0.3 * u) + 0.03, 0.2]); }
      poe(K, varre(lam, { n: 6, lado: [0, 0, 1], c0: OS1, c1: OS3, c2: OS2, borda: 1.0 }), '#FFFFFF', MO, { pat: 3 }); const g = lam.map(p => [p[0], p[1] - p[3] * 0.0, p[2] + p[3] * 0.98]); fio(K, g, 0.07, 0.03, { c0: AMBv, c1: fim ? AMBv : C.AMB2, e: fim ? 0.8 : 1.8, n: 3 }); }); }
  const NF = dev ? nq(K, 9, 0.6) : nq(K, 6, 0.6); for (let k = 0; k < NF; k++) { const s = -0.72 + 1.44 * k / (NF - 1); if (!dev && Math.abs(s) < 0.15) continue; const p = sup(s, 0.98), L = (dev ? 9 : 4) + r() * (dev ? 9 : 5), gr = dev ? 0.42 : 0.18;
    K.anim({ t: 'sway', p, amp: fim ? 0.03 : 0.09, speed: 0.7 + r() * 0.5, ph: r() * TAU }, () => { const pts = onda(p, [p[0] - (fim ? 0.5 : (dev ? 5 + r() * 4 : 3 + r() * 2)), Math.max(2, p[1] - L), p[2] * (dev ? 0.8 : 1.03)], ns(K, 11), { amp: dev ? 0.09 : 0.06, ph: r() * 6, fr: 1.3 }); fio(K, pts, gr, 0.05, { c0: P2, c1: fim ? '#4A2A3A' : (dev ? '#8A2A6A' : '#6A3A5A'), n: dev ? 5 : 4 }); const e = pts[pts.length - 1];
      if (dev) { cristal(K, e, [e[0] + 1.3, e[1] + 1.1, e[2]], 0.2, { n: 4, c0: OS2, c1: OS3, mat: MO, pat: 3 }); fino(K, () => { for (const f of [0.45, 0.7]) { const q = pts[Math.round(f * (pts.length - 1))]; K.sph(q[0], q[1], q[2], 0.22, ACC, null, { e: fim ? 0.7 : 1.9, seg: 6 }); } }); } else K.sph(e[0], e[1], e[2], 0.22, ACC2, null, { e: fim ? 0.8 : 2.2, seg: 6 }); }); }
}; }
B.registra('sentinela_ceifadora', { chefe: 'sentinela', ordem: 4, nome: 'A Ceifadora', eixo: 'Raia vilã: a predadora elegante',
  frase: 'A mesma raia do vazio, agora em caça: asas em foice, pinças de osso abertas na frente e a cauda erguida por cima do corpo, pronta para o bote.',
  fases: 'Vigia: plana com a cauda armada, o olho é uma fenda fina sob a sobrancelha de osso, as cicatrizes de Fenda pulsam em magenta. Janela de dano: as asas caem, a cauda desaba, as pinças abrem sem força, o olho escancara e as guelras de baixo acendem em âmbar.',
  golpes: 'Anel: as duas foices sobem e descem de uma vez. Faixa: as pinças abrem, o olho estreita e a lâmina da cauda desce na linha do golpe.',
  fraco: 'O olho âmbar no alto da cabeça (aro âmbar na janela de dano) e as guelras âmbar de baixo.',
  risco: 'Baixo. É a Raia da rodada 1 com peças de osso a mais; continua a melhor leitura de cima. Como a Raia, pede o giro do modelo na direção do alvo.' },
  { kch_sentinela_ceifadora: raia2(1, false), kch_sentinela_ceifadora_f: raia2(1, true) });
B.registra('sentinela_devoradora', { chefe: 'sentinela', ordem: 5, nome: 'A Devoradora', eixo: 'Raia vilã: o pesadelo',
  frase: 'O que a Fenda fez de uma raia: manto rasgado com dedos de osso, um cacho de olhos, a boca redonda de dentes por baixo e tentáculos com ganchos.',
  fases: 'Vigia: o manto ondula devagar, os seis olhos piscam fora de ritmo, as pústulas do dorso pulsam e a boca de baixo brilha. Janela de dano: o manto desaba, as pústulas apagam, os olhos escancaram todos e as guelras acendem em âmbar.',
  golpes: 'Anel: as pústulas incham todas e o manto bate. Faixa: a boca de baixo abre os dentes e o brilho da Fenda sai dela na linha do golpe.',
  fraco: 'O olho grande âmbar do meio do cacho (aro âmbar na janela de dano) e as guelras âmbar de baixo. Os olhos menores são só enfeite e podem confundir: é o ponto a vigiar.',
  risco: 'Médio. É a mais assustadora, mas tem mais peças pequenas (olhos, dentes, dedos) e a boca fica por baixo: na câmera do jogo ela quase não aparece.' },
  { kch_sentinela_devoradora: raia2(2, false), kch_sentinela_devoradora_f: raia2(2, true) });
B.jogo = B.jogo || {}; B.jogo.devoradora = raia2;
})(globalThis.ARD = globalThis.ARD || {});
/* Rodada 2 — Forja-Mãe, fusão da Fornalha Viva com a Carcaça-Berço: um titã meio fóssil, meio vivo. Osso velho, escuro e rachado; pele azul-noite
   com sardas de estrela crescendo por cima das costelas; casulos de drones pendurados; a fornalha-estrela ardendo no peito e vazando pelas frestas;
   crânio largo com coroa de chifres, três pares de órbitas em brasa e mandíbula partida em duas, com a fornalha no fundo da garganta.
   Duas variantes: kch_forja_tita1 ("quadrúpede": quatro patas, as da frente maiores, postura de bote) e kch_forja_tita2 ("rastejante": dois braços
   enormes de osso, corpo que se arrasta numa cauda grossa e dois cotos traseiros). Cada uma com a pose da fase final (_f). */
(function (ARD) {
'use strict';
const B = ARD.kch, { PI, TAU, TH, C, OSSOM, rng, fbm, mixc, mul, sst, leve, nq, ns, fino, mat4, grupo, geo, poe, bez, varre, esculpe, disco, mancha, fio, onda, cristal, poeira } = B;
const OB0 = '#060508', OB1 = '#1C181F', OB2 = '#3F383E', OB3 = '#635B55', PEL0 = '#0A0C18', PEL1 = '#1B2442', PEL2 = '#30406A', BR = '#FF6A1A', BR2 = '#FFC66A';
const MOSSO = [0.74, 0.02], MPELE = [0.46, 0.05];
/* tubo com relevo: raio r(u) amassado por ruído e cor por vértice com rachaduras escuras (osso velho) ou gomos (carne); normais lisas */
function tubo(K, pts, r, o) { o = o || {}; const T = TH(); if (leve(K) && pts.length > 5) pts = pts.filter((p, i) => i % 2 === 0 || i === pts.length - 1); const N = pts.length, n = leve(K) ? Math.max(4, Math.round((o.n || 8) * 0.6)) : (o.n || 8), sd = o.sd || 1, pele = !!o.pele; const V = p => new T.Vector3(p[0], p[1], p[2]); const pos = [], col = [], idx = [];
  let Nn = null; for (let i = 0; i < N; i++) { const t = V(pts[Math.min(N - 1, i + 1)]).sub(V(pts[Math.max(0, i - 1)])).normalize(); if (!Nn) Nn = new T.Vector3().crossVectors(t, Math.abs(t.y) < 0.9 ? new T.Vector3(0, 1, 0) : new T.Vector3(1, 0, 0)).normalize(); Nn.sub(t.clone().multiplyScalar(Nn.dot(t))).normalize(); const Bn = new T.Vector3().crossVectors(t, Nn), u = i / (N - 1), r0 = typeof r === 'function' ? r(u) : r;
    for (let k = 0; k < n; k++) { const a = k / n * TAU, ca = Math.cos(a), sa = Math.sin(a); const n1 = fbm(ca * 1.6 + sd, sa * 1.6 + u * (o.fu || 7), sd * 0.7, 3), n2 = fbm(ca * 3.1 + sd * 2, sa * 3.1, u * (o.fu || 7) * 1.7 + sd, 2); const rr = r0 * (pele ? 1 + 0.1 * Math.sin(u * (o.gomos || 26)) + 0.12 * (n1 - 0.5) : 0.84 + 0.36 * n1);
      const p = V(pts[i]).addScaledVector(Nn, ca * rr).addScaledVector(Bn, sa * rr); pos.push(p.x, p.y, p.z); let c;
      if (pele) { c = mul(mixc(PEL1, PEL0, sst(0.3, 0.7, n1)), 0.7 + 0.5 * Math.abs(Math.sin(u * (o.gomos || 26) / 2))); }
      else { c = mixc(OB1, OB2, sst(0.35, 0.75, n1)); c = mixc(c, OB3, sst(0.62, 0.8, n2) * 0.6); const rach = Math.abs(n2 - 0.5); if (rach < 0.035) c = mixc(OB0, c, rach / 0.035 * 0.6); c = mul(c, o.k || 1); if (o.ponta) c = mixc(c, OB0, sst(o.ponta, 1, u)); }
      col.push(c[0], c[1], c[2]); } }
  for (let i = 0; i < N - 1; i++) for (let k = 0; k < n; k++) { const k2 = (k + 1) % n, a = i * n + k, b = i * n + k2, c = (i + 1) * n + k, d = (i + 1) * n + k2; idx.push(a, b, c, b, d, c); }
  return poe(K, geo(pos, col, idx), '#FFFFFF', pele ? MPELE : MOSSO, { pat: 3 }); }
const curva = (P, n) => bez(P, n);
const tres = (a, b, c, n) => { const out = []; for (let i = 0; i < n; i++) { const t = i / (n - 1), u = 1 - t; out.push([u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1], u * u * a[2] + 2 * u * t * c[2] + t * t * b[2]]); } return out; };
const cab = u => 0.62 + 0.5 * Math.pow(Math.abs(2 * u - 1), 1.8); /* osso longo: cabeças grossas, meio fino */
/* nó âmbar de junta (o ponto fraco de cada perna): dois laços de luz e a bolsa âmbar */
function junta(K, p, r, fim, sx, sz) { poe(K, mancha(new (TH().SphereGeometry)(r * 0.86, ns(K, 16), ns(K, 10)), '#7A2E00', C.AMB, '#FFF6DC', 2.4, p[0] + p[2]), '#FFFFFF', null, { e: fim ? 0.6 : 1.7, x: p[0], y: p[1], z: p[2] });
  K.tor(p[0], p[1], p[2], r * 1.08, r * 0.13, C.AMB, null, { e: fim ? 0.5 : 2.0, ts: ns(K, 18), rs: 5, rx: sz * 0.6, rz: -sx * 0.6 }); tubo(K, tres([p[0] - sx * r * 1.2, p[1] + r * 0.9, p[2] - sz * r * 0.3], [p[0] + sx * r * 1.2, p[1] + r * 0.9, p[2] + sz * r * 0.6], [p[0], p[1] + r * 1.7, p[2]], 6), r * 0.42, { n: 6, sd: 9 });
  cristal(K, [p[0], p[1] + r * 0.6, p[2]], [p[0] + sx * r * 1.1, p[1] + r * 1.9, p[2] + sz * r * 1.1], r * 0.3, { n: 4, c0: OB2, c1: OB0, mat: MOSSO, pat: 3 }); }
/* garras: n ganchos de osso a partir do ponto p, abertos na direção (dx, dz) */
function garras(K, p, dx, dz, n, L, r) { if (leve(K)) n = Math.max(2, n - 1); const a0 = Math.atan2(dz, dx); for (let i = 0; i < n; i++) { const a = a0 + (i - (n - 1) / 2) * (1.5 / n); const ca = Math.cos(a), sa = Math.sin(a); tubo(K, curva([[p[0], p[1] + r, p[2]], [p[0] + ca * L * 0.4, p[1] + r + L * 0.42, p[2] + sa * L * 0.4], [p[0] + ca * L * 0.9, p[1] + L * 0.38, p[2] + sa * L * 0.9], [p[0] + ca * L, 0.05, p[2] + sa * L]], ns(K, 8)), u => r * (1 - 0.92 * Math.pow(u, 1.3)) + 0.04, { n: 6, sd: i + 3, ponta: 0.45, k: 1.15 }); } }
function casulo(K, p, s, fim, k, ab) { /* ab: casulo aberto (Linha de montagem) */ const T = TH(); K.anim(fim ? null : { t: 'sway', p, amp: 0.05, speed: 0.8 + (k % 3) * 0.2, ph: k }, () => grupo(K, mat4(p[0], p[1], p[2], 0, k * 1.3, 0, s), () => { fio(K, [[0, 0, 0], [0.2, -1.2, 0], [0, -2.2, 0]], 0.5, 0.7, { c0: PEL1, c1: PEL0, mat: MPELE, n: 5 });
    if (!fim) { poe(K, esculpe(ns(K, 16), ns(K, 12), 2.5, 3.8, 2.5, (a, b, c) => (1 + 0.09 * Math.sin(Math.atan2(c, a) * 6)) * (1 - 0.3 * Math.max(0, b)), (a, b, c) => mul(mixc(PEL2, PEL0, sst(-0.6, 0.8, b)), 0.85 + 0.35 * Math.sin(Math.atan2(c, a) * 6))), '#FFFFFF', [0.34, 0.08], { y: -5.2, pat: 4 });
      const sl = []; for (let i = 0; i <= 7; i++) { const t = 0.5 + 2.2 * i / 7; sl.push([Math.sin(t) * 2.56 * (1 - 0.3 * Math.max(0, -Math.cos(t))), -5.2 - Math.cos(t) * 3.85, 0, (ab ? 1.0 : 0.42) * Math.sin(i / 7 * PI) + 0.04, 0.1]); } for (const ry of [0, 2.1, 4.2]) grupo(K, mat4(0, 0, 0, 0, ry, 0), () => poe(K, varre(sl, { n: 6, lado: [0, 0, 1], c0: BR2, c1: BR }), '#FFFFFF', null, { e: ab ? 2.6 : 1.6 })); if (ab) K.sph(0, -5.2, 0, 1.5, BR2, null, { e: 2.2, seg: 8 }); }
    else poe(K, B.casca([[0.3, -8.6], [1.9, -7.6], [2.5, -5.6], [1.8, -3.2]], { n: ns(K, 12), esp: 0.3, al: 4.6, a0: k, f: (a, v, rr, y) => [rr * (1 + 0.25 * Math.sin(a * 5) * v), y + v * 0.9 * Math.abs(Math.sin(a * 2.5))], cor: (a, v) => mixc(PEL0, PEL1, v), corIn: () => '#3A1208' }), '#FFFFFF', [0.4, 0.06], { pat: 4 }); })); }
/* o crânio: largo, de cunha, com coroa de chifres, três pares de órbitas, presas e a mandíbula partida em duas; abre = 0..1 */
function cranio(K, abre, fim, q) { /* q: quente (aviso de golpe: órbitas e garganta mais acesas) */ const T = TH(); const EM = fim ? '#6A2408' : (q ? BR2 : BR), eb = (fim ? 0.8 : 2.2) * (q ? 1.5 : 1);
  const orb = [[2.9, 1.0, 3.0, 1.0], [1.0, 1.9, 3.9, 0.72], [-1.0, 2.5, 4.2, 0.55]];
  poe(K, esculpe(leve(K) ? 16 : 36, leve(K) ? 10 : 24, 6.6, 3.7, 5.8, (x, y, z) => { let f = 1 - 0.34 * sst(0.1, 1, x) * (1 - 0.3 * Math.abs(z)) + 0.2 * sst(0.1, 0.5, y) * sst(0.6, 0.1, Math.abs(x - 0.2)) + 0.16 * (fbm(x * 2.5 + 3, y * 2.5, z * 2.5, 3) - 0.5); if (y < -0.25) f *= 1 - 0.55 * (-y - 0.25); f += 0.22 * sst(0.55, 0.95, Math.abs(z)) * sst(-0.3, 0.3, y) * sst(-0.9, -0.2, x) * sst(0.6, 0.0, x);
      for (const o of orb) { const d = Math.hypot((x * 6.6 - o[0]) / 1.9, (y * 3.7 - o[1]) / 1.5, (Math.abs(z) * 5.8 - o[2]) / 1.9) / o[3]; if (d < 1) f *= 0.72 + 0.28 * d; } return f; },
    (x, y, z) => { const n1 = fbm(x * 3 + 1, y * 3, z * 3, 3), n2 = fbm(x * 6.5 + 7, y * 6.5, z * 6.5, 2); let c = mixc(OB1, OB2, sst(0.3, 0.7, n1)); c = mixc(c, OB3, sst(0.6, 0.8, n2) * 0.7 * sst(-0.2, 0.8, y)); const rc = Math.abs(n2 - 0.5); if (rc < 0.03) c = mixc(OB0, c, rc / 0.03 * 0.5); for (const o of orb) { const d = Math.hypot((x * 6.6 - o[0]) / 1.9, (y * 3.7 - o[1]) / 1.5, (Math.abs(z) * 5.8 - o[2]) / 1.9) / o[3]; if (d < 1) c = mul(c, 0.15 + 0.85 * d); } return c; }), '#FFFFFF', MOSSO, { pat: 3 });
  for (const sg of [1, -1]) { orb.forEach((o, i) => { K.sph(o[0] + 0.1, o[1] - 0.1, sg * (o[2] - 0.3), 1.0 * o[3], EM, null, { e: fim ? 0.8 : (q ? 3.8 : 2.8), seg: 10, sy: q ? 0.8 : 0.6, rz: -0.35 }); fino(K, () => K.sph(o[0] + 0.5 * o[3], o[1] - 0.05, sg * (o[2] - 0.2), 0.2 * o[3], '#FFF1C8', null, { e: fim ? 0.6 : 2.4, seg: 6 })); });
    /* chifres laterais para a frente e a coroa para trás */
    tubo(K, curva([[-1.5, 0.6, sg * 5.2], [-1, 3, sg * 10.5], [5, 6, sg * 11.5], [9.5, 3.2, sg * 8.2]], ns(K, 12)), u => 1.5 * (1 - 0.93 * Math.pow(u, 1.2)) + 0.05, { n: 7, sd: 5 + sg, ponta: 0.5 });
    const NCh = nq(K, 3, 0.4); for (let i = 0; i < NCh; i++) { const a = 0.55 + i * 0.45, L = 11 - i * 2; tubo(K, curva([[-3.6, 2.2, sg * (1.6 + i * 1.5)], [-6.5, 4 + L * 0.12, sg * (2.6 + i * 2.6)], [-9.5 - L * 0.35, 4.5 + L * 0.25, sg * (3.4 + Math.sin(a) * L * 0.8)], [-10.5 - L * 0.7, 3 + L * 0.22, sg * (3.8 + Math.sin(a) * L * 1.15)]], ns(K, 10)), u => (1.25 - i * 0.2) * (1 - 0.94 * Math.pow(u, 1.2)) + 0.05, { n: 6, sd: 11 + i * 2 + sg, ponta: 0.5 }); }
    /* presas de cima e a meia mandíbula deste lado (abre para baixo e para fora), com os dentes */
    const NP = nq(K, 6, 0.5); for (let i = 0; i < NP; i++) { const x = 5.6 - i * 1.25, z = sg * (1.2 + i * 0.62), L = i === 1 ? 3.6 : 1.5 + (i % 2) * 0.7; cristal(K, [x, -1.3, z], [x + 0.5, -1.3 - L, z + sg * 0.25], 0.36 + (i === 1 ? 0.2 : 0), { n: 4, c0: OB3, c1: '#C8BCA4', mat: MOSSO, pat: 3 }); }
    const ab = abre, md = curva([[-3.2, -1.6, sg * 4.6], [0.5, -4.2 - ab * 2, sg * (5.2 + ab * 1.8)], [5, -4.6 - ab * 3.6, sg * (3.6 + ab * 2.2)], [8.6, -2.6 - ab * 3.4, sg * (1.0 + ab * 2.4)]], ns(K, 12));
    tubo(K, md, u => 1.25 * (1 - 0.85 * Math.pow(u, 1.5)) + 0.08, { n: 7, sd: 21 + sg, ponta: 0.7 }); for (let i = 3; i < md.length - 1; i += leve(K) ? 2 : 1) { const m = md[i], L = 1.1 + (i % 3) * 0.6; cristal(K, [m[0], m[1] + 0.5, m[2]], [m[0] + 0.2, m[1] + 0.6 + L, m[2] - sg * 0.5], 0.3, { n: 4, c0: OB3, c1: '#C8BCA4', mat: MOSSO, pat: 3 }); } }
  /* a fornalha no fundo da garganta e o nariz em fenda */
  poe(K, mancha(new T.SphereGeometry(2.7, ns(K, 20), ns(K, 14)), '#4A0E00', fim ? '#7A2408' : BR, fim ? '#B8501A' : '#FFF1C8', 2.6, 7), '#FFFFFF', null, { e: fim ? 0.8 : (q ? 3.4 : 2.4), x: 0.9, y: -2.6 - abre, sx: 1.6, sy: 0.75 + 0.3 * abre });
  for (const sg of [1, -1]) K.box(5.4, 0.3, sg * 0.5, 1.3, 0.12, 0.24, EM, null, { e: eb * 0.7, ry: sg * 0.3, rz: -0.5 }); }
/* O (para o jogo): pernas: false = só o corpo (as pernas são desenhadas à parte, uma por canto); estrela: false = sem a estrela na pose caída (o núcleo exposto é outra peça);
   boca = abertura da mandíbula 0..1; junta: false = pata sem o nó âmbar (o ponto fraco é a peça chefe_junta); soPerna: 'pe' | 'caida' = só uma pata, no eixo +x, com o quadril na origem do canto */
function tita(V, fim, O) { O = O || {}; return function (K) { K.base = 0; const T = TH(); const r = rng(200 + V * 10 + (fim ? 1 : 0)); const rast = V === 2;
  const pata = (H, J, P, rb, rc, sx, sz, ng, Lg) => { K.anim(fim || O.soPerna === 'caida' ? null : { t: 'leg', p: H, amp: 0.09, stride: 14, ph: (sx * sz > 0 ? 0 : PI) }, () => { const m1 = [(H[0] + J[0]) / 2, (H[1] + J[1]) / 2 + rb * 0.6, (H[2] + J[2]) / 2];
      tubo(K, tres(H, J, m1, ns(K, 9)), u => rb * cab(u), { n: 8, sd: sx * 3 + sz * 5 + 20 }); tubo(K, tres([H[0], H[1] + 0.3, H[2]], [H[0] + (J[0] - H[0]) * 0.72, H[1] + (J[1] - H[1]) * 0.72 + 0.4, H[2] + (J[2] - H[2]) * 0.72], [m1[0] - sx * 0.4, m1[1] + 0.6, m1[2]], ns(K, 8)), u => rc * (1.05 - 0.4 * u), { n: 10, pele: true, gomos: 18, sd: sx + sz * 2 + 8 });
      const m2 = [(J[0] + P[0]) / 2 + sx * rb * 0.8, (J[1] + P[1]) / 2, (J[2] + P[2]) / 2 + sz * rb * 0.8]; tubo(K, tres(J, [P[0], P[1] + rb * 0.9, P[2]], m2, ns(K, 10)), u => rb * 0.92 * cab(u) * (1 + 0.25 * u), { n: 8, sd: sx * 7 + sz * 3 + 40 });
      fino(K, () => { for (let i = 0; i < 3; i++) { const f = 0.3 + i * 0.2, q = [J[0] + (m2[0] - J[0]) * f * 1.6, J[1] + (P[1] - J[1]) * f, J[2] + (m2[2] - J[2]) * f * 1.6]; cristal(K, q, [q[0] + sx * 2.6, q[1] + 2.4, q[2] + sz * 2.6], 0.5, { n: 4, c0: OB2, c1: OB0, mat: MOSSO, pat: 3 }); } });
      if (O.junta !== false) junta(K, J, rb * 1.2, fim, sx, sz); else { K.sph(J[0], J[1], J[2], rb * 1.25, OB2, MOSSO, { seg: ns(K, 10), pat: 3 }); cristal(K, [J[0], J[1] + rb * 0.5, J[2]], [J[0] + sx * rb * 1.2, J[1] + rb * 2.4, J[2] + sz * rb * 1.2], rb * 0.4, { n: 4, c0: OB2, c1: OB0, mat: MOSSO, pat: 3 }); } garras(K, [P[0], P[1] + rb * 0.4, P[2]], sx * 0.8, sz, ng, Lg, rb * 0.5); }); };
  if (O.soPerna) { if (O.soPerna === 'caida') pata([-6, 3.6, 0], [6, 4.4, 1.5], [18, 0.3, -1], 3.0, 4.2, 1, 0.0001, 3, 7); else pata([-8.5, 23.5, 0], [7, 28.5, 0], [14.5, 0, 0], 3.0, 4.6, 1, 0.0001, 3, 8.5); return; }
  const CX = -3, YN = fim ? 13.5 : (rast ? 16.5 : 18); const QB = fim ? '#7A2A0A' : BR, QB2 = fim ? '#B8501A' : BR2;
  /* a espinha: da cauda à nuca; baixa na frente (cabeça à frente do corpo), arqueada no meio; na fase final, no chão e partida */
  const esp = t => { if (fim) return [-19 + 33 * t + (t < 0.55 ? -1.5 : 2), 3.4 + (t < 0.55 ? 4 * (0.55 - t) : 1.5 * (t - 0.55)) + (rast ? 0 : 0), (t < 0.55 ? -2.5 + 6 * t : 4.5 - 7 * (t - 0.55))]; const a = rast ? 12.5 : 11.5; return [-18 + 31 * t, (rast ? 14 + 4 * t : 19.5) + a * Math.pow(Math.sin(PI * (0.1 + 0.72 * t)), 1.2) - 3.5 * t * t, 0]; };
  const NVt = ns(K, 14); const pe = []; for (let i = 0; i < NVt; i++) pe.push(esp(i / (NVt - 1)));
  if (!fim) tubo(K, pe, 1.7, { n: 8, sd: 31, fu: 14 }); else { tubo(K, pe.slice(0, Math.floor(NVt * 0.5)), 1.6, { n: 7, sd: 31 }); tubo(K, pe.slice(Math.ceil(NVt * 0.58)), 1.6, { n: 7, sd: 33 }); }
  for (let i = 0; i < NVt; i += leve(K) ? 2 : 1) { const t = i / (NVt - 1), p = esp(t), s = 0.7 + 0.6 * Math.sin(PI * t); if (fim && Math.abs(t - 0.54) < 0.06) continue; const L = (fim ? 2.5 : 3.2 + 4.2 * Math.sin(PI * (0.15 + 0.7 * t))) * (i % 2 ? 0.75 : 1) * (t > 0.8 ? 0.45 : 1); cristal(K, [p[0], p[1] + 0.8, p[2]], [p[0] - L * 0.55, p[1] + L + 1, p[2] + (r() - 0.5) * 1.2], 0.75 * s, { n: 4, c0: OB2, c1: OB0, mat: MOSSO, pat: 3, k: 1.4 });
    fino(K, () => { for (const sg of [1, -1]) cristal(K, [p[0], p[1], p[2]], [p[0] - 0.6, p[1] + 0.9, p[2] + sg * (2.6 * s + 0.6)], 0.5 * s, { n: 4, c0: OB2, c1: OB1, mat: MOSSO, pat: 3 }); }); }
  /* as costelas (sete pares), escuras, com a face de dentro tisnada pela fornalha; na fase final caem abertas */
  const NCo = nq(K, 7, 0.55), tops = []; for (let k = 0; k < NCo; k++) { const t = 0.24 + 0.52 * k / (NCo - 1), top = esp(t), big = Math.sin(PI * (0.14 + 0.74 * k / (NCo - 1))), R = 7.4 + 6.4 * big; tops.push([top, R, big]); for (const sg of [1, -1]) { const n = ns(K, 14), pts = []; if (fim && (k + (sg > 0 ? 0 : 1)) % 3 === 0) continue; const ab = 0.85 + 0.3 * r();
      for (let i = 0; i < n; i++) { const u = i / (n - 1), ph = u * 2.5; let y, z; if (!fim) { y = top[1] - R * (1 - Math.cos(ph)) * (rast ? 0.9 : 0.96); z = sg * R * Math.sin(ph) * 1.12; } else { z = top[2] + sg * (1.5 + R * 1.3 * Math.sin(u * 1.45) * ab); y = top[1] - 0.6 + 9 * Math.pow(u, 2.4) * ab; }
        pts.push([top[0] + (fim ? (k - NCo / 2) * 0.5 * u : 1.8 * Math.sin(u * PI) - u * 1.4), Math.max(0.6, y), z, (1.05 * Math.sin(PI * (0.14 + 0.8 * u)) + 0.14) * (0.8 + 0.4 * big) * (1 + 0.18 * Math.sin(u * 23 + k)), 0.55 * (1 - 0.6 * u) + 0.1]); }
      const g = varre(pts, { n: ns(K, 8), lado: [1, 0, 0], dentro: [top[0], YN, 0], conc: 0.22, c0: OB2, c1: OB1, c2: fim ? OB0 : '#2A0F08', pot: 1.3, ao: 0.2 }); const cl = g.attributes.color, ps = g.attributes.position; for (let i = 0; i < cl.count; i++) { const nn = fbm(ps.getX(i) * 0.9 + k, ps.getY(i) * 0.9, ps.getZ(i) * 0.9, 3), rc = Math.abs(fbm(ps.getX(i) * 1.7, ps.getY(i) * 1.7 + k, ps.getZ(i) * 1.7, 2) - 0.5), m = (0.55 + 0.9 * nn) * (rc < 0.03 ? 0.35 : 1); cl.setXYZ(i, cl.getX(i) * m, cl.getY(i) * m, cl.getZ(i) * m); }
      poe(K, g, '#FFFFFF', MOSSO, { pat: 3 }); const e = pts[n - 1]; if (false) fino(K, () => cristal(K, [e[0], e[1], e[2]], [e[0] + 0.5, e[1] - 2.2, e[2] - sg * 1.6], 0.45, { n: 4, c0: OB2, c1: OB0, mat: MOSSO, pat: 3 })); } }
  /* a pele azul-noite que cresce por cima das costelas (dorso e flancos), rasgada embaixo e furada: a luz da fornalha vaza pelos rasgos */
  const HX = 15.5, HY = fim ? 7.5 : (rast ? 12.5 : 13), HZ = 15.6, HC = [CX - 1.5, YN + (fim ? -3 : (rast ? 3.2 : 3.6)), 0];
  const hf = (x, y, z) => 1 + 0.05 * Math.pow(Math.abs(Math.sin(x * 8.4)), 0.6) + 0.07 * (fbm(x * 3 + 4, y * 3, z * 3, 2) - 0.5) + 0.1 * Math.max(0, y) * Math.exp(-(x + 0.1) * (x + 0.1) / 0.2);
  const hfuro = (x, y, z) => { const rg = fbm(x * 3.2 + 2, z * 3.2 * Math.sign(z || 1), 5, 3), bur = fbm(x * 4.4 + 9, y * 4.4, z * 4.4, 2); if (fim) { const d = Math.hypot((x + 0.05) / 0.62, z / 0.7); return y < 0.25 + 0.3 * rg || (d < 1 && y > 0.3) || bur > 0.64; } if (O.linha && y > 0.42 && Math.abs(x) < 0.72 && Math.abs(z) < 0.2 + 0.07 * Math.sin(x * 16.8)) return true; /* Linha de montagem: o dorso abre ao longo da espinha e a fornalha aparece de cima */ return y < -0.18 + 0.62 * rg - 0.25 * sst(0.4, 0.9, Math.abs(x)) || bur > 0.69 || x > 0.86 || x < -0.93; };
  poe(K, esculpe(leve(K) ? 22 : 56, leve(K) ? 14 : 34, HX, HY, HZ, hf, (x, y, z) => { const dob = Math.abs(Math.sin(x * 8.4)); let c = mixc(PEL2, PEL1, sst(-0.3, 0.3, y)); c = mixc(c, PEL0, sst(0.3, 0.9, y)); c = mul(c, 0.5 + 0.6 * sst(0, 0.5, dob)); c = mul(c, 0.65 + 0.7 * fbm(x * 9, y * 9, z * 9, 3)); if (y > 0.1) c = mul(c, 0.7 + 0.3 * sst(0.25, 0.5, Math.abs(Math.sin(z * 9 + Math.sin(x * 5) * 1.5)))); return c; }, hfuro), '#FFFFFF', MPELE, { x: HC[0], y: HC[1], z: 0, pat: 3 });
  const hp = (x, y, z, k) => { const l = Math.hypot(x, y, z); x /= l; y /= l; z /= l; const f = hf(x, y, z) * (k || 1); return [HC[0] + x * f * HX, HC[1] + y * f * HY, z * f * HZ]; };
  for (let k = -2; k <= 2; k += leve(K) ? 2 : 1) { const nx = k * PI / 8.4; const s = Math.sqrt(1 - nx * nx), n = ns(K, 14); for (const sg of [1, -1]) { const pts = []; for (let i = 0; i <= n; i++) { const th = 0.12 + 1.1 * i / n; pts.push(hp(nx, s * Math.cos(th), sg * s * Math.sin(th), 1.006)); } fio(K, pts, O.linha ? 0.48 : 0.3, O.linha ? 0.48 : 0.3, { c0: QB2, c1: QB, e: fim ? 1.0 : (O.linha || O.golpe ? 2.4 : 1.5), n: 4, rf: u => 0.3 + 0.9 * Math.pow(u, 0.7) }); } }
  fino(K, () => poeira(K, 120, 12, (i, q) => { const a = q() * TAU, y = 0.2 + q() * 0.75, s = Math.sqrt(1 - y * y), x = Math.cos(a) * s, z = Math.sin(a) * s; if (hfuro(x, y, z)) return null; const p = hp(x, y, z, 1.012); return [p[0], p[1], p[2], 0.1 + q() * 0.16, q() < 0.8 ? C.ETER2 : C.FEN2]; }, fim ? 1.0 : 1.9));
  /* tendões de pele que descem do dorso até as pontas das costelas */
  if (!fim && !leve(K)) for (let k = 1; k < NCo - 1; k++) for (const sg of [1, -1]) { if ((k + (sg > 0 ? 0 : 1)) % 2) continue; const [top, R] = tops[k]; const a = hp((top[0] - HC[0]) / HX, 0.05, sg * 0.98, 0.98), b = [top[0] + 0.5, top[1] - R * 1.55, sg * R * 0.95]; tubo(K, tres(a, b, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, sg * (R * 1.25 + 1.5)], 7), u => 0.75 * (1 - 0.6 * u) + 0.12, { n: 5, pele: true, gomos: 14, sd: k }); }
  /* os casulos dos drones: pendurados entre as costelas e incrustados no dorso */
  const NCa = nq(K, 8, 0.25); for (let k = 0; k < NCa; k++) { const sg = k % 2 ? 1 : -1, i = 1 + Math.floor(k / 2) % (NCo - 2), [top, R] = tops[Math.min(NCo - 1, i)]; if (k < 4 || fim) casulo(K, fim ? [top[0] + 1.5, 9.5 + (k % 3), sg * (R * 0.9 + 6 + k)] : [top[0] + 1.6, top[1] - R * 0.5, sg * (R * 1.2 + 1.3)], 0.82 + 0.2 * r(), fim, k, !!O.linha);
    else { const p = hp(0.5 - (k - 4) * 0.33, 0.7, sg * 0.55, 0.96); grupo(K, mat4(p[0], p[1], p[2], sg * 0.5, 0, 0, 0.8), () => grupo(K, mat4(0, 7.2, 0, 0, 0, 0), () => casulo(K, [0, 0, 0], 1, false, k, !!O.linha))); } }
  /* a fornalha-estrela no peito: plasma que gira, dois discos de nebulosa que saem pelas frestas e as fagulhas (os drones por nascer) */
  const SX = CX + 0.5; if (!(fim && O.estrela === false)) K.anim({ t: 'spin', p: [SX, YN, 0], speed: 0.45 }, () => poe(K, mancha(new T.SphereGeometry(fim ? 6 : (O.linha ? 6.6 : 5.4), ns(K, 32), ns(K, 22)), fim ? '#8A3200' : '#6A1C00', fim ? C.AMB : '#FF8A2A', '#FFF6DC', 2.6, 23), '#FFFFFF', null, { e: fim ? 2.1 : 1.9, x: SX, y: fim ? YN + 3 : YN }));
  [[0.3, 0.25, fim ? 13 : 12.5, 0.24, 3, C.FEN], [-0.45, -0.2, fim ? 10.5 : 10.5, -0.32, 8, '#FF9A3A']].forEach(([tx, tz, R, sp, sd, c1], k) => { if (leve(K) && k) return; if (fim && O.estrela === false) return; K.anim({ t: 'spin', p: [SX, YN, 0], speed: sp * (fim ? 2 : 1) }, () => grupo(K, mat4(SX, fim ? YN + 3 : YN, 0, tx, 0, tz), () => poe(K, disco(4.6, R, ns(K, 64), ns(K, 5), (u, a) => { const s1 = fbm(Math.cos(a) * 3 + u * 4 + sd, Math.sin(a) * 3, u * 2, 3); return mul(mixc(fim ? '#FFE9B8' : c1, fim ? '#7A2A06' : '#3B1A7A', sst(0.1, 0.9, u)), (0.12 + 1.6 * sst(0.4, 0.7, s1)) * (1 - sst(0.75, 1, u)) * sst(0, 0.12, u)); }, { tw: 1.6, y: (u, a) => 0.7 * Math.sin(a * 2 + sd) * u, verso: 0.8 }), '#FFFFFF', null, { e: 1.5 }))); });
  if (fim && O.estrela !== false) K.tor(SX, YN + 3, 0, 8.6, 0.2, C.AMB, null, { e: 2.8, ts: ns(K, 40), rs: 5 });
  K.anim({ t: 'spin', p: [SX, YN, 0], speed: -0.2 }, () => poeira(K, nq(K, 130, 0.5), 6, (i, q) => { const a = q() * TAU, rr = 5 + q() * (fim ? 13 : 9), y = YN + (q() - 0.3) * (fim ? 18 : 11); return [SX + Math.cos(a) * rr * 1.25, y, Math.sin(a) * rr, 0.1 + q() * 0.24, q() < 0.5 ? '#FFF1C8' : (q() < 0.5 ? BR2 : C.FEN2)]; }, 2.2));
  /* pescoço de carne e o crânio, baixo e à frente; a boca aberta mostra a fornalha */
  const nk = esp(1), CR = fim ? [nk[0] + 8, 4.4, nk[2] + 5] : [nk[0] + 13, nk[1] - (rast ? 2.5 : 4.5), 0];
  tubo(K, tres([nk[0] - 2, nk[1], nk[2]], [CR[0] - 6.5, CR[1] + 0.4, CR[2]], [(nk[0] + CR[0]) / 2, Math.max(nk[1], CR[1]) + 1.5, (nk[2] + CR[2]) / 2], 7), u => 4.4 - 1.2 * u, { n: 10, pele: true, gomos: 16, sd: 3 });
  grupo(K, mat4(CR[0], CR[1], CR[2], fim ? 0.45 : 0, fim ? -0.5 : 0, fim ? -0.08 : (rast ? -0.3 : -0.36), 1.5), () => cranio(K, O.boca != null ? O.boca : (fim ? 0.25 : 1), fim, !!O.golpe));
  /* as patas: osso rachado, com carne no trecho de cima, o nó âmbar na junta e as garras */
  if (O.pernas === false) { /* no jogo as pernas são peças à parte */ } else if (!rast) { for (const sz of [1, -1]) { if (!fim) { pata([7.5, 24.5, sz * 7], [15.5, 27.5, sz * 23.5], [24.5, 0, sz * 27.5], 2.9, 4.4, 1, sz, 3, 8.5); pata([-13.5, 22.5, sz * 6], [-19.5, 23.5, sz * 20.5], [-24.5, 0, sz * 24], 2.3, 3.6, -1, sz, 3, 6.5); }
      else { pata([8, 4.5, sz * 11], [19, 5, sz * 23], [30, 0.3, sz * 19], 2.9, 4.2, 1, sz, 3, 7); pata([-13, 4, sz * 12], [-21, 4.2, sz * 23], [-31, 0.3, sz * 19], 2.3, 3.4, -1, sz, 3, 5.5); } } }
  else { for (const sz of [1, -1]) { if (O.pernas === false) break; if (!fim) { pata([7, 25, sz * 8], [13, 33.5, sz * 25], [23.5, 0, sz * 24.5], 3.5, 5.4, 1, sz, 4, 10); pata([-13.5, 12.5, sz * 7.5], [-18.5, 10.5, sz * 16.5], [-20, 0, sz * 20.5], 1.7, 2.6, -1, sz, 2, 4.5); }
      else { pata([8, 5, sz * 11], [20, 6, sz * 24], [32, 0.3, sz * 17], 3.5, 5, 1, sz, 4, 8); pata([-13, 3.5, sz * 9], [-18, 3.6, sz * 17], [-22, 0.3, sz * 22], 1.7, 2.4, -1, sz, 2, 4); } }
    /* a cauda grossa que se arrasta: vértebras por dentro, carne por fora, espinhos no dorso e o ferrão de osso */
    const c0 = esp(0), cd = curva(fim ? [[c0[0], c0[1], c0[2]], [c0[0] - 8, 3.4, c0[2] - 5], [c0[0] - 13, 2.6, c0[2] + 4], [c0[0] - 15, 1.6, c0[2] + 13]] : [[c0[0] + 1, c0[1] - 1, 0], [-25, 9, -1.5], [-31, 4, 5], [-28.5, 2.2, 15.5]], ns(K, 14));
    K.anim(fim ? null : { t: 'sway', p: [c0[0], 3, 0], amp: 0.035, speed: 0.6 }, () => { tubo(K, cd, u => 5.6 * (1 - 0.8 * Math.pow(u, 0.85)) + 0.5, { n: 10, pele: true, gomos: 34, sd: 5 }); for (let i = 1; i < cd.length - 1; i += leve(K) ? 2 : 1) { const u = i / (cd.length - 1), p = cd[i], rr = 5.6 * (1 - 0.8 * Math.pow(u, 0.85)) + 0.5; cristal(K, [p[0], p[1] + rr * 0.7, p[2]], [p[0] + 1.2, p[1] + rr + 3.6 * (1 - u) + 1, p[2]], 0.75 * (1 - u * 0.5), { n: 4, c0: OB2, c1: OB0, mat: MOSSO, pat: 3 }); }
      const e = cd[cd.length - 1], e1 = cd[cd.length - 2]; tubo(K, curva([e, [e[0] + (e[0] - e1[0]) * 2, e[1] + 2.5, e[2] + (e[2] - e1[2]) * 2], [e[0] + (e[0] - e1[0]) * 3.5 + 2.5, e[1] + 6, e[2] + (e[2] - e1[2]) * 3], [e[0] + (e[0] - e1[0]) * 2.5 + 6.5, e[1] + 4.5, e[2] + (e[2] - e1[2]) * 2]], 8), u => 1.25 * (1 - 0.94 * u) + 0.05, { n: 6, sd: 77, ponta: 0.4 }); }); }
  if (!rast && !fim) { const c0 = esp(0), cd = curva([[c0[0], c0[1], 0], [-24, 21, 0], [-29, 15, 2.5], [-32.5, 7.5, -2]], 9); K.anim({ t: 'sway', p: [c0[0], c0[1], 0], amp: 0.06, speed: 0.7 }, () => { tubo(K, cd, u => 1.9 * (1 - 0.85 * u) + 0.2, { n: 7, sd: 55, fu: 16 }); for (let i = 1; i < cd.length; i++) { const s = 1 - i / cd.length; cristal(K, cd[i], [cd[i][0] - 1.2, cd[i][1] + 3.4 * s + 0.6, cd[i][2]], 0.5 * s + 0.14, { n: 4, c0: OB2, c1: OB0, mat: MOSSO, pat: 3 }); } }); }
}; }
B.registra('forja_tita1', { chefe: 'forja', ordem: 4, nome: 'O Titã-Fornalha', eixo: 'Fusão A + C, quadrúpede',
  frase: 'O esqueleto de um gigante de antes das estrelas, com carne nova crescendo por cima do osso: no peito arde a fornalha onde ele derrete destroços e cria os drones.',
  fases: 'Marcha: anda baixo, de cabeça à frente; a fornalha aparece só pelas frestas da pele e pela garganta. Linha de montagem: os casulos pendurados entre as costelas incham e abrem, a mandíbula partida abre de lado e as fagulhas saem. Núcleo exposto: a espinha parte, o titã desaba, as costelas caem abertas, a pele do dorso rasga e a estrela âmbar fica à mostra.',
  golpes: 'Pisão: a pata da frente sobe com as garras abertas e o nó âmbar aperta. Solda: as duas metades da mandíbula abrem para os lados e a luz sobe da fornalha pela garganta. Onda de calor: as dobras da pele acendem do peito para fora.',
  fraco: 'Os quatro nós âmbar das juntas (um por pata) e, na fase final, a estrela âmbar do peito, com o aro âmbar.',
  risco: 'Médio. É o caminho mais direto: quatro pernas como hoje (a simulação não muda), só que as da frente são maiores. A pele vazada pede cuidado na versão leve.' },
  { kch_forja_tita1: tita(1, false), kch_forja_tita1_f: tita(1, true) });
B.registra('forja_tita2', { chefe: 'forja', ordem: 5, nome: 'O Rastejante da Fornalha', eixo: 'Fusão A + C, dois braços e cauda',
  frase: 'Metade do gigante já virou pó: sobraram dois braços enormes de osso, que puxam pelo chão o resto do corpo e a cauda, com a fornalha acesa no peito.',
  fases: 'Marcha: avança aos puxões, um braço de cada vez, a cauda varrendo o chão. Linha de montagem: os casulos abrem e a cauda levanta o ferrão. Núcleo exposto: os braços cedem, o corpo deita, a pele do dorso rasga e a estrela âmbar fica à mostra.',
  golpes: 'Pisão: é o soco do braço, com as quatro garras abertas. Solda: a mandíbula partida abre e a fornalha sobe pela garganta. Onda de calor: a cauda bate no chão e as dobras da pele acendem.',
  fraco: 'Quatro nós âmbar: os dois cotovelos enormes da frente e os dois cotos de trás, junto da cauda; na fase final, a estrela âmbar do peito.',
  risco: 'Alto. É o mais monstruoso e o mais vilão dos dois, mas as "pernas" deixam de ser quatro iguais: a queda por perna, a lentidão por perna destruída e os cantos do casco teriam de ser refeitos, e a cauda sai do raio atrás.' },
  { kch_forja_tita2: tita(2, false), kch_forja_tita2_f: tita(2, true) });
B.jogo = B.jogo || {}; B.jogo.tita = tita; B.jogo.titaJunta = function (K) { K.base = 0; /* o ponto fraco de cada perna: garra de osso que sai do chão e segura a bolsa âmbar */ for (let i = 0; i < 4; i++) { const a = i * PI / 2 + 0.4; tubo(K, curva([[Math.cos(a) * 3.4, 0, Math.sin(a) * 3.4], [Math.cos(a) * 4.6, 4, Math.sin(a) * 4.6], [Math.cos(a) * 3.8, 8.5, Math.sin(a) * 3.8], [Math.cos(a) * 1.2, 11.5, Math.sin(a) * 1.2]], ns(K, 9)), u => 1.15 * (1 - 0.85 * u) + 0.1, { n: 6, sd: i + 61, ponta: 0.6 }); }
  K.anim({ t: 'bob', amp: 0.18, speed: 3.2 }, () => { poe(K, mancha(new (TH().SphereGeometry)(2.7, ns(K, 18), ns(K, 12)), '#7A2E00', C.AMB, '#FFF6DC', 2.4, 31), '#FFFFFF', null, { e: 2.0, y: 6.2, sy: 1.15 }); K.tor(0, 6.2, 0, 3.3, 0.16, C.AMB, null, { e: 2.4, ts: ns(K, 20), rs: 5, rx: 0.5 }); }); };
B.jogo.titaNucleo = function (K) { K.base = 0; /* o núcleo exposto: a estrela âmbar, os dois discos de nebulosa e o aro */ const T = TH();
  K.anim({ t: 'spin', p: [0, 8, 0], speed: 0.5 }, () => poe(K, mancha(new T.SphereGeometry(6, ns(K, 30), ns(K, 20)), '#8A3200', C.AMB, '#FFF6DC', 2.6, 23), '#FFFFFF', null, { e: 2.1, y: 8 }));
  [[0.3, 0.25, 12.5, 0.5, 3], [-0.45, -0.2, 10, -0.6, 8]].forEach(([tx, tz, R, sp, sd], k) => { if (leve(K) && k) return; K.anim({ t: 'spin', p: [0, 8, 0], speed: sp }, () => grupo(K, mat4(0, 8, 0, tx, 0, tz), () => poe(K, disco(4.8, R, ns(K, 56), ns(K, 5), (u, a) => { const s1 = fbm(Math.cos(a) * 3 + u * 4 + sd, Math.sin(a) * 3, u * 2, 3); return mul(mixc('#FFE9B8', '#7A2A06', sst(0.1, 0.9, u)), (0.12 + 1.6 * sst(0.4, 0.7, s1)) * (1 - sst(0.75, 1, u)) * sst(0, 0.12, u)); }, { tw: 1.6, verso: 0.8 }), '#FFFFFF', null, { e: 1.5 }))); });
  K.tor(0, 8, 0, 8.4, 0.2, C.AMB, null, { e: 2.8, ts: ns(K, 36), rs: 5 }); };
})(globalThis.ARD = globalThis.ARD || {});
/* Os três chefões no jogo. Os ids internos e os nomes das receitas não mudam (o src/chefes.js continua escolhendo a variante pela fase):
   arauto = A Medusa da Fenda; sentinela = A Sentinela Devoradora; forja = O Titã-Fornalha. Os modelos 2.0 de cima ficam no arquivo, sem uso
   (o Pilar, a coroa dos Ecos e a marca do ponto fraco continuam os de antes). */
(function (ARD) {
'use strict';
const J = ARD.kch && ARD.kch.jogo; const RX = ARD.meshes && ARD.meshes.receitas; if (!J || !RX) return;
Object.assign(RX, {
  chefe_arauto_1: J.medusa('1'), chefe_arauto_2: J.medusa('2'), chefe_arauto_3: J.medusa('3'), chefe_arauto_j: J.medusa('j'),
  chefe_arauto_1_g: J.medusa('1', { golpe: true }), chefe_arauto_2_g: J.medusa('2', { golpe: true }), chefe_arauto_3_g: J.medusa('3', { golpe: true }),
  chefe_sentinela: J.devoradora(2, false), chefe_sentinela_g: J.devoradora(2, false, { golpe: true }), chefe_sentinela_j: J.devoradora(2, true),
  chefe_forja: J.tita(1, false, { pernas: false, junta: false, boca: 0.2 }), chefe_forja_g: J.tita(1, false, { pernas: false, junta: false, boca: 1, golpe: true }),
  chefe_forja_b: J.tita(1, false, { pernas: false, junta: false, boca: 0.45, linha: true }), chefe_forja_b_g: J.tita(1, false, { pernas: false, junta: false, boca: 1, linha: true, golpe: true }),
  chefe_forja_caida: J.tita(1, true, { pernas: false, estrela: false }),
  chefe_forja_perna: J.tita(1, false, { soPerna: 'pe', junta: false }), chefe_forja_perna_caida: J.tita(1, true, { soPerna: 'caida', junta: false }), chefe_junta: J.titaJunta, chefe_nucleo: J.titaNucleo,
});
/* pontos que o src/chefes.js usa para os efeitos (carga do golpe, fumaça, brasas), nas coordenadas da receita */
ARD.chefesForma.pontos = {
  arauto: { olho: [8.2, 20.4, 0], nucleo: [0, 31, 0] }, sentinela: { olho: [8.6, 23.2, 0], nucleo: [0, 19.4, 0] },
  forja: { tochas: [[38, 10, 3.5], [38, 10, -3.5], [36, 12, 3], [36, 12, -3]], chamines: [[4, 33, 7], [4, 33, -7], [-9, 33, 6], [-9, 33, -6]], boca: [31, 12.5, 0], olhos: [31, 19.5, 0] },
};
ARD.chefesForma.larg = { arauto: 34, sentinela: 22.9, forja: 37 }; /* largura de referência (o src/chefes.js lê) */
/* os lacaios da Fenda com a cara da família (o src/render3d.js troca o modelo só para o jogador da Fenda): a fagulha-filhote do Titã no lugar do
   drone e a cria do vazio (uma medusa pequena que anda nos fios) no lugar da Cria. Mesmos defs, mesma simulação; só o desenho muda */
const B = ARD.kch, { PI, TAU, TH, C, ns, leve, poe, mancha, fio, esculpe, cristal, balanca, mul, mixc, sst } = B;
/* o Pilar, a coroa dos Ecos e a marca do ponto fraco no visual da família (vazio: pele violeta quase preta, Éter e Fenda; âmbar só no ponto fraco) */
RX.chefe_pilar = function (K) { K.base = 0; const T = TH(); const N = ns(K, 12), tr = []; for (let i = 0; i < N; i++) { const u = i / (N - 1); tr.push([Math.sin(u * 5.5) * 1.3 * (1 - u), u * 17, Math.cos(u * 4.3) * 1.1 * (1 - u)]); }
  fio(K, tr, 3.1, 1.5, { c0: C.VID, c1: C.VID2, mat: B.VIDRO, n: ns(K, 10), rf: u => 1 + 0.16 * Math.sin(u * 30) });
  for (let k = 0; k < (leve(K) ? 4 : 7); k++) { const a = k / (leve(K) ? 4 : 7) * TAU + 0.2, ca = Math.cos(a), sa = Math.sin(a); fio(K, [[ca * 2.2, 2.2, sa * 2.2], [ca * 4.4, 1.2, sa * 4.4], [ca * 6.2, 0.5, sa * 6.2], [ca * 7.6, 0.05, sa * 7.6]], 1.2, 0.15, { c0: C.VID2, c1: C.VID, mat: B.VIDRO, n: 5 }); }
  for (let k = 0; k < (leve(K) ? 2 : 4); k++) { const pts = []; for (let i = 0; i <= 8; i++) { const u = i / 8, a = k * PI / 2 + u * 3.2, q = tr[Math.round(u * (N - 1))], rr = (3.1 - 1.6 * u) * 1.03; pts.push([q[0] + Math.cos(a) * rr, q[1], q[2] + Math.sin(a) * rr]); } fio(K, pts, 0.16, 0.08, { c0: C.FEN, c1: C.ETER, e: 1.8, n: 3 }); }
  K.anim({ t: 'bob', amp: 0.35, speed: 1.4 }, () => { const g = new T.SphereGeometry(3.3, ns(K, 18), ns(K, 10), 0, TAU, 0, PI * 0.58); B.degrade(g, C.VID2, C.VID, 1); poe(K, g, '#FFFFFF', B.VIDRO, { y: 19.2, pat: 4 }); poe(K, mancha(new T.SphereGeometry(2.1, ns(K, 16), ns(K, 10)), '#12305A', C.ETER, '#FFFFFF', 2.4, 9), '#FFFFFF', null, { e: 2.0, y: 18.6 });
    for (let k = 0; k < (leve(K) ? 4 : 8); k++) { const a = k / (leve(K) ? 4 : 8) * TAU, ca = Math.cos(a), sa = Math.sin(a); fio(K, [[ca * 3.1, 18.4, sa * 3.1], [ca * 3.8, 16.2, sa * 3.8], [ca * 3.3, 13.6, sa * 3.3]], 0.2, 0.05, { c0: C.VID3, c1: '#3FA9C8', n: 4 }); K.sph(ca * 3.3, 13.6, sa * 3.3, 0.26, C.ETER2, null, { e: 2.2, seg: 6 }); } }); };
RX.chefe_eco = function (K) { K.base = 0; K.anim({ t: 'spin', p: [0, 0, 0], speed: 1.4 }, () => { for (let k = 0; k < 5; k++) { const a = k * TAU / 5, ca = Math.cos(a), sa = Math.sin(a); fio(K, [[ca * 2.3, 0.1, sa * 2.3], [ca * 2.9, 1.1, sa * 2.9], [ca * 2.4, 2.2, sa * 2.4], [ca * 1.5, 2.7, sa * 1.5]], 0.3, 0.06, { c0: C.VID2, c1: C.VID3, mat: B.VIDRO, n: 4 }); K.sph(ca * 1.5, 2.7, sa * 1.5, 0.2, C.FEN2, null, { e: 2.2, seg: 6 }); }
    K.tor(0, 0.3, 0, 2.3, 0.1, C.FEN, null, { e: 1.9, ts: 20, rs: 4 }); K.sph(0, 1.1, 0, 0.6, C.FEN, null, { e: 2.0, seg: 8, sy: 1.4 }); }); };
RX.chefe_marca = function (K) { K.base = 0; /* o olho âmbar do ponto fraco: lente acesa com a fenda escura, girando */ K.anim({ t: 'spin', p: [0, 0, 0], speed: 1.6 }, () => { K.sph(0, 2.2, 0, 1.25, C.AMB, null, { e: 2.6, seg: 12, sx: 0.5, sy: 1.5 }); K.box(0, 1.2, 0, 1.3, 2.0, 0.2, '#2A1000', 'gloss'); K.tor(0, 2.2, 0, 1.9, 0.1, C.AMB2, null, { e: 2.4, ts: 20, rs: 4, rx: PI / 2 }); }); };
RX.chefe_lacaio_drone = function (K) { K.base = 0; const T = TH();
  K.anim({ t: 'bob', amp: 0.12, speed: 3 }, () => { poe(K, mancha(new T.SphereGeometry(0.95, ns(K, 14), ns(K, 10)), '#7A2400', '#FF7A1A', '#FFF1C8', 2.4, 5), '#FFFFFF', null, { e: 1.9, y: 2.6, sx: 1.25 });
    poe(K, esculpe(ns(K, 14), ns(K, 10), 1.9, 1.05, 1.25, (x, y) => (y < -0.1 ? 0.2 : 1) * (1 - 0.3 * Math.max(0, -x)), (x, y) => mul(mixc('#1B2442', '#0A0C18', sst(-0.2, 0.9, y)), 0.8 + 0.4 * Math.abs(Math.sin(x * 9)))), '#FFFFFF', [0.46, 0.05], { y: 2.75, pat: 3 });
    for (const sg of [1, -1]) { cristal(K, [1.2, 2.5, sg * 0.5], [2.9, 2.0, sg * 0.25], 0.2, { n: 4, c0: '#3F383E', c1: '#8A7F70', mat: [0.7, 0.02], pat: 3 }); K.sph(1.35, 2.95, sg * 0.55, 0.16, '#FFC66A', null, { e: 2.4, seg: 6 }); }
    fio(K, [[-1.5, 2.7, 0], [-2.8, 2.9, 0.3], [-4.0, 2.4, -0.3], [-5.0, 2.7, 0]], 0.5, 0.05, { c0: '#1B2442', c1: '#FF6A1A', n: 5 }); });
  for (const sg of [1, -1]) K.anim({ t: 'flap', p: [0, 2.9, sg * 0.9], amp: 0.6, speed: 14, side: sg }, () => { const g = new T.BufferGeometry(); const v = [0.9, 2.9, sg * 0.9, -1.6, 2.9, sg * 0.9, -0.9, 3.2, sg * 4.2, 0.7, 3.1, sg * 3.2]; g.setAttribute('position', new T.Float32BufferAttribute(v, 3)); g.setIndex(sg > 0 ? [0, 2, 1, 0, 3, 2, 0, 1, 2, 0, 2, 3] : [0, 1, 2, 0, 2, 3, 0, 2, 1, 0, 3, 2]); g.computeVertexNormals(); poe(K, g, '#30406A', [0.46, 0.05], { pat: 3, flat: true });
    fio(K, [[0.9, 2.95, sg * 0.9], [0.8, 3.15, sg * 3.2], [-0.9, 3.25, sg * 4.2]], 0.1, 0.04, { c0: '#FFC66A', c1: '#FF6A1A', e: 1.6, n: 3 }); }); };
RX.chefe_lacaio_cria = function (K) { K.base = 0; const T = TH(); const NF = leve(K) ? 5 : 7;
  K.anim({ t: 'bob', amp: 0.14, speed: 2.4 }, () => { const g = new T.SphereGeometry(1.9, ns(K, 16), ns(K, 8), 0, TAU, 0, PI * 0.55); B.degrade(g, C.VID2, C.VID, 1); poe(K, g, '#FFFFFF', B.VIDRO, { y: 3.4, pat: 4 });
    for (let k = 0; k < 4; k++) { const a = k * PI / 2 + 0.4; fio(K, [[Math.cos(a) * 0.3, 5.25, Math.sin(a) * 0.3], [Math.cos(a) * 1.3, 4.6, Math.sin(a) * 1.3], [Math.cos(a) * 1.85, 3.5, Math.sin(a) * 1.85]], 0.09, 0.06, { c0: C.FEN2, c1: C.FEN, e: 1.7, n: 3 }); }
    K.sph(0.7, 3.1, 0, 1.0, '#0E0816', 'gloss', { seg: ns(K, 10) }); K.sph(1.35, 3.0, 0, 0.55, C.FEN, null, { e: 2.4, seg: 8, sx: 0.5 }); K.box(1.62, 2.72, 0, 0.06, 0.56, 0.16, '#05030A', 'gloss'); });
  for (let k = 0; k < NF; k++) { const a = k / NF * TAU + 0.3, ca = Math.cos(a), sa = Math.sin(a); K.anim(Object.assign(balanca(a, [ca * 1.5, 3.2, sa * 1.5], 0.22, 5 + (k % 3), k * 1.7)), () => { fio(K, [[ca * 1.5, 3.2, sa * 1.5], [ca * 2.3, 2.2, sa * 2.3], [ca * 2.0, 1.0, sa * 2.0], [ca * 2.6, 0.05, sa * 2.6]], 0.22, 0.05, { c0: C.VID3, c1: '#3FA9C8', n: 4 }); cristal(K, [ca * 2.55, 0.25, sa * 2.55], [ca * 3.3, 0.02, sa * 3.3], 0.1, { n: 4, c0: C.VID3, c1: C.ETER2, e: 1.4 }); }); } };
ARD.chefesForma.lacaio = { drone: 'chefe_lacaio_drone', cria: 'chefe_lacaio_cria' };
ARD.chefesModelos = Object.keys(RX).filter(k => k.startsWith('chefe_'));
})(globalThis.ARD = globalThis.ARD || {});
/* ==== 5.0h.5 Chefões 3.0: FIM do bloco gerado ==== */
