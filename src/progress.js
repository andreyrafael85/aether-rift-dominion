/* Aether Rift: Dominion — ProgressStore v1 (4.0e): progresso local da campanha — Comandante (nível 1–30), missões e estrelas,
   conquistas, relíquias e escolhas do Hangar. Formato estável e versionado; a v5.0 importa este JSON na criação da conta.
   Exporta e importa por código de backup (ARD1-<soma>-<base64>). Sem DOM além do localStorage; roda no Node para testes. */
(function (ARD) {
'use strict';
const KEY = 'ard-progress-v1'; const MAX_LEVEL = 30;
const LEVEL_XP = n => 260 * n + 30 * n * n; // XP acumulado para sair do nível n
function blank() { return { v: 1, created: Date.now(), commander: { name: '', xp: 0, level: 1 }, missions: {}, achievements: {}, relics: { owned: [], equipped: [null, null] }, hangar: { color: null, skin: {}, portrait: {}, title: '' }, stats: { missions: 0, wins: 0, losses: 0, playSec: 0 } }; }
function merge(base, src) { if (!src || typeof src !== 'object' || Array.isArray(src)) return src === undefined ? base : src; const out = Array.isArray(base) ? base.slice() : Object.assign({}, base); for (const k in src) out[k] = (base && typeof base[k] === 'object' && base[k] !== null && !Array.isArray(base[k])) ? merge(base[k], src[k]) : src[k]; return out; }
let state = null; let mem = null; // mem: armazenamento em memória quando localStorage não existe (Node, modo privado)
const storage = () => { try { if (typeof localStorage !== 'undefined') { localStorage.getItem(KEY); return localStorage; } } catch (e) {} if (!mem) { const m = new Map(); mem = { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) }; } return mem; };
function migrate(s) { if (!s || s.v !== 1) return blank(); const out = merge(blank(), s); out.commander.level = levelOf(out.commander.xp); if (!Array.isArray(out.relics.equipped) || out.relics.equipped.length !== 2) out.relics.equipped = [null, null]; return out; }
function load() { if (state) return state; try { const raw = storage().getItem(KEY); state = raw ? migrate(JSON.parse(raw)) : blank(); } catch (e) { state = blank(); } return state; }
function save() { try { storage().setItem(KEY, JSON.stringify(state)); return true; } catch (e) { return false; } }
function levelOf(xp) { let n = 1; while (n < MAX_LEVEL && xp >= LEVEL_XP(n)) n++; return n; }
function levelInfo() { const s = load(); const lv = s.commander.level; const lo = lv > 1 ? LEVEL_XP(lv - 1) : 0, hi = lv < MAX_LEVEL ? LEVEL_XP(lv) : lo; return { level: lv, xp: s.commander.xp, into: s.commander.xp - lo, need: Math.max(1, hi - lo), max: lv >= MAX_LEVEL }; }
function addXp(n) { const s = load(); const from = s.commander.level; s.commander.xp += Math.max(0, Math.round(n)); s.commander.level = levelOf(s.commander.xp); save(); return { from, to: s.commander.level }; }
function mission(id) { return load().missions[id] || null; }
function completeMission(id, r) { // r: { stars, won, difficulty, time, race }
  const s = load(); const prev = s.missions[id] || { stars: 0, done: false, plays: 0 }; const cur = Object.assign({}, prev); cur.plays = (prev.plays || 0) + 1;
  if (r.won) { cur.done = true; if ((r.stars || 0) > (prev.stars || 0)) cur.stars = r.stars; if (!prev.bestTime || r.time < prev.bestTime) cur.bestTime = Math.round(r.time); cur.lastDifficulty = r.difficulty; cur.race = r.race; s.stats.wins++; } else s.stats.losses++;
  s.missions[id] = cur; s.stats.missions++; save(); return { newStars: Math.max(0, (cur.stars || 0) - (prev.stars || 0)), first: !prev.done && cur.done }; }
function unlock(id) { const s = load(); if (s.achievements[id]) return false; s.achievements[id] = Date.now(); save(); return true; }
function has(id) { return !!load().achievements[id]; }
function grantRelic(id) { const s = load(); if (s.relics.owned.includes(id)) return false; s.relics.owned.push(id); save(); return true; }
function equipRelic(slot, id) { const s = load(); if (slot !== 0 && slot !== 1) return false; if (id != null && !s.relics.owned.includes(id)) return false; if (id != null && s.relics.equipped[1 - slot] === id) s.relics.equipped[1 - slot] = null; s.relics.equipped[slot] = id == null ? null : id; save(); return true; }
function setHangar(patch) { const s = load(); s.hangar = merge(s.hangar, patch); save(); return s.hangar; }
function setName(n) { const s = load(); s.commander.name = String(n || '').slice(0, 24); save(); }
function addPlayTime(sec) { const s = load(); s.stats.playSec += Math.max(0, Math.round(sec)); save(); }
function checksum(str) { let h = 2166136261 >>> 0; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h.toString(36); }
const b64e = s => typeof btoa !== 'undefined' ? btoa(unescape(encodeURIComponent(s))) : Buffer.from(s, 'utf8').toString('base64');
const b64d = s => typeof atob !== 'undefined' ? decodeURIComponent(escape(atob(s))) : Buffer.from(s, 'base64').toString('utf8');
function exportCode() { const json = JSON.stringify(load()); return 'ARD1-' + checksum(json) + '-' + b64e(json); }
function importCode(code) { const m = /^ARD1-([0-9a-z]+)-([A-Za-z0-9+/=]+)$/.exec(String(code || '').trim()); if (!m) throw new Error('Código inválido'); const json = b64d(m[2]); if (checksum(json) !== m[1]) throw new Error('Código corrompido (soma não confere)'); state = migrate(JSON.parse(json)); save(); return state; }
function reset() { state = blank(); save(); return state; }
ARD.progress = { KEY, MAX_LEVEL, LEVEL_XP, load, save, levelOf, levelInfo, addXp, mission, completeMission, unlock, has, grantRelic, equipRelic, setHangar, setName, addPlayTime, exportCode, importCode, reset, _blank: blank };
})(globalThis.ARD = globalThis.ARD || {});
