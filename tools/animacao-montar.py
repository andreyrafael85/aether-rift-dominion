# Monta a animação da documentação (WebP animado) a partir dos quadros de tools/capturas-docs.cjs (dist/capturas-docs/<nome>/*.jpg).
# Sem ffmpeg: só o Pillow. A duração de cada quadro (ms) vem do 5º argumento (padrão 166: 6 quadros por segundo, para quadros de 0,3 s de jogo).
# Uso: python3 tools/animacao-montar.py <nome> [largura=800] [qualidade=70] [saída=docs/imagens/partida/<nome>.webp ou -] [ms por quadro=166]
import os, sys, glob
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
nome = sys.argv[1] if len(sys.argv) > 1 else 'batalha'
larg = int(sys.argv[2]) if len(sys.argv) > 2 else 800
qual = int(sys.argv[3]) if len(sys.argv) > 3 else 70
ms = int(sys.argv[5]) if len(sys.argv) > 5 else 166
saida = sys.argv[4] if len(sys.argv) > 4 and sys.argv[4] != '-' else os.path.join(ROOT, 'docs', 'imagens', 'partida', nome + '.webp')
fs = sorted(glob.glob(os.path.join(ROOT, 'dist', 'capturas-docs', nome, '*.jpg')))
if not fs: sys.exit('sem quadros em dist/capturas-docs/' + nome)
qs = []
for f in fs:
    im = Image.open(f).convert('RGB')
    if im.width != larg: im = im.resize((larg, round(im.height * larg / im.width)), Image.LANCZOS)
    qs.append(im)
os.makedirs(os.path.dirname(saida), exist_ok=True)
qs[0].save(saida, save_all=True, append_images=qs[1:], duration=ms, loop=0, quality=qual, method=6)
print('%s: %d quadros, %.1f s, %dx%d, %.2f MB' % (os.path.relpath(saida, ROOT), len(qs), len(qs) * ms / 1000, qs[0].width, qs[0].height, os.path.getsize(saida) / 1048576))
