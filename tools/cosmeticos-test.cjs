// 5.5a — teste do catálogo de cosméticos (src/cosmeticos.js). Roda no Node, sem navegador. Confere: o formato de cada item; o padrão grátis de
// cada tipo; como se ganha (grátis, conquista, apoiador) contra um progresso de teste; id desconhecido, repetido, malformado ou de outra Raça cai
// no padrão; nada de preço, loja ou moeda nos dados nem nos textos; os textos existem nos três idiomas; e a REGRA DURA: o mesmo jogo, com e sem
// cosméticos (qualquer combinação do catálogo, inclusive ids inventados), dá o mesmo hash da simulação tique a tique, e src/sim.js e src/ai.js
// não leem o catálogo. Uso: node tools/cosmeticos-test.cjs [--json]   (a última linha com --json é o resultado)
const path = require('path'), fs = require('fs'), vm = require('vm'); const root = path.resolve(__dirname, '..');
globalThis.ARD = {}; for (const f of ['modos.js', 'chefes-sim.js', 'mundo.js', 'unicas-sim.js', 'sim.js', 'ai.js', 'progress.js', 'campaign.js', 'cosmeticos.js']) require(path.join(root, 'src', f));
const A = globalThis.ARD, C = A.cosmeticos, S = A.sim, AI = A.ai, P = A.progress; const falhas = []; let n = 0; const ok = (c, m) => { n++; if (!c) falhas.push(m); };
// 1) formato
const ids = new Set(); const CAMPOS = new Set(['id', 'tipo', 'raca', 'ganha', 'conquista', 'nivel', 'skin', 'cor', 'pronto', 'nome', 'afinidade', 'sequencia' /* 5.5b.2 */]); const RACAS = Object.keys(S.FACTIONS);
for (const it of C.CATALOGO) { ok(/^[a-z0-9-]{1,32}$/.test(it.id), 'id fora do formato: ' + it.id); ok(!ids.has(it.id), 'id repetido: ' + it.id); ids.add(it.id); ok(C.TIPOS.includes(it.tipo), it.id + ': tipo desconhecido'); ok(C.GANHA.includes(it.ganha), it.id + ': ganha desconhecido');
  ok(it.raca === null || RACAS.includes(it.raca), it.id + ': Raça desconhecida'); ok(Object.keys(it).every(k => CAMPOS.has(k)), it.id + ': campo fora do formato (' + Object.keys(it).filter(k => !CAMPOS.has(k)) + ')');
  if (it.ganha === 'conquista') ok((it.conquista && A.campaign.ACHIEVEMENTS.some(a => a.id === it.conquista)) || (it.nivel >= 2 && it.nivel <= P.MAX_LEVEL) || (it.afinidade >= 1 && it.afinidade <= 5 && RACAS.includes(it.raca)) || [3, 7, 14, 30].includes(it.sequencia) /* 5.5b.2: afinidade com a Raça e marco de sequência */, it.id + ': conquista ou nível inexistente'); else ok(!it.conquista && !it.nivel && !it.afinidade && !it.sequencia, it.id + ': condição em item que não é de conquista');
  ok(typeof it.nome === 'string' && it.nome, it.id + ': sem nome'); }
for (const t of C.TIPOS) { ok(C.PADRAO[t] && C.PADRAO[t].ganha === 'gratis', 'tipo sem padrão grátis: ' + t); ok(C.CATALOGO.some(it => it.tipo === t && it.ganha !== 'gratis'), 'tipo sem item para ganhar: ' + t); }
const porConquista = C.CATALOGO.filter(it => it.ganha === 'conquista').length; ok(porConquista >= 3, 'menos de 3 itens por conquista');
// 2) nada de preço, loja ou moeda (dados e textos)
const DIC = (() => { const ctx = { globalThis: null }; ctx.globalThis = ctx; vm.createContext(ctx); for (const l of ['pt-BR', 'en', 'es']) vm.runInContext(fs.readFileSync(path.join(root, 'src/i18n', l + '.js'), 'utf8'), ctx); return ctx.ARD.I18N_DIC; })();
const PROIBIDO = /pre[çc]o|price|precio|R\$|US\$|\$\s?\d|\bloja\b|\bstore\b|\bshop\b|tienda|moeda|coin|moneda|comprar|\bbuy\b|gem|cr[eé]dito/i;
ok(!PROIBIDO.test(JSON.stringify(C.CATALOGO)), 'dados com preço, loja ou moeda');
for (const l of ['pt-BR', 'en', 'es']) { const d = DIC[l]; for (const it of C.CATALOGO) ok(typeof d['cosm.item.' + it.id] === 'string', l + ': falta o nome de ' + it.id); for (const t of C.TIPOS) ok(typeof d['cosm.tipo.' + t] === 'string', l + ': falta o tipo ' + t);
  for (const k in d) if (k.startsWith('cosm.')) ok(!PROIBIDO.test(d[k]), l + ': texto com preço, loja ou moeda em ' + k); }
// 3) como se ganha
P.reset(); ok(C.tem('pin-padrao') && C.tem('mol-padrao'), 'grátis não liberado'); ok(!C.tem('mol-alinhamento') && !C.tem('pin-fortaleza') && !C.tem('cor-veterano'), 'conquista liberada sem a conquista');
ok(!C.tem('mol-apoiador') && !C.tem('tit-apoiador'), 'item de apoiador liberado (Etapa 0: ninguém tem)'); ok(!C.tem('est-apoiador'), 'item sem arte liberado'); ok(!C.tem('nao-existe') && !C.tem(null) && !C.tem({}), 'id inválido liberado');
P.unlock('primeiro-passo'); ok(C.tem('mol-alinhamento') && C.tem('tit-recruta'), 'conquista não liberou'); ok(!C.tem('mol-cinco-mundos'), 'liberou a conquista errada');
P.addXp(P.LEVEL_XP(9) + 1); ok(P.load().commander.level >= 10 && C.tem('pin-fortaleza') && !C.tem('pin-santuario'), 'nível 10 não liberou a Fortaleza (ou liberou o Santuário)');
ok(C.equipa('moldura', 'mol-alinhamento') && C.equipa('titulo', 'tit-recruta'), 'não equipou o que tem'); ok(!C.equipa('moldura', 'mol-apoiador') && !C.equipa('moldura', 'tit-recruta') && !C.equipa('moldura', 'x'), 'equipou o que não tem ou de outro tipo');
P.setHangar({ skin: { vehnar: 1 } }); const an = C.anuncia('vehnar'); ok(an.includes('pin-fortaleza') && an.includes('mol-alinhamento') && an.includes('tit-recruta') && an.length <= C.MAX, 'anúncio errado: ' + an);
P.setHangar({ skin: { erevane: 2 } }); ok(!C.anuncia('erevane').includes('pin-santuario'), 'anunciou pintura que não tem');
// 4) o que chega de fora: desconhecido, repetido, malformado, de outra Raça → padrão
const pad = t => C.PADRAO[t].id; const L = (x, r) => Object.fromEntries(Object.entries(C.limpa(x, r)).map(([t, it]) => [t, it.id]));
for (const ruim of [null, undefined, 'mol-apoiador', 42, {}, [], [null, 5, {}, ['mol-apoiador']], ['nao-existe', '<img src=x onerror=alert(1)>', 'MOL-APOIADOR', '../../x', 'a'.repeat(200)], ['est-apoiador', 'ras-apoiador']]) { const r = L(ruim, 'vehnar'); ok(C.TIPOS.every(t => r[t] === pad(t)), 'entrada ruim não caiu no padrão: ' + String(JSON.stringify(ruim)).slice(0, 60)); }
{ const r = L(['mol-apoiador', 'mol-alinhamento', 'tit-palavra-dada', 'xx', 'cor-veterano', 'pin-santuario'], 'quorith'); ok(r.moldura === 'mol-apoiador' && r.titulo === 'tit-palavra-dada' && r['cor-nome'] === 'cor-veterano' && r.pintura === 'pin-santuario' && r.rastro === pad('rastro'), 'lista boa mal lida: ' + JSON.stringify(r)); }
{ const muitos = []; for (let i = 0; i < 50; i++) muitos.push('lixo-' + i); muitos.push('mol-apoiador'); ok(L(muitos, 'vehnar').moldura === pad('moldura') && C.forma(muitos).length === C.MAX, 'lista longa não foi cortada'); }
{ C.CATALOGO.push({ id: 'zz-so-vorag', tipo: 'moldura', raca: 'vorag', ganha: 'gratis', nome: 'teste' }); /* item de teste só de uma Raça (o catálogo ainda não tem nenhum): não entra no índice, então cai no padrão */ ok(L(['zz-so-vorag'], 'vehnar').moldura === pad('moldura'), 'item fora do índice aceito'); C.CATALOGO.pop(); ok(C.serve({ raca: 'vorag' }, 'vorag') && !C.serve({ raca: 'vorag' }, 'vehnar') && C.serve({ raca: null }, 'vehnar'), 'filtro de Raça errado'); }
ok(C.skinDe(['pin-santuario'], 'vehnar') === 2 && C.skinDe(['pin-xx'], 'vehnar') === 0 && C.skinDe(null, 'vehnar') === 0, 'pintura → estilo do Núcleo errado');
// 5) REGRA DURA: cosmético não entra na simulação
const fontes = ['sim.js', 'ai.js', 'modos.js', 'chefes-sim.js', 'mundo.js', 'unicas-sim.js'].map(f => fs.readFileSync(path.join(root, 'src', f), 'utf8')).join('\n'); ok(!/cosmetic|\bcosm\b|ARD\.progress|localStorage/i.test(fontes), 'a simulação ou a IA citam cosméticos');
const joga = (cosm, seed) => { const pl = [{ name: 'a', faction: 'vehnar', difficulty: 'normal' }, { name: 'b', faction: 'vorag', difficulty: 'normal' }]; if (cosm) pl.forEach((p, i) => { p.cosm = cosm[i]; }); const sim = S.createSim({ seed, players: pl, minutes: 20, mapV: 1 }); if (cosm) sim.cfg.cosm = cosm; const ais = sim.players.filter(p => !p.fenda).map(p => AI.create(p.id, p.difficulty)); const hs = [];
  for (let i = 0; i < 3000 && !sim.result; i++) { if (sim.tick % 10 === 0) for (const ai of ais) for (const c of AI.think(sim, ai)) S.enqueue(sim, c); S.step(sim); if (sim.tick % 500 === 0) hs.push(S.hash(sim)); } return hs.join(','); };
const todos = C.CATALOGO.map(it => it.id); const combos = [[todos, todos], [['pin-santuario', 'mol-apoiador', 'tit-apoiador', 'cor-apoiador'], ['nao-existe', '<x>']], [[], ['pin-fortaleza']]]; const hashes = {};
for (const seed of [42, 1037]) { const base = joga(null, seed); hashes[seed] = base.split(',').pop(); combos.forEach((c, i) => ok(joga(c, seed) === base, 'hash mudou com cosméticos (semente ' + seed + ', combinação ' + i + ')')); }
const out = { ok: !falhas.length, verificacoes: n, falhas, itens: C.CATALOGO.length, porTipo: Object.fromEntries(C.TIPOS.map(t => [t, C.CATALOGO.filter(it => it.tipo === t).length])), porConquista, hashes };
if (process.argv.includes('--json')) console.log(JSON.stringify(out)); else console.log('cosméticos: ' + (out.ok ? 'ok' : 'FALHOU') + ' · ' + (n - falhas.length) + '/' + n + ' verificações · ' + out.itens + ' itens · ' + porConquista + ' por conquista' + (falhas.length ? '\n  ' + falhas.join('\n  ') : ''));
process.exit(out.ok ? 0 : 1);
