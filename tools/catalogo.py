#!/usr/bin/env python3
"""Monta dist/catalogo-3d.html: catálogo dos modelos 3D por Raça (4.0d) a partir de dist/catalogo3d/*.png (tools/catalogo-render.cjs)."""
import base64, io, os, sys
from PIL import Image
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); src = os.path.join(root, 'dist', 'catalogo3d')
RACES = [('vehnar', 'Consórcio Vehnar', '#FF7733', 'Aço chanfrado, faixas na cor da equipe, chaminés com brasa, tanques com cintas e listras de perigo.'),
         ('erevane', 'Erevane', '#33FFD0', 'Placas angulares de vidro escuro ("origami"), costuras luminosas e agulhas com ponta acesa.'),
         ('tessara', 'Tessara', '#55E68A', 'Cascos orgânicos cor de osso, nervuras, raízes, pétalas e bulbos bioluminescentes.'),
         ('quorith', 'Coro Quorith', '#B388FF', 'Cristal facetado lilás, núcleos de ametista acesos e anéis flutuantes; quase nada encosta no chão.'),
         ('vorag', 'Prole Vorag', '#E6455A', 'Quitina úmida escura, placas sobrepostas, espinhos de osso, sacos membranosos e poros acesos.')]
def img(name, w=1600):
    p = os.path.join(src, name + '.png')
    if not os.path.exists(p): return None
    im = Image.open(p).convert('RGB'); im.thumbnail((w, w)); b = io.BytesIO(); im.save(b, 'JPEG', quality=84, optimize=True, progressive=True)
    return 'data:image/jpeg;base64,' + base64.b64encode(b.getvalue()).decode()
build = sys.argv[1] if len(sys.argv) > 1 else ''
sec = []
for rid, name, col, desc in RACES:
    b, u = img(rid + '-b'), img(rid + '-u')
    if not b or not u: continue
    sec.append(f'<section class="race" style="--rc:{col}"><h2>{name}</h2><p class="desc">{desc}</p><figure><img src="{b}" alt="Construções 3D: {name}" loading="lazy"><figcaption>Construções (Núcleo, Reator, Refinaria, Quartel, Fábrica, Hangar, Torre, Nódulo, Laboratório, Muro, Portão, Bastião)</figcaption></figure><figure><img src="{u}" alt="Unidades 3D: {name}" loading="lazy"><figcaption>Unidades (gerais e exclusivas da Raça)</figcaption></figure></section>')
cen = img('cenario')
if cen: sec.append(f'<section class="race" style="--rc:#9fb0c4"><h2>Cenário neutro</h2><p class="desc">Nós de Plasma, Minério e Dados, rochas, ruínas, caixas, carcaças e os adereços de território de cada Raça.</p><figure><img src="{cen}" alt="Cenário neutro 3D" loading="lazy"></figure></section>')
shots = [(n, img(n, 1280)) for n in ['jogo-vehnar', 'jogo-erevane', 'jogo-tessara', 'jogo-horizonte']]
shots = [(n, d) for n, d in shots if d]
if shots: sec.append('<section class="race" style="--rc:#FF5E3A"><h2>Dentro da partida</h2><p class="desc">Os mesmos modelos no jogo, com céu, terreno detalhado, bandeiras e a inclinação de horizonte (planeta-mãe no céu).</p>' + ''.join(f'<figure><img src="{d}" alt="{n}" loading="lazy"></figure>' for n, d in shots) + '</section>')
html = f'''<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Catálogo 3D das Raças</title>
<style>
:root{{--bg:#0d0f13;--fg:#e8ecf2;--fg2:#a6afbd;--line:#262b33}}
@media (prefers-color-scheme: light){{:root:not([data-theme="dark"]){{--bg:#0d0f13;--fg:#e8ecf2;--fg2:#a6afbd;--line:#262b33}}}}
:root[data-theme="dark"]{{--bg:#0d0f13}}
*{{box-sizing:border-box}}body{{margin:0;background:var(--bg);color:var(--fg);font:16px/1.55 system-ui,-apple-system,Segoe UI,sans-serif}}
main{{max-width:1180px;margin:0 auto;padding:28px 16px 60px}}h1{{font-size:clamp(26px,4vw,40px);margin:.2em 0}}.eyebrow{{color:#FF5E3A;font:600 12px/1 ui-monospace,monospace;letter-spacing:.12em;text-transform:uppercase}}
.lead{{color:var(--fg2);max-width:820px}}.race{{margin:38px 0;border-top:3px solid var(--rc);padding-top:14px}}.race h2{{margin:.1em 0;color:var(--rc)}}.desc{{color:var(--fg2);margin:.2em 0 .8em}}
figure{{margin:14px 0}}img{{width:100%;height:auto;border-radius:10px;border:1px solid var(--line);display:block}}figcaption{{color:var(--fg2);font-size:14px;margin-top:6px}}
</style></head><body><main><div class="eyebrow">Aether Rift: Dominion · Versão 4.0d · Engine gráfica 2{(' · build ' + build) if build else ''}</div><h1>Catálogo 3D das Raças</h1>
<p class="lead">Todas as construções e unidades das cinco Raças agora são modelos 3D suaves gerados em código, com material físico por peça (cor, rugosidade e metal) e reflexo do ambiente. Cada Raça tem um kit de arquitetura próprio; as plantas das construções são as mesmas para manter a leitura do jogo. A cor de destaque (laranja nas imagens) é a cor da equipe do jogador.</p>
{''.join(sec)}</main></body></html>'''
out = os.path.join(root, 'dist', 'catalogo-3d.html'); open(out, 'w').write(html); print('catálogo: %.2f MB' % (len(html) / 1e6))
