/* Cena de teste de estilo: base cercada por muros numa planície de gelo, raid em andamento. */
(function (ARD) {
'use strict';
const V = ARD.vox, MD = ARD.models;
const S = 4;                       // px por voxel
const T = 16;                      // voxels por tile
const TW = T * S * 2, TH = T * S;  // tile 96x48
const GRID = 11;
const P1 = '#2E6BE6', P2 = '#C8322E';
const FACINGS = 16;
const canvas = document.getElementById('c'); const ctx = canvas.getContext('2d');
const light = document.createElement('canvas'); const lctx = light.getContext('2d');
let W = 0, H = 0, DPR = 1;
const state = { night: false, grid: false, time: 0, spriteCount: 0, buildMs: 0 };

function proj(x, y, z) { return [(x - y) * S, (x + y) * S * 0.5 - (z || 0) * S]; } // mundo em voxels → tela (sem câmera)
const cache = new Map();
function sprite(name, col, facing, extra) {
  const key = name + '|' + col + '|' + facing + '|' + (extra || '');
  let sp = cache.get(key); if (sp) return sp;
  const m = MD[name](col, extra);
  const t0 = performance.now();
  sp = V.renderSprite(m, (facing / FACINGS) * Math.PI * 2, S);
  state.buildMs += performance.now() - t0; state.spriteCount++;
  cache.set(key, sp); return sp;
}
// ---------- terreno ----------
const tiles = {};
function makeTile(kind, seed) {
  const cv = document.createElement('canvas'); cv.width = TW; cv.height = TH + 1; const c = cv.getContext('2d');
  let r = seed; const rnd = () => { r = (r * 1103515245 + 12345) & 0x7fffffff; return r / 0x7fffffff; };
  c.beginPath(); c.moveTo(TW / 2, 0); c.lineTo(TW, TH / 2); c.lineTo(TW / 2, TH); c.lineTo(0, TH / 2); c.closePath(); c.clip();
  const base = kind === 'ice' ? [196, 214, 230] : kind === 'rock' ? [96, 104, 116] : kind === 'metal' ? [52, 58, 68] : [170, 190, 205];
  c.fillStyle = `rgb(${base[0]},${base[1]},${base[2]})`; c.fillRect(0, 0, TW, TH + 1);
  for (let i = 0; i < 260; i++) { const f = 0.86 + rnd() * 0.28; c.fillStyle = `rgba(${base[0] * f | 0},${base[1] * f | 0},${base[2] * f | 0},${0.5 + rnd() * 0.5})`; const x = rnd() * TW, y = rnd() * TH; c.fillRect(x, y, 1 + rnd() * 5, 1 + rnd() * 2.5); }
  if (kind === 'ice') { c.strokeStyle = 'rgba(120,150,180,0.35)'; c.lineWidth = 1; for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(rnd() * TW, rnd() * TH); c.lineTo(rnd() * TW, rnd() * TH); c.lineTo(rnd() * TW, rnd() * TH); c.stroke(); } }
  if (kind === 'metal') { c.strokeStyle = 'rgba(0,0,0,0.45)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(TW / 2, 0); c.lineTo(TW / 2, TH); c.moveTo(0, TH / 2); c.lineTo(TW, TH / 2); c.stroke(); c.fillStyle = 'rgba(255,255,255,0.08)'; for (let i = 0; i < 6; i++) c.fillRect(rnd() * TW, rnd() * TH, 2, 2); }
  if (kind === 'rock') { c.fillStyle = 'rgba(0,0,0,0.25)'; for (let i = 0; i < 5; i++) { c.beginPath(); c.ellipse(rnd() * TW, rnd() * TH, 4 + rnd() * 8, 2 + rnd() * 4, 0, 0, 7); c.fill(); } }
  return cv;
}
function tile(kind, v) { const k = kind + v; if (!tiles[k]) tiles[k] = makeTile(kind, 17 + v * 31 + kind.length * 7); return tiles[k]; }
const map = []; { let r = 99; const rnd = () => { r = (r * 1103515245 + 12345) & 0x7fffffff; return r / 0x7fffffff; };
  for (let y = 0; y < GRID; y++) { map[y] = []; for (let x = 0; x < GRID; x++) { const inBase = x >= 2 && x <= 8 && y >= 2 && y <= 8; const edge = (x + y) % 9 === 0 || (x * 7 + y * 3) % 11 === 0; map[y][x] = { kind: inBase ? 'metal' : edge ? 'rock' : 'ice', v: Math.floor(rnd() * 4) }; } } }

// ---------- objetos ----------
// posições em voxels de mundo (tile = 16); base ocupa os tiles 2..8
const objects = [
  { n: 'nucleus', col: P1, x: 4.6 * T, y: 4.6 * T },
  { n: 'refinery', col: P1, x: 2.3 * T, y: 2.1 * T },
  { n: 'reactor', col: P1, x: 6.9 * T, y: 2.2 * T }, { n: 'reactor', col: P1, x: 7.7 * T, y: 3.9 * T },
  { n: 'barracks', col: P1, x: 2.3 * T, y: 6.7 * T },
  { n: 'tower', col: P1, x: 1.7 * T, y: 1.1 * T }, { n: 'tower', col: P1, x: 8.5 * T, y: 1.1 * T }, { n: 'tower', col: P1, x: 1.7 * T, y: 8.9 * T }, { n: 'tower', col: P1, x: 8.5 * T, y: 8.9 * T },
  { n: 'crystals', col: 5, x: 9.2 * T, y: 7.4 * T }, { n: 'crystals', col: 9, x: 9.9 * T, y: 8.6 * T }, { n: 'crystals', col: 3, x: 0.2 * T, y: 8.2 * T }, { n: 'crystals', col: 7, x: 9.4 * T, y: 9.7 * T },
  { n: 'rocks', col: 2, x: 0.3 * T, y: 1.0 * T }, { n: 'rocks', col: 4, x: 9.6 * T, y: 0.4 * T }, { n: 'rocks', col: 6, x: 0.9 * T, y: 9.6 * T }, { n: 'rocks', col: 8, x: 9.3 * T, y: 5.0 * T },
  { n: 'wreck', col: P2, x: 7.0 * T, y: 9.5 * T, facing: 3 },
];
for (let i = 0; i < 8; i++) { const x = (1.6 + i) * T; objects.push({ n: 'wall', col: P1, x, y: 1.5 * T, wall: true }); objects.push({ n: 'wall', col: P1, x, y: 8.9 * T, wall: true, gate: i === 4 }); }
for (let i = 0; i < 8; i++) { const y = (1.6 + i) * T; objects.push({ n: 'wall', col: P1, x: 1.4 * T, y, wall: true, rot: 1 }); objects.push({ n: 'wall', col: P1, x: 8.9 * T, y, wall: true, rot: 1 }); }

// unidades com rotas simples
const units = [
  { n: 'harvester', col: P1, path: [[8.4 * T, 5.3 * T], [9.6 * T, 7.9 * T], [8.4 * T, 5.3 * T]], sp: 9, t: 0 },
  { n: 'harvester', col: P1, path: [[3.4 * T, 3.4 * T], [0.9 * T, 8.4 * T], [3.4 * T, 3.4 * T]], sp: 9, t: 0.5 },
  { n: 'tank', col: P1, path: [[5.6 * T, 9.9 * T], [5.6 * T, 6.4 * T], [7.6 * T, 6.4 * T], [5.6 * T, 9.9 * T]], sp: 14, t: 0.2 },
  { n: 'tank', col: P1, path: [[6.3 * T, 10.3 * T], [6.3 * T, 6.9 * T], [7.9 * T, 7.0 * T], [6.3 * T, 10.3 * T]], sp: 14, t: 0.25 },
  { n: 'mech', col: P1, path: [[4.2 * T, 7.9 * T], [6.8 * T, 7.9 * T], [4.2 * T, 7.9 * T]], sp: 6, t: 0 },
  { n: 'drone', col: P1, path: [[3.4 * T, 4.2 * T], [7.6 * T, 5.0 * T], [6.2 * T, 8.6 * T], [3.4 * T, 4.2 * T]], sp: 24, t: 0.1, fly: 14 },
  { n: 'drone', col: P1, path: [[7.8 * T, 9.4 * T], [9.4 * T, 2.6 * T], [7.8 * T, 9.4 * T]], sp: 24, t: 0.6, fly: 16 },
  { n: 'raider', col: P2, path: [[0.5 * T, 3.9 * T], [1.9 * T, 3.3 * T], [0.5 * T, 3.9 * T]], sp: 10, t: 0, siphon: true },
  { n: 'tank', col: P2, path: [[10.4 * T, 10.4 * T], [8.4 * T, 9.9 * T], [10.4 * T, 10.4 * T]], sp: 11, t: 0.3, firing: true },
  { n: 'tank', col: P2, path: [[10.6 * T, 9.1 * T], [9.2 * T, 9.6 * T], [10.6 * T, 9.1 * T]], sp: 11, t: 0.7, firing: true },
];
for (let i = 0; i < 6; i++) units.push({ n: 'infantry', col: P1, path: [[5.4 * T + (i % 3) * 5, 9.4 * T + Math.floor(i / 3) * 5], [7.9 * T + (i % 3) * 5, 9.4 * T + Math.floor(i / 3) * 5], [5.4 * T + (i % 3) * 5, 9.4 * T + Math.floor(i / 3) * 5]], sp: 7, t: 0.05 * i, firing: i < 3 });
for (let i = 0; i < 4; i++) units.push({ n: 'infantry', col: P2, path: [[10.7 * T - i * 4, 8.1 * T + i * 6], [9.8 * T - i * 4, 8.6 * T + i * 6], [10.7 * T - i * 4, 8.1 * T + i * 6]], sp: 6, t: 0.3 + i * 0.1, firing: true });

const fx = { parts: [], flashes: [], tracers: [] };
let lastT = performance.now();

function resize() { DPR = Math.min(2, devicePixelRatio || 1); W = canvas.clientWidth; H = canvas.clientHeight; canvas.width = W * DPR; canvas.height = H * DPR; light.width = canvas.width; light.height = canvas.height; }
addEventListener('resize', resize); resize();

function unitPos(u) {
  const segs = u.path.length - 1; let total = 0; const lens = [];
  for (let i = 0; i < segs; i++) { const l = Math.hypot(u.path[i + 1][0] - u.path[i][0], u.path[i + 1][1] - u.path[i][1]); lens.push(l); total += l; }
  let d = (u.t * total) % total;
  for (let i = 0; i < segs; i++) { if (d <= lens[i]) { const k = lens[i] ? d / lens[i] : 0; const a = u.path[i], b = u.path[i + 1]; return { x: a[0] + (b[0] - a[0]) * k, y: a[1] + (b[1] - a[1]) * k, ang: Math.atan2(b[1] - a[1], b[0] - a[0]) }; } d -= lens[i]; }
  return { x: u.path[0][0], y: u.path[0][1], ang: 0 };
}
function facingOf(ang) { let f = Math.round((ang / (Math.PI * 2)) * FACINGS); return ((f % FACINGS) + FACINGS) % FACINGS; }

function draw(now) {
  const dt = Math.min(0.1, (now - lastT) / 1000); lastT = now; state.time += dt;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = '#0A0C10'; ctx.fillRect(0, 0, W, H);
  // câmera: centraliza o mapa
  const center = proj(GRID * T / 2, GRID * T / 2, 0);
  const camX = W / 2 - center[0], camY = H / 2 - center[1] + 40;
  ctx.save(); ctx.translate(camX, camY);
  // terreno
  for (let y = 0; y < GRID; y++) for (let x = 0; x < GRID; x++) { const p = proj(x * T, y * T, 0); const t = map[y][x]; ctx.drawImage(tile(t.kind, t.v), p[0] - TW / 2, p[1]); }
  // decalques: rastros e crateras
  ctx.save(); ctx.globalAlpha = 0.35; ctx.strokeStyle = '#3A3F48'; ctx.lineWidth = 3;
  for (const u of units) if (u.n === 'tank' || u.n === 'harvester') { ctx.beginPath(); u.path.forEach((p, i) => { const q = proj(p[0], p[1], 0); if (i === 0) ctx.moveTo(q[0], q[1]); else ctx.lineTo(q[0], q[1]); }); ctx.stroke(); }
  ctx.restore();
  for (const [cx, cy, r] of [[7.3 * T, 9.3 * T, 16], [9.4 * T, 8.5 * T, 10], [2.2 * T, 4.0 * T, 12]]) { const p = proj(cx, cy, 0); const g = ctx.createRadialGradient(p[0], p[1], 2, p[0], p[1], r * 2); g.addColorStop(0, 'rgba(10,8,8,0.8)'); g.addColorStop(0.6, 'rgba(40,36,34,0.5)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(p[0], p[1], r * 2, r, 0, 0, 7); ctx.fill(); }
  if (state.grid) { ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1; for (let y = 0; y <= GRID; y++) { const a = proj(0, y * T, 0), b = proj(GRID * T, y * T, 0); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); } for (let x = 0; x <= GRID; x++) { const a = proj(x * T, 0, 0), b = proj(x * T, GRID * T, 0); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); } }
  // lista de desenho ordenada por profundidade
  const items = [];
  for (const o of objects) { const sp = sprite(o.n, o.col, o.rot ? 4 : (o.facing || 0), o.gate ? 'gate' : ''); items.push({ sp, x: o.x, y: o.y, z: 0, d: o.x + o.y + (o.n === 'nucleus' ? 30 : o.n === 'refinery' ? 22 : 12), shadow: !o.wall && o.n !== 'crystals' && o.n !== 'rocks', big: o.n !== 'wall' }); }
  const lights = [];
  for (const u of units) {
    u.t += dt * u.sp / 400;
    const p = unitPos(u); const f = facingOf(p.ang); const sp = sprite(u.n, u.col, f);
    const bob = u.n === 'mech' ? Math.abs(Math.sin(state.time * 6)) * 1.5 : 0;
    items.push({ sp, x: p.x, y: p.y, z: (u.fly || 0) + bob, d: p.x + p.y + 8, unit: u, shadow: true, pos: p, f });
    if (u.n === 'tank' && u.col === P1) { const q = proj(p.x, p.y, 4); lights.push({ x: q[0], y: q[1], r: 40, c: 'rgba(255,230,150,0.25)' }); }
    if (u.firing && Math.random() < 0.08) { const q = proj(p.x + Math.cos(p.ang) * 8, p.y + Math.sin(p.ang) * 8, 5); fx.flashes.push({ x: q[0], y: q[1], t: 0 }); const tx = q[0] + Math.cos(p.ang - Math.PI / 4) * (60 + Math.random() * 60), ty = q[1] + Math.sin(p.ang - Math.PI / 4) * 0.5 * (60 + Math.random() * 60); fx.tracers.push({ x1: q[0], y1: q[1], x2: tx, y2: ty, t: 0 }); if (Math.random() < 0.4) { for (let i = 0; i < 6; i++) fx.parts.push({ x: tx, y: ty, vx: (Math.random() - .5) * 60, vy: -20 - Math.random() * 40, t: 0, life: .5, c: '#FFB060', s: 2 }); fx.parts.push({ x: tx, y: ty, vx: 0, vy: -8, t: 0, life: 1.6, c: '#555', s: 6, smoke: true }); } }
    if (u.siphon) { const q = proj(p.x, p.y, 4); lights.push({ x: q[0], y: q[1], r: 36, c: 'rgba(214,76,255,0.35)' }); }
  }
  items.sort((a, b) => a.d - b.d);
  for (const it of items) {
    const sp = it.sp;
    const cxw = it.unit ? it.x : it.x + sp.cx, cyw = it.unit ? it.y : it.y + sp.cy;
    const g = proj(cxw, cyw, 0), q = proj(cxw, cyw, it.z);
    if (it.shadow) V.drawShadow(ctx, g[0], g[1], it.unit ? sp.w * 0.5 : sp.w * 0.8, it.unit ? sp.h * 0.3 : sp.h * 0.4);
    ctx.drawImage(sp.canvas, Math.round(q[0] - sp.ax), Math.round(q[1] - sp.ay));
    if (it.unit && it.unit.siphon) { // mangueira de sifão até a refinaria
      const ref = objects.find(o => o.n === 'refinery'); const rs = sprite('refinery', P1, 0); const rq = proj(ref.x + rs.cx, ref.y + rs.cy, 5);
      ctx.save(); ctx.strokeStyle = 'rgba(214,76,255,0.9)'; ctx.lineWidth = 2.5; ctx.setLineDash([8, 6]); ctx.lineDashOffset = -state.time * 80; ctx.beginPath(); ctx.moveTo(q[0], q[1] - 6); ctx.quadraticCurveTo((q[0] + rq[0]) / 2, Math.min(q[1], rq[1]) - 40, rq[0], rq[1]); ctx.stroke(); ctx.restore();
      if (Math.random() < 0.5) fx.parts.push({ x: rq[0], y: rq[1], vx: (q[0] - rq[0]) * 0.9, vy: (q[1] - 6 - rq[1]) * 0.9 - 30, t: 0, life: 1.1, c: '#E08CFF', s: 2.5, glow: true });
    }
    for (const l of sp.lights) lights.push({ x: q[0] - sp.ax + l.x, y: q[1] - sp.ay + l.y, r: it.unit ? 10 : 22, c: l.c });
  }
  // efeitos
  for (let i = fx.parts.length - 1; i >= 0; i--) { const p = fx.parts[i]; p.t += dt; if (p.t > p.life) { fx.parts.splice(i, 1); continue; } p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.96; if (p.smoke) { p.s += dt * 10; p.vy -= dt * 6; } const a = 1 - p.t / p.life; ctx.globalAlpha = p.smoke ? a * 0.45 : a; ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, 7); ctx.fill(); ctx.globalAlpha = 1; if (p.glow) lights.push({ x: p.x, y: p.y, r: 8, c: p.c }); }
  for (let i = fx.tracers.length - 1; i >= 0; i--) { const t = fx.tracers[i]; t.t += dt; if (t.t > 0.12) { fx.tracers.splice(i, 1); continue; } ctx.strokeStyle = `rgba(255,220,140,${1 - t.t / 0.12})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(t.x1, t.y1); ctx.lineTo(t.x2, t.y2); ctx.stroke(); }
  for (let i = fx.flashes.length - 1; i >= 0; i--) { const f = fx.flashes[i]; f.t += dt; if (f.t > 0.08) { fx.flashes.splice(i, 1); continue; } lights.push({ x: f.x, y: f.y, r: 26, c: 'rgba(255,200,120,0.9)' }); ctx.fillStyle = 'rgba(255,240,200,0.95)'; ctx.beginPath(); ctx.arc(f.x, f.y, 4, 0, 7); ctx.fill(); }
  // chaminé do reator: fumaça contínua
  if (Math.random() < 0.5) { for (const o of objects) if (o.n === 'reactor') { const rs = sprite('reactor', P1, 0); const q = proj(o.x + 14.5, o.y + 4.5, 19); fx.parts.push({ x: q[0], y: q[1], vx: 6 + Math.random() * 8, vy: -14, t: 0, life: 2.2 + Math.random(), c: '#6A6F78', s: 3, smoke: true }); } }
  // destroço em chamas
  { const o = objects.find(z => z.n === 'wreck'); const q = proj(o.x + 7, o.y + 5, 4); if (Math.random() < 0.6) fx.parts.push({ x: q[0] + (Math.random() - .5) * 8, y: q[1], vx: (Math.random() - .5) * 6, vy: -18 - Math.random() * 10, t: 0, life: 0.5 + Math.random() * 0.4, c: Math.random() < 0.5 ? '#FF7A30' : '#FFC050', s: 2 + Math.random() * 2, glow: true }); if (Math.random() < 0.3) fx.parts.push({ x: q[0], y: q[1] - 6, vx: 3, vy: -10, t: 0, life: 2.5, c: '#2A2A2E', s: 4, smoke: true }); }
  ctx.restore();
  // ---- iluminação (noite): escurece e recorta luzes com gradientes ----
  if (state.night) {
    lctx.setTransform(DPR, 0, 0, DPR, 0, 0); lctx.globalCompositeOperation = 'source-over';
    lctx.fillStyle = 'rgba(8,12,28,0.62)'; lctx.fillRect(0, 0, W, H);
    lctx.globalCompositeOperation = 'destination-out';
    for (const l of lights) { const g = lctx.createRadialGradient(camX + l.x, camY + l.y, 0, camX + l.x, camY + l.y, l.r * 2.2); g.addColorStop(0, 'rgba(0,0,0,0.9)'); g.addColorStop(1, 'rgba(0,0,0,0)'); lctx.fillStyle = g; lctx.beginPath(); lctx.arc(camX + l.x, camY + l.y, l.r * 2.2, 0, 7); lctx.fill(); }
    // holofotes da base
    for (const [tx, ty] of [[5.5 * T, 5.5 * T], [3.2 * T, 7.6 * T], [7.6 * T, 3.0 * T], [3.2 * T, 3.0 * T]]) { const q = proj(tx, ty, 0); const g = lctx.createRadialGradient(camX + q[0], camY + q[1], 0, camX + q[0], camY + q[1], 150); g.addColorStop(0, 'rgba(0,0,0,0.55)'); g.addColorStop(0.5, 'rgba(0,0,0,0.25)'); g.addColorStop(1, 'rgba(0,0,0,0)'); lctx.fillStyle = g; lctx.beginPath(); lctx.arc(camX + q[0], camY + q[1], 150, 0, 7); lctx.fill(); }
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(light, 0, 0); ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    // brilho aditivo das luzes
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const l of lights) { const g = ctx.createRadialGradient(camX + l.x, camY + l.y, 0, camX + l.x, camY + l.y, l.r); const c = l.c.startsWith('rgba') ? l.c : hexA(l.c, 0.55); g.addColorStop(0, c); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(camX + l.x, camY + l.y, l.r, 0, 7); ctx.fill(); }
    ctx.restore();
  }
  const st = document.getElementById('stats'); if (st) st.textContent = `${state.spriteCount} sprites gerados em ${state.buildMs.toFixed(0)} ms · ${items.length} objetos · ${fx.parts.length} partículas`;
  requestAnimationFrame(draw);
}
function hexA(h, a) { const n = parseInt(h.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; }
ARD.scene = { state, cache, fx, units, objects, proj, sprite, S, T, draw };
})(globalThis.ARD = globalThis.ARD || {});
