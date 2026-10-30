# Aether Rift: Dominion — beta de pruebas

**Idiomas:** [Português (Brasil)](README.md) · [English](README.en.md) · **Español**

Un juego de estrategia en tiempo real gratis, hecho para el navegador. Cinco Razas se disputan la Grieta: el industrial **Consorcio Vehnar**, la sigilosa **Erevane**, la adaptable **Tessara**, la mente colmena de cristal **Coro Quorith** y la voraz **Prole Vorag**, cada una con su líder, su ejército, su Pirata y su superarma. Funciona en PC y en el celular, sin instalar nada.

**Juega ya:** abre el enlace de GitHub Pages que está en la descripción de este repositorio, o abre `index.html` en tu computadora con cualquier navegador moderno. El juego elige tu idioma solo (español, inglés o portugués de Brasil) y puedes cambiarlo cuando quieras en **Idioma**, en la pantalla de inicio, en Ajustes o en la ventana de ajustes de la partida. Para compartir un idioma, agrega `?lang=es`, `?lang=en` o `?lang=pt` al enlace.

## Qué tiene el juego
- **Escaramuza** contra 1 a 3 IA (Fácil, Normal, Difícil, Brutal) en dos mapas: la **Llanura de la Grieta** y **El Cinturón**, plataformas de asteroides flotando en el espacio.
- **Campaña "La Gran Alineación":** 20 misiones con historia (Prólogo, Actos 1 a 4 y las Misiones de Identidad de cada Raza), con estrellas, nivel de Comandante, reliquias, logros y el Hangar.
- **Multijugador de 2 a 4 amigos** por código de sala, de par a par (sin servidor de juego).
- Energía dinámica, tres recursos (Plasma, Mineral y Datos), territorio con Nódulos, robo de recursos con Piratas, Pactos de No Agresión que se pueden romper en el momento justo, Eras del Núcleo y la Ascensión de cada Raza.
- **Sala de Mando** en 3D en la pantalla de inicio con la **Academia de Mando** (cada unidad y construcción, explicada), **Modo Foto** (📷 o J), **prueba de rendimiento** de 30 s con detector de trabas y guardado automático que te devuelve a la partida si se cae internet o la luz.
- Gráficos: motor 3D clásico (Three.js), el nuevo **Motor 5** en prueba (WebGPU, con vuelta a WebGL2) y un modo 2D liviano para celulares básicos.

## Qué probar
1. Un 1 contra 1 en Fácil para aprender los controles (la tecla H abre la ayuda).
2. Un todos contra todos con 2 IA en Normal.
3. Roba: entrena un Pirata en el Cuartel y haz clic derecho en una Refinería enemiga.
4. Propón un pacto en Diplomacia y, si te animas, rómpelo en el momento justo.
5. Traza muros arrastrando el mouse (B y luego M) y deja un Portón (G) para tus unidades.
6. Multijugador: el anfitrión elige el tamaño de la sala (de 2 a 4), hace clic en **Crear sala** y envía el código de seis letras; cada amigo elige su Raza, escribe el código y hace clic en **Entrar**.
7. En el celular: toca una de tus unidades y después toca el suelo para mover o al enemigo para atacar.

## Comentarios
En la pantalla final, **Copiar resultado (JSON)** copia un resumen de la partida para pegarlo en un Issue, y **Enviar comentarios** abre la plantilla del Issue ya llenada. Las preguntas que más ayudan: ¿en qué momento te perdiste?, ¿el robo y las alertas quedaron claros?, ¿la IA fue justa? y ¿qué faltó para que la partida fuera divertida? El diagnóstico automático que va con los comentarios queda en portugués, para el desarrollador.

## Para desarrolladores
Todo el juego es un solo archivo HTML generado desde `src/` con `node tools/build.mjs` (el juego en sí no tiene dependencias de npm). Los idiomas están en `src/i18n.js` (la API `ARD.t(clave, vars)`, plurales con `Intl.PluralRules`, atributos `data-i18n` en el HTML) y en los diccionarios `src/i18n/pt-BR.js`, `en.js` y `es.js`; el glosario con cada término del juego en los tres idiomas está en `docs/glossario.md`. La puerta de calidad completa es `node tools/qa.cjs` (incluye la revisión "idiomas": claves que faltan, marcadores `{x}` distintos y portugués que quedó en pantalla en inglés o español).

Contenido en pruebas. Todos los derechos reservados; no se permite redistribuirlo fuera de este repositorio sin autorización.
