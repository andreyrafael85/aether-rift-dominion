// 5.0b.1: teste do som no celular. O Chromium e o WebKit do Playwright não seguem as regras de áudio do iPhone (lá o AudioContext toca até no touchstart),
// então um "portão" (script de início, antes da página) imita o iOS: o AudioContext nasce suspenso fora de um gesto e o resume() só vale dentro de
// touchend, pointerup, click, keydown (ou mousedown e o pointerdown do mouse), nunca no touchstart nem no pointerdown do toque; depois do primeiro
// resume num gesto, vale em qualquer hora (como no WebKit). A voz do sistema descarta toda fala até a primeira feita dentro de um gesto. O
// navigator.audioSession é simulado quando o cenário pede. Vozes: o conjunto do iPhone com a Luciana Aprimorada (conjuntos.cjs) na imitação de
// fala (fala-falsa.cjs). Confere: o desbloqueio dispara no pointerup/touchend e no click e não no touchstart; com o pointerup engolido, no touchend;
// com os dois engolidos, no click; o audioSession vira 'playback'; a fala de preparo (volume 0) sai dentro do gesto e as falas de depois, fora de
// gesto, tocam; o AudioContext fica 'running'; 'interrupted' e a volta para a página retomam; sem a API de sessão, o <audio> mudo em laço; no
// computador nada disso (sem fala de preparo, sem sessão, sem <audio>); o "Testar som" mostra o diagnóstico.
// 5.0c.1: e as vozes gravadas no iPhone imitado (página servida por HTTP, manifesto de teste): com elas o jogo não chama o speechSynthesis (nem a fala
// de preparo no toque), a fala gravada toca pelo Web Audio fora de gesto com legenda e 'ard-voz', a fala sem arquivo fica só na legenda, o Web Audio
// volta a 'running' depois de 'interrupted' e de 'suspended' e a fala seguinte toca, e o "Testar som" diz "Voz gravada: tocou"; no WebKit, a sonda
// de formatos decide (sem formato que decodifique, tudo volta para a voz do sistema). --sem-gravadas pula essa parte.
// Uso: NODE_PATH=<node_modules com playwright> node tools/vozes/som-celular-teste.cjs [--raiz=<pasta com dist/local.html>] [--fotos] [--partida] [--sem-gravadas]
const path = require('path'), fs = require('fs'); const root = path.resolve(__dirname, '../..');
const raiz = (process.argv.find(a => a.startsWith('--raiz=')) || '').slice(7) || root; const fotos = process.argv.includes('--fotos'), partida = process.argv.includes('--partida');
const pw = require('playwright'); const fake = require('./fala-falsa.cjs'); const SETS = require('./conjuntos.cjs'); const { servir } = require('./servidor.cjs'); /* 5.0c.1 */
const IPH = SETS.find(s => s.id === 'iphone-aprimorada'), WIN = SETS.find(s => s.id === 'chrome-win');
const espera = ms => new Promise(r => setTimeout(r, ms));
const url = q => 'file://' + raiz + '/dist/local.html?lang=pt&' + q; /* 5.0h.1: o idioma pedido, não o do locale */ let HTTP = null; /* 5.0c.1: base http://127.0.0.1:<porta> nas páginas com vozes gravadas */

/* o portão (roda na página antes do jogo, depois da imitação de fala). 5.0c.1 (bancada no iPhone do dono, iOS 18.7): com a sessão 'playback', a fala do
   sistema põe o AudioContext em 'interrupted' enquanto dura e o iOS o devolve sozinho depois dela; um resume() no meio da fala devolve a sessão ao
   Web Audio e CALA a voz. o.iosFala liga essa parte (G.interrupcoes, G.resumeNaFala, G.caladas) */
function portao(o) {
  const G = window.__portao = { eventos: [], vistos: [], resumes: [], recusas: 0, falas: [], descartadas: [], plays: [], criado: null, liberado: false, falaLiberada: false, sessao: null, ctx: null, interrompido: false, falaAtiva: null, interrupcoes: 0, resumeNaFala: 0, caladas: [], voltas: 0 };
  const OK = new Set(['touchend', 'pointerup', 'click', 'keydown', 'mousedown', 'mouseup']); let gesto = null;
  const TIPOS = ['pointerdown', 'touchstart', 'pointerup', 'touchend', 'mousedown', 'mouseup', 'click', 'keydown'];
  for (const t of TIPOS) addEventListener(t, e => { if (!e.isTrusted) return; const ok = OK.has(t) || (t === 'pointerdown' && e.pointerType === 'mouse'); gesto = ok ? t : null; G.eventos.push(t + (e.pointerType ? '(' + e.pointerType + ')' : '')); const g = gesto; setTimeout(() => { if (gesto === g) gesto = null; }, 0); }, true);
  for (const t of o.engolir || []) addEventListener(t, e => { if (e.isTrusted) e.stopImmediatePropagation(); }, true); /* o jogo não vê este tipo de evento */
  for (const t of TIPOS) addEventListener(t, e => { if (!e.isTrusted || !window.ARD || !ARD.audio || !ARD.audio.desbloqueio) return; G.vistos.push({ t: t + (e.pointerType ? '(' + e.pointerType + ')' : ''), valido: ARD.audio.gestoValido ? ARD.audio.gestoValido(e) : null, evento: ARD.audio.desbloqueio().evento }); }, false); /* depois do jogo */
  const AC0 = window.AudioContext;
  class AC extends AC0 { constructor(...a) { super(...a); G.criado = { gesto, estado: this.state }; G.ctx = this; if (!gesto && !G.liberado) AC0.prototype.suspend.call(this); else G.liberado = true; }
    resume() { G.resumes.push({ gesto, estado: this.state, naFala: !!(G.interrompido && G.falaAtiva) });
      if (G.interrompido) { if (G.falaAtiva) { G.resumeNaFala++; G.caladas.push(G.falaAtiva.text); } G.interrompido = false; delete this.state; setTimeout(() => this.dispatchEvent(new Event('statechange')), 0); } /* 5.0c.1: no meio da fala, o iOS devolve a sessão ao Web Audio e a voz some; depois dela, o resume só encerra a interrupção */
      if (gesto || G.liberado) { G.liberado = true; return AC0.prototype.resume.call(this); } G.recusas++; return new Promise(() => {}); } } /* fora de gesto: pendente, como no WebKit */
  window.AudioContext = AC; window.__AC0 = AC0;
  const ESTADO = Object.getOwnPropertyDescriptor(BaseAudioContext.prototype, 'state');
  const interromper = u => { const c = G.ctx; if (!o.iosFala || !c || (G.sessao && G.sessao.type !== 'playback')) return; G.falaAtiva = u; if (G.interrompido) return; G.interrompido = true; G.interrupcoes++;
    Object.defineProperty(c, 'state', { configurable: true, get: () => G.interrompido ? 'interrupted' : ESTADO.get.call(c) }); c.dispatchEvent(new Event('statechange')); }; /* só o estado e o evento (um suspend() de verdade mandaria um statechange atrasado, depois da fala) */
  const voltar = u => { if (G.falaAtiva === u) G.falaAtiva = null; setTimeout(() => { const c = G.ctx; if (!G.interrompido || G.falaAtiva || !c) return; G.interrompido = false; delete c.state; G.voltas++; /* o próprio iOS devolve o contexto */
    c.dispatchEvent(new Event('statechange')); }, 200); };
  const ss = window.speechSynthesis, sp = ss.speak; ss.speak = function (u) { const g = gesto; if (!G.falaLiberada && !g) { G.descartadas.push(u.text); return; } G.falaLiberada = true; G.falas.push({ texto: u.text, volume: u.volume, gesto: g });
    if (o.iosFala && u.addEventListener) { u.addEventListener('start', () => interromper(u)); const f = () => voltar(u); u.addEventListener('end', f); u.addEventListener('error', f); } /* 5.0c.1 */ return sp.call(ss, u); };
  const pl = HTMLMediaElement.prototype.play; HTMLMediaElement.prototype.play = function () { G.plays.push({ gesto, loop: this.loop, playsinline: this.hasAttribute('playsinline'), src: String(this.src).slice(0, 5) }); return pl.apply(this, arguments); };
  if (o.sessao) { const s = { _t: 'auto', mudancas: [] }; Object.defineProperty(s, 'type', { enumerable: true, get() { return this._t; }, set(v) { this._t = v; this.mudancas.push({ v, gesto }); } }); Object.defineProperty(Navigator.prototype, 'audioSession', { configurable: true, get: () => s }); G.sessao = s; }
}

async function pagina(b, o) { const movel = o.movel !== false; const set = movel ? IPH : WIN;
  const ctx = await b.newContext(Object.assign({ viewport: movel ? { width: 390, height: 844 } : { width: 1280, height: 800 }, userAgent: set.ua, locale: 'pt-BR' /* 5.0c: o jogo abre no idioma do navegador */ }, movel ? { hasTouch: true, isMobile: o.webkit ? false : true, deviceScaleFactor: o.webkit ? 1 : 2 } : {}));
  await ctx.addInitScript(`(${fake.toString()})(${JSON.stringify(set)})`); await ctx.addInitScript(`(${portao.toString()})(${JSON.stringify({ sessao: o.sessao, engolir: o.engolir || [], iosFala: movel && o.iosFala !== false /* 5.0c.1 */ })})`);
  const p = await ctx.newPage(); p.setDefaultTimeout(240000); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(o.http ? HTTP + '/dist/local.html?lang=pt&' + (o.q || 'fundo=classico&aba=ajustes') : url(o.q || 'fundo=classico&aba=ajustes'), { waitUntil: 'load' }); await p.waitForFunction(() => window.ARD && ARD.audio); await espera(Math.max(700, (set.atraso || 0) + 500));
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
/* 5.0c.1: a voz do sistema no iPhone (sem vozes gravadas: o "Ouvir" de Ajustes e o Testar som sem arquivo): a fala põe o Web Audio em 'interrupted' e o
   jogo não pode chamar resume() no meio dela (nem pelo statechange, nem por um efeito, um toque ou a volta à página), senão a voz é calada; o contexto
   volta depois da fala e o diagnóstico diz que a voz do sistema interrompeu o áudio */
async function vozDoSistema(p, nome) {
  const r = await p.evaluate(async () => { const G = __portao; const r0 = { resumes: G.resumes.length, naFala: G.resumeNaFala, int: G.interrupcoes, caladas: G.caladas.length };
    const bt = document.getElementById('btn-voz-ouvir'); bt.scrollIntoView({ block: 'center' }); bt.click(); await new Promise(x => setTimeout(x, 250)); const durante = ARD.audio.ctx.state;
    ARD.audio.sfx('build'); ARD.audio.sfx('click'); document.dispatchEvent(new Event('visibilitychange')); ARD.audio.gesto({ type: 'pointerup', isTrusted: true, pointerType: 'touch' }); /* tudo o que pedia resume() antes */
    await new Promise(x => setTimeout(x, 1600)); return { durante, depois: ARD.audio.ctx.state, interrupcoes: G.interrupcoes - r0.int, resumeNaFala: G.resumeNaFala - r0.naFala, caladas: G.caladas.slice(r0.caladas), porFala: ARD.audio.desbloqueio().porFala, falou: __fala.log.some(l => /Fenda/.test(l.text)) }; });
  conf(nome + ': a voz do sistema põe o Web Audio em interrupted e o jogo não chama resume() no meio dela (efeito, toque, volta à página): a fala não é calada e o contexto volta depois', r.falou && r.durante === 'interrupted' && r.interrupcoes >= 1 && r.resumeNaFala === 0 && !r.caladas.length && r.depois === 'running' && r.porFala >= 1, r);
  return r; }

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
    const sfx = await p.evaluate(async () => { const c = ARD.audio.ctx; let n = 0; const o = c.createOscillator.bind(c), bs = c.createBufferSource.bind(c); c.createOscillator = () => { n++; return o(); }; c.createBufferSource = () => { n++; return bs(); }; /* 5.0f: com os efeitos pré-gravados (src/som3d.js), cada efeito é um AudioBufferSourceNode numa voz do mixer */ ARD.audio.sfx('build'); ARD.audio.sfx('explosion'); const t0 = c.currentTime; await new Promise(r => setTimeout(r, 300)); c.createOscillator = o; c.createBufferSource = bs; return { n, anda: c.currentTime > t0, mixer: !!(ARD.som3d && ARD.som3d.pronto()) }; });
    conf('chromium celular: efeitos tocam (osciladores ou buffers do mixer criados, relógio do áudio andando)', (sfx.mixer ? sfx.n >= 2 : sfx.n >= 3) && sfx.anda, sfx); /* 5.0f */
    const dg = await testarSom(p, '#btn-som-teste', '#som-diag');
    conf('chromium celular: Testar som mostra o diagnóstico', !!dg && /Áudio: tocando/.test(dg) && /Sessão de reprodução: sim/.test(dg) && /Vozes em português: \d+/.test(dg) && /Voz: Luciana \(Aprimorada\)/.test(dg) && /Fala: tocou/.test(dg), dg);
    { const g = await p.evaluate(() => ({ naFala: __portao.resumeNaFala, caladas: __portao.caladas.slice() })); conf('chromium celular: Testar som na voz do sistema: o diagnóstico diz que ela interrompeu o áudio do jogo e nenhuma fala foi calada', /a voz do sistema interrompeu o áudio do jogo \(já voltou\)/.test(dg) && g.naFala === 0 && !g.caladas.length, { diag: dg, resumeNaFala: g.naFala, caladas: g.caladas }); } /* 5.0c.1 */
    if (fotos) { fs.mkdirSync(path.join(root, 'work/fotos'), { recursive: true }); await p.locator('.cpane[data-pane="ajustes"] .voz-ui').screenshot({ path: path.join(root, 'work/fotos/testar-som-celular.png') }); }
    /* 'interrupted' (ligação, outro app): o statechange retoma; o próximo gesto confere de novo */
    const it = await p.evaluate(async () => { const c = ARD.audio.ctx, r0 = __portao.resumes.length; Object.defineProperty(c, 'state', { configurable: true, get: () => 'interrupted' }); c.dispatchEvent(new Event('statechange')); const pronto = ARD.audio.desbloqueio().pronto; delete c.state; await new Promise(r => setTimeout(r, 300)); return { resumes: __portao.resumes.length - r0, interrompido: ARD.audio.desbloqueio().interrompido, pronto, estado: c.state }; });
    conf('chromium celular: estado interrupted é retomado', it.resumes >= 1 && it.interrompido === 1 && it.pronto === false && it.estado === 'running', it);
    /* volta para a página: escondida, o contexto suspenso espera; à vista de novo, retoma */
    const vis = await p.evaluate(async () => { const c = ARD.audio.ctx; Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); await __AC0.prototype.suspend.call(c); await new Promise(r => setTimeout(r, 200)); const escondida = c.state;
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); await new Promise(r => setTimeout(r, 300)); return { escondida, voltou: c.state }; });
    conf('chromium celular: visibilitychange retoma ao voltar para a página', vis.escondida === 'suspended' && vis.voltou === 'running', vis);
    await vozDoSistema(p, 'chromium celular');
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
    await vozDoSistema(p, 'webkit');
    const dg = await testarSom(p, '#btn-som-teste', '#som-diag'); conf('webkit: Testar som mostra o diagnóstico', !!dg && /Áudio: tocando/.test(dg) && /Sessão de reprodução: sim/.test(dg) && /Vozes em português: \d+/.test(dg) && /Fala: tocou/.test(dg), dg);
    { const vs = await p.evaluate(() => __portao.vistos.slice()); const t = k => vs.filter(x => x.t.startsWith(k)); conf('webkit: no botão, touchend e click contam como gesto; touchstart e pointerdown do toque não', t('touchend').length && t('click').length && t('touchend').concat(t('click')).every(x => x.valido === true) && t('touchstart').concat(t('pointerdown(touch)')).every(x => x.valido === false), { tipos: [...new Set(vs.map(x => x.t + '=' + x.valido))].join(' ') }); }
    conf('webkit: sem erros na página', !P.errs.length, P.errs.slice(0, 3)); await P.close(); }
  for (const [eng, quer] of [[['pointerup'], 'touchend'], [['pointerup', 'touchend'], 'click']]) { const P = await pagina(b, { sessao: true, webkit: true, engolir: eng }); const { p } = P; const pt = quer === 'click' ? await botao(p, '#btn-voz-ouvir') : await vazio(p); await p.touchscreen.tap(pt.x, pt.y); /* o click só vem de um elemento clicável */ await espera(700);
    if (quer === 'click') { await p.waitForFunction(() => !speechSynthesis.speaking && !speechSynthesis.pending, null, { timeout: 8000 }).catch(() => {}); await espera(500); } /* 5.0c.1: o botão é o Ouvir, que fala: a voz do sistema interrompe o Web Audio até acabar (bancada do iPhone) */ const e = await estado(p); const pr = prep(e.g);
    conf(`webkit: sem ${eng.join(' e ')}, desbloqueia no ${quer}`, e.d.evento === quer && e.audio === 'running' && !!pr && pr.gesto === quer, { evento: e.d.evento, audio: e.audio, preparo: pr && pr.gesto, eventos: e.g.eventos.join(' ') }); await P.close(); }
  await b.close(); }

/* 5.0c.1: iPhone imitado com as vozes gravadas (Chromium e WebKit), pelo HTTP */
async function gravadas() { const real = fs.existsSync(path.join(root, 'assets/vozes/pt-BR/manifesto.json')); /* 5.0c.1 (junção): com as vozes reais em assets/vozes/, o teste usa elas (o build as leva para dist/); sem elas, o manifesto de teste das amostras */
  if (!real && !fs.existsSync(path.join(root, 'work/vozes-teste/pt-BR/manifesto.json'))) require('child_process').execFileSync(process.execPath, [path.join(__dirname, 'provisorio.cjs'), '--teste'], { stdio: 'ignore' });
  const S = await servir(root); HTTP = S.url; const Q = 'fundo=classico&aba=ajustes' + (real ? '' : '&vozes=../work/vozes-teste/');
  const spy = p => p.evaluate(() => { window.__vg = { ev: [], caps: [] }; addEventListener('ard-voz', e => __vg.ev.push((e.detail.gravada ? '*' : '') + e.detail.tipo)); const o = ARD.audio.onSay; ARD.audio.onSay = (t, k) => { __vg.caps.push(t); if (o) o(t, k); }; });
  const sinal = p => p.evaluate(() => ({ falas: __portao.falas.length, descartadas: __portao.descartadas.length, fake: __fala.log.length }));
  const diz = (p, js, ms) => p.evaluate(async ({ js, ms }) => { __vg.ev.length = 0; __vg.caps.length = 0; const ok = (0, eval)(js); await new Promise(r => setTimeout(r, ms)); return { ok, ev: __vg.ev.join(','), caps: __vg.caps.slice(), ctx: ARD.audio.ctx ? ARD.audio.ctx.state : null }; }, { js, ms });
  const tocou = r => /^\*inicio(,\*palavra)+,\*fim$/.test(r.ev);
  for (const eng of ['chromium', 'webkit']) { const b = await (eng === 'chromium' ? pw.chromium.launch({ headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'] }) : pw.webkit.launch({ headless: true }));
    try { const P = await pagina(b, { sessao: true, webkit: eng === 'webkit', http: true, q: Q }); const { p } = P; await spy(p);
      await p.waitForFunction(() => ARD.vozes.estado === 'pronto' || ARD.vozes.estado === 'indisponivel', null, { timeout: 60000 }).catch(() => {});
      const so = await p.evaluate(() => ARD.vozes.sonda()); const est = await p.evaluate(() => ({ estado: ARD.vozes.estado, motivo: ARD.vozes.motivo, formato: ARD.vozes.formato, disponivel: ARD.vozes.disponivel() }));
      if (eng === 'webkit' && est.estado !== 'pronto') { /* o WebKit do Playwright sem Opus: nenhum formato decodifica e o jogo volta para a voz do sistema, com a fala de preparo no toque */
        const pt = await vazio(p); await p.touchscreen.tap(pt.x, pt.y); await espera(700); const e = await estado(p); const pr = prep(e.g);
        conf('webkit com vozes gravadas: sem formato que decodifique, volta para a voz do sistema (preparo no toque)', est.motivo === 'formato' && !est.disponivel && !!pr && /^(pointerup|touchend)$/.test(pr.gesto), { sonda: so, estado: est, preparo: pr && pr.gesto });
        conf('webkit com vozes gravadas: sem erros na página', !P.errs.length, P.errs.slice(0, 3)); await P.close(); continue; }
      conf(eng + ' celular com vozes gravadas: manifesto pronto e formato pela sonda de decodeAudioData', est.estado === 'pronto' && est.formato === 'ogg' && so.ogg.decodifica, { estado: est, sonda: so });
      { const dc = await p.evaluate(() => { const el = document.querySelector('.cpane[data-pane="ajustes"] [data-voz-dica]'); return el && !el.hidden ? el.textContent : null; }); /* 5.0c.1: o Safari não expõe as vozes aprimoradas: a dica diz que o jogo fala com as gravadas */
        conf(eng + ' celular com vozes gravadas: a dica de Ajustes diz que o jogo fala com as vozes gravadas (não manda baixar a Luciana Aprimorada)', !!dc && /vozes gravadas de cada Raça/.test(dc) && !/Aprimorada/.test(dc), dc); }
      const pt = await vazio(p); await p.touchscreen.tap(pt.x, pt.y); await espera(700); const e = await estado(p); const s1 = await sinal(p);
      conf(eng + ' celular com vozes gravadas: o toque desbloqueia sem chamar o speechSynthesis (sem fala de preparo)', /^(pointerup|touchend)$/.test(e.d.evento) && e.audio === 'running' && e.g.sessao === 'playback' && s1.falas === 0 && s1.descartadas === 0 && e.d.voz === false, { evento: e.d.evento, audio: e.audio, sessao: e.g.sessao, falas: s1 });
      await p.evaluate(() => ARD.vozes.carregarPacote(ARD.vozes.destaque || 'vehnar')); await p.waitForFunction(() => ARD.vozes.estadoMem().fila === 0 && ARD.vozes.estadoMem().arquivos >= 3, null, { timeout: 30000 }).catch(() => {}); await espera(500);
      const r1 = await diz(p, "ARD.audio.say('Unidade pronta', 'spawn', 0)", 2200); const s2 = await sinal(p);
      conf(eng + ' celular com vozes gravadas: fala gravada fora de gesto toca pelo Web Audio, com legenda e ard-voz, sem voz do sistema', r1.ok && tocou(r1) && r1.caps.length === 1 && r1.ctx === 'running' && s2.falas === 0 && s2.descartadas === 0 && s2.fake === 0, { ev: r1.ev, caps: r1.caps, ctx: r1.ctx, falas: s2 });
      const r2 = await diz(p, "ARD.audio.say('Prole Velk eliminada. 7 restantes', 'elim', 0)", 800); const s3 = await sinal(p);
      conf(eng + ' celular com vozes gravadas: fala sem arquivo (texto dinâmico) fica só na legenda (IOS_FALA_SISTEMA = false)', r2.ok && !r2.ev && r2.caps.length === 1 && s3.falas === 0 && s3.descartadas === 0 && s3.fake === 0, { ev: r2.ev, caps: r2.caps, falas: s3 });
      const it = await p.evaluate(async () => { const c = ARD.audio.ctx; Object.defineProperty(c, 'state', { configurable: true, get: () => 'interrupted' }); c.dispatchEvent(new Event('statechange')); delete c.state; await new Promise(r => setTimeout(r, 300)); return c.state; });
      const r3 = await diz(p, "ARD.audio.say('Base sob ataque', 'Base sob ataque', 0)", 2600);
      conf(eng + ' celular com vozes gravadas: depois de interrupted o Web Audio volta a running e a fala seguinte toca', it === 'running' && tocou(r3) && r3.ctx === 'running', { depois: it, ev: r3.ev });
      await p.evaluate(() => __AC0.prototype.suspend.call(ARD.audio.ctx)); await espera(200); const r4 = await diz(p, "ARD.audio.say('Unidade pronta', 'spawn', 0)", 2800);
      conf(eng + ' celular com vozes gravadas: com o Web Audio suspenso, a fala retoma o contexto e toca', tocou(r4) && r4.ctx === 'running', { ev: r4.ev, ctx: r4.ctx });
      const dg = await testarSom(p, '#btn-som-teste', '#som-diag'); await espera(5500); const dg2 = await p.evaluate(() => document.getElementById('som-diag').textContent); const s4 = await sinal(p);
      conf(eng + ' celular com vozes gravadas: Testar som toca a voz gravada da Raça em destaque, sem voz do sistema', /Áudio: tocando/.test(dg2) && /Voz gravada: tocou/.test(dg2) && !/Fala:/.test(dg2) && s4.falas === 0 && s4.fake === 0, { diag: dg2, falas: s4 });
      if (fotos && eng === 'chromium') await p.locator('.cpane[data-pane="ajustes"] .voz-ui').screenshot({ path: path.join(root, 'work/fotos/testar-som-gravada-celular.png') });
      conf(eng + ' celular com vozes gravadas: sem erros na página', !P.errs.length, P.errs.slice(0, 3)); await P.close(); }
    finally { await b.close(); } }
  { /* o mesmo iPhone com as vozes gravadas desligadas em Ajustes: tudo como na 5.0c (voz do sistema e fala de preparo no toque) */ const b = await pw.chromium.launch({ headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'] });
    try { const P = await pagina(b, { sessao: true, http: true, q: Q }); const { p } = P; await p.evaluate(() => { const cb = document.getElementById('opt-voz-gravada'); cb.checked = false; cb.dispatchEvent(new Event('change')); }); await espera(300);
      const pt = await vazio(p); await p.touchscreen.tap(pt.x, pt.y); await espera(700); const e = await estado(p); const pr = prep(e.g); const f = await falaFora(p);
      conf('chromium celular, vozes gravadas desligadas: preparo no toque e voz do sistema, como antes', !!pr && f.ok && f.falou && JSON.parse((await p.evaluate(() => localStorage.getItem('ard-audio'))) || '{}').gravadas === false, { preparo: pr && pr.gesto, falou: f.falou });
      await p.evaluate(() => { const cb = document.getElementById('opt-voz-gravada'); cb.checked = true; cb.dispatchEvent(new Event('change')); }); await P.close(); } finally { await b.close(); } }
  await S.fechar(); }
/* --raiz=<cópia da base>: o mesmo toque no jogo de antes (sem A.gesto): o que acontecia no iPhone emulado */
async function base() { for (const eng of ['chromium', 'webkit']) { const b = await (eng === 'chromium' ? pw.chromium.launch({ headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--allow-file-access-from-files', '--disable-dev-shm-usage'] }) : pw.webkit.launch({ headless: true }));
  const P = await pagina(b, { sessao: true, webkit: eng === 'webkit' }); const { p } = P; const pt = await vazio(p); await p.touchscreen.tap(pt.x, pt.y); await espera(700); const e = await estado(p); const f = await falaFora(p);
  conf(`${eng} celular (antes): AudioContext running depois do toque`, e.audio === 'running', { audio: e.audio, resumes: e.g.resumes, recusas: e.g.recusas, eventos: e.g.eventos.join(' ') });
  conf(`${eng} celular (antes): audioSession em playback`, e.g.sessao === 'playback', { sessao: e.g.sessao });
  conf(`${eng} celular (antes): fala do jogo fora de gesto toca`, f.falou, { descartadas: e.g.descartadas.length + (f.descartada ? 1 : 0), legenda: f.caps.length });
  await espera(600); await vozDoSistema(p, `${eng} celular (antes)`); /* 5.0c.1: no jogo de antes, o statechange e os efeitos retomam no meio da fala (a voz é calada) */
  await P.close(); await b.close(); } }
(async () => { const t0 = Date.now(); console.log('página: ' + url('')); if (raiz !== root) await base(); else { await chromium(); await webkit(); if (!process.argv.includes('--sem-gravadas')) await gravadas(); /* 5.0c.1 */ }
  const ok = R.filter(r => r.ok).length; fs.mkdirSync(path.join(root, 'work'), { recursive: true }); fs.writeFileSync(path.join(root, 'work/som-celular-teste' + (raiz !== root ? '-base' : '') + '.json'), JSON.stringify({ quando: new Date().toISOString(), raiz, resultados: R }, null, 2));
  console.log(`som no celular: ${ok}/${R.length} conferências ok (${((Date.now() - t0) / 1000).toFixed(1)} s)`); process.exit(ok === R.length ? 0 : 1); })().catch(e => { console.error(e); process.exit(2); });
