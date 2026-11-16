/* Aether Rift: Dominion — 5.5b.2: onde as patentes aparecem (só interface; a regra é do contrato ARD.patentes, no src/patentes.js).
   - Tela inicial: ao lado do nome, o botão com a insígnia, a patente e as Centelhas; ele abre o Perfil.
   - Perfil (#perfil): patente e barra até o próximo nível, Centelhas, afinidade com as cinco Raças, a sequência do Desafio do Dia com o
     escudo e os marcos, o código de comandante (copiar e restaurar) e a escada dos 50 degraus.
   - Tela final: o bloco #fim-pat, "Centelhas ganhas", com os motivos (de credita(o)), a barra e a subida; quando sobe de PATENTE, oferece
     o cartão de promoção (subir de nível é só uma linha); quando bate um marco da sequência (7, 14 ou 30 dias), oferece o cartão do marco.
   - Sala multiplayer: a insígnia de cada jogador antes do nome (viaja na lista da sala como três números, campo pat, fora da cfg da partida).
   - Desafio do Dia: o escudo e os marcos, abaixo dos três quadros da janela.
   Sem ARD.patentes carregado, nada disto aparece (o jogo segue igual). Nada aqui entra na simulação nem sai do aparelho. */
(function (ARD) {
'use strict';
const P = () => ARD.patentes; const I = () => ARD.insignias;
const T = (k, v, r) => (ARD.t ? ARD.t(k, v, r) : String(r != null ? r : k));
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const num = v => (ARD.i18n && ARD.i18n.num ? ARD.i18n.num(Math.floor(v)) : String(Math.floor(v)));
const RACAS = ['vehnar', 'erevane', 'tessara', 'quorith', 'vorag']; const CORES = { vehnar: '#FF7733', erevane: '#33FFD0', tessara: '#55E68A', quorith: '#B388FF', vorag: '#E6455A' };
const MARCOS = [3, 7, 14, 30]; const CARTAO_SEQ = [7, 14, 30]; /* os marcos da sequência (decisão do dono); os três últimos ganham cartão */
const ESCUDO = '<svg class="pf-esc-i" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 20 5v6.5c0 4.6-3.2 8.6-8 10.5-4.8-1.9-8-5.9-8-10.5V5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path class="pf-esc-m" d="M12 6.2c1.9 2.6 1.9 7.4 0 10.6-1.9-3.2-1.9-8 0-10.6z" fill="currentColor"/></svg>';
let ABERTO = null, FIM = null;
const nRaca = f => (ARD.i18n && ARD.i18n.d ? ARD.i18n.d.racaCurto(f) : f);
const calmo = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
const moeda = n => T(n === 1 ? 'patente.moeda.um' : 'patente.moeda.nome');

/* ---------- leitura do contrato (com folga: formas vizinhas da combinada também servem) ---------- */
function E() { try { const e = P() && P().estado(); return e && e.patente ? e : null; } catch (x) { console.warn('[ARD] patentes (estado):', x); return null; } }
function indice(p) { const L = P() && P().PATENTES; if (Array.isArray(L)) { let i = L.findIndex(z => z.id === p.id); if (i < 0) i = L.findIndex(z => z.ordem === p.ordem); if (i >= 0) return i; } return p.ordem; } /* no contrato, patente.ordem vai de 1 a 10; o desenho usa a posição de 0 a 9, achada pelo id */
function patDe(v) { if (!v) return null; const p = v.patente || v; const est = (v.estrelas != null ? v.estrelas : p.estrelas) | 0; const o = indice(p); return I().dePat({ ordem: o, nivel: p.nivel, estrelas: est }) && { id: p.id, ordem: o, nivel: p.nivel, estrelas: est }; }
function fracao(v) { let x = v && v.prox; if (!x && v && typeof v.xp === 'number') { try { const d = P().deXp(v.xp); if (d && d.ate != null) x = d; } catch (e) {} } if (!x) return null; const larg = (x.ate - x.de) || 0; if (!(larg > 0)) return 1; return Math.max(0, Math.min(1, 1 - x.falta / larg)); }
function marcosDe(l) { return (Array.isArray(l) ? l : []).map(m => (m && typeof m === 'object' ? +(m.dias || m.n || m.marco) : +m)).filter(n => n > 0); }
function degrau(p) { return p.ordem * 5 + p.nivel; }
function proxima(p) { if (degrau(p) >= 50) return null; return p.nivel < 5 ? { ordem: p.ordem, nivel: p.nivel + 1 } : { ordem: p.ordem + 1, nivel: 1 }; }
function favorita(e) { let best = null, bx = 0; for (const r of RACAS) { const a = e && e.afinidade && e.afinidade[r]; if (a && a.xp > bx) { bx = a.xp; best = r; } } return best; }
function racaAtual() { return (document.documentElement.dataset.race) || 'vehnar'; }
function nomeCmd() { const i = $('opt-name'); let n = i && i.value ? i.value.trim().slice(0, 18) : ''; if (!n) { try { n = ARD.progress.load().commander.name || ''; } catch (e) {} } return n || T('geral.comandante'); }
/* o que este jogador anuncia na sala: [ordem, nível, estrelas] (ou null, sem patentes) */
function anuncia() { const e = E(); return e ? I().forma(patDe(e)) : null; }
function faltaTxt(e) { const p = patDe(e); const px = proxima(p); const n = Math.max(0, Math.ceil(e.prox ? e.prox.falta : 0)); return px ? T('patente.falta', { n, prox: I().nome(px) }) : T('patente.falta.estrela', { n }); }
function dadosCartao() { const e = E(); if (!e) return null; const fav = favorita(e); return { patente: patDe(e), cmd: nomeCmd(), raca: fav ? nRaca(fav) : '', cor: CORES[fav || racaAtual()] || '#FFB088', xp: e.xp, degrau: degrau(patDe(e)), dias: (e.sequencia && e.sequencia.dias) || 0 }; }
function dadosSeq(dias) { const e = E(); return { dias, patente: e ? patDe(e) : null, cmd: nomeCmd(), cor: CORES[(e && favorita(e)) || racaAtual()] || '#FFB088' }; }

/* ---------- copiar (o jeito novo e, se o navegador não deixar, o antigo) ---------- */
function copia(txt, campo, nota, okKey) { const toque = (() => { try { return matchMedia('(pointer: coarse)').matches; } catch (e) { return false; } })();
  const fim = ok => { if (nota) { nota.textContent = T(ok ? okKey : toque ? 'desafio.copie-na-mao-toque' : 'desafio.copie-na-mao'); nota.classList.toggle('falhou', !ok); } if (!ok && campo) { try { campo.focus(); campo.select(); } catch (e) {} } };
  const peloCampo = () => { try { if (!campo) return false; campo.focus(); campo.select(); return !!(document.execCommand && document.execCommand('copy')); } catch (e) { return false; } };
  try { if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(txt).then(() => fim(true), () => fim(peloCampo())); return; } } catch (e) {}
  fim(peloCampo()); }

/* ---------- tela inicial: a insígnia ao lado do nome ---------- */
function entrada() { const cn = document.querySelector('#start .cname'); if (!cn || !P() || !I()) return; let b = $('pf-entrada');
  if (!b) { b = document.createElement('button'); b.type = 'button'; b.id = 'pf-entrada'; b.className = 'pf-entrada'; cn.appendChild(b); cn.classList.add('com-pat'); b.addEventListener('click', () => abre()); }
  const e = E(); b.hidden = !e; if (!e) return; const p = patDe(e);
  b.innerHTML = I().html(p, 32, { semAlt: true }) + '<span class="pf-e-txt"><b>' + esc(I().nome(p)) + '</b><small>' + I().htmlLogo(16) + esc(num(e.xp)) + ' ' + esc(moeda(e.xp)) + (e.estrelas ? ' · ★ ' + esc(num(e.estrelas)) : '') + '</small></span>';
  b.setAttribute('aria-label', T('perfil.abrir', { patente: I().nome(p) })); b.title = T('perfil.abrir', { patente: I().nome(p) }); }

/* ---------- sala multiplayer: a insígnia antes do nome de cada jogador ---------- */
function sala(el, p) { if (!el || !I()) return; const pat = I().dePat(p && p.pat); const velho = el.querySelector(':scope > .pf-sala'); if (velho) velho.remove(); if (!pat) return; el.classList.add('pf-linha'); el.insertAdjacentHTML('afterbegin', I().html(pat, 22, { cls: 'pf-sala' })); const im = el.querySelector(':scope > .pf-sala'); if (im) im.title = I().nome(pat); }

/* ---------- sequência: o escudo e os marcos (Perfil e janela do Desafio do Dia) ---------- */
function seqHtml(e, cartoes) { const s = (e && e.sequencia) || { dias: 0, escudo: 0, marcos: [] }; const dias = s.dias | 0; const tem = marcosDe(s.marcos); const on = !!s.escudo;
  let h = '<div class="pf-seq"><div class="pf-seq-d"><b>' + esc(num(dias)) + '</b><span>' + esc(T('perfil.seq.dias', { n: dias })) + '</span></div>' +
    '<div class="pf-escudo' + (on ? ' on' : '') + '">' + ESCUDO + '<span><b>' + esc(T(on ? 'perfil.seq.escudo.on' : 'perfil.seq.escudo.off')) + '</b><small>' + esc(T(on ? 'perfil.seq.escudo.on-d' : 'perfil.seq.escudo.off-d')) + '</small></span></div>' +
    '<ol class="pf-marcos" aria-label="' + esc(T('perfil.seq.marcos')) + '">' + MARCOS.map(m => { const ok = tem.includes(m) || dias >= m; return '<li class="' + (ok ? 'ok' : '') + '"><b>' + m + '</b><small>' + esc(T(ok ? 'perfil.seq.marco.ok' : 'perfil.seq.marco.falta', { n: Math.max(0, m - dias) })) + '</small></li>'; }).join('') + '</ol></div>';
  if (cartoes) { const bs = CARTAO_SEQ.filter(m => tem.includes(m) || dias >= m); if (bs.length) h += '<div class="row pf-seq-b">' + bs.map(m => '<button type="button" class="btn" data-pf-seq="' + m + '">' + esc(T('perfil.seq.cartao', { n: m })) + '</button>').join('') + '</div>'; }
  return h; }
function ligaSeq(box) { box.querySelectorAll('[data-pf-seq]').forEach(b => b.addEventListener('click', () => { const d = +b.dataset.pfSeq; I().abrirSequencia(() => dadosSeq(d)); })); }
/* chamado pelo src/desafio-ui.js depois de pintar a vista "hoje" */
function desafio(box) { if (!box || !P() || !I()) return; const e = E(); if (!e) return; const ref = box.querySelector('.dd-stats'); if (!ref) return; let el = box.querySelector('#dd-pat'); if (!el) { el = document.createElement('div'); el.id = 'dd-pat'; el.className = 'dd-pat'; ref.after(el); } el.innerHTML = seqHtml(e, false); }

/* ---------- Perfil ---------- */
function caixa() { let el = $('perfil'); if (!el) { el = document.createElement('div'); el.id = 'perfil'; el.className = 'modal pf'; el.hidden = true; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'pf-h'); el.innerHTML = '<div class="box wide"></div>'; document.body.appendChild(el);
    el.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); fecha(); } }); el.addEventListener('click', e => { if (e.target === el) fecha(); }); }
  return el; }
function fecha() { const el = $('perfil'); if (el) el.hidden = true; const volta = ABERTO && ABERTO.volta; ABERTO = null; if (volta && volta.focus) try { volta.focus(); } catch (e) {} }
function abre() { if (!P() || !I() || !E()) return; const el = caixa(); ABERTO = { volta: document.activeElement, prev: null }; el.hidden = false; pinta(); const h = $('pf-h'); if (h) { h.setAttribute('tabindex', '-1'); try { h.focus(); } catch (e) {} } }
function escadaHtml(p) { const at = degrau(p); let h = '<div class="pf-escada">';
  for (let o = 0; o < 10; o++) { h += '<div class="pf-deg' + (o < p.ordem ? ' feito' : o === p.ordem ? ' atual' : '') + '"><span class="pf-deg-n">' + esc(I().nomeSo({ ordem: o, nivel: 1 })) + '</span><span class="pf-deg-i">';
    for (let n = 1; n <= 5; n++) { const d = o * 5 + n, ok = d <= at; h += '<span class="pf-d' + (ok ? ' ok' : '') + (d === at ? ' aqui' : '') + '">' + I().html({ ordem: o, nivel: n }, 36, { apagada: !ok }) + '</span>'; }
    h += '</span></div>'; }
  return h + '</div>'; }
function pinta() { const el = $('perfil'); if (!el || !ABERTO) return; const box = el.querySelector('.box'); const e = E(); if (!e) { fecha(); return; } const p = patDe(e); const f = fracao(e); let cod = ''; try { cod = P().codigo() || ''; if (P().bonito) cod = P().bonito(cod); } catch (x) {}
  const foco = document.activeElement && el.contains(document.activeElement) ? document.activeElement.id : ''; const colado = $('pf-colar') ? $('pf-colar').value : '';
  let h = '<button type="button" class="mclose" id="pf-x" aria-label="' + esc(T('diplo.fechar')) + '">✕</button><div class="eyebrow">' + esc(T('perfil.titulo')) + ' · ' + esc(nomeCmd()) + '</div>' +
    '<div class="pf-topo">' + I().html(p, 120, { cls: 'pf-ins', semAlt: true }) + '<div class="pf-id"><h2 id="pf-h">' + esc(I().nome(p)) + '</h2>' +
    '<div class="pf-xp">' + I().htmlLogo(40) + '<b id="pf-xp-n">' + esc(num(e.xp)) + '</b><span>' + esc(moeda(e.xp)) + '</span>' + (e.estrelas ? '<span class="pf-estrelas">★ ' + esc(T('perfil.estrelas', { n: e.estrelas })) + '</span>' : '') + '</div>' +
    '<div class="pf-barra" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.round((f == null ? 0 : f) * 100) + '" aria-label="' + esc(T('perfil.barra')) + '"><i style="width:' + ((f == null ? 0 : f) * 100).toFixed(1) + '%"></i></div><div class="pf-falta" id="pf-falta">' + esc(faltaTxt(e)) + '</div></div>' +
    '<button type="button" class="btn" id="pf-cartao">' + esc(T('perfil.cartao')) + '</button></div>';
  h += '<section class="pf-sec"><h3>' + esc(T('perfil.afin.titulo')) + '</h3><div class="pf-afin">' + RACAS.map(r => { const a = (e.afinidade && e.afinidade[r]) || { xp: 0, degrau: 0 }; const d = Math.max(0, Math.min(5, a.degrau | 0));
    return '<div class="pf-raca" data-raca="' + r + '" style="--pf-cor:' + CORES[r] + '"><b>' + esc(nRaca(r)) + '</b><span class="pf-degraus" role="img" aria-label="' + esc(T('perfil.afin.degrau', { n: d })) + '">' + [1, 2, 3, 4, 5].map(i => '<i class="' + (i <= d ? 'on' : '') + '"></i>').join('') + '</span><small>' + esc(num(a.xp || 0)) + ' ' + esc(moeda(a.xp || 0)) + '</small></div>'; }).join('') + '</div></section>';
  h += '<section class="pf-sec"><h3>' + esc(T('perfil.seq.titulo')) + '</h3>' + seqHtml(e, true) + '</section>';
  h += '<section class="pf-sec"><h3>' + esc(T('perfil.cod.titulo')) + '</h3><p class="pf-p">' + esc(T('perfil.cod.texto')) + '</p>' +
    '<div class="opt"><label for="pf-cod">' + esc(T('perfil.cod.seu')) + '</label><div class="row pf-linha-cod"><input id="pf-cod" readonly spellcheck="false" value="' + esc(cod) + '"><button type="button" class="btn" id="pf-copiar">' + esc(T('perfil.cod.copiar')) + '</button></div></div>' +
    '<div class="opt"><label for="pf-colar">' + esc(T('perfil.cod.restaurar-rot')) + '</label><div class="row pf-linha-cod"><input id="pf-colar" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="400"><button type="button" class="btn" id="pf-conferir">' + esc(T('perfil.cod.conferir')) + '</button></div></div>';
  if (ABERTO.prev) h += '<div class="pf-prev" id="pf-prev"><p>' + esc(ABERTO.prev.txt) + '</p><p class="small' + (ABERTO.prev.rebaixa ? ' pf-rebaixa' : '') + '">' + esc(T(ABERTO.prev.rebaixa ? 'perfil.cod.rebaixa' : 'perfil.cod.aviso')) + '</p><div class="row"><button type="button" class="btn primary" id="pf-restaurar">' + esc(T('perfil.cod.restaurar')) + '</button><button type="button" class="btn" id="pf-cancelar">' + esc(T('perfil.cod.cancelar')) + '</button></div></div>';
  h += '<div class="small" id="pf-nota" role="status">' + esc(ABERTO.nota || '') + '</div></section>';
  h += '<section class="pf-sec"><h3>' + esc(T('perfil.escada.titulo')) + '</h3><p class="pf-p">' + esc(T('perfil.escada.conta', { n: degrau(p) })) + '</p>' + escadaHtml(p) + '</section>';
  h += '<p class="small muted pf-nota-fim">' + esc(T('perfil.nota')) + '</p><div class="row"><button type="button" class="btn" id="pf-fechar">' + esc(T('diplo.fechar')) + '</button></div>';
  box.innerHTML = h; if (colado && $('pf-colar')) $('pf-colar').value = colado;
  $('pf-x').addEventListener('click', fecha); $('pf-fechar').addEventListener('click', fecha); ligaSeq(box);
  $('pf-cartao').addEventListener('click', () => I().abrirPromocao(dadosCartao));
  $('pf-copiar').addEventListener('click', () => copia($('pf-cod').value, $('pf-cod'), $('pf-nota'), 'perfil.cod.copiado')); $('pf-cod').addEventListener('focus', () => { try { $('pf-cod').select(); } catch (x) {} });
  const confere = () => { const t = String($('pf-colar').value || '').trim(); if (!t) { $('pf-colar').focus(); return; } let r = null; try { r = P().ler(t); } catch (x) { r = null; } const ok = !!r && r.ok !== false && !r.erro;
    if (!ok) { ABERTO.prev = null; ABERTO.nota = (r && r.texto) || T('perfil.cod.invalido'); pinta(); const n = $('pf-nota'); if (n) n.classList.add('falhou'); if ($('pf-colar')) $('pf-colar').focus(); return; }
    const es = r.estado || (r.patente ? r : null); const pp = es ? patDe(es) : null; if (r.igual) { ABERTO.prev = null; ABERTO.nota = T('perfil.cod.igual'); pinta(); return; }
    ABERTO.prev = { cod: t, rebaixa: !!r.rebaixa, txt: pp ? T('perfil.cod.traz', { patente: I().nome(pp), n: (r.dados && r.dados.xp) != null ? r.dados.xp : es.xp || 0 }) : T('perfil.cod.valido') }; ABERTO.nota = ''; pinta(); const b = $('pf-restaurar'); if (b) b.focus(); };
  $('pf-conferir').addEventListener('click', confere); $('pf-colar').addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); confere(); } });
  if (ABERTO.prev) { $('pf-cancelar').addEventListener('click', () => { ABERTO.prev = null; pinta(); });
    $('pf-restaurar').addEventListener('click', () => { let r = null; try { r = P().restaurar(ABERTO.prev.cod, { confirmado: true, rebaixar: true }); /* a confirmação é esta própria caixa, que já mostrou o que o código traz (e o aviso, quando ele traz menos) */ } catch (x) { r = null; } const ok = !!r && r.ok !== false && !r.erro; ABERTO.prev = null; ABERTO.nota = ok ? T('perfil.cod.restaurado') : (r && r.texto) || T('perfil.cod.invalido'); if ($('pf-colar')) $('pf-colar').value = ''; pinta(); const n = $('pf-nota'); if (n) n.classList.toggle('falhou', !ok); entrada(); const hh = $('pf-h'); if (hh) { hh.setAttribute('tabindex', '-1'); try { hh.focus(); } catch (x) {} } }); }
  if (foco && $(foco)) try { $(foco).focus(); } catch (x) {} }

/* ---------- tela final: "Centelhas ganhas" ----------
   o: o objeto da tela final (src/fim.js). O crédito é feito UMA vez por partida: se alguém já creditou (o._patCred), este bloco só mostra. */
function fim(o) { const end = $('end'); if (!end || !P() || !I()) return; let r = o.patentes;
  if (r === undefined) { try { r = P().credita(o) || null; } catch (e) { console.warn('[ARD] patentes (crédito):', e); r = null; } } /* o src/fim.js já creditou e deixou o resultado em o.patentes; se este bloco chegar antes, credita() com o mesmo objeto não paga duas vezes */
  FIM = { o, r, animou: false }; pintaFim(); entrada(); }
function pintaFim() { const F = FIM; const end = $('end'); if (!F || !end) return; let el = $('fim-pat'); const r = F.r; const gs = r && Array.isArray(r.ganhos) ? r.ganhos.filter(g => g && g.xp) : []; const sem = r && Array.isArray(r.ganhos) ? r.ganhos.filter(g => g && g.motivo === 'sem-ganho') : []; const mTxt = g => g.texto || (P().motivoTxt ? P().motivoTxt(g) : T('patente.motivo.' + g.motivo, g.vars || null, g.motivo));
  if (!el) { el = document.createElement('div'); el.id = 'fim-pat'; el.className = 'fim-pat'; const ref = $('fim-desafio') || $('fim-cosm') || end.querySelector('.fim-botoes'); if (ref && ref.parentElement) ref.parentElement.insertBefore(el, ref); else end.appendChild(el); }
  const e = E(); if (!r || (!gs.length && !sem.length) || !e) { el.hidden = true; el.innerHTML = ''; return; }
  const d = patDe(r.depois) || patDe(e); const a = patDe(r.antes) || d; const total = r.total != null ? r.total : gs.reduce((s, g) => s + g.xp, 0);
  const promo = d.ordem > a.ordem; const nivelUp = !promo && degrau(d) > degrau(a); const estrela = d.estrelas > a.estrelas; const f1 = fracao(e); const f0 = promo || nivelUp || estrela ? 0 : fracao(r.antes);
  const anima = !F.animou && !calmo(); F.animou = true; const marcos = marcosDe(r.marcos).filter(m => CARTAO_SEQ.includes(m)); const af = r.subiuAfinidade && typeof r.subiuAfinidade === 'object' ? (Array.isArray(r.subiuAfinidade) ? r.subiuAfinidade[0] : r.subiuAfinidade) : null;
  let h = '<div class="fp-topo">' + I().html(d, 48, { cls: 'fp-ins' + (promo ? ' sobe' : ''), semAlt: true }) + '<div class="fp-quem"><b id="fp-nome">' + esc(I().nome(d)) + '</b>' +
    '<div class="pf-barra" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.round((f1 || 0) * 100) + '" aria-label="' + esc(T('perfil.barra')) + '"><i id="fp-barra" style="width:' + (((anima && f0 != null ? f0 : f1) || 0) * 100).toFixed(1) + '%"></i></div><small id="fp-falta">' + esc(faltaTxt(e)) + '</small></div>' +
    '<div class="fp-total"><i class="fp-logo' + (anima && I().BRILHO ? ' brilha' : '') + '" style="--m:url(' + I().urlLogo(40) + ')">' + I().htmlLogo(40) + '</i><b id="fp-total">+' + esc(num(anima ? 0 : total)) + '</b><span>' + esc(T('patente.fim.titulo')) + '</span></div></div>';
  let bs = ''; if (promo) bs += '<button type="button" class="btn primary" id="fp-cartao">' + esc(T('patente.fim.cartao')) + '</button>'; for (const m of marcos) bs += '<button type="button" class="btn" data-pf-seq="' + m + '">' + esc(T('perfil.seq.cartao', { n: m })) + '</button>';
  bs += '<button type="button" class="btn ghost" id="fp-perfil">' + esc(T('perfil.titulo')) + '</button>'; h += '<div class="row fp-botoes">' + bs + '</div><div class="fp-baixo">';
  h += '<ul class="fp-motivos" aria-label="' + esc(T('patente.fim.motivos')) + '">' + gs.map(g => '<li' + (g.xp < 0 ? ' class="menos"' : '') + '><span>' + esc(mTxt(g)) + '</span><b>' + (g.xp < 0 ? '−' : '+') + esc(num(Math.abs(g.xp))) + '</b></li>').join('') + '</ul>';
  for (const g of sem) h += '<p class="fp-linha fp-sem">' + esc(mTxt(g)) + '</p>'; /* partida que não rendeu: o motivo, em uma linha */
  if (promo) h += '<p class="fp-promo" id="fp-promo" role="status"><b>' + esc(T('patente.fim.promocao')) + '</b> ' + esc(T('patente.fim.agora', { patente: I().nome(d) })) + '</p>';
  else if (nivelUp) h += '<p class="fp-linha" id="fp-nivel" role="status">' + esc(T('patente.fim.nivel', { patente: I().nome(d) })) + '</p>';
  else if (estrela) h += '<p class="fp-linha" id="fp-nivel" role="status">★ ' + esc(T('patente.fim.estrela', { n: d.estrelas })) + '</p>';
  if (af && af.raca) h += '<p class="fp-linha" id="fp-afin">' + esc(T('patente.fim.afinidade', { raca: nRaca(af.raca), n: (af.para != null ? af.para : af.degrau) | 0 })) + '</p>';
  h += '</div>'; el.innerHTML = h; el.hidden = false; el.classList.toggle('promo', promo); ligaSeq(el);
  const bc = $('fp-cartao'); if (bc) bc.addEventListener('click', () => I().abrirPromocao(dadosCartao)); $('fp-perfil').addEventListener('click', () => abre());
  if (anima) { const b = $('fp-barra'), tt = $('fp-total'); const t0 = performance.now(), dur = 800; requestAnimationFrame(() => requestAnimationFrame(() => { if (b) b.style.width = ((f1 || 0) * 100).toFixed(1) + '%'; }));
    const passo = t => { if (FIM !== F || !tt.isConnected) return; const k = Math.min(1, (t - t0) / dur); tt.textContent = '+' + num(Math.round(total * (1 - Math.pow(1 - k, 3)))); if (k < 1) requestAnimationFrame(passo); }; requestAnimationFrame(passo); } }

if (typeof window !== 'undefined') window.addEventListener('ard-idioma', () => { try { entrada(); if (ABERTO && $('perfil') && !$('perfil').hidden) pinta(); if (FIM && $('end') && !$('end').hidden) pintaFim(); } catch (e) {} });
function montar() { try { entrada(); } catch (e) { console.warn('[ARD] perfil:', e); } const q = (() => { try { return new URLSearchParams(location.search); } catch (e) { return null; } })(); if (q && q.get('perfil') === '1' && !q.get('autostart')) setTimeout(abre, 0); /* ?perfil=1: abre direto (testes e capturas) */ }
if (typeof document !== 'undefined') { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montar); else montar(); }

ARD.perfilUI = { abre, fecha, entrada, sala, anuncia, desafio, fim, seqHtml, dadosCartao, dadosSeq, get aberto() { return ABERTO; }, get ultimoFim() { return FIM; } };
})(globalThis.ARD = globalThis.ARD || {});
