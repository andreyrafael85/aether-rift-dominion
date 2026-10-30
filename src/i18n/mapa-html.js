/* Aether Rift: Dominion — 5.0c: trechos do src/index.tpl.html que ficam sem data-i18n de propósito (as três linhas do painel de Ajustes da tela
   inicial: o cabeçalho "Aparelho", a linha longa das opções e a do Instalar, onde a frente do Som também mexe). Viram data-i18n aqui, na carga,
   antes da primeira tradução; o ARD.i18n.mapa não pisa num data-i18n que já exista. */
ARD.i18n.mapa({
  '.cpane[data-pane=ajustes] .chead b': 'ajustes.aparelho', '.cpane[data-pane=ajustes] .chead span': 'ajustes.aparelho-sub',
  'label[for=opt-gfx]': 'ajustes.graficos', '#opt-gfx option[value="3d"]': 'ajustes.gfx-3d', '#opt-gfx option[value="2d"]': 'ajustes.gfx-2d',
  'label[for=opt-quality]': 'ajustes.qualidade', '#opt-quality option[value=auto]': 'ajustes.q-auto', '#opt-quality option[value=baixa]': 'ajustes.q-baixa', '#opt-quality option[value=media]': 'ajustes.q-media', '#opt-quality option[value=alta]': 'ajustes.q-alta', '#opt-quality option[value=ultra]': 'ajustes.q-ultra',
  'label.chk:has(> #opt-bateria)': 'ajustes.bateria', 'label.chk:has(> #opt-cine)': 'ajustes.cine', 'label.chk:has(> #opt-dynres)': 'ajustes.dynres', 'label.chk:has(> #opt-som)': 'ajustes.som', 'label.chk:has(> #opt-voz)': 'ajustes.voz',
  'label[for=opt-voz-sel]': 'janela.ajustes.voz-falas', '#btn-voz-ouvir': 'janela.ajustes.pt-voz-ouvir',
  'label[for=opt-motor]': 'ajustes.motor', '#opt-motor option[value=classico]': 'ajustes.motor-classico', '#opt-motor option[value="5"]': 'ajustes.motor-5',
  '#btn-install': 'ajustes.instalar'
});
