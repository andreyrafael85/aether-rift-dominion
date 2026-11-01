/* Aether Rift: Dominion — Motor 5 (5.0b, fase 2): porte dos modelos para TSL (vale no WebGPU e na reserva WebGL2 do WebGPURenderer).
   O que entra aqui, com a mesma conta dos shaders GLSL do clássico (src/meshes.js e src/render3d.js):
   - detalhe de superfície por peça (SURF_GLSL): painéis com costuras, rebites e grades nos metais, sulcos na borracha, poros no osso,
     células na quitina, granulado na pedra e estratos na rocha; preso à peça (posição de repouso e atributo pt), apagado quando a peça
     fica pequena na tela (fwidth) e com a intensidade de ARD.m5.u.detalhe. Relevo pela derivada de tela, como o ardPerturb;
   - animação por peça (ANIM_GLSL): rodas, rotores, pernas, recuo, sobe e desce, asas, balanço e lagartas, aplicada no espaço do modelo,
     ANTES da matriz da instância, como no clássico (passo prévio, abaixo);
   - ruína (RUIN_GLSL): peças em arco balístico que giram e assentam, miolo que desaba, escurece e fica em brasa, torreta arrancada;
   - invólucros de obra por Raça, holograma da planta (Erevane), escudos do Uníssono e o pano das bandeiras ondulando.
   Entra pelos ganchos da fundação (ARD.m5.ganchos.modelo.posicao / superficie / emissivo), por materiais novos que o render3d pede no
   Motor 5 (obraMat, holo, escudo, pano) e por ajudantes de geometria (entrelaca: 8 buffers de vértice por pipeline no WebGPU; ruinaGeo e
   holoGeo: layout fixo para o que nasce no meio da partida). Segue as regras de carga da 5.0a.1 (work-carga/RELATORIO.md §8): instâncias
   por atributo (ARD.m5.instMat/instCor, malhas ARD.m5.Inst), variação por uniform (as duas Raças de casulo dividem um shader), ruídos como
   funções do WGSL (Fn().setLayout), alfa aditivo elevado a 2,2 sem pós, nada de luz pontual, tudo nascendo na carga.
   Contrato: work-fundacao/RELATORIO.md §2. Só visual: nada aqui lê ou muda a simulação. */
(function (ARD) {
'use strict';
const M5 = ARD.m5 = ARD.m5 || {};
const T = () => window.THREE_M5, L = () => window.TSL;
const DESLIGA = typeof location !== 'undefined' && /[?&]m5modelos=0/.test(location.search); /* medida: ?m5modelos=0 = o Motor 5 sem este porte (como a 5.0a.1) */
M5.modelos = { versao: '5.0b', ativo: !DESLIGA };
const DUAS = typeof location !== 'undefined' && /[?&]m5casulo2=1/.test(location.search);

/* ---------- portes ligados (o render3d consulta ARD.m5.portado(chave) na criação) e fora da lista de pendências ---------- */
M5.porte = M5.porte || {};
if (!DESLIGA) { for (const k of ['ruinas', 'obras', 'holograma', 'escudos', 'bandeiras']) M5.porte[k] = true;
  if (Array.isArray(M5.pendencias)) M5.pendencias = M5.pendencias.filter(p => !/^(meshes|render3d \((ruínas|obras|escudos|bandeiras)\))$/.test(p.modulo)); }

/* ---------- passo prévio do setupPosition ----------
   O clássico anima a peça e monta a ruína no espaço do modelo, antes da instância (begin_vertex). Aqui o gancho de posição devolve um
   marcador com .ardPre(builder): um passo que mexe em positionLocal e normalLocal no espaço do modelo (como o skinning do three).
   No material do jogo, o ARD.m5.instMat (src/m5/materiais.js) roda o passo no começo do setupPosition, antes da matriz de instância
   (iM0..iM3 do ARD.m5.Inst) e da normal, e põe o .ardPre no positionNode. O material de sombra do r186 copia o positionNode
   (_getShadowNodes); este remendo único no NodeMaterial roda o mesmo passo nele, então a sombra anima igual. Sem marcador, nada muda. */
let pronto = false, fH2 = null, fVN = null, fHS = null;
function prepara() {
  if (pronto || !T()) return; const NM = T().NodeMaterial; const base = NM.prototype.setupPosition;
  if (base && !base.ardPasso) { const passo = function (builder) { const pn = this.positionNode; if (pn && typeof pn.ardPre === 'function' && !(this.userData && this.userData.m5Inst)) pn.ardPre(builder); return base.call(this, builder); };
    passo.ardPasso = true; NM.prototype.setupPosition = passo; } /* material do jogo (userData.m5Inst): o instMat já rodou o passo antes da instância */
  /* ruídos do clássico (ardH2, ardVN, ardHs) como funções do WGSL/GLSL (regra 6 da carga): o código sai uma vez por shader, não a cada chamada */
  const { Fn, fract, sin, dot, vec2, floor, mix } = L();
  fH2 = Fn(([p]) => fract(sin(dot(p, vec2(127.1, 311.7))).mul(43758.5453))).setLayout({ name: 'ardH2', type: 'float', inputs: [{ name: 'p', type: 'vec2' }] });
  fVN = Fn(([p]) => { const i = floor(p).toVar(), f = fract(p).toVar(), u = f.mul(f).mul(f.mul(-2).add(3)).toVar(); return mix(mix(fH2(i), fH2(i.add(vec2(1, 0))), u.x), mix(fH2(i.add(vec2(0, 1))), fH2(i.add(vec2(1, 1))), u.x), u.y); }).setLayout({ name: 'ardVN', type: 'float', inputs: [{ name: 'p', type: 'vec2' }] });
  fHS = Fn(([n]) => fract(sin(n.mul(12.9898).add(4.1)).mul(43758.5453))).setLayout({ name: 'ardHs', type: 'float', inputs: [{ name: 'n', type: 'float' }] });
  pronto = true;
}
M5.modelos.prepara = prepara;
M5.modelos.VN = p => VN(p); /* 5.0e: o mesmo ruído (a mesma função do WGSL) nos materiais 2.0 do src/m5/unidades.js: uma função própria lá mudava a ordem das funções de um material para o outro */
M5.modelos.ruidos = () => { prepara(); return { H2: fH2, VN: fVN, HS: fHS }; }; /* 5.0e: os mesmos ruídos para a obra (src/m5/obra.js), sem cópia no WGSL */
const OBRA = () => !!(M5.obra && M5.obra.ativo); /* 5.0e: Obra 2.0 (src/m5/obra.js; ?obra5=0 desliga) */
const RUINA5 = typeof location === 'undefined' || !/[?&]ruina5=0/.test(location.search); /* 5.0e: as peças da ruína quicam uma vez no chão (?ruina5=0: como na 5.0d) */
const H2 = p => fH2(p), VN = p => fVN(p), HS = n => fHS(n);
/* marcador: um nó vec3 qualquer (nunca é gerado como posição) que leva o passo; um por material */
function marcador(pre, nome) { const mk = L().positionLocal.toVar('ardPos'); mk.ardPre = pre; mk.ardNome = nome; return mk; }
/* sem pós (Baixa, celular): o clássico soma o aditivo em sRGB depois dos tons e o Motor 5 em linear antes deles; com o alfa elevado a 2,2
   a pegada volta à do clássico (regra 11 da carga). Um uniform só, atualizado uma vez por quadro (M5.cur.post é o RenderPipeline do pós) */
let semPos = null;
function semPosU() { if (!semPos) semPos = M5.u.semPos || L().uniform(0).onFrameUpdate(() => (M5.cur && M5.cur.post ? 0 : 1)); return semPos; } /* 5.0b.1: o ARD.m5.u.semPos do núcleo (o mesmo do terreno e dos efeitos) */
let expo = null; function expoU() { return expo || (expo = (M5.foto && M5.foto.exposicao && M5.foto.exposicao()) || L().uniform(1)); } /* 5.0b (junção): a exposição em uso (ARD.m5.u.exposicao do Modo Foto; 1 na partida) */

/* ---------- animação por peça (ANIM_GLSL, 4.2b): aAnim = [tipo, pivô xyz], aAnimB = parâmetros; aInst = [distância, tempo, movimento, recuo],
   aInstC = giro integrado. 1 roda (eixo z pela distância), 2 giro (eixo y/x/z), 3 perna, 4 recuo, 5 sobe e desce, 6 asa (eixo x), 7 balanço, 8 lagarta.
   aInst/aInstC por instância: no ARD.m5.Inst vão na geometria da malha (o render3d liga em animLiga) */
function preAnim(builder) {
  const g = builder.geometry; if (!g || !g.hasAttribute('aAnim')) return; /* geometria sem peça animada: nada (o clássico lê zeros) */
  const { Fn, If, Var, attribute, float, vec3, vec4, sin, cos, max, floor, select, positionLocal, normalLocal } = L();
  Fn(() => {
    const aA = attribute('aAnim', 'vec4'), aB = attribute('aAnimB', 'vec4');
    const aI = g.hasAttribute('aInst') ? attribute('aInst', 'vec4') : vec4(0, 0, 0, 0), aC = g.hasAttribute('aInstC') ? attribute('aInstC', 'float') : float(0);
    const ty = Var(aA.x, 'ardTy');
    const ang = Var(float(0), 'ardAng'), eixo = Var(float(2), 'ardEixo'), tr = Var(vec3(0, 0, 0), 'ardTr'); /* eixo: 0 y, 1 x, 2 z */
    If(OBRA() ? ty.greaterThan(0.5).and(M5.obra.parada(aI)) : ty.greaterThan(0.5), () => { /* 5.0e: na obra as peças ficam paradas (o aInst leva o corte) */
      If(ty.lessThan(1.5), () => { ang.assign(aI.x.negate().div(max(aB.x, 0.05))); })
        .ElseIf(ty.lessThan(2.5), () => { ang.assign(aC.mul(aB.x).add(aB.z)); eixo.assign(select(aB.y.lessThan(0.5), float(0), select(aB.y.lessThan(1.5), float(1), float(2)))); })
        .ElseIf(ty.lessThan(3.5), () => { ang.assign(aB.x.mul(sin(aI.x.div(max(aB.y, 0.1)).mul(6.2831853).add(aB.z))).mul(aI.z)); })
        .ElseIf(ty.lessThan(4.5), () => { tr.assign(vec3(aB.x.negate().mul(aI.w), 0, 0)); })
        .ElseIf(ty.lessThan(5.5), () => { tr.assign(vec3(0, aB.x.mul(sin(aI.y.mul(aB.y).add(aB.z))), 0)); })
        .ElseIf(ty.lessThan(6.5), () => { ang.assign(aB.x.mul(sin(aI.y.mul(aB.y).add(aB.z))).mul(aB.w)); eixo.assign(1); })
        .ElseIf(ty.lessThan(7.5), () => { ang.assign(aB.x.mul(sin(aI.y.mul(aB.y).add(aB.z))).mul(aI.z.mul(0.65).add(0.35))); })
        .Else(() => { const e = max(aB.x, 0.1); tr.assign(vec3(aI.x.sub(floor(aI.x.div(e)).mul(e)).sub(aB.x.mul(0.5)), 0, 0)); }); /* mod do GLSL sem a função polyfill */
    });
    const c = Var(cos(ang), 'ardAc'), s = Var(sin(ang), 'ardAs');
    const gira = v => select(eixo.lessThan(0.5), vec3(v.x.mul(c).add(v.z.mul(s)), v.y, v.z.mul(c).sub(v.x.mul(s))),
      select(eixo.lessThan(1.5), vec3(v.x, v.y.mul(c).sub(v.z.mul(s)), v.y.mul(s).add(v.z.mul(c))), vec3(v.x.mul(c).sub(v.y.mul(s)), v.x.mul(s).add(v.y.mul(c)), v.z)));
    const piv = aA.yzw; const d = Var(positionLocal.sub(piv), 'ardAd');
    positionLocal.assign(gira(d).add(piv).add(tr));
    normalLocal.assign(gira(normalLocal));
    if (OBRA()) M5.obra.vertice(aI); /* 5.0e: o corte da obra (o que está acima desce até ele e vira a tampa) */
  }, 'void')();
}

/* ---------- ruína (RUIN_GLSL, 4.3f): aPiece (por vértice) = pivô xyz da peça + id (0 = miolo); aDie (por instância) = [segundos desde a queda,
   altura do modelo, semente, vida em s]. Semente negativa: a malha inteira é uma peça (torreta arrancada) com o chão em y = semente */
function preRuina(builder) {
  const g = builder.geometry; if (!g || !g.hasAttribute('aDie')) return;
  const { Fn, If, Var, attribute, float, vec2, vec3, vec4, sin, cos, max, min, abs, sqrt, length, normalize, cross, dot, smoothstep, select, positionLocal, normalLocal } = L();
  Fn(() => {
    const aP = g.hasAttribute('aPiece') ? attribute('aPiece', 'vec4') : vec4(0, 0, 0, 0), aD = attribute('aDie', 'vec4');
    const t = Var(aD.x, 'ardRt'), S = Var(max(aD.y, 0.5), 'ardRs'), sd = Var(aD.z, 'ardRd'), life = aD.w;
    const neg = Var(sd.lessThan(0), 'ardRn'); const id = Var(select(neg, float(1), aP.w), 'ardRi'), gnd = Var(select(neg, sd, float(0)), 'ardRg');
    const sink = Var(smoothstep(life.sub(4), life, t).mul(S).mul(0.9), 'ardRk');
    const ax = Var(vec3(0, 1, 0), 'ardRax'), ang = Var(float(0), 'ardRa'), cen = Var(vec3(0, 0, 0), 'ardRc'), tr = Var(vec3(0, 0, 0), 'ardRtr'), sy = Var(float(1), 'ardRsy'), tz = Var(float(0), 'ardRtz');
    If(id.greaterThan(0.5), () => {
      const c = Var(select(neg, vec3(0, 0, 0), aP.xyz), 'ardPc'); const h1 = Var(HS(id.add(sd)), 'ardH1'), h2 = Var(HS(id.mul(1.7).add(sd).add(3.1)), 'ardH2v'), h3 = Var(HS(id.mul(2.3).add(sd).add(7.7)), 'ardH3');
      const rl = Var(length(c.xz), 'ardRl'), ra = h1.mul(6.2831853);
      const rd = Var(select(rl.greaterThan(S.mul(0.05)), c.xz.div(max(rl, 1e-6)), vec2(cos(ra), sin(ra))), 'ardRdir');
      const gg = Var(S.mul(2.6), 'ardRgg'); const vy = Var(sqrt(gg.mul(2).mul(S).mul(h2.mul(0.32).add(0.08))), 'ardRvy'); const vh = S.mul(h3.mul(0.34).add(0.12));
      const dy = max(c.y.sub(gnd).sub(S.mul(0.04)), 0); const tl = Var(vy.add(sqrt(vy.mul(vy).add(gg.mul(2).mul(dy)))).div(gg), 'ardRtl'); const tt = Var(min(t, tl), 'ardRtt');
      tr.assign(vec3(rd.x.mul(vh).mul(tt), vy.mul(tt).sub(gg.mul(0.5).mul(tt).mul(tt)).sub(sink), rd.y.mul(vh).mul(tt)));
      ax.assign(normalize(vec3(h2.sub(0.5), h3.sub(0.5).mul(0.35), h1.sub(0.5)).add(0.0001))); ang.assign(h3.mul(3.5).add(1.2).mul(tt)); cen.assign(c);
      if (RUINA5) { const vb = abs(vy.sub(gg.mul(tl))).mul(h1.mul(0.12).add(0.22)); const tb = Var(min(max(t.sub(tl), 0), vb.mul(2).div(gg)), 'ardRtb'); /* 5.0e: depois de cair, a peça quica uma vez (pula ~1/4 da velocidade da queda), escorrega e gira mais um pouco */
        tr.addAssign(vec3(rd.x.mul(vh).mul(tb).mul(0.35), vb.mul(tb).sub(gg.mul(0.5).mul(tb).mul(tb)), rd.y.mul(vh).mul(tb).mul(0.35))); ang.addAssign(h3.mul(1.4).add(0.5).mul(tb)); }
    }).Else(() => {
      const c1 = Var(smoothstep(0.05, 1.5, t), 'ardRc1'); tz.assign(c1.mul(0.16).mul(HS(sd).sub(0.5)).mul(2)); sy.assign(float(1).sub(c1.mul(0.42)));
      tr.assign(vec3(0, S.mul(-0.05).mul(c1).sub(sink), 0));
    });
    /* peça: giro de Rodrigues em volta de ax; miolo: achata em y e inclina em z (mesma matriz do GLSL, aplicada também à normal) */
    const cs = Var(cos(ang), 'ardRcs'), sn = Var(sin(ang), 'ardRsn'), k1 = float(1).sub(cs);
    const zc = Var(cos(tz), 'ardRzc'), zs = Var(sin(tz), 'ardRzs');
    const xf = v => { const pc = v.mul(cs).add(cross(ax, v).mul(sn)).add(ax.mul(dot(ax, v).mul(k1))); const u = vec3(v.x, v.y.mul(sy), v.z); const mc = vec3(u.x.mul(zc).sub(u.y.mul(zs)), u.x.mul(zs).add(u.y.mul(zc)), u.z); return select(id.greaterThan(0.5), pc, mc); };
    const d = Var(positionLocal.sub(cen), 'ardRp');
    positionLocal.assign(xf(d).add(cen).add(tr));
    normalLocal.assign(xf(normalLocal));
  }, 'void')();
}

/* ---------- pano das bandeiras (4.0d): onda no espaço do pano (antes da instância); a fase vem do atributo aFase por instância, que o
   render3d escreve (o clássico tira da matriz da instância) ---------- */
function prePano(builder) {
  const g = builder.geometry; if (!g) return; const { Fn, attribute, float, vec3, sin, positionLocal } = L(); const U = M5.u;
  const amp = builder.material && builder.material.positionNode && builder.material.positionNode.ardOnda; /* 5.0c.1: a força da onda (1 no pano, 0 no mastro): o mastro roda o mesmo vértice e divide o pipeline do pano; vem no positionNode porque o material de sombra o copia */
  Fn(() => { const ph = g.hasAttribute('aFase') ? attribute('aFase', 'float') : float(0); const k = positionLocal.x; const a = sin(k.mul(3).sub(U.tempo.mul(2.6)).add(ph)).mul(0.03).mul(k), b = sin(k.mul(5).sub(U.tempo.mul(4.2)).add(ph)).mul(0.09).mul(k);
    positionLocal.assign(positionLocal.add(amp ? vec3(0, a.mul(amp), b.mul(amp)) : vec3(0, a, b))); }, 'void')(); /* × 1 no pano é exato; × 0 no mastro soma zero */
}

/* ---------- detalhe de superfície (SURF_GLSL, 4.3a/4.3b): devolve vec3(relevo, albedo, rugosidade) já com o apagamento k ----------
   pt por peça: 1 painéis, 2 borracha, 3 poros, 4 quitina, 5 pedra, 6 rocha; 0 liso. Tudo o que é usado em mais de um ramo é Var no escopo de fora
   (o TSL declara a variável onde ela é gerada primeiro: um valor criado dentro de um If e lido fora sairia sem valor) */
function superficieNo() {
  const { Fn, If, Loop, Var, float, vec2, vec3, abs, floor, fract, min, max, mix, step, smoothstep, length, dot, sqrt, fwidth, select, positionGeometry, normalGeometry } = L();
  return Fn(() => {
    const pl = positionGeometry, an = Var(abs(normalGeometry), 'ardSn');
    const pt = Var(floor(M5.attr('pt', float(0)).add(0.5)), 'ardSpt');
    const ex = step(an.y, an.x).mul(step(an.z, an.x)), ey = float(1).sub(ex).mul(step(an.z, an.y));
    const uv = Var(mix(mix(pl.xy, pl.xz, ey), pl.zy, ex), 'ardSuv');
    const fw = max(fwidth(uv.x), fwidth(uv.y)); /* fora de qualquer ramo: derivada em fluxo uniforme */
    const k = Var(float(1).sub(smoothstep(0.035, 0.11, fw)).mul(M5.u.detalhe), 'ardSk');
    const h = Var(float(0), 'ardSh'), alb = Var(float(1), 'ardSa'), rgh = Var(float(0), 'ardSr');
    If(pt.greaterThan(0.5).and(k.greaterThan(0)), () => {
      If(pt.lessThan(1.5), () => { /* 1 painéis: costuras, rebites nos cantos, grades de ventilação, sujeira embaixo */
        const cs = vec2(2.6, 1.6); const c0 = uv.div(cs); const fy = floor(c0.y); const c = Var(vec2(c0.x.add(fy.sub(floor(fy.div(3)).mul(3)).mul(0.37)), c0.y), 'ardP1c'); /* mod(fy, 3) sem a função polyfill do TSL: a ordem dela no WGSL variava entre materiais e separava o shader */
        const id = floor(c), f = Var(fract(c), 'ardP1f');
        const hv = Var(H2(id), 'ardP1h'), hw = H2(id.add(7.3)); const e = Var(min(f, float(1).sub(f)).mul(cs), 'ardP1e'); const exx = select(hw.lessThan(0.45), float(9), e.x);
        const seam = Var(float(1).sub(smoothstep(0.012, 0.04, min(exx, e.y))), 'ardP1s');
        const q = abs(f.sub(0.5)).mul(cs).sub(cs.mul(0.5).sub(0.16)); const rv = Var(select(hv.greaterThan(0.55), float(1).sub(smoothstep(0.025, 0.045, length(q))), float(0)), 'ardP1r');
        const vent = Var(select(hv.lessThan(0.12), smoothstep(0.35, 0.5, abs(fract(f.y.mul(7)).sub(0.5))).mul(step(0.18, f.x)).mul(step(f.x, 0.82)).mul(step(0.15, f.y)).mul(step(f.y, 0.85)), float(0)), 'ardP1v');
        const pv = hv.sub(0.5); const grime = Var(VN(uv.mul(3.1)).mul(float(1).sub(smoothstep(0, 2.4, pl.y))).add(VN(uv.mul(11)).mul(VN(uv.mul(0.9))).mul(0.35)), 'ardP1g');
        h.assign(seam.mul(-0.6).add(rv.mul(0.35)).sub(vent.mul(0.5)));
        alb.assign(float(1).add(pv.mul(0.09)).sub(seam.mul(0.26)).add(rv.mul(0.08)).sub(vent.mul(0.3)).mul(float(1).sub(grime.mul(0.2))));
        rgh.assign(pv.mul(0.12).add(seam.mul(0.1)).add(grime.mul(0.18)));
      }).ElseIf(pt.lessThan(2.5), () => { /* 2 borracha: sulcos */
        const gr = Var(smoothstep(0.3, 0.44, abs(fract(uv.x.mul(1.8).add(uv.y.mul(0.2))).sub(0.5))), 'ardP2');
        h.assign(gr.mul(-0.7)); alb.assign(float(1).sub(gr.mul(0.18))); rgh.assign(gr.mul(0.05));
      }).ElseIf(pt.lessThan(4.5), () => { /* 3 poros (osso, pele) e 4 células (quitina, úmido): Voronoi 3×3 */
        const p = uv.mul(select(pt.lessThan(3.5), float(2.6), float(1.5))); const i = Var(floor(p), 'ardVi'), f = Var(fract(p), 'ardVf');
        const d1 = Var(float(8), 'ardVq1'), d2 = Var(float(8), 'ardVq2');
        Loop({ start: -1, end: 1, condition: '<=', name: 'sy' }, { start: -1, end: 1, condition: '<=', name: 'sx' }, ({ sy, sx }) => { const o = vec2(float(sx), float(sy)); const io = i.add(o); const r = o.add(vec2(H2(io), H2(io.add(17)))).sub(f); const d = Var(dot(r, r)); d2.assign(min(d2, max(d, d1))); d1.assign(min(d1, d)); }); /* 5.0b.1: as 9 células num laço do WGSL (antes 9 cópias coladas), na mesma ordem */
        const D1 = Var(sqrt(d1), 'ardVd1'), D2 = sqrt(d2);
        const pore = Var(float(1).sub(smoothstep(0, 0.16, D1)), 'ardV3'), edge = Var(float(1).sub(smoothstep(0, 0.09, D2.sub(D1))), 'ardV4'); const p3 = Var(pt.lessThan(3.5), 'ardV34');
        h.assign(select(p3, pore.mul(-0.6).add(VN(uv.mul(7)).mul(0.25)), edge.mul(-0.7).add(D1.mul(0.3))));
        alb.assign(select(p3, float(1).sub(pore.mul(0.2)), float(0.92).add(D1.mul(0.14)).sub(edge.mul(0.22))));
        rgh.assign(select(p3, pore.mul(0.1), float(-0.08).add(edge.mul(0.18))));
      }).ElseIf(pt.lessThan(5.5), () => { /* 5 pedra: granulado */
        const n = Var(VN(uv.mul(2.4)).mul(0.6).add(VN(uv.mul(6.5)).mul(0.4)), 'ardP5');
        h.assign(n.mul(0.8)); alb.assign(n.mul(0.32).add(0.84)); rgh.assign(n.mul(0.05));
      }).Else(() => { /* 6 rocha (4.3b): estratos finos e grão alongado nas paredes, fissuras esparsas; topo com grão e poeira */
        const sd = Var(float(1).sub(smoothstep(0.45, 0.8, an.y)), 'ardP6s');
        const ly = Var(pl.y.mul(1.25).add(VN(uv.mul(0.35)).mul(0.9)), 'ardP6y'); const lt = H2(vec2(floor(ly), 5.3)); const tw = Var(abs(fract(ly).sub(0.5)).mul(2), 'ardP6t');
        const gro = Var(smoothstep(0.55, 1, tw).mul(step(0.5, H2(vec2(floor(ly.add(0.5)), 9.1)))), 'ardP6g');
        const gr = Var(VN(uv.mul(4.6)).mul(0.65).add(VN(uv.mul(11)).mul(0.35)), 'ardP6r');
        const crk = Var(float(1).sub(smoothstep(0, 0.05, abs(VN(vec2(uv.x.mul(2.4), uv.y.mul(0.45)).add(7.1)).sub(0.5)))).mul(smoothstep(0.5, 0.72, VN(uv.mul(0.6).add(2.3)))).mul(sd), 'ardP6c');
        h.assign(sd.mul(gro.mul(-0.6).add(float(0.5).sub(tw).mul(0.25))).add(gr.sub(0.5).mul(float(0.7).sub(sd.mul(0.35)))));
        alb.assign(float(1).add(sd.mul(lt.sub(0.5).mul(0.2).sub(gro.mul(0.2)))).add(gr.sub(0.5).mul(float(0.2).sub(sd.mul(0.06)))).sub(crk.mul(0.32)));
        rgh.assign(gr.mul(0.04).add(crk.mul(0.06)));
      });
    });
    return vec3(h.mul(k), mix(float(1), alb, k), rgh.mul(k));
  })();
}
/* relevo pela derivada de tela (ardPerturb do clássico): sx, sy = derivadas da posição no espaço da câmera (já calculadas no topo) */
function perturba(sx0, sy0, sn, dh, fd) {
  const { cross, dot, abs, sign, inverseSqrt, max, select } = L();
  const sx = sx0.mul(inverseSqrt(max(dot(sx0, sx0), 1e-24))), sy = sy0.mul(inverseSqrt(max(dot(sy0, sy0), 1e-24)));
  const r1 = cross(sy, sn), r2 = cross(sn, sx); const det = dot(sx, r1).mul(fd);
  const gv = sign(det).mul(r1.mul(dh.x).add(r2.mul(dh.y))); const n = abs(det).mul(sn).sub(gv); const l = dot(n, n);
  return select(l.greaterThan(1e-12), n.mul(inverseSqrt(max(l, 1e-30))), sn);
}

/* 5.0b.1: a ruína e os modelos com o mesmo fragmento (um módulo de WGSL a menos, ~50 KB, e outro na parte emissiva). A queda (aDie) e a peça
   (aPiece.w) chegam ao fragmento por varyings com nome, que nos modelos valem 0 (o vértice escreve a constante): o escurecimento e as brasas da
   ruína ficam no fragmento de todos e, com queda 0, não mudam nada (as brasas ficam num If, os modelos não pagam o ruído). Um varying por material
   (o mesmo nó no escurecimento e nas brasas: dois nós com o mesmo nome declarariam a variável duas vezes). ?m5ruina=1 volta ao de antes (medida) */
const RUINA_SEP = typeof location !== 'undefined' && /[?&]m5ruina=1/.test(location.search);
function quedaV(ctx) { if (!ctx.ardQueda) { const { varying, vec4 } = L(); ctx.ardQueda = varying(vec4(M5.attr('aDie', vec4(0, 0, 0, 0)).x, M5.attr('aPiece', vec4(0, 0, 0, 0)).w, 0, 0), 'ardQueda'); } return ctx.ardQueda; } /* 5.0e: a queda (x) e a peça (y) numa variável só: com a obra, a base e as unidades o fragmento passava do limite de 16 variáveis vindas do vértice */
function pecaV(ctx) { return quedaV(ctx).y; }
/* ---------- ganchos do material dos modelos (ARD.m5.modelo e ARD.m5.emissivo da fundação chamam na montagem) ---------- */
const G = M5.ganchos = M5.ganchos || { modelo: { posicao: null, superficie: null, emissivo: null }, chao: { cor: null }, adereco: { posicao: null } };
G.modelo = G.modelo || {};
if (!DESLIGA) {
/* posição: animação por peça (sem noAnim) ou ruína (o.ruina); vale para o material principal e para o emissivo. O ARD.m5.instMat roda o passo */
G.modelo.posicao = function (ctx) {
  prepara(); const o = ctx.o || {};
  if (o.ruina) return marcador(preRuina, 'ruina');
  if (o.noAnim) return null;
  return marcador(preAnim, 'anim');
};
/* superfície: o albedo entra depois do setupDiffuseColor (sem mexer no colorNode: a sombra do r186 avalia o colorNode no passe de sombra),
   a normal com relevo é atribuída ao normalView no topo do fragmento (derivadas em fluxo uniforme) e a rugosidade soma ao rm */
G.modelo.superficie = function (ctx) {
  prepara(); const m = ctx.m, o = ctx.o || {}; if (ctx.emissivo) return;
  const { Var, vec2, float, clamp, mix, smoothstep, dFdx, dFdy, select, diffuseColor, normalView, positionView, faceDirection, attribute } = L();
  const surf = superficieNo(); const ruina = o.ruina === 'main';
  const rm = M5.attr('rm', vec2(0.8, 0.1)); let cur = null;
  const sup = Object.getPrototypeOf(m).setupDiffuseColor;
  m.setupDiffuseColor = function (builder) {
    sup.call(this, builder);
    const s = Var(surf, 'ardSurf'); cur = s;
    let k = s.y; if (ruina && RUINA_SEP) k = k.mul(mix(float(1), float(0.24), smoothstep(0, 1.8, attribute('aDie', 'vec4').x))); /* ruína: escurece (4.3f) */
    else if (!RUINA_SEP) k = k.mul(mix(float(1), float(0.24), smoothstep(0, 1.8, quedaV(ctx).x))); /* 5.0b.1: o mesmo escurecimento em todo modelo (queda 0: ×1) */
    diffuseColor.rgb.mulAssign(k);
    if (OBRA()) { const ob = Var(M5.obra.cor(ctx), 'ardObC'); diffuseColor.rgb.mulAssign(ob.w); ctx.ardOb = ob; } /* 5.0e: a borda e a tampa da obra escurecem o albedo (o brilho vai no emissivo) */
    const sx = Var(dFdx(positionView), 'ardSdx'), sy = Var(dFdy(positionView), 'ardSdy'), dh = Var(vec2(dFdx(s.x), dFdy(s.x)).mul(OBRA() ? ctx.ardOb.w.mul(0.9) : 0.9), 'ardSdh'); /* 5.0e: na tampa e na borda da obra sem o relevo do detalhe (a geometria achatada daria derivadas enormes: normais tortas, brilho branco) */
    normalView.assign(select(s.x.notEqual(0), perturba(sx, sy, normalView, dh, faceDirection), normalView));
  };
  const Fn = L().Fn;
  m.roughnessNode = Fn(() => { const r = clamp(rm.x.add(cur ? cur.z : float(0)), 0.04, 1.0); return OBRA() && ctx.ardOb ? mix(r, float(1), float(1).sub(ctx.ardOb.w)) : r; })(); /* 5.0e: a tampa da obra fosca (sem o reflexo do sol e do céu por cima do brilho) */
  if (OBRA() && m.metalnessNode) { const m0 = m.metalnessNode; m.metalnessNode = Fn(() => (ctx.ardOb ? m0.mul(ctx.ardOb.w) : m0))(); } /* 5.0e: e sem metal */
};
/* emissivo: clarões e rim (uniforms) da fundação; na ruína somam as brasas (4.3f) */
G.modelo.emissivo = function (ctx) {
  prepara(); const o = ctx.o || {}; if (RUINA_SEP ? o.ruina !== 'main' : ctx.emissivo) return ctx.em; /* 5.0b.1: as brasas no fragmento de todo modelo (queda 0: nada) */
  const { float, vec3, sin, smoothstep, attribute, positionGeometry, Var, If } = L();
  const die = RUINA_SEP ? attribute('aDie', 'vec4').x : quedaV(ctx).x, pc = RUINA_SEP ? M5.attr('aPiece', L().vec4(0, 0, 0, 0)).w : pecaV(ctx), pl = positionGeometry;
  const brasas = () => { const emb = smoothstep(0.1, 0.6, die).mul(float(1).sub(smoothstep(4, 16, die)));
    const nz = VN(pl.xz.mul(2.4).add(pl.y.mul(1.3)).add(pc.mul(3.1))).mul(0.6).add(VN(pl.zy.mul(6).add(pl.x.mul(2))).mul(0.4));
    const fl = sin(die.mul(9).add(nz.mul(23))).mul(0.25).add(0.75);
    return vec3(1, 0.3, 0.06).mul(emb.mul(fl).mul(smoothstep(0.7, 0.8, nz)).mul(1.3)); };
  if (RUINA_SEP) return ctx.em.add(brasas());
  const br = L().Fn(() => { const b = Var(vec3(0, 0, 0), 'ardBrasa'); If(die.greaterThan(0.1), () => { b.assign(brasas()); }); return b; })(); /* 5.0b.1: abaixo de 0,1 s de queda as brasas valem 0 (smoothstep(0,1; 0,6)): o modelo não calcula o ruído */
  if (OBRA()) return ctx.em.add(br).add(L().Fn(() => (ctx.ardOb ? ctx.ardOb.xyz : vec3(0, 0, 0)))()); /* 5.0e: o brilho da borda e da tampa da obra (calculado no albedo, src/m5/obra.js) */
  return ctx.em.add(br);
};
}
/* parte emissiva da ruína: as luzes apagam (4.3f) */
M5.modelos.emRuina = function (m) {
  if (m.userData.ardEmQueda) return m; m.userData.ardEmQueda = true; /* 5.0b.1: uma vez por material (o M5.emissivo já liga em todo modelo) */
  const { float, smoothstep, attribute, diffuseColor } = L(); const sup = Object.getPrototypeOf(m).setupDiffuseColor; const ctx = {};
  m.setupDiffuseColor = function (builder) { sup.call(this, builder); diffuseColor.rgb.mulAssign(float(1).sub(smoothstep(0, 1.1, RUINA_SEP ? attribute('aDie', 'vec4').x : quedaV(ctx).x)));
    if (OBRA()) { const ob = L().Var(M5.obra.cor(ctx), 'ardObC'); diffuseColor.rgb.assign(L().mix(diffuseColor.rgb, ob.xyz, smoothstep(0.5, 1.0, M5.obra.varying(ctx).w))); } }; /* 5.0e: na tampa da obra a parte emissiva sai com a mesma cor do casco (as duas se cruzam no mesmo plano: sem pisca) */ /* 5.0b.1: pela queda em varying (0 nos modelos: ×1), o mesmo fragmento na parte emissiva da ruína e dos modelos */
  return m;
};

/* ---------- atributos por vértice num buffer só (Motor 5) ----------
   O WebGPU aceita no máximo 8 buffers de vértice por pipeline (limite do Dawn), e cada BufferAttribute é um buffer: o modelo animado tem
   position, normal, color, rm, pt, aAnim, aAnimB + aInst, aInstC e a matriz e a cor da instância. Entrelaçados, os atributos por vértice
   viram 1 buffer. O render3d chama uma vez por geometria (geoOf); os ícones do HUD (WebGLRenderer) leem igual. */
const FIXO = ['position', 'normal', 'color', 'rm', 'pt', 'aAnim', 'aAnimB'], FIXO_EM = ['position', 'normal', 'color', 'aAnim', 'aAnimB']; const EM_FIXO = !/[?&]m5emfixo=0/.test(typeof location !== 'undefined' ? location.search : ''); /* 5.0c.1 */
M5.entrelaca = function (geo, em) {
  if (!geo || !geo.attributes || !geo.attributes.position || (geo.userData && geo.userData.ardEntrelacada)) return geo;
  if (M5.desgAttr) M5.desgAttr(geo, em); /* 5.0e: arestas vivas dos materiais 2.0 (aDesg, src/m5/unidades.js) em todo modelo, antes de entrelaçar: o mesmo layout em todos */
  const Tm = T() || window.THREE; const n0 = geo.attributes.position.count;
  /* layout fixo de todo modelo (regra 4 da carga: o r186 põe nome, passo e deslocamento de TODOS os atributos na chave do pipeline): aAnim/aAnimB
     com zeros onde a peça não anima; aPiece e aWind saem da geometria (só a cópia da ruína lê o aPiece: fica guardado em userData). Assim
     unidades, construções, recursos e cenário dividem um pipeline e uma montagem de nós por material */
  for (const k of ['aPiece', 'aWind']) if (geo.attributes[k]) { geo.userData['ard_' + k] = geo.attributes[k]; geo.deleteAttribute(k); }
  for (const k of ['aAnim', 'aAnimB']) if (!geo.attributes[k]) geo.setAttribute(k, new Tm.BufferAttribute(new Float32Array(n0 * 4), 4));
  const emFixo = em && EM_FIXO; if (emFixo) { if (!geo.attributes.rm) geo.setAttribute('rm', new Tm.BufferAttribute(new Float32Array(n0 * 2), 2)); if (!geo.attributes.pt) geo.setAttribute('pt', new Tm.BufferAttribute(new Float32Array(n0), 1)); } /* 5.0c.1: a parte emissiva no layout da principal (rm e pt zerados, que o emissivo não lê): na sombra as duas rodam o mesmo código e agora o mesmo layout, um pipeline de sombra a menos; ?m5emfixo=0 volta ao layout curto (medida) */
  const ord = em && !emFixo ? FIXO_EM : FIXO; const names = ord.filter(k => geo.attributes[k]).concat(Object.keys(geo.attributes).filter(k => !ord.includes(k))).filter(k => { const a = geo.attributes[k]; return !a.isInterleavedBufferAttribute && !a.isInstancedBufferAttribute && a.array instanceof Float32Array; });
  if (names.length < 2) return geo;
  const n = geo.attributes.position.count; let stride = 0; const off = {}, sz = {}; for (const k of names) { off[k] = stride; sz[k] = geo.attributes[k].itemSize; stride += sz[k]; }
  const arr = new Float32Array(n * stride);
  for (const k of names) { const src = geo.attributes[k].array, s = sz[k], o = off[k]; for (let i = 0, j = o, m = 0; i < n; i++, j += stride) for (let c = 0; c < s; c++) arr[j + c] = src[m++]; }
  const ib = new Tm.InterleavedBuffer(arr, stride);
  for (const k of names) { const nm = geo.attributes[k].normalized; geo.setAttribute(k, new Tm.InterleavedBufferAttribute(ib, sz[k], off[k], nm)); }
  geo.userData.ardEntrelacada = true; return geo;
};
/* cópia num layout fixo: [nome, tamanho, padrão]; mesmo layout ⇒ mesma chave de pipeline (o r186 põe nome, passo e deslocamento de TODOS os atributos na chave) */
function copiaFixa(src, lay) {
  const Tm = T(); const n = src.attributes.position.count; let stride = 0; for (const [, s] of lay) stride += s; const arr = new Float32Array(n * stride); let o = 0;
  for (const [k, s, d] of lay) { const a = src.attributes[k] || (src.userData && src.userData['ard_' + k]); for (let i = 0; i < n; i++) { const j = i * stride + o; if (a) { arr[j] = a.getX(i); if (s > 1) arr[j + 1] = a.getY(i); if (s > 2) arr[j + 2] = a.getZ(i); if (s > 3) arr[j + 3] = a.getW(i); } else for (let c = 0; c < s; c++) arr[j + c] = d[c]; } o += s; }
  const gg = new Tm.BufferGeometry(); const ib = new Tm.InterleavedBuffer(arr, stride); o = 0; for (const [k, s] of lay) { gg.setAttribute(k, new Tm.InterleavedBufferAttribute(ib, s, o)); o += s; }
  gg.boundingSphere = src.boundingSphere; return gg;
}
/* ---------- geometria da ruína no Motor 5: o mesmo layout em todas (principal = position, normal, color, rm, pt, aPiece; emissiva = position, normal,
   color, aPiece; + aDie por instância). A ruína de qualquer construção ou carcaça nasce no meio da partida com os pipelines aquecidos na carga
   (um por material); a cópia é feita uma vez por modelo, na primeira queda ---------- */
const LAY_RUINA = [['position', 3, [0, 0, 0]], ['normal', 3, [0, 1, 0]], ['color', 3, [1, 1, 1]], ['rm', 2, [0.8, 0.1]], ['pt', 1, [0]], ['aPiece', 4, [0, 0, 0, 0]]];
const LAY_RUINA_EM = [['position', 3, [0, 0, 0]], ['normal', 3, [0, 1, 0]], ['color', 3, [1, 1, 1]], ['aPiece', 4, [0, 0, 0, 0]]];
M5.ruinaGeo = function (src, main) { const lay = main ? LAY_RUINA : LAY_RUINA_EM; return src ? copiaFixa(src, M5.desgAttr && M5.unidades ? lay.concat([M5.unidades.desgLayout]) /* 5.0e: a ruína com o aDesg dos modelos (o fragmento dividido continua um só) */ : lay) : null; };
/* holograma: só a posição, sempre no mesmo formato (os modelos entrelaçados têm passos diferentes) */
M5.holoGeo = function (src) { const Tm = T(); const p = src.attributes.position, n = p.count, arr = new Float32Array(n * 3); for (let i = 0; i < n; i++) { arr[i * 3] = p.getX(i); arr[i * 3 + 1] = p.getY(i); arr[i * 3 + 2] = p.getZ(i); }
  const gg = new Tm.BufferGeometry(); gg.setAttribute('position', new Tm.BufferAttribute(arr, 3)); gg.boundingSphere = src.boundingSphere; return gg; };

/* ---------- 4.3f: invólucros de obra (andaime Vehnar, casulo com veias Tessara, coroa de cristais Quorith, casulo úmido Vorag) ----------
   os dois casulos dividem um shader: cor das veias e ritmo do pulso em uniforms (regra 3 da carga) */
/* andaime: é um material padrão com cor por vértice, rugosidade 0,5 e metal 0,55 — no Motor 5 vira o material dos modelos (o mesmo shader e o
   mesmo pipeline das unidades e construções), com a geometria no formato dos modelos (rm = 0,5/0,55, sem padrão de superfície, sem animação) */
M5.obraGeo = function (kind, geo) {
  if (kind !== 'andaime' || !geo || !geo.attributes.position || geo.userData.ardEntrelacada) return geo; const Tm = T(); const n = geo.attributes.position.count;
  const rm = new Float32Array(n * 2); for (let i = 0; i < n; i++) { rm[i * 2] = 0.5; rm[i * 2 + 1] = 0.55; } geo.setAttribute('rm', new Tm.BufferAttribute(rm, 2)); geo.setAttribute('pt', new Tm.BufferAttribute(new Float32Array(n), 1));
  return M5.entrelaca(geo);
};
M5.obraMat = function (kind) {
  prepara(); const Tm = T(); const { float, vec3, abs, sin, cos, smoothstep, uniform, positionGeometry, materialEmissive, materialColor } = L(); let m;
  if (kind === 'andaime') { m = M5.modelo({ env: 1, key: 'obra-andaime' }); m.userData.obraAndaime = true; return m; } /* o modelo já lê a instância por atributo */
  else if (kind === 'cristais') m = new Tm.MeshStandardNodeMaterial({ vertexColors: true, roughness: 0.12, metalness: 0.2, emissive: 0x5a35b0, emissiveIntensity: 0.9, transparent: true, opacity: 0.88, flatShading: true });
  else { const tes = kind === 'casulo'; m = new Tm.MeshStandardNodeMaterial({ color: tes ? 0x5fa86c : 0x9a2c3e, roughness: tes ? 0.38 : 0.14, metalness: 0, transparent: true, opacity: tes ? 0.5 : 0.66, side: Tm.DoubleSide, depthWrite: false, emissive: tes ? 0x153d1f : 0x2a0610 });
    const veia = uniform(new Tm.Color(tes ? 0.45 : 1.0, tes ? 1.0 : 0.28, tes ? 0.55 : 0.32)), ritmo = uniform(tes ? 3.0 : 5.5);
    const o = positionGeometry.mul(9); const v = abs(sin(o.x.mul(2.1).add(sin(o.y.mul(1.3).add(o.z)).mul(1.7))).mul(sin(o.z.mul(1.9).add(cos(o.y.mul(1.1).sub(o.x)).mul(1.6))))); /* veias */
    const vein = float(1).sub(smoothstep(0, 0.09, v)); const pulse = sin(M5.u.tempo.mul(ritmo).sub(positionGeometry.y.mul(6))).mul(0.4).add(0.6);
    m.emissiveNode = materialEmissive.add(veia.mul(vein.mul(pulse).mul(1.4))); }
  if (kind === 'casulo' || kind === 'casulo_vorag') m.forceSinglePass = !DUAS; /* regra 10 da carga: uma passada (o three faria costas e frente com dois pipelines, criados na hora do desenho); ?m5casulo2=1 volta às duas */
  M5.instMat(m, null); m.colorNode = M5.instCor(materialColor); /* instâncias por atributo (ARD.m5.Inst) */
  return M5.registrar('obra-' + (kind === 'casulo_vorag' ? 'casulo' : kind), m);
};
/* holograma da planta (Erevane): linhas de varredura que sobem e uma faixa clara que passa (por altura no espaço do modelo) */
M5.holo = function () {
  prepara(); const Tm = T(); const { vec4, abs, fract, smoothstep, mix, pow, positionGeometry, materialColor, materialOpacity } = L(); const t = M5.u.tempo;
  const m = new Tm.MeshBasicNodeMaterial({ color: 0x33ffd0, transparent: true, opacity: 0.2, blending: Tm.AdditiveBlending, depthWrite: false });
  const hy = positionGeometry.y; const sl = smoothstep(0.32, 0.5, abs(fract(hy.mul(0.7).sub(t.mul(0.8))).sub(0.5))); const sw = smoothstep(0.92, 1.0, fract(hy.mul(0.06).sub(t.mul(0.25))));
  M5.instMat(m, null);
  if (OBRA()) { const { Fn, attribute, vec3, float, max, exp, step } = L(); const iC = Fn(b => (b.object && b.object.isM5Inst ? attribute('iC', 'vec3') : vec3(1, 1, 1)))(); /* 5.0e: a cor da instância leva [tinta, corte, altura]: a planta só acima do corte, com a trama de linhas logo acima dele */
    const corta = step(1.5, iC.z), yc = iC.y, Hh = max(iC.z, 1); const mk = mix(float(1), smoothstep(yc.sub(Hh.mul(0.02)), yc.add(Hh.mul(0.03)), hy), corta);
    const trama = exp(max(hy.sub(yc), 0).negate().div(Hh.mul(0.12))).mul(smoothstep(0.3, 0.5, abs(fract(hy.mul(1.6).sub(t.mul(2.2))).sub(0.5)))).mul(corta);
    m.colorNode = vec4(materialColor.rgb.mul(iC.x).mul(sl.mul(1.3).add(0.3).add(sw.mul(2.2)).add(trama.mul(3))).mul(mk), 1); }
  else m.colorNode = vec4(M5.instCor(materialColor.rgb).mul(sl.mul(1.3).add(0.3).add(sw.mul(2.2))), 1);
  m.opacityNode = mix(materialOpacity, pow(materialOpacity, 2.2), semPosU()); /* sem pós: alfa a 2,2 (regra 11) */
  return M5.registrar('holo', m);
};
/* 4.3g: escudo do Uníssono — bolha com Fresnel, grade hexagonal que corre, linha de varredura e brilho no golpe (cor da instância: r = brilho,
   g = entrada/saída) */
M5.escudo = function () {
  prepara(); const Tm = T(); const { Fn, float, vec2, vec3, vec4, abs, dot, max, min, mix, pow, clamp, sin, atan, mod, normalize, smoothstep, select, varying, attribute, positionGeometry, normalGeometry, positionWorld, cameraPosition, instanceColor } = L(); const t = M5.u.tempo;
  const m = new Tm.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: Tm.AdditiveBlending }); m.fog = false;
  M5.instMat(m, null);
  const vC = Fn(b => (b.object && b.object.isM5Inst ? attribute('iC', 'vec3') : instanceColor))(); /* ARD.m5.Inst: cor na geometria; InstancedMesh: vInstanceColor */
  const vO = varying(normalize(positionGeometry), 'ardEo'); /* como o clássico: normalizado no vértice e interpolado */
  const n = normalize(vec3(normalGeometry.x, normalGeometry.y.mul(0.86), normalGeometry.z)); /* a normal do clássico (mat3(modelo·instância)·n): a bolha é achatada em y (0,86) e nunca gira */
  const v = normalize(cameraPosition.sub(positionWorld)); const f = pow(clamp(float(1).sub(abs(dot(n, v))), 0, 1), 2.2);
  const p = vec2(atan(vO.z, vO.x).mul(2.6), vO.y.mul(4.2).add(t.mul(0.35))); const r = vec2(1, 1.732), hh = r.mul(0.5);
  const a = mod(p, r).sub(hh), b = mod(p.sub(hh), r).sub(hh); const c = select(dot(a, a).lessThan(dot(b, b)), a, b); const ac = abs(c);
  const edge = smoothstep(0.38, 0.47, max(dot(ac, vec2(0.866, 0.5)), ac.y));
  const scan = smoothstep(0.92, 1.0, sin(vO.y.mul(9).sub(t.mul(3))).mul(0.5).add(0.5)); const k = vC.r;
  const col = mix(vec3(0.62, 0.45, 1.0), vec3(0.95, 0.9, 1.0), clamp(k.sub(1), 0, 1));
  const al = f.mul(1.1).add(edge.mul(f.mul(0.4).add(0.03))).add(scan.mul(0.08).mul(f)).mul(min(k, 3)).mul(vC.g);
  const rgb = col.mul(al); m.fragmentNode = vec4(mix(rgb, pow(max(rgb, 0), vec3(2.2)).div(expoU()), semPosU()), 1); /* 5.0b (junção): ÷ exposição sem pós (o ShaderMaterial do clássico sai cru) */ /* saída direta como o ShaderMaterial do clássico; sem pós, a 2,2 (regra 11) */
  return M5.registrar('escudo', m);
};
/* 4.0d: pano da bandeira com a Insígnia, ondulando (onda no vértice antes da instância; a fase vem do atributo aFase por instância) */
M5.pano = function (tex) {
  prepara(); const Tm = T();
  const m = new Tm.MeshStandardNodeMaterial({ map: tex, side: Tm.DoubleSide, roughness: 0.75, metalness: 0, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.25 }); m.envMapIntensity = 0.3;
  M5.instMat(m, marcador(prePano, 'pano')); /* sem cor por instância: o mapa da Insígnia já é a cor */ m.userData.ardFragFixo = true; /* 5.0b.1: o mesmo fragmento do mastro */ if (M5.mastroUm) m.positionNode.ardOnda = L().uniform(1); /* 5.0c.1 */
  return M5.registrar('bandeira', m);
};
/* 5.0b.1: o mastro das bandeiras com o fragmento do pano (um módulo de ~27 KB a menos; era um MeshStandardMaterial à parte): mapa e mapa emissivo
   brancos de 1×1 com o filtro, a repetição e o espaço de cor da Insígnia (com filtro Nearest o r186 leria por textureLoad e o código mudaria),
   emissivo preto (cor × 1, emissivo 0: a mesma imagem), as duas faces como o pano (o cilindro é fechado: o verso nunca aparece) e a sombra pelo
   verso, como no material de uma face. Instâncias por atributo (ARD.m5.Inst), sem a onda do pano */
function preMastro(builder) { const { Fn, vec3, positionLocal } = L(); Fn(() => { positionLocal.assign(positionLocal.add(vec3(0, M5.u.tempo.mul(0), 0))); }, 'void')(); } /* 5.0b.1: o relógio do pano no vértice, multiplicado por 0 (nada se move): o bloco de uniforms sai igual ao da bandeira */
M5.mastroUm = !/[?&]m5mastro=2/.test(typeof location !== 'undefined' ? location.search : ''); /* 5.0c.1 */
M5.mastro = function () {
  prepara(); const Tm = T(); const w = new Tm.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1); w.colorSpace = Tm.SRGBColorSpace; w.magFilter = Tm.LinearFilter; w.minFilter = Tm.LinearMipmapLinearFilter; w.generateMipmaps = true; w.wrapS = w.wrapT = Tm.ClampToEdgeWrapping; w.needsUpdate = true;
  const m = new Tm.MeshStandardNodeMaterial({ color: 0x8a919b, map: w, side: Tm.DoubleSide, roughness: 0.4, metalness: 0.6, emissive: 0x000000, emissiveMap: w, emissiveIntensity: 0.25 }); m.shadowSide = Tm.BackSide; m.envMapIntensity = 1;
  if (M5.mastroUm) { M5.instMat(m, marcador(prePano, 'pano')); m.positionNode.ardOnda = L().uniform(0); } else M5.instMat(m, marcador(preMastro, 'mastro')); m.userData.ardFragFixo = true; /* 5.0c.1: o vértice do pano com a onda × 0 (a geometria do mastro ganha o aFase zerado no render3d): o mesmo pipeline do pano; ?m5mastro=2 volta ao vértice próprio (medida) */
  return M5.registrar('mastro', m);
};
})(globalThis.ARD = globalThis.ARD || {});
