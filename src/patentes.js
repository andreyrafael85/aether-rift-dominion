/* Aether Rift: Dominion — 5.5b.2: Patentes. As regras das Centelhas (a experiência do jogador; id interno "xp"), as 10 patentes × 5 níveis,
   a afinidade por Raça, a sequência do Desafio do Dia com escudo e o código de comandante. Regra pura + guarda no ProgressStore (campo
   "patentes"); sem servidor e sem nenhum pedido de rede. Roda no Node para os testes (tools/patentes-test.cjs).
   REGRA DURA: nada aqui entra na simulação. Este arquivo não chama a simulação; só lê o resultado de uma partida que já acabou.
   - TABELA: quanto rende cada feito. ganhos(o) é pura e explicável: devolve a lista [{ motivo, xp, ... }] sem mudar nada.
   - credita(o): aplica a lista (uma vez por partida) e devolve { ganhos, total, antes, depois, subiu, subiuAfinidade, marcos }.
   - O que só se ganha uma vez (missão, estrelas, medalha, conquista, degrau de descoberta, marco de sequência) é pago pela diferença entre
     o progresso guardado e um "livro" do que já foi pago: nunca paga duas vezes, e é assim que o histórico de quem já jogava vira Centelhas.
   - Descanso e retorno (reajuste do dono): as 2 primeiras partidas do dia rendem em dobro e a primeira partida de cada semana nova
     rende um bônus fixo. Os dois valem igual para todos, então pesam mais para quem joga pouco e aproximam os perfis.
   - Contra fábrica de pontos: partida de teste não rende; partida com menos de 3 minutos não rende; a partida guiada rende uma vez; a mesma
     partida retomada de um salvamento não rende de novo; a partir da 9ª partida do dia rende metade e, a partir da 15ª, um quinto.
   - O dia vira em UTC (como o Desafio do Dia). Relógio do aparelho para trás não abre um dia novo: vale o maior dia já visto.
   Interface: este arquivo não desenha nada (insígnias, telas e cartões são do src/insignias.js); só tem o aviso "Seu histórico valeu N" e a
   confirmação do código de comandante colado na caixa de backup ou vindo por link (?comandante=CÓDIGO). */
(function (ARD) {
'use strict';
const V = 1;                                           /* versão do campo "patentes" no ProgressStore */
const FORMATO = 1;                                     /* versão do formato do código de comandante */
const RACAS = ['vehnar', 'erevane', 'tessara', 'quorith', 'vorag'];
const PATENTES = ['recruta', 'batedor', 'vanguarda', 'capitao', 'comandante', 'estrategista', 'almirante', 'marechal', 'guardiao', 'soberano'].map((id, i) => ({ id, ordem: i + 1 }));
const NIVEIS = 5; const DEGRAUS = PATENTES.length * NIVEIS;
const ROMANO = ['', 'I', 'II', 'III', 'IV', 'V'];

/* ---------- a tabela de Centelhas por feito ---------- */
const TABELA = {
  partida: { escaramuca: 50, blitz: 35, cacada: 45, campanha: 50, multi: 60, guia: 50 }, /* partida terminada, por modo */
  vitoria: 30,
  descanso: 2,                                                                            /* 5.5b.2 (reajuste): as primeiras partidas do dia rendem em dobro (partida + vitória + dificuldade); favorece quem joga pouco */
  retorno: 400,                                                                           /* 5.5b.2 (reajuste): a primeira partida de cada semana nova (a semana vira na segunda, em UTC); não vale na semana de estreia */
  dificuldade: { facil: 0, normal: 10, dificil: 25, brutal: 40, fenda: 40 },             /* só na vitória */
  desafio: { jogou: 40, venceu: 40, recorde: 20, recordesPorDia: 3 },                     /* Desafio do Dia: a 1ª partida do dia, a 1ª vitória do dia e bater o próprio recorde */
  missao: 120,                                                                            /* missão de campanha vencida pela primeira vez */
  estrela: 20,                                                                            /* cada estrela nova numa missão */
  medalha: { bronze: 60, prata: 120, ouro: 200 },                                         /* medalha de Caçada (por chefão e dificuldade; na troca por uma melhor, paga a diferença) */
  conquista: 100,
  degrau: 60,                                                                             /* degrau de descoberta */
  marco: { 3: 100, 7: 250, 14: 500, 30: 1000 },                                           /* marcos da sequência do Desafio do Dia */
  marcoCiclo: 1000,                                                                       /* depois dos 30 dias, cada 30 dias seguidos a mais */
  minSegundos: 180,                                                                       /* partida mais curta que isto não rende */
  repeticao: [{ ate: 8, fator: 1 }, { ate: 14, fator: 0.5 }, { ate: Infinity, fator: 0.2 }], /* partidas que renderam no mesmo dia */
};
/* ---------- a curva dos 50 degraus ----------
   Recruta I a V tem custos próprios (a primeira noite); depois, cada patente tem um custo por nível. LIMIAR[k] = Centelhas para estar no
   degrau k (0 = Recruta I … 49 = Soberano da Fenda V). Depois do topo, uma estrela a cada ESTRELA Centelhas. Ajustada pela simulação dos
   três perfis (work/ferr/npa-perfis.cjs). */
const RECRUTA = [0, 60, 160, 310, 500];
const CUSTO = [0, 280, 500, 870, 1100, 1500, 2000, 2600, 3300, 4600]; /* Centelhas por nível dentro de cada patente (a de Recruta usa a lista acima) */
const BATEDOR = 740;                                   /* Centelhas para sair de Recruta V */
const ESTRELA = 13000;
const LIMIAR = (() => { const L = RECRUTA.slice(); let base = BATEDOR; for (let r = 1; r < PATENTES.length; r++) { for (let j = 0; j < NIVEIS; j++) L.push(base + j * CUSTO[r]); base += NIVEIS * CUSTO[r]; } return L; })();
const TOPO = LIMIAR[DEGRAUS - 1];
const AFINIDADE = [300, 1200, 3000, 7000, 15000];      /* Centelhas ganhas com a Raça para cada um dos cinco degraus de afinidade */
const MARCOS = [3, 7, 14, 30];
/* os cosméticos que o código de comandante leva, um bit cada. SÓ ACRESCENTE NO FIM (a posição é o que viaja no código). */
const BITS = ['pin-fortaleza', 'pin-santuario', 'mol-alinhamento', 'mol-cinco-mundos', 'tit-recruta', 'tit-palavra-dada', 'cor-veterano',
  'tit-seq-3', 'cor-seq-7', 'tit-seq-14', 'tit-seq-30', 'mol-seq-30']
  .concat(...RACAS.map(r => ['tit-afin-' + r + '-2', 'est-afin-' + r + '-3', 'cor-afin-' + r + '-4', 'tit-afin-' + r + '-5']));

const P = () => ARD.progress;
const T = (k, v, r) => { const vars = Object.assign({ moeda: moeda(v && v.n) }, v || {}); return ARD.t ? ARD.t(k, vars, r) : String(r != null ? r : k).replace(/\{(\w+)\}/g, (x, n) => (n in vars ? String(vars[n]) : x)); };
/* o nome da moeda mora em UMA chave por idioma (patente.moeda.nome; .um para o singular): todo texto usa {moeda} */
function moeda(n) { const um = n === 1; return ARD.t ? ARD.t(um ? 'patente.moeda.um' : 'patente.moeda.nome', null, um ? 'Centelha' : 'Centelhas') : (um ? 'Centelha' : 'Centelhas'); }
let relogio = () => Date.now();                        /* os testes trocam por um relógio falso (_relogio) */
const hojeN = () => Math.floor(relogio() / 86400000);  /* o dia em UTC, em número (dias desde 1970-01-01), como o Desafio do Dia */
const semanaDe = n => Math.floor((n + 3) / 7);         /* semana que começa na segunda (a mesma conta do src/desafio.js) */
function diaNum(data) { if (typeof data === 'number') return data; if (ARD.desafio && ARD.desafio.diaNum) return ARD.desafio.diaNum(data); const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(data || '')); return m ? Math.floor(Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86400000) : NaN; }
const int = (v, max) => { v = Math.floor(+v); return v === v && v > 0 ? Math.min(v, max == null ? 1e9 : max) : 0; };

/* ---------- patente de uma quantidade de Centelhas (pura) ---------- */
function deXp(xp) { xp = int(xp); let k = 0; while (k < DEGRAUS - 1 && xp >= LIMIAR[k + 1]) k++; const p = PATENTES[Math.floor(k / NIVEIS)];
  const estrelas = xp >= TOPO ? Math.floor((xp - TOPO) / ESTRELA) : 0; const de = k < DEGRAUS - 1 ? LIMIAR[k] : TOPO + estrelas * ESTRELA; const ate = k < DEGRAUS - 1 ? LIMIAR[k + 1] : de + ESTRELA;
  return { id: p.id, ordem: p.ordem, nivel: k % NIVEIS + 1, falta: ate - xp, degrau: k + 1, de, ate, estrelas }; }
function afinidadeDe(xp) { xp = int(xp); let d = 0; while (d < AFINIDADE.length && xp >= AFINIDADE[d]) d++; return { xp, degrau: d, falta: d < AFINIDADE.length ? AFINIDADE[d] - xp : 0, de: d ? AFINIDADE[d - 1] : 0, ate: d < AFINIDADE.length ? AFINIDADE[d] : AFINIDADE[AFINIDADE.length - 1] }; }
/* "Capitão de Fenda III" no idioma (chaves patente.<id>.nome e patente.nivel) */
function nome(p) { if (!p) return ''; const base = PATENTES.find(x => x.id === p.id); return T('patente.nivel', { patente: T('patente.' + p.id + '.nome', null, base ? base.id : p.id), n: ROMANO[p.nivel] || String(p.nivel) }, '{patente} {n}'); }

/* ---------- o que fica guardado (ProgressStore, campo "patentes"; vai e volta no código de backup) ----------
   xp: Centelhas; afin: Centelhas por Raça; hist: o que o histórico valeu na primeira abertura; dia: contadores do dia (UTC);
   livro: o que já foi pago uma vez (missões, estrelas, conquistas, medalhas, degraus, partida guiada, o último Desafio do Dia pago e as
   últimas partidas pagas); seq: sequência do Desafio do Dia (dias, último dia jogado, escudo, semana do último escudo, melhor, marcos). */
function novo() { return { v: V, xp: 0, afin: {}, hist: null, dia: { n: 0, p: 0, rec: 0 },
  livro: { miss: {}, conq: {}, med: {}, deg: 0, guia: 0, desN: 0, desVN: 0, semN: 0, vistas: [] }, seq: { dias: 0, ult: 0, escudo: 0, sem: -1, melhor: 0, marcos: [], pend: [], ciclo: 0 } }; }
function saneia(g) { const b = novo(); g.xp = int(g.xp, 16777215); if (!g.afin || typeof g.afin !== 'object') g.afin = {}; for (const r of Object.keys(g.afin)) { if (!RACAS.includes(r)) delete g.afin[r]; else g.afin[r] = int(g.afin[r], 1048575); }
  for (const k of ['dia', 'livro', 'seq']) { if (!g[k] || typeof g[k] !== 'object') g[k] = b[k]; for (const c in b[k]) if (g[k][c] == null || typeof g[k][c] !== typeof b[k][c] || Array.isArray(g[k][c]) !== Array.isArray(b[k][c])) g[k][c] = b[k][c]; }
  const q = g.seq; q.dias = int(q.dias, 1023); q.melhor = Math.max(int(q.melhor, 1023), q.dias); q.ult = int(q.ult, 65535); q.escudo = q.escudo ? 1 : 0; q.marcos = MARCOS.filter(m => q.marcos.includes(m)); return g; }
let naMigracao = false;
function guarda() { const s = P().load(); let g = s.patentes; if (g && typeof g === 'object' && g.v >= 1) return g.__ok ? g : marca(saneia(g));
  g = s.patentes = marca(novo()); if (!naMigracao) { naMigracao = true; try { migra(s, g); } finally { naMigracao = false; } } salva(); return g; }
/* __ok: já conferido nesta sessão (não enumerável: não vai para o JSON do ProgressStore) */
function marca(g) { try { Object.defineProperty(g, '__ok', { value: true, enumerable: false, configurable: true }); } catch (e) {} return g; }
function salva() { try { return P().save(); } catch (e) { return false; } }

/* ---------- quem já jogava: o histórico vira Centelhas, uma vez só ----------
   Missões, estrelas, conquistas e medalhas saem do progresso guardado; o Desafio do Dia (5.5b) entra com os dias jogados, as vitórias e a
   sequência — o recorde de cada dia e a sequência continuam onde estavam (nada do campo "desafio" é mexido). */
function migra(s, g) { const lin = unicos(s, g, null); const D = s.desafio && typeof s.desafio === 'object' ? s.desafio : null;
  if (D) { const j = int(D.jogados, 5000), v = int(D.vitorias, 5000); if (j) lin.push({ motivo: 'desafio', n: j, xp: j * TABELA.desafio.jogou }); if (v) lin.push({ motivo: 'desafio-vitoria', n: v, xp: v * TABELA.desafio.venceu });
    const q = g.seq; const u = D.ultimo ? diaNum(D.ultimo) : NaN; if (u === u && u > 0) { q.ult = int(u, 65535); q.dias = int(D.seq, 1023); g.livro.desN = q.ult; } q.melhor = Math.max(int(D.melhorSeq, 1023), q.dias);
    for (const m of MARCOS) if (q.melhor >= m) { q.marcos.push(m); lin.push({ motivo: 'marco', ref: m, xp: TABELA.marco[m] }); } q.ciclo = q.melhor >= 60 ? Math.floor(q.melhor / 30) * 30 : 0; }
  let total = 0; for (const l of lin) { total += l.xp; if (l.raca && RACAS.includes(l.raca)) g.afin[l.raca] = (g.afin[l.raca] || 0) + l.xp; } g.xp = total;
  g.hist = { xp: total, em: relogio(), visto: total === 0 }; return lin; }
/* o que só se ganha uma vez: a diferença entre o progresso guardado e o livro (o livro g é atualizado). fato: a partida que acabou (ou null). */
function unicos(s, g, fato) { const lin = []; const L = g.livro; const MED = { bronze: 1, prata: 2, ouro: 3 }; const VAL = [0, TABELA.medalha.bronze, TABELA.medalha.prata, TABELA.medalha.ouro];
  const ms = s.missions || {}; for (const id of Object.keys(ms).sort()) { const m = ms[id] || {}; const a = L.miss[id] || (L.miss[id] = { d: 0, e: 0 });
    if (m.done && !a.d) { a.d = 1; lin.push({ motivo: 'missao', ref: id, xp: TABELA.missao, raca: m.race || null }); }
    const e = int(m.stars, 3); if (e > a.e) { lin.push({ motivo: 'estrelas', ref: id, n: e - a.e, xp: TABELA.estrela * (e - a.e), raca: m.race || null }); a.e = e; } }
  const ac = s.achievements || {}; for (const id of Object.keys(ac).sort()) if (ac[id] && !L.conq[id]) { L.conq[id] = 1; lin.push({ motivo: 'conquista', ref: id, xp: TABELA.conquista }); }
  const rc = (s.cacada && s.cacada.recordes) || {}; for (const k of Object.keys(rc).sort()) { const v = MED[rc[k] && rc[k].medalha] || 0; const pago = int(L.med[k], 3); if (v > pago) { L.med[k] = v; lin.push({ motivo: 'medalha', ref: k, medalha: rc[k].medalha, xp: VAL[v] - VAL[pago] }); } }
  /* degraus de descoberta: quem já tinha progresso pulou a apresentação (degraus.pulo) e não recebe por ela. O degrau desta partida avança
     logo depois da tela final (src/degraus.js): fato.degrau diz qual é, para ele ser pago já, e o livro impede o pagamento em dobro. */
  const dg = s.degraus && typeof s.degraus === 'object' ? s.degraus : null; let n = dg ? int(dg.n, 5) : 0; if (dg && dg.pulo) L.deg = Math.max(L.deg, n);
  else { if (fato && fato.degrau != null && fato.degrau === n && n === L.deg && n < 5) n++; while (L.deg < n) { L.deg++; lin.push({ motivo: 'degrau', ref: L.deg, xp: TABELA.degrau }); } }
  return lin; }

/* ---------- a partida que acabou, em fatos (pura: só lê o objeto da tela final) ----------
   o: o objeto do ARD.fim.mostrar ({ G, sim, human, result, tipo, venceu, tempo }). Os testes passam o.fato pronto. */
function fatoDe(o) { if (!o) return { tipo: 'escaramuca', venceu: false, tempo: 0, teste: true }; if (o.fato) return o.fato;
  const G = o.G || {}, cfg = G.cfg || {}, sim = o.sim || {}, sc = sim.cfg || {}; const p = (sim.players && sim.players[o.human]) || {}; const tipo = TABELA.partida[o.tipo] != null ? o.tipo : 'escaramuca';
  const venceu = o.venceu != null ? !!o.venceu : !!(o.result && o.result.outcome === 'victory'); const cz = o.result && o.result.cacada;
  let busca = ''; try { busca = typeof location !== 'undefined' ? location.search : ''; } catch (e) {}
  const teste = !!(cfg.bench || G.bench || (sc.noVeins && !sc.campanha) || sc.eventosTeste || sc.unicasTeste || sc.cmdNivel != null || sc.iaPerfil || (sc.chefe && !sc.cacada) || /[?&](ia=todos|ff=[1-9]|bench=)/.test(busca));
  const dif = tipo === 'guia' || tipo === 'multi' ? null : tipo === 'campanha' ? ((G.camp && G.camp.prep && G.camp.prep.difficulty) || 'normal') : tipo === 'cacada' ? ((cz && cz.dif) || (cfg.cacada && cfg.cacada.dif) || 'normal') : cfg.diff || 'normal';
  const f = { tipo, venceu, tempo: Math.max(0, +(o.tempo != null ? o.tempo : sim.time) || 0), dif, raca: RACAS.includes(p.faction) ? p.faction : null, teste, retomada: !!cfg.resume, desafio: null, degrau: null };
  f.chave = [tipo, tipo === 'campanha' && G.camp && G.camp.prep && G.camp.prep.mission ? G.camp.prep.mission.id : (sim.map && sim.map.type) || cfg.map || '', sim.seed != null ? sim.seed : cfg.seed, f.raca, dif, (sim.players || []).length].join('|');
  try { const F = ARD.desafioUI && ARD.desafioUI.ultimoFim; if (F && F.o === o && F.diario) { const n = diaNum(F.diario); if (n === n) f.desafio = { data: F.diario, n, venceu, recorde: !!(F.reg && F.reg.recorde), jogadas: F.reg ? F.reg.jogadasHoje | 0 : 1 }; } } catch (e) {}
  try { const DG = ARD.degraus; if (DG && tipo !== 'guia' && tipo !== 'campanha' && tipo !== 'multi' && !cfg.resume) { const e = DG.estado(); const i = cfg.degrau != null ? cfg.degrau | 0 : e.n; if (!e.pulo && i === e.n && i < DG.TOTAL && DG.cabe(cfg, i)) f.degrau = i; } } catch (e) {}
  return f; }

/* ---------- a lista de ganhos de uma partida (o livro g é atualizado; ganhos() passa uma cópia, credita() passa o de verdade) ---------- */
function calcula(fato, g, s, hoje) { const lin = []; const n = Math.max(int(hoje), g.dia.n); if (n !== g.dia.n) g.dia = { n, p: 0, rec: 0 }; /* relógio para trás: continua no maior dia já visto */
  if (!fato || fato.teste || fato.replay) { lin.push({ motivo: 'sem-ganho', porque: fato && fato.replay ? 'replay' : 'teste', xp: 0 }); return lin; }
  const L = g.livro; const base = TABELA.partida[fato.tipo]; let porque = null;
  if (base == null) porque = 'teste'; else if (fato.tipo === 'guia' && L.guia) porque = 'guiada-repetida'; else if (!(fato.tempo >= TABELA.minSegundos)) porque = 'curta'; else if (fato.retomada && fato.chave && L.vistas.includes(fato.chave)) porque = 'retomada-repetida';
  if (porque) lin.push({ motivo: 'sem-ganho', porque, xp: 0 });
  else { let parte = base; lin.push({ motivo: 'partida', modo: fato.tipo, xp: base });
    if (fato.venceu) { lin.push({ motivo: 'vitoria', xp: TABELA.vitoria }); parte += TABELA.vitoria; const d = TABELA.dificuldade[fato.dif] || 0; if (d) { lin.push({ motivo: 'dificuldade', dif: fato.dif, xp: d }); parte += d; } }
    g.dia.p++; const fx = TABELA.repeticao.find(x => g.dia.p <= x.ate).fator; if (fx < 1) { const corte = Math.round(parte * (1 - fx)); lin.push({ motivo: 'repeticao', n: g.dia.p, xp: -corte }); parte -= corte; }
    if (g.dia.p <= TABELA.descanso) lin.push({ motivo: 'descanso', n: g.dia.p, xp: parte });
    { const sem = semanaDe(n); if (L.semN && sem > L.semN) lin.push({ motivo: 'retorno', xp: TABELA.retorno }); if (sem > L.semN) L.semN = sem; }
    if (fato.tipo === 'guia') L.guia = 1; if (fato.chave) { L.vistas.push(fato.chave); while (L.vistas.length > 60) L.vistas.shift(); }
    const d = fato.desafio; if (d && d.n > 0) { /* o dia do desafio só anda para a frente: o desafio de um dia já pago (ou de um dia anterior) não paga de novo */
      if (d.n > L.desN) { L.desN = d.n; lin.push({ motivo: 'desafio', xp: TABELA.desafio.jogou }); }
      if (d.venceu && d.n >= L.desN && d.n > L.desVN) { L.desVN = d.n; lin.push({ motivo: 'desafio-vitoria', xp: TABELA.desafio.venceu }); }
      if (d.recorde && d.jogadas > 1 && d.n >= L.desN && g.dia.rec < TABELA.desafio.recordesPorDia) { g.dia.rec++; lin.push({ motivo: 'desafio-recorde', xp: TABELA.desafio.recorde }); } } }
  for (const l of unicos(s, g, fato)) lin.push(l);
  const q = g.seq; for (const m of q.pend) lin.push({ motivo: 'marco', ref: m, xp: TABELA.marco[m] || TABELA.marcoCiclo }); q.pend = [];
  return lin; }
const soma = lin => lin.reduce((a, l) => a + l.xp, 0);
const copia = x => JSON.parse(JSON.stringify(x));
/* pura: a lista que credita(o) aplicaria agora, sem mudar nada. ctx (opcional, para testes): { guardado, progresso, hoje } */
function ganhos(o, ctx) { const g = saneia(copia(ctx && ctx.guardado ? ctx.guardado : guarda())); const s = ctx && ctx.progresso ? ctx.progresso : P().load(); const fato = fatoDe(o);
  if (fato && fato.desafio && fato.desafio.n > 0) seqAnda(g.seq, fato.desafio.n); return calcula(fato, g, s, ctx && ctx.hoje != null ? ctx.hoje : hojeN()); }
function resumo(g) { const d = deXp(g.xp); return { xp: g.xp, id: d.id, ordem: d.ordem, nivel: d.nivel, degrau: d.degrau, estrelas: d.estrelas }; }
let ULT = null, ULT_SEQ = null;
/* aplica os ganhos da partida, uma vez (a segunda chamada com o mesmo objeto devolve o mesmo resultado) */
function credita(o) { if (o && o._pat) return o._pat; const g = guarda(); const s = P().load(); const fato = fatoDe(o);
  let sq = null; if (fato && fato.desafio && fato.desafio.n > 0) { sq = seqAnda(g.seq, fato.desafio.n); if (!sq.contou && ULT_SEQ && ULT_SEQ.n === fato.desafio.n) sq = ULT_SEQ.r; /* o src/desafio.js já andou a sequência deste dia */ }
  const antes = resumo(g); const lin = calcula(fato, g, s, hojeN()); const total = Math.max(0, soma(lin)); g.xp = int(g.xp + total, 16777215);
  let subiuAfinidade = null; for (const l of lin) if (l.raca && RACAS.includes(l.raca) && l.raca !== fato.raca) g.afin[l.raca] = int((g.afin[l.raca] || 0) + l.xp, 1048575); /* a missão conta para a Raça que a venceu */
  if (fato && fato.raca && total > 0) { const r = fato.raca; const meu = soma(lin.filter(l => !l.raca || l.raca === r)); const a0 = afinidadeDe(g.afin[r] || 0).degrau; g.afin[r] = int((g.afin[r] || 0) + Math.max(0, meu), 1048575); const a1 = afinidadeDe(g.afin[r]).degrau; if (a1 > a0) subiuAfinidade = { raca: r, de: a0, para: a1 }; }
  const depois = resumo(g); salva();
  const out = { ganhos: lin, total, antes, depois, subiu: depois.degrau > antes.degrau || depois.estrelas > antes.estrelas ? { de: antes, para: depois, patente: depois.ordem > antes.ordem, estrela: depois.estrelas > antes.estrelas } : null, subiuAfinidade,
    marcos: lin.filter(l => l.motivo === 'marco').map(l => l.ref), escudo: { usou: !!(sq && sq.usouEscudo), tem: g.seq.escudo, zerou: !!(sq && sq.zerou && sq.antes > 1) }, fato };
  if (o) { try { o._pat = out; o.patentes = out; } catch (e) {} } ULT = out;
  try { if (typeof window !== 'undefined' && typeof CustomEvent === 'function') window.dispatchEvent(new CustomEvent('ard-patente', { detail: out })); } catch (e) {}
  return out; }

/* ---------- sequência do Desafio do Dia, com escudo ----------
   Conta dias jogados (o dia do desafio, em UTC). Um escudo por semana (a semana vira na segunda), guardando no máximo um. Um dia perdido
   gasta o escudo sozinho e a sequência continua; sem escudo, ou com dois dias perdidos, a sequência recomeça. O dia só anda para a frente:
   o mesmo dia, ou um dia anterior (relógio do aparelho para trás), não conta de novo. */
function concede(q, n) { const sem = semanaDe(n); if (sem > q.sem) { q.sem = sem; q.escudo = 1; return true; } return false; }
function seqAnda(q, n) { const out = { dias: q.dias, antes: q.dias, contou: false, usouEscudo: false, zerou: false, marcos: [] }; n = int(n, 65535); if (!n || n <= q.ult) return out;
  if (q.ult) { const falta = n - q.ult - 1; /* dias perdidos entre o último jogado e hoje */
    if (falta === 1) { concede(q, q.ult + 1); if (q.escudo) { q.escudo = 0; out.usouEscudo = true; } else { q.dias = 0; out.zerou = true; } }
    else if (falta >= 2) { q.dias = 0; out.zerou = true; } }
  concede(q, n); q.dias = Math.min(1023, q.dias + 1); q.ult = n; q.melhor = Math.max(q.melhor, q.dias); out.dias = q.dias; out.contou = true;
  if (MARCOS.includes(q.dias) && !q.marcos.includes(q.dias)) { q.marcos.push(q.dias); q.pend.push(q.dias); out.marcos.push(q.dias); }
  if (q.dias >= 60 && q.dias % 30 === 0 && q.dias > q.ciclo) { q.ciclo = q.dias; q.pend.push(q.dias); out.marcos.push(q.dias); }
  return out; }
/* a sequência que ainda vale no dia n (para a tela): os dias, se o escudo está guardado e se hoje ainda falta jogar */
function seqEm(q, n) { n = int(n, 65535); const c = copia(q); let dias = c.dias, usaria = false; if (!c.ult) dias = 0; else if (n > c.ult) { const falta = n - c.ult - 1; if (falta === 1) { concede(c, c.ult + 1); if (c.escudo) { c.escudo = 0; usaria = true; } else dias = 0; } else if (falta >= 2) dias = 0; }
  if (n > 0) concede(c, n); return { dias, escudo: c.escudo, jogouHoje: !!c.ult && n <= c.ult, usaria }; }
/* chamado pelo src/desafio.js na primeira partida de cada dia do desafio: anda a sequência e devolve os dias (com a regra do escudo) */
function seqJoga(data) { const n = diaNum(data); if (!(n === n)) return null; const g = guarda(); const r = seqAnda(g.seq, n); if (r.contou) { ULT_SEQ = { n, r }; salva(); } return r; }
function seqViva(data) { const n = diaNum(data); const g = guarda(); return seqEm(g.seq, n === n ? n : hojeN()).dias; }

/* ---------- o estado para as telas (a forma do contrato) ---------- */
function estado() { const g = guarda(); const d = deXp(g.xp); const af = {}; for (const r of RACAS) { const a = afinidadeDe(g.afin[r] || 0); af[r] = { xp: a.xp, degrau: a.degrau, falta: a.falta, de: a.de, ate: a.ate }; }
  const hoje = Math.max(hojeN(), g.dia.n); const sv = seqEm(g.seq, hoje);
  return { xp: g.xp, patente: { id: d.id, ordem: d.ordem, nivel: d.nivel }, prox: { falta: d.falta, de: d.de, ate: d.ate }, estrelas: d.estrelas, degrau: d.degrau, afinidade: af,
    sequencia: { dias: sv.dias, escudo: sv.escudo, marcos: g.seq.marcos.slice(), melhor: g.seq.melhor, jogouHoje: sv.jogouHoje, proximoMarco: MARCOS.find(m => m > sv.dias) || (Math.floor(sv.dias / 30) + 1) * 30 },
    historico: g.hist ? { xp: g.hist.xp, visto: !!g.hist.visto } : null, partidasHoje: g.dia.n === hoje ? g.dia.p : 0 }; }
/* o aviso "Seu histórico valeu N Centelhas": devolve o texto uma vez (e marca como visto); depois, null */
function historico(marcar) { const g = guarda(); if (!g.hist || g.hist.visto || !(g.hist.xp > 0)) return null; if (marcar !== false) { g.hist.visto = true; salva(); } return { xp: g.hist.xp, patente: deXp(g.hist.xp), texto: T('patente.historico', { n: g.hist.xp }, 'Seu histórico valeu {n} {moeda}.') }; }

/* ---------- cosméticos por afinidade e por marco de sequência (entradas de dados no src/cosmeticos.js) ---------- */
function cumpre(it, s) { if (!it) return false; const g = s && s.patentes && typeof s.patentes === 'object' ? s.patentes : null; if (!g) return false;
  if (it.afinidade) return !!it.raca && afinidadeDe((g.afin && g.afin[it.raca]) || 0).degrau >= it.afinidade; if (it.sequencia) return !!(g.seq && Array.isArray(g.seq.marcos) && g.seq.marcos.includes(it.sequencia)); return false; }
function comoGanha(it) { if (!it) return ''; if (it.afinidade) { const d = ARD.i18n && ARD.i18n.d; let r = it.raca; try { if (d && d.raca) r = d.raca(it.raca); } catch (e) {} return T('cosm.afinidade', { n: it.afinidade, raca: r }, 'Afinidade {n} com {raca}'); }
  if (it.sequencia) return T('cosm.sequencia', { n: it.sequencia }, 'Sequência de {n} dias no Desafio do Dia'); return ''; }

/* ---------- código de comandante ----------
   Leva patente e Centelhas, a afinidade das cinco Raças, a sequência (dias, melhor, último dia, escudo) e os cosméticos liberados, num
   texto curto: a letra C, a versão do formato, os campos em bits (de 5 em 5, no mesmo alfabeto do código de desafio, sem I, L, O e U) e
   10 bits de verificação no fim. ler() nunca lança erro. O backup inteiro (ARD1-…, src/progress.js) continua sendo o único backup de
   tudo e já leva este campo; o código de comandante é só o resumo para levar a patente a outro aparelho. */
const ALFA = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
function limpa(txt) { let s = String(txt == null ? '' : txt).trim(); const m = /[?&]comandante=([^&#\s]+)/i.exec(s); if (m) { try { s = decodeURIComponent(m[1]); } catch (e) { s = m[1]; } } return s.toUpperCase().replace(/O/g, '0').replace(/[IL]/g, '1').replace(/[^0-9A-Z]/g, ''); }
function mistura(v) { v = v >>> 0; v ^= v >>> 16; v = Math.imul(v, 0x7feb352d) >>> 0; v ^= v >>> 15; v = Math.imul(v, 0x846ca68b) >>> 0; v ^= v >>> 16; return v >>> 0; }
function verifica(versao, bits) { let h = 2166136261 >>> 0; const mix = v => { h ^= v; h = Math.imul(h, 16777619) >>> 0; }; mix(versao + 131); for (let i = 0; i < bits.length; i++) mix(bits[i] + 1 + (i % 11)); h = mistura(h); return (h ^ (h >>> 10) ^ (h >>> 20)) & 1023; }
const CAMPOS = [['xp', 24]].concat(RACAS.map(r => ['a.' + r, 20]), [['dias', 10], ['melhor', 10], ['ult', 16], ['escudo', 1], ['sem', 13]]);
function dadosAgora() { const g = guarda(); const s = P().load(); const C = ARD.cosmeticos; const cosm = BITS.filter(id => (s.cosm && s.cosm[id]) || (C && C.porId && C.porId(id) && C.tem(id, s)));
  const afin = {}; for (const r of RACAS) afin[r] = int(g.afin[r], 1048575); return { xp: g.xp, afin, seq: { dias: g.seq.dias, melhor: g.seq.melhor, ult: g.seq.ult, escudo: g.seq.escudo, sem: g.seq.sem }, cosm }; }
function normal(d) { if (!d || typeof d !== 'object') return null; const sq = d.seq || {}; const afin = {}; for (const r of RACAS) afin[r] = int(d.afin && d.afin[r], 1048575);
  const dias = int(sq.dias, 1023); return { xp: int(d.xp, 16777215), afin, seq: { dias, melhor: Math.max(int(sq.melhor, 1023), dias), ult: int(sq.ult, 65535), escudo: sq.escudo ? 1 : 0, sem: Math.max(-1, Math.min(8190, Math.floor(+sq.sem === +sq.sem ? +sq.sem : -1))) }, cosm: BITS.filter(id => Array.isArray(d.cosm) && d.cosm.includes(id)) }; }
function monta(d) { d = normal(d); if (!d) return null; const b = []; const poe = (v, n) => { for (let i = n - 1; i >= 0; i--) b.push(Math.floor(v / Math.pow(2, i)) % 2); };
  const val = { xp: d.xp, dias: d.seq.dias, melhor: d.seq.melhor, ult: d.seq.ult, escudo: d.seq.escudo, sem: d.seq.sem + 1 }; for (const r of RACAS) val['a.' + r] = d.afin[r];
  for (const [k, n] of CAMPOS) poe(val[k], n); let nb = 0; BITS.forEach((id, i) => { if (d.cosm.includes(id)) nb = i + 1; }); poe(nb, 6); for (let i = 0; i < nb; i++) b.push(d.cosm.includes(BITS[i]) ? 1 : 0);
  while (b.length % 5) b.push(0); const cs = verifica(FORMATO, b); let out = 'C' + ALFA[FORMATO]; for (let i = 0; i < b.length; i += 5) out += ALFA[b[i] * 16 + b[i + 1] * 8 + b[i + 2] * 4 + b[i + 3] * 2 + b[i + 4]]; return out + ALFA[cs >> 5] + ALFA[cs & 31]; }
function codigo() { return monta(dadosAgora()); }
function bonito(cod) { return limpa(cod).replace(/(.{4})(?=.)/g, '$1-'); }
/* o link que abre o jogo já pedindo para restaurar (a confirmação vem antes de qualquer mudança) */
function link(cod) { let base = ''; try { base = location.href.split(/[?#]/)[0]; } catch (e) {} return base + '?comandante=' + (cod || codigo()); }
function parece(txt) { const s = limpa(txt); return /^C[0-9A-Z]{12,}$/.test(s) && !/^ARD1/i.test(String(txt || '').trim()); }
/* erros: 'vazio' | 'formato' (não parece um código de comandante) | 'versao' (feito por uma versão mais nova do jogo) | 'soma' (digitado errado ou cortado) | 'conteudo' */
function decodifica(txt) { try { const s = limpa(txt); if (!s) return { ok: false, erro: 'vazio' }; if (s.length > 120 || s.length < 14 || s[0] !== 'C') return { ok: false, erro: 'formato' };
    const ver = ALFA.indexOf(s[1]); if (ver < 1) return { ok: false, erro: 'formato' }; const b = []; for (let i = 2; i < s.length; i++) { const v = ALFA.indexOf(s[i]); if (v < 0) return { ok: false, erro: 'formato' }; for (let k = 4; k >= 0; k--) b.push((v >> k) & 1); }
    const cs = b.splice(b.length - 10, 10).reduce((a, x) => a * 2 + x, 0); if (verifica(ver, b) !== cs) return { ok: false, erro: ver > FORMATO ? 'formato' : 'soma' }; if (ver > FORMATO) return { ok: false, erro: 'versao' };
    let p = 0, falta = false; const le = n => { let v = 0; for (let i = 0; i < n; i++) { if (p >= b.length) { falta = true; return 0; } v = v * 2 + b[p++]; } return v; }; const val = {}; for (const [k, n] of CAMPOS) val[k] = le(n);
    const nb = le(6); const cosm = []; for (let i = 0; i < nb; i++) { const x = le(1); if (x && i < BITS.length) cosm.push(BITS[i]); } if (falta || b.length - p >= 5 || b.slice(p).some(x => x)) return { ok: false, erro: 'conteudo' };
    const afin = {}; for (const r of RACAS) afin[r] = val['a.' + r]; const d = { xp: val.xp, afin, seq: { dias: val.dias, melhor: val.melhor, ult: val.ult, escudo: val.escudo, sem: val.sem - 1 }, cosm };
    if (nb > BITS.length || val.melhor < val.dias || monta(d) !== s) return { ok: false, erro: 'conteudo' }; /* um código só tem uma forma */
    return { ok: true, dados: normal(d), codigo: s }; } catch (e) { return { ok: false, erro: 'formato' }; } }
/* o que se perderia ao trocar o que está no aparelho pelo que o código traz (lista vazia = não rebaixa nada) */
function perdas(aqui, la) { const out = []; if (la.xp < aqui.xp) out.push({ campo: 'xp', aqui: aqui.xp, la: la.xp }); for (const r of RACAS) if (la.afin[r] < aqui.afin[r]) out.push({ campo: 'afinidade', raca: r, aqui: aqui.afin[r], la: la.afin[r] });
  if (la.seq.dias < aqui.seq.dias && !(la.seq.ult > aqui.seq.ult)) out.push({ campo: 'sequencia', aqui: aqui.seq.dias, la: la.seq.dias }); if (la.seq.melhor < aqui.seq.melhor) out.push({ campo: 'melhor', aqui: aqui.seq.melhor, la: la.seq.melhor }); return out; }
function erroTxt(e) { return T('patente.codigo.erro.' + e, null, { vazio: 'Cole o código de comandante.', formato: 'Isto não parece um código de comandante.', versao: 'Este código foi feito por uma versão mais nova do jogo. Atualize o jogo e tente de novo.', soma: 'O código não confere: falta um pedaço ou há uma letra trocada. Copie de novo, inteiro.', conteudo: 'Este código não pôde ser lido por esta versão do jogo.' }[e] || 'Código inválido.'); }
/* lê sem mudar nada: o que o código traz, a patente dele e o que se perderia */
function ler(cod) { const r = decodifica(cod); if (!r.ok) return { ok: false, erro: r.erro, texto: erroTxt(r.erro) }; const aqui = normal(dadosAgora()); const perde = perdas(aqui, r.dados);
  return { ok: true, codigo: r.codigo, dados: r.dados, patente: deXp(r.dados.xp), atual: deXp(aqui.xp), xpAtual: aqui.xp, rebaixa: perde.length > 0, perde, igual: monta(aqui) === r.codigo }; }
/* restaura. Sem { confirmado: true } nada muda (devolve precisa: 'confirmar'); se o código rebaixa alguma coisa, só com { rebaixar: true }
   (devolve precisa: 'rebaixar' e a lista do que se perderia). Cosméticos só entram, nunca saem. O livro do que já foi pago fica como está. */
function restaurar(cod, op) { const r = ler(cod); if (!r.ok) return r; op = op || {}; if (!op.confirmado) return Object.assign({}, r, { ok: false, precisa: 'confirmar' }); if (r.rebaixa && !op.rebaixar) return Object.assign({}, r, { ok: false, precisa: 'rebaixar' });
  const g = guarda(); const antes = resumo(g); const d = r.dados; g.xp = d.xp; for (const k of RACAS) g.afin[k] = d.afin[k];
  const q = g.seq; q.dias = d.seq.dias; q.melhor = d.seq.melhor; q.ult = d.seq.ult; q.escudo = d.seq.escudo; q.sem = d.seq.sem; q.pend = []; for (const m of MARCOS) if (q.melhor >= m && !q.marcos.includes(m)) q.marcos.push(m); q.ciclo = Math.max(q.ciclo, q.melhor >= 60 ? Math.floor(q.melhor / 30) * 30 : 0);
  g.livro.desN = Math.max(g.livro.desN, q.ult); if (g.hist) g.hist.visto = true; const novos = []; const PS = P(); for (const id of d.cosm) if (PS.cosmLibera && PS.cosmLibera(id)) novos.push(id); salva();
  return { ok: true, antes, depois: resumo(g), cosm: novos, rebaixou: r.rebaixa, perde: r.perde }; }

/* ---------- textos prontos (as telas são do outro arquivo; isto é só para ninguém repetir a montagem) ---------- */
function motivoTxt(l) { if (!l) return ''; const C = ARD.campaign, d = ARD.i18n && ARD.i18n.d; const seg = f => { try { return f(); } catch (e) { return null; } };
  const v = { n: l.n != null ? l.n : l.ref, ref: l.ref };
  if (l.motivo === 'partida') return T('patente.motivo.partida.' + l.modo, v, 'Partida terminada');
  if (l.motivo === 'dificuldade') v.dif = seg(() => (l.dif === 'fenda' ? C.dificuldade('fenda') : d.dificuldade(l.dif))) || l.dif;
  if (l.motivo === 'missao' || l.motivo === 'estrelas') v.nome = seg(() => C.titulo(C.BY_ID[l.ref])) || l.ref;
  if (l.motivo === 'conquista') v.nome = seg(() => C.conquista(l.ref)) || l.ref;
  if (l.motivo === 'medalha') v.nome = seg(() => T('modos.medalha.' + l.medalha, null, l.medalha)) || l.medalha;
  if (l.motivo === 'sem-ganho') return T('patente.sem-ganho.' + l.porque, v, 'Esta partida não rendeu {moeda}.');
  if (l.motivo === 'marco' && !TABELA.marco[l.ref]) return T('patente.motivo.marco-ciclo', v, 'Sequência de {n} dias');
  return T('patente.motivo.' + l.motivo, v, l.motivo); }

/* ---------- o mínimo de interface (só no navegador) ---------- */
function confirma(texto, sim) { const m = document.getElementById('confirm'), tx = document.getElementById('confirm-text'), y = document.getElementById('confirm-yes'), nn = document.getElementById('confirm-no');
  if (!m || !tx || !y || !nn) { if (typeof window.confirm === 'function' && window.confirm(texto)) sim(); return; } m.hidden = false; tx.textContent = texto; y.onclick = () => { m.hidden = true; sim(); }; nn.onclick = () => { m.hidden = true; }; }
function aviso(texto, ms) { let el = document.getElementById('pat-aviso'); if (!el) { el = document.createElement('div'); el.id = 'pat-aviso'; el.setAttribute('role', 'status'); el.style.cssText = 'position:fixed;left:50%;bottom:max(18px,env(safe-area-inset-bottom));transform:translateX(-50%);z-index:60;max-width:min(92vw,560px);padding:10px 16px;border-radius:10px;background:#12151A;color:#F2F4F7;border:1px solid #FF8A3D;font:600 14px/1.35 system-ui,sans-serif;text-align:center;box-shadow:0 6px 24px rgba(0,0,0,.5);pointer-events:none'; document.body.appendChild(el); } /* não recebe toque: nunca fica na frente de um botão */
  el.textContent = texto; el.hidden = false; clearTimeout(el.__t); el.__t = setTimeout(() => { el.hidden = true; }, ms || 9000); return el; }
/* o pedido de restauração, com as duas confirmações (a segunda só quando o código rebaixa alguma coisa). fim(resultado) é opcional. */
function pedeRestaurar(cod, fim) { const r = ler(cod); const feito = x => { if (fim) fim(x); return x; }; if (!r.ok) { aviso(r.texto); return feito(r); }
  if (r.igual) { aviso(T('patente.codigo.igual', null, 'Este código é igual ao que já está neste aparelho.')); return feito(r); }
  const aplica = rebaixar => { const x = restaurar(cod, { confirmado: true, rebaixar }); if (x.ok) { aviso(T('patente.codigo.feito', { patente: nome(x.depois), n: x.depois.xp }, 'Código restaurado: {patente}, {n} {moeda}.')); try { window.dispatchEvent(new CustomEvent('ard-patente', { detail: { restaurado: x } })); } catch (e) {} } feito(x); };
  confirma(T('patente.codigo.confirma', { patente: nome(r.patente), n: r.dados.xp }, 'Restaurar este código de comandante? Este aparelho passa a {patente}, com {n} {moeda}.'), () => {
    if (!r.rebaixa) return aplica(false);
    setTimeout(() => confirma(T('patente.codigo.rebaixa', { aqui: nome(r.atual), n: r.xpAtual, la: nome(r.patente), m: r.dados.xp }, 'Atenção: o código traz menos do que este aparelho já tem. Aqui: {aqui}, {n} {moeda}. No código: {la}, {m}. Restaurar mesmo assim e ficar com o que o código traz?'), () => aplica(true)), 0); });
  return r; }
/* o backup inteiro (ARD1-…) também pode rebaixar: espia a patente que ele traz, sem aplicar */
function espiaBackup(txt) { try { const m = /^ARD1-([0-9a-z]+)-([A-Za-z0-9+/=]+)$/.exec(String(txt || '').trim()); if (!m) return null; const json = typeof atob !== 'undefined' ? decodeURIComponent(escape(atob(m[2]))) : Buffer.from(m[2], 'base64').toString('utf8'); const s = JSON.parse(json); return { xp: int(s && s.patentes && s.patentes.xp, 16777215) }; } catch (e) { return null; } }
function montar() { if (typeof document === 'undefined') return;
  /* a caixa de backup que já existe (janela da Campanha) aceita também o código de comandante, e o backup inteiro avisa antes de rebaixar a patente */
  const bi = document.getElementById('camp-import'), ta = document.getElementById('camp-code'); if (bi && ta && !bi.__pat) { bi.__pat = true; bi.addEventListener('click', ev => { if (ta.hidden || !ta.value.trim()) return; const txt = ta.value;
    if (parece(txt)) { ev.stopImmediatePropagation(); ev.preventDefault(); pedeRestaurar(txt, x => { if (x && x.ok) ta.value = ''; }); return; }
    if (bi.__patOk) { bi.__patOk = false; return; } const b = espiaBackup(txt); const g = guarda(); if (b && b.xp < g.xp) { ev.stopImmediatePropagation(); ev.preventDefault();
      confirma(T('patente.codigo.backup-rebaixa', { aqui: nome(deXp(g.xp)), n: g.xp, la: nome(deXp(b.xp)), m: b.xp }, 'Atenção: este backup traz menos do que este aparelho já tem. Aqui: {aqui}, {n} {moeda}. No backup: {la}, {m}. Importar mesmo assim?'), () => { bi.__patOk = true; bi.click(); }); } }, true); }
  /* ?comandante=CÓDIGO: pede a confirmação e tira o código do endereço (recarregar não pergunta de novo) */
  try { const u = new URLSearchParams(location.search); const c = u.get('comandante'); if (c) { u.delete('comandante'); const r = u.toString(); history.replaceState(null, '', location.pathname + (r ? '?' + r : '')); setTimeout(() => pedeRestaurar(c), 600); } } catch (e) {}
  /* quem já jogava: o aviso do histórico, uma vez, na tela inicial (fora de partidas abertas direto pelo endereço) */
  try { if (!/[?&](autostart|bench|missao|guia|desafio|degrau|retomar|sala|comandante)=/.test(location.search)) setTimeout(() => { try { if (document.body.classList.contains('ingame')) return; const h = historico(true); if (h) aviso(h.texto, 12000); } catch (e) {} }, 1800); } catch (e) {} }

ARD.patentes = { V, FORMATO, PATENTES, NIVEIS, DEGRAUS, RACAS, TABELA, LIMIAR, TOPO, ESTRELA, AFINIDADE, MARCOS, BITS, ROMANO,
  estado, ganhos, credita, deXp, codigo, ler, restaurar,
  afinidadeDe, nome, moeda, motivoTxt, erroTxt, fatoDe, historico, seqJoga, seqViva, cumpre, comoGanha, bonito, link, parece, pedeRestaurar, montar,
  get ultimo() { return ULT; }, _relogio(f) { relogio = typeof f === 'function' ? f : () => Date.now(); }, _monta: monta, _calcula: calcula, _seqAnda: seqAnda, _seqEm: seqEm, _novo: novo };
if (typeof document !== 'undefined') { try { guarda(); } catch (e) {} if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montar); else montar(); }
})(globalThis.ARD = globalThis.ARD || {});
