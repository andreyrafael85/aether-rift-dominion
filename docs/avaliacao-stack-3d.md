# AETHER RIFT: DOMINION — Avaliação da stack 3D, do multiplayer e do "3.5D"
### 10 de outubro de 2026 · verificado no GitHub e nos repositórios citados

## 0. O que verifiquei (não é de memória)

| Projeto | Licença real | Atividade | Observação |
|---|---|---|---|
| Three.js | MIT | 116 mil estrelas, commit em 10/10/2026 | Já validado por nós em `estilo3d.html` (r160, WebGL2) |
| Babylon.js | **Apache-2.0** (não MIT, mas igualmente permissiva) | 26 mil estrelas, ativo | Motor completo: colisão, física, áudio espacial, editor de nós, WebGPU maduro |
| Rogue Engine | **sem repositório público do motor**; o GitHub `RogueEngine/RogueEngine` não tem código nem licença | n/a | É um editor fechado sobre Three.js, com plano gratuito. Não é open source |
| Threlte | MIT | ativo | Three.js declarativo para Svelte |
| React Three Fiber | MIT | 33 mil estrelas, ativo | Three.js declarativo para React |
| geckos.io | **BSD-3-Clause** (permissiva) | 1,5 mil estrelas, último commit mar/2026 | UDP via WebRTC cliente-servidor em Node |
| Colyseus | MIT | 7 mil estrelas, ativo | Salas, matchmaking e sincronização de estado em Node |
| PeerJS | MIT | 13 mil estrelas, último commit fev/2026 | WebRTC P2P simples com servidor de sinalização público gratuito |
| **VOIDSTRIKE** (braedonsaunders) | MIT | criado em jan/2026, 25 estrelas, 4 forks, 1.161 arquivos, 354 MB | Three.js r182 + TSL em WebGPU com fallback WebGL2, Next.js 16, React 19, Phaser 4 como overlay, recast-navigation (WASM), nostr-tools, zustand; 157 modelos .glb com LOD; docs de arquitetura de rede e render |

**Correções ao briefing recebido:** Babylon.js é Apache-2.0; Rogue Engine não é MIT nem aberto; geckos.io é BSD-3. Nada disso impede o uso, mas o registro de licenças precisa estar certo.

---

## 1. O que "3.5D" significa na prática

O termo descreve o que os RTS 3D clássicos fazem: **câmera presa como num jogo 2.5D** (ângulo fixo, rotação limitada, zoom contido, para legibilidade e para a arte ser feita para um ponto de vista) sobre **um mundo inteiramente 3D** (luz dinâmica, sombras, relevo real, efeitos volumétricos, câmera de replay livre). Não é uma tecnologia; é uma disciplina de câmera somada a um renderizador 3D completo.

O que faz o jogador dizer "visual incrível", em ordem de impacto por custo:

1. **Luz e sombra reais** com ciclo de dia e noite e luzes emissivas (já funciona na validação).
2. **Relevo com penhascos e rampas** que a simulação respeita: as cordilheiras viram montanhas de verdade; altura dá visão.
3. **Pós-processamento**: bloom nos emissivos, oclusão ambiente leve, névoa volumétrica na Fenda e na Tempestade, correção de cor por bioma.
4. **Partículas em GPU**: fumaça, neve, faíscas, destroços; milhares sem custo de CPU.
5. **Decalques e persistência**: crateras, rastros de esteira, carcaças que ficam.
6. **Animação por partes**: torretas, esteiras, pernas de mech, portões abrindo.
7. **Água e plasma** com shader (lagos de plasma perto da Fenda, gelo refletindo).
8. **LOD e instancing** para centenas de unidades a 60 fps, com presets de qualidade por dispositivo.

Tudo isso está ao alcance do Three.js, e o VOIDSTRIKE prova em produção que dá para ir ainda além no navegador.

---

## 2. Motor: manter Three.js, com um upgrade

| Opção | Prós | Contras | Veredito |
|---|---|---|---|
| **Three.js** (atual) | MIT, maior comunidade e mão de obra, validado por nós, WebGPU via `WebGPURenderer` + TSL nas versões recentes | É biblioteca, não motor: montamos câmera, picking e pós-processamento | **Manter** |
| Babylon.js | Motor completo, WebGPU maduro, editor de nós, áudio espacial, inspetor | Apache-2.0; port de tudo que validamos; física e colisão não servem (a simulação é nossa); menos mão de obra | Não trocar |
| Rogue Engine | Editor visual sobre Three.js | Fechado; nossos mapas são procedurais, não montados à mão | Não |

**Upgrade recomendado:** sair do `three.min.js` r160 (UMD, só WebGL) para a versão ESM atual via import map (r17x+), com **WebGPU quando disponível e WebGL2 como fallback**, exatamente a configuração do VOIDSTRIKE (r182). O custo é pequeno agora e evita um port depois.

**Camadas declarativas (Threlte/R3F):** ótimas para telas, menus e protótipos; inadequadas para 500 entidades atualizadas 10 vezes por segundo, porque cada mudança passa pela reconciliação do framework. Nosso HUD já é DOM e a cena é gerida por arrays. Opcional só para telas de lobby, se adotarmos React.

---

## 3. Rede: o que cada opção resolve de verdade

Nosso multiplayer é **lockstep de comandos sobre uma simulação determinística**: cada cliente simula tudo; só comandos trafegam; checksums detectam divergência. Isso muda o que importa na rede: precisamos de **entrega confiável e ordenada** de pacotes pequenos, não de UDP de baixa latência.

| Opção | Serve para | Encaixe no nosso lockstep |
|---|---|---|
| geckos.io (UDP via WebRTC, cliente-servidor) | Jogos de ação com streaming de posições | Pouco: o ganho do UDP não aparece em lockstep; exige servidor Node com portas UDP e TURN |
| Colyseus | Salas, matchmaking e sincronização de estado automática | Parcial: salas e matchmaking são úteis, mas o state sync é inútil para nós e viraria peso morto; um relay WebSocket próprio tem 200 linhas |
| **P2P por WebRTC** (VOIDSTRIKE com Nostr, ou PeerJS) | Partidas entre amigos sem servidor de jogo | **Alto**: lockstep é o modelo natural do P2P; zero custo de servidor; código de sala; nossa simulação já está pronta |
| Servidor autoritativo (plano original, Rust) | Ranqueado, anti-cheat, replays oficiais | Continua sendo o destino para competição |

**Sobre o VOIDSTRIKE sem servidor (WebRTC + Nostr):** é uma solução elegante e real. Prós: nenhum servidor para pagar ou manter; lobby por código; comandos assinados criptograficamente; adaptação de atraso por RTT e jitter; reconexão e ressincronização. Contras: sem autoridade central, trapaça é possível entre desconhecidos (maphack, pois todo cliente tem o estado inteiro); a sinalização depende de relays Nostr públicos que não controlamos; NAT simétrico falha sem servidor TURN; não há contas, ranking ou proteção contra desconexão tática além do que os pares combinam.

**Recomendação:** dois trilhos. **Agora (beta com amigos): P2P lockstep por código de sala**, com sinalização via PeerJS (MIT, servidor público gratuito, mais simples) ou via Nostr reaproveitando o módulo do VOIDSTRIKE; comandos assinados e checksums por tick com busca de divergência (ideias do VOIDSTRIKE). **Depois (ranqueado): o servidor autoritativo do plano.** O código de jogo não muda entre os dois, porque ambos falam a mesma linguagem de comandos.

---

## 4. VOIDSTRIKE: o que aproveitar e o que evitar

É o projeto mais próximo do que queremos ser tecnicamente, e é MIT: **podemos reutilizar código com atribuição**. Mas é jovem (janeiro de 2026), de autor único, com 25 estrelas e 354 MB; as APIs mudam.

**Aproveitar (módulos isolados, com testes nossos e crédito no `ASSETS.md`):**

- `src/engine/network/`: `CommandSigning`, `DesyncDetection`, `MerkleTree`, `p2p/NostrRelays`. É o lockstep P2P pronto, com forense de dessincronia.
- `src/rendering/tsl/` e `compute/`: pós-processamento em TSL, névoa de guerra em compute shader sem leitura de CPU, instancing com vetores de movimento, pool de luzes. Referência direta para o nosso v3.0b.
- `src/workers/`: simulação em Web Worker com passo fixo que não trava quando a aba perde foco. Vale adotar cedo: o nosso laço ainda roda na thread principal.
- `recast-navigation` (WASM): navmesh com obstáculos dinâmicos, formações e multidões. Evolução natural do nosso campo de fluxo quando houver relevo.
- `docs/reference/models.md` e os 157 `.glb` com três níveis de LOD como **padrão de pipeline** (voxel → glTF → LOD0/1/2), não como assets.
- Editor de mapas e validação de conectividade de navmesh: a ideia, para a Temporada 2.

**Evitar:**

- Adotar o projeto como base. Ele é Next.js + React + Phaser; nós somos arquivo único em Vite, HUD em DOM, simulação determinística já testada e identidade própria. Trocar de base jogaria fora o que validamos.
- Os assets. O README não documenta a origem dos 157 modelos e das texturas; sem procedência por arquivo, nada entra.
- A estética. É sci-fi militar genérico; a nossa é industrial-orgânica em voxel, com a Fenda, o roubo e a diplomacia como assinatura.

---

## 5. Plano "v3.0 · 3.5D" (ordem de execução)

| Entrega | Conteúdo | Resultado visível |
|---|---|---|
| **3.0a Renderizador 3D no jogo** | Three.js ESM atual com WebGPU/WebGL2; câmera RTS (inclinação 50–65°, quatro orientações mais rotação livre com Alt, zoom); `InstancedMesh` por modelo e cor de jogador; terreno com relevo real a partir dos biomas e das cordilheiras; névoa de guerra projetada no terreno; seleção por raycast; sombras; dia e noite; HUD em DOM mantido; Canvas 2D mantido como fallback para celulares fracos | O jogo inteiro em 3D, com a mesma jogabilidade |
| **3.0b Efeitos** | Bloom, oclusão ambiente leve, névoa volumétrica na Fenda e na Tempestade, partículas em GPU, destroços, lagos de plasma com shader, decalques, presets de qualidade | O "visual incrível" |
| **3.0c Modelos e animação** | Pipeline voxel → glTF com LOD, esteiras e pernas animadas, portões, 12 unidades por facção, Tessara e Vael | Variedade e vida |
| **3.0d Multiplayer P2P** | Lockstep por código de sala (PeerJS ou Nostr), comandos assinados, checksums com Merkle, reconexão; simulação em Worker | Partidas entre amigos sem servidor |
| **3.0e Validação** | fps em três classes de aparelho, draw calls, tempo de carga, retenção e feedback dos testadores | Decisão sobre WebGPU como padrão e sobre o servidor autoritativo |

Comece-se por 3.0a: é a fundação e é o que já foi validado.

---

## 6. Revisão de 16 de outubro de 2026: pesquisa de bibliotecas e remasterização total (v4.3)

Pedido: remasterizar o jogo inteiro (unidades, soldados, líderes, bases, terreno, efeitos) no nível de um RTS estilizado moderno, de Supreme Commander 1 e 2 e de Starship Troopers: Terran Command, usando o potencial atual do Three.js. Versões e licenças conferidas no registro npm nesse dia.

### 6.1 A pesquisa recebida, item a item

| Item | No jogo em 16/10 | Veredito |
|---|---|---|
| Three.js (cena, câmera, WebGLRenderer) | r160 (dez/2023) | **Atualizado para o r186 (set/2026) na 4.3b.** O ecossistema atual exige versões novas: postprocessing pede three ≥ 0.168 e three.quarks ≥ 0.182 |
| Física (Rapier.js, Cannon-es) | Movimento próprio, determinístico, conferido em 4 motores de navegador | **Não na simulação.** RTS não usa corpo rígido; o lockstep do multiplayer e o replay dependem de resultado idêntico. O Rapier tem build determinístico, mas trocaria código que já funciona por ~1,5 MB de WASM. Destroços que rolam ficam na GPU |
| Blender → glTF/GLB + GLTFLoader | 193 malhas geradas em código (kit de primitivas) | **Híbrido.** O kit continua: 0 KB de download, cor por jogador, variações por semente, agentes modelando em paralelo. glTF entra como formato de saída (exportar para revisar no Blender) e de cache; o jogo passa a aceitar GLB por modelo quando houver um artista 3D. Blender por script Python, sem interface, fica como teste para os líderes |
| KTX2 / WebP | Imagens da página inicial em WebP; texturas do chão geradas no navegador | KTX2 quando o terreno ganhar texturas pintadas (4.3c) |
| InstancedMesh | Por modelo e jogador desde a 4.0d | Manter |
| LOD | Não havia | 4.3d, gerado automaticamente (meshoptimizer) |
| ECS | A simulação já separa dados (lista de entidades) e sistemas (funções por tick) | Não reescrever |
| Loop rAF + delta time | Simulação fixa a 10 Hz + desenho interpolado a cada quadro | Já é o modelo certo; simulação em Web Worker na 4.3i |
| HUD em HTML/CSS | Desde a 1.0 | Manter |
| OrbitControls | Câmera RTS própria (giro, inclinação, zoom com regras de jogo) | Não na partida; sim no Modo Foto (4.3j) |
| gltfjsx / React Three Fiber | — | Não se aplica: não usamos React |
| lil-gui | — | Só no modo de desenvolvimento, para ajustar luz, bruma e cor ao vivo |
| Vite | Build próprio em arquivo único (Pages + artefato) | Não agora: não muda nada para o jogador |
| gltf-transform / gltf-pipeline | — | Nas ferramentas, junto com o glTF |

### 6.2 Bibliotecas somadas ou previstas

| Biblioteca | Licença | Versão | Uso | Entrada |
|---|---|---|---|---|
| postprocessing (pmndrs) | Zlib | 6.39.5 | Junta bloom, tom, gradação e efeitos próprios em poucos passes de tela; bloom HDR por mipmaps; SMAA | 4.3b |
| N8AO | ISC | 2.0.1 | Sombra de contato (oclusão ambiente) de qualidade, em meia resolução no Média | 4.3b |
| meshoptimizer | MIT | 1.3.0 | LOD automático e compressão de malhas | 4.3d |
| three-mesh-bvh | MIT | 0.9.16 | Clique preciso no relevo alto; cálculo de sombra de cavidade nos modelos | 4.3c–4.3d |
| three.quarks | MIT | 0.17.1 | Sistema de efeitos, a comparar com o fx3d.js da 4.2c | **4.3g: avaliado e não adotado** (ver 6.5) |
| stats-gl | MIT | 4.2.3 | Medidor de GPU no modo de desenvolvimento | 4.3i |

### 6.3 O que já existia e é estendido (não é novo)

Animação por peça na GPU (rodas, esteiras, pernas, rotores, recuo e torres que miram: 4.2b), partículas na GPU com explosões em camadas e marcas de queimado (4.2c), adereços por bioma com vento e gradação de cor por clima (4.2d), detalhe de superfície procedural e microdetalhe do chão (4.3a). A remasterização leva tudo isso aos modelos e ao terreno novos.

### 6.4 WebGPU

O r186 já tem WebGPURenderer com volta automática para WebGL2. Os nossos materiais são remendos de shader GLSL (onBeforeCompile), que só existem no WebGL; migrar exige reescrever cada material em TSL. Fica para depois da remasterização, quando os materiais estiverem estáveis.

### 6.5 Combate (4.3g): three.quarks × fx3d.js

O three.quarks simula cada partícula na CPU a cada quadro. Numa batalha grande são 2 a 4 mil partículas vivas, na mesma CPU que roda a simulação, a IA e o render, e no celular isso pesa. O fx3d.js da 4.2c simula no shader: a CPU só escreve quando a partícula nasce. O que o three.quarks daria pronto (curvas ao longo da vida, subemissores, rastros em fita, turbulência, folhas de sprite) a 4.3g resolveu dentro do fx3d.js de forma analítica: arrasto, empuxo, balanço, pouso no chão, bola de fogo que vira fumaça, rastro marcado no arco conhecido, fumaça iluminada pela luz da cena e explosões em camadas por tamanho e por Raça. Trocar custaria ~150 KB, uma API nova, um programa de shader por sistema e a reintegração do tint por Raça, do mapa de clarões e da qualidade; as folhas de sprite pediriam texturas (a regra do projeto é tudo procedural). Decisão: manter o fx3d.js. Duas ideias do three.quarks ficam anotadas para depois: turbulência por ruído no vertex shader (fumaça que se enrola) e partículas suaves que desvanecem ao encostar na malha usando a profundidade da cena.

A 4.3g também trouxe o mapa de clarões: cada disparo, impacto, explosão, fogo e farol é um disco (ou cone) de luz pintado num alvo de 512² em meia precisão, visto de cima e centrado na câmera; o terreno e as malhas leem o mapa e somam a luz ao albedo, com compressão suave para muitos clarões juntos não estourarem. São centenas de luzes por quadro pelo custo de um passe pequeno e uma leitura de textura, no lugar das luzes reais do three (cada luz real a mais encarece todos os shaders).


### 6.6 Mapas e clima (4.3h): espaço, reflexo e volume sem biblioteca nova

Os três efeitos da 4.3h saíram com o three r186 e o pós-processamento que já usamos, sem biblioteca nova. O espaço do Cinturão é uma cena à parte desenhada num alvo próprio, com profundidade própria, e colada na cena do jogo na profundidade do céu: a bruma de altura do pós-processamento não pega nela (era o que deixava o vazio cinza) e o chão, as unidades e os efeitos desenham por cima normalmente. O reflexo do gelo é o do Reflector do three refeito à mão para caber no orçamento: um passe só por quadro, só com gelo na tela, câmera espelhada com plano de corte oblíquo (sem clippingPlanes, que criariam programas novos), alvo de meia resolução por eixo recortado ao retângulo do lago e o terreno trocado por um pedaço simplificado em volta do lago; na qualidade Baixa e no celular o gelo reflete o céu. A tempestade é um volume por marcha de raio curta num RawShaderMaterial (ruído 3D periódico gerado na CPU em fatias nos primeiros quadros), com passos pela qualidade e os 4 programas compilados no carregamento. Os três usam o mapa de clarões da 4.3g para iluminar o chão e as unidades sem luz de verdade.

### 6.7 Desempenho (4.3i): o que a medição mudou no plano

O plano previa a simulação num Web Worker e as malhas guardadas no navegador. Antes de mexer, medimos (Node e Chromium, mesma semente):

- **Simulação.** No Teste de desempenho ela custa 0,4 ms por passo; numa partida grande (4 IAs, ~430 unidades) custava 2,9 ms em média, 10 ms no percentil 95 e picos de 20 a 130 ms. Dois terços do tempo estavam em três lugares: a visão dos jogadores (cada inimigo testava todos os sensores do jogador, 40% do tempo), a procura de alvo de quem está parado ou avançando (varria 25 células por unidade a cada passo) e o campo de caminhos (um exército grande chegando às vagas passava das 96 rotas guardadas e refazia o mesmo cálculo a cada passo). Os três foram reescritos com resultado idêntico, conferido hash a hash em cinco partidas inteiras (Fenda e Cinturão, 2 a 5 jogadores) e entre Node, Chromium, Firefox e WebKit: visão por baldes de 200 unidades, contagem por célula de quem cada jogador vê (a busca pula quando o alcance está vazio), filas fixas no Dijkstra e 256 rotas guardadas. Resultado: ~1,8 ms por passo em média e percentil 95 de 5,5 ms. O Worker exigiria copiar o estado inteiro da partida para a tela 10 vezes por segundo e mexer no lockstep do multijogador; com a simulação nesse custo, não compensa agora.
- **Malhas guardadas.** Cada Raça gera de 46 a 79 MB de vértices (modelo completo e versão leve). Guardar isso no navegador por partida pesaria mais do que gerar de novo; o Teste de desempenho passou a mostrar o tempo de carregamento por etapa (terreno, modelos, shaders) para decidir com números dos aparelhos reais.
- **Travadas da primeira vez.** O pior quadro (517 ms) e os piores 1% (6 fps) do primeiro teste no Windows vieram da compilação de shaders no meio da partida (D3D11). A tela de carregamento agora cria antes tudo o que só nasceria depois (cada unidade e construção das Raças em jogo, ruínas, obras, bandeiras, fantasma de obra), compila em paralelo (KHR_parallel_shader_compile) e usa cada programa uma vez: no teste, nenhum shader compila durante a partida (antes eram 12).
- **Quadro.** Malha sem instância saiu do desenho e da sombra; os buffers de instâncias sobem só no trecho usado; névoa de guerra e território passaram a ser refeitos no passo da simulação (10 por segundo) e não a cada quadro; o radar redesenha a 30 por segundo; resolução dinâmica em degraus de 10% para manter ~60 fps (mínimo 67% no computador e 55% no celular).

### 6.8 Carregamento (4.3l): compilação em paralelo

Os números do dono depois da 4.3i (RTX 1000 no Chrome: 60 fps estáveis no Ultra, nenhum shader no meio da partida) mostraram o custo que sobrou: 7 a 8,6 s de shaders no carregamento, um por vez. A 4.3l cria todos os programas de uma vez com `renderer.compileAsync` antes do primeiro quadro, com os objetos escondidos ligados, e só depois os usa: com `KHR_parallel_shader_compile` (Chrome no Windows) a placa compila vários ao mesmo tempo. Dois detalhes do three r186 decidem a variante: a chave do programa guarda a saída do alvo (linear, porque a cena desenha no alvo do pós) e a saída do renderer (sRGB). Prender o alvo do próprio pós durante a criação deixava a imagem toda branca; um alvo de 1×1 só durante a criação dá exatamente os mesmos 77 programas do caminho normal, sem tocar no pós. No SwiftShader, o primeiro uso dos programas caiu de 40 a 53 s para 3,4 s. Sem a extensão (SwiftShader e alguns navegadores), a criação usa `renderer.compile` direto: o resultado é o mesmo e o console fica sem o aviso do three. Se algo der errado numa placa, `?aquecer=seq` volta ao caminho antigo, um programa por vez.

### 6.9 Revalidação de 19/10/2026: o jogo vai para o WebGPU (Motor 5)

A §6.4 deixava o WebGPU para depois da remasterização. Com a 4.3 fechada, o dono pediu o 3D de alta fidelidade com o WebGPURenderer aplicado ao jogo inteiro. Revalidado no mesmo dia:

- **O three 0.186.1 (o mais novo publicado) já tem tudo em TSL:** RenderPipeline (o PostProcessing virou RenderPipeline no r183) com bloom, profundidade de campo, GTAO, SSR, SSGI, TRAA, TAAU, FSR1, godrays, outline, LUT, FXAA e SMAA; CSMShadowNode; SkyMesh com nuvens; compute por `instancedArray` e `Fn().compute()`; marcha de raio e iluminação volumétrica. O pmndrs postprocessing e o N8AO continuam só em WebGL e saem junto com o motor clássico.
- **Um código de shader para os dois motores.** O TSL gera WGSL para o WebGPU e GLSL para a reserva em WebGL2, que o próprio WebGPURenderer escolhe quando não há WebGPU. O WebGPU está no Chrome e no Edge (inclusive Android 12+), no Safari 26 e no Firefox 141 (Windows) e 145 (macOS ARM).
- **Prova:** `lab/motor5.html`, com os modelos do jogo (o mesmo `src/meshes.js`) em material TSL, SkyMesh com PMREM, CSM com filtro PCF (o WebGPURenderer não tem mais o PCFSoftShadowMap; a suavidade vem do raio do filtro), profundidade de campo, bloom e FXAA, partículas fluidas por compute, deslocamento orgânico, refração por `viewportSharedTexture`, som 3D (Web Audio) e câmera com GSAP. Funciona sem erro nem aviso nos dois motores no Chromium headless desta máquina (o adaptador WebGPU por software sai com `--enable-unsafe-webgpu --enable-features=Vulkan --use-vulkan=swiftshader --use-webgpu-adapter=swiftshader`, em contexto seguro: `file://` serve).
- **Duas armadilhas do r186 vistas no laboratório:** o `PMREMGenerator.fromSceneAsync()` está obsoleto (depois do `await renderer.init()`, o `fromScene()` basta), e o `src/meshes.js` precisa do `window.THREE` apontando para o build WebGPU antes da primeira construção.
- **Decisão:** a v5.0 começa pela migração (5.0a, ver docs/plano-v5.md §7), com o motor clássico como reserva até a paridade. O Motor 5 vira padrão aparelho a aparelho, onde medir igual ou melhor.
