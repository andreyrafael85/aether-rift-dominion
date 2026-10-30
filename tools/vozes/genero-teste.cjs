// 5.0a.3: teste da voz por líder. No modo Automática, a fala de cada líder (chave 'sala-<raça>', a mesma da Sala de Comando) tem de sair numa voz do
// gênero do líder (Sylvia Oriel feminina; Barão-Forja, Vesper Ísk, Zayin Coral e Oru Voraz masculinos). 5.0b.1: a melhor voz do gênero entre as vozes
// boas do aparelho, de qualquer nível a partir do 1 (nunca uma robótica); sem voz do gênero, a melhor de todas. O Chrome do Windows passa a dar o Daniel
// aos líderes homens e a Google à Sylvia; o iPhone com a Luciana Aprimorada dá o Felipe comum aos homens (antes, a Luciana Aprimorada para todos).
// Locutor e unidades seguem com a Automática; a voz escolhida em Ajustes vale para todas as falas; legenda (A.onSay) e evento 'ard-voz' continuam iguais.
// Roda o src/audio.js de verdade no Node, com a imitação de fala (fala-falsa.cjs) e os conjuntos de vozes (conjuntos.cjs), os dois só em leitura;
// aparelhos a mais saem dos mesmos conjuntos: Windows antigo, iPhone com Luciana e Felipe aprimorados, Chrome sem rede e (5.0b.1) Firefox com a Maria e
// o Daniel, iPhone sem o Felipe (o único homem é robótico: Eddy, Reed, Rocko) e um Android (vozes sem gênero no nome).
// 5.0c.1: e com as vozes gravadas (um tocador de imitação no lugar do src/vozes.js): com a fala gravada pronta, o líder fala pela gravada do pacote da
// Raça dele e a voz do sistema não é chamada; sem ela pronta, a voz do sistema no gênero do líder, como antes, e o arquivo é pedido; no iPhone com
// vozes gravadas, a fala sem arquivo fica só na legenda.
// Uso: node tools/vozes/genero-teste.cjs [--navegador]   (--navegador: também Edge, Chrome do Windows e iPhone na página do jogo, dist/local.html; NODE_PATH com playwright)
const path = require('path'), fs = require('fs'), vm = require('vm'); const root = path.resolve(__dirname, '../..');
const SETS = require('./conjuntos.cjs'); const fake = require('./fala-falsa.cjs');
const espera = ms => new Promise(r => setTimeout(r, ms));
const LIDERES = [['tessara', 'Sylvia Oriel', 'Sylvia Oriel. Oriel cresce. E quem resiste vira adubo.'], ['vehnar', 'Barão-Forja', 'Barão-Forja. Kessari não para de fundir.'], ['erevane', 'Vesper Ísk', 'Vesper Ísk. O que é seu já é nosso.'],
  ['quorith', 'Zayin Coral', 'Zayin Coral. O Coro escuta.'], ['vorag', 'Oru Voraz', 'Oru Voraz. Fome.']];
/* aparelhos derivados dos conjuntos (cópias; o conjuntos.cjs não muda) */
const porId = id => SETS.find(s => s.id === id); const copia = (s, o) => Object.assign(JSON.parse(JSON.stringify(s)), o);
const edge = porId('edge'), iph = porId('iphone-aprimorada'), chrome = porId('chrome-win'), ffx = porId('firefox-win'), iphb = porId('iphone');
const lu = iph.vozes.find(v => /^Luciana \(Aprimorada\)$/.test(v.name)); const fe = Object.assign({}, lu, { name: 'Felipe (Aprimorado)', voiceURI: lu.voiceURI.replace('Luciana', 'Felipe'), default: false });
const EXTRA = [
  copia(edge, { id: 'windows-antigo', nome: 'Windows antigo (só as vozes locais)', atraso: 0, parcial: false, vozes: edge.vozes.filter(v => v.localService !== false) }),
  copia(iph, { id: 'iphone-dois-aprimorados', nome: 'iPhone com Luciana e Felipe aprimorados', vozes: iph.vozes.concat([fe]).sort((a, b) => a.name.localeCompare(b.name, 'pt')) }),
  copia(chrome, { id: 'chrome-sem-rede', nome: 'Chrome no Windows 11, sem internet', atraso: 0, falha: 'Google' }),
  /* 5.0b.1 */
  copia(ffx, { id: 'firefox-win-daniel', nome: 'Firefox no Windows 11, com Maria e Daniel', vozes: ffx.vozes.concat([Object.assign({}, ffx.vozes[0], { name: 'Microsoft Daniel Desktop - Portuguese(Brazil)', voiceURI: 'urn:moz-tts:sapi:Microsoft Daniel Desktop - Portuguese(Brazil)?pt-BR', default: false })]) }),
  copia(iphb, { id: 'iphone-sem-felipe', nome: 'iPhone sem o Felipe (homens só robóticos)', vozes: iphb.vozes.filter(v => !/^Felipe$/.test(v.name)) }),
  { id: 'android', nome: 'Chrome no Android', ua: 'Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36', atraso: 200,
    vozes: [['English United States', 'en-US', true], ['português Brasil', 'pt-BR'], ['português Portugal', 'pt-PT'], ['español España', 'es-ES']].map(([name, lang, d]) => ({ name, lang, voiceURI: name, localService: true, default: !!d })) }];
/* o que cada aparelho tem de fazer: voz da Sylvia, voz dos outros quatro e do locutor (null = sem voz em português: só a legenda) */
const ESPERA = { edge: [/Francisca/, /Antonio/, /Francisca/], 'edge-sem-rede': [/^Microsoft Maria\b/, /^Microsoft Daniel\b/, /^Microsoft Maria\b/], 'chrome-win': [/^Google português do Brasil$/, /^Microsoft Daniel\b/, /^Google português do Brasil$/] /* 5.0b.1: antes, a Google para todos */,
  'firefox-win': [/Maria Desktop/, /Maria Desktop/, /Maria Desktop/], iphone: [/^Luciana$/, /^Felipe$/, /^Luciana$/], 'iphone-aprimorada': [/^Luciana \(Aprimorada\)$/, /^Felipe$/, /^Luciana \(Aprimorada\)$/] /* 5.0b.1: antes, a Luciana Aprimorada para todos */,
  'sem-voz': [null, null, null], 'windows-antigo': [/^Microsoft Maria\b/, /^Microsoft Daniel\b/, /^Microsoft Maria\b/], 'iphone-dois-aprimorados': [/^Luciana \(Aprimorada\)$/, /^Felipe \(Aprimorado\)$/, /^Luciana \(Aprimorada\)$/],
  'chrome-sem-rede': [/^Microsoft Maria\b/, /^Microsoft Daniel\b/, /^Microsoft Maria\b/],
  'firefox-win-daniel': [/Maria Desktop/, /Daniel Desktop/, /Maria Desktop/], 'iphone-sem-felipe': [/^Luciana$/, /^Luciana$/, /^Luciana$/], android: [/^português Brasil$/, /^português Brasil$/, /^português Brasil$/] }; /* 5.0b.1 */
const curto = n => n == null ? '—' : String(n).replace(/^Microsoft\s+/, '').replace(/\s*Online \(Natural\) - Portuguese \(Brazil\)/, ' (neural)').replace(/ - Portuguese \(Brazil\)/, '').replace(/ - Portuguese\(Brazil\)/, '');

/* um "navegador" no Node: window com eventos, localStorage em memória, a imitação de fala do conjunto e o src/audio.js */
function mundo(set, antes) { const ev = {}, ls = new Map();
  const ctx = { console, setTimeout, clearTimeout, setInterval, clearInterval, performance, navigator: { userAgent: set.ua, maxTouchPoints: /iPhone/.test(set.ua) ? 5 : 0 },
    localStorage: { getItem: k => (ls.has(k) ? ls.get(k) : null), setItem: (k, v) => ls.set(k, String(v)), removeItem: k => ls.delete(k) },
    addEventListener: (k, f) => (ev[k] = ev[k] || []).push(f), removeEventListener: (k, f) => { ev[k] = (ev[k] || []).filter(x => x !== f); }, dispatchEvent: e => { for (const f of (ev[e.type] || []).slice()) f(e); return true; },
    CustomEvent: class { constructor(type, o) { this.type = type; this.detail = o && o.detail; } } };
  ctx.window = ctx; vm.createContext(ctx); vm.runInContext('(' + fake.toString() + ')(' + JSON.stringify(set) + ')', ctx); if (antes) antes(ctx); /* 5.0c.1: o tocador de imitação */
  vm.runInContext(fs.readFileSync(path.join(root, 'src/audio.js'), 'utf8'), ctx, { filename: 'src/audio.js' }); return ctx; }
/* uma fala até o fim (a voz online sem rede falha e repete na local): devolve a voz da última tentativa, os eventos e as legendas */
async function falar(ctx, texto, chave) { const F = ctx.__fala, A = ctx.ARD.audio; F.log.length = 0; F.ev.length = 0; const caps = []; A.onSay = (t, k) => caps.push(k);
  const aceita = A.say(texto, chave, 0); const t0 = Date.now(); let quieto = 0;
  while (Date.now() - t0 < 6000) { await espera(25); if (!ctx.speechSynthesis.speaking && !ctx.speechSynthesis.pending) { if ((quieto += 25) >= 150) break; } else quieto = 0; }
  const u = F.log[F.log.length - 1] || null; return { aceita, voz: u ? u.voz : null, tentativas: F.log.length, eventos: F.ev.join(','), legendas: caps, pitch: u && u.pitch }; }
async function aparelho(set) { const ctx = mundo(set); await espera((set.atraso || 0) + 150); const A = ctx.ARD.audio; const r = { id: set.id, nome: set.nome, lideres: {}, erros: [] };
  for (const [raca, nome, texto] of LIDERES) { const f = await falar(ctx, texto, 'sala-' + raca); r.lideres[nome] = f; }
  r.locutor = await falar(ctx, 'Construção concluída', 'built'); r.alerta = await falar(ctx, 'Base sob ataque', 'Base sob ataque'); /* rotina e perigo: os dois com a Automática */
  A.raca = 'vorag'; r.locVorag = await falar(ctx, 'Base sob ataque', 'Base sob ataque'); A.raca = 'erevane'; r.locErevane = await falar(ctx, 'Tempestade de Éter', 'Tempestade de Éter'); A.raca = null; /* 5.0c: na partida, o locutor no gênero do elenco da Raça (Vorag: homem; Erevane: mulher) */
  const vs = A.vozes(); const outra = set.falha || set.pularEscolha ? null : vs.find(x => x.br && x.nivel > 0 && x.id !== (A.vozAtual() || {}).id && /Antonio|Daniel|Felipe/.test(x.rotulo)) || null; /* sem rede a voz online escolhida falha: lá só a Automática */
  if (outra) { A.setVoz(outra.id); r.escolhida = { alvo: outra.rotulo, sylvia: (await falar(ctx, LIDERES[0][2], 'sala-tessara')).voz, locutor: (await falar(ctx, 'Base sob ataque', 'Base sob ataque')).voz }; A.setVoz(''); r.voltou = (await falar(ctx, LIDERES[0][2], 'sala-tessara')).voz; }
  r.erros = ctx.__fala.erros.slice(0, 3); return r; }
/* 5.0c.1: tocador de imitação (o contrato do src/vozes.js que o audio.js usa) */
function tocadorFalso(ios, pronta) { const T = { achou: [], tocou: [], pediu: 0 }; return { T, V: { ESPERA_SALA: 0, disponivel: () => true, semFalaSistema: () => ios, semPreparo: () => ios, pedir: () => { T.pediu++; }, depoisDaSala() {},
  achar: (ch, raca) => { T.achou.push([ch, raca]); return { itens: [{ id: raca + '-sala-1' }], texto: 'Fala gravada de ' + raca + '.', dur: 1, pronta, chave: ch, pacote: raca }; },
  tocar: (g, cb) => { T.tocou.push(g.pacote); setTimeout(() => { cb.inicio(); cb.palavra(0, 4, 0.3); cb.palavra(5, 7, 0.3); setTimeout(() => cb.fim(), 30); }, 5); return { parar() {} }; } } }; }
async function gravadas(set) { const e = ESPERA[set.id], ios = /iPhone/.test(set.ua), out = { id: set.id, falhas: [] };
  for (const pronta of [true, false]) { const tf = tocadorFalso(ios, pronta); const ctx = mundo(set, c => { c.ARD = { vozes: tf.V }; }); await espera((set.atraso || 0) + 150);
    for (const [raca, nome, texto] of LIDERES) { tf.T.tocou.length = 0; tf.T.achou.length = 0; const f = await falar(ctx, texto, 'sala-' + raca); const ach = tf.T.achou[0] || [];
      if (ach[1] !== raca) out.falhas.push(nome + ': pacote ' + ach[1]); if (!f.aceita || f.legendas.length !== 1) out.falhas.push(nome + ': legenda');
      if (pronta) { if (tf.T.tocou[0] !== raca || f.voz) out.falhas.push(nome + ': gravada (' + tf.T.tocou.join() + ') e voz do sistema ' + curto(f.voz)); if (!/inicio,palavra,palavra,fim/.test(f.eventos + '') && !/^$/.test(f.eventos)) out.falhas.push(nome + ': ard-voz ' + f.eventos); }
      else if (ios) { if (f.voz || tf.T.tocou.length) out.falhas.push(nome + ': no iPhone, sem arquivo, só legenda (voz ' + curto(f.voz) + ')'); }
      else { const re = nome === 'Sylvia Oriel' ? e[0] : e[1]; if (!(re === null ? f.voz === null : !!(f.voz && re.test(f.voz)))) out.falhas.push(nome + ': sem arquivo, voz do sistema ' + curto(f.voz)); } }
    if (!pronta && !tf.T.pediu) out.falhas.push('arquivo não pedido'); }
  out.ok = !out.falhas.length; return out; }
function confere(r) { const e = ESPERA[r.id]; if (!e) return { ok: false, porque: 'sem expectativa' };
  const casa = (re, voz) => re === null ? voz === null : !!(voz && re.test(voz)); const falhas = [];
  for (const [nome, f] of Object.entries(r.lideres)) { const re = nome === 'Sylvia Oriel' ? e[0] : e[1]; if (!casa(re, f.voz)) falhas.push(nome + ': ' + curto(f.voz)); if (!f.aceita || f.legendas.length !== 1 || f.legendas[0] !== 'sala-' + LIDERES.find(l => l[1] === nome)[0]) falhas.push(nome + ': legenda'); if (re && !/^(fim,)?inicio(,palavra)+,fim$/.test(f.eventos.replace(/^(fim,)+/, 'fim,'))) falhas.push(nome + ': ard-voz ' + f.eventos); if (re && f.pitch !== 1) falhas.push(nome + ': tom'); }
  for (const k of ['locutor', 'alerta']) if (!casa(e[2], r[k].voz)) falhas.push(k + ': ' + curto(r[k].voz));
  if (!casa(e[1], r.locVorag.voz)) falhas.push('locutor do Vorag: ' + curto(r.locVorag.voz)); if (!casa(e[0], r.locErevane.voz)) falhas.push('locutora da Erevane: ' + curto(r.locErevane.voz)); /* 5.0c */
  if (r.escolhida) { const alvo = r.escolhida.alvo.split(' · ')[0]; if (!(r.escolhida.sylvia && r.escolhida.sylvia.includes(alvo)) || !(r.escolhida.locutor && r.escolhida.locutor.includes(alvo))) falhas.push('voz de Ajustes: ' + curto(r.escolhida.sylvia) + ' / ' + curto(r.escolhida.locutor)); if (!casa(e[0], r.voltou)) falhas.push('voltar à Automática: ' + curto(r.voltou)); }
  if (r.erros.length) falhas.push('erros: ' + r.erros.join(' | ')); return { ok: !falhas.length, falhas }; }

async function navegador(rs) { /* a mesma regra na página do jogo (Chromium), com as vozes do Edge e do iPhone imitadas */
  const pw = require('playwright'); const b = await pw.chromium.launch({ headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--allow-file-access-from-files', '--disable-dev-shm-usage'] }); const out = {};
  for (const id of ['edge', 'chrome-win', 'iphone-dois-aprimorados']) { /* 5.0b.1: + Chrome do Windows */ const set = SETS.concat(EXTRA).find(s => s.id === id); const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, userAgent: set.ua, locale: 'pt-BR' /* 5.0c: o jogo abre no idioma do navegador */ }); await ctx.addInitScript(`(${fake.toString()})(${JSON.stringify(set)})`);
    const p = await ctx.newPage(); p.setDefaultTimeout(180000); const errs = []; p.on('pageerror', e => errs.push(e.message)); await p.goto('file://' + root + '/dist/local.html?fundo=classico', { waitUntil: 'load' }); await p.waitForFunction(() => window.ARD && ARD.audio); await espera((set.atraso || 0) + 900);
    const r = await p.evaluate(async L => { const F = __fala, A = ARD.audio, res = {}; for (const [raca, nome, texto] of L) { F.log.length = 0; A.say(texto, 'sala-' + raca, 0); await new Promise(x => setTimeout(x, 120 + texto.length * 14)); res[nome] = (F.log[F.log.length - 1] || {}).voz || null; } F.log.length = 0; A.say('Construção concluída', 'built', 0); await new Promise(x => setTimeout(x, 400)); res.locutor = (F.log[0] || {}).voz || null; return res; }, LIDERES);
    out[id] = { vozes: r, erros: errs.slice(0, 3) }; await ctx.close(); }
  await b.close(); return out; }

(async () => { const t0 = Date.now(); const rs = []; for (const set of SETS.concat(EXTRA)) rs.push(await aparelho(set));
  const linhas = rs.map(r => { const c = confere(r); r.ok = c.ok; r.falhas = c.falhas; const m = Object.entries(r.lideres).filter(([n]) => n !== 'Sylvia Oriel').map(([, f]) => curto(f.voz)); const mm = [...new Set(m)].join(' / ');
    return `${(c.ok ? 'ok ' : 'FALHOU ')}${r.nome.padEnd(42)} Sylvia: ${curto(r.lideres['Sylvia Oriel'].voz).padEnd(30)} outros: ${mm.padEnd(30)} locutor: ${curto(r.locutor.voz).padEnd(28)}${r.escolhida ? ' Ajustes "' + r.escolhida.alvo.split(' · ')[0] + '": todas' : ''}${c.ok ? '' : '  ← ' + c.falhas.join('; ')}`; });
  console.log(linhas.join('\n'));
  let nav = null; if (process.argv.includes('--navegador')) { nav = await navegador(rs); for (const [id, v] of Object.entries(nav)) { const e = ESPERA[id]; v.ok = !v.erros.length && e[0].test(v.vozes['Sylvia Oriel'] || '') && LIDERES.slice(1).every(([, n]) => e[1].test(v.vozes[n] || '')) && e[2].test(v.vozes.locutor || ''); console.log(`${v.ok ? 'ok' : 'FALHOU'} página do jogo (${id}): Sylvia ${curto(v.vozes['Sylvia Oriel'])}, outros ${curto(v.vozes['Barão-Forja'])}, locutor ${curto(v.vozes.locutor)}${v.erros.length ? ' · erros: ' + v.erros.join(' | ') : ''}`); } }
  const gv = []; for (const id of ['edge', 'chrome-win', 'iphone-aprimorada', 'firefox-win-daniel', 'sem-voz']) { const set = SETS.concat(EXTRA).find(s => s.id === id); if (!set) continue; const g = await gravadas(set); gv.push(g); console.log(`${g.ok ? 'ok ' : 'FALHOU '} vozes gravadas (${set.nome}): com a fala pronta, a gravada da Raça; sem ela, ${/iPhone/.test(set.ua) ? 'só a legenda' : 'a voz do sistema no gênero do líder'}${g.ok ? '' : '  ← ' + g.falhas.slice(0, 4).join('; ')}`); } /* 5.0c.1 */
  const ok = rs.filter(r => r.ok).length, navOk = (!nav || Object.values(nav).every(v => v.ok)) && gv.every(g => g.ok);
  fs.mkdirSync(path.join(root, 'work'), { recursive: true }); fs.writeFileSync(path.join(root, 'work/genero-teste.json'), JSON.stringify({ quando: new Date().toISOString(), aparelhos: rs, navegador: nav, gravadas: gv /* 5.0c.1 */ }, null, 2));
  console.log(`voz por gênero: ${ok}/${rs.length} aparelhos ok${nav ? ' · página do jogo ' + Object.values(nav).filter(v => v.ok).length + '/' + Object.keys(nav).length : ''} · vozes gravadas ${gv.filter(g => g.ok).length}/${gv.length} (${((Date.now() - t0) / 1000).toFixed(1)} s)`); process.exit(ok === rs.length && navOk ? 0 : 1);
})();
