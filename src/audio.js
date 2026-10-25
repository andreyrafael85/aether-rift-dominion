/* Áudio: efeitos sintetizados em WebAudio (sem arquivos) e voz de sistema pela Web Speech API. */
(function (ARD) {
'use strict';
const A = { ctx: null, master: null, enabled: true, voice: true, inited: false, last: {}, recent: [], lastVoice: {}, voiceObj: null, voz: '', vozNome: '' };
try { const p = JSON.parse(localStorage.getItem('ard-audio') || '{}'); if (p.enabled === false) A.enabled = false; if (p.voice === false) A.voice = false; if (typeof p.voz === 'string') A.voz = p.voz; if (typeof p.vozNome === 'string') A.vozNome = p.vozNome; /* 5.0a.2: voz escolhida em Ajustes ('' = Automática) */ } catch (e) {}
function save() { try { localStorage.setItem('ard-audio', JSON.stringify({ enabled: A.enabled, voice: A.voice, voz: A.voz || '', vozNome: A.vozNome || '' })); } catch (e) {} }
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
  if (/Aprimorad|Enhanced|Premium|Melhorad/i.test(n) || /\.(enhanced|premium)\./i.test(u)) return 4;
  if (/^com\.apple\./i.test(u) || /^(Luciana|Felipe|Fernanda|Joana|Catarina)\b/i.test(n)) return 3;
  return /Microsoft/i.test(n) ? 1 : 2; }
const PREF = [/Francisca/i, /Antonio/i, /Thalita/i, /Luciana/i, /Felipe/i]; /* ordem pedida dentro do mesmo nível */
const TAG = ['robótica', 'antiga do Windows', '', 'Apple', 'Apple aprimorada', '', 'neural do Edge'];
function nomeCurto(n) { return String(n || '').replace(/^Microsoft\s+/i, '').replace(/\s*Online\s*\(Natural\)/i, '').replace(/\s+-\s+.*$/, '').replace(/\s+Desktop\b/i, '').replace(/\s*\((?:Portugu[eê]s|Portuguese)\s*\([^)]*\)\)\s*$/i, '').replace(/Multilingual$/i, ' multilíngue').trim(); }
let RANK = null, RANK_T = 0; const RUIM = new Set(); /* vozes que falharam nesta sessão (voz online sem rede, por exemplo) */
function ranking() {
  if (RANK && performance.now() - RANK_T < 5000) return RANK; if (!temFala()) return [];
  let vs = []; try { vs = speechSynthesis.getVoices() || []; } catch (e) {}
  const r = []; vs.forEach((v, i) => { const lang = String(v.lang || '').replace('_', '-'); const br = /^pt-BR$/i.test(lang); if (!br && !/^pt(-|$)/i.test(lang)) return;
    const nv = nivel(v), pi = PREF.findIndex(re => re.test(v.name || '')); const nota = (nv > 0 ? 2000 : 0) + (br ? 1000 : 0) + nv * 100 + (pi >= 0 ? 50 - pi * 5 : 0) + (/Premium/i.test((v.name || '') + ' ' + (v.voiceURI || '')) ? 2 : 0) + (v.default ? 1 : 0);
    r.push({ v, id: vozId(v), nota, nivel: nv, br, i, rotulo: nomeCurto(v.name) + (TAG[nv] ? ' · ' + (nv === 4 && /Aprimorad|Enhanced|Premium|Melhorad/i.test(v.name || '') ? 'Apple' : TAG[nv]) : '') + (br ? '' : ' · Portugal') }); });
  r.sort((a, b) => b.nota - a.nota || a.i - b.i); if (vs.length) { RANK = r; RANK_T = performance.now(); } return r;
}
function pickVoice(id) { const r = ranking(), want = id != null ? id : A.voz; if (want) { const f = r.find(x => x.id === want && !RUIM.has(x.id)); if (f) return f.v; } const b = r.find(x => !RUIM.has(x.id)); return b ? b.v : null; }
/* 5.0a.2: falas por tipo — intervalo mínimo para repetir a mesma fala (s) e prioridade. A maior interrompe a menor (o perigo corta "Unidade pronta";
   uma fala de líder ou o "Ouvir" corta a anterior do mesmo tipo); avisos de rotina (unidade, obra, pesquisa) guardam 3 s entre si e não fazem fila: com a voz ocupada,
   ficam de fora; o resto espera numa fila de uma fala só, que é descartada se envelhecer 4 s. A legenda segue a mesma decisão. */
const TIPOS = { sistema: { gap: 0, p: 4 }, perigo: { gap: 12, p: 3 }, lider: { gap: 4, p: 2 }, evento: { gap: 15, p: 2 }, pesquisa: { gap: 6, p: 1 }, obra: { gap: 10, p: 1 }, unidade: { gap: 12, p: 1 } };
const TIPO_DA_CHAVE = { built: 'obra', spawn: 'unidade', 'Pesquisa concluída': 'pesquisa', 'Base sob ataque': 'perigo', 'Núcleo sob ataque': 'perigo', 'Alerta de sifão': 'perigo', 'Pacto quebrado': 'perigo',
  'Tempestade de Éter': 'evento', Blecaute: 'evento', 'Fundição Orbital': 'evento', 'Salto de Núcleo': 'evento', 'Pacto assinado': 'evento', elim: 'evento', 'voz-on': 'sistema' };
const ROTINA_GAP = 3000, FILA_MAX = 4000; const ultima = {}; let ultimaRotina = -1e9, cur = null, fila = null;
function decide(key, cooldown, now) {
  const conhecida = TIPO_DA_CHAVE[key] || (/^sala-/.test(key) ? 'lider' : null), tipo = conhecida || 'evento', T = TIPOS[tipo];
  const gap = cooldown === 0 ? 0 : conhecida ? Math.max(T.gap, cooldown || 0) : (cooldown == null ? 6 : cooldown); /* chave nova: o intervalo de quem chamou */
  if (gap && ultima[key] != null && now - ultima[key] < gap * 1000) return null;
  if (T.p === 1 && now - ultimaRotina < ROTINA_GAP) return null;
  return { tipo, p: T.p };
}
/* 5.0b: gancho de palavras da voz: o evento 'ard-voz' no window traz { tipo: 'inicio' | 'palavra' | 'fim', texto, i, n } (posição e tamanho da palavra,
   do evento boundary do speechSynthesis); a Sala de Comando mexe a boca do líder com ele */
function voiceHook(u, text, c) { const ev = (tipo, i, n) => { try { window.dispatchEvent(new CustomEvent('ard-voz', { detail: { tipo, texto: text, i: i || 0, n: n || 0 } })); } catch (e) {} };
  u.onstart = () => ev('inicio'); u.onboundary = e => { if (!e.name || e.name === 'word') ev('palavra', e.charIndex, e.charLength); }; u.onend = () => { ev('fim'); acabou(c); }; u.onerror = e => { ev('fim'); falhou(c, e); }; }
function comecar(text, d, voz, tentativa) {
  let u; try { u = new SpeechSynthesisUtterance(text); } catch (e) { cur = null; return false; }
  const v = voz || pickVoice(); if (v) { try { u.voice = v; } catch (e) {} } u.lang = (v && v.lang) || 'pt-BR'; u.pitch = 1; u.rate = d.p === 3 ? 1.05 : 1; u.volume = 0.9; /* 5.0a.2: tom natural (antes 0.85 e 1.05) */
  const c = cur = { u, p: d.p, tipo: d.tipo, text, d, tentativa: tentativa || 0, fim: performance.now() + 3000 + text.length * 150 }; voiceHook(u, text, c); A.fala = u; /* referência viva: sem ela o Chrome pode perder o onend */
  try { if (speechSynthesis.paused) speechSynthesis.resume(); speechSynthesis.speak(u); } catch (e) { cur = null; return false; }
  return true;
}
function acabou(c) { if (cur !== c) return; cur = null; proxima(); }
function proxima() { while (fila) { const f = fila; fila = null; if (performance.now() - f.t <= FILA_MAX) { comecar(f.text, f.d); return; } } }
function falhou(c, e) { if (cur !== c) return; cur = null; const er = String((e && e.error) || '');
  if (!/interrupted|canceled/.test(er) && c.u.voice && c.tentativa < 2) { /* voz online sem rede: todas as online saem até a rede voltar e a fala repete na melhor local */
    if (c.u.voice.localService === false) { for (const x of ranking()) if (x.v.localService === false) RUIM.add(x.id); } else RUIM.add(vozId(c.u.voice));
    UIS.forEach(preencher); if (comecar(c.text, c.d, null, c.tentativa + 1)) return; }
  proxima(); }
function falar(text, d, voz) {
  const now = performance.now(); if (cur && now > cur.fim) cur = null; /* o onend não veio: libera a voz */
  if (cur) {
    if (d.p > cur.p || (d.tipo === cur.tipo && (d.tipo === 'lider' || d.tipo === 'sistema'))) { const marca = cur = { p: d.p, tipo: d.tipo, fim: now + 2000 }; fila = null; try { speechSynthesis.cancel(); } catch (e) {} setTimeout(() => { if (cur === marca) comecar(text, d, voz); }, 60); return true; } /* falar logo depois do cancel perde a fala no Chrome */
    if (d.p >= 2 && !fila) { fila = { text, d, t: now }; return true; }
    return false;
  }
  return comecar(text, d, voz);
}
A.onSay = null; /* 5.0b: legendas — cada fala aceita também vai para A.onSay(texto, chave), que a Interface 3.0 mostra com o retrato do líder (mesmo com a voz desligada) */
A.say = function (text, key, cooldown) {
  key = key || text; const now = performance.now(); const d = decide(key, cooldown, now); if (!d) return false;
  if (A.voice && temFala() && !falar(text, d)) return false;
  ultima[key] = now; if (d.p === 1) ultimaRotina = now;
  if (A.onSay) { try { A.onSay(text, key); } catch (e) {} }
  return true;
};
A.setEnabled = function (on) { A.enabled = on; save(); }; A.setVoice = function (on) { A.voice = on; save(); if (!on) { fila = null; cur = null; if (temFala()) try { speechSynthesis.cancel(); } catch (e) {} } };
/* 5.0a.2: escolha da voz em Ajustes (tela inicial e partida): cada bloco [data-voz-ui] tem um select[data-voz-sel], um botão [data-voz-ouvir] e um texto
   [data-voz-dica]. Os blocos ficam em sincronia e se refazem quando o aparelho carrega mais vozes (o Edge traz as neurais depois das locais);
   "Ouvir" fala a frase de exemplo com a voz do select, mesmo com a voz do jogo desligada. */
const AMOSTRA = 'Comandante, a Fenda está estável e o Núcleo aguarda as suas ordens.';
const UIS = []; const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
function dica(r, best) { const ua = (typeof navigator !== 'undefined' && navigator.userAgent) || '', ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1), mac = !ios && /Macintosh/.test(ua), win = /Windows/.test(ua), ffx = /Firefox\//.test(ua), android = /Android/.test(ua);
  if (!temFala()) return 'Este navegador não tem voz do sistema: as falas aparecem só nas legendas.';
  if (!r.length) return 'Nenhuma voz em português neste aparelho: as falas aparecem nas legendas.' + (win ? ' No Windows, o Edge traz vozes neurais (Francisca, Antonio, Thalita).' : '');
  const n = best ? best.nivel : 0;
  if (n === 6) return 'Vozes neurais do Edge: soam naturais e precisam de internet; sem rede, o jogo passa para a melhor voz do aparelho.';
  if (n === 5) return 'A voz do Google precisa de internet; sem rede, o jogo passa para a melhor voz do aparelho.';
  if ((ios || mac) && n < 4) return (ios ? 'No iPhone e no iPad: Ajustes' : 'No Mac: Ajustes do Sistema') + ' › Acessibilidade › Conteúdo Falado › Vozes › Português (Brasil): baixe a Luciana ou o Felipe (Aprimorada) e recarregue o jogo.';
  if (win && ffx) return 'O Firefox só enxerga as vozes antigas do Windows. Para uma voz natural, use o Edge (Francisca, Antonio, Thalita) ou o Chrome (Google português do Brasil).';
  if (win && n <= 1) return 'Estas são as vozes antigas do Windows. O Edge traz vozes neurais (Francisca, Antonio, Thalita) e o Chrome, a Google português do Brasil.';
  if (android && n <= 2) return 'No Android, a voz vem do mecanismo de texto para fala do aparelho (Ajustes › Acessibilidade › Saída de texto para fala).';
  return ''; }
function preencher(box) {
  const sel = box.querySelector('[data-voz-sel]'), bt = box.querySelector('[data-voz-ouvir]'), dc = box.querySelector('[data-voz-dica]'); if (!sel) return;
  const r = ranking(), best = r.find(x => !RUIM.has(x.id)), op = x => `<option value="${esc(x.id)}">${esc(x.rotulo)}${RUIM.has(x.id) ? ' (falhou agora)' : ''}</option>`;
  let h = `<option value="">Automática${best ? ' · ' + esc(best.rotulo) : ''}</option>`; const br = r.filter(x => x.br), pt = r.filter(x => !x.br);
  if (br.length) h += `<optgroup label="Português do Brasil">${br.map(op).join('')}</optgroup>`; if (pt.length) h += `<optgroup label="Outras vozes em português">${pt.map(op).join('')}</optgroup>`;
  if (A.voz && !r.some(x => x.id === A.voz)) h += `<option value="${esc(A.voz)}">${esc(A.vozNome || nomeCurto(A.voz))} (indisponível agora)</option>`;
  if (sel.__h !== h) { sel.__h = h; sel.innerHTML = h; } sel.value = A.voz || ''; sel.disabled = !temFala(); if (bt) bt.disabled = !temFala();
  if (dc) { const t = dica(r, best); if (dc.textContent !== t) dc.textContent = t; dc.hidden = !t; }
}
A.vozes = () => ranking().map(x => ({ id: x.id, rotulo: x.rotulo, nivel: x.nivel, br: x.br }));
A.vozAtual = () => { const v = temFala() ? pickVoice() : null; return v ? { id: vozId(v), nome: v.name } : null; };
A.setVoz = function (id) { A.voz = id || ''; const f = ranking().find(x => x.id === A.voz); A.vozNome = f ? nomeCurto(f.v.name) : ''; save(); UIS.forEach(preencher); };
A.ouvir = function (id) { if (!temFala()) return false; const sid = id != null ? id : A.voz, f = sid ? ranking().find(x => x.id === sid) : null; return falar(AMOSTRA, { tipo: 'sistema', p: 4 }, f ? f.v : null); };
A.vozUI = function (box) { if (!box || box.__voz) return; box.__voz = 1; UIS.push(box); const sel = box.querySelector('[data-voz-sel]'), bt = box.querySelector('[data-voz-ouvir]');
  if (sel) sel.addEventListener('change', () => A.setVoz(sel.value)); if (bt) bt.addEventListener('click', () => A.ouvir(sel ? sel.value : A.voz)); preencher(box); };
if (temFala()) { const mudou = () => { RANK = null; UIS.forEach(preencher); }; try { addEventListener('online', () => { RUIM.clear(); mudou(); }); } catch (e) {} try { if (speechSynthesis.addEventListener) speechSynthesis.addEventListener('voiceschanged', mudou); else speechSynthesis.onvoiceschanged = mudou; speechSynthesis.getVoices(); } catch (e) {} }
if (typeof document !== 'undefined' && document.querySelectorAll) { const liga = () => document.querySelectorAll('[data-voz-ui]').forEach(b => A.vozUI(b)); if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', liga); else liga(); }
ARD.audio = A;
})(globalThis.ARD = globalThis.ARD || {});
