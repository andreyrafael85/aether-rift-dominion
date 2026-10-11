# Registro de assets e bibliotecas

Todo arquivo de arte ou biblioteca externa entra aqui com origem e licença. Sem linha, não entra no jogo.

| Item | Origem | Autor | Licença | Uso |
|---|---|---|---|---|
| Modelos voxel (src/models.js) | próprios, definidos em código | equipe | todos os direitos reservados | modo 2D, ícones de reserva, estilo 2D e 3D |
| Malhas 3D por Raça (src/meshes.js, 4.0d) | próprias, geradas em código a partir de primitivas do Three.js | equipe | todos os direitos reservados | jogo (modo 3D), ícones do HUD, catálogo 3D |
| Céu, planeta-mãe, horizonte e textura de detalhe do terreno (src/world3d.js) | procedurais (ruído fBm), paletas dos mundos aprovados | equipe | todos os direitos reservados | jogo (modo 3D) |
| Logo vivo (src/logo3d.js) | cena procedural da Final 2 aprovada | equipe | todos os direitos reservados | tela inicial (desktop) |
| Adereços do terreno e estradas (src/dress3d.js, 4.2d) | geometria procedural do Three.js e shader próprio, sem texturas | equipe | todos os direitos reservados | jogo (modo 3D) |
| Efeitos 3D (src/fx3d.js, 4.2c) | partículas e formas procedurais em shader, sem texturas | equipe | todos os direitos reservados | jogo (modo 3D) |
| Líderes vivos (src/leaders3d.js, 4.1e) | bustos procedurais em código, portados de tools/arte3d.html (arte de identidade aprovada) | equipe | todos os direitos reservados | tela inicial e retrato do HUD (desktop) |
| Ícones do app e favicons (assets/icon-*.png, favicon-*.png, apple-touch-icon.png) | recortes do render da Final 2 aprovada | equipe | todos os direitos reservados | manifesto PWA, aba do navegador, tela inicial do celular |
| Texturas de terreno | procedurais (src/render.js) | equipe | todos os direitos reservados | jogo |
| Efeitos sonoros | sintetizados em tempo real (src/audio.js) | equipe | todos os direitos reservados | jogo |
| Voz de sistema | Web Speech API do navegador | navegador do jogador | n/a | jogo |
| Fontes Big Shoulders Display, IBM Plex Sans, IBM Plex Mono | Google Fonts | Indestructible Type, IBM | SIL Open Font License 1.1 | interface |
| Three.js 0.160.0 | jsDelivr (three.module.min.js + examples/jsm/postprocessing + examples/jsm/environments/RoomEnvironment.js) no jogo; cdnjs (three.min.js) em estilo3d.html | three.js authors | MIT | jogo (modo 3D) e estilo3d.html |
| PeerJS 1.5.4 | cdnjs (peerjs.min.js); sinalização pelo PeerServer público | PeerJS contributors | MIT | multiplayer P2P |
