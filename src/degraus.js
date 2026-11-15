/* Aether Rift: Dominion — 5.5b (agente m-hud): degraus de descoberta.
   Uma novidade por partida nas cinco primeiras, nesta ordem: Pirata, pacto, Comandante, construção única, chefão.
   - No começo da partida a novidade é apresentada em UMA frase, na caixa de conselhos que o jogo já tem (topo da tela).
   - Na tela final aparece um botão "Próximo passo: …" que abre uma partida preparada para a novidade seguinte.
   - É APRESENTAÇÃO, NÃO TRAVA: nada do jogo é bloqueado. Quem monta a partida à mão joga o que quiser; o degrau só é apresentado (e só avança)
     quando a partida escolhida tem a novidade da vez. Quem já tinha progresso neste aparelho não vê nada disto (ProgressStore: degraus.pulo).
   Guardado no ProgressStore (src/progress.js: degraus.n = quantos já foram apresentados). Não conhece a simulação além de ler a cfg da partida.
   Roda no Node (sem DOM) para os testes: LISTA, estado(), cabe(), cfgJogo(), aoComecar(), aoTerminar(). */
(function (ARD) {
'use strict';
const T = (k, v, r) => (ARD.t ? ARD.t(k, v, r) : (r != null ? String(r).replace(/\{(\w+)\}/g, (m, x) => (v && v[x] != null ? v[x] : m)) : k));
const P = () => ARD.progress;
/* cada degrau: id, a cfg da partida preparada (por cima da cfg base do menu), se uma cfg qualquer "tem" a novidade, e o botão de ajuda do conselho */
const LISTA = [
  { id: 'pirata', cfg: () => ({ opp: '1', diff: 'facil', map: 'fenda' }), cabe: c => !c.cacada, nome: 'Pirata', frase: 'Novidade desta partida: {pirata}, que você treina em {quartel} e manda a uma {refinaria} inimiga para roubar recursos.' },
  { id: 'pacto', cfg: () => ({ opp: '2', diff: 'facil', map: 'fenda' }), cabe: c => !c.cacada && !c.blitz && (+c.opp || 0) >= 2, nome: 'Pacto', acao: 'diplo', frase: 'Novidade desta partida: abra a Diplomacia e proponha um pacto a um dos dois rivais, para enfrentar um de cada vez.' },
  { id: 'comandante', cfg: () => ({ opp: '1', diff: 'facil', map: 'fenda', comandantes: true }), cabe: c => !!c.comandantes && !c.cacada, nome: 'Comandante em campo', frase: 'Novidade desta partida: o seu líder entra em campo como Comandante, com três habilidades nas teclas Z, X e C.' },
  { id: 'unica', cfg: () => ({ opp: '1', diff: 'normal', map: 'fenda' }), cabe: c => !c.cacada, nome: 'Construções únicas', acao: 'unicas', frase: 'Novidade desta partida: a aba Únicas do Construir tem duas construções que só a sua Raça tem.' },
  { id: 'chefao', cfg: () => ({ opp: '0', diff: 'normal', map: (ARD.modos && ARD.modos.CACADA && ARD.modos.CACADA.arauto && ARD.modos.CACADA.arauto.mapa) || 'fenda', cacada: { chefe: 'arauto', dif: 'facil' } }), cabe: c => !!c.cacada || !!c.chefe, nome: 'Chefão da Fenda', frase: 'Novidade desta partida: uma Caçada, em que o inimigo é um chefão da Fenda; derrube-o antes que ele chegue ao seu Núcleo.' },
];
const TOTAL = LISTA.length;
function estado() { const d = P().degrausInicia(); return { n: d.n, total: TOTAL, pulo: !!d.pulo, proximo: d.n < TOTAL ? LISTA[d.n] : null }; }
/* a partida conta para os degraus? só partida solo comum: nem guiada, nem campanha, nem rede, nem teste de desempenho, nem retomada */
function conta(cfg, rede) { return !!cfg && !rede && !cfg.guia && !cfg.campaign && !cfg.bench && !cfg.resume && !cfg.desafio; }
function cabe(cfg, i) { const g = LISTA[i]; return !!g && conta(cfg) && !!g.cabe(cfg); }
/* a cfg da partida preparada para o degrau i (0 a 4), por cima da cfg base do menu (nome, Raça, gráficos) */
function cfgJogo(i, base) { const g = LISTA[i]; if (!g) return null; return Object.assign({ seed: 1 + ((Date.now() / 1000) | 0) % 9000 }, base || {}, g.cfg(), { degrau: i }); }
function nome(g, fac) { if (!g) return ''; if (g.id === 'pirata') { const dn = ARD.i18n && ARD.i18n.d; if (dn && fac) { try { return dn.unidade(fac, 'pirata'); } catch (e) {} } } return T('degrau.' + g.id + '.nome', null, g.nome); }
function frase(g, fac) { if (!g) return ''; const dn = ARD.i18n && ARD.i18n.d; const c = k => { try { return dn ? dn.construcao(k) : null; } catch (e) { return null; } };
  return T('degrau.' + g.id + '.frase', { pirata: nome(LISTA[0], fac), quartel: c('quartel') || 'Quartel', refinaria: c('refinaria') || 'Refinaria' }, g.frase); }
/* começo da partida: se a partida tem a novidade da vez, devolve o degrau a apresentar (e lembra qual foi, para avançar no fim) */
let emCurso = -1;
function aoComecar(cfg, rede) { emCurso = -1; if (!conta(cfg, rede)) return null; const e = estado(); const i = cfg.degrau != null ? cfg.degrau | 0 : e.n; /* a partida preparada pelo botão apresenta o degrau dela; a montada à mão, o da vez */
  if (i < 0 || i >= TOTAL || !cabe(cfg, i)) return null; if (i === e.n) emCurso = i; return LISTA[i]; }
/* fim da partida (vitória ou derrota): o degrau apresentado fica feito; devolve o próximo a oferecer (ou null) */
function aoTerminar(cfg, rede) { if (emCurso >= 0) { P().degrauAvanca(emCurso); emCurso = -1; } if (cfg && (cfg.guia || cfg.campaign || cfg.bench) || rede) return null; const e = estado(); return e.pulo ? null : e.proximo; }

/* ---------- interface ---------- */
let D0 = null; const $ = id => document.getElementById(id);
function endereco(i) { const u = new URLSearchParams(location.search); for (const k of ['autostart', 'guia', 'missao', 'dif', 'raca', 'campanha', 'sala', 'retomar', 'iniciar', 'blitz', 'cacada', 'chefe', 'bench']) u.delete(k); u.set('degrau', String(i + 1)); return location.pathname + '?' + u.toString(); } /* o resto do endereço (idioma, gráficos) continua */
/* na partida: a frase na caixa de conselhos (ctx vem do main.js: { G, sim, human, cfg, rede, advise, openDiplo, openBuild }) */
function partida(ctx) { const g = aoComecar(ctx.cfg, ctx.rede); if (!g || !ctx.advise) return null; const fac = ctx.sim.players[ctx.human].faction; const acts = [{ label: T('degrau.entendi', null, 'Entendi'), fn() {} }];
  if (g.acao === 'diplo' && ctx.openDiplo) acts.unshift({ label: T('degrau.abrir-diplo', null, 'Abrir a Diplomacia'), ic: 'ic-diplo', fn: ctx.openDiplo });
  if (g.acao === 'unicas' && ctx.openBuild) acts.unshift({ label: T('degrau.ver-unicas', null, 'Ver as Únicas'), ic: 'ic-super', fn: () => ctx.openBuild('uni') });
  ctx.advise({ id: 'degrau-' + g.id, title: T('degrau.titulo', { n: LISTA.indexOf(g) + 1, total: TOTAL }, 'Novidade {n} de {total}'), text: frase(g, fac), icon: 'ic-super', kind: 'info', secs: 60, acts });
  if (ARD.medir) ARD.medir.conta('degrau.apresentado'); return g; }
/* na tela final: um botão "Próximo passo: …" na fileira de botões (elemento próprio; o desenho da tela e do cartão não muda) */
function fim(ctx) { if (typeof document === 'undefined') return null; const prox = aoTerminar(ctx.cfg, ctx.rede); let b = $('btn-degrau'); const linha = document.querySelector('#end .fim-botoes');
  const fimEl = $('end'); if (fimEl) fimEl.classList.toggle('tem-degrau', !!prox && !!linha); /* com o botão do degrau, a frase genérica de próximo passo da tela final sai (seriam dois "próximos passos") */
  if (!prox) { if (b) b.hidden = true; return null; } if (!linha) return null; const fac = ctx.sim.players[ctx.human].faction;
  if (!b) { b = document.createElement('button'); b.id = 'btn-degrau'; b.type = 'button'; b.className = 'btn'; const ref = $('btn-share'); if (ref && ref.parentElement === linha) linha.insertBefore(b, ref); else linha.appendChild(b); }
  const i = LISTA.indexOf(prox); b.__g = { i, fac }; b.textContent = T('degrau.botao', { nome: nome(prox, fac) }, 'Próximo passo: {nome}'); b.title = frase(prox, fac).replace(/^[^:]*:\s*/, ''); b.hidden = false;
  b.onclick = () => { if (ARD.medir) ARD.medir.conta('degrau.aceito'); location.href = endereco(i); }; return b; }
/* na tela inicial: ?degrau=N abre direto a partida preparada; e a aba Jogar ganha o botão do próximo passo ao lado de "Primeira partida" */
function botaoMenu() { const ref = $('btn-guia'); if (!ref || !ref.parentElement) return; let b = $('btn-degrau-menu'); const e = estado();
  if (!b) { b = document.createElement('button'); b.id = 'btn-degrau-menu'; b.type = 'button'; b.className = 'btn'; ref.after(b); b.addEventListener('click', () => { const e2 = estado(); if (!e2.proximo || !D0) return; if (ARD.medir) ARD.medir.conta('degrau.aceito'); D0.startGame(cfgJogo(e2.n, D0.cfgBase())); }); }
  b.hidden = !e.proximo || e.pulo; if (e.proximo) { const fac = D0 && D0.cfgBase ? D0.cfgBase().faction : null; b.textContent = T('degrau.botao', { nome: nome(e.proximo, fac) }, 'Próximo passo: {nome}'); b.title = frase(e.proximo, fac).replace(/^[^:]*:\s*/, ''); } }
function inicio(deps) { D0 = deps; try { P().degrausInicia(); } catch (e) {} botaoMenu(); window.addEventListener('ard-idioma', () => { botaoMenu(); const b = $('btn-degrau'); if (b && !b.hidden && b.__g) b.textContent = T('degrau.botao', { nome: nome(LISTA[b.__g.i], b.__g.fac) }, 'Próximo passo: {nome}'); });
  document.addEventListener('change', ev => { if (ev.target && ev.target.name === 'fac') botaoMenu(); });
  const q = deps.params && deps.params.get('degrau'); const i = q ? (parseInt(q, 10) || 0) - 1 : -1;
  if (i >= 0 && i < TOTAL && !deps.params.get('autostart') && !(deps.ocupado && deps.ocupado())) { try { const u = new URLSearchParams(location.search); u.delete('degrau'); const r = u.toString(); history.replaceState(null, '', location.pathname + (r ? '?' + r : '')); } catch (e) {} /* o endereço volta ao normal: sair para o menu não reabre a partida */
    deps.startGame(cfgJogo(i, deps.cfgBase())); return true; } return false; }
ARD.degraus = { LISTA, TOTAL, estado, conta, cabe, cfgJogo, nome, frase, aoComecar, aoTerminar, partida, fim, inicio, botaoMenu };
})(globalThis.ARD = globalThis.ARD || {});
