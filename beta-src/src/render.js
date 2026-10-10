/* Renderizador Canvas 2D: mundo, névoa, efeitos e minimapa. Só lê a simulação. */
(function (ARD) {
'use strict';
const S = ARD.sim;
const GLYPH = { nucleo: '◎', reator: 'R', refinaria: 'F', quartel: 'Q', fabrica: 'V', hangar: 'H', torre: 'T', nodulo: 'N', laboratorio: 'L', bastiao: 'B' };
const NODE_COLOR = { plasma: '#FF6A3D', minerio: '#8FA3B8', dados: '#7FE3A1' };

function hexToRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function rgba(h, a) { const c = hexToRgb(h); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; }
function shade(h, f) { const c = hexToRgb(h).map(v => Math.max(0, Math.min(255, Math.round(v * f)))); return `rgb(${c[0]},${c[1]},${c[2]})`; }

function create(canvas, mini) {
  const ctx = canvas.getContext('2d');
  const mctx = mini.getContext('2d');
  const fog = document.createElement('canvas'); const fctx = fog.getContext('2d');
  const mfog = document.createElement('canvas'); const mfctx = mfog.getContext('2d');
  const R = { canvas, ctx, w: 0, h: 0, dpr: 1, fx: { tracers: [], parts: [], floats: [], rings: [] }, time: 0, shake: 0 };

  R.resize = function () {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      fog.width = canvas.width; fog.height = canvas.height;
    }
    R.w = w; R.h = h; R.dpr = dpr;
    const ms = mini.clientWidth || 180;
    if (mini.width !== ms * dpr) { mini.width = ms * dpr; mini.height = ms * dpr; mfog.width = mini.width; mfog.height = mini.height; }
  };
  R.worldToScreen = function (cam, x, y) { return [(x - cam.x) * cam.zoom + R.w / 2, (y - cam.y) * cam.zoom + R.h / 2]; };
  R.screenToWorld = function (cam, sx, sy) { return [(sx - R.w / 2) / cam.zoom + cam.x, (sy - R.h / 2) / cam.zoom + cam.y]; };

  R.onEvents = function (events, sim, human) {
    const vis = sim.vis[human];
    for (const e of events) {
      switch (e.t) {
        case 'shot': {
          const col = sim.players[e.owner].color;
          R.fx.tracers.push({ x1: e.x1, y1: e.y1, x2: e.x2, y2: e.y2, col, t: 0, life: 0.14, ambush: e.ambush });
          for (let i = 0; i < 3; i++) R.fx.parts.push({ x: e.x2, y: e.y2, vx: (Math.random() - 0.5) * 120, vy: (Math.random() - 0.5) * 120, t: 0, life: 0.3 + Math.random() * 0.2, col: '#FFD27A', size: 1.5 });
          break; }
        case 'death': {
          const col = e.owner >= 0 ? sim.players[e.owner].color : '#AAAAAA';
          const n = e.kind === 'building' ? 40 : 12;
          for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, sp = 40 + Math.random() * (e.kind === 'building' ? 220 : 120); R.fx.parts.push({ x: e.x, y: e.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0, life: 0.5 + Math.random() * 0.6, col: Math.random() < 0.5 ? col : '#FF9A5C', size: e.kind === 'building' ? 3 : 2 }); }
          R.fx.rings.push({ x: e.x, y: e.y, r0: e.r, r1: e.r * (e.kind === 'building' ? 4 : 2.5), col: '#FF9A5C', t: 0, life: 0.5 });
          if (e.kind === 'building' && e.owner === human) R.shake = Math.min(1, R.shake + 0.4);
          break; }
        case 'float': {
          const col = e.kind === 'steal' ? '#FF6A3D' : (e.owner === human ? '#E8E2D6' : rgba(sim.players[e.owner].color, 0.8));
          if (e.owner === human || e.kind === 'steal') R.fx.floats.push({ x: e.x, y: e.y, text: e.text, col, t: 0, life: 1.3 });
          break; }
        case 'alert': if (e.p === human && e.x != null) R.fx.rings.push({ x: e.x, y: e.y, r0: 20, r1: 160, col: e.kind === 'danger' ? '#FF5E3A' : e.kind === 'good' ? '#7FE3A1' : '#F2C230', t: 0, life: 1.6, ping: true }); break;
        case 'super': if (e.kind === 'fundicao') R.fx.rings.push({ x: e.x, y: e.y, r0: 10, r1: 220, col: '#FF8C1A', t: 0, life: 3, ping: true }); else R.shake = 1; break;
        case 'jump': R.fx.rings.push({ x: e.from.x, y: e.from.y, r0: 40, r1: 300, col: '#B23CFF', t: 0, life: 1.2 }); R.fx.rings.push({ x: e.to.x, y: e.to.y, r0: 300, r1: 40, col: '#B23CFF', t: 0, life: 1.2 }); break;
        case 'built': if (e.p === human) R.fx.rings.push({ x: e.x, y: e.y, r0: 10, r1: 60, col: '#7FE3A1', t: 0, life: 0.6 }); break;
        case 'crate': R.fx.rings.push({ x: e.x, y: e.y, r0: 5, r1: 50, col: '#F2C230', t: 0, life: 0.8 }); break;
      }
    }
  };

  function updateFx(dt) {
    const f = R.fx;
    for (const arr of [f.tracers, f.parts, f.floats, f.rings]) for (let i = arr.length - 1; i >= 0; i--) { const o = arr[i]; o.t += dt; if (o.t >= o.life) arr.splice(i, 1); }
    for (const p of f.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.9; p.vy *= 0.9; }
    R.shake = Math.max(0, R.shake - dt * 2);
    if (f.parts.length > 1500) f.parts.splice(0, f.parts.length - 1500);
  }

  function lerp(e, a) { return [e.px + (e.x - e.px) * a, e.py + (e.y - e.py) * a]; }

  function drawUnitShape(c, u, col, sel, alpha) {
    const r = u.r; c.globalAlpha = alpha;
    c.fillStyle = col; c.strokeStyle = shade(col, 0.45); c.lineWidth = 1.2;
    switch (u.cls === 'civ' ? 'col' : u.def === 'pirata' ? 'pir' : u.cls) {
      case 'inf': c.beginPath(); c.moveTo(r * 1.1, 0); c.lineTo(-r * 0.9, r * 0.8); c.lineTo(-r * 0.5, 0); c.lineTo(-r * 0.9, -r * 0.8); c.closePath(); c.fill(); c.stroke(); break;
      case 'vei': c.beginPath(); c.roundRect(-r, -r * 0.7, r * 2, r * 1.4, 3); c.fill(); c.stroke(); c.fillStyle = shade(col, 0.6); c.beginPath(); c.arc(0, 0, r * 0.45, 0, 7); c.fill(); c.strokeStyle = shade(col, 1.3); c.lineWidth = 2.5; c.beginPath(); c.moveTo(0, 0); c.lineTo(r * 1.3, 0); c.stroke(); break;
      case 'dro': c.beginPath(); c.arc(0, 0, r * 0.65, 0, 7); c.fill(); c.stroke(); c.strokeStyle = rgba(col, 0.7); c.lineWidth = 1.5; c.beginPath(); c.arc(0, 0, r * 1.25, 0, 7); c.stroke(); c.fillStyle = shade(col, 1.4); c.beginPath(); c.arc(r * 0.9, r * 0.9, 1.6, 0, 7); c.arc(-r * 0.9, -r * 0.9, 1.6, 0, 7); c.fill(); break;
      case 'sup': c.beginPath(); c.moveTo(r, 0); c.lineTo(0, r * 0.8); c.lineTo(-r, 0); c.lineTo(0, -r * 0.8); c.closePath(); c.fill(); c.stroke(); c.strokeStyle = shade(col, 1.4); c.lineWidth = 1.5; c.beginPath(); c.moveTo(0, -r * 0.8); c.lineTo(0, -r * 1.8); c.stroke(); c.beginPath(); c.arc(0, -r * 1.9, 1.6, 0, 7); c.fill(); break;
      case 'pir': c.beginPath(); c.moveTo(r * 1.1, 0); c.lineTo(-r * 0.4, r * 0.9); c.lineTo(-r * 1, r * 0.9); c.lineTo(0, 0); c.lineTo(-r * 1, -r * 0.9); c.lineTo(-r * 0.4, -r * 0.9); c.closePath(); c.fill(); c.stroke();
        if (u.cargoTotal > 0) { c.fillStyle = '#FF6A3D'; c.beginPath(); c.arc(-r * 1.4, 0, 3, 0, 7); c.fill(); } break;
      default: c.beginPath(); c.roundRect(-r, -r, r * 2, r * 2, 2); c.fill(); c.stroke();
        if (u.cargoTotal > 0) { c.fillStyle = NODE_COLOR[Object.keys(u.cargo).sort((a, b) => u.cargo[b] - u.cargo[a])[0]] || '#fff'; c.fillRect(-r * 0.6, -r * 0.6, r * 1.2 * Math.min(1, u.cargoTotal / (u.cargoCap || 50)), r * 1.2); }
    }
    c.globalAlpha = 1;
  }

  function drawBuilding(c, b, sim, col, fac, zoom, isGhost) {
    const r = b.r; const d = S.BUILDINGS[b.def];
    c.save();
    if (!b.built && !isGhost) { c.setLineDash([4, 3]); }
    const dark = shade(col, 0.35), mid = shade(col, 0.7);
    c.lineWidth = 1.5; c.strokeStyle = shade(col, 1.1);
    if (b.def === 'nucleo') {
      c.fillStyle = dark; poly(c, 0, 0, r, 8, Math.PI / 8); c.fill(); c.stroke();
      c.fillStyle = mid; poly(c, 0, 0, r * 0.72, 8, Math.PI / 8); c.fill();
      const pulse = 0.6 + 0.4 * Math.sin(R.time * 2);
      c.fillStyle = rgba(col, pulse); c.beginPath(); c.arc(0, 0, r * 0.32, 0, 7); c.fill();
      c.strokeStyle = rgba('#FFFFFF', 0.25); c.beginPath(); c.arc(0, 0, r * 0.5, 0, 7); c.stroke();
    } else if (fac.id === 'vehnar') {
      c.fillStyle = dark; c.beginPath(); c.roundRect(-r, -r, r * 2, r * 2, 3); c.fill(); c.stroke();
      c.fillStyle = mid; c.fillRect(-r * 0.7, -r * 0.7, r * 1.4, r * 1.4);
      c.fillStyle = shade(col, 1.3); for (const [x, y] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { c.beginPath(); c.arc(x * r * 0.82, y * r * 0.82, 1.6, 0, 7); c.fill(); }
      if (b.def === 'reator' && b.built) { const g = 0.5 + 0.5 * Math.sin(R.time * 4 + b.id); c.fillStyle = rgba('#FF8C1A', 0.5 + 0.5 * g); c.fillRect(-r * 0.5, -r * 0.15, r, r * 0.3); }
    } else {
      c.fillStyle = dark; poly(c, 0, 0, r * 1.05, 6, 0); c.fill(); c.stroke();
      c.fillStyle = mid; poly(c, 0, 0, r * 0.7, 6, 0); c.fill();
      c.save(); c.clip(); c.strokeStyle = rgba('#F2C230', 0.9); c.lineWidth = r * 0.22; c.beginPath(); c.moveTo(-r, r * 0.4); c.lineTo(r, -r * 0.4); c.stroke(); c.restore();
      if (b.def === 'reator' && b.built) { c.fillStyle = rgba('#B23CFF', 0.5 + 0.5 * Math.sin(R.time * 4 + b.id)); c.beginPath(); c.arc(0, 0, r * 0.2, 0, 7); c.fill(); }
    }
    if (d.attack) { c.strokeStyle = shade(col, 1.4); c.lineWidth = 3; c.beginPath(); c.moveTo(0, 0); const a = b.aimAng || 0; c.lineTo(Math.cos(a) * r * 1.3, Math.sin(a) * r * 1.3); c.stroke(); }
    c.setLineDash([]);
    if (zoom > 0.45) { c.fillStyle = rgba('#FFFFFF', 0.85); c.font = `bold ${Math.max(9, r * 0.8)}px IBM Plex Mono, monospace`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(GLYPH[b.def] || '?', 0, 1); }
    c.restore();
  }
  function poly(c, x, y, r, n, rot) { c.beginPath(); for (let i = 0; i < n; i++) { const a = rot + (Math.PI * 2 * i) / n; const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r; if (i === 0) c.moveTo(px, py); else c.lineTo(px, py); } c.closePath(); }
  function drawNode(c, n, zoom) {
    const col = NODE_COLOR[n.res]; const r = n.r; const frac = n.max > 0 ? n.amount / n.max : 0;
    c.save();
    const g = c.createRadialGradient(0, 0, 2, 0, 0, r * 2.2); g.addColorStop(0, rgba(col, 0.35)); g.addColorStop(1, rgba(col, 0)); c.fillStyle = g; c.beginPath(); c.arc(0, 0, r * 2.2, 0, 7); c.fill();
    c.fillStyle = shade(col, 0.55); c.strokeStyle = col; c.lineWidth = 1.5;
    if (n.res === 'plasma') { poly(c, 0, 0, r * (0.7 + 0.3 * frac), 6, R.time * 0.3); c.fill(); c.stroke(); c.fillStyle = rgba('#FFFFFF', 0.6 + 0.3 * Math.sin(R.time * 3 + n.id)); c.beginPath(); c.arc(0, 0, r * 0.25, 0, 7); c.fill(); }
    else if (n.res === 'minerio') { for (let i = 0; i < 3; i++) { const a = i * 2.1 + n.id; c.beginPath(); c.roundRect(Math.cos(a) * r * 0.5 - r * 0.45, Math.sin(a) * r * 0.5 - r * 0.35, r * 0.9 * (0.5 + 0.5 * frac), r * 0.7, 2); c.fill(); c.stroke(); } }
    else { poly(c, 0, 0, r * (0.6 + 0.4 * frac), 4, Math.PI / 4 + R.time * 0.6); c.fill(); c.stroke(); c.strokeStyle = rgba(col, 0.6); c.setLineDash([2, 3]); c.beginPath(); c.arc(0, 0, r * 1.2, 0, 7); c.stroke(); }
    if (zoom > 0.5) { c.setLineDash([]); c.strokeStyle = rgba(col, 0.8); c.lineWidth = 2; c.beginPath(); c.arc(0, 0, r + 4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac); c.stroke(); }
    c.restore();
  }
  function hpBar(c, x, y, w, frac, col) { c.fillStyle = 'rgba(0,0,0,0.55)'; c.fillRect(x - w / 2, y, w, 3); c.fillStyle = frac > 0.5 ? '#7FE3A1' : frac > 0.25 ? '#F2C230' : '#FF5E3A'; c.fillRect(x - w / 2, y, w * Math.max(0, frac), 3); }

  R.draw = function (sim, view, alpha, dt) {
    R.time += dt; updateFx(dt);
    const c = ctx, cam = view.cam, human = view.human, vis = sim.vis[human], me = sim.players[human];
    const W = R.w, H = R.h, z = cam.zoom;
    c.setTransform(R.dpr, 0, 0, R.dpr, 0, 0);
    // background
    c.fillStyle = '#0D0F13'; c.fillRect(0, 0, W, H);
    let shx = 0, shy = 0; if (R.shake > 0) { shx = (Math.random() - 0.5) * 8 * R.shake; shy = (Math.random() - 0.5) * 8 * R.shake; }
    c.save(); c.translate(W / 2 + shx, H / 2 + shy); c.scale(z, z); c.translate(-cam.x, -cam.y);
    const vx0 = cam.x - W / 2 / z - 60, vy0 = cam.y - H / 2 / z - 60, vx1 = cam.x + W / 2 / z + 60, vy1 = cam.y + H / 2 / z + 60;
    const onScreen = (x, y, r) => x + r > vx0 && x - r < vx1 && y + r > vy0 && y - r < vy1;
    // world bounds + grid
    c.fillStyle = '#111419'; c.fillRect(0, 0, S.WORLD, S.WORLD);
    c.strokeStyle = 'rgba(255,255,255,0.035)'; c.lineWidth = 1 / z;
    const gs = 200; c.beginPath();
    for (let x = Math.max(0, Math.floor(vx0 / gs) * gs); x <= Math.min(S.WORLD, vx1); x += gs) { c.moveTo(x, Math.max(0, vy0)); c.lineTo(x, Math.min(S.WORLD, vy1)); }
    for (let y = Math.max(0, Math.floor(vy0 / gs) * gs); y <= Math.min(S.WORLD, vy1); y += gs) { c.moveTo(Math.max(0, vx0), y); c.lineTo(Math.min(S.WORLD, vx1), y); }
    c.stroke();
    c.strokeStyle = 'rgba(255,94,58,0.35)'; c.lineWidth = 3 / z; c.strokeRect(0, 0, S.WORLD, S.WORLD);
    // rift
    if (onScreen(S.CX, S.CY, 600)) {
      const g = c.createRadialGradient(S.CX, S.CY, S.RIFT_R * 0.3, S.CX, S.CY, S.RIFT_R * 3.2);
      g.addColorStop(0, 'rgba(255,94,58,0.55)'); g.addColorStop(0.35, 'rgba(178,60,255,0.28)'); g.addColorStop(1, 'rgba(178,60,255,0)');
      c.fillStyle = g; c.beginPath(); c.arc(S.CX, S.CY, S.RIFT_R * 3.2, 0, 7); c.fill();
      c.fillStyle = '#07060A'; c.beginPath(); c.arc(S.CX, S.CY, S.RIFT_R, 0, 7); c.fill();
      for (let i = 0; i < 3; i++) { const ph = (R.time * 0.25 + i / 3) % 1; c.strokeStyle = `rgba(255,120,80,${0.5 * (1 - ph)})`; c.lineWidth = 2 / z; c.beginPath(); c.arc(S.CX, S.CY, S.RIFT_R * (0.4 + ph * 0.7), 0, 7); c.stroke(); }
      c.strokeStyle = 'rgba(255,160,120,0.6)'; c.lineWidth = 1.5 / z; c.setLineDash([6 / z, 6 / z]); c.beginPath(); c.arc(S.CX, S.CY, S.RIFT_R, 0, 7); c.stroke(); c.setLineDash([]);
    }
    // territories (own + visible/remembered enemies)
    for (const e of sim.ents) {
      if (!e.alive || e.kind !== 'building' || !e.built) continue;
      const t = S.BUILDINGS[e.def].territory; if (!t) continue;
      if (e.owner !== human && !vis.has(e.id) && !view.memory.has(e.id)) continue;
      if (!onScreen(e.x, e.y, t)) continue;
      const col = sim.players[e.owner].color;
      c.fillStyle = rgba(col, 0.045); c.beginPath(); c.arc(e.x, e.y, t, 0, 7); c.fill();
      c.strokeStyle = rgba(col, 0.28); c.lineWidth = 1.5 / z; c.setLineDash([8 / z, 6 / z]); c.stroke(); c.setLineDash([]);
    }
    // nodes
    for (const e of sim.ents) { if (!e.alive || e.kind !== 'node' || !onScreen(e.x, e.y, 40)) continue; c.save(); c.translate(e.x, e.y); drawNode(c, e, z); c.restore(); }
    // memory ghosts
    for (const [id, m] of view.memory) {
      if (vis.has(id) || !onScreen(m.x, m.y, 60)) continue;
      c.save(); c.translate(m.x, m.y); c.globalAlpha = 0.35;
      drawBuilding(c, { def: m.def, r: S.BUILDINGS[m.def].r, built: true, id }, sim, sim.players[m.owner].color, S.FACTIONS[sim.players[m.owner].faction], z, true);
      c.restore();
    }
    // buildings
    for (const e of sim.ents) {
      if (!e.alive || e.kind !== 'building') continue;
      const own = e.owner === human; if (!own && !vis.has(e.id)) continue;
      if (!onScreen(e.x, e.y, 80)) continue;
      const p = sim.players[e.owner], fac = S.FACTIONS[p.faction];
      c.save(); c.translate(e.x, e.y);
      if (e.cloaked && own) c.globalAlpha = 0.55;
      if (view.sel.has(e.id)) { c.strokeStyle = 'rgba(255,255,255,0.9)'; c.lineWidth = 2 / z; c.beginPath(); c.arc(0, 0, e.r + 6, 0, 7); c.stroke(); const d = S.BUILDINGS[e.def]; if (d.attack) { c.strokeStyle = 'rgba(255,255,255,0.18)'; c.setLineDash([4 / z, 6 / z]); c.beginPath(); c.arc(0, 0, d.attack.range, 0, 7); c.stroke(); c.setLineDash([]); } if (d.detect) { c.strokeStyle = 'rgba(127,227,161,0.3)'; c.beginPath(); c.arc(0, 0, d.detect, 0, 7); c.stroke(); } }
      drawBuilding(c, e, sim, p.color, fac, z, false);
      c.globalAlpha = 1;
      if (!e.built) { c.strokeStyle = '#7FE3A1'; c.lineWidth = 3 / z; c.beginPath(); c.arc(0, 0, e.r + 5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * e.progress); c.stroke(); }
      if (e.jumpT > 0) { const d = S.JUMP_CHANNEL; c.strokeStyle = '#B23CFF'; c.lineWidth = 4 / z; c.beginPath(); c.arc(0, 0, e.r + 10, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - e.jumpT / d)); c.stroke(); if (e.jumpTo && own) { c.setLineDash([6 / z, 6 / z]); c.strokeStyle = 'rgba(178,60,255,0.6)'; c.lineWidth = 2 / z; c.beginPath(); c.moveTo(0, 0); c.lineTo(e.jumpTo.x - e.x, e.jumpTo.y - e.y); c.stroke(); c.setLineDash([]); c.beginPath(); c.arc(e.jumpTo.x - e.x, e.jumpTo.y - e.y, e.r, 0, 7); c.stroke(); } }
      if (own && e.queue && e.queue.length && e.built) { const it = e.queue[0]; c.strokeStyle = '#F2C230'; c.lineWidth = 2.5 / z; c.beginPath(); c.arc(0, 0, e.r + 3, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (it.t / it.total)); c.stroke(); }
      if (e.hp < e.maxHp - 1 || view.sel.has(e.id)) hpBar(c, 0, e.r + 8, e.r * 2, e.hp / e.maxHp, p.color);
      if (!own && S.FACTIONS[p.faction].smoke && e.def === 'reator' && e.built) { c.fillStyle = 'rgba(200,200,200,0.5)'; for (let i = 0; i < 3; i++) { const ph = (R.time * 0.4 + i / 3) % 1; c.beginPath(); c.arc(6 + Math.sin(R.time + i) * 6, -e.r - 10 - ph * 40, 4 + ph * 8, 0, 7); c.fill(); } }
      c.restore();
    }
    // siphon beams
    for (const e of sim.ents) {
      if (!e.alive || e.kind !== 'unit' || e.state !== 'siphon') continue;
      const t = sim.byId.get(e.target); if (!t) continue;
      if (e.owner !== human && !vis.has(e.id) && t.owner !== human) continue;
      if (S.dist(e.x, e.y, t.x, t.y) > S.UNITS.pirata.siphonRange + t.r + 2) continue;
      c.save(); c.strokeStyle = 'rgba(178,60,255,0.9)'; c.lineWidth = 2.5 / z; c.setLineDash([6 / z, 5 / z]); c.lineDashOffset = -R.time * 60; c.beginPath(); c.moveTo(e.x, e.y); c.lineTo(t.x, t.y); c.stroke(); c.restore();
      if (Math.random() < 0.3) R.fx.parts.push({ x: t.x, y: t.y, vx: (e.x - t.x) * 1.2, vy: (e.y - t.y) * 1.2, t: 0, life: 0.8, col: '#C77DFF', size: 2 });
    }
    // units
    for (const e of sim.ents) {
      if (!e.alive || e.kind !== 'unit') continue;
      const own = e.owner === human; if (!own && !vis.has(e.id)) continue;
      const [x, y] = lerp(e, alpha); if (!onScreen(x, y, 30)) continue;
      const p = sim.players[e.owner];
      c.save(); c.translate(x, y);
      if (view.sel.has(e.id)) { c.strokeStyle = 'rgba(255,255,255,0.9)'; c.lineWidth = 1.5 / z; c.beginPath(); c.arc(0, 0, e.r + 4, 0, 7); c.stroke(); }
      if (S.UNITS[e.def].flying) { c.fillStyle = 'rgba(0,0,0,0.35)'; c.beginPath(); c.ellipse(6, 10, e.r * 0.8, e.r * 0.4, 0, 0, 7); c.fill(); }
      c.rotate(e.ang || 0);
      drawUnitShape(c, e, p.color, view.sel.has(e.id), e.cloaked ? 0.5 : 1);
      c.rotate(-(e.ang || 0));
      if (e.cloaked && own) { c.strokeStyle = 'rgba(255,255,255,0.35)'; c.setLineDash([2 / z, 3 / z]); c.lineWidth = 1 / z; c.beginPath(); c.arc(0, 0, e.r + 3, 0, 7); c.stroke(); c.setLineDash([]); }
      if (e.hp < e.maxHp - 0.5 || view.sel.has(e.id)) hpBar(c, 0, e.r + 5, Math.max(14, e.r * 2.4), e.hp / e.maxHp, p.color);
      if (view.sel.has(e.id) && (e.state === 'move' || e.state === 'attackmove')) { c.strokeStyle = e.state === 'attackmove' ? 'rgba(255,94,58,0.35)' : 'rgba(255,255,255,0.2)'; c.lineWidth = 1 / z; c.setLineDash([3 / z, 5 / z]); c.beginPath(); c.moveTo(0, 0); c.lineTo(e.tx - x, e.ty - y); c.stroke(); c.setLineDash([]); }
      c.restore();
    }
    // crates
    for (const e of sim.ents) {
      if (!e.alive || e.kind !== 'crate' || !vis.has(e.id) && !onScreen(e.x, e.y, 20)) continue;
      if (!vis.has(e.id)) continue;
      c.save(); c.translate(e.x, e.y); c.rotate(Math.PI / 4); c.fillStyle = '#F2C230'; c.strokeStyle = '#7A5A00'; c.lineWidth = 1.5 / z; c.fillRect(-7, -7, 14, 14); c.strokeRect(-7, -7, 14, 14); c.restore();
      c.strokeStyle = `rgba(242,194,48,${0.4 + 0.3 * Math.sin(R.time * 4)})`; c.lineWidth = 1.5 / z; c.beginPath(); c.arc(e.x, e.y, 16, 0, 7); c.stroke();
    }
    // effects
    for (const t of R.fx.tracers) { const a = 1 - t.t / t.life; c.strokeStyle = rgba(t.ambush ? '#FFFFFF' : t.col, a); c.lineWidth = (t.ambush ? 3 : 1.5) / z; c.beginPath(); c.moveTo(t.x1, t.y1); c.lineTo(t.x2, t.y2); c.stroke(); }
    for (const p of R.fx.parts) { const a = 1 - p.t / p.life; c.fillStyle = rgba(p.col, a); c.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size); }
    for (const r of R.fx.rings) { const k = r.t / r.life; const rr = r.r0 + (r.r1 - r.r0) * k; c.strokeStyle = rgba(r.col, (1 - k) * (r.ping ? 0.9 : 0.6)); c.lineWidth = (r.ping ? 3 : 2) / z; c.beginPath(); c.arc(r.x, r.y, rr, 0, 7); c.stroke(); }
    // build ghost
    if (view.ghost) {
      const g = view.ghost; const d = S.BUILDINGS[g.def]; const col = g.ok ? '#7FE3A1' : '#FF5E3A';
      c.save(); c.translate(g.x, g.y); c.globalAlpha = 0.75;
      drawBuilding(c, { def: g.def, r: d.r, built: true, id: 0 }, sim, col, S.FACTIONS[me.faction], z, true);
      c.globalAlpha = 1; c.strokeStyle = rgba(col, 0.5); c.lineWidth = 1.5 / z; c.setLineDash([6 / z, 4 / z]);
      if (d.territory) { c.beginPath(); c.arc(0, 0, d.territory, 0, 7); c.stroke(); }
      if (d.attack) { c.beginPath(); c.arc(0, 0, d.attack.range, 0, 7); c.stroke(); }
      c.restore();
    }
    if (view.marker) { const m = view.marker; const k = Math.min(1, (R.time - m.t) / 0.6); if (k < 1) { c.strokeStyle = rgba(m.col, 1 - k); c.lineWidth = 2 / z; c.beginPath(); c.arc(m.x, m.y, 6 + 24 * (1 - k), 0, 7); c.stroke(); } }
    c.restore();

    // fog (screen space)
    fctx.setTransform(1, 0, 0, 1, 0, 0); fctx.globalCompositeOperation = 'source-over';
    fctx.clearRect(0, 0, fog.width, fog.height);
    fctx.fillStyle = me.blackoutT > 0 ? 'rgba(4,4,8,0.93)' : 'rgba(6,8,12,0.84)'; fctx.fillRect(0, 0, fog.width, fog.height);
    fctx.globalCompositeOperation = 'destination-out';
    fctx.setTransform(R.dpr, 0, 0, R.dpr, 0, 0);
    for (const e of sim.ents) {
      if (!e.alive || e.owner !== human) continue;
      const rad = S.sensorRadius(sim, e); if (!onScreen(e.x, e.y, rad)) continue;
      const [sx, sy] = R.worldToScreen(cam, e.x, e.y); const sr = rad * z;
      const g = fctx.createRadialGradient(sx, sy, sr * 0.7, sx, sy, sr); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      fctx.fillStyle = g; fctx.beginPath(); fctx.arc(sx, sy, sr, 0, 7); fctx.fill();
    }
    c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(fog, 0, 0); c.setTransform(R.dpr, 0, 0, R.dpr, 0, 0);
    // smoke of enemy Vehnar reactors is drawn above fog (always visible)
    c.save(); c.translate(W / 2, H / 2); c.scale(z, z); c.translate(-cam.x, -cam.y);
    for (const e of sim.ents) {
      if (!e.alive || e.kind !== 'building' || e.def !== 'reator' || !e.built || e.owner === human) continue;
      if (!S.FACTIONS[sim.players[e.owner].faction].smoke || vis.has(e.id) && false) continue;
      if (!onScreen(e.x, e.y, 60)) continue;
      c.fillStyle = 'rgba(190,190,200,0.45)';
      for (let i = 0; i < 3; i++) { const ph = (R.time * 0.4 + i / 3 + e.id * 0.1) % 1; c.beginPath(); c.arc(e.x + 6 + Math.sin(R.time + i) * 6, e.y - e.r - 10 - ph * 40, 4 + ph * 8, 0, 7); c.fill(); }
    }
    // nodes outside vision: faint map knowledge above the fog
    for (const e of sim.ents) {
      if (!e.alive || e.kind !== 'node' || !onScreen(e.x, e.y, 30)) continue;
      let seen = false; for (const o of sim.ents) { if (o.alive && o.owner === human && S.dist(o.x, o.y, e.x, e.y) <= S.sensorRadius(sim, o)) { seen = true; break; } }
      if (seen) continue;
      c.save(); c.translate(e.x, e.y); c.globalAlpha = 0.28; drawNode(c, e, z); c.restore();
    }
    // floats above fog
    for (const f of R.fx.floats) { const k = f.t / f.life; c.fillStyle = rgba(f.col, 1 - k); c.font = `bold ${13 / z}px IBM Plex Mono, monospace`; c.textAlign = 'center'; c.fillText(f.text, f.x, f.y - 14 - k * 30); }
    c.restore();
    // box selection
    if (view.box) { const b = view.box; c.strokeStyle = 'rgba(255,255,255,0.8)'; c.fillStyle = 'rgba(255,255,255,0.08)'; c.lineWidth = 1; c.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0); c.strokeRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0); }
    // regime vignette
    const reg = me.energy.regime;
    if (reg !== 'pleno') {
      const col = reg === 'colapso' ? '255,94,58' : '242,194,48'; const a = reg === 'colapso' ? 0.25 + 0.15 * Math.sin(R.time * 5) : 0.15;
      const g = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75); g.addColorStop(0, `rgba(${col},0)`); g.addColorStop(1, `rgba(${col},${a})`);
      c.fillStyle = g; c.fillRect(0, 0, W, H);
    }
    drawMinimap(sim, view);
  };

  function drawMinimap(sim, view) {
    const c = mctx; const size = mini.width; const s = size / S.WORLD; const human = view.human; const vis = sim.vis[human];
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = '#0B0D11'; c.fillRect(0, 0, size, size);
    c.fillStyle = 'rgba(255,94,58,0.35)'; c.beginPath(); c.arc(S.CX * s, S.CY * s, S.RIFT_R * 2 * s, 0, 7); c.fill();
    c.fillStyle = '#07060A'; c.beginPath(); c.arc(S.CX * s, S.CY * s, S.RIFT_R * s, 0, 7); c.fill();
    for (const e of sim.ents) {
      if (!e.alive) continue;
      if (e.kind === 'node') { c.fillStyle = NODE_COLOR[e.res]; c.fillRect(e.x * s - 1.5, e.y * s - 1.5, 3, 3); continue; }
      const own = e.owner === human; const seen = own || vis.has(e.id) || (e.kind === 'building' && view.memory.has(e.id));
      if (!seen) continue;
      const col = sim.players[e.owner].color;
      if (e.kind === 'building') { const t = S.BUILDINGS[e.def].territory; if (t && e.built) { c.fillStyle = rgba(col, 0.08); c.beginPath(); c.arc(e.x * s, e.y * s, t * s, 0, 7); c.fill(); } c.fillStyle = col; const r = e.def === 'nucleo' ? 4 : 2.5; c.fillRect(e.x * s - r, e.y * s - r, r * 2, r * 2); }
      else if (e.kind === 'unit') { c.fillStyle = col; c.fillRect(e.x * s - 1, e.y * s - 1, 2, 2); }
    }
    for (const [id, m] of view.memory) if (!vis.has(id)) { c.fillStyle = rgba(sim.players[m.owner].color, 0.5); c.fillRect(m.x * s - 2, m.y * s - 2, 4, 4); }
    // fog on minimap
    mfctx.setTransform(1, 0, 0, 1, 0, 0); mfctx.globalCompositeOperation = 'source-over'; mfctx.clearRect(0, 0, size, size);
    mfctx.fillStyle = 'rgba(6,8,12,0.7)'; mfctx.fillRect(0, 0, size, size); mfctx.globalCompositeOperation = 'destination-out';
    for (const e of sim.ents) { if (!e.alive || e.owner !== human) continue; const r = S.sensorRadius(sim, e) * s; mfctx.beginPath(); mfctx.arc(e.x * s, e.y * s, r, 0, 7); mfctx.fill(); }
    c.drawImage(mfog, 0, 0);
    // pings
    for (const r of R.fx.rings) if (r.ping) { const k = r.t / r.life; c.strokeStyle = rgba(r.col, 1 - k); c.lineWidth = 1.5; c.beginPath(); c.arc(r.x * s, r.y * s, 3 + 10 * k, 0, 7); c.stroke(); }
    // camera rect
    const cam = view.cam; const vw = R.w / cam.zoom, vh = R.h / cam.zoom;
    c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 1; c.strokeRect((cam.x - vw / 2) * s, (cam.y - vh / 2) * s, vw * s, vh * s);
  }
  return R;
}
ARD.render = { create, NODE_COLOR, rgba, shade };
})(globalThis.ARD = globalThis.ARD || {});
