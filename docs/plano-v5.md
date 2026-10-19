# Aether Rift: Dominion — Plano v5.0 "Além da Fenda"
### 18 de outubro de 2026 · depois da 4.3l · inclui a validação do arquivo "Games RTS – Extrair o máximo dos jogos (visuais, desempenho etc.)"

**Numeração nova (decisão do dono, 18/10/2026).** A antiga v5.0 (contas, relé, ranking, temporadas, social e loja) passa a ser a **v6.0**, pensada para escalar com servidores. A **v5.0** passa a ser o salto visual e de jogo descrito aqui. O plano da v6.0 continua em `docs/plano-v4-v5.md` §7, já com os números novos.

---

## 0. Resumo

A série 4.3 refez o jogo inteiro (unidades, bases, combate, terreno, mapas, clima, luz, Modo Foto, interface) e a 4.3l fechou com o carregamento em paralelo: na RTX, o Chrome caiu de 10,8 s para 2,5 s e o iPhone de 8,1 s para 0,7 s. O que ainda separa o Aether Rift dos RTS que o público adora não é a qualidade de cada modelo. Faltam cinco coisas:

1. **Presença de cinema.** O jogo não tem trilha sonora, não tem câmera roteirizada e o briefing ainda é uma janela.
2. **Um mundo que reage.** O ciclo de dia e noite (12,5 min) troca a luz, mas o sol não anda e não há nascer nem pôr do sol. A névoa de guerra é uma sombra plana e o chão guarda pouco da batalha.
3. **Ameaças maiores que as Raças.** Os dois chefes de hoje (Catedral Errante e Matriarca) são unidades das Raças com mais vida, uma ronda e o poder da própria unidade (a Matriarca choca Crias). Não têm fases nem golpes telegrafados.
4. **Inimigos com personalidade.** A IA tem quatro estratégias (Blindados, Expansão, Fortaleza e Roubo), mas os cinco líderes jogam do mesmo jeito.
5. **Conteúdo para voltar.** São só dois mapas (Planície da Fenda e Cinturão), não há replays e não há modo para jogar contra um desafio fixo.

A v5.0 ataca isso em quatro ondas, com uma trilha contínua de desempenho:

| Onda | Versões | O que o jogador sente |
|---|---|---|
| 1. Primeiro impacto | 5.0a Céu, clima e nuvens de guerra · 5.0b Sala de Comando | Céu de verdade, clima por bioma e uma névoa de guerra feita de nuvens. A tela inicial vira uma sala de comando 3D, com a base da Raça e o mapa em holograma |
| 2. Vida e som | 5.0c Bases e unidades vivas · 5.0d Som e cinema | As construções sobem com a assinatura da Raça, a base trabalha e mostra a energia, e o chão guarda a batalha. O jogo ganha trilha, som posicional, locutor e briefing de cinema |
| 3. Ameaças maiores | 5.0e Chefões · 5.0f Inteligência e mundo | Chefões com fases no modo Caçada e nos Eventos da Fenda. A IA ganha a personalidade de cada líder, e entram fauna, ruínas capturáveis, mercenários e construções únicas por Raça |
| 4. Além da Fenda | 5.0g Campanha 2 · 5.0h Mundos novos · 5.0i Replays e relatório | Campanha nova de 15 missões com 6 chefões, cinco mundos novos, um gerador de mapas, replays com câmera de cinema e clipes |
| Contínua | Desempenho em toda versão · 5.0j Laboratório WebGPU | Firefox carregando em até 5 s, travadas caçadas no celular e WebGPU testado na tela inicial antes de qualquer migração |

As decisões que preciso do dono estão em §9.

---

## 1. Onde estamos: os testes da 4.3l

| | Chrome · RTX 1000 Ada | Firefox · mesma máquina | iPhone · Safari |
|---|---|---|---|
| Qualidade no teste | Ultra | auto → Alta | auto → Baixa |
| FPS médio | 60 | 60 | 58 |
| Piores 1% | 46 fps | 54 fps (4.3k: 42) | 26 fps (4.3k: 36) |
| Pior quadro | 100 ms | 21 ms | 139 ms (4.3k: 116) |
| Travadas acima de 50 ms | 1 de 1.795 | 0 de 1.800 | 2 de 1.746 |
| CPU por quadro | 3,7 ms | 5 ms | 2 ms |
| GPU por quadro | 11,7 ms | não medido | não medido |
| Shaders compilados no teste | 0 | 0 | 0 |
| Carregamento 4.3k → 4.3l | 10,8 s → **2,5 s** (shaders 8,6 → 1,1 s) | 12,0 s → 11,8 s (shaders 7,6 → 7,7 s) | 8,1 s → **0,7 s** (shaders 7,2 → 0,2 s) |

O que os números dizem:

- **Criar todos os programas de uma vez funcionou no Chrome e no Safari.** No Chrome, os shaders caíram de 8,6 para 1,1 s. No iPhone, de 7,2 para 0,2 s.
- **O Firefox não tem `KHR_parallel_shader_compile`** (o MDN e o caniuse marcam "não"). Por isso compila um programa depois do outro, e os 7,7 s não mudaram. O caminho é ter menos programas (77 para no máximo 45) e compilar enquanto o jogador ainda está na tela inicial, no computador. Meta: até 5 s.
- **O nome "GeForce 8800 GTX ..., or similar" no Firefox não é a placa real.** É a máscara de privacidade do Firefox para o nome da GPU. O desempenho medido é o da RTX.
- **Travadas.** Houve uma de 100 ms no Chrome e duas no iPhone, a pior de 139 ms. No iPhone, os piores 1% caíram de 36 fps (4.3k) para 26 fps (4.3l). Pode ser variação entre testes ou custo da interface nova no Safari. Hoje o teste não diz o que aconteceu no quadro lento; o "Detetive de travadas" da 5.0a vai dizer.
- **O iPhone ficou na Baixa porque o teste desliga o ajuste automático de propósito**, para medir uma qualidade fixa. A subida de degrau da 4.3l acontece nas partidas normais.

---

## 2. Validação do arquivo, ponto a ponto

Legenda: **✔ já temos** (com a versão em que entrou) · **➕ adotar** na v5.0 · **✎ adaptar** do nosso jeito · **✗ não adotar** (com o motivo). Parte da pesquisa já tinha sido avaliada em 16/10 (`docs/avaliacao-stack-3d.md` §6); aqui está o que mudou e o que é novo.

### 2.1 Ecossistema e bibliotecas

| Sugestão do arquivo | No jogo hoje | Veredito |
|---|---|---|
| Three.js para controle de baixo nível | r186 (o mais novo publicado é o r186.1), com importmap | ✔ 4.3b |
| Física com Rapier.js ou Cannon-es | Movimento próprio e determinístico, conferido em 4 motores de navegador | ✗ O lockstep do multijogador e os salvamentos dependem de resultado idêntico. Os destroços já caem na GPU, pelo shader de ruína (4.3f) |
| Interface em HTML/CSS ou Preact/Svelte | HTML/CSS próprio, sem framework, escrevendo no DOM só quando um valor muda | ✔ Framework não traria ganho |
| Howler.js para áudio | Efeitos sintetizados em WebAudio e voz do sistema pela Web Speech API; **não há trilha sonora** | ✎ Sem Howler (não há arquivos de áudio para gerenciar). Som posicional com o próprio WebAudio e trilha adaptativa na 5.0d |
| Blender → GLB com Draco, gltfpack e glTF-Pipeline | Malhas geradas em código (277 no portão de qualidade), com LOD pelo meshoptimizer | ✎ O kit procedural continua (0 KB de download, cor por jogador, variação por semente). GLB entra só quando houver um artista 3D |
| Texturas da Poliigon/AmbientCG; modelos do Sketchfab/CGTrader | Texturas geradas na GPU (4.3c) | ✗ Estilo e licença: fotorrealismo destoa do nosso visual estilizado, e cada modelo de terceiros traz risco de licença |
| WebGPU com TSL | WebGL2; os 77 programas são remendos GLSL (onBeforeCompile); o pós (pmndrs postprocessing) e o N8AO só funcionam em WebGL | ✎ Laboratório na 5.0j, começando pela tela inicial. WebGPU hoje: Chrome e Edge (inclusive Android 12+), Safari 26, Firefox 141 no Windows e 145 no macOS ARM; no Firefox para Linux e Android ainda está em andamento |
| Pós-processamento: bloom, SSAO, tone mapping ACES | Bloom HDR, N8AO, ACES, SMAA, bruma de altura e gradação própria | ✔ 4.3b |
| Motion blur | — | ✗ Na partida borra a leitura das unidades. Pode entrar só nas cenas de cinema (5.0d) |
| SSR/SSGI com realism-effects | Reflexo plano no gelo (4.3h) e reflexo do céu por PMREM | ✗ O realism-effects teve a última versão publicada (1.1.2) em maio de 2023, para o three r148+. A v2 está num ramo, sem publicação. SSGI custa caro para pouco ganho na câmera alta de RTS |
| IBL com mapa HDR | Reflexo do céu do próprio mapa por PMREM (4.3b) | ✔ Sem arquivo HDR (regra do procedural). ➕ Refazer o PMREM quando a hora do dia mudar (5.0a) |
| "Three.js Water Pro" | Lagos de plasma e gelo próprios (4.3h) | ✗ Não encontrei essa biblioteca como projeto aberto. Os nossos mapas não têm oceano |
| React Three Fiber e drei | — | ✗ O jogo não usa React |
| stats.js | Teste de desempenho com FPS, 1%, 5%, CPU, GPU, shaders e carregamento por etapa | ✔ 4.2a e 4.3i. ➕ Detetive de travadas (5.0a) |

### 2.2 Desempenho e memória

| Sugestão | No jogo hoje | Veredito |
|---|---|---|
| InstancedMesh e merge de malhas | Instâncias por modelo e jogador; adereços por célula | ✔ 4.0d e 4.3c |
| LOD | Versão leve por distância, em unidades e construções | ✔ 4.3d e 4.3f |
| Frustum culling | Ligado; malhas sem instância fora do desenho | ✔ |
| Occlusion culling | — | ✗ A câmera de RTS vê de cima; quase nada esconde nada |
| Pixel ratio até 2 | Resolução dinâmica em degraus de 10%, mínimo de 67% no computador e 55% no celular | ✔ 4.3i |
| Delta time e laço limpo | Simulação fixa de 10 Hz, desenho interpolado | ✔ |
| Nada de `new Vector3()` por quadro; pools | Feito nos laços quentes da 4.3i | ✎ Auditoria de alocação por quadro (5.0a), porque as travadas do celular podem ser coleta de lixo |
| `dispose()` de geometria, material e textura | Modo Foto e tela inicial liberam tudo ao sair | ✔ |
| Sombras assadas | Cavidade e oclusão por vértice no terreno (4.3c) | ✎ Cavidade calculada por peça nos modelos (pendência da 4.3d), na 5.0c |
| Mapa de sombra de 512 a 1024 | Tamanho pela qualidade (2048 na Média do computador) | ✔ O tamanho já segue a qualidade e o aparelho |
| Materiais leves no celular | Versão leve, sem reflexo plano, qualidade Baixa | ✔ |

### 2.3 Gráficos de RTS (unidades, terreno, efeitos e construção)

| Sugestão | No jogo hoje | Veredito |
|---|---|---|
| VAT (animação em textura) para milhares de soldados | Animação por peça na GPU: rodas, esteiras, pernas, rotores, recuo e torres que miram (4.2b); esquadrões de três figuras com passo defasado e baixa visível (4.3e) | ✔ Faz o mesmo sem textura e sem esqueleto, porque os modelos são gerados por peça |
| Decalques com DecalGeometry | Mapa de cicatrizes de 2048² no terreno: rastros por Raça, queimado, cratera e brasa (4.3c) | ✔ Mais barato que um decalque por geometria. ➕ Avaria nas paredes (5.0c) e crateras que afundam o chão (5.0a) |
| Splatting de texturas no terreno | Material em camadas por bioma, mistura pela altura, rocha triplanar e texturas de detalhe geradas na GPU (4.3c) | ✔ |
| Relevo por heightmap + three-mesh-bvh | Relevo procedural de 321² e clique pelo relevo analítico | ✔ Sem BVH: o relevo é uma função conhecida |
| Névoa de guerra volumétrica com ruído | Névoa no shader do chão e dos adereços, refeita 10 vezes por segundo (4.2d, 4.3i) | ➕ "Nuvens de guerra" na 5.0a |
| Partículas na GPU com three.quarks | fx3d.js com movimento analítico no vertex shader (4.2c, 4.3g) | ✔ O arquivo diz que o three.quarks "processa tudo na GPU": não confere. O próprio pacote diz que calcula as partículas na CPU (simulação na GPU está "em andamento"). Ficam da 4.3g: partículas suaves e fumaça com turbulência (5.0c) |
| Atlas de texturas | Materiais procedurais por peça, sem textura por prédio | ✗ Não se aplica |
| Máscara de cor do time | Cor por jogador em cada peça | ✔ |
| Pathfinding com recast ou Pathfinding.js | Campos de fluxo determinísticos com 256 rotas guardadas (4.2g, 4.3i) | ✗ O recast trabalha em ponto flutuante e quebraria o lockstep |
| Rapier para projéteis | Balística analítica nas armas (4.3g) | ✗ |
| Prédio que sobe por corte com borda brilhante | Invólucro de obra por Raça (andaime, holograma, casulo, cristais, casulo úmido) e efeito de conclusão (4.3f) | ➕ Obra 2.0 (5.0c): plano de corte que sobe com o progresso, borda na cor e no estilo da Raça, faíscas e poeira na base, tranco no fim |
| Holograma verde/vermelho ao posicionar | Fantasma de obra com linhas de varredura e aviso de sobreposição | ✔ |
| Tremor de câmera | Tremor nas explosões grandes e superarmas | ✔ |
| Luzes que acendem ao concluir | Emissivos à noite e luzes que falham na avaria (4.2d, 4.3f) | ✔. ➕ A energia aparece na base (5.0c) |
| GSAP ou tween.js para animar | Curvas próprias | ✗ Biblioteca desnecessária. O sistema de cinema da 5.0d tem quadros-chave próprios (~2 KB) |

### 2.4 Campanha e briefing

| Sugestão | No jogo hoje | Veredito |
|---|---|---|
| Paleta e clima diferentes por missão | Clima, noite e tempestade por missão | ✎ Direção de arte por missão (céu, hora, LUT e marco) na 5.0g |
| Marcos gigantes no mapa | Ruínas e carcaças espalhadas | ➕ Kit de marcos (nave caída, anel dos Construtores, esqueleto colossal) na 5.0h |
| Cinemáticas no motor | Não há | ➕ Sistema de cinema na 5.0d |
| Curva de missões (tutorial, unidade nova, defesa, épica) | 20 missões com ondas, comboios, escolta, defesa noturna, furtividade e 2 chefes | ✔ 4.0e. A Campanha 2 sobe o nível (5.0g) |
| Fases em JSON | Missões como dados + funções de teste em `src/campaign.js` | ✗ Já são dados; as funções dão mais poder que JSON |
| Tela de carregamento com briefing | Arte do mundo natal em 2560×1440 e dica da missão (4.3l) | ✔ |
| Salvamento automático | A cada 10 s e ao sair da aba, no IndexedDB (4.1c) | ✔ |
| Gatilhos de evento | Emboscadas, tempestade na rota, raides, chefe que surge | ✔. ➕ Gatilhos de área e eventos de cena (ponte que cai, reforço que desce) na 5.0g |
| Retrato animado de rádio | Busto 3D com rig, quatro humores e fala (4.1e, 4.3e) | ✔. ➕ Transmissão em holograma e boca acompanhando a voz (5.0b) |
| XState para estados da missão | Objetivos com testes por passo | ✗ Não precisa |
| Tiled ou editor de fases | — | ➕ Gerador de mapas por semente na 5.0h. Editor e compartilhamento ficam para a v6.0, que terá onde guardar os mapas |
| Briefing de cinema (varredura, texto digitado, mapa de satélite, câmera sincronizada) | Janela de briefing com os líderes | ➕ "Sala de Guerra" na 5.0d, na linguagem visual do Comando da Fenda (sem imitar o terminal verde de outro jogo) |
| Bip a cada objetivo e chiado de rádio | Bipes sintetizados | ➕ Na 5.0d |

### 2.5 O que o arquivo afirma e não confere

- **"O three.quarks processa tudo na GPU."** O pacote diz o contrário: calcula a maior parte na CPU, e a simulação na GPU está em andamento. O nosso fx3d.js é que simula na GPU.
- **"realism-effects deixa o Three.js idêntico a uma engine de PC."** A última versão publicada (1.1.2) é de maio de 2023 e pede o three r148+. O próprio repositório diz que a v2 está em andamento num ramo.
- **"O Three.js substituiu as ferramentas antigas pelo RenderPipeline baseado em nós."** Isso vale para o renderizador WebGPU. No WebGL o EffectComposer continua, e o pmndrs postprocessing (que usamos) só funciona em WebGL.
- **"three-mesh-bvh para colisões de cliques e tiros."** A simulação é 2D e determinística, e o relevo é analítico. O BVH só serviria para malhas arbitrárias.
- **"Three.js Water Pro."** Não encontrei como projeto aberto.

---

## 3. O que ainda não temos (lacunas), por área

- **Visual.** O dia e a noite trocam a luz, mas o sol fica parado e não há nascer nem pôr do sol. A névoa de guerra é plana. As crateras não afundam o chão e a vegetação não queima. A obra não "sobe". Os módulos não aparecem nas construções, e as paredes não mostram avaria (pendências da 4.3f). A base não trabalha sozinha. A energia só aparece à noite, na luz que a base derrama. Faltam partículas suaves e fumaça com turbulência (pendências da 4.3g). Falta desgaste por bioma e cavidade por peça (pendências da 4.3d).
- **Som.** Não há trilha sonora. O som não é posicional. Não há locutor por Raça nem sons de interface por Raça.
- **Apresentação.** Não há câmera roteirizada, entrada de chefe, sobrevoo de vitória nem relatório de batalha.
- **Interface.** Faltam roda de comandos, barra de grupos no celular, central de alertas (hoje o Espaço só pula para o último), visão do exército e tela de pesquisa. Faltam paletas para daltonismo, escala da interface e legendas.
- **IA.** Ela já conta o que viu do inimigo por classe (infantaria, veículos, drones, estruturas e suporte), ajusta a produção e recua o esquadrão que perde a troca. Mas os cinco líderes jogam do mesmo jeito. Não há microgestão por unidade (foco no alvo, tirar o ferido da linha), ataque em duas frentes nem falas com o jogador. A IA aliada não recebe ordens.
- **Sistemas.** As 12 construções são as mesmas para todas as Raças (o que muda é o modelo). Os módulos não têm escolha. Não há fauna, estruturas neutras capturáveis nem mercenários, e os eventos de mapa se resumem à Tempestade de Éter e aos veios de Minério. Não há heróis.
- **Modos.** Só escaramuça, campanha e multiplayer. Não há modo contra chefe, sobrevivência, desafio da semana ou "mutadores".
- **Conteúdo.** Dois mapas. Não há replays.

---

## 4. A visão da v5.0

**Cinco pilares:**

1. **Cada partida parece um filme.** Céu, luz e som contam a hora e o perigo, e a câmera sabe mostrar o momento grande.
2. **O mundo reage e guarda a batalha.** Crateras, mato queimado, entulho, rastros, construções que sobem e desabam com o estilo da Raça.
3. **Ameaças maiores que as Raças.** Chefões com fases, golpes telegrafados e pontos fracos, que mudam o jeito de jogar o mapa.
4. **Inimigos com personalidade.** Cada líder joga e fala do seu jeito, lembra do que viu e trai na hora certa.
5. **Celular de primeira.** Toda novidade nasce com a versão de toque, alvos de 44 px e versão leve.

**Princípios que não mudam:** tudo procedural (ou registrado em `ASSETS.md`, com licença); nada de propriedade intelectual alheia; a simulação continua determinística e tudo o que é só visual fica fora dela; custo zero quando um efeito está desligado e nenhuma alocação por quadro; todo programa novo é compilado no carregamento; textos em português do Brasil; cada versão fecha com o portão de qualidade e comparativos antes e depois.

---

## 5. Chefões: os Despertos da Fenda e outros

A primeira campanha terminou com "quem ficar de pé dita o que a Fenda cospe". A v5.0 mostra o que a Fenda cospe. Os chefões não são de nenhuma Raça: são **os Despertos** (criaturas do outro lado da Fenda), **a Irmandade Corsária** (os piratas do vazio, que roubam de todas as Raças) e **os Construtores** (as máquinas antigas que abriram a Fenda no primeiro Alinhamento).

### 5.1 O sistema (5.0e)

- **Simulação.** Entidade `chefe` com máquina de fases por vida e por tempo. Os golpes nascem de regras com o RNG da partida; os pontos fracos são subentidades ligadas ao corpo; o chefe pode chamar crias e mudar o mapa (ponte que cai, chão que racha). Tudo determinístico: funciona no multiplayer cooperativo e nos salvamentos. A vida acompanha a dificuldade, como hoje (`D.wave`).
- **Telegrafia.** Todo golpe forte é avisado no chão antes de cair: anel que enche, faixa que acende, sombra que cresce. Os tempos de aviso são legíveis no celular.
- **Interface.** Barra do chefe no alto com nome e título, marcas das fases, escudo e pontos fracos. Aviso de fase nova.
- **Apresentação.** Entrada com cartão de nome e câmera de cinema (5.0d), tema musical próprio e luz da cena mudando por fase.
- **Recompensas.** Troféu do chefe no Hangar, relíquia, título e medalha por tempo e perdas.

### 5.2 Os seis chefões

**1. O Arauto (Desperto)** — o primeiro a atravessar.
- *Arena:* a cratera da Planície da Fenda.
- *Aparência:* monólito-lente flutuante com três anéis girando em volta de um olho de éter. A luz dele tinge a cena e o chão embaixo vira vidro.
- *Fase 1 (100 a 66%):* "Três Pilares". Um escudo alimentado por três pilares espalhados pelo mapa, cada um guardado por crias da Fenda. Força o jogador a dividir o exército.
- *Fase 2 (66 a 33%):* "Ecos". Pequenas fendas soltam cópias espectrais das últimas unidades que o jogador produziu, com metade da vida. Quem varia a composição sofre menos.
- *Fase 3 (33 a 0%):* "Colapso". Um poço gravitacional puxa tudo, com anéis que se fecham no chão. Quando o olho abre, há uma janela de dano.
- *Contra-jogo:* dividir o exército na fase 1 e ter dano em área na 2.
- *Recompensa:* relíquia "Lente do Arauto" (mais visão).

**2. Leviatã de Éter (Desperto)** — uma criatura do vazio.
- *Arena:* o Cinturão.
- *Aparência:* serpente colossal de placas translúcidas, com órgãos de éter acesos por dentro, nadando no espaço entre as plataformas.
- *Fase 1:* "Caça às pontes". Ele circula o anel e morde pontes, e o caminho das tropas muda. O vazio brilha 5 s antes de onde ele vai emergir.
- *Fase 2:* "Abraço". Ele se enrola numa plataforma, que treme e dá dano às construções. As brânquias ficam expostas por 20 s e viram alvo.
- *Fase 3:* "Rêmoras". Ele mergulha e solta parasitas que sobem nas plataformas, depois emerge no centro para o golpe final.
- *Contra-jogo:* antiaéreo e longo alcance, e reconstruir pontes com os Coletores (mecânica nova).
- *Técnica:* o corpo é desenhado na camada do espaço (space3d) e passa para a cena principal quando emerge.

**3. A Forja-Mãe (Construtores)** — uma fábrica antiga que anda.
- *Arena:* o mapa novo "Destroço do Titã".
- *Aparência:* fábrica-aranha de quatro pernas do tamanho de uma base, com chaminés, guindastes, solda e fumaça. Deixa trilhas de metal derretido.
- *Fase 1:* "Marcha". Ela anda até a sua base, com o tempo à vista, e deixa uma torre automática a cada 30 s.
- *Fase 2:* "Linha de montagem". Abre baias e produz drones em ondas. As quatro pernas viram pontos fracos, e cada perna destruída a deixa 25% mais lenta.
- *Fase 3:* "Núcleo exposto". Sem pernas, ela desaba e o núcleo superaquece. O jogador escolhe: destruir (recompensa A) ou capturar com infantaria em volta por 30 s (recompensa B: o projeto de uma unidade).

**4. Kael Sem-Bandeira, o Almirante Corsário (Irmandade)** — o pirata que rouba de todos.
- *Arena:* qualquer mapa.
- *Aparência:* a nau voadora Maré Negra, com casco remendado com peças das cinco Raças, velas solares e guinchos de reboque.
- *Mecânica central:* roubo. A cada 3 min, a Maré Negra faz um ataque-relâmpago e reboca uma construção sua, que passa a ser dele. Os Piratas das Raças trabalham para ele.
- *Fases:* Saque (defender as construções-chave com antiaéreo), Fuga (perseguição até a Fenda) e Abordagem (a nau pousa para reparos e o combate é no convés).
- *Diplomacia:* a qualquer momento dá para pagar uma Caução e fazer um pacto. Ele para de saquear e ataca o seu inimigo por 5 min, e depois pode trair ou ser traído. Na campanha, isso muda o final do ato.

**5. O Eco (Construtores)** — a consciência da máquina que abriu a Fenda.
- *Arena:* "Coração da Máquina".
- *Aparência:* um enxame de fragmentos geométricos que se montam em formas, com corrupção digital (blocos deslocados, separação de cor e linhas de varredura).
- *Mecânicas:*
  - Zonas de corrupção: a unidade que fica 10 s dentro troca de lado.
  - Interferência: na fase 2 o radar pisca e surgem alertas falsos. Há uma versão suave em Acessibilidade.
  - Cópia de comando: se a superarma do jogador ficar carregada, o Eco a dispara contra ele, com aviso.
- *Contra-jogo:* "Purga", habilidade nova do Núcleo que limpa a corrupção em volta, com recarga.

**6. O Eclipse, Devorador de Sóis (Desperto primordial)** — o chefe final.
- *Presságio:* aparece no céu desde o Ato I da campanha e cresce a cada missão.
- *Arena:* o Coração da Fenda.
- *Fase 1:* "Raízes". Quatro raízes descem e cada uma transforma um bioma em vazio. Cada raiz é um subchefe.
- *Fase 2:* "Olho". O olho abre, e as cinco Raças, unidas por pacto forçado, disparam as superarmas (Fundição Orbital, Blecaute, Salto Evolutivo, Uníssono e Eclosão). O jogador escolhe a ordem, porque cada superarma quebra uma camada da armadura.
- *Fase 3:* "Ruptura". O chão racha e o jogador defende o Núcleo até o colapso. A vitória fecha a Fenda numa cena de cinema.
- *Recompensa:* título "Selador da Fenda" e um Núcleo exclusivo no Hangar.

### 5.3 Onde os chefões aparecem

- **Modo Caçada** (5.0e). Escolha o chefão, a dificuldade e os aliados (IA ou amigos no multiplayer cooperativo) e lute numa arena preparada. Medalha por tempo e perdas, recorde local.
- **Eventos da Fenda na escaramuça** (5.0e, opcional). Lá pelos 12 a 15 min surge um mini-chefe no centro (por exemplo a Sentinela, um Arauto menor). Quem dá o golpe final ganha uma recompensa grande. Muda a dinâmica do "todos contra todos": cooperar ou disputar.
- **Campanha 2** (5.0g). Os seis, com roteiro e cinema.
- **Sobrevivência** (5.0i). Ondas de criaturas da Fenda, com um chefão a cada cinco ondas.

---

## 6. Campanha 2: "Além da Fenda" (5.0g)

**Estrutura:** 15 missões em quatro atos, cada ato fechando num chefão.

| Ato | Missões | Chefão |
|---|---|---|
| I · O que atravessou | 1 Silêncio depois do Alinhamento (exploração; os batedores somem) · 2 Os Pilares (defesa noturna com holofotes nas torres) · 3 Ecos (o jogador enfrenta cópias das próprias unidades) · 4 **O Arauto** | O Arauto |
| II · Rotas partidas | 5 Pontes que caem (Cinturão; o Leviatã aparece de passagem) · 6 Saque (Kael ataca) · 7 Acordo com o Corsário (missão de diplomacia: pagar, aliar-se ou lutar) · 8 **Leviatã de Éter** · 9 **Kael Sem-Bandeira** (como inimigo ou como aliado contra outro alvo, conforme a missão 7) | Leviatã e Kael |
| III · A máquina | 10 Destroço do Titã (ruínas capturáveis e tecnologia antiga) · 11 **A Forja-Mãe** · 12 Interferência (infiltração; a interface sofre interferência) · 13 **O Eco** | Forja-Mãe e Eco |
| Final · O Selo | 14 Coalizão (unir as cinco Raças: cada uma pede um favor) · 15 **O Eclipse** | Eclipse |

**Sistemas novos da campanha:**
- **Esquadrão veterano.** Até 6 unidades Elite ou Lenda passam de uma missão para a outra, com nome de guerra e contagem de abates. Se morrem, morrem.
- **Escolha de aliado.** No fim do Ato I, o jogador escolhe uma das outras quatro Raças como aliada. Isso muda os poderes de apoio e partes das missões.
- **Ramos.** A missão 7 decide o papel de Kael. A missão 14 depende de quais favores o jogador cumpriu.
- **Mapa da campanha.** A Fenda como mapa estelar, com os nós das missões, os ramos e o Eclipse crescendo no céu.
- **Códex.** Cada chefão, mundo e Raça vira uma entrada de história desbloqueada.
- **Medalhas.** Bronze, prata e ouro pelos objetivos bônus. As estrelas de hoje viram medalhas.

---

## 7. As ondas da v5.0.x

Cada versão fecha com o portão de qualidade (`tools/qa.cjs`), comparativos antes e depois (computador 1920 e celular 390) e o Teste de desempenho nos três aparelhos do dono. Cada versão também entra no orçamento da §8. "Equipe" é o número de agentes, cada um na própria cópia, como na série 4.3.

### Onda 1 — Primeiro impacto

#### 5.0a — Céu, clima e nuvens de guerra · tamanho G · 3 agentes + coordenação
- **Objetivo.** Um mapa que muda com a hora e com o tempo, e uma névoa de guerra bonita.
- **Entra:**
  - Céu com dispersão da atmosfera e sol que anda: o ciclo de hoje (12,5 min, só visual) ganha nascer e pôr do sol, sombras que giram com o sol, lua e estrelas. A aurora, que hoje é um clima que tinge a cena, vira cortinas de luz no céu.
  - Raios de sol pela poeira e pela tempestade, com o GodRaysEffect do pmndrs que já carregamos.
  - A partida pode começar em qualquer ponto do ciclo (madrugada, dia, entardecer ou noite), e o reflexo do céu (PMREM) é refeito quando a hora muda.
  - **Nuvens de guerra:** o que nunca foi visto fica sob nuvens baixas que rolam, iluminadas pelo sol. As nuvens se abrem com uma borda acesa quando as tropas chegam. O que já foi visto fica dessaturado sob uma bruma leve.
  - Clima 2.0: aos cinco climas de hoje (tóxica, plasma, cristais, aurora e ácida) e à Tempestade de Éter somam-se neve que acumula no alto das peças, cinza vulcânica com brasas, tempestade de areia, bancos de neblina e chão molhado depois da chuva (mais escuro, com poças que refletem o céu).
  - **Terreno que guarda a batalha:** crateras que afundam o chão (canal de altura no mapa de cicatrizes), mato queimado e deitado onde houve explosão, e pegadas na neve e na areia.
- **Trilha de desempenho:**
  - **Detetive de travadas** no Teste de desempenho: os 5 piores quadros, cada um com simulação, desenho, GPU, memória e o que aconteceu nele.
  - Correção das travadas achadas.
  - **Firefox:** programas de 77 para no máximo 45 e compilação durante a tela inicial no computador.
- **Pronto quando:**
  - capturas de dia, entardecer, noite e clima em cada bioma, no computador e no celular;
  - névoa nova a 10 atualizações por segundo, sem custo por quadro além de um passe;
  - Firefox carregando em até 5 s na RTX;
  - piores 1% do iPhone acima de 40 fps.

#### 5.0b — Sala de Comando · tamanho G · 2 agentes
- **Objetivo.** A primeira tela e os menus no nível de um lançamento.
- **Entra:**
  - **Tela inicial como sala de comando 3D:**
    - no computador, um diorama da base da Raça escolhida no mundo natal, com os modelos do jogo, unidades trabalhando, hora do dia e o líder em holograma sobre o Núcleo;
    - trocar de Raça leva a câmera ao próximo mundo do Grande Alinhamento;
    - na aba Jogar, a **mesa tática** mostra o mapa escolhido em holograma, com o relevo real da Planície da Fenda ou do Cinturão em miniatura;
    - no celular, quadros pré-renderizados de cada Raça, com paralaxe leve.
  - **Líderes, leve melhora:**
    - olhos com brilho úmido e pele com translucidez;
    - a boca acompanha as palavras quando a voz está ligada (eventos de palavra da Web Speech);
    - modo transmissão em holograma no HUD, que oscila quando o sinal é fraco (tempestade, Interferência);
    - duas expressões novas: surpresa e desprezo.
  - **Interface 3.0 da partida:**
    - roda de comandos radial (toque longo, ou botão do meio no computador);
    - barra de grupos 1 a 5 no celular;
    - central de alertas com os últimos avisos (hoje o Espaço já pula para o último; a central deixa escolher qualquer um, também no celular);
    - visão do exército (contagem por tipo e ociosos);
    - tela de pesquisa com prévias 3D;
    - marcadores no radar.
  - **Celular e tablet:** layout deitado priorizado e tablet com painel lateral.
  - **Acessibilidade:** paletas para daltonismo, escala da interface e legendas para as falas.
- **Pronto quando:** a tela inicial abre em até 2 s no computador sem atrasar o início da partida; o celular usa a versão leve; nenhuma rolagem lateral; QA e smoke com as cinco Raças.

### Onda 2 — Vida e som

#### 5.0c — Bases e unidades vivas · tamanho GG · 3 agentes
- **Objetivo.** A base parece trabalhar e a batalha tem peso.
- **Entra:**
  - **Obra 2.0:** a estrutura sobe por um plano de corte com borda no estilo da Raça:
    - Vehnar: solda com faíscas;
    - Erevane: trama de luz;
    - Tessara: crescimento orgânico;
    - Quorith: cristal que se acumula;
    - Vorag: biomassa que borbulha;
    - em todas, poeira na base e uma onda no chão ao concluir.
  - **Módulos visíveis** nas construções: Câmara de Fusão, Academia e Bateria Pesada.
  - **Avaria nas paredes:** marcas de tiro e queimado pelo lado que apanhou.
  - **Desabamento 2.0:** a poeira rola para fora e o entulho fica no chão.
  - **Energia visível:** condutos pulsam com a energia, e com energia baixa as luzes falham.
  - **Vida de base, só visual:** drones de carga entre prédios, tratores, esporos e larvas, sem custo para a simulação.
  - **Unidades:**
    - aro de seleção em holograma da Raça;
    - barra de vida em segmentos, com escudo;
    - contorno na cor do time;
    - veteranos com marca visível (faixas e brilho; Lenda com aura).
  - **Efeitos 2.0:** partículas suaves pela profundidade, fumaça com turbulência, distorção de calor e onda de choque na tela nas explosões grandes.
  - **Materiais 2.0:** desgaste de borda, sujeira por bioma, sujeira de batalha que aumenta com o tempo, e cavidade por peça.
- **Pronto quando:** capturas de perto e na vista padrão nas cinco Raças; o orçamento de FPS mantido; nenhuma alocação por quadro nova; as versões leves conferidas.

#### 5.0d — Som e cinema · tamanho G · 2 agentes
- **Objetivo.** O jogo passa a soar e a se apresentar como um filme.
- **Entra:**
  - **Trilha adaptativa gerada no navegador:**
    - um tema por Raça (escala, timbres e ritmo próprios);
    - camadas por intensidade (paz, tensão, batalha, chefão) com troca no compasso;
    - vinhetas de vitória e derrota.
  - **Som posicional:**
    - lado pela posição na tela e volume pela distância e pelo zoom;
    - mixagem com limite de vozes, e a música baixa quando alguém fala.
  - **Locutor da Raça:**
    - frases curtas por evento (unidade pronta, base sob ataque, superarma pronta) pela voz do sistema;
    - texto e entonação por Raça;
    - sons de interface por Raça: metal na Vehnar, vidro na Erevane, orgânico na Tessara, cristal na Quorith e quitina na Vorag.
  - **Sistema de cinema:**
    - trilhos de câmera por quadros-chave, faixas de cinema e legendas digitadas;
    - retratos em holograma e botão Pular.
  - **Sala de Guerra:** o briefing das 20 missões atuais vira um sobrevoo do mapa em holograma tático, com objetivos marcados enquanto o líder fala, chiado de rádio e bipes.
  - **Câmera de ação:** quando uma superarma dispara fora da tela, o impacto aparece numa janela.
- **Pronto quando:** som e música desligáveis em separado; nenhum arquivo de áudio obrigatório; as 20 missões com briefing novo; as cenas puláveis e sem mexer na simulação.

### Onda 3 — Ameaças maiores

#### 5.0e — Chefões · tamanho GG · 3 agentes
- **Entra:**
  - o sistema de chefões (§5.1);
  - **O Arauto** e **A Forja-Mãe**, com o mapa Destroço do Titã;
  - o **modo Caçada**, solo e cooperativo;
  - os **Eventos da Fenda** na escaramuça (Sentinela da Fenda, Caravana Corsária, Enxame Errante e chuva de meteoros);
  - os mutadores, que começam aqui: Noite Eterna, Tempestades Frequentes e Recursos Escassos.
- **Pronto quando:**
  - o chefão é determinístico (hash idêntico nos 4 motores e depois de salvar e voltar);
  - toda a telegrafia é legível no celular;
  - o cooperativo funciona com 2 a 4 jogadores;
  - os testes novos estão no portão de qualidade.

#### 5.0f — Inteligência e mundo · tamanho GG · 3 agentes
- **IA 3.0:**
  - **Personalidade por líder:**
    - Barão-Forja: fortaleza e depois empurrão blindado;
    - Vesper Ísk: furtividade, roubo e assédio;
    - Sylva Oriel: expansão, diplomacia e evolução;
    - Zayin Coral: exército sincronizado com o Uníssono na hora certa;
    - Oru Voraz: pressa, enxame e Eclosão.
  - Contra-composição mais fina: hoje a IA conta o que viu por classe; passa a contar por unidade e por habilidade (camuflagem, antiaéreo, cerco).
  - Microgestão: foco no alvo mais fraco ou mais valioso, recuo de feridos, distância das armas de alcance e desvio da telegrafia dos chefões.
  - Ataque em duas frentes e assédio aos Coletores.
  - Diplomacia: coalizão contra quem está na frente e traição calculada.
  - **Falas pelo retrato**, com humor e recarga para não virar spam.
  - **IA aliada que obedece:** "Atacar meu alvo", "Defender minha base" e "Expandir".
- **Mundo neutro (opcional na escaramuça e no multiplayer):**
  - fauna da Fenda: herbívoros que fogem, guardiões dos nós ricos e enxames à noite;
  - **Ruínas dos Construtores** capturáveis com infantaria: Observatório (visão), Forja Antiga (veículos mais baratos), Portal (teleporte em par) e Torre de Éter (energia);
  - acampamento da Irmandade Corsária, com 3 mercenários pagos em Dados;
  - eventos de mapa: surto de éter (renda dobrada numa zona) e chuva de meteoros.
- **Construções únicas, duas por Raça:**
  - Vehnar: Esteira de Montagem (liga duas fábricas) e Silo de Sucata (carcaça vira Minério);
  - Erevane: Espelho do Véu (camufla construções) e Farol Falso (isca);
  - Tessara: Árvore-Mãe (cura e cresce com as Eras) e Viveiro;
  - Quorith: Pilar de Ressonância (estende o Elo) e Câmara de Eco;
  - Vorag: Câmara de Incubação e Tumor de Território (desacelera inimigos).
- **Módulos com escolha:** cada construção oferece dois módulos e o jogador escolhe um.
- **Comandantes em campo (modo opcional):** cada líder leva um avatar à batalha, com 3 habilidades, níveis pela veterania e volta no Núcleo depois de um tempo:
  - Barão-Forja: Exo-Forja (Martelo Sísmico, Reparo de Campo, Chamado da Fundição);
  - Vesper Ísk: Espectro (Véu, Lâmina de Luz, Eco Falso);
  - Sylva Oriel: Guardiã (Raízes, Florescer, Esporos);
  - Zayin Coral: Prisma Vivo (Acorde, Estilhaço, Silêncio);
  - Oru Voraz: Devorador (Devorar, Ninhada, Rugido).
- **Pronto quando:** self-play entre as Raças dentro da faixa de vitórias; o teste de dificuldade refeito; determinismo nos 4 motores.

### Onda 4 — Além da Fenda

#### 5.0g — Campanha 2 · tamanho GG · 3 agentes
- **Entra:** as 15 missões e os quatro chefões restantes (Leviatã, Kael, Eco e Eclipse), mais os sistemas da §6.
- **Pronto quando:** as 15 missões passam no teste de missões; os ramos ficam salvos no ProgressStore; as cenas são puláveis.

#### 5.0h — Mundos novos · tamanho G · 2 a 3 agentes
- **Entra:**
  - **Cinco mapas, um por mundo natal**, cada um com luz e clima próprios:
    - Forja de Kessari: vulcânico e industrial, com rios de lava;
    - Espelhos de Ísk: salinas e lagos-espelho;
    - Jardins de Oriel: selva bioluminescente;
    - Coral de Quor: cânions de cristal que vibram;
    - Ninho de Velk: planícies de quitina e cavernas.
  - O **Destroço do Titã** (nave caída) entra antes, na 5.0e.
  - **Kit de marcos:** nave caída, anel dos Construtores e esqueleto colossal.
  - **Gerador de mundos por semente**, com simetria justa e recursos equilibrados.
- **Pronto quando:** cada mapa jogável com 2 a 5 jogadores, no teste entre motores e no teste de desempenho.

#### 5.0i — Replays e relatório · tamanho M · 1 a 2 agentes
- **Entra:**
  - **Replays locais:** comandos mais fotografias periódicas do estado (o mesmo formato dos salvamentos) para pular no tempo.
  - **Tocador de replay:** linha do tempo, velocidades de 1× a 16× e visão por jogador.
  - **Diretor de câmera automático**, que segue a maior batalha, e a câmera do Modo Foto.
  - **Clipe em vídeo** pelo MediaRecorder.
  - **Relatório de batalha:** gráficos de exército, renda e perdas, unidade destaque, linha do tempo dos momentos e a foto do momento decisivo, tirada sozinha.
  - **Desafio da Semana:** semente e mutadores pela semana do ano, iguais para todos sem servidor. O placar global fica para a v6.0.
  - **Sobrevivência.**
- **Pronto quando:** o hash do fim do replay é igual ao da partida original; o clipe sai no Chrome, no Firefox e no Safari.

### Trilha contínua

- **Desempenho em toda versão.** Orçamento da §8, Detetive de travadas e compilação no carregamento. Toda novidade tem versão leve e custo zero quando desligada.
- **5.0j — Laboratório WebGPU · tamanho M · 1 agente, depois da Onda 2.**
  - Passar a cena da tela inicial para o WebGPURenderer com TSL. A volta para o WebGL2 é automática.
  - Testar partículas por compute shader.
  - Medir na RTX (Chrome e Firefox) e no iPhone (Safari 26).
  - Sai um relatório para decidir a migração do jogo. Seria um trabalho do tamanho da v6.x: os 77 programas em TSL e o pós refeito sem o pmndrs e o N8AO, que só funcionam em WebGL.

---

## 8. Orçamento de desempenho da v5.0

| Classe | Hoje (4.3l) | Meta em toda versão da v5.0 |
|---|---|---|
| Placa dedicada (RTX, Chrome, Ultra) | 60 fps · 1% 46 · carga 2,5 s | 60 fps · 1% ≥ 50 · carga ≤ 3 s |
| Placa dedicada (RTX, Firefox, Alta) | 60 fps · 1% 54 · carga 11,8 s | 60 fps · carga ≤ 5 s |
| Celular (iPhone, Baixa) | 58 fps · 1% 26 · pior 139 ms · carga 0,7 s | ≥ 55 fps · 1% ≥ 40 · pior ≤ 80 ms · carga ≤ 2 s |
| Integrada (Intel Arc, Alta ou Média) | 38 a 40 fps (medido antes da 4.3i) | ≥ 50 fps com resolução dinâmica |

Regras:
- todo efeito novo tem chave de qualidade e fica fora da Baixa se custar caro;
- nenhum programa compila no meio da partida;
- nenhuma alocação por quadro;
- memória no celular sob controle: texturas grandes só no computador;
- o Teste de desempenho ganha cenas novas quando o efeito pedir (clima, chefão, base cheia).

---

## 9. Decisões do dono

1. **Ordem.** Começar pela Onda 1 (5.0a e 5.0b)? Recomendo que sim: é o maior salto que o jogador vê em toda partida e na primeira tela.
2. **Trilha sonora.** Gerada no navegador (recomendado: zero download e dentro da regra do procedural) e/ou faixas suas, com a licença registrada no `ASSETS.md`?
3. **Vozes.** Voz do sistema (Web Speech; muda de aparelho para aparelho) para o locutor e os líderes, ou gravações suas mais tarde?
4. **Comandantes em campo.** Como modo opcional (recomendado, para não mexer no equilíbrio do jogo de sempre) ou fora?
5. **Chefões.** Aprovar os seis (nomes e conceitos). Posso trocar qualquer nome.
6. **Mundo vivo no multiplayer.** Ligado por padrão no solo e opcional no multiplayer (recomendado)?
7. **WebGPU.** Só laboratório na v5.0 (recomendado)?
8. **Campanha 2.** 15 missões com escolha de aliado, esquadrão veterano e ramos?

---

## 10. v6.0 (antiga v5.0): servidores e escala

Continua como estava, só com a numeração nova:
- 6.0a: contas, perfil e importação do ProgressStore;
- 6.0b: relé autoritativo e replays guardados na nuvem;
- 6.0c: ranking Glicko-2 e temporadas;
- 6.0d: social (amigos, Discord, espectador);
- 6.0e: loja cosmética;
- marketplace a partir da 6.5.

A v5.0 prepara a v6.0 em três pontos: os replays locais da 5.0i já gravam o formato que o relé vai guardar; o Desafio da Semana e o modo Caçada ganham placar global; e o gerador de mapas da 5.0h vira a base do editor com compartilhamento.

---

## Fontes consultadas em 18/10/2026

- Registro npm: `realism-effects` 1.1.2, publicado em 12/05/2023, peer `three >= 0.148`; `three.quarks` 0.17.1 (maio/2026), peer `three >= 0.182`; `postprocessing` 6.39.5 (setembro/2026); `three` 0.186.1.
- three.quarks: https://npmjs.com/package/three.quarks ("computes most particle information on CPU"; simulação na GPU em andamento).
- realism-effects: https://github.com/0beqz/realism-effects (v2 em andamento num ramo).
- pmndrs postprocessing: https://github.com/pmndrs/postprocessing (WebGLRenderer).
- KHR_parallel_shader_compile: https://developer.mozilla.org/docs/Web/API/KHR_parallel_shader_compile e https://caniuse.com/wf-khr-parallel-shader-compile (Firefox: não).
- WebGPU nos navegadores: https://web.dev/blog/webgpu-supported-major-browsers.
