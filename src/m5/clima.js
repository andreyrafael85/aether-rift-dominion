/* Aether Rift: Dominion — Motor 5 (5.0d): clima simulado na GPU e o chão que guarda a batalha (TSL: WGSL no WebGPU, GLSL na reserva WebGL2).
   Tudo visual: a simulação (src/sim.js) e o determinismo não mudam; os presets de clima continuam os mesmos (CLIMATES do src/render3d.js).
   - Clima: partículas num compute shader (posição e velocidade em storage), que caem com vento e turbulência, batem no relevo (mapa de alturas
     do chão numa textura) e pousam, respingam ou somem; um desenho só para todas (flocos, riscos de chuva e areia, respingos, brasas e esporos).
     Bancos de neblina em camadas que seguem o relevo suavizado e engrossam nos vales. Neve, cinza, areia e molhado cobrem o chão, os adereços e
     o alto das peças (máscara pela normal e um acúmulo que cresce na partida). Chuva: chão escuro, poças com o céu refletido (barato, no próprio
     material do chão) e, na Alta e na Ultra, o reflexo de tela nas poças (um passe do pós, meia resolução).
   - Batalha (toda partida): crateras que afundam o chão pelo mapa de cicatrizes (deslocamento no vértice, sem refazer a malha), borda de terra
     levantada, mato queimado em volta do queimado, flocos de cinza no carvão, adereços queimados e pegadas da infantaria na neve e na areia.
   Pipelines: o clima só existe na partida que tem clima (o compute, o desenho das partículas, a neblina quando há, o reflexo quando há); a
   batalha só muda o código do chão e dos adereços (nenhum pipeline novo). Tudo nasce na carga (cena e M5.pendentes), nada por quadro.
   Chaves de URL: ?clima5=0 (volta aos flocos antigos), ?marcas5=0 (sem as camadas da batalha), ?reflexo=0, ?acumulo=0|1, ?climaN=<partículas>. */
(function (ARD) {
'use strict';
const M5 = ARD.m5 = ARD.m5 || {};
const QS = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
const T = () => window.THREE_M5, L = () => window.TSL;
const LIGADO = QS.get('clima5') !== '0', BATALHA = QS.get('marcas5') !== '0', REFLEXO = QS.get('reflexo') !== '0';
const ACUM = QS.get('acumulo'); /* '1': tudo coberto desde o início (fotos); '0': nada acumula */

/* ---------- o visual novo de cada preset (os presets em si não mudam) ----------
   tipos: até três tipos de partícula por clima, cada um com a fração do total (f), o movimento K = [vy, vento, turbulência, rente ao chão],
   o jeito L = [tempo pousada (s), tamanho, alfa, forma (0 floco, 1 risco, 2 brilho, 3 floco que cintila)], M = [vida máxima (s), risco (s), brilho]
   e a cor. cobre: quanto o chão e as peças ficam cobertos no fim (neve, cinza, areia, molhado). neblina: bancos em camadas. */
const VISUAL = {
  cristais: { nome: 'neve de cristais', vento: [15, -5],
    tipos: [{ f: 0.82, K: [-24, 0.45, 7, 0], L: [3.0, 0.85, 0.8, 0], M: [0, 0, 0], cor: [0.92, 0.95, 1.0] }, { f: 0.18, K: [-20, 0.45, 8, 0], L: [3.0, 0.7, 0.95, 3], M: [0, 0, 1.6], cor: [0.78, 0.93, 1.0] }],
    chao: [0.95, 0, 0, 0], peca: [0.55, 0, 0, 0] }, /* 5.0d.1: peças 0,8 → 0,55 (a cor do time aparece) */
  aurora: { nome: 'neve fina e neblina fria', vento: [8, 4],
    tipos: [{ f: 1, K: [-14, 0.55, 5, 0], L: [2.0, 0.6, 0.7, 0], M: [0, 0, 0], cor: [0.9, 0.95, 1.0] }],
    chao: [0.4, 0, 0, 0], peca: [0.3, 0, 0, 0], neblina: { cor: [0.6, 0.78, 0.8], dens: 0.2, alturas: [3, 6, 9], deriva: 0.6, noite: 0.05 } }, /* 5.0d.1: véu baixo e ralo (antes 0,36 em 10/26/46: cobria as unidades) */
  acida: { nome: 'chuva', vento: [6, -2],
    tipos: [{ f: 1, K: [-240, 0.12, 2, 0], L: [0.3, 0.24, 0.22, 1], M: [0, 0.038, 0], cor: [0.7, 0.8, 0.66] }],
    chao: [0, 0, 0, 1], peca: [0, 0, 0, 1], reflexo: true },
  plasma: { nome: 'tempestade de areia e cinza', vento: [24, -8],
    tipos: [{ f: 0.42, K: [-10, 1.0, 6, 0], L: [1.2, 0.9, 0.75, 0], M: [0, 0, 0], cor: [0.32, 0.3, 0.29] }, { f: 0.2, K: [26, 0.65, 14, 0], L: [0, 0.45, 1.0, 2], M: [4.5, 0, 2.6], cor: [1.0, 0.42, 0.12] },
      { f: 0.38, K: [0, 2.6, 4, 7], L: [0, 0.45, 0.32, 1], M: [3.5, 0.1, 0], cor: [0.72, 0.56, 0.38] }],
    chao: [0, 0.75, 0.65, 0], peca: [0, 0.3, 0.4, 0], neblina: { cor: [0.66, 0.5, 0.34], dens: 0.24, alturas: [3, 6, 9], deriva: 2.2, noite: 0, limiar: 0.18 } }, /* 5.0d.1: antes 0,42 em 6/18/34 */
  toxica: { nome: 'névoa tóxica', vento: [9, -3],
    tipos: [{ f: 1, K: [-3, 0.55, 9, 0], L: [3.0, 0.7, 0.8, 2], M: [0, 0, 0.9], cor: [0.55, 0.95, 0.35] }],
    chao: [0, 0, 0, 0.3], peca: [0, 0, 0, 0.2], neblina: { cor: [0.45, 0.62, 0.28], dens: 0.28, alturas: [3, 6, 9], deriva: 0.5, noite: 0.12 } }, /* 5.0d.1: antes 0,5 em 8/22/40 */
};
/* 5.0d.1: o "Automático (pelo bioma)" com clima leve, só visual: o mapa decide (Cinturão → cinza fina; na Fenda, gelo ≥ 30% → neve fina,
   tundra ≥ 28% → chuva leve, senão poeira de areia: o deserto de rocha é o maior bioma de quase todo mapa). Poucas partículas finas, sem neblina,
   cobertura discreta (leve: tinge, não cobre), sem poças nem reflexo; nada na Baixa e no celular. ?climaauto=0 desliga */
const AUTO = {
  neve: { nome: 'automático: neve fina (gelo)', leve: true, vento: [7, 3], tipos: [{ f: 1, K: [-12, 0.5, 4, 0], L: [1.5, 0.45, 0.5, 0], M: [0, 0, 0], cor: [0.92, 0.95, 1.0] }], chao: [0.12, 0, 0, 0], peca: [0.12, 0, 0, 0] }, /* geada: no fim do acúmulo clareia o chão em volta das unidades ~10% */
  chuva: { nome: 'automático: chuva leve (tundra)', leve: true, poca: false, vento: [5, -2], tipos: [{ f: 1, K: [-220, 0.12, 2, 0], L: [0.25, 0.2, 0.16, 1], M: [0, 0.03, 0], cor: [0.75, 0.82, 0.9] }], chao: [0, 0, 0, 0.3], peca: [0, 0, 0, 0.3] },
  areia: { nome: 'automático: poeira de areia (deserto de rocha)', leve: true, vento: [16, -6], tipos: [{ f: 1, K: [0, 2.2, 3, 5], L: [0, 0.35, 0.16, 1], M: [3, 0.08, 0], cor: [0.74, 0.6, 0.42] }], chao: [0, 0, 0.12, 0], peca: [0, 0, 0.1, 0] },
  cinza: { nome: 'automático: cinza fina (Cinturão)', leve: true, vento: [6, 2], tipos: [{ f: 1, K: [-7, 0.8, 5, 0], L: [1.0, 0.5, 0.42, 0], M: [0, 0, 0], cor: [0.4, 0.38, 0.37] }], chao: [0, 0.12, 0, 0], peca: [0, 0.06, 0, 0] },
};
const AUTO_N = [0, 1024, 2048, 3072]; /* partículas do automático por nível (0 = Baixa e celular: nada) */
const AUTO_LIGADO = QS.get('climaauto') !== '0';
/* partículas e camadas por nível: 0 Baixa e celular (o mais barato), 1 Média, 2 Alta, 3 Ultra */
const NIVEL = [{ n: 1536, camadas: 1 }, { n: 4096, camadas: 2 }, { n: 12288, camadas: 3 }, { n: 20480, camadas: 3 }];

const C = M5.clima = { VISUAL, AUTO, vis: null, nome: null, nivel: 1, ativo: false, montado: false, pipes: 0, N: 0, nAtivo: 0, U: null };

/* ---------- uniforms do clima (criados uma vez, compartilhados por todos os materiais) ---------- */
function init() {
  if (C.U) return C.U; const Tm = T(), { texture, renderGroup } = L(); M5.shared && M5.shared();
  /* 5.0d: no grupo da chamada de render (um bloco só, igual para todos os objetos). No grupo por objeto (o padrão), os objetos que dividem o
     material dividem também as cópias do bloco na CPU (o clone do r186 copia a referência): um valor igual para todos só subia para o primeiro
     objeto desenhado depois da mudança (o chão divide o material com o paredão da Fenda e não recebia a cobertura) */
  const uniform = v => L().uniform(v).setGroup(renderGroup);
  const blank = M5.blank || ((r, g, b, a) => { const t = new Tm.DataTexture(new Uint8Array([r, g, b, a]), 1, 1); t.needsUpdate = true; return t; });
  C.U = {
    cobreChao: uniform(new Tm.Vector4(0, 0, 0, 0)),   /* neve, cinza, areia, molhado no chão (0…1) */
    cobrePeca: uniform(new Tm.Vector4(0, 0, 0, 0)),   /* o mesmo no alto das peças e nos adereços */
    vento: uniform(new Tm.Vector4(1, 0, 10, 0)),      /* direção (x, z do three), velocidade, rajada */
    dens: uniform(1),                                 /* intensidade do clima no momento (as rajadas variam) */
    nivel: uniform(1),                                /* 0 Baixa e celular … 3 Ultra (ramos uniformes: o mesmo código em toda qualidade) */
    cratera: uniform(1),                              /* profundidade das crateras (0 na Baixa e no celular) */
    alt: texture(blank(0, 0, 0, 255)),                /* mapa de alturas do chão (R altura, G altura suavizada), meia precisão */
    altK: uniform(new Tm.Vector4(1 / 6000, 0, 6000, 0)), /* uv = (x·k + o, −z·k + o): k = 1/(HS·HN), o = 0,5/HN; z = tamanho do mapa */
  };
  return C.U;
}
C.init = init;

/* ---------- escolha (R.setClimate, antes da carga): o visual, o nível e se o pós precisa do reflexo ---------- */
C.escolher = function (nome, cfg, R, toque) {
  const v = LIGADO && cfg ? VISUAL[nome] || null : null; const antes = !!(C.vis && C.vis.reflexo && C.reflexoNivel());
  C.autoPend = !!(LIGADO && AUTO_LIGADO && !cfg && !toque); /* 5.0d.1: o automático decide na montagem, pelo mapa */
  C.vis = v; C.nome = v ? nome : null; C.cfg = cfg || null; C.R = R; C.toque = !!toque;
  const q = R && R.quality ? (R.quality.resolved || R.quality.name) : 'media'; C.nivel = toque || q === 'baixa' ? 0 : q === 'ultra' ? 3 : q === 'alta' ? 2 : 1;
  if (C.autoPend && C.nivel < 1) C.autoPend = false; /* 5.0d.1: Baixa: nada */
  C.ativo = !!v; const U = init(); U.nivel.value = C.nivel; U.cratera.value = C.nivel > 0 && !toque ? 1 : 0;
  return antes !== !!(C.vis && C.vis.reflexo && C.reflexoNivel()); /* true: o render3d refaz o pós (o reflexo entra ou sai) */
};
C.reflexoNivel = () => REFLEXO && !C.toque && C.nivel >= 2;
C.qualidade = function (R, toque) { const q = R.quality.resolved || R.quality.name; C.nivel = toque || q === 'baixa' ? 0 : q === 'ultra' ? 3 : q === 'alta' ? 2 : 1; if (C.U) { C.U.nivel.value = C.nivel; C.U.cratera.value = C.nivel > 0 && !toque ? 1 : 0; } };

/* ---------- utilidades TSL ---------- */
const mapUV = p => { const { vec2 } = L(); return vec2(p.x.div(M5.u.mundo), p.z.negate().div(M5.u.mundo)); };
const altUV = (x, z, K) => { const k = K || C.U.altK, { vec2 } = L(); return vec2(x.mul(k.x).add(k.y), z.negate().mul(k.x).add(k.y)); };
const chaoEm = (x, z, K) => C.U.alt.sample(altUV(x, z, K)).level(0);
const dentroMapa = gp => { const { step } = L(); const W = C.U.altK.z; return step(-2.0, gp.x).mul(step(gp.x, W.add(2.0))).mul(step(-2.0, gp.y)).mul(step(gp.y, W.add(2.0))); }; /* 1 no mapa, 0 nas mesas de fora */ /* r: altura, g: suavizada (nível explícito: vale em compute, vértice e ramos) */
let POCA = null; /* poças: o mesmo desenho no chão e no reflexo do pós (ruído de nuvem em duas escalas) */
const poca = (gp, lvl, a1) => { const { vec2, smoothstep, clamp } = L(); const nz = M5.tex.nuvem; const vale = a1 ? clamp(a1.g.sub(a1.r).mul(0.025), -0.08, 0.12) : 0; const a = nz.sample(gp.div(330).add(vec2(0.37, 0.11))).setUpdateMatrix(false), b = nz.sample(gp.div(130).add(vec2(0.71, 0.29))).setUpdateMatrix(false);
  const A = lvl ? a.level(0) : a, B = lvl ? b.level(0) : b; return smoothstep(0.52, 0.63, A.r.mul(0.62).add(B.r.mul(0.38)).add(vale)); };
/* ondas da chuva nas poças: um anel por célula de 3,2 unidades, cada um na sua fase (hash), devolve a inclinação (x, z) */
const ondas = (gp, t) => { const { floor, fract, vec2, length, sin, smoothstep, float, hash, max, uint } = L();
  const s = gp.div(3.2); const c = floor(s), f = fract(s).sub(0.5); const id = max(c.x, 0.0).add(max(c.y, 0.0).mul(4096.0)).toUint(); const h = hash(id), h2 = hash(id.add(uint(16777259))); /* hash do TSL trunca para inteiro: a célula vira um id exato */
  const ph = fract(t.mul(0.85).add(h)); const o = vec2(h.sub(0.5), h2.sub(0.5)).mul(0.5); const d = f.sub(o); const r = length(d); const rr = ph.mul(0.55);
  const amp = float(1).sub(ph).mul(float(1).sub(ph)).mul(float(1).sub(smoothstep(0.0, 0.14, max(r.sub(rr), rr.sub(r))))); const w = sin(r.sub(rr).mul(36.0)).mul(amp);
  return d.div(max(r, 0.001)).mul(w); };

/* ---------- ganchos do chão (src/m5/terreno.js chama na montagem; o corpo decide na compilação, depois da escolha do clima) ---------- */
const G = M5.ganchos = M5.ganchos || { modelo: { posicao: null, superficie: null, emissivo: null }, chao: { cor: null }, adereco: { posicao: null } };
G.chao = G.chao || {}; G.adereco = G.adereco || {}; G.modelo = G.modelo || {};
const corAntes = G.chao.cor;
G.chao.cor = function (ctx) {
  const nc = corAntes ? corAntes(ctx) : null; if (nc) ctx.alb.assign(nc);
  const TL = L(); const { float, vec2, vec3, mix, smoothstep, clamp, max, dot, pow, If, normalize, cameraPosition, positionWorld, sin } = TL; const U = init(); const MU = M5.u;
  const { alb, rough, hgt, tEmis, sc, Bw, gp, slope, soft, Ap, As, pw } = ctx; if (!alb || !rough || !hgt) return null; const k = dentroMapa(gp); /* dentro do mapa (as mesas do horizonte ficam de fora); o uFora do chão não entra: usado também no vértice, ele duplicava no bloco do objeto e o fragmento lia um valor parado */
  /* batalha: mato queimado em volta do queimado (capim seco, marrom), flocos de cinza no carvão, borda levantada e terra revolvida na cratera */
  if (BATALHA && sc) { const g = sc.g, b = sc.b;
    const seco = smoothstep(0.02, 0.16, g).mul(float(1).sub(smoothstep(0.22, 0.6, g))).mul(k); const veg = clamp(Bw.z.add(Bw.y.mul(0.35)).add(Bw.x.mul(0.12)), 0.0, 1.0);
    alb.assign(mix(alb, vec3(0.3, 0.215, 0.11).mul(soft.mul(0.4).add(0.75)), seco.mul(veg).mul(0.6)));
    const car = smoothstep(0.25, 0.85, g).mul(k); alb.addAssign(vec3(0.2, 0.19, 0.18).mul(smoothstep(0.62, 0.86, Ap.g).mul(car).mul(0.4)));
    const borda = smoothstep(0.0, 0.08, b).mul(float(1).sub(smoothstep(0.1, 0.32, b))).mul(k); hgt.addAssign(borda.mul(0.55));
    alb.mulAssign(float(1).sub(smoothstep(0.15, 0.7, b).mul(0.32).mul(k))); rough.assign(mix(rough, 0.97, smoothstep(0.15, 0.7, b).mul(k))); }
  const V = C.vis; if (!V) return null;
  const CC = U.cobreChao; const plano = float(1).sub(smoothstep(0.04, 0.32, slope)); let trS = null; const tr0 = sc ? sc.r.mul(k) : float(0), bu = sc ? sc.g : float(0), quente = sc ? sc.a : float(0);
  const var0 = soft.mul(0.55).add(As.r.mul(0.45)); /* variação larga (o macio e a ondulação grande do chão) */
  if (sc && (V.chao[0] > 0 || V.chao[2] > 0)) { const X = M5.tex.cicatrizes, uv0 = mapUV(pw), e = float(4.5).div(M5.u.mundo); const r = (du, dv) => X.sample(uv0.add(vec2(du, dv))).setUpdateMatrix(false).r;
    trS = r(e, e).add(r(e.negate(), e)).add(r(e, e.negate())).add(r(e.negate(), e.negate())).mul(0.25).mul(k); } /* na neve e na areia, a trilha borrada em ~1,5 texel: o desenho da esteira (1,7 unidade) é mais fino que o texel do mapa na Média e, com o contraste da neve, serrilhava em quadradinhos */
  const tr = trS ? trS : tr0;
  const cobre = (q, lim, inv) => V.leve ? q.mul(plano).mul((inv ? float(1).sub(var0) : var0).mul(0.6).add(0.4)) /* 5.0d.1: automático leve: no máximo a fração do acúmulo, sem cobrir */ : clamp(q.mul(1.35).sub(float(1).sub(plano).mul(lim)).sub((inv ? var0 : float(1).sub(var0)).mul(inv ? 0.9 : 0.42)).mul(2.2), 0.0, 1.0); /* sobe com o acúmulo, primeiro no plano e no macio (inv: nas manchas do outro lado da variação) */
  if (V.chao[0] > 0) { /* neve: cobre o plano, derrete no queimado quente, as trilhas abrem até o chão e as pegadas afundam */
    const cr = sc ? sc.b : float(0); const c0 = cobre(CC.x, 1.1).mul(k).mul(float(1).sub(smoothstep(0.3, 0.9, quente))).mul(float(1).sub(smoothstep(0.3, 0.8, bu).mul(0.9))).mul(float(1).sub(smoothstep(0.08, 0.45, cr))); /* derrete no queimado e na cratera */
    const c = c0.mul(float(1).sub(tr.mul(0.82)));
    const neve = mix(vec3(0.6, 0.67, 0.8), vec3(0.86, 0.9, 0.96), soft.mul(0.5).add(Ap.a.mul(0.3)).add(0.2));
    alb.assign(mix(alb, neve, c)); rough.assign(mix(rough, 0.78, c)); hgt.assign(mix(hgt, hgt.mul(0.15).add(soft.mul(0.1)), c)); /* a neve alisa o relevo fino (fica um pouco das dunas por baixo) */
    hgt.addAssign(tr.mul(c0).mul(-0.95)); alb.assign(mix(alb, alb.mul(vec3(0.7, 0.8, 1.04)), tr.mul(c0).mul(0.55))); }
  if (V.chao[1] > 0) { /* cinza vulcânica: camada fosca no plano, flocos claros, trilhas mostram o chão */
    const c = cobre(CC.y, 1.0, true).mul(k).mul(float(1).sub(tr.mul(0.7))).mul(float(1).sub(smoothstep(0.3, 0.9, quente)));
    const cinza = mix(vec3(0.1, 0.095, 0.092), vec3(0.2, 0.19, 0.18), Ap.g.mul(0.6).add(soft.mul(0.4)));
    alb.assign(mix(alb, cinza, c.mul(0.9))); rough.assign(mix(rough, 0.96, c)); hgt.assign(mix(hgt, hgt.mul(0.55), c)); }
  if (V.chao[2] > 0) { /* areia: dunas a favor do vento nas baixadas e no plano, ondulação perpendicular ao vento, pegadas e trilhas */
    const vp = vec2(U.vento.y.negate(), U.vento.x); const rip = sin(dot(gp, vp).mul(2.4).add(soft.mul(9.0)).add(As.r.mul(5.0))).mul(0.5).add(0.5);
    const c0 = cobre(CC.z.mul(0.85), 0.9).mul(k).mul(smoothstep(-6.0, 10.0, chaoEm(pw.x, pw.z).g.sub(pw.y)).mul(0.6).add(0.4)); const c = c0.mul(float(1).sub(tr.mul(0.35))); /* mais nas baixadas */
    const areia = mix(vec3(0.5, 0.38, 0.24), vec3(0.72, 0.57, 0.38), rip.mul(0.35).add(soft.mul(0.45)).add(0.1));
    alb.assign(mix(alb, areia, c.mul(0.85))); rough.assign(mix(rough, 0.93, c)); hgt.assign(mix(hgt, rip.mul(0.22).add(soft.mul(0.08)), c));
    hgt.addAssign(tr.mul(c0).mul(-0.6)); alb.mulAssign(float(1).sub(tr.mul(c0).mul(0.22))); }
  if (V.chao[3] > 0) { /* molhado: solo escuro e mais liso; poças (planas, quase espelho) com o céu refletido e as ondas da chuva */
    const w = CC.w.mul(k); const esc = mix(float(1), float(0.72), w.mul(soft.oneMinus().mul(0.35).add(0.65)).mul(float(1).sub(Bw.z.mul(0.5)))); /* 5.0d.1: o chão molhado escurece no máximo 28% (antes 50%) */ /* o capim escurece menos que a terra e a areia */ alb.assign(alb.mul(esc).mul(mix(vec3(1), vec3(0.96, 0.98, 1.04), w))); rough.assign(mix(rough, rough.mul(0.5), w)); /* solo molhado: mais escuro, um pouco mais frio e liso */
    if (V.poca !== false) { /* 5.0d.1: a chuva leve do automático não faz poça */
    const pd = poca(gp, false, chaoEm(pw.x, pw.z)).mul(smoothstep(0.55, 1.0, plano)).mul(w).toVar('ardPoca');
    alb.mulAssign(mix(float(1), float(0.5), pd)); /* 5.0d.1: antes 0,28 */ rough.assign(mix(rough, 0.04, pd));
    const rp = vec2(0).toVar('ardOnda'); If(U.nivel.greaterThan(0.5).and(U.dens.greaterThan(0.05)), () => { rp.assign(ondas(gp, MU.tempo).mul(U.dens)); });
    hgt.assign(mix(hgt, rp.x.add(rp.y).mul(0.07), pd));
    const fr = pow(float(1).sub(clamp(dot(ctx.wn || vec3(0, 1, 0), normalize(cameraPosition.sub(positionWorld))), 0.0, 1.0)), 5.0).mul(0.7).add(0.22); /* Fresnel da água (com o céu claro sobre o solo escuro, a poça brilha mais que a conta física) (normal da geometria: a normal final do chão monta depois da cor) */
    tEmis.addAssign(MU.ceuCor.mul(pd).mul(fr).mul(0.75)); } }
  return null;
};
/* crateras: o chão afunda pelo canal b do mapa de cicatrizes (tigela) e levanta a borda (5 amostras no vértice: o mapa é mais fino que a malha) */
G.chao.posicao = function (ctx) {
  if (!BATALHA) return null; const { Fn, If, vec2, vec4, float, smoothstep, positionLocal, modelWorldMatrix } = L(); const U = init();
  return Fn((b) => { if (!(b && b.renderer && b.renderer.backend && b.renderer.backend.isWebGPUBackend)) return positionLocal; /* na reserva WebGL2 a cratera fica só no relevo fino (a amostra no vértice gerava avisos de atributo uv na montagem) */ const p = positionLocal.toVar('ardCratP');
    If(U.cratera.greaterThan(0.0), () => { const w = modelWorldMatrix.mul(vec4(p, 1)).xyz; const Wm = U.altK.z; const uv = vec2(w.x.div(Wm), w.z.negate().div(Wm)); const e = float(9.0).div(Wm); const X = M5.tex.cicatrizes; /* o tamanho do mapa pelo bloco do clima: um uniform do bloco por objeto usado também no vértice entra duas vezes no bloco e o fragmento lia uma cópia parada */
      const s = (du, dv) => X.sample(uv.add(vec2(du, dv))).level(0).setUpdateMatrix(false).b;
      const b = s(0, 0).mul(0.4).add(s(e, e).add(s(e.negate(), e)).add(s(e, e.negate())).add(s(e.negate(), e.negate())).mul(0.15));
      const borda = smoothstep(0.0, 0.08, b).mul(float(1).sub(smoothstep(0.1, 0.32, b)));
      const dy = b.mul(-6.0).add(borda.mul(1.6)).mul(U.cratera).mul(dentroMapa(vec2(w.x, w.z.negate()))); p.y.addAssign(dy); });
    return p; })();
};
/* adereços: queimados no queimado (folhagem quase preta, rocha encardida) e a mesma cobertura do alto das peças */
G.adereco.cor = function (ctx) {
  const m = ctx.m, o = ctx.o || {}; const sdc = m.setupDiffuseColor;
  m.setupDiffuseColor = function (b) { sdc.call(this, b); const { diffuseColor, positionWorld, smoothstep, mix, vec3, float } = L();
    if (BATALHA) { const sc = M5.tex.cicatrizes.sample(mapUV(positionWorld)).setUpdateMatrix(false); const car = smoothstep(0.18, 0.62, sc.g).mul(o.leaf ? 0.92 : 0.62);
      const fk = ctx.fv ? mix(float(0.06), float(1.0), ctx.fv) : float(1); diffuseColor.rgb.assign(mix(diffuseColor.rgb, vec3(0.032, 0.027, 0.024).mul(fk), car)); }
    camadaPeca(diffuseColor, ctx.fv, o.leaf ? 0.75 : 1); };
  rugPeca(m);
};
/* modelos (unidades e construções): depois do detalhe de superfície do src/m5/modelos.js */
const supAntes = G.modelo.superficie;
G.modelo.superficie = function (ctx) { if (supAntes) supAntes(ctx); if (ctx.emissivo) return; const m = ctx.m; const sdc = m.setupDiffuseColor;
  m.setupDiffuseColor = function (b) { sdc.call(this, b); camadaPeca(L().diffuseColor, null, 1); }; rugPeca(m); };
/* a cobertura das peças: neve e cinza no alto (normal para cima, com ruído), areia a barlavento e no alto, molhado escurece; a rugosidade segue (rugPeca) */
let PK = null; /* as máscaras desta montagem (o setupDiffuseColor monta antes da rugosidade, como o detalhe de superfície dos modelos) */
function camadaPeca(dc, fv, k0) {
  PK = null; const V = C.vis; if (!V) return; const { float, vec3, mix, smoothstep, clamp, dot, normalWorld, positionWorld, Var } = L(); const U = init(); const P = U.cobrePeca;
  const n = normalWorld; const nz = M5.vnoise2(positionWorld.xz.mul(0.45)).sub(0.5); const fk = fv ? mix(float(0.06), float(1.0), fv) : float(1); const K = { neve: null, cinza: null, areia: null, molhado: null };
  if (V.peca[0] > 0) { K.neve = Var(smoothstep(0.38, 0.8, n.y.add(nz.mul(0.4))).mul(P.x).mul(k0), 'ardNeveP'); dc.rgb.assign(mix(dc.rgb, vec3(0.84, 0.88, 0.94).mul(fk), K.neve.mul(0.7))); /* 5.0d.1: 0,9 → 0,7 */ }
  if (V.peca[1] > 0) { K.cinza = Var(smoothstep(0.32, 0.8, n.y.add(nz.mul(0.45))).mul(P.y).mul(k0), 'ardCinzaP'); dc.rgb.assign(mix(dc.rgb, vec3(0.26, 0.25, 0.24).mul(fk), K.cinza.mul(0.7))); /* 5.0d.1: cinza clara (antes 0,13 × 0,85: escurecia as unidades) */ }
  if (V.peca[2] > 0) { const bar = smoothstep(0.1, 0.7, dot(n.xz, vec3(U.vento.x, 0, U.vento.y).xz.negate())); K.areia = Var(clamp(bar.mul(0.55).add(smoothstep(0.5, 0.9, n.y).mul(0.45)).add(nz.mul(0.3)), 0.0, 1.0).mul(P.z).mul(k0), 'ardAreiaP'); dc.rgb.assign(mix(dc.rgb, vec3(0.62, 0.48, 0.32).mul(fk), K.areia.mul(0.75))); }
  if (V.peca[3] > 0) { K.molhado = Var(P.w.mul(k0), 'ardMolhadoP'); dc.rgb.mulAssign(mix(float(1), float(0.86), K.molhado)); /* 5.0d.1: antes 0,62 */ }
  PK = K;
}
function rugPeca(m) {
  const r0 = m.roughnessNode; if (!r0) return; const { Fn, mix, float } = L();
  m.roughnessNode = Fn(() => { let r = r0; const K = PK; if (!K) return r; if (K.neve) r = mix(r, float(0.78), K.neve); if (K.cinza) r = mix(r, float(0.96), K.cinza); if (K.areia) r = mix(r, float(0.92), K.areia); if (K.molhado) r = r.mul(mix(float(1), float(0.35), K.molhado)); return r; })();
}

/* o mapa de cicatrizes da partida (src/m5/texturas.js) fica guardado para as ferramentas de teste marcarem o chão (C.marcas.burn / track) */
const scarsAntes = M5.scars; if (scarsAntes) M5.scars = function () { const o = scarsAntes.apply(this, arguments); C.marcas = o; return o; };
/* ---------- pegadas: a infantaria marca a neve e a areia (o clima cobre, ou o bioma é gelo ou deserto) ---------- */
C.pegadas = function (x, y) {
  const V = C.vis; if (V && (V.chao[0] > 0 || V.chao[1] > 0 || V.chao[2] > 0)) return true;
  const T0 = C.terr; if (!T0 || !T0.bio) return false; const HN = T0.HN, HS = T0.HS; const ix = Math.max(0, Math.min(HN - 1, Math.round(x / HS))), iy = Math.max(0, Math.min(HN - 1, Math.round(y / HS))); const i = (iy * HN + ix) * 4; const b = T0.bio;
  const t = b[i] + b[i + 1] + b[i + 2] + b[i + 3] || 1; return (b[i] + b[i + 1] * 0.8) / t > 0.45;
};

/* ---------- montagem na carga (finishTerrain): mapa de alturas, partículas e neblina na cena; o compute vai para M5.pendentes ---------- */
C.montar = function (o) {
  const X = o.X, scene = o.scene; C.terr = o.terr || null; C.camera = o.camera; C.H = o.H; init();
  if (o.heights && o.HN) alturas(o.heights, o.HN, o.HS, o.W);
  if (C.autoPend && !C.vis && !C.montado) { const t = autoTipo(o.sim || (C.R && C.R.sim)); if (t) { C.vis = AUTO[t]; C.nome = 'auto-' + t; C.ativo = true; } C.autoPend = false; } /* 5.0d.1 */
  if (!C.vis || C.montado || !X) return; C.montado = true; C.X = X; const V = C.vis, U = C.U;
  const vn = Math.hypot(V.vento[0], V.vento[1]) || 1; U.vento.value.set(V.vento[0] / vn, -V.vento[1] / vn, vn, 0); /* o vento do preset: x do mapa → x do three; y do mapa → −z */
  const nq = NIVEL[C.nivel]; const N = Math.max(256, Math.min(32768, (+(QS.get('climaN') || 0) || (V.leve ? AUTO_N[C.nivel] : nq.n)))) & ~63; C.N = N; C.nAtivo = N; { const sm = o.sim || (C.R && C.R.sim); C.t0 = sm ? sm.time : 0; } /* 5.0d.1: o automático leve tem a sua conta; o acúmulo segue o relógio do jogo */
  particulas(N, o.H, o.cam); scene.add(C.malha);
  if (V.neblina) { neblina(nq.camadas); scene.add(C.nevoa); }
  const r = X.renderer; if (X.isWebGPU && r.compileComputeAsync && M5.pendentes) M5.pendentes.push(() => r.compileComputeAsync([C.kernel])); /* na reserva WebGL2 o compute nasce no 1º passo, ainda no aquecimento (R.warming) */ /* o compute nasce na carga, junto com os outros pipelines */
  acumulo(0, true);
};
/* 5.0d.1: o visual do automático pelo mapa (só leitura da simulação: a fração de cada bioma nos tiles de chão) */
function autoTipo(sim) {
  const S = ARD.sim; if (!sim || !sim.biome || !S) return null; if (sim.map && sim.map.type === 'cinturao') return 'cinza';
  const w = [0, 0, 0, 0]; const n = sim.biome.length, TL = Math.round(Math.sqrt(n)), TI = S.WORLD / TL; let t = 0;
  for (let i = 0; i < n; i++) { if (S.mapCell && sim.map) { const x = (i % TL + 0.5) * TI, y = (Math.floor(i / TL) + 0.5) * TI; if (S.mapCell(sim, x, y) !== 1) continue; } const m = sim.biomeMix[i] || 0; w[sim.biome[i]] += 1 - m; w[sim.biome2[i]] += m; t++; }
  if (!t) return null; C.biomas = w.map(v => +(v / t).toFixed(3)); return w[0] / t >= 0.3 ? 'neve' : w[2] / t >= 0.28 ? 'chuva' : 'areia';
}
/* mapa de alturas do chão (R) e suavizado em ~150 unidades (G), meia precisão, para o compute, a neblina e o reflexo */
function alturas(h, HN, HS, W) {
  const Tm = T(); const n = HN * HN, R = 8; const a = new Float32Array(n), b = new Float32Array(n);
  for (let y = 0; y < HN; y++) { let s = 0, c = 0; for (let x = -R; x <= R; x++) { const xx = Math.max(0, Math.min(HN - 1, x)); s += h[y * HN + xx]; c++; } for (let x = 0; x < HN; x++) { a[y * HN + x] = s / c; const xo = Math.max(0, Math.min(HN - 1, x - R)), xi = Math.max(0, Math.min(HN - 1, x + R + 1)); s += h[y * HN + xi] - h[y * HN + xo]; } }
  for (let x = 0; x < HN; x++) { let s = 0, c = 0; for (let y = -R; y <= R; y++) { const yy = Math.max(0, Math.min(HN - 1, y)); s += a[yy * HN + x]; c++; } for (let y = 0; y < HN; y++) { b[y * HN + x] = s / c; const yo = Math.max(0, Math.min(HN - 1, y - R)), yi = Math.max(0, Math.min(HN - 1, y + R + 1)); s += a[yi * HN + x] - a[yo * HN + x]; } }
  const d = new Uint16Array(n * 2); const toH = Tm.DataUtils.toHalfFloat; for (let i = 0; i < n; i++) { d[i * 2] = toH(h[i]); d[i * 2 + 1] = toH(b[i]); }
  const t = new Tm.DataTexture(d, HN, HN, Tm.RGFormat, Tm.HalfFloatType); t.minFilter = t.magFilter = Tm.LinearFilter; t.wrapS = t.wrapT = Tm.ClampToEdgeWrapping; t.colorSpace = Tm.NoColorSpace; t.name = 'ard-clima-alturas'; t.needsUpdate = true;
  if (C.altTex) C.altTex.dispose(); C.altTex = t; C.U.alt.value = t; C.U.altK.value.set(1 / (HS * HN), 0.5 / HN, W || HS * (HN - 1), 0);
}

/* ---------- partículas: compute (P = posição + relógio, V = velocidade + semente) e um desenho só ---------- */
function particulas(N, H, cam) {
  const Tm = T(), TL = L(); const { Fn, If, float, uint, vec2, vec3, vec4, uniform, instancedArray, instanceIndex, select, mix, smoothstep, clamp, max, min, abs, sin, cos, exp, floor, length, normalize, cross, hash, pow, varying, positionGeometry, cameraPosition, cameraProjectionMatrix, cameraViewMatrix, Discard } = TL;
  const V = C.vis, U = C.U; const tp = V.tipos; const f0 = tp[0].f, f1 = tp[0].f + (tp[1] ? tp[1].f : 0);
  const K = [0, 1, 2].map(i => uniform(new Tm.Vector4().fromArray((tp[i] || tp[0]).K))), Lk = [0, 1, 2].map(i => uniform(new Tm.Vector4().fromArray((tp[i] || tp[0]).L))), Mk = [0, 1, 2].map(i => { const m = (tp[i] || tp[0]).M; return uniform(new Tm.Vector4(m[0], m[1], m[2], 0)); }), Ck = [0, 1, 2].map(i => uniform(new Tm.Color().fromArray((tp[i] || tp[0]).cor)));
  const P = { vento: uniform(new Tm.Vector4(1, 0, 10, 0)), altK: uniform(new Tm.Vector4(1 / 6000, 0, 6000, 0)), dt: uniform(0), t: uniform(0), caixa: uniform(new Tm.Vector4(3000, -3000, 900, 900)), topo: uniform(320), n: uniform(new Tm.Vector4(f0 * N, f1 * N, N, N)), K, Lk, Mk, Ck };
  C.P = P;
  /* estado inicial na CPU (sem um compute de início: um pipeline a menos): espalhadas na caixa da câmera, do chão até o topo */
  const pa = new Float32Array(N * 4), va = new Float32Array(N * 4); const cx = cam ? cam.x : 3000, cy = cam ? cam.y : 3000;
  for (let i = 0; i < N; i++) { const ti = i < f0 * N ? 0 : i < f1 * N ? 1 : 2; const t0 = tp[ti] || tp[0]; const x = cx + (Math.random() * 2 - 1) * 900, y = cy + (Math.random() * 2 - 1) * 900; const g = H ? H(x, y) : 0;
    const alt = t0.K[3] > 0 ? g + t0.K[3] * (0.2 + Math.random()) : t0.K[0] > 0 ? g + 1 + Math.random() * 200 : g + 2 + Math.random() * 318;
    pa[i * 4] = x; pa[i * 4 + 1] = alt; pa[i * 4 + 2] = -y; pa[i * 4 + 3] = Math.random() * 2; va[i * 4] = t0.K[1] * U.vento.value.x * U.vento.value.z; va[i * 4 + 1] = t0.K[0]; va[i * 4 + 2] = t0.K[1] * U.vento.value.y * U.vento.value.z; va[i * 4 + 3] = Math.floor(Math.random() * 16777216); } /* semente inteira (o hash do TSL trunca) */
  const PB = instancedArray(N, 'vec4'), VB = instancedArray(N, 'vec4'); PB.value.array.set(pa); VB.value.array.set(va); PB.value.needsUpdate = true; VB.value.needsUpdate = true;
  const sel = (fi, A) => select(fi.lessThan(P.n.x), A[0], select(fi.lessThan(P.n.y), A[1], A[2]));
  /* compute: um passo por quadro */
  C.kernel = Fn(() => { const i = instanceIndex; const fi = float(i); const p = PB.element(i).toVar('cp'), v = VB.element(i).toVar('cv');
    const k = sel(fi, K).toVar('ck'), lk = sel(fi, Lk).toVar('cl'), mk = sel(fi, Mk).toVar('cm'); const s = v.w.toVar('cs'); const su = s.toUint().toVar('csu'); const qd = P.t.mul(13.0).floor().toUint().toVar('cqd'); const fa = vec3(hash(su.add(uint(19))), hash(su.add(uint(23))), hash(su.add(uint(29)))).mul(6.2831853).toVar('cfa'); /* fases da turbulência (a semente é grande demais para entrar no seno) */ /* semente inteira (exata até 2^24) e o número do passo */ const dt = P.dt; const cx0 = P.caixa.x, cz0 = P.caixa.y, hx = P.caixa.z, hz = P.caixa.w;
    const nasce = Fn(([s2]) => { const h1 = hash(s2), h2 = hash(s2.add(uint(1))), h3 = hash(s2.add(uint(2))); const x = cx0.add(h1.mul(2).sub(1).mul(hx)), z = cz0.add(h2.mul(2).sub(1).mul(hz)); const g = chaoEm(x, z, P.altK).r;
      const y = select(k.w.greaterThan(0), g.add(k.w.mul(h3.add(0.2))), select(k.x.greaterThan(0), g.add(1).add(h3.mul(12)), g.add(P.topo.mul(h3.mul(0.28).add(0.72)))));
      return vec3(x, y, z); });
    const alvo = vec3(P.vento.x.mul(P.vento.z).mul(k.y), k.x.mul(hash(su.add(uint(11))).mul(0.4).add(0.8)), P.vento.y.mul(P.vento.z).mul(k.y)).add(vec3(sin(P.t.mul(0.73).add(fa.x).add(p.z.mul(0.011))), sin(P.t.mul(0.51).add(fa.y)).mul(0.35), cos(P.t.mul(0.67).add(fa.z).add(p.x.mul(0.013)))).mul(k.z)).toVar('calvo'); /* variável no topo: os dois ramos do If usam */
    If(p.w.greaterThanEqual(0), () => { /* no ar */
      v.xyz.assign(mix(v.xyz, alvo, float(1).sub(exp(dt.mul(-2.2))))); p.xyz.addAssign(v.xyz.mul(dt)); p.w.addAssign(dt);
      const g = chaoEm(p.x, p.z, P.altK).r.toVar('cg');
      If(k.w.greaterThan(0), () => { p.y.assign(mix(p.y, g.add(k.w.mul(hash(su.add(uint(13))).add(0.2))), clamp(dt.mul(3.0), 0, 1))); }); /* rente ao chão (areia) */
      /* volta para dentro da caixa da câmera (a câmera anda: a chuva anda junto, sem buraco) */
      p.x.assign(cx0.add(p.x.sub(cx0).add(hx).sub(floor(p.x.sub(cx0).add(hx).div(hx.mul(2))).mul(hx.mul(2)))).sub(hx));
      p.z.assign(cz0.add(p.z.sub(cz0).add(hz).sub(floor(p.z.sub(cz0).add(hz).div(hz.mul(2))).mul(hz.mul(2)))).sub(hz));
      If(p.y.lessThan(g), () => { p.y.assign(g.add(0.15)); p.w.assign(lk.x.mul(hash(su.add(qd)).mul(0.8).add(0.6)).negate().sub(0.0001)); }); /* bateu no relevo: pousa ou respinga */
      If(p.y.greaterThan(g.add(P.topo.mul(1.15))).or(mk.x.greaterThan(0).and(p.w.greaterThan(mk.x.mul(hash(su.add(uint(17))).mul(0.5).add(0.75))))), () => { p.w.assign(-0.0001); }); /* subiu demais ou viveu o bastante */
    }).Else(() => { p.w.addAssign(dt); If(p.w.greaterThanEqual(0), () => { p.xyz.assign(nasce(su.add(qd.mul(uint(2654435761))))); p.w.assign(0); v.xyz.assign(alvo); }); }); /* pousada: fica um pouco e renasce */
    PB.element(i).assign(p); VB.element(i).assign(v); })().compute(N, [64]);
  C.kernel.name = 'ard-clima-compute';
  /* desenho: quadrado instanciado, posição no vértice pelo estado do compute (atributo por instância nos dois motores) */
  const ga = PB.toAttribute(), gv = VB.toAttribute(); const q = positionGeometry.xy; const fi = float(instanceIndex);
  const k = sel(fi, K), lk = sel(fi, Lk), mk = sel(fi, Mk), ck = sel(fi, Ck); const s = gv.w; const forma = lk.w;
  const su = s.toUint(); const vis = hash(su.add(uint(3))).lessThan(U.dens).and(fi.lessThan(P.n.w)); const pousada = ga.w.lessThan(0);
  const c = ga.xyz; const tam = max(lk.y.mul(hash(su.add(uint(7))).mul(0.6).add(0.7)), length(cameraPosition.sub(c)).mul(0.0009)); /* pelo menos ~1 pixel */
  const vC = cameraViewMatrix.mul(vec4(c, 1)); const bb = cameraProjectionMatrix.mul(vec4(vC.xyz.add(vec3(q.x.mul(tam).mul(2), q.y.mul(tam).mul(2), 0)), 1));
  const dir = normalize(gv.xyz.add(vec3(0, -1e-4, 0))); const vel = length(gv.xyz); const comp = max(vel.mul(mk.y), tam.mul(2)); const tc = normalize(cameraPosition.sub(c)); const lado = normalize(cross(dir, tc)); const larg = max(tam, length(cameraPosition.sub(c)).mul(0.0007));
  const pR = c.add(dir.mul(q.y.mul(comp))).add(lado.mul(q.x.mul(larg).mul(2))); const prog = clamp(float(1).add(ga.w.div(max(lk.x, 0.01))), 0, 1);
  const rr = prog.mul(2.6).add(0.6); const pS = c.add(vec3(q.x.mul(rr).mul(2), 0.25, q.y.mul(rr).mul(2)));
  const risco = abs(forma.sub(1)).lessThan(0.5); const fRisco = select(risco, float(1), float(0)), fPouso = select(pousada, float(1), float(0)), fVis = select(vis, float(1), float(0)); /* pesos escalares: na reserva WebGL2 o select aninhado de vetores (o respingo dentro do risco) quebrava a montagem do vértice */
  const clip = mix(bb, cameraProjectionMatrix.mul(cameraViewMatrix).mul(vec4(mix(pR, pS, fPouso), 1)), fRisco);
  const m = new Tm.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, depthTest: true, side: Tm.DoubleSide, blending: Tm.CustomBlending, blendEquation: Tm.AddEquation, blendSrc: Tm.OneFactor, blendDst: Tm.OneMinusSrcAlphaFactor, blendEquationAlpha: Tm.AddEquation, blendSrcAlpha: Tm.ZeroFactor, blendDstAlpha: Tm.OneFactor }); m.fog = false; m.forceSinglePass = true;
  m.vertexNode = mix(vec4(2, 2, 2, 1), clip, fVis); /* fora da tela quando a partícula não aparece (rajada mais fraca ou acima da conta da qualidade) */
  const aPouso = select(pousada, select(risco, float(1).sub(prog).mul(0.9), clamp(ga.w.negate().div(max(lk.x, 0.01)).mul(1.6), 0, 1)), float(1)); /* respingo apaga crescendo; floco pousado some devagar */
  const vQ = varying(q.mul(2), 'vcQ'), vA = varying(lk.z.mul(aPouso), 'vcA'), vF = varying(select(pousada.and(risco), float(4), forma), 'vcF'), vC2 = varying(ck, 'vcC'), vG = varying(vec2(mk.z, hash(su.add(uint(31))).mul(6.2831853)), 'vcG');
  const MU = M5.u;
  m.fragmentNode = Fn(() => { const r = length(vQ); const luz = MU.ceuCor.mul(0.55).add(MU.solCor.mul(float(0.75).mul(float(1).sub(MU.noite.mul(0.7))))).add(MU.raio.mul(1.5));
    const fl = exp(r.mul(r).mul(-3.2)).sub(0.04).max(0.0); /* floco macio */ const ri = float(1).sub(vQ.x.mul(vQ.x)).mul(vQ.y.mul(0.3).add(0.7)); const an = smoothstep(0.55, 0.8, r).mul(float(1).sub(smoothstep(0.85, 1.0, r))); const br = exp(r.mul(r).mul(-4.0));
    const a = select(vF.lessThan(0.5), fl, select(vF.lessThan(1.5), ri, select(vF.lessThan(2.5), br, select(vF.lessThan(3.5), fl, an)))).mul(vA); /* sem Discard nem variável num bloco: na reserva WebGL2 o r186 não acha a pilha da variável dentro do If (erro de TSL e nenhuma partícula); com alfa 0 a mistura pré-multiplicada não soma nada */
    const cint = pow(sin(MU.tempo.mul(9.0).add(vG.y.mul(9.0))).mul(0.5).add(0.5), 16.0).mul(vG.x).mul(select(vF.greaterThan(2.5).and(vF.lessThan(3.5)), float(1), float(0))); /* o floco de cristal cintila */
    const brilho = select(vF.greaterThan(1.5).and(vF.lessThan(2.5)), float(1), float(0)); /* brasa e esporo: luz própria, somada */
    const ab = mix(a, pow(a, 2.2), MU.semPos ? MU.semPos : float(0)); const corLuz = vC2.mul(luz).add(vec3(cint)); const corBr = vC2.mul(vG.x).mul(sin(MU.tempo.mul(11.0).add(vG.y.mul(17.0))).mul(0.25).add(0.75));
    return select(brilho.greaterThan(0.5), vec4(corBr.mul(ab), 0), vec4(corLuz.mul(a), a)); })();
  M5.registrar('clima-particulas', m);
  const pg = new Tm.PlaneGeometry(1, 1); const g = new Tm.InstancedBufferGeometry(); g.index = pg.index; g.setAttribute('position', pg.attributes.position); g.setAttribute('uv', pg.attributes.uv); g.instanceCount = N; g.name = 'ard-clima';
  const me = new Tm.Mesh(g, m); me.frustumCulled = false; me.castShadow = false; me.receiveShadow = false; me.renderOrder = 11; me.name = 'clima-particulas'; C.malha = me; C.geo = g;
}

/* ---------- bancos de neblina: camadas em grade que seguem o relevo suavizado, mais densas nos vales, com o ruído de nuvem à deriva ---------- */
function neblina(camadas) {
  const Tm = T(), TL = L(); const { Fn, float, vec2, vec3, vec4, uniform, instanceIndex, select, mix, smoothstep, max, abs, length, varying, positionGeometry, cameraPosition, cameraProjectionMatrix, cameraViewMatrix, Discard, If } = TL;
  const V = C.vis, U = C.U, NB = V.neblina, MU = M5.u; const nz = M5.tex.nuvem;
  const B = C.B = { centro: uniform(new Tm.Vector4(3000, -3000, 2200, 0)), cor: uniform(new Tm.Color().fromArray(NB.cor)), dens: uniform(NB.dens), alt: uniform(new Tm.Vector4(NB.alturas[0], NB.alturas[1], NB.alturas[2], 0)), deriva: uniform(new Tm.Vector2()), noite: uniform(NB.noite), lim: uniform(NB.limiar != null ? NB.limiar : 0.32) };
  const li = float(instanceIndex); const hL = select(li.lessThan(0.5), B.alt.x, select(li.lessThan(1.5), B.alt.y, B.alt.z)); const gx = B.centro.x.add(positionGeometry.x.mul(B.centro.z)), gz = B.centro.y.add(positionGeometry.y.mul(B.centro.z));
  const a0 = chaoEm(gx, gz); const y = max(a0.g.add(hL), a0.r.add(4)); const wp = vec3(gx, y, gz);
  const m = new Tm.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, depthTest: true, side: Tm.DoubleSide, blending: Tm.CustomBlending, blendEquation: Tm.AddEquation, blendSrc: Tm.OneFactor, blendDst: Tm.OneMinusSrcAlphaFactor, blendEquationAlpha: Tm.AddEquation, blendSrcAlpha: Tm.ZeroFactor, blendDstAlpha: Tm.OneFactor }); m.fog = false; m.forceSinglePass = true;
  m.vertexNode = cameraProjectionMatrix.mul(cameraViewMatrix).mul(vec4(wp, 1));
  const vW = varying(wp, 'vnW'), vE = varying(vec3(positionGeometry.x, positionGeometry.y, li), 'vnE');
  m.fragmentNode = Fn(() => { const xz = vec2(vW.x, vW.z.negate()); const n1 = nz.sample(xz.div(680).add(B.deriva.mul(0.6))).setUpdateMatrix(false).r; const n2 = nz.sample(xz.div(240).add(B.deriva).add(vec2(n1.mul(0.2), 0.37))).setUpdateMatrix(false).r;
    const a1 = chaoEm(vW.x, vW.z); const d = smoothstep(B.lim, 0.82, n1.mul(0.6).add(n2.mul(0.4)).add(vE.z.mul(0.04)));
    const vale = smoothstep(-15.0, 30.0, a1.g.sub(a1.r)).mul(0.6).add(0.4); const solo = smoothstep(0.0, 14.0, vW.y.sub(a1.r)); const borda = float(1).sub(smoothstep(0.3, 0.5, max(abs(vE.x), abs(vE.y))));
    const perto = smoothstep(60.0, 260.0, length(cameraPosition.sub(vW))); const a = d.mul(vale).mul(solo).mul(borda).mul(perto).mul(B.dens).mul(U.dens.mul(0.4).add(0.6)); /* idem: sem Discard */
    const luz = MU.ceuCor.mul(0.7).add(MU.solCor.mul(float(0.45).mul(float(1).sub(MU.noite.mul(0.75))))).add(MU.raio.mul(0.8)); const c = B.cor.mul(luz).add(B.cor.mul(B.noite).mul(MU.noite));
    return vec4(c.mul(a), a); })();
  M5.registrar('clima-neblina', m);
  const pg = new Tm.PlaneGeometry(1, 1, 40, 40); const g = new Tm.InstancedBufferGeometry(); g.index = pg.index; g.setAttribute('position', pg.attributes.position); g.setAttribute('uv', pg.attributes.uv); g.instanceCount = camadas; g.name = 'ard-clima-neblina';
  const me = new Tm.Mesh(g, m); me.frustumCulled = false; me.castShadow = false; me.receiveShadow = false; me.renderOrder = -1; me.name = 'clima-neblina'; /* 5.0d.1: antes dos anéis de seleção, do inimigo e dos efeitos (eles ficam por cima) */ C.nevoa = me; C.nevoaGeo = g; C.camadas = camadas;
}

/* ---------- reflexo de tela nas poças (Alta e Ultra, só com chuva): src/m5/pos.js chama na cadeia, depois da oclusão e antes da bruma ----------
   As poças são planas: a normal é a do céu (para cima) com as ondas da chuva, então o raio refletido sai da profundidade e da câmera, sem um passe
   de normais (o SSRNode do r186 pede a normal da cena num alvo à parte: todo material da cena passaria a escrever dois alvos). Um passe em meia
   resolução (três quartos na Ultra): de 20 a 32 passos na tela, com espessura; acerto = a cor da cena naquele ponto, com Fresnel e borda da tela. */
C.reflexo = function (c, color, depth, camera, q) {
  if (!C.vis || !C.vis.reflexo || !C.reflexoNivel() || !C.U) return null;
  const Tm = T(), TL = L(); const { Fn, If, Loop, Break, float, int, uint, uvec2, vec2, vec3, vec4, uniform, uv, mix, smoothstep, clamp, max, min, abs, dot, pow, normalize, reflect, hash, getViewPosition, getScreenPosition, rtt, screenCoordinate } = TL;
  const U = C.U, MU = M5.u; const S = C.S || (C.S = { proj: uniform(new Tm.Matrix4()), projInv: uniform(new Tm.Matrix4()), vista: uniform(new Tm.Matrix4()), mundo: uniform(new Tm.Matrix4()), passos: uniform(24) });
  C.cam = camera; S.passos.value = C.nivel >= 3 ? 32 : 20;
  const f = Fn(() => { const u = uv(); const d = depth.sample(u).r.toVar('rd'); const out = vec4(0).toVar('ro');
    If(d.lessThan(0.99999), () => { const vp = getViewPosition(u, d, S.projInv).toVar('rvp'); const wp = S.mundo.mul(vec4(vp, 1)).xyz.toVar('rwp'); const gp = vec2(wp.x, wp.z.negate());
      const a0 = chaoEm(wp.x, wp.z); const e = float(18.0); const ax = chaoEm(wp.x.add(e), wp.z).r, az = chaoEm(wp.x, wp.z.sub(e)).r; const gr = vec2(ax.sub(a0.r), az.sub(a0.r)).div(e);
      const plano = float(1).sub(smoothstep(0.04, 0.32, float(1).sub(float(1).div(dot(gr, gr).add(1).sqrt())))); const chao = float(1).sub(smoothstep(1.5, 5.0, abs(wp.y.sub(a0.r))));
      const pd = poca(gp, true, a0).mul(smoothstep(0.55, 1.0, plano)).mul(chao).mul(U.cobreChao.w).toVar('rpd');
      If(pd.greaterThan(0.02), () => { const on = ondas(gp, MU.tempo).mul(U.dens).mul(0.07); const nW = normalize(vec3(on.x.negate(), 1, on.y)); const nV = normalize(S.vista.mul(vec4(nW, 0)).xyz).toVar('rnv');
        const vd = normalize(vp).toVar('rvd'); const r = normalize(reflect(vd, nV)).toVar('rr'); const ac = float(0).toVar('rac'), cor = vec3(0).toVar('rcor');
        const j = hash(uvec2(screenCoordinate.xy).x.add(uvec2(screenCoordinate.xy).y.mul(uint(4096))).add(MU.tempo.mul(30.0).toUint().mul(uint(2654435761)))); const dist = vp.z.negate();
        const passo = max(dist.mul(0.012), 3.0).toVar('rps');
        Loop({ start: int(0), end: int(32), type: 'int', condition: '<' }, ({ i }) => { const fi = float(i); If(fi.greaterThanEqual(S.passos), () => { Break(); });
          const t = fi.add(j).mul(passo).mul(fi.mul(0.12).add(1.0)); const p = vp.add(r.mul(t)).toVar('rp'); If(p.z.greaterThan(-1.0), () => { Break(); });
          const su = getScreenPosition(p, S.proj).toVar('rsu'); If(su.x.lessThan(0).or(su.x.greaterThan(1)).or(su.y.lessThan(0)).or(su.y.greaterThan(1)), () => { Break(); });
          const ds = depth.sample(su).level(0).r; const sz = getViewPosition(su, ds, S.projInv).z; const dz = sz.sub(p.z);
          If(dz.greaterThan(0.0).and(dz.lessThan(passo.mul(2.2).add(t.mul(0.04)))).and(ds.lessThan(0.99999)), () => { cor.assign(color.sample(su).level(0).rgb);
            const bd = smoothstep(0.0, 0.08, min(min(su.x, float(1).sub(su.x)), min(su.y, float(1).sub(su.y)))); ac.assign(bd.mul(float(1).sub(fi.div(S.passos)))); Break(); }); });
        const fr = pow(float(1).sub(clamp(dot(vd.negate(), nV), 0.0, 1.0)), 5.0).mul(0.6).add(0.4);
        out.assign(vec4(cor, pd.mul(ac).mul(fr).mul(0.85))); }); });
    return out; })();
  const rt = rtt(f, null, null, { resolutionScale: C.nivel >= 3 ? 0.75 : 0.5 }); rt.renderTarget.texture.name = 'ard-reflexo-tela'; C.rt = rt;
  return vec4(mix(c.rgb, rt.rgb, clamp(rt.a, 0.0, 1.0)), c.a);
};

/* ---------- acúmulo: o chão já começa meio coberto (o clima vem de antes da partida) e cobre em ~3,5 min; as peças chegam limpas e cobrem em ~2,5 min ---------- */
let TACUM = 0;
function acumulo(dt, zera) {
  const V = C.vis, U = C.U; if (!V || !U) return; if (zera) TACUM = 0; TACUM += dt; const f = ACUM === '1' ? 1 : ACUM === '0' ? 0 : null;
  if (C.R && C.R.sim && C.t0 != null) TACUM = Math.max(0, C.R.sim.time - C.t0); /* 5.0d.1: o acúmulo segue o relógio da partida (pausa para, velocidade 2× acumula 2×) */
  if (C.forca) { U.cobreChao.value.fromArray(C.forca); U.cobrePeca.value.fromArray(C.forca); return; } /* ferramentas de teste: cobertura fixa (antes e depois na mesma carga) */
  const c = f != null ? f : Math.min(1, 0.4 + TACUM / 360), pm = f != null ? f : Math.min(1, TACUM / 150), pw = f != null ? f : Math.min(1, TACUM / 25);
  U.cobreChao.value.set(V.chao[0] * c, V.chao[1] * c, V.chao[2] * c, V.chao[3] * (f != null ? f : 1)); U.cobrePeca.value.set(V.peca[0] * pm, V.peca[1] * pm, V.peca[2] * pm, V.peca[3] * pw);
}

/* ---------- por quadro (R.draw): caixa da câmera, vento e rajadas, acúmulo, um passo do compute e os uniforms do reflexo ---------- */
C.quadro = function (dt, cam, camera, R) {
  if (!C.ativo || !C.montado) return; const X = C.X, U = C.U, P = C.P; if (!X || !P) return; const d = Math.max(0, Math.min(0.1, dt || 0)); const t = R.time;
  const zf = Math.max(0.6, cam.zoom || 1); const hx = 900 / zf; P.caixa.value.set(cam.x, -cam.y, hx, hx);
  const g0 = C.H ? C.H(cam.x, cam.y) : 0; P.topo.value = Math.max(110, Math.min(420, (camera.position.y - g0) * 0.6)); P.dt.value = d; P.t.value = t;
  const V = C.vis; const rj = 1 + 0.35 * Math.sin(t * 0.13) + 0.15 * Math.sin(t * 0.37); const an = Math.atan2(-V.vento[1], V.vento[0]) + 0.3 * Math.sin(t * 0.021); U.vento.value.set(Math.cos(an), Math.sin(an), Math.hypot(V.vento[0], V.vento[1]) * rj, rj);
  U.dens.value = Math.max(0.35, Math.min(1, 0.8 + 0.2 * Math.sin(t * 0.045) + 0.1 * Math.sin(t * 0.17)));
  const quer = +(QS.get('climaN') || 0) ? C.N : Math.min(C.N, V.leve ? (AUTO_N[C.nivel] || 64) : NIVEL[C.nivel].n); C.nAtivo = Math.max(64, quer & ~63); P.n.value.w = C.nAtivo; C.geo.instanceCount = C.nAtivo; /* a qualidade pode baixar no meio da partida: menos partículas, o mesmo pipeline */
  acumulo(d, false); P.vento.value.copy(U.vento.value); P.altK.value.copy(U.altK.value); /* cópias para o compute (grupo próprio) */
  if (C.nevoa) { const B = C.B; const hb = 1100 / zf; const cel = hb * 2 / 40; B.centro.value.set(Math.round(cam.x / cel) * cel, Math.round(-cam.y / cel) * cel, hb * 2, 0); B.deriva.value.set(U.vento.value.x * t * U.vento.value.z * 0.0009 * V.neblina.deriva, -U.vento.value.y * t * U.vento.value.z * 0.0009 * V.neblina.deriva); C.nevoaGeo.instanceCount = Math.min(C.camadas, NIVEL[C.nivel].camadas); }
  if (C.S && C.cam) { const c = C.cam; C.S.proj.value.copy(c.projectionMatrix); C.S.projInv.value.copy(c.projectionMatrixInverse); C.S.vista.value.copy(c.matrixWorldInverse); C.S.mundo.value.copy(c.matrixWorld); }
  if (d > 0 || R.warming || !C.uma) { C.uma = true; X.renderer.compute(C.kernel, C.nAtivo); }
};
})(globalThis.ARD = globalThis.ARD || {});
