/* Líderes das Raças: bustos voxel usados no HUD (retrato 2.5D) e na arte da galeria. Mesma API Model do jogo (+x é a frente). */
(function (ARD) {
'use strict';
const V = ARD.vox; const M = () => new V.Model();
const B = {};
// ---- Vehnar: Barão-Forja — elmo pesado, visor de fornalha, chaminés nos ombros
B.vehnar = () => { const m = M(); const steel = '#9aa6b8', dk = '#596274', rust = '#a8542e', org = '#ff7733', ember = '#ffc08a';
  m.cyl(0, 9, 0, 10.5, 6, dk);                              // ombros arredondados
  m.box(-8, 0, 6, 16, 18, 3, steel);                      // placa peitoral
  m.box(-7, 2, 9, 14, 14, 2, dk);                         // gola
  m.box(-6, 4, 11, 12, 10, 12, steel);                    // elmo
  m.box(-6, 4, 11, 12, 10, 12, dk, (x, y, z) => (x === 0 || x === 11) && (y === 0 || y === 9) && z % 3 === 0); // rebites nas arestas
  m.box(-6, 6, 23, 12, 6, 1, dk);                         // topo chato
  m.box(6, 5, 17, 1, 8, 2, org, null, true);              // visor emissivo (face +x)
  m.box(6, 5, 16, 1, 8, 1, dk); m.box(6, 5, 19, 1, 8, 1, dk);
  m.box(6, 6, 12, 1, 6, 3, dk, (x, y, z) => y % 2 === 0); // grade do queixo
  m.cyl(-6, 0, 6, 2.2, 9, rust); m.cyl(-6, 18, 6, 2.2, 9, rust); // chaminés
  m.box(-7, -1, 15, 2, 2, 1, ember, null, true); m.box(-7, 17, 15, 2, 2, 1, ember, null, true); // brasa no topo
  m.box(-2, 7, 7, 4, 4, 1, org, null, true);              // núcleo do reator no peito
  return m; };
// ---- Erevane: Olho do Véu — cúpula iridescente, olho-fenda, colar de lâminas
B.erevane = () => { const m = M(); const bands = ['#2a4a66', '#33587a', '#3b6a8a', '#2f6f7a', '#3c6e9a'];
  m.cyl(0, 9, 0, 9, 4, '#223447');                       // ombros
  m.cyl(0, 9, 4, 7, 2, '#2d4660');
  m.box(-10, 2, 5, 3, 14, 1, '#4a7a9e'); m.box(7, 2, 5, 3, 14, 1, '#4a7a9e'); // lâminas do colar
  m.cyl(0, 9, 6, 2.5, 4, '#2d4660');                      // pescoço
  for (let z = 0; z < 13; z++) { const r = z < 10 ? 6.5 : 6.5 - (z - 9) * 1.6; m.cyl(0, 9, 10 + z, Math.max(1.5, r), 1, bands[z % bands.length]); } // cúpula em bandas
  m.box(5, 4, 15, 2, 10, 2, '#33ffd0', null, true);       // olho-fenda
  m.box(5, 4, 14, 2, 10, 1, '#071017'); m.box(5, 4, 17, 2, 10, 1, '#071017');
  m.box(-1, 2, 20, 1, 1, 1, '#9fe8ff', null, true); m.box(2, 14, 21, 1, 1, 1, '#9fe8ff', null, true); // brilhos iridescentes
  return m; };
// ---- Tessara: Jardineira de Traços — cabeça bulbosa, frondes, seiva âmbar
B.tessara = () => { const m = M(); const g = '#49a86a', gd = '#2f7a4a', amber = '#e6b85c', eye = '#7fffb0';
  m.cyl(0, 9, 0, 9, 4, gd); m.cyl(0, 9, 4, 5.5, 3, gd);         // ombros orgânicos e pescoço
  m.box(-2, 7, 5, 4, 4, 2, amber, null, true);                   // seiva no peito
  m.sphere(0, 9, 14, 6.5, g); m.sphere(0, 9, 11.5, 5.5, gd);     // cabeça com parte de baixo escura
  m.sphere(5.5, 6, 15, 1.6, eye, true); m.sphere(5.5, 12, 15, 1.6, eye, true); // olhos grandes
  m.box(6, 8, 12, 1, 2, 1, amber, null, true);                   // boca-núcleo
  for (const [fx, fy, h] of [[-3, 4, 8], [0, 9, 10], [-2, 14, 7], [3, 6, 6], [2, 12, 6]]) { m.box(fx, fy, 20, 1, 1, h, g); m.box(fx, fy, 20 + h, 1, 1, 1, amber, null, true); } // frondes com ponta âmbar
  return m; };
// ---- Quorith: Primeira Voz — octaedro de cristal sólido flutuando sobre um anel
B.quorith = () => { const m = M(); const top = '#d4b8ff', mid = '#b388ff', low = '#6d50b8', w = '#ffffff';
  m.cyl(0, 9, 0, 7, 2, '#5a4a8a'); m.cyl(0, 9, 2, 5, 1, '#7a68b0'); m.cyl(0, 9, 1, 2, 3, mid, true); // anel-base com núcleo
  const oct = (z0, h, c) => m.box(-8, 1, z0, 17, 17, h, c, (x, y, z, ww, dd) => Math.abs(x - 8) + Math.abs(y - 8) + Math.abs((z + z0) - 14) <= 8);
  oct(6, 6, low); oct(12, 5, mid); oct(17, 6, top);                      // três faixas de cor
  m.box(7, 6, 13, 1, 2, 1, w, null, true); m.box(7, 10, 13, 1, 2, 1, w, null, true); // fendas de luz na faceta frontal
  m.box(-10, 2, 12, 2, 2, 3, mid); m.box(8, 16, 17, 2, 2, 3, top); m.box(-4, 18, 20, 1, 1, 2, w, null, true); // lascas flutuantes
  return m; };
// ---- Vorag: Boca da Prole — carapaça larga, quatro olhos, mandíbula de osso
B.vorag = () => { const m = M(); const red = '#b8384a', red2 = '#86202f', hot = '#ff6a7c', bone = '#f0e6d2', amber = '#ffc24a', dkk = '#3a0c14';
  m.cyl(0, 9, 0, 9, 4, red2); m.box(-4, 5, 4, 8, 8, 3, red2);           // tórax e pescoço
  m.box(-6, 0, 7, 12, 18, 8, red);                                       // cabeça larga
  m.box(-6, 0, 15, 12, 18, 1, red2); m.box(-4, 3, 16, 8, 12, 1, red2); m.box(-2, 6, 17, 4, 6, 1, red2); // carapaça em degraus
  m.box(-7, -1, 9, 2, 2, 4, red2); m.box(-7, 17, 9, 2, 2, 4, red2);      // bordas laterais
  m.box(6, 4, 11, 1, 3, 3, amber, null, true); m.box(6, 11, 11, 1, 3, 3, amber, null, true); // olhos grandes
  m.box(6, 2, 14, 1, 1, 1, amber, null, true); m.box(6, 15, 14, 1, 1, 1, amber, null, true); // olhos pequenos
  m.box(1, 1, 4, 8, 16, 2, red);                                          // maxilar inferior projetado
  m.box(7, 1, 6, 2, 16, 1, bone, (x, y) => y % 2 === 0);                  // dentes inferiores
  m.box(7, 1, 8, 2, 16, 1, bone, (x, y) => y % 2 === 1);                  // dentes superiores
  m.box(1, 2, 6, 6, 14, 2, dkk);                                          // goela escura
  m.box(7, -3, 8, 5, 3, 2, hot); m.box(7, 18, 8, 5, 3, 2, hot);           // mandíbulas laterais
  m.box(12, -3, 9, 1, 3, 1, bone); m.box(12, 18, 9, 1, 3, 1, bone);
  return m; };
ARD.leaders = B;
})(globalThis.ARD = globalThis.ARD || {});
