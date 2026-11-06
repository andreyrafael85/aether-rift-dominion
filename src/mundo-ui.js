/* Aether Rift: Dominion — 5.0h (agente h-mundo): o mundo neutro na tela. Só lê a simulação (src/mundo.js: sim.mundo, sim.mundoSt,
   e.ruina, e.acampamento, e.fauna, e.merc, sim.surtos e os eventos 'mundo') e manda comandos pela fila (capturar, portal, contratar).
   - Tela inicial: o bloco "Mundo vivo" com as quatro opções (Fauna, Ruínas, Corsários, Surto) na Escaramuça e na sala do multiplayer,
     ao lado dos Eventos da Fenda e dos mutadores (src/modos-ui.js chama bloco/cfg/linha/etiqueta); preferência guardada no aparelho.
   - Partida: modelos na carga (jobs, só com o mundo ligado), o modelo e o dono do desenho (mercenário = Pirata da Raça de quem contratou;
     ruína capturada = desenhada na cor do dono), efeitos do surto, da captura e do portal (faíscas e o mapa de clarões: nenhum pipeline
     novo; na Baixa só a luz no chão), o contorno do surto e a barra de captura na camada 2D de cima, ícones no radar (3D e 2D), o desenho
     no modo 2D, o painel da seleção (ruína, Acampamento com os mercenários, fauna), a ordem do botão direito e a dica da primeira vez.
   Chaves de URL: ?mundo=1 (tudo) ou ?mundo=fauna,ruinas,corsarios,surto; ?mundofx=0 (sem faíscas nem luz do mundo neutro: só o contorno
   e os ícones); ?mundodica=1 (mostra a dica da primeira vez de novo). Textos pelas chaves mundo.* dos três dicionários. */
(function (ARD) {
'use strict';
const T = (k, v, r) => (ARD.t ? ARD.t(k, v, r) : (r != null ? String(r).replace(/\{(\w+)\}/g, (m, n) => (v && v[n] != null ? v[n] : m)) : k));
const $ = id => (typeof document !== 'undefined' ? document.getElementById(id) : null);
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const S = () => ARD.sim, MU = () => ARD.mundo;
const Q = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
const FX_ON = Q.get('mundofx') !== '0';
const KEY = 'ard-mundo-v1', KEY_DICA = 'ard-mundo-dica';
const OPS = ['fauna', 'ruinas', 'corsarios', 'surto'];
const TAU = Math.PI * 2;
const U = ARD.mundoUI = { versao: '5.0h' };

/* ---------- textos ---------- */
const PT = {
  titulo: 'Mundo vivo', sub: 'neutros no mapa, para todos', fauna: 'Fauna da Fenda', 'fauna-d': 'herbívoros que fogem, Guardiões dos nós ricos e enxames à noite',
  ruinas: 'Ruínas dos Construtores', 'ruinas-d': 'capture com infantaria: Observatório, Forja Antiga, Portal e Torre de Éter',
  corsarios: 'Irmandade Corsária', 'corsarios-d': 'Acampamento no centro com 3 mercenários pagos em Dados', surto: 'Surto de éter', 'surto-d': 'renda dobrada numa zona, anunciada antes, e chuva de meteoros',
};
const nomeOp = k => T('mundo.op.' + k, null, PT[k]); const descOp = k => T('mundo.op.' + k + '-d', null, PT[k + '-d']);
const nomeRuina = tipo => T('bld.' + MU().RUINAS[tipo].def + '.nome', null, MU().DEFS_B[MU().RUINAS[tipo].def].name);
const bonusRuina = tipo => T('mundo.bonus.' + tipo, null, { observatorio: 'Visão larga em volta dele', forja: 'Veículos 20% mais baratos', portal: 'Teleporte até a outra ponta do par', torre: '+40 de energia' }[tipo]);
const nomeMerc = k => T('unit.' + MU().MERCS[k].def + '.nome', null, MU().DEFS_U[MU().MERCS[k].def].name);
const nomeJog = (sim, pid) => { const q = sim.players[pid]; return q ? (ARD.i18n && ARD.i18n.d ? ARD.i18n.d.jogador(q.name) : q.name) : '?'; };

/* ---------- preferências e cfg da partida ---------- */
function prefs() { try { const o = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; return { jogar: o.jogar || {}, sala: o.sala || {} }; } catch (e) { return { jogar: {}, sala: {} }; } }
function guarda(p) { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) {} }
function limpa(o) { const r = {}; let algum = false; for (const k of OPS) { r[k] = !!(o && o[k]); if (r[k]) algum = true; } return algum ? r : null; }
U.cfgJogar = () => { const m = limpa(prefs().jogar); return m ? { mundo: m } : {}; };
U.cfgSala = () => { const m = limpa(prefs().sala); return m ? { mundo: m } : {}; };
U.modoSala = () => limpa(prefs().sala);
/* ?mundo=1 (tudo) ou ?mundo=fauna,ruinas,corsarios,surto */
U.cfgUrl = q => { const v = q && q.get('mundo'); if (!v || v === '0') return {}; if (v === '1' || v === 'tudo') return { mundo: true }; return { mundo: v }; };
/* o bloco da tela inicial (Escaramuça: onde = 'jogar'; sala: onde = 'sala', aoMudar avisa a sala) */
U.bloco = function (id, onde, aoMudar) { const el = $(id); if (!el || !MU()) return; estilo(); const p = prefs(); const sel = p[onde] || {};
  el.className = 'mundo-bloco';
  el.innerHTML = `<div class="mut-tit">${esc(T('mundo.titulo', null, PT.titulo))} <small>· ${esc(T('mundo.sub', null, PT.sub))}</small></div><div class="mundo-chips">${OPS.map(k => `<button type="button" class="mut ${sel[k] ? 'on' : ''}" data-mundo="${k}" aria-pressed="${sel[k] ? 'true' : 'false'}"><b>${esc(nomeOp(k))}</b><small>${esc(descOp(k))}</small></button>`).join('')}</div>`;
  el.querySelectorAll('[data-mundo]').forEach(b => b.addEventListener('click', () => { const k = b.dataset.mundo; const q = prefs(); const s2 = q[onde] = q[onde] || {}; s2[k] = !s2[k]; guarda(q); b.classList.toggle('on', !!s2[k]); b.setAttribute('aria-pressed', s2[k] ? 'true' : 'false'); if (aoMudar) aoMudar(); })); };
/* linha da sala e etiqueta do cartão */
U.linha = m => { m = limpa(m === true ? { fauna: 1, ruinas: 1, corsarios: 1, surto: 1 } : m); if (!m) return ''; return T('mundo.titulo', null, PT.titulo) + ': ' + OPS.filter(k => m[k]).map(nomeOp).join(', '); };
U.etiqueta = cfg => { const r = MU() && MU().resumo(cfg); if (!r) return null; const n = OPS.filter(k => r[k]).length; return { k: 'mundo', t: n === 4 ? T('mundo.titulo', null, PT.titulo) : T('mundo.titulo', null, PT.titulo) + ' · ' + OPS.filter(k => r[k]).map(nomeOp).join(', ') }; };
U.salvo = sim => { const r = MU() && MU().resumo(sim); return r ? ' · Mundo vivo' : ''; };

function estilo() { if (typeof document === 'undefined' || $('mundo-css')) return; const st = document.createElement('style'); st.id = 'mundo-css';
  st.textContent = '.mundo-bloco{margin-top:.5rem}.mundo-bloco .mut-tit small{text-transform:none;letter-spacing:0;font-weight:400;opacity:.8}.mundo-chips{display:grid;grid-template-columns:repeat(2,1fr);gap:4px}'
    + '@media (max-width:520px){.mundo-chips{grid-template-columns:1fr}}body.touch #modos-faixa .t-mundo{display:none}body.touch #mundo-surto{left:8px;transform:none;top:calc(env(safe-area-inset-top,0px) + 344px);max-width:60vw;font-size:.72rem}' /* no celular a faixa cairia sobre os botões do topo: a etiqueta fica só no cartão */
    + '.mcap{height:6px;background:rgba(255,255,255,.12);border-radius:3px;overflow:hidden;margin:.35rem 0 .2rem}.mcap i{display:block;height:100%;background:var(--mc,#4FD6C2)}'
    + '.mmerc{display:grid;grid-template-columns:1fr;gap:4px;margin-top:.35rem}.mmerc .act{display:flex;justify-content:space-between;gap:.5rem;width:100%;text-align:left}.mmerc .act small{opacity:.85}'
    + '#mundo-dica{position:absolute;left:50%;transform:translateX(-50%);top:calc(env(safe-area-inset-top,0px) + 92px);z-index:40;width:min(520px,calc(100vw - 24px));box-sizing:border-box;background:rgba(10,14,20,.92);border:1px solid rgba(200,178,122,.55);border-radius:10px;padding:.65rem .8rem;color:#E8E2D6;font:400 .86rem/1.35 var(--fs,system-ui);box-shadow:0 6px 24px rgba(0,0,0,.45)}'
    + '#mundo-dica b{color:#F2D68A}#mundo-dica ul{margin:.35rem 0 .45rem 1rem;padding:0}#mundo-dica li{margin:.12rem 0}#mundo-dica button{float:right;margin-top:.1rem}'
    + '#mundo-surto{position:absolute;left:50%;transform:translateX(-50%);top:calc(env(safe-area-inset-top,0px) + 158px);z-index:30;pointer-events:none;background:rgba(10,14,20,.8);border:1px solid rgba(79,214,194,.6);border-radius:14px;padding:.2rem .7rem;color:#BFFFF4;font:600 .8rem/1.3 var(--fm,ui-monospace,monospace)}';
  document.head.appendChild(st); }

/* ---------- carga: modelos só com o mundo ligado (o render3d chama no R.prepare) ---------- */
U.jobs = function (sim, jobs, lod) { const M = sim && sim.mundoSt; if (!M) return; const m = sim.mundo; const reais = sim.players.filter(p => !p.fenda).map(p => p.id);
  const add = (d, pid) => { jobs.push([d, pid, 0]); if (lod) jobs.push([d, pid, 0, true]); };
  const tipos = new Set(); for (const id of M.ruinas) { const e = sim.byId.get(id); if (e) tipos.add(e.def); }
  for (const d of tipos) { add(d, m); for (const p of reais) add(d, p); } /* livre (no neutro) e capturada (na cor de cada dono) */
  if (M.acamp) add('acampamento', m);
  if (M.cfg.fauna) for (const d of ['fauna_pastador', 'fauna_guardiao', 'fauna_enxame']) add(d, m); };
/* o que o render desenha: mercenário = o Pirata da Raça de quem contratou; ruína capturada = no dono (material e cor do time) */
U.modelo = e => (e.merc ? 'pirata' : null);
U.dono = e => (e.ruina && e.ruina.dono >= 0 ? e.ruina.dono : e.owner);

/* ---------- 3D: surto, captura e portal (faíscas e luz no chão; nenhum pipeline novo) ---------- */
const hexRgb = h => { const n = parseInt(String(h).slice(1), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
let acc = 0, accL = 0;
U.quadro3d = function (R, sim, view, dt) { const M = sim && sim.mundoSt; if (!M || !FX_ON || !R) return; const api = R.chefeAPI || {}; const FX = api.FX, H = api.H;
  const q = (R.quality && R.quality.particles) || 0.5, baixa = !!(R.quality && R.quality.resolved === 'baixa'); acc += dt; accL += dt; const t = sim.time;
  if (accL >= 0.3) { accL = 0; /* luz no chão (mapa de clarões): surto, ruínas capturadas e captura em andamento */
    if (sim.surtos) for (const z of sim.surtos) { if (t >= z.t0) R.flash(z.x, z.y, z.r * 0.9, [0.35, 1.25, 1.1], 0.55, 0.45, 1); else R.flash(z.x, z.y, z.r * 0.6, [0.3, 0.9, 0.85], 0.25 + 0.2 * Math.sin(t * 4), 0.45, 1); }
    for (const id of M.ruinas) { const e = sim.byId.get(id); if (!e) continue; const Rr = e.ruina; if (Rr.dono >= 0) { const c = hexRgb(sim.players[Rr.dono].color); R.flash(e.x, e.y, e.r * 2.2, [c[0] * 1.4, c[1] * 1.4, c[2] * 1.4], 0.5, 0.45, 1); } else if (Rr.capP >= 0 && Rr.capT > 0) { const c = hexRgb(sim.players[Rr.capP].color); R.flash(e.x, e.y, e.r * 2.0, [c[0], c[1], c[2]], 0.25 + 0.5 * Rr.capT / MU().CAP.t, 0.45, 1); } } }
  if (baixa || !FX || !H || acc < 0.08) return; acc = 0;
  if (sim.surtos) for (const z of sim.surtos) { const on = t >= z.t0; const n = Math.round((on ? 3 : 1) * q); for (let i = 0; i < n; i++) { const a = Math.random() * TAU, rr = on ? Math.sqrt(Math.random()) * z.r : z.r * (0.96 + Math.random() * 0.04); const x = z.x + Math.cos(a) * rr, y = z.y + Math.sin(a) * rr; FX.spark(x, H(x, y) + 2, -y, on ? [0.8, 2.2, 2.0] : [0.5, 1.4, 1.3], on ? 26 : 12, 1); } }
  for (const id of M.ruinas) { const e = sim.byId.get(id); if (!e) continue; const Rr = e.ruina; if (Rr.dono === Rr.capP || Rr.capP < 0 || Rr.capT <= 0 || Rr.disputa) continue; const c = hexRgb(sim.players[Rr.capP].color); const a = t * 3 + id; const x = e.x + Math.cos(a) * (e.r + 30), y = e.y + Math.sin(a) * (e.r + 30); FX.spark(x, H(x, y) + 3, -y, [c[0] * 2, c[1] * 2, c[2] * 2], 18, 1); } };
U.efeito = function (R, e) { if (!R || !FX_ON || !e || e.t !== 'mundo') return; const api = R.chefeAPI || {}, FX = api.FX, H = api.H;
  if (e.ev === 'portal') { for (const [x, y] of [[e.x, e.y], [e.x2, e.y2]]) { R.flash(x, y, 70, [0.5, 1.6, 1.5], 1.4, 0.5); if (FX && H && !(R.quality && R.quality.resolved === 'baixa')) for (let i = 0; i < 8; i++) FX.spark(x, H(x, y) + 6, -y, [0.8, 2.4, 2.2], 40, 1); } }
  else if (e.ev === 'captura') R.flash(e.x, e.y, 140, [1.6, 1.4, 0.8], 1.6, 0.8);
  else if (e.ev === 'contrato') R.flash(e.x, e.y, 60, [1.8, 1.1, 0.5], 1.2, 0.5); };

/* ---------- camada 2D de cima (render3d.drawOverlay): contorno do surto e a barra de captura ---------- */
U.overlay = function (c, sim, view, R, z) { const M = sim && sim.mundoSt; if (!M) return; const cam = view.cam; const t = sim.time;
  if (sim.surtos) for (const s of sim.surtos) { const on = t >= s.t0; c.save(); c.setLineDash(on ? [] : [8, 7]); c.lineWidth = on ? 2.5 : 2; c.strokeStyle = on ? 'rgba(110,255,230,0.85)' : 'rgba(110,255,230,' + (0.45 + 0.3 * Math.sin(t * 5)) + ')'; c.beginPath();
    const pc = R.worldToScreen(cam, s.x, s.y, 4); const fora = pc[0] < -R.w || pc[0] > 2 * R.w || pc[1] < -R.h || pc[1] > 2 * R.h; /* longe da tela: nem projeta o contorno */
    let first = true, vis = false; if (!fora) for (let k = 0; k <= 20; k++) { const a = k / 20 * TAU; const p = R.worldToScreen(cam, s.x + Math.cos(a) * s.r, s.y + Math.sin(a) * s.r, 1); if (p[0] > -50 && p[0] < R.w + 50 && p[1] > -50 && p[1] < R.h + 50) vis = true; if (first) { c.moveTo(p[0], p[1]); first = false; } else c.lineTo(p[0], p[1]); }
    if (vis) { c.stroke(); const p = pc; c.setLineDash([]); c.font = '600 12px IBM Plex Mono, ui-monospace, monospace'; c.textAlign = 'center'; c.fillStyle = 'rgba(8,12,16,0.75)'; const txt = on ? T('mundo.surto.ativo', { s: Math.ceil(s.t1 - t) }, 'Surto ×2 · {s} s') : T('mundo.surto.em', { s: Math.ceil(s.t0 - t) }, 'Surto em {s} s'); const w = txt.length * 7.3 + 12; /* largura pela fonte mono, sem medir a cada quadro */ c.fillRect(p[0] - w / 2, p[1] - 10, w, 18); c.fillStyle = '#BFFFF4'; c.fillText(txt, p[0], p[1] + 3); }
    c.restore(); }
  for (const id of M.ruinas) { const e = sim.byId.get(id); if (!e) continue; const Rr = e.ruina; const sel = view.sel && view.sel.has(e.id); if (!(Rr.capT > 0 && Rr.capT < MU().CAP.t - 1e-6) && !Rr.disputa && !sel) continue;
    const p = R.worldToScreen(cam, e.x, e.y, e.r * 2.6); if (p[0] < -40 || p[0] > R.w + 40 || p[1] < -40 || p[1] > R.h + 40) continue; const w = Math.max(36, e.r * 1.8 * z); const f = Math.max(0, Math.min(1, Rr.capT / MU().CAP.t));
    const quem = Rr.capP >= 0 ? Rr.capP : Rr.dono; const col = quem >= 0 && sim.players[quem] ? sim.players[quem].color : '#4FD6C2';
    c.fillStyle = 'rgba(0,0,0,0.7)'; c.fillRect(p[0] - w / 2 - 1, p[1] - 1, w + 2, 6); c.fillStyle = Rr.disputa ? '#F2C230' : col; c.fillRect(p[0] - w / 2, p[1], w * f, 4);
    if (Rr.disputa) { c.font = '600 11px IBM Plex Mono, ui-monospace, monospace'; c.textAlign = 'center'; c.fillStyle = '#F2C230'; c.fillText(T('mundo.cap.disputa', null, 'Em disputa'), p[0], p[1] - 5); } } };

/* ---------- radar (3D e 2D): ruínas, Acampamento, surto e a fauna à vista ---------- */
U.mini = function (c, sim, view, M2W, px, human) { const M = sim && sim.mundoSt; if (!M) return; const vis = view.reveal ? null : sim.vis[human]; const t = sim.time;
  if (sim.surtos) for (const s of sim.surtos) { const p = M2W(s.x, s.y), q2 = M2W(s.x + s.r, s.y); const rr = Math.max(px * 3, Math.hypot(q2[0] - p[0], q2[1] - p[1])); c.save(); c.setLineDash(t >= s.t0 ? [] : [px * 1.5, px * 1.5]); c.strokeStyle = 'rgba(110,255,230,0.9)'; c.lineWidth = Math.max(1.5, px * 0.8); c.beginPath(); c.arc(p[0], p[1], rr, 0, TAU); c.stroke(); c.restore(); }
  for (const id of M.ruinas) { const e = sim.byId.get(id); if (!e) continue; const Rr = e.ruina; const p = M2W(e.x, e.y); const s = px * 2.6; const col = Rr.dono >= 0 && sim.players[Rr.dono] ? sim.players[Rr.dono].color : '#C8B27A';
    c.beginPath(); c.moveTo(p[0], p[1] - s); c.lineTo(p[0] + s, p[1]); c.lineTo(p[0], p[1] + s); c.lineTo(p[0] - s, p[1]); c.closePath(); c.fillStyle = col; c.fill(); c.lineWidth = Math.max(1, px * 0.6); c.strokeStyle = Rr.dono >= 0 ? '#FFFFFF' : 'rgba(0,0,0,0.8)'; c.stroke();
    if (Rr.capT > 0 && Rr.capT < MU().CAP.t - 1e-6) { const q = Rr.capP >= 0 && sim.players[Rr.capP] ? sim.players[Rr.capP].color : '#4FD6C2'; c.strokeStyle = Rr.disputa ? '#F2C230' : q; c.lineWidth = Math.max(1.5, px * 0.8); c.beginPath(); c.arc(p[0], p[1], s + px * 1.6, -Math.PI / 2, -Math.PI / 2 + TAU * Rr.capT / MU().CAP.t); c.stroke(); } }
  if (M.acamp) { const e = sim.byId.get(M.acamp); if (e) { const p = M2W(e.x, e.y); const s = px * 2.4; c.fillStyle = '#FFC24A'; c.strokeStyle = 'rgba(0,0,0,0.85)'; c.lineWidth = 1; c.beginPath(); c.arc(p[0], p[1] - s * 0.3, s * 0.55, 0, TAU); c.fill(); c.stroke(); c.fillRect(p[0] - s * 0.18, p[1] - s * 0.3, s * 0.36, s * 1.2); c.beginPath(); c.arc(p[0], p[1] + s * 0.4, s * 0.8, 0.2, Math.PI - 0.2); c.strokeStyle = '#FFC24A'; c.lineWidth = Math.max(1.5, px * 0.6); c.stroke(); } }
  for (const e of sim.ents) { if (!e.alive || !e.fauna || (vis && !vis.has(e.id))) continue; const p = M2W(e.x, e.y); c.fillStyle = e.fauna.hostil ? '#FF8A3A' : '#B9C79A'; c.beginPath(); c.arc(p[0], p[1], px * (e.fauna.tipo === 'guardiao' ? 1.5 : 0.9), 0, TAU); c.fill(); } };

/* ---------- 2D (src/render.js): ruínas, Acampamento e fauna desenhados aqui (sem modelo voxel) ---------- */
U.ent2d = function (c, e, alpha, P, k, view, R, hpBar, sim) { if (!sim || e.owner !== sim.mundo) return false;
  const g = P(e.x, e.y, 0); const z = k / (ARD.render && ARD.render.K || 1); const own = e.ruina && e.ruina.dono >= 0 ? sim.players[e.ruina.dono] : null;
  const elli = (x, y, rx, ry) => { c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); };
  if (e.ruina || e.acampamento) { const r = e.r * k; c.fillStyle = 'rgba(0,0,0,0.35)'; elli(g[0] + r * 0.2, g[1] + 2, r * 1.1, r * 0.55); c.fill();
    if (e.acampamento) { const y = g[1] - r * 2.2; c.strokeStyle = 'rgba(60,64,72,0.8)'; c.lineWidth = 1; for (const s of [-1, 1]) { c.beginPath(); c.moveTo(g[0] + s * r, g[1]); c.lineTo(g[0] + s * r * 0.4, y + r * 0.3); c.stroke(); }
      c.fillStyle = '#C9B48A'; elli(g[0], y - r * 0.7, r * 1.0, r * 0.45); c.fill(); c.fillStyle = '#6B4A2E'; c.beginPath(); c.moveTo(g[0] - r * 1.1, y); c.lineTo(g[0] + r * 1.1, y); c.lineTo(g[0] + r * 0.7, y + r * 0.45); c.lineTo(g[0] - r * 0.7, y + r * 0.45); c.closePath(); c.fill(); c.fillStyle = '#8C2F2A'; c.fillRect(g[0] - r * 0.05, y - r * 0.4, r * 0.1, r * 0.4); c.fillStyle = '#FFC24A'; for (const x of [-0.6, 0, 0.6]) { elli(g[0] + x * r, y + r * 0.2, 2, 2); c.fill(); } }
    else { const tipo = e.ruina.tipo; const col = own ? own.color : '#4FD6C2'; c.fillStyle = '#5E574B'; elli(g[0], g[1], r, r * 0.5); c.fill(); c.fillStyle = '#B9AE98'; elli(g[0], g[1] - r * 0.18, r * 0.85, r * 0.42); c.fill();
      const h = tipo === 'torre' ? r * 2.6 : tipo === 'observatorio' ? r * 2.2 : r * 1.6; c.fillStyle = '#8E8471';
      if (tipo === 'portal') { c.strokeStyle = '#B9AE98'; c.lineWidth = Math.max(3, r * 0.25); elli(g[0], g[1] - r * 1.1, r * 0.5, r * 0.85); c.stroke(); c.fillStyle = own ? col : 'rgba(79,214,194,0.35)'; c.globalAlpha = 0.6; c.fill(); c.globalAlpha = 1; }
      else { c.fillRect(g[0] - r * 0.28, g[1] - h, r * 0.56, h); c.fillStyle = col; c.globalAlpha = own ? 1 : 0.55; c.fillRect(g[0] - r * 0.06, g[1] - h * 0.9, r * 0.12, h * 0.7); elli(g[0], g[1] - h - r * 0.2, r * 0.3, r * 0.3); c.fill(); c.globalAlpha = 1; } }
    if (view.sel && view.sel.has(e.id)) { c.strokeStyle = 'rgba(255,255,255,0.9)'; c.lineWidth = 1.5; elli(g[0], g[1], (e.r + 6) * k, (e.r + 6) * k * 0.5); c.stroke(); }
    if (e.ruina && e.ruina.capT > 0 && e.ruina.capT < MU().CAP.t - 1e-6) { const q = e.ruina.capP >= 0 ? sim.players[e.ruina.capP].color : '#4FD6C2'; c.strokeStyle = e.ruina.disputa ? '#F2C230' : q; c.lineWidth = 3; c.beginPath(); c.ellipse(g[0], g[1], (e.r + 8) * k, (e.r + 8) * k * 0.5, 0, -Math.PI / 2, -Math.PI / 2 + TAU * e.ruina.capT / MU().CAP.t); c.stroke(); }
    return true; }
  if (e.fauna) { const vis = sim.vis[view.human]; if (!view.reveal && vis && !vis.has(e.id)) return true; const wx = e.px + (e.x - e.px) * alpha, wy = e.py + (e.y - e.py) * alpha; const p = P(wx, wy, e.fauna.tipo === 'enxame' ? 14 : 0); const r = e.r * k;
    c.fillStyle = 'rgba(0,0,0,0.3)'; const g2 = P(wx, wy, 0); elli(g2[0], g2[1] + 1, r * 0.9, r * 0.45); c.fill();
    if (e.fauna.tipo === 'enxame') { c.fillStyle = '#9A7CFF'; for (const [dx, dy] of [[0, 0], [-r * 0.8, -r * 0.5], [r * 0.7, -r * 0.9]]) { elli(p[0] + dx, p[1] + dy - r, r * 0.7, r * 0.35 * (1 + 0.5 * Math.sin(R.time * 20 + dx))); c.fill(); } c.fillStyle = '#E6DBFF'; elli(p[0], p[1] - r, r * 0.25, r * 0.25); c.fill(); }
    else { const big = e.fauna.tipo === 'guardiao'; c.fillStyle = big ? '#3E3A44' : '#7C8A6A'; elli(p[0], p[1] - r * 0.7, r * 1.05, r * 0.6); c.fill(); c.fillStyle = big ? '#5CF0E0' : '#7FE8FF'; for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(p[0] - r * 0.5 + i * r * 0.5, p[1] - r * 1.1); c.lineTo(p[0] - r * 0.35 + i * r * 0.5, p[1] - r * (big ? 1.9 : 1.5)); c.lineTo(p[0] - r * 0.2 + i * r * 0.5, p[1] - r * 1.1); c.fill(); } }
    if (e.hp < e.maxHp - 0.5 || (view.sel && view.sel.has(e.id))) hpBar(c, p[0], p[1] - r * 2.2 - 6, Math.max(14, e.r * 2 * k), e.hp / e.maxHp);
    return true; }
  return false; };

/* ---------- painel da seleção (src/main.js) ---------- */
U.chave = (ents, sim, human) => { const M = sim && sim.mundoSt; if (!M) return ''; let s = '';
  for (const e of ents) { if (e.ruina) s += 'r' + e.ruina.dono + (e.ruina.disputa ? 'd' : '') + (e.ruina.capP >= 0 ? 'c' + e.ruina.capP : '') + Math.floor(e.ruina.capT / MU().CAP.t * 20);
    else if (e.acampamento) { const k = M.contratos[human]; s += 'a' + Math.max(0, Math.ceil(((k && k.cd) || 0) - sim.time)) + ':' + Math.floor(sim.players[human].res.dados / 20); } }
  return s; };
U.painel = function (e, sim, human, R) { const M = sim.mundoSt; if (!M) return null; const icon = (d, p) => { try { return R.icon(d, p); } catch (er) { return ''; } };
  if (e.ruina) { const Rr = e.ruina, tipo = Rr.tipo, CAPT = MU().CAP.t; const dono = Rr.dono, cor = dono >= 0 ? sim.players[dono].color : '#C8B27A';
    const est = dono >= 0 ? T(dono === human ? 'mundo.r.sua' : 'mundo.r.de', { nome: nomeJog(sim, dono) }, dono === human ? 'Sua' : 'De {nome}') : T('mundo.r.livre', null, 'Livre');
    let st = ''; if (Rr.disputa) st = T('mundo.cap.disputa', null, 'Em disputa'); else if (Rr.capP >= 0 && Rr.capP !== dono && Rr.capT > 0) st = T(dono >= 0 ? 'mundo.cap.tomando' : 'mundo.cap.capturando', { nome: nomeJog(sim, Rr.capP), n: Math.round(100 * Rr.capT / CAPT) }, (dono >= 0 ? 'Tomando: {nome} ' : 'Capturando: {nome} ') + '{n}%');
    let h = `<div class="sel-head"><img class="ph-ico" alt="" src="${icon(e.def, dono >= 0 ? dono : e.owner)}"><b>${esc(nomeRuina(tipo))}</b><span class="sh-c"><span class="dot" style="background:${cor}"></span>${esc(T('mundo.r.ruina', null, 'Ruína dos Construtores'))} · ${esc(est)}</span></div>`;
    h += `<div class="muted">${esc(bonusRuina(tipo))}</div>`;
    if (st || (Rr.capT > 0 && Rr.capT < CAPT)) h += `<div class="mcap" style="--mc:${Rr.disputa ? '#F2C230' : (Rr.capP >= 0 ? sim.players[Rr.capP].color : cor)}"><i style="width:${Math.round(100 * Rr.capT / CAPT)}%"></i></div><div class="small muted">${esc(st)}</div>`;
    h += `<div class="tip">${esc(tipo === 'portal' && dono === human ? T('mundo.dica.portal', null, 'Selecione unidades e clique com o botão direito neste Portal: elas saem na outra ponta do par.') : dono === human ? T('mundo.dica.manter', null, 'Mantenha a ruína: infantaria inimiga parada ao lado dela tira o bônus de você.') : T('mundo.dica.capturar', null, 'Pare Infantaria ao lado da ruína para capturá-la (20 s com uma; mais rápido com mais). Botão direito com unidades selecionadas leva todas até ela.'))}</div>`;
    return h; }
  if (e.acampamento) { const k = M.contratos[human] || { cd: 0 }; const p = sim.players[human]; let vivos = 0, perto = false; const C = MU().CONTRATO;
    for (const o of sim.ents) { if (!o.alive || o.owner !== human) continue; if (o.merc) vivos++; if ((o.kind === 'unit' || o.kind === 'building') && S().dist(o.x, o.y, e.x, e.y) <= C.raio) perto = true; }
    const cd = Math.max(0, Math.ceil(k.cd - sim.time));
    let h = `<div class="sel-head"><img class="ph-ico" alt="" src="${icon('acampamento', e.owner)}"><b>${esc(T('bld.acampamento.nome', null, 'Acampamento da Irmandade Corsária'))}</b><span class="sh-c"><span class="dot" style="background:#FFC24A"></span>${esc(T('mundo.a.sub', { n: vivos, max: C.max }, 'Mercenários: {n}/{max}'))}</span></div>`;
    const motivo = !perto ? T('mundo.a.longe', null, 'Leve uma unidade sua até perto do Acampamento (600) para contratar.') : cd > 0 ? T('mundo.a.recarga', { s: cd }, 'Próxima contratação em {s} s') : vivos >= C.max ? T('mundo.a.limite', { max: C.max }, 'Limite de {max} mercenários ao mesmo tempo') : '';
    h += `<div class="muted small">${esc(T('mundo.a.desc', { min: Math.round(C.dura / 60) }, 'Cada mercenário serve por {min} min. Pagos em Dados.'))}</div><div class="mmerc">`;
    for (const id of MU().MERC_IDS) { const m = MU().MERCS[id]; const pode = !motivo && p.res.dados >= m.custo.dados; h += `<button type="button" class="act sm" data-merc="${id}" ${pode ? '' : 'disabled'}><span><b>${esc(nomeMerc(id))}</b><br><small>${esc(T('unit.' + m.def + '.desc', null, MU().DEFS_U[m.def].desc))}</small></span><span class="cost">${m.custo.dados} ${esc(T('res.dados', null, 'Dados'))}</span></button>`; }
    h += `</div>${motivo ? `<div class="tip">${esc(motivo)}</div>` : ''}`; return h; }
  if (e.fauna) { const d = S().UNITS[e.def]; return `<div class="sel-head"><img class="ph-ico foe" alt="" src="${icon(e.def, e.owner)}"><b>${esc(T('unit.' + e.def + '.nome', null, d.name))}</b><span class="sh-c"><span class="dot" style="background:${e.fauna.hostil ? '#FF8A3A' : '#B9C79A'}"></span>${esc(T('mundo.f.sub', null, 'Fauna da Fenda'))} · ${esc(T(e.fauna.hostil ? 'mundo.f.hostil' : 'mundo.f.mansa', null, e.fauna.hostil ? 'hostil' : 'mansa'))}</span><div class="hp foe" data-live="${e.id}"><i style="width:${(100 * e.hp / e.maxHp)}%"></i></div></div><div class="muted small">${esc(T('unit.' + e.def + '.desc', null, d.desc))}</div>`; }
  return null; };
U.liga = function (panel, G) { if (!panel || !G) return; panel.querySelectorAll('[data-merc]').forEach(b => b.addEventListener('click', () => { const sel = [...G.view.sel].map(id => G.sim.byId.get(id)).find(x => x && x.acampamento); if (!sel) return; envia(G, { t: 'contratar', id: sel.id, merc: b.dataset.merc }); try { ARD.audio && ARD.audio.sfx && ARD.audio.sfx('click'); } catch (er) {} })); };
function envia(G, c) { c.p = G.human; if (G.net) G.pending.push(c); else S().enqueue(G.sim, c); }

/* ---------- botão direito sobre o mundo neutro (src/input.js): ruína = capturar (ou atravessar o Portal seu); Acampamento = ir até perto ---------- */
U.ordem = function (t, units, cmd, view, R, sim, human) { if (!t || !sim || t.owner !== sim.mundo) return false; const ids = units.map(u => u.id);
  if (t.ruina) { if (t.ruina.tipo === 'portal' && t.ruina.dono === human) cmd({ t: 'portal', ids, id: t.id }); else cmd({ t: 'capturar', ids, id: t.id }); view.marker = { x: t.x, y: t.y, t: R.time, col: '#4FD6C2' }; return true; }
  if (t.acampamento) { const n = S().nucleoOf(sim, human); const a = n ? Math.atan2(n.y - t.y, n.x - t.x) : 0; const r = S().RIFT_R + 140; cmd({ t: 'move', ids, x: t.x + Math.cos(a) * r, y: t.y + Math.sin(a) * r }); view.marker = { x: t.x, y: t.y, t: R.time, col: '#FFC24A' }; return true; }
  return false; };

/* ---------- eventos e quadro da partida (src/main.js) ---------- */
let G0 = null, dicaFeita = false, surtoEl = null;
U.eventos = function (ev, G) { if (!ev || !ev.length || !G || !G.sim || !G.sim.mundoSt) return; G0 = G; const R = G.R;
  for (const e of ev) { if (e.t !== 'mundo') continue; U.efeito(R, e);
    try { const sfx = ARD.audio && ARD.audio.sfx; if (!sfx) continue;
      if (e.ev === 'captura') sfx(e.p === G.human ? 'promote' : 'alert'); else if (e.ev === 'perde' && e.p === G.human) sfx('danger'); else if (e.ev === 'contrato' && e.p === G.human) sfx('promote');
      else if (e.ev === 'surto' && e.fase === 'aviso') sfx('alert'); else if (e.ev === 'fauna' && e.tipo === 'enxame' && e.fase === 'chega') sfx('alert'); } catch (er) {} } };
U.quadro = function (now, dt, G) { if (!G || !G.sim) return; const sim = G.sim; const M = sim.mundoSt; if (!M) { if (surtoEl) surtoEl.hidden = true; return; } G0 = G;
  if (!dicaFeita && !G.ended && sim.time > 4) { dicaFeita = true; estilo(); dica(M); }
  /* o surto em contagem na tela (anunciado antes) */
  const z = sim.surtos && sim.surtos[0]; if (z && !G.ended) { if (!surtoEl) { estilo(); surtoEl = document.createElement('div'); surtoEl.id = 'mundo-surto'; surtoEl.setAttribute('role', 'status'); const g = $('game'); (g || document.body).appendChild(surtoEl); }
    const on = sim.time >= z.t0; const txt = on ? T('mundo.surto.ativo-l', { s: Math.ceil(z.t1 - sim.time) }, 'Surto de éter: renda ×2 na zona · {s} s') : T('mundo.surto.em-l', { s: Math.ceil(z.t0 - sim.time) }, 'Surto de éter em {s} s'); if (surtoEl.textContent !== txt) surtoEl.textContent = txt; surtoEl.hidden = false; }
  else if (surtoEl) surtoEl.hidden = true; };
function dica(M) { let vista = false; try { vista = localStorage.getItem(KEY_DICA) === '1'; } catch (e) {} if (vista && Q.get('mundodica') !== '1') return; estilo();
  const c = M.cfg; const L = [];
  if (c.ruinas) L.push(T('mundo.dica.l-ruinas', null, '<b>Ruínas</b>: pare Infantaria ao lado de uma para capturá-la; o bônus vale enquanto você a mantiver.'));
  if (c.corsarios) L.push(T('mundo.dica.l-corsarios', null, '<b>Acampamento Corsário</b> (no centro): com uma unidade perto, selecione a nave e contrate mercenários com Dados.'));
  if (c.fauna) L.push(T('mundo.dica.l-fauna', null, '<b>Fauna</b>: os Pastadores fogem; os Guardiões defendem os nós ricos; à noite, enxames saem dos ninhos perto da Fenda.'));
  if (c.surto) L.push(T('mundo.dica.l-surto', null, '<b>Surto de éter</b>: um círculo no chão avisa 30 s antes; ali a coleta rende o dobro.'));
  const el = document.createElement('div'); el.id = 'mundo-dica'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', T('mundo.titulo', null, PT.titulo));
  el.innerHTML = `<b>${esc(T('mundo.titulo', null, PT.titulo))}</b><ul>${L.map(x => '<li>' + x + '</li>').join('')}</ul><button type="button" class="act sm">${esc(T('mundo.dica.ok', null, 'Entendi'))}</button>`;
  const fecha = () => { el.remove(); try { localStorage.setItem(KEY_DICA, '1'); } catch (e) {} }; el.querySelector('button').addEventListener('click', fecha); setTimeout(() => { if (el.isConnected) fecha(); }, 22000);
  const g = $('game'); (g || document.body).appendChild(el); }
})(globalThis.ARD = globalThis.ARD || {});
