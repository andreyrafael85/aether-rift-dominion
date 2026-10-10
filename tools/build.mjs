/* Gera index.html (jogo) e estilo.html (prova visual) na raiz, prontos para GitHub Pages,
   e as versões sem esqueleto em dist/ (usadas para publicar como artefato). Uso: node tools/build.mjs */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const root = new URL('..', import.meta.url).pathname;
const read = p => readFileSync(root + p, 'utf8');
const HEAD = '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="color-scheme" content="dark">';
function wrap(page) { const i = page.indexOf('</style>') + 8; return HEAD + page.slice(0, i) + '</head><body>' + page.slice(i) + '</body></html>'; }
function bundle(tpl, scripts) { return read(tpl).replace('<!--SCRIPTS-->', '<script>\n' + scripts.map(read).join('\n') + '\n</script>'); }
mkdirSync(root + 'dist', { recursive: true });
const game = bundle('src/index.tpl.html', ['src/sim.js', 'src/ai.js', 'src/voxel.js', 'src/models.js', 'src/render.js', 'src/audio.js', 'src/input.js', 'src/main.js']);
writeFileSync(root + 'dist/aether-rift-beta.html', game); writeFileSync(root + 'index.html', wrap(game));
const style = bundle('style/index.tpl.html', ['src/voxel.js', 'src/models.js', 'style/scene.js', 'style/boot.js']);
writeFileSync(root + 'dist/estilo.html', style); writeFileSync(root + 'estilo.html', wrap(style));
const s3 = bundle('style3d/index.tpl.html', ['src/voxel.js', 'src/models.js', 'style3d/scene3d.js', 'style3d/boot.js']);
writeFileSync(root + 'dist/estilo3d.html', s3); writeFileSync(root + 'estilo3d.html', wrap(s3));
console.log('jogo', game.length, 'bytes · estilo', style.length, 'bytes · estilo3d', s3.length, 'bytes');
