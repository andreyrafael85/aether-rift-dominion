/* Aether Rift: Dominion — 5.0f: cinema do jogo (nos dois motores).
   - Tocador de cenas: linhas do tempo do GSAP (pausadas e levadas à mão pelo quadro da partida, no mesmo relógio do R.draw) com trilho de câmera
     (escreve só no view.cam, o mesmo que o jogador move), faixas de cinema, cartão de título, legendas digitadas e botão Pular (Esc, Enter,
     Espaço, toque). Fora da simulação: no solo a partida pausa (como a pausa do jogador); no multijogador e na dificuldade Fenda ela segue e a
     cena só mexe na câmera, então o lockstep nunca espera por uma cena. Nenhum objeto 3D, material ou pipeline novo: só DOM e câmera.
   - Abertura da missão (trilho da Fenda até a sua base com o título), câmera de ação da superarma e entrada dos chefões (moldura reaproveitável
     pela 5.0g: ARD.cinema.chefe(G, unidade, { nome, epiteto })).
   - Sala de Guerra do briefing: o mapa tático da missão num canvas 2D (gerado por um createSim de prévia, que não toca na partida), com varredura,
     câmera de trilho, bases, ameaça, rota de ataque, objetivos com bipe e as falas do briefing digitadas (com as vozes gravadas quando existem).
   - Música: chama ARD.musica.cena(nome) no começo e ARD.musica.cena(null) no fim, se a camada do f-som existir.
   Chaves: ?cenas=0 desliga tudo; ?cenasala=0, ?cenaabertura=0, ?cenachefe=0 e ?cenasuper=0 (ou =1 para forçar) desligam cada uma. Ajustes:
   "Cenas de cinema" (Sala de Guerra, abertura e chefões) e "Câmera de ação da superarma". */
(function (ARD) {
'use strict';
const GSAP_URL = 'https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js'; /* a mesma da Sala (src/m5/sala.js); o build troca pela cópia em vendor/ no dist/local.html */
const Q = new URLSearchParams(location.search);
const T = (k, v, r) => (ARD.t ? ARD.t(k, v, r) : String(r != null ? r : k));
const COR = { vehnar: '#FF7733', erevane: '#33FFD0', tessara: '#55E68A', quorith: '#B388FF', vorag: '#E6455A' };
const raca = r => (ARD.i18n && ARD.i18n.d ? ARD.i18n.d.raca(r) : r);
const jogador = n => (ARD.i18n && ARD.i18n.d ? ARD.i18n.d.jogador(n) : n);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const calmo = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };

/* ---------- GSAP (carregado uma vez; sem ele as cenas não tocam e o jogo segue igual) ---------- */
let gsapP = null;
function gsapCarrega() { if (window.gsap) return Promise.resolve(window.gsap); if (gsapP) return gsapP;
  gsapP = new Promise(res => { const s = document.createElement('script'); s.src = GSAP_URL; s.async = true; s.onload = () => res(window.gsap || null); s.onerror = () => { gsapP = null; res(null); }; document.head.appendChild(s); }); return gsapP; }

/* ---------- preferências e chaves de URL ---------- */
function prefs() { try { return JSON.parse(localStorage.getItem('ard-beta-prefs') || '{}') || {}; } catch (e) { return {}; } }
function ligada(tipo) { /* 'sala' | 'abertura' | 'chefe' | 'super' */
  if (Q.get('cenas') === '0') return false; const k = Q.get('cena' + tipo); if (k === '0') return false; if (k === '1') return true;
  const p = prefs(); return tipo === 'super' ? p.cineSuper !== false : p.cenas !== false; }
function gravaPref(k, v) { try { const p = prefs(); p[k] = v; localStorage.setItem('ard-beta-prefs', JSON.stringify(p)); } catch (e) {} }
function musica(nome) { try { if (ARD.musica && typeof ARD.musica.cena === 'function') ARD.musica.cena(nome); } catch (e) {} }
function bipe(nome, v) { try { if (ARD.audio && ARD.audio.sfx) ARD.audio.sfx(nome, v); } catch (e) {} }

/* ---------- estilo (injetado: nada no index.tpl.html) ---------- */
const CSS = `
#cine{position:fixed;inset:0;z-index:7;pointer-events:none;--cc:#FF5E3A;--fx:10vh}
#cine[hidden]{display:none}
#cine.on{pointer-events:auto}
#cine .cb{position:absolute;left:0;right:0;height:var(--fx);background:#000;transform:scaleY(0)}
#cine .cb.t{top:0;transform-origin:top}#cine .cb.b{bottom:0;transform-origin:bottom}
#cine .ct{position:absolute;left:max(4vw,16px);bottom:calc(var(--fx) + 4vh);max-width:min(620px,86vw);opacity:0;text-shadow:0 2px 14px rgba(0,0,0,.85)}
#cine .ct .k{font:600 .74rem/1.2 var(--fm);letter-spacing:.24em;text-transform:uppercase;color:var(--cc)}
#cine .ct .n{font-family:var(--fd);font-weight:800;font-size:clamp(2rem,5.4vw,4.2rem);line-height:.95;text-transform:uppercase;color:#fff;letter-spacing:.02em;margin:.2rem 0 .3rem}
#cine .ct{padding:.4rem .9rem .55rem;background:radial-gradient(ellipse at 30% 60%,rgba(4,6,10,.62),rgba(4,6,10,0) 72%)}
#cine .ct .s{font:500 1rem/1.35 var(--fb);color:#E8E2D6;text-shadow:0 1px 3px #000,0 0 12px rgba(0,0,0,.9)}
#cine .ct .ln{height:3px;width:120px;background:linear-gradient(90deg,var(--cc),transparent);margin-top:.5rem;transform-origin:left}
#cine.chefe .ct{left:0;right:0;margin:0 auto;width:max-content;max-width:90vw;text-align:center;bottom:calc(var(--fx) + 2.5vh)}
#cine.chefe .ct .ln{margin:.5rem auto 0;width:220px;background:linear-gradient(90deg,transparent,var(--cc),transparent)}
#cine .cl{position:absolute;left:50%;transform:translateX(-50%);bottom:calc(var(--fx) + 1.6vh);max-width:min(760px,90vw);font:500 1rem/1.4 var(--fb);color:#fff;text-align:center;text-shadow:0 1px 3px #000,0 0 18px rgba(0,0,0,.8)}
#cine .cl b{color:var(--cc);font:600 .72rem/1 var(--fm);letter-spacing:.14em;text-transform:uppercase;display:block;margin-bottom:.25rem}
#cine .cp{position:absolute;right:max(14px,env(safe-area-inset-right,0px));bottom:calc(env(safe-area-inset-bottom,0px) + max(8px,(var(--fx) - 44px) / 2));min-height:44px;min-width:44px;padding:0 1rem;border:1px solid rgba(255,255,255,.28);background:rgba(10,13,18,.72);color:#fff;font:600 .82rem/1 var(--fm);letter-spacing:.12em;text-transform:uppercase;cursor:pointer;opacity:.9}
#cine .cp:hover,#cine .cp:focus-visible{border-color:var(--cc);opacity:1}
#cine .cp kbd{font:inherit;opacity:.6;margin-left:.4rem}
body.cine-on #hud{opacity:0;visibility:hidden;transition:opacity .3s,visibility 0s .3s}
body.cine-on #pausebox{display:none}
@media (orientation:portrait){#cine{--fx:7vh}#cine .ct .n{font-size:clamp(1.7rem,9vw,2.6rem)}#cine .cl{font-size:.9rem}}
body.touch #cine .cp kbd,#cine .cp.tq kbd{display:none}
/* Sala de Guerra (briefing) */
.sg{position:relative;--sc:var(--race,#FF5E3A);aspect-ratio:16/7.4;max-height:52vh;width:100%;background:#04070b;overflow:hidden;clip-path:polygon(14px 0,100% 0,100% calc(100% - 14px),calc(100% - 14px) 100%,0 100%,0 14px);box-shadow:inset 0 0 0 1px rgba(255,255,255,.08)}
.sg canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
.sg::after{content:"";position:absolute;inset:0;pointer-events:none;background:repeating-linear-gradient(0deg,rgba(255,255,255,.025) 0 1px,transparent 1px 3px);mix-blend-mode:screen}
.sg .sg-top{position:absolute;left:14px;top:10px;font:600 .66rem/1.2 var(--fm);letter-spacing:.2em;text-transform:uppercase;color:var(--sc);text-shadow:0 0 10px rgba(0,0,0,.9)}
.sg .sg-leg{position:absolute;left:12px;right:12px;bottom:12px;display:flex;gap:.6rem;align-items:flex-end;max-width:620px;opacity:0}
.sg .sg-leg img{width:52px;height:52px;object-fit:cover;flex:none;clip-path:polygon(7px 0,100% 0,100% calc(100% - 7px),calc(100% - 7px) 100%,0 100%,0 7px);box-shadow:inset 0 0 0 2px var(--lc,var(--sc))}
.sg .sg-leg>div{background:rgba(6,9,14,.82);padding:.4rem .65rem .45rem;border-left:2px solid var(--lc,var(--sc));min-height:2.8em;flex:1}
.sg .sg-leg .nm{font:600 .62rem/1.3 var(--fm);letter-spacing:.12em;text-transform:uppercase;color:var(--lc,var(--sc))}
.sg .sg-leg .tx{font-size:.9rem;line-height:1.4;color:#fff}
.sg .sg-obj{position:absolute;right:12px;top:30px;margin:0;padding:.45rem .6rem .5rem 1.6rem;max-width:44%;background:rgba(6,9,14,.78);border-right:2px solid var(--sc);font-size:.78rem;line-height:1.35;color:#fff;opacity:0}
.sg .sg-obj li{opacity:0;margin:.12rem 0}.sg .sg-obj li::marker{color:var(--sc)}.sg .sg-obj .bn{color:var(--fg2,#A9A598)}
.sg .sg-bt{position:absolute;right:10px;bottom:10px;display:flex;gap:.4rem}
.sg .sg-bt button{min-height:40px;min-width:44px;padding:0 .8rem;border:1px solid rgba(255,255,255,.28);background:rgba(10,13,18,.78);color:#fff;font:600 .72rem/1 var(--fm);letter-spacing:.12em;text-transform:uppercase;cursor:pointer}
.sg .sg-bt button:hover,.sg .sg-bt button:focus-visible{border-color:var(--sc)}
.sg.fim .sg-leg{display:none}
.sg-tocando #br-dialog{opacity:0;max-height:0;overflow:hidden}
#br-dialog{transition:opacity .4s}
@media (max-width:720px){.sg{aspect-ratio:4/3.3}.sg .sg-obj{left:12px;right:auto;top:28px;max-width:70%;font-size:.72rem}.sg .sg-leg .tx{font-size:.82rem}.sg .sg-leg img{width:40px;height:40px}.sg .sg-bt{top:8px;bottom:auto}.sg .sg-top{right:112px}}
`;
function estilo() { if (document.getElementById('cine-css')) return; const s = document.createElement('style'); s.id = 'cine-css'; s.textContent = CSS; document.head.appendChild(s); }

/* ---------- DOM da cena na partida (criado uma vez) ---------- */
let DOM = null;
function dom() { if (DOM) return DOM; estilo(); const el = document.createElement('div'); el.id = 'cine'; el.hidden = true; el.setAttribute('aria-live', 'polite');
  el.innerHTML = '<div class="cb t"></div><div class="cb b"></div><div class="ct"><div class="k"></div><div class="n"></div><div class="s"></div><div class="ln"></div></div><div class="cl"><b></b><span></span></div><button class="cp" type="button"><span data-i18n="cine.pular">Pular</span> ⏭<kbd>Esc</kbd></button>';
  document.body.appendChild(el); if (ARD.i18n && ARD.i18n.aplicar) try { ARD.i18n.aplicar(el); } catch (e) {}
  DOM = { el, bt: el.querySelector('.cb.t'), bb: el.querySelector('.cb.b'), ct: el.querySelector('.ct'), k: el.querySelector('.ct .k'), n: el.querySelector('.ct .n'), s: el.querySelector('.ct .s'), ln: el.querySelector('.ct .ln'), cl: el.querySelector('.cl'), clN: el.querySelector('.cl b'), clT: el.querySelector('.cl span'), cp: el.querySelector('.cp') };
  DOM.cp.addEventListener('click', e => { e.stopPropagation(); pular(); });
  el.addEventListener('pointerdown', e => { if (e.target === DOM.cp || !A) return; if (A.cena.tipo === 'super') pular(); }); /* na câmera da superarma, tocar em qualquer lugar devolve a câmera */
  return DOM; }

/* ---------- o tocador ---------- */
let A = null; /* cena tocando: { cena, tl, P, t, salvo, G, pausou, revelou, legI, legN } */
const fila = [];
let ultimoG = null, superT = -1e9;
function ativa() { return !!A; }
function fimDe(G) { return !G || G.ended || G.bench || (G.R && G.R.photo && G.R.photo.on); }
/* teclas: durante a cena o teclado não comanda a partida; Esc, Enter e Espaço pulam */
function tecla(e) { if (!A) return; if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ' || e.code === 'Space') { e.preventDefault(); pular(); } e.stopImmediatePropagation(); e.stopPropagation(); }
function enfileira(cena) { if (fila.length < 3) fila.push(cena); }
/* yaw mais perto do atual (gira pelo caminho curto) */
function perto(a, b) { const TAU = Math.PI * 2; let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return a + d; }
function comecar(cena, G) {
  const gsap = window.gsap; if (!gsap) return false; const D = dom(); const cam = G.view.cam;
  const salvo = { x: cam.x, y: cam.y, zoom: cam.zoom, yaw: cam.yaw == null ? Math.PI / 4 : cam.yaw, pitch: cam.pitch == null ? 0.95 : cam.pitch, pitchT: cam.pitchT };
  const P = { x: salvo.x, y: salvo.y, zoom: salvo.zoom, yaw: salvo.yaw, pitch: salvo.pitch };
  const tl = gsap.timeline({ paused: true }); const dur = cena.dur;
  /* faixas e cartão */
  D.el.className = 'on ' + (cena.classe || ''); D.el.style.setProperty('--cc', cena.cor || '#FF5E3A'); D.cp.classList.toggle('tq', !!(G.isTouch));
  D.k.textContent = cena.kicker || ''; D.n.textContent = cena.nome || ''; D.s.textContent = cena.sub || ''; D.clN.textContent = ''; D.clT.textContent = ''; D.cl.style.opacity = '0';
  tl.fromTo([D.bt, D.bb], { scaleY: 0 }, { scaleY: cena.faixa == null ? 1 : cena.faixa, duration: 0.45, ease: 'power2.out' }, 0);
  tl.to([D.bt, D.bb], { scaleY: 0, duration: 0.4, ease: 'power2.in' }, dur - 0.4);
  if (cena.nome) { const ti = cena.titulo || [0.5, dur - 0.9];
    tl.fromTo(D.ct, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' }, ti[0]);
    tl.fromTo(D.n, { letterSpacing: '0.18em', clipPath: 'inset(0 100% 0 0)' }, { letterSpacing: '0.02em', clipPath: 'inset(0 0% 0 0)', duration: 0.8, ease: 'power3.out' }, ti[0]); tl.set(D.n, { clipPath: 'none' }, ti[0] + 0.85); /* o recorte só na entrada (o texto largo não fica cortado) */
    tl.fromTo(D.ln, { scaleX: 0 }, { scaleX: 1, duration: 0.7, ease: 'power2.out' }, ti[0] + 0.25);
    tl.to(D.ct, { opacity: 0, y: -10, duration: 0.4, ease: 'power2.in' }, ti[1]); }
  /* trilho: cada ponto é um tween do proxy P (o quadro copia P para o view.cam) */
  let yawAt = P.yaw;
  for (const k of cena.trilho) { if (k.corte) { tl.set(P, { x: k.x, y: k.y, zoom: k.zoom, yaw: (yawAt = perto(yawAt, k.yaw)), pitch: k.pitch }, k.t); continue; }
    const o = { duration: k.d, ease: k.ease || 'power2.inOut' }; if (k.x != null) o.x = k.x; if (k.y != null) o.y = k.y; if (k.zoom != null) o.zoom = k.zoom; if (k.pitch != null) o.pitch = k.pitch; if (k.yaw != null) o.yaw = yawAt = perto(yawAt, k.yaw); tl.to(P, o, k.t); }
  if (cena.volta !== false) tl.to(P, { x: salvo.x, y: salvo.y, zoom: salvo.zoom, yaw: perto(yawAt, salvo.yaw), pitch: salvo.pitch, duration: cena.voltaD || 0.8, ease: 'power2.inOut' }, dur - (cena.voltaD || 0.8));
  tl.time(0);
  const net = !!G.net, semPausa = net || !!(G.camp && G.camp.noPause);
  A = { cena, tl, P, t: 0, salvo, G, pausou: false, revelou: false, legI: -1, legN: -1, tipo: cena.tipo };
  if (cena.pausa && !semPausa && !G.paused) { G.paused = true; A.pausou = true; }
  if (cena.revela && !net && !G.view.reveal) { G.view.reveal = true; A.revelou = true; } /* só no solo: o multijogador nunca vê o que a névoa esconde */
  document.body.classList.add('cine-on'); D.el.hidden = false; window.addEventListener('keydown', tecla, true);
  musica(cena.musica || cena.tipo); return true;
}
function fim() { if (!A) return; const { G, salvo, tl } = A; const cam = G.view.cam;
  try { tl.progress(1); tl.kill(); } catch (e) {}
  cam.x = salvo.x; cam.y = salvo.y; cam.zoom = salvo.zoom; cam.yaw = salvo.yaw; cam.pitch = salvo.pitch; cam.pitchT = salvo.pitchT == null ? salvo.pitch : salvo.pitchT;
  if (A.revelou) G.view.reveal = false; if (A.pausou && G.paused) { G.paused = false; G.last = performance.now(); }
  const D = dom(); D.el.hidden = true; D.el.className = ''; document.body.classList.remove('cine-on'); window.removeEventListener('keydown', tecla, true);
  musica(null); if (A.cena.aoFim) try { A.cena.aoFim(); } catch (e) {} A = null; }
function pular() { if (A) fim(); }
/* um quadro da partida (main.js, depois do I.update e antes do R.draw): começa a próxima cena da fila e leva a que está tocando */
function quadro(now, dt, G) {
  if (G !== ultimoG) { ultimoG = G; for (let i = fila.length - 1; i >= 0; i--) if (fila[i].G !== G) fila.splice(i, 1); /* só o que é desta partida */ if (A) fim(); superT = -1e9; if (G && !fimDe(G) && G.camp && !(G.cfg && G.cfg.resume) && !G.net && ligada('abertura')) { const c = abertura(G); if (c) fila.unshift(c); } }
  if (!A) { if (!fila.length) return; if (fimDe(G) || !window.gsap) { fila.length = 0; return; } const c = fila.shift(); if (c.antes) try { c.antes(); } catch (e) {} if (!comecar(c, G)) return; }
  if (fimDe(G)) { fim(); return; }
  const a = A; a.t += dt; a.tl.time(Math.min(a.t, a.cena.dur));
  const cam = G.view.cam, P = a.P; cam.x = P.x; cam.y = P.y; cam.zoom = P.zoom; cam.yaw = P.yaw; cam.pitch = P.pitch; cam.pitchT = P.pitch;
  const L = a.cena.legendas; if (L) { let i = -1; for (let k = 0; k < L.length; k++) if (a.t >= L[k].t0 && a.t < L[k].t1) i = k; const D = DOM;
    if (i !== a.legI) { a.legI = i; a.legN = -1; if (i < 0) D.cl.style.opacity = '0'; else { D.cl.style.opacity = '1'; D.clN.textContent = L[i].nome || ''; } }
    if (i >= 0) { const n = Math.min(L[i].texto.length, Math.floor((a.t - L[i].t0) * 42)); if (n !== a.legN) { a.legN = n; D.clT.textContent = L[i].texto.slice(0, n); } } }
  if (a.t >= a.cena.dur) fim();
}

/* ---------- cenas da partida ---------- */
function nucleo(sim, p) { return ARD.sim.nucleoOf(sim, p); }
/* abertura da missão: da Fenda (centro) até a sua base, com ato, título e lugar */
function abertura(G) { const S = ARD.sim, C = ARD.campaign; const sim = G.sim, n = nucleo(sim, G.human); if (!n || !C || !G.camp.prep) return null;
  const m = G.camp.prep.mission; const cam = G.view.cam; const y0 = cam.yaw == null ? Math.PI / 4 : cam.yaw; const fac = sim.players[G.human].faction;
  const mx = (S.CX + n.x) / 2, my = (S.CY + n.y) / 2;
  return { G, tipo: 'abertura', musica: 'abertura', dur: 6.2, pausa: true, cor: COR[fac], kicker: C.ato(m.act), nome: C.titulo(m), sub: C.lugar(m), titulo: [0.7, 5.0],
    trilho: [{ corte: true, t: 0, x: S.CX, y: S.CY, zoom: 0.55, yaw: y0 - 1.1, pitch: 0.7 }, { t: 0, d: 3.0, x: mx, y: my, zoom: 0.7, yaw: y0 - 0.45, pitch: 0.62, ease: 'sine.inOut' }],
    voltaD: 2.6 }; }
/* câmera de ação da superarma: o alvo (ou o exército de quem disparou) e o impacto; a partida segue */
function superarma(G, ev) { const S = ARD.sim, sim = G.sim; const p = sim.players[ev.p]; if (!p) return null; const meu = ev.p === G.human;
  let x = ev.x, y = ev.y;
  if (x == null) { if (!meu) return null; let sx = 0, sy = 0, k = 0; for (const e of sim.ents) if (e.alive && e.kind === 'unit' && e.owner === ev.p && S.UNITS[e.def] && S.UNITS[e.def].attack) { sx += e.x; sy += e.y; k++; } if (k >= 3) { x = sx / k; y = sy / k; } else { const n = nucleo(sim, ev.p); if (!n) return null; x = n.x; y = n.y; } }
  else if (!meu && !G.view.reveal && !S.seesPoint(sim, G.human, x, y)) return null; /* do inimigo, só o que você já vê */
  const cam = G.view.cam, y0 = cam.yaw == null ? Math.PI / 4 : cam.yaw;
  return { G, tipo: 'super', musica: 'superarma', dur: 3.6, cor: COR[p.faction], classe: 'super', faixa: 0.75, kicker: T('cine.superarma', null, 'Superarma') + ' · ' + jogador(p.name), nome: T('fac.' + p.faction + '.super', null, (S.FACTIONS[p.faction] || {}).superName || ''), titulo: [0.35, 2.7],
    trilho: [{ t: 0, d: 0.75, x, y, zoom: 1.9, pitch: 0.58, yaw: y0 + 0.25, ease: 'power3.inOut' }, { t: 0.75, d: 2.0, yaw: y0 + 0.55, zoom: 2.1, ease: 'none' }], voltaD: 0.8 }; }
/* entrada de chefão: moldura reaproveitável (5.0g chama com { nome, epiteto }) */
function chefe(G, u, o) { o = o || {}; const sim = G.sim; const p = sim.players[u.owner] || {}; const cam = G.view.cam, y0 = cam.yaw == null ? Math.PI / 4 : cam.yaw;
  const c = { G, tipo: 'chefe', musica: 'chefao', dur: o.dur || 6.0, pausa: true, revela: true, cor: o.cor || COR[p.faction] || '#E6455A', classe: 'chefe', kicker: o.kicker || (T('cine.chefao', null, 'Chefão') + ' · ' + raca(p.faction)) /* 5.0g */, nome: o.nome || T('unit.' + u.def + '.nome', null, u.def), sub: o.epiteto || T('cine.chefe.' + u.def, null, ''), titulo: [1.1, 4.8],
    trilho: [{ t: 0, d: 1.1, x: u.x, y: u.y, zoom: 2.4, pitch: 0.42, yaw: y0 - 0.5, ease: 'power3.inOut' }, { t: 1.1, d: 3.9, yaw: y0 + 0.5, zoom: 2.0, pitch: 0.5, ease: 'sine.inOut' }], voltaD: 1.0 };
  if (o.tocar !== false) enfileira(c); return c; }
/* os eventos de um passo (main.js, depois do passo e da campanha; nunca no avanço silencioso) */
function eventos(ev, G) { if (!ev || !ev.length || fimDe(G)) return; const S = ARD.sim;
  for (let i = 0; i < ev.length; i++) { const e = ev[i];
    if (e.t === 'super' && ligada('super')) { const agora = G.sim.time; if (agora - superT < 20 || A || fila.length) continue; const c = superarma(G, e); if (c) { superT = agora; enfileira(c); } }
    else if (e.t === 'spawn' && S.UNITS[e.def] && S.UNITS[e.def].epic && !S.UNITS[e.def].boss /* 5.0g: os chefões entram pelo evento chefe/entra (src/chefes.js) */ && e.p !== G.human && ligada('chefe')) { let u = null, bd = 80; for (const x of G.sim.ents) if (x.alive && x.kind === 'unit' && x.def === e.def && x.owner === e.p) { const d = Math.abs(x.x - e.x) + Math.abs(x.y - e.y); if (d < bd) { bd = d; u = x; } }
      if (u && u.scripted && !G.net) chefe(G, u); } } }

/* ---------- Ajustes: duas caixas ao lado da "Câmera de cinema" ---------- */
function ajustes() { const oc = document.getElementById('opt-cine'); if (!oc || document.getElementById('opt-cenas')) return; const box = oc.closest('.opt') || oc.parentElement.parentElement; if (!box) return;
  const mk = (id, k, txt, on, f) => { const l = document.createElement('label'); l.className = 'chk'; l.setAttribute('data-i18n', k); l.innerHTML = '<input type="checkbox" id="' + id + '"> ' + esc(txt); const i = l.firstChild; i.checked = on; i.addEventListener('change', () => f(i.checked)); box.appendChild(l); if (ARD.i18n && ARD.i18n.aplicar) try { ARD.i18n.aplicar(l); } catch (e) {} };
  const p = prefs(); mk('opt-cenas', 'cine.op.cenas', 'Cenas de cinema: Sala de Guerra, abertura das missões e entrada dos chefões', p.cenas !== false, v => gravaPref('cenas', v));
  mk('opt-cine-super', 'cine.op.super', 'Câmera de ação da superarma', p.cineSuper !== false, v => gravaPref('cineSuper', v)); }

/* ---------- Sala de Guerra: mapa tático da missão no briefing ---------- */
const RES = { plasma: '#FF8A5C', minerio: '#62CDFF', dados: '#7FE3A1' };
const prev = new Map(); /* prévias por missão + Raça + dificuldade (o createSim é do mapa, não da partida) */
function previa(prep, chave) { if (prev.has(chave)) return prev.get(chave); const S = ARD.sim; let d = null;
  try { const cfg = prep.cfg; const sim = S.createSim({ seed: cfg.seed, players: cfg.players.map(p => Object.assign({}, p)), minutes: cfg.minutes || 25, map: 'fenda', mapV: 0, noVeins: !!cfg.noVeins });
    const bases = sim.players.map((p, i) => { const n = S.nucleoOf(sim, i); return n ? { i, x: n.x, y: n.y, fac: p.faction, nome: p.name, ally: !!(cfg.players[i] && cfg.players[i].ally), cor: COR[p.faction] || p.color } : null; }).filter(Boolean);
    const nodes = [], rocks = []; for (const e of sim.ents) { if (!e.alive) continue; if (e.kind === 'node') nodes.push(e.x, e.y, e.res === 'plasma' ? 0 : e.res === 'dados' ? 2 : 1); else if (e.kind === 'rock') rocks.push(e.x, e.y, e.r || 10); }
    d = { bases, nodes, rocks, W: S.WORLD, CX: S.CX, CY: S.CY, RR: S.RIFT_R }; } catch (e) { console.warn('[ARD] Sala de Guerra (prévia do mapa):', e); d = null; }
  if (prev.size > 8) prev.clear(); prev.set(chave, d); return d; }
let SG = null; /* a Sala que está aberta */
const OUV = new Set(); /* falas do briefing que já tocaram gravadas na Sala: a central da missão mostra o texto sem repetir a voz (uma vez) */
function ouviu(k) { if (!k || !OUV.has(k)) return false; OUV.delete(k); return true; }
/* o = { host, missao, prep, chave, raca, falas: [{ race, mood, texto, nome, art, k }], objetivos: [{ texto, bonus }], ato, box } */
function salaGuerra(o) {
  if (SG && SG.host === o.host && SG.chave === o.chave) return SG; /* mesma missão aberta: a cena segue */
  const tocar = !(SG && SG.missao === o.missao) && ligada('sala') && !calmo(); if (!(SG && SG.missao === o.missao)) OUV.clear(); /* troca de Raça ou dificuldade com a missão aberta: só redesenha */
  if (tocar && !window.gsap) gsapCarrega().then(g => { if (g && SG && SG.host === o.host && SG.chave === o.chave && !SG.tl && !SG.tocando) { pararSala(); salaGuerra(o); } }); /* GSAP ainda chegando: mostra o mapa parado e toca quando ele chega */
  pararSala(); estilo(); const map = previa(o.prep, o.chave); if (!map) return null;
  let el = o.host.querySelector('.sg'); if (!el) { el = document.createElement('div'); el.className = 'sg'; el.setAttribute('role', 'img'); o.host.insertBefore(el, o.host.firstChild); }
  el.style.setProperty('--sc', COR[o.raca] || '#FF5E3A'); el.setAttribute('aria-label', T('cine.sala', null, 'Sala de Guerra'));
  el.innerHTML = '<canvas></canvas><div class="sg-top"></div><div class="sg-leg"><img alt=""><div><div class="nm"></div><div class="tx"></div></div></div><ol class="sg-obj"></ol><div class="sg-bt"><button type="button" class="sg-pular"></button><button type="button" class="sg-rever" hidden></button></div>';
  const q = s => el.querySelector(s); const cv = q('canvas'), g = cv.getContext('2d');
  q('.sg-top').textContent = T('cine.sala', null, 'Sala de Guerra') + ' · ' + (o.ato || '');
  q('.sg-pular').innerHTML = esc(T('cine.pular', null, 'Pular')) + ' ⏭'; q('.sg-rever').textContent = '↻ ' + T('cine.rever', null, 'Rever a cena');
  q('.sg-obj').innerHTML = o.objetivos.map(x => `<li class="${x.bonus ? 'bn' : ''}">${x.bonus ? '★ ' : ''}${esc(x.texto)}</li>`).join('');
  const lis = [...q('.sg-obj').children];
  /* quem fala → a base de quem fala; o inimigo principal → ameaça e rota */
  const eu = map.bases[0], inim = map.bases.filter(b => b.i > 0 && !b.ally); const alvo = inim.length ? inim.reduce((a, b) => (Math.hypot(b.x - eu.x, b.y - eu.y) < Math.hypot(a.x - eu.x, a.y - eu.y) ? b : a)) : null;
  const baseDe = r => r === o.raca ? eu : (map.bases.find(b => b.i > 0 && b.fac === r) || null);
  const st = { el, host: o.host, missao: o.missao, chave: o.chave, cv, g, map, eu, alvo, cam: { x: map.CX, y: map.CY, z: 1, rot: 0 }, rota: { p: 0 }, varre: { a: -1 }, ameaca: { k: 0 }, t: 0, tl: null, raf: 0, vivo: true, tocando: false, holdAte: 0, holdEm: -1, legI: -1, legN: -1, dpr: 1, box: o.box };
  SG = st;
  /* linha do tempo: abertura (varredura), uma batida por fala, ameaça e rota, objetivos */
  const falas = o.falas; const beats = []; let t = 1.4; for (const f of falas) { const d = Math.max(3.0, 1.3 + f.texto.length / 30); beats.push({ t0: t, t1: t + d, f }); t += d; }
  const tRota = t, tObj = t + 2.6, dur = tObj + 0.5 + lis.length * 0.45 + 1.2; st.beats = beats; st.dur = dur; st.tObj = tObj;
  const gsap = window.gsap; const C = st.cam;
  if (gsap) { const tl = gsap.timeline({ paused: true }); st.tl = tl;
    tl.fromTo(C, { z: 0.82, rot: -0.35 }, { z: 1, rot: 0, duration: 1.4, ease: 'power2.out' }, 0);
    tl.fromTo(st.varre, { a: 0 }, { a: 1, duration: 1.6, ease: 'none' }, 0);
    for (const b of beats) { const bs = baseDe(b.f.race) || eu; tl.to(C, { x: bs.x, y: bs.y, z: 1.9, rot: (bs === eu ? 0.12 : -0.12), duration: 1.0, ease: 'power2.inOut' }, b.t0); }
    if (alvo) { tl.to(C, { x: (eu.x + alvo.x) / 2, y: (eu.y + alvo.y) / 2, z: 1.25, rot: 0, duration: 1.1, ease: 'power2.inOut' }, tRota); tl.fromTo(st.rota, { p: 0 }, { p: 1, duration: 1.8, ease: 'power1.inOut' }, tRota + 0.3); tl.fromTo(st.ameaca, { k: 0 }, { k: 1, duration: 0.5 }, tRota + 1.6); }
    tl.to(C, { x: map.CX, y: map.CY, z: 1, rot: 0, duration: 1.0, ease: 'power2.inOut' }, tObj);
    tl.fromTo(q('.sg-obj'), { opacity: 0, x: 14 }, { opacity: 1, x: 0, duration: 0.4 }, tObj + 0.2);
    lis.forEach((li, i) => tl.fromTo(li, { opacity: 0, x: 10 }, { opacity: 1, x: 0, duration: 0.3 }, tObj + 0.5 + i * 0.45));
    tl.to(q('.sg-leg'), { opacity: 0, duration: 0.3 }, tObj); tl.time(0); }
  const tam = () => { const r = el.getBoundingClientRect(); const dpr = Math.min(2, window.devicePixelRatio || 1); const w = Math.max(2, Math.round(r.width * dpr)), h = Math.max(2, Math.round(r.height * dpr)); if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; } st.dpr = dpr; };
  st.tam = tam; tam(); st.onRes = () => { tam(); if (!st.tocando) desenha(st); }; window.addEventListener('resize', st.onRes); if (window.ResizeObserver) { st.ro = new ResizeObserver(() => { if (st.vivo) st.onRes(); }); st.ro.observe(el); } /* o briefing abre depois do desenho: o tamanho real chega aqui */
  q('.sg-pular').addEventListener('click', () => pularSala(st)); q('.sg-rever').addEventListener('click', () => tocarSala(st));
  st.tecla = e => { if (!st.tocando) return; if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopImmediatePropagation(); e.stopPropagation(); pularSala(st); } };
  window.addEventListener('keydown', st.tecla, true); /* antes do Esc que fecha a janela (captura no document) */
  if (tocar && gsap) tocarSala(st); else { if (!gsap) gsapCarrega(); fimSala(st, true); }
  return st; }
function tocarSala(st) { if (!st.vivo || !st.tl) return; st.t = 0; st.legI = -1; st.legN = -1; st.holdEm = -1; st.tocando = true; st.el.classList.remove('fim'); st.el.querySelector('.sg-rever').hidden = true; st.el.querySelector('.sg-pular').hidden = false; if (st.box) st.box.classList.add('sg-tocando');
  st.tl.time(0); musica('sala-guerra'); let last = performance.now(); bipe('click', 0.35);
  const loop = now => { if (!st.vivo) return; if (!st.el.isConnected || st.el.offsetParent === null) { pararSala(); return; } st.raf = requestAnimationFrame(loop); const dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (!(st.holdEm >= 0 && st.t >= st.holdEm && now < st.holdAte)) st.t += dt; /* a fala gravada mais longa que a batida segura o relógio */
    st.tam(); st.tl.time(Math.min(st.t, st.dur)); legenda(st, now); bipes(st); desenha(st); if (st.t >= st.dur) fimSala(st); };
  st.raf = requestAnimationFrame(loop); }
function legenda(st, now) { const leg = st.el.querySelector('.sg-leg'); let i = -1; for (let k = 0; k < st.beats.length; k++) if (st.t >= st.beats[k].t0 && st.t < st.beats[k].t1) i = k;
  if (i !== st.legI) { st.legI = i; st.legN = -1; if (i < 0) { if (st.t < st.tObj) leg.style.opacity = '0'; return; } const f = st.beats[i].f; leg.style.opacity = '1'; leg.style.setProperty('--lc', COR[f.race] || '#FF5E3A'); const im = leg.querySelector('img'); im.src = f.art || ''; im.hidden = !f.art; leg.querySelector('.nm').textContent = f.nome;
    let d = 0; try { if (ARD.vozes && ARD.vozes.campanha) d = ARD.vozes.campanha({ race: f.race, mood: f.mood, text: f.texto, k: f.k }, st.missao) || 0; } catch (e) {} /* a fala gravada desta linha (0 sem gravação: só a legenda) */
    if (d > 0) { OUV.add(f.k); st.holdEm = st.beats[i].t1 - 0.25; st.holdAte = now + d * 1000 + 250; } else st.holdEm = -1; }
  if (i >= 0) { const f = st.beats[i].f; const n = Math.min(f.texto.length, Math.floor((st.t - st.beats[i].t0 - 0.35) * 38)); if (n !== st.legN && n >= 0) { st.legN = n; st.el.querySelector('.sg-leg .tx').textContent = f.texto.slice(0, n); } } }
function bipes(st) { const k = Math.floor((st.t - st.tObj - 0.5) / 0.45); if (st.t > st.tObj + 0.5 && k !== st.bip && k < st.el.querySelectorAll('.sg-obj li').length) { st.bip = k; bipe('click', 0.45); } }
function pularSala(st) { if (!st.tocando) return; try { if (ARD.audio && ARD.audio.calar) ARD.audio.calar(); } catch (e) {} fimSala(st); }
function fimSala(st, quieto) { if (st.raf) cancelAnimationFrame(st.raf); st.raf = 0; const era = st.tocando; st.tocando = false; if (st.tl) { st.tl.progress(1); st.t = st.dur; }
  st.el.classList.add('fim'); const o = st.el.querySelector('.sg-obj'); o.style.opacity = '1'; o.style.transform = ''; for (const li of o.children) { li.style.opacity = '1'; li.style.transform = ''; }
  st.cam.x = st.map.CX; st.cam.y = st.map.CY; st.cam.z = 1; st.cam.rot = 0; st.rota.p = 1; st.ameaca.k = 1; st.varre.a = 1;
  st.el.querySelector('.sg-pular').hidden = true; st.el.querySelector('.sg-rever').hidden = !st.tl; if (st.box) st.box.classList.remove('sg-tocando');
  if (era && !quieto) musica(null); st.tam(); desenha(st); }
function pararSala() { const st = SG; if (!st) return; st.vivo = false; if (st.raf) cancelAnimationFrame(st.raf); if (st.tocando) musica(null); st.tocando = false; window.removeEventListener('resize', st.onRes); if (st.ro) st.ro.disconnect(); window.removeEventListener('keydown', st.tecla, true); if (st.tl) st.tl.kill(); if (st.box) st.box.classList.remove('sg-tocando'); SG = null; }
/* desenho do mapa tático (canvas 2D) */
function desenha(st) { const { g, cv, map, cam } = st; const W = cv.width, H = cv.height; const dpr = st.dpr; const sc = Math.min(W, H) / (map.W * 1.08) * cam.z; const tt = performance.now() / 1000;
  const cs = Math.cos(cam.rot), sn = Math.sin(cam.rot); const px = (x, y) => { const dx = x - cam.x, dy = y - cam.y; return [W / 2 + (dx * cs - dy * sn) * sc, H / 2 + (dx * sn + dy * cs) * sc]; };
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; const bg = g.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.7); bg.addColorStop(0, '#0b1420'); bg.addColorStop(1, '#03060a'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
  const acc = getComputedStyle(st.el).getPropertyValue('--sc').trim() || '#FF5E3A';
  /* grade do mapa (a cada 200) e borda */
  g.lineWidth = 1 * dpr; g.strokeStyle = 'rgba(120,170,220,0.07)'; g.beginPath(); for (let k = 0; k <= map.W; k += 200) { let a = px(k, 0), b = px(k, map.W); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); a = px(0, k); b = px(map.W, k); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); } g.stroke();
  g.strokeStyle = 'rgba(160,200,240,0.28)'; g.lineWidth = 1.5 * dpr; g.beginPath(); { const c = [px(0, 0), px(map.W, 0), px(map.W, map.W), px(0, map.W)]; g.moveTo(c[0][0], c[0][1]); for (let i = 1; i < 4; i++) g.lineTo(c[i][0], c[i][1]); g.closePath(); } g.stroke();
  /* rochas e nós */
  g.fillStyle = 'rgba(150,160,175,0.22)'; for (let i = 0; i < map.rocks.length; i += 3) { const p = px(map.rocks[i], map.rocks[i + 1]); const r = Math.max(1.2 * dpr, map.rocks[i + 2] * sc); g.beginPath(); g.arc(p[0], p[1], r, 0, 6.2832); g.fill(); }
  const RC = [RES.plasma, RES.minerio, RES.dados]; for (let i = 0; i < map.nodes.length; i += 3) { const p = px(map.nodes[i], map.nodes[i + 1]); g.fillStyle = RC[map.nodes[i + 2]]; g.globalAlpha = 0.75; g.fillRect(p[0] - 2 * dpr, p[1] - 2 * dpr, 4 * dpr, 4 * dpr); } g.globalAlpha = 1;
  /* a Fenda no centro */
  { const c = px(map.CX, map.CY); const r = map.RR * sc; const gr = g.createRadialGradient(c[0], c[1], r * 0.2, c[0], c[1], r * 1.9); gr.addColorStop(0, 'rgba(255,94,58,0.55)'); gr.addColorStop(0.5, 'rgba(178,60,255,0.22)'); gr.addColorStop(1, 'rgba(178,60,255,0)'); g.fillStyle = gr; g.beginPath(); g.arc(c[0], c[1], r * 1.9, 0, 6.2832); g.fill(); g.strokeStyle = 'rgba(255,140,90,' + (0.5 + 0.2 * Math.sin(tt * 2)) + ')'; g.lineWidth = 1.5 * dpr; g.beginPath(); g.arc(c[0], c[1], r, 0, 6.2832); g.stroke(); }
  /* território de cada base (anel tênue na cor de quem é) */
  for (const b of st.map.bases) { const p = px(b.x, b.y); const cor = b.i === 0 ? acc : b.ally ? '#7FE3A1' : '#FF4A4A'; g.globalAlpha = 0.08; g.fillStyle = cor; g.beginPath(); g.arc(p[0], p[1], 360 * sc, 0, 6.2832); g.fill(); g.globalAlpha = 0.3; g.strokeStyle = cor; g.lineWidth = 1 * dpr; g.setLineDash([4 * dpr, 5 * dpr]); g.stroke(); g.setLineDash([]); g.globalAlpha = 1; }
  /* rota de ataque (contorna a Fenda) */
  if (st.alvo && st.rota.p > 0) { const a = st.eu, b = st.alvo; const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2; let nx = mx - map.CX, ny = my - map.CY; const nl = Math.hypot(nx, ny); if (nl < 1) { nx = -(b.y - a.y); ny = b.x - a.x; } const L = Math.hypot(nx, ny) || 1; const off = Math.max(0, map.RR * 2.6 - nl); const cxp = mx + nx / L * off, cyp = my + ny / L * off;
    g.strokeStyle = acc; g.lineWidth = 2.5 * dpr; g.setLineDash([9 * dpr, 7 * dpr]); g.lineDashOffset = -tt * 30 * dpr; g.beginPath(); const N = 40, M = Math.max(1, Math.round(N * st.rota.p)); for (let i = 0; i <= M; i++) { const u = i / N; const x = (1 - u) * (1 - u) * a.x + 2 * (1 - u) * u * cxp + u * u * b.x, y = (1 - u) * (1 - u) * a.y + 2 * (1 - u) * u * cyp + u * u * b.y; const p = px(x, y); if (i) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); } g.stroke(); g.setLineDash([]);
    if (st.rota.p > 0.5) { const p = px(cxp * 0.5 + mx * 0.5, cyp * 0.5 + my * 0.5); g.font = '600 ' + Math.round(10 * dpr) + 'px "IBM Plex Mono",monospace'; g.fillStyle = acc; g.globalAlpha = Math.min(1, (st.rota.p - 0.5) * 2); g.fillText(T('cine.rota', null, 'Rota de ataque').toUpperCase(), p[0] + 8 * dpr, p[1]); g.globalAlpha = 1; } }
  /* bases: você, aliados e inimigos (ameaça pulsando) */
  g.font = '600 ' + Math.round(10.5 * dpr) + 'px "IBM Plex Mono",monospace'; g.textAlign = 'center';
  for (const b of st.map.bases) { const p = px(b.x, b.y); const eu = b.i === 0; const cor = eu ? acc : b.ally ? '#7FE3A1' : '#FF4A4A'; const r = 7 * dpr;
    if (!eu && !b.ally) { const k = st.ameaca.k * (b === st.alvo ? 1 : 0.6); if (k > 0) for (let j = 0; j < 2; j++) { const f = ((tt * 0.7 + j * 0.5) % 1); g.strokeStyle = 'rgba(255,74,74,' + (0.6 * (1 - f) * k) + ')'; g.lineWidth = 1.5 * dpr; g.beginPath(); g.arc(p[0], p[1], r + f * 34 * dpr, 0, 6.2832); g.stroke(); } }
    g.fillStyle = cor; g.beginPath(); g.moveTo(p[0], p[1] - r * 1.3); g.lineTo(p[0] + r, p[1]); g.lineTo(p[0], p[1] + r * 1.3); g.lineTo(p[0] - r, p[1]); g.closePath(); g.fill(); g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 1 * dpr; g.stroke();
    g.fillStyle = '#fff'; g.shadowColor = '#000'; g.shadowBlur = 4 * dpr; const lb = eu ? T('cine.voce', null, 'Você') : (b.ally ? T('cine.aliado', null, 'Aliado') : T('cine.ameaca', null, 'Ameaça')) + ' · ' + raca(b.fac); g.fillText(lb.toUpperCase(), p[0], p[1] - r * 1.3 - 6 * dpr); g.shadowBlur = 0; }
  g.textAlign = 'left';
  /* varredura de radar a partir da sua base */
  if (st.varre.a > 0 && st.varre.a < 1) { const p = px(st.eu.x, st.eu.y); const R = st.varre.a * Math.max(W, H) * 1.2; g.strokeStyle = acc; g.globalAlpha = 0.55 * (1 - st.varre.a); g.lineWidth = 2 * dpr; g.beginPath(); g.arc(p[0], p[1], R, 0, 6.2832); g.stroke(); g.globalAlpha = 1; }
  /* cantos de mira */
  g.strokeStyle = 'rgba(255,255,255,.22)'; g.lineWidth = 1.5 * dpr; const m = 10 * dpr, l = 22 * dpr; g.beginPath(); for (const [x, y, sx, sy] of [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]]) { g.moveTo(x, y + sy * l); g.lineTo(x, y); g.lineTo(x + sx * l, y); } g.stroke(); }

/* ---------- início ---------- */
function init() { try { estilo(); ajustes(); } catch (e) { console.warn('[ARD] cinema:', e); } const go = () => gsapCarrega(); if (window.requestIdleCallback) requestIdleCallback(go, { timeout: 4000 }); else setTimeout(go, 1500); }
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
window.addEventListener('ard-idioma', () => { try { if (DOM && ARD.i18n && ARD.i18n.aplicar) ARD.i18n.aplicar(DOM.el); } catch (e) {} });

ARD.cinema = { quadro, eventos, ativa, pular, ligada, chefe, superarma, abertura, enfileira, salaGuerra, pararSala, ouviu, gsap: gsapCarrega, estado: () => (A ? { tipo: A.tipo, t: A.t, dur: A.cena.dur, pausou: A.pausou } : SG && SG.tocando ? { tipo: 'sala', t: SG.t, dur: SG.dur } : null) };
})(globalThis.ARD = globalThis.ARD || {});
