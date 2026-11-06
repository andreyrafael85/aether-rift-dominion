// Documentação gerada do próprio jogo: as páginas das Raças (docs/racas/<raça>.md em inglês, .pt-BR.md e .es.md), o índice das Raças com as
// Eras e as pesquisas (docs/racas/README*.md) e a página dos chefões e modos (docs/bosses-and-modes*.md). 5.0h.1: o inglês é o principal (sem
// sufixo), como no GitHub. Os números saem da simulação (src/sim.js, src/chefes-sim.js, src/modos.js, src/unicas-sim.js e src/mundo.js: S.UNITS,
// S.BUILDINGS, S.FACTIONS, S.WEAPONS, chefões, Caçada, Eventos da Fenda, mutadores, as únicas, S.MODULOS, S.COMANDANTES, S.MERCS e S.RUINAS) e os nomes e
// descrições, dos dicionários (src/i18n/pt-BR.js, en.js e es.js) pela mesma API do jogo (ARD.i18n.d, ARD.t). O texto de ligação está aqui,
// nos três idiomas. Rodar de novo dá o mesmo resultado (sem data nem sorteio). Imagens: docs/imagens/ (tools/galeria.cjs).
// Uso: node tools/docs-gerar.cjs [--conferir]   (--conferir: não escreve; sai com erro se algum arquivo gerado estiver diferente)
'use strict';
const path = require('path'); const fs = require('fs'); const root = path.resolve(__dirname, '..');
globalThis.ARD = {};
for (const f of ['src/i18n/pt-BR.js', 'src/i18n/en.js', 'src/i18n/es.js', 'src/i18n.js', 'src/modos.js', 'src/chefes-sim.js', 'src/unicas-sim.js', 'src/mundo.js', 'src/sim.js']) require(root + '/' + f);
const S = ARD.sim, CH = ARD.chefesSim, MO = ARD.modos, UN = ARD.unicas, MU = ARD.mundo, D = ARD.i18n.d, t = ARD.t;
const SIMSRC = fs.readFileSync(root + '/src/sim.js', 'utf8');
/* tabelas internas de outros arquivos (constantes sem exportação): lidas do código, para não copiar os valores */
function constDe(arquivo, nome) { const src = fs.readFileSync(root + '/' + arquivo, 'utf8'); const i = src.indexOf('const ' + nome + ' = '); if (i < 0) throw new Error(nome + ' não achado em ' + arquivo); let k = src.indexOf('{', i), n = 0, j = k; for (; j < src.length; j++) { if (src[j] === '{') n++; else if (src[j] === '}' && --n === 0) break; } return Function('return ' + src.slice(k, j + 1))(); }
const LORE = constDe('src/ui-start.js', 'LORE'); const LIDER = constDe('src/main.js', 'LEADER_NAME');
/* números de regras que vivem no meio do código da simulação (sim.js): lidos por expressão; se o código mudar de forma, o gerador para */
function num(re, nome, src) { const m = re.exec(src || SIMSRC); if (!m) throw new Error('regra não achada no código: ' + nome); return m.slice(1).map(Number); }
const [LINHA_BONUS, LINHA_MAX] = num(/mult \*= 1 \+ ([\d.]+) \* Math\.min\((\d+), n\)/, 'Linhas de Montagem');
const [LINHA_DIST] = num(/BUILDINGS\[e\.def\]\.produces && e\.def !== 'nucleo' && dist\(e\.x, e\.y, b\.x, b\.y\) <= (\d+)\) n\+\+/, 'Linhas de Montagem (distância)');
const [LOTE_N, LOTE_MULT] = num(/it\.mult = same >= (\d+) \? ([\d.]+) : 1/, 'Lotes');
const [TRACO_XP] = num(/Object\.keys\(tr\)\.length < 2 && x\[tc\] >= (\d+)/, 'Traços');
const [TRACO_MULT] = num(/if \(tr && tr\[tc\]\) dmg \*= ([\d.]+)/, 'Traços (dano)');
const [FOTO_DIA, FOTO_VAR] = num(/prod \+= (\d+) - (\d+) \* nt/, 'Fotossíntese');
const [FOTO_CICLO] = num(/DM\.cos\(Math\.PI \* 2 \* sim\.time \/ (\d+)\)\) \/ 2; prod \+=/, 'Fotossíntese (ciclo)');
const RACES = Object.keys(S.FACTIONS); const IDIOMAS = ['en', 'pt-BR', 'es']; const SUF = { en: '', 'pt-BR': '.pt-BR', es: '.es' }; /* 5.0h.1: inglês principal */
const MODOS = 'docs/bosses-and-modes'; /* 5.0h.1: o mesmo nome nos três idiomas */
const [NIVEL_VIDA] = num(/NIVEL_VIDA = ([\d.]+)/, 'nível do comandante (vida)', fs.readFileSync(root + '/src/unicas-sim.js', 'utf8'));
const PRODUTORAS = ['nucleo', 'quartel', 'fabrica', 'hangar'];
const sim0 = r => S.createSim({ seed: 7, players: [{ name: 'A', faction: r, human: true }, { name: 'B', faction: r === 'vehnar' ? 'erevane' : 'vehnar', human: false }], minutes: 5 });
/* vida, velocidade e carga como a unidade sai da fábrica (addUnit aplica os ajustes da Raça, como o Rebocador Vehnar) */
function stats(r, def) { const sim = sim0(r); const e = S._int.addUnit(sim, 0, def, 1600, 1600); return { hp: e.maxHp, speed: e.speed, carga: e.cargoCap }; }

/* ---------- texto de ligação nos três idiomas ---------- */
const L = {
  'pt-BR': { idiomas: 'Idiomas', voltar: 'Voltar ao README',
    unicas: 'Construções únicas', unicasTxt: 'Cada Raça tem duas, e cada jogador ergue no máximo uma de cada (atalhos B + J e B + K).',
    modulos: 'Módulos com escolha', modulosTxt: (e, c, tm) => 'A partir da Era ' + e + ', cada uma destas construções aceita um módulo, escolhido entre dois (' + c + ', ' + tm + ' s para instalar). A escolha é para sempre.',
    modCols: ['Construção', 'Opção A', 'Opção B'],
    comandante: 'Comandante em campo', comandanteTxt: 'Opção da partida (Comandantes em campo): o líder entra no mapa com um avatar e três habilidades.',
    nivelTxt: (k, cd, v, vb, vn) => 'O nível sobe com a veterania do avatar: a cada nível, +' + k + '% de dano e cura, −' + cd + '% de recarga e +' + v + '% de vida. Quando cai, volta no Núcleo depois de ' + vb + ' s + ' + vn + ' s por nível, com o nível que tinha.',
    habCols: ['Habilidade', 'Alvo', 'Recarga', 'Efeito'], alvo: { chao: 'ponto no chão', unidade: 'um inimigo', proprio: 'em volta do avatar' }, alcance: 'alcance',
    mundoVivo: 'Mundo vivo', mundoTxt: 'Opção da escaramuça, em quatro partes que se ligam à parte: neutros no mapa, para todos os jogadores.',
    ruinasTxt: (tm, r, mx) => 'Infantaria parada a até ' + r + ' de uma ruína a captura em ' + tm + ' s (mais rápido com mais infantaria, até ' + mx + '). O bônus vale enquanto você a mantiver; infantaria inimiga ao lado toma a ruína de volta.',
    mercTxt: (r, mx, min, cd) => 'O Acampamento fica no centro do mapa. Com uma unidade sua a até ' + r + ' dele, contrate mercenários pagos em Dados: até ' + mx + ' ao mesmo tempo, cada um serve por ' + min + ' min, e uma contratação a cada ' + cd + ' s.',
    surtoTxt: (p, c, av, d, r) => 'O primeiro surto chega aos ' + p + ' min; depois, surto e chuva de meteoros se alternam a cada ' + c + ' s. Um círculo no chão (raio ' + r + ') avisa ' + av + ' s antes; dentro dele, a coleta rende o dobro por ' + d + ' s.',
    bonus: 'Bônus', limite: n => 'até ' + n + ' por mapa', todas: 'Todas as Raças', lider: 'Líder', mundo: 'Mundo natal', estilo: 'Estilo de jogo', historia: 'O líder e a história',
    unidades: 'Unidades', construcoes: 'Construções', superarma: 'Superarma', ascensao: 'Ascensão da Raça', habilidades: 'Habilidades da Raça', tecla: 'tecla', era: 'Era', custo: 'Custo', vida: 'Vida', vel: 'Velocidade', visao: 'Visão',
    ataque: (d, a, c, s) => 'Ataque ' + d + ' a cada ' + c + ' s, alcance ' + a + (s ? ', área ' + s : ''), produzEm: 'Produzida em', produz: 'Produz', energia: 'Energia', modulo: 'Módulo', carga: 'Carga', semArma: 'Sem armas',
    cura: (r, u, b) => 'Repara ' + u + ' de vida/s em unidades e ' + b + '/s em estruturas a até ' + r, aura: { cloak: r => 'Campo de camuflagem a até ' + r, buff: r => 'Aura de dano a até ' + r, elo: r => 'Amplia o Elo a até ' + r },
    gerado: 'Gerado por `node tools/docs-gerar.cjs` a partir do código do jogo (números da simulação e textos dos dicionários). Imagens: `tools/galeria.cjs`, com os modelos do próprio jogo.',
    nota: 'Valores na dificuldade Normal, sem pesquisas nem veterania. Vida e dano das unidades: pontos do jogo; distância e velocidade: unidades do mapa (o mapa tem 3200 de lado).',
    tabelaRacas: ['Raça', 'Líder', 'Estilo', 'Superarma'], eras: 'Eras do Núcleo', pesquisas: 'Pesquisas do Laboratório', contras: 'Contras (dano de cada classe contra cada classe)', atacante: 'Atacante', geral: 'Regras de todas as Raças', recursos: 'Recursos',
    recursosTxt: 'Minério (cristal azul), Plasma (laranja) e Fragmentos de Dados (verde) vêm de nós fixos no mapa, colhidos pelos coletores dentro do seu território. A energia vem dos Reatores e do Núcleo; abaixo de 100% a produção, os sensores e as defesas pioram.',
    hab: {
      linhas: (b, m, d) => '**Linhas de Montagem:** cada outra construção de produção a até ' + d + ' acelera a fila em ' + b + '% (até ' + m + ' delas).',
      lotes: (n, x) => '**Lotes:** com ' + n + ' ou mais unidades iguais na fila, cada uma custa ' + x + '% do preço.', fumaca: '**Reatores que fumegam:** os Reatores Vehnar ficam visíveis para todos os jogadores.',
      neutras: '**Estruturas blindadas:** as construções Vehnar não sofrem o dano extra dos veículos.', roubo: (x, N) => '**Roubo limpo:** o ' + N.pirata + ' rouba ' + x + '% a mais e não deixa Rastro para a vítima.',
      camuflagem: (l, N) => '**Camuflagem:** ' + l + ' ficam camuflados (o ' + N.atirador + ', quando parado).', saltos: n => '**Saltos de Núcleo:** ' + n + ' por partida.',
      tracos: (x, m) => '**Traços:** cada tipo de unidade que causa ' + x + ' de dano a uma classe ganha um Traço contra ela (+' + m + '% de dano), até dois por tipo.',
      foto: (a, b, c) => '**Fotossíntese:** o Núcleo gera de ' + a + ' (noite) a ' + b + ' (dia) de energia, num ciclo de ' + c + ' s.',
      elo: (r, d, a, c) => '**Elo de Sincronia:** cada aliado a até ' + r + ' soma +' + d + '% de dano e −' + a + '% de dano recebido, até ' + c + ' aliados.',
      pacto: (c) => '**Diplomacia afinada:** os pactos custam metade da Caução (' + c + ') e rendem o dobro de reputação.', silencio: r => '**Torres emudecidas:** torres inimigas a até ' + r + ' das suas unidades param de atirar.',
      pares: N => '**' + N.cria + 's em pares:** cada ' + N.cria + ' produzida sai em dupla (em trio com a Ascensão).', fome: (r, f, N) => '**Fome:** fora do seu território, as ' + N.cria + 's perdem ' + r + ' de vida por segundo, até ficar com ' + f + '% da vida.',
      devora: (w, n, N) => '**Devorar:** o ' + N.pirata + ' come carcaças (' + w + ' de carga) e morde Nódulos inimigos (' + n + ' de dano por mordida).' },
    chefoes: 'Chefões e modos', chefoesIntro: 'Os chefões vêm da Fenda: aparecem na Caçada (o modo de derrubar um chefão, sozinho ou com amigos), nos Eventos da Fenda da escaramuça e na campanha.',
    fases: 'Fases', golpes: 'Golpes (com aviso no chão antes de cada um)', aviso: 'aviso', raio: 'raio', dano: 'dano', cada: 'a cada', recompensa: 'Recompensa', dif: 'Dificuldade', vidaChefe: 'Vida', danoChefe: 'Dano', ritmo: 'Intervalo dos golpes',
    golpe: { anel: 'Anel', faixa: 'Faixa', eco: 'Ecos', poco: 'Poço de gravidade', pisao: 'Pisão', solda: 'Solda', calor: 'Onda de calor' },
    arauto: (n, v, g, gc) => n + ' Pilares (' + v + ' de vida cada) alimentam o escudo do Arauto; com os Pilares no chão, o escudo cai. Ele chama ' + g + ' guardas a cada ' + gc + ' s e, nas fases seguintes, cria cópias espectrais (Ecos) das suas unidades. No Colapso, abre um Poço que puxa tudo para o centro; depois do Poço vem a janela de dano, com o olho aberto.',
    forja: (p, v, l, tc, tm, dc, dn) => 'Anda sobre ' + p + ' pernas (' + v + ' de vida cada): cada perna destruída a deixa ' + l + '% mais lenta. Na Linha de montagem ergue uma torre a cada ' + tc + ' s (até ' + tm + ') e solta ' + dn + ' drones a cada ' + dc + ' s. No Núcleo exposto, o corpo fica aberto ao ataque.',
    captura: (n, r, s) => 'Captura: com o Núcleo exposto, ' + n + ' ou mais da sua infantaria a até ' + r + ' do casco por ' + s + ' s capturam a Forja-Mãe.',
    sentinela: 'Um Arauto menor que vigia a Fenda. Aparece no centro do mapa nos Eventos da Fenda; quem der o golpe final leva a recompensa.',
    recArauto: 'Relíquia Lente do Arauto (+10% de visão numa partida) e o título do Arauto.', recForja: 'Destruir: a relíquia Coração da Forja. Capturar: o projeto do Drone-construtor (a unidade chega numa próxima versão).',
    recursosDe: r => r, cacada: 'Caçada', cacadaTxt: (lim) => 'Escolha o chefão, a dificuldade e os aliados (sozinho, 1 ou 2 IAs aliadas, ou amigos pela sala cooperativa). Vitória: derrubar o chefão. Derrota: perder o Núcleo (no cooperativo, todos os Núcleos). Tempo-limite: ' + lim + ' min.',
    arena: 'Arena', inicio: 'Recursos iniciais', aliadoIA: 'IA aliada', medalhas: 'Medalhas', ouro: 'Ouro', prata: 'Prata', bronze: 'Bronze', qualquer: 'qualquer vitória', ate: (tm, p) => 'até ' + tm + ' min e ' + p + ' perdas',
    eventos: 'Eventos da Fenda', eventosTxt: (a, b, s1, s2, i, av) => 'Opção da escaramuça. O primeiro evento chega entre ' + a + ' e ' + b + ' min; a Sentinela da Fenda, entre ' + s1 + ' e ' + s2 + ' min; depois, um evento a cada ' + i + ' min, sempre com ' + av + ' s de aviso.',
    caravana: (n, v, c, d) => n + ' naves corsárias (' + v + ' de vida cada) cruzam o mapa por ' + d + ' s. Quem destruir uma fica com a carga: ' + c + '.',
    enxame: (n, v, d) => n + ' ' + ARD.i18n.d.unidade('vorag', 'cria') + 's errantes (' + v + ' de vida cada) atacam o que estiver mais perto por ' + d + ' s.',
    meteoros: (n, c, r, d, cr) => n + ' meteoros, um a cada ' + c + ' s, com anel de aviso no chão (raio ' + r + ', ' + d + ' de dano). Onde caem, nascem cristais com ' + cr + ' de recurso.',
    sentPremio: c => 'Recompensa de quem derruba a Sentinela: ' + c + '.', evN: ['Caravana Corsária', 'Enxame Errante', 'Chuva de meteoros'], mutadores: 'Mutadores', mapas: 'Mapas', epicos: 'Épicos da campanha', epicosTxt: 'Na campanha O Grande Alinhamento, dois épicos aparecem como chefões das missões.' },
  en: { idiomas: 'Languages', voltar: 'Back to the README',
    unicas: 'Unique buildings', unicasTxt: 'Each Race has two, and each player can raise at most one of each (shortcuts B + J and B + K).',
    modulos: 'Modules with a choice', modulosTxt: (e, c, tm) => 'From Era ' + e + ' on, each of these buildings takes one module, chosen from two (' + c + ', ' + tm + ' s to install). The choice is permanent.',
    modCols: ['Building', 'Option A', 'Option B'],
    comandante: 'Commander in the field', comandanteTxt: 'A match option (Commanders in the field): the leader enters the map as an avatar with three abilities.',
    nivelTxt: (k, cd, v, vb, vn) => 'The level rises with the avatar\'s veterancy: each level adds +' + k + '% damage and healing, −' + cd + '% cooldown and +' + v + '% health. When it falls, it returns at the Core after ' + vb + ' s + ' + vn + ' s per level, keeping its level.',
    habCols: ['Ability', 'Target', 'Cooldown', 'Effect'], alvo: { chao: 'point on the ground', unidade: 'one enemy', proprio: 'around the avatar' }, alcance: 'range',
    mundoVivo: 'Living world', mundoTxt: 'A skirmish option in four parts that can be turned on separately: neutrals on the map, for every player.',
    ruinasTxt: (tm, r, mx) => 'Infantry standing within ' + r + ' of a ruin captures it in ' + tm + ' s (faster with more infantry, up to ' + mx + '). The bonus lasts while you hold it; enemy infantry standing next to it takes the ruin back.',
    mercTxt: (r, mx, min, cd) => 'The Camp sits at the center of the map. With one of your units within ' + r + ' of it, hire mercenaries paid in Data: up to ' + mx + ' at a time, each serves for ' + min + ' min, and one hire every ' + cd + ' s.',
    surtoTxt: (p, c, av, d, r) => 'The first surge comes at ' + p + ' min; after that, surges and meteor showers alternate every ' + c + ' s. A circle on the ground (radius ' + r + ') warns ' + av + ' s ahead; inside it, harvesting yields double for ' + d + ' s.',
    bonus: 'Bonus', limite: n => 'up to ' + n + ' per map', todas: 'All Races', lider: 'Leader', mundo: 'Homeworld', estilo: 'Play style', historia: 'The leader and the story',
    unidades: 'Units', construcoes: 'Buildings', superarma: 'Superweapon', ascensao: 'Race Ascension', habilidades: 'Race abilities', tecla: 'key', era: 'Era', custo: 'Cost', vida: 'Health', vel: 'Speed', visao: 'Sight',
    ataque: (d, a, c, s) => 'Attack ' + d + ' every ' + c + ' s, range ' + a + (s ? ', splash ' + s : ''), produzEm: 'Built at', produz: 'Produces', energia: 'Energy', modulo: 'Module', carga: 'Cargo', semArma: 'Unarmed',
    cura: (r, u, b) => 'Repairs ' + u + ' health/s on units and ' + b + '/s on buildings within ' + r, aura: { cloak: r => 'Cloaking field within ' + r, buff: r => 'Damage aura within ' + r, elo: r => 'Extends the Link within ' + r },
    gerado: 'Generated by `node tools/docs-gerar.cjs` from the game code (numbers from the simulation, texts from the dictionaries). Images: `tools/galeria.cjs`, with the game\'s own models.',
    nota: 'Values on Normal, with no research or veterancy. Health and damage are game points; distance and speed are map units (the map is 3200 across).',
    tabelaRacas: ['Race', 'Leader', 'Style', 'Superweapon'], eras: 'Core Eras', pesquisas: 'Laboratory research', contras: 'Counters (damage of each class against each class)', atacante: 'Attacker', geral: 'Rules for every Race', recursos: 'Resources',
    recursosTxt: 'Ore (blue crystal), Plasma (orange) and Data Fragments (green) come from fixed nodes on the map, gathered by harvesters inside your territory. Energy comes from Reactors and the Core; below 100%, production, sensors and defenses get worse.',
    hab: {
      linhas: (b, m, d) => '**Assembly Lines:** every other production building within ' + d + ' speeds up the queue by ' + b + '% (up to ' + m + ' of them).',
      lotes: (n, x) => '**Batches:** with ' + n + ' or more identical units in the queue, each costs ' + x + '% of the price.', fumaca: '**Smoking Reactors:** Vehnar Reactors are visible to every player.',
      neutras: '**Armored buildings:** Vehnar buildings do not take the extra damage from vehicles.', roubo: (x, N) => '**Clean theft:** the ' + N.pirata + ' steals ' + x + '% more and leaves no Trail for the victim.',
      camuflagem: (l, N) => '**Cloaking:** ' + l + ' are cloaked (the ' + N.atirador + ' while standing still).', saltos: n => '**Core Jumps:** ' + n + ' per match.',
      tracos: (x, m) => '**Traits:** each unit type that deals ' + x + ' damage to a class gains a Trait against it (+' + m + '% damage), up to two per type.',
      foto: (a, b, c) => '**Photosynthesis:** the Core makes ' + a + ' (night) to ' + b + ' (day) energy, on a ' + c + ' s cycle.',
      elo: (r, d, a, c) => '**Sync Link:** each ally within ' + r + ' adds +' + d + '% damage and −' + a + '% damage taken, up to ' + c + ' allies.',
      pacto: (c) => '**Tuned diplomacy:** pacts cost half the Bond (' + c + ') and give double reputation.', silencio: r => '**Silenced towers:** enemy towers within ' + r + ' of your units stop firing.',
      pares: N => '**' + N.cria + 's in pairs:** every ' + N.cria + ' comes out in a pair (a trio with the Ascension).', fome: (r, f, N) => '**Hunger:** outside your territory, ' + N.cria + 's lose ' + r + ' health per second, down to ' + f + '% of their health.',
      devora: (w, n, N) => '**Devour:** the ' + N.pirata + ' eats wrecks (' + w + ' cargo) and bites enemy Outposts (' + n + ' damage per bite).' },
    chefoes: 'Bosses and modes', chefoesIntro: 'The bosses come from the Rift: they show up in the Hunt (the mode for taking down a boss, alone or with friends), in the Rift Events of skirmish and in the campaign.',
    fases: 'Phases', golpes: 'Attacks (with a warning on the ground before each one)', aviso: 'warning', raio: 'radius', dano: 'damage', cada: 'every', recompensa: 'Reward', dif: 'Difficulty', vidaChefe: 'Health', danoChefe: 'Damage', ritmo: 'Attack interval',
    golpe: { anel: 'Ring', faixa: 'Beam', eco: 'Echoes', poco: 'Gravity Well', pisao: 'Stomp', solda: 'Weld', calor: 'Heat Wave' },
    arauto: (n, v, g, gc) => n + ' Pillars (' + v + ' health each) power the Herald\'s shield; with the Pillars down, the shield drops. It calls ' + g + ' guards every ' + gc + ' s and, in later phases, makes spectral copies (Echoes) of your units. In Collapse it opens a Well that pulls everything to the center; after the Well comes the damage window, with the eye open.',
    forja: (p, v, l, tc, tm, dc, dn) => 'It walks on ' + p + ' legs (' + v + ' health each): every leg destroyed makes it ' + l + '% slower. In Assembly Line it raises a turret every ' + tc + ' s (up to ' + tm + ') and releases ' + dn + ' drones every ' + dc + ' s. In Exposed Core, the body is open to attack.',
    captura: (n, r, s) => 'Capture: with the Core exposed, ' + n + ' or more of your infantry within ' + r + ' of the hull for ' + s + ' s capture the Mother Forge.',
    sentinela: 'A smaller Herald that watches over the Rift. It appears at the center of the map in the Rift Events; whoever lands the final blow takes the reward.',
    recArauto: 'The Herald\'s Lens relic (+10% sight for one match) and the Herald title.', recForja: 'Destroy: the Forge Heart relic. Capture: the Builder Drone blueprint (the unit arrives in a future version).',
    recursosDe: r => r, cacada: 'Hunt', cacadaTxt: (lim) => 'Pick the boss, the difficulty and the allies (alone, 1 or 2 allied AIs, or friends in a co-op lobby). Victory: take down the boss. Defeat: lose your Core (in co-op, every Core). Time limit: ' + lim + ' min.',
    arena: 'Arena', inicio: 'Starting resources', aliadoIA: 'Allied AI', medalhas: 'Medals', ouro: 'Gold', prata: 'Silver', bronze: 'Bronze', qualquer: 'any victory', ate: (tm, p) => 'within ' + tm + ' min and ' + p + ' losses',
    eventos: 'Rift Events', eventosTxt: (a, b, s1, s2, i, av) => 'A skirmish option. The first event comes between ' + a + ' and ' + b + ' min; the Rift Sentinel, between ' + s1 + ' and ' + s2 + ' min; after that, one event every ' + i + ' min, always with a ' + av + ' s warning.',
    caravana: (n, v, c, d) => n + ' corsair ships (' + v + ' health each) cross the map for ' + d + ' s. Whoever destroys one keeps its cargo: ' + c + '.',
    enxame: (n, v, d) => n + ' wandering ' + ARD.i18n.d.unidade('vorag', 'cria') + 's (' + v + ' health each) attack whatever is closest for ' + d + ' s.',
    meteoros: (n, c, r, d, cr) => n + ' meteors, one every ' + c + ' s, with a warning ring on the ground (radius ' + r + ', ' + d + ' damage). Where they land, crystals with ' + cr + ' resources appear.',
    sentPremio: c => 'Reward for whoever takes down the Sentinel: ' + c + '.', evN: ['Corsair Caravan', 'Wandering Swarm', 'Meteor shower'], mutadores: 'Mutators', mapas: 'Maps', epicos: 'Campaign epics', epicosTxt: 'In the campaign The Great Alignment, two epics appear as mission bosses.' },
  es: { idiomas: 'Idiomas', voltar: 'Volver al README',
    unicas: 'Construcciones únicas', unicasTxt: 'Cada Raza tiene dos, y cada jugador levanta como máximo una de cada (atajos B + J y B + K).',
    modulos: 'Módulos a elegir', modulosTxt: (e, c, tm) => 'Desde la Era ' + e + ', cada una de estas construcciones acepta un módulo, elegido entre dos (' + c + ', ' + tm + ' s para instalar). La elección es para siempre.',
    modCols: ['Construcción', 'Opción A', 'Opción B'],
    comandante: 'Comandante en el campo', comandanteTxt: 'Opción de la partida (Comandantes en el campo): el líder entra al mapa con un avatar y tres habilidades.',
    nivelTxt: (k, cd, v, vb, vn) => 'El nivel sube con la veteranía del avatar: cada nivel suma +' + k + ' % de daño y curación, −' + cd + ' % de recarga y +' + v + ' % de vida. Cuando cae, vuelve al Núcleo después de ' + vb + ' s + ' + vn + ' s por nivel, con el nivel que tenía.',
    habCols: ['Habilidad', 'Objetivo', 'Recarga', 'Efecto'], alvo: { chao: 'punto en el suelo', unidade: 'un enemigo', proprio: 'alrededor del avatar' }, alcance: 'alcance',
    mundoVivo: 'Mundo vivo', mundoTxt: 'Opción de la escaramuza en cuatro partes que se activan por separado: neutrales en el mapa, para todos los jugadores.',
    ruinasTxt: (tm, r, mx) => 'Infantería quieta hasta ' + r + ' de una ruina la captura en ' + tm + ' s (más rápido con más infantería, hasta ' + mx + '). La bonificación dura mientras la mantengas; la infantería enemiga a su lado recupera la ruina.',
    mercTxt: (r, mx, min, cd) => 'El Campamento está en el centro del mapa. Con una unidad tuya hasta ' + r + ' de él, contrata mercenarios pagados en Datos: hasta ' + mx + ' a la vez, cada uno sirve ' + min + ' min, y una contratación cada ' + cd + ' s.',
    surtoTxt: (p, c, av, d, r) => 'El primer surgimiento llega a los ' + p + ' min; después, surgimiento y lluvia de meteoros se alternan cada ' + c + ' s. Un círculo en el suelo (radio ' + r + ') avisa ' + av + ' s antes; dentro de él, la recolección rinde el doble durante ' + d + ' s.',
    bonus: 'Bonificación', limite: n => 'hasta ' + n + ' por mapa', todas: 'Todas las Razas', lider: 'Líder', mundo: 'Mundo natal', estilo: 'Estilo de juego', historia: 'El líder y la historia',
    unidades: 'Unidades', construcoes: 'Construcciones', superarma: 'Superarma', ascensao: 'Ascensión de la Raza', habilidades: 'Habilidades de la Raza', tecla: 'tecla', era: 'Era', custo: 'Costo', vida: 'Vida', vel: 'Velocidad', visao: 'Visión',
    ataque: (d, a, c, s) => 'Ataque ' + d + ' cada ' + c + ' s, alcance ' + a + (s ? ', área ' + s : ''), produzEm: 'Se produce en', produz: 'Produce', energia: 'Energía', modulo: 'Módulo', carga: 'Carga', semArma: 'Sin armas',
    cura: (r, u, b) => 'Repara ' + u + ' de vida/s en unidades y ' + b + '/s en estructuras hasta ' + r, aura: { cloak: r => 'Campo de camuflaje hasta ' + r, buff: r => 'Aura de daño hasta ' + r, elo: r => 'Amplía el Enlace hasta ' + r },
    gerado: 'Generado por `node tools/docs-gerar.cjs` a partir del código del juego (números de la simulación y textos de los diccionarios). Imágenes: `tools/galeria.cjs`, con los modelos del propio juego.',
    nota: 'Valores en dificultad Normal, sin investigaciones ni veteranía. Vida y daño: puntos del juego; distancia y velocidad: unidades del mapa (el mapa mide 3200 de lado).',
    tabelaRacas: ['Raza', 'Líder', 'Estilo', 'Superarma'], eras: 'Eras del Núcleo', pesquisas: 'Investigaciones del Laboratorio', contras: 'Ventajas (daño de cada clase contra cada clase)', atacante: 'Atacante', geral: 'Reglas de todas las Razas', recursos: 'Recursos',
    recursosTxt: 'Mineral (cristal azul), Plasma (naranja) y Fragmentos de Datos (verde) salen de nodos fijos del mapa, recolectados por los recolectores dentro de tu territorio. La energía viene de los Reactores y del Núcleo; por debajo del 100 %, la producción, los sensores y las defensas empeoran.',
    hab: {
      linhas: (b, m, d) => '**Líneas de Montaje:** cada otra construcción de producción hasta ' + d + ' acelera la cola un ' + b + ' % (hasta ' + m + ').',
      lotes: (n, x) => '**Lotes:** con ' + n + ' o más unidades iguales en la cola, cada una cuesta el ' + x + ' % del precio.', fumaca: '**Reactores humeantes:** los Reactores Vehnar son visibles para todos los jugadores.',
      neutras: '**Estructuras blindadas:** las construcciones Vehnar no sufren el daño extra de los vehículos.', roubo: (x, N) => '**Robo limpio:** el ' + N.pirata + ' roba un ' + x + ' % más y no deja Rastro a la víctima.',
      camuflagem: (l, N) => '**Camuflaje:** ' + l + ' están camuflados (el ' + N.atirador + ', cuando está quieto).', saltos: n => '**Saltos de Núcleo:** ' + n + ' por partida.',
      tracos: (x, m) => '**Rasgos:** cada tipo de unidad que causa ' + x + ' de daño a una clase gana un Rasgo contra ella (+' + m + ' % de daño), hasta dos por tipo.',
      foto: (a, b, c) => '**Fotosíntesis:** el Núcleo genera de ' + a + ' (noche) a ' + b + ' (día) de energía, en un ciclo de ' + c + ' s.',
      elo: (r, d, a, c) => '**Enlace de Sincronía:** cada aliado hasta ' + r + ' suma +' + d + ' % de daño y −' + a + ' % de daño recibido, hasta ' + c + ' aliados.',
      pacto: (c) => '**Diplomacia afinada:** los pactos cuestan la mitad de la Fianza (' + c + ') y dan el doble de reputación.', silencio: r => '**Torres silenciadas:** las torres enemigas hasta ' + r + ' de tus unidades dejan de disparar.',
      pares: N => '**' + N.cria + 's en pares:** cada ' + N.cria + ' sale en pareja (en trío con la Ascensión).', fome: (r, f, N) => '**Hambre:** fuera de tu territorio, las ' + N.cria + 's pierden ' + r + ' de vida por segundo, hasta quedar con el ' + f + ' % de la vida.',
      devora: (w, n, N) => '**Devorar:** el ' + N.pirata + ' come carcasas (' + w + ' de carga) y muerde Nódulos enemigos (' + n + ' de daño por mordida).' },
    chefoes: 'Jefes y modos', chefoesIntro: 'Los jefes vienen de la Grieta: aparecen en la Cacería (el modo para derribar a un jefe, solo o con amigos), en los Eventos de la Grieta de la escaramuza y en la campaña.',
    fases: 'Fases', golpes: 'Golpes (con aviso en el suelo antes de cada uno)', aviso: 'aviso', raio: 'radio', dano: 'daño', cada: 'cada', recompensa: 'Recompensa', dif: 'Dificultad', vidaChefe: 'Vida', danoChefe: 'Daño', ritmo: 'Intervalo de los golpes',
    golpe: { anel: 'Anillo', faixa: 'Franja', eco: 'Ecos', poco: 'Pozo de gravedad', pisao: 'Pisotón', solda: 'Soldadura', calor: 'Ola de calor' },
    arauto: (n, v, g, gc) => n + ' Pilares (' + v + ' de vida cada uno) alimentan el escudo del Heraldo; con los Pilares en el suelo, el escudo cae. Llama a ' + g + ' guardias cada ' + gc + ' s y, en las fases siguientes, crea copias espectrales (Ecos) de tus unidades. En el Colapso abre un Pozo que lo atrae todo al centro; después del Pozo llega la ventana de daño, con el ojo abierto.',
    forja: (p, v, l, tc, tm, dc, dn) => 'Camina sobre ' + p + ' patas (' + v + ' de vida cada una): cada pata destruida la vuelve un ' + l + ' % más lenta. En la Línea de montaje levanta una torre cada ' + tc + ' s (hasta ' + tm + ') y suelta ' + dn + ' drones cada ' + dc + ' s. En el Núcleo expuesto, el cuerpo queda abierto al ataque.',
    captura: (n, r, s) => 'Captura: con el Núcleo expuesto, ' + n + ' o más de tu infantería hasta ' + r + ' del casco durante ' + s + ' s capturan a la Forja Madre.',
    sentinela: 'Un Heraldo menor que vigila la Grieta. Aparece en el centro del mapa en los Eventos de la Grieta; quien dé el golpe final se lleva la recompensa.',
    recArauto: 'La reliquia Lente del Heraldo (+10 % de visión en una partida) y el título del Heraldo.', recForja: 'Destruir: la reliquia Corazón de la Forja. Capturar: el proyecto del Dron constructor (la unidad llega en una próxima versión).',
    recursosDe: r => r, cacada: 'Cacería', cacadaTxt: (lim) => 'Elige el jefe, la dificultad y los aliados (solo, 1 o 2 IA aliadas, o amigos en una sala cooperativa). Victoria: derribar al jefe. Derrota: perder el Núcleo (en cooperativo, todos los Núcleos). Tiempo límite: ' + lim + ' min.',
    arena: 'Arena', inicio: 'Recursos iniciales', aliadoIA: 'IA aliada', medalhas: 'Medallas', ouro: 'Oro', prata: 'Plata', bronze: 'Bronce', qualquer: 'cualquier victoria', ate: (tm, p) => 'hasta ' + tm + ' min y ' + p + ' bajas',
    eventos: 'Eventos de la Grieta', eventosTxt: (a, b, s1, s2, i, av) => 'Opción de la escaramuza. El primer evento llega entre los ' + a + ' y los ' + b + ' min; la Centinela de la Grieta, entre los ' + s1 + ' y los ' + s2 + ' min; después, un evento cada ' + i + ' min, siempre con ' + av + ' s de aviso.',
    caravana: (n, v, c, d) => n + ' naves corsarias (' + v + ' de vida cada una) cruzan el mapa durante ' + d + ' s. Quien destruya una se queda con la carga: ' + c + '.',
    enxame: (n, v, d) => n + ' ' + ARD.i18n.d.unidade('vorag', 'cria') + 's errantes (' + v + ' de vida cada una) atacan lo que tengan más cerca durante ' + d + ' s.',
    meteoros: (n, c, r, d, cr) => n + ' meteoros, uno cada ' + c + ' s, con un anillo de aviso en el suelo (radio ' + r + ', ' + d + ' de daño). Donde caen, nacen cristales con ' + cr + ' de recurso.',
    sentPremio: c => 'Recompensa de quien derriba a la Centinela: ' + c + '.', evN: ['Caravana Corsaria', 'Enjambre Errante', 'Lluvia de meteoros'], mutadores: 'Mutadores', mapas: 'Mapas', epicos: 'Épicos de la campaña', epicosTxt: 'En la campaña La Gran Alineación, dos épicos aparecen como jefes de las misiones.' },
};
const ARQ = (base, l) => base + SUF[l] + '.md';
const n = (x, o) => ARD.i18n.num(x, o);
const pct = x => n(Math.round(x * 1000) / 10);
function custo(c) { const ps = ['minerio', 'plasma', 'dados'].filter(k => c && c[k]).map(k => n(c[k]) + ' ' + t('res.' + k)); return ps.length ? ps.join(' + ') : '—'; }
function img(src, alt, w) { return '<img src="' + src + '" alt="' + alt.replace(/"/g, '&quot;') + '" width="' + (w || 200) + '">'; }
function seletor(base, l, nivel) { return '**' + L[l].idiomas + ':** ' + IDIOMAS.map(x => x === l ? '**' + ARD.i18n.NOMES[x] + '**' : '[' + ARD.i18n.NOMES[x] + '](' + path.basename(ARQ(base, x)) + ')').join(' · '); }
const temImg = rel => fs.existsSync(path.join(root, 'docs', rel));
const eraDe = o => o.era || 1;
const celula = s => String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');
const ERA = e => ['I', 'II', 'III'][(e || 1) - 1];
const ataqueDe = (T, W) => T.ataque(n(W.dmg), n(W.range), n(W.cd), W.splash ? n(W.splash) : 0);
/* 5.0h: módulos com escolha (S.MODULOS), nos dicionários como uni.mod.<construção>.<id> */
const modNome = (b, m) => t('uni.mod.' + b + '.' + m.id + '.nome', null, m.name), modDesc = (b, m) => t('uni.mod.' + b + '.' + m.id + '.desc', null, m.desc);
const habNome = h => t('cmd.hab.' + h.id + '.nome', null, h.id), habDesc = h => t('cmd.hab.' + h.id + '.desc', null, '');
/* construções comuns a todas as Raças: sem as únicas (5.0h), as do mundo neutro (5.0h) e o Bastião (só da superarma Vehnar) */
const comuns = () => Object.keys(S.BUILDINGS).filter(b => b !== 'bastiao' && !S.BUILDINGS[b].unica && !S.BUILDINGS[b].mundo);

/* ---------- página de uma Raça ---------- */
function paginaRaca(r, l) {
  ARD.idioma = l; const T = L[l], F = S.FACTIONS[r], lo = LORE[r]; const o = [];
  const base = 'docs/racas/' + r;
  o.push('<!-- ' + T.gerado.replace(/`/g, '') + ' -->');
  o.push('# ' + D.raca(r), '', seletor(base, l) + ' · [' + T.todas + '](' + path.basename(ARQ('docs/racas/README', l)) + ') · [' + T.voltar + '](../../' + ARQ('README', l) + ')', '');
  o.push('<p align="center">' + img('../../assets/load-' + r + '.webp', D.raca(r), 860) + '</p>', '');
  o.push('<img src="../../assets/insignia-' + r + '.jpg" alt="" width="96" align="right">', '');
  o.push('> ' + D.racaLema(r), '');
  o.push('## ' + T.historia, '');
  o.push('<img src="../../assets/leader-' + r + '-1.jpg" alt="' + LIDER[r] + '" width="140" align="left">', '');
  o.push('**' + T.lider + ':** ' + LIDER[r] + '  ', '**' + T.mundo + ':** ' + lo.world + ' (' + t('vitrine.lore.' + r + '.mundo-tip') + ') · ' + t('vitrine.lore.' + r + '.kicker') + '  ', '**' + T.estilo + ':** ' + lo.style.map((_, i) => t('vitrine.lore.' + r + '.estilo.' + i)).join(' · '), '');
  o.push('*“' + t('sala.fala.' + r) + '”*', '', '<br clear="left">', '');
  /* habilidades */
  const H = T.hab; const hs = []; const N = { pirata: D.unidade(r, 'pirata'), atirador: D.unidade('erevane', 'atirador'), cria: D.unidade('vorag', 'cria'), nodulo: D.construcao('nodulo') };
  if (F.lineBonus) hs.push(H.linhas(n(Math.round(LINHA_BONUS * 100)), n(LINHA_MAX), n(LINHA_DIST)));
  if (F.lotes) hs.push(H.lotes(n(LOTE_N), n(Math.round(LOTE_MULT * 100))));
  if (F.smoke) hs.push(H.fumaca); if (F.structNeutralVsVehicle) hs.push(H.neutras);
  if (F.stolenMult > 1 || F.cleanTheft) hs.push(H.roubo(n(Math.round((F.stolenMult - 1) * 100)), N));
  const cam = Object.keys(F.cloak || {}).filter(k => F.cloak[k]); if (cam.length) hs.push(H.camuflagem(cam.map(k => S.UNITS[k] ? D.unidade(r, k) : D.construcao(k)).join(', '), N));
  if (F.traits) hs.push(H.tracos(n(TRACO_XP), n(Math.round((TRACO_MULT - 1) * 100))));
  if (F.photosynthesis) hs.push(H.foto(n(FOTO_DIA - FOTO_VAR), n(FOTO_DIA), n(FOTO_CICLO)));
  if (F.elo) hs.push(H.elo(n(F.elo.range), pct(F.elo.dmg), pct(F.elo.armor), n(F.elo.cap)));
  if (F.pactHalf) hs.push(H.pacto(n(S.PACT_CAUCAO / 2))); if (F.silence) hs.push(H.silencio(n(F.silence)));
  if (Object.values(S.UNITS).some(u => u.faction === r && u.pair)) hs.push(H.pares(N));
  if (F.hunger) hs.push(H.fome(n(F.hunger.rate), n(Math.round(F.hunger.floor * 100)), N));
  if (F.devour) hs.push(H.devora(n(F.devour.wreck), n(F.devour.nodDmg), N));
  hs.push(H.saltos(n(F.jumps)));
  o.push('## ' + T.habilidades, '', ...hs.map(h => '- ' + h), '');
  /* superarma e Ascensão */
  o.push('## ' + T.superarma + ': ' + D.superarma(r), '', D.superarmaDesc(r), '');
  if (F.superKey === 'fundicao' && temImg('imagens/' + r + '/bastiao.webp')) o.push(img('../imagens/' + r + '/bastiao.webp', D.construcao('bastiao'), 280) + '  ', '**' + D.construcao('bastiao') + '** — ' + T.vida + ' ' + n(S.BUILDINGS.bastiao.hp) + ' · ' + D.construcaoDesc('bastiao'), '');
  const A = S.ASCENSION[r]; o.push('## ' + T.ascensao + ': ' + D.ascensao(r), '', D.ascensaoDesc(r) + ' ' + T.custo + ': ' + custo(A.cost) + '.', '');
  /* 5.0h: comandante em campo (S.COMANDANTES): o avatar, os números e as três habilidades */
  const C = S.COMANDANTES[r], AV = S.UNITS[C.def], WA = AV.weapon ? S.WEAPONS[AV.weapon] : null, imC = 'imagens/' + r + '/' + C.def + '.webp';
  o.push('## ' + T.comandante + ': ' + D.unidade(r, C.def), '', T.comandanteTxt, '');
  o.push('| | |', '|:-:|:--|', '| ' + (temImg(imC) ? img('../' + imC, D.unidade(r, C.def), 200) : '') + ' | ' + ['**' + D.unidade(r, C.def) + '** — ' + D.classe(AV.cls) + ' · ' + T.lider + ': ' + LIDER[r],
    T.vida + ' ' + n(AV.hp) + ' · ' + T.vel + ' ' + n(AV.speed) + ' · ' + T.visao + ' ' + n(AV.sensor), WA ? ataqueDe(T, WA) : T.semArma, '*' + D.unidadeDesc(C.def) + '*'].map(celula).join('<br>') + ' |', '');
  o.push('| ' + T.habCols.join(' | ') + ' |', '|:--|:--|:-:|:--|');
  for (const h of C.habilidades) o.push('| **' + habNome(h) + '** | ' + T.alvo[h.alvo] + (h.alcance ? ' (' + T.alcance + ' ' + n(h.alcance) + ')' : '') + ' | ' + n(h.cd) + ' s | ' + celula(habDesc(h)) + ' |');
  o.push('', T.nivelTxt(n(Math.round(UN.NIVEL_K * 100)), n(Math.round(UN.NIVEL_CD * 100)), n(Math.round(NIVEL_VIDA * 100)), n(UN.VOLTA_BASE), n(UN.VOLTA_NIVEL)), '');
  /* unidades */
  o.push('## ' + T.unidades, '', '| | |', '|:-:|:--|');
  const feitas = [];
  for (const b of PRODUTORAS) for (const u of S.producesFor(b, r)) { if (feitas.includes(u)) continue; feitas.push(u);
    const U = S.UNITS[u], st = stats(r, u), W = U.weapon ? S.WEAPONS[U.weapon] : null; const linhas = [];
    linhas.push('**' + D.unidade(r, u) + '**' + (U.key ? ' (' + T.tecla + ' ' + U.key + ')' : '') + ' — ' + D.classe(U.cls) + ' · ' + T.era + ' ' + ['I', 'II', 'III'][Math.max(eraDe(U), eraDe(S.BUILDINGS[b])) - 1] + ' · ' + T.produzEm + ': ' + D.construcao(b));
    linhas.push(T.custo + ': ' + custo(U.cost) + ' · ' + T.vida + ' ' + n(st.hp) + ' · ' + T.vel + ' ' + n(st.speed) + ' · ' + T.visao + ' ' + n(U.sensor) + (st.carga && (U.capacity || U.cargoCap) ? ' · ' + T.carga + ' ' + n(st.carga) : ''));
    if (W) linhas.push(T.ataque(n(W.dmg), n(W.range), n(W.cd), W.splash ? n(W.splash) : 0)); else if (U.heal) linhas.push(T.cura(n(U.heal.range), n(U.heal.unit), n(U.heal.building)));
    else if (U.aura) linhas.push(Object.keys(U.aura).map(k => (T.aura[k] || (x => k + ' ' + x))(n(U.aura[k]))).join(' · ')); else if (U.cls !== 'civ' && u !== 'pirata') linhas.push(T.semArma);
    linhas.push('*' + D.unidadeDesc(u) + '*');
    const im = 'imagens/' + r + '/' + u + '.webp'; o.push('| ' + (temImg(im) ? img('../' + im, D.unidade(r, u), 200) : '') + ' | ' + linhas.map(celula).join('<br>') + ' |'); }
  o.push('');
  /* construções */
  o.push('## ' + T.construcoes, '', '| | |', '|:-:|:--|');
  for (const b of comuns()) { const B = S.BUILDINGS[b]; const linhas = [];
    linhas.push('**' + D.construcao(b) + '**' + (B.key ? ' (B + ' + B.key + ')' : '') + ' — ' + T.era + ' ' + ['I', 'II', 'III'][eraDe(B) - 1]);
    const en = []; if (B.energyProd) en.push('+' + n(B.energyProd)); if (B.energyUse) en.push('−' + n(B.energyUse));
    linhas.push(T.custo + ': ' + custo(B.cost) + ' · ' + T.vida + ' ' + n(B.hp) + (en.length ? ' · ' + T.energia + ' ' + en.join(' / ') : '') + ' · ' + T.visao + ' ' + n(B.sensor));
    const W = B.weapon ? S.WEAPONS[B.weapon] : null; if (W) linhas.push(T.ataque(n(W.dmg), n(W.range), n(W.cd), W.splash ? n(W.splash) : 0));
    const pr = S.producesFor(b, r); if (pr.length) linhas.push(T.produz + ': ' + pr.map(u => D.unidade(r, u)).join(', '));
    linhas.push('*' + D.construcaoDesc(b) + '*');
    if (B.module) linhas.push(T.modulo + ' **' + D.modulo(b) + '** (' + T.era + ' ' + ['I', 'II', 'III'][B.module.era - 1] + ', ' + custo(B.module.cost) + '): ' + D.moduloDesc(b));
    const MD = S.MODULOS[b]; if (MD) linhas.push(T.modulos + ' (' + T.era + ' ' + ERA(MD[0].era) + ', ' + custo(MD[0].cost) + '): ' + MD.map(m => '**' + modNome(b, m) + '** — ' + modDesc(b, m)).join(' · ')); /* 5.0h */
    const im = 'imagens/' + r + '/' + b + '.webp'; o.push('| ' + (temImg(im) ? img('../' + im, D.construcao(b), 200) : '') + ' | ' + linhas.map(celula).join('<br>') + ' |'); }
  o.push('');
  /* 5.0h: as duas construções únicas da Raça (S.BUILDINGS com unica, S.UNICAS_DE) */
  o.push('## ' + T.unicas, '', T.unicasTxt, '', '| | |', '|:-:|:--|');
  for (const b of S.UNICAS_DE[r]) { const B = S.BUILDINGS[b]; const linhas = [];
    linhas.push('**' + D.construcao(b) + '** (B + ' + B.key + ') — ' + T.era + ' ' + ERA(B.era));
    const en = []; if (B.energyProd) en.push('+' + n(B.energyProd)); if (B.energyUse) en.push('−' + n(B.energyUse));
    linhas.push(T.custo + ': ' + custo(B.cost) + ' · ' + T.vida + ' ' + n(B.hp) + (en.length ? ' · ' + T.energia + ' ' + en.join(' / ') : '') + ' · ' + T.visao + ' ' + n(B.sensor));
    const W = B.weapon ? S.WEAPONS[B.weapon] : null; if (W) linhas.push(ataqueDe(T, W));
    if (B.produces) linhas.push(T.produz + ': ' + B.produces.map(u => D.unidade(r, u)).join(', '));
    linhas.push('*' + D.construcaoDesc(b) + '*');
    const im = 'imagens/' + r + '/' + b + '.webp'; o.push('| ' + (temImg(im) ? img('../' + im, D.construcao(b), 200) : '') + ' | ' + linhas.map(celula).join('<br>') + ' |'); }
  o.push('', '---', '', '<sub>' + T.nota + ' ' + T.gerado + '</sub>', '');
  return o.join('\n');
}

/* ---------- índice das Raças, com as regras de todas ---------- */
function indiceRacas(l) {
  ARD.idioma = l; const T = L[l]; const o = []; const base = 'docs/racas/README';
  o.push('<!-- ' + T.gerado.replace(/`/g, '') + ' -->', '# ' + T.todas, '', seletor(base, l) + ' · [' + T.voltar + '](../../' + ARQ('README', l) + ')', '');
  o.push('| | ' + T.tabelaRacas.join(' | ') + ' |', '|:-:|:--|:--|:--|:--|');
  for (const r of RACES) o.push('| ' + img('../../assets/insignia-' + r + '.jpg', '', 56) + ' | [**' + D.raca(r) + '**](' + path.basename(ARQ('docs/racas/' + r, l)) + ') | ' + LIDER[r] + ' | ' + celula(D.racaLema(r)) + ' | ' + D.superarma(r) + ' |');
  o.push('', '## ' + T.geral, '', '### ' + T.recursos, '', T.recursosTxt, '', '### ' + T.eras, '');
  for (const e of S.ERAS) if (e) o.push('- **' + T.era + ' ' + e.roman + ' — ' + D.era(e.n) + '**' + (e.cost ? ' (' + custo(e.cost) + ', ' + n(e.time) + ' s)' : '') + ': ' + D.eraDesc(e.n));
  o.push('', '### ' + T.pesquisas, '');
  for (const k of Object.keys(S.RESEARCH)) { const R = S.RESEARCH[k]; o.push('- **' + D.pesquisa(k) + '** (' + T.era + ' ' + ['I', 'II', 'III'][R.era - 1] + ', ' + custo(R.cost) + '): ' + D.pesquisaDesc(k)); }
  { const ks = Object.keys(S.MODULOS), M0 = S.MODULOS[ks[0]][0]; o.push('', '### ' + T.modulos, '', T.modulosTxt(ERA(M0.era), custo(M0.cost), n(M0.time)), '', '| ' + T.modCols.join(' | ') + ' |', '|:--|:--|:--|');
    for (const b of ks) o.push('| ' + D.construcao(b) + ' | ' + S.MODULOS[b].map(m => '**' + modNome(b, m) + '** — ' + celula(modDesc(b, m))).join(' | ') + ' |'); } /* 5.0h */
  const cls = ['inf', 'vei', 'dro', 'est', 'sup']; o.push('', '### ' + T.contras, '', '| ' + T.atacante + ' | ' + cls.map(c => D.classe(c)).join(' | ') + ' |', '|:--|' + cls.map(() => ':-:').join('|') + '|');
  for (const a of cls) o.push('| **' + D.classe(a) + '** | ' + cls.map(c => { const v = (S.COUNTER[a] || {})[c]; return v == null ? '1×' : (v > 1 ? '▲ ' : v < 1 ? '▼ ' : '') + n(v) + '×'; }).join(' | ') + ' |');
  o.push('', '<sub>' + T.gerado + '</sub>', '');
  return o.join('\n');
}

/* ---------- chefões e modos ---------- */
function paginaChefoes(l) {
  ARD.idioma = l; const T = L[l]; const o = []; const base = MODOS; const B = CH.BOSSES;
  const min = s => n(Math.round(s / 6) / 10);
  o.push('<!-- ' + T.gerado.replace(/`/g, '') + ' -->', '# ' + T.chefoes, '', seletor(base, l) + ' · [' + T.voltar + '](../' + ARQ('README', l) + ')', '', T.chefoesIntro, '');
  const golpes = (G) => ['| | ' + T.aviso + ' | ' + T.raio + ' | ' + T.dano + ' | ' + T.cada + ' |', '|:--|:-:|:-:|:-:|:-:|', ...Object.keys(G).map(k => { const g = G[k]; return '| ' + (T.golpe[k] || k) + ' | ' + n(g.aviso) + ' s | ' + (g.r != null ? n(g.r) : g.w != null ? n(g.w) + ' × ' + n(g.L) : g.dr != null ? '+' + n(g.dr) : '—') + ' | ' + (g.dano != null ? n(g.dano) : '—') + ' | ' + (g.cada != null ? n(g.cada) + ' s' : '—') + ' |'; })];
  const cab = (id, imgs) => { o.push('## ' + t('chefe.' + id + '.nome'), '', '*' + t('chefe.' + id + '.titulo') + '*', ''); o.push('<p>' + imgs.filter(f => temImg('imagens/chefoes/' + f + '.webp')).map(f => img('imagens/chefoes/' + f + '.webp', t('chefe.' + id + '.nome'), 200)).join(' ') + '</p>', ''); };
  const fases = (id) => '**' + T.fases + ':** ' + B[id].fases.map((f, i) => (i + 1) + '. ' + t('chefe.' + id + '.fase.' + (i + 1)) + ' (' + n(Math.round(f.limiar * 100)) + '%)').join(' → ');
  cab('arauto', ['arauto_1', 'arauto_2', 'arauto_3', 'arauto_j', 'pilar']);
  o.push('**' + T.vidaChefe + ':** ' + n(B.arauto.vida) + ' · ' + fases('arauto'), '', T.arauto(n(B.arauto.pilares), n(B.arauto.pilarVida), n(B.arauto.guardas), n(B.arauto.guardasCada)), '', '**' + T.golpes + '**', '', ...golpes(B.arauto.golpes), '', '**' + T.recompensa + ':** ' + T.recArauto, '');
  cab('forja', ['forja', 'forja_b', 'forja_perna']);
  o.push('**' + T.vidaChefe + ':** ' + n(B.forja.vida) + ' · ' + fases('forja'), '', T.forja(n(B.forja.pernas), n(B.forja.pernaVida), n(Math.round(B.forja.lentidao * 100)), n(B.forja.torreCada), n(B.forja.torresMax), n(B.forja.drones.cada), n(B.forja.drones.n)), '', T.captura(n(B.forja.captura.inf), n(B.forja.captura.r), n(B.forja.captura.t)), '', '**' + T.golpes + '**', '', ...golpes(B.forja.golpes), '', '**' + T.recompensa + ':** ' + T.recForja, '');
  cab('sentinela', ['sentinela']);
  o.push('**' + T.vidaChefe + ':** ' + n(B.sentinela.vida) + ' · ' + T.sentinela, '', '**' + T.golpes + '**', '', ...golpes(B.sentinela.golpes), '', T.sentPremio(custo(MO.SENTINELA_PREMIO)), '');
  o.push('### ' + T.dif, '', '| ' + T.dif + ' | ' + T.vidaChefe + ' | ' + T.danoChefe + ' | ' + T.ritmo + ' |', '|:--|:-:|:-:|:-:|');
  for (const k of Object.keys(CH.DIF)) { const d = CH.DIF[k]; o.push('| ' + D.dificuldade(k) + ' | ' + n(d.vida) + '× | ' + n(d.dano) + '× | ' + n(d.ritmo) + '× |'); }
  o.push('');
  /* Caçada */
  o.push('## ' + T.cacada, '', T.cacadaTxt(n(MO.CAC_LIMITE / 60)), '');
  o.push('| ' + t('modos.cac.chefao') + ' | ' + T.arena + ' |', '|:--|:--|'); for (const k of Object.keys(MO.CACADA)) o.push('| ' + t('chefe.' + k + '.nome') + ' | ' + D.mapa(MO.CACADA[k].mapa) + ' |');
  o.push('', '| ' + T.dif + ' | ' + T.inicio + ' | ' + T.aliadoIA + ' |', '|:--|:--|:--|'); for (const k of Object.keys(MO.CAC_DIF)) o.push('| ' + D.dificuldade(k) + ' | ' + custo(MO.CAC_DIF[k].res) + ' | ' + D.dificuldade(MO.CAC_DIF[k].aliado) + ' |');
  const Md = MO.MEDALHAS; o.push('', '**' + T.medalhas + ':** ' + T.ouro + ' — ' + T.ate(min(Md.ouro.t), n(Md.ouro.perdas)) + ' · ' + T.prata + ' — ' + T.ate(min(Md.prata.t), n(Md.prata.perdas)) + ' · ' + T.bronze + ' — ' + T.qualquer + '.', '');
  /* Eventos da Fenda */
  const E = MO.EV; o.push('## ' + T.eventos, '', T.eventosTxt(min(E.primeiro[0]), min(E.primeiro[1]), min(E.sentinela[0]), min(E.sentinela[1]), min(E.intervalo), n(E.aviso)), '');
  const Cv = MO.CARAVANA, Ex = MO.ENXAME, Mt = MO.METEOROS;
  o.push('- **' + t('chefe.sentinela.nome') + ':** ' + T.sentPremio(custo(MO.SENTINELA_PREMIO)));
  o.push('- **' + T.evN[0] + ':** ' + T.caravana(n(Cv.n), n(Cv.vida), custo(Cv.carga), n(Cv.dur)));
  o.push('- **' + T.evN[1] + ':** ' + T.enxame(n(Ex.n), n(Ex.vida), n(Ex.dur)));
  o.push('- **' + T.evN[2] + ':** ' + T.meteoros(n(Mt.n), n(Mt.cada), n(Mt.r), n(Mt.dano), n(Mt.cristal)), '');
  /* mutadores */
  o.push('## ' + T.mutadores, ''); for (const k of MO.MUT_IDS) o.push('- **' + t('modos.mut.' + k) + ':** ' + t('modos.mut.' + k + '-d'));
  /* 5.0h: Mundo vivo (src/mundo.js): ruínas dos Construtores, Irmandade Corsária, fauna e surto de éter */
  { const CAP = MU.CAP, CT = MU.CONTRATO, SU = MU.SURTO, FA = MU.FAUNA, LI = MU.LIMITE;
    o.push('', '## ' + T.mundoVivo, '', T.mundoTxt, '');
    o.push('### ' + t('mundo.op.ruinas'), '', T.ruinasTxt(n(CAP.t), n(CAP.raio), n(CAP.maxN)), '');
    for (const k of MU.RUINA_TIPOS) o.push('- **' + D.construcao(MU.RUINAS[k].def) + ':** ' + t('mundo.bonus.' + k) + '. ' + D.construcaoDesc(MU.RUINAS[k].def));
    o.push('', '### ' + t('mundo.op.corsarios'), '', T.mercTxt(n(CT.raio), n(CT.max), n(CT.dura / 60), n(CT.cd)), '', '| | ' + T.custo + ' | ' + T.vida + ' | ' + T.vel + ' | |', '|:--|:-:|:-:|:-:|:--|');
    for (const k of MU.MERC_IDS) { const def = MU.MERCS[k].def, U = S.UNITS[def], W = U.weapon ? S.WEAPONS[U.weapon] : null; o.push('| **' + D.unidade('vehnar', def) + '** | ' + custo(MU.MERCS[k].custo) + ' | ' + n(U.hp) + ' | ' + n(U.speed) + ' | ' + (W ? ataqueDe(T, W) + '. ' : '') + celula(D.unidadeDesc(def)) + ' |'); }
    o.push('', '### ' + t('mundo.op.fauna'), '');
    for (const k of Object.keys(FA)) { const def = FA[k].def, U = S.UNITS[def], W = U.weapon ? S.WEAPONS[U.weapon] : null; o.push('- **' + D.unidade('vehnar', def) + '** (' + T.vida + ' ' + n(U.hp) + (W ? ' · ' + ataqueDe(T, W) : '') + ', ' + T.limite(n(LI[k])) + '): ' + D.unidadeDesc(def)); }
    o.push('', '### ' + t('mundo.op.surto'), '', T.surtoTxt(n(SU.primeiro / 60), n(SU.cada), n(SU.aviso), n(SU.dura), n(SU.r))); }
  o.push('', '## ' + T.mapas, ''); for (const k of Object.keys(S.MAPS)) o.push('- **' + D.mapa(k) + ':** ' + t('vitrine.mapa.' + k));
  /* épicos da campanha */
  o.push('', '## ' + T.epicos, '', T.epicosTxt, '', '| | |', '|:-:|:--|');
  for (const [k, r] of [['catedral', 'quorith'], ['matriarca', 'vorag']]) { const U = S.UNITS[k], W = S.WEAPONS[U.weapon]; o.push('| ' + (temImg('imagens/chefoes/' + k + '.webp') ? img('imagens/chefoes/' + k + '.webp', D.unidade(r, k), 200) : '') + ' | **' + D.unidade(r, k) + '** — ' + D.raca(r) + '<br>*' + t('cine.chefe.' + k) + '*<br>' + T.vida + ' ' + n(U.hp) + ' · ' + T.vel + ' ' + n(U.speed) + ' · ' + T.ataque(n(W.dmg), n(W.range), n(W.cd), W.splash ? n(W.splash) : 0) + '<br>*' + celula(D.unidadeDesc(k)) + '* |'); }
  o.push('', '<sub>' + T.nota + ' ' + T.gerado + '</sub>', '');
  return o.join('\n');
}

/* ---------- escrever (ou conferir) ---------- */
const saidas = {};
for (const l of IDIOMAS) { for (const r of RACES) saidas[ARQ('docs/racas/' + r, l)] = paginaRaca(r, l); saidas[ARQ('docs/racas/README', l)] = indiceRacas(l); saidas[ARQ(MODOS, l)] = paginaChefoes(l); }
ARD.idioma = 'pt-BR';
const conferir = process.argv.includes('--conferir'); let dif = 0;
for (const [f, txt] of Object.entries(saidas)) { const p = path.join(root, f); const atual = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
  if (conferir) { if (atual !== txt) { dif++; console.log('diferente: ' + f); } } else if (atual !== txt) { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, txt); } }
const faltas = ARD.i18n.faltas(); if (faltas.length) console.log('chaves que faltam nos dicionários: ' + faltas.join(', '));
console.log('docs: ' + Object.keys(saidas).length + ' páginas' + (conferir ? (dif ? ', ' + dif + ' diferentes' : ', todas iguais ao código') : ' geradas') + ' (' + RACES.length + ' Raças × ' + IDIOMAS.length + ' idiomas, índice e chefões)');
if (conferir && dif) process.exitCode = 1;
