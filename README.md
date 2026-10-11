# Aether Rift: Dominion — beta de testes

RTS multiplayer browser-first em desenvolvimento. Este repositório publica o **4.2c jogável** (explosões em camadas, fumaça macia e superarmas com assinatura, tudo na GPU; animação procedural de rodas, pernas, rotores, asas e recuo de canos; teste de desempenho de 30 s em Ajustes, resultado no Feedback; líderes vivos em 3D que reagem à partida; Eras do Núcleo com módulos e Ascensão por Raça; salvamento automático com volta direta depois de queda de internet ou energia, três espaços de salvamento, volta à sala multiplayer em até 2 min; painel de comando com abas por modo de jogo, campanha "O Grande Alinhamento" com Continuar de um clique, radar que gira com a câmera; jogabilidade de campo: toque e construção no celular, fila de produção até 50, dificuldades medidas com nível Brutal, cores por Raça; beta aberto: app instalável com campanha e solo offline, qualidade 3D automática que se ajusta pelo FPS; campanha com 20 missões, Comandante, conquistas, relíquias e Hangar; Engine gráfica 2: modelos 3D suaves por Raça, céu com o planeta-mãe, horizonte e câmera com inclinação livre; cinco Raças: Consórcio Vehnar, Erevane, Tessara, Coro Quorith e Prole Vorag, cada uma com elenco, superarma, pirata e nascimento de construção próprios; arte aprovada integrada: logo Escudo-Órbita, hero 4K, líderes com expressões, mundos e insígnias; plano completo em docs/plano-v4-v5.md) ( contra IA ou **multiplayer P2P por código de sala**; em 3D com Three.js: relevo, sombras, bloom, oclusão ambiente, névoa volumétrica, lagos de plasma, presets de qualidade, câmera com rotação; modo 2D isométrico mantido como alternativa; terreno com biomas e cordilheiras, projéteis e torretas, muros com caminhos, veterância, carcaças, Tempestade de Éter, som e voz, controles de toque), a **prova de conceito visual 2D** (`estilo.html`) e a **validação do caminho 3D** (`estilo3d.html`, Three.js), para testes com amigos.

**Jogar agora:** abra `index.html` pelo GitHub Pages deste repositório (link na descrição) ou localmente, direto no navegador. Funciona em desktop e celular; nada para instalar.

**Provas de conceito visuais:** `estilo.html` (sprites voxel 2D) e `estilo3d.html` (os mesmos modelos em 3D com luz e sombras).

## O que testar

1. Uma partida 1v1 no Fácil para aprender os controles (tecla H abre a ajuda).
2. Uma partida FFA com 2 IAs no Normal.
3. Tente roubar: treine um Pirata no Quartel e clique com o botão direito em uma Refinaria inimiga.
4. Tente um pacto pela Diplomacia e, se quiser, quebre-o na hora certa.
5. Desenhe muros arrastando o mouse (B, depois M) e deixe um Portão (G) para suas unidades.
7. Multiplayer: o anfitrião escolhe o tamanho da sala (2 a 4 jogadores), clica em "Criar sala" e envia o código de seis letras; cada amigo escolhe a facção, digita o código e clica em "Entrar" (ou em "Iniciar partida", que com um código digitado entra na sala em vez de abrir um jogo solo). A lista da sala mostra quem entrou; a partida começa quando a sala enche ou quando o anfitrião clica em "Iniciar partida" com 2 ou mais. Só os jogadores da sala entram no mapa, sem IAs. Quem digitar o código antes de o anfitrião abrir a sala fica tentando por um minuto; o anfitrião reaproveita o código da última sala ao recriá-la. Versões diferentes do jogo entre navegadores são recusadas com aviso (Ctrl+F5 nos dois lados). Sem servidor de jogo: o anfitrião é o relé do lockstep (PeerJS/WebRTC, só STUN); se um convidado cair, as unidades dele ficam paradas e a partida segue. A simulação usa matemática determinística (seno, cosseno, atan2 e hipotenusa só com aritmética), por isso Chrome, Firefox e Safari calculam o mesmo estado; `node tools/det-test.cjs` confere isso nos quatro motores.
6. No celular: toque em uma unidade sua, depois toque no chão para mover ou no inimigo para atacar. A barra inferior tem Núcleo, Exército, Na tela, Construir, Atacar, Parar, Caixa e ✕.

## Como dar feedback

Na tela final, o botão **Copiar resultado (JSON)** copia um resumo da partida (Raça, duração, placar, estatísticas, aparelho) para colar na Issue. O botão **Enviar feedback** abre o modelo de Issue já preenchido.


Abra uma **Issue** usando o modelo "Feedback de partida" (ou mande a captura da tela final). Perguntas que mais ajudam:

- Em que momento você se perdeu ou ficou sem saber o que fazer?
- O roubo e os alertas ficaram claros? Deu vontade de contra-atacar?
- A IA foi fácil, justa ou injusta? Em que minuto veio o primeiro ataque?
- O que faltou para a partida ser divertida?

## Estrutura

```
aether-rift-dominion/
├─ index.html        jogo em arquivo único (gerado; é o que o GitHub Pages serve)
├─ estilo.html       prova de conceito do visual voxel isométrico (gerado)
├─ estilo3d.html     validação 3D em Three.js com os mesmos modelos (gerado)
├─ src/              fontes do jogo: sim.js (simulação determinística), ai.js, voxel.js e models.js (modelos voxel),
│                    vox3d.js (voxel → malha), render.js (2D isométrico), render3d.js (Three.js), audio.js, net.js (P2P lockstep), input.js, main.js, index.tpl.html
├─ style/            cena da prova de conceito 2D (scene.js, boot.js, index.tpl.html)
├─ style3d/          cena da validação 3D (scene3d.js, boot.js, index.tpl.html)
├─ tools/            build.mjs (gera index.html, estilo.html e dist/) e test.cjs (IA contra IA, invariantes, determinismo)
├─ docs/             conceito, plano de desenvolvimento e proposta do beta v1.5
└─ capturas/         imagens de referência do estilo
```

Dificuldades medidas (jogador defensivo de referência contra cada nível): `node tools/difficulty-test.cjs <facil|normal|dificil|brutal> [partidas] [minutos] > dist/difficulty.jsonl` e `python3 tools/difficulty-summary.py` · Campanha no Node (20 missões com a IA no lugar do humano): `node tools/missions-test.cjs [ids|todas] [minutos] [dificuldade]` · Portão de qualidade completo: `node tools/qa.cjs` (sintaxe, malhas 3D, testes, determinismo, smoke das 5 Raças, build e versão; imprime a linha "Qualidade e deploy") · Catálogo 3D por Raça: `node tools/catalogo-render.cjs` · Malhas no Node: `node tools/meshes-test.mjs` · Build: `node tools/build.mjs` · Teste headless: `node tools/test.cjs` · Self-play de balanceamento das cinco Raças: `tools/selfplay-all.sh [sementes] [minutos] [procs] > dist/selfplay.jsonl` (ou `node tools/selfplay.cjs raçaA raçaB`) · Determinismo entre motores: `node tools/det-test.cjs` · Multiplayer real com N navegadores: `node tools/mp-test.cjs <url> <saida> [n] [gfx] [espera] [early] [drop] [browsers] [joinvia] [prejoin]` · Captura: `node tools/shot.cjs` (os três com `NODE_PATH` apontando para um node_modules com playwright) · Captura headless sem rede: `node tools/vendor.mjs` (baixa three r160 para `dist/vendor/`) e o build passa a gerar `dist/local.html`, igual ao jogo mas carregando three local (use com Playwright/Chromium; `--virtual-time-budget` do Chromium congela a página em tick 0 de forma intermitente)

Conteúdo em fase de teste. Todos os direitos reservados; não é permitido redistribuir fora deste repositório sem autorização.
