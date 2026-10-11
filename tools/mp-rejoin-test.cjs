// 4.1c — volta à sala: o convidado perde a conexão (sem recarregar) e depois recarrega a página; nos dois casos tem de voltar
// ao mesmo lugar e seguir com o mesmo estado do anfitrião (hashes iguais depois da volta).
// Uso: NODE_PATH=<pasta com node_modules/playwright> node tools/mp-rejoin-test.cjs <url-da-página> [settleMs=8000]
const pw = require('playwright');
(async () => {
  const [base, settleStr = '8000'] = process.argv.slice(2); const settle = +settleStr; const url = base + (base.includes('?') ? '&' : '?') + 'debug=1';
  const args = ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required', '--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--allow-file-access-from-files'];
  const bH = await pw.chromium.launch({ headless: true, args }), bG = await pw.chromium.launch({ headless: true, args });
  const logs = []; const mk = async (b, tag) => { const ctx = await b.newContext({ viewport: { width: 900, height: 640 } }); const p = await ctx.newPage(); p.on('console', m => { if (m.type() === 'error' || m.text().startsWith('[ARD]')) logs.push(tag + ' ' + m.type() + ': ' + m.text().slice(0, 200)); }); p.on('pageerror', e => logs.push(tag + ' PAGEERROR: ' + String(e.message).slice(0, 300))); await p.goto(url, { waitUntil: 'load', timeout: 180000 }); await p.waitForTimeout(500); await p.evaluate(() => { document.getElementById('opt-gfx').value = '2d'; }); return p; };
  const mpTab = p => p.click('.ctab[data-tab=multi]');
  const inGame = (p, ms) => p.waitForFunction(() => window.__ARDG && window.__ARDG.net && document.getElementById('loading').hidden, null, { timeout: ms || 180000 });
  const info = p => p.evaluate(() => { const G = window.__ARDG; return G ? { tick: G.sim.tick, state: G.net.state, hashes: G.hashLog || {}, rejoin: !!G.rejoin, banner: document.getElementById('banner').hidden ? '' : document.getElementById('banner-title').textContent } : null; });
  const cmp = async (label) => { const a = await info(H), b = await info(G); let same = 0, diff = 0, first = null; for (const t of Object.keys(a.hashes)) if (b.hashes[t] != null) { if (a.hashes[t] === b.hashes[t]) same++; else { diff++; if (!first) first = t; } }
    console.log(label + ': H tick ' + a.tick + ' (' + a.state + ') · G tick ' + b.tick + ' (' + b.state + ') · hashes iguais=' + same + ' diferentes=' + diff + (first ? ' primeiro=' + first : '') + ' · banner G: ' + b.banner); return { same, diff }; };
  const H = await mk(bH, 'H'); await H.fill('#opt-name', 'Anfitriao'); await mpTab(H); await H.selectOption('#opt-room', '2'); await H.click('#btn-host');
  await H.waitForFunction(() => document.getElementById('opt-code').value.length === 6, null, { timeout: 60000 }); const code = await H.inputValue('#opt-code'); console.log('sala ' + code);
  let G = await mk(bG, 'G'); await G.fill('#opt-name', 'Convidado'); await mpTab(G); await G.fill('#opt-code', code); await G.click('#btn-join');
  await inGame(H); await inGame(G); console.log('em jogo; aguardando ' + settle + ' ms'); await H.waitForTimeout(settle); const r0 = await cmp('antes da queda');
  // 1) queda sem recarregar: fecha a conexão do convidado com o anfitrião
  await G.evaluate(() => { window.__ARDG.net.hostConn.close(); }); const t1 = Date.now();
  await G.waitForFunction(() => { const G = window.__ARDG; return G.net.state === 'connected' && !G.rejoin; }, null, { timeout: 120000 }).catch(() => logs.push('G TIMEOUT na volta sem recarregar'));
  console.log('volta sem recarregar em ' + (Date.now() - t1) + ' ms'); await H.waitForTimeout(settle); const r1 = await cmp('depois da volta (sem recarregar)');
  // 2) recarregar a página do convidado (queda de energia/aba fechada): volta sozinho pela sessão gravada
  const t2 = Date.now(); await G.reload({ waitUntil: 'load', timeout: 180000 }); await G.evaluate(() => { const s = document.getElementById('resume-title'); return s ? s.textContent : ''; }).then(t => console.log('tela inicial do convidado: ' + t));
  await inGame(G, 240000).catch(() => logs.push('G TIMEOUT na volta depois de recarregar'));
  console.log('volta depois de recarregar em ' + (Date.now() - t2) + ' ms'); await G.waitForTimeout(settle); const r2 = await cmp('depois da volta (recarregando)');
  const ok = r0.diff === 0 && r1.diff === 0 && r2.diff === 0 && r1.same > 0 && r2.same > 0; console.log(ok ? 'REJOIN OK' : 'REJOIN FALHOU');
  await bH.close(); await bG.close(); for (const l of logs.slice(0, 20)) console.log('  ' + l); if (!logs.length) console.log('  (sem erros de console/página)'); process.exit(ok ? 0 : 1);
})().catch(e => { console.error('HARNESS FAIL', e.message); process.exit(1); });
