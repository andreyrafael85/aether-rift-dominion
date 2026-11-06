/* Aether Rift: Dominion — salvamentos (4.1c).
   Guarda partidas solo e de campanha no aparelho: um espaço automático ("auto", gravado a cada poucos segundos e ao sair
   da aba) e três espaços manuais. Cada registro tem um resumo (meta) para listar rápido e os dados da partida comprimidos
   com gzip quando o navegador tem CompressionStream. Usa IndexedDB; sem ele, cai para o localStorage.
   5.0g.1: nenhuma chamada daqui devolve promise rejeitada por demora. No iPhone a primeira abertura do IndexedDB pode levar
   vários segundos (ou nunca responder): cada abertura tem tempo-limite e uma segunda tentativa; sem resposta, o aparelho usa a
   reserva do localStorage por um minuto e tenta de novo depois (uma abertura que chega atrasada é aproveitada). Leitura e
   transação também têm tempo-limite; a leitura confere os dois lugares e fica com o registro mais novo. O gzip vai como
   ArrayBuffer (o Safari guarda Blob no IndexedDB devagar e às vezes falha); os registros antigos, com Blob, continuam abrindo. */
(function (ARD) {
'use strict';
const DB_NAME = 'ard-saves', STORE = 'saves', LS_PREFIX = 'ard-save-';
const SLOTS = ['auto', 'm1', 'm2', 'm3'];
const ABRE_MS = [4000, 6000], TX_MS = 5000, PASSO_MS = 8000, PAUSA_MS = 60000; /* 5.0g.1: tempos-limite (abertura: 1ª e 2ª tentativa) e a pausa da reserva */
let dbp = null, semIdbAte = 0;
const espera = (p, ms, msg) => new Promise((res, rej) => { const t = setTimeout(() => rej(new Error(msg)), ms); p.then(v => { clearTimeout(t); res(v); }, e => { clearTimeout(t); rej(e); }); });
function openDb() { /* 5.0g.1: 1ª tentativa; sem resposta em 4 s, uma 2ª (a 1ª continua valendo se chegar); sem nenhuma em 10 s, a reserva por um minuto */
  if (dbp) return dbp;
  if (Date.now() < semIdbAte) return Promise.reject(new Error('IndexedDB em pausa'));
  const p = new Promise((res, rej) => {
    let feito = false;
    const ok = db => { db.onversionchange = () => { try { db.close(); } catch (e) {} if (dbp && dbp.db === db) dbp = null; }; db.onclose = () => { if (dbp && dbp.db === db) dbp = null; };
      if (!feito) { feito = true; p.db = db; res(db); return; }
      if (!dbp) { const q = Promise.resolve(db); q.db = db; dbp = q; semIdbAte = 0; try { globalThis.dispatchEvent && globalThis.dispatchEvent(new Event('ard-saves-pronto')); } catch (e) {} return; } /* chegou atrasada: vale para a próxima vez (e a tela inicial relê os salvamentos) */
      if (dbp.db !== db) try { db.close(); } catch (e) {} };
    const falha = e => { if (feito) return; feito = true; rej(e); };
    const tenta = () => { try {
      if (!('indexedDB' in globalThis) || !indexedDB) { falha(new Error('sem IndexedDB')); return; }
      const rq = indexedDB.open(DB_NAME, 1);
      rq.onupgradeneeded = () => { const db = rq.result; if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE); };
      rq.onsuccess = () => ok(rq.result); rq.onerror = () => falha(rq.error || new Error('IndexedDB falhou')); rq.onblocked = () => falha(new Error('IndexedDB bloqueado'));
    } catch (e) { falha(e); } };
    tenta(); setTimeout(() => { if (!feito) tenta(); }, ABRE_MS[0]); setTimeout(() => falha(new Error('IndexedDB demorou')), ABRE_MS[0] + ABRE_MS[1]);
  });
  dbp = p; p.catch(() => { if (dbp === p) { dbp = null; semIdbAte = Date.now() + PAUSA_MS; } });
  return p;
}
function tx(mode, fn) {
  return openDb().then(db => espera(new Promise((res, rej) => {
    let t; try { t = db.transaction(STORE, mode); } catch (e) { if (dbp && dbp.db === db) dbp = null; rej(e); return; } /* conexão fechada pelo sistema: abre de novo na próxima */
    const st = t.objectStore(STORE); let out; const r = fn(st); if (r) r.onsuccess = () => { out = r.result; };
    t.oncomplete = () => res(out); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error || new Error('transação abortada')); }), TX_MS, 'IndexedDB demorou'));
}
const canGzip = typeof CompressionStream === 'function' && typeof DecompressionStream === 'function' && typeof Blob === 'function' && typeof Response === 'function';
async function pack(json) {
  if (!canGzip) return { enc: 'json', body: json, size: json.length, json };
  try { const buf = await new Response(new Blob([json]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer(); return { enc: 'gzip', body: buf, size: buf.byteLength, raw: json.length, json }; } /* 5.0g.1: ArrayBuffer, não Blob */
  catch (e) { return { enc: 'json', body: json, size: json.length, json }; }
}
async function unpack(rec) {
  if (rec.enc === 'gzip') { const b = rec.body instanceof Blob ? rec.body : new Blob([rec.body]); const txt = await new Response(b.stream().pipeThrough(new DecompressionStream('gzip'))).text(); return JSON.parse(txt); }
  return JSON.parse(rec.body);
}
// localStorage: só texto; sem gzip (o tamanho cabe: 60–300 KB por partida)
const ls = {
  put(slot, meta, json) { localStorage.setItem(LS_PREFIX + slot, JSON.stringify({ meta, enc: 'json', body: json })); },
  get(slot) { const t = localStorage.getItem(LS_PREFIX + slot); return t ? JSON.parse(t) : null; },
  del(slot) { localStorage.removeItem(LS_PREFIX + slot); },
};
function lsPut(slot, meta, json) { try { ls.put(slot, meta, json); meta.bytes = (localStorage.getItem(LS_PREFIX + slot) || '').length; meta.local = true; return meta; } catch (e) { console.warn('[ARD] salvamento: sem espaço no aparelho', e); return null; } }
// 4.2g — gravações e apagamentos em fila, na ordem em que foram pedidos (um salvamento ainda comprimindo não cai depois de um del('auto')); cada passo tem tempo-limite para a fila nunca travar
// 5.0g.1: o passo que passa do tempo-limite faz a reserva (localStorage) e responde; a fila nunca devolve promise rejeitada
let queue = Promise.resolve();
function serial(fn, reserva) {
  const p = queue.then(() => new Promise(res => { let feito = false; const ctx = { passou: false }; const fim = v => { if (feito) return; feito = true; clearTimeout(t); res(v); };
    const t = setTimeout(() => { ctx.passou = true; let v = null; try { v = reserva(); } catch (e) {} fim(v); }, PASSO_MS);
    Promise.resolve(ctx).then(fn).then(fim, () => { let v = null; try { v = reserva(); } catch (e) {} fim(v); }); }));
  queue = p; return p;
}
function put(slot, meta, data) {
  meta = Object.assign({}, meta, { slot, savedAt: Date.now() });
  let json = null; try { json = JSON.stringify(data); } catch (e) { return Promise.resolve(null); } /* a fotografia vira texto já, na hora do pedido */
  const packed = pack(json); packed.catch(() => {});
  return serial(async ctx => {
    try { const p = await packed; if (ctx.passou) return null; /* 5.0g.1: o passo já fez a reserva; não grava atrasado */ meta.bytes = p.size; await tx('readwrite', st => st.put({ meta, enc: p.enc, body: p.body }, slot)); try { ls.del(slot); } catch (e) {} return meta; }
    catch (e) { return lsPut(slot, meta, json); }
  }, () => lsPut(slot, meta, json));
}
async function getRec(slot) {
  let a = null, b = null;
  try { a = await tx('readonly', st => st.get(slot)) || null; } catch (e) {}
  try { b = ls.get(slot); } catch (e) {}
  if (a && b) return ((b.meta && b.meta.savedAt) || 0) > ((a.meta && a.meta.savedAt) || 0) ? b : a; /* 5.0g.1: o mais novo dos dois lugares */
  return a || b;
}
async function get(slot) { const r = await getRec(slot); if (!r) return null; return { meta: r.meta, data: await unpack(r) }; }
async function meta(slot) { try { const r = await getRec(slot); return r ? r.meta : null; } catch (e) { return null; } }
async function list() { const out = []; for (const s of SLOTS) { const m = await meta(s); if (m) out.push(m); } return out; }
function del(slot) { const lsDel = () => { try { ls.del(slot); } catch (e) {} return true; };
  return serial(async () => { try { await tx('readwrite', st => st.delete(slot)); } catch (e) {} return lsDel(); }, lsDel); }
function ago(ts) { const s = Math.max(0, Math.round((Date.now() - ts) / 1000)); if (s < 60) return 'há ' + s + ' s'; const m = Math.round(s / 60); if (m < 60) return 'há ' + m + ' min'; const h = Math.round(m / 60); if (h < 48) return 'há ' + h + ' h'; return 'há ' + Math.round(h / 24) + ' dias'; }
const mmss = t => Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0');
ARD.saves = { SLOTS, put, get, meta, list, del, ago, mmss, gzip: canGzip, estado: () => ({ idb: !!dbp, pausa: Math.max(0, semIdbAte - Date.now()) }) };
})(globalThis.ARD = globalThis.ARD || {});
