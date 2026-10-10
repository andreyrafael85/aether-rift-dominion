# Galeria v5 (arte 3D): monta dist/identidade-visual.html com as imagens de dist/arte3d/*.jpg (tools/arte3d-render.cjs). Uso: python3 tools/galeria.py
import base64, os
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RACES=[('vehnar','Consórcio Vehnar','Vehnar','Barão-Forja','#FF7733','indústria'),('erevane','Erevane','Erevane','Olho do Véu','#33FFD0','furtividade'),('tessara','Tessara','Tessara','Jardineira de Traços','#55E68A','adaptação'),('quorith','Coro Quorith','Quorith','Primeira Voz','#B388FF','sincronia'),('vorag','Prole Vorag','Vorag','Boca da Prole','#E6455A','enxame')]
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
out=[css,'<div class="wrap"><div class="eyebrow">Galeria visual v5 · arte 3D · para aprovação de Andrey Rafael</div><h1>Aether Rift <span>Dominion</span> · Galeria 3D v5</h1>',
 '<p class="muted">Quinta rodada, sobre o que você aprovou: o Cinturão (Layout 3) ganhou três variações com outros planetas; o logo virou emblema de verdade, em 3D, com três conceitos; os líderes voltaram à concepção das "caras" da versão pixel, agora em 3D cartoon e com três expressões cada; o mundo Postal ganhou detalhe (sombras, rochas, unidades, luas, três momentos do dia); e a insígnia Cristal segue como aprovada.</p>']
out.append('<h2>1 · Layout: Cinturão de Asteroides, três planetas</h2><p class="muted">Mesma composição do Layout 3, com outro mundo dominando o céu, outra paleta de nebulosa e outra luz.</p><div class="grid">')
for v,name,desc,tag in [(1,'Gigante de Gelo','Gigante azul com faixas de nuvem, anéis claros de gelo e uma lua; nebulosa azul-ciano e luz fria.','FRIO. SILENCIOSO. SEU, AINDA NÃO.'),(2,'Mundo Vulcânico','Planeta de basalto com fendas de lava incandescente que iluminam o cinturão; nebulosa vermelha e asteroides queimados.','A FENDA TAMBÉM QUEIMA.'),(3,'Oceano de Tempestades','Mundo oceânico com redemoinhos brancos e uma lua grande próxima; nebulosa verde-azul e luz branca.','CINCO RAÇAS. UMA FENDA.')]:
    out.append(f'<div class="card"><span class="num">LAYOUT 3.{v}</span><div class="hero">{img(f"belt_-_{v}")}{overlay(tag)}</div><h4>{name}</h4><p>{desc}</p></div>')
out.append('</div><h2>2 · Logo: emblemas em 3D</h2><p class="muted">Agora o logo é uma marca: um emblema 3D com o nome compondo o lockup abaixo. Os três podem ser animados na tela inicial (o vórtice gira, o olho pulsa, a coroa orbita).</p><div class="grid">')
for v,name,desc,tag in [(1,'Vigia da Fenda','Um sentinela de rosto liso com um único olho em forma de Fenda, dentro de um escudo hexagonal de aço com cinco gemas e a rachadura cortando a base. Mascote e selo ao mesmo tempo.','O OLHO QUE NÃO PISCA'),(2,'Portal de Domínio','Anel de cinco arcos, um por Raça, em volta de um vórtice de partículas e de um planeta; a rachadura atravessa o portal. Lembra escudo de esporte e portal de nave.','ATRAVESSE. DOMINE.'),(3,'Coroa Orbital','Planeta anelado coroado por cinco cristais, um por Raça, sobre um escudo de aço escuro. "Dominion" literalmente: a coroa sobre o mundo.','A COROA SOBRE O MUNDO')]:
    out.append(f'<div class="card"><span class="num">LOGO {v}</span><div class="lockup">{img(f"emblem_-_{v}")}<div><div class="name">Aether Rift<span>Dominion</span></div><div class="tag">{tag}</div></div></div><h4>{name}</h4><p>{desc}</p></div>')
out.append('</div><h2>3 · Líderes em 3D cartoon, com expressões</h2><p class="muted">De volta à concepção das "caras" da versão pixel, agora modeladas em 3D cartoon: elmo e visor do Barão-Forja, o olho-fenda iridescente do Olho do Véu, a Jardineira de frondes e bochechas, a Primeira Voz de cristal e a Boca da Prole com quatro olhos e mandíbula. Três expressões por líder (sereno, furioso, triunfante), que alimentam o retrato no HUD reagindo à partida.</p>')
for rid,name,short,lead,c,_ in RACES:
    cards=''.join(f'<div class="card" style="--pc:{c}"><span class="num">{t.upper()} · {short.upper()}</span>{img(f"head_{rid}_{v}")}<div class="pname">{lead}</div></div>' for v,t in [(1,'Sereno'),(2,'Furioso'),(3,'Triunfante')])
    out.append(f'<h3 class="race"><i style="background:{c}"></i>{name} · {lead}</h3><div class="grid3">{cards}</div>')
out.append('<h2>4 · Mundos natais: Postal detalhado</h2><p class="muted">O Postal que você escolheu, com mais 3D: sombras projetadas, terreno com cristas, rochas e props da Raça (cristais, ovos, brotos, lanças de gelo, chaminés), base completa com unidades, duas luas e um planeta distante, névoa de horizonte. Três momentos: dia, crepúsculo e noite com as luzes da base.</p>')
for rid,name,short,lead,c,_ in RACES:
    cards=''.join(f'<div class="card"><span class="num">POSTAL {t.upper()} · {short.upper()}</span>{img(f"postal_{rid}_{v}")}</div>' for v,t in [(1,'Dia'),(2,'Crepúsculo'),(3,'Noite')])
    out.append(f'<h3 class="race"><i style="background:{c}"></i>{name}</h3><div class="grid3">{cards}</div>')
out.append('<h2>5 · Insígnias: Cristal <span class="ok">APROVADA</span></h2><p class="muted">Mantida como aprovada: anel translúcido na cor da Raça com 48 marcas, cinco gemas e o glifo extrudado com brilho. Entra no HUD, no placar e nas unidades.</p><div class="grid3">')
for rid,name,short,lead,c,_ in RACES:
    out.append(f'<div class="card" style="text-align:center"><span class="num">CRISTAL · {short.upper()}</span>{img(f"insignia_{rid}_3")}</div>')
out.append('''</div><h2>6 · Como aprovar</h2>
<div class="apply">Uma linha basta, por exemplo: <code>Layout 3.1 · Logo 2 · Líderes aprovados · Postal aprovado (Noite como carregamento)</code>. Pode pedir ajustes pontuais ("Vorag com mais dentes", "Logo 2 com o anel mais fino"). Aprovado, entra na 4.0b: layout animado na tela inicial, emblema como marca e favicon, líderes nos portais, na diplomacia e no HUD reagindo à partida, Postal como fundo de portal e tela de carregamento, insígnia Cristal no HUD e nas unidades.</div>
<div class="endnote">Aether Rift Dominion · galeria visual v5 · arte 3D original renderizada pelo motor do jogo · sem material de terceiros · criado para Andrey Rafael</div></div>''')
html=''.join(out); open(f'{ROOT}/dist/identidade-visual.html','w').write(html); print('galeria v5:', round(len(html)/1e6,2), 'MB')
