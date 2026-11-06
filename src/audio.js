/* Áudio: efeitos sintetizados em WebAudio (sem arquivos) e voz de sistema pela Web Speech API. 5.0c.1: e as vozes gravadas (src/vozes.js), pelo mesmo Web Audio. */
(function (ARD) {
'use strict';
const A = { ctx: null, master: null, enabled: true, voice: true, gravadas: true /* 5.0c.1: vozes gravadas (false = voz do sistema) */, inited: false, last: {}, recent: [], lastVoice: {}, voiceObj: null, voz: '', vozNome: '',
  volSom: 1, musica: true, volMusica: 0.7, saida: 'fone' /* 5.0f: volume dos efeitos (1 = o de antes), música liga/desliga e volume, saída do som 3D ('fone' = HRTF, 'caixa' = panorâmica simples) */ };
const GANHO_EFEITOS = 0.35; /* o volume dos efeitos de antes da 5.0f (A.master) */
const vol01 = v => Math.max(0, Math.min(1, +v)); /* 5.0f */
try { const p = JSON.parse(localStorage.getItem('ard-audio') || '{}'); if (p.enabled === false) A.enabled = false; if (p.voice === false) A.voice = false; if (typeof p.voz === 'string') A.voz = p.voz; if (typeof p.vozNome === 'string') A.vozNome = p.vozNome; /* 5.0a.2: voz escolhida em Ajustes ('' = Automática) */ if (p.gravadas === false) A.gravadas = false; /* 5.0c.1 */
  if (p.volSom != null && isFinite(p.volSom)) A.volSom = vol01(p.volSom); if (p.musica === false) A.musica = false; if (p.volMusica != null && isFinite(p.volMusica)) A.volMusica = vol01(p.volMusica); if (p.saida === 'caixa' || p.saida === 'fone') A.saida = p.saida; /* 5.0f */ } catch (e) {}
function save() { try { localStorage.setItem('ard-audio', JSON.stringify({ enabled: A.enabled, voice: A.voice, voz: A.voz || '', vozNome: A.vozNome || '', gravadas: A.gravadas !== false /* 5.0c.1 */, volSom: A.volSom, musica: A.musica !== false, volMusica: A.volMusica, saida: A.saida /* 5.0f */ })); } catch (e) {} }
const VZ = () => (globalThis.ARD && ARD.vozes) || null; /* 5.0c.1: o tocador das vozes gravadas (src/vozes.js); sem ele (testes no Node), tudo como antes */
const S3 = () => (globalThis.ARD && ARD.som3d) || null; /* 5.0f: o mixer do som 3D (src/som3d.js); sem ele, os efeitos como antes */
A.init = function () {
  if (A.inited) return; A.inited = true; sessao(); /* 5.0b.1: a sessão de reprodução do iOS vem antes de o contexto nascer */
  try { const C = window.AudioContext || window.webkitAudioContext; if (!C) return; A.ctx = new C(); A.master = A.ctx.createGain(); A.master.gain.value = GANHO_EFEITOS * A.volSom; A.master.connect(A.ctx.destination); } catch (e) { A.ctx = null; }
  if (A.ctx) vigiar(A.ctx); /* 5.0b.1: estado 'interrupted' do iOS e volta para a página */
  if (A.ctx && S3()) try { S3().montar(A.ctx, A.master); } catch (e) { console.warn('[ARD] som 3D indisponível: ' + e.message); } /* 5.0f: barramentos, limitador, vozes do mixer e os efeitos pré-gravados */
};
A.resume = function () { retomar(); }; /* 5.0b.1: retoma também do 'interrupted' do iOS e nunca deixa a promessa do resume() solta (antes: só 'suspended', sem catch) */
/* 5.0f: a síntese escreve num alvo: o contexto ao vivo (A.ctx → A.master, agora) ou, na pré-gravação dos efeitos (src/som3d.js), um
   OfflineAudioContext (TG = { c, d, t }). Os sons são os mesmos de antes; cada um vira um AudioBuffer uma vez e toca por uma voz do mixer. */
let noiseBuf = null, TG = null;
const sc = () => TG ? TG.c : A.ctx, sd = () => TG ? TG.d : A.master, st = () => TG ? TG.t : A.ctx.currentTime;
function noise(dur, o) {
  const c = sc(); if (!noiseBuf || noiseBuf.sampleRate !== c.sampleRate) { noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const t0 = st() + (o.delay || 0); /* 4.3h: atraso (trovão longe) */ const src = c.createBufferSource(); src.buffer = noiseBuf; const f = c.createBiquadFilter(); f.type = o.type || 'lowpass'; f.frequency.setValueAtTime(o.freq || 800, t0); if (o.sweep) f.frequency.exponentialRampToValueAtTime(o.sweep, t0 + dur); f.Q.value = o.q || 0.7;
  const g = c.createGain(); g.gain.setValueAtTime(o.gain || 0.3, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  src.connect(f); f.connect(g); g.connect(sd()); src.start(t0); src.stop(t0 + dur + 0.05);
}
function tone(freq, dur, o) {
  const c = sc(); o = o || {}; const t0 = st() + (o.delay || 0), at = o.at || 0.01; const osc = c.createOscillator(); osc.type = o.type || 'sine'; osc.frequency.setValueAtTime(freq, t0); if (o.det) osc.detune.value = o.det;
  if (o.slide) osc.frequency.exponentialRampToValueAtTime(o.slide, t0 + dur);
  const g = c.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(o.gain || 0.2, t0 + at); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g); g.connect(sd()); osc.start(t0); osc.stop(t0 + dur + 0.05);
}
const MIN_GAP = { shot_light: 60, shot_heavy: 90, beam: 120, impact: 70, explosion: 120, build: 300, spawn: 300, alert: 800, danger: 1200, promote: 500, click: 40, siphon: 600, storm: 3000, thunder: 600, pact: 1000, betrayal: 1000, erro: 250 /* 5.0f */ };
/* o desenho de cada efeito (v = volume; os de interface ignoram v, como antes) */
function desenha(name, v, delay) {
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
    case 'erro': tone(230, 0.11, { type: 'square', gain: 0.07, slide: 190 }); tone(180, 0.16, { type: 'square', gain: 0.07, delay: 0.12, slide: 150 }); break; /* 5.0f: comando recusado */
    case 'siphon': tone(180, 0.5, { type: 'triangle', gain: 0.1 * v, slide: 240 }); break;
    case 'storm': noise(1.4, { freq: 260, sweep: 90, gain: 0.35 }); break;
    case 'thunder': { const dl = Math.max(0, Math.min(2.5, delay || 0)); noise(0.22, { freq: 2600, sweep: 700, gain: 0.22 * v, delay: dl }); noise(2.4, { freq: 210, sweep: 45, gain: 0.5 * v, delay: dl + 0.04 }); tone(44, 1.6, { type: 'sine', gain: 0.16 * v, slide: 30, delay: dl }); break; } /* 4.3h: estalo e ronco do raio, atrasados pela distância */
    case 'pact': [440, 554, 659].forEach((f, i) => tone(f, 0.25, { gain: 0.1, delay: i * 0.05 })); break;
    case 'betrayal': tone(220, 0.5, { type: 'sawtooth', gain: 0.14, slide: 110 }); tone(233, 0.5, { type: 'sawtooth', gain: 0.1, slide: 116 }); break;
  }
}
/* 5.0f: identidade por Raça nos sons de interface (clique, construir, pronto, erro). Cada um com o timbre da Raça: a forja da Vehnar (metal e
   bigorna), o gelo da Erevane (vidro e sino frio), o vivo da Tessara (madeira e bolha), o cristal do Quorith (acorde de sinos) e o enxame do Vorag
   (estalo de quitina e rosnado). A pré-gravação iguala o volume médio de cada um ao do som genérico (o volume de hoje). */
const UI_RACA = {
  vehnar: {
    click: () => { tone(640, 0.04, { type: 'square', gain: 0.045, slide: 470 }); noise(0.03, { type: 'highpass', freq: 3400, gain: 0.06 }); },
    build: () => { [0, 0.15].forEach((d, i) => { noise(0.11, { type: 'bandpass', freq: 2100 - i * 400, q: 6, gain: 0.5, delay: d }); tone(1180 - i * 160, 0.16, { type: 'triangle', gain: 0.06, delay: d }); tone(1830 - i * 240, 0.12, { gain: 0.035, delay: d }); }); tone(98, 0.32, { type: 'sawtooth', gain: 0.07, delay: 0.15, slide: 82 }); },
    spawn: () => { tone(330, 0.09, { type: 'square', gain: 0.07, slide: 320 }); tone(495, 0.14, { type: 'square', gain: 0.07, delay: 0.09 }); tone(82, 0.22, { type: 'sawtooth', gain: 0.06, delay: 0.09, slide: 75 }); noise(0.05, { type: 'bandpass', freq: 2400, q: 5, gain: 0.25, delay: 0.09 }); },
    erro: () => { tone(140, 0.13, { type: 'square', gain: 0.075 }); tone(140, 0.16, { type: 'square', gain: 0.075, delay: 0.15, slide: 120 }); noise(0.06, { type: 'bandpass', freq: 900, q: 3, gain: 0.12 }); } },
  erevane: {
    click: () => { tone(1980, 0.05, { gain: 0.05, slide: 1700 }); tone(2970, 0.04, { gain: 0.02 }); },
    build: () => { [659, 988, 1319].forEach((f, i) => { tone(f, 0.42, { gain: 0.07, delay: i * 0.07 }); tone(f * 2.76, 0.18, { gain: 0.015, delay: i * 0.07 }); }); noise(0.5, { type: 'highpass', freq: 5200, gain: 0.04, sweep: 9000 }); },
    spawn: () => { tone(880, 0.18, { gain: 0.09, slide: 1175 }); tone(1760, 0.22, { gain: 0.025, delay: 0.06 }); noise(0.25, { type: 'bandpass', freq: 3600, q: 2, gain: 0.05 }); },
    erro: () => { tone(660, 0.16, { gain: 0.09, slide: 520 }); tone(622, 0.2, { gain: 0.06, delay: 0.1, slide: 440 }); } },
  tessara: {
    click: () => { tone(880, 0.045, { type: 'triangle', gain: 0.08, slide: 1250 }); },
    build: () => { tone(300, 0.14, { type: 'triangle', gain: 0.12, slide: 600 }); tone(450, 0.16, { type: 'triangle', gain: 0.1, delay: 0.12, slide: 900 }); tone(1046, 0.06, { gain: 0.05, delay: 0.24 }); noise(0.08, { type: 'bandpass', freq: 700, q: 4, gain: 0.2, delay: 0.02 }); },
    spawn: () => { tone(523, 0.08, { type: 'triangle', gain: 0.1 }); tone(784, 0.12, { type: 'triangle', gain: 0.1, delay: 0.07 }); tone(1400, 0.05, { gain: 0.04, delay: 0.18, slide: 2400 }); },
    erro: () => { tone(220, 0.1, { type: 'triangle', gain: 0.13, slide: 160 }); tone(196, 0.14, { type: 'triangle', gain: 0.12, delay: 0.12, slide: 140 }); } },
  quorith: {
    click: () => { tone(2093, 0.06, { gain: 0.035 }); tone(3136, 0.05, { gain: 0.02 }); },
    build: () => { [523, 659, 784, 1046].forEach((f, i) => { tone(f, 0.55, { gain: 0.045, delay: i * 0.025, at: 0.004 }); tone(f * 3, 0.25, { gain: 0.008, delay: i * 0.025 }); }); },
    spawn: () => { [784, 1047, 1319].forEach((f, i) => tone(f, 0.24, { gain: 0.06, delay: i * 0.06 })); },
    erro: () => { tone(740, 0.25, { gain: 0.06 }); tone(784, 0.25, { gain: 0.06 }); tone(370, 0.2, { type: 'triangle', gain: 0.04, delay: 0.05 }); } },
  vorag: {
    click: () => { noise(0.025, { type: 'bandpass', freq: 3200, q: 5, gain: 0.3 }); noise(0.02, { type: 'bandpass', freq: 2600, q: 5, gain: 0.22, delay: 0.035 }); },
    build: () => { noise(0.3, { freq: 900, sweep: 120, gain: 0.32 }); tone(110, 0.3, { type: 'sawtooth', gain: 0.07, slide: 70 }); for (let i = 0; i < 3; i++) noise(0.03, { type: 'bandpass', freq: 2900, q: 6, gain: 0.25, delay: 0.12 + i * 0.05 }); },
    spawn: () => { tone(90, 0.28, { type: 'sawtooth', gain: 0.09, slide: 150 }); noise(0.26, { type: 'bandpass', freq: 1400, q: 3, gain: 0.16, sweep: 2600 }); for (let i = 0; i < 2; i++) noise(0.025, { type: 'bandpass', freq: 3400, q: 6, gain: 0.25, delay: 0.2 + i * 0.045 }); },
    erro: () => { noise(0.22, { type: 'bandpass', freq: 1300, q: 2, gain: 0.2, sweep: 700 }); tone(72, 0.24, { type: 'sawtooth', gain: 0.08, slide: 60 }); } } };
A.UI_RACA = Object.keys(UI_RACA); A.SONS = Object.keys(MIN_GAP); /* 5.0f: o que a pré-gravação grava */
/* 5.0f: grava um efeito num contexto qualquer (o OfflineAudioContext da pré-gravação): c = contexto, d = destino, t = início */
A.sintetiza = function (c, d, t, name, raca, v, delay) { const ant = TG; TG = { c, d, t }; try { const R = raca && UI_RACA[raca]; if (R && R[name]) R[name](); else desenha(name, v == null ? 1 : v, delay); } finally { TG = ant; } };
/* 5.0f: posição do efeito: o src/main.js passa o evento (A.em(e)) antes do efeito dele; vale para o próximo A.sfx e só para ele */
let EV = null; A.em = function (e) { EV = e || null; };
A.sfx = function (name, vol, delay) {
  const ev = EV; EV = null; /* 5.0f */
  if (!A.enabled || !A.ctx) return; A.resume(); vol = vol == null ? 1 : Math.max(0, Math.min(1, vol)); if (vol < 0.03) return;
  const now = performance.now(); if (A.last[name] && now - A.last[name] < (MIN_GAP[name] || 50)) return;
  A.recent = A.recent.filter(t => now - t < 100); if (A.recent.length > 10) return; A.recent.push(now); A.last[name] = now;
  const s3 = S3(); if (s3 && s3.tocar(name, vol, delay, ev, A.raca || racaDaTela())) return; /* 5.0f: pela voz do mixer (posição, abafamento, reverberação, prioridade) */
  desenha(name, vol, delay); /* antes da 5.0f (e enquanto os efeitos pré-gravados não ficam prontos): a síntese ao vivo */
};
const racaDaTela = () => { try { return document.documentElement.dataset.race || null; } catch (e) { return null; } }; /* 5.0f: na tela inicial, a Raça em destaque */
/* 5.0f: avisos da partida (src/main.js, ui.notice do src/input.js): o comando recusado ganha o som de erro da Raça; os avisos de confirmação, o clique */
A.aviso = function (texto) { const t = String(texto || ''); const ok = ['input.reuniao', 'input.grupo'].some(k => { const r = TX(k, { n: 0 }); const raiz = String(r).split(/[0-9{]/)[0].trim(); return raiz && t.indexOf(raiz) === 0; }); A.sfx(ok ? 'click' : 'erro', 0.8); };
/* 5.0a.2: voz do sistema escolhida pela qualidade. Cada voz do aparelho ganha um nível: 6 neurais do Edge ("Online (Natural)": Francisca, Antonio,
   Thalita) · 5 Google português do Brasil · 4 Apple aprimorada ou Premium (Luciana, Felipe) · 3 Apple comum · 2 outras (Android e afins) · 1 antigas
   do Windows (Maria, Daniel, Heloisa, "Desktop") · 0 robóticas (Eloquence da Apple: Eddy, Flo, Vovó…; eSpeak). Português do Brasil vem antes de
   Portugal, as robóticas por último, e voz de outra língua nunca lê o texto. Antes: a primeira pt-BR da lista (no Edge e no Chrome a Maria antiga,
   no iPhone a Eddy) com pitch 0.85, o que deixava tudo com cara de GPS. A voz escolhida em Ajustes ('ard-audio'.voz) vale por cima da Automática. */
const NOVIDADE = /^(Eddy|Flo|Grandma|Grandpa|Vov[óô]|Reed|Rocko|Sandy|Shelley|Albert|Bad News|Bahh|Bells|Boing|Bubbles|Cellos|Good News|Jester|Organ|Superstar|Trinoids|Whisper|Wobble|Zarvox|Fred|Junior|Kathy|Ralph)\b/i;
const vozId = v => (v && (v.voiceURI || v.name)) || '';
const temFala = () => typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
function nivel(v) { const n = v.name || '', u = v.voiceURI || '';
  if (/espeak|eloquence/i.test(n + ' ' + u) || NOVIDADE.test(n)) return 0;
  if (/Microsoft/i.test(n) && /Natural|Online/i.test(n)) return 6;
  if (/^Google/i.test(n)) return 5;
  if (/Aprimorad|Enhanced|Premium|Melhorad|Mejorad/i.test(n) || /\.(enhanced|premium)\./i.test(u)) return 4; /* 5.0c: Mejorada */
  if (/^com\.apple\./i.test(u) || /^(Luciana|Felipe|Fernanda|Joana|Catarina)\b/i.test(n)) return 3;
  return /Microsoft/i.test(n) ? 1 : 2; }
const PREF = [/Francisca/i, /Antonio/i, /Thalita/i, /Luciana/i, /Felipe/i]; /* ordem pedida dentro do mesmo nível */
/* 5.0c: voz no idioma do jogo (ARD.idioma). Mesmo critério de qualidade; a região principal vem antes (Brasil; EUA e Reino Unido; América Latina),
   e a voz escolhida em Ajustes só vale se for do idioma atual. Os nomes de cada idioma dizem o gênero, como nas listas do português. */
const IDI = () => (globalThis.ARD && ARD.idioma) || 'pt-BR';
const TX = (k, v, r) => (globalThis.ARD && ARD.t ? ARD.t(k, v, r) : (r != null ? r : k));
const LINGUA = { 'pt-BR': /^pt(-|$)/i, en: /^en(-|$)/i, es: /^es(-|$)/i };
const REGIAO = { 'pt-BR': /^pt-BR$/i, en: /^en-(US|GB)$/i, es: /^es-(419|MX|US|CO|AR|CL|PE|VE|UY|EC|BO|PY|CR|PA|DO|GT|HN|NI|SV|PR|CU)$/i };
const LANG_FALA = { 'pt-BR': 'pt-BR', en: 'en-US', es: 'es-MX' };
const PREFS = { en: [/Aria/i, /Jenny/i, /Guy/i, /Andrew/i, /Ava/i, /Samantha/i, /Daniel/i], es: [/Dalia/i, /Jorge/i, /Paloma/i, /Alonso/i, /Paulina/i, /Juan/i] };
const VOZES_F = { en: /(^|[\s(])(Aria|Jenny|Michelle|Emma|Ana|Ava|Sonia|Libby|Maisie|Natasha|Clara|Samantha|Allison|Susan|Victoria|Karen|Moira|Tessa|Fiona|Serena|Zira|Hazel|Zoe|Nicky|Kate)(?![a-z])|^Google (US English|UK English Female)/i,
  es: /(^|[\s(])(Dalia|Paloma|Salom[eé]|Elena|Elvira|Camila|Catalina|Paulina|M[oó]nica|Marisol|Ang[eé]lica|Isabela|Helena|Laura|Sabina|Ximena|Renata)(?![a-z])|^Google espa[nñ]ol/i };
const VOZES_M = { en: /(^|[\s(])(Guy|Davis|Christopher|Eric|Roger|Steffan|Andrew|Brian|Ryan|Thomas|William|Liam|Alex|Daniel|Fred|Tom|Aaron|Arthur|Evan|Nathan|Rishi|David|Mark|George|Oliver)(?![a-z])|^Google UK English Male/i,
  es: /(^|[\s(])(Jorge|Alonso|Gonzalo|Tom[aá]s|[AÁ]lvaro|Gerardo|Emilio|Juan|Diego|Carlos|Pablo|Ra[uú]l|Enrique|Mateo)(?![a-z])/i };
const TAGK = ['voz.tag.robotica', 'voz.tag.antiga', '', 'voz.tag.apple', 'voz.tag.apple-apr', '', 'voz.tag.neural'];
const TAG = ['robótica', 'antiga do Windows', '', 'Apple', 'Apple aprimorada', '', 'neural do Edge'];
function nomeCurto(n) { return String(n || '').replace(/^Microsoft\s+/i, '').replace(/\s*Online\s*\(Natural\)/i, '').replace(/\s+-\s+.*$/, '').replace(/\s+Desktop\b/i, '').replace(/\s*\((?:Portugu[eê]s|Portuguese)\s*\([^)]*\)\)\s*$/i, '').replace(/Multilingual$/i, ' multilíngue').trim(); }
/* 5.0a.3: voz por líder. No modo Automática, as falas de líder (chave 'sala-<raça>', ou a raça no 4º argumento de A.say) usam uma voz do gênero
   de quem fala. 5.0b.1: a melhor voz do gênero do líder entre as vozes boas do aparelho, de qualquer nível a partir do 1 (nunca uma robótica, nível 0),
   na ordem do ranking (português do Brasil antes de Portugal); sem voz daquele gênero, fala a melhor de todas. Antes (5.0a.3) a troca de gênero só
   valia no nível da melhor voz: no Chrome do Windows a melhor é a Google (feminina, nível 5) e o único homem é o Daniel antigo (nível 1), e todos os
   líderes saíam com a Google. Locutor e unidades seguem com a Automática, e a voz escolhida em Ajustes vale para todas as falas.
   O gênero da voz sai destas listas de nomes (as vozes em português que os navegadores trazem): neurais
   do Edge (Francisca, Thalita / Antonio; de Portugal, Raquel e Fernanda / Duarte; e as do Azure que o Edge às vezes lista), antigas do Windows (Maria,
   Heloisa, Hélia / Daniel), Apple (Luciana, Fernanda, Joana, Catarina / Felipe; as "novidades" Flo, Sandy, Shelley, Vovó, Grandma / Eddy, Reed, Rocko,
   Vovô, Grandpa) e a Google português do Brasil, que é feminina. Voz fora das listas (Android, Samsung, eSpeak) fica sem gênero e nunca é escolhida por ele. */
const GENERO_LIDER = { vehnar: 'm', erevane: 'm', tessara: 'f', quorith: 'm', vorag: 'm' }; /* Barão-Forja, Vesper Ísk, Sylvia Oriel, Zayin Coral, Oru Voraz */
/* 5.0c: o locutor da partida (unidade pronta, obra, pesquisa, alertas, voz ativada) fala no gênero do locutor da Raça do jogador no elenco das vozes
   gravadas (tools/vozes/racas.py: Vehnar, Quorith e Vorag com o Alex, a Erevane com o Santa e o Alex desde a 5.0c.2; a Tessara com a Dora). Antes ele usava a melhor voz do aparelho, de
   qualquer gênero: no Chrome a Google, feminina, para as cinco Raças. A.raca = Raça do jogador na partida (src/main.js); fora dela, a Automática */
const GENERO_LOCUTOR = { vehnar: 'm', erevane: 'm', tessara: 'f', quorith: 'm', vorag: 'm' }; /* 5.0c.2: o locutor da Erevane passa a masculino (pedido do dono em 30/10: voz feminina só na Tessara, da Sylvia Oriel) */
const VOZ_F = /(^|[\s(])(Francisca|Thalita(?:Multilingual)?|Raquel|Fernanda|Maria|Heloisa|H[eé]lia|Luciana|Joana|Catarina|Brenda|Elza|Giovanna|Leila|Let[ií]cia|Manuela|Yara|Flo|Sandy|Shelley|Vov[óo]|Grandma)(?![a-z])|^Google portugu[eê]s/i;
const VOZ_M = /(^|[\s(])(Ant[oô]nio(?:Multilingual)?|Duarte|Daniel|Felipe|Donato|F[aá]bio|Humberto|J[uú]lio|Nicolau|Val[eé]rio|Macerio(?:Multilingual)?|Ricardo|Cristiano|Eddy|Reed|Rocko|Vovô|Grandpa)(?![a-z])/i;
function generoVoz(v) { const n = String((v && v.name) || '').replace(/^Microsoft\s+/i, ''); const I = IDI(), F = VOZES_F[I] || VOZ_F, M = VOZES_M[I] || VOZ_M; return F.test(n) ? 'f' : M.test(n) ? 'm' : null; } /* 5.0c */
let RANK = null, RANK_T = 0, RANK_I = ''; const RUIM = new Set(); /* vozes que falharam nesta sessão (voz online sem rede, por exemplo) */
function ranking() {
  if (RANK && RANK_I === IDI() && performance.now() - RANK_T < 5000) return RANK; if (!temFala()) return []; /* 5.0c: o cache lembra o idioma */
  let vs = []; try { vs = speechSynthesis.getVoices() || []; } catch (e) {}
  const I = IDI(), PR = PREFS[I] || PREF; const r = []; vs.forEach((v, i) => { const lang = String(v.lang || '').replace('_', '-'); const br = (REGIAO[I] || REGIAO['pt-BR']).test(lang); if (!br && !(LINGUA[I] || LINGUA['pt-BR']).test(lang)) return; /* 5.0c: vozes do idioma do jogo */
    const nv = nivel(v), pi = PR.findIndex(re => re.test(v.name || '')); const nota = (nv > 0 ? 2000 : 0) + (br ? 1000 : 0) + nv * 100 + (pi >= 0 ? 50 - pi * 5 : 0) + (/Premium/i.test((v.name || '') + ' ' + (v.voiceURI || '')) ? 2 : 0) + (v.default ? 1 : 0);
    r.push({ v, id: vozId(v), nota, nivel: nv, br, i, genero: generoVoz(v) /* 5.0a.3 */, rotulo: nomeCurto(v.name) + (TAGK[nv] ? ' · ' + TX(nv === 4 && /Aprimorad|Enhanced|Premium|Melhorad|Mejorad/i.test(v.name || '') ? 'voz.tag.apple' : TAGK[nv], null, nv === 4 && /Aprimorad|Enhanced|Premium|Melhorad/i.test(v.name || '') ? 'Apple' : TAG[nv]) : '') + (br ? '' : ' · ' + (I === 'pt-BR' ? TX('voz.regiao.outra', null, 'Portugal') : lang)) }); });
  r.sort((a, b) => b.nota - a.nota || a.i - b.i); if (vs.length) { RANK = r; RANK_T = performance.now(); RANK_I = I; } return r;
}
function pickVoice(id, genero) { const r = ranking(), want = id != null ? id : A.voz; if (want) { const f = r.find(x => x.id === want && !RUIM.has(x.id)); if (f) return f.v; } const b = r.find(x => !RUIM.has(x.id));
  if (b && genero && b.genero !== genero) { const g = r.find(x => !RUIM.has(x.id) && x.nivel >= 1 && x.genero === genero); if (g) return g.v; } /* 5.0b.1: fala de líder: a melhor voz do gênero, de qualquer nível a partir do 1 */
  return b ? b.v : null; }
/* 5.0a.2: falas por tipo — intervalo mínimo para repetir a mesma fala (s) e prioridade. A maior interrompe a menor (o perigo corta "Unidade pronta";
   uma fala de líder ou o "Ouvir" corta a anterior do mesmo tipo); avisos de rotina (unidade, obra, pesquisa) guardam 3 s entre si e não fazem fila: com a voz ocupada,
   ficam de fora; o resto espera numa fila de uma fala só, que é descartada se envelhecer 4 s. A legenda segue a mesma decisão. */
const TIPOS = { sistema: { gap: 0, p: 4 }, perigo: { gap: 12, p: 3 }, lider: { gap: 4, p: 2 }, evento: { gap: 15, p: 2 }, pesquisa: { gap: 6, p: 1 }, obra: { gap: 10, p: 1 }, unidade: { gap: 12, p: 1 },
  resposta: { gap: 2.5, p: 1.5 }, reacao: { gap: 30, p: 2 }, campanha: { gap: 0, p: 2.5 } }; /* 5.0c.1: resposta das unidades (corta aviso de rotina e a resposta anterior, nunca faz fila), reação do líder na partida e fala da campanha */
const TIPO_DA_CHAVE = { built: 'obra', spawn: 'unidade', 'Pesquisa concluída': 'pesquisa', 'Base sob ataque': 'perigo', 'Núcleo sob ataque': 'perigo', 'Alerta de sifão': 'perigo', 'Pacto quebrado': 'perigo',
  'Tempestade de Éter': 'evento', Blecaute: 'evento', 'Fundição Orbital': 'evento', 'Salto de Núcleo': 'evento', 'Pacto assinado': 'evento', elim: 'evento', 'voz-on': 'sistema' };
const ROTINA_GAP = 3000, FILA_MAX = 4000; const ultima = {}; let ultimaRotina = -1e9, cur = null, fila = null;
/* 5.0c.1: chaves novas pelo prefixo (unid:<classe>:<ação>, lider:<evento>, camp:<missão>:<n>, loc:<aviso>, elim:<IA>); respostas guardam 0,25 s entre si
   (os dois comandos de um clique com grupo misto viram uma resposta só; a ordem logo depois da seleção corta a resposta da seleção) e as reações do líder 12 s (com a fila, o líder fala depois do locutor) */
const PREFIXO = [[/^sala-/, 'lider'], [/^unid:/, 'resposta'], [/^lider:/, 'reacao'], [/^camp:/, 'campanha'], [/^(loc|elim):/, 'evento']];
function tipoDe(key, forc) { if (forc && TIPOS[forc]) return forc; if (TIPO_DA_CHAVE[key]) return TIPO_DA_CHAVE[key]; for (const [re, t] of PREFIXO) if (re.test(key)) return t; return null; }
const RESPOSTA_GAP = 250, REACAO_GAP = 12000; let ultimaResposta = -1e9, ultimaReacao = -1e9;
function decide(key, cooldown, now, forc) {
  const conhecida = tipoDe(key, forc) /* 5.0c.1 */, tipo = conhecida || 'evento', T = TIPOS[tipo];
  const gap = cooldown === 0 ? 0 : conhecida ? Math.max(T.gap, cooldown || 0) : (cooldown == null ? 6 : cooldown); /* chave nova: o intervalo de quem chamou */
  if (gap && ultima[key] != null && now - ultima[key] < gap * 1000) return null;
  if (T.p === 1 && now - ultimaRotina < ROTINA_GAP) return null;
  if ((tipo === 'resposta' && now - ultimaResposta < RESPOSTA_GAP) || (tipo === 'reacao' && now - ultimaReacao < REACAO_GAP)) return null; /* 5.0c.1 */
  return { tipo, p: T.p };
}
/* 5.0b: gancho de palavras da voz: o evento 'ard-voz' no window traz { tipo: 'inicio' | 'palavra' | 'fim', texto, i, n } (posição e tamanho da palavra,
   do evento boundary do speechSynthesis); a Sala de Comando mexe a boca do líder com ele */
function voiceHook(u, text, c) { const ev = (tipo, i, n) => { try { window.dispatchEvent(new CustomEvent('ard-voz', { detail: { tipo, texto: text, i: i || 0, n: n || 0 } })); } catch (e) {} };
  u.onstart = () => { c.ini = true; ev('inicio'); }; u.onboundary = e => { if (!e.name || e.name === 'word') ev('palavra', e.charIndex, e.charLength); }; u.onend = () => { ev('fim'); acabou(c); depoisDaFala(); }; u.onerror = e => { ev('fim'); falhou(c, e); depoisDaFala(); }; } /* 5.0c.1: o Web Audio do iOS volta no fim da fala */
function comecar(text, d, voz, tentativa) {
  let u; try { u = new SpeechSynthesisUtterance(text); } catch (e) { cur = null; return false; }
  const v = voz || pickVoice(null, d.genero) /* 5.0a.3: d.genero = gênero do líder que fala */; if (v) { try { u.voice = v; } catch (e) {} } u.lang = (v && v.lang) || LANG_FALA[IDI()] /* 5.0c */; u.pitch = 1; u.rate = d.p === 3 ? 1.05 : 1; u.volume = 0.9; /* 5.0a.2: tom natural (antes 0.85 e 1.05) */
  const c = cur = { u, p: d.p, tipo: d.tipo, text, d, tentativa: tentativa || 0, t0: performance.now(), fim: performance.now() + 3000 + text.length * 150 }; voiceHook(u, text, c); A.fala = u; /* referência viva: sem ela o Chrome pode perder o onend */
  try { if (speechSynthesis.paused) speechSynthesis.resume(); speechSynthesis.speak(u); } catch (e) { cur = null; return false; }
  return true;
}
function acabou(c) { if (cur !== c) return; cur = null; proxima(); }
function proxima() { while (fila) { const f = fila; fila = null; if (performance.now() - f.t <= FILA_MAX) { if (f.g) comecarGravada(f.text, f.d, f.g, f.o); else comecar(f.text, f.d); return; } } } /* 5.0c.1: a fila guarda também a fala gravada */
/* 5.0c.1: voz do sistema permitida? No iPhone com vozes gravadas, não (src/vozes.js, IOS_FALA_SISTEMA): a fala sem arquivo fica só na legenda */
const podeSistema = () => temFala() && !(VZ() && VZ().semFalaSistema());
/* 5.0c.1: fala gravada pelo Web Audio, no mesmo lugar da fala do sistema (cur): a prioridade, o intervalo, a fila e o corte valem igual; o 'ard-voz'
   sai com o tempo real de cada palavra do manifesto (i e n no texto, dur em s, gravada: true). Se o arquivo falhar, a voz do sistema assume (menos no iPhone). */
function comecarGravada(text, d, g, o, marca) { o = o || {}; const now = performance.now(); const vz = VZ(); if (!vz) return false;
  const c = cur = marca || {}; Object.assign(c, { p: d.p, tipo: d.tipo, text, d, g, o, t0: now, grav: true, fim: now + (o.espera || 0) + 4000 + (g.dur || 3) * 1000 });
  const ev = (tipo, i, n, dur) => { try { window.dispatchEvent(new CustomEvent('ard-voz', { detail: { tipo, texto: g.texto, i: i || 0, n: n || 0, dur: dur || 0, gravada: true, chave: g.chave, raca: o.raca || null, lider: !!o.lider } })); } catch (e) {} };
  c.h = vz.tocar(g, { inicio: () => { c.ini = true; ev('inicio'); }, palavra: (i, n, dur) => ev('palavra', i, n, dur), fim: () => { ev('fim'); if (/^sala-/.test(g.chave || '') && vz.depoisDaSala) vz.depoisDaSala(o.raca); acabou(c); },
    falhou: mot => { if (cur !== c) return; cur = null; if (o.aoFalhar) try { o.aoFalhar(mot); } catch (e) {} if (o.sistema !== false && podeSistema() && comecar(o.textoSistema || text, d)) return; proxima(); } }, { espera: o.espera || 0 });
  return true; }
function falhou(c, e) { if (cur !== c) return; cur = null; const er = String((e && e.error) || '');
  if (!/interrupted|canceled/.test(er) && c.u.voice && c.tentativa < 2) { /* voz online sem rede: todas as online saem até a rede voltar e a fala repete na melhor local */
    if (c.u.voice.localService === false) { for (const x of ranking()) if (x.v.localService === false) RUIM.add(x.id); } else RUIM.add(vozId(c.u.voice));
    UIS.forEach(preencher); if (comecar(c.text, c.d, null, c.tentativa + 1)) return; }
  proxima(); }
function falar(text, d, voz, g, o) { /* 5.0c.1: g = fala gravada (src/vozes.js), o = opções do A.say */
  const now = performance.now(); if (cur && now > cur.fim) { const vel = cur; cur = null; if (vel.h) try { vel.h.parar(0); } catch (e) {} } /* o onend não veio: libera a voz */
  if (cur) {
    if (d.p > cur.p || (d.tipo === cur.tipo && (d.tipo === 'lider' || d.tipo === 'sistema' || d.tipo === 'resposta'))) { const ant = cur, marca = cur = { p: d.p, tipo: d.tipo, fim: now + 2000, sis: !g }; fila = null;
      if (ant.h) { try { ant.h.parar(); } catch (e) {} } /* 5.0c.1: a gravada sai com um fade curto */ else if ((ant.u || ant.sis) && temFala()) { try { speechSynthesis.cancel(); } catch (e) {} } /* 5.0c.1: o cancel só quando a voz do sistema falava (no iPhone com vozes gravadas ela nem é chamada) */
      if (g) comecarGravada(text, d, g, o, marca); else setTimeout(() => { if (cur === marca) comecar(text, d, voz); }, 60); return true; } /* falar logo depois do cancel perde a fala no Chrome */
    if (d.p >= 2 && !fila) { fila = { text, d, t: now, g, o }; return true; }
    return false;
  }
  return g ? comecarGravada(text, d, g, o) : comecar(text, d, voz);
}
A.onSay = null; /* 5.0b: legendas — cada fala aceita também vai para A.onSay(texto, chave), que a Interface 3.0 mostra com o retrato do líder (mesmo com a voz desligada) */
/* 5.0c.1: o = { chaves (candidatas), pacote, partes (sequência: [{ chaves }]), tipo, legenda (false = sem A.onSay), soGravada (sem a fala gravada pronta, nada),
   espera (ms para o arquivo chegar), campRaca, g (fala já escolhida), sistema (false = sem a voz do sistema se a gravada falhar), textoSistema, aoFalhar, lider }.
   Com a fala gravada pronta (bytes na memória), ela toca pelo Web Audio e a legenda usa o texto do manifesto do idioma atual; sem ela, a voz do
   sistema, como antes (no iPhone com vozes gravadas, só a legenda); a fala que ainda não chegou é pedida para a próxima vez. */
A.say = function (text, key, cooldown, quem, o) { /* 5.0a.3: quem = raça do líder que fala (a chave 'sala-<raça>' da Sala de Comando já diz quem é) */
  key = key || text; o = o || {}; const now = performance.now(); const d = decide(key, cooldown, now, o.tipo); if (!d) return false;
  const lid = quem || (/^sala-([a-z]+)$/.exec(key) || [])[1]; { if (lid && GENERO_LIDER[lid]) d.genero = GENERO_LIDER[lid]; else if (A.raca && GENERO_LOCUTOR[A.raca]) d.genero = GENERO_LOCUTOR[A.raca]; } /* 5.0a.3; 5.0c: o locutor da Raça */
  const vz = VZ(); if (vz && o.espera == null && /^sala-/.test(key)) o = Object.assign({}, o, { espera: vz.ESPERA_SALA }); /* 5.0c.1: a saudação da Sala espera o arquivo da Raça nova */
  const g0 = A.voice && vz ? (o.g || vz.achar(o.chaves || key, lid || null, o)) : null, g = g0 && (g0.pronta || o.espera > 0) ? g0 : null; if (g0 && !g && vz.pedir) vz.pedir(g0); /* 5.0c.1 */
  const txt = g ? g.texto : text != null ? text : g0 ? g0.texto : null; if (txt == null || (!g && o.soGravada)) return false;
  const sis = !g && A.voice && podeSistema(); if (sis && !D.voz && movel()) D.pronto = false; /* 5.0c.1: a voz do sistema voltou a valer no celular: o próximo toque prepara */
  if (A.voice && (g || sis) && !falar(txt, d, null, g, Object.assign({ raca: lid || A.raca || null }, o))) return false;
  ultima[key] = now; if (d.p === 1) ultimaRotina = now; if (d.tipo === 'resposta') ultimaResposta = now; else if (d.tipo === 'reacao') ultimaReacao = now; /* 5.0c.1 */
  if (A.onSay && o.legenda !== false) { try { A.onSay(txt, key); } catch (e) {} }
  return true;
};
A.setEnabled = function (on) { A.enabled = on; save(); sessao(); htmlMudo(); if (on) retomar(); MIX.forEach(mixSync); /* 5.0f */ }; A.setVoice = function (on) { A.voice = on; save(); sessao(); htmlMudo(); if (!on) { calar(); } };
/* 5.0c.1: cala a fala atual (gravada ou do sistema) e esvazia a fila */
function calar() { const c = cur; fila = null; cur = null; if (c && c.h) try { c.h.parar(); } catch (e) {} if (temFala() && !(VZ() && VZ().semFalaSistema() && !(c && (c.u || c.sis)))) try { speechSynthesis.cancel(); } catch (e) {} }
A.calar = calar; A.refazUI = () => UIS.forEach(preencher); /* 5.0c.1: a dica muda quando as vozes gravadas ficam prontas ou indisponíveis */
/* 5.0f: volumes e liga/desliga em separado (Ajustes), salvos no 'ard-audio' como os de antes. Efeitos: A.enabled e A.volSom (1 = o volume de hoje);
   música: A.musica e A.volMusica; saída do som 3D: 'fone' (HRTF) ou 'caixa' (panorâmica simples; o celular usa sempre a simples) */
function aplicaVolumes() { if (A.master && A.ctx) try { A.master.gain.setTargetAtTime(GANHO_EFEITOS * A.volSom, A.ctx.currentTime, 0.03); } catch (e) {} const s3 = S3(); if (s3 && s3.volumes) s3.volumes(); if (globalThis.ARD && ARD.musica && ARD.musica.ajustes) ARD.musica.ajustes(); }
A.setVolSom = function (v) { A.volSom = vol01(v); save(); aplicaVolumes(); MIX.forEach(mixSync); };
A.setMusica = function (on) { A.musica = !!on; save(); if (on) { A.init(); retomar(); } aplicaVolumes(); MIX.forEach(mixSync); };
A.setVolMusica = function (v) { A.volMusica = vol01(v); save(); aplicaVolumes(); MIX.forEach(mixSync); };
A.setSaida = function (s) { A.saida = s === 'caixa' ? 'caixa' : 'fone'; save(); const s3 = S3(); if (s3 && s3.saida) s3.saida(); MIX.forEach(mixSync); };
/* 5.0f: o bloco de mixagem em Ajustes (tela inicial e partida), montado aqui antes de cada [data-voz-ui]: efeitos (na partida, com o liga/desliga; na
   tela inicial ele já existe ao lado), volume dos efeitos, música com liga/desliga e volume, e a saída do som 3D (só no computador) */
const MIX = [];
function mixMonta(box) { if (!box || box.__mix || typeof document === 'undefined' || !box.parentNode) return; box.__mix = 1; const d = document.createElement('div'); d.className = 'opt som-mix'; d.setAttribute('data-som-mix', '');
  const n = MIX.length + 1, temEf = !document.getElementById('opt-som') || !!(box.closest && box.closest('#a11y')), toque = movel();
  const lin = (k, extra) => '<div class="som-lin" style="display:flex;align-items:center;gap:.5em;flex-wrap:wrap">' + extra + '<input type="range" min="0" max="100" step="5" id="som-' + k + '-' + n + '" data-som-' + k + ' style="flex:1 1 8em;min-width:6em;max-width:16em"></div>';
  d.innerHTML = lin('vol-efeitos', (temEf ? '<label class="chk"><input type="checkbox" data-som-efeitos> <span data-i18n="som.efeitos">' + esc(TX('som.efeitos', null, 'Efeitos')) + '</span></label>' : '') + '<label for="som-vol-efeitos-' + n + '" data-i18n="som.vol-efeitos">' + esc(TX('som.vol-efeitos', null, 'Volume dos efeitos')) + '</label>')
    + lin('vol-musica', '<label class="chk"><input type="checkbox" data-som-musica> <span data-i18n="som.musica">' + esc(TX('som.musica', null, 'Música')) + '</span></label><label for="som-vol-musica-' + n + '" data-i18n="som.vol-musica">' + esc(TX('som.vol-musica', null, 'Volume da música')) + '</label>')
    + (toque ? '' : '<div class="som-lin" style="display:flex;align-items:center;gap:.5em;flex-wrap:wrap"><label for="som-saida-' + n + '" data-i18n="som.saida">' + esc(TX('som.saida', null, 'Som 3D')) + '</label><select id="som-saida-' + n + '" data-som-saida><option value="fone" data-i18n="som.saida.fone">' + esc(TX('som.saida.fone', null, 'Fone de ouvido (HRTF)')) + '</option><option value="caixa" data-i18n="som.saida.caixa">' + esc(TX('som.saida.caixa', null, 'Caixas de som')) + '</option></select></div>')
    + creditosHTML() /* 5.0f.1 */;
  box.parentNode.insertBefore(d, box); MIX.push(d);
  const q = s => d.querySelector(s), ef = q('[data-som-efeitos]'), ve = q('[data-som-vol-efeitos]'), mu = q('[data-som-musica]'), vm = q('[data-som-vol-musica]'), sa = q('[data-som-saida]');
  if (ef) ef.addEventListener('change', () => { A.setEnabled(ef.checked); if (ef.checked) { A.init(); A.resume(); A.sfx('click'); } try { const os = document.getElementById('opt-som'); if (os) os.checked = A.enabled; } catch (e) {} });
  ve.addEventListener('input', () => A.setVolSom(+ve.value / 100)); ve.addEventListener('change', () => A.sfx('click'));
  mu.addEventListener('change', () => A.setMusica(mu.checked)); vm.addEventListener('input', () => A.setVolMusica(+vm.value / 100)); if (sa) sa.addEventListener('change', () => A.setSaida(sa.value));
  mixSync(d); }
function mixSync(d) { const q = s => d.querySelector(s), ef = q('[data-som-efeitos]'), ve = q('[data-som-vol-efeitos]'), mu = q('[data-som-musica]'), vm = q('[data-som-vol-musica]'), sa = q('[data-som-saida]');
  if (ef && ef.checked !== A.enabled) ef.checked = A.enabled; if (ve && +ve.value !== Math.round(A.volSom * 100)) ve.value = Math.round(A.volSom * 100); if (ve) ve.disabled = !A.enabled;
  if (mu && mu.checked !== (A.musica !== false)) mu.checked = A.musica !== false; if (vm && +vm.value !== Math.round(A.volMusica * 100)) vm.value = Math.round(A.volMusica * 100); if (vm) vm.disabled = A.musica === false; if (sa && sa.value !== A.saida) sa.value = A.saida; }
A.mixUI = () => MIX.forEach(mixSync); /* 5.0f */
/* 5.0f.1: créditos da trilha e dos efeitos de arquivo (assets/som/; a licença CC BY 4.0 pede o crédito de cada faixa). Os títulos e os nomes ficam no original, marcados lang="en" */
const FAIXAS = ['Crusade - Heavy Industry', 'Industrial Cinematic', 'Industrial Revolution', 'Lost Frontier', 'Oppressive Gloom', 'Rynos Theme', 'Mystic Force', 'Invariance', 'Constance', 'Tempting Secrets', 'Spellbound', 'Final Battle of the Dark Wizards', 'Drums of the Deep', 'Steel Rods', 'Corruption', 'Black Vortex', 'Our Story Begins', 'Mechanolith', 'Discovery Hit', 'Peaceful Desolation'];
function creditosHTML() { return '<details class="som-creditos" style="margin-top:.4em;font-size:.85em"><summary data-i18n="som.creditos">' + esc(TX('som.creditos', null, 'Créditos do som')) + '</summary><p style="margin:.4em 0"><span data-i18n="som.creditos.musica">' + esc(TX('som.creditos.musica', null, 'Música')) + '</span>: <span lang="en">' + FAIXAS.map(t => '“' + esc(t) + '”').join(', ')
  + ' — Kevin MacLeod (incompetech.com), Creative Commons: By Attribution 4.0 (creativecommons.org/licenses/by/4.0/).</span></p><p style="margin:.4em 0"><span data-i18n="som.creditos.efeitos">' + esc(TX('som.creditos.efeitos', null, 'Efeitos')) + '</span>: <span lang="en">Kenney (kenney.nl), rubberduck, qubodup, Joth, pauliuw, Nenad Simic (opengameart.org), CC0.</span></p></details>'; }
/* 5.0c.1: Vozes gravadas (Ajustes): ligadas por padrão; desligadas, todas as falas usam a voz do sistema (como na 5.0c) */
A.setGravadas = function (on) { A.gravadas = !!on; save(); calar(); const vz = VZ(); if (vz && vz.mudou) vz.mudou(); UIS.forEach(preencher); htmlMudo(); }; /* 5.0b.1: a sessão de reprodução e o áudio mudo do iOS seguem o som e a voz */
/* 5.0a.2: escolha da voz em Ajustes (tela inicial e partida): cada bloco [data-voz-ui] tem um select[data-voz-sel], um botão [data-voz-ouvir] e um texto
   [data-voz-dica]. Os blocos ficam em sincronia e se refazem quando o aparelho carrega mais vozes (o Edge traz as neurais depois das locais);
   "Ouvir" fala a frase de exemplo com a voz do select, mesmo com a voz do jogo desligada. */
const AMOSTRA = 'Comandante, a Fenda está estável e o Núcleo aguarda as suas ordens.';
const UIS = []; const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
function dica(r, best) { const ua = (typeof navigator !== 'undefined' && navigator.userAgent) || '', ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1), mac = !ios && /Macintosh/.test(ua), win = /Windows/.test(ua), ffx = /Firefox\//.test(ua), android = /Android/.test(ua);
  if (ios && A.gravadas !== false && VZ() && VZ().disponivel()) return TX('voz.d.ios-gravadas'); /* 5.0c.1: o Safari do iPhone só expõe a Luciana e a Joana compactas (nem as aprimoradas baixadas, nem voz masculina): com as vozes gravadas, a dica diz que o jogo fala com elas */
  if (!temFala()) return TX('voz.d.sem'); /* 5.0c: as dicas pelo dicionário */
  if (!r.length) return TX('voz.d.nenhuma') + (win ? ' ' + TX('voz.d.nenhuma-win') : '');
  const n = best ? best.nivel : 0;
  if (n === 6) return TX('voz.d.edge');
  if (n === 5) return TX('voz.d.google');
  if ((ios || mac) && n < 4) return TX('voz.d.apple', { onde: TX(ios ? 'voz.d.ios' : 'voz.d.mac') });
  if (win && ffx) return TX('voz.d.firefox');
  if (win && n <= 1) return TX('voz.d.win');
  if (android && n <= 2) return TX('voz.d.android');
  return ''; }
function preencher(box) {
  { const cg = box.querySelector('[data-voz-gravada]'); if (cg && cg.checked !== (A.gravadas !== false)) cg.checked = A.gravadas !== false; } /* 5.0c.1 */
  const sel = box.querySelector('[data-voz-sel]'), bt = box.querySelector('[data-voz-ouvir]'), dc = box.querySelector('[data-voz-dica]'); if (!sel) return;
  const r = ranking(), best = r.find(x => !RUIM.has(x.id)), op = x => `<option value="${esc(x.id)}">${esc(x.rotulo)}${RUIM.has(x.id) ? ' ' + esc(TX('voz.falhou')) : ''}</option>`; /* 5.0c */
  let h = `<option value="">${esc(TX('voz.auto'))}${best ? ' · ' + esc(best.rotulo) : ''}</option>`; const br = r.filter(x => x.br), pt = r.filter(x => !x.br);
  if (br.length) h += `<optgroup label="${esc(TX('voz.grupo.principal'))}">${br.map(op).join('')}</optgroup>`; if (pt.length) h += `<optgroup label="${esc(TX('voz.grupo.outras'))}">${pt.map(op).join('')}</optgroup>`;
  if (A.voz && !r.some(x => x.id === A.voz)) h += `<option value="${esc(A.voz)}">${esc(A.vozNome || nomeCurto(A.voz))} ${esc(TX('voz.indisp'))}</option>`;
  if (sel.__h !== h) { sel.__h = h; sel.innerHTML = h; } sel.value = A.voz || ''; sel.disabled = !temFala(); if (bt) bt.disabled = !temFala();
  if (dc) { const t = dica(r, best); if (dc.textContent !== t) dc.textContent = t; dc.hidden = !t; }
}
A.vozes = () => ranking().map(x => ({ id: x.id, rotulo: x.rotulo, nivel: x.nivel, br: x.br }));
A.vozAtual = () => { const v = temFala() ? pickVoice() : null; return v ? { id: vozId(v), nome: v.name } : null; };
A.vozDoLider = raca => { const v = temFala() ? pickVoice(null, GENERO_LIDER[raca]) : null; return v ? { id: vozId(v), nome: v.name, genero: generoVoz(v) } : null; }; /* 5.0a.3: diagnóstico e testes */
A.generoVoz = generoVoz; A.GENERO_LIDER = GENERO_LIDER; A.GENERO_LOCUTOR = GENERO_LOCUTOR; A.raca = null; /* 5.0a.3; 5.0c */
A.setVoz = function (id) { A.voz = id || ''; const f = ranking().find(x => x.id === A.voz); A.vozNome = f ? nomeCurto(f.v.name) : ''; save(); UIS.forEach(preencher); };
A.ouvir = function (id) { if (!temFala()) return false; const sid = id != null ? id : A.voz, f = sid ? ranking().find(x => x.id === sid) : null; return falar(TX('voz.amostra', null, AMOSTRA) /* 5.0c */, { tipo: 'sistema', p: 4 }, f ? f.v : null); };
A.vozUI = function (box) { if (!box || box.__voz) return; box.__voz = 1; UIS.push(box); const sel = box.querySelector('[data-voz-sel]'), bt = box.querySelector('[data-voz-ouvir]'), ts = box.querySelector('[data-som-teste]');
  if (sel) sel.addEventListener('change', () => A.setVoz(sel.value)); if (bt) bt.addEventListener('click', () => A.ouvir(sel ? sel.value : A.voz)); if (ts) ts.addEventListener('click', () => A.testarSom(box)); /* 5.0b.1: Testar som */
  { const cg = box.querySelector('[data-voz-gravada]'); if (cg) cg.addEventListener('change', () => A.setGravadas(cg.checked)); } /* 5.0c.1: Vozes gravadas */ preencher(box); try { mixMonta(box); } catch (e) {} /* 5.0f */ };
if (temFala()) { const mudou = () => { RANK = null; UIS.forEach(preencher); }; try { addEventListener('online', () => { RUIM.clear(); mudou(); }); } catch (e) {} try { if (speechSynthesis.addEventListener) speechSynthesis.addEventListener('voiceschanged', mudou); else speechSynthesis.onvoiceschanged = mudou; speechSynthesis.getVoices(); } catch (e) {} }
try { addEventListener('ard-idioma', () => { RANK = null; RUIM.clear(); calar() /* 5.0c.1: também a gravada */; UIS.forEach(preencher); }); } catch (e) {} /* 5.0c: a lista e a voz mudam com o idioma, sem recarregar */
if (typeof document !== 'undefined' && document.querySelectorAll) { const liga = () => document.querySelectorAll('[data-voz-ui]').forEach(b => A.vozUI(b)); if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', liga); else liga(); }
/* 5.0b.1: som no celular. No iOS o Web Audio e a voz do sistema só começam dentro de um gesto de verdade: touchend, click, pointerup ou keydown
   (o touchstart e o pointerdown do toque não contam). Antes, o src/main.js só escutava pointerdown, keydown e touchstart: no iPhone o AudioContext
   nascia suspenso e só saía disso se um clique de botão tocasse um efeito; na partida, onde os efeitos e as falas vêm do jogo e não de um toque,
   ele ficava suspenso até o fim, e o iOS descartava toda fala da voz do sistema feita fora de um gesto. A.gesto(e) (o src/main.js liga em
   pointerdown, pointerup, touchend, click e keydown) destrava tudo no primeiro gesto de verdade: cria e retoma o AudioContext e toca um buffer mudo
   curto; liga a sessão de reprodução do iOS (navigator.audioSession.type = 'playback'), que não deixa a chave de silêncio do aparelho calar o jogo;
   e fala uma vez a voz do sistema com volume 0, dentro do gesto, para o iOS liberar as falas de depois. No computador o pointerdown do mouse segue
   valendo, como antes, e a fala de preparo e a sessão ficam de fora (só celular, tablet e Safari). Depois do desbloqueio, cada gesto custa uma
   conferência: se o contexto voltar a 'suspended' ou 'interrupted' (ligação, outro app, tela bloqueada), ele é retomado no 'statechange', ao
   voltar para a página (visibilitychange, pageshow) ou no próximo gesto. Sem a API de sessão (iOS mais antigo), um <audio> mudo em laço, com
   playsinline, faz o papel dela: só no iPhone e no iPad sem a API, só com o som do jogo ligado e a página à vista (pausa ao esconder). */
const D = { evento: null, gestos: 0, voz: false, vozEvento: null, mudoCurto: 0, retomadas: 0, interrompido: 0, pronto: false, el: null, elEvento: null, teste: null, porFala: 0, porFalaAgora: false, retomarDepois: false /* 5.0c.1 */ };
const UA = () => (typeof navigator !== 'undefined' && navigator.userAgent) || '';
const ehIOS = () => { const ua = UA(); return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1); };
const ehSafari = () => { const ua = UA(); return /AppleWebKit/.test(ua) && /Version\/[\d.]+.*Safari\//.test(ua) && !/Chrome|Chromium|CriOS|FxiOS|Edg|OPR|Android/.test(ua); };
const grosso = () => { try { return typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches; } catch (e) { return false; } };
const movel = () => ehIOS() || grosso(); /* celular e tablet */
const temSessao = () => { try { return typeof navigator !== 'undefined' && !!navigator.audioSession && 'type' in navigator.audioSession; } catch (e) { return false; } };
const visivel = () => typeof document === 'undefined' || !document.hidden;
function gestoValido(e) { if (!e || e.isTrusted === false) return false; const t = e.type;
  if (t === 'pointerdown') return e.pointerType === 'mouse'; /* no computador o clique do mouse já vale no pointerdown, como antes; o do toque não */
  if (t === 'keydown') return e.key !== 'Escape';
  return t === 'pointerup' || t === 'touchend' || t === 'click'; }
/* sessão de reprodução (iOS com a API): 'playback' com o som ou a voz do jogo ligados (ou no Testar som), 'auto' com os dois desligados */
function sessao(forcar) { if (!temSessao() || !movel()) return false; const s = navigator.audioSession, quer = forcar || A.enabled || A.voice ? 'playback' : 'auto';
  try { if (s.type !== quer) s.type = quer; } catch (e) {} return s.type === 'playback'; }
/* 5.0c.1: bancada do iPhone (iOS 18.7, 30/10/2026): a fala do sistema com a sessão 'playback' põe o AudioContext em 'interrupted' e o iOS o devolve
   sozinho depois dela; um resume() no meio da fala devolve a sessão ao Web Audio e CALA a voz (o "Fala: falando" com "Áudio: suspenso" dos testes
   do dono: o statechange daqui retomava na hora, e cada efeito pedia resume). No iOS, nada retoma o contexto enquanto a voz do sistema fala ou tem
   fala na fila (statechange, efeitos, gesto, volta à página, voz gravada): a retomada fica para o fim da fala (onend/onerror) ou para o próprio iOS. */
const falaAtiva = () => { try { return temFala() && !!(speechSynthesis.speaking || speechSynthesis.pending); } catch (e) { return false; } };
const segurar = () => ehIOS() && falaAtiva();
function depoisDaFala() { if (!D.retomarDepois) return; setTimeout(() => { if (segurar()) return; D.retomarDepois = false; D.porFalaAgora = false; if (D.evento && visivel()) retomar(); }, 60); }
function retomar(c) { c = c || A.ctx; if (!c || !c.resume || c.state === 'running' || c.state === 'closed') return; if (segurar()) { D.retomarDepois = true; return; } /* 5.0c.1 */
  try { const p = c.resume(); if (p && p.then) p.then(() => { if (c.state === 'running') { D.retomadas++; htmlMudo(); } }, () => {}); } catch (e) {} }
function vigiar(c) { const f = () => { if (c.state === 'running') { htmlMudo(); return; } D.pronto = false; if (segurar()) { if (!D.porFalaAgora) { D.porFalaAgora = true; D.porFala++; } } else if (c.state === 'interrupted') D.interrompido++; if (D.evento && visivel()) retomar(c); }; /* 5.0c.1: a interrupção pela voz do sistema conta à parte (diagnóstico) */
  try { if (c.addEventListener) c.addEventListener('statechange', f); else c.onstatechange = f; } catch (e) {} }
function bufferMudo(c) { try { const b = c.createBuffer(1, 1, 22050), s = c.createBufferSource(); s.buffer = b; s.connect(c.destination); if (s.start) s.start(0); else s.noteOn(0); D.mudoCurto++; } catch (e) {} }
/* fala presa: o iOS descarta sem aviso (sem start, end nem error) a fala feita fora de gesto antes do desbloqueio, e ela segurava a voz do jogo até o prazo
   dela (3 s ou mais). No gesto, se a fala atual nunca começou e o aparelho não está falando nada, ela é refeita ali dentro (com menos de 4 s) ou solta a fila */
function destravarFala() { const c = cur; if (!c || !c.u || c.ini) return; try { if (speechSynthesis.speaking || speechSynthesis.pending) return; } catch (e) { return; }
  cur = null; if (performance.now() - (c.t0 || 0) <= FILA_MAX) comecar(c.text, c.d, null, c.tentativa); else proxima(); }
/* fala de preparo: volume 0, dentro do gesto (se o próprio gesto já falou, ele mesmo serve de preparo); não passa pela fila, pela legenda nem pelo 'ard-voz' */
function prepararVoz(e) { if (D.voz || !temFala()) return; D.voz = true; D.vozEvento = e.type;
  try { if (speechSynthesis.speaking || speechSynthesis.pending) return; const u = new SpeechSynthesisUtterance('Som'); u.lang = LANG_FALA[IDI()]; /* 5.0c */ u.volume = 0; u.rate = 1.3; u.onend = u.onerror = depoisDaFala; /* 5.0c.1 */ D.prep = u; speechSynthesis.speak(u); } catch (er) { D.voz = false; } }
/* <audio> mudo em laço (iOS sem navigator.audioSession): um WAV de silêncio de 0,5 s gerado aqui, na taxa do AudioContext (outra taxa faria o iOS
   trocar a do aparelho e chiar o Web Audio); nasce e toca pela primeira vez dentro de um gesto, depois pausa e volta com o som e a página */
function wavMudo(taxa) { const n = Math.round(taxa / 2), b = new ArrayBuffer(44 + n * 2), d = new DataView(b), w = (o, t) => { for (let i = 0; i < t.length; i++) d.setUint8(o + i, t.charCodeAt(i)); };
  w(0, 'RIFF'); d.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt '); d.setUint32(16, 16, true); d.setUint16(20, 1, true); d.setUint16(22, 1, true); d.setUint32(24, taxa, true); d.setUint32(28, taxa * 2, true); d.setUint16(32, 2, true); d.setUint16(34, 16, true); w(36, 'data'); d.setUint32(40, n * 2, true);
  return new Blob([b], { type: 'audio/wav' }); }
const querMudo = () => A.enabled || (A.voice && A.gravadas !== false && !!(VZ() && VZ().disponivel())); /* 5.0c.1: a voz gravada também sai pelo Web Audio */
function htmlMudo(e) { if (!ehIOS() || temSessao() || typeof Audio === 'undefined') return; const quer = querMudo() && visivel() && !!D.evento;
  if (!quer) { if (D.el && !D.el.paused) try { D.el.pause(); } catch (er) {} return; }
  if (!D.el) { if (!e) return; try { const el = new Audio(); el.setAttribute('playsinline', ''); el.setAttribute('webkit-playsinline', ''); el.setAttribute('x-webkit-airplay', 'deny'); el.disableRemotePlayback = true; el.controls = false; el.loop = true; el.preload = 'auto';
    el.src = URL.createObjectURL(wavMudo(Math.round((A.ctx && A.ctx.sampleRate) || 44100))); D.el = el; D.elEvento = e.type; } catch (er) { return; } }
  if (D.el.paused) try { const p = D.el.play(); if (p && p.catch) p.catch(() => {}); } catch (er) {} }
/* 5.0c.1: no iPhone com vozes gravadas (src/vozes.js, IOS_PREPARO) o gesto não chama o speechSynthesis: sem fala de preparo e sem refazer fala presa */
const semPreparo = () => !!(VZ() && VZ().semPreparo());
A.gesto = function (e) { if (D.pronto || !gestoValido(e)) return; if (!D.evento) D.evento = e.type; D.gestos++;
  try { sessao(); A.init(); const c = A.ctx; if (c && c.state !== 'running' && !segurar() /* 5.0c.1: não no meio da voz do sistema (iOS) */) { bufferMudo(c); retomar(c); } if ((movel() || ehSafari()) && temFala() && !semPreparo()) { destravarFala(); prepararVoz(e); } htmlMudo(e); } catch (er) {}
  D.pronto = !!(A.ctx && A.ctx.state === 'running') && (D.voz || !temFala() || !(movel() || ehSafari()) || semPreparo()) && (!D.el || !D.el.paused || !querMudo()); };
if (typeof document !== 'undefined' && document.addEventListener) { const volta = () => { D.pronto = false; if (visivel() && D.evento) retomar(); htmlMudo(); }; document.addEventListener('visibilitychange', volta); try { addEventListener('pageshow', volta); } catch (e) {} }
/* diagnóstico (Testar som e testes): estado do áudio, sessão de reprodução, vozes em português e a voz usada */
const ESTADO = { running: 'tocando', suspended: 'suspenso', interrupted: 'interrompido', closed: 'fechado' };
const FALA_K = { esperando: 'esperando', falando: 'falando', tocou: 'tocou', falhou: 'falhou', 'não começou': 'nao-comecou', 'sem resposta (toque em Testar som de novo)': 'sem-resposta' }; /* 5.0c: o estado da fala fica em pt-BR no código; a linha sai no idioma */
A.gestoValido = gestoValido; A.desbloqueio = () => ({ evento: D.evento, gestos: D.gestos, voz: D.voz, vozEvento: D.vozEvento, mudoCurto: D.mudoCurto, retomadas: D.retomadas, interrompido: D.interrompido, porFala: D.porFala /* 5.0c.1 */, retomarDepois: D.retomarDepois, pronto: D.pronto, audioMudo: D.el ? (D.el.paused ? 'pausado' : 'tocando') : null, audioMudoEvento: D.elEvento });
A.diagnostico = function () { const c = A.ctx, s = temSessao() ? navigator.audioSession.type : null, t = D.teste;
  const vz = VZ(); return { audio: c ? c.state : null, sessao: s === 'playback' || !!(D.el && !D.el.paused), sessaoTipo: s, audioMudo: !!(D.el && !D.el.paused), precisaSessao: ehIOS(), vozesPt: ranking().length, voz: t ? t.voz : ((A.vozAtual() || {}).nome || null), fala: t ? t.fala : null, efeitos: A.enabled, vozJogo: A.voice,
    gravada: t ? t.gravada : null, gravadas: A.gravadas !== false, formato: vz ? vz.formato : null, manifesto: vz ? vz.estado : null, porFala: D.porFala }; }; /* 5.0c.1: a voz gravada no Testar som e o formato escolhido */
const GRAV_PT = { tocou: 'tocou', 'sem-arquivo': 'sem arquivo', formato: 'formato não decodifica', tocando: 'tocando', esperando: 'carregando', desligada: 'desligada em Ajustes', suspenso: 'Web Audio suspenso' }; /* 5.0c.1 */
function diagTexto(g) { const DG = (k, r, v) => TX('voz.diag.' + k, v, r); /* 5.0c: os pedaços pelo dicionário (o pt-BR fica igual ao da 5.0b.1) */
  const ses = g.sessaoTipo === 'playback' ? DG('sim', 'sim') : g.audioMudo ? DG('sim-mudo', 'sim (áudio mudo em laço)') : !g.precisaSessao ? DG('nao-precisa', 'não precisa neste aparelho') : g.sessaoTipo ? DG('nao', 'não') + ' (' + g.sessaoTipo + ')' : DG('nao', 'não');
  return DG('audio', 'Áudio') + ': ' + (g.audio ? (ESTADO[g.audio] ? DG('e.' + g.audio, ESTADO[g.audio]) : g.audio) : DG('sem-webaudio', 'sem Web Audio')) + ' · ' + DG('sessao', 'Sessão de reprodução') + ': ' + ses + ' · ' + DG('vozes', 'Vozes em português') + ': ' + g.vozesPt + ' · ' + DG('voz', 'Voz') + ': ' + (g.voz ? nomeCurto(g.voz) : temFala() ? DG('padrao', 'padrão do aparelho') : DG('sem-voz', 'sem voz do sistema'))
    + (g.fala ? ' · ' + DG('fala', 'Fala') + ': ' + (FALA_K[g.fala] ? DG('f.' + FALA_K[g.fala], g.fala) : g.fala) : '') + (g.gravada ? ' · ' + DG('gravada', 'Voz gravada') + ': ' + DG('g.' + g.gravada, GRAV_PT[g.gravada] || g.gravada) : '') + (g.porFala ? ' · ' + DG('interrompido-fala', 'a voz do sistema interrompeu o áudio do jogo') + (g.audio === 'running' ? ' (' + DG('voltou', 'já voltou') + ')' : '') : '') /* 5.0c.1 */ + (g.efeitos ? '' : ' · ' + DG('efeitos-off', 'efeitos desligados em Ajustes')) + (g.vozJogo ? '' : ' · ' + DG('voz-off', 'voz do jogo desligada'))
    + (g.precisaSessao && g.fala === 'tocou' ? ' · ' + DG('ios-silencio', 'Não ouviu a voz? No iPhone, confira a chave de silêncio: ela pode calar a voz do sistema sem calar os efeitos. Se ainda não sair, escolha em Voz das falas uma voz sem "Aprimorada".') : ''); } /* 5.0c: dica do iPhone (a voz do sistema e os efeitos saem por caminhos diferentes) */
const FRASE_TESTE = 'Som testado, Comandante. Efeitos e voz no ar.';
/* Testar som: toca um efeito curto e fala uma frase (mesmo com o som ou a voz do jogo desligados, como o Ouvir) e mostra o diagnóstico na linha [data-som-diag] */
/* 5.0c.1: com vozes gravadas, toca as três notas e uma fala gravada da Raça em destaque (a saudação do líder; na partida, a Raça do jogador) e diz
   "Voz gravada: tocou | sem arquivo | formato não decodifica"; sem a fala gravada, a frase na voz do sistema, como antes (no iPhone com vozes gravadas, não) */
A.testarSom = function (box) { sessao(true); A.init(); const c = A.ctx; if (c) { retomar(c); if (c.state !== 'running') bufferMudo(c); try { [523, 659, 784].forEach((f, i) => tone(f, 0.12, { gain: 0.12, delay: i * 0.09 })); } catch (e) {} }
  const sel = box && box.querySelector ? box.querySelector('[data-voz-sel]') : null, sid = sel ? sel.value : A.voz, f = sid ? ranking().find(x => x.id === sid) : null, v = temFala() ? (f ? f.v : pickVoice()) : null;
  const t = D.teste = { voz: v ? v.name : null, fala: null, inicio: false, gravada: null }; const FRASE = TX('voz.teste', null, FRASE_TESTE); /* 5.0c: a frase no idioma */
  const linha = () => { const dg = box && box.querySelectorAll ? box.querySelectorAll('[data-som-diag]') : []; const txt = diagTexto(A.diagnostico()); dg.forEach(el => { el.hidden = false; if (el.textContent !== txt) el.textContent = txt; }); };
  if (c && c.addEventListener) { const f = () => { if (D.teste !== t) { c.removeEventListener('statechange', f); return; } linha(); }; c.addEventListener('statechange', f); setTimeout(() => { try { c.removeEventListener('statechange', f); } catch (e) {} }, 15000); } /* 5.0c.1: a linha acompanha o áudio (no iPhone, interrompido pela voz do sistema e de volta) */
  const sistema = () => { if (D.teste !== t || !temFala() || !podeSistema()) return; t.fala = 'esperando'; const sai = () => { try { removeEventListener('ard-voz', ouve); } catch (er) {} };
    const ouve = e => { const d = e && e.detail; if (!d || d.texto !== FRASE) return; if (D.teste !== t) { sai(); return; }
      if (d.tipo === 'inicio') { t.inicio = true; t.fala = 'falando'; if (A.fala && A.fala.voice) t.voz = A.fala.voice.name; } /* a voz de verdade (sem rede, a online cai para a local) */
      else if (d.tipo === 'fim') { if (t.inicio) { t.fala = 'tocou'; sai(); } else t.fala = 'falhou'; } linha(); }; /* sem 'inicio', a fala pode repetir na voz local: segue ouvindo */
    try { addEventListener('ard-voz', ouve); } catch (e) {} if (!falar(FRASE, { tipo: 'sistema', p: 4 }, v)) t.fala = 'não começou';
    setTimeout(() => { if (D.teste !== t || t.fala === 'tocou') return; sai(); if (!t.inicio) { t.fala = 'sem resposta (toque em Testar som de novo)'; linha(); } }, 8000); linha(); };
  const vz = VZ();
  if (vz && A.gravadas !== false && vz.disponivel()) { t.gravada = 'esperando';
    vz.manifesto().then(m => { if (D.teste !== t) return; const raca = A.raca || vz.destaque || 'vehnar'; const g = m && vz.achar(['sala-' + raca, 'voz-on'], raca, { pacote: raca });
      if (!g) { t.gravada = vz.motivo === 'formato' ? 'formato' : vz.estado === 'desligada' ? 'desligada' : 'sem-arquivo'; linha(); sistema(); return; }
      const sai = () => { try { removeEventListener('ard-voz', ouve); } catch (er) {} };
      const ouve = e => { const d = e && e.detail; if (!d || !d.gravada || d.texto !== g.texto) return; if (D.teste !== t) { sai(); return; } if (d.tipo === 'inicio') t.gravada = 'tocando'; else if (d.tipo === 'fim') { t.gravada = 'tocou'; sai(); } linha(); };
      try { addEventListener('ard-voz', ouve); } catch (e) {}
      const ok = falar(g.texto, { tipo: 'sistema', p: 4 }, null, g, { espera: vz.ESPERA_TESTE, raca, sistema: false, aoFalhar: mot => { sai(); if (D.teste !== t) return; t.gravada = mot === 'suspenso' ? 'suspenso' : mot === 'formato' ? 'formato' : 'sem-arquivo'; linha(); sistema(); } });
      if (!ok) { sai(); t.gravada = 'sem-arquivo'; sistema(); } linha(); }); }
  else { t.gravada = A.gravadas === false ? 'desligada' : 'sem-arquivo'; sistema(); }
  linha(); setTimeout(linha, 450); return t; };
ARD.audio = A;
})(globalThis.ARD = globalThis.ARD || {});
