/* Aether Rift: Dominion — carregador dos modelos feitos no Blender (formato .otb, próprio do jogo). 5.5b.3: o carregador (piloto);
   5.5b.4: ligado ao jogo — um pacote por Raça em assets/modelos/ (gzip), a tabela id do jogo -> receita otb_ e a volta aos modelos de antes.
   Um pacote .otb traz um ou mais modelos, cada um com a versão cheia e a leve. Cada modelo é uma lista de partes; cada parte tem posições em
   16 bits (dentro da caixa do modelo), normais em 2 bytes, cor em 3 bytes (sRGB, com a sombra de contato já gravada), o peso da cor do time
   em 1 byte, índices em 16 bits e, no cabeçalho (JSON), rugosidade/metal/padrão, a força da emissão (parte acesa), o grupo de animação com
   pivô (os mesmos tipos do construtor: leg, recoil, sway, bob, spin, flap) e o pivô da peça que se solta na destruição. Opcionais por modelo
   (5.5b.4): mt = altura do assento da parte que gira (o K.mount das receitas de hoje), beam = [x, y, z] do emissor do feixe, base = altura do chão.
   Cada modelo vira uma receita em ARD.meshes.receitas com o nome do pacote (otb_...), montada com o MESMO construtor (Kit) das malhas de
   hoje: mesmo material, mesmas instâncias, mesma animação na GPU, nos dois motores. Nenhum material, textura ou pipeline novo.
   5.5b.4 — como entra no jogo:
   - a tabela (assets/modelos/tabela.json, gerada por tools/otb-pacote.mjs e posta aqui pelo tools/build.mjs no lugar do marcador abaixo) diz, por
     Raça, o arquivo do pacote e o mapa id do jogo -> receita otb_ (texto, ou { r, s: { pele: receita }, mt, beam, base });
   - ARD.otb.partida(sim, progresso) é chamada pelo R.prepare do src/render3d.js na tela de carregamento: pede só os pacotes das Raças da
     partida, antes de montar os modelos; pacote que falta, falha ou vem estragado = a Raça fica com os modelos de antes, sem erro na tela;
   - o recipe() do src/meshes.js pergunta a ARD.otb.receita(raça, id): com o pacote da Raça instalado, devolve a receita nova (cheia ou leve
     conforme o K.lite que o jogo já decide pela qualidade e pela distância); sem pacote, null e vale a receita de antes;
   - ?modelos=antigos volta aos modelos de antes (nada é pedido nem instalado). Os modelos são só desenho: a simulação não lê nada daqui. */
(function (ARD) {
'use strict';
const CFG_TXT = '__MODELOS__'; let CFG = null; try { if (CFG_TXT.charAt(0) === '{') CFG = JSON.parse(CFG_TXT); } catch (e) { CFG = null; } /* 5.5b.4: { base, racas: { raça: { arquivo, hash, gzip, cru, mapa } }, emb: { raça: pacote em base64 } }, posto pelo tools/build.mjs; sem o build (testes no Node, galerias) fica null e ARD.otb.config() liga */
const ANTIGOS = (() => { try { return /[?&]modelos=antigos(&|$)/.test(globalThis.location ? globalThis.location.search : ''); } catch (e) { return false; } })(); /* 5.5b.4: ?modelos=antigos */
const PRONTAS = {}; /* 5.5b.4: raça -> mapa id do jogo -> receita, só das Raças com o pacote instalado */ const PEDIDOS = {}; /* raça -> promessa do pedido (um por Raça) */ const ESTADO = {}; /* raça -> 'ok' | 'falhou: motivo' | 'antigos' (diagnóstico e testes) */ const MED = { bytes: 0, ms: 0, pacotes: 0 }; /* o que a carga baixou e quanto levou para instalar */
const MODELOS = {}; /* nome -> { caixa, tri, lods: { cheia: [partes], leve: [partes] }, bin } */
const LIN = new Float32Array(256); for (let i = 0; i < 256; i++) { const c = i / 255; LIN[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); } /* sRGB de 8 bits -> linear */
/* decodifica uma parte uma vez só (posição, normal e índice não mudam com a cor do time) */
function abre(m, p) {
  if (p._pos) return; const nv = p.nv, cx = m.caixa, bin = m.bin; let o = p.o;
  const q = new Uint16Array(bin.slice(o, o + nv * 6)); o += nv * 6; const pos = new Float32Array(nv * 3);
  for (let i = 0, a = [0, 0, 0]; i < nv; i++) for (let k = 0; k < 3; k++) { const z = q[i * 3 + k]; a[k] = (a[k] + ((z >>> 1) ^ -(z & 1))) & 65535; pos[i * 3 + k] = cx[k] + a[k] / 65535 * cx[3 + k]; } /* cada posição vem como diferença para o vértice anterior (zigue-zague): comprime muito melhor */
  const on = new Int8Array(bin.slice(o, o + nv * 2)); o += nv * 2; const nor = new Float32Array(nv * 3);
  for (let i = 0; i < nv; i++) { let x = on[i * 2] / 127, y = on[i * 2 + 1] / 127; const z = 1 - Math.abs(x) - Math.abs(y); if (z < 0) { const ox = x; x = (1 - Math.abs(y)) * (ox >= 0 ? 1 : -1); y = (1 - Math.abs(ox)) * (y >= 0 ? 1 : -1); } const l = Math.hypot(x, y, z) || 1; nor[i * 3] = x / l; nor[i * 3 + 1] = y / l; nor[i * 3 + 2] = z / l; } /* normal em octaedro */
  const cor = new Uint8Array(bin.slice(o, o + nv * 3)); o += nv * 3; for (let i = 3; i < nv * 3; i++) cor[i] = (cor[i] + cor[i - 3]) & 255; p._cor = cor; /* cor também em diferenças */ p._tc = p.tc ? new Uint8Array(bin.slice(o, o + nv)) : null; if (p.tc) o += nv;
  const idx = new Uint16Array(bin.slice(o, o + p.ni * 2)); for (let i = 0, alto = 0; i < p.ni; i++) { const k = alto - idx[i]; if (k === alto) alto++; idx[i] = k; } /* índice = distância ao último vértice novo */ p._idx = idx; p._pos = pos; p._nor = nor;
}
/* monta o modelo no construtor do jogo (K = Kit do src/meshes.js): uma peça por parte, com a animação e a peça solta do cabeçalho */
function monta(K, m, tc, ex) {
  const T = globalThis.THREE; { const mt = ex && ex.mt != null ? ex.mt : m.mt, bm = ex && ex.beam ? ex.beam : m.beam, bs = ex && ex.base != null ? ex.base : m.base; if (mt != null) K.mount = mt + K.oy; if (bm) K.beam = [bm[0] + K.ox, bm[1] + K.oy, bm[2] + K.oz]; if (bs != null) K.base = bs; } /* 5.5b.4: assento da parte que gira, emissor do feixe e altura do chão, como nas receitas de hoje */ const lod = K.lite && m.lods.leve && m.lods.leve.length ? m.lods.leve : m.lods.cheia; const t = new T.Color(tc || '#FFFFFF');
  for (const p of lod) { abre(m, p); const nv = p.nv, cor = new Float32Array(nv * 3), c8 = p._cor, w8 = p._tc;
    for (let i = 0; i < nv; i++) { const r = LIN[c8[i * 3]], g = LIN[c8[i * 3 + 1]], b = LIN[c8[i * 3 + 2]]; if (w8 && w8[i]) { const w = w8[i] / 255; cor[i * 3] = r * (1 + (t.r - 1) * w); cor[i * 3 + 1] = g * (1 + (t.g - 1) * w); cor[i * 3 + 2] = b * (1 + (t.b - 1) * w); } else { cor[i * 3] = r; cor[i * 3 + 1] = g; cor[i * 3 + 2] = b; } } /* cor do time: tinge só onde o peso manda, e a sombra gravada continua */
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(p._pos.slice(), 3)); g.setAttribute('normal', new T.BufferAttribute(p._nor.slice(), 3)); g.setAttribute('color', new T.BufferAttribute(cor, 3)); g.setIndex(new T.BufferAttribute(p._idx, 1));
    const o = { pat: p.pat || 0 }; if (p.e) o.e = p.e; if (p.an) o.anim = p.an;
    if (p.pc) K.piece(p.pc, () => K._push(g, '#FFFFFF', p.rm, o)); else K._push(g, '#FFFFFF', p.rm, o); }
}
/* instala um pacote .otb (ArrayBuffer ou Uint8Array, já sem compressão): registra uma receita por modelo e devolve os nomes */
function instala(buf) {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf); if (u8.length < 8 || u8[0] !== 79 || u8[1] !== 84 || u8[2] !== 66 || u8[3] !== 49) throw new Error('pacote .otb inválido'); /* 'OTB1' */
  const n = (u8[4] | u8[5] << 8 | u8[6] << 16 | u8[7] << 24) >>> 0; if (n < 2 || 8 + n > u8.length) throw new Error('pacote .otb cortado (cabeçalho)'); const cab = JSON.parse(new TextDecoder().decode(u8.subarray(8, 8 + n))); if (cab.v !== 2) throw new Error('versão do .otb não suportada: ' + cab.v);
  const bin = u8.buffer.slice(u8.byteOffset + 8 + n, u8.byteOffset + u8.length); const nomes = [], novos = {};
  /* 5.5b.4: confere o pacote inteiro ANTES de registrar qualquer receita (um pacote cortado ou estragado não pode deixar a Raça com metade dos modelos) */
  for (const nome in cab.modelos) { const m = cab.modelos[nome]; if (!m || !Array.isArray(m.caixa) || m.caixa.length !== 6 || !m.caixa.every(Number.isFinite) || !m.lods || !Array.isArray(m.lods.cheia) || !m.lods.cheia.length) throw new Error('pacote .otb estragado: ' + nome);
    const o0 = m.o != null ? m.o : 0, nb = m.o != null ? m.nb : bin.byteLength; if (!(o0 >= 0) || !(nb > 0) || o0 + nb > bin.byteLength) throw new Error('pacote .otb cortado: ' + nome);
    for (const k of ['cheia', 'leve']) for (const p of m.lods[k] || []) { const fim = p.o + p.nv * (11 + (p.tc ? 1 : 0)) + p.ni * 2; if (!(p.nv > 0) || !(p.ni > 0) || p.ni % 3 || !(p.o >= 0) || fim > nb || !Array.isArray(p.rm)) throw new Error('pacote .otb estragado: ' + nome + ' (' + k + ')'); }
    m.bin = m.o != null ? bin.slice(m.o, m.o + m.nb) : bin; for (const k of ['cheia', 'leve']) for (const p of m.lods[k] || []) { abre(m, p); for (let i = 0; i < p._idx.length; i++) if (p._idx[i] >= p.nv) throw new Error('pacote .otb estragado: índice fora da parte em ' + nome); } /* decodifica já: índice que aponta para fora da parte também é pacote estragado */
    novos[nome] = m; }
  if (ARD.meshes && !ARD.meshes.receitas) ARD.meshes.receitas = {}; const RX = ARD.meshes ? ARD.meshes.receitas : null;
  for (const nome in novos) { const m = novos[nome]; MODELOS[nome] = m; nomes.push(nome); if (RX) RX[nome] = (K, P, tc) => monta(K, m, tc); }
  return nomes;
}
function deB64(s) { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
async function abreGzip(u8) { if (u8[0] === 0x1f && u8[1] === 0x8b) u8 = new Uint8Array(await new Response(new Blob([u8]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()); return u8; }
/* pede um pacote pela rede (mesma origem do jogo) e instala; aceita o arquivo comprimido em gzip (o navegador descomprime com DecompressionStream).
   aoBaixar(recebido, total) conta os bytes para a barra da tela de carregamento. */
async function carrega(url, aoBaixar) {
  const r = await fetch(url); if (!r.ok) throw new Error('pacote .otb: ' + r.status); let u8;
  if (aoBaixar && r.body && r.body.getReader) { const tot = +r.headers.get('content-length') || 0, rd = r.body.getReader(), ps = []; let n = 0; for (;;) { const { done, value } = await rd.read(); if (done) break; ps.push(value); n += value.length; aoBaixar(n, tot); } u8 = new Uint8Array(n); let o = 0; for (const p of ps) { u8.set(p, o); o += p.length; } }
  else u8 = new Uint8Array(await r.arrayBuffer());
  MED.bytes += u8.length; return instala(await abreGzip(u8));
}
/* ---------- 5.5b.4: a tabela e a troca ---------- */
function config(c) { CFG = c || null; return api; } /* testes e galerias: liga a tabela sem o build ({ base, racas, emb }) */
function tabela(race) { return CFG && CFG.racas && CFG.racas[race] ? CFG.racas[race] : null; }
function entrada(race, def) { const mp = PRONTAS[race]; const e = mp ? mp[def] : null; return e ? (typeof e === 'string' ? { r: e } : e) : null; }
/* a receita nova de uma peça (ou null = vale a de antes). O src/meshes.js chama a cada montagem; seed = a pele (o Núcleo tem três) */
function receita(race, def) { if (ANTIGOS) return null; const e = entrada(race, def); if (!e) return null; if (!MODELOS[e.r]) return null;
  return (K, P, tc, seed) => { const n = e.s && e.s[seed | 0] && MODELOS[e.s[seed | 0]] ? e.s[seed | 0] : e.r; monta(K, MODELOS[n], tc, e); }; }
/* marca a Raça como pronta: só entram no mapa as peças cuja receita veio mesmo no pacote (o resto continua com o modelo de antes) */
function pronta(race, nomes) { const t = tabela(race), mp = {}; let n = 0; for (const def in (t && t.mapa) || {}) { const e = t.mapa[def], r = typeof e === 'string' ? e : e && e.r; if (r && MODELOS[r]) { mp[def] = e; n++; } } if (!n) throw new Error('nenhuma receita da tabela veio no pacote'); PRONTAS[race] = mp; ESTADO[race] = 'ok'; MED.pacotes++; return true; }
/* a cópia que o service worker guardou (cache 'ard-modelos'), sem pedir nada à rede; null se não há */
async function guardado(url) { if (typeof caches === 'undefined') return null; const c = await caches.open('ard-modelos'), r = await c.match(url); if (!r || !r.ok) return null; return instala(await abreGzip(new Uint8Array(await r.arrayBuffer()))); }
/* pede o pacote de uma Raça (um pedido por vez; quem pedir de novo recebe a mesma promessa). Devolve true se a Raça ficou com os modelos novos; nunca rejeita.
   o.rede === false: só do que já está na máquina (pacote embutido ou a cópia guardada pelo service worker), sem pedido de rede — é como a tela
   inicial, o Hangar e a Sala de Comando pedem; a rede fica para a tela de carregamento da partida (partida(), abaixo). */
function pede(race, o) { o = o || {}; if (ANTIGOS) { ESTADO[race] = 'antigos'; return Promise.resolve(false); } if (PRONTAS[race]) return Promise.resolve(true); const t = tabela(race); if (!t) return Promise.resolve(false);
  const emb = CFG.emb && CFG.emb[race], so = !emb && o.rede === false; if (!emb && (!CFG.base || !t.arquivo)) return Promise.resolve(false);
  const ant = PEDIDOS[race]; if (ant) return ant.so && !so ? ant.then(ok => ok || pede(race, o)) /* havia só a consulta à cópia guardada: se não achou, agora vai à rede */ : ant; const t0 = Date.now(), url = emb ? null : CFG.base + t.arquivo + (t.hash ? '?v=' + t.hash : '');
  const p = Promise.resolve().then(() => emb ? abreGzip(deB64(emb)).then(instala) : so ? guardado(url) : carrega(url, o.aoBaixar)).then(nomes => nomes ? pronta(race, nomes) : false)
    .catch(err => { if (!so) ESTADO[race] = 'falhou: ' + (err && err.message); delete PRONTAS[race]; try { if (!so) console.info('[ARD] modelos novos de ' + race + ' indisponíveis; a partida usa os de antes (' + (err && err.message) + ')'); } catch (e) {} return false; })
    .then(ok => { MED.ms += Date.now() - t0; if (!ok && !emb && PEDIDOS[race] === p) delete PEDIDOS[race]; /* sem sucesso pela rede ou pela cópia guardada: o próximo pedido tenta de novo */ return ok; });
  p.so = so; PEDIDOS[race] = p; return p; }
/* tela de carregamento: os pacotes das Raças da partida (todos os jogadores, menos o mundo neutro), com a barra contando de 2% a 8%. Nunca rejeita. */
function partida(sim, progresso) { const rs = []; for (const p of (sim && sim.players) || []) if (p && !p.mundo && p.faction && tabela(p.faction) && !rs.includes(p.faction)) rs.push(p.faction); if (ANTIGOS || !rs.length) return Promise.resolve(0);
  const tot = rs.reduce((a, r) => a + (tabela(r).gzip || 1), 0), rec = {}; const conta = () => { if (progresso) { let n = 0; for (const r in rec) n += rec[r]; try { progresso(0.02 + 0.06 * Math.min(1, n / tot)); } catch (e) {} } };
  return Promise.all(rs.map(r => pede(r, { aoBaixar: n => { rec[r] = n; conta(); } }).then(ok => { rec[r] = tabela(r).gzip || 1; conta(); return ok; }))).then(v => v.filter(Boolean).length); }
const api = ARD.otb = { instala, instalaB64: s => instala(deB64(s)), carrega, modelos: MODELOS, /* 5.5b.4 */ config, receita, pede, partida, tem: race => !ANTIGOS && !!PRONTAS[race], antigos: ANTIGOS, estado: ESTADO, medida: MED, tabela, get cfg() { return CFG; } };
if (CFG && CFG.emb && !ANTIGOS) for (const r in CFG.emb) pede(r, { rede: false }); /* 5.5b.4: versão de arquivo único — os pacotes embutidos instalam ao abrir a página (sem rede), e a tela inicial e o Hangar já mostram os modelos novos */
})(globalThis.ARD = globalThis.ARD || {});
