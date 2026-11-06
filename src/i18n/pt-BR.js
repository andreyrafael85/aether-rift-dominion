/* Aether Rift: Dominion — dicionário 5.0c: português do Brasil (base: o texto original do jogo). Chaves iguais nos três idiomas; {x} é trocado por ARD.t(chave, { x }).
   Um valor { one, other, many } é plural (Intl.PluralRules com vars.n). Gerado das partes da 5.0c; pode ser editado à mão. Glossário: docs/glossario.md */
(globalThis.ARD = globalThis.ARD || {}).I18N_DIC = globalThis.ARD.I18N_DIC || {};
globalThis.ARD.I18N_DIC['pt-BR'] = {
  /* dados */
  "unit.coletor.nome": "Coletor",
  "unit.coletor.desc": "Coleta automaticamente nós no seu território e entrega na Refinaria ou Núcleo mais próximo.",
  "unit.infantaria.nome": "Infantaria Orbital",
  "unit.infantaria.desc": "Forte vs Drones e Suporte. Fraca vs Veículos e Estruturas.",
  "unit.veiculo.nome": "Veículo Pesado",
  "unit.veiculo.desc": "Forte vs Infantaria e Estruturas. Fraco vs Drones e Suporte.",
  "unit.drone.nome": "Drone Aéreo",
  "unit.drone.desc": "Forte vs Veículos e Suporte. Fraco vs Infantaria e Estruturas. Sobrevoa a Fenda.",
  "unit.suporte.nome": "Suporte / Hack",
  "unit.suporte.desc": "Forte vs Veículos e Estruturas, e os atrasa. Fraco vs Infantaria e Drones.",
  "unit.pirata.nome": "Pirata de Extração",
  "unit.pirata.desc": "Sifona Refinarias e Reatores inimigos por até 40 s. Erevane: camuflado e +20% no roubo. Vehnar: Rebocador, lento e resistente, carrega 2x.",
  "unit.soldador.nome": "Soldador",
  "unit.soldador.desc": "Lança-chamas de curto alcance com dano em área. Devastador contra infantaria; fraco contra veículos.",
  "unit.guindaste.nome": "Guindaste Armado",
  "unit.guindaste.desc": "Sem armas. Repara unidades e estruturas suas por perto, continuamente.",
  "unit.tratorzao.nome": "Tratorzão",
  "unit.tratorzao.desc": "Veículo leve e rápido de reconhecimento, com sensores longos e metralhadora.",
  "unit.prensa.nome": "Prensa",
  "unit.prensa.desc": "Mech bípede de cerco: canhões duplos com grande área. Lento e caro.",
  "unit.atirador.nome": "Atirador de Fenda",
  "unit.atirador.desc": "Camuflado quando parado. Tiro longo e letal contra infantaria e suporte; quase inútil contra estruturas.",
  "unit.lamina.nome": "Lâmina Rodante",
  "unit.lamina.desc": "Veículo baixo e rápido de ataque corpo a corpo. Bata e fuja.",
  "unit.mosquito.nome": "Mosquito",
  "unit.mosquito.desc": "Microdrone barato e frágil. Em enxame, pica veículos e suporte.",
  "unit.ancora.nome": "Âncora",
  "unit.ancora.desc": "Sem armas. Campo de Estática: suas unidades a até 110 dela ficam camufladas.",
  "unit.quimera.nome": "Quimera",
  "unit.quimera.desc": "Infantaria adaptativa. Ganha Traços contra as classes que mais combate.",
  "unit.esporo.nome": "Esporo-sentinela",
  "unit.esporo.desc": "Drone de reconhecimento com sensores muito longos.",
  "unit.molde.nome": "Molde",
  "unit.molde.desc": "Sem armas. Suas unidades a até 100 dele causam +15% de dano.",
  "unit.colosso.nome": "Colosso Cambiante",
  "unit.colosso.desc": "Pesado de cerco com canhão de área. Ganha Traços como as outras unidades Tessara.",
  "unit.voz.nome": "Voz",
  "unit.voz.desc": "Pulso básico do Coro. Fraca sozinha; em acorde (Elo: +3,5% de dano e +2,5% de armadura por aliado Quorith a até 90, máx. 3) fica letal.",
  "unit.agulha.nome": "Agulha",
  "unit.agulha.desc": "Antiaérea: agulhas ressonantes que estilhaçam drones. Fraca contra veículos e estruturas.",
  "unit.diapasao.nome": "Diapasão",
  "unit.diapasao.desc": "Sem armas. Amplia o Elo: aliados a até 100 dele aceitam um quarto vizinho no acorde.",
  "unit.prisma.nome": "Prisma",
  "unit.prisma.desc": "Tanque refrator: concentra a onda do Coro num feixe de área.",
  "unit.monolito.nome": "Monólito",
  "unit.monolito.desc": "Cerco ressonante: onda lenta e longa que racha estruturas. Quase inútil contra drones.",
  "unit.harmonico.nome": "Harmônico",
  "unit.harmonico.desc": "Voador do Coro: acorde aéreo que persegue veículos e suporte.",
  "unit.cria.nome": "Cria",
  "unit.cria.desc": "Enxame corpo a corpo; eclode em pares. Fome: fora do seu território perde vida devagar (até 40%).",
  "unit.cuspidor.nome": "Cuspidor",
  "unit.cuspidor.desc": "Cospe ácido a média distância; corrói veículos e estruturas.",
  "unit.escaravelho.nome": "Escaravelho",
  "unit.escaravelho.desc": "Besta de carga blindada: investida rápida que atropela infantaria.",
  "unit.brutamonte.nome": "Brutamonte",
  "unit.brutamonte.desc": "Tanque biológico: carapaça grossa e golpe de área.",
  "unit.catedral.nome": "Catedral Errante",
  "unit.catedral.desc": "Épico do Coro: uma catedral de cristal que caminha cantando. Onda de ressonância em área.",
  "unit.matriarca.nome": "Matriarca",
  "unit.matriarca.desc": "Épica da Prole: a rainha que choca Crias sem parar.",
  "unit.ferroada.nome": "Ferroada",
  "unit.ferroada.desc": "Voadora barata com ferrão; em enxame, pica veículos e suporte.",
  "fac.vehnar.nome": "Consórcio Vehnar",
  "fac.vehnar.curto": "Vehnar",
  "fac.vehnar.lema": "Eficiência industrial. Linhas de Montagem, Lotes e Reatores que fumegam.",
  "fac.vehnar.super": "Fundição Orbital",
  "fac.vehnar.superDesc": "Derruba um Bastião pré-construído em território próprio (3 s). Custa 300 Dados + 200 Plasma.",
  "unit.pirata.nome.vehnar": "Rebocador",
  "fac.erevane.nome": "Erevane",
  "fac.erevane.curto": "Erevane",
  "fac.erevane.lema": "Furtividade e roubo. Nódulos camuflados, Sifonadores e recursos roubados limpos.",
  "fac.erevane.super": "Blecaute",
  "fac.erevane.superDesc": "Sensores e energia inimigos a zero por 20 s; suas unidades +30% de velocidade. Custa 300 Dados + 200 Plasma.",
  "unit.pirata.nome.erevane": "Sifonador",
  "fac.tessara.nome": "Tessara",
  "fac.tessara.curto": "Tessara",
  "fac.tessara.lema": "Tecnologia adaptativa. Unidades ganham Traços contra o que combatem, o Núcleo faz Fotossíntese e o Salto Evolutivo muda a batalha.",
  "fac.tessara.super": "Salto Evolutivo",
  "fac.tessara.superDesc": "Por 45 s, todas as suas unidades causam +35% de dano. Custa 300 Dados + 200 Plasma.",
  "unit.pirata.nome.tessara": "Enxerto",
  "fac.quorith.nome": "Coro Quorith",
  "fac.quorith.curto": "Quorith",
  "fac.quorith.lema": "Mente-colmeia de cristal ressonante. Vozes em sincronia: cada aliado perto afina o acorde (Elo), pactos custam metade e rendem o dobro.",
  "fac.quorith.super": "Uníssono",
  "fac.quorith.superDesc": "Por 20 s, todo o exército conta como acorde cheio (Elo máximo) e recebe 25% menos dano. Custa 300 Dados + 200 Plasma.",
  "unit.coletor.nome.quorith": "Afinador",
  "unit.pirata.nome.quorith": "Ressonador",
  "fac.vorag.nome": "Prole Vorag",
  "fac.vorag.curto": "Vorag",
  "fac.vorag.lema": "Enxame biológico voraz. Barato, rápido e sempre com fome: Crias eclodem em pares e o Carniceiro devora carcaças e Nódulos.",
  "fac.vorag.super": "Eclosão",
  "fac.vorag.superDesc": "Ovos irrompem num ponto visível e liberam 8 Crias por 30 s. Custa 300 Dados + 200 Plasma.",
  "unit.coletor.nome.vorag": "Semeador",
  "unit.pirata.nome.vorag": "Carniceiro",
  "bld.nucleo.nome": "Núcleo de Domínio",
  "bld.nucleo.desc": "Centro da colônia. Produz coletores. Se cair, você é eliminado.",
  "bld.reator.nome": "Reator",
  "bld.reator.desc": "+35 de energia queimando 0,3 Plasma/s. Vehnar: emite Fumaça visível a todos.",
  "bld.reator.mod.nome": "Câmara de Fusão",
  "bld.reator.mod.desc": "+60% de energia neste Reator, sem queimar mais Plasma.",
  "bld.refinaria.nome": "Refinaria",
  "bld.refinaria.desc": "Ponto de entrega perto dos nós. Alvo de Sifão.",
  "bld.quartel.nome": "Quartel Orbital",
  "bld.quartel.desc": "Produz Infantaria, Suporte/Hack e Piratas.",
  "bld.quartel.mod.nome": "Academia",
  "bld.quartel.mod.desc": "A infantaria deste Quartel já sai Veterana (★): +10% de dano e −7% de dano recebido.",
  "bld.fabrica.nome": "Fábrica de Veículos",
  "bld.fabrica.desc": "Produz Veículos Pesados.",
  "bld.hangar.nome": "Hangar de Drones",
  "bld.hangar.desc": "Produz Drones Aéreos.",
  "bld.torre.nome": "Torre de Defesa",
  "bld.torre.desc": "Forte vs Infantaria e Drones. Detecta camuflagem em 140.",
  "bld.torre.mod.nome": "Bateria Pesada",
  "bld.torre.mod.desc": "+40% de vida e +30% de dano nesta Torre.",
  "bld.nodulo.nome": "Nódulo de Avanço",
  "bld.nodulo.desc": "Reclama território em 320 e libera nós para coleta automática. Pode ser colocado até 650 de qualquer estrutura sua.",
  "bld.laboratorio.nome": "Laboratório",
  "bld.laboratorio.desc": "Pesquisas e superarma, pagas com Fragmentos de Dados.",
  "bld.muro.nome": "Muro",
  "bld.muro.desc": "Barreira barata. Arraste para desenhar uma linha. Bloqueia unidades e absorve tiros.",
  "bld.portao.nome": "Portão",
  "bld.portao.desc": "Trecho de muro que suas unidades atravessam. Inimigos precisam derrubá-lo.",
  "bld.bastiao.nome": "Bastião",
  "bld.bastiao.desc": "Fortaleza da Fundição Orbital.",
  "pesq.armamento.nome": "Armamento",
  "pesq.armamento.desc": "+15% de dano para todas as unidades e torres.",
  "pesq.blindagem.nome": "Blindagem",
  "pesq.blindagem.desc": "−13% de dano recebido por unidades e estruturas.",
  "pesq.sensores.nome": "Sensores",
  "pesq.sensores.desc": "+25% de alcance de sensores.",
  "era.1.nome": "Fundação",
  "era.1.desc": "Reator, Refinaria, Quartel, Torre, Nódulo e muros. Infantaria básica e Piratas.",
  "era.2.nome": "Expansão",
  "era.2.desc": "Libera Fábrica, Hangar e Laboratório, as unidades de meio de jogo, a Câmara de Fusão dos Reatores e a Academia do Quartel.",
  "era.3.nome": "Domínio",
  "era.3.desc": "Libera as unidades pesadas, a superarma, Armamento e Blindagem, a Bateria Pesada das Torres e a Ascensão da sua Raça.",
  "asc.vehnar.nome": "Revolução Industrial",
  "asc.vehnar.desc": "Produção 25% mais rápida e Reatores queimam 30% menos Plasma.",
  "asc.erevane.nome": "Véu Total",
  "asc.erevane.desc": "Unidades 15% mais rápidas, sensores +25% e superarma recarrega 30% mais rápido.",
  "asc.tessara.nome": "Florescer",
  "asc.tessara.desc": "Unidades se regeneram fora de combate (4 de vida/s) e a coleta rende 20% mais.",
  "asc.quorith.nome": "Coro Pleno",
  "asc.quorith.desc": "O Elo de Sincronia sobe até 5 aliados (antes 3) e a energia rende 15% mais.",
  "asc.vorag.nome": "Fome Sem Fim",
  "asc.vorag.desc": "Crias eclodem em trios e unidades se regeneram fora de combate (3 de vida/s).",
  "classe.inf": "Infantaria",
  "classe.vei": "Veículos",
  "classe.dro": "Drones",
  "classe.est": "Estruturas",
  "classe.sup": "Suporte/Hack",
  "classe.civ": "Civil",
  "regime.pleno": "Pleno",
  "regime.racionado": "Racionado",
  "regime.colapso": "Colapso",
  "rep.p0": "Neutro",
  "rep.p1": "Confiável",
  "rep.p2": "Palavra de Ferro",
  "rep.m1": "Volátil",
  "rep.m2": "Traidor Conhecido",
  "dif.facil": "Fácil",
  "dif.normal": "Normal",
  "dif.dificil": "Difícil",
  "dif.brutal": "Brutal",
  "mapa.fenda": "Planície da Fenda",
  "mapa.cinturao": "Cinturão",
  "dif.fenda": "Fenda",
  "res.plasma": "Plasma",
  "res.minerio": "Minério",
  "res.dados": "Dados",
  "res.dados.longo": "Fragmentos de Dados",
  "res.energia": "Energia",
  "ia.fundicao-kessari": "Fundição Kessari",
  "ia.consorcio-oryn": "Consórcio Oryn",
  "ia.estaleiro-vey": "Estaleiro Vey",
  "ia.cla-sombrio": "Clã Sombrio",
  "ia.naufragos-de-isk": "Náufragos de Ísk",
  "ia.corsarios-da-faixa": "Corsários da Faixa",
  "ia.linhagem-oriel": "Linhagem Oriel",
  "ia.ordem-do-molde": "Ordem do Molde",
  "ia.enxerto-vassi": "Enxerto Vassi",
  "ia.coro-de-zayin": "Coro de Zayin",
  "ia.acorde-setimo": "Acorde Sétimo",
  "ia.silencio-de-quor": "Silêncio de Quor",
  "ia.prole-velk": "Prole Velk",
  "ia.ninhada-cega": "Ninhada Cega",
  "ia.fome-de-oru": "Fome de Oru",
  "ia.voce": "Você",
  /* sim */
  "sim.pacto-cumprido": "Pacto cumprido com {nome}. Caução devolvida. Reputação ↑ ({rep})",
  "sim.pacto-com": "Pacto de Não-agressão com {nome} (10 min)",
  "sim.sifao-em": "ALERTA DE SIFÃO em {alvo}",
  "sim.era-chegou": "Era {era} — {nome}: {desc}",
  "sim.modulo-pronto": "{mod} pronta: {desc}",
  "sim.blecaute-ativo": "Blecaute ativo: inimigos cegos por 20 s",
  "sim.evoluindo": "Núcleo evoluindo para a Era {era} ({nome})",
  "sim.pesquisa": "Pesquisa concluída: {nome}",
  "sim.sobrecarga": "Sobrecarga: +50% de energia por 60 s",
  "sim.quebrou-voce": "Você quebrou o pacto: +20% de dano por 45 s. Reputação ↓ ({rep})",
  "sim.pacto-falhou": "Pacto falhou: Caução insuficiente",
  "sim.propoe": "{nome} propõe Não-agressão (10 min, Caução 150)",
  "sim.recusou": "{nome} recusou o pacto",
  "sim.quebrou": "{nome} QUEBROU O PACTO! Golpe de Traição ativo por 45 s",
  "sim.caixa-derrubada": "Caixa derrubada: {n} em recursos",
  "sim.caixa-recolhida": "Caixa recolhida: +{n}",
  "sim.traco": "Traço adquirido: {unidade} +25% contra {classe}",
  "sim.base-ataque": "Base sob ataque",
  "sim.nucleo-ataque": "NÚCLEO SOB ATAQUE!",
  "sim.tempestade-ativa": "Tempestade de Éter ativa: drones e sensores a 50%, Plasma 2× dentro dela",
  "sim.tempestade-vem": "Tempestade de Éter se aproximando ({n} s)",
  "sim.veio": "Veio de Minério exposto no meio do mapa",
  "sim.fundicao-vem": "Fundição Orbital a caminho",
  "sim.fundicao-ativou": "{nome} ativou Fundição Orbital!",
  "sim.blecaute-ativou": "{nome} ativou Blecaute! Sensores e energia a zero por 20 s",
  "sim.chegou-era": "{nome} chegou à Era {era}",
  "sim.eliminado-por": "{nome} foi eliminado por {outro}",
  "sim.eliminado": "{nome} foi eliminado",
  "sim.salto-concluido": "Salto de Núcleo concluído",
  "sim.saltou": "{nome} saltou o Núcleo!",
  "sim.ascensao": "Ascensão: {nome}. {desc}",
  "sim.ascensao-outro": "{nome} alcançou a Ascensão ({asc})!",
  "sim.eclosao": "Eclosão: 8 Crias por 30 s",
  "sim.eclosao-ativou": "{nome} ativou a Eclosão!",
  "sim.salto-evo": "Salto Evolutivo: +35% de dano por 45 s",
  "sim.salto-evo-ativou": "{nome} ativou o Salto Evolutivo!",
  "sim.salto-iniciado": "Salto de Núcleo iniciado (60 s)",
  "sim.salto-iniciou": "{nome} iniciou um Salto de Núcleo!",
  "sim.unissono": "Uníssono: acorde cheio e 25% menos dano por 20 s",
  "sim.unissono-ativou": "{nome} ativou o Uníssono!",
  "sim.carniceiro": "Carniceiro devorando seu Nódulo!",
  "sim.rastro": "Rastro: recursos roubados entregues na base de {nome}",
  "sim.fim-dominio-de": "Fim do Alinhamento: vitória por Domínio de {nome}.",
  "sim.fim-dominio": "Fim do Alinhamento: vitória por Domínio.",
  "sim.nucleo-destruido": "Seu Núcleo foi destruído.",
  "sim.tempo": "Tempo",
  "sim.todos-cairam": "Todos os Núcleos inimigos caíram.",
  "sim.ultimo-sobrevivente": "Último sobrevivente",
  "sim.ultimo-nucleo": "Último Núcleo de pé.",
  "sim.desconhecido": "Desconhecido",
  "sim.era-max": "Era máxima",
  "sim.evoluindo-curto": "Evoluindo",
  "sim.requer-era": "Requer Era {era} ({nome})",
  "sim.requer": "Requer {nome}",
  "sim.caucao-float": "Caução: {n} Minério",
  "sim.ponto-visivel": "Escolha um ponto visível",
  "sim.dados-insuf": "Fragmentos de Dados insuficientes",
  "sim.na-fila": "Na fila: cada unidade é paga quando começa a ser produzida",
  "sim.proposta-enviada": "Proposta enviada a {nome}",
  "sim.recursos-era": "Recursos insuficientes para a Era {era}",
  "sim.recursos": "Recursos insuficientes",
  "sim.requer-super": "Requer 300 Dados e 200 Plasma",
  "sim.requer-era3": "Requer Era III (Domínio)",
  "sim.sem-saltos": "Sem Saltos restantes",
  "sim.super-recarga": "Superarma em recarga",
  "sim.super-era3": "Superarma requer Era III (Domínio)",
  "sim.territorio-inimigo": "Território inimigo",
  "sim.fora-territorio": "Fora do seu território",
  "sim.sobrecarga-recarga": "Sobrecarga em recarga",
  "sim.requer-plasma": "Requer 200 Plasma",
  "sim.sem-no": "{n} sem nó livre por perto",
  "sim.nenhum-no": "Nenhum nó livre por perto: expanda com um Nódulo perto de um campo",
  "sim.dentro-fenda": "Dentro da Fenda",
  "sim.fora-mapa": "Fora do mapa",
  "sim.longe": "Longe demais das suas estruturas (650)",
  "sim.abismo": "Sobre o abismo",
  "sim.lago": "Sobre o lago",
  "sim.sobreposicao": "Sobreposição",
  "sim.float-caixa": "CAIXA +{n}",
  "sim.float-roubo": "ROUBO +{n}",
  "sim.col-caminho": {"one":"{n} coletor a caminho de {nos}","other":"{n} coletores a caminho de {nos}"},
  "pad.sub.nos": {"one":"{n} nó","other":"{n} nós"},
  "pad.sub.ou": "{a} ou {b}",
  "pad.net.nao-encontrada": "sala não encontrada (código errado ou anfitrião offline)",
  "pad.net.sem-sinal": "sem conexão com o servidor de sinalização",
  "pad.net.sinal-fora": "servidor de sinalização indisponível",
  "pad.net.sem-webrtc": "navegador sem WebRTC",
  "pad.net.codigo-uso": "código em uso",
  "pad.net.convidado-versao": "o convidado {nome} está com outra versão do jogo; peça para atualizar a página (Ctrl+F5)",
  "pad.net.build-em": "build diferente em {nome} ({a} × {b}); se algo falhar, Ctrl+F5 nos dois lados",
  "pad.net.build-host": "build diferente do anfitrião ({a} × {b}); se algo falhar, Ctrl+F5 nos dois lados",
  "pad.net.versao-host": "versão do jogo diferente da do anfitrião; atualizem a página (Ctrl+F5) nos dois lados",
  "pad.net.ficha": "ficha inválida",
  "pad.net.tempo-volta": "tempo de volta esgotado",
  "pad.net.versao": "versão diferente",
  "pad.net.lugar": "lugar ocupado",
  "pad.net.partida-indisp": "partida indisponível",
  "pad.net.peerjs": "PeerJS não carregou",
  "pad.voz.auto": "Automática",
  "pad.voz.br": "Português do Brasil",
  "pad.voz.outras": "Outras vozes em português",
  "pad.voz.neural": "neural do Edge",
  "pad.voz.apple-apr": "Apple aprimorada",
  "pad.voz.antiga": "antiga do Windows",
  "pad.voz.robotica": "robótica",
  "pad.voz.portugal": "Portugal",
  "pad.voz.falhou": "{voz} (falhou agora)",
  "pad.voz.indisp": "{voz} (indisponível agora)",
  "pad.voz.d-sem": "Este navegador não tem voz do sistema: as falas aparecem só nas legendas.",
  "pad.voz.d-nenhuma": "Nenhuma voz em português neste aparelho: as falas aparecem nas legendas.",
  "pad.voz.d-nenhuma-win": "Nenhuma voz em português neste aparelho: as falas aparecem nas legendas. No Windows, o Edge traz vozes neurais (Francisca, Antonio, Thalita).",
  "pad.voz.d-edge": "Vozes neurais do Edge: soam naturais e precisam de internet; sem rede, o jogo passa para a melhor voz do aparelho.",
  "pad.voz.d-google": "A voz do Google precisa de internet; sem rede, o jogo passa para a melhor voz do aparelho.",
  "pad.voz.d-ios": "No iPhone e no iPad: Ajustes › Acessibilidade › Conteúdo Falado › Vozes › Português (Brasil): baixe a Luciana ou o Felipe (Aprimorada) e recarregue o jogo.",
  "pad.voz.d-mac": "No Mac: Ajustes do Sistema › Acessibilidade › Conteúdo Falado › Vozes › Português (Brasil): baixe a Luciana ou o Felipe (Aprimorada) e recarregue o jogo.",
  "pad.voz.d-firefox": "O Firefox só enxerga as vozes antigas do Windows. Para uma voz natural, use o Edge (Francisca, Antonio, Thalita) ou o Chrome (Google português do Brasil).",
  "pad.voz.d-win": "Estas são as vozes antigas do Windows. O Edge traz vozes neurais (Francisca, Antonio, Thalita) e o Chrome, a Google português do Brasil.",
  "pad.voz.d-android": "No Android, a voz vem do mecanismo de texto para fala do aparelho (Ajustes › Acessibilidade › Saída de texto para fala).",
  "pad.bench.interrompido": "Teste interrompido",
  "pad.bench.interrompido-txt": "O jogo ficou pausado ou em segundo plano durante a medição. Rode de novo com a tela acesa e sem trocar de aba.",
  "pad.bench.otimo": "Ótimo",
  "pad.bench.bom": "Bom",
  "pad.bench.jogavel": "Jogável",
  "pad.bench.pesado": "Pesado",
  "pad.bench.otimo-d": "Pode subir a qualidade.",
  "pad.bench.bom-d": "Fluido para jogar.",
  "pad.bench.jogavel-d": "Se travar em batalhas grandes, desça um degrau de qualidade.",
  "pad.bench.pesado-d": "Use a qualidade Baixa ou o modo 2D neste aparelho.",
  "pad.bench.fps": "FPS médio",
  "pad.bench.p1": "Piores 1% dos quadros",
  "pad.bench.p5": "Piores 5% dos quadros",
  "pad.bench.pior": "Pior quadro",
  "pad.bench.travadas": "Travadas (> 50 ms)",
  "pad.bench.qualidade": "Qualidade",
  "pad.bench.res": "Resolução interna",
  "pad.bench.cpu": "CPU por quadro",
  "pad.bench.gpu": "GPU por quadro",
  "pad.bench.shaders": "Shaders compilados no teste",
  "pad.bench.carga": "Carregamento",
  "pad.bench.motor": "Motor",
  "pad.bench.classico": "Clássico",
  "pad.bench.gpu-poucos": "poucos quadros medidos ({n})",
  "pad.bench.gpu-nao": "não medido neste navegador",
  "pad.bench.de": "{n} de {n2}",
  "pad.bench.escala": "{res} (escala {e})",
  "pad.bench.pipes": "{n} (pipelines criados no {motor})",
  "pad.bench.auto": "auto → {q}",
  "pad.bench.q-baixa": "baixa",
  "pad.bench.q-media": "media",
  "pad.bench.q-alta": "alta",
  "pad.bench.det": "Detetive de travadas: os 5 piores quadros",
  "pad.bench.det-troca-res": "troca de resolução",
  "pad.bench.det-troca-q": "troca de qualidade",
  "pad.bench.det-gc": "coleta de lixo provável (−{mb} MB)",
  "pad.bench.det-aba": "aba em segundo plano",
  "pad.bench.det-folga": "CPU folgada: espera da GPU, do compositor ou do navegador",
  "pad.bench.det-eventos": "{n} eventos",
  "pad.bench.det-pipes": "{n} pipelines criados",
  "pad.bench.det-shaders": "{n} shaders compilados",
  "pad.bench.det-passos": {"one":"{n} passo da simulação","other":"{n} passos da simulação"},
  "pad.bench.laco": "Laço (Motor 5)",
  "pad.bench.depois": "Depois do quadro (estilo, layout, pintura)",
  "pad.bench.ritmo-livre-auto": "ritmo livre (automático)",
  "pad.bench.ritmo-contido-auto": "ritmo contido (automático)",
  "pad.bench.ritmo-livre-url": "ritmo livre (?ritmo=livre)",
  "pad.bench.ritmo-contido-url": "ritmo contido (?ritmo=contido)",
  "pad.bench.ts-on": "consultas de tempo ligadas",
  "pad.bench.ts-off": "consultas de tempo desligadas (?ts=0)",
  "pad.bench.ts-indisp": "consultas de tempo indisponíveis",
  "pad.bench.laco-raf": "laço requestAnimationFrame",
  "pad.bench.laco-anim": "laço setAnimationLoop (?laco=animloop)",
  "pad.bench.esperas": "{n} quadros esperando a GPU",
  "pad.bench.resposta": "resposta da GPU {ms} ms (máx. {n})",
  "pad.bench.det-depois": "depois do quadro {ms} ms (estilo, layout, pintura e envio do canvas)",
  "pad.sub.bench.cpu": "CPU {ms} ms (simulação {n}",
  "pad.sub.bench.desenho": "desenho {n})",
  "pad.sub.bench.sim": "simulação {n} ms",
  "pad.sub.bench.desenho2": "desenho {n} ms",
  "pad.sub.bench.carga-motor": "{n} s (motor {n2} s",
  "pad.sub.bench.carga-terreno0": "{n} s (terreno {n2} s",
  "pad.sub.bench.terreno": "terreno {n} s",
  "pad.sub.bench.modelos": "modelos {n} s",
  "pad.sub.bench.shaders-pipes": "shaders e pipelines {n} s)",
  "sim.eliminado-por-voce": "{nome} foi eliminado por Você",
  "pad.hud.territorio": "{res} do seu território acabou: mande os coletores a outro campo ou expanda com um Nódulo.",
  "pad.save.escaramuca": "Escaramuça",
  "pad.save.contra": {"one":"{raca} contra {n} IA","other":"{raca} contra {n} IAs"},
  "pad.save.de-jogo": "{t} de jogo",
  "pad.save.de-pe": "{n} adversário(s) de pé",
  "pad.save.campanha": "Campanha",
  /* inicio-html */
  "inicio.aether-rift-dominion": "Aether Rift<span>Dominion</span>",
  "inicio.nada-aqui-seu-ainda": "Nada aqui é seu. Ainda.",
  "inicio.versao": "Versão 5.0h · build __BUILD__ · Além da Fenda · Mundo vivo · multiplayer 2 a 4",
  "inicio.vitrine.escolha-sua-raca": "Escolha sua Raça",
  "inicio.vitrine.explorar-base": "Explorar a base",
  "inicio.vitrine.som-tela-inicial": "Som da tela inicial",
  "inicio.vitrine.escolha-sua-raca-teclas": "Escolha sua Raça <span>teclas 1 a 5</span>",
  "inicio.vitrine.racas": "Raças",
  "inicio.partida-interrompida": "Partida interrompida",
  "inicio.btn-resume": "Retomar",
  "inicio.btn-resume-drop": "Descartar",
  "inicio.modos-jogo": "Modos de jogo",
  "inicio.jogar": "Jogar",
  "inicio.campanha": "Campanha",
  "inicio.multiplayer": "Multiplayer",
  "inicio.ajustes": "Ajustes",
  "inicio.nome": "Nome",
  "inicio.jogar.escaramuca": "Escaramuça",
  "inicio.jogar.contra-ia-raca-escolhida": "contra a IA, com a Raça escolhida ao lado",
  "inicio.jogar.oponentes-ia": "Oponentes de IA",
  "inicio.jogar.1-ia-1v1": "1 IA (1v1)",
  "inicio.jogar.2-ias-ffa-3": "2 IAs (FFA 3)",
  "inicio.jogar.3-ias-ffa-4": "3 IAs (FFA 4)",
  "inicio.jogar.dificuldade": "Dificuldade",
  "inicio.jogar.facil": "Fácil",
  "inicio.jogar.normal": "Normal",
  "inicio.jogar.dificil": "Difícil",
  "inicio.jogar.brutal": "Brutal",
  "inicio.jogar.mapa": "Mapa",
  "inicio.jogar.planicie-fenda": "Planície da Fenda",
  "inicio.jogar.cinturao-plataformas-sobre-espaco": "Cinturão (plataformas sobre o espaço)",
  "inicio.jogar.mesa-tatica": "Mesa tática",
  "inicio.jogar.mesa-txt": "o mapa em holograma",
  "inicio.jogar.btn-mesa": "Ver na mesa",
  "inicio.jogar.semente-clima": "Semente e clima",
  "inicio.jogar.semente-mapa": "Semente do mapa",
  "inicio.jogar.clima-campo-efeito-dentro": "Clima do campo (efeito dentro da partida)",
  "inicio.jogar.automatico-pelo-bioma": "Automático (pelo bioma)",
  "inicio.jogar.nevoa-toxica": "Névoa tóxica",
  "inicio.jogar.tempestade-plasma": "Tempestade de plasma",
  "inicio.jogar.chuva-cristais": "Chuva de cristais",
  "inicio.jogar.aurora-fenda": "Aurora da Fenda",
  "inicio.jogar.chuva-acida": "Chuva ácida",
  "inicio.jogar.btn-start": "Iniciar partida",
  "inicio.jogar.btn-help-start": "Como jogar",
  "inicio.jogar.btn-academia": "Academia de Comando",
  "inicio.camp.camp-card-name": "Comandante",
  "inicio.camp.camp-card-lv": "Nv 1",
  "inicio.camp.camp-next-act": "O Grande Alinhamento",
  "inicio.camp.dificuldade-missao": "Dificuldade da missão",
  "inicio.camp.fenda-sem-pausa": "Fenda (sem pausa)",
  "inicio.camp.raca": "Raça",
  "inicio.camp.camp-race-note": "a escolhida ao lado",
  "inicio.camp.btn-camp-continue": "Continuar campanha",
  "inicio.camp.btn-campaign": "Todas as missões",
  "inicio.camp.btn-hangar": "Hangar",
  "inicio.multi.sala-entre-amigos": "Sala entre amigos",
  "inicio.multi.2-4-jogadores-humanos": "2 a 4 jogadores humanos, sem IAs",
  "inicio.multi.crie-sala-mande-codigo": "Crie a sala e mande o código, ou digite o código de um amigo e toque em Entrar.",
  "inicio.multi.tamanho-sala": "Tamanho da sala",
  "inicio.multi.2-jogadores-sala": "2 jogadores na sala",
  "inicio.multi.3-jogadores-sala": "3 jogadores na sala",
  "inicio.multi.4-jogadores-sala": "4 jogadores na sala",
  "inicio.multi.mapa-anfitriao-vale-sala": "Mapa (o do anfitrião vale para a sala)",
  "inicio.multi.btn-host": "Criar sala",
  "inicio.multi.codigo-sala": "Código da sala",
  "inicio.multi.btn-join": "Entrar",
  "inicio.multi.btn-mp-start": "Iniciar partida da sala",
  "ajustes.btn-bench": "Testar desempenho (30 s)",
  "ajustes.cfg-feedback": "Enviar feedback",
  "notas.notas-versao": "Notas da versão",
  "notas.5-0h": "<b>5.0h — Inteligência e mundo:</b> a IA ganhou a personalidade de cada líder: o Barão-Forja se fecha e chega pesado, Vesper Ísk ataca seus Coletores e abre uma segunda frente, Sylvia Oriel cresce e faz coalizões, Zayin Coral reúne o Coro antes de atacar e Oru Voraz vem com pressa. Ela desvia dos golpes anunciados, recua os feridos, fala com você pelo retrato e, como aliada, atende aos seus pedidos. Na Escaramuça e na sala, o <b>Mundo vivo</b> traz fauna da Fenda, Ruínas dos Construtores para capturar com infantaria, o Acampamento Corsário com mercenários pagos em Dados e o Surto de éter; os <b>Comandantes em campo</b> põem o avatar do seu líder na batalha, com três habilidades. Cada Raça ganhou duas construções únicas, e cinco construções oferecem dois módulos para escolher. A Cria e o Cuspidor da Vorag ficaram mais caros e um pouco mais fracos. Salas de versões anteriores não se conectam a esta.",
  "notas.5-0g-1": "<b>5.0g.1 — Ajustes:</b> trilha nova para a Vehnar, com sintetizador e pulso de máquina no lugar das batidas de martelo, e para a Vorag, com textura de enxame vivo no lugar do batuque. Na Caçada, o chefão agora dorme até ser atacado ou até a contagem na barra acabar (1:30 no Normal), e a arena ficou mais longe da base; o Arauto só golpeia dentro da arena. O salvamento no aparelho não trava mais quando o armazenamento do celular demora, e o rodapé de erro mostra a mensagem antes do lugar. No celular em pé, a dica do tutorial não fica mais atrás da barra do chefão.",
  "notas.5-0g": "<b>5.0g — Chefões:</b> chegaram O Arauto e A Forja-Mãe, cada um com três fases, ataques avisados no chão com antecedência e janelas em que fica vulnerável, e o mapa novo Destroço do Titã. Na aba Caçada você escolhe o chefão, a dificuldade e os aliados, sozinho ou com 2 a 4 amigos no cooperativo, e ganha medalha por tempo e perdas. Na escaramuça, os Eventos da Fenda são opcionais: Sentinela da Fenda, Caravana Corsária, Enxame Errante e chuva de meteoros, com recompensa para quem dá o golpe final. E os primeiros mutadores: Noite Eterna, Tempestades Frequentes e Recursos Escassos.",
  "notas.5-0f-1": "<b>5.0f.1 — Som de cinema:</b> a trilha agora é orquestral e de verdade: cada Raça tem os seus temas de paz, tensão e batalha, mais as faixas de chefão, de cinema, de superarma, de vitória e de derrota, com trocas no compasso. Disparos, impactos e explosões ganharam peso, montados em camadas a partir de gravações reais. A voz das unidades ao selecionar e dar ordens ficou no mesmo plano em todas as Raças, sempre clara por cima do ambiente e sem sobressaltar. Os arquivos chegam depois da carga; sem eles, o som gerado de antes continua. Créditos em Ajustes.",
  "notas.5-0f": "<b>5.0f — Som 3D e cinema:</b> cada som agora sai do seu lugar no mapa e acompanha a câmera, com som 3D para fone no computador; o que está longe perde o brilho, o que está sob a névoa de guerra soa abafado e cada bioma tem seu eco. Uma <b>trilha adaptativa</b>, gerada no próprio navegador, dá um tema a cada Raça e muda entre paz, tensão, batalha e chefão conforme a partida, e baixa quando alguém fala. Cliques e avisos têm o timbre da sua Raça. As 20 missões abrem com a <b>Sala de Guerra</b>: o mapa tático com as ameaças, a rota de ataque e os objetivos, e a câmera pousando na sua base. A superarma ganhou uma tomada curta do disparo, e os chefões, uma entrada de cinema. Tudo pode ser pulado (Esc, clique ou toque), e Ajustes tem volume de efeitos e de música, saída para fone ou caixas e as cenas de cinema.",
  "notas.5-0e": "<b>5.0e — Bases e unidades vivas:</b> com o <b>Motor 5</b> ligado, cada construção sobe no estilo da sua Raça: solda na Vehnar, trama de luz na Erevane, veias na Tessara, cristais no Quorith e bolhas na Vorag, com uma onda no chão ao concluir. Os destroços quicam no relevo e o entulho fica um tempo no chão; na Alta e na Ultra, o calor e a onda de choque das explosões distorcem o ar. A base ganhou vida: módulos visíveis nas construções, paredes que racham conforme a vida cai, condutos que pulsam com a energia (e piscam quando ela falta), trabalhadores andando entre os prédios e construções Tessara e Vorag que respiram. As unidades ganharam aro de seleção em holograma, barras de vida em segmentos que nenhuma névoa escurece, contorno na cor do time e estrelas de veterano que brilham na promoção; os materiais mostram desgaste nas bordas e a poeira do mapa na base das peças.",
  "notas.5-0d-1": "<b>5.0d.1 — Névoa leve e Firefox corrigido:</b> no Firefox, as nuvens de guerra da 5.0d deixavam a partida quase sem visibilidade na Alta, porque um shader que o Firefox recusava escurecia a tela. Está corrigido, e as nuvens viraram um véu claro e translúcido sobre o que nunca foi visto: o relevo continua legível, e o que está à vista nunca fica coberto. A névoa dos climas também ficou mais leve: unidades e construções continuam nítidas na névoa tóxica, na chuva e no celular. E o clima <b>Automático</b> agora acompanha o mapa, de leve: neve fina, chuva fina ou poeira na Planície da Fenda e cinza no Cinturão (da Média para cima).",
  "notas.5-0d": "<b>5.0d — Céu, clima e nuvens de guerra:</b> com o <b>Motor 5</b> ligado (Ajustes › Motor gráfico), o mundo ganhou vida. O sol anda no ciclo do dia, com nascer e pôr do sol, sombras que giram e, à noite, lua e estrelas; o reflexo do céu acompanha a hora. Na Alta e na Ultra, raios de sol atravessam a poeira e a Tempestade de Éter. O que nunca foi visto fica sob um banco de nuvens baixas, que se abre com a borda acesa quando as tropas chegam (da Média para cima). Os climas do campo (Jogar › Semente e clima) agora acontecem na placa de vídeo: neve de cristais que se acumula no chão e no alto das peças, neve fina e cortinas de luz na aurora, areia e cinza na tempestade de plasma, chuva com chão molhado e poças na chuva ácida, e bancos de névoa tóxica nos vales. E o chão guarda a batalha: crateras que afundam, mato queimado e pegadas na neve e na areia.",
  "notas.5-0c-2": "<b>5.0c.2 — Voz da Erevane e Sala mais rápida:</b> a Erevane ganhou um locutor masculino nos três idiomas. Os avisos, as eliminações e as respostas das unidades agora soam com corpo, sem perder o ar frio e o eco leve da Raça; a voz feminina fica só na Tessara, com a Sylvia Oriel. Na Sala de Comando, a saudação do líder sai logo depois da troca de Raça, sem esperar o navegador ficar livre: no Firefox, ela chegava a atrasar mais de dois segundos.",
  "notas.5-0c-1": "<b>5.0c.1 — Vozes gravadas:</b> o jogo agora fala com vozes gravadas nos três idiomas: uma voz para cada líder e para o locutor de cada Raça, com o caráter de cada mundo. São 766 falas por idioma: os avisos do locutor, as respostas das unidades ao selecionar, mover e atacar, as eliminações pelo nome, as reações do líder durante a partida e a campanha inteira falada, com a legenda e a boca do líder acompanhando cada palavra. Cada partida baixa só as falas da sua Raça, depois da carga. No iPhone, as falas saem pelo mesmo caminho dos efeitos. Em Ajustes, <b>Vozes gravadas</b> liga e desliga; sem elas, o jogo volta à voz do aparelho. Com o Motor 5, a partida prepara 22% menos shaders na carga e cada quadro gasta cerca de 14% menos CPU.",
  "notas.5-0c": "<b>5.0c — Idiomas:</b> o jogo inteiro agora sai em <b>inglês</b> e <b>espanhol</b>, além do português: tela inicial, Sala de Comando, partida, campanha, diplomacia, multiplayer, Modo Foto, ajuda e as falas da voz do sistema, que passam a usar uma voz do idioma escolhido. O jogo abre no idioma do navegador e troca na hora, sem recarregar, em <b>Idioma / Language / Idioma</b>: no alto da tela inicial, em Ajustes e na janela de Ajustes da partida. Também nesta versão: os planetas e o céu no alto da Sala de Comando ficaram nítidos: em repouso o fundo era desenhado em meia resolução e agora sai inteiro, com o detalhe dos planetas acompanhando o tamanho do pixel, e a Sala não perde mais resolução quando você troca de Raça; o locutor da partida fala no gênero do locutor da sua Raça (voz masculina no Vehnar, no Quorith e no Vorag; feminina na Erevane e na Tessara); com o Motor 5, a resolução dinâmica só baixa quando a placa de vídeo é o limite, o que evita as travadas da troca de resolução; e, no iPhone, o <b>Testar som</b> mostra uma dica quando os efeitos tocam e a voz não.",
  "notas.5-0b-1": "<b>5.0b.1 — Motor 5 mais leve, faróis e som no iPhone:</b> com o <b>Motor 5</b> ligado, os shaders que ele prepara na carga encolheram um terço (os lagos primeiro) e cada quadro manda muito menos dados para a placa de vídeo, o que alivia a CPU no Firefox e no celular. O brilho em volta das luzes agora é o mesmo do motor clássico, e no Modo Foto da qualidade Baixa os efeitos seguem a exposição como no clássico. À noite e dentro da Tempestade de Éter, os faróis dos veículos, coletores e piratas iluminam o chão à frente, nos dois motores. A Sala de Comando ficou um pouco mais clara, sem o clarão de antes. No iPhone, o som e a voz destravam no primeiro toque, tocam com a chave de silêncio ligada e voltam depois de uma ligação. Cada líder fala com uma voz do seu gênero em todo navegador. Em Ajustes, <b>Testar som</b> toca três notas e uma frase e mostra o estado do áudio do aparelho.",
  "notas.5-0b-motor-5": "<b>5.0b — Motor 5 completo, em teste:</b> com o <b>Motor 5</b> ligado (Ajustes › Motor gráfico), o jogo inteiro agora roda em WebGPU, com volta sozinha para WebGL2: unidades e construções com o detalhe de superfície e a animação de cada peça, ruínas, obras, o holograma da Erevane, os escudos do Uníssono e as bandeiras; o chão com todos os biomas, a vegetação ao vento, as estradas e o céu; explosões, fogo, fumaça e tiros; os lagos de plasma e de gelo com reflexo, o espaço do Cinturão e a Tempestade de Éter; e o <b>Modo Foto</b> (📷 ou tecla J) com desfoque, os 8 filtros e captura em 4K. Na primeira vez que o Modo Foto abre numa partida, ele leva alguns segundos para se preparar. Com tudo isso, a carga do Motor 5 ficou alguns segundos mais longa: a próxima versão mede nos aparelhos e enxuga. O motor clássico continua o padrão e não mudou.",
  "notas.historico-versoes-anteriores-5": "Histórico das versões anteriores (5.0g.1 → 2.0)",
  "inicio.rodape.aether-rift": "AETHER RIFT",
  "inicio.rodape.foot-termos": "Termos de Uso",
  "inicio.rodape.foot-priv": "Privacidade",
  "inicio.rodape.discord-breve": "Discord em breve",
  "inicio.rodape.aether-rift-dominion-versao": "Aether Rift Dominion — Versão 4.0 | Lançamento 2026 · Criado por Andrey Rafael · Feito no navegador, para o navegador.",
  "hud.html.recursos": "Recursos",
  "hud.html.plasma-variacao-minuto-nos": "Plasma · variação por minuto nos últimos 30 s",
  "hud.html.minerio-variacao-minuto-nos": "Minério · variação por minuto nos últimos 30 s",
  "hud.html.fragmentos-dados-variacao-minuto": "Fragmentos de Dados · variação por minuto nos últimos 30 s",
  "hud.html.energia-producao-consumo-pleno": "Energia: produção / consumo · Pleno a partir de 100%, Racionado de 70% a 99%, Colapso abaixo de 70%",
  "hud.html.energia": "Energia",
  "hud.html.e-regime": "Pleno",
  "hud.html.missao": "Missão",
  "hud.html.tempo-partida": "Tempo de partida",
  "hud.html.reputacao": "Reputação",
  "hud.html.rep": "Neutro",
  "hud.html.inimigos-ativos": "Inimigos ativos",
  "hud.html.coletores-parados-toque-manda": "Coletores parados: um toque manda todos aos nós livres mais próximos",
  "hud.html.mandar-coletores-parados-aos": "Mandar os coletores parados aos nós livres mais próximos",
  "hud.html.parados": "parados",
  "hud.html.tempo": "Tempo",
  "hud.html.velocidade-normal": "Velocidade normal",
  "hud.html.velocidade-2": "Velocidade 2×",
  "hud.html.velocidade-3": "Velocidade 3×",
  "hud.html.pausar": "Pausar",
  "hud.html.sistema": "Sistema",
  "hud.html.modo-foto": "Modo Foto",
  "hud.html.foto": "Foto",
  "hud.html.som": "Som",
  "hud.html.voz-sistema": "Voz",
  "hud.html.voz": "Voz",
  "hud.html.diplomacia": "Diplomacia",
  "hud.html.diplomacia-pactos-reputacao": "Diplomacia: pactos e reputação",
  "hud.html.pesquisa-eras": "Pesquisa e Eras",
  "hud.html.pesquisa": "Pesquisa",
  "hud.html.salvar-partida": "Salvar partida",
  "hud.html.salvar": "Salvar",
  "hud.html.ajustes-acessibilidade": "Ajustes de acessibilidade",
  "hud.html.ajustes-cores-escala-legendas": "Ajustes: cores, escala e legendas",
  "hud.html.ajuda": "Ajuda",
  "hud.html.ajuda-atalhos": "Ajuda e atalhos",
  "hud.html.sair": "Sair",
  "hud.html.sair-partida": "Sair da partida",
  "hud.html.leader-sub": "● em chamada",
  "hud.html.fechar-dicas": "Fechar dicas",
  "hud.html.sobrecarga-50-energia-60": "Sobrecarga: +50% de energia por 60 s",
  "hud.html.sobrecarga": "Sobrecarga",
  "hud.html.superarma-sua-raca-laboratorio": "Superarma da sua Raça (Laboratório e Era III)",
  "hud.html.superarma": "Superarma",
  "hud.html.nucleo": "Núcleo",
  "hud.html.exercito": "Exército",
  "hud.html.construir": "Construir",
  "hud.html.atacar": "Atacar",
  "hud.html.parar": "Parar",
  "hud.html.tela": "Na tela",
  "hud.html.caixa": "Caixa",
  "hud.html.girar-camera": "Girar câmera",
  "hud.html.girar": "Girar",
  "hud.html.inclinar-camera-pageup-pagedown": "Inclinar câmera (PageUp/PageDown ou Ctrl + rolagem)",
  "hud.html.inclinar": "Inclinar",
  "hud.html.limpar-selecao": "Limpar seleção",
  "hud.html.limpar": "Limpar",
  "hud.html.mensagem-enter": "Mensagem (Enter)",
  "hud.html.mp-wait": "Aguardando o outro jogador…",
  "hud.html.pb-ok": "✓ Construir aqui",
  "hud.html.ob-title": "Objetivos",
  "hud.html.pausado": "Pausado",
  "hud.html.pause-why": "Partida pausada.",
  "hud.html.pause-go": "Continuar",
  "hud.html.clique-qualquer-lugar-ou": "Clique em qualquer lugar, ou P / ❚❚",
  "hud.html.toque-qualquer-lugar": "Toque em qualquer lugar",
  "hud.html.prop-yes": "Aceitar pacto",
  "hud.html.prop-no": "Recusar",
  "carga.preparando-campo": "Preparando o campo",
  "carga.load-title": "Campo de batalha",
  "diplo.fechar": "Fechar",
  "fim.end-eyebrow": "Fim do Alinhamento",
  "fim.btn-next": "Próxima missão",
  "fim.btn-again": "Jogar de novo",
  "fim.btn-copy": "Copiar resultado (JSON)",
  "janela.ajustes.partida": "Partida",
  "janela.ajustes.voz-falas": "Voz das falas",
  "janela.ajustes.automatica": "Automática",
  "janela.ajustes.pt-voz-ouvir": "Ouvir",
  "janela.ajustes.voltar-ao-jogo": "Voltar ao jogo",
  "desempenho.teste-desempenho": "Teste de desempenho",
  "desempenho.bench-feedback": "Enviar no Feedback",
  "desempenho.bench-back": "Voltar ao início",
  "jogo.salvar.save-park": "Pausar e sair · continuar depois",
  "geral.confirmar.confirmar": "Confirmar",
  "geral.confirmar.confirm-no": "Cancelar",
  "termos.aether-rift-dominion-beta": "Aether Rift: Dominion é um beta gratuito, em testes. O jogo é fornecido como está, sem garantias. Não reutilize os assets em outros projetos sem autorização. Nas partidas multiplayer, somas de verificação detectam divergências; trapaças encerram a partida para todos. Problemas e sugestões: use o link de feedback.",
  "priv.politica-privacidade": "Política de Privacidade",
  "priv.jogo-nao-tem-contas": "O jogo não tem contas e não coleta dados pessoais. Preferências e progresso ficam no armazenamento local do seu navegador e podem ser apagados por você. No multiplayer, a conexão é direta entre os jogadores (WebRTC via PeerJS); o código da sala serve apenas para o pareamento e nenhuma partida passa por servidores nossos. O link de feedback leva ao GitHub, que tem políticas próprias.",
  "ajuda.objetivo-destruir-nucleos-inimigos": "Objetivo: destruir os Núcleos inimigos ou ter mais Domínio (território, exército e recursos) ao fim de 25 minutos. Energia abaixo de 100% deixa produção, sensores e defesas piores: construa Reatores.",
  "ajuda.mouse-teclado": "Mouse e teclado",
  "ajuda.clique-arrastar": "Clique / arrastar",
  "ajuda.selecionar-caixa-selecao-shift": "Selecionar / caixa de seleção. Shift adiciona. Duplo clique seleciona todas do mesmo tipo na tela.",
  "ajuda.botao-direito": "Botão direito",
  "ajuda.mover-inimigo-atacar-coletores": "Mover. Em inimigo: atacar. Em nó com coletores: colher (eles continuam nos nós em volta e entregam sozinhos). Em Refinaria ou Reator inimigo com Pirata: Sifonar. Em Caixa: recolher. Com estrutura selecionada: ponto de reunião.",
  "ajuda.atacar-mover-clique-destino": "Atacar-mover (clique no destino) / Parar",
  "ajuda.b-letra": "B + letra",
  "ajuda.construir-r-reator-f": "Construir: R Reator, F Refinaria, Q Quartel, V Fábrica, H Hangar, T Torre, N Nódulo, L Laboratório. Shift mantém o modo.",
  "ajuda.letras-estrutura-selecionada": "Letras com estrutura selecionada",
  "ajuda.produzir-tecla-aparece-cada": "Produzir: a tecla aparece em cada botão (C Coletor, I Infantaria, S Suporte, P Pirata, V Veículo, D Drone; e as unidades da sua Raça, como O Soldador, U Guindaste, A Atirador, M Mosquito, N Âncora, L Lâmina, R Prensa, E Esporo, C Colosso na Fábrica). Cada clique ou toque no cartão põe 1 na fila; os botões +5 e +10 ficam nos detalhes da unidade (ou Shift + clique e Ctrl + clique)",
  "ajuda.ctrl-1-9-1": "Ctrl+1–9 / 1–9",
  "ajuda.definir-selecionar-grupo-duas": "Definir / selecionar grupo (duas vezes centraliza). Os grupos gravados aparecem embaixo, ao lado do painel: clique seleciona, Ctrl+clique grava",
  "ajuda.botao-meio-mouse": "Botão do meio do mouse",
  "ajuda.roda-comandos-onde-mouse": "Roda de comandos onde o mouse está: Mover, Atacar, Parar e as habilidades da seleção (Colher, Sifonar, Devorar, Recolher); com uma construção, Ponto de reunião e Salto. Segure e solte numa opção, ou clique e escolha; soltar fora (ou Esc) cancela. Arrastar com o botão do meio continua movendo o mapa",
  "ajuda.tela-pesquisa-eras-nucleo": "Tela de pesquisa: Eras do Núcleo, pesquisas do Laboratório, módulos, Ascensão e superarma, com custo, tempo e o que trava",
  "ajuda.f1-f2-f-espaco": "F1 / F2 / F / Espaço",
  "ajuda.nucleo-exercito-centralizar-selecao": "Núcleo / exército / centralizar seleção / ir ao último alerta (Espaço de novo em até 3 s: o alerta anterior). A central de alertas e a visão do exército ficam na coluna da direita",
  "ajuda.wasd-setas-roda-botao": "WASD, setas, roda, botão do meio",
  "ajuda.camera-zoom-encostar-mouse": "Câmera e zoom. Encostar o mouse na borda da janela também move o mapa.",
  "ajuda.segurar-botao-direito-arrastar": "Segurar o botão direito e arrastar",
  "ajuda.mover-mapa-clique-curto": "Mover o mapa (o clique curto continua sendo o comando de mover/atacar)",
  "ajuda.girar-camera-modo-3d": "Girar a câmera (modo 3D); no celular, o botão ⟳",
  "ajuda.pageup-pagedown-ctrl-roda": "PageUp / PageDown, Ctrl + roda, botão ◢",
  "ajuda.inclinar-camera-ate-horizonte": "Inclinar a câmera até o horizonte (o planeta-mãe da sua Raça aparece no céu); Home volta à visão tática",
  "ajuda.roda-aproximar": "Roda (aproximar)",
  "ajuda.camera-cinema-ligada-ajustes": "Com a câmera de cinema ligada (Ajustes), ela desce ao aproximar e mostra as unidades de lado; ao afastar volta à visão tática",
  "ajuda.p-h-esc": "P / H / Esc",
  "ajuda.pausar-ajuda-cancelar": "Pausar / ajuda / cancelar",
  "ajuda.j-ou": "J ou 📷",
  "ajuda.modo-foto-hud-some": "Modo Foto: o HUD some, o tempo congela (no multiplayer a partida segue) e a câmera fica livre: arrastar orbita, botão direito arrasta o ponto, roda aproxima, WASD/QE movem, clique foca. Profundidade de campo, filtros, hora do dia e foto em Tela, 2K ou 4K (Espaço). Esc sai e tudo volta como estava",
  "ajuda.eras": "Eras",
  "ajuda.selecione-nucleo-toque-evoluir": "Selecione o Núcleo e toque em Evoluir. Era II libera Fábrica, Hangar, Laboratório e módulos; Era III libera pesados, superarma e a Ascensão da Raça (no Laboratório). Itens com 🔒 mostram o que falta",
  "ajuda.ctrl-s-ou": "Ctrl+S ou 💾",
  "ajuda.salvar-partida-3-espacos": "Salvar a partida (3 espaços). O jogo também salva sozinho a cada 10 s; se a internet ou a energia cair, volta de onde parou",
  "ajuda.toque": "Toque",
  "ajuda.toque-unidade-sua-selecionar": "Toque em uma unidade sua para selecionar; duplo toque seleciona todas do tipo. Com unidades selecionadas: toque no chão move, toque no inimigo ataca, toque em nó ou carcaça colhe, toque em Refinaria inimiga com Pirata sifona.",
  "ajuda.barra-inferior": "Barra inferior",
  "ajuda.nucleo-exercito-construir-atacar": "Núcleo, Exército, Construir, Atacar (o modo fica ligado até desligar), Parar, Na tela (seleciona o que aparece), Caixa (arrastar seleciona), Girar e Inclinar a câmera e Limpar (tira a seleção). Deslize a barra para ver todos.",
  "ajuda.modo-foto-dedo-orbita": "Modo Foto: um dedo orbita, dois dedos arrastam e fazem pinça, toque numa unidade centraliza e foca; o botão branco tira a foto (Tela ou 2K)",
  "ajuda.toque-longo-mapa": "Toque longo no mapa",
  "ajuda.roda-comandos-deslize-ate": "Roda de comandos: deslize até Mover, Atacar, Parar ou uma habilidade e solte; soltar fora cancela. Sem nada selecionado: Exército, Ociosos, Núcleo, Construir e o último alerta",
  "ajuda.grupos-1-5-esquerda": "Grupos 1–5 (à esquerda)",
  "ajuda.segure-gravar-selecao-toque": "Segure para gravar a seleção, toque para selecionar, dois toques centralizam a câmera",
  "ajuda.alertas-exercito-ao-lado": "Alertas e Exército (ao lado do radar)",
  "ajuda.central-alertas-tocar-leva": "A central de alertas (tocar leva a câmera até lá) e a contagem por tipo, com os ociosos; tocar num tipo seleciona todos",
  "ajuda.arrastar-dois-dedos": "Arrastar / dois dedos",
  "ajuda.camera-zoom-girar-dois": "Câmera / zoom; girar os dois dedos gira o mapa junto com eles, como num app de mapas. Em modo Construir com Muro, arrastar desenha o muro. O botão ◢ inclina a câmera.",
  "ajuda.contras-atacante-alvo": "Contras (atacante → alvo)",
  "ajuda.inf": "Inf.",
  "ajuda.veic": "Veíc.",
  "ajuda.drone": "Drone",
  "ajuda.estrut": "Estrut.",
  "ajuda.sup": "Sup.",
  "ajuda.infantaria": "Infantaria",
  "ajuda.veiculos": "Veículos",
  "ajuda.drones": "Drones",
  "ajuda.estruturas": "Estruturas",
  "ajuda.suporte-hack": "Suporte/Hack",
  "ajuda.forte-1-5-dano": "▲ Forte = 1,5× dano · ▼ Fraco = 0,65×. Vehnar: estruturas neutras contra veículos. Erevane: infantaria camuflada acerta 1,5× saindo da camuflagem.",
  "ajuda.cada-tem-quantidade-fixa": "Cada nó tem uma quantidade fixa e não volta. Minério é o cristal azul aceso, Plasma o laranja e Dados o verde; no radar aparecem como losango, hexágono e triângulo, e o halo no chão encolhe e pisca quando o nó está acabando. Nó esgotado fica apagado. Coletores colhem sozinhos no seu território; mandados com o botão direito, colhem em qualquer campo fora do território inimigo. Quando o nó acaba, o coletor vai sozinho ao nó do mesmo recurso mais perto (no território ou até 800 da base); sem nó perto, volta e fica parado, e o chip <b>N parados</b> no alto manda todos aos nós livres com um toque. A partir dos 9 min surgem <b>veios de Minério</b> no meio do mapa (aviso no canto). A Tempestade de Éter dobra o rendimento do Plasma dentro dela.",
  "ajuda.roubo-diplomacia": "Roubo e diplomacia",
  "ajuda.piratas-sifonam-refinarias-reatores": "Piratas sifonam Refinarias e Reatores inimigos por até 40 s; a vítima recebe um Alerta com atraso de 3 a 5 s. Pirata morto com carga vira Caixa que qualquer um recolhe. Erevane rouba com +20% e sem deixar Rastro. Pactos de Não-agressão custam Caução de 150 Minério por lado; quebrar dá +20% de dano por 45 s, entrega sua Caução à vítima e derruba sua reputação.",
  "ajustes.aparelho": "Aparelho",
  "ajustes.aparelho-sub": "gráficos, qualidade e bateria",
  "ajustes.graficos": "Gráficos",
  "ajustes.gfx-3d": "3D (Three.js, luz e relevo)",
  "ajustes.gfx-2d": "2D isométrico (leve, para celulares fracos)",
  "ajustes.qualidade": "Qualidade 3D",
  "ajustes.q-auto": "Automática",
  "ajustes.q-baixa": "Baixa (sem sombras e efeitos)",
  "ajustes.q-media": "Média (sombras, sombra de contato, bruma e bloom)",
  "ajustes.q-alta": "Alta (sombras 4K, sombra de contato, bruma, bloom e MSAA 4×)",
  "ajustes.q-ultra": "Ultra (Alta com sombra de contato mais fina)",
  "ajustes.bateria": "Economia de bateria (30 fps)",
  "ajustes.cine": "Câmera de cinema: inclina ao aproximar",
  "ajustes.dynres": "Resolução dinâmica: baixa a resolução interna para manter ~60 fps",
  "ajustes.som": "Som: efeitos e ambiente 3D da tela inicial",
  "ajustes.voz": "Voz: líderes, avisos e unidades",
  "ajustes.motor": "Motor gráfico",
  "ajustes.motor-classico": "Clássico",
  "ajustes.motor-5": "Motor 5 (WebGPU, experimental)",
  "ajustes.instalar": "Instalar o jogo (app)",
  "ajustes.testar-som": "Testar som",
  "som.efeitos": "Efeitos",
  "som.vol-efeitos": "Volume dos efeitos",
  "som.musica": "Música",
  "som.vol-musica": "Volume da música",
  "som.saida": "Som 3D",
  "som.saida.fone": "Fone de ouvido (HRTF)",
  "som.saida.caixa": "Caixas de som",
  "som.creditos": "Créditos do som",
  "som.creditos.musica": "Música",
  "som.creditos.efeitos": "Efeitos",
  "geral.idioma": "Idioma",
  "inicio.multi.codigo": "CÓDIGO",
  /* inicio-jogo */
  "geral.gratis": "grátis",
  "inicio.sem-internet": "Sem internet: campanha e partidas solo funcionam; o multiplayer precisa de rede.",
  "inicio.retomar-falhou": "Não foi possível retomar esta partida ({erro}). Ela continua salva; envie o feedback.",
  "inicio.retomar.pausada": "pausada {quando}",
  "inicio.retomar.interrompida": "interrompida {quando}",
  "inicio.retomar.versao": "salva na versão {v}",
  "inicio.salvas": "Partidas salvas",
  "inicio.espaco": "espaço {n}",
  "inicio.carregar": "Carregar",
  "inicio.apagar": "Apagar",
  "inicio.apagar-q": "Apagar?",
  "inicio.descartar-q": "Descartar mesmo?",
  "inicio.descartar": "Descartar",
  "geral.cancelar": "Cancelar",
  "geral.fechar": "Fechar",
  "multi.volta.titulo": "Voltando à sala {codigo}",
  "multi.volta.caiu": "Sua partida multiplayer caiu {quando}. Reconectando…",
  "multi.volta.falhou": "Não deu para voltar à sala {codigo}",
  "multi.volta.recusou": "O anfitrião recusou: {motivo}.",
  "multi.volta.sem-resposta": "A sala não respondeu em 2 minutos.",
  "multi.volta.tentativa": "Reconectando… tentativa {n}",
  "multi.sem-internet-curto": "(sem internet)",
  "geral.comandante": "Comandante",
  "multi.anfitriao": "anfitrião",
  "multi.voce": "você",
  "multi.vaga": "vaga livre",
  "multi.numa-sala": "Você está numa sala · ver Multiplayer",
  "inicio.iniciar": "Iniciar partida",
  "multi.entrar-sala": "Entrar na sala {codigo}",
  "multi.aguardando-jogadores": "Aguardando jogadores…",
  "multi.iniciar-sala": "Iniciar partida da sala ({n}/{total})",
  "multi.aguardando-anfitriao": "Aguardando o anfitrião…",
  "multi.aguarde-um": "Aguarde pelo menos um jogador entrar na sala.",
  "multi.sem-internet-longo": "Sem internet: o multiplayer precisa de rede. A campanha e as partidas solo funcionam offline.",
  "multi.sem-peerjs": "PeerJS não carregou neste navegador.",
  "multi.ja-na-sala": "Você já está na sala {codigo}. Recarregue a página para sair dela.",
  "multi.criando": "Criando sala…",
  "multi.erro-rede": "Erro de rede: {msg}",
  "multi.completa": "Sala completa. Iniciando…",
  "multi.sala-host": "Sala {codigo}: {n}/{total} jogadores. A partida começa quando a sala encher, ou toque em Iniciar partida da sala com 2 ou mais.",
  "multi.criada": "Sala {codigo} criada para {total} jogadores. Envie o código aos amigos e aguarde a entrada deles.",
  "multi.sem-internet": "Sem internet: o multiplayer precisa de rede.",
  "multi.digite-codigo": "Digite o código da sala.",
  "multi.conectando": "Conectando à sala {codigo}…",
  "multi.conectando-s": "Conectando à sala {codigo}… ({s} s)",
  "multi.sem-resposta": "Sem resposta da sala {codigo} há {s} s. Confira o código e se o anfitrião está com a sala aberta; continuamos tentando.",
  "multi.nao-aberta": "Sala {codigo} ainda não está aberta. Nova tentativa em 3 s… ({n}/20)",
  "multi.conectado": "Conectado à sala {codigo}. Aguardando o anfitrião…",
  "multi.cheia": "A sala {codigo} está cheia ou a partida já começou.",
  "multi.anfitriao-saiu": "O anfitrião saiu da sala {codigo}.",
  "multi.na-sala": "Na sala {codigo} como {nome} ({n}/{total}). A partida começa quando o anfitrião iniciar.",
  "multi.aguarde-anfitriao": "Aguarde o anfitrião iniciar a partida.",
  "desempenho.ultimo": "Último teste: {fps} fps médio · 1% {p1} fps · qualidade {q} · {data}",
  "desempenho.nenhum": "Ainda sem teste neste aparelho.",
  "desempenho.sair-sala": "Saia da sala multiplayer (recarregue a página) antes de testar o desempenho.",
  "desempenho.aguarde-volta": "Aguarde a volta à sala multiplayer terminar antes de testar o desempenho.",
  /* sala */
  "vitrine.kicker": "Raça {i} de {total} · {tipo}",
  "vitrine.fato.lider": "Líder",
  "vitrine.fato.mundo": "Mundo natal",
  "vitrine.fato.superarma": "Superarma",
  "vitrine.fato.pirata": "Pirata",
  "vitrine.lore.vehnar.kicker": "Colônia-fábrica",
  "vitrine.lore.vehnar.mundo-tip": "mundo-forja das fundições",
  "vitrine.lore.vehnar.estilo.0": "Indústria pesada",
  "vitrine.lore.vehnar.estilo.1": "Linhas de Montagem",
  "vitrine.lore.vehnar.estilo.2": "Estruturas blindadas",
  "vitrine.lore.vehnar.estilo.3": "Fumaça visível",
  "vitrine.lore.erevane.kicker": "Corsários da Faixa",
  "vitrine.lore.erevane.mundo-tip": "arquipélago das refinarias",
  "vitrine.lore.erevane.estilo.0": "Furtividade",
  "vitrine.lore.erevane.estilo.1": "Roubo limpo +20%",
  "vitrine.lore.erevane.estilo.2": "Camuflagem",
  "vitrine.lore.erevane.estilo.3": "2 Saltos de Núcleo",
  "vitrine.lore.tessara.kicker": "Linhagem viva",
  "vitrine.lore.tessara.mundo-tip": "estufas e jardins vivos",
  "vitrine.lore.tessara.estilo.0": "Adaptação",
  "vitrine.lore.tessara.estilo.1": "Traços de combate",
  "vitrine.lore.tessara.estilo.2": "Fotossíntese",
  "vitrine.lore.tessara.estilo.3": "Faminta por Dados",
  "vitrine.lore.quorith.kicker": "Mente-colmeia de cristal",
  "vitrine.lore.quorith.mundo-tip": "cavernas de cristal ressonante",
  "vitrine.lore.quorith.estilo.0": "Sincronia (Elo)",
  "vitrine.lore.quorith.estilo.1": "Pactos pela metade",
  "vitrine.lore.quorith.estilo.2": "Torres emudecidas",
  "vitrine.lore.quorith.estilo.3": "Cristal",
  "vitrine.lore.vorag.kicker": "Enxame voraz",
  "vitrine.lore.vorag.mundo-tip": "ninhos sob a crosta",
  "vitrine.lore.vorag.estilo.0": "Enxame barato",
  "vitrine.lore.vorag.estilo.1": "Crias em pares",
  "vitrine.lore.vorag.estilo.2": "Fome fora de casa",
  "vitrine.lore.vorag.estilo.3": "Devora carcaças",
  "vitrine.seg.ias": {"one":"{n} IA","other":"{n} IAs"},
  "vitrine.seg.jogadores": "jogadores",
  "vitrine.seg.sem-pausa": "sem pausa",
  "vitrine.mapa.aria": "Mapa",
  "vitrine.mapa.fenda": "Quatro biomas e o abismo da Fenda no centro.",
  "vitrine.mapa.cinturao": "Plataformas sobre o espaço, ligadas por pontes.",
  "vitrine.iniciar": "Iniciar partida",
  "sala.fala.vehnar": "Barão-Forja na linha. As fornalhas de Kessari estão acesas, comandante.",
  "sala.fala.erevane": "Vesper Ísk. Ninguém nos vê chegar. Ninguém nos vê partir.",
  "sala.fala.tessara": "Sylvia Oriel. Oriel cresce. E quem resiste vira adubo.",
  "sala.fala.quorith": "Zayin Coral. O Coro canta em uma só voz. Afine-se, comandante.",
  "sala.fala.vorag": "Oru Voraz. A fome de Velk não tem fim.",
  "sala.tag.transmissao": "Em transmissão de {mundo} · clique no chão ou Esc para voltar",
  "sala.mesa.ver": "Ver na mesa",
  "sala.mesa.voltar": "Voltar",
  "sala.mesa.legenda": {"one":"{mapa} · {n} base · semente {semente}","other":"{mapa} · {n} bases · semente {semente}"},
  "sala.sair.aria": "Sala de Comando",
  "sala.sair.voltar": "Voltar ao menu",
  "sala.sair.mesa": "Mesa tática · {legenda} · arraste para girar",
  "sala.sair.explorar": "Arraste para girar · roda para aproximar · clique numa construção ou na mesa",
  "sala.ac.titulo": "Academia de Comando",
  "sala.ac.fechar": "Fechar a Academia",
  "sala.ac.passos-aria": "O básico em 4 passos",
  "sala.ac.anterior": "Anterior",
  "sala.ac.proxima": "Próxima",
  "sala.ac.catalogo": "Catálogo",
  "sala.ac.unidades": "Unidades",
  "sala.ac.construcoes": "Construções",
  "sala.ac.lista-aria": "Escolha uma unidade ou construção",
  "sala.ac.cl.inf": "Infantaria",
  "sala.ac.cl.vei": "Veículos",
  "sala.ac.cl.dro": "Drones",
  "sala.ac.cl.est": "Estruturas",
  "sala.ac.cl.sup": "Suporte",
  "sala.ac.cl.civ": "Civis",
  "sala.ac.passo.0.titulo": "Colete",
  "sala.ac.passo.0.texto": "Os Coletores saem do Núcleo e trazem Minério e Plasma dos nós do seu território. Sem renda não há exército: comece com mais Coletores.",
  "sala.ac.passo.1.titulo": "Dê energia",
  "sala.ac.passo.1.texto": "Toda construção gasta energia. O Reator gera, a Refinaria encurta a viagem dos Coletores. Abaixo de 100% a base fica Racionada e lenta.",
  "sala.ac.passo.2.titulo": "Treine",
  "sala.ac.passo.2.texto": "O Quartel treina infantaria; a Fábrica e o Hangar (Era II) trazem veículos e drones. Misture as classes: cada uma vence uma e perde para outra.",
  "sala.ac.passo.3.titulo": "Ataque",
  "sala.ac.passo.3.texto": "Selecione o exército e clique no inimigo. Veículos esmagam infantaria, drones caçam veículos, infantaria derruba drones. Derrube o Núcleo para vencer.",
  "sala.ac.passo": "Passo {n} · {titulo}",
  "sala.ac.gratis": "grátis",
  "sala.ac.vida": "Vida",
  "sala.ac.alcance": "Alcance",
  "sala.ac.reparo": "{v} (reparo)",
  "sala.ac.sifao": "{v} (sifão)",
  "sala.ac.dano": "Dano",
  "sala.ac.velocidade": "Velocidade",
  "sala.ac.sensor": "Sensor",
  "sala.ac.obra": "Obra",
  "sala.ac.construcao": "Construção",
  "sala.ac.voa": "voa",
  "sala.ac.produz": "produz {lista}",
  "sala.ac.forte": "Forte contra",
  "sala.ac.fraco": "Fraco contra",
  "input.sem-recursos": "Recursos insuficientes",
  "input.reuniao": "Ponto de reunião definido",
  "input.no-esgotado": "Nó esgotado: mande os coletores a outro campo",
  "input.quebrar-pacto": "Atacar {nome} quebra o pacto de Não-agressão: você perde a Caução, ganha +20% de dano por 45 s e sua Reputação cai. Quebrar?",
  "input.salto": "Saltar o Núcleo para este ponto? Custa {p}% de cada recurso e 60 s de canalização visível a todos.",
  "input.coletores-fora": {"one":"{n} coletor ficou de fora: o exército tem prioridade. Duplo clique num coletor seleciona todos na tela.","other":"{n} coletores ficaram de fora: o exército tem prioridade. Duplo clique num coletor seleciona todos na tela."},
  "input.grupo": "Grupo {n} definido",
  /* hud-jogo */
  "desempenho.titulo": "Teste de desempenho",
  "desempenho.dica-carga": "Batalha fixa de 30 s com a câmera passeando pelo mapa. Não mexa no jogo até terminar.",
  "carga.dica.0": "Energia abaixo de 100% deixa produção, sensores e defesas mais lentos: construa Reatores antes de precisar.",
  "carga.dica.1": "Coletores colhem sozinhos no seu território; com o botão direito, mande-os a outro campo.",
  "carga.dica.2": "Um Nódulo de Avanço amplia o território e libera novos nós para os coletores.",
  "carga.dica.3": "Piratas sifonam Refinarias e Reatores inimigos por até 40 s; a vítima só recebe o alerta alguns segundos depois.",
  "carga.dica.4": "Pactos de Não-agressão custam Caução. Quebrar um pacto dá +20% de dano por 45 s, mas derruba a sua reputação.",
  "carga.dica.5": "Selecione o Núcleo e toque em Evoluir: a Era II libera Fábrica, Hangar e Laboratório.",
  "carga.dica.6": "Ctrl + número guarda um grupo; o número seleciona, e duas vezes centraliza a câmera.",
  "carga.dica.7": "Espaço leva a câmera ao último alerta.",
  "carga.dica.8": "No Cinturão, quem anda só cruza pelas pontes; drones e naves voam por cima do abismo.",
  "carga.dica.9": "Vença derrubando os Núcleos inimigos ou tendo mais Domínio aos 25 minutos.",
  "carga.dica.10": "A Tempestade de Éter dobra o rendimento do Plasma dentro dela.",
  "jogo.m5-indisponivel": "Motor 5 indisponível neste navegador: usando o motor clássico",
  "jogo.3d-indisponivel": "3D indisponível neste navegador; usando o modo 2D",
  "jogo.3d-reduzida": "Qualidade 3D reduzida",
  "jogo.3d-reduzida-txt": "{o} desativada: {motivo}. Se continuar escuro, escolha outra qualidade na tela inicial e envie o feedback.",
  "jogo.3d-falhou": "Renderização 3D falhou",
  "jogo.3d-falhou-txt": "Volte à tela inicial e escolha Gráficos: 2D. Exporte o resultado e envie o feedback.",
  "hud.lider": "Líder {raca}",
  "hud.em-chamada": "em chamada · {raca}",
  "jogo.bateria-baixa": "Bateria baixa: limitando a 30 fps para economizar",
  "multi.voltou": "Você voltou à partida",
  "multi.voltou-txt": "Com a aba em segundo plano o jogo não envia comandos; depois de 8 s a sala pode seguir sem você.",
  "multi.de-volta": "De volta à sala",
  "multi.sincronizada-host": "Partida sincronizada com o anfitrião no tempo {t}.",
  "jogo.retomada": "Partida retomada",
  "jogo.retomada-auto": "Você voltou em {s} s, no tempo {t} de jogo.",
  "jogo.retomada-salvo": "Salvamento de {quando}, no tempo {t} de jogo.",
  "jogo.retomada-pausa": "Pausado: toque em ❚❚ ou P para continuar.",
  "ajustes.q.baixa": "Baixa",
  "ajustes.q.media": "Média",
  "ajustes.q.alta": "Alta",
  "ajustes.q.ultra": "Ultra",
  "jogo.q-desceu": "Qualidade 3D ajustada para {q} para manter a fluidez ({fps} fps)",
  "jogo.q-voltou": "Qualidade 3D voltou para {q}",
  "jogo.q-subiu": "Qualidade 3D subiu para {q}: o aparelho tem folga",
  "multi.reconectando": "Reconectando à sala {codigo}… ({s} s)",
  "multi.conexao-perdida-curto": "Conexão perdida.",
  "multi.aguardando-outros": "Aguardando os outros jogadores… ({s} s)",
  "voz.construcao": "Construção concluída",
  "voz.unidade": "Unidade pronta",
  "voz.alerta-sifao": "Alerta de sifão",
  "voz.nucleo-ataque": "Núcleo sob ataque",
  "voz.base-ataque": "Base sob ataque",
  "voz.pacto-quebrado": "Pacto quebrado",
  "voz.tempestade": "Tempestade de Éter",
  "voz.pesquisa": "Pesquisa concluída",
  "voz.pacto-assinado": "Pacto assinado",
  "voz.blecaute": "Blecaute",
  "voz.fundicao": "Fundição Orbital",
  "voz.salto": "Salto de Núcleo",
  "voz.ativada": "Voz ativada",
  "hud.eliminado": "{nome} eliminado",
  "hud.restantes": {"one":"{n} inimigo restante","other":"{n} inimigos restantes"},
  "hud.restantes-dica": "destrua todos os Núcleos ou vença por Domínio aos 25:00",
  "hud.todos-cairam": "Todos os Núcleos inimigos caíram",
  "hud.energia-regime": "Energia: {regime}",
  "hud.ascensao": "Ascensão: {nome}",
  "jogo.sem-salvar-mp": "Sem salvamento no multiplayer",
  "jogo.salvar-fenda": "Na dificuldade Fenda não há salvamento manual. O salvamento automático continua protegendo contra queda de internet ou energia.",
  "jogo.salvar-auto": "O jogo também salva sozinho a cada 10 segundos e ao sair da aba. Se a internet ou a energia cair, ele volta de onde parou.",
  "jogo.espaco": "Espaço {n}",
  "jogo.salvo": "salvo {quando}",
  "jogo.vazio": "vazio",
  "jogo.salva-no": "Partida salva no espaço {n}",
  "jogo.nao-salvou": "Não foi possível salvar neste aparelho",
  "jogo.substituir": "Substituir o que está no espaço {n}?",
  "hud.pilula": "{res} · variação por minuto nos últimos 30 s · no seu território restam {n}",
  "hud.seco.dois": "Minério e Plasma acabaram",
  "hud.seco.um": "{res} acabou",
  "hud.seco.dois-txt": "O Minério e o Plasma do seu território acabaram.",
  "hud.seco.um-txt.minerio": "O Minério do seu território acabou.",
  "hud.seco.um-txt.plasma": "O Plasma do seu território acabou.",
  "hud.seco.dica": "Os coletores vão sozinhos ao campo mais perto; os que ficarem parados voltam para a base.",
  "hud.seco.mandar": "Mandar coletores",
  "hud.seco.nodulo": "Construir Nódulo",
  "jogo.pausada": "Partida pausada.",
  "jogo.pausou-sozinho": "O jogo pausou sozinho porque a aba ficou em segundo plano. Nada se perdeu.",
  "jogo.retomada-parou": "Partida retomada de onde parou.",
  "hud.sobrecarga": "Sobrecarga",
  "hud.blecaute": "BLECAUTE",
  "hud.relogio-de": "de {t}",
  /* hud-painel */
  "hud.p.construcao": "construção {p}%",
  "hud.p.abrir": "Abrir o painel",
  "hud.p.recolher": "Recolher o painel",
  "hud.p.carcaca": "Carcaça de {nome}",
  "hud.p.veiculo": "veículo",
  "hud.p.recuperavel": "{n} de Minério recuperável",
  "hud.p.carcaca-dica": "Coletores podem saquear carcaças em qualquer lugar: clique direito com um coletor.",
  "hud.p.no.minerio": "Nó de Minério",
  "hud.p.no.plasma": "Nó de Plasma",
  "hud.p.no.dados": "Nó de Dados",
  "hud.p.esgotado": "esgotado",
  "hud.p.no-seco": "Nada mais a colher aqui. Os recursos não voltam: mande os coletores a outro campo ou expanda com um Nódulo.",
  "hud.p.restantes": "{n} / {max} restantes",
  "hud.p.no-dica": "Coletores colhem sozinhos no seu território. Mandados com o botão direito, colhem em qualquer campo fora do território inimigo.",
  "hud.p.em-pacto": "em pacto",
  "hud.p.inimigo": "inimigo",
  "hud.p.estrutura": "Estrutura",
  "hud.p.alvo-sifao": "Alvo de Sifão: selecione um Pirata e clique com o botão direito aqui.",
  "hud.p.centro": "Centro da colônia · Era {era}",
  "hud.p.em-construcao": "em construção",
  "hud.p.mais1": "{nome}: mais 1 na fila",
  "hud.p.fila-dica": "{nome}: clique põe 1 na fila · Shift+clique 5 · Ctrl+clique 10",
  "hud.p.fila": "Fila {n}/50",
  "hud.p.cancela": "Clique cancela 1 · Shift cancela todas deste tipo",
  "hud.p.aguardando": "aguardando recursos",
  "hud.p.reuniao": "Ponto de reunião",
  "hud.p.salto": "Salto de Núcleo ({n})",
  "hud.p.evoluindo": "Evoluindo para a Era {era}",
  "geral.ou": "ou",
  "hud.p.evoluir": "Evoluir para a Era {era}",
  "hud.p.era-max": "Era máxima. A Ascensão da Raça fica no Laboratório.",
  "hud.p.pesquisa-eras": "Pesquisa e Eras",
  "hud.p.instalando": "Instalando {nome}",
  "hud.p.modulo": "Módulo: {nome}",
  "hud.p.requer-era3": "Requer Era III (Domínio)",
  "hud.p.arvore": "Árvore de pesquisa e Eras",
  "hud.p.salto-em": "Salto em {s} s. O Núcleo está visível para todos.",
  "hud.p.destino-salto": "Clique no mapa para escolher o destino do Salto",
  "hud.p.destino-reuniao": "Clique no mapa para definir o ponto de reunião",
  "hud.p.voa": "voa",
  "hud.p.rank.1": "★ Veterano",
  "hud.p.rank.2": "★★ Elite",
  "hud.p.rank.3": "★★★ Lenda",
  "hud.p.acorde": "Acorde {n}",
  "hud.st.dano": "Dano",
  "hud.st.alcance": "Alcance",
  "hud.st.velocidade": "Velocidade",
  "hud.st.visao": "Visão",
  "hud.p.carga": "Carga: {n}",
  "hud.p.roubada": "(roubada)",
  "hud.p.unidades": {"one":"{n} unidade","other":"{n} unidades"},
  "hud.p.tipos": {"one":"{n} tipo","other":"{n} tipos"},
  "hud.p.vida": "VIDA",
  "hud.p.atacar-mover": "Atacar-mover",
  "hud.p.parar": "Parar",
  "hud.p.pirata-dica": "{nome}: clique com o direito em uma Refinaria ou Reator inimigo para Sifonar (40 s). Entrega sozinho quando enche ou após 40 s; mandado de volta, entrega ao chegar perto da Refinaria ou do Núcleo. Se morrer carregado, a carga vira Caixa.",
  "hud.p.pirata-camuflado": "Camuflado até começar a sifonar; Torres e Núcleo enxergam de perto.",
  "hud.p.pirata-devora": "Carniceiro: clique direito numa carcaça ou num Nódulo inimigo para devorar (biomassa direto no cofre).",
  "hud.p.pirata-silencio": "Enquanto sifona, torres inimigas a até 110 ficam mudas.",
  "hud.p.coletor-dica": "{nome}: colhe sozinho no seu território. Mandado a outro lugar (clique direito no chão ou num nó), colhe os nós em volta e entrega na Refinaria ou no Núcleo mais perto.",
  "hud.btab.eco": "Economia",
  "hud.btab.mil": "Militar",
  "hud.btab.def": "Defesa",
  "hud.btab.tec": "Tecnologia",
  "hud.st.vida": "Vida",
  "hud.st.tempo-obra": "Tempo de construção",
  "hud.st.energia-prod": "Energia produzida",
  "hud.st.energia-cons": "Energia consumida",
  "hud.st.dano-int": "Dano por disparo / intervalo",
  "hud.st.territorio-n": "território {n}",
  "hud.st.territorio": "Território",
  "hud.p.muralha": "Muralha",
  "hud.st.tempo-prod": "Tempo de produção",
  "hud.falta.minerio": "{n} de Minério",
  "hud.falta.plasma": "{n} de Plasma",
  "hud.falta.dados": "{n} de Dados",
  "hud.faltam": "Faltam {lista}",
  "geral.e": "e",
  "hud.pronto": "Pronto",
  "hud.tecla": "tecla {k}",
  "hud.q.mais": "Pôr mais {nome} na fila",
  "hud.q.por-n": "Pôr {n} {nome} na fila",
  "hud.q.por-dica": "Pôr {n} na fila",
  "hud.q.shift": "ou Shift+clique no cartão",
  "hud.q.ctrl": "ou Ctrl+clique no cartão",
  "hud.posicionar": "Posicionar",
  "hud.q.por": "Pôr na fila",
  "hud.t.atual": "atual",
  "hud.t.evoluindo": "evoluindo",
  "hud.t.para-era": "Para a Era {era}:",
  "hud.t.concluida": "concluída",
  "hud.t.abrir-nucleo": "Abrir o Núcleo (F1) para evoluir",
  "hud.construir": "Construir",
  "hud.construir-toque": "toque: detalhes · Posicionar",
  "hud.construir-mouse": "B + tecla · passe o mouse para detalhes",
  "hud.nada-sel": "Nada selecionado. Clique em unidades ou arraste uma caixa. F1 seleciona o Núcleo, F2 o exército.",
  "hud.posicionar-toque": "Arraste para posicionar e toque em ✓ Construir aqui",
  "hud.posicionar-mouse": "Posicione e clique para construir. Shift mantém o modo.",
  "hud.recarga": "recarga {t}",
  "hud.sobrecarga-sub": "200 Plasma · +50% energia 60 s",
  "hud.requer-lab": "requer Laboratório",
  "hud.requer-era3": "requer Era III",
  "hud.super-sub": "300 Dados · 200 Plasma",
  "hud.vel-mp": "Velocidade fixa no multiplayer",
  "hud.sair-q": "Encerrar esta partida e voltar ao início?",
  "hud.sair-dica": "Para continuar depois, use 💾 › Pausar e sair.",
  "hud.continuando": "Continuando",
  "hud.caixa-on": "Arraste para selecionar em caixa",
  "hud.caixa-off": "Arraste para mover a câmera",
  "hud.rot-3d": "Rotação só no modo 3D",
  "hud.tilt-3d": "Inclinação só no modo 3D",
  "hud.tilt.0": "Câmera tática",
  "hud.tilt.1": "Câmera inclinada",
  "hud.tilt.2": "Câmera de horizonte (planeta-mãe no céu)",
  "hud.tilt-dica": "PageUp/PageDown ou Ctrl + rolagem ajustam",
  "hud.selecionadas": {"one":"{n} unidade selecionada","other":"{n} unidades selecionadas"},
  "hud.nenhuma-tela": "Nenhuma unidade de combate na tela",
  "hud.q.na-fila": "+{n} {nome} na fila",
  "hud.nenhum-parado": "Nenhum coletor parado: os coletores já estão trabalhando",
  "hud.super-alvo.fundicao": "Clique em território seu para derrubar o Bastião",
  "hud.super-alvo.eclosao": "Clique num ponto visível para a Eclosão",
  /* hud3 */
  "hud3.gratis": "grátis",
  "hud3.cvd.normal": "Normal",
  "hud3.cvd.normal.sub": "cores originais",
  "hud3.cvd.protan": "Protanopia",
  "hud3.cvd.protan.sub": "vermelho fraco",
  "hud3.cvd.deutan": "Deuteranopia",
  "hud3.cvd.deutan.sub": "verde fraco",
  "hud3.cvd.tritan": "Tritanopia",
  "hud3.cvd.tritan.sub": "azul fraco",
  "hud3.a11y.paleta": "Paleta de cores · daltonismo",
  "hud3.a11y.escala": "Escala da interface na partida",
  "hud3.a11y.escala-dica": "90% a 140%. Botões de toque nunca ficam menores que 44 px.",
  "hud3.a11y.legendas": "Legendas das falas (o que a voz do sistema diz aparece em texto, com o retrato do líder)",
  "hud3.a11y.inimigos": "Destacar inimigos (anel vermelho no chão, barra de vida vermelha e marca no radar)",
  "hud3.a11y.relativas": "Cores relativas: você verde, aliados azuis e inimigos vermelhos (a partir da próxima partida)",
  "hud3.a11y.racas": "Raças",
  "hud3.a11y.recursos": "Recursos",
  "hud3.a11y.titulo": "Acessibilidade",
  "hud3.a11y.sub": "Cores, tamanho e legendas da partida",
  "hud3.a11y.nota": "As cores dos jogadores (paleta e cores relativas) mudam na próxima partida (os modelos 3D já foram montados com as cores atuais); as dos recursos, a escala, as legendas e o destaque dos inimigos mudam na hora.",
  "hud3.cap.comando": "Comando",
  "hud3.alc.construcao-pronta": "Construção pronta: {x}",
  "hud3.alc.unidade-pronta": "Unidade pronta: {x}",
  "hud3.alc.territorio-acabou": "{x} do seu território acabou: mande os coletores a outro campo ou expanda com um Nódulo.",
  "hud3.alc.mandar-coletores": "Mandar coletores",
  "hud3.alc.novos": {"one":"{n} novo","other":"{n} novos"},
  "hud3.alc.proximo": "Alerta {i} de {n}: {x} · Espaço de novo: o anterior",
  "hud3.alc.vazio": "Nenhum alerta ainda. Ataques, construções e unidades prontas, recursos esgotados e piratas aparecem aqui; toque ou clique para ir até lá.",
  "hud3.army.card-dica": "{x}: clique seleciona todos · duas vezes centraliza · Shift soma",
  "hud3.army.vazio": "Nenhuma unidade ainda: produza no Núcleo (Coletores) e no Quartel.",
  "hud3.army.parados": {"one":"{n} parado","other":"{n} parados"},
  "hud3.army.sem-ordem": "{n} sem ordem",
  "hud3.army.nada": "Nada para selecionar",
  "hud3.army.duas-vezes": "duas vezes centraliza",
  "hud3.army.sel-sem-ordem": {"one":"{n} unidade sem ordem","other":"{n} unidades sem ordem"},
  "hud3.army.prod-ocupada": "Toda a produção está ocupada",
  "hud3.army.sem-fila": "{x} sem fila ({i} de {t})",
  "hud3.grp.grupo": "Grupo {g}",
  "hud3.grp.dica-toque": "Grupo {g}: toque seleciona · dois toques centralizam · segure para gravar a seleção",
  "hud3.grp.dica": "Grupo {g}: tecla {g} ou clique seleciona · duas vezes centraliza · Ctrl+{g} ou Ctrl+clique grava",
  "hud3.grp.vazio-toque": "Grupo {g} vazio: selecione unidades e segure o botão para gravar",
  "hud3.grp.vazio": "Grupo {g} vazio: Ctrl+{g} grava a seleção",
  "hud3.grp.gravado": {"one":"Grupo {g} gravado: {n} selecionado","other":"Grupo {g} gravado: {n} selecionados"},
  "hud3.grp.limpo": "Grupo {g} limpo",
  "hud3.roda.mover": "Mover",
  "hud3.roda.mover-d": {"one":"Mover {n} unidade até aqui","other":"Mover {n} unidades até aqui"},
  "hud3.roda.atacar": "Atacar",
  "hud3.roda.atacar-alvo": "Atacar {x}",
  "hud3.roda.atacar-mover": "Atacar-mover: avança e luta com o que encontrar",
  "hud3.roda.sem-armadas": "Nenhuma unidade armada na seleção",
  "hud3.roda.parar": "Parar",
  "hud3.roda.parar-d": "Parar e ficar no lugar",
  "hud3.roda.colher": "Colher",
  "hud3.roda.colher-carcaca": "Colher a carcaça",
  "hud3.roda.colher-no": "Colher este nó de {x}",
  "hud3.roda.colher-aqui": "Colher em volta deste ponto (os coletores entregam sozinhos)",
  "hud3.roda.sifonar": "Sifonar",
  "hud3.roda.sifonar-d": "Sifonar {x} (até 40 s)",
  "hud3.roda.sifonar-alvo": "Aponte para uma Refinaria ou Reator inimigo",
  "hud3.roda.devorar": "Devorar",
  "hud3.roda.devorar-carcaca": "Devorar a carcaça",
  "hud3.roda.devorar-nodulo": "Devorar o Nódulo inimigo",
  "hud3.roda.devorar-alvo": "Aponte para uma carcaça ou um Nódulo inimigo",
  "hud3.roda.recolher": "Recolher",
  "hud3.roda.recolher-d": "Recolher a caixa de recursos",
  "hud3.roda.reuniao": "Reunião",
  "hud3.roda.reuniao-d": "Ponto de reunião de {x} aqui",
  "hud3.roda.reuniao-ok": "Ponto de reunião definido",
  "hud3.roda.saltar": "Saltar",
  "hud3.roda.saltar-d": {"zero":"Salto de Núcleo para este ponto ({n} restantes)","one":"Salto de Núcleo para este ponto ({n} restante)","other":"Salto de Núcleo para este ponto ({n} restantes)"},
  "hud3.roda.salto-andamento": "Salto em andamento",
  "hud3.roda.sem-saltos": "Sem Saltos restantes",
  "hud3.roda.saltar-confirma": "Saltar o Núcleo para este ponto? Custa {p}% de cada recurso e 60 s de canalização visível a todos.",
  "hud3.roda.pesquisa": "Pesquisa",
  "hud3.roda.pesquisa-d": "Abrir a tela de pesquisa e Eras (F3)",
  "hud3.roda.exercito": "Exército",
  "hud3.roda.exercito-d": "Selecionar todas as unidades de combate",
  "hud3.roda.selecionadas": {"one":"{n} unidade selecionada","other":"{n} unidades selecionadas"},
  "hud3.roda.ociosos": "Ociosos",
  "hud3.roda.ociosos-d": "Selecionar as unidades paradas (coletores e combate)",
  "hud3.roda.paradas": {"one":"{n} unidade parada","other":"{n} unidades paradas"},
  "hud3.roda.nucleo": "Núcleo",
  "hud3.roda.nucleo-d": "Selecionar e centralizar o Núcleo",
  "hud3.roda.construir": "Construir",
  "hud3.roda.construir-d": "Abrir o menu Construir",
  "hud3.roda.alerta": "Alerta",
  "hud3.roda.alerta-d": "Ir ao último alerta",
  "hud3.roda.sem-alerta": "Nenhum alerta com lugar ainda",
  "hud3.roda.comandos": "Comandos",
  "hud3.roda.deslize": "deslize e solte",
  "hud3.roda.escolha": "escolha e solte",
  "hud3.roda.trancado": "trancado",
  "hud3.roda.tecla": "tecla {k}",
  "hud3.roda.solte": "solte para dar a ordem",
  "hud3.roda.cancelar": "Cancelar",
  "hud3.roda.solte-fora": "solte fora para cancelar",
  "hud3.roda.deslize-ordem": "deslize até uma ordem",
  "hud3.roda.mova-ordem": "mova até uma ordem",
  "hud3.roda.clique-fora": "clique fora para fechar",
  "hud3.tk.falta-item": "{q} de {x}",
  "hud3.tk.faltam": "Faltam {x}",
  "hud3.tk.e": "{a} e {b}",
  "hud3.tk.ou": "{a} ou {b}",
  "hud3.tk.era-atual": "Era <b>{r} · {x}</b>",
  "hud3.tk.lab-pronto": "Laboratório pronto",
  "hud3.tk.sem-lab": "Sem Laboratório (Era II)",
  "hud3.tk.eras": "Eras do Núcleo",
  "hud3.tk.era-concluida": "concluída",
  "hud3.tk.era-atual-st": "atual",
  "hud3.tk.era-evoluindo": "evoluindo",
  "hud3.tk.era-trancada": "trancada",
  "hud3.tk.era-n": "Era {r}",
  "hud3.tk.evoluir": "Evoluir para a Era {r}",
  "hud3.tk.pesquisas": "Laboratório · pesquisas",
  "hud3.tk.req-lab": "Requer Laboratório",
  "hud3.tk.era-b": "ERA {r}",
  "hud3.tk.instantanea": "instantânea",
  "hud3.tk.concluida": "✓ concluída",
  "hud3.tk.pesquisar": "Pesquisar",
  "hud3.tk.modulos": "Módulos das construções",
  "hud3.tk.mod-em": "em {x}",
  "hud3.tk.mod-com": "{i} de {t} com o módulo",
  "hud3.tk.mod-instalando": "{u} instalando",
  "hud3.tk.mod-nenhum": "nenhum(a) {x}",
  "hud3.tk.escolher": "Escolher {x}",
  "hud3.tk.poder": "Poder da Raça",
  "hud3.tk.req-era3": "Requer Era III (Domínio)",
  "hud3.tk.ascensao": "Ascensão: {x}",
  "hud3.tk.alcancada": "✓ alcançada",
  "hud3.tk.ascender": "Ascender",
  "hud3.tk.superarma": "Superarma: {x}",
  "hud3.tk.recarga-min": "recarga {m} min",
  "hud3.tk.recarga": "recarga {t}",
  "hud3.tk.super-pronta": "pronta: botão Superarma ao lado do radar",
  "hud3.tk.evolucao-pedida": "Evolução pedida ao Núcleo",
  "hud3.tk.toque-modulo": "Toque em Módulo no painel para instalar",
  "hud3.html.central": "Central de alertas",
  "hud3.html.alertas": "Alertas",
  "hud3.html.visao": "Visão do exército",
  "hud3.html.tropas": "Tropas",
  "hud3.html.exercito": "Exército",
  "hud3.html.fechar": "Fechar",
  "hud3.html.idlecol-d": "Mandar os coletores parados aos nós livres mais próximos",
  "hud3.html.idlecol": "coletores parados",
  "hud3.html.idleu-d": "Selecionar as unidades de combate sem ordem",
  "hud3.html.idleu": "sem ordem",
  "hud3.html.idleprod-d": "Ir às construções de produção sem fila (uma por vez)",
  "hud3.html.idleprod": "produção parada",
  "hud3.html.filtrar": "Filtrar alertas",
  "hud3.html.f-todos": "Todos",
  "hud3.html.f-ataque": "Ataques",
  "hud3.html.f-base": "Base",
  "hud3.html.f-eco": "Economia",
  "hud3.html.grupos": "Grupos de controle",
  "hud3.html.tech-eyebrow": "Laboratório e Núcleo · F3",
  "hud3.html.tech-titulo": "Pesquisa e Eras",
  "hud3.html.voltar": "Voltar ao jogo",
  "hud3.html.a11y-eyebrow": "Partida",
  "hud3.html.a11y-titulo": "Ajustes",
  /* foto */
  "foto.look.natural": "Natural",
  "foto.look.cinema": "Cinema",
  "foto.look.noir": "Noir",
  "foto.look.quente": "Quente",
  "foto.look.frio": "Frio",
  "foto.look.fenda": "Fenda",
  "foto.look.vintage": "Vintage",
  "foto.look.epico": "Épico",
  "foto.pausa": "Modo Foto: tempo congelado.",
  "foto.preparando": "Preparando o Modo Foto…",
  "foto.dica-toque": "Modo Foto · um dedo orbita, dois arrastam e fazem pinça",
  "foto.dica": "Modo Foto · arraste para orbitar · Espaço tira a foto · Esc sai",
  "foto.pronto-toque": "Modo Foto pronto · um dedo orbita, dois arrastam e fazem pinça",
  "foto.pronto": "Modo Foto pronto · arraste para orbitar · Espaço tira a foto · Esc sai",
  "foto.erro-gerar": "Não deu para gerar a foto {w}×{h}; tente uma resolução menor",
  "foto.salva": "Foto salva · {w}×{h} · {f}",
  "foto.falha": "Falha na captura: {x}",
  "foto.nada-focar": "Nada para focar aí (céu ou espaço)",
  "foto.aguarde": "Aguarde um instante e tente de novo",
  "foto.max-4k": "Este aparelho não desenha {w}×{h}; use 2K ou Tela",
  "foto.max": "Este aparelho não desenha {w}×{h}; use Tela",
  "foto.sl.fov": "Lente",
  "foto.sl.roll": "Horizonte",
  "foto.sl.abert": "Abertura",
  "foto.sl.ev": "Exposição",
  "foto.sl.con": "Contraste",
  "foto.sl.sat": "Saturação",
  "foto.sl.temp": "Temperatura",
  "foto.sl.vig": "Vinheta",
  "foto.sl.grao": "Grão",
  "foto.sl.ab": "Aberração",
  "foto.sl.hora": "Hora",
  "foto.sl.luz-az": "Direção",
  "foto.sl.bloom": "Brilho",
  "foto.temp.quente": "quente {v}",
  "foto.temp.fria": "fria {v}",
  "foto.temp.neutra": "neutra",
  "foto.hora.dia": "dia",
  "foto.hora.tarde": "tarde",
  "foto.hora.entardecer": "entardecer",
  "foto.hora.anoitecer": "anoitecer",
  "foto.hora.noite": "noite",
  "foto.camera-aria": "Câmera do Modo Foto",
  "foto.titulo": "Modo Foto",
  "foto.sair-jesc": "Sair do Modo Foto (J ou Esc)",
  "foto.sair": "Sair do Modo Foto",
  "foto.sair-esc": "Sair (Esc)",
  "foto.painel-h": "Recolher ou abrir o painel (H)",
  "foto.painel": "Recolher ou abrir o painel",
  "foto.tempo": "Tempo",
  "foto.t.congelado": "❄ Congelado",
  "foto.t.congelado-d": "Congela a cena (T)",
  "foto.t.lento": "◔ Lento",
  "foto.t.lento-d": "Câmera lenta, ¼ da velocidade",
  "foto.t.normal": "▶ Normal",
  "foto.t.normal-d": "A partida anda (T)",
  "foto.t.passo-d": "Avança um instante e congela de novo",
  "foto.t.passo": "Avançar um instante",
  "foto.aba.cam": "Câmera",
  "foto.aba.foco": "Foco",
  "foto.aba.filtro": "Filtros",
  "foto.aba.luz": "Luz",
  "foto.nivelar": "Nivelar horizonte",
  "foto.voltar": "Câmera do jogo",
  "foto.ajuda-toque": "<b>Um dedo</b> orbita · <b>dois dedos</b> arrastam o ponto e fazem pinça · <b>toque</b> numa unidade ou construção centraliza e foca · <b>toque duplo</b> leva a órbita ao ponto",
  "foto.ajuda": "<b>Arrastar</b> orbita · <b>botão direito</b> (ou Shift) arrasta o ponto · <b>roda</b> aproxima (<b>Shift</b> + roda: lente) · <b>WASD</b>/setas movem · <b>Q</b>/<b>E</b> descem e sobem · <b>R</b>/<b>F</b> inclinam · <b>Z</b>/<b>C</b> giram em volta · <b>,</b> <b>.</b> horizonte · <b>−</b>/<b>+</b> lente · <b>Espaço</b> foto · <b>T</b> tempo · <b>H</b> painel · <b>Esc</b> sai",
  "foto.dof": "Profundidade de campo",
  "foto.foco": "Foco:",
  "foto.foco-centro": "no centro da órbita",
  "foto.foco-ponto": "no ponto escolhido",
  "foto.foco-em": "em {x}",
  "foto.focar-centro": "Focar no centro",
  "foto.foco-dica-toque": "Toque num ponto para focar ali; numa unidade ou construção, a órbita vai até ela e o foco a acompanha. Abertura maior (f menor) desfoca mais.",
  "foto.foco-dica": "Clique num ponto para focar ali; numa unidade ou construção, a órbita vai até ela e o foco a acompanha. Abertura maior (f menor) desfoca mais.",
  "foto.faixas": "Faixas de cinema 2,39:1",
  "foto.zerar": "Voltar ao filtro",
  "foto.hora-jogo": "Hora da partida",
  "foto.luz-dica": "A hora e a direção da luz mudam só a imagem; a partida não muda.",
  "foto.res": "Resolução da foto",
  "foto.res-tela": "Tela",
  "foto.res-tela-d": "Tamanho da tela",
  "foto.tirar-espaco": "Tirar a foto (Espaço)",
  "foto.tirar": "Tirar a foto",
  "foto.nota-multi": "Multiplayer: a partida continua rodando; o Modo Foto só solta a câmera.",
  "foto.nota-fenda": "Dificuldade Fenda: sem pausa; o Modo Foto só solta a câmera.",
  "foto.nota-sem-pos": "Sem o pós de cinema nesta qualidade ({x}): profundidade de campo, filtros e brilho ficam desligados. Câmera, luz, exposição, faixas e captura funcionam.",
  "foto.nota-celular": "celular",
  "foto.nota-baixa": "Baixa",
  "foto.nota-sem-filtros": "O desfoque e os filtros não subiram nesta placa; câmera, luz e captura funcionam.",
  "foto.nota-sem-dof": "A profundidade de campo não subiu nesta placa; filtros, luz e captura funcionam.",
  /* campanha */
  "camp.p1.titulo": "Acorde",
  "camp.p1.lugar": "Planalto de Ísk",
  "camp.p1.brief.0": "Comandante, os cinco mundos começaram a se alinhar e a Fenda abriu um planalto inteiro. O Núcleo está de pé; agora precisamos de energia e de quem colha.",
  "camp.p1.brief.1": "Siga as ordens na tela. Ninguém por perto vai incomodar. Por enquanto.",
  "camp.p1.obj.reator": "Construir um Reator",
  "camp.p1.obj.refinaria": "Construir uma Refinaria",
  "camp.p1.obj.coletores": "Ter 5 Coletores",
  "camp.p1.obj.coleta": "Coletar 800 em recursos",
  "camp.p1.obj.b-nodulo": "Construir um Nódulo de Avanço",
  "camp.p1.obj.b-rapido": "Concluir em menos de 7 min",
  "camp.p1.fala.0": "Selecione o Núcleo (F1) e produza Coletores (C). Depois, B e R para um Reator.",
  "camp.p1.fala.1": "Energia estável. Uma Refinaria perto dos nós de Minério encurta a viagem dos Coletores.",
  "camp.p1.fala.2": "Coletores colhem sozinhos dentro do seu território. Um Nódulo de Avanço amplia esse território.",
  "camp.p2.titulo": "Energia e regimes",
  "camp.p2.lugar": "Vale das Turbinas",
  "camp.p2.brief.0": "Toda estrutura consome energia. Abaixo de 100% entramos em racionamento: produção, sensores e torres pioram.",
  "camp.p2.brief.1": "Abaixo de 70% é colapso. Não quero ver isso no meu painel.",
  "camp.p2.obj.quartel": "Construir um Quartel",
  "camp.p2.obj.era2": "Evoluir o Núcleo para a Era II (selecione o Núcleo › Evoluir)",
  "camp.p2.obj.fabrica": "Construir uma Fábrica de Veículos",
  "camp.p2.obj.pleno": "Manter energia Plena por 60 s com Quartel e Fábrica de pé",
  "camp.p2.obj.pesquisa": "Pesquisar uma tecnologia no Laboratório",
  "camp.p2.obj.b-sem-colapso": "Nunca entrar em colapso de energia",
  "camp.p2.obj.b-sobrecarga": "Usar a Sobrecarga uma vez",
  "camp.p2.fala.0": "Cada Reator dá +35 de energia queimando Plasma. Fique de olho no medidor ⚡ lá em cima.",
  "camp.p2.fala.1": "Quartel e Refinaria de pé: o Núcleo já pode evoluir para a Era II. Selecione-o e toque em Evoluir. Fábrica, Hangar e Laboratório vêm depois disso.",
  "camp.p2.fala.2": "Era II! A colônia cresceu. Agora a Fábrica.",
  "camp.p2.fala.3": "Racionamento! Mais Reatores, Comandante.",
  "camp.p2.fala.4": "Rede estável. Agora o Laboratório: conhecimento é a moeda da Fenda.",
  "camp.p3.titulo": "A primeira tempestade",
  "camp.p3.lugar": "Bordas da Fenda",
  "camp.p3.brief.0": "O Éter está se acumulando. Quando a tempestade cai, drones e sensores sofrem, mas o Plasma rende em dobro lá dentro.",
  "camp.p3.brief.1": "Vocês chegaram tarde. Esta borda é nossa.",
  "camp.p3.brief.2": "Construa uma Torre. Eles virão quando o céu escurecer.",
  "camp.p3.obj.plasma": "Juntar 600 de Plasma",
  "camp.p3.obj.torre": "Construir uma Torre de Defesa",
  "camp.p3.obj.raid": "Repelir o ataque da tempestade",
  "camp.p3.obj.b-coletores": "Não perder nenhum Coletor",
  "camp.p3.obj.b-torre-cedo": "Torre pronta antes das 3:30",
  "camp.p3.fala.0": "Eles fugiram para dentro da tempestade. Boa leitura do céu, Comandante.",
  "camp.p3.ev.1": "Agora! Enquanto os sensores deles estão cegos!",
  "camp.a1m1.titulo": "Cerco",
  "camp.a1m1.lugar": "Passo de Kessari",
  "camp.a1m1.brief.0": "A Prole sentiu o cheiro do nosso Plasma. Ondas virão pelo passo leste.",
  "camp.a1m1.brief.1": "Muros são baratos e um Portão deixa as nossas tropas passarem. Feche o passo antes da primeira onda.",
  "camp.a1m1.obj.muros": "Construir 10 Muros e 1 Portão",
  "camp.a1m1.obj.ondas": "Sobreviver às 5 ondas (até 9:00)",
  "camp.a1m1.obj.b-nucleo": "Núcleo acima de 80% no fim",
  "camp.a1m1.obj.b-abates": "Abater 40 inimigos",
  "camp.a1m1.fala.0": "Arraste com o Muro selecionado (B, M) para desenhar uma linha inteira.",
  "camp.a1m1.ev.0": "Fome! Fome! Abram!",
  "camp.a1m1.ev.4": "A última onda trouxe um Brutamonte. Segure o Portão!",
  "camp.a1m2.titulo": "Caça a comboios",
  "camp.a1m2.lugar": "Rota das Dunas",
  "camp.a1m2.brief.0": "Comboios do Consórcio atravessam a rota a cada minuto. Cada Rebocador carrega Minério.",
  "camp.a1m2.brief.1": "Derrube os Rebocadores e recolha as Caixas antes que esfriem.",
  "camp.a1m2.obj.caixas": "Recolher 4 Caixas dos comboios",
  "camp.a1m2.obj.b-sem-fuga": "Nenhum comboio escapar",
  "camp.a1m2.obj.b-rapido": "Concluir em menos de 10 min",
  "camp.a1m2.fala.0": "Primeiro comboio entrando na rota. Use Atacar-mover (A) no caminho deles.",
  "camp.a1m2.fala.1": "Caixa recolhida. Mais três.",
  "camp.a1m3.titulo": "Sobrevivência noturna",
  "camp.a1m3.lugar": "Pântano Negro",
  "camp.a1m3.brief.0": "A noite cai e a Ninhada Cega caça no escuro. Não temos como ver longe.",
  "camp.a1m3.brief.1": "Escuro. Quente. Comida.",
  "camp.a1m3.brief.2": "Torres e luz. Aguente até o amanhecer.",
  "camp.a1m3.obj.amanhecer": "Sobreviver até o amanhecer (11:40)",
  "camp.a1m3.obj.b-predios": "Não perder nenhuma construção",
  "camp.a1m3.obj.b-torres": "Ter 3 Torres de Defesa",
  "camp.a2m1.titulo": "Roubo e contrarroubo",
  "camp.a2m1.lugar": "Refinarias de Ísk",
  "camp.a2m1.brief.0": "Tudo que vocês refinam também é nosso. Só ainda não sabem.",
  "camp.a2m1.brief.1": "Então jogamos o jogo deles. Piratas nos Reatores dos fundos da base deles, Torres nas nossas.",
  "camp.a2m1.obj.roubo": "Roubar 800 em recursos com Piratas (Quartel, tecla P)",
  "camp.a2m1.obj.piratas": "Abater 3 Piratas inimigos",
  "camp.a2m1.obj.b-perda": "Perder menos de 300 para roubo",
  "camp.a2m1.obj.b-rapido": "Concluir em menos de 12 min",
  "camp.a2m1.fala.0": "{pirata} (Quartel, tecla P): leve-o pela lateral até um Reator nos fundos da base inimiga e só então clique com o direito para Sifonar. {camuflagem}A Refinaria deles fica colada no exército. Ele volta sozinho e entrega ao encher ou após 40 s.",
  "camp.a2m1.fala.1": "O primeiro sifão é o mais doce.",
  "camp.a2m1.fala.0.camuflagem": "Ele fica camuflado até começar a drenar; Torres e o Núcleo enxergam de perto. ",
  "camp.a2m2.titulo": "Diplomacia forçada",
  "camp.a2m2.lugar": "Mesa de Kessari",
  "camp.a2m2.brief.0": "Pacto de Não-agressão, Comandante. Juntos esmagamos a Ordem do Molde.",
  "camp.a2m2.brief.1": "Assine. E não confie. O Consórcio já quebrou pactos por menos.",
  "camp.a2m2.obj.molde": "Destruir o Núcleo da Ordem do Molde",
  "camp.a2m2.obj.traicao": "Sobreviver à traição (Núcleo de pé aos 9:00)",
  "camp.a2m2.obj.b-traidor": "Destruir também o Núcleo do traidor",
  "camp.a2m2.obj.b-palavra": "Não quebrar nenhum pacto",
  "camp.a2m2.fala.0": "Pacto ativo com a Fundição Kessari. Concentre o ataque na Ordem do Molde.",
  "camp.a2m2.ev.2": "Batedores viram o Consórcio juntando blindados na fronteira. Torres no flanco deles, agora.",
  "camp.a2m2.ev.3": "Negócios, Comandante. Só negócios.",
  "camp.a2m3.titulo": "Escolta sob tempestade",
  "camp.a2m3.lugar": "Travessia do Éter",
  "camp.a2m3.brief.0": "A Arca de Dados precisa cruzar a Travessia até o ponto de extração. Ela é lenta e não atira.",
  "camp.a2m3.brief.1": "Que bela carga. Seria uma pena se a tempestade a escondesse de vocês.",
  "camp.a2m3.obj.chegar": "Levar a Arca de Dados até o ponto de extração",
  "camp.a2m3.obj.b-vida": "Arca acima de 50% de vida",
  "camp.a2m3.obj.b-rapido": "Concluir em menos de 10 min",
  "camp.a2m3.fala.0": "A Arca (anel dourado) está ao lado do Núcleo. Selecione-a e mande até o marcador de extração; leve escolta.",
  "camp.a2m3.falha": "A Arca de Dados foi destruída.",
  "camp.a3m1.titulo": "Primeiro contato",
  "camp.a3m1.lugar": "Cavernas de Quor",
  "camp.a3m1.brief.0": "Vocês fazem barulho. O Coro não suporta barulho.",
  "camp.a3m1.brief.1": "Eles atacam em acorde: muitos juntos ficam fortes. Separe-os e derrube um de cada vez.",
  "camp.a3m1.obj.resistir": "Resistir aos acordes até 9:00",
  "camp.a3m1.obj.abates": "Silenciar 30 unidades do Coro",
  "camp.a3m1.obj.b-nucleo": "Destruir o Núcleo do Coro",
  "camp.a3m1.obj.b-perdas": "Perder menos de 15 unidades",
  "camp.a3m1.ev.0": "Uníssono.",
  "camp.a3m2.titulo": "A Prole devora um aliado",
  "camp.a3m2.lugar": "Jardins de Oriel",
  "camp.a3m2.brief.0": "Os Carniceiros estão comendo nossos Nódulos vivos. Precisamos de vocês!",
  "camp.a3m2.brief.1": "Pacto com a Linhagem Oriel. Mate os Carniceiros primeiro: são eles que devoram.",
  "camp.a3m2.obj.aliado": "Manter o Núcleo da Linhagem Oriel de pé até 10:00",
  "camp.a3m2.obj.carniceiros": "Abater 6 Carniceiros",
  "camp.a3m2.obj.b-prole": "Destruir o Núcleo da Prole",
  "camp.a3m2.obj.b-nodulos": "O aliado perder no máximo 2 Nódulos",
  "camp.a3m2.falha": "A Linhagem Oriel foi devorada.",
  "camp.a3m3.titulo": "Aliança tripla instável",
  "camp.a3m3.lugar": "Fenda Menor",
  "camp.a3m3.brief.0": "Três contra a Prole. Simples.",
  "camp.a3m3.brief.1": "O Coro aceita. Por ora.",
  "camp.a3m3.brief.2": "Dois pactos, dois punhais. Destrua a Prole antes que os aliados mudem de ideia.",
  "camp.a3m3.obj.prole": "Destruir o Núcleo da Prole",
  "camp.a3m3.obj.b-pactos": "Os dois pactos de pé até 8:00",
  "camp.a3m3.obj.b-rep": "Terminar sem quebrar pactos",
  "camp.a3m3.ev.2": "O Estaleiro afina outra canção. Cuidado com o flanco do aço.",
  "camp.a3m3.ev.3": "O Estaleiro tem outros planos.",
  "camp.a4m1.titulo": "Assalto à Catedral Errante",
  "camp.a4m1.lugar": "Planície do Uníssono",
  "camp.a4m1.brief.0": "A Catedral canta. Quem ouve, ajoelha.",
  "camp.a4m1.brief.1": "Uma estrutura viva, armada e andando. Derrube a Catedral Errante e o Coro perde a voz.",
  "camp.a4m1.obj.catedral": "Destruir a Catedral Errante",
  "camp.a4m1.obj.b-rapido": "Concluir em menos de 16 min",
  "camp.a4m1.obj.b-nucleo": "Núcleo acima de 70% no fim",
  "camp.a4m2.titulo": "Matriarca encurralada",
  "camp.a4m2.lugar": "Ninho de Velk",
  "camp.a4m2.brief.0": "Mãe. Mãe. Mãe.",
  "camp.a4m2.brief.1": "A Matriarca choca Crias sem parar. Mate a mãe e o enxame desmonta.",
  "camp.a4m2.obj.matriarca": "Abater a Matriarca",
  "camp.a4m2.obj.b-crias": "Abater 60 Crias",
  "camp.a4m2.obj.b-predios": "Não perder nenhuma construção",
  "camp.a4m3.titulo": "A Fenda aberta",
  "camp.a4m3.lugar": "O Coração da Fenda",
  "camp.a4m3.brief.0": "Cinco Raças, uma vaga. O Alinhamento se fecha hoje: quem ficar de pé dita o que a Fenda cospe.",
  "camp.a4m3.brief.1": "Fome.",
  "camp.a4m3.brief.2": "Silêncio.",
  "camp.a4m3.brief.3": "Domínio.",
  "camp.a4m3.obj.dominio": "Vencer: último Núcleo de pé ou maior Domínio aos 25:00",
  "camp.a4m3.obj.b-nucleos": "Destruir 2 Núcleos",
  "camp.a4m3.obj.b-nodulos": "Terminar com 3 Nódulos",
  "camp.i-vehnar.titulo": "Produção sob sabotagem",
  "camp.i-vehnar.lugar": "Fundição Kessari",
  "camp.i-vehnar.brief.0": "Sifonadores nos Reatores a cada minuto. Isso é sabotagem, e sabotagem tem preço.",
  "camp.i-vehnar.brief.1": "Linhas de Montagem cheias. Vinte e cinco unidades de combate antes do turno acabar.",
  "camp.i-vehnar.obj.producao": "Produzir 25 unidades de combate em 12 min",
  "camp.i-vehnar.obj.b-roubo": "Perder menos de 400 para roubo",
  "camp.i-vehnar.obj.b-fabricas": "Ter 6 estruturas de produção",
  "camp.i-vehnar.falha": "O turno acabou antes da meta de produção.",
  "camp.i-erevane.titulo": "Só furtividade",
  "camp.i-erevane.lugar": "Arquipélago de Ísk",
  "camp.i-erevane.brief.0": "Sem exército. Sem barulho. Só mãos leves e um bom esconderijo.",
  "camp.i-erevane.brief.1": "Mil e quinhentos em recursos roubados e nenhum blindado nosso no mapa.",
  "camp.i-erevane.obj.roubo": "Roubar 1500 em recursos",
  "camp.i-erevane.obj.b-piratas": "Não perder nenhum Sifonador",
  "camp.i-erevane.obj.b-rapido": "Concluir em menos de 12 min",
  "camp.i-erevane.falha": "Você colocou um exército no mapa. A furtividade acabou.",
  "camp.i-tessara.titulo": "Nascer na noite",
  "camp.i-tessara.lugar": "Estufas de Oriel",
  "camp.i-tessara.brief.0": "Começamos no escuro: sem sol, a Fotossíntese do Núcleo rende pouco.",
  "camp.i-tessara.brief.1": "Adapte-se. Ganhe Traços. Quando o dia chegar, floresça e vença.",
  "camp.i-tessara.obj.vencer": "Destruir o Núcleo inimigo",
  "camp.i-tessara.obj.b-tracos": "Conquistar 3 Traços",
  "camp.i-tessara.obj.b-rapido": "Vencer antes das 20:00",
  "camp.i-quorith.titulo": "Nenhuma voz sozinha",
  "camp.i-quorith.lugar": "Catedral Partida",
  "camp.i-quorith.brief.0": "Uma voz isolada é quase silêncio. O Coro só vence em acorde.",
  "camp.i-quorith.brief.1": "Destrua o inimigo sem deixar nenhuma voz sozinha no campo.",
  "camp.i-quorith.obj.vencer": "Destruir o Núcleo inimigo",
  "camp.i-quorith.obj.b-acorde": "Nunca deixar uma unidade de combate isolada por 15 s",
  "camp.i-quorith.obj.b-unissono": "Usar o Uníssono",
  "camp.i-vorag.titulo": "A fome que floresce",
  "camp.i-vorag.lugar": "Campo de Carcaças",
  "camp.i-vorag.brief.0": "Carcaças por toda parte. Nódulos gordos do outro lado.",
  "camp.i-vorag.brief.1": "Devorar. Dois mil de biomassa antes de o eclipse passar.",
  "camp.i-vorag.obj.biomassa": "Devorar 2000 de biomassa com Carniceiros em 14 min",
  "camp.i-vorag.obj.b-nodulos": "Destruir 2 Nódulos inimigos",
  "camp.i-vorag.obj.b-eclosao": "Usar a Eclosão",
  "camp.i-vorag.falha": "O eclipse passou antes da colheita.",
  "camp.ia.ninho-dormente": "Ninho Dormente",
  "camp.ia.ruinas-de-vey": "Ruínas de Vey",
  "camp.ia.saqueadores-da-borda": "Saqueadores da Borda",
  "camp.ia.horda-de-velk": "Horda de Velk",
  "camp.ato.prologo": "Prólogo — Primeira Luz",
  "camp.ato.ato1": "Ato 1 — Penumbra",
  "camp.ato.ato2": "Ato 2 — Rotas de Éter",
  "camp.ato.ato3": "Ato 3 — Coro e Fome",
  "camp.ato.ato4": "Ato 4 — Eclipse Total",
  "camp.ato.identidade": "Missões de Identidade",
  "camp.rel.cofre-fendido.nome": "Cofre Fendido",
  "camp.rel.cofre-fendido.desc": "+300 Minério e +150 Plasma no início; −8% na coleta.",
  "camp.rel.lente-de-eter.nome": "Lente de Éter",
  "camp.rel.lente-de-eter.desc": "+20% de visão para tudo; torres com −10% de vida.",
  "camp.rel.semente-viva.nome": "Semente Viva",
  "camp.rel.semente-viva.desc": "Unidades regeneram 1,5 de vida/s fora de combate; −6% de velocidade.",
  "camp.rel.coracao-de-forja.nome": "Coração de Forja",
  "camp.rel.coracao-de-forja.desc": "Produção 12% mais rápida; Reatores queimam 25% mais Plasma.",
  "camp.rel.ancora-de-mare.nome": "Âncora de Órbita",
  "camp.rel.ancora-de-mare.desc": "Superarma recarrega 30% mais rápido; −10% de energia.",
  "camp.rel.eco-do-coro.nome": "Eco do Coro",
  "camp.rel.eco-do-coro.desc": "+1 Salto de Núcleo e +10% de energia; −8% na coleta.",
  "camp.conq.primeiro-passo.nome": "Primeiro passo",
  "camp.conq.primeiro-passo.desc": "Concluir a primeira missão da campanha.",
  "camp.conq.prologo.nome": "Acordado",
  "camp.conq.prologo.desc": "Concluir o Prólogo.",
  "camp.conq.ato-1.nome": "Despertar",
  "camp.conq.ato-1.desc": "Concluir o Ato 1.",
  "camp.conq.ato-2.nome": "Senhor das rotas",
  "camp.conq.ato-2.desc": "Concluir o Ato 2.",
  "camp.conq.ato-3.nome": "Ouvido do Coro",
  "camp.conq.ato-3.desc": "Concluir o Ato 3.",
  "camp.conq.ato-4.nome": "Domínio",
  "camp.conq.ato-4.desc": "Concluir o Ato 4.",
  "camp.conq.identidade.nome": "Cinco vozes",
  "camp.conq.identidade.desc": "Concluir todas as Missões de Identidade.",
  "camp.conq.tres-estrelas.nome": "Perfeccionista",
  "camp.conq.tres-estrelas.desc": "Conseguir 3 estrelas numa missão.",
  "camp.conq.fenda.nome": "Filho da Fenda",
  "camp.conq.fenda.desc": "Vencer uma missão na dificuldade Fenda.",
  "camp.conq.nucleo-intacto.nome": "Núcleo intacto",
  "camp.conq.nucleo-intacto.desc": "Vencer com o Núcleo acima de 90% de vida.",
  "camp.conq.so-infantaria.nome": "Só infantaria",
  "camp.conq.so-infantaria.desc": "Vencer usando apenas Infantaria em combate.",
  "camp.conq.pacifista-10.nome": "Pacifista até o minuto 10",
  "camp.conq.pacifista-10.desc": "Vencer uma partida sem causar dano nos primeiros 10 minutos.",
  "camp.conq.primeiro-sifao.nome": "Mão leve",
  "camp.conq.primeiro-sifao.desc": "Roubar recursos com um Pirata.",
  "camp.conq.muralha.nome": "Muralha",
  "camp.conq.muralha.desc": "Construir 20 Muros numa partida.",
  "camp.conq.traidor.nome": "Golpe de Traição",
  "camp.conq.traidor.desc": "Quebrar um pacto.",
  "camp.conq.diplomata.nome": "Palavra dada",
  "camp.conq.diplomata.desc": "Cumprir um pacto até o fim.",
  "camp.conq.cinco-racas.nome": "Cinco Mundos",
  "camp.conq.cinco-racas.desc": "Vencer uma partida com cada Raça.",
  "camp.conq.comandante-10.nome": "Comandante veterano",
  "camp.conq.comandante-10.desc": "Chegar ao nível 10.",
  "camp.conq.comandante-30.nome": "Lenda da Fenda",
  "camp.conq.comandante-30.desc": "Chegar ao nível 30.",
  "camp.titulo-cmd.primeiro-passo": "Recruta do Alinhamento",
  "camp.titulo-cmd.prologo": "Desperto",
  "camp.titulo-cmd.ato-1": "Guardião do Cerco",
  "camp.titulo-cmd.ato-2": "Senhor das Rotas",
  "camp.titulo-cmd.ato-3": "Ouvido do Coro",
  "camp.titulo-cmd.ato-4": "Dominador",
  "camp.titulo-cmd.identidade": "Cinco Vozes",
  "camp.titulo-cmd.tres-estrelas": "Perfeccionista",
  "camp.titulo-cmd.fenda": "Filho da Fenda",
  "camp.titulo-cmd.nucleo-intacto": "Inabalável",
  "camp.titulo-cmd.cinco-racas": "Senhor dos Cinco Mundos",
  "camp.titulo-cmd.comandante-30": "Lenda da Fenda",
  "camp.obj-concluido": "Objetivo concluído: {obj}.",
  "camp.fim.vitoria": "Missão cumprida: {titulo}.",
  "camp.fim.nucleo": "Seu Núcleo foi destruído.",
  "camp.fim.tempo": "O tempo acabou.",
  "camp.fim.dominio": "Outra Raça ficou com o Domínio.",
  "camp.pg.muros": "{a}/10 muros, {b}/1 portão",
  "camp.pg.ondas": "{n}/5 ondas",
  "camp.pg.faltam": "faltam {t}",
  "camp.pg.distancia": "{d} de distância",
  "camp.pg.vida": "{v} de vida",
  "camp.comandante": "Comandante",
  "camp.campanha": "Campanha",
  "camp.mini": "Comandante nível {n} · {xp} XP · {e} ★ na campanha",
  "camp.mini.reliquias": "relíquias: {lista}",
  "camp.nv": "Nv {n}",
  "camp.nivel": "nível {n}",
  "camp.nivel-max": "Nível máximo · {xp} XP",
  "camp.nivel-prox": "{a} / {b} XP para o nível {n} · {e} ★",
  "camp.bloqueada": "Conclua a missão anterior",
  "camp.so-raca": "só {raca}",
  "camp.bonus": "Bônus",
  "camp.rel.fonte-missao": "missão {titulo}",
  "camp.rel.equipada": "Equipada · tirar",
  "camp.rel.equipar": "Equipar",
  "camp.rel.desbloqueia": "Desbloqueia: {fonte}",
  "camp.br.adversarios": "adversários: {lista}",
  "camp.br.aliado": "aliado",
  "camp.br.rel-equipadas": "Relíquias equipadas: {lista}.",
  "camp.br.rel-nenhuma": "Nenhuma relíquia equipada.",
  "camp.br.recompensa": "Recompensa: relíquia {nome}.",
  "camp.br.melhor": "Melhor resultado: {r}.",
  "camp.br.nao-concluida": "ainda não concluída",
  "camp.card.missoes": "{a}/{b} missões",
  "camp.card.missao-raca": "missão da Raça {raca}",
  "camp.card.raca-fixa": "{raca} (fixa nesta missão)",
  "camp.card.raca-troca": "{raca} · troque ao lado",
  "camp.card.continuar": "Continuar: {titulo}",
  "camp.card.comecar": "Começar a campanha",
  "camp.card.dif": "Dificuldade da missão",
  "camp.card.todas": "Todas as missões",
  "camp.hg.skin.0": "Padrão",
  "camp.hg.skin.1": "Fortaleza",
  "camp.hg.skin.2": "Santuário",
  "camp.hg.retrato.3": "Triunfante",
  "camp.hg.nota": "Os tons são da paleta da {raca} e valem no solo, na campanha e no multiplayer (se dois jogadores escolherem tons parecidos, o segundo recebe o próximo tom). O Núcleo e o retrato aparecem nas suas partidas.",
  "camp.hg.tom": "tom {c}",
  "camp.hg.sem3d": "Visualização 3D indisponível neste navegador.",
  "camp.hg.carregando": "Carregando o 3D…",
  "camp.hg.tom-raca": "Tom da sua Raça",
  "camp.hg.nucleo": "Núcleo",
  "camp.retomada": "De volta ao comando. A missão continua de onde parou.",
  "camp.fim.recorde": "novo recorde",
  "camp.fim.melhor": "melhor: {n} ★",
  "camp.fim.xp": "+{xp} XP · Comandante nível {n}",
  "camp.fim.subiu": "(subiu de nível!)",
  "camp.fim.nivel-max": "nível máximo",
  "camp.fim.reliquia": "Relíquia desbloqueada: <b>{nome}</b> — {desc} (equipe na tela da campanha)",
  "camp.fim.conquista": "🏅 Conquista: <b>{nome}</b> — {desc}",
  "camp.fim.titulo": "título \"{titulo}\" no Hangar",
  "camp.backup.copiado": "Código copiado",
  "camp.backup.copiar": "Copiar código de backup",
  "camp.backup.importado": "Progresso importado",
  "camp.backup.importar": "Importar código",
  "camp.backup.invalido": "Código inválido",
  "camp.backup.corrompido": "Código corrompido (soma não confere)",
  "camp.backup.placeholder": "Cole aqui o código de backup (ARD1-…) e clique em Importar código",
  "camp.ui.fechar": "Fechar",
  "camp.ui.alinhamento": "O Grande Alinhamento",
  "camp.ui.intro": "De tempos em tempos os cinco mundos se alinham, a Fenda se abre e o Domínio troca de mãos. Jogue com a Raça escolhida na tela inicial; as Missões de Identidade usam a própria Raça e abrem depois do Prólogo. Estrelas: 1 pela missão e +1 por bônus cumprido.",
  "camp.ui.reliquias": "Relíquias <span class=\"muted small\">(até 2 equipadas, valem só na campanha)</span>",
  "camp.ui.conquistas": "Conquistas",
  "camp.ui.objetivos": "Objetivos",
  "camp.ui.raca": "Raça",
  "camp.ui.dificuldade": "Dificuldade",
  "camp.ui.fenda-longo": "Fenda (sem pausa, tempestades frequentes)",
  "camp.ui.iniciar": "Iniciar missão",
  "camp.ui.voltar": "Voltar",
  "camp.ui.personalizacao": "Personalização",
  "camp.ui.salvar": "Salvar",
  "camp.hg.retrato.1.f": "Serena",
  "camp.hg.retrato.1.m": "Sereno",
  "camp.hg.retrato.2.f": "Furiosa",
  "camp.hg.retrato.2.m": "Furioso",
  "camp.hg.retrato-rotulo.f": "Retrato da líder no HUD",
  "camp.hg.retrato-rotulo.m": "Retrato do líder no HUD",
  /* diplo-fim */
  "diplo.em-pacto": "em pacto",
  "diplo.em-guerra": "em guerra",
  "diplo.eliminado": "eliminado",
  "diplo.reputacao": "Sua reputação: {rep}. Pactos cumpridos sobem a reputação; quebrar pactos derruba. Caução: 150 Minério por lado, devolvida ao fim do pacto; quem quebra perde a dele para a vítima.",
  "diplo.quorith": "Como Quorith, sua Caução é 75 e cada pacto cumprido rende o dobro de reputação.",
  "diplo.ativa": "Não-agressão ativa · restam {t}",
  "diplo.quebrar": "Quebrar pacto (Golpe de Traição)",
  "diplo.propoe": "Propõe Não-agressão (10 min, Caução 150)",
  "diplo.aceitar": "Aceitar",
  "diplo.recusar": "Recusar",
  "diplo.enviada": "Proposta enviada, aguardando resposta",
  "diplo.propor": "Propor Não-agressão (Caução {n})",
  "diplo.quebrar-q": "Quebrar o pacto com {nome}? Você perde a Caução, ganha +20% de dano por 45 s e sua Reputação cai.",
  "diplo.proposta": "{nome} propõe um pacto de Não-agressão por 10 min (Caução 150 Minério).",
  "hud.dica.col": "Selecione o Núcleo (F1) e produza Coletores (C) até ter 5.",
  "hud.dica.reator": "Construa um Reator (B → R). Energia abaixo de 100% deixa tudo mais lento.",
  "hud.dica.quartel": "Construa um Quartel (B → Q) e treine Infantaria (I).",
  "hud.dica.nodulo": "Expanda com um Nódulo (B → N) perto de cristais de Plasma. Coletores colhem sozinhos no seu território; para outro campo, mande-os com o botão direito.",
  "hud.dica.refinaria": "Uma Refinaria (B → F) perto dos nós encurta as viagens dos coletores.",
  "hud.dica.muro": "Muros (B → M) se desenham arrastando o mouse. Deixe um Portão (G) para suas unidades passarem.",
  "hud.dica.pirata": "Treine um Pirata (P) no Quartel e clique com o direito em uma Refinaria inimiga para Sifonar.",
  "hud.dica.diplo": "Abra a Diplomacia e proponha Não-agressão a quem está forte demais. Ou quebre um pacto na hora certa.",
  "hud.dica.lab": "Um Laboratório (B → L) libera pesquisas e a superarma da sua Raça.",
  "hud.conselho": "Conselho",
  "hud.adv.evoluir": "Evoluir",
  "hud.adv.titulo": "Recursos parados",
  "hud.adv.plasma-evo": "Você tem {amt} parado: evolua para a Era {era} ou construa Torres de Defesa.",
  "hud.adv.plasma-torres": "Você tem {amt} parado: construa Torres de Defesa.",
  "hud.adv.plasma-torres2": "Você tem {amt} parado: construa Torres de Defesa, uma Fábrica ou um Hangar.",
  "hud.adv.quartel": "Você tem {amt} parado: construa um Quartel.",
  "hud.adv.quartel-evo": "Você tem {amt} parado: construa um Quartel ou evolua para a Era {era}.",
  "hud.adv.evo": "Você tem {amt} parado: evolua para a Era {era} ({nome}) ou construa mais um Quartel.",
  "hud.adv.refinaria": "Você tem {amt} parado: construa uma Refinaria perto dos nós; com ela e o Quartel você evolui para a Era II.",
  "hud.adv.lab": "Você tem {amt} parado: construa um Laboratório (pesquisas e Era III) ou uma Fábrica.",
  "hud.adv.tropas": "Você tem {amt} parado: ponha tropas na fila do Quartel, construa Torres ou expanda com um Nódulo.",
  "multi.chat.sala": "Sala {codigo}: {nomes}.",
  "multi.um-jogador": "Um jogador",
  "multi.desconectado": "Jogador desconectado",
  "multi.desconectado-txt": "{nome} caiu; as unidades dele ficam paradas. Se voltar em até 2 minutos, retoma o comando.",
  "multi.desconectou": "{nome} desconectou.",
  "multi.nao-voltou": "Não foi possível voltar à sala",
  "multi.nao-voltou-txt": "O anfitrião não respondeu em 2 minutos. A partida terminou para você.",
  "multi.volta-esgotada": "Volta à sala esgotada.",
  "multi.conexao-perdida": "Conexão perdida",
  "multi.conexao-perdida-txt": "Tentando voltar à sala… a partida continua de onde parou.",
  "multi.conexao-perdida-log": "Conexão perdida com o anfitrião; reconectando.",
  "multi.recusou-volta": "A sala recusou a volta",
  "multi.motivo": "Motivo: {motivo}.",
  "multi.volta-recusada": "Volta recusada: {motivo}",
  "multi.falha-sinc": "Falha ao sincronizar",
  "multi.sincronizada": "Partida sincronizada no tempo {t}.",
  "multi.reconectado": "Reconectado à sala {codigo}.",
  "multi.voltou-j": "Jogador voltou",
  "multi.voltou-j-txt": "{nome} voltou à partida.",
  "multi.voltou-log": "{nome} voltou.",
  "multi.dessinc": "Dessincronização",
  "multi.dessinc-txt": "Os mundos divergiram no tick {tick}. Isto não deveria acontecer; exporte o resultado no fim e envie o feedback com os navegadores usados.",
  "multi.dessinc-log": "Dessincronização no tick {tick} (jogador {nome}).",
  "fim.campanha": "Campanha",
  "fim.missao-cumprida": "MISSÃO CUMPRIDA",
  "fim.missao-falhou": "MISSÃO FALHOU",
  "fim.st.tempo": "Tempo",
  "fim.st.coletado": "Coletado",
  "fim.st.roubado": "Roubado",
  "fim.st.abatidas": "Unidades abatidas",
  "fim.st.perdidas": "Unidades perdidas",
  "fim.st.estruturas": "Estruturas destruídas",
  "fim.st.perdido-roubo": "Perdido para roubo",
  "fim.st.tratados": "Tratados",
  "fim.st.traicoes": "Traições",
  "fim.st.reputacao": "Reputação final",
  "fim.repetir": "Repetir missão",
  "fim.dominio": "DOMÍNIO",
  "fim.colapso": "COLAPSO",
  "fim.vencedor": "Vencedor: {nome}.",
  "fim.jogador": "Jogador",
  "fim.dominio-col": "Domínio",
  "fim.copiado": "Copiado! Cole na Issue de feedback",
  "hud.pb.sem-recursos": "recursos insuficientes",
  "hud.pb.valido": "local válido · arraste para ajustar",
  "hud.sem-pausa-mp": "Sem pausa no multiplayer",
  "hud.sem-pausa-fenda": "Sem pausa na dificuldade Fenda",
  /* outros-meta */
  "meta.descricao": "Estratégia em tempo real grátis no navegador: cinco Raças disputam a Fenda. Campanha com história, escaramuça contra a IA e partidas online de 2 a 4 jogadores — em português, inglês e espanhol. Sem instalar, no PC e no celular.",
  "voz.amostra": "Comandante, a Fenda está estável e o Núcleo aguarda as suas ordens.",
  "voz.grupo.principal": "Português do Brasil",
  "voz.grupo.outras": "Outras vozes em português",
  "voz.regiao.outra": "Portugal",
  "voz.auto": "Automática",
  "voz.falhou": "(falhou agora)",
  "voz.indisp": "(indisponível agora)",
  "voz.tag.robotica": "robótica",
  "voz.tag.antiga": "antiga do Windows",
  "voz.tag.apple": "Apple",
  "voz.tag.apple-apr": "Apple aprimorada",
  "voz.tag.neural": "neural do Edge",
  "voz.d.sem": "Este navegador não tem voz do sistema: as falas aparecem só nas legendas.",
  "voz.d.nenhuma": "Nenhuma voz em português neste aparelho: as falas aparecem nas legendas.",
  "voz.d.nenhuma-win": "No Windows, o Edge traz vozes neurais (Francisca, Antonio, Thalita).",
  "voz.d.edge": "Vozes neurais do Edge: soam naturais e precisam de internet; sem rede, o jogo passa para a melhor voz do aparelho.",
  "voz.d.google": "A voz do Google precisa de internet; sem rede, o jogo passa para a melhor voz do aparelho.",
  "voz.d.apple": "{onde} › Acessibilidade › Conteúdo Falado › Vozes › Português (Brasil): baixe a Luciana ou o Felipe (Aprimorada) e recarregue o jogo.",
  "voz.d.ios": "No iPhone e no iPad: Ajustes",
  "voz.d.mac": "No Mac: Ajustes do Sistema",
  "voz.d.firefox": "O Firefox só enxerga as vozes antigas do Windows. Para uma voz natural, use o Edge (Francisca, Antonio, Thalita) ou o Chrome (Google português do Brasil).",
  "voz.d.win": "Estas são as vozes antigas do Windows. O Edge traz vozes neurais (Francisca, Antonio, Thalita) e o Chrome, a Google português do Brasil.",
  "voz.d.android": "No Android, a voz vem do mecanismo de texto para fala do aparelho (Ajustes › Acessibilidade › Saída de texto para fala).",
  "voz.teste": "Som testado, Comandante. Efeitos e voz no ar.",
  "voz.diag.audio": "Áudio",
  "voz.diag.sessao": "Sessão de reprodução",
  "voz.diag.vozes": "Vozes em português",
  "voz.diag.voz": "Voz",
  "voz.diag.fala": "Fala",
  "voz.diag.sim": "sim",
  "voz.diag.sim-mudo": "sim (áudio mudo em laço)",
  "voz.diag.nao-precisa": "não precisa neste aparelho",
  "voz.diag.nao": "não",
  "voz.diag.sem-webaudio": "sem Web Audio",
  "voz.diag.padrao": "padrão do aparelho",
  "voz.diag.sem-voz": "sem voz do sistema",
  "voz.diag.efeitos-off": "efeitos desligados em Ajustes",
  "voz.diag.voz-off": "voz do jogo desligada",
  "voz.diag.e.running": "tocando",
  "voz.diag.e.suspended": "suspenso",
  "voz.diag.e.interrupted": "interrompido",
  "voz.diag.e.closed": "fechado",
  "voz.diag.f.esperando": "esperando",
  "voz.diag.f.falando": "falando",
  "voz.diag.f.tocou": "tocou",
  "voz.diag.f.falhou": "falhou",
  "voz.diag.f.nao-comecou": "não começou",
  "voz.diag.f.sem-resposta": "sem resposta (toque em Testar som de novo)",
  "voz.diag.ios-silencio": "Não ouviu a voz? No iPhone, confira a chave de silêncio: ela pode calar a voz do sistema sem calar os efeitos. Se ainda não sair, escolha em Voz das falas uma voz sem \"Aprimorada\".",
  "ajustes.vozes-gravadas": "Vozes gravadas: cada Raça com a sua voz", /* 5.0c.1 */
  "ajustes.vozes-gravadas-dica": "Desligadas, as falas usam a voz do sistema escolhida abaixo.", /* 5.0c.1 */
  "voz.diag.gravada": "Voz gravada", /* 5.0c.1 */
  "voz.diag.g.tocou": "tocou", /* 5.0c.1 */
  "voz.diag.g.sem-arquivo": "sem arquivo", /* 5.0c.1 */
  "voz.diag.g.formato": "formato não decodifica", /* 5.0c.1 */
  "voz.diag.g.tocando": "tocando", /* 5.0c.1 */
  "voz.diag.g.esperando": "carregando", /* 5.0c.1 */
  "voz.diag.g.desligada": "desligada em Ajustes", /* 5.0c.1 */
  "voz.diag.g.suspenso": "Web Audio suspenso", /* 5.0c.1 */
  "voz.diag.interrompido-fala": "a voz do sistema interrompeu o áudio do jogo", /* 5.0c.1 */
  "voz.diag.voltou": "já voltou", /* 5.0c.1 */
  "voz.d.ios-gravadas": "No iPhone, o jogo fala com as vozes gravadas de cada Raça, pelo mesmo som dos efeitos. A voz do sistema escolhida aqui só vale para o Ouvir.", /* 5.0c.1 */
  "geral.idioma-offline": "Sem internet: este idioma ainda não foi baixado neste aparelho.",
  "cine.pular": "Pular", /* 5.0f */
  "cine.rever": "Rever a cena", /* 5.0f */
  "cine.sala": "Sala de Guerra", /* 5.0f */
  "cine.voce": "Você", /* 5.0f */
  "cine.aliado": "Aliado", /* 5.0f */
  "cine.ameaca": "Ameaça", /* 5.0f */
  "cine.rota": "Rota de ataque", /* 5.0f */
  "cine.superarma": "Superarma", /* 5.0f */
  "cine.chefao": "Chefão", /* 5.0f */
  "cine.chefe.catedral": "O relicário do Coro caminha cantando", /* 5.0f */
  "cine.chefe.matriarca": "Rainha da Prole, mãe de todas as Crias", /* 5.0f */
  "cine.op.cenas": "Cenas de cinema: Sala de Guerra, abertura das missões e entrada dos chefões", /* 5.0f */
  "cine.op.super": "Câmera de ação da superarma", /* 5.0f */
  "mapa.tita": "Destroço do Titã", /* 5.0g */
  "inicio.jogar.tita-carcaca": "Destroço do Titã (carcaça de um titã caído)", /* 5.0g */
  "vitrine.mapa.tita": "A carcaça de um titã caído sobre a Fenda: costelas, placas e o crânio.", /* 5.0g */
  "unit.arauto.nome": "O Arauto", /* 5.0g */
  "unit.arauto.desc": "Monólito-lente dos Despertos, o primeiro a atravessar a Fenda.", /* 5.0g */
  "unit.forja.nome": "A Forja-Mãe", /* 5.0g */
  "unit.forja.desc": "Fábrica antiga dos Construtores que anda sobre quatro pernas.", /* 5.0g */
  "unit.sentinela.nome": "Sentinela da Fenda", /* 5.0g */
  "unit.sentinela.desc": "Um Arauto menor que vigia a Fenda.", /* 5.0g */
  "unit.pilar_fenda.nome": "Pilar da Fenda", /* 5.0g */
  "unit.pilar_fenda.desc": "Alimenta o escudo do Arauto.", /* 5.0g */
  "unit.perna_forja.nome": "Perna da Forja", /* 5.0g */
  "unit.perna_forja.desc": "Ponto fraco da Forja-Mãe: cada perna destruída a deixa 25% mais lenta.", /* 5.0g */
  "chefe.arauto.nome": "O Arauto", /* 5.0g */
  "chefe.arauto.titulo": "O primeiro a atravessar a Fenda", /* 5.0g */
  "chefe.arauto.fase.1": "Três Pilares", /* 5.0g */
  "chefe.arauto.fase.2": "Ecos", /* 5.0g */
  "chefe.arauto.fase.3": "Colapso", /* 5.0g */
  "chefe.forja.nome": "A Forja-Mãe", /* 5.0g */
  "chefe.forja.titulo": "A fábrica antiga que anda", /* 5.0g */
  "chefe.forja.fase.1": "Marcha", /* 5.0g */
  "chefe.forja.fase.2": "Linha de montagem", /* 5.0g */
  "chefe.forja.fase.3": "Núcleo exposto", /* 5.0g */
  "chefe.sentinela.nome": "Sentinela da Fenda", /* 5.0g */
  "chefe.sentinela.titulo": "Vigia da Fenda", /* 5.0g */
  "chefe.sentinela.fase.1": "Vigia", /* 5.0g */
  "sim.chefe.classe": "Chefões", /* 5.0g */
  "sim.chefe.sentinela": "A Sentinela da Fenda despertou no centro do mapa", /* 5.0g */
  "sim.chefe.atravessou": "{nome} atravessou a Fenda", /* 5.0g */
  "sim.chefe.fase": "Nova fase de {nome}: {fase}", /* 5.0g */
  "sim.chefe.escudo": "O escudo do Arauto caiu!", /* 5.0g */
  "sim.chefe.derrotado": "Chefão derrotado: {nome}", /* 5.0g */
  "sim.chefe.capturado": "Chefão capturado: {nome}", /* 5.0g */
  "sim.chefe.fim-caiu": "O chefão caiu.", /* 5.0g */
  "sim.chefe.fim-resistiu": "O chefão resistiu até o fim do Alinhamento.", /* 5.0g */
  "modos.aba": "Caçada", /* 5.0g */
  "modos.cac.titulo": "Caçada", /* 5.0g */
  "modos.cac.sub": "derrube um chefão da Fenda, sozinho ou com amigos", /* 5.0g */
  "modos.cac.chefao": "Chefão", /* 5.0g */
  "modos.cac.arena": "Arena: {mapa}", /* 5.0g */
  "modos.cac.recorde": "Recorde: {t}", /* 5.0g */
  "modos.cac.sem-recorde": "Sem recorde ainda", /* 5.0g */
  "modos.cac.dificuldade": "Dificuldade", /* 5.0g */
  "modos.cac.aliados": "Aliados", /* 5.0g */
  "modos.cac.sozinho": "Sozinho", /* 5.0g */
  "modos.cac.ia1": "1 IA aliada", /* 5.0g */
  "modos.cac.ia2": "2 IAs aliadas", /* 5.0g */
  "modos.cac.amigos": "Amigos", /* 5.0g */
  "modos.cac.regras": "Vitória: derrubar o chefão. Derrota: perder o Núcleo (no cooperativo, todos os Núcleos). Medalha por tempo e perdas.", /* 5.0g */
  "modos.cac.medalhas": "Ouro: até {t1} e {p1} perdas · Prata: até {t2} e {p2} perdas · Bronze: qualquer vitória", /* 5.0g */
  "modos.cac.iniciar": "Iniciar Caçada", /* 5.0g */
  "modos.cac.ir-sala": "Abrir a sala cooperativa", /* 5.0g */
  "modos.mut.titulo": "Mutadores", /* 5.0g */
  "modos.mut.noite": "Noite Eterna", /* 5.0g */
  "modos.mut.noite-d": "a noite não acaba e a visão cai 25%", /* 5.0g */
  "modos.mut.tempestades": "Tempestades Frequentes", /* 5.0g */
  "modos.mut.tempestades-d": "Tempestades de Éter o dobro de vezes; dentro delas, unidades 10% mais lentas", /* 5.0g */
  "modos.mut.escassos": "Recursos Escassos", /* 5.0g */
  "modos.mut.escassos-d": "nós e destroços rendem a metade", /* 5.0g */
  "modos.ev.titulo": "Eventos da Fenda", /* 5.0g */
  "modos.ev.desc": "Sentinela da Fenda, Caravana Corsária, Enxame Errante e chuva de meteoros durante a partida", /* 5.0g */
  "modos.lente": "Lente do Arauto", /* 5.0g */
  "modos.lente-d": "+10% de visão nesta partida", /* 5.0g */
  "modos.sala.modo": "Modo da sala", /* 5.0g */
  "modos.sala.escaramuca": "Escaramuça", /* 5.0g */
  "modos.sala.cacada": "Caçada", /* 5.0g */
  "modos.sala.dica-cac": "Todos os humanos do mesmo lado contra a Fenda; o anfitrião escolhe o chefão.", /* 5.0g */
  "modos.sala.dica-esc": "Todos contra todos; o anfitrião escolhe as regras.", /* 5.0g */
  "modos.sala.linha-cac": "Caçada cooperativa: {chefe} ({dif}) · todos contra a Fenda", /* 5.0g */
  "modos.sala.linha-esc": "Escaramuça: todos contra todos", /* 5.0g */
  "modos.cartao.cacada": "Caçada · {chefe} · {dif}", /* 5.0g */
  "modos.medalha.ouro": "Ouro", /* 5.0g */
  "modos.medalha.prata": "Prata", /* 5.0g */
  "modos.medalha.bronze": "Bronze", /* 5.0g */
  "modos.fim.vitoria": "Caçada vencida", /* 5.0g */
  "modos.fim.derrota": "A Fenda venceu", /* 5.0g */
  "modos.fim.eyebrow": "Caçada · {chefe} · {dif}", /* 5.0g */
  "modos.fim.medalha": "Medalha: {m}", /* 5.0g */
  "modos.fim.tempo": "Tempo", /* 5.0g */
  "modos.fim.perdas": "Perdas", /* 5.0g */
  "modos.fim.recorde": "Recorde", /* 5.0g */
  "modos.fim.recorde-novo": "Novo recorde local!", /* 5.0g */
  "modos.fim.trofeu": "Troféu no Hangar: {chefe} ({m})", /* 5.0g */
  "modos.fim.reliquia": "Relíquia: Lente do Arauto (+10% de visão numa partida que você escolher)", /* 5.0g */
  "modos.fim.titulo": "Título: {t}", /* 5.0g */
  "modos.fim.projeto": "Projeto recuperado da Forja-Mãe: a unidade nova chega numa próxima versão", /* 5.0g */
  "modos.titulo.cacador-arauto": "Caçador do Arauto", /* 5.0g */
  "modos.titulo.quebra-forja": "Quebra-Forja", /* 5.0g */
  "modos.titulo.cacador-ouro": "Caçador de Ouro", /* 5.0g */
  "modos.hg.trofeus": "Troféus da Caçada", /* 5.0g */
  "modos.hg.nenhum": "Nenhum troféu ainda: vença uma Caçada.", /* 5.0g */
  "modos.hg.titulos": "Títulos", /* 5.0g */
  "modos.hg.projetos": "Projetos", /* 5.0g */
  "modos.hg.projeto-forja": "projeto da Forja-Mãe (a unidade chega numa próxima versão)", /* 5.0g */
  "modos.hg.sentinelas": "Sentinelas derrubadas: {n}", /* 5.0g */
  "sim.ev.sentinela-aviso": "A Sentinela da Fenda está despertando no centro do mapa ({n} s)", /* 5.0g */
  "sim.ev.sentinela-chega": "A Sentinela da Fenda despertou no centro! Quem der o golpe final leva a recompensa", /* 5.0g */
  "sim.ev.sentinela-premio": "{nome} derrubou a Sentinela da Fenda e levou a recompensa", /* 5.0g */
  "sim.ev.caravana-aviso": "Caravana Corsária à vista: ela vai cruzar o mapa ({n} s)", /* 5.0g */
  "sim.ev.caravana-chega": "A Caravana Corsária está cruzando o mapa. Quem a destruir fica com a carga", /* 5.0g */
  "sim.ev.caravana-carga": "{nome} tomou uma carga da Caravana Corsária (+{n})", /* 5.0g */
  "sim.ev.enxame-aviso": "Enxame Errante se aproximando ({n} s)", /* 5.0g */
  "sim.ev.enxame-chega": "O Enxame Errante chegou: ele ataca o que estiver mais perto", /* 5.0g */
  "sim.ev.meteoros-aviso": "Chuva de meteoros em {n} s: fique longe dos anéis no chão", /* 5.0g */
  "sim.ev.meteoros-chega": "Chuva de meteoros! Cristais novos onde eles caem", /* 5.0g */
  "sim.cac.vitoria": "O chefão caiu: Caçada vencida.", /* 5.0g */
  "sim.cac.captura": "A Forja-Mãe foi capturada: Caçada vencida.", /* 5.0g */
  "sim.cac.time-caiu": "Todos os Núcleos do time caíram.", /* 5.0g */
  "sim.cac.tempo": "O tempo da Caçada acabou: o chefão resistiu.", /* 5.0g */
  "sim.fenda": "Fenda", /* 5.0g */
  "chefe.ui.fase": "Fase {n}", /* 5.0g */
  "chefe.ui.escudo": "Escudo", /* 5.0g */
  "chefe.ui.pontos": "Pontos fracos", /* 5.0g */
  "chefe.ui.janela": "Janela de dano", /* 5.0g */
  "chefe.ui.janela-k": "Agora!", /* 5.0g */
  "chefe.ui.derrotado": "Derrotado", /* 5.0g */
  "chefe.ui.fenda": "Da Fenda", /* 5.0g */
  "sim.chefe.desperta-em": "{nome} desperta em {t}", /* 5.0g.1 */
  "sim.chefe.despertou": "{nome} despertou!", /* 5.0g.1 */
  "sim.chefe.despertou-atacado": "{nome} despertou com o ataque!", /* 5.0g.1 */
  "chefe.ui.desperta": "Desperta em {t}", /* 5.0g.1 */
  "chefe.ui.despertou": "Despertou!", /* 5.0g.1 */
  "chefe.ui.despertou-atacado": "Despertou com o ataque!", /* 5.0g.1 */
  "erro.titulo": "Erro", /* 5.0g.1 */
  "erro.promessa": "Erro (tarefa em segundo plano)", /* 5.0g.1 */
  "erro.lugar": "em {arq}, linha {lin}, coluna {col}", /* 5.0g.1 */
  "erro.sem-msg": "erro sem mensagem", /* 5.0g.1 */
  "erro.fechar": "Toque para fechar", /* 5.0g.1 */
  "erro.pagina": "a página", /* 5.0g.1 */
  "unit.fauna_pastador.nome": "Pastador da Fenda", /* 5.0h */
  "unit.fauna_pastador.desc": "Herbívoro manso das planícies da Fenda. Foge de quem chega perto; caído, deixa uma caixa pequena.", /* 5.0h */
  "unit.fauna_guardiao.nome": "Guardião do Veio", /* 5.0h */
  "unit.fauna_guardiao.desc": "Fera blindada de cristal que defende um nó rico. Ataca quem chega perto do nó; caída, solta um bônus.", /* 5.0h */
  "unit.fauna_enxame.nome": "Enxame Noturno", /* 5.0h */
  "unit.fauna_enxame.desc": "Mariposas de éter que saem dos ninhos perto da Fenda à noite e atacam quem passa.", /* 5.0h */
  "unit.merc_saqueador.nome": "Saqueador Corsário", /* 5.0h */
  "unit.merc_saqueador.desc": "Mercenário rápido de ataque corpo a corpo. Serve por 5 min.", /* 5.0h */
  "unit.merc_artilheiro.nome": "Artilheiro Corsário", /* 5.0h */
  "unit.merc_artilheiro.desc": "Mercenário de cerco: tiro longo com área. Serve por 5 min.", /* 5.0h */
  "unit.merc_atirador.nome": "Atirador Corsário", /* 5.0h */
  "unit.merc_atirador.desc": "Mercenário de tiro longo; como infantaria, também captura ruínas. Serve por 5 min.", /* 5.0h */
  "bld.ruina_observatorio.nome": "Observatório", /* 5.0h */
  "bld.ruina_observatorio.desc": "Ruína dos Construtores. Capturada com infantaria parada ao lado, dá visão larga em volta dela.", /* 5.0h */
  "bld.ruina_forja.nome": "Forja Antiga", /* 5.0h */
  "bld.ruina_forja.desc": "Ruína dos Construtores. Capturada, deixa os veículos do dono 20% mais baratos.", /* 5.0h */
  "bld.ruina_portal.nome": "Portal", /* 5.0h */
  "bld.ruina_portal.desc": "Ruína dos Construtores, em par. Capturada, leva as unidades do dono até a outra ponta.", /* 5.0h */
  "bld.ruina_torre.nome": "Torre de Éter", /* 5.0h */
  "bld.ruina_torre.desc": "Ruína dos Construtores. Capturada, dá +40 de energia ao dono.", /* 5.0h */
  "bld.acampamento.nome": "Acampamento da Irmandade Corsária", /* 5.0h */
  "bld.acampamento.desc": "Nave corsária ancorada sobre a Fenda. Com uma unidade sua a até 600 dela, contrate mercenários pagos em Dados.", /* 5.0h */
  "mundo.titulo": "Mundo vivo", /* 5.0h */
  "mundo.sub": "neutros no mapa, para todos", /* 5.0h */
  "mundo.op.fauna": "Fauna da Fenda", /* 5.0h */
  "mundo.op.fauna-d": "herbívoros que fogem, Guardiões dos nós ricos e enxames à noite", /* 5.0h */
  "mundo.op.ruinas": "Ruínas dos Construtores", /* 5.0h */
  "mundo.op.ruinas-d": "capture com infantaria: Observatório, Forja Antiga, Portal e Torre de Éter", /* 5.0h */
  "mundo.op.corsarios": "Irmandade Corsária", /* 5.0h */
  "mundo.op.corsarios-d": "Acampamento no centro com 3 mercenários pagos em Dados", /* 5.0h */
  "mundo.op.surto": "Surto de éter", /* 5.0h */
  "mundo.op.surto-d": "renda dobrada numa zona, anunciada antes, e chuva de meteoros", /* 5.0h */
  "mundo.bonus.observatorio": "Visão larga em volta dele", /* 5.0h */
  "mundo.bonus.forja": "Veículos 20% mais baratos", /* 5.0h */
  "mundo.bonus.portal": "Teleporte até a outra ponta do par", /* 5.0h */
  "mundo.bonus.torre": "+40 de energia", /* 5.0h */
  "mundo.surto.ativo": "Surto ×2 · {s} s", /* 5.0h */
  "mundo.surto.em": "Surto em {s} s", /* 5.0h */
  "mundo.surto.ativo-l": "Surto de éter: renda ×2 na zona · {s} s", /* 5.0h */
  "mundo.surto.em-l": "Surto de éter em {s} s", /* 5.0h */
  "mundo.cap.disputa": "Em disputa", /* 5.0h */
  "mundo.cap.tomando": "Tomando: {nome} {n}%", /* 5.0h */
  "mundo.cap.capturando": "Capturando: {nome} {n}%", /* 5.0h */
  "mundo.r.sua": "Sua", /* 5.0h */
  "mundo.r.de": "De {nome}", /* 5.0h */
  "mundo.r.livre": "Livre", /* 5.0h */
  "mundo.r.ruina": "Ruína dos Construtores", /* 5.0h */
  "mundo.dica.portal": "Selecione unidades e clique com o botão direito neste Portal: elas saem na outra ponta do par.", /* 5.0h */
  "mundo.dica.manter": "Mantenha a ruína: infantaria inimiga parada ao lado dela tira o bônus de você.", /* 5.0h */
  "mundo.dica.capturar": "Pare Infantaria ao lado da ruína para capturá-la (20 s com uma; mais rápido com mais). Botão direito com unidades selecionadas leva todas até ela.", /* 5.0h */
  "mundo.a.sub": "Mercenários: {n}/{max}", /* 5.0h */
  "mundo.a.longe": "Leve uma unidade sua até perto do Acampamento (600) para contratar.", /* 5.0h */
  "mundo.a.recarga": "Próxima contratação em {s} s", /* 5.0h */
  "mundo.a.limite": "Limite de {max} mercenários ao mesmo tempo", /* 5.0h */
  "mundo.a.desc": "Cada mercenário serve por {min} min. Pagos em Dados.", /* 5.0h */
  "mundo.f.sub": "Fauna da Fenda", /* 5.0h */
  "mundo.f.hostil": "hostil", /* 5.0h */
  "mundo.f.mansa": "mansa", /* 5.0h */
  "mundo.dica.l-ruinas": "<b>Ruínas</b>: pare Infantaria ao lado de uma para capturá-la; o bônus vale enquanto você a mantiver.", /* 5.0h */
  "mundo.dica.l-corsarios": "<b>Acampamento Corsário</b> (no centro): com uma unidade perto, selecione a nave e contrate mercenários com Dados.", /* 5.0h */
  "mundo.dica.l-fauna": "<b>Fauna</b>: os Pastadores fogem; os Guardiões defendem os nós ricos; à noite, enxames saem dos ninhos perto da Fenda.", /* 5.0h */
  "mundo.dica.l-surto": "<b>Surto de éter</b>: um círculo no chão avisa 30 s antes; ali a coleta rende o dobro.", /* 5.0h */
  "mundo.dica.ok": "Entendi", /* 5.0h */
  "sim.mundo.cap.observatorio": "Observatório capturado: visão larga em volta dele", /* 5.0h */
  "sim.mundo.cap.forja": "Forja Antiga capturada: veículos 20% mais baratos", /* 5.0h */
  "sim.mundo.cap.portal": "Portal capturado: mande unidades para a outra ponta", /* 5.0h */
  "sim.mundo.cap.torre": "Torre de Éter capturada: +40 de energia", /* 5.0h */
  "sim.mundo.cap-outro.observatorio": "{nome} capturou o Observatório", /* 5.0h */
  "sim.mundo.cap-outro.forja": "{nome} capturou a Forja Antiga", /* 5.0h */
  "sim.mundo.cap-outro.portal": "{nome} capturou um Portal", /* 5.0h */
  "sim.mundo.cap-outro.torre": "{nome} capturou uma Torre de Éter", /* 5.0h */
  "sim.mundo.tomada.observatorio": "Seu Observatório está sendo tomado", /* 5.0h */
  "sim.mundo.tomada.forja": "Sua Forja Antiga está sendo tomada", /* 5.0h */
  "sim.mundo.tomada.portal": "Seu Portal está sendo tomado", /* 5.0h */
  "sim.mundo.tomada.torre": "Sua Torre de Éter está sendo tomada", /* 5.0h */
  "sim.mundo.perdeu.observatorio": "Você perdeu o Observatório", /* 5.0h */
  "sim.mundo.perdeu.forja": "Você perdeu a Forja Antiga", /* 5.0h */
  "sim.mundo.perdeu.portal": "Você perdeu um Portal", /* 5.0h */
  "sim.mundo.perdeu.torre": "Você perdeu uma Torre de Éter", /* 5.0h */
  "sim.mundo.enxame": "Anoiteceu: enxames noturnos saíram dos ninhos perto da Fenda", /* 5.0h */
  "sim.mundo.guardiao": "Guardião do Veio derrubado: o bônus dele ficou no chão e o nó rico está livre", /* 5.0h */
  "sim.mundo.portal-antes": "Capture este Portal primeiro", /* 5.0h */
  "sim.mundo.aguarde": "Irmandade Corsária: aguarde {n} s para contratar de novo", /* 5.0h */
  "sim.mundo.longe": "Leve uma unidade até perto do Acampamento Corsário para contratar", /* 5.0h */
  "sim.mundo.limite": "Limite de mercenários: {n} ao mesmo tempo", /* 5.0h */
  "sim.mundo.requer": "Requer {n} Dados", /* 5.0h */
  "sim.mundo.merc.saqueador": "Saqueador Corsário contratado por 5 min", /* 5.0h */
  "sim.mundo.merc.artilheiro": "Artilheiro Corsário contratado por 5 min", /* 5.0h */
  "sim.mundo.merc.atirador": "Atirador Corsário contratado por 5 min", /* 5.0h */
  "sim.mundo.surto-aviso": "Surto de éter em {n} s: a renda dobra dentro do círculo marcado", /* 5.0h */
  "sim.mundo.surto-comeca": "Surto de éter! A renda dobra dentro do círculo por {n} s", /* 5.0h */
  "sim.mundo.nome": "Mundo", /* 5.0h */
  "bld.esteira.nome": "Esteira de Montagem", /* 5.0h */
  "bld.esteira.desc": "Liga as duas construções de produção mais próximas (até 260): +20% de velocidade de produção nelas.", /* 5.0h */
  "bld.silo.nome": "Silo de Sucata", /* 5.0h */
  "bld.silo.desc": "Carcaças a até 240 viram Minério sozinhas: 3 por segundo de cada uma, até 3 carcaças ao mesmo tempo.", /* 5.0h */
  "bld.espelho.nome": "Espelho do Véu", /* 5.0h */
  "bld.espelho.desc": "Camufla as suas construções a até 200 (menos o Núcleo e ele mesmo). Torres e detectores inimigos ainda as revelam.", /* 5.0h */
  "bld.farol.nome": "Farol Falso", /* 5.0h */
  "bld.farol.desc": "Isca: unidades e torres inimigas por perto preferem atirar nele. Ao cair, solta um pulso que atordoa os inimigos a até 120 por 2 s.", /* 5.0h */
  "bld.arvore.nome": "Árvore-Mãe", /* 5.0h */
  "bld.arvore.desc": "Cura as suas unidades e construções a até 150 (+40 por Era): 3 de vida/s (+2 por Era). Cresce e ganha vida a cada Era.", /* 5.0h */
  "bld.viveiro.nome": "Viveiro", /* 5.0h */
  "bld.viveiro.desc": "Cultiva Esporos-sentinela de graça: um a cada 45 s, até 3 vivos ao mesmo tempo.", /* 5.0h */
  "bld.pilar.nome": "Pilar de Ressonância", /* 5.0h */
  "bld.pilar.desc": "Estende o Elo: as suas unidades a até 200 contam um vizinho a mais no acorde (até um acima do teto).", /* 5.0h */
  "bld.eco.nome": "Câmara de Eco", /* 5.0h */
  "bld.eco.desc": "Torre de ressonância: onda de 200 de alcance que fere em área e atrasa veículos e estruturas.", /* 5.0h */
  "bld.incubadora.nome": "Câmara de Incubação", /* 5.0h */
  "bld.incubadora.desc": "Choca Crias e Cuspidores 25% mais rápido que o Quartel.", /* 5.0h */
  "bld.tumor.nome": "Tumor de Território", /* 5.0h */
  "bld.tumor.desc": "Reclama território em 240 e desacelera em 30% os inimigos dentro dele.", /* 5.0h */
  "unit.exoforja.nome": "Exo-Forja", /* 5.0h */
  "unit.exoforja.desc": "Avatar do Barão-Forja: exoesqueleto de fundição com martelo sísmico.", /* 5.0h */
  "unit.espectro.nome": "Espectro", /* 5.0h */
  "unit.espectro.desc": "Avatar de Vesper Ísk: lâmina de luz e um véu que esconde quem está perto.", /* 5.0h */
  "unit.guardia.nome": "Guardiã", /* 5.0h */
  "unit.guardia.desc": "Avatar de Sylvia Oriel: raízes, flores que curam e esporos.", /* 5.0h */
  "unit.prismavivo.nome": "Prisma Vivo", /* 5.0h */
  "unit.prismavivo.desc": "Avatar de Zayin Coral: um prisma que canta o acorde do Coro.", /* 5.0h */
  "unit.devorador.nome": "Devorador", /* 5.0h */
  "unit.devorador.desc": "Avatar de Oru Voraz: a fera que devora e chama a ninhada.", /* 5.0h */
  "unit.espectro_eco.nome": "Eco Falso", /* 5.0h */
  "unit.espectro_eco.desc": "Cópia de luz do Espectro: não fere, só engana.", /* 5.0h */
  "uni.mod.refinaria.prensa.nome": "Prensa de Minério", /* 5.0h */
  "uni.mod.refinaria.prensa.desc": "+0,5 Minério por segundo.", /* 5.0h */
  "uni.mod.refinaria.cofre.nome": "Cofre Blindado", /* 5.0h */
  "uni.mod.refinaria.cofre.desc": "+60% de vida e regenera 4 de vida/s.", /* 5.0h */
  "uni.mod.fabrica.linha.nome": "Linha Rápida", /* 5.0h */
  "uni.mod.fabrica.linha.desc": "Produção 20% mais rápida nesta Fábrica.", /* 5.0h */
  "uni.mod.fabrica.chassi.nome": "Chassi Reforçado", /* 5.0h */
  "uni.mod.fabrica.chassi.desc": "Os veículos daqui saem com +15% de vida.", /* 5.0h */
  "uni.mod.hangar.posq.nome": "Pós-combustão", /* 5.0h */
  "uni.mod.hangar.posq.desc": "Os drones daqui saem 12% mais rápidos.", /* 5.0h */
  "uni.mod.hangar.doca.nome": "Doca de Reparo", /* 5.0h */
  "uni.mod.hangar.doca.desc": "Repara as suas unidades voadoras a até 160 (5 de vida/s).", /* 5.0h */
  "uni.mod.laboratorio.antena.nome": "Antena de Dados", /* 5.0h */
  "uni.mod.laboratorio.antena.desc": "+0,3 Dados por segundo.", /* 5.0h */
  "uni.mod.laboratorio.contra.nome": "Contraespionagem", /* 5.0h */
  "uni.mod.laboratorio.contra.desc": "Detecta as unidades camufladas inimigas a até 260, como uma Torre.", /* 5.0h */
  "uni.mod.nodulo.posto.nome": "Posto Avançado", /* 5.0h */
  "uni.mod.nodulo.posto.desc": "+50% de vida e regenera 3 de vida/s.", /* 5.0h */
  "uni.mod.nodulo.mina.nome": "Mina de Pulso", /* 5.0h */
  "uni.mod.nodulo.mina.desc": "Pulso de 45 de dano em área nos inimigos a até 90, a cada 6 s.", /* 5.0h */
  "cmd.hab.martelo.nome": "Martelo Sísmico", /* 5.0h */
  "cmd.hab.martelo.desc": "Golpe no chão: 110 de dano em área (r 90) e prende os inimigos por 1,2 s.", /* 5.0h */
  "cmd.hab.reparo.nome": "Reparo de Campo", /* 5.0h */
  "cmd.hab.reparo.desc": "Repara as suas unidades (140) e construções (240) em volta.", /* 5.0h */
  "cmd.hab.fundicao.nome": "Chamado da Fundição", /* 5.0h */
  "cmd.hab.fundicao.desc": "Dois Soldadores descem para lutar por 30 s.", /* 5.0h */
  "cmd.hab.veu.nome": "Véu", /* 5.0h */
  "cmd.hab.veu.desc": "Camufla o Espectro e as unidades por perto por 8 s.", /* 5.0h */
  "cmd.hab.lamina.nome": "Lâmina de Luz", /* 5.0h */
  "cmd.hab.lamina.desc": "Corte num inimigo: 180 de dano.", /* 5.0h */
  "cmd.hab.ecofalso.nome": "Eco Falso", /* 5.0h */
  "cmd.hab.ecofalso.desc": "Três cópias de luz correm para o ponto e atraem o fogo por 15 s.", /* 5.0h */
  "cmd.hab.raizes.nome": "Raízes", /* 5.0h */
  "cmd.hab.raizes.desc": "Prende os inimigos numa área por 3 s.", /* 5.0h */
  "cmd.hab.florescer.nome": "Florescer", /* 5.0h */
  "cmd.hab.florescer.desc": "Cura as suas unidades (160) e construções (200) em volta.", /* 5.0h */
  "cmd.hab.esporos.nome": "Esporos", /* 5.0h */
  "cmd.hab.esporos.desc": "Nuvem que fere os inimigos por 8 s (14 de dano/s).", /* 5.0h */
  "cmd.hab.acorde.nome": "Acorde", /* 5.0h */
  "cmd.hab.acorde.desc": "As suas unidades em volta causam +20% de dano por 8 s.", /* 5.0h */
  "cmd.hab.estilhaco.nome": "Estilhaço", /* 5.0h */
  "cmd.hab.estilhaco.desc": "Explosão de cristal: 140 de dano em área (r 70).", /* 5.0h */
  "cmd.hab.silencio.nome": "Silêncio", /* 5.0h */
  "cmd.hab.silencio.desc": "Inimigos numa área ficam sem atirar por 4 s.", /* 5.0h */
  "cmd.hab.devorar.nome": "Devorar", /* 5.0h */
  "cmd.hab.devorar.desc": "Engole um inimigo fraco (até 220 de vida) e se cura; nos fortes, 220 de dano.", /* 5.0h */
  "cmd.hab.ninhada.nome": "Ninhada", /* 5.0h */
  "cmd.hab.ninhada.desc": "Quatro Crias eclodem em volta por 25 s.", /* 5.0h */
  "cmd.hab.rugido.nome": "Rugido", /* 5.0h */
  "cmd.hab.rugido.desc": "Inimigos em volta 40% mais lentos por 4 s; aliados +15% de dano por 6 s.", /* 5.0h */
  "hud.btab.uni": "Únicas", /* 5.0h */
  "uni.unica": "Construção única da sua Raça", /* 5.0h */
  "uni.instalando": "Instalando {nome}", /* 5.0h */
  "uni.modulo-tit": "Módulo: escolha um", /* 5.0h */
  "uni.para-sempre": "a escolha é para sempre", /* 5.0h */
  "uni.requer-era2": "Era II", /* 5.0h */
  "cmd.opcao": "Comandantes em campo", /* 5.0h */
  "cmd.opcao-d": "cada líder leva um avatar com 3 habilidades e níveis; quando cai, volta no Núcleo", /* 5.0h */
  "cmd.barra": "Comandante", /* 5.0h */
  "cmd.fora": "Fora de combate", /* 5.0h */
  "cmd.volta-em": "Volta em {s} s", /* 5.0h */
  "cmd.recarga": "Em recarga: {s} s", /* 5.0h */
  "cmd.mira-alvo": "{nome}: toque num inimigo", /* 5.0h */
  "cmd.mira-chao": "{nome}: toque no chão", /* 5.0h */
  "cmd.escolha-inimigo": "Escolha um inimigo", /* 5.0h */
  "sim.uni.uma": "Construção única: só uma por jogador", /* 5.0h */
  "sim.uni.recarga": "Habilidade em recarga", /* 5.0h */
  "sim.uni.longe": "Longe demais do comandante", /* 5.0h */
  "sim.uni.inimigo": "Escolha um inimigo visível", /* 5.0h */
  "sim.uni.caiu": "Seu comandante caiu: volta no Núcleo em {n} s", /* 5.0h */
  "sim.uni.voltou": "Seu comandante voltou ao campo", /* 5.0h */
  "sim.uni.nivel": "Comandante no nível {n}", /* 5.0h */
  "ia.ui.titulo": "IA aliada", /* 5.0h */
  "ia.ui.atacar": "Atacar meu alvo", /* 5.0h */
  "ia.ui.defender": "Defender minha base", /* 5.0h */
  "ia.ui.expandir": "Expandir", /* 5.0h */
  "ia.ui.atacar-d": "A IA aliada ataca o inimigo selecionado ou o ponto no centro da tela", /* 5.0h */
  "ia.ui.defender-d": "A IA aliada traz o exército para perto do seu Núcleo", /* 5.0h */
  "ia.ui.expandir-d": "A IA aliada abre um Nódulo perto do centro da tela", /* 5.0h */
  "ia.ui.enviado": "Pedido à IA aliada: {pedido}", /* 5.0h */
  "ia.ui.grupo": "Pedidos à IA aliada", /* 5.0h */
  "ia.ui.atacar-c": "Atacar", /* 5.0h */
  "ia.ui.defender-c": "Defesa", /* 5.0h */
  "ia.ui.expandir-c": "Expandir", /* 5.0h */
  "ia.fala.vehnar.inicio.0": "A fornalha está acesa. Quem quiser derreter, que venha.", /* 5.0h */
  "ia.fala.vehnar.inicio.1": "Aço, vapor e paciência. Mais aço que paciência.", /* 5.0h */
  "ia.fala.vehnar.chefe.0": "Isso aí é grande. Ótimo: rende mais sucata.", /* 5.0h */
  "ia.fala.vehnar.chefe.1": "Fase nova, martelo velho. Batam mais forte!", /* 5.0h */
  "ia.fala.vehnar.ataque.0": "Abram caminho: a Fundição chegou para a entrega.", /* 5.0h */
  "ia.fala.vehnar.ataque.1": "Os blindados estão quentes. Sua base logo vai estar também.", /* 5.0h */
  "ia.fala.vehnar.atacado.0": "Você bateu numa fortaleza. A conta do martelo vem depois.", /* 5.0h */
  "ia.fala.vehnar.atacado.1": "Isso é tudo? Meus muros nem suaram.", /* 5.0h */
  "ia.fala.vehnar.recua.0": "Volta para a forja. Retorno com mais chapa.", /* 5.0h */
  "ia.fala.vehnar.recua.1": "Não é fuga, é logística. Reabastecer!", /* 5.0h */
  "ia.fala.vehnar.pacto.0": "Pacto aceito. Um bom contrato vale mais que um bom canhão. Quase.", /* 5.0h */
  "ia.fala.vehnar.pacto.1": "Fechado. Mas eu guardo a nota fiscal.", /* 5.0h */
  "ia.fala.vehnar.recusa.0": "Não assino nada sem ver o aço da proposta.", /* 5.0h */
  "ia.fala.vehnar.recusa.1": "Recusado. Volte com uma oferta mais pesada.", /* 5.0h */
  "ia.fala.vehnar.coalizao.0": "Tem alguém grande demais neste mapa. Vamos amassar ele juntos?", /* 5.0h */
  "ia.fala.vehnar.coalizao.1": "O líder está folgado. Proponho um ajuste de prensa em dupla.", /* 5.0h */
  "ia.fala.vehnar.trai.0": "Nada pessoal: o contrato venceu e a fornalha está com fome.", /* 5.0h */
  "ia.fala.vehnar.trai.1": "Pacto rescindido. Leia as letras miúdas da próxima vez.", /* 5.0h */
  "ia.fala.vehnar.super.0": "Fundição Orbital! Entrega expressa de aço quente.", /* 5.0h */
  "ia.fala.vehnar.super.1": "Do céu cai uma fortaleza. Não fiquem embaixo.", /* 5.0h */
  "ia.fala.vehnar.pedido.0": "Entendido. A Fundição atende o pedido.", /* 5.0h */
  "ia.fala.vehnar.pedido.1": "Ordem recebida. O martelo vai aonde você apontar.", /* 5.0h */
  "ia.fala.erevane.inicio.0": "Ninguém me viu chegar. Ninguém vai me ver levar.", /* 5.0h */
  "ia.fala.erevane.inicio.1": "Bela base. Seria uma pena faltar Plasma nela.", /* 5.0h */
  "ia.fala.erevane.chefe.0": "Coisa grande, bolsos grandes. Vamos aliviar esse monstro.", /* 5.0h */
  "ia.fala.erevane.chefe.1": "Ele mudou de forma. Eu também sei fazer isso.", /* 5.0h */
  "ia.fala.erevane.ataque.0": "Já estou na sua base. Só não deu para você perceber.", /* 5.0h */
  "ia.fala.erevane.ataque.1": "Olhe para a esquerda. Agora para a direita. Tarde demais.", /* 5.0h */
  "ia.fala.erevane.atacado.0": "Você acertou uma sombra. Parabéns, foi a única.", /* 5.0h */
  "ia.fala.erevane.atacado.1": "Tanto barulho por tão pouco.", /* 5.0h */
  "ia.fala.erevane.recua.0": "Sumir também é tática.", /* 5.0h */
  "ia.fala.erevane.recua.1": "Volto quando você se distrair. Ou seja, logo.", /* 5.0h */
  "ia.fala.erevane.pacto.0": "Pacto aceito. Prometo roubar só dos outros.", /* 5.0h */
  "ia.fala.erevane.pacto.1": "Fechado. Juro pela minha capa camuflada.", /* 5.0h */
  "ia.fala.erevane.recusa.0": "Pactos são para quem tem algo a perder.", /* 5.0h */
  "ia.fala.erevane.recusa.1": "Não. Mas obrigada pela distração.", /* 5.0h */
  "ia.fala.erevane.coalizao.0": "O líder está brilhando demais. Vamos apagar essa luz juntos?", /* 5.0h */
  "ia.fala.erevane.coalizao.1": "Quem está na frente vira alvo. Topa um assalto em dupla?", /* 5.0h */
  "ia.fala.erevane.trai.0": "Ops. Era pacto ou empréstimo? Sempre confundo.", /* 5.0h */
  "ia.fala.erevane.trai.1": "Confiou numa Erevane? Que fofo.", /* 5.0h */
  "ia.fala.erevane.super.0": "Blecaute! Agora todo mundo joga do meu jeito: no escuro.", /* 5.0h */
  "ia.fala.erevane.super.1": "Luzes apagadas. Bolsos abertos.", /* 5.0h */
  "ia.fala.erevane.pedido.0": "Pedido anotado. Ninguém vai saber de onde veio.", /* 5.0h */
  "ia.fala.erevane.pedido.1": "Considere feito. Quietinho, do jeito que eu gosto.", /* 5.0h */
  "ia.fala.tessara.inicio.0": "Toda semente começa pequena. A minha já tem raízes no seu quintal.", /* 5.0h */
  "ia.fala.tessara.inicio.1": "Que solo fértil. Vou crescer aqui, se não se importa.", /* 5.0h */
  "ia.fala.tessara.chefe.0": "Uma criatura antiga. Que linda. Que pena.", /* 5.0h */
  "ia.fala.tessara.chefe.1": "Ela se adapta? Nós também. É a nossa especialidade.", /* 5.0h */
  "ia.fala.tessara.ataque.0": "Hora da poda. Não se preocupe, cresce de novo. Às vezes.", /* 5.0h */
  "ia.fala.tessara.ataque.1": "Meu jardim precisa de espaço. O seu, no caso.", /* 5.0h */
  "ia.fala.tessara.atacado.0": "Pisaram nas minhas flores. Elas lembram de rostos.", /* 5.0h */
  "ia.fala.tessara.atacado.1": "Cortou um galho? Nascem três.", /* 5.0h */
  "ia.fala.tessara.recua.0": "Recolher as raízes. A estação volta.", /* 5.0h */
  "ia.fala.tessara.recua.1": "Inverno tático. Na primavera eu cobro.", /* 5.0h */
  "ia.fala.tessara.pacto.0": "Que bom! Jardins vizinhos crescem melhor juntos.", /* 5.0h */
  "ia.fala.tessara.pacto.1": "Aceito. Vou regar essa amizade.", /* 5.0h */
  "ia.fala.tessara.recusa.0": "Agradeço, mas essa muda não pega comigo.", /* 5.0h */
  "ia.fala.tessara.recusa.1": "Não, obrigada. Prefiro crescer sozinha por enquanto.", /* 5.0h */
  "ia.fala.tessara.coalizao.0": "Alguém está tomando o sol de todos nós. Vamos fazer sombra juntos?", /* 5.0h */
  "ia.fala.tessara.coalizao.1": "Árvore grande demais sufoca o bosque. Proponho uma aliança.", /* 5.0h */
  "ia.fala.tessara.trai.0": "Desculpe, querido. Chegou a estação da colheita.", /* 5.0h */
  "ia.fala.tessara.trai.1": "Toda planta procura a luz. Hoje a luz é a sua base.", /* 5.0h */
  "ia.fala.tessara.super.0": "Salto Evolutivo! Meus filhos estão mais fortes, mais rápidos, mais famintos.", /* 5.0h */
  "ia.fala.tessara.super.1": "A evolução não pede licença.", /* 5.0h */
  "ia.fala.tessara.pedido.0": "Claro! Já mando as mudas para lá.", /* 5.0h */
  "ia.fala.tessara.pedido.1": "Com prazer. Um jardim unido floresce.", /* 5.0h */
  "ia.fala.quorith.inicio.0": "O Coro afina. Você está fora do tom.", /* 5.0h */
  "ia.fala.quorith.inicio.1": "Escute: é o som de muitas vozes contra uma.", /* 5.0h */
  "ia.fala.quorith.chefe.0": "Uma nota grave e enorme. Vamos responder em acorde.", /* 5.0h */
  "ia.fala.quorith.chefe.1": "O monstro mudou de compasso. Acompanhem!", /* 5.0h */
  "ia.fala.quorith.ataque.0": "Tutti! O Coro inteiro entra agora.", /* 5.0h */
  "ia.fala.quorith.ataque.1": "A sinfonia começa na sua base. Ingressos esgotados.", /* 5.0h */
  "ia.fala.quorith.atacado.0": "Desafinado. E mais alto do que precisava.", /* 5.0h */
  "ia.fala.quorith.atacado.1": "Interromperam o ensaio. Isso não fica sem resposta.", /* 5.0h */
  "ia.fala.quorith.recua.0": "Pausa de um compasso. O refrão volta.", /* 5.0h */
  "ia.fala.quorith.recua.1": "Recolher o Coro. Toda música tem silêncio.", /* 5.0h */
  "ia.fala.quorith.pacto.0": "Aceito. Duas vozes, uma harmonia.", /* 5.0h */
  "ia.fala.quorith.pacto.1": "Em uníssono, então. Por enquanto.", /* 5.0h */
  "ia.fala.quorith.recusa.0": "Sua proposta está fora do tom.", /* 5.0h */
  "ia.fala.quorith.recusa.1": "Não. O Coro canta sozinho esta parte.", /* 5.0h */
  "ia.fala.quorith.coalizao.0": "Tem um solista alto demais. Que tal um dueto contra ele?", /* 5.0h */
  "ia.fala.quorith.coalizao.1": "Quem domina a música cansa a plateia. Vamos trocar o regente?", /* 5.0h */
  "ia.fala.quorith.trai.0": "Mudança de tom. Você não estava na partitura.", /* 5.0h */
  "ia.fala.quorith.trai.1": "Fim do dueto. Agora é solo: o meu.", /* 5.0h */
  "ia.fala.quorith.super.0": "Uníssono! Mil vozes, um golpe só.", /* 5.0h */
  "ia.fala.quorith.super.1": "Ouça o acorde completo. Ele não se repete.", /* 5.0h */
  "ia.fala.quorith.pedido.0": "Entendido. O Coro marca o compasso para você.", /* 5.0h */
  "ia.fala.quorith.pedido.1": "Partitura recebida. Tocamos já.", /* 5.0h */
  "ia.fala.vorag.inicio.0": "Fome.", /* 5.0h */
  "ia.fala.vorag.inicio.1": "Cheiro de base nova. Cheiro de jantar.", /* 5.0h */
  "ia.fala.vorag.chefe.0": "Grande. Muito grande. Muita comida.", /* 5.0h */
  "ia.fala.vorag.chefe.1": "Mudou? Ainda tem gosto de carne.", /* 5.0h */
  "ia.fala.vorag.ataque.0": "Enxame, comer!", /* 5.0h */
  "ia.fala.vorag.ataque.1": "Corram, se quiserem. As Crias gostam de correr atrás.", /* 5.0h */
  "ia.fala.vorag.atacado.0": "Morde o Oru? O Oru morde de volta.", /* 5.0h */
  "ia.fala.vorag.atacado.1": "Isso doeu. O Oru ficou com mais fome.", /* 5.0h */
  "ia.fala.vorag.recua.0": "Barriga cheia por hoje. Amanhã, mais.", /* 5.0h */
  "ia.fala.vorag.recua.1": "A ninhada recua. A ninhada volta maior.", /* 5.0h */
  "ia.fala.vorag.pacto.0": "Pacto. Por enquanto você não é comida.", /* 5.0h */
  "ia.fala.vorag.pacto.1": "Tá. O Oru come os outros primeiro.", /* 5.0h */
  "ia.fala.vorag.recusa.0": "Não. O Oru não divide a mesa.", /* 5.0h */
  "ia.fala.vorag.recusa.1": "Pacto não enche barriga.", /* 5.0h */
  "ia.fala.vorag.coalizao.0": "O grandão engordou demais. Vamos comer ele juntos?", /* 5.0h */
  "ia.fala.vorag.coalizao.1": "Tem um banquete lá na frente. Divide comigo?", /* 5.0h */
  "ia.fala.vorag.trai.0": "Desculpa. Bateu a fome.", /* 5.0h */
  "ia.fala.vorag.trai.1": "O pacto acabou. O jantar começou.", /* 5.0h */
  "ia.fala.vorag.super.0": "Eclosão! Nasce, cresce, come!", /* 5.0h */
  "ia.fala.vorag.super.1": "Ovos abertos. Boa sorte.", /* 5.0h */
  "ia.fala.vorag.pedido.0": "O Oru vai. O Oru come o que você apontar.", /* 5.0h */
  "ia.fala.vorag.pedido.1": "Entendido. A ninhada corre para lá.", /* 5.0h */
};
