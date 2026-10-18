/* Aether Rift: Dominion — tela inicial (4.3k): vitrine da Raça (líder em destaque com busto 3D, insígnia, mundo natal,
   estilo de jogo e unidades-símbolo, troca animada), fichas das cinco Raças (input[name=fac] por baixo), controles
   segmentados e cartões de mapa por cima dos <select> (que seguem como fonte da verdade para o resto do código) e o
   botão fixo de início no celular. Só interface: nada aqui toca a simulação. */
(function (ARD) {
'use strict';
const RACES = ['vehnar', 'erevane', 'tessara', 'quorith', 'vorag'];
/* mundo natal (dos lugares da campanha), estilo de jogo e três unidades-símbolo por Raça */
const LORE = {
  vehnar: { kicker: 'Colônia-fábrica', world: 'Kessari', worldTip: 'mundo-forja das fundições', style: ['Indústria pesada', 'Linhas de Montagem', 'Estruturas blindadas', 'Fumaça visível'], units: ['prensa', 'soldador', 'guindaste'] },
  erevane: { kicker: 'Corsários da Faixa', world: 'Ísk', worldTip: 'arquipélago das refinarias', style: ['Furtividade', 'Roubo limpo +20%', 'Camuflagem', '2 Saltos de Núcleo'], units: ['lamina', 'atirador', 'mosquito'] },
  tessara: { kicker: 'Linhagem viva', world: 'Oriel', worldTip: 'estufas e jardins vivos', style: ['Adaptação', 'Traços de combate', 'Fotossíntese', 'Faminta por Dados'], units: ['colosso', 'quimera', 'esporo'] },
  quorith: { kicker: 'Mente-colmeia de cristal', world: 'Quor', worldTip: 'cavernas de cristal ressonante', style: ['Sincronia (Elo)', 'Pactos pela metade', 'Torres emudecidas', 'Cristal'], units: ['monolito', 'harmonico', 'voz'] },
  vorag: { kicker: 'Enxame voraz', world: 'Velk', worldTip: 'ninhos sob a crosta', style: ['Enxame barato', 'Crias em pares', 'Fome fora de casa', 'Devora carcaças'], units: ['brutamonte', 'cria', 'ferroada'] },
};
const CLS_ICON = { inf: 'ic-inf', vei: 'ic-veic', dro: 'ic-aereo', sup: 'ic-construir', civ: 'ic-inf', est: 'ic-nucleo' };
const SEG_LABELS = {
  'opt-opp': { 1: ['1v1', '1 IA'], 2: ['FFA 3', '2 IAs'], 3: ['FFA 4', '3 IAs'] },
  'opt-room': { 2: ['2', 'jogadores'], 3: ['3', 'jogadores'], 4: ['4', 'jogadores'] },
  'camp-diff': { fenda: ['Fenda', 'sem pausa'] },
};
const MAP_TXT = { fenda: 'Quatro biomas e o abismo da Fenda no centro.', cinturao: 'Plataformas sobre o espaço, ligadas por pontes.' };
let D = null, st = null;
const G3 = () => { const el = document.getElementById('start'); return !el || el.hidden; }; /* a partida já começou (ou não há tela inicial) */
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const coarse = () => { try { return matchMedia('(pointer: coarse)').matches; } catch (e) { return false; } };
const reduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
const idle = (f, t) => (window.requestIdleCallback ? requestIdleCallback(f, { timeout: t || 500 }) : setTimeout(f, 30));
/* intercepta value = ... feito pelo código (sem evento de mudança) para os controles por cima do <select> acompanharem */
function watchValue(sel, cb) { const desc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value'); if (!desc || !desc.set) return;
  try { Object.defineProperty(sel, 'value', { configurable: true, get() { return desc.get.call(this); }, set(v) { desc.set.call(this, v); try { cb(); } catch (e) {} } }); } catch (e) {} }

// ---------- controle segmentado ----------
function segmented(sel) {
  if (!sel || sel.dataset.segDone) return; sel.dataset.segDone = '1';
  const wrap = document.createElement('div'); wrap.className = 'seg'; wrap.setAttribute('role', 'radiogroup');
  const lab = document.querySelector('label[for="' + sel.id + '"]'); if (lab) wrap.setAttribute('aria-label', lab.textContent.trim());
  const L = SEG_LABELS[sel.id] || {};
  for (const o of sel.options) { const b = document.createElement('button'); b.type = 'button'; b.dataset.v = o.value; b.setAttribute('role', 'radio');
    const lb = L[o.value]; b.innerHTML = lb ? esc(lb[0]) + '<small>' + esc(lb[1]) + '</small>' : esc(o.textContent.replace(/\s*\(.*\)$/, ''));
    b.title = o.textContent; b.addEventListener('click', () => { if (sel.disabled) return; sel.value = o.value; sel.dispatchEvent(new Event('change', { bubbles: true })); sync(); }); wrap.appendChild(b); }
  const sync = () => { for (const b of wrap.children) { const on = b.dataset.v === sel.value; b.classList.toggle('on', on); b.setAttribute('aria-checked', on ? 'true' : 'false'); b.disabled = sel.disabled; } };
  sel.classList.add('seg-src'); sel.tabIndex = -1; sel.setAttribute('aria-hidden', 'true'); sel.after(wrap); sel.addEventListener('change', sync); watchValue(sel, sync);
  new MutationObserver(sync).observe(sel, { attributes: true, attributeFilter: ['disabled'] }); sync();
}

// ---------- cartões de mapa: miniatura tática desenhada no canvas ----------
function drawMap(cv, kind, nPlayers, color) {
  const W = cv.width = 320, H = cv.height = 200; const c = cv.getContext('2d'); const cx = W / 2, cy = H / 2 + 4; const R = 84;
  c.fillStyle = '#05070b'; c.fillRect(0, 0, W, H);
  let s = 11; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  if (kind === 'cinturao') {
    const g = c.createRadialGradient(cx * 0.7, cy * 0.6, 10, cx, cy, W * 0.7); g.addColorStop(0, 'rgba(60,40,120,.55)'); g.addColorStop(0.5, 'rgba(20,40,90,.35)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    for (let i = 0; i < 160; i++) { c.fillStyle = 'rgba(220,230,255,' + (0.2 + rnd() * 0.7).toFixed(2) + ')'; const r = rnd() < 0.08 ? 1.4 : 0.8; c.fillRect(rnd() * W, rnd() * H, r, r); }
    const n = Math.max(2, nPlayers); const A = i => -Math.PI / 2 + i * Math.PI * 2 / n; const R0 = R * 0.95, RE = R * 0.6;
    const plat = (x, y, r, fill, edge) => { c.beginPath(); for (let k = 0; k <= 28; k++) { const a = k / 28 * Math.PI * 2; const rr = r * (1 + 0.08 * Math.sin(3 * a + x) + 0.05 * Math.sin(7 * a + y)); const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr * 0.92; if (k) c.lineTo(px, py); else c.moveTo(px, py); } c.closePath(); c.fillStyle = fill; c.fill(); c.strokeStyle = edge; c.lineWidth = 1.2; c.stroke(); };
    c.strokeStyle = 'rgba(160,140,120,.65)'; c.lineWidth = 3.2;
    for (let i = 0; i < n; i++) for (const sg of [-1, 1]) { const a = A(i), b = a + sg * Math.PI / n; c.beginPath(); c.moveTo(cx + Math.cos(a) * R0, cy + Math.sin(a) * R0 * 0.92); c.lineTo(cx + Math.cos(b) * RE, cy + Math.sin(b) * RE * 0.92); c.stroke(); }
    const vg = c.createRadialGradient(cx, cy, 2, cx, cy, R * 0.3); vg.addColorStop(0, 'rgba(255,140,90,.9)'); vg.addColorStop(0.35, 'rgba(178,60,255,.55)'); vg.addColorStop(1, 'rgba(0,0,0,0)');
    c.beginPath(); c.arc(cx, cy, R * 0.34, 0, Math.PI * 2); c.lineWidth = 9; c.strokeStyle = 'rgba(70,64,62,.95)'; c.stroke(); c.fillStyle = vg; c.beginPath(); c.arc(cx, cy, R * 0.3, 0, Math.PI * 2); c.fill();
    for (let i = 0; i < n; i++) { const a = A(i) + Math.PI / n; plat(cx + Math.cos(a) * RE, cy + Math.sin(a) * RE * 0.92, 15, '#3a3530', 'rgba(220,200,170,.55)'); }
    for (let i = 0; i < n; i++) { const a = A(i); plat(cx + Math.cos(a) * R0, cy + Math.sin(a) * R0 * 0.92, 25, '#4a4239', 'rgba(230,210,180,.7)'); }
    for (let i = 0; i < n; i++) { const a = A(i); base(c, cx + Math.cos(a) * R0, cy + Math.sin(a) * R0 * 0.92, i === 0 ? color : '#c9c4ba', i === 0); }
  } else {
    const bio = [['#7a5a33', -0.25], ['#4d5a32', 0.95], ['#5e6e80', 2.2], ['#2b2a2e', 3.5]];
    c.save(); c.beginPath(); c.ellipse(cx, cy, R * 1.55, R * 0.98, 0, 0, Math.PI * 2); c.clip();
    for (const [col, a0] of bio) { const g = c.createRadialGradient(cx + Math.cos(a0) * R, cy + Math.sin(a0) * R * 0.6, 4, cx + Math.cos(a0) * R, cy + Math.sin(a0) * R * 0.6, R * 1.5); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, W, H); }
    c.strokeStyle = 'rgba(255,255,255,.07)'; c.lineWidth = 1; for (let k = 1; k < 7; k++) { c.beginPath(); c.ellipse(cx, cy, R * 0.22 * k, R * 0.14 * k, 0, 0, Math.PI * 2); c.stroke(); }
    c.restore();
    c.strokeStyle = 'rgba(255,255,255,.18)'; c.lineWidth = 1.2; c.beginPath(); c.ellipse(cx, cy, R * 1.55, R * 0.98, 0, 0, Math.PI * 2); c.stroke();
    const rg = c.createRadialGradient(cx, cy, 2, cx, cy, R * 0.42); rg.addColorStop(0, 'rgba(255,170,110,.95)'); rg.addColorStop(0.25, 'rgba(255,94,58,.7)'); rg.addColorStop(0.6, 'rgba(178,60,255,.35)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = '#07080b'; c.beginPath(); c.ellipse(cx, cy, R * 0.3, R * 0.2, 0, 0, Math.PI * 2); c.fill(); c.fillStyle = rg; c.beginPath(); c.ellipse(cx, cy, R * 0.42, R * 0.28, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = 'rgba(255,190,140,.9)'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(cx - R * 0.26, cy + 2); for (let k = 1; k <= 8; k++) c.lineTo(cx - R * 0.26 + k * R * 0.065, cy + (k % 2 ? -3 : 3)); c.stroke();
    const n = Math.max(2, nPlayers); for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + i * Math.PI * 2 / n + 0.3; base(c, cx + Math.cos(a) * R * 1.18, cy + Math.sin(a) * R * 0.74, i === 0 ? color : '#c9c4ba', i === 0); }
    for (let i = 0; i < 18; i++) { const a = rnd() * Math.PI * 2, d = 0.45 + rnd() * 0.5; const x = cx + Math.cos(a) * R * 1.4 * d, y = cy + Math.sin(a) * R * 0.88 * d; c.fillStyle = ['#62CDFF', '#FF8A5C', '#7FE3A1'][i % 3]; c.globalAlpha = 0.75; c.beginPath(); c.moveTo(x, y - 2.6); c.lineTo(x + 2.2, y); c.lineTo(x, y + 2.6); c.lineTo(x - 2.2, y); c.closePath(); c.fill(); c.globalAlpha = 1; }
  }
  c.strokeStyle = 'rgba(255,255,255,.05)'; c.lineWidth = 1; for (let x = 0; x < W; x += 20) { c.beginPath(); c.moveTo(x + 0.5, 0); c.lineTo(x + 0.5, H); c.stroke(); } for (let y = 0; y < H; y += 20) { c.beginPath(); c.moveTo(0, y + 0.5); c.lineTo(W, y + 0.5); c.stroke(); }
}
function base(c, x, y, col, me) { c.save(); c.translate(x, y); if (me) { c.shadowColor = col; c.shadowBlur = 10; } c.fillStyle = col; c.beginPath(); c.moveTo(0, -7); c.lineTo(7, 0); c.lineTo(0, 7); c.lineTo(-7, 0); c.closePath(); c.fill(); c.shadowBlur = 0; c.strokeStyle = 'rgba(0,0,0,.6)'; c.lineWidth = 1.5; c.stroke(); if (me) { c.strokeStyle = col; c.lineWidth = 1.2; c.beginPath(); c.arc(0, 0, 11, 0, Math.PI * 2); c.stroke(); } c.restore(); }
function mapCards(sel) {
  if (!sel || sel.dataset.mapDone) return; sel.dataset.mapDone = '1';
  const wrap = document.createElement('div'); wrap.className = 'mapcards'; wrap.setAttribute('role', 'radiogroup'); wrap.setAttribute('aria-label', 'Mapa');
  const cards = [];
  for (const o of sel.options) { const b = document.createElement('button'); b.type = 'button'; b.className = 'mapc'; b.dataset.v = o.value; b.setAttribute('role', 'radio');
    const name = o.textContent.replace(/\s*\(.*\)$/, ''); b.innerHTML = '<canvas aria-hidden="true"></canvas><b>' + esc(name) + '</b><span>' + esc(MAP_TXT[o.value] || o.textContent) + '</span>'; b.title = o.textContent;
    b.addEventListener('click', () => { if (sel.disabled) return; sel.value = o.value; sel.dispatchEvent(new Event('change', { bubbles: true })); sync(); }); wrap.appendChild(b); cards.push(b); }
  const sync = () => { for (const b of cards) { const on = b.dataset.v === sel.value; b.classList.toggle('on', on); b.setAttribute('aria-checked', on ? 'true' : 'false'); } };
  const draw = () => { const n = sel.id === 'opt-map-mp' ? (parseInt((document.getElementById('opt-room') || {}).value, 10) || 2) : (parseInt((document.getElementById('opt-opp') || {}).value, 10) || 2) + 1; const col = getComputedStyle(document.documentElement).getPropertyValue('--race').trim() || '#FF7733'; for (const b of cards) drawMap(b.querySelector('canvas'), b.dataset.v, n, col); };
  sel.classList.add('seg-src'); sel.tabIndex = -1; sel.setAttribute('aria-hidden', 'true'); sel.after(wrap); sel.addEventListener('change', sync); watchValue(sel, sync); sync(); draw();
  return { draw, sync };
}

// ---------- vitrine da Raça ----------
function factsHTML(id) { const S = ARD.sim, f = S.FACTIONS[id], L = LORE[id] || {};
  const fact = (ic, k, v, tip) => `<div class="sc-fact"><svg aria-hidden="true"><use href="#${ic}"/></svg><span>${k}</span><b>${esc(v)}${tip ? '<i class="wt"> · ' + esc(tip) + '</i>' : ''}</b></div>`;
  return fact('ic-lider', 'Líder', D.LEADER_NAME[id] || '—') + fact('ic-mundo', 'Mundo natal', L.world || '—', L.worldTip) + fact('ic-super', 'Superarma', f.superName) + fact('ic-pirata', 'Pirata', f.pirateName); }
function unitsHTML(id) { const S = ARD.sim, L = LORE[id] || {}; return (L.units || []).filter(d => S.UNITS[d]).map(d => { const u = S.UNITS[d]; const where = ['quartel', 'fabrica', 'hangar'].find(b => S.producesFor(b, id).includes(d));
  const th = st && st.thumbs[id + '|' + d]; return `<div class="sc-unit" data-def="${d}"><div class="ut">${th ? `<img alt="" src="${th}">` : `<svg aria-hidden="true"><use href="#${CLS_ICON[u.cls] || 'ic-inf'}"/></svg>`}</div><b>${esc(S.unitName(id, d))}</b><span>${esc(S.CLASS_NAMES[u.cls] || '')}${where ? ' · ' + esc(S.BUILDINGS[where].name) : ''}${u.era > 1 ? ' · Era ' + S.ERAS[u.era].roman : ''}</span></div>`; }).join(''); }
function fillInfo(id) { const S = ARD.sim, f = S.FACTIONS[id], L = LORE[id] || {}; const $ = D.$;
  $('sc-kicker').textContent = 'Raça ' + (RACES.indexOf(id) + 1) + ' de 5 · ' + (L.kicker || f.short);
  const nm = f.name, sh = f.short || nm; $('sc-name').innerHTML = nm !== sh && nm.endsWith(sh) ? '<small>' + esc(nm.slice(0, nm.length - sh.length).trim()) + '</small>' + esc(sh) : esc(nm);
  $('sc-tag').textContent = f.tagline; $('sc-facts').innerHTML = factsHTML(id); $('sc-style').innerHTML = (L.style || []).map(t => '<span>' + esc(t) + '</span>').join(''); $('sc-units').innerHTML = unitsHTML(id);
  const em = $('sc-emblem-use'); if (em) em.setAttribute('href', '#em-' + id); }
/* busto 3D grande (computador): um canvas por Raça, montado na primeira vez e guardado; o de fora fica escondido e não desenha */
function bustFor(id) { if (!st.use3d) return null; if (st.busts[id]) return st.busts[id];
  const cv = document.createElement('canvas'); cv.width = cv.height = 512; cv.className = 'out'; cv.setAttribute('aria-hidden', 'true'); cv.hidden = true; D.$('sc-bust').appendChild(cv);
  const it = ARD.leaders3d.mount(cv, id, { framing: 'arte', fps: 30, mood: 1, yaw: 0.16 }); if (!it) { cv.remove(); st.use3d = false; return null; }
  st.busts[id] = { cv, it }; return st.busts[id]; }
function showBust(id, first) { const $ = D.$; const img = $('sc-portrait'); const art = D.leaderArt(id); const bust = $('sc-bust');
  for (const k in st.busts) if (k !== id) { const b = st.busts[k]; b.cv.classList.add('out'); clearTimeout(b.hideT); b.hideT = setTimeout(() => { if (st && st.sel !== k) b.cv.hidden = true; }, 480); }
  const b = bustFor(id);
  if (!b) { img.classList.add('out'); setTimeout(() => { if (art) img.src = art; img.hidden = !art; requestAnimationFrame(() => img.classList.remove('out')); }, first ? 0 : 160); }
  else { clearTimeout(b.hideT); b.cv.hidden = false; const ready = () => b.it.n > 0;
    if (!ready() && art) { img.src = art; img.hidden = false; img.classList.remove('out'); } else img.classList.add('out');
    const t0 = performance.now(); const wait = () => { if (!st || st.sel !== id) return; if (ready()) { b.cv.classList.remove('out'); img.classList.add('out'); return; } if (performance.now() - t0 < 30000) requestAnimationFrame(wait); }; requestAnimationFrame(wait); /* o retrato 2D fica até o busto desenhar o primeiro quadro (se nunca desenhar, fica o retrato) */
    if (!first) { try { ARD.leaders3d.mood(b.it, 3, 1800); ARD.leaders3d.react(b.it, 'nod'); ARD.leaders3d.react(b.it, 'talk', 1.1); } catch (e) {} } }
  if (!first && !reduced()) { bust.classList.remove('scan'); void bust.offsetWidth; bust.classList.add('scan'); } }
function select(id, first) { if (!st || !RACES.includes(id)) return; const changed = st.sel !== id; st.sel = id;
  document.documentElement.dataset.race = id; document.documentElement.style.removeProperty('--race');
  const info = D.$('sc-info');
  if (first || reduced()) fillInfo(id); else if (changed) { info.classList.add('swap'); clearTimeout(st.swapT); st.swapT = setTimeout(() => { fillInfo(id); requestAnimationFrame(() => info.classList.remove('swap')); }, 190); }
  if (changed || first) showBust(id, first);
  if (ARD.uiFx) try { ARD.uiFx.setRace(id); } catch (e) {}
  clearTimeout(st.preT); st.preT = setTimeout(() => { if (st && st.sel === id && ARD.preloadLoadArt) ARD.preloadLoadArt(id); }, first ? 4000 : 1500); /* 4.3l: a arte grande do carregamento da Raça escolhida já fica no cache */
  for (const m of st.maps) m.draw();
  if (st.cta) st.cta.dataset.race = id;
  queueThumbs(id); }
/* miniaturas 3D das unidades-símbolo (computador): um renderizador pequeno, uma unidade por vez no tempo ocioso */
function queueThumbs(id) { if (!st || !st.use3d || !window.THREE || !ARD.meshes) return; for (const d of (LORE[id] || {}).units || []) if (!st.thumbs[id + '|' + d] && !st.tq.includes(id + '|' + d)) st.tq.push(id + '|' + d); if (!st.tBusy) pump(); }
function pump() { if (!st || !st.tq.length) { if (st) st.tBusy = false; return; } st.tBusy = true; idle(() => { if (!st) return; const key = st.tq.shift(); const [race, def] = key.split('|'); try { const url = renderThumb(race, def); if (url) { st.thumbs[key] = url; if (st.sel === race) { const el = D.$('sc-units').querySelector('[data-def="' + def + '"] .ut'); if (el) el.innerHTML = '<img alt="" src="' + url + '">'; } } } catch (e) { console.warn('[ARD] miniatura ' + key + ': ' + e.message); } pump(); }, 600); }
function renderThumb(race, def) { const THREE = window.THREE, ME = ARD.meshes, ADD = window.THREE_ADDONS || {};
  if (!st.tr) { const cv = document.createElement('canvas'); cv.width = 192; cv.height = 152; const r = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: 'low-power' }); r.setPixelRatio(1); r.setSize(192, 152, false); r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.15;
    const sc = new THREE.Scene(); sc.add(new THREE.HemisphereLight(0xd6e4f5, 0x302a26, 1.3)); const k = new THREE.DirectionalLight(0xfff1dc, 2.3); k.position.set(-3, 6, 4); sc.add(k); const rim = new THREE.DirectionalLight(0xffffff, 2.2); rim.position.set(4, 3, -5); sc.add(rim);
    if (ADD.RoomEnvironment) { const pm = new THREE.PMREMGenerator(r); sc.environment = pm.fromScene(new ADD.RoomEnvironment(), 0.04).texture; sc.environmentIntensity = 0.3; pm.dispose(); }
    st.tr = { r, sc, rim, cam: new THREE.PerspectiveCamera(26, 192 / 152, 0.1, 3000), mat: ME.material({ env: 0.8, key: 'vitrine' }), em: new THREE.MeshBasicMaterial({ vertexColors: true }) }; }
  const T = st.tr; const shade = (ARD.campUI && ARD.campUI.colorFor(race)) || ((ARD.sim.RACE_SHADES || {})[race] || [])[0] || D.RACE_COLORS[race];
  const g = ME.build(def, race, shade, 0); if (!g || !g.main) return null; T.rim.color.set(D.RACE_COLORS[race] || '#ffffff');
  const grp = new THREE.Group(); grp.add(new THREE.Mesh(g.main, T.mat)); if (g.em) grp.add(new THREE.Mesh(g.em, T.em)); grp.rotation.y = 0.62;
  const sz = Math.max(g.width, g.height * 1.25); const d = sz * 2.35; T.cam.position.set(d * 0.66, d * 0.42, d * 0.66); T.cam.lookAt(0, g.height * 0.42, 0);
  T.sc.add(grp); T.r.render(T.sc, T.cam); const url = T.r.domElement.toDataURL(); T.sc.remove(grp); g.main.dispose(); if (g.em) g.em.dispose(); return url; }

// ---------- montagem ----------
function mount(deps) {
  D = deps; const $ = D.$; const prefs = D.prefs || {}; const params = D.params;
  const pick = RACES.includes(prefs.faction) ? prefs.faction : 'vehnar';
  st = { sel: null, busts: {}, thumbs: {}, tq: [], maps: [], use3d: false, cta: null };
  /* fichas */
  const wrap = $('fac-cards'); wrap.innerHTML = '';
  RACES.forEach((id, i) => { const f = ARD.sim.FACTIONS[id]; if (!f) return; const el = document.createElement('label'); el.className = 'fac-card'; el.dataset.id = id; el.style.setProperty('--rc', D.RACE_COLORS[id] || '#FF5E3A');
    const ins = ARD.ART && ARD.ART.insignia && ARD.ART.insignia[id];
    el.innerHTML = `<input type="radio" name="fac" value="${id}" ${pick === id ? 'checked' : ''} aria-label="${esc(f.name)}">${ins ? `<img class="fi" src="${ins}" alt="">` : `<svg class="fi" style="color:${D.RACE_COLORS[id]}" aria-hidden="true"><use href="#em-${id}"/></svg>`}<span class="fn"><b>${esc(f.short)}</b><small>${esc(D.LEADER_NAME[id] || '')}</small></span><span class="fk" aria-hidden="true">${i + 1}</span>`;
    el.querySelector('input').addEventListener('change', () => { select(id); try { if (ARD.audio && ARD.audio.enabled) ARD.audio.sfx('click', 0.5); } catch (e) {} if (D.onRace) try { D.onRace(id); } catch (e) {} });
    wrap.appendChild(el); });
  st.want3d = !!(ARD.leaders3d && !coarse() && params.get('logo') !== 'estatico'); st.use3d = false; /* 4.3k: o 3D liga só depois do load (abaixo): ?autostart, ?bench e missões não pagam nada */
  /* teclas 1–5 escolhem a Raça (fora dos campos de texto) */
  st.onKey = e => { if ($('start').hidden || e.ctrlKey || e.metaKey || e.altKey) return; const tg = e.target; if (tg && /^(INPUT|SELECT|TEXTAREA)$/.test(tg.tagName)) return; if (document.querySelector('.modal:not([hidden])')) return; const n = parseInt(e.key, 10); if (n >= 1 && n <= 5) { const r = wrap.querySelector('input[value="' + RACES[n - 1] + '"]'); if (r && !r.checked) { r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); } } };
  document.addEventListener('keydown', st.onKey);
  /* o busto olha para o ponteiro */
  const stage = document.querySelector('.showcase'); if (stage) stage.addEventListener('pointermove', ev => { const b = st && st.busts[st.sel]; if (!b) return; const r = b.cv.getBoundingClientRect(); ARD.leaders3d.gaze(b.it, (ev.clientX - (r.left + r.width / 2)) / 260, -(ev.clientY - (r.top + r.height * 0.45)) / 200, 900); });
  select(pick, true);
  /* busto 3D e miniaturas: só depois do load da página e da sonda da GPU (o renderizador do leaders3d e o mapa de ambiente
     custam caro na GPU fraca e por software) e só se a tela inicial ainda estiver à vista; até lá fica o retrato 2D */
  const up3d = () => setTimeout(() => { if (!st || G3() || !st.want3d) return; if (!window.THREE) { window.addEventListener('three-ready', up3d, { once: true }); return; } if (!ARD.leaders3d.canUse()) return; st.use3d = true; showBust(st.sel, true); queueThumbs(st.sel); }, 250);
  if (ARD.gpuProbe) ARD.gpuProbe().then(() => { if (!ARD.gpuSoft) up3d(); }); else if (document.readyState === 'complete') up3d(); else window.addEventListener('load', up3d, { once: true }); /* depois da sonda da GPU (main.js); na GPU por software fica o retrato 2D */
  return { selected: () => st && st.sel };
}
/* depois que initStart preencheu os valores: segmentados, mapas e o botão fixo do celular */
function enhance() { if (!st) return; const $ = D.$;
  document.querySelectorAll('select[data-seg]').forEach(segmented);
  document.querySelectorAll('select[data-mapcards]').forEach(s => { const m = mapCards(s); if (m) st.maps.push(m); });
  for (const id of ['opt-opp', 'opt-room']) { const s = $(id); if (s) s.addEventListener('change', () => { for (const m of st.maps) m.draw(); }); }
  /* celular: "Iniciar partida" fixo embaixo enquanto o botão da aba Jogar está fora da tela */
  const btn = $('btn-start'); if (btn && 'IntersectionObserver' in window) { const cta = document.createElement('button'); cta.id = 'st-cta'; cta.className = 'btn primary big'; cta.type = 'button'; cta.hidden = true; cta.textContent = 'Iniciar partida';
    cta.addEventListener('click', () => btn.click()); $('start').appendChild(cta); st.cta = cta; let vis = true;
    const upd = () => { const pane = document.querySelector('.cpane[data-pane=jogar]'); const show = !vis && pane && !pane.hidden && matchMedia('(max-width: 899px)').matches && !$('start').hidden; cta.hidden = !show; if (show) cta.textContent = btn.textContent; };
    st.io = new IntersectionObserver(es => { vis = es[es.length - 1].isIntersecting; upd(); }); st.io.observe(btn); document.querySelectorAll('.ctab').forEach(t => t.addEventListener('click', () => setTimeout(upd, 30))); addEventListener('resize', upd); } }
function stop() { if (!st) return; const s = st; st = null; if (s.onKey) document.removeEventListener('keydown', s.onKey); if (s.io) s.io.disconnect(); if (s.cta) s.cta.hidden = true; if (s.tr) { try { s.tr.r.dispose(); s.tr.r.forceContextLoss(); } catch (e) {} } }
ARD.uiStart = { mount, enhance, stop, LORE, select: id => select(id), info: () => st ? { sel: st.sel, busts: Object.keys(st.busts), thumbs: Object.keys(st.thumbs), use3d: st.use3d } : null };
})(globalThis.ARD = globalThis.ARD || {});
