/* Aether Rift: Dominion — 5.0g: interface dos modos (aba Caçada da tela inicial, regras da Fenda na Escaramuça e na sala, cartão da
   partida, fim da Caçada com medalha, recorde e recompensas, e os troféus no Hangar). Só interface e progresso local: a regra mora no
   src/modos.js (simulação). Textos pelas chaves modos.* dos três dicionários. */
(function (ARD) {
'use strict';
const T = (k, v, r) => (ARD.t ? ARD.t(k, v, r) : (r != null ? r : k));
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const mmss = t => { t = Math.max(0, Math.floor(t)); return String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0'); };
const MO = () => ARD.modos, P = () => ARD.progress;
const CHEFES = ['arauto', 'forja'];
const DIFS = ['facil', 'normal', 'dificil', 'brutal'];
const MEDAL_RANK = { bronze: 1, prata: 2, ouro: 3 };
const KEY = 'ard-modos-v1';
function prefs() { try { return Object.assign({ chefe: 'arauto', dif: 'normal', aliados: '0', mutJogar: [], mutCac: [], eventos: false, lente: false, salaModo: 'escaramuca', salaChefe: 'arauto', salaDif: 'normal', salaMut: [] }, JSON.parse(localStorage.getItem(KEY) || '{}') || {}); } catch (e) { return { chefe: 'arauto', dif: 'normal', aliados: '0', mutJogar: [], mutCac: [], eventos: false, lente: false, salaModo: 'escaramuca', salaChefe: 'arauto', salaDif: 'normal', salaMut: [] }; } }
function guarda(patch) { const p = Object.assign(prefs(), patch); try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) {} return p; }
/* nomes */
const nomeChefe = id => T('chefe.' + id + '.nome', null, { arauto: 'O Arauto', forja: 'A Forja-Mãe', sentinela: 'Sentinela da Fenda' }[id] || id);
const tituloChefe = id => T('chefe.' + id + '.titulo', null, { arauto: 'o primeiro a atravessar', forja: 'a fábrica antiga que anda', sentinela: 'a vigia desperta da Fenda' }[id] || '');
const nomeDif = k => (ARD.i18n && ARD.i18n.d ? ARD.i18n.d.dificuldade(k) : k);
const nomeMapa = k => ARD.i18n && ARD.i18n.d ? ARD.i18n.d.mapa(k) : (k === 'tita' ? 'Destroço do Titã' : k); /* 5.0g junção: o Titã usa a chave mapa.tita do g-sim */
const nomeMut = k => T('modos.mut.' + k, null, { noite: 'Noite Eterna', tempestades: 'Tempestades Frequentes', escassos: 'Recursos Escassos' }[k]);
const descMut = k => T('modos.mut.' + k + '-d', null, { noite: 'a noite não acaba e a visão cai 25%', tempestades: 'Tempestades de Éter o dobro de vezes; dentro delas, unidades 10% mais lentas', escassos: 'nós e destroços rendem a metade' }[k]);
const nomeMedalha = m => T('modos.medalha.' + m, null, { ouro: 'Ouro', prata: 'Prata', bronze: 'Bronze' }[m]);
const nomeTitulo = k => T('modos.titulo.' + k, null, { 'cacador-arauto': 'Caçador do Arauto', 'quebra-forja': 'Quebra-Forja', 'cacador-ouro': 'Caçador de Ouro' }[k] || k);
/* glifos dos chefões (SVG próprio, feito aqui: o olho com três anéis do Arauto e a fábrica de quatro pernas da Forja-Mãe) */
const GLIFO = {
  arauto: '<svg viewBox="0 0 64 64" aria-hidden="true"><ellipse cx="32" cy="32" rx="27" ry="10" fill="none" stroke="currentColor" stroke-width="2" opacity=".55" transform="rotate(-18 32 32)"/><ellipse cx="32" cy="32" rx="22" ry="22" fill="none" stroke="currentColor" stroke-width="2" opacity=".35"/><ellipse cx="32" cy="32" rx="10" ry="26" fill="none" stroke="currentColor" stroke-width="2" opacity=".55" transform="rotate(24 32 32)"/><path d="M32 18 L42 32 L32 46 L22 32 Z" fill="currentColor" opacity=".25"/><circle cx="32" cy="32" r="6" fill="currentColor"/><circle cx="32" cy="32" r="2.4" fill="#fff"/></svg>',
  forja: '<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="18" y="16" width="28" height="18" rx="2" fill="currentColor" opacity=".35"/><rect x="22" y="8" width="5" height="10" fill="currentColor" opacity=".7"/><rect x="36" y="5" width="5" height="13" fill="currentColor" opacity=".7"/><circle cx="32" cy="26" r="4" fill="#fff" opacity=".9"/><path d="M18 30 L6 46 L10 56 M46 30 L58 46 L54 56 M24 34 L18 50 L22 58 M40 34 L46 50 L42 58" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/></svg>',
};
let D = null; /* dependências do main.js */

/* ---------- regras da Fenda (Escaramuça, Caçada e sala) ---------- */
function chipsMut(id, sel, onChange) { const el = $(id); if (!el) return;
  el.innerHTML = '<div class="mut-tit">' + esc(T('modos.mut.titulo', null, 'Mutadores')) + '</div><div class="mut-chips">' + MO().MUT_IDS.map(k => `<button type="button" class="mut ${sel.includes(k) ? 'on' : ''}" data-mut="${k}" aria-pressed="${sel.includes(k) ? 'true' : 'false'}"><b>${esc(nomeMut(k))}</b><small>${esc(descMut(k))}</small></button>`).join('') + '</div>';
  el.querySelectorAll('[data-mut]').forEach(b => b.addEventListener('click', () => { const k = b.dataset.mut; const i = sel.indexOf(k); if (i >= 0) sel.splice(i, 1); else sel.push(k); b.classList.toggle('on', i < 0); b.setAttribute('aria-pressed', i < 0 ? 'true' : 'false'); onChange(sel.slice()); })); }
function temLente() { try { return P().load().cacada.reliquias.includes('lente-arauto'); } catch (e) { return false; } }
function linhaLente(id, on, onChange) { const el = $(id); if (!el) return; el.hidden = !temLente(); if (el.hidden) return;
  el.innerHTML = `<label class="chk"><input type="checkbox" ${on ? 'checked' : ''}> <span><b>${esc(T('modos.lente', null, 'Lente do Arauto'))}</b> · ${esc(T('modos.lente-d', null, '+10% de visão nesta partida'))}</span></label>`;
  el.querySelector('input').addEventListener('change', e => onChange(e.target.checked)); }
function desenhaJogar() { const p = prefs(); const el = $('regras-jogar'); if (!el) return;
  el.innerHTML = `<label class="chk ev-chk"><input type="checkbox" id="opt-eventos" ${p.eventos ? 'checked' : ''}> <span><b>${esc(T('modos.ev.titulo', null, 'Eventos da Fenda'))}</b><small>${esc(T('modos.ev.desc', null, 'Sentinela da Fenda, Caravana Corsária, Enxame Errante e chuva de meteoros durante a partida'))}</small></span></label><div id="mut-jogar"></div><div id="lente-jogar" class="lente-l" hidden></div>`;
  $('opt-eventos').addEventListener('change', e => guarda({ eventos: e.target.checked }));
  chipsMut('mut-jogar', p.mutJogar.slice(), v => guarda({ mutJogar: v })); linhaLente('lente-jogar', p.lente, v => guarda({ lente: v })); }

/* ---------- aba Caçada ---------- */
function recordeDe(chefe, dif) { try { return (P().load().cacada.recordes || {})[chefe + '|' + dif] || null; } catch (e) { return null; } }
function desenhaCacada() { const el = document.querySelector('.cpane[data-pane=cacada]'); if (!el) return; const p = prefs(); const M = MO();
  const card = id => { const r = recordeDe(id, p.dif); const med = r && r.medalha ? `<span class="medal m-${r.medalha}">${esc(nomeMedalha(r.medalha))}</span>` : '';
    return `<button type="button" class="cac-card ${p.chefe === id ? 'on' : ''}" data-chefe="${id}" role="radio" aria-checked="${p.chefe === id ? 'true' : 'false'}"><span class="cac-gl">${GLIFO[id]}</span><span class="cac-tx"><b>${esc(nomeChefe(id))}</b><small>${esc(tituloChefe(id))}</small><span class="cac-arena">${esc(T('modos.cac.arena', { mapa: nomeMapa(M.CACADA[id].mapa) }, 'Arena: {mapa}'))}</span><span class="cac-rec">${r && r.melhor ? esc(T('modos.cac.recorde', { t: mmss(r.melhor) }, 'Recorde: {t}')) + ' ' + med : esc(T('modos.cac.sem-recorde', null, 'Sem recorde ainda'))}</span></span></button>`; };
  const opt = (v, k, pt) => `<option value="${v}">${esc(T(k, null, pt))}</option>`;
  el.innerHTML = `<div class="chead"><b>${esc(T('modos.cac.titulo', null, 'Caçada'))}</b><span>${esc(T('modos.cac.sub', null, 'derrube um chefão da Fenda, sozinho ou com amigos'))}</span></div>
    <div class="cac-chefes" role="radiogroup" aria-label="${esc(T('modos.cac.chefao', null, 'Chefão'))}">${CHEFES.map(card).join('')}</div>
    <div class="cgrid"><div class="opt"><label for="cac-dif">${esc(T('modos.cac.dificuldade', null, 'Dificuldade'))}</label><select id="cac-dif" data-seg>${DIFS.map(d => `<option value="${d}">${esc(nomeDif(d))}</option>`).join('')}</select></div>
    <div class="opt"><label for="cac-aliados">${esc(T('modos.cac.aliados', null, 'Aliados'))}</label><select id="cac-aliados" data-seg>${opt('0', 'modos.cac.sozinho', 'Sozinho')}${opt('1', 'modos.cac.ia1', '1 IA aliada')}${opt('2', 'modos.cac.ia2', '2 IAs aliadas')}${opt('amigos', 'modos.cac.amigos', 'Amigos')}</select></div></div>
    <div id="mut-cac"></div><div id="lente-cac" class="lente-l" hidden></div>
    <p class="cdesc small">${esc(T('modos.cac.regras', null, 'Vitória: derrubar o chefão. Derrota: perder o Núcleo (no cooperativo, todos os Núcleos). Medalha por tempo e perdas.'))} ${esc(T('modos.cac.medalhas', { t1: mmss(M.MEDALHAS.ouro.t), p1: M.MEDALHAS.ouro.perdas, t2: mmss(M.MEDALHAS.prata.t), p2: M.MEDALHAS.prata.perdas }, 'Ouro: até {t1} e {p1} perdas · Prata: até {t2} e {p2} perdas · Bronze: qualquer vitória'))}</p>
    <button id="btn-cacada" class="btn primary big">${esc(T(p.aliados === 'amigos' ? 'modos.cac.ir-sala' : 'modos.cac.iniciar', null, p.aliados === 'amigos' ? 'Abrir a sala cooperativa' : 'Iniciar Caçada'))}</button>`;
  $('cac-dif').value = DIFS.includes(p.dif) ? p.dif : 'normal'; $('cac-aliados').value = ['0', '1', '2', 'amigos'].includes(p.aliados) ? p.aliados : '0';
  if (ARD.uiStart && ARD.uiStart.segmented) { ARD.uiStart.segmented($('cac-dif')); ARD.uiStart.segmented($('cac-aliados')); }
  el.querySelectorAll('[data-chefe]').forEach(b => b.addEventListener('click', () => { guarda({ chefe: b.dataset.chefe }); desenhaCacada(); el.querySelector('[data-chefe="' + b.dataset.chefe + '"]').focus(); }));
  $('cac-dif').addEventListener('change', () => { guarda({ dif: $('cac-dif').value }); desenhaCacada(); });
  $('cac-aliados').addEventListener('change', () => { guarda({ aliados: $('cac-aliados').value }); const b = $('btn-cacada'); const am = $('cac-aliados').value === 'amigos'; b.textContent = T(am ? 'modos.cac.ir-sala' : 'modos.cac.iniciar', null, am ? 'Abrir a sala cooperativa' : 'Iniciar Caçada'); });
  chipsMut('mut-cac', p.mutCac.slice(), v => guarda({ mutCac: v })); linhaLente('lente-cac', p.lente, v => guarda({ lente: v }));
  $('btn-cacada').addEventListener('click', iniciaCacada); }
function iniciaCacada() { const p = prefs(); if (!D) return;
  if (p.aliados === 'amigos') { guarda({ salaModo: 'cacada', salaChefe: p.chefe, salaDif: p.dif, salaMut: p.mutCac.slice() }); desenhaSala(); D.showTab('multi', true); return; }
  const base = D.cfgBase(); const cfg = Object.assign(base, { opp: p.aliados, diff: 'normal', map: MO().CACADA[p.chefe].mapa, cacada: { chefe: p.chefe, dif: p.dif }, mutadores: p.mutCac.slice(), lente: !!(p.lente && temLente()) });
  D.startGame(cfg); }

/* ---------- sala (Multiplayer): Escaramuça ou Caçada cooperativa ---------- */
function desenhaSala() { const el = $('regras-sala'); if (!el) return; const p = prefs();
  el.innerHTML = `<div class="opt"><label for="sala-modo">${esc(T('modos.sala.modo', null, 'Modo da sala'))}</label><select id="sala-modo" data-seg><option value="escaramuca">${esc(T('modos.sala.escaramuca', null, 'Escaramuça'))}</option><option value="cacada">${esc(T('modos.sala.cacada', null, 'Caçada'))}</option></select></div>
    <div class="cgrid" id="sala-cac" ${p.salaModo === 'cacada' ? '' : 'hidden'}><div class="opt"><label for="sala-chefe">${esc(T('modos.cac.chefao', null, 'Chefão'))}</label><select id="sala-chefe" data-seg>${CHEFES.map(c => `<option value="${c}">${esc(nomeChefe(c))}</option>`).join('')}</select></div><div class="opt"><label for="sala-dif">${esc(T('modos.cac.dificuldade', null, 'Dificuldade'))}</label><select id="sala-dif" data-seg>${DIFS.map(d => `<option value="${d}">${esc(nomeDif(d))}</option>`).join('')}</select></div></div>
    <div id="mut-sala"></div><p class="small muted" id="sala-dica">${esc(T(p.salaModo === 'cacada' ? 'modos.sala.dica-cac' : 'modos.sala.dica-esc', null, p.salaModo === 'cacada' ? 'Todos os humanos do mesmo lado contra a Fenda; o anfitrião escolhe o chefão.' : 'Todos contra todos; o anfitrião escolhe as regras.'))}</p>`;
  $('sala-modo').value = p.salaModo === 'cacada' ? 'cacada' : 'escaramuca'; $('sala-chefe').value = CHEFES.includes(p.salaChefe) ? p.salaChefe : 'arauto'; $('sala-dif').value = DIFS.includes(p.salaDif) ? p.salaDif : 'normal';
  if (ARD.uiStart && ARD.uiStart.segmented) for (const id of ['sala-modo', 'sala-chefe', 'sala-dif']) ARD.uiStart.segmented($(id));
  const muda = () => { guarda({ salaModo: $('sala-modo').value, salaChefe: $('sala-chefe').value, salaDif: $('sala-dif').value }); $('sala-cac').hidden = $('sala-modo').value !== 'cacada';
    $('sala-dica').textContent = T($('sala-modo').value === 'cacada' ? 'modos.sala.dica-cac' : 'modos.sala.dica-esc', null, $('sala-modo').value === 'cacada' ? 'Todos os humanos do mesmo lado contra a Fenda; o anfitrião escolhe o chefão.' : 'Todos contra todos; o anfitrião escolhe as regras.'); avisaSala(); };
  for (const id of ['sala-modo', 'sala-chefe', 'sala-dif']) $(id).addEventListener('change', muda);
  chipsMut('mut-sala', p.salaMut.slice(), v => { guarda({ salaMut: v }); avisaSala(); }); }
function modoSala() { const p = prefs(); return p.salaModo === 'cacada' ? { modo: 'cacada', chefe: p.salaChefe, dif: p.salaDif, mut: p.salaMut.slice() } : { modo: 'escaramuca', mut: p.salaMut.slice() }; }
function avisaSala() { const L = D && D.lobby && D.lobby(); if (L && L.role === 'host' && L.N) { L.N.modo = modoSala(); if (L.N.relobby) L.N.relobby(); } } /* o anfitrião manda o modo na lista da sala */
/* linha do modo na lista da sala (anfitrião e convidados) */
function linhaSala(el, lobby) { if (!el || !lobby || !lobby.N) return; const m = lobby.role === 'host' ? modoSala() : lobby.N.modo; if (!m) return;
  const d = document.createElement('div'); d.className = 'sala-modo';
  d.textContent = m.modo === 'cacada' ? T('modos.sala.linha-cac', { chefe: nomeChefe(m.chefe), dif: nomeDif(m.dif) }, 'Caçada cooperativa: {chefe} ({dif}) · todos contra a Fenda') : T('modos.sala.linha-esc', null, 'Escaramuça: todos contra todos');
  if (m.mut && m.mut.length) d.textContent += ' · ' + m.mut.map(nomeMut).join(', '); el.prepend(d); }
/* cfg da sala no início (o anfitrião manda para todos) */
function cfgSala() { const m = modoSala(); const o = { mutadores: m.mut }; if (m.modo === 'cacada') { o.cacada = { chefe: m.chefe, dif: m.dif }; o.map = MO().CACADA[m.chefe].mapa; } return o; }

/* ---------- partida ---------- */
function cfgJogar() { const p = prefs(); return { eventos: !!p.eventos, mutadores: p.mutJogar.slice(), lente: !!(p.lente && temLente()) }; }
/* chaves de URL: ?cacada=arauto|forja &cdif= &aliados= &eventos=1 &evento=caravana|enxame|meteoros|sentinela &eventoem=<s> &mut=noite,tempestades,escassos &lente=1 */
function cfgUrl(q) { const o = {}; const c = q.get('cacada'); if (c && MO().CACADA[c]) { o.cacada = { chefe: c, dif: DIFS.includes(q.get('cdif')) ? q.get('cdif') : 'normal' }; o.map = MO().CACADA[c].mapa; o.opp = q.get('aliados') || '0'; }
  if (q.get('eventos') === '1') o.eventos = true; if (q.get('evento')) { o.eventosTeste = q.get('evento'); if (q.get('eventoem')) o.eventosEm = +q.get('eventoem'); } if (q.get('mut')) o.mutadores = q.get('mut').split(','); if (q.get('lente') === '1') o.lente = true; return o; }
/* os jogadores da partida solo: a Lente vai para o humano */
function jogadores(players, cfg) { if (cfg && cfg.lente && players[0] && players[0].human && !cfg.players) players[0].lente = true; return players; }
/* Tempestades Frequentes: com o clima automático, um clima forte que já existe (pela semente) */
function clima(cfg, nome) { if ((nome || 'auto') !== 'auto') return nome; const m = MO().cfgDe(cfg).mutadores || []; if (!m.includes('tempestades')) return nome; const fortes = ['plasma', 'toxica', 'cristais']; return fortes[(Math.abs(cfg.seed | 0)) % fortes.length]; }
/* etiquetas do modo (cartão de carregamento, retomada e fim) */
function etiquetas(cfg) { const r = MO().resumo(cfg); const out = [];
  if (r.cacada) out.push({ k: 'cac', t: T('modos.cartao.cacada', { chefe: nomeChefe(r.cacada.chefe), dif: nomeDif(r.cacada.dif) }, 'Caçada · {chefe} · {dif}') });
  if (r.eventos) out.push({ k: 'ev', t: T('modos.ev.titulo', null, 'Eventos da Fenda') });
  for (const m of r.mutadores) out.push({ k: 'mut', t: nomeMut(m) }); if (r.lente) out.push({ k: 'rel', t: T('modos.lente', null, 'Lente do Arauto') }); return out; }
function cartao(cfg) { try { const box = document.querySelector('#loading .box'); if (!box) return; let el = $('load-modos'); if (!el) { el = document.createElement('div'); el.id = 'load-modos'; el.className = 'modos-tags'; const ref = $('load-tip'); if (ref) ref.before(el); else box.appendChild(el); }
  const tg = etiquetas(cfg); el.hidden = !tg.length; el.innerHTML = tg.map(x => `<span class="mtag t-${x.k}">${esc(x.t)}</span>`).join('');
  if (cfg && cfg.cacada && $('load-title')) $('load-title').textContent = nomeChefe(cfg.cacada.chefe) + ' · ' + nomeMapa(MO().CACADA[cfg.cacada.chefe].mapa); } catch (e) { console.warn('[ARD] modos (cartão):', e); } }
/* título e linha do salvamento (o texto fica em pt-BR no salvamento, como o resto do cartão de retomar) */
function salvo(sim) { const r = MO().resumo(sim); const pt = { arauto: 'O Arauto', forja: 'A Forja-Mãe' }; const mn = { noite: 'Noite Eterna', tempestades: 'Tempestades Frequentes', escassos: 'Recursos Escassos' };
  return { titulo: r.cacada ? 'Caçada · ' + (pt[r.cacada.chefe] || r.cacada.chefe) : null, extra: (r.eventos ? ' · Eventos da Fenda' : '') + (r.mutadores.length ? ' · ' + r.mutadores.map(m => mn[m]).join(', ') : '') }; }
/* faixa do modo na partida (abaixo do topo): os mutadores e a Caçada à vista o tempo todo */
function faixa(sim) { try { const tg = etiquetas(sim.cfg); let el = $('modos-faixa'); if (!tg.length) { if (el) el.hidden = true; return; } if (!el) { el = document.createElement('div'); el.id = 'modos-faixa'; el.className = 'modos-tags faixa'; const g = $('game'); if (g) g.appendChild(el); }
  el.hidden = false; el.innerHTML = tg.filter(x => x.k !== 'cac').map(x => `<span class="mtag t-${x.k}">${esc(x.t)}</span>`).join(''); el.hidden = !el.innerHTML; } catch (e) {} }

/* ---------- fim da Caçada: medalha, recorde e recompensas ---------- */
function fim(result, sim, human) { const c = result && result.cacada; if (!c) return null; let reg = null;
  try { reg = P().registrarCacada({ chefe: c.chefe, dif: c.dif, venceu: result.outcome === 'victory', tempo: c.tempo, perdas: c.perdas, medalha: c.medalha, captura: c.captura }); } catch (e) { console.warn('[ARD] progresso da Caçada:', e); }
  const won = result.outcome === 'victory'; const L = [];
  L.push(`<div class="cac-fim ${won ? 'won' : 'lost'}">${won && c.medalha ? `<div class="medalha-g m-${c.medalha}" role="img" aria-label="${esc(T('modos.fim.medalha', { m: nomeMedalha(c.medalha) }, 'Medalha: {m}'))}"><span>${esc(nomeMedalha(c.medalha))}</span></div>` : ''}<div class="cac-num"><div class="stat"><span>${esc(T('modos.fim.tempo', null, 'Tempo'))}</span><b>${mmss(c.tempo)}</b></div><div class="stat"><span>${esc(T('modos.fim.perdas', null, 'Perdas'))}</span><b>${c.perdas}</b></div>${reg && reg.rec && reg.rec.melhor ? `<div class="stat"><span>${esc(T('modos.fim.recorde', null, 'Recorde'))}</span><b>${mmss(reg.rec.melhor)}</b></div>` : ''}</div></div>`);
  if (reg && reg.novoRecorde) L.push(`<div class="unlock">${esc(T('modos.fim.recorde-novo', null, 'Novo recorde local!'))}</div>`);
  if (reg && reg.trofeu) L.push(`<div class="unlock">${esc(T('modos.fim.trofeu', { chefe: nomeChefe(c.chefe), m: nomeMedalha(reg.trofeu) }, 'Troféu no Hangar: {chefe} ({m})'))}</div>`);
  if (reg && reg.reliquia) L.push(`<div class="unlock">${esc(T('modos.fim.reliquia', null, 'Relíquia: Lente do Arauto (+10% de visão numa partida que você escolher)'))}</div>`);
  if (reg && reg.titulos) for (const t of reg.titulos) L.push(`<div class="unlock">${esc(T('modos.fim.titulo', { t: nomeTitulo(t) }, 'Título: {t}'))}</div>`);
  if (reg && reg.projeto) L.push(`<div class="unlock">${esc(T('modos.fim.projeto', null, 'Projeto recuperado da Forja-Mãe: a unidade nova chega numa próxima versão'))}</div>`);
  return { html: L.join(''), titulo: T(won ? 'modos.fim.vitoria' : 'modos.fim.derrota', null, won ? 'Caçada vencida' : 'A Fenda venceu'), eyebrow: T('modos.fim.eyebrow', { chefe: nomeChefe(c.chefe), dif: nomeDif(c.dif) }, 'Caçada · {chefe} · {dif}') }; }
/* fim da escaramuça com eventos: a Sentinela derrubada conta no progresso */
function fimEscaramuca(sim, human) { try { const p = sim.players[human]; if (p && p.sentinelas) P().registrarSentinela(p.sentinelas); } catch (e) {} }

/* ---------- Hangar: troféus, títulos e projetos ---------- */
function hangar() { const box = document.querySelector('#hangar .hg-opts'); if (!box) return; let el = $('hg-trofeus'); if (!el) { el = document.createElement('div'); el.id = 'hg-trofeus'; el.className = 'hg-trofeus'; box.appendChild(el); }
  let s = null; try { s = P().load().cacada; } catch (e) {} s = s || { trofeus: {}, titulos: [], projetos: [], sentinelas: 0 };
  const tro = CHEFES.filter(c => s.trofeus[c]).map(c => `<span class="trofeu m-${s.trofeus[c]}" title="${esc(nomeMedalha(s.trofeus[c]))}"><span class="tro-gl">${GLIFO[c]}</span><b>${esc(nomeChefe(c))}</b><small>${esc(nomeMedalha(s.trofeus[c]))}</small></span>`).join('');
  el.innerHTML = `<div class="small muted">${esc(T('modos.hg.trofeus', null, 'Troféus da Caçada'))}</div><div class="trofeus">${tro || `<span class="small muted">${esc(T('modos.hg.nenhum', null, 'Nenhum troféu ainda: vença uma Caçada.'))}</span>`}</div>` +
    (s.titulos.length ? `<div class="small muted">${esc(T('modos.hg.titulos', null, 'Títulos'))}: ${s.titulos.map(t => esc(nomeTitulo(t))).join(', ')}</div>` : '') +
    (s.projetos.length ? `<div class="small muted">${esc(T('modos.hg.projetos', null, 'Projetos'))}: ${esc(T('modos.hg.projeto-forja', null, 'projeto da Forja-Mãe (a unidade chega numa próxima versão)'))}</div>` : '') +
    (s.sentinelas ? `<div class="small muted">${esc(T('modos.hg.sentinelas', { n: s.sentinelas }, 'Sentinelas derrubadas: {n}'))}</div>` : ''); }

/* ---------- montagem (tela inicial) ---------- */
function montar(deps) { D = deps; if (!MO()) return;
  const tudo = () => { try { desenhaJogar(); desenhaCacada(); desenhaSala(); } catch (e) { console.warn('[ARD] modos (tela inicial):', e); } };
  tudo(); window.addEventListener('ard-idioma', () => { const st = $('start'); if (st && !st.hidden) tudo(); });
  const hg = $('hangar'); if (hg) new MutationObserver(() => { if (!hg.hidden) hangar(); }).observe(hg, { attributes: true, attributeFilter: ['hidden'] }); }
ARD.modosUI = { montar, cfgJogar, cfgSala, cfgUrl, jogadores, clima, cartao, salvo, faixa, fim, fimEscaramuca, linhaSala, modoSala, etiquetas, nomeChefe, hangar, CHEFES, DIFS, MEDAL_RANK, _prefs: prefs, _guarda: guarda };
})(globalThis.ARD = globalThis.ARD || {});
