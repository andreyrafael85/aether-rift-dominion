/* Baixa three r160 (ESM + addons usados pela página) para dist/vendor/three/, seguindo imports relativos.
   Só para testes headless determinísticos (dist/ é ignorado pelo git). Uso: node tools/vendor.mjs */
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
const BASE = 'https://cdn.jsdelivr.net/npm/three@0.160.0/';
const root = new URL('../', import.meta.url).pathname + 'dist/vendor/three/';
const entries = ['build/three.module.min.js', 'examples/jsm/postprocessing/EffectComposer.js', 'examples/jsm/postprocessing/RenderPass.js',
  'examples/jsm/postprocessing/UnrealBloomPass.js', 'examples/jsm/postprocessing/OutputPass.js', 'examples/jsm/postprocessing/SSAOPass.js'];
const seen = new Set(); let n = 0;
async function grab(rel) {
  if (seen.has(rel)) return; seen.add(rel);
  const out = root + rel; if (existsSync(out)) { n++; return; }
  const res = await fetch(BASE + rel); if (!res.ok) throw new Error(res.status + ' ' + rel);
  const txt = await res.text(); mkdirSync(dirname(out), { recursive: true }); writeFileSync(out, txt); n++;
  for (const m of txt.matchAll(/(?:from|import)\s*['"](\.{1,2}\/[^'"]+)['"]/g)) {
    const next = new URL(m[1], BASE + rel).pathname.replace(/^\/npm\/three@0\.160\.0\//, '');
    await grab(next);
  }
}
for (const e of entries) await grab(e);
console.log('vendor: ' + n + ' arquivos em dist/vendor/three/');
