/* Aether Rift: Dominion — idiomas (5.0c): português do Brasil (base), inglês e espanhol (neutro latino-americano).
   Escolha: ?lang= na URL › a escolha guardada no aparelho ('ard-idioma') › navigator.languages (pt → pt-BR, es → es, o resto → en).
   ARD.t(chave, vars, reserva): texto do idioma atual (cai no pt-BR e depois na reserva); {x} vira vars.x (número no formato do idioma);
   um valor { one, other, many… } escolhe a forma pelo Intl.PluralRules com vars.n. No HTML, data-i18n="chave" troca o texto do elemento
   e data-i18n-attr="title:chave;aria-label:chave" troca atributos. A troca vale sem recarregar: o evento 'ard-idioma' avisa os módulos.
   Os dicionários (src/i18n/pt-BR.js, en.js e es.js) entram no pacote antes deste arquivo; nada aqui toca a simulação. */
(function (ARD) {
'use strict';
const IDIOMAS = ['pt-BR', 'en', 'es'];
const NOMES = { 'pt-BR': 'Português (Brasil)', en: 'English', es: 'Español' }; /* cada um no próprio idioma: legível para quem procura o seu */
const LOCALE = { 'pt-BR': 'pt-BR', en: 'en', es: 'es-419' }; /* Intl e <html lang> */
const DIC = ARD.I18N_DIC = ARD.I18N_DIC || {};
const PREF = 'ard-idioma';
function normaliza(l) { if (!l) return null; l = String(l).trim().toLowerCase(); if (/^pt/.test(l)) return 'pt-BR'; if (/^es/.test(l)) return 'es'; if (/^en/.test(l)) return 'en'; return null; }
function guardado() { try { return normaliza(localStorage.getItem(PREF)); } catch (e) { return null; } }
function doNavegador() { let ls = []; try { ls = (navigator.languages && navigator.languages.length) ? navigator.languages : [navigator.language || '']; } catch (e) {} for (const l of ls) { const n = normaliza(l); if (n) return n; } return 'en'; }
function escolhe() { let q = null; try { q = new URLSearchParams(location.search).get('lang'); } catch (e) {} const u = normaliza(q); if (u) return { idioma: u, origem: 'url' };
  const g = guardado(); if (g) return { idioma: g, origem: 'aparelho' }; return { idioma: doNavegador(), origem: 'navegador' }; }
const ini = escolhe(); ARD.idioma = ini.idioma;
/* números e plural no formato do idioma (cache por idioma) */
const NF = {}, PR = {};
const nf = (l, o) => { const k = l + JSON.stringify(o || 0); return NF[k] || (NF[k] = new Intl.NumberFormat(LOCALE[l] || l, o || undefined)); };
const pr = l => PR[l] || (PR[l] = new Intl.PluralRules(LOCALE[l] || l));
function num(n, o) { if (typeof n !== 'number' || !isFinite(n)) return String(n); return nf(ARD.idioma, o || { maximumFractionDigits: 2 }).format(n); }
function forma(v, n, l) { if (v == null || typeof v !== 'object') return v; const c = typeof n === 'number' ? (n === 0 && v.zero != null ? 'zero' : pr(l).select(n)) : 'other'; return v[c] != null ? v[c] : v.other != null ? v.other : v.one; }
function busca(k, l) { const d = DIC[l]; return d && Object.prototype.hasOwnProperty.call(d, k) ? d[k] : undefined; }
const MARCA_BUILD = '__' + 'BUILD__', CARIMBO = '__BUILD__'; /* o en e o es vêm em arquivo à parte, sem a troca do build: o carimbo entra aqui */
function preenche(s, vars) { if (s.indexOf(MARCA_BUILD) >= 0) s = s.split(MARCA_BUILD).join(CARIMBO); if (!vars || s.indexOf('{') < 0) return s; return s.replace(/\{(\w+)\}/g, (m, n) => Object.prototype.hasOwnProperty.call(vars, n) ? (typeof vars[n] === 'number' ? num(vars[n]) : String(vars[n])) : m); }
function t(k, vars, reserva) { const l = ARD.idioma; let v = busca(k, l), ll = l; if (v === undefined) { v = busca(k, 'pt-BR'); ll = 'pt-BR'; } if (v === undefined) { if (reserva != null) return preenche(String(reserva), vars); falta(k); return k; }
  const s = forma(v, vars && vars.n, ll); return preenche(String(s == null ? '' : s), vars); }
const FALTAS = new Set(); function falta(k) { if (FALTAS.size < 500) FALTAS.add(k); }
/* nomes que vêm da simulação ou de tabelas (unidades, construções, pesquisas, Eras, Raças, mapas, IAs): pelo id; a reserva é o texto da tabela */
function tn(tipo, id, reserva, campo) { return t(tipo + '.' + id + '.' + (campo || 'nome'), null, reserva); }
/* concordância por gênero de quem fala (a Sylvia Oriel é uma líder): chave.f / chave.m, senão a chave sem gênero */
function tg(k, genero, vars, reserva) { const kg = k + '.' + (genero === 'f' ? 'f' : 'm'); return (busca(kg, ARD.idioma) !== undefined || busca(kg, 'pt-BR') !== undefined) ? t(kg, vars) : t(k, vars, reserva); }
/* índice reverso pt-BR → chave: traduz na hora de mostrar um texto que só existe em português (simulação, tabelas, módulos de outra frente) */
let REV = null, REV_DIC = null; const PADROES = []; let PAD_DIC = null;
function indice() { const d = DIC['pt-BR'] || {}; if (REV && REV_DIC === d) return REV; REV = new Map(); REV_DIC = d; for (const k in d) { const v = d[k]; if (typeof v === 'string') { if (!REV.has(v)) REV.set(v, k); } else if (v && typeof v === 'object') for (const f in v) if (typeof v[f] === 'string' && !REV.has(v[f])) REV.set(v[f], k + '#' + f); } return REV; }
const NUM = /^(n\d?|total|s|ms|fps|p|pct|mb)$/; /* marcadores que só pegam número nos padrões; {t} pega mm:ss; os outros, qualquer texto */
const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function padroes() { const d = DIC['pt-BR'] || {}; if (PAD_DIC === d) return PADROES; PAD_DIC = d; PADROES.length = 0;
  for (const k in d) { if (!/^(sim|pad)\./.test(k)) continue; const v = d[k]; const fs = typeof v === 'string' ? { _: v } : v; for (const f in fs) { const s = fs[f]; if (typeof s !== 'string' || s.indexOf('{') < 0) continue; const nomes = []; const re = '^' + reEsc(s).replace(/\\\{(\w+)\\\}/g, (m, n) => { nomes.push(n); return NUM.test(n) ? '([-+−]?\\d[\\d.,]*)' : n === 't' ? '(\\d+:\\d\\d)' : '(.+?)'; }) + '$'; try { PADROES.push({ k, f, re: new RegExp(re), nomes, fixo: s.replace(/\{\w+\}/g, '').length, sub: /^pad\.sub\./.test(k) }); } catch (e) {} } }
  PADROES.sort((a, b) => b.fixo - a.fixo); return PADROES; }
const CACHE = new Map();
/* tr(texto): o texto em português da base traduzido para o idioma atual. Procura igual no dicionário; senão, os padrões com {x} das chaves sim.* e pad.*
   (os pedaços capturados também passam por tr, para traduzir nomes); senão, divide em ' · ' e traduz cada parte. Sem tradução, devolve o original. */
function tr(s) { if (s == null) return s; s = String(s); if (ARD.idioma === 'pt-BR' || !s) return s; const ck = ARD.idioma + '\u0001' + s; if (CACHE.has(ck)) return CACHE.get(ck);
  const r = trad(s, 0); if (CACHE.size > 3000) CACHE.clear(); CACHE.set(ck, r); return r; }
function chaveDe(s) { return indice().get(s); }
function porChave(kf, vars) { const i = kf.indexOf('#'); if (i < 0) return t(kf, vars); const k = kf.slice(0, i), f = kf.slice(i + 1); const v = busca(k, ARD.idioma); if (v && typeof v === 'object') return preenche(String(v[f] != null ? v[f] : v.other), vars); return t(k, vars); }
function trad(s, prof) { const k = chaveDe(s); if (k) return porChave(k); const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s); if (m[1] || m[3]) { const k2 = chaveDe(m[2]); if (k2) return m[1] + porChave(k2) + m[3]; }
  if (prof < 3) { for (const p of padroes()) { if (p.sub && !prof) continue; /* pad.sub.*: só dentro de um pedaço (depois do ' · ' ou de um {x}) */ const r = p.re.exec(s); if (!r) continue; const vars = {}; p.nomes.forEach((n, i) => { const x = r[i + 1]; vars[n] = /^[-+−]?[\d.,]+$/.test(x) ? x : trad(x, prof + 1); }); let cnt; if (typeof vars.n === 'string') { const x = vars.n; cnt = parseFloat(/^\d{1,3}(\.\d{3})+$/.test(x) ? x.replace(/\./g, '') : x.replace(',', '.')); } return porPadrao(p, vars, cnt); } /* o número capturado aparece como veio; cnt só escolhe o plural */
    if (s.indexOf(' · ') > 0) { const ps = s.split(' · '); const out = ps.map(x => trad(x, prof + 1)); return out.join(' · '); }
    const c = /^(.*?)([:!.…?]+)$/.exec(s); if (c && c[1]) { const k3 = chaveDe(c[1]); if (k3) return porChave(k3) + c[2]; } }
  return s; }
function porPadrao(p, vars, cnt) { const l = ARD.idioma; const v = busca(p.k, l); if (v === undefined) return t(p.k, vars); if (typeof v === 'object') { const ok = typeof cnt === 'number' && isFinite(cnt); const f = p.f !== '_' && !ok ? (v[p.f] != null ? p.f : 'other') : null; return preenche(String(f ? v[f] : forma(v, cnt, l)), vars); } return preenche(String(v), vars); }
/* ---------- dados da simulação traduzidos na hora de mostrar (a simulação segue em pt-BR: determinismo, salvamentos e rede) ---------- */
const SIM = () => ARD.sim || {};
const slug = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const d = {
  unidade(fac, def) { const S = SIM(); const u = S.UNITS && S.UNITS[def]; if (!u) return String(def); const pt = S.unitName ? S.unitName(fac, def) : u.name; return pt !== u.name ? t('unit.' + def + '.nome.' + fac, null, pt) : t('unit.' + def + '.nome', null, pt); },
  unidadeDesc(def) { const u = (SIM().UNITS || {})[def]; return t('unit.' + def + '.desc', null, u ? u.desc : ''); },
  construcao(def) { const b = (SIM().BUILDINGS || {})[def]; return t('bld.' + def + '.nome', null, b ? b.name : def); },
  construcaoDesc(def) { const b = (SIM().BUILDINGS || {})[def]; return t('bld.' + def + '.desc', null, b ? b.desc : ''); },
  modulo(def) { const b = (SIM().BUILDINGS || {})[def]; return t('bld.' + def + '.mod.nome', null, b && b.module ? b.module.name : ''); },
  moduloDesc(def) { const b = (SIM().BUILDINGS || {})[def]; return t('bld.' + def + '.mod.desc', null, b && b.module ? b.module.desc : ''); },
  nome(kind, def, fac) { return kind === 'unit' ? d.unidade(fac, def) : d.construcao(def); },
  pesquisa(id) { const r = (SIM().RESEARCH || {})[id]; return t('pesq.' + id + '.nome', null, r ? r.name : id); },
  pesquisaDesc(id) { const r = (SIM().RESEARCH || {})[id]; return t('pesq.' + id + '.desc', null, r ? r.desc : ''); },
  era(n) { const e = (SIM().ERAS || [])[n]; return t('era.' + n + '.nome', null, e ? e.name : ''); },
  eraDesc(n) { const e = (SIM().ERAS || [])[n]; return t('era.' + n + '.desc', null, e ? e.desc : ''); },
  ascensao(fac) { const a = (SIM().ASCENSION || {})[fac]; return t('asc.' + fac + '.nome', null, a ? a.name : ''); },
  ascensaoDesc(fac) { const a = (SIM().ASCENSION || {})[fac]; return t('asc.' + fac + '.desc', null, a ? a.desc : ''); },
  raca(f) { const F = (SIM().FACTIONS || {})[f]; return t('fac.' + f + '.nome', null, F ? F.name : f); },
  racaCurto(f) { const F = (SIM().FACTIONS || {})[f]; return t('fac.' + f + '.curto', null, F ? F.short : f); },
  racaLema(f) { const F = (SIM().FACTIONS || {})[f]; return t('fac.' + f + '.lema', null, F ? F.tagline : ''); },
  superarma(f) { const F = (SIM().FACTIONS || {})[f]; return t('fac.' + f + '.super', null, F ? F.superName : ''); },
  superarmaDesc(f) { const F = (SIM().FACTIONS || {})[f]; return t('fac.' + f + '.superDesc', null, F ? F.superDesc : ''); },
  classe(c) { return t('classe.' + c, null, (SIM().CLASS_NAMES || {})[c] || ''); },
  regime(r) { const x = (SIM().REGIME || {})[r]; return t('regime.' + r, null, x ? x.name : r); },
  reputacao(n) { n = +n || 0; return t('rep.' + (n < 0 ? 'm' + (-n) : 'p' + n), null, (SIM().REP_NAMES || {})[n] || ''); },
  dificuldade(k) { const x = (SIM().DIFFICULTY || {})[k]; return t('dif.' + k, null, x ? x.name : k); },
  mapa(k) { return t('mapa.' + k, null, (SIM().MAPS || {})[k] || k); },
  recurso(k, longo) { return t('res.' + k + (longo ? '.longo' : ''), null, k); },
  jogador(nome) { return nome == null ? nome : (chaveDe(String(nome)) ? tr(nome) : nome); } /* nomes das IAs e "Você" vêm da tabela; o nome que a pessoa digitou fica como está */
};
/* ---------- DOM ---------- */
const INLINE = { B: 1, I: 1, EM: 1, STRONG: 1, SMALL: 1, KBD: 1, BR: 1, CODE: 1, U: 1, SUP: 1, SUB: 1, MARK: 1, SPAN: 1, A: 1, ABBR: 1, WBR: 1 };
function simples(el) { for (const c of el.children) { if (!INLINE[c.tagName] || c.id || c.hasAttribute('data-i18n') || [...c.attributes].some(a => a.name.startsWith('data-')) || !simples(c)) return false; } return true; } /* filho com id ou data-* é do código: só o texto solto do elemento muda */
function aplicaEl(el) { const k = el.getAttribute('data-i18n'); if (!k) return; const s = t(k);
  if (simples(el)) { const html = /[<&]/.test(s); const atual = html ? el.innerHTML : el.textContent; if (el.__i18n !== undefined && atual !== el.__i18n) return; /* o código já trocou o conteúdo: não pisa */
    if (atual !== s) { if (html) el.innerHTML = s; else el.textContent = s; } el.__i18n = html ? el.innerHTML : el.textContent; return; }
  const ns = [...el.childNodes].filter(n => n.nodeType === 3 && n.nodeValue.trim()); if (!ns.length) return; const atual = ns.map(n => n.nodeValue).join('\u0001');
  if (el.__i18n !== undefined && atual !== el.__i18n) return; const m = /^(\s*)[\s\S]*?(\s*)$/.exec(ns[0].nodeValue); ns[0].nodeValue = m[1] + s + m[2]; for (let i = 1; i < ns.length; i++) ns[i].nodeValue = ''; el.__i18n = ns.map(n => n.nodeValue).join('\u0001'); }
function aplicaAttr(el) { const spec = el.getAttribute('data-i18n-attr'); if (!spec) return; const mem = el.__i18nA || (el.__i18nA = {});
  for (const par of spec.split(';')) { const i = par.indexOf(':'); if (i < 0) continue; const a = par.slice(0, i).trim(), k = par.slice(i + 1).trim(); if (!a || !k) continue; const atual = el.getAttribute(a); if (mem[a] !== undefined && atual !== mem[a]) continue; const s = t(k); if (atual !== s) el.setAttribute(a, s); mem[a] = s; } }
function aplicar(raiz) { raiz = raiz || document; if (!raiz.querySelectorAll) return; if (raiz.nodeType === 1) { if (raiz.hasAttribute('data-i18n')) aplicaEl(raiz); if (raiz.hasAttribute('data-i18n-attr')) aplicaAttr(raiz); }
  raiz.querySelectorAll('[data-i18n]').forEach(aplicaEl); raiz.querySelectorAll('[data-i18n-attr]').forEach(aplicaAttr); }
/* observar(el): traduz na tela, pelo ARD.tr, o texto que outro módulo escreve em português dentro de el (o resultado do teste de desempenho e o
   Detetive no main.js, linhas da frente do Motor 5; a escolha da voz no audio.js, da frente do Som). Guarda o original pt de cada nó para a troca de idioma. */
const OBS = new Set(), ATTRS = ['title', 'label', 'aria-label', 'placeholder'];
function trNo(n) { const v = n.nodeValue; if (!v || !v.trim()) return; if (n.__i18nOut === v) return; n.__pt = v; const o = ARD.idioma === 'pt-BR' ? v : tr(v); n.__i18nOut = o; if (o !== v) n.nodeValue = o; }
function trAttr(el, a) { const v = el.getAttribute(a); if (!v) return; const m = el.__i18nO || (el.__i18nO = {}); if (m[a] && m[a].out === v) return; const o = ARD.idioma === 'pt-BR' ? v : tr(v); m[a] = { pt: v, out: o }; if (o !== v) el.setAttribute(a, o); }
function varre(r) { if (r.nodeType === 3) { trNo(r); return; } if (r.nodeType !== 1) return; for (const a of ATTRS) if (r.hasAttribute(a)) trAttr(r, a); const w = document.createTreeWalker(r, 5); let n; while ((n = w.nextNode())) { if (n.nodeType === 3) trNo(n); else for (const a of ATTRS) if (n.hasAttribute(a)) trAttr(n, a); } }
function observar(el) { if (!el || el.__obs || typeof MutationObserver === 'undefined') return; el.__obs = 1; OBS.add(el);
  new MutationObserver(ms => { for (const m of ms) { if (m.type === 'characterData') trNo(m.target); else if (m.type === 'attributes') trAttr(m.target, m.attributeName); else m.addedNodes.forEach(varre); } }).observe(el, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  varre(el); }
function reObservados() { OBS.forEach(el => { const w = document.createTreeWalker(el, 5); let n = el; do { if (n.nodeType === 3) { if (n.__pt != null && n.nodeValue === n.__i18nOut) { n.__i18nOut = null; n.nodeValue = n.__pt; } trNo(n); } else if (n.nodeType === 1 && n.__i18nO) { for (const a in n.__i18nO) { const m = n.__i18nO[a]; if (n.getAttribute(a) === m.out) { m.out = null; n.setAttribute(a, m.pt); } trAttr(n, a); } } } while ((n = w.nextNode())); }); }
/* mapa de seletores → chaves para os trechos do HTML que ficam sem atributo (linhas compartilhadas com outras frentes): vira data-i18n na hora */
const MAPA = []; function mapa(m) { MAPA.push(m); marcaMapa(m); }
function marcaMapa(m) { if (typeof document === 'undefined') return; for (const sel in m) { const v = m[sel]; let els = []; try { els = document.querySelectorAll(sel); } catch (e) { continue; } els.forEach(el => { if (typeof v === 'string') { if (!el.hasAttribute('data-i18n')) el.setAttribute('data-i18n', v); } else for (const a in v) { const cur = el.getAttribute('data-i18n-attr') || ''; if (cur.indexOf(a + ':') < 0) el.setAttribute('data-i18n-attr', (cur ? cur + ';' : '') + a + ':' + v[a]); } }); } }
function marcaTudo() { MAPA.forEach(marcaMapa); }
const LANG_HTML = { 'pt-BR': 'pt-BR', en: 'en', es: 'es-419' };
function marcaHtml() { try { document.documentElement.lang = LANG_HTML[ARD.idioma]; document.documentElement.dataset.idioma = ARD.idioma; const md = document.querySelector('meta[name=description]'); const v = busca('meta.descricao', ARD.idioma); if (md && v) md.setAttribute('content', v); } catch (e) {} } /* a descrição da página no idioma (buscadores que rodam JS); os cartões og: ficam em inglês no HTML */
/* troca de idioma: guarda no aparelho (quando a escolha é da pessoa), refaz o DOM e avisa os módulos ('ard-idioma'); ?lang= da URL sai do endereço para a escolha valer */
/* carga dos dicionários: o pt-BR vem embutido no pacote (base e reserva); o en e o es são arquivos à parte (src/i18n/en.js e es.js, com o carimbo
   do build na URL), pedidos só por quem usa o idioma: o script do topo do <body> já carrega o do idioma escolhido antes do jogo; aqui, a troca
   na hora pede o outro. O service worker guarda os dois na instalação, então o jogo troca de idioma também sem internet. */
const VER = '__BUILD__'.replace(/[^0-9TZ]/g, '');
const CARGAS = {};
function carregar(l) { l = normaliza(l) || 'pt-BR'; if (DIC[l]) return Promise.resolve(l); if (CARGAS[l]) return CARGAS[l];
  return (CARGAS[l] = new Promise((ok, falha) => { const sc = document.createElement('script'); sc.src = 'src/i18n/' + l + '.js?v=' + VER; sc.onload = () => { if (DIC[l]) ok(l); else { CARGAS[l] = null; falha(new Error('dicionário vazio')); } }; sc.onerror = () => { CARGAS[l] = null; sc.remove(); falha(new Error('sem rede')); }; document.head.appendChild(sc); })); }
function set(l, opts) { l = normaliza(l) || 'pt-BR'; opts = opts || {}; if (!DIC[l]) { carregar(l).then(() => set(l, opts), () => { sincSel(); avisoSel(t('geral.idioma-offline')); }); return ARD.idioma; } avisoSel(''); const antes = ARD.idioma; ARD.idioma = l; CACHE.clear(); if (opts.salvar !== false) { try { localStorage.setItem(PREF, l); } catch (e) {} try { const u = new URL(location.href); if (u.searchParams.has('lang')) { u.searchParams.delete('lang'); history.replaceState(history.state, '', u.toString()); } } catch (e) {} }
  marcaHtml(); marcaTudo(); aplicar(document); sincSel(); reObservados(); if (antes !== l) { try { window.dispatchEvent(new CustomEvent('ard-idioma', { detail: { idioma: l, antes } })); } catch (e) {} } return l; }
/* seletor "Idioma / Language / Idioma": um <select> com cada idioma escrito no próprio idioma; o rótulo é o mesmo nos três. [data-idioma-sel] vira seletor */
const SELS = new Set();
function seletor(box) { if (!box || box.__idioma) return; box.__idioma = 1; const id = box.getAttribute('data-idioma-sel') || ('idioma-' + (SELS.size + 1));
  box.classList.add('idioma-sel'); box.innerHTML = '<label for="' + id + '"><svg class="ci" aria-hidden="true" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.6 3.9 5.6 3.9 9s-1.3 6.4-3.9 9c-2.6-2.6-3.9-5.6-3.9-9S9.4 5.6 12 3z"/></g></svg><span lang="pt-BR">Idioma</span> / <span lang="en">Language</span> / <span lang="es">Idioma</span></label>' +
    '<select id="' + id + '">' + IDIOMAS.map(l => '<option value="' + l + '" lang="' + LANG_HTML[l] + '">' + NOMES[l] + '</option>').join('') + '</select>';
  const sel = box.querySelector('select'); sel.value = ARD.idioma; sel.addEventListener('change', () => set(sel.value)); SELS.add(sel); }
function sincSel() { SELS.forEach(s => { if (s.value !== ARD.idioma) s.value = ARD.idioma; }); }
function avisoSel(txt) { SELS.forEach(s => { let a = s.parentNode.querySelector('.idioma-aviso'); if (!a && txt) { a = document.createElement('div'); a.className = 'small muted idioma-aviso'; a.setAttribute('role', 'status'); s.parentNode.appendChild(a); } if (a) { a.textContent = txt; a.hidden = !txt; } }); } /* idioma ainda não baixado e sem internet */
function seletores(raiz) { (raiz || document).querySelectorAll('[data-idioma-sel]').forEach(seletor); }
/* início: <html lang>, marcas do mapa, DOM traduzido e seletores; a classe i18n-espera (posta no topo do <body> fora do pt-BR) sai no fim, mesmo com erro */
function grava(el) { if (el.hasAttribute('data-i18n')) { if (simples(el)) { const k = el.getAttribute('data-i18n'), s = String(busca(k, 'pt-BR') || ''); el.__i18n = /[<&]/.test(s) ? el.innerHTML : el.textContent; } else el.__i18n = [...el.childNodes].filter(n => n.nodeType === 3 && n.nodeValue.trim()).map(n => n.nodeValue).join('\u0001'); }
  const spec = el.getAttribute('data-i18n-attr'); if (spec) { const mem = el.__i18nA || (el.__i18nA = {}); for (const par of spec.split(';')) { const i = par.indexOf(':'); if (i > 0) { const a = par.slice(0, i).trim(); mem[a] = el.getAttribute(a); } } } }
function iniciar() { if (ARD.idioma !== 'pt-BR' && !DIC[ARD.idioma]) { const l = ARD.idioma; ARD.idioma = 'pt-BR'; iniciar0(); carregar(l).then(() => set(l, { salvar: false }), () => {}); return; } iniciar0(); } /* o dicionário do idioma não veio pelo topo da página (sem rede e sem cache): começa em pt-BR e troca quando chegar */
function iniciar0() { try { marcaHtml(); marcaTudo(); if (ARD.idioma !== 'pt-BR') aplicar(document); else document.querySelectorAll('[data-i18n],[data-i18n-attr]').forEach(grava); /* no pt-BR, o HTML já está certo: só guarda o estado para a troca não pisar no que o código mudar depois */ seletores(document); ['benchbox', 'bench-det'].forEach(id => observar(document.getElementById(id))); document.querySelectorAll('[data-voz-ui]').forEach(observar); } catch (e) { try { console.warn('[ARD] idiomas:', e); } catch (e2) {} } finally { try { document.documentElement.classList.remove('i18n-espera'); } catch (e) {} } }
ARD.t = t; ARD.tn = tn; ARD.tr = tr; ARD.tg = tg;
ARD.i18n = { d, slug, observar, carregar, IDIOMAS, NOMES, LOCALE, origem: ini.origem, escolhe, normaliza, doNavegador, set, aplicar, mapa, seletor, seletores, num, iniciar, faltas: () => [...FALTAS], chaveDe,
  fmt: (n, o) => num(typeof n === 'number' ? n : +n, o), locale: () => LOCALE[ARD.idioma] };
if (typeof document !== 'undefined') marcaHtml();
})(globalThis.ARD = globalThis.ARD || {});
