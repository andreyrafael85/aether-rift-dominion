/* 5.0a.2: monta work/vozes-escolha.html (página de escuta das vozes neurais) a partir de work/vozes/manifesto.json (tools/vozes/gerar.py)
   e calcula o plano da implantação: falas por tipo e por Raça, tamanho em Opus (ajuste bytes = cabeçalho + taxa × duração medido nos
   próprios arquivos, vezes o fator de cada Raça medido nos arquivos assados) e as falas da campanha contadas em src/campaign.js.
   2ª rodada (24/10/2026): decisão do dono no topo, elenco, caráter das Raças assado (a página toca os arquivos que o jogo vai tocar),
   antes e depois do Vehnar e do Vorag, Sylvia Oriel. Os áudios ficam ao lado, em work/vozes/. Uso: node tools/vozes/pagina.mjs --escolha (5.0c.1: sem --escolha, a página das vozes do jogo) */
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const root = new URL('../..', import.meta.url).pathname;
/* 5.0c.1: sem --escolha, monta a página das vozes gravadas do jogo (tools/vozes/pagina-jogo.mjs: amostras por Raça e idioma, campanha, números e o
   que precisa de ouvido). A página de escolha das rodadas 1 a 3 (abaixo) precisa do work/vozes/manifesto.json da avaliação (cópia do a2-vozes). */
if (!process.argv.includes('--escolha')) { await import('./pagina-jogo.mjs'); process.exit(0); }
const man = JSON.parse(readFileSync(root + 'work/vozes/manifesto.json', 'utf8'));
{ const F = JSON.parse(readFileSync(root + 'tools/vozes/falas.json', 'utf8')).falas; for (const f of man.falas) { const g = F.find(x => x.id === f.id); if (g) f.quem = g.quem; } } /* rótulos atuais de falas.json */
const RACAS = ['vehnar', 'erevane', 'tessara', 'quorith', 'vorag'];
const NOME_RACA = { vehnar: 'Vehnar', erevane: 'Erevane', tessara: 'Tessara', quorith: 'Quorith', vorag: 'Vorag' };
const LIDER = { vehnar: 'Barão-Forja', erevane: 'Vesper Ísk', tessara: 'Sylvia Oriel', quorith: 'Zayin Coral', vorag: 'Oru Voraz' };
const RC = man.racas, RA = man.racas_antes, EL = man.elenco;
if (!RC || !RA || !EL) throw new Error('faltam etapas no manifesto: rode gerar.py --etapa racas, elenco e antes');

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

/* ---------- medidas dos arquivos gerados: velocidade da fala, bytes por segundo e o fator de cada Raça ---------- */
const cands = man.candidatas; const media = a => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length);
function ajuste(campo) { const xs = [], ys = []; for (const c of cands) for (const f of c.falas) { xs.push(f.dur_s); ys.push(f[campo]); } const mx = media(xs), my = media(ys); let num = 0, den = 0; for (let i = 0; i < xs.length; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2; } const b = num / den; return { a: my - b * mx, b }; }
const A24 = ajuste('opus24_b'), A32 = ajuste('opus32_b');
const base = cands.find(c => c.id === 'kokoro-pm_alex') || cands[0]; /* decisão do dono: Kokoro, Alex como voz-base */
const cps = (() => { const tx = Object.fromEntries(man.falas.map(f => [f.id, f.texto.length])); return media(base.falas.map(f => tx[f.id] / Math.max(0.3, f.dur_s - 0.17))); })();
const dur = t => 0.17 + t.length / cps; const somaDur = arr => arr.reduce((s, t) => s + dur(t), 0);
const kb = (n, s, A) => (n * A.a + s * A.b) / 1024;
const opusSeco = (v, L) => { const c = cands.find(x => x.id === 'kokoro-' + v); const f = c && c.falas.find(x => x.id === L); return f ? f.opus32_b : null; };
const FATOR = Object.fromEntries(RACAS.map(r => { const q = []; for (const v of RC.vozes) for (const L of RC.linhas) { const it = RC.itens[r][v][L], s = opusSeco(v, L); if (it && s) q.push(it.ogg_b / s); } return [r, media(q)]; })); /* cauda do eco e da sala, estéreo do Quorith */
const tipos = [
  { tipo: 'Locutor: avisos', por: LOCUTOR.length, dur: somaDur(LOCUTOR), nota: LOCUTOR.length + ' avisos fixos (os 13 de hoje e ' + (LOCUTOR.length - 13) + ' novos, como Superarma pronta, Eras, Vitória e as contagens de 1 a 3 inimigos)' },
  { tipo: 'Locutor: eliminações', por: ELIM.length, dur: somaDur(ELIM), nota: ELIM.length + ' nomes das IAs (src/main.js), com o gênero certo ("Fundição Kessari eliminada")' },
  { tipo: 'Unidades', por: CLASSES.length * UNID.length, dur: somaDur(UNID) * CLASSES.length, nota: CLASSES.length + ' classes × ' + UNID.length + ' falas (3 ao selecionar, 3 ao receber ordem, 2 ao atacar)' },
  { tipo: 'Líder', por: 3 + REACAO.length, dur: somaDur(SALA) + somaDur(REACAO), nota: '3 saudações da Sala e ' + REACAO.length + ' reações na partida' },
].map(l => Object.assign(l, { total: l.por * 5, kb24: RACAS.reduce((s, r) => s + kb(l.por, l.dur, A24) * FATOR[r], 0), kb32: RACAS.reduce((s, r) => s + kb(l.por, l.dur, A32) * FATOR[r], 0) }));
const pacote = Object.fromEntries(RACAS.map(r => [r, tipos.reduce((s, l) => s + kb(l.por, l.dur, A24), 0) * FATOR[r]]));
const fMed = media(RACAS.map(r => FATOR[r]));
const campDur = (camp.self[0] * 0.17 * 5 + camp.self[1] / cps * 5) + (camp.enemy[0] * 0.17 * 5 + camp.enemy[1] / cps * 5) + (camp.raca[0] * 0.17 + camp.raca[1] / cps);
const campN = camp.self[0] * 5 + camp.enemy[0] * 5 + camp.raca[0];
const porRaca = { n: tipos.reduce((s, l) => s + l.por, 0), dur: tipos.reduce((s, l) => s + l.dur, 0) };
const plano = { cps: +cps.toFixed(1), A24, A32, FATOR, pacote, tipos, porRaca,
  campanha: { n: campN, dur: campDur, kb24: kb(campN, campDur, A24) * fMed, kb32: kb(campN, campDur, A32) * fMed, fixas: camp.self[0] + camp.enemy[0] + camp.raca[0], self: camp.self[0], enemy: camp.enemy[0], raca: camp.raca[0], fn: camp.fn, missoes: ARD.campaign.MISSIONS.length } };
plano.total = { n: tipos.reduce((s, l) => s + l.total, 0) + campN, kb24: tipos.reduce((s, l) => s + l.kb24, 0) + plano.campanha.kb24, kb32: tipos.reduce((s, l) => s + l.kb32, 0) + plano.campanha.kb32, dur: porRaca.dur * 5 + campDur };
writeFileSync(root + 'work/vozes/plano.json', JSON.stringify({ base: base.id, plano, LOCUTOR, ELIM, UNID, CLASSES, REACAO }, null, 1));

/* ---------- antes e depois (voz Alex, médias das falas da faixa) ---------- */
const MED = ['nivel_db', 'pico_db', 'piso_rel_db', 'piso_pausas_rel_db', 'hnr_db', 'aspereza_db', 'f0_hz', 'cer', 'estereo_db', 'cauda_s'];
const resumo = itens => Object.fromEntries(MED.map(k => { const v = itens.map(i => i && i[k]).filter(x => x != null); return [k, v.length ? media(v) : null]; }));
const seco = resumo(RC.linhas.map(L => RC.seco.pm_alex[L])); const secoAntes = resumo(RC.linhas.map(L => RA.itens.seco[L]));
const AD = Object.fromEntries(RACAS.map(r => [r, { antes: resumo(RC.linhas.map(L => RA.itens[r][L])), depois: resumo(RC.linhas.map(L => RC.itens[r].pm_alex[L])) }]));
/* 3ª rodada: as três variantes mais graves do Vorag (racas.py: vorag-a, vorag-b, vorag-c) e as amostras de idiomas (idiomas.py, cb_gerar.py) */
const VAR = ['vorag-a', 'vorag-b', 'vorag-c'], VREC = 'vorag-c';
const VDESC = { 'vorag-a': 'A: −4 semitons, graves +5 dB', 'vorag-b': 'B: −5 semitons, graves +6 dB e mais aspereza', 'vorag-c': 'C: −5 semitons e formantes 12% abaixo, graves +4 dB' };
for (const r of VAR) AD[r] = { depois: resumo(RC.linhas.map(L => RC.itens[r].pm_alex[L])) };
const doze = r => { const q = []; for (const v of RC.vozes) for (const L of RC.linhas) { const it = RC.itens[r][v][L], sc = RC.seco[v][L]; q.push({ p: it.piso_pausas_rel_db - sc.piso_pausas_rel_db, h: it.hnr_db - sc.hnr_db, a: it.aspereza_db - sc.aspereza_db, f: it.f0_hz, fs: sc.f0_hz, n: it.nivel_db - sc.nivel_db, pk: it.pico_db, c: it.cer || 0, cs: sc.cer || 0 }); }
  const mm = k => media(q.map(x => x[k])); return { pausas: mm('p'), pausasMax: Math.max(...q.map(x => x.p)), hnr: mm('h'), asp: mm('a'), f0: mm('f'), st: 12 * Math.log2(mm('f') / mm('fs')), nivel: mm('n'), picoMax: Math.max(...q.map(x => x.pk)), cer: mm('c'), cerSeco: mm('cs') }; };
const V12 = Object.fromEntries(['vorag', ...VAR].map(r => [r, doze(r)])); const V12antes = (() => { const it = RC.linhas.map(L => RA.itens.vorag[L]), sc = RC.linhas.map(L => RA.itens.seco[L]); return { pausas: media(it.map(x => x.piso_pausas_rel_db)) - media(sc.map(x => x.piso_pausas_rel_db)) }; })();
const IDI = man.idiomas || null; const LGN = { pt: 'pt-BR', en: 'inglês', es: 'espanhol' };
writeFileSync(root + 'work/vozes/antes-depois.json', JSON.stringify({ voz: 'pm_alex', linhas: RC.linhas, seco, secoAntes, racas: AD, porVoz: Object.fromEntries(RACAS.map(r => [r, Object.fromEntries(RC.vozes.map(v => [v, resumo(RC.linhas.map(L => RC.itens[r][v][L]))]))])) }, null, 1));

/* ---------- página ---------- */
const n1 = (v, d = 1) => v == null || Number.isNaN(v) ? '—' : Number(v).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
const n0 = v => v == null ? '—' : Math.round(v).toLocaleString('pt-BR');
const sinal = v => v == null ? '—' : (v > 0.05 ? '+' : v < -0.05 ? '−' : '±') + n1(Math.abs(v));
const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
const CURTO = { 'kokoro-pf_dora': 'Dora', 'kokoro-pm_alex': 'Alex', 'kokoro-pm_santa': 'Santa', 'piper-faber': 'Faber', 'piper-cadu': 'Cadu', 'piper-jeff': 'Jeff' };
const VNOME = { pf_dora: 'Dora', pm_alex: 'Alex', pm_santa: 'Santa' };
const pesos = p => Object.entries(p).sort((a, b) => b[1] - a[1]).map(([v, w]) => VNOME[v] + (Object.keys(p).length > 1 ? ' ' + Math.round(w * 100) + '%' : '')).join(' + ');
const genero = c => c.f0_hz == null ? '' : c.f0_hz >= 165 ? 'feminina' : 'masculina';
const dados = { vozes: cands.map(c => ({ id: c.id, curto: CURTO[c.id] || c.voz, falas: Object.fromEntries(c.falas.map(f => [f.id, { d: f.dur_s, asr: f.asr || '', cer: f.cer }])) })), falas: man.falas, base: base.id,
  racas: { linhas: RC.linhas, vozes: RC.vozes.map(v => 'kokoro-' + v), padrao: Object.fromEntries(RACAS.map(r => [r, r === 'tessara' ? 'kokoro-pf_dora' : 'kokoro-pm_alex'])) } };
const linhaVoz = c => `<tr${c.id === base.id ? ' class="rec"' : ''}><th scope="row"><span class="vn">${esc(CURTO[c.id] || c.voz)}</span><small>${esc(c.voz)}</small></th><td>${esc(c.modelo)}</td>
  <td><span class="pill ${c.licenca.uso_comercial === 'sim' ? 'ok' : 'risco'}">${c.licenca.uso_comercial === 'sim' ? 'livre para uso comercial' : 'risco para uso comercial'}</span><small>${esc(c.licenca.resumo)}</small></td>
  <td class="num">${c.f0_hz != null ? n0(c.f0_hz) + ' Hz' : '—'}<small>${genero(c)}</small></td><td class="num">${n0(c.modelo_mb)} MB</td>
  <td class="num">${n1(c.opus32_kb)} KB<small>MP3: ${n1(c.mp3_kb)} KB</small></td>
  <td class="num">${n1(c.carga_s)} s + ${n1(c.sintese_s)} s<small>CPU ${n1(c.cpu_s)} s para ${n1(c.audio_s)} s de fala</small></td>
  <td class="num">${c.falas_exatas != null ? c.falas_exatas + ' de 12' : '—'}<small>${c.cer != null ? 'erro por letra ' + n1(c.cer * 100) + '%' : ''}</small></td></tr>`;
const RACA_INFO = [
  ['seco', 'Sem filtro', 'A gravação como saiu do modelo, só nivelada.'],
  ['vehnar', 'Vehnar', 'Rádio limpo: faixa de 250 a 4.000 Hz, presença em 1,8 kHz e saturação leve. Só um clique e um chiado curto e baixo antes e depois da fala, nunca durante.'],
  ['erevane', 'Erevane', 'Eco leve e ar: agudos abertos, eco de 165 ms que some em poucas repetições e uma sala longa e fria.'],
  ['tessara', 'Tessara', 'Quente e orgânico: graves encorpados, agudos macios, saturação suave e uma ondulação lenta, como respiração.'],
  ['quorith', 'Quorith', 'Coro em uníssono: quatro cópias da voz com atrasos que flutuam, abertas no estéreo, e uma ressonância de cristal.'],
  ['vorag', 'Vorag', 'Grave com aspereza, limpo: 3 semitons abaixo por PSOLA (sem mudar a velocidade nem as consoantes), sem ronco abaixo de 70 Hz, graves +3 dB e saturação leve em paralelo.'],
];
const linhaPlano = l => `<tr><th scope="row">${esc(l.tipo)}<small>${esc(l.nota)}</small></th><td class="num">${l.por}</td><td class="num">${l.total}</td><td class="num">${n1(l.dur * 5 / 60)} min</td><td class="num">${n0(l.kb24)} KB</td><td class="num">${n0(l.kb32)} KB</td></tr>`;
const linhaAD = (r, q, rot) => { const d = AD[r][q]; const ref = q === 'antes' ? secoAntes : seco;
  return `<tr class="${q}"><th scope="row">${q === 'antes' ? `<span class="rn" data-r="${r}">${NOME_RACA[r]}</span>` : ''}<small>${rot}</small></th><td class="num">${sinal(d.nivel_db - ref.nivel_db)} dB</td><td class="num">${n1(d.pico_db)}</td>
  <td class="num">${n1(d.piso_rel_db)}<small>${sinal(d.piso_rel_db - ref.piso_rel_db)} dB</small></td><td class="num">${n1(d.piso_pausas_rel_db)}<small>${sinal(d.piso_pausas_rel_db - ref.piso_pausas_rel_db)} dB</small></td>
  <td class="num">${n1(d.hnr_db)}<small>${sinal(d.hnr_db - ref.hnr_db)} dB</small></td><td class="num">${n1(d.aspereza_db)}<small>${sinal(d.aspereza_db - ref.aspereza_db)} dB</small></td><td class="num">${n0(d.f0_hz)} Hz</td><td class="num">${n1(d.cer * 100)}%</td></tr>`; };
const cartaElenco = r => { const e = EL.racas[r]; const lf = e.lider_fala, lc = e.locutor_falas;
  return `<article class="elc" data-r="${r}"><header><span class="rn" data-r="${r}">${NOME_RACA[r]}</span><b>${esc(e.lider)}</b></header>
  <div class="papel"><div class="eyebrow">Líder · ${esc(pesos(e.lider_pesos))} · velocidade ${n1(e.lider_vel, 2)}</div><q>${esc(lf.texto)}</q>
    <button class="btn tk" type="button" data-arq="vozes/elenco/${r}-lider" data-r="${r}">Ouvir a saudação</button><small>tom da voz ${n0(lf.f0_seco_hz)} Hz antes do caráter · transcrição ${lf.cer === 0 ? 'sem erro' : 'erro por letra ' + n1(lf.cer * 100) + '%'}${lf.seco && lf.seco.cer != null ? ' (voz seca: ' + (lf.seco.cer === 0 ? 'sem erro' : n1(lf.seco.cer * 100) + '%') + ')' : ''}</small></div>
  <div class="papel"><div class="eyebrow">Locutor · ${esc(pesos(e.locutor_pesos))} · velocidade ${n1(e.locutor_vel, 2)}</div>
    <div class="row2">${lc.map(x => `<button class="btn tk" type="button" data-arq="vozes/elenco/${r}-locutor-${x.id}" data-r="${r}">${esc(x.texto.replace(/[.!]$/, ''))}</button>`).join('')}</div><small>tom ${n0(media(lc.map(x => x.f0_seco_hz)))} Hz antes do caráter · transcrição ${lc.every(x => x.cer === 0) ? 'sem erro' : 'erro por letra ' + n1(media(lc.map(x => x.cer)) * 100) + '%'} (voz seca: ${lc.every(x => x.seco && x.seco.cer === 0) ? 'sem erro' : n1(media(lc.map(x => (x.seco || {}).cer || 0)) * 100) + '%'})</small></div>
  ${r === 'vorag' && EL.racas[VREC] ? `<div class="papel"><div class="eyebrow">Variantes mais graves (3ª rodada)</div><div class="row2">${VAR.filter(v => EL.racas[v]).map(v => `<button class="btn tk${v === VREC ? ' rec' : ''}" type="button" data-arq="vozes/elenco/${v}-lider" data-r="vorag">Saudação ${esc(VDESC[v].split(':')[0])}</button>`).join('')}${VAR.filter(v => EL.racas[v]).map(v => `<button class="btn tk" type="button" data-arq="vozes/elenco/${v}-locutor-03-base-sob-ataque" data-r="vorag">Locutor ${esc(VDESC[v].split(':')[0])}</button>`).join('')}</div><small>tom da saudação: ${VAR.filter(v => EL.racas[v]).map(v => esc(VDESC[v].split(':')[0]) + ' ' + n0(EL.racas[v].lider_fala.f0_hz) + ' Hz').join(' · ')} (2ª rodada ${n0(e.lider_fala.f0_hz)} Hz)</small></div>` : ''}
  <p class="muted">${esc(e.porque)}</p></article>`; };
const assetsRows = `| Vozes gravadas (assets/vozes/&lt;raça&gt;/*.opus e assets/vozes/campanha/*.opus, 5.0x) | geradas na máquina de build com o Kokoro-82M v1.0 (hexgrad/Kokoro-82M), vozes pm_alex, pf_dora e pm_santa e misturas, com o caráter de cada Raça assado na geração (tools/vozes/racas.py) (\`bash tools/vozes/preparar.sh\` e \`.tools/vozes/venv/bin/python tools/vozes/gerar.py\`) | equipe (texto e direção); modelo de hexgrad | pesos Apache-2.0; áudio gerado pela equipe | locutor, unidades e líderes |
| Dados CC BY usados no treino do Kokoro-82M (atribuição pedida no model card) | Koniwa (github.com/koniwa/koniwa), SIWIS (datashare.ed.ac.uk/handle/10283/2353) | Koniwa; University of Edinburgh / SIWIS | CC BY 3.0; CC BY 4.0 | crédito do modelo de voz |
| Ferramentas de geração das vozes (tools/vozes/, só na máquina de build) | kokoro e misaki (pip), espeak-ng embutido no espeakng-loader, praat-parselmouth (Praat, PSOLA do Vorag), scipy | hexgrad; eSpeak NG; Yannick Jadoul (Parselmouth), Paul Boersma e David Weenink (Praat); SciPy | Apache-2.0; GPL-3.0 (espeak-ng e Praat, não vão no jogo); BSD-3 | geração das falas e do caráter das Raças |`;

/* ---------- 3ª rodada: seção Idiomas ---------- */
const IDID = JSON.parse(readFileSync(root + 'tools/vozes/idiomas.json', 'utf8'));
const REC_IDIOMAS = (() => { try { return readFileSync(root + 'work/vozes/idiomas-recomendacao.html', 'utf8'); } catch (e) { return ''; } })();
function idiomasHTML() {
  if (!IDI) return '';
  const it = (mod, lg, n) => ((IDI.itens[mod] || {})[lg] || {})[n];
  const nomeF = (r, papel, fid) => r + '-' + (papel === 'lider' ? 'lider' : 'locutor-' + fid);
  const sem = (mod, lg) => { const v = []; for (const r of RACAS) { const x = ((IDI.semelhanca || {})[r] || {}).lider; if (x && x[mod + '-' + lg] != null) v.push(x[mod + '-' + lg]); } return v.length ? media(v) : null; };
  const est = (IDI.estimativa || {}); const falaS = plano.total.dur; const cal = ((IDI.chatterbox || {}).calibracao || {});
  const kokPt = (cands.find(c => c.id === 'kokoro-pm_alex') || {}).rtf_cpu;
  const linhas = [];
  for (const [mod, nomeM] of [['kokoro', 'Kokoro-82M'], ['chatterbox', 'Chatterbox Multilingual']]) for (const lg of ['pt', 'en', 'es']) {
    if (mod === 'chatterbox' && lg === 'pt') continue; /* o pt-BR fica com o Kokoro: é a própria referência da clonagem */
    const e = (est[mod] || {})[lg]; const cpu = e ? e.cpu_por_s : (mod === 'kokoro' && lg === 'pt' ? kokPt : null);
    const cerTxt = e ? n1(e.cer * 100) + '%<small>seca ' + n1(e.cer_seco * 100) + '%</small>' : (mod === 'kokoro' && lg === 'pt' ? 'ver a mesa' : '—');
    const s1 = lg === 'pt' && mod === 'kokoro' ? 1 : sem(mod, lg);
    linhas.push(`<tr><th scope="row">${nomeM}<small>${LGN[lg]}</small></th><td class="num">${cerTxt}</td><td class="num">${s1 == null ? '—' : (lg === 'pt' && mod === 'kokoro' ? 'é a referência' : n1(s1, 2))}</td><td class="num">${cpu == null ? '—' : n1(cpu, 1) + ' s'}</td><td class="num">${cpu == null ? '—' : n1(cpu * falaS / 3600, 1) + ' h'}<small>${cpu == null ? '' : n1(cpu * falaS / 3600 / 8, 1) + ' h com 8 núcleos livres'}</small></td></tr>`); }
  const cb = IDI.chatterbox || {};
  const glos = IDID.glossario.map(g => `<tr><th scope="row">${esc(g.pt)}</th><td>${esc(g.en)}</td><td>${esc(g.es)}</td><td class="muted">${esc(g.nota)}</td></tr>`).join('');
  const celula = (r, papel, fid, lg, tx) => { const n = nomeF(r, papel, fid); const vr = r === 'vorag' ? VREC : r; const bt = [];
    const kArq = lg === 'pt' ? 'vozes/elenco/' + (papel === 'lider' ? vr + '-lider' : vr + '-locutor-' + fid) : 'vozes/idiomas/kokoro/' + lg + '/' + n;
    const k = lg === 'pt' ? null : it('kokoro', lg, n), c = it('chatterbox', lg, n);
    bt.push(`<button class="btn tk" type="button" data-arq="${kArq}" data-r="${r}"${k ? ` title="a transcrição ouviu: ${esc(k.asr)}"` : ''}>Kokoro${k ? `<small>${k.cer === 0 ? 'sem erro' : n1(k.cer * 100) + '%'}</small>` : ''}</button>`);
    if (c) bt.push(`<button class="btn tk" type="button" data-arq="vozes/idiomas/chatterbox/${lg}/${n}" data-r="${r}" title="a transcrição ouviu: ${esc(c.asr)}">Chatterbox<small>${c.cer === 0 ? 'sem erro' : n1(c.cer * 100) + '%'}</small></button>`);
    return `<td><small>${esc(tx)}</small><div class="row2">${bt.join('')}</div></td>`; };
  const cartas = RACAS.map(r => { const f = [['lider', 'lider', IDID.lideres[r]], ...IDID.locutor.map(x => ['locutor', x.id, x])]; const sl = ((IDI.semelhanca || {})[r] || {}).lider || {};
    return `<article class="idc" data-r="${r}"><header><span class="rn" data-r="${r}">${NOME_RACA[r]}</span> <b>${esc(LIDER[r])}</b> <small>semelhança com a voz pt-BR do elenco: Chatterbox en ${n1(sl['chatterbox-en'], 2)}, es ${n1(sl['chatterbox-es'], 2)} · Kokoro en ${n1(sl['kokoro-en'], 2)}, es ${n1(sl['kokoro-es'], 2)}</small></header>
      <div class="tbl"><table><thead><tr><th>Fala</th><th>pt-BR</th><th>inglês</th><th>espanhol</th></tr></thead><tbody>${f.map(([papel, fid, tx]) => `<tr><th scope="row">${papel === 'lider' ? 'Líder' : 'Locutor'}</th>${['pt', 'en', 'es'].map(lg => celula(r, papel, fid, lg, tx[lg])).join('')}</tr>`).join('')}</tbody></table></div></article>`; }).join('');
  return `<section class="sec" aria-labelledby="t-idi">
  <header><div class="eyebrow">Idiomas · 3ª rodada</div><h2 id="t-idi">Inglês e espanhol</h2>
  <p class="muted">As 5 saudações e 2 avisos de locutor em pt-BR, inglês e espanhol, já com o caráter da Raça (o Vorag na variante C). <b>Kokoro</b>: espanhol com ef_dora, em_alex e em_santa nos mesmos pesos do elenco; inglês com as vozes americanas e britânicas mais parecidas com cada papel. <b>Chatterbox Multilingual</b>: a mesma voz de cada papel nos três idiomas, clonada da voz do elenco em pt-BR feita pelo Kokoro (uma voz nossa, nunca de uma pessoa real); toda saída leva a marca d'água PerTh, inaudível.</p></header>
  ${REC_IDIOMAS ? `<div class="plate rec-box">${REC_IDIOMAS}</div>` : ''}
  <div class="tbl"><table><thead><tr><th>Modelo</th><th class="num">Erro de transcrição</th><th class="num">Mesma voz do pt-BR</th><th class="num">CPU por s de fala</th><th class="num">742 falas num idioma</th></tr></thead><tbody>${linhas.join('')}</tbody></table></div>
  <p class="muted">Erro: Whisper small no idioma da fala, no arquivo assado (embaixo, a mesma fala sem o caráter da Raça). Mesma voz: cosseno entre a voz da fala e a referência pt-BR do elenco no codificador de voz do Chatterbox (1 é a mesma voz; entre líderes diferentes do elenco dá em média ${n1(cal.entre_lideres_diferentes_media, 2)}, no máximo ${n1(cal.entre_lideres_diferentes_max, 2)}). CPU: segundos de CPU por segundo de fala nesta máquina sem GPU, dividida com outros agentes. As 742 falas somam ${n1(falaS / 60, 0)} min de fala por idioma (o plano em pt-BR); três idiomas = três vezes isso. Tamanho: Kokoro 328 MB (mais 0,5 MB por voz); Chatterbox ${n1(cb.modelo_gb, 1)} GB de pesos e um ambiente Python à parte (torch 2.6), ${esc(cb.versao || '')}.</p>
  <h3 class="h3">Glossário inicial</h3>
  <div class="tbl"><table><thead><tr><th>pt-BR</th><th>inglês</th><th>espanhol</th><th>Nota</th></tr></thead><tbody>${glos}</tbody></table></div>
  <p class="muted">Os nomes próprios não mudam: ${esc(IDID.nomes.join(', '))}.</p>
  <div class="idi">${cartas}</div>
</section>`;
}

const html = `<title>Vozes do Aether Rift</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@600;700;800&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
/* Layout: mesa de escuta da Sala de Comando — uma coluna de leitura (máx. 1100 px): decisão do dono, elenco, mesa com as 12 falas × 6 vozes,
   faixa das cinco Raças (arquivos assados, com o antes do Vehnar e do Vorag), medidas, números e o plano. Identidade escura do jogo. */
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
.wrap>header{display:grid;gap:12px;padding-bottom:6px;border-bottom:1px solid var(--line)}
.sec{display:grid;gap:14px;min-width:0}.sec>header{display:grid;gap:6px}
.plate{--c:12px;clip-path:polygon(var(--c) 0,100% 0,100% calc(100% - var(--c)),calc(100% - var(--c)) 100%,0 100%,0 var(--c));background:linear-gradient(180deg,var(--ink2),var(--ink1))}
.rec-box{padding:18px 20px;display:grid;gap:10px;border-left:3px solid var(--rift)}
.rec-box b{color:#fff}.rec-box .acts{display:flex;flex-wrap:wrap;gap:8px;margin-top:4px}
.rec-box ul{margin:0}
button{font:inherit;color:inherit;cursor:pointer}
.btn{--c:7px;clip-path:polygon(var(--c) 0,100% 0,100% calc(100% - var(--c)),calc(100% - var(--c)) 100%,0 100%,0 var(--c));border:0;min-height:40px;padding:8px 14px;font:600 .86rem/1.1 var(--fb);background:linear-gradient(180deg,var(--ink3),var(--ink2));box-shadow:inset 0 0 0 1px var(--line2)}
.btn:hover{background:linear-gradient(180deg,#252e3d,var(--ink3))}.btn.prim{background:linear-gradient(180deg,#ff7a5a,var(--rift));color:#1a0b06}
.btn.tocando{background:var(--rift);color:#1a0b06;box-shadow:none}
button:focus-visible{outline:2px solid #fff;outline-offset:2px}
.legend{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:8px}
.vchip{display:grid;gap:2px;padding:10px 12px;background:var(--ink1);box-shadow:inset 0 0 0 1px var(--line);min-width:0}
.vchip b{font:700 1.15rem/1 var(--fd);letter-spacing:.03em;text-transform:uppercase}.vchip.rec{box-shadow:inset 0 0 0 1px var(--rift)}
.vchip .btn{margin-top:6px;min-height:34px;padding:6px 10px;font-size:.78rem}
.grid{display:grid;gap:6px}
.row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px 16px;align-items:center;padding:10px 12px;background:var(--ink1);border-left:2px solid var(--line2)}
.row[data-tipo=aviso]{border-left-color:var(--warn)}.row[data-tipo=unidade]{border-left-color:var(--erevane)}.row[data-tipo=lider]{border-left-color:var(--rift)}
.row .tx{min-width:0}.row .tx q,.elc q{quotes:none;font-weight:500;color:#fff}.row .tx small{font-family:var(--fm);letter-spacing:.06em;text-transform:uppercase;font-size:.66rem;margin-bottom:2px}
.vbtns{display:grid;grid-template-columns:repeat(3,64px) 10px repeat(3,64px);gap:5px}.vbtns i{display:block}
.vb{position:relative;min-height:40px;border:0;padding:0 4px;font:600 .8rem/1 var(--fb);background:var(--ink3);box-shadow:inset 0 0 0 1px var(--line2)}
.vb:hover{background:#232b39}.vb.tocando{background:var(--rift);color:#1a0b06;box-shadow:none}.vb.rec{box-shadow:inset 0 0 0 1px var(--rift)}
.vb .dif{position:absolute;top:3px;right:4px;width:6px;height:6px;border-radius:50%;background:var(--warn)}
.rn{font:800 1.05rem/1 var(--fd);letter-spacing:.04em;text-transform:uppercase;color:var(--cor,var(--fg))}
[data-r=vehnar]{--cor:var(--vehnar)}[data-r=erevane]{--cor:var(--erevane)}[data-r=tessara]{--cor:var(--tessara)}[data-r=quorith]{--cor:var(--quorith)}[data-r=vorag]{--cor:var(--vorag)}
.elenco{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:10px}
.elc{display:grid;gap:12px;align-content:start;padding:14px 16px;background:linear-gradient(180deg,color-mix(in srgb,var(--cor) 10%,var(--ink2)),var(--ink1));box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--cor) 35%,transparent);min-width:0}
.elc>header{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}.elc>header b{font:800 1.5rem/1 var(--fd);text-transform:uppercase;letter-spacing:.02em;color:#fff}
.papel{display:grid;gap:6px}.papel .btn{justify-self:start}.row2{display:flex;flex-wrap:wrap;gap:6px}
.racas{display:grid;gap:14px;padding:18px 20px}
.ctrl{display:flex;flex-wrap:wrap;gap:10px 14px;align-items:end}
.ctrl label{display:grid;gap:4px;font:500 .7rem/1.2 var(--fm);letter-spacing:.12em;text-transform:uppercase;color:var(--fg2);min-width:0;flex:1 1 220px}
select{font:500 .92rem/1.2 var(--fb);color:var(--fg);background:var(--ink1);border:1px solid var(--line2);min-height:40px;padding:6px 10px;width:100%;min-width:0}
.rbtns{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}
.rcol{display:grid;gap:6px;align-content:start}
.rb{--cor:var(--fg2);--c:9px;clip-path:polygon(var(--c) 0,100% 0,100% calc(100% - var(--c)),calc(100% - var(--c)) 100%,0 100%,0 var(--c));border:0;text-align:left;padding:10px 12px;min-height:84px;display:grid;align-content:start;gap:4px;background:linear-gradient(180deg,color-mix(in srgb,var(--cor) 14%,var(--ink2)),var(--ink1));box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--cor) 45%,transparent)}
.rb b{font:800 1.2rem/1 var(--fd);text-transform:uppercase;letter-spacing:.03em;color:var(--cor)}.rb small{color:var(--fg2)}
.rb.tocando{background:var(--cor)}.rb.tocando b,.rb.tocando small{color:#0b0d10}
.rb[data-r=vehnar]{--cor:var(--vehnar)}.rb[data-r=erevane]{--cor:var(--erevane)}.rb[data-r=tessara]{--cor:var(--tessara)}.rb[data-r=quorith]{--cor:var(--quorith)}.rb[data-r=vorag]{--cor:var(--vorag)}
.ab{min-height:36px;font-size:.78rem;padding:6px 10px}.ab.var{display:grid;justify-items:start;text-align:left;gap:2px}.btn.rec{box-shadow:inset 0 0 0 1px var(--rift)}.btn.rec.tocando{box-shadow:none}
.h3{font:700 1.2rem/1.1 var(--fd);text-transform:uppercase;letter-spacing:.03em;margin:8px 0 0}tr.rec th{color:var(--rift)}
.idi{display:grid;gap:10px}.idc{padding:12px 14px;background:linear-gradient(180deg,color-mix(in srgb,var(--cor) 9%,var(--ink2)),var(--ink1));box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--cor) 30%,transparent);display:grid;gap:8px;min-width:0}
.idc table td{min-width:190px}.idc td small{margin:4px 0}.idc .row2 .btn{min-height:34px;padding:6px 10px;font-size:.78rem}.idc .row2 .btn small{display:inline;margin-left:4px}
canvas{width:100%;height:64px;display:block;background:var(--void);box-shadow:inset 0 0 0 1px var(--line)}
.aviso{font-size:.84rem;color:var(--warn)}
.tbl{overflow-x:auto;min-width:0}
table{border-collapse:collapse;width:100%;font-variant-numeric:tabular-nums}
th,td{padding:9px 10px;text-align:left;vertical-align:top;border-bottom:1px solid var(--line)}
thead th{font:500 .66rem/1.2 var(--fm);letter-spacing:.12em;text-transform:uppercase;color:var(--fg2);border-bottom:1px solid var(--line2);white-space:nowrap}
tbody th{font-weight:600}.num{text-align:right;white-space:nowrap}.num small{text-align:right}
tr.antes td,tr.antes th{border-bottom:0;padding-bottom:2px}tr.antes td{color:var(--fg2)}tr.depois td{color:#fff}tr.ref td{color:var(--fg2)}
.vn{font:700 1.1rem/1 var(--fd);letter-spacing:.03em;text-transform:uppercase}
tr.rec th .vn{color:var(--rift)}
.pill{display:inline-block;font:600 .7rem/1 var(--fm);letter-spacing:.06em;text-transform:uppercase;padding:4px 6px;margin-bottom:3px;white-space:nowrap}
.pill.ok{color:#0b1a10;background:var(--good)}.pill.risco{color:#1f1600;background:var(--warn)}
tfoot td,tfoot th{font-weight:700;color:#fff;border-bottom:0}
ul{margin:0;padding-left:1.1rem;display:grid;gap:6px;max-width:72ch}
pre{margin:0;padding:12px 14px;background:var(--ink1);box-shadow:inset 0 0 0 1px var(--line);overflow-x:auto;font:400 .74rem/1.5 var(--fm);color:var(--fg2);white-space:pre}
footer{font:400 .76rem/1.5 var(--fm);color:var(--fg3);border-top:1px solid var(--line);padding-top:14px}
@media (max-width:760px){.row{grid-template-columns:minmax(0,1fr)}.vbtns{grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}.vbtns i{display:none}.vb{min-height:44px}.btn{min-height:44px}}
@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
</style>
<div class="wrap">
<header>
  <div class="eyebrow">Aether Rift: Dominion · 5.0a.2 · vozes neurais · 3ª rodada</div>
  <h1>Vozes do Aether Rift</h1>
  <p class="lead">As vozes do Kokoro-82M aprovadas pelo dono, o elenco proposto para os cinco líderes e locutores, o caráter de cada Raça assado nos arquivos (esta página toca exatamente o que o jogo vai tocar) e as primeiras amostras em inglês e espanhol.</p>
</header>

<section class="sec" aria-labelledby="t-dec">
  <div class="plate rec-box">
    <div class="eyebrow" id="t-dec">3ª rodada · 29/10/2026</div>
    <p><b>Vehnar e Tessara aprovados. O Vorag ficou "muito normal": três variantes mais graves abaixo, todas sem ruído; recomendo a C. E a onda de idiomas: amostras em inglês e espanhol para escolher o caminho.</b></p>
    <ul>
      <li><b>Vorag:</b> A (−4 semitons, graves +5 dB), B (−5 semitons, graves +6 dB e mais aspereza) e C (−5 semitons com os formantes 12% abaixo, a voz de corpo grande). Na faixa das Raças e no cartão do Oru Voraz.</li>
      <li><b>Idiomas:</b> as 5 saudações e 2 avisos de locutor em inglês e espanhol, no Kokoro e no Chatterbox Multilingual (a mesma voz do elenco clonada nos três idiomas), já com o caráter da Raça.</li>
      <li><b>Elenco e eco do locutor da Erevane:</b> seguem como propostos, sem comentário do dono.</li>
    </ul>
    <div class="eyebrow">Decisão do dono · 24/10/2026</div>
    <p><b>Kokoro-82M, com Alex como voz-base; Dora e Santa, mais misturas, para os líderes; e o filtro de cada Raça.</b></p>
    <div class="eyebrow">Ajustes da 2ª rodada</div>
    <ul>
      <li><b>Vehnar:</b> a mesma faixa de rádio, sem o chiado e os estalos por baixo da voz e com bem menos saturação; só um clique curto e baixo antes e depois da fala.</li>
      <li><b>Vorag:</b> sem o ruído e com menos grave: 3 semitons abaixo (antes 4) por PSOLA, que não passa por vocoder, graves +3 dB (antes +7), sem a modulação de 38 Hz; a aspereza vem de uma saturação leve, sem ruído.</li>
      <li><b>Tessara:</b> a líder passa a ser Sylvia Oriel, com a voz Dora; as falas 11 e 12 foram gravadas de novo nas seis vozes.</li>
      <li><b>Elenco</b> proposto abaixo, para o dono confirmar.</li>
      <li><b>O caráter da Raça vai assado na geração</b> (arquivos por Raça), sem filtro ao vivo no jogo: sai igual em todo navegador e não custa nada na partida.</li>
    </ul>
    <div class="acts"><button class="btn prim" type="button" data-todas="${esc(base.id)}">Ouvir as 12 com ${esc(CURTO[base.id])}</button><button class="btn" type="button" data-parar>Parar</button></div>
  </div>
</section>

<section class="sec" aria-labelledby="t-elenco">
  <header><div class="eyebrow">Elenco · para confirmar</div><h2 id="t-elenco">Uma voz para cada líder e cada locutor</h2>
  <p class="muted">Cada líder lê a sua saudação da Sala de Comando e cada locutor lê dois avisos, já com o caráter da Raça. As misturas somam os estilos das vozes do Kokoro com os pesos indicados; a velocidade muda o ritmo.</p></header>
  <div class="elenco">${RACAS.map(cartaElenco).join('')}</div>
</section>

<section class="sec" aria-labelledby="t-racas">
  <header><div class="eyebrow">Caráter das Raças</div><h2 id="t-racas">O mesmo áudio, cinco Raças</h2>
  <p class="muted">Arquivos assados na geração (tools/vozes/racas.py), nas três vozes do Kokoro. O Vehnar e o Vorag têm também o antes (a cadeia ao vivo da página anterior, na voz Alex) para comparar.</p></header>
  <div class="plate racas">
    <div class="ctrl"><label>Voz<select id="r-voz"><option value="padrao" selected>Padrão: Alex (Tessara com a Dora)</option>${RC.vozes.map(v => `<option value="kokoro-${v}">${VNOME[v]}</option>`).join('')}</select></label>
      <label>Fala<select id="r-fala">${RC.linhas.map(L => `<option value="${L}"${L === '10-barao-forja-2' ? ' selected' : ''}>${esc((man.falas.find(f => f.id === L) || {}).texto || L)}</option>`).join('')}</select></label></div>
    <div class="rbtns">${RACA_INFO.map(([id, nome, desc]) => `<div class="rcol"><button class="rb" type="button" data-r="${id}"><b>${esc(nome)}</b><small>${esc(desc)}</small></button>${id === 'vehnar' || id === 'vorag' ? `<button class="btn ab" type="button" data-antes="${id}">Ouvir o antes (Alex)</button>` : ''}${id === 'vorag' ? VAR.map(v => `<button class="btn ab var${v === VREC ? ' rec' : ''}" type="button" data-rv="${v}" data-r="vorag">${esc(VDESC[v].split(':')[0])}${v === VREC ? ' · recomendada' : ''}<small>${esc(VDESC[v].split(': ')[1])}</small></button>`).join('') : ''}</div>`).join('')}</div>
    <p class="muted">O botão Vorag toca a versão da 2ª rodada (−3 semitons); os botões A, B e C, as variantes mais graves desta rodada.</p>
    <canvas id="osc" width="1040" height="64" role="img" aria-label="Forma de onda do que está tocando"></canvas>
    <p class="aviso" id="r-aviso" hidden></p>
  </div>
</section>

<section class="sec" aria-labelledby="t-med">
  <header><div class="eyebrow">Medidas · antes e depois</div><h2 id="t-med">Ruído, aspereza e volume</h2>
  <p class="muted">Voz Alex, média das ${RC.linhas.length} falas da faixa, medidas no arquivo final decodificado (o que o jogador ouve). Piso: média dos 10% de quadros de 20 ms mais baixos dentro da fala; piso nas pausas: os mesmos quadros onde a voz seca está calada. Os dois em dB abaixo do nível da própria fala (mais negativo é mais limpo) e, embaixo, a diferença para a voz seca. HNR: razão harmônico/ruído (mais alto é mais limpo). Aspereza: flutuações de 20 a 75 Hz do envelope sobre as das sílabas. Erro: transcrição pelo Whisper.</p></header>
  <div class="tbl"><table><thead><tr><th>Raça</th><th class="num">Nível vs seca</th><th class="num">Pico dBFS</th><th class="num">Piso</th><th class="num">Piso nas pausas</th><th class="num">HNR dB</th><th class="num">Aspereza dB</th><th class="num">Tom</th><th class="num">Erro</th></tr></thead>
  <tbody><tr class="ref"><th scope="row">Voz seca<small>referência (Alex, Opus 32 kbps)</small></th><td class="num">—</td><td class="num">${n1(seco.pico_db)}</td><td class="num">${n1(seco.piso_rel_db)}</td><td class="num">${n1(seco.piso_pausas_rel_db)}</td><td class="num">${n1(seco.hnr_db)}</td><td class="num">${n1(seco.aspereza_db)}</td><td class="num">${n0(seco.f0_hz)} Hz</td><td class="num">${n1(seco.cer * 100)}%</td></tr>
  ${RACAS.map(r => linhaAD(r, 'antes', 'antes: ao vivo (v1)') + linhaAD(r, 'depois', r === 'vorag' ? 'depois: 2ª rodada, −3 semitons' : 'depois: assado') + (r === 'vorag' ? VAR.map(v => linhaAD(v, 'depois', 'variante ' + VDESC[v])).join('') : '')).join('')}</tbody></table></div>
  <h3 class="h3">Vorag: as três variantes nas 12 falas da faixa (Dora, Alex e Santa)</h3>
  <div class="tbl"><table><thead><tr><th>Versão</th><th class="num">Pausas vs seca</th><th class="num">Pior fala</th><th class="num">HNR vs seca</th><th class="num">Aspereza vs seca</th><th class="num">Tom</th><th class="num">Nível vs seca</th><th class="num">Pico máx.</th><th class="num">Erro</th></tr></thead>
  <tbody><tr class="ref"><th scope="row">v1 ao vivo<small>a que o dono achou com ruído (voz Alex)</small></th><td class="num">${sinal(V12antes.pausas)} dB</td><td class="num">—</td><td class="num">—</td><td class="num">—</td><td class="num">—</td><td class="num">—</td><td class="num">—</td><td class="num">—</td></tr>
  ${['vorag', ...VAR].map(v => { const x = V12[v]; return `<tr class="${v === VREC ? 'rec' : ''}"><th scope="row">${v === 'vorag' ? '2ª rodada' : esc(VDESC[v].split(':')[0])}${v === VREC ? ' · recomendada' : ''}<small>${v === 'vorag' ? '−3 semitons, graves +3 dB' : esc(VDESC[v].split(': ')[1])}</small></th><td class="num">${sinal(x.pausas)} dB</td><td class="num">${sinal(x.pausasMax)} dB</td><td class="num">${sinal(x.hnr)} dB</td><td class="num">${sinal(x.asp)} dB</td><td class="num">${n0(x.f0)} Hz<small>${sinal(x.st)} semitons</small></td><td class="num">${sinal(x.nivel)} dB</td><td class="num">${n1(x.picoMax)} dBFS</td><td class="num">${n1(x.cer * 100)}%<small>seca ${n1(x.cerSeco * 100)}%</small></td></tr>`; }).join('')}</tbody></table></div>
  <p class="muted">Recomendação: a <b>C</b>. É a mais grave (5 semitons abaixo) e a única com corpo de voz grande (formantes mais baixos), com as pausas mais limpas das três e a mesma clareza da voz seca na transcrição. A B soa mais áspera, mas a saturação a mais levanta as partes baixas da fala. Nenhuma das três volta perto do ruído da v1.</p>
</section>

${idiomasHTML()}
<section class="sec" aria-labelledby="t-mesa">
  <header><div class="eyebrow">Mesa de escuta</div><h2 id="t-mesa">12 falas, ${cands.length} vozes</h2>
  <p class="muted">As vozes secas, sem caráter de Raça. Cada botão toca a fala naquela voz; Kokoro à esquerda, Piper à direita. O ponto amarelo marca onde a transcrição ouviu algo diferente do texto.</p></header>
  <div class="legend">${cands.map(c => `<div class="vchip${c.id === base.id ? ' rec' : ''}"><b>${esc(CURTO[c.id])}</b><small>${esc(c.modelo)} · ${genero(c)}</small><small>${c.licenca.uso_comercial === 'sim' ? 'livre para uso comercial' : 'risco para uso comercial'}</small><button class="btn" type="button" data-todas="${esc(c.id)}">Ouvir as 12</button></div>`).join('')}</div>
  <div class="grid" id="mesa"></div>
</section>

<section class="sec" aria-labelledby="t-num">
  <header><div class="eyebrow">Números</div><h2 id="t-num">Modelo, licença, tamanho e tempo</h2>
  <p class="muted">Tamanho: as 12 falas juntas (${n1(Math.min(...cands.map(c => c.audio_s)), 1)} a ${n1(Math.max(...cands.map(c => c.audio_s)), 1)} s de fala) em OGG/Opus 32 kbps, mono. Tempo para gerar: carga do modelo + síntese das 12 falas, em ${esc(man.maquina)}, com a máquina dividida com outros agentes. Conferência: ${esc(man.conferencia || 'não feita')}.</p></header>
  <div class="tbl"><table><thead><tr><th>Voz</th><th>Modelo</th><th>Licença</th><th class="num">Tom médio</th><th class="num">Modelo</th><th class="num">12 falas (Opus)</th><th class="num">Tempo para gerar</th><th class="num">Transcrição</th></tr></thead>
  <tbody>${cands.map(linhaVoz).join('')}</tbody></table></div>
  <details><summary class="muted">Licenças em detalhe e modelos descartados</summary><ul style="margin-top:10px">${[...new Map(cands.map(c => [c.licenca.resumo, c])).values()].map(c => `<li><b>${esc(c.modelo)}</b>: ${esc(c.licenca.detalhe)}</li>`).join('')}<li><b>praat-parselmouth e scipy</b> (caráter das Raças, só na máquina de build): GPL-3.0 (o Praat, que faz o PSOLA do Vorag; não vai no jogo) e BSD-3. O pyworld (MIT, vocoder WORLD) foi medido para o Vorag e ficou de fora.</li>${man.descartadas.map(d => `<li><b>${esc(d.modelo)}</b>, descartado: ${esc(d.motivo)}.</li>`).join('')}</ul></details>
</section>

<section class="sec" aria-labelledby="t-plano">
  <header><div class="eyebrow">Plano da implantação</div><h2 id="t-plano">${n0(plano.total.n)} falas, ${n1(plano.total.kb24 / 1024)} MB em Opus</h2>
  <p class="muted">Contas com a velocidade medida na voz Alex (${n1(cps)} caracteres por segundo), o tamanho medido nos arquivos daqui (Opus 24 kbps: ${n0(A24.a)} bytes por arquivo + ${n0(A24.b)} bytes por segundo de fala) e o fator de cada Raça medido nos arquivos assados (cauda do eco e da sala, estéreo do Quorith): ${RACAS.map(r => NOME_RACA[r] + ' ' + n1(FATOR[r], 2) + '×').join(', ')}.</p></header>
  <div class="tbl"><table><thead><tr><th>Tipo</th><th class="num">Por Raça</th><th class="num">Total</th><th class="num">Duração</th><th class="num">Opus 24 kbps</th><th class="num">Opus 32 kbps</th></tr></thead>
  <tbody>${tipos.map(linhaPlano).join('')}<tr><th scope="row">Campanha (${plano.campanha.missoes} missões)<small>${plano.campanha.fixas} falas fixas: ${plano.campanha.self} do próprio líder (gravadas nas 5 vozes), ${plano.campanha.enemy} do inimigo (nas 5) e ${plano.campanha.raca} de Raça fixa; ${plano.campanha.fn} dinâmica fica na voz do sistema</small></th><td class="num">—</td><td class="num">${plano.campanha.n}</td><td class="num">${n1(plano.campanha.dur / 60)} min</td><td class="num">${n0(plano.campanha.kb24)} KB</td><td class="num">${n0(plano.campanha.kb32)} KB</td></tr></tbody>
  <tfoot><tr><th scope="row">Total</th><td class="num">${porRaca.n}</td><td class="num">${n0(plano.total.n)}</td><td class="num">${n1(plano.total.dur / 60)} min</td><td class="num">${n0(plano.total.kb24)} KB</td><td class="num">${n0(plano.total.kb32)} KB</td></tr></tfoot></table></div>
  <ul>
    <li><b>Caráter assado:</b> cada Raça tem o seu pacote de arquivos já com o caráter (rádio, eco, calor, coro, grave). O jogo só toca o arquivo, sem cadeia de efeitos ao vivo.</li>
    <li><b>Carga preguiçosa por Raça:</b> a partida baixa só o pacote da Raça do jogador (${porRaca.n} arquivos pequenos, de ${n0(Math.min(...RACAS.map(r => pacote[r])))} KB a ${n0(Math.max(...RACAS.map(r => pacote[r])))} KB em Opus 24 kbps conforme a Raça) depois que a tela de carregamento termina, em tempo ocioso; a Sala baixa só a saudação do líder em destaque; a campanha baixa as falas da missão ao abri-la. Os bytes comprimidos ficam na memória e cada fala vira AudioBuffer só ao tocar pela primeira vez (cache das mais usadas). O service worker guarda os arquivos para jogar sem internet.</li>
    <li><b>Falas com números e nomes dinâmicos</b> (nome de jogador no multiplayer, "Pesquisa concluída: …" com o nome da pesquisa, contagens acima de 3, a fala dinâmica da campanha) continuam na voz do sistema, com a escolha da 5.0a.2. Sem o arquivo carregado, sem rede na primeira vez ou com "Vozes gravadas" desligado em Ajustes, toda fala cai na voz do sistema, então nenhum arquivo é obrigatório.</li>
    <li><b>Legendas e boca do líder:</b> a fala gravada dispara o mesmo evento 'ard-voz' (início, palavra, fim), com o tempo de cada palavra medido na geração pela transcrição, e a mesma legenda de hoje.</li>
    <li><b>Registro no ASSETS.md</b> (linhas propostas):</li>
  </ul>
  <pre>${assetsRows}</pre>
</section>

<footer>Gerado por tools/vozes/gerar.py, tools/vozes/racas.py e tools/vozes/pagina.mjs · mesa em ${esc(man.gerado)}, Raças em ${esc(RC.gerado)}, elenco em ${esc(EL.gerado)} · ${esc(man.maquina)} · Python ${esc(man.python)}, kokoro ${esc(man.pacotes.kokoro)}, torch ${esc(man.pacotes.torch)}. Áudios em OGG/Opus (32 kbps mono; 48 kbps estéreo no Quorith), com MP3 para navegadores sem Opus, na pasta vozes/ ao lado desta página.</footer>
</div>
<script type="application/json" id="dados">${JSON.stringify(dados).replace(/</g, '\\u003c')}</script>
<script>
(function () {
'use strict';
const D = JSON.parse(document.getElementById('dados').textContent);
const EXT = (function () { try { const a = document.createElement('audio'); if (a.canPlayType && a.canPlayType('audio/ogg; codecs=opus')) return 'ogg'; } catch (e) {} return 'mp3'; })();
/* mesa: uma linha por fala, um botão por voz */
const mesa = document.getElementById('mesa'); const TIPO = { aviso: 'Aviso', unidade: 'Unidade', lider: 'Líder' };
mesa.innerHTML = D.falas.map(f => '<div class="row" data-tipo="' + f.tipo + '"><div class="tx"><small>' + TIPO[f.tipo] + ' · ' + f.quem + '</small><q>' + f.texto + '</q></div><div class="vbtns">' +
  D.vozes.map((v, i) => { const x = v.falas[f.id] || {}; const dif = x.cer != null && x.cer > 0.12; return (i === 3 ? '<i></i>' : '') + '<button class="vb' + (v.id === D.base ? ' rec' : '') + '" type="button" data-arq="vozes/' + v.id + '/' + f.id + '" title="' + v.curto + ' · ' + (x.d ? x.d.toFixed(1).replace('.', ',') + ' s' : '') + (x.asr ? ' · a transcrição ouviu: ' + x.asr.replace(/"/g, '') : '') + '" aria-label="Ouvir ' + v.curto + ': ' + f.texto.replace(/"/g, '') + '">' + v.curto + (dif ? '<span class="dif" aria-hidden="true"></span>' : '') + '</button>'; }).join('') + '</div></div>').join('');
/* motor de áudio: um AudioContext e um analisador para o osciloscópio; o arquivo já vem com o caráter da Raça */
let AC = null, an = null, seq = 0, atual = null; const cache = new Map();
function ctx() { if (!AC) { const C = window.AudioContext || window.webkitAudioContext; AC = new C(); an = AC.createAnalyser(); an.fftSize = 2048; an.connect(AC.destination); } if (AC.state === 'suspended') AC.resume(); return AC; }
function buf(arq) { if (cache.has(arq)) return cache.get(arq); const c = ctx(); const p = fetch(arq + '.' + EXT).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); }).then(b => new Promise((res, rej) => c.decodeAudioData(b, res, rej))); cache.set(arq, p); p.catch(() => cache.delete(arq)); return p; }
function marca(el, on) { if (el) el.classList.toggle('tocando', on); }
function parar() { seq++; if (atual) { try { atual.parar(); } catch (e) {} atual = null; } document.querySelectorAll('.tocando').forEach(x => x.classList.remove('tocando')); }
function tocar(arq, el) {
  parar(); const meu = seq; marca(el, true);
  return new Promise(fim => {
    buf(arq).then(b => {
      if (meu !== seq) return fim(false); const c = ctx(); const src = c.createBufferSource(); src.buffer = b; src.connect(an); const t0 = c.currentTime + 0.03; src.start(t0);
      const tm = setTimeout(() => { if (meu === seq) { atual = null; marca(el, false); } fim(true); }, (t0 - c.currentTime + b.duration) * 1000 + 40);
      atual = { parar() { clearTimeout(tm); try { src.stop(); } catch (e) {} fim(false); } }; desenha();
    }).catch(() => { /* sem fetch (arquivo aberto do disco): toca pelo elemento de áudio */
      if (meu !== seq) return fim(false); const a = new Audio(arq + '.' + EXT); a.onended = () => { marca(el, false); fim(true); }; a.onerror = () => { marca(el, false); fim(false); }; a.play().catch(() => { marca(el, false); fim(false); });
      atual = { parar() { a.pause(); fim(false); } }; });
  });
}
let lista = 0; /* "Ouvir as 12": qualquer outro clique encerra a sequência */
async function todas(v) { const minha = ++lista; for (const f of D.falas) { if (minha !== lista) return; const arq = 'vozes/' + v + '/' + f.id; const el = document.querySelector('.vb[data-arq="' + arq + '"]'); const ok = await tocar(arq, el); if (!ok || minha !== lista) return; await new Promise(r => setTimeout(r, 380)); } }
/* faixa das Raças: arquivo assado da Raça na voz escolhida (padrão: Alex; Tessara com a Dora) */
function arqRaca(r) { const sel = document.getElementById('r-voz').value, L = document.getElementById('r-fala').value; const v = sel === 'padrao' ? (D.racas.padrao[r] || D.base) : sel; return r === 'seco' ? 'vozes/' + v + '/' + L : 'vozes/racas/' + r + '/' + v + '/' + L; }
/* osciloscópio */
const cv = document.getElementById('osc'), g2 = cv.getContext('2d'); let raf = 0;
function ajusta() { const r = cv.getBoundingClientRect(), d = window.devicePixelRatio || 1, w = Math.max(1, Math.round(r.width * d)), h = Math.max(1, Math.round(r.height * d)); if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; } return d; } /* resolução do canvas = tamanho na tela */
function repouso() { const d = ajusta(); g2.clearRect(0, 0, cv.width, cv.height); g2.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--fg3'); g2.font = '500 ' + Math.round(12 * d) + 'px "IBM Plex Mono", monospace'; g2.textAlign = 'center'; g2.textBaseline = 'middle'; g2.fillText('toque uma Raça para ouvir e ver a onda', cv.width / 2, cv.height / 2); }
repouso(); if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (!raf) repouso(); }); addEventListener('resize', () => { if (!raf) repouso(); });
function desenha() { if (raf || !an) return; const arr = new Uint8Array(an.fftSize); const cor = () => { const b = document.querySelector('.tocando[data-r]'); return b ? getComputedStyle(b).getPropertyValue('--cor') || '#ECE6DA' : getComputedStyle(document.documentElement).getPropertyValue('--fg2'); };
  const passo = () => { const d = ajusta(); an.getByteTimeDomainData(arr); g2.clearRect(0, 0, cv.width, cv.height); g2.strokeStyle = cor(); g2.lineWidth = 2 * d; g2.beginPath(); for (let i = 0; i < arr.length; i++) { const x = i / (arr.length - 1) * cv.width, y = arr[i] / 255 * cv.height; i ? g2.lineTo(x, y) : g2.moveTo(x, y); } g2.stroke(); raf = document.querySelector('.tocando') ? requestAnimationFrame(passo) : 0; if (!raf) repouso(); };
  raf = requestAnimationFrame(passo); }
/* eventos */
document.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (!b.hasAttribute('data-todas')) lista++;
  if (b.classList.contains('tocando')) return parar();
  if (b.matches('.rb')) tocar(arqRaca(b.dataset.r), b);
  else if (b.hasAttribute('data-antes')) tocar('vozes/racas-antes/' + b.dataset.antes + '/' + document.getElementById('r-fala').value, b);
  else if (b.hasAttribute('data-rv')) tocar(arqRaca(b.dataset.rv), b); /* 3ª rodada: variantes do Vorag */
  else if (b.hasAttribute('data-arq')) tocar(b.dataset.arq, b);
  else if (b.hasAttribute('data-todas')) todas(b.dataset.todas);
  else if (b.hasAttribute('data-parar')) parar();
});
window.__vozes = { tocar, parar, arqRaca, ext: EXT, ctx: () => AC };
})();
</script>
`;
writeFileSync(root + 'work/vozes-escolha.html', html);
console.log('página: work/vozes-escolha.html · base ' + base.id + ' · fatores ' + RACAS.map(r => r + ' ' + FATOR[r].toFixed(2)).join(', ') + ' · plano: ' + plano.total.n + ' falas, ' + Math.round(plano.total.kb24) + ' KB (Opus 24k), ' + Math.round(plano.total.kb32) + ' KB (Opus 32k); pacote por Raça ' + RACAS.map(r => Math.round(pacote[r])).join('/') + ' KB');

/* ---------- mapa de publicação: files (para atualizar a mesma URL: só o que mudou, com null nos caminhos que saíram) e files_completo ---------- */
const comp = {}; const add = rel => { for (const ext of ['ogg', 'mp3']) comp['vozes/' + rel + '.' + ext] = root + 'work/vozes/' + rel + '.' + ext; };
for (const c of cands) for (const f of c.falas) add(c.id + '/' + f.id);
for (const r of RACAS) for (const v of RC.vozes) for (const L of RC.linhas) add('racas/' + r + '/kokoro-' + v + '/' + L);
for (const r of ['vehnar', 'vorag']) for (const L of RC.linhas) add('racas-antes/' + r + '/' + L);
for (const r of RACAS) { add('elenco/' + r + '-lider'); for (const x of EL.racas[r].locutor_falas) add('elenco/' + r + '-locutor-' + x.id); }
for (const r of VAR) { for (const v of RC.vozes) for (const L of RC.linhas) add('racas/' + r + '/kokoro-' + v + '/' + L); if (EL.racas[r]) { add('elenco/' + r + '-lider'); for (const x of EL.racas[r].locutor_falas) add('elenco/' + r + '-locutor-' + x.id); } } /* 3ª rodada */
if (IDI) for (const [mod, por] of Object.entries(IDI.itens)) for (const [lg, its] of Object.entries(por)) for (const n of Object.keys(its)) add('idiomas/' + mod + '/' + lg + '/' + n);
/* diferença com o que a v2 publicou (work/antes/vozes-publicar-v2.json): caminhos novos, arquivos mexidos depois daquela publicação e null no que saiu */
const { statSync } = await import('node:fs'); const v2p = root + 'work/antes/vozes-publicar-v2.json'; const v2 = JSON.parse(readFileSync(v2p, 'utf8')).files_completo; const t2 = statSync(v2p).mtimeMs; const delta = {};
for (const [k, v] of Object.entries(comp)) if (!(k in v2) || statSync(v).mtimeMs > t2) delta[k] = v;
for (const k of Object.keys(v2)) if (!(k in comp)) delta[k] = null;
writeFileSync(root + 'work/vozes-publicar.json', JSON.stringify({ pagina: root + 'work/vozes-escolha.html', url: 'https://claude.ai/artifact/B3wjDoj33LSgJzeQ129dCb', titulo: 'Vozes do Aether Rift', icone: 'audio',
  descricao: 'As vozes do Kokoro aprovadas pelo dono, o elenco, o caráter de cada Raça assado nos arquivos, três variantes mais graves do Vorag e as amostras em inglês e espanhol (Kokoro e Chatterbox) para a onda de idiomas.',
  nota: 'files = só o que mudou desde a v2 publicada (caminhos novos e arquivos mexidos depois dela; null no que saiu), para atualizar a mesma url; files_completo = todos os arquivos, para uma publicação nova (passa de 255: em mais de uma vez).',
  arquivos: Object.values(delta).filter(Boolean).length, removidos: Object.values(delta).filter(x => x === null).length, files: delta, arquivos_completo: Object.keys(comp).length, files_completo: comp }, null, 1));
console.log('publicação: ' + Object.values(delta).filter(Boolean).length + ' arquivos novos ou trocados + ' + Object.values(delta).filter(x => x === null).length + ' removidos (completo: ' + Object.keys(comp).length + ')');
