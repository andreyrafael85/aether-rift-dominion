/* Aether Rift: Dominion — pôster da Sala de Comando (5.0a.1). Um render da própria Sala por Raça e por tela (tools/sala-posteres.cjs: 2560×1440 e
   1920×1080 no computador, 390×844 e 844×390 em 3x no celular; WebP em assets/sala-<raça>-<tela>.webp, fora do bundle) aparece na hora como fundo
   da tela inicial: o download começa num script curto no topo de #start (src/index.tpl.html) e a imagem entra quando a vitrine já tem o layout final.
   No computador, a Sala ao vivo entra por cima num cruzamento suave, no mesmo enquadramento do pôster (src/m5/sala.js: casarPoster e deslizar).
   No celular, com movimento reduzido e sem a Sala, o pôster fica, nítido na densidade da tela, com um movimento leve em canvas 2D (as partículas do
   mundo, o redemoinho e o brilho da Fenda, a varredura do holograma) e a paralaxe da rolagem. Os dados de cada pôster (âncora do palco, câmera,
   planetas, holograma e Fenda na imagem) vêm de assets/sala-posteres.json, que o build embute como ARD.SALA_POSTERES. Só interface: nada aqui toca
   a simulação. */
(function (ARD) {
'use strict';
const RACES = ['vehnar', 'erevane', 'tessara', 'quorith', 'vorag'];
const COR = { vehnar: [255, 119, 51], erevane: [51, 255, 208], tessara: [85, 230, 138], quorith: [179, 136, 255], vorag: [230, 69, 90] };
/* partículas do ar de cada mundo (as mesmas da Sala: brasas, neve, esporos, pó de cristal e esporos vermelhos) */
const AR = { vehnar: { n: 46, cor: [255, 140, 60], vy: [-42, -18], sw: 10, r: [0.8, 2.2], brilho: 1 }, erevane: { n: 60, cor: [222, 244, 255], vy: [12, 30], sw: 16, r: [0.8, 2.2], brilho: 0.75 },
  tessara: { n: 40, cor: [157, 255, 138], vy: [-14, -5], sw: 14, r: [1.1, 2.8], brilho: 0.85 }, quorith: { n: 46, cor: [210, 180, 255], vy: [-8, 6], sw: 8, r: [0.6, 1.8], brilho: 1, pisca: true },
  vorag: { n: 40, cor: [255, 106, 90], vy: [-16, -6], sw: 12, r: [1, 2.6], brilho: 0.9 } };
const qs = () => new URLSearchParams(location.search);
const reduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
let P = null;
/* qual pôster esta tela recebe (a mesma regra do script no topo de #start, para não baixar dois) */
function celular() { return innerWidth < 700 || innerHeight < 560; }
function variante() { const w = innerWidth, h = innerHeight; return celular() ? (w < h ? 'pe' : 'deitado') : (w > 2000 || h > 1125 ? 'pc2560' : 'pc1920'); }
function url(race, v) { return 'assets/sala-' + race + '-' + v + '.webp'; }
function dados(v) { const M = ARD.SALA_POSTERES; return (M && M.variantes && M.variantes[v]) || null; }
function usar() { const q = qs(), f = q.get('fundo'); if (f === 'off' || f === 'classico' || q.get('poster') === '1' || q.get('autostart') || q.get('bench') || q.get('missao')) return false; return !!(ARD.SALA_POSTERES && ARD.SALA_POSTERES.variantes); }
/* a âncora do palco na página (a mesma conta de ancoraPalco em sala.js): o centro do busto e a altura útil do palco */
function palco() { const rol = P.host.scrollTop || 0; const b = document.getElementById('sc-bust'); const r = b && b.getBoundingClientRect();
  if (r && r.width > 0 && r.height > 0) { const sg = document.querySelector('.sc-stage'), rs = sg && sg.getBoundingClientRect(); const alto = rs && rs.width > 0 && rs.height > 0 ? rs.height : r.height;
    return { x: r.left + r.width / 2, y: r.top + rol + r.height * 0.56, ph: Math.max(r.height, Math.min(innerHeight * 0.62, alto)) }; }
  return { x: innerWidth * 0.32, y: innerHeight * 0.45, ph: innerHeight * 0.5 }; }
/* onde o pôster fica nesta tela: o palco do pôster sobre o palco da página, na escala em que o líder tem o tamanho que teria ao vivo, cobrindo a tela */
function conta(m) { const a = palco(), w = innerWidth, h = innerHeight; const R = (m.racas && m.racas[P.race]) || {}, anc = R.anc || m.anc || [m.w * 0.3, m.h * 0.45], ph = R.palcoH || m.palcoH;
  let s = ph && a.ph ? a.ph / ph : 1; s = Math.max(s, w / m.w, h / m.h);
  const tx = Math.min(0, Math.max(w - m.w * s, a.x - s * anc[0])), ty = Math.min(0, Math.max(h - m.h * s, a.y - s * anc[1])); return { s, tx, ty }; }
function aplicar() { if (!P || !P.m) return; P.T = conta(P.m); for (const im of [P.img, P.img2]) if (im) { im.style.width = P.m.w + 'px'; im.style.height = P.m.h + 'px'; } rolar(); }
/* rolagem: com a Sala por vir, o pôster sobe junto com o palco (como a Sala faz); como fundo final, sobe mais devagar que a página (paralaxe) */
function rolar() { if (!P || !P.T) return; const rol = Math.min(innerHeight * 0.6, P.host.scrollTop || 0); P.desl = P.final && !P.parado ? rol * 0.45 : rol; const T = P.T;
  const tf = 'translate3d(' + T.tx.toFixed(1) + 'px,' + (T.ty - P.desl).toFixed(1) + 'px,0) scale(' + T.s.toFixed(5) + ')'; for (const im of [P.img, P.img2]) if (im) im.style.transform = tf; }
/* ---------- montagem: chamada pela tela inicial (main.js) assim que a vitrine tem o layout final ---------- */
function mount(host, race) { if (P || !host || host.hidden || !usar()) return false; const el = document.getElementById('sala-poster'), img = document.getElementById('sala-poster-img'); if (!el || !img) return false;
  const v = variante(), m = dados(v); if (!m) return false; race = RACES.includes(race) ? race : 'vehnar';
  P = { host, el, img, img2: null, race, v, m, T: null, desl: 0, vis: false, final: false, parado: reduced(), on: [], t0: performance.now(), med: {} };
  const want = url(race, v); if (!img.getAttribute('src') || img.getAttribute('src') !== want) img.src = want; /* o script do topo já pediu esta mesma imagem (se a Raça ou a tela mudaram, pede a certa) */
  aplicar(); const st = P; const ok = () => { if (P !== st) return; st.med.decod = Math.round(performance.now()); mostrar(); }; const ruim = () => { if (P === st) falhar(); };
  if (img.complete && img.naturalWidth) (img.decode ? img.decode().then(ok, ok) : ok()); else { img.addEventListener('load', () => (img.decode ? img.decode().then(ok, ok) : ok()), { once: true }); img.addEventListener('error', ruim, { once: true }); }
  const on = (alvo, ev, f, o) => { alvo.addEventListener(ev, f, o); st.on.push([alvo, ev, f, o]); };
  let rt = 0; on(window, 'resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (P !== st) return; const v2 = variante(); if (v2 !== st.v && dados(v2)) trocar(st.race, v2); else aplicar(); if (st.fx) st.fx.medir(); }, 120); });
  on(host, 'scroll', rolar, { passive: true }); if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (P === st) aplicar(); });
  /* no celular, o pôster das outras Raças vem quando o jogador mostra interesse nas Raças (sem gastar dados antes) */
  const fc = document.getElementById('fac-cards'); if (fc) { let ja = false; const pre = () => { if (ja || P !== st) return; ja = true; for (const r of RACES) if (r !== st.race) { const im = new Image(); im.decoding = 'async'; im.src = url(r, st.v); } }; on(fc, 'pointerdown', pre, { passive: true }); on(fc, 'focusin', pre); }
  return true; }
function mostrar() { if (!P || P.vis) return; P.vis = true; P.el.hidden = false; P.host.classList.add('sala-poster'); void P.el.offsetWidth; P.el.classList.add('on'); P.med.visivel = Math.round(performance.now()); if (P.final) iniciarFx();
  else if (ARD.sala && ARD.sala.preparar) setTimeout(() => ARD.sala.preparar(), 0); } /* o pôster primeiro: só depois de ele aparecer o three WebGPU começa a carregar (a avaliação do módulo ocupa a linha principal) */
function falhar() { if (!P) return; const st = P; parar(); st.host.classList.remove('sala-poster'); if (ARD.uiStart && ARD.uiStart.salaPronta) try { ARD.uiStart.salaPronta(false); } catch (e) {} } /* sem pôster (arquivo faltando, sem rede): fica o retrato de antes */
/* troca de pôster (outra Raça ou a tela virou): a imagem nova entra por cima num esmaecer curto */
function trocar(race, v) { const st = P; if (!st) return; const m = dados(v); if (!m) return; const nova = url(race, v); st.race = race; if (st.v !== v) { st.v = v; st.m = m; }
  if (!st.vis || st.esc) { st.img.src = nova; aplicar(); return; } /* ainda escondido (ou a Sala já cobriu): só aponta para a certa */
  /* a nova entra sempre por cima (antes do canvas do movimento); quando termina de aparecer, a de baixo solta a imagem */
  const im = st.img2 || (st.img2 = Object.assign(document.createElement('img'), { alt: '', decoding: 'async' })); im.style.transition = 'none'; im.style.opacity = '0'; st.el.insertBefore(im, document.getElementById('poster-fx')); const gen = (st.gen = (st.gen || 0) + 1);
  const pronto = () => { if (P !== st || gen !== st.gen) return; aplicar(); void im.offsetWidth; im.style.transition = ''; requestAnimationFrame(() => { im.style.opacity = '1'; setTimeout(() => { if (P !== st || gen !== st.gen) return; const a = st.img; st.img = im; st.img2 = a; a.style.transition = 'none'; a.style.opacity = '0'; a.removeAttribute('src'); }, reduced() ? 0 : 450); }); };
  im.onload = () => (im.decode ? im.decode().then(pronto, pronto) : pronto()); im.src = nova; if (st.fx) st.fx.raca(race); }
function setRace(race) { if (!P || !RACES.includes(race) || race === P.race) return; if (P.esc) { P.race = race; return; } trocar(race, P.v); }
/* a Sala ao vivo cobriu o pôster (fim do cruzamento): ele sai e solta a imagem */
function esconder() { if (!P) return; P.esc = true; pararFx(); P.el.classList.remove('on'); P.host.classList.remove('sala-poster'); const st = P; setTimeout(() => { if (P !== st || !st.esc) return; st.el.hidden = true; for (const im of [st.img, st.img2]) if (im) im.removeAttribute('src'); }, 400); }
/* sem a Sala (celular, movimento reduzido, GPU por software, ou ela não subiu): o pôster fica como fundo, com o movimento leve */
function final() { if (!P || P.esc) return false; P.final = true; P.parado = reduced() || (!!ARD.gpuSoft && qs().get('fundo') !== 'fx'); P.host.classList.add('poster-final'); rolar(); if (P.vis) iniciarFx(); return true; }
function parar() { const st = P; if (!st) return; P = null; pararFx(st); for (const [a, ev, f, o] of st.on) a.removeEventListener(ev, f, o); st.el.classList.remove('on'); st.el.hidden = true; st.host.classList.remove('sala-poster', 'poster-final'); for (const im of [st.img, st.img2]) if (im) im.removeAttribute('src'); }
/* ---------- movimento leve em canvas 2D (fundo final): partículas do mundo, o redemoinho e o brilho da Fenda, a varredura do holograma ---------- */
function iniciarFx() { if (!P || P.fx || P.parado || !P.final) return; const cv = document.getElementById('poster-fx'); if (!cv || !cv.getContext) return; P.fx = criarFx(cv); }
function pararFx(st) { st = st || P; if (st && st.fx) { st.fx.parar(); st.fx = null; } }
function criarFx(cv) { const st = P, c = cv.getContext('2d'); let w = 0, h = 0, k = 1, raf = 0, ult = 0, vivo = true, corpo = [], fenda = [], race = st.race; const spr = {};
  const brilho = rgb => { const key = rgb.join(','); if (spr[key]) return spr[key]; const s = document.createElement('canvas'); s.width = s.height = 32; const g = s.getContext('2d'); const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.18, 'rgba(' + key + ',0.95)'); gr.addColorStop(0.5, 'rgba(' + key + ',0.28)'); gr.addColorStop(1, 'rgba(' + key + ',0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); return (spr[key] = s); };
  let sd = 7; const rnd = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
  const medir = () => { k = Math.min(2, window.devicePixelRatio || 1); w = innerWidth; h = innerHeight; cv.width = Math.round(w * k); cv.height = Math.round(h * k); };
  const novo = (A, p, topo) => { p.x = rnd() * w; p.y = topo ? (A.vy[0] > 0 ? -10 : h + 10) : h * (0.15 + rnd() * 0.85); p.vy = A.vy[0] + rnd() * (A.vy[1] - A.vy[0]); p.r = A.r[0] + rnd() * (A.r[1] - A.r[0]); p.f = rnd() * 6.28; p.a = 0.35 + rnd() * 0.65; return p; };
  const semear = () => { const A = AR[race] || AR.vehnar; const n = Math.round(A.n * Math.min(1.3, Math.max(0.6, w * h / (390 * 844)))); corpo = []; for (let i = 0; i < n; i++) corpo.push(novo(A, {}, false)); fenda = []; for (let i = 0; i < 26; i++) fenda.push({ t: rnd(), a: rnd() * 6.28, r: 0.4 + rnd() * 0.6, v: 0.18 + rnd() * 0.2 }); };
  const tela = (q, ox, oy) => { const T = st.T || { s: 1, tx: 0, ty: 0 }; return [T.s * q[0] + T.tx + (ox || 0), T.s * q[1] + T.ty - (st.desl || 0) + (oy || 0)]; };
  const quadro = now => { if (!vivo) return; raf = requestAnimationFrame(quadro); if (document.hidden || st.host.hidden || now - ult < 33) return; const dt = Math.min(0.05, (now - ult) / 1000 || 0.033); ult = now; const t = now / 1000;
    const A = AR[race] || AR.vehnar, R = st.m && st.m.racas && st.m.racas[race], FX = R && R.fx, cor = COR[race] || COR.vehnar, s = (st.T && st.T.s) || 1;
    c.setTransform(k, 0, 0, k, 0, 0); c.clearRect(0, 0, w, h); c.globalCompositeOperation = 'lighter';
    /* a Fenda respira e o redemoinho sobe dela */
    if (FX && FX.fenda) { const [fx, fy] = tela(FX.fenda); const pul = 0.75 + 0.25 * Math.sin(t * 1.3), rg = 70 * s; const g = c.createRadialGradient(fx, fy, 0, fx, fy, rg); g.addColorStop(0, 'rgba(255,90,200,' + (0.2 * pul).toFixed(3) + ')'); g.addColorStop(0.5, 'rgba(178,60,255,' + (0.08 * pul).toFixed(3) + ')'); g.addColorStop(1, 'rgba(178,60,255,0)'); c.fillStyle = g; c.fillRect(fx - rg, fy - rg, rg * 2, rg * 2);
      for (const p of fenda) { p.t += dt * p.v; if (p.t > 1) { p.t -= 1; p.a = rnd() * 6.28; } const alt = p.t * 150 * s, raio = (8 + 26 * p.t) * s * p.r, an = p.a + t * 1.6 + p.t * 5; const x = fx + Math.cos(an) * raio, y = fy - alt + Math.sin(an) * raio * 0.3; const mix = Math.min(1, p.t * 1.6);
        const rgb = [Math.round(255 - 144 * mix), Math.round(63 + 170 * mix), Math.round(184 + 71 * mix)]; c.globalAlpha = Math.sin(p.t * Math.PI) * 0.9; const z = (2.2 + 1.6 * (1 - p.t)) * Math.max(0.7, s); c.drawImage(brilho(rgb), x - z * 2, y - z * 2, z * 4, z * 4); } }
    /* a varredura do holograma: uma faixa na cor da Raça sobe pelo busto, com uma cintilação curta */
    if (FX && FX.holo) { const [hx, hy] = tela([FX.holo[0], FX.holo[1]]), hw = FX.holo[2] * s, hh = FX.holo[3] * s; const ciclo = (t % 4.6) / 2.4; if (ciclo < 1) { const y = hy + hh * (1 - ciclo); const g = c.createLinearGradient(0, y - hh * 0.12, 0, y + hh * 0.05);
        g.addColorStop(0, 'rgba(' + cor.join(',') + ',0)'); g.addColorStop(0.75, 'rgba(' + cor.join(',') + ',' + (0.22 * Math.sin(ciclo * Math.PI)).toFixed(3) + ')'); g.addColorStop(1, 'rgba(' + cor.join(',') + ',0)'); c.globalAlpha = 1; c.fillStyle = g; c.fillRect(hx + hw * 0.12, y - hh * 0.12, hw * 0.76, hh * 0.17); }
      if (Math.sin(t * 23.0) * Math.sin(t * 7.1) > 0.93) { c.globalAlpha = 0.05; c.fillStyle = 'rgb(' + cor.join(',') + ')'; c.fillRect(hx + hw * 0.15, hy, hw * 0.7, hh); } }
    /* o ar do mundo */
    const img = brilho(A.cor); for (const p of corpo) { p.y += p.vy * dt; p.f += dt * 0.9; const x = p.x + Math.sin(p.f) * A.sw; if (p.y < -12 || p.y > h + 12) novo(A, p, true);
      const piscar = A.pisca ? 0.35 + 0.65 * Math.abs(Math.sin(p.f * 2.3)) : 0.75 + 0.25 * Math.sin(p.f * 3.1); c.globalAlpha = Math.min(1, p.a * piscar * A.brilho); const z = p.r * 2.2; c.drawImage(img, x - z, p.y - z, z * 2, z * 2); }
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; };
  medir(); semear(); cv.dataset.on = '1'; raf = requestAnimationFrame(quadro);
  return { medir: () => { medir(); semear(); }, raca: r => { race = r; semear(); }, parar: () => { vivo = false; cancelAnimationFrame(raf); cv.dataset.on = '0'; c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, cv.width, cv.height); } }; }
/* para a Sala casar o primeiro quadro com o pôster: a Raça, os dados do render e onde ele está na tela */
function estado() { if (!P || !P.vis || P.esc || !P.T || !P.m) return null; return { race: P.race, v: P.v, meta: P.m, s: P.T.s, tx: P.T.tx, ty: P.T.ty }; }
ARD.salaPoster = { mount, setRace, esconder, final, parar, estado, variante, url, ativo: () => !!P, visivel: () => !!(P && P.vis && !P.esc), info: () => P ? { race: P.race, v: P.v, vis: P.vis, final: P.final, parado: P.parado, fx: !!P.fx, T: P.T, tempos: Object.assign({}, P.med) } : null };
})(globalThis.ARD = globalThis.ARD || {});
