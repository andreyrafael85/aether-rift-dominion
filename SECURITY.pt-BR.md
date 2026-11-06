# Segurança

[English](SECURITY.md) · **Português** · [Español](SECURITY.es.md)

## Como relatar um problema

Achou uma falha de segurança no jogo ou neste repositório (por exemplo, um token ou uma senha publicados por engano, um jeito de quebrar a partida de outra pessoa no multiplayer ou um script que roda onde não devia)? **Não abra uma Issue pública.** Use o relatório privado do GitHub: aba **Security** → **Report a vulnerability** neste repositório. Conte o que achou, como reproduzir e o que pode acontecer. A resposta vem em até 7 dias.

## O que o jogo guarda

O jogo roda inteiro no navegador: não há servidor de jogo, contas nem dados pessoais guardados por nós. O multiplayer usa PeerJS/WebRTC entre os navegadores, com o servidor público de sinalização do PeerJS só para encontrar a sala; a partida e os salvamentos ficam no aparelho de cada jogador.
