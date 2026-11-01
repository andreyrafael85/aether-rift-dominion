/* Aether Rift: Dominion — Motor 5 (5.0e): destroços em compute, as partículas da obra e o calor que refrata a cena. Só visual: a simulação não muda.
   - Um conjunto fixo de partículas na GPU (três instancedArray: posição + idade, velocidade + giro, código + semente/vida + tamanho + cor), usado
     em anel: cada morte, obra ou conclusão pede um trecho do anel (um "emissor": até 16 por quadro, num uniformArray) e o compute nasce as
     partículas do trecho e move todas num passo só. Nenhum objeto novo por morte; a carga cria tudo (o compute vai para M5.pendentes).
   - Tipos: 1 destroço (bate no relevo pelo mapa de alturas do chão, quica com a normal do terreno, rola um pouco, assenta, fica no chão e afunda
     no fim), 2 faísca de solda (cai, quica uma vez e esfria), 3 luz da Erevane (sobe), 4 esporo da Tessara (flutua), 5 cristal do Quorith (sobe e
     cintila), 6 gosma do Vorag (pula e estoura no chão), 7 onda da obra concluída (corre rente ao relevo, para fora).
   - Um desenho só para todos os tipos: um octaedro instanciado (6 vértices), opaco, com a normal da face pela derivada da tela, a luz do sol, do céu
     e do mapa de clarões, e a névoa de guerra do chão. Faíscas e luzes são o mesmo octaedro esticado e aceso (o bloom faz o resto).
   - A ruína de hoje (RUIN_GLSL/preRuina, src/m5/modelos.js) segue com as peças grandes da construção; os destroços completam com os pedaços
     miúdos, que quicam no relevo de verdade, e a poeira que rola quando eles caem (as partículas do fx3d, sem pipeline novo). Os destroços em
     sprite do fx3d saem das mortes (opção semDestrocos), ficam os que soltam fogo.
   - Calor e onda de choque (Alta e Ultra, fora do celular): até 16 fontes por quadro (explosões grandes, impactos de plasma, chamas e a conclusão
     da obra) projetadas na CPU; o passe da bruma lê a cena com o deslocamento (nenhum pipeline novo: entra no shader da bruma).
   Chaves: ?destrocos5=0 (destroços da 5.0d), ?refracao=0, ?destrocosN=<partículas>. Qualidade: Baixa sem partículas (nenhum pipeline); Média
   4.096, Alta 8.192, Ultra 12.288 (celular: 1.024 na Média e 2.048 acima). */
(function (ARD) {
'use strict';
const M5 = ARD.m5 = ARD.m5 || {};
const QS = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
const T = () => window.THREE_M5, L = () => window.TSL;
const LIGADO = QS.get('destrocos5') !== '0', REFRACAO = QS.get('refracao') !== '0';
const E = 16, NF = 12; /* emissores por quadro e fontes de calor */
const PAL = { vehnar: 0, erevane: 1, tessara: 2, quorith: 3, vorag: 4 };
const D = M5.destrocos = { versao: '5.0e', N: 0, montado: false, nE: 0, cab: 0, ate: -1, mult: 1, rfK: 1 /* força da refração (ferramentas de teste: 0 tira, com a mesma imagem) */ };
D.ligado = () => D.montado && D.nivel > 0 && !(D.R && D.R.quality && D.R.quality.resolved === 'baixa'); /* a qualidade pode baixar no meio da partida: sem partículas novas, o mesmo pipeline */
/* cor empacotada num float (8 bits por canal, até 4,0 de brilho): exata até 2^24 */
D.cor = (r, g, b) => { const q = v => Math.max(0, Math.min(255, Math.round(v / 4 * 255))); return q(r) * 65536 + q(g) * 256 + q(b); };
const corDono = new Map();
function corTime(sim, pid) { let c = corDono.get(pid); if (c != null) return c; const p = sim && sim.players ? sim.players[pid] : null; const h = p && p.color ? parseInt(String(p.color).slice(1), 16) : 0xb0b0b0; const r = ((h >> 16) & 255) / 255, g = ((h >> 8) & 255) / 255, b = (h & 255) / 255; c = D.cor(Math.pow(r, 2.2) * 0.9, Math.pow(g, 2.2) * 0.9, Math.pow(b, 2.2) * 0.9); corDono.set(pid, c); return c; }

/* ---------- nível pela qualidade: 0 sem partículas (Baixa), senão o tamanho do anel ---------- */
function tamanho(q, toque) { const n = +(QS.get('destrocosN') || 0); if (n) return Math.max(256, Math.min(65536, n)) & ~63; if (!q || q === 'baixa') return 0; if (toque) return q === 'media' ? 1024 : 2048; return q === 'ultra' ? 12288 : q === 'alta' ? 8192 : 4096; }
const MULT = { media: 1, alta: 1.35, ultra: 1.7 };

/* ---------- montagem na carga (render3d, finishTerrain, depois do clima): o anel, o compute (M5.pendentes) e o desenho na cena ---------- */
D.montar = function (o) {
  const R = o.R, q = R && R.quality ? R.quality.resolved || R.quality.name : 'media'; D.R = R; D.X = o.X; D.toque = !!o.toque; D.qual = q;
  if (R && R.FX && !D.fxLigado) ligaFx(R.FX);
  const N = LIGADO ? tamanho(q, o.toque) : 0; D.nivel = N ? 1 : 0; D.mult = (MULT[q] || 1) * (o.toque ? 0.5 : 1);
  if (!N || D.montado || !o.X) return; const Tm = T(), TL = L(); D.N = N;
  const alt = o.alturas || (M5.clima && M5.clima.altTex) || alturas(o.heights, o.HN, o.HS); const K0 = M5.clima && M5.clima.U && M5.clima.altTex === alt ? M5.clima.U.altK.value : D.altK0;
  kernel(N, alt, K0); desenho(N); o.scene.add(D.malha); D.montado = true;
  const r = o.X.renderer; if (o.X.isWebGPU && r.compileComputeAsync && M5.pendentes) M5.pendentes.push(() => r.compileComputeAsync([D.kernel])); /* na reserva WebGL2 o compute nasce no 1º passo, ainda no aquecimento */
};
/* mapa de alturas próprio (só quando o clima não está: o src/m5/clima.js já faz um, que é o mesmo) */
function alturas(h, HN, HS) { const Tm = T(); if (!h || !HN) return null; const n = HN * HN, d = new Uint16Array(n * 2), toH = Tm.DataUtils.toHalfFloat; for (let i = 0; i < n; i++) { d[i * 2] = toH(h[i]); d[i * 2 + 1] = d[i * 2]; }
  const t = new Tm.DataTexture(d, HN, HN, Tm.RGFormat, Tm.HalfFloatType); t.minFilter = t.magFilter = Tm.LinearFilter; t.wrapS = t.wrapT = Tm.ClampToEdgeWrapping; t.colorSpace = Tm.NoColorSpace; t.name = 'ard-destrocos-alturas'; t.needsUpdate = true;
  D.altK0 = new Tm.Vector4(1 / (HS * HN), 0.5 / HN, HS * (HN - 1), 0); return t; }

/* ---------- compute: nasce o que os emissores pediram e move todas ---------- */
function kernel(N, altTex, altK0) {
  const Tm = T(), TL = L(); const { Fn, If, Loop, Break, float, int, uint, vec2, vec3, vec4, uniform, uniformArray, instancedArray, instanceIndex, texture, hash, floor, fract, sin, cos, sqrt, exp, min, max, abs, dot, length, normalize, clamp, select } = TL;
  const PB = instancedArray(N, 'vec4'), VB = instancedArray(N, 'vec4'), AB = instancedArray(N, 'vec4'); /* tudo zero: código 0 = livre */
  D.PB = PB; D.VB = VB; D.AB = AB;
  const EMV = D.EMV = []; for (let i = 0; i < E * 3; i++) EMV.push(new Tm.Vector4());
  const EM = uniformArray(EMV, 'vec4');
  const K = D.K = { dt: uniform(0), nE: uniform(0), n: uniform(N), quadro: uniform(0), altK: uniform(altK0 ? altK0.clone() : new Tm.Vector4(1 / 6000, 0, 6000, 0)) };
  const AT = texture(altTex || M5.blank(0, 0, 0, 255));
  const chao = (x, z) => AT.sample(vec2(x.mul(K.altK.x).add(K.altK.y), z.negate().mul(K.altK.x).add(K.altK.y))).level(0).r;
  D.kernel = Fn(() => {
    const i = instanceIndex; const fi = float(i).toVar('dfi');
    const p = PB.element(i).toVar('dp'), v = VB.element(i).toVar('dv'), a = AB.element(i).toVar('da'); const dt = K.dt;
    /* nascimento: a partícula cai no trecho de algum emissor deste quadro */
    Loop({ start: int(0), end: int(E), type: 'int', condition: '<', name: 'k' }, ({ k }) => {
      If(float(k).greaterThanEqual(K.nE), () => { Break(); });
      const e0 = EM.element(k.mul(3)).toVar('de0'), e1 = EM.element(k.mul(3).add(1)).toVar('de1'), e2 = EM.element(k.mul(3).add(2)).toVar('de2');
      const rel = fi.sub(e0.w).toVar('drel'); If(rel.lessThan(0), () => { rel.addAssign(K.n); });
      If(rel.lessThan(e1.x), () => {
        const sb = uint(i).mul(uint(16)).add(K.quadro.toUint().mul(uint(2654435761))).toVar('dsb'); const h = j => hash(sb.add(uint(j)));
        const ty = e1.y.sub(floor(e1.y.div(16)).mul(16)).toVar('dty');
        const pos = vec3(e0.xyz).toVar('dpos'), vel = vec3(0).toVar('dvel');
        If(ty.lessThan(1.5), () => { /* destroço: do miolo para fora e para cima */
          const an = h(1).mul(6.2831853).toVar('dan'), rr = sqrt(h(2)).mul(e2.x); const hs = e1.w.mul(h(4).mul(0.7).add(0.3)), vy = e1.w.mul(h(5).mul(1.2).add(0.8));
          pos.assign(vec3(e0.x.add(cos(an).mul(rr)), e0.y.add(h(3).mul(e2.y)), e0.z.add(sin(an).mul(rr)))); vel.assign(vec3(cos(an).mul(hs), vy, sin(an).mul(hs)));
        }).ElseIf(ty.greaterThan(6.5), () => { /* onda: anel no chão, para fora */
          const an = rel.div(max(e1.x, 1)).mul(6.2831853).add(h(1).mul(0.08)).toVar('dan2');
          pos.assign(vec3(e0.x.add(cos(an).mul(e2.x)), e0.y, e0.z.add(sin(an).mul(e2.x)))); vel.assign(vec3(cos(an), 0, sin(an)).mul(e1.w.mul(h(2).mul(0.3).add(0.85))));
        }).Else(() => { /* obra: na borda do corte (quadrado da pegada) ou, na gosma, em cima da tampa */
          const lado = floor(h(1).mul(4)).toVar('dlado'), tt = h(2).mul(2).sub(1).toVar('dtt'); const qx = float(0).toVar('dqx'), qz = float(0).toVar('dqz');
          If(ty.greaterThan(5.5), () => { qx.assign(h(1).mul(2).sub(1).mul(0.7)); qz.assign(tt.mul(0.7)); })
            .ElseIf(lado.lessThan(0.5), () => { qx.assign(1); qz.assign(tt); }).ElseIf(lado.lessThan(1.5), () => { qx.assign(-1); qz.assign(tt); })
            .ElseIf(lado.lessThan(2.5), () => { qx.assign(tt); qz.assign(1); }).Else(() => { qx.assign(tt); qz.assign(-1); });
          const fora = normalize(vec3(qx, 0, qz).add(vec3(1e-4, 0, 0))).toVar('dfora');
          pos.assign(vec3(e0.x.add(qx.mul(e2.x)), e0.y.add(h(3).sub(0.5).mul(e2.y)), e0.z.add(qz.mul(e2.x))));
          If(ty.lessThan(2.5), () => { vel.assign(fora.mul(h(4).mul(28).add(8)).add(vec3(0, h(5).mul(26).sub(6), 0))); }) /* faísca: espirra para fora e cai */
            .ElseIf(ty.lessThan(3.5), () => { vel.assign(fora.mul(h(4).mul(2)).add(vec3(0, h(5).mul(12).add(9), 0))); }) /* luz: sobe */
            .ElseIf(ty.lessThan(4.5), () => { vel.assign(fora.mul(h(4).mul(4)).add(vec3(0, h(5).mul(6).add(4), 0))); }) /* esporo: flutua */
            .ElseIf(ty.lessThan(5.5), () => { vel.assign(fora.mul(h(4).mul(3)).add(vec3(0, h(5).mul(9).add(6), 0))); }) /* cristal: sobe devagar */
            .Else(() => { vel.assign(fora.mul(h(4).mul(10).add(6)).add(vec3(0, h(5).mul(22).add(16), 0))); }); /* gosma: pula */
        });
        const vida = e2.w.mul(h(7).mul(0.5).add(0.75));
        p.assign(vec4(pos, 0)); v.assign(vec4(vel, h(8).mul(6.2831853))); a.assign(vec4(e1.y, floor(vida.mul(10)).add(h(9).mul(0.999)), e1.z.mul(h(6).mul(0.9).add(0.55)), e2.z));
        Break(); });
    });
    /* passo de quem está vivo */
    If(a.x.greaterThan(0.5), () => {
      const ty = a.x.sub(floor(a.x.div(16)).mul(16)).toVar('dty2'); const idade = p.w.add(dt).toVar('did'); p.w.assign(idade); const vida = floor(a.y).mul(0.1);
      If(idade.greaterThan(vida), () => { a.x.assign(0); }).Else(() => {
        const g = float(0).toVar('dg'), ar = float(0).toVar('dar'); const sd = fract(a.y).toVar('dsd');
        If(ty.lessThan(1.5), () => { g.assign(165); ar.assign(0.12); }).ElseIf(ty.lessThan(2.5), () => { g.assign(230); ar.assign(1.4); }).ElseIf(ty.lessThan(3.5), () => { ar.assign(1.1); })
          .ElseIf(ty.lessThan(4.5), () => { ar.assign(1.3); v.x.addAssign(sin(idade.mul(2.7).add(sd.mul(40))).mul(dt).mul(7)); v.z.addAssign(cos(idade.mul(2.3).add(sd.mul(31))).mul(dt).mul(7)); })
          .ElseIf(ty.lessThan(5.5), () => { ar.assign(0.9); }).ElseIf(ty.lessThan(6.5), () => { g.assign(190); ar.assign(0.25); }).Else(() => { ar.assign(2.4); });
        v.y.subAssign(g.mul(dt)); v.xyz.mulAssign(exp(ar.negate().mul(dt)));
        If(ty.greaterThan(2.5).and(ty.lessThan(3.5)), () => { v.y.assign(max(v.y, 4)); });
        const vel = length(v.xyz); v.w.addAssign(sd.mul(2).sub(1).mul(13).mul(min(vel.div(25), 1)).mul(dt)); /* giro: para quando assenta */
        p.xyz.addAssign(v.xyz.mul(dt));
        const gy = chao(p.x, p.z).toVar('dgy'); const rz = a.z.mul(0.4);
        If(ty.greaterThan(6.5), () => { p.y.assign(gy.add(0.35)); })
          .ElseIf(p.y.lessThan(gy.add(rz)), () => {
            If(ty.lessThan(2.5), () => { /* destroço e faísca: quicam com a normal do relevo */
              const e = float(5); const n = normalize(vec3(chao(p.x.sub(e), p.z).sub(chao(p.x.add(e), p.z)), e.mul(2), chao(p.x, p.z.sub(e)).sub(chao(p.x, p.z.add(e))))).toVar('dn');
              const vn = dot(v.xyz, n).toVar('dvn'); const rest = select(ty.lessThan(1.5), float(1.38), float(1.25)), atr = select(ty.lessThan(1.5), float(0.62), float(0.5));
              If(vn.lessThan(0), () => { v.xyz.subAssign(n.mul(vn.mul(rest))); v.x.mulAssign(atr); v.z.mulAssign(atr); });
              p.y.assign(gy.add(rz));
              If(ty.lessThan(1.5).and(length(v.xyz).lessThan(9)), () => { v.xyz.assign(vec3(0)); }); /* assentou */
            }).ElseIf(ty.greaterThan(5.5), () => { a.x.assign(0); }) /* gosma estoura */
              .Else(() => { p.y.assign(gy.add(rz)); });
          });
      });
    });
    PB.element(i).assign(p); VB.element(i).assign(v); AB.element(i).assign(a);
  })().compute(N, [64]);
  D.kernel.name = 'ard-destrocos-compute';
}

/* ---------- desenho: um octaedro instanciado (posição, forma e cor pelo estado do compute) ---------- */
function desenho(N) {
  const Tm = T(), TL = L(); const { Fn, float, vec3, vec4, floor, fract, sin, exp, pow, max, min, abs, clamp, mix, step, smoothstep, length, normalize, cross, dot, sign, select, varying, dFdx, dFdy, positionGeometry, cameraPosition, cameraProjectionMatrix, cameraViewMatrix } = TL;
  const ga = D.PB.toAttribute(), gv = D.VB.toAttribute(), gA = D.AB.toAttribute(); const q = positionGeometry; const MU = M5.u;
  const code = gA.x, ty = code.sub(floor(code.div(16)).mul(16)), pal = floor(code.div(16)); const vivo = select(code.greaterThan(0.5), float(1), float(0));
  const sd = fract(gA.y), vida = max(floor(gA.y).mul(0.1), 0.05), idade = ga.w, k = clamp(idade.div(vida), 0, 1), tam = gA.z;
  const h1 = fract(sd.mul(17.31)), h2 = fract(sd.mul(41.7)), h3 = fract(sd.mul(73.13));
  const peso = (a, b) => step(a, ty).mul(step(ty, b)); /* pesos escalares (na reserva WebGL2 o select de vetores aninhado no vértice não monta) */
  const wD = peso(0.5, 1.5), wS = peso(1.5, 2.5), wW = peso(6.5, 7.5), wC = float(1).sub(wD).sub(wS).sub(wW);
  /* forma: destroço irregular que afunda no fim; os pequenos encolhem no fim */
  const fimD = smoothstep(vida.sub(3), vida, idade), encolhe = float(1).sub(smoothstep(0.65, 1.0, k));
  const eixo = normalize(vec3(h1.sub(0.5), h2.sub(0.5).add(0.001), h3.sub(0.5))); const an = gv.w;
  const gira = p => { const c = sin(an.add(1.5707963)), s = sin(an); return p.mul(c).add(cross(eixo, p).mul(s)).add(eixo.mul(dot(eixo, p).mul(float(1).sub(c)))); };
  const oD = gira(q.mul(vec3(h1.mul(0.7).add(1), h2.mul(0.4).add(0.45), h3.mul(0.5).add(0.75))).mul(tam));
  const oC = gira(q.mul(max(tam, length(cameraPosition.sub(ga.xyz)).mul(0.0014)).mul(encolhe)));
  const dir = normalize(gv.xyz.add(vec3(0, 1e-3, 0))), lado = normalize(cross(dir, vec3(0.31, 0.17, 0.93))), cima = cross(lado, dir);
  const longe = length(cameraPosition.sub(ga.xyz)).mul(0.0011); /* pelo menos ~1 pixel de largura */ const comp = max(tam.mul(1.6), length(gv.xyz).mul(0.035)).mul(encolhe), larg = max(tam.mul(0.42), longe).mul(encolhe);
  const oS = dir.mul(q.y.mul(comp)).add(lado.mul(q.x.mul(larg))).add(cima.mul(q.z.mul(larg)));
  const rad = normalize(vec3(gv.x, 0, gv.z).add(vec3(1e-4, 0, 0))), tan = vec3(rad.z.negate(), 0, rad.x); const kw = float(1).sub(k);
  const oW = tan.mul(q.x.mul(tam).mul(3.4)).add(vec3(0, q.y.mul(tam).mul(0.18), 0)).add(rad.mul(q.z.mul(tam).mul(0.55))).mul(kw);
  const mundo = ga.xyz.add(oD.mul(wD)).add(oC.mul(wC)).add(oS.mul(wS)).add(oW.mul(wW)).add(vec3(0, fimD.mul(tam).mul(-1.8).mul(wD), 0));
  const clip = cameraProjectionMatrix.mul(cameraViewMatrix).mul(vec4(mundo, 1));
  /* cor: destroço pela paleta da Raça (e a cor do time em parte deles), com pedaços em brasa ou acesos que apagam; os outros são luz */
  const pc = gA.w; const corE = vec3(floor(pc.div(65536)), floor(pc.div(256)).sub(floor(pc.div(65536)).mul(256)), pc.sub(floor(pc.div(256)).mul(256))).div(255).mul(4);
  const wP = j => step(j - 0.5, pal).mul(step(pal, j + 0.5));
  const base = mix(vec3(0.15, 0.15, 0.17), vec3(0.3, 0.19, 0.12), h3).mul(wP(0)).add(mix(vec3(0.46, 0.5, 0.54), vec3(0.16, 0.26, 0.3), h3).mul(wP(1))).add(mix(vec3(0.18, 0.3, 0.1), vec3(0.36, 0.28, 0.14), h3).mul(wP(2)))
    .add(mix(vec3(0.32, 0.22, 0.55), vec3(0.6, 0.5, 0.85), h3).mul(wP(3))).add(mix(vec3(0.3, 0.05, 0.07), vec3(0.6, 0.54, 0.44), step(0.7, h3)).mul(wP(4)));
  const brasa = vec3(2.4, 0.75, 0.16).mul(step(0.72, h1)).mul(exp(idade.mul(-0.7))).mul(wP(0)).add(vec3(0.25, 1.4, 1.25).mul(step(0.7, h1)).mul(exp(idade.mul(-0.45))).mul(wP(1)))
    .add(vec3(0.5, 1.3, 0.35).mul(step(0.78, h1)).mul(exp(idade.mul(-0.5))).mul(wP(2))).add(vec3(0.75, 0.45, 1.5).mul(step(0.35, h1)).mul(exp(idade.mul(-0.3)).mul(0.75).add(0.25)).mul(wP(3)))
    .add(vec3(0.9, 0.08, 0.1).mul(step(0.8, h1)).mul(exp(idade.negate())).mul(wP(4)));
  const albD = mix(base, corE.mul(0.6), step(h2, 0.25)); /* um quarto dos pedaços na cor do time */
  const wG = peso(5.5, 6.5), wL = float(1).sub(wD).sub(wG); /* gosma: albedo; o resto: luz própria */
  const cint = pow(sin(idade.mul(14).add(sd.mul(40))).mul(0.5).add(0.5), 8).mul(2).mul(peso(4.5, 5.5)); const fade = pow(float(1).sub(k), 1.3);
  const luzP = corE.mul(mix(vec3(1), vec3(1, 0.4, 0.15), k.mul(wS))).mul(fade.add(cint)).mul(mix(float(1), float(0.6), peso(3.5, 4.5)));
  const alb = albD.mul(wD).add(corE.mul(wG)), emi = brasa.mul(wD).add(luzP.mul(wL)).add(corE.mul(0.4).mul(fade).mul(wG));
  const m = new Tm.MeshBasicNodeMaterial(); m.fog = false;
  m.vertexNode = mix(vec4(2, 2, 2, 1), clip, vivo); /* livre: fora da tela */
  const vW = varying(mundo, 'vdW'), vA = varying(alb, 'vdA'), vE = varying(emi, 'vdE');
  m.fragmentNode = Fn(() => { const n0 = normalize(cross(dFdx(vW), dFdy(vW))); const n = n0.mul(sign(dot(n0, cameraPosition.sub(vW))).add(0.0001)); /* a face pela derivada, virada para a câmera */
    const luz = MU.ceuCor.mul(0.55).add(MU.solCor.mul(max(dot(n, MU.solDir), 0).mul(float(1.25).mul(float(1).sub(MU.noite.mul(0.7)))))).add(M5.sample.clarao(vW).mul(1.2)).add(0.04);
    const nv = M5.sample.nevoa(vW); const kf = M5.nevoaChao ? M5.nevoaChao(nv) : mix(0.06, 1.0, nv);
    return vec4(vA.mul(luz).add(vE).mul(kf), 1); })();
  M5.registrar('destrocos', m);
  const g = new Tm.InstancedBufferGeometry(); g.setAttribute('position', new Tm.BufferAttribute(new Float32Array([1, 0, 0, -1, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 1, 0, 0, -1]), 3));
  g.setIndex([0, 2, 4, 4, 2, 1, 1, 2, 5, 5, 2, 0, 0, 4, 3, 4, 1, 3, 1, 5, 3, 5, 0, 3]); g.instanceCount = N; g.name = 'ard-destrocos';
  const me = new Tm.Mesh(g, m); me.frustumCulled = false; me.castShadow = false; me.receiveShadow = false; me.name = 'destrocos'; me.visible = false; D.malha = me; D.geo = g;
}

/* ---------- emissores (CPU, sem alocar): um trecho do anel por pedido; até 16 por quadro ---------- */
D.emite = function (tipo, pal, x, y, z, n, tam, vel, meia, alt, cor, vida) {
  if (!D.montado || D.nE >= E || !(n >= 1)) return false; n = Math.min(Math.floor(n), D.N >> 2); const k = D.nE++; const V = D.EMV;
  V[k * 3].set(x, y, z, D.cab); V[k * 3 + 1].set(n, tipo + 16 * pal, tam, vel); V[k * 3 + 2].set(meia, alt, cor, vida);
  D.cab = (D.cab + n) % D.N; const t = D.R ? D.R.time : 0; if (t + vida * 1.3 + 0.5 > D.ate) D.ate = t + vida * 1.3 + 0.5; return true;
};
/* morte de unidade ou construção já vista (render3d, evento death): pedaços que quicam no relevo e a poeira que rola quando eles caem */
const POEIRA = [0.3, 0.26, 0.2];
D.morte = function (e, fac, gy, big, sim) {
  if (!D.ligado()) return; const r = e.r || 8, pal = PAL[fac] != null ? PAL[fac] : 0, m = D.mult;
  const n = Math.round((big ? 30 + r * 1.0 : 6 + r * 0.55) * m), tam = big ? 1.3 + r * 0.05 : 0.55 + r * 0.05, /* na batalha cheia o chão não pode virar confete: poucos pedaços por unidade */ vel = big ? 44 + r * 0.9 : 30 + r * 1.4;
  D.emite(1, pal, e.x, gy + (big ? r * 0.25 : 2 + r * 0.3), -e.y, n, tam, vel, r * 0.5, big ? r * 0.6 : r * 0.4, corTime(sim, e.owner), big ? 32 : 16);
  const FX = D.R && D.R.FX; if (!FX || !FX.emit) return; const nd = Math.max(1, Math.round((big ? 7 : 3) * (FX.mult || 1))), Rr = Math.random;
  for (let i = 0; i < nd; i++) { const a = Rr() * 6.2832, d0 = r * (big ? 0.9 : 0.7) + Rr() * r * (big ? 1.6 : 1.2), sp = 10 + Rr() * 16, gg = 0.85 + Rr() * 0.3; /* poeira que rola onde os pedaços caem (~0,4 a 0,9 s) */
    FX.emit(FX.alp, [e.x + Math.cos(a) * d0, gy + 1, -e.y + Math.sin(a) * d0], [Math.cos(a) * sp, 2, Math.sin(a) * sp], 1.3 + Rr() * 0.9, r * (big ? 0.22 : 0.3), r * (big ? 0.8 : 0.9), 4, [POEIRA[0] * gg, POEIRA[1] * gg, POEIRA[2] * gg], 0, 2, (Rr() - 0.5) * 0.6, 0.34, 0.4 + Rr() * 0.5, 2.4); }
};

/* ---------- por quadro (R.draw, depois do clima): um passo do compute quando há partícula viva e as fontes de calor ---------- */
D.quadro = function (dt, camera, R) {
  if (D.rfOn) fontes(camera, R);
  if (!D.montado) { D.nE = 0; return; } const X = D.X, K = D.K; const d = Math.max(0, Math.min(0.1, dt || 0));
  const vivo = R.time < D.ate || D.nE > 0; const passo = (vivo && (d > 0 || D.nE > 0)) || (R.warming && !D.uma);
  if (passo) { K.dt.value = d; K.nE.value = D.nE; K.quadro.value = (K.quadro.value + 1) % 16777216; D.uma = true; X.renderer.compute(D.kernel); }
  D.malha.visible = vivo || !!R.warming; D.nE = 0;
};

/* ---------- calor e onda de choque: fontes no mundo (CPU, anel fixo de 16) ---------- */
const FONTES = []; for (let i = 0; i < NF; i++) FONTES.push({ x: 0, y: 0, z: 0, r: 0, t0: -99, vida: 0, tipo: 0, k: 0, fogo: false });
let fIdx = 0;
D.calor = function (x, y, z, r, tipo, k, vida, fogo) {
  if (!REFRACAO || !D.rfOn) return; const t = D.R ? D.R.time : 0;
  if (fogo) { for (const f of FONTES) if (f.fogo && t - f.t0 < f.vida && Math.abs(f.x - x) + Math.abs(f.z - z) < r * 0.9) { f.vida = t - f.t0 + 0.8; if (r > f.r) f.r = r; return; } } /* chama contínua: a mesma fonte, renovada */
  let f = FONTES[fIdx]; for (let j = 0; j < NF; j++) { const c = FONTES[(fIdx + j) % NF]; if (t - c.t0 > c.vida) { f = c; fIdx = (fIdx + j + 1) % NF; break; } if (j === NF - 1) fIdx = (fIdx + 1) % NF; }
  f.x = x; f.y = y; f.z = z; f.r = r; f.t0 = t; f.vida = vida; f.tipo = tipo; f.k = k; f.fogo = !!fogo;
};
/* o fx3d avisa das explosões e das chamas (só no Motor 5): explosão grande e plasma esquentam o ar; as maiores soltam o anel */
function ligaFx(FX) {
  D.fxLigado = true; const ex = FX.explosion, fo = FX.fire;
  if (typeof ex === 'function') FX.explosion = function (x, y, z, size, o) { if (D.rfOn) { const pl = o && (o.race === 'erevane' || o.raca === 'erevane'); const dl = (o && o.delay) || 0;
    if (size >= 9 || (pl && size >= 3)) { D.calor(x, y + size * 0.4, z, size * (pl ? 2.2 : 1.8), 0, Math.min(1, size / (pl ? 12 : 22)), 1.1 + size * 0.025); if (dl) FONTES[(fIdx + NF - 1) % NF].t0 += dl; }
    if ((size >= 18 || (o && o.wave)) && !(o && o.delay)) D.calor(x, y + size * 0.3, z, size * 6, 1, Math.min(1, size / 30), 0.5); }
    return ex.apply(this, arguments); };
  if (typeof fo === 'function') FX.fire = function (x, y, z, size, k) { if (D.rfOn && (k == null || k > 0.25)) D.calor(x, y + size * 1.2, z, size * 2.4, 0, 0.55 * Math.min(1, k == null ? 1 : k), 0.8, true); return fo.apply(this, arguments); };
}
/* projeção das fontes vivas na tela (uv com y para baixo, como o getScreenPosition do TSL) */
function fontes(camera, R) {
  const RF = D.RF, A = RF.A, t = R.time; let n = 0; const P = camera.projectionMatrix.elements, Vw = camera.matrixWorldInverse.elements; const tanF = Math.tan((camera.fov || 50) * Math.PI / 360);
  for (const f of FONTES) { const ta = t - f.t0; if (ta < 0 || ta > f.vida || n >= NF) continue;
    const vx = Vw[0] * f.x + Vw[4] * f.y + Vw[8] * f.z + Vw[12], vy = Vw[1] * f.x + Vw[5] * f.y + Vw[9] * f.z + Vw[13], vz = Vw[2] * f.x + Vw[6] * f.y + Vw[10] * f.z + Vw[14]; const dist = -vz; if (dist < 1) continue;
    const cx = P[0] * vx + P[4] * vy + P[8] * vz + P[12], cy = P[1] * vx + P[5] * vy + P[9] * vz + P[13], cw = P[3] * vx + P[7] * vy + P[11] * vz + P[15]; if (cw <= 0) continue;
    const u = cx / cw * 0.5 + 0.5, w = 1 - (cy / cw * 0.5 + 0.5); const ru = f.r / (dist * 2 * tanF); if (u < -ru * 2 || u > 1 + ru * 2 || w < -ru * 3 || w > 1 + ru * 2) continue;
    let k = f.k * D.rfK, rr = 0, lr = 0; if (f.tipo === 0) { const fi = Math.min(1, ta / 0.15), fo = 1 - Math.max(0, (ta - f.vida * 0.6) / (f.vida * 0.4)); k *= fi * fo; } else { const x = Math.min(1, ta / f.vida); rr = ru * (1 - Math.pow(1 - x, 3)); lr = ru * 0.09 + rr * 0.12; k *= Math.pow(1 - x, 1.5); }
    if (k < 0.01) continue; A[n * 2].set(u, w, ru, k); A[n * 2 + 1].set(f.tipo, rr, lr, dist - f.r * 0.6); n++; }
  RF.n.value = n; RF.asp.value = camera.aspect || 1.6; RF.t.value = t; RF.perto.value = camera.near; RF.longe.value = camera.far;
}
/* ---------- o passe: src/m5/pos.js chama logo depois do passe da cena; devolve a cena lida com o deslocamento (Alta e Ultra), ou null ---------- */
D.refrata = function (base, color, depth, camera, q) {
  const r = q && (q.resolved || q.name); D.rfOn = false; if (!REFRACAO || M5.up || D.toque || matchMedia('(pointer: coarse)').matches || !(r === 'alta' || r === 'ultra')) return null;
  const Tm = T(), TL = L(); const { Fn, If, Loop, Break, float, int, vec2, vec4, uniform, uniformArray, uv, sin, cos, exp, max, min, length, smoothstep, perspectiveDepthToViewZ } = TL;
  if (!D.RF) { const A = []; for (let i = 0; i < NF * 2; i++) A.push(new Tm.Vector4()); D.RF = { A, F: uniformArray(A, 'vec4'), n: uniform(0), asp: uniform(1.6), t: uniform(0), perto: uniform(1), longe: uniform(10000) }; }
  const RF = D.RF; D.rfOn = true;
  return Fn(() => { const u = uv().toVar('rfu'); const off = vec2(0).toVar('rfo');
    If(RF.n.greaterThan(0.5), () => { const dz = depth.sample(u).r; const pd = perspectiveDepthToViewZ(dz, RF.perto, RF.longe).negate().toVar('rfd'); const calor = float(0).toVar('rfk');
      Loop({ start: int(0), end: int(NF), type: 'int', condition: '<', name: 'j' }, ({ j }) => {
        If(float(j).greaterThanEqual(RF.n), () => { Break(); });
        const a = RF.F.element(j.mul(2)).toVar('rfa'), b = RF.F.element(j.mul(2).add(1)).toVar('rfb');
        const dd = vec2(u.x.sub(a.x).mul(RF.asp), u.y.sub(a.y)).toVar('rfdd'); const raio = max(a.z.mul(1.8), b.y.add(b.z.mul(3)));
        If(dd.x.abs().lessThan(raio).and(dd.y.abs().lessThan(raio.add(a.z.mul(1.2)))), () => { /* fora da caixa da fonte: nada a somar (a maior parte da tela) */
          const atras = smoothstep(b.w.sub(4), b.w.add(10), pd);
          If(b.x.lessThan(0.5), () => { /* ar quente: só a força da pluma acima da fonte; a onda é uma só para todas (abaixo) */
            const e = length(vec2(dd.x.div(max(a.z.mul(0.85), 1e-4)), dd.y.add(a.z.mul(0.9)).div(max(a.z.mul(1.7), 1e-4))));
            calor.addAssign(float(1).sub(smoothstep(0.45, 1.0, e)).mul(atras).mul(a.w));
          }).Else(() => { /* onda de choque: anel que abre e empurra a imagem para fora */
            const dl = length(dd).toVar('rfdl'); const x = dl.sub(b.y).div(max(b.z, 1e-4)); const g = exp(x.mul(x).negate()).mul(atras).mul(a.w);
            off.addAssign(dd.div(max(dl, 1e-4)).mul(vec2(float(1).div(RF.asp), 1)).mul(g.mul(-0.011)));
          });
        });
      });
      If(calor.greaterThan(0.001), () => { off.addAssign(vec2(sin(u.y.mul(230).sub(RF.t.mul(7)).add(sin(u.x.mul(90).add(RF.t.mul(3))))), cos(u.x.mul(170).add(RF.t.mul(5.3)))).mul(min(calor, 1.5).mul(0.0024))); }); /* ondas finas que sobem: um seno por pixel, não um por fonte */
    });
    return color.sample(u.add(off)); })().toVar('rfCor'); /* uma variável: a bruma, a oclusão e as nuvens leem a cena mais de uma vez (sem ela o laço rodava em cada leitura) */
};
})(globalThis.ARD = globalThis.ARD || {});
