// Vitrine do GitHub (5.0h.2): refaz as imagens de docs/imagens/ em alta qualidade, com o jogo de verdade, num comando só.
//   NODE_PATH=<pasta com node_modules/playwright> node tools/vitrine.cjs [--so=galeria,compartilhar,fotos,batalha] [opções]
// Partes (--so=, separadas por vírgula; sem --so, todas menos chefoes e sonda):
//   galeria       cada unidade e construção das cinco Raças (tools/galeria.cjs, 2× com supersampling)
//   fotos         telas do README: inicio-pc, partida-pc, batalha-pc (1920×1080) e inicio-celular, partida-celular (780×1688), cada uma em
//                 inglês (o nome-base), .pt-BR.jpg e .es.jpg, com as cenas fixas de FOTOS (sem sonda; ~40 min) e o hash da partida conferido
//                 entre os idiomas
//   batalha       a animação do topo do README (partida/batalha.webp) e, com ffmpeg, o vídeo em 1080p (dist/vitrine/batalha-1080p.mp4)
//   compartilhar  a imagem de compartilhamento (compartilhar.jpg em inglês, .pt-BR.jpg e .es.jpg, 2560×1280) a partir das artes do jogo
//                 (tools/vitrine-compartilhar.html)
//   chefoes       galeria dos chefões (docs/imagens/chefoes/) e a animação partida/chefao.webp (rodar depois da junção dos modelos novos)
//   sonda         só a linha do tempo da partida da batalha (lutas, Raças, aéreos, superarmas), sem desenhar: para escolher a cena
//   conferir      docs-gerar --conferir, links relativos dos .md, as 6 imagens com texto nos 3 idiomas, orçamento (30 MB; batalha.webp
//                 10 MB) e as imagens sem usuário, máquina nem caminho
// Como sai nítido (a causa do pixelado da 5.0h.1 está em .wip/.../i-vitrine/work/RELATORIO.md):
//   - qualidade Ultra forçada (?q=ultra): a automática cai na Baixa numa GPU por software (sem sombras, sem pós, sem AO, sem MSAA, 1×);
//   - deviceScaleFactor 2 (o jogo desenha o canvas no dobro) e redução com Lanczos (Pillow) para o tamanho final: supersampling;
//   - relógio virtual: performance.now e requestAnimationFrame da página passam a andar só quando a ferramenta manda, um quadro de
//     1/FPS s por vez, pelo laço do próprio jogo (simulação, interpolação, efeitos, cinema); cada quadro sai inteiro, por mais lenta que
//     seja a GPU, e a animação toca no tempo real do jogo;
//   - quadros em PNG (sem perda) até a montagem; WebP animado com qualidade alta no fim.
// Opções: --porta=0 (servidor HTTP próprio da raiz, como o GitHub Pages) · --fps=20 · --rapido (menos quadros e menor, para testar)
//   --dur=4.5,3.75,3.75 (segundos de cada tomada; com --dur a saída vai para dist/vitrine/batalha-teste.webp) · --largura=880 --qualidade=76 --mb=9.8
//   --semente=9 --dif=dificil (a partida da batalha) · --sonda-pronta (reaproveita dist/vitrine/sonda.json) · --fotos=inicio-pc,partida-pc,... --idiomas=en,pt,es --previa
//   --saida=<pasta> (chefoes: grava fora de docs/imagens, para testar)
//   --cenas=<json> (tomadas da batalha à mão; o padrão escolhe sozinho pela sonda) · --motor=classico|5 (padrão classico: ver o relatório)
// Saídas intermediárias em dist/vitrine/ (ignorado pelo git). Um navegador por vez. Precisa de python3 com Pillow; ffmpeg é opcional
// (PATH, imageio-ffmpeg do pip --user, ou o do Playwright para WebM).
'use strict';
const path = require('path'); const fs = require('fs'); const http = require('http'); const cp = require('child_process');
const root = path.resolve(__dirname, '..');
const { chromium, devices } = require('playwright');
const ARGV = process.argv.slice(2); const opt = (k, d) => { const a = ARGV.find(x => x === '--' + k || x.startsWith('--' + k + '=')); return a == null ? d : a.includes('=') ? a.slice(k.length + 3) : true; };
const SO = String(opt('so', 'galeria,compartilhar,fotos,batalha,conferir')).split(',');
const FPS = +opt('fps', 20); /* 20 quadros/s: 12 s cabem em ~10 MB de WebP animado com qualidade alta */ const RAPIDO = !!opt('rapido', false); const MOTOR = opt('motor', 'classico');
const TMP = root + '/dist/vitrine'; fs.mkdirSync(TMP, { recursive: true });
const IMG = root + '/docs/imagens'; const OUTP = IMG + '/partida';
const t00 = Date.now(); const log = (...a) => console.log('[vitrine ' + ((Date.now() - t00) / 1000).toFixed(0).padStart(5) + ' s]', ...a);
const ARGS = ['--no-sandbox', '--font-render-hinting=none', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage', '--hide-scrollbars', '--mute-audio'];
const ARGS_M5 = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-webgpu-adapter=swiftshader'];

/* ---------- servidor estático da raiz (como o Pages: sem file://) ---------- */
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.opus': 'audio/ogg', '.m4a': 'audio/mp4', '.wav': 'audio/wav', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.wasm': 'application/wasm' };
function servidor() {
  return new Promise(res => { const s = http.createServer((q, r) => { let u = decodeURIComponent(q.url.split('?')[0]); if (u.endsWith('/')) u += 'index.html'; const f = path.join(root, path.normalize(u)); if (!f.startsWith(root + path.sep) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' }); fs.createReadStream(f).pipe(r); });
    s.listen(+opt('porta', 0), '127.0.0.1', () => res({ s, base: 'http://127.0.0.1:' + s.address().port + '/' })); });
}

/* ---------- relógio virtual (entra antes de qualquer script da página) ---------- */
const RELOGIO = `(() => { const rp = performance.now.bind(performance), rRAF = window.requestAnimationFrame.bind(window), rCAF = window.cancelAnimationFrame.bind(window);
  const V = window.__vt = { on: false, now: 0, q: [], id: 1 };
  performance.now = () => (V.on ? V.now : rp());
  window.requestAnimationFrame = f => { if (!V.on) return rRAF(f); const id = V.id++; V.q.push([id, f]); return -id; };
  window.cancelAnimationFrame = id => { if (id < 0) V.q = V.q.filter(x => x[0] !== -id); else rCAF(id); };
  V.ligar = () => { if (!V.on) { V.now = rp() + 50; V.on = true; } };
  V.passo = ms => { V.now += ms; const q = V.q; V.q = []; for (const [, f] of q) { try { f(V.now); } catch (e) { console.error('[vitrine] quadro: ' + e.message); } } return q.length; };
})();`;

async function abrir(b, url, ctxOpts) {
  const ctx = await b.newContext(Object.assign({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block', locale: 'pt-BR' }, ctxOpts || {}));
  await ctx.addInitScript(RELOGIO); const p = await ctx.newPage(); p.setDefaultTimeout(1800000); const errs = [];
  p.on('crash', () => log('a página caiu (crash do renderizador)')); p.on('pageerror', e => errs.push(e.message.slice(0, 200)));
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
  await p.goto(url, { waitUntil: 'load', timeout: 300000 }); return { ctx, p, errs };
}
const esperaPartida = p => p.waitForFunction(() => { const l = document.getElementById('loading'); return l && l.hidden && window.__ARDG && window.__ARDG.sim && window.__ARDG.R; }, null, { timeout: 900000, polling: 1000 });
const URLP = (o) => '?' + Object.entries(Object.assign({ semsalvar: 1, debug: 1, lang: 'pt', q: 'ultra' }, MOTOR === '5' ? { motor: 5 } : {}, o)).filter(([, v]) => v != null && v !== false).map(([k, v]) => k + '=' + encodeURIComponent(v)).join('&');

/* corre a partida à frente sem desenhar (o relógio virtual parado: nenhum quadro), com o tique do jogo: IA de 1 s em 1 s e a simulação.
   sonda: guarda, de 1 em 1 s de jogo, a maior luta (centro, unidades, Raças, aéreos) e as superarmas */
const AVANCA = ([ate, sonda, cond]) => { const G = window.__ARDG, S = ARD.sim, sim = G.sim; const t0 = Date.now(); const out = window.__sonda = window.__sonda || { lutas: [], supers: [], eras: [] };
  while (sim.time < ate && Date.now() - t0 < 4000) { /* Date.now: o performance.now da página é o relógio virtual (parado aqui) */
    if (sim.tick % 10 === 0) for (const a of G.ais) for (const c of ARD.ai.think(sim, a)) S.enqueue(sim, c);
    const ev = S.step(sim);
    if (cond && sim.tick % 10 === 0 && Function('sim', 'S', cond)(sim, S)) return { t: sim.time, ok: true, fim: true };
    if (sonda) { for (const e of ev) if (e.t === 'super') out.supers.push({ t: +sim.time.toFixed(1), p: e.p, kind: e.kind, x: e.x, y: e.y, fac: sim.players[e.p].faction });
      if (sim.tick % 10 === 0) { const C = 320, cel = new Map();
        for (const u of sim.ents) { if (!u.alive || u.kind !== 'unit' || u.target == null || u.cls === 'civ') continue; const t = sim.byId.get(u.target); if (!t || !t.alive || S.dist(u.x, u.y, t.x, t.y) > 300) continue;
          const k = Math.floor(u.x / C) + ',' + Math.floor(u.y / C); let c = cel.get(k); if (!c) cel.set(k, c = { n: 0, x: 0, y: 0, ar: 0, fac: new Set(), own: new Set() }); c.n++; c.x += u.x; c.y += u.y; if (S.UNITS[u.def] && S.UNITS[u.def].flying) c.ar++; c.fac.add(sim.players[u.owner].faction); c.own.add(u.owner); }
        let best = null; for (const c of cel.values()) if (!best || c.n > best.n) best = c;
        if (best && best.n >= 8) out.lutas.push({ t: Math.round(sim.time), n: best.n, ar: best.ar, x: Math.round(best.x / best.n), y: Math.round(best.y / best.n), fac: [...best.fac].join('+'), own: [...best.own].join('+') });
        if (sim.tick % 600 === 0) out.eras.push({ t: Math.round(sim.time), eras: sim.players.map(p => p.alive ? (p.era || 1) : 0).join(''), exe: sim.players.map(p => p.alive ? Math.round(S.armyValue(sim, p.id)) : 0).join('/') }); } } }
  return { t: sim.time, fim: sim.time >= ate || !!G.ended }; };
async function avanca(p, ate, sonda, cond) { for (;;) { const r = await p.evaluate(AVANCA, [ate, !!sonda, cond || null]); if (r.fim) return r; } }

/* um quadro do jogo (1/FPS s pelo relógio virtual) com a câmera pedida; devolve o PNG do mapa (canvas 3D + barras) se foto */
async function quadro(p, cam, foto) {
  await p.waitForFunction(() => !window.__vt.on || window.__vt.q.length > 0, null, { polling: 20, timeout: 600000 }); /* o laço do jogo já pediu o quadro (logo depois de ligar o relógio, o pedido ainda está no rAF de verdade) */
  return p.evaluate(([cam, foto, ms]) => { const G = window.__ARDG; if (cam) Object.assign(G.view.cam, cam, cam.pitch != null ? { pitchT: cam.pitch } : {});
    window.__vt.passo(ms); if (!foto) return null;
    const w = document.getElementById('world'), o = document.getElementById('overlay'); const c = document.createElement('canvas'); c.width = w.width; c.height = w.height; const g = c.getContext('2d'); g.drawImage(w, 0, 0); if (foto === 'barras' && o && o.width) g.drawImage(o, 0, 0, c.width, c.height);
    return c.toDataURL('image/png'); }, [cam || null, foto || false, 1000 / FPS]).then(u => (u ? Buffer.from(u.split(',')[1], 'base64') : null));
}


/* ---------- Pillow (tools/vitrine-img.py) e ffmpeg ---------- */
function img(cmd, ...a) { const r = cp.spawnSync('python3', ['-I', root + '/tools/vitrine-img.py', cmd, ...a.map(String)], { encoding: 'utf8', maxBuffer: 1 << 26 }); if (r.status !== 0) throw new Error('vitrine-img ' + cmd + ': ' + (r.stderr || '').slice(-600)); return r.stdout.trim(); }
function reduz(lista) { const f = TMP + '/reduzir.json'; fs.writeFileSync(f, JSON.stringify(lista)); return img('reduz', f); }
function ffmpeg() { /* 1º o do PATH, 2º o do imageio-ffmpeg (pip install --user imageio-ffmpeg), com H.264 */
  for (const c of ['ffmpeg']) { const r = cp.spawnSync(c, ['-hide_banner', '-encoders'], { encoding: 'utf8' }); if (r.status === 0 && /libx264/.test(r.stdout)) return c; }
  const r = cp.spawnSync('python3', ['-c', 'import imageio_ffmpeg as f; print(f.get_ffmpeg_exe())'], { encoding: 'utf8' }); return r.status === 0 ? r.stdout.trim() : null; }
const FOTO_PNG = { type: 'png', timeout: 1800000, animations: 'disabled', caret: 'hide' };

/* ---------- a partida: sonda (linha do tempo) ---------- */
/* a partida da batalha: quatro Raças (Vehnar com a IA no comando, contra Erevane, Tessara e Quorith), Brutal, mapa revelado e dia fixo; sem as
   cenas de cinema (elas pausam a partida solo e levam a câmera) */
const CENA = { url: { autostart: 1, faction: 'vehnar', opp: 3, diff: opt('dif', 'dificil'), seed: +opt('semente', 9), ia: 'todos', mundo: 1, cmd: 1, semcine: 1, cenas: 0, dia: 1, reveal: 1 } }; /* semente 9 na Difícil (5.0h.1): guerra de 300 a 480 s com aéreos e a Fundição Orbital Vehnar aos 527 s */
async function sonda(b, base) {
  const ate = +opt('ate', 600); const { ctx, p, errs } = await abrir(b, base + URLP(CENA.url), { viewport: { width: 640, height: 360 } }); await esperaPartida(p);
  await p.evaluate(() => window.__vt.ligar());
  let r; for (let t = 120; ; t += 120) { r = await avanca(p, Math.min(t, ate), true); log('sonda:', r.t.toFixed(0), 's de jogo'); if (r.t >= ate || r.ok || t >= ate) break; }
  const s = await p.evaluate(() => ({ lutas: window.__sonda.lutas, supers: window.__sonda.supers, eras: window.__sonda.eras, jog: window.__ARDG.sim.players.map(q => q.faction + (q.alive ? '' : '†')), fim: !!window.__ARDG.ended }));
  s.cena = CENA; fs.writeFileSync(TMP + '/sonda.json', JSON.stringify(s));
  log('sonda até', r.t.toFixed(0), 's:', s.jog.join(' '), '| lutas', s.lutas.length, '| superarmas', s.supers.map(x => x.fac + ' ' + x.kind + ' ' + x.t).join(', ') || 'nenhuma', '| erros', errs.join(' ; ') || 'nenhum');
  for (const e of s.eras) log('   t', e.t, 'eras', e.eras, 'exércitos', e.exe);
  await ctx.close(); return s;
}
/* escolhe as tomadas: a janela de 6 s com a maior guerra (unidades em luta, Raças, aéreos) para a vista ampla, a melhor outra janela com
   aéreos para o impacto de perto e a superarma (de preferência a Fundição Orbital, que cai do céu) para a base */
function escolher(s) {
  const L = new Map(s.lutas.map(l => [l.t, l])); const sc = l => (l ? l.n + 5 * l.ar + 14 * (l.fac.split('+').length - 1) : 0);
  const jan = []; for (const l of s.lutas) { let tot = 0, ok = 0; for (let k = 0; k < 6; k++) { const m = L.get(l.t + k); if (m && Math.hypot(m.x - l.x, m.y - l.y) < 500) { tot += sc(m); ok++; } } if (ok >= 5) jan.push({ t: l.t, sc: tot / 6, l }); }
  jan.sort((a, b) => b.sc - a.sc); if (!jan.length) throw new Error('a sonda não achou luta grande; tente outra --semente');
  const A = jan[0]; const B = jan.find(j => Math.abs(j.t - A.t) >= 20 && j.l.fac.split('+').sort().join() !== A.l.fac.split('+').sort().join()) || jan.find(j => Math.abs(j.t - A.t) >= 12) || A; /* o impacto de perto em outra luta, de preferência de outras Raças */
  const sup = s.supers.find(x => x.kind === 'fundicao') || s.supers.find(x => x.x != null) || null;
  const D = opt('dur') ? String(opt('dur')).split(',').map(Number) : RAPIDO ? [1.5, 1.5, 1.5] : [4.5, 3.75, 3.75]; while (D.length < 3) D.push(D[D.length - 1]);
  const tomadas = [{ nome: 'ampla', t0: A.t + 0.5, dur: D[0], x: A.l.x, y: A.l.y, info: A.l }, { nome: 'perto', t0: B.t + (B === A ? 3 : 0.5), dur: D[1], x: B.l.x, y: B.l.y, info: B.l }];
  if (sup) tomadas.push({ nome: 'base', t0: Math.max(5, sup.t - 1.2), dur: D[2], x: sup.x, y: sup.y, sup: sup.kind, info: sup });
  else { const C = jan.find(j => Math.abs(j.t - A.t) >= 20 && Math.abs(j.t - B.t) >= 20) || A; tomadas.push({ nome: 'base', t0: C.t + 1, dur: D[2], x: C.l.x, y: C.l.y, info: C.l }); }
  return tomadas;
}

/* câmera de cada tomada (no quadro da página): segue o centro da luta (média das unidades em combate perto do centro, suavizada); a base mais
   perto fica ao fundo (a câmera do lado de lá da luta); ampla = alta e larga, perto = baixa e fechada, base = órbita lenta e baixa */
const CAMERA = ([tm, u, ini]) => { const G = window.__ARDG, S = ARD.sim, sim = G.sim; const K = window.__camK = ini ? { x: tm.x, y: tm.y } : (window.__camK || { x: tm.x, y: tm.y });
  if (tm.nome !== 'base') { let x = 0, y = 0, n = 0; for (const e of sim.ents) { if (!e.alive || e.kind !== 'unit' || e.target == null || e.cls === 'civ') continue; if (Math.hypot(e.x - K.x, e.y - K.y) > 420) continue; const t = sim.byId.get(e.target); if (!t || !t.alive) continue; x += e.x; y += e.y; n++; }
    if (n >= 3) { const a = ini ? 1 : 0.06; K.x += (x / n - K.x) * a; K.y += (y / n - K.y) * a; } }
  if (ini) { let best = null, bd = 1e9; for (const e of sim.ents) if (e.alive && e.kind === 'building' && e.def === 'nucleo') { const d = Math.hypot(e.x - K.x, e.y - K.y); if (d < bd) { bd = d; best = e; } }
    let ux = 0.6, uy = 0.8; if (best && bd > 60) { ux = (K.x - best.x) / bd; uy = (K.y - best.y) / bd; } K.yaw0 = Math.atan2(ux, -uy); if (tm.nome === 'base') K.yaw0 += 0.9; }
  const ease = v => v * v * (3 - 2 * v); const e = ease(u);
  const P = tm.nome === 'ampla' ? { z: 1.3 + 0.3 * e, p: 0.48 - 0.1 * e, w: -0.2 + 0.34 * e } : tm.nome === 'perto' ? { z: 2.6 + 0.4 * e, p: 0.32 - 0.05 * e, w: 0.12 - 0.22 * e } : { z: 1.5 + 0.3 * e, p: 0.42 - 0.08 * e, w: -0.35 + 0.7 * u };
  return { x: K.x, y: K.y, zoom: P.z, pitch: P.p, yaw: K.yaw0 + P.w }; };

async function batalha(b, base) {
  let tomadas; const cj = opt('cenas', null);
  if (cj) tomadas = JSON.parse(fs.readFileSync(cj, 'utf8')); else { const s = (opt('sonda-pronta') && fs.existsSync(TMP + '/sonda.json')) ? JSON.parse(fs.readFileSync(TMP + '/sonda.json', 'utf8')) : await sonda(b, base); tomadas = escolher(s); }
  fs.writeFileSync(TMP + '/tomadas.json', JSON.stringify(tomadas, null, 1)); log('tomadas:', tomadas.map(t => t.nome + ' t=' + t.t0 + ' s (' + t.dur + ' s) em ' + Math.round(t.x) + ',' + Math.round(t.y) + (t.sup ? ' superarma ' + t.sup : '')).join(' | '));
  const W = RAPIDO ? 640 : 1280, H = RAPIDO ? 360 : 720, DSF = RAPIDO ? 1 : 1.5; /* 1280×720 CSS a 1,5×: o canvas em 1920×1080 com MSAA */
  const { ctx, p, errs } = await abrir(b, base + URLP(CENA.url), { viewport: { width: W, height: H }, deviceScaleFactor: DSF }); await esperaPartida(p);
  await p.addStyleTag({ content: 'body *{visibility:hidden!important}#world{visibility:visible!important}' }); /* só o mapa (o canvas 3D), sem o HUD nem as barras */
  await p.evaluate(() => { window.__vt.ligar(); if (ARD.hud3 && ARD.hud3.view) ARD.hud3.view.foes = false; }); /* sem os anéis vermelhos sob os inimigos (o ajuste "Destacar inimigos" desligado): a cena limpa */
  const dir = TMP + '/batalha'; fs.rmSync(dir, { recursive: true, force: true });
  const ordem = tomadas.map((t, i) => Object.assign({ i }, t)).sort((a, b) => a.t0 - b.t0);
  for (const tm of ordem) {
    const AQ = Math.round(FPS * 0.6); const r = await avanca(p, tm.t0 - AQ / FPS); log(tm.nome + ': partida em', r.t.toFixed(1), 's; aquecendo');
    const N = Math.round(tm.dur * FPS); const d = dir + '/' + tm.i + '-' + tm.nome; fs.mkdirSync(d, { recursive: true }); const tq = Date.now();
    for (let k = -AQ; k < N; k++) { const cam = await p.evaluate(CAMERA, [tm, Math.max(0, k) / Math.max(1, N - 1), k === -AQ]); const png = await quadro(p, cam, k >= 0 ? 'mapa' : false);
      if (png) fs.writeFileSync(d + '/' + String(k).padStart(4, '0') + '.png', png); if (k === 0 || (k >= 0 && (k + 1) % 24 === 0)) log(tm.nome + ':', (k + 1) + '/' + N, ((Date.now() - tq) / 1000 / (k + AQ + 1)).toFixed(1) + ' s por quadro'); }
  }
  log('batalha: erros da página', errs.join(' ; ') || 'nenhum'); await ctx.close();
  /* montagem na ordem da edição: ampla → perto → base */
  const todos = dir + '/todos'; fs.mkdirSync(todos, { recursive: true }); let n = 0;
  for (let i = 0; i < tomadas.length; i++) { const d = dir + '/' + i + '-' + tomadas[i].nome; for (const f of fs.readdirSync(d).filter(f => f.endsWith('.png')).sort()) fs.copyFileSync(d + '/' + f, todos + '/' + String(n++).padStart(5, '0') + '.png'); }
  const ms = Math.round(1000 / FPS); const larg = +opt('largura', RAPIDO ? 640 : 880); let q = +opt('qualidade', 76); const alvo = +opt('mb', 9.8) * 1048576;
  let saida = RAPIDO || opt('dur') ? TMP + '/batalha-teste.webp' : OUTP + '/batalha.webp'; let rr;
  for (;;) { rr = img('anima', todos, saida, larg, q, ms); log('webp:', rr); if (fs.statSync(saida).size <= alvo || q <= 50) break; q -= 4; }
  const ff = ffmpeg(); if (ff && !RAPIDO && !opt('dur')) { const mp4 = TMP + '/batalha-1080p.mp4'; const r = cp.spawnSync(ff, ['-y', '-hide_banner', '-loglevel', 'error', '-framerate', String(FPS), '-i', todos + '/%05d.png', '-vf', 'scale=1920:1080:flags=lanczos,format=yuv420p', '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-maxrate', '6M', '-bufsize', '12M', '-movflags', '+faststart', mp4] /* teto de ~6 Mbit/s: 12 s cabem nos 10 MB de vídeo que o GitHub aceita no plano grátis */, { encoding: 'utf8' }); log('mp4:', r.status === 0 ? mp4.replace(root + '/', '') + ' ' + (fs.statSync(mp4).size / 1048576).toFixed(2) + ' MB' : 'falhou ' + (r.stderr || '').slice(-300)); }
  else if (!ff) log('mp4: sem ffmpeg com H.264 (pip install --user imageio-ffmpeg)');
  return rr;
}

/* ---------- fotos do README: cenas fixas (escolhidas com a sonda na 5.0h.1) nos três idiomas ---------- */
/* Cada foto sai em inglês (o nome-base, do README.md), em português (<nome>.pt-BR.jpg) e em espanhol (<nome>.es.jpg): a mesma semente e o
   mesmo instante, trocando só o ?lang=; o hash da partida no instante da foto é comparado entre os três idiomas (o idioma não muda o jogo).
   As cenas ficam guardadas aqui (sem sonda): para trocar, rode uma sonda e edite FOTOS. Sem aviso aberto (o conselheiro, as dicas e o aviso
   curto fechados, como o jogador fecharia) e com a economia saudável no instante escolhido (nenhum "Faltam X" no painel). */
const IDIOMAS = [['en', ''], ['pt', '.pt-BR'], ['es', '.es']];
const PART = { ia: 'todos', semcine: 1, cenas: 0, dia: 1 };
const FOTOS = {
  /* a base Vehnar crescendo na Era II (73 unidades perto do Núcleo, 41 construções; Minério 356, Plasma 283, Dados 1.070), sem luta perto */
  'partida-pc': { url: Object.assign({ autostart: 1, faction: 'vehnar', opp: 3, diff: 'normal', seed: 11, mundo: 1, cmd: 1, reveal: 1 }, PART), t: 302, cam: 'base', zoom: 1.0, pitch: 0.74 },
  /* Tessara contra o Coro Quorith de perto: 118 unidades na luta, 17 aéreos (Minério 324, Plasma 750, Dados 260); a maior unidade Tessara
     selecionada (o painel mostra ela no lugar do Construir), a câmera baixa na diagonal da linha de frente, a aba Ataques dos Alertas e sem o anel
     vermelho dos inimigos (o ajuste "Destacar inimigos") */
  'batalha-pc': { url: Object.assign({ autostart: 1, faction: 'tessara', opp: 3, diff: 'dificil', seed: 5, mundo: 1, cmd: 1, reveal: 1 }, PART), t: 435, cam: { x: 1141, y: 856 }, zoom: 2.4, pitch: 0.42, giro: 2.54, sel: true, semAnel: true, abaAlertas: 'ataque' }, /* giro 2,54: do lado Quorith, na diagonal, o feixe dos dois exércitos atravessando a tela */
  /* a partida no celular de sempre (Tessara contra uma IA, semente 8), aos 7:10, com Minério 330 */
  'partida-celular': { url: Object.assign({ autostart: 1, faction: 'tessara', opp: 1, diff: 'normal', seed: 8, touch: 1 }, PART), t: 430, cam: null },
};
async function assenta(p, n, cam) { for (let i = 0; i < n; i++) await quadro(p, cam, false); }
const FECHA = () => { const G = window.__ARDG; G.adv = null; G.advS = G.advS || { since: {}, next: {} }; G.advS.quiet = 1e9; G.hintsOff = true; G.hintsHtml = '';
  const h = document.getElementById('hints'); if (h) h.hidden = true; const n = document.getElementById('notice'); if (n) n.classList.remove('show');
  const R = G.R; if (R && R.fx && Array.isArray(R.fx.floats)) { const sem = o => !/^★/.test(String((o && o.text) || '')); const arr = R.fx.floats.filter(sem); arr.push = function (...a) { return Array.prototype.push.apply(this, a.filter(sem)); }; R.fx.floats = arr; } /* sem o texto flutuante da promoção: na 5.0h.1 ele sai sempre em português ("★ Veterano", src/render3d.js), também na foto em inglês */
  const md = document.getElementById('mundo-dica'); if (md) { const bt = md.querySelector('button'); if (bt) bt.click(); if (document.getElementById('mundo-dica')) md.remove(); } }; /* fecha o conselheiro, as dicas, o aviso curto e a dica da primeira vez do Mundo vivo ("Entendi") */
async function cenaFoto(b, base, nome, F, lang, ctxo, arq) {
  const { ctx, p, errs } = await abrir(b, base + URLP(Object.assign({}, F.url, { lang })), ctxo); await esperaPartida(p); await p.evaluate(() => window.__vt.ligar());
  await avanca(p, F.t - 0.6); /* 0,6 s antes: os 12 quadros seguintes correm no laço do jogo (efeitos, tiros, explosões) */
  const cam = await p.evaluate(F => { const G = window.__ARDG, S = ARD.sim, sim = G.sim; G.acc = 0; G.last = performance.now(); G.frameN = 0; /* o laço do jogo parte do instante exato (sem o resto de tempo real de antes do relógio virtual) e do quadro 0 (o HUD atualiza os números a cada 3 quadros): o mesmo tique e os mesmos números em todo idioma */ if (F.semAnel && ARD.hud3 && ARD.hud3.view) ARD.hud3.view.foes = false;
    if (F.cam === 'base') { let x = 0, y = 0, n = 0; const nu = S.nucleoOf(sim, G.human); for (const e of sim.ents) if (e.alive && e.kind === 'building' && e.owner === G.human && nu && S.dist(e.x, e.y, nu.x, nu.y) < 700) { x += e.x; y += e.y; n++; } return n ? { x: x / n, y: y / n, zoom: F.zoom, pitch: F.pitch } : null; }
    if (F.cam && F.cam.x != null) { /* a linha de frente: entre o exército do jogador e o inimigo perto do ponto; a câmera de lado, olhando a linha (um exército de cada lado) */
      const A = { x: 0, y: 0, n: 0 }, B = { x: 0, y: 0, n: 0 };
      for (const e of sim.ents) { if (!e.alive || e.kind !== 'unit' || Math.hypot(e.x - F.cam.x, e.y - F.cam.y) > 450 || (sim.players[e.owner] && sim.players[e.owner].mundo)) continue; const L = e.owner === G.human ? A : S.isEnemy(sim, G.human, e.owner) ? B : null; if (L) { L.x += e.x; L.y += e.y; L.n++; } }
      let c = F.cam, yaw; if (A.n && B.n) { const ax = A.x / A.n, ay = A.y / A.n, bx = B.x / B.n, by = B.y / B.n; c = { x: (ax + bx) / 2, y: (ay + by) / 2 };
        let dx = bx - ax, dy = by - ay; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d; yaw = Math.atan2(-dx, dy) + (F.giro || 0); } /* giro 0: atrás do exército do jogador, olhando o inimigo; π/2: de lado */
      if (F.sel) { let best = null; for (const e of sim.ents) if (e.alive && e.kind === 'unit' && e.owner === G.human && Math.hypot(e.x - c.x, e.y - c.y) < 300 && (!best || e.maxHp > best.maxHp)) best = e; if (best) G.view.sel = new Set([best.id]); }
      if (F.abaAlertas) { const f = document.querySelector('#alertc [data-af="' + F.abaAlertas + '"]'); if (f) f.click(); } /* no combate, a aba Ataques dos Alertas (um clique do jogador) */
      return Object.assign({ x: c.x, y: c.y, zoom: F.zoom, pitch: F.pitch }, yaw != null ? { yaw } : {}); }
    return null; }, F);
  await assenta(p, 12, cam); await p.evaluate(FECHA); await assenta(p, 1, cam); await p.evaluate(FECHA); await assenta(p, 1, cam);
  const st = await p.evaluate(() => { const G = window.__ARDG, sim = G.sim, q = sim.players[G.human]; return { t: sim.time, tick: sim.tick, hash: ARD.sim.hash(sim), res: Object.entries(q.res).map(([k, v]) => k.slice(0, 3) + ' ' + Math.round(v)).join(', '), aviso: !!G.adv || !document.getElementById('hints').hidden, faltam: /Faltam|Missing|Faltan|Need/i.test((document.getElementById('panel') || {}).innerText || '') }; });
  await p.screenshot(Object.assign({ path: arq }, FOTO_PNG)); await ctx.close();
  return Object.assign(st, { erros: errs.length ? errs.join(' ; ') : '' });
}
async function fotos(b, base) {
  const so = String(opt('fotos', 'inicio-pc,partida-pc,batalha-pc,inicio-celular,partida-celular')).split(','); const D = TMP + '/fotos'; fs.mkdirSync(D, { recursive: true }); const res = [];
  const langs = opt('idiomas') ? IDIOMAS.filter(([l]) => String(opt('idiomas')).split(',').includes(l)) : IDIOMAS; const previa = !!opt('previa'); const t0 = Date.now();
  const pc = { viewport: { width: 1280, height: 720 }, deviceScaleFactor: previa ? 1 : 2 }; /* 2560×1440 → Lanczos → 1920×1080 */
  const cel = Object.assign({}, devices['Pixel 7'] || {}, { viewport: { width: 390, height: 844 }, deviceScaleFactor: previa ? 2 : 3, isMobile: true, hasTouch: true }); delete cel.defaultBrowserType; /* 1170×2532 → 780×1688 (2×) */
  const saida = (nome, suf) => (previa ? TMP + '/previa/' : OUTP + '/') + nome + suf + '.jpg';
  for (const nome of so) { const red = []; const hashes = []; const tf = Date.now();
    for (const [lang, suf] of langs) { const png = D + '/' + nome + suf + '.png'; const ctxo = /celular/.test(nome) ? cel : pc; const W = /celular/.test(nome) ? 780 : 1920, H = /celular/.test(nome) ? 1688 : 1080;
      if (/^inicio/.test(nome)) { /* a tela inicial em tempo real: sem placa de vídeo o jogo mostra o pôster da Sala de Comando (o render dela, src/m5/sala-poster.js), no enquadramento da Sala ao vivo */
        const { ctx, p, errs } = await abrir(b, base + '?lang=' + lang, ctxo);
        await p.waitForFunction(() => { const I = ARD.salaPoster && ARD.salaPoster.info && ARD.salaPoster.info(); return document.fonts.status === 'loaded' && (!I || (I.vis && I.final)); }, null, { timeout: 180000, polling: 500 }).catch(() => log(nome + ': o pôster não ficou pronto em 3 min'));
        await p.waitForTimeout(4000); await p.screenshot(Object.assign({ path: png }, FOTO_PNG)); if (errs.length) res.push(nome + suf + ': ' + errs.join(' ; ')); await ctx.close();
      } else { const F = FOTOS[nome]; if (!F) throw new Error('foto desconhecida: ' + nome); const st = await cenaFoto(b, base, nome, F, lang, ctxo, png); hashes.push(st.hash + '@' + st.tick);
        log(nome + suf + ': t=' + st.t.toFixed(1) + ' s, hash ' + st.hash + ', ' + st.res + (st.aviso ? ', AVISO ABERTO' : '') + (st.faltam ? ', "FALTAM" NO PAINEL' : '') + (st.erros ? ', erros: ' + st.erros : '')); if (st.aviso || st.faltam || st.erros) res.push(nome + suf + ' com problema'); }
      red.push([png, saida(nome, suf), previa ? W / 2 : W, previa ? H / 2 : H, 88]); }
    if (hashes.length > 1) { const igual = hashes.every(h => h === hashes[0]); log(nome + ': hash da partida ' + (igual ? 'igual nos ' + hashes.length + ' idiomas (' + hashes[0] + ')' : 'DIFERENTE entre os idiomas: ' + hashes.join(' | '))); if (!igual) res.push(nome + ': hash diferente'); }
    log(nome + ':', reduz(red), 'em', ((Date.now() - tf) / 60000).toFixed(1), 'min'); }
  log('fotos:', res.length ? res.join(' | ') : 'tudo ok', '|', ((Date.now() - t0) / 60000).toFixed(1), 'min'); if (res.length) process.exitCode = 1;
}

/* ---------- imagem de compartilhamento (três idiomas: compartilhar.jpg em inglês, .pt-BR.jpg e .es.jpg) ---------- */
async function compartilhar(b, base) {
  const red = []; for (const [lang, suf] of IDIOMAS) { const ctx = await b.newContext({ viewport: { width: 1280, height: 640 }, deviceScaleFactor: 2 }); const p = await ctx.newPage();
    await p.goto(base + 'tools/vitrine-compartilhar.html?lang=' + lang, { waitUntil: 'networkidle' }); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(500);
    const png = TMP + '/compartilhar' + suf + '.png'; await p.screenshot({ path: png, type: 'png' }); await ctx.close(); red.push([png, IMG + '/compartilhar' + suf + '.jpg', 2560, 1280, 88]); }
  log('compartilhar:', reduz(red));
}

/* ---------- galeria (tools/galeria.cjs com supersampling) ---------- */
function galeria(filtro, extra) { const r = cp.spawnSync(process.execPath, [root + '/tools/galeria.cjs', filtro, ...(extra || [])], { stdio: 'inherit', env: process.env }); if (r.status !== 0) throw new Error('galeria ' + filtro + ' falhou'); }

/* ---------- chefões (depois da junção dos modelos novos) ---------- */
/* a galeria dos chefões (docs/imagens/chefoes/) e a animação partida/chefao.webp: o Arauto e a Forja-Mãe inteira girando com a animação do
   jogo, 120 quadros por volta a 24 quadros/s, desenhados 3× maiores e reduzidos. --saida=<pasta> grava fora de docs/ (teste). */
function chefoes() {
  const saida = opt('saida', null); const ex = ['--ss=3'].concat(saida ? ['--saida=' + saida] : []);
  galeria('chefoes', ex);
  const NG = RAPIDO ? 24 : 120; const W = 800, H = 450;
  const tg = TMP + '/galeria-png'; for (const d of ['giro-arauto_1', 'giro-forja']) fs.rmSync(tg + '/' + d, { recursive: true, force: true });
  galeria('todas', ['--giro=chefe_arauto_1,chefe_forja', '--giroq=' + NG, '--ss=3', String(W), String(H)]); const todos = TMP + '/chefao'; fs.rmSync(todos, { recursive: true, force: true }); fs.mkdirSync(todos, { recursive: true }); let n = 0;
  for (const d of ['giro-arauto_1', 'giro-forja']) for (const f of fs.readdirSync(tg + '/' + d + '/final').filter(f => f.endsWith('.png')).sort()) fs.copyFileSync(tg + '/' + d + '/final/' + f, todos + '/' + String(n++).padStart(5, '0') + '.png');
  const out = (saida ? path.resolve(saida) + '/partida' : OUTP) + '/chefao.webp'; let q = 82; let rr; for (;;) { rr = img('anima', todos, out, W, q, Math.round(1000 / 24)); log('chefão:', rr); if (fs.statSync(out).size <= 6 * 1048576 || q <= 50) break; q -= 8; }
}

/* ---------- conferência: docs iguais ao código, links, orçamento e nada da máquina dentro das imagens ---------- */
function conferir() {
  const ok = []; let falhou = false; const r = cp.spawnSync(process.execPath, [root + '/tools/docs-gerar.cjs', '--conferir'], { encoding: 'utf8' }); const dg = (r.stdout + r.stderr).trim().split('\n').pop(); ok.push('docs-gerar --conferir: ' + dg); if (r.status !== 0) falhou = true;
  let n = 0; const ruins = []; const anda = d => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { if (f.isDirectory()) { if (!['.git', 'node_modules', 'dist', '.wip', 'work'].includes(f.name)) anda(d + '/' + f.name); continue; } if (!f.name.endsWith('.md')) continue;
    const t = fs.readFileSync(d + '/' + f.name, 'utf8'); for (const m of t.matchAll(/(?:\]\(|src="|href=")([^)"#\s]+)/g)) { const u = m[1]; if (/^(https?:|mailto:|#)/.test(u)) continue; n++; if (!fs.existsSync(path.resolve(d, decodeURIComponent(u)))) ruins.push(path.relative(root, d + '/' + f.name) + ' → ' + u); } } };
  anda(root); ok.push('links relativos dos .md: ' + n + ', quebrados: ' + ruins.length + (ruins.length ? ' (' + ruins.slice(0, 5).join(', ') + ')' : '')); if (ruins.length) falhou = true;
  const tot = du(IMG), bw = fs.existsSync(OUTP + '/batalha.webp') ? fs.statSync(OUTP + '/batalha.webp').size : 0; ok.push('docs/imagens: ' + (tot / 1048576).toFixed(2) + ' MB (limite 30), batalha.webp ' + (bw / 1048576).toFixed(2) + ' MB (limite 10)'); if (tot > 30 * 1048576 || bw > 10.5 * 1048576) falhou = true;
  const falta = []; for (const n of ['compartilhar', 'partida/inicio-pc', 'partida/partida-pc', 'partida/batalha-pc', 'partida/inicio-celular', 'partida/partida-celular']) for (const [, suf] of IDIOMAS) if (!fs.existsSync(IMG + '/' + n + suf + '.jpg')) falta.push(n + suf + '.jpg');
  ok.push('fotos nos três idiomas (inglês, .pt-BR, .es): ' + (falta.length ? 'faltam ' + falta.join(', ') : '6 × 3 ok')); if (falta.length) falhou = true;
  const quem = [require('os').userInfo().username, require('os').hostname(), root, require('os').homedir()].filter(Boolean); const vaz = []; const varre = d => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const q = d + '/' + f.name; if (f.isDirectory()) varre(q); else { const b = fs.readFileSync(q).toString('latin1'); for (const w of quem) if (b.includes(w)) vaz.push(path.relative(root, q) + ' contém ' + (w === root ? 'o caminho da cópia' : w === require('os').homedir() ? 'a pasta do usuário' : 'o nome do usuário ou da máquina')); } } };
  varre(IMG); ok.push('metadados das imagens sem usuário, máquina nem caminho: ' + (vaz.length ? 'NÃO (' + vaz.slice(0, 3).join(', ') + ')' : 'ok')); if (vaz.length) falhou = true;
  for (const l of ok) log('conferir:', l); if (falhou) process.exitCode = 1;
}

module.exports = { servidor, abrir, esperaPartida, URLP, avanca, quadro, log, ARGS, ARGS_M5, TMP, IMG, FPS, escolher, conferir, FOTOS, FECHA, assenta };

if (require.main === module) (async () => {
  const antes = fs.existsSync(IMG) ? du(IMG) : 0;
  if (SO.includes('galeria')) { log('galeria das Raças'); galeria('vehnar,erevane,tessara,quorith,vorag', ['--ss=3']); }
  if (SO.includes('chefoes')) { log('chefões'); chefoes(); }
  const precisa = ['sonda', 'fotos', 'batalha', 'compartilhar'].some(k => SO.includes(k));
  if (precisa) { const { s, base } = await servidor(); log('servidor', base.replace(/\/$/, ''));
    try {
      for (const k of ['compartilhar', 'fotos', 'batalha', 'sonda']) { if (!SO.includes(k) || (k === 'sonda' && SO.includes('batalha'))) continue; log('parte:', k);
        const b = await chromium.launch({ headless: true, args: ARGS.concat(MOTOR === '5' ? ARGS_M5 : []) }); /* um navegador por parte, um de cada vez */
        try { await ({ compartilhar, fotos, batalha, sonda })[k](b, base); } finally { await b.close(); } }
    } finally { s.close(); } }
  log('docs/imagens:', (antes / 1048576).toFixed(2), 'MB antes →', (du(IMG) / 1048576).toFixed(2), 'MB agora');
  if (SO.includes('conferir')) conferir();
})().catch(e => { console.error('vitrine falhou:', e.stack || e.message); process.exit(1); });
function du(d) { let t = 0; for (const f of fs.readdirSync(d, { withFileTypes: true })) t += f.isDirectory() ? du(d + '/' + f.name) : fs.statSync(d + '/' + f.name).size; return t; }
