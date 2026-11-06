/* Aether Rift: Dominion — 5.0h (agente h-unicas): os modelos das construções únicas (duas por Raça) e dos avatares dos comandantes, no mesmo
   construtor (Kit) e no mesmo formato das malhas de hoje (src/meshes.js): cor, rugosidade e metal por vértice, partes emissivas separadas,
   peças que se soltam na destruição e animação por peça na GPU (spin, bob, sway). Entram pelo gancho ARD.meshes.receitas (o mesmo dos chefões),
   então valem nos dois motores com o material e as instâncias de sempre: nenhum material nem pipeline novo. O 2D ganha modelos voxel em
   ARD.models.BY_DEF. Na carga entram só as únicas da Raça de cada jogador (e o avatar, com os comandantes ligados): ARD.unicasModelos.jobs.
   Vocabulário por Raça (o da 4.3f e da 5.0e): Vehnar aço, laje escura, faixa de perigo e chaminé; Erevane vidro escuro anguloso com fio
   teal e magenta; Tessara osso, bulbo e brilho verde; Quorith cristal violeta facetado; Vorag carne, osso e brilho vermelho.
   Avatares: silhueta própria, maior e mais alta que as unidades, um farol aceso no alto e o anel da Raça no chão (legível de longe). */
(function (ARD) {
'use strict';
const PI = Math.PI, H = PI / 2;
const RACA_COR = { vehnar: '#FF7A2E', erevane: '#3FE6CF', tessara: '#7FE3A1', quorith: '#B388FF', vorag: '#FF5A5A' };
function anelRaca(K, raca, R) { /* anel da Raça no chão: aro aceso na cor da Raça, com quatro marcas */
  const c = RACA_COR[raca] || '#FFFFFF'; K.tor(0, 0.12, 0, R, 0.16, c, null, { e: 2.2, ts: 40, rs: 5 }); K.tor(0, 0.1, 0, R + 0.5, 0.06, c, null, { e: 1.2, ts: 40, rs: 4 });
  for (let i = 0; i < 4; i++) { const a = i * H + PI / 4; K.box(Math.cos(a) * R, 0.05, Math.sin(a) * R, 0.9, 0.18, 0.3, c, null, { e: 2.4, ry: -a }); } }
function farol(K, y, c, s) { K.anim({ t: 'bob', amp: 0.25, speed: 1.6 }, () => { K.oct(0, y, 0, 0.45 * (s || 1), 1.2 * (s || 1), c, null, { e: 2.8 }); }); }

const RX = ARD.meshes && ARD.meshes.receitas ? ARD.meshes.receitas : {};

/* ---------- Vehnar ---------- */
RX.esteira = (K, P, tc) => { /* Esteira de Montagem: duas plataformas de carga ligadas por uma esteira rolante coberta, com braços robóticos e pórtico */
  K.box(0, 0, 0, 15, 0.7, 7, P.d, 'dark', { b: 0.15 }); for (let i = -6; i <= 6; i += 2) K.box(i, 0.7, 3.2, 1, 0.05, 0.4, i % 4 ? '#E8B23A' : '#1A1A1A', 'paint');
  for (const sx of [-1, 1]) { K.box(sx * 5.4, 0.7, 0, 3.6, 2.6, 5.4, P.a, 'steel', { b: 0.2 }); K.box(sx * 5.4, 3.3, 0, 3.8, 0.4, 5.6, tc, 'paint', { b: 0.08 }); K.light(sx * 5.4 + sx * 1.85, 2.0, 0, 0.35, '#FFC872', 2.2); }
  K.box(0, 1.2, 0, 7.4, 0.5, 2.2, '#2B2E35', 'rubber'); K.anim({ t: 'tread', spacing: 0.9 }, () => { for (let i = -3; i <= 3; i++) K.box(i * 1.05, 1.7, 0, 0.5, 0.12, 2.0, '#4A4F57', 'metal'); });
  for (const z of [-1.4, 1.4]) K.box(0, 0.7, z, 7.4, 1.2, 0.25, P.b, 'steel');
  K.box(0, 1.85, -1.0, 0.9, 0.5, 0.6, '#B8862B', 'paint'); K.box(-1.8, 1.85, 0.6, 0.9, 0.5, 0.6, '#8A5A3A', 'paint');
  K.piece([0, 4.5, 0], () => { for (const sx of [-2.6, 2.6]) for (const sz of [-1.5, 1.5]) K.seg([sx, 0.7, sz], [sx, 4.4, sz], 0.18, P.b, 'metal'); K.box(0, 4.3, 0, 6.0, 0.4, 3.4, P.a, 'steel'); K.box(0, 4.7, 0, 5.6, 0.18, 0.6, tc, 'paint'); });
  for (const sx of [-1, 1]) K.piece([sx * 1.8, 3, 1.6], () => K.anim({ t: 'spin', p: [sx * 1.8, 0, 1.6], speed: 0.9 * sx }, () => { K.cyl(sx * 1.8, 0.7, 1.6, 0.4, 0.5, 2.1, P.b, 'steel'); K.seg([sx * 1.8, 2.8, 1.6], [sx * 1.8 + 1.2, 3.4, 0.6], 0.16, '#E8B23A', 'paint'); K.light(sx * 1.8 + 1.2, 3.3, 0.6, 0.22, '#FF7A2E', 2.6); }));
  K.cyl(5.4, 3.7, -1.6, 0.4, 0.5, 2.6, '#59606B', 'steel'); K.cyl(5.4, 6.0, -1.6, 0.46, 0.46, 0.3, tc, 'paint'); K.light(5.4, 6.4, -1.6, 0.25, '#FF5A1A', 2.0);
};
RX.silo = (K, P, tc) => { /* Silo de Sucata: silo cilíndrico de chapas rebitadas, funil de entrada com garra magnética que gira e pilha de sucata em brasa */
  K.prism(0, 0, 0, 5.2, 0.7, 8, P.d, 'dark', { ry: PI / 8 });
  K.cyl(0, 0.7, 0, 3.0, 3.2, 6.8, P.a, 'steel', { seg: 16 }); for (const y of [2.0, 4.2, 6.2]) K.cyl(0, 0.7 + y - 0.2, 0, 3.26, 3.26, 0.35, P.b, 'metal', { seg: 16 });
  K.cyl(0, 7.5, 0, 3.0, 3.0, 0.5, tc, 'paint', { seg: 16 }); K.cone(0, 8.0, 0, 3.0, 1.8, '#59606B', 'steel', { seg: 16 });
  K.box(2.6, 0.7, 0, 1.4, 2.4, 2.2, '#2B2E35', 'dark'); K.light(3.35, 1.5, 0, 0.5, '#FF5A1A', 2.4);
  K.piece([0, 10, 0], () => K.anim({ t: 'spin', p: [0, 0, 0], speed: 0.4 }, () => { K.seg([0, 9.2, 0], [0, 10.6, 0], 0.3, P.b, 'metal'); K.seg([0, 10.4, 0], [4.2, 10.0, 0], 0.26, '#E8B23A', 'paint'); K.seg([4.2, 10.0, 0], [4.2, 8.4, 0], 0.08, '#2B2E35', 'metal'); K.cyl(4.2, 7.9, 0, 0.8, 0.8, 0.5, '#4A4F57', 'steel'); K.light(4.2, 7.8, 0, 0.3, '#FFD27A', 2.2); }));
  for (let i = 0; i < 6; i++) { const a = -PI * 0.75 + i * 0.32; K.box(Math.cos(a) * 4.3, 0.7, Math.sin(a) * 4.3, 1.0 + (i % 3) * 0.4, 0.5 + (i % 2) * 0.5, 0.8, ['#8A5A3A', '#59606B', '#3A2F2A'][i % 3], 'rust', { ry: a * 1.7, rz: 0.2 * (i % 2 ? 1 : -1) }); }
  K.light(-3.3, 1.2, -3.0, 0.35, '#FF5A1A', 1.8);
};
/* ---------- Erevane ---------- */
RX.espelho = (K, P, tc) => { /* Espelho do Véu: lâmina-espelho alta e fina sobre pedestal anguloso, com dois espelhos menores girando e o fio teal */
  K.prism(0, 0, 0, 4.4, 0.6, 6, P.b, 'gloss', { ry: PI / 6 }); K.prism(0, 0.6, 0, 3.0, 1.4, 6, P.a, 'gloss', { top: 0.7, ry: PI / 6 });
  K.box(0, 2.0, 0, 0.6, 9.5, 2.6, '#9FC7D6', 'ice', { rz: 0.05 }); K.box(0.32, 2.4, 0, 0.06, 8.6, 2.2, P.c, null, { e: 1.6 }); K.box(-0.32, 2.4, 0, 0.06, 8.6, 2.2, '#E05CFF', null, { e: 1.2 });
  K.cone(0, 11.5, 0, 0.9, 2.0, P.a, 'gloss', { seg: 4 }); K.box(0, 10.4, 0, 0.9, 0.3, 3.0, tc, 'paint');
  K.piece([0, 6, 0], () => K.anim({ t: 'spin', p: [0, 0, 0], speed: 0.5 }, () => { for (const s of [-1, 1]) { K.box(s * 3.1, 4.5, 0, 0.25, 3.6, 1.4, '#BFDDE6', 'ice', { ry: s * 0.4 }); K.box(s * 3.25, 4.8, 0, 0.05, 3.0, 1.1, P.c, null, { e: 1.8, ry: s * 0.4 }); } }));
  for (let i = 0; i < 3; i++) { const a = i / 3 * PI * 2; K.light(Math.cos(a) * 3.4, 0.7, Math.sin(a) * 3.4, 0.3, P.c, 2.4); }
};
RX.farol = (K, P, tc) => { /* Farol Falso: torre-isca esguia de vidro escuro com uma lanterna magenta enorme que pulsa no alto (chama a atenção) */
  K.prism(0, 0, 0, 3.6, 0.6, 5, P.d, 'dark'); K.prism(0, 0.6, 0, 1.9, 8.0, 5, P.a, 'gloss', { top: 0.55 });
  K.box(0, 2, 1.1, 0.12, 6.4, 0.12, P.c, null, { e: 1.8 }); K.box(0, 2, -1.1, 0.12, 6.4, 0.12, P.c, null, { e: 1.8 });
  K.cyl(0, 8.6, 0, 1.6, 1.2, 0.5, tc, 'paint', { seg: 10 });
  K.piece([0, 10, 0], () => { K.anim({ t: 'bob', amp: 0.18, speed: 2.4 }, () => { K.oct(0, 9.1, 0, 1.4, 3.2, '#E05CFF', null, { e: 3.2 }); });
    K.anim({ t: 'spin', p: [0, 0, 0], speed: 1.4 }, () => { K.tor(0, 10.6, 0, 2.4, 0.12, '#C9B458', 'metal', { ts: 28, rs: 4 }); K.box(2.4, 10.4, 0, 0.5, 0.5, 0.5, P.c, null, { e: 2.6 }); }); });
  for (let i = 0; i < 5; i++) { const a = i / 5 * PI * 2; K.cone(Math.cos(a) * 2.9, 0.4, Math.sin(a) * 2.9, 0.5, 2.0, '#9FC7D6', 'ice', { seg: 4 }); }
};
/* ---------- Tessara ---------- */
function arvore(K, P, tc, era) { /* Árvore-Mãe: tronco trançado de osso e casca, copa de bulbos que acende e cresce com as Eras (variantes arvore, arvore_2 e arvore_3) */
  const k = 0.8 + 0.2 * era; K.cyl(0, 0, 0, 5.0, 5.4, 0.6, P.d, 'bone', { seg: 14 });
  for (let i = 0; i < 6; i++) { const a = i / 6 * PI * 2; K.trunk([[Math.cos(a) * 4.4, 0.3, Math.sin(a) * 4.4, 0.7], [Math.cos(a) * 2.2, 1.6, Math.sin(a) * 2.2, 0.55], [Math.cos(a) * 0.9, 3.4, Math.sin(a) * 0.9, 0.4]], P.t, 'bone', { n: 6 }); }
  K.trunk([[0, 0.4, 0, 1.6], [0.3, 3.5 * k, 0.2, 1.2], [-0.2, 6.5 * k, 0, 0.9], [0, 8.6 * k, 0.1, 0.5]], P.a, 'bone', { n: 8, bark: true });
  K.wind(1, () => { const n = 3 + era * 2; for (let i = 0; i < n; i++) { const a = i / n * PI * 2 + era; const r = (1.8 + era * 0.6), y = 7.2 * k + (i % 2) * 0.9;
    K.bulb([[0, 0], [1.1 + era * 0.15, 0.6], [1.0 + era * 0.15, 1.6], [0.4, 2.3], [0, 2.5]], Math.cos(a) * r, y, Math.sin(a) * r, i % 2 ? P.b : P.a, 'skin', { n: 8, ribs: 6, rk: 0.1 });
    K.sph(Math.cos(a) * r, y + 2.0, Math.sin(a) * r, 0.35 + 0.06 * era, P.l, null, { e: 2.2, seg: 8 }); } });
  K.anim({ t: 'bob', amp: 0.2, speed: 1.0 }, () => { K.sph(0, 9.4 * k + era * 0.6, 0, 0.9 + era * 0.25, P.l, null, { e: 2.6, seg: 12 }); });
  for (let i = 0; i < 4; i++) { const a = i * H + PI / 4; K.bulb([[0, 0], [0.6, 0.4], [0.5, 1.1], [0, 1.4]], Math.cos(a) * 4.0, 0.6, Math.sin(a) * 4.0, tc, 'skin', { n: 6, ribs: 4 }); }
}
RX.arvore = (K, P, tc) => arvore(K, P, tc, 1); RX.arvore_2 = (K, P, tc) => arvore(K, P, tc, 2); RX.arvore_3 = (K, P, tc) => arvore(K, P, tc, 3);
RX.viveiro = (K, P, tc) => { /* Viveiro: estufa-casulo em gomos de osso com membrana translúcida, ninhos acesos de esporos e um esporo que paira em cima */
  K.cyl(0, 0, 0, 5.4, 5.8, 0.6, P.d, 'bone', { seg: 14 });
  K.bulb([[0, 0], [4.4, 0.4], [4.6, 2.2], [3.8, 4.4], [2.2, 5.8], [0, 6.3]], 0, 0.6, 0, P.g, 'wet', { n: 12, ribs: 8, rk: 0.12 });
  for (let i = 0; i < 8; i++) { const a = i / 8 * PI * 2; K.trunk([[Math.cos(a) * 4.5, 0.5, Math.sin(a) * 4.5, 0.32], [Math.cos(a) * 4.5, 2.7, Math.sin(a) * 4.5, 0.3], [Math.cos(a) * 3.0, 5.4, Math.sin(a) * 3.0, 0.22], [0, 6.9, 0, 0.12]], P.a, 'bone', { n: 5 }); }
  for (let i = 0; i < 5; i++) { const a = i / 5 * PI * 2 + 0.3; K.sph(Math.cos(a) * 2.3, 1.2, Math.sin(a) * 2.3, 0.7, P.l, null, { e: 1.8, seg: 8 }); }
  K.piece([0, 9, 0], () => K.anim({ t: 'bob', amp: 0.5, speed: 1.4 }, () => { K.sph(0, 8.6, 0, 0.9, P.b, 'skin', { seg: 10 }); K.sph(0, 8.6, 0.8, 0.3, P.l, null, { e: 2.6, seg: 6 }); for (const s of [-1, 1]) K.box(s * 1.2, 8.7, 0, 1.4, 0.06, 0.8, P.g, 'wet', { rz: s * 0.3 }); }));
  K.box(4.7, 0.6, 0, 0.8, 1.6, 1.8, tc, 'paint');
};
/* ---------- Quorith ---------- */
RX.pilar = (K, P, tc) => { /* Pilar de Ressonância: obelisco de cristal violeta em três gomos que flutuam e giram em volta de um núcleo aceso, com anéis de onda */
  K.prism(0, 0, 0, 3.8, 0.8, 6, P.d, 'crystal', { top: 0.85 }); K.xtal(0, 0.8, 0, 1.0, 2.2, P.b, 'crystal', { n: 6 });
  K.anim({ t: 'bob', amp: 0.35, speed: 0.9 }, () => { K.oct(0, 3.4, 0, 1.3, 5.2, P.a, 'crystal'); K.oct(0, 4.6, 0, 0.6, 2.8, P.l, null, { e: 2.6 }); K.oct(0, 9.0, 0, 0.9, 3.0, P.b, 'crystal'); K.box(0, 8.6, 0, 2.4, 0.18, 0.18, tc, 'paint'); });
  K.piece([0, 6, 0], () => K.anim({ t: 'spin', p: [0, 0, 0], speed: 0.7 }, () => { for (let i = 0; i < 3; i++) { const a = i / 3 * PI * 2; K.oct(Math.cos(a) * 2.6, 3.2, Math.sin(a) * 2.6, 0.5, 2.4, P.c, null, { e: 1.6, rz: 0.2 }); } K.tor(0, 6.2, 0, 2.8, 0.08, P.l, null, { e: 2.0, ts: 36, rs: 4 }); }));
  K.tor(0, 0.85, 0, 3.4, 0.1, P.c, null, { e: 1.6, ts: 36, rs: 4 });
};
RX.eco = (K, P, tc) => { /* Câmara de Eco: concha de cristal em forma de sino aberto, com o diapasão aceso dentro e três lâminas de eco em volta (a "torre" do Coro) */
  K.prism(0, 0, 0, 4.4, 0.8, 8, P.d, 'crystal', { ry: PI / 8 });
  K.lathe([[3.4, 0], [3.6, 1.2], [3.0, 3.4], [2.0, 5.0], [0.6, 6.0], [0, 6.2]], 0, 0.8, 0, P.a, 'crystal', { seg: 10 });
  K.box(0, 1.2, 3.3, 2.2, 3.6, 0.3, P.d, 'crystal'); K.box(0, 1.6, 3.5, 1.4, 2.6, 0.1, P.c, null, { e: 2.2 });
  K.piece([0, 7.5, 0], () => { K.seg([-0.5, 6.6, 0], [-0.5, 9.4, 0], 0.22, P.b, 'crystal'); K.seg([0.5, 6.6, 0], [0.5, 9.4, 0], 0.22, P.b, 'crystal'); K.anim({ t: 'bob', amp: 0.2, speed: 3.0 }, () => { K.oct(0, 8.6, 0, 0.4, 1.4, P.l, null, { e: 3.0 }); }); });
  K.anim({ t: 'spin', p: [0, 0, 0], speed: 0.45 }, () => { for (let i = 0; i < 3; i++) { const a = i / 3 * PI * 2 + 0.5; K.xtal(Math.cos(a) * 4.4, 0.6, Math.sin(a) * 4.4, 0.6, 3.6, P.b, 'crystal', { n: 5 }); K.light(Math.cos(a) * 4.4, 3.8, Math.sin(a) * 4.4, 0.3, P.c, 2.2); } });
  K.tor(0, 6.9, 0, 0.9, 0.12, tc, 'paint', { ts: 18, rs: 4 });
};
/* ---------- Vorag ---------- */
RX.incubadora = (K, P, tc) => { /* Câmara de Incubação: ventre de carne com ovos translúcidos que pulsam, costelas de osso por cima e o bico de saída */
  K.sph(0, 0, 0, 6.0, P.d, 'wet', { half: true, sy: 0.25, seg: 16 });
  K.sph(0, 0.6, 0, 4.6, P.a, 'chitin', { sy: 0.62, seg: 16 }); K.sph(0, 2.0, 0, 3.2, P.b, 'wet', { sy: 0.7, seg: 14 });
  for (let i = 0; i < 6; i++) { const a = i / 6 * PI * 2; K.trunk([[Math.cos(a) * 4.8, 0.2, Math.sin(a) * 4.8, 0.4], [Math.cos(a) * 3.6, 3.6, Math.sin(a) * 3.6, 0.3], [Math.cos(a) * 1.4, 5.4, Math.sin(a) * 1.4, 0.18], [0, 5.8, 0, 0.05]], P.bo, 'bone', { n: 5 }); }
  K.anim({ t: 'bob', amp: 0.15, speed: 2.2 }, () => { for (let i = 0; i < 5; i++) { const a = i / 5 * PI * 2 + 0.6; K.sph(Math.cos(a) * 3.4, 1.4, Math.sin(a) * 3.4, 1.0, '#E8C6B0', 'wet', { sy: 1.3, seg: 10 }); K.sph(Math.cos(a) * 3.4, 1.6, Math.sin(a) * 3.4, 0.45, P.l, null, { e: 2.0, seg: 6 }); } });
  K.cyl(4.4, 0.6, 0, 1.4, 1.8, 1.6, P.b, 'wet', { rz: -1.1 }); K.light(5.4, 1.4, 0, 0.5, P.l, 2.4);
  K.piece([0, 6, 0], () => { K.sph(0, 4.9, 0, 0.9, tc, 'skin', { seg: 10 }); });
};
RX.tumor = (K, P, tc) => { /* Tumor de Território: massa de carne que se espalha pelo chão com veias acesas, bolhas e espinhos de osso */
  K.sph(0, 0, 0, 5.8, P.d, 'wet', { half: true, sy: 0.18, seg: 16 });
  for (let i = 0; i < 7; i++) { const a = i / 7 * PI * 2; K.trunk([[0, 0.4, 0, 0.5], [Math.cos(a) * 3.0, 0.5, Math.sin(a) * 3.0, 0.35], [Math.cos(a) * 5.6, 0.3, Math.sin(a) * 5.6, 0.12]], P.m, null, { n: 4, e: 1.5 }); }
  K.anim({ t: 'bob', amp: 0.25, speed: 1.1 }, () => { K.sph(0, 0.4, 0, 3.0, P.a, 'wet', { sy: 0.7, seg: 14 }); K.sph(1.2, 1.6, 0.8, 1.4, P.b, 'wet', { seg: 10 }); K.sph(-1.0, 1.4, -1.0, 1.1, P.b, 'wet', { seg: 10 }); K.sph(0.2, 2.6, 0, 0.6, P.l, null, { e: 2.4, seg: 8 }); });
  for (let i = 0; i < 5; i++) { const a = i / 5 * PI * 2 + 0.3; K.spike([Math.cos(a) * 2.6, 0.6, Math.sin(a) * 2.6], [Math.cos(a) * 3.6, 3.4, Math.sin(a) * 3.6], 0.35, P.bo, 'bone'); }
  K.piece([0, 3, 0], () => K.anim({ t: 'sway', amp: 0.18, speed: 1.4 }, () => { K.trunk([[0, 2.0, 0, 0.4], [0.3, 4.2, 0.1, 0.25], [0, 5.6, 0, 0.08]], P.b, 'wet', { n: 5 }); K.sph(0, 5.6, 0, 0.42, tc, 'skin', { seg: 8 }); }));
};

/* ---------- avatares dos comandantes ---------- */
RX.exoforja = (K, P, tc) => { /* Exo-Forja (Barão-Forja): exoesqueleto bípede de fundição, ombreiras largas, fornalha no peito, martelo sísmico enorme e chaminé dupla */
  anelRaca(K, 'vehnar', 4.0);
  for (const s of [-1, 1]) K.anim({ t: 'leg', p: [0, 3.4, s * 1.3], amp: 0.3, stride: 6, ph: s > 0 ? 0 : PI }, () => { K.seg([0, 3.4, s * 1.3], [0.4, 1.6, s * 1.5], 0.55, P.b, 'steel'); K.seg([0.4, 1.6, s * 1.5], [0, 0.3, s * 1.5], 0.5, P.a, 'steel'); K.box(0.2, 0, s * 1.5, 1.8, 0.4, 1.0, P.d, 'dark'); });
  K.box(0, 3.2, 0, 2.6, 3.4, 3.2, P.a, 'steel', { b: 0.25 }); K.box(0.9, 3.8, 0, 1.0, 1.4, 1.8, '#2B2E35', 'dark'); K.light(1.45, 4.3, 0, 0.6, '#FF5A1A', 2.8);
  for (const s of [-1, 1]) { K.box(0, 6.2, s * 2.1, 2.4, 1.0, 1.6, tc, 'paint', { b: 0.15 }); K.box(0, 6.0, s * 2.1, 2.0, 0.3, 1.8, '#E8B23A', 'paint'); }
  K.box(-0.2, 6.6, 0, 1.6, 1.0, 1.4, P.b, 'steel'); K.light(0.62, 7.0, 0, 0.35, '#FFD27A', 2.6);
  for (const s of [-0.5, 0.5]) { K.cyl(-1.2, 6.6, s, 0.3, 0.36, 2.4, '#59606B', 'steel'); K.light(-1.2, 9.1, s, 0.22, '#FF7A2E', 2.0); }
  K.anim({ t: 'recoil', dist: 0.8 }, () => { K.seg([0.2, 5.6, 2.6], [2.6, 3.2, 2.9], 0.3, P.b, 'metal'); K.box(2.6, 2.0, 2.9, 1.6, 2.2, 1.6, '#4A4F57', 'steel', { b: 0.2 }); K.box(2.6, 2.6, 2.9, 1.7, 0.4, 1.7, tc, 'paint'); });
  K.seg([0.2, 5.6, -2.6], [1.8, 3.6, -2.8], 0.28, P.b, 'metal'); K.light(1.9, 3.4, -2.8, 0.4, '#FFC872', 2.2);
  farol(K, 10.4, RACA_COR.vehnar);
};
RX.espectro = (K, P, tc) => { /* Espectro (Vesper Ísk): figura alta e esguia de manto anguloso que flutua, lâmina de luz longa na mão e véu de fio teal */
  anelRaca(K, 'erevane', 3.4);
  K.anim({ t: 'bob', amp: 0.3, speed: 1.2 }, () => {
    K.cone(0, 1.2, 0, 1.8, 5.2, P.a, 'gloss', { seg: 5 }); K.cone(0, 1.0, 0, 1.4, 1.6, P.c, null, { e: 1.4, seg: 5, rx: PI, y: 2.6 });
    K.prism(0, 5.6, 0, 0.9, 1.6, 5, P.b, 'gloss', { top: 0.6 }); K.oct(0, 7.0, 0, 0.6, 1.6, P.d, 'gloss'); K.box(0.42, 7.6, 0, 0.2, 0.18, 0.7, '#E05CFF', null, { e: 3.0 });
    for (const s of [-1, 1]) K.box(0, 5.8, s * 1.1, 1.6, 0.18, 1.4, tc, 'paint', { rx: s * 0.4 });
    K.seg([0.3, 5.0, 1.0], [3.6, 7.2, 1.4], 0.12, P.c, null, { e: 3.0 }); K.seg([0.3, 5.0, 1.0], [0.9, 5.2, 1.1], 0.2, '#C9B458', 'metal');
    K.wind(1, () => { for (const s of [-1, 1]) K.box(-0.9, 3.0, s * 0.8, 0.06, 4.4, 1.2, P.c, null, { e: 1.0, ry: s * 0.4 }); }); });
  farol(K, 9.6, RACA_COR.erevane);
};
RX.espectro_eco = RX.espectro;
RX.guardia = (K, P, tc) => { /* Guardiã (Sylvia Oriel): guardiã alta de osso e casca com coroa de galhos em flor, cajado de bulbo aceso e capa de folhas */
  anelRaca(K, 'tessara', 3.4);
  for (const s of [-1, 1]) K.anim({ t: 'leg', p: [0, 2.6, s * 0.7], amp: 0.28, stride: 5, ph: s > 0 ? 0 : PI }, () => { K.trunk([[0, 2.6, s * 0.7, 0.45], [0.2, 1.2, s * 0.8, 0.35], [0, 0, s * 0.8, 0.3]], P.a, 'bone', { n: 6 }); });
  K.bulb([[0.9, 0], [1.4, 1.2], [1.2, 2.6], [0.8, 3.6], [0, 4.0]], 0, 2.4, 0, P.a, 'bone', { n: 8, ribs: 6, rk: 0.08 }); K.sph(0.6, 4.2, 0, 0.45, P.l, null, { e: 2.2, seg: 8 });
  K.wind(0.6, () => { K.bulb([[1.6, 0], [1.4, 1.6], [0.6, 3.2], [0, 3.6]], -0.6, 1.6, 0, tc, 'skin', { n: 8, ribs: 5 }); });
  K.sph(0, 6.8, 0, 0.8, P.b, 'bone', { seg: 10 });
  K.wind(1, () => { for (let i = 0; i < 5; i++) { const a = i / 5 * PI * 2; K.trunk([[0, 7.3, 0, 0.18], [Math.cos(a) * 1.2, 8.6, Math.sin(a) * 1.2, 0.12], [Math.cos(a) * 1.6, 9.4, Math.sin(a) * 1.6, 0.05]], P.t, 'bone', { n: 4 }); K.sph(Math.cos(a) * 1.6, 9.4, Math.sin(a) * 1.6, 0.3, i % 2 ? P.l : P.am, null, { e: 2.0, seg: 6 }); } });
  K.seg([0.8, 0.2, 1.6], [0.8, 8.4, 1.6], 0.16, P.t, 'bone'); K.anim({ t: 'bob', amp: 0.15, speed: 2.0 }, () => { K.sph(0.8, 8.9, 1.6, 0.6, P.l, null, { e: 2.8, seg: 10 }); });
  farol(K, 11.0, RACA_COR.tessara, 0.9);
};
RX.prismavivo = (K, P, tc) => { /* Prisma Vivo (Zayin Coral): prisma triangular de cristal que flutua e gira devagar, com três lâminas de acorde em volta e o olho aceso no meio */
  anelRaca(K, 'quorith', 3.8);
  K.anim({ t: 'bob', amp: 0.4, speed: 1.0 }, () => {
    K.prism(0, 2.2, 0, 2.0, 6.4, 3, P.a, 'crystal', { top: 0.35 }); K.prism(0, 2.4, 0, 1.2, 5.6, 3, P.l, null, { e: 1.4, top: 0.3, ry: PI / 3 });
    K.oct(0, 4.4, 0, 0.7, 1.4, '#FFFFFF', null, { e: 3.0 }); K.tor(0, 4.9, 0, 1.6, 0.1, tc, 'paint', { ts: 24, rs: 4 }); });
  K.anim({ t: 'spin', p: [0, 0, 0], speed: 0.8 }, () => { for (let i = 0; i < 3; i++) { const a = i / 3 * PI * 2; K.xtal(Math.cos(a) * 3.2, 2.0, Math.sin(a) * 3.2, 0.5, 3.4, P.b, 'crystal', { n: 4 }); K.light(Math.cos(a) * 3.2, 5.5, Math.sin(a) * 3.2, 0.28, P.c, 2.4); } });
  farol(K, 10.2, RACA_COR.quorith);
};
RX.devorador = (K, P, tc) => { /* Devorador (Oru Voraz): fera quadrúpede de carapaça alta, bocarra de mandíbulas enormes, corcova de espinhos e cauda */
  anelRaca(K, 'vorag', 4.6);
  for (const [x, s] of [[1.8, 1], [1.8, -1], [-1.8, 1], [-1.8, -1]]) K.anim({ t: 'leg', p: [x, 3.0, s * 1.4], amp: 0.34, stride: 6, ph: (s > 0) === (x > 0) ? 0 : PI }, () => { K.seg([x, 3.0, s * 1.4], [x + 0.6, 1.4, s * 2.2], 0.45, P.b, 'chitin'); K.seg([x + 0.6, 1.4, s * 2.2], [x + 0.2, 0, s * 2.4], 0.35, P.bo, 'bone', { taper: 0.4 }); });
  K.sph(0, 3.4, 0, 2.6, P.a, 'chitin', { sx: 1.5, sy: 0.85, seg: 14 }); K.sph(-0.4, 4.6, 0, 1.9, P.b, 'chitin', { sx: 1.2, seg: 12 });
  for (let i = 0; i < 5; i++) K.spike([-2.0 + i * 0.9, 5.6, 0], [-2.4 + i * 0.9, 8.0 - Math.abs(i - 2) * 0.6, 0], 0.4, P.bo, 'bone');
  K.sph(3.6, 3.4, 0, 1.4, P.a, 'chitin', { seg: 12 }); K.anim({ t: 'recoil', dist: 0.5 }, () => { for (const s of [-1, 1]) K.spike([4.4, 3.2, s * 0.8], [6.2, 2.4, s * 0.3], 0.35, P.bo, 'bone'); });
  for (const s of [-1, 1]) K.sph(4.6, 3.9, s * 0.6, 0.28, P.l, null, { e: 2.8, seg: 6 }); K.box(4.2, 2.6, 0, 1.0, 0.3, 1.2, P.m, null, { e: 1.6 });
  K.anim({ t: 'sway', amp: 0.3, speed: 2.0 }, () => { K.trunk([[-3.6, 3.4, 0, 0.6], [-5.4, 3.0, 0.4, 0.4], [-6.8, 2.2, 0, 0.1]], P.b, 'chitin', { n: 6 }); });
  K.box(-0.4, 5.9, -1.0, 1.4, 0.2, 0.2, tc, 'paint'); K.box(-0.4, 5.9, 1.0, 1.4, 0.2, 0.2, tc, 'paint');
  farol(K, 9.6, RACA_COR.vorag);
};
if (ARD.meshes) ARD.meshes.receitas = RX;

/* ---------- 2D (voxel) ---------- */
function vox2d() { const MD = ARD.models; if (!MD || !MD.BY_DEF || !ARD.vox) return; const BY = MD.BY_DEF; const M = () => new ARD.vox.Model();
  const pal = (col, s) => ({ vehnar: { b: '#7C8490', d: '#2B2E35', l: '#FFC872' }, erevane: { b: '#3A404B', d: '#121418', l: '#3FE6CF' }, tessara: { b: '#CFC3AA', d: '#5E4F3C', l: '#7FE3A1' }, quorith: { b: '#C9BFEA', d: '#342B4A', l: '#B388FF' }, vorag: { b: '#5C2B37', d: '#26121A', l: '#FF5A5A' } }[s] || { b: '#888', d: '#333', l: col });
  const anel = (m, cx, cy, R, c) => { for (let a = 0; a < 32; a++) { const x = Math.round(cx + Math.cos(a / 32 * PI * 2) * R), y = Math.round(cy + Math.sin(a / 32 * PI * 2) * R); m.box(x, y, 0, 1, 1, 1, c, null, true); } };
  const add = (k, f) => { if (!BY[k]) BY[k] = f; };
  add('esteira', (c, s) => { const p = pal(c, s), m = M(); m.box(0, 0, 0, 22, 10, 1, p.d); m.box(1, 2, 1, 6, 6, 4, p.b); m.box(15, 2, 1, 6, 6, 4, p.b); m.box(7, 4, 1, 8, 2, 2, '#4A4F57'); m.box(1, 2, 5, 6, 6, 1, c); m.box(15, 2, 5, 6, 6, 1, c); m.box(9, 3, 3, 4, 4, 4, '#59606B'); m.box(10, 4, 6, 2, 2, 1, p.l, null, true); return m; });
  add('silo', (c, s) => { const p = pal(c, s), m = M(); m.box(0, 0, 0, 12, 12, 1, p.d); m.cyl(6, 6, 1, 4.6, 10, p.b); m.cyl(6, 6, 11, 4.6, 1, c); m.box(10, 5, 1, 2, 2, 3, '#2B2E35'); m.box(11, 5, 2, 1, 2, 1, '#FF5A1A', null, true); return m; });
  add('espelho', (c, s) => { const p = pal(c, s), m = M(); m.box(1, 1, 0, 8, 8, 2, p.b); m.box(4, 3, 2, 2, 4, 16, '#9FC7D6'); m.box(4, 3, 4, 1, 4, 12, p.l, null, true); m.box(3, 3, 17, 4, 4, 1, c); return m; });
  add('farol', (c, s) => { const p = pal(c, s), m = M(); m.box(1, 1, 0, 8, 8, 1, p.d); m.box(3, 3, 1, 4, 4, 13, p.b); m.box(2, 2, 14, 6, 6, 1, c); m.sphere(5, 5, 17, 2.6, '#E05CFF'); m.box(4, 4, 16, 2, 2, 2, '#FFB0FF', null, true); return m; });
  add('arvore', (c, s) => { const p = pal(c, s), m = M(); m.box(0, 0, 0, 12, 12, 1, p.d); m.box(5, 5, 1, 2, 2, 11, '#8E623A'); m.sphere(6, 6, 13, 4.6, p.b); m.sphere(3, 4, 12, 2, p.l); m.sphere(9, 8, 13, 2, p.l); m.box(5, 5, 16, 2, 2, 1, p.l, null, true); return m; });
  add('viveiro', (c, s) => { const p = pal(c, s), m = M(); m.box(0, 0, 0, 12, 12, 1, p.d); m.sphere(6, 6, 4, 5, '#A9E3BA'); m.box(5, 5, 9, 2, 2, 2, p.l, null, true); m.box(10, 5, 1, 2, 2, 2, c); return m; });
  add('pilar', (c, s) => { const p = pal(c, s), m = M(); m.box(1, 1, 0, 8, 8, 2, p.d); m.box(3, 3, 2, 4, 4, 14, p.b); m.box(4, 4, 6, 2, 2, 6, p.l, null, true); m.box(2, 2, 16, 6, 6, 1, c); return m; });
  add('eco', (c, s) => { const p = pal(c, s), m = M(); m.box(0, 0, 0, 12, 12, 1, p.d); m.sphere(6, 6, 4, 4.8, p.b); m.box(5, 5, 9, 2, 2, 4, p.l, null, true); m.box(4, 4, 8, 4, 4, 1, c); return m; });
  add('incubadora', (c, s) => { const p = pal(c, s), m = M(); m.box(0, 0, 0, 14, 12, 1, p.d); m.sphere(7, 6, 3, 5.5, p.b); m.sphere(3, 3, 5, 1.6, '#E8C6B0'); m.sphere(11, 9, 5, 1.6, '#E8C6B0'); m.box(6, 5, 8, 2, 2, 1, p.l, null, true); m.box(6, 5, 9, 2, 2, 1, c); return m; });
  add('tumor', (c, s) => { const p = pal(c, s), m = M(); m.box(0, 0, 0, 12, 12, 1, p.d); m.sphere(6, 6, 2, 4.6, p.b); m.box(5, 5, 6, 2, 2, 2, p.l, null, true); for (const [x, y] of [[1, 6], [10, 6], [6, 1], [6, 10]]) m.box(x, y, 1, 1, 1, 3, '#E8DCC8'); m.box(5, 5, 8, 2, 2, 1, c); return m; });
  const heroi = (raca, corpo) => (c, s) => { const p = pal(c, raca), m = M(); anel(m, 7, 7, 7, RACA_COR[raca]); corpo(m, p, c); m.box(6, 6, 18, 2, 2, 2, RACA_COR[raca], null, true); return m; };
  add('exoforja', heroi('vehnar', (m, p, c) => { m.box(5, 4, 1, 4, 6, 6, p.b); m.box(4, 3, 7, 6, 8, 5, p.b); m.box(4, 3, 12, 6, 8, 2, c); m.box(10, 9, 3, 3, 3, 4, '#4A4F57'); m.box(9, 6, 9, 1, 2, 2, '#FF5A1A', null, true); }));
  add('espectro', heroi('erevane', (m, p, c) => { m.box(5, 5, 1, 4, 4, 10, p.b); m.box(6, 6, 11, 2, 2, 3, p.d); m.box(9, 7, 8, 5, 1, 1, '#3FE6CF', null, true); m.box(4, 5, 9, 6, 4, 1, c); }));
  add('espectro_eco', BY.espectro);
  add('guardia', heroi('tessara', (m, p, c) => { m.box(5, 5, 1, 4, 4, 9, p.b); m.sphere(7, 7, 12, 1.6, p.b); m.box(4, 4, 6, 6, 6, 2, c); m.box(10, 9, 1, 1, 1, 12, '#8E623A'); m.box(10, 9, 13, 1, 1, 1, '#7FE3A1', null, true); }));
  add('prismavivo', heroi('quorith', (m, p, c) => { m.box(5, 5, 3, 4, 4, 10, p.b); m.box(6, 6, 6, 2, 2, 4, '#FFFFFF', null, true); m.box(4, 4, 9, 6, 6, 1, c); }));
  add('devorador', heroi('vorag', (m, p, c) => { m.box(2, 4, 1, 10, 6, 5, p.b); m.box(12, 5, 2, 3, 4, 3, p.b); m.box(14, 5, 3, 1, 1, 1, '#FF5A5A', null, true); m.box(14, 8, 3, 1, 1, 1, '#FF5A5A', null, true); for (let x = 3; x < 11; x += 2) m.box(x, 6, 6, 1, 1, 3, '#E8DCC8'); m.box(4, 4, 6, 6, 1, 1, c); }));
}

/* ---------- carga e variantes (lidas pelo render3d) ---------- */
const UM = ARD.unicasModelos = {
  RACA_COR,
  /* o que entra no aquecimento: as únicas da Raça de cada jogador (e as variantes da Árvore-Mãe) e, com os comandantes, o avatar de cada um */
  jobs(sim, jobs, lod) { const S = ARD.sim; if (!S || !S.UNICAS_DE) return; for (const p of sim.players) { if (p.fenda || p.mundo) continue;
      const defs = (S.UNICAS_DE[p.faction] || []).slice(); if (defs.includes('arvore')) defs.push('arvore_2', 'arvore_3');
      if (sim.cfg && sim.cfg.comandantes && S.COMANDANTES[p.faction]) { defs.push(S.COMANDANTES[p.faction].def); if (p.faction === 'erevane') defs.push('espectro_eco'); }
      for (const d of defs) { jobs.push([d, p.id, 0]); if (lod) jobs.push([d, p.id, 0, true]); } } },
  /* o modelo de uma entidade única (a Árvore-Mãe cresce com a Era do dono) */
  variante(e, sim) { if (e.def !== 'arvore') return null; const era = (sim.players[e.owner] || {}).era || 1; return era >= 3 ? 'arvore_3' : era === 2 ? 'arvore_2' : null; },
  vox2d,
};
vox2d();
})(globalThis.ARD = globalThis.ARD || {});
