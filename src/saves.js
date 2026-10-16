/* Aether Rift: Dominion — salvamentos (4.1c).
   Guarda partidas solo e de campanha no aparelho: um espaço automático ("auto", gravado a cada poucos segundos e ao sair
   da aba) e três espaços manuais. Cada registro tem um resumo (meta) para listar rápido e os dados da partida comprimidos
   com gzip quando o navegador tem CompressionStream. Usa IndexedDB; sem ele, cai para o localStorage. */
(function (ARD) {
'use strict';
const DB_NAME = 'ard-saves', STORE = 'saves', LS_PREFIX = 'ard-save-';
const SLOTS = ['auto', 'm1', 'm2', 'm3'];
let dbp = null;
function openDb() {
  if (dbp) return dbp;
  dbp = new Promise((res, rej) => {
    try {
      if (!('indexedDB' in globalThis) || !indexedDB) { rej(new Error('sem IndexedDB')); return; }
      const rq = indexedDB.open(DB_NAME, 1);
      rq.onupgradeneeded = () => { const db = rq.result; if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE); };
      rq.onsuccess = () => res(rq.result); rq.onerror = () => rej(rq.error || new Error('IndexedDB falhou')); rq.onblocked = () => rej(new Error('IndexedDB bloqueado'));
    } catch (e) { rej(e); }
  });
  dbp.catch(() => { dbp = null; });
  return dbp;
}
function tx(mode, fn) { return openDb().then(db => new Promise((res, rej) => { const t = db.transaction(STORE, mode); const st = t.objectStore(STORE); let out; const r = fn(st); if (r) r.onsuccess = () => { out = r.result; }; t.oncomplete = () => res(out); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error || new Error('transação abortada')); })); }
const canGzip = typeof CompressionStream === 'function' && typeof DecompressionStream === 'function' && typeof Blob === 'function' && typeof Response === 'function';
async function pack(obj) {
  const json = JSON.stringify(obj);
  if (!canGzip) return { enc: 'json', body: json, size: json.length };
  try { const blob = await new Response(new Blob([json]).stream().pipeThrough(new CompressionStream('gzip'))).blob(); return { enc: 'gzip', body: blob, size: blob.size, raw: json.length }; }
  catch (e) { return { enc: 'json', body: json, size: json.length }; }
}
async function unpack(rec) {
  if (rec.enc === 'gzip') { const txt = await new Response(rec.body.stream().pipeThrough(new DecompressionStream('gzip'))).text(); return JSON.parse(txt); }
  return JSON.parse(rec.body);
}
// localStorage: só texto; sem gzip (o tamanho cabe: 60–300 KB por partida)
const ls = {
  put(slot, meta, data) { localStorage.setItem(LS_PREFIX + slot, JSON.stringify({ meta, enc: 'json', body: JSON.stringify(data) })); },
  get(slot) { const t = localStorage.getItem(LS_PREFIX + slot); return t ? JSON.parse(t) : null; },
  del(slot) { localStorage.removeItem(LS_PREFIX + slot); },
};
// 4.2g — gravações e apagamentos em fila, na ordem em que foram pedidos (um salvamento ainda comprimindo não cai depois de um del('auto')); cada passo tem tempo-limite para a fila nunca travar
let queue = Promise.resolve();
function serial(fn) { const p = queue.then(() => Promise.race([fn(), new Promise((_, rej) => setTimeout(() => rej(new Error('armazenamento demorou')), 8000))])); queue = p.then(() => {}, () => {}); return p; }
function put(slot, meta, data) {
  meta = Object.assign({}, meta, { slot, savedAt: Date.now() });
  const packed = pack(data); packed.catch(() => {}); // a fotografia vira texto já, na hora do pedido
  return serial(async () => {
    try { const p = await packed; meta.bytes = p.size; await tx('readwrite', st => st.put({ meta, enc: p.enc, body: p.body }, slot)); try { ls.del(slot); } catch (e) {} return meta; }
    catch (e) { ls.put(slot, meta, data); meta.bytes = (localStorage.getItem(LS_PREFIX + slot) || '').length; return meta; }
  });
}
async function getRec(slot) { try { const r = await tx('readonly', st => st.get(slot)); if (r) return r; } catch (e) {} try { return ls.get(slot); } catch (e) { return null; } }
async function get(slot) { const r = await getRec(slot); if (!r) return null; return { meta: r.meta, data: await unpack(r) }; }
async function meta(slot) { const r = await getRec(slot); return r ? r.meta : null; }
async function list() { const out = []; for (const s of SLOTS) { try { const m = await meta(s); if (m) out.push(m); } catch (e) {} } return out; }
function del(slot) { return serial(async () => { try { await tx('readwrite', st => st.delete(slot)); } catch (e) {} try { ls.del(slot); } catch (e) {} }); }
function ago(ts) { const s = Math.max(0, Math.round((Date.now() - ts) / 1000)); if (s < 60) return 'há ' + s + ' s'; const m = Math.round(s / 60); if (m < 60) return 'há ' + m + ' min'; const h = Math.round(m / 60); if (h < 48) return 'há ' + h + ' h'; return 'há ' + Math.round(h / 24) + ' dias'; }
const mmss = t => Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0');
ARD.saves = { SLOTS, put, get, meta, list, del, ago, mmss, gzip: canGzip };
})(globalThis.ARD = globalThis.ARD || {});
