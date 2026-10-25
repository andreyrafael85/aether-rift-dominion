/* Aether Rift: Dominion — efeitos 3D na GPU (4.2c; explosões, fumaça e fogo refeitos na 4.3g).
   Partículas instanciadas: cada uma é um quadrado que o vertex shader vira de frente para a câmera (ou deita no chão, nas ondas
   de choque) e move por conta própria (posição inicial + velocidade com arrasto + gravidade·t²/2). A CPU só escreve quando nasce
   uma partícula; não há laço por partícula a cada quadro. Dois lotes: aditivo (fogo, clarão, faísca, brilho, onda, língua, brasa)
   e translúcido (fumaça, poeira, destroço, gota). Formas desenhadas no fragment shader, sem texturas.
   4.3g: arrasto (abre rápido e para), fumaça e poeira com volume iluminado pelo sol e pelo céu da cena (lidos das luzes a cada
   quadro), fumaça acesa por dentro pelo fogo, bola de fogo que esfria do branco ao vermelho e se rasga, destroço que gira, esquenta
   na borda e pousa no chão, língua de chama, brasa que balança, casca de choque no ar, anel de poeira no chão, gota de seiva/ácido.
   5.0b: no Motor 5 o mesmo sistema roda em TSL (m5Particulas, abaixo): mesmos atributos, mesmas receitas e a mesma CPU. */
(function (ARD) {
'use strict';
/* tipos (iC.w) e o que o campo extra (iC.z) quer dizer em cada um:
   0 bola de fogo (extra = arrasto) · 1 clarão (extra = força dos raios) · 2 faísca esticada na velocidade (extra = arrasto)
   3 fumaça (|extra| = arrasto×10 + brilho do fogo na fração; negativo = nasce no ar, sem trava no chão) · 4 poeira (extra = arrasto)
   5 destroço (extra = altura até o chão + 1000 × material: 0 metal, 1 cristal, 2 carne, 3 terra) · 6 onda no chão (extra > 0: só o aro)
   7 brilho (extra = puxão para a câmera) · 8 anel vertical · 9 língua de chama, no lote translúcido (extra = puxão + alongamento/10; 2 se 0) · 10 brasa (extra = balanço) · 11 casca de choque no ar
   12 anel de poeira no chão · 13 gota esticada na velocidade (extra = arrasto)
   14 bola de fogo que vira fumaça, no lote translúcido (extra = 100 × puxão + arrasto×10 + fração da vida em fogo)
   atributos por partícula: iA = posição inicial + instante de nascimento; iB = velocidade + vida; iC = tamanho inicial, final, extra, tipo;
   iD = gravidade, curva do tamanho, giro, opacidade; iE = cor + semente */
/* ---------- 5.0b: Motor 5 — o mesmo sistema em TSL (WGSL no WebGPU, GLSL na reserva WebGL2) ----------
   Mesmo modelo analítico: os mesmos 5 atributos por partícula, a CPU só escreve no nascimento e o vértice anda, cresce e apaga pelo relógio.
   O vértice devolve a posição de recorte (vertexNode) como o gl_Position do GLSL; o fragmento tem os mesmos ramos por tipo (If de verdade,
   sem select com amostra de textura), e cada lote monta só os tipos dele, como o #ifdef PREMULTIPLIED_ALPHA do clássico. Mistura igual à do
   clássico: aditivo SrcAlpha/One, translúcido pré-multiplicado One/OneMinusSrcAlpha (montado aqui, sem o premultipliedAlpha do NodeMaterial).
   Os atributos ficam em StaticDrawUsage no Motor 5: no r186 o Renderer reenvia o buffer inteiro de todo atributo DynamicDrawUsage a cada
   desenho; assim só sobe o trecho escrito no quadro (updateRanges), como no clássico. */
const m5Ativo = () => !!(ARD.m5 && ARD.m5.active && ARD.m5.active());
function m5Uniforms(THREE) { const { uniform } = window.TSL;
  return { uTime: uniform(0), uCamR: uniform(new THREE.Vector3(1, 0, 0)), uCamU: uniform(new THREE.Vector3(0, 1, 0)), uCamF: uniform(new THREE.Vector3(0, 0, 1)),
    uSunDir: uniform(new THREE.Vector3(-0.47, 0.64, 0.6).normalize()), uSunC: uniform(new THREE.Color(0.85, 0.69, 0.47)), uAmbC: uniform(new THREE.Color(0.26, 0.37, 0.51)),
    uSemPos: uniform(0), uGama: uniform(1.5) /* sem pós (Baixa): saída como a do clássico (abaixo, m5InversoSaida) */, uExpo: m5Exposicao() /* 5.0b (junção): a exposição em uso (ARD.m5.u.exposicao do Modo Foto) */ }; }
/* 5.0b (junção): o uniform compartilhado da exposição do tone mapping (src/m5/foto.js: 1 na partida, 2^EV no Modo Foto). Sem pós a saída do three
   faz ACES(cor × exposição) e o clássico desenha os efeitos crus, sem exposição: a inversa divide por ela (fora da função com setLayout: o
   uniform fica no corpo do material). Sem o foto.js (bancadas), um uniform fixo em 1, como antes. */
function m5Exposicao() { const M5 = ARD.m5; const u = M5 && M5.foto && M5.foto.exposicao ? M5.foto.exposicao() : null; return u || window.TSL.uniform(1); }
/* 5.0b: sem pós (Baixa) o clássico desenha direto na tela e os ShaderMaterial dos efeitos não fazem tone mapping nem sRGB: o valor sai cru e a
   mistura acontece na imagem final (fumaça quase preta, fogo saturado). O Motor 5 mistura em linear e faz ACES + sRGB no fim (fumaça cinza
   clara). Para a mesma imagem (regra de carga 11, de um jeito exato para o que cobre): a cor sai pela inversa da saída (sRGB → linear → ACES⁻¹
   com as mesmas matrizes do three) e a transparência do fundo vai a γ (uGama ≈ 1,5: a mistura em linear deixa passar mais fundo). Com pós
   (Média, Alta, Ultra) os dois motores misturam em linear e nada muda. Um uniform liga (uSemPos): trocar de qualidade não cria pipeline. */
function m5InversoSaida() {
  const { Fn, vec3, float, max, min, pow, sqrt, dot, step, mix } = window.TSL;
  return Fn(([v0]) => {
    const v = min(max(v0, vec3(0)), vec3(0.999)).toVar();
    const lin = mix(v.div(12.92), pow(v.add(0.055).div(1.055), vec3(2.4)), step(vec3(0.04045), v)).toVar(); /* sRGB → linear */
    const y = min(vec3(dot(vec3(0.643038, 0.311187, 0.045775), lin), dot(vec3(0.059269, 0.931436, 0.009295), lin), dot(vec3(0.005962, 0.063929, 0.930118), lin)), vec3(1)).toVar(); /* ACESOutputMat⁻¹ */
    const A = float(1).sub(y.mul(0.983729)).toVar(), B = float(0.0245786).sub(y.mul(0.432951)).toVar(), C = y.mul(0.238081).add(0.000090537);
    const c = B.negate().add(sqrt(B.mul(B).add(A.mul(C).mul(4)))).div(A.mul(2)).toVar(); /* RRTAndODTFit⁻¹ (a raiz positiva da quadrática) */
    return max(vec3(dot(vec3(1.764741, -0.675778, -0.088963), c), dot(vec3(-0.147028, 1.160252, -0.013224), c), dot(vec3(-0.036337, -0.162436, 1.198773), c)).mul(0.6), vec3(0)); /* ACESInputMat⁻¹ e a exposição (1/0,6) */
  }).setLayout({ name: 'ardInversoSaida', type: 'vec3', inputs: [{ name: 'v', type: 'vec3' }] });
}
function m5Particulas(U, aditivo) {
  const T = window.THREE_M5, L = window.TSL;
  const { Fn, If, Discard, attribute, positionGeometry, varyingProperty, float, vec2, vec3, vec4, max, min, abs, floor, fract, mod, exp, pow, sqrt, sin, cos, mix, smoothstep, clamp, length, normalize, dot, select, modelViewMatrix, cameraProjectionMatrix, cameraPosition } = L;
  const ent = (x, a, b) => x.greaterThan(a).and(x.lessThan(b)); /* a < x < b, como os testes de tipo do GLSL */
  const iA = attribute('iA', 'vec4'), iB = attribute('iB', 'vec4'), iC = attribute('iC', 'vec4'), iD = attribute('iD', 'vec4'), iE = attribute('iE', 'vec4');
  const vU = varyingProperty('vec4', 'vFxU'), vK = varyingProperty('vec4', 'vFxK'), vX = varyingProperty('vec4', 'vFxX'); /* uv, idade, tipo · cor, semente · opacidade, extra, tempo, capota (vUv, vAge, vType, vCol, vSeed, vA, vX, vT, vF do GLSL em 3 vec4) */
  const m = new T.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, depthTest: true, blending: T.CustomBlending, blendEquation: T.AddEquation, blendSrc: aditivo ? T.SrcAlphaFactor : T.OneFactor, blendDst: aditivo ? T.OneFactor : T.OneMinusSrcAlphaFactor });
  m.lights = false; m.fog = false;
  m.vertexNode = Fn(() => {
    const q0 = positionGeometry.xy;
    const t = U.uTime.sub(iA.w).toVar(), age = t.div(max(iB.w, 0.001)).toVar(), ty = iC.w.toVar(), vF = float(1).toVar(), out = vec4(2, 2, 2, 1).toVar();
    vU.assign(vec4(q0.add(0.5), age, ty)); vK.assign(iE);
    If(age.greaterThanEqual(0).and(age.lessThanEqual(1)), () => {
      const k = float(0).toVar(), tm = t.toVar();
      If(ty.lessThan(0.5).or(ent(ty, 1.5, 2.5)).or(ent(ty, 3.5, 4.5)).or(ent(ty, 12.5, 13.5)), () => { k.assign(max(iC.z, 0)); })
        .ElseIf(ent(ty, 2.5, 3.5), () => { k.assign(floor(abs(iC.z)).mul(0.1)); })
        .ElseIf(ty.greaterThan(13.5), () => { k.assign(mod(floor(abs(iC.z)), 100).mul(0.1)); })
        .ElseIf(ent(ty, 9.5, 10.5), () => { k.assign(1.3); })
        .ElseIf(ent(ty, 4.5, 5.5).and(iD.x.greaterThan(0)), () => { const h = mod(iC.z, 1000).toVar(); If(h.greaterThan(0), () => { tm.assign(min(t, iB.y.add(sqrt(iB.y.mul(iB.y).add(iD.x.mul(2).mul(h)))).div(iD.x))); }); }); /* destroço pousa no chão e para */
      const f = tm.toVar(); If(k.greaterThan(0.0005), () => { f.assign(float(1).sub(exp(k.negate().mul(tm))).div(k)); });
      const p = iA.xyz.add(iB.xyz.mul(f)).add(vec3(0, iD.x.mul(-0.5).mul(tm).mul(tm), 0)).toVar();
      const size = mix(iC.x, iC.y, float(1).sub(pow(float(1).sub(age), iD.y))).toVar();
      If(ent(ty, 9.5, 10.5), () => { const sw = iC.z.mul(min(1, t.mul(1.5))); p.addAssign(vec3(sin(t.mul(2.7).add(iE.w.mul(40))), 0, cos(t.mul(2.1).add(iE.w.mul(23)))).mul(sw)); }); /* brasa balança no ar quente */
      If(ent(ty, 2.5, 3.5).and(iC.z.greaterThanEqual(0)).or(ent(ty, 3.5, 4.5)), () => { p.y.assign(max(p.y, iA.y.add(size.mul(0.42)))); }); /* fumaça e poeira do chão não atravessam o chão */
      If(ty.greaterThan(13.5), () => { p.y.assign(max(p.y, iA.y.add(size.mul(0.3)))); });
      const pull = float(0).toVar(), pa = float(0).toVar(); /* clarão, casca e fogo vêm para a frente (mesmo tamanho na tela) */
      If(ent(ty, 0.5, 1.5).or(ent(ty, 10.5, 11.5)), () => { pull.assign(0.55); })
        .ElseIf(ent(ty, 8.5, 9.5), () => { pull.assign(1); pa.assign(floor(iC.z)); })
        .ElseIf(ty.greaterThan(13.5), () => { pull.assign(0.3); pa.assign(floor(floor(abs(iC.z)).div(100))); })
        .ElseIf(ent(ty, 6.5, 7.5), () => { pa.assign(max(iC.z, 0)); });
      If(pull.greaterThan(0).or(pa.greaterThan(0)), () => { const tc = cameraPosition.sub(p).toVar(), dc = length(tc).toVar(); const dd = min(size.mul(pull).add(pa), dc.mul(0.6)).toVar(); p.addAssign(tc.div(dc).mul(dd)); size.mulAssign(dc.sub(dd).div(dc)); });
      const q = q0.toVar(), off = vec3(0).toVar();
      If(ent(ty, 5.5, 6.5).or(ent(ty, 11.5, 12.5)), () => { off.assign(vec3(q.x, 0, q.y.negate()).mul(size)); }) /* deitado no chão */
        .ElseIf(ent(ty, 7.5, 8.5), () => { off.assign(U.uCamR.mul(q.x).add(vec3(0, 1, 0).mul(q.y)).mul(size)); })
        .ElseIf(ent(ty, 8.5, 9.5), () => { const fz = fract(iC.z).toVar(); const asp = select(fz.greaterThan(0), fz.mul(10), float(2)); off.assign(U.uCamR.mul(q.x).add(U.uCamU.mul(q.y.add(0.5).mul(asp))).mul(size)); }) /* língua: a base fica no ponto */
        .ElseIf(ent(ty, 1.5, 2.5).or(ent(ty, 12.5, 13.5)), () => { /* faísca e gota esticadas na velocidade (na tela) */
          const vel = iB.xyz.mul(exp(k.negate().mul(t))).add(vec3(0, iD.x.negate().mul(t), 0)); const v4 = modelViewMatrix.mul(vec4(vel, 0)).toVar(); const d = normalize(v4.xy.add(vec2(0.0001))).toVar();
          const Ls = float(1).add(length(v4.xy).mul(select(ty.greaterThan(12.5), float(0.012), float(0.025)))).toVar(); const q2 = vec2(q.x.mul(d.x).mul(Ls).sub(q.y.mul(d.y)), q.x.mul(d.y).mul(Ls).add(q.y.mul(d.x))).toVar();
          off.assign(U.uCamR.mul(q2.x).add(U.uCamU.mul(q2.y)).mul(size)); })
        .Else(() => { const ang = iD.z.mul(tm).add(iE.w.mul(6.2831)).toVar(); const c = cos(ang).toVar(), s = sin(ang).toVar();
          If(ent(ty, 4.5, 5.5), () => { const fl = cos(iD.z.mul(0.7).mul(tm).add(iE.w.mul(9))).toVar(); vF.assign(fl); q.x.mulAssign(max(0.2, abs(fl))); }); /* destroço capota */
          const qr = vec2(c.mul(q.x).sub(s.mul(q.y)), s.mul(q.x).add(c.mul(q.y))).toVar();
          If(ent(ty, 3.5, 4.5), () => { qr.y.mulAssign(0.7); }); /* poeira rasteira */
          off.assign(U.uCamR.mul(qr.x).add(U.uCamU.mul(qr.y)).mul(size)); });
      out.assign(cameraProjectionMatrix.mul(modelViewMatrix.mul(vec4(p.add(off), 1))));
    });
    vX.assign(vec4(iD.w, iC.z, t, vF));
    return out;
  })();
  /* ruídos e luz (funções de verdade no shader: setLayout) */
  const fl1 = n => [{ name: n, type: 'float' }], fl2 = n => [{ name: n, type: 'vec2' }];
  const hh = Fn(([p]) => { const p3 = fract(vec3(p.x, p.y, p.x).mul(0.1031)).toVar(); p3.addAssign(dot(p3, p3.yzx.add(33.33))); return fract(p3.x.add(p3.y).mul(p3.z)); }).setLayout({ name: 'ardFxHash', type: 'float', inputs: fl2('p') }); /* hash sem seno */
  const nn = Fn(([p]) => { const i = floor(p).toVar(), f0 = fract(p).toVar(); const u = f0.mul(f0).mul(vec2(3).sub(f0.mul(2))).toVar(); return mix(mix(hh(i), hh(i.add(vec2(1, 0))), u.x), mix(hh(i.add(vec2(0, 1))), hh(i.add(vec2(1, 1))), u.x), u.y); }).setLayout({ name: 'ardFxRuido', type: 'float', inputs: fl2('p') });
  const fbm = Fn(([p]) => nn(p).mul(0.55).add(nn(p.mul(2.1).add(3.7)).mul(0.3)).add(nn(p.mul(4.3).add(7.1)).mul(0.15))).setLayout({ name: 'ardFxFbm', type: 'float', inputs: fl2('p') });
  const fb2 = Fn(([p]) => nn(p).mul(0.64).add(nn(p.mul(2.3).add(3.7)).mul(0.36))).setLayout({ name: 'ardFxFb2', type: 'float', inputs: fl2('p') }); /* duas oitavas: fumaça e poeira */
  const heat = Fn(([T0]) => { const Tc = clamp(T0, 0, 1).toVar(), T2 = Tc.mul(Tc).toVar(); return vec3(Tc.mul(3.1).mul(Tc.mul(0.25).add(0.75)), T2.mul(2.65).mul(Tc.mul(0.8).add(0.2)), T2.mul(T2).mul(Tc).mul(1.9)); }).setLayout({ name: 'ardFxCalor', type: 'vec3', inputs: fl1('T') }); /* corpo negro barato (HDR para o bloom) */
  const inv = m5InversoSaida();
  const luz = n => { const w = clamp(dot(n, U.uSunDir).mul(0.6).add(0.4), 0, 1).toVar(); const am = mix(vec3(dot(U.uAmbC, vec3(0.3333))), U.uAmbC, 0.5); return am.add(U.uSunC.mul(w.mul(w))); }; /* céu meio dessaturado (em linha: uniform dentro de função com setLayout não entra no bloco de uniforms no r186) */
  m.colorNode = Fn(() => {
    const uvv = vU.xy, k = vU.z.toVar(), ty = vU.w.toVar(), vCol = vK.xyz.toVar(), vSeed = vK.w.toVar(), vA = vX.x, vXx = vX.y.toVar(), vT = vX.z.toVar(), vF = vX.w.toVar();
    const c = uvv.sub(0.5).toVar(), r = length(c).mul(2).toVar(); const a = float(0).toVar(), col = vCol.toVar();
    if (aditivo) { /* aditivo: 0 bola de fogo, 1 clarão, 2 faísca, 6 onda no chão, 7 brilho, 8 anel vertical, 10 brasa, 11 casca de choque (outro: bolha macia) */
      If(ty.lessThan(0.5), () => { /* bola de fogo aditiva: esfria do branco ao vermelho, a borda se rasga */
        If(r.greaterThan(1), () => { Discard(); });
        const n1 = fbm(c.mul(3.2).add(vSeed.mul(31)).add(vec2(0, vT.mul(-1.1)))).toVar(), n2 = nn(c.mul(6.5).add(vSeed.mul(17)).add(vec2(vT.mul(0.6), vT.mul(-1.8)))).toVar(), z = sqrt(max(0, float(1).sub(r.mul(r)))).toVar();
        col.assign(heat(float(1.1).sub(k.mul(1.15)).mul(z.mul(0.5).add(0.6)).add(n2.sub(0.5).mul(0.6))).mul(vCol));
        a.assign(float(1).sub(smoothstep(float(0.45).sub(k.mul(0.15)), 0.98, r.add(n1.sub(0.5).mul(k.mul(0.6).add(0.5))))).mul(z.mul(0.5).add(0.5)).mul(float(1).sub(smoothstep(0.85, 1, r))).mul(smoothstep(0, 0.035, k.add(0.01))).mul(float(1).sub(smoothstep(0.62, 1, k))).mul(smoothstep(-0.15, 0.25, n2.sub(k.mul(0.45)))));
      }).ElseIf(ty.lessThan(1.5), () => { /* clarão: núcleo, halo e estrela de raios */
        const g = exp(r.mul(r).mul(-6)).toVar(), q = vec2(c.x.add(c.y), c.x.sub(c.y)).mul(0.7071).toVar(); const ray = float(0).toVar();
        If(vXx.greaterThan(0), () => { ray.assign(exp(abs(c.x.mul(c.y)).mul(-400)).add(exp(abs(q.x.mul(q.y)).mul(-500)).mul(0.6)).mul(exp(r.mul(-2.4))).mul(vXx)); });
        a.assign(g.add(exp(r.mul(-3)).mul(0.4)).add(ray).mul(float(1).sub(k)).mul(float(1).sub(k)).mul(float(1).sub(smoothstep(0.8, 1, r)))); col.assign(vCol.mul(g.mul(2).add(1)));
      }).ElseIf(ty.lessThan(2.5), () => { /* faísca: núcleo branco que esfria */
        const g = exp(r.mul(r).mul(-9)).toVar(); a.assign(g.mul(float(1).sub(k.mul(k)))); col.assign(mix(vCol.mul(2).add(vec3(0.6).mul(g)), vCol.mul(vec3(1, 0.45, 0.25)), smoothstep(0.2, 1, k)));
      }).ElseIf(ent(ty, 5.5, 6.5), () => { /* onda de luz no chão; extra > 0 = só o aro */
        const nz = nn(c.mul(9).add(vSeed.mul(20)).add(vec2(0, k.mul(2)))).toVar(), ed = nz.sub(0.5).mul(0.06).add(0.9).toVar();
        const ring = smoothstep(ed.sub(0.22), ed, r).mul(float(1).sub(smoothstep(ed, ed.add(0.05), r))).toVar(); const inner = float(0).toVar(); If(vXx.lessThanEqual(0), () => { inner.assign(float(1).sub(smoothstep(0, ed, r)).mul(0.2).mul(float(1).sub(k))); });
        a.assign(ring.mul(nz.mul(0.7).add(0.55)).add(inner).mul(float(1).sub(k)).mul(float(1).sub(k))); col.assign(vCol.mul(1.6));
      }).ElseIf(ent(ty, 6.5, 7.5), () => { a.assign(exp(r.mul(r).mul(-3)).mul(float(1).sub(smoothstep(0.6, 1, r))).mul(float(1).sub(k))); col.assign(vCol.mul(1.4)); })
        .ElseIf(ent(ty, 7.5, 8.5), () => { a.assign(smoothstep(0.7, 0.88, r).mul(float(1).sub(smoothstep(0.9, 1, r))).mul(float(1).sub(k))); col.assign(vCol.mul(1.8)); })
        .ElseIf(ent(ty, 9.5, 10.5), () => { /* brasa: ponto que pisca e esfria */
          a.assign(exp(r.mul(r).mul(-12)).mul(sin(vT.mul(21).add(vSeed.mul(60))).mul(0.4).add(0.6)).mul(float(1).sub(smoothstep(0.65, 1, k)))); col.assign(mix(vCol.mul(1.6), vCol.mul(vec3(0.7, 0.3, 0.15)), smoothstep(0.1, 0.9, k)));
        }).ElseIf(ent(ty, 10.5, 11.5), () => { /* casca de choque no ar */
          a.assign(smoothstep(0.7, 0.95, r).mul(float(1).sub(smoothstep(0.95, 1, r))).add(float(1).sub(smoothstep(0.2, 0.95, r)).mul(0.1)).mul(float(1).sub(k)).mul(float(1).sub(k))); col.assign(vCol);
        }).Else(() => { a.assign(exp(r.mul(r).mul(-4)).mul(float(1).sub(smoothstep(0.7, 1, r))).mul(float(1).sub(k))); col.assign(vCol.mul(1.4)); });
      a.mulAssign(vA); If(a.lessThan(0.003), () => { Discard(); });
      const saida = vec4(col, a).toVar(); If(U.uSemPos.greaterThan(0.5), () => { saida.assign(vec4(inv(col.mul(a)).div(U.uExpo), 1)); }); /* sem pós: soma o mesmo que o clássico soma na imagem final; 5.0b (junção): ÷ exposição (o Modo Foto muda) */
      return saida;
    }
    /* translúcido: 3 fumaça, 4 poeira, 5 destroço, 9 língua, 12 anel de poeira, 13 gota, 14 fogo que vira fumaça (outro: bolha macia) */
    const em = vec3(0).toVar();
    If(ent(ty, 2.5, 4.5).or(ty.greaterThan(13.5)).and(r.greaterThan(1)), () => { Discard(); });
    const n1 = float(0.5).toVar(), n2 = float(0.5).toVar();
    If(ent(ty, 2.5, 4.5).or(ent(ty, 8.5, 9.5)).or(ent(ty, 11.5, 12.5)).or(ty.greaterThan(13.5)), () => {
      const s1 = vec2(2.6).toVar(), d1 = vec2(0.04, -0.1).toVar(), s2 = vec2(7).toVar(), d2 = vec2(0, -0.25).toVar(), o1 = float(11).toVar(), o2 = float(5).toVar();
      If(ent(ty, 3.5, 4.5), () => { s1.assign(vec2(3)); d1.assign(vec2(0.1, 0)); o1.assign(7); })
        .ElseIf(ent(ty, 8.5, 9.5), () => { s1.assign(vec2(2.4, 1.5)); d1.assign(vec2(0, -2.4)); o1.assign(7); s2.assign(vec2(5.2, 3)); d2.assign(vec2(0, -4.2)); })
        .ElseIf(ent(ty, 11.5, 12.5), () => { s1.assign(vec2(6)); d1.assign(vec2(0, -0.4)); o1.assign(9); })
        .ElseIf(ty.greaterThan(13.5), () => { s1.assign(vec2(2.8)); d1.assign(vec2(0, -0.5)); o1.assign(31); s2.assign(vec2(5.6)); d2.assign(vec2(0.35, -1.1)); o2.assign(17); });
      const u1 = c.mul(s1).add(vSeed.mul(o1)).add(vT.mul(d1)).toVar();
      If(ty.greaterThan(8.5).and(ty.lessThan(9.5).or(ty.greaterThan(13.5))), () => { n1.assign(fbm(u1)); }).Else(() => { n1.assign(fb2(u1)); });
      n2.assign(nn(c.mul(s2).add(vSeed.mul(o2)).add(vT.mul(d2))));
    });
    const z = sqrt(max(0, float(1).sub(r.mul(r)))).toVar(); const Tq = float(0).toVar(), ew = float(0).toVar(), Lz = vec3(1).toVar();
    If(ent(ty, 2.5, 4.5).or(ty.greaterThan(13.5)), () => { const pw = select(ent(ty, 3.5, 4.5), float(0), float(1)).toVar(); /* volume com ruído (a poeira é lisa) */
      Lz.assign(luz(normalize(U.uCamR.mul(c.x.mul(2).add(n1.sub(0.5).mul(1.2).mul(pw))).add(U.uCamU.mul(c.y.mul(2).add(n2.sub(0.5).mul(0.8).mul(pw)).add(0.3).sub(pw.mul(0.3)))).add(U.uCamF.mul(z.add(0.3)))))); });
    If(ent(ty, 2.5, 3.5), () => { /* fumaça: lado do sol claro, acesa por dentro pelo fogo no começo, clareia ao se espalhar */
      const dens = float(1).sub(smoothstep(0.25, 0.95, r.add(n1.sub(0.5).mul(0.8)).add(n2.sub(0.5).mul(0.18)))).mul(float(1).sub(smoothstep(0.82, 1, r))).toVar();
      const gl = fract(abs(vXx)).mul(float(1).sub(smoothstep(0, 0.45, k))).toVar();
      col.assign(vCol.mul(Lz).mul(n1.mul(0.4).add(0.8)).mul(smoothstep(0.1, 0.9, k).mul(0.9).add(1)).add(vec3(1.25, 0.36, 0.05).mul(gl.mul(gl)).mul(clamp(float(0.35).sub(c.y.mul(1.8)), 0, 1)).mul(z.mul(0.6).add(0.4)).mul(0.55)));
      a.assign(dens.mul(smoothstep(0, 0.08, k)).mul(float(1).sub(smoothstep(0.45, 1, k))).mul(n1.mul(0.45).add(0.55)));
    }).ElseIf(ent(ty, 3.5, 4.5), () => { /* poeira: mesma luz, mais rala */
      col.assign(vCol.mul(Lz).mul(n1.mul(0.3).add(0.85)));
      a.assign(float(1).sub(smoothstep(0.2, 0.95, r.add(n1.sub(0.5).mul(0.6)))).mul(float(1).sub(smoothstep(0.8, 1, r))).mul(smoothstep(0, 0.06, k)).mul(float(1).sub(smoothstep(0.35, 1, k))).mul(0.85));
    }).ElseIf(ent(ty, 4.5, 5.5), () => { /* destroço: lasca de 4 cortes; metal com borda em brasa, cristal que cintila, carne molhada, torrão de terra */
      const p = c.mul(2).toVar(); const h1 = fract(vSeed.mul(13.7)), h2 = fract(vSeed.mul(29.3)), h3 = fract(vSeed.mul(47.1)), h4 = fract(vSeed.mul(71.9));
      const d = max(max(p.y.sub(0.45).sub(h1.mul(0.45)), dot(p, vec2(0.866, -0.5)).sub(0.45).sub(h2.mul(0.45))), max(dot(p, vec2(-0.866, -0.5)).sub(0.45).sub(h3.mul(0.45)), dot(p, vec2(h4.mul(0.6).add(0.3), 0.75)).sub(0.55))).toVar(); d.assign(max(d, r.sub(0.95)));
      const sh = float(1).sub(smoothstep(-0.08, 0.02, d)).toVar(), mt = floor(vXx.div(1000)).toVar(), fc = max(0, vF).toVar(), g1 = float(1).sub(abs(vF)).toVar(); g1.mulAssign(g1); g1.mulAssign(g1); const f2 = fc.mul(fc).toVar(); f2.mulAssign(f2);
      If(ent(mt, 0.5, 1.5), () => { col.assign(vCol.mul(fc.mul(0.55).add(0.55)).add(vec3(2.2, 1.9, 2.7).mul(g1.mul(g1))).add(vCol.mul(0.7).mul(smoothstep(-0.3, 0, d)))); })
        .ElseIf(ent(mt, 1.5, 2.5), () => { col.assign(vCol.mul(fc.mul(0.75).add(0.45)).add(vec3(0.56, 0.38, 0.32).mul(f2.mul(f2).mul(fc).mul(fc)))); })
        .Else(() => { col.assign(vCol.mul(U.uAmbC.mul(0.9).add(U.uSunC.mul(fc.mul(0.75).add(0.25))))); });
      a.assign(sh.mul(float(1).sub(smoothstep(0.8, 1, k)))); Tq.assign(float(0.62).sub(k.mul(1.2)));
      If(mt.lessThan(0.5), () => { ew.assign(float(1).sub(smoothstep(0, 0.3, k)).mul(smoothstep(-0.35, 0, d).mul(0.65).add(0.35)).mul(0.8).mul(a)); }); /* metal em brasa que esfria */
    }).ElseIf(ent(ty, 8.5, 9.5), () => { /* língua de chama: larga e quente na base, fina e vermelha na ponta */
      const x = c.x.mul(2).toVar(), y = uvv.y.toVar();
      const xx = x.add(n1.sub(0.5).mul(y.add(0.4))).add(n2.sub(0.5).mul(0.3)).div(max(0.06, mix(0.95, 0.18, y.mul(y.mul(0.65).add(0.35))).mul(n1.mul(0.5).add(0.75)))).toVar();
      const fd = float(1).sub(smoothstep(0.4, 1, abs(xx))).mul(smoothstep(0, 0.16, y)).mul(float(1).sub(smoothstep(0.5, 0.98, y.add(n2.sub(0.5).mul(0.45))))).mul(float(1).sub(smoothstep(0.8, 1, abs(x)))).mul(float(1).sub(smoothstep(0.85, 1, y))).mul(smoothstep(0, 0.08, k)).mul(float(1).sub(smoothstep(0.55, 1, k))).toVar();
      Tq.assign(float(1.15).sub(y.mul(0.9)).mul(float(1).sub(abs(xx).mul(0.5))).sub(k.mul(0.4)).add(n2.sub(0.5).mul(0.35))); ew.assign(fd); col.assign(vec3(0.05, 0.03, 0.02)); a.assign(fd.mul(0.3));
    }).ElseIf(ent(ty, 11.5, 12.5), () => { /* anel de poeira deitado no chão */
      const rr = r.add(n1.sub(0.5).mul(0.28)).toVar();
      col.assign(vCol.mul(U.uAmbC.add(U.uSunC.mul(clamp(U.uSunDir.y.mul(0.6).add(0.4), 0, 1)))).mul(n1.mul(0.4).add(0.8)));
      a.assign(smoothstep(k.mul(0.4).add(0.25), k.mul(0.12).add(0.72), rr).mul(float(1).sub(smoothstep(0.8, 0.99, rr))).mul(float(1).sub(smoothstep(0.9, 1, r))).mul(n1.mul(0.7).add(0.45)).mul(smoothstep(0, 0.06, k)).mul(float(1).sub(smoothstep(0.3, 1, k))));
    }).ElseIf(ent(ty, 12.5, 13.5), () => { /* gota de seiva ou ácido: esticada, com brilho molhado */
      const hp = c.sub(vec2(-0.1, 0.12)).toVar(); col.assign(vCol.mul(float(1).sub(r).mul(0.45).add(0.55)).add(vec3(1.2).mul(exp(dot(hp, hp).mul(-90))))); a.assign(float(1).sub(smoothstep(0.35, 0.8, r)).mul(float(1).sub(smoothstep(0.75, 1, k))));
    }).ElseIf(ty.greaterThan(13.5), () => { /* bola de fogo que vira fumaça: emite enquanto queima; ao esfriar vira fumaça iluminada com brasa por baixo */
      const fz = clamp(fract(abs(vXx)), 0.05, 0.95).toVar(), kf = clamp(k.div(fz), 0, 1).toVar(), ki = smoothstep(0, 0.015, k).toVar();
      const dens = float(1).sub(smoothstep(kf.mul(0.1).add(0.28), 0.95, r.add(n1.sub(0.5).mul(k.mul(0.4).add(0.5))))).mul(float(1).sub(smoothstep(0.85, 1, r))).toVar();
      Tq.assign(float(1.2).sub(kf.mul(1.05)).mul(float(1.05).sub(r.mul(0.6))).add(n2.sub(0.5).mul(0.6)).sub(0.1)); ew.assign(dens.mul(float(1).sub(smoothstep(0.75, 1, kf))).mul(smoothstep(-0.2, 0.3, n2.sub(kf.mul(0.35)))).mul(ki));
      col.assign(vCol.mul(Lz).mul(n1.mul(0.5).add(0.75)).mul(smoothstep(fz, 1, k).mul(1.1).add(1)).add(vec3(0.62, 0.16, 0.025).mul(float(1).sub(kf.mul(0.5))).mul(float(1).sub(smoothstep(0, 1.8, k.div(fz)))).mul(clamp(float(0.7).sub(c.y.mul(1.3)), 0, 1))));
      a.assign(dens.mul(mix(0.22, 0.92, smoothstep(0.15, 0.9, kf))).mul(float(1).sub(smoothstep(0.5, 1, k))).mul(n1.mul(0.4).add(0.6)).mul(ki));
    }).Else(() => { a.assign(exp(r.mul(r).mul(-4)).mul(float(1).sub(smoothstep(0.7, 1, r))).mul(float(1).sub(k))); });
    If(ew.greaterThan(0), () => { em.assign(heat(Tq).mul(ew).mul(select(ent(ty, 8.5, 9.5), vCol, vec3(1)))); });
    a.mulAssign(vA); em.mulAssign(vA); If(a.lessThan(0.003).and(em.r.add(em.g).add(em.b).lessThan(0.003)), () => { Discard(); });
    const saida = vec4(col.mul(a).add(em), a).toVar(); /* pré-multiplicado: emissão soma, fumaça cobre */
    If(U.uSemPos.greaterThan(0.5), () => { saida.assign(vec4(inv(saida.rgb).div(U.uExpo), float(1).sub(pow(float(1).sub(clamp(a, 0, 1)), U.uGama)))); }); /* sem pós: a imagem do clássico; 5.0b (junção): ÷ exposição (o Modo Foto muda) */
    return saida;
  })();
  return ARD.m5 && ARD.m5.registrar ? ARD.m5.registrar(aditivo ? 'fx-aditivo' : 'fx-translucido', m) : m;
}
/* 5.0b: cone aditivo dos faróis (recuo do render3d quando o mapa de clarões falta) em TSL; mesmos uniforms do beamMat2 (m.uniforms.uK) */
function m5Farol() {
  const T = window.THREE_M5, L = window.TSL; const { uniform, uv, float, vec3, vec4, abs, smoothstep } = L; const uK = uniform(0);
  const m = new T.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, blending: T.CustomBlending, blendEquation: T.AddEquation, blendSrc: T.SrcAlphaFactor, blendDst: T.OneFactor }); m.lights = false; m.fog = false;
  const vu = uv(), along = vu.y, w = abs(vu.x.sub(0.5)).mul(2); const cone = float(1).sub(smoothstep(along.mul(0.75).add(0.25), along.mul(0.8).add(0.3), w)); const a = cone.mul(float(1).sub(along)).mul(smoothstep(0, 0.1, along)).mul(uK);
  m.colorNode = vec4(vec3(1, 0.86, 0.6).mul(a), a); m.uniforms = { uK };
  if (ARD.m5 && ARD.m5.instMat) ARD.m5.instMat(m); /* 5.0b: regra de carga 2 — a matriz de instância vem dos atributos do ARD.m5.Inst (uma montagem por material, não por objeto) */
  return ARD.m5 && ARD.m5.registrar ? ARD.m5.registrar('farois', m) : m;
}
/* 5.0b: o cone dos faróis está portado (o render3d põe os faróis na cena do Motor 5); o core.js guarda as chaves já ligadas */
ARD.m5 = ARD.m5 || {}; ARD.m5.porte = Object.assign(ARD.m5.porte || {}, { faroisGlsl: true });

function create(THREE, scene, opts) {
  opts = opts || {}; const CAP = opts.cap || 4096;
  const M5 = m5Ativo(); /* 5.0b: Motor 5 — material TSL, mesma CPU */
  const ARMZ = M5 && !!opts.compute && !!(window.THREE_M5 && window.THREE_M5.StorageInstancedBufferAttribute); /* 5.0b: caminho por compute preparado para a 5.0d (desligado no jogo): os 5 atributos viram StorageInstancedBufferAttribute */
  const uniforms = M5 ? m5Uniforms(THREE) : { uTime: { value: 0 }, uCamR: { value: new THREE.Vector3(1, 0, 0) }, uCamU: { value: new THREE.Vector3(0, 1, 0) }, uCamF: { value: new THREE.Vector3(0, 0, 1) },
    uSunDir: { value: new THREE.Vector3(-0.47, 0.64, 0.6).normalize() }, uSunC: { value: new THREE.Color(0.85, 0.69, 0.47) }, uAmbC: { value: new THREE.Color(0.26, 0.37, 0.51) } };
  const quad = new THREE.PlaneGeometry(1, 1);
  const vs = `
attribute vec4 iA; attribute vec4 iB; attribute vec4 iC; attribute vec4 iD; attribute vec4 iE;
uniform float uTime; uniform vec3 uCamR; uniform vec3 uCamU;
varying vec2 vUv; varying float vAge; varying vec3 vCol; varying float vType; varying float vSeed; varying float vA; varying float vX; varying float vT; varying float vF;
void main() {
  float t = uTime - iA.w; float life = max(iB.w, 0.001); float age = t / life; float ty = iC.w;
  vType = ty; vSeed = iE.w; vX = iC.z; vT = t; vF = 1.0; vUv = position.xy + 0.5; vCol = iE.xyz; vA = iD.w; vAge = age;
  if (age < 0.0 || age > 1.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); vAge = 0.0; return; }
  float k = 0.0; float tm = t;
  if (ty < 0.5 || (ty > 1.5 && ty < 2.5) || (ty > 3.5 && ty < 4.5) || (ty > 12.5 && ty < 13.5)) k = max(iC.z, 0.0);
  else if (ty > 2.5 && ty < 3.5) k = floor(abs(iC.z)) * 0.1;
  else if (ty > 13.5) k = mod(floor(abs(iC.z)), 100.0) * 0.1;
  else if (ty > 9.5 && ty < 10.5) k = 1.3;
  else if (ty > 4.5 && ty < 5.5 && iD.x > 0.0) { float h = mod(iC.z, 1000.0); if (h > 0.0) { float tl = (iB.y + sqrt(iB.y * iB.y + 2.0 * iD.x * h)) / iD.x; tm = min(t, tl); } } /* destroço pousa no chão e para */
  float f = k > 0.0005 ? (1.0 - exp(-k * tm)) / k : tm;
  vec3 p = iA.xyz + iB.xyz * f + vec3(0.0, -iD.x * 0.5 * tm * tm, 0.0);
  float e = 1.0 - pow(1.0 - age, iD.y); float size = mix(iC.x, iC.y, e);
  if (ty > 9.5 && ty < 10.5) { float sw = iC.z * min(1.0, t * 1.5); p += vec3(sin(t * 2.7 + iE.w * 40.0), 0.0, cos(t * 2.1 + iE.w * 23.0)) * sw; } /* brasa balança no ar quente */
  if ((ty > 2.5 && ty < 3.5 && iC.z >= 0.0) || (ty > 3.5 && ty < 4.5)) p.y = max(p.y, iA.y + size * 0.42); /* fumaça e poeira do chão não atravessam o chão de onde nasceram */
  if (ty > 13.5) p.y = max(p.y, iA.y + size * 0.3);
  float pull = 0.0, pa = 0.0; /* clarão, casca e fogo vêm para a frente (mesmo tamanho na tela): o chão e a carcaça não cortam o disco com uma reta; pa = puxão extra do FX.fire */
  if ((ty > 0.5 && ty < 1.5) || (ty > 10.5 && ty < 11.5)) pull = 0.55; else if (ty > 8.5 && ty < 9.5) { pull = 1.0; pa = floor(iC.z); } else if (ty > 13.5) { pull = 0.3; pa = floor(floor(abs(iC.z)) / 100.0); } else if (ty > 6.5 && ty < 7.5) pa = max(iC.z, 0.0);
  if (pull > 0.0 || pa > 0.0) { vec3 tc = cameraPosition - p; float dc = length(tc); float dd = min(size * pull + pa, dc * 0.6); p += tc / dc * dd; size *= (dc - dd) / dc; }
  vec2 q = position.xy; vec3 off;
  if ((ty > 5.5 && ty < 6.5) || (ty > 11.5 && ty < 12.5)) off = vec3(q.x, 0.0, -q.y) * size;
  else if (ty > 7.5 && ty < 8.5) off = (uCamR * q.x + vec3(0.0, 1.0, 0.0) * q.y) * size;
  else if (ty > 8.5 && ty < 9.5) { float asp = fract(iC.z) > 0.0 ? fract(iC.z) * 10.0 : 2.0; off = (uCamR * q.x + uCamU * (q.y + 0.5) * asp) * size; } /* língua: a base fica no ponto */
  else if ((ty > 1.5 && ty < 2.5) || (ty > 12.5 && ty < 13.5)) { vec3 vel = iB.xyz * exp(-k * t) + vec3(0.0, -iD.x * t, 0.0); vec4 v4 = modelViewMatrix * vec4(vel, 0.0); vec2 d = normalize(v4.xy + vec2(0.0001)); float L = 1.0 + length(v4.xy) * (ty > 12.5 ? 0.012 : 0.025); /* gota estica menos que faísca */ q = vec2(q.x * d.x * L - q.y * d.y, q.x * d.y * L + q.y * d.x); off = (uCamR * q.x + uCamU * q.y) * size; }
  else { float ang = iD.z * tm + iE.w * 6.2831; float c = cos(ang), s = sin(ang);
    if (ty > 4.5 && ty < 5.5) { float fl = cos(iD.z * 0.7 * tm + iE.w * 9.0); vF = fl; q.x *= max(0.2, abs(fl)); } /* destroço capota: largura pelo cosseno do giro */
    q = vec2(c * q.x - s * q.y, s * q.x + c * q.y);
    if (ty > 3.5 && ty < 4.5) q.y *= 0.7; /* poeira rasteira mais larga que alta */
    off = (uCamR * q.x + uCamU * q.y) * size; }
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p + off, 1.0);
}`;
  const fs = `
uniform vec3 uCamR; uniform vec3 uCamU; uniform vec3 uCamF; uniform vec3 uSunDir; uniform vec3 uSunC; uniform vec3 uAmbC;
varying vec2 vUv; varying float vAge; varying vec3 vCol; varying float vType; varying float vSeed; varying float vA; varying float vX; varying float vT; varying float vF;
float hh(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); } /* hash sem seno */
float nn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hh(i), hh(i + vec2(1.0, 0.0)), f.x), mix(hh(i + vec2(0.0, 1.0)), hh(i + vec2(1.0, 1.0)), f.x), f.y); }
float fbm(vec2 p) { return nn(p) * 0.55 + nn(p * 2.1 + 3.7) * 0.3 + nn(p * 4.3 + 7.1) * 0.15; }
float fb2(vec2 p) { return nn(p) * 0.64 + nn(p * 2.3 + 3.7) * 0.36; } /* duas oitavas: fumaça e poeira (a terceira não aparece nelas) */
vec3 heat(float T) { T = clamp(T, 0.0, 1.0); float T2 = T * T; return vec3(3.1 * T * (0.75 + 0.25 * T), 2.65 * T2 * (0.2 + 0.8 * T), 1.9 * T2 * T2 * T); } /* corpo negro barato: vermelho, laranja, amarelo, branco (HDR para o bloom) */
vec3 luz(vec3 n) { float w = clamp(dot(n, uSunDir) * 0.6 + 0.4, 0.0, 1.0); vec3 am = mix(vec3(dot(uAmbC, vec3(0.3333))), uAmbC, 0.5); return am + uSunC * w * w; } /* céu meio dessaturado: sombra fria sem ficar azul */
/* 4.3g: cada lote compila só os tipos dele (PREMULTIPLIED_ALPHA só existe no translúcido): GPU fraca e SwiftShader pagam a cadeia inteira
   de ramos por pixel. Um ruído, uma luz e uma rampa de calor por pixel; ramos só com contas baratas, sem laço nem trigonometria. */
void main() {
  vec2 c = vUv - 0.5; float r = length(c) * 2.0; float a = 0.0; vec3 col = vCol; vec3 em = vec3(0.0); float k = vAge; float ty = vType;
#ifdef PREMULTIPLIED_ALPHA
  /* translúcido: 3 fumaça, 4 poeira, 5 destroço, 9 língua, 12 anel de poeira, 13 gota, 14 fogo que vira fumaça (outro tipo aqui: bolha macia) */
  if (((ty > 2.5 && ty < 4.5) || ty > 13.5) && r > 1.0) discard;
  float n1 = 0.5, n2 = 0.5;
  if ((ty > 2.5 && ty < 4.5) || (ty > 8.5 && ty < 9.5) || (ty > 11.5 && ty < 12.5) || ty > 13.5) { vec2 s1 = vec2(2.6), d1 = vec2(0.04, -0.1), s2 = vec2(7.0), d2 = vec2(0.0, -0.25); float o1 = 11.0, o2 = 5.0;
    if (ty > 3.5 && ty < 4.5) { s1 = vec2(3.0); d1 = vec2(0.1, 0.0); o1 = 7.0; }
    else if (ty > 8.5 && ty < 9.5) { s1 = vec2(2.4, 1.5); d1 = vec2(0.0, -2.4); o1 = 7.0; s2 = vec2(5.2, 3.0); d2 = vec2(0.0, -4.2); }
    else if (ty > 11.5 && ty < 12.5) { s1 = vec2(6.0); d1 = vec2(0.0, -0.4); o1 = 9.0; }
    else if (ty > 13.5) { s1 = vec2(2.8); d1 = vec2(0.0, -0.5); o1 = 31.0; s2 = vec2(5.6); d2 = vec2(0.35, -1.1); o2 = 17.0; }
    vec2 u1 = c * s1 + vSeed * o1 + vT * d1; n1 = ty > 8.5 && (ty < 9.5 || ty > 13.5) ? fbm(u1) : fb2(u1); n2 = nn(c * s2 + vSeed * o2 + vT * d2); }
  float z = sqrt(max(0.0, 1.0 - r * r)); float T = 0.0, ew = 0.0; vec3 L = vec3(1.0);
  if ((ty > 2.5 && ty < 4.5) || ty > 13.5) { float pw = ty > 3.5 && ty < 4.5 ? 0.0 : 1.0; /* volume com ruído (a poeira é lisa) */
    L = luz(normalize(uCamR * (c.x * 2.0 + (n1 - 0.5) * 1.2 * pw) + uCamU * (c.y * 2.0 + (n2 - 0.5) * 0.8 * pw + 0.3 - 0.3 * pw) + uCamF * (z + 0.3))); }
  if (ty < 3.5 && ty > 2.5) { /* fumaça: lado do sol claro, lado de trás frio; acesa por dentro e por baixo pelo fogo no começo; clareia ao se espalhar */
    float dens = (1.0 - smoothstep(0.25, 0.95, r + (n1 - 0.5) * 0.8 + (n2 - 0.5) * 0.18)) * (1.0 - smoothstep(0.82, 1.0, r));
    float gl = fract(abs(vX)) * (1.0 - smoothstep(0.0, 0.45, k));
    col = vCol * L * (0.8 + 0.4 * n1) * (1.0 + 0.9 * smoothstep(0.1, 0.9, k)) + vec3(1.25, 0.36, 0.05) * gl * gl * clamp(0.35 - c.y * 1.8, 0.0, 1.0) * (0.4 + 0.6 * z) * 0.55;
    a = dens * smoothstep(0.0, 0.08, k) * (1.0 - smoothstep(0.45, 1.0, k)) * (0.55 + 0.45 * n1);
  } else if (ty < 4.5 && ty > 3.5) { /* poeira: mesma luz, mais rala */
    col = vCol * L * (0.85 + 0.3 * n1);
    a = (1.0 - smoothstep(0.2, 0.95, r + (n1 - 0.5) * 0.6)) * (1.0 - smoothstep(0.8, 1.0, r)) * smoothstep(0.0, 0.06, k) * (1.0 - smoothstep(0.35, 1.0, k)) * 0.85;
  } else if (ty < 5.5 && ty > 4.5) { /* destroço: lasca de 4 cortes sorteados; metal com borda em brasa, cristal que cintila, carne molhada, torrão de terra */
    vec2 p = c * 2.0; float h1 = fract(vSeed * 13.7), h2 = fract(vSeed * 29.3), h3 = fract(vSeed * 47.1), h4 = fract(vSeed * 71.9);
    float d = max(max(p.y - 0.45 - 0.45 * h1, dot(p, vec2(0.866, -0.5)) - 0.45 - 0.45 * h2), max(dot(p, vec2(-0.866, -0.5)) - 0.45 - 0.45 * h3, dot(p, vec2(0.3 + 0.6 * h4, 0.75)) - 0.55)); d = max(d, r - 0.95);
    float sh = 1.0 - smoothstep(-0.08, 0.02, d); float mt = floor(vX / 1000.0); float fc = max(0.0, vF); float g1 = 1.0 - abs(vF); g1 *= g1; g1 *= g1; float f2 = fc * fc; f2 *= f2;
    col = mt > 0.5 && mt < 1.5 ? vCol * (0.55 + 0.55 * fc) + vec3(2.2, 1.9, 2.7) * g1 * g1 + vCol * 0.7 * smoothstep(-0.3, 0.0, d)
        : mt > 1.5 && mt < 2.5 ? vCol * (0.45 + 0.75 * fc) + vec3(0.56, 0.38, 0.32) * f2 * f2 * fc * fc : vCol * (uAmbC * 0.9 + uSunC * (0.25 + 0.75 * fc));
    a = sh * (1.0 - smoothstep(0.8, 1.0, k)); T = 0.62 - k * 1.2; ew = mt < 0.5 ? (1.0 - smoothstep(0.0, 0.3, k)) * (0.35 + 0.65 * smoothstep(-0.35, 0.0, d)) * 0.8 * a : 0.0; /* metal em brasa que esfria */
  } else if (ty < 9.5 && ty > 8.5) { /* língua de chama: larga e quente na base, fina e vermelha na ponta, rasgada pelo ruído que sobe; emite e escurece um pouco o fundo */
    float x = c.x * 2.0; float y = vUv.y;
    float xx = (x + (n1 - 0.5) * (0.4 + y) + (n2 - 0.5) * 0.3) / max(0.06, mix(0.95, 0.18, y * (0.35 + 0.65 * y)) * (0.75 + 0.5 * n1));
    float fd = (1.0 - smoothstep(0.4, 1.0, abs(xx))) * smoothstep(0.0, 0.16, y) * (1.0 - smoothstep(0.5, 0.98, y + (n2 - 0.5) * 0.45)) * (1.0 - smoothstep(0.8, 1.0, abs(x))) * (1.0 - smoothstep(0.85, 1.0, y)) * smoothstep(0.0, 0.08, k) * (1.0 - smoothstep(0.55, 1.0, k));
    T = (1.15 - 0.9 * y) * (1.0 - 0.5 * abs(xx)) - 0.4 * k + (n2 - 0.5) * 0.35; ew = fd; col = vec3(0.05, 0.03, 0.02); a = fd * 0.3;
  } else if (ty < 12.5 && ty > 11.5) { /* anel de poeira deitado no chão */
    float rr = r + (n1 - 0.5) * 0.28;
    col = vCol * (uAmbC + uSunC * clamp(uSunDir.y * 0.6 + 0.4, 0.0, 1.0)) * (0.8 + 0.4 * n1);
    a = smoothstep(0.25 + 0.4 * k, 0.72 + 0.12 * k, rr) * (1.0 - smoothstep(0.8, 0.99, rr)) * (1.0 - smoothstep(0.9, 1.0, r)) * (0.45 + 0.7 * n1) * smoothstep(0.0, 0.06, k) * (1.0 - smoothstep(0.3, 1.0, k));
  } else if (ty < 13.5 && ty > 12.5) { /* gota de seiva ou ácido: esticada, com brilho molhado */
    vec2 hp = c - vec2(-0.1, 0.12); col = vCol * (0.55 + 0.45 * (1.0 - r)) + vec3(1.2) * exp(-dot(hp, hp) * 90.0); a = (1.0 - smoothstep(0.35, 0.8, r)) * (1.0 - smoothstep(0.75, 1.0, k));
  } else if (ty > 13.5) { /* bola de fogo que vira fumaça: emite HDR enquanto queima e cobre pouco; ao esfriar vira fumaça iluminada que cobre muito, com brasa por baixo */
    float fz = clamp(fract(abs(vX)), 0.05, 0.95); float kf = clamp(k / fz, 0.0, 1.0); float ki = smoothstep(0.0, 0.015, k);
    float dens = (1.0 - smoothstep(0.28 + 0.1 * kf, 0.95, r + (n1 - 0.5) * (0.5 + 0.4 * k))) * (1.0 - smoothstep(0.85, 1.0, r));
    T = (1.2 - 1.05 * kf) * (1.05 - 0.6 * r) + (n2 - 0.5) * 0.6 - 0.1; ew = dens * (1.0 - smoothstep(0.75, 1.0, kf)) * smoothstep(-0.2, 0.3, n2 - kf * 0.35) * ki;
    col = vCol * L * (0.75 + 0.5 * n1) * (1.0 + 1.1 * smoothstep(fz, 1.0, k)) + vec3(0.62, 0.16, 0.025) * (1.0 - 0.5 * kf) * (1.0 - smoothstep(0.0, 1.8, k / fz)) * clamp(0.7 - c.y * 1.3, 0.0, 1.0);
    a = dens * mix(0.22, 0.92, smoothstep(0.15, 0.9, kf)) * (1.0 - smoothstep(0.5, 1.0, k)) * (0.6 + 0.4 * n1) * ki;
  } else { a = exp(-r * r * 4.0) * (1.0 - smoothstep(0.7, 1.0, r)) * (1.0 - k); }
  if (ew > 0.0) em = heat(T) * ew * (ty > 8.5 && ty < 9.5 ? vCol : vec3(1.0));
  a *= vA; em *= vA; if (a < 0.003 && em.r + em.g + em.b < 0.003) discard;
  gl_FragColor = vec4(col * a + em, a); /* pré-multiplicado: emissão soma, fumaça cobre */
#else
  /* aditivo: 0 bola de fogo, 1 clarão, 2 faísca, 6 onda no chão, 7 brilho, 8 anel vertical, 10 brasa, 11 casca de choque (outro tipo aqui: bolha macia) */
  if (ty < 0.5) { /* bola de fogo aditiva: esfria do branco ao vermelho, a borda se rasga e abre buracos com a idade */
    if (r > 1.0) discard;
    float n1 = fbm(c * 3.2 + vSeed * 31.0 + vec2(0.0, -vT * 1.1)), n2 = nn(c * 6.5 + vSeed * 17.0 + vec2(vT * 0.6, -vT * 1.8)), z = sqrt(max(0.0, 1.0 - r * r));
    col = heat((1.1 - 1.15 * k) * (0.6 + 0.5 * z) + (n2 - 0.5) * 0.6) * vCol;
    a = (1.0 - smoothstep(0.45 - 0.15 * k, 0.98, r + (n1 - 0.5) * (0.5 + 0.6 * k))) * (0.5 + 0.5 * z) * (1.0 - smoothstep(0.85, 1.0, r)) * smoothstep(0.0, 0.035, k + 0.01) * (1.0 - smoothstep(0.62, 1.0, k)) * smoothstep(-0.15, 0.25, n2 - k * 0.45);
  } else if (ty < 1.5) { /* clarão: núcleo, halo e estrela de raios (extra) */
    float g = exp(-r * r * 6.0); vec2 q = vec2(c.x + c.y, c.x - c.y) * 0.7071;
    float ray = vX > 0.0 ? (exp(-abs(c.x * c.y) * 400.0) + 0.6 * exp(-abs(q.x * q.y) * 500.0)) * exp(-r * 2.4) * vX : 0.0;
    a = (g + exp(-r * 3.0) * 0.4 + ray) * (1.0 - k) * (1.0 - k) * (1.0 - smoothstep(0.8, 1.0, r)); col = vCol * (1.0 + 2.0 * g);
  } else if (ty < 2.5) { /* faísca: núcleo branco que esfria */
    float g = exp(-r * r * 9.0); a = g * (1.0 - k * k); col = mix(vCol * 2.0 + vec3(0.6) * g, vCol * vec3(1.0, 0.45, 0.25), smoothstep(0.2, 1.0, k));
  } else if (ty < 6.5 && ty > 5.5) { /* onda de luz no chão: frente fina e quebrada; extra > 0 = só o aro */
    float nz = nn(c * 9.0 + vSeed * 20.0 + vec2(0.0, k * 2.0)); float ed = 0.9 + (nz - 0.5) * 0.06;
    float ring = smoothstep(ed - 0.22, ed, r) * (1.0 - smoothstep(ed, ed + 0.05, r)); float inner = vX > 0.0 ? 0.0 : (1.0 - smoothstep(0.0, ed, r)) * 0.2 * (1.0 - k);
    a = (ring * (0.55 + 0.7 * nz) + inner) * (1.0 - k) * (1.0 - k); col = vCol * 1.6;
  } else if (ty < 7.5 && ty > 6.5) { float g = exp(-r * r * 3.0) * (1.0 - smoothstep(0.6, 1.0, r)); a = g * (1.0 - k); col = vCol * 1.4; }
  else if (ty < 8.5 && ty > 7.5) { float ring = smoothstep(0.7, 0.88, r) * (1.0 - smoothstep(0.9, 1.0, r)); a = ring * (1.0 - k); col = vCol * 1.8; }
  else if (ty < 10.5 && ty > 9.5) { /* brasa: ponto que pisca e esfria */
    float g = exp(-r * r * 12.0); a = g * (0.6 + 0.4 * sin(vT * 21.0 + vSeed * 60.0)) * (1.0 - smoothstep(0.65, 1.0, k)); col = mix(vCol * 1.6, vCol * vec3(0.7, 0.3, 0.15), smoothstep(0.1, 0.9, k));
  } else if (ty < 11.5 && ty > 10.5) { /* casca de choque no ar: aro fino que corre para fora */
    a = (smoothstep(0.7, 0.95, r) * (1.0 - smoothstep(0.95, 1.0, r)) + (1.0 - smoothstep(0.2, 0.95, r)) * 0.1) * (1.0 - k) * (1.0 - k); col = vCol;
  } else { float g = exp(-r * r * 4.0) * (1.0 - smoothstep(0.7, 1.0, r)); a = g * (1.0 - k); col = vCol * 1.4; }
  a *= vA; if (a < 0.003) discard;
  gl_FragColor = vec4(col, a);
#endif
}`;
  function batch(blending) {
    const geo = new THREE.InstancedBufferGeometry(); geo.index = quad.index; geo.setAttribute('position', quad.attributes.position); geo.instanceCount = CAP;
    const at = {}; for (const k of ['iA', 'iB', 'iC', 'iD', 'iE']) { const a = ARMZ ? new window.THREE_M5.StorageInstancedBufferAttribute(new Float32Array(CAP * 4), 4) : new THREE.InstancedBufferAttribute(new Float32Array(CAP * 4), 4); if (!M5) a.setUsage(THREE.DynamicDrawUsage); /* 5.0b: StaticDrawUsage no Motor 5 (só o trecho escrito sobe) */ geo.setAttribute(k, a); at[k] = a; }
    for (let i = 0; i < CAP; i++) at.iA.array[i * 4 + 3] = -1e6; /* nascidas "há muito tempo": invisíveis */
    const mat = M5 ? m5Particulas(uniforms, blending === THREE.AdditiveBlending) /* 5.0b: TSL */ : new THREE.ShaderMaterial({ uniforms, vertexShader: vs, fragmentShader: fs, transparent: true, depthWrite: false, blending, fog: false, premultipliedAlpha: blending !== THREE.AdditiveBlending }); /* 4.3g: translúcido pré-multiplicado */
    const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.renderOrder = blending === THREE.AdditiveBlending ? 12 : 10; scene.add(mesh);
    if (blending === THREE.AdditiveBlending) return { geo, at, mesh, fim: -1e9, r: [{ a: 0, b: CAP, i: 0, s: 0, n: 0 }] };
    const LG = Math.floor(CAP * 0.75); /* 4.3g: o translúcido tem dois anéis — o último quarto guarda só o que vive 4 s ou mais (fumaça que fica), para o fogo contínuo não o atropelar */
    return { geo, at, mesh, fim: -1e9, r: [{ a: 0, b: LG, i: 0, s: 0, n: 0 }, { a: LG, b: CAP, i: LG, s: LG, n: 0 }] };
  }
  const add = batch(THREE.AdditiveBlending), alp = batch(THREE.NormalBlending);
  const FX = { time: 0, dt: 0, mult: 1, add, alp };
  /* 5.0b: o que a 5.0d precisa para simular na GPU sem mudar o vértice analítico (caminho por compute, no relatório da 5.0b): os uniforms,
     os lotes e, com opts.compute, os nós storage dos 5 atributos de cada lote (um compute shader lê e reescreve o nascimento: posição,
     instante, velocidade e vida; o quique de um destroço vira um nascimento novo). renderer.compute(nó) uma vez por quadro, antes do desenho. */
  if (M5) { const st = window.TSL.storage, nos = b => { const o = {}; for (const k in b.at) o[k] = st(b.at[k], 'vec4', CAP); return o; }; FX.m5 = { cap: CAP, uniforms, lotes: { add, alp }, armazenamento: ARMZ ? { add: nos(add), alp: nos(alp) } : null }; }
  // emite uma partícula: p=[x,y,z] (mundo three), v=[vx,vy,vz], life, s0, s1, type, col=[r,g,b], g=gravidade, ease, spin, alpha, delay, x=extra do tipo (4.3g)
  FX.emit = function (b, p, v, life, s0, s1, type, col, g, ease, spin, alpha, delay, x) {
    const rg = life >= 4 && b.r.length > 1 ? b.r[1] : b.r[0], i = rg.i; rg.i = i + 1 >= rg.b ? rg.a : i + 1; if (rg.n === 0) rg.s = i; rg.n++; const o = i * 4; const A = b.at;
    A.iA.array[o] = p[0]; A.iA.array[o + 1] = p[1]; A.iA.array[o + 2] = p[2]; A.iA.array[o + 3] = FX.time + (delay || 0);
    A.iB.array[o] = v[0]; A.iB.array[o + 1] = v[1]; A.iB.array[o + 2] = v[2]; A.iB.array[o + 3] = life;
    A.iC.array[o] = s0; A.iC.array[o + 1] = s1; A.iC.array[o + 2] = x || 0; A.iC.array[o + 3] = type;
    A.iD.array[o] = g || 0; A.iD.array[o + 1] = ease || 2; A.iD.array[o + 2] = spin || 0; A.iD.array[o + 3] = alpha == null ? 1 : alpha;
    A.iE.array[o] = col[0]; A.iE.array[o + 1] = col[1]; A.iE.array[o + 2] = col[2]; A.iE.array[o + 3] = Math.random();
    if (M5) { const fe = FX.time + (delay || 0) + life; if (fe > b.fim) b.fim = fe; } /* 5.0b: até quando o lote tem partícula viva */
  };
  /* 4.3g: luz da cena (sol, céu e ambiente) para a fumaça; procura as luzes uma vez e relê os valores a cada quadro (dia e noite, clima) */
  let LZ = null, lzN = 0; const _v = new THREE.Vector3();
  function luzes() {
    if (!LZ || (!LZ.sun && ++lzN % 120 === 0)) { LZ = { sun: null, hemi: null, amb: null }; for (const o of scene.children) { if (o.isDirectionalLight && !LZ.sun) LZ.sun = o; else if (o.isHemisphereLight && !LZ.hemi) LZ.hemi = o; else if (o.isAmbientLight && !LZ.amb) LZ.amb = o; } }
    const s = LZ.sun, U = uniforms; if (s) { _v.subVectors(s.position, s.target.position); if (_v.lengthSq() > 1e-6) U.uSunDir.value.copy(_v.normalize()); U.uSunC.value.copy(s.color).multiplyScalar(s.intensity * 0.53); }
    if (LZ.hemi || LZ.amb) { const c = U.uAmbC.value.setRGB(0, 0, 0); if (LZ.hemi) { const h = LZ.hemi; c.r += h.color.r * h.intensity * 1.36; c.g += h.color.g * h.intensity * 1.36; c.b += h.color.b * h.intensity * 1.36; } if (LZ.amb) { const m = LZ.amb; c.r += m.color.r * m.intensity * 0.5; c.g += m.color.g * m.intensity * 0.5; c.b += m.color.b * m.intensity * 0.5; } }
  }
  FX.update = function (time, camera) {
    const dt = time - FX.time; FX.dt = dt > 0 ? (dt <= 0.25 ? dt : 1 / 60) : 0; FX.time = time; uniforms.uTime.value = time; /* dt do quadro: o fogo contínuo emite por segundo, não por quadro */
    if (M5) { add.mesh.visible = time <= add.fim + 0.05; alp.mesh.visible = time <= alp.fim + 0.05; uniforms.uSemPos.value = opts.semPos && opts.semPos() ? 1 : 0; } /* 5.0b: lote sem partícula viva fica fora do desenho (no WebGPU cada objeto desenhado custa CPU); o pipeline já nasceu na carga */
    const e = camera.matrixWorld.elements; uniforms.uCamR.value.set(e[0], e[1], e[2]).normalize(); uniforms.uCamU.value.set(e[4], e[5], e[6]).normalize(); uniforms.uCamF.value.set(e[8], e[9], e[10]).normalize();
    luzes();
    for (const b of [add, alp]) { let W = 0; for (const rg of b.r) W += rg.n; if (!W) continue; /* sobe só o trecho escrito neste quadro em cada anel (dois trechos quando o anel dá a volta); o three limpa os trechos depois de subir */
      for (const k in b.at) { const a = b.at[k]; if (!a.addUpdateRange) { a.needsUpdate = true; continue; }
        if (a.updateRanges && a.updateRanges.length > 24 && !ARMZ) { a.clearUpdateRanges(); a.addUpdateRange(0, CAP * 4); } /* 5.0b: com compute, nunca o buffer inteiro (desfaria o que a GPU reescreveu) */
        else for (const rg of b.r) { if (!rg.n) continue; const sp = rg.b - rg.a; if (rg.n >= sp) a.addUpdateRange(rg.a * 4, sp * 4); else if (rg.s + rg.n <= rg.b) a.addUpdateRange(rg.s * 4, rg.n * 4); else { a.addUpdateRange(rg.s * 4, (rg.b - rg.s) * 4); a.addUpdateRange(rg.a * 4, (rg.s + rg.n - rg.b) * 4); } }
        a.needsUpdate = true; }
      for (const rg of b.r) rg.n = 0; }
  };

  // ---------- receitas ----------
  const R = Math.random, TAU = Math.PI * 2;
  const jit = (v, k) => v + (R() - 0.5) * 2 * k;
  const cnt = n => { const f = Math.floor(n); return f + (R() < n - f ? 1 : 0); }; /* quantidade fracionária: sorteia o resto */
  /* 4.3g: paleta por Raça. O render3d manda o tint da Raça (morte) e o combat3d a cor do impacto da arma (HDR): a paleta sai do matiz
     do tint (ou de o.race / o.raca, se vier), e a bola de fogo continua lendo como explosão em todas */
  const PAL = {
    fogo: { id: 0, fire: [1, 1, 1], flash: [2.4, 1.9, 1.3], halo: [1.6, 0.95, 0.5], spark: [2.0, 1.15, 0.45], ember: [1.9, 0.85, 0.3], ring: [1.5, 0.85, 0.42], smoke: [0.1, 0.092, 0.088], debris: [0.2, 0.19, 0.19] },
    teal: { id: 1, fire: [0.86, 1.0, 1.08], flash: [1.7, 2.4, 2.4], halo: [0.55, 1.5, 1.55], spark: [0.9, 2.1, 2.0], ember: [0.9, 1.8, 1.7], ring: [0.5, 1.5, 1.5], smoke: [0.095, 0.105, 0.115], debris: [0.2, 0.22, 0.24] },
    seiva: { id: 2, fire: [1.0, 1.1, 0.7], flash: [2.0, 2.4, 1.1], halo: [1.1, 1.5, 0.4], spark: [1.6, 2.0, 0.55], ember: [1.5, 1.8, 0.45], ring: [1.0, 1.5, 0.45], smoke: [0.11, 0.115, 0.085], debris: [0.22, 0.2, 0.08], gota: [0.62, 0.72, 0.14], gota2: [0.85, 0.55, 0.1], esporo: [0.7, 1.5, 0.45] },
    cristal: { id: 3, fire: [1.0, 0.88, 1.12], flash: [2.3, 2.0, 2.9], halo: [1.3, 0.85, 2.0], spark: [1.9, 1.6, 2.7], ember: [1.6, 1.2, 2.4], ring: [1.3, 0.9, 2.1], smoke: [0.12, 0.105, 0.135], debris: [1.0, 0.86, 1.5] },
    carne: { id: 4, fire: [1.08, 0.88, 0.8], flash: [2.5, 1.7, 1.1], halo: [1.7, 0.6, 0.35], spark: [2.0, 0.95, 0.4], ember: [1.9, 0.6, 0.25], ring: [1.5, 0.6, 0.35], smoke: [0.11, 0.085, 0.075], debris: [0.36, 0.07, 0.06], gota: [0.95, 1.7, 0.2], acido: [0.2, 0.22, 0.05] },
  };
  const RACA = { vehnar: 'fogo', erevane: 'teal', tessara: 'seiva', quorith: 'cristal', vorag: 'carne' };
  const TERRA = [0.27, 0.21, 0.15], POEIRA = [0.3, 0.26, 0.2];
  function paleta(t, race) {
    if (race && (RACA[race] || PAL[race])) return PAL[RACA[race] || race];
    if (!t) return PAL.fogo; const mx = Math.max(t[0], t[1], t[2], 1e-3), r = t[0] / mx, g = t[1] / mx, b = t[2] / mx, mn = Math.min(r, g, b);
    if (1 - mn < 0.12) return PAL.fogo; let h = r >= g && r >= b ? (g - b) / (1 - mn) : g >= b ? 2 + (b - r) / (1 - mn) : 4 + (r - g) / (1 - mn); h *= 60; if (h < 0) h += 360;
    return h < 15 || h >= 330 ? PAL.carne : h < 55 ? PAL.fogo : h < 140 ? PAL.seiva : h < 225 ? PAL.teal : PAL.cristal;
  }
  // explosão em camadas: clarão e casca de choque, bolas de fogo com arrasto que viram fumaça, núcleo aditivo, faíscas, destroços que pousam
  // (com rastro de fogo e fumaça nas médias e grandes), onda e anel de poeira no chão, poeira rasteira, fumaça que fica, brasas e a camada da Raça
  FX.explosion = function (x, y, z, size, o) {
    o = o || {}; const m = FX.mult; const dl = o.delay || 0; const t0 = FX.time; if (dl) FX.time = t0 + dl; try { explode(x, y, z, size, o, m); } finally { FX.time = t0; } };
  function explode(x, y, z, S, o, m) {
    const P = paleta(o.tint, o.race || o.raca), imp = !!o.impact, sec = !!o.delay && !o.wave; /* sec: explosão secundária (já houve a principal) */
    const q = Math.min(1, Math.max(0, (S - 5) / 30)), L = Math.min(1.9, Math.max(0.75, Math.sqrt(S / 10))), big = S >= 9, wave = !!o.wave || S >= 10;
    const g0 = o.ground != null ? o.ground : sec ? y - 1 - S * 0.5 : o.wave || imp ? y : y - 2, cy = y + S * 0.25; /* chão estimado: o render3d manda y = chão + 2 nas unidades, o chão nas construções e impactos */
    /* 1. clarão curto e forte: núcleo + halo (com raios nas grandes e no cristal) + casca de choque */
    FX.emit(add, [x, cy, z], [0, 0, 0], 0.06 + S * 0.0025, S * 1.4, S * 2.2, 1, P.flash, 0, 1.5, 0, 1);
    FX.emit(add, [x, cy, z], [0, 0, 0], 0.12 + S * 0.004, S * 2.2, S * 3.1, 1, P.halo, 0, 2, 0, 0.75, 0, big || P.id === 3 ? 0.55 : 0);
    if ((o.wave || S >= 20) && !sec) FX.emit(add, [x, cy, z], [0, 0, 0], 0.16 + S * 0.002, S * 0.7, S * 3.2, 11, P.ring, 0, 3, 0, 0.2);
    /* 2. bolas de fogo que viram fumaça (lote translúcido pré-multiplicado): núcleo grande e lento, borda menor e rápida; o arrasto
       abre rápido e segura; sobem, giram, esfriam do branco ao vermelho e escurecem em fumaça que cobre o chão claro */
    const nf = Math.max(2, cnt(((imp ? 2.5 : 3) + S * (imp ? 0.2 : 0.27)) * m)), sc = P.smoke;
    for (let i = 0; i < nf; i++) {
      const core = i < 2, a = R() * TAU, hz = core ? R() * 0.3 : 0.35 + R() * 0.65, up = core ? 0.3 + R() * 0.5 : 0.25 + R() * 0.9;
      const sp = S * (core ? 1.2 + R() * 1.2 : 2.4 + R() * 3.2), kd = 3.2 + R() * 2.2, v = [Math.cos(a) * hz * sp, up * sp, Math.sin(a) * hz * sp];
      const p0 = [x + jit(0, S * 0.12), y + S * 0.12, z + jit(0, S * 0.12)], life = (core ? 1.7 + R() * 0.6 : 1.3 + R() * 0.6) * L * (imp ? 0.75 : 1) * (1 + q * 0.4);
      const fz = (core ? 0.34 + R() * 0.08 : 0.28 + R() * 0.1) / (1 + q * 0.4), s0 = S * (core ? 0.5 + R() * 0.2 : 0.3 + R() * 0.2), s1 = S * (core ? 1.4 + R() * 0.35 : 0.95 + R() * 0.45);
      const gB = -S * (0.45 + R() * 0.45), d0 = R() * 0.05 * L, gg = 0.85 + R() * 0.3;
      FX.emit(alp, p0, v, life, s0, s1, 14, [sc[0] * gg, sc[1] * gg, sc[2] * gg], gB, 2.4, jit(0, 1.2), 1, d0, Math.round(kd * 10) + fz);
    }
    /* 3. núcleo aditivo: o ponto mais quente brilha por cima da fumaça e das faíscas */
    for (let i = S >= 9 ? 3 : 2; i > 0; i--) FX.emit(add, [x + jit(0, S * 0.1), y + S * 0.2, z + jit(0, S * 0.1)], [jit(0, S * 0.8), S * (0.6 + R() * 0.8), jit(0, S * 0.8)], (0.26 + R() * 0.16) * L, S * 0.45, S * (0.9 + R() * 0.3), 0, P.fire, -S * 0.5, 2.2, jit(0, 1.5), 0.85, R() * 0.03, 4);
    if (S >= 18 && !imp && !sec) for (let i = cnt((1.5 + q * 2) * m); i > 0; i--) { /* coluna: bolas que sobem alto e viram o tronco de fumaça */
      const life = (2.6 + R() * 1.2) * L, s1 = S * (1.3 + R() * 0.4), v = [jit(0, S * 0.3), S * (2.6 + R() * 1.2), jit(0, S * 0.3)], kd = 1.8 + R() * 0.6, gg = 0.85 + R() * 0.3;
      FX.emit(alp, [x, y + S * 0.3, z], v, life, S * 0.5, s1, 14, [sc[0] * gg, sc[1] * gg, sc[2] * gg], -S * 0.4, 2, jit(0, 0.8), 1, 0.03 + R() * 0.08, Math.round(kd * 10) + 0.26); }
    /* 4. faíscas */
    for (let i = cnt((6 + S * 0.55) * m); i > 0; i--) { const a = R() * TAU, sp = S * (3 + R() * 6) + 20, up = 0.3 + R() * 1.1;
      FX.emit(add, [x, cy, z], [Math.cos(a) * sp, up * sp, Math.sin(a) * sp], (0.35 + R() * 0.55) * Math.min(1.4, L), 0.5 + R() * 0.7 + S * 0.02, 0.25, 2, P.spark, 120 + S * 3, 1, 0, 1, R() * 0.04, 1.6); }
    /* 5. destroços: giram, caem e ficam no chão; nas médias e grandes alguns soltam fumaça e fogo no caminho */
    const nd = cnt(((imp ? 1.5 : 2) + S * (imp ? 0.12 : 0.2)) * m), nt = S >= 11 && !imp ? Math.round(1 + q * 2) : 0;
    for (let i = 0; i < nd; i++) {
      const a = R() * TAU, hs = S * (1.2 + R() * 2.6), vy = S * (1.8 + R() * 2.8) + 15, gD = 75 + S * 1.5, ds = (0.9 + R() * 1.3) * (1 + S * 0.035);
      const p0 = [x + jit(0, S * 0.15), y + S * 0.2, z + jit(0, S * 0.15)], drop = Math.max(0.5, p0[1] - g0 - ds * 0.35), v = [Math.cos(a) * hs, vy, Math.sin(a) * hs];
      const mt = imp ? 3 : P.id === 3 && R() < 0.6 ? 1 : P.id === 4 && R() < 0.75 ? 2 : 0, cd = mt === 3 ? TERRA : P.debris;
      FX.emit(alp, p0, v, 1.8 + R() * 1.6, ds, ds * 0.85, 5, cd, gD, 1, jit(0, 9), 1, R() * 0.03, drop + mt * 1000);
      if (i < nt) rastro(p0, v, gD, drop, ds, P, m);
    }
    /* 6. chão: onda de luz, anel de poeira e poeira que corre rente */
    if ((o.wave || S >= 14) && !sec) { if (o.wave) FX.emit(add, [x, g0 + 0.8, z], [0, 0, 0], 0.3 * L, S * 0.4, S * 3.4, 6, P.ring, 0, 2.6, 0, 0.4); FX.emit(alp, [x, g0 + 0.5, z], [0, 0, 0], 1.4 * L, S * 0.8, S * 3.2, 12, POEIRA, 0, 2.8, 0, 0.3, 0.03); }
    for (let i = cnt((big ? 3 + S * 0.15 : 2) * m * (sec ? 0.5 : 1)); i > 0; i--) { const a = R() * TAU, r0 = S * (0.15 + R() * 0.35), sp = S * (0.8 + R() * 3.4) + 6, gg = 0.85 + R() * 0.3;
      FX.emit(alp, [x + Math.cos(a) * r0, g0 + 1, z + Math.sin(a) * r0], [Math.cos(a) * sp, S * 0.15, Math.sin(a) * sp], (1.1 + R() * 0.9) * L, S * (0.35 + R() * 0.25), S * (1.0 + R() * 0.7), 4, [POEIRA[0] * gg, POEIRA[1] * gg, POEIRA[2] * gg], 0, 2, jit(0, 0.3), 0.36, R() * 0.08, 2.4); }
    if (imp) for (let i = cnt((1.5 + S * 0.08) * m); i > 0; i--) /* impacto: chafariz de terra que sobe e assenta */
      FX.emit(alp, [jit(x, S * 0.15), g0 + 1, jit(z, S * 0.15)], [jit(0, S * 0.5), S * (2.2 + R() * 1.6) + 10, jit(0, S * 0.5)], 1.2 + R() * 0.7, S * 0.35, S * (0.9 + R() * 0.4), 4, [TERRA[0] * 1.3, TERRA[1] * 1.3, TERRA[2] * 1.3], 0, 1.6, jit(0, 0.4), 0.7, R() * 0.04, 2.6);
    /* 7. fumaça que fica: sobe devagar, abre e demora */
    if (big && !imp) for (let i = cnt(((sec ? 0.5 : 1) + S * 0.06) * m); i > 0; i--) { const gg = 0.8 + R() * 0.4, sc = P.smoke;
      FX.emit(alp, [jit(x, S * 0.3), y + S * 0.5, jit(z, S * 0.3)], [jit(0, 3), S * (0.6 + R() * 0.5) + 6, jit(0, 3)], (5 + R() * 3) * (0.8 + q) * (o.wave ? 1.4 : 1), S * 0.7, S * (2.2 + R() * 0.8) * (o.wave ? 1.2 : 1), 3, [sc[0] * gg, sc[1] * gg, sc[2] * gg], -S * 0.04, 1.4, jit(0, 0.15), 0.6, 0.12 + R() * 0.3, 5.25); } /* nas construções a coluna fica mais (até ~18 s, no anel protegido) */
    /* 8. brasas */
    for (let i = cnt((big ? 3 + S * 0.18 : 1.5) * m); i > 0; i--) FX.emit(add, [jit(x, S * 0.3), cy, jit(z, S * 0.3)], [jit(0, S * 1.2), S * (1 + R() * 1.6) + 8, jit(0, S * 1.2)], 1.1 + R() * 1.5, 0.5 + R() * 0.4 + S * 0.012, 0.3, 10, P.ember, -3, 1, 0, 1, 0.08 + R() * 0.3, 2 + S * 0.08);
    /* 9. a camada da Raça */
    raca(P, x, y, z, S, cy, g0, m, imp, big);
    /* 10. estouros atrasados nas unidades pesadas (munição cozinhando) */
    if (S >= 15 && !o.wave && !sec && !imp) for (let j = S >= 25 ? 2 : 1; j > 0; j--) { const a = R() * TAU, d = S * (0.2 + R() * 0.3), px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d, d0 = 0.18 + R() * 0.35, s = S * 0.45;
      FX.emit(add, [px, cy, pz], [0, 0, 0], 0.08, s * 1.4, s * 2.4, 1, P.flash, 0, 1.5, 0, 0.9, d0);
      for (let i = 0; i < 3; i++) { const b = R() * TAU, sp = s * (2 + R() * 2); FX.emit(add, [px, cy, pz], [Math.cos(b) * sp, s * (1 + R() * 2), Math.sin(b) * sp], 0.45 + R() * 0.3, s * 0.4, s * 1.1, 0, P.fire, -s, 2.2, jit(0, 1.5), 1, d0 + R() * 0.03, 4); }
      for (let i = 0; i < 4; i++) { const b = R() * TAU, sp = 40 + R() * 60; FX.emit(add, [px, cy, pz], [Math.cos(b) * sp, 30 + R() * 50, Math.sin(b) * sp], 0.4 + R() * 0.4, 0.7, 0.25, 2, P.spark, 150, 1, 0, 1, d0, 1.6); } }
  }
  function rastro(p0, v, gD, drop, ds, P, m) { /* destroço em chamas: bolinhas de fogo que viram fumaça marcadas ao longo do arco (a CPU sabe o caminho) */
    const tl = (v[1] + Math.sqrt(v[1] * v[1] + 2 * gD * drop)) / gD; const n = Math.min(11, Math.floor(tl / 0.05)), sc = P.smoke;
    for (let i = 1; i <= n; i++) { if (R() > m) continue; const ti = i * 0.05, gg = 0.8 + R() * 0.4;
      FX.emit(alp, [p0[0] + v[0] * ti, p0[1] + v[1] * ti - gD * 0.5 * ti * ti, p0[2] + v[2] * ti], [jit(0, 1.5), 3 + R() * 3, jit(0, 1.5)], 0.9 + R() * 0.7, ds * 1.5 + 1, ds * (3.4 + R() * 1.5) + 2, 14, [sc[0] * gg, sc[1] * gg, sc[2] * gg], -2, 1.6, jit(0, 0.6), 0.7, ti, 4 + (i < 3 ? 0.3 - i * 0.07 : 0.06)); }
  }
  function raca(P, x, y, z, S, cy, g0, m, imp, big) {
    if (P.id === 1) { /* Erevane: plasma teal que se desfaz em centelhas */
      FX.emit(add, [x, cy, z], [0, 0, 0], 0.3 * Math.min(1.4, Math.sqrt(S / 10) + 0.3), S * 1.2, S * 2.4, 1, P.halo, 0, 2.5, 0, 0.8);
      if (!big) FX.emit(add, [x, cy, z], [0, 0, 0], 0.2, S * 0.5, S * 2.6, 11, P.ring, 0, 3, 0, 0.6);
      for (let i = cnt((3 + S * 0.2) * m); i > 0; i--) FX.emit(add, [jit(x, S * 0.4), cy, jit(z, S * 0.4)], [jit(0, S * 1.5), S * (0.6 + R()) + 6, jit(0, S * 1.5)], 0.9 + R() * 1.0, 0.6 + R() * 0.5 + S * 0.015, 0.25, 10, P.ember, -4, 1, 0, 1, R() * 0.15, 1.5 + S * 0.06);
    } else if (P.id === 2) { /* Tessara: seiva que espirra e esporos que flutuam */
      for (let i = cnt((4 + S * 0.35) * m); i > 0; i--) { const a = R() * TAU, sp = S * (1.5 + R() * 3) + 10; FX.emit(alp, [x, cy, z], [Math.cos(a) * sp, S * (1.5 + R() * 2.5) + 12, Math.sin(a) * sp], 0.6 + R() * 0.5, 0.8 + R() * 0.8 + S * 0.035, 0.6, 13, R() < 0.6 ? P.gota : P.gota2, 160 + S * 2, 1, 0, 1, R() * 0.05, 0.6); }
      for (let i = cnt((3 + S * 0.15) * m); i > 0; i--) FX.emit(add, [jit(x, S * 0.5), cy, jit(z, S * 0.5)], [jit(0, S * 0.6), S * (0.3 + R() * 0.5) + 3, jit(0, S * 0.6)], 1.6 + R() * 1.4, 0.8 + R() * 0.8 + S * 0.02, 1.4 + S * 0.03, 7, P.esporo, -1, 1.5, 0, 0.5, 0.1 + R() * 0.3);
    } else if (P.id === 3) { /* Quorith: estilhaços de cristal que cintilam e um anel harmônico */
      for (let i = cnt((3 + S * 0.25) * m); i > 0; i--) { const a = R() * TAU, hs = S * (2 + R() * 3) + 10, ds = 0.6 + R() * 0.8 + S * 0.03, p0 = [x, y + S * 0.25, z], vy = S * (1.5 + R() * 2.5) + 12, gD = 90 + S * 1.5;
        FX.emit(alp, p0, [Math.cos(a) * hs, vy, Math.sin(a) * hs], 1.2 + R() * 1.2, ds, ds * 0.7, 5, P.debris, gD, 1, jit(0, 14), 1, R() * 0.03, Math.max(0.5, p0[1] - g0 - ds * 0.35) + 1000); }
      for (let j = 0; j < 2; j++) FX.emit(add, [x, y + S * (0.45 + j * 0.4), z], [0, S * 0.3, 0], 0.42 + j * 0.1, S * 0.4, S * (2.6 - j * 0.6), 6, P.ring, 0, 2.4, 0, 0.8, 0.02 + j * 0.07, 1); /* anéis harmônicos deitados no ar (só o aro) */
    } else if (P.id === 4) { /* Vorag: ácido que espirra e fumaça amarelada */
      for (let i = cnt((4 + S * 0.3) * m); i > 0; i--) { const a = R() * TAU, sp = S * (1.5 + R() * 3) + 10; FX.emit(alp, [x, cy, z], [Math.cos(a) * sp, S * (1.5 + R() * 2.5) + 12, Math.sin(a) * sp], 0.6 + R() * 0.5, 0.8 + R() * 0.8 + S * 0.035, 0.6, 13, P.gota, 160 + S * 2, 1, 0, 1, R() * 0.05, 0.6); }
      if (!imp) { FX.emit(alp, [jit(x, S * 0.2), y + S * 0.3, jit(z, S * 0.2)], [jit(0, 3), S * 0.5 + 5, jit(0, 3)], (1.6 + R() * 1.0) * Math.sqrt(S / 10 + 0.3), S * 0.5, S * 1.5, 3, P.acido, -S * 0.05, 1.6, jit(0, 0.3), 0.5, 0.1 + R() * 0.2, 6.35); /* nuvem de ácido */
        for (let i = cnt((1 + S * 0.05) * m); i > 0; i--) FX.emit(alp, [jit(x, S * 0.3), y + S * 0.15, jit(z, S * 0.3)], [jit(0, S * 1.2), S * 0.4 + 4, jit(0, S * 1.2)], 1.0 + R() * 0.6, S * 0.4, S * 1.3, 4, [0.26, 0.05, 0.04], 0, 2, jit(0, 0.4), 0.55, 0.02, 2.2); } /* névoa de carne */
    } else if (big && !imp) { /* Vehnar e neutras: fumaça preta de óleo */
      for (let i = cnt((1 + S * 0.04) * m); i > 0; i--) FX.emit(alp, [jit(x, S * 0.25), y + S * 0.35, jit(z, S * 0.25)], [jit(0, 3), S * 0.7 + 6, jit(0, 3)], (2.6 + R() * 1.6) * Math.sqrt(S / 10 + 0.3), S * 0.6, S * 2.1, 3, [0.045, 0.042, 0.04], -S * 0.06, 1.6, jit(0, 0.3), 0.75, 0.15 + R() * 0.2, 8.45);
    }
  }
  // clarão na boca do cano (curto, sem fumaça)
  FX.muzzle = function (x, y, z, col, s) { s = s || 3; FX.emit(add, [x, y, z], [0, 0, 0], 0.07, s, s * 1.6, 1, col || [1.6, 1.2, 0.7], 0, 1, 0, 1); if (R() < 0.5 * FX.mult) FX.emit(add, [x, y, z], [jit(0, 30), 10 + R() * 25, jit(0, 30)], 0.18, 0.7, 0.2, 2, [1.5, 1.0, 0.4], 120, 1, 0, 1); };
  // impacto: sem área, clarão pequeno, faíscas e um sopro de poeira; com área, uma explosão de impacto (terra em vez de sucata)
  FX.impact = function (x, y, z, splash, col) {
    if (splash > 0) { FX.explosion(x, y, z, Math.min(16, 3 + splash * 0.3), { tint: col, impact: true }); return; }
    const c = col || [1.4, 0.9, 0.45]; FX.emit(add, [x, y + 1.5, z], [0, 0, 0], 0.06, 2.2, 3.4, 1, [c[0] * 1.2, c[1] * 1.2, c[2] * 1.2], 0, 1.5, 0, 0.8);
    const n = cnt(3.5 * FX.mult); for (let i = 0; i < n; i++) { const a = R() * TAU; FX.emit(add, [x, y + 2, z], [Math.cos(a) * 45 * R(), 20 + R() * 40, Math.sin(a) * 45 * R()], 0.2 + R() * 0.3, 0.6 + R() * 0.5, 0.2, 2, c, 180, 1, 0, 1, 0, 1.2); }
    if (R() < 0.8 * FX.mult) FX.emit(alp, [x, y + 1.2, z], [jit(0, 3), 5 + R() * 4, jit(0, 3)], 0.7 + R() * 0.4, 1.6, 5.5, 4, [0.45, 0.4, 0.34], 0, 2, jit(0, 0.4), 0.5, 0, 2);
  };
  // fumaça macia (chaminés, carcaças, estruturas avariadas) — 4.3g: com volume e luz da cena
  FX.smoke = function (x, y, z, col, life, vz, size) { const s = size || 6; FX.emit(alp, [x, y, z], [jit(0, 3), vz == null ? 12 : vz, jit(0, 3)], life || 2.5, s * 0.6, s * 2, 3, col, -0.5, 1.5, jit(0, 0.5), 0.8); };
  FX.trail = function (x, y, z) { FX.emit(alp, [x, y, z], [jit(0, 2), 3, jit(0, 2)], 0.7, 1.2, 4, 3, [0.5, 0.48, 0.46], 0, 1.5, 0, 0.45); };
  FX.glow = function (x, y, z, col, size, life, vy) { FX.emit(add, [x, y, z], [0, vy || 0, 0], life || 0.6, size, size * 1.4, 7, col, 0, 2, 0, 1); };
  FX.pulse = function (x, y, z, col, r, life) { FX.emit(add, [x, y + 0.8, z], [0, 0, 0], life || 1.2, r * 0.15, r, 6, col, 0, 2.2, 0, 1); };
  FX.ring = function (x, y, z, col, r, life) { FX.emit(add, [x, y, z], [0, 0, 0], life || 0.9, r * 0.2, r, 8, col, 0, 2.2, 0, 1); };
  // 4.3g: fogo contínuo (carcaças em chamas, construções avariadas): o chamador chama a cada quadro com a chance que quiser; size = tamanho
  // da chama, k = força (0..1), pull (opcional) = puxão para a câmera em unidades (fogo de construção nasce dentro da malha: ~0,9 × raio). Línguas de chama que tremulam e sobem, núcleo quente, fumaça escura acesa por baixo, brasas e estalos.
  // A emissão é por segundo (usa o dt do quadro): o fogo tem a mesma cara a 20 ou a 60 quadros por segundo.
  FX.fire = function (x, y, z, size, k, pull) {
    k = k == null ? 1 : Math.max(0, Math.min(1, k)); const m = FX.mult, dk = FX.dt > 0 ? Math.min(8, FX.dt * 60) : 0; if (!dk || !(size > 0)) return;
    const s = size, kk = 0.35 + 0.65 * k, pu = Math.max(0, Math.min(99, Math.floor(pull || 0))); /* pull (opcional): quanto o fogo vem para a frente, em unidades do mundo, quando o ponto fica dentro da malha */
    for (let i = cnt(0.65 * m * dk * (0.3 + 0.7 * k)); i > 0; i--) { const a = R() * TAU, rr = Math.sqrt(R()) * s * 0.45, h = s * (0.7 + R() * 0.5) * kk; /* línguas */
      FX.emit(alp, [x + Math.cos(a) * rr, y + s * 0.1, z + Math.sin(a) * rr], [jit(0, s * 0.12), s * (0.8 + R() * 0.8) * kk, jit(0, s * 0.12)], 0.32 + R() * 0.3, h, h * 0.5, 9, [1, 1, 1], -s * 1.4 * kk, 1.3, 0, 0.75 + 0.25 * k, R() * 0.02, pu + (1.4 + R() * 0.7) / 10); }
    for (let i = cnt(0.27 * m * dk * k); i > 0; i--) { const a = R() * TAU, rr = Math.sqrt(R()) * s * 0.35, b = s * (0.75 + R() * 0.45) * kk; /* corpo do fogo: bolas que queimam quase a vida toda e soltam fuligem */
      FX.emit(alp, [x + Math.cos(a) * rr, y + s * 0.15, z + Math.sin(a) * rr], [jit(0, s * 0.15), s * (0.9 + R() * 0.7), jit(0, s * 0.15)], 0.55 + R() * 0.35, b, b * 1.5, 14, [0.07, 0.065, 0.06], -s * 0.6, 1.6, jit(0, 1.5), 0.9, R() * 0.02, Math.min(99, pu + Math.round(s * 0.6)) * 100 + 10 + 0.55 + R() * 0.15); }
    if (R() < 0.18 * m * dk * k) FX.emit(add, [jit(x, s * 0.2), y + s * 0.2, jit(z, s * 0.2)], [0, s * 0.3, 0], 0.22 + R() * 0.12, s * 1.2, s * 1.6, 7, [1.2 * k, 0.42 * k, 0.09 * k], 0, 2, 0, 0.5, 0, pu + s * 1.1); /* núcleo quente */
    for (let i = cnt(0.22 * m * dk * (0.45 + 0.55 * k)); i > 0; i--) { const sc = 0.05 + R() * 0.03 + (1 - k) * 0.08; /* fumaça escura acesa por baixo */
      FX.emit(alp, [jit(x, s * 0.25), y + s * (1.0 + 0.6 * k), jit(z, s * 0.25)], [jit(0, 2.5), s * (1.3 + R()) + 4, jit(0, 2.5)], 2.4 + R() * 1.4, s * (0.8 + R() * 0.3), s * (2.8 + R() * 1.2), 3, [sc, sc * 0.95, sc * 0.9], -s * 0.12, 1.6, jit(0, 0.35), 0.8 * (0.55 + 0.45 * k), R() * 0.03, 3.05 + 0.3 * k); }
    if (R() < 0.14 * m * dk * k) FX.emit(add, [jit(x, s * 0.3), y + s * 0.3, jit(z, s * 0.3)], [jit(0, 4), s * (1.8 + R() * 2) + 6, jit(0, 4)], 1 + R() * 1.2, 0.45 + R() * 0.4 + s * 0.03, 0.3, 10, [1.9, 0.85, 0.3], -2, 1, 0, 1, 0, s * (0.15 + R() * 0.2)); /* brasas */
    if (R() < 0.03 * m * dk * k) FX.emit(add, [x, y + s * 0.4, z], [jit(0, 14), 22 + R() * 26, jit(0, 14)], 0.6 + R() * 0.6, 0.6, 0.2, 2, [1.8, 0.85, 0.3], 40, 1, 0, 1, 0, 0.8); /* estalos */
  };
  FX.spark = function (x, y, z, col, sp, n) { n = Math.max(1, Math.round((n || 1) * FX.mult)); for (let i = 0; i < n; i++) { const a = R() * TAU; FX.emit(add, [x, y, z], [Math.cos(a) * sp * R(), sp * (0.4 + R() * 0.8), Math.sin(a) * sp * R()], 0.35 + R() * 0.5, 0.6 + R() * 0.6, 0.2, 2, col, 200, 1, 0, 1); } };
  return FX;
}
ARD.fx3d = { create, m5: true /* 5.0b: portado para o Motor 5 (TSL) */, farol: m5Farol, inversoSaida: m5InversoSaida };
})(globalThis.ARD = globalThis.ARD || {});
