# AETHER RIFT: DOMINION — Análise de referências para o beta v2.0
### 10 de outubro de 2026 · análise de código, licenças e design dos cinco repositórios indicados

> Método: cada repositório foi inspecionado diretamente (metadados e licença pela API do GitHub, árvore de arquivos completa, READMEs e trechos de código-fonte dos sistemas relevantes). Nada aqui é de memória. Os números de estrelas e datas são de 10/10/2026.

---

## 0. Resumo executivo

| Repositório | Licença | Stack | O que absorver | O que não absorver | Veredito |
|---|---|---|---|---|---|
| **godot-open-rts** (lampe-games) | MIT | GDScript, Godot 4.3 | Arquitetura da IA em controladores com corretor de recursos; separação ar/terra na navegação; névoa em duas camadas; HUD de depuração; assets Kenney CC0 | A engine (Godot não roda nosso plano browser-first com simulação própria) | **Modelo de organização** da IA e do projeto |
| **BasicRTS** (JulesVerny) | **sem licença** | C#, Unity | Cadência da IA (avaliação tática a cada 1 s, estratégia a cada ~1 min); enum de estratégias de build; avaliação de ataque por contagem | Qualquer linha de código (sem licença = todos os direitos reservados) | **Ideias de IA de skirmish**, nada de código |
| **OpenRA** | GPL-3.0 | C#, SDL, OpenGL | Sistema de traits data-driven; regras em YAML com herança; Armor × Warhead "Versus"; projéteis com viagem; husks; veterância; módulos de bot; pathfinder hierárquico; lockstep com hash de sync e replays | Código (GPL contamina produto fechado); arte e nomes (propriedade da EA) | **A referência de design** de sistemas para o v2.0 |
| **RecoilEngine** (Beyond All Reason) | GPL-2.0 ou posterior | C++, Lua | Separação sim 30 Hz determinística / draw interpolado; ferramentas de determinismo (SyncChecker, FPUCheck); MoveTypes por domínio; HAPFS/QTPFS com mapas de fluxo e calor; API Lua síncrona/assíncrona; meta de 10k unidades | Código; escala de 10k unidades não é nossa meta | **Referência de arquitetura de simulação** e de disciplina de sync |
| **emnh/rts-models** | GPL-2.0 no repositório, **procedência mista** | JSON legado do Three.js, JPG | Nada além de inspiração de lista de assets | Tudo: modelos do TurboSquid e texturas de sites de wallpaper não são redistribuíveis; formato JSON do Three.js é obsoleto | **Não usar** |

A conclusão central: **nenhum desses repositórios nos dá código ou arte que possamos colocar no jogo**, por licença (GPL, ausência de licença, procedência) ou por stack (Godot, Unity, .NET, C++). O que eles dão é melhor: **projetos de sistemas comprovados** que podemos reimplementar na nossa simulação em TypeScript/Rust, com a nossa identidade.

---

## 1. Critérios de avaliação

1. **Licença e procedência.** O que entra no produto precisa ser compatível com um jogo comercial fechado: MIT, BSD, Apache, CC0, CC-BY (com crédito) ou licenças comerciais. GPL só serve como leitura.
2. **Compatibilidade com o plano.** Nosso alvo é browser-first com simulação determinística dirigida por comandos (hoje JS, no plano Rust/WASM) e renderizador próprio (hoje Canvas 2D com sprites voxel; v2.0 WebGL/WebGPU). Engines completas não se encaixam; algoritmos e arquiteturas sim.
3. **Maturidade e atividade.** OpenRA e Recoil recebem commits diários há mais de dez anos; godot-open-rts é um template de 2023–2025; BasicRTS é um projeto pessoal; rts-models parou em 2018.
4. **Valor para os três eixos pedidos:** gráficos, jogabilidade e IA.

---

## 2. godot-open-rts (Lampe Games)

**O que é.** Template de RTS em Godot 4.3, MIT, 1.117 estrelas, último commit em janeiro de 2025. Assumidamente simples: 1 espécie, 2 recursos, unidades de terra e ar, deathmatch contra IA, névoa básica, unidades somem na névoa, minimapa, movimento em bando até um ponto, UI simples. Sem som, música ou VFX. Arte: 3D Space Kit da Kenney (CC0).

**O que vale absorver.**

- **IA em controladores com corretor de recursos.** A "SimpleClairvoyantAI" (clarividente: enxerga tudo, por desenho) é dividida em `EconomyController`, `ConstructionWorksController`, `DefenseController`, `OffenseController` e `IntelligenceController`. Cada controlador emite um sinal `resources_required(recursos, motivo)` e recebe `provision(recursos, motivo)` quando a economia libera. É um padrão de orçamento competitivo entre departamentos, muito melhor que a nossa lista de build order linear. O `DefenseController` mantém um número esperado de torres antiterra e antiaéreas e pede recursos quando o número cai.
- **Grupos de batalha com estado.** `AutoAttackingBattlegroup` forma um grupo até o tamanho esperado (FORMING), depois ataca (ATTACKING) o inimigo mais próximo que alguma unidade do grupo consiga atingir, e passa ao próximo jogador quando o alvo acaba. Simples e eficaz; nossa IA ataca com "todo o exército", sem grupos.
- **Ações de unidade como objetos.** `MovingToUnit`, `AutoAttacking`, `Constructing` são classes com `is_applicable(unidade, alvo)`. Nós temos estados em string dentro de um switch; migrar para objetos de ordem com validação separa regras de execução e facilita unidades novas.
- **Navegação separada por domínio.** `Navigation.gd` cria um mapa de navegação para o ar e outro para a terra, cada um com obstáculos estáticos e avoidance ativado. Nossos drones já ignoram prédios; o conceito de domínio de movimento (terra, ar, pairando) deve virar dado da unidade.
- **Névoa em duas camadas.** `FogOfWar.gd` desenha, por unidade reveladora, um círculo no viewport do "shroud" (nunca visto) e outro no da "fog" (já visto, agora escuro). Nós temos só visível/escuro mais a memória de prédios. A camada "explorado" é barata e muito legível.
- **HUD de depuração de verdade:** avanço de frame, controle de tempo, modo deus, troca de jogador visível. Nós temos parâmetros de URL; um painel assim economiza horas de teste.

**O que não absorver.** A engine. Godot é excelente, mas o plano exige simulação própria no navegador e um renderizador que controlamos.

---

## 3. BasicRTS (JulesVerny)

**O que é.** Base mínima em Unity (pacote `.unitypackage` com 11 scripts), 3 estrelas, sem arquivo de licença. QG, fábrica, refinaria, coletor, Humvee, tanque, torres de canhão e laser em pontos de montagem fixos. Vence quem destrói o QG. Névoa por segunda câmera e render texture.

**O que vale absorver (só ideias; sem licença não há código reutilizável).**

- **Duas cadências na IA.** Uma avaliação tática a cada segundo (contagem de coletores, tanques e defesas do jogador contra as próprias; ataques em andamento) e uma reavaliação de estratégia a cada minuto. Nossa IA pensa a cada segundo e mistura tudo no mesmo passo; separar o estratégico do tático deixa a IA mais legível e mais fácil de balancear.
- **Estratégias de build nomeadas.** `{Mixed, HumveeFest, HardTank, BuildEconomy, BuildDefences}`, escolhidas com heurísticas e um pouco de aleatório. Para nós: `Expansão`, `Massa de Infantaria`, `Blindados`, `Roubo` (piratas e sabotagem), `Fortaleza`, `Diplomata`. Cada facção com pesos próprios. Isso dá personalidade visível à IA, que é o que um testador percebe.
- **Avaliação de ataque por contagem.** Quantas unidades são necessárias para atacar o coletor, a base ou as defesas, dado o que o inimigo tem protegendo cada alvo. Nossa IA compara valor total de exército; comparar por alvo específico gera raids inteligentes (atacar a refinaria desprotegida em vez do Núcleo).
- **Pontos de montagem para defesas.** Simplifica o posicionamento da IA. Nós podemos usar a borda do território como anel de pontos candidatos.
- **O autor foi honesto:** comportamento por enumerações de estado, aleatoriedade, heurísticas e timeouts ficou "complexo e bagunçado". Confirma a escolha de módulos independentes com orçamento (godot) em vez de uma máquina de estados monolítica.

---

## 4. OpenRA

**O que é.** Motor livre (GPL-3.0) que recria Red Alert, Tiberian Dawn e Dune 2000. C#, 17.522 estrelas, commits diários (último em 9/10/2026). O motor (`OpenRA.Game`, 246 arquivos) é separado dos mods (`OpenRA.Mods.Common`, 1.153 arquivos, mais `mods/` com 2.779 arquivos de regras e dados). A arte original é da EA e não entra em nada nosso; o que interessa é a engenharia de sistemas, que é a mais completa das cinco referências.

### 4.1 Sistema de traits: composição em vez de hierarquia

Cada ator é uma lista de traits declarados em YAML. A pasta `Traits` tem centenas deles, agrupados: Render (84), World (64), Buildings (36), Conditions (35), Player (29), BotModules (25), Multipliers (21), Crates (14), SupportPowers (11), Power (6), Air (5), Radar (4). Alguns nomes dizem tudo: `Armor`, `Armament`, `AttackMove`, `AutoTarget`, `Buildable`, `Capturable`, `Cargo`, `Cloak`, `DetectCloaked`, `GainsExperience`, `Guard`, `Harvester`, `Health`, `Husk`, `Mobile`, `Production`, `RevealsShroud`, `Sellable`, `SpawnActorOnDeath`, `Turreted`, `Valued`.

Exemplo real do tanque médio em `mods/ra/rules/vehicles.yaml`:

```yaml
2TNK:
  Inherits: ^TrackedVehicle
  Inherits@GAINSEXPERIENCE: ^GainsExperience
  Buildable: { Queue: Vehicle, Prerequisites: fix, ~vehicles.allies, ~techlevel.medium }
  Valued: { Cost: 850 }
  Health: { HP: 46000 }
  Armor: { Type: Heavy }
  Mobile: { Speed: 72 }
  RevealsShroud: { Range: 6c0 }
  Turreted: { TurnSpeed: 20 }
  Armament: { Weapon: 90mm, Recoil: 128, LocalOffset: 720,0,80, MuzzleSequence: muzzle }
  SpawnActorOnDeath: { Actor: 2TNK.Husk }
```

**Para nós.** Hoje `sim.js` tem dois dicionários (`BUILDINGS`, `UNITS`) com campos fixos e `if (def === 'pirata')` espalhados. O v2.0 deve ter **definições em dados (JSON ou YAML) com herança e componentes**: `Health`, `Armor`, `Mobile{domain, speed}`, `Armament{weapon}`, `Turreted`, `Cloak`, `DetectCloaked`, `Harvester`, `Siphon`, `Production`, `RevealsSensors`, `Territory`, `GainsExperience`, `SpawnWreckOnDeath`. A simulação itera componentes, não tipos. É o que permite 12 unidades por facção e Tessara com mutações (um Traço vira um componente adicionado em tempo de jogo) sem reescrever o núcleo.

### 4.2 Armas: projéteis, ogivas e armadura

Em `mods/ra/weapons/missiles.yaml` uma arma tem `ReloadDelay`, `Range`, `MinRange`, um `Projectile` com velocidade, inexatidão, rastro e taxa de giro, e **várias ogivas** (`Warhead`): `SpreadDamage` com `Versus` por tipo de armadura (`None: 10, Wood: 74, Light: 34, Heavy: 100, Concrete: 50`), `LeaveSmudge` (cratera), `CreateEffect` (explosão e som, com variante para água).

**Para nós.** Nossa tabela de contras 5×5 é um caso particular de "Versus". Generalizar para **tipos de armadura por unidade** e **percentuais por ogiva** mantém a legibilidade (continuamos mostrando ▲ e ▼ na interface) e libera: armas com área (Prensa), armas que ignoram armadura (hack), ogivas de roubo (sifão como "arma" que drena em vez de ferir). Projéteis com **tempo de viagem e inexatidão** são a mudança visual de maior retorno: hoje o dano é instantâneo com um traçante; com projéteis, o combate ganha arcos, erros, impactos no chão e crateras.

### 4.3 Morte com consequência

`SpawnActorOnDeath` cria um `Husk` (carcaça) que é um ator de verdade: bloqueia, pode ser reciclado, some com o tempo. Nós temos carcaças como decalque no renderizador; no v2.0 a carcaça vira entidade da simulação, o que habilita o Guindaste Armado (Vehnar recicla) e o saque Erevane.

### 4.4 IA por módulos de bot

Onze módulos independentes: `BaseBuilder`, `BuildingRepair`, `CaptureManager`, `Harvester`, `McvExpansionManager`, `McvManager`, `PowerDown`, `ResourceMap`, `SquadManager`, `SupportPower`, `UnitBuilder`. Cada um cuida de uma preocupação e é configurado por YAML (quais unidades, proporções, limites). O `SquadManager` organiza esquadrões por papel (ataque, defesa, proteção, ar) e decide alvos; o `HarvesterBotModule` reposiciona coletores e os protege.

**Para nós.** A IA do v2.0 nasce modular: `Inteligência` (o que foi visto, ameaças por região, mapa de influência), `Economia` (coletores por recurso, expansão por Nódulo), `Construção` (ordem por estratégia, energia sempre acima de 110%), `Produção` (composição contra o que a Inteligência viu), `Esquadrões` (defesa, ataque, raid de piratas, escolta), `Diplomacia` (propostas, traições, reputação) e `Poderes` (Sobrecarga, superarmas). Um corretor de recursos (padrão do godot-open-rts) distribui o orçamento; duas cadências (BasicRTS). Tudo por comandos, como hoje, para continuar determinístico.

### 4.5 Pathfinding hierárquico

`PathSearch` é um A* comum; `HierarchicalPathFinder` mantém grafos abstratos por locomotor que fornecem uma heurística muito mais precisa do que a distância em linha reta, o que reduz os nós explorados quando há obstáculos (lagos, becos). Há grafos densos e esparsos para mapas diferentes.

**Para nós.** Hoje não há pathfinding: unidades vão em linha reta e deslizam em obstáculos. Com muros e bases densas isso quebra. O v2.0 precisa de **grade de navegação + A* com heurística hierárquica + campo de fluxo para grupos** (um campo por destino compartilhado por todas as unidades do comando) e **evitação local** entre unidades. A combinação "fluxo + evitação" é o padrão dos RTS modernos e combina com a nossa escala (centenas de unidades, não milhares).

### 4.6 Lockstep, sync e replays

`OrderManager` numera frames de rede e só avança quando tem as ordens de todos os jogadores para o frame (`IsReadyForNextFrame`). `Sync` gera hashes dos campos marcados com `ISync` a cada frame, e um `SyncReport` detalha o que divergiu quando há dessincronização. Replays são a gravação das ordens (`ReplayRecorder`) reproduzidas pela mesma simulação (`ReplayConnection`).

**Para nós.** É exatamente o desenho do nosso multiplayer de beta (relay de comandos sobre a simulação determinística). O que falta copiar como ideia: numerar ticks de rede, só avançar com os comandos de todos, **hash de estado por tick** (já temos `hash()`), relatório de dessincronia campo a campo e replay como lista de comandos. Isso custa pouco agora e evita semanas de depuração depois.

### 4.7 Névoa e camuflagem

`Shroud` (nunca visto) e névoa (já visto) são traits de jogador; `RevealsShroud` por ator com alcance; `Cloak` com condições de quebra; `DetectCloaked` com alcance. Nosso modelo é o mesmo em espírito; falta o "já visto" e a regra de que **atacar quebra a camuflagem por um tempo**, que já temos, e **detecção por tipo** (o detector revela só certas classes), que não temos.

---

## 5. RecoilEngine (Beyond All Reason)

**O que é.** Evolução da Spring Engine, GPL-2.0 ou posterior, C++ com Lua, 699 estrelas, commits diários. O documento interno de desempenho é explícito: **meta de ~10 mil unidades concorrentes incluindo prédios**, maior partida real com ~17,7 mil. O laço principal é `Update → Draw`: a simulação avança em **frames fixos de 30 Hz, determinísticos**, conforme chegam pacotes `NETMSG_NEWFRAME`; o desenho roda quantas vezes couber entre frames, com **interpolação por `timeOffset`**. Sim e render não são concorrentes; o paralelismo é interno a cada fase.

**O que vale absorver.**

- **A separação que já fazemos, formalizada.** Nossa simulação roda a 10 Hz e o render interpola. Recoil mostra que isso escala a milhares de unidades se a simulação for enxuta e os dados forem contíguos (há um `System/Ecs` e componentes em `MoveTypes/Components`). No v2.0, a entidade vira arrays tipados (SoA) por componente, como o plano já previa.
- **Disciplina de determinismo.** `System/Sync` tem `SyncedFloat3`, `SyncedPrimitive`, `SyncChecker`, `SyncDebugger` e `FPUCheck` (verifica o modo de ponto flutuante). Ou seja: um motor de 20 anos trata determinismo como infraestrutura, com tipos próprios para valores sincronizados. Nosso teste de hash em CI é o começo; o próximo passo é marcar quais campos entram no hash e dumpar o estado quando divergir.
- **Tipos de movimento por domínio.** `GroundMoveType`, `HoverAirMoveType`, `StrafeAirMoveType`, `ShipMoveType`, `StaticMoveType`, `ScriptMoveType`, com `MoveDefHandler` descrevendo onde cada classe pode andar e `UnitTrapCheck` para unidades presas. Para nós: drones "strafe" (passam e voltam), Zepelim "hover", veículos "ground", unidades presas em muros detectadas e reposicionadas.
- **Dois sistemas de caminho.** HAPFS (hierárquico, com `PathEstimator`, `PathCache`, `PathFlowMap` e `PathHeatMap` para dispersar multidões) e QTPFS (quadtree, para mapas que mudam). Mapas de calor e fluxo são a resposta para "cem unidades indo pelo mesmo corredor"; é o que queremos para exércitos passando por um portão.
- **API Lua síncrona e assíncrona.** `LuaSyncedCtrl` muda a simulação (determinístico, replicado), `LuaUnsyncedCtrl` cuida de interface e efeitos. A fronteira é a mesma que separamos entre `sim.js` e `render.js`; vale manter essa parede ao adicionar mods, cenários e scripts de campanha no v2.0 (scripts só podem agir por comandos).
- **Interface de IA externa** (`SkirmishAI`): bots como plugins com um callback padronizado. Para nós, a IA já é um módulo que só emite comandos; formalizar a interface permite IAs diferentes por dificuldade e, no futuro, bots da comunidade.

**O que não absorver.** O código C++ e a escala. 10 mil unidades não é o nosso jogo; 300 a 600 por partida, com cada uma lendo bem na tela, é.

---

## 6. emnh/rts-models

**O que é.** Repositório de 2018 com 17 modelos no formato JSON legado do Three.js (`ant`, `biplane`, `castle`, `coin`, `crystal`, `dragon`, `farm`, `fighter`, `horse`, `house`, `missile`, `moonbase`, `mushroom`, `tank-apc`, `tank-m1a1`, `thor`), cópias em msgpack, 24 texturas JPG e 3 MP3. O README credita as fontes: vários modelos do **TurboSquid**, alguns do OpenGameArt, texturas de sites de wallpaper e de exemplos de terceiros.

**Veredito: não usar.** Três motivos independentes:

1. **Procedência.** A licença GPL-2.0 do repositório não pode relicenciar modelos do TurboSquid (cujas licenças padrão proíbem redistribuição) nem imagens coletadas de sites. Usar isso num produto é risco jurídico real.
2. **Formato.** O JSON de modelos do Three.js foi descontinuado há anos; hoje o padrão é glTF 2.0.
3. **Coerência.** Formiga, dragão, cavalo e cogumelo não têm nada a ver com o nosso universo. Um jogo com identidade precisa de um conjunto de assets coeso, não de uma coleção.

O que ele ensina, por contraste: **documentar a fonte e a licença de cada asset** desde o primeiro dia (um `ASSETS.md` com arquivo, autor, licença, link) é obrigatório.

---

## 7. Onde buscar gráficos de verdade (licenças que podemos usar)

| Fonte | Licença | Serve para |
|---|---|---|
| **Kenney** (kenney.nl) | CC0 | Kits 3D low-poly (Space Kit, o mesmo do godot-open-rts), ícones, UI, sons. Base rápida para o 3D. |
| **Quaternius** | CC0 | Pacotes low-poly de veículos, robôs, cenário sci-fi, animados. |
| **Poly Haven** | CC0 | Texturas PBR (metal, gelo, rocha), HDRIs para iluminação. |
| **OpenGameArt** | varia (CC0, CC-BY, GPL) | Filtrar por CC0/CC-BY; registrar autor; evitar GPL. |
| **Sketchfab** (filtro CC0 / CC-BY) | CC0, CC-BY | Modelos específicos; conferir licença por item. |
| **itch.io, Unity Asset Store, Synty** | comerciais | Pacotes sci-fi coesos com licença de uso em produto; custo baixo, qualidade alta. |
| **Nosso pipeline voxel** | nosso | A característica do jogo. MagicaVoxel é gratuito; artistas voxel são abundantes; modelos exportam para glTF para o 3D. |

Arte gerada por IA pode servir para concept e moodboard; para assets finais traz incerteza de licença e inconsistência entre peças, e não substitui um guia de estilo.

---

## 8. Caminho gráfico do v2.0: 2D rico e 3D de verdade

A decisão não é "2D ou 3D". É **um conjunto de modelos, dois renderizadores**:

### 8.1 Fonte única de modelos

Todos os modelos passam a existir em **voxel (MagicaVoxel .vox)** ou **malha low-poly (glTF)**. Do voxel saem tanto os sprites pré-renderizados (2D) quanto malhas (exportação para OBJ/glTF). Um artista refina modelo por modelo sem tocar no código.

### 8.2 Renderizador 2D (v2.0a): PixiJS v8 com sprites pré-renderizados

- Troca do Canvas 2D por **PixiJS v8** (WebGPU com fallback WebGL): milhares de sprites a 60 fps, batching automático, filtros.
- Sprites com **32 direções** para veículos (como Red Alert 2 fazia com voxels) e 8 para infantaria; **quadros de animação** (esteiras, pernas, hélices, caçamba enchendo) renderizados do mesmo modelo.
- **Mapas de normais** gerados junto com o sprite: o modelo voxel sabe a normal de cada face, então o sprite ganha iluminação dinâmica (holofotes, explosões, dia e noite) sem re-renderizar.
- **Três estados de dano** por remoção de voxels e paleta, carcaças como entidades.
- **Terreno em camadas**: tiles base, transições automáticas entre biomas, decalques, altura simulada por sombras (platôs e rampas desenhados, não simulados).
- **Partículas em GPU** (PixiJS ParticleContainer): fumaça, faíscas, destroços, neve da Tempestade de Éter.
- **Pós-processamento**: bloom nos emissivos, vinheta de regime de energia, tremor.

Resultado esperado: o visual de "sprites pré-renderizados com volume" das referências 1, 3 e 5, com iluminação dinâmica que elas não tinham.

### 8.3 Renderizador 3D (v2.0b): Three.js com os mesmos modelos

- Malhas glTF low-poly (do voxel ou de artista), **instancing** por tipo de unidade, LOD em três níveis.
- Câmera a 55° com zoom e rotação limitada (quatro orientações, como os RTS 3D clássicos, para manter legibilidade).
- Luz direcional com sombras em desktop, luzes pontuais emissivas, dia e noite reais, névoa volumétrica leve na Fenda.
- Terreno com altura real (heightmap), rampas e platôs que afetam a linha de visão (unidade no alto vê mais longe; é regra de simulação, não só visual).
- O HUD, a simulação, a IA e a rede são os mesmos. O renderizador é um módulo trocável, como já é hoje.

### 8.4 Como decidir entre 2D e 3D ao final

Os dois renderizadores coexistem durante o v2.0; a validação com testadores (enquete A/B, desempenho em celulares) decide o padrão. O custo de manter os dois é aceitável porque a fonte dos modelos é uma só.

---

## 9. Validação de jogabilidade, IA e mecânica

### 9.1 Jogabilidade (o que as referências confirmam ou corrigem)

| Tema | Hoje (1.5a) | v2.0 | Referência |
|---|---|---|---|
| Definição de unidades | dicionários fixos em código | componentes em dados com herança | OpenRA |
| Dano | tabela 5×5 instantânea | armadura × ogiva "Versus", projéteis com viagem, área, inexatidão | OpenRA |
| Movimento | linha reta + deslizamento | grade, A* hierárquico, campo de fluxo por grupo, evitação local, domínios terra/ar/pairando | OpenRA, Recoil, Godot |
| Névoa | visível/escuro + memória de prédios | shroud (nunca visto), fog (já visto), visível; detecção por classe | OpenRA, Godot |
| Morte | decalque | carcaça como entidade, reciclável e saqueável | OpenRA |
| Progressão | nenhuma | veterância em 3 patentes (Tessara liga Traços a patentes) | OpenRA |
| Ordens | estados em string | objetos de ordem com validação (`is_applicable`), fila de ordens (shift) | Godot |
| Formações | grade fixa no destino | formação mantida em movimento, velocidade do mais lento | Recoil (MoveTypes) |
| Escala | ~150 entidades | 600 com SoA, grid espacial e culling | Recoil |

### 9.2 Inteligência artificial

Arquitetura do v2.0, combinando as três fontes:

1. **Módulos** (OpenRA): Inteligência, Economia, Construção, Produção, Esquadrões, Diplomacia, Poderes.
2. **Corretor de recursos** (Godot): cada módulo pede orçamento com um motivo e uma prioridade; a Economia distribui.
3. **Duas cadências** (BasicRTS): tático a 1 s (reagir a sifão, defender refinaria, retirar esquadrão perdendo), estratégico a 60 s (trocar de estratégia nomeada, decidir expansão, propor ou quebrar pacto).
4. **Estratégias nomeadas com personalidade por facção**: Vehnar tende a `Fortaleza` e `Blindados`; Erevane a `Roubo` e `Mobilidade`; Tessara a `Adaptação` (produz o contra do que viu); Vael a `Diplomata`.
5. **Alvos por avaliação** (BasicRTS): atacar o alvo com pior relação defesa/valor (refinaria isolada, Nódulo distante), não só o Núcleo.
6. **Mapa de influência**: grade com força própria e inimiga por célula; esquadrões evitam células onde perderiam e piratas escolhem rotas pela sombra da influência.
7. **A IA só emite comandos** (como hoje): continua determinística e replicável.

### 9.3 Mecânica e rede

- **Lockstep de beta** no desenho do OpenRA: ticks numerados, avanço só com comandos de todos, hash por tick, relatório de dessincronia, replay como lista de comandos.
- **Determinismo como infraestrutura** (Recoil): campos sincronizados explícitos, dump de estado em divergência, teste de CI com replays de referência (já previsto no plano).
- **Scripts só por comandos** (Recoil Lua synced/unsynced): cenários, campanha e eventos sazonais escritos em JS, agindo pela mesma porta da IA.

---

## 10. A nossa característica (o que nenhuma referência tem)

O risco de estudar cinco referências é virar uma média delas. O que mantém o jogo nosso:

- **A Fenda** como centro gravitacional do mapa e da economia (Plasma só perto dela).
- **Roubo como mecânica central e visível**: sifão, Caixa, Rastro, Recursos Marcados, Rebocador com cabo. Nenhuma referência tem um sistema de roubo; OpenRA tem captura de prédios, que é outra coisa.
- **Energia como regime** (Pleno, Racionado, Colapso), não como barra. OpenRA tem energia binária (ligado/desligado).
- **Diplomacia mecânica** com Caução, Testemunha, Golpe de Traição e reputação persistente. Nenhuma referência tem diplomacia entre jogadores com consequência.
- **Facções assimétricas por filosofia**, com Tessara mutando o próprio modelo em campo.
- **Estética industrial-orgânica em voxel** com luz, em vez de sprites pintados ou 3D genérico.

---

## 11. Programa do v2.0

| Entrega | Conteúdo | Dependências |
|---|---|---|
| **v2.0-core** | Simulação com componentes em dados; armadura × ogiva; projéteis; carcaças; veterância; ordens como objetos; grade de navegação com A* hierárquico, campo de fluxo e evitação; domínios de movimento; shroud/fog | nenhuma; mantém a API de comandos |
| **v2.0-ia** | IA modular com corretor, duas cadências, estratégias por facção, avaliação de alvo, mapa de influência; cenários por script | core |
| **v2.0-2d** | PixiJS v8, sprites em 32 direções com normais, animação por quadros, partículas em GPU, pós-processamento, terreno em camadas | core |
| **v2.0-3d** | Three.js, glTF dos mesmos modelos, instancing, terreno com altura e linha de visão | core; modelos exportados |
| **v2.0-rede** | Lockstep por relay de comandos, hash por tick, replays, espectador | core |
| **Validação** | Enquete A/B 2D vs 3D; desempenho em celulares; métricas de retenção e de roubo por partida; critérios da proposta v1.5 | 2d e 3d |

Ordem recomendada: core, ia, 2d, rede, 3d. O 2D entrega a "melhora gráfica drástica" primeiro, com menos risco em celular; o 3D entra com os modelos já validados.

---

## 12. Registro de licenças (para o repositório)

| Item | Licença | Uso permitido |
|---|---|---|
| godot-open-rts | MIT | Ler, adaptar ideias, até copiar trechos com atribuição (não vamos: é GDScript) |
| BasicRTS | nenhuma | Ler. Nenhuma cópia de código |
| OpenRA | GPL-3.0 | Ler. Nenhuma cópia de código ou dados; arte é da EA |
| RecoilEngine | GPL-2.0+ | Ler. Nenhuma cópia de código |
| emnh/rts-models | GPL-2.0 declarada, procedência mista | Nenhum uso |
| Kenney, Quaternius, Poly Haven | CC0 | Uso livre, crédito opcional (vamos creditar) |

Regra prática a partir de agora: **todo asset entra no repositório com uma linha em `ASSETS.md`** (arquivo, origem, autor, licença, link). Sem linha, não entra.
