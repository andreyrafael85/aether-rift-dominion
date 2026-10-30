/* 5.0c.1: monta work/vozes-jogo.html, a página de escuta das vozes gravadas do jogo, para o dono: uma amostra por Raça e por idioma do locutor,
   da unidade e do líder, duas falas da campanha, os números (falas, duração e tamanho por idioma e por pacote), a conferência pelo Whisper e as
   falas que ficaram acima do limite (para ouvir). Toca os mesmos arquivos do jogo (Opus em Ogg, em assets/vozes/; o Safari do iPhone do dono toca
   Opus, pela bancada de 30/10/2026, e o jogo fica só com ele). Grava também o mapa de publicação work/vozes-jogo-publicar.json.
   Chamado por tools/vozes/pagina.mjs (sem --escolha). Uso: node tools/vozes/pagina.mjs */
import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
const root = new URL('../..', import.meta.url).pathname;
const ler = (p, d) => { try { return JSON.parse(readFileSync(root + p, 'utf8')); } catch (e) { if (d !== undefined) return d; throw e; } };
const R = ler('tools/vozes/roteiro.json');
const IDI = ['pt-BR', 'en', 'es'], NOME_IDI = { 'pt-BR': 'Português', en: 'English', es: 'Español' }, CURTO = { 'pt-BR': 'PT', en: 'EN', es: 'ES' };
const RACAS = R.racas, LIDER = R.lideres, NOME_RACA = { vehnar: 'Vehnar', erevane: 'Erevane', tessara: 'Tessara', quorith: 'Quorith', vorag: 'Vorag' };
const MAN = Object.fromEntries(IDI.map(l => [l, ler(`assets/vozes/${l}/manifesto.json`, null)]));
const EST = Object.fromEntries(IDI.map(l => [l, ler(`work/vozes-jogo/${l}/estado.json`, {})]));
const NUM = ler('work/vozes-jogo/numeros.json', {}), TEMPOS = Object.fromEntries(IDI.map(l => [l, ler(`work/vozes-jogo/${l}/tempos.json`, [])]));
/* 5.0c.2: a Erevane com voz masculina fora do líder — medidas antes e depois (gerar.py --etapa medir) e os Opus de antes guardados em work/vozes-jogo/antes/ */
const MED = { antes: ler('work/vozes-jogo/medidas-antes.json', null), depois: ler('work/vozes-jogo/medidas-depois.json', null) };
const ANTES_DEPOIS = [['Locutor', 'erevane-loc-base-sob-ataque'], ['Locutor', 'erevane-loc-spawn'], ['Locutor', 'erevane-loc-nucleo-sob-ataque'], ['Unidade · infantaria', 'erevane-unid-infantaria-sel-1'], ['Unidade · civil', 'erevane-unid-civil-mover-1']];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fala = id => R.falas.find(f => f.id === id);
const nbr = (x, d = 0) => Number(x).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
const kb = b => nbr(b / 1024) + ' KB', mb = b => nbr(b / 1048576, 2) + ' MB', min = s => nbr(s / 60, 1) + ' min';

/* ---------- as amostras ---------- */
const AMOSTRA = {
  locutor: r => `${r}-loc-base-sob-ataque`,
  unidade: r => ({ vehnar: 'vehnar-unid-veiculo-atacar-2', erevane: 'erevane-unid-infantaria-sel-2', tessara: 'tessara-unid-infantaria-atacar-2', quorith: 'quorith-unid-infantaria-sel-1', vorag: 'vorag-unid-infantaria-atacar-1' })[r],
  lider: r => `${r}-sala-2`
};
const CAMP = ['p1-0-tessara', 'a2m1-0-erevane'];
const arquivos = {}; /* caminho publicado → arquivo local */
function audio(l, id) { /* o Opus publicado para a fala, ou null se ela ainda não foi gerada */
  const m = MAN[l]; const f = m && m.falas[id]; if (!f) return null; const ogg = `vozes/${l}/${f.arq}`; arquivos[ogg] = `assets/vozes/${l}/${f.arq}`;
  return { ogg, dur: f.dur, texto: f.texto };
}
function botoes(id) { return IDI.map(l => { const a = audio(l, id); return a ? `<button type="button" class="vb" data-ogg="${a.ogg}" aria-label="Ouvir em ${NOME_IDI[l]}">${CURTO[l]}</button>` : `<span class="vb off" title="ainda não gerada">${CURTO[l]}</span>`; }).join(''); }
function linha(rotulo, id, tipo) { const f = fala(id); if (!f) return ''; const tx = IDI.map(l => `<span lang="${l}"><b>${CURTO[l]}</b> ${esc(f.texto[l])}</span>`).join('');
  return `<div class="row" data-tipo="${tipo}"><div class="tx"><small>${esc(rotulo)}</small>${tx}</div><div class="vbtns">${botoes(id)}</div></div>`; }

/* ---------- números e conferência ---------- */
const TIPOS = ['locutor', 'elim', 'unidade', 'lider', 'campanha'], NOME_TIPO = { locutor: 'Locutor', elim: 'Eliminações', unidade: 'Unidades', lider: 'Líder', campanha: 'Campanha' };
const conf = {}; const ouvir = [];
for (const l of IDI) { const E = EST[l]; const c = conf[l] = { n: 0, exatas: 0, soma: 0, acima: 0, regravadas: 0, porTipo: {} };
  for (const f of R.falas) { const e = E[f.id]; if (!e) continue; const t = c.porTipo[f.tipo] || (c.porTipo[f.tipo] = { n: 0, soma: 0, acima: 0, exatas: 0 });
    c.n++; t.n++; c.soma += e.cer; t.soma += e.cer; if (e.cer === 0) { c.exatas++; t.exatas++; } if (!e.ok) { c.acima++; t.acima++; ouvir.push({ l, f, e }); } if ((e.tentativas || []).some(x => x.k > 0)) c.regravadas++; } }
const pct = (a, b) => b ? nbr(100 * a / b, 1) + '%' : '—';
const tabIdi = IDI.map(l => { const t = (NUM[l] || {}).total || {}; const c = conf[l]; const tp = TEMPOS[l]; const rel = tp.reduce((s, x) => s + (x.relogio_s || 0), 0);
  return `<tr><th scope="row">${NOME_IDI[l]}</th><td>${nbr(t.n || 0)} de ${nbr(R.falas.length)}</td><td>${t.dur ? min(t.dur) : '—'}</td><td>${t.ogg_b ? mb(t.ogg_b) : '—'}</td><td>${pct(c.soma, c.n)}</td><td>${nbr(c.exatas)} (${pct(c.exatas, c.n)})</td><td>${nbr(c.acima)}</td><td>${rel ? min(rel) : '—'}</td></tr>`; }).join('');
const pacotes = [...RACAS, ...Object.keys(R.chaves).filter(p => p.startsWith('camp-'))];
const tabPac = pacotes.map(p => `<tr><th scope="row">${esc(p)}</th>${IDI.map(l => { const q = ((NUM[l] || {}).pacotes || {})[p]; return `<td>${q ? nbr(q.n) + ' · ' + kb(q.ogg_b) : '—'}</td>`; }).join('')}</tr>`).join('');
const tabTipo = TIPOS.map(t => `<tr><th scope="row">${NOME_TIPO[t]}</th>${IDI.map(l => { const x = conf[l].porTipo[t]; return `<td>${x ? pct(x.soma, x.n) + ' · ' + x.acima + ' acima' : '—'}</td>`; }).join('')}</tr>`).join('');
const listaOuvir = ouvir.slice(0, 80).map(({ l, f, e }) => { const a = audio(l, f.id);
  return `<div class="row" data-tipo="ouvir"><div class="tx"><small>${esc(NOME_IDI[l])} · ${esc(NOME_TIPO[f.tipo])} · ${esc(NOME_RACA[f.raca])} · erro ${nbr(100 * e.cer, 1)}%${e.seco ? ' · seca ' + nbr(100 * e.seco.cer, 1) + '%' : ''}</small><span><b>texto</b> ${esc(f.texto[l])}</span><span><b>ouviu</b> ${esc(e.asr || '(nada)')}</span></div><div class="vbtns">${a ? `<button type="button" class="vb" data-ogg="${a.ogg}" aria-label="Ouvir">▶</button>` : ''}</div></div>`; }).join('');

/* ---------- a página ---------- */
const cartoes = RACAS.map(r => `<article class="plate card" data-r="${r}"><header><span class="rn">${NOME_RACA[r]}</span><small>${esc(LIDER[r])} · locutor ${r === 'tessara' ? 'feminino' : 'masculino'}${r === 'vorag' ? ' · variante C' : ''}${r === 'quorith' ? ' · estéreo' : ''}</small></header>
${linha('Locutor', AMOSTRA.locutor(r), 'aviso')}${linha('Unidade', AMOSTRA.unidade(r), 'unidade')}${linha('Líder · saudação nova da Sala', AMOSTRA.lider(r), 'lider')}</article>`).join('\n');
const camp = CAMP.map(id => { const f = fala(id); return f ? linha(`Campanha · missão ${f.missao} · ${f.lider}`, id, 'lider') : ''; }).join('');
const cont = R.contagem.por_tipo;
const hz = x => x == null ? '—' : nbr(x) + ' Hz';
const medF = (q, l, id) => (((MED[q] || {}).falas || {})[l] || {})[id] || {};
const antesDepois = ANTES_DEPOIS.map(([rot, id]) => { const f = fala(id); if (!f) return ''; const a = `vozes-antes/pt-BR/${f.pacote}/${id}.ogg`, la = `work/vozes-jogo/antes/pt-BR/${f.pacote}/${id}.ogg`; const d = audio('pt-BR', id);
  if (!existsSync(root + la) || !d) return ''; arquivos[a] = la; const ma = medF('antes', 'pt-BR', id), md = medF('depois', 'pt-BR', id);
  return `<div class="row" data-tipo="${rot === 'Locutor' ? 'aviso' : 'unidade'}"><div class="tx"><small>${esc(rot)} · antes f0 ${hz(ma.f0)}, centroide ${hz(ma.centroide)} → depois f0 ${hz(md.f0)}, centroide ${hz(md.centroide)}</small><span>${esc(f.texto['pt-BR'])}</span></div><div class="vbtns"><button type="button" class="vb" data-ogg="${a}" aria-label="Ouvir antes">Antes</button><button type="button" class="vb" data-ogg="${d.ogg}" aria-label="Ouvir depois">Depois</button></div></div>`; }).join('');
const resumoMed = (q, l, r, t) => ((((MED[q] || {}).resumo || {})[l] || {})[r] || {})[t] || {};
const tabMed = MED.antes && MED.depois ? IDI.map(l => { const ref = ['vehnar', 'quorith', 'vorag'].map(r => resumoMed('depois', l, r, 'locutor')); const refU = ['vehnar', 'quorith', 'vorag', 'tessara'].map(r => resumoMed('depois', l, r, 'unidade'));
  const m = (xs, k) => { const v = xs.map(x => x[k]).filter(x => x != null); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; };
  const la = resumoMed('antes', l, 'erevane', 'locutor'), ld = resumoMed('depois', l, 'erevane', 'locutor'), ua = resumoMed('antes', l, 'erevane', 'unidade'), ud = resumoMed('depois', l, 'erevane', 'unidade');
  return `<tr><th scope="row">${NOME_IDI[l]}</th><td>${hz(la.f0)} → <b>${hz(ld.f0)}</b></td><td>${hz(la.centroide)} → <b>${hz(ld.centroide)}</b></td><td>${hz(m(ref, 'f0'))} · ${hz(m(ref, 'centroide'))}</td><td>${hz(ua.centroide)} → <b>${hz(ud.centroide)}</b></td><td>${hz(m(refU, 'centroide'))}</td></tr>`; }).join('') : '';
const html = `<title>Vozes do Aether Rift</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@600;700;800&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
/* 5.0c.1: escuta das vozes gravadas — uma coluna (máx. 1100 px): resumo, as cinco Raças (locutor, unidade e líder nos três idiomas), campanha,
   números, conferência e o que precisa de ouvido. Identidade escura do jogo; claro para quem pede claro. */
:root{--bg:#F3F0EA;--ink1:#FFFFFF;--ink2:#F7F4EE;--ink3:#E9E4DA;--line:#D6CFC2;--line2:#BDB4A4;--fg:#1B1A17;--fg2:#5B574E;--rift:#D9441F;--warn:#9A6B00;--tocar-fg:#fff;
  --vehnar:#B54A12;--erevane:#0B7F69;--tessara:#2C7A45;--quorith:#6B47C2;--vorag:#B02236;
  --fd:"Big Shoulders Display","Arial Narrow",Impact,sans-serif;--fb:"IBM Plex Sans",system-ui,-apple-system,"Segoe UI",sans-serif;--fm:"IBM Plex Mono",ui-monospace,Menlo,Consolas,monospace;color-scheme:light}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--bg:#05070B;--ink1:#10151D;--ink2:#151B25;--ink3:#1C2330;--line:#2A3241;--line2:#3C4759;--fg:#ECE6DA;--fg2:#A9A598;--rift:#FF5E3A;--warn:#F2C230;--tocar-fg:#1a0b06;
  --vehnar:#FF7733;--erevane:#33FFD0;--tessara:#55E68A;--quorith:#B388FF;--vorag:#E6455A;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#05070B;--ink1:#10151D;--ink2:#151B25;--ink3:#1C2330;--line:#2A3241;--line2:#3C4759;--fg:#ECE6DA;--fg2:#A9A598;--rift:#FF5E3A;--warn:#F2C230;--tocar-fg:#1a0b06;
  --vehnar:#FF7733;--erevane:#33FFD0;--tessara:#55E68A;--quorith:#B388FF;--vorag:#E6455A;color-scheme:dark}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--fg);font:400 15px/1.55 var(--fb)}
.wrap{max-width:1100px;margin:0 auto;padding:28px max(16px,env(safe-area-inset-right,0px)) 56px max(16px,env(safe-area-inset-left,0px));display:grid;gap:34px}
h1,h2{font-family:var(--fd);font-weight:800;text-transform:uppercase;letter-spacing:.02em;line-height:.95;margin:0;text-wrap:balance}
h1{font-size:clamp(2.4rem,7vw,4.2rem)}h2{font-size:clamp(1.5rem,4vw,2.1rem)}
p{margin:0;max-width:70ch}.eyebrow{font:500 .72rem/1.3 var(--fm);letter-spacing:.16em;text-transform:uppercase;color:var(--fg2)}
small{display:block;font-size:.76rem;color:var(--fg2);line-height:1.35}
.wrap>header{display:grid;gap:12px;padding-bottom:8px;border-bottom:1px solid var(--line)}
.sec{display:grid;gap:14px;min-width:0}.sec>header{display:grid;gap:6px}
.plate{--c:12px;clip-path:polygon(var(--c) 0,100% 0,100% calc(100% - var(--c)),calc(100% - var(--c)) 100%,0 100%,0 var(--c));background:linear-gradient(180deg,var(--ink2),var(--ink1))}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px}
.kpi{padding:12px 14px;background:var(--ink1);box-shadow:inset 0 0 0 1px var(--line);display:grid;gap:2px}.kpi b{font:800 1.8rem/1 var(--fd);letter-spacing:.02em}
.cards{display:grid;gap:12px}.card{padding:14px;display:grid;gap:8px;border-left:3px solid var(--cor,var(--line2))}.card>header{display:flex;flex-wrap:wrap;gap:4px 12px;align-items:baseline}
.rn{font:800 1.3rem/1 var(--fd);letter-spacing:.04em;text-transform:uppercase;color:var(--cor,var(--fg))}
[data-r=vehnar]{--cor:var(--vehnar)}[data-r=erevane]{--cor:var(--erevane)}[data-r=tessara]{--cor:var(--tessara)}[data-r=quorith]{--cor:var(--quorith)}[data-r=vorag]{--cor:var(--vorag)}
.row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px 14px;align-items:center;padding:10px 12px;background:var(--ink1);border-left:2px solid var(--line2)}
.row[data-tipo=aviso]{border-left-color:var(--warn)}.row[data-tipo=lider]{border-left-color:var(--rift)}.row[data-tipo=ouvir]{border-left-color:var(--warn)}
.tx{min-width:0;display:grid;gap:2px}.tx span{overflow-wrap:anywhere}.tx b{font:500 .66rem/1 var(--fm);letter-spacing:.08em;color:var(--fg2);margin-right:4px}
.tx small{font-family:var(--fm);letter-spacing:.06em;text-transform:uppercase;font-size:.66rem;margin-bottom:2px}
.vbtns{display:flex;gap:6px}
.vb{min-width:48px;min-height:44px;border:0;padding:0 8px;font:600 .82rem/1 var(--fb);color:var(--fg);background:var(--ink3);box-shadow:inset 0 0 0 1px var(--line2);cursor:pointer;display:grid;place-items:center}
.vb:hover{filter:brightness(1.08)}.vb.tocando{background:var(--rift);color:var(--tocar-fg);box-shadow:none}.vb.off{opacity:.4;cursor:default}
button:focus-visible{outline:2px solid var(--fg);outline-offset:2px}
.tab{width:100%;border-collapse:collapse;font-size:.88rem;font-variant-numeric:tabular-nums}.tab th,.tab td{padding:7px 8px;border-bottom:1px solid var(--line);text-align:right;white-space:nowrap}
.tab th:first-child,.tab td:first-child{text-align:left}.tab thead th{font:500 .68rem/1.2 var(--fm);letter-spacing:.08em;text-transform:uppercase;color:var(--fg2)}
.rolar{overflow-x:auto;-webkit-overflow-scrolling:touch}
ul{margin:0;padding-left:1.2em;max-width:70ch}li{margin:.2em 0}
@media (max-width:620px){.row{grid-template-columns:1fr}.vbtns{justify-content:flex-start}}
</style>
<div class="wrap">
<header>
  <span class="eyebrow">Aether Rift: Dominion · 5.0c.1 · vozes gravadas</span>
  <h1>Vozes do Aether Rift</h1>
  <p>As ${nbr(R.falas.length)} falas do jogo em cada idioma, gravadas com o Kokoro no elenco aprovado e com o caráter de cada Raça assado no arquivo: o que o jogo toca é exatamente o que está aqui. Cada fala foi conferida pelo Whisper no arquivo final.</p>
</header>
<section class="sec"><div class="kpis">
  <div class="kpi"><small>falas por idioma</small><b>${nbr(R.falas.length)}</b><small>${nbr(cont.locutor)} locutor · ${nbr(cont.elim)} eliminações · ${nbr(cont.unidade)} unidades · ${nbr(cont.lider)} líder · ${nbr(cont.campanha)} campanha</small></div>
  ${IDI.map(l => { const t = (NUM[l] || {}).total || {}; return `<div class="kpi"><small>${NOME_IDI[l]}</small><b>${t.ogg_b ? mb(t.ogg_b) : '—'}</b><small>${t.dur ? min(t.dur) : '—'} de fala · erro ${pct(conf[l].soma, conf[l].n)}</small></div>`; }).join('')}
</div></section>
<section class="sec"><header><span class="eyebrow">Amostras</span><h2>As cinco Raças</h2><p>Locutor, unidade e líder de cada Raça. PT, EN e ES tocam a mesma fala nos três idiomas.</p></header>
<div class="cards">${cartoes}</div></section>
${antesDepois ? `<section class="sec"><header><span class="eyebrow">5.0c.2 · Erevane</span><h2>Antes e depois</h2><p>A voz feminina fica só na Tessara. O locutor da Erevane passou a ser masculino (pt-BR Santa 70% + Alex 30%; espanhol as mesmas vozes; inglês bm_daniel, britânico), e o caráter da Erevane fora do líder parou de afinar a voz: graves sem corte, agudos +3 dB e ar +2 dB (antes −4, +6 e +4 dB), com o mesmo eco leve. Medido no Opus do jogo.</p></header>
<div class="cards"><div class="plate card" data-r="erevane">${antesDepois}</div></div>
${tabMed ? `<div class="rolar"><table class="tab"><thead><tr><th>Idioma</th><th>Locutor f0</th><th>Locutor centroide</th><th>Outros locutores (f0 · centroide)</th><th>Unidades centroide</th><th>Unidades das outras Raças</th></tr></thead><tbody>${tabMed}</tbody></table></div>` : ''}</section>` : ''}
<section class="sec"><header><span class="eyebrow">Amostras</span><h2>Campanha</h2></header><div class="cards"><div class="plate card">${camp}</div></div></section>
<section class="sec"><header><span class="eyebrow">Números</span><h2>Tamanho e conferência</h2><p>Opus 24 kbps em Ogg, mono; o Quorith em estéreo a 32 kbps (em 24 kbps o Opus junta o estéreo e o coro fica quase mono). O erro é por caractere, no texto falado contra o que o Whisper ouviu, sem acento nem pontuação. Limite: 15% do texto ou 2 caracteres, o que for maior.</p></header>
<div class="rolar"><table class="tab"><thead><tr><th>Idioma</th><th>Falas</th><th>Duração</th><th>Opus</th><th>Erro médio</th><th>Exatas</th><th>Acima do limite</th><th>Tempo para gerar</th></tr></thead><tbody>${tabIdi}</tbody></table></div>
<div class="rolar"><table class="tab"><thead><tr><th>Tipo</th>${IDI.map(l => `<th>${NOME_IDI[l]}</th>`).join('')}</tr></thead><tbody>${tabTipo}</tbody></table></div>
<div class="rolar"><table class="tab"><thead><tr><th>Pacote</th>${IDI.map(l => `<th>${NOME_IDI[l]}</th>`).join('')}</tr></thead><tbody>${tabPac}</tbody></table></div></section>
<section class="sec"><header><span class="eyebrow">Para ouvir</span><h2>Acima do limite</h2><p>${ouvir.length ? `${nbr(ouvir.length)} falas ficaram acima do limite mesmo depois de duas regravações. Quase sempre é o Whisper escrevendo outro nome; vale ouvir.` : 'Nenhuma fala ficou acima do limite.'}</p></header>
<div class="cards">${listaOuvir}</div></section>
</div>
<script>
/* um áudio de cada vez (Opus em Ogg, o mesmo arquivo do jogo) */
let el = null, bt = null;
document.addEventListener('click', ev => { const b = ev.target.closest('.vb[data-ogg]'); if (!b) return;
  if (bt === b && el && !el.paused) { el.pause(); b.classList.remove('tocando'); bt = null; return; }
  if (el) { el.pause(); if (bt) bt.classList.remove('tocando'); }
  el = new Audio(b.dataset.ogg); bt = b; b.classList.add('tocando');
  el.addEventListener('ended', () => b.classList.remove('tocando')); el.addEventListener('error', () => b.classList.remove('tocando')); el.play().catch(() => b.classList.remove('tocando')); });
</script>
`;
writeFileSync(root + 'work/vozes-jogo.html', html);
const tam = Object.values(arquivos).reduce((s, p) => s + (existsSync(root + p) ? statSync(root + p).size : 0), 0);
writeFileSync(root + 'work/vozes-jogo-publicar.json', JSON.stringify({ pagina: root + 'work/vozes-jogo.html', titulo: 'Vozes do Aether Rift', icone: 'audio',
  descricao: 'As vozes gravadas da 5.0c.1: amostras por Raça e idioma, campanha, números e o que precisa de ouvido.', root,
  files: Object.fromEntries(Object.entries(arquivos).sort()) }, null, 1));
console.log(`work/vozes-jogo.html · ${Object.keys(arquivos).length} áudios citados (${nbr(tam / 1024)} KB) · ${ouvir.length} falas para ouvir`);
