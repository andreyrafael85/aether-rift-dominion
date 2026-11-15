/* Aether Rift: Dominion — 5.5b: a interface do Desafio do Dia e do código de desafio por link (a regra mora no src/desafio.js).
   - Tela inicial: a faixa "Desafio do Dia" acima das abas (o desafio de hoje, quanto falta para o próximo e a sequência) e dois atalhos
     na aba Jogar ("Desafio do Dia" e "Montar um desafio").
   - A janela #desafio tem cinco vistas: hoje, montar, recebido (quem abriu um link ?desafio=CÓDIGO vê o que é antes de começar),
     erro (código inválido ou de versão mais nova: um aviso, nunca um erro na página) e desafiar (o link da partida que acabou).
   - Tela final: o bloco #fim-desafio com o resultado em uma linha para colar, o recorde do dia, a sequência, o botão
     "Desafiar um amigo"; e, abaixo dos botões, #fim-extras com o cartão das conquistas desbloqueadas na partida.
   É aqui que o relógio é lido (Date.now()); a simulação nunca vê data nenhuma. Nada sai do aparelho: o link é só o endereço desta
   página com ?desafio=, e a linha para colar não leva endereço enquanto ARD.desafio.LINK_NA_LINHA estiver desligada. */
(function (ARD) {
'use strict';
const D = () => ARD.desafio;
const T = (k, v) => (ARD.t ? ARD.t(k, v) : k);
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const mmss = t => { t = Math.max(0, Math.floor(t)); return String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0'); };
const num = v => (ARD.i18n && ARD.i18n.num ? ARD.i18n.num(Math.floor(v)) : String(Math.floor(v)));
const dd = () => (ARD.i18n && ARD.i18n.d) || null;
const CURSO = 'ard-desafio-curso'; /* o desafio em andamento (para a partida retomada de um salvamento continuar valendo como desafio) */
let DEPS = null, V = null, TIMER = 0, HOJE = '', FIM = null;
const agora = () => Date.now();
const hoje = () => D().dataUTC(agora());

/* ---------- nomes no idioma ---------- */
const nRaca = f => (dd() ? dd().racaCurto(f) : f);
const nMapa = k => (dd() ? dd().mapa(k) : k);
const nDif = k => (dd() ? dd().dificuldade(k) : k);
const nChefe = id => (ARD.modosUI ? ARD.modosUI.nomeChefe(id) : id);
const nMut = k => T('modos.mut.' + k);
const nMedalha = m => T('modos.medalha.' + m);
function lista(a) { if (a.length < 2) return a.join(''); return a.slice(0, -1).join(', ') + ' ' + T('desafio.conj') + ' ' + a[a.length - 1]; }
/* a data do desafio por extenso, sempre em UTC (o dia do desafio é o dia UTC, não o do fuso do aparelho) */
function dataTxt(data) { const p = D().dataValida(data); if (!p) return String(data || ''); try { return new Intl.DateTimeFormat(ARD.i18n ? ARD.i18n.LOCALE[ARD.idioma] || 'pt-BR' : 'pt-BR', { timeZone: 'UTC', day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(Date.UTC(p.a, p.m - 1, p.d))); } catch (e) { return data; } }
function faltaTxt(ms) { const s = Math.max(0, Math.floor(ms / 1000)); return String(Math.floor(s / 3600)).padStart(2, '0') + ':' + String(Math.floor(s / 60) % 60).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); }
function horaVirada() { try { const ms = agora(); return new Date(ms + D().faltaMs(ms)).toLocaleTimeString(ARD.i18n ? ARD.i18n.LOCALE[ARD.idioma] || 'pt-BR' : 'pt-BR', { hour: '2-digit', minute: '2-digit' }); } catch (e) { return '00:00 UTC'; } }

/* ---------- a receita em palavras ---------- */
function titulo(r) { if (r.modo === 'blitz') return T('desafio.t.blitz', { raca: nRaca(r.ias[0]) }); if (r.modo === 'cacada') return T('desafio.t.cacada', { chefe: nChefe(r.chefe) }); return T('desafio.t.escaramuca', { racas: lista(r.ias.map(nRaca)) }); }
function itens(r) { const L = [];
  if (r.modo === 'cacada') L.push([T('desafio.i.time'), r.ias.length ? T(r.ias.length > 1 ? 'desafio.i.aliadas' : 'desafio.i.aliada', { racas: lista(r.ias.map(nRaca)) }) : T('desafio.i.sozinho')]);
  L.push([T('desafio.i.mapa'), nMapa(r.mapa)]); L.push([T('desafio.i.dif'), nDif(r.dif)]);
  if (r.modo === 'blitz') L.push([T('desafio.i.tempo'), T('desafio.i.minutos', { n: D().BLITZ_MIN })]);
  for (const m of r.mut) L.push([T('desafio.i.mutador'), nMut(m), T('modos.mut.' + m + '-d')]);
  if (r.eventos) L.push([T('desafio.i.regra'), T('modos.ev.titulo')]); if (r.mundo.length) L.push([T('desafio.i.regra'), T('mundo.titulo')]); if (r.cmd) L.push([T('desafio.i.regra'), T('cmd.opcao')]);
  L.push([T('desafio.i.semente'), String(r.seed)]); return L; }
/* uma linha só: "Blitz contra Vorag · Normal · Noite Eterna" (cartão e linha para colar) */
function curto(r) { return [titulo(r), nDif(r.dif)].concat(r.mut.map(nMut)).join(' · '); }
/* versões mais curtas, para o cartão quando a linha completa não cabe: "… · Difícil · 3 mutadores" e depois só o título */
function curtos(r) { return [r.mut.length > 1 ? [titulo(r), nDif(r.dif), T('desafio.n-mutadores', { n: r.mut.length })].join(' · ') : '', titulo(r) + ' · ' + nDif(r.dif), titulo(r)].filter(Boolean); }
function resumoHtml(r) { return '<ul class="dd-itens">' + itens(r).map(i => '<li><span>' + esc(i[0]) + '</span><b>' + esc(i[1]) + '</b>' + (i[2] ? '<small>' + esc(i[2]) + '</small>' : '') + '</li>').join('') + '</ul>'; }
function racasHtml(r, sel, sug) { return '<div class="dd-racas-rot" id="dd-racas-rot">' + esc(T('desafio.raca.sua')) + '</div><div class="dd-racas" role="radiogroup" aria-labelledby="dd-racas-rot">' + D().RACAS.map(f => '<button type="button" class="dd-raca' + (f === sel ? ' on' : '') + '" role="radio" aria-checked="' + (f === sel ? 'true' : 'false') + '" data-raca="' + f + '" data-race="' + f + '"><b>' + esc(nRaca(f)) + '</b>' + (r.raca === f ? '<small>' + esc(T(sug || 'desafio.raca.sugerida')) + '</small>' : '') + '</button>').join('') + '</div>'; }
function recTxt(r, rec) { if (!rec) return T('desafio.rec.nenhum'); const a = [T(rec.venceu ? 'desafio.res.vitoria' : 'desafio.res.derrota', { t: mmss(rec.tempo) })]; if (r.modo === 'cacada') { if (rec.medalha) a.push(T('desafio.res.medalha', { m: nMedalha(rec.medalha) })); a.push(T('desafio.res.perdas', { n: rec.perdas })); } else a.push(T('desafio.res.dominio', { n: num(rec.dominio) })); return a.join(' · '); }
function seqTxt(n) { return n === 1 ? T('desafio.seq.um') : T('desafio.seq.n', { n }); }
function linkDe(cod) { try { return location.origin + location.pathname + '?desafio=' + cod; } catch (e) { return '?desafio=' + cod; } }

/* ---------- o desafio em andamento (sobrevive à retomada de um salvamento) ---------- */
function guardaCurso(c) { try { localStorage.setItem(CURSO, JSON.stringify({ receita: c.receita, codigo: c.codigo, diario: c.diario || null })); } catch (e) {} }
function curso() { try { const c = JSON.parse(localStorage.getItem(CURSO) || 'null'); return c && c.receita && D().normaliza(c.receita) ? c : null; } catch (e) { return null; } }
function mesma(a, b) { return D().iguais(Object.assign({}, a, { raca: null }), Object.assign({}, b, { raca: null })); } /* a Raça de quem joga é escolha da pessoa: a partida é a mesma */

/* ---------- copiar e compartilhar ---------- */
function copia(txt, campo, nota, okKey) { const toque = (() => { try { return matchMedia('(pointer: coarse)').matches; } catch (e) { return false; } })();
  const fim = ok => { if (nota) { nota.textContent = T(ok ? okKey || 'desafio.copiado' : toque ? 'desafio.copie-na-mao-toque' : 'desafio.copie-na-mao'); nota.classList.toggle('falhou', !ok); } if (!ok && campo) { try { campo.focus(); campo.select(); } catch (e) {} } };
  const peloCampo = () => { try { if (!campo) return false; campo.focus(); campo.select(); return !!(document.execCommand && document.execCommand('copy')); } catch (e) { return false; } }; /* o jeito antigo, para quando o navegador não deixa o jeito novo */
  try { if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(txt).then(() => fim(true), () => fim(peloCampo())); return; } } catch (e) {}
  fim(peloCampo()); }
function podeEnviar() { try { return typeof navigator.share === 'function'; } catch (e) { return false; } }
function envia(r, cod) { try { navigator.share({ title: 'Aether Rift: Dominion', text: T('desafio.envio.texto', { desafio: curto(r) }), url: linkDe(cod) }).catch(() => {}); } catch (e) {} }

/* ---------- a janela ---------- */
function caixa() { let el = $('desafio'); if (!el) { el = document.createElement('div'); el.id = 'desafio'; el.className = 'modal dd'; el.hidden = true; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'dd-h'); el.innerHTML = '<div class="box"></div>'; document.body.appendChild(el);
    el.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); fecha(); } }); el.addEventListener('click', e => { if (e.target === el) fecha(); }); }
  return el; }
function fecha() { const el = $('desafio'); if (el) el.hidden = true; const volta = V && V.volta; V = null; if (volta && volta.focus) try { volta.focus(); } catch (e) {} }
function abre(vista, extra) { const el = caixa(); V = Object.assign({ vista, volta: document.activeElement }, extra || {}); el.hidden = false; pinta(); const h = $('dd-h'); if (h) { h.setAttribute('tabindex', '-1'); try { h.focus(); } catch (e) {} } }
function racaInicial(r) { const b = DEPS && DEPS.cfgBase ? DEPS.cfgBase() : {}; return r.raca || b.faction || 'vehnar'; }
function joga(r, raca, diario) { if (!DEPS || (DEPS.ocupado && DEPS.ocupado())) { const n = $('dd-nota'); if (n) n.textContent = T('desafio.ocupado'); return; }
  const cfg = D().cfgJogo(r, DEPS.cfgBase(), raca, { diario: diario || null }); if (!cfg) return; guardaCurso(cfg.desafio); const el = $('desafio'); if (el) el.hidden = true; V = null; para(); if (diario && ARD.medir) { try { ARD.medir.conta('desafio.jogado'); } catch (e) {} } /* 5.5b: contagem só no aparelho */ DEPS.startGame(cfg); }
function botoesComuns(box) { box.querySelectorAll('[data-raca]').forEach(b => b.addEventListener('click', () => { V.raca = b.dataset.raca; pinta(); const n = box.querySelector('[data-raca="' + V.raca + '"]'); if (n) n.focus(); }));
  box.querySelectorAll('[data-dd-vista]').forEach(b => b.addEventListener('click', () => { const v = b.dataset.ddVista; if (v === 'fechar') fecha(); else abre(v, { volta: V && V.volta }); })); }
function pinta() { const el = $('desafio'); if (!el || !V) return; const box = el.querySelector('.box'); const foco = document.activeElement && el.contains(document.activeElement) ? document.activeElement.id : '';
  const f = { hoje: vistaHoje, montar: vistaMontar, recebido: vistaRecebido, erro: vistaErro, desafiar: vistaDesafiar }[V.vista]; if (f) f(box); el.dataset.vista = V.vista; if (foco && $(foco)) try { $(foco).focus(); } catch (e) {} }

function vistaHoje(box) { const data = hoje(); const r = D().receitaDoDia(data); const st = D().estado(data); if (!V.raca) V.raca = racaInicial(r);
  box.innerHTML = '<div class="eyebrow">' + esc(T('desafio.hoje.eyebrow', { data: dataTxt(data) })) + '</div><h2 id="dd-h">' + esc(titulo(r)) + '</h2><p class="dd-p">' + esc(T('desafio.hoje.texto', { hora: horaVirada() })) + '</p>' + resumoHtml(r) +
    '<div class="dd-stats"><div><span>' + esc(T('desafio.hoje.falta')) + '</span><b id="dd-falta">' + faltaTxt(D().faltaMs(agora())) + '</b></div><div><span>' + esc(T('desafio.hoje.recorde')) + '</span><b class="dd-rec">' + esc(recTxt(r, st.rec)) + '</b></div><div><span>' + esc(T('desafio.hoje.seq')) + '</span><b>' + esc(st.seq ? seqTxt(st.seq) : T('desafio.seq.zero')) + '</b>' + (st.melhorSeq > st.seq ? '<small>' + esc(T('desafio.seq.melhor', { n: st.melhorSeq })) + '</small>' : '') + '</div></div>' +
    racasHtml(r, V.raca) + (r.raca ? '' : '<p class="dd-p small muted">' + esc(T('desafio.raca.livre')) + '</p>') +
    '<button type="button" id="dd-jogar-hoje" class="btn primary big">' + esc(T(st.jogouHoje ? 'desafio.hoje.de-novo' : 'desafio.hoje.jogar')) + '</button><div class="small muted" id="dd-nota" role="status"></div>' +
    '<div class="row"><button type="button" class="btn" data-dd-vista="montar" id="dd-ir-montar">' + esc(T('desafio.montar.botao')) + '</button><button type="button" class="btn" data-dd-vista="fechar" id="dd-fechar">' + esc(T('diplo.fechar')) + '</button></div>';
  botoesComuns(box); $('dd-jogar-hoje').addEventListener('click', () => joga(r, V.raca, data)); }

function vistaRecebido(box) { const r = V.receita; if (!V.raca) V.raca = racaInicial(r);
  box.innerHTML = '<div class="eyebrow">' + esc(T('desafio.rec.eyebrow', { codigo: D().bonito(V.codigo) })) + '</div><h2 id="dd-h">' + esc(titulo(r)) + '</h2><p class="dd-p">' + esc(T('desafio.rec.texto')) + '</p>' + resumoHtml(r) + racasHtml(r, V.raca, 'desafio.raca.de-quem') +
    '<button type="button" id="dd-aceitar" class="btn primary big">' + esc(T('desafio.rec.aceitar')) + '</button><div class="small muted" id="dd-nota" role="status"></div><div class="row"><button type="button" class="btn" data-dd-vista="hoje" id="dd-ir-hoje">' + esc(T('desafio.ver-hoje')) + '</button><button type="button" class="btn" data-dd-vista="fechar" id="dd-fechar">' + esc(T('desafio.rec.agora-nao')) + '</button></div>';
  botoesComuns(box); $('dd-aceitar').addEventListener('click', () => joga(r, V.raca, null)); }

function vistaErro(box) { const k = ['vazio', 'formato', 'versao', 'soma', 'conteudo'].includes(V.erro) ? V.erro : 'formato';
  box.innerHTML = '<div class="eyebrow">' + esc(T('desafio.erro.eyebrow')) + '</div><h2 id="dd-h">' + esc(T('desafio.erro.titulo')) + '</h2><p class="dd-p">' + esc(T('desafio.erro.' + k)) + '</p>' + (V.texto ? '<p class="dd-cod-ruim" id="dd-cod-ruim">' + esc(String(V.texto).slice(0, 60)) + '</p>' : '') + '<p class="dd-p small muted">' + esc(T('desafio.erro.dica')) + '</p>' +
    '<div class="row"><button type="button" class="btn primary" data-dd-vista="hoje" id="dd-ir-hoje">' + esc(T('desafio.ver-hoje')) + '</button><button type="button" class="btn" data-dd-vista="montar" id="dd-ir-montar">' + esc(T('desafio.montar.botao')) + '</button><button type="button" class="btn" data-dd-vista="fechar" id="dd-fechar">' + esc(T('diplo.fechar')) + '</button></div>';
  botoesComuns(box); }

function vistaDesafiar(box) { const r = V.receita, cod = D().codigo(r), link = linkDe(cod);
  box.innerHTML = '<div class="eyebrow">' + esc(T('desafio.amigo.eyebrow')) + '</div><h2 id="dd-h">' + esc(titulo(r)) + '</h2><p class="dd-p">' + esc(T('desafio.amigo.texto')) + '</p>' + resumoHtml(r) + (V.linha ? '<p class="dd-p dd-seu"><span>' + esc(T('desafio.amigo.seu')) + '</span> ' + esc(V.linha) + '</p>' : '') + saidaHtml(cod, link) +
    '<div class="row"><button type="button" class="btn primary" id="dd-copiar-link">' + esc(T('desafio.copiar-link')) + '</button>' + (podeEnviar() ? '<button type="button" class="btn" id="dd-enviar">' + esc(T('fim.compartilhar')) + '</button>' : '') + '<button type="button" class="btn" data-dd-vista="fechar" id="dd-fechar">' + esc(T('diplo.fechar')) + '</button></div>';
  botoesComuns(box); saidaLiga(r, cod, link); }
function saidaHtml(cod, link) { return '<div class="dd-saida"><div class="dd-cod"><span>' + esc(T('desafio.codigo')) + '</span><b id="dd-codigo">' + esc(D().bonito(cod)) + '</b></div><div class="opt"><label for="dd-link">' + esc(T('desafio.link')) + '</label><input id="dd-link" readonly value="' + esc(link) + '"></div><div class="small muted" id="dd-nota" role="status"></div></div>'; }
function saidaLiga(r, cod, link) { const b = $('dd-copiar-link'); if (b) b.addEventListener('click', () => copia(link, $('dd-link'), $('dd-nota'), 'desafio.link-copiado')); const e = $('dd-enviar'); if (e) e.addEventListener('click', () => envia(r, cod)); const i = $('dd-link'); if (i) i.addEventListener('focus', () => { try { i.select(); } catch (x) {} }); }

/* ---------- montar um desafio ---------- */
function formInicial() { const b = DEPS && DEPS.cfgBase ? DEPS.cfgBase() : {}; const minha = D().RACAS.includes(b.faction) ? b.faction : 'vehnar'; const outras = D().RACAS.filter(f => f !== minha);
  return { modo: 'blitz', mapa: 'fenda', raca: '', dif: 'normal', n: 1, ias: outras.slice(0, 3), chefe: 'arauto', mut: [], eventos: false, mundo: false, cmd: false, seed: 1000 + Math.floor(Math.random() * 90000) }; } /* o sorteio da semente é da interface (fora da simulação) */
function receitaDoForm(m) { const base = { modo: m.modo, seed: m.seed, raca: m.raca || null, dif: m.dif, mut: m.mut.slice() };
  if (m.modo === 'blitz') return D().normaliza(Object.assign(base, { ias: [m.ias[0]] }));
  if (m.modo === 'cacada') return D().normaliza(Object.assign(base, { chefe: m.chefe, ias: m.ias.slice(0, Math.min(2, m.n)), cmd: m.cmd }));
  return D().normaliza(Object.assign(base, { mapa: m.mapa, ias: m.ias.slice(0, Math.max(1, Math.min(3, m.n))), eventos: m.eventos, mundo: m.mundo ? D().MUNDO.slice() : [], cmd: m.cmd })); }
function vistaMontar(box) { const m = V.m || (V.m = formInicial()); if (m.modo === 'cacada') m.n = Math.min(2, m.n); else if (m.modo === 'escaramuca') m.n = Math.max(1, Math.min(3, m.n)); else m.n = 1;
  const r = receitaDoForm(m); const cod = r ? D().codigo(r) : null; const link = cod ? linkDe(cod) : '';
  const sel = (id, rot, ops, v) => '<div class="opt"><label for="' + id + '">' + esc(rot) + '</label><select id="' + id + '">' + ops.map(o => '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(v) ? ' selected' : '') + '>' + esc(o[1]) + '</option>').join('') + '</select></div>';
  const chk = (id, rot, on, desc) => '<label class="chk dd-chk"><input type="checkbox" id="' + id + '"' + (on ? ' checked' : '') + '> <span><b>' + esc(rot) + '</b>' + (desc ? '<small>' + esc(desc) + '</small>' : '') + '</span></label>';
  const racas = D().RACAS.map(f => [f, nRaca(f)]); let h = '<div class="eyebrow">' + esc(T('desafio.montar.eyebrow')) + '</div><h2 id="dd-h">' + esc(T('desafio.montar.titulo')) + '</h2><p class="dd-p">' + esc(T('desafio.montar.texto')) + '</p><div class="dd-form">';
  h += sel('ddm-modo', T('modos.blitz.modo'), [['blitz', T('modos.blitz.opcao')], ['escaramuca', T('modos.blitz.escaramuca')], ['cacada', T('modos.cac.titulo')]], m.modo);
  if (m.modo === 'cacada') h += sel('ddm-chefe', T('modos.cac.chefao'), D().CHEFES.map(c => [c, nChefe(c) + ' · ' + nMapa(D().ARENA[c])]), m.chefe);
  if (m.modo === 'escaramuca') h += sel('ddm-mapa', T('desafio.i.mapa'), D().MAPAS.map(k => [k, nMapa(k)]), m.mapa);
  h += sel('ddm-dif', T('desafio.i.dif'), D().DIFS.map(k => [k, nDif(k)]), m.dif);
  if (m.modo === 'escaramuca') h += sel('ddm-n', T('desafio.montar.inimigos'), [[1, '1'], [2, '2'], [3, '3']], m.n);
  if (m.modo === 'cacada') h += sel('ddm-n', T('modos.cac.aliados'), [[0, T('modos.cac.sozinho')], [1, T('modos.cac.ia1')], [2, T('modos.cac.ia2')]], m.n);
  for (let i = 0; i < m.n; i++) h += sel('ddm-ia' + i, T(m.modo === 'cacada' ? 'desafio.montar.aliada' : 'desafio.montar.rival', { n: i + 1 }), racas, m.ias[i]);
  h += sel('ddm-raca', T('desafio.montar.raca'), [['', T('desafio.montar.livre')]].concat(racas), m.raca);
  h += '<div class="opt"><label for="ddm-seed">' + esc(T('desafio.i.semente')) + '</label><div class="row dd-seed"><input id="ddm-seed" inputmode="numeric" maxlength="10" value="' + esc(m.seed) + '"><button type="button" class="btn" id="ddm-sortear">' + esc(T('desafio.montar.sortear')) + '</button></div></div></div>';
  h += '<div class="dd-regras"><div class="mut-tit">' + esc(T('modos.mut.titulo')) + '</div>' + D().MUTS.map(k => chk('ddm-mut-' + k, nMut(k), m.mut.includes(k), T('modos.mut.' + k + '-d'))).join('');
  if (m.modo === 'escaramuca') h += chk('ddm-eventos', T('modos.ev.titulo'), m.eventos) + chk('ddm-mundo', T('mundo.titulo'), m.mundo); if (m.modo !== 'blitz') h += chk('ddm-cmd', T('cmd.opcao'), m.cmd); h += '</div>';
  h += r ? '<div class="dd-pronto"><div class="dd-pronto-t">' + esc(curto(r)) + '</div>' + saidaHtml(cod, link) + '</div>' : '<p class="dd-p">' + esc(T('desafio.montar.invalido')) + '</p><div class="small muted" id="dd-nota" role="status"></div>';
  h += '<div class="row">' + (r ? '<button type="button" class="btn primary" id="dd-copiar-link">' + esc(T('desafio.copiar-link')) + '</button>' + (podeEnviar() ? '<button type="button" class="btn" id="dd-enviar">' + esc(T('fim.compartilhar')) + '</button>' : '') + '<button type="button" class="btn" id="dd-jogar-meu">' + esc(T('desafio.montar.jogar')) + '</button>' : '') + '<button type="button" class="btn" data-dd-vista="hoje" id="dd-ir-hoje">' + esc(T('desafio.ver-hoje')) + '</button><button type="button" class="btn" data-dd-vista="fechar" id="dd-fechar">' + esc(T('diplo.fechar')) + '</button></div>';
  h += '<div class="dd-tenho"><div class="opt"><label for="dd-colar">' + esc(T('desafio.tenho.rotulo')) + '</label><div class="row dd-seed"><input id="dd-colar" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="60" placeholder="1XXX-XXXX-XXXX"><button type="button" class="btn" id="dd-abrir-cod">' + esc(T('desafio.tenho.abrir')) + '</button></div></div></div>';
  box.innerHTML = h; botoesComuns(box);
  const muda = (id, f) => { const e = $(id); if (e) e.addEventListener('change', () => { f(e); pinta(); }); };
  muda('ddm-modo', e => { m.modo = e.value; if (m.modo === 'cacada') m.n = 0; else m.n = 1; }); muda('ddm-chefe', e => { m.chefe = e.value; }); muda('ddm-mapa', e => { m.mapa = e.value; }); muda('ddm-dif', e => { m.dif = e.value; }); muda('ddm-n', e => { m.n = +e.value; }); muda('ddm-raca', e => { m.raca = e.value; });
  for (let i = 0; i < m.n; i++) muda('ddm-ia' + i, e => { m.ias[i] = e.value; }); for (const k of D().MUTS) muda('ddm-mut-' + k, e => { m.mut = D().MUTS.filter(x => x === k ? e.checked : m.mut.includes(x)); });
  muda('ddm-eventos', e => { m.eventos = e.checked; }); muda('ddm-mundo', e => { m.mundo = e.checked; }); muda('ddm-cmd', e => { m.cmd = e.checked; });
  muda('ddm-seed', e => { const v = parseInt(String(e.value).replace(/\D/g, ''), 10); m.seed = v >= 1 && v <= 4294967295 ? v : m.seed; });
  $('ddm-sortear').addEventListener('click', () => { m.seed = 1000 + Math.floor(Math.random() * 90000); pinta(); const b = $('ddm-sortear'); if (b) b.focus(); });
  if (r) { saidaLiga(r, cod, link); $('dd-jogar-meu').addEventListener('click', () => joga(r, r.raca || racaInicial(r), null)); }
  const abreCod = () => { const t = $('dd-colar').value; if (!String(t).trim()) { $('dd-colar').focus(); return; } recebe(t, V && V.volta); }; $('dd-abrir-cod').addEventListener('click', abreCod); $('dd-colar').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); abreCod(); } }); }

/* um código que chegou (pelo link ou colado): mostra o desafio, ou o aviso amigável. Aceita também o link inteiro colado. */
function recebe(txt, volta) { let t = String(txt == null ? '' : txt); const m = /[?&]desafio=([^&#\s]+)/i.exec(t); if (m) { try { t = decodeURIComponent(m[1]); } catch (e) { t = m[1]; } }
  if (/^(hoje|today|hoy)$/i.test(t.trim())) { abre('hoje', { volta }); return; }
  const r = D().ler(t); if (r.ok) abre('recebido', { receita: r.receita, codigo: r.codigo, volta }); else abre('erro', { erro: r.erro, texto: t, volta }); }

/* ---------- a entrada na tela inicial ---------- */
function entradaHtml() { const data = hoje(); const r = D().receitaDoDia(data); const st = D().estado(data);
  return '<span class="dd-e-rot">' + esc(T('desafio.nome')) + '<i>' + esc(dataTxt(data)) + '</i></span><b class="dd-e-tit">' + esc(titulo(r)) + '</b><span class="dd-e-sub">' + esc([nDif(r.dif)].concat(r.mut.map(nMut)).concat(r.modo === 'cacada' ? [nMapa(r.mapa)] : []).join(' · ')) + '</span>' +
    '<span class="dd-e-pe"><span class="dd-e-seq' + (st.jogouHoje ? ' ok' : '') + '">' + esc(st.jogouHoje ? T('desafio.e.feito') + (st.seq > 1 ? ' · ' + seqTxt(st.seq) : '') : st.seq ? T('desafio.e.manter', { seq: seqTxt(st.seq) }) : T('desafio.e.comecar')) + '</span><span class="dd-e-falta">' + esc(T('desafio.e.novo-em')) + ' <b id="dd-e-falta">' + faltaTxt(D().faltaMs(agora())) + '</b></span></span>'; }
function entrada() { const con = document.querySelector('#start .opts.console'); if (!con) return; let b = $('dd-entrada');
  if (!b) { b = document.createElement('button'); b.type = 'button'; b.id = 'dd-entrada'; b.className = 'dd-entrada'; const ref = con.querySelector('.ctabs'); if (ref) con.insertBefore(b, ref); else con.prepend(b); b.addEventListener('click', () => abre('hoje')); }
  b.innerHTML = entradaHtml(); b.setAttribute('aria-label', T('desafio.e.aria', { desafio: titulo(D().receitaDoDia(hoje())) }));
  const mj = document.querySelector('#start .cpane[data-pane=jogar] .modo-jogar'); if (mj) { let a = $('dd-atalhos'); if (!a) { a = document.createElement('div'); a.id = 'dd-atalhos'; a.className = 'row dd-atalhos'; mj.after(a); a.addEventListener('click', e => { const x = e.target.closest('[data-dd-abre]'); if (x) abre(x.dataset.ddAbre); }); }
    a.innerHTML = '<button type="button" class="btn" id="dd-atalho-hoje" data-dd-abre="hoje">' + esc(T('desafio.nome')) + '</button><button type="button" class="btn ghost" id="dd-atalho-montar" data-dd-abre="montar">' + esc(T('desafio.montar.botao')) + '</button>'; } }
function tique() { if (document.body.classList.contains('ingame')) { para(); return; } const d = hoje(); if (d !== HOJE) { HOJE = d; entrada(); if (V && V.vista === 'hoje') pinta(); return; }
  const t = faltaTxt(D().faltaMs(agora())); const a = $('dd-e-falta'); if (a) a.textContent = t; const b = $('dd-falta'); if (b) b.textContent = t; }
function para() { if (TIMER) { clearInterval(TIMER); TIMER = 0; } }

/* deps (do src/main.js): { params, ocupado(), startGame(cfg), cfgBase() → { name, faction, gfx, quality, clima } } */
function inicio(deps) { DEPS = deps; if (!D()) return; HOJE = hoje(); entrada(); para(); TIMER = setInterval(tique, 1000);
  { const c = $('cartao'); if (c && c.parentNode !== document.body) document.body.appendChild(c); } /* a janela do cartão sai de dentro de #game: o cartão de conquista também abre na tela inicial */
  conquistasNaLista();
  const q = deps.params; const cod = q && q.get('desafio'); if (cod == null || q.get('autostart') || q.get('bench') || window.__rejoining) return;
  if (q.get('jogar') === '1') { const r = /^(hoje|today|hoy)$/i.test(cod) ? { ok: true, receita: D().receitaDoDia(HOJE), diario: HOJE } : D().ler(cod); if (r.ok) { const raca = D().RACAS.includes(q.get('raca')) ? q.get('raca') : r.receita.raca || racaInicial(r.receita); const cfg = D().cfgJogo(r.receita, deps.cfgBase(), raca, { diario: r.diario || null }); guardaCurso(cfg.desafio); para(); deps.startGame(cfg); return; } } /* ?desafio=CÓDIGO&jogar=1 (&raca=): começa direto, para testes e capturas */
  recebe(cod, null); }

/* ---------- conquistas: o cartão ---------- */
function conquistasNaLista() { const el = $('camp-ach'); if (!el || !ARD.campaign || !ARD.cartoes) return; const C = ARD.campaign;
  const marca = () => { [...el.children].forEach((d, i) => { const a = C.ACHIEVEMENTS[i]; if (!a || d.classList.contains('locked') || d.dataset.ddConq === a.id) return; d.dataset.ddConq = a.id; d.setAttribute('tabindex', '0'); d.setAttribute('role', 'button'); d.setAttribute('aria-label', T('cartao.conq.abrir', { nome: C.conquista(a.id) })); d.title = T('cartao.conq.abrir', { nome: C.conquista(a.id) }); }); };
  const vai = e => { const d = e.target.closest && e.target.closest('[data-dd-conq]'); if (!d || !el.contains(d)) return; if (e.type === 'keydown') { if (e.key !== 'Enter' && e.key !== ' ') return; e.preventDefault(); } ARD.cartoes.abrirConquista(d.dataset.ddConq); };
  el.addEventListener('click', vai); el.addEventListener('keydown', vai); new MutationObserver(marca).observe(el, { childList: true }); marca(); }

/* ---------- tela final ---------- */
function resultadoDe(o) { const sim = o.sim, p = sim.players[o.human], cz = o.result && o.result.cacada; return { venceu: !!o.venceu, tempo: cz ? cz.tempo : o.tempo != null ? o.tempo : sim.time, dominio: p.alive && ARD.sim ? ARD.sim.score(sim, p) : 0, perdas: cz ? cz.perdas : p.stats.unitsLost, medalha: cz ? cz.medalha : null, raca: p.faction }; }
function linha(F) { const r = F.rec, res = F.res; const partes = ['Aether Rift: Dominion']; if (F.diario) partes.push(T('desafio.linha.diario', { data: dataTxt(F.diario) })); partes.push(curto(r)); partes.push(recTxt(r, res));
  if (F.diario && F.reg && F.reg.seq > 1) partes.push(seqTxt(F.reg.seq)); if (!F.diario) partes.push(T('desafio.linha.codigo', { codigo: D().bonito(D().codigo(r)) }));
  if (D().LINK_NA_LINHA) partes.push(linkDe(D().codigo(r))); return partes.join(' · '); }
function fim(o) { const end = $('end'); if (!end || !D()) return; const G = o.G, sim = o.sim; let el = $('fim-desafio');
  if (!el) { el = document.createElement('div'); el.id = 'fim-desafio'; el.className = 'fim-desafio'; const ref = end.querySelector('.fim-botoes'); if (ref) ref.after(el); else end.appendChild(el); }
  const rec = o.tipo === 'campanha' || o.tipo === 'guia' || o.tipo === 'multi' ? null : D().deSim(sim, o.human); let ctx = null;
  if (rec) { const c = (G && G.cfg && G.cfg.desafio) || curso(); if (c && c.receita && mesma(c.receita, rec)) ctx = c; }
  const res = rec ? resultadoDe(o) : null; let reg = null; if (ctx && ctx.diario && !o._ddReg) { o._ddReg = true; try { reg = D().registrar(ctx.diario, res); } catch (e) { console.warn('[ARD] desafio (registro):', e); } }
  if (ctx) try { localStorage.removeItem(CURSO); } catch (e) {} /* só quando a partida que acabou é o desafio guardado: outra partida no meio não apaga um desafio salvo para retomar */
  let conq = []; try { const a = ARD.progress.load().achievements; const t = agora(); conq = ARD.campaign.ACHIEVEMENTS.filter(z => a[z.id] && t - a[z.id] < 5000).map(z => z.id); } catch (e) {}
  FIM = { o, rec, res, reg, ctx, diario: ctx && ctx.diario ? ctx.diario : null, conq }; pintaFim();
  if (ctx) { const ba = $('btn-again'); if (ba) ba.onclick = () => { try { location.href = location.pathname + '?desafio=' + (FIM.diario && FIM.diario === hoje() ? 'hoje' : D().codigo(ctx.receita)) + '&jogar=1&raca=' + res.raca + (new URLSearchParams(location.search).get('r') === '2d' ? '&r=2d' : ''); } catch (e) { location.reload(); } }; } } /* "Jogar de novo" num desafio repete o mesmo desafio, com a mesma Raça */
/* dois lugares na tela final: #fim-desafio (acima dos botões, só nas partidas de desafio: situação do dia e a linha para colar, à vista sem rolar)
   e #fim-extras (abaixo dos botões: "Desafiar um amigo" nas outras partidas e o cartão de cada conquista desbloqueada) */
function pintaFim() { const F = FIM; const el = $('fim-desafio'); if (!F || !el) return; const o = F.o; let h = ''; const end = $('end'); const bots = end && end.querySelector('.fim-botoes'); const des = F.rec ? '<button type="button" class="btn" id="fd-desafiar">' + esc(T('desafio.amigo.botao')) + '</button>' : '';
  let ex = $('fim-extras'); if (!ex) { ex = document.createElement('div'); ex.id = 'fim-extras'; ex.className = 'row fd-botoes'; if (bots) bots.after(ex); else if (end) end.appendChild(ex); }
  if (bots && el.nextElementSibling !== bots) bots.before(el);
  if (F.rec && F.ctx) { const tx = linha(F); o.desafio = { selo: F.diario ? T('desafio.selo.diario', { data: dataTxt(F.diario) }) : T('desafio.selo.codigo', { codigo: D().bonito(D().codigo(F.rec)) }), desc: curto(F.rec), descs: curtos(F.rec) }; o.textoLinha = () => linha(F);
    h += '<div class="fd-topo"><span class="eyebrow">' + esc(F.diario ? T('desafio.hoje.eyebrow', { data: dataTxt(F.diario) }) : T('desafio.rec.eyebrow', { codigo: D().bonito(D().codigo(F.rec)) })) + '</span>';
    if (F.diario && F.reg) h += '<span class="fd-st">' + esc(F.reg.recorde ? T(F.reg.jogadasHoje > 1 ? 'desafio.fim.recorde-novo' : 'desafio.fim.primeiro') : T('desafio.fim.recorde-fica', { rec: recTxt(F.rec, F.reg.rec) })) + '</span><span class="fd-st">' + esc(seqTxt(Math.max(1, F.reg.seq))) + '</span><span class="fd-st fd-prox">' + esc(T('desafio.fim.proximo', { t: faltaTxt(D().faltaMs(agora())).slice(0, 5) })) + '</span>';
    h += '</div><div class="fd-linha"><label for="fd-texto" class="dd-vh">' + esc(T('desafio.fim.linha')) + '</label><div class="row"><input id="fd-texto" readonly title="' + esc(T('desafio.fim.linha')) + '" value="' + esc(tx) + '"><button type="button" class="btn primary" id="fd-copiar">' + esc(T('desafio.fim.copiar')) + '</button>' + des + '</div><div class="small" id="fd-nota" role="status"></div></div>'; }
  else { o.desafio = null; o.textoLinha = null; }
  el.innerHTML = h; el.hidden = !h; if (end) end.classList.toggle('fim-com-desafio', !!h);
  let bt = F.rec && !F.ctx ? des : ''; for (const id of F.conq) bt += '<button type="button" class="btn" data-fd-conq="' + esc(id) + '">' + esc(T('cartao.conq.botao', { nome: ARD.campaign.conquista(id) })) + '</button>';
  ex.innerHTML = bt; ex.hidden = !bt;
  const bc = $('fd-copiar'); if (bc) bc.addEventListener('click', () => copia($('fd-texto').value, $('fd-texto'), $('fd-nota'), 'desafio.fim.copiado')); const ft = $('fd-texto'); if (ft) ft.addEventListener('focus', () => { try { ft.select(); } catch (e) {} });
  const bd = $('fd-desafiar'); if (bd) bd.addEventListener('click', () => abre('desafiar', { receita: F.rec, linha: recTxt(F.rec, F.res) }));
  ex.querySelectorAll('[data-fd-conq]').forEach(b => b.addEventListener('click', () => ARD.cartoes && ARD.cartoes.abrirConquista(b.dataset.fdConq))); }

if (typeof window !== 'undefined') window.addEventListener('ard-idioma', () => { try { if ($('dd-entrada') && !document.body.classList.contains('ingame')) entrada(); if (V && $('desafio') && !$('desafio').hidden) pinta(); if (FIM && $('end') && !$('end').hidden) pintaFim(); const l = $('camp-ach'); if (l) [...l.children].forEach(d => { delete d.dataset.ddConq; }); } catch (e) {} });

ARD.desafioUI = { inicio, fim, abre, fecha, recebe, titulo, itens, curto, curtos, linha, dataTxt, get vista() { return V; }, get ultimoFim() { return FIM; } };
})(globalThis.ARD = globalThis.ARD || {});
