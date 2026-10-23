/* Aether Rift: Dominion — Sala de Comando (5.0b): a mesa tática e a Academia de Comando.
   Mesa tática (aba Jogar): o mapa escolhido em holograma na frente do Núcleo, com o relevo real em miniatura (a mesma simulação e o mesmo
   src/terrain3d.js da partida: createSim com a semente, o mapa e o número de jogadores escolhidos, e terrain3d.build numa grade 97×97),
   curvas de nível, os pontos de partida (o seu na cor da Raça), os nós de recurso, os lagos e a Fenda; gira devagar e se refaz com uma
   varredura quando o mapa, a semente ou os oponentes mudam.
   Academia de Comando ("Como jogar" interativo): a mesa mostra o modelo 3D da unidade ou construção escolhida girando, com o que faz,
   custo, vida, alcance e contra o que é forte ou fraca (dados de ARD.sim: UNITS, BUILDINGS, FACTIONS, WEAPONS), quatro passos para quem
   nunca jogou RTS e transições com GSAP. Sem a Sala (GPU por software, fundo clássico), a Academia abre igual, com a miniatura 2D. */
(function (ARD) {
'use strict';
const COR = { vehnar: 0xff7733, erevane: 0x33ffd0, tessara: 0x55e68a, quorith: 0xb388ff, vorag: 0xe6455a };
const BIO = [[0.78, 0.86, 0.95], [0.85, 0.62, 0.38], [0.42, 0.62, 0.32], [0.42, 0.4, 0.46]]; /* gelo, deserto, tundra, basalto (tons do holograma) */
const R = 13, HN = 97; /* raio da mesa e grade do relevo */
const $ = id => document.getElementById(id);
const reduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
function cfgAtual(race) { const map = ($('opt-map') || {}).value === 'cinturao' ? 'cinturao' : 'fenda'; const opp = Math.max(1, Math.min(3, parseInt(($('opt-opp') || {}).value, 10) || 2)); const seed = parseInt(($('opt-seed') || {}).value, 10) || 4242; return { map, opp, seed, race }; }
/* simulação só para o desenho: os mesmos jogadores que a partida criaria (main.js startGame) */
function simDe(cfg) { const S = ARD.sim; const players = [{ name: 'Você', faction: cfg.race, human: true }]; const outras = Object.keys(S.FACTIONS).filter(f => f !== cfg.race).concat([cfg.race]);
  for (let i = 0; i < cfg.opp; i++) players.push({ name: 'IA ' + (i + 1), faction: outras[i % outras.length], difficulty: 'normal' }); return S.createSim({ seed: cfg.seed, players, minutes: 25, map: cfg.map, mapV: 1 }); }
function criar(C, st) { const { W, T } = C.L; const { float, vec3, color, uniform, mix, smoothstep, abs, fract, sin, time, attribute, positionWorld, positionLocal, length, max, min, dot, normalize, cameraPosition, normalWorld } = T;
  const M = { group: new W.Group(), disp: [], cfg: null, race: st.race, pos: new W.Vector3(-50, 0, 20), modo: 'mapa', alvoVis: 1 }; M.group.name = 'mesa-tatica';
  const U = M.U = { cor: uniform(new W.Color(COR[st.race])), revela: uniform(0), y0: uniform(0) };
  /* pedestal: coluna escura com anel aceso; o tampo é um disco de luz */
  const ped = new W.Group(); M.group.add(ped); M.ped = ped;
  { const m = new W.MeshStandardNodeMaterial({ color: 0x23262c, roughness: 0.45, metalness: 0.8 }); m.lightsNode = C.luzMundo; const g = new W.CylinderGeometry(4.2, 6.5, 22, 32); M.disp.push(g, m); const c = new W.Mesh(g, m); c.position.y = 11; c.castShadow = true; c.receiveShadow = true; ped.add(c);
    const g2 = new W.CylinderGeometry(R + 1.6, R + 0.6, 1.4, 64); M.disp.push(g2); const tampo = new W.Mesh(g2, m); tampo.position.y = 22.4; tampo.castShadow = true; ped.add(tampo); }
  { const m = new W.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: W.AdditiveBlending, side: W.DoubleSide }); m.fog = false; const r = length(positionLocal.xy);
    m.colorNode = U.cor.mul(smoothstep(R - 0.2, R + 0.6, r).mul(smoothstep(R + 1.6, R + 0.9, r)).mul(2.2).add(smoothstep(R * 0.2, R, r).mul(0.12))).mul(sin(time.mul(1.5)).mul(0.1).add(0.95));
    const g = new W.CircleGeometry(R + 1.7, 96); M.disp.push(g, m); const d = new W.Mesh(g, m); d.rotation.x = -Math.PI / 2; d.position.y = 23.15; d.renderOrder = 8; ped.add(d); M.disco = d; }
  /* holograma do mapa (o relevo entra quando a simulação de desenho fica pronta) */
  const incl = new W.Group(); incl.position.y = 24.4; incl.rotation.x = 0.3; ped.add(incl); M.incl = incl; /* o mapa inclina para quem olha (holograma de mesa de comando) */
  const holo = new W.Group(); holo.position.y = 2.2; incl.add(holo); M.holo = holo;
  const mapMat = new W.MeshBasicNodeMaterial({ transparent: true, depthWrite: true, side: W.DoubleSide }); mapMat.fog = false; M.disp.push(mapMat);
  { const bio = attribute('bio', 'vec4'), alt = attribute('alt', 'float'); const base = vec3(BIO[0][0], BIO[0][1], BIO[0][2]).mul(bio.x).add(vec3(BIO[1][0], BIO[1][1], BIO[1][2]).mul(bio.y)).add(vec3(BIO[2][0], BIO[2][1], BIO[2][2]).mul(bio.z)).add(vec3(BIO[3][0], BIO[3][1], BIO[3][2]).mul(bio.w));
    const ciano = color(0x6fe9ff); const lp = positionLocal;
    const curva = float(1).sub(smoothstep(0.0, 0.06, min(fract(alt.mul(0.11)), float(1).sub(fract(alt.mul(0.11))))));
    const grade = smoothstep(0.46, 0.5, max(abs(fract(lp.x.mul(0.5)).sub(0.5)), abs(fract(lp.z.mul(0.5)).sub(0.5))));
    const varre = float(1).sub(smoothstep(0.0, 0.6, abs(lp.x.add(R).sub(fract(time.mul(0.12)).mul(R * 2.6))))); const corte = smoothstep(U.revela.mul(R * 2.4).sub(R * 1.2).add(0.4), U.revela.mul(R * 2.4).sub(R * 1.2), lp.x.add(lp.z.mul(0.35)));
    const fundo = smoothstep(-40.0, -4.0, alt); const abismo = float(1).sub(fundo);
    const c = mix(base.mul(0.45), ciano.mul(0.32), 0.55).mul(smoothstep(-30.0, 60.0, alt).mul(1.1).add(0.35)).mul(fundo.mul(0.85).add(0.15));
    mapMat.colorNode = c.add(ciano.mul(curva).mul(1.4)).add(ciano.mul(grade).mul(0.16)).add(ciano.mul(varre).mul(0.6)).add(color(0xd94bd0).mul(abismo).mul(1.8)).mul(sin(time.mul(23.0)).mul(0.02).add(0.98));
    mapMat.opacityNode = float(0.92).mul(corte).mul(smoothstep(R - 0.05, R - 0.45, T.length(lp.xz))); mapMat.alphaTest = 0.02; } /* borda redonda e macia (sem a escada das células da grade) */
  /* marcadores: pontos de partida (pilar e losango), nós de recurso, lagos e a Fenda */
  const pilMat = new W.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: W.AdditiveBlending }); pilMat.fog = false; { const y = positionLocal.y; pilMat.colorNode = attribute('cor', 'vec3').mul(smoothstep(6.0, 0.0, y).mul(1.6)).mul(sin(time.mul(3.0)).mul(0.15).add(0.9)); } M.disp.push(pilMat);
  const losMat = new W.MeshBasicNodeMaterial(); losMat.fog = false; losMat.colorNode = attribute('cor', 'vec3').mul(1.8); M.disp.push(losMat);
  const noMat = new W.MeshBasicNodeMaterial(); noMat.fog = false; noMat.colorNode = color(0x62cdff).mul(2.2); M.disp.push(noMat);
  const fendaMat = new W.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: W.AdditiveBlending, side: W.DoubleSide }); fendaMat.fog = false;
  { const p = positionLocal.xy, r = length(p), a = T.atan(p.y, p.x); const gira = sin(a.mul(5.0).add(r.mul(2.2)).sub(time.mul(2.2))).mul(0.5).add(0.5);
    fendaMat.colorNode = mix(color(0xff3fb8), color(0x6fe9ff), gira).mul(smoothstep(2.6, 0.4, r)).mul(1.8).add(color(0xffd2b0).mul(smoothstep(0.5, 0.0, r)).mul(2.0)); fendaMat.opacityNode = smoothstep(2.6, 1.6, r); } M.disp.push(fendaMat);
  const lagoMat = new W.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: W.AdditiveBlending }); lagoMat.fog = false; lagoMat.colorNode = attribute('cor', 'vec3').mul(0.9); M.disp.push(lagoMat);
  const modeloG = new W.Group(); modeloG.position.y = 23.4; ped.add(modeloG); M.modeloG = modeloG;
  /* anel de varredura que sobe pelo modelo da Academia */
  { const m = new W.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: W.AdditiveBlending, side: W.DoubleSide }); m.fog = false; const r = length(positionLocal.xy); m.colorNode = U.cor.mul(smoothstep(0.86, 0.98, r).mul(smoothstep(1.0, 0.98, r))).mul(2.4);
    const g = new W.CircleGeometry(1, 64); M.disp.push(g, m); M.varredura = new W.Mesh(g, m); M.varredura.rotation.x = -Math.PI / 2; M.varredura.visible = false; M.varredura.renderOrder = 9; modeloG.add(M.varredura); }
  let gen = 0; M.mapa = (cfg, rapido) => { const my = ++gen; const run = () => { if (my !== gen || !S0()) return; let sim, Tt; try { sim = simDe(cfg); Tt = ARD.terrain3d.build(sim, HN); } catch (e) { console.warn('[ARD] mesa tática: ' + e.message); return; }
      if (my !== gen) return; montarMapa(sim, Tt, cfg); M.cfg = cfg; legenda(cfg, sim); if (rapido || reduced()) U.revela.value = 1; else { U.revela.value = 0; C.L.gsap.to(U.revela, { value: 1, duration: 1.6, ease: 'power2.out', onUpdate: () => ARD.sala.kick(60) }); } ARD.sala.kick(200); };
    if (rapido) run(); else (window.requestIdleCallback ? requestIdleCallback(run, { timeout: 400 }) : setTimeout(run, 30)); };
  const S0 = () => ARD.sala && ARD.sala.ctx() === st;
  function montarMapa(sim, Tt, cfg) { for (const o of holo.children.slice()) { holo.remove(o); if (o.geometry) o.geometry.dispose(); }
    const S = ARD.sim, Wd = S.WORLD, k = (R * 2) / Wd, hk = 0.045, n = Tt.HN; const P = new Float32Array(n * n * 3), A = new Float32Array(n * n), B = new Float32Array(n * n * 4); const vazio = cfg.map === 'cinturao';
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const v = j * n + i, h = Tt.heights[v]; const hc = Math.max(-60, Math.min(90, h)); P[v * 3] = (i / (n - 1) - 0.5) * R * 2; P[v * 3 + 1] = hc * hk; P[v * 3 + 2] = (j / (n - 1) - 0.5) * R * 2; A[v] = hc; for (let c = 0; c < 4; c++) B[v * 4 + c] = Tt.bio[v * 4 + c]; }
    const idx = []; for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) { const a = j * n + i, b = a + 1, c = a + n, d = c + 1; if (vazio && (Tt.heights[a] < -150 || Tt.heights[b] < -150 || Tt.heights[c] < -150 || Tt.heights[d] < -150)) continue; const cx = (i + 0.5) / (n - 1) - 0.5, cz = (j + 0.5) / (n - 1) - 0.5; if (Math.hypot(cx, cz) > 0.5 + 0.8 / (n - 1)) continue; idx.push(a, b, c, b, d, c); }
    const g = new W.BufferGeometry(); g.setAttribute('position', new W.BufferAttribute(P, 3)); g.setAttribute('alt', new W.BufferAttribute(A, 1)); g.setAttribute('bio', new W.BufferAttribute(B, 4)); g.setIndex(idx); g.computeBoundingSphere(); const mapa = new W.Mesh(g, mapMat); mapa.renderOrder = 8; holo.add(mapa); M.mapaMesh = mapa;
    const xz = (x, y) => [(x / Wd - 0.5) * R * 2, (y / Wd - 0.5) * R * 2]; const alt = (x, y) => { const gi = Math.max(0, Math.min(n - 1, Math.round(x / Wd * (n - 1)))), gj = Math.max(0, Math.min(n - 1, Math.round(y / Wd * (n - 1)))); return Math.max(-60, Math.min(90, Tt.heights[gj * n + gi])) * hk; };
    /* pilares e losangos dos pontos de partida (o seu na cor da Raça) */
    const pg = [], lg = [], cr = new W.Color(); for (const p of sim.players) { const nu = S.nucleoOf(sim, p.id); if (!nu) continue; const [x, z] = xz(nu.x, nu.y), y = alt(nu.x, nu.y); cr.setHex(p.id === 0 ? COR[cfg.race] : 0xd8dde6);
      const c = new W.CylinderGeometry(p.id === 0 ? 0.32 : 0.22, p.id === 0 ? 0.32 : 0.22, p.id === 0 ? 7 : 4.5, 10, 1, true); c.translate(x, y + (p.id === 0 ? 3.5 : 2.25), z); pintar(c, cr); pg.push(c);
      const o = new W.OctahedronGeometry(p.id === 0 ? 0.75 : 0.55, 0); o.scale(1, 1.4, 1); o.translate(x, y + (p.id === 0 ? 7.6 : 5), z); pintar(o, cr); lg.push(o); }
    if (pg.length) { holo.add(new W.Mesh(juntar(pg), pilMat)); holo.add(new W.Mesh(juntar(lg), losMat)); holo.children[holo.children.length - 2].renderOrder = 9; }
    /* nós de recurso (losangos azuis pequenos) */
    const ng = []; for (const e of sim.ents) { if (e.kind !== 'node' || !e.alive) continue; const [x, z] = xz(e.x, e.y); const o = new W.OctahedronGeometry(0.22, 0); o.translate(x, alt(e.x, e.y) + 0.45, z); ng.push(o); } if (ng.length) holo.add(new W.Mesh(juntar(ng), noMat));
    /* lagos de plasma e de gelo */
    const kg = []; for (const L of ((sim.map && sim.map.lakes) || [])) { const [x, z] = xz(L.x, L.y); const c = new W.CircleGeometry(Math.max(0.3, L.r * k), 24); c.rotateX(-Math.PI / 2); c.translate(x, alt(L.x, L.y) + 0.12, z); pintar(c, cr.setHex(L.kind === 'plasma' ? 0xff7a3a : 0x9fe4ff)); kg.push(c); } if (kg.length) { const lm = new W.Mesh(juntar(kg), lagoMat); lm.renderOrder = 9; holo.add(lm); }
    /* a Fenda no centro */
    const fg = new W.CircleGeometry(2.6, 48); fg.rotateX(-Math.PI / 2); fg.translate(0, 0.6, 0); const fm = new W.Mesh(fg, fendaMat); fm.renderOrder = 10; holo.add(fm); }
  function pintar(g, c) { const n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } g.setAttribute('cor', new W.BufferAttribute(a, 3)); for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'cor') g.deleteAttribute(k); return g; }
  function juntar(list) { list = list.map(g => g.index ? g.toNonIndexed() : g); let n = 0; for (const g of list) n += g.attributes.position.count; const P = new Float32Array(n * 3), Cc = new Float32Array(n * 3); let o = 0;
    for (const g of list) { P.set(g.attributes.position.array, o * 3); if (g.attributes.cor) Cc.set(g.attributes.cor.array, o * 3); o += g.attributes.position.count; g.dispose(); }
    const g = new W.BufferGeometry(); g.setAttribute('position', new W.BufferAttribute(P, 3)); g.setAttribute('cor', new W.BufferAttribute(Cc, 3)); g.computeBoundingSphere(); return g; }
  /* legenda na aba Jogar */
  function legenda(cfg, sim) { const el = $('mesa-txt'); if (!el) return; const S = ARD.sim; el.textContent = (S.MAPS[cfg.map] || cfg.map) + ' · ' + sim.players.length + ' bases · semente ' + cfg.seed; }
  /* lugar da mesa (na frente do Núcleo, sobre o canteiro) e cor da Raça */
  M.raca = (race, H) => { M.race = race; U.cor.value.setHex(COR[race] || COR.vehnar); const y = H(M.pos.x, M.pos.z); M.pos.y = y; ped.position.set(M.pos.x, y, M.pos.z); M.topo = y + 23.4; M.baixo = y + 19; M.centro = new W.Vector3(M.pos.x, y + 26, M.pos.z);
    const cfg = cfgAtual(race); if (!M.cfg || M.cfg.race !== race || M.cfg.map !== cfg.map || M.cfg.opp !== cfg.opp || M.cfg.seed !== cfg.seed) M.mapa(cfg, !st.ready); };
  M.visivel = on => { M.alvoVis = on ? 1 : 0; const g = C.L.gsap; if (reduced()) { ped.scale.setScalar(on ? 1 : 0.001); ped.visible = on; ARD.sala.kick(100); return; } ped.visible = true; g.to(ped.scale, { x: on ? 1 : 0.001, y: on ? 1 : 0.001, z: on ? 1 : 0.001, duration: on ? 0.9 : 0.5, ease: on ? 'back.out(1.4)' : 'power2.in', onUpdate: () => ARD.sala.kick(60), onComplete: () => { if (!on) ped.visible = false; } }); };
  M.step = (dt, t) => { if (!ped.visible) return; if (st.vivo || st.anim) { holo.rotation.y += dt * 0.07; modeloG.rotation.y += dt * 0.45; } if (M.varrendo) { M.varredura.position.y = M.varrendo.y0 + (M.varrendo.y1 - M.varrendo.y0) * M.varrendo.k; } };
  M.acerto = ray => { if (!ped.visible) return null; const alvo = M.mapaMesh && M.modo === 'mapa' ? M.mapaMesh : null; const h = alvo ? ray.intersectObject(alvo, false)[0] : null; if (h) return h; const c = ray.ray.distanceToPoint(M.centro); return c < R ? { ponto: true } : null; };
  /* Academia: o modelo da unidade/construção girando sobre a mesa */
  M.modelo = (def, race) => { const ME = ARD.meshes; for (const o of modeloG.children.slice()) { if (o === M.varredura) continue; modeloG.remove(o); o.traverse(x => { if (x.geometry) x.geometry.dispose(); }); }
    if (!def) { M.modo = 'mapa'; holo.visible = true; M.varredura.visible = false; ARD.sala.kick(200); return null; }
    const cor = (ARD.campUI && ARD.campUI.colorFor && ARD.campUI.colorFor(race)) || ((ARD.sim.RACE_SHADES || {})[race] || [])[0] || '#ff7733'; const r = ME.build(def, race, cor, 3); if (!r || !r.main) return null;
    const g = new W.Group(); const a = new W.Mesh(r.main, C.mats.main); a.castShadow = true; g.add(a); if (r.em && r.em.attributes.position.count) g.add(new W.Mesh(r.em, C.mats.em));
    const s = Math.min(20 / Math.max(r.width, 1), 15 / Math.max(r.height, 1)); g.scale.setScalar(s); modeloG.add(g); M.modo = 'modelo'; holo.visible = false; const hm = r.height * s;
    M.modeloH = hm; M.varredura.visible = true; M.varredura.scale.setScalar(Math.max(r.width * s * 0.62, 4)); M.varrendo = { y0: 0.2, y1: hm + 0.6, k: 0 };
    const gs = C.L.gsap; if (!reduced()) { g.scale.setScalar(s * 0.2); gs.to(g.scale, { x: s, y: s, z: s, duration: 0.7, ease: 'back.out(1.6)', onUpdate: () => ARD.sala.kick(60) }); gs.fromTo(M.varrendo, { k: 0 }, { k: 1, duration: 1.1, ease: 'power2.inOut', onComplete: () => { M.varredura.visible = false; M.varrendo = null; } }); }
    else { M.varredura.visible = false; M.varrendo = null; }
    ARD.sala.kick(1200); return { h: hm, w: r.width * s }; };
  /* mudanças da partida escolhida refazem o mapa (com uma varredura) */
  const refazer = () => { clearTimeout(M.tRef); M.tRef = setTimeout(() => { if (!S0()) return; const cfg = cfgAtual(M.race); if (M.cfg && M.cfg.map === cfg.map && M.cfg.opp === cfg.opp && M.cfg.seed === cfg.seed && M.cfg.race === cfg.race) return; M.mapa(cfg); }, 260); };
  M.ouvir = []; for (const id of ['opt-map', 'opt-opp', 'opt-seed']) { const el = $(id); if (!el) continue; for (const ev of ['change', 'input']) { el.addEventListener(ev, refazer); M.ouvir.push([el, ev]); } }
  M.dispose = () => { gen++; clearTimeout(M.tRef); for (const [el, ev] of M.ouvir) el.removeEventListener(ev, refazer); M.group.traverse(o => { if (o.geometry) o.geometry.dispose(); }); for (const d of M.disp) if (d && d.dispose) d.dispose(); };
  M.raca(st.race, st.H); M.visivel(st.aba === 'jogar'); if (st.aba !== 'jogar') { ped.scale.setScalar(0.001); ped.visible = false; }
  return M; }
/* ---------- câmera na mesa ("Ver na mesa" e clique) ---------- */
function aproximar(st, on) { if (!st || !st.mesa) return; on = on == null ? st.modoCam !== 'mesa' : on; ARD.sala.explorar(on, { alvo: 'mesa', de: 'mesa' }); }
/* ---------- Academia de Comando ---------- */
const CL = { inf: 'Infantaria', vei: 'Veículos', dro: 'Drones', est: 'Estruturas', sup: 'Suporte', civ: 'Civis' };
const PASSOS = [
  { t: 'Colete', d: 'Os Coletores saem do Núcleo e trazem Minério e Plasma dos nós do seu território. Sem renda não há exército: comece com mais Coletores.', def: 'coletor', tipo: 'u' },
  { t: 'Dê energia', d: 'Toda construção gasta energia. O Reator gera, a Refinaria encurta a viagem dos Coletores. Abaixo de 100% a base fica Racionada e lenta.', def: 'reator', tipo: 'b' },
  { t: 'Treine', d: 'O Quartel treina infantaria; a Fábrica e o Hangar (Era II) trazem veículos e drones. Misture as classes: cada uma vence uma e perde para outra.', def: 'quartel', tipo: 'b' },
  { t: 'Ataque', d: 'Selecione o exército e clique no inimigo. Veículos esmagam infantaria, drones caçam veículos, infantaria derruba drones. Derrube o Núcleo para vencer.', def: 'veiculo', tipo: 'u' },
];
let A = null;
function lista(race) { const S = ARD.sim; const us = []; const add = d => { if (S.UNITS[d] && !S.UNITS[d].epic && !us.includes(d)) us.push(d); }; for (const b of ['nucleo', 'quartel', 'fabrica', 'hangar']) S.producesFor(b, race).forEach(add);
  const bs = ['nucleo', 'reator', 'refinaria', 'quartel', 'fabrica', 'hangar', 'laboratorio', 'torre', 'nodulo'].filter(b => S.BUILDINGS[b]); return { u: us, b: bs }; }
const RES = { minerio: 'Minério', plasma: 'Plasma', dados: 'Dados' };
function custo(c) { const p = Object.keys(c || {}).filter(k => c[k]).map(k => '<span class="ac-c ac-' + k + '"><svg aria-hidden="true"><use href="#ic-' + k + '"/></svg>' + c[k] + ' <i>' + RES[k] + '</i></span>'); return p.length ? p.join('') : '<span class="ac-c">grátis</span>'; }
function contra(w) { if (!w || !w.versus) return { forte: [], fraco: [] }; const f = [], r = []; for (const k of ['inf', 'vei', 'dro', 'est', 'sup']) { const v = w.versus[k]; if (v >= 1.3) f.push(CL[k]); else if (v <= 0.7) r.push(CL[k]); } return { forte: f, fraco: r }; }
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function ficha(race, tipo, def) { const S = ARD.sim; if (tipo === 'u') { const u = S.UNITS[def]; const w = u.attack; const ct = contra(w); const prod = ['nucleo', 'quartel', 'fabrica', 'hangar'].find(b => S.producesFor(b, race).includes(def));
    const linhas = [['Vida', u.hp], ['Alcance', w ? w.range : (u.heal ? u.heal.range + ' (reparo)' : u.siphonRange ? u.siphonRange + ' (sifão)' : '—')], ['Dano', w ? Math.round(w.dmg / w.cd) + '/s' : '—'], ['Velocidade', u.speed], ['Sensor', u.sensor]];
    return { nome: S.unitName(race, def), sub: (CL[u.cls] || '') + (u.flying ? ' · voa' : '') + (prod ? ' · ' + S.BUILDINGS[prod].name : '') + (u.era > 1 ? ' · Era ' + S.ERAS[u.era].roman : ''), desc: u.desc, custo: custo(u.cost), linhas, forte: ct.forte, fraco: ct.fraco }; }
  const b = S.BUILDINGS[def]; const w = b.attack; const ct = contra(w); const prod = S.producesFor(def, race).filter(d => S.UNITS[d] && !S.UNITS[d].epic).map(d => S.unitName(race, d));
  const linhas = [['Vida', b.hp], ['Energia', b.energyProd ? '+' + b.energyProd : b.energyUse ? '−' + b.energyUse : '0'], ['Alcance', w ? w.range : '—'], ['Sensor', b.sensor], ['Obra', b.buildTime ? b.buildTime + ' s' : '—']];
  return { nome: b.name, sub: 'Construção' + (b.era > 1 ? ' · Era ' + S.ERAS[b.era].roman : '') + (prod.length ? ' · produz ' + prod.join(', ') : ''), desc: b.desc, custo: custo(b.cost), linhas, forte: ct.forte, fraco: ct.fraco }; }
function montarDom() { const el = document.createElement('section'); el.id = 'academia'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'ac-titulo'); el.hidden = true;
  el.innerHTML = '<div class="ac-head"><div><div class="eyebrow" id="ac-raca"></div><h2 id="ac-titulo">Academia de Comando</h2></div><button type="button" class="mclose" id="ac-close" aria-label="Fechar a Academia">✕</button></div>'
    + '<div class="ac-passos" role="tablist" aria-label="O básico em 4 passos" id="ac-passos"></div>'
    + '<div class="ac-vista" id="ac-vista" aria-hidden="true"></div>'
    + '<div class="ac-ficha" id="ac-ficha" aria-live="polite"></div>'
    + '<div class="ac-nav"><button type="button" class="btn" id="ac-prev" aria-label="Anterior">‹</button><div class="ac-tabs" role="tablist" aria-label="Catálogo"><button type="button" class="ac-tab on" data-t="u" role="tab" aria-selected="true">Unidades</button><button type="button" class="ac-tab" data-t="b" role="tab" aria-selected="false">Construções</button></div><button type="button" class="btn" id="ac-next" aria-label="Próxima">›</button></div>'
    + '<div class="ac-lista" id="ac-lista" role="listbox" aria-label="Escolha uma unidade ou construção"></div>';
  document.getElementById('start').appendChild(el); return el; }
function abrir() { const st = ARD.sala && ARD.sala.ctx(); const race = (document.querySelector('input[name=fac]:checked') || {}).value || 'vehnar'; const el = $('academia') || montarDom();
  if (!A) { A = { el, tipo: 'u', i: 0, passo: -1 }; $('ac-close').addEventListener('click', fechar); $('ac-prev').addEventListener('click', () => mover(-1)); $('ac-next').addEventListener('click', () => mover(1));
    el.querySelectorAll('.ac-tab').forEach(b => b.addEventListener('click', () => { A.tipo = b.dataset.t; A.i = 0; A.passo = -1; abas(); listar(); mostrar(); }));
    el.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); fechar(); } else if (e.key === 'ArrowRight') mover(1); else if (e.key === 'ArrowLeft') mover(-1); }); }
  A.race = race; A.L = lista(race); A.antes = document.activeElement; $('ac-raca').textContent = (ARD.sim.FACTIONS[race] || {}).name || race;
  $('ac-passos').innerHTML = PASSOS.map((p, k) => '<button type="button" class="ac-passo" role="tab" data-k="' + k + '"><b>' + (k + 1) + '</b>' + esc(p.t) + '</button>').join('');
  $('ac-passos').querySelectorAll('.ac-passo').forEach(b => b.addEventListener('click', () => passo(+b.dataset.k)));
  el.hidden = false; document.getElementById('start').classList.add('academia-on'); abas(); listar();
  if (st && st.ready) { st.modoCam = 'academia'; st.anim = !st.vivo; ARD.sala.kick(400); }
  const g = window.gsap; if (g && !reduced()) { g.fromTo(el, { x: 40, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: 0.5, ease: 'power3.out', clearProps: 'transform' }); const w = document.querySelector('#start .start-wrap'); if (w && st && st.ready) g.to(w, { autoAlpha: 0, duration: 0.4 }); }
  else { const w = document.querySelector('#start .start-wrap'); if (w && st && st.ready) w.style.visibility = 'hidden'; }
  passo(0); setTimeout(() => { const b = $('ac-passos').querySelector('.ac-passo'); if (b) b.focus(); }, 60); }
function abas() { A.el.querySelectorAll('.ac-tab').forEach(b => { const on = b.dataset.t === A.tipo; b.classList.toggle('on', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); }); }
function listar() { const S = ARD.sim; const L = A.L[A.tipo]; $('ac-lista').innerHTML = L.map((d, k) => '<button type="button" class="ac-item" role="option" data-k="' + k + '" aria-selected="false">' + esc(A.tipo === 'u' ? S.unitName(A.race, d) : S.BUILDINGS[d].name) + '</button>').join('');
  $('ac-lista').querySelectorAll('.ac-item').forEach(b => b.addEventListener('click', () => { A.i = +b.dataset.k; A.passo = -1; mostrar(); })); }
function passo(k) { const p = PASSOS[k]; A.passo = k; A.tipo = p.tipo; abas(); listar(); const L = A.L[A.tipo]; A.i = Math.max(0, L.indexOf(p.def)); mostrar(p); }
function mover(d) { const L = A.L[A.tipo]; A.i = (A.i + d + L.length) % L.length; A.passo = -1; mostrar(); }
function mostrar(p) { const L = A.L[A.tipo]; const def = L[A.i]; if (!def) return; const f = ficha(A.race, A.tipo, def); const el = $('ac-ficha');
  $('ac-passos').querySelectorAll('.ac-passo').forEach(b => { const on = +b.dataset.k === A.passo; b.classList.toggle('on', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); });
  $('ac-lista').querySelectorAll('.ac-item').forEach(b => { const on = +b.dataset.k === A.i; b.classList.toggle('on', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); });
  const html = (p ? '<div class="ac-dica"><b>Passo ' + (PASSOS.indexOf(p) + 1) + ' · ' + esc(p.t) + '</b>' + esc(p.d) + '</div>' : '') + '<h3>' + esc(f.nome) + '</h3><div class="ac-sub">' + esc(f.sub) + '</div><p>' + esc(f.desc) + '</p><div class="ac-custo">' + f.custo + '</div>'
    + '<dl class="ac-num">' + f.linhas.map(([k, v]) => '<div><dt>' + esc(k) + '</dt><dd>' + esc(v) + '</dd></div>').join('') + '</dl>'
    + (f.forte.length || f.fraco.length ? '<div class="ac-vs">' + (f.forte.length ? '<div class="forte"><span>Forte contra</span>' + f.forte.map(x => '<b>' + esc(x) + '</b>').join('') + '</div>' : '') + (f.fraco.length ? '<div class="fraco"><span>Fraco contra</span>' + f.fraco.map(x => '<b>' + esc(x) + '</b>').join('') + '</div>' : '') + '</div>' : '');
  const g = window.gsap; if (g && !reduced()) { g.killTweensOf(el); g.to(el, { autoAlpha: 0, x: -10, duration: 0.14, onComplete: () => { el.innerHTML = html; g.fromTo(el, { autoAlpha: 0, x: 14 }, { autoAlpha: 1, x: 0, duration: 0.32, ease: 'power2.out', clearProps: 'transform' }); g.fromTo(el.querySelectorAll('.ac-num>div, .ac-vs b'), { y: 6, autoAlpha: 0 }, { y: 0, autoAlpha: 1, stagger: 0.03, duration: 0.25, delay: 0.08 }); } }); } else el.innerHTML = html;
  /* o modelo 3D na mesa (com a Sala) ou a miniatura 2D */
  const st = ARD.sala && ARD.sala.ctx();
  if (st && st.ready && st.mesa) { const m = st.mesa; m.visivel(true); const r = m.modelo(def, A.race); const c = m.centro; const h = r ? r.h : 10; const port = innerWidth < innerHeight;
    const pw = A.el.getBoundingClientRect(); const anc = port ? { x: innerWidth / 2, y: Math.max(90, pw.top * 0.5) } : { x: Math.max(200, pw.left / 2), y: innerHeight * 0.5 };
    ARD.sala.voar({ tx: c.x, ty: m.topo + h * 0.5, tz: c.z, rad: Math.max(28, h * 2.6 + 14), pol: 1.2, az: 0.35, anc }, 1.3); }
  else { const S = ARD.sim; const cls = A.tipo === 'u' ? (S.UNITS[def] || {}).cls : 'est'; const ic = { inf: 'ic-inf', vei: 'ic-veic', dro: 'ic-aereo', sup: 'ic-construir', civ: 'ic-inf', est: 'ic-nucleo' }[cls] || 'ic-nucleo'; const v = $('ac-vista'); v.innerHTML = '<svg aria-hidden="true"><use href="#' + ic + '"/></svg>'; } }
function fechar() { if (!A || A.el.hidden) return; const st = ARD.sala && ARD.sala.ctx(); const g = window.gsap; const w = document.querySelector('#start .start-wrap');
  const fim = () => { A.el.hidden = true; document.getElementById('start').classList.remove('academia-on'); if (A.antes && A.antes.focus) A.antes.focus(); };
  if (st && st.mesa) { st.mesa.modelo(null); st.mesa.visivel(st.aba === 'jogar'); st.anim = false; st.modoCam = 'repouso'; ARD.sala.voltar(); }
  if (g && !reduced()) { g.to(A.el, { x: 40, autoAlpha: 0, duration: 0.35, ease: 'power2.in', onComplete: fim }); if (w) g.to(w, { autoAlpha: 1, duration: 0.45 }); } else { fim(); if (w) w.style.visibility = ''; } }
ARD.salaMesa = { criar, aproximar, sairModelo: st => { if (st && st.mesa) st.mesa.modelo(null); } };
ARD.salaAcademia = { abrir, fechar, aberta: () => !!(A && !A.el.hidden), ficha, lista };
})(globalThis.ARD = globalThis.ARD || {});
