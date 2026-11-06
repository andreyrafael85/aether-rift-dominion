# Seguridad

[English](SECURITY.md) · [Português](SECURITY.pt-BR.md) · **Español**

## Cómo reportar un problema

¿Encontraste una falla de seguridad en el juego o en este repositorio (por ejemplo, un token o una contraseña publicados por error, una forma de romper la partida de otra persona en el multijugador o un script que se ejecuta donde no debería)? **No abras un Issue público.** Usa el reporte privado de GitHub: pestaña **Security** → **Report a vulnerability** en este repositorio. Cuenta qué encontraste, cómo reproducirlo y qué puede pasar. La respuesta llega en hasta 7 días.

## Qué guarda el juego

El juego corre entero en el navegador: no hay servidor de juego, cuentas ni datos personales guardados por nosotros. El multijugador usa PeerJS/WebRTC entre los navegadores, con el servidor público de señalización de PeerJS solo para encontrar la sala; la partida y las partidas guardadas quedan en el dispositivo de cada jugador.
