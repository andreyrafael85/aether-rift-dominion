/* Aether Rift: Dominion — 5.5b: Desafio do Dia e código de desafio por link (a parte pura: sem DOM, roda no Node para os testes).
   Uma "receita" diz tudo o que faz duas pessoas jogarem a MESMA partida: modo, mapa, semente, Raça sugerida (ou livre), as Raças da IA,
   dificuldade, chefão, mutadores e as regras da Escaramuça (Eventos da Fenda, Mundo vivo, comandantes).
   - receitaDoDia(data): a receita sai só da data em UTC ('AAAA-MM-DD'), por contas com inteiros; sem Math.random e sem Date aqui dentro.
     Quem lê o relógio é a interface (src/desafio-ui.js), que passa a data pronta.
   - codigo(receita) / ler(texto): o código curto do link (?desafio=CÓDIGO), com versão do formato no primeiro caractere e 10 bits de
     verificação no fim. ler() nunca lança erro: devolve { ok: false, erro } para a interface mostrar um aviso.
   - jogadores / cfgJogo / simCfg: a partida montada pela receita, do mesmo jeito no jogo e nos testes (tools/desafio-test.cjs).
   - registrar / estado: recorde do dia e sequência de dias jogados, guardados no aparelho pelo ProgressStore (campo "desafio").
   Nada aqui muda a simulação: só combina chaves de cfg que já existem (blitz, cacada, mutadores, eventos, mundo, comandantes). */
(function (ARD) {
'use strict';
const FORMATO = 1;                                   /* versão do formato do código (primeiro caractere) */
const RACAS = ['vehnar', 'erevane', 'tessara', 'quorith', 'vorag'];
const MODOS = ['escaramuca', 'blitz', 'cacada'];
const MAPAS = ['fenda', 'cinturao', 'tita'];
const DIFS = ['facil', 'normal', 'dificil', 'brutal'];
const CHEFES = ['arauto', 'forja'];
const MUTS = ['noite', 'tempestades', 'escassos'];
const MUNDO = ['fauna', 'ruinas', 'corsarios', 'surto'];
const ARENA = { arauto: 'fenda', forja: 'tita' };    /* a arena de cada chefão (a mesma de ARD.modos.CACADA) */
const BLITZ_MIN = 10;
const SEED_MAX = 4294967295;
const LINK_NA_LINHA = false;                         /* o resultado em uma linha NÃO leva o endereço do jogo até o lançamento; ligar aqui quando o dono decidir */
/* os mesmos nomes de IA do src/main.js (startGame), para o dicionário traduzir como nas outras partidas */
const NOMES_IA = { vehnar: ['Fundição Kessari', 'Consórcio Oryn', 'Estaleiro Vey'], erevane: ['Clã Sombrio', 'Náufragos de Ísk', 'Corsários da Faixa'], tessara: ['Linhagem Oriel', 'Ordem do Molde', 'Enxerto Vassi'], quorith: ['Coro de Zayin', 'Acorde Sétimo', 'Silêncio de Quor'], vorag: ['Prole Velk', 'Ninhada Cega', 'Fome de Oru'] };

/* ---------- datas (só contas; 'AAAA-MM-DD' em UTC) ---------- */
function dataValida(s) { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || '')); if (!m) return null; const a = +m[1], me = +m[2], d = +m[3]; if (a < 2000 || a > 2999 || me < 1 || me > 12 || d < 1) return null; const dm = [31, (a % 4 === 0 && a % 100 !== 0) || a % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][me - 1]; if (d > dm) return null; return { a, m: me, d }; }
/* número do dia (dias desde 1970-01-01), pelo algoritmo civil de calendário: inteiro, igual em todo lugar */
function diaNum(s) { const p = dataValida(s); if (!p) return NaN; const y = p.m <= 2 ? p.a - 1 : p.a; const era = Math.floor(y / 400); const yoe = y - era * 400; const mp = (p.m + 9) % 12; const doy = Math.floor((153 * mp + 2) / 5) + p.d - 1; const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy; return era * 146097 + doe - 719468; }
function dataDe(n) { const z = n + 719468; const era = Math.floor(z / 146097); const doe = z - era * 146097; const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365); const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100)); const mp = Math.floor((5 * doy + 2) / 153); const d = doy - Math.floor((153 * mp + 2) / 5) + 1; const m = mp < 10 ? mp + 3 : mp - 9; const y = yoe + era * 400 + (m <= 2 ? 1 : 0);
  return String(y).padStart(4, '0') + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0'); }
/* a data em UTC de um instante (ms desde 1970) e quanto falta para a virada do dia; a interface passa Date.now() */
function dataUTC(ms) { return dataDe(Math.floor(ms / 86400000)); }
function faltaMs(ms) { return 86400000 - (ms - Math.floor(ms / 86400000) * 86400000); }
function diaSemana(n) { return ((n + 3) % 7 + 7) % 7; } /* 0 = segunda … 6 = domingo (1970-01-01 foi quinta) */

/* ---------- sorteio com inteiros (igual em todo motor JS) ---------- */
function mistura(v) { v = v >>> 0; v ^= v >>> 16; v = Math.imul(v, 0x7feb352d) >>> 0; v ^= v >>> 15; v = Math.imul(v, 0x846ca68b) >>> 0; v ^= v >>> 16; return v >>> 0; }
function sorte(n, sal) { return mistura((n * 2654435761 + sal * 40503 + 0x9e3779b9) >>> 0); }

/* ---------- a receita do dia ----------
   A semana tem desenho fixo, para variar de verdade e para ninguém cair numa combinação ruim:
     segunda  Blitz, Fácil                      (começo de semana leve)
     terça    Blitz, Normal, com um mutador
     quarta   Caçada, Fácil
     quinta   Blitz, Normal
     sexta    Blitz, Difícil
     sábado   Blitz, Normal, com um mutador, Raça livre
     domingo  Caçada, Fácil; em duas de cada quatro semanas, com um mutador
   Os cinco dias de Blitz da semana enfrentam as cinco Raças, uma vez cada, numa ordem que muda de semana para semana; os dois chefões
   da Caçada trocam de dia a cada semana; os mutadores rodam os três. Nunca sai Brutal, nunca dois mutadores, nunca Difícil com mutador;
   a Caçada do dia é sempre no Fácil (no jogo automático a Caçada é bem mais dura que o Blitz: ver o relatório da 5.5b).
   A Caçada do dia é sempre sozinho, sem IA aliada: hoje a IA 3.0 usa Math.hypot em três contas (src/ai.js), que dá resultados
   diferentes entre navegadores, e uma aliada deixaria o desafio diferente no Chrome e no Firefox ou Safari. Sem IA na partida
   (o chefão é da simulação), o desafio é o mesmo em todos. Com a correção proposta no relatório, a aliada pode voltar. */
const SEMANA = ['blitz', 'blitz', 'cacada', 'blitz', 'blitz', 'blitz', 'cacada'];
const BLITZ_POS = [0, 1, -1, 2, 3, 4, -1];           /* qual dos cinco Blitz da semana */
function receitaDoDia(data) { const n = diaNum(data); if (!(n === n)) return null; const ds = diaSemana(n); const sem = Math.floor((n + 3) / 7); const h = k => sorte(n, k); const hs = k => sorte(sem, 100 + k);
  const seed = 1000 + h(1) % 90000; const modo = SEMANA[ds]; const r = { v: FORMATO, modo, mapa: 'fenda', seed, raca: null, ias: [], dif: 'normal', chefe: null, mut: [], eventos: false, mundo: [], cmd: false };
  if (modo === 'blitz') { const ordem = RACAS.slice(); for (let i = 4; i > 0; i--) { const j = hs(i) % (i + 1); const t = ordem[i]; ordem[i] = ordem[j]; ordem[j] = t; } /* a ordem dos rivais desta semana */
    const rival = ordem[BLITZ_POS[ds]]; r.ias = [rival]; r.dif = ds === 0 ? 'facil' : ds === 4 ? 'dificil' : 'normal';
    if (ds === 1 || ds === 5) r.mut = [MUTS[(sem * 2 + (ds === 5 ? 1 : 0)) % 3]];
    if (ds !== 5) { const op = RACAS.filter(x => x !== rival); r.raca = op[h(2) % op.length]; } }
  else { r.chefe = CHEFES[(sem + (ds === 6 ? 1 : 0)) % 2]; r.mapa = ARENA[r.chefe]; r.raca = RACAS[h(2) % 5];
    r.dif = 'facil'; if (ds === 6 && (sem >> 1) % 2) r.mut = [MUTS[sem % 3]]; }
  return r; }
/* a regra de "justo" do Desafio do Dia (o teste confere em todos os dias de vários anos) */
function justa(r) { r = normaliza(r); if (!r) return false; if (r.modo !== 'blitz' && r.modo !== 'cacada') return false; if (r.dif === 'brutal') return false; if (r.mut.length > 1) return false; if (r.dif === 'dificil' && r.mut.length) return false;
  if (r.modo === 'cacada' && (r.ias.length > 0 || r.dif !== 'facil')) return false; if (r.eventos || r.mundo.length || r.cmd) return false; return true; }

/* ---------- receita limpa e validada (a mesma regra para o dia, para o link e para a tela de montar) ---------- */
function normaliza(x) { if (!x || typeof x !== 'object') return null; const modo = MODOS.includes(x.modo) ? x.modo : null; if (!modo) return null;
  const seed = +x.seed; if (!(seed === Math.floor(seed)) || seed < 1 || seed > SEED_MAX) return null; /* a simulação trata a semente 0 como 1: fica de fora para cada partida ter um código só */
  const raca = x.raca == null || x.raca === '' ? null : x.raca; if (raca && !RACAS.includes(raca)) return null;
  const dif = DIFS.includes(x.dif) ? x.dif : null; if (!dif) return null;
  const ias = Array.isArray(x.ias) ? x.ias.slice() : []; if (ias.some(f => !RACAS.includes(f))) return null;
  const mut = MUTS.filter(k => Array.isArray(x.mut) && x.mut.includes(k)); if (Array.isArray(x.mut) && x.mut.some(k => !MUTS.includes(k))) return null;
  const mundo = MUNDO.filter(k => Array.isArray(x.mundo) && x.mundo.includes(k)); if (Array.isArray(x.mundo) && x.mundo.some(k => !MUNDO.includes(k))) return null;
  const r = { v: FORMATO, modo, mapa: 'fenda', seed, raca, ias, dif, chefe: null, mut, eventos: false, mundo: [], cmd: false };
  if (modo === 'blitz') { if (ias.length !== 1) return null; if (x.mapa != null && x.mapa !== 'fenda') return null; if (x.eventos || mundo.length || x.cmd || x.chefe) return null; } /* Blitz: só na Planície (é onde as bases perto foram feitas), 1 contra 1 */
  else if (modo === 'cacada') { if (!CHEFES.includes(x.chefe)) return null; if (ias.length > 2) return null; if (x.mapa != null && x.mapa !== ARENA[x.chefe]) return null; if (x.eventos || mundo.length) return null; r.chefe = x.chefe; r.mapa = ARENA[x.chefe]; r.cmd = !!x.cmd; }
  else { if (ias.length < 1 || ias.length > 3) return null; if (x.chefe) return null; r.mapa = MAPAS.includes(x.mapa) ? x.mapa : null; if (!r.mapa) return null; r.eventos = !!x.eventos; r.mundo = mundo; r.cmd = !!x.cmd; }
  return r; }
function iguais(a, b) { a = normaliza(a); b = normaliza(b); return !!a && !!b && JSON.stringify(a) === JSON.stringify(b); }

/* ---------- o código do link ----------
   Primeiro caractere: a versão do formato. Depois os campos em bits, de 5 em 5, num alfabeto de 32 símbolos sem letras que se confundem
   (sem I, L, O e U). Os dois últimos caracteres são 10 bits de verificação: um erro de digitação quase nunca passa.
   Este envelope (versão na frente, verificação no fim, feita do mesmo jeito) fica igual em todas as versões futuras do formato; só os
   campos do meio mudam. É o que deixa um jogo antigo dizer "este desafio é de uma versão mais nova" em vez de "código estragado". */
const ALFA = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
function limpa(txt) { return String(txt == null ? '' : txt).toUpperCase().replace(/O/g, '0').replace(/[IL]/g, '1').replace(/[^0-9A-Z]/g, ''); }
function soma(versao, bits) { let h = 2166136261 >>> 0; const mix = v => { h ^= v; h = Math.imul(h, 16777619) >>> 0; }; mix(versao + 77); for (let i = 0; i < bits.length; i++) mix(bits[i] + 1 + (i % 7)); h = mistura(h); return (h ^ (h >>> 10) ^ (h >>> 20)) & 1023; }
function codigo(rec) { const r = normaliza(rec); if (!r) return null; const b = []; const poe = (v, n) => { for (let i = n - 1; i >= 0; i--) b.push(Math.floor(v / Math.pow(2, i)) % 2); };
  poe(MODOS.indexOf(r.modo), 2); poe(MAPAS.indexOf(r.mapa), 2); const longa = r.seed >= 1048576; poe(longa ? 1 : 0, 1); poe(r.seed, longa ? 32 : 20);
  poe(r.raca ? RACAS.indexOf(r.raca) + 1 : 0, 3); poe(DIFS.indexOf(r.dif), 2); poe(r.ias.length, 2); for (const f of r.ias) poe(RACAS.indexOf(f), 3);
  poe(r.chefe ? CHEFES.indexOf(r.chefe) : 0, 1); poe(MUTS.reduce((s, k, i) => s + (r.mut.includes(k) ? 1 << i : 0), 0), 3); poe(r.eventos ? 1 : 0, 1); poe(MUNDO.reduce((s, k, i) => s + (r.mundo.includes(k) ? 1 << i : 0), 0), 4); poe(r.cmd ? 1 : 0, 1);
  while (b.length % 5) b.push(0); const cs = soma(FORMATO, b); let out = ALFA[FORMATO]; for (let i = 0; i < b.length; i += 5) out += ALFA[b[i] * 16 + b[i + 1] * 8 + b[i + 2] * 4 + b[i + 3] * 2 + b[i + 4]]; return out + ALFA[cs >> 5] + ALFA[cs & 31]; }
/* o código com um traço a cada quatro caracteres, para ler e ditar */
function bonito(cod) { const s = limpa(cod); return s.replace(/(.{4})(?=.)/g, '$1-'); }
/* erros: 'vazio' | 'formato' (não parece um código) | 'versao' (feito por uma versão mais nova do jogo) | 'soma' (digitado errado ou cortado) | 'conteudo' (combinação que este jogo não tem) */
function ler(txt) { try { const s = limpa(txt); if (!s) return { ok: false, erro: 'vazio' }; if (s.length > 40) return { ok: false, erro: 'formato' };
    const ver = ALFA.indexOf(s[0]); if (ver < 1) return { ok: false, erro: 'formato' };
    if (s.length < 10) return { ok: false, erro: 'formato' }; const b = []; for (let i = 1; i < s.length; i++) { const v = ALFA.indexOf(s[i]); if (v < 0) return { ok: false, erro: 'formato' }; for (let k = 4; k >= 0; k--) b.push((v >> k) & 1); }
    const cs = b.splice(b.length - 10, 10).reduce((a, x) => a * 2 + x, 0); if (soma(ver, b) !== cs) return { ok: false, erro: ver > FORMATO ? 'formato' : 'soma' };
    if (ver > FORMATO) return { ok: false, erro: 'versao' }; /* a verificação bateu e a versão é maior que a nossa: é um código de verdade, feito por um jogo mais novo */
    let p = 0, falta = false; const le = n => { let v = 0; for (let i = 0; i < n; i++) { if (p >= b.length) { falta = true; return 0; } v = v * 2 + b[p++]; } return v; };
    const modo = MODOS[le(2)], mapa = MAPAS[le(2)]; const longa = le(1); const seed = le(longa ? 32 : 20); const rc = le(3); const dif = DIFS[le(2)]; const n = le(2); const ias = []; for (let i = 0; i < n; i++) ias.push(RACAS[le(3)]);
    const ch = le(1), mu = le(3), ev = le(1), mw = le(4), cmd = le(1); if (falta || b.length - p >= 5 || b.slice(p).some(x => x)) return { ok: false, erro: 'conteudo' };
    if (rc > 5 || (longa && seed < 1048576)) return { ok: false, erro: 'conteudo' };
    const bruta = { modo, mapa, seed, raca: rc ? RACAS[rc - 1] : null, dif, ias, chefe: modo === 'cacada' ? CHEFES[ch] : null, mut: MUTS.filter((k, i) => mu & (1 << i)), eventos: !!ev, mundo: MUNDO.filter((k, i) => mw & (1 << i)), cmd: !!cmd };
    if (modo !== 'cacada' && ch) return { ok: false, erro: 'conteudo' };
    const r = normaliza(bruta); if (!r) return { ok: false, erro: 'conteudo' }; if (codigo(r) !== s) return { ok: false, erro: 'conteudo' }; /* um código só tem uma forma: o que não bate com a forma canônica não vale */
    return { ok: true, receita: r, codigo: s }; } catch (e) { return { ok: false, erro: 'formato' }; } }

/* ---------- a partida da receita ---------- */
/* os jogadores, sempre na mesma ordem: você (posição 0) e as IAs da receita. Na Caçada as IAs são aliadas. raca: a Raça de quem joga
   (a da receita é uma sugestão; sem nenhuma, Vehnar). */
function jogadores(rec, nome, raca) { const r = normaliza(rec); if (!r) return null; const fac = RACAS.includes(raca) ? raca : r.raca || 'vehnar';
  const ps = [{ name: nome || 'Comandante', faction: fac, human: true }]; r.ias.forEach((f, i) => ps.push({ name: NOMES_IA[f][i % 3], faction: f, difficulty: r.modo === 'cacada' ? 'normal' : r.dif }));
  if (r.modo === 'blitz' && ARD.modos && ARD.modos.blitzJogadores) ARD.modos.blitzJogadores(ps); return ps; }
/* a cfg que o startGame do jogo recebe (base: nome, gráficos, qualidade e clima da tela inicial) */
function cfgJogo(rec, base, raca, extra) { const r = normaliza(rec); if (!r) return null; const ps = jogadores(r, base && base.name, raca);
  const cfg = Object.assign({}, base || {}, { name: ps[0].name, faction: ps[0].faction, players: ps, seed: r.seed, map: r.mapa, mapV: 1, opp: String(r.ias.length), diff: r.modo === 'cacada' ? 'normal' : r.dif, mutadores: r.mut.slice() });
  if (r.modo === 'blitz') { cfg.blitz = true; cfg.minutes = BLITZ_MIN; }
  if (r.modo === 'cacada') cfg.cacada = { chefe: r.chefe, dif: r.dif };
  if (r.modo === 'escaramuca') { if (r.eventos) cfg.eventos = true; if (r.mundo.length) cfg.mundo = r.mundo.join(','); }
  if (r.cmd) cfg.comandantes = true;
  cfg.desafio = Object.assign({ codigo: codigo(r), receita: r }, extra || {}); return cfg; }
/* a cfg da simulação, montada como o startGame monta (para os testes jogarem a mesma partida fora do jogo) */
function simCfg(rec, raca) { const cfg = cfgJogo(rec, { name: 'Teste' }, raca); if (!cfg) return null; const o = {};
  if (ARD.modos) Object.assign(o, ARD.modos.cfgDe(cfg)); if (ARD.chefesSim) Object.assign(o, ARD.chefesSim.cfgDe(cfg)); if (ARD.mundo) Object.assign(o, ARD.mundo.cfgDe(cfg)); if (ARD.unicas) Object.assign(o, ARD.unicas.cfgDe(cfg));
  return Object.assign(o, { seed: cfg.seed, players: cfg.players, minutes: cfg.minutes || 25, map: cfg.map, mapV: 1, noVeins: false }); }
/* a receita de uma partida que existe (para o "Desafiar um amigo" da tela final). Devolve null quando a partida não cabe num código:
   campanha, partida guiada, multiplayer, teste de desempenho, chaves de teste, dificuldades misturadas. */
function deSim(sim, human) { try { const c = sim && sim.cfg; if (!c || human !== 0) return null; if (c.campanha || c.guia || c.noVeins || c.chefe || c.eventosTeste || c.unicasTeste || c.cmdNivel != null || c.iaPerfil) return null;
    const ps = (sim.players || []).filter(p => !p.fenda && p.id !== sim.mundo); if (!ps.length || !ps[0].human || ps.slice(1).some(p => p.human)) return null; const pc = c.players || [];
    const cac = c.cacada && CHEFES.includes(c.cacada.chefe) ? c.cacada : null; const ias = ps.slice(1).map(p => p.faction);
    const difs = ps.slice(1).map((p, i) => (pc[i + 1] && pc[i + 1].difficulty) || p.difficulty || 'normal'); if (!cac && difs.some(d => d !== difs[0])) return null;
    const mw = c.mundo && typeof c.mundo === 'object' ? MUNDO.filter(k => c.mundo[k]) : typeof c.mundo === 'string' ? MUNDO.filter(k => c.mundo.split(',').includes(k)) : c.mundo ? MUNDO.slice() : [];
    return normaliza({ modo: cac ? 'cacada' : c.blitz ? 'blitz' : 'escaramuca', mapa: (sim.map && sim.map.type) || c.map || 'fenda', seed: sim.seed != null ? sim.seed : c.seed, raca: ps[0].faction, ias, dif: cac ? cac.dif : difs[0] || 'normal', chefe: cac ? cac.chefe : null,
      mut: Array.isArray(c.mutadores) ? c.mutadores : [], eventos: !!c.eventos, mundo: cac ? [] : mw, cmd: !!c.comandantes }); } catch (e) { return null; } }

/* ---------- resultado, recorde do dia e sequência (no aparelho, pelo ProgressStore) ---------- */
/* res: { venceu, tempo (s), dominio, perdas, medalha, raca }. Melhor: vencer; entre vitórias, a mais rápida; entre derrotas, a que
   durou mais; no empate, mais Domínio (no Blitz) ou menos perdas (na Caçada). */
function melhor(a, b) { if (!b) return true; if (!a) return false; if (!!a.venceu !== !!b.venceu) return !!a.venceu; if (a.tempo !== b.tempo) return a.venceu ? a.tempo < b.tempo : a.tempo > b.tempo; if ((a.dominio || 0) !== (b.dominio || 0)) return (a.dominio || 0) > (b.dominio || 0); return (a.perdas || 0) < (b.perdas || 0); }
function guardado() { const P = ARD.progress; if (!P) return null; const s = P.load(); if (!s.desafio || typeof s.desafio !== 'object' || s.desafio.v !== 1) s.desafio = { v: 1, dias: {}, seq: 0, melhorSeq: 0, ultimo: null, jogados: 0, vitorias: 0 }; if (!s.desafio.dias || typeof s.desafio.dias !== 'object') s.desafio.dias = {}; return s.desafio; }
function registrar(data, res) { const D = guardado(); const n = diaNum(data); if (!D || !(n === n) || !res) return null; const antes = D.dias[data] || null;
  const novo = { venceu: !!res.venceu, tempo: Math.max(0, Math.round(res.tempo || 0)), dominio: Math.max(0, Math.round(res.dominio || 0)), perdas: Math.max(0, Math.round(res.perdas || 0)), medalha: res.medalha || null, raca: RACAS.includes(res.raca) ? res.raca : null };
  const recorde = melhor(novo, antes && antes.rec); const dia = { n: (antes ? antes.n : 0) + 1, rec: recorde ? novo : antes.rec };
  let primeiraDoDia = !antes;
  if (primeiraDoDia) { const u = D.ultimo ? diaNum(D.ultimo) : NaN; if (u === n - 1) D.seq = (D.seq || 0) + 1; else if (!(u === n)) D.seq = u > n ? D.seq || 1 : 1; if (!(u > n)) D.ultimo = data; D.melhorSeq = Math.max(D.melhorSeq || 0, D.seq); D.jogados = (D.jogados || 0) + 1; }
  if (novo.venceu && !(antes && antes.rec && antes.rec.venceu)) D.vitorias = (D.vitorias || 0) + 1;
  D.dias[data] = dia; const ch = Object.keys(D.dias).sort(); while (ch.length > 60) delete D.dias[ch.shift()]; /* guarda os últimos 60 dias jogados */
  try { ARD.progress.save(); } catch (e) {}
  return { recorde, primeiraDoDia, rec: dia.rec, jogadasHoje: dia.n, seq: D.seq, melhorSeq: D.melhorSeq }; }
/* o que a tela mostra: o recorde do dia, quantas vezes jogou hoje e a sequência (zera se pulou um dia) */
function estado(data) { const D = guardado(); const n = diaNum(data); if (!D) return { rec: null, jogadasHoje: 0, seq: 0, melhorSeq: 0, jogouHoje: false, jogados: 0, vitorias: 0 }; const dia = D.dias[data] || null; const u = D.ultimo ? diaNum(D.ultimo) : NaN;
  return { rec: dia ? dia.rec : null, jogadasHoje: dia ? dia.n : 0, jogouHoje: !!dia, seq: u === n || u === n - 1 ? D.seq || 0 : 0, melhorSeq: D.melhorSeq || 0, jogados: D.jogados || 0, vitorias: D.vitorias || 0 }; }

ARD.desafio = { FORMATO, RACAS, MODOS, MAPAS, DIFS, CHEFES, MUTS, MUNDO, ARENA, ALFA, LINK_NA_LINHA, BLITZ_MIN,
  dataValida, diaNum, dataDe, dataUTC, faltaMs, diaSemana, receitaDoDia, justa, normaliza, iguais, codigo, bonito, limpa, ler, jogadores, cfgJogo, simCfg, deSim, melhor, registrar, estado };
})(globalThis.ARD = globalThis.ARD || {});
