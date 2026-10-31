/* Aether Rift: Dominion — Motor 5 (5.0d): nuvens de guerra volumétricas em TSL (WebGPU e a reserva WebGL2 do WebGPURenderer).
   O que nunca foi visto fica sob nuvens baixas e densas, que se abrem com uma borda acesa quando as tropas chegam; o que já foi visto e não está
   à vista fica com o véu de hoje (o chão escurecido pela névoa de guerra, src/m5/terreno.js). A fonte é a textura da névoa de guerra que o render3d
   já refaz no passo da simulação (ARD.m5.tex.nevoa, R: 0 nunca visto, 110 explorado, 255 à vista): nada novo na simulação, só visual.
   - Memória (um passe de 192² por quadro, ida e volta entre dois alvos de meia precisão): R a cobertura (a névoa borrada e recuada da área vista;
     abre em ~1 s e fecha na hora), G a energia da abertura (a borda acesa), B a altura do chão suavizada e A o alvo do quadro (o chão do pixel já
     foi visto?). Buraco por cima do abismo da Fenda; no Cinturão, só sobre as plataformas.
   - Alta e Ultra: marcha de raio em meia resolução, do olho até o chão do passe da cena (a profundidade), pulando o ar acima do topo das nuvens
     (o topo é um campo de alturas), com saída cedo na nuvem densa e onde o chão do pixel já foi visto; reconstrução na resolução cheia pela
     profundidade (nas bordas, a amostra mais próxima em profundidade: sem halo nas unidades). A Ultra tem mais passos, a sombra do sol no próprio
     ruído e mais detalhe.
   - Média: uma camada só, sem marcha (a nuvem no plano do topo, com a cobertura do chão do pixel), no passe da bruma.
   - Baixa e celular: nada (a névoa pintada no chão, como hoje).
   Leitura de jogo: a nuvem some no trecho final do raio quando o chão do pixel já foi visto (nada à vista fica coberto), e o recuo da cobertura
   deixa a parede das nuvens um pouco além do limite da visão.
   Carga: tudo nasce com o pós (no aquecimento); o ruído 3D (32³) sai da CPU em fatias fora da carga e a altura do chão (128²) uma vez por partida;
   nenhuma alocação por quadro.
   Chaves: ?m5nuvens=0 desliga; ?m5nuvens=camada (a versão da Média em qualquer qualidade); ?m5nuvens=marcha (a completa da Alta, também na
   Média); ?m5nuvensres=1|2|4 (escala da marcha, medida). */
(function (ARD) {
'use strict';
const M5 = ARD.m5 = ARD.m5 || {};
const Q = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
const NV = M5.nuvens = M5.nuvens || {};
NV.versao = '5.0d';
const PED = Q.get('m5nuvens'); const DBGN = +(Q.get('m5nuvensdbg') || 0); const TESTE = Q.get('m5nuvensteste') || ''; /* 5.0d.1: simula a falha para provar as defesas: 'marcha' (a marcha não desenha, como no Firefox da 5.0d) ou 'memoria' (a memória presa em "nunca visto" em todo o mapa) */ const RES = Math.max(1, Math.min(4, +(Q.get('m5nuvensres') || 2) | 0));
const toque = () => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
/* versão pela qualidade: null (nada), 'camada' (Média), 'alta', 'ultra' */
const FIREFOX = typeof navigator !== 'undefined' && /firefox/i.test(navigator.userAgent || ''); /* 5.0d.1 */
NV.modo = function (q) {
  if (PED === '0' || !q) return null; const r = q.resolved || q.name;
  if (PED === 'camada') return 'camada'; if (PED === 'marcha') return r === 'ultra' ? 'ultra' : 'alta';
  if (toque()) return null; /* celular (em pé e deitado): a névoa pintada no chão, como hoje */
  if (FIREFOX && (r === 'alta' || r === 'ultra')) return 'camada'; /* 5.0d.1: no Firefox (no limite da CPU) a camada também na Alta e na Ultra: um passe a menos; ?m5nuvens=marcha força a marcha */
  return r === 'ultra' ? 'ultra' : r === 'alta' ? 'alta' : r === 'media' ? 'camada' : null;
};
/* 5.0d.1: o véu leve — opacidade máxima no meio do nunca visto (de dia e de noite) e quanto a borda acesa soma */
const VEU = { dia: +(Q.get('m5nuvensveu') || 0.5), noite: 0.32, borda: 0.5 };
/* parâmetros da forma (unidades do mapa): topo, extinção, passos */
const CFG = { camada: { topo: 58 }, alta: { topo: 92, passos: 26, passo: 15, sombra: false, detalhe: false }, ultra: { topo: 96, passos: 40, passo: 10, sombra: true, detalhe: true } };
const MEM = 192; /* lado da memória (texels): ~17 unidades por texel no mapa de 3200 */

/* ---------- ruído 3D repetível (32³, RGBA8), gerado na CPU uma vez: R grumos grandes (Perlin-Worley), G vagas (Worley em 3 oitavas), B detalhe ---------- */
function ruido3D(N, d) { /* gerador em fatias: passo(z0, z1) calcula as camadas z0..z1−1; fim() normaliza em d (RGBA8) */
  const hs = (x, y, z, s) => { let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1274126177) ^ Math.imul(s, 1442695041); h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
  const md = (a, P) => ((a % P) + P) % P; const sm = t => t * t * (3 - 2 * t); const li = (a, b, t) => a + (b - a) * t;
  /* tabelas por período (os mesmos valores do hash, calculados uma vez: ~5× mais rápido que o hash em cada amostra) */
  const tab = (P, s, k) => { const t = new Float32Array(P * P * P * k); for (let z = 0, i = 0; z < P; z++) for (let y = 0; y < P; y++) for (let x = 0; x < P; x++, i++) for (let c = 0; c < k; c++) t[i * k + c] = hs(x, y, z, s + (c === 0 ? 0 : c === 1 ? 7 : 13)); return t; };
  const V4 = tab(4, 1, 1), V8 = tab(8, 2, 1), V16 = tab(16, 3, 1), V16b = tab(16, 21, 1), W4 = tab(4, 11, 3), W8 = tab(8, 12, 3), W16 = tab(16, 13, 3);
  const vn = (x, y, z, P, T) => { const I = (a, b, c) => T[(c * P + b) * P + a]; const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), fx = sm(x - xi), fy = sm(y - yi), fz = sm(z - zi); const x0 = md(xi, P), x1 = md(xi + 1, P), y0 = md(yi, P), y1 = md(yi + 1, P), z0 = md(zi, P), z1 = md(zi + 1, P);
    return li(li(li(I(x0, y0, z0), I(x1, y0, z0), fx), li(I(x0, y1, z0), I(x1, y1, z0), fx), fy), li(li(I(x0, y0, z1), I(x1, y0, z1), fx), li(I(x0, y1, z1), I(x1, y1, z1), fx), fy), fz); };
  const wo = (x, y, z, P, T) => { const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z); let b = 9;
    for (let dz = -1; dz <= 1; dz++) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const cx = xi + dx, cy = yi + dy, cz = zi + dz, j = ((md(cz, P) * P + md(cy, P)) * P + md(cx, P)) * 3;
      const px = cx + T[j] - x, py = cy + T[j + 1] - y, pz = cz + T[j + 2] - z; const d = px * px + py * py + pz * pz; if (d < b) b = d; }
    return Math.min(1, Math.sqrt(b)); };
  const n = N * N * N, A = new Float32Array(n * 3); const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9]; const c = [0, 0, 0];
  const passo = (z0, z1) => { for (let z = z0, i = z0 * N * N; z < z1; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++, i++) { const u = x / N, v = y / N, w = z / N;
    const fb = vn(u * 4, v * 4, w * 4, 4, V4) * 0.5 + vn(u * 8, v * 8, w * 8, 8, V8) * 0.3 + vn(u * 16, v * 16, w * 16, 16, V16) * 0.2;
    const w4 = 1 - wo(u * 4, v * 4, w * 4, 4, W4), w8 = 1 - wo(u * 8, v * 8, w * 8, 8, W8), w16 = 1 - wo(u * 16, v * 16, w * 16, 16, W16);
    c[0] = fb * 0.55 + w4 * 0.6; c[1] = w4 * 0.55 + w8 * 0.3 + w16 * 0.15; c[2] = vn(u * 16, v * 16, w * 16, 16, V16b) * 0.6 + w16 * 0.4;
    for (let k = 0; k < 3; k++) { A[i * 3 + k] = c[k]; if (c[k] < lo[k]) lo[k] = c[k]; if (c[k] > hi[k]) hi[k] = c[k]; } } };
  const fim = () => { for (let i = 0; i < n; i++) { for (let k = 0; k < 3; k++) d[i * 4 + k] = Math.round(255 * (A[i * 3 + k] - lo[k]) / Math.max(1e-6, hi[k] - lo[k])); d[i * 4 + 3] = 255; } };
  return { passo, fim };
}

/* ---------- recursos divididos (por renderizador): ruído, alturas, memória e o passe que a atualiza ---------- */
let SH = null;
function divididos() {
  const X = M5.cur; if (SH && SH.X === X) return SH; const Tm = window.THREE_M5, L = window.TSL;
  const { Fn, uniform, texture, texture3D, uv, vec2, vec4, float, smoothstep, mix, max, min, clamp, exp, length, select, step } = L;
  const t0 = performance.now();
  const N3 = 32, d3 = new Uint8Array(N3 * N3 * N3 * 4).fill(128), t3 = new Tm.Data3DTexture(d3, N3, N3, N3); /* nasce cinza (a forma sem grumos) e o ruído chega em fatias, fora da carga */ t3.format = Tm.RGBAFormat; t3.type = Tm.UnsignedByteType; t3.wrapS = t3.wrapT = t3.wrapR = Tm.RepeatWrapping; t3.minFilter = t3.magFilter = Tm.LinearFilter; t3.generateMipmaps = false; t3.unpackAlignment = 1; t3.colorSpace = Tm.NoColorSpace; t3.name = 'ard-nuvens-ruido'; t3.needsUpdate = true;
  const NA = 128, altD = new Uint8Array(NA * NA * 4).fill(0); const alt = new Tm.DataTexture(altD, NA, NA, Tm.RGBAFormat); alt.magFilter = alt.minFilter = Tm.LinearFilter; alt.colorSpace = Tm.NoColorSpace; alt.name = 'ard-nuvens-alturas'; alt.needsUpdate = true;
  const mk = nome => { const rt = new Tm.RenderTarget(MEM, MEM, { type: Tm.HalfFloatType, depthBuffer: false, generateMipmaps: false, minFilter: Tm.LinearFilter, magFilter: Tm.LinearFilter }); rt.texture.name = nome; return rt; };
  const S = SH = { X, t3, alt, altD, NA, rts: [mk('ard-nuvens-mem-a'), mk('ard-nuvens-mem-b')], i: 0, quadro: -1, sim: null, tAnt: null, temNuvem: true, calma: 0, fogV: -1, geraMs: 0 };
  S.U = { teste: uniform(TESTE === 'memoria' ? 1 : 0), dt: uniform(0), reset: uniform(1), alt: uniform(new Tm.Vector2(0, 1)), fenda: uniform(new Tm.Vector4(0, 0, 1, 0)), vazio: uniform(0), celula: uniform(1 / 100), liga: uniform(1) };
  S.ruido = texture3D(t3); S.memAnt = texture(S.rts[1].texture); S.mem = texture(S.rts[0].texture); /* a anterior (lida pelo passe) e a última escrita (lida pela marcha e pela composição): nós comuns do TSL; o .sample().level() de um nó de passe (PassTextureNode) perde o uv no r186 */
  /* memória: cobertura alvo pela névoa (borrada e recuada), abre devagar e fecha na hora; energia da abertura; altura do chão; alvo do quadro */
  const U = S.U, nev = M5.tex.nevoa, vaz = M5.tex.vazio, alT = texture(alt);
  const mat = new Tm.NodeMaterial(); mat.name = 'ard-nuvens-memoria'; mat.depthTest = false; mat.depthWrite = false; mat.blending = Tm.NoBlending; /* o alfa é dado (o alvo), não mistura */
  mat.fragmentNode = Fn(() => { const u = uv().toVar(); const r = U.celula;
    const vi = (dx, dy) => smoothstep(0.16, 0.4, nev.sample(u.add(vec2(dx, dy).mul(r))).level(0).r); /* 1 = já visto (explorado ou à vista) */
    /* média em dois anéis (raio 1,2 e 2,4 células de névoa): a borda da cobertura vira uma rampa de ~3 células, sem os degraus dos ladrilhos */
    const anel = k => vi(k, 0).add(vi(-k, 0)).add(vi(0, k)).add(vi(0, -k)).add(vi(k * 0.71, k * 0.71)).add(vi(-k * 0.71, k * 0.71)).add(vi(k * 0.71, -k * 0.71)).add(vi(-k * 0.71, -k * 0.71));
    const visto = vi(0, 0).mul(0.16).add(anel(1.2).mul(0.065)).add(anel(2.4).mul(0.04));
    const p = u.mul(M5.u.mundo); const f = U.fenda;
    const alvo = float(1).sub(smoothstep(0.05, 0.55, visto)).mul(mix(float(1), smoothstep(f.z.mul(0.95), f.z.mul(1.5), length(p.sub(f.xy))), f.w)) /* buraco por cima do abismo da Fenda */
      .mul(mix(float(1), smoothstep(26.0, 62.0, vaz.sample(u).level(0).r.sub(0.5).mul(128.0)), U.vazio)).toVar(); /* Cinturão: só sobre as plataformas, afinando antes da beirada (R = distância até o vazio, ±64): nada pendurado sobre o espaço */
    const ant = S.memAnt.sample(u).level(0); const c0 = mix(ant.r, float(1), U.reset), g0 = ant.g.mul(float(1).sub(U.reset));
    const desce = max(c0.sub(alvo).mul(float(1).sub(exp(U.dt.mul(-2.6)))), U.dt.mul(0.4));
    const c1 = select(alvo.greaterThanEqual(c0), alvo, max(alvo, c0.sub(desce))); /* fecha na hora (partida nova), abre em ~1 s */
    const g1 = clamp(g0.mul(exp(U.dt.mul(-1.3))).add(c0.sub(c1).mul(2.6).mul(step(U.dt, 1.0))), 0.0, 1.0); /* assentar (dt grande): sem borda acesa */
    const h = U.alt.x.add(alT.sample(u).level(0).r.mul(U.alt.y.sub(U.alt.x)));
    return select(U.teste.greaterThan(0.5), vec4(1, 0, h, 1), vec4(c1, g1, h, alvo)); })(); /* 5.0d.1: ?m5nuvensteste=memoria */
  M5.registrar('nuvens-memoria', mat); S.mat = mat; S.quad = new Tm.QuadMesh(mat);
  S.geraMs = Math.round(performance.now() - t0);
  /* o ruído 3D em 8 fatias de 4 camadas, uma por tarefa (fora do caminho da carga: ~25 a 60 ms de CPU no total) e um envio só no fim */
  { const g = ruido3D(N3, d3); let z = 0, ms = 0; const fatia = () => { const t1 = performance.now(); g.passo(z, Math.min(N3, z + 4)); z += 4; ms += performance.now() - t1;
      if (z < N3) setTimeout(fatia, 0); else { g.fim(); t3.needsUpdate = true; S.ruidoMs = Math.round(ms); } }; setTimeout(fatia, 0); }
  return S;
}
/* altura do chão suavizada (128², a mesma do R.H do render3d), uma vez por partida; no Cinturão o vazio não puxa a base para baixo */
function assaAlturas(S, R) {
  const Sm = ARD.sim, W = Sm ? Sm.WORLD : 6000, n = S.NA, h = new Float32Array(n * n), h2 = new Float32Array(n * n);
  for (let iy = 0; iy < n; iy++) for (let ix = 0; ix < n; ix++) { let v = R.H((ix + 0.5) * W / n, (iy + 0.5) * W / n); if (R.cinturao) v = Math.max(v, -40); h[iy * n + ix] = v; }
  for (let k = 0; k < 2; k++) { /* duas caixas de raio 2 (separáveis): ~60 unidades de raio */
    for (let iy = 0; iy < n; iy++) for (let ix = 0; ix < n; ix++) { let s = 0, c = 0; for (let d = -2; d <= 2; d++) { const x = ix + d; if (x < 0 || x >= n) continue; s += h[iy * n + x]; c++; } h2[iy * n + ix] = s / c; }
    for (let iy = 0; iy < n; iy++) for (let ix = 0; ix < n; ix++) { let s = 0, c = 0; for (let d = -2; d <= 2; d++) { const y = iy + d; if (y < 0 || y >= n) continue; s += h2[y * n + ix]; c++; } h[iy * n + ix] = s / c; } }
  let lo = 1e9, hi = -1e9; for (let i = 0; i < n * n; i++) { if (h[i] < lo) lo = h[i]; if (h[i] > hi) hi = h[i]; } hi = Math.max(hi, lo + 1);
  for (let i = 0; i < n * n; i++) { const v = Math.round(255 * (h[i] - lo) / (hi - lo)); S.altD[i * 4] = v; S.altD[i * 4 + 3] = 255; }
  S.alt.needsUpdate = true; S.U.alt.value.set(lo, hi); S.hLo = lo; S.hHi = hi;
  S.U.fenda.value.set(Sm ? Sm.CX : W / 2, Sm ? Sm.CY : W / 2, Sm && Sm.RIFT_R ? Sm.RIFT_R : 170, R.cinturao ? 0 : 1); S.U.vazio.value = R.cinturao ? 1 : 0;
  if (Sm && Sm.WORLD) S.U.celula.value = 1 / 100; /* FOGN do render3d: 100 células de névoa por lado */
}
/* há nuvem na partida? (alguma célula nunca vista na névoa, ou a memória ainda abrindo): sem nuvem, os passes param e a composição não lê nada */
function temNevoa(S) { const tx = M5.tex.nevoa && M5.tex.nevoa.value; const d = tx && tx.image && tx.image.data; if (!d) return true; if (tx.version === S.fogV) return S.nevoaNunca; S.fogV = tx.version;
  let nunca = false; for (let i = 0; i < d.length; i += 4) if (d[i] < 100) { nunca = true; break; } S.nevoaNunca = nunca; return nunca; }
/* uma vez por quadro (o primeiro nó de nuvens do quadro): alturas da partida, dt pelo relógio do visual e o passe da memória */
/* 5.0d.1: à prova de falha — um passe das nuvens com erro do WebGPU, ou a memória que não abre onde o jogador já vê, desligam as nuvens sozinhas
   (o chão volta a ser o de hoje); o motivo fica em ARD.m5.nuvens.estado().falha e no console */
function falhou(S, motivo) { if (S.falha) return; S.falha = motivo; S.temNuvem = false; S.U.liga.value = 0; console.warn('[ARD] Motor 5: nuvens de guerra desligadas (' + motivo + ')'); }
function escopo(S, r) { const dev = r.backend && r.backend.device; if (!dev || typeof dev.pushErrorScope !== 'function' || (S.escopos | 0) >= 6) return null; S.escopos = (S.escopos | 0) + 1; dev.pushErrorScope('validation'); return dev; } /* os primeiros quadros dos passes dentro de um escopo de erro */
function fechaEscopo(S, dev) { if (dev) dev.popErrorScope().then(e => { if (e) falhou(S, 'erro do WebGPU: ' + String(e.message || e).slice(0, 200)); }, () => {}); }
const meia = v => { const s = (v & 0x8000) ? -1 : 1, e = (v >> 10) & 0x1f, f = v & 0x3ff; return e === 0 ? s * f * Math.pow(2, -24) : e === 31 ? NaN : s * (1 + f / 1024) * Math.pow(2, e - 15); }; /* meia precisão → número */
function autoteste(S, r, R) { /* aos 5 e aos 15 s da partida: a cobertura da memória no Núcleo (à vista desde o começo) tem de estar perto de 0 */
  if (S.falha || (S.testes | 0) >= 2 || !S.temNuvem || typeof r.readRenderTargetPixelsAsync !== 'function' || S.testando) return;
  if (R.time - (S.tReset || 0) < ((S.testes | 0) === 0 ? 5 : 15)) return; S.testes = (S.testes | 0) + 1;
  const Sm = ARD.sim, sim = R.sim, n = Sm && Sm.nucleoOf && sim ? Sm.nucleoOf(sim, R.humanId || 0) : null; if (!n) return;
  const W = Sm.WORLD, fog = M5.tex.nevoa.value && M5.tex.nevoa.value.image && M5.tex.nevoa.value.image.data; const fi = (Math.min(99, (n.y / W * 100) | 0) * 100 + Math.min(99, (n.x / W * 100) | 0)) * 4; if (!fog || fog[fi] < 110) return; /* o Núcleo não está à vista: sem prova */
  const x = Math.min(MEM - 1, (n.x / W * MEM) | 0), y = Math.min(MEM - 1, (n.y / W * MEM) | 0), rt = S.rts[S.i]; S.testando = true;
  const le = px => (px instanceof Uint16Array ? meia(px[0]) : px[0]); /* lê os dois texels (o y do WebGL2 é de baixo para cima): o menor é o do Núcleo */
  Promise.all([r.readRenderTargetPixelsAsync(rt, x, y, 1, 1), r.readRenderTargetPixelsAsync(rt, x, MEM - 1 - y, 1, 1)]).then(([a, b]) => { S.testando = false; const c = Math.min(le(a), le(b)); S.prova = Math.round(c * 1000) / 1000; if (!(c < 0.5)) falhou(S, 'a memória não abre no Núcleo (cobertura ' + (isFinite(c) ? c.toFixed(2) : String(c)) + ')'); }, () => { S.testando = false; }); }
function memoriaQuadro(S, r, frameId) {
  if (S.quadro === frameId) return; S.quadro = frameId; const R = S.X && S.X.R; if (!R) return;
  if (S.falha) return; /* 5.0d.1 */
  { const E = S.X.errors; if (E && E.length !== (S.nErr | 0)) { for (let i = S.nErr | 0; i < E.length; i++) if (/nuvens/.test(E[i])) { falhou(S, String(E[i]).slice(0, 200)); break; } S.nErr = E.length; if (S.falha) return; } } /* 5.0d.1: erro do WebGPU num pipeline das nuvens */
  if (R.sim && R.sim !== S.sim && R.H) { S.sim = R.sim; assaAlturas(S, R); S.U.reset.value = 1; S.calma = 0; S.tAnt = R.time; S.tReset = R.time; S.testes = 0; }
  const dt = S.tAnt == null ? 0 : Math.max(0, Math.min(0.25, R.time - S.tAnt)); S.tAnt = R.time; S.U.dt.value = S.assenta ? 30 : dt; S.assenta = false; /* assenta: a memória vai direto ao alvo (fotos e testes) */
  const nv = temNevoa(S); if (nv) S.calma = 0; else S.calma += dt;
  S.temNuvem = !!R.warming || S.U.reset.value > 0 || nv || S.calma < 2.5; S.U.liga.value = S.temNuvem ? 1 : 0;
  if (!S.temNuvem) return;
  const a = S.rts[S.i], b = S.rts[1 - S.i]; S.memAnt.value = a.texture; r.setRenderTarget(b); S.quad.render(r); S.U.reset.value = 0; S.i = 1 - S.i; S.mem.value = b.texture; /* a ida e volta: lê a (a última), escreve b; S.i aponta a última escrita */
  autoteste(S, r, R); /* 5.0d.1 */
}

/* ---------- o nó do pós (um por cadeia: a partida e o Modo Foto) ---------- */
let NodeC = null;
function classe() {
  if (NodeC) return NodeC; const Tm = window.THREE_M5, L = window.TSL;
  const { uniform, texture, context } = L; const quad = new Tm.QuadMesh(); const tam = new Tm.Vector2(); let estado;
  NodeC = class ArdNuvensNode extends Tm.TempNode {
    static get type() { return 'ArdNuvensNode'; }
    constructor(cor, depth, sp, camera, modo) { /* nomes de campo fora das letras de componente (xyzw, rgba, stpq): o r186 lê "rt" e "sp" como troca de componentes */ super('vec4'); this.cor = cor; this.depth = depth; this.profT = texture(sp.getTexture('depth')); /* a profundidade da cena num nó comum (amostras com nível na composição) */ this.passe = sp; this.camera = camera; this.modo = modo; this.cfg = CFG[modo]; this.S = divididos();
      this.U = { projInv: uniform(new Tm.Matrix4()), camMundo: uniform(new Tm.Matrix4()), camPos: uniform(new Tm.Vector3()), pertoLonge: uniform(new Tm.Vector2(30, 11000)), tamF: uniform(new Tm.Vector2(1, 1)), tamB: uniform(new Tm.Vector2(1, 1)), faixa: uniform(new Tm.Vector4(-50, 150, 0, 0)), vento: uniform(new Tm.Vector4(0, 0, 0, 0)), alvoY: uniform(0) /* 5.0d.1: altura do chão no alvo da câmera (a proteção sem profundidade) */ };
      this.alvoB = this.cfg.passos ? new Tm.RenderTarget(1, 1, { type: Tm.HalfFloatType, depthBuffer: false, generateMipmaps: false, minFilter: Tm.LinearFilter, magFilter: Tm.LinearFilter }) : null; if (this.alvoB) this.alvoB.texture.name = 'ard-nuvens-marcha';
      this.saida = this.alvoB ? texture(this.alvoB.texture) : null; this._m = null;
      this.updateBeforeType = Tm.NodeUpdateType.FRAME; sp.addEventListener('dispose', () => this.dispose()); /* o pós refeito (troca de qualidade): o alvo da marcha vai junto com o passe da cena */ }
    updateBefore(frame) { const r = frame.renderer, S = this.S, U = this.U, cam = this.camera, R = S.X && S.X.R;
      estado = Tm.RendererUtils.resetRendererState(r, estado); const dev = S.falha ? null : escopo(S, r); /* 5.0d.1 */
      memoriaQuadro(S, r, frame.frameId); U.alvoY.value = R && R.camTy != null ? R.camTy : 0;
      U.projInv.value.copy(cam.projectionMatrixInverse); U.camMundo.value.copy(cam.matrixWorld); U.camPos.value.setFromMatrixPosition(cam.matrixWorld); U.pertoLonge.value.set(cam.near, cam.far);
      const rtF = this.passe && this.passe.renderTarget; if (rtF && rtF.width > 1) U.tamF.value.set(rtF.width, rtF.height); else { r.getDrawingBufferSize(tam); U.tamF.value.set(tam.x, tam.y); }
      const tq = R ? R.time : 0; U.vento.value.set(tq * 0.0021, tq * 0.0009, tq * 0.0015, tq);
      U.faixa.value.set((S.hLo != null ? S.hLo : -50) - 12, (S.hHi != null ? S.hHi : 100) + (this.cfg.topo || 90) + 8, 0, 0);
      if (this.alvoB && S.temNuvem) { const bw = Math.max(1, Math.ceil(U.tamF.value.x / RES)), bh = Math.max(1, Math.ceil(U.tamF.value.y / RES)); U.tamB.value.set(bw, bh); this.alvoB.setSize(bw, bh);
        r.setClearColor(0x000000, 0); r.setRenderTarget(this.alvoB); if (TESTE === 'marcha') r.clear(true, false, false); else { quad.material = this._m; quad.render(r); } } /* ?m5nuvensteste=marcha: só a limpeza */ /* 5.0d.1: limpa transparente (o resetRendererState limpa preto e opaco: um passe que não desenha cobria a tela de preto) */
      fechaEscopo(S, dev); Tm.RendererUtils.restoreRendererState(r, estado); }
    setup(builder) { const ctx = context(builder.getSharedContext());
      if (this.cfg.passos && !this._m) { const m = new Tm.NodeMaterial(); m.contextNode = ctx; m.depthTest = false; m.depthWrite = false; m.blending = Tm.NoBlending; m.fragmentNode = marcha(this); M5.registrar('nuvens-marcha-' + this.modo, m); this._m = m; }
      return this.modo === 'camada' ? compoeCamada(this) : compoeMarcha(this); } /* a composição é a saída do nó (o nó entra no grafo do passe da bruma e o updateBefore roda) */
    dispose() { if (this._fim) return; this._fim = true; super.dispose(); if (this.alvoB) this.alvoB.dispose(); if (this._m) this._m.dispose(); }
  };
  return NodeC;
}

/* ---------- forma e luz (as mesmas contas na marcha e na camada) ---------- */
const mapUV = p => { const { vec2 } = window.TSL; return vec2(p.x.div(M5.u.mundo), p.z.negate().div(M5.u.mundo)); };
/* 1 dentro do mapa, 0 fora (as mesas do horizonte não têm névoa de guerra; a amostra fora do [0, 1] pegaria a borda da memória) */
const dentro = uv => { const { min, smoothstep, float } = window.TSL; return smoothstep(-0.004, 0.0, min(min(uv.x, uv.y), min(float(1).sub(uv.x), float(1).sub(uv.y)))); };
/* o ruído 3D girado (as fatias de 32³ não ficam na horizontal: sem faixas na parede do banco, que o limiar da densidade marcaria) */
const gira = p => { const { vec3, dot } = window.TSL; return vec3(dot(p, vec3(0.8, 0.36, -0.48)), dot(p, vec3(-0.6, 0.48, -0.64)), dot(p, vec3(0, 0.8, 0.6))); };
/* cor de uma amostra da nuvem: sol com a profundidade até o topo (Beer), céu em cima, a tinta do clima e a borda acesa (cobertura no meio e energia da abertura) */
function luz(o) { const L = window.TSL; const { float, vec3, mix, max, pow, exp, dot, smoothstep } = L; const U = M5.u;
  /* 5.0d.1: as entradas viram variáveis f32: no Firefox (Naga) uma conta só de literais dentro de exp() ou mix() fica "abstrata" fora de
     expressão constante e o shader inteiro é recusado (a marcha não desenhava e o alvo dela ficava preto e opaco) */
  const hR = float(o.hR).toVar(), prof = float(o.prof).toVar(), vaga = float(o.vaga).toVar(), C = float(o.C).toVar(), G = float(o.G).toVar();
  const kN = U.noite; const solI = float(1.25).mul(kN.oneMinus()).add(kN.mul(0.3));
  const sunT = exp(prof.negate()).mul(o.sombra || float(1)).mul(mix(0.6, 1.12, vaga)); const ph = pow(max(dot(o.rd, U.solDir), 0.0), 6.0).mul(0.55).add(0.8); /* vaga: o alto das vagas pega mais sol que o vale entre elas */
  const alb = mix(vec3(0.8, 0.815, 0.85), U.clima.rgb, U.clima.a.mul(0.3)); /* 5.0d.1: mais clara */
  const c = alb.mul(U.solCor.mul(solI).mul(sunT).mul(ph).add(U.ceuCor.mul(mix(0.35, 0.9, hR)).mul(0.8)))
    .add(vec3(0.1, 0.12, 0.17).mul(kN)); /* 5.0d.1: à noite um véu claro de luar (a composição nunca escurece o chão) */
  const borda = smoothstep(0.02, 0.4, C).mul(float(1).sub(smoothstep(0.4, 0.95, C))); /* faixa larga e macia (sem riscos na parede do banco) */
  const corB = mix(vec3(1.0, 0.62, 0.26), vec3(0.62, 0.4, 1.3), kN); /* dourado de dia, éter à noite */
  return c.add(corB.mul(borda.mul(kN.mul(0.55).add(0.28)).add(G.mul(2.2))).mul(float(1).sub(hR.mul(0.5))).mul(VEU.borda)); } /* 5.0d.1: borda acesa mais sutil */

/* ---------- Alta e Ultra: a marcha de raio (passe em meia resolução) ---------- */
function marcha(nd) {
  const L = window.TSL; const { Fn, If, Loop, Break, float, int, uint, uvec2, vec2, vec3, vec4, floor, max, min, clamp, mix, smoothstep, exp, sqrt, length, select, uv, getViewPosition, screenCoordinate } = L;
  const U = nd.U, S = nd.S, cfg = nd.cfg, mem = S.mem, R3 = S.ruido, dep = nd.depth; /* dep: o nó do passe da cena (a marcha desenha dentro do updateBefore: amostrar o passe garante a cena do quadro antes) */
  const S1 = 1 / 430, S2 = 1 / 140, S3 = 1 / 52, H = cfg.topo, PASSO = cfg.passo, SIG = 0.075, DEF = 80;
  return Fn(() => {
    const jL = floor(uv().mul(U.tamB)); const uvF = jL.mul(RES).add(0.5).div(U.tamF).toVar(); /* o pixel cheio cuja profundidade este texel usa (a composição relê o mesmo) */
    const dz = dep.sample(uvF).r.toVar();
    const vp = getViewPosition(uvF, dz, U.projInv); const wp = U.camMundo.mul(vec4(vp, 1)).xyz.toVar(); const co = U.camPos;
    const dv = wp.sub(co); const tE0 = length(dv); const rd = dv.div(max(tE0, 0.001)).toVar(); const ceu = dz.greaterThanEqual(0.99999);
    const tEnd = select(ceu, float(1e5), tE0).toVar();
    const ry = min(rd.y, -0.004).toVar(); const hor = sqrt(max(float(1).sub(rd.y.mul(rd.y)), 0.0)).toVar();
    const t0 = max(float(0), U.faixa.y.sub(co.y).div(ry)).toVar(); const t1 = min(tEnd, U.faixa.x.sub(co.y).div(ry)).toVar();
    const mE = mem.sample(mapUV(wp)).level(0); const vistoE = float(1).sub(smoothstep(0.08, 0.5, mE.a)).mul(select(ceu, float(0), float(1))).toVar(); /* 1: o chão do pixel já foi visto */
    t1.assign(select(vistoE.greaterThan(0.5), min(t1, tEnd.sub(100.0)), t1)); /* chão já visto: a nuvem some no trecho final do raio (nem marcha) */
    const T = float(1).toVar(), cor = vec3(0).toVar();
    const ui = uvec2(screenCoordinate.xy); const hs = ui.x.mul(uint(1973)).add(ui.y.mul(uint(9277))).toVar(); hs.assign(hs.shiftLeft(uint(13)).bitXor(hs)); hs.assign(hs.mul(hs.mul(hs).mul(uint(15731)).add(uint(789221))).add(uint(1376312589)));
    const jit = float(hs.bitAnd(uint(0xffff))).div(65536).toVar(); const t = t0.add(jit.mul(PASSO * 0.6)).toVar(); /* tremor branco por pixel (o mesmo hash da tempestade): grão fino em vez de riscos */
    If(rd.y.lessThan(-0.004).and(t1.greaterThan(t0)), () => {
      Loop({ start: int(0), end: int(cfg.passos), type: 'int', condition: '<' }, () => {
        If(t.greaterThanEqual(t1).or(T.lessThan(0.02)), () => { Break(); });
        const p = co.add(rd.mul(t)).toVar(); const pg = gira(p).toVar(); const nw = R3.sample(pg.mul(S1).add(U.vento.xyz)).level(0).toVar(); const n1 = nw.r;
        const um = mapUV(p.add(vec3(nw.b.sub(0.5), 0.0, nw.g.sub(0.5)).mul(DEF))).toVar(); const m = mem.sample(um).level(0).toVar(); /* contorno deformado pelo ruído: a borda vira bolhas, não o desenho dos ladrilhos */
        const Cs = smoothstep(0.02, 0.85, m.r).mul(dentro(um)).toVar();
        const base = m.b.sub(8.0).toVar(); const topo = base.add(Cs.mul(n1.mul(0.58).add(0.42)).mul(H)).toVar(); const dy = p.y.sub(topo).toVar();
        If(dy.greaterThan(0.0), () => { t.addAssign(max(dy.div(ry.negate().add(hor.mul(mix(1.2, 0.45, Cs)))), max(t.mul(0.012), PASSO * 0.6))); }) /* acima do topo: pula o ar (o topo sobe no máximo ~1,2 por unidade na borda e ~0,45 no meio do banco); longe, passos maiores */
          .Else(() => {
            If(p.y.lessThan(base), () => { Break(); }); /* abaixo da base: acabou */
            const hR = p.y.sub(base).div(max(topo.sub(base), 1.0)).toVar();
            const nv = R3.sample(pg.mul(S2).add(U.vento.yzx.mul(1.7))).level(0).toVar(); let n2 = nv.g;
            if (cfg.detalhe) n2 = n2.mul(0.78).add(R3.sample(pg.mul(S3).sub(U.vento.zxy.mul(2.3))).level(0).b.mul(0.22));
            const n2v = n2.toVar();
            /* núcleo denso embaixo e no meio do banco; as vagas comem mais na borda (cobertura baixa): a borda vira fiapos, não um corte */
            const d = clamp(Cs.sub(hR.mul(hR).mul(0.8)).mul(1.25).sub(n2v.oneMinus().mul(hR.mul(0.35).add(0.45)).mul(Cs.mul(-0.6).add(1.25))), 0.0, 1.0).mul(Cs.mul(0.65).add(0.35)).mul(SIG)
              .mul(mix(float(1), smoothstep(8.0, 130.0, tEnd.sub(t)), vistoE)).toVar(); /* chão do pixel já visto: some perto dele */
            If(d.greaterThan(0.0004), () => {
              let sombra = null; if (cfg.sombra) { const ns = R3.sample(gira(p.add(M5.u.solDir.mul(16.0))).mul(S2).add(U.vento.yzx.mul(1.7))).level(0).g; sombra = clamp(n2v.sub(ns).mul(3.0).add(1.05), 0.45, 1.25); }
              const prof = topo.sub(p.y).div(max(M5.u.solDir.y, 0.25)).mul(SIG * 0.55);
              const c = luz({ rd, hR, C: m.r, G: m.g, prof, sombra, vaga: n2v });
              const a = float(1).sub(exp(d.mul(PASSO).negate()));
              cor.addAssign(c.mul(a).mul(T)); T.mulAssign(a.oneMinus()); });
            t.addAssign(jit.mul(PASSO * 0.4).add(PASSO * 0.8)); }); /* passo com o tremor do pixel: sem faixas na parede do banco */
      });
    });
    /* os passos acabaram longe (vista baixa, raio rasante): o resto do raio vira a camada da Média (o plano do topo), sem buraco escuro no horizonte */
    If(t.lessThan(t1).and(T.greaterThan(0.05)), () => {
      const tL = max(t, mE.b.add(H * 0.62).sub(co.y).div(ry)); const q = co.add(rd.mul(min(tL, tEnd))).toVar(); const nq = R3.sample(q.mul(S1).add(U.vento.xyz)).level(0);
      const uq = mapUV(q); const mq = mem.sample(uq).level(0); const a = smoothstep(0.02, 0.85, mq.r).mul(dentro(uq)).mul(nq.r.mul(0.25).add(0.75)).mul(float(1).sub(vistoE)).toVar();
      cor.addAssign(luz({ rd, hR: float(0.8), C: mq.r, G: mq.g, prof: float(0.3), vaga: nq.g }).mul(a).mul(T)); T.mulAssign(a.oneMinus()); });
    return vec4(cor, T.oneMinus());
  })();
}

/* ---------- composição na resolução cheia (no passe da bruma: depois da oclusão, antes da bruma) ----------
   Alta e Ultra: dos 4 texels da marcha em volta, se as profundidades batem com a do pixel, a bilinear; se não (borda de unidade, de construção,
   do relevo), o texel de profundidade mais próxima (sem halo). Média: a camada. */
/* 5.0d.1: o fim comum das duas composições — à prova de falha e leve:
   - "à vista nunca coberto" sem depender da memória: a névoa de guerra do próprio chão (ARD.m5.tex.nevoa) lida no ponto do chão do pixel (pela
     profundidade) e no ponto em que o raio corta o plano do chão no alvo da câmera (sem a profundidade); onde qualquer um dos dois já foi visto, a
     nuvem zera;
   - opacidade no máximo VEU.dia (0,5) de dia e VEU.noite (0,32) à noite;
   - a nuvem só clareia: o pixel nunca fica mais escuro que o chão debaixo dela (c + a × max(cor − c, 0));
   - ?m5nuvensdbg=1|2|3 sai aqui, nas duas versões (1 posição do chão, 2 memória × névoa, 3 a opacidade final). */
function fim(nd, c, aBruto, cor, dz) {
  const L = window.TSL; const { float, vec2, vec3, vec4, max, min, mix, smoothstep, select, uv, getViewPosition, fract } = L; const U = nd.U, S = nd.S, nev = M5.tex.nevoa;
  const vp = getViewPosition(uv(), dz, U.projInv); const wp = U.camMundo.mul(vec4(vp, 1)).xyz.toVar(); const co = U.camPos; const ceu = dz.greaterThanEqual(0.99999);
  const rd = L.normalize(wp.sub(co)).toVar(); const desce = rd.y.lessThan(-0.004);
  const visE = smoothstep(0.25, 0.42, nev.sample(mapUV(wp)).level(0).r).mul(select(ceu, float(0), float(1)));
  const qP = co.add(rd.mul(max(U.alvoY.sub(co.y).div(min(rd.y, -0.004)), 0.0))); const visP = smoothstep(0.25, 0.42, nev.sample(mapUV(qP)).level(0).r).mul(select(desce, float(1), float(0)));
  const prot = max(visE, visP).toVar();
  const aMax = mix(float(VEU.dia), float(VEU.noite), M5.u.noite);
  const a = L.clamp(aBruto, 0.0, 1.0).mul(aMax).mul(prot.oneMinus()).toVar();
  const DBG = +(Q.get('m5nuvensdbg') || 0);
  if (DBG === 1) return vec4(fract(wp.x.div(100)), fract(wp.z.negate().div(100)), select(ceu, float(1), float(0)), 1);
  if (DBG === 2) { const m = S.mem.sample(mapUV(wp)).level(0); return vec4(m.r, m.a, nev.sample(mapUV(wp)).level(0).r, 1); }
  if (DBG === 3) return vec4(vec3(a.div(max(aMax, 0.01))), 1);
  return vec4(c.rgb.add(max(cor.sub(c.rgb), vec3(0)).mul(a)), c.a);
}
function compoeMarcha(nd) {
  const L = window.TSL; const { Fn, If, float, vec2, vec4, floor, fract, abs, max, min, select, uv, perspectiveDepthToViewZ } = L; const U = nd.U, S = nd.S, c = nd.cor, depth = nd.profT;
  return Fn(() => { const res = vec4(c).toVar();
    If(S.U.liga.greaterThan(DBGN ? -1 : 0.5), () => { /* 5.0d.1: com ?m5nuvensdbg a composição roda sempre (mesmo com as nuvens desligadas por falha) */
      const pF = uv().mul(U.tamF).sub(0.5); const jf = pF.div(RES); const j0 = floor(jf).toVar(); const f = fract(jf).toVar(); const jm = U.tamB.sub(1);
      const lin = d => perspectiveDepthToViewZ(d, U.pertoLonge.x, U.pertoLonge.y).negate();
      const dz = depth.sample(uv()).r.toVar(); const zF = lin(dz).toVar(); /* profundidade sem .level(): na reserva WebGL2 o textureLod de profundidade do r186 sai sem o .x (não compila); o ramo é uniforme */
      const uvD = j => j.mul(RES).add(0.5).div(U.tamF); const j00 = min(j0, jm), j10 = min(j0.add(vec2(1, 0)), jm), j01 = min(j0.add(vec2(0, 1)), jm), j11 = min(j0.add(vec2(1, 1)), jm);
      const e00 = abs(lin(depth.sample(uvD(j00)).r).sub(zF)).toVar(), e10 = abs(lin(depth.sample(uvD(j10)).r).sub(zF)).toVar(), e01 = abs(lin(depth.sample(uvD(j01)).r).sub(zF)).toVar(), e11 = abs(lin(depth.sample(uvD(j11)).r).sub(zF)).toVar();
      const tol = zF.mul(0.035).add(1.5); const ok = max(max(e00, e10), max(e01, e11)).lessThan(tol);
      const jA = select(e00.lessThanEqual(e10), j00, j10), eA = min(e00, e10), jB = select(e01.lessThanEqual(e11), j01, j11), eB = min(e01, e11); const jN = select(eA.lessThanEqual(eB), jA, jB);
      const uvB = select(ok, j0.add(f).add(0.5), jN.add(0.5)).div(U.tamB); /* bilinear entre os centros, ou o centro do mais próximo */
      const n = nd.saida.sample(uvB).level(0).toVar();
      res.assign(fim(nd, c, n.a, n.rgb.div(max(n.a, 0.002)), dz)); }); /* 5.0d.1: a cor média da nuvem (o alvo guarda cor × cobertura) e o fim comum */
    return res; })();
}
function compoeCamada(nd) {
  const L = window.TSL; const { Fn, If, float, vec3, vec4, max, min, clamp, mix, smoothstep, length, select, uv, getViewPosition } = L; const U = nd.U, S = nd.S, mem = S.mem, R3 = S.ruido, H = CFG.camada.topo, c = nd.cor, depth = nd.profT;
  return Fn(() => { const res = vec4(c).toVar();
    If(S.U.liga.greaterThan(DBGN ? -1 : 0.5), () => { /* 5.0d.1: com ?m5nuvensdbg a composição roda sempre (mesmo com as nuvens desligadas por falha) */
      const dz = depth.sample(uv()).r.toVar(); /* sem .level() (idem) */ const vp = getViewPosition(uv(), dz, U.projInv); const wp = U.camMundo.mul(vec4(vp, 1)).xyz.toVar(); const co = U.camPos;
      const dv = wp.sub(co); const tE = length(dv).toVar(); const rd = dv.div(max(tE, 0.001)).toVar(); const ceu = dz.greaterThanEqual(0.99999);
      const uE = mapUV(wp).toVar(); const mE = mem.sample(uE).level(0).toVar(); const ry = min(rd.y, -0.004);
      const tL = clamp(mE.b.add(H).sub(co.y).div(ry), 0.0, select(ceu, float(1e5), tE)); /* o plano do topo sobre o chão do pixel (ou o próprio chão, se o topo ficar atrás) */
      const q = co.add(rd.mul(tL)).toVar(); const nv = R3.sample(gira(q).mul(1 / 300).add(U.vento.xyz)).level(0).toVar();
      const uQ = mapUV(q.add(vec3(nv.b.sub(0.5), 0.0, nv.g.sub(0.5)).mul(70.0))).toVar(); const mQ = mem.sample(uQ).level(0).toVar(); /* contorno deformado pelo ruído */
      const C = max(mQ.r.mul(dentro(uQ)), mE.r.mul(0.92).mul(dentro(uE))).toVar(); const Cs = smoothstep(0.02, 0.85, C);
      const a0 = clamp(Cs.mul(nv.r.mul(0.6).add(0.75)).sub(nv.g.oneMinus().mul(0.45)).sub(0.12).mul(2.4), 0.0, 1.0).mul(Cs);
      const vistoE = float(1).sub(smoothstep(0.08, 0.5, mE.a)).mul(select(ceu, float(0), float(1)));
      const a = a0.mul(vistoE.oneMinus()).mul(select(rd.y.lessThan(-0.004), float(1), float(0))).toVar(); /* chão do pixel já visto: nada de nuvem na frente */
      const col = luz({ rd, hR: nv.r.mul(0.35).add(0.65), C, G: max(mQ.g, mE.g), prof: float(0.12).add(nv.g.oneMinus().mul(0.5)), vaga: nv.g });
      res.assign(fim(nd, c, a, col, dz)); }); /* 5.0d.1: o fim comum (proteção pela névoa do chão, limite e só clarear) */
    return res; })();
}

/* chamada pelo src/m5/pos.js (5.0d): c = cena (com a oclusão), depth = profundidade do passe da cena; devolve a cor com as nuvens (ou c, sem efeito) */
NV.compor = function (c, depth, sp, camera, q) {
  const modo = NV.modo(q); if (!modo || !M5.tex || !M5.tex.nevoa) return c;
  try { const C = classe(); const nd = new C(c, depth, sp, camera, modo); NV.ultimo = nd; NV.modoAtual = modo; return window.TSL.nodeObject(nd); }
  catch (err) { console.warn('[ARD] Motor 5: nuvens de guerra indisponíveis: ' + err.message); return c; }
};
/* o chão nunca visto sob as nuvens (src/m5/terreno.js chama no chão, nos adereços e nas estradas): hoje ×0,06 (quase preto); com as nuvens
   no quadro, no mínimo ×0,4 (a sombra da nuvem, sem o anel preto nas bordas finas). O explorado (×0,46) e o à vista não mudam. O uniform vale 0,4
   só nos quadros em que o nó das nuvens rodou (Baixa, celular ou qualidade trocada: 0, a imagem de hoje) */
let PISO = null;
NV.piso = () => PISO || (PISO = window.TSL.uniform(0).onFrameUpdate(({ frameId }) => (SH && SH.quadro >= 0 && frameId - SH.quadro <= 2 && !SH.falha ? 0.4 : 0))); /* 5.0d.1: com as nuvens desligadas por falha, o chão de hoje */
M5.nevoaChao = fv => { const L = window.TSL; return L.max(L.mix(0.06, 1.0, fv), NV.piso()); };
/* testes e fotos: no próximo quadro a memória vai direto ao alvo (sem a abertura) */
NV.assentar = () => { if (SH) SH.assenta = true; };
/* diagnóstico: o estado da memória e a versão em uso */
NV.estado = () => { const S = SH; return S ? { modo: NV.modoAtual || null, temNuvem: S.temNuvem, calma: +S.calma.toFixed(2), alturas: S.hLo != null ? [Math.round(S.hLo), Math.round(S.hHi)] : null, geraMs: S.geraMs, ruidoMs: S.ruidoMs, res: RES, falha: S.falha || null, prova: S.prova != null ? S.prova : null, firefox: FIREFOX, veu: VEU } : { modo: NV.modoAtual || null }; };
})(globalThis.ARD = globalThis.ARD || {});
