/* Aether Rift: Dominion — 5.5a: a tela final nova e o cartão de resultado.
   A tela final deixa a última cena da partida ao fundo e mostra a palavra grande (Vitória ou Derrota), três números da partida, o gráfico
   da força dos exércitos com "a virada" marcada e o botão Compartilhar, que monta a imagem do cartão (1200×630) aqui mesmo, no navegador,
   sem servidor. Fontes do cartão: as do próprio jogo (Big Shoulders Display e IBM Plex, já no ASSETS.md); imagens: a cena da partida e o
   retrato do líder que o jogo já tem. Só interface: lê a simulação, não muda nada nela. As amostras do gráfico ficam em G.hist (a cada
   5 s de jogo; não vão para o salvamento: numa partida retomada o gráfico começa na retomada).
   5.5b: o desenho do cartão foi para o src/cartoes.js (dois tamanhos, 1200×630 e 1080×1350, e o cartão de conquista); aqui ficam a tela
   final, a manchete, o contexto e os três números. No fim de mostrar(), o src/desafio-ui.js põe o bloco do desafio (linha para colar e "Desafiar um amigo"). */
(function (ARD) {
'use strict';
const S = () => ARD.sim;
const T = (k, v, r) => (ARD.t ? ARD.t(k, v, r) : String(r != null ? r : k).replace(/\{(\w+)\}/g, (x, n) => v && n in v ? String(v[n]) : x));
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const mmss = t => { t = Math.max(0, Math.floor(t)); return String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0'); };
const num = v => (ARD.i18n && ARD.i18n.num ? ARD.i18n.num(Math.floor(v)) : String(Math.floor(v)));
const CADA = 50;            /* uma amostra a cada 50 tiques (5 s de jogo) */
let U = null;               /* a última tela final montada (para refazer na troca de idioma e para o cartão) */

/* ---------- amostras da partida ---------- */
function amostra(G) { const sim = G.sim, s = S(); const h = G.hist || (G.hist = { t: [], f: sim.players.map(() => []) });
  if (h.t.length && h.t[h.t.length - 1] >= sim.time) return; if (h.t.length >= 720) return; h.t.push(sim.time);
  for (const p of sim.players) h.f[p.id].push(p.fenda || p.id === sim.mundo ? 0 : Math.round(s.armyValue(sim, p.id))); }
/* a virada: a última vez em que o jogador passou à frente (vitória) ou ficou para trás (derrota) do exército inimigo mais forte, depois de
   pelo menos 15 s do outro lado com folga (15% e 100 pontos). Sem isso, não houve virada. */
function virada(h, human, venceu) { if (!h || h.t.length < 6) return null; const n = h.t.length; const me = h.f[human]; const ini = i => { let m = 0; for (let p = 0; p < h.f.length; p++) if (p !== human && h.f[p][i] > m) m = h.f[p][i]; return m; };
  const d = i => (venceu ? 1 : -1) * (me[i] - ini(i)); let atras = 0, ok = false, at = -1;
  for (let i = 0; i < n; i++) { const e = ini(i), folga = Math.max(100, 0.15 * Math.max(e, me[i])); if (d(i) < -folga) { atras++; if (atras >= 3) ok = true; } else if (d(i) > 0) { if (ok) { at = i; ok = false; } atras = 0; } }
  return at >= 0 && d(n - 1) >= 0 ? { i: at, t: h.t[at] } : null; }

/* ---------- a cena ao fundo: foto para o cartão ---------- */
function captura(G, canvas) { /* chamado logo depois do R.draw, no mesmo quadro (é quando a tela 3D ainda tem a imagem) */
  if (!G.fimCap) return; G.fimCap--; if (G.fimCap > 0 && G.fimCap % 6 !== 0) return;
  try { const cw = canvas.width, ch = canvas.height; if (!cw || !ch) return; const k = Math.min(1, 1600 / Math.max(cw, ch)); /* 5.5b: a foto guarda a proporção da tela (até 1600 px no lado maior), para servir ao cartão deitado e ao cartão em pé */
    const c = G.fimFoto || (G.fimFoto = document.createElement('canvas')); c.width = Math.max(2, Math.round(cw * k)); c.height = Math.max(2, Math.round(ch * k)); const x = c.getContext('2d'); x.drawImage(canvas, 0, 0, c.width, c.height);
    const px = x.getImageData(c.width >> 1, c.height >> 1, 8, 8).data; let soma = 0; for (let i = 0; i < px.length; i += 4) soma += px[i] + px[i + 1] + px[i + 2]; G.fimFotoOk = soma > 40; if (G.fimFotoOk && G.fimCap < 12) G.fimCap = 0; } catch (e) { G.fimFotoOk = false; } }

/* ---------- os três números ---------- */
function numeros(sim, human) { const s = S(), p = sim.players[human], st = p.stats; const rb = st.stolen >= 200;
  return [{ v: num(st.unitsKilled), k: 'abatidas', pt: 'unidades derrubadas' }, p.alive ? { v: num(s.score(sim, p)), k: 'dominio', pt: 'pontos de Domínio' } : { v: num(st.buildingsDestroyed), k: 'estruturas', pt: 'construções destruídas' } /* sem Núcleo o Domínio é zero: no lugar dele, o estrago feito */, { v: num(rb ? st.stolen : st.collected), k: rb ? 'roubados' : 'coletados', pt: rb ? 'recursos roubados' : 'recursos coletados' }]; }

/* ---------- o gráfico (SVG na tela; o cartão desenha o mesmo em canvas) ---------- */
function pontos(h, pid, w, hh, max) { const n = h.t.length, t1 = h.t[n - 1] || 1; let s = ''; for (let i = 0; i < n; i++) s += (i ? ' ' : '') + (h.t[i] / t1 * w).toFixed(1) + ',' + (hh - 4 - h.f[pid][i] / max * (hh - 12)).toFixed(1); return s; }
function grafico(o) { const h = o.G.hist, sim = o.sim; if (!h || h.t.length < 3) return '<div class="fg-vazio">' + esc(T('fim.graf.curto', null, 'Partida curta demais para o gráfico.')) + '</div>';
  const w = 600, hh = 150; let max = 1; for (const f of h.f) for (const v of f) if (v > max) max = v; let ln = '';
  for (const p of sim.players) if (!p.fenda && p.id !== sim.mundo && p.id !== o.human) ln += '<polyline points="' + pontos(h, p.id, w, hh, max) + '" fill="none" stroke="' + esc(p.color) + '" stroke-opacity=".55" stroke-width="1.6"/>';
  ln += '<polyline points="' + pontos(h, o.human, w, hh, max) + '" fill="none" stroke="var(--race,#7FE3A1)" stroke-width="3.2" stroke-linejoin="round"/>';
  let vz = ''; const v = o.vir; if (v) { const n = h.t.length, x = h.t[v.i] / (h.t[n - 1] || 1) * w, y = hh - 4 - h.f[o.human][v.i] / max * (hh - 12); const esq = x > w * 0.7;
    vz = '<line x1="' + x.toFixed(1) + '" y1="6" x2="' + x.toFixed(1) + '" y2="' + hh + '" stroke="#fff" stroke-opacity=".28" stroke-dasharray="3 4"/><circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="5.5" fill="#fff"/><text x="' + (x + (esq ? -10 : 10)).toFixed(1) + '" y="' + Math.max(16, y - 10).toFixed(1) + '" text-anchor="' + (esq ? 'end' : 'start') + '" class="fg-v">' + esc(T('fim.graf.virada', { t: mmss(v.t) }, 'a virada · {t}')) + '</text>'; }
  return '<div class="fg-t">' + esc(T('fim.graf.titulo', null, 'Força do exército')) + '<span>' + esc(T('fim.graf.legenda', null, 'você em destaque')) + '</span></div><svg viewBox="0 0 ' + w + ' ' + hh + '" role="img" aria-label="' + esc(T('fim.graf.titulo', null, 'Força do exército')) + '">' + ln + vz + '</svg>'; }

/* ---------- a tela ---------- */
/* o: { G, sim, human, result: { outcome, reason }, tipo: 'escaramuca' | 'blitz' | 'campanha' | 'cacada' | 'guia' | 'multi', palavra (opcional: título pronto, ex.: MISSÃO CUMPRIDA),
        linha (texto pequeno de cima), lider: { nome, art }, tempo, sair(), deNovo() } */
function mostrar(o) { U = o; const venceu = o.result.outcome === 'victory'; o.venceu = venceu; o.vir = virada(o.G.hist, o.human, venceu);
  const el = $('end'); if (!el) return; document.body.classList.add('fim-on'); el.dataset.outcome = o.result.outcome; el.hidden = false;
  pinta(o);
  const bs = $('btn-share'); if (bs) bs.onclick = () => compartilhar(o);
  const bm = $('btn-fim-menu'); if (bm) bm.onclick = () => o.sair();
  const det = $('fim-det'); if (det) det.open = false;
  o.G.fimCap = 40; /* a foto da cena para o cartão sai nos próximos quadros */
  const v = o.G.view; if (v) { v.reveal = true; o.G.fimGira = true; }
  if (ARD.desafioUI) try { ARD.desafioUI.fim(o); } catch (e) { console.warn('[ARD] desafio (tela final):', e); } /* 5.5b: linha para colar, recorde do dia, "Desafiar um amigo" e o cartão de conquista */
  if (ARD.patentes) try { ARD.patentes.credita(o); } catch (e) { console.warn('[ARD] patentes (tela final):', e); } /* 5.5b.2: as Centelhas da partida (src/patentes.js); o resultado fica em o.patentes para a tela mostrar */
  if (ARD.perfilUI) try { ARD.perfilUI.fim(o); } catch (e) { console.warn('[ARD] patentes (tela final):', e); } /* 5.5b.2: o bloco "Centelhas ganhas" (depois do desafio, para a sequência do dia já estar registrada) */ }
function pinta(o) { const venceu = o.venceu; const tt = $('end-title'); tt.textContent = o.palavra || T(venceu ? 'fim.vitoria' : 'fim.derrota', null, venceu ? 'VITÓRIA' : 'DERROTA'); tt.className = o.result.outcome;
  if (o.linha) $('end-eyebrow').textContent = o.linha;
  const nm = $('fim-lider-nome'); if (nm) nm.textContent = o.lider && o.lider.nome ? o.lider.nome : '';
  $('fim-nums').innerHTML = numeros(o.sim, o.human).map(n => '<div class="fn"><b>' + esc(n.v) + '</b><span>' + esc(T('fim.n.' + n.k, null, n.pt)) + '</span></div>').join('');
  $('fim-graf').innerHTML = grafico(o);
  const px = $('fim-prox'); if (px) { const tx = o.proximo ? o.proximo() : ''; px.hidden = !tx; px.textContent = tx; } }
if (typeof window !== 'undefined') window.addEventListener('ard-idioma', () => { if (U && $('end') && !$('end').hidden) try { pinta(U); } catch (e) {} });

/* ---------- o cartão: manchete e contexto (5.5b: o desenho está no src/cartoes.js) ---------- */
function manchete(o) { const t = mmss(o.tempo); if (o.manchete) return o.manchete;
  if (o.tipo === 'guia' && o.venceu) return T('fim.cartao.primeira', null, 'PRIMEIRA VITÓRIA');
  if (o.vir) return T(o.venceu ? 'fim.cartao.virei' : 'fim.cartao.viraram', { t: mmss(o.vir.t) }, o.venceu ? 'VIREI AOS {t}' : 'VIRARAM AOS {t}');
  return T(o.venceu ? 'fim.cartao.venci' : 'fim.cartao.cai', { t }, o.venceu ? 'VITÓRIA EM {t}' : 'DERROTA AOS {t}'); }
function contexto(o) { const sim = o.sim, d = ARD.i18n && ARD.i18n.d; const foes = sim.players.filter(q => q.id !== o.human && !q.fenda && q.id !== sim.mundo); const mapa = d ? d.mapa(sim.map && sim.map.type ? sim.map.type : 'fenda') : 'Planície da Fenda';
  const partes = [o.modo || mapa, T('fim.cartao.contra', { n: foes.length }, 'contra {n}')]; if (o.dif) partes.push(o.dif); return partes.join(' · '); }
function desenha(o, fmt) { return ARD.cartoes.resultado(o, fmt || 'largo'); }
async function compartilhar(o) { if (!ARD.cartoes) return; const bs = $('btn-share'); if (bs) bs.disabled = true; try { await ARD.cartoes.abrirResultado(o); } catch (e) { console.warn('[ARD] cartão de resultado:', e); } if (bs) bs.disabled = false; }
/* a cena ao fundo gira devagar (só a câmera; a partida já acabou) */
function quadro(G, dt) { if (G.fimGira && G.R && G.R.supportsYaw && G.view && !(G.photo && G.photo.on)) G.view.cam.yaw = (G.view.cam.yaw || 0) + dt * 0.025; }

ARD.fim = { CADA, amostra, virada, captura, numeros, mostrar, compartilhar, desenha, manchete, contexto /* 5.5b */, quadro, get ultimo() { return U; } };
})(globalThis.ARD = globalThis.ARD || {});
