/* Aether Rift: Dominion — 5.5b (agente m-hud): HUD de moldura fina.
   O painel da partida começa pequeno e cresce só quando há o que mostrar. Tudo o que existia continua existindo (mesmos botões, mesmos ids,
   mesmos atalhos de teclado); muda onde cada coisa fica enquanto ninguém a pede:
   - a faixa escura da barra de cima some (ficam só os mostradores);
   - os nove botões de sistema (Foto, Som, Voz, Diplomacia, Pesquisa, Salvar, Ajustes, Ajuda, Sair) vão para um menu aberto por um botão só (#btn-sis);
   - o painel Construir fica recolhido numa plaqueta enquanto nada está selecionado (abre com a tecla B, com um clique nela ou com uma seleção);
   - o exército e a central de alertas abrem pelos dois botões ao lado do mapa; um alerta novo aparece sozinho por alguns segundos;
   - o mapa pequeno encolhe e ganha um botão de ampliar; o retrato do líder aparece só quando ele fala (8 segundos);
   - no celular, a gaveta do Construir começa fechada e os grupos vazios viram um só.
   A opção "Painel completo" (Ajustes da tela inicial e da partida; ?hud=completo no endereço) volta ao HUD de antes.
   Só interface: não conhece a simulação. A primeira partida guiada (body.guia) fica como era: o guia já faz o painel nascer aos poucos. */
(function (ARD) {
'use strict';
if (typeof document === 'undefined') { ARD.hudFino = { completo: () => false, partida() {}, estado() {}, aplica() {}, soTropas: () => false }; return; }
const CHAVE = 'ard-hud-v1'; const SIS = ['btn-foto', 'btn-sound', 'btn-voice', 'btn-diplo', 'btn-tech', 'btn-save', 'btn-a11y', 'btn-help', 'btn-menu'];
const T = (k, v, r) => (ARD.t ? ARD.t(k, v, r) : (r != null ? r : k)); const $ = id => document.getElementById(id);
const Q = new URLSearchParams(location.search);
function prefs() { try { return JSON.parse(localStorage.getItem(CHAVE) || '{}') || {}; } catch (e) { return {}; } }
function grava(p) { try { localStorage.setItem(CHAVE, JSON.stringify(Object.assign(prefs(), p))); } catch (e) {} }
function completo() { const q = Q.get('hud'); if (q === 'completo') return true; if (q === 'fino') return false; return !!prefs().completo; }
let C = null; /* a partida no ar: { G, sim, human, view, I, ui } */ let aberto = false; /* o Construir aberto à mão (fica até uma seleção, Esc ou outro clique no título) */ let alertaT = 0;
const fino = () => document.body.classList.contains('hudfino');
const guiado = () => !!(C && C.G && C.G.guia);

/* ---------- o menu de sistema: os nove botões num só ---------- */
function menuSis() { const sys = document.querySelector('#top .sys'); const hud = $('hud'); if (!sys || !hud) return;
  let bt = $('btn-sis'), menu = $('sis-menu'); const usar = fino() && !!C && !guiado() && !C.G.isTouch; /* no celular os botões de sistema já moram na barra de baixo (main.js) */
  if (!bt) { bt = document.createElement('button'); bt.id = 'btn-sis'; bt.type = 'button'; bt.className = 'tb'; bt.hidden = true; bt.setAttribute('aria-haspopup', 'true'); bt.setAttribute('aria-expanded', 'false'); bt.setAttribute('aria-controls', 'sis-menu');
    bt.innerHTML = '<svg class="tbi" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6.5h16M4 12h16M4 17.5h16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>'; sys.appendChild(bt);
    bt.addEventListener('click', ev => { ev.stopPropagation(); abreSis(menu.hidden); }); }
  if (!menu) { menu = document.createElement('div'); menu.id = 'sis-menu'; menu.hidden = true; menu.setAttribute('role', 'menu'); hud.appendChild(menu);
    menu.addEventListener('click', ev => { if (ev.target.closest && ev.target.closest('.tb')) setTimeout(() => abreSis(false), 0); });
    window.addEventListener('pointerdown', ev => { if (menu.hidden) return; const t = ev.target; if (t.closest && (t.closest('#sis-menu') || t.closest('#btn-sis'))) return; abreSis(false); }, true);
    window.addEventListener('keydown', ev => { if (ev.code === 'Escape' && !menu.hidden) abreSis(false); }, true);
    new MutationObserver(() => { const b = $('btn-sis'); if (b) b.classList.toggle('attn', !!menu.querySelector('.tb.attn')); }).observe(menu, { attributes: true, subtree: true, attributeFilter: ['class'] }); }
  rotulos();
  if (usar) { for (const id of SIS) { const b = $(id); if (b && b.parentElement === sys) menu.appendChild(b); } bt.hidden = false; }
  else { abreSis(false); for (const id of SIS) { const b = $(id); if (b && b.parentElement === menu) sys.insertBefore(b, bt); } bt.hidden = true; } }
function abreSis(on) { const bt = $('btn-sis'), menu = $('sis-menu'); if (!bt || !menu) return; menu.hidden = !on; bt.classList.toggle('on', !!on); bt.setAttribute('aria-expanded', on ? 'true' : 'false'); }
function rotulos() { const bt = $('btn-sis'); if (bt) { const s = T('fino.sistema', null, 'Sistema: som, salvar, ajustes, ajuda e sair'); bt.dataset.tip = s; bt.setAttribute('aria-label', s); }
  const bm = $('btn-mapa'); if (bm) { const s = T(document.body.classList.contains('fino-mapa') ? 'fino.mapa.reduzir' : 'fino.mapa.ampliar', null, 'Ampliar o mapa'); bm.dataset.tip = s; bm.setAttribute('aria-label', s); bm.setAttribute('aria-pressed', document.body.classList.contains('fino-mapa') ? 'true' : 'false'); }
  const cc = $('fino-cfg-rot'); if (cc) cc.textContent = T('fino.cfg.completo', null, 'Painel completo na partida'); const cd = $('fino-cfg-dica'); if (cd) cd.textContent = T('fino.cfg.dica', null, '');
  const pc = $('fino-pt-rot'); if (pc) pc.textContent = T('fino.cfg.completo', null, 'Painel completo na partida'); }

/* ---------- o mapa pequeno: menor, com um botão de ampliar ---------- */
function botaoMapa() { const radar = document.querySelector('#right .radar'); if (!radar || $('btn-mapa')) return; const b = document.createElement('button'); b.id = 'btn-mapa'; b.type = 'button';
  b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  b.addEventListener('pointerdown', ev => ev.stopPropagation()); b.addEventListener('click', ev => { ev.stopPropagation(); const on = !document.body.classList.contains('fino-mapa'); document.body.classList.toggle('fino-mapa', on); grava({ mapa: on }); rotulos(); });
  radar.appendChild(b); }

/* ---------- o painel Construir recolhido (computador) ---------- */
function estado() { const b = document.body; if (!C) { b.classList.remove('fino-vazio'); return; } const { G, view, I } = C;
  if (view.sel.size) aberto = false;
  const vazio = fino() && !G.isTouch && !guiado() && !G.bench && !view.sel.size && !I.buildMenu && !aberto;
  if (b.classList.contains('fino-vazio') !== vazio) b.classList.toggle('fino-vazio', vazio);
 }
function painelClique(ev) { if (!C || !fino() || C.G.isTouch || guiado()) return; const { view, I, ui } = C; const b = document.body;
  if (b.classList.contains('fino-vazio')) { aberto = true; estado(); if (!(ev.target.closest && ev.target.closest('.btab'))) { ev.stopPropagation(); ev.preventDefault(); } return; } /* a plaqueta abre o Construir; um clique numa aba abre já nela (o clique segue para a aba) */
  if (view.sel.size) return; const tit = ev.target.closest && ev.target.closest('#panel>.ph'); if (!tit) return; /* aberto e sem seleção: um clique no título recolhe */
  aberto = false; if (I.buildMenu) { I.buildMenu = false; ui.buildMenuChanged(false); } else estado(); }

/* celular: um grupo de tropas selecionado (duas ou mais unidades suas, nenhuma construção) usa a gaveta 'tropas', que começa fechada: fica o título com
   a contagem e a vida, e o mapa à vista; Atacar e Parar já estão na barra de baixo. Uma unidade só, ou uma construção, abre a ficha como antes. */
function soTropas(view, sim, human) { if (!C || !fino() || !C.G.isTouch || view.sel.size < 2) return false; for (const id of view.sel) { const e = sim.byId.get(id); if (!e || e.kind !== 'unit' || e.owner !== human) return false; } return true; }
/* ---------- alertas: aparecem sozinhos por alguns segundos quando chega um novo ---------- */
function vigiaAlertas() { const al = document.querySelector('#alertc .alist'); if (!al || al.__fino) return; al.__fino = true;
  new MutationObserver(ms => { if (!fino()) return; if (!ms.some(m => m.addedNodes && m.addedNodes.length)) return; document.body.classList.add('fino-alerta'); clearTimeout(alertaT); alertaT = setTimeout(() => document.body.classList.remove('fino-alerta'), 9000); }).observe(al, { childList: true, subtree: true }); }
/* retrato do líder: aparece por 8 segundos quando ele fala (o main.js tira e põe a classe talk a cada fala) e some; fora disso fica sem desenhar */
function vigiaLider() { const L = $('leader'); if (!L || L.__fino) return; L.__fino = true; let t = 0;
  new MutationObserver(ms => { if (!fino() || !L.classList.contains('talk')) return; if (!ms.some(m => !/(^|\s)talk(\s|$)/.test(m.oldValue || ''))) return; /* só quando a classe talk acabou de entrar */
    L.classList.add('fino-fala'); clearTimeout(t); t = setTimeout(() => L.classList.remove('fino-fala'), 8000); }).observe(L, { attributes: true, attributeFilter: ['class'], attributeOldValue: true }); }
/* a dica dos dois botões rápidos (Sobrecarga e Superarma) leva o custo ou a recarga, que no painel fino não cabem no botão */
function dicaRapida(ev) { if (!fino()) return; const b = ev.target.closest && ev.target.closest('.quick .qb'); if (!b) return; const sub = b.querySelector('.sub'), n = b.querySelector('.n'); const s = (n ? n.textContent : '') + (sub && sub.textContent ? ' · ' + sub.textContent : ''); if (s && b.dataset.tip !== s) b.dataset.tip = s; }

/* ---------- a opção "Painel completo" ---------- */
function opcoes() { /* Ajustes da tela inicial: um bloco próprio, antes do Enviar feedback */
  const pane = document.querySelector('#start .cpane[data-pane="ajustes"]');
  if (pane && !$('fino-cfg')) { const d = document.createElement('div'); d.id = 'fino-cfg'; d.className = 'opt fino-cfg'; d.innerHTML = '<label class="chk"><input type="checkbox" id="fino-completo"> <span id="fino-cfg-rot"></span></label><div class="small muted" id="fino-cfg-dica"></div>';
    const fb = $('cfg-feedback'); const ref = fb ? fb.closest('.row') : null; if (ref && ref.parentElement === pane) pane.insertBefore(d, ref); else pane.appendChild(d);
    $('fino-completo').addEventListener('change', ev => { grava({ completo: !!ev.target.checked }); aplica(); }); }
  /* Ajustes da partida: a mesma opção */
  const am = document.querySelector('#a11y .box'); if (am && !$('fino-pt')) { const d = document.createElement('div'); d.id = 'fino-pt'; d.className = 'h3a11y fino-cfg'; d.innerHTML = '<label class="chk"><input type="checkbox" id="fino-pt-completo"> <span id="fino-pt-rot"></span></label>';
    const ref = $('a11y-body'); if (ref && ref.parentElement === am) ref.after(d); else am.appendChild(d);
    $('fino-pt-completo').addEventListener('change', ev => { grava({ completo: !!ev.target.checked }); aplica(); }); }
  for (const id of ['fino-completo', 'fino-pt-completo']) { const c = $(id); if (c) c.checked = completo(); } rotulos(); }

function aplica() { const b = document.body; const f = !completo() && !guiado(); /* a primeira partida guiada fica como era */ b.classList.toggle('hudfino', f); b.classList.toggle('fino-mapa', f && !!prefs().mapa); if (!f) { b.classList.remove('fino-vazio', 'fino-alerta'); aberto = false; }
  for (const id of ['fino-completo', 'fino-pt-completo']) { const c = $(id); if (c) c.checked = completo(); }
  menuSis(); if (f) botaoMapa(); rotulos(); estado();
  if (C && C.G && C.G.isTouch && C.ui) { try { C.ui.buildMenuChanged(); } catch (e) {} } }
/* chamado pelo main.js quando a partida começa (depois do bindHUD e do HUD 3) */
function partida(ctx) { C = ctx; aberto = false; const G = ctx.G; const b = document.body; b.classList.remove('fino-vazio', 'fino-alerta', 'sh-alc', 'sh-army'); b.classList.toggle('hudfino', !completo() && !G.guia); b.classList.toggle('fino-mapa', fino() && !!prefs().mapa);
  if (fino() && G.isTouch && !G.guia) { G.drawer = G.drawer || {}; if (G.drawer.build == null) G.drawer.build = true; if (G.drawer.tropas == null) G.drawer.tropas = true; } /* no celular o Construir não abre sozinho: a gaveta começa fechada (o botão Construir da barra abre) */
  menuSis(); botaoMapa(); vigiaAlertas(); vigiaLider(); rotulos(); estado();
  const p = $('panel'); if (p && !p.__fino) { p.__fino = true; p.addEventListener('click', painelClique, true); }
  const hud = $('hud'); if (hud && !hud.__fino) { hud.__fino = true; hud.addEventListener('pointerover', dicaRapida, true);
    window.addEventListener('keydown', ev => { if (ev.code === 'Escape' && aberto && C && C.I.mode === 'normal' && !C.I.buildMenu && !C.view.sel.size) { aberto = false; estado(); } }); }
  if (G.isTouch && ctx.ui) { try { ctx.ui.buildMenuChanged(); } catch (e) {} } }
function montar() { aplica(); opcoes(); window.addEventListener('ard-idioma', rotulos); }
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montar); else montar();
ARD.hudFino = { CHAVE, SIS, completo, aplica, partida, estado, abreSis, soTropas, define(v) { grava({ completo: !!v }); aplica(); } };
})(globalThis.ARD = globalThis.ARD || {});
