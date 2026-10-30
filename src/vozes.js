/* Aether Rift: Dominion — 5.0c.1: vozes gravadas. Toca pelo Web Audio (o mesmo caminho dos efeitos) as falas que a ferramenta tools/vozes gera
   (Kokoro-82M com o caráter de cada Raça assado nos arquivos), com legenda e boca do líder pelo tempo real de cada palavra do manifesto.
   O src/audio.js continua dono da decisão (prioridade, intervalo e fila de A.say); este módulo acha a fala gravada da chave, baixa, decodifica e toca.
   Arquivos: assets/vozes/<idioma>/manifesto.json e assets/vozes/<idioma>/<pacote>/<id>.<formato>. Nenhum é obrigatório: sem eles (o artefato de um
   arquivo só, sem rede, file://) tudo cai na voz do sistema, como antes. Nada aqui toca a simulação; o tocador trabalha por evento, nunca por quadro. */
(function (ARD) {
'use strict';

/* ---------- iPhone e iPad: decisões em constantes, até o resultado da bancada lab/som-iphone.html ----------
   Testes do dono (30/10/2026): no iPhone os efeitos tocam, mas a voz do sistema nunca sai; o "Testar som" mostrou "Áudio: suspenso · Fala: falando".
   A hipótese é que a voz do sistema (speechSynthesis) e o Web Audio brigam pela sessão de áudio do iOS: a fala não sai e ainda deixa o Web Audio
   parado. Com as vozes gravadas o iPhone fala pelo Web Audio, e o speechSynthesis fica de fora. */
const IOS_FALA_SISTEMA = false; /* fala sem arquivo (nome ou número dinâmico, arquivo que ainda não chegou) no iPhone com vozes gravadas: false = só a legenda; true = voz do sistema, como no computador */
const IOS_PREPARO = false; /* fala de preparo (volume 0) no primeiro toque do iPhone com vozes gravadas: false = não chama o speechSynthesis nem para preparar */
const IOS_FORMATOS = null; /* ordem dos formatos no iOS, por cima da do manifesto (por exemplo ['m4a', 'ogg'] se a bancada mostrar Opus que decodifica e soa mal); null = a do manifesto */

/* ---------- carga, memória e som ---------- */
const CONCORRENCIA = 3; /* arquivos baixando ao mesmo tempo num pacote */
const LIMITE_BUFFERS = 16 * 1024 * 1024; /* bytes de AudioBuffer decodificado guardados (os mais antigos saem; os bytes comprimidos ficam) */
const VOZ_GANHO = 1.0; /* ganho próprio da voz (os arquivos saem nivelados em −20 dBFS de nível ativo e pico em −1 dBFS) */
const FADE = 0.06; /* s: corte de uma fala por outra de prioridade maior */
const ESPERA_SALA = 1500, ESPERA_TESTE = 4000; /* ms que a saudação da Sala e o "Testar som" esperam o arquivo baixar; na partida a fala não espera */
const ESPERA_RODANDO = 1500; /* ms que uma fala espera o Web Audio voltar a 'running' (interrupção do iOS) antes de desistir */
const VOZ_CACHE = 'ard-vozes'; /* cache da Cache Storage com as falas que já tocaram (o service worker serve dela sem internet) */
const RACAS = ['vehnar', 'erevane', 'tessara', 'quorith', 'vorag'];
const SONDAS = { /* arquivos minúsculos (0,1 s de um tom) para a sonda de decodeAudioData de cada formato */
  ogg: 'T2dnUwACAAAAAAAAAAAAAAAAAAAAAAIotXIBE09wdXNIZWFkAQE4AYC7AAAAAABPZ2dTAAAAAAAAAAAAAAAAAAABAAAASZW+VAEuT3B1c1RhZ3MGAAAAZmZtcGVnAQAAABQAAABlbmNvZGVyPUxhdmMgbGlib3B1c09nZ1MABPgTAAAAAAAAAAAAAAIAAABuwhBNBjMsLS8jHEiCLrdsVrf0AAHlzZ3tGqbpBeoVkGdipAuSm1xMlTcQQ+vIZSzw/IMw2IfbWQidfiQSoEikiFesmIUDXCYKjsG5vMOw4YIwpjMCy98LDjSIkEO8HbLOpop8EyGbgthoSJwbV1FfJaOPr5QFqXdDARL0KHrwHs6816661FHo0g4DMBhOj/Ok3Q+gVrzoSJwbUlbOH+oRecH0CD7rXFpwvcNszMmZJLXsOGki/eKfK9ew2e8TsfuI9ZjHPTBInBufdZz8STO/xR4H2OHafLQUKMEQgd8W5dgmhzRUzoBR4EiChTYesMmucq9STOP/zwjb2bUHYxoYakufObE=',
  webm: 'GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQRChYECGFOAZwEAAAAAAALMEU2bdLpNu4tTq4QVSalmU6yBoU27i1OrhBZUrmtTrIHGTbuMU6uEElTDZ1OsggEwTbuMU6uEHFO7a1OsggK27AEAAAAAAABZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAVSalmoCrXsYMPQkBNgIRMYXZmV0GETGF2ZkSJiEBbAAAAAAAAFlSua+WuAQAAAAAAAFzXgQFzxYgAAAAAAAAAAZyBACK1nIN1bmSIgQCGhkFfT1BVU1aqg2MuoFa7hATEtACDgQLhkZ+BAbWIQOdwAAAAAABiZIEQY6KTT3B1c0hlYWQBATgBgLsAAAAAABJUw2fRc3POY8CLY8WIAAAAAAAAAAFnyJlFo4dFTkNPREVSRIeMTGF2YyBsaWJvcHVzZ8ihRaOIRFVSQVRJT05Eh5MwMDowMDowMC4xMDgwMDAwMDAAH0O2dUEq54EAo7eBAACASIIut2xWt/QAAeXNne0apukF6hWQZ2KkC5KbXEyVNxBD68hlLPD8gzDYh9tZCJ1+JBKgo7CBABWASKSIV6yYhQNcJgqOwbm8w7DhgjCmMwLL3wsONIiQQ7wdss6minwTIZuC2GijsYEAKYBInBtXUV8lo4+vlAWpd0MBEvQoevAezrzXrrrUUejSDgMwGE6P86TdD6BWvOijs4EAPYBInBtSVs4f6hF5wfQIPutcWnC9w2zMyZkktew4aSL94p8r17DZ7xOx+4j1mMc9MKOngQBRgEicG591nPxJM7/FHgfY4dp8tBQowRCB3xbl2CaHNFTOgFHgoKmhoIEAZQBIgoU2HrDJrnKvUkzj/88I29m1B2MaGGpLnzmxdaKEAM3+YBxTu2uRu4+zgQC3iveBAfGCAYbwgQM=',
  m4a: 'AAAAHGZ0eXBNNEEgAAACAE00QSBpc29taXNvMgAAAu5tb292AAAAbG12aGQAAAAAAAAAAAAAAAAAAAPoAAAAZAABAAABAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAAACPXRyYWsAAABcdGtoZAAAAAMAAAAAAAAAAAAAAAEAAAAAAAAAZAAAAAAAAAAAAAAAAQEAAAAAAQAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAACRlZHRzAAAAHGVsc3QAAAAAAAAAAQAAAGQAAAQAAAEAAAAAAbVtZGlhAAAAIG1kaGQAAAAAAAAAAAAAAAAAAKxEAAAVOlXEAAAAAAAtaGRscgAAAAAAAAAAc291bgAAAAAAAAAAAAAAAFNvdW5kSGFuZGxlcgAAAAFgbWluZgAAABBzbWhkAAAAAAAAAAAAAAAkZGluZgAAABxkcmVmAAAAAAAAAAEAAAAMdXJsIAAAAAEAAAEkc3RibAAAAGpzdHNkAAAAAAAAAAEAAABabXA0YQAAAAAAAAABAAAAAAAAAAAAAQAQAAAAAKxEAAAAAAA2ZXNkcwAAAAADgICAJQABAASAgIAXQBUAAAAAAHDbAABw2wWAgIAFEghW5QAGgICAAQIAAAAgc3R0cwAAAAAAAAACAAAABQAABAAAAAABAAABOgAAABxzdHNjAAAAAAAAAAEAAAABAAAABgAAAAEAAAAsc3RzegAAAAAAAAAAAAAABgAAAGsAAAB5AAAAOAAAAD8AAABdAAAABQAAABRzdGNvAAAAAAAAAAEAAAMaAAAAGnNncGQBAAAAcm9sbAAAAAIAAAAB//8AAAAcc2JncAAAAAByb2xsAAAAAQAAAAYAAAABAAAAPXVkdGEAAAA1bWV0YQAAAAAAAAAhaGRscgAAAAAAAAAAbWRpcmFwcGwAAAAAAAAAAAAAAAAIaWxzdAAAAAhmcmVlAAABxW1kYXQBME8o6R0dh0S89ep1zn1d5JElxZ5Sf/Nht3A/Beq9i77RWmCvH+PS8HV/7df4N9W+rfVtDAxsGBgZEiRGzZs2ioUJTZs2bRIkUsuJs3KilllxxoEH4aVQ/apdF9qmUPs3oPl3pMtB+Jl4HAE4kNrI3VRTiynFkuHP8+2uGzx/9a/frjXGv/p4/nzxrjX/p7/z5411oN/raOj2RiF0CZYQs/U6zeUxtzgM5wGBncJmBgZ3CQkGBncJCYTYS7/CFWG6nzlyvSlb0oTezNyhJUlmDShISSvA0oSEscvENRRRQaiiijgBQO8LGmd87/Z+/t5u+HDVauruHBJJAl13Om7NmM77kMnwBn9wMmYDP7wjJmAz+4HD4Az+4GTMBwE6TxMaZveev7f+Wr17PNcVaXaW4ElgAAAAAYKAAAAMMDw8+sQAGFDw9txAAw9oe7wADDjw/N7ABT2h7bwAHAEwkbLKXVZHiiXAcvt+/ni3Nr+Pt+vnWuNf/Tfxd644HBun2uVla5/aOt8lslZgYrMDFcpnBmaMqVWrrPRte7iQjGHqQ/kfyH8vUH8v5B/L+RsOus5RRfKedXRRwAEYgbRw',
  mp3: '//sQxAAABHQTVVSQgDCmCa83GiACAAGtOUAAAVk6PVBQCAYJAfB8HwfKAgCAYRB8H9QIOxOH+INwBJP2wGA4HA4AAAAAACiJKpkUZAjpAkgWo/eFAfATG/AilC+oGhL8JA0qCgAYMAD/+xLEAoPFWB0gHeAAKJsD40GvaEzMCQC8QASGAOB4Z+72pmMDlmHEESYMAH5gQgYGBSBMYF4DxZq0lYeYIIZk+cS0YX4opqvUomp+KKYYQMxz3pn0pmjxm45iQriU4Ju+qjDQ4w4dMdP/+xDEA4PFBB8YDfsiQK2EYoG/bEiDPoMwrxvjUM4cNOsbQwngbTXMAgZuqHV+awbJpaHP1/QkQYmImbHBu8aYlw7RwV9cG/wO4YmoT5wjIZ4jGZn5mTwYsLMHjFPgH/q+ijChEw8cMf/7EsQDA8UAHxgN+yJAtAQkArwABaOzPYYwphyTTb5rNLgb8wlwcDSRAQRvJnb4a4TNZ4N/r+h2RCAKYD4C5gLAuGDEG0aUTCpoEj3mICFWYPoF5gKggmByBiYGoGINABi9vBSNASIBAv/7EMQCgAT8O0gZo4AAkIWgw55gABgvCwoyCJ4VwfJlrDFjJTb9yIpZxwdjebyZAERFmYVBX5Y8LMADgBUMY7RNTxE+AWi8k+E2Mp+nUNVupIgEJCQNQaPfWd4iTEFNRTMuMTAwqqqq' };
const MIME = { ogg: 'audio/ogg; codecs=opus', webm: 'audio/webm; codecs=opus', m4a: 'audio/mp4; codecs=mp4a.40.2', mp3: 'audio/mpeg' };

/* ---------- configuração: onde ficam os arquivos ----------
   O tools/build.mjs troca o marcador abaixo: { base: 'assets/vozes/', idiomas: [...] } no index.html (GitHub Pages), '../assets/vozes/' no
   dist/local.html e null no arquivo único dist/aether-rift-beta.html (o artefato não pede arquivo nenhum). ?vozes=<pasta relativa> aponta para outra
   pasta (testes e o manifesto provisório em work/); ?vozes=0 desliga. */
const CFG_TXT = '__VOZES__'; let CFG = null; try { if (CFG_TXT.charAt(0) === '{') CFG = JSON.parse(CFG_TXT); } catch (e) { CFG = null; }
const A = () => ARD.audio || null;
const IDI = () => ARD.idioma || 'pt-BR';
const UA = () => (typeof navigator !== 'undefined' && navigator.userAgent) || '';
const ehIOS = () => { const ua = UA(); return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1); };
function param(k) { try { return new URLSearchParams(location.search).get(k); } catch (e) { return null; } }
function base() { const q = param('vozes'); if (q === '0' || q === 'off') return null; if (q && /^[\w./-]+$/.test(q) && !/^\/\//.test(q)) return /\/$/.test(q) ? q : q + '/';
  if (typeof location === 'undefined' || location.protocol === 'file:' || typeof fetch !== 'function') return null; /* fetch não lê file:// */
  return CFG && CFG.base ? CFG.base : null; }
function idiomaTem(I) { if (param('vozes')) return true; return !!(CFG && Array.isArray(CFG.idiomas) && CFG.idiomas.indexOf(I) >= 0); }

/* ---------- estado ---------- */
const V = { estado: 'parado', motivo: '', idioma: null, formato: null, m: null, ultimo: null, baixado: { total: 0, pacotes: {} }, decodificado: 0, P: null, destaque: null, IOS: { FALA_SISTEMA: IOS_FALA_SISTEMA, PREPARO: IOS_PREPARO, FORMATOS: IOS_FORMATOS } };
const BYTES = new Map(), PEDIDOS = new Map(), BUF = new Map(); let bufBytes = 0; const TOCOU = new Set(); /* chaves '<idioma>/<id>' */
const ULT = {}, PROX = {}; /* última variante tocada e a próxima já sorteada (a da Sala, baixada antes), por '<pacote>|<chave>' */
const mem = id => V.idioma + '/' + id;
let mProm = null, mIdi = null;

/* o manifesto do idioma atual (Promise do manifesto ou null) */
function manifesto() { const I = IDI(); const au = A();
  if (au && au.gravadas === false) { V.estado = 'desligada'; return Promise.resolve(null); }
  if (V.m && V.idioma === I) return Promise.resolve(V.m); if (mProm && mIdi === I) return mProm;
  const b = base(); if (!b) { V.estado = 'indisponivel'; V.motivo = 'sem-arquivo'; return Promise.resolve(null); }
  if (!idiomaTem(I)) { V.estado = 'indisponivel'; V.motivo = 'sem-arquivo'; return Promise.resolve(null); }
  V.estado = 'carregando'; mIdi = I;
  const p = mProm = fetch(b + I + '/manifesto.json', { cache: 'no-cache' }).then(r => { if (!r.ok) throw new Error('http ' + r.status); return r.json(); })
    .then(m => { if (!m || !m.falas || !m.chaves) throw new Error('manifesto sem falas'); return escolherFormato(m).then(f => { if (mProm !== p) return null; if (!f) { V.estado = 'indisponivel'; V.motivo = 'formato'; refazUI(); return null; }
      trocarIdioma(I); V.m = m; V.formato = f; V.estado = 'pronto'; V.motivo = ''; V.ver = encodeURIComponent(String(m.versao || '') + (m.gerado ? '-' + m.gerado : '')); posicoes(m); refazUI(); return m; }); })
    .catch(() => { if (mProm === p) { V.estado = 'indisponivel'; V.motivo = 'sem-arquivo'; mProm = null; mIdi = null; refazUI(); } return null; });
  return p; }
const refazUI = () => { try { const a = A(); if (a && a.refazUI) a.refazUI(); } catch (e) {} }; /* a dica de Ajustes depende de as vozes gravadas estarem disponíveis */
function trocarIdioma(I) { if (V.idioma === I) return; V.idioma = I; BYTES.clear(); PEDIDOS.clear(); BUF.clear(); bufBytes = 0; for (const k in PROX) delete PROX[k]; }

/* ---------- formato: o primeiro de "formatos" que o aparelho decodifica de verdade (sonda de decodeAudioData com um arquivo minúsculo) ---------- */
const SONDA = {}; let offCtx = null;
function b64(s) { const bin = atob(s), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u.buffer; }
function decodificaFormato(fmt) { if (SONDA[fmt]) return SONDA[fmt]; return (SONDA[fmt] = new Promise(res => {
  if (!SONDAS[fmt]) { res(false); return; } let fim = false; const ok = v => { if (!fim) { fim = true; res(v); } }; setTimeout(() => ok(false), 3000);
  try { const OC = window.OfflineAudioContext || window.webkitOfflineAudioContext; if (!OC) { ok(false); return; } offCtx = offCtx || new OC(1, 1, 48000);
    const pr = offCtx.decodeAudioData(b64(SONDAS[fmt]), b => ok(!!(b && b.length > 0)), () => ok(false)); if (pr && pr.then) pr.then(b => ok(!!(b && b.length > 0)), () => ok(false)); } catch (e) { ok(false); } })); }
function escolherFormato(m) { let ordem = Array.isArray(m.formatos) && m.formatos.length ? m.formatos.slice() : ['ogg'];
  if (ehIOS() && Array.isArray(IOS_FORMATOS)) { const pref = IOS_FORMATOS.filter(f => ordem.indexOf(f) >= 0); ordem = pref.concat(ordem.filter(f => pref.indexOf(f) < 0)); }
  const tenta = i => i >= ordem.length ? Promise.resolve(null) : decodificaFormato(ordem[i]).then(ok => ok ? ordem[i] : tenta(i + 1));
  return tenta(0); }
V.sonda = () => Promise.all(Object.keys(SONDAS).map(f => decodificaFormato(f).then(ok => [f, ok]))).then(l => { const o = {}; l.forEach(([f, ok]) => { let cp = ''; try { cp = new Audio().canPlayType(MIME[f]); } catch (e) {} o[f] = { decodifica: ok, canPlayType: cp }; }); return o; }); /* diagnóstico e testes */

/* posição de cada palavra no texto (o 'ard-voz' leva { i, n } como o boundary da voz do sistema) */
function posicoes(m) { for (const id in m.falas) { const f = m.falas[id]; if (!f || f.__pos) continue; const t = String(f.texto || ''), low = t.toLowerCase(); const pos = []; let c = 0;
  for (const w of Array.isArray(f.palavras) ? f.palavras : []) { const s = String(w[2] || ''), core = s.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''); let i = core ? low.indexOf(core.toLowerCase(), c) : -1; if (i < 0) i = Math.min(c, t.length); const n = core ? core.length : Math.max(1, s.length); pos.push([+w[0] || 0, +w[1] || 0, i, n]); c = i + n; }
  Object.defineProperty(f, '__pos', { value: pos, enumerable: false }); } }

/* ---------- bytes e AudioBuffers ---------- */
function url(f) { const arq = String(f.arq || ''); return base() + V.idioma + '/' + arq.replace(/\.[a-z0-9]+$/i, '.' + V.formato) + (V.ver ? '?v=' + V.ver : ''); }
function bytes(id) { const k = mem(id); if (BYTES.has(k)) return Promise.resolve(BYTES.get(k)); if (PEDIDOS.has(k)) return PEDIDOS.get(k);
  const m = V.m, f = m && m.falas[id]; if (!f) return Promise.reject(new Error('fala desconhecida'));
  const p = fetch(url(f)).then(r => { if (!r.ok) throw new Error('http ' + r.status); return r.arrayBuffer(); }).then(ab => { PEDIDOS.delete(k); if (V.m !== m) throw new Error('idioma trocou');
    BYTES.set(k, ab); V.baixado.total += ab.byteLength; const pc = f.pacote || '?'; V.baixado.pacotes[pc] = (V.baixado.pacotes[pc] || 0) + ab.byteLength; return ab; }, e => { PEDIDOS.delete(k); throw e; });
  PEDIDOS.set(k, p); return p; }
const pronta = id => BYTES.has(mem(id)) || BUF.has(mem(id));
function decodificar(id) { const k = mem(id); if (BUF.has(k)) { const b = BUF.get(k); BUF.delete(k); BUF.set(k, b); return Promise.resolve(b); } /* LRU: a mais usada vai para o fim */
  return bytes(id).then(ab => new Promise((ok, no) => { const au = A(); au.init(); const c = au.ctx; if (!c) { no(new Error('sem Web Audio')); return; } let fim = false; const fe = (f, v) => { if (!fim) { fim = true; f(v); } };
    try { const pr = c.decodeAudioData(ab.slice(0) /* o decodeAudioData toma posse do ArrayBuffer: os bytes guardados ficam inteiros */, b => fe(ok, b), e => fe(no, e || new Error('decodificação'))); if (pr && pr.then) pr.then(b => fe(ok, b), e => fe(no, e || new Error('decodificação'))); } catch (e) { fe(no, e); } }))
    .then(b => { const tam = b.length * b.numberOfChannels * 4; BUF.set(k, b); bufBytes += tam; V.decodificado++; while (bufBytes > LIMITE_BUFFERS && BUF.size > 1) { const [k0, b0] = BUF.entries().next().value; BUF.delete(k0); bufBytes -= b0.length * b0.numberOfChannels * 4; } return b; }); }
/* a fala que tocou pela primeira vez vai para a Cache Storage: o service worker serve dela, para jogar sem internet */
function guardar(id) { const k = mem(id); if (TOCOU.has(k)) return; TOCOU.add(k); const ab = BYTES.get(k); if (!ab || typeof caches === 'undefined' || !navigator.serviceWorker || !navigator.serviceWorker.controller) return;
  const u = new URL(url(V.m.falas[id]), location.href).href; try { caches.open(VOZ_CACHE).then(c => c.put(u, new Response(ab.slice(0), { headers: { 'Content-Type': MIME[V.formato] || 'application/octet-stream' } }))).catch(() => {}); } catch (e) {} }

/* ---------- carga preguiçosa: nunca durante a tela de carregamento da partida (que é cronometrada); em tempo ocioso ---------- */
const filaIds = []; let ativos = 0;
const carregandoPartida = () => { const el = typeof document !== 'undefined' && document.getElementById('loading'); return !!(el && !el.hidden); };
const ocioso = f => { if (typeof requestIdleCallback === 'function') requestIdleCallback(f, { timeout: 2500 }); else setTimeout(f, 60); };
let vigiaCarga = null;
function depoisDaCarga(f) { if (!carregandoPartida()) { f(); return; } const el = document.getElementById('loading'); const fs = vigiaCarga ? vigiaCarga.fs : []; fs.push(f); if (vigiaCarga) return;
  const ob = new MutationObserver(() => { if (carregandoPartida()) return; ob.disconnect(); vigiaCarga = null; fs.splice(0).forEach(g => { try { g(); } catch (e) {} }); }); ob.observe(el, { attributes: true, attributeFilter: ['hidden'] }); vigiaCarga = { ob, fs }; }
/* tempo livre: fora da tela de carregamento e com o navegador ocioso (confere a carga de novo na volta do ocioso, que pode cair já dentro dela) */
function livre(f) { const vai = () => { if (carregandoPartida()) { depoisDaCarga(vai); return; } ocioso(() => { if (carregandoPartida()) { depoisDaCarga(vai); return; } f(); }); }; vai(); }
function bomba() { while (ativos < CONCORRENCIA && filaIds.length) { if (carregandoPartida()) { depoisDaCarga(bomba); return; } const id = filaIds.shift(); if (!V.m || !V.m.falas[id] || pronta(id)) continue; ativos++;
  setTimeout(() => { if (carregandoPartida()) { ativos--; filaIds.unshift(id); depoisDaCarga(bomba); return; } bytes(id).catch(() => {}).then(() => { ativos--; bomba(); }); }, 0); } } /* 5.0c.1 (junção): o pacote começa num momento ocioso (livre, em carregarPacote) e depois segue sem esperar ocioso a cada arquivo: baixar quase não usa a linha principal (a decodificação fica para a 1ª vez que a fala toca). Com o ocioso por arquivo (até 2,5 s cada, 3 por vez), o pacote real da Vehnar (105 arquivos) não terminava em 2 min numa partida pesada, e as falas que faltavam caíam na voz do sistema */
function enfileirar(ids, frente) { const novos = ids.filter(id => !pronta(id) && filaIds.indexOf(id) < 0); if (frente) filaIds.unshift(...novos); else filaIds.push(...novos); bomba(); }
/* o pacote inteiro (Raça do jogador na partida, falas da missão na campanha) */
function idsDoPacote(m, pac) { const out = []; for (const id in m.falas) if (m.falas[id] && m.falas[id].pacote === pac) out.push(id); if (!out.length && m.chaves[pac]) for (const k in m.chaves[pac]) for (const id of m.chaves[pac][k]) if (out.indexOf(id) < 0) out.push(id); return out; }
const ATIVOS = new Set(); /* pacotes que esta tela quer (refeitos na troca de idioma) */
function carregarPacote(pac) { if (!pac) return; ATIVOS.add(pac); livre(() => manifesto().then(m => { if (m && ATIVOS.has(pac)) enfileirar(idsDoPacote(m, pac)); })); }
V.carregarPacote = carregarPacote;

/* ---------- achar a fala gravada de uma chave ---------- */
function pacoteDe(chave, raca, o) { if (o && o.pacote) return o.pacote; const mc = /^camp:([^:]+):/.exec(chave); if (mc) return 'camp-' + mc[1]; const ms = /^sala-([a-z]+)$/.exec(chave); if (ms) return ms[1];
  const au = A(); return raca || (au && au.raca) || V.destaque || null; }
function temRaca(id, f, r) { if (f && f.raca) return f.raca === r; return new RegExp('(^|[-_./:])' + r + '($|[-_./:])').test(id); }
function sortear(chaveP, ids, raca) { let l = ids; if (raca) { const m = V.m, fil = ids.filter(id => temRaca(id, m.falas[id], raca)); const comInfo = ids.some(id => (m.falas[id] && m.falas[id].raca) || RACAS.some(r => temRaca(id, null, r))); if (fil.length) l = fil; else if (comInfo && /^camp-/.test(chaveP)) return null; }
  if (PROX[chaveP] && l.indexOf(PROX[chaveP]) >= 0) { const id = PROX[chaveP]; delete PROX[chaveP]; return id; }
  if (l.length === 1) return l[0]; const ult = ULT[chaveP]; const op = l.filter(x => x !== ult); return op[Math.floor(Math.random() * op.length)] || l[0]; }
/* uma parte: { chaves: [candidatas], pacote?, raca? } → { id, f } */
function parte(p, raca) { const m = V.m; const cs = Array.isArray(p.chaves) ? p.chaves : [p.chaves];
  for (const ch of cs) { if (!ch) continue; const pac = pacoteDe(ch, p.raca || raca, p); const tab = pac && m.chaves[pac]; const ids = tab && tab[ch]; if (!ids || !ids.length) continue;
    const id = p.id && ids.indexOf(p.id) >= 0 ? p.id : sortear(pac + '|' + ch, ids.filter(x => m.falas[x]), p.campRaca || null); if (!id) continue; return { id, f: m.falas[id], chave: ch, pacote: pac }; }
  return null; }
/* a fala (ou a sequência de falas) de uma chave: { itens, texto, dur, pronta, chave, pacote } ou null (sem manifesto, sem a chave) */
V.achar = function (chaves, raca, o) { o = o || {}; const au = A(); if (!au || au.gravadas === false || V.estado !== 'pronto' || !V.m || V.idioma !== IDI()) return null;
  const partes = o.partes || [{ chaves, pacote: o.pacote, campRaca: o.campRaca, id: o.id }]; const itens = [];
  for (const p of partes) { const it = parte(p, raca); if (!it) return null; itens.push(it); }
  return { itens, texto: itens.map(x => String(x.f.texto || '')).join(' '), dur: itens.reduce((s, x) => s + (+x.f.dur || 0), 0), pronta: itens.every(x => pronta(x.id)), chave: itens[0].chave, pacote: itens[0].pacote }; };
/* disponível = ligadas, com manifesto pronto ou a caminho (no iPhone a decisão de não chamar a voz do sistema vem daqui) */
V.disponivel = () => { const au = A(); if (!au || au.gravadas === false) return false; if (V.estado === 'pronto' || V.estado === 'carregando') return true; return V.estado === 'parado' && !!base() && idiomaTem(IDI()); };
V.ehIOS = ehIOS;
V.semFalaSistema = () => ehIOS() && V.disponivel() && !IOS_FALA_SISTEMA; /* iPhone com vozes gravadas: fala sem arquivo só na legenda */
V.semPreparo = () => ehIOS() && V.disponivel() && !IOS_PREPARO;

/* ---------- tocar ----------
   g = V.achar(...); cb = { inicio(), palavra(i, n, dur, w), fim(), falhou(motivo) }. Devolve { parar(fade) }. Bytes que faltam esperam até o.espera ms;
   decodifica na primeira vez; espera o Web Audio voltar a 'running' (interrupção do iOS) até ESPERA_RODANDO ms. */
let ganho = null;
function saida(c) { if (ganho && ganho.context === c) return ganho; ganho = c.createGain(); ganho.gain.value = VOZ_GANHO; ganho.connect(c.destination); return ganho; }
function rodando(c, ms) { if (c.state === 'running') return Promise.resolve(true); const au = A(); if (au && au.resume) au.resume();
  return new Promise(ok => { let fim = false; const pronto = v => { if (fim) return; fim = true; try { c.removeEventListener('statechange', f); } catch (e) {} ok(v); }; const f = () => { if (c.state === 'running') pronto(true); };
    try { c.addEventListener('statechange', f); } catch (e) {} setTimeout(() => pronto(c.state === 'running'), ms); }); }
function comTempo(p, ms) { return ms > 0 ? Promise.race([p, new Promise((ok, no) => setTimeout(() => no(new Error('tempo')), ms))]) : p; }
V.tocar = function (g, cb, o) { o = o || {}; const h = { parado: false, fontes: [], timers: [], g1: null, iniciou: false, acabou: false };
  const fim = motivo => { if (h.acabou) return; h.acabou = true; for (const t of h.timers) clearTimeout(t); h.timers.length = 0; if (motivo && !h.iniciou) { V.ultimo = { estado: motivo, chave: g.chave, quando: Date.now() }; if (cb.falhou) cb.falhou(motivo); } else if (cb.fim) cb.fim(); };
  h.parar = fade => { if (h.parado) return; h.parado = true; const au = A(), c = au && au.ctx; if (h.g1 && c) { const t = c.currentTime, f = fade == null ? FADE : fade; try { h.g1.gain.cancelScheduledValues(t); h.g1.gain.setValueAtTime(h.g1.gain.value, t); h.g1.gain.linearRampToValueAtTime(0, t + f); } catch (e) {} for (const s of h.fontes) try { s.onended = null; s.stop(t + f + 0.01); } catch (e) {} }
    if (!h.iniciou) fim('cancelada'); else fim(); };
  const espera = o.espera || 0; const ps = g.itens.map(it => comTempo(decodificar(it.id), pronta(it.id) ? 0 : espera || 3000));
  Promise.all(ps).then(bufs => { if (h.parado) return null; const c = A().ctx; return rodando(c, ESPERA_RODANDO).then(ok => { if (h.parado) return null; if (!ok) throw Object.assign(new Error('suspenso'), { motivo: 'suspenso' }); return bufs; }); })
    .then(bufs => { if (!bufs || h.parado) return; const c = A().ctx; const g1 = h.g1 = c.createGain(); g1.gain.value = 1; g1.connect(saida(c)); const t0 = c.currentTime + 0.03; let t = t0; const marcas = [];
      bufs.forEach((b, k) => { const s = c.createBufferSource(); s.buffer = b; s.connect(g1); s.start(t); h.fontes.push(s); const f = g.itens[k].f; for (const p of f.__pos || []) marcas.push([t - t0 + p[0], p[1] - p[0], p[2] + (k ? g.itens.slice(0, k).reduce((s2, x) => s2 + String(x.f.texto || '').length + 1, 0) : 0), p[3]]); t += b.duration + (k < bufs.length - 1 ? 0.12 : 0); });
      const ult = h.fontes[h.fontes.length - 1]; ult.onended = () => { if (!h.parado) fim(); };
      const ms = Math.max(0, (t0 - c.currentTime) * 1000); h.timers.push(setTimeout(() => { if (h.parado) return; h.iniciou = true; V.ultimo = { estado: 'tocou', chave: g.chave, quando: Date.now() }; for (const it of g.itens) { guardar(it.id); ULT[it.pacote + '|' + it.chave] = it.id; } if (cb.inicio) cb.inicio();
        let i = 0; const prox = () => { if (h.parado || i >= marcas.length) return; const mk = marcas[i++]; if (cb.palavra) cb.palavra(mk[2], mk[3], mk[1], g.texto.substr(mk[2], mk[3])); if (i < marcas.length) h.timers.push(setTimeout(prox, Math.max(0, (marcas[i][0] - (c.currentTime - t0)) * 1000))); };
        if (marcas.length) h.timers.push(setTimeout(prox, Math.max(0, (marcas[0][0] - (c.currentTime - t0)) * 1000))); }, ms));
      h.timers.push(setTimeout(() => { if (!h.parado && !h.acabou) fim(); }, ms + (t - t0) * 1000 + 1500)); /* rede de segurança: o onended que não veio */ })
    .catch(e => { if (h.parado) return; const mot = e && e.motivo ? e.motivo : e && /tempo|http|fala desconhecida|idioma/.test(String(e.message || '')) ? 'sem-arquivo' : e && /sem Web Audio/.test(String(e.message || '')) ? 'sem-webaudio' : 'formato'; fim(mot); });
  return h; };

/* ---------- Sala de Comando: só a saudação do líder em destaque ----------
   A Raça em destaque é a do html[data-race] (src/ui-start.js). A variante da próxima saudação é sorteada e baixada antes; ao trocar de Raça, a
   saudação da Raça nova é pedida na hora (a Sala espera até ESPERA_SALA ms por ela). */
function preparaSaudacao(r) { if (!r || RACAS.indexOf(r) < 0) return; V.destaque = r; const st = document.getElementById('start'); if (st && st.hidden) return;
  const vai = () => manifesto().then(m => { if (!m || V.destaque !== r) return; const id = saudacaoDe(m, r); if (!id) return; enfileirar([id], true);
    if (!V.todasSaudacoes) { V.todasSaudacoes = true; enfileirar(RACAS.filter(x => x !== r).map(x => saudacaoDe(m, x)).filter(Boolean)); } });
  if (V.m) vai(); else livre(vai); } /* 5.0c.1 (testes do dono): com o manifesto já carregado, a saudação da Raça nova baixa na hora (antes, cada troca esperava um momento ocioso, até 2,5 s no Firefox com a Sala desenhando, e a voz chegava depois do voo); depois da primeira, as saudações das outras quatro Raças baixam em segundo plano (5 arquivos, cerca de 100 KB) */
function saudacaoDe(m, r) { const ch = 'sala-' + r, tab = m.chaves[r], ids = tab && tab[ch]; if (!ids || !ids.length) return null;
  const k = r + '|' + ch; let id = PROX[k]; if (!id || ids.indexOf(id) < 0) { const ult = ULT[k], op = ids.filter(x => x !== ult); id = PROX[k] = op[Math.floor(Math.random() * op.length)] || ids[0]; } return id; }
V.preparaSaudacao = preparaSaudacao;
if (typeof document !== 'undefined' && typeof MutationObserver !== 'undefined') {
  const liga = () => { const h = document.documentElement; V.destaque = h.dataset.race || V.destaque; new MutationObserver(() => { const r = h.dataset.race; if (r && r !== V.destaque) preparaSaudacao(r); }).observe(h, { attributes: true, attributeFilter: ['data-race'] });
    const vai = () => { if (!V.P) preparaSaudacao(document.documentElement.dataset.race); }; if (document.readyState === 'complete') setTimeout(vai, 2500); else addEventListener('load', () => setTimeout(vai, 2500), { once: true }); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', liga); else liga(); }
/* a saudação que acabou de tocar já sorteia e baixa a próxima */
V.depoisDaSala = r => { if (!V.P) setTimeout(() => preparaSaudacao(r), 400); };

/* troca de idioma: o manifesto e o pacote do idioma novo */
try { addEventListener('ard-idioma', () => { V.todasSaudacoes = false; /* 5.0c.1 */ mProm = null; mIdi = null; V.m = null; V.estado = 'parado'; filaIds.length = 0; const pacs = [...ATIVOS]; ATIVOS.clear(); if (V.P) pacs.forEach(carregarPacote); else preparaSaudacao(V.destaque); }); } catch (e) {}
/* vozes gravadas ligadas/desligadas em Ajustes */
V.mudou = () => { V.todasSaudacoes = false; /* 5.0c.1 */ mProm = null; mIdi = null; V.m = null; V.estado = 'parado'; if (A() && A().gravadas !== false) { const pacs = [...ATIVOS]; ATIVOS.clear(); if (V.P) pacs.forEach(carregarPacote); else preparaSaudacao(V.destaque); } };
V.manifesto = manifesto;
V.estadoMem = () => ({ estado: V.estado, motivo: V.motivo, idioma: V.idioma, formato: V.formato, bytes: [...BYTES.values()].reduce((s, b) => s + b.byteLength, 0), arquivos: BYTES.size, buffers: BUF.size, bufBytes, baixado: JSON.parse(JSON.stringify(V.baixado)), decodificado: V.decodificado, fila: filaIds.length, ativos: [...ATIVOS] });

V.ESPERA_SALA = ESPERA_SALA; V.ESPERA_TESTE = ESPERA_TESTE;
/* a fala que não estava pronta é pedida na frente da fila (sai na próxima vez) */
V.pedir = g => { if (g && g.itens) enfileirar(g.itens.map(x => x.id), true); };

/* ---------- falas do jogo: chaves (o contrato com o roteiro do v-gravar, tools/vozes/roteiro.json) ----------
   Cada fala nova tem a chave do roteiro e, como reserva, outras grafias (o jogo usa a primeira que o manifesto tiver). */
const COMUNS = ['built', 'spawn', 'Pesquisa concluída', 'Base sob ataque', 'Núcleo sob ataque', 'Alerta de sifão', 'Pacto quebrado', 'Tempestade de Éter', 'Blecaute', 'Fundição Orbital', 'Salto de Núcleo', 'Pacto assinado', 'voz-on'];
const LOC = { /* avisos novos do locutor: tipo de fala (prioridade e intervalo do src/audio.js) e a chave do roteiro */
  promovida: { tipo: 'pesquisa', c: ['loc:promovida'] }, modulo: { tipo: 'obra', c: ['loc:modulo'] }, era2: { tipo: 'evento', c: ['loc:era2'] }, era3: { tipo: 'evento', c: ['loc:era3'] },
  ascensao: { tipo: 'evento', c: ['loc:ascensao'] }, superarma: { tipo: 'evento', c: ['loc:superarma'] }, sobrecarga: { tipo: 'pesquisa', c: ['loc:sobrecarga'] },
  'nodulo-ataque': { tipo: 'perigo', c: ['loc:nodulo-ataque'] }, 'recursos-roubados': { tipo: 'perigo', c: ['loc:recursos-roubados'] },
  unissono: { tipo: 'evento', c: ['loc:unissono'] }, eclosao: { tipo: 'evento', c: ['loc:eclosao'] }, 'salto-evolutivo': { tipo: 'evento', c: ['loc:salto-evolutivo'] },
  'pacto-recusado': { tipo: 'evento', c: ['loc:pacto-recusado'] }, 'pacto-cumprido': { tipo: 'evento', c: ['loc:pacto-cumprido'] },
  'tempestade-perto': { tipo: 'evento', c: ['loc:tempestade-perto'] }, 'tempestade-ativa': { tipo: 'evento', c: ['loc:tempestade-ativa'] },
  veio: { tipo: 'evento', c: ['loc:veio'] }, caixa: { tipo: 'pesquisa', c: ['loc:caixa'] }, vitoria: { tipo: 'sistema', c: ['loc:vitoria'] }, derrota: { tipo: 'sistema', c: ['loc:derrota'] },
  'inimigos-1': { tipo: 'evento', c: ['loc:inimigos-1'] }, 'inimigos-2': { tipo: 'evento', c: ['loc:inimigos-2'] }, 'inimigos-3': { tipo: 'evento', c: ['loc:inimigos-3'] } };
const LID = { /* reações do líder na partida (lider:retomada é a da campanha retomada de um salvamento) */
  era: ['lider:era'], superarma: ['lider:superarma'], 'base-atacada': ['lider:base-atacada'], 'inimigo-eliminado': ['lider:inimigo-eliminado'], vitoria: ['lider:vitoria'], derrota: ['lider:derrota'],
  pacto: ['lider:pacto'], traicao: ['lider:traicao'], tempestade: ['lider:tempestade'], ascensao: ['lider:ascensao'], retomada: ['lider:retomada'] };
const CLASSES = ['civil', 'infantaria', 'veiculo', 'drone', 'suporte'], ACOES = ['sel', 'mover', 'atacar'];
const CLS = { civ: 'civil', inf: 'infantaria', vei: 'veiculo', dro: 'drone', sup: 'suporte' };
const IAS = { vehnar: ['Fundição Kessari', 'Consórcio Oryn', 'Estaleiro Vey'], erevane: ['Clã Sombrio', 'Náufragos de Ísk', 'Corsários da Faixa'], tessara: ['Linhagem Oriel', 'Ordem do Molde', 'Enxerto Vassi'], quorith: ['Coro de Zayin', 'Acorde Sétimo', 'Silêncio de Quor'], vorag: ['Prole Velk', 'Ninhada Cega', 'Fome de Oru'] }; /* os nomes das IAs de src/main.js */
const slug = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
function chavesElim(nome) { return ['elim:' + slug(nome)]; }
/* as chaves que o jogo usa, por pacote de Raça (o portão de qualidade confere o manifesto de cada idioma contra esta lista) */
V.chavesDoJogo = () => { const porRaca = []; COMUNS.forEach(k => porRaca.push({ nome: k, c: [k] })); for (const n in LOC) porRaca.push({ nome: 'loc:' + n, c: LOC[n].c }); for (const n in LID) porRaca.push({ nome: 'lider:' + n, c: LID[n] });
  CLASSES.forEach(cl => ACOES.forEach(a => porRaca.push({ nome: 'unid:' + cl + ':' + a, c: ['unid:' + cl + ':' + a] }))); for (const r in IAS) IAS[r].forEach(nm => porRaca.push({ nome: 'elim:' + slug(nm), c: chavesElim(nm) }));
  return { porRaca, sala: r => 'sala-' + r, RACAS: RACAS.slice() }; };

const au = () => A();
function loc(nome) { const L = LOC[nome], a = au(); if (!L || !a || !a.voice) return false; return a.say(null, L.c[0], null, null, { chaves: L.c, tipo: L.tipo }); }
function reacao(ev) { const c = LID[ev], a = au(); if (!c || !a || !a.voice) return false; return a.say(null, c[0], null, a.raca, { chaves: c, tipo: 'reacao', lider: true }); }
V.loc = loc; V.reacao = reacao;

/* ---------- partida: liga o pacote da Raça do jogador, a superarma pronta e a boca do líder (src/main.js chama ao começar) ---------- */
let superT = null;
V.partida = function (o) { o = o || {}; if (superT) { clearInterval(superT); superT = null; } const sim = o.sim, h = o.human || 0, p = sim && sim.players && sim.players[h];
  V.P = { sim, human: h, lead3d: o.lead3d || null, missao: o.missao || null, raca: p ? p.faction : null, superVisto: null, fim: false };
  for (const k of [...BYTES.keys()]) { const id = k.slice(k.indexOf('/') + 1), f = V.m && V.m.falas[id]; if (!f || (f.pacote !== V.P.raca && f.pacote !== 'camp-' + V.P.missao)) BYTES.delete(k); } /* memória: só a Raça e a missão desta partida */
  ATIVOS.clear(); filaIds.length = 0; const a = au(); if (a && a.voice && a.gravadas !== false) { if (V.P.raca) carregarPacote(V.P.raca); if (V.P.missao) carregarPacote('camp-' + V.P.missao); }
  superT = setInterval(checarSuper, 1000); };
/* "Superarma pronta": Era III, Laboratório de pé, recarga terminada e recursos para usar; uma vez por recarga (sem evento na simulação, uma conferência por segundo) */
function checarSuper() { const P = V.P, S = ARD.sim; if (!P || P.fim || !S || !P.sim) return; const sim = P.sim, p = sim.players[P.human]; if (!p || sim.result) return;
  const pronta = (p.era || 1) >= 3 && sim.time >= (p.superCd || 0) && S.canAfford(p, S.SUPER_COST) && S.hasBuilt(sim, P.human, 'laboratorio');
  if (P.superVisto === null) { P.superVisto = pronta ? p.superCd : -1; return; } if (pronta && P.superVisto !== p.superCd) { P.superVisto = p.superCd; loc('superarma'); reacao('superarma'); } }
/* fim da partida (src/main.js, endGame) */
V.fim = vitoria => { const P = V.P; if (!P || P.fim) return; P.fim = true; if (superT) { clearInterval(superT); superT = null; } loc(vitoria ? 'vitoria' : 'derrota'); reacao(vitoria ? 'vitoria' : 'derrota'); };
/* eventos da simulação (src/main.js, handleEvents, depois do que já existia): avisos novos e reações do líder */
V.evento = function (e) { const P = V.P; if (!P || P.fim) return; const h = P.human;
  switch (e.t) {
    case 'era': if (e.p === h) { if (e.era === 2 || e.era === 3) loc('era' + e.era); reacao('era'); } break;
    case 'ascend': if (e.p === h) { loc('ascensao'); reacao('ascensao'); } break;
    case 'promote': if (e.owner === h) loc('promovida'); break;
    case 'module': if (e.p === h) loc('modulo'); break;
    case 'pact': if (e.a === h || e.b === h) reacao('pacto'); break;
    case 'betrayal': if (e.victim === h) reacao('traicao'); break;
    case 'storm': if (e.phase === 'active') reacao('tempestade'); break;
    case 'alert': if (e.p === h && e.kind === 'danger' && /BASE SOB|NÚCLEO SOB/i.test(e.text || '')) reacao('base-atacada'); break;
    case 'eliminated': if (e.p !== h) reacao('inimigo-eliminado'); break;
  } };
/* alertas sem chave de hoje (o voiceFor do src/main.js não conhece) */
const ALERTAS = [[/^Sobrecarga:/, 'sobrecarga'], [/devorando seu Nódulo/, 'nodulo-ataque'], [/^Rastro: recursos roubados/, 'recursos-roubados'], [/^Pacto cumprido/, 'pacto-cumprido'], [/recusou o pacto|^Pacto falhou/, 'pacto-recusado'],
  [/^Veio de Minério exposto/, 'veio'], [/^Caixa recolhida/, 'caixa'], [/Uníssono/, 'unissono'], [/Eclosão/, 'eclosao']]; /* a superarma do jogador e a do inimigo (o alerta vai para todos) */
V.alerta = function (e) { const P = V.P; if (!P || P.fim || e.p !== P.human) return false; const t = String(e.text || ''); for (const [re, n] of ALERTAS) if (re.test(t)) return loc(n); return false; };
/* opções para um alerta de hoje: a Tempestade tem as duas falas novas (se aproximando, ativa) e o Salto Evolutivo da Tessara (o voiceFor do
   src/main.js o lia como "Salto de Núcleo") tem a dele; a chave de hoje fica de reserva */
V.opcoesAlerta = function (e, chave) { const t = String((e && e.text) || ''); let L = null;
  if (chave === 'Tempestade de Éter') L = /aproximando/.test(t) ? LOC['tempestade-perto'] : /ativa/.test(t) ? LOC['tempestade-ativa'] : null; else if (chave === 'Salto de Núcleo' && /Salto Evolutivo/.test(t)) L = LOC['salto-evolutivo'];
  return L ? { chaves: L.c.concat([chave]) } : undefined; };
/* eliminação de uma IA: "<nome> eliminada." e "<n> inimigos restantes." em sequência; nome de jogador (multijogador) ou mais de 3 restantes: voz do sistema */
V.elim = function (q, restantes) { if (!q || q.human || !V.P) return undefined; const partes = [{ chaves: chavesElim(q.name) }]; if (restantes >= 1 && restantes <= 3) partes.push({ chaves: LOC['inimigos-' + restantes].c }); else if (restantes > 3) return undefined; return { partes, tipo: 'evento' }; };

/* ---------- respostas das unidades: uma por comando, pela classe que mais aparece na seleção ---------- */
const CONTA = { civil: 0, infantaria: 0, veiculo: 0, drone: 0, suporte: 0 };
function classeDominante(sim, human, ids) { const S = ARD.sim; if (!S || !sim || !ids) return null; for (const k in CONTA) CONTA[k] = 0; let n = 0;
  for (const id of ids) { const e = sim.byId.get(id); if (!e || !e.alive || e.kind !== 'unit' || e.owner !== human) continue; const u = S.UNITS[e.def], cl = u && CLS[u.cls]; if (cl) { CONTA[cl]++; n++; } }
  if (!n) return null; let best = null; for (const k of CLASSES) if (!best || CONTA[k] > CONTA[best]) best = k; return best; }
function resposta(cl, acao) { const a = au(); if (!a || !a.voice || !V.P || V.P.fim) return false; return a.say(null, 'unid:' + cl + ':' + acao, null, null, { tipo: 'resposta', soGravada: true, legenda: false }); }
V.selecao = function (sim, human, ids) { if (!ids || !ids.length || !V.P) return; const cl = classeDominante(sim, human, ids); if (cl) resposta(cl, 'sel'); }; /* src/input.js: setSel (a caixa de seleção chama uma vez) */
const ACAO = { move: 'mover', harvest: 'mover', pickup: 'mover', attack: 'atacar', attackmove: 'atacar', siphon: 'atacar', devour: 'atacar' };
V.ordem = function (sim, human, c) { const ac = c && ACAO[c.t]; if (!ac || !c.ids || !c.ids.length || !V.P) return; const cl = classeDominante(sim, human, c.ids); if (cl) resposta(cl, ac); }; /* src/input.js: cmd */

/* ---------- campanha: falas da missão (camp:<missão>:<n>, na ordem briefing → eventos → roteiro), conferidas pelo texto ---------- */
const norm = s => String(s || '').toLowerCase().normalize('NFC').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
function parecido(a, b) { if (a === b) return true; const wa = a.split(' '), wb = new Set(b.split(' ')); let c = 0; for (const w of wa) if (wb.has(w)) c++; return c / Math.max(wa.length, wb.size) >= 0.8; }
function numeroCamp(missao, k) { const C = ARD.campaign, m = C && C.BY_ID && C.BY_ID[missao]; const r = /^camp\.[^.]+\.(brief|ev|fala)\.(\d+)$/.exec(k || ''); if (!m || !r) return null; const i = +r[2], B = (m.brief || []).length; /* briefing → roteiro → eventos, como no roteiro do v-gravar (a fala dinâmica conta) */
  if (r[1] === 'brief') return i; const scs = (m.script || []).map((e, j) => e.say ? j : -1).filter(j => j >= 0); if (r[1] === 'fala') { const x = scs.indexOf(i); return x < 0 ? null : B + x; }
  const evs = (m.events || []).map((e, j) => e.say ? j : -1).filter(j => j >= 0); const x = evs.indexOf(i); return x < 0 ? null : B + scs.length + x; }
V.numeroCamp = numeroCamp;
function acharCamp(sd, missao) { if (!V.m || V.estado !== 'pronto' || V.idioma !== IDI()) return null; const pac = 'camp-' + missao, tab = V.m.chaves[pac]; if (!tab) return null; const raca = sd.race; const n = numeroCamp(missao, sd.k);
  if (n != null) { const ch = 'camp:' + missao + ':' + n; if (tab[ch + ':' + raca] && tab[ch + ':' + raca].length) return V.achar(ch + ':' + raca, raca, { pacote: pac }); /* uma fala por Raça de quem fala */
    const ids = (tab[ch] || []).filter(id => temRaca(id, V.m.falas[id], raca)); if (ids.length) return V.achar(ch, raca, { pacote: pac, id: ids[0] }); }
  const alvo = norm(sd.text); for (const k in tab) { const ids = (tab[k] || []).filter(id => V.m.falas[id] && temRaca(id, V.m.falas[id], raca) && parecido(norm(V.m.falas[id].texto), alvo)); if (ids.length) return V.achar(k, raca, { pacote: pac, id: ids[0] }); } /* reserva: pelo texto */
  return null; }
V.acharCamp = acharCamp;
/* a fala que a central de comunicação da campanha (src/campaign-ui.js) acabou de mostrar: devolve a duração (s) da gravada que vai tocar, ou 0 */
V.campanha = function (sd, missao) { const a = au(); if (!a || !a.voice || !sd || !missao || sd.k == null) return 0; const g = sd.k === 'camp.retomada' ? V.achar(LID.retomada, sd.race, { pacote: sd.race }) : acharCamp(sd, missao); if (!g) return 0; /* a retomada é do líder (pacote da Raça) */
  const ok = a.say(sd.text, g.chave, 0, sd.race, { g, tipo: 'campanha', legenda: false, soGravada: true, lider: !!(V.P && sd.race === V.P.raca) /* a boca do retrato só na fala do próprio líder */ }); return ok && g.pronta ? g.dur : 0; };
V.missao = id => { const a = au(); if (id && a && a.voice && a.gravadas !== false) carregarPacote('camp-' + id); }; /* ao abrir a missão (briefing) */

/* ---------- boca do líder na partida (retrato 3D da Interface 3.0) pelas palavras da fala gravada do líder ---------- */
try { addEventListener('ard-voz', e => { const d = e.detail, P = V.P; if (!d || !d.gravada || !d.lider || !P || P.fim) return; const L = ARD.leaders3d;
  if (d.tipo === 'palavra' && P.lead3d && L && L.word) { const w = String(d.texto || '').substr(d.i || 0, d.n || 0); try { L.word(P.lead3d, d.n || w.length, w, d.dur); } catch (er) {} }
  else if (d.tipo === 'inicio') { const el = document.getElementById('leader'); if (el && !el.hidden) { el.classList.remove('talk'); void el.offsetWidth; el.classList.add('talk'); } } }); } catch (e) {}

ARD.vozes = V;
})(globalThis.ARD = globalThis.ARD || {});
