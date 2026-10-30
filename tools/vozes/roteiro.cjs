/* 5.0c.1: monta tools/vozes/roteiro.json, a lista de todas as falas gravadas com os textos nos três idiomas (o contrato com quem toca as vozes no jogo).
   Lê o próprio jogo, sem mudar nada: os dicionários (src/i18n/*.js: voz.*, sala.fala.*, camp.*, ia.*, hud.eliminado), a campanha (src/campaign.js, com
   quem fala em cada missão para cada Raça do jogador, inclusive a troca de Raça do inimigo), os nomes das IAs (src/main.js) e as chaves de hoje
   (TIPO_DA_CHAVE do src/audio.js). As falas novas vêm de tools/vozes/falas-jogo.json. Uso: node tools/vozes/roteiro.cjs */
'use strict';
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..', '..');
const IDIOMAS = ['pt-BR', 'en', 'es'];
const RACAS = ['vehnar', 'erevane', 'tessara', 'quorith', 'vorag'];
const LIDER = { vehnar: 'Barão-Forja', erevane: 'Vesper Ísk', tessara: 'Sylvia Oriel', quorith: 'Zayin Coral', vorag: 'Oru Voraz' };
const GENERO_LIDER = { vehnar: 'm', erevane: 'm', tessara: 'f', quorith: 'm', vorag: 'm' };
const CLASSES = ['civil', 'infantaria', 'veiculo', 'drone', 'suporte'];
const CLS_SIM = { civ: 'civil', inf: 'infantaria', vei: 'veiculo', dro: 'drone', sup: 'suporte' };
const ACOES = { sel: 3, mover: 3, atacar: 2 };
const slug = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

globalThis.ARD = {};
for (const l of IDIOMAS) require(path.join(root, 'src', 'i18n', l + '.js'));
const DIC = ARD.I18N_DIC;
require(path.join(root, 'src', 'sim.js')); require(path.join(root, 'src', 'campaign.js'));
const S = ARD.sim, C = ARD.campaign;
const F = JSON.parse(fs.readFileSync(path.join(__dirname, 'falas-jogo.json'), 'utf8'));
const erros = [];
function dic(k, l, genero) { const d = DIC[l] || {}; const kg = genero ? k + '.' + genero : null; const v = kg && d[kg] !== undefined ? d[kg] : d[k]; if (typeof v !== 'string') { erros.push(`${l}: falta a chave ${k}`); return ''; } return v; }
const tri = (k, genero) => Object.fromEntries(IDIOMAS.map(l => [l, dic(k, l, genero)]));
const trio = a => ({ 'pt-BR': a[0], en: a[1], es: a[2] });

/* as chaves de hoje, conferidas contra o TIPO_DA_CHAVE do src/audio.js (o mesmo nome, letra por letra) */
const HOJE = [['built', 'voz.construcao'], ['spawn', 'voz.unidade'], ['Pesquisa concluída', 'voz.pesquisa'], ['Base sob ataque', 'voz.base-ataque'], ['Núcleo sob ataque', 'voz.nucleo-ataque'],
  ['Alerta de sifão', 'voz.alerta-sifao'], ['Pacto quebrado', 'voz.pacto-quebrado'], ['Tempestade de Éter', 'voz.tempestade'], ['Blecaute', 'voz.blecaute'], ['Fundição Orbital', 'voz.fundicao'],
  ['Salto de Núcleo', 'voz.salto'], ['Pacto assinado', 'voz.pacto-assinado'], ['voz-on', 'voz.ativada']];
{ const a = fs.readFileSync(path.join(root, 'src', 'audio.js'), 'utf8'); const m = /const TIPO_DA_CHAVE = \{([\s\S]*?)\};/.exec(a); const ks = new Set();
  if (m) for (const x of m[1].matchAll(/(?:'([^']+)'|([A-Za-z-]+))\s*:/g)) ks.add(x[1] || x[2]); else erros.push('src/audio.js: TIPO_DA_CHAVE não encontrado');
  for (const [k] of HOJE) if (!ks.has(k)) erros.push('chave de hoje fora do TIPO_DA_CHAVE: ' + k); }

/* nomes das IAs, lidos do src/main.js; o id curto é o mesmo da chave ia.<id> dos dicionários */
const IAS = (() => { const s = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8'); const m = /const aiNames = (\{[^;]*\});/.exec(s); if (!m) { erros.push('src/main.js: aiNames não encontrado'); return []; }
  const t = Function('return ' + m[1])(); return RACAS.flatMap(r => t[r].map(n => ({ raca: r, nome: n, id: slug(n) }))); })();

const falas = [];
const add = f => falas.push(Object.assign({ id: '', tipo: '', raca: '', quem: '', chave: '', variante: 1, texto: {} }, f));

for (const r of RACAS) {
  const pac = r;
  /* locutor: os 13 de hoje (texto exato do dicionário) e os novos */
  for (const [k, ik] of HOJE) add({ id: `${r}-loc-${slug(k)}`, tipo: 'locutor', raca: r, quem: 'locutor', chave: k, texto: tri(ik), i18n: ik, pacote: pac });
  for (const n of F.locutor_novos) add({ id: `${r}-loc-${n.nome}`, tipo: 'locutor', raca: r, quem: 'locutor', chave: 'loc:' + n.nome, texto: { 'pt-BR': n['pt-BR'], en: n.en, es: n.es }, pacote: pac });
  /* eliminações: o nome de cada IA no idioma (ia.<id>), com o gênero certo em pt-BR */
  for (const ia of IAS) { const pt = F.elim_pt[ia.id]; if (!pt) erros.push('sem texto de eliminação para ' + ia.id);
    add({ id: `${r}-elim-${ia.id}`, tipo: 'elim', raca: r, quem: 'locutor', chave: 'elim:' + ia.id, texto: { 'pt-BR': pt, en: F.elim_modelo.en.replace('{nome}', dic('ia.' + ia.id, 'en')), es: F.elim_modelo.es.replace('{nome}', dic('ia.' + ia.id, 'es')) }, i18n: 'ia.' + ia.id, pacote: pac, ia_raca: ia.raca }); }
  /* unidades: 5 classes × (3 ao selecionar, 3 ao mover, 2 ao atacar), com o jeito da Raça */
  for (const c of CLASSES) for (const [a, n] of Object.entries(ACOES)) { const L = ((F.unidades[r] || {})[c] || {})[a] || []; if (L.length !== n) erros.push(`unidades ${r}/${c}/${a}: ${L.length} falas (esperado ${n})`);
    L.forEach((t, i) => add({ id: `${r}-unid-${c}-${a}-${i + 1}`, tipo: 'unidade', raca: r, quem: 'unidade', classe: c, chave: `unid:${c}:${a}`, variante: i + 1, texto: trio(t), pacote: pac })); }
  /* líder: a saudação de hoje da Sala e duas novas (variantes de sala-<raça>), 10 reações na partida e a retomada da campanha */
  add({ id: `${r}-sala-1`, tipo: 'lider', raca: r, quem: 'lider', lider: LIDER[r], chave: 'sala-' + r, variante: 1, texto: tri('sala.fala.' + r), i18n: 'sala.fala.' + r, pacote: pac });
  F.lider_saudacoes[r].forEach((t, i) => add({ id: `${r}-sala-${i + 2}`, tipo: 'lider', raca: r, quem: 'lider', lider: LIDER[r], chave: 'sala-' + r, variante: i + 2, texto: trio(t), pacote: pac }));
  F.lider_eventos.forEach((ev, i) => add({ id: `${r}-lider-${ev}`, tipo: 'lider', raca: r, quem: 'lider', lider: LIDER[r], chave: 'lider:' + ev, texto: trio(F.lider_reacoes[r][i]), pacote: pac }));
  add({ id: `${r}-lider-retomada`, tipo: 'lider', raca: r, quem: 'lider', lider: LIDER[r], chave: 'lider:retomada', texto: tri('camp.retomada', GENERO_LIDER[r]), i18n: 'camp.retomada', pacote: pac });
}

/* campanha: cada fala fixa das 20 missões, na voz de quem fala de fato. A Raça de quem fala sai do próprio C.prepare para cada Raça do jogador:
   'self' é o líder do jogador (as cinco Raças, menos nas Missões de Identidade, que fixam a Raça), 'enemy' é o primeiro inimigo (no p3, um rival) e uma
   Raça fixa troca de voz quando o inimigo teria a Raça do jogador (prep.swap). Numeração n: o briefing, depois o script (.fala.) e os eventos (.ev.),
   na ordem do src/campaign.js; a fala com texto montado na hora (função) recebe o número, mas fica na voz do sistema. */
const CAMP = {};
for (const m of C.MISSIONS) {
  const L = []; (m.brief || []).forEach((b, i) => L.push({ k: `camp.${m.id}.brief.${i}`, say: b })); (m.script || []).forEach((s, i) => { if (s.say) L.push({ k: `camp.${m.id}.fala.${i}`, say: s.say }); });
  (m.events || []).forEach((s, i) => { if (s.say) L.push({ k: `camp.${m.id}.ev.${i}`, say: s.say }); });
  const racas = m.race ? [m.race] : RACAS; CAMP[m.id] = [];
  L.forEach((x, n) => {
    const chave = `camp:${m.id}:${n}`; const dinamica = typeof x.say === 'function';
    const quem = dinamica ? 'self' : x.say[0]; const fala = new Set();
    for (const jr of racas) { const prep = C.prepare(m.id, { race: jr }); const en = prep.cfg.players.slice(1);
      const sp = quem === 'self' ? jr : quem === 'enemy' ? (en.find(p => !p.ally) || en[0]).faction : quem === 'ally' ? (en.find(p => p.ally) || en[0]).faction : (prep.swap[quem] || quem); fala.add(sp); }
    CAMP[m.id].push({ n, chave, i18n: x.k, papel: quem, racas: [...fala], dinamica });
    if (dinamica) return;
    for (const r of fala) add({ id: `${m.id}-${n}-${r}`, tipo: 'campanha', raca: r, quem: 'lider', lider: LIDER[r], papel: quem, chave, variante: 1, texto: tri(x.k, GENERO_LIDER[r]), i18n: x.k, pacote: 'camp-' + m.id, missao: m.id, humor: x.say[1] });
  });
}

/* conferências: id único, texto nos três idiomas, a saudação do Zayin com "Afínate" (decisão do dono), chaves e contagens */
const ids = new Set(); for (const f of falas) { if (ids.has(f.id)) erros.push('id repetido: ' + f.id); ids.add(f.id); for (const l of IDIOMAS) if (!f.texto[l]) erros.push(`${f.id}: sem texto em ${l}`); }
{ const z = falas.find(f => f.id === 'quorith-sala-1'); if (!z || !/Afínate/.test(z.texto.es)) erros.push('a saudação do Zayin em espanhol tem de dizer "Afínate"'); }
const cont = { total: falas.length, por_tipo: {}, por_raca: {}, por_pacote: {} };
for (const f of falas) { cont.por_tipo[f.tipo] = (cont.por_tipo[f.tipo] || 0) + 1; cont.por_raca[f.raca] = (cont.por_raca[f.raca] || 0) + 1; cont.por_pacote[f.pacote] = (cont.por_pacote[f.pacote] || 0) + 1; }
const chaves = {}; for (const f of falas) { const p = chaves[f.pacote] || (chaves[f.pacote] = {}); (p[f.chave] || (p[f.chave] = [])).push(f.id); if (f.tipo === 'campanha') (p[f.chave + ':' + f.raca] || (p[f.chave + ':' + f.raca] = [])).push(f.id); } /* campanha: também por Raça de quem fala */
const classes = {}; for (const [k, u] of Object.entries(S.UNITS)) { const c = CLS_SIM[u.cls]; if (c) (classes[c] || (classes[c] = [])).push(k); }

const out = {
  versao: '5.0c.1', gerado: new Date().toISOString().replace(/\.\d+Z$/, 'Z'), idiomas: IDIOMAS, racas: RACAS, lideres: LIDER,
  contrato: {
    formato: 'cada fala: { id, tipo: locutor|elim|unidade|lider|campanha, raca, quem: locutor|unidade|lider, chave, variante, texto: { pt-BR, en, es } }, mais campos de apoio (pacote, i18n = chave do dicionário de onde veio o texto, classe, lider, papel, missao).',
    pacotes: 'vehnar, erevane, tessara, quorith, vorag (locutor, eliminações, unidades e líder da Raça) e camp-<missão>. Arquivo: assets/vozes/<idioma>/<pacote>/<id>.ogg; manifesto: assets/vozes/<idioma>/manifesto.json.',
    variantes: 'nos pacotes das Raças, falas com a mesma chave são variantes: o jogo sorteia uma (unid:<classe>:<ação> tem 3, 3 e 2; sala-<raça> tem 3).',
    campanha: 'na campanha, a mesma chave camp:<missão>:<n> tem UMA fala por Raça de quem fala (não são variantes): o manifesto traz também a chave camp:<missão>:<n>:<raça> com só aquela fala, e cada fala tem o campo raca. A Raça de quem fala é a do said.race do src/campaign.js. O mapa i18n → chave está em campanha.',
    texto: 'texto = legenda. As falas que o jogo já tem usam o texto exato do dicionário (campo i18n). Na síntese, o gerador só acrescenta a pontuação final que falta (! nos perigos e eventos de hoje, . no resto), tira o ⚡ e lê +N como "mais N"; a legenda não muda.',
    fora: 'continuam na voz do sistema: falas com nome ou número dinâmico (nome de jogador digitado no multiplayer, "Pesquisa concluída: <nome>", contagens acima de 3, "Objetivo concluído: {obj}" da campanha, camp.a2m1.fala.0 com o nome da unidade montado na hora), o "Ouvir" de Ajustes (voz.amostra) e qualquer fala sem arquivo carregado.'
  },
  chaves_hoje: HOJE.map(([k, ik]) => ({ chave: k, i18n: ik })),
  lider_eventos: F.lider_eventos_nota,
  classes,
  campanha: CAMP,
  contagem: cont,
  chaves,
  falas
};
if (erros.length) { console.error('roteiro com problemas:\n- ' + erros.join('\n- ')); process.exit(1); }
fs.writeFileSync(path.join(__dirname, 'roteiro.json'), JSON.stringify(out, null, 1) + '\n');
console.log(`roteiro.json: ${falas.length} falas por idioma · ` + Object.entries(cont.por_tipo).map(([k, v]) => k + ' ' + v).join(' · ') + ` · ${Object.keys(chaves).length} pacotes`);
