# Galeria v5 (arte 3D): monta dist/identidade-visual.html com as imagens de dist/arte3d/*.jpg (tools/arte3d-render.cjs). Uso: python3 tools/galeria.py
import base64, os
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RACES=[('vehnar','Consórcio Vehnar','Vehnar','Barão-Forja','#FF7733','indústria'),('erevane','Erevane','Erevane','Vesper Ísk','#33FFD0','furtividade'),('tessara','Tessara','Tessara','Sylva Oriel','#55E68A','adaptação'),('quorith','Coro Quorith','Quorith','Zayin Coral','#B388FF','sincronia'),('vorag','Prole Vorag','Vorag','Oru Voraz','#E6455A','enxame')]
def img(name, cls='art'):
    with open(f'{ROOT}/dist/arte3d/{name}.jpg','rb') as f: return f'<img class="{cls}" src="data:image/jpeg;base64,{base64.b64encode(f.read()).decode()}" alt="">'
css='''<title>Galeria Aether Rift</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@600;700;800&family=IBM+Plex+Sans:wght@400;600&family=IBM+Plex+Mono:wght@400;600&display=swap">
<style>
/* Galeria v5: arte 3D do motor (Three.js + voxel do jogo). Tema único escuro, por marca. */
:root{--bg:#0D0F13;--panel:#14171d;--line:#2E333B;--fg:#E8E2D6;--fg2:#A6A197;--rift1:#FF5E3A;--rift2:#B23CFF;
--fd:'Big Shoulders Display','Arial Narrow',Impact,sans-serif;--fb:'IBM Plex Sans',system-ui,sans-serif;--fm:'IBM Plex Mono',ui-monospace,monospace;color-scheme:dark}
body{background:var(--bg);color:var(--fg);font-family:var(--fb);margin:0;padding:0 16px;line-height:1.5}
.wrap{max-width:1080px;margin:0 auto;padding-block:36px 24px}
.eyebrow{font-family:var(--fm);font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:var(--rift1)}
h1{font-family:var(--fd);font-weight:800;font-size:clamp(32px,6vw,54px);margin:.15em 0;text-transform:uppercase;line-height:.95}
h1 span{background:linear-gradient(90deg,var(--rift1),var(--rift2));-webkit-background-clip:text;background-clip:text;color:transparent}
h2{font-family:var(--fd);font-size:clamp(22px,3.4vw,30px);text-transform:uppercase;margin:1.8em 0 .35em}
h3.race{font-family:var(--fd);font-size:20px;text-transform:uppercase;margin:1.4em 0 .4em;display:flex;gap:10px;align-items:center}
h3.race i{width:14px;height:14px;border-radius:3px;display:inline-block}
p{max-width:74ch}.muted{color:var(--fg2)}
.grid{display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(300px,1fr))}
.grid3{display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(240px,1fr))}
.card{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:12px;min-width:0}
.card h4{font-family:var(--fd);text-transform:uppercase;font-size:17px;margin:.55em 0 .15em}
.card .num{font-family:var(--fm);font-size:10.5px;letter-spacing:.14em;color:var(--fg2)}
.card p{font-size:13px;color:var(--fg2);margin:.25em 0 0}
.ok{display:inline-block;font-family:var(--fm);font-size:10px;letter-spacing:.1em;background:#1f6b3a;color:#dfffe9;border-radius:3px;padding:2px 6px;margin-left:6px}
.art{display:block;width:100%;height:auto;border-radius:6px;border:1px solid #20242c;background:#05060b}
.hero{position:relative;border-radius:6px;overflow:hidden;border:1px solid #20242c;container-type:inline-size}
.hero .art{border:0;border-radius:0}
.ov{position:absolute;inset:0;pointer-events:none}
.ov .t{position:absolute;top:7%;right:4.5%;text-align:right;text-shadow:0 2px 14px rgba(0,0,0,.8)}
.ov .t b{display:block;font-family:var(--fd);font-weight:800;font-size:clamp(22px,6.2cqw,64px);line-height:.92;color:var(--fg);letter-spacing:.02em}
.ov .t b.g{background:linear-gradient(90deg,var(--rift1),#ff3d7a,var(--rift2));-webkit-background-clip:text;background-clip:text;color:transparent;font-size:clamp(26px,7cqw,74px)}
.ov .t small{display:block;font-family:var(--fm);font-size:clamp(8px,1.3cqw,13px);letter-spacing:.35em;color:var(--fg);opacity:.85;margin-top:.5em}
.ov .row{position:absolute;left:4.5%;right:4.5%;bottom:6%;display:flex;gap:1.2%;align-items:center}
.ov .chip{flex:1;min-width:0;background:rgba(20,23,29,.85);border:2px solid var(--rc);border-radius:8px;padding:.6cqw .9cqw;display:flex;gap:.8cqw;align-items:center}
.ov .chip i{width:2.6cqw;height:2.6cqw;border-radius:50%;border:2px solid var(--rc);background:color-mix(in srgb,var(--rc) 25%,transparent);flex:none}
.ov .chip b{font-family:var(--fd);font-size:clamp(9px,1.6cqw,18px);color:var(--fg);line-height:1}
.ov .chip small{display:block;font-family:var(--fm);font-size:clamp(6px,.9cqw,10px);color:var(--fg2)}
.ov .cta{background:linear-gradient(90deg,var(--rift1),#d4512f);color:#14161A;font-family:var(--fd);font-weight:800;font-size:clamp(10px,2cqw,22px);letter-spacing:.06em;padding:.9cqw 1.6cqw;border-radius:8px;flex:none}
@container (max-width:640px){.ov .chip small{display:none}.ov .chip b{font-size:clamp(7px,2.1cqw,13px)}.ov .chip{padding:.5cqw .6cqw}}
.lockup{display:grid;grid-template-columns:1fr;gap:10px;align-items:center;text-align:center}
.lockup .art{width:min(100%,340px);margin:0 auto;border-radius:50%;border:1px solid #2a2f3a}
.lockup .name{font-family:var(--fd);font-weight:800;font-size:clamp(30px,5vw,46px);line-height:.9;color:var(--fg);letter-spacing:.03em;text-transform:uppercase}
.lockup .name span{display:block;background:linear-gradient(90deg,var(--rift1),#ff3d7a,var(--rift2));-webkit-background-clip:text;background-clip:text;color:transparent;font-size:1.18em}
.lockup .tag{font-family:var(--fm);font-size:11px;letter-spacing:.35em;color:var(--fg2);text-transform:uppercase}
.pname{font-family:var(--fd);font-size:20px;text-transform:uppercase;color:var(--pc,#fff);margin-top:.4em;text-align:center}
.apply{background:#1C1F25;border:1px solid var(--line);border-left:3px solid var(--rift1);border-radius:6px;padding:12px 14px;font-size:14px;max-width:none}
.apply code{font-family:var(--fm);background:#0D0F13;border:1px solid var(--line);border-radius:4px;padding:2px 6px}
.endnote{margin:40px 0 18px;border-top:1px solid var(--line);padding-top:12px;font-family:var(--fm);font-size:12px;color:var(--fg2)}
</style>'''
def overlay(tagline):
    chips=''.join(f'<div class="chip" style="--rc:{c}"><i></i><div><b>{s.upper()}</b><small>{t}</small></div></div>' for _,_,s,_,c,t in RACES)
    return f'<div class="ov"><div class="t"><b>AETHER RIFT</b><b class="g">DOMINION</b><small>{tagline}</small></div><div class="row">{chips}<div class="cta">INICIAR PARTIDA</div></div></div>'
def imgfile(path, cls='art'):
    with open(path,'rb') as f: return f'<img class="{cls}" src="data:image/jpeg;base64,{base64.b64encode(f.read()).decode()}" alt="">'
out=[css+'<style>.fav{display:flex;gap:18px;align-items:center;justify-content:center;margin:.6em 0 .2em}.fav img{border-radius:50%;object-fit:cover;border:1px solid #2a2f3a}.fav span{font-family:var(--fm);font-size:10px;color:var(--fg2);display:block;text-align:center;margin-top:4px}</style>','<div class="wrap"><div class="eyebrow">Galeria visual v7 · logo final e fundo em alta</div><h1>Aether Rift <span>Dominion</span> · Galeria v7</h1>',
 '<p class="muted">Duas versões finais do logo, combinando o que você destacou: o escudo de defesa do Logo 6, o selo com os cinco mundos e luzes do Logo 5, e a rachadura da Fenda cortando o meio como no Logo 1. Cada uma com o lockup e a prévia em tamanho de favicon. Abaixo, o fundo da tela inicial agora em 2560×1280.</p>']
out.append('<h2>1 · Logo: versões finais</h2><div class="grid">')
for v,name,desc,tag in [(1,'Escudo das Cinco Luas','Escudo de aço com aro de ouro e sessenta marcas; dentro, o selo com os cinco mundos em órbita plana ao redor do núcleo da Fenda, e a rachadura atravessando o centro. Simétrico, legível em qualquer tamanho.','CINCO MUNDOS, UM ESCUDO'),
 (2,'Escudo-Órbita','Mesmo escudo, em aço, com a órbita inclinada em 3D: os cinco mundos passam na frente e atrás do núcleo, e a rachadura corre na posição do Logo 1, abaixo do centro. Mais dinâmico, pede animação (a órbita gira).','A ÓRBITA DO DOMÍNIO')]:
    out.append(f'<div class="card"><span class="num">LOGO FINAL {v}</span><div class="lockup">{img(f"emblem3_-_{v}")}<div><div class="name">Aether Rift<span>Dominion</span></div><div class="tag">{tag}</div></div></div><div class="fav">'
      + ''.join(f'<div>{img(f"emblem3_-_{v}","")[:-1]} style="width:{sz}px;height:{sz}px"><span>{sz} px</span></div>' for sz in (96,48,24)) + f'</div><h4>{name}</h4><p>{desc}</p></div>')
out.append('</div><h2>2 · Fundo da tela inicial em alta resolução</h2><p class="muted">O hero foi renderizado de novo em 2560×1280 com texturas em dobro (planeta, nebulosa), 7 mil estrelas e 1.100 rochas facetadas. No site ele carrega como arquivo separado de 270 KB, com um placeholder leve para o primeiro paint; o pixelado que você viu era a versão de 960 px esticada.</p><div class="card">'+imgfile(f'{ROOT}/assets/hero-belt.jpg')+'</div>')
out.append("""<h2>3 · Como aprovar</h2>
<div class="apply">Responda <code>Logo final 1</code> ou <code>Logo final 2</code> (com ajustes, se quiser: "aro de ouro na 2", "rachadura mais fina"). Fechado o logo, ele entra na tela inicial, no favicon, no carregamento e no rodapé, e sigo com o restante da 4.0b.</div>
<div class="endnote">Aether Rift Dominion · galeria visual v7 · arte 3D original renderizada pelo motor do jogo · sem material de terceiros · criado para Andrey Rafael</div></div>""")
html=''.join(out); open(f'{ROOT}/dist/identidade-visual.html','w').write(html); print('galeria v7:', round(len(html)/1e6,2), 'MB')
