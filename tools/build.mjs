/* Gera index.html (jogo) e estilo.html (prova visual) na raiz, prontos para GitHub Pages,
   e as versões sem esqueleto em dist/ (usadas para publicar como artefato). Uso: node tools/build.mjs */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const root = new URL('..', import.meta.url).pathname;
const read = p => readFileSync(root + p, 'utf8');
const HEAD = '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="color-scheme" content="dark">';
function wrap(page) { const i = page.indexOf('</style>') + 8; return HEAD + page.slice(0, i) + '</head><body>' + page.slice(i) + '</body></html>'; }
const BUILD = new Date().toISOString().slice(0, 16).replace('T', ' ') + 'Z';
import { readdirSync } from 'node:fs';
import { existsSync as exists } from 'node:fs';
function artBundle() { // arte aprovada (assets/*.jpg) vira ARD.ART no bundle do jogo
  const dir = root + 'assets/'; if (!exists(dir)) return ''; const art = { leader: {}, world: {}, insignia: {} };
  for (const f of readdirSync(dir)) { if (!f.endsWith('.jpg') || f === 'hero-belt.jpg') continue; if (f === 'logo.jpg') { art.logo = 'data:image/jpeg;base64,' + readFileSync(dir + f).toString('base64'); continue; } const data = 'data:image/jpeg;base64,' + readFileSync(dir + f).toString('base64'); const m = f.match(/^(leader|world|insignia)-([a-z]+)(?:-(\d))?\.jpg$/); if (f === 'hero-lo.jpg') art.hero = data; else if (m) { if (m[1] === 'leader') (art.leader[m[2]] = art.leader[m[2]] || [])[+m[3] - 1] = data; else art[m[1]][m[2]] = data; } }
  return '<script>window.ARD=window.ARD||{};ARD.ART=' + JSON.stringify(art) + ';</script>\n';
}
function bundle(tpl, scripts) { return read(tpl).replace('<!--SCRIPTS-->', (tpl === 'src/index.tpl.html' ? artBundle() : '') + '<script>\n' + scripts.map(read).join('\n') + '\n</script>').replace(/__BUILD__/g, BUILD); }
mkdirSync(root + 'dist', { recursive: true });
const game = bundle('src/index.tpl.html', ['src/sim.js', 'src/ai.js', 'src/voxel.js', 'src/models.js', 'src/vox3d.js', 'src/meshes.js', 'src/world3d.js', 'src/terrain3d.js', 'src/logo3d.js', 'src/leaders3d.js', 'src/progress.js', 'src/saves.js', 'src/campaign.js', 'src/campaign-ui.js', 'src/leaders.js', 'src/render.js', 'src/fx3d.js', 'src/combat3d.js', 'src/space3d.js', 'src/lakes3d.js', 'src/storm3d.js', 'src/photo3d.js' /* 4.3j: Modo Foto */, 'src/dress3d.js', 'src/m5/core.js', 'src/m5/materiais.js', 'src/m5/pos.js', 'src/m5/texturas.js' /* 5.0a: Motor 5 (WebGPURenderer + TSL) */, 'src/render3d.js', 'src/audio.js', 'src/net.js', 'src/input.js', 'src/m5/sala-som.js', 'src/m5/sala-mundo.js', 'src/m5/sala-holo.js', 'src/m5/sala-mesa.js', 'src/m5/sala.js', 'src/ui-fx.js', 'src/ui-start.js', 'src/ui-hud3.js', 'src/main.js']);
writeFileSync(root + 'dist/aether-rift-beta.html', game); writeFileSync(root + 'index.html', wrap(game));
// Cópia para testes headless com three vendorizado (node tools/vendor.mjs); carrega sem rede.
import { existsSync } from 'node:fs';
mkdirSync(root + 'dist/assets', { recursive: true }); for (const f of ['hero-belt.jpg', 'hero-belt.webp', 'favicon-64.png', 'favicon-32.png', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', ...['vehnar', 'erevane', 'tessara', 'quorith', 'vorag'].map(r => 'load-' + r + '.webp') /* 4.3l: tela de carregamento em 2560x1440, por URL (fora do bundle) */]) if (existsSync(root + 'assets/' + f)) writeFileSync(root + 'dist/assets/' + f, readFileSync(root + 'assets/' + f)); // servidos como arquivos (assets/)
// 4.3b: troca os prefixos do CDN pelas cópias de tools/vendor.mjs (three, postprocessing, N8AO), inclusive a chave que redireciona three.core.js
if (existsSync(root + 'dist/vendor/three/build/three.module.min.js')) writeFileSync(root + 'dist/local.html', wrap(game).replace(/https:\/\/cdn\.jsdelivr\.net\/npm\/(three|postprocessing|n8ao|gsap)@[0-9.]+\//g, './vendor/$1/'));
const style = bundle('style/index.tpl.html', ['src/voxel.js', 'src/models.js', 'style/scene.js', 'style/boot.js']);
writeFileSync(root + 'dist/estilo.html', style); writeFileSync(root + 'estilo.html', wrap(style));
const s3 = bundle('style3d/index.tpl.html', ['src/voxel.js', 'src/models.js', 'src/vox3d.js', 'style3d/scene3d.js', 'style3d/boot.js']);
writeFileSync(root + 'dist/estilo3d.html', s3); writeFileSync(root + 'estilo3d.html', wrap(s3));
console.log('build', BUILD, '· jogo', game.length, 'bytes · estilo', style.length, 'bytes · estilo3d', s3.length, 'bytes');
// 4.0f — PWA: service worker com o carimbo do build (cache novo a cada versão) e manifesto ao lado da página
writeFileSync(root + 'sw.js', read('tools/sw.tpl.js').replace(/__BUILD__/g, BUILD.replace(/[^0-9TZ]/g, ''))); writeFileSync(root + 'dist/sw.js', readFileSync(root + 'sw.js')); writeFileSync(root + 'dist/manifest.webmanifest', readFileSync(root + 'manifest.webmanifest'));
