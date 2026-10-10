# Aether Rift: Dominion — beta de testes

RTS multiplayer browser-first em desenvolvimento. Este repositório publica o **beta 3.0c jogável** (três facções: Vehnar, Erevane e Tessara, com elenco ampliado; contra IA ou **multiplayer P2P por código de sala**; em 3D com Three.js: relevo, sombras, bloom, oclusão ambiente, névoa volumétrica, lagos de plasma, presets de qualidade, câmera com rotação; modo 2D isométrico mantido como alternativa; terreno com biomas e cordilheiras, projéteis e torretas, muros com caminhos, veterância, carcaças, Tempestade de Éter, som e voz, controles de toque), a **prova de conceito visual 2D** (`estilo.html`) e a **validação do caminho 3D** (`estilo3d.html`, Three.js), para testes com amigos.

**Jogar agora:** abra `index.html` pelo GitHub Pages deste repositório (link na descrição) ou localmente, direto no navegador. Funciona em desktop e celular; nada para instalar.

**Provas de conceito visuais:** `estilo.html` (sprites voxel 2D) e `estilo3d.html` (os mesmos modelos em 3D com luz e sombras).

## O que testar

1. Uma partida 1v1 no Fácil para aprender os controles (tecla H abre a ajuda).
2. Uma partida FFA com 2 IAs no Normal.
3. Tente roubar: treine um Pirata no Quartel e clique com o botão direito em uma Refinaria inimiga.
4. Tente um pacto pela Diplomacia e, se quiser, quebre-o na hora certa.
5. Desenhe muros arrastando o mouse (B, depois M) e deixe um Portão (G) para suas unidades.
7. Multiplayer: um jogador clica em "Criar sala" e envia o código de seis letras; o outro digita o código e clica em "Entrar". As IAs escolhidas pelo anfitrião entram na partida. Sem servidor: a conexão é direta entre os dois navegadores (WebRTC via PeerJS).
6. No celular: toque em uma unidade sua, depois toque no chão para mover ou no inimigo para atacar. A barra inferior tem Núcleo, Exército, Na tela, Construir, Atacar, Parar, Caixa e ✕.

## Como dar feedback

Na tela final, o botão **Copiar resultado (JSON)** copia um resumo da partida (facção, duração, placar, estatísticas, aparelho) para colar na Issue. O botão **Enviar feedback** abre o modelo de Issue já preenchido.


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

Build: `node tools/build.mjs` · Teste headless: `node tools/test.cjs` · Captura headless sem rede: `node tools/vendor.mjs` (baixa three r160 para `dist/vendor/`) e o build passa a gerar `dist/local.html`, igual ao jogo mas carregando three local (use com Playwright/Chromium; `--virtual-time-budget` do Chromium congela a página em tick 0 de forma intermitente)

Conteúdo em fase de teste. Todos os direitos reservados; não é permitido redistribuir fora deste repositório sem autorização.
