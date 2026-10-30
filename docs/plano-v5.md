# Aether Rift: Dominion — Plano v5.0 "Além da Fenda"
### 18 de outubro de 2026, revisto em 19/10 e 29/10 · depois da 4.3l · inclui a validação do arquivo "Games RTS – Extrair o máximo dos jogos (visuais, desempenho etc.)"

**Numeração nova (decisão do dono, 18/10/2026).** A antiga v5.0 (contas, relé, ranking, temporadas, social e loja) passa a ser a **v6.0**, pensada para escalar com servidores. A **v5.0** passa a ser o salto visual e de jogo descrito aqui. O plano da v6.0 continua em `docs/plano-v4-v5.md` §7, já com os números novos.

**Revisão de 19/10/2026 (ondas aprovadas pelo dono).** O jogo passa para o **Motor 5**: o WebGPURenderer do three, com materiais, efeitos e pós escritos em TSL, voltando sozinho para WebGL2 onde não houver WebGPU (§2.6). O GSAP entra na apresentação, o som vira 3D, quatro chefões ganharam nomes novos (§5) e a §11 responde se o servidor precisa de pacotes novos.

---

## 0. Resumo

A série 4.3 refez o jogo inteiro (unidades, bases, combate, terreno, mapas, clima, luz, Modo Foto, interface) e a 4.3l fechou com o carregamento em paralelo: na RTX, o Chrome caiu de 10,8 s para 2,5 s e o iPhone de 8,1 s para 0,7 s. O que ainda separa o Aether Rift dos RTS que o público adora não é a qualidade de cada modelo. Faltam cinco coisas:

1. **Presença de cinema.** O jogo não tem trilha sonora, não tem câmera roteirizada e o briefing ainda é uma janela.
2. **Um mundo que reage.** O ciclo de dia e noite (12,5 min) troca a luz, mas o sol não anda e não há nascer nem pôr do sol. A névoa de guerra é uma sombra plana e o chão guarda pouco da batalha.
3. **Ameaças maiores que as Raças.** Os dois chefes de hoje (Catedral Errante e Matriarca) são unidades das Raças com mais vida, uma ronda e o poder da própria unidade (a Matriarca choca Crias). Não têm fases nem golpes telegrafados.
4. **Inimigos com personalidade.** A IA tem quatro estratégias (Blindados, Expansão, Fortaleza e Roubo), mas os cinco líderes jogam do mesmo jeito.
5. **Conteúdo para voltar.** São só dois mapas (Planície da Fenda e Cinturão), não há replays e não há modo para jogar contra um desafio fixo.

A v5.0 ataca isso em cinco ondas (a de idiomas entrou em 29/10), com uma trilha contínua de desempenho e o Estúdio da Fenda em paralelo:

| Onda | Versões | O que o jogador sente |
|---|---|---|
| 1. Motor 5 e primeiro impacto | 5.0a Sala de Comando, Interface 3.0 e Motor 5 em teste ✔ · 5.0b Motor 5 completo ✔ · 5.0b.1 fase 3 do Motor 5 ✔ | O jogo inteiro no WebGPU, com reserva em WebGL2. A tela inicial vira uma sala de comando 3D, com a base da Raça, planetas em shader, partículas fluidas, câmera com GSAP e som 3D |
| 2. Idiomas e vozes | 5.0c Idiomas (português, English, Español) · 5.0c.1 Vozes gravadas nos três idiomas | O jogo inteiro e as vozes em inglês e espanhol, para o jogo circular fora do Brasil. Idioma pelo aparelho, com escolha em Ajustes |
| 3. Mundo vivo | 5.0d Céu, clima e nuvens de guerra · 5.0e Bases e unidades vivas | Céu físico, clima simulado na GPU e uma névoa de guerra feita de nuvens. As construções sobem no estilo da Raça, os destroços quicam no chão e a batalha fica marcada |
| 4. Som, cinema e ameaças | 5.0f Som 3D e cinema · 5.0g Chefões · 5.0h Inteligência e mundo | Som com posição no mapa, trilha que muda com a batalha e briefing de cinema. Chefões com fases, IA com a personalidade de cada líder e um mapa com vida própria |
| 5. Além da Fenda | 5.0i Campanha 2 · 5.0j Mundos novos · 5.0k Replays, clipes e relatório | Campanha nova de 15 missões com 6 chefões, cinco mundos novos, um gerador de mapas, replays com câmera de cinema e clipes |
| Contínua | Desempenho em toda versão · laboratório do Motor 5 | O Motor 5 só vira padrão onde empatar ou ganhar do motor de hoje. O laboratório prova cada técnica antes de ela entrar no jogo |

As decisões do dono estão em §9 (ondas aprovadas em 19/10, revistas em 29/10).

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
| Howler.js para áudio | Efeitos sintetizados em WebAudio e voz do sistema pela Web Speech API; **não há trilha sonora** | ✎ Sem Howler (não há arquivos de áudio para gerenciar). Som 3D com o próprio Web Audio na 5.0a (tela inicial) e na 5.0f (partida), com trilha adaptativa |
| Blender → GLB com Draco, gltfpack e glTF-Pipeline | Malhas geradas em código (277 no portão de qualidade), com LOD pelo meshoptimizer | ✎ O kit procedural continua (0 KB de download, cor por jogador, variação por semente). GLB entra só quando houver um artista 3D |
| Texturas da Poliigon/AmbientCG; modelos do Sketchfab/CGTrader | Texturas geradas na GPU (4.3c) | ✗ Estilo e licença: fotorrealismo destoa do nosso visual estilizado, e cada modelo de terceiros traz risco de licença |
| WebGPU com TSL | WebGL2; os 77 programas são remendos GLSL (onBeforeCompile); o pós (pmndrs postprocessing) e o N8AO só funcionam em WebGL | ➕ **Motor 5 na 5.0a** (revalidado em 19/10, §2.6): o jogo inteiro passa para o WebGPURenderer com TSL e volta sozinho para WebGL2. WebGPU hoje: Chrome e Edge (inclusive Android 12+), Safari 26, Firefox 141 no Windows e 145 no macOS ARM; no Firefox para Linux e Android ainda está em andamento |
| Pós-processamento: bloom, SSAO, tone mapping ACES | Bloom HDR, N8AO, ACES, SMAA, bruma de altura e gradação própria | ✔ 4.3b |
| Motion blur | — | ✗ Na partida borra a leitura das unidades. Pode entrar só nas cenas de cinema (5.0f) |
| SSR/SSGI com realism-effects | Reflexo plano no gelo (4.3h) e reflexo do céu por PMREM | ✗ O realism-effects teve a última versão publicada (1.1.2) em maio de 2023, para o three r148+. A v2 está num ramo, sem publicação. SSGI custa caro para pouco ganho na câmera alta de RTS |
| IBL com mapa HDR | Reflexo do céu do próprio mapa por PMREM (4.3b) | ✔ Sem arquivo HDR (regra do procedural). ➕ Refazer o PMREM quando a hora do dia mudar (5.0d) |
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
| Sombras assadas | Cavidade e oclusão por vértice no terreno (4.3c) | ✎ Cavidade calculada por peça nos modelos (pendência da 4.3d), na 5.0e |
| Mapa de sombra de 512 a 1024 | Tamanho pela qualidade (2048 na Média do computador) | ✔ O tamanho já segue a qualidade e o aparelho |
| Materiais leves no celular | Versão leve, sem reflexo plano, qualidade Baixa | ✔ |

### 2.3 Gráficos de RTS (unidades, terreno, efeitos e construção)

| Sugestão | No jogo hoje | Veredito |
|---|---|---|
| VAT (animação em textura) para milhares de soldados | Animação por peça na GPU: rodas, esteiras, pernas, rotores, recuo e torres que miram (4.2b); esquadrões de três figuras com passo defasado e baixa visível (4.3e) | ✔ Faz o mesmo sem textura e sem esqueleto, porque os modelos são gerados por peça |
| Decalques com DecalGeometry | Mapa de cicatrizes de 2048² no terreno: rastros por Raça, queimado, cratera e brasa (4.3c) | ✔ Mais barato que um decalque por geometria. ➕ Avaria nas paredes (5.0e) e crateras que afundam o chão (5.0d) |
| Splatting de texturas no terreno | Material em camadas por bioma, mistura pela altura, rocha triplanar e texturas de detalhe geradas na GPU (4.3c) | ✔ |
| Relevo por heightmap + three-mesh-bvh | Relevo procedural de 321² e clique pelo relevo analítico | ✔ Sem BVH: o relevo é uma função conhecida |
| Névoa de guerra volumétrica com ruído | Névoa no shader do chão e dos adereços, refeita 10 vezes por segundo (4.2d, 4.3i) | ➕ "Nuvens de guerra" na 5.0d |
| Partículas na GPU com three.quarks | fx3d.js com movimento analítico no vertex shader (4.2c, 4.3g) | ✔ O arquivo diz que o three.quarks "processa tudo na GPU": não confere. O próprio pacote diz que calcula as partículas na CPU (simulação na GPU está "em andamento"). Ficam da 4.3g: partículas suaves e fumaça com turbulência (5.0e) |
| Atlas de texturas | Materiais procedurais por peça, sem textura por prédio | ✗ Não se aplica |
| Máscara de cor do time | Cor por jogador em cada peça | ✔ |
| Pathfinding com recast ou Pathfinding.js | Campos de fluxo determinísticos com 256 rotas guardadas (4.2g, 4.3i) | ✗ O recast trabalha em ponto flutuante e quebraria o lockstep |
| Rapier para projéteis | Balística analítica nas armas (4.3g) | ✗ |
| Prédio que sobe por corte com borda brilhante | Invólucro de obra por Raça (andaime, holograma, casulo, cristais, casulo úmido) e efeito de conclusão (4.3f) | ➕ Obra 2.0 (5.0e): plano de corte que sobe com o progresso, borda na cor e no estilo da Raça, faíscas e poeira na base, tranco no fim |
| Holograma verde/vermelho ao posicionar | Fantasma de obra com linhas de varredura e aviso de sobreposição | ✔ |
| Tremor de câmera | Tremor nas explosões grandes e superarmas | ✔ |
| Luzes que acendem ao concluir | Emissivos à noite e luzes que falham na avaria (4.2d, 4.3f) | ✔. ➕ A energia aparece na base (5.0e) |
| GSAP ou tween.js para animar | Curvas próprias | ➕ Revisto em 19/10 (§2.6): GSAP 3.15 na apresentação (câmera da Sala de Comando, cinema, entrada dos chefões), andando no mesmo laço do render e sempre fora da simulação |

### 2.4 Campanha e briefing

| Sugestão | No jogo hoje | Veredito |
|---|---|---|
| Paleta e clima diferentes por missão | Clima, noite e tempestade por missão | ✎ Direção de arte por missão (céu, hora, LUT e marco) na 5.0i |
| Marcos gigantes no mapa | Ruínas e carcaças espalhadas | ➕ Kit de marcos (nave caída, anel dos Construtores, esqueleto colossal) na 5.0j |
| Cinemáticas no motor | Não há | ➕ Sistema de cinema na 5.0f |
| Curva de missões (tutorial, unidade nova, defesa, épica) | 20 missões com ondas, comboios, escolta, defesa noturna, furtividade e 2 chefes | ✔ 4.0e. A Campanha 2 sobe o nível (5.0i) |
| Fases em JSON | Missões como dados + funções de teste em `src/campaign.js` | ✗ Já são dados; as funções dão mais poder que JSON |
| Tela de carregamento com briefing | Arte do mundo natal em 2560×1440 e dica da missão (4.3l) | ✔ |
| Salvamento automático | A cada 10 s e ao sair da aba, no IndexedDB (4.1c) | ✔ |
| Gatilhos de evento | Emboscadas, tempestade na rota, raides, chefe que surge | ✔. ➕ Gatilhos de área e eventos de cena (ponte que cai, reforço que desce) na 5.0i |
| Retrato animado de rádio | Busto 3D com rig, quatro humores e fala (4.1e, 4.3e) | ✔. ➕ Transmissão em holograma e boca acompanhando a voz (5.0a) |
| XState para estados da missão | Objetivos com testes por passo | ✗ Não precisa |
| Tiled ou editor de fases | — | ➕ Gerador de mapas por semente na 5.0j. Editor e compartilhamento ficam para a v6.0, que terá onde guardar os mapas |
| Briefing de cinema (varredura, texto digitado, mapa de satélite, câmera sincronizada) | Janela de briefing com os líderes | ➕ "Sala de Guerra" na 5.0f, na linguagem visual do Comando da Fenda (sem imitar o terminal verde de outro jogo) |
| Bip a cada objetivo e chiado de rádio | Bipes sintetizados | ➕ Na 5.0f |

### 2.5 O que o arquivo afirma e não confere

- **"O three.quarks processa tudo na GPU."** O pacote diz o contrário: calcula a maior parte na CPU, e a simulação na GPU está em andamento. O nosso fx3d.js é que simula na GPU.
- **"realism-effects deixa o Three.js idêntico a uma engine de PC."** A última versão publicada (1.1.2) é de maio de 2023 e pede o three r148+. O próprio repositório diz que a v2 está em andamento num ramo.
- **"O Three.js substituiu as ferramentas antigas pelo RenderPipeline baseado em nós."** Isso vale para o renderizador WebGPU. No WebGL o EffectComposer continua, e o pmndrs postprocessing (que usamos) só funciona em WebGL.
- **"three-mesh-bvh para colisões de cliques e tiros."** A simulação é 2D e determinística, e o relevo é analítico. O BVH só serviria para malhas arbitrárias.
- **"Three.js Water Pro."** Não encontrei como projeto aberto.

### 2.6 Revalidação de 19/10: 3D de alta fidelidade com WebGPU

Em 18/10 o WebGPU tinha ficado como laboratório no fim da v5.0: os 77 programas do jogo são remendos GLSL, e o pós (pmndrs postprocessing e N8AO) só existe em WebGL. O dono pediu o contrário: o WebGPU aplicado ao jogo inteiro. Revalidei com o three r186 e com um protótipo, e agora a migração faz sentido:

- **O r186 já traz o que o jogo precisa, em TSL.** O RenderPipeline tem bloom, profundidade de campo, GTAO, SSR, SSGI, TRAA, TAAU, FSR1, godrays, outline, LUT, FXAA e SMAA. Há sombras em cascata (CSMShadowNode), céu físico com nuvens (SkyMesh), compute shaders, iluminação volumétrica e marcha de raio. Isso substitui o pmndrs e o N8AO.
- **Um código de shader para os dois motores.** O TSL é escrito uma vez, e o three gera WGSL para o WebGPU e GLSL para a reserva em WebGL2.
- **O que só o WebGPU dá.** Compute shaders, para simular na GPU partículas, destroços, clima e nuvens, e criação de pipelines sem travar a página. É também o caminho para o Firefox no Windows, que não tem compilação paralela no WebGL.
- **Os riscos.** É a maior tarefa da v5.0, porque todo shader do jogo muda. E o WebGPU não é mais rápido em tudo: ganha com muitas chamadas de desenho, instâncias e compute, e a reserva WebGL2 do WebGPURenderer pode ficar atrás do motor de hoje. Por isso o Motor 5 só vira padrão, aparelho a aparelho, onde medir igual ou melhor. Firefox no Linux e no Android e Safari anterior ao 26 usam a reserva.

**Os pontos do pedido:**

| Ponto | Veredito | Onde |
|---|---|---|
| Iluminação baseada em imagem (IBL) | ✔ já temos (PMREM do céu do mapa, 4.3b). No Motor 5, o PMREM vem do céu físico e é refeito quando a hora muda | 5.0a, 5.0d |
| Sombras suaves | ✔ mapa de sombra com filtro. ➕ Sombras em cascata (CSMShadowNode) com filtro suave e sombra de contato fina | 5.0a, 5.0e |
| Pós com bloom e profundidade de campo | ✔ bloom em toda partida (4.3b) e profundidade de campo no Modo Foto (4.3j). ➕ No Motor 5, os dois em TSL; a profundidade de campo entra na Sala de Comando, nas cenas de cinema e na câmera de perto, nunca na visão de jogo | 5.0a, 5.0f |
| Shader próprio em WGSL ou GLSL: partículas fluidas ou distorção orgânica | ➕ Em TSL, que gera os dois: partículas fluidas da Fenda num compute shader e distorção orgânica (deslocamento por ruído e refração da cena), as duas provadas no laboratório | 5.0a, 5.0e |
| Áudio espacial com Web Audio | ➕ Ouvinte preso à câmera e som com posição no mapa, provado no laboratório (HRTF, distância e reverberação gerada no navegador) | 5.0a, 5.0f |
| GSAP para câmera com paralaxe e cliques | ➕ Revisto: entra na apresentação (Sala de Comando, cinema, chefões), andando no mesmo laço do render; nunca na simulação nem na câmera de jogo | 5.0a, 5.0f |
| Layout responsivo e laço eficiente | ✔ Um laço só, com simulação fixa e desenho interpolado; no Motor 5, o setAnimationLoop com o GSAP dentro | 5.0a |
| Modelos glTF/GLB | ✎ Os modelos continuam gerados em código (0 KB de download, cor por jogador, variação por semente). glTF serve de saída para revisão e para um artista, se houver | — |
| Shaders GLSL | ✎ Migram para TSL | 5.0a |
| Bibliotecas de interface e de física | ✗ Física fora da simulação, por causa do lockstep; a física que só se vê roda em compute (destroços, partículas). A interface segue em HTML e CSS | 5.0e |
| Scene e PerspectiveCamera | ✔ Já usamos | — |
| WebGLRenderer | ✎ Dá lugar ao WebGPURenderer, com reserva WebGL2. O WebGLRenderer fica como motor clássico até a paridade | 5.0a |

**O laboratório (`lab/motor5.html`).** O protótipo mostra, numa página só:
- os modelos do jogo (o mesmo `src/meshes.js`) com material em TSL;
- céu físico com nuvens e luz de ambiente tirada dele;
- sombras em cascata;
- profundidade de campo, bloom e FXAA;
- 16 a 65 mil partículas fluidas por compute, que um clique empurra;
- um coração orgânico com veias que pulsam e o calor da Fenda refratando a cena;
- som 3D com o ouvinte na câmera;
- câmera com GSAP (paralaxe e voo até o que é clicado);
- um Teste de 20 s com o resultado pronto para copiar.

| Laboratório na GPU por software desta máquina | WebGPU | Reserva WebGL2 |
|---|---|---|
| Início do motor | 6 a 27 ms | 16 a 18 ms |
| Shaders e pipelines da cena inteira | 1,8 a 2,9 s | 2,3 a 2,5 s |
| Chamadas de desenho · triângulos | 77 · 349 mil | 76 · 343 mil |
| Erros e avisos no console | 0 | 0 |

A GPU por software (SwiftShader) só prova que funciona. FPS e tempos de verdade saem do Teste de 20 s do laboratório nos seus aparelhos.

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

### 5.1 O sistema (5.0g)

- **Simulação.** Entidade `chefe` com máquina de fases por vida e por tempo. Os golpes nascem de regras com o RNG da partida; os pontos fracos são subentidades ligadas ao corpo; o chefe pode chamar crias e mudar o mapa (ponte que cai, chão que racha). Tudo determinístico: funciona no multiplayer cooperativo e nos salvamentos. A vida acompanha a dificuldade, como hoje (`D.wave`).
- **Telegrafia.** Todo golpe forte é avisado no chão antes de cair: anel que enche, faixa que acende, sombra que cresce. Os tempos de aviso são legíveis no celular.
- **Interface.** Barra do chefe no alto com nome e título, marcas das fases, escudo e pontos fracos. Aviso de fase nova.
- **Apresentação.** Entrada com cartão de nome e câmera de cinema (5.0f), tema musical próprio e luz da cena mudando por fase.
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

**2. Ouroboros, a Serpe do Anel (Desperto)** — a criatura do vazio que cerca o Cinturão.
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

**4. Almirante Sargaço (Irmandade)** — o pirata que rouba de todos.
- *Arena:* qualquer mapa.
- *Aparência:* a nau voadora Maré Negra, com casco remendado com peças das cinco Raças, velas solares e guinchos de reboque.
- *Mecânica central:* roubo. A cada 3 min, a Maré Negra faz um ataque-relâmpago e reboca uma construção sua, que passa a ser dele. Os Piratas das Raças trabalham para ele.
- *Fases:* Saque (defender as construções-chave com antiaéreo), Fuga (perseguição até a Fenda) e Abordagem (a nau pousa para reparos e o combate é no convés).
- *Diplomacia:* a qualquer momento dá para pagar uma Caução e fazer um pacto. Ele para de saquear e ataca o seu inimigo por 5 min, e depois pode trair ou ser traído. Na campanha, isso muda o final do ato.

**5. O Simulacro (Construtores)** — a consciência da máquina que abriu a Fenda.
- *Arena:* "Coração da Máquina".
- *Aparência:* um enxame de fragmentos geométricos que se montam em formas, com corrupção digital (blocos deslocados, separação de cor e linhas de varredura).
- *Mecânicas:*
  - Zonas de corrupção: a unidade que fica 10 s dentro troca de lado.
  - Interferência: na fase 2 o radar pisca e surgem alertas falsos. Há uma versão suave em Acessibilidade.
  - Cópia de comando: se a superarma do jogador ficar carregada, o Simulacro a dispara contra ele, com aviso.
- *Contra-jogo:* "Purga", habilidade nova do Núcleo que limpa a corrupção em volta, com recarga.

**6. Nadir, o Sol Negro (Desperto primordial)** — o chefe final.
- *Presságio:* um sol negro aparece no céu desde o Ato I da campanha e cresce a cada missão.
- *Arena:* o Coração da Fenda.
- *Fase 1:* "Raízes". Quatro raízes descem e cada uma transforma um bioma em vazio. Cada raiz é um subchefe.
- *Fase 2:* "Olho". O olho do Sol Negro abre, e as cinco Raças, unidas por pacto forçado, disparam as superarmas (Fundição Orbital, Blecaute, Salto Evolutivo, Uníssono e Eclosão). O jogador escolhe a ordem, porque cada superarma quebra uma camada da armadura.
- *Fase 3:* "Ruptura". O chão racha e o jogador defende o Núcleo até o colapso. A vitória fecha a Fenda numa cena de cinema.
- *Recompensa:* título "Selador da Fenda" e um Núcleo exclusivo no Hangar.

### 5.3 Onde os chefões aparecem

- **Modo Caçada** (5.0g). Escolha o chefão, a dificuldade e os aliados (IA ou amigos no multiplayer cooperativo) e lute numa arena preparada. Medalha por tempo e perdas, recorde local.
- **Eventos da Fenda na escaramuça** (5.0g, opcional). Lá pelos 12 a 15 min surge um mini-chefe no centro (por exemplo a Sentinela, um Arauto menor). Quem dá o golpe final ganha uma recompensa grande. Muda a dinâmica do "todos contra todos": cooperar ou disputar.
- **Campanha 2** (5.0i). Os seis, com roteiro e cinema.
- **Sobrevivência** (5.0k). Ondas de criaturas da Fenda, com um chefão a cada cinco ondas.

---

## 6. Campanha 2: "Além da Fenda" (5.0i)

**Estrutura:** 15 missões em quatro atos, cada ato fechando num chefão.

| Ato | Missões | Chefão |
|---|---|---|
| I · O que atravessou | 1 Silêncio depois do Alinhamento (exploração; os batedores somem) · 2 Os Pilares (defesa noturna com holofotes nas torres) · 3 Ecos (o jogador enfrenta cópias das próprias unidades) · 4 **O Arauto** | O Arauto |
| II · Rotas partidas | 5 Pontes que caem (Cinturão; o Ouroboros aparece de passagem) · 6 Saque (o Almirante Sargaço ataca) · 7 Acordo com o Almirante (missão de diplomacia: pagar, aliar-se ou lutar) · 8 **Ouroboros** · 9 **Almirante Sargaço** (como inimigo ou como aliado contra outro alvo, conforme a missão 7) | Ouroboros e Sargaço |
| III · A máquina | 10 Destroço do Titã (ruínas capturáveis e tecnologia antiga) · 11 **A Forja-Mãe** · 12 Interferência (infiltração; a interface sofre interferência) · 13 **O Simulacro** | Forja-Mãe e Simulacro |
| Final · O Selo | 14 Coalizão (unir as cinco Raças: cada uma pede um favor) · 15 **Nadir, o Sol Negro** | Nadir |

**Sistemas novos da campanha:**
- **Esquadrão veterano.** Até 6 unidades Elite ou Lenda passam de uma missão para a outra, com nome de guerra e contagem de abates. Se morrem, morrem.
- **Escolha de aliado.** No fim do Ato I, o jogador escolhe uma das outras quatro Raças como aliada. Isso muda os poderes de apoio e partes das missões.
- **Ramos.** A missão 7 decide o papel do Almirante Sargaço. A missão 14 depende de quais favores o jogador cumpriu.
- **Mapa da campanha.** A Fenda como mapa estelar, com os nós das missões, os ramos e o Sol Negro crescendo no céu.
- **Códex.** Cada chefão, mundo e Raça vira uma entrada de história desbloqueada.
- **Medalhas.** Bronze, prata e ouro pelos objetivos bônus. As estrelas de hoje viram medalhas.

---

## 7. As ondas da v5.0.x

Cada versão fecha com:
- o portão de qualidade (`tools/qa.cjs`);
- comparativos antes e depois (computador 1920 e celular 390);
- o Teste de desempenho nos três aparelhos do dono;
- o orçamento da §8.

"Equipe" é o número de agentes, cada um na própria cópia, como na série 4.3.

A v5.0 começa pelo Motor 5. Tudo o que vem depois nasce em TSL, então nada é feito duas vezes.

### Onda 1 — Motor 5 e primeiro impacto

**Entregas (23/10/2026):** a fundação do Motor 5 (a fase 1 abaixo), a Sala de Comando e a Interface 3.0 saíram juntas como **5.0a** ✔, com o Motor 5 como opção experimental em Ajustes. O porte dos módulos e a paridade (fases 2 e 3) saem como **5.0b**.

**5.0a.2 ✔ (25/10/2026), luz da tela inicial e vozes (testes do dono na 5.0a.1):** o clarão laranja só aparecia em telas grandes (2560×1440): a câmera mostra mais céu e o sol do Kessari entra no canto; o céu perto do sol passava de 6 (até 42) e o bloom da Sala (limiar 0,8, raio 0,42, força 0,62) somava 1,9 vez esse brilho pela metade esquerda, mais 13% de laranja do véu da página. O céu visível agora comprime até 1,3 com um disco de sol contido (a luz de ambiente não muda), o bloom tem teto de 6 por pixel, limiar 1,35, raio 0,15 e força 0,5, e o véu fica sem a cor da Raça sobre a Sala: na metade esquerda, o que o bloom soma caiu de 0,61 para 0,02. As travadas na rolagem vinham do ritmo pela GPU da 5.0a.1 (o laço esperava a resposta da GPU e não desenhava; com respostas de 4 a 100 ms, de 6% a 91% dos quadros ficavam sem desenho): numa placa de verdade o laço não espera mais (o modo contido fica para GPU por software), a rolagem é lida uma vez por evento, a Sala para fora da tela (IntersectionObserver) e a roda do mouse só é dela no Explorar; de 0% a 1,6% de quadros sem desenho. Os 20 pôsteres foram refeitos. As vozes soavam como GPS porque o jogo usava a primeira voz pt-BR da lista (a Maria antiga do Windows no Edge e no Chrome, a Eddy da Apple no iPhone) com o tom em 0,85: agora a melhor voz do aparelho por nível (neurais do Edge, Google, Apple aprimorada, Apple, outras, Windows antigas, robóticas), tom 1, intervalos e prioridade por tipo de fala (em 3 partidas, 160 repetições em menos de 10 s viraram 0) e a escolha "Voz das falas" com Ouvir nos Ajustes. A página de escuta das vozes gravadas (Kokoro-82M × Piper pt_BR) levou à decisão da 5.0c.1 abaixo.

**5.0b.1 ✔ (30/10/2026), Motor 5 fase 3 (carga, CPU e paridade), som e Sala:** quatro partes feitas em paralelo sobre a 5.0b e juntadas por 3 vias.
- **Carga e CPU** (`src/m5/*` e ramos do Motor 5 marcados no `render3d`, `dress3d`, `lakes3d`, `fx3d` e `combat3d`):
  - materiais que dividem o mesmo módulo de shader: os lagos com a margem num só shader, os pares de ruína e modelos, de neve e de mastro;
  - o "sem pós" num só uniform (`ARD.m5.u.semPos`);
  - quatro ganchos no `M5.compile`, cada um com chave na URL para voltar ao do three: `?m5ctx=0`, `?m5solta=1`, `?m5primeiro=0` e o `M5.fragFixo`;
  - no QA, o WGSL da carga caiu de 1.185 para 782 KB (−34%) e os pipelines de 91 para 78. No celular, de 879 para 600 KB; na Fenda Média, de 1.361 para 843 KB; na reserva WebGL2, de 84 para 68 programas;
  - o `DynamicDrawUsage` saiu: cada atributo sobe só o trecho usado e só o grupo que mudou, e grupos de modelos fora da câmera ou da cascata não são desenhados (`?m5recorte=0` desliga o recorte). Na Alta, a vista padrão manda 5 KB por quadro (eram 432) e a batalha 31 KB (eram 605), com 6% a 18% menos desenhos;
  - estimativa nos aparelhos do dono, a conferir: carga do iPhone de 12,4 para ~9 s, a do Firefox de 8,4 para ~6 s, e o Firefox de 45 para ~50 a 55 fps.
- **Paridade visual** (`src/m5/pos.js`, `foto.js` e `ritmo.js`):
  - o bloom do Motor 5 é o mesmo algoritmo do `BloomEffect` do pmndrs. Na batalha de noite, a diferença contra o clássico caiu de 16,2 para 4,7;
  - sem pós, o Modo Foto desenha os efeitos depois da conversão de tons, como o clássico. A razão do efeito em +1,5 EV ficou em 0,50 (0,51 no clássico; 0,33 na 5.0b);
  - o laço da partida não espera a GPU (confirmado no código). O teste de desempenho ganhou as linhas "Laço (Motor 5)" e "Depois do quadro", e as chaves `?ritmo=livre|contido`, `?ts=0` e `?laco=raf|animloop` medem no Firefox;
  - os faróis (pedido do dono em 29/10): veículos, coletores e piratas acendem o chão à frente à noite e dentro da Tempestade de Éter ativa, nos dois motores, pelo mapa de clarões, sem luz pontual.
- **Sala mais clara** (decisão do dono em 29/10):
  - exposição por mundo: 1,0 nos de dia, 1,1 em Quor e 0,95 em Velk;
  - bloom de 0,5 para 0,45, e mais ganho no céu visível do computador, antes da compressão até 1,3;
  - no celular, o véu sai de cima do líder;
  - os 20 pôsteres refeitos ficam de 2% a 12% mais claros com o véu, e o bloom na metade esquerda fica entre 0,004 e 0,03.
- **Som** (`src/audio.js`):
  - a fala do líder usa a melhor voz do gênero dele entre as vozes boas do aparelho (no Chrome do Windows, a Sylvia com a Google e os homens com o Daniel);
  - no iPhone: o desbloqueio no gesto certo (`touchend`, `click`, `pointerup`), `navigator.audioSession = 'playback'`, uma fala dentro do primeiro gesto e a retomada depois do estado `interrupted`;
  - "Testar som" em Ajustes, com o diagnóstico do áudio.
- **Um conserto na junção:** o "sem pós" unificado é recalculado a cada render e anulava o zero do passe dos efeitos do Modo Foto. O uniform ganhou uma trava (`fixo`).

**5.0b ✔ (25/10/2026), Motor 5 completo (fase 2):** os cinco portes em TSL, feitos em paralelo sobre a 5.0a.1, entraram juntos: modelos (`src/m5/modelos.js`: superfície, animação por peça, ruínas, obras, holograma, escudos e bandeiras), terreno e mundo (`src/m5/terreno.js`: chão com todos os biomas, adereços com vento, estradas, céu e halos), efeitos e combate (`src/fx3d.js` e `src/combat3d.js` em TSL), água, espaço e tempestade (`src/m5/agua.js`, `espaco.js` e `tempestade.js`) e Modo Foto (`src/m5/foto.js`). A junção pediu três consertos: o `M5.chao` do terreno perdia o corte do chão do espaço completo no Cinturão (a diferença contra o clássico no abismo caiu de 8,2 para 2,8), a inversa da saída sem pós passou a ler a exposição (`ARD.m5.u.exposicao`, que o Modo Foto muda) e a nebulosa do Cinturão era assada duas vezes. Na partida inteira, no WebGPU e na reserva WebGL2, nenhum pipeline nasce depois da carga (fora o preparo da 1ª entrada do Modo Foto, +34, com aviso) e nenhum erro; das 76 vistas dos cinco agentes, nenhuma piorou em conjunto. Custo: o WGSL da carga cresceu de 69% a 115% (no QA, 91 pipelines e 1.185 KB contra 83 e 761 KB; os lagos pesam de 239 a 315 KB) e o tempo de shaders e pipelines de 28% a 48% no SwiftShader; a GPU por quadro fica parelha com o clássico (0,97× a 1,09×) e a CPU do WebGPU de 2,7× a 4,0× a dele, com 38% a 54% do envio por quadro em atributos `DynamicDrawUsage`. O clássico não mudou. **Fase 3 (5.0b.1):** medir nos aparelhos do dono, enxugar o WGSL (começando pelos lagos), ajustar a força do bloom, trocar o `DynamicDrawUsage` das matrizes de instância por envio parcial, o ritmo de quadros do WebGPU no Firefox, os efeitos com exposição alta sem pós e decidir o motor padrão por aparelho.

**5.0a.3 ✔ (25/10/2026), Sylvia Oriel:** a pedido do dono (24/10), a Tessara passa a ter uma líder, a primeira do jogo: Sylva Oriel vira **Sylvia Oriel**, com a concordância dos textos (a única troca visível foi no Hangar: "Retrato da líder", "Serena / Furiosa / Triunfante"), o busto com traços femininos leves (rosto em coração, cílios e delineado, lábios cor de amora, coroa de espinhos com flores e gemas âmbar, frondes como cabelo até os ombros, brincos de semente e sardas acesas; +8,6% de triângulos e +1 chamada de desenho, com os mesmos 14 materiais), os três retratos 2D e os quatro pôsteres da Tessara refeitos e, até a voz gravada chegar, a voz do sistema escolhendo uma voz feminina para ela e masculina para os outros líderes quando o aparelho tiver as duas no mesmo nível de qualidade (`tools/vozes/genero-teste.cjs`: 10/10 aparelhos simulados).

**5.0a.1 ✔ (24/10/2026), correções dos testes do dono na 5.0a:** a carga do Motor 5 (no Chrome da RTX, 44,8 s dos 46,4 s eram pipelines; no iPhone, 63,9 dos 64,7 s) tinha três causas: as 15 luzes pontuais em todo shader (78 a 87 KB de WGSL por material), o grafo TSL remontado para cada InstancedMesh (732 a 1.088 montagens) e a criação dos pipelines em fila (no Safari, cada cedida esperava um quadro). Sem luzes pontuais (o mapa de clarões ilumina), com instâncias por atributo, criação em paralelo e outros cortes: WGSL 63 a 66% menor, e no SwiftShader os pipelines passaram de 5,3× para 0,3× o tempo dos shaders do clássico na Baixa e de 16,7× para 2,2 a 2,9× na Alta; na emulação do celular, de 68,6 para 6,0 s. A tela inicial ganhou um pôster por Raça com cruzamento para a Sala ao vivo, e a Sala para no clique em Iniciar (a partida clássica esperava até 30 s a fila da Sala). Na jogabilidade: produção 1 por toque, coletores que mudam de campo sozinhos (comando `gather`, protocolo do multiplayer 6), giro com dois dedos natural, inimigos em vermelho, conselheiro de recursos parados e o Fácil com o primeiro ataque aos 15 min (0/10 quedas). As 12 regras de carga para a fase 2 estão no relatório da carga (`.wip/v50/agents/a1-carga/work/RELATORIO.md` §8) e no `docs/avaliacao-stack-3d.md` §6.10.

#### Motor 5 (WebGPU): fase 1 na 5.0a ✔, fase 2 na 5.0b ✔, fase 3 na 5.0b.1 ✔ · tamanho GGG · 1 agente de fundação, depois 5 em paralelo
- **Objetivo.** O jogo inteiro roda no WebGPURenderer do three, com materiais, efeitos e pós em TSL, e volta sozinho para WebGL2 onde não houver WebGPU. Em cada aparelho do dono, fica igual ou mais bonito e igual ou mais rápido que o motor de hoje.
- **Fase 1, fundação (1 agente):**
  - escolha do motor: `?motor=5` e `?motor=classico`; o clássico continua padrão até a paridade;
  - carga do build WebGPU do three (`three.webgpu.js` e `three.tsl.js`) e do GSAP, pelo importmap e pelo vendor;
  - laço único com `setAnimationLoop`, `await renderer.init()` e todos os pipelines compilados no carregamento (`compileAsync`);
  - pós em `RenderPipeline`: cena → GTAO → bruma de altura e perspectiva aérea em TSL → bloom → gradação (LUT) → ACES → SMAA ou FXAA, com resolução dinâmica e TAAU ou FSR1 como opção;
  - sombras em cascata (CSMShadowNode) com filtro suave, e luz de ambiente por PMREM do céu;
  - mapa de clarões, névoa de guerra e mapa de cicatrizes como texturas lidas pelos materiais TSL;
  - Teste de desempenho com a GPU medida pelo timestamp do WebGPU e o Detetive de travadas;
  - material dos modelos em TSL (cor, rugosidade e metal por vértice, emissivos), para a partida já rodar inteira no Motor 5.
- **Fase 2, porta dos módulos (5 agentes em paralelo, cada um nos seus arquivos):**
  - **Modelos:** detalhe de superfície, animação por peça, vento, ruína que desaba, bandeiras, holograma de obra, escudos e invólucros de obra (`src/meshes.js` e trechos do `render3d`);
  - **Terreno e mundo:** terreno em camadas, adereços com vento, céu, nuvens, planeta e cordilheiras (`terrain3d`, `dress3d`, `world3d`);
  - **Água, espaço e tempestade:** lagos com reflexo (`reflector` do TSL), camada do espaço e tempestade volumétrica (`lakes3d`, `space3d`, `storm3d`);
  - **Efeitos e combate:** partículas, explosões, fogo, traçantes e feixes (`fx3d`, `combat3d`), já prontos para compute;
  - **Modo Foto:** profundidade de campo e filtros em TSL, captura em 2K e 4K (`photo3d`).
- **Fase 3, paridade e desempenho:**
  - comparativos lado a lado, clássico × Motor 5, nas cinco Raças e nos dois mapas;
  - QA com fumaça nos dois motores (WebGPU e reserva WebGL2);
  - Teste de desempenho nos seus três aparelhos.
  - O Motor 5 vira padrão aparelho a aparelho, onde empatar ou ganhar. O motor clássico sai na 5.0e, depois do seu OK.
- **Pronto quando:**
  - a partida inteira roda no Motor 5, em WebGPU e em WebGL2, sem perder nada visível;
  - nenhum pipeline compila no meio da partida;
  - o Firefox no Windows carrega em até 5 s;
  - os piores 1% do iPhone passam de 40 fps.

#### Sala de Comando e Interface 3.0: na 5.0a ✔ · tamanho G · 2 agentes, junto com a fundação do Motor 5
- **Objetivo.** A primeira tela no nível de um lançamento, nascida no Motor 5 a partir do laboratório (`lab/motor5.html`).
- **Entra:**
  - **Tela inicial em 3D:** diorama da base da Raça com os modelos do jogo, unidades trabalhando, luz pelo céu físico e o líder em holograma. Trocar de Raça leva a câmera ao próximo mundo do Grande Alinhamento.
  - **Planetas só em shader:** nítidos em qualquer tela e sem textura, o fim dos planetas pixelados.
  - **Partículas fluidas da Fenda** num compute shader, que reagem ao mouse e ao toque.
  - **GSAP:** paralaxe pelo mouse, voos de câmera a cada clique e transições dos menus, no mesmo laço do render.
  - **Mesa tática:** o mapa escolhido em holograma, com o relevo real.
  - **Ambiente sonoro 3D** na tela inicial; o motor de som da 5.0f começa aqui.
  - **Líderes no Motor 5:**
    - pele com translucidez e olhos com brilho úmido;
    - boca acompanhando a voz;
    - transmissão em holograma;
    - duas expressões novas.
  - **Academia de Comando (didática):** um tutorial interativo na mesa tática. Mostra cada unidade e construção em 3D, o que faz e contra o que é forte.
  - **Interface 3.0 da partida:**
    - roda de comandos e grupos no celular;
    - central de alertas e visão do exército;
    - tela de pesquisa;
    - layout deitado e de tablet.
  - **Acessibilidade:** paletas para daltonismo, escala da interface e legendas.
- **Pronto quando:** a tela abre em até 2 s no computador sem atrasar a partida, com versão leve no celular e na GPU por software.

#### 5.0a.1 — Ajustes de jogabilidade a partir dos testes do dono ✔ · tamanho M · 3 agentes (jogo, Sala de Comando, carga do Motor 5)
O dono jogou a 5.0a no Fácil, no computador e no iPhone. A parte de jogo (agente a1-jogo, relatório em `.wip/v50/agents/a1-jogo/work/RELATORIO.md`):
- **Produção, um por toque:** o "segurar = +5" escondido da 4.1a disparava pelo relógio da página e, com o quadro lento, cada toque virava +6 (6 toques = 36 unidades). Agora um toque ou clique = +1, medido no dedo e no botão debaixo dele (vale mesmo se o painel for remontado no meio); +5 e +10 viraram botões visíveis (no computador, nos detalhes da unidade; no toque, na linha "Pôr na fila" logo acima dos cartões; Shift e Ctrl + clique continuam, com aviso); as teclas C e I voltaram a produzir e segurar a tecla põe 1.
- **Coletores inteligentes:** o nó acabou, o coletor vai sozinho ao nó do mesmo recurso mais perto (área, território, até 800 da base), espalhados pela lotação, a menos que esse recurso já sobre (aí vai ao que falta); sem nó, volta para a base. O chip "N parados" e o botão "Mandar coletores" do aviso de território seco mandam os parados aos nós livres com um toque (comando `gather` da simulação, determinístico; salvamentos antigos abrem).
- **Dois dedos como num app de mapas:** o mapa gira no sentido dos dedos (antes era o contrário) e o ponto entre os dedos fica entre eles.
- **Inimigos fáceis de ver:** anel fino vermelho com borda escura no chão, barra de vida vermelha e marca vermelha no radar, no clássico e no Motor 5; Ajustes "Destacar inimigos" (ligado) e "Cores relativas" (você verde, aliados azuis, inimigos vermelhos).
- **Fácil de verdade** e **conselheiro de recursos parados** (Construir ou Evoluir com um toque); os recursos iniciais ficaram como estavam (500/300): começar com 350/200 tirava só ~3% do que o iniciante tinha parado aos 5 min (o que enche o cofre é a renda dos coletores sem nada em que gastar).

**Tabela de dificuldade (5.0a.1).** `tools/difficulty-test.cjs`, defensor iniciante que constrói, defende e nunca ataca (agora com os coletores inteligentes), contra a IA de cada nível em 1v1, Raças espelhadas, 10 partidas de 18 min por nível:

| Nível | Defensor cai (antes → depois) | Minuto da queda | 1º ataque da IA | Construções da IA aos 5 min | Exército da IA aos 5 min | Pico antes do 1º ataque | Era II · Era III da IA |
|---|---|---|---|---|---|---|---|
| Fácil | 0/10 → **0/10** | — → — | 12,0 min → **15,0 min** | 13,2 → 10,0 | 1326 → 1019 | 2892 → 3291 | 5,4 min · 12,6 min (7 de 10) → 7,6 min · não chega |
| Normal | 2/10 → **3/10** | 9,5 min → 10,8 min | 8,0 min → **8,0 min** | 21,3 → 19,3 | 4513 → 4540 | 5620 → 5780 | 3,8 min · 9,3 min (8 de 10) → 3,8 min · 9,4 min |
| Difícil | 4/10 → **5/10** | 9,3 min → 10,3 min | 7,0 min → **7,0 min** | 21,6 → 19,7 | 5601 → 5846 | 7008 → 6809 | 2,9 min · 7,5 min → 2,9 min · 7,5 min |
| Brutal | 10/10 → **9/10** | 6,7 min → 6,4 min | 5,0 min → **5,0 min** | 20,6 → 20,4 | 8721 → 8923 | 8716 → 8895 | 2,5 min · 5,5 min (6 de 10) → 2,5 min · 6,2 min (8 de 10) |

Leitura: o **Fácil** mudou (primeiro ataque aos 15 min, em todas as partidas; nenhuma queda; a IA chega à Era II aos 7,6 min e não chega à Era III em 18 min). **Normal, Difícil e Brutal não mudaram**: a IA desses níveis é a mesma (IA contra IA, 3 jogadores, 7 min, dá o mesmo hash do código da 5.0a — `work/ia-igual.json` da cópia a1-jogo); as diferenças de ±1 queda vêm do defensor de referência, que é marcado como humano e agora tem os coletores inteligentes (outra economia, outras partidas). Antes do ajuste "recurso que sobra não prende ninguém", o defensor ficava preso no Plasma e o Difícil ia a 8/10 quedas; com ele, 5/10.

### Onda 2 — Idiomas e vozes (nova, 29/10/2026)

Para o jogo circular fora do Brasil. Aprovada pelo dono em 29/10: "precisamos de uma onda de tradução inteira do jogo e do áudio em inglês e espanhol".

#### 5.0c — Idiomas: português, English, Español · tamanho GG · 1 agente · ✔ 30/10/2026
**5.0c ✔ (30/10/2026):** 1.700 chaves nos três idiomas (pt-BR no pacote; inglês e espanhol à parte, só para quem usa, guardados pelo service worker), troca sem recarregar, voz do sistema no idioma e o item "idiomas" no portão de qualidade. Junto, as correções dos testes do dono na 5.0b.1: o fundo da Sala em repouso (céu, planetas e horizonte) saía em meia resolução, porque a composição da profundidade de campo do r186 usa o campo distante, feito em meia resolução, mesmo sem desfoque: agora a imagem cheia em repouso e o desfoque entra com o bokeh; os planetas com o detalhe filtrado pelo tamanho do pixel; e a resolução dinâmica da Sala sem contar a troca de Raça nem o aquecimento (e com volta); o locutor da partida no gênero do locutor da Raça no elenco das vozes gravadas (no Chrome, todas as Raças saíam com a Google, feminina); no Motor 5, a resolução dinâmica da partida só baixa com a GPU no limite (no Chrome numa RTX ela descia a 85% com a GPU em 5,9 ms, e cada troca travava de 50 a 80 ms); e a dica do iPhone no Testar som (a voz do sistema e os efeitos saem por caminhos diferentes; a solução de vez são as vozes gravadas da 5.0c.1, que tocam pelo mesmo caminho dos efeitos).
- **Todo texto do jogo nos três idiomas:** tela inicial, Sala de Comando, Academia, HUD e Interface 3.0, campanha (20 missões), diplomacia, multiplayer, ajuda, notas da versão e as falas da voz do sistema.
- **Arquitetura:** `src/i18n.js` (`ARD.idioma`, `ARD.t` com plural e números do `Intl`, atributos `data-i18n` no HTML), com o português no pacote e o inglês e o espanhol carregados só quando escolhidos, guardados pelo service worker para jogar sem internet.
- **Idioma pelo aparelho**, com `?lang=` e a escolha em Ajustes; espanhol neutro latino-americano.
- **A simulação não muda:** nomes e textos que vêm dela são traduzidos na hora de mostrar.
- **Glossário** em `docs/glossario.md` para o dono revisar. Nomes de Raças, líderes e mundos não mudam; Fenda → Rift / la Grieta, Núcleo → Core / Núcleo, Éter → Aether / Éter.
- **Pronto quando:** o layout está conferido nos três idiomas, do celular ao computador, e o item "idiomas" do portão de qualidade passa (nenhuma chave faltando, nenhum marcador trocado, nenhum texto em português sobrando em inglês ou espanhol).

#### 5.0c.1 — Vozes gravadas nos três idiomas · tamanho G · 1 a 2 agentes · ✔ 30/10/2026
**5.0c.1 ✔ (30/10/2026), três partes em paralelo sobre a 5.0c:**
- **Vozes gravadas:** 766 falas por idioma (180 do locutor, 75 eliminações, 200 de unidades, 70 do líder e 241 da campanha), 2.298 arquivos Opus, de 7,1 a 7,4 MB por idioma, com erro de transcrição de 2,3% (pt-BR), 1,0% (en) e 1,3% (es). O Quorith ficou em estéreo a 32 kbps. As unidades falam com o Alex e o caráter da Raça, decisão a confirmar. Os 283 textos novos por idioma estão em `tools/vozes/falas-jogo.json`, para o dono revisar.
- **No jogo (`src/vozes.js`):**
  - toca pelo Web Audio, com as regras de prioridade do `A.say`, legenda e boca do líder no tempo de cada palavra;
  - cada partida baixa só o pacote da Raça depois da carga, a Sala só a saudação e a campanha só a missão aberta;
  - falas novas: respostas das unidades, avisos, eliminações, reações do líder e a campanha;
  - o jogo segue inteiro sem nenhum arquivo, com a voz do sistema.
- **iPhone:** a bancada `lab/som-iphone.html` mostrou que o Safari toca Opus e que a voz do sistema sai sozinha. Ela some no jogo porque o áudio dos efeitos era retomado no meio da fala. Agora, no iPhone, só as vozes gravadas falam; as falas sem arquivo saem na legenda, e o áudio nunca é retomado durante uma fala do sistema.
- **Motor 5:**
  - 74 → 58 pipelines no cenário do QA (celular: 56 → 42);
  - CPU do desenho −14%: o `R.draw` foi dividido em quatro funções que o V8 otimiza, a árvore da cena é atualizada uma vez por quadro, há menos objetos nas cascatas e menos alocação por quadro;
  - o `BundleGroup` ficou desligado (`?m5bundle=1` para medir), porque a vista alta perdia as mesas do horizonte;
  - preparar a partida na tela inicial não ganhou no Chromium (30 a 32 s nos três modos) e custa cerca de 300 MB a mais; só um teste no iPhone decide.
- **Vozes (decisões do dono em 24/10 e 29/10/2026, pela página de escuta):**
  - Kokoro-82M v1.0 (pesos Apache-2.0), com o Alex como voz-base, a Dora para a Sylvia Oriel e o Santa e misturas para os outros líderes; o Piper pt_BR ficou de fora (as vozes nasceram da en_US lessac, que só pode ser usada em pesquisa);
  - o caráter de cada Raça assado nos arquivos na geração (`tools/vozes/racas.py`), sem efeito ao vivo no jogo: a Vehnar com o rádio sem ruído por baixo da voz e o Vorag sem o ronco (ajustes pedidos pelo dono em 24/10; o grave do Vorag foi refeito depois na variante C, abaixo; nas pausas, o ruído do Vehnar caiu de +12,1 dB para −2,9 dB em relação à voz seca e o do Vorag de +16,8 dB para +1,5 dB);
  - o elenco aprovado em 29/10: uma voz ou mistura do Kokoro por líder e por locutor, com o eco mais leve no locutor da Erevane (o eco de antes atrapalhava avisos curtos);
  - o Vorag na variante C (29/10): "Change gender" do Praat com −5 semitons e formantes 12% abaixo, graves +4 dB e saturação 30%, a voz de corpo grande e com as pausas mais limpas das três;
  - o Kokoro grava os três idiomas (29/10): as vozes em inglês e espanhol do próprio Kokoro, com o mesmo caráter de cada Raça. O Chatterbox, testado para manter a mesma voz nos três idiomas, saiu;
  - 742 falas por idioma (32 min, cerca de 7,7 MB em Opus 24 kbps com as caudas de eco e o estéreo do Quorith, no português), com o pacote de cada Raça e idioma (de 478 KB a 1,1 MB) baixado só quando precisa; falas com números e nomes dinâmicos continuam na voz do sistema, e nenhum arquivo é obrigatório;
  - a ferramenta fica em `tools/vozes/` (gera, confere por transcrição e monta a página de escuta), com o ambiente em `.tools/vozes`, fora do git.
- **Pronto quando:** cada Raça fala com as vozes gravadas nos três idiomas, com legenda e boca do líder acompanhando, e o jogo segue completo sem nenhum arquivo de voz.

### Onda 3 — Mundo vivo (tudo em TSL)

#### 5.0d — Céu, clima e nuvens de guerra · tamanho G · 3 agentes
- **Céu:**
  - céu físico com nuvens (SkyMesh) e sol que anda: o ciclo de 12,5 min ganha nascer e pôr do sol, sombras que giram, lua e estrelas;
  - a aurora vira cortinas de luz no céu;
  - o reflexo do céu (PMREM) é refeito quando a hora muda;
  - raios de sol pela poeira e pela tempestade (GodraysNode).
- **Nuvens de guerra volumétricas,** por marcha de raio em TSL: o que nunca foi visto fica sob nuvens baixas, que se abrem com uma borda acesa quando as tropas chegam.
- **Clima simulado na GPU:**
  - partículas em compute que batem no relevo: neve que acumula no alto das peças, cinza vulcânica, tempestade de areia, chuva e bancos de neblina;
  - chão molhado com reflexo de tela (SSRNode) e poças.
- **Terreno que guarda a batalha:** crateras que afundam o chão, mato queimado e pegadas na neve e na areia.
- **Pronto quando:** capturas de dia, entardecer, noite e cada clima, no computador e no celular, dentro do orçamento.

#### 5.0e — Bases e unidades vivas · tamanho GG · 3 agentes
- **Obra 2.0:** a estrutura sobe por um corte com borda no estilo da Raça, com faíscas em compute e uma onda no chão ao concluir:
  - Vehnar: solda;
  - Erevane: trama de luz;
  - Tessara: crescimento orgânico;
  - Quorith: cristal que se acumula;
  - Vorag: biomassa que borbulha.
- **Destroços em compute** que quicam no relevo, poeira que rola e entulho que fica.
- **Distorção orgânica:** construções Tessara e Vorag que respiram (deslocamento por ruído); calor e onda de choque que refratam a cena.
- **Base:** módulos visíveis, avaria nas paredes, energia nos condutos e vida de base (drones de carga, tratores, esporos, larvas).
- **Unidades:** aro de seleção em holograma, barras de vida em segmentos, contorno do time (OutlineNode) e veteranos marcados.
- **Materiais 2.0:** desgaste de borda, sujeira por bioma, neve e molhado, cavidade por peça, e sombra de contato fina (GTAO e sombras de tela).
- **Pronto quando:** o orçamento de FPS se mantém sem alocação nova por quadro. Depois do seu OK, o motor clássico sai.

### Onda 4 — Som, cinema e ameaças

#### 5.0f — Som 3D e cinema · tamanho G · 2 agentes
- **Som 3D (Web Audio):**
  - o ouvinte fica preso à câmera (posição e orientação a cada quadro), e cada som tem posição no mapa;
  - HRTF no computador com fone e panorâmica simples no celular;
  - distância pelo zoom, abafamento do que está sob a névoa e reverberação por bioma gerada no navegador;
  - mixagem com limite de vozes e prioridade; a música baixa quando alguém fala;
  - trilha adaptativa gerada no navegador: tema por Raça e camadas de paz, tensão, batalha e chefão;
  - locutor por Raça e sons de interface por Raça.
- **Vozes gravadas:** saíram para a 5.0c.1 (revisão de 29/10), porque cada fala precisa existir nos três idiomas.
- **Cinema (GSAP):**
  - linhas do tempo com trilhos de câmera, faixas, legendas digitadas e botão Pular;
  - Sala de Guerra no briefing das 20 missões;
  - câmera de ação da superarma;
  - entrada dos chefões.
- **Pronto quando:** som e música desligáveis em separado, nenhum arquivo de áudio obrigatório, e cenas puláveis e fora da simulação.

#### 5.0g — Chefões · tamanho GG · 3 agentes
- **Entra:**
  - o sistema de chefões (§5.1);
  - **O Arauto** e **A Forja-Mãe**, com o mapa Destroço do Titã;
  - o **modo Caçada**, solo e cooperativo;
  - os **Eventos da Fenda** na escaramuça: Sentinela da Fenda, Caravana Corsária, Enxame Errante e chuva de meteoros;
  - os primeiros mutadores: Noite Eterna, Tempestades Frequentes e Recursos Escassos.
- **Pronto quando:**
  - o chefão é determinístico (hash idêntico nos 4 motores e depois de salvar e voltar);
  - toda a telegrafia é legível no celular;
  - o cooperativo funciona com 2 a 4 jogadores;
  - os testes novos estão no portão de qualidade.

#### 5.0h — Inteligência e mundo · tamanho GG · 3 agentes
- **IA 3.0:**
  - **Personalidade por líder:**
    - Barão-Forja: fortaleza e depois empurrão blindado;
    - Vesper Ísk: furtividade, roubo e assédio;
    - Sylvia Oriel: expansão, diplomacia e evolução;
    - Zayin Coral: exército sincronizado, com o Uníssono na hora certa;
    - Oru Voraz: pressa, enxame e Eclosão.
  - Contra-composição mais fina: hoje a IA conta o que viu por classe; passa a contar por unidade e por habilidade (camuflagem, antiaéreo, cerco).
  - Microgestão: foco no alvo mais fraco ou mais valioso, recuo de feridos, distância das armas de alcance e desvio da telegrafia dos chefões.
  - Ataque em duas frentes e assédio aos Coletores.
  - Diplomacia: coalizão contra quem está na frente e traição calculada.
  - **Falas pelo retrato**, com humor e recarga para não virar spam.
  - **IA aliada que obedece:** "Atacar meu alvo", "Defender minha base" e "Expandir".
- **Mundo neutro (opcional na escaramuça e no multiplayer):**
  - fauna da Fenda: herbívoros que fogem, guardiões dos nós ricos e enxames à noite;
  - **Ruínas dos Construtores**, capturáveis com infantaria: Observatório (visão), Forja Antiga (veículos mais baratos), Portal (teleporte em par) e Torre de Éter (energia);
  - acampamento da Irmandade Corsária, com 3 mercenários pagos em Dados;
  - eventos de mapa: surto de éter (renda dobrada numa zona) e chuva de meteoros.
- **Construções únicas, duas por Raça:**
  - Vehnar: Esteira de Montagem (liga duas fábricas) e Silo de Sucata (carcaça vira Minério);
  - Erevane: Espelho do Véu (camufla construções) e Farol Falso (isca);
  - Tessara: Árvore-Mãe (cura e cresce com as Eras) e Viveiro;
  - Quorith: Pilar de Ressonância (estende o Elo) e Câmara de Eco;
  - Vorag: Câmara de Incubação e Tumor de Território (desacelera inimigos).
- **Módulos com escolha:** cada construção oferece dois módulos, e o jogador escolhe um.
- **Comandantes em campo (modo opcional):** cada líder leva um avatar à batalha, com 3 habilidades e níveis pela veterania. O avatar volta no Núcleo depois de um tempo:
  - Barão-Forja: Exo-Forja (Martelo Sísmico, Reparo de Campo, Chamado da Fundição);
  - Vesper Ísk: Espectro (Véu, Lâmina de Luz, Eco Falso);
  - Sylvia Oriel: Guardiã (Raízes, Florescer, Esporos);
  - Zayin Coral: Prisma Vivo (Acorde, Estilhaço, Silêncio);
  - Oru Voraz: Devorador (Devorar, Ninhada, Rugido).
- **Pronto quando:** o self-play mantém as Raças na faixa de vitórias, o teste de dificuldade é refeito e o determinismo se mantém nos 4 motores.

### Onda 5 — Além da Fenda

#### 5.0i — Campanha 2 · tamanho GG · 3 agentes
- **Entra:** as 15 missões, os quatro chefões que faltam (Ouroboros, Almirante Sargaço, O Simulacro e Nadir) e os sistemas da §6.
- **Pronto quando:** as 15 missões passam no teste de missões, os ramos ficam salvos no ProgressStore e as cenas são puláveis.

#### 5.0j — Mundos novos · tamanho G · 2 a 3 agentes
- **Cinco mapas, um por mundo natal,** cada um com luz e clima próprios:
  - Forja de Kessari: vulcânico e industrial, com rios de lava;
  - Espelhos de Ísk: salinas e lagos-espelho;
  - Jardins de Oriel: selva bioluminescente;
  - Coral de Quor: cânions de cristal que vibram;
  - Ninho de Velk: planícies de quitina e cavernas.
- O **Destroço do Titã** (nave caída) entra antes, na 5.0g.
- **Kit de marcos:** nave caída, anel dos Construtores e esqueleto colossal.
- **Gerador de mundos por semente**, com simetria justa e recursos equilibrados.
- **Pronto quando:** cada mapa roda com 2 a 5 jogadores, no teste entre motores e no teste de desempenho.

#### 5.0k — Replays, clipes e relatório · tamanho M · 1 a 2 agentes · com o Estúdio E3
- **Replays locais:** comandos mais fotografias periódicas do estado (o mesmo formato dos salvamentos), para pular no tempo.
- **Tocador de replay:** linha do tempo, velocidades de 1× a 16× e visão por jogador.
- **Diretor de câmera automático**, que segue a maior batalha, mais a câmera do Modo Foto.
- **Clipe em vídeo** pelo MediaRecorder.
- **Relatório de batalha:** gráficos de exército, renda e perdas, unidade destaque, linha do tempo dos momentos e a foto do momento decisivo, tirada sozinha.
- **Desafio da Semana:** semente e mutadores pela semana do ano, iguais para todos sem servidor. O placar global fica para a v6.0.
- **Sobrevivência.**
- **Pronto quando:** o hash do fim do replay é igual ao da partida original, e o clipe sai no Chrome, no Firefox e no Safari.

### Estúdio da Fenda — mini projeto paralelo (proposto em 29/10/2026)

Vídeos, clipes, trailers e cinema: o jogo passa a gerar o próprio material de divulgação e deixa pronto o que uma rede social do jogo vai precisar na v6.0 (pedido do dono em 29/10, a partir da lista de 21 ferramentas).

A base é o que o jogo já tem: a simulação determinística. Um replay são só os comandos da partida, poucos KB, e reproduz a batalha igual em qualquer aparelho. Com ele, um clipe pode ser um link que abre a batalha no próprio jogo ou um vídeo para as outras redes.

| Ferramenta | Veredito | O que traz | Quando |
|---|---|---|---|
| HyperFrames (HeyGen, Apache-2.0) | Sim | Vídeo a partir de HTML, no servidor, com Chrome sem janela e FFmpeg: trailer de cada versão nos três idiomas, em 16:9 e 9:16; cartões das Raças e dos líderes em vídeo; moldura dos clipes com placar, Raça e logo | E1 |
| GL Transitions (MIT) | Sim | Seis transições portadas para TSL: tela inicial → partida, troca de Raça na Sala, briefing → missão, vitória e derrota, entrada de chefão e troca de filtro do Modo Foto. Só compilam quando usadas | E2 · 5.0f |
| Tone.js (MIT) | Sim | Trilha adaptativa, carregada só com a música ligada: um tema por Raça, camadas de paz, tensão, batalha e chefão, vinhetas e sons de interface por Raça, e as faixas separadas para os trailers | E2 · 5.0f |
| faster-whisper (MIT, já usamos) | Sim | Legendas palavra a palavra nos três idiomas, para as falas, a boca do líder e os vídeos (SRT e VTT); confere cada fala gravada | 5.0c.1 · E1 |
| FFmpeg (LGPL/GPL, já usamos) | Sim | Opus das vozes, MP4 e WebM dos trailers, GIF e WebP animado, cortes verticais e volume padronizado | E1 |
| OBS Studio (GPL, fora do jogo) | Sim | Gravação com a placa de vídeo real, para trailers e transmissões; o jogo ganha um modo transmissão (HUD limpo, câmera de diretor, placar nas cores das Raças) e o repositório um perfil de cenas pronto | E1 |
| Chatterbox (Resemble AI, MIT) | Não, por ora | Testado em 29/10 para manter a mesma voz de cada líder nos três idiomas; o dono ficou com o Kokoro nos três e o ambiente saiu da máquina. Volta a ser opção se o cinema pedir emoção na voz | — |
| Rapier (Dimforge, Apache-2.0) | Talvez | Física 3D só na aparência, nunca na regra da partida: construções que desabam em pedaços, destroços que rolam e cenas de cinema. Laboratório contra os destroços em compute, medindo CPU e o tamanho do WASM | 5.0e |
| glTF Transform (MIT) | Talvez | Guardar os modelos procedurais prontos em GLB comprimido, para cortar a etapa "modelos" da carga (0,4 a 0,9 s), e otimizar modelos feitos à mão, se os chefões tiverem; entra se a medida mostrar ganho | 5.0g |
| OpenCut (MIT, em reescrita) | Talvez | Editor de vídeo no navegador para montar trailers à mão a partir dos clipes; avaliar quando a reescrita estabilizar | E3 |
| Remotion, Anime.js, React Spring, PixiJS, p5.js, Paper.js, Matter.js, OGL, tsParticles | Não | Repetem o que já temos (GSAP, Three.js, partículas na GPU, interface em HTML), pedem React, não dão o mesmo resultado em todos os aparelhos (a física 2D) ou têm licença paga para empresas (o Remotion) | — |

#### E1 — Linha de vídeo e divulgação · tamanho M · logo depois da 5.0c
- Trailer de cada versão, gerado no servidor: cenas do jogo, notas da versão, narração e legenda nos três idiomas, em 16:9 e 9:16.
- Cartões dos líderes em vídeo: holograma girando, saudação dublada e legenda, para redes sociais.
- Modo transmissão e o perfil do OBS.
- Pacote de imprensa: logos, capturas do Modo Foto e textos curtos nos três idiomas.
- **Pronto quando:** uma versão nova sai com o trailer e os cartões feitos sem trabalho manual.

#### E2 — Cinema do jogo · tamanho G · junto com a 5.0f
- Sala de Guerra no briefing das 20 missões: câmera de trilho com GSAP, transições de shader, trilha Tone.js e narração.
- Introdução da campanha e entrada dos chefões.
- Câmera de ação da superarma.
- Toda cena pulável, fora da simulação, nos três idiomas.

#### E3 — Clipes e destaques · tamanho M · junto com a 5.0k
- Compartilhar clipe: o jogador marca um trecho e ganha um link que abre o replay no próprio jogo e um vídeo para as outras redes, gravado no navegador ou no servidor.
- Destaques automáticos: o diretor de câmera acha a superarma, a virada, o chefão abatido e a maior batalha, e monta um clipe de 15 s com a moldura da Raça.
- Cartão do Modo Foto: a imagem com moldura, Raça, mapa e resultado.
- Os formatos de replay, clipe e cartão ficam prontos para o feed da rede social da v6.0.

### Trilha contínua

- **Desempenho em toda versão:** o orçamento da §8, o Teste de desempenho e o Detetive de travadas, nos dois motores enquanto o clássico existir.
- **Laboratório (`lab/motor5.html`):** a bancada onde cada técnica é provada antes de entrar no jogo. O Teste de 20 s mede o seu aparelho.

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
- o Teste de desempenho ganha cenas novas quando o efeito pedir (clima, chefão, base cheia);
- o Motor 5 só vira padrão num aparelho quando empatar ou ganhar do motor de hoje nesse aparelho.

---

## 9. Decisões do dono (19 a 29/10/2026)

- **29/10, Idiomas:** a 5.0c passa a ser Idiomas, com o jogo e o áudio em inglês e espanhol (espanhol neutro latino-americano). As outras versões andam uma letra.
- **29/10, Vozes:** o elenco do Kokoro e o eco mais leve no locutor da Erevane aprovados; o Vorag na variante C; o Kokoro grava os três idiomas, e o Chatterbox saiu.
- **29/10, Faróis e Sala:** os faróis iluminam o chão à noite, e a cena da Sala fica um pouco mais clara (as duas na 5.0b.1).
- **29/10, Estúdio da Fenda:** um plano para as ferramentas aprovadas (Sim e Talvez), pensando em clipes, trailers, cinema e numa rede social do jogo (§7).
- **29/10, cópias antigas:** as cópias de agentes das versões 4.3c a 4.3h (2,6 GB) saíram, com os relatórios, os prompts e os roteiros guardados num arquivo de 18 MB.
- **24/10, Sylvia Oriel:** a Tessara ganha uma líder, a primeira do jogo, com a voz Dora (5.0a.3).

De 19/10:

- **Ondas aprovadas.** A ordem nova começa pelo Motor 5 e pela Sala de Comando, em paralelo (os dois saíram juntos na 5.0a, em 23/10).
- **WebGPU no jogo:** sim, com volta automática para WebGL2 e o motor clássico como reserva até a paridade.
- **GSAP:** sim, na apresentação.
- **Chefões renomeados:**
  - Ouroboros, a Serpe do Anel (era Leviatã de Éter);
  - Almirante Sargaço (era Kael Sem-Bandeira; a nau continua Maré Negra);
  - O Simulacro (era O Eco);
  - Nadir, o Sol Negro (era O Eclipse).
  - O Arauto e A Forja-Mãe continuam.
- **Valem as recomendações onde não houve objeção:**
  - trilha gerada no navegador (faixas suas podem entrar depois, com a licença no `ASSETS.md`);
  - voz do sistema para o locutor e os líderes;
  - Comandantes em campo como modo opcional;
  - mundo vivo ligado no solo e opcional no multiplayer;
  - Campanha 2 com 15 missões, escolha de aliado, esquadrão veterano e ramos.
- **Nomes dos mundos natais** (Kessari, Ísk, Oriel, Quor e Velk): aprovados.

---

## 10. v6.0 (antiga v5.0): servidores e escala

Continua como estava, só com a numeração nova:
- 6.0a: contas, perfil e importação do ProgressStore;
- 6.0b: relé autoritativo e replays guardados na nuvem;
- 6.0c: ranking Glicko-2 e temporadas;
- 6.0d: social (amigos, Discord, espectador);
- 6.0e: loja cosmética;
- marketplace a partir da 6.5.

A v5.0 prepara a v6.0 em três pontos: os replays locais da 5.0k já gravam o formato que o relé vai guardar; o Desafio da Semana e o modo Caçada ganham placar global; e o gerador de mapas da 5.0j vira a base do editor com compartilhamento.

---

## 11. O servidor e as bibliotecas: o que precisa mudar

Pergunta do dono em 19/10: para chegar ao 3D descrito aqui e às ondas, é preciso atualizar pacotes no servidor ou bibliotecas? Conferido nesta máquina no mesmo dia.

**O ambiente hoje:**

| Item | Versão ou estado | Precisa mudar? |
|---|---|---|
| Node e npm | 24.21.0 e 11.19.0 | Não |
| Playwright (testes) | 1.63.0, com Chromium 153, Firefox e WebKit | Não. O Chromium 153 roda WebGPU sem placa de vídeo (adaptador SwiftShader pelo Vulkan embutido); conferido com `navigator.gpu.requestAdapter()` e com o laboratório nos dois motores |
| Xvfb e ffmpeg | instalados (o ffmpeg vem do Playwright) | Não |
| Máquina | 8 vCPU, 31 GB de memória (24 GB livres), disco de 62 GB com 22 GB livres | Não. Cabem 4 agentes ao mesmo tempo, cada um com até 2 navegadores |
| Placa de vídeo | nenhuma; os testes usam GPU por software | Não. Desempenho de verdade continua saindo dos seus aparelhos |

**Bibliotecas do jogo:**

| Biblioteca | Hoje | Na v5.0 |
|---|---|---|
| three | 0.186.1, o mais novo publicado | **Mesma versão.** Ela já traz o WebGPURenderer, o TSL, o RenderPipeline, os nós de pós, o CSMShadowNode e o SkyMesh. Muda só o vendor (`tools/vendor.mjs`) e o importmap, que passam a incluir `three.webgpu.js`, `three.tsl.js` e os addons usados |
| GSAP | — | **Entra:** 3.15.0 (abril de 2026), com a licença padrão gratuita da Webflow registrada no `ASSETS.md` |
| postprocessing (pmndrs) 6.39.5 e N8AO 2.0.1 | pós do motor de hoje | **Ficam só no motor clássico** até a paridade (5.0e) e depois saem. Os dois só funcionam em WebGL |
| PeerJS 1.5.4 | multiplayer | Não muda |

**Recomendações:**

1. **Um `package.json` do próprio jogo para as ferramentas de teste**, com o Playwright 1.63.0 fixo. Hoje o portão de qualidade usa o `node_modules` do conector Dynatrace (`NODE_PATH`): uma atualização naquele projeto pode quebrar os testes do jogo. Entra na fundação da 5.0a. Os navegadores já baixados são reaproveitados.
2. **O portão de qualidade ganha a fumaça do Motor 5,** em WebGPU e na reserva WebGL2, com as opções do Chromium que ligam o adaptador por software.
3. **Opcional:** apagar as cópias de agentes das versões já publicadas em `.wip/` (4.3c a 4.3h, cerca de 2,6 GB de 3,8 GB). Só com o seu OK.

Não é preciso instalar nada no sistema nem trocar versões de bibliotecas: o salto vem de usar o que o three r186 já tem.

---

## Fontes consultadas em 18 e 19/10/2026

- Registro npm: `realism-effects` 1.1.2, publicado em 12/05/2023, peer `three >= 0.148`; `three.quarks` 0.17.1 (maio/2026), peer `three >= 0.182`; `postprocessing` 6.39.5 (setembro/2026); `three` 0.186.1.
- three.quarks: https://npmjs.com/package/three.quarks ("computes most particle information on CPU"; simulação na GPU em andamento).
- realism-effects: https://github.com/0beqz/realism-effects (v2 em andamento num ramo).
- pmndrs postprocessing: https://github.com/pmndrs/postprocessing (WebGLRenderer).
- KHR_parallel_shader_compile: https://developer.mozilla.org/docs/Web/API/KHR_parallel_shader_compile e https://caniuse.com/wf-khr-parallel-shader-compile (Firefox: não).
- WebGPU nos navegadores: https://web.dev/blog/webgpu-supported-major-browsers.
- three.js, manual do WebGPURenderer: https://threejs.org/manual/en/webgpurenderer (volta para WebGL2; `await renderer.init()`).
- Exemplos oficiais do r186 usados como referência de API: webgpu_compute_particles, webgpu_postprocessing_dof, webgpu_postprocessing_bloom, webgpu_shadowmap_csm e webgpu_sky (github.com/mrdoob/three.js, tag r186).
- GSAP, licença padrão: https://gsap.com/community/standard-license/ e anúncio da Webflow: https://webflow.com/blog/gsap-becomes-free.
