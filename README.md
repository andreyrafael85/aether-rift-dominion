# Aether Rift: Dominion — beta de testes

RTS multiplayer browser-first em desenvolvimento. Este repositório publica o **beta 0.1 jogável** (contra IA) e a **prova de conceito visual** do beta v1.5 para testes com amigos.

**Jogar agora:** abra `index.html` pelo GitHub Pages deste repositório (link na descrição) ou localmente, direto no navegador. Funciona em desktop e celular; nada para instalar.

**Prova de conceito visual (v1.5):** `estilo.html`.

## O que testar

1. Uma partida 1v1 no Fácil para aprender os controles (tecla H abre a ajuda).
2. Uma partida FFA com 2 IAs no Normal.
3. Tente roubar: treine um Pirata no Quartel e clique com o botão direito em uma Refinaria inimiga.
4. Tente um pacto pela Diplomacia e, se quiser, quebre-o na hora certa.

## Como dar feedback

Abra uma **Issue** usando o modelo "Feedback de partida" (ou mande a captura da tela final). Perguntas que mais ajudam:

- Em que momento você se perdeu ou ficou sem saber o que fazer?
- O roubo e os alertas ficaram claros? Deu vontade de contra-atacar?
- A IA foi fácil, justa ou injusta? Em que minuto veio o primeiro ataque?
- O que faltou para a partida ser divertida?

## Estrutura

- `index.html` jogo em arquivo único (gerado de `beta-src/`)
- `estilo.html` prova de conceito do visual voxel isométrico (gerado de `style-src/`)
- `beta-src/` simulação determinística, IA, renderizador, entrada e HUD; `node build.mjs` gera o jogo, `node test.cjs` roda IA contra IA com verificação de invariantes
- `docs/` documento de conceito e plano de desenvolvimento
- `capturas/` imagens de referência do estilo

Conteúdo em fase de teste. Todos os direitos reservados; não é permitido redistribuir fora deste repositório sem autorização.
