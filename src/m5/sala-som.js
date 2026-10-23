/* Aether Rift: Dominion — Sala de Comando (5.0b): ambiente sonoro 3D da tela inicial, só com Web Audio (nenhum arquivo de áudio).
   O ouvinte fica preso à câmera (posição e orientação a cada quadro); a Fenda zumbe no lugar dela, a base da Raça tem o seu som no Núcleo
   (fundição, vento frio, bolhas, acorde de cristal, chiado do enxame) e os cliques da interface soam com posição (à esquerda ou à direita,
   pelo lugar do botão na tela). Usa o mesmo AudioContext do src/audio.js, respeita A.enabled e só começa depois de um gesto do jogador.
   HRTF no computador, panorâmica simples no toque. parar() desliga e solta tudo. */
(function (ARD) {
'use strict';
let S = null;
const coarse = () => { try { return matchMedia('(pointer: coarse)').matches; } catch (e) { return false; } };
function setP(n, x, y, z) { if (n.positionX) { n.positionX.value = x; n.positionY.value = y; n.positionZ.value = z; } else n.setPosition(x, y, z); }
function panner(AC, dest, rev, x, y, z, ref) { const p = AC.createPanner(); p.panningModel = coarse() ? 'equalpower' : 'HRTF'; p.distanceModel = 'inverse'; p.refDistance = ref; p.rolloffFactor = 1.1; p.maxDistance = 4000; setP(p, x, y, z); p.connect(dest); if (rev) p.connect(rev); return p; }
/* reverberação gerada no navegador (ruído com decaimento) */
function ir(AC, sec, decay) { const r = AC.sampleRate, n = Math.floor(r * sec), b = AC.createBuffer(2, n, r); for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay); } return b; }
function ruido(AC) { const b = AC.createBuffer(1, AC.sampleRate * 2, AC.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; }
function osc(AC, type, f, dest, det, list) { const o = AC.createOscillator(); o.type = type; o.frequency.value = f; if (det) o.detune.value = det; o.connect(dest); o.start(); (list || S.src).push(o); return o; }
function fonteRuido(AC, dest, list) { const s = AC.createBufferSource(); s.buffer = S.nbuf; s.loop = true; s.connect(dest); s.start(); (list || S.src).push(s); return s; }
/* a Fenda: três serras graves num passa-baixa que respira (LFO) e um sopro de ruído */
const osc0 = (...a) => osc(...a), fonte0 = (...a) => fonteRuido(...a);
function fenda(AC, pos) { const p = panner(AC, S.bus, S.send, pos.x, pos.y, pos.z, 60); const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 300; lp.Q.value = 6; const g = AC.createGain(); g.gain.value = 0.26; lp.connect(g); g.connect(p);
  [55, 82.4, 110.3].forEach((f, k) => osc(AC, k === 2 ? 'triangle' : 'sawtooth', f, lp, (k - 1) * 7)); const lfo = osc(AC, 'sine', 0.07, AC.createGain()); const lg = AC.createGain(); lg.gain.value = 170; lfo.disconnect(); lfo.connect(lg); lg.connect(lp.frequency);
  const bp = AC.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 700; bp.Q.value = 0.8; const wg = AC.createGain(); wg.gain.value = 0.06; fonteRuido(AC, bp); bp.connect(wg); wg.connect(p); S.fendaP = p; }
/* a base: um "patch" por Raça, posicionado no Núcleo; trocar de Raça cruza os dois */
function base(AC, race, pos) { const out = AC.createGain(); out.gain.value = 0; const p = panner(AC, S.bus, S.send, pos.x, pos.y + 20, pos.z, 40); out.connect(p); const nodes = []; const timers = [];
  const add = n => { if (!nodes.includes(n)) nodes.push(n); return n; }; const osc = (AC2, t, f, d, det) => osc0(AC2, t, f, d, det, nodes); const fonteRuido = (AC2, d) => fonte0(AC2, d, nodes);
  if (race === 'vehnar') { const lp = add(AC.createBiquadFilter()); lp.type = 'lowpass'; lp.frequency.value = 140; const g = add(AC.createGain()); g.gain.value = 0.5; lp.connect(g); g.connect(out); add(osc(AC, 'sawtooth', 41, lp)); add(osc(AC, 'sawtooth', 61.5, lp, 9));
    const bp = add(AC.createBiquadFilter()); bp.type = 'bandpass'; bp.frequency.value = 1900; bp.Q.value = 3; const cg = add(AC.createGain()); cg.gain.value = 0; fonteRuido(AC, bp); bp.connect(cg); cg.connect(out);
    timers.push(setInterval(() => { if (!S) return; const t = AC.currentTime + 0.02; cg.gain.cancelScheduledValues(t); cg.gain.setValueAtTime(0.0001, t); cg.gain.exponentialRampToValueAtTime(0.5, t + 0.01); cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.18); }, 940)); }
  else if (race === 'erevane') { const hp = add(AC.createBiquadFilter()); hp.type = 'highpass'; hp.frequency.value = 2400; const g = add(AC.createGain()); g.gain.value = 0.05; fonteRuido(AC, hp); hp.connect(g); g.connect(out);
    const g2 = add(AC.createGain()); g2.gain.value = 0.05; g2.connect(out); add(osc(AC, 'sine', 330, g2)); add(osc(AC, 'sine', 494.9, g2, 6)); const v = add(osc(AC, 'sine', 0.18, AC.createGain())); const vg = add(AC.createGain()); vg.gain.value = 0.03; v.disconnect(); v.connect(vg); vg.connect(g2.gain); }
  else if (race === 'tessara') { const g = add(AC.createGain()); g.gain.value = 0.12; g.connect(out); add(osc(AC, 'triangle', 73.4, g)); add(osc(AC, 'sine', 110, g, -5));
    timers.push(setInterval(() => { if (!S || Math.random() < 0.35) return; const t = AC.currentTime + 0.01, o = AC.createOscillator(), gg = AC.createGain(); o.frequency.setValueAtTime(500 + Math.random() * 700, t); o.frequency.exponentialRampToValueAtTime(900 + Math.random() * 900, t + 0.08); gg.gain.setValueAtTime(0.0001, t); gg.gain.exponentialRampToValueAtTime(0.09, t + 0.01); gg.gain.exponentialRampToValueAtTime(0.0001, t + 0.12); o.connect(gg); gg.connect(out); o.start(t); o.stop(t + 0.14); }, 380)); }
  else if (race === 'quorith') { [523.3, 659.3, 784, 1046.5].forEach((f, k) => { const g = add(AC.createGain()); g.gain.value = 0.03; g.connect(out); add(osc(AC, 'sine', f, g, (k - 1.5) * 4)); const l = add(osc(AC, 'sine', 0.11 + k * 0.07, AC.createGain())); const lg = add(AC.createGain()); lg.gain.value = 0.026; l.disconnect(); l.connect(lg); lg.connect(g.gain); }); }
  else { const bp = add(AC.createBiquadFilter()); bp.type = 'bandpass'; bp.frequency.value = 2600; bp.Q.value = 2; const g = add(AC.createGain()); g.gain.value = 0.0; fonteRuido(AC, bp); bp.connect(g); g.connect(out);
    const am = add(osc(AC, 'square', 17, AC.createGain())); const ag = add(AC.createGain()); ag.gain.value = 0.05; am.disconnect(); am.connect(ag); ag.connect(g.gain);
    const lp = add(AC.createBiquadFilter()); lp.type = 'lowpass'; lp.frequency.value = 180; const b = add(AC.createGain()); b.gain.value = 0.18; fonteRuido(AC, lp); lp.connect(b); b.connect(out); const br = add(osc(AC, 'sine', 0.22, AC.createGain())); const bg = add(AC.createGain()); bg.gain.value = 0.14; br.disconnect(); br.connect(bg); bg.connect(b.gain); }
  out.gain.linearRampToValueAtTime(0.0001, AC.currentTime); out.gain.linearRampToValueAtTime(1, AC.currentTime + 1.6); return { out, p, nodes, timers }; }
function soltar(b) { if (!b) return; const AC = S && S.AC; for (const t of b.timers) clearInterval(t); try { if (AC) { b.out.gain.cancelScheduledValues(AC.currentTime); b.out.gain.setValueAtTime(b.out.gain.value, AC.currentTime); b.out.gain.linearRampToValueAtTime(0.0001, AC.currentTime + 0.9); } } catch (e) {}
  setTimeout(() => { for (const n of b.nodes) { try { if (n.stop) n.stop(); } catch (e) {} try { n.disconnect(); } catch (e) {} } try { b.out.disconnect(); b.p.disconnect(); } catch (e) {} }, 1000); }
/* começa (depois de um gesto): o = { fenda: {x,y,z}, nucleo: {x,y,z}, race } */
function iniciar(o) { const A = ARD.audio; if (S || !A || !A.enabled) return false; if (!A.ctx) A.init(); const AC = A.ctx; if (!AC) return false; A.resume();
  S = { AC, src: [], nbuf: ruido(AC), on: true, race: o.race, pos: o };
  const comp = AC.createDynamicsCompressor(); comp.connect(AC.destination); S.comp = comp; S.bus = AC.createGain(); S.bus.gain.value = 0; S.bus.connect(comp);
  const conv = AC.createConvolver(); conv.buffer = ir(AC, 2.6, 2.3); S.send = AC.createGain(); S.send.gain.value = 0.3; S.send.connect(conv); conv.connect(comp); S.conv = conv;
  fenda(AC, o.fenda); S.base = base(AC, o.race, o.nucleo); S.bus.gain.setValueAtTime(0.0001, AC.currentTime); S.bus.gain.linearRampToValueAtTime(0.7, AC.currentTime + 2.5); return true; }
const fw = { x: 0, y: 0, z: -1 }, up = { x: 0, y: 1, z: 0 };
function ouvir(cam) { if (!S || !cam) return; const L = S.AC.listener, e = cam.matrixWorld.elements; fw.x = -e[8]; fw.y = -e[9]; fw.z = -e[10]; up.x = e[4]; up.y = e[5]; up.z = e[6]; const p = cam.position;
  if (L.positionX) { L.positionX.value = p.x; L.positionY.value = p.y; L.positionZ.value = p.z; L.forwardX.value = fw.x; L.forwardY.value = fw.y; L.forwardZ.value = fw.z; L.upX.value = up.x; L.upY.value = up.y; L.upZ.value = up.z; }
  else { L.setPosition(p.x, p.y, p.z); L.setOrientation(fw.x, fw.y, fw.z, up.x, up.y, up.z); } }
function raca(race, nucleo) { if (!S || race === S.race) return; S.race = race; soltar(S.base); S.base = base(S.AC, race, nucleo || S.pos.nucleo); }
/* som curto num lugar do mundo (pulso na Fenda, foco numa construção) ou na tela (clique de interface) */
function um(pos, build, dur) { if (!S || !ARD.audio || !ARD.audio.enabled) return; const p = panner(S.AC, S.bus, S.send, pos.x, pos.y, pos.z, 26); build(p, S.AC.currentTime); setTimeout(() => { try { p.disconnect(); } catch (e) {} }, dur * 1000 + 400); }
function pulso(pos) { um(pos, (p, t) => { const AC = S.AC, o = AC.createOscillator(), g = AC.createGain(); o.frequency.setValueAtTime(190, t); o.frequency.exponentialRampToValueAtTime(38, t + 0.7); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.9, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9); o.connect(g); g.connect(p); o.start(t); o.stop(t + 1);
  const s = AC.createBufferSource(); s.buffer = S.nbuf; const f = AC.createBiquadFilter(), ng = AC.createGain(); f.type = 'lowpass'; f.frequency.setValueAtTime(2400, t); f.frequency.exponentialRampToValueAtTime(120, t + 0.5); ng.gain.setValueAtTime(0.5, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.55); s.connect(f); f.connect(ng); ng.connect(p); s.start(t); s.stop(t + 0.6); }, 1.2); }
function foco(pos) { um(pos, (p, t) => { [660, 990].forEach((fr, k) => { const AC = S.AC, o = AC.createOscillator(), g = AC.createGain(); o.type = 'triangle'; o.frequency.value = fr; g.gain.setValueAtTime(0.0001, t + k * 0.08); g.gain.exponentialRampToValueAtTime(0.25, t + k * 0.08 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + k * 0.08 + 0.35); o.connect(g); g.connect(p); o.start(t + k * 0.08); o.stop(t + k * 0.08 + 0.4); }); }, 0.7); }
/* clique de interface: o botão à esquerda soa à esquerda (posição na frente da câmera, deslocada pela coluna do botão) */
function clique(cam, sx, tipo) { if (!S || !cam) return; const e = cam.matrixWorld.elements, k = Math.max(-1, Math.min(1, sx / innerWidth * 2 - 1)) * 22, p = cam.position;
  const pos = { x: p.x - e[8] * 30 + e[0] * k, y: p.y - e[9] * 30 + e[1] * k, z: p.z - e[10] * 30 + e[2] * k };
  um(pos, (pn, t) => { const AC = S.AC, o = AC.createOscillator(), g = AC.createGain(); o.type = tipo === 'raca' ? 'triangle' : 'square'; o.frequency.setValueAtTime(tipo === 'raca' ? 520 : 1250, t); if (tipo === 'raca') o.frequency.exponentialRampToValueAtTime(880, t + 0.12);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(tipo === 'raca' ? 0.2 : 0.07, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + (tipo === 'raca' ? 0.22 : 0.05)); o.connect(g); g.connect(pn); o.start(t); o.stop(t + 0.25); }, 0.3); }
/* voo de câmera: um sopro que sobe e desce */
function voo(cam) { if (!S || !cam) return; const p = cam.position; um({ x: p.x, y: p.y + 8, z: p.z }, (pn, t) => { const AC = S.AC, s = AC.createBufferSource(); s.buffer = S.nbuf; const f = AC.createBiquadFilter(), g = AC.createGain(); f.type = 'bandpass'; f.Q.value = 1.2; f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(2200, t + 1.0); f.frequency.exponentialRampToValueAtTime(260, t + 2.2);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.28, t + 0.8); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4); s.connect(f); f.connect(g); g.connect(pn); s.start(t); s.stop(t + 2.5); }, 2.6); }
function ligado(on) { if (!S) return; const AC = S.AC; try { S.bus.gain.cancelScheduledValues(AC.currentTime); S.bus.gain.setValueAtTime(S.bus.gain.value, AC.currentTime); S.bus.gain.linearRampToValueAtTime(on ? 0.7 : 0.0001, AC.currentTime + (on ? 1.2 : 0.4)); } catch (e) {} }
function parar() { if (!S) return; const s = S; S = null; soltar(s.base); for (const n of s.src) { try { n.stop(); } catch (e) {} try { n.disconnect(); } catch (e) {} } try { s.bus.disconnect(); s.send.disconnect(); s.conv.disconnect(); s.comp.disconnect(); if (s.fendaP) s.fendaP.disconnect(); } catch (e) {} }
ARD.salaSom = { iniciar, ouvir, raca, pulso, foco, clique, voo, ligado, parar, ativo: () => !!S };
})(globalThis.ARD = globalThis.ARD || {});
