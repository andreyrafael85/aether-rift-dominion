// 5.0c — teste dos idiomas (pt-BR base, inglês e espanhol), usado pelo portão de qualidade (tools/qa.cjs, item "idiomas").
// Reprova quando: falta chave em en ou es; os marcadores {x} não batem; o HTML usa chave que não existe; sobra texto em português na tela em
// en ou es (DOM da tela inicial e de uma partida curta); há qualquer erro na tela inicial e na partida em en e em es.
// Uso: NODE_PATH=<pasta com node_modules/playwright> node tools/idiomas-test.cjs [--so-estatico] [--json]   (a última linha é o JSON do resultado)
const fs = require('fs'); const path = require('path'); const vm = require('vm');
const root = path.resolve(__dirname, '..'); const L = ['pt-BR', 'en', 'es']; const SO_INICIO = process.argv.includes('--so-inicio'); const SO = (process.argv.find(a => a.startsWith('--idiomas=')) || '').slice(10).split(',').filter(Boolean); /* --so-inicio e --idiomas=en,es: rodadas parciais durante o trabalho (o portão roda tudo) */
const out = { estatico: null, idiomas: {} };
// ---------- 1) estático: dicionários e HTML ----------
{ const ctx = { globalThis: null }; ctx.globalThis = ctx; vm.createContext(ctx); for (const l of L) vm.runInContext(fs.readFileSync(path.join(root, 'src/i18n', l + '.js'), 'utf8'), ctx);
  const D = ctx.ARD.I18N_DIC; const base = D['pt-BR'] || {}; const ph = v => [...new Set(String(typeof v === 'object' && v ? Object.values(v).join(' ') : v).match(/\{\w+\}/g) || [])].sort().join(',');
  const r = { chaves: Object.keys(base).length, falta: {}, sobra: {}, marcadores: [], plural: [], html: [] };
  for (const l of ['en', 'es']) { const d = D[l] || {}; r.falta[l] = Object.keys(base).filter(k => !(k in d)); r.sobra[l] = Object.keys(d).filter(k => !(k in base));
    for (const k in base) if (k in d) { if (ph(base[k]) !== ph(d[k])) r.marcadores.push(l + ':' + k); const ob = typeof base[k] === 'object', od = typeof d[k] === 'object'; if (ob !== od || (od && d[k].other == null)) r.plural.push(l + ':' + k); } }
  const tpl = fs.readFileSync(path.join(root, 'src/index.tpl.html'), 'utf8'); const mapa = fs.existsSync(path.join(root, 'src/i18n/mapa-html.js')) ? fs.readFileSync(path.join(root, 'src/i18n/mapa-html.js'), 'utf8') : '';
  const usadas = new Set(); for (const m of tpl.matchAll(/data-i18n="([^"]+)"/g)) usadas.add(m[1]); for (const m of tpl.matchAll(/data-i18n-attr="([^"]+)"/g)) for (const p of m[1].split(';')) usadas.add(p.split(':')[1]); for (const m of mapa.matchAll(/:\s*'([a-z0-9.\-]+)'/g)) usadas.add(m[1]);
  r.html = [...usadas].filter(k => k && !(k in base)); r.htmlChaves = usadas.size;
  r.ok = !r.falta.en.length && !r.falta.es.length && !r.marcadores.length && !r.plural.length && !r.html.length; out.estatico = r; }
// ---------- 2) navegador: tela inicial e partida curta em cada idioma ----------
/* detector de português que sobrou na tela (roda na página): letras que só o pt usa (ã õ ç â ê ô à) e palavras que só existem em pt; nomes próprios do glossário ficam de fora */
const DETECTOR = function ({ raizes, idioma }) {
  const NOMES = /Barão-Forja|Barão|Ísk|Kessari|Oriel|Quor|Velk|Zayin|Oryn|Vey|Vassi|Oru|Sylvia|Vesper|Coral|Voraz|Andrey Rafael|Aether Rift|Dominion/g;
  const LETRAS = idioma === 'en' ? /[À-ÖØ-öø-ÿ]/ : /[ãõçâêôà]/i;
  const PAL_COMUM = ['não', 'você', 'vocês', 'são', 'também', 'então', 'com', 'sem', 'uma', 'umas', 'uns', 'ou', 'seu', 'sua', 'seus', 'suas', 'das', 'na', 'nas', 'em', 'ao', 'aos', 'pelo', 'pela', 'pelos', 'pelas', 'até', 'mais', 'ainda', 'já', 'só', 'isso', 'isto', 'aqui', 'onde', 'quando', 'agora', 'depois', 'muito', 'nenhum', 'nenhuma', 'fica', 'ficam', 'tem', 'foi', 'jogo', 'jogar', 'jogador', 'jogadores', 'coletor', 'coletores', 'minério', 'nó', 'nós', 'mapa', 'carregar', 'salvar', 'ajuda', 'vida', 'tempo', 'pesquisa', 'tela', 'toque', 'clique', 'botão'];
  const PAL = new Set(idioma === 'en' ? PAL_COMUM.concat(['de', 'da', 'dos', 'é', 'os', 'para', 'por', 'que', 'um', 'partida', 'construir', 'atacar', 'parar', 'recursos', 'energia', 'núcleo', 'raça']) : PAL_COMUM.filter(w => !['mapa', 'vida', 'toque', 'salvar', 'clique'].includes(w)).concat(['do', 'um'])); /* em es: "mapa", "vida", "toque" e "salvar" existem; "e" vem antes de i- (Girar e Inclinar) e "dos" é dois */
  const sobras = []; const visto = new Set();
  const pula = el => { for (let e = el; e; e = e.parentElement) { if (/^(SCRIPT|STYLE|TEXTAREA|NOSCRIPT)$/.test(e.tagName) || e.closest && e.closest('svg')) return true; if (e.id === 'errbox' || e.id === 'dbg' || e.id === 'build-info') return true; if (e.classList && e.classList.contains('oldnotes') && !(el.closest && el.closest('summary'))) return true; if (e.getAttribute && e.getAttribute('lang') && e !== document.documentElement) return true; } /* lang próprio: o histórico em pt-BR e o nome de cada idioma no seletor */ return false; };
  const checa = (txt, onde) => { const t = String(txt || '').replace(NOMES, ' ').trim(); if (!t || !/[A-Za-zÀ-ÿ]{2}/.test(t)) return; const ws = t.toLowerCase().split(/[^a-zà-ÿ]+/).filter(Boolean); const ruim = ws.filter(w => PAL.has(w)); if (LETRAS.test(t) || ruim.length) { const k = onde + '|' + t; if (visto.has(k)) return; visto.add(k); sobras.push({ onde, texto: t.slice(0, 120), palavras: ruim.slice(0, 4) }); } };
  const caminho = el => { const p = []; for (let e = el; e && e.nodeType === 1 && p.length < 4; e = e.parentElement) p.unshift(e.id ? '#' + e.id : e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.split(' ')[0] : '')); return p.join('>'); };
  for (const sel of raizes) { const r = document.querySelector(sel); if (!r) continue; const w = document.createTreeWalker(r, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT); let n;
    while ((n = w.nextNode())) { if (n.nodeType === 3) { if (!pula(n.parentElement)) checa(n.nodeValue, caminho(n.parentElement)); } else { if (pula(n)) continue; for (const a of ['title', 'aria-label', 'placeholder', 'alt', 'data-tip', 'data-lbl']) { const v = n.getAttribute(a); if (v) checa(v, caminho(n) + '@' + a); } if (n.tagName === 'OPTGROUP') checa(n.label, caminho(n) + '@label'); } } }
  return sobras; };
async function navegador() { let pw; try { pw = require('playwright'); } catch (e) { return { erro: 'playwright indisponível (defina NODE_PATH)' }; }
  const b = await pw.chromium.launch({ headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--allow-file-access-from-files', '--disable-dev-shm-usage'] });
  const url = q => 'file://' + root + '/dist/local.html?' + q;
  const R = {};
  try {
    for (const l of L) { if (SO.length && !SO.includes(l)) continue; const res = R[l] = { inicio: null, partida: null };
      { /* tela inicial: as quatro abas, a janela da campanha, a ajuda, os termos e a privacidade */
        const p = await b.newPage({ viewport: { width: 1280, height: 800 } }); p.setDefaultTimeout(180000); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
        await p.goto(url('lang=' + l + '&fundo=off'), { waitUntil: 'load' }); await p.waitForTimeout(2500);
        const st = await p.evaluate(() => ({ idioma: window.ARD && ARD.idioma, lang: document.documentElement.lang, sel: [...document.querySelectorAll('[data-idioma-sel] select')].map(s => s.value), espera: document.documentElement.classList.contains('i18n-espera'), faltas: ARD.i18n ? ARD.i18n.faltas() : ['sem i18n'] }));
        for (const t of ['campanha', 'multi', 'ajustes', 'jogar']) { const tab = await p.$('.ctab[data-tab=' + t + ']'); if (tab) { await tab.click(); await p.waitForTimeout(200); } }
        await p.evaluate(() => { const b = document.getElementById('btn-campaign'); if (b) b.click(); }); await p.waitForTimeout(600); /* a janela da campanha monta o conteúdo ao abrir */
        const sobras = l === 'pt-BR' ? [] : await p.evaluate(DETECTOR, { raizes: ['#start', '#campaign', '#help', '#termos', '#priv'], idioma: l });
        const nl = l === 'en' ? 'es' : 'en'; await p.evaluate(nl => { const s = document.querySelector('[data-idioma-sel] select'); if (s) { s.value = nl; s.dispatchEvent(new Event('change')); } }, nl); /* troca sem recarregar (o dicionário que ainda não veio é baixado na hora) */
        await p.waitForFunction(nl => window.ARD && ARD.idioma === nl, nl, { timeout: 30000 }).catch(() => {}); const troca = await p.evaluate(() => ({ idioma: ARD.idioma, lang: document.documentElement.lang, botao: (document.getElementById('btn-start') || {}).textContent }));
        await p.waitForTimeout(500); const sobrasTroca = l === 'pt-BR' ? [] : await p.evaluate(DETECTOR, { raizes: ['#start'], idioma: l === 'en' ? 'es' : 'en' });
        await p.evaluate(() => { try { localStorage.removeItem('ard-idioma'); } catch (e) {} });
        res.inicio = { ok: !errs.length && st.idioma === l && !st.espera && !sobras.length && !sobrasTroca.length && !!troca && troca.idioma === (l === 'en' ? 'es' : 'en'), idioma: st.idioma, lang: st.lang, seletores: st.sel.length, faltas: st.faltas.slice(0, 10), sobras: sobras.slice(0, 40), nSobras: sobras.length, troca, sobrasTroca: sobrasTroca.slice(0, 20), erros: errs.slice(0, 5) }; await p.close(); }
      if (l !== 'pt-BR' && !SO_INICIO) { /* partida curta: HUD, Núcleo selecionado, Construir, Diplomacia, Pesquisa, Ajustes e Ajuda */
        const p = await b.newPage({ viewport: { width: 1280, height: 800 } }); p.setDefaultTimeout(400000); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' || /3D indisponível/.test(m.text())) errs.push(m.text()); });
        await p.goto(url('autostart=1&seed=42&opp=2&faction=vehnar&debug=1&q=baixa&dia=1&semsalvar=1&ff=30&lang=' + l), { waitUntil: 'load' });
        try { await p.waitForFunction(() => window.__ARDG && document.getElementById('loading').hidden, null, { timeout: 400000 }); } catch (e) { errs.push('carregamento não terminou'); }
        await p.waitForTimeout(2500); const sob = []; const add = async (raizes) => { const s = await p.evaluate(DETECTOR, { raizes: raizes, idioma: l }); for (const x of s) if (!sob.some(y => y.onde === x.onde && y.texto === x.texto)) sob.push(x); };
        await add(['#hud']);
        await p.keyboard.press('F1'); await p.waitForTimeout(700); await add(['#panel']);
        await p.evaluate(() => { const b = document.getElementById('btn-build'); if (b) b.click(); }); await p.waitForTimeout(500); await add(['#panel']);
        for (const tb of ['mil', 'def', 'tec']) { await p.evaluate(t => { const b = document.querySelector('[data-btab=' + t + ']'); if (b) b.click(); }, tb); await p.waitForTimeout(300); await add(['#panel']); }
        for (const [btn, box] of [['btn-diplo', '#diplo'], ['btn-tech', '#tech'], ['btn-a11y', '#a11y'], ['btn-help', '#help'], ['btn-save', '#savebox']]) { await p.evaluate(id => { const b = document.getElementById(id); if (b) b.click(); }, btn); await p.waitForTimeout(600); await add([box]); await p.keyboard.press('Escape'); await p.evaluate(() => document.querySelectorAll('.modal').forEach(m => { if (m.id !== 'loading') m.hidden = true; })); await p.waitForTimeout(200); }
        await p.evaluate(() => { const G = window.__ARDG; if (G) { G.paused = false; } }); await p.waitForTimeout(1500); await add(['#hud']);
        res.partida = { ok: !errs.length && !sob.length, sobras: sob.slice(0, 40), nSobras: sob.length, erros: errs.slice(0, 5), lider: await p.evaluate(() => (document.getElementById('leader-name') || {}).textContent || '') }; await p.close(); }
      res.ok = !!(res.inicio && res.inicio.ok && (l === 'pt-BR' || (res.partida && res.partida.ok))); }
  } finally { await b.close(); }
  return R; }
(async () => {
  if (!process.argv.includes('--so-estatico')) out.idiomas = await navegador();
  const e = out.estatico; const okL = l => l === 'pt-BR' ? e.ok && out.idiomas[l] && out.idiomas[l].ok : e.ok && !e.falta[l].length && out.idiomas[l] && out.idiomas[l].ok;
  out.ok3 = process.argv.includes('--so-estatico') ? null : L.filter(okL).length;
  if (!process.argv.includes('--json')) { console.log('estático: ' + e.chaves + ' chaves pt-BR · faltam en ' + e.falta.en.length + ', es ' + e.falta.es.length + ' · marcadores ' + e.marcadores.length + ' · plural ' + e.plural.length + ' · chaves do HTML sem dicionário ' + e.html.length);
    for (const l of L) { const r = out.idiomas[l]; if (!r) continue; console.log(l + ': ' + (r.ok ? 'ok' : 'FALHOU') + ' · tela inicial ' + (r.inicio && r.inicio.ok ? 'ok' : 'falhou') + (r.inicio ? ' (' + r.inicio.nSobras + ' sobras, ' + r.inicio.erros.length + ' erros)' : '') + (r.partida ? ' · partida ' + (r.partida.ok ? 'ok' : 'falhou') + ' (' + r.partida.nSobras + ' sobras, ' + r.partida.erros.length + ' erros)' : '')); } }
  console.log(JSON.stringify(out));
})();
