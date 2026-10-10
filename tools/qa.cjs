// Portão de qualidade do Aether Rift (4.0d): roda tudo o que existe de verificação e imprime a linha "Qualidade e deploy".
// Uso: NODE_PATH=<pasta com node_modules/playwright> node tools/qa.cjs [--rapido]   (--rapido pula determinismo entre motores)
const { execSync, spawnSync } = require('child_process'); const fs = require('fs'); const path = require('path');
const root = path.resolve(__dirname, '..'); const rapido = process.argv.includes('--rapido'); const R = {}; const t0 = Date.now();
const run = (cmd, args, opts) => spawnSync(cmd, args, Object.assign({ cwd: root, encoding: 'utf8', timeout: 900000, maxBuffer: 64 * 1024 * 1024 }, opts || {}));
// 1) sintaxe de todo JS do projeto
{ const files = []; for (const d of ['src', 'tools']) for (const f of fs.readdirSync(path.join(root, d))) if (/\.(c?js|mjs)$/.test(f)) files.push(path.join(d, f)); let ok = 0; const bad = []; for (const f of files) { const r = run(process.execPath, ['--check', f]); if (r.status === 0) ok++; else bad.push(f + ': ' + (r.stderr || '').split('\n').slice(0, 2).join(' ')); } R.sintaxe = { ok, total: files.length, bad }; }
// 2) build
{ const r = run(process.execPath, ['tools/build.mjs']); const m = (r.stdout || '').match(/build (\S+ \S+Z) · jogo (\d+) bytes/); const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8'); const ver = (html.match(/Versão (\d+\.\d+[a-z]?) · build/) || [])[1]; const verJs = (fs.readFileSync(path.join(root, 'src/main.js'), 'utf8').match(/versao: '([^']+)'/) || [])[1];
  R.build = { ok: r.status === 0 && !!m && !html.includes('__BUILD__'), stamp: m && m[1], bytes: m && +m[2] }; R.versao = { ok: !!ver && ver === verJs, html: ver, js: verJs }; }
// 3) malhas 3D (5 Raças + cenário) no Node
{ const r = run(process.execPath, ['tools/meshes-test.mjs']); const m = (r.stdout || '').match(/malhas: (\d+) ok, (\d+) falhas/); R.malhas = { ok: m ? +m[1] : 0, falhas: m ? +m[2] : -1 }; }
// 4) testes headless da simulação (cada linha com OK/FAIL conta)
{ const r = run(process.execPath, ['tools/test.cjs']); const out = (r.stdout || '') + (r.stderr || ''); const oks = (out.match(/\bOK\b/g) || []).length, fails = (out.match(/\bFAIL\b/g) || []).length; R.testes = { ok: oks, falhas: fails + (r.status === 0 ? 0 : 1), status: r.status }; }
// 5) determinismo entre motores (Node, Chromium, Firefox, WebKit)
if (!rapido) { const r = run(process.execPath, ['tools/det-test.cjs', '7', '2000']); const out = r.stdout || ''; const iguais = (out.match(/IGUAL ao Node/g) || []).length; R.determinismo = { ok: iguais + (out.includes('node (V8)') ? 1 : 0), total: 4, out: out.trim().split('\n') }; }
// 6) smoke no navegador: tela inicial (ajuda abre e fecha, logo) e uma partida por Raça sem erro
{ let pw = null; try { pw = require('playwright'); } catch (e) {}
  if (pw) { const res = spawnSync(process.execPath, ['-e', `
    const pw = require('playwright'); const root = ${JSON.stringify(root)};
    (async () => { const b = await pw.chromium.launch({ headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--allow-file-access-from-files', '--disable-dev-shm-usage'] }); const out = { inicio: null, racas: {} };
      { const p = await b.newPage({ viewport: { width: 1280, height: 800 } }); const errs = []; p.on('pageerror', e => errs.push(e.message)); await p.goto('file://' + root + '/dist/local.html', { waitUntil: 'load' }); await p.waitForTimeout(2500);
        await p.click('#btn-help-start'); const ab = await p.evaluate(() => !document.getElementById('help').hidden); await p.click('#help .mclose'); const fe = await p.evaluate(() => document.getElementById('help').hidden); out.inicio = { ok: ab && fe && !errs.length, erros: errs.slice(0, 3) }; await p.close(); }
      for (const f of ['vehnar', 'erevane', 'tessara', 'quorith', 'vorag']) { const p = await b.newPage({ viewport: { width: 960, height: 600 } }); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
        await p.goto('file://' + root + '/dist/local.html?autostart=1&faction=' + f + '&opp=1&seed=5&ff=20&q=baixa', { waitUntil: 'load' }); try { await p.waitForFunction(() => document.getElementById('loading').hidden, null, { timeout: 120000 }); } catch (e) { errs.push('carregamento não terminou'); }
        await p.waitForTimeout(1500); const hud = await p.evaluate(() => ({ lider: (document.getElementById('leader-name') || {}).textContent || '', tempo: (document.querySelector('#hud-time, .time, #clock') || {}).textContent || '' })); out.racas[f] = { ok: !errs.length && !!hud.lider, lider: hud.lider, erros: errs.slice(0, 3) }; await p.close(); }
      await b.close(); console.log(JSON.stringify(out)); })();`], { cwd: root, encoding: 'utf8', timeout: 900000, env: process.env });
    try { R.smoke = JSON.parse((res.stdout || '').trim().split('\n').pop()); } catch (e) { R.smoke = { erro: (res.stderr || res.stdout || '').slice(0, 400) }; } }
  else R.smoke = { erro: 'playwright indisponível (defina NODE_PATH)' }; }
// resumo
const ck = b => b ? '✅' : '❌'; const sm = R.smoke && R.smoke.racas ? Object.values(R.smoke.racas).filter(x => x.ok).length : 0;
const parts = [`sintaxe ${ck(R.sintaxe.ok === R.sintaxe.total)} ${R.sintaxe.ok}/${R.sintaxe.total}`, `malhas 3D ${ck(R.malhas.falhas === 0)} ${R.malhas.ok}/${R.malhas.ok + Math.max(0, R.malhas.falhas)}`, `testes ${ck(R.testes.falhas === 0)} ${R.testes.ok}/${R.testes.ok + R.testes.falhas}`];
if (R.determinismo) parts.push(`determinismo ${ck(R.determinismo.ok === 4)} ${R.determinismo.ok}/4 motores`);
parts.push(`smoke ${ck(sm === 5 && R.smoke.inicio && R.smoke.inicio.ok)} ${sm}/5 Raças + tela inicial ${R.smoke && R.smoke.inicio && R.smoke.inicio.ok ? 'ok' : 'falhou'}`, `build ${ck(R.build.ok)} ${R.build.stamp} (${Math.round((R.build.bytes || 0) / 1024)} KB)`, `versão ${ck(R.versao.ok)} ${R.versao.html}`);
fs.mkdirSync(path.join(root, 'dist'), { recursive: true }); fs.writeFileSync(path.join(root, 'dist/qa.json'), JSON.stringify(R, null, 2));
console.log('Qualidade e deploy: ' + parts.join(' · ')); console.log('tempo ' + Math.round((Date.now() - t0) / 1000) + ' s · detalhes em dist/qa.json');
const fail = R.sintaxe.ok !== R.sintaxe.total || R.malhas.falhas !== 0 || R.testes.falhas !== 0 || (R.determinismo && R.determinismo.ok !== 4) || sm !== 5 || !R.build.ok || !R.versao.ok; process.exit(fail ? 1 : 0);
