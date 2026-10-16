/* Aether Rift: Dominion — interface da campanha e do progresso (4.0e): tela "O Grande Alinhamento" (Comandante, atos, relíquias,
   conquistas, backup), briefing com os líderes, HUD de missão (objetivos e transmissões), Hangar com visualizador 3D,
   rastreio de conquistas em qualquer partida e o fechamento com XP, estrelas e desbloqueios no ProgressStore. */
(function (ARD) {
'use strict';
const S = ARD.sim, C = ARD.campaign, P = ARD.progress; const RACES = ['vehnar', 'erevane', 'tessara', 'quorith', 'vorag'];
const SHADES = r => (S.RACE_SHADES && S.RACE_SHADES[r]) || ['#FF8C1A']; // 4.1a: cores do Hangar ligadas à Raça
const SKINS = [{ n: 'Padrão', lv: 1 }, { n: 'Fortaleza', lv: 10 }, { n: 'Santuário', lv: 20 }];
let D = null; // dependências de main.js: { $, leaderArt, LEADER_NAME, RACE_COLORS, LEADER_FACE, startGame, loadPrefs, savePrefs, selectedRace }
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const stars = n => '<span class="stars">' + [0, 1, 2].map(i => i < n ? '★' : '<span class="off">★</span>').join('') + '</span>';
function raceName(r) { return (S.FACTIONS[r] || {}).name || r; }
function totalStars() { const s = P.load(); return Object.values(s.missions).reduce((a, m) => a + (m.stars || 0), 0); }
function titleOf() { const a = P.load().achievements; let best = '', t = 0; for (const id in a) if (C.TITLES[id] && a[id] >= t) { t = a[id]; best = C.TITLES[id]; } return best; } // título automático: o da conquista mais recente que dá título
function colorFor(race) { const h = P.load().hangar; return (h.colors && h.colors[race]) || null; }
function refreshMini() { try { refreshCard(); } catch (e) { console.warn('[ARD] cartão da campanha:', e); } const el = D.$('cmdr-mini'); if (!el) return; const li = P.levelInfo(); const s = P.load(); el.textContent = 'Comandante nível ' + li.level + ' · ' + li.xp.toLocaleString('pt-BR') + ' XP · ' + totalStars() + ' ★ na campanha' + (titleOf() ? ' · "' + titleOf() + '"' : '') + (s.relics.equipped.some(Boolean) ? ' · relíquias: ' + s.relics.equipped.filter(Boolean).map(id => (C.RELICS.find(r => r.id === id) || {}).name).join(', ') : ''); }

// ---------- tela da campanha ----------
function openCampaign() {
  const $ = D.$; const s = P.load(); const li = P.levelInfo(); const race = D.selectedRace();
  const nm = ($('opt-name') && $('opt-name').value.trim()) || s.commander.name || 'Comandante'; if (nm !== s.commander.name) P.setName(nm);
  $('cmdr-img').src = D.leaderArt(race, D.LEADER_FACE[race]) || ''; $('cmdr-name').textContent = nm; $('cmdr-title').textContent = titleOf() ? '"' + titleOf() + '"' : ''; $('cmdr-lvn').textContent = 'Nv ' + li.level;
  $('cmdr-xp').style.width = (li.max ? 100 : Math.round(100 * li.into / li.need)) + '%'; $('cmdr-lv').textContent = li.max ? 'Nível máximo · ' + li.xp.toLocaleString('pt-BR') + ' XP' : li.into + ' / ' + li.need + ' XP para o nível ' + (li.level + 1) + ' · ' + totalStars() + ' ★';
  let h = ''; for (const act of C.ACTS) { h += `<div class="act"><h3>${esc(act.name)}</h3><div class="mlist">`;
    for (const m of C.missionsOfAct(act.id)) { const pr = s.missions[m.id] || {}; const ok = C.unlocked(m.id, s); h += `<button class="mcard" data-mission="${m.id}" ${ok ? '' : 'disabled title="Conclua a missão anterior"'}><b>${esc(m.title)}</b><span class="pl">${esc(m.place)}${m.race ? ' · só ' + esc(raceName(m.race)) : ''}</span>${stars(pr.stars || 0)}</button>`; }
    h += '</div></div>'; }
  $('camp-acts').innerHTML = h; $('camp-acts').querySelectorAll('[data-mission]').forEach(b => b.addEventListener('click', () => { $('campaign').hidden = true; openBriefing(b.dataset.mission); }));
  renderRelics(); renderAchievements(); $('campaign').hidden = false;
}
function renderRelics() { const $ = D.$; const s = P.load(); let h = '';
  for (const r of C.RELICS) { const own = s.relics.owned.includes(r.id); const on = s.relics.equipped.includes(r.id); const how = Object.entries(C.RELIC_BY_LEVEL).find(([, id]) => id === r.id); const src = how ? 'nível ' + how[0] : 'missão ' + ((C.MISSIONS.find(m => m.relic === r.id) || {}).title || '');
    h += `<div class="relic ${own ? '' : 'locked'} ${on ? 'on' : ''}"><b>${esc(r.name)}</b><span class="small">${esc(r.desc)}</span>${own ? `<button class="chip2 ${on ? 'on' : ''}" data-relic="${r.id}">${on ? 'Equipada · tirar' : 'Equipar'}</button>` : `<span class="small muted">Desbloqueia: ${esc(src)}</span>`}</div>`; }
  $('camp-relics').innerHTML = h; $('camp-relics').querySelectorAll('[data-relic]').forEach(b => b.addEventListener('click', () => { const id = b.dataset.relic; const eq = P.load().relics.equipped; const i = eq.indexOf(id); if (i >= 0) P.equipRelic(i, null); else P.equipRelic(eq[0] ? (eq[1] ? 0 : 1) : 0, id); renderRelics(); refreshMini(); })); }
function renderAchievements() { const $ = D.$; const s = P.load(); $('camp-ach').innerHTML = C.ACHIEVEMENTS.map(a => `<div class="ach ${s.achievements[a.id] ? '' : 'locked'}"><b>${s.achievements[a.id] ? '🏅 ' : ''}${esc(a.name)}</b><span class="small">${esc(a.desc)}</span></div>`).join(''); }

// ---------- briefing ----------
let brMission = null;
function openBriefing(id, opts) {
  const $ = D.$; const m = C.BY_ID[id]; if (!m) return; brMission = id; const s = P.load(); opts = opts || {};
  const raceSel = $('br-race'); raceSel.innerHTML = RACES.map(r => `<option value="${r}">${esc(raceName(r))}</option>`).join(''); raceSel.value = m.race || opts.race || D.selectedRace(); raceSel.disabled = !!m.race;
  const pr = s.missions[id] || {}; $('br-diff').value = opts.diff || pr.lastDifficulty || 'normal';
  const draw = () => { const race = raceSel.value; const prep = C.prepare(id, { race, difficulty: $('br-diff').value }); const who = w => w === 'self' ? race : w === 'enemy' ? prep.cfg.players.find((p, i) => i > 0 && !p.ally).faction : w === 'ally' ? (prep.cfg.players.find((p, i) => i > 0 && p.ally) || prep.cfg.players[1]).faction : (prep.swap && prep.swap[w]) || w; // 4.2g: fala da Raça trocada vai para a Raça real do inimigo
    $('br-act').textContent = (C.ACTS.find(a => a.id === m.act) || {}).name || ''; $('br-title').textContent = m.title; $('br-place').textContent = m.place + ' · adversários: ' + prep.cfg.players.slice(1).map(p => p.name + ' (' + raceName(p.faction) + (p.ally ? ', aliado' : '') + ')').join(', ');
    $('br-dialog').innerHTML = m.brief.map(([w, mood, text]) => { const r = who(w); const art = D.leaderArt(r, mood); return `<div class="brl">${art ? `<img src="${art}" alt="">` : ''}<div><div class="nm">${esc(D.LEADER_NAME[r] || raceName(r))} · ${esc(raceName(r))}</div><div>${esc(text)}</div></div></div>`; }).join('');
    $('br-obj').innerHTML = m.objectives.map(o => `<li class="${o.bonus ? 'bn' : ''}">${o.bonus ? '★ Bônus: ' : ''}${esc(o.text.replace(/^Bônus: /, ''))}</li>`).join('');
    const eq = P.load().relics.equipped.filter(Boolean).map(rid => (C.RELICS.find(r => r.id === rid) || {}).name); $('br-relics').textContent = (eq.length ? 'Relíquias equipadas: ' + eq.join(', ') + '. ' : 'Nenhuma relíquia equipada. ') + (m.relic && !P.load().relics.owned.includes(m.relic) ? 'Recompensa: relíquia ' + (C.RELICS.find(r => r.id === m.relic) || {}).name + '. ' : '') + 'Melhor resultado: ' + ((pr.stars || 0) ? (pr.stars + ' ★') : 'ainda não concluída') + '.'; };
  raceSel.onchange = draw; $('br-diff').onchange = draw; draw();
  $('br-start').onclick = () => { $('briefing').hidden = true; launch(id, raceSel.value, $('br-diff').value); };
  $('briefing').hidden = false;
}

// 4.1b: início direto de uma missão (briefing, botão Continuar e links do fim de partida usam o mesmo caminho)
function launch(id, race, diff) {
  const $ = D.$; const m = C.BY_ID[id]; if (!m) return; race = m.race || race || D.selectedRace(); diff = diff || 'normal';
  const prep = C.prepare(id, { race, difficulty: diff, relics: P.load().relics.equipped, name: ($('opt-name').value.trim() || P.load().commander.name || 'Comandante').slice(0, 18), color: colorFor(race) });
  try { const pf = JSON.parse(localStorage.getItem('ard-beta-prefs') || '{}'); pf.campDiff = diff; localStorage.setItem('ard-beta-prefs', JSON.stringify(pf)); } catch (e) {}
  const campArgs = { id, opts: { race, difficulty: diff, relics: P.load().relics.equipped.slice(), name: prep.cfg.players[0].name, color: colorFor(race) } };
  D.startGame({ name: prep.cfg.players[0].name, faction: race, seed: prep.cfg.seed, minutes: prep.cfg.minutes, players: prep.cfg.players, campaign: prep, campArgs, gfx: $('opt-gfx').value, quality: $('opt-quality').value, clima: $('opt-clima').value });
}
// próxima missão a jogar: a primeira liberada ainda sem vitória; com tudo vencido, a última liberada
function currentMission() { const s = P.load(); let last = null; for (const m of C.MISSIONS) { if (!C.unlocked(m.id, s)) continue; const pr = s.missions[m.id] || {}; if (!pr.won && !(pr.stars > 0)) return m; last = m; } return last || C.MISSIONS[0]; }
function campDiff() { try { return JSON.parse(localStorage.getItem('ard-beta-prefs') || '{}').campDiff || null; } catch (e) { return null; } }
function refreshCard() { const $ = D.$; if (!$('camp-card')) return; const s = P.load(); const li = P.levelInfo(); const m = currentMission(); const race = m.race || D.selectedRace();
  const nm = ($('opt-name') && $('opt-name').value.trim()) || s.commander.name || 'Comandante';
  $('camp-card-img').src = D.leaderArt(race, D.LEADER_FACE[race]) || ''; $('camp-card-name').textContent = nm; $('camp-card-lv').textContent = 'Nv ' + li.level; $('camp-card-xp').style.width = (li.max ? 100 : Math.round(100 * li.into / li.need)) + '%';
  const act = C.ACTS.find(a => a.id === m.act) || {}; const done = C.MISSIONS.filter(x => (s.missions[x.id] || {}).won || (s.missions[x.id] || {}).stars > 0).length;
  $('camp-next-act').textContent = (act.name || 'Campanha') + ' · ' + done + '/' + C.MISSIONS.length + ' missões'; $('camp-next-title').textContent = m.title; $('camp-next-place').textContent = m.place + (m.race ? ' · missão da Raça ' + raceName(m.race) : '');
  $('camp-race-note').textContent = m.race ? raceName(m.race) + ' (fixa nesta missão)' : raceName(race) + ' · troque ao lado';
  const pr = s.missions[m.id] || {}; if (!$('camp-diff').dataset.touched) $('camp-diff').value = campDiff() || pr.lastDifficulty || 'normal';
  $('btn-camp-continue').textContent = done ? 'Continuar: ' + m.title : 'Começar a campanha'; $('btn-camp-continue').dataset.mission = m.id; }

// ---------- Hangar ----------
let hg = null;
function openHangar() {
  const $ = D.$; const s = P.load(); const li = P.levelInfo(); const st = { race: D.selectedRace(), colors: Object.assign({}, s.hangar.colors || {}), skin: Object.assign({}, s.hangar.skin), portrait: Object.assign({}, s.hangar.portrait) };
  $('hg-race').innerHTML = RACES.map(r => `<option value="${r}">${esc(raceName(r))}</option>`).join(''); $('hg-race').value = st.race;
  const cur = () => st.colors[st.race] || SHADES(st.race)[0];
  const draw = () => { $('hg-colors').innerHTML = SHADES(st.race).map(c => `<button class="swatch ${c === cur() ? 'on' : ''}" style="background:${c}" data-c="${c}" aria-label="tom ${c}"></button>`).join('');
    $('hg-skins').innerHTML = SKINS.map((k, i) => `<button class="chip2 ${(st.skin[st.race] || 0) === i ? 'on' : ''}" data-skin="${i}" ${li.level >= k.lv ? '' : 'disabled'}>${k.n}${li.level >= k.lv ? '' : ' · nível ' + k.lv}</button>`).join('');
    $('hg-portraits').innerHTML = [1, 2, 3].map(i => `<button class="chip2 ${(st.portrait[st.race] || D.LEADER_FACE_DEFAULT[st.race]) === i ? 'on' : ''}" data-por="${i}">${['Sereno', 'Furioso', 'Triunfante'][i - 1]}</button>`).join('');
    $('hg-note').textContent = 'Os tons são da paleta da ' + raceName(st.race) + ' e valem no solo, na campanha e no multiplayer (se dois jogadores escolherem tons parecidos, o segundo recebe o próximo tom). O Núcleo e o retrato aparecem nas suas partidas.';
    $('hg-colors').querySelectorAll('[data-c]').forEach(b => b.onclick = () => { st.colors[st.race] = b.dataset.c; draw(); view(); });
    $('hg-skins').querySelectorAll('[data-skin]').forEach(b => b.onclick = () => { st.skin[st.race] = +b.dataset.skin; draw(); view(); });
    $('hg-portraits').querySelectorAll('[data-por]').forEach(b => b.onclick = () => { st.portrait[st.race] = +b.dataset.por; draw(); }); };
  $('hg-race').onchange = () => { st.race = $('hg-race').value; draw(); view(); };
  $('hg-save').onclick = () => { P.setHangar({ colors: st.colors, skin: st.skin, portrait: st.portrait }); applyHangar(); refreshMini(); $('hangar').hidden = true; pauseViewer(); };
  const view = () => startViewer(st.race, cur(), st.skin[st.race] || 0);
  draw(); $('hangar').hidden = false; view();
  const closeObs = new MutationObserver(() => { if ($('hangar').hidden) { pauseViewer(); closeObs.disconnect(); } }); closeObs.observe($('hangar'), { attributes: true, attributeFilter: ['hidden'] });
}
const SIGNATURE = { vehnar: ['prensa', 'soldador'], erevane: ['lamina', 'atirador'], tessara: ['colosso', 'quimera'], quorith: ['monolito', 'voz'], vorag: ['brutamonte', 'cria'] };
let hgPending = null;
function startViewer(race, color, skin) { // 4.1a: um renderizador só, reaproveitado entre aberturas (antes o contexto era descartado e a reabertura ficava em branco)
  const THREE = window.THREE, ME = ARD.meshes, ADD = window.THREE_ADDONS || {}; const cv = D.$('hg-view'); if (!cv) return;
  const note = D.$('hg-loading'); if (!THREE || !ME) { if (note) note.hidden = false; if (!hgPending) { hgPending = () => { hgPending = null; if (!D.$('hangar').hidden) startViewer(race, color, skin); }; window.addEventListener('three-ready', hgPending, { once: true }); } return; }
  if (note) note.hidden = true;
  try {
    if (!hg) { const r = new THREE.WebGLRenderer({ canvas: cv, antialias: true }); r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.shadowMap.enabled = true;
      const sc = new THREE.Scene(); sc.background = new THREE.Color(0x0b0d11); if (ADD.RoomEnvironment) { const pm = new THREE.PMREMGenerator(r); sc.environment = pm.fromScene(new ADD.RoomEnvironment(), 0.04).texture; pm.dispose(); }
      sc.add(new THREE.HemisphereLight(0x9fb8d6, 0x2a2a30, 0.75)); const sun = new THREE.DirectionalLight(0xffe9c4, 1.8); sun.position.set(-60, 90, 70); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70 }); sc.add(sun);
      const ground = new THREE.Mesh(new THREE.CircleGeometry(80, 64).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x2c3038, roughness: 0.95 })); ground.receiveShadow = true; sc.add(ground);
      const cam = new THREE.PerspectiveCamera(32, 4 / 3, 1, 2000); cam.position.set(104, 74, 104); cam.lookAt(0, 6, 0);
      hg = { r, sc, cam, grp: null, mat: ME.material({ env: 0.75, key: 'hangar' }), em: new THREE.MeshBasicMaterial({ vertexColors: true }), raf: 0, t0: performance.now(), run: false };
    }
    const w = cv.clientWidth || 480, h = cv.clientHeight || 360; hg.r.setSize(w, h, false); hg.cam.aspect = w / h; hg.cam.updateProjectionMatrix();
    if (hg.grp) { hg.sc.remove(hg.grp); hg.grp.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
    const grp = new THREE.Group(); const add = (def, x, z, size, sk) => { const g = ME.build(def, race, color, sk || 0); if (!g) return; const k = size / g.width; const m = new THREE.Mesh(g.main, hg.mat); m.castShadow = m.receiveShadow = true; m.scale.setScalar(k); m.position.set(x, 0, z); grp.add(m); if (g.em) { const e = new THREE.Mesh(g.em, hg.em); e.scale.setScalar(k); e.position.set(x, 0, z); grp.add(e); } };
    const sig = SIGNATURE[race] || ['veiculo', 'infantaria']; add('nucleo', 0, 0, 62, skin); add(sig[0], 36, 30, 20); add(sig[1], 18, 42, 8); add('coletor', -34, 34, 11); hg.grp = grp; hg.sc.add(grp);
    if (!hg.run) { hg.run = true; const loop = now => { if (!hg || !hg.run) return; hg.raf = requestAnimationFrame(loop); if (hg.grp) hg.grp.rotation.y = (now - hg.t0) / 1000 * 0.35; hg.r.render(hg.sc, hg.cam); }; hg.raf = requestAnimationFrame(loop); }
  } catch (e) { console.warn('[ARD] Hangar 3D indisponível: ' + e.message); if (note) { note.hidden = false; note.textContent = 'Visualização 3D indisponível neste navegador.'; } }
}
function pauseViewer() { if (!hg) return; hg.run = false; cancelAnimationFrame(hg.raf); }
function applyHangar() { const h = P.load().hangar; for (const r of RACES) D.LEADER_FACE[r] = h.portrait[r] || D.LEADER_FACE_DEFAULT[r]; }

// ---------- rastreio de conquistas (qualquer partida) ----------
function tracker(sim, human) {
  const st = { cls: new Set(), walls: 0, dmgAt600: null, pactDone: false };
  return { st, tick(ev) { for (const e of ev) { if (e.t === 'spawn' && e.p === human) { const u = S.UNITS[e.def]; if (u && u.attack) st.cls.add(u.cls); } else if (e.t === 'built' && e.p === human && e.def === 'muro') st.walls++; else if (e.t === 'alert' && e.p === human && typeof e.text === 'string' && e.text.startsWith('Pacto cumprido')) st.pactDone = true; }
    if (st.dmgAt600 === null && sim.time >= 600) st.dmgAt600 = sim.players[human].stats.dmg; },
    save: () => ({ cls: [...st.cls], walls: st.walls, dmgAt600: st.dmgAt600, pactDone: st.pactDone }), load(o) { if (!o) return; st.cls = new Set(o.cls || []); st.walls = o.walls || 0; st.dmgAt600 = o.dmgAt600 == null ? null : o.dmgAt600; st.pactDone = !!o.pactDone; } };
}
function evalAchievements(won, sim, human, tr, camp) {
  const p = sim.players[human]; const n = S.nucleoOf(sim, human); const out = []; const u = id => { if (P.unlock(id)) out.push(id); };
  if (p.stats.stolen > 0) u('primeiro-sifao'); if (p.stats.betrayals > 0) u('traidor'); if (tr && tr.st.pactDone) u('diplomata'); if (tr && tr.st.walls >= 20) u('muralha');
  if (won) { if (n && n.hp >= n.maxHp * 0.9) u('nucleo-intacto'); if (tr && tr.st.cls.size === 1 && tr.st.cls.has('inf')) u('so-infantaria'); if (tr && sim.time >= 600 && tr.st.dmgAt600 === 0) u('pacifista-10');
    const s = P.load(); s.stats.racesWon = s.stats.racesWon || {}; s.stats.racesWon[p.faction] = true; P.save(); if (RACES.every(r => s.stats.racesWon[r])) u('cinco-racas'); }
  if (camp && camp.won) { u('primeiro-passo'); if (camp.stars >= 3) u('tres-estrelas'); if (camp.difficulty === 'fenda') u('fenda'); const s = P.load();
    for (const [act, ach] of [['prologo', 'prologo'], ['ato1', 'ato-1'], ['ato2', 'ato-2'], ['ato3', 'ato-3'], ['ato4', 'ato-4'], ['identidade', 'identidade']]) if (C.missionsOfAct(act).every(m => s.missions[m.id] && s.missions[m.id].done)) u(ach); }
  return out;
}
function grantXp(xp) { const lv = P.addXp(xp); const out = { xp, from: lv.from, to: lv.to, relics: [], ach: [] }; for (let l = lv.from + 1; l <= lv.to; l++) { const rid = C.RELIC_BY_LEVEL[l]; if (rid && P.grantRelic(rid)) out.relics.push(rid); } if (lv.to >= 10 && P.unlock('comandante-10')) out.ach.push('comandante-10'); if (lv.to >= 30 && P.unlock('comandante-30')) out.ach.push('comandante-30'); return out; }

// ---------- sessão de missão (HUD) ----------
function begin(sim, prep, saved) {
  const $ = D.$; const run = C.start(sim, prep, saved || null); const queue = []; let showing = null, until = 0;
  const comms = () => { const now = performance.now(); if (showing && now < until) return; if (!queue.length) { if (showing) { $('comms').hidden = true; showing = null; } return; } showing = queue.shift(); until = now + Math.max(4200, 1800 + showing.text.length * 55);
    const art = D.leaderArt(showing.race, showing.mood); $('comms-img').src = art || ''; $('comms-img').hidden = !art; $('comms-name').textContent = (D.LEADER_NAME[showing.race] || raceName(showing.race)) + ' · ' + raceName(showing.race); $('comms-text').textContent = showing.text; $('comms').style.setProperty('--cc', D.RACE_COLORS[showing.race] || '#FF5E3A'); $('comms').hidden = false; };
  const hud = () => { $('ob-title').textContent = prep.mission.title; $('ob-list').innerHTML = run.objectives.map(o => `<li class="${o.done ? 'ok' : ''} ${o.bonus ? 'bn' : ''}"><span>${o.done ? '✓' : o.bonus ? '★' : '○'}</span><span>${esc(o.text.replace(/^Bônus: /, ''))}</span>${o.progress && !o.done ? `<span class="pg">${esc(o.progress)}</span>` : ''}</li>`).join(''); };
  if (!saved) for (const sd of run.brief()) queue.push(sd); else queue.push({ race: sim.players[0].faction, mood: 1, text: 'De volta ao comando. A missão continua de onde parou.' }); $('objectives').hidden = false; hud();
  const sess = { prep, run, hud, noPause: !!prep.diff.noPause,
    tick(ev) { run.tick(ev); for (const sd of run.takeSaid()) queue.push(sd); comms(); return run.result; },
    frame() { comms(); hud(); },
    beacon() { return run.marker(); }, vip: () => run.vipId() };
  return sess;
}
// fechamento: grava progresso, calcula XP e desbloqueios; devolve o HTML do bloco de campanha no fim de partida
function finish(sess, won, sim, human, tr, mode) {
  let html = ''; const p = sim.players[human];
  if (sess) { const r = sess.run.result || { won, stars: 0, time: sim.time }; const m = sess.prep.mission; const before = P.mission(m.id) || {}; P.completeMission(m.id, { stars: r.stars, won: r.won, difficulty: sess.prep.difficulty, time: r.time, race: p.faction });
    const g = grantXp(C.xpFor(m, sess.prep.difficulty, r.stars, r.won)); let relic = null; if (r.won && m.relic && P.grantRelic(m.relic)) relic = m.relic;
    const ach = evalAchievements(r.won, sim, human, tr, { won: r.won, stars: r.stars, difficulty: sess.prep.difficulty }).concat(g.ach);
    html += r.won ? `<div>${stars(r.stars)} <span class="muted small">${r.stars > (before.stars || 0) ? 'novo recorde' : 'melhor: ' + (before.stars || 0) + ' ★'}</span></div>` : '';
    html += `<ul class="obj-list">${sess.run.objectives.map(o => `<li class="${o.bonus ? 'bn' : ''}">${o.done ? '✓' : '✗'} ${esc(o.text.replace(/^Bônus: /, o.bonus ? '★ ' : ''))}</li>`).join('')}</ul>`;
    html += unlocksHtml(g, ach, relic);
    return { html, won: r.won, next: r.won ? nextMission(m.id) : null };
  }
  const opp = sim.players.filter(q => q.id !== human).length; const g = grantXp(won ? 150 + 50 * opp : 40); const ach = evalAchievements(won, sim, human, tr, null).concat(g.ach); html += unlocksHtml(g, ach, null); return { html, won, next: null };
}
function unlocksHtml(g, ach, relic) { const li = P.levelInfo(); let h = `<div class="unlock">+${g.xp.toLocaleString('pt-BR')} XP · Comandante nível ${li.level}${g.to > g.from ? ' <b>(subiu de nível!)</b>' : ''} · ${li.max ? 'nível máximo' : li.into + '/' + li.need + ' XP'}</div>`;
  for (const rid of g.relics.concat(relic ? [relic] : [])) { const r = C.RELICS.find(x => x.id === rid); if (r) h += `<div class="unlock">Relíquia desbloqueada: <b>${esc(r.name)}</b> — ${esc(r.desc)} (equipe na tela da campanha)</div>`; }
  for (const id of ach) { const a = C.ACHIEVEMENTS.find(x => x.id === id); if (a) h += `<div class="unlock">🏅 Conquista: <b>${esc(a.name)}</b> — ${esc(a.desc)}${C.TITLES[id] ? ' · título "' + esc(C.TITLES[id]) + '" no Hangar' : ''}</div>`; }
  return h; }
function nextMission(id) { const i = C.MISSIONS.findIndex(m => m.id === id); for (let k = i + 1; k < C.MISSIONS.length; k++) if (C.unlocked(C.MISSIONS[k].id, P.load())) return C.MISSIONS[k].id; return null; }

function init(deps) {
  D = deps; D.LEADER_FACE_DEFAULT = Object.assign({}, D.LEADER_FACE); applyHangar(); const $ = D.$;
  $('btn-campaign').addEventListener('click', openCampaign); $('btn-hangar').addEventListener('click', openHangar); $('camp-hangar').addEventListener('click', () => { $('campaign').hidden = true; openHangar(); });
  $('camp-export').addEventListener('click', () => { const code = P.exportCode(); const ta = $('camp-code'); ta.hidden = false; ta.value = code; ta.select(); try { navigator.clipboard.writeText(code); } catch (e) {} $('camp-export').textContent = 'Código copiado'; setTimeout(() => { $('camp-export').textContent = 'Copiar código de backup'; }, 2500); });
  $('camp-import').addEventListener('click', () => { const ta = $('camp-code'); if (ta.hidden || !ta.value.trim()) { ta.hidden = false; ta.value = ''; ta.focus(); return; } try { P.importCode(ta.value); applyHangar(); refreshMini(); openCampaign(); $('camp-import').textContent = 'Progresso importado'; } catch (e) { $('camp-import').textContent = e.message; } setTimeout(() => { $('camp-import').textContent = 'Importar código'; }, 3000); });
  for (const id of ['campaign', 'briefing', 'hangar']) $(id).querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => { $(id).hidden = true; }));
  if ($('btn-camp-continue')) { $('btn-camp-continue').addEventListener('click', () => launch($('btn-camp-continue').dataset.mission || currentMission().id, D.selectedRace(), $('camp-diff').value)); $('camp-diff').addEventListener('change', () => { $('camp-diff').dataset.touched = '1'; try { const pf = JSON.parse(localStorage.getItem('ard-beta-prefs') || '{}'); pf.campDiff = $('camp-diff').value; localStorage.setItem('ard-beta-prefs', JSON.stringify(pf)); } catch (e) {} }); }
  refreshMini();
  const q = new URLSearchParams(location.search);
  if (q.get('missao') && C.BY_ID[q.get('missao')]) { try { const k = new URLSearchParams(location.search); for (const n of ['missao', 'dif', 'raca', 'iniciar']) k.delete(n); const s = k.toString(); history.replaceState(history.state, '', location.pathname + (s ? '?' + s : '') + location.hash); } catch (e) {} } // 4.2g: link de lançamento vale uma vez (Sair, Pausar e sair e F5 não relançam a missão)
  if (q.get('missao') && C.BY_ID[q.get('missao')]) setTimeout(() => { if (q.get('iniciar')) launch(q.get('missao'), q.get('raca') || undefined, q.get('dif') || undefined); else openBriefing(q.get('missao'), { diff: q.get('dif') || undefined, race: q.get('raca') || undefined }); }, 200);
}
function applyColor(players) { if (!players || !players[0]) return; const c = colorFor(players[0].faction); if (c) players[0].color = c; }
function skinOf(race) { return P.load().hangar.skin[race] || 0; }
ARD.campUI = { init, begin, finish, tracker, refreshMini, openCampaign, openBriefing, openHangar, applyColor, skinOf, colorFor, launch, currentMission };
})(globalThis.ARD = globalThis.ARD || {});
