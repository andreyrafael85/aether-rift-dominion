/* Baixa three (ESM + addons usados pela página), postprocessing e N8AO para dist/vendor/, seguindo imports relativos.
   Só para testes headless determinísticos (dist/ é ignorado pelo git). Uso: node tools/vendor.mjs
   4.3b: as versões ficam aqui e em src/index.tpl.html (importmap); trocar a versão apaga a pasta antiga do pacote. */
import { writeFileSync, mkdirSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { dirname } from 'node:path';
export const VERSIONS = { three: '0.186.1', postprocessing: '6.39.5', n8ao: '2.0.1', gsap: '3.15.0' };
const PKGS = {
  three: ['build/three.module.min.js', 'build/three.core.min.js', /* o importmap troca three.core.js por este */ 'examples/jsm/postprocessing/EffectComposer.js', 'examples/jsm/postprocessing/RenderPass.js',
    'examples/jsm/postprocessing/UnrealBloomPass.js', 'examples/jsm/postprocessing/OutputPass.js', 'examples/jsm/postprocessing/SSAOPass.js',
    'examples/jsm/postprocessing/ShaderPass.js', 'examples/jsm/postprocessing/Pass.js', 'examples/jsm/environments/RoomEnvironment.js',
    /* 5.0: Motor 5 (WebGPURenderer + TSL) e os nós de pós, sombras em cascata e céu físico */
    'build/three.webgpu.js', 'build/three.tsl.js', 'build/three.webgpu.min.js', 'build/three.tsl.min.js', /* 5.0a: o importmap do jogo usa as versões minificadas do jsDelivr */ 'examples/jsm/csm/CSMShadowNode.js', 'examples/jsm/objects/SkyMesh.js', 'examples/jsm/tsl/utils/Raymarching.js',
    ...['BloomNode', 'DepthOfFieldNode', 'FXAANode', 'SMAANode', 'GTAONode', 'TRAANode', 'TAAUNode', 'FSR1Node', 'GodraysNode', 'OutlineNode', 'Lut3DNode', 'SSRNode', 'ChromaticAberrationNode', 'FilmNode', 'GaussianBlurNode'].map(n => 'examples/jsm/tsl/display/' + n + '.js')],
  postprocessing: ['build/index.min.js'], // minificado pelo jsDelivr, imports "three" intactos
  n8ao: ['dist/N8AO.min.js'],
  gsap: ['dist/gsap.min.js'], /* 5.0: câmera e cinema da apresentação (UMD: window.gsap) */
};
const vroot = new URL('../', import.meta.url).pathname + 'dist/vendor/';
let n = 0;
for (const [pkg, entries] of Object.entries(PKGS)) {
  const ver = VERSIONS[pkg], base = 'https://cdn.jsdelivr.net/npm/' + pkg + '@' + ver + '/', root = vroot + pkg + '/', stamp = root + 'VERSION';
  if (existsSync(root) && (!existsSync(stamp) || readFileSync(stamp, 'utf8').trim() !== ver)) rmSync(root, { recursive: true, force: true });
  mkdirSync(root, { recursive: true }); writeFileSync(stamp, ver + '\n');
  const seen = new Set();
  const grab = async rel => {
    if (seen.has(rel)) return; seen.add(rel);
    const out = root + rel; let txt;
    if (existsSync(out)) txt = readFileSync(out, 'utf8');
    else { const res = await fetch(base + rel); if (!res.ok) throw new Error(res.status + ' ' + pkg + '/' + rel); txt = await res.text(); mkdirSync(dirname(out), { recursive: true }); writeFileSync(out, txt); }
    n++;
    for (const m of txt.matchAll(/(?:from|import)\s*['"](\.{1,2}\/[^'"]+)['"]/g)) await grab(new URL(m[1], base + rel).pathname.replace('/npm/' + pkg + '@' + ver + '/', ''));
  };
  for (const e of entries) await grab(e);
}
console.log('vendor: ' + n + ' arquivos em dist/vendor/ (' + Object.entries(VERSIONS).map(([k, v]) => k + ' ' + v).join(', ') + ')');
