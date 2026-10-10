/* Renderizador isométrico com sprites voxel pré-renderizados (v1.5a). Só lê a simulação. */
(function (ARD) {
'use strict';
const S = ARD.sim, V = ARD.vox, MD = ARD.models;
const K = 1.7, SV = 4, FACINGS = 8, TILE = 64, TILES = S.WORLD / TILE;
const NODE_COLOR = { plasma: '#FF6A3D', minerio: '#8FA3B8', dados: '#7FE3A1' };
const NODE_MODEL = { plasma: 'crystals', minerio: 'ore', dados: 'datashards' };
function hexToRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function rgba(h, a) { const c = hexToRgb(h); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; }
function shade(h, f) { const c = hexToRgb(h).map(v => Math.max(0, Math.min(255, Math.round(v * f)))); return `rgb(${c[0]},${c[1]},${c[2]})`; }
const TAU = Math.PI * 2;

function create(canvas, mini) {
  const ctx = canvas.getContext('2d'); const mctx = mini.getContext('2d');
  const fog = document.createElement('canvas'); const fctx = fog.getContext('2d');
  const mfog = document.createElement('canvas'); const mfctx = mfog.getContext('2d');
  const R = { canvas, ctx, w: 0, h: 0, dpr: 1, K, zoomMin: 0.55, zoomMax: 2.2, fx: { tracers: [], parts: [], floats: [], rings: [], flashes: [] }, decals: [], time: 0, shake: 0, cache: new Map(), icons: new Map(), tiles: new Map(), sim: null, night: 0 };

  R.resize = function () {
    const dpr = Math.min(2, window.devicePixelRatio || 1); const w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); fog.width = canvas.width; fog.height = canvas.height; }
    R.w = w; R.h = h; R.dpr = dpr;
    const ms = mini.clientWidth || 184; if (mini.width !== ms * dpr) { mini.width = ms * dpr; mini.height = ms * dpr; mfog.width = mini.width; mfog.height = mini.height; }
  };
  // ---------- projeção isométrica 2:1 ----------
  R.worldToScreen = function (cam, x, y, z) { const k = K * cam.zoom; return [(x - y - (cam.x - cam.y)) * k + R.w / 2, (x + y - (cam.x + cam.y)) * k * 0.5 + R.h / 2 - (z || 0) * k]; };
  R.screenToWorld = function (cam, sx, sy) { const k = K * cam.zoom; const X = (sx - R.w / 2) / k + (cam.x - cam.y); const Y2 = (sy - R.h / 2) * 2 / k + (cam.x + cam.y); return [(X + Y2) / 2, (Y2 - X) / 2]; };
  R.screenDeltaToWorld = function (cam, dx, dy) { const k = K * cam.zoom; const X = dx / k, Y2 = dy * 2 / k; return [(X + Y2) / 2, (Y2 - X) / 2]; };
  function miniM() { return mini.width / (2 * S.WORLD); }
  R.worldToMini = function (x, y) { const m = miniM(); return [(x - y) * m + mini.width / 2, (x + y) * m / 2 + mini.width / 4]; };
  R.miniToWorld = function (nx, ny) { const m = miniM(); const X = (nx * mini.width - mini.width / 2) / m, Y2 = (ny * mini.width - mini.width / 4) * 2 / m; return [(X + Y2) / 2, (Y2 - X) / 2]; };

  // ---------- sprites ----------
  function modelFor(def, pid, seed) {
    if (NODE_MODEL[def]) return MD[NODE_MODEL[def]](seed);
    if (def === 'crate') return MD.crate(); if (def === 'wreck') return MD.wreck(); if (def === 'rocks') return MD.rocks(seed);
    const p = R.sim.players[pid]; const style = p.faction; const col = p.color;
    const fn = (def === 'pirata' && style === 'vehnar') ? MD.BY_DEF.pirata_vehnar : MD.BY_DEF[def];
    return fn(col, style);
  }
  R.sprite = function (def, pid, facing, dmg, seed) {
    const key = def + '|' + pid + '|' + facing + '|' + (dmg ? 1 : 0) + '|' + (seed || 0);
    let sp = R.cache.get(key); if (sp) return sp;
    const m = modelFor(def, pid, seed); const b = m.bounds();
    sp = V.renderSprite(m, (facing / FACINGS) * TAU, SV, { damage: dmg ? 0.55 : 0 });
    sp.fw = Math.max(b.x1 - b.x0, b.y1 - b.y0); sp.fh = b.z1 - b.z0;
    R.cache.set(key, sp); return sp;
  };
  R.icon = function (def, pid) {
    const key = def + '|' + pid; let u = R.icons.get(key); if (u) return u;
    const sp = R.sprite(def, pid, 0, false, 0); const cv = document.createElement('canvas'); cv.width = 48; cv.height = 48; const c = cv.getContext('2d');
    const sc = Math.min(44 / sp.w, 44 / sp.h); c.imageSmoothingEnabled = sc < 1; c.drawImage(sp.canvas, (48 - sp.w * sc) / 2, (48 - sp.h * sc) / 2, sp.w * sc, sp.h * sc);
    u = cv.toDataURL(); R.icons.set(key, u); return u;
  };
  R.prepare = function (sim, onProgress, onDone) {
    R.sim = sim; const jobs = [];
    for (const p of sim.players) {
      for (const def in S.BUILDINGS) jobs.push([def, p.id, 0, false]);
      for (const def of ['infantaria', 'coletor', 'veiculo']) for (let f = 0; f < FACINGS; f++) jobs.push([def, p.id, f, false]);
      for (const def of ['drone', 'suporte', 'pirata']) jobs.push([def, p.id, 0, false]);
    }
    for (const res in NODE_MODEL) for (let s = 0; s < 4; s++) jobs.push([res, -1, 0, false, s]);
    jobs.push(['crate', -1, 0, false, 0]); jobs.push(['wreck', -1, 0, false, 0]);
    let i = 0;
    function chunk() { const t0 = performance.now(); while (i < jobs.length && performance.now() - t0 < 24) { const j = jobs[i++]; R.sprite(j[0], j[1], j[2], j[3], j[4]); } if (onProgress) onProgress(i / jobs.length); if (i < jobs.length) requestAnimationFrame(chunk); else if (onDone) onDone(); }
    chunk();
  };
  function facingOf(ang) { return ((Math.round(ang / (TAU / FACINGS)) % FACINGS) + FACINGS) % FACINGS; }
  function fitOf(e, sp) { const foot = e.kind === 'building' ? 2 * e.r * 1.25 : e.kind === 'node' ? 2 * e.r * 1.2 * (0.55 + 0.45 * (e.max ? e.amount / e.max : 1)) : 2 * e.r * 1.25; return foot / sp.fw; }

  // ---------- terreno ----------
  function makeTile(kind, v) {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128; const c = cv.getContext('2d');
    let r = 31 + v * 977 + kind.length * 13; const rnd = () => { r = (r * 1103515245 + 12345) & 0x7fffffff; return r / 0x7fffffff; };
    c.beginPath(); c.moveTo(128, 0); c.lineTo(256, 64); c.lineTo(128, 128); c.lineTo(0, 64); c.closePath(); c.clip();
    const base = kind === 'ice' ? [168, 186, 204] : kind === 'crater' ? [74, 70, 76] : [120, 128, 140];
    c.fillStyle = `rgb(${base[0]},${base[1]},${base[2]})`; c.fillRect(0, 0, 256, 128);
    for (let i = 0; i < 520; i++) { const f = 0.84 + rnd() * 0.32; c.fillStyle = `rgba(${base[0] * f | 0},${base[1] * f | 0},${base[2] * f | 0},${0.5 + rnd() * 0.5})`; c.fillRect(rnd() * 256, rnd() * 128, 1 + rnd() * 8, 1 + rnd() * 4); }
    if (kind === 'ice') { c.strokeStyle = 'rgba(110,140,170,0.35)'; c.lineWidth = 1.2; for (let i = 0; i < 5; i++) { c.beginPath(); c.moveTo(rnd() * 256, rnd() * 128); c.lineTo(rnd() * 256, rnd() * 128); c.lineTo(rnd() * 256, rnd() * 128); c.stroke(); } c.fillStyle = 'rgba(255,255,255,0.18)'; for (let i = 0; i < 40; i++) c.fillRect(rnd() * 256, rnd() * 128, 2, 1); }
    if (kind === 'crater') { c.strokeStyle = 'rgba(255,110,70,0.35)'; c.lineWidth = 1.5; for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(rnd() * 256, rnd() * 128); c.lineTo(rnd() * 256, rnd() * 128); c.stroke(); } c.fillStyle = 'rgba(0,0,0,0.3)'; for (let i = 0; i < 7; i++) { c.beginPath(); c.ellipse(rnd() * 256, rnd() * 128, 6 + rnd() * 16, 3 + rnd() * 8, 0, 0, TAU); c.fill(); } }
    c.strokeStyle = 'rgba(0,0,0,0.12)'; c.lineWidth = 1; c.beginPath(); c.moveTo(128, 0); c.lineTo(256, 64); c.lineTo(128, 128); c.lineTo(0, 64); c.closePath(); c.stroke();
    return cv;
  }
  function tile(kind, v) { const k = kind + v; let t = R.tiles.get(k); if (!t) { t = makeTile(kind, v); R.tiles.set(k, t); } return t; }
  function tileKind(tx, ty) { const cx = (tx + 0.5) * TILE, cy = (ty + 0.5) * TILE; const d = Math.hypot(cx - S.CX, cy - S.CY); if (d < S.RIFT_R + 24) return null; return d < 540 ? 'crater' : 'ice'; }

  function diamond(c, px, py, hw, hh) { c.beginPath(); c.moveTo(px, py - hh); c.lineTo(px + hw, py); c.lineTo(px, py + hh); c.lineTo(px - hw, py); c.closePath(); }
  function ellipse(c, px, py, rx) { c.beginPath(); c.ellipse(px, py, rx, rx * 0.5, 0, 0, TAU); }
  function drawSprite(c, sp, gx, gy, z, scale, k, alpha, clipFrac) {
    const w = sp.w * scale, h = sp.h * scale; const x = gx - sp.ax * scale, y = gy - sp.ay * scale - (z || 0) * k;
    c.globalAlpha = alpha == null ? 1 : alpha; c.imageSmoothingEnabled = scale < 1;
    if (clipFrac != null && clipFrac < 1) { c.save(); c.beginPath(); c.rect(x - 1, y + h * (1 - clipFrac), w + 2, h * clipFrac + 1); c.clip(); c.drawImage(sp.canvas, x, y, w, h); c.restore(); }
    else c.drawImage(sp.canvas, x, y, w, h);
    c.globalAlpha = 1; return { x, y, w, h };
  }
  function hpBar(c, x, y, w, frac) { c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(x - w / 2, y, w, 3); c.fillStyle = frac > 0.5 ? '#7FE3A1' : frac > 0.25 ? '#F2C230' : '#FF5E3A'; c.fillRect(x - w / 2, y, w * Math.max(0, frac), 3); }

  // ---------- eventos → efeitos ----------
  R.onEvents = function (events, sim, human) {
    for (const e of events) {
      switch (e.t) {
        case 'shot': {
          const col = sim.players[e.owner].color;
          R.fx.tracers.push({ x1: e.x1, y1: e.y1, x2: e.x2, y2: e.y2, col, t: 0, life: 0.13, ambush: e.ambush, cls: e.cls });
          R.fx.flashes.push({ x: e.x1, y: e.y1, z: 7, t: 0 });
          for (let i = 0; i < 3; i++) R.fx.parts.push({ x: e.x2, y: e.y2, z: 5, vx: (Math.random() - .5) * 90, vy: (Math.random() - .5) * 90, vz: 40 + Math.random() * 60, t: 0, life: 0.35, c: '#FFD27A', s: 1.6 });
          break; }
        case 'death': {
          const col = e.owner >= 0 ? sim.players[e.owner].color : '#AAAAAA'; const big = e.kind === 'building';
          const n = big ? 34 : 10;
          for (let i = 0; i < n; i++) { const a = Math.random() * TAU, sp = 30 + Math.random() * (big ? 160 : 80); R.fx.parts.push({ x: e.x, y: e.y, z: 4, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: 60 + Math.random() * (big ? 220 : 120), t: 0, life: 0.7 + Math.random() * 0.7, c: Math.random() < 0.5 ? col : '#FF9A5C', s: big ? 2.6 : 1.8, g: true }); }
          for (let i = 0; i < (big ? 8 : 2); i++) R.fx.parts.push({ x: e.x + (Math.random() - .5) * e.r, y: e.y + (Math.random() - .5) * e.r, z: 6, vx: 0, vy: 0, vz: 25, t: 0, life: 2 + Math.random() * 2, c: '#2A2A2E', s: 4, smoke: true });
          R.fx.rings.push({ x: e.x, y: e.y, r0: e.r, r1: e.r * (big ? 4 : 2.5), col: '#FF9A5C', t: 0, life: 0.5 });
          if (big) { R.decals.push({ type: 'crater', x: e.x, y: e.y, r: e.r * 1.3, t: 0, life: 240 }); if (e.owner === human) R.shake = Math.min(1, R.shake + 0.5); }
          else if (e.cls === 'vei' || e.def === 'coletor' || e.def === 'pirata') R.decals.push({ type: 'wreck', x: e.x, y: e.y, r: e.r, ang: Math.random() * TAU, t: 0, life: 60 });
          else R.decals.push({ type: 'scorch', x: e.x, y: e.y, r: e.r * 1.4, t: 0, life: 25 });
          if (R.decals.length > 160) R.decals.splice(0, R.decals.length - 160);
          break; }
        case 'float': if (e.owner === human || e.kind === 'steal') R.fx.floats.push({ x: e.x, y: e.y, text: e.text, col: e.kind === 'steal' ? '#FF6A3D' : '#E8E2D6', t: 0, life: 1.3 }); break;
        case 'alert': if (e.p === human && e.x != null) R.fx.rings.push({ x: e.x, y: e.y, r0: 20, r1: 170, col: e.kind === 'danger' ? '#FF5E3A' : e.kind === 'good' ? '#7FE3A1' : '#F2C230', t: 0, life: 1.6, ping: true }); break;
        case 'super': if (e.kind === 'fundicao') R.fx.rings.push({ x: e.x, y: e.y, r0: 10, r1: 240, col: '#FF8C1A', t: 0, life: 3, ping: true }); else R.shake = 1; break;
        case 'jump': R.fx.rings.push({ x: e.from.x, y: e.from.y, r0: 40, r1: 300, col: '#B23CFF', t: 0, life: 1.2 }); R.fx.rings.push({ x: e.to.x, y: e.to.y, r0: 300, r1: 40, col: '#B23CFF', t: 0, life: 1.2 }); break;
        case 'built': if (e.p === human) R.fx.rings.push({ x: e.x, y: e.y, r0: 10, r1: 60, col: '#7FE3A1', t: 0, life: 0.6 }); break;
        case 'place': for (let i = 0; i < 8; i++) R.fx.parts.push({ x: e.x + (Math.random() - .5) * 30, y: e.y + (Math.random() - .5) * 30, z: 1, vx: 0, vy: 0, vz: 20, t: 0, life: 1.2, c: '#9A9A9A', s: 3, smoke: true }); break;
        case 'crate': R.fx.rings.push({ x: e.x, y: e.y, r0: 5, r1: 50, col: '#F2C230', t: 0, life: 0.8 }); break;
      }
    }
  };
  function updateFx(dt) {
    const f = R.fx;
    for (const arr of [f.tracers, f.parts, f.floats, f.rings, f.flashes]) for (let i = arr.length - 1; i >= 0; i--) { const o = arr[i]; o.t += dt; if (o.t >= o.life || (o.life == null && o.t > 0.07)) arr.splice(i, 1); }
    for (const p of f.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; if (p.smoke) { p.vz = Math.max(8, p.vz - dt * 6); p.s += dt * 6; p.vx += (Math.random() - .5) * 8 * dt; } else if (p.g) { p.vz -= 260 * dt; if (p.z < 0) { p.z = 0; p.vz = 0; p.vx *= 0.5; p.vy *= 0.5; } } }
    for (let i = R.decals.length - 1; i >= 0; i--) { const d = R.decals[i]; d.t += dt; if (d.t > d.life) R.decals.splice(i, 1); }
    R.shake = Math.max(0, R.shake - dt * 2);
    if (f.parts.length > 1400) f.parts.splice(0, f.parts.length - 1400);
  }
  function lerp(e, a) { return [e.px + (e.x - e.px) * a, e.py + (e.y - e.py) * a]; }

  // ---------- quadro ----------
  R.draw = function (sim, view, alpha, dt) {
    R.sim = sim; R.time += dt; updateFx(dt);
    const c = ctx, cam = view.cam, human = view.human, me = sim.players[human];
    const vis = view.reveal ? { has: () => true } : sim.vis[human];
    const W = R.w, H = R.h, k = K * cam.zoom; const z = cam.zoom;
    R.night = (1 - Math.cos(TAU * sim.time / 750)) / 2;
    c.setTransform(R.dpr, 0, 0, R.dpr, 0, 0);
    c.fillStyle = '#07080B'; c.fillRect(0, 0, W, H);
    let shx = 0, shy = 0; if (R.shake > 0) { shx = (Math.random() - 0.5) * 9 * R.shake; shy = (Math.random() - 0.5) * 9 * R.shake; }
    c.save(); c.translate(shx, shy);
    const P = (x, y, zz) => R.worldToScreen(cam, x, y, zz);
    const corners = [R.screenToWorld(cam, 0, 0), R.screenToWorld(cam, W, 0), R.screenToWorld(cam, 0, H), R.screenToWorld(cam, W, H)];
    const wx0 = Math.min(...corners.map(p => p[0])) - 80, wx1 = Math.max(...corners.map(p => p[0])) + 80, wy0 = Math.min(...corners.map(p => p[1])) - 80, wy1 = Math.max(...corners.map(p => p[1])) + 80;
    const inView = (x, y, m) => x > wx0 - m && x < wx1 + m && y > wy0 - m && y < wy1 + m;
    // territórios visíveis
    const terr = [];
    for (const e of sim.ents) { if (!e.alive || e.kind !== 'building' || !e.built) continue; const t = S.BUILDINGS[e.def].territory; if (!t) continue; if (e.owner !== human && !vis.has(e.id) && !view.memory.has(e.id)) continue; terr.push({ x: e.x, y: e.y, r: t, col: sim.players[e.owner].color }); }
    // terreno
    const tw = TILE * k * 2, th = TILE * k;
    const tx0 = Math.max(0, Math.floor(wx0 / TILE)), tx1 = Math.min(TILES - 1, Math.ceil(wx1 / TILE)), ty0 = Math.max(0, Math.floor(wy0 / TILE)), ty1 = Math.min(TILES - 1, Math.ceil(wy1 / TILE));
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      const kind = tileKind(tx, ty); if (!kind) continue;
      const cx = (tx + 0.5) * TILE, cy = (ty + 0.5) * TILE; const p = P(cx, cy, 0);
      if (p[0] < -tw || p[0] > W + tw || p[1] < -th || p[1] > H + th) continue;
      c.drawImage(tile(kind, (tx * 7 + ty * 13) % 3), p[0] - tw / 2, p[1] - th / 2, tw, th);
      for (const t of terr) if (Math.hypot(cx - t.x, cy - t.y) <= t.r) { c.fillStyle = rgba(t.col, 0.16); diamond(c, p[0], p[1], tw / 2, th / 2); c.fill(); c.strokeStyle = 'rgba(0,0,0,0.18)'; c.lineWidth = 1; c.stroke(); break; }
    }
    // bordas de território
    c.lineWidth = 1.5; c.setLineDash([8, 6]);
    for (const t of terr) { const p = P(t.x, t.y, 0); c.strokeStyle = rgba(t.col, 0.35); ellipse(c, p[0], p[1], t.r * k); c.stroke(); }
    c.setLineDash([]);
    // Fenda
    { const p = P(S.CX, S.CY, 0); const rr = S.RIFT_R * k;
      if (p[0] > -rr * 4 && p[0] < W + rr * 4 && p[1] > -rr * 2 && p[1] < H + rr * 2) {
        const g = c.createRadialGradient(p[0], p[1], rr * 0.3, p[0], p[1], rr * 3); g.addColorStop(0, 'rgba(255,94,58,0.5)'); g.addColorStop(0.4, 'rgba(178,60,255,0.25)'); g.addColorStop(1, 'rgba(178,60,255,0)');
        c.save(); c.translate(p[0], p[1]); c.scale(1, 0.5); c.fillStyle = g; c.beginPath(); c.arc(0, 0, rr * 3, 0, TAU); c.fill();
        c.fillStyle = '#05040A'; c.beginPath(); c.arc(0, 0, rr, 0, TAU); c.fill();
        for (let i = 0; i < 3; i++) { const ph = (R.time * 0.25 + i / 3) % 1; c.strokeStyle = `rgba(255,120,80,${0.55 * (1 - ph)})`; c.lineWidth = 2; c.beginPath(); c.arc(0, 0, rr * (0.35 + ph * 0.75), 0, TAU); c.stroke(); }
        c.strokeStyle = 'rgba(255,160,120,0.6)'; c.lineWidth = 1.5; c.setLineDash([6, 6]); c.beginPath(); c.arc(0, 0, rr, 0, TAU); c.stroke(); c.setLineDash([]); c.restore();
      } }
    // decalques
    for (const d of R.decals) {
      if (!inView(d.x, d.y, 80)) continue; const p = P(d.x, d.y, 0); const a = Math.min(1, (d.life - d.t) / 10);
      if (d.type === 'crater') { const g = c.createRadialGradient(p[0], p[1], 1, p[0], p[1], d.r * k); g.addColorStop(0, `rgba(10,8,8,${0.85 * a})`); g.addColorStop(0.6, `rgba(40,36,34,${0.5 * a})`); g.addColorStop(1, 'rgba(0,0,0,0)'); c.save(); c.translate(p[0], p[1]); c.scale(1, 0.5); c.fillStyle = g; c.beginPath(); c.arc(0, 0, d.r * k, 0, TAU); c.fill(); c.restore(); }
      else if (d.type === 'scorch') { c.save(); c.translate(p[0], p[1]); c.scale(1, 0.5); c.fillStyle = `rgba(20,16,14,${0.5 * a})`; c.beginPath(); c.arc(0, 0, d.r * k, 0, TAU); c.fill(); c.restore(); }
      else if (d.type === 'wreck') { const sp = R.sprite('wreck', -1, facingOf(d.ang), false, 0); drawSprite(c, sp, p[0], p[1], 0, (2 * d.r * 1.3 / sp.fw) * k / SV, k, 0.9 * a); if (d.t < 20 && Math.random() < 0.25) R.fx.parts.push({ x: d.x, y: d.y, z: 6, vx: 0, vy: 0, vz: 18, t: 0, life: 1.5, c: '#3A3A3E', s: 3, smoke: true }); }
    }
    // lista de objetos ordenada por profundidade
    const items = []; const lights = [];
    for (const e of sim.ents) {
      if (!e.alive || e.kind === 'crate' && !vis.has(e.id)) continue;
      const own = e.owner === human;
      if (e.kind !== 'node' && !own && !vis.has(e.id)) continue;
      if (!inView(e.x, e.y, 60 + e.r * 3)) continue;
      items.push({ e, d: e.x + e.y });
    }
    for (const [id, m] of view.memory) { if (vis.has(id) || !inView(m.x, m.y, 100)) continue; items.push({ mem: m, id, d: m.x + m.y }); }
    items.sort((a, b) => a.d - b.d);
    for (const it of items) {
      if (it.mem) { const m = it.mem; const sp = R.sprite(m.def, m.owner, 0, false, 0); const p = P(m.x, m.y, 0); drawSprite(c, sp, p[0], p[1], 0, (2 * S.BUILDINGS[m.def].r * 1.25 / sp.fw) * k / SV, k, 0.35); continue; }
      const e = it.e; const own = e.owner === human;
      if (e.kind === 'node') {
        const sp = R.sprite(e.res, -1, 0, false, e.id % 4); const p = P(e.x, e.y, 0); const sc = fitOf(e, sp) * k / SV;
        const g = c.createRadialGradient(p[0], p[1], 2, p[0], p[1], e.r * 1.6 * k); g.addColorStop(0, rgba(NODE_COLOR[e.res], 0.3)); g.addColorStop(1, rgba(NODE_COLOR[e.res], 0)); c.save(); c.translate(p[0], p[1]); c.scale(1, 0.5); c.fillStyle = g; c.beginPath(); c.arc(0, 0, e.r * 1.6 * k, 0, TAU); c.fill(); c.restore();
        if (view.sel.has(e.id)) { c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = 1.5; ellipse(c, p[0], p[1], (e.r + 6) * k); c.stroke(); }
        drawSprite(c, sp, p[0], p[1], 0, sc, k, 1);
        for (const l of sp.lights) lights.push({ x: p[0] - sp.ax * sc + l.x * sc, y: p[1] - sp.ay * sc + l.y * sc, r: 12 * z, c: l.c, a: 0.5 });
        continue;
      }
      if (e.kind === 'crate') { const sp = R.sprite('crate', -1, 0, false, 0); const p = P(e.x, e.y, 0); drawSprite(c, sp, p[0], p[1], 0, (2 * e.r * 1.6 / sp.fw) * k / SV, k, 1); c.strokeStyle = `rgba(242,194,48,${0.4 + 0.3 * Math.sin(R.time * 4)})`; c.lineWidth = 1.5; ellipse(c, p[0], p[1], 16 * k); c.stroke(); continue; }
      const p = sim.players[e.owner];
      const isUnit = e.kind === 'unit';
      const [wx, wy] = isUnit ? lerp(e, alpha) : [e.x, e.y];
      const ud = isUnit ? S.UNITS[e.def] : S.BUILDINGS[e.def];
      const zz = isUnit && ud.flying ? 14 : 0;
      let facing = 0; if (isUnit) facing = facingOf(e.ang || 0); else if (ud.wall) facing = facingOf(e.ang || 0); else if (ud.attack) facing = facingOf(e.aimAng || 0);
      const dmg = !isUnit && e.built && e.hp < e.maxHp * 0.5;
      const sp = R.sprite(e.def, e.owner, facing, dmg, 0); const sc = fitOf(e, sp) * k / SV;
      const g = P(wx, wy, 0);
      // sombra
      c.fillStyle = 'rgba(0,0,0,0.35)'; ellipse(c, g[0] + sp.fw * sc * 0.15, g[1] + 1, sp.fw * sc * 0.55); c.fill();
      if (view.sel.has(e.id)) { c.strokeStyle = 'rgba(255,255,255,0.9)'; c.lineWidth = 1.5; ellipse(c, g[0], g[1], (e.r + 5) * k); c.stroke(); if (!isUnit && ud.attack) { c.strokeStyle = 'rgba(255,255,255,0.18)'; c.setLineDash([4, 6]); ellipse(c, g[0], g[1], ud.attack.range * k); c.stroke(); c.setLineDash([]); } if (!isUnit && ud.detect) { c.strokeStyle = 'rgba(127,227,161,0.3)'; ellipse(c, g[0], g[1], ud.detect * k); c.stroke(); } }
      const alphaS = e.cloaked ? (own ? 0.45 : 1) : 1;
      const box = drawSprite(c, sp, g[0], g[1], zz, sc, k, alphaS, isUnit ? 1 : (e.built ? 1 : 0.12 + 0.88 * e.progress));
      if (!isUnit && !e.built) { c.strokeStyle = '#7FE3A1'; c.lineWidth = 3; c.beginPath(); c.ellipse(g[0], g[1], (e.r + 5) * k, (e.r + 5) * k * 0.5, 0, -Math.PI / 2, -Math.PI / 2 + TAU * e.progress); c.stroke(); }
      if (!isUnit && e.jumpT > 0) { c.strokeStyle = '#B23CFF'; c.lineWidth = 4; c.beginPath(); c.ellipse(g[0], g[1], (e.r + 10) * k, (e.r + 10) * k * 0.5, 0, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - e.jumpT / S.JUMP_CHANNEL)); c.stroke(); if (e.jumpTo && own) { const q = P(e.jumpTo.x, e.jumpTo.y, 0); c.setLineDash([6, 6]); c.strokeStyle = 'rgba(178,60,255,0.6)'; c.lineWidth = 2; c.beginPath(); c.moveTo(g[0], g[1]); c.lineTo(q[0], q[1]); c.stroke(); c.setLineDash([]); ellipse(c, q[0], q[1], e.r * k); c.stroke(); } }
      if (own && e.queue && e.queue.length && e.built) { const it2 = e.queue[0]; c.strokeStyle = '#F2C230'; c.lineWidth = 2.5; c.beginPath(); c.ellipse(g[0], g[1], (e.r + 3) * k, (e.r + 3) * k * 0.5, 0, -Math.PI / 2, -Math.PI / 2 + TAU * (it2.t / it2.total)); c.stroke(); }
      if (e.hp < e.maxHp - 0.5 || view.sel.has(e.id)) hpBar(c, g[0], box.y - 6, Math.max(14, e.r * 2 * k), e.hp / e.maxHp);
      if (e.cloaked && own) { c.strokeStyle = 'rgba(255,255,255,0.35)'; c.setLineDash([2, 3]); c.lineWidth = 1; ellipse(c, g[0], g[1], (e.r + 3) * k); c.stroke(); c.setLineDash([]); }
      if (isUnit && view.sel.has(e.id) && (e.state === 'move' || e.state === 'attackmove')) { const q = P(e.tx, e.ty, 0); c.strokeStyle = e.state === 'attackmove' ? 'rgba(255,94,58,0.35)' : 'rgba(255,255,255,0.2)'; c.lineWidth = 1; c.setLineDash([3, 5]); c.beginPath(); c.moveTo(g[0], g[1]); c.lineTo(q[0], q[1]); c.stroke(); c.setLineDash([]); }
      // luzes emissivas do sprite (só estruturas e à noite)
      if (!isUnit && R.night > 0.12 && z > 0.7) { let nL = 0; for (const l of sp.lights) { if (nL++ >= 5) break; lights.push({ x: box.x + l.x * sc, y: box.y + l.y * sc, r: 9 * z, c: l.c, a: 0.55 }); } }
      // fumaça: reatores ativos e estruturas danificadas
      if (!isUnit && e.built && (e.def === 'reator' && Math.random() < 0.12 || dmg && Math.random() < 0.08)) R.fx.parts.push({ x: wx + (e.def === 'reator' ? e.r * 0.35 : (Math.random() - .5) * e.r), y: wy - (e.def === 'reator' ? e.r * 0.3 : (Math.random() - .5) * e.r), z: e.def === 'reator' ? e.r * 1.1 : e.r * 0.6, vx: 4, vy: -3, vz: 16, t: 0, life: 2.2 + Math.random(), c: dmg ? '#2A2A2E' : '#6A6F78', s: 2.5, smoke: true });
      // sifão
      if (isUnit && e.state === 'siphon') { const t = sim.byId.get(e.target); if (t && S.dist(e.x, e.y, t.x, t.y) <= S.UNITS.pirata.siphonRange + t.r + 2) { const a = P(wx, wy, 5), b = P(t.x, t.y, t.r * 0.6); c.save(); c.strokeStyle = 'rgba(214,76,255,0.9)'; c.lineWidth = 2.5; c.setLineDash([7, 5]); c.lineDashOffset = -R.time * 80; c.beginPath(); c.moveTo(a[0], a[1]); c.quadraticCurveTo((a[0] + b[0]) / 2, Math.min(a[1], b[1]) - 30 * z, b[0], b[1]); c.stroke(); c.restore(); if (Math.random() < 0.4) R.fx.parts.push({ x: t.x, y: t.y, z: t.r * 0.6, vx: (e.x - t.x) * 1.1, vy: (e.y - t.y) * 1.1, vz: 10, t: 0, life: 0.9, c: '#E08CFF', s: 2.2 }); lights.push({ x: b[0], y: b[1], r: 18 * z, c: '#D64CFF', a: 0.5 }); } }
    }
    // efeitos
    for (const t of R.fx.tracers) { const a = 1 - t.t / t.life; const p1 = P(t.x1, t.y1, 7), p2 = P(t.x2, t.y2, 5); c.strokeStyle = rgba(t.ambush ? '#FFFFFF' : '#FFE0A0', a); c.lineWidth = t.ambush ? 3 : (t.cls === 'vei' || t.cls === 'est' ? 2 : 1.3); c.beginPath(); c.moveTo(p1[0], p1[1]); c.lineTo(p2[0], p2[1]); c.stroke(); }
    for (const f of R.fx.flashes) { const p = P(f.x, f.y, f.z); c.fillStyle = 'rgba(255,240,200,0.9)'; c.beginPath(); c.arc(p[0], p[1], 3 * z, 0, TAU); c.fill(); lights.push({ x: p[0], y: p[1], r: 26 * z, c: '#FFC878', a: 0.8 }); }
    for (const p of R.fx.parts) { const a = 1 - p.t / p.life; const q = P(p.x, p.y, p.z); c.fillStyle = rgba(p.c, p.smoke ? a * 0.45 : a); c.beginPath(); c.arc(q[0], q[1], p.s * z, 0, TAU); c.fill(); }
    for (const r of R.fx.rings) { const kk = r.t / r.life; const rr = (r.r0 + (r.r1 - r.r0) * kk) * k; const p = P(r.x, r.y, 0); c.strokeStyle = rgba(r.col, (1 - kk) * (r.ping ? 0.9 : 0.6)); c.lineWidth = r.ping ? 3 : 2; ellipse(c, p[0], p[1], rr); c.stroke(); }
    // fantasma de construção e muros
    if (view.ghost) {
      const gh = view.ghost; const d = S.BUILDINGS[gh.def]; const col = gh.ok ? '#7FE3A1' : '#FF5E3A'; const p = P(gh.x, gh.y, 0);
      c.fillStyle = rgba(col, 0.18); ellipse(c, p[0], p[1], (d.r + 4) * k); c.fill(); c.strokeStyle = rgba(col, 0.8); c.lineWidth = 1.5; c.stroke();
      const sp = R.sprite(gh.def, human, d.wall ? facingOf(gh.ang || 0) : 0, false, 0); drawSprite(c, sp, p[0], p[1], 0, (2 * d.r * 1.25 / sp.fw) * k / SV, k, 0.65);
      c.setLineDash([6, 4]); c.strokeStyle = rgba(col, 0.5); if (d.territory) { ellipse(c, p[0], p[1], d.territory * k); c.stroke(); } if (d.attack) { ellipse(c, p[0], p[1], d.attack.range * k); c.stroke(); } c.setLineDash([]);
    }
    if (view.wallGhost) for (const g of view.wallGhost) { const p = P(g.x, g.y, 0); const col = g.ok ? '#7FE3A1' : '#FF5E3A'; const sp = R.sprite(view.ghost ? view.ghost.def : 'muro', human, facingOf(g.ang), false, 0); c.fillStyle = rgba(col, 0.25); ellipse(c, p[0], p[1], 9 * k); c.fill(); drawSprite(c, sp, p[0], p[1], 0, (20 / sp.fw) * k / SV, k, 0.6); }
    if (view.marker) { const m = view.marker; const kk = Math.min(1, (R.time - m.t) / 0.6); if (kk < 1) { const p = P(m.x, m.y, 0); c.strokeStyle = rgba(m.col, 1 - kk); c.lineWidth = 2; ellipse(c, p[0], p[1], (6 + 26 * (1 - kk)) * z); c.stroke(); } }
    c.restore();
    // ---- névoa de guerra + noite (espaço de tela) ----
    fctx.setTransform(1, 0, 0, 1, 0, 0); fctx.globalCompositeOperation = 'source-over'; fctx.clearRect(0, 0, fog.width, fog.height);
    const nightA = me.blackoutT > 0 ? 0.93 : 0.84;
    fctx.fillStyle = `rgba(5,7,12,${view.reveal ? 0 : nightA})`; fctx.fillRect(0, 0, fog.width, fog.height);
    fctx.globalCompositeOperation = 'destination-out'; fctx.setTransform(R.dpr, 0, 0, R.dpr, 0, 0);
    for (const e of sim.ents) {
      if (!e.alive || e.owner !== human) continue; const rad = S.sensorRadius(sim, e); if (!inView(e.x, e.y, rad)) continue;
      const p = R.worldToScreen(cam, e.x, e.y, 0); const rx = rad * k;
      fctx.save(); fctx.translate(p[0], p[1]); fctx.scale(1, 0.5); const g = fctx.createRadialGradient(0, 0, rx * 0.68, 0, 0, rx); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)'); fctx.fillStyle = g; fctx.beginPath(); fctx.arc(0, 0, rx, 0, TAU); fctx.fill(); fctx.restore();
    }
    c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(fog, 0, 0); c.setTransform(R.dpr, 0, 0, R.dpr, 0, 0);
    // noite: escurecimento suave + brilhos
    if (R.night > 0.12) {
      c.fillStyle = `rgba(6,10,28,${0.42 * R.night})`; c.fillRect(0, 0, W, H);
      c.save(); c.globalCompositeOperation = 'lighter';
      for (const l of lights) { if (l.x < -40 || l.x > W + 40 || l.y < -40 || l.y > H + 40) continue; const g = c.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r); g.addColorStop(0, rgba(l.c, (l.a || 0.5) * R.night)); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.beginPath(); c.arc(l.x, l.y, l.r, 0, TAU); c.fill(); }
      c.restore();
    } else if (lights.length) { // de dia só flashes e sifão brilham
      c.save(); c.globalCompositeOperation = 'lighter'; for (const l of lights) { if (l.a < 0.6) continue; const g = c.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r); g.addColorStop(0, rgba(l.c, 0.5)); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.beginPath(); c.arc(l.x, l.y, l.r, 0, TAU); c.fill(); } c.restore();
    }
    // nós fora de visão (conhecimento do mapa) e textos flutuantes, acima da névoa
    c.save(); c.translate(shx, shy);
    for (const e of sim.ents) { if (!e.alive || e.kind !== 'node' || !inView(e.x, e.y, 40)) continue; let seen = false; for (const o of sim.ents) { if (o.alive && o.owner === human && S.dist(o.x, o.y, e.x, e.y) <= S.sensorRadius(sim, o)) { seen = true; break; } } if (seen) continue; const sp = R.sprite(e.res, -1, 0, false, e.id % 4); const p = P(e.x, e.y, 0); drawSprite(c, sp, p[0], p[1], 0, fitOf(e, sp) * k / SV, k, 0.3); }
    for (const f of R.fx.floats) { const kk = f.t / f.life; const p = P(f.x, f.y, 10); c.fillStyle = rgba(f.col, 1 - kk); c.font = 'bold 13px IBM Plex Mono, monospace'; c.textAlign = 'center'; c.fillText(f.text, p[0], p[1] - kk * 30); }
    // fumaça de reatores inimigos Vehnar acima da névoa (Fumaça é visível a todos)
    for (const e of sim.ents) { if (!e.alive || e.kind !== 'building' || e.def !== 'reator' || !e.built || e.owner === human || !S.FACTIONS[sim.players[e.owner].faction].smoke || !inView(e.x, e.y, 60)) continue; const p = P(e.x, e.y, e.r * 1.2); c.fillStyle = 'rgba(190,190,200,0.45)'; for (let i = 0; i < 3; i++) { const ph = (R.time * 0.4 + i / 3 + e.id * 0.1) % 1; c.beginPath(); c.arc(p[0] + 6 + Math.sin(R.time + i) * 6, p[1] - 6 - ph * 40 * z, (4 + ph * 8) * z, 0, TAU); c.fill(); } }
    c.restore();
    if (view.box) { const b = view.box; c.strokeStyle = 'rgba(255,255,255,0.8)'; c.fillStyle = 'rgba(255,255,255,0.08)'; c.lineWidth = 1; c.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0); c.strokeRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0); }
    const reg = me.energy.regime;
    if (reg !== 'pleno') { const col = reg === 'colapso' ? '255,94,58' : '242,194,48'; const a = reg === 'colapso' ? 0.25 + 0.15 * Math.sin(R.time * 5) : 0.15; const g = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75); g.addColorStop(0, `rgba(${col},0)`); g.addColorStop(1, `rgba(${col},${a})`); c.fillStyle = g; c.fillRect(0, 0, W, H); }
    drawMinimap(sim, view);
  };

  function drawMinimap(sim, view) {
    const c = mctx; const size = mini.width; const human = view.human; const vis = view.reveal ? { has: () => true } : sim.vis[human]; const m = miniM();
    const M = (x, y) => R.worldToMini(x, y);
    c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = '#0B0D11'; c.fillRect(0, 0, size, size);
    c.fillStyle = '#15181F'; diamond(c, size / 2, size / 2, size / 2, size / 4); c.fill();
    { const p = M(S.CX, S.CY); c.fillStyle = 'rgba(255,94,58,0.35)'; c.beginPath(); c.ellipse(p[0], p[1], S.RIFT_R * 2 * m, S.RIFT_R * m, 0, 0, TAU); c.fill(); c.fillStyle = '#05040A'; c.beginPath(); c.ellipse(p[0], p[1], S.RIFT_R * m, S.RIFT_R * m * 0.5, 0, 0, TAU); c.fill(); }
    for (const e of sim.ents) {
      if (!e.alive) continue;
      if (e.kind === 'node') { const p = M(e.x, e.y); c.fillStyle = NODE_COLOR[e.res]; c.fillRect(p[0] - 1.5, p[1] - 1.5, 3, 3); continue; }
      const own = e.owner === human; if (!(own || vis.has(e.id))) continue;
      const col = sim.players[e.owner].color; const p = M(e.x, e.y);
      if (e.kind === 'building') { const t = S.BUILDINGS[e.def].territory; if (t && e.built) { c.fillStyle = rgba(col, 0.1); c.beginPath(); c.ellipse(p[0], p[1], t * m, t * m * 0.5, 0, 0, TAU); c.fill(); } c.fillStyle = col; const r = e.def === 'nucleo' ? 4 : S.BUILDINGS[e.def].wall ? 1.5 : 2.5; c.fillRect(p[0] - r, p[1] - r, r * 2, r * 2); }
      else if (e.kind === 'unit') { c.fillStyle = col; c.fillRect(p[0] - 1, p[1] - 1, 2, 2); }
    }
    for (const [id, mm] of view.memory) if (!vis.has(id)) { const p = M(mm.x, mm.y); c.fillStyle = rgba(sim.players[mm.owner].color, 0.5); c.fillRect(p[0] - 2, p[1] - 2, 4, 4); }
    mfctx.setTransform(1, 0, 0, 1, 0, 0); mfctx.globalCompositeOperation = 'source-over'; mfctx.clearRect(0, 0, size, size);
    mfctx.fillStyle = 'rgba(6,8,12,0.72)'; diamond(mfctx, size / 2, size / 2, size / 2, size / 4); mfctx.fill(); mfctx.globalCompositeOperation = 'destination-out';
    for (const e of sim.ents) { if (!e.alive || e.owner !== human) continue; const r = S.sensorRadius(sim, e) * m; const p = M(e.x, e.y); mfctx.beginPath(); mfctx.ellipse(p[0], p[1], r, r * 0.5, 0, 0, TAU); mfctx.fill(); }
    c.drawImage(mfog, 0, 0);
    for (const r of R.fx.rings) if (r.ping) { const kk = r.t / r.life; const p = M(r.x, r.y); c.strokeStyle = rgba(r.col, 1 - kk); c.lineWidth = 1.5; c.beginPath(); c.arc(p[0], p[1], 3 + 10 * kk, 0, TAU); c.stroke(); }
    const cam = view.cam; const cs = [R.screenToWorld(cam, 0, 0), R.screenToWorld(cam, R.w, 0), R.screenToWorld(cam, R.w, R.h), R.screenToWorld(cam, 0, R.h)].map(p => M(p[0], p[1]));
    c.strokeStyle = 'rgba(255,255,255,0.75)'; c.lineWidth = 1; c.beginPath(); cs.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath(); c.stroke();
  }
  return R;
}
ARD.render = { create, NODE_COLOR, rgba, shade, K };
})(globalThis.ARD = globalThis.ARD || {});
