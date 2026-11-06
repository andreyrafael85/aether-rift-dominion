/* Aether Rift: Dominion — 5.0h (agente h-mundo): os modelos do mundo neutro, no mesmo construtor (Kit) e no mesmo formato das malhas de
   hoje (src/meshes.js): cor, rugosidade e metal por vértice, partes emissivas separadas e animação por peça (spin, leg, bob, flap, sway) na GPU.
   Entram pelo gancho ARD.meshes.receitas (como os chefões da 5.0g), então valem nos dois motores com o material e as instâncias de sempre:
   nenhum material nem pipeline novo. Montados na carga só quando a partida tem o mundo neutro (src/mundo-ui.js, jobs).
   - Ruínas dos Construtores: pedra antiga clara com veios de metal escuro e runas. Livre (desenhada no jogador neutro, cor de areia), as runas
     ficam apagadas em verde-água; capturada (desenhada no dono), acendem na cor do time.
       ruina_observatorio (anel de lente girando sobre a torre partida), ruina_forja (bigorna de pedra com braços-martelo e o núcleo em brasa),
       ruina_portal (arco de anel em pé com o véu aceso no meio), ruina_torre (obelisco com o cristal flutuando no alto).
   - acampamento: a nave da Irmandade Corsária ancorada sobre a Fenda (casco, balão, velas, lanternas e correntes até o chão).
   - fauna_pastador (herbívoro de quatro patas com placas de cristal no dorso), fauna_guardiao (fera blindada de cristal, chifres e garras),
     fauna_enxame (três mariposas de éter batendo as asas).
   Os mercenários usam o modelo do Pirata da Raça de quem contrata (src/mundo-ui.js, modelo3d). */
(function (ARD) {
'use strict';
const PI = Math.PI;
const PED = '#B9AE98', PED2 = '#8E8471', PED3 = '#5E574B', MET = '#3A3F47', MET2 = '#6B7280', BRONZE = '#A9824A', DORM = '#4FD6C2';
const COR_NEUTRA = '#C8B27A';
function runa(tc) { const livre = !tc || String(tc).toUpperCase() === COR_NEUTRA; return { c: livre ? DORM : tc, e: livre ? 0.9 : 2.6, livre }; } /* livre: runas apagadas; capturada: acesas na cor do dono */

function base(K, R, h, s) { /* plataforma octogonal em degraus, gasta e rachada */
  K.prism(0, 0, 0, R, h * 0.55, 8, PED3, 'stone', { top: 0.97, ry: PI / 8 });
  K.prism(0, h * 0.55, 0, R * 0.86, h * 0.45, 8, PED2, 'stone', { top: 0.96, ry: PI / 8 });
  K.fine(() => { for (let i = 0; i < 6; i++) { const a = i * 1.07 + s; K.rock(Math.cos(a) * R * 1.08, 0.2, Math.sin(a) * R * 1.08, 0.5 + (i % 3) * 0.25, PED2, 'stone', { amp: 0.3 }); } });
}
function coluna(K, x, z, h, partida) { K.cyl(x, 0, z, 0.55, 0.65, h, PED, 'stone', { seg: 8, facet: true }); K.box(x, h, z, 1.5, 0.35, 1.5, PED2, 'stone'); if (partida) K.rock(x + 0.2, h + 0.3, z, 0.45, PED, 'stone', { amp: 0.4 }); }

/* ---------- Observatório: torre partida com o anel da lente girando e o olho de cristal ---------- */
function observatorio(K, P, tc) {
  K.base = 0; const r = runa(tc); base(K, 6.2, 1.6, 0.3);
  for (let i = 0; i < 4; i++) { const a = i * PI / 2 + PI / 4; coluna(K, Math.cos(a) * 4.6, Math.sin(a) * 4.6, 3.6 + (i % 2) * 1.6, i % 2 === 0); }
  K.cyl(0, 1.6, 0, 1.9, 2.4, 7.5, PED, 'stone', { seg: 10, facet: true });
  K.cyl(0, 9.1, 0, 2.3, 2.0, 0.6, MET, 'metal', { seg: 12 });
  for (let i = 0; i < 6; i++) { const a = i * PI / 3; K.box(Math.cos(a) * 1.96, 3.0, Math.sin(a) * 1.96, 0.3, 4.6, 0.3, r.c, null, { e: r.e }); } /* veios acesos na torre */
  K.anim({ t: 'spin', p: [0, 11.2, 0], speed: r.livre ? 0.15 : 0.6 }, () => {
    K.tor(0, 11.2, 0, 3.3, 0.28, BRONZE, 'metal', { ts: 36, rs: 6, rx: 0.5 });
    K.tor(0, 11.2, 0, 2.6, 0.18, MET2, 'metal', { ts: 30, rs: 5, rx: -0.6, rz: 0.4 });
    for (let i = 0; i < K.q(6); i++) { const a = i * PI / 3; K.box(Math.cos(a) * 3.3, 11.0 + Math.sin(a) * 1.6, Math.sin(a) * 3.3 * 0.88, 0.4, 0.4, 0.4, r.c, null, { e: r.e * 1.1 }); }
  });
  K.anim({ t: 'bob', amp: 0.25, speed: 1.2 }, () => { K.oct(0, 10.0, 0, 1.15, 2.6, r.c, null, { e: r.e * 1.15 }); K.sph(0, 11.3, 0, 0.55, '#F4FFFB', null, { e: r.livre ? 1.2 : 3.0, seg: 10 }); });
}
/* ---------- Forja Antiga: bigorna de pedra com dois braços-martelo, o núcleo em brasa e chaminés ---------- */
function forja(K, P, tc) {
  K.base = 0; const r = runa(tc); base(K, 6.6, 1.4, 1.1);
  K.box(0, 1.4, 0, 6.4, 3.0, 4.8, PED2, 'stone', { b: 0.3 });
  K.box(0, 4.4, 0, 8.4, 1.4, 4.0, PED, 'stone', { b: 0.25 });
  K.box(0, 2.0, -2.45, 4.4, 2.2, 0.15, MET, 'metal');
  K.sph(0, 3.1, -2.45, 0.95, r.livre ? '#7A4A2A' : '#FF8A3A', null, { e: r.livre ? 0.6 : 2.6, seg: 12, sz: 0.4 }); /* boca da fornalha */
  for (const s of [-1, 1]) { K.anim({ t: 'sway', p: [s * 3.4, 6.2, 0], amp: r.livre ? 0.02 : 0.12, speed: 1.6, ph: s > 0 ? 0 : PI }, () => {
    K.seg([s * 3.4, 6.2, 0], [s * 1.6, 9.6, 0], 0.45, MET2, 'metal', { seg: 8 }); K.seg([s * 1.6, 9.6, 0], [s * 0.6, 7.2, 0], 0.4, MET2, 'metal', { seg: 8 });
    K.box(s * 0.6, 6.0, 0, 1.8, 1.4, 1.8, BRONZE, 'metal', { b: 0.2 }); }); }
  for (const z of [-1.4, 1.4]) { K.cyl(3.0, 5.8, z, 0.45, 0.6, 3.6, PED3, 'stone', { seg: 8 }); K.cyl(3.0, 9.4, z, 0.5, 0.5, 0.25, r.c, null, { e: r.e, seg: 8 }); }
  for (let i = 0; i < 5; i++) K.box(-3.0 + i * 1.5, 5.82, 2.05, 0.6, 0.6, 0.12, r.c, null, { e: r.e }); /* runas da forja */
}
/* ---------- Portal: arco em anel, em pé, com o véu de éter aceso no meio ---------- */
function portal(K, P, tc) {
  K.base = 0; const r = runa(tc); base(K, 6.0, 1.2, 2.2);
  for (const s of [-1, 1]) { K.box(0, 1.2, s * 4.3, 2.2, 3.2, 2.0, PED2, 'stone', { b: 0.25 }); }
  K.tor(0, 7.6, 0, 4.6, 0.75, PED, 'stone', { ts: 32, rs: 8, rz: PI / 2 });
  K.tor(0, 7.6, 0, 4.1, 0.22, MET, 'metal', { ts: 32, rs: 6, rz: PI / 2 });
  for (let i = 0; i < K.q(10); i++) { const a = i / 10 * PI * 2; K.box(0, 7.6 + Math.sin(a) * 4.6 - 0.25, Math.cos(a) * 4.6, 0.5, 0.5, 0.5, r.c, null, { e: r.e * 1.2 }); }
  K.anim({ t: 'spin', p: [0, 7.6, 0], axis: 'x', speed: r.livre ? 0.2 : 1.1 }, () => {
    K.cyl(0, 7.6, 0, 3.7, 3.7, 0.12, r.livre ? '#2C5F5A' : r.c, null, { e: r.livre ? 0.45 : 1.6, seg: 28, rz: PI / 2 }); /* o véu (disco fino de pé) */
    K.fine(() => { for (let i = 0; i < 3; i++) K.tor(0, 7.6, 0, 1.2 + i * 0.9, 0.06, '#E8FFFF', null, { e: r.livre ? 0.5 : 2.2, ts: 24, rs: 4, rz: PI / 2 }); });
  });
}
/* ---------- Torre de Éter: obelisco de quatro faces com o cristal flutuando e anéis de energia ---------- */
function torre(K, P, tc) {
  K.base = 0; const r = runa(tc); base(K, 5.4, 1.4, 0.7);
  K.prism(0, 1.4, 0, 2.2, 11.5, 4, PED, 'stone', { top: 0.45, ry: PI / 4 });
  for (let i = 0; i < 4; i++) { const a = i * PI / 2; K.box(Math.cos(a) * 1.55, 2.4, Math.sin(a) * 1.55, 0.36, 8.5, 0.36, r.c, null, { e: r.e }); }
  for (const s of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) K.prism(s[0] * 3.6, 1.4, s[1] * 3.6, 0.7, 2.6, 4, PED2, 'stone', { top: 0.5, ry: PI / 4 });
  K.anim({ t: 'bob', amp: 0.5, speed: 0.9 }, () => { K.oct(0, 14.4, 0, 1.4, 3.6, r.c, null, { e: r.e * 1.3 }); });
  K.anim({ t: 'spin', p: [0, 15.4, 0], speed: r.livre ? 0.3 : 1.4 }, () => { K.tor(0, 15.4, 0, 2.4, 0.14, r.c, null, { e: r.e, ts: 28, rs: 4, rx: 0.3 }); K.fine(() => K.tor(0, 15.4, 0, 3.1, 0.1, BRONZE, 'metal', { ts: 28, rs: 4, rx: -0.4, rz: 0.3 })); });
}
/* ---------- Acampamento da Irmandade Corsária: nave ancorada sobre a Fenda ---------- */
const MAD = '#6B4A2E', MAD2 = '#4A3220', LONA = '#C9B48A', LONA2 = '#8C2F2A', AMB = '#FFC24A';
function acampamento(K, P, tc) {
  K.base = 0; const y0 = 14; /* flutua: a nave fica bem acima do chão da cratera */
  for (let i = 0; i < 4; i++) { const a = i * PI / 2 + PI / 4; K.seg([Math.cos(a) * 9, 0, Math.sin(a) * 6], [Math.cos(a) * 4.5, y0 + 1, Math.sin(a) * 2.2], 0.12, MET, 'metal', { seg: 4 }); K.cyl(Math.cos(a) * 9, 0, Math.sin(a) * 6, 0.6, 0.8, 1.6, MET2, 'metal', { seg: 6 }); } /* correntes até as estacas */
  K.anim({ t: 'bob', amp: 0.8, speed: 0.5 }, () => {
    K.lathe([[0, 0], [1.6, 0.4], [2.6, 1.6], [2.9, 3.0], [2.7, 3.4], [0, 3.4]], 0, y0, 0, MAD, 'paint', { seg: 14, sx: 3.4, sz: 1 }); /* casco */
    K.box(0, y0 + 3.3, 0, 16.4, 0.3, 5.2, MAD2, 'paint');
    K.box(6.8, y0 + 3.6, 0, 3.2, 2.2, 4.0, MAD, 'paint', { b: 0.15 }); K.box(-6.8, y0 + 3.6, 0, 2.4, 1.6, 3.2, MAD, 'paint', { b: 0.15 }); /* castelos de proa e de popa */
    K.sph(0, y0 + 11.5, 0, 1, LONA, 'matte', { sx: 9.0, sy: 3.6, sz: 4.0, seg: 18 }); /* balão */
    K.tor(0, y0 + 11.5, 0, 1, 0.08, MAD2, 'paint', { ts: 28, rs: 4, sx: 9.05, sz: 4.05 }); K.tor(0, y0 + 9.2, 0, 1, 0.07, MAD2, 'paint', { ts: 28, rs: 4, sx: 7.4, sz: 3.3 }); /* cintas do balão */
    for (const s of [-1, 1]) for (const x of [-4, 4]) K.seg([x, y0 + 3.6, s * 2.4], [x * 1.1, y0 + 8.6, s * 3.2], 0.08, MAD2, 'paint', { seg: 4 });
    K.anim({ t: 'sway', p: [0, y0 + 3.6, 0], amp: 0.06, speed: 1.3 }, () => { K.box(0, y0 + 3.6, 0, 0.2, 4.2, 6.8, LONA2, 'matte'); K.box(0, y0 + 5.4, 0, 0.26, 1.4, 1.2, '#F2E6C8', 'matte'); }); /* vela vermelha com a marca */
    for (const x of [-7.4, -3, 1.5, 6.4]) K.sph(x, y0 + 2.6, 2.95, 0.35, AMB, null, { e: 2.6, seg: 8 });
    for (const x of [-7.4, -3, 1.5, 6.4]) K.sph(x, y0 + 2.6, -2.95, 0.35, AMB, null, { e: 2.6, seg: 8 });
    K.fine(() => { for (const s of [-1, 1]) K.anim({ t: 'spin', p: [-9.4, y0 + 2.0, s * 1.4], axis: 'x', speed: 3 }, () => { for (let i = 0; i < 4; i++) K.box(-9.5, y0 + 2.0 - 0.15, s * 1.4, 0.12, 0.3, 2.6, MET2, 'metal', { rx: i * PI / 4 }); }); }); /* hélices */
  });
}

/* ---------- fauna ---------- */
const PELE = '#7C8A6A', PELE2 = '#55604A', OSSO = '#E3DCC6', CRI = '#7FE8FF';
function pastador(K) { /* herbívoro de quatro patas: corpo baixo, pescoço longo para pastar, placas de cristal no dorso */
  K.base = 0;
  K.sph(0, 3.2, 0, 1, PELE, 'skin', { sx: 3.0, sy: 1.6, sz: 1.5, seg: 14 });
  K.sph(-0.3, 2.7, 0, 1, '#C9C0A2', 'skin', { sx: 2.4, sy: 0.9, sz: 1.2, seg: 10 }); /* barriga clara */
  K.anim({ t: 'sway', p: [2.4, 3.6, 0], amp: 0.1, speed: 0.7 }, () => { K.seg([2.4, 3.6, 0], [4.0, 5.2, 0], 0.55, PELE, 'skin', { seg: 8, taper: 0.7 }); K.sph(4.5, 5.2, 0, 1, PELE2, 'skin', { sx: 1.1, sy: 0.7, sz: 0.65, seg: 10 }); K.sph(5.3, 5.0, 0, 0.4, '#3A3A30', 'wet', { seg: 6 });
    for (const s of [-1, 1]) { K.sph(4.7, 5.5, s * 0.45, 0.14, '#111', 'gloss', { seg: 6 }); K.seg([4.2, 5.7, s * 0.3], [3.7, 6.5, s * 0.6], 0.1, OSSO, 'bone', { seg: 4, taper: 0.3 }); } });
  for (let i = 0; i < K.q(4); i++) K.xtal(-1.8 + i * 1.1, 4.4, 0, 0.35, 1.0 + (i % 2) * 0.5, CRI, null, { n: 4, glow: 0.6, seed: i + 3, e: 1.0 });
  for (const [x, z, ph] of [[1.6, 0.8, 0], [1.6, -0.8, PI], [-1.8, 0.8, PI], [-1.8, -0.8, 0]]) K.anim({ t: 'leg', p: [x, 2.6, z], amp: 0.4, stride: 6, ph }, () => { K.seg([x, 2.6, z], [x + 0.2, 1.2, z], 0.36, PELE2, 'skin', { seg: 6 }); K.seg([x + 0.2, 1.2, z], [x, 0.05, z], 0.26, PELE2, 'skin', { seg: 6 }); K.box(x, 0, z, 0.6, 0.25, 0.6, '#2E2A24', 'bone'); });
  K.anim({ t: 'sway', p: [-2.9, 3.4, 0], amp: 0.25, speed: 2.2 }, () => K.seg([-2.9, 3.4, 0], [-4.0, 2.6, 0], 0.18, PELE2, 'skin', { seg: 5, taper: 0.3 }));
}
function guardiao(K) { /* fera blindada: corpo maciço de couro escuro com placas de cristal, chifres para a frente, garras e olhos acesos */
  K.base = 0; const CR = '#5CF0E0', COU = '#7A6E62', COU2 = '#544A42';
  K.sph(0, 4.6, 0, 1, COU, 'skin', { sx: 4.2, sy: 2.5, sz: 2.6, seg: 16 });
  K.sph(3.3, 4.4, 0, 1, COU2, 'skin', { sx: 1.9, sy: 1.6, sz: 1.6, seg: 12 }); /* cabeça baixa */
  for (const s of [-1, 1]) { K.seg([3.9, 5.4, s * 0.9], [5.6, 6.4, s * 1.6], 0.42, OSSO, 'bone', { seg: 6, taper: 0.25 }); K.seg([5.6, 6.4, s * 1.6], [6.5, 5.6, s * 1.4], 0.22, OSSO, 'bone', { seg: 5, taper: 0.1 }); K.sph(4.6, 4.9, s * 0.95, 0.24, '#FFE27A', null, { e: 2.6, seg: 8 }); }
  for (let i = 0; i < K.q(7); i++) { const x = -2.6 + i * 0.85, sd = (i % 2 ? 1 : -1) * 0.5; K.xtal(x, 6.0 + Math.sin(i) * 0.3, sd, 0.6, 2.0 + (i % 3) * 0.7, CR, 'crystal', { n: 5, glow: 0.5, seed: i * 7 + 1, rx: sd * 0.5 }); }
  for (const s of [-1, 1]) K.prism(-0.4, 3.4, s * 2.3, 1.6, 2.6, 6, '#4E5A66', 'crystal', { top: 0.7, rz: PI / 2, rx: s * 0.2 }); /* placas laterais */
  for (const [x, z, ph] of [[2.2, 1.6, 0], [2.2, -1.6, PI], [-2.4, 1.6, PI], [-2.4, -1.6, 0]]) K.anim({ t: 'leg', p: [x, 3.8, z], amp: 0.28, stride: 8, ph }, () => { K.seg([x, 3.8, z], [x + 0.4, 1.6, z * 1.1], 0.75, COU2, 'skin', { seg: 8 }); K.seg([x + 0.4, 1.6, z * 1.1], [x, 0.1, z * 1.1], 0.6, COU2, 'skin', { seg: 8 }); for (const k of [-1, 0, 1]) K.seg([x + 0.3, 0.3, z * 1.1 + k * 0.35], [x + 0.95, 0.0, z * 1.1 + k * 0.45], 0.12, OSSO, 'bone', { seg: 4, taper: 0.2 }); });
  K.anim({ t: 'sway', p: [-4.0, 4.8, 0], amp: 0.18, speed: 1.4 }, () => { K.seg([-4.0, 4.8, 0], [-6.2, 3.4, 0], 0.45, COU, 'skin', { seg: 6, taper: 0.4 }); K.xtal(-6.3, 3.3, 0, 0.35, 1.2, CR, null, { n: 4, glow: 0.8, seed: 9, rz: 1.2, e: 1.4 }); });
}
function enxame(K) { /* três mariposas de éter batendo as asas, com o corpo aceso */
  K.base = 0; const AS = '#9A7CFF', AS2 = '#3B2A6A', LUZ = '#E6DBFF';
  const um = (x, y, z, k, ph) => K.anim({ t: 'bob', amp: 0.6 * k, speed: 3 + ph, ph }, () => {
    K.cap(x, y, z, 0.32 * k, 1.1 * k, LUZ, null, { e: 2.4, seg: 8, rz: PI / 2 });
    for (const s of [-1, 1]) K.anim({ t: 'flap', p: [x, y, z + s * 0.25 * k], amp: 0.7, speed: 26, ph, side: -s }, () => {
      K.box(x, y - 0.05, z + s * 1.15 * k, 1.8 * k, 0.08, 1.9 * k, AS, 'matte', { e: 0.6 });
      K.box(x - 0.1 * k, y + 0.02, z + s * 1.75 * k, 0.9 * k, 0.06, 0.6 * k, AS2, 'matte'); });
  });
  um(0, 2.0, 0, 1.2, 0); um(-1.6, 3.2, 1.4, 0.9, 1.3); um(1.3, 3.8, -1.3, 0.8, 2.1);
}

const RX = ARD.meshes && ARD.meshes.receitas ? ARD.meshes.receitas : {};
Object.assign(RX, { ruina_observatorio: observatorio, ruina_forja: forja, ruina_portal: portal, ruina_torre: torre, acampamento,
  fauna_pastador: pastador, fauna_guardiao: guardiao, fauna_enxame: enxame });
if (ARD.meshes) ARD.meshes.receitas = RX;
ARD.mundoModelos = ['ruina_observatorio', 'ruina_forja', 'ruina_portal', 'ruina_torre', 'acampamento', 'fauna_pastador', 'fauna_guardiao', 'fauna_enxame'];
})(globalThis.ARD = globalThis.ARD || {});
