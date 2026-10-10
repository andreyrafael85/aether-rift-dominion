/* Biblioteca de modelos voxel. Cada função recebe (cor do jogador, estilo da Raça) e devolve um Model.
   Eixo +x é a frente das unidades. Em produção, modelos podem vir de MagicaVoxel (.vox). */
(function (ARD) {
'use strict';
const M = () => new ARD.vox.Model();
const dark = '#2A2D33', steel = '#7A8290', steel2 = '#5E6671', glass = '#8FD8FF', rust = '#8A5A3A', orange = '#FF8C1A', magenta = '#D64CFF', plasma = '#FF6A3D', green = '#7FE3A1', yellow = '#F2C230', lamp = '#FFE08A';
const pal = (col, style) => style === 'erevane' ? { body: '#3B4049', acc: col, trim: yellow, light: magenta } : style === 'tessara' ? { body: '#DDD4C2', acc: col, trim: '#9A6B3F', light: green } : { body: col, acc: steel2, trim: steel, light: lamp };

// ---------- unidades ----------
function tank(col, style) {
  const p = pal(col, style); const m = M();
  m.box(0, 0, 0, 14, 3, 3, dark, (x, y, z) => !(z === 2 && (x % 3 === 1)));
  m.box(0, 7, 0, 14, 3, 3, dark, (x, y, z) => !(z === 2 && (x % 3 === 1)));
  m.box(1, 2, 2, 12, 6, 3, p.body); m.box(2, 3, 5, 9, 4, 1, p.acc);
  m.box(3, 3, 5, 6, 4, 3, p.body); m.box(4, 4, 8, 4, 2, 1, p.trim);
  m.box(9, 4, 6, 7, 2, 1, steel2); m.box(15, 4, 6, 2, 2, 1, dark);
  if (style === 'erevane') m.box(1, 2, 4, 12, 1, 1, p.trim);
  m.box(12, 3, 4, 1, 1, 1, lamp, null, true); m.box(12, 6, 4, 1, 1, 1, lamp, null, true); m.box(1, 4, 4, 1, 2, 1, '#FF4040', null, true);
  return m;
}
function mech(col, style) {
  const p = pal(col, style); const m = M();
  for (const y of [1, 8]) { m.box(3, y, 0, 5, 3, 1, dark); m.box(4, y, 1, 3, 3, 5, steel2); m.box(4, y + 1, 6, 3, 1, 2, p.body); }
  m.box(2, 1, 8, 9, 10, 6, p.body); m.box(3, 2, 14, 7, 8, 2, p.acc); m.box(5, 4, 16, 4, 4, 3, p.body);
  m.box(9, 5, 17, 1, 2, 1, glass, null, true);
  m.box(10, 0, 11, 1, 3, 3, steel2); m.box(11, 0, 11, 9, 3, 3, dark); m.box(10, 9, 11, 1, 3, 3, steel2); m.box(11, 9, 11, 9, 3, 3, dark);
  m.box(0, 3, 10, 2, 6, 3, rust); m.box(19, 1, 12, 1, 1, 1, orange, null, true); m.box(19, 10, 12, 1, 1, 1, orange, null, true);
  return m;
}
function harvester(col, style) {
  const p = pal(col, style); const m = M();
  for (const x of [1, 9]) for (const y of [0, 8]) m.cyl(x + 1.5, y + 1.5, 0, 1.6, 3, dark);
  m.box(0, 1, 2, 13, 8, 3, steel2); m.box(9, 1, 4, 4, 8, 5, p.body); m.box(12, 2, 6, 1, 6, 2, glass, null, true);
  m.box(0, 1, 4, 9, 8, 5, p.body, (x, y, z) => !(x > 0 && x < 8 && y > 0 && y < 7 && z > 2));
  for (let i = 0; i < 14; i++) { const x = 1 + (i * 7) % 7, y = 2 + (i * 5) % 6; m.box(x, y, 7, 1, 1, 1 + (i % 3), plasma, null, i % 4 === 0); }
  m.box(13, 3, 4, 1, 1, 1, lamp, null, true); m.box(13, 6, 4, 1, 1, 1, lamp, null, true);
  return m;
}
function infantry(col, style) {
  const p = pal(col, style); const m = M();
  m.box(1, 0, 0, 1, 1, 3, dark); m.box(1, 2, 0, 1, 1, 3, dark); m.box(0, 0, 3, 3, 3, 3, style === 'erevane' ? '#3B4049' : col);
  m.box(3, 1, 4, 3, 1, 1, steel2); m.box(1, 1, 6, 1, 1, 1, '#E8C9A0'); m.box(0, 0, 7, 3, 3, 1, style === 'erevane' ? col : steel2);
  m.box(2, 1, 6, 1, 1, 1, glass, null, true);
  return m;
}
function drone(col, style) {
  const p = pal(col, style); const m = M();
  m.box(2, 2, 2, 4, 4, 2, p.body); m.box(3, 3, 4, 2, 2, 1, p.acc);
  for (const [x, y] of [[0, 0], [6, 0], [0, 6], [6, 6]]) { m.box(x, y, 2, 2, 2, 1, dark); m.box(x - 1, y - 1, 3, 4, 4, 1, steel2, (a, b2) => (a === 0 || a === 3 || b2 === 0 || b2 === 3)); }
  m.box(3, 3, 1, 2, 2, 1, p.light, null, true);
  return m;
}
function support(col, style) { // suporte/hack: plataforma flutuante com antena parabólica
  const p = pal(col, style); const m = M();
  m.box(1, 1, 1, 8, 6, 2, p.body); m.box(2, 2, 3, 6, 4, 1, p.acc);
  m.box(4, 3, 4, 2, 2, 3, steel2); m.box(3, 2, 7, 4, 4, 1, steel, (x, y) => !(x > 0 && x < 3 && y > 0 && y < 3)); m.box(4, 3, 7, 2, 2, 1, green, null, true);
  m.box(9, 3, 2, 2, 2, 1, p.light, null, true); m.box(0, 2, 1, 1, 4, 1, dark);
  return m;
}
function raider(col, style) { // Sifonador (Erevane): baixo e angular, tanque de sifão
  const p = pal(col, style); const m = M();
  m.box(0, 1, 0, 12, 6, 2, dark); m.box(1, 0, 2, 10, 8, 3, p.body, (x, y, z) => !(z === 2 && (y === 0 || y === 7) && x > 7));
  m.box(8, 2, 5, 3, 4, 2, p.acc); m.box(11, 3, 5, 1, 2, 1, glass, null, true); m.box(0, 3, 5, 3, 2, 1, magenta, null, true); m.box(-2, 3, 3, 3, 2, 1, steel2);
  if (style === 'erevane') m.box(1, 1, 4, 7, 1, 1, yellow);
  return m;
}
function tug(col, style) { // Rebocador (Vehnar): caminhão pesado com guincho
  const p = pal(col, style); const m = M();
  for (const x of [1, 6, 11]) for (const y of [0, 8]) m.cyl(x + 1.5, y + 1.5, 0, 1.7, 3, dark);
  m.box(0, 1, 2, 15, 8, 3, p.body); m.box(10, 1, 5, 5, 8, 5, p.body); m.box(14, 2, 7, 1, 6, 2, glass, null, true);
  m.box(2, 3, 5, 6, 4, 2, steel2); m.box(0, 4, 5, 2, 2, 5, steel); m.box(-1, 4, 9, 4, 2, 1, dark); m.box(-2, 4, 8, 1, 2, 1, magenta, null, true);
  m.box(15, 3, 5, 1, 1, 1, lamp, null, true); m.box(15, 6, 5, 1, 1, 1, lamp, null, true);
  return m;
}
// ---------- elenco ampliado (3.0c) ----------
function flamer(col, style) { // Soldador: infantaria com tanque nas costas e bico de chama
  const p = pal(col, style); const m = infantry(col, style);
  m.box(-1, 0, 3, 1, 3, 4, rust); m.box(-1, 1, 7, 1, 1, 1, '#FF7A30', null, true); m.box(3, 1, 4, 4, 1, 1, dark); m.box(7, 1, 4, 1, 1, 1, '#FF9A3C', null, true);
  return m;
}
function sniper(col, style) { // Atirador: fuzil longo e luneta
  const m = infantry(col, style);
  m.box(3, 1, 4, 8, 1, 1, steel2); m.box(5, 1, 5, 2, 1, 1, dark); m.box(6, 1, 5, 1, 1, 1, glass, null, true);
  return m;
}
function buggy(col, style) { // Tratorzão: bugue leve com gaiola e metralhadora
  const p = pal(col, style); const m = M();
  for (const x of [1, 8]) for (const y of [0, 7]) m.cyl(x + 1.5, y + 1.5, 0, 1.6, 3, dark);
  m.box(1, 1, 2, 10, 7, 2, p.body); m.box(7, 2, 4, 3, 5, 2, p.acc); m.box(10, 3, 4, 1, 3, 1, glass, null, true);
  for (const [x, y] of [[2, 1], [2, 7], [6, 1], [6, 7]]) m.box(x, y, 4, 1, 1, 3, steel2); m.box(2, 1, 7, 5, 7, 1, steel2, (x, y) => x === 0 || x === 4 || y === 0 || y === 6);
  m.box(3, 3, 5, 2, 2, 2, dark); m.box(5, 3, 6, 4, 2, 1, steel2); m.box(11, 3, 3, 1, 1, 1, lamp, null, true); m.box(11, 5, 3, 1, 1, 1, lamp, null, true);
  return m;
}
function blade(col, style) { // Lâmina Rodante: cunha baixa com lâminas brilhantes
  const p = pal(col, style); const m = M();
  m.box(0, 1, 0, 12, 6, 1, dark); m.box(1, 0, 1, 10, 8, 2, p.body, (x, y, z) => !(x > 7 && (y === 0 || y === 7)));
  m.box(11, 1, 1, 3, 6, 1, steel, (x, y) => x === 2 ? y > 1 && y < 4 : true); m.box(11, 1, 2, 3, 6, 1, '#CFE6FF', (x, y) => x === 0 && (y === 0 || y === 5), true);
  m.box(4, 2, 3, 4, 4, 1, p.acc); m.box(7, 3, 3, 1, 2, 1, glass, null, true); m.box(0, 3, 2, 1, 2, 1, magenta, null, true);
  if (style === 'erevane') m.box(2, 1, 3, 7, 1, 1, yellow);
  return m;
}
function gnat(col, style) { // Mosquito: microdrone com asas
  const p = pal(col, style); const m = M();
  m.box(1, 1, 1, 3, 2, 2, p.body); m.box(4, 1, 1, 1, 2, 1, dark); m.box(0, 0, 2, 5, 1, 1, steel2, (x) => x !== 2); m.box(0, 3, 2, 5, 1, 1, steel2, (x) => x !== 2);
  m.box(2, 1, 0, 1, 2, 1, p.light, null, true);
  return m;
}
function anchor(col, style) { // Âncora: tripé com esfera e anel de estática
  const p = pal(col, style); const m = M();
  for (const [x, y] of [[0, 0], [6, 0], [3, 6]]) m.box(x, y, 0, 2, 2, 5, dark);
  m.box(2, 2, 4, 4, 4, 2, p.acc); m.sphere(4, 4, 8, 2.5, steel); m.box(3, 3, 11, 2, 2, 3, p.body); m.box(3, 3, 14, 2, 2, 1, magenta, null, true);
  for (const [x, y] of [[0, 3], [7, 3], [3, 0], [3, 7]]) m.box(x, y, 7, 1, 1, 1, magenta, null, true);
  return m;
}
function crane(col, style) { // Guindaste Armado: caminhão com lança e gancho
  const p = pal(col, style); const m = M();
  for (const x of [1, 6, 11]) for (const y of [0, 8]) m.cyl(x + 1.5, y + 1.5, 0, 1.7, 3, dark);
  m.box(0, 1, 2, 15, 8, 3, p.body); m.box(11, 1, 5, 4, 8, 5, p.body); m.box(15, 2, 7, 1, 6, 2, glass, null, true);
  m.box(2, 3, 5, 5, 4, 3, p.acc); m.box(3, 4, 8, 2, 2, 10, steel); m.box(3, 4, 17, 9, 2, 2, steel2); m.box(11, 4, 15, 1, 2, 2, dark); m.box(11, 4, 14, 1, 2, 1, yellow, null, true);
  m.box(15, 3, 5, 1, 1, 1, lamp, null, true); m.box(15, 6, 5, 1, 1, 1, lamp, null, true); m.box(1, 2, 5, 1, 6, 1, '#FF4040', null, true);
  return m;
}
function colossus(col, style) { // Colosso Cambiante: mech grande com placas orgânicas
  const m = mech(col, style); const p = pal(col, style);
  m.box(0, 0, 8, 2, 12, 7, p.acc, (x, y, z) => (y + z) % 2 === 0); m.box(11, 0, 8, 2, 12, 7, p.acc, (x, y, z) => (y + z) % 2 === 0);
  m.box(4, 4, 19, 6, 6, 2, p.body); m.box(6, 6, 21, 2, 2, 2, green, null, true);
  return m;
}
// ---------- partes giratórias (casco + torreta) ----------
function tankHull(col, style) {
  const p = pal(col, style); const m = M();
  m.box(0, 0, 0, 14, 3, 3, dark, (x, y, z) => !(z === 2 && (x % 3 === 1)));
  m.box(0, 7, 0, 14, 3, 3, dark, (x, y, z) => !(z === 2 && (x % 3 === 1)));
  m.box(1, 2, 2, 12, 6, 3, p.body); m.box(2, 3, 5, 9, 4, 1, p.acc);
  if (style === 'erevane') m.box(1, 2, 4, 12, 1, 1, p.trim);
  m.box(12, 3, 4, 1, 1, 1, lamp, null, true); m.box(12, 6, 4, 1, 1, 1, lamp, null, true); m.box(1, 4, 4, 1, 2, 1, '#FF4040', null, true);
  return m;
}
function tankTurret(col, style) {
  const p = pal(col, style); const m = M();
  m.box(0, 0, 0, 6, 4, 3, p.body); m.box(1, 1, 3, 4, 2, 1, p.trim); m.box(6, 1, 1, 7, 2, 1, steel2); m.box(12, 1, 1, 2, 2, 1, dark);
  m.pivot = { x: 3, y: 2 }; return m;
}
function towerBase(col, style) {
  const p = pal(col, style); const m = M();
  m.box(0, 0, 0, 10, 10, 3, steel2); m.box(2, 2, 3, 6, 6, 9, dark);
  if (style === 'erevane') m.box(2, 2, 8, 6, 1, 1, yellow);
  return m;
}
function towerTurret(col, style) {
  const p = pal(col, style); const m = M();
  m.box(0, 0, 0, 8, 8, 3, p.body); m.box(2, 2, 3, 4, 4, 2, p.acc); m.box(6, 3, 1, 7, 2, 1, dark); m.box(6, 3, 2, 7, 2, 1, steel2); m.box(3, 3, 5, 2, 2, 1, '#FF4040', null, true);
  m.pivot = { x: 4, y: 4 }; return m;
}
function bastionBase(col, style) {
  const p = pal(col, style); const m = M();
  m.box(0, 0, 0, 18, 18, 4, steel2); m.box(2, 2, 4, 14, 14, 8, p.body); m.box(1, 1, 12, 16, 16, 2, p.acc);
  for (const [x, y] of [[2, 2], [14, 2], [2, 14], [14, 14]]) m.box(x, y, 12, 2, 2, 1, orange, null, true);
  return m;
}
function bastionTurret(col, style) {
  const p = pal(col, style); const m = M();
  m.box(0, 0, 0, 10, 10, 5, dark); m.box(1, 1, 5, 8, 8, 2, p.body); m.box(8, 1, 3, 9, 2, 2, steel2); m.box(8, 7, 3, 9, 2, 2, steel2); m.box(16, 1, 3, 2, 2, 2, dark); m.box(16, 7, 3, 2, 2, 2, dark);
  m.box(4, 4, 7, 2, 2, 3, steel); m.box(4, 4, 10, 2, 2, 1, '#FF4040', null, true);
  m.pivot = { x: 5, y: 5 }; return m;
}
// ---------- estruturas ----------
function nucleus(col, style) {
  const p = pal(col, style); const m = M();
  m.box(0, 0, 0, 30, 30, 3, steel2, (x, y) => Math.abs(x - 14.5) + Math.abs(y - 14.5) < 24);
  m.box(3, 3, 3, 24, 24, 3, p.body, (x, y) => Math.abs(x - 11.5) + Math.abs(y - 11.5) < 19);
  m.box(8, 8, 6, 14, 14, 10, p.body); m.box(10, 10, 16, 10, 10, 2, p.acc); m.cyl(15, 15, 18, 3.4, 6, steel); m.sphere(15, 15, 25, 3, plasma, true);
  for (const [x, y] of [[4, 4], [22, 4], [4, 22], [22, 22]]) { m.box(x, y, 6, 4, 4, 8, dark); m.box(x + 1, y + 1, 14, 2, 2, 1, p.light, null, true); }
  for (let i = 0; i < 6; i++) { m.box(9 + i * 2, 7, 9, 1, 1, 1, lamp, null, true); m.box(7, 9 + i * 2, 11, 1, 1, 1, lamp, null, true); }
  m.box(14, 2, 6, 2, 6, 1, plasma, null, true); m.box(2, 14, 6, 6, 2, 1, plasma, null, true);
  if (style === 'erevane') { m.box(8, 8, 12, 14, 1, 1, yellow); m.box(8, 8, 12, 1, 14, 1, yellow); }
  return m;
}
function refinery(col, style) {
  const p = pal(col, style); const m = M();
  m.box(0, 0, 0, 26, 20, 2, steel2, (x, y) => !((x + y) % 7 === 0 && x > 1 && y > 1 && x < 24 && y < 18));
  m.box(2, 2, 2, 14, 12, 9, p.body); m.box(2, 2, 11, 14, 12, 1, p.acc); m.box(4, 4, 12, 10, 8, 1, dark);
  m.cyl(20.5, 6.5, 2, 3.4, 11, steel); m.cyl(20.5, 6.5, 13, 3.6, 1, p.acc); m.cyl(20.5, 14.5, 2, 3.4, 9, steel); m.cyl(20.5, 14.5, 11, 3.6, 1, p.acc);
  m.box(16, 6, 6, 4, 1, 1, dark); m.box(16, 14, 5, 4, 1, 1, dark); m.box(6, 15, 2, 8, 3, 3, dark); m.box(7, 16, 5, 6, 1, 1, plasma, null, true);
  for (let i = 0; i < 4; i++) m.box(3 + i * 3, 1, 4 + (i % 2) * 2, 2, 1, 1, p.light, null, true);
  m.box(9, 9, 13, 2, 2, 5, dark); m.box(9, 9, 18, 2, 2, 1, '#FF4040', null, true); m.box(18, 6, 13, 2, 1, 1, plasma, null, true); m.box(18, 14, 11, 2, 1, 1, plasma, null, true);
  if (style === 'erevane') m.box(2, 2, 8, 14, 1, 1, yellow);
  return m;
}
function reactor(col, style) {
  const p = pal(col, style); const m = M();
  m.box(0, 0, 0, 18, 18, 2, steel2); m.box(2, 2, 2, 14, 14, 3, p.body); m.sphere(9, 9, 7, 5.5, steel); m.box(7, 7, 11, 4, 4, 1, plasma, null, true);
  m.box(13, 3, 2, 3, 3, 16, dark); m.box(13, 3, 18, 3, 3, 1, '#FF7A30', null, true); m.box(3, 13, 5, 3, 3, 4, p.acc); m.box(3, 13, 9, 3, 3, 1, orange, null, true);
  for (let i = 0; i < 3; i++) m.box(3 + i * 4, 2, 3, 2, 1, 1, p.light, null, true);
  return m;
}
function barracks(col, style) {
  const p = pal(col, style); const m = M();
  m.box(0, 0, 0, 22, 14, 2, steel2); m.box(1, 1, 2, 20, 12, 7, p.body, (x, y, z, w, d, h) => !(z === h - 1 && (x === 0 || x === w - 1 || y === 0 || y === d - 1)));
  m.box(1, 1, 8, 20, 12, 1, dark, (x, y) => (x + y) % 2 === 0); m.box(9, 13, 2, 4, 1, 5, dark); m.box(10, 13, 3, 2, 1, 3, glass, null, true);
  for (let i = 0; i < 5; i++) m.box(2 + i * 4, 0, 5, 2, 1, 1, p.light, null, true);
  m.box(18, 10, 9, 2, 2, 6, steel); m.box(18, 10, 15, 2, 2, 1, green, null, true);
  if (style === 'erevane') m.box(1, 1, 6, 20, 1, 1, yellow);
  return m;
}
function factory(col, style) { // fábrica de veículos: galpão grande com guindaste e porta
  const p = pal(col, style); const m = M();
  m.box(0, 0, 0, 26, 22, 2, steel2); m.box(1, 1, 2, 24, 14, 9, p.body); m.box(1, 1, 11, 24, 14, 1, p.acc, (x) => x % 6 !== 5);
  m.box(1, 15, 2, 24, 6, 5, dark, (x, y, z) => !(y > 0 && y < 5 && z > 0 && x > 2 && x < 22)); // baia de saída
  m.box(3, 16, 2, 20, 1, 1, lamp, null, true);
  m.box(20, 3, 12, 3, 3, 10, steel); m.box(6, 3, 21, 18, 2, 1, steel2); m.box(6, 3, 20, 2, 2, 2, dark); m.box(22, 4, 22, 1, 1, 1, '#FF4040', null, true);
  for (let i = 0; i < 4; i++) m.box(3 + i * 6, 0, 6, 3, 1, 1, p.light, null, true);
  if (style === 'erevane') m.box(1, 1, 7, 24, 1, 1, yellow);
  return m;
}
function hangar(col, style) { // hangar de drones: pista com anel de pouso iluminado
  const p = pal(col, style); const m = M();
  m.box(0, 0, 0, 24, 24, 2, steel2); m.box(1, 1, 2, 10, 22, 8, p.body); m.box(1, 1, 10, 10, 22, 1, p.acc);
  m.box(12, 2, 2, 11, 20, 1, dark); m.cyl(17.5, 12, 3, 5, 1, p.acc); m.cyl(17.5, 12, 3, 3.6, 1, dark);
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; m.box(Math.round(17 + Math.cos(a) * 4.6), Math.round(11.5 + Math.sin(a) * 4.6), 4, 1, 1, 1, p.light, null, true); }
  m.box(2, 3, 10, 3, 3, 5, steel); m.box(2, 3, 15, 3, 3, 1, green, null, true);
  for (let i = 0; i < 3; i++) m.box(0, 3 + i * 6, 5, 1, 2, 1, p.light, null, true);
  return m;
}
function tower(col, style) {
  const p = pal(col, style); const m = M();
  m.box(0, 0, 0, 10, 10, 3, steel2); m.box(2, 2, 3, 6, 6, 9, dark); m.box(1, 1, 12, 8, 8, 3, p.body); m.box(3, 3, 15, 4, 4, 2, p.acc);
  m.box(7, 4, 13, 7, 2, 1, dark); m.box(7, 4, 14, 7, 2, 1, steel2); m.box(4, 4, 17, 2, 2, 1, '#FF4040', null, true);
  if (style === 'erevane') m.box(1, 1, 13, 8, 1, 1, yellow);
  return m;
}
function bastion(col, style) { // Bastião: torre dupla pesada
  const p = pal(col, style); const m = M();
  m.box(0, 0, 0, 18, 18, 4, steel2); m.box(2, 2, 4, 14, 14, 8, p.body); m.box(1, 1, 12, 16, 16, 2, p.acc);
  m.box(4, 4, 14, 10, 10, 5, dark); m.box(5, 5, 19, 8, 8, 2, p.body);
  m.box(12, 5, 17, 9, 2, 2, steel2); m.box(12, 11, 17, 9, 2, 2, steel2); m.box(20, 5, 17, 2, 2, 2, dark); m.box(20, 11, 17, 2, 2, 2, dark);
  for (const [x, y] of [[2, 2], [14, 2], [2, 14], [14, 14]]) m.box(x, y, 12, 2, 2, 1, orange, null, true);
  m.box(8, 8, 21, 2, 2, 3, steel); m.box(8, 8, 24, 2, 2, 1, '#FF4040', null, true);
  return m;
}
function nodule(col, style) { // Nódulo de Avanço: pilar com anel emissor de território
  const p = pal(col, style); const m = M();
  m.box(0, 0, 0, 12, 12, 2, steel2); m.cyl(6, 6, 2, 3.5, 2, p.body); m.cyl(6, 6, 4, 2, 10, dark);
  m.cyl(6, 6, 14, 4, 1, p.acc); m.cyl(6, 6, 15, 2.5, 1, p.light, true); m.box(5, 5, 16, 2, 2, 4, steel); m.box(5, 5, 20, 2, 2, 1, '#FF4040', null, true);
  for (const [x, y] of [[1, 1], [9, 1], [1, 9], [9, 9]]) m.box(x, y, 2, 2, 2, 2, p.acc);
  return m;
}
function lab(col, style) { // Laboratório: cúpula com antena e anéis
  const p = pal(col, style); const m = M();
  m.box(0, 0, 0, 24, 20, 2, steel2); m.box(2, 2, 2, 20, 16, 5, p.body); m.box(2, 2, 7, 20, 16, 1, p.acc);
  m.sphere(12, 10, 8, 6, glass, false); m.sphere(12, 10, 8, 4.5, dark); m.box(11, 9, 12, 2, 2, 2, green, null, true);
  m.box(19, 3, 8, 2, 2, 10, steel); m.box(17, 1, 18, 6, 6, 1, steel2, (x, y) => !(x > 0 && x < 5 && y > 0 && y < 5)); m.box(19, 3, 18, 2, 2, 1, green, null, true);
  for (let i = 0; i < 5; i++) m.box(3 + i * 4, 1, 4, 2, 1, 1, p.light, null, true);
  if (style === 'erevane') m.box(2, 2, 5, 20, 1, 1, yellow);
  return m;
}
function wall(col, style, gate) {
  const p = pal(col, style); const m = M();
  m.box(0, 0, 0, 16, 4, 1, steel2);
  if (gate) { m.box(0, 0, 1, 3, 4, 7, p.body); m.box(13, 0, 1, 3, 4, 7, p.body); m.box(3, 1, 5, 10, 2, 1, dark); m.box(1, 1, 8, 1, 2, 1, orange, null, true); m.box(14, 1, 8, 1, 2, 1, orange, null, true); }
  else { m.box(0, 0, 1, 16, 4, 5, p.body, (x, y, z) => !(z === 4 && x % 4 === 2 && y > 0 && y < 3)); m.box(0, 1, 6, 16, 2, 1, p.acc, (x) => x % 4 !== 2); }
  return m;
}
// ---------- cenário ----------
function crystals(seed) {
  const m = M(); let r = (seed | 0) + 1; const rnd = () => { r = (r * 1103515245 + 12345) & 0x7fffffff; return r / 0x7fffffff; };
  for (let i = 0; i < 9; i++) { const x = Math.floor(rnd() * 12), y = Math.floor(rnd() * 12), h = 3 + Math.floor(rnd() * 7); const c = rnd() < 0.5 ? plasma : magenta; m.box(x, y, 0, 2, 2, h, c, (a, b2, z) => !(z === h - 1 && (a + b2) % 2), true); m.box(x, y, 0, 2, 2, 1, dark); }
  return m;
}
function ore(seed) { // minério de liga: rochas com veios metálicos
  const m = M(); let r = (seed | 0) + 7; const rnd = () => { r = (r * 1103515245 + 12345) & 0x7fffffff; return r / 0x7fffffff; };
  for (let i = 0; i < 5; i++) m.sphere(3 + rnd() * 8, 3 + rnd() * 8, 0.5 + rnd(), 2 + rnd() * 2.2, ['#6E7682', '#5A616B', '#7E8794'][i % 3]);
  for (let i = 0; i < 10; i++) m.set(Math.floor(2 + rnd() * 10), Math.floor(2 + rnd() * 10), Math.floor(1 + rnd() * 3), '#AFC2D6', i % 3 === 0);
  return m;
}
function datashards(seed) { // fragmentos de dados: lâminas verdes flutuando sobre um pedestal
  const m = M(); let r = (seed | 0) + 3; const rnd = () => { r = (r * 1103515245 + 12345) & 0x7fffffff; return r / 0x7fffffff; };
  m.cyl(6, 6, 0, 4, 1, dark);
  for (let i = 0; i < 6; i++) { const x = Math.floor(2 + rnd() * 8), y = Math.floor(2 + rnd() * 8); m.box(x, y, 2 + Math.floor(rnd() * 3), 1, 2, 3 + Math.floor(rnd() * 4), green, null, true); }
  return m;
}
// 4.0b — props de território por Raça (só visual): a "geografia" dos mundos natais entra no mapa
function propRnd(seed) { let r = (seed | 0) * 7919 + 31; return () => { r = (r * 1103515245 + 12345) & 0x7fffffff; return r / 0x7fffffff; }; }
const props = {
  vehnar(seed) { const m = M(); const rnd = propRnd(seed); const h = 7 + Math.floor(rnd() * 4); m.cyl(3, 3, 0, 1.6, h, rust); m.cyl(3, 3, h, 1.9, 1, dark); m.box(2, 2, h + 1, 2, 2, 1, orange, null, true); if (rnd() > 0.5) m.box(0, 5, 0, 6, 2, 2, steel2); return m; },
  erevane(seed) { const m = M(); const rnd = propRnd(seed); const h = 6 + Math.floor(rnd() * 5); for (let z = 0; z < h; z++) { const w = Math.max(1, Math.round(4 - z * 3.2 / h)); m.box(3 - Math.floor(w / 2), 3 - Math.floor(w / 2), z, w, w, 1, z > h * 0.7 ? '#cfeeff' : '#9fd8f0'); } m.box(3, 3, h, 1, 1, 1, '#aef7e8', null, true); if (rnd() > 0.5) m.box(5, 1, 0, 2, 2, 3, '#9fd8f0'); return m; },
  tessara(seed) { const m = M(); const rnd = propRnd(seed); const h = 5 + Math.floor(rnd() * 5); m.box(3, 3, 0, 1, 1, h, '#2f7a49'); m.box(2, 2, h, 3, 3, 2, '#e6b85c', (x, y, z) => !(x === 1 && y === 1 && z === 1), true); m.box(2, 3, 2, 1, 1, 1, '#55e68a'); m.box(4, 3, 3, 1, 1, 1, '#55e68a'); if (rnd() > 0.4) m.box(0, 5, 0, 2, 1, 3, '#2f7a49'); return m; },
  quorith(seed) { const m = M(); const rnd = propRnd(seed); const h = 6 + Math.floor(rnd() * 5); for (let z = 0; z < h; z++) { const r = z < h / 2 ? 1 + z * 3 / h : 2.5 - (z - h / 2) * 3 / h; m.box(3 - Math.round(r), 3 - Math.round(r), z, Math.round(r) * 2 + 1, Math.round(r) * 2 + 1, 1, z > h * 0.6 ? '#d4b8ff' : '#b388ff', (x, y, zz, w, d) => Math.abs(x - (w - 1) / 2) + Math.abs(y - (d - 1) / 2) <= r); } m.box(3, 3, Math.floor(h / 2), 1, 1, 1, '#ffffff', null, true); if (rnd() > 0.5) m.box(0, 0, 0, 2, 2, 3, '#b388ff'); return m; },
  vorag(seed) { const m = M(); const rnd = propRnd(seed); m.sphere(2.5, 2.5, 1.5, 2, '#e8dcc8'); m.sphere(5.5, 4, 1.2, 1.6, '#e8dcc8'); m.sphere(3.5, 5.5, 1, 1.3, '#d8ccb8'); m.box(6, 1, 0, 1, 1, 5, '#e8dcc8'); m.box(3, 3, 3, 1, 1, 1, '#e6455a', null, true); return m; },
};
function rocks(seed) { const m = M(); let r = (seed | 0) + 11; const rnd = () => { r = (r * 1103515245 + 12345) & 0x7fffffff; return r / 0x7fffffff; }; for (let i = 0; i < 4; i++) m.sphere(3 + rnd() * 8, 3 + rnd() * 8, 0.5 + rnd(), 2 + rnd() * 2.5, ['#6E7682', '#5A616B', '#7E8794'][i % 3]); return m; }
function ruin(seed) { // ruínas da civilização pré-Colapso: pilares quebrados e um arco
  const m = M(); let r = (seed | 0) + 19; const rnd = () => { r = (r * 1103515245 + 12345) & 0x7fffffff; return r / 0x7fffffff; };
  const stone = ['#9A9CA4', '#7E8088', '#B0B2BA'];
  m.box(0, 0, 0, 14, 10, 1, '#6B6E76', (x, y) => rnd() > 0.15);
  for (let i = 0; i < 3; i++) { const x = 1 + Math.floor(rnd() * 11), y = 1 + Math.floor(rnd() * 7), h = 3 + Math.floor(rnd() * 7); m.box(x, y, 1, 2, 2, h, stone[i % 3], (a, b2, z) => !(z === h - 1 && rnd() < 0.5)); }
  m.box(2, 8, 1, 2, 2, 7, stone[0]); m.box(10, 8, 1, 2, 2, 7, stone[0]); m.box(2, 8, 8, 10, 2, 1, stone[1], (x) => x !== 5);
  if (rnd() < 0.6) m.box(6, 3, 1, 1, 1, 2, green, null, true);
  return m;
}
function crate() { const m = M(); m.box(0, 0, 0, 6, 6, 5, '#B8862B'); m.box(0, 2, 0, 6, 2, 5, '#6E4F16'); m.box(2, 0, 0, 2, 6, 5, '#6E4F16'); m.box(2, 2, 5, 2, 2, 1, yellow, null, true); return m; }
function wreck() { const m = M(); m.box(0, 0, 0, 14, 3, 2, dark); m.box(0, 7, 0, 10, 3, 2, dark); m.box(1, 2, 2, 12, 6, 2, '#3A2F2A', (x, y, z) => !(z === 1 && (x + y) % 3 === 0)); m.box(4, 3, 4, 5, 4, 2, '#2E2622', (x, y) => (x + y) % 2 === 0); m.box(6, 4, 3, 2, 2, 1, '#FF5A1A', null, true); return m; }

// mapeamento def da simulação → modelo
const BY_DEF = {
  nucleo: nucleus, reator: reactor, refinaria: refinery, quartel: barracks, fabrica: factory, hangar: hangar, torre: tower, bastiao: bastion, nodulo: nodule, laboratorio: lab,
  muro: (c, s) => wall(c, s, false), portao: (c, s) => wall(c, s, true),
  coletor: harvester, infantaria: infantry, veiculo: tank, drone: drone, suporte: support, pirata: raider, pirata_vehnar: tug,
  veiculo_hull: tankHull, veiculo_turret: tankTurret, torre_base: towerBase, torre_turret: towerTurret, bastiao_base: bastionBase, bastiao_turret: bastionTurret,
  soldador: flamer, guindaste: crane, tratorzao: buggy, prensa: mech, atirador: sniper, lamina: blade, mosquito: gnat, ancora: anchor, quimera: infantry, esporo: drone, molde: support, colosso: colossus,
};
// defs que se desenham em duas partes: casco na direção do corpo e torreta na direção da mira; z = altura da torreta em voxels
const PARTS = { veiculo: { hull: 'veiculo_hull', turret: 'veiculo_turret', z: 6 }, torre: { hull: 'torre_base', turret: 'torre_turret', z: 12 }, bastiao: { hull: 'bastiao_base', turret: 'bastiao_turret', z: 14 } };
ARD.models = { props, PARTS, flamer, sniper, buggy, blade, gnat, anchor, crane, colossus, tankHull, tankTurret, towerBase, towerTurret, bastionBase, bastionTurret, tank, mech, harvester, infantry, drone, support, raider, tug, refinery, reactor, barracks, factory, hangar, tower, bastion, nodule, lab, wall, nucleus, crystals, ore, datashards, rocks, ruin, crate, wreck, BY_DEF };
})(globalThis.ARD = globalThis.ARD || {});
