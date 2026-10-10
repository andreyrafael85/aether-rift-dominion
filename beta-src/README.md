# Aether Rift: Dominion — beta 0.1 (fonte)

- `src/sim.js`   simulação determinística, dirigida por comandos (sem DOM; roda em Node)
- `src/ai.js`    IA de oponente (só emite comandos; usa o RNG da simulação)
- `src/render.js` renderizador Canvas 2D (mundo, névoa, efeitos, minimapa)
- `src/input.js` mouse, teclado e toque → comandos
- `src/main.js`  tela inicial, laço de jogo, HUD, diplomacia, dicas, tela final
- `index.tpl.html` HUD e CSS; `<!--SCRIPTS-->` é substituído no build

Build (gera `dist/aether-rift-beta.html`, arquivo único):  node build.mjs
Teste headless (IA vs IA, invariantes, determinismo):      node test.cjs

Parâmetros de URL para teste: ?autostart=1&seed=5&opp=2&faction=erevane&diff=normal&ff=200&speed=2&touch=1&debug=1
