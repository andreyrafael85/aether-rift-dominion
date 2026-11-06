/* Aether Rift: Dominion — 5.0h: a IA 3.0 na interface. Falas das IAs pelo retrato (eventos { t: 'ia', ev: 'fala' } do src/ai.js, só interface,
   fora do hash) na legenda que já existe (ARD.hud3.falaIA → caption() do src/ui-hud3.js), com o retrato, o nome e a cor do líder que fala, e os
   pedidos à IA aliada ("Atacar meu alvo", "Defender minha base", "Expandir") pelo comando { t: 'pedido' }, que passa pela fila de comandos e vale
   no multiplayer. Os botões só aparecem quando há uma IA aliada (pacto ou Caçada com aliados), no computador e no celular.
   Chaves de teste: ?iafala=0 (sem falas), ?iapedido=1 (mostra os botões mesmo sem aliada, para fotos). O main.js chama mount() ao começar a
   partida e evento(e) para cada evento da simulação. Regras da casa: o DOM só é escrito quando algo muda, nada lê layout no laço. */
(function (ARD) {
'use strict';
const S = ARD.sim;
const T = (k, v, d) => (ARD.t ? ARD.t(k, v, d) : d != null ? d : k);
const params = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams('');
const SEM_FALA = params.get('iafala') === '0', SEMPRE = params.get('iapedido') === '1';
const RECARGA_MS = 9000; /* entre duas falas na tela, de qualquer IA (a IA já tem recarga própria de 35 s e 150 s por fala) */
let C = null, box = null, timer = 0, ultima = -1e9, visivel = null, chave = '';

const CSS = `#ia-ped{display:grid;gap:calc(4px*var(--k,1));width:calc(206px*var(--k,1))}#ia-ped[hidden]{display:none}
#ia-ped .iah{justify-self:start;font:600 calc(9.5px*var(--k,1))/1.2 var(--fm,monospace);letter-spacing:.14em;text-transform:uppercase;color:var(--fg,#e8ecf2);padding:2px 8px 2px 6px;background:linear-gradient(90deg,var(--race,#6cf) 0 3px,rgba(11,14,19,.92) 3px)}
#ia-ped .iab{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:calc(4px*var(--k,1))}#ia-ped .cur{display:none}
#ia-ped button{--c:6px;min-width:0;overflow:hidden;min-height:44px;padding:4px 3px;font:600 calc(10.5px*var(--k,1))/1.1 var(--fb,sans-serif);color:var(--fg,#e8ecf2);text-align:center;cursor:pointer;border:0;
  clip-path:polygon(var(--c) 0,100% 0,100% calc(100% - var(--c)),calc(100% - var(--c)) 100%,0 100%,0 var(--c));background:linear-gradient(90deg,var(--race,#6cf) 0 3px,#0000 3px),linear-gradient(180deg,rgba(20,25,34,.95),rgba(11,14,19,.95))}
#ia-ped button:hover,#ia-ped button:focus-visible{background:linear-gradient(90deg,var(--race,#6cf) 0 3px,#0000 3px),linear-gradient(180deg,rgba(34,42,56,.97),rgba(18,22,30,.97));outline:none}
#ia-ped button.ok{color:var(--race-ink,#000);background:var(--race,#6cf)}
#ia-ped button i{display:block;font-style:normal;font-size:15px;line-height:1;margin-bottom:2px}
body.touch #ia-ped{width:100%;min-width:0}body.touch #ia-ped .iah{font-size:9px}body.touch #ia-ped .iab{grid-template-columns:repeat(2,minmax(0,1fr));gap:3px}body.touch #ia-ped button{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;font-size:9.5px;padding:2px 1px;white-space:nowrap}body.touch #ia-ped button i{margin:0;font-size:13px}body.touch #ia-ped .lon{display:none}body.touch #ia-ped .cur{display:inline}
@media (orientation:landscape){body.touch #ia-ped .iab{grid-template-columns:repeat(3,minmax(0,1fr))}body.touch #ia-ped button{min-height:44px;font-size:8.5px;letter-spacing:-.01em;padding:2px 0}}
body.bench #ia-ped{display:none!important}`;

function aliadas() { if (!C) return []; const sim = C.sim; return sim.players.filter(q => q.alive && !q.human && !q.fenda && q.id !== C.human && S.hasPact(sim, C.human, q.id)); }
function monta() {
  if (typeof document === 'undefined') return null; let b = document.getElementById('ia-ped');
  if (!document.getElementById('ia-ped-css')) { const st = document.createElement('style'); st.id = 'ia-ped-css'; st.textContent = CSS; document.head.appendChild(st); }
  if (!b) { b = document.createElement('div'); b.id = 'ia-ped'; b.setAttribute('role', 'group'); b.hidden = true;
    const right = document.getElementById('right'), quick = right && right.querySelector('.quick'); if (quick && quick.nextSibling) right.insertBefore(b, quick.nextSibling); else if (right) right.appendChild(b); else document.body.appendChild(b); }
  b.innerHTML = '<div class="iah"></div><div class="iab"><button type="button" data-ped="atacar"><i aria-hidden="true">⚔</i><span class="lon"></span><span class="cur"></span></button><button type="button" data-ped="defender"><i aria-hidden="true">⛨</i><span class="lon"></span><span class="cur"></span></button><button type="button" data-ped="expandir"><i aria-hidden="true">⬡</i><span class="lon"></span><span class="cur"></span></button></div>';
  b.querySelectorAll('button[data-ped]').forEach(bt => bt.addEventListener('click', () => pede(bt.dataset.ped, bt)));
  textos(b); return b;
}
function textos(b) { if (!b) return; b.setAttribute('aria-label', T('ia.ui.grupo', null, 'Pedidos à IA aliada')); b.querySelector('.iah').textContent = T('ia.ui.titulo', null, 'IA aliada');
  for (const k of ['atacar', 'defender', 'expandir']) { const bt = b.querySelector('[data-ped=' + k + ']'); bt.querySelector('.lon').textContent = T('ia.ui.' + k, null, k); bt.querySelector('.cur').textContent = T('ia.ui.' + k + '-c', null, k); /* no celular, o rótulo curto */ bt.title = T('ia.ui.' + k + '-d', null, ''); bt.setAttribute('aria-label', T('ia.ui.' + k, null, k) + '. ' + T('ia.ui.' + k + '-d', null, '')); } }
/* o alvo do jogador: o inimigo selecionado; senão o ponto no centro da tela (e a estrutura inimiga vista mais perto dele) */
function alvoDoJogador() {
  const { sim, view, human } = C; let alvo = null;
  if (view && view.sel) for (const id of view.sel) { const e = sim.byId.get(id); if (e && e.alive && e.owner >= 0 && e.owner !== sim.mundo /* 5.0h junção: ruína, nave e fauna não são alvo do pedido */ && S.isEnemy(sim, human, e.owner) && S.canSee(sim, human, e)) { alvo = e; break; } }
  const cx = view && view.cam ? view.cam.x : S.CX, cy = view && view.cam ? view.cam.y : S.CY;
  if (!alvo) { let bd = 420; for (const e of sim.ents) { if (!e.alive || (e.kind !== 'building' && e.kind !== 'unit') || e.owner < 0 || e.owner === sim.mundo /* 5.0h junção */ || !S.isEnemy(sim, human, e.owner) || !S.canSee(sim, human, e)) continue; const d = S.dist(cx, cy, e.x, e.y) - (e.kind === 'building' ? 60 : 0); if (d < bd) { bd = d; alvo = e; } } }
  return alvo ? { x: alvo.x, y: alvo.y, alvo: alvo.id } : { x: cx, y: cy, alvo: 0 };
}
function pede(tipo, bt) {
  if (!C) return; const { sim, human, I } = C; const qs = aliadas(); if (!qs.length) return;
  let o; if (tipo === 'atacar') o = alvoDoJogador(); else if (tipo === 'defender') { const n = S.nucleoOf(sim, human); o = n ? { x: n.x, y: n.y, alvo: 0 } : null; } else o = { x: C.view && C.view.cam ? C.view.cam.x : S.CX, y: C.view && C.view.cam ? C.view.cam.y : S.CY, alvo: 0 };
  if (!o) return;
  for (const q of qs) { const c = { t: 'pedido', para: q.id, tipo, x: Math.round(o.x), y: Math.round(o.y), alvo: o.alvo }; if (I && I.cmd) I.cmd(c); else { c.p = human; S.enqueue(sim, c); } }
  if (C.view) C.view.marker = { x: o.x, y: o.y, t: C.R && C.R.time || 0, col: tipo === 'atacar' ? '#FF6B5B' : tipo === 'defender' ? '#7FD0FF' : '#7FE3A1' };
  if (C.notice) try { C.notice(T('ia.ui.enviado', { pedido: T('ia.ui.' + tipo, null, tipo) }, '')); } catch (e) {}
  if (bt) { bt.classList.add('ok'); setTimeout(() => bt.classList.remove('ok'), 700); }
}
function atualiza() { if (!box || !C) return; const n = SEMPRE ? 1 : aliadas().length; const v = n > 0; if (v !== visivel) { visivel = v; box.hidden = !v; } const cor = C.sim.players[C.human] && C.sim.players[C.human].color; if (cor && cor !== chave) { chave = cor; } }
/* fala de uma IA: no idioma da hora, com o retrato do líder dela */
function fala(e) {
  if (SEM_FALA || !C || e.p === C.human || (e.para !== -1 && e.para !== C.human)) return;
  const q = C.sim.players[e.p]; if (!q || q.fenda || q.human) return; const agora = typeof performance !== 'undefined' ? performance.now() : Date.now(); if (agora - ultima < RECARGA_MS) return;
  const n = (Math.floor(e.time || 0) + e.p) % 2; const k = 'ia.fala.' + q.faction + '.' + e.chave + '.' + n; const txt = T(k, null, ''); if (!txt || txt === k) return;
  ultima = agora; const nome = (C.LEADER_NAME && C.LEADER_NAME[q.faction]) || q.name;
  if (ARD.hud3 && ARD.hud3.falaIA) ARD.hud3.falaIA(txt, { fac: q.faction, nome: nome + ' · ' + (ARD.i18n && ARD.i18n.d && ARD.i18n.d.jogador ? ARD.i18n.d.jogador(q.name) : q.name), cor: q.color });
}
function evento(e) { if (!e || !C) return; if (e.t === 'ia' && e.ev === 'fala') fala(e); else if (e.t === 'pact' || e.t === 'eliminated' || e.t === 'pedido' || e.t === 'alert') atualiza(); }
function mount(ctx) { C = ctx; visivel = null; box = monta(); atualiza(); if (timer) clearInterval(timer); timer = setInterval(atualiza, 2000); /* o pacto vence sem evento: confere a cada 2 s */
  if (typeof window !== 'undefined' && !window.__iaUIidioma) { window.__iaUIidioma = true; window.addEventListener('ard-idioma', () => textos(document.getElementById('ia-ped'))); } }
ARD.iaUI = { mount, evento, aliadas, pede };
})(globalThis.ARD = globalThis.ARD || {});
