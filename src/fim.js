/* Aether Rift: Dominion — 5.5a: a tela final nova e o cartão de resultado.
   A tela final deixa a última cena da partida ao fundo e mostra a palavra grande (Vitória ou Derrota), três números da partida, o gráfico
   da força dos exércitos com "a virada" marcada e o botão Compartilhar, que monta a imagem do cartão (1200×630) aqui mesmo, no navegador,
   sem servidor. Fontes do cartão: as do próprio jogo (Big Shoulders Display e IBM Plex, já no ASSETS.md); imagens: a cena da partida e o
   retrato do líder que o jogo já tem. Só interface: lê a simulação, não muda nada nela. As amostras do gráfico ficam em G.hist (a cada
   5 s de jogo; não vão para o salvamento: numa partida retomada o gráfico começa na retomada). */
(function (ARD) {
'use strict';
const S = () => ARD.sim;
const T = (k, v, r) => (ARD.t ? ARD.t(k, v, r) : String(r != null ? r : k).replace(/\{(\w+)\}/g, (x, n) => v && n in v ? String(v[n]) : x));
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const mmss = t => { t = Math.max(0, Math.floor(t)); return String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0'); };
const num = v => (ARD.i18n && ARD.i18n.num ? ARD.i18n.num(Math.floor(v)) : String(Math.floor(v)));
const CADA = 50;            /* uma amostra a cada 50 tiques (5 s de jogo) */
const W = 1200, H = 630;    /* o cartão */
const GRAD = ['#FF5E3A', '#E94FA0', '#C13CF5']; /* laranja → magenta, as cores da marca */
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
  try { const c = G.fimFoto || (G.fimFoto = document.createElement('canvas')); c.width = W; c.height = H; const x = c.getContext('2d'); const cw = canvas.width, ch = canvas.height; if (!cw || !ch) return;
    const k = Math.max(W / cw, H / ch), dw = cw * k, dh = ch * k; x.drawImage(canvas, (W - dw) / 2, (H - dh) / 2, dw, dh);
    const px = x.getImageData(W >> 1, H >> 1, 8, 8).data; let soma = 0; for (let i = 0; i < px.length; i += 4) soma += px[i] + px[i + 1] + px[i + 2]; G.fimFotoOk = soma > 40; if (G.fimFotoOk && G.fimCap < 12) G.fimCap = 0; } catch (e) { G.fimFotoOk = false; } }

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
  const v = o.G.view; if (v) { v.reveal = true; o.G.fimGira = true; } }
function pinta(o) { const venceu = o.venceu; const tt = $('end-title'); tt.textContent = o.palavra || T(venceu ? 'fim.vitoria' : 'fim.derrota', null, venceu ? 'VITÓRIA' : 'DERROTA'); tt.className = o.result.outcome;
  if (o.linha) $('end-eyebrow').textContent = o.linha;
  const nm = $('fim-lider-nome'); if (nm) nm.textContent = o.lider && o.lider.nome ? o.lider.nome : '';
  $('fim-nums').innerHTML = numeros(o.sim, o.human).map(n => '<div class="fn"><b>' + esc(n.v) + '</b><span>' + esc(T('fim.n.' + n.k, null, n.pt)) + '</span></div>').join('');
  $('fim-graf').innerHTML = grafico(o);
  const px = $('fim-prox'); if (px) { const tx = o.proximo ? o.proximo() : ''; px.hidden = !tx; px.textContent = tx; } }
if (typeof window !== 'undefined') window.addEventListener('ard-idioma', () => { if (U && $('end') && !$('end').hidden) try { pinta(U); } catch (e) {} });

/* ---------- o cartão (canvas 2D, 1200×630) ---------- */
const FD = "'Big Shoulders Display','Arial Narrow',Impact,sans-serif", FB = "'IBM Plex Sans',system-ui,sans-serif", FM = "'IBM Plex Mono',ui-monospace,monospace";
function gradTexto(x, x0, x1) { const g = x.createLinearGradient(x0, 0, x1, 0); g.addColorStop(0, GRAD[0]); g.addColorStop(0.55, GRAD[1]); g.addColorStop(1, GRAD[2]); return g; }
function cabe(x, txt, peso, tam, fam, larg) { let t = tam; for (; t > 12; t -= 2) { x.font = peso + ' ' + t + 'px ' + fam; if (x.measureText(txt).width <= larg) break; } return t; }
function espacado(x, txt, px, py, esp) { let cx = px; for (const ch of txt) { x.fillText(ch, cx, py); cx += x.measureText(ch).width + esp; } return cx; }
function imagem(src) { return new Promise(res => { if (!src) return res(null); const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; }); }
function manchete(o) { const t = mmss(o.tempo); if (o.manchete) return o.manchete;
  if (o.tipo === 'guia' && o.venceu) return T('fim.cartao.primeira', null, 'PRIMEIRA VITÓRIA');
  if (o.vir) return T(o.venceu ? 'fim.cartao.virei' : 'fim.cartao.viraram', { t: mmss(o.vir.t) }, o.venceu ? 'VIREI AOS {t}' : 'VIRARAM AOS {t}');
  return T(o.venceu ? 'fim.cartao.venci' : 'fim.cartao.cai', { t }, o.venceu ? 'VITÓRIA EM {t}' : 'DERROTA AOS {t}'); }
function contexto(o) { const sim = o.sim, d = ARD.i18n && ARD.i18n.d; const foes = sim.players.filter(q => q.id !== o.human && !q.fenda && q.id !== sim.mundo); const mapa = d ? d.mapa(sim.map && sim.map.type ? sim.map.type : 'fenda') : 'Planície da Fenda';
  const partes = [o.modo || mapa, T('fim.cartao.contra', { n: foes.length }, 'contra {n}')]; if (o.dif) partes.push(o.dif); return partes.join(' · '); }
async function desenha(o) { const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'); const sim = o.sim, p = sim.players[o.human]; const cor = (o.cores && o.cores[p.faction]) || p.color || '#7FE3A1';
  try { if (document.fonts && document.fonts.load) await Promise.race([Promise.all([document.fonts.load('800 80px ' + FD), document.fonts.load('500 20px ' + FM), document.fonts.load('500 24px ' + FB)]), new Promise(r => setTimeout(r, 2500))]); } catch (e) {}
  /* fundo: a cena da partida; sem ela (aparelho que não deixa copiar a tela), um degradê com a cor da Raça */
  if (o.G.fimFoto && o.G.fimFotoOk) x.drawImage(o.G.fimFoto, 0, 0); else { const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#0B0F15'); g.addColorStop(0.55, '#1b1230'); g.addColorStop(1, '#0B0F15'); x.fillStyle = g; x.fillRect(0, 0, W, H); const r = x.createRadialGradient(W * 0.62, H * 0.3, 10, W * 0.62, H * 0.3, 520); r.addColorStop(0, 'rgba(193,60,245,.55)'); r.addColorStop(0.5, 'rgba(255,94,58,.16)'); r.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = r; x.fillRect(0, 0, W, H); }
  { const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(5,7,11,.62)'); g.addColorStop(0.22, 'rgba(5,7,11,.12)'); g.addColorStop(0.5, 'rgba(5,7,11,.3)'); g.addColorStop(0.8, 'rgba(5,7,11,.9)'); g.addColorStop(1, 'rgba(5,7,11,.96)'); x.fillStyle = g; x.fillRect(0, 0, W, H); }
  x.textBaseline = 'alphabetic';
  /* marca */
  x.font = '800 44px ' + FD; x.fillStyle = '#ECE6DA'; const m1 = 'AETHER RIFT '; x.fillText(m1, 48, 78); const mw = x.measureText(m1).width; x.fillStyle = gradTexto(x, 48 + mw, 48 + mw + x.measureText('DOMINION').width); x.fillText('DOMINION', 48 + mw, 78);
  x.font = '500 18px ' + FM; x.fillStyle = 'rgba(236,230,218,.85)'; x.textAlign = 'right'; x.fillText(T('fim.cartao.lema', null, 'estratégia em tempo real, no navegador'), W - 48, 70); x.textAlign = 'left';
  /* linha de cima e manchete */
  const linha = (T(o.venceu ? 'fim.vitoria' : 'fim.derrota', null, o.venceu ? 'VITÓRIA' : 'DERROTA') + ' · ' + mmss(o.tempo)).toUpperCase(); x.font = '500 22px ' + FM; x.fillStyle = cor; espacado(x, linha, 48, 352, 3);
  const man = String(manchete(o)).toUpperCase(); const tm = cabe(x, man, '800', 132, FD, W - 96); x.font = '800 ' + tm + 'px ' + FD; x.fillStyle = o.venceu ? gradTexto(x, 48, 48 + x.measureText(man).width) : '#F1ECE2'; x.fillText(man, 44, 352 + 24 + tm * 0.78);
  /* faixa de baixo: líder, Raça, contexto e os três números */
  const by = 498; const art = await imagem(o.lider && o.lider.art);
  x.save(); x.beginPath(); x.arc(92, by + 56, 46, 0, Math.PI * 2); x.closePath(); x.fillStyle = '#0B0F15'; x.fill(); if (art) { x.clip(); const k = Math.max(92 / art.width, 92 / art.height); x.drawImage(art, 92 - art.width * k / 2, by + 56 - art.height * k / 2, art.width * k, art.height * k); } x.restore();
  x.lineWidth = 4; x.strokeStyle = cor; x.beginPath(); x.arc(92, by + 56, 47, 0, Math.PI * 2); x.stroke();
  const d = ARD.i18n && ARD.i18n.d; const raca = (d ? d.racaCurto(p.faction) : p.faction).toUpperCase() + (o.lider && o.lider.nome ? ' · ' + o.lider.nome.toUpperCase() : '');
  x.fillStyle = '#F1ECE2'; const tr = cabe(x, raca, '700', 38, FD, 440); x.font = '700 ' + tr + 'px ' + FD; x.fillText(raca, 160, by + 50);
  const ctx = contexto(o); x.fillStyle = 'rgba(236,230,218,.72)'; const tc = cabe(x, ctx, '500', 22, FB, 440); x.font = '500 ' + tc + 'px ' + FB; x.fillText(ctx, 160, by + 84);
  const ns = numeros(sim, o.human); const x0 = 640, cw = (W - 48 - x0) / 3;
  ns.forEach((n, i) => { const cx = x0 + i * cw; x.fillStyle = '#F1ECE2'; const tn = cabe(x, n.v, '800', 64, FD, cw - 16); x.font = '800 ' + tn + 'px ' + FD; x.fillText(n.v, cx, by + 58); const rot = T('fim.n.' + n.k + '.curto', null, n.pt).toUpperCase(); x.fillStyle = cor; const tl = cabe(x, rot, '500', 15, FM, cw - 16); x.font = '500 ' + tl + 'px ' + FM; espacado(x, rot, cx, by + 86, 1.5); });
  return c; }
function paraBlob(c) { return new Promise(res => { try { c.toBlob(b => res(b), 'image/png'); } catch (e) { res(null); } }); }
async function compartilhar(o) { const box = $('cartao'); if (!box) return; const bs = $('btn-share'); if (bs) bs.disabled = true; let c = null, blob = null;
  try { c = await desenha(o); blob = await paraBlob(c); } catch (e) { console.warn('[ARD] cartão de resultado:', e); }
  if (bs) bs.disabled = false; if (!c) return;
  const nome = 'aether-rift-dominion-' + (o.venceu ? 'vitoria' : 'derrota') + '.png'; const img = $('cartao-img'); if (U && U.urlCartao) { try { URL.revokeObjectURL(U.urlCartao); } catch (e) {} }
  const url = blob ? URL.createObjectURL(blob) : c.toDataURL('image/png'); o.urlCartao = blob ? url : null; img.src = url; img.width = W; img.height = H; o.cartaoCanvas = c;
  const texto = T('fim.cartao.texto', { m: String(manchete(o)) }, '{m} em Aether Rift: Dominion');
  const arq = blob && typeof File === 'function' ? new File([blob], nome, { type: 'image/png' }) : null; const podeEnviar = !!(arq && navigator.canShare && navigator.canShare({ files: [arq] }) && navigator.share);
  const nota = t => { $('cartao-nota').textContent = t; };
  const be = $('cartao-enviar'); be.hidden = !podeEnviar; be.onclick = () => { navigator.share({ files: [arq], title: 'Aether Rift: Dominion', text: texto }).catch(() => {}); };
  const bb = $('cartao-baixar'); bb.href = url; bb.download = nome; bb.classList.toggle('primary', !podeEnviar);
  const bc = $('cartao-copiar'); const podeCopiar = !!(blob && navigator.clipboard && navigator.clipboard.write && typeof ClipboardItem === 'function'); bc.hidden = !podeCopiar; bc.onclick = () => { navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]).then(() => nota(T('fim.cartao.copiado', null, 'Imagem copiada. Cole onde quiser.')), () => nota(T('fim.cartao.nao-copiou', null, 'Este navegador não deixou copiar a imagem. Use Baixar imagem.'))); };
  nota(T(podeEnviar ? 'fim.cartao.nota-enviar' : 'fim.cartao.nota-baixar', null, podeEnviar ? 'A imagem foi montada neste aparelho; nada foi enviado a servidor nenhum.' : 'A imagem foi montada neste aparelho. Baixe e poste onde quiser.'));
  $('cartao-fechar').onclick = () => { box.hidden = true; }; box.hidden = false; }
/* a cena ao fundo gira devagar (só a câmera; a partida já acabou) */
function quadro(G, dt) { if (G.fimGira && G.R && G.R.supportsYaw && G.view && !(G.photo && G.photo.on)) G.view.cam.yaw = (G.view.cam.yaw || 0) + dt * 0.025; }

ARD.fim = { CADA, amostra, virada, captura, numeros, mostrar, compartilhar, desenha, manchete, quadro, get ultimo() { return U; } };
})(globalThis.ARD = globalThis.ARD || {});
