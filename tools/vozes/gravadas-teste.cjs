// 5.0c.1: portão das vozes gravadas (tools/qa.cjs, item "vozes"). Confere:
// 1) o manifesto de cada idioma (assets/vozes/<idioma>/manifesto.json) cobre todas as chaves que o jogo usa nas cinco Raças (src/vozes.js) e as falas
//    da campanha; os arquivos existem e a duração do manifesto bate com a do arquivo; os tempos de palavra são coerentes. Sem assets/vozes/, confere
//    o provisório (work/vozes-provisorio/, de tools/vozes/provisorio.cjs) só em arquivos e durações, e diz que o real ainda não chegou;
// 2) numa página servida por HTTP (o fetch não lê file://), uma fala gravada toca com o Web Audio 'running', dispara a legenda e o 'ard-voz' com as
//    palavras, sem chamar a voz do sistema; o "Testar som" diz "Voz gravada: tocou";
// 3) numa partida, o pacote da Raça do jogador só baixa depois da tela de carregamento; resposta de unidade ao selecionar e ao mover, aviso novo com a
//    reação do líder em fila, eliminação com o nome da IA e os inimigos restantes, perigo cortando a fala de rotina e a troca de idioma;
// 4) sem os arquivos (pedidos a assets/vozes/ respondem 404), a tela inicial segue inteira, com a voz do sistema.
// Uso: NODE_PATH=<node_modules com playwright> node tools/vozes/gravadas-teste.cjs [--json] [--sem-partida]
const fs = require('fs'), path = require('path'); const root = path.resolve(__dirname, '../..');
const U = require('./manifesto-util.cjs'); const { servir } = require('./servidor.cjs'); const fake = require('./fala-falsa.cjs'); const SETS = require('./conjuntos.cjs');
const JSONOUT = process.argv.includes('--json'), SEM_PARTIDA = process.argv.includes('--sem-partida');
const IDI = ['pt-BR', 'en', 'es']; const espera = ms => new Promise(r => setTimeout(r, ms)); const log = s => { if (!JSONOUT) console.log(s); else process.stderr.write(s + '\n'); };
const out = { real: false, manifestos: {}, inicio: null, partida: null, semArquivos: null };
// ---------- 1) manifestos ----------
const realDir = path.join(root, 'assets/vozes'); out.real = IDI.some(l => fs.existsSync(path.join(realDir, l, 'manifesto.json')));
if (!out.real && !['vozes-provisorio', 'vozes-teste'].every(d => fs.existsSync(path.join(root, 'work', d, 'pt-BR/manifesto.json')))) require('child_process').execFileSync(process.execPath, [path.join(__dirname, 'provisorio.cjs'), '--teste'], { stdio: 'ignore' }); /* sem o real: o provisório e o de teste */
for (const l of IDI) { const d = out.real ? path.join(realDir, l) : path.join(root, 'work/vozes-provisorio', l); if (!fs.existsSync(path.join(d, 'manifesto.json'))) { out.manifestos[l] = { ok: false, erro: 'sem manifesto' }; continue; }
  const r = U.conferir(root, d); out.manifestos[l] = { ok: out.real ? r.ok : (!r.arquivos.faltam.length && !r.arquivos.duracao.length && !r.palavras.length), provisorio: r.provisorio, falas: r.falas, kb: Math.round(r.bytes / 1024), pacotes: Object.fromEntries(Object.entries(r.pacotes).map(([k, v]) => [k, Math.round(v / 1024)])), faltam: r.faltam.length, exemplos: r.faltam.slice(0, 6), campanha: r.campanha, arquivosFaltam: r.arquivos.faltam.slice(0, 5), duracao: r.arquivos.duracao.slice(0, 5), palavras: r.palavras.slice(0, 5) };
  log(`manifesto ${l}: ${out.manifestos[l].ok ? 'ok' : 'FALHOU'} · ${r.falas} falas · ${Math.round(r.bytes / 1024)} KB${out.real ? ' · faltam ' + r.faltam.length + ' chaves' : ' · provisório (cobre ' + (r.provisorio ? 'só as amostras' : '?') + ')'}`); }
// ---------- 2 a 4) navegador ----------
const qVozes = out.real ? '' : '&vozes=../work/vozes-teste/'; /* sem o real: o manifesto de teste (todas as chaves apontam para as amostras) exercita o caminho inteiro */
const set = SETS.find(s => s.id === 'edge');
async function pagina(b, S, q, o) { o = o || {}; const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, userAgent: set.ua, locale: 'pt-BR' }); await ctx.addInitScript(`(${fake.toString()})(${JSON.stringify(set)})`);
  await ctx.addInitScript(() => { window.__vz = { ev: [], caps: [], cargaFim: null }; addEventListener('ard-voz', e => { const d = e.detail; __vz.ev.push({ t: Math.round(performance.now()), tipo: d.tipo, gravada: !!d.gravada, chave: d.chave || null, w: d.tipo === 'palavra' ? String(d.texto || '').substr(d.i, d.n) : null, dur: d.dur || 0, texto: d.texto }); });
    const vig = () => { const el = document.getElementById('loading'); if (!el) return; new MutationObserver(() => { if (el.hidden && !__vz.cargaFim && window.__ARDG) __vz.cargaFim = Date.now(); }).observe(el, { attributes: true, attributeFilter: ['hidden'] }); }; if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', vig); else vig(); });
  const p = await ctx.newPage(); p.setDefaultTimeout(900000); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !(o.semArquivos && /Failed to load resource/.test(m.text()))) errs.push(m.text()); });
  await p.goto(S.url + '/dist/local.html?' + q, { waitUntil: 'load' }); await p.waitForFunction(() => window.ARD && ARD.audio && ARD.vozes); return { ctx, p, errs }; }
const legendas = p => p.evaluate(() => { const o = ARD.audio.onSay; ARD.audio.onSay = (t, k) => { __vz.caps.push({ t, k }); if (o) o(t, k); }; });
/* fala e espera: devolve os eventos 'ard-voz', as legendas e o que a voz do sistema falou */
const fala = (p, js, ms) => p.evaluate(async ({ js, ms }) => { __vz.ev.length = 0; __vz.caps.length = 0; __fala.log.length = 0; const ok = (0, eval)(js); await new Promise(r => setTimeout(r, ms)); return { ok, ev: __vz.ev.slice(), caps: __vz.caps.slice(), sistema: __fala.log.map(x => x.text), ctx: ARD.audio.ctx ? ARD.audio.ctx.state : null }; }, { js, ms });
const tocouGravada = (r, chave) => { const ev = r.ev.filter(e => e.gravada && (!chave || e.chave === chave)); const pal = ev.filter(e => e.tipo === 'palavra'); return ev.length && ev[0].tipo === 'inicio' && pal.length >= 1 && pal.every(e => e.dur > 0) && ev[ev.length - 1].tipo === 'fim'; };
async function navegador() { let pw; try { pw = require('playwright'); } catch (e) { return { erro: 'playwright indisponível (defina NODE_PATH)' }; }
  const b = await pw.chromium.launch({ headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required'] });
  const S = await servir(root);
  try {
    { /* 2) tela inicial com vozes */ const P = await pagina(b, S, 'fundo=classico&aba=ajustes' + qVozes); const { p } = P; await legendas(p); await p.mouse.click(8, 8); await espera(300);
      await p.waitForFunction(() => ARD.vozes.estado === 'pronto' && ARD.vozes.estadoMem().arquivos >= 1, null, { timeout: 60000 }).catch(() => {});
      const ini = await p.evaluate(() => ({ estado: ARD.vozes.estado, formato: ARD.vozes.formato, destaque: ARD.vozes.destaque, mem: ARD.vozes.estadoMem() })); const pedIni = S.pedidos.filter(x => /\/vozes/.test(x.url) && !/local\.html/.test(x.url)).map(x => ({ url: x.url.replace(/\?.*$/, ''), bytes: x.bytes }));
      await p.evaluate(r => ARD.vozes.carregarPacote(r), ini.destaque || 'vehnar'); await p.waitForFunction(() => ARD.vozes.estadoMem().fila === 0, null, { timeout: 30000 }).catch(() => {}); await espera(600);
      const r = await fala(p, "ARD.audio.say('Unidade pronta', 'spawn', 0)", 2600); const texto = await p.evaluate(r => { const m = ARD.vozes.m, id = m.chaves[r].spawn[0]; return m.falas[id].texto; }, ini.destaque || 'vehnar');
      await p.click('#btn-som-teste'); await espera(7000); const diag = await p.evaluate(() => document.getElementById('som-diag').textContent);
      out.inicio = { ok: ini.estado === 'pronto' && !!ini.formato && tocouGravada(r, 'spawn') && r.ctx === 'running' && !r.sistema.length && r.caps.length === 1 && r.caps[0].t === texto && /Voz gravada: tocou/.test(diag) && !P.errs.length,
        estado: ini.estado, formato: ini.formato, destaque: ini.destaque, kbTelaInicial: Math.round(pedIni.reduce((s, x) => s + x.bytes, 0) / 1024), pedidosTelaInicial: pedIni.map(x => x.url.replace(/^.*\/vozes[^/]*\//, '')), eventos: r.ev.map(e => e.tipo + (e.w ? '(' + e.w + ')' : '')).join(','), legenda: r.caps.map(c => c.t), sistema: r.sistema, ctx: r.ctx, diag, erros: P.errs.slice(0, 3) };
      log('tela inicial com vozes: ' + (out.inicio.ok ? 'ok' : 'FALHOU') + ' · ' + JSON.stringify(out.inicio)); await P.ctx.close(); }
    if (!SEM_PARTIDA) { /* 3) partida com vozes (motor clássico, Baixa) */ const n0 = S.pedidos.length; const t0 = Date.now();
      const P = await pagina(b, S, 'autostart=1&seed=42&opp=2&faction=vehnar&debug=1&q=baixa&dia=1&semsalvar=1&legendas=1' + qVozes); const { p } = P;
      await p.waitForFunction(() => document.getElementById('loading').hidden && window.__ARDG && __vz.cargaFim, null, { timeout: 1500000 }); const cargaFim = await p.evaluate(() => __vz.cargaFim); await legendas(p);
      await p.waitForFunction(() => ARD.vozes.estado === 'pronto' && ARD.vozes.estadoMem().fila === 0 && ARD.vozes.estadoMem().arquivos > 0, null, { timeout: 120000 }).catch(() => {}); await espera(1500);
      const peds = S.pedidos.slice(n0).filter(x => /\/vozes/.test(x.url) && !/local\.html/.test(x.url)); const duranteCarga = peds.filter(x => x.quando < cargaFim).map(x => x.url); /* nada durante a carga */
      const mem = await p.evaluate(() => ARD.vozes.estadoMem()); const pacote = await p.evaluate(() => Object.values(ARD.vozes.m.falas).filter(f => f.pacote === 'vehnar').length);
      const tem = await p.evaluate(() => { const t = ARD.vozes.m.chaves.vehnar || {}; return { sel: !!t['unid:civil:sel'], mover: !!t['unid:civil:mover'], era: !!t['loc:era2'], lider: !!t['lider:era'], elim: !!t['elim:fundicao-kessari'] && !!t['loc:inimigos-2'] }; });
      const R = { carga_s: Math.round((cargaFim - t0) / 1000), duranteCarga, pedidos: peds.length, kbPartida: Math.round(peds.reduce((s, x) => s + x.bytes, 0) / 1024), mem, pacote, tem };
      await p.evaluate(() => { ARD.hud3.capHold = true; }); /* 5.0g: segura a legenda até a leitura (com a GPU por software a segunda ida à página às vezes chegava depois de ela sumir) */
      R.aviso = await fala(p, "ARD.audio.say('Construção concluída', 'built', 4)", 2400); R.aviso.legendaNaTela = await p.evaluate(() => { const c = document.getElementById('caption'); const t = c && !c.hidden ? c.querySelector('span').textContent : null; ARD.hud3.capHold = false; return t; });
      await espera(3300); R.perigo = await fala(p, "ARD.audio.say('Unidade pronta', 'spawn', 5); setTimeout(() => ARD.audio.say('Base sob ataque', 'Base sob ataque', 8), 250)", 3200); /* o perigo corta a rotina com fade */
      if (tem.sel) { R.sel = await fala(p, "(() => { const G = __ARDG, ids = G.sim.ents.filter(e => e.alive && e.owner === G.human && e.kind === 'unit' && e.def === 'coletor').map(e => e.id); G.I.select(ids); return ids.length; })()", 2200); }
      if (tem.mover) { const cv = await p.evaluate(() => { const c = document.querySelector('#game canvas'); const r = c.getBoundingClientRect(); return { x: Math.round(r.left + r.width * 0.55), y: Math.round(r.top + r.height * 0.55) }; }); await espera(2700);
        await p.evaluate(() => { __vz.ev.length = 0; __fala.log.length = 0; }); await p.mouse.click(cv.x, cv.y, { button: 'right' }); await espera(2200); R.mover = await p.evaluate(() => ({ ev: __vz.ev.slice(), caps: [], sistema: __fala.log.map(x => x.text) })); }
      if (tem.era && tem.lider) R.era = await fala(p, "ARD.vozes.evento({ t: 'era', p: __ARDG.human, era: 2 })", 9000); /* o locutor e, na fila, o líder */
      if (tem.elim) R.elim = await fala(p, "ARD.audio.say('Fundição Kessari eliminada. 2 inimigos restantes', 'elim', 0, null, ARD.vozes.elim({ name: 'Fundição Kessari' }, 2))", 6000);
      await p.evaluate(() => ARD.i18n.set('en', { salvar: false })); await p.waitForFunction(() => ARD.vozes.estado === 'pronto' && ARD.vozes.idioma === 'en' && ARD.vozes.estadoMem().fila === 0 && ARD.vozes.estadoMem().arquivos > 0, null, { timeout: 60000 }).catch(() => {}); await espera(800);
      R.ingles = await fala(p, "ARD.audio.say('Unit ready', 'spawn', 0)", 2400); R.ingles.texto = await p.evaluate(() => { const m = ARD.vozes.m, id = m.chaves.vehnar.spawn[0]; return m.falas[id].texto; });
      await p.evaluate(() => { document.getElementById('a11y').hidden = false; }); await p.click('#pt-som-teste'); await espera(7000); R.diag = await p.evaluate(() => document.getElementById('pt-som-diag').textContent);
      const seq = r => r ? r.ev.filter(e => e.gravada && e.tipo === 'inicio').map(e => e.chave) : [];
      R.checa = { semCarga: !duranteCarga.length, pacote: mem.arquivos >= pacote && pacote > 0, aviso: tocouGravada(R.aviso, 'built') && !R.aviso.sistema.length && R.aviso.legendaNaTela === R.aviso.caps[0].t,
        perigo: seq(R.perigo).join(',') === 'spawn,Base sob ataque' && R.perigo.ev.filter(e => e.chave === 'spawn' && e.tipo === 'fim').length === 1 && tocouGravada({ ev: R.perigo.ev.filter(e => e.chave === 'Base sob ataque') }),
        sel: !tem.sel || (R.sel.ok > 0 && seq(R.sel).join(',') === 'unid:civil:sel' && !R.sel.caps.length), mover: !tem.mover || seq(R.mover).join(',') === 'unid:civil:mover',
        era: !R.era || seq(R.era).join(',') === 'loc:era2,lider:era', elim: !R.elim || (tocouGravada(R.elim, 'elim:fundicao-kessari') && R.elim.ev.filter(e => e.tipo === 'palavra').length >= 3 && R.elim.caps.length === 1),
        ingles: tocouGravada(R.ingles, 'spawn') && R.ingles.caps[0] && R.ingles.caps[0].t === R.ingles.texto, diag: /Recorded voice: played/.test(R.diag) || /Voz gravada: tocou/.test(R.diag), erros: !P.errs.length };
      R.ok = Object.values(R.checa).every(Boolean); R.erros = P.errs.slice(0, 3); for (const k of ['aviso', 'perigo', 'sel', 'mover', 'era', 'elim', 'ingles']) if (R[k]) R[k] = { ok: R[k].ok, seq: seq(R[k]), eventos: R[k].ev.map(e => e.tipo + (e.gravada ? '*' : '') + (e.w ? '(' + e.w + ')' : '')).join(','), legendas: (R[k].caps || []).map(c => c.t), sistema: R[k].sistema, legendaNaTela: R[k].legendaNaTela, texto: R[k].texto };
      out.partida = R; log('partida com vozes: ' + (R.ok ? 'ok' : 'FALHOU') + ' · ' + JSON.stringify(R.checa) + ' · ' + R.kbPartida + ' KB'); await P.ctx.close(); }
    { /* 4) sem os arquivos: assets/vozes/ (e o manifesto de teste) respondem 404 */ await S.fechar(); const S2 = await servir(root, { bloquear: /\/(assets\/vozes|work\/vozes-teste)\// });
      const P = await pagina(b, S2, 'fundo=classico&aba=ajustes' + qVozes, { semArquivos: true }); const { p } = P; await legendas(p); await p.mouse.click(8, 8); await espera(3500);
      const r = await fala(p, "ARD.audio.say('Unidade pronta', 'spawn', 0)", 1500); await p.click('#btn-som-teste'); await espera(2500); const diag = await p.evaluate(() => document.getElementById('som-diag').textContent); const est = await p.evaluate(() => ARD.vozes.estado);
      const abas = await p.evaluate(() => [...document.querySelectorAll('.ctab')].length);
      out.semArquivos = { ok: r.ok && r.sistema.includes('Unidade pronta') && !r.ev.some(e => e.gravada) && r.caps.length === 1 && /Fala: tocou/.test(diag) && /Voz gravada: sem arquivo/.test(diag) && est === 'indisponivel' && abas >= 4 && !P.errs.length, estado: est, sistema: r.sistema, diag, erros: P.errs.slice(0, 3) };
      log('sem arquivos: ' + (out.semArquivos.ok ? 'ok' : 'FALHOU') + ' · ' + JSON.stringify(out.semArquivos)); await P.ctx.close(); await S2.fechar(); }
  } finally { await b.close(); }
  return null; }
(async () => { const t0 = Date.now(); const e = await navegador().catch(er => ({ erro: String(er && er.stack || er).slice(0, 600) })); if (e) out.erro = e.erro;
  const man = IDI.every(l => out.manifestos[l] && out.manifestos[l].ok); out.ok = man && !out.erro && !!(out.inicio && out.inicio.ok) && (SEM_PARTIDA || !!(out.partida && out.partida.ok)) && !!(out.semArquivos && out.semArquivos.ok); out.tempo_s = Math.round((Date.now() - t0) / 1000);
  fs.mkdirSync(path.join(root, 'work'), { recursive: true }); fs.writeFileSync(path.join(root, 'work/gravadas-teste.json'), JSON.stringify(out, null, 2));
  if (JSONOUT) console.log(JSON.stringify(out)); else console.log('vozes: ' + (out.ok ? 'ok' : 'FALHOU') + (out.erro ? ' · ' + out.erro : '')); process.exit(out.ok ? 0 : 1); })();
