/* Aether Rift: Dominion — 5.0f: som 3D da partida, só com Web Audio (nenhum arquivo de áudio). Vale para os dois motores (o src/render3d.js
   chama ARD.som3d.quadro a cada quadro, depois da câmera).
   - Ouvinte preso à câmera (posição e orientação a cada quadro; só escreve quando muda) e cada efeito com o lugar dele no mapa.
   - HRTF no computador (Ajustes › Som 3D: fone de ouvido ou caixas de som) e panorâmica simples (equalpower) no celular e na Baixa.
   - Distância pelo zoom (o volume pela distância do src/main.js e a câmera mais longe, mais baixo), ar que abafa o agudo de longe, abafamento do
     que está sob a névoa de guerra e reverberação por bioma, com o impulso gerado no navegador (gelo, rocha, tundra, basalto e o vazio do Cinturão).
   - Mixagem com limite de vozes e prioridade: um conjunto fixo de vozes (ganho → filtro → panorâmica, criadas uma vez); cada efeito é um
     AudioBuffer pré-gravado tocado por um único AudioBufferSourceNode numa voz livre; sem voz livre, a de menor prioridade cede (explosões
     grandes e alertas na frente) ou o efeito fica de fora. Nenhum nó novo por evento além do limite de vozes.
   - Barramentos: efeitos (A.master, o volume de hoje × o volume dos efeitos) e música passam pelo "abaixa sob a fala" e por um limitador no fim,
     junto com as vozes gravadas: nada estoura. A música (src/musica.js) entra no barramento de música daqui.
   Chaves de URL (para comparar no aparelho): ?som3d=0 (efeitos como antes, sem posição, sem vozes do mixer), ?hrtf=0|1 (força a panorâmica),
   ?reverb=0, ?abafar=0 (sem névoa e sem ar), ?somvozes=<n> (limite de vozes), ?limitador=0.
   Nada aqui toca a simulação: só lê o que o renderizador já tem (câmera, névoa, bioma).
   5.0f.1 (som de cinema): os efeitos de combate e de mundo (disparos, feixe, impacto, explosões, trovão, tempestade, sifão) vêm de arquivos em
   camadas (transiente, corpo, grave sub e cauda; assets/som/efeitos/, CC0), baixados depois da carga e nivelados pelo som gerado de antes; sem os
   arquivos (o artefato, file://, ?somarq=0) fica o som gerado. Aqui também o carregador dos arquivos (assets/som/som.json, Opus no Ogg com AAC de
   reserva) que o src/musica.js usa para a trilha. Metade das vozes posicionais com HRTF (as pesadas) e metade com a panorâmica simples (os
   disparos leves), salas mais curtas: o fio de áudio custa menos. A voz das unidades (respostas) fica 4 a 6 dB acima do fundo: o fundo é medido
   antes do abaixar e a voz e o abaixar seguem a medida. Chaves: ?somarq=0 (sem arquivos), ?efeitosarq=0 (efeitos gerados, trilha de arquivo),
   ?vozauto=0 (sem o ajuste da voz pela medida do fundo). */
(function (ARD) {
'use strict';
const par = k => { try { return new URLSearchParams(location.search).get(k); } catch (e) { return null; } };
const CH = { som3d: par('som3d') !== '0', hrtf: par('hrtf'), reverb: par('reverb') !== '0', abafar: par('abafar') !== '0', vozes: parseInt(par('somvozes') || '0', 10) || 0, limitador: par('limitador') !== '0' };
const A = () => ARD.audio || null;
const UA = () => (typeof navigator !== 'undefined' && navigator.userAgent) || '';
const ehIOS = () => /iPhone|iPad|iPod/.test(UA()) || (/Macintosh/.test(UA()) && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1);
const toque = () => { try { return ehIOS() || (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches); } catch (e) { return false; } };

/* ---------- efeitos: prioridade e posição ---------- */
const POS = { shot_light: 0, beam: 0, siphon: 0, shot_heavy: 1, impact: 1, explosion: 2, storm: 2 }; /* com lugar no mapa (prioridade) */
const FRENTE = { click: 2, build: 3, spawn: 3, erro: 3, promote: 3, pact: 3, thunder: 2, storm: 2, alert: 4, danger: 4, betrayal: 4 }; /* na frente, sem lugar */
const VARIA = { shot_light: 0.08, shot_heavy: 0.07, beam: 0.06, impact: 0.08, explosion: 0.1, siphon: 0.05 }; /* variação de altura (tom) por disparo */
const UI_RACA = ['click', 'build', 'spawn', 'erro'];
const DUR = { shot_light: 0.12, shot_heavy: 0.22, beam: 0.24, impact: 0.3, explosion: 0.8, build: 0.6, spawn: 0.5, alert: 0.62, danger: 0.72, promote: 0.36, click: 0.1, erro: 0.36, siphon: 0.58, storm: 1.5, thunder: 2.55, pact: 0.42, betrayal: 0.58 };

/* ---------- reverberação por bioma (impulso sintético) ---------- */
const IRS = { /* 5.0f.1: salas ~25% mais curtas (os efeitos de arquivo já trazem a cauda deles e o convolvedor é o mais caro do mixer). s = duração, dec = queda, brilho = agudo no começo (0–1), pre = pré-atraso, eco = reflexões [s, ganho], wet = mandada */
  gelo: { s: 1.3, dec: 3.2, brilho: 0.8, pre: 0.012, eco: [[0.05, 0.3]], wet: 0.34 },
  rocha: { s: 0.95, dec: 3.6, brilho: 0.5, pre: 0.02, eco: [[0.09, 0.55], [0.21, 0.35], [0.37, 0.2]], wet: 0.32 },
  tundra: { s: 0.6, dec: 4.5, brilho: 0.3, pre: 0.008, eco: [], wet: 0.2 },
  basalto: { s: 1.4, dec: 2.6, brilho: 0.26, pre: 0.03, eco: [[0.14, 0.4]], wet: 0.38 },
  espaco: { s: 0.5, dec: 5, brilho: 0.7, pre: 0.004, eco: [[0.011, 0.5], [0.023, 0.4], [0.037, 0.3]], wet: 0.16 } };
const BIOMAS = ['gelo', 'rocha', 'tundra', 'basalto'];
function impulso(c, nome, leve) { const P = IRS[nome] || IRS.tundra, r = c.sampleRate, dur = leve ? Math.min(0.8, P.s * 0.5) : P.s /* 5.0f (bancada): o convolvedor é o mais caro do mixer; salas curtas */, n = Math.max(64, Math.floor(r * dur)), ch = leve ? 1 : 2, b = c.createBuffer(ch, n, r);
  let sd = 1234567 + nome.length * 7919; const rnd = () => { sd = (sd * 1103515245 + 12345) >>> 0; return sd / 4294967296 * 2 - 1; }; /* sorteio próprio: o mesmo impulso sempre */
  const pre = Math.floor(P.pre * r);
  for (let k = 0; k < ch; k++) { const d = b.getChannelData(k); let y = 0;
    const m = n - pre, r = Math.exp(-P.dec * 1.6 / m), fimF = Math.floor(m * 0.94); let env = 1; /* queda exponencial por multiplicação (sem Math.pow por amostra) e um fade no fim */
    for (let i = pre, j = 0; i < n; i++, j++) { const a = Math.max(0.04, P.brilho * (1 - 0.8 * j / m)); y += a * (rnd() - y); env *= r; d[i] = y * env * (j > fimF ? (m - j) / (m - fimF) : 1); }
    for (const [ts, g] of P.eco) { const i0 = pre + Math.floor(ts * r * (1 + k * 0.03)); for (let i = 0; i < 160 && i0 + i < n; i++) d[i0 + i] += g * (rnd()) * (1 - i / 160); } }
  return b; }

/* ---------- o mixer (um por contexto: o do jogo e, nas medidas, um OfflineAudioContext) ---------- */
function criar(c, master, o) { o = o || {}; const M = { c, master, ok: true, leve: !!o.leve };
  const nPos = o.vozes || CH.vozes || (o.leve ? 8 : 12), nFr = o.leve ? 3 : 4, lim = o.limitador != null ? o.limitador : CH.limitador;
  /* fim da linha: fundo (efeitos + música) e vozes gravadas → limitador → compensação → saída */
  M.fundo = c.createGain(); M.fala = c.createGain(); /* M.fala: as vozes gravadas (src/vozes.js) */
  if (lim) { const L = M.lim = c.createDynamicsCompressor(); L.threshold.value = -2; L.knee.value = 1; L.ratio.value = 20; L.attack.value = 0.002; L.release.value = 0.12;
    /* o compressor do Web Audio sobe o volume sozinho (ganho de compensação = 0,6 × o ganho que ele tira no máximo); aqui ele volta, para os
       sons baixos ficarem no volume de hoje e só os picos serem segurados (teto ≈ −1,9 dBFS) */
    const full = -2 + 2 / 20, comp = Math.pow(10, (full * 0.6) / 20); M.pos = c.createGain(); M.pos.gain.value = comp; M.fundo.connect(L); M.fala.connect(L); L.connect(M.pos); M.pos.connect(c.destination); }
  else { M.fundo.connect(c.destination); M.fala.connect(c.destination); }
  M.duckFx = c.createGain(); M.duckFx.connect(M.fundo); M.duckMus = c.createGain(); M.duckMus.connect(M.fundo); M.mus = c.createGain(); M.mus.gain.value = 0; M.mus.connect(M.duckMus);
  try { master.disconnect(); } catch (e) {} master.connect(M.duckFx);
  /* reverberação: duas salas (A/B) para trocar de bioma cruzando */
  M.envio = c.createGain(); M.envio.channelCount = 1; M.envio.channelCountMode = 'explicit'; /* 5.0f (bancada): a mandada em mono (o convolvedor faz 2 convoluções, não 4) e só a sala ativa ligada nela */
  M.salas = [0, 1].map(() => { const cv = c.createConvolver(), w = c.createGain(); w.gain.value = 0; cv.connect(w); w.connect(master); return { cv, w, nome: null, lig: false }; }); M.sala = 0; M.bioma = null;
  /* vozes posicionais: ganho → panorâmica → um dos três barramentos de distância (perto: limpo; longe: o ar tira o agudo; sob a névoa: abafado),
     cada um com a sua mandada para a sala. 5.0f (bancada): filtro e mandada por voz custavam ~2 ms por segundo de som cada voz, mesmo calada;
     três filtros fixos custam o mesmo que um */
  const modelo = o.modelo || 'equalpower', ENV = { perto: 0.3, longe: 0.65, nevoa: 0.85 };
  M.bus = {}; for (const k of ['perto', 'longe', 'nevoa']) { let entrada; if (k === 'perto') entrada = c.createGain(); else { entrada = c.createBiquadFilter(); entrada.type = 'lowpass'; entrada.frequency.value = k === 'longe' ? 5200 : 650; entrada.Q.value = 0.5; }
    const e = c.createGain(); e.gain.value = ENV[k]; entrada.connect(master); entrada.connect(e); e.connect(M.envio); M.bus[k] = entrada; }
  /* 5.0f.1: só metade das vozes posicionais com o modelo escolhido (HRTF no computador); a outra metade, a panorâmica simples, fica com os
     disparos leves e os feixes (prioridade 0), que são os mais numerosos: a HRTF processa menos da metade do tempo */
  const nH = o.leve ? nPos : Math.ceil(nPos / 2);
  M.vozes = []; for (let i = 0; i < nPos; i++) { const g = c.createGain(), p = c.createPanner(); g.gain.value = 0;
    p.panningModel = i < nH ? modelo : 'equalpower'; p.distanceModel = 'linear'; p.rolloffFactor = 0; p.refDistance = 1; p.maxDistance = 1e6; /* a distância é do volume do jogo (src/main.js, volAt, e o zoom); a panorâmica só dá a direção */
    g.connect(p); p.connect(M.bus.perto); M.vozes.push({ g, p, bus: 'perto', src: null, fim: 0, prio: -1, ini: 0, h: i < nH }); }
  M.ordemPesada = M.vozes.filter(v => v.h).concat(M.vozes.filter(v => !v.h)); M.ordemLeve = M.vozes.filter(v => !v.h).concat(M.vozes.filter(v => v.h)); /* 5.0f.1 */
  /* 5.0f (bancada): uma panorâmica que nunca recebeu som segue processando calada (no Chrome, ~1 ms por segundo de som cada, ~4 ms na HRTF); um
     toque mudo de uma amostra em cada voz e na sala deixa o caminho desligado até o primeiro efeito de verdade */
  { const mudo = c.createBuffer(1, 1, c.sampleRate); const toca = no => { const s0 = c.createBufferSource(); s0.buffer = mudo; s0.connect(no); s0.start(0); }; for (const v of M.vozes) toca(v.g); }
  M.frente = []; for (let i = 0; i < nFr; i++) { const g = c.createGain(); g.gain.value = 0; g.connect(master); M.frente.push({ g, src: null, fim: 0, prio: -1, ini: 0 }); }
  /* 5.0f.1: medidor do fundo antes do abaixar (efeitos + música), para a voz das unidades ficar acima dele: um AnalyserNode só, lido a cada 0,3 s */
  if (o.medidor !== false) { M.medF = c.createBiquadFilter(); M.medF.type = 'highpass'; M.medF.frequency.value = 60; M.medF.Q.value = 0.5; master.connect(M.medF); M.an = c.createAnalyser(); M.an.fftSize = 2048; M.medF.connect(M.an); /* só os efeitos, com passa-alta de 60 Hz (o grave sub das explosões não conta como "cobrir a voz"); a música vem do volume medido de cada faixa (src/musica.js, nivelDb): medir a música pelo analisador errava 2 a 4 dB conforme o timbre de cada faixa */ /* passa-alta de 60 Hz: o grave sub das explosões não conta como "cobrir a voz" */ const z = c.createGain(); z.gain.value = 0; M.an.connect(z); z.connect(c.destination); M.anBuf = new Float32Array(2048); }
  M.med = { roubos: 0, fora: 0, toques: 0, maxAtivas: 0 };
  return M; }
/* uma voz livre ou a que cede (a de menor prioridade, a mais antiga entre as iguais); null = o efeito fica de fora */
function vozPara(M, lista, prio, t) { let livre = null, cede = null; for (const v of lista) { if (v.fim <= t) { livre = v; break; } if (v.prio < prio || (v.prio === prio && prio >= 2)) { if (!cede || v.prio < cede.prio || (v.prio === cede.prio && v.ini < cede.ini)) cede = v; } }
  if (livre) return livre; if (cede) { M.med.roubos++; return cede; } M.med.fora++; return null; }
/* toca um AudioBuffer numa voz: vol (0–1), prio, pos = [x, y, z] (null = na frente), visto (false = sob a névoa), rate, atraso (s), envio da sala */
function tocarBuf(M, buf, vol, prio, pos, bus, rate, atraso, med) { const c = M.c, t = c.currentTime, lista = pos ? (prio === 0 ? M.ordemLeve : M.ordemPesada) || M.vozes : M.frente; /* 5.0f.1: os leves preferem a panorâmica simples */ const v = vozPara(M, lista, prio, t); if (!v) return false;
  let t0 = t + (atraso || 0); if (v.src && v.fim > t) { const g = v.g.gain; g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(0, t + 0.012); try { v.src.stop(t + 0.014); } catch (e) {} t0 = Math.max(t0, t + 0.014); } /* cede com um corte curto, sem estalo */
  const s = c.createBufferSource(); s.buffer = buf; if (rate !== 1) s.playbackRate.value = rate; s.connect(v.g); v.g.gain.setValueAtTime(vol, t0);
  if (pos) { const p = v.p; if (p.positionX) { p.positionX.value = pos[0]; p.positionY.value = pos[1]; p.positionZ.value = pos[2]; } else p.setPosition(pos[0], pos[1], pos[2]); /* .value, não setValueAtTime: com automação o PannerNode do Chrome entra no caminho por amostra e fica caro mesmo calado (bancada) */
    if (bus && v.bus !== bus && M.bus[bus]) { try { v.p.disconnect(); } catch (e) {} v.p.connect(M.bus[bus]); v.bus = bus; } }
  s.start(t0); v.src = s; v.ini = t0; v.fim = t0 + buf.duration / rate + 0.02; v.prio = prio; if (med) { med.toques++; let n = 0; for (const x of lista) if (x.fim > t) n++; if (n > med.maxAtivas) med.maxAtivas = n; }
  return true; }

/* ---------- pré-gravação dos efeitos: todos num OfflineAudioContext só, cortados depois; as variantes de Raça com o volume médio do genérico ---------- */
function preGravar(c) { const au = A(); const OC = window.OfflineAudioContext || window.webkitOfflineAudioContext; if (!OC || !au || !au.sintetiza) return Promise.resolve(null);
  const lista = []; for (const n of au.SONS) lista.push([n, null]); for (const r of au.UI_RACA) for (const n of UI_RACA) lista.push([n, r]);
  const sr = c.sampleRate, gap = 0.05; let t = 0; const lug = lista.map(([n, r]) => { const d = (DUR[n] || 0.6) + (r ? 0.35 : 0); const o = { n, r, t, d }; t += d + gap; return o; });
  const off = new OC(1, Math.ceil((t + 0.1) * sr), sr); for (const L of lug) au.sintetiza(off, off.destination, L.t, L.n, L.r, 1, 0);
  const t0 = performance.now(); const pr = off.startRendering(); const fim = buf => { const d = buf.getChannelData(0), out = {}, rms = {};
    for (const L of lug) { const i0 = Math.floor(L.t * sr); let n = Math.floor(L.d * sr); while (n > 64 && Math.abs(d[i0 + n - 1]) < 1e-4) n--; const b = c.createBuffer(1, n, sr), x = b.getChannelData(0); for (let i = 0; i < n; i++) x[i] = d[i0 + i];
      let s = 0; for (let i = 0; i < n; i++) s += x[i] * x[i]; const k = L.r ? L.n + ':' + L.r : L.n; out[k] = b; rms[k] = Math.sqrt(s / Math.max(1, Math.min(n, Math.floor(0.25 * sr)))); }
    for (const L of lug) if (L.r) { const k = L.n + ':' + L.r, g = rms[L.n] / Math.max(1e-6, rms[k]); if (isFinite(g) && g > 0.25 && g < 4) { const x = out[k].getChannelData(0); for (let i = 0; i < x.length; i++) x[i] *= g; } } /* volume médio igual ao genérico */
    return { bufs: out, ms: Math.round(performance.now() - t0), seg: +t.toFixed(2) }; };
  return pr && pr.then ? pr.then(fim) : new Promise(ok => { off.oncomplete = e => ok(fim(e.renderedBuffer)); }); }

/* ---------- 5.0f.1: arquivos de som (assets/som/): o manifesto, o formato que o aparelho decodifica e o carregador (efeitos aqui, trilha no src/musica.js) ----------
   O tools/build.mjs troca o marcador: { base: 'assets/som/' } no index.html (GitHub Pages), '../assets/som/' no dist/local.html e null no arquivo único
   (o artefato não pede nada à rede e fica com o som gerado). ?somarq=<pasta> aponta para outra pasta; ?somarq=0 desliga. */
const SOM_TXT = '__SOM__'; let SOMCFG = null; try { if (SOM_TXT.charAt(0) === '{') SOMCFG = JSON.parse(SOM_TXT); } catch (e) { SOMCFG = null; }
function somBase() { const q = par('somarq'); if (q === '0' || q === 'off') return null; if (q && /^[\w./-]+$/.test(q) && !/^\/\//.test(q)) return /\/$/.test(q) ? q : q + '/';
  if (typeof location === 'undefined' || location.protocol === 'file:' || typeof fetch !== 'function') return null; /* fetch não lê file:// */
  return SOMCFG && SOMCFG.base ? SOMCFG.base : null; }
const ARQ = { estado: 'parado', man: null, fmt: null, prom: null, motivo: null, med: { pedidos: 0, bytes: 0, falhas: 0, decodMs: 0, decodMax: 0 } };
function manifesto() { if (ARQ.prom) return ARQ.prom; const b = somBase(); if (!b) { ARQ.estado = 'sem-arquivos'; return (ARQ.prom = Promise.resolve(null)); } ARQ.estado = 'carregando';
  return (ARQ.prom = fetch(b + 'som.json', { cache: 'no-cache' }).then(r => { if (!r.ok) throw new Error('http ' + r.status); return r.json(); }).then(m => { if (!m || !m.musica) throw new Error('manifesto'); ARQ.man = m; ARQ.estado = 'pronto'; return m; })
    .catch(e => { ARQ.estado = 'falhou'; ARQ.motivo = String((e && e.message) || e); return null; })); }
function decodifica(ab, c) { return new Promise((ok, no) => { let fe = false; const f = (fn, v) => { if (!fe) { fe = true; fn(v); } };
  try { const pr = c.decodeAudioData(ab, b => f(ok, b), e => f(no, e || new Error('decodificação'))); if (pr && pr.then) pr.then(b => f(ok, b), e => f(no, e || new Error('decodificação'))); } catch (e) { f(no, e); } }); }
function paraMono(b, c) { if (b.numberOfChannels < 2) return b; const n = b.length, m = c.createBuffer(1, n, b.sampleRate), d = m.getChannelData(0), L = b.getChannelData(0), R = b.getChannelData(1); for (let i = 0; i < n; i++) d[i] = 0.5 * (L[i] + R[i]); return m; }
/* busca e decodifica assets/som/<rel>.<formato>: o = { sr (decodifica já nessa taxa, menos memória), mono }. O primeiro formato que decodifica fica
   (Opus no Ogg; se o aparelho não decodificar, o AAC). O decodeAudioData roda fora do fio principal; a página não trava. */
function buscar(rel, o) { o = o || {}; const b = somBase(), au = A(); if (!b || !ARQ.man || !au || !au.ctx) return Promise.reject(new Error('sem arquivos'));
  const ordem = ARQ.fmt ? [ARQ.fmt] : (Array.isArray(ARQ.man.formatos) && ARQ.man.formatos.length ? ARQ.man.formatos.slice() : ['ogg']);
  const tenta = i => { const fmt = ordem[i]; if (!fmt) return Promise.reject(new Error('formato')); const url = b + rel + '.' + fmt + '?v=' + encodeURIComponent(ARQ.man.versao || '');
    return fetch(url).then(r => { if (!r.ok) throw Object.assign(new Error('http ' + r.status), { rede: true }); return r.arrayBuffer(); }).then(ab => { ARQ.med.pedidos++; ARQ.med.bytes += ab.byteLength; const t0 = performance.now();
      const OC = window.OfflineAudioContext || window.webkitOfflineAudioContext; let c = au.ctx; if (o.sr && OC && o.sr !== au.ctx.sampleRate) { try { c = new OC(2, 1, o.sr); } catch (e) { c = au.ctx; } }
      return decodifica(ab.slice(0), c).catch(e => c !== au.ctx ? decodifica(ab, au.ctx) : Promise.reject(e)).then(buf => { const ms = performance.now() - t0; ARQ.med.decodMs += ms; if (ms > ARQ.med.decodMax) ARQ.med.decodMax = ms; if (!ARQ.fmt) ARQ.fmt = fmt; return o.mono ? paraMono(buf, au.ctx) : buf; }); })
      .catch(e => { if (!(e && e.rede) && !ARQ.fmt && i + 1 < ordem.length) return tenta(i + 1); throw e; }); };
  return tenta(0).catch(e => { ARQ.med.falhas++; throw e; }); }
/* nível "como se ouve" de um efeito: RMS dos primeiros 0,4 s depois de um passa-alta de ~120 Hz (o grave sub não engana a comparação) */
function nivel(b) { const d = b.getChannelData(0), n = Math.min(d.length, Math.floor(0.4 * b.sampleRate)), k = Math.exp(-2 * Math.PI * 120 / b.sampleRate); let y = 0, x1 = 0, s = 0;
  for (let i = 0; i < n; i++) { y = k * (y + d[i] - x1); x1 = d[i]; s += y * y; } return Math.sqrt(s / Math.max(1, n)); }
/* volume de cada efeito de arquivo pelo som gerado de antes (o mesmo lugar na mixagem), com um pouco mais de peso nas explosões */
const EF_REF = { explosion_big: 'explosion' }, EF_EXTRA = { shot_light: 0.9, beam: 0.9, shot_heavy: 1.1, impact: 1.05, explosion: 1.3, explosion_big: 1.7, thunder: 1.1, storm: 1.0, siphon: 1.0 };
function carregaEfeitos() { if (S.arqPedido || par('efeitosarq') === '0') return; S.arqPedido = true;
  manifesto().then(m => { if (!m || !m.efeitos) return; const lista = []; for (const nome in m.efeitos) for (const v of m.efeitos[nome]) lista.push([nome, v.arq]);
    let i = 0; const out = {}; const prox = () => { if (i >= lista.length) { S.arq = out; S.med.efeitosArq = Object.keys(out).reduce((n, k) => n + out[k].length, 0); if (CH.reverb && leve() && par('reverb') !== '1') semSala(); return; } const [nome, arq] = lista[i++];
      buscar('efeitos/' + arq, { mono: true }).then(buf => { const ref = S.bufs && S.bufs[EF_REF[nome] || nome]; let g = 1; if (ref) { const a = nivel(ref), b = nivel(buf); if (a > 0 && b > 0) g = Math.max(0.15, Math.min(6, a / b)); } g *= EF_EXTRA[nome] || 1;
        (out[nome] = out[nome] || []).push({ buf, g }); }, e => { S.med.efeitosFalhas = (S.med.efeitosFalhas || 0) + 1; }).then(() => setTimeout(prox, 0)); }; prox(); }); }

/* ---------- estado ao vivo ---------- */
const S = { anel: new Float32Array(256), lento: 0, M: null, bufs: null, pronto: false, gravando: false, ouvT: -1e9, zoom: 1, visto: null, H: null, ty: 0, R: null, q: 0, falando: 0, falaT: 0, fala: false, med: { quadros: 0, ms: 0, sfx: 0, msSfx: 0, toques: 0, maxAtivas: 0, preMs: 0, preSeg: 0, irMs: 0, irMax: 0 }, partidaT: -1e9, bioma: null, biomaT: 0, biomaVisto: null, irs: {}, lp: { x: 0, y: 0, z: 0, fx: 0, fy: 0, fz: 0, ux: 0, uy: 0, uz: 0 } };
const leve = () => toque() || (S.R && S.R.quality && S.R.quality.name === 'baixa'); /* celular e Baixa: menos vozes, panorâmica simples, sala curta e mono */
function modelo() { if (CH.hrtf === '0') return 'equalpower'; if (CH.hrtf === '1') return 'HRTF'; if (toque()) return 'equalpower'; const au = A(); return au && au.saida === 'caixa' ? 'equalpower' : 'HRTF'; }
function montar(c, master) { if (S.M || !CH.som3d || !c || !master) return; const ini = performance.now();
  S.M = criar(c, master, { leve: toque(), modelo: modelo() }); volumes();
  /* fala no ar (vozes gravadas e a voz do sistema): o 'ard-voz' de inicio e fim; o speechSynthesis.speaking é conferido no quadro */
  try { addEventListener('ard-voz', e => { const d = e && e.detail; if (!d) return; if (d.tipo === 'inicio') { S.fala = true; S.falaT = performance.now(); S.falaTipo = d.gravada ? (/^unid:/.test(d.chave || '') ? 'resposta' : 'gravada') : 'sistema'; S.falando = null; abaixa(true); if (d.gravada) vozNivel(true); } /* 5.0f.1: o tipo da fala escolhe o quanto o fundo abaixa; a voz gravada entra no plano do fundo medido agora */ else if (d.tipo === 'fim') { S.fala = false; if (falaSistema()) S.falaTipo = 'sistema'; abaixa(!!falaSistema()); } }); } catch (e) {} /* na hora do evento (não espera o quadro) */
  S.med.montarMs = +(performance.now() - ini).toFixed(2);
  /* a pré-gravação espera o contexto tocar e mais 0,8 s: no WebKit, um OfflineAudioContext gravando junto com o resume() do primeiro toque atrasava o desbloqueio */
  const vai = () => { if (S.gravando || S.pronto) return; if (c.state !== 'running') { setTimeout(vai, 400); return; } setTimeout(gravar, 800); }; const gravar = () => {
  S.gravando = true; preGravar(c).then(r => { S.gravando = false; if (!r) return; S.bufs = r.bufs; S.pronto = true; S.med.preMs = r.ms; S.med.preSeg = r.seg; setTimeout(carregaEfeitos, 1500); /* 5.0f.1 */ }, e => { S.gravando = false; console.warn('[ARD] som 3D: pré-gravação falhou: ' + (e && e.message)); }); }; vai(); }
function volumes() { const M = S.M, au = A(); if (!M || !au) return; const t = M.c.currentTime; try { M.mus.gain.setTargetAtTime(au.musica === false ? 0 : 0.9 * au.volMusica, t, 0.05); } catch (e) {} }
function saida() { const M = S.M; if (!M) return; const m = modelo(); for (const v of M.vozes) if (v.h !== false && v.p.panningModel !== m) v.p.panningModel = m; } /* 5.0f.1: a outra metade fica sempre na panorâmica simples */
/* a sala do bioma (troca cruzando em 1,2 s); o impulso de cada bioma nasce uma vez, na primeira vez que ele toca */
/* 5.0f.1: no celular e na Baixa, com os efeitos de arquivo (que trazem a cauda deles), a sala do bioma sai: o convolvedor é o pedaço mais caro do fio de áudio */
function semSala() { const M = S.M; if (!M || M.bioma === 'seco') return; const t = M.c.currentTime; for (const x of M.salas) x.w.gain.setTargetAtTime(0, t, 0.35); M.bioma = 'seco'; setTimeout(() => { if (M.bioma !== 'seco') return; for (const x of M.salas) if (x.lig) { try { M.envio.disconnect(x.cv); } catch (e) {} x.lig = false; } }, 2000); }
function sala(nome) { const M = S.M; if (!M || !CH.reverb) return; if (S.arq && leve() && par('reverb') !== '1') { semSala(); return; } if (nome === M.bioma) return; const lv = leve(); const k = nome + (lv ? ':l' : ''); const ir = S.irs[k];
  if (!ir) { if (!S.irPedido) { S.irPedido = k; const f = () => { const t0 = performance.now(); S.irs[k] = impulso(M.c, nome, lv); const ms = performance.now() - t0; S.med.irMs += ms; if (ms > S.med.irMax) S.med.irMax = ms; S.irPedido = null; }; if (typeof requestIdleCallback === 'function') requestIdleCallback(f, { timeout: 1000 }); else setTimeout(f, 50); } return; } /* o impulso nasce em tempo ocioso; a troca vem na próxima conferência */
  const t = M.c.currentTime, ant = M.salas[M.sala], nv = M.salas[1 - M.sala]; if (nv.nome !== k) { try { nv.cv.buffer = ir; } catch (e) { const cv = M.c.createConvolver(); cv.buffer = ir; try { nv.cv.disconnect(); } catch (er) {} M.envio.connect(cv); cv.connect(nv.w); nv.cv = cv; } nv.nome = k; }
  if (!nv.lig) { M.envio.connect(nv.cv); nv.lig = true; } const P = IRS[nome] || IRS.tundra; ant.w.gain.setTargetAtTime(0, t, 0.35); nv.w.gain.setTargetAtTime(P.wet * (lv ? 0.7 : 1), t, 0.35); M.sala = 1 - M.sala; M.bioma = nome; M.wet = P.wet;
  if (ant.lig) setTimeout(() => { if (M.salas[M.sala] !== ant && ant.lig) { try { M.envio.disconnect(ant.cv); } catch (e) {} ant.lig = false; } }, 2000); } /* a sala que saiu deixa de processar */

/* ---------- toca um efeito (src/audio.js, A.sfx) ---------- */
function tocar(name, vol, delay, ev, raca) { const M = S.M; if (!M || !S.pronto) return false; const t0 = performance.now();
  try { let b = (raca && UI_RACA.indexOf(name) >= 0 && S.bufs[name + ':' + raca]) || S.bufs[name]; if (!b) return false;
    const fresco = t0 - S.ouvT < 5000; /* o ouvinte foi posto há pouco (2D e telas sem câmera: na frente) */ let pos = null, prio = FRENTE[name] != null ? FRENTE[name] : 1, g = vol, bus = 'perto', rate = 1;
    if (POS[name] != null && ev && fresco) { const x = ev.x != null ? ev.x : ev.x1 != null ? ev.x1 : ev.x2, y = ev.y != null ? ev.y : ev.y1 != null ? ev.y1 : ev.y2;
      if (x != null && y != null) { prio = POS[name]; if (name === 'explosion' && (ev.kind === 'building' || vol > 0.7)) prio = 3; /* explosão grande na frente */
        let h = S.ty; if (S.H) try { h = S.H(x, y) + 6; } catch (e) {} pos = [x, h, -y];
        const vis = !CH.abafar || !S.visto || S.visto(x, y); const zf = Math.max(0.62, Math.min(1, 0.62 + 0.38 * (S.zoom || 1))); /* câmera mais longe, mais baixo */
        g = vol * zf * (vis ? 1 : 0.55); bus = !CH.abafar ? 'perto' : !vis ? 'nevoa' : vol < 0.5 ? 'longe' : 'perto'; /* névoa: abafado; de longe, o ar tira o agudo (e a sala pesa mais) */ } }
    if (S.arq) { const vs = (name === 'explosion' && prio >= 3 && S.arq.explosion_big) || S.arq[name]; if (vs && vs.length) { const v = vs[(Math.random() * vs.length) | 0]; b = v.buf; g *= v.g; } } /* 5.0f.1: o efeito de arquivo (uma variação ao acaso; explosão grande = a de construção) */
    if (VARIA[name]) rate = 1 + (Math.random() * 2 - 1) * VARIA[name];
    const atraso = Math.max(0, Math.min(2.5, delay || 0)); /* o trovão longe chega depois (src/main.js) */
    tocarBuf(M, b, g, prio, pos, bus, rate, atraso, S.med); S.med.sfx++; return true; /* sem voz livre, o efeito fica de fora (não volta para a síntese ao vivo) */ } finally { S.med.msSfx += performance.now() - t0; } }

/* fala no ar: os efeitos descem 6 dB e a música 10 dB (ataque de ~50 ms, volta em ~0,4 s) */
const falaSistema = () => { try { return typeof speechSynthesis !== 'undefined' && speechSynthesis.speaking; } catch (e) { return false; } };
/* 5.0f.1: o quanto o fundo abaixa depende da fala. As gravadas sobem e descem com o fundo (vozNivel, abaixo), então o fundo só abaixa de leve: na
   resposta das unidades a música −3 dB e os efeitos −2 dB; nas outras gravadas (locutor, líder, campanha) −5 e −3 dB. A voz do sistema não passa
   pelo Web Audio (não dá para subir): o fundo abaixa como antes (−10 e −6 dB). */
const ABAIXA = { resposta: [0.8, 0.71], gravada: [0.71, 0.56], sistema: [0.5, 0.32] };
function abaixa(fala) { const M = S.M; fala = !!fala; if (!M || fala === S.falando) return; S.falando = fala; const t = M.c.currentTime; const a = ABAIXA[(fala && S.falaTipo) || 'sistema'] || ABAIXA.sistema;
  M.duckFx.gain.setTargetAtTime(fala ? a[0] : 1, t, fala ? 0.04 : 0.25); M.duckMus.gain.setTargetAtTime(fala ? a[1] : 1, t, fala ? 0.06 : 0.4); }
/* 5.0f.1: a voz gravada no plano do fundo. O fundo antes do abaixar = os efeitos medidos (analisador, sem o grave, a cada 0,3 s, alisado ~2 s) + a
   música pelo volume conhecido da faixa que toca (src/musica.js, nivelDb) vezes o volume de Ajustes; entre
   uma fala e outra o ganho das vozes vai para "fundo + MARGEM" (as falas saem niveladas em −21 LUFS: VOZ_REF), dentro de um piso (a voz nunca some
   num momento calmo) e de um teto (nunca sobressalta). Com o abaixar leve da resposta, a voz fica 4 a 6 dB acima do fundo. ?vozauto=0 desliga. */
const VOZ = { REF: -21, MARGEM: 5, PISO: -27, TETO: -15, auto: par('vozauto') !== '0' };
function vozNivel(inicio) { const M = S.M; if (!M || !M.an) return;
  if (!inicio) { M.an.getFloatTimeDomainData(M.anBuf); let s2 = 0; const b = M.anBuf; for (let i = 0; i < b.length; i++) s2 += b[i] * b[i]; const p = s2 / b.length;
    S.fundoP = S.fundoP == null ? p : S.fundoP + (p - S.fundoP) * (p > S.fundoP ? 0.25 : 0.12);
    let mus = null; try { mus = ARD.musica && ARD.musica.nivelDb ? ARD.musica.nivelDb() : null; } catch (e) {} const pm = mus == null ? 0 : Math.pow(10, (mus + 20 * Math.log10(Math.max(1e-6, M.mus.gain.value))) / 10);
    S.fxDb = 10 * Math.log10(S.fundoP + 1e-10); S.musDb = mus == null ? null : 10 * Math.log10(pm + 1e-10); S.fundoDb = 10 * Math.log10(S.fundoP + pm + 1e-10); }
  if (!VOZ.auto || S.fundoDb == null || (S.fala && !inicio)) return; /* nunca no meio de uma fala: entre as falas e no começo de cada uma */
  const alvo = Math.max(VOZ.PISO, Math.min(VOZ.TETO, S.fundoDb + VOZ.MARGEM)), g = Math.pow(10, (alvo - VOZ.REF) / 20);
  if (Math.abs(g - (S.vozG || 1)) > 0.02) { S.vozG = g; M.fala.gain.setTargetAtTime(g, M.c.currentTime, inicio ? 0.015 : 0.1); } }
/* ---------- quadro (src/render3d.js, R.draw, depois do updateCamera): ouvinte, sala, fala e a música ---------- */
function quadro(camera, cam, sim, human, visto, H, R) { const t0 = performance.now();
  try { S.R = R; S.visto = visto; S.H = H; S.zoom = cam && cam.zoom || 1; S.ty = R && R.camTy || 0; S.partidaT = t0;
    const au = A(); if (!S.M && au && au.ctx) montar(au.ctx, au.master);
    const M = S.M; if (M && camera) { const e = camera.matrixWorld.elements, p = camera.position, L = M.c.listener, o = S.lp;
      const fx = -e[8], fy = -e[9], fz = -e[10], ux = e[4], uy = e[5], uz = e[6]; S.ouvT = t0;
      if (Math.abs(p.x - o.x) + Math.abs(p.y - o.y) + Math.abs(p.z - o.z) > 0.05 || Math.abs(fx - o.fx) + Math.abs(fy - o.fy) + Math.abs(fz - o.fz) + Math.abs(ux - o.ux) + Math.abs(uy - o.uy) + Math.abs(uz - o.uz) > 1e-4) {
        o.x = p.x; o.y = p.y; o.z = p.z; o.fx = fx; o.fy = fy; o.fz = fz; o.ux = ux; o.uy = uy; o.uz = uz;
        if (L.positionX) { L.positionX.value = p.x; L.positionY.value = p.y; L.positionZ.value = p.z; L.forwardX.value = fx; L.forwardY.value = fy; L.forwardZ.value = fz; L.upX.value = ux; L.upY.value = uy; L.upZ.value = uz; }
        else { L.setPosition(p.x, p.y, p.z); L.setOrientation(fx, fy, fz, ux, uy, uz); } } }
    if (M && t0 - S.lento > 300) { S.lento = t0; /* a cada 0,3 s (pelo relógio, não por quadro: igual em 30 e em 144 fps): a sala do bioma sob a câmera, a fala no ar e o abaixar */
      let nome = null; if (R && R.cinturao) nome = 'espaco'; else if (sim && sim.biome && ARD.sim && cam) { const SS = ARD.sim, tx = Math.floor(cam.x / SS.TILE), ty = Math.floor(cam.y / SS.TILE); if (tx >= 0 && ty >= 0 && tx < SS.TILES && ty < SS.TILES) nome = BIOMAS[sim.biome[ty * SS.TILES + tx]] || null; }
      if (nome && nome !== M.bioma) { if (nome !== S.biomaVisto) { S.biomaVisto = nome; S.biomaT = t0; } else if (t0 - S.biomaT > 1200 || !M.bioma) sala(nome); } /* bioma novo firme por 1,2 s */
      abaixa((S.fala && t0 - S.falaT < 20000) || falaSistema()); vozNivel(); /* 5.0f.1 */ }
    if (ARD.musica && ARD.musica.quadro) ARD.musica.quadro(sim, human, R); }
  finally { const d = performance.now() - t0; S.med.quadros++; S.med.ms += d; S.anel[S.med.quadros & 255] = d; } } /* anel dos últimos 256 quadros (mediana e pior) */

/* ---------- medidas (testes e relatório) ---------- */
function medidas() { const m = S.med, M = S.M; const q = Math.max(1, m.quadros); const an = Array.from(S.anel.subarray(0, Math.min(256, m.quadros + 1))).filter((x, i) => i > 0 || m.quadros >= 256).sort((a, b) => a - b);
  return { quadros: m.quadros, quadroMediana: an.length ? +an[an.length >> 1].toFixed(4) : 0, quadro95: an.length ? +an[Math.floor(an.length * 0.95)].toFixed(3) : 0, quadroPior: an.length ? +an[an.length - 1].toFixed(2) : 0, msPorQuadro: +((m.ms + m.msSfx) / q).toFixed(4), msQuadro: +(m.ms / q).toFixed(4), msSfxPorQuadro: +(m.msSfx / q).toFixed(4), sfx: m.sfx, toques: m.toques, maxAtivas: m.maxAtivas,
    roubos: M ? M.med.roubos : 0, fora: M ? M.med.fora : 0, vozes: M ? M.vozes.length : 0, frente: M ? M.frente.length : 0, modelo: M ? M.vozes[0].p.panningModel : null, bioma: M ? M.bioma : null, falando: S.falando,
    pronto: S.pronto, preMs: m.preMs, preSeg: m.preSeg, montarMs: m.montarMs, irMs: +m.irMs.toFixed(1), irMaxMs: +m.irMax.toFixed(1), buffers: S.bufs ? Object.keys(S.bufs).length : 0 }; }
function zerar() { S.anel.fill(0); const m = S.med; m.quadros = 0; m.ms = 0; m.sfx = 0; m.msSfx = 0; m.toques = 0; m.maxAtivas = 0; if (S.M) { S.M.med.roubos = 0; S.M.med.fora = 0; } }
/* bancada do áudio (custo no fio de áudio): toca uma linha de efeitos [t, nome, vol] num OfflineAudioContext com o mesmo mixer (ou, com
   antes: true, pela síntese ao vivo de antes da 5.0f) e mede quanto tempo o render leva por segundo de som. o = { seg, linha, antes, leve, modelo, musica: [AudioBuffer] } */
function bancada(o) { const OC = window.OfflineAudioContext || window.webkitOfflineAudioContext, au = A(); const sr = (au && au.ctx && au.ctx.sampleRate) || 48000, seg = o.seg || 10;
  const off = new OC(2, Math.ceil(seg * sr), sr), master = off.createGain(); master.gain.value = 0.35; master.connect(off.destination); let M = null;
  if (!o.antes) { M = criar(off, master, { leve: !!o.leve, modelo: o.modelo || 'HRTF', vozes: o.vozes, limitador: o.limitador }); const L = off.listener; if (L.positionX) { L.positionY.value = 600; L.forwardY.value = -0.7; L.forwardZ.value = -0.7; } M.duckFx.gain.value = 1; M.mus.gain.value = 0.63;
    if (o.sala !== false && !(o.leve && o.arquivos !== false && S.arq)) { const ir = impulso(off, o.sala || 'rocha', !!o.leve); /* 5.0f.1: no celular com os efeitos de arquivo, sem sala (como no jogo) */ M.salas[0].cv.buffer = ir; M.envio.connect(M.salas[0].cv); M.salas[0].w.gain.value = 0.32; }
    if (o.musica) for (const b of o.musica) { const s = off.createBufferSource(); s.buffer = b; s.loop = true; s.connect(M.mus); s.start(0); } }
  let sd = 99; const rnd = () => { sd = (sd * 1103515245 + 12345) >>> 0; return sd / 4294967296; };
  const linha = (o.linha || []).filter(x => x[0] < seg - 0.8); const ag = []; for (const [t, n, v] of linha) ag.push([t, n, v, rnd() * 900 - 450, rnd() * 900 - 450]);
  /* os eventos entram pela linha do tempo do render (suspend/resume), como no jogo: cada um no seu momento, com o mesmo caminho do A.sfx */
  const passo = 0.05; let i = 0; const agenda = []; for (let t = passo; t < seg - 0.5; t += passo) agenda.push(+t.toFixed(3));
  const toca = (tA, tB) => { while (i < ag.length && ag[i][0] < tB) { const [, n, v, x, y] = ag[i++]; if (o.antes) au.sintetiza(off, master, off.currentTime, n, null, v, 0);
      else { let b = S.bufs && S.bufs[n], gv = 1; if (!b) continue; const vs = o.arquivos !== false && S.arq && S.arq[n]; if (vs && vs.length) { const q = vs[(rnd() * vs.length) | 0]; b = q.buf; gv = q.g; } /* 5.0f.1: os efeitos de arquivo */ const pos = POS[n] != null ? [x, 0, -y] : null; tocarBuf(M, b, v * gv, pos ? POS[n] : (FRENTE[n] || 1), pos, v < 0.5 ? 'longe' : 'perto', VARIA[n] ? 1 + (rnd() * 2 - 1) * VARIA[n] : 1, 0, null); } } };
  for (const t of agenda) off.suspend(t).then(() => { toca(0, t); off.resume(); });
  const t0 = performance.now(); return off.startRendering().then(b => { const ms = performance.now() - t0; let pk = 0, s = 0; for (let k = 0; k < b.numberOfChannels; k++) { const d = b.getChannelData(k); for (let j = 0; j < d.length; j++) { const a = Math.abs(d[j]); if (a > pk) pk = a; s += d[j] * d[j]; } }
    return { ms: Math.round(ms), seg, msPorSeg: +(ms / seg).toFixed(1), eventos: i, picoDb: +(20 * Math.log10(pk || 1e-9)).toFixed(1), rmsDb: +(10 * Math.log10(s / (b.length * b.numberOfChannels) || 1e-12)).toFixed(1), roubos: M ? M.med.roubos : 0, fora: M ? M.med.fora : 0 }; }); }

/* src/vozes.js: a saída das vozes gravadas (entra no limitador, junto com o resto) */
function saidaFala(c) { return S.M && S.M.c === c ? S.M.fala : null; }
/* src/musica.js: o barramento de música */
function busMusica(c) { return S.M && S.M.c === c ? S.M.mus : null; }
/* src/m5/sala-som.js: o ambiente da Sala também passa pelo limitador */
function saidaSala(c) { return S.M && S.M.c === c ? S.M.fundo : null; }
/* src/main.js: na partida, os botões da interface soam com o clique da Raça do jogador (um por toque, pela regra de intervalo do A.sfx) */
if (typeof document !== 'undefined' && document.addEventListener) document.addEventListener('click', e => { if (!e.isTrusted || performance.now() - S.partidaT > 1500) return; const t = e.target, b = t && t.closest && t.closest('button, .act, .bcard'); const au = A();
  if (!b || b.disabled || !au || b.id === 'btn-sound' || (b.closest && b.closest('[data-som-mix]'))) return; au.sfx('click', 0.55); }, true);
ARD.som3d = { arquivos: { manifesto, buscar, estado: () => ({ estado: ARQ.estado, motivo: ARQ.motivo, formato: ARQ.fmt, base: somBase(), pedidos: ARQ.med.pedidos, kb: Math.round(ARQ.med.bytes / 1024), falhas: ARQ.med.falhas, decodMs: Math.round(ARQ.med.decodMs), decodMaxMs: Math.round(ARQ.med.decodMax), efeitos: S.med.efeitosArq || 0 }) } /* 5.0f.1 */, voz: () => ({ fundoDb: S.fundoDb != null ? +S.fundoDb.toFixed(1) : null, efeitosDb: S.fxDb != null ? +S.fxDb.toFixed(1) : null, musicaDb: S.musDb != null ? +S.musDb.toFixed(1) : null, ganhoDb: +(20 * Math.log10(S.vozG || 1)).toFixed(1), tipo: S.falaTipo || null }), montar, tocar, quadro, medidas, zerar, volumes, saida, saidaFala, busMusica, saidaSala, bancada, falando: () => !!S.falando, ativo: () => !!S.M, pronto: () => S.pronto, CH, IRS, impulso, criar, _S: S };
})(globalThis.ARD = globalThis.ARD || {});
