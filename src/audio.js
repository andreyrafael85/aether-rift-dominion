/* Áudio: efeitos sintetizados em WebAudio (sem arquivos) e voz de sistema pela Web Speech API. */
(function (ARD) {
'use strict';
const A = { ctx: null, master: null, enabled: true, voice: true, inited: false, last: {}, recent: [], lastVoice: {}, voiceObj: null };
try { const p = JSON.parse(localStorage.getItem('ard-audio') || '{}'); if (p.enabled === false) A.enabled = false; if (p.voice === false) A.voice = false; } catch (e) {}
function save() { try { localStorage.setItem('ard-audio', JSON.stringify({ enabled: A.enabled, voice: A.voice })); } catch (e) {} }
A.init = function () {
  if (A.inited) return; A.inited = true;
  try { const C = window.AudioContext || window.webkitAudioContext; if (!C) return; A.ctx = new C(); A.master = A.ctx.createGain(); A.master.gain.value = 0.35; A.master.connect(A.ctx.destination); } catch (e) { A.ctx = null; }
};
A.resume = function () { if (A.ctx && A.ctx.state === 'suspended') A.ctx.resume(); };
let noiseBuf = null;
function noise(dur, o) {
  const c = A.ctx; if (!noiseBuf) { noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const t0 = c.currentTime + (o.delay || 0); /* 4.3h: atraso (trovão longe) */ const src = c.createBufferSource(); src.buffer = noiseBuf; const f = c.createBiquadFilter(); f.type = o.type || 'lowpass'; f.frequency.setValueAtTime(o.freq || 800, t0); if (o.sweep) f.frequency.exponentialRampToValueAtTime(o.sweep, t0 + dur); f.Q.value = o.q || 0.7;
  const g = c.createGain(); g.gain.setValueAtTime(o.gain || 0.3, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  src.connect(f); f.connect(g); g.connect(A.master); src.start(t0); src.stop(t0 + dur + 0.05);
}
function tone(freq, dur, o) {
  const c = A.ctx; o = o || {}; const osc = c.createOscillator(); osc.type = o.type || 'sine'; osc.frequency.setValueAtTime(freq, c.currentTime + (o.delay || 0));
  if (o.slide) osc.frequency.exponentialRampToValueAtTime(o.slide, c.currentTime + (o.delay || 0) + dur);
  const g = c.createGain(); g.gain.setValueAtTime(0.0001, c.currentTime + (o.delay || 0)); g.gain.exponentialRampToValueAtTime(o.gain || 0.2, c.currentTime + (o.delay || 0) + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + (o.delay || 0) + dur);
  osc.connect(g); g.connect(A.master); osc.start(c.currentTime + (o.delay || 0)); osc.stop(c.currentTime + (o.delay || 0) + dur + 0.05);
}
const MIN_GAP = { shot_light: 60, shot_heavy: 90, beam: 120, impact: 70, explosion: 120, build: 300, spawn: 300, alert: 800, danger: 1200, promote: 500, click: 40, siphon: 600, storm: 3000, thunder: 600, pact: 1000, betrayal: 1000 };
A.sfx = function (name, vol, delay) {
  if (!A.enabled || !A.ctx) return; A.resume(); vol = vol == null ? 1 : Math.max(0, Math.min(1, vol)); if (vol < 0.03) return;
  const now = performance.now(); if (A.last[name] && now - A.last[name] < (MIN_GAP[name] || 50)) return;
  A.recent = A.recent.filter(t => now - t < 100); if (A.recent.length > 10) return; A.recent.push(now); A.last[name] = now;
  const v = vol;
  switch (name) {
    case 'shot_light': tone(900, 0.05, { type: 'square', gain: 0.08 * v, slide: 300 }); break;
    case 'shot_heavy': noise(0.14, { freq: 500, sweep: 120, gain: 0.35 * v }); tone(90, 0.12, { type: 'triangle', gain: 0.25 * v, slide: 45 }); break;
    case 'beam': tone(1400, 0.16, { type: 'sawtooth', gain: 0.08 * v, slide: 380 }); break;
    case 'impact': noise(0.22, { freq: 900, sweep: 150, gain: 0.3 * v }); tone(70, 0.15, { type: 'sine', gain: 0.25 * v, slide: 40 }); break;
    case 'explosion': noise(0.7, { freq: 420, sweep: 50, gain: 0.6 * v }); tone(55, 0.5, { type: 'sine', gain: 0.4 * v, slide: 28 }); break;
    case 'build': tone(520, 0.09, { gain: 0.15 }); tone(780, 0.14, { gain: 0.15, delay: 0.1 }); break;
    case 'spawn': tone(660, 0.07, { gain: 0.12 }); tone(880, 0.1, { gain: 0.12, delay: 0.08 }); break;
    case 'alert': for (let i = 0; i < 3; i++) tone(700, 0.12, { type: 'square', gain: 0.1, delay: i * 0.18, slide: 520 }); break;
    case 'danger': for (let i = 0; i < 2; i++) tone(320, 0.3, { type: 'sawtooth', gain: 0.12, delay: i * 0.35, slide: 200 }); break;
    case 'promote': [523, 659, 784].forEach((f, i) => tone(f, 0.12, { gain: 0.12, delay: i * 0.09 })); break;
    case 'click': tone(1200, 0.03, { type: 'square', gain: 0.05 }); break;
    case 'siphon': tone(180, 0.5, { type: 'triangle', gain: 0.1 * v, slide: 240 }); break;
    case 'storm': noise(1.4, { freq: 260, sweep: 90, gain: 0.35 }); break;
    case 'thunder': { const dl = Math.max(0, Math.min(2.5, delay || 0)); noise(0.22, { freq: 2600, sweep: 700, gain: 0.22 * v, delay: dl }); noise(2.4, { freq: 210, sweep: 45, gain: 0.5 * v, delay: dl + 0.04 }); tone(44, 1.6, { type: 'sine', gain: 0.16 * v, slide: 30, delay: dl }); break; } /* 4.3h: estalo e ronco do raio, atrasados pela distância */
    case 'pact': [440, 554, 659].forEach((f, i) => tone(f, 0.25, { gain: 0.1, delay: i * 0.05 })); break;
    case 'betrayal': tone(220, 0.5, { type: 'sawtooth', gain: 0.14, slide: 110 }); tone(233, 0.5, { type: 'sawtooth', gain: 0.1, slide: 116 }); break;
  }
};
function pickVoice() {
  if (!('speechSynthesis' in window)) return null; const vs = speechSynthesis.getVoices(); if (!vs.length) return null;
  return vs.find(v => /pt[-_]BR/i.test(v.lang)) || vs.find(v => /^pt/i.test(v.lang)) || vs[0];
}
/* 5.0b: gancho de palavras da voz: o evento 'ard-voz' no window traz { tipo: 'inicio' | 'palavra' | 'fim', texto, i, n } (posição e tamanho da palavra,
   do evento boundary do speechSynthesis); a Sala de Comando mexe a boca do líder com ele */
function voiceHook(u, text) { const ev = (tipo, i, n) => { try { window.dispatchEvent(new CustomEvent('ard-voz', { detail: { tipo, texto: text, i: i || 0, n: n || 0 } })); } catch (e) {} };
  u.onstart = () => ev('inicio'); u.onboundary = e => { if (!e.name || e.name === 'word') ev('palavra', e.charIndex, e.charLength); }; u.onend = () => ev('fim'); u.onerror = () => ev('fim'); }
A.say = function (text, key, cooldown) {
  if (!A.voice || !('speechSynthesis' in window)) return; const now = performance.now(); key = key || text; cooldown = cooldown == null ? 6 : cooldown;
  if (A.lastVoice[key] && now - A.lastVoice[key] < cooldown * 1000) return; A.lastVoice[key] = now;
  try { if (speechSynthesis.pending && speechSynthesis.speaking) return; const u = new SpeechSynthesisUtterance(text); const v = pickVoice(); if (v) u.voice = v; u.lang = 'pt-BR'; u.rate = 1.05; u.pitch = 0.85; u.volume = 0.9; voiceHook(u, text); /* 5.0b */ speechSynthesis.speak(u); } catch (e) {}
};
A.setEnabled = function (on) { A.enabled = on; save(); }; A.setVoice = function (on) { A.voice = on; save(); if (!on && 'speechSynthesis' in window) speechSynthesis.cancel(); };
/* 5.0b: legendas — cada fala da voz do sistema também vai para A.onSay(texto), que a Interface 3.0 mostra em texto com o retrato do
   líder (mesmo com a voz desligada); o mesmo intervalo por chave da fala evita repetir a legenda */
{ const say0 = A.say, lastCap = {}; A.onSay = null; A.say = function (text, key, cooldown) { if (A.onSay) { const now = performance.now(), k = key || text, cd = cooldown == null ? 6 : cooldown; if (!(lastCap[k] && now - lastCap[k] < cd * 1000)) { lastCap[k] = now; try { A.onSay(text, k); } catch (e) {} } } return say0.call(A, text, key, cooldown); }; }
ARD.audio = A;
})(globalThis.ARD = globalThis.ARD || {});
