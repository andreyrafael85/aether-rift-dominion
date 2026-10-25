/* 5.0a.2: imitação de speechSynthesis/SpeechSynthesisUtterance para os testes (roda dentro da página, por addInitScript): devolve o conjunto
   de vozes do navegador simulado, grava cada fala (texto, voz, tom, velocidade), dispara start, boundary por palavra e end, e o voiceschanged. */
function fake(set) {
  const vozes = set.vozes.map(x => Object.freeze(Object.assign({}, x)));
  let pronto = !set.atraso; const L = { voiceschanged: [] }; const F = window.__fala = { log: [], ev: [], caps: [], erros: [] };
  class U { constructor(t) { this.text = String(t == null ? '' : t); this.lang = ''; this.voice = null; this.pitch = 1; this.rate = 1; this.volume = 1; this._l = {}; }
    addEventListener(k, f) { (this._l[k] = this._l[k] || []).push(f); } removeEventListener(k, f) { this._l[k] = (this._l[k] || []).filter(x => x !== f); }
    _fire(k, e) { e = Object.assign({ type: k, utterance: this, charIndex: 0, charLength: 0, elapsedTime: 0 }, e || {}); try { if (this['on' + k]) this['on' + k](e); } catch (er) { F.erros.push(String(er)); } for (const f of this._l[k] || []) try { f(e); } catch (er) { F.erros.push(String(er)); } } }
  const q = []; let cur = null, tm = null;
  const ss = { speaking: false, pending: false, paused: false, onvoiceschanged: null,
    getVoices() { if (pronto) return vozes.slice(); return set.parcial ? vozes.filter(x => x.localService) : []; },
    speak(u) { F.log.push({ t: Math.round(performance.now()), text: u.text, voz: u.voice ? u.voice.name : null, uri: u.voice ? u.voice.voiceURI : null, lang: u.lang, pitch: u.pitch, rate: u.rate, volume: u.volume }); q.push(u); ss.pending = !!cur || q.length > 1; if (!cur) next(); },
    cancel() { const pend = q.splice(0); for (const u of pend) u._fire('error', { error: 'canceled' }); if (cur) { clearTimeout(tm); const c = cur; cur = null; c._fire('error', { error: 'interrupted' }); } ss.speaking = false; ss.pending = false; },
    pause() { ss.paused = true; }, resume() { ss.paused = false; },
    addEventListener(k, f) { (L[k] = L[k] || []).push(f); }, removeEventListener(k, f) { L[k] = (L[k] || []).filter(x => x !== f); }, dispatchEvent() { return true; } };
  function next() { cur = q.shift() || null; ss.speaking = !!cur; ss.pending = q.length > 0; if (!cur) return; const u = cur; const words = [...u.text.matchAll(/\S+/g)];
    if (set.falha && u.voice && new RegExp(set.falha).test(u.voice.name)) { F.falhas = (F.falhas || 0) + 1; tm = setTimeout(() => { if (cur !== u) return; cur = null; ss.speaking = false; u._fire('error', { error: 'synthesis-failed' }); if (!cur) next(); }, 5); return; } /* voz online sem rede */
    tm = setTimeout(() => { if (cur !== u) return; u._fire('start'); for (const w of words) u._fire('boundary', { name: 'word', charIndex: w.index, charLength: w[0].length });
      tm = setTimeout(() => { if (cur !== u) return; cur = null; ss.speaking = false; u._fire('end'); if (!cur) next(); }, 12 * u.text.length + 20); }, 5); } /* quem falou de novo dentro do end já virou a atual */
  Object.defineProperty(window, 'speechSynthesis', { configurable: true, get: () => ss });
  window.SpeechSynthesisUtterance = U;
  if (set.atraso) setTimeout(() => { pronto = true; const e = { type: 'voiceschanged' }; if (ss.onvoiceschanged) ss.onvoiceschanged(e); for (const f of L.voiceschanged) f(e); }, set.atraso);
  addEventListener('ard-voz', e => F.ev.push(e.detail.tipo));
}
module.exports = fake;
