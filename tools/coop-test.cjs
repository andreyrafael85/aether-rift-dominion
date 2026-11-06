// 5.0g — Caçada cooperativa em lockstep, sem rede: o src/net.js de verdade (anfitrião relé, pacotes por tick e somas de verificação)
// sobre um PeerJS de mentira em memória. Cada "aparelho" roda a sua cópia da simulação; o humano de cada um é jogado por uma IA com RNG
// próprio (fora do sim.rand, como um jogador de verdade) e os comandos só entram pelo pacote do tick. Compara o hash de todos a cada 10 ticks.
// Uso: node tools/coop-test.cjs [jogadores=2,4] [ticks=3000] [--json]
const path = require('path'); const root = path.resolve(__dirname, '..');
globalThis.ARD = {}; require(root + '/src/modos.js'); require(root + '/src/chefes-sim.js'); /* 5.0g junção */ require(root + '/src/mundo.js'); require(root + '/src/unicas-sim.js'); /* 5.0h junção: carregado como no jogo (a IA 3.0 usa as únicas e os módulos) */ /* 5.0h */ require(root + '/src/sim.js'); require(root + '/src/ai.js'); require(root + '/src/net.js');
const S = ARD.sim, AI = ARD.ai; const JSONOUT = process.argv.includes('--json'); const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
const tamanhos = String(args[0] || '2,4').split(',').map(Number); const TICKS = +(args[1] || 3000);
/* ---------- PeerJS de mentira: um corretor em memória, mensagens copiadas por JSON e entregues no próximo giro do laço ---------- */
const corretor = new Map();
class Conexao { constructor() { this.h = {}; this.outra = null; this.aberta = false; } on(ev, fn) { (this.h[ev] = this.h[ev] || []).push(fn); } fire(ev, x) { for (const fn of this.h[ev] || []) fn(x); }
  send(msg) { if (!this.aberta) return; const c = JSON.parse(JSON.stringify(msg)); const o = this.outra; setImmediate(() => { if (o.aberta) o.fire('data', c); }); }
  close() { if (!this.aberta) return; this.aberta = false; this.outra.aberta = false; setImmediate(() => { this.fire('close'); this.outra.fire('close'); }); } }
let seqPeer = 0;
class Peer { constructor(id) { this.id = id || 'peer-' + (++seqPeer); this.h = {}; this.destroyed = false; corretor.set(this.id, this); setImmediate(() => this.fire('open', this.id)); }
  on(ev, fn) { (this.h[ev] = this.h[ev] || []).push(fn); } fire(ev, x) { for (const fn of this.h[ev] || []) fn(x); }
  connect(id) { const a = new Conexao(), b = new Conexao(); a.outra = b; b.outra = a; const alvo = corretor.get(id);
    setImmediate(() => { if (!alvo) { this.fire('error', { type: 'peer-unavailable' }); return; } alvo.fire('connection', b); a.aberta = b.aberta = true; setImmediate(() => { b.fire('open'); a.fire('open'); }); }); return a; }
  destroy() { this.destroyed = true; corretor.delete(this.id); } reconnect() {} }
globalThis.Peer = Peer;
function mulberry(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const RACES = ['vehnar', 'erevane', 'tessara', 'quorith', 'vorag'];
function sala(n, chefe) {
  return new Promise(resolve => {
    const cfgSala = { seed: 777 + n, minutes: 25, mapV: 1, cacada: { chefe, dif: 'facil' }, map: ARD.modos.CACADA[chefe].mapa };
    const host = ARD.net.create(); const clientes = []; let iniciado = false;
    const novoCliente = (N, myId, cfg) => { const sim = S.createSim(Object.assign({}, cfg, ARD.modos.cfgDe(cfg))); const ais = sim.players.filter(p => !p.human && !p.fenda /* 5.0g junção */).map(p => AI.create(p.id, p.difficulty));
      const eu = AI.create(myId, 'dificil'); const rnd = mulberry(1000 + myId); const c = { N, sim, ais, eu, rnd, myId, pend: [], hashes: {}, fim: null }; clientes.push(c); return c; };
    host.on('lobby', d => { if (!iniciado && d.players.length >= n) { iniciado = true;
      const players = host.roster().map(r => ({ name: r.name, faction: r.faction, human: true })); const cfg = Object.assign({ players }, cfgSala); host.start(cfg); novoCliente(host, 0, cfg); setImmediate(laco); } });
    host.host({ size: n, me: { name: 'Anfitriao', faction: RACES[0] } }, code => {
      for (let i = 1; i < n; i++) { const g = ARD.net.create(); g.on('start', d => novoCliente(g, d.you, d.cfg)); g.join(code, { name: 'Amigo' + i, faction: RACES[i % 5] }); } });
    let giros = 0; const t0 = Date.now();
    function laco() {
      giros++; let avancou = false;
      for (const c of clientes) { const sim = c.sim, N = c.N; if (sim.result || sim.tick >= TICKS) continue; const tick = sim.tick;
        if (N.sentFor == null || N.sentFor < tick) { if (tick % 10 === 0) { const r = sim.rand; sim.rand = c.rnd; try { for (const x of AI.think(sim, c.eu)) c.pend.push(x); } finally { sim.rand = r; } } if (N.scheduleLocal(tick + N.DELAY, c.pend) !== false) c.pend = []; N.sentFor = tick; }
        if (!N.canAdvance(tick)) continue;
        if (sim.tick % 10 === 0) for (const a of c.ais) for (const x of AI.think(sim, a)) S.enqueue(sim, x);
        for (const x of N.takeCmds(tick)) S.enqueue(sim, x);
        S.step(sim); avancou = true;
        if (sim.tick % 10 === 0) { const h = S.hash(sim); c.hashes[sim.tick] = h; N.sendHash(sim.tick, h); }
        if (sim.result) c.fim = sim.result.outcome; }
      const pronto = clientes.length === n && clientes.every(c => c.sim.result || c.sim.tick >= TICKS);
      if (pronto || giros > TICKS * 400 || Date.now() - t0 > 600000) { setTimeout(() => terminar(), 50); return; }
      setImmediate(laco);
    }
    function terminar() {
      let iguais = 0, diverge = null; const ref = clientes[0];
      for (const k in ref.hashes) { const v = ref.hashes[k]; if (clientes.every(c => c.hashes[k] === undefined || c.hashes[k] === v)) iguais++; else if (!diverge) diverge = 'tick ' + k + ': ' + clientes.map(c => c.hashes[k]).join(' / '); }
      const desync = clientes.some(c => c.N.desync); const ticks = clientes.map(c => c.sim.tick); const fins = clientes.map(c => c.fim);
      const time = ref.sim.players.filter(p => !p.fenda && p.alive); /* 5.0g junção: quem cai sai do pacto (eliminate) */ const aliados = time.every(a => time.every(b => a === b || S.hasPact(ref.sim, a.id, b.id)));
      const ok = clientes.length === n && !diverge && !desync && iguais > 20 && aliados && ticks.every(t => t === ticks[0]) && fins.every(f => f === fins[0]);
      for (const c of clientes) try { c.N.close(); } catch (e) {}
      resolve({ n, chefe, ok, amostras: iguais, diverge, desync, ticks: ticks[0], fim: fins[0] || 'em andamento', aliados, ms: Date.now() - t0 });
    }
  });
}
(async () => {
  const out = []; for (const n of tamanhos) { const r = await sala(n, n >= 3 ? 'forja' : 'arauto'); out.push(r);
    if (!JSONOUT) console.log(`coop ${n} jogadores (${r.chefe}): ${r.ok ? 'OK' : 'FAIL'} · ${r.amostras} somas iguais · tick ${r.ticks} · ${r.fim} · time aliado ${r.aliados ? 'sim' : 'não'}${r.diverge ? ' · DIVERGE ' + r.diverge : ''}${r.desync ? ' · desync' : ''} · ${r.ms} ms`); }
  const ok = out.every(r => r.ok); if (JSONOUT) console.log(JSON.stringify({ ok, salas: out })); process.exit(ok ? 0 : 1);
})();
