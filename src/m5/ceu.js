/* Aether Rift: Dominion — Motor 5 (5.0d): o céu da partida. Só no Motor 5 e só visual (nada aqui lê ou muda a simulação além do relógio sim.time).
   - O sol anda no ciclo de 12,5 min do jogo (R.night = (1 − cos θ)/2, θ = 2π·t/750): meio-dia em θ = 0 com o sol de sempre (40° de elevação, o
     R.sunDir da 4.3b), pôr do sol em θ = 90° (R.night = 0,5) à frente da câmera padrão, meia-noite em θ = 180°, nascer em θ = 270°. A lua fica do
     outro lado do céu e é a luz da noite (a mesma luz azulada de antes, agora vinda dela). No Cinturão (espaço) o sol gira em volta do zênite a 40°,
     sem pôr do sol e sem lua.
   - A luz direcional anda em degraus de 0,25° (um a cada ~0,5 s) e não desce abaixo de 12°: entre um degrau e outro as cascatas não mudam (sem
     tremor), e a sombra nunca vira uma faixa comprida demais. Na troca sol ↔ lua (horizonte) a luz apaga e acende de novo (crepúsculo).
   - A cor da luz e do fundo segue a atmosfera: o sol passa pela mesma conta do céu (Preetham, a do SkyMesh do r186 e da Sala de Comando) e
     avermelha perto do horizonte; o fundo e a bruma ganham a cor do horizonte no crepúsculo. Ao meio-dia tudo é exatamente o de antes.
   - O céu visível é físico (o Preetham do SkyMesh com as nuvens dele, a compressão das altas luzes e as estrelas da Sala), com a lua, as estrelas
     girando em volta do polo e, no clima aurora, cortinas de luz. Ele é desenhado DEPOIS do opaco, no fundo (z = w): só custa onde o céu aparece.
   - O reflexo do céu (PMREM) é refeito quando a hora muda, em degraus (2°, ~4 s; 4° na Baixa), espalhado em quadros num alvo à parte e copiado
     de uma vez no alvo de sempre (a cena não troca de textura: nenhum material se remonta e nenhum pipeline nasce).
   - Raios de sol (Alta e Ultra): uma marcha curta na sombra das cascatas e do dossel da Tempestade de Éter, pela poeira do ar baixo, entrando no
     pós (src/m5/pos.js) como contraste: o ar na sombra apaga parte da bruma e o ar iluminado ganha um pouco de sol.
   Chaves de URL: ?m5ceu=0 (tudo como na 5.0c.1), ?hora=H (hora fixa, 0–24; 12 = meio-dia), ?m5ceuenv=0 (reflexo fixo, como antes),
   ?m5aurora=0 (sem as cortinas), ?m5raios=0|1 (raios de sol; padrão: Alta e Ultra), ?m5luzdegrau=G (degrau da luz em graus). */
(function (ARD) {
'use strict';
const M5 = ARD.m5 = ARD.m5 || {};
const QS = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
const DEG = Math.PI / 180, TAU = Math.PI * 2;
const C = M5.ceuCfg = {
  on: QS.get('m5ceu') !== '0',
  hora: QS.get('hora') != null && QS.get('hora') !== '' ? +QS.get('hora') : null, /* null: segue o relógio da partida */
  env: QS.get('m5ceuenv') !== '0',
  aurora: QS.get('m5aurora') !== '0',
  raios: QS.get('m5raios'), /* null: Alta e Ultra; '0' nunca; '1' sempre que houver sombra */
  degrau: (+QS.get('m5luzdegrau') || 0.25) * DEG, /* degrau da luz direcional */
  elevMin: 12 * DEG, /* a luz não desce abaixo disto (a sombra fica no máximo 4,7× a altura) */
  apaga: Math.sin(3.5 * DEG), /* na troca sol ↔ lua a luz some entre 0 e 3,5° */
  envPasso: 2 * DEG, envPassoBaixa: 4 * DEG, envIntervalo: 1.2, /* reflexo: degrau da hora e intervalo mínimo (s) */
};
/* ---------- o caminho do sol ---------- */
const LEN = Math.hypot(-470, 640, 600); /* o R.sunDir de sempre: [-470, 640, 600], comprimento ~995 (a sombra única e a bruma usam esse tamanho) */
const N0 = [-470 / LEN, 640 / LEN, 600 / LEN]; /* sol do meio-dia = o sol fixo da 4.3b */
const NH = (() => { const l = Math.hypot(N0[0], N0[2]); return [N0[0] / l, 0, N0[2] / l]; })();
const W0 = [-NH[2], 0, NH[0]]; /* poente: horizontal, perpendicular ao meio-dia, à frente da câmera padrão (yaw π/4) */
const AX = [N0[1] * W0[2] - N0[2] * W0[1], N0[2] * W0[0] - N0[0] * W0[2], N0[0] * W0[1] - N0[1] * W0[0]]; /* eixo do giro (o sol vai do meio-dia ao poente) */
/* estado do quadro (reaproveitado: nada é alocado por quadro) */
const E = M5.ceuEstado = { th: 0, thL: 0, sol: [N0[0], N0[1], N0[2]], lua: [-N0[0], -N0[1], -N0[2]], luz: [N0[0], N0[1], N0[2]], deSol: true, k: 1, elev: 40 * DEG, noite: 0, espaco: false, pronto: false, cor: [1, 1, 1], foto: false };
const solEm = (th, out, espaco) => { /* direção do sol no ângulo th do ciclo */
  if (espaco) { const e = 40 * DEG, a = Math.atan2(N0[2], N0[0]) + th; out[0] = Math.cos(a) * Math.cos(e); out[1] = Math.sin(e); out[2] = Math.sin(a) * Math.cos(e); return out; } /* Cinturão: gira em volta do zênite */
  const c = Math.cos(th), s = Math.sin(th); out[0] = c * N0[0] + s * W0[0]; out[1] = c * N0[1] + s * W0[1]; out[2] = c * N0[2] + s * W0[2]; return out; };
const _q = [0, 0, 0];
/* hora → θ e noite; chamado pelo render3d logo depois de calcular R.night e antes do updateCamera (a luz e as cascatas já saem no lugar) */
M5.ceuHora = function (R, sim, PH) {
  if (!C.on || !R) return; const X = M5.cur; E.espaco = !!R.cinturao; E.foto = !!(R.photo && R.photo.on);
  let th;
  if (C.hora != null && isFinite(C.hora)) { th = (C.hora - 12) / 24 * TAU; if (!(PH && PH.night != null)) R.night = (1 - Math.cos(th)) / 2; } /* hora fixa (fotos e testes) */
  else if (PH && PH.night != null) th = Math.acos(Math.max(-1, Math.min(1, 1 - 2 * PH.night))); /* Modo Foto com hora própria: o lado da tarde */
  else if (R.forceDay) th = 0; /* ?dia=1 e o Teste de desempenho: meio-dia (o sol de sempre) */
  else th = TAU * ((ARD.modos && ARD.modos.noite(sim) ? ARD.modos.HORA_NOITE /* 5.0g: Noite Eterna */ : sim && sim.time) || 0) / 750;
  E.th = th; E.noite = R.night;
  solEm(th, E.sol, E.espaco); E.lua[0] = -E.sol[0]; E.lua[1] = -E.sol[1]; E.lua[2] = -E.sol[2];
  /* a luz: o mesmo caminho em degraus; o sol de dia, a lua de noite (no espaço, sempre o sol) */
  const thq = Math.round(th / C.degrau) * C.degrau; E.thL = thq; solEm(thq, _q, E.espaco);
  E.deSol = E.espaco || _q[1] >= 0; if (!E.deSol) { _q[0] = -_q[0]; _q[1] = -_q[1]; _q[2] = -_q[2]; }
  E.elev = Math.asin(Math.max(-1, Math.min(1, _q[1]))); /* elevação de verdade de quem ilumina (antes do piso) */
  E.k = E.espaco ? 1 : smooth(0, C.apaga, Math.abs(_q[1])); /* apaga perto do horizonte (troca sol ↔ lua) */
  if (_q[1] < Math.sin(C.elevMin)) { const h = Math.hypot(_q[0], _q[2]) || 1, ce = Math.cos(C.elevMin); _q[0] = _q[0] / h * ce; _q[2] = _q[2] / h * ce; _q[1] = Math.sin(C.elevMin); }
  E.luz[0] = _q[0]; E.luz[1] = _q[1]; E.luz[2] = _q[2];
  if (!E.foto) { const sd = R.sunDir; sd[0] = _q[0] * LEN; sd[1] = _q[1] * LEN; sd[2] = _q[2] * LEN; } /* no Modo Foto a luz é dele (src/photo3d.js) */
  E.pronto = true; if (X) X.ceuTh = th;
};
function smooth(a, b, x) { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }

/* ---------- a atmosfera na CPU: a mesma conta do céu (Preetham do SkyMesh do r186), para a cor da luz, do fundo, do reflexo e a exposição ---------- */
const TR = [5.804542996261093E-6, 1.3562911419845635E-5, 3.0265902468824876E-5], MIE = [1.8399918514433978E14, 2.7798023919660528E14, 4.0790479543861094E14];
const AT = M5.ceuAtmo = { turb: 2.4, ray: 1.25, mie: 0.0045, g: 0.82, bR: [0, 0, 0], bM: [0, 0, 0], sunE: 0 };
const AT0 = { turb: AT.turb, ray: AT.ray };
function atmoPrep(sol) { /* o que o vértice do SkyMesh calcula: extinção de Rayleigh e de Mie e a intensidade do sol. Com o sol baixo o ar engrossa (turbidez de
   2,4 a 6 e Rayleigh de 1,25 a 2,25 entre 25° e o horizonte): o poente sai laranja e o céu em volta, azul fundo; acima de 25°, o céu do meio-dia */
  const lo = 1 - smooth(0, Math.sin(25 * DEG), Math.max(sol[1], 0)); AT.turb = AT0.turb + 3.6 * lo; AT.ray = AT0.ray + 1.0 * lo;
  for (let i = 0; i < 3; i++) { AT.bR[i] = TR[i] * AT.ray; AT.bM[i] = 0.434 * (0.2 * AT.turb * 10E-18) * MIE[i] * AT.mie; }
  const za = Math.acos(Math.max(-1, Math.min(1, sol[1]))); AT.sunE = 1000 * Math.max(0, 1 - Math.exp(-(1.6110731556870734 - za) / 1.5)); }
function fex(dy, out) { /* extinção ao longo de uma direção de elevação dy */
  const za = Math.acos(Math.max(0, dy)), inv = 1 / (Math.cos(za) + 0.15 * Math.pow(93.885 - za / DEG, -1.253)); const sR = 8.4E3 * inv, sM = 1.25E3 * inv;
  for (let i = 0; i < 3; i++) out[i] = Math.exp(-(AT.bR[i] * sR + AT.bM[i] * sM)); return out; }
const _fx = [0, 0, 0], _ce = [0, 0, 0];
function ceuEm(d, sol, out) { /* o céu (sem nuvens) numa direção, linear, na escala do SkyMesh (× 0,04) */
  fex(d[1], _fx); const ct = d[0] * sol[0] + d[1] * sol[1] + d[2] * sol[2]; const c = ct * 0.5 + 0.5, rP = 0.05968310365946075 * (1 + c * c);
  const g2 = AT.g * AT.g, mP = 0.07957747154594767 * (1 - g2) / Math.pow(1 - 2 * AT.g * ct + g2, 1.5); const k5 = Math.min(1, Math.max(0, Math.pow(1 - sol[1], 5)));
  for (let i = 0; i < 3; i++) { const b = AT.bR[i] + AT.bM[i], bt = AT.bR[i] * rP + AT.bM[i] * mP, s = AT.sunE * bt / b; let L = Math.pow(s * (1 - _fx[i]), 1.5); L *= 1 + (Math.pow(s * _fx[i], 0.5) - 1) * k5; out[i] = (L + 0.1 * _fx[i]) * 0.04 + (i === 1 ? 0.0003 : i === 2 ? 0.00075 : 0); }
  return out; }
const lum = c => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
const _d = [0, 0, 0], _hor = [0, 0, 0], _top = [0, 0, 0];
function medias(sol, hor, top) { /* médias do horizonte (elevação ~6°) e do alto (~45°) em 8 azimutes */
  hor[0] = hor[1] = hor[2] = 0; top[0] = top[1] = top[2] = 0;
  for (let k = 0; k < 16; k++) { const a = (k >> 1) / 8 * TAU, e = k & 1 ? 0.7 : 0.1, o = k & 1 ? top : hor, ch = Math.sqrt(1 - e * e); _d[0] = Math.cos(a) * ch; _d[1] = e; _d[2] = Math.sin(a) * ch; ceuEm(_d, sol, _ce); o[0] += _ce[0] / 8; o[1] += _ce[1] / 8; o[2] += _ce[2] / 8; } } /* sem alocar (roda a cada quadro) */
/* referência do meio-dia (o céu e a luz de antes) */
const REF = { hor: [0, 0, 0], top: [0, 0, 0], fx: [0, 0, 0], lumTop: 1, lumHor: 1 };
function refPrep() { atmoPrep(N0); medias(N0, REF.hor, REF.top); fex(N0[1], REF.fx); REF.lumTop = Math.max(1e-6, lum(REF.top)); REF.lumHor = Math.max(1e-6, lum(REF.hor)); }
refPrep();
/* matiz (luminância 1) de uma cor relativa à do meio-dia */
function matiz(c, ref, out) { for (let i = 0; i < 3; i++) out[i] = c[i] / Math.max(1e-7, ref[i]); const l = Math.max(1e-6, lum(out)); out[0] /= l; out[1] /= l; out[2] /= l; return out; }
const _m1 = [0, 0, 0], _m2 = [0, 0, 0], _tr = [0, 0, 0], _mT = [0, 0, 0], _sl = [0, 0, 0];
/* matiz do horizonte e do alto numa hora: o Preetham só vale com o sol acima do horizonte (abaixo dele a conta dá um cinza avermelhado sem sentido),
   então ele é avaliado com o sol no máximo a +0,5° e, quando o sol desce de 0,5° a −8°, o matiz vai para o azul da noite de lua */
const NOITE_H = [0.78, 0.93, 1.32], NOITE_T = [0.74, 0.92, 1.4];
function matizHora(sol, oH, oT) { const s0 = Math.sin(0.5 * DEG); _sl[0] = sol[0]; _sl[1] = sol[1]; _sl[2] = sol[2];
  if (_sl[1] < s0) { const h = Math.hypot(_sl[0], _sl[2]) || 1, ch = Math.cos(0.5 * DEG); _sl[0] = _sl[0] / h * ch; _sl[2] = _sl[2] / h * ch; _sl[1] = s0; }
  atmoPrep(_sl); medias(_sl, _hor, _top); matiz(_hor, REF.hor, oH); matiz(_top, REF.top, oT);
  const kn = smooth(s0, Math.sin(-8 * DEG), sol[1]); for (let i = 0; i < 3; i++) { oH[i] += (NOITE_H[i] - oH[i]) * kn; oT[i] += (NOITE_T[i] - oT[i]) * kn; } }

/* ---------- o céu visível (TSL) ---------- */
const ceu0 = M5.ceu; /* o céu da fase 2 (src/m5/terreno.js): fica para o Cinturão, para o reflexo e para ?m5ceu=0 */
let RU = null; /* ruídos e hashes do céu, em funções de verdade no WGSL */
function ruidos() {
  if (RU) return RU; const L = window.TSL; const { Fn, float, vec2, vec3, floor, fract, dot, mix, Loop } = L;
  const grad = Fn(([i]) => { const p = fract(vec3(i.x, i.y, i.x).mul(vec3(0.1031, 0.1030, 0.0973))).toVar(); p.addAssign(dot(p, p.yzx.add(33.33))); return fract(p.xx.add(p.yz).mul(p.zy)).mul(2.0).sub(1.0); }).setLayout({ name: 'ardSolGrad', type: 'vec2', inputs: [{ name: 'i', type: 'vec2' }] });
  const ruido = Fn(([p]) => { const i = floor(p), f = fract(p); const u = f.mul(f).mul(f).mul(f.mul(f.mul(6.0).sub(15.0)).add(10.0));
    const a = dot(grad(i), f), b = dot(grad(i.add(vec2(1, 0))), f.sub(vec2(1, 0))), c = dot(grad(i.add(vec2(0, 1))), f.sub(vec2(0, 1))), d = dot(grad(i.add(vec2(1, 1))), f.sub(vec2(1, 1)));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y).mul(1.6); }).setLayout({ name: 'ardSolRuido', type: 'float', inputs: [{ name: 'p', type: 'vec2' }] }); /* ruído de gradiente do SkyMesh (~[−1, 1]) */
  const fbm = Fn(([p0, drift]) => { const p = vec2(p0).toVar(), r = float(0).toVar(), a = float(1).toVar(); Loop(4, () => { r.addAssign(a.mul(ruido(p))); a.mulAssign(0.5); p.assign(p.mul(2.0).add(drift)); }); return r; })
    .setLayout({ name: 'ardSolFbm', type: 'float', inputs: [{ name: 'p0', type: 'vec2' }, { name: 'drift', type: 'float' }] });
  const h31 = Fn(([p0]) => { const p = fract(vec3(p0).mul(0.1031)).toVar(); p.addAssign(dot(p, p.zyx.add(31.32))); return fract(p.x.add(p.y).mul(p.z)); }).setLayout({ name: 'ardSolH31', type: 'float', inputs: [{ name: 'p0', type: 'vec3' }] });
  const h33 = Fn(([p0]) => { const p = fract(vec3(p0).mul(vec3(0.1031, 0.1030, 0.0973))).toVar(); p.addAssign(dot(p, p.yxz.add(33.33))); return fract(p.xxy.add(p.yxx).mul(p.zyx)); }).setLayout({ name: 'ardSolH33', type: 'vec3', inputs: [{ name: 'p0', type: 'vec3' }] });
  RU = { ruido, fbm, h31, h33 }; return RU; }
/* uniforms do céu (um conjunto por céu; o quadro escreve neles) */
function ceuUniforms(Tm, uniform) {
  return { uSol: uniform(new Tm.Vector3().fromArray(N0)), uLua: uniform(new Tm.Vector3(-N0[0], -N0[1], -N0[2])), uLuz: uniform(new Tm.Vector3().fromArray(N0)),
    uBR: uniform(new Tm.Vector3()), uBM: uniform(new Tm.Vector3()), uSE: uniform(0), uG: uniform(AT.g), uGanho: uniform(2.2), uNoiteK: uniform(0),
    uNuv: uniform(new Tm.Vector4(0.42, 0.45, 0.0002, 0.00002)), /* cobertura, densidade, escala e velocidade das nuvens (os nomes do SkyMesh) */
    uEstrelas: uniform(0), uLuaK: uniform(0), uLuaE1: uniform(new Tm.Vector3(1, 0, 0)), uLuaE2: uniform(new Tm.Vector3(0, 1, 0)), uRot: uniform(new Tm.Matrix3()),
    uHalo: uniform(new Tm.Color(0, 0, 0)), uSolK: uniform(4.0), uTw: uniform(new Tm.Vector4(0, 0, 0, 0)), /* crepúsculo: força, bruma recolhida do lado do sol, direção horizontal do sol (x, z) */ uAurora: uniform(new Tm.Vector4(0.22, 0.85, 0.58, 0)), uPolo: uniform(new Tm.Vector2(1, 0)),
    /* as chaves do céu GLSL que o render3d escreve a cada quadro: uHor e uBot (fundo da bruma), uNight, uTime; uTop, uSunDir e uSunCol ficam sem uso */
    uTop: uniform(new Tm.Color(0x3a5f8f)), uHor: uniform(new Tm.Color(0x9fb0c4)), uBot: uniform(new Tm.Color(0x30343a)), uSunDir: uniform(new Tm.Vector3().fromArray(N0)), uSunCol: uniform(new Tm.Color(1, 0.9, 0.75)), uNight: uniform(0), uTime: uniform(0), uSpace: uniform(0) }; }
const TETO = { joelho: 0.5, teto: 0.95 }; /* a compressão das altas luzes da Sala (src/m5/sala-mundo.js, 5.0a.2), com o teto abaixo do limiar do bloom da partida (1,0; na Sala, 1,35): o céu perto do sol
  não vira um véu de bloom; só o disco do sol (contido) acende um bloom pequeno */
function ceuFisico(o) {
  const Tm = window.THREE_M5, L = window.TSL; const RN = ruidos();
  const { Fn, If, Loop, uniform, float, vec2, vec3, vec4, mix, pow, clamp, smoothstep, max, min, dot, normalize, positionLocal, modelViewProjection, exp, acos, cos, sqrt, length, floor, fract, sin, luminance, select } = L;
  const u = ceuUniforms(Tm, uniform); const comAurora = !!o.aurora; const T = u.uTime;
  const m = new Tm.MeshBasicNodeMaterial({ side: Tm.BackSide, depthWrite: false, depthTest: true }); m.fog = false;
  /* no fundo (z = w), desenhado depois do opaco: o teste de profundidade descarta o que está coberto, então o céu só custa onde ele aparece */
  m.vertexNode = Fn(() => { const p = modelViewProjection; p.z.assign(p.w); return p; })();
  const comprime = (col, teto) => { const J = float(TETO.joelho), Lm = luminance(col), ex = max(Lm.sub(J), 0), Lc = min(Lm, J).add(ex.div(ex.div(teto.sub(J)).add(1))); return col.mul(Lc.div(max(Lm, 1e-4))); };
  m.colorNode = Fn(() => {
    const d = normalize(positionLocal).toVar('sD'); const y = d.y;
    /* Preetham (o fragmento do SkyMesh, com o que o vértice dele calcula vindo da CPU) */
    const za = acos(max(0.0, y)); const inv = float(1.0).div(cos(za).add(float(0.15).mul(pow(float(93.885).sub(za.mul(57.29577951308232)), -1.253))));
    const Fex = exp(u.uBR.mul(inv.mul(8.4E3)).add(u.uBM.mul(inv.mul(1.25E3))).negate()).toVar('sFex');
    const ct = dot(d, u.uSol).toVar('sCt'); const c = ct.mul(0.5).add(0.5); const rP = float(0.05968310365946075).mul(c.mul(c).add(1.0));
    const g2 = u.uG.mul(u.uG); const mP = float(0.07957747154594767).mul(float(1.0).sub(g2)).div(pow(float(1.0).sub(u.uG.mul(2.0).mul(ct)).add(g2), 1.5));
    const bT = u.uBR.mul(rP).add(u.uBM.mul(mP)).div(u.uBR.add(u.uBM)).mul(u.uSE).toVar('sBt');
    const Lin = pow(bT.mul(float(1.0).sub(Fex)), vec3(1.5)).toVar('sLin'); Lin.mulAssign(mix(vec3(1.0), pow(bT.mul(Fex), vec3(0.5)), clamp(pow(float(1.0).sub(u.uSol.y), 5.0), 0.0, 1.0)));
    const col = Lin.add(Fex.mul(0.1)).mul(0.04).add(vec3(0.0, 0.0003, 0.00075)).toVar('sCol');
    const nuvA = float(0).toVar('sNa');
    /* nuvens do SkyMesh (o mesmo modelo, no relógio do visual), iluminadas pelo sol e, de noite, pela lua */
    If(y.greaterThan(0.0).and(u.uNuv.x.greaterThan(0.0)), () => {
      const cuv = d.xz.div(y.mul(0.55)).mul(u.uNuv.z).add(T.mul(u.uNuv.w)).toVar('sCuv'); const ev = T.mul(u.uNuv.w).mul(300.0);
      const cn = RN.fbm(cuv.mul(1000.0), ev).mul(0.7).add(0.5).clamp(0.0, 1.0).toVar('sCn');
      const reg = RN.ruido(cuv.mul(300.0)).mul(0.37).add(0.5); const cov = clamp(u.uNuv.x.add(reg.sub(0.5).mul(0.6)), 0.0, 1.0);
      const th = float(1.0).sub(cov).toVar('sTh'); const mk = smoothstep(th, th.add(0.3), cn).toVar('sMk'); const hf = smoothstep(0.0, 0.06, y); mk.mulAssign(hf);
      const dia = smoothstep(-0.08, 0.3, u.uSol.y); const sc = Fex.mul(u.uSE).mul(0.22 * 0.04).toVar('sSc'); const amb = Lin.mul(0.04).add(vec3(0.0, 0.0003, 0.00075));
      const dp = max(0.0, cn.sub(th)).toVar('sDp'); const beer = exp(dp.mul(-4.0)).toVar('sBeer'); const pd = float(1.0).sub(beer.mul(beer)); const sh = mix(0.45, 1.0, beer.mul(pd).mul(2.6).clamp(0.0, 1.0));
      const prata = float(0.51).div(pow(float(1.49).sub(ct.mul(1.4)), 1.5)).clamp(0.0, 3.0); const borda = mk.mul(float(1.0).sub(mk)).mul(4.0);
      const cc = amb.add(sc.mul(sh)).toVar('sCc'); cc.addAssign(sc.mul(prata).mul(borda).mul(0.6)); cc.mulAssign(dia.max(0.03));
      cc.addAssign(vec3(0.5, 0.58, 0.75).mul(sh).mul(u.uLuaK).mul(0.0035)); /* a lua acende a borda de baixo das nuvens */
      const al = float(1.0).sub(exp(dp.mul(u.uNuv.y).mul(-12.0))).mul(hf).toVar('sAl');
      col.assign(mix(col, mix(col, cc, Fex), al)); nuvA.assign(al); });
    col.mulAssign(u.uGanho); /* exposição (a CPU segue o brilho do céu: de dia como antes, no crepúsculo um pouco mais escuro) */
    /* noite: o fundo azul-escuro, o brilho da lua no ar e as estrelas que giram em volta do polo */
    const nk = u.uNoiteK; const yp = max(y, 0.0);
    const md = dot(d, u.uLua).toVar('sMd'); const mdp = max(md, 0.0);
    const noite = mix(vec3(0.035, 0.045, 0.085), vec3(0.008, 0.013, 0.034), pow(yp, 0.5)).add(vec3(0.42, 0.5, 0.7).mul(pow(mdp, 24.0).mul(0.05).add(pow(mdp, 6.0).mul(0.012))).mul(u.uLuaK));
    col.addAssign(noite.mul(nk).mul(float(1.0).sub(nuvA.mul(0.6))));
    /* crepúsculo (o Preetham apaga com o sol abaixo de −2,3°): faixa laranja do lado do sol, rosa-violeta do outro (o cinturão de Vênus), zênite azul */
    const dh = d.xz.div(max(length(d.xz), 1e-3)); const az = dot(dh, vec2(u.uTw.z, u.uTw.w)).toVar('sAz'); const faixa = exp(yp.mul(-10.0));
    const twc = vec3(1.0, 0.4, 0.15).mul(pow(max(az, 0.0), 3.0)).add(vec3(0.5, 0.3, 0.52).mul(pow(max(az.negate(), 0.0), 2.0)).mul(0.35)).add(vec3(0.22, 0.16, 0.3).mul(0.3)).mul(faixa).add(vec3(0.03, 0.05, 0.15).mul(faixa.oneMinus()).mul(0.7));
    col.addAssign(twc.mul(u.uTw.x).mul(0.4));
    /* bruma no horizonte: o céu encontra a cor de longe da bruma do pós (uHor) com o brilho do sol dela; abaixo do horizonte, o fundo (uBot). No poente a bruma
       recua do lado do sol (o brilho do sol no horizonte aparece por cima das mesas, que ficam em silhueta) */
    const hz = exp(yp.mul(-9.0)).mul(0.85).mul(float(1.0).sub(pow(max(az, 0.0), 4.0).mul(u.uTw.y).mul(0.7))); const halo = u.uHor.add(u.uHalo.mul(pow(max(dot(d, u.uLuz), 0.0), 7.0)));
    col.assign(mix(col, halo, hz)); col.assign(mix(col, mix(halo, u.uBot, clamp(y.negate().mul(4.0), 0.0, 1.0)), float(1.0).sub(smoothstep(-0.02, 0.0, y)))); /* bordas do smoothstep em ordem */
    /* tinta do clima (a mesma do fundo: M5.u.clima) */
    const CL = M5.u.clima; col.assign(mix(col, CL.rgb.mul(luminance(col)).mul(1.5), CL.a.mul(0.55).mul(nk.mul(0.45).oneMinus())));
    col.assign(comprime(col, float(TETO.teto)));
    const vis = smoothstep(-0.01, 0.06, y).mul(nuvA.oneMinus()).toVar('sVis'); /* o que fica atrás da nuvem e abaixo do horizonte some */
    /* estrelas (as da Sala: duas camadas, cintilando), no céu que gira */
    const ds = u.uRot.mul(d).toVar('sDs');
    const estrela = (sc, lim) => { const q = ds.mul(sc), cc = floor(q); const r = RN.h31(cc); const of = RN.h33(cc).mul(0.6).add(0.2); const l = length(fract(q).sub(of));
      return float(1.0).sub(smoothstep(0.0, 0.12, l)).mul(smoothstep(lim, 1.0, r)).mul(sin(T.mul(r.mul(3.0).add(1.0)).add(r.mul(60.0))).mul(0.3).add(0.7)); };
    const st = estrela(170.0, 0.965).mul(1.4).add(estrela(360.0, 0.982));
    col.addAssign(vec3(0.85, 0.9, 1.0).mul(st).mul(u.uEstrelas).mul(vis).mul(float(1.0).sub(smoothstep(0.9, 0.9995, md))));
    /* a lua: disco com mares e o limbo mais escuro */
    { const cosR = Math.cos(1.4 * DEG), sinR = Math.sin(1.4 * DEG); const lu = vec2(dot(d, u.uLuaE1), dot(d, u.uLuaE2)).div(sinR); const r2 = dot(lu, lu);
      const disco = smoothstep(cosR - 0.00003, cosR + 0.00003, md); const mar = RN.ruido(lu.mul(2.3).add(3.1)).mul(0.5).add(0.5).add(RN.ruido(lu.mul(5.7).add(1.7)).mul(0.15));
      const tom = mix(0.58, 1.0, smoothstep(0.38, 0.62, mar)).mul(pow(max(float(1.0).sub(r2), 0.0), 0.18));
      col.assign(mix(col, vec3(0.93, 0.95, 1.0).mul(tom).mul(u.uLuaK).mul(1.35), disco.mul(vis).mul(min(u.uLuaK, 1.0)))); }
    /* o disco do sol, contido (o da Sala: some abaixo do horizonte e atrás da nuvem) */
    { const sd = smoothstep(0.99985, 0.99996, ct).mul(smoothstep(-0.02, 0.03, u.uSol.y)).mul(vis);
      col.assign(max(col, mix(vec3(1.0, 0.52, 0.24), vec3(1.0, 0.93, 0.84), smoothstep(0.0, 0.3, u.uSol.y)).mul(sd).mul(u.uSolK))); }
    if (comAurora) { /* aurora: duas paredes de luz em anel em volta do polo (o "oval"), vistas em 7 camadas de altura (1 a 3,1: cortinas altas). As estrias
      dependem só do lugar no anel (as mesmas em todas as camadas), então sobem retas como cortinas; verde embaixo, violeta no alto. O anel passa perto do
      horizonte em volta do céu todo (aparece na faixa de céu que a câmera do jogo vê) e sobe do lado de fora do polo; mais forte à noite */
      const acc = vec3(0).toVar('sAu'); const pol = u.uPolo;
      Loop(7, ({ i }) => { const fi = float(i); const h = fi.mul(0.35).add(1.0); const q = d.xz.mul(h.mul(0.5).div(max(y, 0.0).add(0.05)));
        const v = q.sub(pol.mul(2.4)); const r = length(v); const cn = v.div(max(r, 1e-3)); /* direção no anel como ponto do círculo: ruído periódico, sem costura */
        const w1 = RN.ruido(cn.mul(0.8).add(vec2(T.mul(0.015), 0.0))), w2 = RN.ruido(cn.mul(2.6).add(vec2(5.2, T.mul(0.04))));
        const e1 = r.sub(w1.mul(1.1).add(w2.mul(0.35)).add(5.0)), e2 = r.sub(w1.mul(-0.8).add(w2.mul(0.3)).add(3.3));
        const f = exp(e1.mul(e1).mul(-7.0)).add(exp(e2.mul(e2).mul(-9.0)).mul(0.55));
        const est = RN.ruido(cn.mul(42.0).add(vec2(w1.mul(1.5).add(T.mul(0.06)), 0.0))).mul(0.5).add(0.5); const k = f.mul(est.mul(est).mul(est).mul(1.6).add(0.2));
        const t = fi.div(6.0); const a = pow(float(1.0).sub(t), 1.6).add(select(i.equal(0), float(1.0), float(0.0))); /* a borda de baixo, mais viva */
        acc.addAssign(mix(u.uAurora.rgb.mul(vec3(0.6, 1.15, 0.75)), vec3(0.55, 0.22, 0.9), t.mul(t)).mul(k).mul(a)); });
      const au = acc.mul(u.uAurora.w).mul(smoothstep(-0.012, 0.03, y)).mul(nuvA.mul(0.85).oneMinus()).mul(0.22); col.addAssign(au.div(au.mul(0.6).add(1.0))); }
    return vec4(col, 1.0); })();
  m.uniforms = u;
  const mesh = new Tm.Mesh(new Tm.SphereGeometry(4800, 32, 20), m); mesh.frustumCulled = false; mesh.renderOrder = 10000; mesh.userData.mat = m; mesh.name = 'ceu-fisico';
  M5.registrar('ceu-fisico' + (comAurora ? '-aurora' : ''), m); S.ceu = mesh; S.u = u; return mesh; }
const S = M5.ceuS = { ceu: null, u: null };
M5.ceu = function (o) {
  if (!C.on || (o && o.espaco) || !window.THREE_M5) return ceu0.apply(this, arguments); /* Cinturão: o céu de espaço de sempre */
  const R = M5.cur && M5.cur.R; const cl = R && R.climateCfg; return ceuFisico({ aurora: !!(C.aurora && cl && cl.aurora) }); };

/* ---------- por quadro: a luz, o fundo e o céu seguem a hora (antes do M5.frame da fundação) ---------- */
const frame0 = M5.frame;
const _rot = { m4: null, ax: null };
M5.frame = function (X, R, nt, sun, bg, cl) {
  if (C.on && E.pronto) { try { ceuQuadro(X, R, nt, sun, bg, cl); } catch (err) { if (!E.erro) { E.erro = true; console.warn('[ARD] Motor 5: céu (5.0d): ' + err.message); } } }
  return frame0.apply(this, arguments); };
function ceuQuadro(X, R, nt, sun, bg, cl) {
  const Tm = X.T; const fonte = E.deSol ? E.sol : E.lua;
  /* cor da luz: a de antes vezes o quanto a atmosfera avermelha (relativo ao meio-dia), com a troca sol ↔ lua apagando */
  if (!E.espaco) { fex(Math.max(0.0, Math.sin(E.elev)), _tr); matiz(_tr, REF.fx, _m1); const mx = Math.max(_m1[0], _m1[1], _m1[2], 1e-6), kc = E.deSol ? 0.75 : 0.3; for (let i = 0; i < 3; i++) E.cor[i] = 1 + (_m1[i] / mx - 1) * kc; } /* a lua avermelha pouco */
  else E.cor[0] = E.cor[1] = E.cor[2] = 1;
  sun.color.r *= E.cor[0] * E.k; sun.color.g *= E.cor[1] * E.k; sun.color.b *= E.cor[2] * E.k; /* o apagar na troca sol ↔ lua vai na cor: a bruma do pós (que usa a cor da luz) e o halo do céu apagam junto e não pulam de lado */
  /* fundo e bruma: no crepúsculo, metade do matiz do horizonte do céu (na luminância do fundo de antes); ao meio-dia e de noite, o de antes */
  const es = Math.asin(Math.max(-1, Math.min(1, E.sol[1]))); const w = E.espaco ? 0 : 0.3 * Math.exp(-Math.pow((es - 1 * DEG) / (8 * DEG), 2));
  if (w > 0.002) { matizHora(E.sol, _m2, _mT); const lb = 0.2126 * bg.r + 0.7152 * bg.g + 0.0722 * bg.b; for (let i = 0; i < 3; i++) _m2[i] = 1 + (_m2[i] - 1) * 0.5;
    const lm = Math.max(1e-6, lum(_m2)); bg.r += (_m2[0] / lm * lb - bg.r) * w; bg.g += (_m2[1] / lm * lb - bg.g) * w; bg.b += (_m2[2] / lm * lb - bg.b) * w; if (X.scene && X.scene.fog) X.scene.fog.color.copy(bg); }
  atmoPrep(E.sol); medias(E.sol, _hor, _top); /* o céu de agora (o visível usa o sol de verdade, também abaixo do horizonte) */
  const LS = R.lightSt; if (LS) { LS.sun[0] = sun.color.r; LS.sun[1] = sun.color.g; LS.sun[2] = sun.color.b; LS.sky[0] = bg.r; LS.sky[1] = bg.g; LS.sky[2] = bg.b; } /* o retrato do líder recebe a mesma luz */
  /* o céu visível */
  const u = S.u; if (u && S.ceu && S.ceu.parent) {
    u.uSol.value.fromArray(E.sol); u.uLua.value.fromArray(E.lua); u.uLuz.value.set(R.sunDir[0], R.sunDir[1], R.sunDir[2]).normalize();
    u.uBR.value.fromArray(AT.bR); u.uBM.value.fromArray(AT.bM); u.uSE.value = AT.sunE; u.uG.value = AT.g;
    /* exposição: a do meio-dia (alto do céu ~0,3, como o céu de antes) e meia adaptação quando o céu escurece (no crepúsculo não apaga de vez) */
    const lt = Math.max(1e-6, lum(_top)); u.uGanho.value = (0.3 / REF.lumTop) * Math.min(3, Math.pow(REF.lumTop / lt, 0.35));
    { const e = Math.asin(Math.max(-1, Math.min(1, E.sol[1]))), h = Math.hypot(E.sol[0], E.sol[2]) || 1; u.uTw.value.set(E.espaco ? 0 : Math.exp(-Math.pow((e + 2.5 * DEG) / (6 * DEG), 2)), E.espaco ? 0 : Math.exp(-Math.pow((e - 1 * DEG) / (8 * DEG), 2)), E.sol[0] / h, E.sol[2] / h); }
    const sAlto = smooth(-0.035, 0.17, -E.sol[1]); u.uNoiteK.value = sAlto; u.uEstrelas.value = smooth(0.03, 0.2, -E.sol[1]) * (1 - 0.5 * (cl && cl.mix ? cl.mix : 0)); /* a noite entra do sol a +2° até −10°; as estrelas, de −2° a −12° */
    u.uLuaK.value = E.espaco ? 0 : smooth(-0.04, 0.08, E.lua[1]) * (0.35 + 0.65 * sAlto);
    { const a = E.lua, ux = Math.abs(a[1]) > 0.95 ? 1 : 0, uy = 1 - ux; let e1x = uy * a[2], e1y = -ux * a[2], e1z = ux * a[1] - uy * a[0]; /* eixo de cima × lua, sem alocar */ const l1 = Math.hypot(e1x, e1y, e1z) || 1; e1x /= l1; e1y /= l1; e1z /= l1;
      u.uLuaE1.value.set(e1x, e1y, e1z); u.uLuaE2.value.set(a[1] * e1z - a[2] * e1y, a[2] * e1x - a[0] * e1z, a[0] * e1y - a[1] * e1x); }
    if (!_rot.m4) { _rot.m4 = new Tm.Matrix4(); _rot.ax = new Tm.Vector3().fromArray(AX).normalize(); }
    _rot.m4.makeRotationAxis(_rot.ax, -E.th); u.uRot.value.setFromMatrix4(_rot.m4);
    const AK = R.atmoK || { sun: 0.32 }; u.uHalo.value.copy(sun.color).multiplyScalar(AK.sun * (1 - 0.85 * nt));
    if (cl && cl.aurora) { const ka = (Math.sin(R.time * 0.3) + 1) / 2; u.uAurora.value.set(cl.aurora[0], cl.aurora[1], cl.aurora[2], (0.18 + 0.82 * smooth(0.25, 0.8, nt)) * (0.8 + 0.2 * ka)); } else u.uAurora.value.w = 0;
    { const h = Math.hypot(AX[0], AX[2]) || 1; u.uPolo.value.set(-AX[0] / h, -AX[2] / h); } /* o polo que fica acima do horizonte */
  }
  if (S.raiosCor) { const kq = C.raiosK != null ? C.raiosK : 1, kr = (sun.intensity / 2.08) * kq; S.raiosCor.value.copy(sun.color).multiplyScalar(kr); if (S.raiosK) S.raiosK.value.x = Math.min(0.9, 0.7 * kq * Math.min(1, E.k + 0.2)); } /* raios de sol: a luz de agora (1 ao meio-dia), apagando com ela */
  envQuadro(X, R, nt, cl);
}

/* ---------- reflexo do céu (PMREM) em degraus ----------
   O mapa de ambiente da fundação (core.js, M5.skyEnv) é o céu da fase 2 em degradê com o sol e o chão do mapa. Aqui ele ganha a hora: as cores do
   horizonte e do alto mudam de matiz como o céu físico muda (relativo ao meio-dia: ao meio-dia é exatamente o de antes), o "sol" do mapa é quem ilumina
   (sol de dia, lua de noite), e a aurora tinge o alto. O brilho continua o da curva da noite do render3d (environmentIntensity), então nada escurece
   duas vezes. Cada refeita vai para um alvo à parte em fases (o cubo, o desfoque e os níveis do GGX, alguns por quadro) e termina numa cópia de
   textura para o alvo de sempre: a cena nunca troca de textura (nada se remonta) e nenhum pipeline nasce (os do PMREM nascem na primeira, na carga). */
const skyEnv0 = M5.skyEnv;
const ENV = M5.ceuEnv = { rtB: null, fase: -1, balde: null, t: -1e9, cl: null, sujo: false, n: 0, ms: [], quadros: 0, porQuadro: 2, alvoTh: 0 };
const _bgD = { r: 0, g: 0, b: 0 };
function envUniforms(X, R, cl, th) { /* os uniforms do céu do mapa de ambiente para a hora th (os mesmos de antes ao meio-dia) */
  const Tm = X.T; const u = X.envSky.userData.mat.uniforms; const gcol = R.groundCol || new Tm.Color(0.3, 0.28, 0.26);
  const bgD = new Tm.Color().setRGB(0.62, 0.69, 0.77); if (cl) bgD.lerp(new Tm.Color().setRGB(cl.tint[0], cl.tint[1], cl.tint[2]), cl.mix);
  u.uHor.value.copy(bgD).lerp(new Tm.Color().copy(gcol).multiplyScalar(1.5), 0.28); u.uTop.value.copy(bgD).multiplyScalar(0.55).lerp(new Tm.Color(0.12, 0.2, 0.36), 0.5); u.uBot.value.copy(gcol).multiplyScalar(0.7);
  u.uNight.value = 0; u.uSpace.value = 0; X.envGround.material.color.copy(gcol).multiplyScalar(0.8);
  const sol = [0, 0, 0]; solEm(th, sol, E.espaco); const deSol = E.espaco || sol[1] >= 0; const fonte = deSol ? sol : [-sol[0], -sol[1], -sol[2]];
  u.uSunDir.value.set(fonte[0], fonte[1], fonte[2]).normalize(); u.uSunCol.value.setRGB(1.0, 0.91, 0.77).multiplyScalar(1.6);
  if (!C.on || E.espaco) return;
  const mH = [0, 0, 0], mT = [0, 0, 0]; matizHora(sol, mH, mT);
  const kM = 0.65; const tinge = (c, m) => { c.r *= 1 + (m[0] - 1) * kM; c.g *= 1 + (m[1] - 1) * kM; c.b *= 1 + (m[2] - 1) * kM; };
  tinge(u.uHor.value, mH); tinge(u.uTop.value, mT); tinge(X.envGround.material.color, mH);
  /* a luz: a cor de agora (curva da noite e atmosfera), a mesma que o render3d dá ao sol, sem o clima */
  const n = (1 - Math.cos(th)) / 2, el = Math.asin(Math.max(-1, Math.min(1, Math.abs(sol[1])))); const tr = matiz(fex(Math.sin(el), [0, 0, 0]), REF.fx, [0, 0, 0]); const mx = Math.max(tr[0], tr[1], tr[2], 1e-6);
  const kz = smooth(0, C.apaga, Math.abs(sol[1])), kc = deSol ? 0.75 : 0.3; u.uSunCol.value.setRGB((1 - 0.48 * n) * (1 + (tr[0] / mx - 1) * kc), (0.91 - 0.24 * n) * (1 + (tr[1] / mx - 1) * kc), (0.77 + 0.2 * n) * (1 + (tr[2] / mx - 1) * kc)).multiplyScalar(1.6 * (0.25 + 0.75 * kz));
  if (cl && cl.aurora && C.aurora) { const ka = 0.5 * smooth(0.25, 0.8, n); u.uTop.value.lerp(new Tm.Color(cl.aurora[0], cl.aurora[1], cl.aurora[2]).multiplyScalar(lumC(u.uTop.value) / 0.6), ka); u.uHor.value.lerp(new Tm.Color(cl.aurora[0], cl.aurora[1], cl.aurora[2]).multiplyScalar(lumC(u.uHor.value) / 0.6), ka * 0.4); }
}
const lumC = c => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
function envSetup(X, scene, R) { /* a cena do mapa de ambiente da fundação (core.js), montada uma vez */
  if (X.envScene) return; const Tm = X.T; const es = new Tm.Scene(); const sk = ceu0(); sk.scale.setScalar(0.02); es.add(sk); const um = M5.pmremUm && M5.verso;
  const gm = new Tm.MeshBasicNodeMaterial(um ? { color: 0x404040, side: Tm.BackSide, depthWrite: false, depthTest: false } : { color: 0x404040 }); gm.fog = false; const cg = new Tm.CircleGeometry(90, 40); const gd = new Tm.Mesh(um ? M5.verso(cg) : cg, gm); if (um) cg.dispose();
  gd.rotation.x = -Math.PI / 2; gd.position.y = -8; es.add(gd); X.envScene = es; X.envSky = sk; X.envGround = gd; X.pmrem = new Tm.PMREMGenerator(X.renderer);
  if (um && typeof X.pmrem._setSize === 'function' && typeof X.pmrem._allocateTarget === 'function') { try { X.pmrem._setSize(256); X.envRT = X.pmrem._allocateTarget(false); } catch (e) { X.envRT = null; } } }
function envBakeTudo(X, scene, R) { /* refeita inteira, no quadro (a da carga e a reserva) */
  const t0 = performance.now(); X.envRT = X.pmrem.fromScene(X.envScene, 0.025, 0.1, 400, X.envRT ? { renderTarget: X.envRT } : {}); X.envMs = Math.round(performance.now() - t0);
  if (scene.environment !== X.envRT.texture) { scene.environment = X.envRT.texture; scene.environmentIntensity = R.envSkyK; R.envK0 = R.envSkyK; } R.envSky = true; }
M5.skyEnv = function (X, scene, cl, R) {
  if (!C.on || !C.env) return skyEnv0.apply(this, arguments);
  const Tm = X.T; if (!X.renderer.hasInitialized || !X.renderer.hasInitialized()) return;
  envSetup(X, scene, R); ENV.cl = cl; ENV.R = R; ENV.scene = scene; ENV.X = X;
  if (!X.warmDone || ENV.balde == null) { const th = baldeTh(X, R); envUniforms(X, R, cl, th); envBakeTudo(X, scene, R); ENV.balde = baldeDe(th); ENV.t = performance.now() / 1000; ENV.fase = -1; ENV.n++;
    /* com o ciclo andando, as fases rodam uma vez inteiras na carga: o alvo à parte e os objetos de desenho da câmera do cubo nascem aqui, não na 1ª refeita */
    const diaFixo = R.forceDay || !!QS.get('dia') || (!!QS.get('bench') && !QS.get('noite')); /* o main.js liga o meio-dia fixo depois da carga (?dia=1, Teste de desempenho) */
    if (!diaFixo && C.hora == null && envFasesOk(X) && !ENV.rtB) { try { ENV.fase = 0; let k = 0; while (ENV.fase >= 0 && k++ < 40) envFase(X); ENV.fim = false; } catch (err) { ENV.fase = -1; C.envFases = false; } } }
  else ENV.sujo = true; /* troca de clima no meio da partida: refeita em fases no próximo quadro */
};
const passo = () => (M5.cur && M5.cur.R && M5.cur.R.quality && M5.cur.R.quality.resolved === 'baixa' ? C.envPassoBaixa : C.envPasso);
const baldeDe = th => Math.round(th / passo());
const baldeTh = (X, R) => { if (!E.pronto) { M5.ceuHora(R, R.sim || (window.__ARDG && window.__ARDG.sim), null); } return Math.round(E.th / passo()) * passo(); };
function envQuadro(X, R, nt, cl) {
  if (!C.env || !X.envScene || ENV.balde == null) return;
  if (ENV.fase < 0) { const b = baldeDe(E.th); if (b === ENV.balde && !ENV.sujo) return; if (X.warmDone && performance.now() / 1000 - ENV.t < C.envIntervalo && !ENV.sujo) return;
    ENV.balde = b; ENV.sujo = false; ENV.alvoTh = b * passo(); envUniforms(X, R, ENV.cl, ENV.alvoTh);
    if (!X.warmDone || !envFasesOk(X)) { envBakeTudo(X, ENV.scene || X.scene, R); ENV.t = performance.now() / 1000; ENV.n++; return; } /* na carga e sem as partes do r186: inteira, no quadro */
    ENV.fase = 0; ENV.t0 = performance.now(); ENV.t = ENV.t0 / 1000; ENV.cpu = 0; }
  const t0 = performance.now(); ENV.nq = (ENV.nq || 0) + 1; try { envFase(X); } catch (err) { console.warn('[ARD] Motor 5: reflexo em fases (5.0d): ' + err.message); ENV.fase = -1; C.envFases = false; envBakeTudo(X, ENV.scene || X.scene, R); } const dtq = performance.now() - t0; ENV.cpu += dtq; ENV.maxq = Math.max(ENV.maxq || 0, dtq);
  if (ENV.fim) { ENV.fim = false; if (ENV.ms.length < 40) ENV.ms.push([Math.round(performance.now() - ENV.t0), +ENV.cpu.toFixed(2), ENV.nq, +ENV.maxq.toFixed(2)]); ENV.nq = 0; ENV.maxq = 0; } /* [ms do começo ao fim, CPU somada, quadros, CPU do quadro mais caro] */
}
function envFasesOk(X) { const p = X.pmrem; if (C.envFases === false) return false; return !!(p && p._applyGGXFilter && p._blur && p._init && p._setViewport && p._lodMeshes && p._cubeSize && X.renderer.copyTextureToTexture); }
/* uma fase por quadro: 0 e 1 = as faces do cubo (3 + 3, a mesma conta do _sceneToCubeUV do r186); 2 = o desfoque; 3… = níveis do GGX (ENV.porQuadro por
   quadro); a última = a cópia para o alvo de sempre. Nenhum quadro desenha mais que ~4 passes pequenos */
const UP_S = [1, 1, 1, 1, -1, 1], FW_S = [1, -1, 1, -1, 1, -1];
function envFaces(X, B, i0, i1) { const r = X.renderer, pm = X.pmrem, Tm = X.T; const cam = ENV.cam || (ENV.cam = new Tm.PerspectiveCamera(90, 1, 0.1, 400)); const sz = pm._cubeSize;
  r.setRenderTarget(B); if (i0 === 0) r.clear(); r.autoClear = false;
  for (let i = i0; i < i1; i++) { const col = i % 3; cam.position.set(0, 0, 0);
    if (col === 0) { cam.up.set(0, UP_S[i], 0); cam.lookAt(FW_S[i], 0, 0); } else if (col === 1) { cam.up.set(0, 0, UP_S[i]); cam.lookAt(0, FW_S[i], 0); } else { cam.up.set(0, UP_S[i], 0); cam.lookAt(0, 0, FW_S[i]); }
    pm._setViewport(B, col * sz, i > 2 ? sz : 0, sz, sz); r.render(X.envScene, cam); } }
function envFase(X) {
  const r = X.renderer, pm = X.pmrem, A = X.envRT; if (!ENV.rtB) { ENV.rtB = pm._allocateTarget(false); ENV.rtB.texture.name = 'ard-ceu-ambiente-b'; }
  const B = ENV.rtB, prev = r.getRenderTarget(), face = r.getActiveCubeFace(), mip = r.getActiveMipmapLevel(), ac = r.autoClear;
  try {
    if (ENV.fase === 0) { pm._init(B); envFaces(X, B, 0, 3); ENV.fase = 1; }
    else if (ENV.fase === 1) { envFaces(X, B, 3, 6); ENV.fase = 2; }
    else if (ENV.fase === 2) { r.autoClear = false; pm._blur(B, 0, 0, 0.025); ENV.fase = 3; }
    else { const n = pm._lodMeshes.length; let i = ENV.fase - 2; r.autoClear = false; for (let k = 0; k < ENV.porQuadro && i < n; k++, i++) pm._applyGGXFilter(B, i - 1, i); ENV.fase = i + 2;
      if (i >= n) { r.copyTextureToTexture(B.texture, A.texture); ENV.fase = -1; ENV.n++; ENV.quadros++; ENV.fim = true; } }
  } finally { r.autoClear = ac; B.scissorTest = false; pm._setViewport(B, 0, 0, B.width, B.height); r.setRenderTarget(prev, face, mip); }
}

/* ---------- raios de sol (5.0d): a luz do sol espalhada pela poeira do ar baixo, com a sombra das cascatas e do dossel da Tempestade ----------
   O GodraysNode do r186 marcha 60 passos por pixel na sombra de UMA luz e não conhece o CSMShadowNode (cada cascata é uma luz própria). Aqui, o
   equivalente mais barato: ¼ da resolução, 20 passos com ruído, só no trecho do raio dentro da camada de poeira (até 300 acima do chão em volta da
   câmera), a sombra lida da cascata que contém o ponto (até 3 das cascatas de longe; na reserva WebGL2, a sombra única) e, sob a Tempestade de Éter,
   o dossel dela (a mesma textura 3D de ruído e o mesmo giro do volume) apaga o sol: sobram as falhas, que viram feixes. A soma sai com a fase de
   Henyey-Greenstein (g 0,55): forte olhando para o sol (poente à frente), fraca de cima ao meio-dia. Só na Alta e na Ultra (com sombra). */
let RaiosC = null;
function raiosFontes(X) { const out = []; if (X.csm && X.csm.lights && X.csm.lights.length) { const L = X.csm.lights, n = L.length; for (let i = Math.max(0, n - 3); i < n; i++) { const sh = L[i].shadow; if (sh && sh.map && sh.map.depthTexture) out.push(sh); } }
  else if (X.sun && X.sun.shadow && X.sun.shadow.map && X.sun.shadow.map.depthTexture) out.push(X.sun.shadow); return out; }
M5.raiosSol = function (entrada, depth, o) {
  o = o || {}; const X = o.X || M5.cur, q = o.q; if (!C.on || C.raios === '0' || !X || !q || !q.shadows) return null;
  if (!(q.resolved === 'alta' || q.resolved === 'ultra' || C.raios === '1')) return null;
  const Tm = window.THREE_M5, L = window.TSL; const { Fn, Loop, uniform, float, vec2, vec3, vec4, mix, max, min, exp, dot, length, clamp, select, getViewPosition, uv, texture, texture3D, interleavedGradientNoise, screenCoordinate, passTexture, context, cos, sin, smoothstep, pow } = L;
  if (!RaiosC) RaiosC = class ArdRaiosNode extends Tm.TempNode {
    static get type() { return 'ArdRaiosNode'; }
    constructor(depthNode, camera, X) { super('vec4'); this.depthNode = depthNode; this.camera = camera; this.X = X; this.escala = 0.25; this.passos = 20;
      this.rt = new Tm.RenderTarget(1, 1, { depthBuffer: false, type: Tm.HalfFloatType }); this.rt.texture.name = 'ard-raios-sol'; this.rt.texture.generateMipmaps = false;
      this.quad = new Tm.QuadMesh(); this.mat = null; this.tam = new Tm.Vector2(); this.estado = undefined; this.fontes = null;
      this.U = { projInv: uniform(new Tm.Matrix4()), camWorld: uniform(new Tm.Matrix4()), luz: uniform(new Tm.Vector3(0, 1, 0)), base: uniform(0), topo: uniform(300), hh: uniform(110), dmax: uniform(2600),
        temp: uniform(0), tC: uniform(new Tm.Vector4()), tB: uniform(new Tm.Vector4()), tE: uniform(new Tm.Vector4()) };
      this.saida = passTexture(this, this.rt.texture); this.updateBeforeType = Tm.NodeUpdateType.FRAME; }
    getTextureNode() { return this.saida; }
    updateBefore(frame) { const r = frame.renderer; if (!this.mat) return; this.estado = Tm.RendererUtils.resetRendererState(r, this.estado);
      const s = r.getDrawingBufferSize(this.tam); this.rt.setSize(Math.max(1, Math.round(s.width * this.escala)), Math.max(1, Math.round(s.height * this.escala)));
      const U = this.U, cam = this.camera; U.projInv.value.copy(cam.projectionMatrixInverse); U.camWorld.value.copy(cam.matrixWorld);
      const R = this.X.R; if (R && R.sunDir) U.luz.value.set(R.sunDir[0], R.sunDir[1], R.sunDir[2]).normalize(); const ty = R && R.camTy != null ? R.camTy : 0; U.base.value = ty; U.topo.value = ty + 300;
      const ST = R && R.STM, D = ST && ST.debug && ST.debug.UV; U.temp.value = ST && ST.on && D ? 1 : 0; if (D) { U.tC.value.copy(D.uC.value); U.tB.value.copy(D.uB.value); U.tE.value.set(D.uE.value.x, D.uA.value.x, 0, 0); }
      if (this.texel) this.texel.value.set(1 / this.rt.width, 1 / this.rt.height);
      r.setRenderTarget(this.rt); this.quad.material = this.mat; this.quad.render(r); Tm.RendererUtils.restoreRendererState(r, this.estado); }
    setup(builder) {
      if (!this.mat) { const U = this.U, X = this.X; const fontes = this.fontes = raiosFontes(X); const m = new Tm.NodeMaterial(); m.contextNode = context(builder.getSharedContext());
        const R = X.R, ST = R && R.STM, D = ST && ST.debug && ST.debug.UV, nTex = D && D.uN && D.uN.value ? texture3D(D.uN.value) : null; const N = this.passos;
        m.fragmentNode = Fn(() => {
          const u0 = uv(); const dz = this.depthNode.sample(u0).r; const vp = getViewPosition(u0, dz, U.projInv); const wp = U.camWorld.mul(vec4(vp, 1)).xyz; const co = U.camWorld.element(3).xyz;
          const rd0 = wp.sub(co), dist = min(length(rd0), U.dmax), rd = rd0.div(max(length(rd0), 1e-3)).toVar('rRd');
          /* o trecho do raio dentro da camada de poeira (abaixo do topo) */
          const tIn = clamp(U.topo.sub(co.y).div(min(rd.y, -1e-3)), 0.0, dist).toVar('rT0'); const tIn2 = select(co.y.greaterThan(U.topo), tIn, float(0)); const seg = max(dist.sub(tIn2), 0.0).toVar('rSeg');
          const dt = seg.div(N).toVar('rDt'); const jit = interleavedGradientNoise(screenCoordinate); const acc = float(0).toVar('rAcc'), tot = float(0).toVar('rTot');
          Loop(N, ({ i }) => { const t = tIn2.add(float(i).add(jit).mul(dt)); const p = co.add(rd.mul(t)).toVar('rP');
            let lit = float(1);
            for (let k = fontes.length - 1; k >= 0; k--) { const sh = fontes[k]; const sp = uniform(sh.matrix).mul(vec4(p, 1.0)); const sc = vec3(sp.x, sp.y.oneMinus(), sp.z);
              const dentro = sc.x.greaterThanEqual(0.0).and(sc.x.lessThanEqual(1.0)).and(sc.y.greaterThanEqual(0.0)).and(sc.y.lessThanEqual(1.0)).and(sc.z.greaterThanEqual(0.0)).and(sc.z.lessThanEqual(1.0));
              const v = texture(sh.map.depthTexture, clamp(sc.xy, 0.0, 1.0)).compare(sc.z); lit = select(dentro, v, lit); } /* a cascata mais perto que contém o ponto vence (a ordem do laço) */
            if (nTex) { /* o dossel da Tempestade: o raio de sol que sai de p cruza a altura do meio do dossel; lá, o ruído do volume diz se há nuvem */
              const yc = U.tC.y.add(U.tB.z).add(175.0); const Q = p.add(U.luz.mul(yc.sub(p.y).div(max(U.luz.y, 0.12)))); const lq = Q.xz.sub(vec2(U.tC.x, U.tC.z)); const Rr = U.tC.w.mul(U.tB.w); const rho = length(lq).div(max(Rr, 1.0));
              const ang = U.tB.x.add(U.tB.y.div(rho.add(0.42))).add(yc.sub(U.tC.y).mul(0.0016)); const ca = cos(ang), sa = sin(ang); const qq = vec2(ca.mul(lq.x).sub(sa.mul(lq.y)), sa.mul(lq.x).add(ca.mul(lq.y)));
              const n1 = nTex.sample(vec3(qq.x, yc.sub(U.tC.y).mul(1.5), qq.y).mul(0.0016)).level(0).r; const tw = exp(rho.sub(0.79).mul(rho.sub(0.79)).mul(-34.0));
              const borda = float(1).sub(smoothstep(tw.mul(0.08).add(0.98), 1.16, rho)), olho = smoothstep(0.1, 0.36, rho.add(n1.sub(0.5).mul(0.2)));
              const c1 = n1.mul(0.85).add(tw.mul(0.3)).sub(float(1).sub(borda.mul(olho)).mul(0.75)); const den = smoothstep(U.tE.x, U.tE.x.add(0.16), c1).mul(U.tE.y);
              const sobe = select(p.y.lessThan(yc), float(1), float(0)); lit = lit.mul(exp(den.mul(sobe).mul(U.temp).mul(-2.6).div(max(U.luz.y, 0.25)))); }
            let dens = exp(max(p.y.sub(U.base), 0.0).div(U.hh).negate());
            if (nTex) { const rp = length(p.xz.sub(vec2(U.tC.x, U.tC.z))).div(max(U.tC.w.mul(U.tB.w), 1.0)); dens = dens.mul(float(1).sub(smoothstep(0.9, 1.15, rp)).mul(U.temp).mul(U.tE.y).mul(2.5).add(1.0)); } /* a Tempestade levanta poeira: mais ar para os feixes */
            acc.addAssign(lit.mul(dens).mul(dt)); tot.addAssign(dens.mul(dt)); });
          const ct = dot(rd, U.luz), g = 0.55; const hg = float(1 - g * g).div(pow(float(1 + g * g).sub(ct.mul(2 * g)), 1.5)); /* fase de Henyey-Greenstein (× 4π: 1 = isótropa): forte olhando para o sol */
          return vec4(acc.div(800), tot.div(800), hg, 1); })(); /* poeira iluminada e poeira total no raio (em "opacidades" de 800 de caminho) e a fase */
        if (M5.registrar) M5.registrar('raios-sol', m); else m.name = 'ard-raios-sol'; this.mat = m; }
      return this.saida; }
    dispose() { super.dispose(); this.rt.dispose(); if (this.mat) this.mat.dispose(); }
  };
  const no = new RaiosC(depth, o.camera, X);
  const cor = S.raiosCor || (S.raiosCor = uniform(new Tm.Color(0, 0, 0))); /* cor × força, da CPU (ceuQuadro): o sol de agora, fraco de noite */
  const tx = no.getTextureNode(), tl = no.texel = uniform(new Tm.Vector2(1, 1)), u0 = uv(); /* 4 amostras a ¾ de texel (com o filtro bilinear, uma média 4×4 da textura de ¼): o ruído da marcha some */
  const r4 = tx.sample(u0.add(tl.mul(vec2(-0.75, -0.75)))).rgb.add(tx.sample(u0.add(tl.mul(vec2(0.75, -0.75)))).rgb).add(tx.sample(u0.add(tl.mul(vec2(-0.75, 0.75)))).rgb).add(tx.sample(u0.add(tl.mul(vec2(0.75, 0.75)))).rgb).mul(0.25);
  /* contraste, não véu: o ar na sombra (das peças, do relevo e do dossel) apaga parte da bruma e o ar iluminado ganha um pouco de sol (mais olhando para ele),
     na proporção da poeira que o raio atravessa (tau). Sem sombra no caminho, quase nada muda; ao meio-dia de cima, quase nada; no poente à frente, os feixes */
  const tau = float(1).sub(exp(r4.y.negate())), f = r4.x.div(max(r4.y, 1e-4)).clamp(0.0, 1.0); const e = vec4(entrada);
  const k = S.raiosK || (S.raiosK = uniform(new Tm.Vector2(0.7, 0.025))); /* escurecer a sombra, somar a luz */
  const dbg = S.raiosDbg || (S.raiosDbg = uniform(0)); /* diagnóstico: 1 = fração iluminada, 2 = poeira do raio (tau), 3 = fase */
  const out = max(e.rgb.mul(float(1).sub(tau.mul(f.oneMinus()).mul(k.x))).add(cor.mul(tau.mul(f).mul(r4.z).mul(k.y))), vec3(0));
  return { no, cor: vec4(select(dbg.greaterThan(0.5), vec3(select(dbg.greaterThan(2.5), r4.z.mul(0.25), select(dbg.greaterThan(1.5), tau, f))), out), e.a) };
};
/* diagnóstico: ARD.m5.ceuInfo() e as contas da atmosfera (ARD.m5.ceuCPU) */
M5.ceuCPU = { atmoPrep, medias, matiz, fex, ceuEm, solEm, REF, AT, lum };
M5.ceuInfo = () => ({ on: C.on, hora: C.hora, th: +(E.th / DEG).toFixed(2), thLuz: +(E.thL / DEG).toFixed(2), sol: E.sol.map(v => +v.toFixed(3)), luz: E.luz.map(v => +v.toFixed(3)), deSol: E.deSol, k: +E.k.toFixed(3), cor: E.cor.map(v => +v.toFixed(3)), espaco: E.espaco,
  env: { n: ENV.n, balde: ENV.balde, fase: ENV.fase, ms: ENV.ms.slice(-6) }, ceu: S.ceu ? S.ceu.material.name : null });
})(globalThis.ARD = globalThis.ARD || {});
