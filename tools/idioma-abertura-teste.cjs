// 5.0h.1 — idioma na abertura: o jogo abre no idioma certo para cada navegador, nos três motores (Chromium, Firefox e WebKit).
// Regra (src/i18n.js e o script do topo do <body> em src/index.tpl.html): a escolha guardada ('ard-idioma') › ?lang= › navigator.languages na
// ordem, pelo prefixo (pt → pt-BR, en → en, es → es; o primeiro suportado vale) › navigator.language; nenhum suportado → inglês.
// O jogo é servido por HTTP a partir da raiz (como no GitHub Pages: index.html, manifestos e vozes). Para cada caso: um contexto novo com o
// locale e navigator.languages do caso; confere ARD.idioma, <html lang>, o título da aba, o manifesto do app (o <link> e o arquivo: nome e
// lang), o texto da tela inicial contra o dicionário do idioma esperado e mede o "pisca": a cada quadro (requestAnimationFrame, desde o
// começo da página) guarda o texto visível; reprova se algum quadro mostrar um texto da tela inicial em português quando o idioma é outro.
// Com --partida (o padrão: um caso por idioma em cada motor), abre uma partida em dist/local.html (o mesmo jogo com o Three.js de dist/vendor, sem CDN) e confere a dica do tutorial, um texto do HUD e a
// primeira fala de voz (texto do manifesto de vozes do idioma). Por último, no Node: o hash da partida é o mesmo nos três idiomas.
// Uso: NODE_PATH=<pasta com node_modules/playwright> node tools/idioma-abertura-teste.cjs [--motores=chromium,firefox,webkit] [--casos=id,id]
//      [--partida=todos|nenhum|um-por-idioma|id,id] [--partida-motores=chromium,…] [--controle-sem-espera] [--json]   (a última linha com --json é o resultado em JSON). Precisa do index.html gerado (node tools/build.mjs).
'use strict';
const fs = require('fs'), path = require('path'), http = require('http');
const root = path.resolve(__dirname, '..');
const arg = (k, d) => { const a = process.argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const MOTORES = arg('motores', 'chromium,firefox,webkit').split(',').filter(Boolean); const MOT_PARTIDA = arg('partida-motores', MOTORES.join(',')).split(','); /* motores onde a partida roda (o portão: só o Chromium) */
const SO = arg('casos', '').split(',').filter(Boolean); const CONTROLE = process.argv.includes('--controle-sem-espera'); /* prova da medida: tira o esconder da tela inicial e o português tem de aparecer */ const PARTIDA = arg('partida', 'um-por-idioma'); const JSON_OUT = process.argv.includes('--json');

/* casos: locale do contexto e navigator.languages (null = o que o motor der para o locale; [] = sem lista, cai no navigator.language) */
const CASOS = [
  { id: 'en-US', locale: 'en-US', langs: ['en-US'] }, { id: 'en-GB', locale: 'en-GB', langs: ['en-GB'] },
  { id: 'es-ES', locale: 'es-ES', langs: ['es-ES'] }, { id: 'es-MX', locale: 'es-MX', langs: ['es-MX'] }, { id: 'es-419', locale: 'es-419', langs: ['es-419'] },
  { id: 'pt-BR', locale: 'pt-BR', langs: ['pt-BR'] }, { id: 'pt-PT', locale: 'pt-PT', langs: ['pt-PT'] },
  { id: 'fr-FR', locale: 'fr-FR', langs: ['fr-FR'] }, { id: 'de-DE', locale: 'de-DE', langs: ['de-DE'] }, { id: 'ja-JP', locale: 'ja-JP', langs: ['ja-JP'] },
  { id: 'fr-FR,es-ES', locale: 'fr-FR', langs: ['fr-FR', 'es-ES'] }, { id: 'de-DE,pt-BR,en', locale: 'de-DE', langs: ['de-DE', 'pt-BR', 'en'] },
  { id: 'sem-languages (es-MX)', locale: 'es-MX', langs: [], lang1: 'es-MX' },
  { id: '?lang=pt em en-US', locale: 'en-US', langs: ['en-US'], q: 'lang=pt' },
  { id: 'guardado es + ?lang=en', locale: 'pt-BR', langs: ['pt-BR'], q: 'lang=en', guardado: 'es' },
];
/* a regra, escrita de novo aqui (independente do código do jogo) */
const pre = l => { l = String(l || '').toLowerCase(); return /^pt/.test(l) ? 'pt-BR' : /^es/.test(l) ? 'es' : /^en/.test(l) ? 'en' : null; };
function esperado(c) { if (pre(c.guardado)) return pre(c.guardado); const q = c.q && new URLSearchParams(c.q).get('lang'); if (pre(q)) return pre(q);
  const ls = c.langs && c.langs.length ? c.langs : [c.lang1 || c.locale]; for (const l of ls) if (pre(l)) return pre(l); return 'en'; }
const HTML_LANG = { 'pt-BR': 'pt-BR', en: 'en', es: 'es-419' };
const MANIFESTO = { 'pt-BR': 'manifest.webmanifest', en: 'manifest.en.webmanifest', es: 'manifest.es.webmanifest' };

/* servidor estático da raiz (como o Pages) */
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4', '.mp3': 'audio/mpeg', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
function servidor() { return new Promise(ok => { const s = http.createServer((req, res) => { let u = decodeURIComponent(req.url.split('?')[0]); if (u.endsWith('/')) u += 'index.html'; const f = path.join(root, path.normalize(u)); if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); fs.createReadStream(f).pipe(res); }); s.listen(0, '127.0.0.1', () => ok(s)); }); }

/* roda na página antes de tudo: navigator.languages do caso, a escolha guardada e o registro do texto visível a cada quadro */
const INICIO = function (o) {
  try { if (o.langs) { const L = Object.freeze(o.langs.slice()); Object.defineProperty(Navigator.prototype, 'languages', { get: () => L, configurable: true }); }
    if (o.lang1) Object.defineProperty(Navigator.prototype, 'language', { get: () => o.lang1, configurable: true }); } catch (e) {}
  try { if (o.guardado) localStorage.setItem('ard-idioma', o.guardado); } catch (e) {}
  if (o.controle) { const st = document.createElement('style'); st.textContent = 'html.i18n-espera .start-wrap{visibility:visible!important;animation:none!important}'; const pon = () => { if (document.head) document.head.appendChild(st); else requestAnimationFrame(pon); }; pon(); new MutationObserver(() => { if (document.head && !st.isConnected) document.head.appendChild(st); }).observe(document, { childList: true, subtree: true }); }
  const W = window.__pisca = { quadros: 0, amostras: [], t0: performance.now(), fimEspera: null }; let ult = null;
  const passo = () => { W.quadros++; const b = document.body; if (b && W.fimEspera == null && !document.documentElement.classList.contains('i18n-espera') && document.getElementById('start') && window.ARD && ARD.i18n) W.fimEspera = Math.round(performance.now()); if (b) { const st = document.getElementById('start'); const txt = st ? st.innerText : ''; if (txt !== ult) { ult = txt; W.amostras.push({ t: Math.round(performance.now()), q: W.quadros, txt: txt.slice(0, 20000), espera: document.documentElement.classList.contains('i18n-espera') }); } }
    if (W.quadros < 2000 && !W.parar) requestAnimationFrame(passo); };
  requestAnimationFrame(passo);
  window.__vz = []; addEventListener('ard-voz', e => { const d = e.detail || {}; if (window.__vz.length < 40) window.__vz.push({ tipo: d.tipo, texto: d.texto, gravada: !!d.gravada, chave: d.chave || null }); });
  /* a fala aceita (a legenda: ARD.audio.onSay recebe o texto e a chave mesmo sem áudio tocando, como no headless sem placa de som) */
  const liga = () => { const A = window.ARD && window.ARD.audio; if (!A) { setTimeout(liga, 20); return; } if (A.__ab) return; A.__ab = 1; let o = A.onSay; Object.defineProperty(A, 'onSay', { configurable: true, get: () => (t, k) => { if (window.__vz.length < 40) window.__vz.push({ tipo: 'inicio', texto: String(t || ''), chave: k || null, legenda: true }); if (o) o(t, k); }, set: f => { o = f; } }); }; liga();
};

/* tela inicial: o que abriu e o texto contra os dicionários (roda na página) */
const LER_INICIO = function (exp) {
  const D = ARD.I18N_DIC, limpa = s => String(s == null ? '' : s).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  const mf = document.querySelector('link[rel=manifest]');
  const els = [...document.querySelectorAll('#start [data-i18n]')].filter(el => !el.children.length && (el.offsetParent !== null || el.getClientRects().length)); /* só os de texto simples (sem filhos) */
  let ok = 0, total = 0; const ruins = [];
  for (const el of els) { const k = el.getAttribute('data-i18n'), v = D[exp] && D[exp][k], pt = D['pt-BR'] && D['pt-BR'][k]; if (typeof v !== 'string' || /[{<]|__/.test(v) || typeof pt !== 'string') continue; const txt = limpa(el.textContent); if (!txt) continue; total++; if (txt.toLowerCase() === limpa(v).toLowerCase()) ok++; /* o CSS pode pôr em maiúsculas; o carimbo do build fica de fora */ else if (ruins.length < 4) ruins.push(k + ': "' + txt.slice(0, 40) + '"'); }
  /* textos do português que, quando o idioma é outro, não podem aparecer em nenhum quadro (os que mudam de um idioma para o outro) */
  const marcas = exp === 'pt-BR' ? [] : [...new Set([...document.querySelectorAll('#start [data-i18n]')].map(el => { const k = el.getAttribute('data-i18n'), pt = D['pt-BR'][k], v = D[exp] && D[exp][k]; return typeof pt === 'string' && typeof v === 'string' && !/[{<]/.test(pt) && limpa(pt) !== limpa(v) && limpa(pt).length >= 5 ? limpa(pt) : null; }).filter(Boolean))];
  return { idioma: ARD.idioma, origem: ARD.i18n.origem, htmlLang: document.documentElement.lang, titulo: document.title, manifesto: mf ? mf.getAttribute('href') : null, texto: { ok, total, ruins }, marcas, espera: document.documentElement.classList.contains('i18n-espera') };
};

/* partida: a dica do tutorial, um texto do HUD e as falas (roda na página) */
const LER_PARTIDA = function (exp) {
  const D = ARD.I18N_DIC, limpa = s => String(s == null ? '' : s).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  const vals = l => { const s = new Set(); for (const k in D[l] || {}) { const v = D[l][k]; if (typeof v === 'string') s.add(limpa(v)); else if (v && typeof v === 'object') for (const x of Object.values(v)) s.add(limpa(x)); } return s; };
  const E = vals(exp), P = exp === 'pt-BR' ? new Set() : vals('pt-BR');
  const hb = document.getElementById('hints-body'), dicas = hb ? [...hb.querySelectorAll('.hint, li, div')].map(x => limpa(x.textContent)).filter(Boolean) : [];
  let g = null; try { g = ARD.vozes && ARD.vozes.achar('spawn', 'vehnar'); } catch (e) {} const gravada = g ? { texto: g.texto, chave: g.chave, pacote: g.pacote, idiomaVozes: ARD.vozes.idioma } : null; /* a fala gravada que o jogo escolhe para a primeira unidade pronta ('spawn'), no idioma das vozes carregado */
  const dica = dicas.find(x => E.has(x)) || dicas[0] || ''; const dicaOk = !!dica && E.has(dica) && (!P.has(dica) || E.has(dica));
  const hud = [...document.querySelectorAll('#hud [data-i18n], #bottombar [data-i18n], .hud [data-i18n]')].filter(el => el.getClientRects().length).map(el => ({ k: el.getAttribute('data-i18n'), txt: limpa(el.textContent) })).filter(x => x.txt && typeof D[exp][x.k] === 'string' && !/[{<]/.test(D[exp][x.k]));
  const bate = x => { const a = x.txt.toLowerCase(), v = limpa(D[exp][x.k]).toLowerCase(); return a === v || a.startsWith(v + ' ') || a.endsWith(' ' + v) || E.has(x.txt); }; /* o código completa alguns rótulos (status · Raça; "3 idle"; o nome da superarma), também do dicionário do idioma */
  const hudOk = hud.filter(bate).length; const hudRuins = hud.filter(x => !bate(x)).slice(0, 4).map(x => x.k + ': "' + x.txt.slice(0, 40) + '" (dic: "' + limpa(D[exp][x.k]).slice(0, 40) + '")');
  return { idioma: ARD.idioma, dica, dicaOk, hud: { ok: hudOk, total: hud.length, ex: hud[0] ? hud[0].txt : '', ruins: hudRuins }, gravada, vozes: window.__vz.slice(0, 8).map(v => Object.assign({ noIdioma: E.has(limpa(v.texto)), noPt: exp !== 'pt-BR' && P.has(limpa(v.texto)) }, v)) };
};

async function caso(pw, motor, b, base, c, comPartida, vozTextos) {
  const exp = esperado(c); const r = { caso: c.id, motor, esperado: exp };
  const ctx = await b.newContext({ locale: c.locale, viewport: { width: 1280, height: 800 } }); await ctx.addInitScript(INICIO, { langs: c.langs && c.langs.length ? c.langs : (c.langs ? [] : null), lang1: c.lang1 || null, guardado: c.guardado || null, controle: CONTROLE });
  const p = await ctx.newPage(); p.setDefaultTimeout(600000); const errs = []; p.on('pageerror', e => errs.push(e.message.slice(0, 160)));
  try {
    const url = base + '/' + (comPartida ? 'dist/local.html?' + (c.q ? c.q + '&' : '') + 'autostart=1&faction=vehnar&opp=1&seed=5&q=baixa&semsalvar=1&legendas=1' : (c.q ? '?' + c.q : ''));
    await p.goto(url, { waitUntil: 'load' });
    await p.waitForFunction(() => window.ARD && ARD.i18n && !document.documentElement.classList.contains('i18n-espera'), null, { timeout: 120000 });
    if (!comPartida) { await p.waitForTimeout(600); const i = await p.evaluate(LER_INICIO, exp); Object.assign(r, i);
      const nav = await p.evaluate(() => ({ languages: [...(navigator.languages || [])], language: navigator.language })); r.navegador = nav;
      const mf = await p.evaluate(async h => { try { const x = await (await fetch(h)).json(); return { name: x.name, lang: x.lang }; } catch (e) { return { erro: String(e) }; } }, r.manifesto || 'manifest.webmanifest'); r.manifestoArq = mf;
      const pis = await p.evaluate(() => { window.__pisca.parar = true; return window.__pisca; });
      const visiveis = pis.amostras.filter(a => a.txt && a.txt.trim()); const ptQuadros = visiveis.filter(a => i.marcas.some(m => a.txt.includes(m)));
      r.pisca = { quadros: pis.quadros, amostras: pis.amostras.length, primeiroTextoMs: visiveis.length ? visiveis[0].t : null, quadrosComPortugues: ptQuadros.length, primeiroPortuguesMs: ptQuadros.length ? ptQuadros[0].t : null, idiomaAplicadoMs: pis.fimEspera, marcas: i.marcas.length };
      delete r.marcas;
      r.ok = r.idioma === exp && r.htmlLang === HTML_LANG[exp] && r.manifesto === MANIFESTO[exp] && mf.name === 'Aether Rift: Dominion' && (mf.lang || '') === HTML_LANG[exp] && /Aether Rift/.test(r.titulo) && r.texto.total >= 5 && r.texto.ok === r.texto.total && r.pisca.quadrosComPortugues === 0 && (exp === 'pt-BR' || r.pisca.marcas > 0) && !errs.length;
    } else {
      await p.waitForFunction(() => document.getElementById('loading') && document.getElementById('loading').hidden, null, { timeout: 900000 });
      await p.mouse.click(640, 120).catch(() => {}); /* um gesto para o áudio poder tocar */
      await p.waitForFunction(() => { const hb = document.getElementById('hints-body'); let g = null; try { g = ARD.vozes && ARD.vozes.achar('spawn', 'vehnar'); } catch (e) {} return hb && hb.textContent.trim() && (g || window.__vz.some(v => v.tipo === 'inicio' && v.texto)); }, null, { timeout: 180000 }).catch(() => {});
      const m = await p.evaluate(LER_PARTIDA, exp); const v = m.vozes.find(x => x.tipo === 'inicio' && x.texto) || (m.gravada ? { texto: m.gravada.texto, gravada: true, chave: m.gravada.chave, noIdioma: false, noPt: false, idiomaVozes: m.gravada.idiomaVozes } : null);
      const limpa = s => String(s || '').replace(/\s+/g, ' ').trim();
      r.partida = { idioma: m.idioma, dica: m.dica.slice(0, 90), dicaOk: m.dicaOk, hud: m.hud, voz: v ? { texto: v.texto.slice(0, 90), gravada: !!v.gravada, chave: v.chave, idiomaVozes: v.idiomaVozes || null } : null };
      const tv = v ? limpa(v.texto) : ''; r.partida.vozOk = !!v && (vozTextos[exp].has(tv) || v.noIdioma) && (exp === 'pt-BR' || vozTextos[exp].has(tv) || !(vozTextos['pt-BR'].has(tv) || v.noPt));
      r.ok = m.idioma === exp && m.dicaOk && m.hud.total > 0 && m.hud.ok === m.hud.total && r.partida.vozOk && !errs.length;
    }
  } catch (e) { r.ok = false; r.erro = String(e.message).split('\n')[0].slice(0, 200); }
  r.erros = errs.slice(0, 3); await ctx.close(); return r;
}

(async () => {
  const pw = require('playwright'); if (!fs.existsSync(path.join(root, 'index.html'))) throw new Error('falta o index.html (node tools/build.mjs)');
  const vozTextos = {}; for (const l of ['pt-BR', 'en', 'es']) { const f = path.join(root, 'assets/vozes', l, 'manifesto.json'); const s = new Set(); if (fs.existsSync(f)) for (const v of Object.values(JSON.parse(fs.readFileSync(f, 'utf8')).falas || {})) s.add(String(v.texto || '').replace(/\s+/g, ' ').trim()); vozTextos[l] = s; }
  const srv = await servidor(); const base = 'http://127.0.0.1:' + srv.address().port; const R = { inicio: [], partida: [], hash: null }; const t0 = Date.now();
  try {
    for (const motor of MOTORES) { const b = await pw[motor].launch(motor === 'chromium' ? { headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required'] } : { headless: true });
      try {
        for (const c of CASOS) { if (SO.length && !SO.includes(c.id)) continue; const r = await caso(pw, motor, b, base, c, false, vozTextos); R.inicio.push(r); if (!JSON_OUT) console.log(motor.padEnd(8) + ' ' + c.id.padEnd(24) + ' → ' + r.idioma + (r.ok ? ' ok' : ' FALHOU ' + JSON.stringify(r).slice(0, 400))); }
        if (PARTIDA !== 'nenhum' && MOT_PARTIDA.includes(motor)) { const ids = PARTIDA === 'todos' ? CASOS.map(c => c.id) : PARTIDA === 'um-por-idioma' ? ['en-GB', 'es-MX', 'pt-PT', 'fr-FR,es-ES'] : PARTIDA.split(',');
          for (const c of CASOS) { if (!ids.includes(c.id)) continue; const r = await caso(pw, motor, b, base, c, true, vozTextos); R.partida.push(r); if (!JSON_OUT) console.log(motor.padEnd(8) + ' partida ' + c.id.padEnd(16) + ' → ' + (r.partida ? r.partida.idioma + ' · dica "' + r.partida.dica.slice(0, 50) + '" · voz "' + (r.partida.voz ? r.partida.voz.texto.slice(0, 40) : '—') + '"' : '') + (r.ok ? ' ok' : ' FALHOU ' + JSON.stringify(r).slice(0, 400))); } }
      } finally { await b.close(); } }
  } finally { srv.close(); }
  /* o idioma não muda a simulação: o mesmo hash da partida (IA × IA, tools/det-run.js) com o jogo em pt-BR, en e es */
  { globalThis.ARD = globalThis.ARD || {}; for (const f of ['src/i18n/pt-BR.js', 'src/i18n/en.js', 'src/i18n/es.js', 'src/i18n.js']) require(path.join(root, f));
    require(path.join(root, 'src/modos.js')); require(path.join(root, 'src/chefes-sim.js')); require(path.join(root, 'src/mundo.js')); require(path.join(root, 'src/unicas-sim.js')); require(path.join(root, 'src/sim.js')); require(path.join(root, 'src/ai.js')); require(path.join(root, 'tools/det-run.js'));
    const hs = {}; for (const l of ['pt-BR', 'en', 'es']) { ARD.idioma = l; const h = globalThis.ARD_DET(7, 1500); hs[l] = h[h.length - 1]; }
    R.hash = { porIdioma: hs, ok: hs['pt-BR'] === hs.en && hs.en === hs.es }; }
  const okI = R.inicio.filter(r => r.ok).length, okP = R.partida.filter(r => r.ok).length;
  R.resumo = { inicio: okI + '/' + R.inicio.length, partida: okP + '/' + R.partida.length, hash: R.hash.ok, seg: Math.round((Date.now() - t0) / 1000) };
  R.ok = okI === R.inicio.length && R.inicio.length > 0 && okP === R.partida.length && R.hash.ok;
  if (!JSON_OUT) console.log('idioma na abertura: início ' + R.resumo.inicio + ' · partida ' + R.resumo.partida + ' · hash igual nos 3 idiomas ' + (R.hash.ok ? 'sim' : 'NÃO') + ' · ' + R.resumo.seg + ' s');
  else console.log(JSON.stringify(R));
  if (!R.ok) process.exitCode = 1;
})().catch(e => { console.error('idioma-abertura-teste falhou:', e.message); if (JSON_OUT) console.log(JSON.stringify({ ok: false, erro: e.message })); process.exit(1); });
