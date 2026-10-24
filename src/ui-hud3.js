/* 5.0b — Interface 3.0 da partida: roda de comandos (toque longo no celular, botão do meio no computador), grupos de controle
   no toque, central de alertas, visão do exército, tela de pesquisa (Eras, Laboratório, módulos, Ascensão e superarma) e
   acessibilidade (paletas para daltonismo, escala da interface e legendas). O layout deitado e o de tablet ficam no CSS.
   Regras da casa (4.3k/4.3l): o DOM só é escrito quando um valor muda, nada lê layout no laço, animação só de transform e
   opacity, sem backdrop-filter. O main.js chama ARD.hud3.mount() ao começar a partida e h.frame() a cada quadro. */
(function (ARD) {
'use strict';
const S = ARD.sim;
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
const fmt = n => Math.floor(n).toLocaleString('pt-BR');
const mmss = t => { t = Math.max(0, Math.floor(t)); return String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0'); };
const setT = (el, v) => { v = String(v); if (el && el.textContent !== v) el.textContent = v; };
const setH = (el, v) => { v = !!v; if (el && el.hidden !== v) el.hidden = v; };
const setOn = (el, cls, v) => { v = !!v; if (el && el.classList.contains(cls) !== v) el.classList.toggle(cls, v); };
const setW = (el, pct) => { const v = (Math.round(pct * 10) / 10) + '%'; if (el && el.style.width !== v) el.style.width = v; };
const IC = (id, cls) => `<svg class="tbi${cls ? ' ' + cls : ''}" aria-hidden="true"><use href="#${id}"/></svg>`;
const RES3 = ['plasma', 'minerio', 'dados'], RES_NAME = { plasma: 'Plasma', minerio: 'Minério', dados: 'Dados' };
const RES_IC = { plasma: 'ic-plasma', minerio: 'ic-minerio', dados: 'ic-dados' };
const costStr = cost => Object.keys(cost || {}).filter(k => cost[k]).map(k => `<span class="c-${k}"><svg class="ri xs"><use href="#${RES_IC[k]}"/></svg> ${cost[k]}</span>`).join(' ') || '<span class="muted">grátis</span>';
const params = new URLSearchParams(location.search);
const coarse = () => matchMedia('(pointer: coarse)').matches || !!params.get('touch');

// ---------- acessibilidade: preferências (localStorage 'ard-a11y'; ?cvd=deutan&ui=140&legendas=1 valem só na sessão, para fotos e testes) ----------
const CVD = { normal: 'Normal', protan: 'Protanopia', deutan: 'Deuteranopia', tritan: 'Tritanopia' };
const CVD_SUB = { normal: 'cores originais', protan: 'vermelho fraco', deutan: 'verde fraco', tritan: 'azul fraco' };
const A11Y_KEY = 'ard-a11y';
const clampScale = v => Math.max(90, Math.min(140, Math.round((+v || 100) / 5) * 5));
const A = { cvd: 'normal', scale: 100, captions: false, foes: true, rel: false }; /* 5.0a.1: foes = "Destacar inimigos" (ligado por padrão), rel = "Cores relativas" (desligado) */
try { const o = JSON.parse(localStorage.getItem(A11Y_KEY) || '{}') || {}; if (CVD[o.cvd]) A.cvd = o.cvd; if (o.scale) A.scale = clampScale(o.scale); A.captions = !!o.captions; if (o.foes === false) A.foes = false; A.rel = !!o.rel; } catch (e) {}
if (CVD[params.get('cvd')]) A.cvd = params.get('cvd'); if (params.get('ui')) A.scale = clampScale(params.get('ui')); if (params.has('legendas')) A.captions = params.get('legendas') !== '0';
if (params.has('inimigos')) A.foes = params.get('inimigos') !== '0'; if (params.has('relativas')) A.rel = params.get('relativas') !== '0'; /* 5.0a.1: só na sessão (fotos e testes) */
const saveA = () => { try { localStorage.setItem(A11Y_KEY, JSON.stringify(A)); } catch (e) {} };

/* Paletas por tipo de daltonismo (work/cvd-paleta.py): para cada Raça, a cor numa janela de matiz em volta da original (a
   identidade continua) que deixa a MENOR diferença entre as cinco Raças o maior possível para quem tem aquele tipo
   (simulação de Machado 2009, CIEDE2000), clara o bastante para o fundo escuro. Menor diferença entre Raças, antes → depois:
   protanopia 12,4 → 27,6 · deuteranopia 13,2 → 25,1 · tritanopia 6,5 → 25,4; entre recursos: 23,6 → 40,4 · 16,8 → 35,4 · 7,4 → 38,1.
   'reserva': para a mesma Raça repetida (multiplayer). */
const PAL = {
  protan: { racas: { vehnar: '#CC8314', erevane: '#66FFEB', tessara: '#D9FF40', quorith: '#B28CFF', vorag: '#FF4073' }, reserva: ['#00B28F', '#E6A1BC', '#A1E6A1'], res: { plasma: '#FF5500', minerio: '#6685FF', dados: '#B2FFEB' } },
  deutan: { racas: { vehnar: '#FF5500', erevane: '#66FFFF', tessara: '#B2FFC2', quorith: '#9A7EE6', vorag: '#CC708F' }, reserva: ['#FFFF00', '#A1B27D', '#B4CCC2'], res: { plasma: '#FF6640', minerio: '#408CFF', dados: '#B2FFF5' } },
  tritan: { racas: { vehnar: '#FF8040', erevane: '#24B200', tessara: '#D1FFB2', quorith: '#AB8CFF', vorag: '#FFE0B2' }, reserva: ['#A8B212', '#00DDFF', '#B27DAF'], res: { plasma: '#FF4D40', minerio: '#4796B2', dados: '#E8E1CF' } },
};
function mixHex(a, b, k) { const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); const x = p(a), y = p(b); return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * k).toString(16).padStart(2, '0')).join(''); }
let nodeOrig = null;
function applyPalette() { /* recursos na hora: variáveis do HUD, gradientes dos ícones, radar (NODE_COLOR exportado pelo render3d e pelo render 2D) */
  const root = document.documentElement; const P = PAL[A.cvd];
  if (P) root.dataset.cvd = A.cvd; else delete root.dataset.cvd;
  let st = $('h3-cvd'); if (!st) { st = document.createElement('style'); st.id = 'h3-cvd'; document.head.appendChild(st); }
  const g = (id, c) => `#${id} stop:nth-child(1){stop-color:${mixHex(c, '#ffffff', 0.62)}}#${id} stop:nth-child(2){stop-color:${c}}#${id} stop:nth-child(3){stop-color:${mixHex(c, '#000000', 0.55)}}`;
  st.textContent = P ? `:root{--plasma:${P.res.plasma};--minerio:${P.res.minerio};--dados:${P.res.dados}}.rpill.pl{--rc:${P.res.plasma}}.rpill.mi{--rc:${P.res.minerio}}.rpill.da{--rc:${P.res.dados}}` + g('g-pl', P.res.plasma) + g('g-mi', P.res.minerio) + g('g-da', P.res.dados) : '';
  const objs = [ARD.render3d && ARD.render3d.NODE_COLOR, ARD.render && ARD.render.NODE_COLOR].filter(Boolean);
  if (!nodeOrig) nodeOrig = objs.map(o => Object.assign({}, o));
  objs.forEach((o, i) => { for (const k of RES3) o[k] = P ? P.res[k] : nodeOrig[i][k]; });
}
function applyScale() { const r = document.documentElement; r.style.setProperty('--ui', String(A.scale / 100)); r.classList.toggle('h3big', A.scale >= 120); } /* h3big: no celular, grupos em 2 colunas e gaveta um pouco mais baixa */
/* 5.0a.1: cor do inimigo (anel, barra e radar) e as cores relativas (você, aliados, inimigos) por paleta: o vermelho vira o tom que cada tipo de daltonismo distingue */
const FOE_COL = { normal: '#FF3030', protan: '#FF5500', deutan: '#FF6640', tritan: '#FF4D40' };
const REL = { normal: { me: '#3DDC5A', ally: '#3D8BFF', foe: '#FF3B30' }, protan: { me: '#B2FFEB', ally: '#6685FF', foe: '#FF5500' }, deutan: { me: '#B2FFF5', ally: '#408CFF', foe: '#FF6640' }, tritan: { me: '#E8E1CF', ally: '#4796B2', foe: '#FF4D40' } };
const VIEW = { foes: true, foeCol: FOE_COL.normal }; /* lido pelo render3d a cada quadro (sem alocar) */
function applyView() { VIEW.foes = A.foes !== false; VIEW.foeCol = FOE_COL[A.cvd] || FOE_COL.normal; }
function applyAll() { applyPalette(); applyScale(); applyView(); document.documentElement.classList.toggle('h3cap-on', !!A.captions); }
applyAll();
/* cores dos jogadores: valem para a partida inteira (modelos 3D, radar, território e HUD), aplicadas logo depois de criar (ou
   retomar) a simulação e antes do renderizador montar os modelos. A cor é só visual: o hash e o lockstep não a usam. */
function playerColors(sim, me) {
  if (A.rel && me != null && sim.players[me]) { const T = REL[A.cvd] || REL.normal; const cp = (sim.cfg && sim.cfg.players) || []; return sim.players.map((p, i) => i === me ? T.me : (cp[i] && cp[i].ally) || (S.hasPact && !S.isEnemy(sim, me, i)) ? T.ally : T.foe); } /* 5.0a.1: cores relativas — você, aliados (da missão ou em pacto ao começar) e inimigos */
  const P = PAL[A.cvd]; if (!P) return null; const used = new Set(); let r = 0;
  return sim.players.map(p => { let c = P.racas[p.faction]; if (!c || used.has(c)) c = P.reserva[(r++) % P.reserva.length]; used.add(c); return c; }); }
function prepareSim(sim, resume, me) {
  const cols = playerColors(sim, me);
  if (cols) { sim.players.forEach((p, i) => { p.color = cols[i]; }); return; }
  if (resume && S.assignColors && sim.cfg && sim.cfg.players) { try { const o = S.assignColors(sim.cfg.players); sim.players.forEach((p, i) => { if (o[i]) p.color = o[i]; }); } catch (e) {} } /* salvo com paleta e retomado sem ela: volta às cores originais */
}

// ---------- Ajustes de acessibilidade na tela inicial (aba Ajustes): o bloco entra por script, sem mexer no HTML do #start ----------
function a11yHTML(id) {
  const seg = (name, items, cur) => `<div class="seg h3seg" role="radiogroup" data-a11y="${name}">` + items.map(([v, t, s]) => `<button type="button" role="radio" aria-checked="${String(v) === String(cur)}" class="${String(v) === String(cur) ? 'on' : ''}" data-v="${v}">${t}${s ? `<small>${s}</small>` : ''}</button>`).join('') + '</div>';
  return `<div class="opt"><label>Paleta de cores · daltonismo</label>${seg('cvd', Object.keys(CVD).map(k => [k, CVD[k], CVD_SUB[k]]), A.cvd)}<div class="h3sw" data-swatch></div></div>` +
    `<div class="opt"><label for="${id}-scale">Escala da interface na partida · <b data-scale-v>${A.scale}%</b></label><input type="range" id="${id}-scale" class="h3range" min="90" max="140" step="5" value="${A.scale}" aria-describedby="${id}-scale-h"><div class="small muted" id="${id}-scale-h">90% a 140%. Botões de toque nunca ficam menores que 44 px.</div></div>` +
    `<div class="opt"><label class="chk"><input type="checkbox" data-a11y="captions" ${A.captions ? 'checked' : ''}> Legendas das falas (o que a voz do sistema diz aparece em texto, com o retrato do líder)</label></div>` +
    `<div class="opt"><label class="chk"><input type="checkbox" data-a11y="foes" ${A.foes !== false ? 'checked' : ''}> Destacar inimigos (anel vermelho no chão, barra de vida vermelha e marca no radar)</label></div>` +
    `<div class="opt"><label class="chk"><input type="checkbox" data-a11y="rel" ${A.rel ? 'checked' : ''}> Cores relativas: você verde, aliados azuis e inimigos vermelhos (a partir da próxima partida)</label></div>`; /* 5.0a.1 */
}
function swatchHTML() { const P = PAL[A.cvd]; const races = ['vehnar', 'erevane', 'tessara', 'quorith', 'vorag']; const rc = r => P ? P.racas[r] : (S.RACE_SHADES[r] || ['#888'])[0];
  const res = k => P ? P.res[k] : ({ plasma: '#FF8A5C', minerio: '#62CDFF', dados: '#7FE3A1' })[k];
  return '<span class="h3sw-l">Raças</span>' + races.map(r => `<i title="${esc((S.FACTIONS[r] || {}).short || r)}" style="background:${rc(r)}"></i>`).join('') + '<span class="h3sw-l">Recursos</span>' + RES3.map(k => `<i class="r" title="${RES_NAME[k]}" style="background:${res(k)}"></i>`).join(''); }
function bindA11y(box, onChange) {
  const sw = box.querySelector('[data-swatch]'); if (sw) sw.innerHTML = swatchHTML();
  box.querySelectorAll('[data-a11y=cvd] button').forEach(b => b.addEventListener('click', () => { A.cvd = b.dataset.v; saveA(); applyPalette(); box.querySelectorAll('[data-a11y=cvd] button').forEach(x => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-checked', on); }); if (sw) sw.innerHTML = swatchHTML(); if (onChange) onChange('cvd'); }));
  const rg = box.querySelector('.h3range'); if (rg) rg.addEventListener('input', () => { A.scale = clampScale(rg.value); saveA(); applyScale(); const v = box.querySelector('[data-scale-v]'); if (v) v.textContent = A.scale + '%'; if (onChange) onChange('scale'); });
  const cb = box.querySelector('[data-a11y=captions]'); if (cb) cb.addEventListener('change', () => { A.captions = cb.checked; saveA(); applyAll(); if (onChange) onChange('captions'); });
  for (const k of ['foes', 'rel']) { const x = box.querySelector('[data-a11y=' + k + ']'); if (x) x.addEventListener('change', () => { A[k] = x.checked; saveA(); applyAll(); if (onChange) onChange(k); }); } /* 5.0a.1: o destaque muda na hora; as cores relativas, na próxima partida */
}
function mountStartA11y() { const pane = document.querySelector('.cpane[data-pane="ajustes"]'); if (!pane || pane.querySelector('.h3a11y')) return;
  const box = document.createElement('div'); box.className = 'h3a11y'; box.innerHTML = '<div class="chead"><b>Acessibilidade</b><span>Cores, tamanho e legendas da partida</span></div>' + a11yHTML('st'); pane.appendChild(box); bindA11y(box); }
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountStartA11y); else mountStartA11y();

// ---------- legendas: a voz do sistema (src/audio.js chama A.onSay) aparece em texto com o retrato ----------
let capCtx = null;
function caption(text) {
  if (!A.captions || !capCtx) return; const el = $('caption'); if (!el) return; const c = capCtx;
  if (!c.img) { c.img = el.querySelector('img'); c.who = el.querySelector('b'); c.tx = el.querySelector('span'); const art = c.leaderArt && c.leaderArt(c.fac); if (art) c.img.src = art; else c.img.hidden = true; setT(c.who, c.name); }
  setT(c.tx, text); el.hidden = false; el.classList.remove('in1', 'in2'); el.classList.add((c.flip = !c.flip) ? 'in1' : 'in2'); /* duas animações iguais alternadas: reinicia sem ler o layout */
  clearTimeout(c.t); if (!ARD.hud3.capHold) c.t = setTimeout(() => { el.hidden = true; }, Math.min(6500, 2200 + text.length * 70)); /* capHold: fotos na GPU por software */
}
if (ARD.audio) ARD.audio.onSay = text => caption(text);

// ---------- partida ----------
function mount(ctx) {
  const { G, sim, human, view, I, R, ui } = ctx; const notice = ctx.notice || (() => {});
  const me = () => sim.players[human]; const fac = () => S.FACTIONS[me().faction] || S.FACTIONS.vehnar;
  const isTouch = () => !!G.isTouch;
  const tabMQ = matchMedia('(min-width:900px) and (min-height:600px)'); const sheets = () => isTouch() && !tabMQ.matches; /* no celular, exército e alertas abrem como folhas; no tablet ficam na coluna da direita, como no computador */
  const H = { open: null };
  document.body.classList.add('h3');
  capCtx = { fac: me().faction, name: (ctx.LEADER_NAME && ctx.LEADER_NAME[me().faction]) || 'Comando', leaderArt: ctx.leaderArt };
  const ICONS = {}; const icon = def => { if (ICONS[def]) return ICONS[def]; let u = ''; try { u = R.icon(def, human) || ''; } catch (e) {} if (u) ICONS[def] = u; return u; }; /* retratos 3D do render3d (ele já guarda; aqui só para saber na hora quais já existem) */
  const unitName = def => S.unitName(me().faction, def);
  const ownUnits = () => sim.ents.filter(e => e.alive && e.kind === 'unit' && e.owner === human);

  // ====== central de alertas ======
  const AL = { list: [], seq: 0, unread: 0, cur: -1, curT: 0, filter: 'todos' };
  const box = $('alertc'), alist = box && box.querySelector('.alist'), abadge = $('alc-n');
  function classify(e) {
    if (e.t === 'built') return { cat: 'base', icon: 'ic-construir', kind: 'good', agg: 'b:' + e.def, text: 'Construção pronta: ' + ((S.BUILDINGS[e.def] || {}).name || e.def) };
    if (e.t === 'spawn') return { cat: 'base', img: e.def, kind: 'info', agg: 'u:' + e.def, text: 'Unidade pronta: ' + unitName(e.def) };
    const t = String(e.text || ''); const T = t.toUpperCase();
    if (/SIF[ÃA]O|RASTRO|CARNICEIRO|CAIXA DERRUBADA|ROUBO/.test(T)) return { cat: 'ataque', icon: 'ic-pirata', kind: e.kind || 'danger', text: t };
    if (/^VOCÊ QUEBROU|PACTO|NÃO-AGRESS|RECUSOU|CAUÇÃO/.test(T)) return { cat: 'outros', icon: 'ic-diplo', kind: e.kind || 'info', text: t };
    if (/SOB ATAQUE|QUEBROU|ATIVOU|SALTOU|ELIMINADO|BLECAUTE!/.test(T)) return { cat: 'ataque', icon: e.kind === 'danger' ? 'ic-inim' : 'ic-alerta', kind: e.kind || 'danger', text: t };
    if (/ACABOU|ESGOTAD|VEIO DE MIN|CAIXA RECOLHIDA/.test(T)) return { cat: 'eco', icon: /PLASMA/.test(T) ? 'ic-plasma' : 'ic-minerio', kind: e.kind || 'warn', text: t };
    if (/TEMPESTADE/.test(T)) return { cat: 'eco', icon: 'ic-tempestade', kind: e.kind || 'warn', text: t };
    if (/^ERA |EVOLUINDO|PESQUISA|PRONTA:|^ASCENSÃO:|TRAÇO|SOBRECARGA|SALTO DE NÚCLEO/.test(T)) return { cat: 'base', icon: /PESQUISA/.test(T) ? 'ic-tec' : 'ic-era', kind: e.kind || 'good', text: t };
    return { cat: 'outros', icon: 'ic-alerta', kind: e.kind || 'info', text: t };
  }
  function rowHTML(a) { const ico = a.img ? `<img alt="" src="${icon(a.img)}">` : `<svg aria-hidden="true"><use href="#${a.icon}"/></svg>`;
    return `<span class="ai">${ico}</span><span class="at">${mmss(a.t)}</span><span class="am">${esc(a.text)}${a.n > 1 ? ` <b class="an">×${a.n}</b>` : ''}</span>${a.x != null ? '<span class="ago" aria-hidden="true">›</span>' : ''}`; }
  function addAlert(e) {
    const c = classify(e); const now = e.time != null ? e.time : sim.time; const top = AL.list[0]; /* a hora do evento (a simulação marca cada um) */
    if (top && c.agg && top.agg === c.agg && now - top.t0 < 8) { top.n++; top.t = now; if (e.x != null) { top.x = e.x; top.y = e.y; } if (top.el) { top.el.innerHTML = rowHTML(top); flash(top.el); } return; } /* unidades (e trechos de muro) prontos do mesmo tipo em seguida viram uma linha só (×3) */
    const a = Object.assign({ id: ++AL.seq, t: now, t0: now, n: 1, x: e.x, y: e.y }, c); AL.list.unshift(a);
    if (AL.list.length > 40) { const old = AL.list.pop(); if (old.el) old.el.remove(); if (old.act) old.act.remove(); }
    if (alist) { const b = document.createElement('button'); b.type = 'button'; b.className = 'arow k-' + a.kind + ' c-' + a.cat; b.dataset.id = a.id; b.innerHTML = rowHTML(a); if (a.x == null) b.classList.add('nox'); a.el = b; b.hidden = AL.filter !== 'todos' && AL.filter !== a.cat; alist.prepend(b); flash(b);
      if (e.act === 'gather') { const ab = document.createElement('button'); ab.type = 'button'; ab.className = 'aact'; ab.dataset.res = e.res || ''; ab.innerHTML = IC('ic-' + (e.res || 'minerio')) + 'Mandar coletores'; ab.hidden = b.hidden; b.after(ab); a.act = ab; } } /* 5.0a.1: o aviso do território sem Minério ou Plasma ganha "Mandar coletores" */
    if (!(H.open === 'alc')) { AL.unread++; syncBadge(); }
    const em = box && box.querySelector('.aempty'); if (em) em.remove();
  }
  function flash(el) { el.classList.remove('nw1', 'nw2'); el.classList.add((AL.fl = !AL.fl) ? 'nw1' : 'nw2'); }
  function syncBadge() { if (abadge) { setT(abadge, AL.unread > 9 ? '9+' : AL.unread || ''); setH(abadge, !AL.unread); } setOn($('btn-alc'), 'attn', AL.unread > 0 && AL.list.some((a, i) => i < AL.unread && a.kind === 'danger')); const hn = $('alc-hn'); if (hn) setT(hn, AL.unread ? AL.unread + (AL.unread > 1 ? ' novos' : ' novo') : ''); }
  function goAlert(a) { if (!a || a.x == null) return false; I.center(a.x, a.y); view.lastAlert = { x: a.x, y: a.y }; for (const b of alist ? alist.children : []) setOn(b, 'cur', +b.dataset.id === a.id); return true; }
  if (alist) alist.addEventListener('click', ev => { const ab = ev.target.closest('.aact'); if (ab) { if (G.sendIdleCollectors) G.sendIdleCollectors(ab.dataset.res || null); if (sheets()) closeSheet(); return; } const b = ev.target.closest('.arow'); if (!b) return; const a = AL.list.find(x => x.id === +b.dataset.id); if (goAlert(a) && sheets()) closeSheet(); });
  if (box) { const seen = ev => { if (AL.unread && (ev.type === 'pointerdown' || ev.pointerType === 'mouse')) { AL.unread = 0; syncBadge(); } }; box.addEventListener('pointerenter', seen); box.addEventListener('pointerdown', seen); } /* passou o mouse (ou tocou) na central: os novos foram vistos */
  if (box) box.querySelectorAll('[data-af]').forEach(f => f.addEventListener('click', () => { AL.filter = f.dataset.af; box.querySelectorAll('[data-af]').forEach(x => { setOn(x, 'on', x === f); x.setAttribute('aria-pressed', x === f); }); for (const a of AL.list) if (a.el) { a.el.hidden = AL.filter !== 'todos' && AL.filter !== a.cat; if (a.act) a.act.hidden = a.el.hidden; } }));
  H.nextAlert = () => { /* Espaço: o último alerta; de novo em até 3 s, o anterior (e assim por diante) */
    const now = performance.now(); const loc = AL.list.filter(a => a.x != null); if (!loc.length) return view.lastAlert;
    AL.cur = now - AL.curT < 3000 ? (AL.cur + 1) % loc.length : 0; AL.curT = now; const a = loc[AL.cur]; goAlert(a); if (loc.length > 1) notice('Alerta ' + (AL.cur + 1) + ' de ' + loc.length + ': ' + a.text + ' · Espaço de novo: o anterior'); return { x: a.x, y: a.y }; };
  H.ev = e => { if (e.p === human && (e.t === 'alert' || e.t === 'built' || e.t === 'spawn')) addAlert(e); };

  // ====== visão do exército ======
  const ARMY = $('army'); const AV = { key: '', nodes: null, idleCol: [], idleProd: [], prodCur: 0 };
  const CLS_ORDER = { civ: 0, inf: 1, vei: 2, dro: 3, sup: 4 }; const PRODS = {}; const prods = def => (PRODS[def] != null ? PRODS[def] : (PRODS[def] = S.producesFor(def, me().faction).length));
  function armyScan() {
    const by = new Map(); let tot = 0, idleTot = 0; const idleCol = [], idleProd = [];
    for (const e of sim.ents) { if (!e.alive || e.owner !== human) continue;
      if (e.kind === 'unit') { let r = by.get(e.def); if (!r) { r = { def: e.def, n: 0, idle: 0, ids: [], idleIds: [] }; by.set(e.def, r); } r.n++; r.ids.push(e.id); tot++; if (e.state === 'idle') { r.idle++; r.idleIds.push(e.id); if (e.def === 'coletor') idleCol.push(e.id); else idleTot++; } }
      else if (e.kind === 'building' && e.built && !(e.jumpT > 0) && prods(e.def) && !e.queue.length) idleProd.push(e.id); }
    const rows = [...by.values()].sort((a, b) => (CLS_ORDER[(S.UNITS[a.def] || {}).cls] || 0) - (CLS_ORDER[(S.UNITS[b.def] || {}).cls] || 0) || (S.UNITS[a.def].time || 0) - (S.UNITS[b.def].time || 0));
    return { rows, tot, idleTot, idleCol, idleProd };
  }
  function armyRender(force) {
    if (!ARMY || (sheets() && H.open !== 'army' && !force)) return; const d = armyScan(); AV.idleCol = d.idleCol; AV.idleProd = d.idleProd; AV.rows = d.rows;
    const key = d.rows.map(r => r.def).join(',');
    if (key !== AV.key || !AV.nodes) { AV.key = key;
      ARMY.querySelector('.avl').innerHTML = d.rows.length ? d.rows.map(r => `<button type="button" class="avc" data-def="${r.def}" title="${esc(unitName(r.def))}: clique seleciona todos · duas vezes centraliza · Shift soma"><img alt=""><b data-n></b><i data-i></i><span>${esc(unitName(r.def))}</span></button>`).join('') : '<div class="aempty">Nenhuma unidade ainda: produza no Núcleo (Coletores) e no Quartel.</div>';
      AV.nodes = {}; ARMY.querySelectorAll('.avc').forEach(b => { AV.nodes[b.dataset.def] = { n: b.querySelector('[data-n]'), i: b.querySelector('[data-i]'), img: b.querySelector('img'), el: b, src: '' }; }); }
    for (const r of d.rows) { const nd = AV.nodes[r.def]; if (!nd) continue; if (!nd.src) { nd.src = icon(r.def); if (nd.src) nd.img.src = nd.src; } /* o retrato 3D só existe depois do carregamento */
      setT(nd.n, r.n); setT(nd.i, r.idle || ''); setOn(nd.el, 'idle', r.idle > 0); if (r.idle) { const tt = r.idle + (r.def === 'coletor' ? ' parados' : ' sem ordem'); if (nd.i.title !== tt) nd.i.title = tt; } } /* o título também só quando muda (escrever o mesmo valor ainda conta como mutação) */
    setT(AV.tot || (AV.tot = ARMY.querySelector('[data-tot]')), d.tot);
    const ic = AV.ic || (AV.ic = ARMY.querySelector('[data-idlecol]')), ip = AV.ip || (AV.ip = ARMY.querySelector('[data-idleprod]')), iu = AV.iu || (AV.iu = ARMY.querySelector('[data-idleu]'));
    setT(ic && ic.querySelector('b'), d.idleCol.length); setOn(ic, 'z', !d.idleCol.length); setT(ip && ip.querySelector('b'), d.idleProd.length); setOn(ip, 'z', !d.idleProd.length); setT(iu && iu.querySelector('b'), d.idleTot); setOn(iu, 'z', !d.idleTot);
  }
  function selectIds(ids, center, label) { ids = ids.filter(id => { const u = sim.byId.get(id); return u && u.alive; }); if (!ids.length) { notice('Nada para selecionar'); return; } I.select(ids); if (center) { const u = sim.byId.get(ids[0]); if (u) I.center(u.x, u.y); } if (label) notice(label); if (sheets()) closeSheet(); }
  if (ARMY) {
    let lastT = 0, lastDef = null;
    ARMY.addEventListener('click', ev => { const b = ev.target.closest('button'); if (!b || !AV.rows) return; const now = ev.timeStamp; /* duas vezes medidas pela hora dos eventos */
      if (b.dataset.def) { const r = AV.rows.find(x => x.def === b.dataset.def); if (!r) return; const dbl = lastDef === r.def && now - lastT < 350; lastT = now; lastDef = r.def; let ids = r.ids; if (ev.shiftKey) ids = [...new Set([...view.sel, ...ids])]; selectIds(ids, dbl, r.n + ' × ' + unitName(r.def) + (dbl ? '' : ' · duas vezes centraliza')); return; }
      if (b.hasAttribute('data-idlecol')) { if (G.sendIdleCollectors) G.sendIdleCollectors(); else selectIds(AV.idleCol, true); if (sheets()) closeSheet(); return; } /* 5.0a.1: um toque manda os parados aos nós livres mais próximos */
      if (b.hasAttribute('data-idleu')) { const ids = []; for (const r of AV.rows) if (r.def !== 'coletor') ids.push(...r.idleIds); selectIds(ids, true, ids.length + ' unidades sem ordem'); return; }
      if (b.hasAttribute('data-idleprod')) { if (!AV.idleProd.length) { notice('Toda a produção está ocupada'); return; } AV.prodCur = (AV.prodCur + 1) % AV.idleProd.length; const bd = sim.byId.get(AV.idleProd[AV.prodCur]); if (bd) { I.select([bd.id]); I.center(bd.x, bd.y); notice(S.BUILDINGS[bd.def].name + ' sem fila (' + (AV.prodCur + 1) + ' de ' + AV.idleProd.length + ')'); if (sheets()) closeSheet(); } } });
  }

  // ====== grupos de controle (barra 1 a 5 no toque; no computador, os grupos gravados com Ctrl+número) ======
  const GR = $('groups'); const GV = { key: '', btn: {}, hold: null, lastN: null, lastT: 0 };
  const groupIds = n => (I.groups[n] || []).filter(id => { const u = sim.byId.get(id); return u && u.alive; });
  function groupsRender() {
    if (!GR) return; const touch = isTouch(); const slots = touch ? ['1', '2', '3', '4', '5'] : Object.keys(I.groups).filter(n => groupIds(n).length).sort();
    const key = (touch ? 't' : 'd') + slots.join(''); setH(GR, !slots.length);
    if (key !== GV.key) { GV.key = key; GR.innerHTML = slots.map(n => `<button type="button" class="gbtn" data-g="${n}" aria-label="Grupo ${n}" title="${touch ? 'Grupo ' + n + ': toque seleciona · dois toques centralizam · segure para gravar a seleção' : 'Grupo ' + n + ': tecla ' + n + ' ou clique seleciona · duas vezes centraliza · Ctrl+' + n + ' ou Ctrl+clique grava'}"><span class="gk">${n}</span><img alt="" hidden><b data-c></b><i class="ghold" aria-hidden="true"></i></button>`).join(''); GV.btn = {}; GR.querySelectorAll('.gbtn').forEach(b => { GV.btn[b.dataset.g] = { el: b, img: b.querySelector('img'), c: b.querySelector('[data-c]'), def: null }; }); }
    const sel = [...view.sel].sort().join(',');
    for (const n of slots) { const g = GV.btn[n]; if (!g) continue; const ids = groupIds(n); setT(g.c, ids.length || ''); setOn(g.el, 'empty', !ids.length);
      let top = null; if (ids.length) { const cnt = {}; for (const id of ids) { const u = sim.byId.get(id); cnt[u.def] = (cnt[u.def] || 0) + 1; } top = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0]; }
      if (top !== g.def) { g.def = top; if (top) g.img.src = icon(top); g.img.hidden = !top; }
      setOn(g.el, 'on', !!ids.length && ids.slice().sort().join(',') === sel); }
  }
  function groupSelect(n, center) { const ids = groupIds(n); if (!ids.length) { notice(isTouch() ? 'Grupo ' + n + ' vazio: selecione unidades e segure o botão para gravar' : 'Grupo ' + n + ' vazio: Ctrl+' + n + ' grava a seleção'); return; } I.select(ids); if (center) { let x = 0, y = 0; for (const id of ids) { const u = sim.byId.get(id); x += u.x; y += u.y; } I.center(x / ids.length, y / ids.length); } }
  function groupSave(n) { const ids = [...view.sel].filter(id => { const u = sim.byId.get(id); return u && u.alive && u.owner === human; }); I.groups[n] = ids; if (navigator.vibrate) try { navigator.vibrate([12, 40, 12]); } catch (e) {} notice(ids.length ? 'Grupo ' + n + ' gravado: ' + ids.length + (ids.length > 1 ? ' selecionados' : ' selecionado') : 'Grupo ' + n + ' limpo'); groupsRender(); }
  if (GR) {
    const tap = (n, t) => { const dbl = GV.lastN === n && t - GV.lastT < 380; GV.lastN = n; GV.lastT = t; groupSelect(n, dbl); }; /* t = hora do evento (dois toques medidos pelos eventos, não pelo laço) */
    const dropHold = () => { const g = GV.hold; if (!g) return null; clearTimeout(g.t); g.b.classList.remove('holding', 'armed'); GV.hold = null; return g; };
    GR.addEventListener('pointerdown', ev => { const b = ev.target.closest('.gbtn'); if (!b || ev.pointerType === 'mouse') return; dropHold(); const n = b.dataset.g; b.classList.add('holding');
      const g = GV.hold = { n, b, id: ev.pointerId, t0: ev.timeStamp, t: setTimeout(() => { b.classList.add('armed'); if (navigator.vibrate) try { navigator.vibrate(12); } catch (e) {} }, 550) }; }); /* aos 0,55 s: acende e vibra (solte para gravar) */
    GR.addEventListener('pointerup', ev => { const g = GV.hold; if (!g || ev.pointerId !== g.id) return; dropHold(); GV.touchT = ev.timeStamp; if (ev.timeStamp - g.t0 >= 550) groupSave(g.n); else tap(g.n, ev.timeStamp); }); /* a duração real do toque decide: um quadro travado não transforma toque em "gravar" */
    GR.addEventListener('pointercancel', () => { dropHold(); });
    GR.addEventListener('pointerleave', ev => { if (GV.hold && ev.pointerId === GV.hold.id) dropHold(); });
    GR.addEventListener('click', ev => { const b = ev.target.closest('.gbtn'); if (!b) return; if (GV.touchT && ev.timeStamp - GV.touchT < 700) return; /* o clique sintético depois do toque já foi tratado */ const n = b.dataset.g; if (ev.ctrlKey || ev.metaKey) { groupSave(n); return; } tap(n, ev.timeStamp); });
    GR.addEventListener('contextmenu', ev => ev.preventDefault());
  }

  // ====== botões e folhas no toque (sino da central, exército) ======
  function eatClick(pid) { /* engole o clique que o navegador gera depois do toque que fechou uma folha ou a roda: o do mesmo gesto (pela hora dos eventos, até 0,7 s depois de soltar), mesmo com o quadro atrasado */
    let upT = null, t = 0; const done = () => { window.removeEventListener('click', f, true); window.removeEventListener('pointerup', up, true); window.removeEventListener('pointerdown', dn, true); clearTimeout(t); };
    const f = e => { if (upT == null || e.timeStamp - upT < 700) { e.stopPropagation(); e.preventDefault(); } done(); }; const up = e => { if (e.pointerId === pid) upT = e.timeStamp; }; const dn = () => done(); /* um gesto novo encerra a espera */
    window.addEventListener('click', f, true); window.addEventListener('pointerup', up, true); window.addEventListener('pointerdown', dn, true); t = setTimeout(done, 5000); }
  function openSheet(which) { H.open = which; setOn(document.body, 'sh-alc', which === 'alc'); setOn(document.body, 'sh-army', which === 'army'); setOn($('btn-alc'), 'on', which === 'alc'); setOn($('btn-armyv'), 'on', which === 'army');
    if (which === 'alc') { AL.unread = 0; syncBadge(); } if (which === 'army') armyRender(true); }
  function closeSheet() { if (!H.open) return; openSheet(null); }
  H.closeSheet = closeSheet;
  if ($('btn-alc')) $('btn-alc').addEventListener('click', () => openSheet(H.open === 'alc' ? null : 'alc'));
  if ($('btn-armyv')) $('btn-armyv').addEventListener('click', () => openSheet(H.open === 'army' ? null : 'army'));
  document.querySelectorAll('[data-h3close]').forEach(b => b.addEventListener('click', closeSheet));
  window.addEventListener('pointerdown', ev => { if (!H.open || !sheets()) return; const t = ev.target; if (t.closest && (t.closest('#alertc') || t.closest('#army') || t.closest('#btn-alc') || t.closest('#btn-armyv'))) return; closeSheet(); ev.stopPropagation(); eatClick(ev.pointerId); }, true); /* o toque que fecha a folha só fecha: não vira ordem no mapa nem aperta o botão embaixo */

  // ====== roda de comandos ======
  const WH = $('wheel'); const W = { open: false };
  function wheelItems(o) {
    const units = I.ownSelectedUnits(); const b = I.ownSelectedBuilding(); const t = I.pick(o.sx, o.sy, o.touch ? 22 : 12, units.length > 0); const f = fac(); const items = [];
    const foe = t && t.owner >= 0 && t.owner !== human && (t.kind === 'unit' || t.kind === 'building') ? t : null;
    const tName = foe ? (foe.kind === 'unit' ? S.unitName(sim.players[foe.owner].faction, foe.def) : S.BUILDINGS[foe.def].name) : '';
    if (units.length) {
      const armed = units.filter(u => S.UNITS[u.def].attack); const col = units.filter(u => u.def === 'coletor'); const pir = units.filter(u => u.def === 'pirata');
      items.push({ id: 'move', ic: 'ic-mover', n: 'Mover', d: 'Mover ' + units.length + (units.length > 1 ? ' unidades' : ' unidade') + ' até aqui', go: () => { I.cmd({ t: 'move', ids: units.map(u => u.id), x: o.wx, y: o.wy }); view.marker = { x: o.wx, y: o.wy, t: R.time, col: '#E8E2D6' }; } });
      items.push({ id: 'atk', ic: 'ic-atacar', n: 'Atacar', k: 'A', d: foe ? 'Atacar ' + tName : 'Atacar-mover: avança e luta com o que encontrar', off: !armed.length && 'Nenhuma unidade armada na seleção', go: () => { if (foe) I.contextCommand(o.wx, o.wy, o.sx, o.sy); else { I.cmd({ t: 'attackmove', ids: units.map(u => u.id), x: o.wx, y: o.wy }); view.marker = { x: o.wx, y: o.wy, t: R.time, col: '#FF5E3A' }; } } });
      items.push({ id: 'stop', ic: 'ic-parar', n: 'Parar', k: 'S', d: 'Parar e ficar no lugar', go: () => I.cmd({ t: 'stop', ids: units.map(u => u.id) }) });
      if (col.length) { const node = t && (t.kind === 'node' || t.kind === 'wreck') && t.amount > 0 ? t : null; items.push({ id: 'harv', ic: 'ic-minerio', n: 'Colher', d: node ? 'Colher ' + (t.kind === 'wreck' ? 'a carcaça' : 'este nó de ' + RES_NAME[t.res]) : 'Colher em volta deste ponto (os coletores entregam sozinhos)', go: () => { if (node) I.cmd({ t: 'harvest', ids: col.map(u => u.id), target: node.id }); else I.cmd({ t: 'move', ids: col.map(u => u.id), x: o.wx, y: o.wy }); view.marker = { x: o.wx, y: o.wy, t: R.time, col: '#7FE3A1' }; } }); }
      if (pir.length) { const ok = foe && foe.kind === 'building' && (foe.def === 'refinaria' || foe.def === 'reator') && !S.hasPact(sim, human, foe.owner); items.push({ id: 'siph', ic: 'ic-pirata', n: 'Sifonar', d: ok ? 'Sifonar ' + tName + ' (até 40 s)' : 'Aponte para uma Refinaria ou Reator inimigo', off: !ok && 'Aponte para uma Refinaria ou Reator inimigo', go: () => I.cmd({ t: 'siphon', ids: pir.map(u => u.id), target: foe.id }) });
        if (f.devour) { const dv = t && ((t.kind === 'wreck' && t.amount > 0) || (t.kind === 'building' && t.def === 'nodulo' && t.owner >= 0 && t.owner !== human && !S.hasPact(sim, human, t.owner))) ? t : null; items.push({ id: 'dev', ic: 'ic-devorar', n: 'Devorar', d: dv ? 'Devorar ' + (dv.kind === 'wreck' ? 'a carcaça' : 'o Nódulo inimigo') : 'Aponte para uma carcaça ou um Nódulo inimigo', off: !dv && 'Aponte para uma carcaça ou um Nódulo inimigo', go: () => I.cmd({ t: 'devour', ids: pir.map(u => u.id), target: dv.id }) }); } }
      if (t && t.kind === 'crate') items.push({ id: 'crate', ic: 'ic-caixa', n: 'Recolher', d: 'Recolher a caixa de recursos', go: () => I.cmd({ t: 'pickup', ids: units.map(u => u.id), target: t.id }) });
    } else if (b) {
      const d = S.BUILDINGS[b.def];
      if (S.producesFor(b.def, me().faction).length) items.push({ id: 'rally', ic: 'ic-reuniao', n: 'Reunião', d: 'Ponto de reunião de ' + d.name + ' aqui', go: () => { I.cmd({ t: 'rally', id: b.id, x: o.wx, y: o.wy }); view.marker = { x: o.wx, y: o.wy, t: R.time, col: '#F2C230' }; notice('Ponto de reunião definido'); } });
      if (b.def === 'nucleo') { const p = me(); const can = p.jumpsLeft > 0 && !(b.jumpT > 0); items.push({ id: 'jump', ic: 'ic-salto', n: 'Saltar', d: 'Salto de Núcleo para este ponto (' + p.jumpsLeft + ' restante' + (p.jumpsLeft === 1 ? '' : 's') + ')', off: !can && (p.jumpsLeft > 0 ? 'Salto em andamento' : 'Sem Saltos restantes'), go: () => ui.confirm('Saltar o Núcleo para este ponto? Custa ' + Math.round(f.jumpCostFrac * 100) + '% de cada recurso e 60 s de canalização visível a todos.', () => I.cmd({ t: 'jump', x: o.wx, y: o.wy })) }); }
      items.push({ id: 'tech', ic: 'ic-tec', n: 'Pesquisa', d: 'Abrir a tela de pesquisa e Eras (F3)', go: () => openTech() });
    }
    if (!items.length) { /* nada seu selecionado: atalhos de seleção e câmera */
      items.push({ id: 'army', ic: 'ic-exercito', n: 'Exército', d: 'Selecionar todas as unidades de combate', go: () => { const ids = ownUnits().filter(u => S.UNITS[u.def].attack).map(u => u.id); selectIds(ids, false, ids.length + ' unidades selecionadas'); } });
      items.push({ id: 'idle', ic: 'ic-ocioso', n: 'Ociosos', d: 'Selecionar as unidades paradas (coletores e combate)', go: () => { const ids = ownUnits().filter(u => u.state === 'idle').map(u => u.id); selectIds(ids, true, ids.length + ' unidades paradas'); } });
      items.push({ id: 'nuc', ic: 'ic-nucleo', n: 'Núcleo', d: 'Selecionar e centralizar o Núcleo', go: () => { const n = S.nucleoOf(sim, human); if (n) { I.select([n.id]); I.center(n.x, n.y); } } });
      items.push({ id: 'build', ic: 'ic-construir', n: 'Construir', d: 'Abrir o menu Construir', go: () => { I.select([]); I.buildMenu = true; ui.buildMenuChanged(true); if (G.drawer) G.drawer.build = false; } });
      items.push({ id: 'alert', ic: 'ic-alerta', n: 'Alerta', d: 'Ir ao último alerta', off: !AL.list.some(a => a.x != null) && 'Nenhum alerta com lugar ainda', go: () => { const a = H.nextAlert(); if (a) I.center(a.x, a.y); } });
    }
    return items;
  }
  function sectorPath(cx, cy, r1, r2, a0, a1, race) { /* setor em coroa; o contorno de fora muda com a Raça (Erevane facetado, Vorag em escama) */
    const P = (r, a) => (cx + r * Math.cos(a)).toFixed(1) + ' ' + (cy + r * Math.sin(a)).toFixed(1); const big = a1 - a0 > Math.PI ? 1 : 0; let outer;
    if (race === 'erevane') outer = `L${P(r2, (a0 + a1) / 2)} L${P(r2, a1)}`;
    else if (race === 'vorag') outer = `Q${P(r2 * 1.13, (a0 + a1) / 2)} ${P(r2, a1)}`;
    else outer = `A${r2} ${r2} 0 ${big} 1 ${P(r2, a1)}`;
    return `M${P(r2, a0)} ${outer} L${P(r1, a1)} A${r1} ${r1} 0 ${big} 0 ${P(r1, a0)}Z`; }
  function wheelHTML(items, race) {
    const n = items.length, R2 = 124, R1 = 50, C = 150, gap = 0.035; let svg = `<svg class="wsvg" viewBox="0 0 300 300" aria-hidden="true">`;
    svg += `<circle cx="${C}" cy="${C}" r="${(R1 + R2) / 2}" class="wbase" stroke-width="${R2 - R1}"/>`;
    items.forEach((it, i) => { const a0 = -Math.PI / 2 - Math.PI / n + i * 2 * Math.PI / n + gap, a1 = a0 + 2 * Math.PI / n - 2 * gap; const am = (a0 + a1) / 2; const rm = (R1 + R2) / 2 + 2;
      const x = C + rm * Math.cos(am), y = C + rm * Math.sin(am);
      svg += `<g class="wsec${it.off ? ' off' : ''}" data-i="${i}"><path d="${sectorPath(C, C, R1, R2, a0, a1, race)}"/><use href="#${it.ic}" x="${(x - 13).toFixed(1)}" y="${(y - 21).toFixed(1)}" width="26" height="26"/><text x="${x.toFixed(1)}" y="${(y + 19).toFixed(1)}">${esc(it.n)}</text>`;
      if (race === 'vehnar') svg += `<circle class="wriv" cx="${(C + (R2 - 7) * Math.cos(a0 + 0.06)).toFixed(1)}" cy="${(C + (R2 - 7) * Math.sin(a0 + 0.06)).toFixed(1)}" r="2.6"/><circle class="wriv" cx="${(C + (R2 - 7) * Math.cos(a1 - 0.06)).toFixed(1)}" cy="${(C + (R2 - 7) * Math.sin(a1 - 0.06)).toFixed(1)}" r="2.6"/>`;
      if (race === 'quorith') { const ae = a0 - gap; svg += `<path class="wshard" d="M${(C + (R2 - 4) * Math.cos(ae - 0.035)).toFixed(1)} ${(C + (R2 - 4) * Math.sin(ae - 0.035)).toFixed(1)} L${(C + (R2 + 13) * Math.cos(ae)).toFixed(1)} ${(C + (R2 + 13) * Math.sin(ae)).toFixed(1)} L${(C + (R2 - 4) * Math.cos(ae + 0.035)).toFixed(1)} ${(C + (R2 - 4) * Math.sin(ae + 0.035)).toFixed(1)}Z"/>`; }
      if (race === 'tessara') { const ae = a0 - gap; svg += `<line class="wbone" x1="${(C + (R1 + 4) * Math.cos(ae)).toFixed(1)}" y1="${(C + (R1 + 4) * Math.sin(ae)).toFixed(1)}" x2="${(C + (R2 - 3) * Math.cos(ae)).toFixed(1)}" y2="${(C + (R2 - 3) * Math.sin(ae)).toFixed(1)}"/>`; }
      if (it.off) svg += `<use href="#ic-cadeado" class="wlock" x="${(x + 9).toFixed(1)}" y="${(y - 25).toFixed(1)}" width="12" height="12"/>`;
      if (it.k && !isTouch()) svg += `<text class="wkey" x="${(x + 16).toFixed(1)}" y="${(y - 12).toFixed(1)}">${it.k}</text>`;
      svg += '</g>'; });
    svg += `<circle cx="${C}" cy="${C}" r="${R1 - 3}" class="whub"/></svg>`;
    return `<i class="wring" aria-hidden="true"></i>${svg}<div class="wcen"><b>Comandos</b><span>${isTouch() ? 'deslize e solte' : 'escolha e solte'}</span></div><div class="wdesc"><span></span></div>`;
  }
  function wheelPick(x, y) { const dx = x - W.cx, dy = y - W.cy; const d = Math.hypot(dx, dy); const k = W.scale; if (d < 46 * k || d > 150 * k) return -1; const n = W.items.length; let a = Math.atan2(dy, dx) + Math.PI / 2 + Math.PI / n; a = ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI); return Math.floor(a / (2 * Math.PI / n)) % n; }
  function wheelHi(i) { if (i === W.hi) return; W.hi = i; const it = W.items[i]; W.secs.forEach((g, j) => setOn(g, 'on', j === i)); const cen = W.cen; if (it) { setT(cen.b, it.n); setT(cen.s, it.off ? 'trancado' : (it.k && !isTouch() ? 'tecla ' + it.k : 'solte para dar a ordem')); setT(cen.d, it.off || it.d); setOn(WH, 'blocked', !!it.off); } else { setT(cen.b, W.hold && W.armed ? 'Cancelar' : 'Comandos'); setT(cen.s, W.hold ? (W.armed ? 'solte fora para cancelar' : (isTouch() ? 'deslize até uma ordem' : 'mova até uma ordem')) : 'clique fora para fechar'); setT(cen.d, ''); setOn(WH, 'blocked', false); } }
  function wheelClose(run) { if (!W.open) return; const it = run && W.items[W.hi]; W.open = false; WH.classList.remove('on'); setTimeout(() => { if (!W.open) WH.hidden = true; }, 130); window.removeEventListener('pointermove', W.mv, true); window.removeEventListener('pointerup', W.up, true); window.removeEventListener('pointerdown', W.dn, true); window.removeEventListener('keydown', W.key, true); window.removeEventListener('pointercancel', W.cancel, true);
    if (it) { if (it.off) { notice('🔒 ' + it.off); return; } try { it.go(); } catch (e) { console.warn('[ARD] roda de comandos:', e); } if (navigator.vibrate && isTouch()) try { navigator.vibrate(10); } catch (e) {} } }
  H.wheel = o => { /* o = { sx, sy, wx, wy, touch, hold, id } (coordenadas do canvas e do mundo) */
    if (!WH || W.open || G.ended) return false; const items = wheelItems(o); if (!items.length) return false;
    WH.innerHTML = wheelHTML(items, me().faction); WH.classList.remove('on'); WH.hidden = false;
    const k = Math.max(0.8, Math.min(1.6, (WH.offsetWidth || 300) / 300)); /* uma medida por abertura (no evento, nunca no laço) */
    const rr = 150 * k, m = 4; const cx = Math.max(rr + m - 20 * k, Math.min(innerWidth - rr - m + 20 * k, o.sx)), cy = Math.max(rr + m - 20 * k, Math.min(innerHeight - rr - m + 20 * k, o.sy)); /* a borda da caixa tem 26 de folga até o aro */
    Object.assign(W, { open: true, items, hi: -2, cx, cy, scale: k, hold: !!o.hold, x0: o.sx, y0: o.sy, armed: !o.hold, pid: o.id, t0: o.t0, tmin: o.tmin || 0, touch: !!o.touch });
    WH.style.transform = `translate(${Math.round(cx - rr)}px,${Math.round(cy - rr)}px)`; setOn(WH, 'up', cy > innerHeight * 0.58);
    W.secs = [...WH.querySelectorAll('.wsec')]; W.cen = { b: WH.querySelector('.wcen b'), s: WH.querySelector('.wcen span'), d: WH.querySelector('.wdesc span') }; wheelHi(-1);
    requestAnimationFrame(() => WH.classList.add('on'));
    W.mv = ev => { if (!W.open) return; if (W.hold && ev.pointerId !== W.pid) return; if (W.hold && W.t0 != null && ev.timeStamp < W.t0 + W.tmin && Math.hypot(ev.clientX - W.x0, ev.clientY - W.y0) > 10) { wheelClose(false); return; } /* arrastou antes do tempo (o quadro atrasou o evento): era arrasto, não toque longo */ if (!W.armed && Math.hypot(ev.clientX - W.x0, ev.clientY - W.y0) > 10) W.armed = true; if (W.armed) wheelHi(wheelPick(ev.clientX, ev.clientY)); if (W.hold) { ev.stopPropagation(); ev.preventDefault(); } };
    W.up = ev => { if (!W.open || !W.hold || ev.pointerId !== W.pid) return; ev.preventDefault(); /* o soltar segue para o canvas: o input.js tira o dedo da conta (sem isso, o toque seguinte virava pinça); a ordem ele não dá, porque I.down já é null */ if (W.t0 != null && ev.timeStamp < W.t0 + W.tmin) { if (W.touch) wheelClose(false); else { W.hold = false; wheelHi(-1); } return; } /* soltou antes do tempo: no toque era um toque; no mouse, um clique do meio (a roda fica aberta) */ if (!W.armed) { W.hold = false; wheelHi(-1); return; } /* soltou sem mexer: a roda fica aberta (toque numa opção ou fora para fechar) */ wheelClose(W.hi >= 0); };
    W.dn = ev => { if (!W.open || W.hold) return; ev.stopPropagation(); ev.preventDefault(); const i = wheelPick(ev.clientX, ev.clientY); W.hi = -2; wheelHi(i); eatClick(ev.pointerId); wheelClose(i >= 0 && ev.button !== 2); }; /* o clique que segue não aperta o que está embaixo */
    W.cancel = ev => { if (W.open && ev.pointerId === W.pid) wheelClose(false); };
    W.key = ev => { if (!W.open) return; const n = W.items.length; if (ev.code === 'Escape') { ev.stopPropagation(); ev.preventDefault(); wheelClose(false); } else if (ev.code === 'ArrowRight' || ev.code === 'ArrowDown') { ev.stopPropagation(); ev.preventDefault(); wheelHi(((W.hi < 0 ? -1 : W.hi) + 1) % n); } else if (ev.code === 'ArrowLeft' || ev.code === 'ArrowUp') { ev.stopPropagation(); ev.preventDefault(); wheelHi(((W.hi < 0 ? 0 : W.hi) - 1 + n) % n); } else if (ev.code === 'Enter' || ev.code === 'Space') { ev.stopPropagation(); ev.preventDefault(); wheelClose(W.hi >= 0); } };
    window.addEventListener('pointermove', W.mv, true); window.addEventListener('pointerup', W.up, true); window.addEventListener('pointerdown', W.dn, true); window.addEventListener('keydown', W.key, true); window.addEventListener('pointercancel', W.cancel, true);
    return true;
  };
  H.wheelOpen = () => W.open;

  // ====== tela de pesquisa (Eras do Núcleo, Laboratório, módulos, Ascensão e superarma) ======
  const TM = $('tech'), TB = TM && $('tech-body'); const TV = { key: '', iconQ: [] };
  const ERA_UNLOCK = er => { /* a Era em que cada coisa fica disponível: a da unidade ou a da construção que a produz (Veículo Pesado só com a Fábrica, Era II) */ const f = me().faction; const bs = Object.keys(S.BUILDINGS).filter(k => S.BUILDINGS[k].key && (S.BUILDINGS[k].era || 1) === er); const ue = {}; for (const b of ['nucleo', 'quartel', 'fabrica', 'hangar']) for (const u of S.producesFor(b, f)) { const e = Math.max(S.UNITS[u].era || 1, S.BUILDINGS[b].era || 1, ...(S.UNITS[u].needs || []).map(n => S.BUILDINGS[n].era || 1)); ue[u] = Math.min(ue[u] || 9, e); } return { bs, us: Object.keys(ue).filter(u => ue[u] === er) }; };
  const MODS = () => Object.keys(S.BUILDINGS).filter(k => S.BUILDINGS[k].module).map(k => ({ def: k, m: S.BUILDINGS[k].module }));
  function missing(cost) { const p = me(); const m = []; for (const k of RES3) { const c = (cost || {})[k] || 0, have = Math.floor(p.res[k] || 0); if (c > have) m.push(fmt(c - have) + ' de ' + RES_NAME[k]); } return m.length ? 'Faltam ' + m.join(' e ') : null; }
  const lazyImg = def => ICONS[def] ? `<img class="tico" alt="" src="${ICONS[def]}">` : (TV.iconQ.push(def), `<img class="tico" alt="" data-ico="${def}">`); /* o que já foi desenhado entra na hora; o resto, aos poucos */
  function techState() { const p = me(); const n = S.nucleoOf(sim, human); const nx = S.ERAS[(p.era || 1) + 1]; const lab = S.hasBuilt(sim, human, 'laboratorio');
    const aff = c => S.canAfford(p, c || {}) ? 1 : 0;
    return [p.era || 1, p.evolveT > 0 ? 'e' : '', Object.keys(p.research).sort().join(''), p.ascended ? 'a' : '', lab ? 'L' : '', nx ? S.eraBlock(sim, human) || '' : '', nx ? aff(nx.cost) : '', Object.keys(S.RESEARCH).map(k => aff(S.RESEARCH[k].cost)).join(''), aff((S.ASCENSION[p.faction] || {}).cost), Math.max(0, p.superCd - sim.time) > 0 ? 'c' : '', aff(S.SUPER_COST), MODS().map(x => sim.ents.filter(e => e.alive && e.owner === human && e.def === x.def && e.built).map(e => (e.mod ? 1 : 0) + (e.upT > 0 ? 'u' : '')).join('')).join('|'), MODS().map(x => aff(x.m.cost)).join(''), n ? 1 : 0].join('/'); }
  function techHTML() {
    const p = me(), f = fac(), er = p.era || 1, nx = S.ERAS[er + 1]; const lab = S.hasBuilt(sim, human, 'laboratorio'); TV.iconQ = [];
    let h = `<div class="tk-sum"><span>${IC('ic-era')}Era <b>${S.ERAS[er].roman} · ${esc(S.ERAS[er].name)}</b></span><span>${RES3.map(k => `<span class="c-${k}"><svg class="ri xs"><use href="#${RES_IC[k]}"/></svg> <b data-tr="${k}">${fmt(p.res[k])}</b></span>`).join(' ')}</span><span class="muted">${lab ? 'Laboratório pronto' : 'Sem Laboratório (Era II)'}</span></div>`;
    h += '<h3>Eras do Núcleo</h3><div class="tk-eras">';
    for (let n = 1; n <= 3; n++) { const E = S.ERAS[n]; const done = n < er, cur = n === er, nextE = n === er + 1, evo = nextE && p.evolveT > 0; const un = ERA_UNLOCK(n);
      const st = done ? 'concluída' : cur ? 'atual' : evo ? 'evoluindo' : 'trancada';
      h += `<div class="tk-era ${done ? 'done' : cur ? 'cur' : evo ? 'evo' : 'lk'}"><div class="te-h"><b>Era ${E.roman}</b><span>${esc(E.name)}</span><i>${st}</i></div><p>${esc(E.desc)}</p>`;
      if (n > 1) { const reqs = (E.needs || []).map(r => [S.hasBuilt(sim, human, r), S.BUILDINGS[r].name]).concat(E.needsAny ? [[E.needsAny.some(r => S.hasBuilt(sim, human, r)), E.needsAny.map(r => S.BUILDINGS[r].name).join(' ou ')]] : []);
        h += `<div class="te-req">${reqs.map(r => `<span class="${r[0] || done || cur ? 'ok' : 'no'}">${r[0] || done || cur ? '✓' : '✗'} ${esc(r[1])}</span>`).join('')}</div><div class="te-cost">${costStr(E.cost)} · ${IC('ic-relogio')}${E.time} s</div>`; }
      h += `<div class="te-un">${un.bs.map(b => `<span title="${esc(S.BUILDINGS[b].name)}">${lazyImg(b)}<small>${esc(S.BUILDINGS[b].name)}</small></span>`).join('')}${un.us.map(u => `<span title="${esc(unitName(u))}">${lazyImg(u)}<small>${esc(unitName(u))}</small></span>`).join('')}</div>`;
      if (nextE && !evo) { const why = S.eraBlock(sim, human), miss = missing(E.cost); h += `<div class="te-go">${why ? `<span class="tk-lock">${IC('ic-cadeado')}${esc(why)}</span>` : miss ? `<span class="tk-miss">${IC('ic-limpar')}${esc(miss)}</span>` : ''}<button class="act sm${why || miss ? '' : ' good'}" data-tk="evolve"${why || miss ? ' disabled' : ''}>${IC('ic-era')}Evoluir para a Era ${E.roman}</button></div>`; }
      if (evo) h += `<div class="te-go"><div class="hp evo" data-tk-evo><i style="width:${Math.round(100 * (1 - p.evolveT / E.time))}%"></i></div><span class="small" data-tk-evot>${Math.ceil(p.evolveT)} s</span></div>`;
      h += '</div>'; }
    h += '</div><h3>Laboratório · pesquisas</h3><div class="tk-grid">';
    const RIC = { armamento: 'ic-dano', blindagem: 'ic-def', sensores: 'ic-sensor' };
    for (const k in S.RESEARCH) { const r = S.RESEARCH[k]; const done = !!p.research[k]; const lk = !done && (S.lockReason(sim, human, 'research', k) || (!lab ? 'Requer Laboratório' : null)); const miss = !done && !lk && missing(r.cost);
      h += `<div class="tk-card ${done ? 'done' : lk ? 'lk' : ''}"><div class="tc-h">${IC(RIC[k] || 'ic-tec', 'tci')}<b>${esc(r.name)}</b><span class="tk-era-b">ERA ${S.ERAS[r.era].roman}</span></div><p>${esc(r.desc)}</p><div class="tc-f"><span>${costStr(r.cost)} · instantânea</span>${done ? '<span class="tk-ok">✓ concluída</span>' : lk ? `<span class="tk-lock">${IC('ic-cadeado')}${esc(lk)}</span>` : miss ? `<span class="tk-miss">${esc(miss)}</span>` : `<button class="act sm good" data-tk="research" data-k="${k}">${IC('ic-tec')}Pesquisar</button>`}</div></div>`; }
    h += '</div><h3>Módulos das construções</h3><div class="tk-grid">';
    for (const { def, m } of MODS()) { const mine = sim.ents.filter(e => e.alive && e.owner === human && e.def === def && e.built); const inst = mine.filter(e => e.mod).length, up = mine.filter(e => e.upT > 0).length; const lk = S.lockReason(sim, human, 'module', def);
      h += `<div class="tk-card ${inst && inst === mine.length ? 'done' : lk ? 'lk' : ''}"><div class="tc-h">${lazyImg(def)}<b>${esc(m.name)}</b><span class="tk-era-b">ERA ${S.ERAS[m.era || 1].roman}</span></div><p>${esc(m.desc)} <span class="muted">· em ${esc(S.BUILDINGS[def].name)}</span></p><div class="tc-f"><span>${costStr(m.cost)} · ${IC('ic-relogio')}${m.time} s</span><span class="small">${mine.length ? inst + ' de ' + mine.length + ' com o módulo' + (up ? ' · ' + up + ' instalando' : '') : 'nenhum(a) ' + esc(S.BUILDINGS[def].name)}</span>${lk ? `<span class="tk-lock">${IC('ic-cadeado')}${esc(lk)}</span>` : mine.some(e => !e.mod && !(e.upT > 0)) ? `<button class="act sm" data-tk="pickmod" data-def="${def}">${IC('ic-construir')}Escolher ${esc(S.BUILDINGS[def].name)}</button>` : ''}</div></div>`; }
    h += '</div><h3>Poder da Raça</h3><div class="tk-grid">';
    { const a = S.ASCENSION[p.faction]; if (a) { const lk = p.ascended ? null : !lab ? 'Requer Laboratório' : er < 3 ? 'Requer Era III (Domínio)' : null; const miss = !p.ascended && !lk && missing(a.cost);
      h += `<div class="tk-card asc ${p.ascended ? 'done' : lk ? 'lk' : ''}"><div class="tc-h">${IC('ic-super', 'tci')}<b>Ascensão: ${esc(a.name)}</b><span class="tk-era-b">ERA III</span></div><p>${esc(a.desc)}</p><div class="tc-f"><span>${costStr(a.cost)} · instantânea</span>${p.ascended ? '<span class="tk-ok">✓ alcançada</span>' : lk ? `<span class="tk-lock">${IC('ic-cadeado')}${esc(lk)}</span>` : miss ? `<span class="tk-miss">${esc(miss)}</span>` : `<button class="act sm good" data-tk="ascend">${IC('ic-super')}Ascender</button>`}</div></div>`; } }
    { const cd = Math.max(0, p.superCd - sim.time); const lk = !lab ? 'Requer Laboratório' : er < 3 ? 'Requer Era III (Domínio)' : null; const miss = !lk && !cd && missing(S.SUPER_COST);
      h += `<div class="tk-card sup ${lk ? 'lk' : ''}"><div class="tc-h">${IC('ic-super', 'tci')}<b>Superarma: ${esc(f.superName)}</b><span class="tk-era-b">ERA III</span></div><p>${esc(f.superDesc)}</p><div class="tc-f"><span>${costStr(S.SUPER_COST)} · recarga ${Math.round(S.SUPER_CD / 60)} min</span>${lk ? `<span class="tk-lock">${IC('ic-cadeado')}${esc(lk)}</span>` : cd ? `<span class="tk-miss" data-tk-cd>recarga ${mmss(cd)}</span>` : miss ? `<span class="tk-miss">${esc(miss)}</span>` : '<span class="tk-ok">pronta: botão Superarma ao lado do radar</span>'}</div></div>`; }
    h += '</div>'; return h; }
  function techRender(force) { if (!TM || TM.hidden) return; const key = techState(); const p = me();
    if (force || key !== TV.key) { TV.key = key; const sb = TM.querySelector('.box'); const st = sb ? sb.scrollTop : 0; TB.innerHTML = techHTML(); if (sb) sb.scrollTop = st; /* a janela rola, não o corpo */ TV.evo = TB.querySelector('[data-tk-evo] i'); TV.evot = TB.querySelector('[data-tk-evot]'); TV.cd = TB.querySelector('[data-tk-cd]'); TV.tr = {}; TB.querySelectorAll('[data-tr]').forEach(b => { TV.tr[b.dataset.tr] = b; }); iconsLater(); return; }
    const nx = S.ERAS[(p.era || 1) + 1]; if (nx && p.evolveT > 0) { setW(TV.evo, 100 * (1 - p.evolveT / nx.time)); setT(TV.evot, Math.ceil(p.evolveT) + ' s'); }
    if (TV.cd) setT(TV.cd, 'recarga ' + mmss(Math.max(0, p.superCd - sim.time)));
    if (TV.tr) for (const k of RES3) setT(TV.tr[k], fmt(p.res[k])); } /* os recursos do alto andam no lugar */
  function iconsLater() { /* retratos 3D aos poucos (dois por quadro), para abrir a tela sem travar */ const imgs = [...TB.querySelectorAll('img[data-ico]')]; let i = 0; const step = () => { if (TM.hidden) return; for (let k = 0; k < 2 && i < imgs.length; k++, i++) { const im = imgs[i]; const u = icon(im.dataset.ico); if (u) im.src = u; im.removeAttribute('data-ico'); } if (i < imgs.length) requestAnimationFrame(step); }; requestAnimationFrame(step); }
  function openTech() { if (!TM) return; closeSheet(); TM.hidden = false; TV.key = ''; techRender(true); const c = TM.querySelector('.mclose'); if (c && !isTouch()) c.focus({ preventScroll: true }); }
  function closeTech() { if (TM) TM.hidden = true; }
  H.openTech = openTech; H.toggleTech = () => { if (TM && !TM.hidden) closeTech(); else openTech(); }; H.techOpen = () => !!TM && !TM.hidden;
  if (TB) TB.addEventListener('click', ev => { const b = ev.target.closest('[data-tk]'); if (!b || b.disabled) return; const k = b.dataset.tk;
    if (k === 'evolve') { I.cmd({ t: 'evolve' }); notice('Evolução pedida ao Núcleo'); }
    else if (k === 'research') I.cmd({ t: 'research', key: b.dataset.k });
    else if (k === 'ascend') I.cmd({ t: 'ascend' });
    else if (k === 'pickmod') { const e = sim.ents.find(x => x.alive && x.owner === human && x.def === b.dataset.def && x.built && !x.mod && !(x.upT > 0)); if (e) { closeTech(); I.select([e.id]); I.center(e.x, e.y); notice('Toque em Módulo no painel para instalar'); } }
    setTimeout(() => techRender(true), 120); });
  if (TM) TM.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', closeTech));

  // ====== Ajustes da partida (acessibilidade) ======
  const AM = $('a11y'); if (AM) { const body = $('a11y-body'); body.innerHTML = a11yHTML('pt') + '<p class="small muted h3note">As cores dos jogadores (paleta e cores relativas) mudam na próxima partida (os modelos 3D já foram montados com as cores atuais); as dos recursos, a escala, as legendas e o destaque dos inimigos mudam na hora.</p>'; bindA11y(body, () => { GV.key = ''; groupsRender(); }); AM.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => { AM.hidden = true; })); }
  H.openA11y = () => { if (AM) { closeSheet(); AM.hidden = false; } };
  H.modalOpen = () => (TM && !TM.hidden) || (AM && !AM.hidden);
  H.closeModals = () => { closeTech(); if (AM) AM.hidden = true; closeSheet(); wheelClose(false); };
  if ($('btn-tech')) $('btn-tech').addEventListener('click', () => H.toggleTech());
  if ($('btn-a11y')) $('btn-a11y').addEventListener('click', () => H.openA11y());

  // ====== laço: tudo com guarda (escreve só o que mudou), em ritmos diferentes ======
  H.frame = n => { if (n % 20 === 0) armyRender(false); if (n % 30 === 7) groupsRender(); if (n % 15 === 3) techRender(false); };
  H.selChanged = () => { groupsRender(); };
  H.groupsChanged = () => { groupsRender(); };
  H.reapply = s => { const cols = playerColors(s, human); if (cols) s.players.forEach((p, i) => { p.color = cols[i]; }); }; /* volta à sala (multiplayer): a fotografia do anfitrião traz as cores dele (5.0a.1: e as relativas são de cada um) */
  H._al = AL; H._w = W; /* testes (work/h3.cjs e work/toque.cjs): avisos e estado da roda */
  groupsRender(); syncBadge(); /* a visão do exército sobe no primeiro quadro da partida (os retratos 3D precisam do carregamento) */
  if (alist && !AL.list.length) alist.innerHTML = '<div class="aempty">Nenhum alerta ainda. Ataques, construções e unidades prontas, recursos esgotados e piratas aparecem aqui; toque ou clique para ir até lá.</div>';
  return H;
}

ARD.hud3 = { a11y: A, PAL, applyAll, prepareSim, mount, playerColors, view: VIEW };
})(globalThis.ARD = globalThis.ARD || {});
