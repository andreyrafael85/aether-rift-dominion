# Aether Rift: Dominion — beta de testes

RTS multiplayer browser-first em desenvolvimento. Este repositório publica o **beta 2.0a jogável** (contra IA: visual isométrico voxel, projéteis e torretas, muros com caminhos, veterância, carcaças, Tempestade de Éter, som e voz, controles de toque) e a **prova de conceito visual** que originou essa direção, para testes com amigos.

**Jogar agora:** abra `index.html` pelo GitHub Pages deste repositório (link na descrição) ou localmente, direto no navegador. Funciona em desktop e celular; nada para instalar.

**Prova de conceito visual (v1.5):** `estilo.html`.

## O que testar

1. Uma partida 1v1 no Fácil para aprender os controles (tecla H abre a ajuda).
2. Uma partida FFA com 2 IAs no Normal.
3. Tente roubar: treine um Pirata no Quartel e clique com o botão direito em uma Refinaria inimiga.
4. Tente um pacto pela Diplomacia e, se quiser, quebre-o na hora certa.
5. Desenhe muros arrastando o mouse (B, depois M) e deixe um Portão (G) para suas unidades.
6. No celular: toque em uma unidade sua, depois toque no chão para mover ou no inimigo para atacar. A barra inferior tem Núcleo, Exército, Na tela, Construir, Atacar, Parar, Caixa e ✕.

## Como dar feedback

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
├─ src/              fontes do jogo: sim.js (simulação determinística), ai.js, voxel.js e models.js
│                    (sprites voxel), render.js, input.js, main.js, index.tpl.html (HUD e CSS)
├─ style/            cena da prova de conceito (scene.js, boot.js, index.tpl.html)
├─ tools/            build.mjs (gera index.html, estilo.html e dist/) e test.cjs (IA contra IA, invariantes, determinismo)
├─ docs/             conceito, plano de desenvolvimento e proposta do beta v1.5
└─ capturas/         imagens de referência do estilo
```

Build: `node tools/build.mjs` · Teste headless: `node tools/test.cjs`

Conteúdo em fase de teste. Todos os direitos reservados; não é permitido redistribuir fora deste repositório sem autorização.
