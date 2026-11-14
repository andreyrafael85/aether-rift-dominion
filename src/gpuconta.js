/* Aether Rift: Dominion — 5.0h.3: contador de criações na GPU (diagnóstico).
   Conta o que nasce na GPU no meio da partida, por quadro: buffers, texturas, grupos de ligação (WebGPU), pipelines e programas, os
   objetos de desenho novos do three (RenderObject) e as montagens de nós (NodeBuilder) do Motor 5, e quanto sobe por writeBuffer/bufferData.
   Liga só no Teste de desempenho (o Detetive de travadas mostra o que havia no quadro) e com ?m5conta=1 (ou ?gpuconta=1); ?m5conta=2 guarda
   também a pilha de cada criação (quem pediu, no código do jogo) em ARD.gpuConta.pilhas. Fora disso nada é embrulhado.
   Os embrulhos são por instância (o device, a fila e o contexto da partida), não pelo protótipo: o busto do líder, os ícones e a Sala ficam fora. */
(function (ARD) {
'use strict';
const Q = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
const MODO = +(Q.get('m5conta') || Q.get('gpuconta') || 0);
const K = ['buf', 'tex', 'bg', 'pipe', 'prog', 'ro', 'nb', 'wb', 'wbKB', 'img'];
const C = { modo: MODO, bench: false, ligados: [], tot: {}, q: {}, pilhas: MODO >= 2 ? new Map() : null };
for (const k of K) { C.tot[k] = 0; C.q[k] = 0; }
/* 5.0h.4: a CPU do desenho do Motor 5 por passe, em ms e sem contar o que roda dentro de outro passe (as sombras e o reflexo rodam dentro do
   passe da cena): 0 sombras (cada cascata), 1 reflexo dos lagos, 2 cena, 3 pós e telas auxiliares (quads do pós, mapa de clarões, barras de vida).
   O Detetive de travadas mostra qual passe pesou em cada um dos piores quadros; o que sobra do desenho é o preparo do quadro (o jogo). */
C.passe = new Float64Array(4); C.passeQ = new Float64Array(4); const PT = new Float64Array(8), PK = new Int8Array(8); let pn = 0;
function embRender(X) { const r = X.renderer, f = r.render; if (typeof f !== 'function' || f.__ardConta) return;
  const w = function ardContaRender(cena, cam) { if (pn >= 8) return f.apply(this, arguments); const t = performance.now(), k = cam && cam.ardSombra ? 0 : cam && cam.name === 'reflexo-lagos' ? 1 : cena === X.scene && cam === X.camera ? 2 : 3;
    if (pn) C.passe[PK[pn - 1]] += t - PT[pn - 1]; PK[pn] = k; PT[pn] = t; pn++;
    try { return f.apply(this, arguments); } finally { const t2 = performance.now(); pn--; C.passe[k] += t2 - PT[pn]; if (pn) PT[pn - 1] = t2; } };
  w.__ardConta = true; r.render = w; }
C.quer = () => C.modo > 0 || C.bench;
/* quem pediu: o primeiro quadro da pilha no código do jogo que não é este arquivo nem o three */
function pilha(k) { const s = String(new Error().stack || '').split('\n'); let q = ''; for (let i = 2; i < s.length; i++) { const l = s[i]; if (/gpuconta|three\.|vendor\/|\b(pilha|inc|ardContaEmb)\b/.test(l)) continue; if (/local\.html|aether-rift|index\.html|\.html:/.test(l)) { q = l.trim().replace(/^at /, '').replace(/\(?(file|https?):\/\/[^)]*\/([^/)]+)\)?/, '@$2'); break; } }
  const ch = k + ' ← ' + (q || '(fora do jogo)'); C.pilhas.set(ch, (C.pilhas.get(ch) || 0) + 1); }
function inc(k, v) { C.q[k] += v; C.tot[k] += v; if (C.pilhas && k !== 'wb' && k !== 'wbKB') pilha(k); }
function emb(o, nome, k, bytes) { const f = o && o[nome]; if (typeof f !== 'function' || f.__ardConta) return; const w = function ardContaEmb() { if (bytes) { C.q.wb++; C.tot.wb++; const kb = bytes.apply(null, arguments) / 1024; C.q.wbKB += kb; C.tot.wbKB += kb; } else inc(k, 1); return f.apply(this, arguments); }; w.__ardConta = true; o[nome] = w; }
const bytesWB = (buf, off, data, dOff, size) => { const bpe = data && data.BYTES_PER_ELEMENT ? data.BYTES_PER_ELEMENT : 1; return size != null ? size * bpe : data ? data.byteLength - (dOff || 0) * bpe : 0; };
const bytesBD = (alvo, d) => typeof d === 'number' ? d : d && d.byteLength ? d.byteLength : 0;
const bytesBS = (alvo, off, d, sOff, len) => d && d.BYTES_PER_ELEMENT ? (len != null ? len * d.BYTES_PER_ELEMENT : d.byteLength - (sOff || 0) * d.BYTES_PER_ELEMENT) : d && d.byteLength ? d.byteLength : 0;
/* contexto WebGL (clássico e reserva WebGL2 do Motor 5) */
function ligaGL(gl) { if (!gl || gl.__ardConta) return; gl.__ardConta = true;
  emb(gl, 'createBuffer', 'buf'); emb(gl, 'createTexture', 'tex'); emb(gl, 'createProgram', 'prog'); emb(gl, 'bufferData', 'wb', bytesBD); emb(gl, 'bufferSubData', 'wb', bytesBS);
  for (const m of ['texImage2D', 'texImage3D', 'texStorage2D', 'texStorage3D']) emb(gl, m, 'img'); C.ligados.push('webgl'); }
/* Motor 5: o device e a fila do WebGPU, e o three por dentro (objetos de desenho e montagens de nós) */
function ligaM5(X) { const r = X && X.renderer, be = r && r.backend; if (!be || r.__ardConta) return; r.__ardConta = true;
  if (be.isWebGPUBackend && be.device) { const d = be.device; emb(d, 'createBuffer', 'buf'); emb(d, 'createTexture', 'tex'); emb(d, 'createBindGroup', 'bg'); emb(d, 'createRenderPipeline', 'pipe'); emb(d, 'createRenderPipelineAsync', 'pipe'); emb(d, 'createComputePipeline', 'pipe'); emb(d, 'createComputePipelineAsync', 'pipe');
    const fq = d.queue; emb(fq, 'writeBuffer', 'wb', bytesWB); emb(fq, 'writeTexture', 'img'); emb(fq, 'copyExternalImageToTexture', 'img'); C.ligados.push('webgpu'); }
  else if (be.gl) ligaGL(be.gl);
  if (r._objects) emb(r._objects, 'createRenderObject', 'ro'); if (r._nodes) emb(r._nodes, '_createNodeBuilder', 'nb'); embRender(X); /* 5.0h.4 */
  if (C.pilhas && r._objects) { const OB = r._objects, f = OB.createRenderObject; const vistos = new WeakSet(); /* ?m5conta=2: qual objeto ganhou objeto de desenho novo, em que passe, e se é a 1ª vez dele */
    OB.createRenderObject = function (nodes, geos, rr, obj, mat, scene, cam, ln, ctx) { try { const novo = !vistos.has(obj); vistos.add(obj); const rt = ctx && ctx.renderTarget; const passe = cam && cam.ardSombra ? 'sombra' : rt ? ((rt.texture && rt.texture.name) || 'alvo ' + rt.width + 'x' + rt.height) : 'tela';
      const k = 'ro: ' + (novo ? 'objeto novo' : 'objeto visto, passe novo') + ' · ' + (obj.isInstancedMesh || obj.isM5Inst ? 'instanciado' : obj.type) + (obj.name ? '(' + obj.name + ')' : '') + ' · ' + ((mat && (mat.name || mat.type)) || '?') + ' · ' + passe; C.pilhas.set(k, (C.pilhas.get(k) || 0) + 1); } catch (e) {} return f.apply(this, arguments); }; }
  if (C.pilhas && r._nodes) { const ND = r._nodes, f = ND._createNodeBuilder; ND._createNodeBuilder = function (ro, mat) { try { const o = ro && ro.object, ctx = ro && ro.context, rt = ctx && ctx.renderTarget; const cam = ro && ro.camera; const passe = cam && cam.ardSombra ? 'sombra' : rt ? ((rt.texture && rt.texture.name) || 'alvo') : 'tela'; const k = 'nb: ' + ((mat && (mat.name || mat.type)) || '?') + ' · ' + ((o && (o.name || o.type)) || '?') + ' · ' + passe; C.pilhas.set(k, (C.pilhas.get(k) || 0) + 1); } catch (e) {} return f.apply(this, arguments); }; } /* ?m5conta=2: qual material e objeto pediram montagem de nós */
  if (C.pilhas && be.isWebGPUBackend && be.device) { const d = be.device, f = d.createBuffer; d.createBuffer = function (desc) { try { const u = desc.usage | 0, t = u & 0x40 ? 'uniform' : u & 0x80 ? 'storage' : u & 0x20 ? 'vértice' : u & 0x10 ? 'índice' : u & 0x8 ? 'cópia' : 'outro'; const k = 'buf: ' + t + ' · ' + (desc.size >= 65536 ? '≥64 KB' : desc.size >= 4096 ? '4–64 KB' : '<4 KB'); C.pilhas.set(k, (C.pilhas.get(k) || 0) + 1); } catch (e) {} return f.apply(this, arguments); }; } }
/* o quadro: devolve os contadores do quadro e zera (o objeto é sempre o mesmo: nada alocado) */
const Z = {}; for (const k of K) Z[k] = 0;
function quadro() { for (const k of K) { Z[k] = C.q[k]; C.q[k] = 0; } for (let i = 0; i < 4; i++) { C.passeQ[i] = C.passe[i]; C.passe[i] = 0; } /* 5.0h.4 */ return Z; }
C.ligaGL = ligaGL; C.ligaM5 = ligaM5; C.quadro = quadro; C.K = K;
C.topo = n => C.pilhas ? [...C.pilhas.entries()].sort((a, b) => b[1] - a[1]).slice(0, n || 30) : [];
ARD.gpuConta = C;
})(globalThis.ARD = globalThis.ARD || {});
