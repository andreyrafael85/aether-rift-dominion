/* Aether Rift: Dominion — armas na tela (4.3g).
   Traçantes, projéteis, feixes, clarões de boca e impactos por Raça e por arma. O render3d chama, em coordenadas do mundo three
   (y para cima, z = -y do mapa):
   - CB.shot(o)    a cada disparo: o = { weapon, faction, cls, beam, from: [x, y, z], to: [x, y, z], owner, id, ambush }
   - CB.impact(o)  impacto de projétil: o = { weapon, faction, at: [x, y, z], splash, hit }
   - CB.proj(o)    a cada quadro, cada projétil visível: o = { id, weapon, faction, at: [x, y, z], vel: [vx, vy, vz] (unid./s), arc }
   - CB.channel(o) feixes contínuos (sifão, devorar), a cada quadro enquanto durarem: o = { kind: 'sifao' | 'devorar', faction, from, to }
   - CB.frame(dt, time, camera) uma vez por quadro, depois de tudo: fecha as contagens das instâncias e a vida dos feixes
   Ambiente (env): FX (partículas na GPU da 4.2c: FX.emit, FX.explosion, FX.fire...), flash(x, y, r, col, k, life, flicker) — clarão
   que ilumina o chão e as malhas, em coordenadas do MAPA (x, y = -z do mundo) —, quality() → { particles } e H(x, y) = altura do
   terreno no mapa. Tudo aditivo e em HDR (o bloom da cadeia de cinema faz o brilho).
   4.3g — como desenha: duas famílias de primitivas instanciadas com shader próprio (núcleo quente + halo, HDR para o bloom):
   FITAS (segmento que encara a câmera, com largura mínima em pixels para ler no zoom 1: traçantes, feixes, arcos elétricos, ondas,
   chama, rastros) e SPRITES (cabeças de projétil, clarões de boca, anéis, golpes). Cada família tem um lote DINÂMICO (reescrito a cada
   quadro: projéteis em arco e canais) e um lote ENVELHECIDO NA GPU (anel circular: a CPU escreve só no nascimento; o shader anda,
   cresce e apaga pelo relógio). São 4 chamadas de desenho para o combate inteiro e 2 programas de shader, compilados na criação;
   nada é alocado por tiro nem por quadro. Fumaça, faíscas, brasas, gotas, esporos e explosões vão pelas partículas do env.FX.
   Balas (traçantes): o sim anda 10 vezes por segundo e uma bala vive 0 a 2 passos (o ferrão nasce e acerta no mesmo passo), então a
   bala na tela voa pela GPU desde o disparo, da boca da arma até o alvo, na velocidade da arma; o impacto espera ela chegar.
   Projéteis em arco (obus) seguem a posição do sim a cada quadro (altura suavizada entre os passos, saída na boca da arma). */
(function (ARD) {
'use strict';
/* 4.3g: paleta HDR por Raça. a = cor da arma, b = núcleo quente, g = brilho, s = faísca, l = luz no chão */
const PAL = {
  vehnar:  { a: [2.6, 1.2, 0.34], b: [2.8, 2.05, 1.05], g: [2.1, 0.75, 0.18], s: [2.2, 1.15, 0.4], l: [1.6, 0.8, 0.3] },
  erevane: { a: [0.3, 1.85, 1.5], b: [1.3, 2.5, 2.25], g: [0.22, 1.25, 1.05], s: [0.9, 2.2, 2.0], l: [0.3, 1.1, 0.95] },
  tessara: { a: [0.8, 2.1, 0.4], b: [2.5, 1.7, 0.45], g: [0.55, 1.5, 0.28], s: [1.7, 1.75, 0.4], l: [0.8, 1.35, 0.35] },
  quorith: { a: [1.5, 0.8, 2.8], b: [2.3, 2.1, 3.0], g: [1.0, 0.55, 2.1], s: [1.9, 1.5, 2.8], l: [1.0, 0.6, 1.7] },
  vorag:   { a: [1.3, 2.25, 0.2], b: [2.1, 2.6, 0.85], g: [0.95, 1.75, 0.12], s: [1.4, 2.1, 0.3], l: [0.85, 1.45, 0.2] },
};
const BONE = [1.5, 1.32, 1.0], BLOOD = [1.7, 0.2, 0.24], EGG = [2.0, 0.42, 0.45], FLESH = [0.36, 0.06, 0.07], BRASS = [0.34, 0.25, 0.1], SOOT = [0.1, 0.09, 0.085], DUST = [0.42, 0.37, 0.31];
const SPORE = [0.2, 0.27, 0.1], HAZE = [0.18, 0.24, 0.09], ACIDK = [0.2, 0.25, 0.09], CHIP = [0.5, 0.46, 0.38], DEVL = [1.2, 0.2, 0.2], WELD = [2.5, 1.75, 0.65], WHITE = [1, 1, 1];
const STYLE = {}; for (const f in PAL) { const p = PAL[f]; STYLE[f] = { tracer: p.a, slug: p.b, beam: p.a, muzzle: p.b, impact: p.s }; } /* compatível com a primeira 4.3g */

/* 4.3g: arsenal — como cada arma de cada Raça aparece. t = forma (bala: traçante; obus: projétil em arco; arco, tendao, sonico,
   prisma, helice, chama, lamina, mordida, chifre: feixes instantâneos), mz = clarão de boca, imp = impacto, tr = rastro de partículas.
   Bala: c cor, wd meia largura, len cauda, I força, spd velocidade na tela, hs/hz/hc/hI cabeça (estilo do sprite, tamanho, cor, força),
   asp alongamento, burst rajada extra, sp dispersão (bala) ou espaço entre partículas do rastro, gap intervalo da rajada.
   Obus: rib/rw/rI fita do rastro, ring anéis, boom escala da explosão, pr/pk luz em voo, dbl canhão duplo. lr/lk luz da boca no chão. */
const DIALETO = {
  vehnar: { bala: { c: PAL.vehnar.a, wd: 0.85, len: 26, I: 1.2, hs: -1 }, obus: { hs: 0, hz: 2.6, hI: 1.5, hc: PAL.vehnar.b, c: PAL.vehnar.a, rib: 40, rw: 1.3, rI: 0.9, tr: 'fumaca', sp: 4, asp: 0 }, mz: 'forja', ib: 'faisca', is: 'forja', pulso: 'arco' },
  erevane: { bala: { c: PAL.erevane.a, wd: 0.42, len: 20, I: 1.0, hs: -1 }, obus: { hs: 0, hz: 2.2, hI: 1.5, hc: PAL.erevane.b, c: PAL.erevane.a, rib: 55, rw: 0.9, rI: 1.0, tr: '', sp: 0, asp: 1.8 }, mz: 'veu', ib: 'teal', is: 'plasma', pulso: 'arco' },
  tessara: { bala: { c: PAL.tessara.a, wd: 0.55, len: 14, I: 0.95, hs: 7, hz: 1.7, hI: 1.25, hc: PAL.tessara.b, tr: 'esporo', sp: 9, sol: 1 }, obus: { sol: 1, hs: 7, hz: 3.4, hI: 1.45, hc: PAL.tessara.b, c: PAL.tessara.a, rib: 30, rw: 1.1, rI: 0.7, tr: 'esporo', sp: 4.5, asp: 0 }, mz: 'seiva', ib: 'seiva', is: 'esporo', pulso: 'tendao' },
  quorith: { bala: { c: PAL.quorith.a, wd: 0.48, len: 18, I: 1.05, hs: 3, hz: 1.6, hI: 1.3, hc: PAL.quorith.b, asp: 3 }, obus: { hs: 0, hz: 2.6, hI: 1.6, hc: PAL.quorith.b, c: PAL.quorith.a, rib: 36, rw: 1.0, rI: 0.95, tr: 'aneis', sp: 17, asp: 0, ring: 1 }, mz: 'cristal', ib: 'estilhaco', is: 'ressonancia', pulso: 'arco' },
  vorag: { bala: { c: PAL.vorag.a, wd: 0.42, len: 12, I: 0.8, hs: 3, hz: 1.45, hI: 1.0, hc: BONE, asp: 3, sol: 1 }, obus: { sol: 1, hs: 4, hz: 3.2, hI: 1.25, hc: PAL.vorag.a, c: PAL.vorag.a, rib: 24, rw: 1.0, rI: 0.6, tr: 'gotas', sp: 5, asp: 0 }, mz: 'cuspe', ib: 'acido', is: 'acido', pulso: 'tendao' },
};
const RLIST = [];
function bala(f, o) { const d = DIALETO[f]; return Object.assign({ t: 'bala', mz: d.mz, ms: 3, imp: d.ib, lr: 14, lk: 0.8, burst: 0, sp: 4, gap: 0.05, spd: 760, hs: -1, hz: 1, hI: 1, hc: PAL[f].b, asp: 0, tr: '' }, d.bala, o || {}); }
function obus(f, o) { const d = DIALETO[f]; return Object.assign({ t: 'obus', mz: d.mz, ms: 6, imp: d.is, boom: 1, lr: 26, lk: 1.5, pr: 16, pk: 0.4, ring: 0, dbl: 0, epic: 0, halo: null }, d.obus, o || {}); }
const ARS = {};
for (const f in DIALETO) { const d = DIALETO[f], p = PAL[f];
  ARS[f] = { fuzil: bala(f), metralha: bala(f, { burst: 2, sp: 5, ms: 2.8, wd: d.bala.wd * 0.92, len: d.bala.len * 0.9 }),
    ferrao: bala(f, { wd: d.bala.wd * 0.75, len: d.bala.len * 0.75, I: d.bala.I * 0.9, hz: (d.bala.hz || 1) * 0.8, ms: 1.6, spd: 800, lr: 8, lk: 0.45, sp: 12 }),
    canhao: obus(f), obus: obus(f, { hz: d.obus.hz * 0.95, ms: 5 }), bombarda: obus(f, { hz: d.obus.hz * 1.3, rw: d.obus.rw * 1.3, rib: d.obus.rib * 1.2, ms: 7.5, boom: 1.15, pr: 22, pk: 0.6 }),
    pulso: { t: d.pulso, c: f === 'vehnar' ? WELD : f === 'vorag' ? BLOOD : p.a, c2: f === 'vorag' ? p.a : p.b, wd: 2.4, life: 0.24, I: 1.05, mz: f === 'vehnar' ? 'emissor' : d.mz, ms: 2.4, imp: 'choque', lr: 14, lk: 0.7 } }; }
Object.assign(ARS.vehnar, { chama: { t: 'chama', c: WHITE, c2: PAL.vehnar.b, wd: 6, life: 0.56, I: 1, mz: '', ms: 0, imp: 'fogo', lr: 24, lk: 1.3 }, prensa: obus('vehnar', { hz: 3.3, rw: 1.6, rib: 46, ms: 6.5, boom: 1.15, pr: 22, pk: 0.6, dbl: 1 }) });
Object.assign(ARS.erevane, { fuzil_longo: bala('erevane', { sniper: 1, c: PAL.erevane.b, wd: 0.32, len: 44, I: 1.35, hs: 3, hz: 1.9, hI: 1.7, asp: 5, ms: 2.4, spd: 900, lr: 9, lk: 0.45 }),
  laminas: { t: 'lamina', c: PAL.erevane.b, c2: PAL.erevane.a, life: 0.2, I: 1.25, mz: '', ms: 0, imp: 'corte', lr: 10, lk: 0.5 } });
Object.assign(ARS.tessara, { colosso: obus('tessara', { hz: 4.0, rw: 1.5, rib: 36, ms: 8, boom: 1.15, pr: 22, pk: 0.6, sp: 3.5 }) });
Object.assign(ARS.quorith, { pulso_voz: { t: 'sonico', c: PAL.quorith.a, c2: PAL.quorith.b, wd: 1.9, life: 0.26, I: 1.05, mz: 'cristal', ms: 2.2, imp: 'anel', lr: 12, lk: 0.6 },
  agulha: bala('quorith', { wd: 0.3, len: 30, I: 1.15, hz: 1.5, asp: 5, burst: 1, sp: 2.5, gap: 0.035, ms: 2.2, spd: 900 }),
  refrator: { t: 'prisma', c: PAL.quorith.a, c2: PAL.quorith.b, wd: 1.7, life: 0.32, I: 1.2, mz: 'cristal', ms: 4, imp: 'cristal', lr: 22, lk: 1.2 },
  ressonancia: obus('quorith', { hz: 3.8, rw: 1.4, rib: 42, ms: 7, ring: 2, sp: 12, boom: 1.1, pr: 22, pk: 0.65 }),
  harmonico: { t: 'helice', c: PAL.quorith.a, c2: PAL.quorith.b, wd: 2.1, life: 0.26, I: 1.05, mz: 'cristal', ms: 2, imp: 'anel', lr: 12, lk: 0.6 },
  catedral: obus('quorith', { hz: 5.8, rw: 2.1, rib: 56, ms: 10, ring: 2, sp: 10, boom: 1.45, pr: 34, pk: 1.0, epic: 1 }) });
Object.assign(ARS.vorag, { mordida: { t: 'mordida', c: BONE, c2: BLOOD, life: 0.18, I: 1.1, mz: '', ms: 0, imp: 'carne', lr: 0, lk: 0 },
  acido: obus('vorag', { hz: 2.4, rw: 0.85, rib: 18, ms: 3.5, boom: 0.85, pr: 10, pk: 0.3, sp: 4 }),
  chifrada: { t: 'chifre', c: BONE, c2: BLOOD, life: 0.22, I: 1.1, mz: '', ms: 0, imp: 'carne', lr: 0, lk: 0 },
  brutamonte: obus('vorag', { hz: 4.0, rw: 1.35, rib: 26, ms: 6, boom: 1.1, pr: 16, pk: 0.5, halo: BLOOD }),
  matriarca: obus('vorag', { hs: 7, hz: 5.0, hc: EGG, c: [1.8, 0.32, 0.28], rw: 1.6, rib: 32, ms: 9, boom: 1.4, pr: 26, pk: 0.8, epic: 1, halo: BLOOD }) });
for (const f in ARS) for (const w in ARS[f]) { const r = ARS[f][w]; r.f = f; r.w = w; r.p = PAL[f]; r.idx = RLIST.length; RLIST.push(r); }
const W_IDX = {}; ['fuzil', 'canhao', 'metralha', 'pulso', 'obus', 'bombarda', 'chama', 'fuzil_longo', 'prensa', 'laminas', 'ferrao', 'colosso', 'pulso_voz', 'agulha', 'refrator', 'ressonancia', 'harmonico', 'mordida', 'acido', 'chifrada', 'catedral', 'matriarca', 'brutamonte'].forEach((w, i) => { W_IDX[w] = i; });
const F_IDX = { vehnar: 0, erevane: 1, tessara: 2, quorith: 3, vorag: 4 };
function rec(f, w, kind) { const t = ARS[f] || ARS.vehnar; let r = t[w];
  if (!r && w === 'chama') r = t.refrator || t.pulso; /* o sim manda 'chama' no impacto de todo feixe com área: no Coro é o refrator */
  if (!r) { const sw = ARD.sim && ARD.sim.WEAPONS && ARD.sim.WEAPONS[w]; const pj = sw ? sw.proj : kind === 1 ? 'shell' : kind === 2 ? 'beam' : 'bullet'; r = pj === 'shell' ? t.canhao : pj === 'beam' ? t.pulso : t.fuzil; } /* arma nova fora do arsenal: pela forma do projétil no sim */
  return r; }

/* ---------- shaders (4.3g) ---------- */
const NOISE = 'float h1(float n) { return fract(sin(n * 12.9898 + 4.1414) * 43758.5453); }\n' +
  'float n1(float x) { float i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(h1(i), h1(i + 1.0), f); }\n' +
  'float n2(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); float n = i.x + i.y * 57.0; return mix(mix(h1(n), h1(n + 1.0), f.x), mix(h1(n + 57.0), h1(n + 58.0), f.x), f.y); }\n';
/* fita: A e B (sA, sB: ponto + meia largura no mundo), cor e força (sC), nascimento, vida, estilo e semente (sD), parâmetros (sE).
   Expande em pixels na tela (largura mínima uMinPx, com a força compensada) e arredonda as pontas. Estilos: 0 traçante, 1 traçante
   que voa na GPU (sE.x = tempo de voo, sE.y = cauda), 2 feixe, 3 arco elétrico, 4 onda (sE.x = fios, sE.y = comprimento de onda),
   5 chama, 6 risco que fica no ar (sE.x = tempo de voo da bala), 7 pulso sonoro, 8 fita de rastro (sE.z, sE.w = força em A e B), 9 canal */
const VS_S = 'attribute vec4 sA; attribute vec4 sB; attribute vec4 sC; attribute vec4 sD; attribute vec4 sE;\n' +
  'uniform float uTime; uniform vec2 uRes; uniform float uMinPx; uniform float uNear;\n' +
  'varying vec4 vCol; varying vec4 vP; varying vec4 vQ; varying vec2 vR; varying float vH;\n' +
  'void main() {\n' +
  '  vH = 1.0; float tt = uTime - sD.x; float age = tt / max(sD.y, 0.0001); float st = sD.z;\n' +
  '  vCol = vec4(0.0); vP = vec4(0.0); vQ = vec4(0.0); vR = vec2(0.0);\n' +
  '  if (age < 0.0 || age > 1.0) { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); return; }\n' +
  '  vec3 A = sA.xyz, B = sB.xyz; float wa = sA.w, wb = sB.w;\n' +
  '  if (st > 0.5 && st < 1.5) { vec3 D = B - A; float L = length(D); float kh = clamp(tt / max(sE.x, 0.001), 0.0, 1.0); vec3 hd = A + D * kh; B = hd; A = hd - D / max(L, 0.001) * min(sE.y, L * kh + 0.5); }\n' +
  '  else if (st > 5.5 && st < 6.5) { float g = 1.0 + age * 2.0; wa *= g; wb *= g; A.y += age * 2.5; B.y += age * 2.5; }\n' +
  '  vec4 va = modelViewMatrix * vec4(A, 1.0), vb = modelViewMatrix * vec4(B, 1.0);\n' +
  '  float zn = -uNear * 1.02;\n' +
  '  if (va.z > zn && vb.z > zn) { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); return; }\n' +
  '  if (va.z > zn) va = mix(vb, va, (zn - vb.z) / (va.z - vb.z)); else if (vb.z > zn) vb = mix(va, vb, (zn - va.z) / (vb.z - va.z));\n' +
  '  vec4 ca = projectionMatrix * va, cb = projectionMatrix * vb;\n' +
  '  vec2 hr = 0.5 * uRes; vec2 sa = ca.xy / ca.w * hr, sb = cb.xy / cb.w * hr;\n' +
  '  vec2 d = sb - sa; float lp = length(d); vec2 dr = lp > 0.001 ? d / lp : vec2(1.0, 0.0); vec2 nr = vec2(-dr.y, dr.x);\n' +
  '  float py = projectionMatrix[1][1] * hr.y; float pa = wa * py / ca.w, pb = wb * py / cb.w;\n' +
  '  float t = position.y; float hw = mix(pa, pb, t); float he = max(hw, uMinPx);\n' +
  '  float cap = (st > 7.5 && st < 8.5) ? 0.0 : max(max(pa, pb), uMinPx);\n' +
  '  vec4 c = t < 0.5 ? ca : cb;\n' +
  '  c.xy += (nr * position.x * he + dr * (t * 2.0 - 1.0) * cap) / hr * c.w;\n' +
  '  gl_Position = c; vH = he;\n' +
  '  vCol = vec4(sC.rgb, age);\n' +
  '  vP = vec4(t + (t * 2.0 - 1.0) * cap / max(lp, 0.001), position.x, lp / max(cap, 0.001), st);\n' +
  '  vQ = vec4(sD.w, length(sB.xyz - sA.xyz), mix(sE.z, sE.w, t), sC.a * pow(hw / he, 0.6));\n' +
  '  vR = vec2(sE.x, (st > 5.5 && st < 6.5) ? clamp(tt / max(sE.x, 0.001), 0.0, 1.0) : sE.y);\n' +
  '}';
const FS_S = 'uniform float uClock;\nvarying vec4 vCol; varying vec4 vP; varying vec4 vQ; varying vec2 vR; varying float vH;\n' + NOISE +
  'void main() {\n' +
  '  float t = vP.x, x = vP.y, st = vP.w, age = vCol.a, sd = vQ.x, L = vQ.y;\n' +
  '  float tc = clamp(t, 0.0, 1.0); float o = (t < 0.0 ? -t : max(t - 1.0, 0.0)) * vP.z; float d2 = o * o + x * x;\n' +
  '  if (d2 >= 1.0) discard;\n' +
  '  vec3 col = vCol.rgb; float I = 0.0, W = 0.0, A = 0.0; float lw = clamp(0.9 / max(vH, 0.5), 0.07, 0.6); float li = 1.0 / (lw * lw);\n' +
  '  float core = exp(-d2 * 9.0), halo = exp(-d2 * 2.4) * (1.0 - d2);\n' +
  '  if (st < 1.5) { float al = tc * tc; I = (halo * 0.55 + core) * (0.06 + 0.94 * al); W = core * al * al * 0.75; }\n' +
  '  else if (st < 2.5) { float fl = 0.72 + 0.56 * n1(tc * L * 0.11 - uClock * 42.0 + sd * 17.0); float k = (1.0 - age * age) * smoothstep(0.0, 0.025, tc); I = (halo * 0.55 * fl + core * 1.1) * k; W = core * k * 0.75; }\n' +
  '  else if (st < 3.5) { float fr = floor(uClock * 26.0 + sd * 7.0); float en = sin(3.14159 * tc); float c1 = (n1(tc * L * 0.15 + sd * 31.0 + fr * 7.31) - 0.5) * 1.5 * en; float c2 = (n1(tc * L * 0.33 + sd * 13.0 + fr * 3.17) - 0.5) * 1.1 * en;\n' +
  '    float e1 = x - c1, e2 = x - c2; float ln = exp(-e1 * e1 * li) + 0.5 * exp(-e2 * e2 * li * 2.0); float k = 1.0 - age; I = (ln + exp(-x * x * 2.5) * 0.18 * en) * k; W = ln * 0.5 * k; }\n' +
  '  else if (st < 4.5) { float ph = tc * L / max(vR.y, 1.0) * 6.2832 - uClock * 16.0 + sd * 6.2832; float en = smoothstep(0.0, 0.07, tc) * (1.0 - smoothstep(0.93, 1.0, tc)); float a1 = sin(ph) * 0.6 * en; float e1 = x - a1; float ln = exp(-e1 * e1 * li * 0.6);\n' +
  '    if (vR.x > 1.5) { float e2 = x + a1; ln += exp(-e2 * e2 * li * 0.6); } float k = 1.0 - age; I = (ln + exp(-x * x * 4.0) * 0.22) * k; W = ln * 0.35 * k; }\n' +
  '  else if (st < 5.5) { vec2 q = vec2(tc * L * 0.12 - uClock * 9.0, x * 2.1 + sd * 9.0); float n = n2(q) * 0.5 + n2(q * 2.3 + 5.1) * 0.3 + n2(q * 5.1 + 2.3) * 0.2;\n' +
  '    float dens = (1.0 - abs(x)) * (0.5 + 1.0 * n) - 0.3 * tc; float body = smoothstep(0.1, 0.38, dens); float hot = smoothstep(0.4, 0.85, dens) * (1.0 - 0.75 * tc);\n' +
  '    float k = smoothstep(0.0, 0.08, age) * (1.0 - smoothstep(0.6, 1.0, age)) * smoothstep(0.0, 0.04, tc);\n' +
  '    vec3 fc = mix(vec3(0.85, 0.13, 0.03), vec3(2.3, 0.78, 0.12), smoothstep(0.1, 0.5, dens + 0.25 * (1.0 - tc))); fc = mix(fc, vec3(2.5, 1.65, 0.55), hot);\n' +
  '    col *= fc; I = body * k * (1.0 - 0.35 * tc); W = hot * k * 0.12; A = body * k * 0.3; }\n' +
  '  else if (st < 6.5) { if (tc > vR.y) discard; float br = n1(tc * L * 0.07 + sd * 23.0 + age * 1.5) * 0.65 + n1(tc * L * 0.23 + sd * 7.0 - age) * 0.35; float th = (age - 0.3) * 1.5; float keep = 1.0 - smoothstep(br - 0.12, br + 0.12, th);\n' +
  '    float k = (1.0 - age) * (1.0 - age * 0.5); I = (core + halo * 0.4) * k * keep; W = core * k * keep * 0.6; }\n' +
  '  else if (st < 7.5) { float ph = fract(tc * L / 13.0 - uClock * 9.0 + sd); float e = (ph - 0.5) * 4.5; float band = exp(-e * e); float k = 1.0 - age; I = (core * 0.3 + (halo * 1.1 + core) * band) * k; W = core * band * 0.5 * k; }\n' +
  '  else if (st < 8.5) { float c2 = exp(-x * x * 8.0), h2 = exp(-x * x * 2.2) * (1.0 - x * x); float k = vQ.z * (1.0 - age); I = (h2 * 0.55 + c2) * k; W = c2 * k * k * 0.4; }\n' +
  '  else { float ph = fract(tc * L / 9.0 + uClock * 3.2 + sd); float e = (ph - 0.5) * 3.6; float bead = exp(-e * e); I = core * 0.45 + (halo * 0.6 + core) * bead; W = core * bead * 0.35; }\n' +
  '  gl_FragColor = vec4((col * I + vec3(W)) * vQ.w, A * min(vQ.w, 1.0));\n' +
  '}';
/* sprite: posição e nascimento (pA), velocidade e vida (pB), tamanho inicial e final, estilo e semente (pC: semente negativa = não
   apaga no fim da vida), cor e força (pD), giro inicial, velocidade de giro, gravidade e alongamento na direção do movimento (pE).
   Estilos: 0 orbe, 1 estrela de 4 pontas, 2 estrela de cristal (6 finas), 3 agulha/estilhaço, 4 glóbulo de ácido, 5 anel, 6 golpe
   (arco que varre), 7 casulo pulsante, 8 clarão de impacto com raios, 9 sopro macio, 10 anel deitado no plano perpendicular ao movimento */
const VS_P = 'attribute vec4 pA; attribute vec4 pB; attribute vec4 pC; attribute vec4 pD; attribute vec4 pE;\n' +
  'uniform float uTime; uniform vec2 uRes; uniform float uMinPx;\n' +
  'varying vec4 vCol; varying vec4 vUv; varying vec2 vS; varying float vSol;\n' +
  'void main() {\n' +
  '  vSol = 0.0; float tt = uTime - pA.w; float age = tt / max(pB.w, 0.0001); float st = pC.z;\n' +
  '  vCol = vec4(0.0); vUv = vec4(0.0); vS = vec2(0.0);\n' +
  '  if (age < 0.0 || age > 1.0) { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); return; }\n' +
  '  vec3 v = pB.xyz - vec3(0.0, pE.z * tt, 0.0); vec3 p = pA.xyz + pB.xyz * tt - vec3(0.0, 0.5 * pE.z * tt * tt, 0.0);\n' +
  '  float e = 1.0 - (1.0 - age) * (1.0 - age); float sz = mix(pC.x, pC.y, e);\n' +
  '  vec2 q = position.xy; vUv = vec4(q, age, st); vCol = vec4(pD.rgb, 1.0); vS = vec2(pC.w, abs(pD.a)); float sol = pD.a < 0.0 ? 1.0 : 0.0;\n' +
  '  if (st > 9.5) { vec3 dn = normalize(v + vec3(0.0, 0.00001, 0.0)); vec3 u = normalize(cross(dn, abs(dn.y) < 0.95 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0))); vec3 w = cross(dn, u);\n' +
  '    gl_Position = projectionMatrix * modelViewMatrix * vec4(p + (u * q.x + w * q.y) * sz, 1.0); return; }\n' +
  '  vec4 vp = modelViewMatrix * vec4(p, 1.0); vp.z += min(sz, 14.0) * 0.9; /* vem para a frente pelo próprio tamanho: o chão e o alvo não cortam o disco com uma reta */\n' +
  '  float spx = sz * projectionMatrix[1][1] * 0.5 * uRes.y / max(-vp.z, 1.0); float se = max(spx, uMinPx * 1.6); float cmp = pow(spx / max(se, 0.0001), 0.6); vS.y *= cmp; vSol = sol * cmp;\n' +
  '  float an = pE.x + pE.y * tt; vec2 dr = vec2(cos(an), sin(an)); float asp = 1.0;\n' +
  '  if (pE.w > 0.0) { vec3 vv = (modelViewMatrix * vec4(v, 0.0)).xyz; float lv = length(vv), ls = length(vv.xy); if (ls > 0.0001) { dr = vv.xy / ls; asp = 1.0 + pE.w * ls / max(lv, 0.0001); } }\n' +
  '  vec2 o = vec2(q.x * asp, q.y); o = vec2(o.x * dr.x - o.y * dr.y, o.x * dr.y + o.y * dr.x);\n' +
  '  vp.xy += o * sz * se / max(spx, 0.0001);\n' +
  '  gl_Position = projectionMatrix * vp;\n' +
  '}';
const FS_P = 'uniform float uClock;\nvarying vec4 vCol; varying vec4 vUv; varying vec2 vS; varying float vSol;\n' + NOISE +
  'void main() {\n' +
  '  vec2 q = vUv.xy; float r2 = dot(q, q); if (r2 >= 1.0) discard; float r = sqrt(r2); float age = vUv.z, st = vUv.w, sd = abs(vS.x);\n' +
  '  float I = 0.0, W = 0.0, A = 0.0; float k = 1.0 - age; float core = exp(-r2 * 16.0), halo = exp(-r2 * 3.2) * (1.0 - r2); float a = r2 > 0.000001 ? atan(q.y, q.x) : 0.0;\n' +
  '  if (st < 0.5) { I = halo * 0.85 + core; W = core * 0.6; }\n' +
  '  else if (st < 2.5) { float aa = a + sd * 6.2832; float c = abs(cos(aa * (st < 1.5 ? 2.0 : 3.0))); float c2 = c * c, c4 = c2 * c2, c8 = c4 * c4; float sp = (st < 1.5 ? c8 * c8 * c8 : c8 * c8 * c8 * c8 * c8) * (1.0 - r) * (1.0 - r);\n' +
  '    I = (sp * 1.5 + halo * 0.45 + core) * k; W = (core * 1.1 + sp * 0.4) * k; }\n' +
  '  else if (st < 3.5) { float dm = abs(q.x) + abs(q.y); float body = 1.0 - smoothstep(0.45, 1.0, dm); float cr = exp(-(q.x * q.x * 2.5 + q.y * q.y * 40.0)); float fc = q.y > 0.0 ? 1.0 : 0.55; I = body * 0.6 * fc + cr; W = cr * 0.7; if (vSol > 0.0) { float bm = 1.0 - smoothstep(0.55, 0.85, dm); I = bm * (0.32 + 0.4 * fc) + cr * 0.35 + body * 0.25; W = cr * 0.15; A = bm * 0.75; } }\n' +
  '  else if (st < 4.5) { float wob = 0.15 * sin(a * 3.0 + uClock * 5.0 + sd * 9.0) + 0.08 * sin(a * 5.0 - uClock * 8.0 + sd * 3.0); float body = 1.0 - smoothstep(0.5, 0.8, r + wob);\n' +
  '    float bub = smoothstep(0.72, 0.9, n2(q * 3.5 + vec2(sd * 7.0, uClock * 1.6))); float cg = exp(-r2 * 6.0); I = body * (0.6 + 0.4 * bub) + cg * 0.6 + halo * 0.3; W = cg * 0.12; if (vSol > 0.0) { I = body * (0.22 + 0.5 * bub) + cg * 0.25 + halo * 0.25; W = 0.0; A = body * 0.75; } }\n' +
  '  else if (st < 5.5 || st > 9.5) { float e = (r - 0.82) / 0.075; float ring = exp(-e * e); I = (ring * (1.0 + 0.4 * k) + exp(-e * e * 0.08) * 0.12) * k; W = ring * k * k * 0.3; }\n' +
  '  else if (st < 6.5) { float hd = -1.25 + 2.5 * smoothstep(0.0, 0.45, age); float tl = clamp((hd - a) / 1.8, 0.0, 1.0); float on = step(a, hd + 0.05) * step(-1.35, a) * (1.0 - tl);\n' +
  '    float th = 0.04 + 0.085 * (1.0 - tl); float e = (r - 0.78) / th; float band = exp(-e * e) * on; float fd = 1.0 - smoothstep(0.5, 1.0, age);\n' +
  '    I = (band * 1.5 + exp(-e * e * 0.12) * on * 0.3) * fd; W = band * (1.0 - tl) * fd * 0.7; }\n' +
  '  else if (st < 7.5) { float pul = 0.8 + 0.3 * sin(uClock * 9.0 + sd * 6.2832); float vein = 1.0 - smoothstep(0.0, 0.08, abs(n2(q * 2.6 + sd * 5.0) - 0.5)); float body = 1.0 - smoothstep(0.42, 0.72, r);\n' +
  '    I = (body * (0.55 + 0.75 * vein) + halo * 0.5) * pul + core * 0.3; W = core * 0.12 * pul; if (vSol > 0.0) { I = (body * (0.16 + 1.5 * vein) + halo * 0.45) * pul + core * 0.12; W = 0.0; A = body * 0.8; } }\n' +
  '  else if (st < 8.5) { float c7 = 0.5 + 0.5 * cos(a * 7.0 + sd * 6.2832); float c11 = 0.5 + 0.5 * cos(a * 11.0 - sd * 3.0); c7 *= c7; c7 *= c7; c11 *= c11; c11 *= c11; c11 *= c11;\n' +
  '    float rays = (c7 * c7 * 0.7 + c11 * 0.5) * (1.0 - r) * 1.5; I = (rays + halo * 0.5 + core) * k; W = (core + rays * 0.3) * k * k; }\n' +
  '  else { I = exp(-r2 * 3.5) * (1.0 - r2) * k; }\n' +
  '  if (vS.x >= 0.0 && (st < 0.5 || (st > 2.5 && st < 4.5) || (st > 6.5 && st < 7.5))) { float f = 1.0 - smoothstep(0.7, 1.0, age); I *= f; W *= f; A *= f; }\n' +
  '  gl_FragColor = vec4((vCol.rgb * I + vec3(W)) * vS.y, A * vSol);\n' +
  '}';

function create(THREE, scene, env) {
  env = env || {}; const FX = env.FX || null, flashF = env.flash || null, HF = env.H || null, QL = () => (env.quality && env.quality()) || { particles: 1 };
  const R = Math.random, TAU = Math.PI * 2, TK = (ARD.sim && ARD.sim.TICK) || 0.1;
  const U = { clock: { value: 0 }, res: { value: new THREE.Vector2(1280, 720) }, minPx: { value: 0.85 }, near: { value: 1 } }, uAged = { value: 0 }, uDyn = { value: 0 };
  const mat = (vs, fs, ut) => new THREE.ShaderMaterial({ uniforms: { uTime: ut, uClock: U.clock, uRes: U.res, uMinPx: U.minPx, uNear: U.near }, vertexShader: vs, fragmentShader: fs, transparent: true, depthWrite: false, depthTest: true, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, side: THREE.DoubleSide, fog: false }); /* dois lados: a fita é montada na tela e o anel deitado gira com o voo; mistura pré-multiplicada: alfa 0 soma luz (aditivo), alfa > 0 é corpo que cobre o fundo e segura a cor de dia */
  const mSd = mat(VS_S, FS_S, uDyn), mSa = mat(VS_S, FS_S, uAged), mPd = mat(VS_P, FS_P, uDyn), mPa = mat(VS_P, FS_P, uAged); /* mesmo código: 2 programas para os 4 lotes */
  const _rv = new THREE.Vector2(); function onBR(renderer) { const rt = renderer.getRenderTarget(); if (rt) U.res.value.set(rt.width, rt.height); else { renderer.getDrawingBufferSize(_rv); U.res.value.copy(_rv); } }
  function sys(sprite, cap, dyn) {
    const base = sprite ? new THREE.PlaneGeometry(2, 2) : new THREE.PlaneGeometry(2, 1).translate(0, 0.5, 0);
    const g = new THREE.InstancedBufferGeometry(); g.index = base.index; g.setAttribute('position', base.attributes.position);
    const names = sprite ? ['pA', 'pB', 'pC', 'pD', 'pE'] : ['sA', 'sB', 'sC', 'sD', 'sE']; const at = [], A = [];
    for (let j = 0; j < 5; j++) { const a = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4); a.setUsage(THREE.DynamicDrawUsage); g.setAttribute(names[j], a); at.push(a); A.push(a.array); }
    if (!dyn) for (let i = 0; i < cap; i++) { if (sprite) { A[0][i * 4 + 3] = -1e6; A[1][i * 4 + 3] = 1; } else { A[3][i * 4] = -1e6; A[3][i * 4 + 1] = 1; } } /* nascidos "há muito tempo": invisíveis */
    g.instanceCount = dyn ? 0 : cap;
    const m = new THREE.Mesh(g, sprite ? (dyn ? mPd : mPa) : (dyn ? mSd : mSa)); m.frustumCulled = false; m.renderOrder = 13; m.onBeforeRender = onBR; m.visible = !dyn; scene.add(m);
    return { g, at, A0: A[0], A1: A[1], A2: A[2], A3: A[3], A4: A[4], m, n: 0, i: 0, cap, dyn, lo: cap, hi: -1, plo: 0, phi: -1, peak: 0, born: 0 };
  }
  const SD = sys(false, 3072, true), SA = sys(false, 3072, false), PD = sys(true, 1536, true), PA = sys(true, 4096, false);
  function slot(S) { let i; if (S.dyn) { if (S.n >= S.cap) return -1; i = S.n++; } else { i = S.i; S.i = i + 1 >= S.cap ? 0 : i + 1; if (i < S.lo) S.lo = i; if (i > S.hi) S.hi = i; S.born++; } return i * 4; }
  /* fita de A a B */
  function seg(S, ax, ay, az, wa, bx, by, bz, wb, c, k, t0, life, st, sd, e0, e1, e2, e3) { const o = slot(S); if (o < 0) return;
    let A = S.A0; A[o] = ax; A[o + 1] = ay; A[o + 2] = az; A[o + 3] = wa; A = S.A1; A[o] = bx; A[o + 1] = by; A[o + 2] = bz; A[o + 3] = wb;
    A = S.A2; A[o] = c[0]; A[o + 1] = c[1]; A[o + 2] = c[2]; A[o + 3] = k; A = S.A3; A[o] = t0; A[o + 1] = life; A[o + 2] = st; A[o + 3] = sd;
    A = S.A4; A[o] = e0; A[o + 1] = e1; A[o + 2] = e2; A[o + 3] = e3; }
  /* sprite */
  function spr(S, x, y, z, t0, vx, vy, vz, life, s0, s1, st, sd, c, k, rot, spin, grav, asp) { const o = slot(S); if (o < 0) return;
    let A = S.A0; A[o] = x; A[o + 1] = y; A[o + 2] = z; A[o + 3] = t0; A = S.A1; A[o] = vx; A[o + 1] = vy; A[o + 2] = vz; A[o + 3] = life;
    A = S.A2; A[o] = s0; A[o + 1] = s1; A[o + 2] = st; A[o + 3] = sd; A = S.A3; A[o] = c[0]; A[o + 1] = c[1]; A[o + 2] = c[2]; A[o + 3] = k;
    A = S.A4; A[o] = rot; A[o + 1] = spin; A[o + 2] = grav; A[o + 3] = asp; }
  function flush(S) { const at = S.at;
    if (S.dyn) { const n = S.n; S.g.instanceCount = n; S.m.visible = n > 0; if (n > S.peak) S.peak = n; if (n) for (let j = 0; j < 5; j++) { const a = at[j]; a.clearUpdateRanges(); a.addUpdateRange(0, n * 4); a.needsUpdate = true; } S.n = 0; }
    else if (S.hi >= 0) { /* junta com a faixa que o three ainda não enviou (quadro escrito sem desenho no meio), para nada ficar velho na GPU */
      if (at[0].updateRanges.length) { S.lo = Math.min(S.lo, S.plo); S.hi = Math.max(S.hi, S.phi); }
      for (let j = 0; j < 5; j++) { const a = at[j]; a.clearUpdateRanges(); a.addUpdateRange(S.lo * 4, (S.hi - S.lo + 1) * 4); a.needsUpdate = true; } S.plo = S.lo; S.phi = S.hi; S.lo = S.cap; S.hi = -1; } }

  /* ---------- tempo: o que nasce num evento aparece com idade zero no próximo quadro desenhado ---------- */
  let time = 0, lead = 1 / 60, frameNo = 1; let fxT0 = 0, fxDepth = 0;
  const born = () => time + lead;
  function fxOn() { if (FX && fxDepth++ === 0) { fxT0 = FX.time; FX.time = time + lead; } }
  function fxOff() { if (FX && --fxDepth === 0) FX.time = fxT0; }
  const _P = [0, 0, 0], _V = [0, 0, 0], _C = [0, 0, 0], _T = [1, 1, 1], _EO = { tint: _T, wave: false, delay: 0, race: null, impact: true, ground: 0 };
  /* ex = campo extra do tipo no fx3d da 4.3g (destroço: altura até o chão + 1000 × material 0 metal, 1 cristal, 2 carne, 3 terra); o fx3d antigo ignora */
  function fx(b, x, y, z, vx, vy, vz, life, s0, s1, type, c, g, ease, spin, alpha, delay, ex) { _P[0] = x; _P[1] = y; _P[2] = z; _V[0] = vx; _V[1] = vy; _V[2] = vz; FX.emit(b, _P, _V, life, s0, s1, type, c, g, ease, spin, alpha, delay, ex); }
  const drop = (x, y, z, mat) => Math.max(0.5, y - H(x, -z)) + mat * 1000;
  const cs = (c, k) => { _C[0] = c[0] * k; _C[1] = c[1] * k; _C[2] = c[2] * k; return _C; };
  function cnt(n) { const v = n * (FX ? FX.mult : QL().particles); const f = Math.floor(v); return f + (R() < v - f ? 1 : 0); } /* FX.mult = quality().particles */
  function light(x, z, r, c, k, life, fl) { if (flashF && r > 0 && k > 0) flashF(x, -z, r, c, k, life, fl || 0); }
  function boomFx(x, y, z, size, tr, tg, tb, wave, race) { if (!FX || !FX.explosion) return; _T[0] = tr; _T[1] = tg; _T[2] = tb; _EO.wave = !!wave; _EO.delay = 0; _EO.race = race || null; _EO.ground = y; FX.explosion(x, y, z, size, _EO); } /* race, impact e ground: a explosão da 4.3g faz a camada da Raça e o chafariz de terra do impacto */
  const H = (x, mapY) => (HF ? HF(x, mapY) : 0);

  /* ---------- clarões de boca ---------- */
  function muzzle(rc, fx0, fy0, fz0, dx, dy, dz, big, ambush, delay) {
    const p = rc.p, s = rc.ms, dl = delay || 0, t0 = born() + dl; if (!s) return;
    switch (rc.mz) {
      case 'forja': /* Vehnar: estrela larga, cone de fogo para a frente, fumaça escura, cápsula */
        spr(PA, fx0, fy0, fz0, t0, 0, 0, 0, 0.065, s * 1.2, s * 0.7, 1, R(), p.b, 1.45, 0, 0, 0, 0);
        spr(PA, fx0 + dx * s * 0.8, fy0 + dy * s * 0.8, fz0 + dz * s * 0.8, t0, dx * 0.01, dy * 0.01, dz * 0.01, 0.06, s * 1.0, s * 0.6, 3, R(), p.a, 1.25, 0, 0, 0, 1.8);
        spr(PA, fx0, fy0, fz0, t0, 0, 0, 0, 0.1, s * 1.7, s * 2.3, 9, R(), p.g, 0.6, 0, 0, 0, 0);
        if (FX) { const n = cnt(big ? 3 : 1); for (let i = 0; i < n; i++) fx(FX.alp, fx0 + dx * s * (0.6 + i * 0.5), fy0 + dy * s * 0.5, fz0 + dz * s * (0.6 + i * 0.5), dx * (14 + R() * 10) + (R() - 0.5) * 6, 5 + R() * 6, dz * (14 + R() * 10) + (R() - 0.5) * 6, 0.8 + R() * 0.6, s * 0.4, s * (1.4 + R() * 0.7), 3, SOOT, -2, 1.6, (R() - 0.5) * 2, big ? 0.6 : 0.45, dl);
          if (!big && R() < 0.6) fx(FX.alp, fx0 - dx * 1.5, fy0, fz0 - dz * 1.5, -dz * (16 + R() * 10) + (R() - 0.5) * 6, 14 + R() * 10, dx * (16 + R() * 10) + (R() - 0.5) * 6, 0.45, 0.6, 0.5, 5, BRASS, 220, 1, 20, 1, dl, drop(fx0, fy0, fz0, 0));
          if (big) for (let i = cnt(3); i > 0; i--) fx(FX.add, fx0, fy0, fz0, dx * (40 + R() * 50) + (R() - 0.5) * 30, dy * 40 + 8 + R() * 20, dz * (40 + R() * 50) + (R() - 0.5) * 30, 0.2 + R() * 0.2, 0.6, 0.2, 2, p.s, 140, 1, 0, 1, dl); }
        light(fx0, fz0, rc.lr, p.l, rc.lk, 0.07 + lead + dl, 0); break;
      case 'emissor': /* emissor de pulso (Vehnar): estrela curta na cor do arco, sem fumaça */
        spr(PA, fx0, fy0, fz0, t0, 0, 0, 0, 0.07, s * 1.2, s * 0.8, 1, R(), rc.c2 || p.b, 1.1, 0, 0, 0, 0); spr(PA, fx0, fy0, fz0, t0, 0, 0, 0, 0.12, s * 1.5, s * 1.8, 9, R(), rc.c || p.a, 0.5, 0, 0, 0, 0);
        light(fx0, fz0, rc.lr * 0.6, p.l, rc.lk * 0.6, 0.07 + lead, 0); break;
      case 'veu': /* Erevane: quase nada — um brilho fino e curto */
        spr(PA, fx0, fy0, fz0, t0, 0, 0, 0, 0.045, s * 0.6, s * 0.35, 1, R(), p.b, 0.65, 0, 0, 0, 0);
        if (ambush) { spr(PA, fx0, fy0, fz0, t0, 0, 0, 0, 0.32, s * 0.8, s * 3.6, 5, R(), p.a, 0.9, 0, 0, 0, 0); light(fx0, fz0, 18, p.l, 0.8, 0.25 + lead, 0); }
        light(fx0, fz0, rc.lr * 0.5, p.l, rc.lk * 0.4, 0.05 + lead + dl, 0); break;
      case 'seiva': /* Tessara: sopro orgânico, gotas de seiva */
        spr(PA, fx0 + dx * s * 0.4, fy0 + dy * s * 0.4, fz0 + dz * s * 0.4, t0, dx * 12, dy * 12, dz * 12, 0.14, s * 0.65, s * 1.35, 9, R(), p.a, 0.9, 0, 0, 0, 0);
        spr(PA, fx0, fy0, fz0, t0, 0, 0, 0, 0.06, s * 0.6, s * 0.45, 0, R(), p.b, 0.75, 0, 0, 0, 0);
        if (FX) for (let i = cnt(2); i > 0; i--) fx(FX.add, fx0, fy0, fz0, dx * (25 + R() * 25) + (R() - 0.5) * 16, 8 + R() * 14, dz * (25 + R() * 25) + (R() - 0.5) * 16, 0.35 + R() * 0.2, 0.6, 0.3, 2, p.b, 180, 1, 0, 1, dl);
        light(fx0, fz0, rc.lr * 0.75, p.l, rc.lk * 0.6, 0.07 + lead + dl, 0); break;
      case 'cristal': /* Quorith: estrela de cristal de 6 pontas e um anel que abre */
        spr(PA, fx0, fy0, fz0, t0, 0, 0, 0, 0.07, s * 1.1, s * 0.75, 2, R(), p.b, 1.3, 0, 0, 0, 0);
        spr(PA, fx0, fy0, fz0, t0, dx * 0.01, dy * 0.01, dz * 0.01, 0.16, s * 0.3, s * 1.4, 10, R(), p.a, 0.95, 0, 0, 0, 0);
        light(fx0, fz0, rc.lr * 0.85, p.l, rc.lk * 0.8, 0.08 + lead + dl, 0); break;
      case 'cuspe': /* Prole: cuspe úmido, gotas de ácido */
        spr(PA, fx0 + dx * s * 0.3, fy0, fz0 + dz * s * 0.3, t0, dx * 10, 0, dz * 10, 0.11, s * 0.5, s * 1.0, 9, R(), p.a, 0.65, 0, 0, 0, 0);
        if (FX) for (let i = cnt(3); i > 0; i--) fx(FX.add, fx0, fy0, fz0, dx * (30 + R() * 30) + (R() - 0.5) * 18, 6 + R() * 14, dz * (30 + R() * 30) + (R() - 0.5) * 18, 0.3 + R() * 0.25, 0.65, 0.35, 2, p.a, 200, 1, 0, 0.9, dl);
        light(fx0, fz0, rc.lr * 0.5, p.l, rc.lk * 0.45, 0.06 + lead + dl, 0); break;
    }
  }

  /* ---------- impactos ---------- */
  function hitSmall(rc, x, y, z, hit, f, dl) { const p = rc.p; dl = dl || 0; const t0 = born() + dl; if (!FX) return;
    switch (rc.imp) {
      case 'faisca': spr(PA, x, y, z, t0, 0, 0, 0, 0.08, 4.2, 2.2, 8, R(), p.b, hit ? 1.35 : 0.75, 0, 0, 0, 0); spr(PA, x, y, z, t0, 0, 0, 0, 0.16, 3.0, 4.5, 9, R(), p.g, 0.5, 0, 0, 0, 0);
        for (let i = cnt(hit ? 8 : 3); i > 0; i--) { const a = R() * TAU, v = 35 + R() * 60; fx(FX.add, x, y + 0.5, z, Math.cos(a) * v, 15 + R() * 45, Math.sin(a) * v, 0.2 + R() * 0.3, 0.9 + R() * 0.5, 0.25, 2, p.s, 170, 1, 0, 1, dl); }
        if (!hit) fx(FX.alp, x, y + 1, z, 0, 6, 0, 0.6, 1.8, 5.5, 4, DUST, 0, 2, 0, 0.5, dl);
        light(x, z, 10, p.l, hit ? 0.65 : 0.35, 0.09 + lead + dl, 0); break;
      case 'teal': spr(PA, x, y, z, t0, 0, 0, 0, 0.065, 2.4, 1.4, 8, R(), p.b, 0.9, 0, 0, 0, 0);
        for (let i = cnt(2); i > 0; i--) { const a = R() * TAU, v = 25 + R() * 35; fx(FX.add, x, y + 0.5, z, Math.cos(a) * v, 12 + R() * 25, Math.sin(a) * v, 0.15 + R() * 0.15, 0.5, 0.15, 2, p.s, 150, 1, 0, 1, dl); }
        if (!hit) fx(FX.alp, x, y + 1, z, 0, 5, 0, 0.5, 1.2, 3.5, 4, DUST, 0, 2, 0, 0.4, dl);
        light(x, z, 6, p.l, 0.3, 0.06 + lead + dl, 0); break;
      case 'seiva': spr(PA, x, y, z, t0, 0, 3, 0, 0.2, 1.4, 3.0, 9, R(), p.a, 0.65, 0, 0, 0, 0); spr(PA, x, y, z, t0, 0, 0, 0, 0.07, 3.2, 1.8, 8, R(), p.b, 0.9, 0, 0, 0, 0);
        for (let i = cnt(7); i > 0; i--) { const a = R() * TAU, v = 15 + R() * 32; fx(FX.add, x, y + 0.5, z, Math.cos(a) * v, 20 + R() * 30, Math.sin(a) * v, 0.4 + R() * 0.3, 1.1 + R() * 0.4, 0.45, 2, R() < 0.5 ? p.a : p.b, 230, 1, 0, 1, dl); }
        light(x, z, 8, p.l, 0.4, 0.08 + lead + dl, 0); break;
      case 'estilhaco': spr(PA, x, y, z, t0, 0, 0, 0, 0.08, 3.0, 1.6, 2, R(), p.b, 1.2, 0, 0, 0, 0); spr(PA, x, y, z, t0, 0, 0, 0, 0.2, 0.8, 4.6, 5, R(), p.a, 0.85, 0, 0, 0, 0);
        for (let i = cnt(6); i > 0; i--) { const a = R() * TAU, v = 40 + R() * 60; fx(FX.add, x, y + 0.5, z, Math.cos(a) * v, 10 + R() * 45, Math.sin(a) * v, 0.16 + R() * 0.2, 0.55, 0.15, 2, p.s, 120, 1, 0, 1, dl); }
        light(x, z, 9, p.l, 0.5, 0.08 + lead + dl, 0); break;
      case 'acido': spr(PA, x, y, z, t0, 0, 0, 0, 0.18, 1.4, 3.0, 9, R(), p.a, 0.7, 0, 0, 0, 0);
        for (let i = cnt(5); i > 0; i--) { const a = R() * TAU, v = 15 + R() * 30; fx(FX.add, x, y + 0.5, z, Math.cos(a) * v, 18 + R() * 28, Math.sin(a) * v, 0.35 + R() * 0.2, 0.7, 0.35, 2, p.a, 220, 1, 0, 1, dl); }
        fx(FX.add, x, H(x, -z) + 0.6, z, 0, 0, 0, 0.5, 1.8, 2.8, 7, cs(p.g, 0.7), 0, 2, 0, 0.8, dl);
        if (!hit) fx(FX.alp, x, y + 1, z, 0, 7, 0, 0.8, 1.2, 4, 3, ACIDK, -2, 1.5, 0, 0.35, dl);
        light(x, z, 7, p.l, 0.35, 0.08 + lead + dl, 0); break;
      case 'choque': spr(PA, x, y, z, t0, 0, 0, 0, 0.12, 3.6, 2.2, 8, R(), f || p.b, 1.2, 0, 0, 0, 0); spr(PA, x, y, z, t0, 0, 0, 0, 0.3, 1.5, 8.5, 5, R(), rc.c, 0.85, 0, 0, 0, 0);
        for (let i = cnt(3); i > 0; i--) { const a = R() * TAU, v = 30 + R() * 40; fx(FX.add, x, y + 0.5, z, Math.cos(a) * v, 10 + R() * 30, Math.sin(a) * v, 0.2 + R() * 0.2, 0.5, 0.15, 2, rc.c, 150, 1, 0, 1); }
        break;
      case 'anel': spr(PA, x, y, z, t0, 0, 0, 0, 0.3, 1.2, 7.5, 5, R(), rc.c, 0.9, 0, 0, 0, 0); spr(PA, x, y, z, t0, 0, 0, 0, 0.09, 2.8, 1.6, 2, R(), rc.c2, 1.0, 0, 0, 0, 0);
        for (let i = cnt(2); i > 0; i--) { const a = R() * TAU, v = 25 + R() * 30; fx(FX.add, x, y + 0.5, z, Math.cos(a) * v, 10 + R() * 25, Math.sin(a) * v, 0.18, 0.45, 0.15, 2, p.s, 100, 1, 0, 1); }
        break;
    }
  }
  function boom(rc, x, y, z, splash, hit) { const p = rc.p, t0 = born();
    const size = Math.min(rc.epic ? 22 : 16, 3 + splash * (rc.epic ? 0.4 : 0.3)) * rc.boom, up = y + 6 + size * 0.35; /* acima do alvo, que tapa o que nasce no chão */
    switch (rc.imp) {
      case 'forja': boomFx(x, y, z, size, 1, 1, 1, rc.epic, 'vehnar');
        spr(PA, x, up, z, t0, 0, 0, 0, 0.1, size * 1.3, size * 0.8, 8, R(), p.b, 1.35, 0, 0, 0, 0);
        if (FX) { for (let i = cnt(8); i > 0; i--) { const a = R() * TAU, v = size * (5 + R() * 6); fx(FX.add, x, y + size * 0.3, z, Math.cos(a) * v, size * (3 + R() * 5), Math.sin(a) * v, 0.4 + R() * 0.5, 0.75, 0.25, 2, p.s, 160 + size * 5, 1, 0, 1); }
          for (let i = cnt(3); i > 0; i--) { const a = R() * TAU, v = size * (2 + R() * 3); fx(FX.alp, x, y + size * 0.3, z, Math.cos(a) * v, size * (3 + R() * 4), Math.sin(a) * v, 0.8 + R() * 0.6, 0.8 + R() * 0.8, 0.7, 5, SOOT, 220, 1, (R() - 0.5) * 16, 1, 0, drop(x, y + size * 0.3, z, 0)); } }
        light(x, z, size * 2.2, p.l, 1.3, 0.3 + lead, 0); break;
      case 'plasma': boomFx(x, y, z, size * 0.55, 0.55, 1.25, 1.2, false, 'erevane');
        spr(PA, x, up, z, t0, 0, 0, 0, 0.1, size * 0.85, size * 0.6, 8, R(), p.b, 1.1, 0, 0, 0, 0);
        spr(PA, x, up, z, t0, 0, 0, 0, 0.36, size * 0.3, size * 1.7, 5, R(), p.a, 0.75, 0, 0, 0, 0); spr(PA, x, up, z, t0, 0, 0.01, 0, 0.3, size * 0.3, size * 1.4, 10, R(), p.b, 0.55, 0, 0, 0, 0);
        if (FX) { fx(FX.add, x, y + 0.6, z, 0, 0, 0, 0.5, size * 0.3, size * 2.6, 6, cs(p.a, 0.75), 0, 2.4, 0, 0.9);
          for (let i = cnt(8); i > 0; i--) { const a = R() * TAU, v = size * (4 + R() * 5); fx(FX.add, x, up, z, Math.cos(a) * v, size * (2 + R() * 4), Math.sin(a) * v, 0.3 + R() * 0.3, 0.65, 0.2, 2, p.s, 140, 1, 0, 1); } }
        light(x, z, size * 2.4, p.l, 1.4, 0.32 + lead, 0); break;
      case 'esporo': boomFx(x, y, z, size * 0.65, 0.8, 1.2, 0.5, false, 'tessara');
        spr(PA, x, up, z, t0, 0, 4, 0, 0.26, Math.min(6, size * 0.4), Math.min(13, size * 1.1), 9, R(), p.a, 0.65, 0, 0, 0, 0); spr(PA, x, up, z, t0, 0, 0, 0, 0.1, Math.min(13, size * 0.9), Math.min(8, size * 0.5), 8, R(), p.b, 0.85, 0, 0, 0, 0);
        if (FX) { for (let i = cnt(18); i > 0; i--) { const a = R() * TAU, v = size * (2 + R() * 4.5); fx(FX.add, x + Math.cos(a) * 2, up - 2, z + Math.sin(a) * 2, Math.cos(a) * v, size * (2.5 + R() * 4.5), Math.sin(a) * v, 0.55 + R() * 0.45, 1.5 + R() * 0.8, 0.6, 2, R() < 0.5 ? p.a : p.b, 240, 1, 0, 1); }
          for (let i = cnt(5); i > 0; i--) { const a = R() * TAU, r = R() * size * 0.6; fx(FX.alp, x + Math.cos(a) * r, y + size * 0.3, z + Math.sin(a) * r, Math.cos(a) * size * 0.5, size * 0.5 + R() * 4, Math.sin(a) * size * 0.5, 1.6 + R() * 1.2, size * 0.55, size * (1.5 + R() * 0.7), 3, SPORE, -1, 1.6, (R() - 0.5), 0.6, 0.05 + R() * 0.15); }
          for (let i = cnt(12); i > 0; i--) { const a = R() * TAU, r = R() * size * 0.9; fx(FX.add, x + Math.cos(a) * r, y + 2 + R() * size * 0.6, z + Math.sin(a) * r, (R() - 0.5) * 10, 6 + R() * 12, (R() - 0.5) * 10, 1.4 + R() * 1.4, 1.7, 0.6, 7, cs(p.a, 0.75), -2, 2, 0, 1, 0.1 + R() * 0.4); } } /* esporos que sobem devagar e piscam */
        light(x, z, size * 2.1, p.l, 1.15, 0.36 + lead, 0); break;
      case 'ressonancia': boomFx(x, y, z, size * 0.6, 1.0, 0.72, 1.45, rc.epic, 'quorith');
        spr(PA, x, up, z, t0, 0, 0, 0, 0.13, size * 1.5, size * 0.9, 2, R(), p.b, 1.45, 0, 0, 0, 0);
        spr(PA, x, y + size * 0.45, z, t0, 0, 0.01, 0, 0.42, size * 0.4, size * 2.3, 10, R(), p.a, 1.05, 0, 0, 0, 0);
        if (FX) { fx(FX.add, x, y + 0.6, z, 0, 0, 0, 0.5, size * 0.3, size * 2.9, 6, cs(p.a, 0.8), 0, 2.4, 0, 0.9); fx(FX.add, x, y + 0.6, z, 0, 0, 0, 0.55, size * 0.2, size * 2.0, 6, cs(p.b, 0.55), 0, 2.4, 0, 0.85, 0.12);
          fx(FX.add, x, y + size * 0.5, z, 0, 0, 0, 0.45, size * 0.3, size * 1.7, 8, cs(p.a, 0.85), 0, 2.2, 0, 0.9);
          for (let i = cnt(12); i > 0; i--) { const a = R() * TAU, v = size * (5 + R() * 6); fx(FX.add, x, up, z, Math.cos(a) * v, size * (2 + R() * 6), Math.sin(a) * v, 0.3 + R() * 0.3, 0.75, 0.2, 2, p.s, 120, 1, 0, 1); } }
        light(x, z, size * 2.3, p.l, 1.45, 0.36 + lead, 0); break;
      case 'acido': boomFx(x, y, z, size * 0.4, 0.7, 1.4, 0.3, rc.epic, 'vorag');
        spr(PA, x, up, z, t0, 0, 3, 0, 0.24, Math.min(8, size * 0.5), Math.min(20, size * 1.5), 9, R(), p.a, 0.75, 0, 0, 0, 0); spr(PA, x, up, z, t0, 0, 0, 0, 0.1, Math.min(15, size * 0.9), Math.min(10, size * 0.6), 8, R(), p.b, 0.85, 0, 0, 0, 0);
        if (FX) { for (let i = cnt(22); i > 0; i--) { const a = R() * TAU, v = size * (2.5 + R() * 5); fx(FX.add, x + Math.cos(a) * 2, up - 2, z + Math.sin(a) * 2, Math.cos(a) * v, size * (2.5 + R() * 5), Math.sin(a) * v, 0.55 + R() * 0.4, 1.5 + R() * 0.8, 0.6, 2, R() < 0.25 ? p.b : p.a, 230, 1, 0, 1); }
          fx(FX.add, x, H(x, -z) + 0.5, z, 0, 0, 0, 2.2, size * 0.8, size * 1.2, 6, cs(p.a, 0.32), 0, 1.2, 0, 0.9); fx(FX.add, x, H(x, -z) + 1, z, 0, 0, 0, 1.8, size * 0.6, size * 0.9, 7, cs(p.a, 0.45), 0, 1.2, 0, 0.8); /* poça de ácido que fica brilhando */
          for (let i = cnt(12); i > 0; i--) { const a = R() * TAU, r = R() * size * 0.75, bx = x + Math.cos(a) * r, bz = z + Math.sin(a) * r; fx(FX.add, bx, H(bx, -bz) + 0.6, bz, 0, 3, 0, 0.3 + R() * 0.25, 0.8, 2.6 + R() * 1.4, 7, p.b, 0, 2, 0, 0.9, 0.1 + R() * 1.6); } /* bolhas que estouram */
          for (let i = cnt(4); i > 0; i--) fx(FX.alp, x + (R() - 0.5) * size, y + 1, z + (R() - 0.5) * size, 0, 8 + R() * 6, 0, 1.5 + R(), size * 0.35, size * 1.0, 3, ACIDK, -2, 1.5, (R() - 0.5), 0.5, 0.2 + R() * 0.5);
          if (rc.halo) for (let i = cnt(5); i > 0; i--) { const a = R() * TAU, v = size * (2 + R() * 3); fx(FX.alp, x, up, z, Math.cos(a) * v, size * (3 + R() * 3), Math.sin(a) * v, 0.7 + R() * 0.5, 1.0, 0.8, 5, FLESH, 230, 1, (R() - 0.5) * 12, 1, 0, drop(x, up, z, 2)); } }
        light(x, z, size * 2.0, p.l, 1.1, 0.34 + lead, 0); break;
      default: boomFx(x, y, z, size, 1, 1, 1, false, rc.f); light(x, z, size * 2, p.l, 1.2, 0.3 + lead, 0);
    }
  }

  /* ---------- balas: voam pela GPU desde o disparo, da boca da arma ao alvo ---------- */
  const SHN = 256; const shW = new Int16Array(SHN).fill(-1), shF = new Int8Array(SHN), shK = new Uint8Array(SHN), shU = new Uint8Array(SHN), shT = new Float32Array(SHN), shA = new Float32Array(SHN), shX = new Float32Array(SHN), shY = new Float32Array(SHN), shH = new Float32Array(SHN), shTx = new Float32Array(SHN), shTy = new Float32Array(SHN), shTh = new Float32Array(SHN); let shI = 0;
  function remember(o, kind, arrive) { const j = shI; shI = (shI + 1) % SHN; const f = o.from, to = o.to; shW[j] = W_IDX[o.weapon] == null ? -1 : W_IDX[o.weapon]; shF[j] = F_IDX[o.faction] == null ? 0 : F_IDX[o.faction]; shK[j] = kind; shU[j] = 0; shT[j] = time; shA[j] = arrive; shX[j] = f[0]; shY[j] = -f[2]; shH[j] = f[1]; shTx[j] = to[0]; shTy[j] = -to[2]; shTh[j] = to[1]; }
  function trailFx(rc, x, y, z, dx, dy, dz, dl) { const p = rc.p;
    switch (rc.tr) {
      case 'fumaca': { const j = rc.hz * 0.7; fx(FX.alp, x + (R() - 0.5) * j, y + (R() - 0.5) * j, z + (R() - 0.5) * j, (R() - 0.5) * 4, 4 + R() * 4, (R() - 0.5) * 4, 1.0 + R() * 0.9, rc.hz * (1.3 + R() * 0.8), rc.hz * (2.8 + R() * 1.6), 3, SOOT, -1, 1.5, (R() - 0.5), 0.35 + R() * 0.25, dl); } /* posição, tamanho e tom sorteados: rastro contínuo, sem pontilhado */
        if (R() < 0.3) fx(FX.add, x, y, z, (R() - 0.5) * 8, 4 + R() * 8, (R() - 0.5) * 8, 0.25 + R() * 0.2, 0.55, 0.2, 2, p.s, 60, 1, 0, 1, dl); break;
      case 'esporo': fx(FX.add, x + (R() - 0.5) * 4, y + (R() - 0.5) * 3, z + (R() - 0.5) * 4, (R() - 0.5) * 7, 2 + R() * 6, (R() - 0.5) * 7, 0.7 + R() * 0.7, rc.t === 'obus' ? 1.3 : 0.95, 0.35, 7, p.g, -1, 2, 0, 1, dl);
        if (rc.t === 'obus' && R() < 0.45) fx(FX.alp, x, y, z, (R() - 0.5) * 3, 2 + R() * 2, (R() - 0.5) * 3, 1.0 + R() * 0.5, rc.hz * 0.5, rc.hz * 1.6, 3, HAZE, -1, 1.5, 0, 0.4, dl); break;
      case 'aneis': spr(PA, x, y, z, born() + dl, dx * 0.6, dy * 0.6, dz * 0.6, 0.45, rc.hz * 0.5, rc.hz * (rc.ring > 1 ? 2.1 : 1.6), 10, R(), rc.c, 0.8, 0, 0, 0, 0); break; /* ondas que ficam no ar atrás do projétil */
      case 'gotas': fx(FX.add, x, y - rc.hz * 0.4, z, (R() - 0.5) * 5, -4 - R() * 4, (R() - 0.5) * 5, 0.45 + R() * 0.3, 0.85, 0.4, 2, p.a, 170, 1, 0, 0.95, dl);
        if (R() < 0.35) fx(FX.alp, x, y, z, (R() - 0.5) * 2, 2, (R() - 0.5) * 2, 0.9, rc.hz * 0.35, rc.hz * 1.3, 3, HAZE, -1, 1.5, 0, 0.32, dl); break;
    } }
  function bullet(rc, o, dx, dy, dz, D, big) { const f = o.from, to = o.to, p = rc.p, t0 = born(); const fl = Math.max(0.035, D / rc.spd);
    muzzle(rc, f[0], f[1], f[2], dx, dy, dz, big, o.ambush, 0);
    const vx = (to[0] - f[0]) / fl, vy = (to[1] - f[1]) / fl, vz = (to[2] - f[2]) / fl;
    seg(SA, f[0], f[1], f[2], rc.wd * 0.45, to[0], to[1], to[2], rc.wd, rc.c, rc.I * (o.ambush ? 1.4 : 1), t0, fl, 1, R(), fl, rc.len, 1, 1);
    if (rc.hs >= 0) spr(PA, f[0], f[1], f[2], t0, vx, vy, vz, fl, rc.hz, rc.hz, rc.hs, -(0.01 + R()), rc.hc, rc.sol ? -rc.hI : rc.hI, R() * TAU, 0, 0, rc.asp);
    else spr(PA, f[0], f[1], f[2], t0, vx, vy, vz, fl, rc.wd * 2.7, rc.wd * 2.7, 0, -(0.01 + R()), rc.c, 0.75, 0, 0, 0, 1.4);
    if (rc.tr && FX) { const spc = rc.sp / Math.max(0.3, FX.mult); for (let d = spc * R(); d < D; d += spc * (0.5 + R())) { const k = d / D; trailFx(rc, f[0] + (to[0] - f[0]) * k, f[1] + (to[1] - f[1]) * k, f[2] + (to[2] - f[2]) * k, dx, dy, dz, k * fl); } }
    if (rc.burst) for (let i = 1; i <= rc.burst; i++) { const dl = i * rc.gap * (0.8 + R() * 0.4), ox = (R() - 0.5) * rc.sp, oz = (R() - 0.5) * rc.sp, oy = (R() - 0.5) * rc.sp * 0.4;
      seg(SA, f[0], f[1], f[2], rc.wd * 0.45, to[0] + ox, to[1] + oy, to[2] + oz, rc.wd, rc.c, rc.I, t0 + dl, fl, 1, R(), fl, rc.len, 1, 1);
      spr(PA, f[0], f[1], f[2], t0 + dl, (to[0] + ox - f[0]) / fl, (to[1] + oy - f[1]) / fl, (to[2] + oz - f[2]) / fl, fl, rc.hs >= 0 ? rc.hz * 0.9 : rc.wd * 2.4, rc.hs >= 0 ? rc.hz * 0.9 : rc.wd * 2.4, rc.hs >= 0 ? rc.hs : 0, -(0.01 + R()), rc.hs >= 0 ? rc.hc : rc.c, rc.hs >= 0 ? (rc.sol ? -rc.hI : rc.hI) : 0.7, R() * TAU, 0, 0, rc.hs >= 0 ? rc.asp : 1.4);
      if (i === 1 || R() < 0.5) muzzle(rc, f[0], f[1], f[2], dx, dy, dz, big, false, dl);
      if (FX) for (let q = cnt(2); q > 0; q--) { const a = R() * TAU, v = 25 + R() * 35; fx(FX.add, to[0] + ox, to[1] + oy, to[2] + oz, Math.cos(a) * v, 10 + R() * 30, Math.sin(a) * v, 0.15 + R() * 0.15, 0.5, 0.15, 2, p.s, 150, 1, 0, 1, dl + fl); } }
    if (rc.sniper) seg(SA, f[0], f[1], f[2], 0.34, to[0], to[1], to[2], 0.4, rc.c, 1.15, t0, 1.0, 6, R(), fl, 1, 1, 1);
    remember(o, 1, t0 + fl); }

  /* ---------- feixes (instantâneos no jogo: aqui ficam frações de segundo) ---------- */
  function beam(rc, o) { const f = o.from, to = o.to, p = rc.p, t0 = born(); const big = o.cls === 'vei' || o.cls === 'est';
    const ax = f[0], ay = f[1], az = f[2]; let bx = to[0], by = to[1], bz = to[2]; let dx = bx - ax, dy = by - ay, dz = bz - az; const D = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1; dx /= D; dy /= D; dz /= D;
    if (rc.t === 'lamina' || rc.t === 'mordida' || rc.t === 'chifre') { const back = Math.min(D * 0.4, 7); bx -= dx * back; bz -= dz * back; by += 2.5; } /* golpe no lado do alvo que dá para o atacante, acima do chão */
    switch (rc.t) {
      case 'arco': muzzle(rc, ax, ay, az, dx, dy, dz, big, false, 0);
        seg(SA, ax, ay, az, rc.wd, bx, by, bz, rc.wd, rc.c, rc.I, t0, rc.life, 3, R(), 1, 1, 1, 1);
        seg(SA, ax, ay, az, rc.wd * 0.7, bx, by, bz, rc.wd * 0.7, rc.c2, rc.I * 0.6, t0, rc.life * 0.8, 3, R(), 1, 1, 1, 1);
        hitSmall(rc, bx, by, bz, true, rc.c2); light(bx, bz, rc.lr, p.l, rc.lk, rc.life + lead, 1); break;
      case 'tendao': muzzle(rc, ax, ay, az, dx, dy, dz, big, false, 0);
        seg(SA, ax, ay, az, rc.wd * 0.9, bx, by, bz, rc.wd * 0.9, rc.c, rc.I, t0, rc.life, 4, R(), 1, 14, 1, 1);
        seg(SA, ax, ay, az, 0.32, bx, by, bz, 0.32, rc.c2, 0.45, t0, rc.life * 0.7, 2, R(), 1, 1, 1, 1);
        hitSmall(rc, bx, by, bz, true, rc.c2); light(bx, bz, rc.lr * 0.8, p.l, rc.lk * 0.8, rc.life + lead, 1); break;
      case 'sonico': muzzle(rc, ax, ay, az, dx, dy, dz, big, false, 0);
        seg(SA, ax, ay, az, rc.wd, bx, by, bz, rc.wd, rc.c, rc.I * 0.9, t0, rc.life, 7, R(), 1, 1, 1, 1);
        for (let j = 0; j < 3; j++) { const fl = 0.2; spr(PA, ax + dx * 3, ay + dy * 3, az + dz * 3, t0 + j * 0.055, dx * (D - 3) / fl, dy * (D - 3) / fl, dz * (D - 3) / fl, fl, 1.4, 3.9, 10, R(), rc.c2, 1.0, 0, 0, 0, 0); }
        hitSmall(rc, bx, by, bz, true); light(bx, bz, rc.lr, p.l, rc.lk, rc.life + lead, 0); break;
      case 'prisma': { muzzle(rc, ax, ay, az, dx, dy, dz, big, false, 0);
        const sx = ax + (bx - ax) * 0.68, sy = ay + (by - ay) * 0.68 + 5, sz = az + (bz - az) * 0.68;
        seg(SA, ax, ay, az, rc.wd, sx, sy, sz, rc.wd * 1.15, rc.c2, rc.I * 1.1, t0, rc.life, 2, R(), 1, 1, 1, 1);
        seg(SA, ax, ay, az, rc.wd * 2.4, sx, sy, sz, rc.wd * 2.8, rc.c, rc.I * 0.35, t0, rc.life, 2, R(), 1, 1, 1, 1);
        spr(PA, sx, sy, sz, t0, 0, 0, 0, rc.life, 8, 5.5, 2, R(), rc.c2, 1.45, 0, 0, 0, 0); spr(PA, sx, sy, sz, t0, 0, 0, 0, rc.life, 5.5, 6.5, 0, R(), rc.c, 0.85, 0, 0, 0, 0);
        const a0 = R() * TAU; for (let j = 0; j < 4; j++) { const a = a0 + j * TAU / 4 + (R() - 0.5) * 0.6, rr = 5 + R() * 11; const ex = bx + Math.cos(a) * rr, ez = bz + Math.sin(a) * rr, ey = H(ex, -ez) + 2; const hc = HUES[j];
          seg(SA, sx, sy, sz, rc.wd * 0.5, ex, ey, ez, rc.wd * 0.42, hc, rc.I * 1.05, t0, rc.life * 0.92, 2, R(), 1, 1, 1, 1); spr(PA, ex, ey, ez, t0, 0, 0, 0, 0.15, 3.0, 1.8, 8, R(), hc, 1.1, 0, 0, 0, 0); }
        light(sx, sz, 18, p.l, 1.0, rc.life + lead, 1); light(bx, bz, rc.lr, p.l, rc.lk, rc.life + lead, 1); break; }
      case 'helice': muzzle(rc, ax, ay, az, dx, dy, dz, big, false, 0);
        seg(SA, ax, ay, az, rc.wd, bx, by, bz, rc.wd, rc.c, rc.I, t0, rc.life, 4, R(), 2, 18, 1, 1);
        seg(SA, ax, ay, az, 0.34, bx, by, bz, 0.34, rc.c2, 0.55, t0, rc.life, 2, R(), 1, 1, 1, 1);
        hitSmall(rc, bx, by, bz, true); light(bx, bz, rc.lr, p.l, rc.lk, rc.life + lead, 0); break;
      case 'chama': { /* lança-chamas: jato que abre, línguas de fogo, brasas e fumaça; dura até o próximo jato (fogo contínuo) */
        const wb = Math.min(10, 3 + D * 0.1);
        seg(SA, ax, ay, az, 0.9, bx, by, bz, wb, rc.c, rc.I, t0, rc.life, 5, R(), 1, 1, 1, 1);
        spr(PA, ax, ay, az, t0, 0, 0, 0, rc.life, 2.0, 1.6, 0, R(), rc.c2, 0.8, 0, 0, 0, 0);
        if (FX) { const sp = D / 0.32; for (let i = cnt(16); i > 0; i--) { const j = 0.16, v = sp * (0.7 + R() * 0.45); fx(FX.add, ax + dx * 1.5, ay + dy * 1.5, az + dz * 1.5, (dx + (R() - 0.5) * j) * v, (dy + (R() - 0.5) * j) * v + 5, (dz + (R() - 0.5) * j) * v, 0.24 + R() * 0.16, 1.4 + R() * 0.8, 4.5 + R() * 4, 0, WHITE, -35, 1.6, (R() - 0.5) * 4, 0.9, R() * 0.3); }
          for (let i = cnt(4); i > 0; i--) { const v = sp * (0.6 + R() * 0.4); fx(FX.add, ax, ay, az, (dx + (R() - 0.5) * 0.3) * v, dy * v + 10 + R() * 20, (dz + (R() - 0.5) * 0.3) * v, 0.5 + R() * 0.3, 0.6, 0.2, 2, PAL.vehnar.s, 110, 1, 0, 1, R() * 0.25); }
          for (let i = cnt(3); i > 0; i--) fx(FX.alp, bx - dx * D * 0.15, by + 2, bz - dz * D * 0.15, dx * 6, 10 + R() * 8, dz * 6, 1.3 + R() * 0.7, 3.5, 9 + R() * 4, 3, SOOT, -2, 1.5, (R() - 0.5), 0.55, 0.15 + R() * 0.2); }
        light((ax + bx) * 0.5, (az + bz) * 0.5, 22, p.l, 0.95, rc.life + lead, 1); light(bx, bz, rc.lr, p.l, rc.lk, rc.life + lead, 1); break; }
      case 'lamina': { /* Erevane: a lâmina corre até o alvo girando e corta em dois arcos */
        const fl = Math.min(0.1, D / 900), ang = R() * TAU;
        spr(PA, ax, ay, az, t0, (bx - ax) / fl, (by - ay) / fl, (bz - az) / fl, fl * 1.05, 4.5, 5, 6, -(0.01 + R()), rc.c, 1.0, ang, 50, 0, 0);
        spr(PA, bx, by, bz, t0 + fl, 0, 0, 0, rc.life, 8, 10, 6, R(), rc.c, rc.I, ang + 0.8, 4, 0, 0); spr(PA, bx, by + 1, bz, t0 + fl + 0.05, 0, 0, 0, rc.life, 8.5, 10.5, 6, R(), rc.c2, rc.I * 0.9, ang - 1.0, -4, 0, 0);
        spr(PA, bx, by, bz, t0 + fl, 0, 0, 0, 0.06, 3.0, 1.6, 1, R(), rc.c, 0.8, 0, 0, 0, 0);
        if (FX) for (let i = cnt(5); i > 0; i--) { const a = R() * TAU, v = 30 + R() * 45; fx(FX.add, bx, by, bz, Math.cos(a) * v, 10 + R() * 30, Math.sin(a) * v, 0.18 + R() * 0.15, 0.55, 0.15, 2, p.s, 150, 1, 0, 1, fl); }
        light(bx, bz, rc.lr, p.l, rc.lk, 0.18 + lead, 0); break; }
      case 'mordida': { /* Prole: mandíbulas que fecham no alvo, icor e carne */
        const ang = R() * TAU, s = 5.2;
        spr(PA, bx, by, bz, t0, 0, 0, 0, rc.life, s, s * 0.85, 6, R(), rc.c, rc.I, ang + Math.PI * 0.5, -5, 0, 0); spr(PA, bx, by, bz, t0 + 0.02, 0, 0, 0, rc.life, s, s * 0.85, 6, R(), rc.c, rc.I, ang - Math.PI * 0.5, -5, 0, 0);
        spr(PA, bx, by, bz, t0 + 0.06, 0, 0, 0, 0.22, 2.4, 4.4, 9, R(), rc.c2, 0.7, 0, 0, 0, 0);
        if (FX) { for (let i = cnt(4); i > 0; i--) { const a = R() * TAU, v = 20 + R() * 25; fx(FX.add, bx, by, bz, Math.cos(a) * v, 18 + R() * 25, Math.sin(a) * v, 0.35 + R() * 0.2, 0.65, 0.3, 2, PAL.vorag.a, 220, 1, 0, 0.9, 0.06); }
          for (let i = cnt(3); i > 0; i--) { const a = R() * TAU, v = 15 + R() * 20; fx(FX.alp, bx, by, bz, Math.cos(a) * v, 15 + R() * 20, Math.sin(a) * v, 0.5 + R() * 0.3, 0.8, 0.7, 5, FLESH, 220, 1, (R() - 0.5) * 12, 1, 0.06, drop(bx, by, bz, 2)); } }
        light(bx, bz, 8, DEVL, 0.35, 0.12 + lead, 0); break; }
      case 'chifre': { /* Prole: chifrada pesada — arco de osso, poeira e lascas */
        const ang = R() * TAU;
        spr(PA, bx, by, bz, t0, 0, 0, 0, rc.life, 9.5, 11.5, 6, R(), rc.c, rc.I, ang, 3, 0, 0); spr(PA, bx, by + 1, bz, t0 + 0.04, 0, 0, 0, rc.life, 10.5, 12.5, 6, R(), rc.c2, rc.I * 0.55, ang + 0.35, 3, 0, 0);
        spr(PA, bx, by, bz, t0 + 0.05, 0, 0, 0, 0.08, 3.6, 2.2, 8, R(), BONE, 0.8, 0, 0, 0, 0);
        if (FX) { for (let i = cnt(4); i > 0; i--) { const a = R() * TAU; fx(FX.alp, bx + Math.cos(a) * 3, H(bx, -bz) + 1, bz + Math.sin(a) * 3, Math.cos(a) * (14 + R() * 12), 4 + R() * 4, Math.sin(a) * (14 + R() * 12), 0.9 + R() * 0.4, 2.4, 7 + R() * 3, 4, DUST, 0, 2, 0, 0.55); }
          for (let i = cnt(3); i > 0; i--) { const a = R() * TAU, v = 20 + R() * 25; fx(FX.alp, bx, by, bz, Math.cos(a) * v, 20 + R() * 20, Math.sin(a) * v, 0.6, 0.7, 0.6, 5, CHIP, 230, 1, (R() - 0.5) * 14, 1, 0, drop(bx, by, bz, 3)); } }
        light(bx, bz, 10, DUST, 0.4, 0.15 + lead, 0); break; }
    }
  }
  const HUES = [PAL.quorith.a, [2.6, 1.1, 2.2], [1.6, 2.0, 2.8], [2.4, 2.2, 2.6]];

  /* ---------- projéteis em arco: estado por id num mapa direto (sem alocação) ---------- */
  const N = 2048, NM = N - 1, HN = 8;
  const sId = new Int32Array(N).fill(-1), sSeen = new Int32Array(N), sRec = new Int16Array(N), sLink = new Uint8Array(N), sIn = new Uint8Array(N);
  const sSx = new Float32Array(N), sSy = new Float32Array(N), sOx = new Float32Array(N), sOy = new Float32Array(N), sFy = new Float32Array(N), sDx = new Float32Array(N), sDy = new Float32Array(N);
  const sPx = new Float32Array(N), sPy = new Float32Array(N), sPz = new Float32Array(N), sHas = new Uint8Array(N), sAcc = new Float32Array(N), sAcc2 = new Float32Array(N), sSd = new Float32Array(N), sZ0 = new Float32Array(N), sZf = new Float32Array(N), sZt = new Float32Array(N), sTc = new Float32Array(N);
  const sHn = new Uint8Array(N), sHi = new Uint8Array(N), sH = new Float32Array(N * HN * 3); const act = new Int32Array(N); let nAct = 0;
  function newSlot(s, id, rc, o, mx, my) {
    sId[s] = id; sRec[s] = rc.idx; sLink[s] = 0; sAcc[s] = 0; sAcc2[s] = 0; sHn[s] = 0; sHi[s] = 0; sSd[s] = R(); sZt[s] = -1e9; sZf[s] = 0; sZ0[s] = 0; sTc[s] = time; sHas[s] = 0;
    const v = o.vel, sp = Math.sqrt(v[0] * v[0] + v[2] * v[2]) || 1, dx = v[0] / sp, dy = -v[2] / sp; sDx[s] = dx; sDy[s] = dy;
    const wi = W_IDX[o.weapon] == null ? -1 : W_IDX[o.weapon], fi = F_IDX[o.faction] == null ? 0 : F_IDX[o.faction];
    let best = -1, bd = (30 + sp * 0.25) * (30 + sp * 0.25);
    for (let j = 0; j < SHN; j++) { if (shK[j] !== 2 || shW[j] !== wi || shF[j] !== fi || shU[j] || time - shT[j] > 0.6) continue; const ex = shX[j] - mx, ey = shY[j] - my, d = ex * ex + ey * ey; if (d < bd) { bd = d; best = j; } }
    if (best >= 0) { shU[best] = 1; sLink[s] = 1; /* começo na linha do projétil, junto da boca; o desvio lateral (figura do esquadrão, cano da torreta) some no voo */
      const qx = shX[best] - mx, qy = shY[best] - my, al = qx * dx + qy * dy, Sx = mx + dx * al, Sy = my + dy * al; sSx[s] = Sx; sSy[s] = Sy; sOx[s] = shX[best] - Sx; sOy[s] = shY[best] - Sy; sFy[s] = shH[best]; }
    else { sSx[s] = mx; sSy[s] = my; sOx[s] = 0; sOy[s] = 0; sFy[s] = o.at[1]; }
    if (!sIn[s]) { sIn[s] = 1; act[nAct++] = s; }
  }
  function histPush(s, x, y, z) { const i = sHi[s], o = (s * HN + i) * 3; sH[o] = x; sH[o + 1] = y; sH[o + 2] = z; sHi[s] = (i + 1) % HN; if (sHn[s] < HN) sHn[s]++; }
  /* fita do rastro: da cabeça para trás pelos pontos guardados; S = lote (dinâmico no voo, envelhecido no resto que fica no ar) */
  function ribbon(S, s, rc, hx, hy, hz, t0, life) { let px = hx, py = hy, pz = hz, acc = 0, wP = rc.rw, iP = rc.rI; const n = sHn[s];
    for (let j = 0; j < n; j++) { const o = (s * HN + ((sHi[s] - 1 - j + HN * 2) % HN)) * 3; const qx = sH[o], qy = sH[o + 1], qz = sH[o + 2]; const ex = qx - px, ey = qy - py, ez = qz - pz; const d = Math.sqrt(ex * ex + ey * ey + ez * ez); if (d < 0.01) continue;
      let f = (acc + d) / rc.rib, ax = qx, ay = qy, az = qz; if (f > 1) { const c = (rc.rib - acc) / d; ax = px + ex * c; ay = py + ey * c; az = pz + ez * c; f = 1; }
      const w = rc.rw * (1 - f * 0.75), I = rc.rI * (1 - f) * (1 - f);
      seg(S, ax, ay, az, w, px, py, pz, wP, rc.c, 1, t0, life, 8, sSd[s], 1, 1, I, iP); acc += d; if (f >= 1) break; px = ax; py = ay; pz = az; wP = w; iP = I; } }
  function drawShell(o, rc) {
    const a = o.at, v = o.vel; const id = o.id | 0, s = id & NM, mx = a[0], my = -a[2];
    if (sId[s] !== id) newSlot(s, id, rc, o, mx, my); sSeen[s] = frameNo;
    let vx = mx, vy = my; const linked = sLink[s] === 1;
    const done = (mx - sSx[s]) * sDx[s] + (my - sSy[s]) * sDy[s];
    if (linked) { const bl = Math.max(0, 1 - done / 50); vx = mx + sOx[s] * bl; vy = my + sOy[s] * bl; }
    /* altura do sim, suavizada: o sim muda a altura 10 vezes por segundo (x e y já vêm interpolados); entre um passo e outro a altura
       segue a parábola pelas 3 últimas amostras, com o mesmo atraso de um passo da interpolação de x e y; parte da saída do sim (6 + 3) */
    const zs = a[1] - H(mx, my);
    if (sZt[s] < -1e8) { sZf[s] = 9; sZ0[s] = 18 - zs; sZt[s] = zs; sTc[s] = time; } else if (Math.abs(zs - sZt[s]) > 1e-4) { sZ0[s] = sZf[s]; sZf[s] = sZt[s]; sZt[s] = zs; sTc[s] = time; }
    const u = Math.min(1, (time - sTc[s]) / TK), z0 = sZ0[s], z1 = sZf[s], z2 = sZt[s]; const zc = z1 + u * (z2 - z0) * 0.5 + u * u * (z2 - 2 * z1 + z0) * 0.5;
    let y = H(vx, vy) + zc; if (linked) y += (sFy[s] - (H(sSx[s], sSy[s]) + 9)) * Math.max(0, 1 - done / 45);
    const wx = vx, wz = -vy;
    let ddx = 0, ddy = 0, ddz = 0, ml = 0; if (sHas[s]) { ddx = wx - sPx[s]; ddy = y - sPy[s]; ddz = wz - sPz[s]; ml = Math.sqrt(ddx * ddx + ddy * ddy + ddz * ddz); }
    let nx, ny, nz; if (ml > 0.05) { nx = ddx / ml; ny = ddy / ml; nz = ddz / ml; } else { const l2 = Math.sqrt(v[0] * v[0] + v[2] * v[2]) || 1; nx = v[0] / l2; ny = 0; nz = v[2] / l2; }
    if (sHas[s] && ml > 0) { /* rastros no caminho percorrido neste quadro, a espaços fixos (não depende da taxa de quadros) */
      const hs = rc.rib / HN; let d0 = hs - sAcc[s]; while (d0 <= ml) { histPush(s, sPx[s] + ddx * d0 / ml, sPy[s] + ddy * d0 / ml, sPz[s] + ddz * d0 / ml); d0 += hs; } sAcc[s] = ml - (d0 - hs);
      if (rc.tr && FX && rc.sp > 0) { const spc = rc.sp / Math.max(0.3, FX.mult); let e0 = spc - sAcc2[s], guard = 0; while (e0 <= ml && guard++ < 32) { const f = e0 / ml; trailFx(rc, sPx[s] + ddx * f, sPy[s] + ddy * f, sPz[s] + ddz * f, nx, ny, nz, 0); e0 += spc; } sAcc2[s] = ml - (e0 - spc); }
    } else histPush(s, wx, y, wz);
    sPx[s] = wx; sPy[s] = y; sPz[s] = wz; sHas[s] = 1;
    if (rc.halo) spr(PD, wx, y, wz, 0, 0, 0, 0, 1, rc.hz * 1.8, rc.hz * 1.8, 9, sSd[s], rc.halo, 0.45, 0, 0, 0, 0);
    spr(PD, wx, y, wz, 0, nx, ny, nz, 1, rc.hz, rc.hz, rc.hs, sSd[s], rc.hc, rc.sol ? -rc.hI : rc.hI, sSd[s] * TAU, 0, 0, rc.asp); /* sol: corpo sólido (casulo, glóbulo, ovo, espinho) que segura a cor de dia */
    if (rc.hs === 0 || rc.hs === 7) spr(PD, wx, y, wz, 0, 0, 0, 0, 1, rc.hz * (rc.sol ? 2.1 : 2.5), rc.hz * (rc.sol ? 2.1 : 2.5), 9, sSd[s], rc.c, rc.sol ? 0.3 : 0.5, 0, 0, 0, 0); /* halo; no corpo sólido fica fraco para a cor do corpo aparecer de dia */
    if (rc.ring) { spr(PD, wx, y, wz, 0, nx, ny, nz, 1, rc.hz * 1.9, rc.hz * 1.9, 10, sSd[s], rc.c, 0.9, 0, 0, 0, 0); if (rc.ring > 1) spr(PD, wx, y, wz, 0, nx, ny, nz, 1, rc.hz * (2.5 + 0.4 * Math.sin(time * 9 + sSd[s] * 6)), rc.hz * 2.6, 10, sSd[s], rc.p.b, 0.55, 0, 0, 0, 0); }
    ribbon(SD, s, rc, wx, y, wz, 0, 1);
    if (rc.pr && ((frameNo + s) & 1) === 0) light(wx, wz, rc.pr, rc.p.l, rc.pk, lead * 2.2, 0);
  }
  /* projétil que sumiu (acertou ou entrou na névoa): a fita fica no ar um instante e apaga */
  function endShell(s, t) { const rc = RLIST[sRec[s]]; if (rc && sHas[s]) ribbon(SA, s, rc, sPx[s], sPy[s], sPz[s], t, 0.22); }

  const CB = {
    shot(o) { const rc = rec(o.faction, o.weapon, o.beam ? 2 : 0); fxOn(); try {
      if (o.beam || (rc.t !== 'bala' && rc.t !== 'obus')) { beam(rc, o); return; }
      const f = o.from, to = o.to; let dx = to[0] - f[0], dy = to[1] - f[1], dz = to[2] - f[2]; const D = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1; dx /= D; dy /= D; dz /= D;
      const big = o.cls === 'vei' || o.cls === 'est';
      if (rc.t === 'bala') { bullet(rc, o, dx, dy, dz, D, big); return; }
      remember(o, 2, 0); muzzle(rc, f[0], f[1], f[2], dx, dy, dz, big, o.ambush, 0);
      if (rc.dbl) { const sx = -dz * 3.2, sz = dx * 3.2; muzzle(rc, f[0] + sx, f[1], f[2] + sz, dx, dy, dz, big, false, 0.08); const fl = D / 300, g = 140; spr(PA, f[0] + sx, f[1], f[2] + sz, born() + 0.08, (to[0] - f[0]) / fl, (to[1] - f[1]) / fl + g * fl * 0.5, (to[2] - f[2]) / fl, fl, rc.hz * 0.9, rc.hz * 0.9, 0, -(0.01 + R()), rc.hc, rc.hI * 0.9, 0, 0, g, 0); }
    } finally { fxOff(); } },
    impact(o) { const rc = rec(o.faction, o.weapon, o.splash > 0 ? 1 : 0), a = o.at; fxOn(); try {
      if (rc.t === 'chama') { /* chão em chamas onde o jato bate */ const x = a[0], y = a[1], z = a[2], p = rc.p;
        if (FX) { if (FX.fire) for (let i = cnt(5); i > 0; i--) FX.fire(x + (R() - 0.5) * 12, y, z + (R() - 0.5) * 12, 5 + R() * 3, 1);
          else for (let i = cnt(4); i > 0; i--) fx(FX.add, x + (R() - 0.5) * 10, y + 1, z + (R() - 0.5) * 10, (R() - 0.5) * 6, 10 + R() * 12, (R() - 0.5) * 6, 0.5 + R() * 0.3, 3, 7, 0, _T, -10, 1.6, 0, 0.9, R() * 0.15); }
        light(x, z, 32, p.l, 1.35, 0.55 + lead, 1); return; }
      if (rc.t === 'prisma') { const x = a[0], y = a[1], z = a[2], p = rc.p; if (FX) { fx(FX.add, x, y + 0.6, z, 0, 0, 0, 0.45, 3, (o.splash || 20) * 1.4, 6, cs(p.a, 0.85), 0, 2.4, 0, 0.9);
          for (let i = cnt(8); i > 0; i--) { const q = R() * TAU, v = 40 + R() * 50; fx(FX.add, x, y + 3, z, Math.cos(q) * v, 15 + R() * 40, Math.sin(q) * v, 0.25 + R() * 0.25, 0.65, 0.2, 2, p.s, 120, 1, 0, 1); } } return; }
      if (rc.t === 'obus') { if (o.splash > 0) boom(rc, a[0], a[1], a[2], o.splash, o.hit); else hitSmall(rc, a[0], a[1] + 2, a[2], !!o.hit); return; }
      /* bala: casa com o disparo que mirou ali e espera a bala da tela chegar; acerto no ar (drones) fica na altura do alvo */
      const mx = a[0], my = -a[2], wi = W_IDX[o.weapon] == null ? -1 : W_IDX[o.weapon], fi = F_IDX[o.faction] == null ? 0 : F_IDX[o.faction]; let best = -1, bd = 60 * 60;
      for (let j = 0; j < SHN; j++) { if (shK[j] !== 1 || shW[j] !== wi || shF[j] !== fi || shU[j] || time - shT[j] > 0.8) continue; const ex = shTx[j] - mx, ey = shTy[j] - my, d = ex * ex + ey * ey; if (d < bd) { bd = d; best = j; } }
      let x = mx, z = a[2], y = a[1] + 0.5, dl = 0; if (best >= 0) { shU[best] = 1; dl = Math.max(0, Math.min(0.4, shA[best] - born())); if (o.hit) { y = shTh[best]; const ex = shX[best] - shTx[best], ey = shY[best] - shTy[best], el = Math.sqrt(ex * ex + ey * ey) || 1, b = Math.min(9, el * 0.3); x = shTx[best] + ex / el * b; z = -(shTy[best] + ey / el * b); } } else if (o.hit) y = a[1] + 4; /* acerto: na face do alvo que dá para o atirador, na altura do alvo */
      if (o.splash > 0) boom(rc, mx, a[1], a[2], o.splash, o.hit); else hitSmall(rc, x, y, z, !!o.hit, null, dl);
    } finally { fxOff(); } },
    proj(o) { if (!o.arc && rec(o.faction, o.weapon, 0).t === 'bala') return; /* balas já voam pela GPU desde o disparo */
      const r1 = rec(o.faction, o.weapon, 1), rc = r1.t === 'obus' ? r1 : rec(o.faction, 'canhao', 1); fxOn(); try { drawShell(o, rc); } finally { fxOff(); } },
    channel(o) { const p = PAL[o.faction] || PAL.vehnar, dev = o.kind === 'devorar', f = o.from, t = o.to, c = dev ? BLOOD : p.a;
      seg(SD, f[0], f[1], f[2], dev ? 1.5 : 1.1, t[0], t[1], t[2], dev ? 1.8 : 1.3, c, 1, 0, 1, 9, 0.37, 1, 1, 1, 1);
      seg(SD, f[0], f[1], f[2], 0.3, t[0], t[1], t[2], 0.3, dev ? PAL.vorag.a : p.b, 0.5, 0, 1, 2, 0.61, 1, 1, 1, 1);
      spr(PD, t[0], t[1], t[2], 0, 0, 0, 0, 1, 4.2, 4.2, 9, 0.5, c, 0.6, 0, 0, 0, 0); spr(PD, f[0], f[1], f[2], 0, 0, 0, 0, 1, 1.6, 1.6, 0, 0.5, dev ? PAL.vorag.a : p.b, 0.6, 0, 0, 0, 0);
      if (FX && R() < 0.35 * FX.mult) { fxOn(); try { const fl = 0.45; fx(FX.add, t[0] + (R() - 0.5) * 4, t[1] + (R() - 0.5) * 4, t[2] + (R() - 0.5) * 4, (f[0] - t[0]) / fl, (f[1] - t[1]) / fl, (f[2] - t[2]) / fl, fl, dev ? 1.4 : 1.1, 0.5, dev ? 7 : 7, dev ? BLOOD : p.g, 0, 1.5, 0, 0.9); } finally { fxOff(); } }
      if (((frameNo * 7) % 3) === 0) light(t[0], t[2], 14, dev ? DEVL : p.l, 0.45, lead * 3.2, 1); },
    frame(dt, t, camera) { lead = Math.min(0.1, Math.max(0.001, dt || 1 / 60)); time = t;
      let w = 0; for (let j = 0; j < nAct; j++) { const s = act[j]; if (sSeen[s] === frameNo) { act[w++] = s; continue; } endShell(s, t); sIn[s] = 0; sId[s] = -1; sHas[s] = 0; } nAct = w;
      U.clock.value = t; uAged.value = t; uDyn.value = 0; if (camera && camera.near) U.near.value = camera.near;
      flush(SD); flush(SA); flush(PD); flush(PA); frameNo++; },
    /* 4.3g: contagens para o relatório e a QA (pico de instâncias dinâmicas, nascimentos nos lotes envelhecidos) */
    stats() { return { emVoo: nAct, fitasDinPico: SD.peak, spritesDinPico: PD.peak, fitasNascidas: SA.born, spritesNascidos: PA.born, capFitas: SA.cap, capSprites: PA.cap, chamadas: 4, programas: 2 }; },
  };
  return CB;
}
ARD.combat3d = { create, STYLE, PAL, ARS };
})(globalThis.ARD = globalThis.ARD || {});
