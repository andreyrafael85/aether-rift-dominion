/* Biblioteca de modelos voxel (definidos em código; em produção viriam de MagicaVoxel/.vox) */
(function (ARD) {
'use strict';
const M = () => new ARD.vox.Model();
const dark = '#2A2D33', steel = '#7A8290', steel2 = '#5E6671', glass = '#8FD8FF', rust = '#8A5A3A', orange = '#FF8C1A', magenta = '#D64CFF', plasma = '#FF6A3D', green = '#7FE3A1';

function tank(col) {
  const m = M();
  m.box(0, 0, 0, 14, 3, 3, dark, (x, y, z) => !(z === 2 && (x % 3 === 1)));      // esteira esquerda
  m.box(0, 7, 0, 14, 3, 3, dark, (x, y, z) => !(z === 2 && (x % 3 === 1)));      // esteira direita
  m.box(1, 2, 2, 12, 6, 3, col);                                                   // casco
  m.box(2, 3, 5, 9, 4, 1, steel2);                                                 // convés
  m.box(3, 3, 5, 6, 4, 3, col);                                                    // torre
  m.box(4, 4, 8, 4, 2, 1, steel);                                                  // escotilha
  m.box(9, 4, 6, 7, 2, 1, steel2);                                                 // canhão
  m.box(15, 4, 6, 2, 2, 1, dark);
  m.box(12, 3, 4, 1, 1, 1, '#FFE08A', null, true); m.box(12, 6, 4, 1, 1, 1, '#FFE08A', null, true); // faróis
  m.box(1, 4, 4, 1, 2, 1, '#FF4040', null, true);                                  // luz traseira
  return m;
}
function mech(col) {
  const m = M();
  for (const y of [1, 8]) { m.box(3, y, 0, 5, 3, 1, dark); m.box(4, y, 1, 3, 3, 5, steel2); m.box(4, y + 1, 6, 3, 1, 2, col); } // pés e pernas
  m.box(2, 1, 8, 9, 10, 6, col);                                                   // corpo
  m.box(3, 2, 14, 7, 8, 2, steel2);                                                // ombros
  m.box(5, 4, 16, 4, 4, 3, col);                                                   // cabine
  m.box(9, 5, 17, 1, 2, 1, glass, null, true);                                     // visor
  m.box(10, 0, 11, 1, 3, 3, steel2); m.box(11, 0, 11, 9, 3, 3, dark);             // canhão esq
  m.box(10, 9, 11, 1, 3, 3, steel2); m.box(11, 9, 11, 9, 3, 3, dark);             // canhão dir
  m.box(0, 3, 10, 2, 6, 3, rust);                                                  // mochila
  m.box(19, 1, 12, 1, 1, 1, orange, null, true); m.box(19, 10, 12, 1, 1, 1, orange, null, true);
  return m;
}
function harvester(col) {
  const m = M();
  for (const x of [1, 9]) for (const y of [0, 8]) m.cyl(x + 1.5, y + 1.5, 0, 1.6, 3, dark);  // rodas
  m.box(0, 1, 2, 13, 8, 3, steel2);                                                // chassi
  m.box(9, 1, 4, 4, 8, 5, col);                                                    // cabine
  m.box(12, 2, 6, 1, 6, 2, glass, null, true);                                     // para-brisa
  m.box(0, 1, 4, 9, 8, 5, col, (x, y, z) => !(x > 0 && x < 8 && y > 0 && y < 7 && z > 2)); // caçamba
  for (let i = 0; i < 14; i++) { const x = 1 + (i * 7) % 7, y = 2 + (i * 5) % 6; m.box(x, y, 7, 1, 1, 1 + (i % 3), plasma, null, i % 4 === 0); } // carga brilhante
  m.box(13, 3, 4, 1, 1, 1, '#FFE08A', null, true); m.box(13, 6, 4, 1, 1, 1, '#FFE08A', null, true);
  return m;
}
function infantry(col) {
  const m = M();
  m.box(1, 0, 0, 1, 1, 3, dark); m.box(1, 2, 0, 1, 1, 3, dark);                    // pernas
  m.box(0, 0, 3, 3, 3, 3, col);                                                    // torso
  m.box(3, 1, 4, 3, 1, 1, steel2);                                                 // arma
  m.box(1, 1, 6, 1, 1, 1, '#E8C9A0'); m.box(0, 0, 7, 3, 3, 1, steel2);             // cabeça e capacete
  m.box(2, 1, 6, 1, 1, 1, glass, null, true);
  return m;
}
function drone(col) {
  const m = M();
  m.box(2, 2, 2, 4, 4, 2, col); m.box(3, 3, 4, 2, 2, 1, steel2);
  for (const [x, y] of [[0, 0], [6, 0], [0, 6], [6, 6]]) { m.box(x, y, 2, 2, 2, 1, dark); m.box(x - 1, y - 1, 3, 4, 4, 1, steel2, (a, b2) => (a === 0 || a === 3 || b2 === 0 || b2 === 3)); }
  m.box(3, 3, 1, 2, 2, 1, magenta, null, true);
  return m;
}
function raider(col) { // pirata: veículo baixo e angular com mangueira de sifão
  const m = M();
  m.box(0, 1, 0, 12, 6, 2, dark);
  m.box(1, 0, 2, 10, 8, 3, col, (x, y, z) => !(z === 2 && (y === 0 || y === 7) && x > 7));
  m.box(8, 2, 5, 3, 4, 2, steel2); m.box(11, 3, 5, 1, 2, 1, glass, null, true);
  m.box(0, 3, 5, 3, 2, 1, magenta, null, true);                                    // tanque de sifão brilhante
  m.box(-2, 3, 3, 3, 2, 1, steel2);
  return m;
}
function refinery(col) {
  const m = M();
  m.box(0, 0, 0, 26, 20, 2, steel2, (x, y) => !((x + y) % 7 === 0 && x > 1 && y > 1 && x < 24 && y < 18));   // laje com placas
  m.box(2, 2, 2, 14, 12, 9, col);                                                  // bloco principal
  m.box(2, 2, 11, 14, 12, 1, steel2);                                              // telhado
  m.box(4, 4, 12, 10, 8, 1, dark);
  m.cyl(20.5, 6.5, 2, 3.4, 11, steel); m.cyl(20.5, 6.5, 13, 3.6, 1, steel2);        // tanque 1
  m.cyl(20.5, 14.5, 2, 3.4, 9, steel); m.cyl(20.5, 14.5, 11, 3.6, 1, steel2);       // tanque 2
  m.box(16, 6, 6, 4, 1, 1, dark); m.box(16, 14, 5, 4, 1, 1, dark);                 // tubulações
  m.box(6, 15, 2, 8, 3, 3, dark); m.box(7, 16, 5, 6, 1, 1, plasma, null, true);    // entrada de coletores com calha brilhante
  for (let i = 0; i < 4; i++) m.box(3 + i * 3, 1, 4 + (i % 2) * 2, 2, 1, 1, '#FFE08A', null, true); // janelas
  m.box(9, 9, 13, 2, 2, 5, dark); m.box(9, 9, 18, 2, 2, 1, '#FF4040', null, true); // antena
  m.box(18, 6, 13, 2, 1, 1, plasma, null, true); m.box(18, 14, 11, 2, 1, 1, plasma, null, true); // válvulas
  return m;
}
function reactor(col) {
  const m = M();
  m.box(0, 0, 0, 18, 18, 2, steel2);
  m.box(2, 2, 2, 14, 14, 3, col);
  m.sphere(9, 9, 7, 5.5, steel);
  m.box(7, 7, 11, 4, 4, 1, plasma, null, true);
  m.box(13, 3, 2, 3, 3, 16, dark); m.box(13, 3, 18, 3, 3, 1, '#FF7A30', null, true); // chaminé com boca quente
  m.box(3, 13, 5, 3, 3, 4, steel2); m.box(3, 13, 9, 3, 3, 1, orange, null, true);
  for (let i = 0; i < 3; i++) m.box(3 + i * 4, 2, 3, 2, 1, 1, '#FFE08A', null, true);
  return m;
}
function barracks(col) {
  const m = M();
  m.box(0, 0, 0, 22, 14, 2, steel2);
  m.box(1, 1, 2, 20, 12, 7, col, (x, y, z, w, d, h) => !(z === h - 1 && (x === 0 || x === w - 1 || y === 0 || y === d - 1)));
  m.box(1, 1, 8, 20, 12, 1, dark, (x, y) => (x + y) % 2 === 0);                   // telhado ondulado
  m.box(9, 13, 2, 4, 1, 5, dark); m.box(10, 13, 3, 2, 1, 3, glass, null, true);    // porta iluminada
  for (let i = 0; i < 5; i++) m.box(2 + i * 4, 0, 5, 2, 1, 1, '#FFE08A', null, true);
  m.box(18, 10, 9, 2, 2, 6, steel); m.box(18, 10, 15, 2, 2, 1, green, null, true); // mastro/sinal
  return m;
}
function tower(col) {
  const m = M();
  m.box(0, 0, 0, 10, 10, 3, steel2); m.box(2, 2, 3, 6, 6, 9, dark);
  m.box(1, 1, 12, 8, 8, 3, col); m.box(3, 3, 15, 4, 4, 2, steel2);
  m.box(7, 4, 13, 7, 2, 1, dark); m.box(7, 4, 14, 7, 2, 1, steel2);                // canhão duplo
  m.box(4, 4, 17, 2, 2, 1, '#FF4040', null, true);
  return m;
}
function wall(col, gate) {
  const m = M();
  m.box(0, 0, 0, 16, 4, 1, steel2);
  if (gate) { m.box(0, 0, 1, 3, 4, 7, col); m.box(13, 0, 1, 3, 4, 7, col); m.box(3, 1, 5, 10, 2, 1, dark); m.box(1, 1, 8, 1, 2, 1, orange, null, true); m.box(14, 1, 8, 1, 2, 1, orange, null, true); }
  else { m.box(0, 0, 1, 16, 4, 5, col, (x, y, z) => !(z === 4 && x % 4 === 2 && y > 0 && y < 3)); m.box(0, 1, 6, 16, 2, 1, steel2, (x) => x % 4 !== 2); }
  return m;
}
function nucleus(col) {
  const m = M();
  m.box(0, 0, 0, 30, 30, 3, steel2, (x, y) => Math.abs(x - 14.5) + Math.abs(y - 14.5) < 24);     // laje octogonal
  m.box(3, 3, 3, 24, 24, 3, col, (x, y) => Math.abs(x - 11.5) + Math.abs(y - 11.5) < 19);
  m.box(8, 8, 6, 14, 14, 10, col);                                                                   // torre central
  m.box(10, 10, 16, 10, 10, 2, steel2); m.cyl(15, 15, 18, 3.4, 6, steel); m.sphere(15, 15, 25, 3, plasma, true); // núcleo brilhante
  for (const [x, y] of [[4, 4], [22, 4], [4, 22], [22, 22]]) { m.box(x, y, 6, 4, 4, 8, dark); m.box(x + 1, y + 1, 14, 2, 2, 1, '#FFE08A', null, true); }
  for (let i = 0; i < 6; i++) { m.box(9 + i * 2, 7, 9, 1, 1, 1, '#FFE08A', null, true); m.box(7, 9 + i * 2, 11, 1, 1, 1, '#FFE08A', null, true); }
  m.box(14, 2, 6, 2, 6, 1, plasma, null, true); m.box(2, 14, 6, 6, 2, 1, plasma, null, true);      // calhas de energia
  return m;
}
function crystals(seed) {
  const m = M(); let r = seed;
  const rnd = () => { r = (r * 1103515245 + 12345) & 0x7fffffff; return r / 0x7fffffff; };
  for (let i = 0; i < 9; i++) { const x = Math.floor(rnd() * 12), y = Math.floor(rnd() * 12), h = 3 + Math.floor(rnd() * 7); const c = rnd() < 0.5 ? '#FF6A3D' : '#D64CFF'; m.box(x, y, 0, 2, 2, h, c, (a, b2, z) => !(z === h - 1 && (a + b2) % 2), true); m.box(x, y, 0, 2, 2, 1, dark); }
  return m;
}
function rocks(seed) {
  const m = M(); let r = seed; const rnd = () => { r = (r * 1103515245 + 12345) & 0x7fffffff; return r / 0x7fffffff; };
  for (let i = 0; i < 4; i++) m.sphere(3 + rnd() * 8, 3 + rnd() * 8, 0.5 + rnd(), 2 + rnd() * 2.5, ['#6E7682', '#5A616B', '#7E8794'][i % 3]);
  return m;
}
function wreck(col) {
  const m = M();
  m.box(0, 0, 0, 14, 3, 2, dark); m.box(0, 7, 0, 10, 3, 2, dark);
  m.box(1, 2, 2, 12, 6, 2, '#3A2F2A', (x, y, z) => !(z === 1 && (x + y) % 3 === 0));
  m.box(4, 3, 4, 5, 4, 2, '#2E2622', (x, y, z) => (x + y) % 2 === 0);
  m.box(6, 4, 3, 2, 2, 1, '#FF5A1A', null, true);                                  // brasa
  return m;
}
ARD.models = { tank, mech, harvester, infantry, drone, raider, refinery, reactor, barracks, tower, wall, nucleus, crystals, rocks, wreck };
})(globalThis.ARD = globalThis.ARD || {});
