/* Aether Rift: Dominion — 5.0h (agente h-unicas): interface das construções únicas, dos módulos com escolha e dos comandantes em campo.
   Só interface: a regra mora no src/unicas-sim.js. Tudo o que muda a partida sai como comando na fila ({ t: 'modulo' } e { t: 'habilidade' }),
   então vale no multiplayer. Textos pelas chaves uni.* e cmd.* dos três dicionários.
   - Tela inicial: "Comandantes em campo" ao lado dos mutadores (Escaramuça) e na sala do multiplayer (o anfitrião escolhe; vai na cfg para todos).
   - Construir: aba "Únicas" com as duas da sua Raça (atalhos J e K), trancada pela Era ou por já existir uma.
   - Painel da construção: os dois módulos lado a lado (nome, efeito, custo), com "para sempre"; depois, a instalação e o escolhido.
   - Barra do comandante (só com a opção): retrato com nível e vida, 3 habilidades com a recarga à vista (Z, X, C no teclado; no toque, toca e
     depois toca no chão ou no alvo), "volta em N s" quando ele cai. Mira: o alcance em anel em volta do avatar.
   - Efeitos das habilidades: anéis no chão (2D e 3D) e clarão no 3D; nuvem de esporos e raízes marcadas por anéis enquanto duram.
   Chaves de URL: ?cmd=1 (comandantes), ?cmdnivel=1..4 (nível inicial), ?unicas=1 (as duas únicas da sua Raça já prontas), ?unifx=0 (sem os efeitos). */
(function (ARD) {
'use strict';
const T = (k, v, r) => (ARD.t ? ARD.t(k, v, r) : (r != null ? r : k));
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const S = () => ARD.sim, UN = () => ARD.unicas;
const QS = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
const FX_ON = QS.get('unifx') !== '0';
const VIDA = Math.max(1, +QS.get('unifxvida') || 1); /* chave de teste: anéis que duram N vezes mais (fotos na GPU por software, a poucos quadros por segundo) */
const KEY = 'ard-unicas-v1';
const TECLAS = ['Z', 'X', 'C'];
function prefs() { try { return Object.assign({ cmdJogar: false, cmdSala: false }, JSON.parse(localStorage.getItem(KEY) || '{}') || {}); } catch (e) { return { cmdJogar: false, cmdSala: false }; } }
function guarda(p) { const o = Object.assign(prefs(), p); try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {} return o; }
const nomeHab = (id) => T('cmd.hab.' + id + '.nome');
const descHab = (id) => T('cmd.hab.' + id + '.desc');
const nomeMod = (def, m) => T('uni.mod.' + def + '.' + m.id + '.nome', null, m.name);
const descMod = (def, m) => T('uni.mod.' + def + '.' + m.id + '.desc', null, m.desc);
const custo = c => Object.keys(c).filter(k => c[k]).map(k => `<span class="c-${k}">${Math.round(c[k])}</span>`).join(' ');

/* ---------- estilo (um bloco só, na carga) ---------- */
function estilo() { if ($('uni-css')) return; const st = document.createElement('style'); st.id = 'uni-css'; st.textContent = `
.uni-op{margin:.5em 0 0}.uni-op label{display:flex;gap:.6em;align-items:flex-start;cursor:pointer}.uni-op small{display:block;opacity:.75}
.unimod{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:6px 0}.unimod .act{display:flex;flex-direction:column;align-items:flex-start;text-align:left;min-height:64px;padding:6px 8px;white-space:normal}
.unimod .act b{font-size:.92em}.unimod .act small{font-size:.78em;opacity:.85;line-height:1.25}.unimod .act .cost{margin-top:auto;font-size:.78em}
.unimod-h{font-size:.8em;opacity:.8;margin-top:4px;display:flex;justify-content:space-between;gap:6px}.unimod-ok{border-left:3px solid #7FE3A1;padding-left:6px}
#cmd-bar{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(var(--uni-bottom,232px));z-index:30;display:flex;gap:6px;align-items:stretch;padding:5px;border-radius:12px;background:rgba(12,14,18,.78);border:1px solid rgba(255,255,255,.14);backdrop-filter:blur(6px);pointer-events:auto;touch-action:manipulation}
#cmd-bar[hidden]{display:none}
#cmd-bar .cb-av{position:relative;width:54px;height:54px;border-radius:9px;border:2px solid var(--rc,#fff);background:#000 center/cover;cursor:pointer;padding:0;overflow:hidden}
#cmd-bar .cb-av img{width:100%;height:100%;object-fit:cover}#cmd-bar .cb-lv{position:absolute;right:2px;top:1px;font:700 11px/1 system-ui;color:#fff;text-shadow:0 1px 2px #000}
#cmd-bar .cb-hp{position:absolute;left:0;right:0;bottom:0;height:5px;background:rgba(0,0,0,.6)}#cmd-bar .cb-hp i{display:block;height:100%;background:#7FE3A1;width:100%}
#cmd-bar .cb-off{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:700 12px/1.1 system-ui;color:#fff;background:rgba(0,0,0,.66);text-align:center}
#cmd-bar .cb-h{position:relative;width:54px;height:54px;border-radius:9px;border:1px solid rgba(255,255,255,.22);background:linear-gradient(160deg,rgba(255,255,255,.12),rgba(255,255,255,.03));color:#fff;cursor:pointer;padding:0;overflow:hidden;font:600 10px/1.1 system-ui}
#cmd-bar .cb-h .ic{display:block;font-size:20px;line-height:24px;margin-top:5px;color:var(--rc,#fff)}#cmd-bar .cb-h .nm{display:block;padding:0 2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#cmd-bar .cb-h .k{position:absolute;left:3px;top:2px;font-size:9px;opacity:.75}#cmd-bar .cb-h .cd{position:absolute;left:0;right:0;bottom:0;height:0;background:rgba(0,0,0,.66)}
#cmd-bar .cb-h .cdt{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:700 15px/1 system-ui;color:#fff;text-shadow:0 1px 3px #000}
#cmd-bar .cb-h.on{outline:2px solid var(--rc,#fff);outline-offset:-2px}#cmd-bar .cb-h.cool{cursor:default}#cmd-bar .cb-h:disabled{opacity:.45}
@media (max-width:520px){#cmd-bar{gap:4px;padding:4px}#cmd-bar .cb-av,#cmd-bar .cb-h{width:46px;height:46px}#cmd-bar .cb-h .ic{font-size:17px;line-height:20px;margin-top:3px}#cmd-bar .cb-h .nm{font-size:9px}}
`; document.head.appendChild(st); }

/* ---------- tela inicial e sala ---------- */
/* 5.0h junção: a opção fica dentro do bloco de regras do src/modos-ui.js (Escaramuça e sala), logo abaixo do Mundo vivo; a cfg sai pelo cfgJogar/cfgSala dele */
function bloco(id, onde, aoMudar) { const el = $(id); if (!el) return; estilo(); const p = prefs(); const k = onde === 'sala' ? 'cmdSala' : 'cmdJogar'; el.className = 'uni-op';
  el.innerHTML = `<label class="chk"><input type="checkbox" ${p[k] ? 'checked' : ''}> <span><b>${esc(T('cmd.opcao'))}</b><small>${esc(T('cmd.opcao-d'))}</small></span></label>`;
  el.querySelector('input').addEventListener('change', e => { guarda({ [k]: e.target.checked }); if (aoMudar) aoMudar(); }); }
function montar() { estilo(); }
function cfgJogar() { return prefs().cmdJogar ? { comandantes: true } : {}; }
function cfgSala() { return prefs().cmdSala ? { comandantes: true } : {}; }
function modoSala() { return !!prefs().cmdSala; }
function linha() { return T('cmd.opcao'); }
function cfgUrl(q) { const o = {}; if (q.get('cmd') === '1') o.comandantes = true; if (q.get('cmdnivel')) o.cmdNivel = Math.max(1, Math.min(4, +q.get('cmdnivel') | 0)); if (q.get('unicas') === '1') o.unicasTeste = 'humano'; return o; }

/* ---------- Construir: a aba das únicas ---------- */
function defs(fac) { const s = S(); return (s && s.UNICAS_DE && s.UNICAS_DE[fac]) || []; }
function trava(sim, human, def) { const s = S(); const d = s.BUILDINGS[def]; if (!d || !d.unica) return null; return s.unicaLivre(sim, human, def) ? null : 'Construção única: só uma por jogador'; }

/* ---------- painel da construção: módulo com escolha ---------- */
function chave(ents) { let k = ''; for (const e of ents) if (e.modulo) k += e.id + (e.modulo.pronto ? 'p' : 'm') + e.modulo.k; return k; }
function painel(e, sim, human) { const h0 = painel0(e, sim, human); return h0 ? '<div class="unibox">' + h0 + '</div>' : ''; }
function painel0(e, sim, human) { const s = S(); let h = '';
  const d = s.BUILDINGS[e.def]; if (d && d.unica) h += `<div class="tip">★ ${esc(T('uni.unica'))} · ${esc(ARD.i18n && ARD.i18n.d ? ARD.i18n.d.construcaoDesc(e.def) : d.desc)}</div>`;
  const L = s.MODULOS && s.MODULOS[e.def]; if (!L || !e.built) return h; const p = sim.players[human];
  if (e.modulo) { const m = L[e.modulo.k === 'b' ? 1 : 0];
    if (!e.modulo.pronto) { const falta = Math.max(0, e.modulo.ate - sim.time); h += `<div class="small">${esc(T('uni.instalando', { nome: nomeMod(e.def, m) }))} · <span data-unit>${Math.ceil(falta)} s</span></div><div class="hp evo" data-unibar><i style="width:${Math.round(100 * (1 - falta / m.time))}%"></i></div>`; }
    else h += `<div class="tip unimod-ok">✓ ${esc(nomeMod(e.def, m))}: ${esc(descMod(e.def, m))}</div>`; return h; }
  const eraOk = (p.era || 1) >= L[0].era;
  h += `<div class="unimod-h"><b>${esc(T('uni.modulo-tit'))}</b><span>${esc(T('uni.para-sempre'))}</span></div><div class="unimod">`;
  for (const m of L) { const can = s.canAfford(p, m.cost); const lk = eraOk ? null : T('uni.requer-era2');
    h += `<button class="act ${can ? '' : 'poor'} ${lk ? 'locked' : ''}" data-unimod="${m.k}" ${lk ? `data-lock="${esc(lk)}"` : ''}><b>${esc(nomeMod(e.def, m))}</b><small>${esc(descMod(e.def, m))}</small><span class="cost">${lk ? '🔒 ' + esc(lk) : custo(m.cost) + ' · ' + m.time + ' s'}</span></button>`; }
  return h + '</div>'; }
function liga(panel, e, cmd, notice) { { const bx = panel.querySelector('.unibox'), hd = panel.querySelector('.sel-head'); if (bx && hd && hd.parentNode === bx.parentNode) { const ref = hd.nextElementSibling && !hd.nextElementSibling.classList.contains('unibox') && !hd.nextElementSibling.matches('.grid,.pqty,[data-qrow]') ? hd.nextElementSibling : hd; ref.after(bx); } } /* o módulo logo abaixo do cabeçalho (no celular, à vista sem rolar a gaveta) */
  panel.querySelectorAll('[data-unimod]').forEach(b => b.addEventListener('click', () => { if (b.dataset.lock) { notice('🔒 ' + b.dataset.lock); return; }
  cmd({ t: 'modulo', id: e.id, escolha: b.dataset.unimod }); })); }

/* ---------- partida: barra do comandante, mira, teclas e efeitos ---------- */
let G = null; const V = { bar: null, btns: [], av: null, lv: null, hp: null, off: null, mira: -1, ringT: 0, fxT: 0, last: '', n: 0 };
const ICON = { martelo: '⚒', reparo: '✚', fundicao: '⛭', veu: '◐', lamina: '⟋', ecofalso: '❖', raizes: '⌇', florescer: '✿', esporos: '⁂', acorde: '♫', estilhaco: '✶', silencio: '◌', devorar: '◗', ninhada: '⬮', rugido: '≋' };
function corRaca(fac) { return (ARD.unicasModelos && ARD.unicasModelos.RACA_COR[fac]) || '#FFFFFF'; }
function notice(text) { const n = $('notice'); if (!n) return; n.textContent = text; n.classList.add('show'); clearTimeout(V.noticeT); V.noticeT = setTimeout(() => n.classList.remove('show'), 2200); }
function barra(g) { const sim = g.sim, s = S(), p = sim.players[g.human]; const C = s.COMANDANTES[p.faction]; if (!C) return;
  let el = $('cmd-bar'); if (!el) { el = document.createElement('div'); el.id = 'cmd-bar'; document.body.appendChild(el); }
  el.style.setProperty('--rc', corRaca(p.faction)); el.setAttribute('role', 'toolbar'); el.setAttribute('aria-label', T('cmd.barra'));
  const ico = g.R && g.R.icon ? g.R.icon(C.def, g.human) : '';
  el.innerHTML = `<button class="cb-av" type="button" data-cbav title="${esc(T('unit.' + C.def + '.nome'))}"><img alt="" src="${ico}"><span class="cb-lv" data-cblv>1</span><span class="cb-hp"><i data-cbhp></i></span><span class="cb-off" data-cboff hidden></span></button>` +
    C.habilidades.map((h, n) => `<button class="cb-h" type="button" data-cbh="${n}" title="${esc(nomeHab(h.id) + ' (' + TECLAS[n] + '): ' + descHab(h.id))}"><span class="k">${TECLAS[n]}</span><span class="ic">${ICON[h.id] || '•'}</span><span class="nm">${esc(nomeHab(h.id))}</span><span class="cd" data-cbcd></span><span class="cdt" data-cbct></span></button>`).join('');
  V.bar = el; V.av = el.querySelector('[data-cbav]'); V.lv = el.querySelector('[data-cblv]'); V.hp = el.querySelector('[data-cbhp]'); V.off = el.querySelector('[data-cboff]');
  V.btns = [...el.querySelectorAll('[data-cbh]')].map(b => ({ b, cd: b.querySelector('[data-cbcd]'), ct: b.querySelector('[data-cbct]'), st: '' }));
  V.av.addEventListener('click', () => { const u = s.avatarDe(sim, g.human); if (u && g.I) { if (g.I.center) g.I.center(u.x, u.y); selecionar(u); } });
  V.btns.forEach((o, n) => o.b.addEventListener('click', ev => { ev.preventDefault(); aperta(n); }));
  el.hidden = false; posiciona(); }
function selecionar(u) { const g = G; if (!g || !g.view) return; g.view.sel = new Set([u.id]); if (g.I && g.I.setSel) g.I.setSel([u.id]); }
function posiciona() { if (!V.bar) return; /* celular (painel embaixo, na largura toda): logo acima do painel; computador (painel no canto de baixo à esquerda): no rodapé, no meio do espaço livre à direita do painel */
  const W = window.innerWidth, Hh = window.innerHeight, cx = W / 2; let fundo = 14, meio = cx; const pn = $('panel'); const r = pn && pn.offsetParent !== null ? pn.getBoundingClientRect() : null;
  if (r && r.height > 0 && r.top > Hh * 0.3) { if (r.left < W * 0.1 && r.right < W * 0.62) meio = Math.min(W - 140, (r.right + W - 200) / 2); else if (r.left < cx + 150 && r.right > cx - 150) fundo = Hh - r.top + 8; }
  V.bar.style.setProperty('--uni-bottom', Math.round(fundo) + 'px'); V.bar.style.left = Math.round(meio) + 'px'; }
function aperta(n) { const g = G; if (!g) return; const sim = g.sim, s = S(); const u = s.avatarDe(sim, g.human); if (!u) { notice(T('cmd.fora')); return; } const h = s.habDe(u)[n];
  if (sim.time < u.cmd.cd[n]) { notice(T('cmd.recarga', { s: Math.ceil(u.cmd.cd[n] - sim.time) })); return; }
  if (h.alvo === 'proprio') { g.I.cmd({ t: 'habilidade', id: u.id, n, x: u.x, y: u.y }); V.mira = -1; return; }
  if (V.mira === n) { V.mira = -1; g.I.setMode('normal'); return; }
  V.mira = n; g.I.setMode('habilidade'); V.ringT = 0; notice(T(h.alvo === 'unidade' ? 'cmd.mira-alvo' : 'cmd.mira-chao', { nome: nomeHab(h.id) })); }
/* o clique (ou toque) no mapa no modo de mira: chamado pelo src/input.js */
function mira(wx, wy, alvo) { const g = G; if (!g || V.mira < 0) return; const s = S(), sim = g.sim; const u = s.avatarDe(sim, g.human); const n = V.mira; V.mira = -1; if (!u) return; const h = s.habDe(u)[n];
  if (h.alvo === 'unidade') { if (!alvo || alvo.owner === g.human || alvo.owner < 0 || (alvo.kind !== 'unit' && alvo.kind !== 'building')) { notice(T('cmd.escolha-inimigo')); return; } g.I.cmd({ t: 'habilidade', id: u.id, n, alvo: alvo.id, x: alvo.x, y: alvo.y }); }
  else g.I.cmd({ t: 'habilidade', id: u.id, n, x: wx, y: wy });
  if (g.view) g.view.marker = { x: wx, y: wy, t: g.R.time, col: corRaca(sim.players[g.human].faction) }; }
/* teclas: Z X C (com a barra), chamado pelo src/input.js; devolve true quando usou a tecla */
function tecla(k, e) { const g = G; if (!g || !V.bar || V.bar.hidden || e.ctrlKey || e.metaKey || e.altKey) return false; const n = TECLAS.indexOf(k); if (n < 0) return false; if (!e.repeat) aperta(n); return true; }
function quadro(now, dt, g) { if (!g || !g.sim) return; if (G !== g) { G = g; V.mira = -1; V.bar = null; const old = $('cmd-bar'); if (old) old.remove(); if (g.sim.cfg && g.sim.cfg.comandantes && !g.sim.players[g.human].fenda) barra(g); }
  const sim = g.sim, s = S(); V.n++;
  if (g.I && g.I.mode !== 'habilidade' && V.mira >= 0) V.mira = -1;
  if (V.bar && V.n % 3 === 0) { const p = sim.players[g.human]; const u = s.avatarDe(sim, g.human);
    if (V.n % 12 === 0) posiciona();
    if (u) { V.off.hidden = true; const lv = String(u.cmd.nivel); if (V.lv.textContent !== lv) V.lv.textContent = lv; V.hp.style.width = Math.round(100 * u.hp / u.maxHp) + '%';
      V.btns.forEach((o, n) => { const f = Math.max(0, u.cmd.cd[n] - sim.time); const h = s.habDe(u)[n]; const tot = s.cdHab(h, u); const st = f > 0 ? Math.ceil(f) + '' : ''; if (o.st !== st) { o.st = st; o.ct.textContent = st; o.b.classList.toggle('cool', f > 0); } o.cd.style.height = f > 0 ? Math.round(100 * f / tot) + '%' : '0'; o.b.classList.toggle('on', V.mira === n); o.b.disabled = false; }); }
    else { const f = Math.max(0, (p.cmdVolta || 0) - sim.time); const t = f > 0 ? T('cmd.volta-em', { s: Math.ceil(f) }) : T('cmd.fora'); if (V.off.textContent !== t) V.off.textContent = t; V.off.hidden = false; V.btns.forEach(o => { o.b.disabled = true; o.cd.style.height = '0'; if (o.st) { o.st = ''; o.ct.textContent = ''; } }); } }
  /* mira: o alcance em anel em volta do avatar */
  if (V.mira >= 0 && g.R && g.R.fx) { V.ringT -= dt; const u = s.avatarDe(sim, g.human); if (u && V.ringT <= 0) { V.ringT = 0.5; const h = s.habDe(u)[V.mira]; g.R.fx.rings.push({ x: u.x, y: u.y, r0: h.alcance, r1: h.alcance, col: corRaca(sim.players[g.human].faction), t: 0, life: 0.55 * VIDA }); } }
  /* nuvens de esporos e raízes à vista: anéis enquanto duram (2D e 3D) */
  if (FX_ON && sim.unicas && g.R && g.R.fx) { V.fxT -= dt; if (V.fxT <= 0) { V.fxT = 0.45; const vis = sim.vis[g.human];
    for (const z of sim.unicas.zonas) g.R.fx.rings.push({ x: z.x, y: z.y, r0: z.r * 0.45, r1: z.r, col: '#B8E66A', t: 0, life: 0.7 * VIDA });
    let n = 0; for (const e of sim.ents) { if (n > 24) break; if (e.alive && e.raizAte > sim.time && (e.owner === g.human || vis.has(e.id))) { n++; g.R.fx.rings.push({ x: e.x, y: e.y, r0: e.r + 2, r1: e.r + 8, col: '#7FE3A1', t: 0, life: 0.5 * VIDA }); } } } }
  if (V.n % 6 === 0) { const ut = document.querySelector('#panel [data-unit]'); if (ut) { const sel = g.view && g.view.sel ? [...g.view.sel] : []; const b = sel.length === 1 ? sim.byId.get(sel[0]) : null; if (b && b.modulo && !b.modulo.pronto) { const m = s.MODULOS[b.def][b.modulo.k === 'b' ? 1 : 0]; const f = Math.max(0, b.modulo.ate - sim.time); ut.textContent = Math.ceil(f) + ' s'; const bar = document.querySelector('#panel [data-unibar] i'); if (bar) bar.style.width = Math.round(100 * (1 - f / m.time)) + '%'; } } }
}
/* eventos da simulação: efeitos das habilidades e do módulo (só visual) */
function eventos(evs, g) { if (!FX_ON || !g || !g.R || !g.R.fx) return; const sim = g.sim; const R = g.R; const lo = R.quality && R.quality.resolved === 'baixa';
  for (const e of evs) { if (e.t !== 'cmd' && e.t !== 'unica') continue; const fac = (sim.players[e.p] || {}).faction; const col = corRaca(fac);
    if (e.t === 'cmd' && e.ev === 'habilidade') { const r = e.r || 60; R.fx.rings.push({ x: e.x, y: e.y, r0: 6, r1: r || 60, col, t: 0, life: 0.9 * VIDA, ping: e.p === g.human }); R.fx.rings.push({ x: e.x, y: e.y, r0: (r || 60) * 0.9, r1: (r || 60), col, t: 0, life: 1.8 * VIDA }); if (e.alvo == null && e.r && (e.x !== e.ux)) R.fx.rings.push({ x: e.x, y: e.y, r0: e.r * 0.3, r1: e.r * 0.75, col: '#FFFFFF', t: 0, life: 0.6 * VIDA });
      if (!lo && R.flash) R.flash(e.x, e.y, Math.max(40, r * 1.2), [1.2, 1.1, 1.3], 1.6, 0.35); }
    else if (e.t === 'cmd' && (e.ev === 'nivel' || e.ev === 'volta')) R.fx.rings.push({ x: e.x, y: e.y, r0: 10, r1: 90, col, t: 0, life: 1.2 * VIDA, ping: e.p === g.human });
    else if (e.t === 'cmd' && e.ev === 'cai') R.fx.rings.push({ x: e.x, y: e.y, r0: 80, r1: 8, col: '#FF5E3A', t: 0, life: 1.0 * VIDA });
    else if (e.t === 'unica' && (e.ev === 'mina' || e.ev === 'isca')) { R.fx.rings.push({ x: e.x, y: e.y, r0: 8, r1: e.r || 90, col: e.ev === 'isca' ? '#E05CFF' : '#FFB070', t: 0, life: 0.6 * VIDA }); if (!lo && R.flash) R.flash(e.x, e.y, (e.r || 90) * 1.2, [1.4, 0.8, 1.4], 1.4, 0.3); }
    else if (e.t === 'unica' && (e.ev === 'modulo-pronto' || e.ev === 'cresce')) R.fx.rings.push({ x: e.x, y: e.y, r0: 10, r1: 70, col: '#7FE3A1', t: 0, life: 0.9 * VIDA }); } }

ARD.unicasUI = { montar, bloco, modoSala, linha, cfgJogar, cfgSala, cfgUrl, defs, trava, chave, painel, liga, quadro, eventos, mira, tecla, get mirando() { return V.mira; } };
if (typeof document !== 'undefined') { const go = () => { try { montar(); } catch (e) { console.warn('[ARD] únicas (tela inicial):', e); } }; if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else setTimeout(go, 0); window.addEventListener('ard-idioma', go); }
})(globalThis.ARD = globalThis.ARD || {});
