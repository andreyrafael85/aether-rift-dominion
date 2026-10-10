import { readFileSync, writeFileSync } from 'node:fs';
const dir = new URL('.', import.meta.url).pathname;
const tpl = readFileSync(dir + 'index.tpl.html', 'utf8');
const js = ['sim', 'ai', 'render', 'input', 'main'].map(n => readFileSync(dir + 'src/' + n + '.js', 'utf8')).join('\n');
const out = tpl.replace('<!--SCRIPTS-->', '<script>\n' + js + '\n</script>');
writeFileSync(dir + 'dist/aether-rift-beta.html', out);
// standalone copy for local headless testing (needs a document skeleton)
writeFileSync(dir + 'dist/local.html', '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + out + '</body></html>');
console.log('built', out.length, 'bytes');
