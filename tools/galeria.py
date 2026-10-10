# Galeria v4 (arte 3D): monta dist/identidade-visual.html com as imagens de dist/arte3d/*.jpg (geradas por tools/arte3d-render.cjs).
# Uso: python3 tools/galeria.py
import base64, os
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RACES=[('vehnar','Consórcio Vehnar','Vehnar','Barão-Forja','#FF7733','indústria'),('erevane','Erevane','Erevane','Olho do Véu','#33FFD0','furtividade'),('tessara','Tessara','Tessara','Jardineira de Traços','#55E68A','adaptação'),('quorith','Coro Quorith','Quorith','Primeira Voz','#B388FF','sincronia'),('vorag','Prole Vorag','Vorag','Boca da Prole','#E6455A','enxame')]
def img(name, cls='art'):
    with open(f'{ROOT}/dist/arte3d/{name}.jpg','rb') as f: return f'<img class="{cls}" src="data:image/jpeg;base64,{base64.b64encode(f.read()).decode()}" alt="">'
def bust_src(rid, which='big'):
    with open(f'{ROOT}/dist/busts/{rid}_{which}.png','rb') as f: return 'data:image/png;base64,'+base64.b64encode(f.read()).decode()
css='''<title>Galeria Aether Rift</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@600;700;800&family=IBM+Plex+Sans:wght@400;600&family=IBM+Plex+Mono:wght@400;600&display=swap">
<style>
/* Galeria v4: toda a arte é 3D renderizada pelo motor (Three.js + voxel do jogo). Tema único escuro, por marca. */
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
.art{display:block;width:100%;height:auto;border-radius:6px;border:1px solid #20242c;background:#05060b}
.hero{position:relative;border-radius:6px;overflow:hidden;border:1px solid #20242c}
.hero .art{border:0;border-radius:0}
.ov{position:absolute;inset:0;pointer-events:none}
.ov .t{position:absolute;top:7%;left:4.5%;text-shadow:0 2px 14px rgba(0,0,0,.8)}
.ov.right .t{left:auto;right:4.5%;text-align:right}
.ov .t b{display:block;font-family:var(--fd);font-weight:800;font-size:clamp(22px,6.2cqw,64px);line-height:.92;color:var(--fg);letter-spacing:.02em}
.ov .t b.g{background:linear-gradient(90deg,var(--rift1),#ff3d7a,var(--rift2));-webkit-background-clip:text;background-clip:text;color:transparent;font-size:clamp(26px,7cqw,74px)}
.ov .t small{display:block;font-family:var(--fm);font-size:clamp(8px,1.3cqw,13px);letter-spacing:.35em;color:var(--fg);opacity:.85;margin-top:.5em}
.ov .row{position:absolute;left:4.5%;right:4.5%;bottom:6%;display:flex;gap:1.2%;align-items:center}
.ov .chip{flex:1;min-width:0;background:rgba(20,23,29,.85);border:2px solid var(--rc);border-radius:8px;padding:.6cqw .9cqw;display:flex;gap:.8cqw;align-items:center}
.ov .chip i{width:2.6cqw;height:2.6cqw;border-radius:50%;border:2px solid var(--rc);background:color-mix(in srgb,var(--rc) 25%,transparent);flex:none}
.ov .chip b{font-family:var(--fd);font-size:clamp(9px,1.6cqw,18px);color:var(--fg);line-height:1}
.ov .chip small{display:block;font-family:var(--fm);font-size:clamp(6px,.9cqw,10px);color:var(--fg2)}
.ov .cta{background:linear-gradient(90deg,var(--rift1),#d4512f);color:#14161A;font-family:var(--fd);font-weight:800;font-size:clamp(10px,2cqw,22px);letter-spacing:.06em;padding:.9cqw 1.6cqw;border-radius:8px;flex:none}
.hero{container-type:inline-size}
@container (max-width:640px){.ov .chip small{display:none}.ov .chip b{font-size:clamp(7px,2.1cqw,13px)}.ov .chip{padding:.5cqw .6cqw}}
.pbox img{display:block;width:100%;height:auto;border-radius:6px;border:1px solid #20242c}
.pname{font-family:var(--fd);font-size:20px;text-transform:uppercase;color:var(--pc,#fff);margin-top:.4em;text-align:center}
.hudmock{position:relative;background:#0b0d12 url() center/cover;border:1px solid var(--line);border-radius:8px;height:230px;overflow:hidden;background:radial-gradient(70% 70% at 50% 60%,#1a1d26,#07080c)}
.lframe{position:absolute;left:14px;top:14px;width:118px;height:118px;border:2px solid var(--pc);border-radius:6px;background:radial-gradient(70% 70% at 50% 65%,color-mix(in srgb,var(--pc) 28%,transparent),#060709 80%);overflow:hidden;box-shadow:0 0 18px color-mix(in srgb,var(--pc) 45%,transparent)}
.lframe img{position:absolute;left:50%;bottom:-6px;width:92px;transform:translateX(-50%);animation:lfloat 4s ease-in-out infinite}
.lframe .scan{position:absolute;inset:0;background:repeating-linear-gradient(0deg,rgba(0,0,0,.25) 0 2px,transparent 2px 5px);pointer-events:none}
.lframe::after{content:"";position:absolute;left:0;right:0;top:-40%;height:30%;background:linear-gradient(180deg,transparent,color-mix(in srgb,var(--pc) 35%,transparent),transparent);animation:lsweep 3.2s linear infinite}
.lname{position:absolute;left:14px;top:140px;font-family:var(--fd);font-size:18px;color:var(--fg);text-transform:uppercase;letter-spacing:.04em}
.lsub{position:absolute;left:14px;top:162px;font-family:var(--fm);font-size:11px;color:var(--pc)}
@keyframes lfloat{0%,100%{transform:translateX(-50%) translateY(0)}50%{transform:translateX(-50%) translateY(-3px)}}
@keyframes lsweep{0%{top:-40%}100%{top:120%}}
@media (prefers-reduced-motion:reduce){.lframe img,.lframe::after{animation:none}}
.apply{background:#1C1F25;border:1px solid var(--line);border-left:3px solid var(--rift1);border-radius:6px;padding:12px 14px;font-size:14px;max-width:none}
.apply code{font-family:var(--fm);background:#0D0F13;border:1px solid var(--line);border-radius:4px;padding:2px 6px}
.endnote{margin:40px 0 18px;border-top:1px solid var(--line);padding-top:12px;font-family:var(--fm);font-size:12px;color:var(--fg2)}
</style>'''
def overlay(right=False, tagline='NADA AQUI É SEU. AINDA.'):
    chips=''.join(f'<div class="chip" style="--rc:{c}"><i></i><div><b>{s.upper()}</b><small>{t}</small></div></div>' for _,_,s,_,c,t in RACES)
    return (f'<div class="ov{" right" if right else ""}"><div class="t"><b>AETHER RIFT</b><b class="g">DOMINION</b><small>{tagline}</small></div>'
            f'<div class="row">{chips}<div class="cta">INICIAR PARTIDA</div></div></div>')
out=[css,'<div class="wrap"><div class="eyebrow">Galeria visual v4 · arte 3D · para aprovação de Andrey Rafael</div><h1>Aether Rift <span>Dominion</span> · Galeria 3D</h1>',
 '<p class="muted">Quarta rodada: tudo renderizado em 3D pelo motor do jogo (Three.js), com os modelos voxel reais. Nebulosas procedurais, planetas com superfície, atmosfera e anéis, metais com reflexo, bloom nos emissivos. Três versões por frente, numeradas; a interface sobre os layouts é a da tela inicial real.</p>']
out.append('<h2>1 · Layout da tela inicial (3D)</h2><div class="grid">')
for v,name,desc,right,tag in [(1,'Olho da Tempestade 3D','Vórtice de 24 mil partículas em cinco braços, um por Raça, girando em volta do núcleo negro da Fenda com anéis de fogo e violeta. É a evolução direta da versão C que você preferiu; no site, o vórtice gira devagar e reage à Raça escolhida.',False,'ENTRE NO OLHO DA TEMPESTADE.'),
 (2,'Horizonte da Fenda 3D','A curvatura de um planeta de verdade, a coluna de luz da Fenda subindo do solo e as estruturas voxel do jogo acesas no horizonte. Atmosfera e névoa de cor.',False,'NADA AQUI É SEU. AINDA.'),
 (3,'Cinturão de Asteroides 3D','Gigante gasoso com faixas de nuvem e anéis, 520 rochas facetadas em diagonal e um posto avançado aceso num asteroide de verdade no primeiro plano.',True,'CINCO RAÇAS. UMA FENDA.')]:
    out.append(f'<div class="card"><span class="num">LAYOUT {v}</span><div class="hero">{img(f"layout_-_{v}")}{overlay(right,tag)}</div><h4>{name}</h4><p>{desc}</p></div>')
out.append('</div><h2>2 · Logo (3D)</h2><div class="grid">')
for v,name,desc in [(1,'Cromo e Fenda','Letras voxel em cromo espelhado, DOMINION em gradiente de fogo a violeta, e a rachadura da Fenda atravessando o nome com brilho real.'),(2,'Cristal da Fenda','Letras de cristal translúcido com núcleo luminoso e partículas; o logo vira uma gema que emite luz própria.'),(3,'Forja','Ferro escuro com o metal incandescente vazando pelas frestas de cada bloco, fagulhas subindo e um chão de aço refletindo.')]:
    out.append(f'<div class="card"><span class="num">LOGO {v}</span>{img(f"logo_-_{v}")}<h4>{name}</h4><p>{desc}</p></div>')
out.append('</div><h2>3 · Líderes em 3D</h2><p class="muted">Os cinco bustos voxel renderizados em 3D com luz de estúdio, sombra e olhos emissivos. Três tratamentos: Estúdio (pedestal e luz neutra), Neon (contraluz na cor da Raça) e Diorama (plataforma hexagonal com anel de energia, partículas e arco).</p>')
for rid,name,short,lead,c,_ in RACES:
    cards=''.join(f'<div class="card" style="--pc:{c}"><span class="num">{t.upper()} · {short.upper()}</span><div class="pbox">{img(f"bust_{rid}_{v}")}</div><div class="pname">{lead}</div></div>' for v,t in [(1,'Estúdio'),(2,'Neon'),(3,'Diorama')])
    out.append(f'<h3 class="race"><i style="background:{c}"></i>{name} · {lead}</h3><div class="grid3">{cards}</div>')
out.append('<h2>3b · O líder no HUD (protótipo da sua ideia)</h2><p class="muted">Sua sugestão da "chamada" com o líder no canto da tela já entrou no jogo como protótipo: o retrato 2.5D da Raça escolhida aparece no canto superior esquerdo, flutua, recebe uma varredura de holograma e "fala" (pulsa) quando o sistema dá um aviso. Abaixo, o mock com os cinco líderes; no jogo ele usa o busto renderizado na hora pelo motor.</p><div class="grid3">')
for rid,name,short,lead,c,_ in RACES:
    out.append(f'<div class="card" style="--pc:{c}"><span class="num">HUD · {short.upper()}</span><div class="hudmock"><div class="lframe"><img src="{bust_src(rid)}" alt=""><div class="scan"></div></div><div class="lname">Líder {short}</div><div class="lsub">● em chamada</div></div></div>')
out.append('</div><h2>4 · Mundos natais (3D)</h2><p class="muted">Planetas com superfície procedural, atmosfera e anéis; terreno real com as construções do jogo da Raça. Postal (planeta e horizonte), Orbital (de cima, com as luzes das bases) e Superfície (a Fenda rasgando o céu).</p>')
for rid,name,short,lead,c,_ in RACES:
    cards=''.join(f'<div class="card"><span class="num">MUNDO {t.upper()} · {short.upper()}</span>{img(f"world_{rid}_{v}")}</div>' for v,t in [(1,'Postal'),(2,'Orbital'),(3,'Superfície')])
    out.append(f'<h3 class="race"><i style="background:{c}"></i>{name}</h3><div class="grid3">{cards}</div>')
out.append('<h2>5 · Insígnias (3D)</h2><p class="muted">Medalhões modelados em 3D, evoluindo a segunda opção que você aprovou: anel com 48 marcas e cinco gemas, glifo extrudado com chanfro. Ouro (anel de ouro com esmalte escuro), Aço negro (metal escuro com halo de energia) e Cristal (anel translúcido na cor da Raça).</p>')
for rid,name,short,lead,c,_ in RACES:
    cards=''.join(f'<div class="card" style="text-align:center"><span class="num">{t.upper()} · {short.upper()}</span>{img(f"insignia_{rid}_{v}")}</div>' for v,t in [(1,'Ouro'),(2,'Aço negro'),(3,'Cristal')])
    out.append(f'<h3 class="race"><i style="background:{c}"></i>{name}</h3><div class="grid3">{cards}</div>')
out.append('''<h2>6 · Como aprovar</h2>
<div class="apply">Uma linha basta, por exemplo: <code>Layout 1 · Logo 1 · Líderes: Diorama · Mundos: Postal · Insígnias: Ouro</code>. Pode misturar por Raça e pedir ajustes ("Vorag com a boca mais aberta", "logo com letras mais altas"). Aprovado, entra no jogo na 4.0b: layout na tela inicial (o vórtice em movimento), logo como marca e favicon, líderes nos portais, na diplomacia e no HUD, mundos como fundo de portal e tela de carregamento, insígnias no HUD e nas unidades.</div>
<div class="endnote">Aether Rift Dominion · galeria visual v4 · arte 3D original renderizada pelo motor do jogo · sem material de terceiros · criado para Andrey Rafael</div></div>''')
html=''.join(out); open(f'{ROOT}/dist/identidade-visual.html','w').write(html); print('galeria v4:', round(len(html)/1e6,2), 'MB')
