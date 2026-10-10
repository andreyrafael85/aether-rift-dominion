// Teste multiplayer real: N páginas no mesmo Chromium (PeerJS público + WebRTC). O anfitrião cria a sala, os convidados entram,
// espera todos em jogo, compara os hashes por tick entre as páginas e salva capturas.
// Uso: NODE_PATH=<pasta com node_modules/playwright> node tools/mp-test.cjs <url> <prefixo-saida> [n=2] [gfx=2d] [settleMs=12000]
const { chromium } = require('playwright');
(async () => {
  // early=1: sala maior que n e o anfitrião clica Iniciar · drop=1: fecha o último convidado após a espera e mostra como o anfitrião reage
  const [base, out, nStr = '2', gfx = '2d', settleStr = '12000', early = '0', drop = '0', browsersStr = 'chromium', joinvia = 'join', prejoin = '0'] = process.argv.slice(2); const n = +nStr, settle = +settleStr;
  // browsers=chromium,firefox,webkit (um por jogador, repete o último) · joinvia=start usa o botão Iniciar partida com o código digitado · prejoin=1: convidado entra ANTES do anfitrião abrir a sala (código persistido)
  const pw = require('playwright'); const names = browsersStr.split(','); const browsers = []; const ctxs = [];
  const chromeArgs = ['--no-sandbox', '--allow-file-access-from-files', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required', '--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows'];
  for (let i = 0; i < n; i++) { const nm = names[Math.min(i, names.length - 1)]; const b = await pw[nm].launch({ headless: true, args: nm === 'chromium' ? chromeArgs : [] }); browsers.push(b); ctxs.push(await b.newContext({ viewport: { width: 1000, height: 700 } })); }
  const browser = { close: async () => { for (const b of browsers) await b.close(); } };
  const logs = []; const tags = []; let pageN = 0;
  const mk = async (tag) => { const p = await ctxs[pageN++].newPage(); tags.push(tag + '[' + names[Math.min(pageN - 1, names.length - 1)] + ']'); p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning' || m.text().startsWith('[ARD]')) logs.push(tag + ' ' + m.type() + ': ' + m.text().slice(0, 300)); }); p.on('pageerror', e => logs.push(tag + ' PAGEERROR: ' + String(e.stack || e.message).slice(0, 500))); await p.goto(base); await p.waitForTimeout(400); await p.selectOption('#opt-gfx', gfx); return p; };
  const t0 = Date.now();
  const host = await mk('H'); await host.fill('#opt-name', 'Anfitriao'); if (await host.$('#opt-room')) await host.selectOption('#opt-room', String(early === '1' ? Math.min(4, n + 1) : n));
  const guests = []; let code = '';
  const joinAs = async (g, c) => { await g.fill('#opt-code', c); if (joinvia === 'start') await g.click('#btn-start'); else await g.click('#btn-join'); };
  if (prejoin === '1') { // convidado entra antes: o anfitrião vai reaproveitar o código salvo nas preferências
    const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; code = ''; for (let i = 0; i < 6; i++) code += A[Math.floor(Math.random() * A.length)];
    await host.evaluate(c => { localStorage.setItem('ard-beta-prefs', JSON.stringify({ room: c })); }, code);
    const g = await mk('G1'); await g.fill('#opt-name', 'Convidado1'); await joinAs(g, code); guests.push(g); await g.waitForTimeout(5000);
    console.log('convidado antes do anfitrião: ' + (await g.textContent('#mp-status')).trim());
  }
  await host.click('#btn-host');
  try { await host.waitForFunction(() => document.getElementById('opt-code').value.length === 6, null, { timeout: 30000 }); } catch (e) { logs.push('H TIMEOUT sala: ' + await host.textContent('#mp-status')); }
  const hostCode = await host.inputValue('#opt-code'); if (prejoin === '1' && hostCode !== code) logs.push('H código não reaproveitado: ' + hostCode + ' vs ' + code); code = hostCode;
  console.log('sala=' + code + ' em ' + (Date.now() - t0) + 'ms · status H: ' + (await host.textContent('#mp-status')).trim());
  for (let i = guests.length + 1; i < n; i++) { const g = await mk('G' + i); await g.fill('#opt-name', 'Convidado' + i); await joinAs(g, code); guests.push(g); await g.waitForTimeout(300); }
  const all = [host, ...guests];
  if (early === '1') { await host.waitForFunction(k => document.getElementById('mp-players').children.length >= k && !document.getElementById('btn-start').disabled, n, { timeout: 30000 }).catch(() => logs.push('H TIMEOUT lobby cheio')); console.log('lobby H: ' + (await host.textContent('#mp-players')).trim() + ' · botão: ' + (await host.textContent('#btn-start')).trim()); for (let i = 0; i < guests.length; i++) console.log('lobby G' + (i + 1) + ': botão "' + (await guests[i].textContent('#btn-start')).trim() + '" disabled=' + (await guests[i].$eval('#btn-start', b => b.disabled)) + ' · ' + (await guests[i].textContent('#mp-status')).trim()); await host.evaluate(() => document.querySelector('.mp').scrollIntoView()); await host.screenshot({ path: out + '-lobby-H.png' }); await guests[0].evaluate(() => document.querySelector('.mp').scrollIntoView()); await guests[0].screenshot({ path: out + '-lobby-G1.png' }); await host.click('#btn-start'); }
  for (let i = 0; i < all.length; i++) { try { await all[i].waitForFunction(() => window.ARD && ARD.inspect && ARD.inspect() && document.getElementById('loading').hidden, null, { timeout: 150000 }); } catch (e) { logs.push(tags[i] + ' TIMEOUT em jogo · status: ' + (await all[i].textContent('#mp-status')).trim()); } }
  console.log('todos em jogo (ou timeout) em ' + (Date.now() - t0) + 'ms; aguardando ' + settle + 'ms');
  await host.waitForTimeout(settle);
  const infos = []; for (const p of all) infos.push(await p.evaluate(() => (window.ARD && ARD.inspect) ? ARD.inspect() : null));
  infos.forEach((inf, i) => { if (!inf) { console.log(tags[i] + ': sem jogo'); return; } console.log(tags[i] + ': eu=' + inf.human + ' tick=' + inf.tick + ' waiting=' + inf.waiting + ' net=' + JSON.stringify(inf.net) + ' mpwait=' + inf.mpWait + ' ended=' + inf.ended); console.log('   jogadores: ' + inf.players.map(p => p.id + ':' + p.name + '/' + p.faction + (p.human ? '/H' : '/IA') + (p.alive ? '' : '/morto') + ' nucleo=' + p.nucleo + ' un=' + p.units).join(' | ')); });
  const ok = infos.filter(Boolean); if (ok.length >= 2 && ok[0].hashLog) { let same = 0, diff = 0, first = null; for (const t of Object.keys(ok[0].hashLog)) { const hs = ok.map(x => x.hashLog && x.hashLog[t]); if (hs.some(h => h == null)) continue; if (hs.every(h => h === hs[0])) same++; else { diff++; if (first == null) first = t + ': ' + hs.join(' vs '); } } console.log('hashes comparados: iguais=' + same + ' diferentes=' + diff + (first ? ' · primeiro diferente ' + first : '')); }
  for (let i = 0; i < all.length; i++) { try { await all[i].screenshot({ path: out + '-' + tags[i] + '.png', timeout: 10000 }); } catch (e) { logs.push(tags[i] + ' captura falhou (máquina lenta): ' + String(e.message).split('\n')[0].slice(0, 80)); } }
  if (drop === '1' && guests.length) { const victim = guests[guests.length - 1]; const before = await host.evaluate(() => ARD.inspect().tick); await victim.close(); await host.waitForTimeout(3000); console.log('  +3s banner H: ' + await host.evaluate(() => (document.getElementById('banner').hidden ? '' : document.getElementById('banner-title').textContent)) + ' tick ' + await host.evaluate(() => ARD.inspect().tick)); await host.waitForTimeout(9000); const inf = await host.evaluate(() => ARD.inspect()); const bt = await host.evaluate(() => (document.getElementById('banner').hidden ? '' : document.getElementById('banner-title').textContent + ' / ' + document.getElementById('banner-sub').textContent)); console.log('após queda do convidado: anfitrião tick ' + before + ' -> ' + inf.tick + ' waiting=' + inf.waiting + ' banner="' + bt + '"'); if (guests.length > 1) { const other = await guests[0].evaluate(() => ARD.inspect()); const bt2 = await guests[0].evaluate(() => (document.getElementById('banner').hidden ? '' : document.getElementById('banner-title').textContent)); console.log('outro convidado: tick ' + other.tick + ' waiting=' + other.waiting + ' banner="' + bt2 + '"'); } }
  await browser.close();
  for (const l of logs) console.log('  ' + l); if (!logs.length) console.log('  (sem erros de console/página)');
})().catch(e => { console.error('HARNESS FAIL', e.message); process.exit(1); });
