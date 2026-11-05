/* Aether Rift: Dominion — 5.0f: trilha adaptativa gerada no navegador (Web Audio, nenhum arquivo de áudio).
   Um tema por Raça (tom, modo, andamento, timbres e motivo próprios) e cinco camadas do mesmo laço de 4 compassos: paz, tensão, batalha, chefão
   e cinema, mais dois finais (vitória e derrota). Cada camada é gravada uma vez num OfflineAudioContext (24 kHz; mono no celular e na Baixa),
   com a cauda dobrada no começo (o laço emenda sem corte) e o volume médio nivelado; na partida as camadas tocam juntas, presas ao mesmo
   relógio, e só os ganhos mudam: nenhum nó novo por nota nem por evento. A gravação começa depois da tela de carregamento, uma camada por vez.
   O estado da partida escolhe a mistura (só leitura dos eventos que o renderizador já recebe):
     calor = disparos e mortes que envolvem o jogador (cai pela metade em ~5 s); base = alerta de base ou Núcleo sob ataque, construção perdida;
     era = a do jogador (a Era II e a III já trazem um pouco da tensão); chefão = muito calor com a Era III, o Núcleo atacado ou a superarma;
     vitória e derrota = o fim da partida (o final da Raça e depois silêncio).
   A música abaixa sob a fala (vozes gravadas e a do sistema: src/som3d.js) e tem liga/desliga e volume próprios (Ajustes).
   Cenas (agente do cinema): ARD.musica.cena(nome, o) troca para a camada "cinema" da Raça (o.raca, ou a da partida, ou a da tela inicial):
     nome = 'calma' | 'briefing' (cinema com um fundo de paz), 'tensa' (cinema com tensão), 'epica' (cinema com batalha), 'vitoria' | 'derrota'
     (o final e o cinema baixo), 'abertura' (só o cinema), 'chefao' (+ chefão), 'superarma' (+ batalha), 'sala-guerra' (+ tensão);
     nome desconhecido = nada muda; ARD.musica.cena(null) volta para a música do estado da partida. Devolve true.
   Chaves de URL: ?musica=0 (sem música, nada é gravado), ?musica=<paz|tensao|batalha|chefao|cinema> (prende a camada, para comparar e gravar). */
(function (ARD) {
'use strict';
const par = k => { try { return new URLSearchParams(location.search).get(k); } catch (e) { return null; } };
const CHAVE = par('musica'); const LIGADA = CHAVE !== '0';
const A = () => ARD.audio || null;
const UA = () => (typeof navigator !== 'undefined' && navigator.userAgent) || '';
const toque = () => { try { return /iPhone|iPad|iPod/.test(UA()) || (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches); } catch (e) { return false; } };
const SR = 24000, CAUDA = 2.5;
const CAMADAS = ['paz', 'tensao', 'batalha', 'chefao', 'cinema'], FINAIS = ['vitoria', 'derrota'];
const MONO = ['tensao', 'chefao']; /* camadas quase sem imagem estéreo (baixo, tambores, zumbido): mono, metade da memória */
const ALVO_DB = { paz: -27, tensao: -29, batalha: -24, chefao: -24, cinema: -25, vitoria: -22, derrota: -24 }; /* volume médio de cada camada sozinha (dBFS) */
const hz = m => 440 * Math.pow(2, (m - 69) / 12);

/* ---------- as Raças: tom, modo, andamento, progressão (graus por compasso), motivo (passo de 16 avos, grau, duração) e timbres ---------- */
const RACAS = {
  vehnar: { bpm: 96, tom: 38, escala: [0, 2, 3, 5, 7, 8, 10], prog: [0, 5, 3, 6], /* Ré menor eólio: i–VI–iv–VII, forja */
    tema: [[0, 0, 3], [3, 2, 1], [4, 4, 4], [8, 3, 2], [10, 2, 2], [12, 0, 4], [16, 5, 6], [22, 4, 2], [24, 2, 8], [32, 3, 3], [35, 4, 1], [36, 5, 4], [40, 4, 2], [42, 3, 2], [44, 2, 4], [48, 6, 4], [52, 4, 4], [56, 1, 4], [60, 0, 4]],
    pad: { tipo: 'sawtooth', det: 9, lp: 900, a: 0.5, v: 0.13 }, arp: { inst: 'pluck', tipo: 'square', lp: 1300, dec: 0.22 }, arpPadrao: [0, 3, 6, 8, 11, 14], baixo: { tipo: 'sawtooth', lp: 420 }, lead: { tipo: 'sawtooth', lp: 2000, v: 0.16 }, metal: 'bigorna', ost: [0, 0, 7, 0, 4, 0, 7, 4] },
  erevane: { bpm: 84, tom: 40, escala: [0, 2, 3, 5, 7, 9, 10], prog: [0, 6, 3, 4], /* Mi dórico: i–VII–IV–v, gelo e vento */
    tema: [[0, 4, 4], [4, 3, 2], [6, 2, 2], [8, 0, 8], [16, 1, 4], [20, 2, 4], [24, 4, 8], [32, 5, 4], [36, 4, 2], [38, 3, 2], [40, 2, 8], [48, 0, 4], [52, 1, 4], [56, -1, 8]],
    pad: { tipo: 'triangle', det: 7, lp: 2600, a: 1.0, v: 0.16 }, arp: { inst: 'sino', dec: 1.2 }, arpPadrao: [0, 6, 10], baixo: { tipo: 'sine', lp: 600 }, lead: { tipo: 'sine', lp: 4000, v: 0.2, vib: 1 }, metal: 'vento', ost: [0, 7, 4, 7, 0, 7, 9, 7] },
  tessara: { bpm: 90, tom: 45, escala: [0, 2, 3, 5, 7, 9, 10], prog: [0, 3, 5, 4], /* Lá dórico: madeira, bolhas, o que cresce */
    tema: [[0, 0, 2], [2, 2, 2], [4, 4, 2], [6, 5, 2], [8, 4, 4], [12, 2, 4], [16, 3, 2], [18, 4, 2], [20, 5, 4], [24, 7, 4], [28, 5, 4], [32, 4, 2], [34, 2, 2], [36, 0, 4], [40, 2, 2], [42, 4, 2], [44, 3, 4], [48, 1, 2], [50, 2, 2], [52, 4, 4], [56, 0, 8]],
    pad: { tipo: 'triangle', det: 12, lp: 1500, a: 0.7, v: 0.14 }, arp: { inst: 'marimba', dec: 0.5 }, arpPadrao: [0, 2, 4, 7, 9, 12, 14], baixo: { tipo: 'triangle', lp: 700 }, lead: { tipo: 'triangle', lp: 2600, v: 0.2 }, metal: 'bolha', ost: [0, 4, 0, 7, 0, 4, 9, 7] },
  quorith: { bpm: 72, tom: 36, escala: [0, 2, 4, 6, 7, 9, 11], prog: [0, 1, 5, 4], /* Dó lídio: coro de cristal, sinos */
    tema: [[0, 4, 6], [6, 5, 2], [8, 6, 8], [16, 7, 6], [22, 6, 2], [24, 4, 8], [32, 2, 6], [38, 3, 2], [40, 4, 8], [48, 5, 4], [52, 4, 4], [56, 0, 8]],
    pad: { tipo: 'sine', det: 5, lp: 3500, a: 1.2, v: 0.22, coro: 1 }, arp: { inst: 'sino', dec: 1.6 }, arpPadrao: [0, 4, 8, 12], baixo: { tipo: 'sine', lp: 500 }, lead: { tipo: 'sine', lp: 5000, v: 0.2, vib: 1 }, metal: 'brilho', ost: [0, 4, 7, 11, 7, 4, 0, 4] },
  vorag: { bpm: 110, tom: 37, escala: [0, 1, 3, 5, 7, 8, 10], prog: [0, 1, 0, 6], /* Dó# frígio: i–bII–i–bVII, enxame */
    tema: [[0, 0, 2], [2, 0, 1], [3, 1, 3], [6, 0, 2], [8, 3, 4], [12, 1, 4], [16, 0, 2], [18, 0, 1], [19, 1, 3], [22, 4, 2], [24, 3, 8], [32, 0, 2], [34, 0, 1], [35, 1, 3], [38, 0, 2], [40, 6, 4], [44, 4, 4], [48, 3, 2], [50, 1, 2], [52, 0, 12]],
    pad: { tipo: 'sawtooth', det: 18, lp: 520, a: 0.4, v: 0.13 }, arp: { inst: 'pluck', tipo: 'square', lp: 900, dec: 0.12 }, arpPadrao: [0, 2, 3, 6, 8, 10, 11, 14], baixo: { tipo: 'square', lp: 300 }, lead: { tipo: 'square', lp: 1300, v: 0.12 }, metal: 'enxame', ost: [0, 0, 1, 0, 0, 0, 7, 1] } };

/* ---------- instrumentos (num contexto qualquer: aqui, sempre o OfflineAudioContext da gravação) ---------- */
let RU = null; function ruido(c) { if (RU && RU.sampleRate === c.sampleRate) return RU; const n = c.sampleRate * 2, b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0); let s = 77; for (let i = 0; i < n; i++) { s = (s * 1103515245 + 12345) >>> 0; d[i] = s / 2147483648 - 1; } return (RU = b); }
function painel(c, d, x) { if (!x || !c.createStereoPanner) return d; const p = c.createStereoPanner(); p.pan.value = x; p.connect(d); return p; }
function ganho(c, d, t, a, pico, fim, rel) { const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, pico), t + a); g.gain.setValueAtTime(Math.max(0.0002, pico), Math.max(t + a, fim)); g.gain.exponentialRampToValueAtTime(0.0001, Math.max(t + a, fim) + rel); g.connect(d); return g; }
function decai(c, d, t, pico, dec, a) { const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, pico), t + (a || 0.004)); g.gain.exponentialRampToValueAtTime(0.0001, t + (a || 0.004) + dec); g.connect(d); return g; }
function osc(c, tipo, f, t, fim, d, det) { const o = c.createOscillator(); o.type = tipo; o.frequency.value = f; if (det) o.detune.value = det; o.connect(d); o.start(t); o.stop(fim); return o; }
function fonteR(c, t, fim, d) { const s = c.createBufferSource(); s.buffer = ruido(c); s.loop = true; s.loopStart = (t * 7.3) % 1.5; s.connect(d); s.start(t, (t * 3.1) % 1.5); s.stop(fim); return s; }
function filtro(c, tipo, f, q, d) { const b = c.createBiquadFilter(); b.type = tipo; b.frequency.value = f; b.Q.value = q || 0.7; b.connect(d); return b; }
const INST = {
  pad(c, d, t, dur, fs, o, v) { const rel = 1.2, ps = [-0.45, 0.45, -0.15, 0.15, 0];
    fs.forEach((f, k) => { const g = ganho(c, painel(c, d, ps[k % ps.length]), t, o.a, (o.v * (v || 1)) / Math.sqrt(fs.length), t + dur, rel), lp = filtro(c, 'lowpass', o.lp * 0.55, 0.7, g); lp.frequency.setValueAtTime(o.lp * 0.55, t); lp.frequency.linearRampToValueAtTime(o.lp, t + Math.min(dur, o.a * 2 + 0.5));
      const dst = o.coro ? (() => { const b1 = filtro(c, 'bandpass', 720, 3, lp), b2 = filtro(c, 'bandpass', 1180, 4, lp), m = c.createGain(); m.gain.value = 2.2; m.connect(b1); m.connect(b2); return m; })() : lp;
      const tipo = o.coro ? 'sawtooth' : o.tipo; osc(c, tipo, f, t, t + dur + rel + 0.1, dst, -o.det); osc(c, tipo, f, t, t + dur + rel + 0.1, dst, o.det); if (o.coro) osc(c, 'sine', f, t, t + dur + rel + 0.1, lp, 0); }); },
  pluck(c, d, t, f, v, o, x) { const g = decai(c, painel(c, d, x), t, v * 0.22, o.dec), lp = filtro(c, 'lowpass', o.lp * 4, 1.2, g); lp.frequency.setValueAtTime(o.lp * 4, t); lp.frequency.exponentialRampToValueAtTime(o.lp, t + 0.12); osc(c, o.tipo || 'square', f, t, t + o.dec + 0.1, lp); },
  sino(c, d, t, f, v, o, x) { const p = painel(c, d, x); [[1, 1, 0.22], [2.76, 0.5, 0.09], [5.4, 0.3, 0.04]].forEach(([m, dk, a]) => { if (f * m < SR / 2 - 500) osc(c, 'sine', f * m, t, t + o.dec * dk + 0.1, decai(c, p, t, v * a, o.dec * dk)); }); },
  marimba(c, d, t, f, v, o, x) { const p = painel(c, d, x); osc(c, 'sine', f, t, t + o.dec + 0.1, decai(c, p, t, v * 0.26, o.dec)); osc(c, 'sine', f * 4, t, t + 0.12, decai(c, p, t, v * 0.06, 0.06)); osc(c, 'triangle', f * 2, t, t + 0.3, decai(c, p, t, v * 0.05, 0.2)); },
  baixo(c, d, t, f, dur, v, o) { const g = ganho(c, d, t, 0.006, v * 0.3, t + dur * 0.92, 0.08), lp = filtro(c, 'lowpass', o.lp * 2.4, 2, g); lp.frequency.setValueAtTime(o.lp * 2.4, t); lp.frequency.exponentialRampToValueAtTime(o.lp, t + 0.12); osc(c, o.tipo, f, t, t + dur + 0.2, lp); osc(c, 'sine', f, t, t + dur + 0.2, g); },
  bumbo(c, d, t, v) { const g = decai(c, d, t, v * 0.9, 0.42, 0.002); const o = osc(c, 'sine', 150, t, t + 0.5, g); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.16); fonteR(c, t, t + 0.02, decai(c, filtro(c, 'highpass', 3000, 0.7, d), t, v * 0.15, 0.012, 0.001)); },
  caixa(c, d, t, v) { fonteR(c, t, t + 0.25, filtro(c, 'bandpass', 1900, 0.8, decai(c, d, t, v * 0.55, 0.17, 0.002))); osc(c, 'triangle', 185, t, t + 0.15, decai(c, d, t, v * 0.3, 0.09, 0.002)); },
  chimbal(c, d, t, v, aberto, x) { fonteR(c, t, t + (aberto ? 0.3 : 0.06), filtro(c, 'highpass', 7200, 0.7, decai(c, painel(c, d, x), t, v * 0.16, aberto ? 0.22 : 0.035, 0.001))); },
  tambor(c, d, t, f, v) { const g = decai(c, d, t, v * 0.85, 0.55, 0.003); const o = osc(c, 'sine', f * 1.6, t, t + 0.65, g); o.frequency.setValueAtTime(f * 1.6, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.08); fonteR(c, t, t + 0.12, filtro(c, 'lowpass', 700, 0.7, decai(c, d, t, v * 0.35, 0.07, 0.002))); },
  bigorna(c, d, t, v, x) { const p = painel(c, d, x); fonteR(c, t, t + 0.3, filtro(c, 'bandpass', 2600, 10, decai(c, p, t, v * 0.9, 0.22, 0.001))); [[1250, 0.4, 0.07], [1960, 0.25, 0.05], [3110, 0.15, 0.03]].forEach(([f, dk, a]) => osc(c, 'sine', f, t, t + dk + 0.1, decai(c, p, t, v * a, dk, 0.001))); },
  lead(c, d, t, f, dur, v, o) { const g = ganho(c, d, t, 0.03, v * o.v, t + dur * 0.95, 0.16), lp = filtro(c, 'lowpass', o.lp, 1, g); const s = osc(c, o.tipo, f, t, t + dur + 0.3, lp), s2 = osc(c, o.tipo, f, t, t + dur + 0.3, lp, 7);
    if (o.vib || dur > 0.4) { const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = 5.4; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(14, t + Math.min(0.5, dur)); l.connect(lg); lg.connect(s.detune); lg.connect(s2.detune); l.start(t); l.stop(t + dur + 0.3); } },
  drone(c, d, t, dur, f, v, lp0) { const g = ganho(c, d, t, 1.2, v * 0.2, t + dur, 1.5), lp = filtro(c, 'lowpass', lp0, 1.5, g); lp.frequency.setValueAtTime(lp0, t); lp.frequency.linearRampToValueAtTime(lp0 * 2.2, t + dur * 0.5); lp.frequency.linearRampToValueAtTime(lp0, t + dur); osc(c, 'sawtooth', f, t, t + dur + 1.6, lp, -6); osc(c, 'sawtooth', f, t, t + dur + 1.6, lp, 6); },
  enxame(c, d, t, dur, v) { const g = ganho(c, d, t, 0.8, v * 0.3, t + dur, 0.8), am = c.createGain(); am.gain.value = 0.5; am.connect(g); const l = c.createOscillator(), lg = c.createGain(); l.type = 'square'; l.frequency.value = 17; lg.gain.value = 0.45; l.connect(lg); lg.connect(am.gain); l.start(t); l.stop(t + dur + 1); fonteR(c, t, t + dur + 1, filtro(c, 'bandpass', 2600, 3, am)); },
  bolha(c, d, t, f, v, x) { const o = osc(c, 'sine', f, t, t + 0.12, decai(c, painel(c, d, x), t, v * 0.16, 0.09)); o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 2.2, t + 0.07); },
  madeira(c, d, t, f, v, x) { const p = painel(c, d, x); osc(c, 'sine', f, t, t + 0.1, decai(c, p, t, v * 0.25, 0.05, 0.001)); osc(c, 'sine', f * 2.4, t, t + 0.06, decai(c, p, t, v * 0.1, 0.03, 0.001)); },
  vento(c, d, t, dur, v) { const g = ganho(c, d, t, dur * 0.4, v * 0.5, t + dur * 0.6, dur * 0.4), bp = filtro(c, 'bandpass', 500, 1.2, g); bp.frequency.setValueAtTime(500, t); bp.frequency.linearRampToValueAtTime(1400, t + dur * 0.5); bp.frequency.linearRampToValueAtTime(600, t + dur); fonteR(c, t, t + dur + 0.1, bp); },
  brilho(c, d, t, dur, v) { fonteR(c, t, t + dur + 0.2, filtro(c, 'highpass', 8000, 0.7, ganho(c, d, t, dur * 0.3, v * 0.06, t + dur * 0.5, dur * 0.5))); },
  gongo(c, d, t, f, v) { [[1, 1, 0.2], [1.48, 0.7, 0.1], [2.11, 0.5, 0.07], [1.003, 1, 0.15]].forEach(([m, dk, a]) => osc(c, 'sine', f * m, t, t + 3.2 * dk + 0.1, decai(c, d, t, v * a, 3.2 * dk, 0.01))); },
  timpano(c, d, t, f, v) { const g = decai(c, d, t, v * 0.6, 0.9, 0.004); const o = osc(c, 'sine', f * 1.15, t, t + 1, g); o.frequency.setValueAtTime(f * 1.15, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.1); fonteR(c, t, t + 0.1, filtro(c, 'lowpass', 300, 0.7, decai(c, d, t, v * 0.3, 0.08))); } };

/* ---------- composição de cada camada ---------- */
function rng(s) { return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function compor(c, d, nome, camada, R, I) { /* I = os instrumentos (aqui, o gravador de chamadas: os nós nascem depois, em fatias) */
  const spb = 60 / R.bpm, st = spb / 4, bar = spb * 4, rnd = rng(nome.length * 131 + camada.length * 17 + R.bpm);
  const mi = (g, o) => R.tom + 12 * o + R.escala[((g % 7) + 7) % 7] + 12 * Math.floor(g / 7), f = (g, o) => hz(mi(g, o));
  const tri = (g, o) => [f(g, o), f(g + 2, o), f(g + 4, o)];
  const ataque = (inst, t, fr, v, x) => { const o = R.arp; if (inst === 'sino') I.sino(c, d, t, fr, v, o, x); else if (inst === 'marimba') I.marimba(c, d, t, fr, v, o, x); else I.pluck(c, d, t, fr, v, o, x); };
  const metal = (t, v, x) => { const m = R.metal; if (m === 'bigorna') I.bigorna(c, d, t, v, x); else if (m === 'bolha') I.bolha(c, d, t, 500 + rnd() * 700, v, x); else if (m === 'enxame') I.chimbal(c, d, t, v * 0.8, false, x); else if (m === 'brilho') I.sino(c, d, t, f(4, 4), v * 0.4, { dec: 0.8 }, x); else I.chimbal(c, d, t, v * 0.6, false, x); };
  const tema = (oit, vel, timbre, esticar) => { for (const [s, g, n] of R.tema) { const t = s * st * (esticar || 1), dur = n * st * (esticar || 1); if (t >= 16 * spb) continue; if (timbre === 'lead') I.lead(c, d, t, f(g, oit), dur, vel, R.lead); else ataque(timbre, t, f(g, oit), vel, 0); } };
  if (camada === 'paz') {
    for (let b = 0; b < 4; b++) { const g = R.prog[b], t = b * bar; I.pad(c, d, t, bar, tri(g, 1), R.pad); I.baixo(c, d, t, f(g, 0), spb * 2, 0.45, R.baixo);
      const ch = [g, g + 2, g + 4, g + 7, g + 9]; R.arpPadrao.forEach((s, k) => { if (rnd() < 0.18) return; ataque(R.arp.inst, t + s * st, f(ch[k % ch.length], 2 + (k % 3 === 2 ? 1 : 0)), 0.42 + rnd() * 0.18, (k % 2 ? 0.35 : -0.35)); }); }
    if (R.metal === 'bigorna') { I.bigorna(c, d, bar + 2 * spb, 0.2, 0.5); I.bigorna(c, d, 3 * bar + 2 * spb, 0.16, -0.5); }
    else if (R.metal === 'vento') { I.vento(c, d, 0, bar * 2, 0.5); I.vento(c, d, bar * 2, bar * 2, 0.45); }
    else if (R.metal === 'bolha') { for (let k = 0; k < 7; k++) I.bolha(c, d, rnd() * 16 * spb, 400 + rnd() * 900, 0.5, rnd() * 1.4 - 0.7); }
    else if (R.metal === 'brilho') { for (let b = 0; b < 4; b++) I.brilho(c, d, b * bar, bar, 1); }
    else if (R.metal === 'enxame') I.enxame(c, d, 0, 16 * spb, 0.25);
  } else if (camada === 'tensao') {
    for (let b = 0; b < 4; b++) { const g = R.prog[b], t = b * bar; for (let k = 0; k < 8; k++) { const sm = R.ost[k]; const m = R.tom + R.escala[((g % 7) + 7) % 7] + sm + (k === 7 ? 12 : 0); I.baixo(c, d, t + k * 2 * st, hz(m), st * 1.7, k % 4 === 0 ? 0.55 : 0.4, R.baixo); }
      for (let k = 0; k < 8; k++) metal(t + (k * 2 + 1) * st, k % 2 ? 0.35 : 0.22, k % 2 ? 0.4 : -0.4); I.tambor(c, d, t, hz(R.tom), 0.35);
      I.lead(c, d, t, f(g + 4, 3), bar * 0.95, 0.35, Object.assign({}, R.lead, { lp: R.lead.lp * 0.6, vib: 1 })); }
  } else if (camada === 'batalha') {
    const bum = R.metal === 'enxame' ? [0, 4, 8, 12] : [0, 6, 8, 10];
    for (let b = 0; b < 4; b++) { const g = R.prog[b], t = b * bar; for (const s of bum) I.bumbo(c, d, t + s * st, s ? 0.75 : 0.9); I.caixa(c, d, t + 4 * st, 0.7); I.caixa(c, d, t + 12 * st, 0.75); if (b === 3) { I.caixa(c, d, t + 14 * st, 0.4); I.caixa(c, d, t + 15 * st, 0.5); }
      for (let k = 0; k < 16; k++) I.chimbal(c, d, t + k * st, k % 4 === 2 ? 0.75 : k % 2 ? 0.35 : 0.55, k === 14, (k % 2 ? 0.3 : -0.3));
      for (let k = 0; k < 8; k++) I.baixo(c, d, t + k * 2 * st, f(g + (k === 3 || k === 6 ? 4 : 0), k % 2 ? 1 : 0), st * 1.6, 0.6, R.baixo);
      I.pad(c, d, t, st * 1.5, tri(g, 2), Object.assign({}, R.pad, { a: 0.01, v: R.pad.v * 1.4 })); I.pad(c, d, t + 10 * st, st * 1.5, tri(g, 2), Object.assign({}, R.pad, { a: 0.01, v: R.pad.v * 1.2 }));
      if (R.metal === 'bigorna' && b % 2) I.bigorna(c, d, t + 12 * st, 0.4, 0.3); }
    tema(2, 1, 'lead');
  } else if (camada === 'chefao') {
    I.drone(c, d, 0, 16 * spb, hz(R.tom - 12), 1, 160); I.drone(c, d, 0, 16 * spb, hz(R.tom - 6), 0.6, 140);
    for (let b = 0; b < 4; b++) { const g = R.prog[b], t = b * bar; for (const s of [0, 3, 8, 11, 14]) I.tambor(c, d, t + s * st, 52, s === 0 ? 1 : 0.7); for (const s of [6, 12]) I.tambor(c, d, t + s * st, 88, 0.55);
      I.pad(c, d, t, bar, [f(g, 1), f(g + 1, 1), f(g + 4, 1)], Object.assign({}, R.pad, { coro: 1, lp: 2400, a: 0.4, v: 0.2 })); if (b % 2 === 0) I.gongo(c, d, t, hz(R.tom), 0.6);
      for (let k = 0; k < 4; k++) I.baixo(c, d, t + k * 4 * st, f(g, 0), st * 3.5, 0.55, R.baixo); }
    tema(1, 1, 'lead');
  } else if (camada === 'cinema') {
    I.gongo(c, d, 0, hz(R.tom + 12), 0.5); I.pad(c, d, 0, bar * 2, tri(R.prog[0], 1).concat([f(R.prog[0], 0)]), Object.assign({}, R.pad, { a: 1.6, v: R.pad.v * 1.3 })); I.pad(c, d, bar * 2, bar * 2, tri(R.prog[2], 1).concat([f(R.prog[2], 0)]), Object.assign({}, R.pad, { a: 1.6, v: R.pad.v * 1.3 }));
    I.baixo(c, d, 0, f(R.prog[0], 0), bar * 2, 0.4, R.baixo); I.baixo(c, d, bar * 2, f(R.prog[2], 0), bar * 2, 0.4, R.baixo);
    tema(2, 0.7, R.arp.inst === 'pluck' ? 'lead' : R.arp.inst);
    for (let k = 0; k < 8; k++) I.timpano(c, d, 3 * bar + 2 * spb + k * st, hz(R.tom), 0.12 + k * 0.06);
  } else if (camada === 'vitoria') {
    const g6 = R.prog[1], g7 = R.prog[3]; I.pad(c, d, 0, spb, tri(g6, 1), Object.assign({}, R.pad, { a: 0.05 })); I.pad(c, d, spb, spb, tri(g7, 1), Object.assign({}, R.pad, { a: 0.05 }));
    const raiz = R.tom + 12, maj = [raiz, raiz + 4, raiz + 7, raiz + 12].map(hz); I.pad(c, d, spb * 2, spb * 4, maj, Object.assign({}, R.pad, { a: 0.08, v: R.pad.v * 1.4 })); I.gongo(c, d, spb * 2, hz(R.tom + 12), 0.7);
    maj.concat([hz(raiz + 16), hz(raiz + 19)]).forEach((fr, k) => ataque(R.arp.inst === 'pluck' ? 'sino' : R.arp.inst, spb * 2 + k * st, fr * 2, 0.6, (k % 2 ? 0.3 : -0.3))); I.baixo(c, d, spb * 2, hz(R.tom), spb * 4, 0.55, R.baixo); I.timpano(c, d, spb * 2, hz(R.tom), 0.6);
  } else if (camada === 'derrota') {
    I.pad(c, d, 0, spb * 2, tri(0, 1), Object.assign({}, R.pad, { a: 0.3 })); I.pad(c, d, spb * 2, spb * 4, [f(3, 0), f(5, 0), f(0, 1)], Object.assign({}, R.pad, { a: 0.6, lp: R.pad.lp * 0.6 }));
    I.drone(c, d, 0, spb * 6, hz(R.tom - 12), 0.8, 120); [4, 3, 2, 0].forEach((g, k) => I.lead(c, d, k * spb, f(g, 2), spb * 0.95, 0.6, Object.assign({}, R.lead, { lp: R.lead.lp * 0.5 }))); I.tambor(c, d, 0, 50, 0.6); I.tambor(c, d, spb * 2, 46, 0.5); I.gongo(c, d, spb * 4, hz(R.tom - 12), 0.5);
  } }
const DUR_FINAL = { vitoria: 5.5, derrota: 6.5 };
function tamanho(raca, camada) { const R = RACAS[raca]; return FINAIS.indexOf(camada) >= 0 ? DUR_FINAL[camada] : 16 * 60 / R.bpm; }
/* grava uma camada: { buf: AudioBuffer, ms (relógio), montaMs (fio principal), pico, rms } */
function renderizar(raca, camada, o) { o = o || {}; const R = RACAS[raca] || RACAS.vehnar, OC = window.OfflineAudioContext || window.webkitOfflineAudioContext; if (!OC) return Promise.reject(new Error('sem OfflineAudioContext'));
  const laco = FINAIS.indexOf(camada) < 0, L = tamanho(raca, camada), ch = o.mono ? 1 : 2, n = Math.ceil((L + CAUDA) * SR);
  const t0 = performance.now(); const c = new OC(ch, n, SR); const bus = c.createGain(); bus.connect(c.destination);
  const lista = [], X = {}; for (const k in INST) X[k] = function () { lista.push([k, arguments]); }; compor(c, bus, raca, camada, R, X); let montaMs = performance.now() - t0, maxFatia = montaMs;
  /* os nós de cada nota nascem em fatias de até ~4 ms (fora do jogo, tudo de uma vez): a gravação não trava o quadro */
  const monta = () => new Promise(ok => { let i = 0; const passo = () => { const a = performance.now(); while (i < lista.length && (!o.fatias || performance.now() - a < 4)) { const [k, args] = lista[i++]; INST[k].apply(null, args); } const d = performance.now() - a; montaMs += d; if (d > maxFatia) maxFatia = d;
      if (i < lista.length) { if (typeof requestIdleCallback === 'function') requestIdleCallback(passo, { timeout: 200 }); else setTimeout(passo, 16); } else ok(); }; passo(); });
  const fim = b => { const nL = laco ? Math.round(L * SR) : n, nC = Math.min(n - nL, Math.round(CAUDA * SR)), out = c.createBuffer(ch, nL, SR); let pk = 0, s = 0;
    for (let k = 0; k < ch; k++) { const src = b.getChannelData(k), dst = out.getChannelData(k); for (let i = 0; i < nL; i++) dst[i] = src[i]; if (laco) for (let i = 0; i < nC; i++) dst[i] += src[nL + i]; /* a cauda volta no começo: o laço emenda */
      for (let i = 0; i < nL; i++) { const a = Math.abs(dst[i]); if (a > pk) pk = a; s += dst[i] * dst[i]; } }
    const rms = Math.sqrt(s / (nL * ch)) || 1e-9; let g = Math.pow(10, (ALVO_DB[camada] || -26) / 20) / rms; if (pk * g > 0.708) g = 0.708 / pk; /* volume médio nivelado e pico no máximo em −3 dBFS */
    for (let k = 0; k < ch; k++) { const dst = out.getChannelData(k); for (let i = 0; i < nL; i++) dst[i] *= g; }
    return { buf: out, ms: Math.round(performance.now() - t0), montaMs: +montaMs.toFixed(1), maxFatiaMs: +maxFatia.toFixed(1), notas: lista.length, picoDb: +(20 * Math.log10(pk * g)).toFixed(1), rmsDb: +(20 * Math.log10(rms * g)).toFixed(1), seg: +(nL / SR).toFixed(2), bytes: nL * ch * 4 }; };
  return monta().then(() => { const pr = c.startRendering(); return pr && pr.then ? pr.then(fim) : new Promise(ok => { c.oncomplete = e => ok(fim(e.renderedBuffer)); }); }); }

/* ---------- o tocador: um "deck" por Raça (camadas presas ao mesmo relógio, um ganho por camada) ---------- */
const P = { modo: null, deck: null, velhos: [], cache: {}, fila: [], gravando: false, med: { gravacoes: [], ms: 0 }, calor: 0, calorT: 0, baseT: -1e9, nucleoT: -1e9, superT: -1e9, nivel: 0, quer: 0, querT: 0, era: 1, fim: null, cena: null, ultimoQ: -1e9, raca: null, nq: 0, tela: false };
const leve = () => toque() || (P.R && P.R.quality && P.R.quality.name === 'baixa');
const agora = () => performance.now();
function bus(c) { const s3 = ARD.som3d; const b = s3 && s3.busMusica && s3.busMusica(c); if (b) return b; if (!P.bus0 || P.bus0.context !== c) { P.bus0 = c.createGain(); P.bus0.connect(c.destination); } const au = A(); P.bus0.gain.value = au && au.musica !== false ? 0.9 * au.volMusica : 0; return P.bus0; }
function novoDeck(raca, modo) { const au = A(), c = au.ctx; const d = { raca, modo, c, saida: c.createGain(), cam: {}, t0: null, L: tamanho(raca, 'paz') }; d.saida.gain.value = 0; d.saida.connect(bus(c)); d.saida.gain.setTargetAtTime(modo === 'menu' ? 0.6 : 1, c.currentTime, 0.6); return d; }
function soltarDeck(d, tau) { if (!d) return; const t = d.c.currentTime; try { d.saida.gain.cancelScheduledValues(t); d.saida.gain.setTargetAtTime(0, t, tau || 0.5); } catch (e) {} P.velhos.push(d); setTimeout(() => { for (const k in d.cam) { const x = d.cam[k]; if (x.src) try { x.src.stop(); } catch (e) {} try { x.g.disconnect(); } catch (e) {} } try { d.saida.disconnect(); } catch (e) {} const i = P.velhos.indexOf(d); if (i >= 0) P.velhos.splice(i, 1); }, (tau || 0.5) * 5000 + 200); }
/* põe a camada pronta para tocar no deck (presa ao relógio do deck: entra no ponto certo do laço) */
function ligaCamada(d, camada, buf) { if (d.cam[camada] && d.cam[camada].src) return; const c = d.c, x = d.cam[camada] || (d.cam[camada] = { g: c.createGain(), alvo: 0 }); if (!x.g.__lig) { x.g.gain.value = 0; x.g.connect(d.saida); x.g.__lig = 1; }
  const s = c.createBufferSource(); s.buffer = buf; s.loop = true; const t = c.currentTime + 0.06; if (d.t0 == null) d.t0 = t; const off = ((t - d.t0) % buf.duration + buf.duration) % buf.duration; s.connect(x.g); s.start(t, off); x.src = s; x.g.gain.setTargetAtTime(x.alvo, t, 0.4); }
function tocaFinal(d, camada, buf) { const c = d.c, s = c.createBufferSource(), g = c.createGain(); g.gain.value = 1; s.buffer = buf; s.connect(g); g.connect(d.saida); s.start(c.currentTime + 0.05); s.onended = () => { try { g.disconnect(); } catch (e) {} }; }
/* fila de gravação: uma camada por vez, em tempo livre e nunca na tela de carregamento */
const carregando = () => { const el = typeof document !== 'undefined' && document.getElementById('loading'); return !!(el && !el.hidden); };
function pede(raca, camada, cb) { const k = raca + '|' + camada + (leve() || MONO.indexOf(camada) >= 0 ? '|m' : ''); const ja = P.cache[k]; if (ja) { cb(ja.buf); return; } const f = P.fila.find(x => x.k === k) || (P.atual && P.atual.k === k ? P.atual : null); if (f) { f.cbs.push(cb); return; } /* também a que está gravando agora */ P.fila.push({ k, raca, camada, cbs: [cb] }); bomba(); }
function bomba() { if (P.gravando || !P.fila.length) return; const au = A(), c = au && au.ctx; if (!c || c.state !== 'running') { P.rodandoT = 0; setTimeout(bomba, 500); return; } if (!P.rodandoT) P.rodandoT = agora(); if (carregando() || agora() - P.rodandoT < 1200) { setTimeout(bomba, 500); return; } /* nunca na carga; só com o contexto tocando há 1,2 s (o desbloqueio do toque vem antes) */ P.gravando = true; const ocioso = f => typeof requestIdleCallback === 'function' ? requestIdleCallback(f, { timeout: 800 }) : setTimeout(f, 30);
  ocioso(() => { const it = P.atual = P.fila.shift(); if (!it) { P.gravando = false; return; } renderizar(it.raca, it.camada, { mono: leve() || MONO.indexOf(it.camada) >= 0, fatias: true }).then(r => { P.cache[it.k] = r; P.med.gravacoes.push({ raca: it.raca, camada: it.camada, ms: r.ms, montaMs: r.montaMs, maxFatiaMs: r.maxFatiaMs, notas: r.notas, seg: r.seg, kb: Math.round(r.bytes / 1024), picoDb: r.picoDb, rmsDb: r.rmsDb }); P.med.ms += r.montaMs; it.cbs.forEach(cb => { try { cb(r.buf); } catch (e) {} }); },
    e => console.warn('[ARD] música: ' + (e && e.message))).then(() => { P.gravando = false; P.atual = null; setTimeout(bomba, 60); }); }); }
function limpaCache(manter) { for (const k in P.cache) if (manter.indexOf(k.split('|')[0]) < 0) delete P.cache[k]; } /* memória: só as Raças em uso */

/* ---------- mistura pelo estado ---------- */
const MIX = [{ paz: 1, tensao: 0, batalha: 0, chefao: 0 }, { paz: 0.75, tensao: 1, batalha: 0, chefao: 0 }, { paz: 0.3, tensao: 0.8, batalha: 1, chefao: 0 }, { paz: 0, tensao: 0.5, batalha: 0.9, chefao: 1 }];
const CENA = { abertura: { cinema: 1 }, chefao: { cinema: 1, chefao: 0.5 }, superarma: { cinema: 1, batalha: 0.4 }, 'sala-guerra': { cinema: 1, tensao: 0.4 } /* 5.0f: os nomes do f-cinema */, calma: { cinema: 1, paz: 0.3 }, briefing: { cinema: 1, paz: 0.3 }, tensa: { cinema: 1, tensao: 0.5 }, epica: { cinema: 1, batalha: 0.45 }, vitoria: { cinema: 0.6 }, derrota: { cinema: 0.6 } };
function alvos() { const d = P.deck; if (!d) return null; let m; if (P.cena) m = CENA[P.cena] || { cinema: 1 }; else if (P.fim) m = {}; else if (CAMADAS.indexOf(CHAVE) >= 0) m = { [CHAVE]: 1 }; else if (d.modo === 'menu') m = { paz: 1 };
  else { m = Object.assign({}, MIX[P.nivel]); if (P.nivel === 0 && P.era >= 2) m.tensao = P.era >= 3 ? 0.4 : 0.25; } return m; }
function aplica(tau) { const d = P.deck; if (!d) return; const m = alvos() || {}, t = d.c.currentTime; for (const k of CAMADAS) { const v = m[k] || 0; const x = d.cam[k]; if (x) { if (x.alvo !== v) { x.alvo = v; x.g.gain.setTargetAtTime(v, t, tau || 0.8); } } else if (v > 0) garante(d, k); } }
function garante(d, camada) { if (d.cam[camada] || (d.pedidas && d.pedidas[camada])) return; (d.pedidas = d.pedidas || {})[camada] = 1; pede(d.raca, camada, buf => { if (P.deck !== d && P.velhos.indexOf(d) < 0) return; const m = alvos() || {}; d.cam[camada] = d.cam[camada] || { g: d.c.createGain(), alvo: 0 }; d.cam[camada].alvo = (P.deck === d ? m[camada] : 0) || 0; ligaCamada(d, camada, buf); }); }
/* calor e base: eventos da simulação (src/render3d.js, R.onEvents) */
function eventos(evs, sim, human) { if (!P.deck || P.deck.modo !== 'partida' || !evs) return; const now = agora();
  for (const e of evs) { switch (e.t) {
    case 'shot': if (e.owner === human) P.calor += 0.35; else if (e.tid != null && sim && sim.byId) { const tg = sim.byId.get(e.tid); if (tg && tg.owner === human) P.calor += 0.5; } break;
    case 'death': if (e.owner === human) { P.calor += e.kind === 'building' ? 4 : 1.2; if (e.kind === 'building') P.baseT = now; } else P.calor += 0.4; break;
    case 'alert': if (e.p === human && e.kind === 'danger') { const tx = String(e.text || ''); if (/BASE SOB|NÚCLEO SOB|SIFÃO/i.test(tx)) { P.baseT = now; if (/NÚCLEO/i.test(tx)) P.nucleoT = now; } } break;
    case 'super': P.superT = now; P.calor += 6; break;
    case 'end': fimPartida(sim, human, e.result); break; } } }
function estado(sim, human) { if (P.forcado) return; const now = agora(), dt = Math.min(2, (now - (P.calorT || now)) / 1000); P.calorT = now; P.calor *= Math.exp(-dt / 7); const p = sim && sim.players && sim.players[human]; P.era = (p && p.era) || 1;
  let n = 0; const base = now - P.baseT < 25000; if (P.calor > 1.5 || base) n = 1; if (P.calor > 8 || (now - P.baseT < 15000 && P.calor > 3)) n = 2; if (P.calor > 22 && (P.era >= 3 || now - P.nucleoT < 20000 || now - P.superT < 30000)) n = 3;
  if (n !== P.quer) { P.quer = n; P.querT = now; } const espera = n > P.nivel ? 700 : 9000; if (n !== P.nivel && now - P.querT > espera) { P.nivel = n; aplica(n > 0 ? 0.5 : 2.2); } }
function fimPartida(sim, human, res) { if (P.fim) return; const o = res && res.outcome; const v = o === 'victory' || (o === 'over' && res.scores && res.scores[0] && res.scores.slice().sort((a, b) => b.score - a.score)[0].id === human); P.fim = v ? 'vitoria' : 'derrota'; const d = P.deck; aplica(1.2); if (d) pede(d.raca, P.fim, buf => { if (P.deck === d) tocaFinal(d, P.fim, buf); }); }

/* ---------- partida, tela inicial e cenas ---------- */
function partida(raca, sim) { const au = A(); if (!au || !au.ctx || !LIGADA) return; if (P.deck && P.deck.modo === 'partida' && P.deck.raca === raca && (!sim || P.sim === sim)) return; P.sim = sim || P.sim; const velho = P.deck; P.deck = novoDeck(raca, 'partida'); soltarDeck(velho, 0.6); P.modo = 'partida'; P.raca = raca;
  P.calor = 0; P.calorT = agora(); P.baseT = P.nucleoT = P.superT = -1e9; P.nivel = 0; P.quer = 0; P.fim = null; limpaCache([raca]);
  if (au.musica === false) return; aplica(1.5); for (const k of CAMADAS) garante(P.deck, k); }
function menu(raca) { const au = A(); if (!au || !au.ctx || !LIGADA || au.musica === false) return; if (P.deck && P.deck.modo === 'menu' && P.deck.raca === raca) return; const velho = P.deck; P.deck = novoDeck(raca, 'menu'); soltarDeck(velho, 0.8); P.modo = 'menu'; P.raca = raca; P.fim = null;
  const manter = [raca]; if (velho) manter.push(velho.raca); limpaCache(manter); aplica(1); garante(P.deck, 'paz'); }
function parar(tau) { soltarDeck(P.deck, tau || 0.8); P.deck = null; P.modo = null; }
function cena(nome, o) { o = o || {}; if (nome && !CENA[nome]) return true; /* nome desconhecido: nada muda */ P.cena = nome || null; const au = A(); if (!LIGADA || !au) return true;
  if (nome && !P.deck && au.ctx && au.musica !== false) { const r = o.raca || P.raca || (document.documentElement.dataset.race) || 'vehnar'; P.deck = novoDeck(r, 'menu'); P.modo = 'menu'; P.raca = r; }
  const d = P.deck; if (!d) return true; if (nome && (nome === 'vitoria' || nome === 'derrota')) pede(d.raca, nome, buf => { if (P.deck === d && P.cena === nome) tocaFinal(d, nome, buf); });
  aplica(nome ? 1.2 : 1.6); if (nome) garante(d, 'cinema'); return true; }
/* quadro (src/som3d.js): o estado a cada 0,25 s */
function quadro(sim, human, R) { if (!LIGADA) return; P.R = R; P.ultimoQ = agora(); if (R && R.warming) return; const au = A(); if (!au || !au.ctx) return;
  if (!P.deck || P.deck.modo !== 'partida' || P.sim !== sim) { const p = sim && sim.players && sim.players[human]; if (p && p.faction && au.musica !== false && !carregando()) partida(p.faction, sim); return; }
  const t = agora(); if (t - (P.estT || 0) > 250) { P.estT = t; estado(sim, human); } } /* a cada 0,25 s pelo relógio */
/* Ajustes: liga/desliga e volume (o volume já mudou no barramento do src/som3d.js) */
function ajustes() { const au = A(); if (!au) return; if (P.bus0 && au.ctx) try { P.bus0.gain.setTargetAtTime(au.musica !== false ? 0.9 * au.volMusica : 0, au.ctx.currentTime, 0.05); } catch (e) {}
  if (au.musica === false) { if (P.deck) parar(0.4); } else if (!P.deck) { if (agora() - P.ultimoQ < 2000 && P.R && P.R.sim) { const h = P.R.humanId != null ? P.R.humanId : 0, p = P.R.sim.players && P.R.sim.players[h]; if (p) partida(p.faction, P.R.sim); } else telaInicial(); } }
const naTela = () => { const st = typeof document !== 'undefined' && document.getElementById('start'); return !!(st && !st.hidden); };
function telaInicial() { const au = A(); if (!au || !au.ctx || !naTela()) return; menu(document.documentElement.dataset.race || 'vehnar'); }
/* vigia (1 s): a partida acabou e voltou a tela inicial; a Raça em destaque mudou */
let vigia = null; function vigiar() { if (vigia || typeof setInterval !== 'function') return; vigia = setInterval(() => { if (!LIGADA) return; const au = A(); if (!au || !au.ctx) return;
  if (P.modo === 'partida' && (naTela() || agora() - P.ultimoQ > 20000)) { parar(0.8); } /* voltou para a tela inicial (ou a partida sumiu) */ if (!P.deck && naTela() && au.musica !== false && P.tela) telaInicial();
  else if (P.deck && P.deck.modo === 'menu' && naTela() && !P.cena) { const r = document.documentElement.dataset.race; if (r && r !== P.deck.raca) menu(r); } }, 1000); }
/* aba escondida: a música some (a partida pausa sozinha) e volta junto com a página */
if (typeof document !== 'undefined' && document.addEventListener) document.addEventListener('visibilitychange', () => { const d = P.deck; if (!d) return; const t = d.c.currentTime; try { d.saida.gain.cancelScheduledValues(t); d.saida.gain.setTargetAtTime(document.hidden ? 0 : (d.modo === 'menu' ? 0.6 : 1), t, document.hidden ? 0.1 : 0.6); } catch (e) {} });
/* tela inicial: começa no primeiro gesto (o AudioContext nasce nele, no src/audio.js) */
if (typeof window !== 'undefined' && window.addEventListener) { const g = e => { if (!e.isTrusted) return; P.tela = true; vigiar(); setTimeout(() => { if (!P.deck && naTela()) telaInicial(); }, 0); }; ['pointerup', 'keydown', 'touchend'].forEach(ev => window.addEventListener(ev, g, { passive: true, capture: true })); }

ARD.musica = { quadro, eventos, cena, renderizar, ajustes, partida, menu, parar, RACAS: Object.keys(RACAS), CAMADAS: CAMADAS.slice(), FINAIS: FINAIS.slice(),
  forcar: n => { if (n == null) { P.forcado = false; return; } P.forcado = true; P.nivel = P.quer = Math.max(0, Math.min(3, n | 0)); aplica(0.3); }, /* testes e gravações: prende o nível (null solta) */
  estado: () => ({ modo: P.modo, raca: P.raca, nivel: P.nivel, calor: +P.calor.toFixed(2), era: P.era, cena: P.cena, fim: P.fim, camadas: P.deck ? Object.keys(P.deck.cam).filter(k => P.deck.cam[k] && P.deck.cam[k].src).map(k => k + ':' + (+P.deck.cam[k].alvo.toFixed(2))) : [], gravacoes: P.med.gravacoes.slice(), montaMs: +P.med.ms.toFixed(1), fila: P.fila.length, cacheKB: Object.values(P.cache).reduce((s, r) => s + Math.round(r.bytes / 1024), 0) }) };
})(globalThis.ARD = globalThis.ARD || {});
