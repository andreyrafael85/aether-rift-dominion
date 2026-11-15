/* Aether Rift: Dominion — 5.5b: os cartões para compartilhar, montados aqui mesmo no navegador (canvas 2D), sem servidor.
   Dois cartões: o de RESULTADO (o da 5.5a, que morava no src/fim.js) e o de CONQUISTA. Cada um em dois tamanhos: 'largo' (1200×630,
   para link e conversa) e 'pe' (1080×1350, em pé, para as redes). O cartão do Desafio do Dia leva a data e o desafio.
   Fontes: as do próprio jogo (Big Shoulders Display e IBM Plex, já no ASSETS.md). Imagens: a cena da partida, o retrato do líder e a
   arte de abertura que o jogo já tem. Nenhuma fonte ou imagem nova, e nenhum endereço do jogo no cartão (decisão do dono até o lançamento).
   Todo texto passa por texto(): ele encolhe a letra até caber na largura reservada e anota a medida em canvas._med, para o
   tools/desafio-test.cjs provar com números que nada foi cortado. */
(function (ARD) {
'use strict';
const T = (k, v, r) => (ARD.t ? ARD.t(k, v, r) : String(r != null ? r : k));
const $ = id => document.getElementById(id);
const mmss = t => { t = Math.max(0, Math.floor(t)); return String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0'); };
const FORMATOS = { largo: { w: 1200, h: 630 }, pe: { w: 1080, h: 1350 } };
const GRAD = ['#FF5E3A', '#E94FA0', '#C13CF5']; /* laranja → magenta, as cores da marca */
const FD = "'Big Shoulders Display','Arial Narrow',Impact,sans-serif", FB = "'IBM Plex Sans',system-ui,sans-serif", FM = "'IBM Plex Mono',ui-monospace,monospace";
const CLARO = '#F1ECE2', SUAVE = 'rgba(236,230,218,.78)';

/* ---------- ferramentas de desenho ---------- */
function tela(fmt) { const F = FORMATOS[fmt] || FORMATOS.largo; const c = document.createElement('canvas'); c.width = F.w; c.height = F.h; c._med = []; c._fmt = FORMATOS[fmt] ? fmt : 'largo'; const x = c.getContext('2d'); x.textBaseline = 'alphabetic'; x.textAlign = 'left'; return { c, x, W: F.w, H: F.h }; }
async function fontes() { try { if (document.fonts && document.fonts.load) await Promise.race([Promise.all([document.fonts.load('800 80px ' + FD), document.fonts.load('700 40px ' + FD), document.fonts.load('500 20px ' + FM), document.fonts.load('500 24px ' + FB)]), new Promise(r => setTimeout(r, 2500))]); } catch (e) {} }
function imagem(src) { return new Promise(res => { if (!src) return res(null); const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; }); }
function largura(x, s, esp) { return x.measureText(s).width + (esp ? esp * Math.max(0, [...s].length - 1) : 0); }
/* escreve s em (px, py). o: { id, peso, tam, min, fam, max (largura reservada), cor, grad (degradê da marca), alinha: 'esq' | 'dir' | 'centro', esp (entre letras) }.
   A letra encolhe de tam até min para caber em max; a medida final fica anotada. */
function texto(K, s, px, py, o) { const x = K.x; const esp = o.esp || 0; const min = o.min || 12; let t = o.tam, w = 0, cortado = false; const ops = [s].concat(o.alt || []).map(z => String(z == null ? '' : z)).filter((z, i) => z || !i);
  for (let i = 0; i < ops.length; i++) { s = ops[i]; for (t = o.tam; ; t -= t > 40 ? 2 : 1) { x.font = o.peso + ' ' + t + 'px ' + o.fam; w = largura(x, s, esp); if (w <= o.max || t <= min) break; } if (w <= o.max) break; } /* o.alt: versões mais curtas do mesmo texto, tentadas em ordem quando nem a letra mínima cabe */
  if (w > o.max) { cortado = true; const cs = [...s]; while (cs.length > 1 && largura(x, cs.join('') + '…', esp) > o.max) cs.pop(); s = cs.join('').replace(/[\s·,]+$/, '') + '…'; w = largura(x, s, esp); } /* último recurso: reticências (o teste acusa: nenhum texto de verdade deve chegar aqui) */
  const x0 = o.alinha === 'dir' ? px - w : o.alinha === 'centro' ? px - w / 2 : px;
  if (o.grad) { const g = x.createLinearGradient(x0, 0, x0 + Math.max(1, w), 0); g.addColorStop(0, GRAD[0]); g.addColorStop(0.55, GRAD[1]); g.addColorStop(1, GRAD[2]); x.fillStyle = g; } else x.fillStyle = o.cor || CLARO;
  if (o.sombra) { x.save(); x.shadowColor = 'rgba(0,0,0,.75)'; x.shadowBlur = o.sombra; }
  if (esp) { let cx = x0; for (const ch of s) { x.fillText(ch, cx, py); cx += x.measureText(ch).width + esp; } } else x.fillText(s, x0, py);
  if (o.sombra) x.restore();
  K.c._med.push({ id: o.id || '', s, w: Math.round(w * 10) / 10, max: o.max, x0: Math.round(x0 * 10) / 10, x1: Math.round((x0 + w) * 10) / 10, y: py, tam: t, min, cortado, cabe: !cortado && w <= o.max + 0.5 && x0 >= -0.5 && x0 + w <= K.W + 0.5 && py - t * 0.2 >= 0 && py <= K.H });
  return { w, tam: t, x0, x1: x0 + w }; }
/* quebra s em linhas que cabem em max com a fonte dada (por palavras) */
function quebra(x, s, fonte, max, maxLinhas) { x.font = fonte; const pal = String(s || '').split(/\s+/).filter(Boolean); const ls = []; let at = '';
  for (const p of pal) { const t = at ? at + ' ' + p : p; if (!at || x.measureText(t).width <= max) at = t; else { ls.push(at); at = p; } } if (at) ls.push(at);
  if (maxLinhas && ls.length > maxLinhas) { const resto = ls.splice(maxLinhas - 1).join(' '); ls.push(resto); } return ls; }
/* parte a manchete em duas linhas perto do meio (só quando vale a pena: fica maior no cartão em pé) */
function duasLinhas(s) { const pal = s.split(' '); if (pal.length < 2 || s.length < 10) return [s]; let best = 1, bd = 1e9; for (let i = 1; i < pal.length; i++) { const a = pal.slice(0, i).join(' ').length, b = pal.slice(i).join(' ').length; const d = Math.abs(a - b); if (d < bd) { bd = d; best = i; } } return [pal.slice(0, best).join(' '), pal.slice(best).join(' ')]; }
function cobre(x, im, W, H) { const k = Math.max(W / im.width, H / im.height), dw = im.width * k, dh = im.height * k; x.drawImage(im, (W - dw) / 2, (H - dh) / 2, dw, dh); }
function fundoMarca(K) { const x = K.x, W = K.W, H = K.H; const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#0B0F15'); g.addColorStop(0.55, '#1b1230'); g.addColorStop(1, '#0B0F15'); x.fillStyle = g; x.fillRect(0, 0, W, H);
  const r = x.createRadialGradient(W * 0.62, H * 0.3, 10, W * 0.62, H * 0.3, Math.max(W, H) * 0.5); r.addColorStop(0, 'rgba(193,60,245,.55)'); r.addColorStop(0.5, 'rgba(255,94,58,.16)'); r.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = r; x.fillRect(0, 0, W, H); }
function marca(K, mx, y, tam) { const a = texto(K, 'AETHER RIFT ', mx, y, { id: 'marca', peso: '800', tam, min: tam, fam: FD, max: K.W, cor: '#ECE6DA' }); texto(K, 'DOMINION', a.x1, y, { id: 'marca2', peso: '800', tam, min: tam, fam: FD, max: K.W - a.x1, grad: true }); }
function retrato(K, art, cx, cy, r, cor) { const x = K.x; x.save(); x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.closePath(); x.fillStyle = '#0B0F15'; x.fill(); if (art) { x.clip(); const k = Math.max(2 * r / art.width, 2 * r / art.height); x.drawImage(art, cx - art.width * k / 2, cy - art.height * k / 2, art.width * k, art.height * k); } x.restore(); x.lineWidth = 4; x.strokeStyle = cor; x.beginPath(); x.arc(cx, cy, r + 1, 0, Math.PI * 2); x.stroke(); }
/* o gráfico da força dos exércitos (o mesmo da tela final), para o cartão em pé */
function grafico(K, o, gx, gy, gw, gh, cor) { const h = o.G && o.G.hist; if (!h || h.t.length < 3) return false; const x = K.x; const n = h.t.length, t1 = h.t[n - 1] || 1; let max = 1; for (const f of h.f) for (const v of f) if (v > max) max = v;
  const pt = (pid, i) => [gx + h.t[i] / t1 * gw, gy + gh - 4 - h.f[pid][i] / max * (gh - 14)]; const linha = (pid, cor2, lw, al) => { x.beginPath(); for (let i = 0; i < n; i++) { const p = pt(pid, i); if (i) x.lineTo(p[0], p[1]); else x.moveTo(p[0], p[1]); } x.lineWidth = lw; x.strokeStyle = cor2; x.globalAlpha = al; x.lineJoin = 'round'; x.stroke(); x.globalAlpha = 1; };
  x.fillStyle = 'rgba(5,7,11,.42)'; x.fillRect(gx - 12, gy - 8, gw + 24, gh + 16);
  for (const p of o.sim.players) if (!p.fenda && p.id !== o.sim.mundo && p.id !== o.human && h.f[p.id]) linha(p.id, p.color || '#888', 2.5, 0.6); linha(o.human, cor, 5, 1);
  if (o.vir) { const p = pt(o.human, o.vir.i); x.setLineDash([4, 6]); x.strokeStyle = 'rgba(255,255,255,.35)'; x.lineWidth = 2; x.beginPath(); x.moveTo(p[0], gy); x.lineTo(p[0], gy + gh); x.stroke(); x.setLineDash([]); x.fillStyle = '#fff'; x.beginPath(); x.arc(p[0], p[1], 8, 0, Math.PI * 2); x.fill();
    const dir = p[0] > gx + gw * 0.65; texto(K, T('fim.graf.virada', { t: mmss(o.vir.t) }), p[0] + (dir ? -14 : 14), Math.max(gy + 22, p[1] - 14), { id: 'virada', peso: '500', tam: 20, min: 14, fam: FM, max: dir ? p[0] - gx - 14 : gx + gw - p[0] - 14, cor: '#fff', alinha: dir ? 'dir' : 'esq' }); }
  return true; }

/* ---------- cartão de resultado ----------
   o: o mesmo objeto da tela final (src/fim.js): { G, sim, human, venceu, tempo, vir, tipo, lider: { nome, art }, cores, modo, dif, manchete }
   e, quando a partida é um desafio, o.desafio = { selo (texto curto do topo: "DESAFIO DO DIA · 15 de nov. de 2026"), desc ("Blitz contra Vorag · Normal"),
   descs (opcional: versões mais curtas de desc, para quando a completa não cabe) }. */
async function resultado(o, fmt) { const K = tela(fmt); const x = K.x, W = K.W, H = K.H; const pe = K.c._fmt === 'pe'; const F = ARD.fim; const sim = o.sim, p = sim.players[o.human]; const cor = (o.cores && o.cores[p.faction]) || p.color || '#7FE3A1';
  await fontes();
  /* fundo: a cena da partida; sem ela (aparelho que não deixa copiar a tela), o degradê da marca */
  if (o.G && o.G.fimFoto && o.G.fimFotoOk) cobre(x, o.G.fimFoto, W, H); else fundoMarca(K);
  { const g = x.createLinearGradient(0, 0, 0, H); if (pe) { g.addColorStop(0, 'rgba(5,7,11,.78)'); g.addColorStop(0.17, 'rgba(5,7,11,.2)'); g.addColorStop(0.36, 'rgba(5,7,11,.34)'); g.addColorStop(0.6, 'rgba(5,7,11,.86)'); g.addColorStop(1, 'rgba(5,7,11,.97)'); } else { g.addColorStop(0, 'rgba(5,7,11,.62)'); g.addColorStop(0.22, 'rgba(5,7,11,.12)'); g.addColorStop(0.5, 'rgba(5,7,11,.3)'); g.addColorStop(0.8, 'rgba(5,7,11,.9)'); g.addColorStop(1, 'rgba(5,7,11,.96)'); } x.fillStyle = g; x.fillRect(0, 0, W, H); }
  const d = ARD.i18n && ARD.i18n.d; const man = String(F.manchete(o)).toUpperCase(); const linha = (T(o.venceu ? 'fim.vitoria' : 'fim.derrota') + ' · ' + mmss(o.tempo)).toUpperCase();
  const raca = (d ? d.racaCurto(p.faction) : p.faction).toUpperCase() + (o.lider && o.lider.nome ? ' · ' + o.lider.nome.toUpperCase() : ''); const ctx = o.desafio && o.desafio.desc ? o.desafio.desc : F.contexto(o);
  const ns = F.numeros(sim, o.human); const art = await imagem(o.lider && o.lider.art); const selo = o.desafio && o.desafio.selo ? String(o.desafio.selo).toUpperCase() : '';
  if (!pe) { const M = 48; marca(K, M, 78, 44);
    if (selo) texto(K, selo, W - M, 70, { id: 'selo', peso: '500', tam: 20, min: 13, fam: FM, max: 560, cor, alinha: 'dir', esp: 1.5, sombra: 6 }); else texto(K, T('fim.cartao.lema'), W - M, 70, { id: 'lema', peso: '500', tam: 18, min: 12, fam: FM, max: 560, cor: 'rgba(236,230,218,.85)', alinha: 'dir' });
    texto(K, linha, M, 352, { id: 'linha', peso: '500', tam: 22, min: 14, fam: FM, max: W - 2 * M, cor, esp: 3 });
    { x.font = '800 132px ' + FD; let tm = 132; for (; tm > 40; tm -= 2) { x.font = '800 ' + tm + 'px ' + FD; if (x.measureText(man).width <= W - 2 * M) break; } texto(K, man, M - 4, 352 + 24 + tm * 0.78, { id: 'manchete', peso: '800', tam: tm, min: 40, fam: FD, max: W - 2 * M, grad: o.venceu, cor: CLARO }); }
    const by = 498; retrato(K, art, 92, by + 56, 46, cor);
    texto(K, raca, 160, by + 50, { id: 'raca', peso: '700', tam: 38, min: 18, fam: FD, max: 440 }); texto(K, ctx, 160, by + 84, { id: 'contexto', peso: '500', tam: 22, min: 13, fam: FB, max: 440, cor: SUAVE, alt: o.desafio && o.desafio.desc ? o.desafio.descs : null });
    const x0 = 640, cw = (W - M - x0) / 3; ns.forEach((n, i) => { const cx = x0 + i * cw; texto(K, n.v, cx, by + 58, { id: 'num' + i, peso: '800', tam: 64, min: 24, fam: FD, max: cw - 16 }); texto(K, T('fim.n.' + n.k + '.curto', null, n.pt).toUpperCase(), cx, by + 86, { id: 'rot' + i, peso: '500', tam: 15, min: 10, fam: FM, max: cw - 16, cor, esp: 1.5 }); }); }
  else { const M = 64, L = W - 2 * M; marca(K, M, 118, 58); texto(K, T('fim.cartao.lema'), M, 156, { id: 'lema', peso: '500', tam: 21, min: 13, fam: FM, max: L, cor: 'rgba(236,230,218,.85)' });
    if (selo) { x.font = '500 24px ' + FM; const sw = Math.min(L - 36, largura(x, selo, 2)); x.fillStyle = 'rgba(5,7,11,.66)'; x.fillRect(M, 190, sw + 36, 50); x.fillStyle = cor; x.fillRect(M, 190, 5, 50); texto(K, selo, M + 20, 224, { id: 'selo', peso: '500', tam: 24, min: 14, fam: FM, max: L - 36, cor, esp: 2 }); }
    const temGraf = !!(o.G && o.G.hist && o.G.hist.t.length >= 3); const baseMan = temGraf ? H - 640 : H - 420; /* a manchete termina aqui; sem gráfico ela desce */
    const ls = duasLinhas(man); let tm = 190; x.font = '800 190px ' + FD; for (; tm > 60; tm -= 2) { x.font = '800 ' + tm + 'px ' + FD; if (ls.every(l => x.measureText(l).width <= L)) break; }
    const alt = tm * 0.86; texto(K, linha, M, baseMan - alt * ls.length - 26, { id: 'linha', peso: '500', tam: 26, min: 15, fam: FM, max: L, cor, esp: 3, sombra: 6 });
    ls.forEach((l, i) => texto(K, l, M - 4, baseMan - alt * (ls.length - 1 - i), { id: 'manchete' + i, peso: '800', tam: tm, min: 60, fam: FD, max: L, grad: o.venceu, cor: CLARO }));
    if (o.desafio && o.desafio.desc) texto(K, o.desafio.desc, M, baseMan + 48, { id: 'desafio', peso: '500', tam: 28, min: 15, fam: FB, max: L, cor: SUAVE, alt: o.desafio.descs });
    if (temGraf) { texto(K, T('fim.graf.titulo').toUpperCase(), M, H - 548, { id: 'graf-titulo', peso: '500', tam: 17, min: 11, fam: FM, max: L, cor: SUAVE, esp: 2 }); grafico(K, o, M + 12, H - 528, L - 24, 170, cor); }
    x.fillStyle = 'rgba(255,255,255,.16)'; x.fillRect(M, H - 322, L, 2);
    retrato(K, art, M + 58, H - 238, 56, cor); texto(K, raca, M + 136, H - 246, { id: 'raca', peso: '700', tam: 46, min: 20, fam: FD, max: L - 136 }); texto(K, o.desafio && o.desafio.desc ? F.contexto(o) : ctx, M + 136, H - 206, { id: 'contexto', peso: '500', tam: 25, min: 14, fam: FB, max: L - 136, cor: SUAVE });
    const cw = L / 3; ns.forEach((n, i) => { const cx = M + i * cw; texto(K, n.v, cx, H - 92, { id: 'num' + i, peso: '800', tam: 84, min: 28, fam: FD, max: cw - 20 }); texto(K, T('fim.n.' + n.k + '.curto', null, n.pt).toUpperCase(), cx, H - 56, { id: 'rot' + i, peso: '500', tam: 19, min: 11, fam: FM, max: cw - 20, cor, esp: 1.5 }); }); }
  return K.c; }

/* ---------- cartão de conquista ----------
   q: { nome, desc, cmd (nome do Comandante), nivel, n (conquistas que a pessoa tem), total, raca (para a cor), data (texto pronto, opcional) } */
function emblema(K, cx, cy, r, cor) { const x = K.x; const g = x.createLinearGradient(cx - r, cy - r, cx + r, cy + r); g.addColorStop(0, GRAD[0]); g.addColorStop(0.55, GRAD[1]); g.addColorStop(1, GRAD[2]);
  const halo = x.createRadialGradient(cx, cy, r * 0.2, cx, cy, r * 1.7); halo.addColorStop(0, 'rgba(193,60,245,.5)'); halo.addColorStop(0.55, 'rgba(255,94,58,.14)'); halo.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = halo; x.fillRect(cx - r * 1.8, cy - r * 1.8, r * 3.6, r * 3.6);
  x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fillStyle = '#0B0F15'; x.fill(); x.lineWidth = Math.max(6, r * 0.075); x.strokeStyle = g; x.stroke();
  x.beginPath(); x.arc(cx, cy, r * 0.8, 0, Math.PI * 2); x.lineWidth = 2; x.strokeStyle = 'rgba(255,255,255,.22)'; x.stroke();
  /* os cinco mundos em volta da Fenda (a figura é nossa: um rasgo de luz no meio e cinco pontos alinhados em arco) */
  for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i - 2) * 0.62; const px = cx + Math.cos(a) * r * 0.8, py = cy + Math.sin(a) * r * 0.8; x.beginPath(); x.arc(px, py, r * 0.058, 0, Math.PI * 2); x.fillStyle = i === 2 ? cor : '#ECE6DA'; x.fill(); }
  x.beginPath(); x.moveTo(cx, cy - r * 0.5); x.quadraticCurveTo(cx + r * 0.3, cy, cx, cy + r * 0.56); x.quadraticCurveTo(cx - r * 0.3, cy, cx, cy - r * 0.5); x.closePath(); x.fillStyle = g; x.fill();
  x.beginPath(); x.moveTo(cx, cy - r * 0.34); x.quadraticCurveTo(cx + r * 0.1, cy, cx, cy + r * 0.38); x.quadraticCurveTo(cx - r * 0.1, cy, cx, cy - r * 0.34); x.closePath(); x.fillStyle = '#fff'; x.fill();
 }
async function conquista(q, fmt) { const K = tela(fmt); const x = K.x, W = K.W, H = K.H; const pe = K.c._fmt === 'pe'; const cor = q.cor || '#FFB088'; await fontes();
  const hero = await imagem(ARD.ART && ARD.ART.hero); fundoMarca(K); if (hero) { x.globalAlpha = 0.3; cobre(x, hero, W, H); x.globalAlpha = 1; const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(5,7,11,.7)'); g.addColorStop(0.45, 'rgba(5,7,11,.35)'); g.addColorStop(1, 'rgba(5,7,11,.9)'); x.fillStyle = g; x.fillRect(0, 0, W, H); }
  const nome = String(q.nome || '').toUpperCase(); const rot = T('cartao.conq.rotulo').toUpperCase(); const quem = T('cartao.conq.quem', { nome: q.cmd || T('geral.comandante'), n: q.nivel || 1 }); const conta = T('cartao.conq.conta', { n: q.n || 1, total: q.total || 1 });
  if (!pe) { const M = 48; marca(K, M, 78, 44); texto(K, T('fim.cartao.lema'), W - M, 70, { id: 'lema', peso: '500', tam: 18, min: 12, fam: FM, max: 560, cor: 'rgba(236,230,218,.85)', alinha: 'dir' });
    emblema(K, 226, 338, 150, cor); const tx = 430, L = W - M - tx;
    const ls = quebra(x, nome, '800 96px ' + FD, L, 2); let tm = 96; for (; tm > 36; tm -= 2) { x.font = '800 ' + tm + 'px ' + FD; if (ls.every(l => x.measureText(l).width <= L)) break; }
    const ds = quebra(x, q.desc, '500 28px ' + FB, L, 3); const alt = tm * 0.9; const total = 34 + alt * ls.length + 16 + ds.length * 38; let y = 338 - total / 2 + 22;
    texto(K, rot, tx, y, { id: 'rotulo', peso: '500', tam: 22, min: 13, fam: FM, max: L, cor, esp: 3 }); y += 12;
    ls.forEach(l => { y += alt; texto(K, l, tx - 3, y, { id: 'nome', peso: '800', tam: tm, min: 36, fam: FD, max: L, grad: true }); }); y += 16;
    ds.forEach(l => { y += 38; texto(K, l, tx, y, { id: 'desc', peso: '500', tam: 28, min: 15, fam: FB, max: L, cor: CLARO }); });
    x.fillStyle = 'rgba(255,255,255,.16)'; x.fillRect(M, H - 86, W - 2 * M, 2);
    texto(K, quem, M, H - 44, { id: 'quem', peso: '700', tam: 30, min: 16, fam: FD, max: 640 }); texto(K, conta.toUpperCase(), W - M, H - 46, { id: 'conta', peso: '500', tam: 18, min: 12, fam: FM, max: 400, cor, alinha: 'dir', esp: 1.5 }); }
  else { const M = 64, L = W - 2 * M, cx = W / 2; marca(K, M, 118, 58); texto(K, T('fim.cartao.lema'), M, 156, { id: 'lema', peso: '500', tam: 21, min: 13, fam: FM, max: L, cor: 'rgba(236,230,218,.85)' });
    emblema(K, cx, 470, 196, cor);
    texto(K, rot, cx, 760, { id: 'rotulo', peso: '500', tam: 28, min: 15, fam: FM, max: L, cor, esp: 4, alinha: 'centro' });
    const ls = quebra(x, nome, '800 132px ' + FD, L, 2); let tm = 132; for (; tm > 44; tm -= 2) { x.font = '800 ' + tm + 'px ' + FD; if (ls.every(l => x.measureText(l).width <= L)) break; }
    let y = 790; const alt = tm * 0.9; ls.forEach(l => { y += alt; texto(K, l, cx, y, { id: 'nome', peso: '800', tam: tm, min: 44, fam: FD, max: L, grad: true, alinha: 'centro' }); }); y += 26;
    const ds = quebra(x, q.desc, '500 36px ' + FB, L - 80, 3); ds.forEach(l => { y += 48; texto(K, l, cx, y, { id: 'desc', peso: '500', tam: 36, min: 18, fam: FB, max: L - 80, cor: CLARO, alinha: 'centro' }); });
    x.fillStyle = 'rgba(255,255,255,.16)'; x.fillRect(M, H - 170, L, 2);
    texto(K, quem, cx, H - 108, { id: 'quem', peso: '700', tam: 40, min: 18, fam: FD, max: L, alinha: 'centro' }); texto(K, conta.toUpperCase(), cx, H - 62, { id: 'conta', peso: '500', tam: 21, min: 12, fam: FM, max: L, cor, alinha: 'centro', esp: 2 }); }
  return K.c; }

/* ---------- a janela do cartão (a mesma #cartao da 5.5a, agora com a escolha do tamanho) ---------- */
function paraBlob(c) { return new Promise(res => { try { c.toBlob(b => res(b), 'image/png'); } catch (e) { res(null); } }); }
let ABERTO = null; /* { desenha(fmt), nome(fmt), texto, titulo, fmt, url } */
function preferido() { try { const v = localStorage.getItem('ard-cartao-fmt'); if (FORMATOS[v]) return v; } catch (e) {} return (typeof innerWidth === 'number' && innerWidth < innerHeight) ? 'pe' : 'largo'; }
async function pinta() { const A = ABERTO; const box = $('cartao'); if (!A || !box) return; const img = $('cartao-img'); let c = null, blob = null; box.classList.add('fazendo');
  try { c = await A.desenha(A.fmt); blob = await paraBlob(c); } catch (e) { console.warn('[ARD] cartão:', e); }
  box.classList.remove('fazendo'); if (!c || ABERTO !== A) return; if (A.url) { try { URL.revokeObjectURL(A.url); } catch (e) {} }
  const nome = A.nome(A.fmt); const url = blob ? URL.createObjectURL(blob) : c.toDataURL('image/png'); A.url = blob ? url : null; A.canvas = c; img.src = url; img.width = c.width; img.height = c.height; img.dataset.fmt = A.fmt; box.dataset.fmt = A.fmt;
  const eb = box.querySelector('.eyebrow'); if (eb) eb.textContent = A.titulo || T('fim.cartao.titulo');
  const arq = blob && typeof File === 'function' ? new File([blob], nome, { type: 'image/png' }) : null; let podeEnviar = false; try { podeEnviar = !!(arq && navigator.canShare && navigator.canShare({ files: [arq] }) && navigator.share); } catch (e) {}
  const nota = t => { $('cartao-nota').textContent = t; };
  const be = $('cartao-enviar'); be.hidden = !podeEnviar; be.onclick = () => { navigator.share({ files: [arq], title: 'Aether Rift: Dominion', text: typeof A.texto === 'function' ? A.texto() : A.texto || '' }).catch(() => {}); };
  const bb = $('cartao-baixar'); bb.href = url; bb.download = nome; bb.classList.toggle('primary', !podeEnviar);
  const bc = $('cartao-copiar'); const podeCopiar = !!(blob && navigator.clipboard && navigator.clipboard.write && typeof ClipboardItem === 'function'); bc.hidden = !podeCopiar; bc.onclick = () => { navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]).then(() => nota(T('fim.cartao.copiado')), () => nota(T('fim.cartao.nao-copiou'))); };
  nota(T(podeEnviar ? 'fim.cartao.nota-enviar' : 'fim.cartao.nota-baixar'));
  box.querySelectorAll('[data-fmt-b]').forEach(b => { const on = b.dataset.fmtB === A.fmt; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); }); }
function rotulos() { const box = $('cartao'); if (!box) return; const l = box.querySelector('.cartao-fmt'); if (!l) return; l.setAttribute('aria-label', T('cartao.tamanho')); l.querySelector('[data-fmt-b=largo]').textContent = T('cartao.largo'); l.querySelector('[data-fmt-b=pe]').textContent = T('cartao.pe'); }
/* A: { desenha(fmt) → Promise<canvas>, nome(fmt) → nome do arquivo, texto (para o compartilhar do aparelho), titulo (opcional) } */
function abrir(A) { const box = $('cartao'); if (!box) return Promise.resolve(); let l = box.querySelector('.cartao-fmt');
  if (!l) { l = document.createElement('div'); l.className = 'cartao-fmt'; l.setAttribute('role', 'group'); l.innerHTML = '<button type="button" class="btn" data-fmt-b="largo"></button><button type="button" class="btn" data-fmt-b="pe"></button>'; const img = $('cartao-img'); img.before(l);
    l.addEventListener('click', e => { const b = e.target.closest('[data-fmt-b]'); if (!b || !ABERTO || ABERTO.fmt === b.dataset.fmtB) return; ABERTO.fmt = b.dataset.fmtB; try { localStorage.setItem('ard-cartao-fmt', ABERTO.fmt); } catch (e2) {} pinta(); }); }
  rotulos(); if (ABERTO && ABERTO.url) { try { URL.revokeObjectURL(ABERTO.url); } catch (e) {} }
  ABERTO = Object.assign({ fmt: preferido() }, A); $('cartao-fechar').onclick = () => { box.hidden = true; }; box.hidden = false; return pinta(); }
if (typeof window !== 'undefined') window.addEventListener('ard-idioma', () => { const box = $('cartao'); if (box && !box.hidden && ABERTO) { rotulos(); pinta(); } });

/* a conquista pronta para o cartão, pelo id (nome e descrição no idioma atual; Comandante, nível e contagem do ProgressStore) */
function dadosConquista(id) { const C = ARD.campaign, P = ARD.progress; if (!C) return null; const a = C.ACHIEVEMENTS.find(z => z.id === id); if (!a) return null; let s = null; try { s = P.load(); } catch (e) {}
  const fac = (document.documentElement.dataset.race) || 'vehnar'; const cores = { vehnar: '#FF7733', erevane: '#33FFD0', tessara: '#55E68A', quorith: '#B388FF', vorag: '#E6455A' };
  return { id, nome: C.conquista(id), desc: C.conquistaDesc(id), cmd: s && s.commander.name ? s.commander.name : '', nivel: s ? s.commander.level : 1, n: s ? Math.max(1, C.ACHIEVEMENTS.filter(z => s.achievements[z.id]).length) : 1, total: C.ACHIEVEMENTS.length, cor: cores[fac] || '#FFB088' }; }
function abrirConquista(id) { const q0 = dadosConquista(id); if (!q0) return Promise.resolve();
  return abrir({ titulo: T('cartao.conq.titulo'), desenha: fmt => conquista(dadosConquista(id) || q0, fmt), nome: fmt => 'aether-rift-dominion-conquista-' + id + '-' + FORMATOS[fmt].w + 'x' + FORMATOS[fmt].h + '.png', texto: () => { const q = dadosConquista(id) || q0; return T('cartao.conq.texto', { nome: q.nome }); } }); }
function abrirResultado(o) { return abrir({ desenha: fmt => resultado(o, fmt), nome: fmt => 'aether-rift-dominion-' + (o.venceu ? 'vitoria' : 'derrota') + '-' + FORMATOS[fmt].w + 'x' + FORMATOS[fmt].h + '.png', texto: () => (typeof o.textoLinha === 'function' ? o.textoLinha() : o.textoLinha) || T('fim.cartao.texto', { m: String(ARD.fim.manchete(o)) }) }); }

ARD.cartoes = { FORMATOS, resultado, conquista, abrir, abrirResultado, abrirConquista, dadosConquista, get aberto() { return ABERTO; } };
})(globalThis.ARD = globalThis.ARD || {});
