// 5.0c.1: utilidades das vozes gravadas para as ferramentas (Node): duração de um arquivo de áudio sem decodificar (Ogg Opus pelo granule da última
// página; MP3 e M4A por estimativa) e a conferência de um manifesto (assets/vozes/<idioma>/manifesto.json) contra as chaves que o jogo usa.
const fs = require('fs'), path = require('path'), vm = require('vm');
/* Ogg Opus: (granule da última página − pre-skip do OpusHead) / 48000 */
function duracaoOgg(buf) { if (buf.length < 64 || buf.toString('latin1', 0, 4) !== 'OggS') return null; let pre = 0; const h = buf.indexOf('OpusHead', 0, 'latin1'); if (h >= 0) pre = buf.readUInt16LE(h + 10);
  let g = -1; for (let i = buf.length - 27; i >= 0; i--) { if (buf[i] === 0x4f && buf.toString('latin1', i, i + 4) === 'OggS') { g = Number(buf.readBigInt64LE(i + 6)); if (g >= 0) break; } }
  return g < 0 ? null : Math.max(0, (g - pre) / 48000); }
function duracao(arq) { const b = fs.readFileSync(arq); if (/\.ogg$|\.opus$/i.test(arq)) return duracaoOgg(b); return null; }
/* o código do jogo num contexto do Node: src/sim.js, src/campaign.js e src/vozes.js (as chaves e a numeração da campanha saem do mesmo código da página) */
let CTX = null; function jogo(root) { if (CTX && CTX.root === root) return CTX.ARD; const ctx = { console, setTimeout, clearTimeout, setInterval, clearInterval, URLSearchParams, location: { search: '', protocol: 'file:', href: 'file:///' } }; ctx.globalThis = ctx; ctx.window = ctx; vm.createContext(ctx);
  for (const f of ['src/sim.js', 'src/campaign.js', 'src/vozes.js']) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx); CTX = { root, ARD: ctx.ARD }; return ctx.ARD; }
function chavesDoJogo(root) { return jogo(root).vozes.chavesDoJogo(); }
/* falas fixas da campanha por missão: { k (chave do dicionário), n (camp:<missão>:<n>), quem }; a fala feita por função (nome dinâmico) fica de fora */
function falasCampanha(root) { const A = jogo(root); const out = {}; for (const m of A.campaign.MISSIONS) { const l = []; const add = (k, quem) => l.push({ k, n: A.vozes.numeroCamp(m.id, k), quem });
  (m.brief || []).forEach((b, i) => add('camp.' + m.id + '.brief.' + i, b[0])); (m.script || []).forEach((e, i) => { if (e.say && typeof e.say !== 'function') add('camp.' + m.id + '.fala.' + i, e.say[0]); }); (m.events || []).forEach((e, i) => { if (e.say && typeof e.say !== 'function') add('camp.' + m.id + '.ev.' + i, e.say[0]); }); out[m.id] = l; }
  return out; }
/* confere um manifesto: chaves do jogo por Raça, saudação da Sala, campanha, arquivos e durações. Devolve { ok, faltam, arquivos, ... } */
function conferir(root, dir, opts) { opts = opts || {}; const mf = path.join(dir, 'manifesto.json'); const m = JSON.parse(fs.readFileSync(mf, 'utf8')); const J = chavesDoJogo(root); const r = { idioma: m.idioma, versao: m.versao, provisorio: !!m.provisorio, formatos: m.formatos, falas: Object.keys(m.falas || {}).length, faltam: [], arquivos: { ok: 0, faltam: [], duracao: [] }, palavras: [], bytes: 0, pacotes: {} };
  for (const raca of J.RACAS) { const tab = (m.chaves || {})[raca] || {}; const precisa = J.porRaca.concat([{ nome: J.sala(raca), c: [J.sala(raca)] }]);
    for (const k of precisa) { const ch = k.c.find(c => tab[c] && tab[c].length); if (!ch) r.faltam.push(raca + ' · ' + k.nome); } }
  const camp = falasCampanha(root); r.campanha = { falas: 0, faltam: 0 }; for (const id in camp) { const tab = (m.chaves || {})['camp-' + id] || {}; /* cada fala fixa tem a chave; a do próprio líder ('self'), uma por Raça */
    for (const x of camp[id]) { const ch = 'camp:' + id + ':' + x.n; const precisa = x.quem === 'self' ? J.RACAS.map(rc => ch + ':' + rc) : [ch]; for (const c of precisa) { r.campanha.falas++; if (!(tab[c] && tab[c].length)) { r.campanha.faltam++; if (r.faltam.length < 400) r.faltam.push('camp-' + id + ' · ' + c); } } } }
  const fmt = (m.formatos || ['ogg'])[0];
  for (const id in m.falas || {}) { const f = m.falas[id]; const arq = path.join(dir, String(f.arq || '').replace(/\.[a-z0-9]+$/i, '.' + fmt)); if (!fs.existsSync(arq)) { r.arquivos.faltam.push(id); continue; } r.arquivos.ok++; const tam = fs.statSync(arq).size; r.bytes += tam; r.pacotes[f.pacote || '?'] = (r.pacotes[f.pacote || '?'] || 0) + tam;
    const d = duracao(arq); if (d != null && (!(f.dur > 0.15) || Math.abs(d - f.dur) > Math.max(0.08, f.dur * 0.04))) r.arquivos.duracao.push(id + ' (manifesto ' + f.dur + ' s, arquivo ' + d.toFixed(2) + ' s)');
    const ps = f.palavras || []; let ant = -1, ruim = !ps.length; for (const p of ps) { if (!(p[0] >= 0 && p[1] >= p[0] && p[0] >= ant - 0.02 && p[1] <= f.dur + 0.15)) ruim = true; ant = p[0]; } if (ruim) r.palavras.push(id); }
  for (const pac in m.chaves || {}) for (const k in m.chaves[pac]) for (const id of m.chaves[pac][k]) if (!m.falas[id]) r.faltam.push(pac + ' · ' + k + ' → ' + id + ' sem fala');
  r.ok = !r.faltam.length && !r.arquivos.faltam.length && !r.arquivos.duracao.length && !r.palavras.length; return r; }
module.exports = { duracaoOgg, duracao, chavesDoJogo, falasCampanha, conferir };
