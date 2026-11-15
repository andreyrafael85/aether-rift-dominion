/* Aether Rift: Dominion — 5.5a: catálogo de cosméticos como DADOS (Etapa 0 da monetização: nada é vendido, não há preço, loja nem moeda).
   Cada item: id (estável, minúsculas e hífen), tipo (pintura do Núcleo, estandarte, moldura do cartão, título, cor do nome, rastro),
   raca (null = todas), ganha ('gratis', 'conquista' ou 'apoiador') e, nas de conquista, a condição (conquista: id da campanha, ou nivel: N).
   REGRA DURA: cosmético nunca entra na simulação. Este arquivo não conhece o ARD.sim; os ids viajam na lista da sala (src/net.js, campo cosm),
   fora da cfg da partida, e só o desenho e a interface os leem. Id desconhecido, repetido ou de outra Raça cai no padrão (limpa()).
   Sem DOM além do que a interface pede (enfeita()); roda no Node para os testes (tools/cosmeticos-test.cjs). */
(function (ARD) {
'use strict';
const TIPOS = ['pintura', 'estandarte', 'moldura', 'titulo', 'cor-nome', 'rastro'];
const GANHA = ['gratis', 'conquista', 'apoiador'];
/* pronto: false = o dado existe, a arte ainda não (o Hangar mostra "em produção" e o item não pode ser usado).
   skin: o estilo do Núcleo que o modelo já tem (0 Padrão, 1 Fortaleza, 2 Santuário). cor: cor do nome (CSS). */
const CATALOGO = [
  { id: 'pin-padrao', tipo: 'pintura', raca: null, ganha: 'gratis', skin: 0, nome: 'Padrão' },
  { id: 'pin-fortaleza', tipo: 'pintura', raca: null, ganha: 'conquista', nivel: 10, skin: 1, nome: 'Fortaleza' },
  { id: 'pin-santuario', tipo: 'pintura', raca: null, ganha: 'conquista', nivel: 20, skin: 2, nome: 'Santuário' },
  { id: 'est-padrao', tipo: 'estandarte', raca: null, ganha: 'gratis', nome: 'Sem estandarte' },
  { id: 'est-apoiador', tipo: 'estandarte', raca: null, ganha: 'apoiador', pronto: false, nome: 'Estandarte do Alinhamento' },
  { id: 'mol-padrao', tipo: 'moldura', raca: null, ganha: 'gratis', nome: 'Moldura simples' },
  { id: 'mol-alinhamento', tipo: 'moldura', raca: null, ganha: 'conquista', conquista: 'primeiro-passo', nome: 'Moldura do Alinhamento' },
  { id: 'mol-cinco-mundos', tipo: 'moldura', raca: null, ganha: 'conquista', conquista: 'cinco-racas', nome: 'Moldura dos Cinco Mundos' },
  { id: 'mol-apoiador', tipo: 'moldura', raca: null, ganha: 'apoiador', nome: 'Moldura de Apoiador' },
  { id: 'tit-nenhum', tipo: 'titulo', raca: null, ganha: 'gratis', nome: 'Sem título' },
  { id: 'tit-recruta', tipo: 'titulo', raca: null, ganha: 'conquista', conquista: 'primeiro-passo', nome: 'Recruta do Alinhamento' },
  { id: 'tit-palavra-dada', tipo: 'titulo', raca: null, ganha: 'conquista', conquista: 'diplomata', nome: 'Palavra Dada' },
  { id: 'tit-apoiador', tipo: 'titulo', raca: null, ganha: 'apoiador', nome: 'Apoiador da Fenda' },
  { id: 'cor-padrao', tipo: 'cor-nome', raca: null, ganha: 'gratis', cor: null, nome: 'Cor padrão' },
  { id: 'cor-veterano', tipo: 'cor-nome', raca: null, ganha: 'conquista', conquista: 'comandante-10', cor: '#FFD27A', nome: 'Ouro de veterano' },
  { id: 'cor-apoiador', tipo: 'cor-nome', raca: null, ganha: 'apoiador', cor: '#9FE8FF', nome: 'Azul de apoiador' },
  { id: 'ras-padrao', tipo: 'rastro', raca: null, ganha: 'gratis', nome: 'Rastro padrão' },
  { id: 'ras-apoiador', tipo: 'rastro', raca: null, ganha: 'apoiador', pronto: false, nome: 'Rastro do Sifão em espiral' },
];
const POR_ID = Object.create(null); for (const it of CATALOGO) POR_ID[it.id] = it;
const PADRAO = Object.create(null); for (const it of CATALOGO) if (it.ganha === 'gratis' && !PADRAO[it.tipo]) PADRAO[it.tipo] = it; /* o primeiro grátis de cada tipo é o padrão */
const ID_OK = /^[a-z0-9-]{1,32}$/; const MAX = 8;
const T = (k, v, r) => (ARD.t ? ARD.t(k, v, r) : (r != null ? r : k));
const P = () => ARD.progress;
function porId(id) { return typeof id === 'string' && POR_ID[id] ? POR_ID[id] : null; }
function serve(it, raca) { return !!it && (it.raca == null || raca == null || it.raca === raca); }
/* o jogador tem o item? grátis: sempre; conquista: a conquista da campanha ou o nível do Comandante; apoiador: ninguém ainda (Etapa 0) */
function tem(id, prog) { const it = porId(id); if (!it || it.pronto === false) return false; if (it.ganha === 'gratis') return true; if (it.ganha !== 'conquista') return false;
  let s = prog; if (!s) { try { s = P().load(); } catch (e) { s = null; } } if (!s) return false;
  if (s.cosm && s.cosm[it.id]) return true; /* 5.5b: já liberado de verdade (registro no ProgressStore): fica do jogador */
  return cumpre(it, s); }
/* 5.5b: a condição do item de conquista vale agora? (a conquista da campanha ou o nível do Comandante) */
function cumpre(it, s) { if (!it || it.ganha !== 'conquista' || it.pronto === false || !s) return false;
  if (it.conquista) return !!(s.achievements && s.achievements[it.conquista]); if (it.nivel) return ((s.commander && s.commander.level) || 1) >= it.nivel; return false; }
/* 5.5b: libera de verdade o que a conquista já pagou: grava cada item novo no ProgressStore (cosm: { id: quando }) e devolve a lista dos que
   entraram agora, para o aviso da tela final. Chamado ao abrir o jogo (em silêncio: o que o jogador já tinha não vira aviso) e no fim de cada partida.
   Só progresso e interface: não toca na simulação. */
function confere() { const out = []; let s = null; try { s = P().load(); } catch (e) { return out; } if (!s || !P().cosmLibera) return out;
  for (const it of CATALOGO) if (it.ganha === 'conquista' && !(s.cosm && s.cosm[it.id]) && cumpre(it, s) && P().cosmLibera(it.id)) out.push(it); return out; }
/* 5.5b: o aviso discreto da tela final: uma linha "Novo no Hangar: …" logo acima dos botões (elemento próprio, criado aqui; some se não há item novo) */
function avisoFim(itens) { if (typeof document === 'undefined') return null; let el = document.getElementById('fim-cosm'); const linha = document.querySelector('#end .fim-botoes');
  if (!itens || !itens.length) { if (el) el.hidden = true; return null; } if (!el) { el = document.createElement('p'); el.id = 'fim-cosm'; el.className = 'fim-cosm'; el.setAttribute('role', 'status'); if (linha && linha.parentElement) linha.parentElement.insertBefore(el, linha); else return null; }
  el.__itens = itens; el.textContent = '✦ ' + T('cosm.fim.novo', { itens: itens.map(nome).join(' · ') }, 'Novo no Hangar: {itens}'); el.hidden = false; return el; }
if (typeof window !== 'undefined') window.addEventListener('ard-idioma', () => { const el = document.getElementById('fim-cosm'); if (el && !el.hidden && el.__itens) avisoFim(el.__itens); });
function nome(it) { return it ? T('cosm.item.' + it.id, null, it.nome) : ''; }
function nomeTipo(t) { return T('cosm.tipo.' + t, null, t); }
/* como se ganha, em texto (nunca um preço) */
function comoGanha(it) { if (!it) return ''; if (it.pronto === false) return T('cosm.em-producao', null, 'Em produção');
  if (it.ganha === 'gratis') return T('cosm.gratis', null, 'Grátis'); if (it.ganha === 'apoiador') return T('cosm.apoiador', null, 'Edição de Apoiador (ainda não disponível)');
  if (it.nivel) return T('cosm.nivel', { n: it.nivel }, 'Chegue ao nível {n} de Comandante');
  const C = ARD.campaign; return T('cosm.conquista', { nome: C && C.conquista ? C.conquista(it.conquista) : it.conquista }, 'Conquista: {nome}'); }
/* o que chegou de outro jogador (ou do armazenamento): só ids do catálogo, um por tipo, da Raça certa; o resto cai no padrão */
function limpa(ids, raca) { const out = Object.create(null); for (const t of TIPOS) out[t] = PADRAO[t];
  if (Array.isArray(ids)) { const visto = Object.create(null); for (let i = 0; i < ids.length && i < MAX; i++) { const id = ids[i]; if (typeof id !== 'string' || !ID_OK.test(id)) continue; const it = POR_ID[id]; if (!it || it.pronto === false || visto[it.tipo] || !serve(it, raca)) continue; visto[it.tipo] = 1; out[it.tipo] = it; } }
  return out; }
/* a forma que viaja na rede: lista curta de ids válidos na forma (o catálogo de quem recebe decide o resto) */
function forma(ids) { const out = []; if (Array.isArray(ids)) for (const id of ids) { if (out.length >= MAX) break; if (typeof id === 'string' && ID_OK.test(id) && !out.includes(id)) out.push(id); } return out; }
/* o que este jogador usa: a pintura vem do estilo do Núcleo já salvo no Hangar (hangar.skin[raça]); o resto, de hangar.cosm[tipo] */
function usados(raca, prog) { let s = prog; if (!s) { try { s = P().load(); } catch (e) { s = null; } } const h = (s && s.hangar) || {}; const out = [];
  const sk = (h.skin && h.skin[raca]) || 0; const pin = CATALOGO.find(it => it.tipo === 'pintura' && it.skin === sk && serve(it, raca)); if (pin && tem(pin.id, s)) out.push(pin.id);
  const c = h.cosm || {}; for (const t of TIPOS) { if (t === 'pintura') continue; const it = porId(c[t]); if (it && serve(it, raca) && tem(it.id, s) && it !== PADRAO[t]) out.push(it.id); }
  return out; }
function anuncia(raca) { return forma(usados(raca)); }
function equipa(tipo, id) { const it = porId(id); if (!it || it.tipo !== tipo || tipo === 'pintura' || !tem(id)) return false; P().setHangar({ cosm: { [tipo]: id } }); return true; }
function skinDe(ids, raca) { const it = limpa(ids, raca).pintura; return (it && it.skin) || 0; }
/* interface: veste um elemento de nome (lista da sala, diplomacia) com a moldura, a cor do nome e o título de quem é dono dele */
function enfeita(el, ids, raca) { if (!el) return; const c = limpa(ids, raca); for (const k of Array.from(el.classList)) if (k.indexOf('cz-') === 0) el.classList.remove(k);
  if (c.moldura !== PADRAO.moldura) el.classList.add('cz-mol', 'cz-' + c.moldura.id); if (c['cor-nome'].cor) { el.classList.add('cz-cor'); el.style.setProperty('--cz-cor', c['cor-nome'].cor); } else el.style.removeProperty('--cz-cor');
  el.dataset.cosm = TIPOS.map(t => c[t].id).filter(id => PADRAO[POR_ID[id].tipo].id !== id).join(' ');
  const velho = el.querySelector(':scope > .cz-tit'); if (velho) velho.remove(); if (c.titulo !== PADRAO.titulo) { const s = document.createElement('span'); s.className = 'cz-tit'; s.textContent = nome(c.titulo); el.appendChild(s); } }
/* o mesmo, para HTML montado em texto: devolve { cls, estilo, titulo } já escapados */
function marcas(ids, raca) { const c = limpa(ids, raca); const esc = s => String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  return { cls: (c.moldura !== PADRAO.moldura ? ' cz-mol cz-' + c.moldura.id : '') + (c['cor-nome'].cor ? ' cz-cor' : ''), estilo: c['cor-nome'].cor ? '--cz-cor:' + c['cor-nome'].cor : '', titulo: c.titulo !== PADRAO.titulo ? '<span class="cz-tit">' + esc(nome(c.titulo)) + '</span>' : '' }; }
/* ---------- Hangar: a lista do catálogo, com cadeado no que o jogador não tem (sem preço, sem loja) ---------- */
function hangar() { if (typeof document === 'undefined') return; const box = document.querySelector('#hangar .hg-opts'); if (!box) return; let el = document.getElementById('hg-cosm'); if (!el) { el = document.createElement('div'); el.id = 'hg-cosm'; el.className = 'hg-cosm'; box.appendChild(el); }
  const esc = s => String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const sel = document.getElementById('hg-race'); const raca = (sel && sel.value) || null; let s = null; try { s = P().load(); } catch (e) {} const h = (s && s.hangar) || {}; const c = h.cosm || {};
  const skinOn = (() => { const b = document.querySelector('#hg-skins .chip2.on'); return b ? +b.dataset.skin : ((h.skin && h.skin[raca]) || 0); })();
  let html = '<div class="small muted">' + esc(T('cosm.hg.titulo', null, 'Cosméticos')) + '</div>';
  for (const t of TIPOS) { const itens = CATALOGO.filter(it => it.tipo === t && serve(it, raca)); if (!itens.length) continue;
    html += '<div class="cz-grupo"><div class="cz-tipo">' + esc(nomeTipo(t)) + '</div><div class="cz-itens">' + itens.map(it => { const meu = tem(it.id, s); const on = t === 'pintura' ? it.skin === skinOn && meu : (c[t] ? c[t] === it.id : it === PADRAO[t]);
      return '<button type="button" class="cz-item' + (on ? ' on' : '') + (meu ? '' : ' trancado') + '" data-cosm="' + it.id + '" aria-pressed="' + (on ? 'true' : 'false') + '"' + (meu ? '' : ' aria-disabled="true"') + '><span class="cz-n">' + (meu ? '' : '<span class="cz-cad" aria-hidden="true">🔒</span>') + esc(nome(it)) + '</span><small>' + esc(on ? T('cosm.em-uso', null, 'Em uso') : comoGanha(it)) + '</small></button>'; }).join('') + '</div></div>'; }
  html += '<div class="small muted cz-nota">' + esc(T('cosm.hg.nota', null, 'Só aparência: nada aqui muda o resultado de uma partida.')) + '</div>'; el.innerHTML = html;
  el.querySelectorAll('[data-cosm]').forEach(b => b.addEventListener('click', () => { const it = porId(b.dataset.cosm); if (!it || !tem(it.id)) return;
    if (it.tipo === 'pintura') { const k = document.querySelector('#hg-skins [data-skin="' + it.skin + '"]'); if (k && !k.disabled) k.click(); } else equipa(it.tipo, it.id); hangar(); })); }
function montar() { if (typeof document === 'undefined') return; const hg = document.getElementById('hangar'); if (!hg || hg.__cosm) return; hg.__cosm = true;
  new MutationObserver(() => { if (!hg.hidden) hangar(); }).observe(hg, { attributes: true, attributeFilter: ['hidden'] });
  hg.addEventListener('change', e => { if (e.target && e.target.id === 'hg-race') setTimeout(hangar, 0); }); hg.addEventListener('click', e => { if (e.target && e.target.closest && e.target.closest('#hg-skins')) setTimeout(hangar, 0); });
  if (typeof window !== 'undefined') window.addEventListener('ard-idioma', () => { if (!hg.hidden) hangar(); }); }
if (typeof document !== 'undefined') { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montar); else montar(); }
try { confere(); } catch (e) {} /* 5.5b: ao abrir o jogo, o que o jogador já tinha ganho fica registrado sem aviso */
ARD.cosmeticos = { confere, cumpre, avisoFim /* 5.5b */, hangar, montar, TIPOS, GANHA, CATALOGO, PADRAO, MAX, porId, serve, tem, nome, nomeTipo, comoGanha, limpa, forma, usados, anuncia, equipa, skinDe, enfeita, marcas };
})(globalThis.ARD = globalThis.ARD || {});
