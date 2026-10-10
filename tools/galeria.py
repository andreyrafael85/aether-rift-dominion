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
out=[css,'<div class="wrap"><div class="eyebrow">Galeria visual v6 · aprovações aplicadas · logo para fechar</div><h1>Aether Rift <span>Dominion</span> · Galeria v6</h1>',
 '<p class="muted">O que você aprovou já está no jogo (build 4.0b): o Cinturão Oceano de Tempestades como fundo da tela inicial, os cinco líderes com os nomes novos nos portais e no HUD reagindo à partida, o Postal de dia como tela de carregamento e fundo dos portais, e a insígnia Cristal no retrato. Falta fechar o logo: seis emblemas novos abaixo, reestilizados com borda grossa de selo.</p>']
out.append('<h2>1 · Aplicado no jogo <span class="ok">APROVADO</span></h2><div class="grid">')
out.append(f'<div class="card"><span class="num">LAYOUT C · OCEANO DE TEMPESTADES</span><div class="hero">{img("belt_-_3")}{overlay("CINCO RAÇAS. UMA FENDA.")}</div><p>Fundo da tela inicial. Na 4.0c passa a girar devagar (nuvens e cinturão em movimento).</p></div>')
out.append('</div><h3 class="race"><i style="background:#FF5E3A"></i>Líderes com os nomes novos</h3><div class="grid3">')
for rid,name,short,lead,c,_ in RACES:
    v={'vehnar':3,'erevane':2,'tessara':2,'quorith':2,'vorag':1}[rid]
    out.append(f'<div class="card" style="--pc:{c}"><span class="num">{short.upper()} · RETRATO {"ABC"[v-1]}</span>{img(f"head_{rid}_{v}")}<div class="pname">{lead}</div><p>Era "{ {"vehnar":"Barão-Forja","erevane":"Olho do Véu","tessara":"Jardineira de Traços","quorith":"Primeira Voz","vorag":"Boca da Prole"}[rid] }". Nos portais, no HUD, no carregamento e na tela de fim.</p></div>')
out.append('</div><h3 class="race"><i style="background:#55E68A"></i>Mundos: Postal de dia</h3><div class="grid3">')
for rid,name,short,lead,c,_ in RACES: out.append(f'<div class="card"><span class="num">{short.upper()} · DIA</span>{img(f"postal_{rid}_1")}</div>')
out.append('</div><h3 class="race"><i style="background:#B388FF"></i>Insígnias: Cristal</h3><div class="grid3">')
for rid,name,short,lead,c,_ in RACES: out.append(f'<div class="card" style="text-align:center"><span class="num">{short.upper()}</span>{img(f"insignia_{rid}_3")}</div>')
out.append('</div><h2>2 · Logo: seis emblemas novos</h2><p class="muted">Reestilização pedida: cada emblema ganhou borda grossa de selo (contorno escuro + aro metálico), silhueta mais forte e menos brilho difuso, para funcionar grande na tela inicial e pequeno como favicon. O nome compõe o lockup abaixo.</p><div class="grid">')
for v,name,desc,tag in [(1,'Garra sobre o Mundo','Uma garra quitinosa da Prole fechando sobre um planeta vivo, num escudo hexagonal: dominar é segurar. A rachadura corre na base.','SEGURE O QUE É SEU'),
 (2,'Olho do Vórtice','O olho que é a própria Fenda: pálpebras de fogo e violeta, íris de vórtice com cinco braços e a pupila-núcleo. O mais icônico dos seis.','A FENDA OLHA DE VOLTA'),
 (3,'Trono de Cristal','Pentágono de aço com cinco cristais, um por Raça, apontando para o núcleo da Fenda. Combina com a insígnia Cristal aprovada.','CINCO VOZES, UM TRONO'),
 (4,'Cometa Dominion','Um cometa riscando um selo dourado, planeta anelado e lua: velocidade e conquista. Bom para animação de abertura.','RISQUE O CÉU'),
 (5,'Cinco Luas','Selo de ouro com sessenta marcas e cinco mundos orbitando o núcleo da Fenda: o mapa político do jogo num emblema.','CINCO MUNDOS, UMA FENDA'),
 (6,'Elmo do Barão','Mascote: o elmo do Barão-Forja com visor incandescente e chifres de aço, num escudo. Caminho de logo com personagem, como nas referências.','A FORJA NUNCA DORME')]:
    out.append(f'<div class="card"><span class="num">LOGO {v}</span><div class="lockup">{img(f"emblem2_-_{v}")}<div><div class="name">Aether Rift<span>Dominion</span></div><div class="tag">{tag}</div></div></div><h4>{name}</h4><p>{desc}</p></div>')
out.append("""</div><h2>3 · Como aprovar</h2>
<div class="apply">Responda com o número do logo (ou "Logo 2 com as pálpebras mais finas", por exemplo). Com o logo fechado, ele entra na tela inicial, no favicon, na tela de carregamento e no rodapé; depois sigo para o restante da 4.0b: layout animado, diplomacia com os líderes e as Raças novas jogáveis.</div>
<div class="endnote">Aether Rift Dominion · galeria visual v6 · arte 3D original renderizada pelo motor do jogo · sem material de terceiros · criado para Andrey Rafael</div></div>""")
html=''.join(out); open(f'{ROOT}/dist/identidade-visual.html','w').write(html); print('galeria v6:', round(len(html)/1e6,2), 'MB')
