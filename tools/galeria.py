# Gera dist/identidade-visual.html (galeria v3): 3 layouts, 3 logos, retratos (bustos voxel renderizados pelo motor,
# pixel HD e holograma), 3 estilos de mundo e 3 estilos de insígnia por Raça. Uso: python3 tools/galeria.py
import random, base64, os
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RACES=[
 dict(id='vehnar',name='Consórcio Vehnar',short='Vehnar',lead='Barão-Forja',c='#FF7733',c2='#ffc08a',dk='#3a2416',neb=('#6a2c10','#a0501a','#ffb070'),pl=('#3a2c20','#8a5a2e','#e0a060'),atmo='#ff9a4a',tag='indústria'),
 dict(id='erevane',name='Erevane',short='Erevane',lead='Olho do Véu',c='#33FFD0',c2='#aef7e8',dk='#0d1a24',neb=('#0d3a4a','#135a4a','#4ad0c0'),pl=('#0d1420','#1f3a52','#6fb8d8'),atmo='#33ffd0',tag='furtividade'),
 dict(id='tessara',name='Tessara',short='Tessara',lead='Jardineira de Traços',c='#55E68A',c2='#b8ffd2',dk='#0f2a18',neb=('#114a2a','#2a7a1a','#8ae060'),pl=('#143322','#2f7a49','#9ee0a0'),atmo='#8affb0',tag='adaptação'),
 dict(id='quorith',name='Coro Quorith',short='Quorith',lead='Primeira Voz',c='#B388FF',c2='#efeaff',dk='#1e1436',neb=('#3a1a6e','#1a2a8e','#b090ff'),pl=('#2a2140','#6a50b0','#d8c8ff'),atmo='#c8a8ff',tag='sincronia'),
 dict(id='vorag',name='Prole Vorag',short='Vorag',lead='Boca da Prole',c='#E6455A',c2='#ffd9c2',dk='#2a0a10',neb=('#5a1020','#8e2a10','#ff7a60'),pl=('#3b1420','#8e2a3a','#ffb090'),atmo='#ff6a7c',tag='enxame'),
]
R=random.Random(7)
def rnd(a,b): return R.uniform(a,b)
def mat(c, a=0.6, bias=-0.6):
    r=int(c[1:3],16)/255; g=int(c[3:5],16)/255; b=int(c[5:7],16)/255
    return f"0 0 0 0 {r:.3f}  0 0 0 0 {g:.3f}  0 0 0 0 {b:.3f}  {a} {a} {a} 0 {bias}"
def neb(fid, seed, cols, bf=0.012, bias=-0.62, dust=True):
    c1,c2,c3=cols
    s=f'<filter id="{fid}" x="-5%" y="-5%" width="110%" height="110%">'
    s+=f'<feTurbulence type="fractalNoise" baseFrequency="{bf} {bf*1.5:.4f}" numOctaves="4" seed="{seed}" result="t1"/><feColorMatrix in="t1" type="matrix" values="{mat(c1,0.62,bias)}" result="c1"/>'
    s+=f'<feTurbulence type="fractalNoise" baseFrequency="{bf*1.9:.4f} {bf*2.4:.4f}" numOctaves="3" seed="{seed+40}" result="t2"/><feColorMatrix in="t2" type="matrix" values="{mat(c2,0.6,bias-0.02)}" result="c2"/>'
    s+=f'<feTurbulence type="fractalNoise" baseFrequency="{bf*4.5:.4f} {bf*4.5:.4f}" numOctaves="2" seed="{seed+80}" result="t3"/><feColorMatrix in="t3" type="matrix" values="{mat(c3,0.5,bias-0.12)}" result="c3"/>'
    s+='<feBlend in="SourceGraphic" in2="c1" mode="screen" result="b1"/><feBlend in="b1" in2="c2" mode="screen" result="b2"/><feBlend in="b2" in2="c3" mode="screen" result="b3"/>'
    if dust:
        s+=f'<feTurbulence type="fractalNoise" baseFrequency="{bf*0.9:.4f} {bf*0.7:.4f}" numOctaves="3" seed="{seed+120}" result="t4"/><feColorMatrix in="t4" type="matrix" values="0 0 0 0 0.02  0 0 0 0 0.02  0 0 0 0 0.04  0.9 0.9 0.9 0 -0.9" result="d1"/><feBlend in="b3" in2="d1" mode="multiply"/>'
    return s+'</filter>'
def stars(n,w,h,bright=3,top=0.85):
    out=[]
    for _ in range(n):
        x=rnd(2,w-2); y=rnd(2,h*top); r=R.choice([0.6,0.8,1.0,1.3,1.6]); o=rnd(0.3,0.95)
        out.append(f'<circle cx="{x:.0f}" cy="{y:.0f}" r="{r}" fill="#fff" opacity="{o:.2f}"/>')
    for _ in range(bright):
        x=rnd(10,w-10); y=rnd(10,h*top); l=rnd(5,10)
        out.append(f'<circle cx="{x:.0f}" cy="{y:.0f}" r="3.5" fill="#fff" opacity="0.35"/><circle cx="{x:.0f}" cy="{y:.0f}" r="1.6" fill="#fff"/><path d="M{x-l:.0f},{y:.0f} L{x+l:.0f},{y:.0f} M{x:.0f},{y-l:.0f} L{x:.0f},{y+l:.0f}" stroke="#fff" stroke-width="1" opacity="0.7"/>')
    return ''.join(out)
def galaxy(x,y,rx,ry,rot,c):
    return (f'<g transform="rotate({rot} {x} {y})"><ellipse cx="{x}" cy="{y}" rx="{rx}" ry="{ry}" fill="{c}" opacity="0.18"/>'
            f'<ellipse cx="{x}" cy="{y}" rx="{rx*0.55}" ry="{ry*0.5}" fill="{c}" opacity="0.22"/><ellipse cx="{x}" cy="{y}" rx="{rx*0.16}" ry="{ry*0.3}" fill="#fff" opacity="0.6"/></g>')
def planet(pid, cx, cy, r, pl, atmo, seed, bands=False, rings=None, moons=(), lights=None):
    d,m,l=pl; bf = "0.003 0.05" if bands else "0.02 0.02"
    s=(f'<defs><clipPath id="cp{pid}"><circle cx="{cx}" cy="{cy}" r="{r}"/></clipPath>'
       f'<filter id="sf{pid}"><feTurbulence type="fractalNoise" baseFrequency="{bf}" numOctaves="4" seed="{seed}" result="t"/><feColorMatrix in="t" type="matrix" values="{mat(l,0.8,-0.5)}" result="c1"/>'
       f'<feTurbulence type="fractalNoise" baseFrequency="{"0.004 0.09" if bands else "0.05 0.05"}" numOctaves="3" seed="{seed+9}" result="t2"/><feColorMatrix in="t2" type="matrix" values="{mat(d,0.9,-0.55)}" result="c2"/>'
       f'<feBlend in="SourceGraphic" in2="c1" mode="screen" result="b1"/><feBlend in="b1" in2="c2" mode="multiply"/></filter>'
       f'<radialGradient id="sh{pid}" cx="0.32" cy="0.3" r="0.95"><stop offset="0" stop-color="#fff" stop-opacity="0.22"/><stop offset="0.45" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.92"/></radialGradient>'
       f'<filter id="gl{pid}"><feGaussianBlur stdDeviation="{max(2,r*0.08):.1f}"/></filter></defs>')
    s+=f'<circle cx="{cx}" cy="{cy}" r="{r*1.06:.0f}" fill="none" stroke="{atmo}" stroke-width="{max(3,r*0.12):.0f}" opacity="0.55" filter="url(#gl{pid})"/>'
    if rings:
        rc,rw=rings; rx=r*1.95; ry=r*0.46
        s+=f'<g transform="rotate(-16 {cx} {cy})"><path d="M{cx-rx:.0f},{cy} A{rx:.0f},{ry:.0f} 0 0 1 {cx+rx:.0f},{cy}" fill="none" stroke="{rc}" stroke-width="{rw}" opacity="0.5"/><path d="M{cx-rx*0.78:.0f},{cy} A{rx*0.78:.0f},{ry*0.78:.0f} 0 0 1 {cx+rx*0.78:.0f},{cy}" fill="none" stroke="#000" stroke-width="{max(2,rw*0.18):.0f}" opacity="0.5"/></g>'
    s+=f'<g clip-path="url(#cp{pid})"><rect x="{cx-r}" y="{cy-r}" width="{2*r}" height="{2*r}" fill="{m}" filter="url(#sf{pid})"/>'
    if lights:
        for _ in range(lights):
            x=cx+rnd(-r*0.6,r*0.9); y=cy+rnd(-r*0.2,r*0.85)
            s+=f'<rect x="{x:.0f}" y="{y:.0f}" width="{R.choice([1,2,3])}" height="1" fill="{atmo}" opacity="{rnd(0.5,1):.2f}"/>'
    s+=f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="url(#sh{pid})"/></g>'
    if rings:
        rc,rw=rings; rx=r*1.95; ry=r*0.46
        s+=f'<g transform="rotate(-16 {cx} {cy})"><path d="M{cx-rx:.0f},{cy} A{rx:.0f},{ry:.0f} 0 0 0 {cx+rx:.0f},{cy}" fill="none" stroke="{rc}" stroke-width="{rw}" opacity="0.85"/><path d="M{cx-rx*0.78:.0f},{cy} A{rx*0.78:.0f},{ry*0.78:.0f} 0 0 0 {cx+rx*0.78:.0f},{cy}" fill="none" stroke="#000" stroke-width="{max(2,rw*0.18):.0f}" opacity="0.55"/><path d="M{cx-r*0.9:.0f},{cy+2} A{r*0.9:.0f},{ry*0.5:.0f} 0 0 0 {cx+r*0.9:.0f},{cy+2}" fill="none" stroke="#000" stroke-width="{rw*0.9:.0f}" opacity="0.35"/></g>'
    for (mx,my,mr,mc) in moons:
        s+=f'<circle cx="{mx}" cy="{my}" r="{mr}" fill="{mc}"/><circle cx="{mx}" cy="{my}" r="{mr}" fill="url(#sh{pid})"/>'
    return s
def crack(pts, gid, fid, w=10, color1='#FF5E3A', color2='#B23CFF'):
    d='M'+' L'.join(f'{x},{y}' for x,y in pts)
    return (f'<defs><linearGradient id="{gid}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="{color1}"/><stop offset="1" stop-color="{color2}"/></linearGradient><filter id="{fid}"><feGaussianBlur stdDeviation="{w*0.7:.1f}"/></filter></defs>'
            f'<path d="{d}" stroke="url(#{gid})" stroke-width="{w*1.8:.0f}" fill="none" opacity="0.45" filter="url(#{fid})"/><path d="{d}" stroke="url(#{gid})" stroke-width="{w*0.5:.1f}" fill="none"/><path d="{d}" stroke="#fff" stroke-width="{max(1,w*0.14):.1f}" fill="none" opacity="0.9"/>')
def silhouette(race, W, base, dark, light, lightc, detail=1.0):
    """duas camadas: fundo (light) e frente (dark), com luzes"""
    g=[]
    if race=='vehnar':
        back=' '.join(f'M{x},{base} V{base-rnd(24,70)*detail:.0f} h{rnd(10,26):.0f} V{base} Z' for x in range(8,W,34))
        front=' '.join(f'M{x},{base} V{base-rnd(14,44)*detail:.0f} h{rnd(14,30):.0f} V{base} Z' for x in range(0,W,44))
        chim=''.join(f'<rect x="{x}" y="{base-rnd(60,96)*detail:.0f}" width="5" height="{rnd(40,70):.0f}" fill="{dark}"/>' for x in range(20,W,120))
        lights=''.join(f'<rect x="{rnd(0,W):.0f}" y="{base-rnd(8,40):.0f}" width="2" height="2" fill="{lightc}" opacity="{rnd(0.5,1):.2f}"/>' for _ in range(int(W/14)))
        smoke=''.join(f'<circle cx="{x+2}" cy="{base-rnd(80,110):.0f}" r="{rnd(4,9):.0f}" fill="#6b7686" opacity="0.35"/>' for x in range(20,W,120))
        g=[f'<path d="{back}" fill="{light}"/>',chim,f'<path d="{front}" fill="{dark}"/>',lights,smoke]
    elif race=='erevane':
        back=' '.join(f'M{x},{base} L{x+rnd(6,16):.0f},{base-rnd(40,100)*detail:.0f} L{x+rnd(20,34):.0f},{base} Z' for x in range(0,W,40))
        front=' '.join(f'M{x},{base} L{x+rnd(8,14):.0f},{base-rnd(20,60)*detail:.0f} L{x+rnd(20,30):.0f},{base} Z' for x in range(10,W,52))
        lights=''.join(f'<circle cx="{x:.0f}" cy="{base-rnd(30,70):.0f}" r="1.4" fill="{lightc}" opacity="0.8"/>' for x in [rnd(0,W) for _ in range(int(W/70))])
        g=[f'<path d="{back}" fill="{light}"/>',f'<path d="{front}" fill="{dark}"/>',lights]
    elif race=='tessara':
        back=f'M0,{base} '+' '.join(f'Q{x+30},{base-rnd(30,70)*detail:.0f} {x+60},{base-rnd(6,24):.0f}' for x in range(0,W,60))+f' L{W},{base} Z'
        front=f'M0,{base+6} '+' '.join(f'Q{x+28},{base-rnd(10,34)*detail:.0f} {x+56},{base-rnd(0,10):.0f}' for x in range(0,W,56))+f' L{W},{base+6} Z'
        stalks=''.join(f'<path d="M{x},{base} Q{x-6},{base-30} {x+4},{base-rnd(40,80)*detail:.0f}" stroke="{dark}" stroke-width="3" fill="none"/><circle cx="{x+4}" cy="{base-rnd(40,80)*detail:.0f}" r="4" fill="{lightc}" opacity="0.9"/>' for x in range(30,W,90))
        g=[f'<path d="{back}" fill="{light}"/>',stalks,f'<path d="{front}" fill="{dark}"/>']
    elif race=='quorith':
        back=' '.join(f'M{x},{base} L{x+rnd(8,18):.0f},{base-rnd(50,120)*detail:.0f} L{x+rnd(24,36):.0f},{base} Z' for x in range(0,W,46))
        front=' '.join(f'M{x},{base} L{x+rnd(6,14):.0f},{base-rnd(24,70)*detail:.0f} L{x+rnd(18,28):.0f},{base} Z' for x in range(14,W,58))
        glints=''.join(f'<polygon points="{x},{y-6} {x+3},{y} {x},{y+6} {x-3},{y}" fill="{lightc}" opacity="{rnd(0.5,0.95):.2f}"/>' for x,y in [(rnd(0,W),base-rnd(20,110)) for _ in range(int(W/60))])
        g=[f'<path d="{back}" fill="{light}"/>',f'<path d="{front}" fill="{dark}"/>',glints]
    else:
        back=f'M0,{base} '+' '.join(f'Q{x+24},{base-rnd(20,50)*detail:.0f} {x+48},{base-rnd(4,16):.0f}' for x in range(0,W,48))+f' L{W},{base} Z'
        front=f'M0,{base+8} '+' '.join(f'Q{x+20},{base-rnd(6,26)*detail:.0f} {x+40},{base-rnd(0,8):.0f}' for x in range(0,W,40))+f' L{W},{base+8} Z'
        eggs=''.join(f'<ellipse cx="{x:.0f}" cy="{base-4}" rx="{r}" ry="{r*1.3:.0f}" fill="#e8dcc8" opacity="0.9"/>' for x,r in [(rnd(0,W),R.choice([3,4,5])) for _ in range(int(W/45))])
        spikes=''.join(f'<path d="M{x},{base} L{x+4},{base-rnd(30,60)*detail:.0f} L{x+8},{base}" fill="#e8dcc8" opacity="0.8"/>' for x in range(40,W,130))
        spores=''.join(f'<circle cx="{rnd(0,W):.0f}" cy="{base-rnd(20,120):.0f}" r="{R.choice([1,1.5,2])}" fill="{lightc}" opacity="{rnd(0.3,0.8):.2f}"/>' for _ in range(int(W/30)))
        g=[f'<path d="{back}" fill="{light}"/>',spikes,f'<path d="{front}" fill="{dark}"/>',eggs,spores]
    return ''.join(g)
FD="'Big Shoulders Display',Impact,sans-serif"; FM="'IBM Plex Mono',monospace"
def metal_text(x,y,txt,size,fill,extrude=4,shadow='#07080c',anchor='start',ls=3,stroke=None):
    s=''.join(f'<text x="{x+i}" y="{y+i}" text-anchor="{anchor}" font-family="{FD}" font-weight="800" font-size="{size}" fill="{shadow}" letter-spacing="{ls}">{txt}</text>' for i in range(extrude,0,-1))
    st=f' stroke="{stroke}" stroke-width="1" paint-order="stroke"' if stroke else ''
    return s+f'<text x="{x}" y="{y}" text-anchor="{anchor}" font-family="{FD}" font-weight="800" font-size="{size}" fill="{fill}" letter-spacing="{ls}"{st}>{txt}</text>'
GRADS=('<linearGradient id="gfire" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#FF5E3A"/><stop offset="0.55" stop-color="#ff3d7a"/><stop offset="1" stop-color="#B23CFF"/></linearGradient>'
 '<linearGradient id="gsteel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="0.45" stop-color="#d7dde6"/><stop offset="0.5" stop-color="#8e96a6"/><stop offset="1" stop-color="#e8ecf2"/></linearGradient>'
 '<linearGradient id="ggold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff0b8"/><stop offset="0.5" stop-color="#d9a94d"/><stop offset="0.55" stop-color="#8a6a24"/><stop offset="1" stop-color="#f0d27a"/></linearGradient>'
 '<filter id="gglow"><feGaussianBlur stdDeviation="6"/></filter>')
def portals_row(y, x0=48, step=150):
    s=''
    for i,r in enumerate(RACES):
        x=x0+i*step
        s+=(f'<g><rect x="{x}" y="{y}" width="134" height="64" rx="9" fill="#14171d" stroke="{r["c"]}" stroke-width="2.5"/>'
            f'<circle cx="{x+30}" cy="{y+32}" r="17" fill="{r["c"]}" opacity="0.18"/><circle cx="{x+30}" cy="{y+32}" r="17" fill="none" stroke="{r["c"]}" stroke-width="2.5"/>'
            f'<text x="{x+56}" y="{y+27}" font-family="{FD}" font-weight="700" font-size="19" fill="#E8E2D6">{r["short"].upper()}</text>'
            f'<text x="{x+56}" y="{y+46}" font-family="{FM}" font-size="10" fill="#A6A197">{r["tag"]}</text></g>')
    return s
def cta(x,y,w=186):
    return f'<rect x="{x}" y="{y}" width="{w}" height="64" rx="9" fill="url(#gfire)"/><text x="{x+w/2}" y="{y+41}" text-anchor="middle" font-family="{FD}" font-weight="800" font-size="26" fill="#14161A" letter-spacing="2">INICIAR PARTIDA</text>'

# ---------- LAYOUTS ----------
def layout_a():
    W,H=1040,520; s=f'<svg viewBox="0 0 {W} {H}" class="art" role="img"><defs>{GRADS}{neb("la",3,("#4a1a5e","#7e2a10","#ff9a60"),0.010)}</defs><rect width="{W}" height="{H}" fill="#04050a" filter="url(#la)"/>'
    s+=stars(90,W,H,4,0.7)+galaxy(880,70,120,34,-22,'#c9a8ff')
    s+=planet("pa",520,1060,660,("#1a1420","#3a2a3a","#8a6a7a"),"#ff8a5c",5)
    s+='<rect y="398" width="1040" height="122" fill="#05060b" opacity="0.5"/>'
    s+=f'<defs><linearGradient id="col" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#FF5E3A" stop-opacity="0.9"/><stop offset="0.6" stop-color="#B23CFF" stop-opacity="0.35"/><stop offset="1" stop-color="#B23CFF" stop-opacity="0"/></linearGradient></defs>'
    s+='<rect x="742" y="40" width="22" height="366" fill="url(#col)" filter="url(#gglow)"/><rect x="750" y="40" width="6" height="366" fill="url(#col)"/>'
    s+='<polygon points="753,404 600,40 660,40" fill="#FF5E3A" opacity="0.08"/><polygon points="753,404 880,40 830,40" fill="#B23CFF" opacity="0.08"/>'
    s+=silhouette('vehnar',W,404,'#07080d','#10121a','#ffb070',1.1)
    s+='<rect width="640" height="330" fill="url(#hvig)"/>'
    s=s.replace('<defs>','<defs><linearGradient id="hvig" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#04050a" stop-opacity="0.9"/><stop offset="0.6" stop-color="#04050a" stop-opacity="0.3"/><stop offset="1" stop-color="#04050a" stop-opacity="0"/></linearGradient>',1)
    s+=metal_text(48,118,"AETHER RIFT",92,"url(#gsteel)",5)+metal_text(48,210,"DOMINION",104,"url(#gfire)",5,ls=5)
    s+=f'<text x="50" y="250" font-family="{FM}" font-size="17" fill="#E8E2D6" opacity="0.85" letter-spacing="6">NADA AQUI É SEU. AINDA.</text>'
    s+=portals_row(436)+cta(806,436)+'</svg>'
    return s
def layout_b():
    W,H=1040,520; s=f'<svg viewBox="0 0 {W} {H}" class="art" role="img"><defs>{GRADS}{neb("lb",17,("#0d2a5e","#1a5a6a","#ff8a40"),0.009)}<linearGradient id="rock" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6b7080"/><stop offset="1" stop-color="#1c1f27"/></linearGradient><linearGradient id="hvig2" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="#04050a" stop-opacity="0.92"/><stop offset="0.55" stop-color="#04050a" stop-opacity="0.25"/><stop offset="1" stop-color="#04050a" stop-opacity="0"/></linearGradient></defs><rect width="{W}" height="{H}" fill="#04050a" filter="url(#lb)"/>'
    s+=stars(110,W,H,5,0.9)+galaxy(180,420,150,40,30,'#8fd8ff')
    s+=planet("pb",200,130,118,("#3a2a1a","#a06a3a","#f0c890"),"#ffd0a0",21,bands=True,rings=("#d9c8b0",26),moons=((352,40,9,"#8a8a90"),(60,250,6,"#6a6a70")))
    for i in range(150):
        t=i/150; x=t*W+rnd(-30,30); y=430-t*300+rnd(-40,40); sz=rnd(2,6)*(1.6-t)
        pts=' '.join(f'{x+sz*R.uniform(0.6,1.3)*__import__("math").cos(a*1.0472):.0f},{y+sz*R.uniform(0.6,1.3)*__import__("math").sin(a*1.0472):.0f}' for a in range(6))
        s+=f'<polygon points="{pts}" fill="url(#rock)" opacity="{rnd(0.6,1):.2f}"/>'
    s+='<path d="M640,520 L700,330 L780,296 L900,312 L1040,250 L1040,520 Z" fill="#0b0d12"/><path d="M700,330 L780,296 L900,312 L880,340 L760,352 Z" fill="#1a1d26"/>'
    s+=''.join(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="#141720"/>' for x,y,w,h in [(800,262,24,34),(830,270,16,26),(860,250,20,46),(770,280,14,20)])
    s+=''.join(f'<rect x="{x}" y="{y}" width="3" height="3" fill="#ffb070"/>' for x,y in [(806,272),(814,284),(866,262),(874,278),(836,278)])
    s+='<rect x="400" width="640" height="330" fill="url(#hvig2)"/>'
    s+=metal_text(992,118,"AETHER RIFT",92,"url(#gsteel)",5,anchor="end")+metal_text(992,210,"DOMINION",104,"url(#gfire)",5,anchor="end",ls=5)
    s+=f'<text x="990" y="250" text-anchor="end" font-family="{FM}" font-size="17" fill="#E8E2D6" opacity="0.85" letter-spacing="6">CINCO RAÇAS. UMA FENDA.</text>'
    s+='<rect y="398" width="1040" height="122" fill="#05060b" opacity="0.78"/>'+portals_row(436)+cta(806,436)+'</svg>'
    return s
def layout_c():
    import math
    W,H=1040,520; cx,cy=720,200
    s=f'<svg viewBox="0 0 {W} {H}" class="art" role="img"><defs>{GRADS}{neb("lc",31,("#2a1050","#5e1a4a","#ff6a40"),0.011,-0.7)}<filter id="vb"><feGaussianBlur stdDeviation="14"/></filter><filter id="vb2"><feGaussianBlur stdDeviation="4"/></filter><linearGradient id="hvig3" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#04050a" stop-opacity="0.92"/><stop offset="0.7" stop-color="#04050a" stop-opacity="0.2"/><stop offset="1" stop-color="#04050a" stop-opacity="0"/></linearGradient></defs><rect width="{W}" height="{H}" fill="#04050a" filter="url(#lc)"/>'
    s+=stars(100,W,H,4,0.9)
    for i,r in enumerate(RACES):
        a=i*72+18
        s+=f'<ellipse cx="{cx}" cy="{cy}" rx="270" ry="48" fill="{r["c"]}" opacity="0.24" transform="rotate({a} {cx} {cy})" filter="url(#vb)"/>'
    for k in range(10):
        a=k*36; rx=200-k*13; s+=f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{rx*0.22:.0f}" fill="none" stroke="#fff" stroke-width="1" opacity="{0.08+k*0.02:.2f}" transform="rotate({a} {cx} {cy})"/>'
    s+=f'<circle cx="{cx}" cy="{cy}" r="70" fill="#04050a"/><circle cx="{cx}" cy="{cy}" r="72" fill="none" stroke="url(#gfire)" stroke-width="5" filter="url(#vb2)"/><circle cx="{cx}" cy="{cy}" r="72" fill="none" stroke="#fff" stroke-width="1.2" opacity="0.9"/>'
    s+=f'<polygon points="{cx},{cy-36} {cx+20},{cy} {cx},{cy+36} {cx-20},{cy}" fill="url(#gfire)"/>'
    s+='<rect width="560" height="330" fill="url(#hvig3)"/>'
    s+=metal_text(48,118,"AETHER RIFT",92,"url(#gsteel)",5)+metal_text(48,210,"DOMINION",104,"url(#gfire)",5,ls=5)
    s+=f'<text x="50" y="250" font-family="{FM}" font-size="17" fill="#E8E2D6" opacity="0.85" letter-spacing="6">ENTRE NO OLHO DA TEMPESTADE.</text>'
    for i,r in enumerate(RACES):
        a=math.radians(200+i*35); x=cx+math.cos(a)*250; y=cy-math.sin(a)*130
        s+=(f'<g><circle cx="{x:.0f}" cy="{y:.0f}" r="28" fill="#14171d" stroke="{r["c"]}" stroke-width="2.5"/><circle cx="{x:.0f}" cy="{y:.0f}" r="18" fill="{r["c"]}" opacity="0.25"/>'
            f'<text x="{x:.0f}" y="{y+46:.0f}" text-anchor="middle" font-family="{FD}" font-weight="700" font-size="15" fill="#E8E2D6">{r["short"].upper()}</text></g>')
    s+='<rect y="430" width="1040" height="90" fill="#04050a" opacity="0.6"/>'+cta(48,440)+f'<text x="252" y="481" font-family="{FM}" font-size="13" fill="#A6A197" letter-spacing="4">OU ENTRE COM O CÓDIGO DE UMA SALA</text></svg>'
    return s
# ---------- LOGOS ----------
def logo1():
    s=f'<svg viewBox="0 0 560 280" class="art" role="img"><defs>{GRADS}{neb("lg1",5,("#2a1050","#5e1a4a","#ff6a40"),0.014,-0.75)}<filter id="tick"><feGaussianBlur stdDeviation="0.3"/></filter></defs><rect width="560" height="280" fill="#05060b" filter="url(#lg1)"/>'
    s+=stars(40,560,280,2)
    cx,cy=118,140
    s+=f'<circle cx="{cx}" cy="{cy}" r="104" fill="#0a0b10"/><circle cx="{cx}" cy="{cy}" r="104" fill="none" stroke="#3a2c14" stroke-width="18"/><circle cx="{cx}" cy="{cy}" r="104" fill="none" stroke="url(#ggold)" stroke-width="12"/><circle cx="{cx}" cy="{cy}" r="111" fill="none" stroke="#fff0b8" stroke-width="1" opacity="0.6"/><circle cx="{cx}" cy="{cy}" r="97" fill="none" stroke="#5a4a20" stroke-width="1"/>'
    for k in range(48):
        s+=f'<rect x="{cx-1}" y="{cy-92}" width="2" height="{8 if k%6==0 else 4}" fill="#f0d27a" transform="rotate({k*7.5} {cx} {cy})" opacity="0.9"/>'
    for i,r in enumerate(RACES):
        s+=f'<circle cx="{cx}" cy="{cy-104}" r="6" fill="{r["c"]}" stroke="#0a0b10" stroke-width="2" transform="rotate({i*72} {cx} {cy})"/>'
    s+=f'<circle cx="{cx}" cy="{cy}" r="88" fill="#06070c"/>'+''.join(f'<circle cx="{cx+rnd(-70,70):.0f}" cy="{cy+rnd(-70,70):.0f}" r="{R.choice([0.6,0.9,1.2])}" fill="#fff" opacity="{rnd(0.3,0.9):.2f}"/>' for _ in range(40))
    s+=crack([(cx-80,cy+30),(cx-30,cy+10),(cx-10,cy+22),(cx+20,cy-14),(cx+50,cy-2),(cx+82,cy-30)],"lcg","lcf",8)
    s+=f'<polygon points="{cx},{cy-46} {cx+30},{cy} {cx},{cy+46} {cx-30},{cy}" fill="url(#gfire)" filter="url(#gglow)" opacity="0.8"/><polygon points="{cx},{cy-40} {cx+26},{cy} {cx},{cy+40} {cx-26},{cy}" fill="url(#gfire)"/><polygon points="{cx},{cy-40} {cx+26},{cy} {cx},{cy}" fill="#fff" opacity="0.35"/>'
    s+=metal_text(246,118,"AETHER RIFT",58,"url(#gsteel)",4,ls=2)+metal_text(246,186,"DOMINION",66,"url(#gfire)",4,ls=4)
    s+=f'<path d="M246,204 L540,204 L530,226 L256,226 Z" fill="#1a1510" stroke="url(#ggold)" stroke-width="1.5"/><text x="393" y="220" text-anchor="middle" font-family="{FM}" font-size="12" fill="#f0d27a" letter-spacing="5">CINCO RAÇAS · UMA FENDA · 2026</text></svg>'
    return s
def logo2():
    pts=[(0,150),(90,128),(160,146),(250,104),(330,128),(430,96),(500,118),(560,98)]
    d='M'+' L'.join(f'{x},{y}' for x,y in pts)
    up=f'M0,0 L560,0 L560,98 '+' L'.join(f'{x},{y}' for x,y in reversed(pts))+' Z'
    dn=f'M0,280 L560,280 L560,98 '+' L'.join(f'{x},{y}' for x,y in reversed(pts))+' Z'
    s=f'<svg viewBox="0 0 560 280" class="art" role="img"><defs>{GRADS}{neb("lg2",11,("#1a1a5e","#3a1a6e","#ff8a50"),0.013,-0.78)}<clipPath id="cup"><path d="{up}"/></clipPath><clipPath id="cdn"><path d="{dn}"/></clipPath></defs><rect width="560" height="280" fill="#05060b" filter="url(#lg2)"/>'+stars(40,560,280,2)
    txt=lambda dx,dy: metal_text(280+dx,122+dy,"AETHER RIFT",64,"url(#gsteel)",5,anchor="middle",ls=3)+metal_text(280+dx,214+dy,"DOMINION",96,"url(#gfire)",6,anchor="middle",ls=6)
    s+=f'<g clip-path="url(#cup)">{txt(-7,-7)}</g><g clip-path="url(#cdn)">{txt(7,7)}</g>'
    s+=crack(pts,"l2g","l2f",14)
    s+=''.join(f'<circle cx="{x+rnd(-20,20):.0f}" cy="{y+rnd(-14,14):.0f}" r="{R.choice([1,1.5,2])}" fill="#ffd0a0" opacity="{rnd(0.5,1):.2f}"/>' for x,y in pts for _ in range(3))
    s+=f'<text x="280" y="262" text-anchor="middle" font-family="{FM}" font-size="12" fill="#A6A197" letter-spacing="6">A FENDA NÃO PEDE LICENÇA</text></svg>'
    return s
def logo3():
    s=f'<svg viewBox="0 0 560 280" class="art" role="img"><defs>{GRADS}{neb("lg3",23,("#3a1a6e","#1a2a5e","#ff7a50"),0.012,-0.8)}<linearGradient id="wa" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e8e2d6"/><stop offset="1" stop-color="#6b5fa0"/></linearGradient><linearGradient id="wb" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#b388ff"/><stop offset="1" stop-color="#2a1a4a"/></linearGradient></defs><rect width="560" height="280" fill="#05060b" filter="url(#lg3)"/>'+stars(50,560,280,3)
    wing=lambda sx: ''.join(f'<polygon points="{280+sx*x1},{y1} {280+sx*x2},{y2} {280+sx*x3},{y3}" fill="{f}" opacity="0.92"/>' for (x1,y1,x2,y2,x3,y3,f) in [
        (20,150,120,60,140,150,'url(#wa)'),(140,150,120,60,230,40,'url(#wb)'),(140,150,230,40,250,120,'url(#wa)'),(250,120,230,40,270,30,'url(#wb)'),(20,150,140,150,80,196,'url(#wb)'),(140,150,250,120,180,190,'url(#wa)')])
    s+=wing(-1)+wing(1)
    s+='<ellipse cx="280" cy="150" rx="250" ry="40" fill="none" stroke="#B23CFF" stroke-width="2" stroke-dasharray="8 10" opacity="0.7" transform="rotate(-8 280 150)"/>'
    s+='<rect x="120" y="86" width="320" height="130" rx="10" fill="#05060b" opacity="0.72"/>'
    s+=metal_text(280,140,"AETHER RIFT",58,"url(#gsteel)",4,anchor="middle",ls=2)+metal_text(280,200,"DOMINION",64,"url(#gfire)",4,anchor="middle",ls=5)
    s+=f'<text x="280" y="246" text-anchor="middle" font-family="{FM}" font-size="12" fill="#A6A197" letter-spacing="6">DOMÍNIO SOBRE A FENDA</text></svg>'
    return s
# ---------- MUNDOS ----------
def world(style, r, i):
    W,H=320,200; rid=f'{r["id"]}{style}'
    s=f'<svg viewBox="0 0 {W} {H}" class="art" role="img"><defs>{neb("w"+rid,100+i*7+ord(style),r["neb"],0.016,-0.66)}</defs><rect width="{W}" height="{H}" fill="#04050a" filter="url(#w{rid})"/>'
    s+=stars(36,W,H,2,0.75)
    if style=='p':   # Postal: planeta à direita, horizonte com silhueta
        s+=planet("pp"+rid,238,64,46,r["pl"],r["atmo"],300+i,bands=(r["id"] in ('vehnar','quorith')),rings=(("#d9c8b0",12) if r["id"]=='vehnar' else None),moons=(((292,22,6,'#8a8a90'),) if i%2 else ()))
        s+=silhouette(r["id"],W,164,'#06070c','#0f1118',r["c"],1.0)+f'<rect y="164" width="{W}" height="36" fill="#04050a"/>'
    elif style=='o': # Orbital: planeta grande embaixo com luzes de cidades
        s+=planet("po"+rid,160,290,190,r["pl"],r["atmo"],400+i,bands=(r["id"]=='vehnar'),lights=60)
        s+=galaxy(60+i*55,36+(i%2)*18,70,20,-30+i*25,r["c2"])
    else:            # Superfície: céu com a Fenda, duas camadas de relevo
        s+=crack([(0,120),(60,96),(120,112),(200,70),(260,92),(320,60)],"wc"+rid,"wf"+rid,6)
        s+=silhouette(r["id"],W,150,'#0b0d14','#181b26',r["c"],1.3)+silhouette(r["id"],W,182,'#04050a','#0b0d14',r["c"],0.7)
    return s+'</svg>'
# ---------- INSÍGNIAS ----------
def glyph(r):
    c=r["c"]; c2=r["c2"]
    return {
     'vehnar': f'<circle r="25" fill="none" stroke="url(#gsteel)" stroke-width="9"/>'+''.join(f'<rect x="-6" y="-36" width="12" height="10" fill="#d7dde6" transform="rotate({k*60})"/>' for k in range(6))+f'<path d="M0,-16 C-10,-2 -6,8 0,16 C6,8 10,-2 0,-16 Z" fill="{c}"/><path d="M0,-8 C-4,0 -2,4 0,8 C2,4 4,0 0,-8 Z" fill="{c2}"/>',
     'erevane': f'<path d="M14,-44 A44,44 0 1 0 14,44 A32,32 0 1 1 12,-24 A18,18 0 1 0 -8,6" fill="none" stroke="{c}" stroke-width="7" stroke-linecap="round"/><circle cx="-8" cy="6" r="8" fill="{c}"/><circle cx="-8" cy="6" r="3.2" fill="#07202a"/>',
     'tessara': f'<path d="M0,42 V-8" stroke="#d9a94d" stroke-width="6" stroke-linecap="round"/><path d="M0,16 L-22,0 M0,4 L22,-12 M0,-8 L-16,-28" stroke="{c}" stroke-width="6" stroke-linecap="round"/><g fill="{c2}"><polygon points="-22,0 -34,-8 -26,-20 -14,-12"/><polygon points="22,-12 34,-20 26,-32 14,-24"/><polygon points="-16,-28 -22,-42 -10,-48 -4,-34"/></g>',
     'quorith': f'<polygon points="-26,32 -32,-10 -16,-20 -10,32" fill="{c}" opacity="0.9"/><polygon points="-6,32 -12,-32 8,-42 12,32" fill="{c2}"/><polygon points="16,32 14,-6 30,-14 34,32" fill="{c}" opacity="0.9"/><path d="M-38,40 Q0,30 38,40" stroke="{c}" stroke-width="3.5" fill="none"/>',
     'vorag': f'<g fill="{c}"><polygon points="-38,-22 -20,-22 -29,4"/><polygon points="-18,-22 0,-22 -9,4"/><polygon points="2,-22 20,-22 11,4"/><polygon points="22,-22 38,-22 30,4"/><polygon points="-29,34 -11,34 -20,10"/><polygon points="-9,34 9,34 0,10"/><polygon points="11,34 29,34 20,10"/></g><line x1="-38" y1="6" x2="38" y2="6" stroke="{c2}" stroke-width="2.5" stroke-dasharray="4 6" opacity="0.8"/>',
    }[r["id"]]
def insignia(style, r, i):
    rid=f'{r["id"]}{style}'; c=r["c"]
    s=f'<svg viewBox="0 0 180 180" class="insig" role="img"><defs>{GRADS}{neb("i"+rid,500+i*5+ord(style),r["neb"],0.03,-0.6,False)}<clipPath id="ic{rid}"><circle cx="90" cy="90" r="60"/></clipPath><clipPath id="is{rid}"><path d="M90,18 L156,42 L152,112 L90,164 L28,112 L24,42 Z"/></clipPath><filter id="ig{rid}"><feDropShadow dx="0" dy="0" stdDeviation="5" flood-color="{c}" flood-opacity="0.95"/></filter><filter id="ib{rid}"><feGaussianBlur stdDeviation="8"/></filter></defs>'
    if style=='b':   # Brasão facetado
        s+=f'<path d="M90,12 L162,38 L158,114 L90,172 L22,114 L18,38 Z" fill="#2a2f38"/><path d="M90,18 L156,42 L152,112 L90,164 L28,112 L24,42 Z" fill="url(#gsteel)"/><path d="M90,24 L150,46 L146,110 L90,156 L34,110 L30,46 Z" fill="#0c0e14"/>'
        s+=f'<g clip-path="url(#is{rid})"><rect width="180" height="180" fill="#05060b" filter="url(#i{rid})" opacity="0.9"/><polygon points="90,24 150,46 90,156 30,46" fill="#fff" opacity="0.06"/></g>'
        s+=f'<path d="M90,24 L150,46 L146,110 L90,156 L34,110 L30,46 Z" fill="none" stroke="{c}" stroke-width="2"/>'
    elif style=='m': # Medalhão ornamentado
        s+=f'<circle cx="90" cy="90" r="80" fill="#0e1016"/><circle cx="90" cy="90" r="80" fill="none" stroke="#3a4150" stroke-width="10"/><circle cx="90" cy="90" r="80" fill="none" stroke="url(#ggold)" stroke-width="5"/>'
        s+=''.join(f'<rect x="89" y="12" width="2" height="{7 if k%9==0 else 4}" fill="#f0d27a" transform="rotate({k*10} 90 90)"/>' for k in range(36))
        s+=f'<circle cx="90" cy="90" r="66" fill="none" stroke="{c}" stroke-width="1.5" stroke-dasharray="3 5" opacity="0.8"/>'
        s+=f'<g clip-path="url(#ic{rid})"><rect width="180" height="180" fill="#05060b" filter="url(#i{rid})"/>{stars(12,180,180)}</g><circle cx="90" cy="90" r="60" fill="none" stroke="{c}" stroke-width="2.5"/>'
    else:            # Marca viva: glifo solto com energia da Raça
        s+=f'<circle cx="90" cy="90" r="50" fill="{c}" opacity="0.22" filter="url(#ib{rid})"/>'
        energy={'vehnar':''.join(f'<circle cx="{90+rnd(-60,60):.0f}" cy="{90+rnd(-60,60):.0f}" r="{R.choice([1,1.5,2])}" fill="#ffd27f"/>' for _ in range(16)),
                'erevane':''.join(f'<line x1="{20+k*8}" y1="{40+k*14}" x2="{60+k*8}" y2="{40+k*14}" stroke="{c}" stroke-width="2" opacity="0.35"/>' for k in range(7)),
                'tessara':''.join(f'<path d="M{90+rnd(-40,40):.0f},150 Q{90+rnd(-60,60):.0f},{90+rnd(-20,40):.0f} {90+rnd(-50,50):.0f},{30+rnd(0,30):.0f}" stroke="{c}" stroke-width="2" fill="none" opacity="0.4"/>' for _ in range(5)),
                'quorith':''.join(f'<circle cx="90" cy="90" r="{38+k*12}" fill="none" stroke="{c}" stroke-width="1.5" opacity="{0.5-k*0.1:.2f}"/>' for k in range(4)),
                'vorag':''.join(f'<circle cx="{90+rnd(-70,70):.0f}" cy="{90+rnd(-70,70):.0f}" r="{R.choice([1.5,2,3])}" fill="{c}" opacity="{rnd(0.3,0.8):.2f}"/>' for _ in range(18))}[r["id"]]
        s+=energy
    s+=f'<g transform="translate(90 90) scale(1.0)" filter="url(#ig{rid})">{glyph(r)}</g></svg>'
    return s
# ---------- RETRATOS (bustos) ----------
def b64(path):
    with open(path,'rb') as f: return 'data:image/png;base64,'+base64.b64encode(f.read()).decode()
def portrait_cards(r):
    big=b64(f'{ROOT}/dist/busts/{r["id"]}_big.png'); px=b64(f'{ROOT}/dist/busts/{r["id"]}_px.png')
    c=r["c"]
    a=(f'<div class="card pcard" style="--pc:{c}"><span class="num">BUSTO 2.5D · {r["short"].upper()}</span><div class="pbox"><img class="bust" src="{big}" alt=""></div><div class="pname">{r["lead"]}</div><p>Renderizado pelo motor voxel do jogo, com luz, sombra e olhos emissivos. É o mesmo material que anima em partida.</p></div>')
    b=(f'<div class="card pcard" style="--pc:{c}"><span class="num">PIXEL HD · {r["short"].upper()}</span><div class="pbox"><img class="bust pix" src="{px}" alt=""></div><div class="pname">{r["lead"]}</div><p>A mesma cabeça em pixel art de 8 bits, nítida, para ícones, diplomacia e chat.</p></div>')
    h=(f'<div class="card pcard holo" style="--pc:{c}"><span class="num">HOLOGRAMA · {r["short"].upper()}</span><div class="pbox"><img class="bust" src="{big}" alt=""><img class="bust ghost" src="{big}" alt=""><div class="scan"></div></div><div class="pname">{r["lead"]}</div><p>Projeção holográfica para a tela de carregamento e o briefing da campanha.</p></div>')
    return a,b,h
# ---------- PÁGINA ----------
css='''<title>Galeria Aether Rift</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@600;700;800&family=IBM+Plex+Sans:wght@400;600&family=IBM+Plex+Mono:wght@400;600&display=swap">
<style>
/* Galeria v3: tema único escuro (marca). Arte em SVG (nebulosas por ruído fractal, planetas texturizados) e bustos PNG renderizados pelo motor. */
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
.insig{display:block;width:min(180px,80%);height:auto;margin:4px auto}
.pcard{text-align:center;position:relative}
.pbox{position:relative;height:250px;display:grid;place-items:end center;overflow:hidden;border-radius:8px;background:radial-gradient(65% 55% at 50% 60%,color-mix(in srgb,var(--pc) 30%,transparent),#05060b 75%);border:1px solid #20242c}
.bust{max-height:240px;max-width:90%;filter:drop-shadow(0 10px 18px rgba(0,0,0,.6))}
.bust.pix{image-rendering:pixelated;max-height:none;height:200px;width:auto}
.holo .pbox{background:radial-gradient(60% 50% at 50% 60%,color-mix(in srgb,var(--pc) 22%,transparent),#03070c 75%)}
.holo .bust{filter:saturate(.35) brightness(1.25) contrast(1.1) sepia(.6) hue-rotate(130deg) drop-shadow(0 0 14px var(--pc));opacity:.95}
.holo .ghost{position:absolute;left:50%;bottom:0;transform:translateX(calc(-50% + 3px));opacity:.35;filter:saturate(.3) brightness(1.4) hue-rotate(260deg);mix-blend-mode:screen}
.holo .scan{position:absolute;inset:0;background:repeating-linear-gradient(0deg,rgba(0,0,0,.35) 0 2px,transparent 2px 5px);pointer-events:none}
.pname{font-family:var(--fd);font-size:20px;text-transform:uppercase;color:var(--pc,#fff);margin-top:.4em}
.apply{background:#1C1F25;border:1px solid var(--line);border-left:3px solid var(--rift1);border-radius:6px;padding:12px 14px;font-size:14px;max-width:none}
.apply code{font-family:var(--fm);background:#0D0F13;border:1px solid var(--line);border-radius:4px;padding:2px 6px}
.endnote{margin:40px 0 18px;border-top:1px solid var(--line);padding-top:12px;font-family:var(--fm);font-size:12px;color:var(--fg2)}
</style>'''
out=[css,'<div class="wrap"><div class="eyebrow">Galeria visual v3 · para aprovação de Andrey Rafael</div><h1>Aether Rift <span>Dominion</span> · Galeria v3</h1>',
 '<p class="muted">Terceira rodada, com técnica nova em todas as frentes: nebulosas em quatro camadas com faixas de poeira, planetas com superfície texturizada e atmosfera, tipografia metálica com extrusão, e os líderes como <b>bustos voxel renderizados pelo motor do jogo</b>, em 2.5D com luz e profundidade. Três versões por frente, numeradas.</p>']
out.append('<h2>1 · Layout da tela inicial</h2><div class="grid">')
for num,svg,name,desc in [("LAYOUT A",layout_a(),"Horizonte da Fenda","Um planeta imenso cortando a base, a coluna de luz da Fenda subindo do horizonte entre chaminés, raios atravessando a poeira. Os portais ficam sobre a curvatura."),
 ("LAYOUT B",layout_b(),"Cinturão de Asteroides","Gigante gasoso anelado e um cinturão de 150 rochas em diagonal; no primeiro plano, um posto avançado aceso num asteroide. Composição em diagonal, título à direita."),
 ("LAYOUT C",layout_c(),"Olho da Tempestade","Um vórtice com cinco braços, um por Raça, girando em volta do núcleo da Fenda; os portais orbitam o olho em arco e o nome entra abaixo.")]:
    out.append(f'<div class="card"><span class="num">{num}</span>{svg}<h4>{name}</h4><p>{desc}</p></div>')
out.append('</div><h2>2 · Logo</h2><div class="grid">')
for num,svg,name,desc in [("LOGO 1",logo1(),"Selo de Ouro da Fenda","Medalhão com anel de ouro chanfrado, 48 marcas de calibração, cinco gemas (uma por Raça) e o núcleo da Fenda partido por uma rachadura. Tipografia em aço com extrusão."),
 ("LOGO 2",logo2(),"Nome Rasgado","A Fenda atravessa o próprio nome: a parte de cima e a de baixo das letras se deslocam, a luz vaza pela rachadura com fagulhas."),
 ("LOGO 3",logo3(),"Asas de Cristal","Duas asas facetadas de cristal abertas atrás do nome, anel orbital e placa escura central. O mais heráldico dos três.")]:
    out.append(f'<div class="card"><span class="num">{num}</span>{svg}<h4>{name}</h4><p>{desc}</p></div>')
out.append('</div><h2>3 · Retratos dos líderes (2.5D)</h2><p class="muted">Cada líder foi modelado em voxel e renderizado pelo motor do jogo. Três tratamentos: busto 2.5D, pixel HD e holograma.</p>')
for r in RACES:
    a,b,h=portrait_cards(r)
    out.append(f'<h3 class="race"><i style="background:{r["c"]}"></i>{r["name"]} · {r["lead"]}</h3><div class="grid3">{a}{b}{h}</div>')
out.append('<h2>4 · Mundos natais</h2><p class="muted">Três enquadramentos por Raça: Postal (planeta e horizonte), Orbital (o planeta visto de cima, com as luzes das bases) e Superfície (o céu com a Fenda sobre duas camadas de relevo).</p>')
for i,r in enumerate(RACES):
    out.append(f'<h3 class="race"><i style="background:{r["c"]}"></i>{r["name"]}</h3><div class="grid3">')
    for st,nm in [('p','Postal'),('o','Orbital'),('s','Superfície')]:
        out.append(f'<div class="card"><span class="num">MUNDO {nm.upper()} · {r["short"].upper()}</span>{world(st,r,i)}</div>')
    out.append('</div>')
out.append('<h2>5 · Insígnias</h2><p class="muted">Três estilos por Raça: Brasão facetado em aço, Medalhão de ouro com nebulosa interna, e Marca viva (o glifo solto com a energia da Raça).</p>')
for i,r in enumerate(RACES):
    out.append(f'<h3 class="race"><i style="background:{r["c"]}"></i>{r["name"]}</h3><div class="grid3">')
    for st,nm in [('b','Brasão'),('m','Medalhão'),('v','Marca viva')]:
        out.append(f'<div class="card" style="text-align:center"><span class="num">{nm.upper()} · {r["short"].upper()}</span>{insignia(st,r,i)}</div>')
    out.append('</div>')
out.append('''<h2>6 · Como aprovar</h2>
<div class="apply">Uma linha basta, por exemplo: <code>Layout B · Logo 1 · Retratos: busto 2.5D · Mundos: Superfície · Insígnias: Medalhão</code>. Pode misturar por Raça ("Vorag com o holograma") e pedir ajustes ("mais nebulosa roxa no Layout A", "Quorith com o cristal mais alto"). Aprovado, entra no jogo: layout e logo na tela inicial e no favicon; retratos nos portais, na diplomacia e na tela de fim; mundos como fundo de portal e tela de carregamento; insígnias no HUD, no placar e nas unidades.</div>
<div class="endnote">Aether Rift Dominion · galeria visual v3 · arte original (SVG + bustos voxel do motor do jogo), sem material de terceiros · criado para Andrey Rafael</div></div>''')
open(f'{ROOT}/dist/identidade-visual.html','w').write(''.join(out))
print('galeria v3:', len(''.join(out)), 'bytes')
