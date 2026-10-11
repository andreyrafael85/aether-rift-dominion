/* Aether Rift: Dominion — Campanha "O Grande Alinhamento" (4.0e; renomeada na 4.1b): atos, missões com roteiro, conquistas, relíquias e o executor.
   Missões são partidas solo com objetivos (principais e bônus), falas dos líderes e eventos roteirizados (ondas, comboios,
   pactos forçados, tempestades, escolta). O executor roda depois de cada passo da simulação e só usa comandos e utilitários
   determinísticos da sim (spawnUnit, forceStorm, enqueue), então a mesma semente reproduz a mesma missão. */
(function (ARD) {
'use strict';
const S = ARD.sim;
const RACES = ['vehnar', 'erevane', 'tessara', 'quorith', 'vorag'];
const ACTS = [
  { id: 'prologo', name: 'Prólogo — Primeira Luz' }, { id: 'ato1', name: 'Ato 1 — Penumbra' }, { id: 'ato2', name: 'Ato 2 — Rotas de Éter' },
  { id: 'ato3', name: 'Ato 3 — Coro e Fome' }, { id: 'ato4', name: 'Ato 4 — Eclipse Total' }, { id: 'identidade', name: 'Missões de Identidade' },
];
const DIFF = { facil: { ai: 'facil', wave: 0.7, xp: 0.8, label: 'Fácil' }, normal: { ai: 'normal', wave: 1, xp: 1, label: 'Normal' }, dificil: { ai: 'dificil', wave: 1.35, xp: 1.25, label: 'Difícil' }, fenda: { ai: 'brutal', wave: 1.7, xp: 1.5, storms: true, noPause: true, label: 'Fenda' } };
const RELICS = [
  { id: 'cofre-fendido', name: 'Cofre Fendido', desc: '+300 Minério e +150 Plasma no início; −8% na coleta.', mods: { startRes: { minerio: 300, plasma: 150 }, harvestMul: 0.92 } },
  { id: 'lente-de-eter', name: 'Lente de Éter', desc: '+20% de visão para tudo; torres com −10% de vida.', mods: { sensorMul: 1.2, towerHpMul: 0.9 } },
  { id: 'semente-viva', name: 'Semente Viva', desc: 'Unidades regeneram 1,5 de vida/s fora de combate; −6% de velocidade.', mods: { regen: 1.5, speedMul: 0.94 } },
  { id: 'coracao-de-forja', name: 'Coração de Forja', desc: 'Produção 12% mais rápida; Reatores queimam 25% mais Plasma.', mods: { prodMul: 1.12, burnMul: 1.25 } },
  { id: 'ancora-de-mare', name: 'Âncora de Órbita', desc: 'Superarma recarrega 30% mais rápido; −10% de energia.', mods: { superCdMul: 0.7, energyMul: 0.9 } },
  { id: 'eco-do-coro', name: 'Eco do Coro', desc: '+1 Salto de Núcleo e +10% de energia; −8% na coleta.', mods: { extraJumps: 1, energyMul: 1.1, harvestMul: 0.92 } },
];
const RELIC_BY_LEVEL = { 5: 'lente-de-eter', 10: 'coracao-de-forja', 15: 'eco-do-coro' };
const ACHIEVEMENTS = [
  { id: 'primeiro-passo', name: 'Primeiro passo', desc: 'Concluir a primeira missão da campanha.' },
  { id: 'prologo', name: 'Acordado', desc: 'Concluir o Prólogo.' }, { id: 'ato-1', name: 'Despertar', desc: 'Concluir o Ato 1.' }, { id: 'ato-2', name: 'Senhor das rotas', desc: 'Concluir o Ato 2.' },
  { id: 'ato-3', name: 'Ouvido do Coro', desc: 'Concluir o Ato 3.' }, { id: 'ato-4', name: 'Domínio', desc: 'Concluir o Ato 4.' }, { id: 'identidade', name: 'Cinco vozes', desc: 'Concluir todas as Missões de Identidade.' },
  { id: 'tres-estrelas', name: 'Perfeccionista', desc: 'Conseguir 3 estrelas numa missão.' }, { id: 'fenda', name: 'Filho da Fenda', desc: 'Vencer uma missão na dificuldade Fenda.' },
  { id: 'nucleo-intacto', name: 'Núcleo intacto', desc: 'Vencer com o Núcleo acima de 90% de vida.' }, { id: 'so-infantaria', name: 'Só infantaria', desc: 'Vencer usando apenas Infantaria em combate.' },
  { id: 'pacifista-10', name: 'Pacifista até o minuto 10', desc: 'Vencer uma partida sem causar dano nos primeiros 10 minutos.' }, { id: 'primeiro-sifao', name: 'Mão leve', desc: 'Roubar recursos com um Pirata.' },
  { id: 'muralha', name: 'Muralha', desc: 'Construir 20 Muros numa partida.' }, { id: 'traidor', name: 'Golpe de Traição', desc: 'Quebrar um pacto.' }, { id: 'diplomata', name: 'Palavra dada', desc: 'Cumprir um pacto até o fim.' },
  { id: 'cinco-racas', name: 'Cinco Mundos', desc: 'Vencer uma partida com cada Raça.' }, { id: 'comandante-10', name: 'Comandante veterano', desc: 'Chegar ao nível 10.' }, { id: 'comandante-30', name: 'Lenda da Fenda', desc: 'Chegar ao nível 30.' },
];
const TITLES = { 'primeiro-passo': 'Recruta do Alinhamento', prologo: 'Desperto', 'ato-1': 'Guardião do Cerco', 'ato-2': 'Senhor das Rotas', 'ato-3': 'Ouvido do Coro', 'ato-4': 'Dominador', identidade: 'Cinco Vozes', 'tres-estrelas': 'Perfeccionista', fenda: 'Filho da Fenda', 'nucleo-intacto': 'Inabalável', 'cinco-racas': 'Senhor dos Cinco Mundos', 'comandante-30': 'Lenda da Fenda' };

// ---------- missões ----------
// who: 'self' (líder da sua Raça), 'enemy' (primeiro inimigo), 'ally' (primeiro aliado) ou um id de Raça. mood: 1 sereno, 2 furioso, 3 triunfante.
const M = [];
const W = (comp, from, opts) => Object.assign({ comp, from: from || 0 }, opts || {}); // onda: composição { def: n }, de qual inimigo
// Prólogo
M.push({ id: 'p1', act: 'prologo', title: 'Acorde', place: 'Planalto de Ísk', xp: 300,
  brief: [['self', 1, 'Comandante, os cinco mundos começaram a se alinhar e a Fenda abriu um planalto inteiro. O Núcleo está de pé; agora precisamos de energia e de quem colha.'], ['self', 3, 'Siga as ordens na tela. Ninguém por perto vai incomodar. Por enquanto.']],
  setup: { seed: 4101, enemies: [{ race: 'rival', name: 'Ninho Dormente', passive: true }] },
  objectives: [{ id: 'reator', text: 'Construir um Reator', test: c => c.built('reator') >= 1 }, { id: 'refinaria', text: 'Construir uma Refinaria', test: c => c.built('refinaria') >= 1 },
    { id: 'coletores', text: 'Ter 5 Coletores', test: c => c.units('coletor') >= 5, progress: c => c.units('coletor') + '/5' }, { id: 'coleta', text: 'Coletar 800 em recursos', test: c => c.me.stats.collected >= 800, progress: c => c.n(c.me.stats.collected) + '/800' },
    { id: 'b-nodulo', bonus: true, text: 'Construir um Nódulo de Avanço', test: c => c.built('nodulo') >= 1 }, { id: 'b-rapido', bonus: true, final: true, text: 'Concluir em menos de 7 min', test: c => c.t < 420 }],
  script: [{ at: 4, say: ['self', 1, 'Selecione o Núcleo (F1) e produza Coletores (C). Depois, B e R para um Reator.'] }, { when: c => c.built('reator') >= 1, say: ['self', 3, 'Energia estável. Uma Refinaria perto dos nós de Minério encurta a viagem dos Coletores.'] }, { when: c => c.done('coletores'), say: ['self', 1, 'Coletores colhem sozinhos dentro do seu território. Um Nódulo de Avanço amplia esse território.'] }] });
M.push({ id: 'p2', act: 'prologo', title: 'Energia e regimes', place: 'Vale das Turbinas', xp: 350,
  brief: [['self', 1, 'Toda estrutura consome energia. Abaixo de 100% entramos em racionamento: produção, sensores e torres pioram.'], ['self', 2, 'Abaixo de 70% é colapso. Não quero ver isso no meu painel.']],
  setup: { seed: 4207, enemies: [{ race: 'rival', name: 'Ruínas de Vey', passive: true }] },
  objectives: [{ id: 'quartel', text: 'Construir um Quartel', test: c => c.built('quartel') >= 1 }, { id: 'era2', text: 'Evoluir o Núcleo para a Era II (selecione o Núcleo › Evoluir)', test: c => (c.me.era || 1) >= 2 }, { id: 'fabrica', text: 'Construir uma Fábrica de Veículos', test: c => c.built('fabrica') >= 1 },
    { id: 'pleno', text: 'Manter energia Plena por 60 s com Quartel e Fábrica de pé', test: c => c.hold('pleno', c.me.energy.regime === 'pleno' && c.built('quartel') && c.built('fabrica'), 60), progress: c => Math.floor(c.held('pleno')) + '/60 s' },
    { id: 'pesquisa', text: 'Pesquisar uma tecnologia no Laboratório', test: c => Object.keys(c.me.research).length >= 1 },
    { id: 'b-sem-colapso', bonus: true, final: true, text: 'Nunca entrar em colapso de energia', test: c => !c.st.colapso }, { id: 'b-sobrecarga', bonus: true, text: 'Usar a Sobrecarga uma vez', test: c => c.me.overchargeCd > 0 }],
  tick: c => { if (c.me.energy.regime === 'colapso') c.st.colapso = true; },
  script: [{ at: 4, say: ['self', 1, 'Cada Reator dá +35 de energia queimando Plasma. Fique de olho no medidor ⚡ lá em cima.'] }, { when: c => c.done('quartel') && !c.done('era2'), say: ['self', 1, 'Quartel e Refinaria de pé: o Núcleo já pode evoluir para a Era II. Selecione-o e toque em Evoluir. Fábrica, Hangar e Laboratório vêm depois disso.'] }, { when: c => c.done('era2'), say: ['self', 3, 'Era II! A colônia cresceu. Agora a Fábrica.'] }, { when: c => c.me.energy.regime === 'racionado', once: true, say: ['self', 2, 'Racionamento! Mais Reatores, Comandante.'] }, { when: c => c.done('pleno'), say: ['self', 3, 'Rede estável. Agora o Laboratório: conhecimento é a moeda da Fenda.'] }] });
M.push({ id: 'p3', act: 'prologo', title: 'A primeira tempestade', place: 'Bordas da Fenda', xp: 400, relic: 'cofre-fendido',
  brief: [['self', 1, 'O Éter está se acumulando. Quando a tempestade cai, drones e sensores sofrem, mas o Plasma rende em dobro lá dentro.'], ['enemy', 2, 'Vocês chegaram tarde. Esta borda é nossa.'], ['self', 2, 'Construa uma Torre. Eles virão quando o céu escurecer.']],
  setup: { seed: 4313, enemies: [{ race: 'rival', name: 'Saqueadores da Borda', passive: true }] },
  objectives: [{ id: 'plasma', text: 'Juntar 600 de Plasma', test: c => c.me.res.plasma >= 600, progress: c => c.n(c.me.res.plasma) + '/600' }, { id: 'torre', text: 'Construir uma Torre de Defesa', test: c => c.built('torre') >= 1 },
    { id: 'raid', text: 'Repelir o ataque da tempestade', test: c => c.st.raidSpawned && c.waveAlive('raid') === 0 },
    { id: 'b-coletores', bonus: true, final: true, text: 'Não perder nenhum Coletor', test: c => (c.lost.coletor || 0) === 0 }, { id: 'b-torre-cedo', bonus: true, text: 'Torre pronta antes das 3:30', test: c => c.built('torre') >= 1 && c.t < 210 }],
  events: [{ at: 75, do: c => { const n = c.myNucleo(); if (n) S.forceStorm(c.sim, (n.x + S.CX) / 2, (n.y + S.CY) / 2, 30, 100); } }, { at: 240, do: c => { c.wave('raid', W({ infantaria: 4, drone: 2 }, 0)); c.st.raidSpawned = true; }, say: ['enemy', 2, 'Agora! Enquanto os sensores deles estão cegos!'] }],
  script: [{ when: c => c.st.raidSpawned && c.done('raid'), say: ['self', 3, 'Eles fugiram para dentro da tempestade. Boa leitura do céu, Comandante.'] }] });
// Ato 1
M.push({ id: 'a1m1', act: 'ato1', title: 'Cerco', place: 'Passo de Kessari', xp: 450,
  brief: [['self', 2, 'A Prole sentiu o cheiro do nosso Plasma. Ondas virão pelo passo leste.'], ['self', 1, 'Muros são baratos e um Portão deixa as nossas tropas passarem. Feche o passo antes da primeira onda.']],
  setup: { seed: 5107, enemies: [{ race: 'vorag', name: 'Horda de Velk', passive: true }] },
  objectives: [{ id: 'muros', text: 'Construir 10 Muros e 1 Portão', test: c => c.built('muro') >= 10 && c.built('portao') >= 1, progress: c => c.built('muro') + '/10 muros, ' + c.built('portao') + '/1 portão' },
    { id: 'ondas', text: 'Sobreviver às 5 ondas (até 9:00)', test: c => c.t >= 540 && c.st.waves >= 5 && c.waveAlive() === 0, progress: c => (c.st.waves || 0) + '/5 ondas' },
    { id: 'b-nucleo', bonus: true, final: true, text: 'Núcleo acima de 80% no fim', test: c => c.nucleoFrac() >= 0.8 }, { id: 'b-abates', bonus: true, text: 'Abater 40 inimigos', test: c => c.killed() >= 40, progress: c => c.killed() + '/40' }],
  events: [120, 210, 300, 390, 480].map((at, i) => ({ at, do: c => { c.wave('w' + i, W({ cria: 6 + i * 3, cuspidor: 1 + i, escaravelho: i >= 2 ? i - 1 : 0, brutamonte: i === 4 ? 1 : 0 }, 0)); c.st.waves = (c.st.waves || 0) + 1; }, say: i === 0 ? ['vorag', 2, 'Fome! Fome! Abram!'] : i === 4 ? ['self', 2, 'A última onda trouxe um Brutamonte. Segure o Portão!'] : null })),
  script: [{ at: 6, say: ['self', 1, 'Arraste com o Muro selecionado (B, M) para desenhar uma linha inteira.'] }] });
M.push({ id: 'a1m2', act: 'ato1', title: 'Caça a comboios', place: 'Rota das Dunas', xp: 450,
  brief: [['self', 1, 'Comboios do Consórcio atravessam a rota a cada minuto. Cada Rebocador carrega Minério.'], ['self', 3, 'Derrube os Rebocadores e recolha as Caixas antes que esfriem.']],
  setup: { seed: 5213, enemies: [{ race: 'vehnar', name: 'Consórcio Oryn', passive: true }] },
  objectives: [{ id: 'caixas', text: 'Recolher 4 Caixas dos comboios', test: c => c.st.crates >= 4, progress: c => (c.st.crates || 0) + '/4' },
    { id: 'b-sem-fuga', bonus: true, final: true, text: 'Nenhum comboio escapar', test: c => !(c.st.escaped > 0) }, { id: 'b-rapido', bonus: true, final: true, text: 'Concluir em menos de 10 min', test: c => c.t < 600 }],
  events: [60, 140, 220, 300, 380, 460, 540, 620].map(at => ({ at, do: c => c.convoy() })),
  script: [{ at: 50, say: ['self', 1, 'Primeiro comboio entrando na rota. Use Atacar-mover (A) no caminho deles.'] }, { when: c => c.st.crates >= 1, once: true, say: ['self', 3, 'Caixa recolhida. Mais três.'] }] });
M.push({ id: 'a1m3', act: 'ato1', title: 'Sobrevivência noturna', place: 'Pântano Negro', xp: 500, relic: 'semente-viva', startTime: 330,
  brief: [['self', 2, 'A noite cai e a Ninhada Cega caça no escuro. Não temos como ver longe.'], ['vorag', 2, 'Escuro. Quente. Comida.'], ['self', 1, 'Torres e luz. Aguente até o amanhecer.']],
  setup: { seed: 5319, enemies: [{ race: 'vorag', name: 'Ninhada Cega', passive: true }] },
  objectives: [{ id: 'amanhecer', text: 'Sobreviver até o amanhecer (11:40)', test: c => c.sim.time >= 700, progress: c => 'faltam ' + c.mmss(Math.max(0, 700 - c.sim.time)) },
    { id: 'b-predios', bonus: true, final: true, text: 'Não perder nenhuma construção', test: c => c.me.stats.buildingsLost === 0 }, { id: 'b-torres', bonus: true, text: 'Ter 3 Torres de Defesa', test: c => c.built('torre') >= 3 }],
  events: [380, 440, 500, 560, 620, 670].map((at, i) => ({ at, do: c => c.wave('n' + i, W({ cria: 8 + i * 2, cuspidor: 2 + i, ferroada: i >= 3 ? 3 : 0 }, 0)) })) });
// Ato 2
M.push({ id: 'a2m1', act: 'ato2', title: 'Roubo e contrarroubo', place: 'Refinarias de Ísk', xp: 550,
  brief: [['erevane', 1, 'Tudo que vocês refinam também é nosso. Só ainda não sabem.'], ['self', 2, 'Então jogamos o jogo deles. Piratas nas Refinarias inimigas, Torres nas nossas.']],
  setup: { seed: 6101, enemies: [{ race: 'erevane', name: 'Clã Sombrio' }] },
  objectives: [{ id: 'roubo', text: 'Roubar 800 em recursos com Piratas', test: c => c.me.stats.stolen >= 800, progress: c => c.n(c.me.stats.stolen) + '/800' }, { id: 'piratas', text: 'Abater 3 Piratas inimigos', test: c => (c.kills.pirata || 0) >= 3, progress: c => (c.kills.pirata || 0) + '/3' },
    { id: 'b-perda', bonus: true, final: true, text: 'Perder menos de 300 para roubo', test: c => c.me.stats.lost < 300 }, { id: 'b-rapido', bonus: true, final: true, text: 'Concluir em menos de 12 min', test: c => c.t < 720 }],
  script: [{ at: 5, say: ['self', 1, 'Pirata: clique direito numa Refinaria ou Reator inimigo para Sifonar. Volte à base para entregar.'] }, { when: c => c.me.stats.stolen > 0, once: true, say: ['self', 3, 'O primeiro sifão é o mais doce.'] }] });
M.push({ id: 'a2m2', act: 'ato2', title: 'Diplomacia forçada', place: 'Mesa de Kessari', xp: 600,
  brief: [['vehnar', 1, 'Pacto de Não-agressão, Comandante. Juntos esmagamos a Ordem do Molde.'], ['self', 2, 'Assine. E não confie. O Consórcio já quebrou pactos por menos.']],
  setup: { seed: 6211, enemies: [{ race: 'vehnar', name: 'Fundição Kessari' }, { race: 'tessara', name: 'Ordem do Molde' }] },
  objectives: [{ id: 'molde', text: 'Destruir o Núcleo da Ordem do Molde', test: c => c.enemyDead(1) }, { id: 'traicao', text: 'Sobreviver à traição (Núcleo de pé aos 9:00)', test: c => c.t >= 540 && !!c.myNucleo() },
    { id: 'b-traidor', bonus: true, text: 'Destruir também o Núcleo do traidor', test: c => c.enemyDead(0) }, { id: 'b-palavra', bonus: true, final: true, text: 'Não quebrar nenhum pacto', test: c => c.me.stats.betrayals === 0 }],
  events: [{ at: 3, do: c => S.enqueue(c.sim, { t: 'propose', p: c.en[0], to: 0 }) }, { at: 4, do: c => S.enqueue(c.sim, { t: 'respond', p: 0, to: c.en[0], accept: true }) },
    { at: 330, do: () => {}, say: ['self', 2, 'Batedores viram o Consórcio juntando blindados na fronteira. Torres no flanco deles, agora.'] },
    { at: 420, do: c => { if (S.hasPact(c.sim, 0, c.en[0])) S.enqueue(c.sim, { t: 'break', p: c.en[0], with: 0 }); c.wave('trai', W({ veiculo: 2, soldador: 3 }, 0)); }, say: ['vehnar', 2, 'Negócios, Comandante. Só negócios.'] }],
  script: [{ at: 6, say: ['self', 1, 'Pacto ativo com a Fundição Kessari. Concentre o ataque na Ordem do Molde.'] }] });
M.push({ id: 'a2m3', act: 'ato2', title: 'Escolta sob tempestade', place: 'Travessia do Éter', xp: 650, relic: 'ancora-de-mare',
  brief: [['self', 1, 'A Arca de Dados precisa cruzar a Travessia até o ponto de extração. Ela é lenta e não atira.'], ['erevane', 1, 'Que bela carga. Seria uma pena se a tempestade a escondesse de vocês.']],
  setup: { seed: 6317, enemies: [{ race: 'erevane', name: 'Corsários da Faixa', passive: true }] },
  objectives: [{ id: 'chegar', text: 'Levar a Arca de Dados até o ponto de extração', test: c => c.st.vipArrived, progress: c => c.vip() ? Math.round(S.dist(c.vip().x, c.vip().y, c.st.ex, c.st.ey)) + ' de distância' : '—' },
    { id: 'b-vida', bonus: true, final: true, text: 'Arca acima de 50% de vida', test: c => c.vip() && c.vip().hp >= c.vip().maxHp * 0.5 }, { id: 'b-rapido', bonus: true, final: true, text: 'Concluir em menos de 10 min', test: c => c.t < 600 }],
  fail: c => c.st.vipId && !c.vip() && !c.st.vipArrived ? 'A Arca de Dados foi destruída.' : null,
  events: [{ at: 1, do: c => c.spawnVip() }, { at: 90, do: c => c.stormOnRoute(0.35) }, { at: 120, do: c => c.ambush('e1', W({ lamina: 2, atirador: 3 }, 0), 0.4) }, { at: 230, do: c => c.stormOnRoute(0.65) }, { at: 260, do: c => c.ambush('e2', W({ lamina: 3, mosquito: 6 }, 0), 0.7) }, { at: 380, do: c => c.ambush('e3', W({ lamina: 3, atirador: 4, mosquito: 4 }, 0), 0.9) }],
  tick: c => { const v = c.vip(); if (v && S.dist(v.x, v.y, c.st.ex, c.st.ey) < 110) c.st.vipArrived = true; },
  script: [{ at: 3, say: ['self', 1, 'A Arca (anel dourado) está ao lado do Núcleo. Selecione-a e mande até o marcador de extração; leve escolta.'] }] });
// Ato 3
M.push({ id: 'a3m1', act: 'ato3', title: 'Primeiro contato', place: 'Cavernas de Quor', xp: 700,
  brief: [['quorith', 1, 'Vocês fazem barulho. O Coro não suporta barulho.'], ['self', 2, 'Eles atacam em acorde: muitos juntos ficam fortes. Separe-os e derrube um de cada vez.']],
  setup: { seed: 7103, enemies: [{ race: 'quorith', name: 'Acorde Sétimo' }] },
  objectives: [{ id: 'resistir', text: 'Resistir aos acordes até 9:00', test: c => c.t >= 540 && !!c.myNucleo(), progress: c => 'faltam ' + c.mmss(Math.max(0, 540 - c.t)) }, { id: 'abates', text: 'Silenciar 30 unidades do Coro', test: c => c.killed() >= 30, progress: c => c.killed() + '/30' },
    { id: 'b-nucleo', bonus: true, text: 'Destruir o Núcleo do Coro', test: c => c.enemyDead(0) }, { id: 'b-perdas', bonus: true, final: true, text: 'Perder menos de 15 unidades', test: c => c.me.stats.unitsLost < 15 }],
  events: [150, 270, 390, 480].map((at, i) => ({ at, do: c => c.wave('ac' + i, W({ voz: 6 + i * 2, diapasao: 1, prisma: i >= 2 ? 2 : 0 }, 0)), say: i === 0 ? ['quorith', 2, 'Uníssono.'] : null })) });
M.push({ id: 'a3m2', act: 'ato3', title: 'A Prole devora um aliado', place: 'Jardins de Oriel', xp: 750,
  brief: [['tessara', 2, 'Os Carniceiros estão comendo nossos Nódulos vivos. Precisamos de vocês!'], ['self', 1, 'Pacto com a Linhagem Oriel. Mate os Carniceiros primeiro: são eles que devoram.']],
  setup: { seed: 7211, enemies: [{ race: 'tessara', name: 'Linhagem Oriel', ally: true }, { race: 'vorag', name: 'Prole Velk' }] },
  objectives: [{ id: 'aliado', text: 'Manter o Núcleo da Linhagem Oriel de pé até 10:00', test: c => c.t >= 600 && !c.enemyDead(0), progress: c => 'faltam ' + c.mmss(Math.max(0, 600 - c.t)) }, { id: 'carniceiros', text: 'Abater 6 Carniceiros', test: c => (c.kills.pirata || 0) >= 6, progress: c => (c.kills.pirata || 0) + '/6' },
    { id: 'b-prole', bonus: true, text: 'Destruir o Núcleo da Prole', test: c => c.enemyDead(1) }, { id: 'b-nodulos', bonus: true, final: true, text: 'O aliado perder no máximo 2 Nódulos', test: c => (c.st.allyNodLost || 0) <= 2 }],
  fail: c => c.enemyDead(0) && c.t < 600 ? 'A Linhagem Oriel foi devorada.' : null,
  events: [{ at: 2, do: c => S.enqueue(c.sim, { t: 'propose', p: c.en[0], to: 0 }) }, { at: 3, do: c => S.enqueue(c.sim, { t: 'respond', p: 0, to: c.en[0], accept: true }) },
    ...[120, 240, 360, 480].map((at, i) => ({ at, do: c => c.wave('pv' + i, W({ pirata: 2 + (i >> 1), cria: 6 + i * 2, cuspidor: 2 }, 1), { target: 'ally0' }) }))],
  onDeath: (c, e) => { if (e.kind === 'building' && e.def === 'nodulo' && e.owner === c.en[0]) c.st.allyNodLost = (c.st.allyNodLost || 0) + 1; } });
M.push({ id: 'a3m3', act: 'ato3', title: 'Aliança tripla instável', place: 'Fenda Menor', xp: 800,
  brief: [['vehnar', 1, 'Três contra a Prole. Simples.'], ['quorith', 1, 'O Coro aceita. Por ora.'], ['self', 2, 'Dois pactos, dois punhais. Destrua a Prole antes que os aliados mudem de ideia.']],
  setup: { seed: 7307, minutes: 30, enemies: [{ race: 'vehnar', name: 'Estaleiro Vey', ally: true }, { race: 'quorith', name: 'Silêncio de Quor', ally: true }, { race: 'vorag', name: 'Fome de Oru', hard: true }] },
  objectives: [{ id: 'prole', text: 'Destruir o Núcleo da Prole', test: c => c.enemyDead(2) },
    { id: 'b-pactos', bonus: true, text: 'Os dois pactos de pé até 8:00', test: c => c.t >= 480 && S.hasPact(c.sim, 0, c.en[0]) && S.hasPact(c.sim, 0, c.en[1]) }, { id: 'b-rep', bonus: true, final: true, text: 'Terminar sem quebrar pactos', test: c => c.me.stats.betrayals === 0 }],
  events: [{ at: 2, do: c => { S.enqueue(c.sim, { t: 'propose', p: c.en[0], to: 0 }); S.enqueue(c.sim, { t: 'propose', p: c.en[1], to: 0 }); } }, { at: 3, do: c => { S.enqueue(c.sim, { t: 'respond', p: 0, to: c.en[0], accept: true }); S.enqueue(c.sim, { t: 'respond', p: 0, to: c.en[1], accept: true }); } },
    { at: 480, do: () => {}, say: ['quorith', 1, 'O Estaleiro afina outra canção. Cuidado com o flanco do aço.'] },
    { at: 540, do: c => { if (S.hasPact(c.sim, 0, c.en[0])) S.enqueue(c.sim, { t: 'break', p: c.en[0], with: 0 }); }, say: ['vehnar', 2, 'O Estaleiro tem outros planos.'] }] });
// Ato 4
M.push({ id: 'a4m1', act: 'ato4', title: 'Assalto à Catedral Errante', place: 'Planície do Uníssono', xp: 900,
  brief: [['quorith', 3, 'A Catedral canta. Quem ouve, ajoelha.'], ['self', 2, 'Uma estrutura viva, armada e andando. Derrube a Catedral Errante e o Coro perde a voz.']],
  setup: { seed: 8101, minutes: 30, enemies: [{ race: 'quorith', name: 'Coro de Zayin', hard: true }] },
  objectives: [{ id: 'catedral', text: 'Destruir a Catedral Errante', test: c => c.st.bossSpawned && !c.boss(), progress: c => c.boss() ? c.n(c.boss().hp) + ' de vida' : '—' },
    { id: 'b-rapido', bonus: true, final: true, text: 'Concluir em menos de 16 min', test: c => c.t < 960 }, { id: 'b-nucleo', bonus: true, final: true, text: 'Núcleo acima de 70% no fim', test: c => c.nucleoFrac() >= 0.7 }],
  events: [{ at: 2, do: c => c.spawnBoss('catedral', 0) }],
  tick: c => c.bossPatrol(0, 520) });
M.push({ id: 'a4m2', act: 'ato4', title: 'Matriarca encurralada', place: 'Ninho de Velk', xp: 950,
  brief: [['vorag', 3, 'Mãe. Mãe. Mãe.'], ['self', 2, 'A Matriarca choca Crias sem parar. Mate a mãe e o enxame desmonta.']],
  setup: { seed: 8203, minutes: 30, enemies: [{ race: 'vorag', name: 'Prole Velk', hard: true }] },
  objectives: [{ id: 'matriarca', text: 'Abater a Matriarca', test: c => c.st.bossSpawned && !c.boss(), progress: c => c.boss() ? c.n(c.boss().hp) + ' de vida' : '—' },
    { id: 'b-crias', bonus: true, text: 'Abater 60 Crias', test: c => (c.kills.cria || 0) >= 60, progress: c => (c.kills.cria || 0) + '/60' }, { id: 'b-predios', bonus: true, final: true, text: 'Não perder nenhuma construção', test: c => c.me.stats.buildingsLost === 0 }],
  events: [{ at: 2, do: c => c.spawnBoss('matriarca', 0) }],
  tick: c => { c.bossPatrol(0, 420); const b = c.boss(); if (b && c.t > 60 && c.every(25)) for (let i = 0; i < Math.round(3 * c.D.wave); i++) { const u = S.spawnUnit(c.sim, b.owner, 'cria', b.x + (c.sim.rand() - 0.5) * 60, b.y + (c.sim.rand() - 0.5) * 60); if (u) { u.state = 'attackmove'; const t = c.myNucleo(); if (t) { u.tx = t.x; u.ty = t.y; } } } } });
M.push({ id: 'a4m3', act: 'ato4', title: 'A Fenda aberta', place: 'O Coração da Fenda', xp: 1100,
  brief: [['self', 1, 'Cinco Raças, uma vaga. O Alinhamento se fecha hoje: quem ficar de pé dita o que a Fenda cospe.'], ['vorag', 2, 'Fome.'], ['quorith', 1, 'Silêncio.'], ['self', 3, 'Domínio.']],
  setup: { seed: 8311, minutes: 25, enemies: [{ race: 'others', name: 'auto' }, { race: 'others', name: 'auto' }, { race: 'others', name: 'auto' }] },
  objectives: [{ id: 'dominio', text: 'Vencer: último Núcleo de pé ou maior Domínio aos 25:00', test: c => c.st.matchWon },
    { id: 'b-nucleos', bonus: true, text: 'Destruir 2 Núcleos', test: c => c.me.stats.buildingsDestroyed >= 2 && c.enemiesDead() >= 2 }, { id: 'b-nodulos', bonus: true, final: true, text: 'Terminar com 3 Nódulos', test: c => c.built('nodulo') >= 3 }] });
// Missões de Identidade (uma por Raça; jogadas com a própria Raça)
M.push({ id: 'i-vehnar', act: 'identidade', race: 'vehnar', title: 'Produção sob sabotagem', place: 'Fundição Kessari', xp: 700,
  brief: [['vehnar', 2, 'Sifonadores nos Reatores a cada minuto. Isso é sabotagem, e sabotagem tem preço.'], ['vehnar', 3, 'Linhas de Montagem cheias. Vinte e cinco unidades de combate antes do turno acabar.']],
  setup: { seed: 9101, enemies: [{ race: 'erevane', name: 'Náufragos de Ísk', passive: true }] },
  objectives: [{ id: 'producao', text: 'Produzir 25 unidades de combate em 12 min', test: c => c.st.produced >= 25 && c.t <= 720, progress: c => (c.st.produced || 0) + '/25' }],
  bonus2: true, extraObjectives: [{ id: 'b-roubo', bonus: true, final: true, text: 'Perder menos de 400 para roubo', test: c => c.me.stats.lost < 400 }, { id: 'b-fabricas', bonus: true, text: 'Ter 6 estruturas de produção', test: c => c.built('quartel') + c.built('fabrica') + c.built('hangar') >= 6 }],
  fail: c => c.t > 720 && !(c.st.produced >= 25) ? 'O turno acabou antes da meta de produção.' : null,
  events: [60, 120, 180, 240, 300, 360, 420, 480, 540, 600].map(at => ({ at, do: c => c.raid('sab' + at, 0) })) });
M.push({ id: 'i-erevane', act: 'identidade', race: 'erevane', title: 'Só furtividade', place: 'Arquipélago de Ísk', xp: 700,
  brief: [['erevane', 1, 'Sem exército. Sem barulho. Só mãos leves e um bom esconderijo.'], ['erevane', 3, 'Mil e quinhentos em recursos roubados e nenhum blindado nosso no mapa.']],
  setup: { seed: 9203, enemies: [{ race: 'vehnar', name: 'Consórcio Oryn' }] },
  objectives: [{ id: 'roubo', text: 'Roubar 1500 em recursos', test: c => c.me.stats.stolen >= 1500, progress: c => c.n(c.me.stats.stolen) + '/1500' }],
  extraObjectives: [{ id: 'b-piratas', bonus: true, final: true, text: 'Não perder nenhum Sifonador', test: c => (c.lost.pirata || 0) === 0 }, { id: 'b-rapido', bonus: true, final: true, text: 'Concluir em menos de 12 min', test: c => c.t < 720 }],
  fail: c => c.st.army ? 'Você colocou um exército no mapa. A furtividade acabou.' : null,
  onSpawn: (c, ev) => { if (ev.p === 0 && ['veiculo', 'lamina', 'drone', 'mosquito', 'infantaria'].includes(ev.def)) c.st.army = true; } });
M.push({ id: 'i-tessara', act: 'identidade', race: 'tessara', title: 'Nascer na noite', place: 'Estufas de Oriel', xp: 700, startTime: 330,
  brief: [['tessara', 2, 'Começamos no escuro: sem sol, a Fotossíntese do Núcleo rende pouco.'], ['tessara', 1, 'Adapte-se. Ganhe Traços. Quando o dia chegar, floresça e vença.']],
  setup: { seed: 9307, enemies: [{ race: 'rival', name: 'Clã Sombrio' }] },
  objectives: [{ id: 'vencer', text: 'Destruir o Núcleo inimigo', test: c => c.enemyDead(0) }],
  extraObjectives: [{ id: 'b-tracos', bonus: true, text: 'Conquistar 3 Traços', test: c => Object.values(c.me.traits).reduce((a, t) => a + Object.keys(t).length, 0) >= 3 }, { id: 'b-rapido', bonus: true, final: true, text: 'Vencer antes das 20:00', test: c => c.sim.time < 1200 }] });
M.push({ id: 'i-quorith', act: 'identidade', race: 'quorith', title: 'Nenhuma voz sozinha', place: 'Catedral Partida', xp: 700,
  brief: [['quorith', 1, 'Uma voz isolada é quase silêncio. O Coro só vence em acorde.'], ['quorith', 3, 'Destrua o inimigo sem deixar nenhuma voz sozinha no campo.']],
  setup: { seed: 9409, enemies: [{ race: 'rival', name: 'Prole Velk' }] },
  objectives: [{ id: 'vencer', text: 'Destruir o Núcleo inimigo', test: c => c.enemyDead(0) }],
  extraObjectives: [{ id: 'b-acorde', bonus: true, final: true, text: 'Nunca deixar uma unidade de combate isolada por 15 s', test: c => !c.st.isolated }, { id: 'b-unissono', bonus: true, text: 'Usar o Uníssono', test: c => c.me.unissonoT > 0 || c.st.usedSuper }],
  tick: c => { if (!c.every(1)) return; c.st.iso = c.st.iso || {}; for (const e of c.sim.ents) { if (!e.alive || e.kind !== 'unit' || e.owner !== 0 || e.cls === 'civ' || e.def === 'pirata' || !S.UNITS[e.def].attack) continue; const n = c.myNucleo(); if (n && S.dist(e.x, e.y, n.x, n.y) < 420) { c.st.iso[e.id] = 0; continue; } c.st.iso[e.id] = e.elo > 0 ? 0 : (c.st.iso[e.id] || 0) + 1; if (c.st.iso[e.id] >= 15) c.st.isolated = true; } } });
M.push({ id: 'i-vorag', act: 'identidade', race: 'vorag', title: 'A fome que floresce', place: 'Campo de Carcaças', xp: 700,
  brief: [['vorag', 2, 'Carcaças por toda parte. Nódulos gordos do outro lado.'], ['vorag', 3, 'Devorar. Dois mil de biomassa antes de o eclipse passar.']],
  setup: { seed: 9511, enemies: [{ race: 'rival', name: 'Ordem do Molde' }] },
  objectives: [{ id: 'biomassa', text: 'Devorar 2000 de biomassa com Carniceiros em 14 min', test: c => c.devoured() >= 2000 && c.t <= 840, progress: c => c.n(c.devoured()) + '/2000' }],
  extraObjectives: [{ id: 'b-nodulos', bonus: true, text: 'Destruir 2 Nódulos inimigos', test: c => (c.kills.nodulo || 0) >= 2 }, { id: 'b-eclosao', bonus: true, text: 'Usar a Eclosão', test: c => c.st.usedSuper }],
  fail: c => c.t > 840 && c.devoured() < 2000 ? 'O eclipse passou antes da colheita.' : null,
  events: [{ at: 1, do: c => c.scatterWrecks(14) }] });
for (const m of M) if (m.extraObjectives) m.objectives = m.objectives.concat(m.extraObjectives);
const BY_ID = Object.fromEntries(M.map(m => [m.id, m]));

// ---------- preparação ----------
function rivalOf(race, i) { const others = RACES.filter(r => r !== race); return others[i % others.length]; }
function prepare(id, o) {
  const m = BY_ID[id]; if (!m) throw new Error('missão desconhecida ' + id);
  const diff = DIFF[o.difficulty] || DIFF.normal; const race = m.race || o.race || 'vehnar'; let oi = 0;
  const mods = {}; for (const rid of (o.relics || []).filter(Boolean)) { const r = RELICS.find(x => x.id === rid); if (!r) continue; for (const k in r.mods) { const v = r.mods[k]; if (k === 'startRes') { mods.startRes = mods.startRes || {}; for (const kk in v) mods.startRes[kk] = (mods.startRes[kk] || 0) + v[kk]; } else if (k === 'extraJumps' || k === 'regen') mods[k] = (mods[k] || 0) + v; else mods[k] = (mods[k] || 1) * v; } }
  const used = new Set([race]); const AI_NAMES = { vehnar: ['Fundição Kessari', 'Consórcio Oryn', 'Estaleiro Vey'], erevane: ['Clã Sombrio', 'Náufragos de Ísk', 'Corsários da Faixa'], tessara: ['Linhagem Oriel', 'Ordem do Molde', 'Enxerto Vassi'], quorith: ['Coro de Zayin', 'Acorde Sétimo', 'Silêncio de Quor'], vorag: ['Prole Velk', 'Ninhada Cega', 'Fome de Oru'] };
  const players = [{ name: o.name || 'Comandante', faction: race, human: true, color: o.color || undefined, mods: Object.keys(mods).length ? mods : undefined }];
  for (const e of m.setup.enemies) { let r = e.race; if (r === 'rival') r = rivalOf(race, oi++); else if (r === 'others') { r = RACES.find(x => !used.has(x)) || rivalOf(race, oi++); } else if (r === race && !m.race) r = rivalOf(race, oi++); used.add(r);
    const step = { facil: 'facil', normal: 'normal', dificil: 'dificil', fenda: 'brutal' }; // inimigos 'hard' seguem a dificuldade escolhida (o chefe já pesa)
    players.push({ name: e.name === 'auto' ? AI_NAMES[r][players.length % 3] : e.name, faction: r, difficulty: e.hard ? step[o.difficulty || 'normal'] : diff.ai, passive: !!e.passive, ally: !!e.ally }); }
  { const hostile = players.slice(1).filter(p => !p.passive).length; if (hostile >= 2) { const bonus = { facil: [700, 350], normal: [300, 150], dificil: [0, 0], fenda: [0, 0] }[o.difficulty || 'normal'] || [0, 0]; if (bonus[0]) { const m0 = players[0].mods = players[0].mods || {}; m0.startRes = Object.assign({}, m0.startRes); m0.startRes.minerio = (m0.startRes.minerio || 0) + bonus[0]; m0.startRes.plasma = (m0.startRes.plasma || 0) + bonus[1]; } } } // missões com vários inimigos ativos: reforço inicial no Fácil e no Normal
  const era = m.setup.era || (m.id === 'p1' || m.id === 'p2' ? 1 : 2); for (const pl of players) pl.era = era; // 4.1d: Era inicial da missão (todos começam iguais; a IA evolui sozinha)
  return { mission: m, diff, difficulty: o.difficulty || 'normal', race, era, cfg: { seed: m.setup.seed, players, minutes: (m.setup.minutes || 25) + (m.startTime ? Math.ceil(m.startTime / 60) : 0) } };
}

// ---------- executor ----------
function start(sim, prep, saved) { // saved (4.1c): estado do roteiro gravado; o sim já vem restaurado
  const m = prep.mission, D = prep.diff; const me = sim.players[0]; const en = sim.players.slice(1).map(p => p.id);
  if (m.startTime && !saved) { sim.time = m.startTime; sim.tick = Math.round(m.startTime / S.TICK); sim.nextStorm += m.startTime; }
  let t0 = sim.time; const said = []; const objectives = m.objectives.map(o => ({ id: o.id, text: o.text, bonus: !!o.bonus, final: !!o.final, done: false, progress: '' }));
  const c = { sim, me, en, D, st: { waves: 0, crates: 0, produced: 0 }, kills: {}, lost: {}, t: 0, waveIds: {}, holds: {}, lastEvery: {} };
  const ob = id => objectives.find(o => o.id === id);
  Object.assign(c, {
    n: v => Math.round(v).toLocaleString('pt-BR'), mmss: s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0'),
    built: (def, pid) => { let k = 0; for (const e of sim.ents) if (e.alive && e.kind === 'building' && e.owner === (pid || 0) && e.def === def && e.built) k++; return k; },
    units: (def, pid) => { let k = 0; for (const e of sim.ents) if (e.alive && e.kind === 'unit' && e.owner === (pid || 0) && e.def === def) k++; return k; },
    done: id => !!(ob(id) && ob(id).done), myNucleo: () => S.nucleoOf(sim, 0), enemyDead: i => !sim.players[en[i]].alive || !S.nucleoOf(sim, en[i]),
    enemiesDead: () => en.filter(id => !sim.players[id].alive).length, nucleoFrac: () => { const n = S.nucleoOf(sim, 0); return n ? n.hp / n.maxHp : 0; },
    killed: () => Object.values(c.kills).reduce((a, b) => a + b, 0), devoured: () => c.st.devoured || 0,
    hold: (key, cond, sec) => { c.holds[key] = cond ? (c.holds[key] || 0) + 0.5 : 0; return c.holds[key] >= sec; }, held: key => c.holds[key] || 0,
    every: sec => { const k = Math.floor(sim.time / sec); if (c.lastEvery[sec] === k) return false; c.lastEvery[sec] = k; return true; },
    say: (who, mood, text) => { const race = who === 'self' ? me.faction : who === 'enemy' ? sim.players[en.find(i => !sim.players[i].ally) ?? en[0]].faction : who === 'ally' ? sim.players[en.find(i => sim.players[i].ally) ?? en[0]].faction : who; said.push({ race, mood, text, t: sim.time }); },
    waveAlive: tag => { let k = 0; for (const [id, tg] of Object.entries(c.waveIds)) { if (tag && tg !== tag) continue; const e = sim.byId.get(+id); if (e && e.alive) k++; } return k; },
    targetFor: opt => { if (opt && opt.target === 'ally0') { const n = S.nucleoOf(sim, en[0]); if (n) return n; } return S.nucleoOf(sim, 0) || { x: S.CX, y: S.CY }; },
    spawnPoint: fromIdx => { const n = S.nucleoOf(sim, en[fromIdx]); const t = S.nucleoOf(sim, 0) || { x: S.CX, y: S.CY }; if (n) { const a = S.DM.atan2(t.y - n.y, t.x - n.x); return { x: n.x + S.DM.cos(a) * 160, y: n.y + S.DM.sin(a) * 160 }; } const a = sim.players[en[fromIdx]].startAngle; return { x: S.CX + S.DM.cos(a) * 1300, y: S.CY + S.DM.sin(a) * 1300 }; },
    wave: (tag, w, extra) => { const owner = en[w.from || 0]; if (!sim.players[owner] || !sim.players[owner].alive) return; const sp = c.spawnPoint(w.from || 0); const tgt = c.targetFor(Object.assign({}, w, extra)); const ids = [];
      for (const def in w.comp) { const n = Math.round(w.comp[def] * D.wave); for (let i = 0; i < n; i++) { const u = S.spawnUnit(sim, owner, def, sp.x + (sim.rand() - 0.5) * 120, sp.y + (sim.rand() - 0.5) * 120); if (u) { ids.push(u.id); c.waveIds[u.id] = tag; } } }
      if (ids.length) S.enqueue(sim, { t: 'attackmove', p: owner, ids, x: tgt.x, y: tgt.y }); },
    convoy: () => { const owner = en[0]; if (!sim.players[owner].alive) return; const a = me.startAngle + Math.PI / 2; const ax = S.CX + S.DM.cos(a) * 1450, ay = S.CY + S.DM.sin(a) * 1450, bx = S.CX - S.DM.cos(a) * 1450, by = S.CY - S.DM.sin(a) * 1450; const ids = [], esc = [];
      for (let i = 0; i < 2; i++) { const u = S.spawnUnit(sim, owner, 'pirata', ax + i * 30, ay); if (u) { u.cargo.minerio = 250; u.cargoTotal = 250; u.convoy = { x: bx, y: by }; ids.push(u.id); } }
      for (let i = 0; i < Math.round(2 * D.wave); i++) { const u = S.spawnUnit(sim, owner, 'infantaria', ax - 30 - i * 20, ay + 20); if (u) esc.push(u.id); }
      S.enqueue(sim, { t: 'move', p: owner, ids, x: bx, y: by }); if (esc.length) S.enqueue(sim, { t: 'attackmove', p: owner, ids: esc, x: bx, y: by }); },
    raid: (tag, from) => { const owner = en[from]; if (!sim.players[owner].alive) return; const sp = c.spawnPoint(from); let best = null, bd = 1e9; for (const e of sim.ents) if (e.alive && e.kind === 'building' && e.owner === 0 && (e.def === 'reator' || e.def === 'refinaria')) { const d = S.dist(e.x, e.y, sp.x, sp.y); if (d < bd) { bd = d; best = e; } } if (!best) return; const ids = []; for (let i = 0; i < Math.round(2 * D.wave); i++) { const u = S.spawnUnit(sim, owner, 'pirata', sp.x + i * 20, sp.y); if (u) ids.push(u.id); } if (ids.length) S.enqueue(sim, { t: 'siphon', p: owner, ids, target: best.id }); },
    vip: () => { const e = c.st.vipId && sim.byId.get(c.st.vipId); return e && e.alive ? e : null; },
    spawnVip: () => { const n = S.nucleoOf(sim, 0); if (!n) return; const u = S.spawnUnit(sim, 0, 'veiculo', n.x + 70, n.y + 40); if (!u) return; u.maxHp = u.hp = Math.round(2600 / Math.max(0.8, D.wave)); u.vip = true; u.speed = 62; c.st.vipId = u.id; const a = me.startAngle + Math.PI * 0.75; c.st.ex = S.CX + S.DM.cos(a) * 1250; c.st.ey = S.CY + S.DM.sin(a) * 1250; c.st.sx = n.x; c.st.sy = n.y; c.marker = { x: c.st.ex, y: c.st.ey }; },
    routePoint: f => ({ x: c.st.sx + (c.st.ex - c.st.sx) * f, y: c.st.sy + (c.st.ey - c.st.sy) * f }),
    stormOnRoute: f => { const p = c.routePoint(f); S.forceStorm(sim, p.x, p.y, 15, 80, 360); },
    ambush: (tag, w, f) => { const owner = en[w.from || 0]; const p = c.routePoint(f); const ids = []; for (const def in w.comp) for (let i = 0; i < Math.round(w.comp[def] * D.wave); i++) { const u = S.spawnUnit(sim, owner, def, p.x + 260 + (sim.rand() - 0.5) * 140, p.y + (sim.rand() - 0.5) * 220); if (u) { ids.push(u.id); c.waveIds[u.id] = tag; } } const v = c.vip(); if (ids.length) S.enqueue(sim, { t: 'attackmove', p: owner, ids, x: v ? v.x : p.x, y: v ? v.y : p.y }); },
    boss: () => { const e = c.st.bossId && sim.byId.get(c.st.bossId); return e && e.alive ? e : null; },
    spawnBoss: (def, from) => { const n = S.nucleoOf(sim, en[from]); if (!n) return; const u = S.spawnUnit(sim, en[from], def, n.x + 140, n.y + 60); if (u) { u.maxHp = u.hp = Math.round(u.maxHp * Math.min(1.4, Math.max(0.75, D.wave))); u.scripted = true; c.st.bossId = u.id; c.st.bossSpawned = true; c.st.bossHome = { x: n.x, y: n.y }; } },
    bossPatrol: (from, R) => { const b = c.boss(); if (!b || !c.every(12)) return; if (b.state === 'attack') return; const h = c.st.bossHome; const a = sim.rand() * Math.PI * 2; S.enqueue(sim, { t: 'attackmove', p: b.owner, ids: [b.id], x: h.x + S.DM.cos(a) * R, y: h.y + S.DM.sin(a) * R }); },
    scatterWrecks: n => { for (let i = 0; i < n; i++) { const a = sim.rand() * Math.PI * 2, r = 300 + sim.rand() * 900; const x = S.CX + S.DM.cos(a) * r, y = S.CY + S.DM.sin(a) * r; const wr = { id: sim.nextId++, kind: 'wreck', x, y, r: 12, ang: a, alive: true, owner: -1, res: 'minerio', amount: 160, max: 160, bornT: sim.time + 600, def: 'veiculo' }; sim.ents.push(wr); sim.byId.set(wr.id, wr); } },
  });
  const fired = new Set(); let result = null; let lastEval = -1;
  function evalObjectives(final) {
    let changed = false; for (const o of objectives) { const def = m.objectives.find(x => x.id === o.id); if (def.progress) { try { o.progress = def.progress(c); } catch (e) {} }
      if (o.done || (def.final && !final)) continue; let ok = false; try { ok = !!def.test(c); } catch (e) { ok = false; } if (ok) { o.done = true; changed = true; if (!o.bonus && !final) c.say('self', 3, 'Objetivo concluído: ' + o.text + '.'); } }
    return changed;
  }
  const runner = {
    mission: m, objectives, said, ctx: c, get result() { return result; }, marker: () => c.marker || null, vipId: () => c.st.vipId || null,
    brief() { const out = []; for (const [who, mood, text] of m.brief) { c.say(who, mood, text); } const s = said.splice(0); return s; },
    tick(events) {
      if (result) return; c.t = sim.time - t0;
      for (const ev of events) {
        if (ev.t === 'death') { if (ev.owner !== 0 && ev.owner >= 0 && (ev.kind === 'unit' || ev.kind === 'building')) c.kills[ev.def] = (c.kills[ev.def] || 0) + 1; if (ev.owner === 0) c.lost[ev.def] = (c.lost[ev.def] || 0) + 1; if (m.onDeath) m.onDeath(c, ev); }
        else if (ev.t === 'float' && ev.owner === 0 && typeof ev.text === 'string' && ev.text.startsWith('CAIXA')) c.st.crates++;
        else if (ev.t === 'spawn' && ev.p === 0) { const ud = S.UNITS[ev.def]; if (ud && ud.attack) c.st.produced++; if (m.onSpawn) m.onSpawn(c, ev); }
        else if (ev.t === 'super' && ev.p === 0) c.st.usedSuper = true;
      }
      // comboios que chegaram ao destino saem do mapa (contam como fuga)
      for (const e of sim.ents) if (e.alive && e.convoy && S.dist(e.x, e.y, e.convoy.x, e.convoy.y) < 120) { e.alive = false; e.cargoTotal = 0; c.st.escaped = (c.st.escaped || 0) + 1; }
      { let dv = 0; for (const e of sim.ents) if (e.kind === 'unit' && e.owner === 0 && e.devoured) dv += e.devoured; c.st.devouredLive = dv; c.st.devoured = Math.max(c.st.devoured || 0, (c.st.devouredBank || 0) + dv); }
      for (const ev of events) if (ev.t === 'death' && ev.owner === 0 && ev.def === 'pirata') c.st.devouredBank = c.st.devoured; // carniceiro morto: guarda o que já tinha devorado
      if (m.tick) { try { m.tick(c); } catch (err) { console.warn('[ARD] roteiro ' + m.id + ': ' + err.message); } }
      if (D.storms && !sim.storm && c.every(240)) { const n = S.nucleoOf(sim, 0); if (n) S.forceStorm(sim, (n.x + S.CX) / 2, (n.y + S.CY) / 2, 25, 80); }
      (m.events || []).forEach((ev, i) => { if (fired.has('e' + i) || c.t < ev.at) return; fired.add('e' + i); try { ev.do(c); } catch (err) { console.warn('[ARD] evento ' + m.id + '#' + i + ': ' + err.message); } if (ev.say) c.say(...ev.say); });
      (m.script || []).forEach((sc, i) => { if (fired.has('s' + i)) return; let go = false; try { go = sc.at != null ? c.t >= sc.at : !!sc.when(c); } catch (e) {} if (go) { fired.add('s' + i); if (sc.say) c.say(...sc.say); } });
      if (sim.tick % 5 === 0 && sim.time !== lastEval) { lastEval = sim.time; evalObjectives(false); }
      // fim: vitória quando todos os principais estão feitos; derrota com o Núcleo perdido ou falha do roteiro
      let fail = null; try { fail = m.fail ? m.fail(c) : null; } catch (e) {}
      if (!S.nucleoOf(sim, 0) || !me.alive) fail = 'Seu Núcleo foi destruído.';
      if (sim.result && sim.result.outcome !== 'victory' && m.id === 'a4m3') { const top = sim.result.scores ? sim.result.scores.slice().sort((a, b) => b.score - a.score)[0] : null; if (top && top.id === 0 && me.alive) c.st.matchWon = true; else fail = fail || 'Outra Raça ficou com o Domínio.'; }
      if (sim.result && sim.result.outcome === 'victory') c.st.matchWon = true;
      if (fail) { result = { won: false, reason: fail, stars: 0, time: c.t }; return; }
      const allEnemiesDown = sim.result && sim.result.outcome === 'victory'; // todos os inimigos caíram: a missão está ganha mesmo sem os objetivos de etapa
      if (allEnemiesDown || objectives.filter(o => !o.bonus).every(o => o.done)) { evalObjectives(true); if (allEnemiesDown) for (const o of objectives) if (!o.bonus) o.done = true; const bonus = objectives.filter(o => o.bonus && o.done).length; result = { won: true, reason: 'Missão cumprida: ' + m.title + '.', stars: Math.min(3, 1 + bonus), time: c.t }; }
      else if (sim.result && !result) result = { won: false, reason: sim.result.reason || 'O tempo acabou.', stars: 0, time: c.t };
    },
    takeSaid() { return said.splice(0); },
    // 4.1c: tudo o que o roteiro guarda entre os passos (objetivos, contadores, gatilhos já disparados)
    save() { const cs = {}; for (const k of Object.keys(c)) { if (['sim', 'me', 'en', 'D'].includes(k) || typeof c[k] === 'function') continue; cs[k] = S.jsonSafe(c[k]); }
      return { t0, objectives: S.jsonSafe(objectives), c: cs, fired: [...fired], result: S.jsonSafe(result), lastEval }; },
    load(st) { t0 = st.t0; st.objectives.forEach((o, i) => { if (objectives[i] && objectives[i].id === o.id) Object.assign(objectives[i], S.jsonBack(o)); }); for (const k in st.c) c[k] = S.jsonBack(st.c[k]); fired.clear(); for (const f of st.fired) fired.add(f); result = S.jsonBack(st.result); lastEval = st.lastEval; },
  };
  if (saved) runner.load(saved);
  return runner;
}
function missionsOfAct(act) { return M.filter(m => m.act === act); }
function unlocked(id, prog) { const i = M.findIndex(m => m.id === id); if (i < 0) return false; const m = M[i]; if (m.act === 'identidade') return !!(prog.missions.p3 && prog.missions.p3.done); if (i === 0) return true; let k = i - 1; while (k >= 0 && M[k].act === 'identidade') k--; return k < 0 || !!(prog.missions[M[k].id] && prog.missions[M[k].id].done); }
function xpFor(m, diffKey, stars, won) { const d = DIFF[diffKey] || DIFF.normal; return won ? Math.round((m.xp + 100 * stars) * d.xp) : Math.round(m.xp * 0.15); }
ARD.campaign = { ACTS, DIFF, RELICS, RELIC_BY_LEVEL, ACHIEVEMENTS, TITLES, MISSIONS: M, BY_ID, prepare, start, missionsOfAct, unlocked, xpFor, rivalOf };
})(globalThis.ARD = globalThis.ARD || {});
