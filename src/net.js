/* Rede P2P (PeerJS, WebRTC) com lockstep de comandos: código de sala, troca de configuração, comandos por tick, checksums e chat. */
(function (ARD) {
'use strict';
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function makeCode() { let c = ''; for (let i = 0; i < 6; i++) c += ALPHA[Math.floor(Math.random() * ALPHA.length)]; return c; }
function create() {
  const N = { state: 'idle', code: null, peer: null, conn: null, handlers: {}, role: null, DELAY: 3, localSched: new Map(), remoteSched: new Map(), hashes: new Map(), remoteHashes: new Map(), desync: false, lastRemoteTick: -1, rtt: 0 };
  N.on = (t, fn) => { N.handlers[t] = fn; };
  function fire(t, p) { if (N.handlers[t]) N.handlers[t](p); }
  function bind(conn) {
    N.conn = conn;
    conn.on('open', () => { N.state = 'connected'; fire('open', {}); });
    conn.on('data', d => { if (!d || typeof d !== 'object') return; if (d.t === 'cmds') { N.remoteSched.set(d.tick, d.cmds || []); N.lastRemoteTick = Math.max(N.lastRemoteTick, d.tick); } else if (d.t === 'hash') { N.remoteHashes.set(d.tick, d.h); checkHash(d.tick); } else if (d.t === 'ping') { conn.send({ t: 'pong', s: d.s }); } else if (d.t === 'pong') { N.rtt = performance.now() - d.s; } else fire(d.t, d); });
    conn.on('close', () => { N.state = 'lost'; fire('close', {}); });
    conn.on('error', e => { N.state = 'lost'; fire('error', { message: String(e && e.message || e) }); });
  }
  N.host = function (onReady) {
    if (typeof Peer === 'undefined') { fire('error', { message: 'PeerJS não carregou' }); return; }
    N.role = 'host'; N.code = makeCode(); N.state = 'hosting';
    N.peer = new Peer('aether-rift-' + N.code.toLowerCase(), { debug: 0 });
    N.peer.on('open', () => { if (onReady) onReady(N.code); });
    N.peer.on('connection', conn => { if (N.conn) { conn.close(); return; } bind(conn); });
    N.peer.on('error', e => { fire('error', { message: String(e && e.type || e) }); });
  };
  N.join = function (code) {
    if (typeof Peer === 'undefined') { fire('error', { message: 'PeerJS não carregou' }); return; }
    N.role = 'guest'; N.code = code.trim().toUpperCase(); N.state = 'joining';
    N.peer = new Peer({ debug: 0 });
    N.peer.on('open', () => { const conn = N.peer.connect('aether-rift-' + N.code.toLowerCase(), { reliable: true, serialization: 'json' }); bind(conn); });
    N.peer.on('error', e => { fire('error', { message: String(e && e.type || e) }); });
  };
  N.send = function (t, payload) { if (!N.conn || N.state !== 'connected') return; try { N.conn.send(Object.assign({ t }, payload || {})); } catch (e) {} };
  N.ping = function () { N.send('ping', { s: performance.now() }); };
  // ---- lockstep
  N.scheduleLocal = function (tick, cmds) { N.localSched.set(tick, cmds); N.send('cmds', { tick, cmds }); };
  N.canAdvance = function (tick) { return tick < N.DELAY || N.remoteSched.has(tick); };
  N.takeCmds = function (tick, myId) { const a = N.localSched.get(tick) || [], b = N.remoteSched.get(tick) || []; N.localSched.delete(tick); N.remoteSched.delete(tick); const mine = a.map(c => Object.assign({}, c)), theirs = b.map(c => Object.assign({}, c)); return myId === 0 ? mine.concat(theirs) : theirs.concat(mine); };
  N.sendHash = function (tick, h) { N.hashes.set(tick, h); N.send('hash', { tick, h }); checkHash(tick); if (N.hashes.size > 40) { const k = N.hashes.keys().next().value; N.hashes.delete(k); } };
  function checkHash(tick) { if (N.desync) return; const a = N.hashes.get(tick), b = N.remoteHashes.get(tick); if (a != null && b != null) { if (a !== b) { N.desync = true; fire('desync', { tick }); } N.remoteHashes.delete(tick); N.hashes.delete(tick); } }
  N.close = function () { try { if (N.conn) N.conn.close(); if (N.peer) N.peer.destroy(); } catch (e) {} N.state = 'idle'; };
  return N;
}
ARD.net = { create, makeCode };
})(globalThis.ARD = globalThis.ARD || {});
