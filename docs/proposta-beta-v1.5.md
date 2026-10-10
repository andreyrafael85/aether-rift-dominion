# AETHER RIFT: DOMINION — Avaliação do beta 0.1 e proposta para o beta v1.5 / v2.0
### 10 de outubro de 2026

> Prova de conceito visual publicada: https://claude.ai/artifact/Lb1VS9n78yLq8W5t9cPfrq (toggle Noite e Grade). Capturas em `aether-rift-capturas/`.

---

## 0. Veredito sobre o beta 0.1

Você tem razão. O beta 0.1 acerta nos **sistemas** e falha na **sensação**. Ele foi construído em um dia para provar que energia dinâmica, roubo, contras, névoa e diplomacia funcionam juntos; e funcionam. Mas o que o jogador vê é geometria plana com brilho, e isso lê como "Atari" por cinco motivos concretos:

| Problema | Por que acontece | Efeito no jogador |
|---|---|---|
| Unidades e prédios são formas sem volume, sem direção, sem material | Não havia assets; desenhei símbolos | Não se distingue um tanque de uma caixa; nada parece "coisa" |
| Nada se move além de deslizar | Sem animação de esteira, perna, torre, hélice | O mundo parece estático mesmo em combate |
| O terreno é um campo liso com grade | Sem textura, relevo, destroços, rastros | O mapa não conta história nem guia o olho |
| Combate sem peso | Traçantes finos, sem flash, sem destroço persistente, sem som | Um ataque à base passa despercebido |
| Roubo invisível | O Sifão é uma linha tracejada | A mecânica central não gera o "momento clipável" |

O que vale a pena manter: a simulação determinística dirigida por comandos (base do multiplayer), a IA por comandos, o HUD e os fluxos (construção, diplomacia, alertas, dicas, tela final). Nada disso precisa ser refeito. O que muda é a camada de apresentação e a riqueza de conteúdo.

---

## 1. O que as referências de Command & Conquer ensinam (e o limite)

As cinco imagens têm em comum coisas que não dependem de orçamento de arte AAA:

1. **Isometria 2.5D com volume.** Tiberian Sun e Red Alert 2 são sprites pré-renderizados de modelos 3D (e voxels, no caso dos veículos de RA2), vistos de cima em 2:1. O volume vem da luz fixa, não de poligonagem.
2. **Base densa e legível.** Muros, portões, torres nos cantos, refinaria com tanques, usina com chaminé, tudo com silhueta própria e luzinhas. A base é um personagem.
3. **Economia visível.** Campos de cristal que brilham e se esgotam, coletores indo e voltando com carga visível.
4. **Combate com juice.** Flash de cano, traçantes, impactos, explosões com destroços, crateras e carcaças que ficam no mapa.
5. **Vida ambiente.** Fumaça de chaminé, holofotes, neve, trilhas de esteira, voz de sistema ("unidade pronta").
6. **Barra de construção lateral** com ícones de cada unidade: o jogador "vê" o catálogo o tempo todo.

**O limite:** a EA abriu o código de alguns C&C clássicos, mas **a arte e a marca continuam propriedade da EA**. Nada de sprites, nomes, cutscenes ou interface do C&C entra no jogo. O briefing original também pede que nenhum título clássico apareça no nome, lore, interface ou marketing. Usamos C&C como professor de linguagem visual, não como fonte de assets.

---

## 2. Direção visual proposta: "isométrico voxel-industrial"

Para ter riqueza de detalhe em dias e sem artista contratado, a proposta é **sprites voxel pré-renderizados no navegador**, exatamente o que a prova de conceito mostra:

- Cada unidade e prédio é um **modelo voxel** (cubinhos coloridos, estilo MagicaVoxel) definido em código ou importado de arquivo `.vox`.
- Ao carregar, o jogo **renderiza cada modelo em 16 direções** com luz direcional fixa, sombra projetada, faces escondidas descartadas e contorno sutil. Resultado: sprite sheet pronta, como os jogos de 1999 faziam no estúdio, só que gerada em 100–300 ms no cliente.
- **Estados de dano** vêm de graça por paleta (queimado, escurecido) e por remoção de voxels. **Cores de jogador** por troca de paleta. **Ícones da barra de construção** são o mesmo modelo renderizado em miniatura.
- **Terreno isométrico** em tiles 2:1 com textura procedural por bioma (gelo, rocha, placa metálica dentro da base), transições, decalques de rastro, crateras e carcaças que persistem.
- **Iluminação em duas camadas**: dia (luz fixa) e noite (escurecimento com holofotes, emissivos e brilho aditivo). Já funciona na prova de conceito.

Na prova de conceito, **tudo é gerado no navegador, sem nenhum asset externo**: 30 sprites em menos de 100 ms, 70 objetos, partículas, muros, raid com sifão, destroço em chamas e crateras.

![Dia](aether-rift-capturas/estilo-voxel-dia.png)
![Noite](aether-rift-capturas/estilo-voxel-noite.png)

Por que não pular direto para 3D (Three.js) ou pixel art pintada à mão:

| Caminho | Qualidade alcançável | Tempo até o v1.5 | Depende de |
|---|---|---|---|
| **Voxel pré-renderizado (proposto)** | Volume, luz, 16 direções, dano, animação por partes | Dias | Só código; artista opcional depois (MagicaVoxel é grátis) |
| Pixel art / sprites pintados | O visual RA2 "de verdade" | Semanas a meses | Artista 2D sênior, 8 direções × dano × animação por unidade |
| 3D em tempo real (Three.js) | O visual RA3 | Semanas | Modelos low-poly, technical artist, pipeline glTF/KTX2 (já no plano v2.0) |

O voxel não exclui os outros: um artista pode substituir modelo por modelo sem tocar no jogo, e o renderizador 3D do plano v2.0 pode consumir os mesmos modelos voxel como malhas.

---

## 3. Melhorias gráficas do v1.5 (lista de execução)

1. **Renderizador isométrico** substituindo o top-down: projeção 2:1, ordenação por profundidade, câmera com zoom suave e tremor em explosões.
2. **Terreno** com 3 biomas por mapa, transições, placas metálicas no território de cada base, Fenda como cratera brilhante com anel de plasma animado, nós de recurso como campos de cristal que diminuem ao esgotar.
3. **Modelos voxel de todas as unidades e prédios** das duas facções (lista na seção 4), 16 direções, 3 estados de dano, cor de jogador.
4. **Animação por partes**: esteiras e rodas, torres que giram para o alvo, pernas de mech, hélices de drone, caçamba do coletor enchendo, portão abrindo.
5. **Combate**: flash de cano, traçantes, impactos com faíscas, explosões com destroços voando, crateras, carcaças em chamas que ficam 60 s, infantaria caindo.
6. **Roubo visível**: mangueira de sifão pulsando, tanque do pirata enchendo, Rebocador com cabo puxando o coletor, Caixa caindo com paraquedas, alarme com luz vermelha girando na refinaria e sirene.
7. **Base viva**: fumaça de chaminé, holofotes à noite, janelas acesas, antenas piscando, fumaça preta em prédio danificado.
8. **Clima e ciclo**: dia e noite ao longo da partida (25 min = 2 ciclos), Tempestade de Éter com neve, vento e relâmpagos magenta.
9. **Interface**: barra de construção lateral com ícones renderizados dos modelos, retratos, minimapa com terreno real, cursor contextual (atacar, colher, sifonar), indicadores de dano flutuantes opcionais.
10. **Som**: efeitos sintetizados por WebAudio (tiros, explosões, sifão, alarme, construção) e voz de sistema "Arquivista da Maré" ("Unidade pronta", "Sifão detectado", "Pacto quebrado") via Web Speech API em pt-BR, com fallback em texto. Música ambiente em loop curto.

---

## 4. Melhorias de jogabilidade do v1.5

### 4.1 Elenco expandido (de 6 para 12 unidades por facção)

| Classe | Consórcio Vehnar | Erevane | Função |
|---|---|---|---|
| Infantaria | **Rebitador** (esquadrão de 4, implanta cobertura) | **Lâmina de Fenda** (esquadrão de 3, camuflada, emboscada 1,5×) | Antidrone, antissuporte |
| Infantaria pesada | **Soldador** (lança-chamas curto, forte vs infantaria) | **Atirador de Fenda** (longo alcance, frágil) | Especialistas |
| Veículo leve | **Tratorzão** (rápido, reconhecimento) | **Carroça Fantasma** (transporte camuflado para 2 esquadrões) | Mobilidade |
| Veículo pesado | **Prensa** (mech bípede de cerco, canhões duplos) | **Lâmina Rodante** (veículo baixo e rápido, hit and run) | Anti-infantaria, anti-estrutura |
| Drone | **Zepelim de Carga** (lento, lança drones) | **Mosquito** (enxame de 6, cega sensores) | Antiveículo, antissuporte |
| Suporte | **Guindaste Armado** (repara, recicla destroços) | **Âncora** (campo de estática móvel) | Utilidade |
| Hack | **Sabotador** (desliga torre por 6 s) | **Fantasma de Dados** (rouba 1 pesquisa ao tocar o Laboratório) | Anti-estrutura |
| Pirata | **Rebocador** (reboca coletor com cabo) | **Sifonador** (camuflado, +20%) | Roubo |
| Coletor | Coletor blindado | Coletor leve e rápido | Economia |
| Colosso (T3) | **Fundição Ambulante** (fabrica Rebitadores em campo) | **Eclipse** (apaga sensores em raio ao parar) | Virada de jogo |
| Comandante (opcional, v2) | Herói com 2 habilidades | Herói com 2 habilidades | Momento clipável |

Tessara entra no v1.5 com 8 unidades e **mutações visíveis**: cada Traço troca partes do modelo voxel (espinhos antiaéreos, placas, pernas extras). Vael fica para o v2.0.

### 4.2 Sistemas novos

- **Muros e portões** construíveis (barato, arrastar para desenhar), bloqueiam caminho e criam gargalos; portão abre para aliados. É o elemento visual e tático mais marcante das referências.
- **Esquadrões de infantaria**: uma unidade = 3 a 4 soldados que morrem um a um. Massa visual sem custo de micro.
- **Veterância**: Recruta, Veterano, Elite (chevrons), +10% por patente; Tessara ganha Traços pela veterância, o que une os dois sistemas.
- **Guardar e patrulhar**, parar, segurar posição; formações automáticas em cunha ou linha.
- **Carcaças recicláveis**: Guindaste Armado converte destroços em Minério (Vehnar), Erevane saqueia destroços inimigos.
- **Raids com roteiro**: alarme com atraso que depende da energia; luz vermelha e sirene; coletores fogem sozinhos para a Refinaria quando um pirata se aproxima; Rebocador precisa de 4 s de cabo e pode ser interrompido, e o coletor rebocado "grita" na rota inteira.
- **Anomalias visíveis**: Tempestade de Éter anunciada por nuvem no minimapa, Maré de Plasma fazendo os cristais pulsarem e render 3×.
- **Superarmas cinematográficas**: Fundição Orbital com sombra crescendo, impacto, onda de choque e tremor; Blecaute com onda EMP que apaga as luzes da base inimiga uma a uma.
- **IA mais viva**: batedor no início, recuo quando perde, defesa com prioridade a quem ataca a refinaria, provocações no chat de diplomacia ("Seu reator fumega. A gente vê."), roubo frequente e vingança após sifão.
- **Cenários de skirmish** com objetivo em vez de só sobreviver: "Roubo na Refinaria" (sifone 1.000 em 8 min), "Cerco" (segure a base por 10 min contra ondas), "Traição" (comece em pacto; quebre no momento certo).

### 4.3 O que fica para o v2.0

- **Multiplayer online** por relay de comandos (lockstep) em um servidor Node com WebSocket: a simulação já é determinística, então o servidor só ordena e repassa comandos. Serve para beta fechado; a versão autoritativa em Rust do plano vem depois, quando houver cheat para combater.
- Replays e botão Momento (clipe de 20 s), espectador.
- Concílio de Vael e Prole de Nhyr; campanha curta de 6 missões.
- Renderizador em PixiJS ou WebGL próprio para milhares de sprites a 60 fps no celular, assets de artista (voxel refinado ou 3D), trilha sonora.

---

## 5. Validação pré-game real (começa agora)

| Etapa | O que | Como medir |
|---|---|---|
| 1. Publicação pública | GitHub Pages com `index.html` (beta) e `estilo.html` (prova visual) | Link compartilhável; Issues abertas |
| 2. Grupo de teste | 10 a 30 amigos, 3 partidas cada (1v1 Fácil, FFA Normal, uma de roubo) | Formulário de feedback (modelo de Issue) |
| 3. Dados de partida | Botão "Copiar resultado" na tela final exporta um JSON com duração, recursos, roubos, pactos, minuto do primeiro ataque | Planilha simples; cruzar com o feedback |
| 4. Teste de visual | Enquete A/B: beta 0.1 vs prova de conceito voxel vs mockup de 3D | Preferência e "parece um jogo que você pagaria?" |
| 5. Critérios para seguir ao v2.0 | 60% voltam para uma segunda sessão; duração média acima de 12 min; roubo em mais de 50% das partidas; pelo menos 1 pacto por partida FFA | Se dois critérios falharem, ajustar o v1.5 antes do multiplayer |

---

## 6. Cronograma do que eu construo

| Entrega | Conteúdo | Sessões |
|---|---|---|
| **v1.5a** | Renderizador isométrico voxel, terreno, muros e portões, estados de dano, câmera | 2 |
| **v1.5b** | Combate com juice, roubo visível, base viva, dia e noite, clima, som e voz | 2 |
| **v1.5c** | Elenco de 12 por facção, esquadrões, veterância, guardar e patrulhar, Tessara com mutações, IA viva, cenários | 2 a 3 |
| **v1.5d** | Barra de construção lateral com ícones, minimapa real, exportação de resultado, polimento mobile | 1 |
| **v2.0** | Multiplayer por relay, replays, Vael, campanha | Após a validação |

Cada entrega é publicada no mesmo link e commitada no repositório, para os testadores sempre terem a versão mais nova.

---

## 7. Riscos desta direção

- **Desempenho no celular** com milhares de sprites e luz noturna: mitigação com cache de sprites, culling por tela, cap de partículas e modo "luz simples" automático.
- **Consistência de arte** entre modelos feitos em código: guia de estilo voxel (escala 1 voxel = 0,25 m, paleta por facção, 3 materiais) e revisão visual por captura automática a cada build.
- **Escopo do elenco**: 12 unidades por facção é muito; cada uma entra só com modelo, contra e função claros. Sem função nova, não entra.
- **Expectativa de "igual ao C&C"**: o voxel é uma estética própria. A meta do v1.5 é "parece um jogo", não "parece RA2". A meta de RA2 fica para artistas no v2.0.
