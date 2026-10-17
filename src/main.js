/* Bootstrap: tela inicial, laço de jogo, HUD, diplomacia, dicas e tela final. */
(function (ARD) {
'use strict';
const S = ARD.sim;
const $ = id => document.getElementById(id);
const AU = ARD.audio;
const fmt = n => Math.floor(n).toLocaleString('pt-BR');
const mmss = t => { t = Math.max(0, Math.floor(t)); return String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0'); };
const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
const RES_ICON = { plasma: '<svg class="ri xs"><use href="#ic-plasma"/></svg>', minerio: '<svg class="ri xs"><use href="#ic-minerio"/></svg>', dados: '<svg class="ri xs"><use href="#ic-dados"/></svg>' }; // 4.2f: ícones desenhados (antes ◆ ▣ ◈)
const RES_NAME = { plasma: 'Plasma', minerio: 'Minério', dados: 'Dados' };
function costStr(cost) { return Object.keys(cost).filter(k => cost[k]).map(k => `<span class="c-${k}">${RES_ICON[k]} ${cost[k]}</span>`).join(' ') || '<span class="muted">grátis</span>'; }

const params = new URLSearchParams(location.search);
const BUILD = '__BUILD__';
const RACE_COLORS = { vehnar: '#FF7733', erevane: '#33FFD0', tessara: '#55E68A', quorith: '#B388FF', vorag: '#E6455A' };
// Líderes (nomes aprovados 2026-10-10) e a expressão-retrato aprovada de cada um (1 sereno · 2 furioso · 3 triunfante)
const LEADER_NAME = { vehnar: 'Barão-Forja', erevane: 'Vesper Ísk', tessara: 'Sylva Oriel', quorith: 'Zayin Coral', vorag: 'Oru Voraz' };
const LEADER_FACE = { vehnar: 3, erevane: 2, tessara: 2, quorith: 2, vorag: 1 };
const VERSION = '4.3e';
const ART = (window.ARD && ARD.ART) || null;
const leaderArt = (fac, mood) => (ART && ART.leader && ART.leader[fac] && ART.leader[fac][(mood || LEADER_FACE[fac] || 1) - 1]) || null;
function gpuName() { try { const c = document.createElement('canvas'); const gl = c.getContext('webgl2') || c.getContext('webgl'); if (!gl) return 'sem WebGL'; const ext = gl.getExtension('WEBGL_debug_renderer_info'); const n = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)); const lose = gl.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext(); return n; } catch (e) { return '?'; } }
let G = null; // game state
ARD.inspect = () => { if (!G || !G.sim) return null; const sim = G.sim; return { tick: sim.tick, time: sim.time, hash: S.hash(sim), human: G.human, waiting: G.waiting, ended: G.ended, mpWait: $('mp-wait') ? $('mp-wait').hidden === false : null, net: G.net ? { state: G.net.state, role: G.net.role, code: G.net.code, desync: G.net.desync, rtt: Math.round(G.net.rtt) } : null, players: sim.players.map(p => ({ id: p.id, name: p.name, faction: p.faction, human: p.human, alive: p.alive, nucleo: !!S.nucleoOf(sim, p.id), units: sim.ents.filter(e => e.alive && e.kind === 'unit' && e.owner === p.id).length })), hashLog: G.hashLog ? Object.assign({}, G.hashLog) : null }; };

function whenThree(cb) {
  if (window.THREE) return cb(true); if (window.__threeFailed) return cb(false);
  let done = false; const t = setTimeout(() => { if (!done) { done = true; window.__threeFailed = true; cb(false); } }, 8000);
  window.addEventListener('three-ready', () => { if (!done) { done = true; clearTimeout(t); cb(true); } }, { once: true });
}
// 4.0f — diagnóstico para o feedback do beta: versão, build, navegador, GPU, qualidade 3D e FPS medido
function diagInfo() { const g = G || {}; const R = g.R || {}; const q = R.quality || {}; const p = g.sim && g.sim.players[g.human || 0]; return { versao: VERSION, build: BUILD, navegador: navigator.userAgent, tela: screen.width + 'x' + screen.height + ' @' + (window.devicePixelRatio || 1), gpu: R.gpu || '?', qualidade: q.name ? q.name + (q.resolved && q.name === 'auto' ? ' → ' + q.resolved : '') : '—', fps: g.fps ? Math.round(g.fps) : null, raca: p ? p.faction : null, semente: g.sim ? g.sim.seed : null, tempo: g.sim ? Math.round(g.sim.time) : null, missao: g.camp ? g.camp.prep.mission.id : null, memoria: navigator.deviceMemory || null, nucleos: navigator.hardwareConcurrency || null, teste_desempenho: benchSummary() }; }
// 4.2a — teste de desempenho: o último resultado fica no aparelho e vai junto no Feedback
function benchLoad() { try { return JSON.parse(localStorage.getItem('ard-bench-last') || 'null'); } catch (e) { return null; } }
function benchSummary() { const b = benchLoad(); return b ? b.fps + ' fps médio, 1% ' + b.p1 + ' fps, 5% ' + b.p5 + ' fps, ' + b.stutters + ' travadas (' + b.quality + ', ' + b.res + ', ' + b.version + ')' : null; }
function feedbackUrl(extra) { const d = diagInfo(); const body = '**O que aconteceu:**\n\n**O que você esperava:**\n\n**Passos para repetir (se for um erro):**\n\n---\n**Diagnóstico automático:**\n' + Object.entries(Object.assign(d, extra || {})).filter(([, v]) => v != null).map(([k, v]) => '- ' + k + ': ' + v).join('\n'); return 'https://github.com/andreyrafael85/aether-rift-dominion/issues/new?labels=feedback&title=' + encodeURIComponent('[Beta ' + VERSION + '] ') + '&body=' + encodeURIComponent(body); }
function loadPrefs() { try { return JSON.parse(localStorage.getItem('ard-beta-prefs') || '{}') || {}; } catch (e) { return {}; } }
function savePrefs(p) { try { localStorage.setItem('ard-beta-prefs', JSON.stringify(p)); } catch (e) {} }

// ---------- start screen ----------
function initStart() {
  const prefs = loadPrefs();
  // 4.0a/4.0c — portais das cinco Raças: cor própria por card e fundo vivo que acompanha a escolha
  const RACE_UI = { vehnar: '#FF7733', erevane: '#33FFD0', tessara: '#55E68A', quorith: '#B388FF', vorag: '#E6455A' };
  let raceColor = RACE_UI[prefs.faction] || '#FF5E3A';
  const setRace = c => { raceColor = c; document.documentElement.style.setProperty('--race', c); };
  const facWrap = $('fac-cards'); facWrap.innerHTML = '';
  for (const id of Object.keys(S.FACTIONS)) {
    const f = S.FACTIONS[id];
    const el = document.createElement('label'); el.className = 'fac-card'; el.dataset.id = id; el.style.setProperty('--rc', RACE_UI[id] || '#FF5E3A');
    el.innerHTML = `<input type="radio" name="fac" value="${id}" ${((prefs.faction || 'vehnar') === id) ? 'checked' : ''}><div class="fac-body"><div class="fac-name">${f.name}</div><div class="fac-tag">${f.tagline}</div><div class="fac-sup"><b>Líder:</b> ${LEADER_NAME[id] || '—'}. <b>Superarma:</b> ${f.superName}. <b>Pirata:</b> ${f.pirateName}.</div></div>${leaderArt(id) ? `<img class="fac-lead" src="${leaderArt(id)}" alt="">` : ''}`;
    if (ART && ART.world && ART.world[id]) el.style.backgroundImage = `linear-gradient(90deg, rgba(20,23,29,.96) 48%, rgba(20,23,29,.55)), url(${ART.world[id]})`;
    el.querySelector('input').addEventListener('change', () => { setRace(RACE_UI[id] || '#FF5E3A'); if (ARD.campUI) try { ARD.campUI.refreshMini(); } catch (e) {} });
    facWrap.appendChild(el);
  }
  setRace(raceColor);
  // 4.1e — líderes vivos nos cartões: cada busto olha para o ponteiro, pisca e respira; ao escolher a Raça, o líder acena
  const cardHeads = {};
  const mountCardHeads = () => { if (!ARD.leaders3d || matchMedia('(pointer: coarse)').matches || params.get('logo') === 'estatico' || !ARD.leaders3d.canUse() || G || ($('start') && $('start').hidden)) return; /* 4.3d: partida já começou (início automático): os bustos dos cartões não sobem por baixo do HUD */
    for (const card of facWrap.querySelectorAll('.fac-card')) { const id = card.dataset.id; const img = card.querySelector('img.fac-lead'); if (!img || cardHeads[id]) continue;
      const cv = document.createElement('canvas'); cv.className = 'fac-lead fac-lead3d'; cv.width = 168; cv.height = 168; cv.setAttribute('aria-hidden', 'true');
      const sel = (document.querySelector('input[name=fac]:checked') || {}).value === id;
      const it = ARD.leaders3d.mount(cv, id, { framing: 'card', fps: sel ? 24 : 14, mood: 1, yaw: 0.18 }); if (!it) return;
      img.after(cv); img.hidden = true; cardHeads[id] = it;
      card.addEventListener('pointermove', ev => { const r = cv.getBoundingClientRect(); ARD.leaders3d.gaze(it, (ev.clientX - (r.left + r.width / 2)) / 160, -(ev.clientY - (r.top + r.height / 2)) / 120, 900); });
      card.addEventListener('pointerenter', () => { it.fps = 24; });
      card.addEventListener('pointerleave', () => { it.fps = (document.querySelector('input[name=fac]:checked') || {}).value === id ? 24 : 14; });
      card.querySelector('input').addEventListener('change', () => { for (const k in cardHeads) cardHeads[k].fps = k === id ? 24 : 14; ARD.leaders3d.mood(it, 3, 1800); ARD.leaders3d.react(it, 'nod'); ARD.leaders3d.react(it, 'talk', 1.1); }); } };
  if (window.THREE) setTimeout(mountCardHeads, 400); else window.addEventListener('three-ready', () => setTimeout(mountCardHeads, 400), { once: true });
  if (ART && ART.logo) for (const id of ['logo-img', 'load-logo', 'foot-logo']) { const el = $(id); if (el) { el.src = ART.logo; el.hidden = false; } }
  // 4.0d — logo vivo: a mesma Final 2 em 3D com a órbita girando (desktop; celular e movimento reduzido ficam com a imagem)
  if (ARD.logo3d && $('logo-img')) { const tryLogo = () => { const im = $('logo-img'); if (im && !im.hidden && !(document.getElementById('start') || {}).hidden) ARD.logo3d.mount(im); }; if (window.THREE) setTimeout(tryLogo, 300); else window.addEventListener('three-ready', () => setTimeout(tryLogo, 300), { once: true }); }
  if (ART && ART.hero) { // placeholder leve embutido, depois o hero em alta (assets/hero-belt.jpg, 2560×1280) quando carregar
    const st = $('start'); const veil = 'linear-gradient(180deg, rgba(13,15,19,.35), rgba(13,15,19,.82) 55%, rgba(13,15,19,.97))';
    st.style.backgroundImage = `${veil}, url(${ART.hero})`; st.style.backgroundSize = 'cover'; st.style.backgroundPosition = 'center top'; st.style.backgroundAttachment = 'fixed';
    const hi = new Image(); hi.onload = () => { st.style.backgroundImage = `${veil}, url(${hi.src})`; }; hi.onerror = () => { hi.onerror = null; hi.src = 'assets/hero-belt.jpg'; }; hi.src = 'assets/hero-belt.webp';
  }
  // fundo vivo: estrelas e o brilho da Raça escolhida (respeita prefers-reduced-motion; para ao entrar em jogo)
  const bgfx = $('bgfx');
  if (bgfx) {
    const bctx = bgfx.getContext('2d'); const stars = [];
    for (let i = 0; i < 140; i++) stars.push({ x: Math.random(), y: Math.random(), r: Math.random() * 1.4 + 0.4, ph: Math.random() * Math.PI * 2 });
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches; const t0 = performance.now();
    const drawBg = () => {
      if ($('start').hidden) return;
      const w = bgfx.clientWidth, h = bgfx.clientHeight; if (!w || !h) { if (!reduced) requestAnimationFrame(drawBg); return; }
      if (bgfx.width !== w || bgfx.height !== h) { bgfx.width = w; bgfx.height = h; }
      const t = (performance.now() - t0) / 1000; const c = bctx; c.clearRect(0, 0, w, h);
      const g1 = c.createRadialGradient(w * 0.72, h * 0.18, 0, w * 0.72, h * 0.18, Math.max(w, h) * 0.6);
      g1.addColorStop(0, raceColor + '3a'); g1.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g1; c.fillRect(0, 0, w, h);
      c.fillStyle = '#fff';
      for (const st of stars) { const tw = reduced ? 0.55 : 0.3 + 0.7 * Math.abs(Math.sin(t * 0.5 + st.ph)); c.globalAlpha = 0.26 * tw; const x = (st.x + (reduced ? 0 : t * 0.003 * st.r)) % 1; c.fillRect(x * w, st.y * h, st.r, st.r); }
      c.globalAlpha = 1;
      if (!reduced) requestAnimationFrame(drawBg);
    };
    drawBg(); if (reduced) window.addEventListener('resize', drawBg);
  }
  // rodapé: Termos, Privacidade e atalho do tutorial
  const wireModal = (btn, modal) => { const b = $(btn), m = $(modal); if (!b || !m) return; b.addEventListener('click', () => { m.hidden = false; }); m.querySelectorAll('[data-close]').forEach(x => x.addEventListener('click', () => { m.hidden = true; })); };
  wireModal('foot-termos', 'termos'); wireModal('foot-priv', 'priv');
  // 4.0f — PWA: service worker (solo offline), botão Instalar, estado da rede e feedback com diagnóstico
  try { if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost') && !/claude\.ai|claudeusercontent|anthropic/.test(location.hostname)) navigator.serviceWorker.register('sw.js').catch(e => console.warn('[ARD] service worker:', e.message)); } catch (e) {}
  { let deferred = null; window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; $('btn-install').hidden = false; }); $('btn-install').addEventListener('click', async () => { if (!deferred) return; deferred.prompt(); try { await deferred.userChoice; } catch (e) {} deferred = null; $('btn-install').hidden = true; }); }
  const netState = () => { const el = $('net-state'); if (el) el.textContent = navigator.onLine ? '' : 'Sem internet: campanha e partidas solo funcionam; o multiplayer precisa de rede.'; }; window.addEventListener('online', netState); window.addEventListener('offline', netState); netState();
  { const fb = $('foot-feedback'); if (fb) fb.href = feedbackUrl(null); const cf = $('cfg-feedback'); if (cf) cf.href = feedbackUrl(null); }
  // 4.1b — painel de comando com abas por modo de jogo (a aba escolhida fica lembrada)
  const showTab = (tab, save) => { const tabs = document.querySelectorAll('.ctab'); if (!tabs.length) return; if (![...tabs].some(t => t.dataset.tab === tab)) tab = 'jogar';
    tabs.forEach(t => { const on = t.dataset.tab === tab; t.classList.toggle('on', on); t.setAttribute('aria-selected', on ? 'true' : 'false'); });
    document.querySelectorAll('.cpane').forEach(pn => { pn.hidden = pn.dataset.pane !== tab; }); if (save) savePrefs(Object.assign(loadPrefs() || {}, { tab })); if (tab === 'campanha' && ARD.campUI) try { ARD.campUI.refreshMini(); } catch (e) {} };
  document.querySelectorAll('.ctab').forEach(t => t.addEventListener('click', () => showTab(t.dataset.tab, true)));
  showTab(params.get('aba') || (params.get('campanha') ? 'campanha' : prefs.tab) || 'jogar', false);
  { const pb = loadPrefs(); $('opt-bateria').checked = !!pb.bateria; $('opt-bateria').addEventListener('change', () => savePrefs(Object.assign(loadPrefs() || {}, { bateria: $('opt-bateria').checked }))); }
  { const pb = loadPrefs() || {}; const oc = $('opt-cine'); if (oc) { oc.checked = pb.cine !== false; oc.addEventListener('change', () => { savePrefs(Object.assign(loadPrefs() || {}, { cine: oc.checked })); if (G && G.R) G.R.cine = oc.checked; }); } } // 4.3b: câmera de cinema
  // 4.0e — campanha, Hangar e progresso do Comandante
  if (ARD.campUI && ARD.campaign && ARD.progress) { try { ARD.campUI.init({ $, leaderArt, LEADER_NAME, RACE_COLORS, LEADER_FACE, startGame: cfg => { savePrefs(Object.assign(loadPrefs() || {}, { gfx: cfg.gfx, quality: cfg.quality, clima: cfg.clima, name: cfg.name })); startGame(cfg); }, selectedRace: () => (document.querySelector('input[name=fac]:checked') || {}).value || 'vehnar' }); if (params.get('campanha')) ARD.campUI.openCampaign(); } catch (e) { console.warn('[ARD] campanha indisponível:', e); } }
  // 4.1c — retomada: cartão "Partida interrompida", listas de salvamentos e volta automática depois de uma queda curta (< 30 s)
  const RESUME_AUTO_S = 30;
  async function resumeFrom(slot, auto) {
    let rec = null; try { rec = await ARD.saves.get(slot); } catch (e) { console.warn('[ARD] retomada: leitura falhou', e); }
    if (!rec || !rec.data || !rec.data.sim) { refreshSaved(); return false; }
    const d = rec.data; const cfg = Object.assign({}, d.cfg, { players: d.simCfg.players, seed: d.simCfg.seed, minutes: d.simCfg.minutes || d.cfg.minutes, gfx: $('opt-gfx').value, quality: $('opt-quality').value, clima: d.cfg.clima || $('opt-clima').value, resume: d, resumeAt: rec.meta.savedAt, resumeAuto: auto ? Math.max(1, Math.round((Date.now() - rec.meta.savedAt) / 1000)) : 0 });
    if (d.camp && ARD.campaign) { try { cfg.campaign = ARD.campaign.prepare(d.camp.id, d.camp.opts); cfg.campArgs = d.camp; } catch (e) { console.warn('[ARD] retomada: missão indisponível', e); return false; } }
    try { startGame(cfg); return true; } catch (e) { console.error('[ARD] retomada falhou:', e); alert('Não foi possível retomar esta partida (' + e.message + '). Ela continua salva; envie o feedback.'); location.reload(); return false; }
  }
  function refreshSaved() {
    if (!ARD.saves) return;
    ARD.saves.list().then(list => {
      const auto = list.find(m => m.slot === 'auto'); const card = $('resume-card');
      if (card) { if (auto) { $('resume-title').textContent = auto.title; $('resume-sub').textContent = auto.sub + ' · ' + (auto.parked ? 'pausada ' : 'interrompida ') + ARD.saves.ago(auto.savedAt) + (auto.version !== VERSION ? ' · salva na versão ' + auto.version : ''); card.hidden = false; } else card.hidden = true; }
      for (const [id, kind] of [['saved-solo', 'solo'], ['saved-camp', 'campanha']]) { const el = $(id); if (!el) continue; const rows = list.filter(m => m.slot !== 'auto' && m.kind === kind); el.hidden = !rows.length;
        el.innerHTML = rows.length ? '<div class="sh">Partidas salvas</div>' + rows.map(m => `<div class="svrow"><div class="sv-t">${esc(m.title)}<small>${esc(m.sub)} · espaço ${m.slot.slice(1)} · ${ARD.saves.ago(m.savedAt)}</small></div><button class="btn" data-load="${m.slot}">Carregar</button><button class="btn ghost" data-del="${m.slot}" aria-label="Apagar">🗑</button></div>`).join('') : '';
        el.querySelectorAll('[data-load]').forEach(b => b.onclick = () => resumeFrom(b.dataset.load, false));
        el.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { if (b.dataset.armed) ARD.saves.del(b.dataset.del).then(refreshSaved); else { b.dataset.armed = '1'; b.textContent = 'Apagar?'; setTimeout(() => { if (b.isConnected) { delete b.dataset.armed; b.textContent = '🗑'; } }, 3000); } }); }
    }).catch(e => console.warn('[ARD] salvamentos indisponíveis:', e));
  }
  if ($('btn-resume')) { $('btn-resume').addEventListener('click', () => resumeFrom('auto', false)); $('btn-resume-drop').addEventListener('click', e => { const b = e.currentTarget; if (b.dataset.armed) ARD.saves.del('auto').then(refreshSaved); else { b.dataset.armed = '1'; b.textContent = 'Descartar mesmo?'; setTimeout(() => { delete b.dataset.armed; b.textContent = 'Descartar'; }, 3000); } }); }
  // 4.1c — convidado que recarregou a página (queda de energia, aba fechada) volta sozinho à sala em até 2 minutos
  function rejoinAfterReload(ms) {
    const card = $('resume-card'); const N = ARD.net.create(); let done = false; const t0 = Date.now(); window.__rejoining = true; // 4.2a: o teste de desempenho espera
    const show = (t, sub, canCancel) => { if (!card) return; card.hidden = false; $('resume-title').textContent = t; $('resume-sub').textContent = sub; $('btn-resume').hidden = true; $('btn-resume-drop').textContent = canCancel ? 'Cancelar' : 'Fechar'; };
    show('Voltando à sala ' + ms.code, 'Sua partida multiplayer caiu ' + ARD.saves.ago(ms.at) + '. Reconectando…', true);
    $('btn-resume-drop').onclick = () => { done = true; window.__rejoining = false; mpSession.clear(); try { N.close(); } catch (e) {} card.hidden = true; $('btn-resume').hidden = false; $('btn-resume-drop').onclick = null; $('btn-resume-drop').textContent = 'Descartar'; refreshSaved(); };
    N.on('state', st => { if (done) return; done = true; startGame(Object.assign({}, ms.cfg, { gfx: $('opt-gfx').value, quality: $('opt-quality').value, clima: $('opt-clima').value, resume: { sim: st.snap, ais: [] } }), { net: N, myId: ms.id }); });
    N.on('rejoin-no', d => { done = true; window.__rejoining = false; mpSession.clear(); show('Não deu para voltar à sala ' + ms.code, 'O anfitrião recusou: ' + (d.why || '?') + '.', false); });
    N.on('error', () => {}); N.on('close', () => {}); N.on('rejoin-fail', () => {});
    const attempt = first => { if (done) return; if (Date.now() - t0 > 120000) { done = true; window.__rejoining = false; mpSession.clear(); show('Não deu para voltar à sala ' + ms.code, 'A sala não respondeu em 2 minutos.', false); return; }
      if (first || N.state !== 'connected') { N.rejoin(first ? { code: ms.code, id: ms.id, token: ms.token, me: Object.assign({}, ms.me, { build: BUILD }) } : null); $('resume-sub').textContent = 'Reconectando… tentativa ' + Math.ceil((Date.now() - t0 + 1) / 6000) + (navigator.onLine ? '' : ' (sem internet)'); }
      setTimeout(() => attempt(false), 6000); };
    attempt(true);
  }
  const msess = mpSession.load();
  if (msess && msess.token && Date.now() - msess.at < 120000 && !params.get('autostart') && !params.get('novo') && !params.get('bench')) rejoinAfterReload(msess);
  else if (ARD.saves && !params.get('autostart') && !params.get('missao') && !params.get('novo') && !params.get('campanha') && !params.get('bench'))
    ARD.saves.meta('auto').then(m => { if (m && !m.parked && (params.get('retomar') || Date.now() - m.savedAt < RESUME_AUTO_S * 1000)) resumeFrom('auto', true).then(ok => { if (!ok) refreshSaved(); }); else refreshSaved(); }).catch(() => refreshSaved());
  else refreshSaved();
  if (msess && Date.now() - msess.at >= 120000) mpSession.clear();
  // a ajuda tambem precisa fechar na tela inicial (antes só era ligada dentro da partida); X e Esc fecham qualquer janela
  document.querySelectorAll('#help [data-close]').forEach(b => b.addEventListener('click', () => { $('help').hidden = true; }));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') for (const id of ['help', 'termos', 'priv', 'campaign', 'briefing', 'hangar']) { const m = $(id); if (m && !m.hidden) { m.hidden = true; e.stopPropagation(); } } }, true);
  if ($('foot-help')) $('foot-help').addEventListener('click', () => toggleHelp(true));
  $('opt-name').value = prefs.name || 'Comandante';
  $('opt-opp').value = prefs.opp || '2';
  $('opt-diff').value = prefs.diff || 'normal';
  $('opt-seed').value = params.get('seed') || String(Math.floor(Math.random() * 90000) + 1000);
  $('opt-gfx').value = prefs.gfx || '3d'; $('opt-quality').value = prefs.quality || 'auto';
  if ($('opt-clima')) $('opt-clima').value = prefs.clima || 'auto';
  // multiplayer P2P por código de sala: 2 a 4 jogadores humanos, sem IAs; o anfitrião é o relé do lockstep
  let lobby = null;
  const mpStatus = t => { $('mp-status').textContent = t; };
  const myInfo = () => { const faction = (document.querySelector('input[name=fac]:checked') || {}).value || 'vehnar'; return { name: $('opt-name').value.trim().slice(0, 18) || 'Comandante', faction, color: ARD.campUI ? ARD.campUI.colorFor(faction) : null, build: BUILD }; };
  const facName = f => (S.FACTIONS[f] && S.FACTIONS[f].short) || f;
  function renderLobby(players, size) {
    const el = $('mp-players'); el.innerHTML = ''; const me = lobby ? lobby.me : null;
    players.forEach(p => { const d = document.createElement('div'); d.textContent = (p.id === 0 ? '★ ' : '• ') + p.name + ' (' + facName(p.faction) + ')' + (p.id === 0 ? ' anfitrião' : '') + (me && p.name === me.name && (lobby.role === 'host' ? p.id === 0 : p.id !== 0) ? ' — você' : ''); el.appendChild(d); });
    for (let i = players.length; i < size; i++) { const d = document.createElement('div'); d.className = 'muted'; d.textContent = '• vaga livre'; el.appendChild(d); }
    if (lobby && lobby.warn) { const d = document.createElement('div'); d.className = 'warn'; d.textContent = '⚠ ' + lobby.warn; el.appendChild(d); }
  }
  function setStartButton() { // 4.1b: Iniciar partida (aba Jogar) é só solo; a sala tem o próprio botão na aba Multiplayer
    const b = $('btn-start'), m = $('btn-mp-start');
    $('opt-opp').disabled = !!lobby; $('opt-diff').disabled = !!lobby;
    b.disabled = false; b.textContent = lobby ? 'Você está numa sala · ver Multiplayer' : 'Iniciar partida';
    if (!lobby) { const typed = $('opt-code').value.trim(); m.hidden = typed.length < 4; m.disabled = false; m.textContent = 'Entrar na sala ' + typed.toUpperCase(); return; }
    m.hidden = false;
    if (lobby.role === 'host') { const n = lobby.N.roster().length; m.disabled = n < 2 || lobby.started; m.textContent = n < 2 ? 'Aguardando jogadores…' : 'Iniciar partida da sala (' + n + '/' + lobby.size + ')'; }
    else { m.disabled = true; m.textContent = 'Aguardando o anfitrião…'; }
  }
  function leaveLobby() { if (lobby) { if (lobby.timer) clearInterval(lobby.timer); if (lobby.role === 'host') $('opt-code').value = ''; try { lobby.N.close(); } catch (e) {} lobby = null; } $('mp-players').innerHTML = ''; setStartButton(); }
  function startHosted() {
    if (!lobby || lobby.role !== 'host' || lobby.started) return;
    const N = lobby.N; N.me = myInfo(); const roster = N.roster();
    if (roster.length < 2) { mpStatus('Aguarde pelo menos um jogador entrar na sala.'); return; }
    lobby.started = true; setStartButton();
    const players = roster.map(r => ({ name: r.name, faction: r.faction, human: true, color: r.color || undefined }));
    const cfg = { players, seed: parseInt($('opt-seed').value, 10) || 1, name: players[0].name, faction: players[0].faction, opp: '0', diff: 'normal' };
    N.start(cfg);
    setTimeout(() => startGame(Object.assign({}, cfg, { gfx: $('opt-gfx').value, quality: $('opt-quality').value, clima: $('opt-clima').value }), { net: N, myId: 0 }), 150);
  }
  $('btn-host').addEventListener('click', () => {
    if (!navigator.onLine) { mpStatus('Sem internet: o multiplayer precisa de rede. A campanha e as partidas solo funcionam offline.'); return; }
    if (!window.Peer) { mpStatus('PeerJS não carregou neste navegador.'); return; }
    if (lobby) { mpStatus('Você já está na sala ' + (lobby.code || '…') + '. Recarregue a página para sair dela.'); return; }
    const size = parseInt($('opt-room').value, 10) || 2; const me = myInfo();
    const N = ARD.net.create(); lobby = { N, role: 'host', size, code: null, started: false, me };
    mpStatus('Criando sala…'); setStartButton();
    N.on('error', e => mpStatus('Erro de rede: ' + e.message));
    N.on('warn', w => { if (lobby) { lobby.warn = w.message; renderLobby(N.roster(), lobby.size); } });
    N.on('lobby', d => { renderLobby(d.players, d.size); setStartButton(); if (lobby && !lobby.started) { if (d.players.length >= d.size) { mpStatus('Sala completa. Iniciando…'); setTimeout(startHosted, 500); } else mpStatus('Sala ' + lobby.code + ': ' + d.players.length + '/' + d.size + ' jogadores. A partida começa quando a sala encher, ou toque em Iniciar partida da sala com 2 ou mais.'); } });
    N.host({ size, me, code: (loadPrefs() || {}).room }, code => { lobby.code = code; $('opt-code').value = code; savePrefs(Object.assign(loadPrefs() || {}, { room: code })); renderLobby(N.roster(), size); mpStatus('Sala ' + code + ' criada para ' + size + ' jogadores. Envie o código aos amigos e aguarde a entrada deles.'); });
  });
  function joinRoom(code, attempt) {
    attempt = attempt || 0;
    if (!navigator.onLine) { mpStatus('Sem internet: o multiplayer precisa de rede.'); return; }
    if (!window.Peer) { mpStatus('PeerJS não carregou neste navegador.'); return; }
    if (lobby) { mpStatus('Você já está na sala ' + (lobby.code || '…') + '. Recarregue a página para sair dela.'); return; }
    code = String(code || '').trim().toUpperCase(); if (code.length < 4) { mpStatus('Digite o código da sala.'); return; }
    const me = myInfo(); const N = ARD.net.create(); lobby = { N, role: 'guest', code, started: false, size: 2, me, t0: Date.now(), timer: null, warn: null };
    mpStatus('Conectando à sala ' + code + '…'); setStartButton();
    lobby.timer = setInterval(() => { if (!lobby || lobby.N !== N || N.state !== 'joining') return; const sec = Math.round((Date.now() - lobby.t0) / 1000); mpStatus(sec < 20 ? 'Conectando à sala ' + code + '… (' + sec + ' s)' : 'Sem resposta da sala ' + code + ' há ' + sec + ' s. Confira o código e se o anfitrião está com a sala aberta; continuamos tentando.'); }, 1000);
    N.on('error', e => {
      if (lobby && lobby.N === N && !lobby.started && N.state !== 'connected' && /não encontrada/.test(e.message) && attempt < 20) { leaveLobby(); mpStatus('Sala ' + code + ' ainda não está aberta. Nova tentativa em 3 s… (' + (attempt + 1) + '/20)'); setTimeout(() => { if (!lobby) joinRoom(code, attempt + 1); }, 3000); return; }
      mpStatus('Erro de rede: ' + e.message); if (lobby && lobby.N === N && !lobby.started && N.state !== 'connected') leaveLobby();
    });
    N.on('warn', w => { if (lobby && lobby.N === N) { lobby.warn = w.message; renderLobby(N.players || [], lobby.size); } });
    N.on('open', () => mpStatus('Conectado à sala ' + code + '. Aguardando o anfitrião…'));
    N.on('full', () => { mpStatus('A sala ' + code + ' está cheia ou a partida já começou.'); leaveLobby(); });
    N.on('close', () => { if (!lobby || lobby.N !== N || lobby.started) return; mpStatus('O anfitrião saiu da sala ' + code + '.'); leaveLobby(); });
    N.on('lobby', d => { if (!lobby || lobby.N !== N) return; lobby.size = d.size; renderLobby(d.players, d.size); mpStatus('Na sala ' + code + ' como ' + me.name + ' (' + d.players.length + '/' + d.size + '). A partida começa quando o anfitrião iniciar.'); });
    N.on('start', d => { if (!lobby || lobby.N !== N) return; lobby.started = true; if (lobby.timer) clearInterval(lobby.timer); mpSession.save({ code: N.code, id: d.you, token: d.token || null, cfg: d.cfg, me }); startGame(Object.assign({}, d.cfg, { gfx: $('opt-gfx').value, quality: $('opt-quality').value, clima: $('opt-clima').value }), { net: N, myId: d.you }); });
    N.join(code, me);
  }
  $('btn-join').addEventListener('click', () => joinRoom($('opt-code').value));
  $('opt-code').addEventListener('input', () => { if (!lobby) setStartButton(); });
  $('opt-code').addEventListener('keydown', e => { if (e.key === 'Enter' && !lobby) { e.preventDefault(); joinRoom($('opt-code').value); } });
  $('btn-mp-start').addEventListener('click', () => {
    if (lobby) { if (lobby.role === 'host') startHosted(); else mpStatus('Aguarde o anfitrião iniciar a partida.'); return; }
    const typed = $('opt-code').value.trim(); if (typed.length >= 4) joinRoom(typed);
  });
  $('btn-start').addEventListener('click', () => {
    if (lobby) { showTab('multi', true); return; } // numa sala, o início é pela aba Multiplayer
    const faction = (document.querySelector('input[name=fac]:checked') || {}).value || 'vehnar';
    const cfg = { name: $('opt-name').value.trim().slice(0, 18) || 'Comandante', faction, opp: $('opt-opp').value, diff: $('opt-diff').value, seed: parseInt($('opt-seed').value, 10) || 1, gfx: $('opt-gfx').value, quality: $('opt-quality').value, clima: $('opt-clima').value };
    savePrefs(Object.assign(loadPrefs() || {}, cfg)); startGame(cfg);
  });
  $('btn-help-start').addEventListener('click', () => toggleHelp(true));
  { const bb = $('btn-bench'); if (bb) { const show = () => { const b = benchLoad(); $('bench-last').textContent = b ? 'Último teste: ' + b.fps + ' fps médio · 1% ' + b.p1 + ' fps · qualidade ' + b.quality + ' · ' + new Date(b.at).toLocaleDateString('pt-BR') : 'Ainda sem teste neste aparelho.'; }; show();
    bb.addEventListener('click', () => { if (lobby || window.__rejoining) { showTab('multi', true); mpStatus(lobby ? 'Saia da sala multiplayer (recarregue a página) antes de testar o desempenho.' : 'Aguarde a volta à sala multiplayer terminar antes de testar o desempenho.'); return; } startGame({ name: 'Teste', faction: (document.querySelector('input[name=fac]:checked') || {}).value || 'vehnar', opp: '1', diff: 'normal', seed: 4242, gfx: '3d', quality: $('opt-quality').value, clima: 'auto', bench: true }); }); } }
  if (params.get('bench')) { startGame({ name: 'Teste', faction: params.get('faction') || 'vehnar', opp: '1', diff: 'normal', seed: 4242, gfx: params.get('r') === '2d' ? '2d' : '3d', quality: params.get('q') || $('opt-quality').value, clima: params.get('clima') || 'auto', bench: true }); }
  else if (params.get('autostart')) { startGame({ name: 'Teste', faction: params.get('faction') || 'erevane', opp: params.get('opp') || '2', diff: params.get('diff') || 'normal', seed: parseInt(params.get('seed') || '5', 10), gfx: params.get('r') === '2d' ? '2d' : '3d' }); }
}

// 4.1c — sessão multiplayer do convidado: código, lugar e ficha para voltar à sala depois de recarregar a página
const mpSession = {
  KEY: 'ard-mp-session',
  save(o) { try { localStorage.setItem(this.KEY, JSON.stringify(Object.assign({}, o, { at: Date.now() }))); } catch (e) {} },
  load() { try { return JSON.parse(localStorage.getItem(this.KEY) || 'null'); } catch (e) { return null; } },
  touch() { const o = this.load(); if (o) this.save(o); },
  clear() { try { localStorage.removeItem(this.KEY); } catch (e) {} },
};
// 4.2g — volta à tela inicial sem os parâmetros de lançamento (?missao&iniciar=1 dos botões do fim de missão, ?autostart, ?bench): um reload os relançaria
function goStart() { const q = new URLSearchParams(location.search); for (const k of ['missao', 'dif', 'raca', 'iniciar', 'campanha', 'autostart', 'bench', 'retomar']) q.delete(k); const s = q.toString(); location.replace(location.pathname + (s ? '?' + s : '')); }
const within = (p, ms) => Promise.race([p, new Promise(r => setTimeout(r, ms))]); // 4.2g: sair nunca fica preso esperando o armazenamento
// ---------- game ----------
function startGame(cfg, netCtx) {
  if (ARD.logo3d) ARD.logo3d.stop(); // libera o contexto WebGL do logo vivo antes da partida
  if (ARD.leaders3d) ARD.leaders3d.stopAll(); // 4.1e: bustos dos cartões
  if (!cfg.bench) document.body.classList.remove('bench'); // 4.2a
  const want3dEarly = (cfg.gfx || '3d') === '3d' && params.get('r') !== '2d';
  if (want3dEarly && !window.THREE && !window.__threeFailed) { $('start').hidden = true; $('game').hidden = false; $('loading').hidden = false; $('load-bar').style.width = '5%'; whenThree(() => startGame(cfg, netCtx)); return; }
  const net = netCtx ? netCtx.net : null;
  const players = cfg.players ? cfg.players.map(p => Object.assign({}, p)) : [{ name: cfg.name, faction: cfg.faction, human: true }];
  const facs = ['vehnar', 'erevane'];
  const aiNames = { vehnar: ['Fundição Kessari', 'Consórcio Oryn', 'Estaleiro Vey'], erevane: ['Clã Sombrio', 'Náufragos de Ísk', 'Corsários da Faixa'], tessara: ['Linhagem Oriel', 'Ordem do Molde', 'Enxerto Vassi'], quorith: ['Coro de Zayin', 'Acorde Sétimo', 'Silêncio de Quor'], vorag: ['Prole Velk', 'Ninhada Cega', 'Fome de Oru'] };
  const facsAll = Object.keys(S.FACTIONS).filter(f => f !== cfg.faction).concat([cfg.faction]);
  if (!cfg.players) for (let i = 0; i < parseInt(cfg.opp, 10); i++) { const f = facsAll[i % facsAll.length]; players.push({ name: aiNames[f][i % 3], faction: f, difficulty: cfg.diff }); }
  if (!netCtx && !cfg.campaign && ARD.campUI) ARD.campUI.applyColor(players); // tom da Raça escolhido no Hangar (solo)
  const sim = S.createSim({ seed: cfg.seed, players, minutes: cfg.minutes || 25, noVeins: !!cfg.bench || !!(cfg.campaign && cfg.campaign.cfg && cfg.campaign.cfg.noVeins) }); // 4.2h: sem veios no prólogo e no teste de desempenho
  if (cfg.resume) S.restore(sim, cfg.resume.sim); // 4.1c: retomada a partir do salvamento (estado exato)
  const human = netCtx ? netCtx.myId : 0;
  const canvas = $('world'), mini = $('minimap'), overlay = $('overlay');
  $('start').hidden = true; $('game').hidden = false; $('end').hidden = true;
  let R = null; const want3d = (cfg.gfx || '3d') === '3d' && params.get('r') !== '2d';
  if (want3d && window.THREE) { try { R = ARD.render3d.create(canvas, overlay, mini); } catch (err) { console.warn('3D indisponível, usando 2D:', err); R = null; } }
  if (!R) { R = ARD.render.create(canvas, mini); overlay.hidden = true; if (want3d) setTimeout(() => notice('3D indisponível neste navegador; usando o modo 2D'), 1200); }
  if (params.get('ssaoout')) R.ssaoOut = parseInt(params.get('ssaoout'), 10);
  if (params.get('testblack')) R.testBlack = true; R.debug = !!params.get('debug');
  if (R.setQuality) R.setQuality(params.get('q') || cfg.quality || 'auto', { msaa: params.has('msaa') ? params.get('msaa') === '1' : null, ssao: params.has('ssao') ? params.get('ssao') === '1' : null, shadowMap: params.get('sm') ? parseInt(params.get('sm'), 10) : null, post: params.has('post') ? params.get('post') === '1' : null });
  if (R.setClimate) R.setClimate(params.get('clima') || cfg.clima || 'auto');
  if (R.is3d) R.onDegrade = (what, reason) => { if (what) banner('Qualidade 3D reduzida', what + ' desativada: ' + reason + '. Se continuar escuro, escolha outra qualidade na tela inicial e envie o feedback.', 'warn'); else banner('Renderização 3D falhou', 'Volte à tela inicial e escolha Gráficos: 2D. Exporte o resultado e envie o feedback.', 'danger'); };
  // protótipo 4.0a: o líder da Raça em "chamada" no canto do HUD (retrato 2.5D renderizado na hora pelo motor voxel)
  try { const fac = sim.players[human].faction; const L = $('leader');
    if (L) { const art = leaderArt(fac); if (art) { $('leader-img').src = art; $('leader-img').className = 'lport'; } else if (ARD.leaders && ARD.leaders[fac]) { const sp = ARD.vox.renderSprite(ARD.leaders[fac](), 0.62, 3, {}); $('leader-img').src = sp.canvas.toDataURL(); $('leader-img').className = 'lvox'; }
      $('leader-name').textContent = LEADER_NAME[fac] || ('Líder ' + (S.FACTIONS[fac].short || fac)); $('leader-sub').textContent = '● em chamada · ' + (S.FACTIONS[fac].short || fac); L.style.setProperty('--pc', RACE_COLORS[fac] || '#FF5E3A');
      if (ART && ART.insignia && ART.insignia[fac]) { $('leader-badge').src = ART.insignia[fac]; $('leader-badge').hidden = false; }
      L.hidden = false; G && (G.leaderFac = fac);
      if (ARD.leaders3d && R.is3d && !(R.quality && R.quality.resolved === 'baixa') && !(matchMedia('(pointer: coarse)').matches || params.get('touch')) && ARD.leaders3d.canUse()) { /* 4.1e: só com o 3D ligado e acima da qualidade Baixa */ const fr = L.querySelector('.lframe'); const cv = document.createElement('canvas'); cv.id = 'leader-cv'; cv.width = 236; cv.height = 236; const it = ARD.leaders3d.mount(cv, fac, { framing: 'hud', fps: 24, mood: 1, yaw: 0.2 }); if (it) { fr.insertBefore(cv, fr.firstChild); $('leader-img').hidden = true; window.__lead3d = it; } } }
    if (ART && ART.world && ART.world[fac]) { $('loading').style.backgroundImage = `linear-gradient(rgba(13,15,19,.55), rgba(13,15,19,.88)), url(${ART.world[fac]})`; $('loading').style.backgroundSize = 'cover'; $('loading').style.backgroundPosition = 'center'; }
    if (leaderArt(fac)) { $('load-leader').src = leaderArt(fac); $('load-leader').hidden = false; }
  } catch (e) { console.warn('[ARD] retrato do líder indisponível:', e); }
  R.resize();
  const nuc = S.nucleoOf(sim, human);
  if (params.get('demo') === 'birth' && !net) { sim.players[human].res.minerio += 1500; sim.players[human].res.plasma += 600; ['reator', 'refinaria', 'quartel'].forEach((d, i) => S.enqueue(sim, { t: 'build', p: human, def: d, x: nuc.x + 75 + (i % 2) * 95, y: nuc.y - 80 + i * 80, ang: 0 })); } // depuração: três canteiros para ver o nascimento
  const isTouch = matchMedia('(pointer: coarse)').matches || !!params.get('touch');
  const view = { cam: { x: nuc.x, y: nuc.y, zoom: isTouch ? 0.7 : 1.0, yaw: Math.PI / 4, pitch: 0.95, pitchT: 0.95 }, sel: new Set(), hover: null, ghost: null, box: null, human, memory: new Map(), marker: null, mode: 'normal', lastAlert: null };
  const ui = makeUI(); // closures below
  const I = ARD.input.create({ canvas, sim, view, R, human, ui });
  const ais = cfg.resume ? cfg.resume.ais.map(ARD.ai.restore) : sim.players.filter(p => (!p.human && !(players[p.id] && players[p.id].passive)) || (!netCtx && params.get('ia') === 'todos')).filter(() => !cfg.bench).map(p => ARD.ai.create(p.id, p.difficulty)); // 4.2a: no teste ninguém pensa por cima do roteiro da batalha // ?ia=todos: a IA joga também pelo humano (capturas e testes)
  G = { lead3d: window.__lead3d || null, sim, human, R, view, I, ais, speed: 1, paused: false, acc: 0, last: performance.now(), alerts: [], hints: makeHints(), selKey: '', isTouch, ended: false, pendingFor: null, net, pending: [], waiting: false, waitT: 0 };
  if (params.get('debug')) window.__ARDG = G; // testes automatizados
  G.track = ARD.campUI ? ARD.campUI.tracker(sim, human) : null; // conquistas valem em qualquer partida
  if (G.lead3d) { let lastG = 0; window.addEventListener('pointermove', ev => { const now = performance.now(); if (now - lastG < 120 || !G.lead3d || ev.pointerType === 'touch') return; lastG = now; ARD.leaders3d.gaze(G.lead3d, (ev.clientX - 80) / Math.max(400, innerWidth * 0.6), -(ev.clientY - 110) / Math.max(300, innerHeight * 0.6), 1200); }, { passive: true }); $('leader').addEventListener('click', () => { if (G.lead3d) { ARD.leaders3d.mood(G.lead3d, 3, 1600); ARD.leaders3d.react(G.lead3d, 'nod'); ARD.leaders3d.react(G.lead3d, 'talk', 0.9); } }); } // 4.1e: o líder olha para onde você aponta; clicar nele arranca um aceno
  if (cfg.resume && G.track && G.track.load) G.track.load(cfg.resume.track);
  { const pb = $('placebar'); if (pb) { $('pb-ok').onclick = () => I.confirmPlace(); $('pb-no').onclick = () => I.setMode('normal'); } } // 4.1a: confirmar construção no toque
  const measureBar = () => { const bar = $('bar'); if (bar && isTouch) document.documentElement.style.setProperty('--barh', bar.offsetHeight + 'px'); }; window.addEventListener('resize', measureBar); setTimeout(measureBar, 50);
  R.cine = (loadPrefs() || {}).cine !== false && !params.get('semcine'); /* 4.3b */
  G.save30 = !!(loadPrefs() || {}).bateria; G.lastDraw = 0; G.haptics = isTouch && !!navigator.vibrate; G.lastBuzz = 0;
  G.perf = { start: performance.now(), t0: performance.now(), frames: 0, low: 0, high: 0, down: false, up: false, auto: R.is3d && !params.get('q') && (cfg.quality || 'auto') === 'auto' };
  if (isTouch && navigator.getBattery && !G.save30) navigator.getBattery().then(b => { if (b && !b.charging && b.level < 0.2) { G.save30 = true; notice('Bateria baixa: limitando a 30 fps para economizar'); } }).catch(() => {});
  document.addEventListener('visibilitychange', () => { if (!G || G.sim !== sim || G.ended) return; if (document.hidden) { if (!net && !G.paused) { G.paused = true; G.autoPaused = true; G.pauseWhy = 'O jogo pausou sozinho porque a aba ficou em segundo plano. Nada se perdeu.'; } } else { if (G.autoPaused) { G.autoPaused = false; refreshTop(); } else if (net) banner('Você voltou à partida', 'Com a aba em segundo plano o jogo não envia comandos; depois de 8 s a sala pode seguir sem você.', 'warn'); } });
  G.camp = cfg.campaign && ARD.campUI ? ARD.campUI.begin(sim, cfg.campaign, cfg.resume ? cfg.resume.run : null) : null; // 4.0e: missão da campanha (4.1c: ou a retomada dela)
  G.cfg = cfg; setupSaves();
  if (R.is3d && ARD.campUI) R.skins = { [human]: ARD.campUI.skinOf(sim.players[human].faction) };
  window.addEventListener('resize', () => R.resize());
  document.body.classList.toggle('touch', isTouch);

  bindHUD(); refreshTop(); refreshHints(); refreshQuick();
  { const tb = $('top'); const fit = () => { const x = Math.max(0, tb.offsetHeight - 46); document.documentElement.style.setProperty('--tbx', document.body.classList.contains('touch') ? '0px' : x + 'px'); }; fit(); if (window.ResizeObserver) new ResizeObserver(fit).observe(tb); else addEventListener('resize', fit); } // 4.2g
  $('loading').hidden = false;
  R.humanId = human;
  R.prepare(sim, f => { $('load-bar').style.width = Math.round(f * 100) + '%'; }, () => {
    $('loading').hidden = true;
    const ff = net || cfg.resume ? 0 : parseInt(params.get('ff') || '0', 10);
    if (cfg.resume && cfg.resume.view) { const v = cfg.resume.view; Object.assign(view.cam, v.cam || {}); view.cam.pitchT = view.cam.pitch; if (v.memory) view.memory = new Map(v.memory); }
    if (cfg.bench) setupBench();
    if (cfg.resume && net) { net.sentFor = sim.tick - 1; G.pending = []; banner('De volta à sala', 'Partida sincronizada com o anfitrião no tempo ' + ARD.saves.mmss(sim.time) + '.', 'good', 7000); }
    else if (cfg.resume) { const fenda = G.camp && G.camp.noPause; if (!fenda) { G.paused = true; G.pauseWhy = 'Partida retomada de onde parou.'; refreshTop(); } banner('Partida retomada', (cfg.resumeAuto ? 'Você voltou em ' + cfg.resumeAuto + ' s, ' : 'Salvamento de ' + ARD.saves.ago(cfg.resumeAt || Date.now()) + ', ') + 'no tempo ' + ARD.saves.mmss(sim.time) + ' de jogo.' + (fenda ? '' : ' Pausado: toque em ❚❚ ou P para continuar.'), 'info', 9000); }
    for (let i = 0; i < ff * 10; i++) tickOnce(true);
    if (net) setupNet();
    if (params.get('speed')) G.speed = parseFloat(params.get('speed')) || 1;
    if (params.get('night')) sim.tick = 3600; // teste: começa de noite
    if (params.get('dia')) R.forceDay = true; // teste: luz do dia fixa (capturas)
    if (params.get('reveal')) view.reveal = true; // teste: sem névoa
    if (params.get('cam')) { const n = S.nucleoOf(sim, parseInt(params.get('cam'), 10)); if (n) { view.cam.x = n.x; view.cam.y = n.y; } }
    if (params.get('zoom')) view.cam.zoom = parseFloat(params.get('zoom'));
    if (params.get('pitch')) view.cam.pitch = view.cam.pitchT = parseFloat(params.get('pitch'));
    if (params.get('yaw')) view.cam.yaw = parseFloat(params.get('yaw'));
    refreshPanel(true); G.last = performance.now();
    requestAnimationFrame(frame);
  });

  function tickOnce(silent) {
    const sim = G.sim; const tick = sim.tick;
    if (net) {
      if (net.sentFor == null || net.sentFor < tick) { if (net.scheduleLocal(tick + net.DELAY, G.pending) !== false) G.pending = []; net.sentFor = tick; }
      if (!net.canAdvance(tick)) { G.waiting = true; return false; }
      G.waiting = false;
    }
    if (sim.tick % 10 === 0) for (const a of G.ais) for (const c of ARD.ai.think(sim, a)) S.enqueue(sim, c);
    if (net) for (const c of net.takeCmds(tick)) S.enqueue(sim, c);
    const ev = S.step(sim);
    if (net && sim.tick % 10 === 0) { const h = S.hash(sim); net.sendHash(sim.tick, h); (G.hashLog = G.hashLog || {})[sim.tick] = h; const ks = Object.keys(G.hashLog); if (ks.length > 80) delete G.hashLog[ks[0]]; }
    if (!silent) G.R.onEvents(ev, sim, human);
    handleEvents(ev, silent);
    if (G.track) G.track.tick(ev);
    if (G.camp) { const r = G.camp.tick(ev); if (r && !G.ended) endGame({ campaign: r }); }
    if (sim.tick % 10 === 0) updateMemory();
  }
  function frame(now) {
    if (!G || G.sim !== sim) return;
    if (G.save30 && now - G.lastDraw < 31) { requestAnimationFrame(frame); return; } G.lastDraw = now; // economia de bateria: até 30 quadros por segundo
    if (!document.hidden && !G.paused && !G.ended && now - G.perf.start < 6000) { G.perf.t0 = now; G.perf.frames = 0; } // aquecimento: shaders compilando não contam
    else if (!document.hidden && !G.paused && !G.ended) { const pf = G.perf; pf.frames++; const el = now - pf.t0; if (el >= 4000) { const fps = pf.frames * 1000 / el; G.fps = fps; pf.t0 = now; pf.frames = 0; // 4.0f: ajuste automático da qualidade 3D pelo FPS medido
      if (pf.auto && R.setQuality) { const L = ['baixa', 'media', 'alta', 'ultra'], LBL = { baixa: 'Baixa', media: 'Média', alta: 'Alta', ultra: 'Ultra' }; const cur = L.indexOf(R.quality.resolved || 'media'); const cap = G.save30 ? 24 : 26;
        if (fps < cap) { pf.high = 0; if (++pf.low >= 2 && cur > 0) { R.setQuality(L[cur - 1]); R.quality.name = 'auto'; R.quality.resolved = L[cur - 1]; pf.low = 0; pf.down = true; notice('Qualidade 3D ajustada para ' + LBL[L[cur - 1]] + ' para manter a fluidez (' + Math.round(fps) + ' fps)'); } }
        else if (fps > 57 && !G.save30) { pf.low = 0; if (++pf.high >= 4 && pf.down && !pf.up && cur < 3) { R.setQuality(L[cur + 1]); R.quality.name = 'auto'; R.quality.resolved = L[cur + 1]; pf.up = true; pf.high = 0; notice('Qualidade 3D voltou para ' + LBL[L[cur + 1]]); } }
        else { pf.low = 0; pf.high = 0; } } } }
    let dt = Math.min(0.25, (now - G.last) / 1000); G.last = now;
    if (!G.paused && !G.ended) { G.acc += dt * G.speed; let n = 0; while (G.acc >= S.TICK && n < 12) { if (tickOnce(false) === false) { G.acc = Math.min(G.acc, S.TICK); break; } G.acc -= S.TICK; n++; } if (n >= 12) G.acc = 0; }
    if (net) { G.waitT = G.waiting ? G.waitT + dt : 0; $('mp-wait').hidden = G.waitT < 0.8; if (G.waitT >= 0.8) $('mp-wait').textContent = net.state === 'rejoining' || G.rejoin ? 'Reconectando à sala ' + net.code + '… (' + Math.round((performance.now() - (G.rejoin ? G.rejoin.since : performance.now())) / 1000) + ' s)' : net.state === 'lost' ? 'Conexão perdida.' : 'Aguardando os outros jogadores… (' + G.waitT.toFixed(0) + ' s)'; }
    I.update(dt);
    if (G.bench) benchFrame(now, dt);
    if (G.frameN % 3 === 0) refreshTop();
    if (G.frameN++ % 2 === 0) { refreshPanel(false); refreshQuick(); } // 4.1a: barato agora (vida e progresso atualizam no lugar)
    if (G.frameN % 30 === 0) refreshHints();
    if (G.lead3d && ARD.leaders3d && G.frameN % 300 === 0) { const n = S.nucleoOf(sim, human); const mine = S.armyValue(sim, human); let foe = 0; for (const q of sim.players) if (q.alive && q.id !== human && !S.hasPact(sim, human, q.id)) foe = Math.max(foe, S.armyValue(sim, q.id)); ARD.leaders3d.baseMood(G.lead3d, !n || n.hp < n.maxHp * 0.5 || (foe > 600 && mine < foe * 0.45) ? 4 : (mine > 1500 && mine > foe * 1.8) ? 3 : 1); }
    if (G.camp && G.frameN % 10 === 0) { G.camp.frame(); if (R.setBeacon) R.setBeacon(G.camp.beacon(), G.camp.vip()); }
    R.draw(sim, view, G.paused ? 1 : Math.min(1, G.acc / S.TICK), dt);
    if (G.lead3d && ARD.leaders3d && ARD.leaders3d.setLight && R.lightSt && (G.frameN % 15 === 0 || R.lightSt.flash > 0.2)) ARD.leaders3d.setLight(G.lead3d, R.lightSt); /* 4.3e: o retrato do líder recebe a luz do mapa (dia, noite, clima, relâmpago) */
    if (G.autoSave && !G.ended && sim.tick !== G.savedTick && now - (G.lastSave || 0) > 10000) { G.lastSave = now; G.savedTick = sim.tick; (window.requestIdleCallback || ((f) => setTimeout(f, 0)))(() => G.saveNow('auto'), { timeout: 2000 }); }
    requestAnimationFrame(frame);
  }
  G.frameN = 0;

  function updateMemory() {
    const vis = sim.vis[human];
    for (const id of vis) { const e = sim.byId.get(id); if (e && e.alive && e.kind === 'building') view.memory.set(id, { x: e.x, y: e.y, def: e.def, owner: e.owner }); }
    // forget buildings that are gone once we can see the spot again
    const own = S.entitiesOf(sim, human);
    for (const [id, m] of view.memory) {
      const e = sim.byId.get(id);
      if (e && e.alive) { if (vis.has(id)) view.memory.set(id, { x: e.x, y: e.y, def: e.def, owner: e.owner }); continue; }
      let seen = false; for (const o of own) { if (S.dist(o.x, o.y, m.x, m.y) <= S.sensorRadius(sim, o)) { seen = true; break; } }
      if (seen) view.memory.delete(id);
    }
  }

  function volAt(x, y) { if (x == null) return 1; const d = S.dist(x, y, view.cam.x, view.cam.y); return Math.max(0.12, 1 - d / (1100 / Math.max(0.6, view.cam.zoom))); }
  function voiceFor(text) {
    const t = text.toUpperCase();
    if (t.includes('SIFÃO')) return 'Alerta de sifão'; if (t.includes('NÚCLEO SOB')) return 'Núcleo sob ataque'; if (t.includes('BASE SOB')) return 'Base sob ataque';
    if (t.includes('QUEBROU')) return 'Pacto quebrado'; if (t.includes('TEMPESTADE')) return 'Tempestade de Éter'; if (t.includes('ELIMINADO')) return text; if (t.includes('PESQUISA')) return 'Pesquisa concluída';
    if (t.includes('PACTO DE NÃO')) return 'Pacto assinado'; if (t.includes('BLECAUTE')) return 'Blecaute'; if (t.includes('FUNDIÇÃO')) return 'Fundição Orbital'; if (t.includes('SALTO')) return 'Salto de Núcleo'; return null;
  }
  function audioFor(e) {
    switch (e.t) {
      case 'shot': { const w = S.WEAPONS[e.weapon]; AU.sfx(e.beam ? 'beam' : (w && w.proj === 'shell') ? 'shot_heavy' : 'shot_light', volAt(e.x1, e.y1)); break; }
      case 'impact': AU.sfx(e.splash > 0 ? 'impact' : 'shot_light', volAt(e.x, e.y) * (e.splash > 0 ? 1 : 0.3)); break;
      case 'death': AU.sfx('explosion', volAt(e.x, e.y) * (e.kind === 'building' ? 1 : 0.6)); break;
      case 'built': if (e.p === human) { AU.sfx('build'); AU.say('Construção concluída', 'built', 4); } break;
      case 'spawn': if (e.p === human) { AU.sfx('spawn'); AU.say('Unidade pronta', 'spawn', 5); } break;
      case 'promote': if (e.owner === human) AU.sfx('promote'); break;
      case 'alert': if (e.p === human) { AU.sfx(e.kind === 'danger' ? 'danger' : 'alert'); const v = voiceFor(e.text); if (v) AU.say(v, v, e.kind === 'danger' ? 8 : 15); } break;
      case 'storm': if (e.phase === 'active') AU.sfx('storm'); break;
      case 'pact': AU.sfx('pact'); break;
      case 'betrayal': AU.sfx('betrayal'); break;
      case 'siphon': if (Math.random() < 0.05) AU.sfx('siphon', volAt(e.x2, e.y2)); break;
    }
  }
  function handleEvents(ev, silent) {
    for (const e of ev) {
      if (!silent) audioFor(e);
      if (e.t === 'alert' && e.p === human && !silent && G.lead3d && ARD.leaders3d) { if (e.kind === 'danger') { ARD.leaders3d.react(G.lead3d, 'jolt'); ARD.leaders3d.mood(G.lead3d, 2, 3000); } else if (e.kind === 'good') ARD.leaders3d.react(G.lead3d, 'nod'); if (e.x != null && R.worldToScreen) { const sp = R.worldToScreen(view.cam, e.x, e.y); if (sp) ARD.leaders3d.gaze(G.lead3d, (sp[0] - 80) / 500, -(sp[1] - 110) / 400, 1600); } }
      if (e.t === 'alert' && e.p === human) { if (e.x != null) view.lastAlert = { x: e.x, y: e.y }; if (!silent) pushAlert(e); if (!silent && G.haptics && e.kind === 'danger' && performance.now() - G.lastBuzz > 2500) { G.lastBuzz = performance.now(); try { navigator.vibrate(30); } catch (er) {} } }
      if (!silent && G.haptics && e.t === 'super' && e.p === human) { try { navigator.vibrate([20, 40, 20]); } catch (er) {} }
      else if (e.t === 'notice' && e.p === human && !silent) notice(e.text);
      else if (e.t === 'proposal' && e.p === human && !silent) { G.pendingFor = e.from; showProposal(e.from); }
      else if (e.t === 'eliminated' && !silent) { const q = sim.players[e.p]; const left = sim.players.filter(x => x.alive && x.id !== human).length; if (e.p !== human) { banner(q.name + ' eliminado', left > 0 ? left + (left > 1 ? ' inimigos restantes' : ' inimigo restante') + ' · destrua todos os Núcleos ou vença por Domínio aos 25:00' : 'Todos os Núcleos inimigos caíram', 'good'); AU.sfx('promote'); AU.say(q.name + ' eliminado. ' + (left > 0 ? left + (left > 1 ? ' inimigos restantes' : ' inimigo restante') : ''), 'elim', 0); } }
      else if (e.t === 'trait' && e.owner === human && !silent) AU.sfx('promote');
      else if (e.t === 'end') { if (!G.camp) endGame(e.result); }
      else if (e.t === 'regime' && e.p === human && !silent) notice('Energia: ' + S.REGIME[e.regime].name);
      else if (e.t === 'era' && e.p === human && !silent) { const er = S.ERAS[e.era]; banner('Era ' + er.roman + ' — ' + er.name, er.desc, 'good', 7000); leaderMood(3); AU.sfx('promote'); G.selKey = ''; }
      else if (e.t === 'ascend' && e.p === human && !silent) { const a = S.ASCENSION[sim.players[human].faction]; banner('Ascensão: ' + a.name, a.desc, 'good', 8000); leaderMood(3); AU.sfx('promote'); }
      else if (e.t === 'module' && e.p === human && !silent) { G.selKey = ''; AU.sfx('promote'); }
    }
  }
  function pushAlert(e) {
    const list = $('alerts'); const el = document.createElement('button'); el.className = 'alert ' + (e.kind || 'info'); el.type = 'button';
    el.innerHTML = `<span class="t">${mmss(sim.time)}</span><span class="m">${esc(e.text)}</span>`;
    if (e.x != null) el.addEventListener('click', () => I.center(e.x, e.y)); else el.disabled = true;
    list.prepend(el); while (list.children.length > 6) list.lastChild.remove();
    setTimeout(() => { el.classList.add('fade'); }, 9000); setTimeout(() => el.remove(), 14000);
    const log = $('log'); const li = document.createElement('div'); li.textContent = mmss(sim.time) + ' · ' + e.text; log.prepend(li); while (log.children.length > 40) log.lastChild.remove();
  }
  function leaderMood(mood, ms) { if (G.lead3d && ARD.leaders3d) { ARD.leaders3d.mood(G.lead3d, mood, ms || 4500); if (mood === 3) ARD.leaders3d.react(G.lead3d, 'nod'); else if (mood === 2) ARD.leaders3d.react(G.lead3d, 'shake'); } const fac = sim.players[human].faction; const art = leaderArt(fac, mood); const L = $('leader'); if (!art || !L || L.hidden) return; $('leader-img').src = art; L.classList.remove('mood'); void L.offsetWidth; L.classList.add('mood'); clearTimeout(G.moodT); G.moodT = setTimeout(() => { $('leader-img').src = leaderArt(fac); }, ms || 4500); }
  // ---------- 4.2a: teste de desempenho ----------
  // Batalha fixa (semente 4242, dois exércitos no centro) e 3 s de aquecimento; depois, 30 s de câmera roteirizada.
  // Mede FPS médio, piores 1% e 5% dos quadros e travadas (quadros acima de 50 ms). O ajuste automático de qualidade fica desligado.
  function setupBench() {
    const ns = sim.players.map(p => S.nucleoOf(sim, p.id)); const a = ns[0], b = ns[1] || { x: S.CX, y: S.CY };
    const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L; const mx = a.x + (S.CX - a.x) * 0.5, my = a.y + (S.CY - a.y) * 0.5; // campo aberto entre a base A e a Fenda (a cratera fica fora)
    for (const p of sim.players) { p.res.minerio += 4000; p.res.plasma += 2000; p.res.dados += 600; p.era = 3; const fac = S.FACTIONS[p.faction] ? p.faction : 'vehnar';
      const own = Object.keys(S.UNITS).filter(d => !S.UNITS[d].epic && S.UNITS[d].attack && (!S.UNITS[d].faction || S.UNITS[d].faction === fac)); const side = p.id === 0 ? -1 : 1; const ids = [];
      for (let i = 0; i < 30; i++) { const d = own[i % own.length]; const row = Math.floor(i / 6), col = i % 6; const px = mx + ux * side * (80 + row * 24) + -uy * (col - 2.5) * 28, py = my + uy * side * (80 + row * 24) + ux * (col - 2.5) * 28; const u = S.spawnUnit(sim, p.id, d, px, py); if (u) ids.push(u.id); }
      S.enqueue(sim, { t: 'attackmove', p: p.id, ids, x: mx - ux * side * 400, y: my - uy * side * 400 }); }
    const wave = () => { for (const p of sim.players) { const fac = S.FACTIONS[p.faction] ? p.faction : 'vehnar'; const own = Object.keys(S.UNITS).filter(d => !S.UNITS[d].epic && S.UNITS[d].attack && (!S.UNITS[d].faction || S.UNITS[d].faction === fac)); const side = p.id === 0 ? -1 : 1; const alive = sim.ents.filter(e => e.alive && e.kind === 'unit' && e.owner === p.id); const ids = alive.map(e => e.id);
        for (let i = 0; i < Math.max(0, 30 - alive.length) && i < 8; i++) { const d = own[(i + Math.floor(sim.time)) % own.length]; const px = mx + ux * side * 260 + -uy * (i - 3.5) * 26, py = my + uy * side * 260 + ux * (i - 3.5) * 26; const u = S.spawnUnit(sim, p.id, d, px, py); if (u) ids.push(u.id); }
        if (ids.length) S.enqueue(sim, { t: 'attackmove', p: p.id, ids, x: mx - ux * side * 120, y: my - uy * side * 120 }); } };
    G.benchWave = wave; // reforço a cada 4 s de jogo: a batalha dura a janela inteira
    view.reveal = true; R.forceDay = !params.get('noite'); G.perf.auto = false; G.speed = 1; document.body.classList.add('bench'); view.sel.clear(); I.buildMenu = false;
    G.bench = { t0: performance.now(), mt: 0, warm: 3000, dur: 30000, frames: [], a, b, mx, my, yaw0: view.cam.yaw, done: false, nextWave: sim.time + 4 }; G.save30 = false; // 4.2a: economia de bateria não limita o teste
    try { if (navigator.wakeLock) navigator.wakeLock.request('screen').then(l => { G.benchLock = l; }).catch(() => {}); } catch (e) {} // tela acesa durante o teste
    banner('Teste de desempenho', 'Batalha fixa por 30 s com a câmera passeando pelo mapa. Não mexa no jogo até terminar.', 'info', 6000);
  }
  function benchFrame(now, dt) {
    const B = G.bench; if (B.done) return; if (G.paused || document.hidden) { B.last = 0; B.wasPaused = true; return; } /* pausado: câmera parada e sem contar quadros */
    if (B.last) B.mt += Math.min(250, now - B.last); /* relógio do teste: só avança com o jogo rodando */
    const t = params.get('benchpasso') ? (B.vt = (B.vt || 0) + (+params.get('benchpasso') > 1 ? +params.get('benchpasso') : 1000 / 30)) : B.mt; /* ?benchpasso=1: tempo virtual por quadro (capturas iguais em qualquer máquina) */
    if (sim.time >= B.nextWave && G.benchWave) { B.nextWave = sim.time + 4; G.benchWave(); }
    if (t > B.warm && B.last) B.frames.push(now - B.last); B.last = now; // intervalo real entre quadros (o dt do jogo é limitado a 250 ms)
    const k = Math.max(0, Math.min(1, (t - B.warm) / B.dur)); const sm = x => x * x * (3 - 2 * x); const lerp = (p, q, f) => p + (q - p) * f;
    // trajeto: base A → batalha de perto → volta em órbita → panorama alto → base B
    const c = view.cam; let x, y, z, yaw, pitch;
    if (k < 0.25) { const f = sm(k / 0.25); x = lerp(B.a.x, B.mx, f); y = lerp(B.a.y, B.my, f); z = lerp(1.0, 1.5, f); yaw = B.yaw0; pitch = lerp(0.95, 0.7, f); }
    else if (k < 0.55) { const f = (k - 0.25) / 0.3; x = B.mx; y = B.my; z = 1.5; yaw = B.yaw0 + sm(f) * Math.PI * 0.9; pitch = 0.7; }
    else if (k < 0.75) { const f = sm((k - 0.55) / 0.2); x = B.mx; y = B.my; z = lerp(1.5, 0.45, f); yaw = B.yaw0 + Math.PI * 0.9; pitch = lerp(0.7, 1.05, f); }
    else { const f = sm((k - 0.75) / 0.25); x = lerp(B.mx, B.b.x, f); y = lerp(B.my, B.b.y, f); z = lerp(0.45, 1.0, f); yaw = B.yaw0 + Math.PI * 0.9; pitch = lerp(1.05, 0.95, f); }
    c.x = x; c.y = y; c.zoom = z; c.yaw = yaw; c.pitch = c.pitchT = pitch; B.k = k;
    if (t >= B.warm + B.dur) benchDone();
  }
  function benchDone() {
    const B = G.bench; B.done = true; if (G.benchLock) { try { G.benchLock.release(); } catch (e) {} } const fr = B.frames.slice(); const total = fr.reduce((s, v) => s + v, 0); const sorted = fr.slice().sort((p, q) => q - p);
    if (!fr.length || (!params.get('benchpasso') && (fr.length < 20 || total < B.dur * 0.6))) { G.paused = true; refreshTop(); window.__benchResult = { aborted: true, frames: fr.length }; showBench(null); return; } // pouco medido (aba escondida, tela bloqueada): não salva
    const pct = q => { const n = Math.max(1, Math.floor(sorted.length * q)); let s = 0; for (let i = 0; i < n; i++) s += sorted[i]; return Math.round(1000 / (s / n)); };
    const res = { fps: Math.round(fr.length * 1000 / Math.max(1, total)), p1: pct(0.01), p5: pct(0.05), worst: Math.round(sorted[0] || 0), stutters: fr.filter(v => v > 50).length, frames: fr.length, quality: (R.quality && R.quality.name === 'auto' ? 'auto → ' + R.quality.resolved : (R.quality && R.quality.name) || '2d'), res: Math.round(R.w * (R.quality ? R.quality.pr : 1)) + 'x' + Math.round(R.h * (R.quality ? R.quality.pr : 1)), gpu: R.gpu || '?', version: VERSION, at: Date.now() };
    try { localStorage.setItem('ard-bench-last', JSON.stringify(res)); } catch (e) {}
    G.paused = true; refreshTop(); window.__benchResult = res; showBench(res);
  }
  function showBench(res) {
    const box = $('benchbox'); if (!box) return; if (!res) { $('bench-verdict').textContent = 'Teste interrompido'; $('bench-verdict').className = 'bv warn'; $('bench-tip').textContent = 'O jogo ficou pausado ou em segundo plano durante a medição. Rode de novo com a tela acesa e sem trocar de aba.'; $('bench-table').innerHTML = ''; $('bench-feedback').hidden = true; $('bench-back').onclick = () => location.href = location.pathname; box.hidden = false; return; } $('bench-feedback').hidden = false; const verdict = res.fps >= 55 && res.p1 >= 35 ? ['Ótimo', 'good', 'Pode subir a qualidade.'] : res.fps >= 40 ? ['Bom', 'good', 'Fluido para jogar.'] : res.fps >= 26 ? ['Jogável', 'warn', 'Se travar em batalhas grandes, desça um degrau de qualidade.'] : ['Pesado', 'danger', 'Use a qualidade Baixa ou o modo 2D neste aparelho.'];
    $('bench-verdict').textContent = verdict[0]; $('bench-verdict').className = 'bv ' + verdict[1]; $('bench-tip').textContent = verdict[2];
    $('bench-table').innerHTML = [['FPS médio', res.fps], ['Piores 1% dos quadros', res.p1 + ' fps'], ['Piores 5% dos quadros', res.p5 + ' fps'], ['Pior quadro', res.worst + ' ms'], ['Travadas (> 50 ms)', res.stutters + ' de ' + res.frames], ['Qualidade', res.quality], ['Resolução interna', res.res], ['GPU', res.gpu]].map(([k, v]) => `<div class="stat"><span>${esc(k)}</span><b>${esc(String(v))}</b></div>`).join('');
    $('bench-feedback').href = feedbackUrl({ teste_desempenho_detalhe: JSON.stringify(res) }); $('bench-back').onclick = () => location.href = location.pathname; box.hidden = false;
  }
  // ---------- 4.1c: salvamento ----------
  function setupSaves() {
    G.autoSave = !net && !!ARD.saves && !params.get('semsalvar') && !cfg.bench;
    G.saveNow = (slot, extra) => { if (!G.autoSave || G.ended || G.leaving) return Promise.resolve(null); // 4.2g: depois de Sair ou Pausar e sair nada regrava o 'auto' (ciclo de 10 s, aba escondida, pagehide)
      let data, meta; try { data = buildSave(); meta = saveMeta(extra); } catch (e) { console.warn('[ARD] salvamento: fotografia falhou', e); return Promise.resolve(null); }
      return ARD.saves.put(slot, meta, data).catch(e => { console.warn('[ARD] salvamento falhou:', e); return null; }); };
    if (!G.autoSave) return;
    document.addEventListener('visibilitychange', () => { if (document.hidden && G && G.sim === sim && !G.ended) G.saveNow('auto'); });
    window.addEventListener('pagehide', () => { if (G && G.sim === sim && !G.ended) G.saveNow('auto'); });
    window.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S') && G && G.sim === sim && !G.ended) { e.preventDefault(); openSaveBox(); } });
  }
  function buildSave() {
    const c = view.cam;
    return { v: 1, version: VERSION, build: BUILD, human, simCfg: S.jsonSafe(sim.cfg), cfg: { name: cfg.name, faction: sim.players[human].faction, opp: cfg.opp, diff: cfg.diff, seed: sim.seed, minutes: cfg.minutes || 25, clima: cfg.clima },
      camp: cfg.campArgs || null, sim: S.snapshot(sim), ais: G.ais.map(ARD.ai.snapshot), run: G.camp ? G.camp.run.save() : null, track: G.track && G.track.save ? G.track.save() : null,
      view: { cam: { x: c.x, y: c.y, zoom: c.zoom, yaw: c.yaw, pitch: c.pitch }, memory: [...view.memory] } };
  }
  function saveMeta(extra) {
    const me = sim.players[human]; const fac = (S.FACTIONS[me.faction] || {}).name || me.faction; const foes = sim.players.filter(q => q.id !== human);
    const dl = { facil: 'Fácil', normal: 'Normal', dificil: 'Difícil', brutal: 'Brutal', fenda: 'Fenda' };
    const title = G.camp ? 'Campanha · ' + G.camp.prep.mission.title : 'Escaramuça · ' + fac + ' contra ' + foes.length + (foes.length > 1 ? ' IAs' : ' IA');
    const sub = (G.camp ? fac + ' · ' + G.camp.prep.diff.label : (dl[cfg.diff] || cfg.diff || '')) + ' · ' + ARD.saves.mmss(sim.time) + ' de jogo' + ' · ' + foes.filter(q => q.alive).length + ' adversário(s) de pé';
    return Object.assign({ kind: G.camp ? 'campanha' : 'solo', title, sub, gameTime: sim.time, faction: me.faction, version: VERSION, noPause: !!(G.camp && G.camp.noPause) }, extra || {});
  }
  function openSaveBox() {
    const box = $('savebox'); if (!box) return; if (!G.autoSave) { notice('Sem salvamento no multiplayer'); return; } if (!box.hidden) return; // 4.2g: Ctrl+S de novo com a janela aberta não muda o estado da pausa
    const fenda = G.camp && G.camp.noPause; const wasPaused = G.paused; if (!fenda && !G.paused) { G.paused = true; refreshTop(); }
    const close = () => { if (box.hidden) return; box.hidden = true; G.closeSave = null; if (!fenda && !wasPaused) { G.paused = false; refreshTop(); } }; G.closeSave = close;
    box.querySelectorAll('[data-close]').forEach(b => { b.onclick = close; });
    $('save-note').textContent = fenda ? 'Na dificuldade Fenda não há salvamento manual. O salvamento automático continua protegendo contra queda de internet ou energia.' : 'O jogo também salva sozinho a cada 10 segundos e ao sair da aba. Se a internet ou a energia cair, ele volta de onde parou.';
    const draw = () => ARD.saves.list().then(list => { const by = {}; for (const m of list) by[m.slot] = m;
      $('save-slots').innerHTML = ['m1', 'm2', 'm3'].map((sl, i) => { const m = by[sl]; return `<button class="slot" data-slot="${sl}" ${fenda ? 'disabled' : ''}><b>Espaço ${i + 1}</b><span>${m ? esc(m.title) + '<br><small>' + esc(m.sub) + ' · salvo ' + ARD.saves.ago(m.savedAt) + '</small>' : '<small>vazio</small>'}</span></button>`; }).join('');
      $('save-slots').querySelectorAll('[data-slot]').forEach(b => b.onclick = () => { const sl = b.dataset.slot; const go = () => G.saveNow(sl).then(m => { if (m) { notice('Partida salva no espaço ' + sl.slice(1)); draw(); } else notice('Não foi possível salvar neste aparelho'); });
        if (by[sl]) ui.confirm('Substituir o que está no espaço ' + sl.slice(1) + '?', go); else go(); }); });
    draw();
    $('save-park').onclick = () => { if (G.leaving) return; const p = G.saveNow('auto', { parked: true }); G.leaving = true; within(p, 6000).then(m => { if (m) goStart(); else { G.leaving = false; notice('Não foi possível salvar neste aparelho'); } }); }; // 4.2g: volta ao início de verdade (antes recarregava o link da missão e ela recomeçava)
    box.hidden = false;
  }
  function banner(title, sub, kind, ms) { const L = $('leader'); if (L && !L.hidden) { L.classList.remove('talk'); void L.offsetWidth; L.classList.add('talk'); } if (G.lead3d && ARD.leaders3d) ARD.leaders3d.react(G.lead3d, 'talk', Math.min(3.2, 1 + String(sub || '').length / 45)); if (kind === 'danger' || kind === 'warn') leaderMood(2); else if (kind === 'good') leaderMood(3); const b = $('banner'); $('banner-title').textContent = title; $('banner-sub').textContent = sub || ''; b.className = 'banner ' + (kind || 'info'); b.hidden = false; clearTimeout(G.bannerT); G.bannerT = setTimeout(() => { b.hidden = true; }, ms || 5000); }
  function notice(text) { const n = $('notice'); n.textContent = text; n.classList.add('show'); clearTimeout(G.noticeT); G.noticeT = setTimeout(() => n.classList.remove('show'), 2200); }

  // ---------- HUD ----------
  function resWatch() { // 4.2h: reserva do território no título das pílulas, alerta quando o Minério ou o Plasma do território acaba, chip de coletores parados (só interface)
    const W = G.resW || (G.resW = { t: 0, warned: {} }); W.t = sim.time; const res = { minerio: 0, plasma: 0, dados: 0 }; const idle = [];
    for (const e of sim.ents) { if (!e.alive) continue; if (e.kind === 'unit' && e.owner === human && e.def === 'coletor' && e.state === 'idle') idle.push(e.id); else if (e.kind === 'node' && e.amount > 0 && S.inTerritory(sim, human, e.x, e.y)) res[e.res] += e.amount; }
    for (const k of ['plasma', 'minerio', 'dados']) { const el = $('r-' + k); if (el && el.parentElement) el.parentElement.title = RES_NAME[k] + ' · variação por minuto nos últimos 30 s · no seu território restam ' + fmt(res[k]); }
    for (const k of ['minerio', 'plasma']) { if (res[k] > 0) { W.warned[k] = false; continue; } if (W.warned[k] || sim.time < 60 || !S.nucleoOf(sim, human)) continue; W.warned[k] = true;
      const n0 = S.nucleoOf(sim, human); let best = null, bd = 1e9; for (const e of sim.ents) if (e.alive && e.kind === 'node' && e.res === k && e.amount > 0 && S.territoryOwner(sim, e.x, e.y) === -1) { const d = S.dist(e.x, e.y, n0.x, n0.y); if (d < bd) { bd = d; best = e; } }
      const text = RES_NAME[k] + ' do seu território acabou: mande coletores a outro campo (botão direito) ou expanda com um Nódulo.'; handleEvents([{ t: 'alert', p: human, text, x: best ? best.x : undefined, y: best ? best.y : undefined, kind: 'warn' }]); if (G.isTouch) notice(text); }
    const chip = $('idle-col'); if (chip) { if (chip.hidden !== !idle.length) chip.hidden = !idle.length; if (idle.length) $('idle-n').textContent = idle.length; G.idleCol = idle; }
  }
  function refreshTop() {
    const p = sim.players[human];
    $('r-plasma').textContent = fmt(p.res.plasma); $('r-minerio').textContent = fmt(p.res.minerio); $('r-dados').textContent = fmt(p.res.dados);
    { const H = G.resHist || (G.resHist = []); if (!H.length || sim.time - H[H.length - 1].t >= 1) { H.push({ t: sim.time, r: Object.assign({}, p.res) }); while (H.length > 32) H.shift(); } // 4.2f: variação por minuto (janela de 30 s)
      const old = H[0]; const span = sim.time - old.t; for (const k of ['plasma', 'minerio', 'dados']) { const el = $('rr-' + k); if (!el) continue; if (span < 8) { el.textContent = ''; continue; } const v = Math.round((p.res[k] - old.r[k]) * 60 / span); el.textContent = Math.abs(v) < 1 ? '' : (v > 0 ? '+' : '−') + fmt(Math.abs(v)); el.className = v > 0 ? 'up' : 'dn'; } }
    if (!G.resW || sim.time - G.resW.t >= 2 || sim.time < G.resW.t) resWatch(); // 4.2h
    { const pb = $('pausebox'); if (pb) { const show = !!G.paused && !G.ended && !net && !G.bench && $('savebox').hidden; if (pb.hidden === show) pb.hidden = !show; if (show) $('pause-why').textContent = G.pauseWhy || 'Partida pausada.'; } }
    const en = p.energy; const reg = $('energy'); reg.className = 'energy ' + en.regime;
    $('e-text').textContent = `${Math.round(en.prod)} / ${Math.round(en.cons)}`; $('e-regime').textContent = S.REGIME[en.regime].name + (p.overchargeT > 0 ? ' · Sobrecarga' : '') + (p.blackoutT > 0 ? ' · BLECAUTE' : '');
    $('e-bar').style.width = Math.min(100, en.ratio * 100 / 1.5) + '%';
    $('clock').textContent = mmss(sim.time) + ' / ' + mmss(sim.maxTime);
    { const eb = $('era-badge'); if (eb) { const er = p.era || 1; const nx = S.ERAS[er + 1]; eb.textContent = 'Era ' + S.ERAS[er].roman + (p.evolveT > 0 && nx ? ' → ' + nx.roman + ' ' + Math.ceil(p.evolveT) + ' s' : '') + (p.ascended ? ' ✦' : ''); eb.title = S.ERAS[er].name + ': ' + S.ERAS[er].desc + (p.ascended ? ' · Ascensão: ' + S.ASCENSION[p.faction].name : ''); eb.className = 'era e' + er + (p.evolveT > 0 ? ' evolving' : '') + (p.ascended ? ' asc' : ''); } }
    $('rep').textContent = S.REP_NAMES[p.rep];
    const enemies = sim.players.filter(x => x.alive && x.id !== human && !S.hasPact(sim, human, x.id)).length; $('enemies').textContent = enemies;
    for (const b of document.querySelectorAll('[data-speed]')) b.classList.toggle('on', parseFloat(b.dataset.speed) === G.speed && !G.paused);
    $('btn-pause').classList.toggle('on', G.paused);
  }
  function selectionSummary() {
    const ents = [...view.sel].map(id => sim.byId.get(id)).filter(e => e && e.alive);
    if (ents.length !== view.sel.size) view.sel = new Set(ents.map(e => e.id));
    return ents;
  }
  function liveUpdate(ents) { // atualiza barras de vida, texto de vida/construção e progresso da fila sem recriar o painel
    const panel = $('panel'); for (const e of ents) { const bar = panel.querySelector('[data-live="' + e.id + '"] i'); if (bar) bar.style.width = (100 * e.hp / e.maxHp) + '%'; const tx = panel.querySelector('[data-livetxt="' + e.id + '"]'); if (tx) tx.textContent = fmt(e.hp) + ' / ' + fmt(e.maxHp) + (e.kind === 'building' && !e.built ? ' · construção ' + Math.round(e.progress * 100) + '%' : '');
      const qp = panel.querySelector('[data-liveq="' + e.id + '"]'); if (qp && e.queue && e.queue[0]) qp.textContent = Math.round(100 * e.queue[0].t / e.queue[0].total) + '%';
      if (e.def === 'nucleo') { const pl = sim.players[human]; const nx = S.ERAS[(pl.era || 1) + 1]; const eb = panel.querySelector('[data-evobar] i'), et = panel.querySelector('[data-evotxt]'); if (nx && pl.evolveT > 0) { if (eb) eb.style.width = Math.round(100 * (1 - pl.evolveT / nx.time)) + '%'; if (et) et.textContent = Math.ceil(pl.evolveT) + ' s'; } }
      if (e.upT > 0) { const md = S.BUILDINGS[e.def].module; const ub = panel.querySelector('[data-upbar] i'), ut = panel.querySelector('[data-uptxt]'); if (md && ub) ub.style.width = Math.round(100 * (1 - e.upT / md.time)) + '%'; if (ut) ut.textContent = Math.ceil(e.upT) + ' s'; } } } // 4.1d: evolução e módulo também andam no lugar
  function refreshPanel(force) {
    const ents = selectionSummary();
    const key = ents.map(e => e.id + ':' + (ents.length > 1 ? Math.round(e.hp) : '') + ':' + (e.queue ? e.queue.length + ':' + (e.queue[0] ? (e.queue[0].waiting ? 'w' : 'p') : '') : '') + ':' + (e.built ? 1 : Math.floor(e.progress * 20)) + ':' + (e.amount != null ? Math.floor(e.amount) : '')).join('|') + '|' + I.buildMenu + '|' + I.mode + '|' + Object.keys(sim.players[human].research).length + '|' + (sim.players[human].era || 1) + (sim.players[human].evolveT > 0 ? 'e' : '') + (sim.players[human].ascended ? 'a' : '') + '|' + ents.map(e => (e.mod ? 'm' : '') + (e.upT > 0 ? 'u' : '')).join('');
    if (!force && key === G.selKey) { liveUpdate(ents); return; } G.selKey = key; // 4.1a: vida e progresso mudam no lugar; redesenhar só quando a estrutura do painel muda (cliques não se perdem)
    const panel = $('panel'); const p = sim.players[human]; const fac = S.FACTIONS[p.faction];
    if (!ents.length || I.buildMenu) { panel.innerHTML = buildMenuHTML(p); bindBuildMenu(); return; }
    const e = ents[0];
    if (e.kind === 'wreck') { panel.innerHTML = `<div class="ph"><span class="dot" style="background:#8A5A3A"></span><b>Carcaça de ${esc(S.UNITS[e.def] ? S.UNITS[e.def].name : 'veículo')}</b></div><div class="muted">${fmt(e.amount)} de Minério recuperável</div><div class="muted small">Coletores podem saquear carcaças em qualquer lugar: clique direito com um coletor.</div>`; return; }
    if (e.kind === 'node') { const dry = e.amount <= 0; panel.innerHTML = `<div class="ph"><span class="dot" style="background:${dry ? '#5A5F66' : ARD.render.NODE_COLOR[e.res]}"></span><b>Nó de ${RES_NAME[e.res]}${dry ? ' · esgotado' : ''}</b></div>` + (dry ? '<div class="muted">Nada mais a colher aqui. Os recursos não voltam: mande os coletores a outro campo ou expanda com um Nódulo.</div>' : `<div class="muted">${fmt(e.amount)} / ${fmt(e.max)} restantes</div><div class="muted small">Coletores colhem sozinhos no seu território. Mandados com o botão direito, colhem em qualquer campo fora do território inimigo.</div>`); return; } // 4.2h
    if (e.owner !== human) {
      const q = sim.players[e.owner]; const d = e.kind === 'unit' ? S.UNITS[e.def] : S.BUILDINGS[e.def];
      panel.innerHTML = `<div class="ph"><span class="dot" style="background:${q.color}"></span><b>${esc(d.name)}</b> <span class="muted">· ${esc(q.name)} (${S.FACTIONS[q.faction].short})</span></div><div class="hp"><i style="width:${(100 * e.hp / e.maxHp)}%"></i></div><div class="muted small">${fmt(e.hp)} / ${fmt(e.maxHp)} · ${e.kind === 'unit' ? S.CLASS_NAMES[e.cls] : 'Estrutura'} · ${S.hasPact(sim, human, e.owner) ? 'Em pacto de Não-agressão' : 'Inimigo'}</div>${e.kind === 'building' && (e.def === 'refinaria' || e.def === 'reator') ? '<div class="tip">Alvo de Sifão: selecione um Pirata e clique com o botão direito aqui.</div>' : ''}`;
      return;
    }
    if (e.kind === 'building' && ents.length === 1) {
      const d = S.BUILDINGS[e.def]; let h = `<div class="ph"><span class="dot" style="background:${p.color}"></span><b>${esc(d.name)}</b></div><div class="hp" data-live="${e.id}"><i style="width:${(100 * e.hp / e.maxHp)}%"></i></div><div class="muted small"><span data-livetxt="${e.id}">${fmt(e.hp)} / ${fmt(e.maxHp)}${e.built ? '' : ' · construção ' + Math.round(e.progress * 100) + '%'}</span>${d.energyProd ? ' · +' + (d.energyProd * (e.mod === 1 && e.def === 'reator' ? 1.6 : 1) + (e.def === 'nucleo' ? 15 * ((p.era || 1) - 1) : 0)) + ' energia' : ''}${d.energyUse ? ' · −' + d.energyUse + ' energia' : ''}</div><div class="muted small">${esc(d.desc)}</div>`;
      const prodList = S.producesFor(e.def, p.faction);
      if (e.built && prodList.length) {
        h += '<div class="grid">';
        for (const ud of prodList) { const u = S.UNITS[ud]; const name = S.unitName(fac.id, ud); const qn = e.queue.filter(q => q.def === ud).length; const lk = S.lockReason(sim, human, 'unit', ud); h += `<button class="act ${lk ? 'locked' : ''}" data-prod="${ud}" ${lk ? `data-lock="${esc(lk)}"` : ''} title="${esc((lk ? '🔒 ' + lk + ' · ' : '') + u.desc)} · clique +1, Shift +5, Ctrl +10${G.isTouch ? ', segurar +5' : ''}">${lk ? `<span class="lockb">${u.era && u.era > (p.era || 1) ? S.ERAS[u.era].roman : '🔒'}</span>` : ''}<img class="ico" alt="" src="${R.icon(ud, human)}"><span class="k">${u.key}</span><span class="n">${esc(name)}</span><span class="cost">${costStr(u.cost)}</span>${qn ? `<span class="qn">×${qn}</span>` : ''}</button>`; }
        h += '</div>';
        if (e.queue.length) { h += `<div class="queue"><span class="qtot">Fila ${e.queue.length}/50</span>`; for (let i = 0; i < e.queue.length;) { const q = e.queue[i]; let j = i; while (j < e.queue.length && e.queue[j].def === q.def) j++; const n = j - i; h += `<button class="q" data-cancel="${j - 1}" data-def="${q.def}" title="Clique cancela 1 · Shift cancela todas deste tipo">${esc(S.unitName(fac.id, q.def))}${n > 1 ? ` <b>×${n}</b>` : ''}${i === 0 ? (q.waiting ? ' <i class="wait">aguardando recursos</i>' : ` <i data-liveq="${e.id}">${Math.round(100 * q.t / q.total)}%</i>`) : ''} ✕</button>`; i = j; } h += '</div>'; }
        h += `<div class="row"><button class="act sm" data-mode="rally">Ponto de reunião</button>${e.def === 'nucleo' ? `<button class="act sm" data-mode="jump" ${p.jumpsLeft > 0 && e.jumpT <= 0 ? '' : 'disabled'}>Salto de Núcleo (${p.jumpsLeft})</button>` : ''}</div>`;
      }
      if (e.built && e.def === 'nucleo') { // 4.1d: Eras
        const er = p.era || 1; const nx = S.ERAS[er + 1];
        h += `<div class="erabox"><div class="eb-h"><b>Era ${S.ERAS[er].roman} · ${esc(S.ERAS[er].name)}</b>${p.ascended ? ' <span class="asc">✦ ' + esc(S.ASCENSION[p.faction].name) + '</span>' : ''}</div>`;
        if (nx && p.evolveT > 0) h += `<div class="small">Evoluindo para a Era ${nx.roman} · <span data-evotxt>${Math.ceil(p.evolveT)} s</span></div><div class="hp evo" data-evobar><i style="width:${Math.round(100 * (1 - p.evolveT / nx.time))}%"></i></div>`;
        else if (nx) { const why = S.eraBlock(sim, human); const reqs = (nx.needs || []).map(n => (S.hasBuilt(sim, human, n) ? '✓ ' : '✗ ') + S.BUILDINGS[n].name).concat(nx.needsAny ? [(nx.needsAny.some(n => S.hasBuilt(sim, human, n)) ? '✓ ' : '✗ ') + nx.needsAny.map(n => S.BUILDINGS[n].name).join(' ou ')] : []);
          h += `<button class="act evolve" data-evolve="1" ${why ? `data-lock="${esc(why)}"` : ''} title="${esc(nx.desc)}"><span class="n">Evoluir para a Era ${nx.roman} · ${esc(nx.name)}</span><span class="cost">${costStr(nx.cost)} · ${nx.time} s</span></button><div class="small muted">${reqs.join(' · ')} — ${esc(nx.desc)}</div>`; }
        else h += '<div class="small muted">Era máxima. A Ascensão da Raça fica no Laboratório.</div>';
        h += '</div>';
      }
      { const md = e.built && S.BUILDINGS[e.def].module; if (md) { // 4.1d: módulo da estrutura
        if (e.mod) h += `<div class="tip">✓ ${esc(md.name)}: ${esc(md.desc)}</div>`;
        else if (e.upT > 0) h += `<div class="small">Instalando ${esc(md.name)} · <span data-uptxt>${Math.ceil(e.upT)} s</span></div><div class="hp evo" data-upbar><i style="width:${Math.round(100 * (1 - e.upT / md.time))}%"></i></div>`;
        else { const lk = S.lockReason(sim, human, 'module', e.def); h += `<button class="act module ${lk ? 'locked' : ''}" data-upgrade="1" ${lk ? `data-lock="${esc(lk)}"` : ''} title="${esc((lk ? '🔒 ' + lk + ' · ' : '') + md.desc)}"><span class="n">Módulo: ${esc(md.name)}</span><span class="cost">${lk ? '🔒 ' + esc(lk) : costStr(md.cost) + ' · ' + md.time + ' s'}</span></button>`; } } }
      if (e.built && e.def === 'laboratorio') {
        h += '<div class="grid">';
        for (const k in S.RESEARCH) { const r = S.RESEARCH[k]; const lk = !p.research[k] && S.lockReason(sim, human, 'research', k); h += `<button class="act ${lk ? 'locked' : ''}" data-research="${k}" ${p.research[k] ? 'disabled' : ''} ${lk ? `data-lock="${esc(lk)}"` : ''} title="${esc((lk ? '🔒 ' + lk + ' · ' : '') + r.desc)}"><span class="n">${esc(r.name)}${p.research[k] ? ' ✓' : ''}</span><span class="cost">${lk ? '🔒 Era ' + S.ERAS[r.era].roman : costStr(r.cost)}</span></button>`; }
        h += '</div>';
        { const a = S.ASCENSION[p.faction]; if (a) { const lk = p.ascended ? null : (p.era || 1) < 3 ? 'Requer Era III (Domínio)' : null; h += `<button class="act ascend ${lk ? 'locked' : ''}" data-ascend="1" ${p.ascended ? 'disabled' : ''} ${lk ? `data-lock="${esc(lk)}"` : ''} title="${esc(a.desc)}"><span class="n">✦ Ascensão: ${esc(a.name)}${p.ascended ? ' ✓' : ''}</span><span class="cost">${lk ? '🔒 Era III' : p.ascended ? esc(a.desc) : costStr(a.cost)}</span></button>`; } }
        const cd = Math.max(0, p.superCd - sim.time);
        h += `<button class="act super" data-super="1" ${cd > 0 ? 'disabled' : ''} title="${esc(fac.superDesc)}"><span class="n">${esc(fac.superName)}${cd > 0 ? ' · ' + mmss(cd) : ''}</span><span class="cost">${costStr(S.SUPER_COST)}</span></button>`;
      }
      if (e.jumpT > 0) h += `<div class="tip">Salto em ${Math.ceil(e.jumpT)} s. O Núcleo está visível para todos.</div>`;
      panel.innerHTML = h;
      panel.querySelectorAll('[data-prod]').forEach(b => { let lp = null, fired = false; // 4.1a: +1 clique, +5 Shift ou segurar no toque, +10 Ctrl
        b.addEventListener('pointerdown', ev => { if (ev.pointerType !== 'touch' || b.dataset.lock) return; fired = false; lp = setTimeout(() => { fired = true; I.cmd({ t: 'produce', id: e.id, def: b.dataset.prod, n: 5 }); if (navigator.vibrate) navigator.vibrate(15); notice('+5 na fila'); }, 480); });
        b.addEventListener('pointerup', () => clearTimeout(lp)); b.addEventListener('pointerleave', () => clearTimeout(lp));
        b.addEventListener('click', ev => { if (b.dataset.lock) { notice('🔒 ' + b.dataset.lock); return; } if (fired) { fired = false; return; } I.cmd({ t: 'produce', id: e.id, def: b.dataset.prod, n: ev.ctrlKey || ev.metaKey ? 10 : ev.shiftKey ? 5 : 1 }); }); });
      panel.querySelectorAll('[data-cancel]').forEach(b => b.addEventListener('click', ev => I.cmd({ t: 'cancel', id: e.id, def: b.dataset.def, all: ev.shiftKey })));
      panel.querySelectorAll('[data-research]').forEach(b => b.addEventListener('click', () => { if (b.dataset.lock) { notice('🔒 ' + b.dataset.lock); return; } I.cmd({ t: 'research', key: b.dataset.research }); }));
      panel.querySelectorAll('[data-evolve]').forEach(b => b.addEventListener('click', () => { if (b.dataset.lock) { notice('🔒 ' + b.dataset.lock); return; } I.cmd({ t: 'evolve' }); }));
      panel.querySelectorAll('[data-upgrade]').forEach(b => b.addEventListener('click', () => { if (b.dataset.lock) { notice('🔒 ' + b.dataset.lock); return; } I.cmd({ t: 'upgrade', id: e.id }); }));
      panel.querySelectorAll('[data-ascend]').forEach(b => b.addEventListener('click', () => { if (b.dataset.lock) { notice('🔒 ' + b.dataset.lock); return; } I.cmd({ t: 'ascend' }); }));
      panel.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => { if (b.dataset.mode === 'jump') I.setMode('jump'); else I.setMode('rally'); notice(b.dataset.mode === 'jump' ? 'Clique no mapa para escolher o destino do Salto' : 'Clique no mapa para definir o ponto de reunião'); }));
      const sb = panel.querySelector('[data-super]'); if (sb) sb.addEventListener('click', () => superClick(fac));
      return;
    }
    // units
    const counts = {}; for (const u of ents) if (u.kind === 'unit') counts[u.def] = (counts[u.def] || 0) + 1;
    let h = `<div class="ph"><b>${ents.length} unidade${ents.length > 1 ? 's' : ''}</b></div><div class="chips">`;
    for (const k in counts) h += `<span class="chip">${counts[k]}× ${esc(S.unitName(fac.id, k))}</span>`;
    h += '</div>';
    if (ents.length === 1) { const u = ents[0]; h += `<div class="hp" data-live="${u.id}"><i style="width:${(100 * u.hp / u.maxHp)}%"></i></div><div class="muted small"><span data-livetxt="${u.id}">${fmt(u.hp)} / ${fmt(u.maxHp)}</span> · ${S.CLASS_NAMES[u.cls]}${u.rank ? ' · ' + ['', '★ Veterano', '★★ Elite', '★★★ Lenda'][u.rank] : ''}${u.elo ? ' · Acorde ' + u.elo + (u.elo >= 3 ? ' ♪' : '') : ''} · ${esc(S.UNITS[u.def].desc)}</div>`; if (u.cargoTotal > 0) h += `<div class="muted small">Carga: ${fmt(u.cargoTotal)}${u.stolen ? ' (roubada)' : ''}</div>`; }
    const combat = ents.some(u => S.UNITS[u.def].attack);
    h += `<div class="row">${combat ? `<button class="act sm ${I.mode === 'attackmove' ? 'on' : ''}" data-u="attackmove"><span class="k">A</span> Atacar-mover</button>` : ''}<button class="act sm" data-u="stop"><span class="k">S</span> Parar</button></div>`;
    if (counts.pirata) h += '<div class="tip">' + S.unitName(fac.id, 'pirata') + ': clique com o direito em uma Refinaria ou Reator inimigo para Sifonar (40 s). Entrega sozinho quando enche ou após 40 s; mandado de volta, entrega ao chegar perto da Refinaria ou do Núcleo. Se morrer carregado, a carga vira Caixa.' + (fac.cloak && fac.cloak.pirata ? ' Camuflado até começar a sifonar; Torres e Núcleo enxergam de perto.' : '') + (fac.devour ? ' Carniceiro: clique direito numa carcaça ou num Nódulo inimigo para devorar (biomassa direto no cofre).' : '') + (fac.silence ? ' Enquanto sifona, torres inimigas a até 110 ficam mudas.' : '') + '</div>';
    if (counts.coletor) h += '<div class="tip">Coletor: colhe sozinho no seu território. Mandado a outro lugar (clique direito no chão ou num nó), colhe os nós em volta e entrega na Refinaria ou no Núcleo mais perto.</div>';
    panel.innerHTML = h;
    panel.querySelectorAll('[data-u]').forEach(b => b.addEventListener('click', () => { if (b.dataset.u === 'stop') I.cmd({ t: 'stop', ids: ents.map(u => u.id) }); else I.setMode(I.mode === 'attackmove' ? 'normal' : 'attackmove'); }));
  }
  function buildMenuHTML(p) {
    let h = `<div class="ph"><b>Construir</b> <span class="muted small">(B, depois a tecla)</span></div><div class="grid">`;
    for (const k in S.BUILDINGS) { const d = S.BUILDINGS[k]; if (!d.key) continue; const can = S.canAfford(p, d.cost); const lk = S.lockReason(sim, human, 'building', k); h += `<button class="act ${can ? '' : 'poor'} ${lk ? 'locked' : ''} ${view.ghost && view.ghost.def === k ? 'on' : ''}" data-build="${k}" ${lk ? `data-lock="${esc(lk)}"` : ''} title="${esc((lk ? '🔒 ' + lk + ' · ' : '') + d.desc)}">${lk ? `<span class="lockb">${S.ERAS[d.era || 1].roman}</span>` : ''}<img class="ico" alt="" src="${R.icon(k, human)}"><span class="k">${d.key}</span><span class="n">${esc(d.name)}</span><span class="cost">${costStr(d.cost)}</span></button>`; }
    h += '</div>';
    if (!view.sel.size) h += '<div class="tip">Nada selecionado. Clique em unidades ou arraste uma caixa. F1 seleciona o Núcleo, F2 o exército.</div>';
    return h;
  }
  function bindBuildMenu() { $('panel').querySelectorAll('[data-build]').forEach(b => b.addEventListener('click', () => { if (b.dataset.lock) { notice('🔒 ' + b.dataset.lock); return; } I.buildMenu = false; I.setMode('build', b.dataset.build); notice(G.isTouch ? 'Arraste para posicionar e toque em ✓ Construir aqui' : 'Posicione e clique para construir. Shift mantém o modo.'); })); }
  function refreshQuick() {
    const p = sim.players[human]; const fac = S.FACTIONS[p.faction];
    const oc = $('btn-over'); const cd = Math.max(0, p.overchargeCd - sim.time);
    oc.disabled = cd > 0 || p.res.plasma < S.OVERCHARGE_COST; oc.querySelector('.sub').textContent = cd > 0 ? 'recarga ' + mmss(cd) : '200 Plasma · +50% energia 60 s';
    const sp = $('btn-super'); const lab = S.hasBuilt(sim, human, 'laboratorio'); const scd = Math.max(0, p.superCd - sim.time);
    sp.querySelector('.n').textContent = fac.superName; const era3 = (p.era || 1) >= 3; sp.disabled = !lab || !era3 || scd > 0 || !S.canAfford(p, S.SUPER_COST);
    sp.querySelector('.sub').textContent = !lab ? 'requer Laboratório' : !era3 ? 'requer Era III' : scd > 0 ? 'recarga ' + mmss(scd) : '300 Dados · 200 Plasma';
    const dp = $('btn-diplo'); dp.classList.toggle('attn', !!G.pendingFor);
    $('btn-build').classList.toggle('on', I.buildMenu || I.mode === 'build');
    $('btn-attack').classList.toggle('on', I.mode === 'attackmove');
    $('btn-box').classList.toggle('on', I.touchBox);
  }
  function bindHUD() {
    document.querySelectorAll('[data-speed]').forEach(b => b.addEventListener('click', () => { if (net) { notice('Velocidade fixa no multiplayer'); return; } G.speed = parseFloat(b.dataset.speed); G.paused = false; refreshTop(); }));
    $('btn-pause').addEventListener('click', () => ui.togglePause());
    $('btn-over').addEventListener('click', () => I.cmd({ t: 'overcharge' }));
    $('btn-super').addEventListener('click', () => superClick(fac()));
    $('btn-diplo').addEventListener('click', () => openDiplo());
    $('btn-help').addEventListener('click', () => toggleHelp(true));
    $('btn-menu').addEventListener('click', () => ui.confirm('Encerrar esta partida e voltar ao início?' + (G.autoSave ? ' Para continuar depois, use 💾 › Pausar e sair.' : ''), () => { G.leaving = true; const go = () => goStart(); if (net) mpSession.clear(); if (G.autoSave && ARD.saves) within(ARD.saves.del('auto'), 2500).then(go, go); else go(); })); // 4.2g: sem relançar a missão nem regravar o 'auto'
    if ($('btn-save')) $('btn-save').addEventListener('click', () => openSaveBox());
    if ($('idle-col')) $('idle-col').addEventListener('click', () => { const ids = (G.idleCol || []).filter(id => { const u = sim.byId.get(id); return u && u.alive; }); if (!ids.length) return; I.select(ids); const u = sim.byId.get(ids[0]); if (u) I.center(u.x, u.y); notice(ids.length + (ids.length > 1 ? ' coletores parados selecionados' : ' coletor parado selecionado') + ': clique com o botão direito num campo de recursos para mandá-los colher.'); }); // 4.2h
    if ($('pausebox')) $('pausebox').addEventListener('click', () => { if (G.paused && !G.ended) { G.paused = false; G.autoPaused = false; G.pauseWhy = null; refreshTop(); notice('Continuando'); } }); // 4.2f: pausa visível; clique continua
    $('btn-build').addEventListener('click', () => { I.buildMenu = !I.buildMenu; view.sel = new Set(); ui.buildMenuChanged(I.buildMenu); });
    $('btn-attack').addEventListener('click', () => I.setMode(I.mode === 'attackmove' ? 'normal' : 'attackmove'));
    $('btn-box').addEventListener('click', () => { I.touchBox = !I.touchBox; refreshQuick(); notice(I.touchBox ? 'Arraste para selecionar em caixa' : 'Arraste para mover a câmera'); });
    $('btn-stop').addEventListener('click', () => { const ids = [...view.sel].filter(id => { const e = sim.byId.get(id); return e && e.alive && e.kind === 'unit' && e.owner === human; }); if (ids.length) I.cmd({ t: 'stop', ids }); });
    $('btn-nucleo').addEventListener('click', () => { const n = S.nucleoOf(sim, human); if (n) { I.select([n.id]); I.center(n.x, n.y); } });
    $('btn-clear').addEventListener('click', () => { I.select([]); if (I.mode !== 'normal') I.setMode('normal'); });
    $('btn-rot').addEventListener('click', () => { if (R.supportsYaw) view.cam.yaw = (view.cam.yaw || 0) + Math.PI / 2; else notice('Rotação só no modo 3D'); });
    { const TILTS = [0.95, 0.62, 0.3], TN = ['Câmera tática', 'Câmera inclinada', 'Câmera de horizonte (planeta-mãe no céu)']; const tb = $('btn-tilt'); if (tb) tb.addEventListener('click', () => { if (!R.CAM) { notice('Inclinação só no modo 3D'); return; } const i = (TILTS.findIndex(t => Math.abs(t - view.cam.pitchT) < 0.05) + 1) % TILTS.length; view.cam.pitchT = TILTS[i]; notice(TN[i] + ' · PageUp/PageDown ou Ctrl + rolagem ajustam'); }); }
    $('btn-all').addEventListener('click', () => { const n = I.selectOnScreen(); notice(n ? n + ' unidades selecionadas' : 'Nenhuma unidade de combate na tela'); });
    const syncAudioBtns = () => { $('btn-sound').classList.toggle('on', AU.enabled); $('btn-voice').classList.toggle('on', AU.voice); };
    $('btn-sound').addEventListener('click', () => { AU.setEnabled(!AU.enabled); AU.init(); syncAudioBtns(); if (AU.enabled) AU.sfx('click'); });
    $('btn-voice').addEventListener('click', () => { AU.setVoice(!AU.voice); syncAudioBtns(); if (AU.voice) AU.say('Voz ativada', 'voz-on', 0); });
    syncAudioBtns();
    $('btn-army').addEventListener('click', () => { const ids = []; for (const en of sim.ents) if (en.alive && en.owner === human && en.kind === 'unit' && S.UNITS[en.def].attack) ids.push(en.id); I.select(ids); if (ids.length) { const e = sim.byId.get(ids[0]); I.center(e.x, e.y); } });
    mini.addEventListener('pointerdown', e => { e.preventDefault(); const r = mini.getBoundingClientRect(); const [x, y] = R.miniToWorld((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height); if (e.button === 2) { const ids = [...view.sel].filter(id => { const u = sim.byId.get(id); return u && u.alive && u.kind === 'unit' && u.owner === human; }); if (ids.length) I.cmd({ t: 'attackmove', ids, x, y }); } else I.center(x, y); });
    mini.addEventListener('contextmenu', e => e.preventDefault());
    $('hints-close').addEventListener('click', () => { $('hints').hidden = true; G.hintsOff = true; });
    document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => ui.closeModals()));
  }
  function fac() { return S.FACTIONS[sim.players[human].faction]; }
  const SUPER_TARGETED = { fundicao: 'Clique em território seu para derrubar o Bastião', eclosao: 'Clique num ponto visível para a Eclosão' };
  function superClick(f) { if (SUPER_TARGETED[f.superKey]) { I.setMode('super'); notice(SUPER_TARGETED[f.superKey]); } else I.cmd({ t: 'super' }); }

  // ---------- diplomacy ----------
  function openDiplo() {
    const m = $('diplo'); m.hidden = false; const p = sim.players[human]; let h = '';
    // 4.0c — cena frente a frente: seu líder à esquerda, o líder da sala em foco à direita (pacto = sereno, guerra = furioso); passe o mouse ou toque numa linha para trocar
    const others = sim.players.filter(q => q.id !== human); const focus = others.find(q => q.alive) || others[0];
    const scene = q => { const pact = q && p.pacts[q.id]; const me = leaderArt(p.faction, pact ? 1 : 2), them = q && leaderArt(q.faction, q.alive ? (pact ? 1 : 2) : 1);
      return `<div class="dp-side me">${me ? `<img src="${me}" alt="">` : ''}<div><b>${LEADER_NAME[p.faction] || ''}</b><div class="muted small">${S.FACTIONS[p.faction].short} · você</div></div></div><div class="dp-vs">${pact ? '🤝' : '⚔'}</div><div class="dp-side them${q && !q.alive ? ' dead' : ''}" style="--rc2:${q ? q.color : '#888'}"><div style="text-align:right"><b>${q ? (LEADER_NAME[q.faction] || '') : '—'}</b><div class="muted small">${q ? S.FACTIONS[q.faction].short + ' · ' + esc(q.name) + (q.alive ? '' : ' · eliminado') : ''}</div></div>${them ? `<img src="${them}" alt="">` : ''}</div>`; };
    if (focus) h += `<div class="dp-scene" id="dp-scene">${scene(focus)}</div>`;
    h += `<div class="muted small">Sua reputação: <b>${S.REP_NAMES[p.rep]}</b>. Pactos cumpridos sobem a reputação; quebrar pactos derruba. Caução: 150 Minério por lado, devolvida ao fim do pacto; quem quebra perde a dele para a vítima.${fac().pactHalf ? ' Como Quorith, sua Caução é 75 e cada pacto cumprido rende o dobro de reputação.' : ''}</div>`;
    for (const q of sim.players) {
      if (q.id === human) continue;
      const pact = p.pacts[q.id]; const pending = sim.pending.find(pr => pr.from === q.id && pr.to === human); const mine = sim.pending.find(pr => pr.from === human && pr.to === q.id);
      h += `<div class="dp ${q.alive ? '' : 'dead'}" data-pid="${q.id}"><div class="dp-h">${leaderArt(q.faction) ? `<img class="dp-lead" src="${leaderArt(q.faction)}" alt="">` : ''}<span class="dot" style="background:${q.color}"></span><b>${esc(q.name)}</b> <span class="muted">· ${LEADER_NAME[q.faction] || ''}</span> <span class="muted">· ${S.FACTIONS[q.faction].short} · ${q.alive ? S.REP_NAMES[q.rep] : 'eliminado'}</span></div>`;
      if (!q.alive) { h += '</div>'; continue; }
      if (pact) h += `<div class="small">Não-agressão ativa · restam ${mmss(pact.until - sim.time)}</div><button class="act sm danger" data-break="${q.id}">Quebrar pacto (Golpe de Traição)</button>`;
      else if (pending) h += `<div class="small">Propõe Não-agressão (10 min, Caução 150)</div><div class="row"><button class="act sm good" data-accept="${q.id}">Aceitar</button><button class="act sm" data-decline="${q.id}">Recusar</button></div>`;
      else if (mine) h += `<div class="small muted">Proposta enviada, aguardando resposta</div>`;
      else h += `<button class="act sm" data-propose="${q.id}" ${p.res.minerio < S.pactCost(p) ? 'disabled' : ''}>Propor Não-agressão (Caução ${S.pactCost(p)})</button>`;
      h += '</div>';
    }
    $('diplo-body').innerHTML = h;
    m.querySelectorAll('.dp[data-pid]').forEach(el => { const f = () => { const sc = $('dp-scene'); if (sc) sc.innerHTML = scene(sim.players[parseInt(el.dataset.pid, 10)]); }; el.addEventListener('mouseenter', f); el.addEventListener('click', f); });
    m.querySelectorAll('[data-propose]').forEach(b => b.addEventListener('click', () => { I.cmd({ t: 'propose', to: parseInt(b.dataset.propose, 10) }); setTimeout(openDiplo, 150); }));
    m.querySelectorAll('[data-accept]').forEach(b => b.addEventListener('click', () => { I.cmd({ t: 'respond', to: parseInt(b.dataset.accept, 10), accept: true }); G.pendingFor = null; setTimeout(openDiplo, 150); }));
    m.querySelectorAll('[data-decline]').forEach(b => b.addEventListener('click', () => { I.cmd({ t: 'respond', to: parseInt(b.dataset.decline, 10), accept: false }); G.pendingFor = null; setTimeout(openDiplo, 150); }));
    m.querySelectorAll('[data-break]').forEach(b => b.addEventListener('click', () => { const id = parseInt(b.dataset.break, 10); ui.confirm('Quebrar o pacto com ' + sim.players[id].name + '? Você perde a Caução, ganha +20% de dano por 45 s e sua Reputação cai.', () => { I.cmd({ t: 'break', with: id }); setTimeout(openDiplo, 150); }); }));
  }
  function showProposal(from) { const q = sim.players[from]; const el = $('proposal'); el.hidden = false; $('proposal-text').textContent = q.name + ' propõe um pacto de Não-agressão por 10 min (Caução 150 Minério).'; $('prop-yes').onclick = () => { I.cmd({ t: 'respond', to: from, accept: true }); el.hidden = true; G.pendingFor = null; }; $('prop-no').onclick = () => { I.cmd({ t: 'respond', to: from, accept: false }); el.hidden = true; G.pendingFor = null; }; setTimeout(() => { el.hidden = true; }, 30000); }

  // ---------- hints ----------
  function makeHints() {
    return [
      { id: 'col', text: 'Selecione o Núcleo (F1) e produza Coletores (C) até ter 5.', done: () => S.entitiesOf(sim, human).filter(e => e.kind === 'unit' && e.def === 'coletor').length >= 5 },
      { id: 'reator', text: 'Construa um Reator (B → R). Energia abaixo de 100% deixa tudo mais lento.', done: () => S.hasBuilt(sim, human, 'reator') },
      { id: 'quartel', text: 'Construa um Quartel (B → Q) e treine Infantaria (I).', done: () => S.hasBuilt(sim, human, 'quartel') },
      { id: 'nodulo', text: 'Expanda com um Nódulo (B → N) perto de cristais de Plasma. Coletores colhem sozinhos no seu território; para outro campo, mande-os com o botão direito.', done: () => S.hasBuilt(sim, human, 'nodulo') },
      { id: 'refinaria', text: 'Uma Refinaria (B → F) perto dos nós encurta as viagens dos coletores.', done: () => S.hasBuilt(sim, human, 'refinaria') },
      { id: 'muro', text: 'Muros (B → M) se desenham arrastando o mouse. Deixe um Portão (G) para suas unidades passarem.', done: () => S.hasBuilt(sim, human, 'muro') || sim.time > 600 },
      { id: 'pirata', text: 'Treine um Pirata (P) no Quartel e clique com o direito em uma Refinaria inimiga para Sifonar.', done: () => sim.players[human].stats.stolen > 0 },
      { id: 'diplo', text: 'Abra a Diplomacia e proponha Não-agressão a quem está forte demais. Ou quebre um pacto na hora certa.', done: () => sim.players[human].stats.treaties > 0 || sim.players[human].stats.betrayals > 0 || sim.time > 540 },
      { id: 'lab', text: 'Um Laboratório (B → L) libera pesquisas e a superarma da sua Raça.', done: () => S.hasBuilt(sim, human, 'laboratorio') },
    ];
  }
  function refreshHints() {
    if (G.hintsOff) return;
    const todo = G.hints.filter(h => !h.done()).slice(0, 2);
    const box = $('hints'); if (!todo.length) { box.hidden = true; return; }
    box.hidden = false; $('hints-body').innerHTML = (G.isTouch ? todo.slice(0, 1) : todo).map((h, i) => `<div class="hint ${i === 0 ? 'now' : ''}">${esc(h.text)}</div>`).join('');
  }

  function setupNet() {
    $('chat').hidden = false; document.querySelectorAll('[data-speed]').forEach(b => { b.disabled = true; b.style.opacity = 0.4; });
    const log = (who, text) => { const d = document.createElement('div'); d.textContent = who ? who + ': ' + text : text; $('chat-log').appendChild(d); $('chat-log').scrollTop = 9999; while ($('chat-log').children.length > 30) $('chat-log').firstChild.remove(); };
    const myName = sim.players[human].name;
    log('', 'Sala ' + net.code + ': ' + sim.players.map(p => p.name).join(', ') + '.');
    $('chat-in').addEventListener('keydown', e => { if (e.key === 'Enter') { const t = $('chat-in').value.trim(); if (t) { net.chat(t); log(myName, t); } $('chat-in').value = ''; e.stopPropagation(); } e.stopPropagation(); });
    net.on('chat', d => { const nm = d.name || (sim.players[d.id] || {}).name || '?'; const tx = String(d.text || '').slice(0, 120); log(nm, tx); notice(nm + ': ' + tx.slice(0, 60)); AU.sfx('click'); });
    net.on('left', d => { const nm = (sim.players[d.id] || {}).name || d.name || 'Um jogador'; banner('Jogador desconectado', nm + ' caiu; as unidades dele ficam paradas. Se voltar em até 2 minutos, retoma o comando.', 'warn'); log('', nm + ' desconectou.'); });
    // 4.1c: queda curta não encerra a partida. O convidado tenta voltar à sala por até 2 min; o anfitrião guarda o lugar e manda o estado.
    const tryRejoin = () => { if (!G.rejoin || G.ended || G.sim !== sim) return; if (performance.now() - G.rejoin.since > 120000) { G.rejoin = null; banner('Não foi possível voltar à sala', 'O anfitrião não respondeu em 2 minutos. A partida terminou para você.', 'danger', 12000); log('', 'Volta à sala esgotada.'); return; }
      G.rejoin.tries++; net.rejoin(); clearTimeout(G.rejoin.t); G.rejoin.t = setTimeout(() => { if (G.rejoin && net.state !== 'connected') tryRejoin(); }, 6000); };
    net.on('close', () => { if (net.role !== 'guest' || G.ended) return; if (!G.rejoin) { G.rejoin = { since: performance.now(), tries: 0 }; banner('Conexão perdida', 'Tentando voltar à sala… a partida continua de onde parou.', 'warn', 8000); log('', 'Conexão perdida com o anfitrião; reconectando.'); setTimeout(tryRejoin, 1500); } });
    net.on('rejoin-fail', () => {});
    net.on('rejoin-no', d => { if (G.rejoin) clearTimeout(G.rejoin.t); G.rejoin = null; mpSession.clear(); banner('A sala recusou a volta', 'Motivo: ' + (d.why || '?') + '.', 'danger', 12000); log('', 'Volta recusada: ' + (d.why || '?')); });
    net.on('state', st => { if (G.rejoin) clearTimeout(G.rejoin.t); G.rejoin = null; try { S.restore(sim, st.snap); } catch (e) { banner('Falha ao sincronizar', String(e.message || e), 'danger'); return; } net.sentFor = sim.tick - 1; G.pending = []; G.acc = 0; G.waiting = false; banner('De volta à sala', 'Partida sincronizada no tempo ' + ARD.saves.mmss(sim.time) + '.', 'good', 6000); log('', 'Reconectado à sala ' + net.code + '.'); });
    net.on('rejoin-request', () => ({ tick: sim.tick, snap: S.snapshot(sim) }));
    net.on('back', d => { const nm = (sim.players[d.id] || {}).name || d.name || 'Um jogador'; banner('Jogador voltou', nm + ' voltou à partida.', 'good'); log('', nm + ' voltou.'); });
    if (net.role === 'guest') { mpSession.touch(); setInterval(() => { if (!G.ended && net.state === 'connected') mpSession.touch(); }, 5000); }
    net.on('desync', d => { banner('Dessincronização', 'Os mundos divergiram no tick ' + d.tick + '. Isto não deveria acontecer; exporte o resultado no fim e envie o feedback com os navegadores usados.', 'danger'); log('', 'Dessincronização no tick ' + d.tick + ' (jogador ' + ((sim.players[d.id] || {}).name || d.id) + ').'); });
    if (net.role === 'host') setInterval(() => net.ping(), 5000);
  }
  // ---------- end ----------
  function endGame(result) {
    if (G.ended) return; G.ended = true; if (G.autoSave && ARD.saves) ARD.saves.del('auto'); if (net) mpSession.clear(); // partida terminada não volta
    if (result.campaign) { // 4.0e: fim de missão
      const r = result.campaign; const prep = G.camp.prep; const scores = sim.players.map(q => ({ id: q.id, name: q.name, score: q.alive ? S.score(sim, q) : 0, alive: q.alive }));
      result = { outcome: r.won ? 'victory' : 'defeat', reason: r.reason, scores };
      const fin = ARD.campUI.finish(G.camp, r.won, sim, human, G.track, 'campanha'); $('objectives').hidden = true; $('comms').hidden = true;
      $('end-eyebrow').textContent = 'Campanha · ' + prep.mission.title + ' · ' + prep.diff.label; $('end-camp').innerHTML = fin.html; $('end-camp').hidden = false;
      const base = location.pathname; const keep = new URLSearchParams(location.search); for (const k of ['missao', 'dif', 'raca', 'campanha', 'autostart', 'iniciar']) keep.delete(k); const q = k => base + '?' + new URLSearchParams(Object.assign(Object.fromEntries(keep), k)).toString();
      $('btn-next').hidden = !fin.next; if (fin.next) $('btn-next').onclick = () => { location.href = q({ missao: fin.next, dif: prep.difficulty, raca: prep.race, iniciar: '1' }); };
      { const fb = $('end-feedback'); if (fb) fb.href = feedbackUrl({ resultado: r.won ? 'missão cumprida' : 'missão falhou', estrelas: r.stars }); }
      $('btn-camp-menu').hidden = false; $('btn-camp-menu').onclick = () => { location.href = q({ campanha: '1' }); };
      { const art = leaderArt(sim.players[human].faction, r.won ? 3 : 2); if (art) { $('end-leader').src = art; $('end-leader').hidden = false; } }
      $('end').hidden = false; $('end-title').textContent = r.won ? 'MISSÃO CUMPRIDA' : 'MISSÃO FALHOU'; $('end-title').className = result.outcome; $('end-reason').textContent = r.reason;
      $('end-scores').innerHTML = ''; const st = sim.players[human].stats; $('end-stats').innerHTML = [['Tempo', mmss(r.time || sim.time)], ['Coletado', fmt(st.collected)], ['Roubado', fmt(st.stolen)], ['Unidades abatidas', st.unitsKilled], ['Unidades perdidas', st.unitsLost], ['Estruturas destruídas', st.buildingsDestroyed]].map(([k, v]) => `<div class="stat"><span>${k}</span><b>${v}</b></div>`).join('');
      $('btn-again').textContent = 'Repetir missão'; $('btn-again').onclick = () => { location.href = q({ missao: prep.mission.id, dif: prep.difficulty, raca: prep.race, iniciar: '1' }); };
      $('btn-copy').onclick = () => { const ta = $('end-json'); ta.hidden = false; ta.value = JSON.stringify({ versao: VERSION, missao: prep.mission.id, dificuldade: prep.difficulty, raca: prep.race, resultado: r, objetivos: G.camp.run.objectives.map(o => ({ id: o.id, feito: o.done })) }, null, 2); ta.select(); };
      return;
    }
    if (result.outcome === 'over') { const me = sim.players[human]; result = Object.assign({}, result, { outcome: me.alive && result.winner === human ? 'victory' : 'defeat', reason: result.reason + (result.winner >= 0 ? ' Vencedor: ' + sim.players[result.winner].name + '.' : '') }); }
    const p = sim.players[human]; const st = p.stats;
    { const art = leaderArt(p.faction, result.outcome === 'victory' ? 3 : 2); if (art) { $('end-leader').src = art; $('end-leader').hidden = false; } }
    $('end').hidden = false; $('end-title').textContent = result.outcome === 'victory' ? 'DOMÍNIO' : 'COLAPSO'; $('end-title').className = result.outcome;
    $('end-reason').textContent = result.reason;
    const rows = result.scores.slice().sort((a, b) => b.score - a.score).map((s, i) => `<tr><td>${i + 1}</td><td><span class="dot" style="background:${sim.players[s.id].color}"></span>${esc(s.name)}</td><td>${s.alive ? fmt(s.score) : 'eliminado'}</td></tr>`).join('');
    $('end-scores').innerHTML = `<table><thead><tr><th>#</th><th>Jogador</th><th>Domínio</th></tr></thead><tbody>${rows}</tbody></table>`;
    $('end-stats').innerHTML = [['Coletado', fmt(st.collected)], ['Roubado', fmt(st.stolen)], ['Perdido para roubo', fmt(st.lost)], ['Unidades abatidas', st.unitsKilled], ['Unidades perdidas', st.unitsLost], ['Estruturas destruídas', st.buildingsDestroyed], ['Tratados', st.treaties], ['Traições', st.betrayals], ['Reputação final', S.REP_NAMES[p.rep]]].map(([k, v]) => `<div class="stat"><span>${k}</span><b>${v}</b></div>`).join('');
    { const fb = $('end-feedback'); if (fb) fb.href = feedbackUrl({ resultado: result.outcome }); }
    if (ARD.campUI) { try { const fin = ARD.campUI.finish(null, result.outcome === 'victory', sim, human, G.track, net ? 'multiplayer' : 'escaramuca'); $('end-camp').innerHTML = fin.html; $('end-camp').hidden = false; } catch (e) { console.warn('[ARD] progresso indisponível:', e); } }
    $('btn-again').onclick = () => location.reload();
    $('btn-copy').onclick = () => { const data = { versao: VERSION, data: new Date().toISOString(), seed: sim.seed, faccao: p.faction, dificuldade: p.difficulty, jogadores: sim.players.map(x => ({ nome: x.name, faccao: x.faction, humano: x.human, vivo: x.alive })), resultado: result.outcome, motivo: result.reason, duracao_s: Math.round(sim.time), placar: result.scores, estatisticas: st, reputacao: S.REP_NAMES[p.rep], graficos: R.is3d ? '3d' : '2d', qualidade: R.quality ? R.quality.name : null, reduzido: R.degraded || [], shaders: R.shaderErrors || [], gpu: R.gpu || null, build: BUILD, multiplayer: !!net, aparelho: navigator.userAgent.slice(0, 80) }; const txt = JSON.stringify(data, null, 2); const done = () => { $('btn-copy').textContent = 'Copiado! Cole na Issue de feedback'; }; if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done).catch(() => { $('end-json').hidden = false; $('end-json').value = txt; $('end-json').select(); }); else { $('end-json').hidden = false; $('end-json').value = txt; $('end-json').select(); } };
  }

  // ---------- UI bridge for input ----------
  function makeUI() {
    return {
      selectionChanged() { I.buildMenu = false; refreshPanel(true); refreshQuick(); },
      modeChanged() { refreshPanel(true); refreshQuick(); this.placeChanged(); },
      placeChanged() { const pb = $('placebar'); if (!pb) return; const g = view.ghost; const on = G.isTouch && I.mode === 'build' && g && !S.BUILDINGS[g.def].wall; pb.hidden = !on; document.body.classList.toggle('placing', !!on); if (!on) return; const ok = S.canBuild(sim, human, g.def, g.x, g.y); const afford = S.canAfford(sim.players[human], S.BUILDINGS[g.def].cost); $('pb-text').textContent = S.BUILDINGS[g.def].name + ' · ' + (!ok.ok ? ok.why : !afford ? 'recursos insuficientes' : 'local válido · arraste para ajustar'); $('pb-ok').disabled = !(ok.ok && afford); },
      buildMenuChanged() { refreshPanel(true); refreshQuick(); },
      touchBoxChanged() { refreshQuick(); },
      notice, confirm: confirmModal, modalOpen() { return !$('diplo').hidden || !$('help').hidden || !$('confirm').hidden || !$('savebox').hidden; }, // 4.2g: com Salvar partida aberta as teclas não comandam o jogo
      enqueue(c) { if (net) G.pending.push(c); else S.enqueue(sim, c); },
      closeModals() { $('diplo').hidden = true; $('help').hidden = true; $('confirm').hidden = true; if (G.closeSave) G.closeSave(); },
      toggleHelp() { toggleHelp(); }, togglePause() { if (net) { notice('Sem pausa no multiplayer'); return; } if (G.camp && G.camp.noPause) { notice('Sem pausa na dificuldade Fenda'); return; } G.paused = !G.paused; if (!G.paused) G.pauseWhy = null; else G.pauseWhy = 'Partida pausada.'; refreshTop(); if (!G.paused) notice('Continuando'); },
    };
  }
  function confirmModal(text, onYes) { const m = $('confirm'); m.hidden = false; $('confirm-text').textContent = text; $('confirm-yes').onclick = () => { m.hidden = true; onYes(); }; $('confirm-no').onclick = () => { m.hidden = true; }; }
}

function toggleHelp(force) { const h = $('help'); h.hidden = force === true ? false : !h.hidden; }

window.addEventListener('error', e => { const el = $('errbox'); if (el) { el.hidden = false; el.textContent = 'Erro: ' + (e.message || e.error); } });
{ const setBuild = () => { const el = $('build-info'); if (el) el.textContent = 'Build ' + BUILD + ' · GPU: ' + gpuName(); }; if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setBuild); else setBuild(); }
window.addEventListener('unhandledrejection', e => { const el = $('errbox'); if (el) { el.hidden = false; el.textContent = 'Erro (promise): ' + (e.reason && (e.reason.stack || e.reason.message) || e.reason); } });
document.addEventListener('DOMContentLoaded', initStart);
if (params.get('debug')) { const oe = console.error, ow = console.warn; const cap = (...a) => { const el = $('errbox'); if (el) { el.hidden = false; el.textContent += ' || ' + a.map(x => String(x && x.message || x)).join(' ').slice(0, 400); } }; console.error = (...a) => { cap(...a); oe.apply(console, a); }; console.warn = (...a) => { cap(...a); ow.apply(console, a); }; }
for (const ev of ['pointerdown', 'keydown', 'touchstart']) document.addEventListener(ev, () => { ARD.audio.init(); ARD.audio.resume(); }, { passive: true });
if (params.get('debug')) setTimeout(() => {
  const out = [];
  out.push('vw=' + innerWidth + ' sw=' + document.documentElement.scrollWidth);
  for (const sel of ['#start', '.start-wrap', '.start-grid', '.fac-cards', '.fac-card', '.opts', '.eyebrow', 'h1', '#game', '#panel', '#top', '#right', '#bar']) { const el = document.querySelector(sel); if (el) out.push(sel + '=' + Math.round(el.getBoundingClientRect().width) + 'x' + Math.round(el.getBoundingClientRect().height)); }
  const d = document.createElement('pre'); d.id = 'dbg'; d.textContent = out.join('\n'); document.body.appendChild(d);
}, 800);
})(globalThis.ARD = globalThis.ARD || {});
