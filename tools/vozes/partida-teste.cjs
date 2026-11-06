// 5.0a.2: a voz dentro de uma partida de verdade (motor clássico, qualidade Baixa), com as vozes do Edge imitadas: legenda na tela,
// perigo cortando aviso de rotina, a escolha da voz na janela Ajustes da partida (em sincronia com a da tela inicial) e o "Ouvir".
// 5.0c.1: e, sem nenhum arquivo de voz (file://), a caixa "Vozes gravadas" na janela da partida, a resposta de unidade calada (ela só existe gravada) e
// o "Testar som" com "Voz gravada: sem arquivo" e a frase na voz do sistema. A voz gravada numa partida é do tools/vozes/gravadas-teste.cjs.
// Uso: NODE_PATH=<node_modules com playwright> node tools/vozes/partida-teste.cjs [--foto]
const path = require('path'), fs = require('fs'); const root = path.resolve(__dirname, '../..');
const pw = require('playwright'); const fake = require('./fala-falsa.cjs'); const SETS = require('./conjuntos.cjs');
const set = SETS.find(s => s.id === 'edge'); const foto = process.argv.includes('--foto');
const espera = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await pw.chromium.launch({ headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--allow-file-access-from-files', '--disable-dev-shm-usage'] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, userAgent: set.ua, locale: 'pt-BR' /* 5.0c: o jogo abre no idioma do navegador */ }); await ctx.addInitScript(`(${fake.toString()})(${JSON.stringify(set)})`);
  const p = await ctx.newPage(); p.setDefaultTimeout(600000); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const t0 = Date.now(); await p.goto('file://' + root + '/dist/local.html?lang=pt&autostart=1&faction=vehnar&opp=1&seed=5&q=baixa&semsalvar=1&legendas=1&debug=1', { waitUntil: 'load' });
  await p.waitForFunction(() => document.getElementById('loading') && document.getElementById('loading').hidden && window.__ARDG, null, { timeout: 600000 }); await espera(1500);
  const r = { carga_s: Math.round((Date.now() - t0) / 1000) };
  r.aviso = await p.evaluate(async () => { const F = __fala; F.log.length = 0; F.ev.length = 0; ARD.audio.say('Construção concluída', 'built', 4); await new Promise(x => setTimeout(x, 250)); const c = document.getElementById('caption');
    return { voz: (F.log[0] || {}).voz, pitch: (F.log[0] || {}).pitch, rate: (F.log[0] || {}).rate, legenda: c && !c.hidden ? c.querySelector('span').textContent : null, quem: c ? c.querySelector('b').textContent : null }; });
  r.perigo = await p.evaluate(async () => { const F = __fala; await new Promise(x => setTimeout(x, 3300)); F.log.length = 0; F.ev.length = 0; ARD.audio.say('Unidade pronta', 'spawn', 5); await new Promise(x => setTimeout(x, 120)); ARD.audio.say('Base sob ataque', 'Base sob ataque', 8); await new Promise(x => setTimeout(x, 500));
    const c = document.getElementById('caption'); return { falas: F.log.map(l => l.text + ' (' + l.rate + ')'), eventos: F.ev.join(','), legenda: c && !c.hidden ? c.querySelector('span').textContent : null, repetida: ARD.audio.say('Base sob ataque', 'Base sob ataque', 8) }; });
  await p.click('#btn-a11y'); await espera(400);
  r.ajustes = await p.evaluate(() => { const s = document.getElementById('pt-voz-sel'); const m = document.getElementById('a11y'); return { aberto: !m.hidden, opcoes: s ? [...s.options].map(o => o.textContent) : null, valor: s ? s.value : null, dica: (m.querySelector('[data-voz-dica]') || {}).textContent || '' }; });
  if (foto) { fs.mkdirSync(root + '/work/fotos', { recursive: true }); await p.locator('#a11y .box').screenshot({ path: root + '/work/fotos/depois-ajustes-partida.png' }); }
  const alvo = await p.evaluate(() => [...document.getElementById('pt-voz-sel').options].find(o => /Antonio/.test(o.textContent)).value);
  await p.selectOption('#pt-voz-sel', alvo); await espera(100);
  r.escolha = await p.evaluate(async () => { const F = __fala; F.log.length = 0; document.getElementById('pt-voz-ouvir').click(); await new Promise(x => setTimeout(x, 300)); return { ouvir: (F.log[F.log.length - 1] || {}).voz, texto: (F.log[F.log.length - 1] || {}).text, inicio: document.getElementById('opt-voz-sel').value, salvo: JSON.parse(localStorage.getItem('ard-audio') || '{}').voz }; });
  await p.selectOption('#pt-voz-sel', '');
  r.gravadas = await p.evaluate(async () => { const F = __fala; F.log.length = 0; const G = __ARDG; const ids = G.sim.ents.filter(e => e.alive && e.owner === G.human && e.kind === 'unit').map(e => e.id); G.I.select(ids); await new Promise(x => setTimeout(x, 400)); const resp = F.log.length; /* 5.0c.1 */
    const cb = document.getElementById('pt-voz-gravada'); document.getElementById('pt-som-teste').click(); await new Promise(x => setTimeout(x, 1500)); return { caixa: !!cb && cb.checked, estado: ARD.vozes ? ARD.vozes.estado : null, unidades: ids.length, respostaSemArquivo: resp, diag: document.getElementById('pt-som-diag').textContent }; });
  r.erros = errs.slice(0, 3); r.ok = /Antonio/.test(r.aviso.voz || '') /* 5.0c.1: desde a 5.0c o locutor fala no gênero do locutor da Raça (Vehnar: masculino); a expectativa antiga (Francisca) falhava já na base 1cb18f9 */ && r.aviso.pitch === 1 && r.aviso.legenda === 'Construção concluída' && r.perigo.falas.length === 2 && /Base sob ataque/.test(r.perigo.falas[1]) && /fim,inicio/.test(r.perigo.eventos) && r.perigo.legenda === 'Base sob ataque' && r.perigo.repetida === false && r.ajustes.aberto && r.ajustes.opcoes && r.ajustes.opcoes.length > 3 && /Antonio/.test(r.escolha.ouvir || '') && r.escolha.inicio === alvo && r.escolha.salvo === alvo && r.gravadas.caixa && r.gravadas.estado === 'indisponivel' && r.gravadas.respostaSemArquivo === 0 && /Voz gravada: sem arquivo/.test(r.gravadas.diag) && /Fala: tocou/.test(r.gravadas.diag) /* 5.0c.1 */ && !errs.length;
  await b.close(); fs.writeFileSync(root + '/work/partida-teste.json', JSON.stringify(r, null, 2)); console.log(JSON.stringify(r, null, 1)); console.log('partida: ' + (r.ok ? 'ok' : 'FALHOU')); process.exit(r.ok ? 0 : 1);
})();
