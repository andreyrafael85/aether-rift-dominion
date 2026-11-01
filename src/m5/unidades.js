/* Aether Rift: Dominion — Motor 5 (5.0e, agente e-unid): unidades e materiais 2.0. Só no Motor 5 e só visual: lê o que a simulação já tem
   (vida, vida máxima, patente, dono, o evento promote e a seleção da vista) e só desenha.
   - Aro de seleção em holograma: um desenho só para a seleção, os veteranos, o brilho da promoção, o fantasma da obra e o farol da missão
     (U5.criar → aros, no lugar dos anéis planos selRings e vetRings do src/render3d.js). Borda escura + linha na cor do time + varredura:
     lê no gelo, na neve, na chuva e à noite. Deitado no relevo.
   - Barras de vida em segmentos (cada segmento uma fração fixa da vida máxima), na cor do time, com o dano recente piscando. Desenhadas na
     GPU depois do pós, direto na tela, sem profundidade (nada as escurece: bruma, nuvens de guerra, AO, noite e tons ficam de fora).
   - Contorno do time: borda acesa na cor do time nas unidades, no próprio material dos modelos (sem desenho a mais). A cor vai na cor de
     instância do ARD.m5.Inst (iC.x = tinta, iC.y e iC.z = cor do time em inteiros), lida só pelo material dos modelos (U5.corModelo).
   - Veteranos: divisas douradas em holograma acima da barra, aro dourado com as estrelas da patente (1 a 3) e um brilho rápido na promoção.
   - Materiais 2.0 (ganchos ARD.m5.ganchos.modelo; este arquivo carrega entre o src/m5/modelos.js e o src/m5/clima.js, então a ordem na
     peça é: detalhe de superfície → desgaste, cavidade, sujeira e contato → neve, cinza, areia e molhado do clima):
     desgaste de borda (arestas mais claras e gastas), cavidade (os vãos mais escuros), sujeira pelo chão do mapa embaixo das peças e
     sombra de contato fina na base. As arestas vêm de um atributo por vértice (aDesg, vec3: distância com sinal às arestas vivas do
     triângulo, convexas +, côncavas −), calculado uma vez por forma de modelo na carga (o mesmo modelo de dois jogadores divide a conta).
   Chaves: ?m5unid=0 (tudo), ?m5aro=0, ?m5barras=0, ?m5contorno=0, ?m5vet=0, ?m5mat2=0, ?m5desgaste=0, ?m5sujeira=0, ?m5cavidade=0, ?m5contato=0.
   Qualidade: na Baixa e no celular o contorno e os materiais 2.0 ficam desligados (por uniform, sem pipeline nem ALU); o aro e as barras
   valem em toda qualidade (substituem os de antes). Regras de carga da 5.0a.1: nada de luz, instâncias por atributo, tudo nasce na carga. */
(function (ARD) {
'use strict';
const M5 = ARD.m5 = ARD.m5 || {};
const T = () => window.THREE_M5, L = () => window.TSL;
const QS = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
const liga = (k, d) => (QS.get(k) == null ? d : QS.get(k) !== '0');
const TOQUE = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
const U5 = M5.unidades = { versao: '5.0e', ativo: liga('m5unid', true) };
const ON = U5.ativo;
U5.chaves = { aro: ON && liga('m5aro', true), barras: ON && liga('m5barras', true), contorno: ON && liga('m5contorno', true), vet: ON && liga('m5vet', true),
  mat2: ON && liga('m5mat2', true), desgaste: liga('m5desgaste', true), sujeira: liga('m5sujeira', true), cavidade: liga('m5cavidade', true), contato: liga('m5contato', true) };
const K = U5.chaves;
const BIG = 64; /* aDesg sem aresta viva perto */

/* ---------- uniforms do módulo (grupo da chamada de render: um bloco só para todos os objetos; valem no vértice e no fragmento) ---------- */
let UU = null;
function unif() {
  if (UU) return UU; const Tm = T(), { uniform, renderGroup, texture } = L(); const u = v => uniform(v).setGroup(renderGroup);
  const blank = M5.blank || ((r, g, b, a) => { const t = new Tm.DataTexture(new Uint8Array([r, g, b, a]), 1, 1); t.needsUpdate = true; return t; });
  UU = {
    tela: u(new Tm.Vector4(1280, 720, 1, 0)),  /* barras: largura e altura da tela em px CSS, px do aparelho por px CSS */
    tempo: u(0),                               /* relógio do visual (R.time) para as barras, o aro e o contorno */
    contorno: u(0),                            /* força do contorno do time (0 Baixa e celular, 0,75 Média, 1 Alta e Ultra) */
    mat2: u(0),                                /* materiais 2.0 ligados (0 Baixa e celular: o ramo inteiro fica de fora) */
    k2: u(new Tm.Vector4(1, 1, 1, 1)),         /* força do desgaste, da cavidade, da sujeira e do contato (chaves de URL) */
    chao: texture((() => { const t = blank(110, 96, 80, 255); t.magFilter = t.minFilter = Tm.LinearFilter; t.needsUpdate = true; return t; })()), /* cor do chão do mapa por ladrilho (sujeira por bioma), linear. Filtro linear desde o início: com o Nearest do DataTexture o r186 leria por textureLoad e os materiais montados antes e depois da troca da textura sairiam com WGSL diferente */
  };
  return UU;
}
U5.unif = unif;

/* ---------- cor do time na cor de instância dos modelos ----------
   iC.x = tinta (o que o render3d já punha nos três canais), iC.y = r·256 + g, iC.z = 1000 + b (inteiros de 0 a 255 exatos em float).
   Fora das unidades (construções, ruínas, cenário, fantasmas) iC continua a tinta nos três canais: iC.z < 1000, sem contorno. */
U5.codigoTime = function (hex) { const n = parseInt(String(hex || '#ffffff').slice(1), 16) || 0; const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255; return [r * 256 + g, 1000 + b]; };
U5.corModelo = function (cor) { const { Fn, attribute } = L(); return Fn(b => (b.object && b.object.isM5Inst ? cor.mul(attribute('iC', 'vec3').x) : cor))(); };
function corTimeNo() { /* vec4: rgb linear do time, a = 1 nas unidades */
  const { Fn, attribute, vec3, vec4, float, floor, step, pow, max } = L();
  return Fn(b => { if (!(b.object && b.object.isM5Inst)) return vec4(0, 0, 0, 0); const c = attribute('iC', 'vec3'); const r = floor(c.y.div(256)), g = c.y.sub(r.mul(256)), bb = c.z.sub(1000);
    const srgb = max(vec3(r, g, bb).div(255), vec3(0)); return vec4(pow(srgb, vec3(2.2)), step(999.5, c.z)); })(); }

/* ---------- materiais 2.0: atributo das arestas vivas (aDesg) ---------- */
const desgCache = new Map(); U5.stats = { formas: 0, reuso: 0, vertices: 0, ms: 0, em: 0 };
function hashForma(P, n) { let h = n * 2654435761 >>> 0; const st = Math.max(1, (n / 97) | 0) * 3, a = P.array; for (let i = 0; i < a.length; i += st) h = (Math.imul(h ^ ((a[i] * 4096) | 0), 16777619) + ((a[i + 1] * 4096) | 0)) >>> 0; return n + ':' + h; }
/* triângulo a triângulo (geometria sem índice): as arestas cujo vizinho tem outra normal (vinco) ou que ficam soltas viram arestas vivas;
   o vértice k guarda ±(altura até a aresta oposta), os outros dois 0: interpolado, o componente k é a distância até aquela aresta */
function calcArestas(p, no, BIG) { /* função pura (sem nada de fora): roda no trabalhador (Worker) ou aqui */
  const n = (p.length / 3) | 0, nt = (n / 3) | 0; const out = new Float32Array(n * 3).fill(BIG); if (n % 3 || no.length !== p.length) return out;
  const pb = new Uint32Array(p.buffer, p.byteOffset, n * 3); /* os vértices repetidos de uma peça têm os mesmos bits (toNonIndexed) */
  /* solda por tabela de espalhamento aberta (sem Map: ~10× mais rápido) */
  let cap = 1; while (cap < n * 2) cap <<= 1; const msk = cap - 1; const hk = new Int32Array(cap).fill(-1); const ids = new Int32Array(n); let nid = 0; const rep = new Int32Array(n);
  for (let v = 0; v < n; v++) { const x = pb[v * 3] | 0, y = pb[v * 3 + 1] | 0, z = pb[v * 3 + 2] | 0; let h = Math.imul(x, 0x9E3779B1) ^ Math.imul(y ^ (y >>> 16), 0x85EBCA77) ^ Math.imul(z ^ (z >>> 13), 0xC2B2AE3D); h ^= h >>> 15; h = Math.imul(h, 0x2C1B3C6D); h ^= h >>> 12; h &= msk; /* bits de float têm muitos zeros: mistura antes de cortar */
    for (;;) { const e = hk[h]; if (e < 0) { hk[h] = nid; rep[nid] = v; ids[v] = nid++; break; } const r = rep[e]; if (pb[r * 3] === pb[v * 3] && pb[r * 3 + 1] === pb[v * 3 + 1] && pb[r * 3 + 2] === pb[v * 3 + 2]) { ids[v] = e; break; } h = (h + 1) & msk; } }
  const fn = new Float32Array(nt * 3), ce = new Float32Array(nt * 3), ar = new Float32Array(nt);
  for (let t = 0; t < nt; t++) { const a = t * 9; const ux = p[a + 3] - p[a], uy = p[a + 4] - p[a + 1], uz = p[a + 5] - p[a + 2], vx = p[a + 6] - p[a], vy = p[a + 7] - p[a + 1], vz = p[a + 8] - p[a + 2];
    let cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx; const l = Math.sqrt(cx * cx + cy * cy + cz * cz); ar[t] = l * 0.5; if (l > 1e-12) { cx /= l; cy /= l; cz /= l; } fn[t * 3] = cx; fn[t * 3 + 1] = cy; fn[t * 3 + 2] = cz;
    ce[t * 3] = (p[a] + p[a + 3] + p[a + 6]) / 3; ce[t * 3 + 1] = (p[a + 1] + p[a + 4] + p[a + 7]) / 3; ce[t * 3 + 2] = (p[a + 2] + p[a + 5] + p[a + 8]) / 3; }
  /* arestas: tabela aberta pela dupla de ids; a primeira aparição guarda o lado (t·3 + k), a segunda faz o par, a terceira marca não-variedade */
  let ecap = 1; while (ecap < nt * 6) ecap <<= 1; const em = ecap - 1; const ea = new Int32Array(ecap).fill(-1), eb = new Int32Array(ecap), es = new Int32Array(ecap); const nb = new Int32Array(nt * 3).fill(-1);
  for (let t = 0; t < nt; t++) for (let k = 0; k < 3; k++) { let a = ids[t * 3 + (k === 2 ? 0 : k + 1)], b = ids[t * 3 + (k === 0 ? 2 : k - 1)]; if (a === b) { nb[t * 3 + k] = -2; continue; } if (a > b) { const c = a; a = b; b = c; }
    let h = Math.imul(a, 0x9E3779B1) ^ Math.imul(b, 0x85EBCA77); h ^= h >>> 15; h = Math.imul(h, 0x2C1B3C6D); h ^= h >>> 13; h &= em; const sl = t * 3 + k;
    for (;;) { if (ea[h] < 0) { ea[h] = a; eb[h] = b; es[h] = sl; break; } if (ea[h] === a && eb[h] === b) { const f = es[h]; if (f >= 0 && nb[f] === -1) { nb[f] = sl; nb[sl] = f; } else { nb[sl] = -3; if (f >= 0) nb[f] = -3; } es[h] = -1; break; } h = (h + 1) & em; } }
  for (let t = 0; t < nt; t++) for (let k = 0; k < 3; k++) { const s = nb[t * 3 + k]; if (s === -2) continue; let sg = 1;
    const va = t * 3 + (k === 2 ? 0 : k + 1), vb = t * 3 + (k === 0 ? 2 : k - 1);
    if (s >= 0) { const o = (s / 3) | 0; const d = fn[t * 3] * fn[o * 3] + fn[t * 3 + 1] * fn[o * 3 + 1] + fn[t * 3 + 2] * fn[o * 3 + 2]; if (d > 0.94) continue; /* quase plano (até ~20°): não é aresta */
      const ko = s - o * 3, oa = o * 3 + (ko === 2 ? 0 : ko + 1), ob = o * 3 + (ko === 0 ? 2 : ko - 1); const sa = ids[oa] === ids[va] ? oa : ob, sb = sa === oa ? ob : oa;
      if (no[va * 3] * no[sa * 3] + no[va * 3 + 1] * no[sa * 3 + 1] + no[va * 3 + 2] * no[sa * 3 + 2] > 0.995 && no[vb * 3] * no[sb * 3] + no[vb * 3 + 1] * no[sb * 3 + 1] + no[vb * 3 + 2] * no[sb * 3 + 2] > 0.995) continue; /* sombreado suave dos dois lados (cilindro, esfera): não é aresta */
      const dx = ce[o * 3] - ce[t * 3], dy = ce[o * 3 + 1] - ce[t * 3 + 1], dz = ce[o * 3 + 2] - ce[t * 3 + 2]; sg = fn[t * 3] * dx + fn[t * 3 + 1] * dy + fn[t * 3 + 2] * dz < 0 ? 1 : -1; } /* o vizinho abaixo do plano: convexa */
    const ex = p[vb * 3] - p[va * 3], ey = p[vb * 3 + 1] - p[va * 3 + 1], ez = p[vb * 3 + 2] - p[va * 3 + 2]; const el = Math.sqrt(ex * ex + ey * ey + ez * ez); const hh = el > 1e-9 ? Math.min(BIG - 1, 2 * ar[t] / el) : 0;
    const o3 = t * 9 + k; out[o3] = 0; out[o3 + 3] = 0; out[o3 + 6] = 0; out[t * 9 + k * 3 + k] = sg * hh; }
  return out;
}
/* chamado pelo ARD.m5.entrelaca (src/m5/modelos.js) em toda geometria de modelo, antes de entrelaçar: o mesmo layout em todas */
/* o cálculo vai para um trabalhador (Worker) e a carga não espera: o atributo nasce sem aresta (BIG) e é preenchido quando a resposta chega
   (antes da primeira subida para a GPU na quase totalidade; depois, só sobe o buffer daquele modelo). Sem Worker (Node, bloqueio), calcula aqui */
let trab = null, trabFalhou = false, trabId = 0; const espera = new Map(); /* hash → { geos: [], t0 } */
function trabalhador() {
  if (trab || trabFalhou || typeof Worker === 'undefined' || typeof Blob === 'undefined' || QS.get('m5desgtrab') === '0') return trab;
  try { const src = 'const calcArestas = ' + calcArestas.toString() + ';\nonmessage = e => { const d = e.data; const out = calcArestas(d.p, d.no, d.big); postMessage({ h: d.h, out }, [out.buffer]); };';
    trab = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
    trab.onmessage = e => { const { h, out } = e.data; desgCache.set(h, out); const w = espera.get(h); espera.delete(h); if (!w) return; U5.stats.trabMs = Math.max(U5.stats.trabMs || 0, performance.now() - U5.stats.trab0); for (const g of w.geos) aplica(g, out); U5.stats.prontas = (U5.stats.prontas || 0) + w.geos.length; };
    trab.onerror = () => { trabFalhou = true; trab = null; espera.clear(); U5.stats.trabErro = true; }; /* sem trabalhador: os que estavam fora ficam sem aresta; os próximos são calculados aqui */
  } catch (e) { trabFalhou = true; trab = null; } return trab;
}
function aplica(geo, out) { const a = geo.attributes.aDesg; if (!a) return; if (a.isInterleavedBufferAttribute) { const n = a.count; for (let i = 0; i < n; i++) a.setXYZ(i, out[i * 3], out[i * 3 + 1], out[i * 3 + 2]); a.data.needsUpdate = true; } else { a.array.set(out); a.needsUpdate = true; } }
U5.desgAttr = function (geo, emis) {
  if (!geo || !geo.attributes || !geo.attributes.position || geo.attributes.aDesg) return; const Tm = T() || window.THREE; const P = geo.attributes.position, N = geo.attributes.normal, n = P.count;
  const vazio = () => { const a = new Float32Array(n * 3).fill(BIG); return a; };
  if (emis || !K.desgaste || !N || geo.index || P.isInterleavedBufferAttribute || !(P.array instanceof Float32Array)) { geo.setAttribute('aDesg', new Tm.BufferAttribute(vazio(), 3)); U5.stats.em++; return; }
  const t0 = performance.now(); const h = hashForma(P, n); let arr = desgCache.get(h);
  if (arr) { U5.stats.reuso++; geo.setAttribute('aDesg', new Tm.BufferAttribute(arr, 3)); }
  else { const w = espera.get(h); if (w) { U5.stats.reuso++; w.geos.push(geo); geo.setAttribute('aDesg', new Tm.BufferAttribute(vazio(), 3)); }
    else if (trabalhador()) { if (U5.stats.trab0 == null) U5.stats.trab0 = performance.now(); if (!U5._pend && Array.isArray(M5.pendentes)) { U5._pend = true; M5.pendentes.push(() => esperaTrab(2500)); } const p = P.array.slice(), no = N.array.slice(); espera.set(h, { geos: [geo] }); trab.postMessage({ h, p, no, big: BIG }, [p.buffer, no.buffer]); geo.setAttribute('aDesg', new Tm.BufferAttribute(vazio(), 3)); U5.stats.formas++; U5.stats.vertices += n; U5.stats.noTrab = (U5.stats.noTrab || 0) + 1; }
    else { arr = calcArestas(P.array, N.array, BIG); desgCache.set(h, arr); geo.setAttribute('aDesg', new Tm.BufferAttribute(arr, 3)); U5.stats.formas++; U5.stats.vertices += n; } }
  U5.stats.ms += performance.now() - t0;
};
U5.desgPendentes = () => espera.size;
/* a carga espera as respostas que faltam (até 2,5 s) junto com os pipelines em voo (ARD.m5.pendentes roda dentro do ARD.m5.compile): as arestas
   chegam antes dos quadros de aquecimento, e nenhum buffer de modelo sobe de novo no começo da partida. Numa máquina comum o trabalhador já
   terminou e a espera é zero; numa lenta, passado o limite, o resto chega depois (sobe só o buffer daquele modelo) */
function esperaTrab(lim) { const t0 = performance.now(); return new Promise(res => { const tick = () => { if (!espera.size || trabFalhou || performance.now() - t0 > lim) { U5.stats.espera = Math.round(performance.now() - t0); U5._pend = false; return res(); } setTimeout(tick, 15); }; tick(); }); }
/* o layout da ruína ganha o mesmo atributo (a ruína e os modelos dividem o fragmento: sem ele o módulo se separaria) */
U5.desgLayout = ['aDesg', 3, [BIG, BIG, BIG]];
M5.__limpa = () => desgCache.clear(); /* medida (work/bench-desg.mjs) */
if (K.mat2 && !TOQUE) M5.desgAttr = U5.desgAttr; /* no celular, sem o atributo (memória): o material lê a constante */

/* sujeira por bioma: o render3d passa a partida; a cor do chão por ladrilho (os mesmos tons do chão do Motor 5, mais escuros) */
const SUJ_BIO = { gelo: [0.5, 0.56, 0.64], rocha: [0.46, 0.33, 0.22], tundra: [0.2, 0.16, 0.11], basalto: [0.055, 0.05, 0.055] };
U5.mapaChao = function (sim) {
  const S = ARD.sim; if (!sim || !sim.biome || !S || !S.BIOMES || U5._chaoSim === sim) return; U5._chaoSim = sim; const Tm = T(); const N = Math.round(Math.sqrt(sim.biome.length)); if (!(N > 1)) return;
  const d = new Uint8Array(N * N * 4); const lin = c => Math.round(Math.min(1, c) * 255);
  for (let i = 0; i < N * N; i++) { const a = SUJ_BIO[S.BIOMES[sim.biome[i]]] || SUJ_BIO.rocha, b = SUJ_BIO[S.BIOMES[sim.biome2 ? sim.biome2[i] : sim.biome[i]]] || a, m = sim.biomeMix ? sim.biomeMix[i] : 0; for (let c = 0; c < 3; c++) d[i * 4 + c] = lin(a[c] * (1 - m) + b[c] * m); d[i * 4 + 3] = 255; }
  const tx = new Tm.DataTexture(d, N, N); tx.magFilter = tx.minFilter = Tm.LinearFilter; tx.wrapS = tx.wrapT = Tm.ClampToEdgeWrapping; tx.flipY = false; tx.needsUpdate = true; unif().chao.value = tx; };

/* ---------- ganchos do material dos modelos ---------- */
const SUJ_RACA = { vehnar: 1, tessara: 0.85, vorag: 0.8, erevane: 0.35, quorith: 0.3 }; /* Erevane e Quorith flutuam: quase nada de barro */
const G = M5.ganchos = M5.ganchos || { modelo: { posicao: null, superficie: null, emissivo: null }, chao: { cor: null }, adereco: { posicao: null } };
G.modelo = G.modelo || {};
let fVN = null; function VN(p) { const MM = M5.modelos; if (MM && MM.VN && MM.ativo) { MM.prepara(); return MM.VN(p); } prepVN(); return fVN(p); } /* o ardVN do src/m5/modelos.js quando o porte dos modelos está ligado */
function prepVN() { if (!fVN && L()) { const { Fn, fract, sin, dot, vec2, floor, mix } = L(); const h = Fn(([q]) => fract(sin(dot(q, vec2(269.5, 183.3))).mul(24634.6345))).setLayout({ name: 'ardU5h', type: 'float', inputs: [{ name: 'q', type: 'vec2' }] });
  fVN = Fn(([q]) => { const i = floor(q).toVar(), f = fract(q).toVar(), u = f.mul(f).mul(f.mul(-2).add(3)).toVar(); return mix(mix(h(i), h(i.add(vec2(1, 0))), u.x), mix(h(i.add(vec2(0, 1))), h(i.add(vec2(1, 1))), u.x), u.y).mul(0.98).add(0.01); }).setLayout({ name: 'ardU5vn', type: 'float', inputs: [{ name: 'q', type: 'vec2' }] }); } } /* conteúdo diferente do ardH2/ardVN do src/m5/modelos.js (com o mesmo corpo o r186 trata as duas como a mesma função e a ordem delas no WGSL mudava de um material para o outro, separando o módulo por Raça); criadas fora da montagem do shader (na criação do material): criadas no meio da 1ª montagem, a ordem das funções no WGSL saía diferente nos materiais seguintes e cada Raça ganhava módulo e pipeline próprios */
if (K.mat2) {
  const supAntes = G.modelo.superficie;
  G.modelo.superficie = function (ctx) {
    if (supAntes) supAntes(ctx); if (ctx.emissivo) return; prepVN(); const m = ctx.m, o = ctx.o || {}; const TL = L(); const { Fn, clamp, mix, float, uniform } = TL;
    const fac = (/race-(\w+)/.exec(o.key || '') || [])[1]; const suj = uniform(fac && SUJ_RACA[fac] != null ? SUJ_RACA[fac] : 0.75); m.userData.ardSujeira = suj; /* por material (Raça), constante */
    const sdc = m.setupDiffuseColor; let KK = null;
    m.setupDiffuseColor = function (b) { sdc.call(this, b); KK = camada2(suj); };
    const r0 = m.roughnessNode; if (r0) m.roughnessNode = Fn(() => (KK ? clamp(r0.add(KK.rug), 0.04, 1.0) : r0))();
    const me0 = m.metalnessNode; if (me0) m.metalnessNode = Fn(() => (KK ? clamp(mix(me0, float(0.92), KK.metal).mul(float(1).sub(KK.semMetal)), 0.0, 1.0) : me0))();
  };
}
function camada2(suj) {
  const TL = L(); const { If, Var, float, vec2, vec3, vec4, mix, smoothstep, clamp, min, max, step, fwidth, dot, floor, select, diffuseColor, positionGeometry, positionWorld, normalGeometry } = TL; const U = unif();
  const dg = M5.attr('aDesg', vec3(BIG, BIG, BIG)); const pg = positionGeometry; const pt = Var(floor(M5.attr('pt', float(0)).add(0.5)), 'ardU5pt');
  const cv = v => mix(float(BIG), v, step(0, v)), cc = v => mix(float(BIG), v.negate(), step(v, 0));
  const conv = Var(min(min(cv(dg.x), cv(dg.y)), cv(dg.z)), 'ardU5cv'), conc = Var(min(min(cc(dg.x), cc(dg.y)), cc(dg.z)), 'ardU5cc');
  const fwC = Var(max(fwidth(conv), fwidth(pg.y).mul(0.5)), 'ardU5fw'); /* fora de qualquer ramo: derivada em fluxo uniforme */
  const R = { rug: Var(float(0), 'ardU5rg'), metal: Var(float(0), 'ardU5mt'), semMetal: Var(float(0), 'ardU5sm') };
  If(U.mat2.greaterThan(0.5), () => {
    const dc = diffuseColor.rgb; const kk = U.k2; const hy = pg.y;
    /* desgaste de borda: faixa de ~0,2 unidade com lascas (ruído), apagada quando a faixa fica menor que o pixel; o ramo só roda perto da aresta
       (longe dela o resultado é exatamente 0: a maior parte dos pixels não paga o ruído) */
    const wb = float(0.2);
    If(conv.lessThan(wb), () => {
      const nz = VN(pg.xz.mul(3.3).add(pg.y.mul(2.1))).mul(0.55).add(VN(pg.zy.mul(7.7).add(1.3)).mul(0.45));
      const kAA = float(1).sub(smoothstep(wb.mul(0.5), wb.mul(2.0), fwC));
      const kPt = select(pt.lessThan(0.5), float(0.6), select(pt.lessThan(1.5), float(1.0), select(pt.lessThan(2.5), float(0.12), select(pt.lessThan(3.5), float(0.55), select(pt.lessThan(4.5), float(0.6), select(pt.lessThan(5.5), float(0.7), float(0.3)))))));
      const ed = clamp(float(1).sub(conv.div(wb)), 0, 1); const gasto = smoothstep(0.45, 0.7, ed.mul(0.9).add(nz.mul(0.45)).sub(0.12)).mul(kAA).mul(kPt).mul(kk.x);
      const lum = dot(dc, vec3(0.299, 0.587, 0.114)); const corG = mix(vec3(lum), dc, 0.45).mul(1.6).add(0.04);
      dc.assign(mix(dc, corG, gasto.mul(0.85)));
      R.rug.subAssign(gasto.mul(0.2)); R.metal.assign(gasto.mul(select(pt.lessThan(1.5).and(pt.greaterThan(0.5)), float(0.6), float(0.1))));
    });
    /* cavidade: os vãos (arestas côncavas) mais escuros, em faixa mais larga e macia (só perto da aresta côncava) */
    const wc = float(0.45);
    If(conc.lessThan(wc), () => { const cav = float(1).sub(smoothstep(0, wc, conc)).mul(float(1).sub(smoothstep(wc.mul(0.6), wc.mul(2.5), fwC)).mul(0.6).add(0.4)).mul(kk.y);
      dc.mulAssign(float(1).sub(cav.mul(0.45))); R.rug.addAssign(cav.mul(0.08)); });
    /* sujeira por bioma: poeira, lama e cinza embaixo das peças, na cor do chão do mapa (mais forte na borracha das rodas e lagartas); só abaixo de 3,2 */
    If(hy.lessThan(3.2), () => {
      const n2 = VN(pg.xz.mul(0.55).add(0.7)); const hd = n2.mul(1.6).add(1.6);
      const base = float(1).sub(smoothstep(0, hd, hy)); const sp = smoothstep(0.25, 0.62, VN(pg.xz.mul(1.7).add(hy.mul(1.3))).add(base.mul(0.5)));
      const sujo = base.mul(sp).mul(suj).mul(kk.z).mul(select(pt.lessThan(2.5).and(pt.greaterThan(1.5)), float(1.25), float(1))).mul(0.85);
      const cs = U.chao.sample(M5.mapUV(positionWorld)).level(0).rgb.mul(VN(pg.xz.mul(2.9)).mul(0.25).add(0.88));
      dc.assign(mix(dc, cs, clamp(sujo, 0, 0.9))); R.rug.addAssign(sujo.mul(0.28)); R.semMetal.assign(clamp(sujo.mul(0.9), 0, 1));
      /* sombra de contato fina: a base das peças (o primeiro palmo acima do chão) mais escura; embaixo (normal para baixo) mais ainda */
      const cont = float(1).sub(smoothstep(0, 1.15, hy)).mul(kk.w); const baixo = float(1).sub(smoothstep(-0.7, 0.1, normalGeometry.y)).mul(float(1).sub(smoothstep(0, 3.5, hy))).mul(kk.w);
      dc.mulAssign(float(1).sub(cont.mul(0.38)).mul(float(1).sub(baixo.mul(0.3))));
    });
  });
  return R;
}
/* contorno do time: borda acesa (Fresnel estreito) na cor do time, só nas unidades (iC.z ≥ 1000) */
if (K.contorno) {
  const emAntes = G.modelo.emissivo;
  G.modelo.emissivo = function (ctx) {
    const em0 = emAntes ? (emAntes(ctx) || ctx.em) : ctx.em; if (ctx.emissivo) return em0;
    const { float, abs, dot, normalize, normalView, positionViewDirection, smoothstep, varying } = L(); const U = unif();
    const tc = corTimeNo(); /* 5.0e (junção): decodificada no fragmento pelo mesmo iC da cor da instância (o atributo é um nó global: a mesma variável), sem uma variável a mais */ const f = float(1).sub(abs(dot(normalize(normalView), positionViewDirection)));
    const rim = smoothstep(0.58, 0.9, f).mul(tc.a).mul(U.contorno);
    return em0.add(tc.rgb.mul(rim.mul(1.7)));
  };
}

/* ---------- aro em holograma (seleção, veteranos, promoção, fantasma e farol): um material, um desenho ---------- */
function aroGeo() {
  const Tm = T(); const N = 72, R0 = 0.62, R1 = 1.12, pos = [], idx = [];
  for (let i = 0; i <= N; i++) { const a = i / N * Math.PI * 2, c = Math.cos(a), s = Math.sin(a); pos.push(c * R0, 0, -s * R0, c * R1, 0, -s * R1); }
  for (let i = 0; i < N; i++) { const a = i * 2, b = a + 1, c = a + 2, d = a + 3; idx.push(a, b, c, b, d, c); }
  const g = new Tm.BufferGeometry(); g.setAttribute('position', new Tm.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeBoundingSphere(); return g;
}
function aroMat() {
  const Tm = T(); const TL = L(); const { Fn, attribute, varying, float, vec2, vec3, vec4, abs, fract, atan, length, max, min, mix, pow, exp, smoothstep, step, sin, clamp, fwidth, positionGeometry, cameraPosition } = TL; const U = unif();
  const m = new Tm.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -2 }); m.fog = false;
  const c0 = attribute('iM0', 'vec4'), c2 = attribute('iM2', 'vec4'), c3 = attribute('iM3', 'vec4');
  m.positionNode = Fn(() => c3.xyz.add(c0.xyz.mul(positionGeometry.x)).add(c2.xyz.mul(positionGeometry.z)))();
  const vK = varying(attribute('iM1', 'vec4'), 'ardAroK'), vC = varying(attribute('iC', 'vec3'), 'ardAroC'), vO = varying(c3.xz, 'ardAroO');
  m.fragmentNode = Fn(() => {
    const p = positionGeometry.xz, rho = length(p), ang = atan(p.y.negate(), p.x); /* o z da geometria é −y do anel */
    const tipo = vK.y, t = U.tempo; const px = max(fwidth(rho), 0.0015); /* tamanho do pixel em unidades do anel */
    const sel = step(tipo, 0.5).add(step(4.5, tipo)), vet = step(0.5, tipo).mul(step(tipo, 3.5)), fla = step(3.5, tipo).mul(step(tipo, 4.5));
    const cor = vC; const lw = max(px.mul(mix(float(0.85), float(0.6), vet)), float(0.011));
    const dC = abs(rho.sub(0.92)); const core = float(1).sub(smoothstep(lw, lw.add(px), dC));
    const halo = float(1).sub(smoothstep(lw.add(px), lw.add(px.mul(2.8)), dC)).mul(float(1).sub(core)); /* borda escura de ~1,5 px dos dois lados: lê na neve e no gelo */
    const a01 = fract(ang.div(6.2831853).add(0.5).sub(t.mul(0.42)).sub(vK.z)); const varre = pow(a01, 9).mul(sel);
    const dentro = clamp(float(0.92).sub(rho).div(0.2), 0, 1); const brilho = exp(dentro.mul(-4.5)).mul(step(rho, 0.92)).mul(smoothstep(0.62, 0.68, rho)); const scan = sin(rho.mul(90).sub(t.mul(5))).mul(0.2).add(0.8);
    const q = fract(ang.div(1.5707963).add(t.mul(0.05)).add(vK.z)); const dq = abs(q.sub(0.5)).mul(1.5707963).mul(rho); /* 4 marcas que giram devagar, por fora */
    const tick = float(1).sub(smoothstep(px.mul(0.8), px.mul(1.8), dq)).mul(smoothstep(0.955, 0.965, rho)).mul(float(1).sub(smoothstep(1.03, 1.04, rho))).mul(sel);
    /* veterano: linha tracejada fina que gira devagar e as estrelas da patente viradas para a câmera */
    const tr = step(0.38, fract(ang.mul(16 / 6.2831853).add(t.mul(0.06)))); const pat = vK.w;
    const dcam = vec2(cameraPosition.x.sub(vO.x), cameraPosition.z.sub(vO.y).negate()); const angC = atan(dcam.y, dcam.x);
    const tam = max(float(0.075), px.mul(2.6)); let est = float(0), estB = float(0);
    for (let i = 0; i < 3; i++) { const ai = angC.add(float(i).sub(pat.sub(1).mul(0.5)).mul(tam.mul(2.6))); const da = abs(fract(ang.sub(ai).div(6.2831853).add(0.5)).sub(0.5)).mul(6.2831853).mul(rho);
      const dr = abs(rho.sub(1.0)); const dia = da.add(dr.mul(1.15)).div(tam); const on = step(float(i).add(0.5), pat); est = max(est, float(1).sub(smoothstep(0.82, 0.82 + 0.18, dia)).mul(on)); estB = max(estB, float(1).sub(smoothstep(1.05, 1.35, dia)).mul(on)); }
    const pul = mix(float(1), sin(t.mul(4)).mul(0.25).add(0.85), step(2.5, pat));
    /* camadas pré-multiplicadas: borda escura → brilho de dentro → marcas → linha → estrelas (com contorno escuro) */
    let pc = vec3(0.004, 0.005, 0.007).mul(halo.mul(0.55)), al = halo.mul(0.55);
    const sobre = (col, a) => { pc = col.mul(a).add(pc.mul(float(1).sub(a))); al = a.add(al.mul(float(1).sub(a))); };
    sobre(cor.mul(0.8), brilho.mul(scan).mul(mix(float(0.16), float(0.07), vet)).mul(varre.mul(1.5).add(1)));
    sobre(cor.mul(1.4), tick.mul(0.85));
    sobre(cor.mul(float(1.5).add(varre.mul(2.2))).mul(pul), core.mul(mix(float(0.95), tr.mul(0.85).add(0.05), vet)));
    sobre(vec3(0.02, 0.012, 0.0), estB.mul(vet).mul(0.6)); sobre(cor.mul(2.0).mul(pul), est.mul(vet));
    const F = vK.x; /* promoção: o anel claro que abre (o raio cresce no render3d), forte e sumindo */
    const out = vec4(pc.div(max(al, 0.0001)), clamp(al, 0, 1)); const fl = vec4(cor.mul(2.4), clamp(core.add(halo.mul(0.3)).add(brilho.mul(0.35)).mul(F), 0, 1));
    return mix(out, fl, fla);
  })();
  return M5.registrar ? M5.registrar('aro-holo', m) : m;
}

/* ---------- barras de vida em segmentos: quadrado por barra no espaço da tela, depois do pós ---------- */
function barraMat() {
  const Tm = T(); const TL = L(); const { Fn, attribute, varying, float, vec2, vec3, vec4, abs, fract, floor, max, min, mix, smoothstep, step, sin, clamp, select, positionGeometry, cameraProjectionMatrix, cameraViewMatrix } = TL; const U = unif();
  const m = new Tm.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, depthTest: false }); m.fog = false; m.toneMapped = false;
  const c0 = attribute('iM0', 'vec4'), c1 = attribute('iM1', 'vec4'), c3 = attribute('iM3', 'vec4');
  const Hc = c0.y.add(select(c1.y.greaterThan(0.5), float(9), float(0))); /* altura total: barra + divisas */
  m.vertexNode = Fn(() => {
    const clip = cameraProjectionMatrix.mul(cameraViewMatrix).mul(vec4(c3.xyz, 1)); const w = max(clip.w, 0.0001); const ndc = clip.xy.div(w);
    const dpr = U.tela.z; const sp = floor(ndc.mul(0.5).add(0.5).mul(U.tela.xy).mul(dpr)).div(dpr); /* âncora presa ao pixel do aparelho */
    const px = vec2(positionGeometry.x.sub(0.5).mul(c0.x), positionGeometry.y.mul(Hc)); const pos = sp.add(px).div(U.tela.xy).mul(2).sub(1);
    const fora = step(clip.w, 0.0001); return vec4(pos.add(vec2(fora.mul(9), 0)), 0.5, 1); })(); /* atrás da câmera: fora da tela */
  const vA = varying(vec4(c0.x, c0.y, c0.z, c0.w), 'ardBarA'), vB = varying(c1, 'ardBarB'), vC = varying(attribute('iC', 'vec3'), 'ardBarC');
  const vP = varying(vec2(positionGeometry.x.mul(c0.x), positionGeometry.y.mul(Hc)), 'ardBarP');
  m.fragmentNode = Fn(() => {
    const W = vA.x, Hb = vA.y, fr = vA.z, fr2 = vA.w, nseg = vB.x, pat = vB.y, pis = vB.z, fl = vB.w; const x = vP.x, y = vP.y, t = U.tempo;
    const naBarra = step(y, Hb); const dentro = step(1, x).mul(step(x, W.sub(1))).mul(step(1, y)).mul(step(y, Hb.sub(1)));
    const f = clamp(x.sub(1).div(max(W.sub(2), 1)), 0, 1); const sw = W.sub(2).div(max(nseg, 1)); const fs = fract(f.mul(nseg)); const gap = step(fs.mul(sw), 1).mul(step(0.5, f.mul(nseg)));
    const cheio = step(f, fr), recente = step(fr, f).mul(step(f, fr2));
    const baixa = step(fr, 0.3); const pulso = mix(float(1), sin(t.mul(9)).mul(0.18).add(0.86), baixa);
    const topo = smoothstep(Hb.mul(0.35), Hb.sub(1), y); const corT = vC.mul(mix(float(0.86), float(1.18), topo)).mul(pulso);
    const pisca = step(0, sin(t.mul(26))).mul(0.55).add(0.45).mul(pis); const corR = mix(vec3(1, 0.97, 0.86), vec3(1, 0.42, 0.16), float(1).sub(pisca));
    let rgb = vec3(0.045, 0.05, 0.06), a = float(0.62);
    rgb = mix(rgb, corR, recente.mul(max(pis, 0.35))); a = mix(a, float(0.95), recente.mul(max(pis, 0.35)));
    rgb = mix(rgb, corT, cheio); a = mix(a, float(1), cheio);
    rgb = mix(rgb, vec3(0.02, 0.022, 0.03), gap.mul(dentro)); a = mix(a, float(0.92), gap.mul(dentro));
    const sel = step(1.5, fl); const bordaCor = mix(vec3(0.0, 0.0, 0.0), vec3(0.85, 0.9, 0.95), sel.mul(0.55));
    rgb = mix(bordaCor, rgb, dentro); a = mix(float(0.88), a, dentro); a = a.mul(naBarra);
    /* divisas douradas (patente) acima da barra, em holograma: linha clara com contorno escuro; piscam claras na promoção */
    const yy = y.sub(Hb).sub(1.5); const cx0 = W.mul(0.5); let dv = float(0), db = float(0);
    for (let i = 0; i < 3; i++) { const cx = cx0.add(float(i).sub(pat.sub(1).mul(0.5)).mul(8)); const dx = abs(x.sub(cx)); const d = abs(yy.sub(float(5.0).sub(dx.mul(1.05)))); const on = step(float(i).add(0.5), pat).mul(step(dx, 3.3)).mul(step(-0.5, yy)).mul(step(yy, 7));
      dv = max(dv, float(1).sub(smoothstep(0.55, 1.05, d)).mul(on)); db = max(db, float(1).sub(smoothstep(1.3, 1.9, d)).mul(on)); }
    const ouro = mix(vec3(0.95, 0.76, 0.19), vec3(1, 0.98, 0.85), clamp(fract(fl).mul(2), 0, 1)).mul(mix(float(1), sin(t.mul(4)).mul(0.12).add(0.95), step(2.5, pat)));
    const emCima = float(1).sub(naBarra); rgb = mix(rgb, mix(vec3(0.05, 0.035, 0), ouro, dv.div(max(db, 0.001))), emCima.mul(db)); a = mix(a, max(db.mul(0.85), dv), emCima);
    return vec4(rgb, a);
  })();
  return M5.registrar ? M5.registrar('barra-vida', m) : m;
}

/* ---------- criação no render3d (o.THREE, o.scene, o.H, o.R, o.FX, o.Inst) ---------- */
U5.criar = function (o) {
  if (!ON || !T() || !L()) return null; const Tm = T(); const Inst = M5.Inst(); const U = unif(); const R = o.R, H = o.H;
  const UN = { aros: null, barras: null, cenaHud: null };
  const CAP_ARO = 512, CAP_BAR = 768;
  const _e = { elements: new Float32Array(16) }, E = _e.elements; const _c = new Tm.Color(), _n = new Tm.Vector3(), _q = new Tm.Quaternion(), _a = new Tm.Vector3(), _b = new Tm.Vector3(), UPV = new Tm.Vector3(0, 1, 0);
  const corCache = new Map(); const corLin = hex => { let c = corCache.get(hex); if (!c) { c = new Tm.Color(hex); corCache.set(hex, c); } return c; }; /* Color(hex) = linear */
  const OURO = new Tm.Color(1.0, 0.55, 0.08), BRANCO = new Tm.Color(0.85, 0.9, 1.0), RUIM = new Tm.Color(1.0, 0.18, 0.12), FAROL = new Tm.Color(1.0, 0.78, 0.3);
  let sim = null, human = 0, foeP = null, foeCor = null;
  if (K.aro) { UN.aros = new Inst(aroGeo(), aroMat(), CAP_ARO); UN.aros.count = 0; UN.aros.frustumCulled = false; UN.aros.renderOrder = 1; UN.aros.name = 'ard-aros'; UN.aros.castShadow = false; UN.aros.receiveShadow = false; }
  UN.capAro = CAP_ARO;
  /* um anel: tipo 0 seleção, 1–3 veterano (patente), 4 promoção (F), 5 farol, 6 fantasma ok, 7 fantasma bloqueado; dono −1 neutro */
  UN.aro = function (n, x, y, r, dono, tipo, F, fase) {
    if (n >= CAP_ARO || !UN.aros) return n; tipo = tipo || 0;
    const hd = Math.max(4, r * 0.5); const hx = (H(x + hd, y) - H(x - hd, y)) / (2 * hd), hy = (H(x, y + hd) - H(x, y - hd)) / (2 * hd); _n.set(-hx, 1, hy).normalize(); _q.setFromUnitVectors(UPV, _n);
    _a.set(r, 0, 0).applyQuaternion(_q); _b.set(0, 0, r).applyQuaternion(_q);
    E[0] = _a.x; E[1] = _a.y; E[2] = _a.z; E[3] = 0; E[4] = F || 0; E[5] = tipo; E[6] = fase != null ? fase : ((x * 0.0137 + y * 0.0071) % 1); E[7] = tipo >= 1 && tipo <= 3 ? tipo : 0;
    E[8] = _b.x; E[9] = _b.y; E[10] = _b.z; E[11] = 0; E[12] = x; E[13] = H(x, y) + 0.7; E[14] = -y; E[15] = 1; UN.aros.setMatrixAt(n, _e);
    let c; if (tipo >= 1 && tipo <= 4) c = OURO; else if (tipo === 5) c = FAROL; else if (tipo === 7) c = RUIM; else if (dono == null || dono < 0 || !sim || !sim.players[dono]) c = BRANCO;
    else if (foeP && foeP[dono] === true && foeCor) c = foeCor; else c = corLin(sim.players[dono].color);
    UN.aros.setColorAt(n, c); return n + 1;
  };
  /* veterano: aro dourado com as estrelas da patente; na promoção um anel claro abre por 1,2 s */
  const promo = new Map(); let podaT = 0;
  UN.vet = function (n, x, y, r, dono, pat, id) {
    if (!K.vet) return n; n = UN.aro(n, x, y, r, dono, Math.min(3, pat), 0, (id % 97) * 0.0103);
    const t0 = promo.get(id); if (t0 != null) { const k = (R.time - t0) / 1.2; if (k >= 0 && k < 1) n = UN.aro(n, x, y, (r + 2) * (1 + k * 1.6), dono, 4, (1 - k) * (1 - k)); }
    const FX = o.FX; if (FX && pat >= 3 && FX.glow && Math.random() < 0.02 * (FX.mult || 1)) FX.glow(x + (Math.random() - 0.5) * r, H(x, y) + 4 + Math.random() * r, -y + (Math.random() - 0.5) * r, [1.5, 1.15, 0.4], 2.2, 0.9, 14); /* o brilho ★★★ de antes */
    return n;
  };
  UN.promovido = function (e, FX) { if (!K.vet || !e || e.id == null) return; promo.set(e.id, R.time); if (FX && FX.pulse) { const gy = H(e.x, e.y); FX.pulse(e.x, gy, -e.y, [1.7, 1.25, 0.45], 46, 0.9); if (FX.glow) for (let i = 0; i < 7; i++) FX.glow(e.x + (Math.random() - 0.5) * 14, gy + 3 + Math.random() * 16, -e.y + (Math.random() - 0.5) * 14, [1.6, 1.2, 0.45], 2.4 + Math.random() * 2, 0.8, 16); } };
  /* barras: cena própria, desenhada depois do pós direto na tela */
  if (K.barras) { const g = new Tm.BufferGeometry(); g.setAttribute('position', new Tm.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0], 3)); g.setIndex([0, 1, 2, 0, 2, 3]); g.computeBoundingSphere();
    UN.barras = new Inst(g, barraMat(), CAP_BAR); UN.barras.count = 0; UN.barras.frustumCulled = false; UN.barras.name = 'ard-barras'; UN.cenaHud = new Tm.Scene(); UN.cenaHud.matrixAutoUpdate = false; UN.cenaHud.add(UN.barras);
    UN.cenaHud.isQuadMesh = true; /* o r186 marca o contexto como passe de tela cheia (fullscreenPass): amostra única direto na textura da tela, carregando o que o pós deixou. Sem isso o passe usa o MSAA da tela (que não tem o quadro: o pós desenha em amostra única) e a resolução apaga a imagem */ }
  const dano = new Map(); const _dbs = new Tm.Vector2();
  const segs = (hb) => hb.unit ? (hb.max <= 110 ? 3 : hb.max <= 200 ? 4 : hb.max <= 450 ? 5 : hb.max <= 1200 ? 6 : 10) : (hb.max < 1000 ? 6 : hb.max < 3000 ? 8 : 10);
  UN.desenhaBarras = function (renderer, camera, hpList, zoom) {
    if (!UN.barras) return 0; const B = UN.barras; let n = 0; const tm = R.time; const z = Math.max(0.6, zoom || 1); const hz = Math.max(0, Math.min(2, Math.round((z - 1.6) * 0.6)));
    for (let i = 0; i < hpList.length && n < CAP_BAR; i++) { const h = hpList[i]; const fr = Math.max(0, Math.min(1, h.frac));
      let d = h.id != null ? dano.get(h.id) : null; if (!d && h.id != null) { d = { f: fr, lag: fr, t: -99, v: tm }; dano.set(h.id, d); }
      let fr2 = fr, pis = 0; if (d) { const dt = Math.max(0, Math.min(0.25, tm - d.v)); if (fr < d.f - 1e-4) { if (tm - d.t > 0.7) d.lag = Math.max(d.lag, d.f); d.t = tm; } else if (fr > d.f + 1e-4) d.lag = fr; /* dano: o rastro começa na vida de antes; cura: sem rastro */
        d.f = fr; const ag = tm - d.t; if (ag > 0.45) d.lag -= dt * 0.7; if (d.lag < fr) d.lag = fr; fr2 = d.lag; pis = Math.max(0, 1 - ag / 1.1); d.v = tm; } /* o rastro desce 0,7 da vida por s depois de 0,45 s sem golpe */
      const w = Math.max(16, h.w * z); E[0] = Math.round(w / 2) * 2; E[1] = (h.unit ? 5 : 6) + hz; /* de perto a barra engorda até 2 px */ E[2] = fr; E[3] = fr2; E[4] = segs(h); E[5] = K.vet ? (h.rank || 0) : 0; E[6] = pis;
      let fl = (h.foe ? 1 : 0) + (h.sel ? 2 : 0); const pt = h.id != null ? promo.get(h.id) : null; if (pt != null && tm - pt < 1.2) fl += 0.49 * (1 - (tm - pt) / 1.2); E[7] = fl;
      E[8] = 0; E[9] = 0; E[10] = 0; E[11] = 0; E[12] = h.x; E[13] = H(h.x, h.y) + h.z; E[14] = -h.y; E[15] = 1; B.setMatrixAt(n, _e);
      const pl = sim && h.owner != null ? sim.players[h.owner] : null; const hex = h.foe && foeCor ? null : (pl ? pl.color : '#7FE3A1'); if (hex) { _c.set(hex); _c.convertLinearToSRGB(); } else { _c.copy(foeCor); _c.convertLinearToSRGB(); } B.setColorAt(n, _c); n++; }
    if (R.warming && n === 0) { E.fill(0); E[0] = 40; E[1] = 5; E[2] = 0.5; E[3] = 0.7; E[4] = 4; E[5] = 2; E[12] = camera.position.x; E[13] = camera.position.y - 50; E[14] = camera.position.z; E[15] = 1; B.setMatrixAt(0, _e); B.setColorAt(0, BRANCO); n = 1; } /* aquecimento: o pipeline nasce na carga */
    B.count = n; B.visible = n > 0; if (!n) return 0; B.sobe(n, false);
    renderer.getDrawingBufferSize(_dbs); U.tela.value.set(R.w || 1280, R.h || 720, (_dbs.x || R.w) / Math.max(1, R.w || 1), 0);
    const tmA = renderer.toneMapping, cs = renderer.outputColorSpace, ac = renderer.autoClear; renderer.toneMapping = Tm.NoToneMapping; renderer.outputColorSpace = Tm.LinearSRGBColorSpace; renderer.autoClear = false;
    try { renderer.render(UN.cenaHud, camera); } finally { renderer.toneMapping = tmA; renderer.outputColorSpace = cs; renderer.autoClear = ac; }
    if ((podaT += 1) > 300) { podaT = 0; for (const [id, v] of dano) if (tm - v.v > 6) dano.delete(id); for (const [id, t0] of promo) if (tm - t0 > 3) promo.delete(id); }
    return n;
  };
  /* por quadro, antes do laço das entidades: partida, quem é inimigo, a cor de inimigo e a força de cada efeito pela qualidade */
  UN.quadro = function (s, hum, foe, fc, q) {
    sim = s; human = hum; foeP = foe; if (fc) { if (!foeCor || UN._fc !== fc) { UN._fc = fc; foeCor = new Tm.Color(fc).multiplyScalar(1.15); } } else foeCor = null;
    U.tempo.value = R.time; const nv = !q || TOQUE ? 0 : q.resolved === 'baixa' ? 0 : q.resolved === 'media' ? 1 : 2;
    const F = U5.forca; /* medida e fotos: ARD.m5.unidades.forca = { mat2: 0|1, contorno: 0…1 } força o valor sem recarregar */
    U.contorno.value = F && F.contorno != null ? F.contorno : K.contorno ? (nv === 0 ? 0 : nv === 1 ? 0.75 : 1) : 0; U.mat2.value = F && F.mat2 != null ? F.mat2 : K.mat2 && nv > 0 ? 1 : 0;
    U.k2.value.set(K.desgaste ? 1 : 0, K.cavidade ? 1 : 0, K.sujeira ? 1 : 0, K.contato ? 1 : 0);
    U5.mapaChao(s);
  };
  UN.codigoTime = U5.codigoTime; UN.contorno = !!K.contorno;
  let turretU = null; UN.ehUnidade = function (def) { const S = ARD.sim, MD = ARD.models; if (S && S.UNITS && S.UNITS[def]) return true; if (!turretU) { turretU = new Set(); if (S && MD && MD.PARTS) for (const d in S.UNITS) { const pp = MD.PARTS[d]; if (pp && pp.turret) turretU.add(pp.turret); } } return turretU.has(def); }; /* a torreta das unidades também leva o contorno */
  U5.ultimo = UN; /* medidas (work/ab-quadro.cjs) */
  return UN;
};
})(globalThis.ARD = globalThis.ARD || {});
