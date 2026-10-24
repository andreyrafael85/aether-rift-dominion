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
  I.confirmPlace = function () { // 4.1a: ✓ da barra de posicionamento no toque
    const g = view.ghost; if (I.mode !== 'build' || !g) return; const ok = S.canBuild(sim, human, g.def, g.x, g.y);
    if (!ok.ok) { ui.notice(ok.why); return; } if (!S.canAfford(sim.players[human], S.BUILDINGS[g.def].cost)) { ui.notice('Recursos insuficientes'); return; }
    cmd({ t: 'build', def: g.def, x: g.x, y: g.y }); view.marker = { x: g.x, y: g.y, t: R.time, col: '#7FE3A1' }; I.setMode('normal'); };
  I.setMode = function (mode, data) {
    I.mode = mode; view.mode = mode; view.ghost = null;
    if (mode === 'build') { view.ghost = { def: data, x: cam.x, y: cam.y, ok: false }; if (I.lastType === 'touch') updateGhost(R.w / 2, R.h * 0.42); else updateGhost(I.lastSX || R.w / 2, I.lastSY || R.h / 2); }
    canvas.style.cursor = mode === 'normal' ? 'default' : 'crosshair';
    ui.modeChanged(mode, data);
  };
  function updateGhost(sx, sy) { if (!view.ghost) return; const [wx, wy] = R.screenToWorld(cam, sx, sy); view.ghost.x = wx; view.ghost.y = wy; view.ghost.ok = S.canBuild(sim, human, view.ghost.def, wx, wy).ok && S.canAfford(sim.players[human], S.BUILDINGS[view.ghost.def].cost); }

  function pick(sx, sy, radiusPx, skipOwn) { // skipOwn (4.2g): para ordens; unidade ou estrutura sua nunca é alvo, vale o nó, a caixa, a carcaça ou o inimigo embaixo
    const vis = sim.vis[human]; let best = null, bd = Infinity; const k = R.K * cam.zoom;
    for (const e of sim.ents) {
      if (!e.alive || e.kind === 'proj' || e.kind === 'rock') continue;
      if (skipOwn && e.owner === human && (e.kind === 'unit' || e.kind === 'building')) continue;
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
  function cmd(c) { c.p = human; if (ui.enqueue) ui.enqueue(c); else S.enqueue(sim, c); }
  I.cmd = cmd;
  I.pick = pick; I.ownSelectedUnits = ownSelectedUnits; I.ownSelectedBuilding = ownSelectedBuilding; I.contextCommand = contextCommand; /* 5.0b: a roda de comandos usa os mesmos critérios do clique */

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
    const units = ownSelectedUnits(); let t = pick(sx, sy, I.lastType === 'touch' ? 22 : 10, units.length > 0);
    if (!units.length) { const b = ownSelectedBuilding(); if (b && S.BUILDINGS[b.def].produces) { cmd({ t: 'rally', id: b.id, x: wx, y: wy }); view.marker = { x: wx, y: wy, t: R.time, col: '#F2C230' }; ui.notice('Ponto de reunião definido'); } return; }
    const ids = units.map(u => u.id);
    if (t && (t.kind === 'node' || t.kind === 'wreck') && t.amount <= 0) { if (units.some(u => u.def === 'coletor')) ui.notice('Nó esgotado: mande os coletores a outro campo'); t = null; } // 4.2h: nó seco vira ordem de mover
    if (t && (t.kind === 'node' || t.kind === 'wreck')) {
      const eaters = t.kind === 'wreck' && S.FACTIONS[sim.players[human].faction].devour ? units.filter(u => u.def === 'pirata') : []; // Carniceiro (Vorag) devora a carcaça
      if (eaters.length) { cmd({ t: 'devour', ids: eaters.map(u => u.id), target: t.id }); const rest = units.filter(u => u.def !== 'pirata').map(u => u.id); if (rest.length) cmd({ t: 'harvest', ids: rest, target: t.id }); }
      else cmd({ t: 'harvest', ids, target: t.id });
      view.marker = { x: t.x, y: t.y, t: R.time, col: '#7FE3A1' }; return;
    }
    if (t && t.kind === 'crate') { cmd({ t: 'pickup', ids, target: t.id }); view.marker = { x: t.x, y: t.y, t: R.time, col: '#F2C230' }; return; }
    if (t && t.owner >= 0 && t.owner !== human) {
      const doIt = () => {
        const pirates = units.filter(u => u.def === 'pirata'); const others = units.filter(u => u.def !== 'pirata');
        if (pirates.length && t.kind === 'building' && (t.def === 'refinaria' || t.def === 'reator')) cmd({ t: 'siphon', ids: pirates.map(u => u.id), target: t.id });
        else if (pirates.length && t.kind === 'building' && t.def === 'nodulo' && S.FACTIONS[sim.players[human].faction].devour) cmd({ t: 'devour', ids: pirates.map(u => u.id), target: t.id });
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
    // normal: select (4.1a: no toque, com unidades selecionadas, a área das suas unidades encolhe para o toque no chão virar movimento)
    const selUnits = I.lastType === 'touch' ? ownSelectedUnits() : []; const t = pick(sx, sy, I.lastType === 'touch' ? (selUnits.length ? 10 : 26) : 8);
    const now = performance.now();
    if (I.lastType === 'touch') { // toque: com unidades selecionadas, tocar no chão move e tocar em alvo comanda
      const units = ownSelectedUnits();
      if (units.length) { const tc = pick(sx, sy, 10, true); if (tc && (tc.owner !== human && tc.owner >= 0 || tc.kind === 'node' || tc.kind === 'crate' || tc.kind === 'wreck')) { contextCommand(wx, wy, sx, sy); return; } } // 4.2g: tocar num nó com coletores em cima colhe (antes selecionava um coletor e soltava o grupo)
      if (units.length && t && (t.owner !== human && t.owner >= 0 || t.kind === 'node' || t.kind === 'crate' || t.kind === 'wreck')) { contextCommand(wx, wy, sx, sy); return; }
      if (units.length && (!t || (t.owner === human && (t.kind === 'building' || view.sel.has(t.id))))) { cmd({ t: 'move', ids: units.map(u => u.id), x: wx, y: wy }); view.marker = { x: wx, y: wy, t: R.time, col: '#E8E2D6' }; return; } // tocar numa construção sua ou no próprio grupo também move
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
    const combat = ents.filter(e => e.kind === 'unit' && e.def !== 'coletor'); const nCol = ents.filter(e => e.def === 'coletor').length;
    const dropCol = combat.length && nCol && combat.length >= nCol; // 4.2g: coletores só ficam de fora quando o exército é maioria (antes, 2 soldados no meio tiravam 10 coletores da seleção)
    setSel((dropCol ? combat : ents).map(e => e.id)); if (dropCol) ui.notice(nCol + (nCol > 1 ? ' coletores ficaram' : ' coletor ficou') + ' de fora: o exército tem prioridade. Duplo clique num coletor seleciona todos na tela.');
  }

  /* 5.0a.1 — dois dedos como num app de mapas: o mapa gira COM os dedos (dedos no sentido horário, cena no sentido horário; antes
     era o contrário, cam.yaw - da), e o ponto do mapa que estava entre os dedos fica entre eles ao girar, aproximar e arrastar.
     O chão em volta do alvo da câmera é o mesmo em qualquer giro (só roda em torno do alvo) e escala com 1/zoom: guardamos o ponto do mapa
     sob o meio dos dedos e a sua posição nos eixos da câmera (direita, frente) no começo do gesto, e a cada movimento recolocamos o alvo
     para ele cair sob o meio atual. O giro do computador (Q/E, botão Girar) não muda. */
  const yawOf = () => (cam.yaw == null ? Math.PI / 4 : cam.yaw);
  const toCam = (dx, dy, yaw) => { const c = Math.cos(yaw), s = Math.sin(yaw); return [dx * c + dy * s, -dx * s + dy * c]; };
  function pinchStart(pts, r) {
    const mx = (pts[0].x + pts[1].x) / 2 - r.left, my = (pts[0].y + pts[1].y) / 2 - r.top, yaw = yawOf(); const [wx, wy] = R.screenToWorld(cam, mx, my);
    const [ax, ay] = R.screenToWorld(cam, mx + 24, my), [bx, by] = R.screenToWorld(cam, mx, my + 24); /* derivadas da tela para o chão (nos eixos da câmera), para o meio dos dedos que anda */
    return { a: Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x), yaw, rot: false, ra: 0, d: Math.max(1, Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)), zoom: cam.zoom, mx, my, wx, wy,
      L: toCam(wx - cam.x, wy - cam.y, yaw), jx: toCam((ax - wx) / 24, (ay - wy) / 24, yaw), jy: toCam((bx - wx) / 24, (by - wy) / 24, yaw) };
  }
  function pinchMove(pts, r) {
    const P = I.pinch; const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y); const mx = (pts[0].x + pts[1].x) / 2 - r.left, my = (pts[0].y + pts[1].y) / 2 - r.top;
    cam.zoom = P.zoom * (d / P.d); clampCam(); let yaw = P.yaw;
    if (R.supportsYaw) { let da = Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x) - P.a; da = Math.atan2(Math.sin(da), Math.cos(da)); if (!P.rot && Math.abs(da) > 0.14) { P.rot = true; P.ra = da; } /* 8° de folga para a pinça não girar sem querer; depois gira sem pulo e a folga some aos poucos (o mapa alcança os dedos em ~0,2 s) */
      if (P.rot) { let g = da - P.ra; P.ra *= 0.8; g = Math.atan2(Math.sin(g), Math.cos(g)); yaw = P.yaw + g; cam.yaw = yaw; } } /* 4.0f: dois dedos giram · 5.0a.1: no mesmo sentido dos dedos */
    const k = P.zoom / cam.zoom, ex = mx - P.mx, ey = my - P.my; const u = (P.L[0] + P.jx[0] * ex + P.jy[0] * ey) * k, v = (P.L[1] + P.jx[1] * ex + P.jy[1] * ey) * k; const c = Math.cos(yaw), s = Math.sin(yaw);
    cam.x = P.wx - (u * c - v * s); cam.y = P.wy - (u * s + v * c); clampCam();
  }
  // ---- pointer events
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('mousedown', e => { if (e.button === 1) e.preventDefault(); }); /* 5.0b: sem a rolagem automática do navegador no botão do meio */
  canvas.addEventListener('pointerdown', e => {
    canvas.setPointerCapture(e.pointerId);
    I.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });
    const r = canvas.getBoundingClientRect(); const sx = e.clientX - r.left, sy = e.clientY - r.top;
    if (I.pointers.size === 2) { const pts = [...I.pointers.values()]; I.pinch = pinchStart(pts, r); I.down = null; view.box = null; clearTimeout(I.longPress); return; }
    I.lastType = e.pointerType;
    I.down = { sx, sy, button: e.button, type: e.pointerType, moved: false, camx: cam.x, camy: cam.y, shift: e.shiftKey, t: performance.now() };
    if (e.button === 0 && I.mode === 'build' && view.ghost && S.BUILDINGS[view.ghost.def].wall) { const [wx0, wy0] = R.screenToWorld(cam, sx, sy); I.wallDrag = { x: wx0, y: wy0 }; }
    if (e.pointerType === 'touch') { clearTimeout(I.longPress); const dn = I.down; I.longPress = setTimeout(() => requestAnimationFrame(() => { if (I.down === dn && !dn.moved) { const [wx, wy] = R.screenToWorld(cam, sx, sy); if (I.mode === 'normal' && !(ui.wheel && ui.wheel({ sx, sy, wx, wy, touch: true, hold: true, id: e.pointerId, t0: e.timeStamp, tmin: 450 }))) contextCommand(wx, wy, sx, sy); I.down = null; if (navigator.vibrate) navigator.vibrate(15); } }), 450); } /* 5.0b: o toque longo abre a roda de comandos (sem ela, o comando de contexto de antes); decide no quadro seguinte, depois dos movimentos que um quadro lento atrasou */
    if (e.button === 1 && e.pointerType === 'mouse') { clearTimeout(I.wheelT); const dn = I.down; I.wheelT = setTimeout(() => requestAnimationFrame(() => { if (I.down === dn && !dn.moved && ui.wheel) { const [wx, wy] = R.screenToWorld(cam, sx, sy); if (ui.wheel({ sx, sy, wx, wy, touch: false, hold: true, id: e.pointerId, t0: e.timeStamp, tmin: 240 })) I.down = null; } }), 240); } /* 5.0b: segurar o botão do meio abre a roda (decide no quadro seguinte, como o toque longo); arrastar com ele continua movendo o mapa */
  });
  canvas.addEventListener('pointermove', e => {
    const r = canvas.getBoundingClientRect(); const sx = e.clientX - r.left, sy = e.clientY - r.top; I.lastSX = sx; I.lastSY = sy;
    const p = I.pointers.get(e.pointerId); if (p) { p.x = e.clientX; p.y = e.clientY; }
    if (I.pinch && I.pointers.size === 2) { pinchMove([...I.pointers.values()], r); return; }
    const touchPlace = I.mode === 'build' && view.ghost && I.lastType === 'touch' && !S.BUILDINGS[view.ghost.def].wall;
    if (view.ghost && !touchPlace) updateGhost(sx, sy);
    const d = I.down; if (!d) { const t = pick(sx, sy, 8); view.hover = t ? t.id : null; return; }
    if (!d.moved && Math.hypot(sx - d.sx, sy - d.sy) > 7) { d.moved = true; clearTimeout(I.longPress); clearTimeout(I.wheelT); /* 5.0b: arrastou, não abre a roda */ }
    if (!d.moved) return;
    if (I.wallDrag) { const [wx1, wy1] = R.screenToWorld(cam, sx, sy); view.wallGhost = wallSegments(I.wallDrag.x, I.wallDrag.y, wx1, wy1, view.ghost.def); return; }
    if (touchPlace && d.type === 'touch') { updateGhost(sx, sy - 70); ui.placeChanged && ui.placeChanged(); return; } // 4.1a: arrastar leva o fantasma acima do dedo
    const panning = d.button === 1 || d.button === 2 || (d.type === 'touch' && !I.touchBox) || (d.button === 0 && I.keys.has('Space')); // 4.0c: botão direito arrastando também move o mapa
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
    if (I.mode === 'build' && view.ghost && d.type === 'touch' && !S.BUILDINGS[view.ghost.def].wall) { if (!d.moved) updateGhost(sx, sy); ui.placeChanged && ui.placeChanged(); return; } // toque só reposiciona; o ✓ confirma
    if (d.moved) return;
    if (d.button === 1) { clearTimeout(I.wheelT); if (ui.wheel) ui.wheel({ sx, sy, wx, wy, touch: false, hold: false, id: e.pointerId }); return; } /* 5.0b: clique do meio: a roda fica aberta até escolher (ou clicar fora) */
    if (d.button === 2) { if (I.mode === 'attackmove') { I.setMode('normal'); contextCommand(wx, wy, sx, sy); } else if (I.mode !== 'normal') I.setMode('normal'); else contextCommand(wx, wy, sx, sy); return; } // 4.2g: botão direito no modo Atacar-mover ainda dá a ordem
    if (d.button === 0) {
      if (d.type === 'touch' && I.touchBox) { I.touchBox = false; ui.touchBoxChanged(false); }
      primaryAction(wx, wy, sx, sy, d.shift);
    }
  }
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', e => { I.pointers.delete(e.pointerId); I.pinch = null; I.down = null; view.box = null; I.wallDrag = null; view.wallGhost = null; clearTimeout(I.longPress); });
  canvas.addEventListener('wheel', e => { e.preventDefault(); if (e.ctrlKey && R.CAM) { cam.pitchT = Math.max(R.CAM.minPitch, Math.min(R.CAM.maxPitch, (cam.pitchT == null ? R.CAM.pitch : cam.pitchT) + (e.deltaY > 0 ? 0.06 : -0.06))); return; } const r = canvas.getBoundingClientRect(); const sx = e.clientX - r.left, sy = e.clientY - r.top; const [wx, wy] = R.screenToWorld(cam, sx, sy); const f = Math.exp(-e.deltaY * 0.0012); cam.zoom *= f; clampCam(); const [wx2, wy2] = R.screenToWorld(cam, sx, sy); cam.x += wx - wx2; cam.y += wy - wy2; clampCam(); if (view.ghost) updateGhost(sx, sy); }, { passive: false });

  // ---- keyboard
  const BUILD_KEYS = {}; for (const k in S.BUILDINGS) if (S.BUILDINGS[k].key) BUILD_KEYS[S.BUILDINGS[k].key] = k;
  I.buildMenu = false;
  window.addEventListener('keydown', e => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT')) return;
    if (ui.modalOpen()) { if (e.code === 'Escape') ui.closeModals(); else if (e.code === 'F3') { e.preventDefault(); ui.closeModals(); } return; } /* 5.0b: F3 também fecha a tela de pesquisa */
    if ((e.ctrlKey || e.metaKey) && !/^Digit[0-9]$/.test(e.code)) return; // 4.2g: Ctrl+S (salvar) não manda Parar nem produz; Ctrl+número continua definindo grupos
    I.keys.add(e.code);
    const k = e.key.toUpperCase();
    if (e.code === 'Escape') { if (I.mode !== 'normal') I.setMode('normal'); else if (I.buildMenu) { I.buildMenu = false; ui.buildMenuChanged(false); } else setSel([]); return; }
    if (e.code === 'Space') { e.preventDefault(); const al = ui.nextAlert ? ui.nextAlert() : view.lastAlert; if (al) I.center(al.x, al.y); return; } /* 5.0b: de novo em até 3 s, o alerta anterior */
    if (e.code === 'F3') { e.preventDefault(); if (ui.toggleTech) ui.toggleTech(); return; } /* 5.0b: tela de pesquisa */
    if (e.code === 'F1') { e.preventDefault(); const n = S.nucleoOf(sim, human); if (n) { setSel([n.id]); I.center(n.x, n.y); } return; }
    if (e.code === 'F2') { e.preventDefault(); const ids = []; for (const en of sim.ents) if (en.alive && en.owner === human && en.kind === 'unit' && S.UNITS[en.def].attack) ids.push(en.id); setSel(ids); return; }
    if (/^Digit[0-9]$/.test(e.code)) { const n = e.code.slice(5); if (e.ctrlKey || e.metaKey) { e.preventDefault(); I.groups[n] = [...view.sel]; ui.notice('Grupo ' + n + ' definido'); if (ui.groupsChanged) ui.groupsChanged(n); /* 5.0b: barra de grupos */ } else { const g = (I.groups[n] || []).filter(id => { const en = sim.byId.get(id); return en && en.alive; }); if (g.length) { setSel(g); const now = performance.now(); if (I.lastGroupKey === n && now - I.lastGroupT < 400) { const en = sim.byId.get(g[0]); if (en) I.center(en.x, en.y); } I.lastGroupKey = n; I.lastGroupT = now; } } return; }
    if (k === 'B' && !e.ctrlKey) { I.buildMenu = !I.buildMenu; ui.buildMenuChanged(I.buildMenu); return; }
    if (I.buildMenu && BUILD_KEYS[k]) { I.buildMenu = false; ui.buildMenuChanged(false); I.setMode('build', BUILD_KEYS[k]); return; }
    const b = ownSelectedBuilding(); const units = ownSelectedUnits();
    if (b && !units.length && b.built) { const pd = S.producesFor(b.def, sim.players[human].faction).find(u => S.UNITS[u].key === k); if (pd) { if (!e.repeat) cmd({ t: 'produce', id: b.id, def: pd, n: e.shiftKey ? 5 : 1 }); return; } } /* 5.0a.1: a tecla de cada unidade vale pela lista da Raça (antes a última unidade com a mesma letra, de outra Raça, roubava a tecla: C e I não produziam) e segurar a tecla põe 1, não ~30 por segundo */
    if (k === 'A' && units.length) { if (e.repeat) return; I.setMode(I.mode === 'attackmove' ? 'normal' : 'attackmove'); return; } // 4.2g: segurar A não fica ligando e desligando
    if (k === 'S' && units.length) { cmd({ t: 'stop', ids: units.map(u => u.id) }); return; }
    if (k === 'F' && view.sel.size) { const en = sim.byId.get([...view.sel][0]); if (en) I.center(en.x, en.y); return; }
    if (k === 'H' || e.key === '?') { ui.toggleHelp(); return; }
    if (k === 'P') { if (!(b && S.BUILDINGS[b.def].produces && S.BUILDINGS[b.def].produces.includes('pirata'))) ui.togglePause(); return; }
    if (e.key === '+' || e.key === '=') { cam.zoom *= 1.15; clampCam(); } if (e.key === '-') { cam.zoom /= 1.15; clampCam(); }
    if ((k === 'Q' || k === 'E') && R.supportsYaw) { cam.yaw = (cam.yaw || 0) + (k === 'Q' ? -1 : 1) * Math.PI / 8; return; }
    if ((e.code === 'PageUp' || e.code === 'PageDown' || e.code === 'Home') && R.CAM) { e.preventDefault(); cam.pitchT = e.code === 'Home' ? R.CAM.pitch : Math.max(R.CAM.minPitch, Math.min(R.CAM.maxPitch, (cam.pitchT == null ? R.CAM.pitch : cam.pitchT) + (e.code === 'PageUp' ? -0.1 : 0.1))); return; }
  });
  window.addEventListener('keyup', e => I.keys.delete(e.code));
  window.addEventListener('blur', () => I.keys.clear());

  I.update = function (dt) {
    if (cam.pitchT != null && cam.pitch != null && Math.abs(cam.pitchT - cam.pitch) > 0.001) cam.pitch += (cam.pitchT - cam.pitch) * Math.min(1, dt * 6); // inclinação suave
    const sp = 900 * dt / cam.zoom; let dx = 0, dy = 0;
    if (I.keys.has('KeyW') || I.keys.has('ArrowUp')) dy -= 1; if (I.keys.has('KeyS') && !ownSelectedUnits().length || I.keys.has('ArrowDown')) dy += 1;
    if (I.keys.has('KeyA') && !ownSelectedUnits().length || I.keys.has('ArrowLeft')) dx -= 1; if (I.keys.has('KeyD') || I.keys.has('ArrowRight')) dx += 1;
    // 4.0c — rolagem de borda pela janela inteira (só mouse): continua rolando com o ponteiro sobre a barra do navegador ou a barra de tarefas,
    // porque a última posição conhecida fica na borda até o ponteiro voltar. Para ao arrastar, com modal aberto ou sem foco na página.
    if (I.edge.mouse && I.edge.x != null && !I.down && I.pointers.size === 0 && document.hasFocus() && !document.querySelector('.modal:not([hidden])')) {
      const m = 14, W = window.innerWidth, Hh = window.innerHeight;
      if (I.edge.x < m) dx -= 0.7; if (I.edge.x > W - m) dx += 0.7; if (I.edge.y < m) dy -= 0.7; if (I.edge.y > Hh - m) dy += 0.7;
    }
    if (dx || dy) { const [dwx, dwy] = R.screenDeltaToWorld(cam, dx * sp * cam.zoom, dy * sp * cam.zoom); cam.x += dwx; cam.y += dwy; clampCam(); if (view.ghost) updateGhost(I.lastSX || R.w / 2, I.lastSY || R.h / 2); }
  };
  canvas.addEventListener('pointerleave', () => { I.lastSX = null; I.lastSY = null; });
  I.edge = { x: null, y: null, mouse: false };
  window.addEventListener('pointermove', e => { if (e.pointerType !== 'mouse') { I.edge.mouse = false; return; } I.edge.mouse = true; I.edge.x = e.clientX; I.edge.y = e.clientY; }, { passive: true });
  window.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse') { I.edge.x = e.clientX; I.edge.y = e.clientY; } }, { passive: true });
  window.addEventListener('blur', () => { I.edge.x = null; I.edge.y = null; });
  return I;
}
ARD.input = { create };
})(globalThis.ARD = globalThis.ARD || {});
