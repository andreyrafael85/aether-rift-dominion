/* Aether Rift: Dominion — 5.0g (agente g-visual): os modelos dos chefões, no mesmo construtor (Kit) e no mesmo formato das malhas de hoje
   (src/meshes.js): cor, rugosidade e metal por vértice, partes emissivas separadas e animação por peça (spin, leg, bob) na GPU. Entram pelo
   gancho ARD.meshes.receitas (a função recipe do src/meshes.js procura aqui primeiro), então valem nos dois motores com o material e as
   instâncias de sempre: nenhum material nem pipeline novo (no Motor 5 o formato da geometria é o mesmo de qualquer modelo).
   Cada variante é um modelo à parte (o render3d escolhe pela fase, src/chefes.js), todos montados na carga só quando a partida tem chefão.
   - O Arauto: monólito-lente flutuante de vidro escuro com arestas acesas, olho de éter no meio e três anéis girando em volta.
       chefe_arauto_1 (Três Pilares: escudo em treliça), _2 (Ecos: anéis abertos e rachaduras), _3 (Colapso: anéis fechados, estilhaços),
       _j (janela de dano: o olho aberto, anéis afastados e lentos). A Sentinela: chefe_sentinela e _j (menor, dois anéis, âmbar).
   - Pilar do Arauto (chefe_pilar), cópias espectrais (o modelo da unidade original com o material fantasma, no render3d).
   - A Forja-Mãe: corpo de fábrica sem as pernas (chefe_forja e _b com as baias abertas), a perna inteira (chefe_forja_perna, desenhada
     quatro vezes pelo src/chefes.js e que cai quando é destruída), o corpo desabado (chefe_forja_caida), a junta blindada do ponto fraco
     (chefe_junta) e o núcleo exposto (chefe_nucleo). Marca de ponto fraco: chefe_marca (losango aceso que gira acima da parte). */
(function (ARD) {
'use strict';
const PI = Math.PI;
/* cores dos Despertos (Arauto e Sentinela) e dos Construtores (Forja): fora das cores de time */
const VID = '#120F1C', VID2 = '#231C38', ARE = '#BFF4FF', OLHO = '#E07CFF', OLHO2 = '#FFE6FF', OURO = '#B8975A', RUN = '#7FE8FF', AMB = '#FFC24A';
const ACO = '#4A4E57', ACO2 = '#6E737D', ESC = '#22252B', FER = '#8A5A3A', BRASA = '#FF7A1A', BRASA2 = '#FFD27A', PER = '#FFD23F';

/* ---------- O Arauto e a Sentinela ---------- */
function anel(K, yc, R, r, tilt, speed, axisTilt, runas, k) { /* anel de metal com runas acesas, inclinado e girando em volta de y (o giro inclinado precessa) */
  K.anim({ t: 'spin', p: [0, yc, 0], speed }, () => {
    K.tor(0, yc, 0, R, r, OURO, 'metal', { ts: 48, rs: 8, rx: tilt, rz: axisTilt });
    const n = K.q(runas); for (let i = 0; i < n; i++) { const a = i / n * PI * 2; const ca = Math.cos(a), sa = Math.sin(a);
      /* ponto do anel na mesma rotação do toro (Euler YXZ do Kit: primeiro rz, depois rx) */
      const x0 = ca * R, z0 = sa * R; const x1 = x0 * Math.cos(axisTilt), y1 = x0 * Math.sin(axisTilt);
      const y2 = y1 * Math.cos(tilt) - z0 * Math.sin(tilt), z2 = y1 * Math.sin(tilt) + z0 * Math.cos(tilt);
      K.box(x1, yc + y2 - r * 0.9, z2, r * 1.6, r * 1.8, r * 1.6, RUN, null, { e: k || 2.4, ry: -a }); }
  });
}
function lente(K, s, o) { /* o monólito-lente: octaedro achatado de vidro escuro, arestas acesas e o olho (fechado ou aberto) */
  const y0 = 6 * s, h = 26 * s, R = 8 * s, yc = y0 + h / 2, cor = o.cor || ARE;
  K.anim({ t: 'bob', amp: 0.9 * s, speed: 0.9 }, () => {
    K.oct(0, y0, 0, R, h, VID, 'obsid', { sz: 0.46 });
    K.oct(0, y0 + h * 0.1, 0, R * 0.78, h * 0.8, VID2, 'glass', { sz: 0.5 });
    /* arestas acesas (as quatro arestas do octaedro achatado) */
    const top = [0, y0 + h, 0], bot = [0, y0, 0], fr = [R, yc, 0], bk = [-R, yc, 0], l = [0, yc, R * 0.46], rr = [0, yc, -R * 0.46];
    for (const m of [fr, bk]) { K.seg(top, m, 0.16 * s, cor, null, { e: 2.6, seg: 5 }); K.seg(m, bot, 0.16 * s, cor, null, { e: 2.6, seg: 5 }); }
    K.fine(() => { for (const m of [l, rr]) { K.seg(top, m, 0.1 * s, cor, null, { e: 1.6, seg: 4 }); K.seg(m, bot, 0.1 * s, cor, null, { e: 1.6, seg: 4 }); } });
    /* rachaduras acesas (Ecos e Colapso) */
    if (o.racha) { const rn = o.racha; for (let i = 0; i < rn; i++) { const a = (i * 2.399) % (PI * 2), yy = yc + Math.sin(i * 1.7) * h * 0.28, x0 = Math.cos(a) * R * 0.3; const zf = (i % 2 ? 1 : -1) * R * 0.3;
      K.seg([x0, yy, zf], [x0 + Math.cos(a + 0.6) * R * 0.45, yy + Math.sin(a) * h * 0.12, zf * 1.1], 0.09 * s, OLHO, null, { e: 2.2, seg: 4 }); } }
    /* o olho */
    if (o.aberto) {
      K.sph(0, yc, 0, 4.6 * s, OLHO, null, { e: 3.0, seg: 18 });
      for (const sx of [1, -1]) { K.cyl(sx * 4.3 * s, yc, 0, 1.9 * s, 1.9 * s, 0.5 * s, '#1A0526', 'gloss', { rz: PI / 2, seg: 16 }); K.tor(sx * 4.25 * s, yc, 0, 2.6 * s, 0.32 * s, OLHO2, null, { e: 3.2, rz: PI / 2, ts: 24 }); }
      K.tor(0, yc, 0, 5.4 * s, 0.25 * s, OLHO2, null, { e: 2.8, rz: PI / 2, ts: 32 });
    } else {
      K.sph(0, yc, 0, 4.1 * s, '#1B1430', 'obsid', { seg: 16, sz: 0.95 });
      K.box(0, yc - 0.18 * s, 0, 8.6 * s, 0.36 * s, 3.2 * s, OLHO, null, { e: o.fenda || 2.6 }); /* a fresta do olho fechado */
    }
  });
  return yc;
}
function arauto(v) { return (K) => {
  K.base = 0; const s = 1.3; const yc = lente(K, s, { aberto: v === 'j', racha: v === '2' ? 5 : v === '3' ? 9 : v === 'j' ? 7 : 0, fenda: v === '3' ? 3.4 : 2.6 });
  const RS = v === '1' ? [13, 16.5, 20] : v === '2' ? [15, 19.5, 24] : v === '3' ? [12.5, 14, 15.5] : [18, 22.5, 27];
  const SP = v === '3' ? [2.4, -3.0, 3.6] : v === 'j' ? [0.25, -0.3, 0.35] : v === '2' ? [1.1, -1.4, 1.7] : [0.7, -0.9, 1.1];
  anel(K, yc, RS[0], 0.55, 0.35, SP[0], 0, 12); anel(K, yc, RS[1], 0.5, 0, SP[1], PI / 2, 14); anel(K, yc, RS[2], 0.45, 0.9, SP[2], 0.5, 16);
  if (v === '1') { /* escudo dos Três Pilares: treliça de anéis finos acesos */
    K.anim({ t: 'spin', p: [0, yc, 0], speed: 0.25 }, () => { for (let i = 0; i < K.q(6); i++) K.tor(0, yc, 0, 24, 0.12, RUN, null, { e: 1.6, ts: 40, rs: 4, rx: PI / 2, ry: i * PI / 6 }); K.tor(0, yc, 0, 24, 0.12, RUN, null, { e: 1.6, ts: 40, rs: 4 }); }); }
  if (v === '3') { /* estilhaços em órbita apertada */
    K.anim({ t: 'spin', p: [0, yc, 0], speed: -1.6 }, () => { for (let i = 0; i < K.q(10); i++) { const a = i * 0.628, rr = 15 + (i % 3) * 2.5; K.oct(Math.cos(a) * rr, yc - 3 + (i % 4) * 2, Math.sin(a) * rr, 0.8, 2.6, i % 2 ? OLHO : VID2, i % 2 ? null : 'obsid', i % 2 ? { e: 2.4 } : {}); } }); }
  /* raiz de luz até o chão (o vidro do chão é desenhado no chão pelo src/chefes.js; o tamanho das fases é fixo pelo CH.fit) */
  K.seg([0, 0.2, 0], [0, 6 * 1.3, 0], 0.6, ARE, null, { e: 1.8, seg: 6, taper: 3 });
}; }
function sentinela(v) { return (K) => {
  K.base = 0; const s = 0.8; const yc = lente(K, s, { aberto: v === 'j', racha: v === 'j' ? 3 : 0, cor: AMB });
  anel(K, yc, v === 'j' ? 15 : 11.5, 0.5, 0.3, v === 'j' ? 0.3 : 1.2, 0, 10); anel(K, yc, v === 'j' ? 18 : 14, 0.45, 0, v === 'j' ? -0.35 : -1.5, PI / 2, 10);
  K.seg([0, 0.2, 0], [0, 4.8, 0], 0.4, AMB, null, { e: 1.8, seg: 6, taper: 3 });
}; }
function pilar(K) { /* pilar dos Três Pilares: obelisco de vidro escuro com veias acesas e o cristal do topo girando, ligado ao Arauto */
  K.base = 0;
  K.prism(0, -1, 0, 6, 3, 6, '#2B2733', 'rock', { top: 0.8 });
  K.prism(0, 1.5, 0, 3.2, 20, 6, VID, 'obsid', { top: 0.45 });
  for (let i = 0; i < 6; i++) { const a = i / 6 * PI * 2 + PI / 6; K.seg([Math.cos(a) * 3.0, 2, Math.sin(a) * 3.0], [Math.cos(a) * 1.5, 21, Math.sin(a) * 1.5], 0.12, RUN, null, { e: 2.2, seg: 4 }); }
  K.anim({ t: 'spin', p: [0, 26, 0], speed: 1.4 }, () => { K.oct(0, 23, 0, 2.4, 7, ARE, null, { e: 2.8 }); K.tor(0, 26.5, 0, 4.2, 0.22, OURO, 'metal', { ts: 28, rx: 0.4 }); });
  K.fine(() => { for (let i = 0; i < 3; i++) { const a = i * 2.1; K.oct(Math.cos(a) * 5.5, 0, Math.sin(a) * 5.5, 1.1, 3.6, VID2, 'obsid', { rz: 0.3 }); } });
}
function marca(K) { /* marca do ponto fraco: losango aceso girando (âmbar de perigo), com um aro fino */
  K.base = 0; K.anim({ t: 'spin', p: [0, 0, 0], speed: 2.2 }, () => { K.oct(0, 0, 0, 1.6, 4.4, PER, null, { e: 3.2, seg: 4 }); K.tor(0, 2.2, 0, 2.6, 0.18, PER, null, { e: 2.6, ts: 24 }); K.cyl(0, -0.4, 0, 0.35, 0.35, 0.8, '#1C1A18', 'dark', { seg: 6 }); /* 5.0g junção: miolo escondido não emissivo — com parte principal a malha ganha o atributo pt e divide o pipeline do material da Raça (só emissiva, era uma variante a mais + a sombra dela) */ });
}

/* ---------- A Forja-Mãe ---------- */
function chamine(K, x, z, r, h) { K.cyl(x, 26, z, r * 0.9, r, h, ESC, 'dark', { seg: 12 }); K.tor(x, 26 + h, z, r * 0.95, 0.35, BRASA, null, { e: 2.4, ts: 20 }); K.tor(x, 26 + h * 0.5, z, r * 1.02, 0.25, ACO2, 'metal', { ts: 20 }); K.cyl(x, 26 + h - 0.2, z, r * 0.7, r * 0.7, 0.3, BRASA2, null, { e: 2.8, seg: 10 }); }
function guindaste(K, x, z, ry, L) { const cx = Math.cos(ry), sz = Math.sin(ry); K.cyl(x, 26, z, 0.9, 1.1, 5, ACO, 'steel', { seg: 8 });
  K.seg([x, 30.5, z], [x + cx * L, 34, z + sz * L], 0.45, PER, 'paint', { seg: 6 }); K.seg([x + cx * L, 34, z + sz * L], [x + cx * L, 27.5, z + sz * L], 0.08, ESC, 'dark', { seg: 4 }); K.box(x + cx * L, 26.5, z + sz * L, 1.4, 1.2, 1.4, ACO2, 'metal');
  K.fine(() => { for (let i = 1; i < 5; i++) { const f = i / 5; K.box(x + cx * L * f, 30.5 + 3.5 * f + 0.45, z + sz * L * f, 0.3, 0.3, 0.3, ESC, 'dark'); } }); }
function forjaCorpo(baias, caida) { return (K) => {
  const y0 = caida ? 0 : 14; K.base = caida ? 1.5 : 0;
  if (caida) { /* desabada: o casco no chão, inclinado, com a tampa arrancada */
    K.box(0, 0, 0, 36, 10, 30, ACO, 'steel', { b: 1.4, rz: 0.06, rx: -0.05 }); K.box(-4, 9.5, 6, 20, 2, 12, ESC, 'dark', { rz: 0.5, ry: 0.4 });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) K.cyl(sx * 15, 0, sz * 12, 2.2, 2.6, 4, ESC, 'dark', { seg: 10 }); /* tocos das pernas */
    chamine(K, -12, -8, 2.4, 6); K.fine(() => chamine(K, -12, 8, 2.0, 3));
    for (let i = 0; i < 6; i++) { const a = i * 1.05; K.seg([Math.cos(a) * 8, 6, Math.sin(a) * 8], [Math.cos(a) * 12, 3, Math.sin(a) * 11], 0.18, BRASA, null, { e: 2.6, seg: 4 }); } /* metal derretido escorrendo */
    return;
  }
  /* casco: bloco largo de aço com faixa de perigo e frisos */
  K.box(0, y0, 0, 34, 12, 30, ACO, 'steel', { b: 1.2 });
  K.box(0, y0 + 12, 0, 28, 3, 24, ACO2, 'steel', { b: 0.8 });
  K.box(0, y0 - 2, 0, 26, 2.2, 22, ESC, 'dark', { b: 0.5 });
  for (let i = 0; i < 9; i++) K.box(-16 + i * 4, y0 + 10.4, 15.05, 2, 1, 0.3, i % 2 ? ESC : PER, 'paint'); /* faixa de perigo */
  for (let i = 0; i < 9; i++) K.box(-16 + i * 4, y0 + 10.4, -15.05, 2, 1, 0.3, i % 2 ? ESC : PER, 'paint');
  /* ancoragens das pernas nos cantos */
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { K.cyl(sx * 15, y0 + 1, sz * 12, 3.0, 3.2, 8, ESC, 'dark', { seg: 12 }); K.tor(sx * 15, y0 + 9, sz * 12, 3.1, 0.35, BRASA, null, { e: 1.8, ts: 20 }); }
  /* frente: baias de produção (fechadas ou abertas com a luz da linha de montagem) */
  for (const z of [-7, 0, 7]) { if (baias) { K.box(17.2, y0 + 2, z, 0.6, 7, 5.2, BRASA, null, { e: 2.2 }); K.box(17.9, y0 + 8.4, z, 1.0, 0.6, 5.6, ACO2, 'steel', { rz: -0.5 }); }
    else { K.box(17.1, y0 + 2, z, 0.8, 7, 5.2, ACO2, 'steel'); K.box(17.6, y0 + 4.9, z, 0.3, 0.5, 5.0, BRASA, null, { e: 1.8 }); } }
  /* topo: chaminés, guindastes, soldas e o núcleo atrás da grade */
  chamine(K, -11, -7, 2.6, 13); chamine(K, -11, 7, 2.2, 10); K.fine(() => chamine(K, -4, -9, 1.6, 8));
  guindaste(K, 6, 8, 0.3, 11); guindaste(K, 4, -8, -0.4, 9);
  K.cyl(2, y0 + 15, 0, 5.2, 5.6, 1.6, ESC, 'dark', { seg: 16 }); K.sph(2, y0 + 16.4, 0, 3.8, BRASA2, null, { e: 2.2, half: true, seg: 14 });
  for (let i = 0; i < 6; i++) K.box(2 - 5 + i * 2, y0 + 16.8, 0, 0.35, 0.5, 9, ESC, 'dark'); /* grade sobre o núcleo */
  K.fine(() => { for (const sz of [-1, 1]) { K.seg([12, y0 + 15, sz * 4], [15, y0 + 17, sz * 6], 0.35, ACO2, 'metal'); K.oct(15, y0 + 16.6, sz * 6, 0.5, 1.0, '#FFF3C2', null, { e: 3.4 }); } }); /* bicos de solda */
}; }
function forjaPerna(K) { /* uma perna inteira: quadril em (0, 22, 0), joelho alto e pé no chão a +x; leg na GPU (passo) */
  K.base = 0; const Hp = [0, 22, 0], Kn = [9, 30, 0], Ft = [17, 0, 0];
  K.anim({ t: 'leg', p: Hp, amp: 0.22, stride: 14, ph: 0 }, () => {
    K.seg(Hp, Kn, 1.8, ACO, 'steel', { seg: 10, taper: 0.8 }); K.seg(Kn, Ft, 1.5, ACO2, 'steel', { seg: 10, taper: 0.55 });
    K.sph(Kn[0], Kn[1], Kn[2], 2.4, ESC, 'dark', { seg: 12 }); K.tor(Kn[0], Kn[1], Kn[2], 2.5, 0.3, BRASA, null, { e: 2.2, rz: PI / 2, ts: 18 });
    K.box(Ft[0] - 2.2, 0, -2.2, 4.4, 1.4, 4.4, ESC, 'dark', { b: 0.4 });
    K.seg([Hp[0] + 1, Hp[1] - 1, 0], [Kn[0] - 0.5, Kn[1] - 2.5, 0], 0.5, FER, 'metal', { seg: 6 }); /* pistão */
    K.fine(() => { for (let i = 0; i < 4; i++) K.box(Kn[0] + 1 + i * 1.6, Kn[1] - 3.4 - i * 7, -1.6, 0.6, 1.4, 3.2, i % 2 ? ESC : PER, 'paint', { rz: -0.4 }); });
  });
}
function forjaPernaCaida(K) { /* a perna destruída, deitada de lado no chão, com o joelho apagando */
  K.base = 0; const Hp = [0, 1.8, 0], Kn = [9, 2.2, 8], Ft = [17, 1.6, 1.5];
  K.seg(Hp, Kn, 1.8, ACO, 'steel', { seg: 10, taper: 0.8 }); K.seg(Kn, Ft, 1.5, ACO2, 'steel', { seg: 10, taper: 0.55 });
  K.sph(Kn[0], Kn[1], Kn[2], 2.4, ESC, 'dark', { seg: 12 }); K.tor(Kn[0], Kn[1] + 1.2, Kn[2], 2.5, 0.3, FER, null, { e: 1.2, ts: 18 });
  K.box(Ft[0] - 2.2, 0, -2.2, 4.4, 1.4, 4.4, ESC, 'dark', { b: 0.4, rz: 0.5 }); K.cyl(-0.5, 0, 0, 2.2, 2.6, 1.6, ESC, 'dark', { seg: 10 });
}
function junta(K) { /* ponto fraco da perna: junta blindada com o núcleo aceso à mostra */
  K.base = 0; K.cyl(0, 0, 0, 3.4, 4.0, 2.4, ESC, 'dark', { seg: 12 }); K.sph(0, 3.4, 0, 2.6, BRASA2, null, { e: 2.6, seg: 14 });
  for (let i = 0; i < 4; i++) { const a = i * PI / 2 + PI / 4; K.box(Math.cos(a) * 3.0, 1.8, Math.sin(a) * 3.0, 1.4, 3.6, 1.4, i % 2 ? PER : ACO2, 'paint', { ry: -a }); }
}
function nucleo(K) { /* o núcleo exposto que superaquece: esfera branca-laranja numa gaiola, com aletas */
  K.base = 0; K.cyl(0, 0, 0, 7, 8, 3, ESC, 'dark', { seg: 16 });
  K.anim({ t: 'bob', amp: 0.4, speed: 3.2 }, () => { K.sph(0, 8, 0, 5.2, BRASA2, null, { e: 3.2, seg: 20 }); K.sph(0, 8, 0, 6.0, BRASA, null, { e: 1.6, seg: 14 }); });
  K.anim({ t: 'spin', p: [0, 8, 0], speed: 0.8 }, () => { for (let i = 0; i < K.q(6); i++) K.tor(0, 8, 0, 7.2, 0.35, ACO2, 'metal', { ts: 28, rx: PI / 2, ry: i * PI / 6 }); });
  for (let i = 0; i < 8; i++) { const a = i * PI / 4; K.box(Math.cos(a) * 7.5, 1, Math.sin(a) * 7.5, 1.0, 5, 2.4, ACO, 'steel', { ry: -a }); }
}

const RX = ARD.meshes && ARD.meshes.receitas ? ARD.meshes.receitas : {};
Object.assign(RX, {
  chefe_arauto_1: arauto('1'), chefe_arauto_2: arauto('2'), chefe_arauto_3: arauto('3'), chefe_arauto_j: arauto('j'),
  chefe_sentinela: sentinela('1'), chefe_sentinela_j: sentinela('j'), chefe_pilar: pilar, chefe_marca: marca,
  chefe_forja: forjaCorpo(false, false), chefe_forja_b: forjaCorpo(true, false), chefe_forja_caida: forjaCorpo(false, true),
  chefe_forja_perna: forjaPerna, chefe_forja_perna_caida: forjaPernaCaida, chefe_junta: junta, chefe_nucleo: nucleo,
});
if (ARD.meshes) ARD.meshes.receitas = RX;
ARD.chefesModelos = Object.keys(RX).filter(k => k.startsWith('chefe_'));
})(globalThis.ARD = globalThis.ARD || {});
