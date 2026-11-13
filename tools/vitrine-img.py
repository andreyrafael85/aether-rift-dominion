# Redução e codificação das imagens da vitrine (tools/vitrine.cjs e tools/galeria.cjs), só com o Pillow.
# O jogo é desenhado maior que o tamanho final (deviceScaleFactor 2 ou o supersampling da galeria) e reduzido aqui com Lanczos:
# cada pixel final é a média de vários do desenho (supersampling), sem serrilhado nem borrão.
# Uso:
#   python3 tools/vitrine-img.py reduz <lista.json>   lista de [origem, destino, largura, altura, qualidade]; o formato vem da extensão
#                                                     do destino (.webp, .jpg ou .png); altura 0 = proporcional
#   python3 tools/vitrine-img.py anima <pasta> <saida.webp> <largura> <qualidade> <ms por quadro>
#                                                     WebP animado dos PNG da pasta (em ordem), reduzidos com Lanczos
#   python3 tools/vitrine-img.py recorte <origem> <x> <y> <l> <a> <zoom> <destino>   recorte ampliado sem filtro (para o relatório)
import sys, json, os, glob
from PIL import Image

def reduz(im, w, h):
    if h <= 0: h = round(im.height * w / im.width)
    return im if (im.width, im.height) == (w, h) else im.resize((w, h), Image.LANCZOS, reducing_gap=None)

def salva(im, dst, q):
    os.makedirs(os.path.dirname(os.path.abspath(dst)), exist_ok=True)
    ext = os.path.splitext(dst)[1].lower()
    if ext == '.webp': im.save(dst, 'WEBP', quality=q, method=6)
    elif ext in ('.jpg', '.jpeg'): im.convert('RGB').save(dst, 'JPEG', quality=q, optimize=True, progressive=True, subsampling=0)  # 4:4:4: o texto do HUD e as bordas coloridas sem borrão de cor
    else: im.save(dst, 'PNG', optimize=True)

cmd = sys.argv[1]
if cmd == 'reduz':
    lista = json.load(open(sys.argv[2]))
    tot = 0
    for o, d, w, h, q in lista:
        im = Image.open(o); im = im.convert('RGBA' if im.mode in ('RGBA', 'LA') and d.lower().endswith(('.png', '.webp')) else 'RGB')
        salva(reduz(im, w, h), d, q); tot += os.path.getsize(d)
    print('%d imagens, %.2f MB' % (len(lista), tot / 1048576))
elif cmd == 'anima':
    pasta, saida, larg, q, ms = sys.argv[2], sys.argv[3], int(sys.argv[4]), int(sys.argv[5]), int(sys.argv[6])
    fs = sorted(glob.glob(os.path.join(pasta, '*.png')))
    if not fs: sys.exit('sem quadros em ' + pasta)
    qs = [reduz(Image.open(f).convert('RGB'), larg, 0) for f in fs]
    os.makedirs(os.path.dirname(os.path.abspath(saida)), exist_ok=True)
    qs[0].save(saida, 'WEBP', save_all=True, append_images=qs[1:], duration=ms, loop=0, quality=q, method=5, allow_mixed=False, minimize_size=False)
    print('%s: %d quadros, %.1f s, %dx%d, %.2f MB' % (saida, len(qs), len(qs) * ms / 1000, qs[0].width, qs[0].height, os.path.getsize(saida) / 1048576))
elif cmd == 'recorte':
    o, x, y, l, a, z, d = sys.argv[2], int(sys.argv[3]), int(sys.argv[4]), int(sys.argv[5]), int(sys.argv[6]), int(sys.argv[7]), sys.argv[8]
    im = Image.open(o).convert('RGB').crop((x, y, x + l, y + a)); im.resize((l * z, a * z), Image.NEAREST).save(d)
    print(d)
else:
    sys.exit('comando desconhecido: ' + cmd)
