/* Aether Rift: Dominion — 5.5a: a primeira partida guiada ("Primeiro Contato").
   Uma partida curta (5 a 7 minutos) com um objetivo por vez; o painel da partida nasce aos poucos (cada parte aparece quando o objetivo
   precisa dela). Pulável, repetível pelo menu, nos três idiomas, com mouse e com toque. Sem voz nova: a fala de abertura é a que já existe
   no Prólogo (camp.p1.brief.0); o resto é texto.
   Duas partes neste arquivo:
   1) o roteiro (MISSAO e preparar): dados puros, sem DOM, no formato das missões da campanha; roda no executor do src/campaign.js
      (ARD.campaign.start) e por isso também roda no Node (tools/entrada-test.cjs). O inimigo é passivo (sem IA): o ataque e os reforços são
      do roteiro, com os utilitários determinísticos da simulação.
   2) a interface (inicio, begin): a faixa do objetivo, a seta "clique aqui", as classes do <body> que escondem e mostram o painel, o cartão
      de boas-vindas da primeira visita e o botão "Primeira partida" do menu. Só lê a simulação; os comandos saem do jogador. */
(function (ARD) {
'use strict';
const S = () => ARD.sim;
const enche = (s, v) => (!v || String(s).indexOf('{') < 0) ? String(s) : String(s).replace(/\{(\w+)\}/g, (x, n) => Object.prototype.hasOwnProperty.call(v, n) ? String(v[n]) : x);
const T = (k, v, r) => (ARD.t ? ARD.t(k, v, r) : enche(r != null ? r : k, v));
const CHAVE = 'ard-guia-v1';
const SEMENTE = 5507, MINUTOS = 45; /* relógio folgado: quem aprende devagar não perde por tempo */
const PASSOS = ['coletores', 'reator', 'quartel', 'tropa', 'defesa', 'nucleo'];
const ONDA = { infantaria: 3 }, REFORCO = { veiculo: 2 }, NUCLEO_INIMIGO = 1600, ESPERA_ATAQUE = 10;
/* textos em pt-BR (reserva e base das chaves guia.* dos três dicionários) */
const PT = {
  'coletores.t': 'Produza 2 × {coletor}', 'reator.t': 'Construa: {reator}', 'quartel.t': 'Construa: {quartel}', 'tropa.t': 'Treine 4 × {infantaria}', 'defesa.t': 'Defenda a base do ataque', 'nucleo.t': 'Destrua o Núcleo inimigo',
};

/* ---------- 1) roteiro ---------- */
const MISSAO = { id: 'guia', act: 'guia', title: 'Primeiro Contato', place: 'Planície da Fenda', xp: 0, brief: [],
  setup: { seed: SEMENTE, enemies: [{ race: 'rival', name: 'auto', passive: true }] },
  objectives: [
    { id: 'coletores', text: 'Produzir 2 Coletores', test: c => c.units('coletor') >= 5 || c.st.col >= 2, progress: c => Math.min(2, Math.max(c.st.col || 0, c.units('coletor') - 3)) + '/2' },
    { id: 'reator', text: 'Construir um Reator', test: c => c.built('reator') >= 1 },
    { id: 'quartel', text: 'Construir um Quartel', test: c => c.built('quartel') >= 1 },
    { id: 'tropa', text: 'Treinar 4 de Infantaria', test: c => (c.st.inf || 0) >= 4, progress: c => Math.min(4, c.st.inf || 0) + '/4' },
    { id: 'defesa', text: 'Defender a base do ataque', test: c => !!c.st.ataque && c.waveAlive('g1') === 0 },
    { id: 'nucleo', text: 'Destruir o Núcleo inimigo', test: c => c.enemyDead(0) },
  ],
  onSpawn: (c, ev) => { if (ev.def === 'coletor') c.st.col = (c.st.col || 0) + 1; else if (ev.def === 'infantaria') c.st.inf = (c.st.inf || 0) + 1; },
  tick: c => { const s = S(), sim = c.sim;
    if (c.done('tropa') && !c.st.ataque) { if (c.st.atkT == null) c.st.atkT = c.t + ESPERA_ATAQUE; else if (c.t >= c.st.atkT) { c.wave('g1', { comp: ONDA, from: 0 }); c.st.ataque = true; } } /* o ataque fraco chega 10 s depois da tropa pronta */
    if (c.st.ataque && c.done('defesa') && !c.st.reforco) { c.st.reforco = true; const n = c.myNucleo(), en = s.nucleoOf(sim, c.en[0]); /* reforços para o contra-ataque e o Núcleo inimigo já avariado */
      if (n) { let k = 0; for (const def in REFORCO) for (let i = 0; i < REFORCO[def]; i++, k++) s.spawnUnit(sim, 0, def, n.x + s.DM.cos(c.me.startAngle + Math.PI + (k - 0.5) * 0.5) * 95, n.y + s.DM.sin(c.me.startAngle + Math.PI + (k - 0.5) * 0.5) * 95); }
      if (en) { en.hp = Math.min(en.hp, NUCLEO_INIMIGO); c.marker = { x: en.x, y: en.y }; } } },
};
const NOMES_IA = { vehnar: 'Fundição Kessari', erevane: 'Clã Sombrio', tessara: 'Linhagem Oriel', quorith: 'Coro de Zayin', vorag: 'Prole Velk' }; /* nomes de IA que o jogo já tem (traduzidos pelo dicionário) */
const RACAS = ['vehnar', 'erevane', 'tessara', 'quorith', 'vorag'];
/* a partida guiada pronta: { mission, diff, cfg } (cfg = a cfg da simulação; a mesma no jogo e no teste do Node) */
function preparar(o) { o = o || {}; const race = RACAS.includes(o.race) ? o.race : 'vehnar'; const rival = RACAS.filter(r => r !== race)[0];
  const players = [{ name: o.name || 'Comandante', faction: race, human: true, color: o.color || undefined, mods: { startRes: { minerio: 300 } } }, { name: NOMES_IA[rival], faction: rival, difficulty: 'facil', passive: true }];
  return { mission: MISSAO, diff: { ai: 'facil', wave: 1, xp: 0, label: 'Guiada' }, difficulty: 'facil', race, era: 1, swap: {}, cfg: { seed: SEMENTE, players, minutes: MINUTOS, map: 'fenda', mapV: 0, blitz: true /* bases mais perto, como no Blitz */ } }; }
/* a cfg do jogo (startGame) a partir da base da tela inicial (nome, Raça, gráficos) */
function cfgJogo(base) { const p = preparar({ race: base.faction, name: base.name, color: base.color }); return Object.assign({}, base, { guia: true, guiaPrep: p, opp: '1', diff: 'facil', seed: p.cfg.seed, minutes: p.cfg.minutes, map: 'fenda', mapV: 0, blitz: true, players: p.cfg.players }); }

/* ---------- o que o aparelho lembra (só a primeira visita; fora do progresso do Comandante) ---------- */
function lembra() { try { return JSON.parse(localStorage.getItem(CHAVE) || 'null'); } catch (e) { return null; } }
function grava(patch) { try { localStorage.setItem(CHAVE, JSON.stringify(Object.assign(lembra() || {}, patch))); } catch (e) {} }
function primeiraVisita(params) { /* nada salvo neste aparelho e nenhum endereço de teste, convite ou missão */
  if (typeof localStorage === 'undefined') return false; for (const k of ['autostart', 'bench', 'missao', 'campanha', 'sala', 'retomar', 'iniciar']) if (params.get(k)) return false;
  if (params.get('guia') === '1') return true; if (params.get('guia') === '0') return false;
  if (typeof navigator !== 'undefined' && navigator.webdriver) return false; /* ferramentas automáticas (testes e capturas) seguem direto para o menu; ?guia=1 força o cartão */
  for (const k of ['debug', 'novo', 'aba', 'modo']) if (params.get(k)) return false;
  try { if (lembra()) return false; for (const k of ['ard-beta-prefs', 'ard-progress', 'ard-progress-v1', 'ard-modos-v1', 'ard-mp-session']) if (localStorage.getItem(k)) return false; } catch (e) { return false; }
  return true; }

/* ---------- 2) interface: tela inicial ---------- */
let D0 = null;
function iniciar() { if (!D0) return; const bv = document.getElementById('boas-vindas'); if (bv) bv.hidden = true; grava({ vista: Date.now() }); D0.startGame(cfgJogo(D0.cfgBase())); }
function inicio(deps) { D0 = deps; const $ = id => document.getElementById(id);
  const b = $('btn-guia'); if (b) b.addEventListener('click', iniciar);
  const bv = $('boas-vindas'); if (!bv) return;
  const fecha = () => { bv.hidden = true; grava({ vista: Date.now(), menu: true }); };
  if ($('bv-jogar')) $('bv-jogar').addEventListener('click', iniciar); if ($('bv-menu')) $('bv-menu').addEventListener('click', fecha);
  if (primeiraVisita(deps.params) && !deps.ocupado()) bv.hidden = false; }

/* ---------- 2) interface: na partida ---------- */
function begin(D) {
  const $ = id => document.getElementById(id); const { G, sim, human, view, I, R } = D; const s = S(); const toque = !!G.isTouch;
  const prep = D.cfg.guiaPrep || preparar({ race: sim.players[human].faction }); const run = ARD.campaign.start(sim, prep, null);
  const me = sim.players[human], fac = me.faction; const dn = ARD.i18n && ARD.i18n.d;
  const nomes = () => ({ coletor: dn ? dn.unidade(fac, 'coletor') : 'Coletor', infantaria: dn ? dn.unidade(fac, 'infantaria') : 'Infantaria', reator: dn ? dn.construcao('reator') : 'Reator', quartel: dn ? dn.construcao('quartel') : 'Quartel', nucleo: dn ? dn.construcao('nucleo') : 'Núcleo' });
  const body = document.body; body.classList.add('guia'); for (let i = 2; i <= PASSOS.length; i++) body.classList.remove('g' + i); body.classList.remove('g-fim');
  /* a faixa do objetivo e a seta */
  let el = $('guia'); if (!el) { el = document.createElement('div'); el.id = 'guia'; el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite'); $('hud').appendChild(el); }
  el.innerHTML = '<div class="g-top"><span class="g-eye"></span><span class="g-tra" aria-hidden="true">' + PASSOS.map(() => '<i></i>').join('') + '</span><button type="button" class="g-pular"></button></div><div class="g-txt"></div><div class="g-como"></div><div class="g-acts"></div><div class="g-novo" hidden></div>';
  el.hidden = false;
  let seta = $('guia-seta'); if (!seta) { seta = document.createElement('div'); seta.id = 'guia-seta'; seta.innerHTML = '<b></b><i></i>'; $('hud').appendChild(seta); } seta.hidden = true;
  const qEye = el.querySelector('.g-eye'), qTxt = el.querySelector('.g-txt'), qComo = el.querySelector('.g-como'), qActs = el.querySelector('.g-acts'), qNovo = el.querySelector('.g-novo'), tra = [...el.querySelectorAll('.g-tra i')], qSetaT = seta.querySelector('b');
  const setT = (n, v) => { if (n.textContent !== v) n.textContent = v; };
  let passo = -1, okAte = 0, alvoEl = null, chave = '', spot = null, spotDef = '', fimT = 0, pulou = false;
  const st = { said: false };
  const exercito = () => { const ids = []; for (const e of sim.ents) if (e.alive && e.owner === human && e.kind === 'unit' && s.UNITS[e.def].attack) ids.push(e.id); return ids; };
  const predio = def => { for (const e of sim.ents) if (e.alive && e.kind === 'building' && e.owner === human && e.def === def) return e; return null; };
  const selUm = e => !!e && view.sel.size === 1 && view.sel.has(e.id);
  const temTropaSel = () => { for (const id of view.sel) { const e = sim.byId.get(id); if (e && e.alive && e.kind === 'unit' && e.owner === human && s.UNITS[e.def].attack) return true; } return false; };
  /* um lugar válido para a construção do passo, perto do Núcleo, do lado da Fenda (só para a seta "Construa aqui") */
  function lugar(def) { if (spot && spotDef === def && s.canBuild(sim, human, def, spot.x, spot.y).ok) return spot; spot = null; spotDef = def; const n = s.nucleoOf(sim, human); if (!n) return null; const a0 = s.DM.atan2(s.CY - n.y, s.CX - n.x) + (def === 'quartel' ? 0.9 : -0.9);
    for (const d of [150, 180, 120, 210, 240]) for (const da of [0, 0.4, -0.4, 0.8, -0.8, 1.3, -1.3, 2, -2, 2.8]) { const x = n.x + s.DM.cos(a0 + da) * d, y = n.y + s.DM.sin(a0 + da) * d; if (s.canBuild(sim, human, def, x, y).ok) { spot = { x, y }; return spot; } } return null; }
  function abreConstruir(def) { try { if (D.openBuild) D.openBuild(def === 'quartel' ? 'mil' : 'eco', def); } catch (e) {} }
  /* botões de ajuda da faixa (o jogador continua dando a ordem de atacar) */
  el.addEventListener('click', ev => { const b = ev.target.closest && ev.target.closest('[data-g]'); if (!b) return; const k = b.dataset.g;
    if (k === 'pular') { D.confirma(T('guia.pular-q', null, 'Sair da primeira partida e ir para o menu? Ela fica no botão Primeira partida, na aba Jogar.'), () => { pulou = true; grava({ pulou: Date.now() }); D.sair(); }); }
    else if (k === 'tropas') { const ids = exercito(); if (ids.length) I.select(ids); }
    else if (k === 'alvo') { const en = s.nucleoOf(sim, run.ctx.en[0]); if (en) I.center(en.x, en.y); }
    else if (k === 'base') { const n = s.nucleoOf(sim, human); if (n) I.center(n.x, n.y); }
    else if (k === 'quartel') { const q = predio('quartel'); if (q) { I.select([q.id]); I.center(q.x, q.y); } }
    else if (k === 'construir') abreConstruir(PASSOS[passo]); });
  el.querySelector('.g-pular').dataset.g = 'pular';
  function nasce(ids, rotulo) { for (const id of ids) { const n = $(id) || document.querySelector(id); if (!n) continue; n.classList.remove('g-nasce'); void n.offsetWidth; n.classList.add('g-nasce'); setTimeout(() => n.classList.remove('g-nasce'), 2600); }
    if (rotulo) { qNovo.textContent = T('guia.novo', { o: rotulo }, 'Novo no painel: {o}'); qNovo.hidden = false; clearTimeout(nasce.t); nasce.t = setTimeout(() => { qNovo.hidden = true; }, 5200); } }
  function entra(i) { /* o passo i começa: a parte do painel que ele precisa aparece */
    passo = i; for (let k = 2; k <= i + 1; k++) body.classList.add('g' + k); chave = ''; spot = null;
    tra.forEach((n, k) => { n.className = k < i ? 'ok' : k === i ? 'on' : ''; });
    if (i === 1) { nasce(['energy'], T('guia.novo.energia', null, 'Energia')); abreConstruir('reator'); }
    else if (i === 2) abreConstruir('quartel');
    else if (i === 3) { I.buildMenu = false; if (toque) nasce(['btn-army'], T('guia.novo.exercito', null, 'botão Exército')); }
    else if (i === 4) nasce(['.radar', 'alerts'], T('guia.novo.mapa', null, 'mapa e alertas'));
    else if (i === 5) { nasce(toque ? ['btn-attack'] : [], toque ? T('guia.novo.atacar', null, 'botão Atacar') : ''); const en = s.nucleoOf(sim, run.ctx.en[0]); if (en && view.memory && !view.memory.has(en.id)) view.memory.set(en.id, { x: en.x, y: en.y, def: en.def, owner: en.owner }); } /* o Núcleo inimigo aparece na névoa e no mapa como construção já avistada (só na tela: a memória do jogador), para o alvo não ser um ponto no escuro */
    if (D.medir) D.medir(); }
  function feito(i) { okAte = performance.now() + 1500; el.classList.add('ok'); setT(qTxt, '✓ ' + T('guia.feito', null, 'Feito!')); setT(qComo, titulo(i)); qActs.innerHTML = ''; seta.hidden = true; marca(null); try { if (ARD.audio) ARD.audio.sfx('promote', 0.7); } catch (e) {} }
  function titulo(i) { const o = run.objectives[i]; const base = T('guia.p.' + PASSOS[i] + '.t', nomes(), enche(PT[PASSOS[i] + '.t'], nomes())); return base + (o.progress && !o.done ? ' (' + o.progress + ')' : ''); }
  function marca(n) { if (alvoEl === n) return; if (alvoEl) alvoEl.classList.remove('guia-alvo'); alvoEl = n; if (n) n.classList.add('guia-alvo'); }
  function setaEm(x, y, texto, acima) { seta.hidden = false; setT(qSetaT, texto); seta.classList.toggle('baixo', !acima); const w = seta.offsetWidth || 120; const px = Math.max(6, Math.min(innerWidth - w - 6, x - w / 2)); seta.style.transform = 'translate(' + Math.round(px) + 'px,' + Math.round(y) + 'px)'; seta.style.setProperty('--sx', Math.round(Math.max(14, Math.min(w - 14, x - px))) + 'px'); }
  function setaDom(n, texto) { if (!n || !n.getClientRects().length) { seta.hidden = true; marca(null); return; } marca(n); const r = n.getBoundingClientRect(); const acima = r.top > 120; setaEm(r.left + r.width / 2, acima ? r.top - 8 : r.bottom + 8, texto, acima); }
  function setaMundo(x, y, texto, z) { marca(null); const p = R.worldToScreen(view.cam, x, y, z || 0); if (!(p[0] > 20 && p[0] < innerWidth - 20 && p[1] > 90 && p[1] < innerHeight - 60)) { seta.hidden = true; return false; } setaEm(p[0], p[1] - 8, texto, true); return true; } /* z: a altura do alvo no mundo (a ponta da seta encosta no topo dele; 0 = no chão) */
  const painel = sel => $('panel').querySelector(sel);
  const aqui = () => T(toque ? 'guia.s.toque' : 'guia.s.clique', null, toque ? 'Toque aqui' : 'Clique aqui');
  /* o que mostrar agora: texto de "como fazer", botões de ajuda e para onde a seta aponta */
  function quadroPasso() { const id = PASSOS[passo], nm = nomes(); let como = '', acts = '', k = id;
    const nuc = s.nucleoOf(sim, human);
    if (id === 'coletores') { const selN = selUm(nuc); k += selN ? 1 : 0;
      como = T('guia.p.coletores.' + (toque ? 'toque' : 'pc'), nm, toque ? 'Toque em {nucleo}, na barra de baixo, e depois no cartão {coletor}. Eles colhem o Minério que paga tudo.' : 'Clique no {nucleo}, a construção grande no centro, e depois no cartão {coletor}. Eles colhem o Minério que paga tudo.');
      if (selN) setaDom(painel('[data-prod="coletor"]'), aqui()); else if (toque) setaDom($('btn-nucleo'), aqui()); else if (nuc && !setaMundo(nuc.x, nuc.y, T('guia.s.nucleo', nm, 'Clique no {nucleo}'), 62)) { acts = bot('base', T('guia.a.base', null, 'Ver a base')); } }
    else if (id === 'reator' || id === 'quartel') { const pondo = I.mode === 'build' && view.ghost && view.ghost.def === id; const obra = predio(id); const cartao = painel('[data-build="' + id + '"]'); k += pondo ? 'p' : obra ? 'o' : cartao ? 'c' : 'x';
      como = T('guia.p.' + id + '.' + (toque ? 'toque' : 'pc'), nm, id === 'reator' ? (toque ? 'Toque no cartão {reator}, escolha um lugar perto do {nucleo} e confirme. Ele dá a energia das outras construções.' : 'Clique no cartão {reator} e depois num lugar livre perto do {nucleo}. Ele dá a energia das outras construções.') : (toque ? 'Toque no cartão {quartel}, escolha um lugar e confirme. É nele que os soldados são treinados.' : 'Clique no cartão {quartel} e depois num lugar livre. É nele que os soldados são treinados.'));
      if (obra) { como = T('guia.p.obra', null, 'A obra começou. Em alguns segundos fica pronta.'); if (!setaMundo(obra.x, obra.y, T('guia.s.obra', null, 'Em obras'), 34)) seta.hidden = true; }
      else if (pondo) { const sp = lugar(id); const pb = toque ? $('pb-ok') : null; if (pb && !pb.disabled && pb.getClientRects().length) setaDom(pb, aqui()); else if (!sp || !setaMundo(sp.x, sp.y, T('guia.s.construa', null, 'Construa aqui'))) seta.hidden = true; }
      else if (cartao) setaDom(cartao, aqui());
      else { seta.hidden = true; marca(null); acts = bot('construir', T('guia.a.construir', null, 'Abrir Construir')); } }
    else if (id === 'tropa') { const q = predio('quartel'); const selQ = selUm(q); k += selQ ? 1 : 0;
      como = T('guia.p.tropa.' + (toque ? 'toque' : 'pc'), nm, toque ? 'Toque no {quartel} e depois, quatro vezes, no cartão {infantaria}.' : 'Clique no {quartel} e depois, quatro vezes, no cartão {infantaria}.');
      if (selQ) setaDom(painel('[data-prod="infantaria"]'), aqui()); else if (q && !setaMundo(q.x, q.y, T('guia.s.quartel.' + (toque ? 'toque' : 'pc'), null, toque ? 'Toque nesta construção' : 'Clique nesta construção'), 46)) acts = bot('base', T('guia.a.base', null, 'Ver a base')); if (!selQ && q) acts += bot('quartel', T('guia.a.quartel', nm, 'Abrir: {quartel}')); /* atalho: no toque, um dedo perto de uma unidade seleciona a unidade em vez da construção */ }
    else if (id === 'defesa') { como = T('guia.p.defesa.como', null, 'Uma patrulha inimiga está vindo. Suas tropas atiram sozinhas em quem chega perto: mantenha-as junto da base.'); acts = bot('tropas', T('guia.a.tropas', null, 'Selecionar tropas')) + bot('base', T('guia.a.base', null, 'Ver a base'));
      let alvo = null; for (const sid in run.ctx.waveIds) { const e = sim.byId.get(+sid); if (e && e.alive && s.canSee(sim, human, e)) { alvo = e; break; } } k += alvo ? 1 : 0;
      if (!alvo || !setaMundo(alvo.x, alvo.y, T('guia.s.inimigo', null, 'Inimigo'), 26)) seta.hidden = true; marca(null); }
    else if (id === 'nucleo') { const en = s.nucleoOf(sim, run.ctx.en[0]); const sel = temTropaSel(); const tropas = exercito().length; k += (sel ? 1 : 0) + (tropas ? 't' : 'z');
      if (!tropas) { /* perdeu o exército: o guia manda treinar de novo em vez de deixar o jogador sem saída */ const q = predio('quartel'); const selQ = selUm(q);
        como = T('guia.p.nucleo.sem-tropa', nm, 'Você ficou sem tropas. Treine mais {infantaria} no {quartel} e ataque de novo.'); acts = bot('base', T('guia.a.base', null, 'Ver a base'));
        if (selQ) setaDom(painel('[data-prod="infantaria"]'), aqui()); else if (!q || !setaMundo(q.x, q.y, T('guia.s.quartel.' + (toque ? 'toque' : 'pc'), null, toque ? 'Toque nesta construção' : 'Clique nesta construção'), 46)) { seta.hidden = true; marca(null); } }
      else { como = T('guia.p.nucleo.' + (toque ? 'toque' : 'pc'), nm, toque ? 'Chegaram reforços. Selecione as tropas, vá até o alvo e toque no {nucleo} inimigo para atacar.' : 'Chegaram reforços. Selecione as tropas, vá até o alvo e clique com o botão direito no {nucleo} inimigo.');
        acts = bot('tropas', T('guia.a.tropas', null, 'Selecionar tropas'), !sel) + bot('alvo', T('guia.a.alvo', null, 'Ver o alvo'), sel);
        if (!en || !setaMundo(en.x, en.y, sel ? T('guia.s.alvo.' + (toque ? 'toque' : 'pc'), null, toque ? 'Toque para atacar' : 'Botão direito aqui') : T('guia.s.alvo', null, 'Núcleo inimigo'), 62)) seta.hidden = true; marca(null); } }
    { const hh = el.offsetHeight + 'px'; if (st.hh !== hh) { st.hh = hh; document.documentElement.style.setProperty('--guiah', hh); } } /* a altura da faixa empurra o mapa no celular */
    setT(qEye, T('guia.eyebrow', { n: passo + 1, total: PASSOS.length }, 'Primeira partida · passo {n} de {total}')); setT(qTxt, titulo(passo)); setT(qComo, como);
    k += '|' + acts; if (k !== chave) { chave = k; qActs.innerHTML = acts; } }
  const bot = (g, t, forte) => '<button type="button" class="act sm' + (forte ? ' good' : '') + '" data-g="' + g + '">' + String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])) + '</button>';
  setT(el.querySelector('.g-pular'), T('guia.pular', null, 'Pular o guia') + ' ›');
  /* a fala de abertura: a mesma do Prólogo (com a voz gravada do líder, quando o pacote estiver carregado) */
  function abertura() { if (st.said) return; st.said = true; try { const c = $('comms'); if (!c) return; const gen = (ARD.campaign.genero ? ARD.campaign.genero(fac) : 'm'); const pt = 'Comandante, os cinco mundos começaram a se alinhar e a Fenda abriu um planalto inteiro. O Núcleo está de pé; agora precisamos de energia e de quem colha.'; const text = ARD.tg ? ARD.tg('camp.p1.brief.0', gen, null, pt) : pt;
      const art = D.leaderArt(fac, 1); $('comms-img').src = art || ''; $('comms-img').hidden = !art; $('comms-name').textContent = (D.LEADER_NAME[fac] || '') + ' · ' + (dn ? dn.raca(fac) : fac); $('comms-text').textContent = text; c.style.setProperty('--cc', D.RACE_COLORS[fac] || '#FF5E3A'); c.hidden = false;
      let dur = 0; try { if (ARD.vozes && ARD.vozes.campanha) dur = ARD.vozes.campanha({ race: fac, mood: 1, text, k: 'camp.p1.brief.0' }, 'p1') || 0; } catch (e) {} setTimeout(() => { c.hidden = true; }, Math.max(7000, dur * 1000 + 800)); } catch (e) {} }
  const sess = { prep, run, guia: true, passos: PASSOS,
    get passo() { return passo; }, get pulou() { return pulou; },
    tick(ev) { run.tick(ev); run.takeSaid(); return run.result; },
    frame() { if (G.ended) { if (!fimT) { fimT = 1; el.hidden = true; seta.hidden = true; marca(null); } return; }
      if (!st.said && sim.time > 1.5) abertura();
      body.classList.toggle('g-sem-painel', (passo === 0 || passo >= 3) && !view.sel.size && !I.buildMenu); /* fora dos passos de construir, o menu Construir não cobre a tela (ele volta pelo botão Construir ou pela tecla B) */
      const now = performance.now(); if (now < okAte) return; el.classList.remove('ok');
      let i = run.objectives.findIndex(o => !o.done); if (i < 0) i = PASSOS.length - 1;
      if (i !== passo) { if (passo >= 0 && i > passo) { const era = passo; entra(i); feito(era); return; } entra(i); }
      quadroPasso(); },
    fim(venceu) { el.hidden = true; seta.hidden = true; marca(null); body.classList.add('g-fim'); if (venceu) grava({ fim: Date.now() }); },
    retraduz() { chave = ''; setT(el.querySelector('.g-pular'), T('guia.pular', null, 'Pular o guia') + ' ›'); if (run.retraduz) run.retraduz(); },
  };
  window.addEventListener('ard-idioma', () => { if (G && G.guia === sess) sess.retraduz(); });
  return sess;
}
function sairDoModo() { if (typeof document === 'undefined') return; const b = document.body; b.classList.remove('guia', 'g-fim', 'g-sem-painel'); for (let i = 2; i <= PASSOS.length; i++) b.classList.remove('g' + i); }

ARD.guia = { MISSAO, PASSOS, SEMENTE, MINUTOS, ONDA, REFORCO, NUCLEO_INIMIGO, preparar, cfgJogo, inicio, iniciar, begin, primeiraVisita, lembra, sairDoModo };
})(globalThis.ARD = globalThis.ARD || {});
