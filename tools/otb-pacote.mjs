/* 5.5b.4: junta os modelos feitos no Blender (.otb) no pacote de uma Raça e atualiza a tabela que o jogo lê.
   Uso: node tools/otb-pacote.mjs <raça> <a.otb> [b.otb ...] [--mapa extra.json] [--completa] [--saida=<pasta>]
   (--saida=tools/fixtures/modelos grava o pacote e a tabela de teste, que o tools/otb-test.cjs usa, sem tocar em assets/modelos/)
   - cada entrada é um .otb de um modelo ou um pacote já montado (vários modelos); se dois trazem o mesmo nome, vale o último;
   - grava assets/modelos/<raça>.otb.gz (gzip 9) e a entrada da Raça em assets/modelos/tabela.json: arquivo, hash (muda quando o pacote muda: é o ?v= do
     pedido), bytes (gzip e cru) e o mapa id do jogo -> receita;
   - o mapa sai dos nomes: otb_<raça>_<id> (ou otb_<id>, os nomes do piloto) vira a peça <id>; otb_<raça>_<id>_s<n> vira a pele n da peça (o Núcleo);
     nome que não é peça da Raça fica no pacote e fora do mapa (aviso). --mapa extra.json ({ id: receita ou { r, s, mt, beam, base } }) acrescenta ou corrige;
   - a base de uma parte que gira (torre_base, bastiao_base, veiculo_hull) precisa da altura do assento: se o modelo não traz "mt" no cabeçalho, a tabela
     guarda a altura do modelo de hoje; o mesmo para o emissor do feixe do coletor ("beam");
   - lista as peças da Raça que ficaram sem modelo novo (seguem com o de hoje); com --completa, faltar peça é erro (saída 1) e nada é gravado.
   Depois: node tools/build.mjs (põe a tabela no jogo e embute os pacotes na versão de arquivo único) e node tools/otb-test.cjs. */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
const root = new URL('..', import.meta.url).pathname; const args = process.argv.slice(2); const completa = args.includes('--completa'); let extra = null;
{ const i = args.indexOf('--mapa'); if (i >= 0) { extra = JSON.parse(readFileSync(args[i + 1], 'utf8')); args.splice(i, 2); } }
let SAIDA = 'assets/modelos/'; { const i = args.findIndex(a => a.startsWith('--saida=')); if (i >= 0) { SAIDA = args[i].slice(8).replace(/\/?$/, '/'); args.splice(i, 1); } } /* --saida=tools/fixtures/modelos: grava o pacote e a tabela em outra pasta (dado de teste), sem tocar no jogo */
const [race, ...arqs] = args.filter(a => a !== '--completa'); if (!race || !arqs.length) { console.error('uso: node tools/otb-pacote.mjs <raça> <a.otb> [b.otb ...] [--mapa extra.json] [--completa]'); process.exit(2); }
/* as peças da Raça e as medidas de hoje (o construtor do jogo, no Node) */
const THREE = await import(root + 'dist/vendor/three/build/three.module.min.js').catch(() => null); if (!THREE) { console.error('falta dist/vendor: rode node tools/vendor.mjs'); process.exit(2); }
globalThis.THREE = THREE; globalThis.ARD = {}; for (const f of ['src/modos.js', 'src/chefes-sim.js', 'src/mundo.js', 'src/unicas-sim.js', 'src/sim.js', 'src/meshes.js']) (0, eval)(readFileSync(root + f, 'utf8'));
const M = ARD.meshes, S = ARD.sim; if (!M.PAL[race]) { console.error('Raça desconhecida: ' + race); process.exit(2); }
const pecas = []; const poe = d => { for (const x of M.FULL[d] || [d]) if (!pecas.includes(x)) pecas.push(x); }; M.BUILDING_DEFS.forEach(poe); M.unitsOf(race).forEach(poe); for (const d in S.UNITS) if (S.UNITS[d].faction === race) poe(d);
/* lê as entradas */
const modelos = {}; const partes = []; let tam = 0;
for (const a of arqs) { const b = readFileSync(a); if (b.length < 8 || b.toString('latin1', 0, 4) !== 'OTB1') { console.error(a + ': não é um .otb'); process.exit(2); } const n = b.readUInt32LE(4), cab = JSON.parse(b.subarray(8, 8 + n).toString('utf8')), bin = b.subarray(8 + n); if (cab.v !== 2) { console.error(a + ': versão ' + cab.v + ' não suportada'); process.exit(2); }
  for (const nome in cab.modelos) { const m = cab.modelos[nome]; const pedaco = m.o != null ? bin.subarray(m.o, m.o + m.nb) : bin; if (modelos[nome]) console.log('aviso: ' + nome + ' veio duas vezes; vale o de ' + a); modelos[nome] = { m, pedaco, de: a }; } }
for (const nome in modelos) { const x = modelos[nome]; x.m.o = tam; x.m.nb = x.pedaco.length; partes.push(x.pedaco); tam += x.pedaco.length; }
const cabJ = {}; for (const nome in modelos) cabJ[nome] = modelos[nome].m; let js = Buffer.from(JSON.stringify({ v: 2, modelos: cabJ }), 'utf8'); js = Buffer.concat([js, Buffer.alloc((4 - js.length % 4) % 4, 32)]);
const h = Buffer.alloc(8); h.write('OTB1', 0, 'latin1'); h.writeUInt32LE(js.length, 4); const pac = Buffer.concat([h, js, ...partes]); const gz = gzipSync(pac, { level: 9 });
/* o mapa */
const mapa = {}; const fora = []; const esc = race.replace(/[^a-z0-9]/g, '');
for (const nome in modelos) { let id = null, pele = null; const k = nome.startsWith('otb_' + esc + '_') ? nome.slice(5 + esc.length) : nome.startsWith('otb_') ? nome.slice(4) : null;
  if (k && pecas.includes(k)) id = k; else if (k) { const mm = k.match(/^(.+)_s(\d+)$/); if (mm && pecas.includes(mm[1])) { id = mm[1]; pele = +mm[2]; } }
  if (!id) { fora.push(nome); continue; } const e = mapa[id] = mapa[id] || {}; if (pele == null) e.r = nome; else (e.s = e.s || {})[pele] = nome; }
for (const id in mapa) { const e = mapa[id]; if (!e.r) { e.r = e.s[Object.keys(e.s)[0]]; } const m = modelos[e.r].m, hoje = M.build(id, race, '#FFFFFF', 0);
  if (hoje && hoje.mount != null && m.mt == null) e.mt = +hoje.mount.toFixed(3); if (hoje && hoje.beam && !m.beam) e.beam = hoje.beam.map(v => +v.toFixed(3)); }
for (const id in extra || {}) { const x = extra[id]; mapa[id] = typeof x === 'string' ? Object.assign(mapa[id] || {}, { r: x }) : Object.assign(mapa[id] || {}, x); }
for (const id in mapa) { const e = mapa[id]; if (!modelos[e.r]) { console.error('o mapa aponta ' + id + ' para ' + e.r + ', que não está no pacote'); process.exit(1); } if (Object.keys(e).length === 1) mapa[id] = e.r; }
const faltam = pecas.filter(p => !mapa[p]);
console.log('pacote ' + race + ': ' + Object.keys(modelos).length + ' modelos · cru ' + (pac.length / 1024).toFixed(1) + ' KB · gzip ' + (gz.length / 1024).toFixed(1) + ' KB');
console.log('peças com modelo novo (' + Object.keys(mapa).length + ' de ' + pecas.length + '): ' + Object.keys(mapa).join(', '));
if (fora.length) console.log('aviso: no pacote e fora do mapa (o nome não é peça de ' + race + '): ' + fora.join(', '));
if (faltam.length) console.log((completa ? 'ERRO' : 'aviso') + ': seguem com o modelo de hoje (' + faltam.length + '): ' + faltam.join(', '));
if (completa && faltam.length) process.exit(1);
mkdirSync(root + SAIDA, { recursive: true }); const arquivo = race + '.otb.gz'; writeFileSync(root + SAIDA + arquivo, gz);
const ft = root + SAIDA + 'tabela.json'; const tab = existsSync(ft) ? JSON.parse(readFileSync(ft, 'utf8')) : { v: 1, racas: {} };
tab.racas[race] = { arquivo, hash: createHash('sha256').update(gz).digest('hex').slice(0, 10), gzip: gz.length, cru: pac.length, completa: !faltam.length, mapa };
writeFileSync(ft, JSON.stringify(tab, null, 1) + '\n'); console.log('gravado: ' + SAIDA + arquivo + ' e ' + SAIDA + 'tabela.json');
