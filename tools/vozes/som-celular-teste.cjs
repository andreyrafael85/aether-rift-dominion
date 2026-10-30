// 5.0b.1: teste do som no celular. O Chromium e o WebKit do Playwright não seguem as regras de áudio do iPhone (lá o AudioContext toca até no touchstart),
// então um "portão" (script de início, antes da página) imita o iOS: o AudioContext nasce suspenso fora de um gesto e o resume() só vale dentro de
// touchend, pointerup, click, keydown (ou mousedown e o pointerdown do mouse), nunca no touchstart nem no pointerdown do toque; depois do primeiro
// resume num gesto, vale em qualquer hora (como no WebKit). A voz do sistema descarta toda fala até a primeira feita dentro de um gesto. O
// navigator.audioSession é simulado quando o cenário pede. Vozes: o conjunto do iPhone com a Luciana Aprimorada (conjuntos.cjs) na imitação de
// fala (fala-falsa.cjs). Confere: o desbloqueio dispara no pointerup/touchend e no click e não no touchstart; com o pointerup engolido, no touchend;
// com os dois engolidos, no click; o audioSession vira 'playback'; a fala de preparo (volume 0) sai dentro do gesto e as falas de depois, fora de
// gesto, tocam; o AudioContext fica 'running'; 'interrupted' e a volta para a página retomam; sem a API de sessão, o <audio> mudo em laço; no
// computador nada disso (sem fala de preparo, sem sessão, sem <audio>); o "Testar som" mostra o diagnóstico.
// Uso: NODE_PATH=<node_modules com playwright> node tools/vozes/som-celular-teste.cjs [--raiz=<pasta com dist/local.html>] [--fotos] [--partida]
const path = require('path'), fs = require('fs'); const root = path.resolve(__dirname, '../..');
const raiz = (process.argv.find(a => a.startsWith('--raiz=')) || '').slice(7) || root; const fotos = process.argv.includes('--fotos'), partida = process.argv.includes('--partida');
const pw = require('playwright'); const fake = require('./fala-falsa.cjs'); const SETS = require('./conjuntos.cjs');
const IPH = SETS.find(s => s.id === 'iphone-aprimorada'), WIN = SETS.find(s => s.id === 'chrome-win');
const espera = ms => new Promise(r => setTimeout(r, ms));
const url = q => 'file://' + raiz + '/dist/local.html?' + q;

/* o portão (roda na página antes do jogo, depois da imitação de fala) */
function portao(o) {
  const G = window.__portao = { eventos: [], vistos: [], resumes: [], recusas: 0, falas: [], descartadas: [], plays: [], criado: null, liberado: false, falaLiberada: false, sessao: null };
  const OK = new Set(['touchend', 'pointerup', 'click', 'keydown', 'mousedown', 'mouseup']); let gesto = null;
  const TIPOS = ['pointerdown', 'touchstart', 'pointerup', 'touchend', 'mousedown', 'mouseup', 'click', 'keydown'];
  for (const t of TIPOS) addEventListener(t, e => { if (!e.isTrusted) return; const ok = OK.has(t) || (t === 'pointerdown' && e.pointerType === 'mouse'); gesto = ok ? t : null; G.eventos.push(t + (e.pointerType ? '(' + e.pointerType + ')' : '')); const g = gesto; setTimeout(() => { if (gesto === g) gesto = null; }, 0); }, true);
  for (const t of o.engolir || []) addEventListener(t, e => { if (e.isTrusted) e.stopImmediatePropagation(); }, true); /* o jogo não vê este tipo de evento */
  for (const t of TIPOS) addEventListener(t, e => { if (!e.isTrusted || !window.ARD || !ARD.audio || !ARD.audio.desbloqueio) return; G.vistos.push({ t: t + (e.pointerType ? '(' + e.pointerType + ')' : ''), valido: ARD.audio.gestoValido ? ARD.audio.gestoValido(e) : null, evento: ARD.audio.desbloqueio().evento }); }, false); /* depois do jogo */
  const AC0 = window.AudioContext;
  class AC extends AC0 { constructor(...a) { super(...a); G.criado = { gesto, estado: this.state }; if (!gesto && !G.liberado) AC0.prototype.suspend.call(this); else G.liberado = true; }
    resume() { G.resumes.push({ gesto, estado: this.state }); if (gesto || G.liberado) { G.liberado = true; return AC0.prototype.resume.call(this); } G.recusas++; return new Promise(() => {}); } } /* fora de gesto: pendente, como no WebKit */
  window.AudioContext = AC; window.__AC0 = AC0;
  const ss = window.speechSynthesis, sp = ss.speak; ss.speak = function (u) { const g = gesto; if (!G.falaLiberada && !g) { G.descartadas.push(u.text); return; } G.falaLiberada = true; G.falas.push({ texto: u.text, volume: u.volume, gesto: g }); return sp.call(ss, u); };
  const pl = HTMLMediaElement.prototype.play; HTMLMediaElement.prototype.play = function () { G.plays.push({ gesto, loop: this.loop, playsinline: this.hasAttribute('playsinline'), src: String(this.src).slice(0, 5) }); return pl.apply(this, arguments); };
  if (o.sessao) { const s = { _t: 'auto', mudancas: [] }; Object.defineProperty(s, 'type', { enumerable: true, get() { return this._t; }, set(v) { this._t = v; this.mudancas.push({ v, gesto }); } }); Object.defineProperty(Navigator.prototype, 'audioSession', { configurable: true, get: () => s }); G.sessao = s; }
}

async function pagina(b, o) { const movel = o.movel !== false; const set = movel ? IPH : WIN;
  const ctx = await b.newContext(Object.assign({ viewport: movel ? { width: 390, height: 844 } : { width: 1280, height: 800 }, userAgent: set.ua }, movel ? { hasTouch: true, isMobile: o.webkit ? false : true, deviceScaleFactor: o.webkit ? 1 : 2 } : {}));
  await ctx.addInitScript(`(${fake.toString()})(${JSON.stringify(set)})`); await ctx.addInitScript(`(${portao.toString()})(${JSON.stringify({ sessao: o.sessao, engolir: o.engolir || [] })})`);
  const p = await ctx.newPage(); p.setDefaultTimeout(240000); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(url(o.q || 'fundo=classico&aba=ajustes'), { waitUntil: 'load' }); await p.waitForFunction(() => window.ARD && ARD.audio); await espera(Math.max(700, (set.atraso || 0) + 500));
  return { ctx, p, errs, close: () => ctx.close() }; }
/* um ponto da tela que não é botão (o cabeçalho "Aparelho" do painel Ajustes) */
async function vazio(p) { return p.evaluate(() => { const el = document.querySelector('.cpane[data-pane="ajustes"] .chead') || document.querySelector('.chead'); el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return { x: Math.round(r.left + 12), y: Math.round(r.top + r.height / 2) }; }); }
async function botao(p, sel) { return p.evaluate(s => { const el = document.querySelector(s); el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; }, sel); }
const estado = p => p.evaluate(() => ({ audio: ARD.audio.ctx ? ARD.audio.ctx.state : null, d: ARD.audio.desbloqueio ? ARD.audio.desbloqueio() : { evento: null, base: true }, g: { eventos: __portao.eventos.slice(), vistos: __portao.vistos.slice(), resumes: __portao.resumes.length, recusas: __portao.recusas, falas: __portao.falas.slice(), descartadas: __portao.descartadas.slice(), plays: __portao.plays.slice(), sessao: __portao.sessao ? __portao.sessao.type : null, mudancas: __portao.sessao ? __portao.sessao.mudancas.slice() : [] } }));
/* uma fala do jogo fora de gesto (como as da partida): aceita, legenda e 'ard-voz' completos? */
const falaFora = p => p.evaluate(async () => { const F = __fala; F.log.length = 0; F.ev.length = 0; const caps = []; const o = ARD.audio.onSay; ARD.audio.onSay = (t, k) => { caps.push(k); if (o) o(t, k); }; const ok = ARD.audio.say('Base sob ataque', 'Base sob ataque', 0); await new Promise(r => setTimeout(r, 900)); ARD.audio.onSay = o;
  return { ok, falou: F.log.some(x => x.text === 'Base sob ataque'), descartada: __portao.descartadas.includes('Base sob ataque'), ev: F.ev.join(','), caps }; });
const testarSom = async (p, sel, diag) => { await p.locator(sel).scrollIntoViewIfNeeded(); await p.locator(sel).tap(); await espera(1400); return p.evaluate(d => { const el = document.querySelector(d); return el && !el.hidden ? el.textContent : null; }, diag); };
const testarSomMouse = async (p, sel, diag) => { await p.locator(sel).scrollIntoViewIfNeeded(); await p.locator(sel).click(); await espera(1400); return p.evaluate(d => { const el = document.querySelector(d); return el && !el.hidden ? el.textContent : null; }, diag); };
const R = []; const conf = (nome, ok, info) => { R.push({ nome, ok: !!ok, info }); console.log(`${ok ? 'ok ' : 'FALHOU '} ${nome}${info ? ' · ' + (typeof info === 'string' ? info : JSON.stringify(info)) : ''}`); };
const prep = g => g.falas.find(f => f.volume === 0) || null;

async function chromium() {
  const b = await pw.chromium.launch({ headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--allow-file-access-from-files', '--disable-dev-shm-usage'] });
  { /* 1. iPhone emulado (hasTouch, isMobile, 390×844) com navigator.audioSession: contexto criado antes, fora de gesto (como a Sala no touchstart) */
    const P = await pagina(b, { sessao: true }); const { p } = P; await p.evaluate(() => ARD.audio.init()); await espera(200);
    const antes = await falaFora(p); conf('chromium celular: fala antes de qualquer gesto é descartada pelo portão (o iOS faz isso)', antes.descartada && !antes.falou, { legenda: antes.caps.length }); await espera(4200); /* passa dos 4 s: no toque, a fala presa só solta a voz (não é refeita) */
    const pt = await vazio(p); const cdp = await P.ctx.newCDPSession(p);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: pt.x, y: pt.y }] }); await espera(400); const e1 = await estado(p);
    conf('chromium celular: touchstart (e o pointerdown do toque) não desbloqueia', e1.d.evento === null && e1.audio === 'suspended' && !prep(e1.g) && !e1.g.falas.length && e1.g.recusas === 0, { audio: e1.audio, eventos: e1.g.eventos.join(' '), sessao: e1.g.sessao });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await espera(500); const e2 = await estado(p); const pr = prep(e2.g);
    conf('chromium celular: o fim do toque desbloqueia (pointerup/touchend)', /^(pointerup|touchend)$/.test(e2.d.evento), { evento: e2.d.evento, eventos: e2.g.eventos.join(' ') });
    conf('chromium celular: AudioContext running', e2.audio === 'running', { audio: e2.audio, bufferMudo: e2.d.mudoCurto, recusas: e2.g.recusas });
    conf('chromium celular: audioSession ligado em playback', e2.g.sessao === 'playback', e2.g.mudancas);
    conf('chromium celular: fala de preparo (volume 0) dentro do gesto', !!pr && /^(pointerup|touchend)$/.test(pr.gesto) && e2.g.falas.indexOf(pr) === 0, pr);
    const depois = await falaFora(p); conf('chromium celular: fala do jogo fora de gesto toca depois do preparo (legenda e ard-voz)', depois.ok && depois.falou && /^(fim,)?inicio(,palavra)+,fim$/.test(depois.ev) && depois.caps.length === 1, { ev: depois.ev });
    const sfx = await p.evaluate(async () => { const c = ARD.audio.ctx; let n = 0; const o = c.createOscillator.bind(c); c.createOscillator = () => { n++; return o(); }; ARD.audio.sfx('build'); ARD.audio.sfx('explosion'); const t0 = c.currentTime; await new Promise(r => setTimeout(r, 300)); c.createOscillator = o; return { n, anda: c.currentTime > t0 }; });
    conf('chromium celular: efeitos tocam (osciladores criados, relógio do áudio andando)', sfx.n >= 3 && sfx.anda, sfx);
    const dg = await testarSom(p, '#btn-som-teste', '#som-diag');
    conf('chromium celular: Testar som mostra o diagnóstico', !!dg && /Áudio: tocando/.test(dg) && /Sessão de reprodução: sim/.test(dg) && /Vozes em português: \d+/.test(dg) && /Voz: Luciana \(Aprimorada\)/.test(dg) && /Fala: tocou/.test(dg), dg);
    if (fotos) { fs.mkdirSync(path.join(root, 'work/fotos'), { recursive: true }); await p.locator('.cpane[data-pane="ajustes"] .voz-ui').screenshot({ path: path.join(root, 'work/fotos/testar-som-celular.png') }); }
    /* 'interrupted' (ligação, outro app): o statechange retoma; o próximo gesto confere de novo */
    const it = await p.evaluate(async () => { const c = ARD.audio.ctx, r0 = __portao.resumes.length; Object.defineProperty(c, 'state', { configurable: true, get: () => 'interrupted' }); c.dispatchEvent(new Event('statechange')); const pronto = ARD.audio.desbloqueio().pronto; delete c.state; await new Promise(r => setTimeout(r, 300)); return { resumes: __portao.resumes.length - r0, interrompido: ARD.audio.desbloqueio().interrompido, pronto, estado: c.state }; });
    conf('chromium celular: estado interrupted é retomado', it.resumes >= 1 && it.interrompido === 1 && it.pronto === false && it.estado === 'running', it);
    /* volta para a página: escondida, o contexto suspenso espera; à vista de novo, retoma */
    const vis = await p.evaluate(async () => { const c = ARD.audio.ctx; Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); await __AC0.prototype.suspend.call(c); await new Promise(r => setTimeout(r, 200)); const escondida = c.state;
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); await new Promise(r => setTimeout(r, 300)); return { escondida, voltou: c.state }; });
    conf('chromium celular: visibilitychange retoma ao voltar para a página', vis.escondida === 'suspended' && vis.voltou === 'running', vis);
    conf('chromium celular: sem erros na página', !P.errs.length, P.errs.slice(0, 3)); await P.close(); }
  { /* 2. iPhone emulado sem a API de sessão: o <audio> mudo em laço */
    const P = await pagina(b, { sessao: false }); const { p } = P; const pt = await vazio(p); await p.touchscreen.tap(pt.x, pt.y); await espera(600); const e = await estado(p);
    const pl = e.g.plays[0] || null; conf('chromium celular sem audioSession: <audio> mudo em laço, com playsinline, dentro do gesto', !!pl && pl.loop && pl.playsinline && /^(pointerup|touchend)$/.test(pl.gesto) && e.d.audioMudo === 'tocando', { play: pl, audioMudo: e.d.audioMudo });
    const dg = await testarSom(p, '#btn-som-teste', '#som-diag'); conf('chromium celular sem audioSession: diagnóstico diz áudio mudo em laço', !!dg && /Sessão de reprodução: sim \(áudio mudo em laço\)/.test(dg), dg);
    const off = await p.evaluate(async () => { ARD.audio.setEnabled(false); const a = ARD.audio.desbloqueio().audioMudo; ARD.audio.setEnabled(true); const b2 = ARD.audio.desbloqueio().audioMudo; Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); const c = ARD.audio.desbloqueio().audioMudo; Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); return { somDesligado: a, somLigado: b2, escondida: c, voltou: ARD.audio.desbloqueio().audioMudo }; });
    conf('chromium celular sem audioSession: o <audio> mudo só toca com som ligado e página à vista', off.somDesligado === 'pausado' && off.somLigado === 'tocando' && off.escondida === 'pausado' && off.voltou === 'tocando', off);
    conf('chromium celular sem audioSession: sem erros na página', !P.errs.length, P.errs.slice(0, 3)); await P.close(); }
  { /* 3 e 4. o pointerup engolido: desbloqueia no touchend; pointerup e touchend engolidos: no click */
    for (const [eng, quer] of [[['pointerup'], 'touchend'], [['pointerup', 'touchend'], 'click']]) { const P = await pagina(b, { sessao: true, engolir: eng }); const { p } = P; const pt = await vazio(p); await p.touchscreen.tap(pt.x, pt.y); await espera(600); const e = await estado(p); const pr = prep(e.g);
      conf(`chromium celular: sem ${eng.join(' e ')}, desbloqueia no ${quer}`, e.d.evento === quer && e.audio === 'running' && !!pr && pr.gesto === quer && e.g.sessao === 'playback', { evento: e.d.evento, audio: e.audio, preparo: pr && pr.gesto }); await P.close(); } }
  { /* 4b. a fala descartada pelo iOS logo antes do primeiro toque sai dentro dele (e não segura a voz do jogo) */
    const P = await pagina(b, { sessao: true }); const { p } = P; const a = await falaFora(p); const pt = await vazio(p); await p.touchscreen.tap(pt.x, pt.y); await espera(900); const e = await estado(p); const f0 = e.g.falas[0] || null;
    conf('chromium celular: fala descartada antes do toque é refeita dentro do toque', a.descartada && !!f0 && f0.texto === 'Base sob ataque' && /^(pointerup|touchend)$/.test(f0.gesto) && e.d.voz === true, { primeira: f0, voz: e.d.voz }); await P.close(); }
  { /* 4c. som 3D da Sala de Comando pelo caminho do iPhone: o src/m5/sala.js liga o som no touchstart (fora do gesto); o fim do toque retoma o mesmo contexto */
    const P = await pagina(b, { sessao: true }); const { p } = P; await p.evaluate(() => { window.__sala = null; document.addEventListener('touchstart', () => { if (!ARD.salaSom.ativo()) window.__sala = ARD.salaSom.iniciar({ fenda: { x: 0, y: 30, z: -200 }, nucleo: { x: 40, y: 30, z: 60 }, race: 'tessara' }); }, { passive: true }); });
    const pt = await vazio(p); await p.touchscreen.tap(pt.x, pt.y); await espera(700); const e = await estado(p);
    const sl = await p.evaluate(async () => { const c = ARD.audio.ctx, t0 = c.currentTime; ARD.salaSom.raca('vorag'); ARD.salaSom.pulso({ x: 0, y: 30, z: -200 }); ARD.salaSom.ligado(false); ARD.salaSom.ligado(true); await new Promise(r => setTimeout(r, 300)); const r = { iniciou: window.__sala, ativo: ARD.salaSom.ativo(), anda: c.currentTime > t0, criado: __portao.criado }; ARD.salaSom.parar(); r.parou = !ARD.salaSom.ativo(); return r; });
    conf('chromium celular: som 3D da Sala (ligado no touchstart, fora do gesto) toca depois do toque, no mesmo contexto', sl.iniciou === true && sl.ativo && sl.anda && sl.parou && sl.criado && sl.criado.gesto === null && e.audio === 'running' && /^(pointerup|touchend)$/.test(e.d.evento), { sala: sl, audio: e.audio, evento: e.d.evento });
    conf('chromium celular, Sala: sem erros na página', !P.errs.length, P.errs.slice(0, 3)); await P.close(); }
  { /* 5. computador (sem toque): o pointerdown do mouse desbloqueia, como antes; sem fala de preparo, sem sessão, sem <audio> */
    const P = await pagina(b, { movel: false, sessao: true }); const { p } = P; const pt = await vazio(p); await p.mouse.click(pt.x, pt.y); await espera(600); const e = await estado(p);
    conf('chromium computador: desbloqueia no pointerdown do mouse, como antes', e.d.evento === 'pointerdown' && e.audio === 'running', { evento: e.d.evento, audio: e.audio });
    conf('chromium computador: sem fala de preparo, sem sessão e sem <audio> mudo', !prep(e.g) && e.g.sessao === 'auto' && !e.g.mudancas.length && !e.g.plays.length && e.d.audioMudo === null, { falas: e.g.falas.length, sessao: e.g.sessao, plays: e.g.plays.length });
    const dg = await testarSomMouse(p, '#btn-som-teste', '#som-diag'); conf('chromium computador: Testar som mostra o diagnóstico', !!dg && /Áudio: tocando/.test(dg) && /Sessão de reprodução: não precisa neste aparelho/.test(dg) && /Voz: Google português do Brasil/.test(dg) && /Fala: tocou/.test(dg), dg);
    if (fotos) await p.locator('.cpane[data-pane="ajustes"] .voz-ui').screenshot({ path: path.join(root, 'work/fotos/testar-som-computador.png') });
    conf('chromium computador: sem erros na página', !P.errs.length, P.errs.slice(0, 3)); await P.close(); }
  if (partida) { /* 6. a janela Ajustes da partida (motor clássico, Baixa): Testar som e diagnóstico */
    const P = await pagina(b, { sessao: true, q: 'autostart=1&seed=42&opp=2&faction=tessara&debug=1&q=baixa&dia=1&semsalvar=1' }); const { p } = P; try { await p.waitForFunction(() => document.getElementById('loading').hidden, null, { timeout: 900000 }); } catch (e) { P.errs.push('carregamento não terminou'); }
    await espera(1500); await p.evaluate(() => { document.getElementById('a11y').hidden = false; }); const dg = await testarSom(p, '#pt-som-teste', '#pt-som-diag'); const e = await estado(p);
    conf('chromium celular, partida: Testar som na janela Ajustes mostra o diagnóstico', !!dg && /Áudio: tocando/.test(dg) && /Sessão de reprodução: sim/.test(dg) && /Fala: tocou/.test(dg), dg);
    if (fotos) await p.screenshot({ path: path.join(root, 'work/fotos/testar-som-partida.png') }); /* a tela inteira: a foto só da caixa saía cortada (animação de entrada) */
    conf('chromium celular, partida: desbloqueio no gesto e sem erros', /^(pointerup|touchend)$/.test(e.d.evento) && !P.errs.filter(x => !/^\s*$/.test(x)).length, { evento: e.d.evento, erros: P.errs.slice(0, 3) }); await P.close(); }
  await b.close(); }

async function webkit() {
  const b = await pw.webkit.launch({ headless: true });
  { /* 7. WebKit com toque: o toque inteiro (pointerdown, touchstart, pointerup, touchend, mousedown, click) */
    const P = await pagina(b, { sessao: true, webkit: true }); const { p } = P; const pt = await vazio(p); await p.touchscreen.tap(pt.x, pt.y); await espera(700); const e = await estado(p); const pr = prep(e.g);
    const vi = t => e.g.vistos.filter(x => x.t === t); const ts = vi('touchstart'), pd = vi('pointerdown(touch)'), te = vi('touchend'), ck = vi('click(mouse)').concat(vi('click(touch)'), vi('click'));
    conf('webkit: touchstart e pointerdown do toque não contam como gesto (e não desbloqueiam)', ts.length && pd.length && ts.concat(pd).every(x => x.valido === false && x.evento === null), { eventos: e.g.eventos.join(' ') });
    conf('webkit: toque fora de botão não gera click (como no iPhone): o desbloqueio vem do pointerup/touchend', !ck.length && te.length && te.every(x => x.valido === true), { touchend: te.length, click: ck.length });
    conf('webkit: desbloqueia no fim do toque, AudioContext running, sessão playback, preparo dentro do gesto', /^(pointerup|touchend)$/.test(e.d.evento) && e.audio === 'running' && e.g.sessao === 'playback' && !!pr && /^(pointerup|touchend)$/.test(pr.gesto), { evento: e.d.evento, audio: e.audio, sessao: e.g.sessao, preparo: pr && pr.gesto });
    const depois = await falaFora(p); conf('webkit: fala do jogo fora de gesto toca depois do preparo', depois.ok && depois.falou && /^(fim,)?inicio(,palavra)+,fim$/.test(depois.ev), { ev: depois.ev });
    const dg = await testarSom(p, '#btn-som-teste', '#som-diag'); conf('webkit: Testar som mostra o diagnóstico', !!dg && /Áudio: tocando/.test(dg) && /Sessão de reprodução: sim/.test(dg) && /Vozes em português: \d+/.test(dg) && /Fala: tocou/.test(dg), dg);
    { const vs = await p.evaluate(() => __portao.vistos.slice()); const t = k => vs.filter(x => x.t.startsWith(k)); conf('webkit: no botão, touchend e click contam como gesto; touchstart e pointerdown do toque não', t('touchend').length && t('click').length && t('touchend').concat(t('click')).every(x => x.valido === true) && t('touchstart').concat(t('pointerdown(touch)')).every(x => x.valido === false), { tipos: [...new Set(vs.map(x => x.t + '=' + x.valido))].join(' ') }); }
    conf('webkit: sem erros na página', !P.errs.length, P.errs.slice(0, 3)); await P.close(); }
  for (const [eng, quer] of [[['pointerup'], 'touchend'], [['pointerup', 'touchend'], 'click']]) { const P = await pagina(b, { sessao: true, webkit: true, engolir: eng }); const { p } = P; const pt = quer === 'click' ? await botao(p, '#btn-voz-ouvir') : await vazio(p); await p.touchscreen.tap(pt.x, pt.y); /* o click só vem de um elemento clicável */ await espera(700); const e = await estado(p); const pr = prep(e.g);
    conf(`webkit: sem ${eng.join(' e ')}, desbloqueia no ${quer}`, e.d.evento === quer && e.audio === 'running' && !!pr && pr.gesto === quer, { evento: e.d.evento, audio: e.audio, preparo: pr && pr.gesto, eventos: e.g.eventos.join(' ') }); await P.close(); }
  await b.close(); }

/* --raiz=<cópia da base>: o mesmo toque no jogo de antes (sem A.gesto): o que acontecia no iPhone emulado */
async function base() { for (const eng of ['chromium', 'webkit']) { const b = await (eng === 'chromium' ? pw.chromium.launch({ headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--allow-file-access-from-files', '--disable-dev-shm-usage'] }) : pw.webkit.launch({ headless: true }));
  const P = await pagina(b, { sessao: true, webkit: eng === 'webkit' }); const { p } = P; const pt = await vazio(p); await p.touchscreen.tap(pt.x, pt.y); await espera(700); const e = await estado(p); const f = await falaFora(p);
  conf(`${eng} celular (antes): AudioContext running depois do toque`, e.audio === 'running', { audio: e.audio, resumes: e.g.resumes, recusas: e.g.recusas, eventos: e.g.eventos.join(' ') });
  conf(`${eng} celular (antes): audioSession em playback`, e.g.sessao === 'playback', { sessao: e.g.sessao });
  conf(`${eng} celular (antes): fala do jogo fora de gesto toca`, f.falou, { descartadas: e.g.descartadas.length + (f.descartada ? 1 : 0), legenda: f.caps.length });
  await P.close(); await b.close(); } }
(async () => { const t0 = Date.now(); console.log('página: ' + url('')); if (raiz !== root) await base(); else { await chromium(); await webkit(); }
  const ok = R.filter(r => r.ok).length; fs.mkdirSync(path.join(root, 'work'), { recursive: true }); fs.writeFileSync(path.join(root, 'work/som-celular-teste' + (raiz !== root ? '-base' : '') + '.json'), JSON.stringify({ quando: new Date().toISOString(), raiz, resultados: R }, null, 2));
  console.log(`som no celular: ${ok}/${R.length} conferências ok (${((Date.now() - t0) / 1000).toFixed(1)} s)`); process.exit(ok === R.length ? 0 : 1); })().catch(e => { console.error(e); process.exit(2); });
