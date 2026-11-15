/* Aether Rift: Dominion — 5.5b (agente m-hud): medição de uso SÓ EM CONTAGENS, sem cookies.
   O que é: um contador por tipo de acontecimento, guardado neste aparelho (localStorage, chave ard-medir-v1). Exemplo: { "partida.comecada.blitz": 3 }.
   O que NÃO é: não há cookie, identificador de aparelho ou de pessoa, impressão digital do navegador, hora de cada evento, endereço, idioma, tela
   nem texto digitado. Só nomes desta lista fechada (NOMES) e números inteiros.
   ENVIO: DESLIGADO. A constante ENDERECO está vazia e, enquanto estiver, enviar() não faz nenhum pedido de rede (nem sendBeacon, nem fetch).
   Para ligar no futuro (decisão do dono): pôr em ENDERECO o endereço do serviço escolhido. A partir daí enviar() manda, no máximo uma vez por
   visita (ao esconder a página), um lote com EXATAMENTE o que lote() devolve: { v, jogo, c: { nome: quantos desde o último envio } }.
   A tela "O que este jogo conta" (Ajustes) mostra as contagens do aparelho, zera e desliga a contagem.
   API: ARD.medir.conta(nome[, n]) · ler() · zerar() · ligado() · liga(bool) · lote() · enviar() · tela() · NOMES · ENDERECO.
   Roda no Node (sem DOM) para os testes. Não conhece a simulação. */
(function (ARD) {
'use strict';
const CHAVE = 'ard-medir-v1';
const ENDERECO = ''; /* vazio = envio desligado. NÃO preencher sem a decisão do dono (ver work/RELATORIO.md do agente m-hud, seção da medição). */
const MODOS = ['escaramuca', 'blitz', 'campanha', 'cacada', 'guiada', 'multi', 'desafio'];
const NOMES = [].concat(MODOS.map(m => 'partida.comecada.' + m), MODOS.map(m => 'partida.terminada.' + m),
  ['guia.concluida', 'guia.pulada', 'convite.criado', 'convite.aberto', 'desafio.jogado', 'cartao.compartilhado', 'motor.classico', 'motor.m5', 'motor.2d', 'degrau.apresentado', 'degrau.aceito']);
const VALE = new Set(NOMES); const T = (k, v, r) => (ARD.t ? ARD.t(k, v, r) : (r != null ? r : k));
let mem = null; const guarda = () => { try { if (typeof localStorage !== 'undefined') { localStorage.getItem(CHAVE); return localStorage; } } catch (e) {} if (!mem) { const m = new Map(); mem = { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) }; } return mem; };
function limpo(o) { const out = { v: 1, ligado: true, c: {}, e: {} }; if (o && typeof o === 'object') { if (o.ligado === false) out.ligado = false; for (const k of ['c', 'e']) if (o[k] && typeof o[k] === 'object') for (const n of NOMES) { const x = o[k][n]; if (Number.isFinite(x) && x > 0) out[k][n] = Math.min(1e9, Math.floor(x)); } } return out; } /* c: contagens; e: quanto de cada uma já foi enviado */
function le() { try { return limpo(JSON.parse(guarda().getItem(CHAVE) || 'null')); } catch (e) { return limpo(null); } }
function grava(s) { try { guarda().setItem(CHAVE, JSON.stringify(s)); return true; } catch (e) { return false; } }
/* conta um acontecimento. Nome fora da lista é ignorado (devolve false): nada entra aqui por engano. */
function conta(nome, n) { if (!VALE.has(nome)) return false; const s = le(); if (!s.ligado) return false; s.c[nome] = (s.c[nome] || 0) + Math.max(1, Math.floor(n || 1)); grava(s); return true; }
function ler() { const s = le(); const out = {}; for (const n of NOMES) out[n] = s.c[n] || 0; return out; }
function ligado() { return le().ligado; }
function liga(v) { const s = le(); s.ligado = !!v; grava(s); return s.ligado; }
function zerar() { const s = le(); s.c = {}; s.e = {}; grava(s); return true; }
/* a lista exata do que seria enviado: só o que mudou desde o último envio. Nenhum outro campo existe. */
function lote() { const s = le(); const c = {}; for (const n of NOMES) { const d = (s.c[n] || 0) - (s.e[n] || 0); if (d > 0) c[n] = d; } return { v: 1, jogo: 'aether-rift-dominion', c }; }
/* O PONTO DE LIGAR. Com ENDERECO vazio (como está) ou com a contagem desligada, devolve false sem tocar na rede. */
function enviar() { if (!ENDERECO) return false; const s = le(); if (!s.ligado) return false; const l = lote(); if (!Object.keys(l.c).length) return false;
  if (typeof navigator === 'undefined' || typeof navigator.sendBeacon !== 'function') return false;
  let ok = false; try { ok = navigator.sendBeacon(ENDERECO, new Blob([JSON.stringify(l)], { type: 'text/plain' })); } catch (e) { ok = false; }
  if (ok) { for (const n in l.c) s.e[n] = (s.e[n] || 0) + l.c[n]; grava(s); } return ok; }
/* nome do modo de uma partida, pela configuração dela (main.js chama no começo e no fim) */
function modoDe(cfg, rede) { cfg = cfg || {}; if (cfg.bench) return null; if (cfg.guia) return 'guiada'; if (rede) return 'multi'; if (cfg.desafio) return 'desafio'; if (cfg.campaign) return 'campanha'; if (cfg.cacada) return 'cacada'; if (cfg.blitz) return 'blitz'; return 'escaramuca'; }
function partida(cfg, rede, motor) { const m = modoDe(cfg, rede); if (!m) return null; conta('partida.comecada.' + m); if (motor) conta('motor.' + motor); return m; }
function fim(cfg, rede) { const m = modoDe(cfg, rede); if (!m) return null; conta('partida.terminada.' + m); return m; }

/* ---------- a tela "O que este jogo conta" (Ajustes) ---------- */
const ROT = { 'partida.comecada': 'Partidas começadas', 'partida.terminada': 'Partidas terminadas', 'guia.concluida': 'Primeira partida guiada concluída', 'guia.pulada': 'Primeira partida guiada pulada', 'convite.criado': 'Links de convite copiados', 'convite.aberto': 'Links de convite abertos', 'desafio.jogado': 'Desafios do Dia jogados', 'cartao.compartilhado': 'Cartões de resultado baixados, copiados ou compartilhados', 'motor.classico': 'Partidas no motor gráfico clássico', 'motor.m5': 'Partidas no Motor 5', 'motor.2d': 'Partidas no modo 2D', 'degrau.apresentado': 'Novidades apresentadas', 'degrau.aceito': 'Próximos passos aceitos' };
const MODO_ROT = { escaramuca: 'Escaramuça', blitz: 'Blitz', campanha: 'Campanha', cacada: 'Caçada', guiada: 'Primeira partida', multi: 'Multiplayer', desafio: 'Desafio do Dia' };
function rotulo(n) { const m = /^(partida\.(?:comecada|terminada))\.(.+)$/.exec(n); if (m) return T('medir.n.' + m[1], null, ROT[m[1]]) + ' · ' + T('medir.modo.' + m[2], null, MODO_ROT[m[2]]); return T('medir.n.' + n, null, ROT[n] || n); }
function tela() { if (typeof document === 'undefined') return null; const esc = s => String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  let el = document.getElementById('medir-tela'); if (!el) { el = document.createElement('div'); el.id = 'medir-tela'; el.className = 'modal'; el.hidden = true; document.body.appendChild(el);
    el.addEventListener('click', ev => { const b = ev.target.closest && ev.target.closest('[data-medir]'); if (ev.target === el || (b && b.dataset.medir === 'fechar')) { el.hidden = true; return; } if (!b) return;
      if (b.dataset.medir === 'zerar') { zerar(); tela(); } }); el.addEventListener('change', ev => { if (ev.target && ev.target.id === 'medir-ligado') { liga(ev.target.checked); tela(); } });
    window.addEventListener('keydown', ev => { if (ev.code === 'Escape' && !el.hidden) { el.hidden = true; ev.stopPropagation(); } }, true); window.addEventListener('ard-idioma', () => { if (!el.hidden) tela(); }); }
  const c = ler(); const on = ligado(); const linhas = NOMES.map(n => '<tr' + (c[n] ? '' : ' class="zero"') + '><td>' + esc(rotulo(n)) + '</td><td>' + c[n] + '</td></tr>').join(''); const l = lote();
  el.innerHTML = '<div class="box medir-box" role="dialog" aria-modal="true" aria-labelledby="medir-tit"><button class="mclose" type="button" data-medir="fechar" aria-label="' + esc(T('diplo.fechar', null, 'Fechar')) + '">✕</button>' +
    '<div class="eyebrow">' + esc(T('medir.eyebrow', null, 'Privacidade')) + '</div><h2 id="medir-tit">' + esc(T('medir.titulo', null, 'O que este jogo conta')) + '</h2>' +
    '<p class="small">' + esc(T('medir.explica', null, 'O jogo conta, neste aparelho, quantas vezes algumas coisas acontecem. São só números: sem cookies, sem identificar você nem o aparelho, sem hora nem lugar.')) + '</p>' +
    '<p class="small medir-envio"><b>' + esc(ENDERECO ? T('medir.envio.ligado', null, 'Estas contagens são enviadas, somadas e sem identificação, ao serviço de medição do jogo.') : T('medir.envio.desligado', null, 'Nada disto sai do seu aparelho: nesta versão o envio está desligado.')) + '</b></p>' +
    '<label class="chk"><input type="checkbox" id="medir-ligado"' + (on ? ' checked' : '') + '> <span>' + esc(T('medir.ligado', null, 'Contar neste aparelho')) + '</span></label>' +
    '<div class="medir-lista"><table><thead><tr><th>' + esc(T('medir.col.oque', null, 'O que')) + '</th><th>' + esc(T('medir.col.quantas', null, 'Vezes')) + '</th></tr></thead><tbody>' + linhas + '</tbody></table></div>' +
    '<details class="small"><summary>' + esc(T('medir.lote', null, 'O que seria enviado, se o envio fosse ligado')) + '</summary><pre id="medir-lote">' + esc(JSON.stringify(l, null, 1)) + '</pre></details>' +
    '<div class="row"><button type="button" class="btn" data-medir="zerar">' + esc(T('medir.zerar', null, 'Zerar contagens')) + '</button><button type="button" class="btn primary" data-medir="fechar">' + esc(T('diplo.fechar', null, 'Fechar')) + '</button></div></div>';
  el.hidden = false; return el; }
/* o botão que abre a tela, nos Ajustes da tela inicial (bloco próprio, antes do Enviar feedback) */
function montar() { if (typeof document === 'undefined') return; const pane = document.querySelector('#start .cpane[data-pane="ajustes"]');
  if (pane && !document.getElementById('btn-medir')) { const d = document.createElement('div'); d.className = 'row medir-cfg'; d.innerHTML = '<button type="button" class="btn" id="btn-medir"></button>';
    const fb = document.getElementById('cfg-feedback'); const ref = fb ? fb.closest('.row') : null; if (ref && ref.parentElement === pane) pane.insertBefore(d, ref); else pane.appendChild(d);
    document.getElementById('btn-medir').addEventListener('click', () => tela()); }
  const rot = () => { const b = document.getElementById('btn-medir'); if (b) b.textContent = T('medir.titulo', null, 'O que este jogo conta'); }; rot(); window.addEventListener('ard-idioma', rot);
  /* cartão de resultado: conta quando a imagem é baixada, copiada ou compartilhada (os botões são do src/fim.js; aqui só se escuta o clique) */
  document.addEventListener('click', ev => { const b = ev.target.closest && ev.target.closest('#cartao-baixar,#cartao-copiar,#cartao-enviar'); if (b) conta('cartao.compartilhado'); const cv = ev.target.closest && ev.target.closest('#btn-convite'); if (cv) conta('convite.criado'); }, true);
  /* primeira partida guiada pulada: o "Pular o guia" (src/guia.js) pede confirmação; conta quando o jogador confirma */
  { let pend = false; document.addEventListener('click', ev => { const t = ev.target; if (!t.closest) return; if (t.closest('[data-g="pular"]')) pend = true; else if (t.closest('#confirm-yes')) { if (pend) conta('guia.pulada'); pend = false; } else if (t.closest('#confirm')) pend = false; }, true); }
  /* convite aberto: a página foi aberta por um link de convite (?sala=CÓDIGO) */
  try { const q = new URLSearchParams(location.search); if (q.get('sala') && !q.get('autostart')) conta('convite.aberto'); } catch (e) {}
  /* o envio, se um dia for ligado, acontece quando a página é escondida; com ENDERECO vazio isto não faz nada */
  if (ENDERECO) document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') enviar(); }); }
if (typeof document !== 'undefined') { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montar); else montar(); }
ARD.medir = { CHAVE, ENDERECO, NOMES, MODOS, conta, ler, zerar, ligado, liga, lote, enviar, modoDe, partida, fim, rotulo, tela, montar };
})(globalThis.ARD = globalThis.ARD || {});
