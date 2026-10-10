/* Entrada: mouse, teclado e toque → comandos para a simulação e estado de visão (câmera, seleção, modos). */
(function (ARD) {
'use strict';
const S = ARD.sim;

function create(o) {
  const { canvas, sim, view, R, human, ui } = o;
  const I = { keys: new Set(), pointers: new Map(), down: null, lastTap: 0, lastClickId: null, lastClickT: 0, groups: {}, longPress: null, pinch: null, mode: 'normal', touchBox: false };
  const cam = view.cam;

  function clampCam() { cam.zoom = Math.max(R.zoomMin || 0.3, Math.min(R.zoomMax || 1.8, cam.zoom)); const m = 200; cam.x = Math.max(-m, Math.min(S.WORLD + m, cam.x)); cam.y = Math.max(-m, Math.min(S.WORLD + m, cam.y)); }
  I.center = function (x, y) { cam.x = x; cam.y = y; clampCam(); };
  I.setMode = function (mode, data) {
    I.mode = mode; view.mode = mode; view.ghost = null;
    if (mode === 'build') { view.ghost = { def: data, x: cam.x, y: cam.y, ok: false }; updateGhost(I.lastSX || R.w / 2, I.lastSY || R.h / 2); }
    canvas.style.cursor = mode === 'normal' ? 'default' : 'crosshair';
    ui.modeChanged(mode, data);
  };
  function updateGhost(sx, sy) { if (!view.ghost) return; const [wx, wy] = R.screenToWorld(cam, sx, sy); view.ghost.x = wx; view.ghost.y = wy; view.ghost.ok = S.canBuild(sim, human, view.ghost.def, wx, wy).ok && S.canAfford(sim.players[human], S.BUILDINGS[view.ghost.def].cost); }

  function pick(sx, sy, radiusPx) {
    const vis = sim.vis[human]; let best = null, bd = Infinity; const k = R.K * cam.zoom;
    for (const e of sim.ents) {
      if (!e.alive || e.kind === 'proj') continue;
      if (e.kind !== 'node' && e.owner !== human && !vis.has(e.id)) continue;
      const z = e.kind === 'unit' && S.UNITS[e.def].flying ? 14 : 0;
      const [ex, ey] = R.worldToScreen(cam, e.x, e.y, z);
      const dx = sx - ex, dy = sy - ey; const rx = e.r * k * 1.2 + radiusPx;
      if (Math.abs(dx) > rx) continue;
      if (dy > e.r * k * 0.7 + radiusPx || dy < -(e.r * k * 2.4 + radiusPx)) continue;
      const d = Math.hypot(dx, Math.max(0, dy)); const pri = e.kind === 'unit' ? 0 : e.kind === 'crate' ? 1 : e.kind === 'building' ? 2 : 3;
      const sc = d + pri * 5; if (sc < bd) { bd = sc; best = e; }
    }
    return best;
  }
  function ownSelectedUnits() { const out = []; for (const id of view.sel) { const e = sim.byId.get(id); if (e && e.alive && e.kind === 'unit' && e.owner === human) out.push(e); } return out; }
  function ownSelectedBuilding() { for (const id of view.sel) { const e = sim.byId.get(id); if (e && e.alive && e.kind === 'building' && e.owner === human) return e; } return null; }
  function setSel(ids) { view.sel = new Set(ids); ui.selectionChanged(); }
  I.select = setSel;
  I.selectOnScreen = function () { const ids = []; for (const e of sim.ents) { if (!e.alive || e.owner !== human || e.kind !== 'unit' || !S.UNITS[e.def].attack) continue; const [sx, sy] = R.worldToScreen(cam, e.x, e.y); if (sx >= 0 && sy >= 0 && sx <= R.w && sy <= R.h) ids.push(e.id); } setSel(ids); return ids.length; };
  function cmd(c) { c.p = human; S.enqueue(sim, c); }
  I.cmd = cmd;

  function wallSegments(x0, y0, x1, y1, def) {
    const len = Math.hypot(x1 - x0, y1 - y0); const n = Math.max(1, Math.round(len / 16)); const ang = Math.atan2(y1 - y0, x1 - x0);
    const out = []; const p = sim.players[human]; const d = S.BUILDINGS[def]; let spent = 0;
    for (let i = 0; i <= n; i++) {
      const x = x0 + Math.cos(ang) * 16 * i, y = y0 + Math.sin(ang) * 16 * i;
      let ok = S.canBuild(sim, human, def, x, y).ok;
      if (ok) { for (const q of out) if (q.ok && Math.hypot(q.x - x, q.y - y) < 13) { ok = false; break; } }
      if (ok) { spent += d.cost.minerio || 0; if (spent > p.res.minerio) ok = false; }
      out.push({ x, y, ang, ok });
    }
    return out;
  }
  function contextCommand(wx, wy, sx, sy) {
    const units = ownSelectedUnits(); const t = pick(sx, sy, I.lastType === 'touch' ? 22 : 10);
    if (!units.length) { const b = ownSelectedBuilding(); if (b && S.BUILDINGS[b.def].produces) { cmd({ t: 'rally', id: b.id, x: wx, y: wy }); view.marker = { x: wx, y: wy, t: R.time, col: '#F2C230' }; ui.notice('Ponto de reunião definido'); } return; }
    const ids = units.map(u => u.id);
    if (t && (t.kind === 'node' || t.kind === 'wreck')) { cmd({ t: 'harvest', ids, target: t.id }); view.marker = { x: t.x, y: t.y, t: R.time, col: '#7FE3A1' }; return; }
    if (t && t.kind === 'crate') { cmd({ t: 'pickup', ids, target: t.id }); view.marker = { x: t.x, y: t.y, t: R.time, col: '#F2C230' }; return; }
    if (t && t.owner >= 0 && t.owner !== human) {
      const doIt = () => {
        const pirates = units.filter(u => u.def === 'pirata'); const others = units.filter(u => u.def !== 'pirata');
        if (pirates.length && t.kind === 'building' && (t.def === 'refinaria' || t.def === 'reator')) cmd({ t: 'siphon', ids: pirates.map(u => u.id), target: t.id });
        else if (pirates.length) cmd({ t: 'move', ids: pirates.map(u => u.id), x: t.x, y: t.y });
        if (others.length) cmd({ t: 'attack', ids: others.map(u => u.id), target: t.id });
        view.marker = { x: t.x, y: t.y, t: R.time, col: '#FF5E3A' };
      };
      if (S.hasPact(sim, human, t.owner)) ui.confirm('Atacar ' + sim.players[t.owner].name + ' quebra o pacto de Não-agressão: você perde a Caução, ganha +20% de dano por 45 s e sua Reputação cai. Quebrar?', () => { cmd({ t: 'break', with: t.owner }); doIt(); });
      else doIt();
      return;
    }
    cmd({ t: 'move', ids, x: wx, y: wy }); view.marker = { x: wx, y: wy, t: R.time, col: '#E8E2D6' };
  }
  function primaryAction(wx, wy, sx, sy, shift) {
    const mode = I.mode;
    if (mode === 'build' && view.ghost) {
      const g = view.ghost; const ok = S.canBuild(sim, human, g.def, g.x, g.y);
      if (S.BUILDINGS[g.def].wall) { if (ok.ok && S.canAfford(sim.players[human], S.BUILDINGS[g.def].cost)) { cmd({ t: 'build', def: g.def, x: g.x, y: g.y, ang: 0 }); if (!shift) I.setMode('normal'); } else ui.notice(ok.ok ? 'Recursos insuficientes' : ok.why); return; }
      if (!ok.ok) { ui.notice(ok.why); return; }
      if (!S.canAfford(sim.players[human], S.BUILDINGS[g.def].cost)) { ui.notice('Recursos insuficientes'); return; }
      cmd({ t: 'build', def: g.def, x: g.x, y: g.y }); view.marker = { x: g.x, y: g.y, t: R.time, col: '#7FE3A1' };
      if (!shift) I.setMode('normal'); else updateGhost(sx, sy);
      return;
    }
    if (mode === 'attackmove') {
      const units = ownSelectedUnits(); const t = pick(sx, sy, 10);
      if (units.length) {
        if (t && t.owner >= 0 && t.owner !== human) contextCommand(wx, wy, sx, sy);
        else { cmd({ t: 'attackmove', ids: units.map(u => u.id), x: wx, y: wy }); view.marker = { x: wx, y: wy, t: R.time, col: '#FF5E3A' }; }
      }
      if (!shift && I.lastType !== 'touch') I.setMode('normal'); return;
    }
    if (mode === 'super') { cmd({ t: 'super', x: wx, y: wy }); I.setMode('normal'); return; }
    if (mode === 'jump') { ui.confirm('Saltar o Núcleo para este ponto? Custa ' + Math.round(S.FACTIONS[sim.players[human].faction].jumpCostFrac * 100) + '% de cada recurso e 60 s de canalização visível a todos.', () => cmd({ t: 'jump', x: wx, y: wy })); I.setMode('normal'); return; }
    if (mode === 'rally') { const b = ownSelectedBuilding(); if (b) cmd({ t: 'rally', id: b.id, x: wx, y: wy }); I.setMode('normal'); return; }
    // normal: select
    const t = pick(sx, sy, I.lastType === 'touch' ? 26 : 8);
    const now = performance.now();
    if (I.lastType === 'touch') { // toque: com unidades selecionadas, tocar no chão move e tocar em alvo comanda
      const units = ownSelectedUnits();
      if (units.length && t && (t.owner !== human && t.owner >= 0 || t.kind === 'node' || t.kind === 'crate' || t.kind === 'wreck')) { contextCommand(wx, wy, sx, sy); return; }
      if (units.length && !t) { cmd({ t: 'move', ids: units.map(u => u.id), x: wx, y: wy }); view.marker = { x: wx, y: wy, t: R.time, col: '#E8E2D6' }; return; }
      if (!units.length && !t) { const b = ownSelectedBuilding(); if (b && S.BUILDINGS[b.def].produces) { cmd({ t: 'rally', id: b.id, x: wx, y: wy }); view.marker = { x: wx, y: wy, t: R.time, col: '#F2C230' }; ui.notice('Ponto de reunião definido'); return; } }
    }
    if (t && t.kind !== 'node' && t.kind !== 'crate') {
      if (t.owner === human && t.kind === 'unit' && I.lastClickId === t.id && now - I.lastClickT < 350) {
        // double click: all same type on screen
        const ids = []; for (const e of sim.ents) if (e.alive && e.owner === human && e.kind === 'unit' && e.def === t.def) { const [sx2, sy2] = R.worldToScreen(cam, e.x, e.y); if (sx2 >= 0 && sy2 >= 0 && sx2 <= R.w && sy2 <= R.h) ids.push(e.id); }
        setSel(ids);
      } else if (shift && t.owner === human) { const s = new Set(view.sel); if (s.has(t.id)) s.delete(t.id); else s.add(t.id); setSel([...s]); }
      else setSel([t.id]);
      I.lastClickId = t.id; I.lastClickT = now;
    } else if (t && (t.kind === 'node' || t.kind === 'wreck')) { setSel([t.id]); }
    else if (!shift) setSel([]);
  }
  function boxSelect(b, shift) {
    const x0 = Math.min(b.x0, b.x1), x1 = Math.max(b.x0, b.x1), y0 = Math.min(b.y0, b.y1), y1 = Math.max(b.y0, b.y1);
    const ids = shift ? [...view.sel] : [];
    let anyUnit = false;
    for (const e of sim.ents) {
      if (!e.alive || e.owner !== human || e.kind !== 'unit') continue;
      const [sx, sy] = R.worldToScreen(cam, e.x, e.y); if (sx >= x0 && sx <= x1 && sy >= y0 && sy <= y1) { ids.push(e.id); anyUnit = true; }
    }
    if (!anyUnit && !shift) { // allow box-selecting a single building
      for (const e of sim.ents) { if (!e.alive || e.owner !== human || e.kind !== 'building') continue; const [sx, sy] = R.worldToScreen(cam, e.x, e.y); if (sx >= x0 && sx <= x1 && sy >= y0 && sy <= y1) { ids.push(e.id); break; } }
    }
    // prefer combat units over collectors when both present
    const ents = ids.map(id => sim.byId.get(id)).filter(Boolean);
    const combat = ents.filter(e => e.kind === 'unit' && e.def !== 'coletor');
    setSel((combat.length && ents.some(e => e.def === 'coletor') ? combat : ents).map(e => e.id));
  }

  // ---- pointer events
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('pointerdown', e => {
    canvas.setPointerCapture(e.pointerId);
    I.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });
    const r = canvas.getBoundingClientRect(); const sx = e.clientX - r.left, sy = e.clientY - r.top;
    if (I.pointers.size === 2) { const pts = [...I.pointers.values()]; I.pinch = { d: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y), zoom: cam.zoom, cx: (pts[0].x + pts[1].x) / 2, cy: (pts[0].y + pts[1].y) / 2, camx: cam.x, camy: cam.y }; I.down = null; view.box = null; clearTimeout(I.longPress); return; }
    I.lastType = e.pointerType;
    I.down = { sx, sy, button: e.button, type: e.pointerType, moved: false, camx: cam.x, camy: cam.y, shift: e.shiftKey, t: performance.now() };
    if (e.button === 0 && I.mode === 'build' && view.ghost && S.BUILDINGS[view.ghost.def].wall) { const [wx0, wy0] = R.screenToWorld(cam, sx, sy); I.wallDrag = { x: wx0, y: wy0 }; }
    if (e.pointerType === 'touch') { clearTimeout(I.longPress); I.longPress = setTimeout(() => { if (I.down && !I.down.moved) { const [wx, wy] = R.screenToWorld(cam, sx, sy); if (I.mode === 'normal') contextCommand(wx, wy, sx, sy); I.down = null; if (navigator.vibrate) navigator.vibrate(15); } }, 450); }
  });
  canvas.addEventListener('pointermove', e => {
    const r = canvas.getBoundingClientRect(); const sx = e.clientX - r.left, sy = e.clientY - r.top; I.lastSX = sx; I.lastSY = sy;
    const p = I.pointers.get(e.pointerId); if (p) { p.x = e.clientX; p.y = e.clientY; }
    if (I.pinch && I.pointers.size === 2) { const pts = [...I.pointers.values()]; const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y); const cx = (pts[0].x + pts[1].x) / 2, cy = (pts[0].y + pts[1].y) / 2; cam.zoom = I.pinch.zoom * (d / I.pinch.d); clampCam(); const [pwx, pwy] = R.screenDeltaToWorld(cam, cx - I.pinch.cx, cy - I.pinch.cy); cam.x = I.pinch.camx - pwx; cam.y = I.pinch.camy - pwy; clampCam(); return; }
    if (view.ghost) updateGhost(sx, sy);
    const d = I.down; if (!d) { const t = pick(sx, sy, 8); view.hover = t ? t.id : null; return; }
    if (!d.moved && Math.hypot(sx - d.sx, sy - d.sy) > 7) { d.moved = true; clearTimeout(I.longPress); }
    if (!d.moved) return;
    if (I.wallDrag) { const [wx1, wy1] = R.screenToWorld(cam, sx, sy); view.wallGhost = wallSegments(I.wallDrag.x, I.wallDrag.y, wx1, wy1, view.ghost.def); return; }
    const panning = d.button === 1 || (d.type === 'touch' && !I.touchBox) || (d.button === 0 && I.keys.has('Space'));
    if (panning) { const [dwx, dwy] = R.screenDeltaToWorld(cam, sx - d.sx, sy - d.sy); cam.x = d.camx - dwx; cam.y = d.camy - dwy; clampCam(); view.box = null; }
    else if (d.button === 0 && I.mode === 'normal') view.box = { x0: d.sx, y0: d.sy, x1: sx, y1: sy };
  });
  function endPointer(e) {
    I.pointers.delete(e.pointerId);
    if (I.pointers.size < 2) I.pinch = null;
    clearTimeout(I.longPress);
    const d = I.down; if (!d) return; I.down = null;
    const r = canvas.getBoundingClientRect(); const sx = e.clientX - r.left, sy = e.clientY - r.top;
    const [wx, wy] = R.screenToWorld(cam, sx, sy);
    if (I.wallDrag) { const segs = view.wallGhost; I.wallDrag = null; view.wallGhost = null; if (d.moved && segs && segs.length && view.ghost) { let n = 0; for (const g of segs) if (g.ok) { cmd({ t: 'build', def: view.ghost.def, x: g.x, y: g.y, ang: g.ang }); n++; } if (n) view.marker = { x: segs[0].x, y: segs[0].y, t: R.time, col: '#7FE3A1' }; if (!d.shift) I.setMode('normal'); return; } }
    if (view.box) { const b = view.box; view.box = null; boxSelect(b, d.shift); return; }
    if (d.moved) return;
    if (d.button === 2) { if (I.mode !== 'normal') I.setMode('normal'); else contextCommand(wx, wy, sx, sy); return; }
    if (d.button === 0) {
      if (d.type === 'touch' && I.touchBox) { I.touchBox = false; ui.touchBoxChanged(false); }
      primaryAction(wx, wy, sx, sy, d.shift);
    }
  }
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', e => { I.pointers.delete(e.pointerId); I.pinch = null; I.down = null; view.box = null; I.wallDrag = null; view.wallGhost = null; clearTimeout(I.longPress); });
  canvas.addEventListener('wheel', e => { e.preventDefault(); const r = canvas.getBoundingClientRect(); const sx = e.clientX - r.left, sy = e.clientY - r.top; const [wx, wy] = R.screenToWorld(cam, sx, sy); const f = Math.exp(-e.deltaY * 0.0012); cam.zoom *= f; clampCam(); const [wx2, wy2] = R.screenToWorld(cam, sx, sy); cam.x += wx - wx2; cam.y += wy - wy2; clampCam(); if (view.ghost) updateGhost(sx, sy); }, { passive: false });

  // ---- keyboard
  const PROD_KEYS = {}; for (const k in S.UNITS) PROD_KEYS[S.UNITS[k].key] = k;
  const BUILD_KEYS = {}; for (const k in S.BUILDINGS) if (S.BUILDINGS[k].key) BUILD_KEYS[S.BUILDINGS[k].key] = k;
  I.buildMenu = false;
  window.addEventListener('keydown', e => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT')) return;
    if (ui.modalOpen()) { if (e.code === 'Escape') ui.closeModals(); return; }
    I.keys.add(e.code);
    const k = e.key.toUpperCase();
    if (e.code === 'Escape') { if (I.mode !== 'normal') I.setMode('normal'); else if (I.buildMenu) { I.buildMenu = false; ui.buildMenuChanged(false); } else setSel([]); return; }
    if (e.code === 'Space') { e.preventDefault(); if (view.lastAlert) I.center(view.lastAlert.x, view.lastAlert.y); return; }
    if (e.code === 'F1') { e.preventDefault(); const n = S.nucleoOf(sim, human); if (n) { setSel([n.id]); I.center(n.x, n.y); } return; }
    if (e.code === 'F2') { e.preventDefault(); const ids = []; for (const en of sim.ents) if (en.alive && en.owner === human && en.kind === 'unit' && S.UNITS[en.def].attack) ids.push(en.id); setSel(ids); return; }
    if (/^Digit[0-9]$/.test(e.code)) { const n = e.code.slice(5); if (e.ctrlKey || e.metaKey) { e.preventDefault(); I.groups[n] = [...view.sel]; ui.notice('Grupo ' + n + ' definido'); } else { const g = (I.groups[n] || []).filter(id => { const en = sim.byId.get(id); return en && en.alive; }); if (g.length) { setSel(g); const now = performance.now(); if (I.lastGroupKey === n && now - I.lastGroupT < 400) { const en = sim.byId.get(g[0]); if (en) I.center(en.x, en.y); } I.lastGroupKey = n; I.lastGroupT = now; } } return; }
    if (k === 'B' && !e.ctrlKey) { I.buildMenu = !I.buildMenu; ui.buildMenuChanged(I.buildMenu); return; }
    if (I.buildMenu && BUILD_KEYS[k]) { I.buildMenu = false; ui.buildMenuChanged(false); I.setMode('build', BUILD_KEYS[k]); return; }
    const b = ownSelectedBuilding(); const units = ownSelectedUnits();
    if (b && !units.length && S.BUILDINGS[b.def].produces && PROD_KEYS[k] && S.BUILDINGS[b.def].produces.includes(PROD_KEYS[k])) { cmd({ t: 'produce', id: b.id, def: PROD_KEYS[k] }); return; }
    if (k === 'A' && units.length) { I.setMode(I.mode === 'attackmove' ? 'normal' : 'attackmove'); return; }
    if (k === 'S' && units.length) { cmd({ t: 'stop', ids: units.map(u => u.id) }); return; }
    if (k === 'F' && view.sel.size) { const en = sim.byId.get([...view.sel][0]); if (en) I.center(en.x, en.y); return; }
    if (k === 'H' || e.key === '?') { ui.toggleHelp(); return; }
    if (k === 'P') { if (!(b && S.BUILDINGS[b.def].produces && S.BUILDINGS[b.def].produces.includes('pirata'))) ui.togglePause(); return; }
    if (e.key === '+' || e.key === '=') { cam.zoom *= 1.15; clampCam(); } if (e.key === '-') { cam.zoom /= 1.15; clampCam(); }
  });
  window.addEventListener('keyup', e => I.keys.delete(e.code));
  window.addEventListener('blur', () => I.keys.clear());

  I.update = function (dt) {
    const sp = 900 * dt / cam.zoom; let dx = 0, dy = 0;
    if (I.keys.has('KeyW') || I.keys.has('ArrowUp')) dy -= 1; if (I.keys.has('KeyS') && !ownSelectedUnits().length || I.keys.has('ArrowDown')) dy += 1;
    if (I.keys.has('KeyA') && !ownSelectedUnits().length || I.keys.has('ArrowLeft')) dx -= 1; if (I.keys.has('KeyD') || I.keys.has('ArrowRight')) dx += 1;
    // edge pan (mouse only, when pointer inside canvas)
    if (I.lastSX != null && !I.down && I.pointers.size === 0 && I.edgePanEnabled) { const m = 18; if (I.lastSX < m) dx -= 0.7; if (I.lastSX > R.w - m) dx += 0.7; if (I.lastSY < m) dy -= 0.7; if (I.lastSY > R.h - m) dy += 0.7; }
    if (dx || dy) { const [dwx, dwy] = R.screenDeltaToWorld(cam, dx * sp * cam.zoom, dy * sp * cam.zoom); cam.x += dwx; cam.y += dwy; clampCam(); if (view.ghost) updateGhost(I.lastSX || R.w / 2, I.lastSY || R.h / 2); }
  };
  canvas.addEventListener('pointerenter', e => { I.edgePanEnabled = e.pointerType === 'mouse'; });
  canvas.addEventListener('pointerleave', () => { I.edgePanEnabled = false; I.lastSX = null; I.lastSY = null; });
  return I;
}
ARD.input = { create };
})(globalThis.ARD = globalThis.ARD || {});
