/* Aether Rift: Dominion — 5.5b.2: o logo das Centelhas, as insígnias das 10 patentes e os cartões de promoção e de sequência.
   Tudo é desenhado aqui mesmo (canvas 2D, só contas e traços): nenhuma imagem, fonte ou biblioteca nova, nada baixado.
   - LOGO: qual das três propostas do logo das Centelhas o jogo usa ('fenda', 'orbita' ou 'leque'). Trocar a constante troca o jogo inteiro.
   - insignia(): uma família só, que cresce da Recruta ao Soberano da Fenda (forma, metal e brilho mudam a cada patente);
     os cinco níveis são as cinco marcas da base da insígnia (acesas = níveis alcançados); depois do topo, uma estrela no lugar da marca do meio.
   - Os cartões usam o mesmo motor do src/cartoes.js (ARD.cartoes.motor: texto medido, que encolhe até caber e anota a medida).
   Só aparência: este arquivo não conhece a simulação nem as regras das patentes (essas moram no src/patentes.js, do contrato ARD.patentes). */
(function (ARD) {
'use strict';
const LOGO = 'gema'; /* 5.5b.2: a proposta em uso. Primeira rodada (traço simples): 'fenda', 'orbita', 'leque'. Segunda rodada (emblemas ilustrados): 'gema', 'moeda', 'orbe'. Todas continuam desenháveis, para a prancha e para a troca */
const LOGOS = ['fenda', 'orbita', 'leque', 'gema', 'moeda', 'orbe'];
const BRILHO = true; /* 5.5b.2: o brilho que passa pelo logo quando as Centelhas são ganhas na tela final (uma vez, 1 s); false desliga. "Reduzir movimento" desliga sozinho */
let ATUAL = LOGO; function usa(v) { if (LOGOS.includes(v)) ATUAL = v; return ATUAL; } /* troca em tempo de execução, só para pranchas e testes */
const GRAD = ['#FF5E3A', '#E94FA0', '#C13CF5']; /* laranja → magenta → violeta: as cores da marca */
const TAU = Math.PI * 2;
const T = (k, v, r) => (ARD.t ? ARD.t(k, v, r) : String(r != null ? r : k));
const ROMANO = ['', 'I', 'II', 'III', 'IV', 'V'];
const IDS = ['recruta', 'batedor', 'vanguarda', 'capitao', 'comandante', 'estrategista', 'almirante', 'marechal', 'guardiao', 'soberano']; /* a ordem do contrato (ARD.patentes.PATENTES); usada só quando o contrato ainda não está carregado */
const lim = (v, a, b) => Math.max(a, Math.min(b, v));

/* ---------- formas ---------- */
function lente(x, cx, cy, h, w) { x.beginPath(); x.moveTo(cx, cy - h); x.quadraticCurveTo(cx + w, cy, cx, cy + h); x.quadraticCurveTo(cx - w, cy, cx, cy - h); x.closePath(); } /* o rasgo da Fenda: uma lente em pé */
function poli(x, ps) { x.beginPath(); for (let i = 0; i < ps.length; i += 2) { if (i) x.lineTo(ps[i], ps[i + 1]); else x.moveTo(ps[i], ps[i + 1]); } x.closePath(); }
function losango(x, cx, cy, rx, ry) { poli(x, [cx, cy - ry, cx + rx, cy, cx, cy + ry, cx - rx, cy]); }
function estrela(x, cx, cy, r, pontas, dentro) { x.beginPath(); for (let i = 0; i < pontas * 2; i++) { const a = -Math.PI / 2 + i * Math.PI / pontas, rr = i % 2 ? r * dentro : r; const px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr; if (i) x.lineTo(px, py); else x.moveTo(px, py); } x.closePath(); }
function marcaGrad(x, x0, y0, x1, y1) { const g = x.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, GRAD[0]); g.addColorStop(0.55, GRAD[1]); g.addColorStop(1, GRAD[2]); return g; }

/* ---------- 5.5b.2 (segunda rodada): três emblemas ilustrados — D Gema, E Moeda, F Orbe ----------
   Cada um tem a versão RICA (acima de 26 px: camadas, chanfro, luz e sombra, brilho) e a SIMPLES derivada dela (16 e 24 px ao lado dos números).
   Todos desenham em volta de (0, 0), numa caixa de lado s. */
const RICO = 26; const ESCURO = '#2A0B3E';
function halo(x, s, f) { const g = x.createRadialGradient(0, 0, s * 0.08, 0, 0, s * 0.5); g.addColorStop(0, 'rgba(233,79,160,' + (0.42 * f).toFixed(2) + ')'); g.addColorStop(0.6, 'rgba(193,60,245,' + (0.16 * f).toFixed(2) + ')'); g.addColorStop(1, 'rgba(193,60,245,0)'); x.fillStyle = g; x.fillRect(-s / 2, -s / 2, s, s); }
function cintila(x, cx, cy, r) { x.beginPath(); for (let i = 0; i < 8; i++) { const a = -Math.PI / 2 + i * Math.PI / 4, rr = i % 2 ? r * 0.22 : r; const px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr; if (i) x.lineTo(px, py); else x.moveTo(px, py); } x.closePath(); x.fillStyle = '#FFFFFF'; x.fill(); }
function rasgoLuz(x, cy, h, w, s, brilho) { if (brilho) { x.save(); x.shadowColor = 'rgba(255,220,170,.95)'; x.shadowBlur = s * 0.07; } lente(x, 0, cy, h, w); x.fillStyle = '#FFF6E2'; x.fill(); if (brilho) x.restore(); }
/* D — Gema da Fenda: uma lasca de cristal facetada, com mesa, chanfros claros e escuros e o rasgo aceso por dentro */
function gema(x, s) { const O = [0.03, -0.47, 0.28, -0.2, 0.23, 0.21, -0.05, 0.47, -0.28, 0.17, -0.22, -0.23].map(v => v * s); const rico = s > RICO; const k = 0.52; const Tm = O.map(v => v * k);
  x.rotate(0.14); const corpo = () => { const g = x.createLinearGradient(0, -s * 0.47, 0, s * 0.47); g.addColorStop(0, '#C13CF5'); g.addColorStop(0.5, '#E94FA0'); g.addColorStop(1, '#FF5E3A'); return g; };
  if (!rico) { x.rotate(-0.04); x.scale(1.22, 1.06); /* no tamanho pequeno a lasca fica mais larga e mais em pé, para não virar um risco */ poli(x, O); x.fillStyle = corpo(); x.fill(); poli(x, [O[0], O[1], O[2], O[3], O[4], O[5], O[6], O[7], 0, 0]); x.fillStyle = 'rgba(42,11,62,.34)'; x.fill(); /* metade direita na sombra: é o que dá o volume no tamanho pequeno */
    lente(x, 0, 0, s * 0.27, s * 0.2); x.fillStyle = '#FFF6E2'; x.fill(); return; }
  if (s >= 44) { x.save(); x.rotate(-0.14); halo(x, s, 1); x.restore(); }
  poli(x, O); x.fillStyle = corpo(); x.fill();
  const luz = [0.1, -0.34, -0.42, -0.18, 0.2, 0.46]; /* um tom por chanfro, com a luz vindo de cima à esquerda: positivo clareia, negativo escurece */
  for (let i = 0; i < 6; i++) { const j = (i + 1) % 6; poli(x, [O[i * 2], O[i * 2 + 1], O[j * 2], O[j * 2 + 1], Tm[j * 2], Tm[j * 2 + 1], Tm[i * 2], Tm[i * 2 + 1]]); x.fillStyle = luz[i] > 0 ? 'rgba(255,255,255,' + luz[i] + ')' : 'rgba(42,11,62,' + (-luz[i]) + ')'; x.fill(); x.lineWidth = Math.max(0.6, s * 0.006); x.strokeStyle = 'rgba(255,255,255,.28)'; x.stroke(); }
  poli(x, Tm); { const g = x.createLinearGradient(-s * 0.15, -s * 0.25, s * 0.15, s * 0.25); g.addColorStop(0, '#5A1A8C'); g.addColorStop(0.55, '#8E2470'); g.addColorStop(1, '#C2401E'); x.fillStyle = g; x.fill(); } /* a mesa: mais funda, para o rasgo acender dentro dela */
  { const g = x.createRadialGradient(0, 0, 0, 0, 0, s * 0.24); g.addColorStop(0, 'rgba(255,214,150,.85)'); g.addColorStop(1, 'rgba(255,120,80,0)'); x.fillStyle = g; poli(x, Tm); x.fill(); }
  rasgoLuz(x, 0, s * 0.2, s * 0.13, s, true);
  poli(x, O); x.lineWidth = Math.max(1.2, s * 0.03); x.strokeStyle = ESCURO; x.stroke();
  poli(x, [O[10] * 0.93, O[11] * 0.93, O[0] * 0.9 - s * 0.02, O[1] * 0.9, O[0] * 0.62 - s * 0.03, O[1] * 0.62, O[10] * 0.66, O[11] * 0.7]); x.fillStyle = 'rgba(255,255,255,.5)'; x.fill(); /* o reflexo no chanfro de cima */
  x.rotate(-0.14); cintila(x, s * 0.31, -s * 0.31, s * 0.1); if (s >= 64) cintila(x, -s * 0.34, s * 0.3, s * 0.055); }
/* E — Selo da Fenda: uma moeda-emblema vista um pouco de lado, com espessura, aro de metal em degradê, miolo escuro e o rasgo com os cinco mundos */
function moeda(x, s) { const rico = s > RICO; const rx = s * 0.44, ry = s * 0.385, esp = s * (rico ? 0.085 : 0.1); x.rotate(-0.16);
  const elipse = (cy, k) => { x.beginPath(); x.ellipse(0, cy, rx * k, ry * k, 0, 0, TAU); };
  if (rico && s >= 44) { x.save(); x.rotate(0.16); halo(x, s, 0.9); x.restore(); }
  elipse(esp * 0.5, 1); { const g = x.createLinearGradient(-rx, 0, rx, 0); g.addColorStop(0, '#8A2A1C'); g.addColorStop(0.5, '#7A1E5A'); g.addColorStop(1, '#3E1266'); x.fillStyle = g; x.fill(); } /* a espessura: a mesma moeda, mais abaixo e mais escura */
  if (rico) { x.save(); elipse(esp * 0.5, 1); x.clip(); x.strokeStyle = 'rgba(255,255,255,.2)'; x.lineWidth = Math.max(0.6, s * 0.008); for (let i = -9; i <= 9; i++) { const px = i * rx / 9.5; x.beginPath(); x.moveTo(px, 0); x.lineTo(px, ry + esp); x.stroke(); } x.restore(); } /* o serrilhado da borda */
  elipse(-esp * 0.5, 1); x.fillStyle = marcaGrad(x, -rx, ry, rx, -ry); x.fill();
  if (rico) { elipse(-esp * 0.5, 1); x.lineWidth = Math.max(1, s * 0.022); x.strokeStyle = ESCURO; x.stroke(); elipse(-esp * 0.5, 0.93); x.lineWidth = Math.max(0.7, s * 0.012); x.strokeStyle = 'rgba(255,255,255,.55)'; x.stroke(); }
  elipse(-esp * 0.5, rico ? 0.74 : 0.66); { const g = x.createLinearGradient(0, -ry, 0, ry); g.addColorStop(0, '#2B1646'); g.addColorStop(1, '#0E131B'); x.fillStyle = g; x.fill(); }
  if (rico) { x.lineWidth = Math.max(0.8, s * 0.014); x.strokeStyle = 'rgba(42,11,62,.9)'; x.stroke(); const g = x.createRadialGradient(0, -esp * 0.5, 0, 0, -esp * 0.5, rx * 0.6); g.addColorStop(0, 'rgba(255,170,110,.5)'); g.addColorStop(1, 'rgba(233,79,160,0)'); x.fillStyle = g; elipse(-esp * 0.5, 0.74); x.fill(); }
  const cy = -esp * 0.5 + (rico && s >= 44 ? s * 0.035 : 0); if (rico) { lente(x, 0, cy, s * 0.2, s * 0.2); x.fillStyle = marcaGrad(x, 0, cy + s * 0.2, 0, cy - s * 0.2); x.fill(); rasgoLuz(x, cy + s * 0.008, s * 0.12, s * 0.085, s, true); } else { lente(x, 0, cy, s * 0.2, s * 0.17); x.fillStyle = '#FFF6E2'; x.fill(); }
  if (rico && s >= 44) for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i - 2) * 0.44; x.beginPath(); x.arc(Math.cos(a) * rx * 0.56, -esp * 0.5 + Math.sin(a) * ry * 0.56, s * 0.02, 0, TAU); x.fillStyle = i === 2 ? '#FFFFFF' : '#FFC79A'; x.fill(); } /* os cinco mundos, em arco */
  if (rico) { x.beginPath(); x.ellipse(0, -esp * 0.5, rx * 0.86, ry * 0.86, 0, 3.45, 4.45); x.lineWidth = s * 0.03; x.lineCap = 'round'; x.strokeStyle = 'rgba(255,255,255,.8)'; x.stroke(); x.rotate(0.16); cintila(x, s * 0.3, -s * 0.33, s * 0.09); } }
/* F — Coração da Fenda: uma esfera de energia com o rasgo aceso, presa entre três cascas que giram em volta */
function orbe(x, s) { const rico = s > RICO; const r = s * (rico ? 0.255 : 0.27);
  const casca = (a0, a1, ro, ri) => { x.beginPath(); x.arc(0, 0, ro, a0, a1); x.arc(0, 0, ri, a1 - 0.2, a0 + 0.2, true); x.closePath(); };
  const cascas = [[-2.75, -1.35], [-0.6, 0.75], [1.45, 2.7]];
  if (rico && s >= 44) halo(x, s, 1.15);
  if (rico) for (const c of cascas) { casca(c[0], c[1], s * 0.46, s * 0.365); x.fillStyle = marcaGrad(x, -s * 0.45, s * 0.45, s * 0.45, -s * 0.45); x.fill(); x.lineWidth = Math.max(1, s * 0.022); x.strokeStyle = ESCURO; x.stroke(); casca(c[0] + 0.1, c[1] - 0.1, s * 0.44, s * 0.415); x.fillStyle = 'rgba(255,255,255,.45)'; x.fill(); } /* cada casca com um filete de luz na borda de fora */
  else { x.lineWidth = s * 0.12; x.lineCap = 'round'; x.strokeStyle = marcaGrad(x, -s * 0.45, s * 0.45, s * 0.45, -s * 0.45); for (const c of [cascas[0], cascas[1], cascas[2]]) { x.beginPath(); x.arc(0, 0, s * 0.41, c[0] + 0.15, c[1] - 0.15); x.stroke(); } }
  x.beginPath(); x.arc(0, 0, r, 0, TAU); { const g = x.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.05, 0, 0, r); g.addColorStop(0, '#FFFFFF'); g.addColorStop(0.22, '#FFD9A0'); g.addColorStop(0.5, '#FF5E3A'); g.addColorStop(0.78, '#E94FA0'); g.addColorStop(1, '#6B1FB0'); x.fillStyle = g; x.fill(); }
  if (rico) { x.lineWidth = Math.max(1, s * 0.02); x.strokeStyle = ESCURO; x.stroke(); rasgoLuz(x, 0, r * 0.72, r * 0.42, s, true); x.beginPath(); x.ellipse(-r * 0.42, -r * 0.5, r * 0.26, r * 0.14, -0.6, 0, TAU); x.fillStyle = 'rgba(255,255,255,.7)'; x.fill(); cintila(x, s * 0.33, -s * 0.34, s * 0.085); if (s >= 64) { x.fillStyle = '#FFC79A'; losango(x, -s * 0.36, s * 0.36, s * 0.025, s * 0.04); x.fill(); } }
  else { lente(x, 0, 0, r * 0.74, r * 0.5); x.fillStyle = '#FFF6E2'; x.fill(); } }

/* ---------- o logo das Centelhas ----------
   x: contexto 2D; (cx, cy): centro; s: lado da caixa em px; v: 'fenda' | 'orbita' | 'leque' (padrão: LOGO).
   Abaixo de 22 px o desenho é simplificado (menos peças, mais grossas) para não virar mancha. */
function logo(x, cx, cy, s, v) { v = LOGOS.includes(v) ? v : ATUAL; const mini = s < 22; x.save(); x.translate(cx, cy); x.lineJoin = 'round'; x.lineCap = 'round';
  if (v === 'gema' || v === 'moeda' || v === 'orbe') { x.lineJoin = 'miter'; x.lineCap = 'butt'; (v === 'gema' ? gema : v === 'moeda' ? moeda : orbe)(x, s); x.restore(); return; }
  if (v === 'fenda') { /* A — Faísca da Fenda: o rasgo de luz da Fenda, inclinado, soltando duas lascas */
    x.save(); x.rotate(0.3); x.translate(-s * 0.06, s * 0.03); const h = s * (mini ? 0.5 : 0.47), w = s * (mini ? 0.56 : 0.44);
    lente(x, 0, 0, h, w); x.fillStyle = marcaGrad(x, 0, h, 0, -h); x.fill();
    lente(x, 0, s * 0.03, h * 0.56, w * 0.42); x.fillStyle = '#FFF4DC'; x.fill(); x.restore();
    x.fillStyle = GRAD[1]; losango(x, s * 0.33, -s * 0.27, s * (mini ? 0.11 : 0.085), s * (mini ? 0.13 : 0.12)); x.fill();
    if (!mini) { x.fillStyle = GRAD[0]; losango(x, s * 0.39, s * 0.02, s * 0.05, s * 0.07); x.fill(); } }
  else if (v === 'orbita') { /* B — Centelha em Órbita: um miolo em losango e a órbita partida em dois arcos, com a centelha na ponta de um deles */
    const r = s * 0.36, lw = s * (mini ? 0.15 : 0.11); x.lineWidth = lw; x.strokeStyle = marcaGrad(x, -r, r, r, -r);
    x.beginPath(); x.arc(0, 0, r, 2.2, 4.25); x.stroke(); x.beginPath(); x.arc(0, 0, r, -0.95, 1.1); x.stroke();
    x.fillStyle = GRAD[0]; x.beginPath(); x.arc(Math.cos(-0.95) * r + s * 0.03, Math.sin(-0.95) * r - s * 0.05, s * (mini ? 0.12 : 0.085), 0, TAU); x.fill();
    losango(x, 0, 0, s * (mini ? 0.14 : 0.13), s * (mini ? 0.2 : 0.19)); x.fillStyle = mini ? GRAD[0] : '#FFF4DC'; x.fill(); if (!mini) { x.lineWidth = s * 0.035; x.strokeStyle = GRAD[0]; x.stroke(); } }
  else { /* C — Aurora dos Cinco Mundos: cinco raios soltos que sobem de um ponto, o do meio mais alto (os cinco mundos alinhados) */
    const by = s * 0.36; const raio = (ang, r0, r1, larg, cor) => { x.save(); x.translate(0, by); x.rotate(ang); poli(x, [0, -r0, larg, -(r0 + (r1 - r0) * 0.3), 0, -r1, -larg, -(r0 + (r1 - r0) * 0.3)]); x.fillStyle = cor; x.fill(); x.restore(); };
    const L = s * (mini ? 0.085 : 0.06), r0 = s * (mini ? 0.2 : 0.22);
    raio(-1.3, r0, s * 0.5, L, GRAD[0]); raio(1.3, r0, s * 0.5, L, GRAD[2]); raio(-0.65, r0, s * 0.66, L, '#FF7A52'); raio(0.65, r0, s * 0.66, L, '#D946C8'); raio(0, r0, s * 0.84, L * 1.2, GRAD[1]);
    x.fillStyle = mini ? GRAD[0] : '#FFF4DC'; x.beginPath(); x.arc(0, by, s * (mini ? 0.1 : 0.09), 0, TAU); x.fill(); if (!mini) { x.lineWidth = s * 0.035; x.strokeStyle = GRAD[0]; x.stroke(); } }
  x.restore(); }

/* ---------- as insígnias ----------
   Metal de cada patente: [claro, escuro, brilho]. Do aço da Recruta ao degradê da marca do Soberano. */
const METAL = [['#C3CDD8', '#627286', '#9FB2C6'], ['#D5DEE7', '#6C7E96', '#FFA066'], ['#FFBC8A', '#B94E25', '#FF7A45'], ['#FFD09A', '#C85A28', '#FFD27A'], ['#FFE9A8', '#D2912A', '#FFD98A'],
  ['#FFEDB8', '#DA7F3C', '#F578B8'], ['#FFB0D6', '#BF2F78', '#F06CB0'], ['#F9B0EA', '#9C36C6', '#D878FF'], ['#EED6FF', '#7F3AD8', '#C97BFF'], ['#FFFFFF', '#E94FA0', '#FF9A6A']];
const PLACA = '#0E131B';
/* pat: { ordem 0–9, nivel 1–5, estrelas ≥ 0 }. R: metade do lado da caixa (a insígnia cabe em 2R × 2R com centro em (cx, cy)).
   o.apagada: a versão "ainda não alcançada" da escada do Perfil (sem cor nem brilho). */
function insignia(x, cx, cy, R, pat, o) { o = o || {}; const ord = lim((pat && pat.ordem) | 0, 0, 9), niv = lim((pat && pat.nivel) | 0 || 1, 1, 5), est = Math.max(0, (pat && pat.estrelas) | 0); const px = R * 2; const mini = px < 34, grande = px >= 64;
  const M = o.apagada ? ['#7A8492', '#3C4551', '#7A8492'] : METAL[ord]; const u = R * (ord >= 8 ? 0.63 : ord >= 6 ? 0.68 : 0.74); const oy = cy - R * (ord === 9 ? 0.1 : 0.17);
  x.save(); x.lineJoin = 'round'; x.lineCap = 'round';
  /* brilho de trás (só nas patentes altas e em tamanho que comporta) */
  if (!o.apagada && ord >= 5 && px >= 40) { const f = (ord - 4) / 5; const g = x.createRadialGradient(cx, oy, R * 0.1, cx, oy, R * 1.05); g.addColorStop(0, 'rgba(233,79,160,' + (0.16 + 0.3 * f).toFixed(2) + ')'); g.addColorStop(0.6, 'rgba(193,60,245,' + (0.05 + 0.12 * f).toFixed(2) + ')'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(cx - R, cy - R, px, px); }
  x.translate(cx, oy); x.scale(u, u); const lw = Math.max(mini ? 1.5 / u : 1.2 / u, 0.1); /* daqui em diante, unidades da insígnia: o corpo vai de −1 a 1 */
  const metal = () => { if (ord === 9 && !o.apagada) return marcaGrad(x, -1, 1, 1, -1); const g = x.createLinearGradient(0, -1, 0, 1); g.addColorStop(0, M[0]); g.addColorStop(1, M[1]); return g; };
  const placa = () => { const g = x.createLinearGradient(0, -1, 0, 1); g.addColorStop(0, o.apagada ? '#161B23' : ord >= 6 ? '#1B1230' : '#161D28'); g.addColorStop(1, PLACA); return g; };
  const divisa = (y, w, h, t) => { poli(x, [-w, y, 0, y + h, w, y, w, y - t, 0, y + h - t, -w, y - t]); x.fillStyle = metal(); x.fill(); };
  const rasgo = (y0, y1, w, miolo) => { const cyy = (y0 + y1) / 2, h = (y1 - y0) / 2; lente(x, 0, cyy, h, w); x.fillStyle = o.apagada ? M[0] : ord >= 6 ? marcaGrad(x, 0, y1, 0, y0) : metal(); x.fill(); if (miolo && !mini) { lente(x, 0, cyy + h * 0.05, h * 0.58, w * 0.4); x.fillStyle = o.apagada ? '#2A313B' : '#FFF6E2'; x.fill(); } };
  const mundos = (r, rp) => { if (mini) return; for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i - 2) * 0.42; x.beginPath(); x.arc(Math.cos(a) * r, Math.sin(a) * r, rp, 0, TAU); x.fillStyle = i === 2 && !o.apagada ? '#FFFFFF' : M[0]; x.fill(); } };
  const borda = (dupla) => { x.lineWidth = lw * (ord >= 4 ? 1.25 : 1); x.strokeStyle = metal(); x.stroke(); if (dupla && !mini) { x.save(); x.scale(0.8, 0.8); x.lineWidth = lw * 0.45; x.strokeStyle = o.apagada ? 'rgba(255,255,255,.12)' : 'rgba(255,255,255,.3)'; x.stroke(); x.restore(); } };
  const asas = (n, y, alc) => { for (const s of [-1, 1]) for (let i = 0; i < n; i++) { const yy = y + i * 0.3, a = alc - i * 0.16; poli(x, [s * 0.66, yy + 0.06, s * a, yy - 0.34, s * (a - 0.06), yy - 0.06, s * 0.7, yy + 0.3]); x.fillStyle = metal(); x.fill(); } };
  const raios = (n, r0, r1, al) => { if (px < 40 || o.apagada) return; x.save(); x.globalAlpha = al; x.fillStyle = M[2]; for (let i = 0; i < n; i++) { x.save(); x.rotate(i * TAU / n); poli(x, [0, -r1, 0.045, -r0, -0.045, -r0]); x.fill(); x.restore(); } x.restore(); };
  if (ord === 0) divisa(-0.2, 0.84, 0.66, 0.4); /* Recruta: uma divisa */
  else if (ord === 1) { divisa(-0.52, 0.84, 0.56, 0.3); divisa(0.02, 0.84, 0.56, 0.3); } /* Batedor: duas divisas */
  else if (ord === 2) { losango(x, 0, 0, 0.9, 1); x.fillStyle = placa(); x.fill(); borda(false); rasgo(-0.6, 0.12, 0.36, false); divisa(0.2, 0.42, 0.3, 0.2); } /* Vanguarda: a placa em losango, o primeiro rasgo e uma divisa */
  else if (ord === 3) { losango(x, 0, 0, 0.9, 1); x.fillStyle = placa(); x.fill(); borda(true); rasgo(-0.62, 0.62, 0.5, true); if (!mini) { x.fillStyle = metal(); losango(x, -0.5, 0, 0.09, 0.2); x.fill(); losango(x, 0.5, 0, 0.09, 0.2); x.fill(); } } /* Capitão de Fenda: o rasgo inteiro, com miolo de luz */
  else if (ord === 4) { poli(x, [-0.82, -0.94, 0.82, -0.94, 0.82, 0.22, 0, 1, -0.82, 0.22]); x.fillStyle = placa(); x.fill(); borda(false); rasgo(-0.72, 0.2, 0.4, true); divisa(0.3, 0.46, 0.34, 0.2); } /* Comandante: o escudo */
  else if (ord === 5) { poli(x, [-0.82, -0.94, 0.82, -0.94, 0.82, 0.22, 0, 1, -0.82, 0.22]); x.fillStyle = placa(); x.fill(); borda(true); mundos(0.66, 0.07); rasgo(mini ? -0.66 : -0.38, 0.72, 0.42, true); } /* Estrategista: os cinco mundos alinhados sobre o rasgo */
  else if (ord === 6) { asas(2, -0.2, 1.42); poli(x, [-0.72, -0.94, 0.72, -0.94, 0.72, 0.22, 0, 1, -0.72, 0.22]); x.fillStyle = placa(); x.fill(); borda(false); rasgo(-0.7, 0.66, 0.5, true); } /* Almirante: o escudo ganha asas */
  else if (ord === 7) { asas(3, -0.36, 1.46); poli(x, [-0.72, -0.94, 0.72, -0.94, 0.72, 0.22, 0, 1, -0.72, 0.22]); x.fillStyle = placa(); x.fill(); borda(true); mundos(0.64, 0.065); rasgo(mini ? -0.66 : -0.36, 0.7, 0.42, true); } /* Marechal do Alinhamento: três asas e os cinco mundos */
  else { raios(ord === 9 ? 20 : 12, 0.9, ord === 9 ? 1.42 : 1.24, ord === 9 ? 0.7 : 0.5); asas(3, -0.34, 1.52);
    if (ord === 9) { for (let i = 0; i < 5; i++) { const a = (i - 2) * 0.36, alt = i === 2 ? 1.4 : i % 2 ? 1.27 : 1.16; x.save(); x.rotate(a); poli(x, [-0.16, -0.8, 0, -alt, 0.16, -0.8]); x.fillStyle = metal(); x.fill(); x.restore(); } } /* Soberano: a coroa de cinco pontas */
    x.beginPath(); x.arc(0, 0, 0.88, 0, TAU); x.fillStyle = placa(); x.fill(); borda(true);
    if (!mini) { x.beginPath(); x.arc(0, 0, 0.6, 0, TAU); x.lineWidth = lw * 0.5; x.strokeStyle = metal(); x.stroke(); }
    if (ord === 9) mundos(0.74, 0.06); rasgo(-0.56, 0.56, 0.52, true);
    if (grande && !o.apagada) { x.save(); x.globalCompositeOperation = 'lighter'; const g = x.createRadialGradient(0, 0, 0.02, 0, 0, 0.6); g.addColorStop(0, ord === 9 ? 'rgba(255,255,255,.55)' : 'rgba(255,255,255,.3)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.beginPath(); x.arc(0, 0, 0.6, 0, TAU); x.fill(); x.restore(); } } /* Guardião e Soberano: o brasão redondo, com anel, asas e raios */
  x.restore();
  /* as cinco marcas de nível, na base: acesas = níveis alcançados (em px da caixa, para ficarem nítidas em 20 px) */
  x.save(); const py = cy + R * 0.8, passo = R * 0.34, rp = Math.max(1, R * 0.115);
  for (let i = 0; i < 5; i++) { const pxx = cx + (i - 2) * passo; const on = i < niv;
    if (est > 0 && i === 2) { estrela(x, pxx, py - R * 0.02, R * 0.21, 5, 0.46); x.fillStyle = o.apagada ? '#59626E' : '#FFF1B8'; x.fill(); continue; } /* depois do topo: a estrela no lugar da marca do meio */
    if (mini) { x.fillStyle = on ? (o.apagada ? '#8A94A2' : ord >= 6 ? '#FFFFFF' : M[0]) : 'rgba(255,255,255,.2)'; x.fillRect(Math.round(pxx - rp), Math.round(py - rp), Math.max(2, Math.round(rp * 2)), Math.max(2, Math.round(rp * 2))); }
    else { losango(x, pxx, py, rp, rp * 1.25); if (on) { x.fillStyle = o.apagada ? '#8A94A2' : ord >= 6 ? '#FFFFFF' : M[0]; x.fill(); } else { x.fillStyle = 'rgba(255,255,255,.1)'; x.fill(); x.lineWidth = Math.max(1, R * 0.02); x.strokeStyle = 'rgba(255,255,255,.26)'; x.stroke(); } } }
  x.restore(); }

/* ---------- para a interface: imagens prontas (com memória) ---------- */
const MEMO = new Map();
function folha(px) { const k = lim(typeof devicePixelRatio === 'number' ? Math.ceil(devicePixelRatio) : 1, 2, 3); const c = document.createElement('canvas'); c.width = c.height = px * k; const x = c.getContext('2d'); x.scale(k, k); return { c, x }; }
/* o que viaja na lista da sala: [ordem, nível, estrelas], só números dentro da faixa (o que vier torto vira null: ninguém ganha insígnia por engano) */
function forma(p) { if (Array.isArray(p)) p = { ordem: p[0], nivel: p[1], estrelas: p[2] }; if (!p || typeof p !== 'object') return null; const o = +p.ordem, n = +p.nivel, e = +p.estrelas || 0;
  if (!Number.isInteger(o) || o < 0 || o > 9 || !Number.isInteger(n) || n < 1 || n > 5 || !Number.isInteger(e) || e < 0) return null; return [o, n, Math.min(999, o === 9 && n === 5 ? e : 0)]; }
function dePat(p) { const f = forma(p); return f ? { ordem: f[0], nivel: f[1], estrelas: f[2] } : null; }
function url(pat, px, apagada) { const p = dePat(pat); if (!p || typeof document === 'undefined') return ''; const k = 'i' + p.ordem + '.' + p.nivel + '.' + (p.estrelas ? 1 : 0) + '.' + px + (apagada ? 'a' : ''); let u = MEMO.get(k); if (!u) { const F = folha(px); insignia(F.x, px / 2, px / 2, px / 2, p, { apagada }); u = F.c.toDataURL('image/png'); MEMO.set(k, u); } return u; }
function urlLogo(px, v) { if (typeof document === 'undefined') return ''; const k = 'l' + (v || ATUAL) + px; let u = MEMO.get(k); if (!u) { const F = folha(px); logo(F.x, px / 2, px / 2, px, v); u = F.c.toDataURL('image/png'); MEMO.set(k, u); } return u; }
const escA = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function idDe(ordem) { const P = ARD.patentes && ARD.patentes.PATENTES; const a = P && P[lim(ordem | 0, 0, 9)]; return a ? a.id : IDS[lim(ordem | 0, 0, 9)]; } /* aqui "ordem" é sempre a posição de 0 a 9 na lista (no contrato, patente.ordem vai de 1 a 10: quem converte é o src/perfil-ui.js, pelo id) */
/* "Capitão de Fenda III" no idioma atual (chaves do contrato: patente.<id>.nome e patente.nivel) */
function nome(pat) { const p = dePat(pat); if (!p) return ''; const id = (pat && typeof pat.id === 'string' && pat.id) || idDe(p.ordem); return T('patente.nivel', { patente: T('patente.' + id + '.nome', null, id), n: ROMANO[p.nivel] }, '{patente} {n}'); }
function nomeSo(pat) { const p = dePat(pat); if (!p) return ''; const id = (pat && typeof pat.id === 'string' && pat.id) || idDe(p.ordem); return T('patente.' + id + '.nome', null, id); }
/* HTML pronto: <img> da insígnia (com o nome da patente como texto alternativo) e <img> do logo das Centelhas (decorativo) */
function html(pat, px, o) { const p = dePat(pat); if (!p) return ''; o = o || {}; return '<img class="ins' + (o.cls ? ' ' + o.cls : '') + '" src="' + url(p, px, o.apagada) + '" width="' + px + '" height="' + px + '" alt="' + escA(o.semAlt ? '' : nome(pat)) + '"' + (o.semAlt ? ' aria-hidden="true"' : '') + ' draggable="false">'; }
function htmlLogo(px) { return '<img class="ins-centelha" src="' + urlLogo(px) + '" width="' + px + '" height="' + px + '" alt="" aria-hidden="true" draggable="false">'; }

/* ---------- cartões (motor do src/cartoes.js) ----------
   q (promoção): { patente: { id, ordem, nivel, estrelas }, cmd (nome do Comandante), raca (nome da Raça favorita, já no idioma; pode faltar), cor (da Raça),
                   xp (Centelhas), degrau (1 a 50), dias (sequência do Desafio do Dia) } */
function numTxt(v) { return ARD.i18n && ARD.i18n.num ? ARD.i18n.num(Math.floor(v)) : String(Math.floor(v)); }
function fundo(K, m) { const x = K.x, W = K.W, H = K.H; m.fundoMarca(K); const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(5,7,11,.55)'); g.addColorStop(0.4, 'rgba(5,7,11,.1)'); g.addColorStop(1, 'rgba(5,7,11,.82)'); x.fillStyle = g; x.fillRect(0, 0, W, H); }
async function promocao(q, fmt) { const m = ARD.cartoes.motor; const K = m.tela(fmt); const x = K.x, W = K.W, H = K.H; const pe = K.c._fmt === 'pe'; const cor = q.cor || '#FFB088'; await m.fontes(); fundo(K, m);
  const pat = dePat(q.patente) || { ordem: 0, nivel: 1, estrelas: 0 }; const nm = nomeSo(q.patente).toUpperCase(); const nivel = T('patente.cartao.nivel', { n: ROMANO[pat.nivel] }).toUpperCase() + (pat.estrelas ? ' · ★ ' + pat.estrelas : '');
  const sou = T('patente.cartao.sou').toUpperCase(); const rot = T('patente.cartao.rotulo').toUpperCase(); const quem = q.cmd || T('geral.comandante'); const fav = q.raca ? T('patente.cartao.raca', { raca: q.raca }) : '';
  const ns = [{ v: numTxt(q.xp || 0), r: T('patente.moeda.nome'), logo: true }, { v: T('patente.cartao.degrau.v', { n: q.degrau || 1 }), r: T('patente.cartao.degrau') }, { v: numTxt(q.dias || 0), r: T('patente.cartao.dias') }];
  if (!pe) { const M = 48; m.marca(K, M, 78, 44); m.texto(K, rot, W - M, 70, { id: 'rotulo', peso: '500', tam: 20, min: 13, fam: m.FM, max: 560, cor, alinha: 'dir', esp: 3 });
    insignia(x, 232, 322, 190, pat); const tx = 468, L = W - M - tx;
    const ls = m.quebra(x, nm, '800 112px ' + m.FD, L, 2); let tm = 112; for (; tm > 40; tm -= 2) { x.font = '800 ' + tm + 'px ' + m.FD; if (ls.every(l => x.measureText(l).width <= L)) break; }
    const alt = tm * 0.9; const total = 30 + alt * ls.length + 52; let y = 318 - total / 2 + 24;
    m.texto(K, sou, tx, y, { id: 'sou', peso: '500', tam: 24, min: 14, fam: m.FM, max: L, cor: m.CLARO, esp: 4 }); y += 8;
    ls.forEach((l, i) => { y += alt; m.texto(K, l, tx - 3, y, { id: 'nome' + i, peso: '800', tam: tm, min: 40, fam: m.FD, max: L, grad: true }); }); y += 50;
    m.texto(K, nivel, tx, y, { id: 'nivel', peso: '700', tam: 40, min: 20, fam: m.FD, max: L, cor });
    x.fillStyle = 'rgba(255,255,255,.16)'; x.fillRect(M, H - 118, W - 2 * M, 2);
    m.texto(K, quem, M, H - 62, { id: 'quem', peso: '700', tam: 34, min: 16, fam: m.FD, max: 400 }); if (fav) m.texto(K, fav, M, H - 30, { id: 'raca', peso: '500', tam: 20, min: 12, fam: m.FB, max: 400, cor: m.SUAVE });
    const x0 = 500, cw = (W - M - x0) / 3; ns.forEach((n, i) => { const cx = x0 + i * cw; let dx = 0; if (n.logo) { logo(x, cx + 22, H - 78, 44); dx = 52; }
      m.texto(K, n.v, cx + dx, H - 58, { id: 'num' + i, peso: '800', tam: 56, min: 22, fam: m.FD, max: cw - 16 - dx }); m.texto(K, String(n.r).toUpperCase(), cx, H - 30, { id: 'rot' + i, peso: '500', tam: 15, min: 10, fam: m.FM, max: cw - 16, cor, esp: 1.5 }); }); }
  else { const M = 64, L = W - 2 * M, cx = W / 2; m.marca(K, M, 118, 58); m.texto(K, rot, M, 158, { id: 'rotulo', peso: '500', tam: 24, min: 14, fam: m.FM, max: L, cor, esp: 4 });
    insignia(x, cx, 468, 262, pat);
    m.texto(K, sou, cx, 800, { id: 'sou', peso: '500', tam: 30, min: 16, fam: m.FM, max: L, cor: m.CLARO, esp: 5, alinha: 'centro' });
    const ls = m.quebra(x, nm, '800 150px ' + m.FD, L, 2); let tm = ls.length > 1 ? 110 : 150; /* nome em duas linhas: letra menor, para o nível não descer sobre os números */ for (; tm > 48; tm -= 2) { x.font = '800 ' + tm + 'px ' + m.FD; if (ls.every(l => x.measureText(l).width <= L)) break; }
    let y = 822; const alt = tm * 0.9; ls.forEach((l, i) => { y += alt; m.texto(K, l, cx, y, { id: 'nome' + i, peso: '800', tam: tm, min: 48, fam: m.FD, max: L, grad: true, alinha: 'centro' }); }); y += 64;
    m.texto(K, nivel, cx, y, { id: 'nivel', peso: '700', tam: 52, min: 24, fam: m.FD, max: L, cor, alinha: 'centro' });
    x.fillStyle = 'rgba(255,255,255,.16)'; x.fillRect(M, H - 232, L, 2);
    const cw = L / 3; ns.forEach((n, i) => { const c0 = M + i * cw; let dx = 0; if (n.logo) { logo(x, c0 + 28, H - 168, 56); dx = 66; }
      m.texto(K, n.v, c0 + dx, H - 142, { id: 'num' + i, peso: '800', tam: 72, min: 26, fam: m.FD, max: cw - 20 - dx }); m.texto(K, String(n.r).toUpperCase(), c0, H - 106, { id: 'rot' + i, peso: '500', tam: 19, min: 11, fam: m.FM, max: cw - 20, cor, esp: 1.5 }); });
    m.texto(K, fav ? quem + ' · ' + fav : quem, cx, H - 48, { id: 'quem', peso: '700', tam: 34, min: 16, fam: m.FD, max: L, alinha: 'centro', alt: [quem] }); }
  return K.c; }

/* q (sequência): { dias (7, 14 ou 30; qualquer número serve), patente, cmd, cor, xp } — o número grande dentro de um anel com um traço por dia */
function anelDias(x, cx, cy, r, dias) { const n = lim(dias | 0, 1, 60); x.save(); x.lineCap = 'butt'; x.lineWidth = r * 0.12; const vao = n > 20 ? 0.035 : 0.06;
  const halo = x.createRadialGradient(cx, cy, r * 0.3, cx, cy, r * 1.5); halo.addColorStop(0, 'rgba(193,60,245,.42)'); halo.addColorStop(0.6, 'rgba(255,94,58,.12)'); halo.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = halo; x.fillRect(cx - r * 1.6, cy - r * 1.6, r * 3.2, r * 3.2);
  x.beginPath(); x.arc(cx, cy, r * 0.86, 0, TAU); x.fillStyle = 'rgba(11,15,21,.82)'; x.fill();
  for (let i = 0; i < n; i++) { const a0 = -Math.PI / 2 + i * TAU / n + vao / 2, a1 = -Math.PI / 2 + (i + 1) * TAU / n - vao / 2; const f = i / Math.max(1, n - 1); x.strokeStyle = f < 0.5 ? GRAD[0] : f < 0.8 ? GRAD[1] : GRAD[2]; x.beginPath(); x.arc(cx, cy, r, a0, a1); x.stroke(); }
  x.restore(); }
async function sequencia(q, fmt) { const m = ARD.cartoes.motor; const K = m.tela(fmt); const x = K.x, W = K.W, H = K.H; const pe = K.c._fmt === 'pe'; const cor = q.cor || '#FFB088'; await m.fontes(); fundo(K, m);
  const dias = Math.max(1, q.dias | 0); const rot = T('patente.seq.cartao.rotulo').toUpperCase(); const tit = T('patente.seq.cartao.titulo', { n: dias }).toUpperCase(); const sub = T('patente.seq.cartao.sub'); const pat = dePat(q.patente);
  const quem = (q.cmd || T('geral.comandante')) + (pat ? ' · ' + nome(q.patente) : '');
  if (!pe) { const M = 48; m.marca(K, M, 78, 44); m.texto(K, rot, W - M, 70, { id: 'rotulo', peso: '500', tam: 20, min: 13, fam: m.FM, max: 560, cor, alinha: 'dir', esp: 3 });
    anelDias(x, 236, 322, 160, dias); m.texto(K, String(dias), 236, 322 + 62, { id: 'dias', peso: '800', tam: 180, min: 80, fam: m.FD, max: 230, grad: true, alinha: 'centro' });
    const tx = 468, L = W - M - tx; const ls = m.quebra(x, tit, '800 112px ' + m.FD, L, 2); let tm = 112; for (; tm > 40; tm -= 2) { x.font = '800 ' + tm + 'px ' + m.FD; if (ls.every(l => x.measureText(l).width <= L)) break; }
    const alt = tm * 0.9; let y = 322 - (alt * ls.length + 50) / 2 - 6; ls.forEach((l, i) => { y += alt; m.texto(K, l, tx - 3, y, { id: 'titulo' + i, peso: '800', tam: tm, min: 40, fam: m.FD, max: L, grad: true }); }); y += 48;
    m.texto(K, sub, tx, y, { id: 'sub', peso: '500', tam: 30, min: 16, fam: m.FB, max: L, cor: m.CLARO });
    x.fillStyle = 'rgba(255,255,255,.16)'; x.fillRect(M, H - 96, W - 2 * M, 2); let dx = 0; if (pat) { insignia(x, M + 30, H - 50, 30, pat); dx = 74; }
    m.texto(K, quem, M + dx, H - 38, { id: 'quem', peso: '700', tam: 34, min: 16, fam: m.FD, max: W - 2 * M - dx }); }
  else { const M = 64, L = W - 2 * M, cx = W / 2; m.marca(K, M, 118, 58); m.texto(K, rot, M, 158, { id: 'rotulo', peso: '500', tam: 24, min: 14, fam: m.FM, max: L, cor, esp: 4 });
    anelDias(x, cx, 500, 240, dias); m.texto(K, String(dias), cx, 500 + 96, { id: 'dias', peso: '800', tam: 280, min: 120, fam: m.FD, max: 350, grad: true, alinha: 'centro' });
    const ls = m.quebra(x, tit, '800 140px ' + m.FD, L, 2); let tm = 140; for (; tm > 48; tm -= 2) { x.font = '800 ' + tm + 'px ' + m.FD; if (ls.every(l => x.measureText(l).width <= L)) break; }
    let y = 800; const alt = tm * 0.9; ls.forEach((l, i) => { y += alt; m.texto(K, l, cx, y, { id: 'titulo' + i, peso: '800', tam: tm, min: 48, fam: m.FD, max: L, grad: true, alinha: 'centro' }); }); y += 62;
    m.texto(K, sub, cx, y, { id: 'sub', peso: '500', tam: 36, min: 18, fam: m.FB, max: L, cor: m.CLARO, alinha: 'centro' });
    x.fillStyle = 'rgba(255,255,255,.16)'; x.fillRect(M, H - 190, L, 2); if (pat) insignia(x, cx, H - 128, 40, pat);
    m.texto(K, quem, cx, H - 44, { id: 'quem', peso: '700', tam: 36, min: 16, fam: m.FD, max: L, alinha: 'centro' }); }
  return K.c; }
function arq(nome2, fmt) { const F = ARD.cartoes.FORMATOS[fmt]; return 'aether-rift-dominion-' + nome2 + '-' + F.w + 'x' + F.h + '.png'; }
/* abre a janela do cartão (a mesma #cartao dos outros cartões). dados(): devolve o q acima, lido na hora (para refazer na troca de idioma) */
function abrirPromocao(dados) { if (!ARD.cartoes) return Promise.resolve(); return ARD.cartoes.abrir({ titulo: T('patente.cartao.titulo'), desenha: fmt => promocao(dados(), fmt), nome: fmt => arq('patente-' + idDe((dePat(dados().patente) || { ordem: 0 }).ordem), fmt), texto: () => T('patente.cartao.texto', { patente: nome(dados().patente) }) }); }
function abrirSequencia(dados) { if (!ARD.cartoes) return Promise.resolve(); return ARD.cartoes.abrir({ titulo: T('patente.seq.cartao.janela'), desenha: fmt => sequencia(dados(), fmt), nome: fmt => arq('sequencia-' + (dados().dias | 0), fmt), texto: () => T('patente.seq.cartao.texto', { n: dados().dias | 0 }) }); }

ARD.insignias = { LOGO, LOGOS, BRILHO, usa, get logoAtual() { return ATUAL; }, IDS, ROMANO, logo, insignia, forma, dePat, url, urlLogo, html, htmlLogo, nome, nomeSo, idDe, promocao, sequencia, abrirPromocao, abrirSequencia };
})(globalThis.ARD = globalThis.ARD || {});
