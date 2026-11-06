// Capturas de partidas de verdade para a documentação (docs/imagens/partida/): o jogo servido por HTTP como no GitHub Pages
// (python3 -m http.server na raiz, por exemplo), com a IA jogando pelos dois lados (?ia=todos) e o relógio da partida andando.
//   fotos      telas do computador (1280x720) e do celular (390x844, toque): tela inicial, partida com o HUD e a batalha
//   batalha    quadros de uma batalha (passo a passo: a partida fica parada e avança alguns tiques de 0,1 s por quadro, com o motor de
//              hoje desenhando cada quadro) em dist/capturas-docs/batalha/*.jpg; tools/animacao-montar.py monta o WebP animado
//   chefao     o mesmo com A Forja-Mãe (?chefe=forja) na base. Em 06/11, com a máquina dividida, a corrida até a luta com o chefão não
//              terminou em 90 min; a animação do chefão da documentação saiu de tools/galeria.cjs --giro (os modelos do jogo girando)
// A GPU daqui é por software (SwiftShader): por isso a partida corre à frente sem desenhar (o mesmo tique do jogo, sem HUD) até o
// ponto que interessa, e só então volta a desenhar.
// Uso: NODE_PATH=<pasta com node_modules/playwright> node tools/capturas-docs.cjs <fotos|batalha|chefao> [url=http://127.0.0.1:8765/] [quadros=50]  (env CAP_PASSO=tiques por quadro, CAP_W/CAP_H)
'use strict';
const path = require('path'); const fs = require('fs'); const root = path.resolve(__dirname, '..');
const { chromium, devices } = require('playwright');
const [modo = 'fotos', base = 'http://127.0.0.1:8765/', nq = '50'] = process.argv.slice(2);
const ARGS = ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'];
const OUT = root + '/docs/imagens/partida'; fs.mkdirSync(OUT, { recursive: true });
const log = (...a) => console.log('[capturas]', ...a);
async function abrir(b, url, ctxOpts) {
  const ctx = await b.newContext(Object.assign({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' }, ctxOpts || {})); const p = await ctx.newPage(); const errs = []; p.on('crash', () => log('a página caiu (crash do renderizador)'));
  p.on('pageerror', e => errs.push(e.message.slice(0, 200))); p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
  await p.goto(url, { waitUntil: 'load', timeout: 240000 }); return { ctx, p, errs };
}
const esperaPartida = p => p.waitForFunction(() => { const l = document.getElementById('loading'); return l && l.hidden && window.__ARDG && window.__ARDG.sim; }, null, { timeout: 400000, polling: 1000 });
/* corre a partida à frente sem desenhar: o tique do jogo (IA de 1 s em 1 s, simulação e eventos para o HUD), em blocos curtos */
async function avanca(p, ate, cond) {
  for (;;) { const r = await p.evaluate(([ate, cond]) => { const G = window.__ARDG, S = ARD.sim, sim = G.sim; G.speed = 0; const t0 = performance.now(); let ok = false;
      while (sim.time < ate && performance.now() - t0 < 1500) { if (sim.tick % 10 === 0) for (const a of G.ais) for (const c of ARD.ai.think(sim, a)) S.enqueue(sim, c); S.step(sim);
        if (cond && sim.tick % 10 === 0 && Function('sim', 'S', cond)(sim, S)) { ok = true; break; } }
      return { t: sim.time, ok, fim: sim.time >= ate }; }, [ate, cond || null]);
    if (r.ok || r.fim) return r; }
}
/* um quadro: N tiques (0,1 s de jogo cada) com os eventos para o desenho, e espera o motor desenhar dois quadros */
async function quadro(p, ticks, cam) {
  await p.evaluate(([ticks, cam]) => { const G = window.__ARDG, S = ARD.sim, sim = G.sim; G.speed = 0;
    for (let i = 0; i < ticks; i++) { if (sim.tick % 10 === 0) for (const a of G.ais) for (const c of ARD.ai.think(sim, a)) S.enqueue(sim, c); const ev = S.step(sim); try { G.R.onEvents(ev, sim, G.human); } catch (e) {} if (ARD.chefes) try { ARD.chefes.eventos(ev, G); } catch (e) {} }
    if (cam) { const c = G.view.cam; const f = cam.seguir ? (() => { const e = sim.ents.find(x => x.alive && x.boss); return e ? { x: e.x, y: e.y } : null; })() : null; if (f) { c.x += (f.x - c.x) * 0.25; c.y += (f.y - c.y) * 0.25; } if (cam.giro) c.yaw += cam.giro; }
    window.__q = 0; window.__img = null; const conta = () => { window.__q++; if (cam && cam.foto) { /* no mesmo quadro em que o jogo desenhou (o callback dele roda antes): o buffer do WebGL ainda vale */
        const w = document.getElementById('world'), o = document.getElementById('overlay'); const c = document.createElement('canvas'); c.width = w.width; c.height = w.height; const g = c.getContext('2d'); g.drawImage(w, 0, 0); if (o && o.width) g.drawImage(o, 0, 0, c.width, c.height); window.__img = c.toDataURL('image/jpeg', 0.9); } }; requestAnimationFrame(conta); }, [ticks, cam || null]);
  await p.waitForFunction(() => window.__q >= 1, null, { timeout: 600000, polling: 250 });
  if (cam && cam.foto) return Buffer.from((await p.evaluate(() => window.__img)).split(',')[1], 'base64');
}
/* onde está a luta: o centro das unidades que estão atacando perto de um inimigo */
const LUTA = `const xs = []; for (const e of sim.ents) if (e.alive && e.kind === 'unit' && e.target != null && e.cls !== 'civ') { const t = sim.byId.get(e.target); if (t && t.alive && t.kind === 'unit' && S.dist(e.x, e.y, t.x, t.y) < 260) xs.push(e); } const meus = xs.filter(e => e.owner === 0).length; if (sim.time < 420 || xs.length < 24 || meus < 8) return false; /* a luta do jogador (o lado 0): as cores do time contra o vermelho dos inimigos */ const mx = xs.filter(e => e.owner === 0); let x = 0, y = 0; for (const e of mx) { const t = sim.byId.get(e.target); x += (e.x + t.x) / 2; y += (e.y + t.y) / 2; } globalThis.__luta = { x: x / mx.length, y: y / mx.length, n: xs.length }; return true; /* o centro da linha de frente do jogador: entre as unidades dele e os alvos */`;
(async () => {
  const b = await chromium.launch({ headless: true, args: ARGS }); const t0 = Date.now(); const resumo = []; b.on('disconnected', () => log('o navegador fechou aos ' + ((Date.now() - t0) / 1000).toFixed(0) + ' s'));
  try {
    if (modo === 'fotos') {
      /* computador: tela inicial */
      { const { ctx, p, errs } = await abrir(b, base + '?lang=pt'); await p.waitForTimeout(20000); await p.screenshot({ path: OUT + '/inicio-pc.jpg', quality: 82, timeout: 900000 }); resumo.push('inicio-pc ' + (errs.length ? errs.join(' ; ') : 'sem erro')); await ctx.close(); }
      /* computador: partida com o HUD, aos ~9 min, e a batalha de perto */
      { const { ctx, p, errs } = await abrir(b, base + '?autostart=1&faction=vehnar&opp=2&diff=normal&seed=5&ia=todos&semcine=1&semsalvar=1&debug=1&dia=1&reveal=1&lang=pt'); await esperaPartida(p);
        const r = await avanca(p, 900, LUTA); log('pc: luta aos', r.t.toFixed(0), 's', r.ok);
        await p.evaluate(() => { const G = window.__ARDG, c = G.view.cam, l = globalThis.__luta; if (l) { c.x = l.x; c.y = l.y; } c.zoom = 1.25; c.pitch = c.pitchT = 0.85; });
        for (let i = 0; i < 25; i++) await quadro(p, 1); await p.screenshot({ path: OUT + '/partida-pc.jpg', quality: 82, timeout: 900000 });
        await p.evaluate(() => { const c = window.__ARDG.view.cam; c.zoom = 2.3; c.pitch = c.pitchT = 0.62; }); for (let i = 0; i < 6; i++) await quadro(p, 1); await p.screenshot({ path: OUT + '/batalha-pc.jpg', quality: 82, timeout: 900000 });
        const tm = await p.evaluate(() => window.__ARDG.sim.time); resumo.push('partida-pc t=' + tm.toFixed(0) + ' s ' + (errs.length ? errs.join(' ; ') : 'sem erro')); await ctx.close(); }
      /* celular: tela inicial e partida (toque) */
      const cel = Object.assign({}, devices['Pixel 7'] || {}, { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
      delete cel.defaultBrowserType;
      { const { ctx, p, errs } = await abrir(b, base + '?lang=pt', cel); await p.waitForTimeout(20000); await p.screenshot({ path: OUT + '/inicio-celular.jpg', quality: 80, timeout: 900000 }); resumo.push('inicio-celular ' + (errs.length ? errs.join(' ; ') : 'sem erro')); await ctx.close(); }
      { const { ctx, p, errs } = await abrir(b, base + '?autostart=1&faction=tessara&opp=1&diff=normal&seed=8&ia=todos&semcine=1&semsalvar=1&debug=1&dia=1&touch=1&lang=pt', cel); await esperaPartida(p);
        const r = await avanca(p, 420); log('celular: t', r.t.toFixed(0)); for (let i = 0; i < 20; i++) await quadro(p, 1); await p.screenshot({ path: OUT + '/partida-celular.jpg', quality: 80, timeout: 900000 });
        resumo.push('partida-celular ' + (errs.length ? errs.join(' ; ') : 'sem erro')); await ctx.close(); }
    } else {
      const chefe = modo === 'chefao'; const dir = root + '/dist/capturas-docs/' + modo; fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
      const W = +(process.env.CAP_W || 800), H = +(process.env.CAP_H || 450); const url = base + '?autostart=1&faction=' + (chefe ? 'erevane' : 'vehnar') + '&opp=' + (chefe ? '1' : '2') + '&diff=normal&seed=' + (chefe ? '12' : '5') + '&ia=todos&semcine=1&semsalvar=1&debug=1&dia=1&reveal=1&lang=pt' + (chefe ? '&chefe=forja' : '');
      const { ctx, p, errs } = await abrir(b, url, { viewport: { width: W, height: H } }); await esperaPartida(p);
      await p.addStyleTag({ content: 'body *{visibility:hidden!important}#world,#overlay{visibility:visible!important}' }); /* animação limpa: só o mapa (o canvas 3D e o das barras), sem o HUD */
      const cond = chefe ? `const e = sim.ents.find(x => x.alive && x.boss); if (!e) return false; let n = 0; for (const u of sim.ents) if (u.alive && u.kind === 'unit' && !u.boss && !u.parte && u.owner !== e.owner && S.dist(u.x, u.y, e.x, e.y) < 420) n++; return n >= 10 && e.hp < e.maxHp * 0.97;` : LUTA;
      const r = await avanca(p, chefe ? 1500 : 900, cond); log(modo + ': ponto aos', r.t.toFixed(0), 's', r.ok);
      await p.evaluate(chefe => { const G = window.__ARDG, c = G.view.cam, sim = G.sim; const e = chefe ? sim.ents.find(x => x.alive && x.boss) : null; const l = e ? { x: e.x, y: e.y } : globalThis.__luta; if (l) { c.x = l.x; c.y = l.y; } c.zoom = chefe ? 1.3 : 1.45; c.pitch = c.pitchT = 0.66; }, chefe);
      for (let i = 0; i < 8; i++) await quadro(p, 0); /* o motor assenta (sombras, resolução) */
      const N = +nq, PASSO = +(process.env.CAP_PASSO || 1); /* tiques por quadro: com a máquina carregada, 3 tiques (0,3 s) por quadro e a animação a 6 quadros/s */ for (let i = 0; i < N; i++) { const img = await quadro(p, PASSO, { seguir: chefe, giro: 0.006, foto: true }); fs.writeFileSync(dir + '/' + String(i).padStart(4, '0') + '.jpg', img); /* o canvas do jogo lido no próprio quadro: sem esperar outro quadro para a captura de tela */ if (i % 10 === 0 || i < 3) log(modo, i + '/' + N, ((Date.now() - t0) / 1000).toFixed(0) + ' s'); }
      resumo.push(modo + ': ' + N + ' quadros em ' + dir.replace(root + '/', '') + ' ' + (errs.length ? errs.join(' ; ') : 'sem erro')); await ctx.close();
    }
  } finally { await b.close(); }
  log(resumo.join(' | '), '|', ((Date.now() - t0) / 1000).toFixed(0) + ' s');
})().catch(e => { console.error('capturas falhou:', e.message); process.exit(1); });
