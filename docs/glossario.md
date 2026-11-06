# Glossário — Aether Rift: Dominion (5.0c "Idiomas")

Os termos do jogo em **português do Brasil (base)**, **inglês** e **espanhol neutro latino-americano (es-419)**, para o dono revisar.
Mudou um termo aqui? Ele muda nos dicionários (`src/i18n/en.js` e `src/i18n/es.js`) com busca e troca: as chaves não mudam.

**Regras gerais**
- Inglês: o de jogos de estratégia em tempo real (frases curtas e ativas, nomes de unidade e de construção com iniciais maiúsculas, botões no imperativo: *Build*, *Attack*, *Research*).
- Espanhol: neutro latino-americano. Trata o jogador por **tú** (como o *você* do pt-BR), nunca *vosotros* (o plural é *ustedes*); *computadora*, *celular*, *dron/drones*, *video*; sem gírias de um país só. Números no formato es-419 (1,250.5), como no México.
- Nomes próprios ficam iguais nos três idiomas (lista abaixo). Os nomes "descritivos" (Consórcio, Coro, Prole, Fundição…) são traduzidos, porque o jogador precisa entender o que são.
- A voz de cada Raça se mantém nas falas (ver "Vozes das Raças").
- **Concordância:** a Sylvia Oriel é uma líder. Tudo o que fala dela ou que ela fala de si concorda no feminino, também em espanhol (*la líder*, *lista*, *dispuesta*). O código escolhe a forma com `ARD.tg(chave, gênero)` quando o texto depende de quem fala.

## Ficam iguais
| Tipo | Termos |
|---|---|
| Jogo | Aether Rift: Dominion |
| Raças | Vehnar, Erevane, Tessara, Quorith, Vorag |
| Líderes | Barão-Forja, Vesper Ísk, Sylvia Oriel, Zayin Coral, Oru Voraz |
| Mundos | Kessari, Ísk, Oriel, Quor, Velk |
| Lugares e facções da IA com nome próprio | Oryn, Vey, Zayin, Oru, Vassi, Velk (dentro dos nomes traduzidos: *Oryn Consortium*, *Consorcio Oryn*) |
| Marcas e técnica | Motor 5 → *Engine 5* / *Motor 5* (é um nome de versão, mas a palavra "motor" é traduzida), WebGPU, WebGL2, Three.js, PeerJS, FPS, HUD |

Barão-Forja fica com o til e o hífen nos três idiomas: é o nome de guerra dele, como "Barão Vermelho". Vesper Ísk e o mundo Ísk ficam com o acento.

## O universo
| pt-BR | Inglês | Espanhol | Motivo |
|---|---|---|---|
| Fenda | Rift | la Grieta | proposta do dono; *Rift* é o nome do jogo; *Grieta* é a palavra comum em es para uma fenda aberta |
| Núcleo | Core | Núcleo | proposta do dono |
| Éter | Aether | Éter | proposta do dono; casa com o nome do jogo |
| O Grande Alinhamento | The Great Alignment | La Gran Alineación | |
| Domínio (pontuação e vitória) | Dominion | Dominio | o nome do jogo; "vitória por Domínio" → *Dominion victory* / *victoria por Dominio* |
| Raça | Race | Raza | o jogo fala em Raças desde a 4.0a |
| Comandante | Commander | Comandante | |
| Líder | Leader | Líder (la líder, para a Sylvia) | |
| Sala de Comando (a tela inicial em 3D) | War Room | Sala de Mando | *War Room* é o termo de estratégia; *Sala de Mando* é natural em es-419 |
| Academia de Comando (tutorial) | Command Academy | Academia de Mando | |
| Mesa tática | Tactical Table | Mesa Táctica | |

## As Raças
| pt-BR | Inglês | Espanhol |
|---|---|---|
| Consórcio Vehnar | Vehnar Consortium | Consorcio Vehnar |
| Erevane | Erevane | Erevane |
| Tessara | Tessara | Tessara |
| Coro Quorith | Quorith Choir | Coro Quorith |
| Prole Vorag | Vorag Brood | Prole Vorag |

## Recursos e economia
| pt-BR | Inglês | Espanhol | Motivo |
|---|---|---|---|
| Plasma | Plasma | Plasma | |
| Minério | Ore | Mineral | *Ore* é o padrão de RTS; *Mineral* é o termo comum de RTS em espanhol |
| Dados / Fragmentos de Dados | Data / Data Shards | Datos / Fragmentos de Datos | *Shards* deixa claro que é recurso físico |
| Energia | Energy | Energía | |
| Pleno · Racionado · Colapso (regimes) | Full · Rationed · Collapse | Pleno · Racionado · Colapso | uma palavra cada, cabem no medidor |
| Sobrecarga | Overcharge | Sobrecarga | |
| nó (de recurso) | node | nodo | |
| Veio de Minério | Ore Vein | Veta de Mineral | |
| Caixa (de recursos) | Crate | Caja | |
| Coletar / colher | Harvest | Recolectar | |
| Território | Territory | Territorio | |
| Comboio | Convoy | Convoy | |

## Construções
| pt-BR | Inglês | Espanhol | Motivo |
|---|---|---|---|
| Núcleo de Domínio | Dominion Core | Núcleo de Dominio | |
| Reator | Reactor | Reactor | |
| Câmara de Fusão (módulo) | Fusion Chamber | Cámara de Fusión | |
| Refinaria | Refinery | Refinería | |
| Quartel Orbital | Orbital Barracks | Cuartel Orbital | |
| Academia (módulo) | Academy | Academia | |
| Fábrica de Veículos | Vehicle Factory | Fábrica de Vehículos | |
| Hangar de Drones | Drone Hangar | Hangar de Drones | |
| Torre de Defesa | Defense Tower | Torre de Defensa | |
| Bateria Pesada (módulo) | Heavy Battery | Batería Pesada | |
| Nódulo de Avanço | Forward Outpost (Outpost) | Nódulo de Avance (Nódulo) | em inglês, *node* já é o nó de recurso; *Outpost* diz o que ele faz (amplia o território). Em espanhol *nodo* (recurso) e *nódulo* (construção) já são palavras diferentes, como no pt-BR |
| Laboratório | Laboratory (Lab) | Laboratorio | |
| Muro | Wall | Muro | |
| Portão | Gate | Portón | |
| Bastião | Bastion | Bastión | |

## Unidades
| pt-BR | Inglês | Espanhol | Motivo |
|---|---|---|---|
| Coletor | Harvester | Recolector | |
| Infantaria Orbital | Orbital Infantry | Infantería Orbital | |
| Veículo Pesado | Heavy Vehicle | Vehículo Pesado | |
| Drone Aéreo | Aerial Drone | Dron Aéreo | *dron* é a forma da RAE e a de es-419 |
| Suporte / Hack | Support / Hack | Soporte / Hack | |
| Pirata de Extração | Extraction Pirate | Pirata de Extracción | |
| Rebocador (Pirata Vehnar) | Hauler | Remolcador | lento e resistente, carrega o dobro |
| Sifonador (Pirata Erevane) | Siphoner | Sifonador | |
| Enxerto (Pirata Tessara) | Graft | Injerto | |
| Ressonador (Pirata Quorith) | Resonator | Resonador | |
| Afinador (Coletor Quorith) | Tuner | Afinador | |
| Carniceiro (Pirata Vorag) | Scavenger | Carroñero | ele devora carcaças: *scavenger* / *carroñero* dizem isso |
| Semeador (Coletor Vorag) | Sower | Sembrador | |
| Soldador | Welder | Soldador | |
| Guindaste Armado | Armed Crane | Grúa Armada | |
| Tratorzão | Big Rig | Tractorón | o aumentativo bem-humorado do pt-BR vira *Big Rig* e *Tractorón* |
| Prensa | Crusher | Prensa | *Press* soa fraco para um mech de cerco |
| Atirador de Fenda | Rift Sniper | Francotirador de la Grieta | |
| Lâmina Rodante | Rolling Blade | Hoja Rodante | |
| Mosquito | Mosquito | Mosquito | |
| Âncora | Anchor | Ancla | |
| Quimera | Chimera | Quimera | |
| Esporo-sentinela | Spore Sentinel | Espora Centinela | |
| Molde | Mold | Molde | casa com a tecnologia viva da Tessara |
| Colosso Cambiante | Shifting Colossus | Coloso Cambiante | |
| Voz | Voice | Voz | |
| Agulha | Needle | Aguja | |
| Diapasão | Tuning Fork | Diapasón | |
| Prisma | Prism | Prisma | |
| Monólito | Monolith | Monolito | |
| Harmônico | Harmonic | Armónico | |
| Cria | Broodling | Cría | |
| Cuspidor | Spitter | Escupidor | |
| Escaravelho | Scarab | Escarabajo | |
| Brutamonte | Brute | Brutamontes | *brutamontes* existe em espanhol com o mesmo sentido |
| Ferroada | Stinger | Aguijón | |
| Veterana (★) · Elite (★★) | Veteran · Elite | Veterana/o · Élite | |

## Chefões (épicos)
| pt-BR | Inglês | Espanhol |
|---|---|---|
| Catedral Errante | Wandering Cathedral | Catedral Errante |
| Matriarca | Matriarch | Matriarca |

## Eras, pesquisa e poderes
| pt-BR | Inglês | Espanhol |
|---|---|---|
| Era I — Fundação | Era I — Foundation | Era I — Fundación |
| Era II — Expansão | Era II — Expansion | Era II — Expansión |
| Era III — Domínio | Era III — Dominion | Era III — Dominio |
| Evoluir | Evolve | Evolucionar |
| Ascensão | Ascension | Ascensión |
| Pesquisa / Pesquisar | Research | Investigación / Investigar |
| Armamento · Blindagem · Sensores | Weaponry · Armor · Sensors | Armamento · Blindaje · Sensores |
| Superarma | Superweapon | Superarma |
| Fundição Orbital (Vehnar) | Orbital Foundry | Fundición Orbital |
| Blecaute (Erevane) | Blackout | Apagón |
| Salto Evolutivo (Tessara) | Evolutionary Leap | Salto Evolutivo |
| Uníssono (Quorith) | Unison | Unísono |
| Eclosão (Vorag) | Hatching | Eclosión |
| Revolução Industrial | Industrial Revolution | Revolución Industrial |
| Véu Total | Total Veil | Velo Total |
| Florescer | Bloom | Florecer |
| Coro Pleno | Full Choir | Coro Pleno |
| Fome Sem Fim | Endless Hunger | Hambre sin Fin |
| Salto de Núcleo | Core Jump | Salto de Núcleo |

## Mecânicas
| pt-BR | Inglês | Espanhol | Motivo |
|---|---|---|---|
| Sifão / sifonar | Siphon / siphon | Sifón / sifonar | |
| Pacto de Não-agressão | Non-Aggression Pact | Pacto de No Agresión | |
| Caução (do pacto) | Bond | Fianza | |
| Golpe de Traição | Betrayal Strike | Golpe de Traición | |
| Reputação | Reputation | Reputación | |
| Palavra de Ferro · Confiável · Neutro · Volátil · Traidor Conhecido | Iron Word · Trusted · Neutral · Volatile · Known Traitor | Palabra de Hierro · Confiable · Neutral · Volátil · Traidor Conocido | |
| Rastro (Erevane) | Trail | Rastro | |
| Camuflagem / camuflado | Cloak / cloaked | Camuflaje / camuflado | |
| Elo de Sincronia (Quorith) | Sync Link | Enlace de Sincronía | |
| Acorde (Quorith) | Chord | Acorde | |
| Traços (Tessara) | Traits | Rasgos | |
| Fotossíntese (Tessara) | Photosynthesis | Fotosíntesis | |
| Fome (Vorag) | Hunger | Hambre | |
| Devorar | Devour | Devorar | |
| Carcaça | Wreck (veículo) / carcass (criatura) | Restos | um termo só em es cobre os dois |
| Linhas de Montagem · Lotes · Fumaça (Vehnar) | Assembly Lines · Batches · Smoke | Líneas de Montaje · Lotes · Humo | |
| Atacar-mover | Attack-move | Atacar-mover | |
| Ponto de reunião | Rally point | Punto de reunión | |
| Roda de comandos | Command wheel | Rueda de órdenes | |
| Esquadrão | Squad | Escuadra | |

## Modos, dificuldades e mapas
| pt-BR | Inglês | Espanhol |
|---|---|---|
| Escaramuça | Skirmish | Escaramuza |
| Campanha | Campaign | Campaña |
| Multiplayer · sala · anfitrião | Multiplayer · lobby · host | Multijugador · sala · anfitrión |
| Fácil · Normal · Difícil · Brutal · Fenda | Easy · Normal · Hard · Brutal · Rift | Fácil · Normal · Difícil · Brutal · Grieta |
| Planície da Fenda | Rift Plains | Llanura de la Grieta |
| Cinturão | The Belt | El Cinturón |
| Missões de Identidade | Identity Missions | Misiones de Identidad |
| Prólogo · Ato | Prologue · Act | Prólogo · Acto |
| Relíquias · Conquistas · Hangar | Relics · Achievements · Hangar | Reliquias · Logros · Hangar |
| Modo Foto | Photo Mode | Modo Foto |
| Teste de desempenho | Benchmark | Prueba de rendimiento |
| Detetive de travadas | Stutter Detective | Detective de trabas |
| Voz do sistema | System voice | Voz del sistema |
| Ajustes | Settings | Ajustes |

## Interface (decididos na tradução)
| pt-BR | Inglês | Espanhol | Motivo |
|---|---|---|---|
| Construções (aba da Academia) | Buildings | Edificios | *Construcciones* não cabe na aba |
| Vida (atributo) | HP · Health | Vida | *HP* nos chips estreitos, *Health* nas dicas |
| Parados / ociosos (coletores) | idle | sin trabajo · inactivos | o botão do exército é estreito |
| Parar | Stop | Detener | |
| Caixa (seleção em caixa) | Box | Recuadro | em es, *caja* já é o caixote de recursos |
| Legendas | Subtitles | Subtítulos | |
| Onda (de ataque) | Wave | Oleada | |
| Abater | Kill | Eliminar | |
| Bônus | Bonus | Bono | |
| Código de backup | Backup code | Código de respaldo | |
| Salvar / salvamento | Save | Guardar / guardado | *salvar* em es é resgatar |
| Nv (nível) | Lv | Nv | |
| Eliminado (jogador) | eliminated | fuera de combate | em es, sem concordância de gênero com o nome da facção (*Fundición Kessari*) |
| Na tela (selecionar o que aparece) | On screen | En pantalla | |
| Tela (resolução da foto) | Screen | Pantalla | |
| Pesquisa (botão curto) | Research | Investigar | *Investigación* não cabe no centro da roda de comandos |

## Vozes das Raças (tom das falas)
| Líder | Tom em pt-BR | Como fica |
|---|---|---|
| Barão-Forja (Vehnar) | industrial, orgulhoso, prático; metáforas de forja e de fábrica | en: seco, de chão de fábrica (*The furnaces of Kessari are burning, commander*); es: directo y orgulloso (*Los hornos de Kessari están encendidos*) |
| Vesper Ísk (Erevane) | furtivo, frio, frases curtas e elegantes | en/es: o mesmo laconismo (*No one sees us coming. No one sees us leave.* / *Nadie nos ve llegar. Nadie nos ve partir.*) |
| Sylvia Oriel (Tessara) | calma e ameaçadora; crescimento, jardim, adubo | en/es: a mesma doçura com ameaça (*Oriel grows. And those who resist become compost.* / *Oriel crece. Y quien se resiste se vuelve abono.*); feminino em es |
| Zayin Coral (Quorith) | coral, fala em "nós", música (afinar, acorde, uníssono) | en/es: o plural do Coro e os termos musicais (*Get in tune, commander* / *Afínate, comandante*) |
| Oru Voraz (Vorag) | fome, frases curtas e brutas | en/es: curto e faminto (*The hunger of Velk never ends.* / *El hambre de Velk no tiene fin.*) |

**Alinhado com as amostras gravadas** (página de vozes, Kokoro): os termos Fenda, Núcleo, Éter, Coro, comandante e superarma, e as cinco saudações dos líderes em inglês e espanhol estão iguais ao texto já gravado. A exceção é o Zayin em espanhol: a amostra diz *Afínese* (usted), e o jogo usa *Afínate* (tú), como em todo o resto. Sugiro regravar essa fala com *Afínate, comandante.*

## O que fica em português
- O histórico das notas da versão (5.0a.3 para trás): é o registro de cada entrega; em inglês e espanhol, uma linha avisa que ele está em português.
- O nome do jogador e os nomes que o jogador digita.
- Os textos que o jogo manda para o GitHub no Feedback (o diagnóstico vai em português para o dono ler).
