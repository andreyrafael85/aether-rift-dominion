/* Bootstrap: tela inicial, laço de jogo, HUD, diplomacia, dicas e tela final. */
(function (ARD) {
'use strict';
const S = ARD.sim;
const $ = id => document.getElementById(id);
const AU = ARD.audio;
const fmt = n => Math.floor(n).toLocaleString('pt-BR');
const mmss = t => { t = Math.max(0, Math.floor(t)); return String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0'); };
const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
const RES_ICON = { plasma: '◆', minerio: '▣', dados: '◈' };
const RES_NAME = { plasma: 'Plasma', minerio: 'Minério', dados: 'Dados' };
function costStr(cost) { return Object.keys(cost).filter(k => cost[k]).map(k => `<span class="c-${k}">${RES_ICON[k]} ${cost[k]}</span>`).join(' ') || '<span class="muted">grátis</span>'; }

const params = new URLSearchParams(location.search);
const BUILD = '__BUILD__';
const RACE_COLORS = { vehnar: '#FF7733', erevane: '#33FFD0', tessara: '#55E68A', quorith: '#B388FF', vorag: '#E6455A' };
// Líderes (nomes aprovados 2026-10-10) e a expressão-retrato aprovada de cada um (1 sereno · 2 furioso · 3 triunfante)
const LEADER_NAME = { vehnar: 'Barão-Forja', erevane: 'Vesper Ísk', tessara: 'Sylva Oriel', quorith: 'Zayin Coral', vorag: 'Oru Voraz' };
const LEADER_FACE = { vehnar: 3, erevane: 2, tessara: 2, quorith: 2, vorag: 1 };
const VERSION = '4.0e';
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
    el.querySelector('input').addEventListener('change', () => setRace(RACE_UI[id] || '#FF5E3A'));
    facWrap.appendChild(el);
  }
  setRace(raceColor);
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
  // 4.0e — campanha, Hangar e progresso do Comandante
  if (ARD.campUI && ARD.campaign && ARD.progress) { try { ARD.campUI.init({ $, leaderArt, LEADER_NAME, RACE_COLORS, LEADER_FACE, startGame: cfg => { savePrefs(Object.assign(loadPrefs() || {}, { gfx: cfg.gfx, quality: cfg.quality, clima: cfg.clima, name: cfg.name })); startGame(cfg); }, selectedRace: () => (document.querySelector('input[name=fac]:checked') || {}).value || 'vehnar' }); if (params.get('campanha')) ARD.campUI.openCampaign(); } catch (e) { console.warn('[ARD] campanha indisponível:', e); } }
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
  const myInfo = () => ({ name: $('opt-name').value.trim().slice(0, 18) || 'Comandante', faction: (document.querySelector('input[name=fac]:checked') || {}).value || 'vehnar', build: BUILD });
  const facName = f => (S.FACTIONS[f] && S.FACTIONS[f].short) || f;
  function renderLobby(players, size) {
    const el = $('mp-players'); el.innerHTML = ''; const me = lobby ? lobby.me : null;
    players.forEach(p => { const d = document.createElement('div'); d.textContent = (p.id === 0 ? '★ ' : '• ') + p.name + ' (' + facName(p.faction) + ')' + (p.id === 0 ? ' anfitrião' : '') + (me && p.name === me.name && (lobby.role === 'host' ? p.id === 0 : p.id !== 0) ? ' — você' : ''); el.appendChild(d); });
    for (let i = players.length; i < size; i++) { const d = document.createElement('div'); d.className = 'muted'; d.textContent = '• vaga livre'; el.appendChild(d); }
    if (lobby && lobby.warn) { const d = document.createElement('div'); d.className = 'warn'; d.textContent = '⚠ ' + lobby.warn; el.appendChild(d); }
  }
  function setStartButton() {
    const b = $('btn-start');
    $('opt-opp').disabled = !!lobby; $('opt-diff').disabled = !!lobby;
    if (!lobby) { const typed = $('opt-code').value.trim(); b.disabled = false; b.textContent = typed.length >= 4 ? 'Entrar na sala ' + typed.toUpperCase() : 'Iniciar partida'; return; }
    if (lobby.role === 'host') { const n = lobby.N.roster().length; b.disabled = n < 2 || lobby.started; b.textContent = n < 2 ? 'Aguardando jogadores…' : 'Iniciar partida (' + n + '/' + lobby.size + ')'; }
    else { b.disabled = true; b.textContent = 'Aguardando o anfitrião…'; }
  }
  function leaveLobby() { if (lobby) { if (lobby.timer) clearInterval(lobby.timer); if (lobby.role === 'host') $('opt-code').value = ''; try { lobby.N.close(); } catch (e) {} lobby = null; } $('mp-players').innerHTML = ''; setStartButton(); }
  function startHosted() {
    if (!lobby || lobby.role !== 'host' || lobby.started) return;
    const N = lobby.N; N.me = myInfo(); const roster = N.roster();
    if (roster.length < 2) { mpStatus('Aguarde pelo menos um jogador entrar na sala.'); return; }
    lobby.started = true; setStartButton();
    const players = roster.map(r => ({ name: r.name, faction: r.faction, human: true }));
    const cfg = { players, seed: parseInt($('opt-seed').value, 10) || 1, name: players[0].name, faction: players[0].faction, opp: '0', diff: 'normal' };
    N.start(cfg);
    setTimeout(() => startGame(Object.assign({}, cfg, { gfx: $('opt-gfx').value, quality: $('opt-quality').value, clima: $('opt-clima').value }), { net: N, myId: 0 }), 150);
  }
  $('btn-host').addEventListener('click', () => {
    if (!window.Peer) { mpStatus('PeerJS não carregou neste navegador.'); return; }
    if (lobby) { mpStatus('Você já está na sala ' + (lobby.code || '…') + '. Recarregue a página para sair dela.'); return; }
    const size = parseInt($('opt-room').value, 10) || 2; const me = myInfo();
    const N = ARD.net.create(); lobby = { N, role: 'host', size, code: null, started: false, me };
    mpStatus('Criando sala…'); setStartButton();
    N.on('error', e => mpStatus('Erro de rede: ' + e.message));
    N.on('warn', w => { if (lobby) { lobby.warn = w.message; renderLobby(N.roster(), lobby.size); } });
    N.on('lobby', d => { renderLobby(d.players, d.size); setStartButton(); if (lobby && !lobby.started) { if (d.players.length >= d.size) { mpStatus('Sala completa. Iniciando…'); setTimeout(startHosted, 500); } else mpStatus('Sala ' + lobby.code + ': ' + d.players.length + '/' + d.size + ' jogadores. A partida começa quando a sala encher, ou clique em Iniciar partida com 2 ou mais.'); } });
    N.host({ size, me, code: (loadPrefs() || {}).room }, code => { lobby.code = code; $('opt-code').value = code; savePrefs(Object.assign(loadPrefs() || {}, { room: code })); renderLobby(N.roster(), size); mpStatus('Sala ' + code + ' criada para ' + size + ' jogadores. Envie o código aos amigos e aguarde a entrada deles.'); });
  });
  function joinRoom(code, attempt) {
    attempt = attempt || 0;
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
    N.on('start', d => { if (!lobby || lobby.N !== N) return; lobby.started = true; if (lobby.timer) clearInterval(lobby.timer); startGame(Object.assign({}, d.cfg, { gfx: $('opt-gfx').value, quality: $('opt-quality').value, clima: $('opt-clima').value }), { net: N, myId: d.you }); });
    N.join(code, me);
  }
  $('btn-join').addEventListener('click', () => joinRoom($('opt-code').value));
  $('opt-code').addEventListener('input', () => { if (!lobby) setStartButton(); });
  $('opt-code').addEventListener('keydown', e => { if (e.key === 'Enter' && !lobby) { e.preventDefault(); joinRoom($('opt-code').value); } });
  $('btn-start').addEventListener('click', () => {
    if (lobby) { if (lobby.role === 'host') startHosted(); else mpStatus('Aguarde o anfitrião iniciar a partida.'); return; }
    const typed = $('opt-code').value.trim(); if (typed.length >= 4) { joinRoom(typed); return; } // código digitado: entra na sala, nunca inicia partida solo
    const faction = (document.querySelector('input[name=fac]:checked') || {}).value || 'vehnar';
    const cfg = { name: $('opt-name').value.trim().slice(0, 18) || 'Comandante', faction, opp: $('opt-opp').value, diff: $('opt-diff').value, seed: parseInt($('opt-seed').value, 10) || 1, gfx: $('opt-gfx').value, quality: $('opt-quality').value, clima: $('opt-clima').value };
    savePrefs(Object.assign(loadPrefs() || {}, cfg)); startGame(cfg);
  });
  $('btn-help-start').addEventListener('click', () => toggleHelp(true));
  if (params.get('autostart')) { startGame({ name: 'Teste', faction: params.get('faction') || 'erevane', opp: params.get('opp') || '2', diff: params.get('diff') || 'normal', seed: parseInt(params.get('seed') || '5', 10), gfx: params.get('r') === '2d' ? '2d' : '3d' }); }
}

// ---------- game ----------
function startGame(cfg, netCtx) {
  if (ARD.logo3d) ARD.logo3d.stop(); // libera o contexto WebGL do logo vivo antes da partida
  const want3dEarly = (cfg.gfx || '3d') === '3d' && params.get('r') !== '2d';
  if (want3dEarly && !window.THREE && !window.__threeFailed) { $('start').hidden = true; $('game').hidden = false; $('loading').hidden = false; $('load-bar').style.width = '5%'; whenThree(() => startGame(cfg, netCtx)); return; }
  const net = netCtx ? netCtx.net : null;
  const players = cfg.players ? cfg.players.map(p => Object.assign({}, p)) : [{ name: cfg.name, faction: cfg.faction, human: true }];
  const facs = ['vehnar', 'erevane'];
  const aiNames = { vehnar: ['Fundição Kessari', 'Consórcio Oryn', 'Estaleiro Vey'], erevane: ['Clã Sombrio', 'Náufragos de Ísk', 'Corsários da Faixa'], tessara: ['Linhagem Oriel', 'Ordem do Molde', 'Enxerto Vassi'], quorith: ['Coro de Zayin', 'Acorde Sétimo', 'Silêncio de Quor'], vorag: ['Prole Velk', 'Ninhada Cega', 'Fome de Oru'] };
  const facsAll = Object.keys(S.FACTIONS).filter(f => f !== cfg.faction).concat([cfg.faction]);
  if (!cfg.players) for (let i = 0; i < parseInt(cfg.opp, 10); i++) { const f = facsAll[i % facsAll.length]; players.push({ name: aiNames[f][i % 3], faction: f, difficulty: cfg.diff }); }
  if (!netCtx && !cfg.campaign && ARD.campUI) ARD.campUI.applyColor(players); // cor do Hangar nas partidas solo
  const sim = S.createSim({ seed: cfg.seed, players, minutes: cfg.minutes || 25 });
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
      L.hidden = false; G && (G.leaderFac = fac); }
    if (ART && ART.world && ART.world[fac]) { $('loading').style.backgroundImage = `linear-gradient(rgba(13,15,19,.55), rgba(13,15,19,.88)), url(${ART.world[fac]})`; $('loading').style.backgroundSize = 'cover'; $('loading').style.backgroundPosition = 'center'; }
    if (leaderArt(fac)) { $('load-leader').src = leaderArt(fac); $('load-leader').hidden = false; }
  } catch (e) { console.warn('[ARD] retrato do líder indisponível:', e); }
  R.resize();
  const nuc = S.nucleoOf(sim, human);
  if (params.get('demo') === 'birth' && !net) { sim.players[human].res.minerio += 1500; sim.players[human].res.plasma += 600; ['reator', 'refinaria', 'quartel'].forEach((d, i) => S.enqueue(sim, { t: 'build', p: human, def: d, x: nuc.x + 75 + (i % 2) * 95, y: nuc.y - 80 + i * 80, ang: 0 })); } // depuração: três canteiros para ver o nascimento
  const isTouch = matchMedia('(pointer: coarse)').matches || !!params.get('touch');
  const view = { cam: { x: nuc.x, y: nuc.y, zoom: isTouch ? 0.9 : 1.0, yaw: Math.PI / 4, pitch: 0.95, pitchT: 0.95 }, sel: new Set(), hover: null, ghost: null, box: null, human, memory: new Map(), marker: null, mode: 'normal', lastAlert: null };
  const ui = makeUI(); // closures below
  const I = ARD.input.create({ canvas, sim, view, R, human, ui });
  const ais = sim.players.filter(p => (!p.human && !(players[p.id] && players[p.id].passive)) || (!netCtx && params.get('ia') === 'todos')).map(p => ARD.ai.create(p.id, p.difficulty)); // ?ia=todos: a IA joga também pelo humano (capturas e testes)
  G = { sim, human, R, view, I, ais, speed: 1, paused: false, acc: 0, last: performance.now(), alerts: [], hints: makeHints(), selKey: '', isTouch, ended: false, pendingFor: null, net, pending: [], waiting: false, waitT: 0 };
  G.track = ARD.campUI ? ARD.campUI.tracker(sim, human) : null; // conquistas valem em qualquer partida
  G.camp = cfg.campaign && ARD.campUI ? ARD.campUI.begin(sim, cfg.campaign) : null; // 4.0e: missão da campanha
  if (R.is3d && ARD.campUI) R.skins = { [human]: ARD.campUI.skinOf(sim.players[human].faction) };
  window.addEventListener('resize', () => R.resize());
  document.body.classList.toggle('touch', isTouch);

  bindHUD(); refreshTop(); refreshHints(); refreshQuick();
  $('loading').hidden = false;
  R.humanId = human;
  R.prepare(sim, f => { $('load-bar').style.width = Math.round(f * 100) + '%'; }, () => {
    $('loading').hidden = true;
    const ff = net ? 0 : parseInt(params.get('ff') || '0', 10);
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
      if (net.sentFor == null || net.sentFor < tick) { net.scheduleLocal(tick + net.DELAY, G.pending); G.pending = []; net.sentFor = tick; }
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
    let dt = Math.min(0.25, (now - G.last) / 1000); G.last = now;
    if (!G.paused && !G.ended) { G.acc += dt * G.speed; let n = 0; while (G.acc >= S.TICK && n < 12) { if (tickOnce(false) === false) { G.acc = Math.min(G.acc, S.TICK); break; } G.acc -= S.TICK; n++; } if (n >= 12) G.acc = 0; }
    if (net) { G.waitT = G.waiting ? G.waitT + dt : 0; $('mp-wait').hidden = G.waitT < 0.8; if (G.waitT >= 0.8) $('mp-wait').textContent = net.state === 'lost' ? 'Conexão perdida.' : 'Aguardando os outros jogadores… (' + G.waitT.toFixed(0) + ' s)'; }
    I.update(dt);
    if (G.frameN % 3 === 0) refreshTop();
    if (G.frameN++ % 6 === 0) { refreshPanel(false); refreshQuick(); }
    if (G.frameN % 30 === 0) refreshHints();
    if (G.camp && G.frameN % 10 === 0) { G.camp.frame(); if (R.setBeacon) R.setBeacon(G.camp.beacon(), G.camp.vip()); }
    R.draw(sim, view, G.paused ? 1 : Math.min(1, G.acc / S.TICK), dt);
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
      if (e.t === 'alert' && e.p === human) { if (e.x != null) view.lastAlert = { x: e.x, y: e.y }; if (!silent) pushAlert(e); }
      else if (e.t === 'notice' && e.p === human && !silent) notice(e.text);
      else if (e.t === 'proposal' && e.p === human && !silent) { G.pendingFor = e.from; showProposal(e.from); }
      else if (e.t === 'eliminated' && !silent) { const q = sim.players[e.p]; const left = sim.players.filter(x => x.alive && x.id !== human).length; if (e.p !== human) { banner(q.name + ' eliminado', left > 0 ? left + (left > 1 ? ' inimigos restantes' : ' inimigo restante') + ' · destrua todos os Núcleos ou vença por Domínio aos 25:00' : 'Todos os Núcleos inimigos caíram', 'good'); AU.sfx('promote'); AU.say(q.name + ' eliminado. ' + (left > 0 ? left + (left > 1 ? ' inimigos restantes' : ' inimigo restante') : ''), 'elim', 0); } }
      else if (e.t === 'trait' && e.owner === human && !silent) AU.sfx('promote');
      else if (e.t === 'end') { if (!G.camp) endGame(e.result); }
      else if (e.t === 'regime' && e.p === human && !silent) notice('Energia: ' + S.REGIME[e.regime].name);
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
  function leaderMood(mood, ms) { const fac = sim.players[human].faction; const art = leaderArt(fac, mood); const L = $('leader'); if (!art || !L || L.hidden) return; $('leader-img').src = art; L.classList.remove('mood'); void L.offsetWidth; L.classList.add('mood'); clearTimeout(G.moodT); G.moodT = setTimeout(() => { $('leader-img').src = leaderArt(fac); }, ms || 4500); }
  function banner(title, sub, kind) { const L = $('leader'); if (L && !L.hidden) { L.classList.remove('talk'); void L.offsetWidth; L.classList.add('talk'); } if (kind === 'danger' || kind === 'warn') leaderMood(2); else if (kind === 'good') leaderMood(3); const b = $('banner'); $('banner-title').textContent = title; $('banner-sub').textContent = sub || ''; b.className = 'banner ' + (kind || 'info'); b.hidden = false; clearTimeout(G.bannerT); G.bannerT = setTimeout(() => { b.hidden = true; }, 5000); }
  function notice(text) { const n = $('notice'); n.textContent = text; n.classList.add('show'); clearTimeout(G.noticeT); G.noticeT = setTimeout(() => n.classList.remove('show'), 2200); }

  // ---------- HUD ----------
  function refreshTop() {
    const p = sim.players[human];
    $('r-plasma').textContent = fmt(p.res.plasma); $('r-minerio').textContent = fmt(p.res.minerio); $('r-dados').textContent = fmt(p.res.dados);
    const en = p.energy; const reg = $('energy'); reg.className = 'energy ' + en.regime;
    $('e-text').textContent = `${Math.round(en.prod)} / ${Math.round(en.cons)}`; $('e-regime').textContent = S.REGIME[en.regime].name + (p.overchargeT > 0 ? ' · Sobrecarga' : '') + (p.blackoutT > 0 ? ' · BLECAUTE' : '');
    $('e-bar').style.width = Math.min(100, en.ratio * 100 / 1.5) + '%';
    $('clock').textContent = mmss(sim.time) + ' / ' + mmss(sim.maxTime);
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
  function refreshPanel(force) {
    const ents = selectionSummary();
    const key = ents.map(e => e.id + ':' + Math.round(e.hp) + ':' + (e.queue ? e.queue.length + ':' + (e.queue[0] ? Math.floor(e.queue[0].t) : '') : '') + ':' + (e.built ? 1 : Math.floor(e.progress * 20)) + ':' + (e.amount != null ? Math.floor(e.amount) : '')).join('|') + '|' + I.buildMenu + '|' + I.mode + '|' + Object.keys(sim.players[human].research).length;
    if (!force && key === G.selKey) return; G.selKey = key;
    const panel = $('panel'); const p = sim.players[human]; const fac = S.FACTIONS[p.faction];
    if (!ents.length || I.buildMenu) { panel.innerHTML = buildMenuHTML(p); bindBuildMenu(); return; }
    const e = ents[0];
    if (e.kind === 'wreck') { panel.innerHTML = `<div class="ph"><span class="dot" style="background:#8A5A3A"></span><b>Carcaça de ${esc(S.UNITS[e.def] ? S.UNITS[e.def].name : 'veículo')}</b></div><div class="muted">${fmt(e.amount)} de Minério recuperável</div><div class="muted small">Coletores podem saquear carcaças em qualquer lugar: clique direito com um coletor.</div>`; return; }
    if (e.kind === 'node') { panel.innerHTML = `<div class="ph"><span class="dot" style="background:${ARD.render.NODE_COLOR[e.res]}"></span><b>Nó de ${RES_NAME[e.res]}</b></div><div class="muted">${fmt(e.amount)} / ${fmt(e.max)} restantes</div><div class="muted small">Coletores colhem automaticamente nós dentro do seu território. Clique direito com coletores para colher manualmente.</div>`; return; }
    if (e.owner !== human) {
      const q = sim.players[e.owner]; const d = e.kind === 'unit' ? S.UNITS[e.def] : S.BUILDINGS[e.def];
      panel.innerHTML = `<div class="ph"><span class="dot" style="background:${q.color}"></span><b>${esc(d.name)}</b> <span class="muted">· ${esc(q.name)} (${S.FACTIONS[q.faction].short})</span></div><div class="hp"><i style="width:${(100 * e.hp / e.maxHp)}%"></i></div><div class="muted small">${fmt(e.hp)} / ${fmt(e.maxHp)} · ${e.kind === 'unit' ? S.CLASS_NAMES[e.cls] : 'Estrutura'} · ${S.hasPact(sim, human, e.owner) ? 'Em pacto de Não-agressão' : 'Inimigo'}</div>${e.kind === 'building' && (e.def === 'refinaria' || e.def === 'reator') ? '<div class="tip">Alvo de Sifão: selecione um Pirata e clique com o botão direito aqui.</div>' : ''}`;
      return;
    }
    if (e.kind === 'building' && ents.length === 1) {
      const d = S.BUILDINGS[e.def]; let h = `<div class="ph"><span class="dot" style="background:${p.color}"></span><b>${esc(d.name)}</b></div><div class="hp"><i style="width:${(100 * e.hp / e.maxHp)}%"></i></div><div class="muted small">${fmt(e.hp)} / ${fmt(e.maxHp)}${e.built ? '' : ' · construção ' + Math.round(e.progress * 100) + '%'}${d.energyProd ? ' · +' + d.energyProd + ' energia' : ''}${d.energyUse ? ' · −' + d.energyUse + ' energia' : ''}</div><div class="muted small">${esc(d.desc)}</div>`;
      const prodList = S.producesFor(e.def, p.faction);
      if (e.built && prodList.length) {
        h += '<div class="grid">';
        for (const ud of prodList) { const u = S.UNITS[ud]; const name = S.unitName(fac.id, ud); h += `<button class="act" data-prod="${ud}" title="${esc(u.desc)}"><img class="ico" alt="" src="${R.icon(ud, human)}"><span class="k">${u.key}</span><span class="n">${esc(name)}</span><span class="cost">${costStr(u.cost)}</span></button>`; }
        h += '</div>';
        if (e.queue.length) { h += '<div class="queue">'; e.queue.forEach((q, i) => { h += `<button class="q" data-cancel="${i}" title="Cancelar">${esc(S.unitName(fac.id, q.def))}${i === 0 ? ` <i>${Math.round(100 * q.t / q.total)}%</i>` : ''} ✕</button>`; }); h += '</div>'; }
        h += `<div class="row"><button class="act sm" data-mode="rally">Ponto de reunião</button>${e.def === 'nucleo' ? `<button class="act sm" data-mode="jump" ${p.jumpsLeft > 0 && e.jumpT <= 0 ? '' : 'disabled'}>Salto de Núcleo (${p.jumpsLeft})</button>` : ''}</div>`;
      }
      if (e.built && e.def === 'laboratorio') {
        h += '<div class="grid">';
        for (const k in S.RESEARCH) { const r = S.RESEARCH[k]; h += `<button class="act" data-research="${k}" ${p.research[k] ? 'disabled' : ''} title="${esc(r.desc)}"><span class="n">${esc(r.name)}${p.research[k] ? ' ✓' : ''}</span><span class="cost">${costStr(r.cost)}</span></button>`; }
        h += '</div>';
        const cd = Math.max(0, p.superCd - sim.time);
        h += `<button class="act super" data-super="1" ${cd > 0 ? 'disabled' : ''} title="${esc(fac.superDesc)}"><span class="n">${esc(fac.superName)}${cd > 0 ? ' · ' + mmss(cd) : ''}</span><span class="cost">${costStr(S.SUPER_COST)}</span></button>`;
      }
      if (e.jumpT > 0) h += `<div class="tip">Salto em ${Math.ceil(e.jumpT)} s. O Núcleo está visível para todos.</div>`;
      panel.innerHTML = h;
      panel.querySelectorAll('[data-prod]').forEach(b => b.addEventListener('click', () => I.cmd({ t: 'produce', id: e.id, def: b.dataset.prod })));
      panel.querySelectorAll('[data-cancel]').forEach(b => b.addEventListener('click', () => I.cmd({ t: 'cancel', id: e.id, index: parseInt(b.dataset.cancel, 10) })));
      panel.querySelectorAll('[data-research]').forEach(b => b.addEventListener('click', () => I.cmd({ t: 'research', key: b.dataset.research })));
      panel.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => { if (b.dataset.mode === 'jump') I.setMode('jump'); else I.setMode('rally'); notice(b.dataset.mode === 'jump' ? 'Clique no mapa para escolher o destino do Salto' : 'Clique no mapa para definir o ponto de reunião'); }));
      const sb = panel.querySelector('[data-super]'); if (sb) sb.addEventListener('click', () => superClick(fac));
      return;
    }
    // units
    const counts = {}; for (const u of ents) if (u.kind === 'unit') counts[u.def] = (counts[u.def] || 0) + 1;
    let h = `<div class="ph"><b>${ents.length} unidade${ents.length > 1 ? 's' : ''}</b></div><div class="chips">`;
    for (const k in counts) h += `<span class="chip">${counts[k]}× ${esc(S.unitName(fac.id, k))}</span>`;
    h += '</div>';
    if (ents.length === 1) { const u = ents[0]; h += `<div class="hp"><i style="width:${(100 * u.hp / u.maxHp)}%"></i></div><div class="muted small">${fmt(u.hp)} / ${fmt(u.maxHp)} · ${S.CLASS_NAMES[u.cls]}${u.rank ? ' · ' + ['', '★ Veterano', '★★ Elite', '★★★ Lenda'][u.rank] : ''}${u.elo ? ' · Acorde ' + u.elo + (u.elo >= 3 ? ' ♪' : '') : ''} · ${esc(S.UNITS[u.def].desc)}</div>`; if (u.cargoTotal > 0) h += `<div class="muted small">Carga: ${fmt(u.cargoTotal)}${u.stolen ? ' (roubada)' : ''}</div>`; }
    const combat = ents.some(u => S.UNITS[u.def].attack);
    h += `<div class="row">${combat ? `<button class="act sm ${I.mode === 'attackmove' ? 'on' : ''}" data-u="attackmove"><span class="k">A</span> Atacar-mover</button>` : ''}<button class="act sm" data-u="stop"><span class="k">S</span> Parar</button></div>`;
    if (counts.pirata) h += '<div class="tip">' + S.unitName(fac.id, 'pirata') + ': clique com o direito em uma Refinaria ou Reator inimigo para Sifonar (40 s). Volte à base para entregar. Se morrer carregado, a carga vira Caixa.' + (fac.devour ? ' Carniceiro: clique direito numa carcaça ou num Nódulo inimigo para devorar (biomassa direto no cofre).' : '') + (fac.silence ? ' Enquanto sifona, torres inimigas a até 110 ficam mudas.' : '') + '</div>';
    if (counts.coletor) h += '<div class="tip">Coletor: colhe sozinho nós dentro do seu território. Clique direito em um nó para escolher manualmente.</div>';
    panel.innerHTML = h;
    panel.querySelectorAll('[data-u]').forEach(b => b.addEventListener('click', () => { if (b.dataset.u === 'stop') I.cmd({ t: 'stop', ids: ents.map(u => u.id) }); else I.setMode(I.mode === 'attackmove' ? 'normal' : 'attackmove'); }));
  }
  function buildMenuHTML(p) {
    let h = `<div class="ph"><b>Construir</b> <span class="muted small">(B, depois a tecla)</span></div><div class="grid">`;
    for (const k in S.BUILDINGS) { const d = S.BUILDINGS[k]; if (!d.key) continue; const can = S.canAfford(p, d.cost); h += `<button class="act ${can ? '' : 'poor'} ${view.ghost && view.ghost.def === k ? 'on' : ''}" data-build="${k}" title="${esc(d.desc)}"><img class="ico" alt="" src="${R.icon(k, human)}"><span class="k">${d.key}</span><span class="n">${esc(d.name)}</span><span class="cost">${costStr(d.cost)}</span></button>`; }
    h += '</div>';
    if (!view.sel.size) h += '<div class="tip">Nada selecionado. Clique em unidades ou arraste uma caixa. F1 seleciona o Núcleo, F2 o exército.</div>';
    return h;
  }
  function bindBuildMenu() { $('panel').querySelectorAll('[data-build]').forEach(b => b.addEventListener('click', () => { I.buildMenu = false; I.setMode('build', b.dataset.build); notice('Posicione e clique para construir. Shift mantém o modo.'); })); }
  function refreshQuick() {
    const p = sim.players[human]; const fac = S.FACTIONS[p.faction];
    const oc = $('btn-over'); const cd = Math.max(0, p.overchargeCd - sim.time);
    oc.disabled = cd > 0 || p.res.plasma < S.OVERCHARGE_COST; oc.querySelector('.sub').textContent = cd > 0 ? 'recarga ' + mmss(cd) : '200 Plasma · +50% energia 60 s';
    const sp = $('btn-super'); const lab = S.hasBuilt(sim, human, 'laboratorio'); const scd = Math.max(0, p.superCd - sim.time);
    sp.querySelector('.n').textContent = fac.superName; sp.disabled = !lab || scd > 0 || !S.canAfford(p, S.SUPER_COST);
    sp.querySelector('.sub').textContent = !lab ? 'requer Laboratório' : scd > 0 ? 'recarga ' + mmss(scd) : '300 Dados · 200 Plasma';
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
    $('btn-menu').addEventListener('click', () => ui.confirm('Encerrar esta partida e voltar ao início?', () => location.reload()));
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
      { id: 'nodulo', text: 'Expanda com um Nódulo (B → N) perto de cristais de Plasma. Coletores só colhem no seu território.', done: () => S.hasBuilt(sim, human, 'nodulo') },
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
    net.on('left', d => { const nm = (sim.players[d.id] || {}).name || d.name || 'Um jogador'; banner('Jogador desconectado', nm + ' saiu da partida; as unidades dele ficam paradas.', 'warn'); log('', nm + ' desconectou.'); });
    net.on('close', () => { if (net.role === 'guest') { banner('Conexão perdida', 'A ligação com o anfitrião caiu; a partida não pode continuar.', 'danger'); log('', 'Conexão perdida com o anfitrião.'); } });
    net.on('desync', d => { banner('Dessincronização', 'Os mundos divergiram no tick ' + d.tick + '. Isto não deveria acontecer; exporte o resultado no fim e envie o feedback com os navegadores usados.', 'danger'); log('', 'Dessincronização no tick ' + d.tick + ' (jogador ' + ((sim.players[d.id] || {}).name || d.id) + ').'); });
    if (net.role === 'host') setInterval(() => net.ping(), 5000);
  }
  // ---------- end ----------
  function endGame(result) {
    if (G.ended) return; G.ended = true;
    if (result.campaign) { // 4.0e: fim de missão
      const r = result.campaign; const prep = G.camp.prep; const scores = sim.players.map(q => ({ id: q.id, name: q.name, score: q.alive ? S.score(sim, q) : 0, alive: q.alive }));
      result = { outcome: r.won ? 'victory' : 'defeat', reason: r.reason, scores };
      const fin = ARD.campUI.finish(G.camp, r.won, sim, human, G.track, 'campanha'); $('objectives').hidden = true; $('comms').hidden = true;
      $('end-eyebrow').textContent = 'Campanha · ' + prep.mission.title + ' · ' + prep.diff.label; $('end-camp').innerHTML = fin.html; $('end-camp').hidden = false;
      const base = location.pathname; const keep = new URLSearchParams(location.search); for (const k of ['missao', 'dif', 'raca', 'campanha', 'autostart']) keep.delete(k); const q = k => base + '?' + new URLSearchParams(Object.assign(Object.fromEntries(keep), k)).toString();
      $('btn-next').hidden = !fin.next; if (fin.next) $('btn-next').onclick = () => { location.href = q({ missao: fin.next, dif: prep.difficulty, raca: prep.race }); };
      $('btn-camp-menu').hidden = false; $('btn-camp-menu').onclick = () => { location.href = q({ campanha: '1' }); };
      { const art = leaderArt(sim.players[human].faction, r.won ? 3 : 2); if (art) { $('end-leader').src = art; $('end-leader').hidden = false; } }
      $('end').hidden = false; $('end-title').textContent = r.won ? 'MISSÃO CUMPRIDA' : 'MISSÃO FALHOU'; $('end-title').className = result.outcome; $('end-reason').textContent = r.reason;
      $('end-scores').innerHTML = ''; const st = sim.players[human].stats; $('end-stats').innerHTML = [['Tempo', mmss(r.time || sim.time)], ['Coletado', fmt(st.collected)], ['Roubado', fmt(st.stolen)], ['Unidades abatidas', st.unitsKilled], ['Unidades perdidas', st.unitsLost], ['Estruturas destruídas', st.buildingsDestroyed]].map(([k, v]) => `<div class="stat"><span>${k}</span><b>${v}</b></div>`).join('');
      $('btn-again').textContent = 'Repetir missão'; $('btn-again').onclick = () => { location.href = q({ missao: prep.mission.id, dif: prep.difficulty, raca: prep.race }); };
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
    if (ARD.campUI) { try { const fin = ARD.campUI.finish(null, result.outcome === 'victory', sim, human, G.track, net ? 'multiplayer' : 'escaramuca'); $('end-camp').innerHTML = fin.html; $('end-camp').hidden = false; } catch (e) { console.warn('[ARD] progresso indisponível:', e); } }
    $('btn-again').onclick = () => location.reload();
    $('btn-copy').onclick = () => { const data = { versao: VERSION, data: new Date().toISOString(), seed: sim.seed, faccao: p.faction, dificuldade: p.difficulty, jogadores: sim.players.map(x => ({ nome: x.name, faccao: x.faction, humano: x.human, vivo: x.alive })), resultado: result.outcome, motivo: result.reason, duracao_s: Math.round(sim.time), placar: result.scores, estatisticas: st, reputacao: S.REP_NAMES[p.rep], graficos: R.is3d ? '3d' : '2d', qualidade: R.quality ? R.quality.name : null, reduzido: R.degraded || [], shaders: R.shaderErrors || [], gpu: R.gpu || null, build: BUILD, multiplayer: !!net, aparelho: navigator.userAgent.slice(0, 80) }; const txt = JSON.stringify(data, null, 2); const done = () => { $('btn-copy').textContent = 'Copiado! Cole na Issue de feedback'; }; if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done).catch(() => { $('end-json').hidden = false; $('end-json').value = txt; $('end-json').select(); }); else { $('end-json').hidden = false; $('end-json').value = txt; $('end-json').select(); } };
  }

  // ---------- UI bridge for input ----------
  function makeUI() {
    return {
      selectionChanged() { I.buildMenu = false; refreshPanel(true); refreshQuick(); },
      modeChanged() { refreshPanel(true); refreshQuick(); },
      buildMenuChanged() { refreshPanel(true); refreshQuick(); },
      touchBoxChanged() { refreshQuick(); },
      notice, confirm: confirmModal, modalOpen() { return !$('diplo').hidden || !$('help').hidden || !$('confirm').hidden; },
      enqueue(c) { if (net) G.pending.push(c); else S.enqueue(sim, c); },
      closeModals() { $('diplo').hidden = true; $('help').hidden = true; $('confirm').hidden = true; },
      toggleHelp() { toggleHelp(); }, togglePause() { if (net) { notice('Sem pausa no multiplayer'); return; } if (G.camp && G.camp.noPause) { notice('Sem pausa na dificuldade Fenda'); return; } G.paused = !G.paused; refreshTop(); notice(G.paused ? 'Pausado' : 'Continuando'); },
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
