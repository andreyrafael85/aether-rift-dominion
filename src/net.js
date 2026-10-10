/* Rede P2P (PeerJS, WebRTC) para salas de 2 a 4 jogadores. O anfitrião é o relé do lockstep: cada jogador manda os
   comandos do tick T ao anfitrião, que junta os de todos em ordem fixa e devolve o pacote do tick; ninguém avança o
   tick T sem o pacote. Também: sala por código, lista de jogadores, checksums por tick, chat e aviso de desconexão. */
(function (ARD) {
'use strict';
const PROTO = 2; // versão do protocolo: anfitrião e convidados precisam coincidir
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function makeCode() { let c = ''; for (let i = 0; i < 6; i++) c += ALPHA[Math.floor(Math.random() * ALPHA.length)]; return c; }
const errText = t => ({ 'peer-unavailable': 'sala não encontrada (código errado ou anfitrião offline)', 'network': 'sem conexão com o servidor de sinalização', 'server-error': 'servidor de sinalização indisponível', 'browser-incompatible': 'navegador sem WebRTC', 'unavailable-id': 'código em uso' }[t] || t);
function create() {
  const N = { state: 'idle', role: null, code: null, size: 2, id: 0, me: null, started: false, peer: null, hostConn: null, guests: [], players: [], handlers: {}, DELAY: 3, bundles: new Map(), collect: new Map(), hashes: new Map(), desync: false, dropped: new Set(), rtt: 0 };
  N.on = (t, fn) => { N.handlers[t] = fn; };
  function fire(t, p) { if (N.handlers[t]) N.handlers[t](p); }
  function sendTo(conn, msg) { try { conn.send(msg); } catch (e) {} }
  function broadcast(msg, except) { for (const g of N.guests) if (g.open && g.conn !== except) sendTo(g.conn, msg); }
  const readyGuests = () => N.guests.filter(g => g.ready);
  N.roster = () => N.role === 'host' ? [{ id: 0, name: N.me.name, faction: N.me.faction }].concat(readyGuests().map((g, i) => ({ id: i + 1, name: g.name, faction: g.faction }))) : N.players;
  function lobbyMsg() { return { t: 'lobby', players: N.roster(), size: N.size }; }
  function pushLobby() { const m = lobbyMsg(); broadcast(m); fire('lobby', m); }
  // ---- anfitrião
  function bindGuest(conn) {
    const g = { conn, name: '', faction: 'vehnar', ready: false, open: false, id: -1, rtt: 0 };
    N.guests.push(g);
    const full = () => N.started || readyGuests().length >= N.size - 1;
    conn.on('open', () => { g.open = true; if (full()) { sendTo(conn, { t: 'full' }); setTimeout(() => { try { conn.close(); } catch (e) {} }, 400); } });
    conn.on('data', d => {
      if (!d || typeof d !== 'object') return;
      if (d.t === 'hello') {
        if (g.ready) return;
        if (d.v !== PROTO) { sendTo(conn, { t: 'bad-version', v: PROTO, build: N.me.build || '' }); fire('error', { message: 'o convidado ' + String(d.name || '?').slice(0, 18) + ' está com outra versão do jogo; peça para atualizar a página (Ctrl+F5)' }); setTimeout(() => { try { conn.close(); } catch (e) {} }, 500); return; }
        if (full()) { sendTo(conn, { t: 'full' }); return; }
        g.name = String(d.name || 'Convidado').slice(0, 18); g.faction = String(d.faction || 'vehnar'); g.ready = true;
        if (d.build && N.me.build && d.build !== N.me.build) fire('warn', { message: 'build diferente em ' + g.name + ' (' + d.build + ' × ' + N.me.build + '); se algo falhar, Ctrl+F5 nos dois lados' });
        sendTo(conn, { t: 'welcome', size: N.size, v: PROTO, build: N.me.build || '' }); pushLobby();
      }
      else if (d.t === 'cmds') { if (g.id >= 0 && !N.dropped.has(g.id)) { put(d.tick, g.id, d.cmds || []); tryBundle(d.tick); } }
      else if (d.t === 'hash') { if (g.id >= 0) checkHash(d.tick, d.h, g.id); }
      else if (d.t === 'chat') { const m = { t: 'chat', id: g.id, name: g.name, text: String(d.text || '').slice(0, 120) }; broadcast(m, conn); fire('chat', m); }
      else if (d.t === 'pong') { g.rtt = performance.now() - d.s; N.rtt = Math.max.apply(null, N.guests.map(x => x.rtt || 0)); }
    });
    let gone = false;
    const onGone = () => {
      if (gone) return; gone = true; const wasReady = g.ready; g.open = false; g.ready = false;
      const i = N.guests.indexOf(g); if (i >= 0) N.guests.splice(i, 1);
      console.warn('[ARD] rede: conexão fechada de ' + (g.name || '?') + ' (id ' + g.id + ', started=' + N.started + ')');
      if (N.started) { if (g.id >= 0 && !N.dropped.has(g.id)) { N.dropped.add(g.id); const m = { t: 'left', id: g.id, name: g.name }; broadcast(m); fire('left', m); for (const t of Array.from(N.collect.keys())) tryBundle(t); } }
      else if (wasReady) pushLobby();
    };
    conn.on('close', onGone); conn.on('error', onGone);
  }
  N.host = function (opts, onReady) {
    if (typeof Peer === 'undefined') { fire('error', { message: 'PeerJS não carregou' }); return; }
    N.role = 'host'; N.me = opts.me; N.size = Math.max(2, Math.min(4, opts.size | 0 || 2)); N.state = 'hosting'; N.id = 0;
    let tries = 0;
    const open = () => {
      N.code = (tries === 0 && opts.code && /^[A-Z2-9]{6}$/.test(String(opts.code).toUpperCase())) ? String(opts.code).toUpperCase() : makeCode(); // reaproveita o código da última sala deste navegador
      N.peer = new Peer('aether-rift-' + N.code.toLowerCase(), { debug: 0 });
      N.peer.on('open', () => { if (onReady) onReady(N.code); });
      N.peer.on('connection', conn => bindGuest(conn));
      N.peer.on('error', e => { const type = String(e && e.type || e); if (type === 'unavailable-id' && tries++ < 3) { try { N.peer.destroy(); } catch (x) {} open(); return; } fire('error', { message: errText(type) }); });
    };
    open();
  };
  N.start = function (cfg) { // só o anfitrião: fixa os ids finais e avisa todos
    N.me = { name: cfg.players[0].name, faction: cfg.players[0].faction };
    const rg = readyGuests(); rg.forEach((g, i) => { g.id = i + 1; });
    N.players = N.roster(); N.started = true;
    for (const g of rg) sendTo(g.conn, { t: 'start', cfg, you: g.id, players: N.players });
    for (const g of N.guests) if (!g.ready && g.open) { sendTo(g.conn, { t: 'full' }); }
  };
  // ---- convidado
  function send(msg) { if (N.hostConn && N.state === 'connected') try { N.hostConn.send(msg); } catch (e) {} }
  N.join = function (code, me) {
    if (typeof Peer === 'undefined') { fire('error', { message: 'PeerJS não carregou' }); return; }
    N.role = 'guest'; N.me = me; N.code = code.trim().toUpperCase(); N.state = 'joining';
    N.peer = new Peer({ debug: 0 });
    N.peer.on('open', () => {
      const conn = N.peer.connect('aether-rift-' + N.code.toLowerCase(), { reliable: true, serialization: 'json' }); N.hostConn = conn;
      conn.on('open', () => { N.state = 'connected'; send({ t: 'hello', name: me.name, faction: me.faction, v: PROTO, build: me.build || '' }); fire('open', {}); });
      conn.on('data', d => {
        if (!d || typeof d !== 'object') return;
        if (d.t === 'welcome') { if (d.v !== PROTO) { N.state = 'lost'; fire('error', { message: 'versão do jogo diferente da do anfitrião; atualizem a página (Ctrl+F5) nos dois lados' }); try { conn.close(); } catch (e) {} return; } N.size = d.size; if (d.build && me.build && d.build !== me.build) fire('warn', { message: 'build diferente do anfitrião (' + d.build + ' × ' + me.build + '); se algo falhar, Ctrl+F5 nos dois lados' }); }
        else if (d.t === 'bad-version') { N.state = 'lost'; fire('error', { message: 'versão do jogo diferente da do anfitrião; atualizem a página (Ctrl+F5) nos dois lados' }); }
        else if (d.t === 'lobby') { N.players = d.players; N.size = d.size; fire('lobby', d); }
        else if (d.t === 'full') { N.state = 'full'; fire('full', {}); }
        else if (d.t === 'start') { N.started = true; N.id = d.you; N.players = d.players; fire('start', d); }
        else if (d.t === 'tick') N.bundles.set(d.tick, d.cmds || []);
        else if (d.t === 'chat') fire('chat', d);
        else if (d.t === 'left') { N.dropped.add(d.id); fire('left', d); }
        else if (d.t === 'desync') { N.desync = true; fire('desync', d); }
        else if (d.t === 'ping') send({ t: 'pong', s: d.s });
      });
      conn.on('close', () => { if (N.state !== 'full') N.state = 'lost'; fire('close', {}); });
      conn.on('error', e => { N.state = 'lost'; fire('error', { message: String(e && e.message || e) }); });
    });
    N.peer.on('error', e => { fire('error', { message: errText(String(e && e.type || e)) }); });
  };
  // ---- lockstep (anfitrião junta; todos consomem)
  function put(tick, id, cmds) { let m = N.collect.get(tick); if (!m) { m = new Map(); N.collect.set(tick, m); } m.set(id, cmds); }
  function activeIds() { const ids = [0]; for (const g of N.guests) if (g.id >= 0 && !N.dropped.has(g.id)) ids.push(g.id); return ids.sort((a, b) => a - b); }
  function tryBundle(tick) {
    if (N.bundles.has(tick)) return; const m = N.collect.get(tick); if (!m) return;
    const ids = activeIds(); for (const id of ids) if (!m.has(id)) return;
    const arr = []; for (const id of ids) for (const c of m.get(id)) arr.push(Object.assign({}, c));
    N.collect.delete(tick); N.bundles.set(tick, arr); broadcast({ t: 'tick', tick, cmds: arr });
  }
  N.scheduleLocal = function (tick, cmds) { if (N.role === 'host') { put(tick, 0, cmds); tryBundle(tick); } else send({ t: 'cmds', tick, cmds }); };
  // Se um convidado some sem o WebRTC avisar, o anfitrião espera no máximo DROP_MS pelos comandos dele e então o marca como caído.
  N.DROP_MS = 8000; N.waitSince = 0;
  N.canAdvance = function (tick) {
    if (tick < N.DELAY || N.bundles.has(tick)) { N.waitSince = 0; return true; }
    if (N.role === 'host') {
      const now = performance.now(); if (!N.waitSince) N.waitSince = now;
      if (now - N.waitSince > 3000 && (!N.waitLog || now - N.waitLog > 3000)) { N.waitLog = now; const m0 = N.collect.get(tick); console.warn('[ARD] rede: anfitrião esperando tick ' + tick + ' há ' + ((now - N.waitSince) / 1000).toFixed(1) + ' s; recebidos de ' + (m0 ? Array.from(m0.keys()).join(',') : 'ninguém') + '; ativos ' + activeIds().join(',')); }
      if (now - N.waitSince > N.DROP_MS) { console.warn('[ARD] rede: timeout, derrubando quem não mandou o tick ' + tick); const m = N.collect.get(tick) || new Map(); for (const g of N.guests.slice()) if (g.id >= 0 && !N.dropped.has(g.id) && !m.has(g.id)) { N.dropped.add(g.id); const msg = { t: 'left', id: g.id, name: g.name }; broadcast(msg, g.conn); fire('left', msg); try { g.conn.close(); } catch (e) {} } N.waitSince = 0; for (const t of Array.from(N.collect.keys())) tryBundle(t); tryBundle(tick); return N.bundles.has(tick); }
    }
    return false;
  };
  N.takeCmds = function (tick) { const a = N.bundles.get(tick) || []; N.bundles.delete(tick); return a; };
  function checkHash(tick, h, id) {
    if (N.desync) return; let m = N.hashes.get(tick); if (!m) { m = new Map(); N.hashes.set(tick, m); } m.set(id, h);
    const vals = Array.from(m.values()); if (vals.some(v => v !== vals[0])) { N.desync = true; const msg = { t: 'desync', tick, id }; broadcast(msg); fire('desync', msg); }
    if (m.size >= activeIds().length) N.hashes.delete(tick);
    while (N.hashes.size > 60) N.hashes.delete(N.hashes.keys().next().value);
  }
  N.sendHash = function (tick, h) { if (N.role === 'host') checkHash(tick, h, 0); else send({ t: 'hash', tick, h }); };
  N.chat = function (text) { text = String(text || '').slice(0, 120); if (N.role === 'host') broadcast({ t: 'chat', id: 0, name: N.me.name, text }); else send({ t: 'chat', text }); };
  N.ping = function () { if (N.role === 'host') broadcast({ t: 'ping', s: performance.now() }); };
  N.close = function () { try { if (N.hostConn) N.hostConn.close(); for (const g of N.guests) g.conn.close(); if (N.peer) N.peer.destroy(); } catch (e) {} N.state = 'idle'; };
  return N;
}
ARD.net = { create, makeCode };
})(globalThis.ARD = globalThis.ARD || {});
