// 5.0a.2: teste da voz do sistema com conjuntos de vozes simulados (Edge, Chrome e Firefox no Windows, iPhone, sem voz em português):
// escolha automática, tom e velocidade, lista e "Ouvir" em Ajustes, voz lembrada no aparelho, legendas e o evento 'ard-voz' (boca do líder).
// speechSynthesis e SpeechSynthesisUtterance são trocados por uma imitação que devolve o conjunto do navegador e grava cada fala.
// 5.0c.1: e a caixa "Vozes gravadas" de Ajustes: ligada por padrão nas duas janelas, desligar guarda no aparelho (vale depois de recarregar) e as duas
// janelas ficam em sincronia; o texto sai no idioma (inglês).
// Uso: NODE_PATH=<node_modules com playwright> node tools/vozes/vozes-teste.cjs [rotulo=depois] [--fotos] [--firefox]
const path = require('path'), fs = require('fs'); const root = path.resolve(__dirname, '../..');
const SETS = require('./conjuntos.cjs');
const rotulo = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'depois'; const fotos = process.argv.includes('--fotos'); const ff = process.argv.includes('--firefox');
const pw = require('playwright');
const url = 'file://' + root + '/dist/local.html';
const fake = require('./fala-falsa.cjs');
const espera = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await (ff ? pw.firefox.launch({ headless: true }) : pw.chromium.launch({ headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--allow-file-access-from-files', '--disable-dev-shm-usage'] }));
  const out = { rotulo, navegador: ff ? 'firefox' : 'chromium', quando: new Date().toISOString(), conjuntos: {} };
  if (fotos) fs.mkdirSync(root + '/work/fotos', { recursive: true });
  for (const set of SETS) {
    const movel = /iPhone/.test(set.ua); const ctx = await b.newContext(Object.assign({ viewport: movel ? { width: 390, height: 844 } : { width: 1280, height: 800 }, userAgent: set.ua, locale: 'pt-BR' /* 5.0c: o jogo abre no idioma do navegador */ }, movel && !ff ? { deviceScaleFactor: 2, isMobile: true, hasTouch: true } : {}));
    await ctx.addInitScript(`(${fake.toString()})(${JSON.stringify(set)})`);
    const p = await ctx.newPage(); p.setDefaultTimeout(120000); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(url + '?aba=ajustes', { waitUntil: 'load' }); await p.waitForFunction(() => window.ARD && ARD.audio); await espera(Math.max(900, (set.atraso || 0) + 500));
    await p.evaluate(() => { const A = ARD.audio; const o = A.onSay; A.onSay = (t, k) => { __fala.caps.push(t); if (o) o(t, k); }; });
    const fala = await p.evaluate(async () => { const F = __fala; F.log.length = 0; F.ev.length = 0; F.caps.length = 0; ARD.audio.say('Construção concluída', 'built', 4); await new Promise(r => setTimeout(r, 900)); return { log: F.log.slice(), ev: F.ev.slice(), caps: F.caps.slice() }; });
    const u = fala.log[fala.log.length - 1] || {}; /* a última: na voz online sem rede, a primeira tentativa falha e a fala repete na local */ const r = { nome: set.nome, voz: u.voz || null, uri: u.uri || null, pitch: u.pitch, rate: u.rate, lang: u.lang, evento: fala.ev.join(','), legendas: fala.caps.length, espera: set.espera ? String(set.espera) : null };
    r.vozOk = set.espera ? !!(u.voz && set.espera.test(u.voz)) : !u.voz; r.tomOk = u.pitch === 1 && u.rate >= 0.95 && u.rate <= 1.1; r.bocaOk = /^(fim,)?inicio(,palavra)+,fim$/.test(r.evento); r.tentativas = fala.log.length;
    const ui = await p.evaluate(() => { const s = document.getElementById('opt-voz-sel'); if (!s) return null; const box = s.closest('[data-voz-ui]'); return { valor: s.value, opcoes: [...s.options].map(o => ({ v: o.value, t: o.textContent, g: o.parentElement.tagName === 'OPTGROUP' ? o.parentElement.label : '' })), dica: box && box.querySelector('[data-voz-dica]') ? box.querySelector('[data-voz-dica]').textContent : '', partida: !!document.getElementById('pt-voz-sel') }; });
    r.ajustes = ui ? { padrao: ui.valor === '' ? 'Automática' : ui.valor, opcoes: ui.opcoes.map(o => o.t), dica: ui.dica, naPartida: ui.partida } : null;
    if (fotos && (set.id === 'edge' || set.id === 'iphone' || set.id === 'firefox-win')) { try { const pane = p.locator('.cpane[data-pane="ajustes"]'); await pane.scrollIntoViewIfNeeded(); await pane.screenshot({ path: root + '/work/fotos/' + rotulo + '-ajustes-' + set.id + '.png' }); } catch (e) { r.foto = 'falhou: ' + e.message.split('\n')[0]; } }
    if (ui) {
      const ouvir = async () => p.evaluate(async () => { const F = __fala; F.log.length = 0; document.getElementById('btn-voz-ouvir').click(); await new Promise(r => setTimeout(r, 300)); return F.log[F.log.length - 1] || null; });
      const o1 = await ouvir(); r.ouvirAuto = o1 ? { texto: o1.text, voz: o1.voz } : null;
      const alvo = set.pularEscolha ? null : ui.opcoes.filter(o => o.v && o.v !== (u.uri || '')).slice(0, 1)[0]; /* sem rede: só a escolha automática e o Ouvir */
      if (alvo) {
        await p.selectOption('#opt-voz-sel', alvo.v); const o2 = await ouvir(); r.ouvirEscolhida = o2 ? { alvo: alvo.t, voz: o2.voz } : null;
        const sinc = await p.evaluate(() => (document.getElementById('pt-voz-sel') || {}).value); await p.reload({ waitUntil: 'load' }); await p.waitForFunction(() => window.ARD && ARD.audio); await espera(Math.max(900, (set.atraso || 0) + 500));
        const dep = await p.evaluate(async () => { const F = __fala; F.log.length = 0; ARD.audio.say('Unidade pronta', 'spawn', 5); await new Promise(r => setTimeout(r, 600)); return { valor: document.getElementById('opt-voz-sel').value, voz: (F.log[0] || {}).voz || null, salvo: localStorage.getItem('ard-audio') }; });
        r.lembrada = { alvo: alvo.v, depoisDeRecarregar: dep.valor, voz: dep.voz, partidaSincronizada: sinc === alvo.v, ok: dep.valor === alvo.v && !!dep.voz && alvo.t.startsWith(dep.voz.replace(/^Microsoft\s+/, '').split(/[ (]/)[0]) };
        await p.selectOption('#opt-voz-sel', ''); r.voltouAutomatica = await p.evaluate(() => JSON.parse(localStorage.getItem('ard-audio') || '{}').voz === '');
      }
    }
    r.erros = errs.concat(await p.evaluate(() => __fala.erros)).slice(0, 3);
    out.conjuntos[set.id] = r; await ctx.close();
    console.log(`${set.nome.padEnd(42)} voz: ${String(r.voz).padEnd(62)} pitch ${r.pitch} rate ${r.rate} · boca ${r.bocaOk ? 'ok' : r.evento} · legendas ${r.legendas}${ui ? ` · Ajustes ${ui.opcoes.length} opções (padrão ${r.ajustes.padrao})${r.lembrada ? ' · lembrada ' + (r.lembrada.ok ? 'ok' : 'FALHOU') : ''}` : ' · sem escolha em Ajustes'}`);
  }
  { /* 5.0c.1: Vozes gravadas em Ajustes */ const set = SETS.find(s => s.id === 'edge'); const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, userAgent: set.ua, locale: 'pt-BR' }); await ctx.addInitScript(`(${fake.toString()})(${JSON.stringify(set)})`);
    const p = await ctx.newPage(); p.setDefaultTimeout(120000); const errs = []; p.on('pageerror', e => errs.push(e.message)); await p.goto(url + '?aba=ajustes', { waitUntil: 'load' }); await p.waitForFunction(() => window.ARD && ARD.audio); await espera(900);
    const ver = () => p.evaluate(() => ({ inicio: document.getElementById('opt-voz-gravada').checked, partida: document.getElementById('pt-voz-gravada').checked, A: ARD.audio.gravadas, salvo: JSON.parse(localStorage.getItem('ard-audio') || '{}').gravadas }));
    const g = { padrao: await ver() }; await p.locator('#opt-voz-gravada').scrollIntoViewIfNeeded(); await p.click('#opt-voz-gravada'); await espera(150); g.desligada = await ver();
    await p.reload({ waitUntil: 'load' }); await p.waitForFunction(() => window.ARD && ARD.audio); await espera(700); g.recarregada = await ver();
    await p.evaluate(() => { const cb = document.getElementById('pt-voz-gravada'); cb.checked = true; cb.dispatchEvent(new Event('change')); }); await espera(150); g.religada = await ver();
    await p.evaluate(() => ARD.i18n.set('en', { salvar: false })); await espera(600); g.ingles = await p.evaluate(() => document.querySelector('label.voz-grav span').textContent);
    if (fotos) { try { await p.evaluate(() => ARD.i18n.set('pt-BR', { salvar: false })); await espera(300); const pane = p.locator('.cpane[data-pane="ajustes"] .voz-ui'); await pane.scrollIntoViewIfNeeded(); await pane.screenshot({ path: root + '/work/fotos/' + rotulo + '-vozes-gravadas.png' }); } catch (e) {} }
    g.erros = errs.slice(0, 3); g.ok = g.padrao.inicio && g.padrao.partida && g.padrao.A === true && !g.desligada.inicio && !g.desligada.partida && g.desligada.salvo === false && !g.recarregada.inicio && !g.recarregada.partida && g.recarregada.A === false && g.religada.inicio && g.religada.partida && g.religada.salvo === true && /^Recorded voices/.test(g.ingles) && !errs.length;
    out.gravadasUI = g; await ctx.close(); console.log(`${'Vozes gravadas em Ajustes'.padEnd(42)} ${g.ok ? 'ok' : 'FALHOU ' + JSON.stringify(g)}`); }
  await b.close();
  fs.mkdirSync(root + '/work', { recursive: true }); fs.writeFileSync(root + '/work/vozes-teste-' + rotulo + (ff ? '-firefox' : '') + '.json', JSON.stringify(out, null, 2));
  const all = Object.values(out.conjuntos); const ok = all.filter(r => r.vozOk && r.tomOk && r.bocaOk && r.legendas === 1 && !r.erros.length && (!r.ajustes || (r.ajustes.padrao === 'Automática' && r.ajustes.naPartida && (!r.lembrada || (r.lembrada.ok && r.lembrada.partidaSincronizada && r.ouvirEscolhida && r.ouvirEscolhida.voz)) && r.voltouAutomatica !== false && !!r.ouvirAuto && /Fenda/.test(r.ouvirAuto.texto)))).length;
  console.log(`vozes: ${ok}/${all.length} conjuntos ok · Vozes gravadas em Ajustes ${out.gravadasUI && out.gravadasUI.ok ? 'ok' : 'FALHOU'} (${rotulo}${ff ? ', Firefox' : ''})`); process.exit(ok === all.length && out.gravadasUI && out.gravadasUI.ok ? 0 : 1); /* 5.0c.1 */
})();
