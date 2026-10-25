/* 5.0a.2: monta work/vozes-escolha.html (página de escuta das vozes neurais) a partir de work/vozes/manifesto.json (tools/vozes/gerar.py)
   e calcula o plano da implantação: falas por tipo e por Raça, tamanho em Opus (ajuste bytes = cabeçalho + taxa × duração medido nos
   próprios arquivos) e as falas da campanha contadas em src/campaign.js. Os áudios ficam ao lado, em work/vozes/<voz>/<fala>.ogg|.mp3.
   Uso: node tools/vozes/pagina.mjs */
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const root = new URL('../..', import.meta.url).pathname;
const man = JSON.parse(readFileSync(root + 'work/vozes/manifesto.json', 'utf8'));
{ const F = JSON.parse(readFileSync(root + 'tools/vozes/falas.json', 'utf8')).falas; for (const f of man.falas) { const g = F.find(x => x.id === f.id); if (g) f.quem = g.quem; } } /* rótulos atuais de falas.json */
const RACAS = ['vehnar', 'erevane', 'tessara', 'quorith', 'vorag'];
const NOME_RACA = { vehnar: 'Vehnar', erevane: 'Erevane', tessara: 'Tessara', quorith: 'Quorith', vorag: 'Vorag' };
const LIDER = { vehnar: 'Barão-Forja', erevane: 'Vesper Ísk', tessara: 'Sylva Oriel', quorith: 'Zayin Coral', vorag: 'Oru Voraz' };

/* ---------- campanha e nomes das IAs, lidos do próprio jogo ---------- */
globalThis.ARD = {}; require(root + 'src/sim.js'); require(root + 'src/ai.js'); require(root + 'src/campaign.js');
const camp = { self: [0, 0], enemy: [0, 0], raca: [0, 0], fn: 0 };
for (const m of ARD.campaign.MISSIONS) for (const s of [...(m.brief || []), ...(m.events || []).map(e => e.say), ...(m.script || []).map(e => e.say)]) {
  if (!s) continue; if (typeof s === 'function') { camp.fn++; continue; } const k = s[0] === 'self' ? 'self' : s[0] === 'enemy' || s[0] === 'ally' ? 'enemy' : 'raca'; camp[k][0]++; camp[k][1] += s[2].length; }
const mainSrc = readFileSync(root + 'src/main.js', 'utf8'); const aiNames = (mainSrc.match(/const aiNames = (\{[^;]*\});/) || [])[1];
const NOMES_IA = aiNames ? Object.values(Function('return ' + aiNames)()).flat() : [];

/* ---------- inventário das falas por Raça (o que seria gravado) ---------- */
const LOCUTOR = ['Construção concluída.', 'Unidade pronta.', 'Pesquisa concluída.', 'Unidade promovida.', 'Módulo instalado.', 'Era dois alcançada.', 'Era três alcançada.', 'Ascensão alcançada.',
  'Superarma pronta.', 'Sobrecarga ativada.', 'Base sob ataque!', 'Núcleo sob ataque!', 'Alerta de sifão!', 'Nódulo sob ataque!', 'Recursos roubados!', 'Fundição Orbital!', 'Salto de Núcleo!',
  'Uníssono!', 'Eclosão!', 'Blecaute!', 'Pacto assinado.', 'Pacto quebrado!', 'Pacto recusado.', 'Pacto cumprido.', 'Tempestade de Éter se aproximando.', 'Tempestade de Éter ativa.',
  'Veio de Minério exposto.', 'Caixa recolhida.', 'Vitória.', 'Derrota.', 'Voz ativada.', 'Um inimigo restante.', 'Dois inimigos restantes.', 'Três inimigos restantes.'];
const ELIM = NOMES_IA.map(n => { const w = n.split(' ')[0]; return n + ' eliminad' + (/^(Fundição|Linhagem|Ordem|Prole|Ninhada|Fome|Colmeia|Estirpe)$/.test(w) ? 'a' : 'o') + (/s$/.test(w) ? 's' : '') + '.'; }); /* hoje o jogo diz sempre "eliminado" */
const UNID = ['Às ordens, comandante.', 'Na escuta.', 'Pronto para agir.', 'Entendido. A caminho!', 'Movendo.', 'Posição confirmada.', 'Alvo marcado. Atacando!', 'Fogo à vontade!'];
const CLASSES = ['civil (coletores)', 'infantaria', 'veículos', 'drones', 'suporte'];
const SALA = ['Barão-Forja na linha. As fornalhas de Kessari estão acesas, comandante.', 'Vesper Ísk. Ninguém nos vê chegar. Ninguém nos vê partir.', 'Oru Voraz. A fome de Velk não tem fim.']; /* 3 saudações por líder (tamanho das de hoje) */
const REACAO = ['Era nova. O Núcleo responde ao meu comando.', 'A superarma está pronta. Diga o alvo.', 'Eles estão na nossa base. Reajam!', 'Um a menos. Continuem.', 'A Fenda é nossa.', 'Recuem. Vamos voltar mais fortes.', 'Pacto selado. Por enquanto.', 'Traição! Ninguém esquece isso.', 'O Éter ferve. Cuidado com a tempestade.', 'Ascensão. Agora eles vão entender.'];

/* ---------- medidas dos arquivos gerados: velocidade da fala e bytes por segundo ---------- */
const cands = man.candidatas; const media = a => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length);
function ajuste(campo) { const xs = [], ys = []; for (const c of cands) for (const f of c.falas) { xs.push(f.dur_s); ys.push(f[campo]); } const mx = media(xs), my = media(ys); let num = 0, den = 0; for (let i = 0; i < xs.length; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2; } const b = num / den; return { a: my - b * mx, b }; }
const A24 = ajuste('opus24_b'), A32 = ajuste('opus32_b');
const ok = cands.filter(c => c.licenca.uso_comercial === 'sim'); const comCer = ok.filter(c => c.cer != null);
const melhor = (comCer.length ? comCer.slice().sort((a, b) => a.cer - b.cer || b.falas_exatas - a.falas_exatas)[0] : ok[0]) || cands[0];
const cps = (() => { const tx = man.falas.map(f => f.texto.length); return media(melhor.falas.map((f, i) => tx[i] / Math.max(0.3, f.dur_s - 0.17))); })();
const dur = t => 0.17 + t.length / cps; const somaDur = arr => arr.reduce((s, t) => s + dur(t), 0);
const kb = (n, s, A) => (n * A.a + s * A.b) / 1024;
const linhas = [
  { tipo: 'Locutor: avisos', por: LOCUTOR.length, x: 5, dur: somaDur(LOCUTOR), nota: LOCUTOR.length + ' avisos fixos (os 13 de hoje e ' + (LOCUTOR.length - 13) + ' novos, como Superarma pronta, Eras, Vitória e as contagens de 1 a 3 inimigos)' },
  { tipo: 'Locutor: eliminações', por: ELIM.length, x: 5, dur: somaDur(ELIM), nota: ELIM.length + ' nomes das IAs (src/main.js), com o gênero certo ("Fundição Kessari eliminada")' },
  { tipo: 'Unidades', por: CLASSES.length * UNID.length, x: 5, dur: somaDur(UNID) * CLASSES.length, nota: CLASSES.length + ' classes × ' + UNID.length + ' falas (3 ao selecionar, 3 ao receber ordem, 2 ao atacar)' },
  { tipo: 'Líder', por: 3 + REACAO.length, x: 5, dur: somaDur(SALA) + somaDur(REACAO), nota: '3 saudações da Sala e ' + REACAO.length + ' reações na partida' },
];
const campDur = (camp.self[0] * 0.17 * 5 + camp.self[1] / cps * 5) + (camp.enemy[0] * 0.17 * 5 + camp.enemy[1] / cps * 5) + (camp.raca[0] * 0.17 + camp.raca[1] / cps);
const campN = camp.self[0] * 5 + camp.enemy[0] * 5 + camp.raca[0];
const porRaca = { n: linhas.reduce((s, l) => s + l.por, 0), dur: linhas.reduce((s, l) => s + l.dur, 0) }; porRaca.kb24 = kb(porRaca.n, porRaca.dur, A24); porRaca.kb32 = kb(porRaca.n, porRaca.dur, A32);
const plano = { cps: +cps.toFixed(1), A24, A32, linhas: linhas.map(l => Object.assign(l, { total: l.por * l.x, kb24: kb(l.por * l.x, l.dur * l.x, A24), kb32: kb(l.por * l.x, l.dur * l.x, A32) })), porRaca,
  campanha: { n: campN, dur: campDur, kb24: kb(campN, campDur, A24), kb32: kb(campN, campDur, A32), fixas: camp.self[0] + camp.enemy[0] + camp.raca[0], self: camp.self[0], enemy: camp.enemy[0], raca: camp.raca[0], fn: camp.fn, missoes: ARD.campaign.MISSIONS.length } };
plano.total = { n: plano.linhas.reduce((s, l) => s + l.total, 0) + campN, kb24: plano.linhas.reduce((s, l) => s + l.kb24, 0) + plano.campanha.kb24, kb32: plano.linhas.reduce((s, l) => s + l.kb32, 0) + plano.campanha.kb32, dur: porRaca.dur * 5 + campDur };
writeFileSync(root + 'work/vozes/plano.json', JSON.stringify({ melhor: melhor.id, plano, LOCUTOR, ELIM, UNID, CLASSES, REACAO }, null, 1));

/* ---------- página ---------- */
const n1 = (v, d = 1) => Number(v).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
const n0 = v => Math.round(v).toLocaleString('pt-BR');
const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
const CURTO = { 'kokoro-pf_dora': 'Dora', 'kokoro-pm_alex': 'Alex', 'kokoro-pm_santa': 'Santa', 'piper-faber': 'Faber', 'piper-cadu': 'Cadu', 'piper-jeff': 'Jeff' };
const genero = c => c.f0_hz == null ? '' : c.f0_hz >= 165 ? 'feminina' : 'masculina';
const TIPO = { aviso: 'Aviso', unidade: 'Unidade', lider: 'Líder' };
const dados = { vozes: cands.map(c => ({ id: c.id, curto: CURTO[c.id] || c.voz, modelo: c.modelo, motor: c.motor, falas: Object.fromEntries(c.falas.map(f => [f.id, { d: f.dur_s, asr: f.asr || '', cer: f.cer }])) })), falas: man.falas, melhor: melhor.id };
const linhaVoz = c => `<tr${c.id === melhor.id ? ' class="rec"' : ''}><th scope="row"><span class="vn">${esc(CURTO[c.id] || c.voz)}</span><small>${esc(c.voz)}</small></th><td>${esc(c.modelo)}</td>
  <td><span class="pill ${c.licenca.uso_comercial === 'sim' ? 'ok' : 'risco'}">${c.licenca.uso_comercial === 'sim' ? 'livre para uso comercial' : 'risco para uso comercial'}</span><small>${esc(c.licenca.resumo)}</small></td>
  <td class="num">${c.f0_hz != null ? n0(c.f0_hz) + ' Hz' : '—'}<small>${genero(c)}</small></td><td class="num">${n0(c.modelo_mb)} MB</td>
  <td class="num">${n1(c.opus32_kb)} KB<small>MP3: ${n1(c.mp3_kb)} KB</small></td>
  <td class="num">${n1(c.carga_s)} s + ${n1(c.sintese_s)} s<small>CPU ${n1(c.cpu_s)} s para ${n1(c.audio_s)} s de fala</small></td>
  <td class="num">${c.falas_exatas != null ? c.falas_exatas + ' de 12' : '—'}<small>${c.cer != null ? 'erro por letra ' + n1(c.cer * 100) + '%' : ''}</small></td></tr>`;
const RACA_INFO = [
  ['seco', 'Sem filtro', 'A gravação como saiu do modelo, só nivelada.'],
  ['vehnar', 'Vehnar', 'Rádio de campanha: banda de 300 a 3.400 Hz, saturação de válvula, chiado e estalos, com o clique do rádio no começo e no fim.'],
  ['erevane', 'Erevane', 'Eco leve e ar: agudos abertos, eco de 165 ms que some em poucas repetições e uma sala longa e fria.'],
  ['tessara', 'Tessara', 'Quente e orgânico: graves encorpados, agudos macios, saturação suave e uma ondulação lenta, como respiração.'],
  ['quorith', 'Quorith', 'Coro em uníssono: quatro cópias da voz com atrasos que flutuam, abertas no estéreo, e uma ressonância de cristal.'],
  ['vorag', 'Vorag', 'Grave com aspereza: a voz desce quatro semitons sem mudar a velocidade, com saturação, um rosnado de 38 Hz e graves reforçados.'],
];
const linhaPlano = l => `<tr><th scope="row">${esc(l.tipo)}<small>${esc(l.nota)}</small></th><td class="num">${l.por}</td><td class="num">${l.total}</td><td class="num">${n1(l.dur * l.x / 60)} min</td><td class="num">${n0(l.kb24)} KB</td><td class="num">${n0(l.kb32)} KB</td></tr>`;
const assetsRows = `| Vozes gravadas (assets/vozes/&lt;raça&gt;/*.opus e assets/vozes/campanha/*.opus, 5.0x) | geradas na máquina de build com o Kokoro-82M v1.0 (hexgrad/Kokoro-82M) e as vozes ${esc(melhor.voz)} e afins; filtro de Raça em Web Audio no jogo (\`bash tools/vozes/preparar.sh\` e \`.tools/vozes/venv/bin/python tools/vozes/gerar.py\`) | equipe (texto e direção); modelo de hexgrad | pesos Apache-2.0; áudio gerado pela equipe | locutor, unidades e líderes |
| Dados CC BY usados no treino do Kokoro-82M (atribuição pedida no model card) | Koniwa (github.com/koniwa/koniwa), SIWIS (datashare.ed.ac.uk/handle/10283/2353) | Koniwa; University of Edinburgh / SIWIS | CC BY 3.0; CC BY 4.0 | crédito do modelo de voz |
| Ferramentas de geração das vozes (tools/vozes/, só na máquina de build) | kokoro e misaki (pip), espeak-ng embutido no espeakng-loader | hexgrad; eSpeak NG | Apache-2.0; GPL-3.0 (não vai no jogo) | geração das falas |`;

const html = `<title>Vozes do Aether Rift</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@600;700;800&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
/* Layout: mesa de escuta da Sala de Comando — uma coluna de leitura (máx. 1100 px): recomendação, mesa com as 12 falas × 6 vozes,
   faixa das cinco Raças com o filtro ao vivo, números e o plano. Mesma identidade escura do jogo (placas chanfradas, Big Shoulders e Plex). */
:root{
  --void:#05070B;--bg:#0A0D12;--ink1:#10151D;--ink2:#151B25;--ink3:#1C2330;--line:#2A3241;--line2:#3C4759;
  --fg:#ECE6DA;--fg2:#A9A598;--fg3:#75736B;--rift:#FF5E3A;--rift2:#B23CFF;--good:#7FE3A1;--warn:#F2C230;
  --vehnar:#FF7733;--erevane:#33FFD0;--tessara:#55E68A;--quorith:#B388FF;--vorag:#E6455A;
  --fd:"Big Shoulders Display","Arial Narrow",Impact,sans-serif;--fb:"IBM Plex Sans",system-ui,-apple-system,"Segoe UI",sans-serif;--fm:"IBM Plex Mono",ui-monospace,Menlo,Consolas,monospace;
  color-scheme:dark}
body{background:var(--void);color:var(--fg);font:400 15px/1.55 var(--fb)}
.wrap{max-width:1100px;margin:0 auto;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));padding-block:28px 56px;display:grid;gap:34px}
h1,h2{font-family:var(--fd);font-weight:800;text-transform:uppercase;letter-spacing:.02em;line-height:.95;margin:0;text-wrap:balance}
h1{font-size:clamp(2.6rem,7vw,4.4rem)}h2{font-size:clamp(1.6rem,4vw,2.2rem)}
p{margin:0;max-width:68ch}.eyebrow{font:500 .72rem/1.3 var(--fm);letter-spacing:.16em;text-transform:uppercase;color:var(--fg2)}
.lead{font-size:1.05rem;color:var(--fg)}.muted{color:var(--fg2)}small{display:block;font-size:.76rem;color:var(--fg2);line-height:1.35}
header{display:grid;gap:12px;padding-bottom:6px;border-bottom:1px solid var(--line)}
.sec{display:grid;gap:14px;min-width:0}.sec>header{border:0;padding:0;gap:6px}
.plate{--c:12px;clip-path:polygon(var(--c) 0,100% 0,100% calc(100% - var(--c)),calc(100% - var(--c)) 100%,0 100%,0 var(--c));background:linear-gradient(180deg,var(--ink2),var(--ink1))}
.rec-box{padding:18px 20px;display:grid;gap:10px;border-left:3px solid var(--rift)}
.rec-box b{color:#fff}.rec-box .acts{display:flex;flex-wrap:wrap;gap:8px;margin-top:4px}
button{font:inherit;color:inherit;cursor:pointer}
.btn{--c:7px;clip-path:polygon(var(--c) 0,100% 0,100% calc(100% - var(--c)),calc(100% - var(--c)) 100%,0 100%,0 var(--c));border:0;min-height:40px;padding:8px 14px;font:600 .86rem/1.1 var(--fb);background:linear-gradient(180deg,var(--ink3),var(--ink2));box-shadow:inset 0 0 0 1px var(--line2)}
.btn:hover{background:linear-gradient(180deg,#252e3d,var(--ink3))}.btn.prim{background:linear-gradient(180deg,#ff7a5a,var(--rift));color:#1a0b06}
button:focus-visible{outline:2px solid #fff;outline-offset:2px}
.legend{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:8px}
.vchip{display:grid;gap:2px;padding:10px 12px;background:var(--ink1);box-shadow:inset 0 0 0 1px var(--line);min-width:0}
.vchip b{font:700 1.15rem/1 var(--fd);letter-spacing:.03em;text-transform:uppercase}.vchip.rec{box-shadow:inset 0 0 0 1px var(--rift)}
.vchip .btn{margin-top:6px;min-height:34px;padding:6px 10px;font-size:.78rem}
.grid{display:grid;gap:6px}
.row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px 16px;align-items:center;padding:10px 12px;background:var(--ink1);border-left:2px solid var(--line2)}
.row[data-tipo=aviso]{border-left-color:var(--warn)}.row[data-tipo=unidade]{border-left-color:var(--erevane)}.row[data-tipo=lider]{border-left-color:var(--rift)}
.row .tx{min-width:0}.row .tx q{quotes:none;font-weight:500;color:#fff}.row .tx small{font-family:var(--fm);letter-spacing:.06em;text-transform:uppercase;font-size:.66rem;margin-bottom:2px}
.vbtns{display:grid;grid-template-columns:repeat(3,64px) 10px repeat(3,64px);gap:5px}.vbtns i{display:block}
.vb{position:relative;min-height:40px;border:0;padding:0 4px;font:600 .8rem/1 var(--fb);background:var(--ink3);box-shadow:inset 0 0 0 1px var(--line2)}
.vb:hover{background:#232b39}.vb.tocando{background:var(--rift);color:#1a0b06;box-shadow:none}.vb.rec{box-shadow:inset 0 0 0 1px var(--rift)}
.vb .dif{position:absolute;top:3px;right:4px;width:6px;height:6px;border-radius:50%;background:var(--warn)}
.racas{display:grid;gap:14px;padding:18px 20px}
.ctrl{display:flex;flex-wrap:wrap;gap:10px 14px;align-items:end}
.ctrl label{display:grid;gap:4px;font:500 .7rem/1.2 var(--fm);letter-spacing:.12em;text-transform:uppercase;color:var(--fg2);min-width:0;flex:1 1 220px}
select{font:500 .92rem/1.2 var(--fb);color:var(--fg);background:var(--ink1);border:1px solid var(--line2);min-height:40px;padding:6px 10px;width:100%;min-width:0}
.rbtns{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}
.rb{--cor:var(--fg2);--c:9px;clip-path:polygon(var(--c) 0,100% 0,100% calc(100% - var(--c)),calc(100% - var(--c)) 100%,0 100%,0 var(--c));border:0;text-align:left;padding:10px 12px;min-height:84px;display:grid;align-content:start;gap:4px;background:linear-gradient(180deg,color-mix(in srgb,var(--cor) 14%,var(--ink2)),var(--ink1));box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--cor) 45%,transparent)}
.rb b{font:800 1.2rem/1 var(--fd);text-transform:uppercase;letter-spacing:.03em;color:var(--cor)}.rb small{color:var(--fg2)}
.rb.tocando{background:var(--cor)}.rb.tocando b,.rb.tocando small{color:#0b0d10}
.rb[data-r=vehnar]{--cor:var(--vehnar)}.rb[data-r=erevane]{--cor:var(--erevane)}.rb[data-r=tessara]{--cor:var(--tessara)}.rb[data-r=quorith]{--cor:var(--quorith)}.rb[data-r=vorag]{--cor:var(--vorag)}
canvas{width:100%;height:64px;display:block;background:var(--void);box-shadow:inset 0 0 0 1px var(--line)}
.aviso{font-size:.84rem;color:var(--warn)}
.tbl{overflow-x:auto;min-width:0}
table{border-collapse:collapse;width:100%;font-variant-numeric:tabular-nums}
th,td{padding:9px 10px;text-align:left;vertical-align:top;border-bottom:1px solid var(--line)}
thead th{font:500 .66rem/1.2 var(--fm);letter-spacing:.12em;text-transform:uppercase;color:var(--fg2);border-bottom:1px solid var(--line2);white-space:nowrap}
tbody th{font-weight:600}.num{text-align:right;white-space:nowrap}.num small{text-align:right}
.vn{font:700 1.1rem/1 var(--fd);letter-spacing:.03em;text-transform:uppercase}
tr.rec th .vn{color:var(--rift)}
.pill{display:inline-block;font:600 .7rem/1 var(--fm);letter-spacing:.06em;text-transform:uppercase;padding:4px 6px;margin-bottom:3px;white-space:nowrap}
.pill.ok{color:#0b1a10;background:var(--good)}.pill.risco{color:#1f1600;background:var(--warn)}
tfoot td,tfoot th{font-weight:700;color:#fff;border-bottom:0}
ul{margin:0;padding-left:1.1rem;display:grid;gap:6px;max-width:72ch}
pre{margin:0;padding:12px 14px;background:var(--ink1);box-shadow:inset 0 0 0 1px var(--line);overflow-x:auto;font:400 .74rem/1.5 var(--fm);color:var(--fg2);white-space:pre}
footer{font:400 .76rem/1.5 var(--fm);color:var(--fg3);border-top:1px solid var(--line);padding-top:14px}
@media (max-width:760px){.row{grid-template-columns:minmax(0,1fr)}.vbtns{grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}.vbtns i{display:none}.vb{min-height:44px}}
@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
</style>
<div class="wrap">
<header>
  <div class="eyebrow">Aether Rift: Dominion · 5.0a.2 · avaliação das vozes neurais</div>
  <h1>Vozes do Aether Rift</h1>
  <p class="lead">As mesmas 12 falas do jogo em ${cands.length} vozes neurais abertas, gravadas na máquina de build. Ouça, compare e escolha quem fala pelo locutor, pelas unidades e pelos líderes. Na faixa das Raças, o filtro de cada uma é aplicado ao vivo, como seria no jogo.</p>
</header>

<section class="sec" aria-labelledby="t-rec">
  <div class="plate rec-box">
    <div class="eyebrow" id="t-rec">Recomendação</div>
    <p><b>${esc(CURTO[melhor.id])} (${esc(melhor.modelo)}, voz ${esc(melhor.voz)})</b> como voz-base, com Dora (feminina) e Santa (masculina, mais grave) e misturas entre as três para os outros líderes, e o filtro de cada Raça por cima. O Kokoro tem pesos Apache-2.0, livres para uso comercial, e as três vozes dele acertaram quase todas as palavras. As vozes pt_BR do Piper geram muito mais rápido, mas erraram mais palavras nas falas curtas e nasceram da voz inglesa lessac, cujos dados só podem ser usados em pesquisa.</p>
    <p class="muted">${melhor.falas_exatas != null ? `Na conferência por transcrição, ${esc(CURTO[melhor.id])} teve ${melhor.falas_exatas} de 12 falas transcritas sem erro. ` : ''}A escolha final é de ouvido: toque as falas abaixo. O ponto amarelo num botão marca onde a transcrição ouviu algo diferente do texto.</p>
    <div class="acts"><button class="btn prim" type="button" data-todas="${esc(melhor.id)}">Ouvir as 12 com ${esc(CURTO[melhor.id])}</button><button class="btn" type="button" data-parar>Parar</button></div>
  </div>
</section>

<section class="sec" aria-labelledby="t-mesa">
  <header><div class="eyebrow">Mesa de escuta</div><h2 id="t-mesa">12 falas, ${cands.length} vozes</h2>
  <p class="muted">Cada botão toca a fala naquela voz. Kokoro à esquerda, Piper à direita. As vozes foram niveladas no mesmo volume e aparadas nas pontas.</p></header>
  <div class="legend">${cands.map(c => `<div class="vchip${c.id === melhor.id ? ' rec' : ''}"><b>${esc(CURTO[c.id])}</b><small>${esc(c.modelo)} · ${genero(c)}</small><small>${c.licenca.uso_comercial === 'sim' ? 'livre para uso comercial' : 'risco para uso comercial'}</small><button class="btn" type="button" data-todas="${esc(c.id)}">Ouvir as 12</button></div>`).join('')}</div>
  <div class="grid" id="mesa"></div>
</section>

<section class="sec" aria-labelledby="t-racas">
  <header><div class="eyebrow">Caráter das Raças</div><h2 id="t-racas">O mesmo áudio, cinco Raças</h2>
  <p class="muted">Filtros montados ao vivo com Web Audio (filtros, saturação, eco, sala, coro e mudança de tom), sobre os arquivos da voz escolhida. No jogo, cada Raça teria a sua cadeia, sem arquivo a mais.</p></header>
  <div class="plate racas">
    <div class="ctrl"><label>Voz<select id="r-voz">${cands.map(c => `<option value="${esc(c.id)}"${c.id === melhor.id ? ' selected' : ''}>${esc(CURTO[c.id])} · ${esc(c.modelo)}</option>`).join('')}</select></label>
      <label>Fala<select id="r-fala">${man.falas.map(f => `<option value="${esc(f.id)}"${f.id === '09-barao-forja-1' ? ' selected' : ''}>${esc(f.texto)}</option>`).join('')}</select></label></div>
    <div class="rbtns">${RACA_INFO.map(([id, nome, desc]) => `<button class="rb" type="button" data-r="${id}"><b>${esc(nome)}</b><small>${esc(desc)}</small></button>`).join('')}</div>
    <canvas id="osc" width="1040" height="64" role="img" aria-label="Forma de onda do que está tocando"></canvas>
    <p class="aviso" id="r-aviso" hidden></p>
  </div>
</section>

<section class="sec" aria-labelledby="t-num">
  <header><div class="eyebrow">Números</div><h2 id="t-num">Modelo, licença, tamanho e tempo</h2>
  <p class="muted">Tamanho: as 12 falas juntas (${n1(Math.min(...cands.map(c => c.audio_s)), 1)} a ${n1(Math.max(...cands.map(c => c.audio_s)), 1)} s de fala) em OGG/Opus 32 kbps, mono. Tempo para gerar: carga do modelo + síntese das 12 falas, em ${esc(man.maquina)}, com a máquina dividida com outros agentes (carga média de ${n1(Math.min(...cands.map(c => c.carga_maquina[0])), 0)} a ${n1(Math.max(...cands.map(c => c.carga_maquina[1])), 0)}). Conferência: ${esc(man.conferencia || 'não feita')}.</p></header>
  <div class="tbl"><table><thead><tr><th>Voz</th><th>Modelo</th><th>Licença</th><th class="num">Tom médio</th><th class="num">Modelo</th><th class="num">12 falas (Opus)</th><th class="num">Tempo para gerar</th><th class="num">Transcrição</th></tr></thead>
  <tbody>${cands.map(linhaVoz).join('')}</tbody></table></div>
  <details><summary class="muted">Licenças em detalhe e modelos descartados</summary><ul style="margin-top:10px">${[...new Map(cands.map(c => [c.licenca.resumo, c])).values()].map(c => `<li><b>${esc(c.modelo)}</b>: ${esc(c.licenca.detalhe)}</li>`).join('')}${man.descartadas.map(d => `<li><b>${esc(d.modelo)}</b>, descartado: ${esc(d.motivo)}.</li>`).join('')}</ul></details>
</section>

<section class="sec" aria-labelledby="t-plano">
  <header><div class="eyebrow">Plano da implantação</div><h2 id="t-plano">${n0(plano.total.n)} falas, ${n1(plano.total.kb24 / 1024)} MB em Opus</h2>
  <p class="muted">Contas com a velocidade medida na voz ${esc(CURTO[melhor.id])} (${n1(cps)} caracteres por segundo) e o tamanho medido nos arquivos daqui (Opus 24 kbps: ${n0(A24.a)} bytes por arquivo + ${n0(A24.b)} bytes por segundo de fala).</p></header>
  <div class="tbl"><table><thead><tr><th>Tipo</th><th class="num">Por Raça</th><th class="num">Total</th><th class="num">Duração</th><th class="num">Opus 24 kbps</th><th class="num">Opus 32 kbps</th></tr></thead>
  <tbody>${plano.linhas.map(linhaPlano).join('')}<tr><th scope="row">Campanha (20 missões)<small>${plano.campanha.fixas} falas fixas: ${plano.campanha.self} do próprio líder (gravadas nas 5 vozes), ${plano.campanha.enemy} do inimigo (nas 5) e ${plano.campanha.raca} de Raça fixa; ${plano.campanha.fn} dinâmica fica na voz do sistema</small></th><td class="num">—</td><td class="num">${plano.campanha.n}</td><td class="num">${n1(plano.campanha.dur / 60)} min</td><td class="num">${n0(plano.campanha.kb24)} KB</td><td class="num">${n0(plano.campanha.kb32)} KB</td></tr></tbody>
  <tfoot><tr><th scope="row">Total</th><td class="num">${porRaca.n}</td><td class="num">${n0(plano.total.n)}</td><td class="num">${n1(plano.total.dur / 60)} min</td><td class="num">${n0(plano.total.kb24)} KB</td><td class="num">${n0(plano.total.kb32)} KB</td></tr></tfoot></table></div>
  <ul>
    <li><b>Carga preguiçosa por Raça:</b> a partida baixa só o pacote da Raça do jogador (cerca de ${n0(porRaca.kb24)} KB em Opus 24 kbps, ${porRaca.n} arquivos pequenos) depois que a tela de carregamento termina, em tempo ocioso; a Sala baixa só a saudação do líder em destaque; a campanha baixa as falas da missão ao abri-la. Os bytes comprimidos ficam na memória e cada fala vira AudioBuffer só ao tocar pela primeira vez (cache das mais usadas). O service worker guarda os arquivos para jogar sem internet.</li>
    <li><b>Falas com números e nomes dinâmicos</b> (nome de jogador no multiplayer, "Pesquisa concluída: …" com o nome da pesquisa, contagens acima de 3, a fala dinâmica da campanha) continuam na voz do sistema, com a escolha da 5.0a.2. Sem o arquivo carregado, sem rede na primeira vez ou com "Vozes gravadas" desligado em Ajustes, toda fala cai na voz do sistema, então nenhum arquivo é obrigatório.</li>
    <li><b>Legendas e boca do líder:</b> a fala gravada dispara o mesmo evento 'ard-voz' (início, palavra, fim), com o tempo de cada palavra medido na geração pela transcrição, e a mesma legenda de hoje.</li>
    <li><b>Registro no ASSETS.md</b> (linhas propostas):</li>
  </ul>
  <pre>${assetsRows}</pre>
</section>

<footer>Gerado por tools/vozes/gerar.py e tools/vozes/pagina.mjs em ${esc(man.gerado)} · ${esc(man.maquina)} · Python ${esc(man.python)}, kokoro ${esc(man.pacotes.kokoro)}, torch ${esc(man.pacotes.torch)}. Áudios em OGG/Opus 32 kbps (com MP3 48 kbps para navegadores sem Opus) na pasta vozes/, ao lado desta página.</footer>
</div>
<script type="application/json" id="dados">${JSON.stringify(dados).replace(/</g, '\\u003c')}</script>
<script>
(function () {
'use strict';
const D = JSON.parse(document.getElementById('dados').textContent);
const EXT = (function () { try { const a = document.createElement('audio'); if (a.canPlayType && a.canPlayType('audio/ogg; codecs=opus')) return 'ogg'; } catch (e) {} return 'mp3'; })();
const url = (v, f) => 'vozes/' + v + '/' + f + '.' + EXT;
const voz = id => D.vozes.find(v => v.id === id);
/* mesa: uma linha por fala, um botão por voz */
const mesa = document.getElementById('mesa'); const TIPO = { aviso: 'Aviso', unidade: 'Unidade', lider: 'Líder' };
mesa.innerHTML = D.falas.map(f => '<div class="row" data-tipo="' + f.tipo + '"><div class="tx"><small>' + TIPO[f.tipo] + ' · ' + f.quem + '</small><q>' + f.texto + '</q></div><div class="vbtns">' +
  D.vozes.map((v, i) => { const x = v.falas[f.id] || {}; const dif = x.cer != null && x.cer > 0.12; return (i === 3 ? '<i></i>' : '') + '<button class="vb' + (v.id === D.melhor ? ' rec' : '') + '" type="button" data-v="' + v.id + '" data-f="' + f.id + '" title="' + v.curto + ' · ' + (x.d ? x.d.toFixed(1).replace('.', ',') + ' s' : '') + (x.asr ? ' · a transcrição ouviu: ' + x.asr.replace(/"/g, '') : '') + '" aria-label="Ouvir ' + v.curto + ': ' + f.texto.replace(/"/g, '') + '">' + v.curto + (dif ? '<span class="dif" aria-hidden="true"></span>' : '') + '</button>'; }).join('') + '</div></div>').join('');
/* motor de áudio: um AudioContext, compressor de saída e analisador para o osciloscópio */
let AC = null, master = null, an = null, seq = 0, atual = null; const cache = new Map();
function ctx() { if (!AC) { const C = window.AudioContext || window.webkitAudioContext; AC = new C(); master = AC.createDynamicsCompressor(); master.threshold.value = -16; master.ratio.value = 3; master.attack.value = 0.004; master.release.value = 0.2; an = AC.createAnalyser(); an.fftSize = 2048; master.connect(an); an.connect(AC.destination); } if (AC.state === 'suspended') AC.resume(); return AC; }
function buf(v, f) { const k = v + '/' + f; if (cache.has(k)) return cache.get(k); const c = ctx(); const p = fetch(url(v, f)).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); }).then(b => new Promise((res, rej) => c.decodeAudioData(b, res, rej))); cache.set(k, p); p.catch(() => cache.delete(k)); return p; }
function marca(el, on) { if (el) el.classList.toggle('tocando', on); }
function parar() { seq++; if (atual) { try { atual.parar(); } catch (e) {} atual = null; } document.querySelectorAll('.tocando').forEach(x => x.classList.remove('tocando')); }
function tocar(v, f, raca, el) {
  parar(); const meu = seq; marca(el, true);
  return new Promise(fim => {
    buf(v, f).then(b => {
      if (meu !== seq) return fim(false); const c = ctx(); const src = c.createBufferSource(); src.buffer = b; const cad = montar(c, raca || 'seco', src, b.duration); cad.saida.connect(master);
      const t0 = c.currentTime + 0.04; cad.iniciar(t0); src.start(t0 + cad.pre); const total = cad.pre + b.duration + cad.cauda;
      const tm = setTimeout(() => { if (meu === seq) { cad.parar(); atual = null; marca(el, false); } fim(true); }, (t0 - c.currentTime + total) * 1000 + 30);
      atual = { parar() { clearTimeout(tm); try { src.stop(); } catch (e) {} cad.parar(); fim(false); } }; desenha();
    }).catch(() => { /* sem fetch (arquivo aberto do disco): toca pelo elemento de áudio, sem filtro */
      if (meu !== seq) return fim(false); const a = new Audio(url(v, f)); a.onended = () => { marca(el, false); fim(true); }; a.onerror = () => { marca(el, false); fim(false); }; a.play().catch(() => { marca(el, false); fim(false); });
      atual = { parar() { a.pause(); fim(false); } }; if (raca && raca !== 'seco') aviso('Os filtros precisam da página publicada (https): aberta do disco, o navegador bloqueia a leitura do arquivo pelo Web Audio. Tocando sem filtro.'); });
  });
}
let lista = 0; /* "Ouvir as 12": qualquer outro clique encerra a sequência */
async function todas(v) { const minha = ++lista; for (const f of D.falas) { if (minha !== lista) return; const el = document.querySelector('.vb[data-v="' + v + '"][data-f="' + f.id + '"]'); const ok = await tocar(v, f.id, 'seco', el); if (!ok || minha !== lista) return; await new Promise(r => setTimeout(r, 380)); } }
function aviso(t) { const e = document.getElementById('r-aviso'); e.textContent = t; e.hidden = !t; }
/* ---------- cadeias das Raças ---------- */
function montar(c, raca, src, dur) {
  const out = c.createGain(), extras = []; const ch = { saida: out, pre: 0, cauda: 0.12 };
  ch.iniciar = t => { for (const x of extras) x.start(t + (x._off || 0)); }; ch.parar = () => { for (const x of extras) { try { x.stop(); } catch (e) {} } setTimeout(() => { try { out.disconnect(); } catch (e) {} }, 60); };
  const bq = (type, f, q, g) => { const n = c.createBiquadFilter(); n.type = type; n.frequency.value = f; if (q != null) n.Q.value = q; if (g != null) n.gain.value = g; return n; };
  const G = v => { const g = c.createGain(); g.gain.value = v; return g; };
  const sat = (k, ass) => { const n = 2048, a = new Float32Array(n), s = ass || 0, nk = Math.tanh(k * (1 + s)) - Math.tanh(k * s); for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; a[i] = (Math.tanh(k * (x + s)) - Math.tanh(k * s)) / nk; } const w = c.createWaveShaper(); w.curve = a; w.oversample = '4x'; return w; };
  const lfo = (f, prof, alvo) => { const o = c.createOscillator(); o.frequency.value = f; const g = G(prof); o.connect(g); g.connect(alvo); extras.push(o); };
  const pan = (no, p) => { if (!c.createStereoPanner) return no; const pn = c.createStereoPanner(); pn.pan.value = p; no.connect(pn); return pn; };
  const sala = (seg, decai, corte) => { const n = Math.floor(c.sampleRate * seg), b = c.createBuffer(2, n, c.sampleRate); const a = corte ? Math.exp(-2 * Math.PI * corte / c.sampleRate) : 0; for (let k = 0; k < 2; k++) { const d = b.getChannelData(k); let l = 0; for (let i = 0; i < n; i++) { const w = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decai); l = a ? l * a + w * (1 - a) : w; d[i] = l; } } const cv = c.createConvolver(); cv.buffer = b; return cv; };
  const ruido = seg => { const n = Math.floor(c.sampleRate * seg), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; const s = c.createBufferSource(); s.buffer = b; s.loop = true; extras.push(s); return s; };
  switch (raca) {
    case 'vehnar': { /* rádio de campanha */
      const hp = bq('highpass', 320, 0.8), pk = bq('peaking', 1700, 1.1, 5), s = sat(3.2), lp = bq('lowpass', 3300, 0.9), lp2 = bq('lowpass', 3600, 0.7), g = G(0.42); /* volumes casados com a voz seca (medidos em tools/vozes/pagina-teste.cjs) */
      src.connect(hp); hp.connect(pk); pk.connect(s); s.connect(lp); lp.connect(lp2); lp2.connect(g); g.connect(out);
      const hiss = ruido(2), bp = bq('bandpass', 2600, 0.5), gh = G(0); hiss.connect(bp); bp.connect(gh); gh.connect(out);
      const est = c.createBufferSource(); { const n = c.sampleRate * 2, b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0); for (let i = 0; i < 28; i++) { const p = Math.floor(Math.random() * (n - 300)), a = (Math.random() * 0.6 + 0.4) * (Math.random() < 0.5 ? -1 : 1); for (let j = 0; j < 80; j++) d[p + j] += a * Math.exp(-j / 10) * (Math.random() * 2 - 1); } est.buffer = b; est.loop = true; } extras.push(est);
      const he = bq('highpass', 900, 0.7), ge = G(0.05); est.connect(he); he.connect(ge); ge.connect(out);
      ch.pre = 0.14; ch.cauda = 0.24; const ini = ch.iniciar;
      ch.iniciar = t => { ini(t); const e = t + ch.pre + dur; gh.gain.setValueAtTime(0, t); gh.gain.linearRampToValueAtTime(0.14, t + 0.012); gh.gain.setTargetAtTime(0.025, t + 0.07, 0.03); gh.gain.setValueAtTime(0.025, e); gh.gain.linearRampToValueAtTime(0.14, e + 0.03); gh.gain.setTargetAtTime(0.0001, e + 0.12, 0.02); ge.gain.setValueAtTime(0.05, e + 0.08); ge.gain.linearRampToValueAtTime(0, e + 0.2); };
      break; }
    case 'erevane': { /* eco leve e ar */
      const ls = bq('lowshelf', 180, null, -4), hs = bq('highshelf', 5500, null, 6), ar = bq('peaking', 11000, 0.7, 4); src.connect(ls); ls.connect(hs); hs.connect(ar);
      const seco = G(0.82); ar.connect(seco); seco.connect(out);
      const dl = c.createDelay(1); dl.delayTime.value = 0.165; const fb = G(0.36), lpd = bq('lowpass', 4200, 0.6), wet = G(0.36); ar.connect(dl); dl.connect(lpd); lpd.connect(fb); fb.connect(dl); lpd.connect(wet); pan(wet, 0.35).connect(out);
      const hp = bq('highpass', 500, 0.7), rv = sala(2.0, 2.4), rw = G(0.34); ar.connect(hp); hp.connect(rv); rv.connect(rw); rw.connect(out); ch.cauda = 1.8; break; }
    case 'tessara': { /* quente e orgânico */
      const ls = bq('lowshelf', 240, null, 5), md = bq('peaking', 950, 0.8, 2.5), hs = bq('highshelf', 4800, null, -6), s = sat(1.8, 0.12); src.connect(ls); ls.connect(md); md.connect(hs); hs.connect(s);
      const seco = G(0.36); s.connect(seco); seco.connect(out);
      const vd = c.createDelay(0.1); vd.delayTime.value = 0.02; lfo(0.9, 0.0025, vd.delayTime); const vg = G(0.17); s.connect(vd); vd.connect(vg); vg.connect(out);
      const rv = sala(0.7, 4, 2800), rw = G(0.08); s.connect(rv); rv.connect(rw); rw.connect(out); ch.cauda = 0.6; break; }
    case 'quorith': { /* coro em uníssono */
      const pre = bq('peaking', 2800, 1.2, 3); src.connect(pre); const seco = G(0.65); pre.connect(seco); seco.connect(out);
      [[0.017, 0.31, 0.0022, -0.85], [0.024, 0.47, 0.0030, -0.35], [0.031, 0.59, 0.0026, 0.35], [0.040, 0.73, 0.0034, 0.85]].forEach(([d, f, prof, p]) => { const dl = c.createDelay(0.2); dl.delayTime.value = d; lfo(f, prof, dl.delayTime); const g = G(0.5); pre.connect(dl); dl.connect(g); pan(g, p).connect(out); });
      const hp = bq('highpass', 900, 0.7), rv = sala(2.4, 2.6), rw = G(0.26); pre.connect(hp); hp.connect(rv); rv.connect(rw); rw.connect(out); ch.cauda = 2.0; break; }
    case 'vorag': { /* grave com aspereza: tom 4 semitons abaixo (linha de atraso em duas fases), saturação e modulação de 38 Hz */
      const r = 0.79, P = 0.1, n = Math.round(c.sampleRate * P), rampa = c.createBuffer(1, n, c.sampleRate), jan = c.createBuffer(1, n, c.sampleRate), R = rampa.getChannelData(0), J = jan.getChannelData(0);
      for (let i = 0; i < n; i++) { const f = i / n; R[i] = f; J[i] = Math.pow(Math.sin(Math.PI * f), 2); }
      const ent = G(1), sai = G(1); for (const fase of [0, 0.5]) { const dl = c.createDelay(1); dl.delayTime.value = 0.004; const m = c.createBufferSource(); m.buffer = rampa; m.loop = true; m._off = fase * P; const mg = G((1 - r) * P); m.connect(mg); mg.connect(dl.delayTime);
        const w = c.createBufferSource(); w.buffer = jan; w.loop = true; w._off = fase * P; const vg = G(0); w.connect(vg.gain); ent.connect(dl); dl.connect(vg); vg.connect(sai); extras.push(m, w); }
      src.connect(ent); const ls = bq('lowshelf', 160, null, 7), s = sat(4.5), rm = G(0.72), lp = bq('lowpass', 4200, 0.7), g = G(0.44); lfo(38, 0.28, rm.gain);
      sai.connect(ls); ls.connect(s); s.connect(rm); rm.connect(lp); lp.connect(g); g.connect(out);
      const dlp = bq('lowpass', 2000, 0.7), dry = G(0.09); src.connect(dlp); dlp.connect(dry); dry.connect(out); ch.cauda = 0.25; break; }
    default: src.connect(out);
  }
  return ch;
}
/* osciloscópio */
const cv = document.getElementById('osc'), g2 = cv.getContext('2d'); let raf = 0;
function ajusta() { const r = cv.getBoundingClientRect(), d = window.devicePixelRatio || 1, w = Math.max(1, Math.round(r.width * d)), h = Math.max(1, Math.round(r.height * d)); if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; } return d; } /* resolução do canvas = tamanho na tela */
function repouso() { const d = ajusta(); g2.clearRect(0, 0, cv.width, cv.height); g2.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--fg3'); g2.font = '500 ' + Math.round(12 * d) + 'px "IBM Plex Mono", monospace'; g2.textAlign = 'center'; g2.textBaseline = 'middle'; g2.fillText('toque uma Raça para ouvir e ver a onda', cv.width / 2, cv.height / 2); }
repouso(); if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (!raf) repouso(); }); addEventListener('resize', () => { if (!raf) repouso(); });
function desenha() { if (raf || !an) return; const arr = new Uint8Array(an.fftSize); const cor = () => { const b = document.querySelector('.rb.tocando'); return b ? getComputedStyle(b).getPropertyValue('--cor') || '#ECE6DA' : getComputedStyle(document.documentElement).getPropertyValue('--fg2'); };
  const passo = () => { const d = ajusta(); an.getByteTimeDomainData(arr); g2.clearRect(0, 0, cv.width, cv.height); g2.strokeStyle = cor(); g2.lineWidth = 2 * d; g2.beginPath(); for (let i = 0; i < arr.length; i++) { const x = i / (arr.length - 1) * cv.width, y = arr[i] / 255 * cv.height; i ? g2.lineTo(x, y) : g2.moveTo(x, y); } g2.stroke(); raf = document.querySelector('.tocando') ? requestAnimationFrame(passo) : 0; if (!raf) repouso(); };
  raf = requestAnimationFrame(passo); }
/* eventos */
document.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (!b.hasAttribute('data-todas')) lista++;
  if (b.matches('.vb')) { if (b.classList.contains('tocando')) return parar(); tocar(b.dataset.v, b.dataset.f, 'seco', b); }
  else if (b.matches('.rb')) { if (b.classList.contains('tocando')) return parar(); aviso(''); tocar(document.getElementById('r-voz').value, document.getElementById('r-fala').value, b.dataset.r, b); }
  else if (b.hasAttribute('data-todas')) todas(b.dataset.todas);
  else if (b.hasAttribute('data-parar')) parar();
});
window.__vozes = { tocar, parar, montar, ext: EXT, ctx: () => AC };
})();
</script>
`;
writeFileSync(root + 'work/vozes-escolha.html', html);
console.log('página: work/vozes-escolha.html · melhor: ' + melhor.id + ' · ' + cands.length + ' vozes · plano: ' + plano.total.n + ' falas, ' + Math.round(plano.total.kb24) + ' KB (Opus 24k), ' + Math.round(plano.total.kb32) + ' KB (Opus 32k); por Raça ' + porRaca.n + ' falas, ' + Math.round(porRaca.kb24) + ' KB');
/* mapa de arquivos para a publicação (Artifact: page = work/vozes-escolha.html, files = este mapa) */
const pub = {}; for (const c of cands) for (const f of c.falas) for (const ext of ['ogg', 'mp3']) pub['vozes/' + c.id + '/' + f.id + '.' + ext] = root + 'work/vozes/' + c.id + '/' + f.id + '.' + ext;
writeFileSync(root + 'work/vozes-publicar.json', JSON.stringify({ pagina: root + 'work/vozes-escolha.html', titulo: 'Vozes do Aether Rift', icone: 'audio', descricao: 'As 12 falas do jogo em seis vozes neurais abertas, com o filtro de cada Raça ao vivo, os números de cada modelo e o plano da implantação.', arquivos: Object.keys(pub).length, files: pub }, null, 1));
