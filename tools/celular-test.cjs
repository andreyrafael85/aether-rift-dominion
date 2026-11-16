// 5.5b.3 — teste da nitidez e da fluidez no celular (emulação de celular de 402×714 pontos e 3 pontos por ponto lógico, no Chromium e no WebKit).
// O que confere, sempre por contagem e comportamento (nunca por tempo de relógio: a carga é artificial e o relógio do ajuste é virtual):
//   1) no celular a partida começa na resolução de antes (1 ponto por ponto lógico), na qualidade Baixa, sem sombras nem pós;
//   2) com folga, a nitidez sobe um degrau por vez até o teto (2×: 804×1428) sem aviso e sem trocar o degrau de qualidade;
//   3) com carga de pixels, desce um degrau por vez; o degrau que falhou fica vetado (30 s, depois o dobro...), então não há vai e volta;
//   4) com carga muito pesada desce até o piso (0,55×) e, com a folga de volta, só sobe depois do veto;
//   5) quando a lentidão não vem dos pixels (duas descidas sem melhorar), para de descer e libera a troca de degrau;
//   6) o degrau de qualidade só sobe com a nitidez no teto e só desce com ela no piso; o aviso aparece só na troca de degrau, e as trocas
//      respeitam o intervalo mínimo (45 s);
//   7) ?nitidez=1 é igual a antes (402×714, passos de 10%), ?nitidez=1.5 e ?nitidez=2 ficam parados em 603×1071 e 804×1428;
//   8) o Teste de desempenho mostra a linha "Nitidez no celular" (mínima, média, máxima e trocas) no celular e não mostra no computador;
//   9) no computador nada muda: sem nitidez, mesma resolução, mesmos passos da resolução dinâmica, troca de degrau sempre liberada;
//  10) Motor 5 (só com --m5; a carga dele na GPU por software leva minutos): a mesma subida e descida no canvas do WebGPU.
// A página é o dist/local.html (tools/vendor.mjs + tools/build.mjs), servida por um servidor local só para o teste (o WebKit não carrega os módulos por file://).
// Uso: NODE_PATH=<pasta com node_modules/playwright> node tools/celular-test.cjs [--json] [--motores=chromium,webkit] [--m5 | --so-m5] [--partes=auto,modos,teste,pc]   (a última linha com --json é o resultado)
const path = require('path'), fs = require('fs'); const root = path.resolve(__dirname, '..'); const JSONOUT = process.argv.includes('--json'); const SO_M5 = process.argv.includes('--so-m5'), COM_M5 = SO_M5 || process.argv.includes('--m5'); const t00 = Date.now();
const PARTES = ((process.argv.find(a => a.startsWith('--partes=')) || '').slice(9) || 'auto,modos,teste,pc').split(','); /* --partes=auto,modos,teste,pc: rodada parcial durante o trabalho (o portão roda tudo) */
const MOTORES = ((process.argv.find(a => a.startsWith('--motores=')) || '').slice(10) || 'chromium,webkit').split(',').filter(x => x && !SO_M5);
const res = []; const ok = (c, nome, det) => { res.push({ ok: !!c, nome: nome + (!c && det != null ? ' — ' + (typeof det === 'string' ? det : JSON.stringify(det)) : '') }); if (!JSONOUT) console.log((c ? '  ok   ' : '  FALHA ') + nome + (!c && det != null ? ' — ' + (typeof det === 'string' ? det : JSON.stringify(det)) : '')); };
const fecha = () => { const bad = res.filter(r => !r.ok).length;
  if (JSONOUT) console.log(JSON.stringify({ ok: res.length - bad, falhas: bad, total: res.length, falhou: res.filter(r => !r.ok).map(r => r.nome), s: Math.round((Date.now() - t00) / 1000) })); /* o mesmo formato do tools/hud-test.cjs */
  else console.log('celular: ' + (res.length - bad) + ' ok, ' + bad + ' falhas · ' + Math.round((Date.now() - t00) / 1000) + ' s'); process.exit(bad ? 1 : 0); };
const CEL = { viewport: { width: 402, height: 714 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }; const PC = { viewport: { width: 960, height: 600 }, deviceScaleFactor: 2 };
const JOGO = 'autostart=1&seed=42&opp=1&faction=vehnar&debug=1&dyn=1&lang=pt&semsalvar=1&semcine=1&dia=1';
const FOLGA = { a: 16.7, b: 0 }, PIXELS = { a: 6, b: 5 } /* 2× = 26 ms, 1,75× = 21,3 ms, 1,5× = 17,3 ms */, PESADA = { a: 5, b: 60 } /* 0,55× ainda dá 23 ms */, PROCESSADOR = { a: 40, b: 0 } /* lenta em qualquer resolução */;

/* roda dentro da página: troca o R.dynFrame do laço por um que não faz nada (os quadros de verdade, lentos na GPU por software, não entram na conta)
   e guarda o original para o teste alimentar com tempos de quadro artificiais e relógio virtual */
function instala() {
  const G = window.__ARDG, R = G.R, real = R.dynFrame; R.dynFrame = function () {}; let vnow = 1e7; const cv = document.getElementById('world'), nt = document.getElementById('notice'); const avisos = [];
  new MutationObserver(() => { const t = nt.textContent; if (t && avisos[avisos.length - 1] !== t) avisos.push(t); }).observe(nt, { childList: true, characterData: true, subtree: true });
  const abs = () => Math.round(R.quality.pr * R.dyn.scale * 100) / 100;
  window.__T = {
    zera() { try { localStorage.removeItem('ard-nitidez'); } catch (e) {} const N = R.nit; if (N && N.modo === 'auto') { N.veto = {}; N.quedas = {}; N.qn = 0; N.qL = []; N.semEfeito = 0; N.seN = 0; N.em = 0; N.ultDegrau = 0; } R.setDyn(false); try { localStorage.removeItem('ard-nitidez'); } catch (e) {} R.setDyn(true); R.dyn.ema = 0; R.dyn.t = 0; R.dyn.good = 0; R.dynZera(); return abs(); }, /* volta ao começo: os quadros de verdade (lentos nesta máquina) podem ter mexido na escala antes de o teste assumir */
    roda(m, seg) { const tr = [], t0 = vnow, fim = vnow + seg * 1000; let ult = abs(); while (vnow < fim) { const ms = m.a + m.b * ult * ult; vnow += ms; real(ms, vnow, 16.7); const x = abs(); if (x !== ult) { tr.push([Math.round((vnow - t0) / 100) / 10, x]); ult = x; } } return tr; },
    gpu(ms) { if (R.m5 && R.m5.gpu) { R.m5.gpu.last = ms; return !!R.m5.timestamp; } return null; }, /* Motor 5: o tempo de GPU que o ajuste lê (0 = não medido) */
    pode(dir) { const r = R.degrauPode(dir, vnow); if (R.nit) R.nit.ultDegrau = 0; return r; },
    estado() { const q = R.quality; return { abs: abs(), w: cv.width, h: cv.height, nome: q.name, degrau: q.resolved, pr: q.pr, sombras: !!q.shadows, pos: !!q.post, avisos: avisos.slice(), trocas: R.dyn.est.trocas, escala: R.dyn.scale, ligada: R.dyn.on, nit: R.nit ? { modo: R.nit.modo, teto: R.nit.teto } : null, info: R.dynInfo(), m5: !!R.m5, backend: R.m5 ? R.m5.backend : null, pausado: !!G.paused, lembrado: (() => { try { return localStorage.getItem('ard-nitidez'); } catch (e) { return null; } })() }; },
  };
  return true;
}

(async () => {
  let pw = null; try { pw = require('playwright'); } catch (e) { ok(false, 'o Playwright está instalado (NODE_PATH)', String(e.message).split('\n')[0]); return fecha(); }
  if (!fs.existsSync(path.join(root, 'dist/local.html'))) { ok(false, 'dist/local.html existe (rode tools/vendor.mjs e tools/build.mjs)'); return fecha(); }
  const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
  const srv = require('http').createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const f = path.join(root, path.normalize(u).replace(/^(\.\.[\/\\])+/, '')); if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': TIPOS[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
  await new Promise(k => srv.listen(0, '127.0.0.1', k)); const base = 'http://127.0.0.1:' + srv.address().port + '/dist/local.html';
  const ARGS = ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage', '--hide-scrollbars', '--mute-audio'];
  const ARGS_M5 = ['--no-sandbox', '--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-webgpu-adapter=swiftshader', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-dev-shm-usage', '--hide-scrollbars', '--mute-audio'];
  const abre = async (b, query, perfil, erros, limite) => { const ctx = await b.newContext(Object.assign({ serviceWorkers: 'block', locale: 'pt-BR' }, perfil)); const p = await ctx.newPage(); p.setDefaultTimeout(limite || 240000); p.on('pageerror', e => erros.push(String(e.message).slice(0, 200)));
    await p.goto(base + '?' + query, { waitUntil: 'load' }); return p; };
  const noAr = async p => { await p.waitForFunction(() => window.__ARDG && window.__ARDG.sim && window.__ARDG.R && document.getElementById('loading').hidden, null, { polling: 200 }); };
  const T = (p, f, ...a) => p.evaluate(([f, a]) => window.__T[f](...a), [f, a]);
  /* uma janela de 4 s do ajuste pelo FPS, injetada no caminho de verdade do jogo (src/main.js): 'alto' = bem acima de 57 fps, 'baixo' = bem abaixo de 26 */
  const janela = async (p, qual, pre) => { await p.waitForFunction(() => performance.now() - window.__ARDG.perf.start > 6500, null, { polling: 100 });
    const t = await p.evaluate(([qual, pre]) => { const pf = window.__ARDG.perf; Object.assign(pf, pre || {}); pf.t0 = performance.now() - 4001; pf.frames = qual === 'alto' ? 100000 : 0; return pf.t0; }, [qual, pre]);
    await p.waitForFunction(t => window.__ARDG.perf.t0 > t + 2000, t, { polling: 30 }); };

  for (const nome of MOTORES) { let b = null; const erros = []; const N = nome + ': ';
    try { b = await pw[nome].launch({ headless: true, args: nome === 'chromium' ? ARGS : [] });
      if (PARTES.includes('auto')) { /* ---------- nitidez automática (o padrão) ---------- */
        const p = await abre(b, JOGO, CEL, erros); await noAr(p); await p.evaluate(instala); const e0 = await T(p, 'estado'); await T(p, 'zera'); const e1 = await T(p, 'estado');
        ok(e0.nit && e0.nit.modo === 'auto' && e0.nit.teto === 2 && e0.nome === 'auto' && e0.degrau === 'baixa' && !e0.sombras && !e0.pos && !e0.m5 && !e0.pausado, N + 'celular começa na Baixa automática, sem sombras nem pós, com a nitidez automática e teto de 2×', e0);
        ok(e1.abs === 1 && e1.w === 402 && e1.h === 714 && e1.ligada, N + 'a partida começa na resolução de antes (402×714, 1 ponto por ponto lógico)', { abs: e1.abs, w: e1.w, h: e1.h });
        /* 2) folga: sobe até o teto */
        const s = await T(p, 'roda', FOLGA, 20); const e2 = await T(p, 'estado'); let esp = true; for (let i = 0; i < s.length; i++) if (s[i][0] - (i ? s[i - 1][0] : 0) < 2.4) esp = false;
        ok(s.map(x => x[1]).join(',') === '1.25,1.5,1.75,2' && e2.w === 804 && e2.h === 1428, N + 'com folga a nitidez sobe um degrau por vez até 2× (804×1428)', { s, w: e2.w, h: e2.h });
        ok(esp && s.length === 4, N + 'cada subida espera pelo menos 2,5 s de folga seguida', s);
        ok(e2.degrau === 'baixa' && !e2.avisos.length && !e2.sombras && !e2.pos, N + 'subir a nitidez não troca o degrau de qualidade, não liga sombras nem pós e não mostra aviso', { degrau: e2.degrau, avisos: e2.avisos });
        ok(e2.lembrado === '2', N + 'o aparelho guarda (só nele) o último valor sustentado', e2.lembrado);
        /* 3) carga de pixels por 5 minutos: assenta em 1,5× e as novas tentativas de 1,75× ficam cada vez mais raras */
        const c = await T(p, 'roda', PIXELS, 300); const e3 = await T(p, 'estado'); const tent = c.filter(x => x[1] === 1.75 && c[c.indexOf(x) - 1] && c[c.indexOf(x) - 1][1] === 1.5).map(x => x[0]); let cresce = true; for (let i = 2; i < tent.length; i++) if (tent[i] - tent[i - 1] < (tent[i - 1] - tent[i - 2]) * 1.5) cresce = false;
        ok(c.length >= 2 && c[0][1] === 1.75 && c[1][1] === 1.5 && e3.abs === 1.5 && e3.w === 603 && e3.h === 1071 && c.every(x => x[1] >= 1.5), N + 'com carga de pixels a nitidez desce um degrau por vez e assenta em 1,5× (603×1071), sem passar do necessário', { c, abs: e3.abs, w: e3.w });
        ok(c.length <= 10 && tent.length >= 2 && tent.length <= 4 && tent[0] >= 30 && cresce, N + 'sem vai e volta: em 5 minutos, ' + c.length + ' trocas (no máximo 10) e ' + tent.length + ' novas tentativas do degrau que falhou, cada vez mais espaçadas (' + tent.join(' s, ') + ' s)', { c, tent });
        ok(e3.degrau === 'baixa' && !e3.avisos.length, N + 'a carga de pixels não trocou o degrau de qualidade nem mostrou aviso', { degrau: e3.degrau, avisos: e3.avisos });
        /* 4) carga muito pesada: até o piso; depois, folga: só sobe passado o veto */
        const d = await T(p, 'roda', PESADA, 30); const e4 = await T(p, 'estado');
        ok(d.map(x => x[1]).join(',') === '1.25,1,0.85,0.7,0.55' && e4.w === 221 && e4.h === 392, N + 'com carga muito pesada desce degrau por degrau até o piso de antes (0,55×: 221×392)', { d, w: e4.w, h: e4.h });
        ok((await T(p, 'pode', -1)) === true && (await T(p, 'pode', 1)) === false, N + 'no piso a troca de degrau para baixo fica liberada (e para cima, não)');
        const v = await T(p, 'roda', FOLGA, 60); const e5 = await T(p, 'estado');
        ok(v.length >= 5 && v[0][0] >= 5 && v.slice(0, 5).map(x => x[1]).join(',') === '0.7,0.85,1,1.25,1.5' && e5.abs === 1.5, N + 'com a folga de volta, só sobe depois do veto de cada degrau e para em 1,5× (o 1,75× segue vetado)', { v, abs: e5.abs });
        /* 5) lentidão que não é de pixels */
        await T(p, 'zera'); await T(p, 'roda', FOLGA, 20); const a5 = await T(p, 'estado'); const q = await T(p, 'roda', PROCESSADOR, 18); const e6 = await T(p, 'estado');
        ok(a5.abs === 2 && q.map(x => x[1]).join(',') === '1.75,1.5' && e6.abs === 1.5, N + 'lentidão que não melhora com menos pixels: desce só 2 degraus e para por 20 s (antes ia direto ao piso)', { de: a5.abs, q, abs: e6.abs });
        ok((await T(p, 'pode', -1)) === true, N + 'e nesse caso a troca de degrau de qualidade para baixo fica liberada');
        const q2 = await T(p, 'roda', FOLGA, 12); ok(q2.map(x => x[1]).join(',') === '1.75,2', N + 'passada a lentidão, volta ao teto sem veto (os degraus não tinham culpa)', q2);
        const q3 = await T(p, 'roda', PROCESSADOR, 600); const e7 = await T(p, 'estado'); ok(q3.length <= 8 && e7.avisos.length === 0, N + 'lentidão do processador por 10 minutos: ' + q3.length + ' trocas ao todo (em pares cada vez mais espaçados), nenhum aviso', q3);
        /* 6) degrau de qualidade e aviso, pelo caminho de verdade do ajuste por FPS */
        await T(p, 'zera'); const g0 = await T(p, 'estado'); await janela(p, 'alto', { high: 3, low: 0, up: false, down: false, auto: true }); const g1 = await T(p, 'estado');
        ok(g0.abs === 1 && g1.degrau === 'baixa' && !g1.avisos.length, N + 'com folga mas a nitidez abaixo do teto, o degrau de qualidade NÃO sobe (a folga vai antes para a nitidez)', { degrau: g1.degrau, avisos: g1.avisos });
        await T(p, 'roda', FOLGA, 20); await janela(p, 'alto', { high: 3, low: 0 }); const g2 = await T(p, 'estado');
        ok(g2.degrau === 'media' && g2.avisos.length === 1 && /subiu/.test(g2.avisos[0]) && g2.abs === 1.5 && g2.w === 603, N + 'com a nitidez no teto e folga, o degrau sobe para a Média com 1 aviso (603×1071, como a Média do celular já era)', { degrau: g2.degrau, avisos: g2.avisos, abs: g2.abs, w: g2.w });
        await p.evaluate(() => { window.__ARDG.R.nit.ultDegrau = 0; }); await janela(p, 'baixo', { low: 1, high: 0 }); const g3 = await T(p, 'estado');
        ok(g3.degrau === 'media' && g3.avisos.length === 1, N + 'FPS baixo com a nitidez ainda acima do piso: o degrau NÃO desce (a nitidez desce antes)', { degrau: g3.degrau, avisos: g3.avisos });
        const m = await T(p, 'roda', PESADA, 20); const g4 = await T(p, 'estado'); await p.evaluate(() => { window.__ARDG.R.nit.ultDegrau = performance.now(); }); await janela(p, 'baixo', { low: 1, high: 0 }); const g5 = await T(p, 'estado');
        ok(m.map(x => x[1]).join(',') === '1.25,1,0.85' && g4.abs === 0.85 && g5.degrau === 'media' && g5.avisos.length === 1, N + 'na Média o piso é 0,85×; com outra troca há menos de 45 s, o degrau espera (sem aviso)', { m, degrau: g5.degrau, avisos: g5.avisos });
        await p.evaluate(() => { window.__ARDG.R.nit.ultDegrau = performance.now() - 46000; }); await janela(p, 'baixo', { low: 1, high: 0 }); const g6 = await T(p, 'estado');
        ok(g6.degrau === 'baixa' && g6.avisos.length === 2 && /ajustada/.test(g6.avisos[1]) && g6.abs === 0.85, N + 'no piso e passado o intervalo, o degrau desce para a Baixa com 1 aviso, e a nitidez em uso é mantida (sem pulo)', { degrau: g6.degrau, avisos: g6.avisos, abs: g6.abs });
        await p.evaluate(() => { const N = window.__ARDG.R.nit; N.ultDegrau = 0; N.veto = {}; }); await T(p, 'roda', FOLGA, 30); for (let i = 0; i < 3; i++) { await janela(p, 'alto', { high: 3, low: 0 }); await p.evaluate(() => { window.__ARDG.R.nit.ultDegrau = 0; }); } const g7 = await T(p, 'estado');
        ok(g7.abs === 2 && g7.degrau === 'baixa' && g7.avisos.length === 2, N + 'depois de descer, o degrau não sobe de novo na mesma partida (sem vai e volta de degrau): 2 avisos no total, nenhum pela nitidez', { abs: g7.abs, degrau: g7.degrau, avisos: g7.avisos });
        await p.context().close(); }
      if (PARTES.includes('modos')) { /* ---------- 7) modos de teste do dono ---------- */
        const p1 = await abre(b, JOGO + '&nitidez=1', CEL, erros); await noAr(p1); await p1.evaluate(instala); await T(p1, 'zera'); const a0 = await T(p1, 'estado'); const a1 = await T(p1, 'roda', FOLGA, 15); const a2 = await T(p1, 'roda', PROCESSADOR, 4); const a3 = await T(p1, 'estado');
        ok(a0.nit.modo === 'antigo' && a0.w === 402 && a0.h === 714 && a0.pr === 1 && !a1.length && a2.map(x => x[1]).join(',') === '0.9,0.8,0.7' && a3.info.modo === '1', N + '?nitidez=1 é o comportamento de antes (402×714, nunca acima de 1×, passos de 10% para baixo)', { a0: { w: a0.w, pr: a0.pr, modo: a0.nit.modo }, a1, a2 }); await p1.context().close();
        for (const [v, w, h] of [['1.5', 603, 1071], ['2', 804, 1428]]) { const p = await abre(b, JOGO + '&nitidez=' + v, CEL, erros); await noAr(p); await p.evaluate(instala); await T(p, 'zera'); const f0 = await T(p, 'estado'); const f1 = await T(p, 'roda', PESADA, 10); const f2 = await T(p, 'roda', FOLGA, 10); const f3 = await T(p, 'estado');
          ok(f0.nit.modo === 'fixo' && f0.w === w && f0.h === h && !f1.length && !f2.length && f3.w === w && f3.degrau === 'baixa' && !f3.sombras && !f3.pos && f3.info.modo === v, N + '?nitidez=' + v + ' fica parado em ' + w + '×' + h + ' (com carga ou com folga), na Baixa sem sombras nem pós', { w: f0.w, h: f0.h, f1, f2, modo: f0.nit.modo }); await p.context().close(); } }
      if (nome === 'chromium') {
        if (PARTES.includes('teste')) { /* ---------- 8) Teste de desempenho no celular: a linha da nitidez ---------- */
          const p = await abre(b, 'lang=pt&bench=1&benchpasso=1500&debug=1&nitidez=2', CEL, erros, 600000); await p.waitForFunction(() => window.__benchResult, null, { polling: 300 }); const r = await p.evaluate(() => ({ r: window.__benchResult, linhas: [...document.querySelectorAll('#bench-table .stat')].map(x => x.textContent) })); const n = r.r.nitidez, lin = r.linhas.find(x => /^Nitidez no celular/.test(x)) || '';
          ok(n && n.modo === '2' && n.min === 2 && n.med === 2 && n.max === 2 && n.trocas === 0 && n.resMax === '804x1428' && r.r.res === '804x1428' && n.quadros > 3, N + 'Teste de desempenho no celular: o resultado traz a nitidez mínima, média e máxima e as trocas', n);
          ok(/mínima 2 · média 2 · máxima 2 \(804x1428 a 804x1428\) · trocas de resolução: 0/.test(lin), N + 'e a tabela mostra a linha "Nitidez no celular"', lin); await p.context().close(); }
        if (PARTES.includes('pc')) { /* ---------- 9) computador: nada muda ---------- */
          const p = await abre(b, JOGO + '&nitidez=2', PC, erros); await noAr(p); await p.evaluate(instala); await T(p, 'zera'); const c0 = await T(p, 'estado'); const c1 = await T(p, 'roda', FOLGA, 15); const c2 = await T(p, 'roda', PROCESSADOR, 8); const c3 = await T(p, 'roda', FOLGA, 10); const c4 = await T(p, 'estado');
          ok(c0.nit === null && c0.degrau === 'baixa' && c0.pr === 1 && c0.w === 960 && c0.h === 600 && c0.info.modo === '', N + 'computador: sem nitidez de celular (mesmo com ?nitidez=2), mesma resolução de antes (960×600 na Baixa)', { nit: c0.nit, pr: c0.pr, w: c0.w, h: c0.h });
          ok(!c1.length && c2.map(x => x[1]).join(',') === '0.9,0.8,0.7,0.67' && c3.map(x => x[1]).join(',') === '0.72,0.77' && (await T(p, 'pode', -1)) === true && (await T(p, 'pode', 1)) === true && !c4.avisos.length, N + 'computador: a resolução dinâmica tem os mesmos passos de antes (−10% até 67%, +5% a cada 3 s) e a troca de degrau segue sempre liberada', { c1, c2, c3 }); await p.context().close();
          const pb = await abre(b, 'lang=pt&bench=1&benchpasso=1500&debug=1&q=baixa', PC, erros, 600000); await pb.waitForFunction(() => window.__benchResult, null, { polling: 300 }); const rb = await pb.evaluate(() => ({ r: window.__benchResult, linhas: [...document.querySelectorAll('#bench-table .stat')].map(x => x.textContent) }));
          ok(rb.r.nitidez === undefined && rb.r.res === '960x600' && rb.r.escala === '100–100%' && rb.linhas.length === 14 && !rb.linhas.some(x => /Nitidez/.test(x)), N + 'computador: o Teste de desempenho tem as mesmas 14 linhas de antes, sem a da nitidez', { res: rb.r.res, escala: rb.r.escala, linhas: rb.linhas.length }); await pb.context().close(); } }
      ok(!erros.length, N + 'nenhum erro de página durante o teste', erros.slice(0, 4));
    } catch (e) { ok(false, N + 'o teste rodou até o fim', String(e && e.message || e).slice(0, 300)); } finally { if (b) await b.close().catch(() => {}); } }

  if (COM_M5) { let b = null; const erros = []; const N = 'Motor 5: ';
    try { b = await pw.chromium.launch({ headless: true, args: ARGS_M5 }); const p = await abre(b, JOGO + '&motor=5', CEL, erros, 1500000); p.on('console', m => { if (m.type() === 'error') erros.push(m.text().slice(0, 200)); }); await noAr(p); await p.evaluate(instala); await T(p, 'zera'); const e0 = await T(p, 'estado');
      ok(e0.m5 && e0.nit.modo === 'auto' && e0.degrau === 'baixa' && !e0.sombras && !e0.pos && e0.w === 402 && e0.h === 714, N + 'no celular começa na Baixa, sem sombras nem pós, em 402×714 (' + e0.backend + ')', e0);
      const ts = await T(p, 'gpu', 0); const s = await T(p, 'roda', FOLGA, 20); const e1 = await T(p, 'estado'); const c = await T(p, 'roda', PIXELS, 20); const e2 = await T(p, 'estado'); await p.waitForTimeout(3000); const pipes = await p.evaluate(() => { const X = window.__ARDG.R.m5; return { tardios: X.pipeLog ? X.pipeLog.length : null, quadro: window.__ARDG.frameN }; });
      ok(s.map(x => x[1]).join(',') === '1.25,1.5,1.75,2' && e1.w === 804 && e1.h === 1428, N + 'com folga o canvas do Motor 5 sobe até 804×1428', { s, w: e1.w, h: e1.h });
      ok(c.map(x => x[1]).join(',') === '1.75,1.5' && e2.w === 603 && e2.h === 1071 && e2.degrau === 'baixa' && !e2.avisos.length, N + 'com carga de pixels desce para 603×1071, sem troca de degrau nem aviso', { c, w: e2.w });
      if (ts) { await T(p, 'zera'); await T(p, 'gpu', 15); const g1 = await T(p, 'roda', FOLGA, 12); await T(p, 'gpu', 5); const g2 = await T(p, 'roda', PROCESSADOR, 12); await T(p, 'gpu', 0);
        ok(!g1.length && !g2.length, N + 'com a GPU medida: acima de 80% do quadro a nitidez não sobe; abaixo de 60%, a lentidão não é de pixels e a nitidez não desce', { g1, g2 }); }
      ok(pipes.tardios === 0, N + 'nenhum pipeline novo por causa das trocas de resolução (+0)', pipes); ok(!erros.length, N + 'nenhum erro de página ou de console', erros.slice(0, 4));
    } catch (e) { ok(false, N + 'o teste rodou até o fim', String(e && e.message || e).slice(0, 300)); } finally { if (b) await b.close().catch(() => {}); } }
  srv.close(); fecha();
})();
