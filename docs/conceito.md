# AETHER RIFT: DOMINION
### Documento de conceito · v0.1 · outubro de 2026

> RTS multiplayer online, browser-first (WebGPU/WebGL2 + WebAssembly, PWA para mobile e desktop).
> Rounds sazonais de 7–14 dias, sessões de 15–40 minutos. Construa, roube, negocie, traia.

---

## 0. Nome

**Escolhido: Aether Rift: Dominion.** Forma curta para lojas mobile e comunidade: **Rift Dominion** (sigla ARD).

Por quê: "Aether" é a substância cujo esgotamento causou o Colapso; "Rift" (a Fenda) é a cicatriz no centro de todo mapa; "Dominion" é o que o jogador constrói e perde. As três palavras aparecem na interface como mecânicas, não só como marca.

Variações guardadas: *Plasma Frontiers* passa a ser o nome da Temporada 1. *Nexus Raiders* foi descartado: genérico demais no mercado de 2026 e difícil de registrar.

---

## 1. Pitch

**Aether Rift: Dominion** é um RTS multiplayer online para navegador em que você comanda um Núcleo de Domínio, uma base móvel e expansível, entre as colônias orbitais e os planetas estilhaçados que sobraram do Colapso de Recursos Interestelares. Em rounds sazonais de 7 a 14 dias, jogados em sessões de 15 a 40 minutos, você constrói, expande, pesquisa e luta contra outros jogadores por três recursos escassos. Mas a tensão central não é a guerra: é o roubo. Piratas de Extração drenam refinarias, sequestram coletores e revendem o que roubaram num mercado interno, enquanto tratados, alianças e traições com bônus mecânicos (e custo de reputação persistente) transformam cada round em uma novela política jogada em tempo real. Cinco facções com filosofias opostas, um sistema de contras legível em cinco classes, energia dinâmica que pune a ganância e um ecossistema de cosméticos e Relíquias negociáveis entre jogadores completam um jogo desenhado para gerar clipes: a aliança que rompe a três minutos do fim, o sifão que ninguém viu, o Núcleo que salta para o outro lado do mapa.

---

## 2. Universo

**O Éter.** Durante dois séculos a civilização interestelar funcionou sobre o Éter, um plasma exótico que sustentava as hiperlinhas e fornecia energia quase gratuita. Ninguém mediu o estoque. No ano 0 do jogo, as hiperlinhas colapsaram em cascata; os planetas nas extremidades das linhas foram fraturados pelas marés gravitacionais. O que sobrou são aglomerados de fragmentos planetários e colônias orbitais girando em torno da **Fenda**, um rasgo no espaço que vaza plasma bruto em pulsos.

**Os Núcleos.** Cada colônia foi construída ao redor de um Núcleo de Domínio, uma estrutura autossuficiente projetada para 300 anos de isolamento. O problema é aritmético: há Éter residual para algumas dezenas de Núcleos. Existem milhares.

**As Marés.** A Fenda pulsa a cada 7–14 dias (um **Ciclo de Maré**), redistribuindo fragmentos e apagando posições. Esse é o round sazonal: o mapa reinicia, mas a **Linhagem** do jogador (conta, reputação, cosméticos, Relíquias) sobrevive. Lore e sistema dizem a mesma coisa: nada que você constrói dura; só o que você é.

---

## 3. Facções

| Facção | Filosofia | Fantasia de jogo | Força | Fraqueza |
|---|---|---|---|---|
| **Consórcio Vehnar** | Eficiência industrial | Rolo compressor que nunca para de produzir | Melhor valor de exército no late game | Lenta, barulhenta, rígida; vulnerável a hack |
| **Erevane** | Furtividade e roubo | Ninguém sabe onde você está nem o que já levou | Melhor em FFA e caos; recursos roubados são limpos | Menor HP; não segura terreno; fraca em 1v1 simétrico |
| **Tessara** | Tecnologia adaptativa | Lê o adversário e muta para vencê-lo | Flexibilidade total; escala com informação | Pior início; faminta por Fragmentos de Dados |
| **Concílio de Vael** | Alianças e buffs | O aliado que todo mundo quer e teme perder | Mais forte em 2v2 e alianças; melhor defesa | Sozinha fica 15% abaixo da média; depende de lealdade alheia |
| **Prole de Nhyr** *(opcional, Temporada 2)* | Horda | Pressão constante, maré de corpos baratos | Controle de mapa mais rápido | Defesa péssima; unidades decaem longe do Ninho |

Filosofia de balanceamento: meta de taxa de vitória 47–53% em cada par de facções em 1v1; em FFA, o balanceamento vem também da dinâmica de reputação (quem está forte vira alvo diplomático).

### 3.1 Consórcio Vehnar

- **Lore.** O conglomerado de estaleiros que construiu os Núcleos. Acredita que o Colapso foi uma falha logística, e que logística o resolverá.
- **Visual.** Brutalismo metalúrgico. Cobre oxidado, aço escovado, fuligem, brilho laranja de forja. Silhuetas retangulares, chaminés, rebites visíveis. Unidades parecem caixas com esteiras.
- **Mecânica-assinatura: Linha de Montagem.** Fábricas conectadas por Trilhos formam Linhas; cada fábrica na linha dá +12% de velocidade à seguinte (máximo 4). **Lotes**: encomendar 5 unidades iguais custa o preço de 4,5. **Reserva de Fundição**: a produção nunca para; o excedente vira chassis pré-montados em silos (até 20) que são implantados instantaneamente quando necessário, uma explosão defensiva de emergência.
- **Base.** Grade rígida; toda estrutura precisa tocar um Trilho. Expande devagar, mas cada expansão é uma fortaleza.
- **Energia.** Maior consumidora do jogo. Reatores a Carvão de Plasma são baratos mas emitem **Fumaça**: a base Vehnar é visível a longa distância no mapa (legibilidade e tensão).
- **Pirata de Extração: Rebocador.** Um rebocador pesado que arrasta fisicamente coletores inimigos. Lento, barulhento, muito difícil de parar.
- **Unidades únicas.** Prensa (caminhante pesado de cerco), Rebitador (infantaria que implanta cobertura), Guindaste Armado (suporte que repara e recicla destroços), Zepelim de Carga (transporte aéreo lento que carrega drones).
- **Árvore tech.** Metalurgia (armadura/HP) · Logística (produção/Trilhos) · Pirotecnia (cerco e dano em área).
- **Superarma: Fundição Orbital.** Após 90 s de canalização, derruba um Bastião pré-construído (bloco de fortaleza com duas torres) em qualquer ponto do território próprio. Recarga 12 min.
- **Perfil de jogador.** Macro; "a tartaruga que vira rolo compressor".

### 3.2 Erevane

- **Lore.** Clãs nômades de sucateiros do cinturão de destroços. Consideram propriedade uma condição temporária.
- **Visual.** Retalhos. Grafite, carvão e azul-petróleo com faixas amarelo-alerta roubadas de equipamentos alheios. Silhuetas angulares sob lonas e camuflagem; luzes só acendem ao atacar.
- **Mecânica-assinatura: Economia Parasita.** Recursos roubados chegam limpos (sem taxa de lavagem) e com +20% de rendimento. **Véu**: Nódulos de Avanço ficam camuflados até dispararem. **Rastro Falso**: pode plantar Nódulos-isca.
- **Base.** Dispersa, de silhueta baixa. Única facção cujo Núcleo pode saltar duas vezes por round, pela metade do custo.
- **Energia.** Painéis Dobráveis (silenciosos, baixa saída) complementados por energia drenada do inimigo via Sifonador.
- **Pirata de Extração: Sifonador.** Unidade camuflada que se acopla a uma refinaria ou reator inimigo e drena 35% do fluxo por 40 s. Se morrer carregado, a carga cai como uma **Caixa** que qualquer jogador pode pegar, criando brigas de três lados.
- **Unidades únicas.** Lâmina de Fenda (infantaria camuflada de assassinato), Mosquito (enxame de microdrones que cega sensores), Carroça Fantasma (transporte camuflado), Âncora (suporte que cria um Campo de Estática local: ninguém tem sensores dentro).
- **Árvore tech.** Furtividade · Sabotagem (hack) · Contrabando (mercado e roubo).
- **Superarma: Blecaute.** Por 20 s, sensores e energia inimigos em um raio de um quarto do mapa caem a zero; unidades Erevane ganham +30% de velocidade. Recarga 10 min.
- **Perfil de jogador.** Micro intenso, alto APM, gerador de clipes.

### 3.3 Tessara

- **Lore.** Ordem de pesquisa que fundiu biotecnologia e fabricação mecânica. Acredita que rigidez causou o Colapso e que adaptação é sobrevivência.
- **Visual.** Sci-fi orgânico. Cerâmica branco-osso, filamentos verde-musgo bioluminescentes, bronze. Formas curvas; cascos mudam de textura quando mutam.
- **Mecânica-assinatura: Evolução de Campo.** Cada unidade tem 1–2 slots de **Traço**. Traços são conquistados por exposição em combate (60 s acumulados lutando contra drones desbloqueiam "Espinhos Antiaéreos" para aquele tipo de unidade) ou comprados com Fragmentos de Dados. **Recombinação**: em um Laboratório, muda a classe de contra de um tipo de unidade uma vez por round (sua infantaria passa a bater em veículos). **Memória Genética**: traços persistem para o tipo de unidade pelo round inteiro.
- **Base.** Cresce em anéis ao redor do Núcleo; estruturas amadurecem em três estágios, ganhando atributos sem custo, só com tempo.
- **Energia.** Fotossíntese Artificial: energia gratuita que varia com a Maré de Plasma (forte na maré alta, fraca na baixa).
- **Pirata de Extração: Enxerto.** Infecta um coletor inimigo: ele continua trabalhando para o dono por 60 s, mas entrega 50% para você, sem alerta até ser descoberto por proximidade. Depois, converte-se por completo.
- **Unidades únicas.** Quimera (unidade-base movida a traços), Esporo-sentinela (drone barato com traço de sensor), Molde (suporte que aplica traços temporários a aliados), Colosso Cambiante (pesado T3 que troca de classe a cada 30 s).
- **Árvore tech.** Genoma (traços) · Metabolismo (economia/energia) · Simbiose (suporte).
- **Superarma: Salto Evolutivo.** Todas as unidades Tessara no raio mutam por 45 s para contrariar a classe inimiga mais numerosa à vista. Recarga 11 min.
- **Fraqueza visível.** Mutações são legíveis: o adversário vê a que você se adaptou.
- **Perfil de jogador.** Pensador; "lê o oponente e muda".

### 3.4 Concílio de Vael

- **Lore.** O corpo diplomático que tentou racionar o Éter e falhou. Sobreviveu porque todo mundo lhe devia algo.
- **Visual.** Catedral-estação. Alabastro, azul-índigo, dourado fosco. Halos e anéis; unidades levitam ligeiramente; luz difusa.
- **Mecânica-assinatura: Ressonância.** Unidades Vael e unidades aliadas próximas compartilham um pool de buffs (+8% dano, +8% velocidade), acumulando por número de aliados distintos (máximo 3). **Embaixada**: ao assinar um tratado, cria uma Rota Diplomática; ambos os lados ganham +5% de renda por parceiro e compartilham visão ao longo da rota. **Reparação**: se um pacto com Vael é quebrado, Vael recebe 90 s de Égide (escudo) e a posição do traidor é revelada por 60 s a todos os aliados de Vael.
- **Base.** Aberta, simétrica, com praças; Embaixadas nas fronteiras.
- **Energia.** Anéis de Condução: pode transmitir energia a aliados. Diplomacia energética: emprestar energia a um aliado em Colapso.
- **Pirata de Extração: Arrecadador.** Rouba 20% do fluxo, mas metade do roubado é automaticamente oferecida à vítima como **Proposta de Paz**. Se a vítima aceitar um tratado em 60 s, recebe a metade de volta e o pacto é assinado. Diplomacia por meio do roubo.
- **Unidades únicas.** Arauto (suporte com aura de buff), Guardião do Anel (pesado com escudo compartilhado), Emissário (infantaria que entra em base inimiga sob bandeira de trégua e revela), Órbita (drone que estende o alcance da Ressonância).
- **Árvore tech.** Diplomacia (bônus de tratado) · Égide (escudos) · Harmonia (buffs).
- **Superarma: Égide Compartilhada.** Domo de escudo sobre qualquer base aliada ou própria por 30 s, absorvendo todo o dano. Recarga 12 min.
- **Perfil de jogador.** O jogador social; o líder de aliança.

### 3.5 Prole de Nhyr *(opcional, Temporada 2)*

- **Lore.** Organismos bioengenheirados para minerar asteroides, abandonados no Colapso. Continuaram minerando. E multiplicando.
- **Visual.** Coral e porcelana. Branco-giz, rosa-pálido, laranja-coral; quitina perolada. Multidões de corpos pequenos. Não é gosma: é recife.
- **Mecânica-assinatura: Crescimento Exponencial.** Sem fábricas: Ninhos geram unidades continuamente a uma taxa que escala com o Minério próximo. **Decaimento**: unidades perdem 1% de HP por segundo quando longe de qualquer Ninho ou Nódulo; para lutar longe, é preciso expandir. **Devorar**: unidades consomem destroços e prédios destruídos como Minério.
- **Base.** Rastejante; Ninhos são produção e expansão ao mesmo tempo.
- **Energia.** Só os Ninhos consomem energia; as unidades não. Necessidade baixíssima, mas Ninhos são frágeis.
- **Pirata de Extração: Larva Ladra.** Enxame que leva um coletor pedaço a pedaço: o coletor perde capacidade em vez de ser capturado.
- **Unidades únicas.** Formiga-lança (básica), Besouro-cobertura (escudo vivo), Vespa (drone), Ceifador (cerco T3 quando amadurece).
- **Superarma: Enxame Total.** 30 s de geração 3x; depois, Ninhos entram em dormência por 60 s (risco real).
- **Perfil de jogador.** Agressivo; "pressão constante".

---

## 4. Economia, energia e roubo

### 4.1 Recursos

| Recurso | Uso | Onde aparece | Disputa |
|---|---|---|---|
| **Cristais de Plasma** | Combustível dos Reatores (energia) e das superarmas | Nós concentrados perto da Fenda (centro do mapa) | Alta |
| **Minério de Liga** | Estruturas e unidades | Distribuído amplamente | Baixa |
| **Fragmentos de Dados** | Pesquisa, Traços Tessara, upgrades raros, forja de Relíquias | Nós raros dentro de anomalias; salvamento de prédios destruídos | Máxima |

**Coleta.** Coletores operam de forma autônoma por padrão e podem ser microgerenciados para rotas alternativas. Carga bruta em trânsito é roubável por interceptação; estoque refinado só por Sifão. Refinarias convertem bruto em utilizável; são o alvo natural de todo pirata.

**Nódulos de Avanço.** Reclamam território: zona de construção, cobertura de sensores e posse dos nós de recursos dentro do raio. Nódulos capturados trocam de dono (incluindo os coletores que estiverem dentro).

**Salto de Núcleo.** O Núcleo Central pode ser realocado uma vez por round. Custo: 40% do estoque atual de cada recurso, 60 s de canalização visível a todos e 3 min de energia em Racionamento ao chegar. Caro o suficiente para ser uma jogada, barato o bastante para salvar uma sessão.

### 4.2 Energia dinâmica

Energia é uma **taxa**, não um estoque. Produção (Reatores queimando Plasma, coletores solares, fotossíntese) contra consumo (toda estrutura e unidade). A razão produção/consumo define o Regime:

| Regime | Razão | Efeitos |
|---|---|---|
| **Pleno** | ≥ 100% | Nenhum |
| **Racionado** | 70–99% | −25% velocidade de produção · −20% alcance de sensores · −10% eficácia de defesas |
| **Colapso** | < 70% | −50% produção · −40% sensores · escudos desligam · −35% defesas |

Ferramentas do jogador: **Prioridade de Energia** (ordenar Defesa, Produção e Sensores: um botão tático que decide o que sofre primeiro) e **Sobrecarga** (o Núcleo queima 200 Plasma para 60 s de +50% de energia; recarga 5 min). A tensão econômica fundamental: cada Cristal de Plasma é energia agora ou superarma depois.

### 4.3 Roubo de Recursos (mecânica central)

Três vetores:

1. **Interceptação de rota.** Emboscar coletores em trânsito. Resultado: capturar (o coletor vira seu e precisa ser escoltado até sua refinaria) ou destruir (a carga cai como Caixa).
2. **Sifão.** Unidade pirata se acopla a refinaria ou reator inimigo e drena parte do fluxo por um período. A vítima recebe o **Alerta de Sifão** com direção, com 3–5 s de atraso dependendo da energia dos sensores.
3. **Captura de Nódulo.** Tomar um Nódulo de Avanço inimigo leva o território e os coletores dentro dele.

Regras que mantêm o roubo tenso sem virar grief:

- **Recursos Marcados.** O que foi roubado fica marcado por 90 s. Se for gasto nesse tempo, a vítima recebe um **Rastro**: 5 s de revelação do local do gasto. Lavar no **Mercado Cinza** custa 15% e remove a marca. Erevane é imune.
- **Caixa.** Matar um pirata carregado derruba 100% da carga como Caixa que qualquer jogador pode pegar. Terceiros têm incentivo a aparecer.
- **Piso anti-grief.** Uma mesma vítima perde no máximo 30% da renda a cada 10 min para roubo; acima disso, sifões rendem 50%.
- **Recompensa.** Quem perdeu acima de um limiar no round pode colocar uma Recompensa pública no ladrão. Quem o matar carregado leva o prêmio.

### 4.4 Mercado interno

Livro de ofertas para os três recursos, trocas diretas entre jogadores, preços flutuando por oferta. Taxa da plataforma: 8% (Relíquias reduzem até 2 pontos). Mercado Cinza para Marcados. No mapa de round sazonal, trocas grandes são entregues fisicamente por caravanas entre Entrepostos, e caravanas são roubáveis.

---

## 5. Combate e táticas

### 5.1 Tabela de contras

Cinco classes, cada uma com exatamente duas vantagens e duas desvantagens. **Forte** = 1,5x dano (vence com custo-eficiência). **Fraco** = 0,65x. Espelho = neutro, decidido por micro, terreno e traços.

| Atacante ↓ · Alvo → | Infantaria Orbital | Veículos Pesados | Drones Aéreos | Estruturas Defensivas | Suporte / Hack |
|---|---|---|---|---|---|
| **Infantaria Orbital** | — | ▼ Fraco | ▲ Forte | ▼ Fraco | ▲ Forte |
| **Veículos Pesados** | ▲ Forte | — | ▼ Fraco | ▲ Forte | ▼ Fraco |
| **Drones Aéreos** | ▼ Fraco | ▲ Forte | — | ▼ Fraco | ▲ Forte |
| **Estruturas Defensivas** | ▲ Forte | ▼ Fraco | ▲ Forte | — | ▼ Fraco |
| **Suporte / Hack** | ▼ Fraco | ▲ Forte | ▼ Fraco | ▲ Forte | — |

Legibilidade visual (o jogador deve adivinhar o contra pela silhueta):

- Infantaria carrega lançadores antiaéreos e cerca unidades de suporte frágeis; morre para blindagem e torres.
- Veículos esmagam infantaria e sitiam torres; são lentos demais para drones e dependem de eletrônica hackeável.
- Drones mergulham em veículos de torre lenta e caçam suporte; caem para a flak da infantaria e para torres antiaéreas.
- Estruturas dominam infantaria e drones; não aguentam cerco de veículos e são desligadas por hack.
- Suporte/Hack desliga veículos e torres; é indefeso contra infantaria rápida e não consegue mirar no ar.

Piratas de Extração contam como Suporte/Hack e não atacam unidades de combate. Coletores são civis: fracos para tudo.

Um desvio por facção, para dar identidade sem quebrar a tabela:

- **Vehnar.** Estruturas Vehnar são neutras contra Veículos (blindagem de forja).
- **Erevane.** Infantaria camuflada ignora o Fraco contra Estruturas no primeiro ataque (emboscada).
- **Tessara.** Pode mover um "Forte" de classe via Recombinação, uma vez por round.
- **Vael.** Suporte Vael em Ressonância é neutro contra Infantaria.
- **Nhyr.** Infantaria Nhyr é extra-fraca a dano em área, mas Forte contra Estruturas isoladas (Devorar).

### 5.2 Névoa de guerra e sensores

Névoa dinâmica. Alcance de sensores depende de energia (ver Regimes). Detectores dedicados (torre ou unidade) revelam camuflagem em raio curto e consomem muita energia: detectar o Erevane custa a economia. Visão compartilhada só por tratado de Aliança ou Rota Diplomática Vael.

### 5.3 Anomalias ambientais

| Anomalia | Efeito | Ritmo |
|---|---|---|
| **Tempestade de Éter** | Drones perdem 50% de velocidade e sensores; nós de Plasma dentro rendem 2x | 90 s, a cada 6–8 min, posição anunciada 30 s antes |
| **Campo de Estática** | Ninguém tem sensores dentro; toda unidade conta como camuflada | Permanente em certos mapas; deriva lentamente |
| **Maré de Plasma** | Nós de Plasma rendem 3x; unidades dentro perdem 2% HP/s | 60 s, ciclo previsível |
| **Destroços Gravitacionais** | Reduz alcance de projéteis em 20%; choke natural | Fixo |
| **Eco de Hiperlinha** | Teleporte de mão única entre dois pontos, ativo por 20 s | A cada 5 min, par aleatório entre três |

### 5.4 Superarmas

| Facção | Superarma | Efeito | Custo | Recarga |
|---|---|---|---|---|
| Vehnar | Fundição Orbital | Bastião pré-construído cai em território próprio | 600 Minério · 300 Plasma · 90 s de canalização | 12 min |
| Erevane | Blecaute | Sensores e energia inimigos a zero num quarto do mapa por 20 s | 500 Plasma · 150 Dados | 10 min |
| Tessara | Salto Evolutivo | Unidades no raio mutam por 45 s para contrariar a classe inimiga mais numerosa | 400 Dados · 200 Plasma | 11 min |
| Vael | Égide Compartilhada | Domo de escudo sobre base própria ou aliada por 30 s | 450 Plasma · 150 Dados | 12 min |
| Nhyr | Enxame Total | Geração 3x por 30 s; depois Ninhos dormem 60 s | 500 Minério | 10 min |

Desbloqueio: pesquisa de Tier 3 (cerca de 14 min de jogo focado) ou drop de evento. Toda superarma tem anúncio visível ao alvo (3–5 s) para que exista contrajogada.

---

## 6. Diplomacia, alianças e traição

### 6.1 Tratados

| Tratado | O que faz | Custo / garantia |
|---|---|---|
| **Cessar-fogo** | 5 min sem dano entre os dois (ataques são bloqueados) | Grátis; só uma vez por par por round |
| **Não-agressão** | Duração escolhida (10–120 min); dano permitido mas quebra o pacto | Ambos depositam uma **Caução** (recursos) |
| **Comércio** | Câmbio travado entre os dois; rota de caravana protegida | Taxa de mercado zerada entre os dois |
| **Aliança** | Visão compartilhada; vitória compartilhada em modos de time; Ressonância Vael | Caução alta; máximo 3 aliados |
| **Testemunha** | Um terceiro jogador assina um tratado como fiador | Ganha 10% da Caução se o pacto for quebrado |

A **Sala de Negociação** é uma interface de contrato: termos, duração, Caução, testemunhas, tudo visível e assinado em tela. Chats: canal de facção, canal de aliança, canais privados, canal global do shard com limite de taxa.

### 6.2 Quebra de Pacto

Traição é uma jogada, não um bug social. Ao romper Não-agressão ou Aliança:

- O traidor recebe o **Golpe de Traição**: 45 s de +20% de dano e a base da vítima revelada.
- A Caução do traidor vai para a vítima.
- A **Reputação** do traidor cai um grau.
- O jogo gera um clipe automático "Traição" com câmera cinematográfica para ambos.

### 6.3 Reputação persistente

| Grau | Efeitos |
|---|---|
| **Palavra de Ferro** | Tratados custam 50% da Caução; matchmaking preferencial em modos de aliança; banner |
| **Confiável** | Tratados com Caução normal |
| **Neutro** | Padrão de conta nova |
| **Volátil** | Caução 2x; outros jogadores veem aviso ao negociar |
| **Traidor Conhecido** | Não pode assinar com Palavra de Ferro; mercado cobra +5%; **mas** roubo rende +10% e desbloqueia Contratos de Mercenário (recompensas NPC por sabotagem) |

A reputação decai lentamente em direção a Neutro entre rounds (um grau por round sem incidentes). Existe um caminho sombrio viável: ser Traidor Conhecido é um estilo de jogo, não uma punição.

---

## 7. Modos de jogo

### 7.1 Round sazonal (modo principal)

Shards de cerca de 120 jogadores por mapa, round de 10 dias (7–14 por temporada). Online, você joga RTS normal. Offline, sua base entra em **Dormência** após 10 min: produção a 50%, defesas +50%, pode ser sifonada mas não destruída.

Para destruir um Núcleo dormente é preciso declarar **Cerco**: um marcador visível com contagem regressiva de 8 h. O defensor e seus aliados são notificados (push via PWA). O cerco é quebrado se o Marcador de Cerco for destruído. Resultado: eventos agendados, clipáveis, que convocam alianças inteiras para um horário.

Pontuação final: **Domínio** (território × tempo) + Riqueza acumulada + ajuste por Reputação. Top 10 do shard recebe Relíquias; todos recebem XP de passe.

### 7.2 Skirmish

1v1, 2v2 e FFA de 6; 15–30 min. Vitória por destruição de Núcleo ou por pontos de Domínio aos 30 min (evita empates arrastados). Mapa padrão: Anel de Kessa.

### 7.3 Ranqueado

Ladder sazonal por facção, MMR oculto com divisões visíveis. Relíquias desativadas. Recompensas cosméticas por divisão.

### 7.4 Expedição (cooperativo)

Três jogadores contra a **Maré Negra**, uma ameaça ambiental que emerge da Fenda em ondas. Aparece em fins de semana; recompensa Fragmentos de Dados e cosméticos exclusivos.

### 7.5 Campanha leve

Doze missões de 10 min, um arco curto por facção. Ensina energia, roubo e diplomacia contra IA. Não obrigatória; recompensa títulos e um banner por facção concluída.

### 7.6 Loop de retenção

- **Contratos diários** (3): "sifone 400 Plasma", "assine um tratado com Testemunha", "sobreviva a um Cerco".
- **Decreto da Maré** (semanal): modificador global votado pelos jogadores, com peso de voto pela Reputação.
- **Fim de round**: distribuição de Relíquias, ranking público, galeria de clipes mais compartilhados do shard.

---

## 8. Loop de uma partida típica (0–30 min)

Skirmish FFA de 4 no Anel de Kessa, visto por um jogador **Erevane** contra Vehnar, Tessara e Vael.

| Minuto | O que acontece | O que o jogador sente |
|---|---|---|
| **0–2** | Núcleo ativo. Dois coletores de Minério, um de Plasma, um Painel Dobrável. Primeiro Nódulo de Avanço camuflado em direção ao anel interno. | Decisão imediata: Plasma para energia ou para guardar? |
| **2–5** | Refinaria. Segunda leva de coletores. Primeiro Sifonador em produção. A Fumaça Vehnar aparece no horizonte: já sabe onde um inimigo está. | Mapa começa a contar histórias. |
| **5–8** | Sifonador camuflado escolhe o alvo: a refinaria Vehnar está perto do Trilho principal. Primeiro contato: um Esporo-sentinela Tessara passa pela sua borda. | Tensão de ser visto antes de agir. |
| **8–12** | **Primeiro roubo.** Sifão acoplado: 40 s drenando 35% do fluxo Vehnar. O Vehnar recebe Alerta de Sifão e manda um Rebitador; você solta o Sifonador aos 31 s e foge. O roubo chega limpo e com +20%. | Pico de adrenalina; o primeiro clipe. |
| **12–16** | Vehnar, irritado, abre a Sala de Negociação com Vael: Não-agressão com Caução. Vael propõe a você Comércio (Plasma por Minério). Você aceita: energia barata e uma rota protegida. Tessara está quieta, acumulando Dados nos destroços. | Política emergente a 4 jogadores. |
| **16–22** | Vehnar completa Linha de Montagem de 3 fábricas e empurra Prensas contra Tessara. Tessara Recombina a infantaria para antiveículo e segura. Você aproveita a briga: Lâminas de Fenda matam dois coletores Vehnar; Caixas caem; Vael aparece e leva uma. | Terceiros lucram com guerras alheias. |
| **22–26** | **Traição.** Vael, em Palavra de Ferro, não quer trair. Mas Vehnar, vendo Tessara enfraquecida, quebra o pacto com Vael: Golpe de Traição, 45 s de +20% e Égide ativada em resposta. O shard vê o clipe automático. Vael pede sua ajuda via chat privado e você negocia Aliança com Caução alta. | Alianças nascem de traições. |
| **26–30** | Tier 3 para todos. Vehnar carrega Fundição Orbital; você gasta Blecaute na frente dele: 20 s sem sensores nem energia, suas Lâminas entram, o Bastião cai às cegas em território vazio. Aos 30 min, Vael vence por Domínio; você fica em segundo com a maior Riqueza do mapa. | Final decidido por timing, não só por exército. |

Como isso se estende no round sazonal: as mesmas batidas duram dias em vez de minutos. O primeiro roubo acontece na primeira sessão; a Sala de Negociação vira a vida social da semana; o Cerco é o evento marcado para sexta à noite; a traição acontece quando o fim de round está próximo e a Reputação custa menos do que a posição.

---

## 9. Monetização e economia de jogadores

### 9.1 Princípios

- **Nunca vendido:** dano, HP, velocidade, alcance, redução de recarga de superarma, custo de unidade ou recurso dentro da partida.
- **Vendido:** cosméticos, qualidade de vida fora da partida, aceleração de progressão de conta, prestígio.
- **Negociável entre jogadores:** cosméticos e Relíquias, com taxa da plataforma.
- **Ranqueado:** toda Relíquia desativada; só cosmético.

### 9.2 Battle Pass sazonal (Passe da Maré)

100 níveis em 10 dias de round + 4 dias de intervalo. Trilha gratuita com 30 itens; trilha premium com 70. Exemplos: skins de Núcleo, trilhas de luz de Sifão, efeitos de morte, banners animados, títulos, 2 slots de loadout (qualidade de vida), um emote de Traição por temporada.

### 9.3 Loja

Rotação semanal de cosméticos; bundles por facção; sem loot boxes com dinheiro real.

### 9.4 Marketplace entre jogadores

Taxa 8%. Listagens de 7 dias, histórico de preço público. Anti-RMT: negociação liberada após 10 h de jogo; itens novos têm 24 h de bloqueio; limite diário de valor por conta nova.

### 9.5 Núcleos Premium

Assinatura mensal com skin de Núcleo exclusiva, +25% XP de Passe, forja de Relíquias 30% mais rápida, 2 slots de loadout extras, replays ilimitados na nuvem e cor exclusiva de nome. Zero efeito dentro da partida.

### 9.6 Relíquias de Domínio

Itens únicos, de **cunhagem limitada** (50 a 500 unidades por tipo), forjados com Fragmentos de Dados e conquistas de round (top 10, vitória em Maré Negra, Palavra de Ferro por 3 rounds). Bônus menores, nunca de combate: desconto de taxa de mercado (máximo 2 pontos), slots de replay, revelação do nome de quem te roubou, decaimento de Reputação mais lento. Visual marcante no Núcleo e no banner. Negociáveis com taxa de 15%. Desativadas em ranqueado.

### 9.7 Exemplos de itens raros

| Item | Raridade | Como obter | Efeito | Negociável |
|---|---|---|---|---|
| Casco "Forja Afogada" (skin de Prensa Vehnar) | Épico | Passe T1, nível 60 | Visual + som de pistão | Sim, após a temporada |
| "Lanterna do Sifonador" | Raro | Loja sazonal | Trilha de luz ao drenar | Sim |
| Relíquia "Selo do Primeiro Pacto" | Relíquia, cunhagem 500 | Top 100 de Reputação na T1 | −2 pontos de taxa de mercado; banner animado | Sim (15%) |
| Relíquia "Coração da Maré" | Relíquia, cunhagem 50 | Vencedor de Maré Negra | Núcleo pulsa com a Fenda; +1 slot de replay; revela quem te roubou | Sim (15%) |
| Emote "Aperto de Mão Falso" | Lendário | Drop na Noite da Traição (1 por conta) | Emote que vira facada; feito para meme | Sim |
| Banner "Traidor Conhecido" | Evolui com o tempo | Manter o grau por 3 rounds | Visual | Não (conquista) |
| Efeito de morte "Dissolução Tessara" | Épico | Marketplace / drop raro | Unidades viram esporos ao morrer | Sim |
| Núcleo Premium "Linhagem Vael" | Premium | Assinatura | Ver 9.5 | Não |

---

## 10. Três conceitos de mapa

### 10.1 Anel de Kessa (skirmish padrão, 4–6 jogadores)

Anel de fragmentos ao redor de um gigante gasoso morto; a Fenda ocupa o centro com os únicos nós ricos de Plasma. Seis "pétalas" de início, cada uma com Minério suficiente e um Nódulo neutro. Rotas de coleta convergem para dentro: o roubo é geograficamente inevitável. Maré de Plasma a cada 4 min; dois pares de Eco de Hiperlinha ligam pétalas opostas. **Gancho:** quem segura o centro tem energia; quem rouba do centro tem tudo.

### 10.2 Estaleiro Afundado (1v1 e 2v2)

Uma megaestrutura Vehnar partida em três andares de passarelas. Drones têm caminhos livres entre camadas; unidades terrestres passam por três chokes de Destroços Gravitacionais. Fragmentos de Dados ficam em hangares derrelitos e precisam ser **salvados** (canalização de 20 s, vulnerável). Um Campo de Estática desliza pela espinha central. **Gancho:** mapa de informação; Tessara e hack brilham; cada hangar é uma emboscada em potencial.

### 10.3 Faixa Cinza (round sazonal, 120 jogadores)

Cinturão largo de destroços. Plasma escasso só na borda da Fenda, Minério abundante, Dados em anomalias móveis. No meio, o **Corredor de Comércio**: Entrepostos físicos onde trocas grandes do mercado são entregues por caravanas, roubáveis. Fronteiras de território visíveis; Campos de Estática derivam entre shards de jogadores. **Gancho:** mapa de diplomacia; a geografia força vizinhança, a vizinhança força tratados, tratados forçam traição.

---

## 11. Eventos sazonais virais

1. **Noite da Traição** (24 h). Caução 2x, Golpe de Traição dura 90 s, perda de Reputação pela metade. Clipes automáticos com selo do evento. O evento mais compartilhado do calendário.
2. **Maré Negra**. A ameaça cooperativa invade o mapa do round sazonal; inimigos jurados precisam defender o mesmo quadrante. Recompensa: Relíquia de cunhagem 50.
3. **Caçada ao Núcleo**. Recompensa pública sobre os 10 líderes do shard por 48 h; quem sifonar deles leva drop exclusivo. Os líderes recebem Égide gratuita uma vez.
4. **Mercado Aberto** (12 h). Taxa zero; preços enlouquecem; traders viram celebridades do shard.
5. **Ouro de Tolo**. Nós de Plasma passam a dropar Cristais Rastreados que revelam a base de quem os roubar. Jogo de gato e rato; Erevane sofre, e isso é conteúdo.
6. **Última Colônia**. FFA de 12 em 60 min onde a Fenda cresce e encolhe o mapa a cada 5 min. Um sobrevivente. Transmitido com câmera de espectador oficial.
7. **Semana do Embaixador**. Tratados sem Caução, Reparação dobrada. Onboarding social para contas novas.
8. **Salto Cego** (24 h). Salto de Núcleo pela metade do custo, destino aleatório. Caos puro, muito clipável.

**Infraestrutura de clipe.** Botão "Momento": gera clipe de 20 s com câmera cinematográfica a partir do replay determinístico, autotag (Traição, Sifão, Salto, Cerco, Última Chance) e link que abre o visualizador de replay no navegador sem instalar nada. Cada clipe compartilhado é uma porta de entrada.

---

## 12. Tom de voz e slogans

**Tom.** Direto, cúmplice, seco. Fala com o jogador como co-conspirador, nunca como herói. Humor de quem já foi roubado. Zero épico barato, zero "a guerra definitiva". Patch notes publicados dentro do universo como **Boletins da Maré**, assinados por um arquivista anônimo do Concílio.

**Tagline principal:** **"Nada aqui é seu. Ainda."**

**Slogans de campanha:**

- "Construa. Roube. Negocie. Traia. Repita em 10 dias."
- "O seu melhor aliado está lendo este slogan."
- "Toda refinaria é uma promessa. Toda promessa vaza."
- "A Fenda não escolhe lados. Você escolhe."
- "Sua base dura dez dias. Sua reputação, não."

---

## 13. Arte-chave

**Estilo.** Sci-fi industrial-orgânico. Duas famílias de material percorrem o jogo inteiro: o **forjado** (metal, rebite, solda, fuligem) e o **crescido** (cerâmica, coral, filamento, membrana). Toda facção mistura as duas em proporções diferentes; Vehnar quase só forjado, Nhyr quase só crescido.

**Iluminação.** Uma luz-chave quente vinda da Fenda (gradiente laranja-magenta) e um preenchimento frio azul-petróleo. Partículas de recurso visíveis: Plasma brilha, Minério faísca, Dados cintilam em grade. Feedback de combate em três camadas: acerto (flash), contra (ícone ▲/▼ flutuante por 0,5 s), morte (efeito de facção).

**Paleta global.** Interface em grafite (#1A1D22) e osso (#E8E2D6); acento Fenda em gradiente #FF5E3A → #B23CFF.

| Facção | Paleta |
|---|---|
| Vehnar | Cobre oxidado #B86B3A · Aço #7A7F85 · Fuligem #23201E · Forja #FF8C1A |
| Erevane | Grafite #2B2E33 · Azul-petróleo #1F4E5A · Amarelo-alerta #F2C230 |
| Tessara | Osso #EDE6D8 · Musgo luminoso #7FE3A1 · Bronze #9A6B3F |
| Vael | Alabastro #F4F1EA · Índigo #2E3A7C · Dourado fosco #C8A95A |
| Nhyr | Giz #F7F3EE · Rosa-pálido #F2B8B5 · Coral #FF7A59 |

**Moodboard (sem jogos).** Siderúrgicas abandonadas de Volta Redonda e do Vale do Ruhr; recifes brancos após branqueamento; fotografia de sondas espaciais com cor saturada; brutalismo soviético e naves de catedral gótica (Vael); mercados de sucata e roupa de trabalho militar surplus (Erevane); microscopia eletrônica de tecidos e cerâmica técnica (Tessara); cortes de formigueiro e colônias de coral (Nhyr); cartazes de propaganda industrial dos anos 1930 (Vehnar).

**Câmera e legibilidade.** Top-down a 55°, zoom limitado. Silhuetas de unidade legíveis a 32 px no mobile. Classe de contra reconhecível pela forma (infantaria vertical, veículo horizontal, drone com halo, torre com base, suporte com antena).

---

## 14. Técnica (2026)

- **Render.** WebGPU com fallback WebGL2; LOD agressivo; instancing para multidões Nhyr.
- **Simulação.** Núcleo em WebAssembly (Rust), determinístico. Skirmish em lockstep com rollback; round sazonal com servidor autoritativo e gerenciamento de interesse por quadrante (120 jogadores por shard, até 200 unidades por jogador).
- **Carga.** Primeiro frame jogável abaixo de 25 MB; assets por facção carregados sob demanda; replays de poucos KB (só inputs).
- **PWA.** Instalável; offline para replays, editor de loadout e Sala de Negociação assíncrona; notificações push para Cerco, tratado proposto e Alerta de Sifão em Dormência.
- **Touch.** Toque para selecionar, arrastar para caixa, menu radial para ordens, dois dedos para câmera, 6 "Fichas" de atalho configuráveis (grupos, Sobrecarga, Prioridade de Energia).
- **Espectador e replays.** Modo espectador com atraso de 90 s em ranqueado; replays compartilháveis por link e abertos no navegador.
- **Matchmaking.** MMR por facção, agrupamento por latência, preferências de modo e de Reputação em modos de aliança.

---

## 15. Riscos de design e caminho de protótipo

**Riscos e mitigações.**

- Roubo vira grief: piso de 30% por 10 min, Recompensa, Caixas que atraem terceiros.
- Aliança bola de neve: máximo 3 aliados, Ressonância com teto, Caçada ao Núcleo contra líderes.
- Vulnerabilidade offline: Dormência + Cerco com aviso de 8 h.
- Desempenho no navegador: limites de unidades, gerenciamento de interesse, Nhyr só após medição.
- RMT no marketplace: carência de conta, bloqueio de item novo, limite diário.

**Protótipo em quatro fases.**

1. **Núcleo de tensão (6 semanas).** Um mapa (Anel de Kessa), duas facções (Vehnar e Erevane), energia dinâmica, coletores, Sifão, Caixa, Alerta. Medir: roubos por minuto, taxa de contra-ataque após alerta, tempo até o primeiro clipe.
2. **Política (4 semanas).** Sala de Negociação, Caução, Golpe de Traição, Reputação em memória. Medir: tratados por partida, traições por partida, sentimento no chat.
3. **Facções 3 e 4 (6 semanas).** Tessara e Vael; tabela de contras completa; superarmas.
4. **Shard sazonal (8 semanas).** Faixa Cinza com 60 jogadores, Dormência, Cerco, PWA com push. Medir: retenção D1/D7, sessões por dia, clipes compartilhados por jogador.

---

*Aether Rift: Dominion · Documento de conceito v0.1 · "Nada aqui é seu. Ainda."*
