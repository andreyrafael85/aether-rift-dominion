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
let G = null; // game state

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
  const facWrap = $('fac-cards'); facWrap.innerHTML = '';
  for (const id of ['vehnar', 'erevane']) {
    const f = S.FACTIONS[id];
    const el = document.createElement('label'); el.className = 'fac-card'; el.dataset.id = id;
    el.innerHTML = `<input type="radio" name="fac" value="${id}" ${((prefs.faction || 'vehnar') === id) ? 'checked' : ''}><div class="fac-name">${f.name}</div><div class="fac-tag">${f.tagline}</div><div class="fac-sup"><b>Superarma:</b> ${f.superName}. <b>Pirata:</b> ${f.pirateName}.</div>`;
    facWrap.appendChild(el);
  }
  $('opt-name').value = prefs.name || 'Comandante';
  $('opt-opp').value = prefs.opp || '2';
  $('opt-diff').value = prefs.diff || 'normal';
  $('opt-seed').value = params.get('seed') || String(Math.floor(Math.random() * 90000) + 1000);
  $('opt-gfx').value = prefs.gfx || '3d'; $('opt-quality').value = prefs.quality || 'auto';
  // multiplayer P2P por código de sala
  const mpStatus = t => { $('mp-status').textContent = t; };
  const myInfo = () => ({ name: $('opt-name').value.trim().slice(0, 18) || 'Comandante', faction: (document.querySelector('input[name=fac]:checked') || {}).value || 'vehnar' });
  $('btn-host').addEventListener('click', () => {
    if (!window.Peer) { mpStatus('PeerJS não carregou neste navegador.'); return; }
    const N = ARD.net.create(); mpStatus('Criando sala…');
    N.on('error', e => mpStatus('Erro de rede: ' + e.message));
    N.on('open', () => mpStatus('Jogador conectado. Iniciando…'));
    N.on('hello', d => {
      const me = myInfo(); const opp = parseInt($('opt-opp').value, 10); const facs = ['vehnar', 'erevane']; const aiNames = ['Fundição Kessari', 'Clã Sombrio', 'Consórcio Oryn'];
      const players = [{ name: me.name, faction: me.faction, human: true }, { name: (d.name || 'Convidado').slice(0, 18), faction: d.faction === 'erevane' ? 'erevane' : 'vehnar', human: true }];
      for (let i = 0; i < Math.min(2, opp); i++) players.push({ name: aiNames[i], faction: facs[i % 2], difficulty: $('opt-diff').value });
      const cfg = { players, seed: parseInt($('opt-seed').value, 10) || 1, diff: $('opt-diff').value, gfx: $('opt-gfx').value, quality: $('opt-quality').value, name: me.name, faction: me.faction, opp: String(players.length - 2) };
      N.send('start', { cfg: Object.assign({}, cfg, { gfx: undefined, quality: undefined }) });
      setTimeout(() => startGame(cfg, { net: N, myId: 0 }), 150);
    });
    N.host(code => { $('opt-code').value = code; mpStatus('Sala ' + code + ' criada. Envie o código ao seu amigo e aguarde a conexão…'); });
  });
  $('btn-join').addEventListener('click', () => {
    if (!window.Peer) { mpStatus('PeerJS não carregou neste navegador.'); return; }
    const code = $('opt-code').value.trim(); if (code.length < 4) { mpStatus('Digite o código da sala.'); return; }
    const N = ARD.net.create(); mpStatus('Conectando à sala ' + code.toUpperCase() + '…');
    N.on('error', e => mpStatus('Erro de rede: ' + e.message + ' (sala existe? ambos online?)'));
    N.on('open', () => { mpStatus('Conectado. Aguardando o anfitrião iniciar…'); N.send('hello', myInfo()); });
    N.on('start', d => { const cfg = Object.assign({}, d.cfg, { gfx: $('opt-gfx').value, quality: $('opt-quality').value }); startGame(cfg, { net: N, myId: 1 }); });
    N.join(code);
  });
  $('btn-start').addEventListener('click', () => {
    const faction = (document.querySelector('input[name=fac]:checked') || {}).value || 'vehnar';
    const cfg = { name: $('opt-name').value.trim().slice(0, 18) || 'Comandante', faction, opp: $('opt-opp').value, diff: $('opt-diff').value, seed: parseInt($('opt-seed').value, 10) || 1, gfx: $('opt-gfx').value, quality: $('opt-quality').value };
    savePrefs(cfg); startGame(cfg);
  });
  $('btn-help-start').addEventListener('click', () => toggleHelp(true));
  if (params.get('autostart')) { startGame({ name: 'Teste', faction: params.get('faction') || 'erevane', opp: params.get('opp') || '2', diff: params.get('diff') || 'normal', seed: parseInt(params.get('seed') || '5', 10), gfx: params.get('r') === '2d' ? '2d' : '3d' }); }
}

// ---------- game ----------
function startGame(cfg, netCtx) {
  const want3dEarly = (cfg.gfx || '3d') === '3d' && params.get('r') !== '2d';
  if (want3dEarly && !window.THREE && !window.__threeFailed) { $('start').hidden = true; $('game').hidden = false; $('loading').hidden = false; $('load-bar').style.width = '5%'; whenThree(() => startGame(cfg, netCtx)); return; }
  const net = netCtx ? netCtx.net : null;
  const players = cfg.players ? cfg.players.map(p => Object.assign({}, p)) : [{ name: cfg.name, faction: cfg.faction, human: true }];
  const facs = ['vehnar', 'erevane'];
  const aiNames = { vehnar: ['Fundição Kessari', 'Consórcio Oryn', 'Estaleiro Vey'], erevane: ['Clã Sombrio', 'Náufragos de Ísk', 'Corsários da Faixa'] };
  if (!cfg.players) for (let i = 0; i < parseInt(cfg.opp, 10); i++) { const f = facs[(i + (cfg.faction === 'vehnar' ? 1 : 0)) % 2]; players.push({ name: aiNames[f][i % 3], faction: f, difficulty: cfg.diff }); }
  const sim = S.createSim({ seed: cfg.seed, players, minutes: 25 });
  const human = netCtx ? netCtx.myId : 0;
  const canvas = $('world'), mini = $('minimap'), overlay = $('overlay');
  $('start').hidden = true; $('game').hidden = false; $('end').hidden = true;
  let R = null; const want3d = (cfg.gfx || '3d') === '3d' && params.get('r') !== '2d';
  if (want3d && window.THREE) { try { R = ARD.render3d.create(canvas, overlay, mini); } catch (err) { console.warn('3D indisponível, usando 2D:', err); R = null; } }
  if (!R) { R = ARD.render.create(canvas, mini); overlay.hidden = true; if (want3d) setTimeout(() => notice('3D indisponível neste navegador; usando o modo 2D'), 1200); }
  if (R.setQuality) R.setQuality(cfg.quality || 'auto');
  R.resize();
  const nuc = S.nucleoOf(sim, human);
  const isTouch = matchMedia('(pointer: coarse)').matches || !!params.get('touch');
  const view = { cam: { x: nuc.x, y: nuc.y, zoom: isTouch ? 0.9 : 1.0, yaw: Math.PI / 4 }, sel: new Set(), hover: null, ghost: null, box: null, human, memory: new Map(), marker: null, mode: 'normal', lastAlert: null };
  const ui = makeUI(); // closures below
  const I = ARD.input.create({ canvas, sim, view, R, human, ui });
  const ais = sim.players.filter(p => !p.human).map(p => ARD.ai.create(p.id, p.difficulty));
  G = { sim, human, R, view, I, ais, speed: 1, paused: false, acc: 0, last: performance.now(), alerts: [], hints: makeHints(), selKey: '', isTouch, ended: false, pendingFor: null, net, pending: [], waiting: false, waitT: 0 };
  window.addEventListener('resize', () => R.resize());
  document.body.classList.toggle('touch', isTouch);

  bindHUD(); refreshTop(); refreshHints(); refreshQuick();
  $('loading').hidden = false;
  R.prepare(sim, f => { $('load-bar').style.width = Math.round(f * 100) + '%'; }, () => {
    $('loading').hidden = true;
    const ff = net ? 0 : parseInt(params.get('ff') || '0', 10);
    for (let i = 0; i < ff * 10; i++) tickOnce(true);
    if (net) setupNet();
    if (params.get('speed')) G.speed = parseFloat(params.get('speed')) || 1;
    if (params.get('night')) sim.tick = 3600; // teste: começa de noite
    if (params.get('reveal')) view.reveal = true; // teste: sem névoa
    if (params.get('cam')) { const n = S.nucleoOf(sim, parseInt(params.get('cam'), 10)); if (n) { view.cam.x = n.x; view.cam.y = n.y; } }
    if (params.get('zoom')) view.cam.zoom = parseFloat(params.get('zoom'));
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
    if (net) for (const c of net.takeCmds(tick, human)) S.enqueue(sim, c);
    const ev = S.step(sim);
    if (net && sim.tick % 10 === 0) net.sendHash(sim.tick, S.hash(sim));
    if (!silent) G.R.onEvents(ev, sim, human);
    handleEvents(ev, silent);
    if (sim.tick % 10 === 0) updateMemory();
  }
  function frame(now) {
    if (!G || G.sim !== sim) return;
    let dt = Math.min(0.25, (now - G.last) / 1000); G.last = now;
    if (!G.paused && !G.ended) { G.acc += dt * G.speed; let n = 0; while (G.acc >= S.TICK && n < 12) { if (tickOnce(false) === false) { G.acc = Math.min(G.acc, S.TICK); break; } G.acc -= S.TICK; n++; } if (n >= 12) G.acc = 0; }
    if (net) { G.waitT = G.waiting ? G.waitT + dt : 0; $('mp-wait').hidden = G.waitT < 0.8; if (G.waitT >= 0.8) $('mp-wait').textContent = net.state === 'lost' ? 'Conexão perdida com o outro jogador.' : 'Aguardando o outro jogador… (' + G.waitT.toFixed(0) + ' s)'; }
    I.update(dt);
    if (G.frameN % 3 === 0) refreshTop();
    if (G.frameN++ % 6 === 0) { refreshPanel(false); refreshQuick(); }
    if (G.frameN % 30 === 0) refreshHints();
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
      else if (e.t === 'end') endGame(e.result);
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
      if (e.built && d.produces) {
        h += '<div class="grid">';
        for (const ud of d.produces) { const u = S.UNITS[ud]; const name = ud === 'pirata' ? fac.pirateName : u.name; h += `<button class="act" data-prod="${ud}" title="${esc(u.desc)}"><img class="ico" alt="" src="${R.icon(ud, human)}"><span class="k">${u.key}</span><span class="n">${esc(name)}</span><span class="cost">${costStr(u.cost)}</span></button>`; }
        h += '</div>';
        if (e.queue.length) { h += '<div class="queue">'; e.queue.forEach((q, i) => { h += `<button class="q" data-cancel="${i}" title="Cancelar">${esc(S.UNITS[q.def].name)}${i === 0 ? ` <i>${Math.round(100 * q.t / q.total)}%</i>` : ''} ✕</button>`; }); h += '</div>'; }
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
      const sb = panel.querySelector('[data-super]'); if (sb) sb.addEventListener('click', () => { if (fac.superKey === 'fundicao') { I.setMode('super'); notice('Clique em território seu para derrubar o Bastião'); } else I.cmd({ t: 'super' }); });
      return;
    }
    // units
    const counts = {}; for (const u of ents) if (u.kind === 'unit') counts[u.def] = (counts[u.def] || 0) + 1;
    let h = `<div class="ph"><b>${ents.length} unidade${ents.length > 1 ? 's' : ''}</b></div><div class="chips">`;
    for (const k in counts) h += `<span class="chip">${counts[k]}× ${esc(k === 'pirata' ? fac.pirateName : S.UNITS[k].name)}</span>`;
    h += '</div>';
    if (ents.length === 1) { const u = ents[0]; h += `<div class="hp"><i style="width:${(100 * u.hp / u.maxHp)}%"></i></div><div class="muted small">${fmt(u.hp)} / ${fmt(u.maxHp)} · ${S.CLASS_NAMES[u.cls]}${u.rank ? ' · ' + ['', '★ Veterano', '★★ Elite', '★★★ Lenda'][u.rank] : ''} · ${esc(S.UNITS[u.def].desc)}</div>`; if (u.cargoTotal > 0) h += `<div class="muted small">Carga: ${fmt(u.cargoTotal)}${u.stolen ? ' (roubada)' : ''}</div>`; }
    const combat = ents.some(u => S.UNITS[u.def].attack);
    h += `<div class="row">${combat ? `<button class="act sm ${I.mode === 'attackmove' ? 'on' : ''}" data-u="attackmove"><span class="k">A</span> Atacar-mover</button>` : ''}<button class="act sm" data-u="stop"><span class="k">S</span> Parar</button></div>`;
    if (counts.pirata) h += '<div class="tip">Pirata: clique com o direito em uma Refinaria ou Reator inimigo para Sifonar (40 s). Volte à base para entregar. Se morrer carregado, a carga vira Caixa.</div>';
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
    $('btn-super').addEventListener('click', () => { if (fac().superKey === 'fundicao') { I.setMode('super'); notice('Clique em território seu para derrubar o Bastião'); } else I.cmd({ t: 'super' }); });
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

  // ---------- diplomacy ----------
  function openDiplo() {
    const m = $('diplo'); m.hidden = false; const p = sim.players[human]; let h = '';
    h += `<div class="muted small">Sua reputação: <b>${S.REP_NAMES[p.rep]}</b>. Pactos cumpridos sobem a reputação; quebrar pactos derruba. Caução: 150 Minério por lado, devolvida ao fim do pacto; quem quebra perde a dele para a vítima.</div>`;
    for (const q of sim.players) {
      if (q.id === human) continue;
      const pact = p.pacts[q.id]; const pending = sim.pending.find(pr => pr.from === q.id && pr.to === human); const mine = sim.pending.find(pr => pr.from === human && pr.to === q.id);
      h += `<div class="dp ${q.alive ? '' : 'dead'}"><div class="dp-h"><span class="dot" style="background:${q.color}"></span><b>${esc(q.name)}</b> <span class="muted">· ${S.FACTIONS[q.faction].short} · ${q.alive ? S.REP_NAMES[q.rep] : 'eliminado'}</span></div>`;
      if (!q.alive) { h += '</div>'; continue; }
      if (pact) h += `<div class="small">Não-agressão ativa · restam ${mmss(pact.until - sim.time)}</div><button class="act sm danger" data-break="${q.id}">Quebrar pacto (Golpe de Traição)</button>`;
      else if (pending) h += `<div class="small">Propõe Não-agressão (10 min, Caução 150)</div><div class="row"><button class="act sm good" data-accept="${q.id}">Aceitar</button><button class="act sm" data-decline="${q.id}">Recusar</button></div>`;
      else if (mine) h += `<div class="small muted">Proposta enviada, aguardando resposta</div>`;
      else h += `<button class="act sm" data-propose="${q.id}" ${p.res.minerio < S.PACT_CAUCAO ? 'disabled' : ''}>Propor Não-agressão (Caução 150)</button>`;
      h += '</div>';
    }
    $('diplo-body').innerHTML = h;
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
      { id: 'lab', text: 'Um Laboratório (B → L) libera pesquisas e a superarma da sua facção.', done: () => S.hasBuilt(sim, human, 'laboratorio') },
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
    const other = sim.players[human === 0 ? 1 : 0];
    log('', 'Conectado com ' + other.name + '. Sala ' + net.code + '.');
    $('chat-in').addEventListener('keydown', e => { if (e.key === 'Enter') { const t = $('chat-in').value.trim(); if (t) { net.send('chat', { text: t.slice(0, 120), name: sim.players[human].name }); log(sim.players[human].name, t); } $('chat-in').value = ''; e.stopPropagation(); } e.stopPropagation(); });
    net.on('chat', d => { log(d.name || other.name, String(d.text || '').slice(0, 120)); notice((d.name || other.name) + ': ' + String(d.text || '').slice(0, 60)); AU.sfx('click'); });
    net.on('close', () => { notice('Conexão perdida com o outro jogador'); log('', 'Conexão perdida.'); });
    net.on('desync', d => { notice('Dessincronização detectada no tick ' + d.tick + '. As partidas divergiram.'); log('', 'Dessincronização no tick ' + d.tick + '.'); });
    setInterval(() => net.ping(), 5000);
  }
  // ---------- end ----------
  function endGame(result) {
    if (G.ended) return; G.ended = true;
    if (result.outcome === 'over') { const me = sim.players[human]; result = Object.assign({}, result, { outcome: me.alive && result.winner === human ? 'victory' : 'defeat', reason: result.reason + (result.winner >= 0 ? ' Vencedor: ' + sim.players[result.winner].name + '.' : '') }); }
    const p = sim.players[human]; const st = p.stats;
    $('end').hidden = false; $('end-title').textContent = result.outcome === 'victory' ? 'DOMÍNIO' : 'COLAPSO'; $('end-title').className = result.outcome;
    $('end-reason').textContent = result.reason;
    const rows = result.scores.slice().sort((a, b) => b.score - a.score).map((s, i) => `<tr><td>${i + 1}</td><td><span class="dot" style="background:${sim.players[s.id].color}"></span>${esc(s.name)}</td><td>${s.alive ? fmt(s.score) : 'eliminado'}</td></tr>`).join('');
    $('end-scores').innerHTML = `<table><thead><tr><th>#</th><th>Jogador</th><th>Domínio</th></tr></thead><tbody>${rows}</tbody></table>`;
    $('end-stats').innerHTML = [['Coletado', fmt(st.collected)], ['Roubado', fmt(st.stolen)], ['Perdido para roubo', fmt(st.lost)], ['Unidades abatidas', st.unitsKilled], ['Unidades perdidas', st.unitsLost], ['Estruturas destruídas', st.buildingsDestroyed], ['Tratados', st.treaties], ['Traições', st.betrayals], ['Reputação final', S.REP_NAMES[p.rep]]].map(([k, v]) => `<div class="stat"><span>${k}</span><b>${v}</b></div>`).join('');
    $('btn-again').onclick = () => location.reload();
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
      toggleHelp() { toggleHelp(); }, togglePause() { if (net) { notice('Sem pausa no multiplayer'); return; } G.paused = !G.paused; refreshTop(); notice(G.paused ? 'Pausado' : 'Continuando'); },
    };
  }
  function confirmModal(text, onYes) { const m = $('confirm'); m.hidden = false; $('confirm-text').textContent = text; $('confirm-yes').onclick = () => { m.hidden = true; onYes(); }; $('confirm-no').onclick = () => { m.hidden = true; }; }
}

function toggleHelp(force) { const h = $('help'); h.hidden = force === true ? false : !h.hidden; }

window.addEventListener('error', e => { const el = $('errbox'); if (el) { el.hidden = false; el.textContent = 'Erro: ' + (e.message || e.error); } });
document.addEventListener('DOMContentLoaded', initStart);
for (const ev of ['pointerdown', 'keydown', 'touchstart']) document.addEventListener(ev, () => { ARD.audio.init(); ARD.audio.resume(); }, { passive: true });
if (params.get('debug')) setTimeout(() => {
  const out = [];
  out.push('vw=' + innerWidth + ' sw=' + document.documentElement.scrollWidth);
  for (const sel of ['#start', '.start-wrap', '.start-grid', '.fac-cards', '.fac-card', '.opts', '.eyebrow', 'h1', '#game', '#panel', '#top', '#right', '#bar']) { const el = document.querySelector(sel); if (el) out.push(sel + '=' + Math.round(el.getBoundingClientRect().width) + 'x' + Math.round(el.getBoundingClientRect().height)); }
  const d = document.createElement('pre'); d.id = 'dbg'; d.textContent = out.join('\n'); document.body.appendChild(d);
}, 800);
})(globalThis.ARD = globalThis.ARD || {});
