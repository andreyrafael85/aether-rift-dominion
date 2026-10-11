/* Aether Rift: Dominion — simulação determinística (beta 0.1)
   Comandos entram, estado sai. Sem DOM. Roda em Node e no navegador. */
(function (ARD) {
'use strict';

const TICK = 0.1;
const WORLD = 3200;
const CX = WORLD / 2, CY = WORLD / 2;
const RIFT_R = 170;
const PLAYER_COLORS = ['#FF8C1A', '#38D1E0', '#B98BFF', '#7FE3A1'];
// 4.1a: tons por Raça (o Hangar escolhe um deles); a sim distribui sem repetir tons próximos — igual em todos os clientes
const RACE_SHADES = {
  vehnar:  ['#FF7733', '#FFB13D', '#E8562A', '#FFCF6E', '#C9762C', '#FF9A5C'],
  erevane: ['#33FFD0', '#38B8FF', '#7CF2FF', '#1FC2A0', '#9AD8FF', '#5EEFB0'],
  tessara: ['#55E68A', '#A4E84E', '#2FBF71', '#D2F27A', '#4FD1A5', '#86C93F'],
  quorith: ['#B388FF', '#8C6BFF', '#D9B8FF', '#7A5CE6', '#E0A8FF', '#9FA0FF'],
  vorag:   ['#E6455A', '#FF6B4A', '#C2304A', '#FF8A8A', '#A3203A', '#FF5A8A'],
};
function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function colorDist(a, b) { const x = hexRgb(a), y = hexRgb(b); return Math.sqrt((x[0] - y[0]) ** 2 + (x[1] - y[1]) ** 2 + (x[2] - y[2]) ** 2); }
function assignColors(pcs) { const out = []; pcs.forEach((pc, i) => { const shades = RACE_SHADES[pc.faction] || PLAYER_COLORS; const want = pc.color && /^#[0-9a-fA-F]{6}$/.test(pc.color) ? [pc.color] : []; let pick = null;
  for (const c of want.concat(shades)) if (out.every(o => colorDist(o, c) >= 80)) { pick = c; break; } out.push(pick || PLAYER_COLORS[i % PLAYER_COLORS.length]); }); return out; }
const NAV = 32, NW = WORLD / NAV;          // grade de navegação 100×100
const TILE = 64, TILES = WORLD / TILE;      // grade de exploração 50×50
const DX8 = [1, 1, 0, -1, -1, -1, 0, 1], DY8 = [0, 1, 1, 1, 0, -1, -1, -1];
const BIOMES = ['gelo', 'rocha', 'tundra', 'basalto'];

// Matemática determinística: só +, -, *, / e sqrt (exatos em IEEE-754), para que Chrome, Firefox e Safari calculem o mesmo
// resultado bit a bit. Math.sin/cos/atan2/hypot variam entre motores JS e dessincronizavam o multiplayer entre navegadores diferentes.
const DM = (() => {
  const PI = Math.PI, TWO_PI = 2 * PI, HALF_PI = PI / 2, SQRT3 = Math.sqrt(3);
  function sin(x) {
    x = x - TWO_PI * Math.floor((x + PI) / TWO_PI); // [-PI, PI)
    if (x > HALF_PI) x = PI - x; else if (x < -HALF_PI) x = -PI - x; // [-PI/2, PI/2]
    const x2 = x * x;
    return x * (1 + x2 * (-1 / 6 + x2 * (1 / 120 + x2 * (-1 / 5040 + x2 * (1 / 362880 + x2 * (-1 / 39916800 + x2 * (1 / 6227020800 + x2 * (-1 / 1307674368000))))))));
  }
  function cos(x) { return sin(x + HALF_PI); }
  function atan(t) {
    const neg = t < 0; if (neg) t = -t; const inv = t > 1; if (inv) t = 1 / t;
    let add = 0; if (t > 0.2679491924311227) { t = (t * SQRT3 - 1) / (t + SQRT3); add = PI / 6; }
    const t2 = t * t; let r = t * (1 + t2 * (-1 / 3 + t2 * (1 / 5 + t2 * (-1 / 7 + t2 * (1 / 9 + t2 * (-1 / 11 + t2 * (1 / 13 + t2 * (-1 / 15))))))));
    r += add; if (inv) r = HALF_PI - r; return neg ? -r : r;
  }
  function atan2(y, x) { if (x > 0) return atan(y / x); if (x < 0) return y >= 0 ? atan(y / x) + PI : atan(y / x) - PI; return y > 0 ? HALF_PI : y < 0 ? -HALF_PI : 0; }
  function hypot(x, y) { return Math.sqrt(x * x + y * y); }
  return { sin, cos, atan2, hypot, atan };
})();
const FACTIONS = {
  vehnar: {
    id: 'vehnar', name: 'Consórcio Vehnar', short: 'Vehnar',
    tagline: 'Eficiência industrial. Linhas de Montagem, Lotes e Reatores que fumegam.',
    pirateName: 'Rebocador', lineBonus: true, lotes: true, smoke: true, structNeutralVsVehicle: true,
    stolenMult: 1.0, cloak: {}, jumps: 1, jumpCostFrac: 0.4,
    superKey: 'fundicao', superName: 'Fundição Orbital',
    superDesc: 'Derruba um Bastião pré-construído em território próprio (3 s). Custa 300 Dados + 200 Plasma.',
  },
  erevane: {
    id: 'erevane', name: 'Erevane', short: 'Erevane',
    tagline: 'Furtividade e roubo. Nódulos camuflados, Sifonadores e recursos roubados limpos.',
    pirateName: 'Sifonador', lineBonus: false, lotes: false, smoke: false, structNeutralVsVehicle: false,
    stolenMult: 1.2, cloak: { nodulo: true, infantaria: true, pirata: true, atirador: true }, jumps: 2, jumpCostFrac: 0.2,
    superKey: 'blecaute', superName: 'Blecaute',
    superDesc: 'Sensores e energia inimigos a zero por 20 s; suas unidades +30% de velocidade. Custa 300 Dados + 200 Plasma.',
  },
  tessara: {
    id: 'tessara', name: 'Tessara', short: 'Tessara',
    tagline: 'Tecnologia adaptativa. Unidades ganham Traços contra o que combatem, o Núcleo faz Fotossíntese e o Salto Evolutivo muda a batalha.',
    pirateName: 'Enxerto', lineBonus: false, lotes: false, smoke: false, structNeutralVsVehicle: false,
    stolenMult: 1.0, cloak: {}, jumps: 1, jumpCostFrac: 0.3, photosynthesis: true, traits: true,
    superKey: 'salto', superName: 'Salto Evolutivo',
    superDesc: 'Por 45 s, todas as suas unidades causam +35% de dano. Custa 300 Dados + 200 Plasma.',
  },
  // 4.0c — Coro Quorith: Elo de Sincronia (acorde entre aliados próximos), pactos pela metade, Ressonador que desafina torres
  quorith: {
    id: 'quorith', name: 'Coro Quorith', short: 'Quorith',
    tagline: 'Mente-colmeia de cristal ressonante. Vozes em sincronia: cada aliado perto afina o acorde (Elo), pactos custam metade e rendem o dobro.',
    pirateName: 'Ressonador', names: { coletor: 'Afinador', pirata: 'Ressonador' }, lineBonus: false, lotes: false, smoke: false, structNeutralVsVehicle: false,
    stolenMult: 1.0, cloak: {}, jumps: 1, jumpCostFrac: 0.3, elo: { range: 90, dmg: 0.035, armor: 0.025, cap: 3 }, pactHalf: true, silence: 110,
    superKey: 'unissono', superName: 'Uníssono',
    superDesc: 'Por 20 s, todo o exército conta como acorde cheio (Elo máximo) e recebe 25% menos dano. Custa 300 Dados + 200 Plasma.',
  },
  // 4.0c — Prole Vorag: unidades baratas que eclodem em pares, Fome fora do território, Carniceiro que devora carcaças e Nódulos
  vorag: {
    id: 'vorag', name: 'Prole Vorag', short: 'Vorag',
    tagline: 'Enxame biológico voraz. Barato, rápido e sempre com fome: Crias eclodem em pares e o Carniceiro devora carcaças e Nódulos.',
    pirateName: 'Carniceiro', names: { coletor: 'Semeador', pirata: 'Carniceiro' }, lineBonus: false, lotes: false, smoke: false, structNeutralVsVehicle: false,
    stolenMult: 1.0, cloak: {}, jumps: 1, jumpCostFrac: 0.35, hunger: { def: 'cria', rate: 0.6, floor: 0.4 }, devour: { wreck: 40, wreckMult: 1.5, nodDmg: 30, nodGain: 8, range: 40 },
    superKey: 'eclosao', superName: 'Eclosão',
    superDesc: 'Ovos irrompem num ponto visível e liberam 8 Crias por 30 s. Custa 300 Dados + 200 Plasma.',
  },
};

const BUILDINGS = {
  nucleo:      { name: 'Núcleo de Domínio', key: '', hp: 8000, r: 38, cost: {}, buildTime: 0, energyProd: 60, energyUse: 0, sensor: 420, detect: 120, deposit: true, territory: 380, produces: ['coletor'], desc: 'Centro da colônia. Produz coletores. Se cair, você é eliminado.' },
  reator:      { name: 'Reator', key: 'R', hp: 700, r: 20, cost: { minerio: 120 }, buildTime: 12, energyProd: 35, plasmaBurn: 0.3, energyUse: 0, sensor: 120, module: { name: 'Câmara de Fusão', era: 2, cost: { minerio: 120, plasma: 40 }, time: 15, desc: '+60% de energia neste Reator, sem queimar mais Plasma.' }, desc: '+35 de energia queimando 0,3 Plasma/s. Vehnar: emite Fumaça visível a todos.' },
  refinaria:   { name: 'Refinaria', key: 'F', hp: 1000, r: 24, cost: { minerio: 150 }, buildTime: 15, energyUse: 6, sensor: 140, deposit: true, desc: 'Ponto de entrega perto dos nós. Alvo de Sifão.' },
  quartel:     { name: 'Quartel Orbital', key: 'Q', hp: 1150, r: 26, cost: { minerio: 200 }, buildTime: 18, energyUse: 8, sensor: 140, module: { name: 'Academia', era: 2, needs: ['laboratorio'], cost: { minerio: 160, plasma: 60, dados: 30 }, time: 20, desc: 'A infantaria deste Quartel já sai Veterana (★): +10% de dano e −7% de dano recebido.' }, produces: ['infantaria', 'suporte', 'pirata'], desc: 'Produz Infantaria, Suporte/Hack e Piratas.' },
  fabrica:     { name: 'Fábrica de Veículos', key: 'V', era: 2, hp: 1300, r: 28, cost: { minerio: 300, plasma: 60 }, buildTime: 22, energyUse: 12, sensor: 140, produces: ['veiculo'], desc: 'Produz Veículos Pesados.' },
  hangar:      { name: 'Hangar de Drones', key: 'H', era: 2, hp: 1150, r: 26, cost: { minerio: 280, plasma: 60 }, buildTime: 22, energyUse: 12, sensor: 160, produces: ['drone'], desc: 'Produz Drones Aéreos.' },
  torre:       { name: 'Torre de Defesa', key: 'T', hp: 1100, r: 16, cost: { minerio: 180, plasma: 40 }, buildTime: 14, energyUse: 10, sensor: 260, detect: 140, weapon: 'obus', module: { name: 'Bateria Pesada', era: 3, cost: { minerio: 150, plasma: 60 }, time: 15, desc: '+40% de vida e +30% de dano nesta Torre.' }, desc: 'Forte vs Infantaria e Drones. Detecta camuflagem em 140.' },
  nodulo:      { name: 'Nódulo de Avanço', key: 'N', hp: 650, r: 16, cost: { minerio: 120, plasma: 20 }, buildTime: 10, energyUse: 4, sensor: 260, territory: 320, desc: 'Reclama território em 320 e libera nós para coleta automática. Pode ser colocado até 650 de qualquer estrutura sua.' },
  laboratorio: { name: 'Laboratório', key: 'L', era: 2, hp: 900, r: 24, cost: { minerio: 220, plasma: 60, dados: 40 }, buildTime: 20, energyUse: 10, sensor: 140, desc: 'Pesquisas e superarma, pagas com Fragmentos de Dados.' },
  muro:        { name: 'Muro', key: 'M', hp: 450, r: 8, cost: { minerio: 20 }, buildTime: 3, energyUse: 0, sensor: 50, wall: true, desc: 'Barreira barata. Arraste para desenhar uma linha. Bloqueia unidades e absorve tiros.' },
  portao:      { name: 'Portão', key: 'G', hp: 600, r: 8, cost: { minerio: 40 }, buildTime: 4, energyUse: 0, sensor: 60, wall: true, gate: true, desc: 'Trecho de muro que suas unidades atravessam. Inimigos precisam derrubá-lo.' },
  bastiao:     { name: 'Bastião', key: '', hp: 2200, r: 24, cost: {}, buildTime: 3, energyUse: 12, sensor: 300, detect: 160, weapon: 'bombarda', desc: 'Fortaleza da Fundição Orbital.' },
};

const UNITS = {
  coletor:    { name: 'Coletor', key: 'C', cls: 'civ', hp: 90, r: 7, speed: 85, cost: { minerio: 60 }, time: 8, energyUse: 1, capacity: 50, harvestRate: 12, sensor: 110, desc: 'Coleta automaticamente nós no seu território e entrega na Refinaria ou Núcleo mais próximo.' },
  infantaria: { name: 'Infantaria Orbital', key: 'I', cls: 'inf', hp: 120, r: 7, speed: 90, cost: { minerio: 50 }, time: 6, energyUse: 1, weapon: 'fuzil', sensor: 160, desc: 'Forte vs Drones e Suporte. Fraca vs Veículos e Estruturas.' },
  veiculo:    { name: 'Veículo Pesado', key: 'V', cls: 'vei', hp: 420, r: 12, speed: 65, cost: { minerio: 160, plasma: 40 }, time: 12, energyUse: 3, weapon: 'canhao', sensor: 170, turret: true, desc: 'Forte vs Infantaria e Estruturas. Fraco vs Drones e Suporte.' },
  drone:      { name: 'Drone Aéreo', key: 'D', cls: 'dro', hp: 160, r: 8, speed: 150, cost: { minerio: 120, plasma: 50 }, time: 10, energyUse: 2, flying: true, weapon: 'metralha', sensor: 220, desc: 'Forte vs Veículos e Suporte. Fraco vs Infantaria e Estruturas. Sobrevoa a Fenda.' },
  suporte:    { name: 'Suporte / Hack', key: 'S', era: 2, needs: ['laboratorio'], cls: 'sup', hp: 100, r: 8, speed: 80, cost: { minerio: 90, dados: 20 }, time: 9, energyUse: 2, weapon: 'pulso', sensor: 200, desc: 'Forte vs Veículos e Estruturas, e os atrasa. Fraco vs Infantaria e Drones.' },
  pirata:     { name: 'Pirata de Extração', key: 'P', cls: 'sup', hp: 140, r: 9, speed: 100, cost: { minerio: 120, plasma: 30 }, time: 10, energyUse: 2, sensor: 180, siphonRange: 46, siphonRate: 7, siphonMax: 40, cargoCap: 300, desc: 'Sifona Refinarias e Reatores inimigos por até 40 s. Erevane: camuflado e +20% no roubo. Vehnar: Rebocador, lento e resistente, carrega 2x.' },
  // --- Vehnar
  soldador:   { name: 'Soldador', key: 'O', cls: 'inf', hp: 170, r: 8, speed: 75, cost: { minerio: 90, plasma: 15 }, time: 8, energyUse: 1, weapon: 'chama', sensor: 150, faction: 'vehnar', desc: 'Lança-chamas de curto alcance com dano em área. Devastador contra infantaria; fraco contra veículos.' },
  guindaste:  { name: 'Guindaste Armado', key: 'U', era: 2, cls: 'sup', hp: 320, r: 11, speed: 60, cost: { minerio: 180, plasma: 40 }, time: 12, energyUse: 3, sensor: 170, faction: 'vehnar', heal: { range: 90, unit: 4, building: 9 }, desc: 'Sem armas. Repara unidades e estruturas suas por perto, continuamente.' },
  tratorzao:  { name: 'Tratorzão', key: 'T', cls: 'vei', hp: 220, r: 10, speed: 135, cost: { minerio: 110, plasma: 20 }, time: 8, energyUse: 2, weapon: 'metralha', sensor: 320, faction: 'vehnar', desc: 'Veículo leve e rápido de reconhecimento, com sensores longos e metralhadora.' },
  prensa:     { name: 'Prensa', key: 'R', era: 3, cls: 'vei', hp: 900, r: 15, speed: 50, cost: { minerio: 320, plasma: 80 }, time: 18, energyUse: 5, weapon: 'prensa', sensor: 170, faction: 'vehnar', desc: 'Mech bípede de cerco: canhões duplos com grande área. Lento e caro.' },
  // --- Erevane
  atirador:   { name: 'Atirador de Fenda', key: 'A', era: 2, cls: 'inf', hp: 100, r: 7, speed: 85, cost: { minerio: 100, dados: 10 }, time: 9, energyUse: 1, weapon: 'fuzil_longo', sensor: 260, faction: 'erevane', desc: 'Camuflado quando parado. Tiro longo e letal contra infantaria e suporte; quase inútil contra estruturas.' },
  lamina:     { name: 'Lâmina Rodante', key: 'L', cls: 'vei', hp: 300, r: 11, speed: 145, cost: { minerio: 140, plasma: 30 }, time: 10, energyUse: 2, weapon: 'laminas', sensor: 180, faction: 'erevane', desc: 'Veículo baixo e rápido de ataque corpo a corpo. Bata e fuja.' },
  mosquito:   { name: 'Mosquito', key: 'M', cls: 'dro', hp: 65, r: 5, speed: 175, cost: { minerio: 45, plasma: 15 }, time: 4, energyUse: 1, flying: true, weapon: 'ferrao', sensor: 200, faction: 'erevane', desc: 'Microdrone barato e frágil. Em enxame, pica veículos e suporte.' },
  ancora:     { name: 'Âncora', key: 'N', era: 2, needs: ['laboratorio'], cls: 'sup', hp: 160, r: 9, speed: 70, cost: { minerio: 140, plasma: 30, dados: 20 }, time: 11, energyUse: 3, sensor: 200, faction: 'erevane', aura: { cloak: 110 }, desc: 'Sem armas. Campo de Estática: suas unidades a até 110 dela ficam camufladas.' },
  // --- Tessara
  quimera:    { name: 'Quimera', key: 'I', cls: 'inf', hp: 140, r: 7, speed: 88, cost: { minerio: 55 }, time: 6, energyUse: 1, weapon: 'fuzil', sensor: 170, faction: 'tessara', desc: 'Infantaria adaptativa. Ganha Traços contra as classes que mais combate.' },
  esporo:     { name: 'Esporo-sentinela', key: 'E', cls: 'dro', hp: 90, r: 6, speed: 160, cost: { minerio: 70, plasma: 20 }, time: 6, energyUse: 1, flying: true, weapon: 'ferrao', sensor: 330, faction: 'tessara', desc: 'Drone de reconhecimento com sensores muito longos.' },
  molde:      { name: 'Molde', key: 'O', era: 2, needs: ['laboratorio'], cls: 'sup', hp: 150, r: 9, speed: 75, cost: { minerio: 130, plasma: 20, dados: 20 }, time: 10, energyUse: 2, sensor: 200, faction: 'tessara', aura: { buff: 100 }, desc: 'Sem armas. Suas unidades a até 100 dele causam +15% de dano.' },
  colosso:    { name: 'Colosso Cambiante', key: 'C', era: 3, cls: 'vei', hp: 1150, r: 16, speed: 50, cost: { minerio: 320, plasma: 80, dados: 25 }, time: 20, energyUse: 6, weapon: 'colosso', sensor: 180, faction: 'tessara', desc: 'Pesado de cerco com canhão de área. Ganha Traços como as outras unidades Tessara.' },
  // --- Quorith (4.0c)
  voz:        { name: 'Voz', key: 'Z', cls: 'inf', hp: 95, r: 7, speed: 92, cost: { minerio: 55, dados: 5 }, time: 6, energyUse: 1, weapon: 'pulso_voz', sensor: 170, faction: 'quorith', desc: 'Pulso básico do Coro. Fraca sozinha; em acorde (Elo: +3,5% de dano e +2,5% de armadura por aliado Quorith a até 90, máx. 3) fica letal.' },
  agulha:     { name: 'Agulha', key: 'G', era: 2, cls: 'inf', hp: 110, r: 7, speed: 85, cost: { minerio: 100, plasma: 25 }, time: 8, energyUse: 1, weapon: 'agulha', sensor: 220, faction: 'quorith', desc: 'Antiaérea: agulhas ressonantes que estilhaçam drones. Fraca contra veículos e estruturas.' },
  diapasao:   { name: 'Diapasão', key: 'D', era: 2, needs: ['laboratorio'], cls: 'sup', hp: 170, r: 9, speed: 72, cost: { minerio: 140, plasma: 20, dados: 30 }, time: 11, energyUse: 3, sensor: 210, faction: 'quorith', aura: { elo: 100 }, desc: 'Sem armas. Amplia o Elo: aliados a até 100 dele aceitam um quarto vizinho no acorde.' },
  prisma:     { name: 'Prisma', key: 'P', cls: 'vei', hp: 520, r: 12, speed: 60, cost: { minerio: 190, plasma: 50, dados: 10 }, time: 13, energyUse: 3, weapon: 'refrator', sensor: 170, faction: 'quorith', desc: 'Tanque refrator: concentra a onda do Coro num feixe de área.' },
  monolito:   { name: 'Monólito', key: 'O', era: 3, cls: 'vei', hp: 780, r: 15, speed: 45, cost: { minerio: 330, plasma: 80, dados: 40 }, time: 19, energyUse: 5, weapon: 'ressonancia', sensor: 190, faction: 'quorith', desc: 'Cerco ressonante: onda lenta e longa que racha estruturas. Quase inútil contra drones.' },
  harmonico:  { name: 'Harmônico', key: 'H', cls: 'dro', hp: 120, r: 7, speed: 150, cost: { minerio: 110, plasma: 45, dados: 10 }, time: 9, energyUse: 2, flying: true, weapon: 'harmonico', sensor: 230, faction: 'quorith', desc: 'Voador do Coro: acorde aéreo que persegue veículos e suporte.' },
  // --- Vorag (4.0c)
  cria:       { name: 'Cria', key: 'K', cls: 'inf', hp: 82, r: 6, speed: 122, cost: { minerio: 22, plasma: 12 }, time: 4.5, energyUse: 0.5, weapon: 'mordida', sensor: 150, faction: 'vorag', pair: true, desc: 'Enxame corpo a corpo; eclode em pares. Fome: fora do seu território perde vida devagar (até 40%).' },
  cuspidor:   { name: 'Cuspidor', key: 'U', cls: 'inf', hp: 95, r: 7, speed: 90, cost: { minerio: 40, plasma: 30 }, time: 5, energyUse: 1, weapon: 'acido', sensor: 170, faction: 'vorag', desc: 'Cospe ácido a média distância; corrói veículos e estruturas.' },
  escaravelho: { name: 'Escaravelho', key: 'E', cls: 'vei', hp: 300, r: 11, speed: 120, cost: { minerio: 70, plasma: 60 }, time: 8, energyUse: 2, weapon: 'chifrada', sensor: 190, faction: 'vorag', desc: 'Besta de carga blindada: investida rápida que atropela infantaria.' },
  brutamonte: { name: 'Brutamonte', key: 'B', era: 3, cls: 'vei', hp: 1000, r: 16, speed: 52, cost: { minerio: 160, plasma: 130 }, time: 15, energyUse: 4, weapon: 'brutamonte', sensor: 170, faction: 'vorag', desc: 'Tanque biológico: carapaça grossa e golpe de área.' },
  // --- épicos de campanha (4.0e): não são produzidos; os roteiros do Ato 4 os criam
  catedral:   { name: 'Catedral Errante', key: '', cls: 'vei', hp: 9000, r: 30, speed: 26, cost: { minerio: 1600, plasma: 400 }, time: 60, energyUse: 0, weapon: 'catedral', sensor: 320, faction: 'quorith', epic: true, desc: 'Épico do Coro: uma catedral de cristal que caminha cantando. Onda de ressonância em área.' },
  matriarca:  { name: 'Matriarca', key: '', cls: 'vei', hp: 8000, r: 28, speed: 34, cost: { minerio: 1600, plasma: 400 }, time: 60, energyUse: 0, weapon: 'matriarca', sensor: 300, faction: 'vorag', epic: true, desc: 'Épica da Prole: a rainha que choca Crias sem parar.' },
  ferroada:   { name: 'Ferroada', key: 'F', cls: 'dro', hp: 80, r: 6, speed: 170, cost: { minerio: 30, plasma: 50 }, time: 5, energyUse: 1, flying: true, weapon: 'ferrao', sensor: 210, faction: 'vorag', desc: 'Voadora barata com ferrão; em enxame, pica veículos e suporte.' },
};
// o que cada estrutura produz, por Raça
const FACTION_EXTRAS = {
  vehnar:  { quartel: ['soldador', 'guindaste'], fabrica: ['prensa', 'tratorzao'] },
  erevane: { quartel: ['atirador', 'ancora'], fabrica: ['lamina'], hangar: ['mosquito'] },
  tessara: { quartel: ['quimera', 'molde'], hangar: ['esporo'], fabrica: ['colosso'] },
  quorith: { quartel: ['voz', 'agulha', 'diapasao'], fabrica: ['prisma', 'monolito'], hangar: ['harmonico'] },
  vorag:   { quartel: ['cria', 'cuspidor'], fabrica: ['escaravelho', 'brutamonte'], hangar: ['ferroada'] },
};
function producesFor(def, faction) { const base = (BUILDINGS[def] && BUILDINGS[def].produces) || []; const ex = (FACTION_EXTRAS[faction] || {})[def] || []; return base.concat(ex); }

/* Armas: dano base, alcance, recarga, projétil (bullet = rápido e reto, shell = balístico com área, beam = instantâneo),
   velocidade, inexatidão (raio de erro no alvo), área (splash) e tabela "versus" por tipo de armadura do alvo. */
const WEAPONS = {
  fuzil:    { dmg: 12, range: 110, cd: 0.8, proj: 'bullet', speed: 760, inacc: 4,  splash: 0,  cls: 'inf' },
  canhao:   { dmg: 40, range: 150, cd: 1.4, proj: 'shell',  speed: 300, inacc: 12, splash: 24, cls: 'vei' },
  metralha: { dmg: 18, range: 120, cd: 0.9, proj: 'bullet', speed: 760, inacc: 6,  splash: 0,  cls: 'dro' },
  pulso:    { dmg: 10, range: 170, cd: 1.5, proj: 'beam',   speed: 0,   inacc: 0,  splash: 0,  cls: 'sup', stun: true },
  obus:     { dmg: 30, range: 230, cd: 1.0, proj: 'shell',  speed: 380, inacc: 8,  splash: 16, cls: 'est' },
  bombarda: { dmg: 60, range: 260, cd: 0.9, proj: 'shell',  speed: 400, inacc: 10, splash: 30, cls: 'est' },
  chama:    { dmg: 20, range: 75,  cd: 0.5, proj: 'beam',   speed: 0,   inacc: 0,  splash: 22, cls: 'inf', versusOverride: { inf: 1.6, vei: 0.5, dro: 0.7, est: 0.9, sup: 1.3 } },
  fuzil_longo: { dmg: 55, range: 260, cd: 2.6, proj: 'bullet', speed: 900, inacc: 2, splash: 0, cls: 'inf', versusOverride: { inf: 1.6, vei: 0.6, dro: 1.1, est: 0.4, sup: 1.6 } },
  prensa:   { dmg: 70, range: 140, cd: 2.2, proj: 'shell',  speed: 280, inacc: 14, splash: 34, cls: 'vei' },
  laminas:  { dmg: 27, range: 80,  cd: 0.6, proj: 'beam',   speed: 0,   inacc: 0,  splash: 0,  cls: 'vei' },
  ferrao:   { dmg: 7,  range: 85,  cd: 0.45, proj: 'bullet', speed: 800, inacc: 5, splash: 0,  cls: 'dro' },
  colosso:  { dmg: 60, range: 150, cd: 1.8, proj: 'shell',  speed: 300, inacc: 12, splash: 28, cls: 'vei' },
  // 4.0c — Quorith
  pulso_voz: { dmg: 11, range: 115, cd: 0.8, proj: 'beam', speed: 0, inacc: 0, splash: 0, cls: 'inf' },
  agulha:    { dmg: 16, range: 170, cd: 0.7, proj: 'bullet', speed: 900, inacc: 3, splash: 0, cls: 'inf', versusOverride: { inf: 0.6, vei: 0.5, dro: 2.4, est: 0.3, sup: 0.9 } },
  refrator:  { dmg: 44, range: 150, cd: 1.5, proj: 'beam', speed: 0, inacc: 0, splash: 20, cls: 'vei' },
  ressonancia: { dmg: 75, range: 210, cd: 2.6, proj: 'shell', speed: 260, inacc: 10, splash: 30, cls: 'vei', versusOverride: { inf: 0.8, vei: 0.9, dro: 0.3, est: 1.8, sup: 0.9 } },
  harmonico: { dmg: 14, range: 120, cd: 0.9, proj: 'beam', speed: 0, inacc: 0, splash: 0, cls: 'dro' },
  // 4.0c — Vorag
  mordida:   { dmg: 12, range: 26, cd: 0.5, proj: 'beam', speed: 0, inacc: 0, splash: 0, cls: 'inf', versusOverride: { inf: 1.3, vei: 0.8, dro: 0.4, est: 0.9, sup: 1.4 } },
  acido:     { dmg: 18, range: 130, cd: 1.1, proj: 'shell', speed: 260, inacc: 8, splash: 14, cls: 'inf', versusOverride: { inf: 1.2, vei: 1.1, dro: 0.5, est: 1.1, sup: 1.2 } },
  chifrada:  { dmg: 30, range: 30, cd: 0.9, proj: 'beam', speed: 0, inacc: 0, splash: 0, cls: 'vei' },
  catedral:  { dmg: 90, range: 240, cd: 2.2, proj: 'shell', speed: 280, inacc: 10, splash: 40, cls: 'vei' },
  matriarca: { dmg: 70, range: 160, cd: 1.6, proj: 'shell', speed: 300, inacc: 10, splash: 34, cls: 'vei' },
  brutamonte: { dmg: 55, range: 120, cd: 1.7, proj: 'shell', speed: 300, inacc: 12, splash: 26, cls: 'vei' },
};
const COUNTER = {
  inf: { vei: 0.65, dro: 1.5, est: 0.65, sup: 1.5 },
  vei: { inf: 1.5, dro: 0.65, est: 1.5, sup: 0.65 },
  dro: { inf: 0.65, vei: 1.5, est: 0.65, sup: 1.5 },
  est: { inf: 1.5, vei: 0.65, dro: 1.5, sup: 0.65 },
  sup: { inf: 0.65, vei: 1.5, dro: 0.65, est: 1.5 },
};
for (const k in WEAPONS) { const w = WEAPONS[k]; w.versus = Object.assign({ inf: 1, vei: 1, dro: 1, est: 1, sup: 1, civ: 1 }, COUNTER[w.cls] || {}, w.versusOverride || {}); }
const VET_RANKS = [0, 0.8, 2.4, 5.0]; // multiplicador do custo da unidade em XP para cada patente
const CLASS_NAMES = { inf: 'Infantaria', vei: 'Veículos', dro: 'Drones', est: 'Estruturas', sup: 'Suporte/Hack', civ: 'Civil' };

const RESEARCH = {
  armamento: { name: 'Armamento', era: 3, cost: { dados: 150 }, desc: '+15% de dano para todas as unidades e torres.' },
  blindagem: { name: 'Blindagem', era: 3, cost: { dados: 150 }, desc: '−13% de dano recebido por unidades e estruturas.' },
  sensores:  { name: 'Sensores', era: 2, cost: { dados: 100 }, desc: '+25% de alcance de sensores.' },
};

for (const t of [BUILDINGS, UNITS]) for (const k in t) if (t[k].weapon) t[k].attack = WEAPONS[t[k].weapon];
// 4.1d — Eras do Núcleo: a colônia evolui em três etapas; cada uma libera estruturas, unidades, módulos e poderes
const ERAS = [null,
  { n: 1, roman: 'I', name: 'Fundação', desc: 'Reator, Refinaria, Quartel, Torre, Nódulo e muros. Infantaria básica e Piratas.' },
  { n: 2, roman: 'II', name: 'Expansão', cost: { minerio: 300, plasma: 80 }, time: 25, needs: ['quartel', 'refinaria'], desc: 'Libera Fábrica, Hangar e Laboratório, as unidades de meio de jogo, a Câmara de Fusão dos Reatores e a Academia do Quartel.' },
  { n: 3, roman: 'III', name: 'Domínio', cost: { minerio: 400, plasma: 320, dados: 60 }, time: 40, needs: ['laboratorio'], needsAny: ['fabrica', 'hangar'], desc: 'Libera as unidades pesadas, a superarma, Armamento e Blindagem, a Bateria Pesada das Torres e a Ascensão da sua Raça.' },
];
const ERA_NUCLEO = { hp: 0.2, territory: 40, energy: 15 }; // por Era acima da I
// Ascensão: o último passo de cada Raça (Laboratório, Era III); vira modificadores permanentes do jogador
const ASCENSION = {
  vehnar:  { name: 'Revolução Industrial', cost: { minerio: 300, plasma: 200, dados: 150 }, desc: 'Produção 25% mais rápida e Reatores queimam 30% menos Plasma.', mods: { prodMul: 1.25, burnMul: 0.7 } },
  erevane: { name: 'Véu Total', cost: { minerio: 300, plasma: 200, dados: 150 }, desc: 'Unidades 15% mais rápidas, sensores +25% e superarma recarrega 30% mais rápido.', mods: { speedMul: 1.15, sensorMul: 1.25, superCdMul: 0.7 } },
  tessara: { name: 'Florescer', cost: { minerio: 300, plasma: 200, dados: 150 }, desc: 'Unidades se regeneram fora de combate (4 de vida/s) e a coleta rende 20% mais.', mods: { regen: 4, harvestMul: 1.2 } },
  quorith: { name: 'Coro Pleno', cost: { minerio: 300, plasma: 200, dados: 150 }, desc: 'O Elo de Sincronia sobe até 5 aliados (antes 3) e a energia rende 15% mais.', mods: { eloBonus: 2, energyMul: 1.15 } },
  vorag:   { name: 'Fome Sem Fim', cost: { minerio: 300, plasma: 200, dados: 150 }, desc: 'Crias eclodem em trios e unidades se regeneram fora de combate (3 de vida/s).', mods: { brood: 3, regen: 3 } },
};
function eraOf(sim, pid) { const p = sim.players[pid]; return (p && p.era) || 1; }
function hasBuiltAny(sim, pid, defs) { for (const d of defs) if (hasBuilt(sim, pid, d)) return true; return false; }
// por que algo está trancado (texto para a interface) ou null quando liberado
function lockReason(sim, pid, kind, def) {
  const t = kind === 'unit' ? UNITS[def] : kind === 'building' ? BUILDINGS[def] : kind === 'research' ? RESEARCH[def] : kind === 'module' ? BUILDINGS[def] && BUILDINGS[def].module : null;
  if (!t) return 'Desconhecido';
  const era = t.era || 1; if (era > eraOf(sim, pid)) return 'Requer Era ' + ERAS[era].roman + ' (' + ERAS[era].name + ')';
  for (const n of t.needs || []) if (!hasBuilt(sim, pid, n)) return 'Requer ' + BUILDINGS[n].name;
  return null;
}
function territoryOf(sim, e) { const t = BUILDINGS[e.def].territory || 0; if (!t || e.def !== 'nucleo') return t; return t + ERA_NUCLEO.territory * (eraOf(sim, e.owner) - 1); }
function eraBlock(sim, pid) { // o que falta para a próxima Era (null se pode evoluir)
  const p = sim.players[pid]; const cur = eraOf(sim, pid); const nx = ERAS[cur + 1]; if (!nx) return 'Era máxima';
  if (p.evolveT > 0) return 'Evoluindo';
  for (const n of nx.needs || []) if (!hasBuilt(sim, pid, n)) return 'Requer ' + BUILDINGS[n].name;
  if (nx.needsAny && !hasBuiltAny(sim, pid, nx.needsAny)) return 'Requer ' + nx.needsAny.map(n => BUILDINGS[n].name).join(' ou ');
  return null;
}
const SUPER_COST = { dados: 300, plasma: 200 };
const SUPER_CD = 600;
const OVERCHARGE_COST = 200, OVERCHARGE_T = 60, OVERCHARGE_CD = 300;
const PACT_DURATION = 600, PACT_CAUCAO = 150, PROPOSAL_TTL = 30;
const JUMP_CHANNEL = 60;
const REP_NAMES = { 2: 'Palavra de Ferro', 1: 'Confiável', 0: 'Neutro', '-1': 'Volátil', '-2': 'Traidor Conhecido' };

const REGIME = {
  pleno:     { prodF: 1.0,  sensF: 1.0, defF: 1.0,  name: 'Pleno' },
  racionado: { prodF: 0.75, sensF: 0.8, defF: 0.9,  name: 'Racionado' },
  colapso:   { prodF: 0.5,  sensF: 0.6, defF: 0.65, name: 'Colapso' },
};

const DIFFICULTY = {
  // 4.1a: Fácil de verdade (economia menor, constrói devagar, ataca tarde e com parte do exército, sem superarma); Brutal novo no topo
  facil:   { name: 'Fácil',   income: 0.55, attackAt: 1600, minAttack: 720, acceptP: 0.95, breakP: 0.0,  pirateEvery: 260, reserve: 300, buildEvery: 30, attackFrac: 0.6, research: 1, superweapon: false, maxProd: 1, prodEvery: 9, maxCol: 8 },
  normal:  { name: 'Normal',  income: 0.9,  attackAt: 1500, minAttack: 480, acceptP: 0.7,  breakP: 0.08, pirateEvery: 150, reserve: 180, buildEvery: 10, attackFrac: 0.85, research: 2, superweapon: true, maxProd: 2, prodEvery: 3, maxCol: 12 },
  dificil: { name: 'Difícil', income: 1.0,  attackAt: 1600, minAttack: 420, acceptP: 0.5,  breakP: 0.3,  pirateEvery: 100, reserve: 120, buildEvery: 4,  attackFrac: 0.95, research: 3, superweapon: true, maxProd: 4, prodEvery: 1 }, // 4.1d: suavizado depois da correção da economia da IA
  brutal:  { name: 'Brutal',  income: 1.4,  attackAt: 1800, minAttack: 300, acceptP: 0.35, breakP: 0.45, pirateEvery: 80,  reserve: 90,  buildEvery: 0,  attackFrac: 1,   research: 3, superweapon: true, maxProd: 9 },
};

function mulberry32(seed) {
  let a = seed >>> 0;
  const r = function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  r.state = () => a; r.setState = v => { a = v >>> 0; }; // 4.1c: estado do gerador entra no salvamento
  return r;
}
function dist(ax, ay, bx, by) { return DM.hypot(ax - bx, ay - by); }
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

function createSim(cfg) {
  const sim = {
    cfg, tick: 0, time: 0, seed: cfg.seed || 1, ents: [], byId: new Map(), nextId: 1,
    players: [], events: [], cmdQueue: [], pending: [], vis: [], result: null,
    maxTime: (cfg.minutes || 25) * 60, grid: new Map(),
    nav: { blocked: new Uint8Array(NW * NW), gates: new Map(), gatePos: new Map(), fields: new Map(), version: 0 }, navDirty: true, explored: [], storm: null, nextStorm: 0,
  };
  sim.rand = mulberry32(sim.seed);
  const n = cfg.players.length;
  const rot = sim.rand() * Math.PI * 2; const colors = assignColors(cfg.players);
  for (let i = 0; i < n; i++) {
    const pc = cfg.players[i];
    const fac = FACTIONS[pc.faction] || FACTIONS.vehnar;
    const p = {
      id: i, name: pc.name || (pc.human ? 'Você' : 'IA ' + i), faction: fac.id, color: colors[i],
      human: !!pc.human, difficulty: pc.difficulty || 'normal', alive: true,
      res: { plasma: 300, minerio: 500, dados: 40 },
      energy: { prod: 40, cons: 0, ratio: 1, regime: 'pleno' },
      overchargeT: 0, overchargeCd: 0, superCd: 0, blackoutT: 0, speedBuffT: 0, golpeT: 0, unissonoT: 0,
      era: Math.max(1, Math.min(3, pc.era | 0 || 1)), evolveT: 0, ascended: false, research: {}, rep: 0, pacts: {}, jumpsLeft: fac.jumps, lastBaseAlert: -99, lastNucleoAlert: -99, saltoT: 0, traits: {}, traitXp: {},
      stats: { collected: 0, stolen: 0, lost: 0, unitsKilled: 0, unitsLost: 0, buildingsDestroyed: 0, buildingsLost: 0, treaties: 0, betrayals: 0, dmg: 0 },
      startAngle: rot + (Math.PI * 2 * i) / n,
    };
    if (pc.mods) { p.mods = Object.assign({}, pc.mods); const sr = p.mods.startRes || {}; for (const k in sr) if (p.res[k] != null) p.res[k] += sr[k]; if (p.mods.extraJumps) p.jumpsLeft += p.mods.extraJumps; } // 4.0e: relíquias
    sim.players.push(p);
    sim.vis.push(new Set());
    sim.explored.push(new Uint8Array(TILES * TILES));
  }
  sim.nextStorm = 300 + sim.rand() * 120;
  generateMap(sim);
  generateTerrain(sim);
  rebuildNav(sim);
  computeVisibility(sim); markExplored(sim);
  return sim;
}

function generateMap(sim) {
  const R0 = 1180;
  // Plasma ring around the Rift
  for (let k = 0; k < 8; k++) {
    const a = (Math.PI * 2 * k) / 8 + Math.PI / 8;
    addNode(sim, 'plasma', CX + DM.cos(a) * 330, CY + DM.sin(a) * 330, 1800);
  }
  // Data anomalies between players on a mid ring
  const n = sim.players.length;
  for (let i = 0; i < n; i++) {
    const a = sim.players[i].startAngle + Math.PI / n;
    addNode(sim, 'dados', CX + DM.cos(a) * 640, CY + DM.sin(a) * 640, 600);
    addNode(sim, 'minerio', CX + DM.cos(a + 0.18) * 800, CY + DM.sin(a + 0.18) * 800, 1600);
    addNode(sim, 'minerio', CX + DM.cos(a - 0.18) * 800, CY + DM.sin(a - 0.18) * 800, 1600);
  }
  if (n < 4) { // extra data for small games
    for (let k = 0; k < 4 - n; k++) {
      const a = sim.rand() * Math.PI * 2;
      addNode(sim, 'dados', CX + DM.cos(a) * 520, CY + DM.sin(a) * 520, 500);
    }
  }
  for (let i = 0; i < n; i++) {
    const p = sim.players[i];
    const sx = CX + DM.cos(p.startAngle) * R0, sy = CY + DM.sin(p.startAngle) * R0;
    const nuc = addBuilding(sim, p.id, 'nucleo', sx, sy, true);
    nuc.hp = nuc.maxHp;
    // three minério nodes around the start, one small plasma, one dados a bit away
    for (let k = 0; k < 3; k++) {
      const a = p.startAngle + Math.PI + (k - 1) * 0.75 + (sim.rand() - 0.5) * 0.3;
      const d = 190 + sim.rand() * 60;
      addNode(sim, 'minerio', sx + DM.cos(a) * d, sy + DM.sin(a) * d, 2200);
    }
    const ap = p.startAngle + Math.PI + (sim.rand() < 0.5 ? 1.5 : -1.5);
    addNode(sim, 'plasma', sx + DM.cos(ap) * 250, sy + DM.sin(ap) * 250, 1500);
    const ad = p.startAngle + (sim.rand() < 0.5 ? 1.1 : -1.1);
    addNode(sim, 'dados', sx + DM.cos(ad) * 420, sy + DM.sin(ad) * 420, 350);
    // starting units
    for (let k = 0; k < 3; k++) {
      const u = addUnit(sim, p.id, 'coletor', sx + DM.cos(p.startAngle + Math.PI + k * 0.5) * 60, sy + DM.sin(p.startAngle + Math.PI + k * 0.5) * 60);
      u.state = 'idle';
    }
    const u1 = addUnit(sim, p.id, 'infantaria', sx + DM.cos(p.startAngle) * 70, sy + DM.sin(p.startAngle) * 70);
    const u2 = addUnit(sim, p.id, 'infantaria', sx + DM.cos(p.startAngle + 0.4) * 70, sy + DM.sin(p.startAngle + 0.4) * 70);
    u1.state = u2.state = 'idle';
  }
  // scattered extra minério
  let tries = 0;
  for (let k = 0; k < 6 && tries < 200; tries++) {
    const a = sim.rand() * Math.PI * 2, d = 450 + sim.rand() * 550;
    const x = CX + DM.cos(a) * d, y = CY + DM.sin(a) * d;
    if (nearestEntity(sim, x, y, 150, e => e.kind !== 'unit')) continue;
    addNode(sim, 'minerio', x, y, 1200); k++;
  }
}

// ---------- terreno: biomas por ruído, adereços e cordilheiras intransponíveis ----------
function makeNoise(seed) {
  const h = (ix, iy) => { let n = (ix * 374761393 + iy * 668265263 + seed * 1274126177) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); n ^= n >>> 16; return (n >>> 0) / 4294967296; };
  const sm = t => t * t * (3 - 2 * t);
  const val = (x, y) => { const ix = Math.floor(x), iy = Math.floor(y); const fx = sm(x - ix), fy = sm(y - iy); const a = h(ix, iy), b = h(ix + 1, iy), c = h(ix, iy + 1), d = h(ix + 1, iy + 1); return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy; };
  return (x, y) => 0.6 * val(x, y) + 0.3 * val(x * 2.1 + 7.3, y * 2.1 + 3.1) + 0.1 * val(x * 4.3 + 1.7, y * 4.3 + 9.2);
}
function generateTerrain(sim) {
  const n = TILES * TILES; sim.biome = new Uint8Array(n); sim.biome2 = new Uint8Array(n); sim.biomeMix = new Float32Array(n); sim.props = [];
  const noise = makeNoise(sim.seed);
  const nucs = sim.players.map(p => nucleoOf(sim, p.id)).filter(Boolean);
  for (let ty = 0; ty < TILES; ty++) for (let tx = 0; tx < TILES; tx++) {
    const i = ty * TILES + tx; const cx = (tx + 0.5) * TILE, cy = (ty + 0.5) * TILE; const d = dist(cx, cy, CX, CY);
    const v = noise(cx / 460, cy / 460);
    let b = v < 0.42 ? 0 : v < 0.6 ? 1 : 2; let b2 = b, mix = 0;
    const th = v < 0.42 ? 0.42 : v < 0.6 ? (v - 0.42 < 0.6 - v ? 0.42 : 0.6) : 0.6; const dt = Math.abs(v - th);
    if (dt < 0.05) { mix = (1 - dt / 0.05) * 0.5; b2 = th === 0.42 ? (v < 0.42 ? 1 : 0) : (v < 0.6 ? 2 : 1); }
    if (d < 560) { b = 3; b2 = 3; mix = 0; } else if (d < 660) { b2 = 3; mix = (660 - d) / 100 * 0.7; }
    sim.biome[i] = b; sim.biome2[i] = b2; sim.biomeMix[i] = mix;
    // adereços decorativos (só visuais): ruínas no gelo, pedras na rocha, estilhaços na tundra, cristais no basalto
    const hh = (tx * 92821 + ty * 68917 + sim.seed * 3) % 1000 / 1000;
    if (d < RIFT_R + 60 || hh > 0.14) continue;
    if (nucs.some(nc => dist(cx, cy, nc.x, nc.y) < 300)) continue;
    if (sim.ents.some(e => e.kind === 'node' && dist(cx, cy, e.x, e.y) < 70)) continue;
    const kind = (b === 0 || b === 2) && hh < 0.045 ? 'ruin' : 'rocks'; // só pedras e ruínas: nada que pareça um nó de recurso
    sim.props.push({ x: cx + (hh * 977 % 40) - 20, y: cy + (hh * 613 % 40) - 20, kind, seed: Math.floor(hh * 1000), scale: 0.35 + (hh * 331 % 1) * 0.35 });
  }
  // cordilheiras: segmentos de rochas intransponíveis no anel médio, mantendo o mapa conectado
  const nR = 5 + sim.players.length; const placed = [];
  for (let k = 0; k < nR * 3 && placed.length < nR; k++) {
    const a = sim.rand() * Math.PI * 2, rr = 620 + sim.rand() * 420; const cx = CX + DM.cos(a) * rr, cy = CY + DM.sin(a) * rr;
    if (nucs.some(nc => dist(cx, cy, nc.x, nc.y) < 460)) continue;
    const dir = a + Math.PI / 2 + (sim.rand() - 0.5) * 0.8; const len = 150 + sim.rand() * 220; const curve = (sim.rand() - 0.5) * 0.004;
    const rocks = [];
    for (let t = -len / 2; t <= len / 2; t += 26) {
      const ang = dir + curve * t * 2; const x = cx + DM.cos(ang) * t, y = cy + DM.sin(ang) * t + DM.sin(t * 0.08) * 6;
      if (x < 80 || y < 80 || x > WORLD - 80 || y > WORLD - 80) continue;
      if (sim.ents.some(e => (e.kind === 'node' && dist(x, y, e.x, e.y) < 70) || (e.kind === 'building' && dist(x, y, e.x, e.y) < 120))) continue;
      const r = { id: sim.nextId++, kind: 'rock', x, y, r: 13, alive: true, owner: -1, seed: Math.floor(sim.rand() * 1000) };
      sim.ents.push(r); sim.byId.set(r.id, r); rocks.push(r);
    }
    if (rocks.length < 4) { for (const r of rocks) { r.alive = false; sim.byId.delete(r.id); } continue; }
    rebuildNav(sim);
    if (!connected(sim, nucs)) { for (const r of rocks) { r.alive = false; sim.byId.delete(r.id); } continue; }
    placed.push(rocks);
  }
  sim.ents = sim.ents.filter(e => e.alive);
  rebuildNav(sim);
}
function nearPassable(sim, x, y, owner) { // célula transitável mais próxima (os Núcleos ocupam as próprias células)
  const ci = navIdx(x, y); const cx = ci % NW, cy = (ci / NW) | 0;
  for (let r = 0; r <= 5; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue; const x2 = cx + dx, y2 = cy + dy; if (x2 < 0 || y2 < 0 || x2 >= NW || y2 >= NW) continue; const i = y2 * NW + x2; if (passable(sim, i, owner)) return i; }
  return -1;
}
function connected(sim, nucs) { // todos os Núcleos e o anel de Plasma alcançam o primeiro Núcleo pela grade
  const src = nearPassable(sim, nucs[0].x, nucs[0].y, -2); if (src < 0) return false;
  const f = flowField(sim, src, -2);
  for (let i = 1; i < nucs.length; i++) { const ci = nearPassable(sim, nucs[i].x, nucs[i].y, -2); if (ci < 0 || f.cost[ci] < 0) return false; }
  for (const e of sim.ents) if (e.alive && e.kind === 'node' && e.res === 'plasma' && dist(e.x, e.y, CX, CY) < 400) { const ci = nearPassable(sim, e.x, e.y, -2); if (ci >= 0 && f.cost[ci] >= 0) return true; }
  return false;
}
function addNode(sim, res, x, y, amount) {
  const e = { id: sim.nextId++, kind: 'node', res, x: clamp(x, 60, WORLD - 60), y: clamp(y, 60, WORLD - 60), r: 18, amount, max: amount, alive: true, owner: -1 };
  sim.ents.push(e); sim.byId.set(e.id, e); return e;
}
function addBuilding(sim, owner, def, x, y, built) {
  const d = BUILDINGS[def];
  const e = {
    id: sim.nextId++, kind: 'building', def, cls: 'est', owner, x, y, px: x, py: y, r: d.r,
    maxHp: d.hp, hp: built ? d.hp : d.hp * 0.3, built: !!built, progress: built ? 1 : 0, queue: [], cd: 0,
    alive: true, lastHitT: -99, lastAttack: -99, cloaked: false, revealT: 0, rally: null, jumpT: 0, jumpTo: null, lotes: {}, ang: 0, aimAng: 0,
  };
  { const pm = sim.players[owner] && sim.players[owner].mods; if (pm && pm.towerHpMul && (def === 'torre' || def === 'bastiao')) { e.maxHp *= pm.towerHpMul; e.hp *= pm.towerHpMul; } }
  sim.ents.push(e); sim.byId.set(e.id, e); sim.navDirty = true; return e;
}
function addUnit(sim, owner, def, x, y) {
  const d = UNITS[def];
  const p = sim.players[owner];
  const fac = FACTIONS[p.faction];
  const e = {
    id: sim.nextId++, kind: 'unit', def, cls: d.cls, owner, x, y, px: x, py: y, r: d.r, ang: p.startAngle,
    maxHp: d.hp, hp: d.hp, speed: d.speed, state: 'idle', tx: x, ty: y, target: null, resume: null, cd: 0,
    cargo: { plasma: 0, minerio: 0, dados: 0 }, cargoTotal: 0, stolen: false, cargoCap: d.cargoCap || d.capacity || 0,
    siphonT: 0, alive: true, lastHitT: -99, lastAttack: -99, cloaked: false, revealT: 0, node: null, xp: 0, rank: 0, aimAng: p.startAngle, elo: 0,
  };
  if (def === 'pirata' && fac.id === 'vehnar') { e.maxHp = e.hp = 260; e.speed = 72; e.cargoCap = 600; e.r = 11; }
  if (def === 'pirata' && fac.id === 'vorag') { e.maxHp = e.hp = 200; e.speed = 95; e.r = 10; }
  sim.ents.push(e); sim.byId.set(e.id, e); return e;
}

function nearestEntity(sim, x, y, rad, pred) {
  let best = null, bd = rad;
  for (const e of sim.ents) {
    if (!e.alive) continue;
    if (pred && !pred(e)) continue;
    const d = dist(x, y, e.x, e.y) - (e.r || 0);
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

// ---------- spatial hash ----------
const CELL = 100;
function rebuildGrid(sim) {
  sim.grid.clear();
  for (const e of sim.ents) {
    if (!e.alive || e.kind === 'node' || e.kind === 'proj' || e.kind === 'wreck') continue;
    const k = ((e.x / CELL) | 0) * 4096 + ((e.y / CELL) | 0);
    let arr = sim.grid.get(k); if (!arr) { arr = []; sim.grid.set(k, arr); }
    arr.push(e);
  }
}
function queryGrid(sim, x, y, rad, fn) {
  const x0 = ((x - rad) / CELL) | 0, x1 = ((x + rad) / CELL) | 0, y0 = ((y - rad) / CELL) | 0, y1 = ((y + rad) / CELL) | 0;
  for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) {
    const arr = sim.grid.get(cx * 4096 + cy); if (!arr) continue;
    for (const e of arr) if (e.alive) fn(e);
  }
}

// ---------- navegação: grade de obstáculos e campos de fluxo ----------
function navIdx(x, y) { const cx = clamp((x / NAV) | 0, 0, NW - 1), cy = clamp((y / NAV) | 0, 0, NW - 1); return cy * NW + cx; }
function rebuildNav(sim) {
  const nav = sim.nav; nav.blocked.fill(0); nav.gates.clear(); nav.gatePos.clear(); nav.fields.clear(); nav.version++;
  for (let cy = 0; cy < NW; cy++) for (let cx = 0; cx < NW; cx++) { const x = (cx + 0.5) * NAV, y = (cy + 0.5) * NAV; if (dist(x, y, CX, CY) < RIFT_R + 14) nav.blocked[cy * NW + cx] = 1; }
  for (const e of sim.ents) {
    if (!e.alive || (e.kind !== 'building' && e.kind !== 'rock')) continue;
    const rr = e.r + 7; const x0 = Math.max(0, ((e.x - rr) / NAV) | 0), x1 = Math.min(NW - 1, ((e.x + rr) / NAV) | 0), y0 = Math.max(0, ((e.y - rr) / NAV) | 0), y1 = Math.min(NW - 1, ((e.y + rr) / NAV) | 0);
    const gate = e.kind === 'building' && BUILDINGS[e.def].gate;
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
      // bloqueia se o círculo da estrutura toca o quadrado da célula
      const qx = Math.max(cx * NAV, Math.min(e.x, (cx + 1) * NAV)), qy = Math.max(cy * NAV, Math.min(e.y, (cy + 1) * NAV));
      if (dist(qx, qy, e.x, e.y) <= rr) { const i = cy * NW + cx; if (gate) { nav.gates.set(i, e.owner); nav.gatePos.set(i, e); } else nav.blocked[i] = 1; }
    }
  }
  for (const i of nav.gates.keys()) nav.blocked[i] = 0; // o portão vence os muros vizinhos
  sim.navDirty = false;
}
function passable(sim, i, owner) { if (sim.nav.blocked[i]) return false; const g = sim.nav.gates.get(i); return g === undefined || g === owner; }
function flowField(sim, destIdx, owner) {
  const nav = sim.nav; const key = owner * 1000000 + destIdx; let f = nav.fields.get(key); if (f) return f;
  if (nav.fields.size > 96) nav.fields.clear();
  const N = NW * NW; const cost = new Int32Array(N).fill(-1); const dir = new Int8Array(N).fill(-1);
  // Dijkstra com heap binário; custo 10 reto, 14 diagonal; sem cortar cantos
  const heap = []; const push = (c, i) => { heap.push(c * 1048576 + i); let k = heap.length - 1; while (k > 0) { const pk = (k - 1) >> 1; if (heap[pk] <= heap[k]) break; const tmp = heap[pk]; heap[pk] = heap[k]; heap[k] = tmp; k = pk; } };
  const pop = () => { const top = heap[0]; const last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l] < heap[m]) m = l; if (r < heap.length && heap[r] < heap[m]) m = r; if (m === k) break; const tmp = heap[m]; heap[m] = heap[k]; heap[k] = tmp; k = m; } } return top; };
  cost[destIdx] = 0; push(0, destIdx);
  while (heap.length) {
    const v = pop(); const c = Math.floor(v / 1048576), i = v % 1048576; if (c > cost[i]) continue;
    const cx = i % NW, cy = (i / NW) | 0;
    for (let d = 0; d < 8; d++) {
      const nx = cx + DX8[d], ny = cy + DY8[d]; if (nx < 0 || ny < 0 || nx >= NW || ny >= NW) continue;
      const ni = ny * NW + nx; if (!passable(sim, ni, owner)) continue;
      if (DX8[d] && DY8[d]) { if (!passable(sim, cy * NW + nx, owner) || !passable(sim, ny * NW + cx, owner)) continue; }
      const nc = c + (DX8[d] && DY8[d] ? 14 : 10);
      if (cost[ni] < 0 || nc < cost[ni]) { cost[ni] = nc; dir[ni] = (d + 4) % 8; push(nc, ni); }
    }
  }
  f = { dir, cost, version: nav.version }; nav.fields.set(key, f); return f;
}
function lineFree(sim, x0, y0, x1, y1, owner) {
  const d = dist(x0, y0, x1, y1); const n = Math.max(1, Math.ceil(d / (NAV * 0.5)));
  for (let i = 1; i <= n; i++) { const k = i / n; if (!passable(sim, navIdx(x0 + (x1 - x0) * k, y0 + (y1 - y0) * k), owner)) return false; }
  return true;
}
function markExplored(sim) {
  for (const p of sim.players) {
    if (!p.alive) continue; const ex = sim.explored[p.id];
    for (const e of sim.ents) {
      if (!e.alive || e.owner !== p.id || (e.kind !== 'unit' && e.kind !== 'building')) continue;
      const r = sensorRadius(sim, e); const x0 = Math.max(0, ((e.x - r) / TILE) | 0), x1 = Math.min(TILES - 1, ((e.x + r) / TILE) | 0), y0 = Math.max(0, ((e.y - r) / TILE) | 0), y1 = Math.min(TILES - 1, ((e.y + r) / TILE) | 0);
      for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) { if (!ex[ty * TILES + tx] && dist((tx + 0.5) * TILE, (ty + 0.5) * TILE, e.x, e.y) <= r + TILE * 0.5) ex[ty * TILES + tx] = 1; }
    }
  }
}
function inStorm(sim, x, y) { const st = sim.storm; return !!(st && st.phase === 'active' && dist(x, y, st.x, st.y) <= st.r); }
function updateStorm(sim, dt) {
  const st = sim.storm;
  if (!st) {
    if (sim.time >= sim.nextStorm) {
      const a = sim.rand() * Math.PI * 2, rr = 520 + sim.rand() * 560;
      sim.storm = { x: CX + DM.cos(a) * rr, y: CY + DM.sin(a) * rr, r: 420, t: 0, phase: 'warn', warn: 30, dur: 90 };
      for (const q of sim.players) if (q.alive) alertTo(sim, q.id, 'Tempestade de Éter se aproximando (30 s)', sim.storm.x, sim.storm.y, 'warn');
      emit(sim, { t: 'storm', phase: 'warn', x: sim.storm.x, y: sim.storm.y, r: sim.storm.r });
    }
    return;
  }
  st.t += dt;
  if (st.phase === 'warn' && st.t >= st.warn) { st.phase = 'active'; st.t = 0; for (const q of sim.players) if (q.alive) alertTo(sim, q.id, 'Tempestade de Éter ativa: drones e sensores a 50%, Plasma 2× dentro dela', st.x, st.y, 'warn'); emit(sim, { t: 'storm', phase: 'active', x: st.x, y: st.y, r: st.r }); }
  else if (st.phase === 'active' && st.t >= st.dur) { sim.storm = null; sim.nextStorm = sim.time + 360 + sim.rand() * 120; emit(sim, { t: 'storm', phase: 'end' }); }
}

// ---------- helpers ----------
function facOf(sim, pid) { return FACTIONS[sim.players[pid].faction]; }
function regimeOf(sim, pid) { return REGIME[sim.players[pid].energy.regime]; }
function canAfford(p, cost) { for (const k in cost) if ((p.res[k] || 0) < cost[k]) return false; return true; }
function pay(p, cost, mult) { mult = mult || 1; for (const k in cost) p.res[k] = Math.max(0, p.res[k] - cost[k] * mult); }
function refund(p, cost, mult) { mult = mult || 1; for (const k in cost) p.res[k] += cost[k] * mult; }
function hasPact(sim, a, b) { return !!sim.players[a].pacts[b]; }
// 4.0e — roteiros de missão: criar unidades e forçar tempestades (só a campanha solo usa; determinístico)
function spawnUnit(sim, owner, def, x, y) { if (!UNITS[def] || !sim.players[owner]) return null; const u = addUnit(sim, owner, def, clamp(x, 30, WORLD - 30), clamp(y, 30, WORLD - 30)); emit(sim, { t: 'spawn', p: owner, x: u.x, y: u.y, def }); return u; }
function forceStorm(sim, x, y, warn, dur, r) { sim.storm = { x: clamp(x, 200, WORLD - 200), y: clamp(y, 200, WORLD - 200), r: r || 420, t: 0, phase: 'warn', warn: warn == null ? 20 : warn, dur: dur || 90 }; for (const q of sim.players) if (q.alive) alertTo(sim, q.id, 'Tempestade de Éter se aproximando (' + Math.round(sim.storm.warn) + ' s)', sim.storm.x, sim.storm.y, 'warn'); emit(sim, { t: 'storm', phase: 'warn', x: sim.storm.x, y: sim.storm.y, r: sim.storm.r }); return sim.storm; }
function pactCost(p) { return FACTIONS[p.faction].pactHalf ? PACT_CAUCAO / 2 : PACT_CAUCAO; }
function repGain(p) { return FACTIONS[p.faction].pactHalf ? 2 : 1; }
function unitName(faction, def) { const f = FACTIONS[faction]; return (f && f.names && f.names[def]) || (def === 'pirata' && f ? f.pirateName : UNITS[def].name); }
function seesPoint(sim, pid, x, y) { for (const e of sim.ents) { if (!e.alive || e.owner !== pid || (e.kind !== 'unit' && e.kind !== 'building')) continue; if (dist(e.x, e.y, x, y) <= sensorRadius(sim, e)) return true; } return false; }
// 4.0c — Elo de Sincronia (Quorith): cada aliado de combate da mesma Raça a até `range` soma ao acorde (máx. 3; 4 perto de um Diapasão). Uníssono = acorde cheio.
function updateElo(sim) {
  for (const e of sim.ents) {
    if (!e.alive || e.kind !== 'unit') continue; const p = sim.players[e.owner]; const fac = FACTIONS[p.faction];
    if (!fac.elo || e.cls === 'civ') { e.elo = 0; continue; }
    let cap = fac.elo.cap + ((sim.players[e.owner].mods && sim.players[e.owner].mods.eloBonus) || 0); for (const dp of sim.auras[e.owner].diapasoes) if (dist(dp.x, dp.y, e.x, e.y) <= UNITS.diapasao.aura.elo) { cap++; break; }
    if (p.unissonoT > 0) { e.elo = cap; continue; }
    let n = 0; queryGrid(sim, e.x, e.y, fac.elo.range + 40, o => { if (n >= cap || o === e || !o.alive || o.kind !== 'unit' || o.owner !== e.owner || o.cls === 'civ') return; if (dist(e.x, e.y, o.x, o.y) <= fac.elo.range) n++; });
    e.elo = n;
  }
}
function isEnemy(sim, a, b) { return a !== b && !hasPact(sim, a, b); }
function sensorRadius(sim, e) {
  if (e.kind !== 'unit' && e.kind !== 'building') return 0;
  const p = sim.players[e.owner];
  const d = e.kind === 'unit' ? UNITS[e.def] : BUILDINGS[e.def];
  let r = e.kind === 'building' && !e.built ? 60 : d.sensor;
  r *= regimeOf(sim, e.owner).sensF;
  if (p.research.sensores) r *= 1.25;
  if (p.mods && p.mods.sensorMul) r *= p.mods.sensorMul;
  if (p.blackoutT > 0) r *= 0.15;
  if (inStorm(sim, e.x, e.y)) r *= 0.5;
  return r;
}
function speedOf(sim, u) {
  const p = sim.players[u.owner];
  let s = u.speed;
  if (p.speedBuffT > 0) s *= 1.3;
  if (p.mods && p.mods.speedMul) s *= p.mods.speedMul;
  if (UNITS[u.def].flying && inStorm(sim, u.x, u.y)) s *= 0.5;
  return s;
}
function inTerritory(sim, pid, x, y) {
  for (const e of sim.ents) {
    if (!e.alive || e.kind !== 'building' || e.owner !== pid || !e.built) continue;
    const t = territoryOf(sim, e);
    if (t && dist(x, y, e.x, e.y) <= t) return true;
  }
  return false;
}
function territoryOwner(sim, x, y) { // first owner whose territory covers; -1 if none
  for (const e of sim.ents) {
    if (!e.alive || e.kind !== 'building' || !e.built) continue;
    const t = territoryOf(sim, e);
    if (t && dist(x, y, e.x, e.y) <= t) return e.owner;
  }
  return -1;
}
function canBuild(sim, pid, def, x, y) {
  const d = BUILDINGS[def]; if (!d) return { ok: false, why: 'Desconhecido' };
  if (x < 60 || y < 60 || x > WORLD - 60 || y > WORLD - 60) return { ok: false, why: 'Fora do mapa' };
  if (dist(x, y, CX, CY) < RIFT_R + d.r + 12) return { ok: false, why: 'Dentro da Fenda' };
  for (const e of sim.ents) {
    if (!e.alive || e.kind === 'unit' || e.kind === 'crate' || e.kind === 'proj' || e.kind === 'wreck') continue;
    const bothWalls = d.wall && e.kind === 'building' && BUILDINGS[e.def].wall;
    if (dist(x, y, e.x, e.y) < (bothWalls ? 13 : e.r + d.r + 10)) return { ok: false, why: 'Sobreposição' };
  }
  if (def === 'nodulo') {
    let near = false;
    for (const e of sim.ents) if (e.alive && e.kind === 'building' && e.owner === pid && dist(x, y, e.x, e.y) <= 650) { near = true; break; }
    if (!near) return { ok: false, why: 'Longe demais das suas estruturas (650)' };
    const to = territoryOwner(sim, x, y);
    if (to !== -1 && to !== pid) return { ok: false, why: 'Território inimigo' };
  } else if (def !== 'bastiao' && !inTerritory(sim, pid, x, y)) return { ok: false, why: 'Fora do seu território' };
  return { ok: true };
}
function canSee(sim, pid, e) { return e.owner === pid || e.kind === 'node' || e.kind === 'rock' || sim.vis[pid].has(e.id); }
function emit(sim, ev) { ev.time = sim.time; sim.events.push(ev); }
function alertTo(sim, pid, text, x, y, kind) { emit(sim, { t: 'alert', p: pid, text, x, y, kind: kind || 'info' }); }

// ---------- commands ----------
function enqueue(sim, cmd) { sim.cmdQueue.push(cmd); }

function ownUnits(sim, pid, ids) {
  const out = [];
  if (!ids) return out;
  for (const id of ids) { const e = sim.byId.get(id); if (e && e.alive && e.kind === 'unit' && e.owner === pid) out.push(e); }
  return out;
}
function formation(units, x, y) {
  const n = units.length; if (n === 0) return [];
  const cols = Math.ceil(Math.sqrt(n)); const sp = 24;
  const out = [];
  for (let i = 0; i < n; i++) {
    const c = i % cols, r = (i / cols) | 0;
    out.push({ x: x + (c - (cols - 1) / 2) * sp, y: y + (r - (Math.ceil(n / cols) - 1) / 2) * sp });
  }
  return out;
}
function processCommand(sim, c) {
  const p = sim.players[c.p]; if (!p || !p.alive) return;
  switch (c.t) {
    case 'move': case 'attackmove': {
      const us = ownUnits(sim, c.p, c.ids); const f = formation(us, c.x, c.y);
      us.forEach((u, i) => { u.state = c.t === 'move' ? 'move' : 'attackmove'; u.tx = clamp(f[i].x, 20, WORLD - 20); u.ty = clamp(f[i].y, 20, WORLD - 20); u.target = null; u.resume = null; u.node = null; });
      break; }
    case 'stop': ownUnits(sim, c.p, c.ids).forEach(u => { u.state = 'idle'; u.target = null; u.resume = null; }); break;
    case 'attack': {
      const t = sim.byId.get(c.target); if (!t || !t.alive || t.owner === c.p || t.kind === 'node' || !canSee(sim, c.p, t)) return;
      if (t.owner >= 0 && hasPact(sim, c.p, t.owner)) return; // UI must break the pact first
      ownUnits(sim, c.p, c.ids).forEach(u => { if (UNITS[u.def].attack) { u.state = 'attack'; u.target = t.id; u.resume = null; } else { u.state = 'move'; u.tx = t.x; u.ty = t.y; } });
      break; }
    case 'harvest': {
      const t = sim.byId.get(c.target); if (!t || !t.alive || (t.kind !== 'node' && t.kind !== 'wreck')) return;
      ownUnits(sim, c.p, c.ids).forEach(u => { if (u.def === 'coletor') { u.state = 'harvest'; u.node = t.id; u.target = null; } else { u.state = 'move'; u.tx = t.x; u.ty = t.y; } });
      break; }
    case 'devour': { // Carniceiro (Vorag): carcaças e Nódulos inimigos
      const t = sim.byId.get(c.target); if (!t || !t.alive || !facOf(sim, c.p).devour) return;
      if (!(t.kind === 'wreck' || (t.kind === 'building' && t.def === 'nodulo' && t.owner >= 0 && t.owner !== c.p && !hasPact(sim, c.p, t.owner)))) return;
      ownUnits(sim, c.p, c.ids).forEach(u => { if (u.def === 'pirata') { u.state = 'devour'; u.target = t.id; } else { u.state = 'move'; u.tx = t.x; u.ty = t.y; } });
      break; }
    case 'siphon': {
      const t = sim.byId.get(c.target); if (!t || !t.alive || t.kind !== 'building' || t.owner === c.p || !canSee(sim, c.p, t)) return;
      if (!(t.def === 'refinaria' || t.def === 'reator') || hasPact(sim, c.p, t.owner)) return;
      ownUnits(sim, c.p, c.ids).forEach(u => { if (u.def === 'pirata') { u.state = 'siphon'; u.target = t.id; u.siphonT = 0; } else { u.state = 'move'; u.tx = t.x; u.ty = t.y; } });
      break; }
    case 'pickup': {
      const t = sim.byId.get(c.target); if (!t || !t.alive || t.kind !== 'crate') return;
      ownUnits(sim, c.p, c.ids).forEach(u => { u.state = 'pickup'; u.target = t.id; });
      break; }
    case 'build': {
      const d = BUILDINGS[c.def]; if (!d || !d.key) return;
      { const lr = lockReason(sim, c.p, 'building', c.def); if (lr) { if (p.human) emit(sim, { t: 'notice', p: c.p, text: lr }); return; } }
      const ok = canBuild(sim, c.p, c.def, c.x, c.y); if (!ok.ok) { if (p.human) emit(sim, { t: 'notice', p: c.p, text: ok.why }); return; }
      if (!canAfford(p, d.cost)) { if (p.human) emit(sim, { t: 'notice', p: c.p, text: 'Recursos insuficientes' }); return; }
      pay(p, d.cost); const nb = addBuilding(sim, c.p, c.def, c.x, c.y, false); if (typeof c.ang === 'number') nb.ang = c.ang;
      emit(sim, { t: 'place', p: c.p, x: c.x, y: c.y, def: c.def });
      break; }
    case 'produce': {
      const b = sim.byId.get(c.id); if (!b || !b.alive || b.kind !== 'building' || b.owner !== c.p || !b.built) return;
      const bd = BUILDINGS[b.def]; if (!producesFor(b.def, p.faction).includes(c.def)) return;
      { const lr = lockReason(sim, c.p, 'unit', c.def); if (lr) { if (p.human) emit(sim, { t: 'notice', p: c.p, text: lr }); return; } }
      const n = Math.max(1, Math.min(50, c.n | 0 || 1)); // 4.1a: até 50 na fila; c.n enfileira várias de uma vez
      for (let k = 0; k < n && b.queue.length < 50; k++) b.queue.push({ def: c.def, t: 0, total: UNITS[c.def].time, mult: 1, paid: false });
      if (p.human && !canAfford(p, UNITS[c.def].cost) && b.queue.length > 1) emit(sim, { t: 'notice', p: c.p, text: 'Na fila: cada unidade é paga quando começa a ser produzida' });
      break; }
    case 'cancel': {
      const b = sim.byId.get(c.id); if (!b || !b.alive || b.owner !== c.p) return;
      if (c.def && UNITS[c.def]) { // 4.1a: por tipo — a última unidade desse tipo (clique) ou todas (Shift); não depende de índice, que muda quando uma unidade fica pronta
        for (let i = b.queue.length - 1; i >= 0; i--) { const it = b.queue[i]; if (it.def !== c.def) continue; if (it.paid) refund(p, UNITS[it.def].cost, it.mult); b.queue.splice(i, 1); if (!c.all) break; }
        break; }
      const n = Math.max(1, Math.min(50, c.n | 0 || 1)); const def0 = b.queue[c.index] && b.queue[c.index].def;
      for (let k = 0; k < n; k++) { const it = b.queue[c.index]; if (!it || it.def !== def0) break; if (it.paid) refund(p, UNITS[it.def].cost, it.mult); b.queue.splice(c.index, 1); }
      break; }
    case 'rally': { const b = sim.byId.get(c.id); if (b && b.alive && b.owner === c.p && b.kind === 'building') b.rally = { x: c.x, y: c.y }; break; }
    case 'research': {
      const r = RESEARCH[c.key]; if (!r || p.research[c.key]) return;
      if (!hasBuilt(sim, c.p, 'laboratorio')) { if (p.human) emit(sim, { t: 'notice', p: c.p, text: 'Requer Laboratório' }); return; }
      { const lr = lockReason(sim, c.p, 'research', c.key); if (lr) { if (p.human) emit(sim, { t: 'notice', p: c.p, text: lr }); return; } }
      if (!canAfford(p, r.cost)) { if (p.human) emit(sim, { t: 'notice', p: c.p, text: 'Fragmentos de Dados insuficientes' }); return; }
      pay(p, r.cost); p.research[c.key] = true; alertTo(sim, c.p, 'Pesquisa concluída: ' + r.name, null, null, 'good');
      break; }
    case 'overcharge': {
      if (sim.time < p.overchargeCd || p.res.plasma < OVERCHARGE_COST) { if (p.human) emit(sim, { t: 'notice', p: c.p, text: sim.time < p.overchargeCd ? 'Sobrecarga em recarga' : 'Requer 200 Plasma' }); return; }
      p.res.plasma -= OVERCHARGE_COST; p.overchargeT = OVERCHARGE_T; p.overchargeCd = sim.time + OVERCHARGE_CD;
      alertTo(sim, c.p, 'Sobrecarga: +50% de energia por 60 s', null, null, 'good');
      break; }
    case 'evolve': { // 4.1d: Núcleo evolui para a próxima Era
      const n = nucleoOf(sim, c.p); if (!n || n.jumpT > 0) return; const nx = ERAS[eraOf(sim, c.p) + 1];
      const why = eraBlock(sim, c.p); if (why) { if (p.human) emit(sim, { t: 'notice', p: c.p, text: why }); return; }
      if (!canAfford(p, nx.cost)) { if (p.human) emit(sim, { t: 'notice', p: c.p, text: 'Recursos insuficientes para a Era ' + nx.roman }); return; }
      pay(p, nx.cost); p.evolveT = nx.time; alertTo(sim, c.p, 'Núcleo evoluindo para a Era ' + nx.roman + ' (' + nx.name + ')', n.x, n.y, 'good');
      break; }
    case 'upgrade': { // 4.1d: módulo de uma estrutura (Câmara de Fusão, Academia, Bateria Pesada)
      const b = sim.byId.get(c.id); if (!b || !b.alive || b.kind !== 'building' || b.owner !== c.p || !b.built || b.mod || b.upT > 0) return; const md = BUILDINGS[b.def].module; if (!md) return;
      { const lr = lockReason(sim, c.p, 'module', b.def); if (lr) { if (p.human) emit(sim, { t: 'notice', p: c.p, text: lr }); return; } }
      if (!canAfford(p, md.cost)) { if (p.human) emit(sim, { t: 'notice', p: c.p, text: 'Recursos insuficientes' }); return; }
      pay(p, md.cost); b.upT = md.time;
      break; }
    case 'ascend': { // 4.1d: Ascensão da Raça (Laboratório, Era III)
      const asc = ASCENSION[p.faction]; if (!asc || p.ascended) return;
      if (!hasBuilt(sim, c.p, 'laboratorio')) { if (p.human) emit(sim, { t: 'notice', p: c.p, text: 'Requer Laboratório' }); return; }
      if (eraOf(sim, c.p) < 3) { if (p.human) emit(sim, { t: 'notice', p: c.p, text: 'Requer Era III (Domínio)' }); return; }
      if (!canAfford(p, asc.cost)) { if (p.human) emit(sim, { t: 'notice', p: c.p, text: 'Recursos insuficientes' }); return; }
      pay(p, asc.cost); p.ascended = true; p.mods = p.mods || {};
      for (const k in asc.mods) { const v = asc.mods[k]; if (k === 'regen' || k === 'eloBonus' || k === 'brood') p.mods[k] = Math.max(p.mods[k] || 0, v); else p.mods[k] = (p.mods[k] || 1) * v; }
      emit(sim, { t: 'ascend', p: c.p }); for (const q of sim.players) if (q.alive) alertTo(sim, q.id, q.id === c.p ? 'Ascensão: ' + asc.name + '. ' + asc.desc : p.name + ' alcançou a Ascensão (' + asc.name + ')!', null, null, q.id === c.p ? 'good' : 'warn');
      break; }
    case 'super': {
      const fac = facOf(sim, c.p);
      if (!hasBuilt(sim, c.p, 'laboratorio')) { if (p.human) emit(sim, { t: 'notice', p: c.p, text: 'Requer Laboratório' }); return; }
      if (eraOf(sim, c.p) < 3) { if (p.human) emit(sim, { t: 'notice', p: c.p, text: 'Superarma requer Era III (Domínio)' }); return; }
      if (sim.time < p.superCd) { if (p.human) emit(sim, { t: 'notice', p: c.p, text: 'Superarma em recarga' }); return; }
      if (!canAfford(p, SUPER_COST)) { if (p.human) emit(sim, { t: 'notice', p: c.p, text: 'Requer 300 Dados e 200 Plasma' }); return; }
      if (fac.superKey === 'fundicao') {
        const ok = canBuild(sim, c.p, 'bastiao', c.x, c.y);
        if (!ok.ok || !inTerritory(sim, c.p, c.x, c.y)) { if (p.human) emit(sim, { t: 'notice', p: c.p, text: ok.ok ? 'Fora do seu território' : ok.why }); return; }
        pay(p, SUPER_COST); p.superCd = sim.time + SUPER_CD * (p.mods && p.mods.superCdMul || 1);
        addBuilding(sim, c.p, 'bastiao', c.x, c.y, false);
        emit(sim, { t: 'super', p: c.p, kind: 'fundicao', x: c.x, y: c.y });
        for (const q of sim.players) if (q.alive) alertTo(sim, q.id, (q.id === c.p ? 'Fundição Orbital a caminho' : p.name + ' ativou Fundição Orbital!'), c.x, c.y, q.id === c.p ? 'good' : 'danger');
      } else if (fac.superKey === 'salto') {
        pay(p, SUPER_COST); p.superCd = sim.time + SUPER_CD * (p.mods && p.mods.superCdMul || 1); p.saltoT = 45;
        for (const q of sim.players) if (q.alive) alertTo(sim, q.id, q.id === c.p ? 'Salto Evolutivo: +35% de dano por 45 s' : p.name + ' ativou o Salto Evolutivo!', null, null, q.id === c.p ? 'good' : 'danger');
        emit(sim, { t: 'super', p: c.p, kind: 'salto' });
      } else if (fac.superKey === 'unissono') {
        pay(p, SUPER_COST); p.superCd = sim.time + SUPER_CD * (p.mods && p.mods.superCdMul || 1); p.unissonoT = 20;
        for (const q of sim.players) if (q.alive) alertTo(sim, q.id, q.id === c.p ? 'Uníssono: acorde cheio e 25% menos dano por 20 s' : p.name + ' ativou o Uníssono!', null, null, q.id === c.p ? 'good' : 'danger');
        emit(sim, { t: 'super', p: c.p, kind: 'unissono' });
      } else if (fac.superKey === 'eclosao') {
        if (typeof c.x !== 'number' || typeof c.y !== 'number') return;
        const ex = clamp(c.x, 40, WORLD - 40), ey = clamp(c.y, 40, WORLD - 40);
        if (!inTerritory(sim, c.p, ex, ey) && !seesPoint(sim, c.p, ex, ey)) { if (p.human) emit(sim, { t: 'notice', p: c.p, text: 'Escolha um ponto visível' }); return; }
        pay(p, SUPER_COST); p.superCd = sim.time + SUPER_CD * (p.mods && p.mods.superCdMul || 1);
        for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; const u = addUnit(sim, c.p, 'cria', ex + DM.cos(a) * 22, ey + DM.sin(a) * 22); u.tempUntil = sim.time + 30; u.state = 'attackmove'; u.tx = ex; u.ty = ey; }
        emit(sim, { t: 'super', p: c.p, kind: 'eclosao', x: ex, y: ey });
        for (const q of sim.players) if (q.alive) alertTo(sim, q.id, q.id === c.p ? 'Eclosão: 8 Crias por 30 s' : p.name + ' ativou a Eclosão!', ex, ey, q.id === c.p ? 'good' : 'danger');
      } else {
        pay(p, SUPER_COST); p.superCd = sim.time + SUPER_CD * (p.mods && p.mods.superCdMul || 1); p.speedBuffT = 20;
        for (const q of sim.players) if (q.alive && q.id !== c.p) { q.blackoutT = 20; alertTo(sim, q.id, p.name + ' ativou Blecaute! Sensores e energia a zero por 20 s', null, null, 'danger'); }
        alertTo(sim, c.p, 'Blecaute ativo: inimigos cegos por 20 s', null, null, 'good');
        emit(sim, { t: 'super', p: c.p, kind: 'blecaute' });
      }
      break; }
    case 'jump': {
      const nuc = nucleoOf(sim, c.p); if (!nuc || nuc.jumpT > 0) return;
      if (p.jumpsLeft <= 0) { if (p.human) emit(sim, { t: 'notice', p: c.p, text: 'Sem Saltos restantes' }); return; }
      const ok = canBuild(sim, c.p, 'bastiao', c.x, c.y); // generic placement check (bounds, rift, overlap)
      if (!ok.ok) { if (p.human) emit(sim, { t: 'notice', p: c.p, text: ok.why }); return; }
      const to = territoryOwner(sim, c.x, c.y); if (to !== -1 && to !== c.p) { if (p.human) emit(sim, { t: 'notice', p: c.p, text: 'Território inimigo' }); return; }
      const frac = facOf(sim, c.p).jumpCostFrac;
      for (const k in p.res) p.res[k] = Math.floor(p.res[k] * (1 - frac));
      p.jumpsLeft--; nuc.jumpT = JUMP_CHANNEL; nuc.jumpTo = { x: c.x, y: c.y };
      for (const q of sim.players) if (q.alive) alertTo(sim, q.id, q.id === c.p ? 'Salto de Núcleo iniciado (60 s)' : p.name + ' iniciou um Salto de Núcleo!', nuc.x, nuc.y, q.id === c.p ? 'good' : 'warn');
      break; }
    case 'propose': {
      const q = sim.players[c.to]; if (!q || !q.alive || c.to === c.p || hasPact(sim, c.p, c.to)) return;
      if (sim.pending.some(pr => pr.from === c.p && pr.to === c.to)) return;
      const cc = pactCost(p); if (!canAfford(p, { minerio: cc })) { if (p.human) emit(sim, { t: 'notice', p: c.p, text: 'Caução: ' + cc + ' Minério' }); return; }
      sim.pending.push({ from: c.p, to: c.to, t: sim.time });
      emit(sim, { t: 'proposal', p: c.to, from: c.p });
      alertTo(sim, c.to, p.name + ' propõe Não-agressão (10 min, Caução 150)', null, null, 'info');
      if (p.human) emit(sim, { t: 'notice', p: c.p, text: 'Proposta enviada a ' + q.name });
      break; }
    case 'respond': {
      const idx = sim.pending.findIndex(pr => pr.to === c.p && pr.from === c.to); if (idx < 0) return;
      sim.pending.splice(idx, 1);
      const a = sim.players[c.to];
      if (!c.accept) { alertTo(sim, c.to, p.name + ' recusou o pacto', null, null, 'warn'); return; }
      const ca = pactCost(a), cp = pactCost(p);
      if (!canAfford(a, { minerio: ca }) || !canAfford(p, { minerio: cp })) { alertTo(sim, c.to, 'Pacto falhou: Caução insuficiente', null, null, 'warn'); return; }
      a.res.minerio -= ca; p.res.minerio -= cp;
      const pact = { a: a.id, b: p.id, until: sim.time + PACT_DURATION, since: sim.time, caucao: PACT_CAUCAO, caucaoA: ca, caucaoB: cp };
      a.pacts[p.id] = pact; p.pacts[a.id] = pact; a.stats.treaties++; p.stats.treaties++;
      alertTo(sim, a.id, 'Pacto de Não-agressão com ' + p.name + ' (10 min)', null, null, 'good');
      alertTo(sim, p.id, 'Pacto de Não-agressão com ' + a.name + ' (10 min)', null, null, 'good');
      emit(sim, { t: 'pact', a: a.id, b: p.id });
      break; }
    case 'break': {
      const pact = p.pacts[c.with]; if (!pact) return;
      const v = sim.players[c.with];
      delete p.pacts[c.with]; delete v.pacts[c.p];
      v.res.minerio += (pact.caucaoA || pact.caucao) + (pact.caucaoB || pact.caucao); // a vítima fica com as duas cauções
      p.rep = Math.max(-2, p.rep - 1); p.golpeT = 45; p.stats.betrayals++;
      alertTo(sim, c.with, p.name + ' QUEBROU O PACTO! Golpe de Traição ativo por 45 s', null, null, 'danger');
      alertTo(sim, c.p, 'Você quebrou o pacto: +20% de dano por 45 s. Reputação ↓ (' + REP_NAMES[p.rep] + ')', null, null, 'warn');
      emit(sim, { t: 'betrayal', by: c.p, victim: c.with });
      break; }
  }
}
function scaleCost(cost, m) { const o = {}; for (const k in cost) o[k] = cost[k] * m; return o; }
function hasBuilt(sim, pid, def) { for (const e of sim.ents) if (e.alive && e.kind === 'building' && e.owner === pid && e.def === def && e.built) return true; return false; }
function nucleoOf(sim, pid) { for (const e of sim.ents) if (e.alive && e.kind === 'building' && e.owner === pid && e.def === 'nucleo') return e; return null; }

// ---------- per-tick systems ----------
function computeEnergy(sim, p, dt) {
  let prod = 0, cons = 0;
  for (const e of sim.ents) {
    if (!e.alive || e.owner !== p.id) continue;
    if (e.kind === 'building') {
      const d = BUILDINGS[e.def];
      if (!e.built) continue;
      if (d.energyProd) {
        if (d.plasmaBurn) { if (p.res.plasma > 0) { prod += d.energyProd * (e.mod === 1 && e.def === 'reator' ? 1.6 : 1); p.res.plasma = Math.max(0, p.res.plasma - d.plasmaBurn * dt * (p.mods && p.mods.burnMul || 1)); } }
        else if (e.def === 'nucleo' && FACTIONS[p.faction].photosynthesis) { const nt = (1 - DM.cos(Math.PI * 2 * sim.time / 750)) / 2; prod += 95 - 50 * nt + ERA_NUCLEO.energy * ((p.era || 1) - 1); }
        else prod += d.energyProd + (e.def === 'nucleo' ? ERA_NUCLEO.energy * ((p.era || 1) - 1) : 0);
      }
      cons += d.energyUse || 0;
    } else if (e.kind === 'unit') cons += UNITS[e.def].energyUse || 0;
  }
  if (p.overchargeT > 0) prod *= 1.5;
  if (p.mods && p.mods.energyMul) prod *= p.mods.energyMul;
  if (p.blackoutT > 0) prod = 0;
  const ratio = cons > 0 ? prod / cons : 1;
  p.energy.prod = prod; p.energy.cons = cons; p.energy.ratio = ratio;
  const prev = p.energy.regime;
  p.energy.regime = ratio >= 1 ? 'pleno' : ratio >= 0.7 ? 'racionado' : 'colapso';
  if (prev !== p.energy.regime && p.human) emit(sim, { t: 'regime', p: p.id, regime: p.energy.regime });
}

function counterMult(sim, a, t) {
  const ac = a.cls, tc = t.kind === 'building' ? 'est' : t.cls;
  if (tc === 'civ' || ac === 'civ') return 1;
  let m = (COUNTER[ac] && COUNTER[ac][tc]) || 1;
  if (t.kind === 'building' && facOf(sim, t.owner).structNeutralVsVehicle && ac === 'vei') m = 1;
  if (a.kind === 'building' && facOf(sim, a.owner).structNeutralVsVehicle && tc === 'vei') m = 1;
  return m;
}
function unitCost(def) { const c = (UNITS[def] || BUILDINGS[def] || {}).cost || {}; return (c.minerio || 0) + (c.plasma || 0) + (c.dados || 0); }
function damageMult(sim, a) { // multiplicadores do atacante (pesquisa, Golpe de Traição, regime das torres, veterância)
  const p = sim.players[a.owner]; let m = 1;
  if (p.research.armamento) m *= 1.15; if (p.golpeT > 0) m *= 1.2;
  if (a.kind === 'building') { m *= regimeOf(sim, a.owner).defF; if (a.mod === 1 && a.def === 'torre') m *= 1.3; }
  if (a.kind === 'unit') m *= 1 + 0.1 * (a.rank || 0);
  if (p.saltoT > 0) m *= 1.35;
  if (a.kind === 'unit' && a.elo > 0) m *= 1 + FACTIONS[p.faction].elo.dmg * a.elo; // Elo de Sincronia (Quorith)
  if (a.kind === 'unit' && sim.auras && sim.auras[a.owner].moldes.length) { for (const mo of sim.auras[a.owner].moldes) if (mo !== a && dist(mo.x, mo.y, a.x, a.y) <= UNITS.molde.aura.buff) { m *= 1.15; break; } }
  return m;
}
function applyDamage(sim, attackerOwner, attacker, t, dmg, weapon) {
  const q = sim.players[t.owner];
  if (attacker && attacker.kind === 'unit') { const p0 = sim.players[attacker.owner]; if (FACTIONS[p0.faction].traits) { const tc = armorOf(t); const tr = p0.traits[attacker.def]; if (tr && tr[tc]) dmg *= 1.25; } }
  if (q && q.research.blindagem) dmg *= 0.87;
  if (q && t.kind === 'unit' && t.elo > 0) dmg *= 1 - FACTIONS[q.faction].elo.armor * t.elo;
  if (q && q.unissonoT > 0 && t.kind === 'unit') dmg *= 0.75;
  if (t.kind === 'unit') dmg *= 1 - 0.07 * (t.rank || 0);
  t.hp -= dmg; t.lastHitT = sim.time; t.lastHitBy = attackerOwner;
  const p = sim.players[attackerOwner]; if (p) p.stats.dmg += dmg;
  if (attacker && attacker.alive && attacker.kind === 'unit') {
    attacker.xp += dmg; const cost = Math.max(50, unitCost(attacker.def));
    const nr = attacker.xp >= cost * VET_RANKS[3] ? 3 : attacker.xp >= cost * VET_RANKS[2] ? 2 : attacker.xp >= cost * VET_RANKS[1] ? 1 : 0;
    if (nr > attacker.rank) { attacker.rank = nr; emit(sim, { t: 'promote', x: attacker.x, y: attacker.y, owner: attacker.owner, rank: nr, id: attacker.id }); }
    if (p && FACTIONS[p.faction].traits && t.cls !== 'civ') { // Traços Tessara: por tipo de unidade, contra a classe mais combatida (máximo 2)
      const tc = armorOf(t); const x = p.traitXp[attacker.def] = p.traitXp[attacker.def] || {}; x[tc] = (x[tc] || 0) + dmg;
      const tr = p.traits[attacker.def] = p.traits[attacker.def] || {};
      if (!tr[tc] && Object.keys(tr).length < 2 && x[tc] >= 280) { tr[tc] = true; alertTo(sim, p.id, 'Traço adquirido: ' + UNITS[attacker.def].name + ' +25% contra ' + CLASS_NAMES[tc], attacker.x, attacker.y, 'good'); emit(sim, { t: 'trait', owner: p.id, x: attacker.x, y: attacker.y }); }
    }
  }
  if (weapon && weapon.stun && (t.cls === 'vei' || t.kind === 'building')) t.cd = Math.max(t.cd || 0, 1.0);
  emit(sim, { t: 'hit', x: t.x, y: t.y, owner: t.owner, dmg });
  if (t.kind === 'building' && q) {
    if (t.def === 'nucleo' && sim.time - q.lastNucleoAlert > 10) { q.lastNucleoAlert = sim.time; alertTo(sim, q.id, 'NÚCLEO SOB ATAQUE!', t.x, t.y, 'danger'); }
    else if (!BUILDINGS[t.def].wall && sim.time - q.lastBaseAlert > 12) { q.lastBaseAlert = sim.time; alertTo(sim, q.id, 'Base sob ataque', t.x, t.y, 'danger'); }
  }
  if (t.hp <= 0) kill(sim, t, attackerOwner);
}
function armorOf(t) { return t.kind === 'building' ? 'est' : (t.cls || 'civ'); }
function fire(sim, a, t) {
  const w = a.kind === 'unit' ? UNITS[a.def].attack : BUILDINGS[a.def].attack;
  const ambush = a.kind === 'unit' && a.cloaked && a.def === 'infantaria';
  const base = w.dmg * damageMult(sim, a) * (ambush ? 1.5 : 1);
  a.cd = w.cd; a.lastAttack = sim.time; a.cloaked = false; a.aimAng = DM.atan2(t.y - a.y, t.x - a.x);
  const sx = a.x + DM.cos(a.aimAng) * a.r * 0.8, sy = a.y + DM.sin(a.aimAng) * a.r * 0.8;
  emit(sim, { t: 'shot', id: a.id, x1: sx, y1: sy, x2: t.x, y2: t.y, cls: a.cls, owner: a.owner, ambush, weapon: a.kind === 'unit' ? UNITS[a.def].weapon : BUILDINGS[a.def].weapon, beam: w.proj === 'beam' });
  if (w.proj === 'beam') {
    if (w.splash > 0) { const hit = []; queryGrid(sim, t.x, t.y, w.splash + 40, e => { if (!e.alive || e.owner === a.owner || e.owner < 0 || e.kind === 'crate' || e.kind === 'proj' || e.kind === 'wreck' || e.kind === 'rock' || !isEnemy(sim, a.owner, e.owner)) return; if (e.kind === 'unit' && UNITS[e.def].flying) return; if (dist(t.x, t.y, e.x, e.y) - e.r <= w.splash) hit.push(e); }); for (const e of hit) applyDamage(sim, a.owner, a, e, base * counterMult(sim, a, e) * (e === t ? 1 : 0.7), w); emit(sim, { t: 'impact', x: t.x, y: t.y, weapon: 'chama', splash: w.splash, hit: true, owner: a.owner }); }
    else applyDamage(sim, a.owner, a, t, base * counterMult(sim, a, t), w);
    return;
  }
  // projétil: viaja até o ponto previsto do alvo com inexatidão; acerta o que estiver lá
  const ang = sim.rand() * Math.PI * 2, err = sim.rand() * w.inacc;
  const lead = t.kind === 'unit' ? Math.min(1, dist(a.x, a.y, t.x, t.y) / w.speed) : 0;
  const tx = t.x + (t.x - t.px) * lead * 10 + DM.cos(ang) * err, ty = t.y + (t.y - t.py) * lead * 10 + DM.sin(ang) * err;
  const d = dist(sx, sy, tx, ty); const dir = [(tx - sx) / (d || 1), (ty - sy) / (d || 1)];
  const pr = { id: sim.nextId++, kind: 'proj', x: sx, y: sy, px: sx, py: sy, z: a.kind === 'building' ? a.r * 0.9 : 6, tx, ty, vx: dir[0] * w.speed, vy: dir[1] * w.speed, weapon: a.kind === 'unit' ? UNITS[a.def].weapon : BUILDINGS[a.def].weapon, owner: a.owner, shooter: a.id, target: t.id, dmg: base, total: d, done: 0, arc: w.proj === 'shell' ? Math.min(60, d * 0.25) : 0, flying: !!(t.kind === 'unit' && UNITS[t.def].flying), alive: true, r: 1 };
  sim.ents.push(pr); sim.byId.set(pr.id, pr);
}
function updateProjectile(sim, pr, dt) {
  const w = WEAPONS[pr.weapon]; const step = w.speed * dt;
  if (pr.done + step >= pr.total) { // impacto
    pr.x = pr.tx; pr.y = pr.ty; pr.alive = false;
    const shooter = sim.byId.get(pr.shooter); const atk = shooter && shooter.alive ? shooter : null;
    const fakeA = atk || { kind: 'unit', cls: w.cls, owner: pr.owner };
    let hitAny = false;
    if (w.splash > 0) {
      queryGrid(sim, pr.x, pr.y, w.splash + 40, e => {
        if (!e.alive || e.owner === pr.owner || e.owner < 0 || e.kind === 'crate' || e.kind === 'proj' || e.kind === 'wreck' || e.kind === 'rock') return;
        if (!isEnemy(sim, pr.owner, e.owner)) return;
        if (e.kind === 'unit' && UNITS[e.def].flying && !pr.flying) return;
        const dd = dist(pr.x, pr.y, e.x, e.y) - e.r; if (dd > w.splash) return;
        const fall = dd <= 0 ? 1 : 1 - dd / w.splash * 0.6;
        applyDamage(sim, pr.owner, atk, e, pr.dmg * fall * counterMult(sim, fakeA, e), w); hitAny = true;
      });
    } else {
      const t = sim.byId.get(pr.target);
      if (t && t.alive && dist(pr.x, pr.y, t.x, t.y) <= t.r + 10) { applyDamage(sim, pr.owner, atk, t, pr.dmg * counterMult(sim, fakeA, t), w); hitAny = true; }
      else { let best = null, bd = 12; queryGrid(sim, pr.x, pr.y, 30, e => { if (!e.alive || e.owner === pr.owner || e.owner < 0 || e.kind === 'crate' || e.kind === 'proj' || e.kind === 'wreck' || !isEnemy(sim, pr.owner, e.owner)) return; const dd = dist(pr.x, pr.y, e.x, e.y) - e.r; if (dd < bd) { bd = dd; best = e; } }); if (best) { applyDamage(sim, pr.owner, atk, best, pr.dmg * counterMult(sim, fakeA, best), w); hitAny = true; } }
    }
    emit(sim, { t: 'impact', x: pr.x, y: pr.y, weapon: pr.weapon, splash: w.splash, hit: hitAny, owner: pr.owner });
    return;
  }
  pr.done += step; pr.x += pr.vx * dt; pr.y += pr.vy * dt;
  const k = pr.done / pr.total; pr.z = (pr.arc ? DM.sin(k * Math.PI) * pr.arc : 0) + 6 * (1 - k) + 3;
}
function kill(sim, e, killer) {
  if (!e.alive) return;
  e.alive = false;
  const p = sim.players[e.owner];
  emit(sim, { t: 'death', x: e.x, y: e.y, r: e.r, kind: e.kind, def: e.def, owner: e.owner, cls: e.cls });
  if (e.kind === 'unit') {
    if (p) p.stats.unitsLost++;
    if (killer >= 0 && killer !== e.owner) sim.players[killer].stats.unitsKilled++;
    if (e.cargoTotal > 0) {
      const c = { id: sim.nextId++, kind: 'crate', x: e.x, y: e.y, r: 9, alive: true, owner: -1, cargo: Object.assign({}, e.cargo), stolen: e.stolen, bornT: sim.time };
      sim.ents.push(c); sim.byId.set(c.id, c);
      emit(sim, { t: 'crate', x: e.x, y: e.y });
      if (p && p.human) alertTo(sim, p.id, 'Caixa derrubada: ' + Math.round(e.cargoTotal) + ' em recursos', e.x, e.y, 'warn');
    }
    if (e.cls === 'vei' || e.def === 'coletor' || e.def === 'pirata') { // carcaça saqueável
      const wr = { id: sim.nextId++, kind: 'wreck', x: e.x, y: e.y, r: e.r, ang: e.ang || 0, alive: true, owner: -1, res: 'minerio', amount: Math.round(unitCost(e.def) * 0.35), max: Math.round(unitCost(e.def) * 0.35), bornT: sim.time, def: e.def };
      sim.ents.push(wr); sim.byId.set(wr.id, wr);
    }
  } else if (e.kind === 'building') {
    sim.navDirty = true;
    if (p) p.stats.buildingsLost++;
    if (killer >= 0 && killer !== e.owner) sim.players[killer].stats.buildingsDestroyed++;
    if (e.def === 'nucleo') eliminate(sim, e.owner, killer);
  }
}
function eliminate(sim, pid, killer) {
  const p = sim.players[pid]; if (!p.alive) return;
  p.alive = false; sim.navDirty = true;
  for (const e of sim.ents) if (e.alive && e.owner === pid) { e.alive = false; emit(sim, { t: 'death', x: e.x, y: e.y, r: e.r, kind: e.kind, def: e.def, owner: pid, cls: e.cls }); }
  for (const k in p.pacts) { const q = sim.players[k]; delete q.pacts[pid]; } p.pacts = {};
  for (const q of sim.players) if (q.alive) alertTo(sim, q.id, p.name + ' foi eliminado' + (killer >= 0 && killer !== pid ? ' por ' + sim.players[killer].name : ''), null, null, q.id === killer ? 'good' : 'warn');
  emit(sim, { t: 'eliminated', p: pid });
}

function acquire(sim, u, rad, unitsOnly) {
  let best = null, bd = Infinity;
  const vis = sim.vis[u.owner];
  queryGrid(sim, u.x, u.y, rad + 40, e => {
    if (e.owner === u.owner || e.owner < 0 || e.kind === 'crate') return;
    if (!isEnemy(sim, u.owner, e.owner)) return;
    if (!vis.has(e.id)) return;
    if (unitsOnly && e.kind !== 'unit') return;
    const d = dist(u.x, u.y, e.x, e.y) - e.r;
    if (d > rad) return;
    const score = d + (e.kind === 'building' ? (BUILDINGS[e.def].wall ? 320 : 200) : 0) + (e.cls === 'civ' ? 60 : 0);
    if (score < bd) { bd = score; best = e; }
  });
  return best;
}
function moveToward(sim, u, tx, ty, dt) {
  const dx = tx - u.x, dy = ty - u.y; const d = DM.hypot(dx, dy);
  const sp = speedOf(sim, u) * dt;
  if (d <= Math.max(sp, 4)) { u.x = tx; u.y = ty; return true; }
  if (!UNITS[u.def].flying && d > NAV * 1.2 && !lineFree(sim, u.x, u.y, tx, ty, u.owner)) {
    const f = flowField(sim, navIdx(tx, ty), u.owner); const ci = navIdx(u.x, u.y); let dir = f.dir[ci];
    let nx = 0, ny = 0;
    const cx = ci % NW, cy = (ci / NW) | 0;
    if (dir >= 0) { const ni = (cy + DY8[dir]) * NW + (cx + DX8[dir]); const g = sim.nav.gatePos.get(ni); if (g && !sim.nav.gates.has(ci)) { nx = g.x; ny = g.y; } else { nx = (cx + DX8[dir] + 0.5) * NAV; ny = (cy + DY8[dir] + 0.5) * NAV; } }
    else { // célula bloqueada ou sem rota: vai para o vizinho alcançável de menor custo
      let best = -1, bc = Infinity;
      for (let d = 0; d < 8; d++) { const x2 = cx + DX8[d], y2 = cy + DY8[d]; if (x2 < 0 || y2 < 0 || x2 >= NW || y2 >= NW) continue; const ni = y2 * NW + x2; if (f.cost[ni] >= 0 && f.cost[ni] < bc) { bc = f.cost[ni]; best = ni; } }
      if (best >= 0) { nx = (best % NW + 0.5) * NAV; ny = (((best / NW) | 0) + 0.5) * NAV; dir = 0; }
    }
    if (dir >= 0) {
      const ddx = nx - u.x, ddy = ny - u.y; const dd = DM.hypot(ddx, ddy) || 1;
      u.x += ddx / dd * sp; u.y += ddy / dd * sp; u.ang = DM.atan2(ddy, ddx); return false;
    }
  }
  u.x += dx / d * sp; u.y += dy / d * sp; u.ang = DM.atan2(dy, dx); return false;
}
function nearestDeposit(sim, u) {
  let best = null, bd = Infinity;
  for (const e of sim.ents) {
    if (!e.alive || e.kind !== 'building' || e.owner !== u.owner || !e.built || !BUILDINGS[e.def].deposit) continue;
    const d = dist(u.x, u.y, e.x, e.y); if (d < bd) { bd = d; best = e; }
  }
  return best;
}
function pickNode(sim, u) {
  const p = sim.players[u.owner];
  // weight: prefer resource with lowest stock
  const stock = p.res; const w = { minerio: 1, plasma: 1, dados: 0.8 };
  const lowest = ['minerio', 'plasma', 'dados'].sort((a, b) => stock[a] - stock[b])[0];
  w[lowest] *= 0.6;
  let best = null, bd = Infinity;
  for (const e of sim.ents) {
    if (!e.alive || (e.kind !== 'node' && e.kind !== 'wreck') || e.amount <= 0) continue;
    if (e.kind === 'node' && !inTerritory(sim, u.owner, e.x, e.y)) continue;
    if (e.kind === 'wreck' && dist(u.x, u.y, e.x, e.y) > 520) continue;
    const d = dist(u.x, u.y, e.x, e.y) * w[e.res] * (e.kind === 'wreck' ? 0.7 : 1);
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}
function deliver(sim, u) {
  const p = sim.players[u.owner];
  const mult = p.human ? 1 : (DIFFICULTY[p.difficulty] || DIFFICULTY.normal).income;
  let total = 0;
  for (const k in u.cargo) {
    let v = u.cargo[k];
    if (u.stolen) v *= facOf(sim, u.owner).stolenMult; else v *= mult * (p.mods && p.mods.harvestMul || 1);
    p.res[k] += v; total += v;
  }
  if (u.stolen) {
    p.stats.stolen += total;
    emit(sim, { t: 'float', x: u.x, y: u.y, text: 'ROUBO +' + Math.round(total), owner: u.owner, kind: 'steal' });
    if (!facOf(sim, u.owner).cleanTheft && u.victim >= 0 && sim.players[u.victim].alive) {
      // Rastro: victim learns where the stolen resources went
      const nuc = nucleoOf(sim, u.owner);
      if (nuc) alertTo(sim, u.victim, 'Rastro: recursos roubados entregues na base de ' + p.name, nuc.x, nuc.y, 'warn');
    }
  } else {
    p.stats.collected += total;
    emit(sim, { t: 'float', x: u.x, y: u.y, text: '+' + Math.round(total), owner: u.owner, kind: 'gain' });
  }
  u.cargo = { plasma: 0, minerio: 0, dados: 0 }; u.cargoTotal = 0; u.stolen = false; u.victim = -1;
}

function updateUnit(sim, u, dt) {
  const d = UNITS[u.def];
  if (u.cd > 0) u.cd -= dt;
  if (u.revealT > 0) u.revealT -= dt;
  const fac = facOf(sim, u.owner);
  if (u.tempUntil && sim.time >= u.tempUntil) { kill(sim, u, -1); return; } // Crias da Eclosão
  { const pm = sim.players[u.owner].mods; if (pm && pm.regen && u.hp < u.maxHp && sim.time - u.lastHitT > 5) u.hp = Math.min(u.maxHp, u.hp + pm.regen * dt); }
  if (fac.hunger && u.def === fac.hunger.def && !u.tempUntil && sim.tick % 10 === 0 && !inTerritory(sim, u.owner, u.x, u.y)) { const floor = u.maxHp * fac.hunger.floor; if (u.hp > floor) u.hp = Math.max(floor, u.hp - fac.hunger.rate); }
  u.cloaked = !!fac.cloak[u.def] && u.state !== 'siphon' && (sim.time - u.lastAttack) > 3;
  if (!u.cloaked && u.def !== 'ancora' && sim.auras && sim.auras[u.owner].anchors.length && (sim.time - u.lastAttack) > 3) { for (const an of sim.auras[u.owner].anchors) if (dist(an.x, an.y, u.x, u.y) <= UNITS.ancora.aura.cloak) { u.cloaked = true; break; } }
  if (d.heal && sim.tick % 5 === 0) { queryGrid(sim, u.x, u.y, d.heal.range + 40, e => { if (!e.alive || e.owner !== u.owner || e === u || (e.kind !== 'unit' && e.kind !== 'building')) return; if (dist(u.x, u.y, e.x, e.y) > d.heal.range || e.hp >= e.maxHp) return; if (e.kind === 'building' && !e.built) return; e.hp = Math.min(e.maxHp, e.hp + (e.kind === 'unit' ? d.heal.unit : d.heal.building) * dt * 5); }); }
  switch (u.state) {
    case 'idle': {
      if (d.attack) { const t = acquire(sim, u, d.attack.range + 70, false); if (t) { u.target = t.id; u.state = 'attack'; u.resume = null; } }
      else if (u.def === 'coletor') { const n = pickNode(sim, u); if (n) { u.node = n.id; u.state = 'harvest'; } }
      break; }
    case 'move': if (moveToward(sim, u, u.tx, u.ty, dt)) u.state = 'idle'; break;
    case 'attackmove': {
      if (d.attack) { const t = acquire(sim, u, d.attack.range + 90, false); if (t) { u.target = t.id; u.state = 'attack'; u.resume = { x: u.tx, y: u.ty }; break; } }
      if (moveToward(sim, u, u.tx, u.ty, dt)) u.state = 'idle';
      break; }
    case 'attack': {
      const t = sim.byId.get(u.target);
      if (!t || !t.alive || !d.attack || !sim.vis[u.owner].has(t.id) && t.owner !== u.owner || !isEnemy(sim, u.owner, t.owner)) {
        if (u.resume) { u.state = 'attackmove'; u.tx = u.resume.x; u.ty = u.resume.y; u.resume = null; } else u.state = 'idle';
        u.target = null; break;
      }
      const dd = dist(u.x, u.y, t.x, t.y);
      if (dd <= d.attack.range + t.r) { u.ang = DM.atan2(t.y - u.y, t.x - u.x); if (u.cd <= 0) fire(sim, u, t); }
      else moveToward(sim, u, t.x, t.y, dt);
      break; }
    case 'harvest': {
      const n = sim.byId.get(u.node);
      if (!n || !n.alive || n.amount <= 0) { const m = pickNode(sim, u); if (m) u.node = m.id; else u.state = u.cargoTotal > 0 ? 'return' : 'idle'; break; }
      if (dist(u.x, u.y, n.x, n.y) <= u.r + n.r + 8) {
        const take = Math.min(d.harvestRate * dt * (n.res === 'plasma' && inStorm(sim, n.x, n.y) ? 2 : 1), n.amount, d.capacity - u.cargoTotal);
        n.amount -= take; u.cargo[n.res] += take; u.cargoTotal += take;
        if (u.cargoTotal >= d.capacity - 0.01 || n.amount <= 0) u.state = 'return';
      } else moveToward(sim, u, n.x, n.y, dt);
      break; }
    case 'return': {
      const dep = nearestDeposit(sim, u);
      if (!dep) { u.state = 'idle'; break; }
      if (dist(u.x, u.y, dep.x, dep.y) <= u.r + dep.r + 10) {
        deliver(sim, u);
        if (u.def === 'coletor') { const n = sim.byId.get(u.node); if (n && n.alive && n.amount > 0) u.state = 'harvest'; else { const m = pickNode(sim, u); if (m) { u.node = m.id; u.state = 'harvest'; } else u.state = 'idle'; } }
        else u.state = 'idle';
      } else moveToward(sim, u, dep.x, dep.y, dt);
      break; }
    case 'siphon': {
      const b = sim.byId.get(u.target);
      if (!b || !b.alive || !isEnemy(sim, u.owner, b.owner)) { u.state = u.cargoTotal > 0 ? 'return' : 'idle'; u.target = null; break; }
      if (dist(u.x, u.y, b.x, b.y) <= d.siphonRange + b.r) {
        const v = sim.players[b.owner];
        if (u.siphonT === 0) {
          const delay = v.energy.regime === 'pleno' ? 3 : v.energy.regime === 'racionado' ? 4 : 5;
          u.alertAt = sim.time + delay; u.alerted = false;
        }
        u.siphonT += dt;
        if (!u.alerted && sim.time >= u.alertAt) { u.alerted = true; alertTo(sim, b.owner, 'ALERTA DE SIFÃO em ' + BUILDINGS[b.def].name, b.x, b.y, 'danger'); u.revealT = 2; }
        const rate = d.siphonRate * dt;
        for (const k of ['plasma', 'minerio']) {
          const take = Math.min(rate, v.res[k], u.cargoCap - u.cargoTotal);
          if (take > 0) { v.res[k] -= take; u.cargo[k] += take; u.cargoTotal += take; v.stats.lost += take; }
        }
        u.stolen = u.cargoTotal > 0; u.victim = b.owner;
        if (fac.silence) queryGrid(sim, u.x, u.y, fac.silence + 40, e => { if (e.alive && e.kind === 'building' && BUILDINGS[e.def].attack && isEnemy(sim, u.owner, e.owner) && dist(u.x, u.y, e.x, e.y) <= fac.silence) e.cd = Math.max(e.cd || 0, 0.6); });
        emit(sim, { t: 'siphon', x1: u.x, y1: u.y, x2: b.x, y2: b.y, owner: u.owner });
        if (u.siphonT >= d.siphonMax || u.cargoTotal >= u.cargoCap - 0.01) { u.state = 'return'; u.siphonT = 0; }
      } else moveToward(sim, u, b.x, b.y, dt);
      break; }
    case 'devour': { // Carniceiro (Vorag): come carcaças (150% do valor) e corrói Nódulos inimigos em biomassa
      const t = sim.byId.get(u.target); const dv = fac.devour;
      if (!t || !t.alive || !dv || (t.kind === 'wreck' ? t.amount <= 0 : (t.owner === u.owner || !isEnemy(sim, u.owner, t.owner)))) { u.state = 'idle'; u.target = null; if (u.devoured > 0) { emit(sim, { t: 'float', x: u.x, y: u.y, text: '+' + Math.round(u.devoured), owner: u.owner, kind: 'gain' }); u.devoured = 0; } break; }
      if (dist(u.x, u.y, t.x, t.y) <= dv.range + t.r) {
        const p = sim.players[u.owner]; const inc = p.human ? 1 : (DIFFICULTY[p.difficulty] || DIFFICULTY.normal).income;
        if (t.kind === 'wreck') { const take = Math.min(t.amount, dv.wreck * dt); t.amount -= take; const gain = take * dv.wreckMult * inc; p.res.minerio += gain; p.stats.collected += gain; u.devoured = (u.devoured || 0) + gain; }
        else { applyDamage(sim, u.owner, u, t, dv.nodDmg * dt, null); const gain = dv.nodGain * dt * inc; p.res.minerio += gain; p.stats.collected += gain; u.devoured = (u.devoured || 0) + gain; if (sim.tick % 50 === 0) alertTo(sim, t.owner, 'Carniceiro devorando seu Nódulo!', t.x, t.y, 'danger'); }
        u.lastAttack = sim.time; emit(sim, { t: 'siphon', x1: u.x, y1: u.y, x2: t.x, y2: t.y, owner: u.owner });
      } else moveToward(sim, u, t.x, t.y, dt);
      break; }
    case 'pickup': {
      const c = sim.byId.get(u.target);
      if (!c || !c.alive) { u.state = 'idle'; break; }
      if (dist(u.x, u.y, c.x, c.y) > u.r + c.r + 6) moveToward(sim, u, c.x, c.y, dt); else u.state = 'idle';
      break; }
  }
}
function pickupCrates(sim) {
  for (const c of sim.ents) {
    if (!c.alive || c.kind !== 'crate') continue;
    let taker = null;
    queryGrid(sim, c.x, c.y, 30, e => { if (!taker && e.kind === 'unit' && e.alive && dist(e.x, e.y, c.x, c.y) <= e.r + c.r + 6) taker = e; });
    if (taker) {
      const p = sim.players[taker.owner]; let total = 0;
      for (const k in c.cargo) { p.res[k] += c.cargo[k]; total += c.cargo[k]; }
      p.stats.stolen += c.stolen ? total : 0; if (!c.stolen) p.stats.collected += total;
      c.alive = false;
      emit(sim, { t: 'float', x: c.x, y: c.y, text: 'CAIXA +' + Math.round(total), owner: taker.owner, kind: 'steal' });
      if (p.human) alertTo(sim, p.id, 'Caixa recolhida: +' + Math.round(total), c.x, c.y, 'good');
    } else if (sim.time - c.bornT > 120) c.alive = false;
  }
}
function updateBuilding(sim, b, dt) {
  const d = BUILDINGS[b.def]; const p = sim.players[b.owner];
  if (b.cd > 0) b.cd -= dt;
  if (b.revealT > 0) b.revealT -= dt;
  b.cloaked = !!facOf(sim, b.owner).cloak[b.def];
  const reg = regimeOf(sim, b.owner);
  if (!b.built) {
    const dp = Math.min(1 - b.progress, (d.buildTime > 0 ? dt / d.buildTime : 1) * reg.prodF);
    b.progress += dp; b.hp = Math.min(b.maxHp, b.hp + b.maxHp * 0.7 * dp);
    if (b.progress >= 0.999) { b.built = true; b.progress = 1; emit(sim, { t: 'built', p: b.owner, x: b.x, y: b.y, def: b.def }); }
    return;
  }
  if (b.jumpT > 0) {
    b.jumpT -= dt;
    if (b.jumpT <= 0) {
      const from = { x: b.x, y: b.y };
      b.x = b.jumpTo.x; b.y = b.jumpTo.y; b.px = b.x; b.py = b.y; b.jumpTo = null; b.jumpT = 0; sim.navDirty = true;
      emit(sim, { t: 'jump', p: b.owner, from, to: { x: b.x, y: b.y } });
      for (const q of sim.players) if (q.alive) alertTo(sim, q.id, q.id === b.owner ? 'Salto de Núcleo concluído' : p.name + ' saltou o Núcleo!', b.x, b.y, q.id === b.owner ? 'good' : 'warn');
    }
    return; // no production while jumping
  }
  if (b.def === 'nucleo' && p.evolveT > 0) { // 4.1d: evolução da Era em curso
    p.evolveT -= dt * reg.prodF;
    if (p.evolveT <= 0) { p.evolveT = 0; p.era = Math.min(3, (p.era || 1) + 1); const k = 1 + ERA_NUCLEO.hp * (p.era - 1), k0 = 1 + ERA_NUCLEO.hp * (p.era - 2); b.maxHp = BUILDINGS.nucleo.hp * k; b.hp = Math.min(b.maxHp, b.hp * k / k0 + BUILDINGS.nucleo.hp * 0.1);
      emit(sim, { t: 'era', p: b.owner, era: p.era, x: b.x, y: b.y }); alertTo(sim, b.owner, 'Era ' + ERAS[p.era].roman + ' — ' + ERAS[p.era].name + ': ' + ERAS[p.era].desc, b.x, b.y, 'good');
      for (const q of sim.players) if (q.alive && q.id !== b.owner) alertTo(sim, q.id, p.name + ' chegou à Era ' + ERAS[p.era].roman, b.x, b.y, 'warn'); }
  }
  if (b.upT > 0) { b.upT -= dt * reg.prodF; if (b.upT <= 0) { b.upT = 0; b.mod = 1; const md = d.module; if (b.def === 'torre') { b.maxHp *= 1.4; b.hp *= 1.4; } emit(sim, { t: 'module', p: b.owner, def: b.def, x: b.x, y: b.y }); alertTo(sim, b.owner, md.name + ' pronta: ' + md.desc, b.x, b.y, 'good'); } }
  if (b.queue.length) {
    let mult = reg.prodF; if (p.mods && p.mods.prodMul) mult *= p.mods.prodMul;
    if (facOf(sim, b.owner).lineBonus && d.produces && b.def !== 'nucleo') {
      let n = 0; queryGrid(sim, b.x, b.y, 160, e => { if (e !== b && e.kind === 'building' && e.owner === b.owner && e.built && BUILDINGS[e.def].produces && e.def !== 'nucleo' && dist(e.x, e.y, b.x, b.y) <= 150) n++; });
      mult *= 1 + 0.12 * Math.min(4, n);
    }
    const it = b.queue[0];
    if (!it.paid) { // 4.1a: paga ao começar; Lotes Vehnar (4+ iguais na fila) saem pela metade
      if (facOf(sim, b.owner).lotes) { let same = 0; for (const q of b.queue) if (q.def === it.def) same++; it.mult = same >= 4 ? 0.5 : 1; }
      const cost = scaleCost(UNITS[it.def].cost, it.mult); if (!canAfford(p, cost)) { it.waiting = true; mult = 0; } else { pay(p, UNITS[it.def].cost, it.mult); it.paid = true; it.waiting = false; } }
    it.t += dt * mult;
    if (it.t >= it.total) {
      b.queue.shift();
      const ang = b.rally ? DM.atan2(b.rally.y - b.y, b.rally.x - b.x) : DM.atan2(CY - b.y, CX - b.x);
      const u = addUnit(sim, b.owner, it.def, b.x + DM.cos(ang) * (b.r + 14), b.y + DM.sin(ang) * (b.r + 14));
      if (b.rally) { u.state = 'move'; u.tx = b.rally.x + (sim.rand() - 0.5) * 30; u.ty = b.rally.y + (sim.rand() - 0.5) * 30; }
      if (b.mod === 1 && b.def === 'quartel' && u.cls === 'inf') { u.rank = 1; u.xp = Math.max(50, unitCost(it.def)) * VET_RANKS[1]; } // Academia
      emit(sim, { t: 'spawn', p: b.owner, x: u.x, y: u.y, def: it.def });
      if (UNITS[it.def].pair && p.mods && p.mods.brood >= 3) { const u3 = addUnit(sim, b.owner, it.def, b.x + DM.cos(ang - 0.5) * (b.r + 14), b.y + DM.sin(ang - 0.5) * (b.r + 14)); if (b.rally) { u3.state = 'move'; u3.tx = b.rally.x + (sim.rand() - 0.5) * 30; u3.ty = b.rally.y + (sim.rand() - 0.5) * 30; } emit(sim, { t: 'spawn', p: b.owner, x: u3.x, y: u3.y, def: it.def }); } // Fome Sem Fim: trios
      if (UNITS[it.def].pair) { const u2 = addUnit(sim, b.owner, it.def, b.x + DM.cos(ang + 0.5) * (b.r + 14), b.y + DM.sin(ang + 0.5) * (b.r + 14)); if (b.rally) { u2.state = 'move'; u2.tx = b.rally.x + (sim.rand() - 0.5) * 30; u2.ty = b.rally.y + (sim.rand() - 0.5) * 30; } emit(sim, { t: 'spawn', p: b.owner, x: u2.x, y: u2.y, def: it.def }); }
    }
  }
  if (d.attack && b.cd <= 0) {
    const t = acquire(sim, b, d.attack.range, false);
    if (t) fire(sim, b, t);
  }
}
function separate(sim) {
  const units = [];
  for (const e of sim.ents) if (e.alive && e.kind === 'unit') units.push(e);
  for (const u of units) {
    let fx = 0, fy = 0, bfx = 0, bfy = 0;
    // Dentro do vão de um portão próprio (36 wu), os muros do próprio jogador não empurram: o portão é a passagem, mesmo para veículos largos.
    let inOwnGate = false; if (!UNITS[u.def].flying && sim.nav.gatePos.size) { for (const g of sim.nav.gatePos.values()) if (g.alive && g.owner === u.owner && dist(u.x, u.y, g.x, g.y) < 36) { inOwnGate = true; break; } }
    queryGrid(sim, u.x, u.y, 40, e => {
      if (e === u || !e.alive) return;
      if (e.kind === 'unit') {
        if (UNITS[e.def].flying !== UNITS[u.def].flying) return;
        const dx = u.x - e.x, dy = u.y - e.y; const dd = DM.hypot(dx, dy) || 0.01; const min = u.r + e.r + 1;
        if (dd < min) { const push = (min - dd) * 0.5; fx += dx / dd * push; fy += dy / dd * push; }
      } else if (e.kind === 'building' || e.kind === 'rock') {
        if (UNITS[u.def].flying) return;
        if (e.kind === 'building' && BUILDINGS[e.def].gate && e.owner === u.owner) return; // portão próprio: passa
        if (inOwnGate && e.kind === 'building' && BUILDINGS[e.def].wall && e.owner === u.owner) return; // muro ao lado do próprio portão: não trava a passagem
        const dx = u.x - e.x, dy = u.y - e.y; const dd = DM.hypot(dx, dy) || 0.01; const min = u.r + e.r + 2;
        if (dd < min) { const push = (min - dd); fx += dx / dd * push; fy += dy / dd * push; bfx += dx / dd * push; bfy += dy / dd * push; }
      }
    });
    // deslizar ao longo de obstáculos (muros e prédios) em direção ao destino
    if ((bfx || bfy) && (u.state === 'move' || u.state === 'attackmove' || u.state === 'attack' || u.state === 'harvest' || u.state === 'return' || u.state === 'siphon' || u.state === 'pickup')) {
      let gx = u.tx, gy = u.ty;
      if (u.state === 'attack' || u.state === 'siphon' || u.state === 'pickup') { const t = sim.byId.get(u.target); if (t) { gx = t.x; gy = t.y; } }
      else if (u.state === 'harvest') { const n = sim.byId.get(u.node); if (n) { gx = n.x; gy = n.y; } }
      else if (u.state === 'return') { const d = nearestDeposit(sim, u); if (d) { gx = d.x; gy = d.y; } }
      const dxg = gx - u.x, dyg = gy - u.y; const bl = DM.hypot(bfx, bfy) || 1;
      let tx = -bfy / bl, ty = bfx / bl; if (tx * dxg + ty * dyg < 0) { tx = -tx; ty = -ty; }
      const sp = speedOf(sim, u) * TICK * 0.85; fx += tx * sp; fy += ty * sp;
    }
    if (!UNITS[u.def].flying) {
      const dx = u.x - CX, dy = u.y - CY; const dd = DM.hypot(dx, dy) || 0.01; const min = RIFT_R + u.r;
      if (dd < min) { fx += dx / dd * (min - dd); fy += dy / dd * (min - dd); }
    }
    if (fx || fy) { u.x = clamp(u.x + fx, 10, WORLD - 10); u.y = clamp(u.y + fy, 10, WORLD - 10); }
  }
}
function computeVisibility(sim) {
  for (const p of sim.players) {
    const vis = sim.vis[p.id]; vis.clear();
    if (!p.alive) continue;
    const circles = [], detectors = [];
    for (const e of sim.ents) {
      if (!e.alive || e.owner !== p.id) continue;
      if (e.kind !== 'unit' && e.kind !== 'building') continue;
      circles.push([e.x, e.y, sensorRadius(sim, e)]);
      if (e.kind === 'building' && e.built && BUILDINGS[e.def].detect) detectors.push([e.x, e.y, BUILDINGS[e.def].detect]);
    }
    for (const e of sim.ents) {
      if (!e.alive || e.owner === p.id || e.kind === 'node' || e.kind === 'rock') continue;
      if (e.kind === 'proj' && e.owner === p.id) { vis.add(e.id); continue; }
      let seen = false;
      if (e.kind === 'building' && e.built && e.def === 'reator' && facOf(sim, e.owner).smoke) seen = true;
      if (!seen) for (const c of circles) { if (dist(e.x, e.y, c[0], c[1]) <= c[2] + e.r) { seen = true; break; } }
      if (seen && e.cloaked && !(e.revealT > 0)) {
        seen = false;
        for (const c of detectors) { if (dist(e.x, e.y, c[0], c[1]) <= c[2] + e.r) { seen = true; break; } }
      }
      if (seen) vis.add(e.id);
    }
  }
}
function updatePacts(sim) {
  for (let i = sim.pending.length - 1; i >= 0; i--) if (sim.time - sim.pending[i].t > PROPOSAL_TTL) sim.pending.splice(i, 1);
  const done = new Set();
  for (const p of sim.players) for (const k in p.pacts) {
    const pact = p.pacts[k]; if (done.has(pact)) continue;
    if (sim.time >= pact.until) {
      done.add(pact);
      const a = sim.players[pact.a], b = sim.players[pact.b];
      delete a.pacts[b.id]; delete b.pacts[a.id];
      a.res.minerio += pact.caucaoA || pact.caucao; b.res.minerio += pact.caucaoB || pact.caucao;
      a.rep = Math.min(2, a.rep + repGain(a)); b.rep = Math.min(2, b.rep + repGain(b));
      if (a.alive) alertTo(sim, a.id, 'Pacto cumprido com ' + b.name + '. Caução devolvida. Reputação ↑ (' + REP_NAMES[a.rep] + ')', null, null, 'good');
      if (b.alive) alertTo(sim, b.id, 'Pacto cumprido com ' + a.name + '. Caução devolvida. Reputação ↑ (' + REP_NAMES[b.rep] + ')', null, null, 'good');
    }
  }
}
function score(sim, p) {
  let s = 0;
  for (const e of sim.ents) {
    if (!e.alive || e.owner !== p.id) continue;
    if (e.kind === 'building') { s += BUILDINGS[e.def].wall ? 10 : 100; if (e.def === 'nodulo') s += 300; if (e.def === 'nucleo') s += 200; }
    else if (e.kind === 'unit') { const c = UNITS[e.def].cost; s += (c.minerio || 0) + (c.plasma || 0) + (c.dados || 0); }
  }
  s += p.res.plasma + p.res.minerio + p.res.dados;
  return Math.round(s);
}
function checkEnd(sim) {
  if (sim.result) return;
  const humans = sim.players.filter(p => p.human), ais = sim.players.filter(p => !p.human);
  const humanAlive = humans.some(p => p.alive), aiAlive = ais.some(p => p.alive);
  const scores = sim.players.map(p => ({ id: p.id, name: p.name, score: p.alive ? score(sim, p) : 0, alive: p.alive }));
  if (humans.length >= 2) { // multiplayer: a partida acaba quando sobra um jogador ou o tempo termina; cada cliente decide o próprio resultado
    const aliveN = sim.players.filter(p => p.alive).length;
    if (aliveN <= 1 || sim.time >= sim.maxTime) { const best = scores.filter(s2 => s2.alive).sort((a, b) => b.score - a.score)[0]; sim.result = { outcome: 'over', reason: aliveN <= 1 ? 'Último Núcleo de pé.' : 'Fim do Alinhamento: vitória por Domínio.', scores, winner: best ? best.id : -1 }; emit(sim, { t: 'end', result: sim.result }); }
    return;
  }
  if (humans.length === 0) { // headless mode: last one standing or time
    const aliveN = sim.players.filter(p => p.alive).length;
    if (aliveN <= 1) sim.result = { outcome: 'headless', reason: 'Último sobrevivente', scores };
    else if (sim.time >= sim.maxTime) sim.result = { outcome: 'headless', reason: 'Tempo', scores };
    if (sim.result) emit(sim, { t: 'end', result: sim.result });
    return;
  }
  if (!humanAlive) sim.result = { outcome: 'defeat', reason: 'Seu Núcleo foi destruído.', scores };
  else if (!aiAlive) sim.result = { outcome: 'victory', reason: 'Todos os Núcleos inimigos caíram.', scores };
  else if (sim.time >= sim.maxTime) {
    const best = scores.slice().sort((a, b) => b.score - a.score)[0];
    const h = humans[0];
    sim.result = { outcome: best.id === h.id ? 'victory' : 'defeat', reason: 'Fim do Alinhamento: vitória por Domínio de ' + best.name + '.', scores };
  }
  if (sim.result) emit(sim, { t: 'end', result: sim.result });
}

function step(sim) {
  const dt = TICK;
  sim.events = sim.events ? sim.events.slice(sim._evRet || 0) : []; // 4.0e: só os eventos emitidos depois do último retorno (roteiros da campanha) seguem para este passo; saída apenas, fora do hash
  if (sim.result) { sim._evRet = sim.events.length; return sim.events; }
  for (const e of sim.ents) if (e.kind !== 'node') { e.px = e.x; e.py = e.y; }
  if (sim.navDirty) rebuildNav(sim);
  rebuildGrid(sim);
  updateStorm(sim, dt);
  const cmds = sim.cmdQueue; sim.cmdQueue = [];
  for (const c of cmds) processCommand(sim, c);
  for (const p of sim.players) {
    if (!p.alive) continue;
    if (p.overchargeT > 0) p.overchargeT -= dt;
    if (p.blackoutT > 0) p.blackoutT -= dt;
    if (p.speedBuffT > 0) p.speedBuffT -= dt;
    if (p.golpeT > 0) p.golpeT -= dt; if (p.saltoT > 0) p.saltoT -= dt; if (p.unissonoT > 0) p.unissonoT -= dt;
    computeEnergy(sim, p, dt);
  }
  updatePacts(sim);
  sim.auras = sim.players.map(() => ({ anchors: [], moldes: [], diapasoes: [] }));
  for (const e of sim.ents) { if (!e.alive || e.kind !== 'unit') continue; if (e.def === 'ancora') sim.auras[e.owner].anchors.push(e); else if (e.def === 'molde') sim.auras[e.owner].moldes.push(e); else if (e.def === 'diapasao') sim.auras[e.owner].diapasoes.push(e); }
  if (sim.tick % 5 === 0) updateElo(sim);
  for (const e of sim.ents) { if (!e.alive) continue; if (e.kind === 'building') updateBuilding(sim, e, dt); }
  for (const e of sim.ents) { if (!e.alive) continue; if (e.kind === 'unit') updateUnit(sim, e, dt); else if (e.kind === 'proj') { e.px = e.x; e.py = e.y; updateProjectile(sim, e, dt); } else if (e.kind === 'wreck' && (e.amount <= 0 || sim.time - e.bornT > 150)) e.alive = false; }
  separate(sim);
  pickupCrates(sim);
  // prune
  if (sim.tick % 10 === 0) {
    const keep = [];
    for (const e of sim.ents) { if (e.alive) keep.push(e); else sim.byId.delete(e.id); }
    sim.ents = keep;
  }
  computeVisibility(sim);
  if (sim.tick % 3 === 0) markExplored(sim);
  sim.tick++; sim.time = sim.tick * TICK;
  checkEnd(sim);
  sim._evRet = sim.events.length; return sim.events;
}

// ---------- queries for UI/AI ----------
function entitiesOf(sim, pid) { const out = []; for (const e of sim.ents) if (e.alive && e.owner === pid) out.push(e); return out; }
function armyValue(sim, pid) {
  let v = 0;
  for (const e of sim.ents) if (e.alive && e.owner === pid && e.kind === 'unit' && UNITS[e.def].attack && !UNITS[e.def].epic) { const c = UNITS[e.def].cost; v += (c.minerio || 0) + (c.plasma || 0) + (c.dados || 0); }
  return v;
}
function hash(sim) { // cheap state hash for determinism tests
  let h = 2166136261;
  const mix = v => { h ^= (v | 0); h = Math.imul(h, 16777619) >>> 0; };
  for (const e of sim.ents) { if (!e.alive) continue; mix(e.id); mix(Math.round(e.x * 10)); mix(Math.round(e.y * 10)); mix(Math.round((e.hp || 0) * 10)); mix(Math.round((e.amount || 0) * 10)); }
  for (const p of sim.players) { mix(Math.round(p.res.plasma * 10)); mix(Math.round(p.res.minerio * 10)); mix(Math.round(p.res.dados * 10)); mix(p.rep); }
  return h >>> 0;
}

// ---------- 4.1c: salvamento e retomada (fotografia exata do estado) ----------
// Só o que muda durante a partida: o mapa estático (biomas, adereços) é refeito pelo createSim com o mesmo cfg.
// Índices derivados (byId, grade espacial, campos de fluxo) são reconstruídos; números especiais (-0, ±Infinity, NaN) viajam marcados.
const b64 = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return (typeof btoa === 'function' ? btoa(s) : Buffer.from(s, 'binary').toString('base64')); };
const unb64 = str => { const s = typeof atob === 'function' ? atob(str) : Buffer.from(str, 'base64').toString('binary'); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; };
function jsonSafe(v) { // cópia profunda só com JSON puro; preserva -0, ±Infinity e NaN
  if (typeof v === 'number') { if (Number.isFinite(v)) return Object.is(v, -0) ? { $n: '-0' } : v; return { $n: String(v) }; }
  if (v === null || typeof v !== 'object') return typeof v === 'function' ? undefined : v;
  if (Array.isArray(v)) return v.map(jsonSafe);
  const o = {}; for (const k of Object.keys(v)) { const x = v[k]; if (x === undefined || typeof x === 'function') continue; o[k] = jsonSafe(x); } return o;
}
function jsonBack(v) {
  if (v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map(jsonBack);
  if (typeof v.$n === 'string' && Object.keys(v).length === 1) return v.$n === '-0' ? -0 : Number(v.$n);
  const o = {}; for (const k of Object.keys(v)) o[k] = jsonBack(v[k]); return o;
}
function snapshot(sim) {
  const nav = sim.nav;
  return { v: 1, hash: hash(sim), tick: sim.tick, time: sim.time, seed: sim.seed, nextId: sim.nextId, maxTime: sim.maxTime, rand: sim.rand.state(),
    ents: jsonSafe(sim.ents), players: jsonSafe(sim.players), cmdQueue: jsonSafe(sim.cmdQueue), pending: jsonSafe(sim.pending), result: jsonSafe(sim.result),
    storm: jsonSafe(sim.storm), nextStorm: jsonSafe(sim.nextStorm), vis: sim.vis.map(st => [...st]), explored: sim.explored.map(b64),
    navDirty: !!sim.navDirty, nav: { blocked: b64(nav.blocked), gates: [...nav.gates], gatePos: [...nav.gatePos].map(([i, e]) => [i, e.id]), version: nav.version },
    auras: sim.auras ? sim.auras.map(a => ({ anchors: a.anchors.map(e => e.id), moldes: a.moldes.map(e => e.id), diapasoes: a.diapasoes.map(e => e.id) })) : null };
}
// aplica a fotografia num sim recém-criado com o mesmo cfg (createSim) e devolve o mesmo objeto
function restore(sim, snap) {
  if (!snap || snap.v !== 1) throw new Error('salvamento em formato desconhecido');
  sim.tick = snap.tick; sim.time = snap.time; sim.seed = snap.seed; sim.nextId = snap.nextId; sim.maxTime = snap.maxTime; sim.rand.setState(snap.rand);
  sim.ents = jsonBack(snap.ents); sim.players = jsonBack(snap.players); sim.cmdQueue = jsonBack(snap.cmdQueue); sim.pending = jsonBack(snap.pending); sim.result = jsonBack(snap.result);
  sim.storm = jsonBack(snap.storm); sim.nextStorm = jsonBack(snap.nextStorm); sim.vis = snap.vis.map(a => new Set(a)); sim.explored = snap.explored.map(unb64);
  sim.byId = new Map(); for (const e of sim.ents) sim.byId.set(e.id, e);
  const nav = sim.nav; nav.blocked = unb64(snap.nav.blocked); nav.gates = new Map(snap.nav.gates); nav.gatePos = new Map(snap.nav.gatePos.map(([i, id]) => [i, sim.byId.get(id)]).filter(x => x[1])); nav.fields = new Map(); nav.version = snap.nav.version; sim.navDirty = snap.navDirty;
  sim.grid = new Map(); rebuildGrid(sim);
  if (snap.auras) sim.auras = snap.auras.map(a => ({ anchors: a.anchors.map(id => sim.byId.get(id)).filter(Boolean), moldes: a.moldes.map(id => sim.byId.get(id)).filter(Boolean), diapasoes: a.diapasoes.map(id => sim.byId.get(id)).filter(Boolean) }));
  sim.events = []; sim._evRet = 0;
  const h = hash(sim); if (h !== snap.hash) console.warn('[ARD] retomada: hash ' + h + ' difere do salvo ' + snap.hash);
  return sim;
}

ARD.sim = {
  TICK, WORLD, CX, CY, RIFT_R, FACTIONS, BUILDINGS, UNITS, WEAPONS, COUNTER, CLASS_NAMES, VET_RANKS, unitCost, RESEARCH, REGIME, DIFFICULTY, REP_NAMES,
  SUPER_COST, SUPER_CD, OVERCHARGE_COST, OVERCHARGE_CD, PACT_CAUCAO, PACT_DURATION, JUMP_CHANNEL, PLAYER_COLORS, RACE_SHADES, assignColors, FACTION_EXTRAS, producesFor,
  NAV, NW, TILE, TILES, BIOMES, navIdx, passable, flowField, lineFree, inStorm,
  DM,
  createSim, step, enqueue, snapshot, restore, jsonSafe, jsonBack, ERAS, ASCENSION, eraOf, lockReason, eraBlock, territoryOf, canBuild, canAfford, inTerritory, territoryOwner, canSee, entitiesOf, armyValue, hasBuilt, nucleoOf, score, hash, dist, hasPact, isEnemy, sensorRadius, unitName, pactCost, seesPoint, spawnUnit, forceStorm,
};
})(globalThis.ARD = globalThis.ARD || {});
