// 5.0c.1: manifesto provisório das vozes gravadas, enquanto o real (assets/vozes/, do v-gravar) não chega. Monta work/vozes-provisorio/<idioma>/ com as
// amostras aprovadas do elenco (a2-vozes, 3ª rodada: Vorag na variante C): por Raça e idioma, a saudação do líder (sala-<raça>) e dois avisos do
// locutor (spawn = "Unidade pronta", "Base sob ataque"), no formato do contrato (manifesto.json com falas, chaves e o tempo de cada palavra).
// Os tempos de palavra são estimados (proporcionais às letras, dentro da fala medida); o real vem do faster-whisper.
// --teste: também work/vozes-teste/, com TODAS as chaves que o jogo usa apontando para essas amostras (só para conferir o encanamento nos testes).
// Uso: node tools/vozes/provisorio.cjs [--origem=<pasta work/vozes do a2-vozes>] [--teste]
const fs = require('fs'), path = require('path'); const U = require('./manifesto-util.cjs');
const root = path.resolve(__dirname, '../..');
const ORIG = (process.argv.find(a => a.startsWith('--origem=')) || '').slice(9) || [path.resolve(root, '../a2-vozes/work/vozes'), path.resolve(root, '.wip/v50/agents/a2-vozes/work/vozes')].find(p => fs.existsSync(path.join(p, 'manifesto.json'))) || path.resolve(root, '../a2-vozes/work/vozes'); /* 5.0c.1 (junção): da cópia de um agente ou do repositório principal */
const TXT = JSON.parse(fs.readFileSync(path.resolve(ORIG, '../../tools/vozes/idiomas.json'), 'utf8'));
const MAN = JSON.parse(fs.readFileSync(path.join(ORIG, 'manifesto.json'), 'utf8'));
const RACAS = ['vehnar', 'erevane', 'tessara', 'quorith', 'vorag']; const IDI = { 'pt-BR': 'pt', en: 'en', es: 'es' };
const LOCS = [['01-unidade-pronta', 'spawn', 'loc-unidade-pronta'], ['03-base-sob-ataque', 'Base sob ataque', 'loc-base-sob-ataque']];
/* tempos de palavra estimados: a fala começa em ini e termina em fim (a cauda de eco da Erevane e do Quorith fica de fora) */
function palavras(texto, ini, fim) { const ws = texto.split(/\s+/).filter(Boolean); const peso = ws.map(w => w.replace(/[^\p{L}\p{N}]/gu, '').length + 1.5); const tot = peso.reduce((a, b) => a + b, 0); const gap = 0.06; const util = Math.max(0.2, fim - ini - gap * (ws.length - 1)); let t = ini; return ws.map((w, i) => { const d = util * peso[i] / tot; const p = [+t.toFixed(3), +(t + d).toFixed(3), w]; t += d + gap; return p; }); }
function origem(raca, L, tipo, loc) { const r = raca === 'vorag' && L === 'pt-BR' ? 'vorag-c' : raca; const nome = tipo === 'lider' ? r + '-lider' : r + '-locutor-' + loc; return L === 'pt-BR' ? path.join(ORIG, 'elenco', nome + '.ogg') : path.join(ORIG, 'idiomas/kokoro', L, nome + '.ogg'); }
function inicio(raca, L, tipo, loc) { if (L !== 'pt-BR') return 0.1; const e = MAN.elenco && MAN.elenco.racas && MAN.elenco.racas[raca === 'vorag' ? 'vorag-c' : raca]; const x = e && (tipo === 'lider' ? e.lider_fala : (e.locutor_falas || []).find(f => f.id === loc)); return x && x.inicio_s != null ? x.inicio_s : 0.14; }
function cauda(raca) { return raca === 'erevane' ? 0.55 : raca === 'quorith' ? 0.35 : 0.12; }
function montar(dest, todas) { fs.rmSync(dest, { recursive: true, force: true }); const J = todas ? U.chavesDoJogo(root) : null; const resumo = {};
  for (const L of Object.keys(IDI)) { const m = { versao: '5.0c.1', idioma: L, formatos: ['ogg'], provisorio: true, gerado: new Date().toISOString().slice(0, 16) + 'Z', nota: 'manifesto provisório (tools/vozes/provisorio.cjs): amostras do elenco aprovado, tempos de palavra estimados' + (todas ? '; TESTE: todas as chaves do jogo apontam para estas amostras' : ''), falas: {}, chaves: {} };
    for (const raca of RACAS) { const tab = m.chaves[raca] = {}; fs.mkdirSync(path.join(dest, L, raca), { recursive: true });
      const add = (id, tipo, loc, chave, texto) => { const src = origem(raca, L, tipo, loc); if (!fs.existsSync(src)) { console.warn('falta ' + src); return null; } const arq = raca + '/' + id + '.ogg'; fs.copyFileSync(src, path.join(dest, L, arq)); const dur = +U.duracao(src).toFixed(3);
        m.falas[id] = { arq, dur, texto, palavras: palavras(texto, inicio(raca, L, tipo, loc), dur - cauda(raca)), pacote: raca }; (tab[chave] = tab[chave] || []).push(id); return id; };
      const lid = add(raca + '-sala-1', 'lider', null, 'sala-' + raca, TXT.lideres[raca][IDI[L]]);
      const locs = LOCS.map(([loc, chave, nome]) => add(raca + '-' + nome, 'locutor', loc, chave, TXT.locutor.find(x => x.id === loc)[IDI[L]]));
      if (todas) { /* TESTE: cada chave do jogo aponta para uma das três amostras (o texto é o da amostra) */ for (const k of J.porRaca) { const ch = k.c[0]; if (tab[ch]) continue; tab[ch] = [/^lider:/.test(ch) ? lid : /perigo|ataque|nodulo|roubo/.test(ch) ? locs[1] : locs[0]]; } } }
    if (todas) { const camp = U.falasCampanha(root); for (const id in camp) { const tab = m.chaves['camp-' + id] = {}; camp[id].forEach(x => { tab['camp:' + id + ':' + x.n] = []; }); } } /* sem arquivo: a central de comunicação segue sem voz */
    fs.writeFileSync(path.join(dest, L, 'manifesto.json'), JSON.stringify(m, null, 1)); resumo[L] = { falas: Object.keys(m.falas).length, kb: Math.round(Object.values(m.falas).reduce((s, f) => s + fs.statSync(path.join(dest, L, f.arq)).size, 0) / 1024) }; }
  return resumo; }
const r = { provisorio: montar(path.join(root, 'work/vozes-provisorio'), false) }; if (process.argv.includes('--teste')) r.teste = montar(path.join(root, 'work/vozes-teste'), true);
console.log(JSON.stringify(r)); console.log('Para trocar o provisório pelo real: cp -r <cópia do v-gravar>/assets/vozes assets/ && node tools/build.mjs');
