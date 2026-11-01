/* Aether Rift: Dominion — Motor 5 (5.0e, agente e-base): a base viva. Só no Motor 5 e só visual: lê a simulação (vida, módulo, obra do módulo,
   energia do jogador) e desenha; nada aqui muda a simulação nem o determinismo.
   - Módulos visíveis: a Câmara de Fusão do Reator, a Academia do Quartel e a Bateria Pesada da Torre viram uma peça a mais na construção, no
     estilo da Raça (geometria própria no formato dos modelos: o mesmo material da Raça e o mesmo pipeline das construções). Na instalação a peça
     sobe com faíscas da Raça.
   - Avaria nas paredes: pela vida da instância, no fragmento do material dos modelos (sem malha nova): rachaduras, fuligem e chapas soltas
     (Vehnar), trincas de luz (Erevane), feridas (Tessara), fraturas (Quorith) e bolhas (Vorag); mais fumaça e faíscas da Raça nas muito avariadas.
   - Energia nos condutos: a parte emissiva das construções (faixas, janelas, condutos) pulsa com a energia do dono; racionada, pisca e enfraquece;
     em colapso, quase apaga e só tremula.
   - Vida de base: tratores (Vehnar), drones de carga (Erevane), esporos (Tessara), cristais-mensageiros (Quorith) e larvas (Vorag) indo de uma
     construção à outra; poucos, instanciados, no material da Raça (nenhum pipeline novo) e fora da Baixa.
   - Construções que respiram: Tessara e Vorag incham e desincham devagar por ruído no vértice (até ~2,5%: a silhueta e a seleção não mudam).
   Os dados por instância vão num atributo novo, aVida = [avaria 0…1, falta de energia 0…1, respiração, Raça + semente] (zeros = nada muda:
   unidades, recursos e cenário), que o render3d escreve no put junto com a animação (o vetor da animação ganha as posições 5 a 8).
   Chaves de URL: ?m5base=0 (tudo), ?m5avaria=0, ?m5energia=0, ?m5modulos=0, ?m5vida=0|N (N por base), ?m5respira=0. */
(function (ARD) {
'use strict';
const M5 = ARD.m5 = ARD.m5 || {};
const T = () => window.THREE_M5 || window.THREE, L = () => window.TSL;
const QS = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
const DESLIGA = QS.get('m5base') === '0';
const MEDE = QS.get('m5basems') === '1'; /* medida: ms de CPU por quadro do módulo em B.ms (vida, predio, fim, quadro) */
const B = M5.base = { versao: '5.0e', ativo: !DESLIGA, avaria: QS.get('m5avaria') !== '0', energia: QS.get('m5energia') !== '0', modulos: QS.get('m5modulos') !== '0', respira: QS.get('m5respira') !== '0', vidaN: QS.get('m5vida'), U: null, falta: [], est: { modulos: 0, vida: 0, avariadas: 0 }, ms: { vida: 0, predio: 0, fim: 0, quadro: 0, n: 0 } };
const RACA = { vehnar: 1, erevane: 2, tessara: 3, quorith: 4, vorag: 5 };
const ZERO9 = [0, 0, 0, 0, 0, 0, 0, 0, 0];

/* ---------- uniforms (grupo da chamada de render: um bloco só, igual para todos os objetos; um nó por estágio, nunca o mesmo nó no vértice e no
   fragmento do mesmo material — o achado do d-clima na 5.0d) ---------- */
function U() {
  if (B.U) return B.U; const { uniform, renderGroup } = L(); const u = v => uniform(v).setGroup(renderGroup);
  B.U = { tempo: u(0) /* fragmento: segundos do visual (R.time) */, nivel: u(1) /* fragmento: 0 Baixa e celular … 3 Ultra */ }; /* só no fragmento (ver preRespira) */
  return B.U;
}
B.uniforms = U;

/* ---------- ruídos como funções do WGSL (regra 6 da carga: o código sai uma vez por shader) ---------- */
let fH = null, fN = null, fV = null;
function ruidos() {
  if (fH) return; const { Fn, Loop, Var, fract, sin, dot, vec2, floor, mix, min, max, float } = L();
  /* o hash vai embutido nas outras funções (sem função chamando função): com a dependência, a ordem das declarações no WGSL mudava entre o 1º
     material montado e os seguintes, e os materiais das Raças e a ruína deixavam de dividir o módulo */
  const hh = p => fract(sin(dot(p, vec2(127.1, 311.7))).mul(43758.5453));
  fH = Fn(([p]) => hh(p)).setLayout({ name: 'ardBH', type: 'float', inputs: [{ name: 'p', type: 'vec2' }] });
  fN = Fn(([p]) => { const i = floor(p).toVar(), f = fract(p).toVar(), u = f.mul(f).mul(f.mul(-2).add(3)).toVar(); return mix(mix(hh(i), hh(i.add(vec2(1, 0))), u.x), mix(hh(i.add(vec2(0, 1))), hh(i.add(vec2(1, 1))), u.x), u.y); }).setLayout({ name: 'ardBN', type: 'float', inputs: [{ name: 'p', type: 'vec2' }] });
  /* Voronoi 3×3: (F1, F2) em distância; as bordas das células são retas (fraturas e trincas), o miolo é redondo (bolhas) */
  fV = Fn(([p]) => { const i = floor(p).toVar(), f = fract(p).toVar(); const d1 = Var(float(8), 'ardBv1'), d2 = Var(float(8), 'ardBv2');
    Loop({ start: -1, end: 1, condition: '<=', name: 'by' }, { start: -1, end: 1, condition: '<=', name: 'bx' }, ({ by, bx }) => { const o = vec2(float(bx), float(by)); const io = i.add(o); const r = o.add(vec2(hh(io), hh(io.add(17.3)))).sub(f); const d = dot(r, r); d2.assign(min(d2, max(d, d1))); d1.assign(min(d1, d)); });
    return vec2(d1.sqrt(), d2.sqrt()); }).setLayout({ name: 'ardBV', type: 'vec2', inputs: [{ name: 'p', type: 'vec2' }] });
}

/* ---------- respiração (vértice): passo prévio no espaço do modelo, antes da instância (o mesmo caminho da animação por peça; a sombra roda o
   mesmo passo pelo positionNode). Tessara devagar, Vorag mais rápido (aVida.z ≥ 1). A base fica presa ao chão. ---------- */
function preRespira(builder) {
  const g = builder.geometry; if (!g || !g.hasAttribute('aVida')) return; ruidos();
  const { Fn, If, Var, attribute, float, vec2, vec3, vec4, sin, step, mix, smoothstep, positionLocal } = L();
  /* sem uniform no vértice: um uniform do grupo da chamada usado aqui entra também no bloco do fragmento (a ruína, sem este passo, sairia com
     outro fragmento); a qualidade vai no próprio aVida.z, que o B.vida zera na Baixa e no celular. A posição é atribuída sempre, fora do If:
     e os fatores começam em 1 antes dele: o TSL emite o valor inicial de um Var no primeiro uso (que seria dentro do If) e o WGSL zera a variável declarada no topo; quem não respira ficava com a posição zerada (sumia) */
  Fn(() => {
    const vd = attribute('aVida', 'vec4'), ai = g.hasAttribute('aInst') ? attribute('aInst', 'vec4') : vec4(0, 0, 0, 0);
    const p = Var(vec3(0, 0, 0), 'ardRespP'); p.assign(positionLocal); const kx = Var(float(1), 'ardRespXZ'), ky = Var(float(1), 'ardRespY'); kx.assign(1); ky.assign(1); /* a posição e os fatores lidos aqui, antes do If: o TSL emite a inicialização de uma variável (positionLocal = position, inclusive) no primeiro uso, que seria dentro do If */
    If(vd.z.greaterThan(0.0005), () => {
      const rap = step(1, vd.z), amp = vd.z.sub(rap), w = mix(float(0.7), float(1.55), rap), t = ai.y;
      const n = fN(p.xz.mul(0.21).add(vec2(t.mul(0.09), t.mul(0.06)))).sub(0.5);
      const s = sin(t.mul(w).add(p.y.mul(0.28))); const k = smoothstep(0.0, 1.4, p.y);
      kx.assign(amp.mul(s.mul(0.62).add(n.mul(0.9))).mul(k).add(1)); ky.assign(amp.mul(0.4).mul(s).mul(k).add(1));
    });
    positionLocal.assign(vec3(p.x.mul(kx), p.y.mul(ky), p.z.mul(kx)));
  }, 'void')();
}
/* gancho de posição: embrulha o marcador da animação (src/m5/modelos.js) com a respiração; vale para a parte principal e a emissiva (as duas
   respiram juntas: as luzes ficam coladas na parede). Ruína e material sem animação ficam como estão */
const G = M5.ganchos = M5.ganchos || { modelo: { posicao: null, superficie: null, emissivo: null }, chao: { cor: null }, adereco: { posicao: null } };
G.modelo = G.modelo || {};
if (B.ativo && B.respira) { const posAntes = G.modelo.posicao;
  G.modelo.posicao = function (ctx) { const mk = posAntes ? posAntes(ctx) : null; const o = (ctx && ctx.o) || {}; if (!mk || typeof mk.ardPre !== 'function' || o.ruina) return mk;
    const pre0 = mk.ardPre; const n = L().positionLocal.toVar('ardPosB'); n.ardPre = function (b) { preRespira(b); pre0(b); }; n.ardNome = 'respira+' + (mk.ardNome || ''); return n; }; }

/* ---------- avaria (fragmento do material dos modelos: unidades, construções e ruínas dividem o fragmento; só a construção com aVida.x > 0 paga) ---------- */
let DK = null; /* as saídas desta montagem (o setupDiffuseColor monta antes da rugosidade e do emissivo, como o clima da 5.0d) */
function vidaV(m) { if (!m.userData.ardVidaV) m.userData.ardVidaV = L().varying(M5.attr('aVida', L().vec4(0, 0, 0, 0)), 'ardVida'); return m.userData.ardVidaV; }
function planoUV(p, n) { const { abs, step, mix, float } = L(); const an = abs(n); const ex = step(an.y, an.x).mul(step(an.z, an.x)), ey = float(1).sub(ex).mul(step(an.z, an.y)); return mix(mix(p.xy, p.xz, ey), p.zy, ex); }
function avaria(m) {
  ruidos(); const { Fn, If, Var, float, vec2, vec3, floor, fract, sin, abs, min, max, mix, smoothstep, step, clamp, diffuseColor, positionGeometry, normalGeometry } = L(); const UU = U();
  const vida = vidaV(m);
  const em = Var(vec3(0, 0, 0), 'ardDanoEm'), rg = Var(float(0), 'ardDanoRg'); em.assign(vec3(0, 0, 0)); rg.assign(0); /* zerados antes do If (lidos fora dele, no emissivo e na rugosidade) */
  const d = vida.x, st = floor(vida.w), sd = fract(vida.w);
  If(d.greaterThan(0.004).and(st.greaterThan(0.5)), () => {
    const p = positionGeometry, uv = Var(planoUV(p, normalGeometry).add(sd.mul(37.0)), 'ardDanoUv');
    const nz = Var(fN(uv.mul(0.33)).mul(0.72).add(fN(uv.mul(1.3)).mul(0.28)), 'ardDanoNz');
    const reg = Var(smoothstep(float(0.98).sub(d.mul(0.72)), float(1.1).sub(d.mul(0.72)), nz), 'ardDanoReg'); /* a área cresce com a avaria (até ~3/4 da parede) */
    const vo = Var(vec2(0.5, 1.5), 'ardDanoVo'); vo.assign(vec2(0.5, 1.5)); /* sem Voronoi: nenhuma trinca (F2 − F1 grande) e nenhuma bolha (F1 grande); o valor inicial antes do If */ If(UU.nivel.greaterThan(0.5), () => { vo.assign(fV(uv.mul(0.78))); }); /* na Baixa e no celular, sem as trincas (só fuligem e cor) */
    const gap = vo.y.sub(vo.x); const crack = Var(float(1).sub(smoothstep(0.0, d.mul(0.03).add(0.03), gap)).mul(reg), 'ardDanoCr'); /* trincas finas (a parede segue legível) */
    const soot = Var(smoothstep(float(0.72).sub(d.mul(0.3)), float(0.9).sub(d.mul(0.3)), fN(vec2(uv.x.mul(0.45), p.y.mul(0.16).add(sd.mul(11))))).mul(smoothstep(0.12, 0.5, d)), 'ardDanoFu'); /* fuligem em manchas (até ~metade da parede): a construção continua legível */
    const alb = Var(diffuseColor.rgb, 'ardDanoAlb'); const t = UU.tempo;
    If(st.lessThan(1.5), () => { /* Vehnar: rachaduras escuras, fuligem e chapas soltas (painéis tortos com ferrugem e a fresta escura), brasa nas trincas */
      const cs = vec2(2.6, 1.6), c0 = uv.div(cs), cid = floor(c0), cf = fract(c0); const h = fH(cid.add(sd.mul(7.1)));
      const solta = step(h, d.mul(0.55)).mul(smoothstep(0.25, 0.6, d)); const e = min(cf, float(1).sub(cf)).mul(cs); const fresta = float(1).sub(smoothstep(0.03, 0.11, min(e.x, e.y)));
      const fer = mix(vec3(0.3, 0.16, 0.07), vec3(0.52, 0.3, 0.14), fN(uv.mul(2.1))); alb.assign(mix(alb, fer.mul(0.75).add(alb.mul(0.25)), solta.mul(float(0.82).sub(fresta.mul(0.3)))));
      alb.mulAssign(float(1).sub(fresta.mul(solta).mul(0.7)).mul(float(1).sub(soot.mul(0.68))).mul(float(1).sub(crack.mul(0.78))));
      rg.assign(solta.mul(0.26).add(soot.mul(0.3)));
      const fl = sin(t.mul(9.0).add(nz.mul(31))).mul(0.3).add(0.7); const quente = smoothstep(0.55, 0.72, fN(uv.mul(0.5).add(3.1))); em.assign(vec3(1.5, 0.48, 0.1).mul(crack.mul(quente).mul(smoothstep(0.62, 0.95, d)).mul(fl).mul(0.8))); /* brasa só em focos (~1/3 das rachaduras) */
    }).ElseIf(st.lessThan(2.5), () => { /* Erevane: trincas de luz (ciano que tremula) e marcas de queimado */
      alb.mulAssign(float(1).sub(crack.mul(0.45)).mul(float(1).sub(soot.mul(0.55))));
      const fl = sin(t.mul(7.0).add(vo.x.mul(21)).add(sd.mul(9))).mul(0.35).add(0.65); em.assign(vec3(0.22, 1.05, 0.95).mul(crack.mul(fl).mul(d.mul(0.9).add(0.45))));
      rg.assign(soot.mul(0.22));
    }).ElseIf(st.lessThan(3.5), () => { /* Tessara: feridas — carne viva vermelha e úmida no miolo, borda necrosada escura, seiva que brilha nas muito feridas */
      const w = nz.mul(0.6).add(fN(uv.mul(2.4)).mul(0.4)); const ab = smoothstep(float(0.86).sub(d.mul(0.32)), float(0.93).sub(d.mul(0.32)), w); const mi = smoothstep(float(0.9).sub(d.mul(0.3)), float(0.97).sub(d.mul(0.3)), w);
      alb.assign(mix(alb, vec3(0.13, 0.075, 0.035), ab.sub(mi).mul(0.85))); alb.assign(mix(alb, vec3(0.45, 0.05, 0.04), mi.mul(0.92))); alb.mulAssign(float(1).sub(soot.mul(0.3)));
      rg.assign(mi.mul(-0.62).add(ab.sub(mi).mul(0.15)));
      const gota = smoothstep(0.62, 0.74, fN(uv.mul(5.2))).mul(mi).mul(smoothstep(0.6, 0.95, d)); const pu = sin(t.mul(2.2).add(nz.mul(9))).mul(0.3).add(0.7);
      em.assign(vec3(0.1, 0.008, 0.004).mul(mi).add(vec3(0.42, 0.8, 0.1).mul(gota.mul(pu).mul(0.45)))); /* um brilho vermelho fraco na carne viva e gotas de seiva acesas */
    }).ElseIf(st.lessThan(4.5), () => { /* Quorith: fraturas retas (bordas das células) acesas em violeta e o cristal turvo em volta */
      const fr = float(1).sub(smoothstep(0.0, d.mul(0.03).add(0.022), gap)).mul(reg);
      alb.assign(mix(alb, vec3(0.74, 0.71, 0.8), reg.mul(d).mul(0.4))); alb.mulAssign(float(1).sub(fr.mul(0.35)).mul(float(1).sub(soot.mul(0.4))));
      rg.assign(reg.mul(d).mul(0.35));
      const fl = sin(t.mul(3.0).add(vo.y.mul(13))).mul(0.3).add(0.7); em.assign(vec3(0.85, 0.5, 1.55).mul(fr.mul(fl).mul(d.mul(0.9).add(0.4))));
    }).Else(() => { /* Vorag: bolhas (miolo redondo das células) de pus claro e brilhante; as estouradas viram buracos escuros com um fundo de ácido aceso */
      const r0 = d.mul(0.12).add(0.2), r1 = d.mul(0.12).add(0.3); const bo = float(1).sub(smoothstep(r0, r1, vo.x)).mul(reg); const es = step(fH(floor(uv.mul(0.78)).add(sd.mul(3.3))), d.mul(0.4)).mul(bo);
      const anel = smoothstep(r1.sub(0.04), r1.add(0.02), vo.x).mul(float(1).sub(smoothstep(r1.add(0.02), r1.add(0.1), vo.x))).mul(reg);
      alb.assign(mix(alb, vec3(0.9, 0.78, 0.45), bo.sub(es).mul(0.78))); alb.mulAssign(float(1).sub(es.mul(0.85)).mul(float(1).sub(anel.mul(0.5))).mul(float(1).sub(soot.mul(0.3))));
      rg.assign(bo.mul(-0.65));
      em.assign(vec3(0.42, 0.85, 0.1).mul(es.mul(float(1).sub(smoothstep(0.0, r0, vo.x).mul(0.6))).mul(smoothstep(0.4, 0.9, d)).mul(sin(t.mul(4.0).add(nz.mul(17))).mul(0.2).add(0.8)).mul(0.38)));
    });
    diffuseColor.rgb.assign(clamp(alb, 0, 2));
  });
  DK = { em, rg };
}
function ligaAvaria(m) {
  if (!m || m.userData.ardAvaria) return m; m.userData.ardAvaria = true; const { Fn, clamp, vec3 } = L();
  const sdc = m.setupDiffuseColor; m.setupDiffuseColor = function (b) { sdc.call(this, b); avaria(this); };
  const r0 = m.roughnessNode; if (r0) m.roughnessNode = Fn(() => { const K = DK; return K ? clamp(r0.add(K.rg), 0.04, 1.0) : r0; })();
  const e0 = m.emissiveNode || vec3(0, 0, 0); m.emissiveNode = Fn(() => { const K = DK; return K ? e0.add(K.em) : e0; })();
  return m;
}
/* ---------- energia (fragmento da parte emissiva: janelas, faixas e condutos) ---------- */
function energia(m) {
  ruidos(); const { If, float, vec2, floor, fract, sin, mix, smoothstep, step, diffuseColor, positionGeometry } = L(); const UU = U();
  const vida = vidaV(m); const f = vida.y, sd = fract(vida.w);
  If(vida.w.greaterThan(0.5), () => {
    const p = positionGeometry, t = UU.tempo;
    const flu = sin(t.mul(float(2.5).sub(f.mul(1.6))).sub(p.y.mul(0.85)).sub(p.x.mul(0.22)).add(sd.mul(40))).mul(0.5).add(0.5); /* o pulso sobe pelos condutos; mais lento sem energia */
    const pulso = mix(flu.mul(flu).mul(0.45).add(0.8), flu.mul(0.22).add(0.5), smoothstep(0.0, 0.6, f));
    const pisca = step(f.mul(0.62).add(0.16), fH(vec2(floor(t.mul(7.5)), sd.mul(31)))); /* racionada: liga e desliga aos trancos */
    const k = mix(float(1), pisca, smoothstep(0.25, 0.55, f)).mul(pulso).mul(float(1).sub(smoothstep(0.7, 1.0, f).mul(0.9)));
    diffuseColor.rgb.mulAssign(k);
  });
}
function ligaEnergia(m) { if (!m || m.userData.ardEnergia) return m; m.userData.ardEnergia = true; const sdc = m.setupDiffuseColor; m.setupDiffuseColor = function (b) { sdc.call(this, b); energia(this); }; return m; }

/* os materiais dos modelos (M5.modelo) e da parte emissiva (M5.emissivo), embrulhados depois de montados (depois do detalhe de superfície, do
   clima e do apagar da ruína): a ruína e os modelos seguem com o mesmo fragmento (a ruína não tem aVida: o varying vale 0 e nada muda) */
if (B.ativo) {
  if (B.avaria && typeof M5.modelo === 'function') { const mod0 = M5.modelo; M5.modelo = function () { return ligaAvaria(mod0.apply(this, arguments)); }; }
  if (B.energia && typeof M5.emissivo === 'function') { const em0 = M5.emissivo; M5.emissivo = function () { return ligaEnergia(em0.apply(this, arguments)); }; }
  if (typeof M5.frame === 'function') { const fr0 = M5.frame; M5.frame = function (X, R) { fr0.apply(this, arguments); if (MEDE) { const t = performance.now(); quadro(R); B.ms.quadro += performance.now() - t; B.ms.n++; } else quadro(R); }; }
}

/* ---------- por quadro: uniforms e a energia de cada jogador (suavizada, em degraus de 1/64: a instância só sobe quando muda) ---------- */
let tAnt = -1;
function nivelDe(R) { const q = R && R.quality ? (R.quality.resolved || R.quality.name) : 'media'; const toque = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches; return q === 'baixa' || toque ? 0 : q === 'media' ? 1 : q === 'alta' ? 2 : 3; }
function quadro(R) {
  if (!R) return; const UU = U(); const dt = tAnt < 0 ? 0 : Math.max(0, Math.min(0.25, R.time - tAnt)); tAnt = R.time; UU.tempo.value = R.time;
  const nv = nivelDe(R); B.nivel = nv; B.est.modulos = 0; B.est.vida = 0; B.est.avariadas = 0; UU.nivel.value = nv;
  const sim = R.sim; if (!sim || !sim.players) return;
  for (const p of sim.players) { const en = p.energy || {}; const r = en.ratio == null ? 1 : en.ratio;
    let alvo = r >= 1 ? 0 : r >= 0.7 ? 0.3 + (1 - r) / 0.3 * 0.3 : 0.75 + Math.min(1, (0.7 - r) / 0.7) * 0.25; if (p.blackoutT > 0) alvo = 1;
    const f0 = B.falta[p.id] == null ? alvo : B.falta[p.id]; const f = f0 + (alvo - f0) * Math.min(1, dt * 2.2); B.falta[p.id] = Math.abs(f - alvo) < 0.008 ? alvo : f; }
}
B.forcaFalta = null; /* ferramentas de teste: um valor fixo de falta de energia para todos (0…1) */

/* ---------- o vetor por instância (o render3d chama no animFor das construções: v[5..8] = aVida) ---------- */
const hash = n => { let x = Math.imul((n | 0) ^ 0x9e3779b9, 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16; return (x >>> 0) / 4294967296; };
B.vida = function (e, v, sim) {
  const p = sim.players[e.owner]; const fac = p ? p.faction : null; const st = RACA[fac] || 0; if (!st) { v[5] = 0; v[6] = 0; v[7] = 0; v[8] = 0; return v; }
  const hpf = e.maxHp > 0 ? e.hp / e.maxHp : 1; const d = e.built ? Math.max(0, Math.min(1, (0.92 - hpf) / 0.82)) : 0;
  v[5] = B.avaria ? Math.round(d * 128) / 128 : 0;
  const f = B.forcaFalta != null ? B.forcaFalta : (B.falta[e.owner] || 0); v[6] = B.energia && e.built ? Math.round(f * 64) / 64 : 0;
  v[7] = B.respira && e.built && (B.nivel || 0) > 0 && !(S0() && S0().BUILDINGS[e.def] && S0().BUILDINGS[e.def].wall) ? (st === 3 ? 0.022 : st === 5 ? 1.026 : 0) : 0; /* fora da Baixa e do celular */
  v[8] = st + 0.05 + 0.9 * hash(e.id * 7 + 3); return v;
};
const S0 = () => ARD.sim;

/* ---------- mini-kit de geometria no formato dos modelos (position, normal, color, rm, pt + aAnim/aAnimB; a parte emissiva à parte) ---------- */
const MATS = { metal: [0.3, 0.78], steel: [0.42, 0.42], paint: [0.48, 0.18], dark: [0.58, 0.3], gloss: [0.22, 0.45], bone: [0.62, 0], chitin: [0.2, 0.05], crystal: [0.12, 0.18], skin: [0.48, 0], wet: [0.14, 0.02], matte: [0.82, 0.04], rubber: [0.9, 0] };
const PATS = { metal: 1, steel: 1, paint: 1, dark: 1, gloss: 1, bone: 3, skin: 3, chitin: 4, wet: 4, rubber: 2 };
const ANIMS = { wheel: 1, spin: 2, bob: 5, sway: 7 };
function Kit() { this.main = []; this.em = []; }
Kit.prototype.add = function (g, col, mat, o) {
  const Tm = T(); o = o || {}; if (g.index) { const g2 = g.toNonIndexed(); g.dispose(); g = g2; } if (g.attributes.uv) g.deleteAttribute('uv');
  const mt = new Tm.Matrix4().compose(new Tm.Vector3(o.x || 0, o.y || 0, o.z || 0), new Tm.Quaternion().setFromEuler(new Tm.Euler(o.rx || 0, o.ry || 0, o.rz || 0, 'YXZ')), new Tm.Vector3(o.sx || 1, o.sy || 1, o.sz || 1));
  g.applyMatrix4(mt); if (o.flat) g.computeVertexNormals();
  const c = new Tm.Color(col); if (o.e) c.multiplyScalar(o.e === true ? 2.4 : o.e);
  let an = null; if (o.anim) { const a = o.anim; an = { t: ANIMS[a.t] || 0, p: a.p || [0, 0, 0], b: a.t === 'wheel' ? [a.r || 1, 0, 0, 0] : a.t === 'spin' ? [a.speed == null ? 2 : a.speed, a.axis === 'x' ? 1 : a.axis === 'z' ? 2 : 0, a.ph || 0, 0] : [a.amp == null ? 0.3 : a.amp, a.speed == null ? 2 : a.speed, a.ph || 0, 0] }; }
  (o.e ? this.em : this.main).push({ g, c, rm: MATS[mat] || MATS.paint, pt: PATS[mat] || 0, an }); return this; };
Kit.prototype.box = function (x, y, z, w, h, d, col, mat, o) { return this.add(new (T().BoxGeometry)(w, h, d).translate(0, h / 2, 0), col, mat, Object.assign({}, o, { x, y, z })); };
Kit.prototype.cyl = function (x, y, z, rt, rb, h, col, mat, o) { o = o || {}; return this.add(new (T().CylinderGeometry)(rt, rb, h, o.seg || 12, 1, !!o.open).translate(0, h / 2, 0), col, mat, Object.assign({}, o, { x, y, z })); };
Kit.prototype.sph = function (x, y, z, r, col, mat, o) { o = o || {}; const s = o.seg || 12; return this.add(new (T().SphereGeometry)(r, s, Math.max(5, Math.round(s * 0.6)), 0, Math.PI * 2, 0, o.half ? Math.PI / 2 : Math.PI), col, mat, Object.assign({}, o, { x, y, z })); };
Kit.prototype.cone = function (x, y, z, r, h, col, mat, o) { o = o || {}; return this.add(new (T().ConeGeometry)(r, h, o.seg || 8).translate(0, h / 2, 0), col, mat, Object.assign({ flat: (o.seg || 8) <= 6 }, o, { x, y, z })); };
Kit.prototype.tor = function (x, y, z, R, r, col, mat, o) { o = o || {}; return this.add(new (T().TorusGeometry)(R, r, o.rs || 6, o.ts || 24, o.arc || Math.PI * 2).rotateX(Math.PI / 2), col, mat, Object.assign({}, o, { x, y, z })); };
Kit.prototype.oct = function (x, y, z, r, h, col, mat, o) { return this.add(new (T().OctahedronGeometry)(1, 0).scale(r, h / 2, r).translate(0, h / 2, 0), col, mat, Object.assign({ flat: true }, o, { x, y, z })); };
Kit.prototype.seg = function (a, b, r, col, mat, o) { const Tm = T(); const A = new Tm.Vector3(a[0], a[1], a[2]), D = new Tm.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]); const len = D.length() || 0.001;
  const g = new Tm.CylinderGeometry(r, r, len, (o && o.seg) || 6, 1, true).translate(0, len / 2, 0); g.applyQuaternion(new Tm.Quaternion().setFromUnitVectors(new Tm.Vector3(0, 1, 0), D.normalize())); g.translate(A.x, A.y, A.z); return this.add(g, col, mat, o); };
Kit.prototype.fim = function () {
  const Tm = T(); const all = this.main.concat(this.em); if (!this.main.length || !this.em.length) return null; const bb = new Tm.Box3(), tb = new Tm.Box3(); for (const p of all) { p.g.computeBoundingBox(); tb.copy(p.g.boundingBox); bb.union(tb); }
  const anim = all.some(p => p.an);
  const mk = (list, withRM) => { let n = 0; for (const p of list) n += p.g.attributes.position.count;
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3), rm = withRM ? new Float32Array(n * 2) : null, pt = withRM ? new Float32Array(n) : null, aa = anim ? new Float32Array(n * 4) : null, ab = anim ? new Float32Array(n * 4) : null; let k = 0;
    for (const p of list) { const c = p.g.attributes.position.count; pos.set(p.g.attributes.position.array, k * 3); nor.set(p.g.attributes.normal.array, k * 3);
      for (let i = 0; i < c; i++) { const j = k + i; col[j * 3] = p.c.r; col[j * 3 + 1] = p.c.g; col[j * 3 + 2] = p.c.b; if (rm) { rm[j * 2] = p.rm[0]; rm[j * 2 + 1] = p.rm[1]; pt[j] = p.pt; } if (aa && p.an) { aa.set([p.an.t, p.an.p[0], p.an.p[1], p.an.p[2]], j * 4); ab.set(p.an.b, j * 4); } }
      k += c; p.g.dispose(); }
    const g = new Tm.BufferGeometry(); g.setAttribute('position', new Tm.BufferAttribute(pos, 3)); g.setAttribute('normal', new Tm.BufferAttribute(nor, 3)); g.setAttribute('color', new Tm.BufferAttribute(col, 3)); if (rm) { g.setAttribute('rm', new Tm.BufferAttribute(rm, 2)); g.setAttribute('pt', new Tm.BufferAttribute(pt, 1)); }
    if (aa) { g.setAttribute('aAnim', new Tm.BufferAttribute(aa, 4)); g.setAttribute('aAnimB', new Tm.BufferAttribute(ab, 4)); } g.computeBoundingSphere(); return g; };
  const main = mk(this.main, true), em = mk(this.em, false); if (M5.entrelaca) { M5.entrelaca(main); M5.entrelaca(em, true); } /* o mesmo layout dos modelos: o mesmo pipeline */
  return { main, em, width: Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z), height: bb.max.y, mount: null, beam: null, mesh: true, anim: true, pieces: 0, ardBase: true };
};

/* ---------- peças dos módulos, no espaço do modelo da construção (W largura, Hh altura, mt altura do giro da torre): um anexo de lado,
   à direita da câmera padrão, no estilo da Raça ---------- */
function pal(fac) { const P = (ARD.meshes && ARD.meshes.PAL && ARD.meshes.PAL[fac]) || {}; return P; }
const OURO = '#F2C230';
function pecaModulo(def, fac, W, Hh, mt) {
  const K = new Kit(), P = pal(fac); const ax = W * 0.44, az = -W * 0.3, s = W / 10; /* s: escala da receita (o Reator Vehnar tem ~10 de largura) */
  if (def === 'reator') { /* Câmara de Fusão: um vaso de fusão com o miolo aceso, preso ao Reator */
    if (fac === 'vehnar') { K.cyl(ax, 0, az, 1.25 * s, 1.35 * s, 4.2 * s, P.a || '#7C8490', 'steel', { seg: 14 }); K.cyl(ax, 4.2 * s, az, 0.9 * s, 1.25 * s, 0.7 * s, P.d || '#2B2E35', 'dark', { seg: 14 });
      for (const y of [0.9, 2.0, 3.1]) K.cyl(ax, y * s, az, 1.29 * s, 1.29 * s, 0.32 * s, '#FF8C1A', null, { e: 2.6, seg: 14, open: true });
      K.cyl(ax, 0.2 * s, az, 1.4 * s, 1.4 * s, 0.22 * s, P.h || '#E8B23A', 'paint', { seg: 14 }); K.seg([ax - 1.1 * s, 3.2 * s, az + 0.3 * s], [ax - 2.4 * s, 3.6 * s, az + 0.9 * s], 0.22 * s, P.b || '#59606B', 'metal'); K.seg([ax - 1.1 * s, 1.4 * s, az - 0.2 * s], [ax - 2.4 * s, 1.5 * s, az - 0.6 * s], 0.22 * s, P.b || '#59606B', 'metal');
      K.box(ax, 4.9 * s, az, 0.5 * s, 0.25 * s, 0.5 * s, '#FFD27A', null, { e: 2.2 }); }
    else if (fac === 'erevane') { K.cyl(ax, 0, az, 0.9 * s, 1.2 * s, 1.1 * s, P.a || '#3A404B', 'gloss', { seg: 6, flat: true }); K.tor(ax, 2.6 * s, az, 1.15 * s, 0.14 * s, P.c || '#3FE6CF', null, { e: 2.4, ts: 28 }); K.tor(ax, 2.6 * s, az, 0.75 * s, 0.08 * s, P.t || '#C9B458', 'gloss', { ts: 20, rx: 0.6 });
      K.oct(ax, 1.9 * s, az, 0.42 * s, 1.4 * s, P.l || '#E05CFF', null, { e: 2.2 }); K.seg([ax, 1.1 * s, az], [ax, 1.9 * s, az], 0.12 * s, P.b || '#262A31', 'gloss'); }
    else if (fac === 'tessara') { K.sph(ax, 1.5 * s, az, 1.35 * s, P.a || '#CFC3AA', 'bone', { sy: 1.25, seg: 14 }); for (let i = 0; i < 3; i++) { const dy = (i - 1) * 0.78; K.tor(ax, (1.5 + dy) * s, az, (1.35 * Math.sqrt(Math.max(0.05, 1 - (dy / 1.69) * (dy / 1.69))) + 0.06) * s, 0.12 * s, P.l || '#7FE3A1', null, { e: 2.4, ts: 22 }); }
      for (const [dx, dz, r] of [[1.5, 0.7, 0.62], [-0.4, 1.5, 0.5]]) { K.sph(ax + dx * s, r * s, az + dz * s, r * s, P.b || '#B4A588', 'bone', { sy: 1.3, seg: 10 }); K.sph(ax + dx * s, r * 1.9 * s, az + dz * s, 0.16 * s, P.l || '#7FE3A1', null, { e: 2.4, seg: 6 }); }
      for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + 0.4; K.cone(ax + Math.cos(a) * 1.1 * s, 0, az + Math.sin(a) * 1.1 * s, 0.32 * s, 1.2 * s, P.d || '#5E4F3C', 'bone', { seg: 5, rz: Math.cos(a) * 0.5, rx: -Math.sin(a) * 0.5 }); }
      K.sph(ax, 3.4 * s, az, 0.35 * s, P.am || '#F2A93B', null, { e: 2, seg: 8 }); }
    else if (fac === 'quorith') { K.oct(ax, 0, az, 0.9 * s, 1.0 * s, P.d || '#342B4A', 'crystal'); K.oct(ax, 1.4 * s, az, 0.95 * s, 3.2 * s, P.a || '#C9BFEA', 'crystal', { ry: 0.4 }); K.oct(ax, 2.4 * s, az, 0.42 * s, 1.3 * s, P.c || '#B388FF', null, { e: 2.6, ry: 0.4 });
      K.tor(ax, 2.9 * s, az, 1.25 * s, 0.07 * s, P.l || '#DCCBFF', null, { e: 2, ts: 6, rx: 0.3 }); }
    else { K.sph(ax, 1.4 * s, az, 1.3 * s, P.b || '#7C3546', 'wet', { sy: 1.15, seg: 14 }); for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; K.seg([ax + Math.cos(a) * 1.2 * s, 0.2 * s, az + Math.sin(a) * 1.2 * s], [ax + Math.cos(a) * 0.5 * s, 2.9 * s, az + Math.sin(a) * 0.5 * s], 0.13 * s, P.bo || '#E8DCC8', 'bone'); }
      K.sph(ax, 1.5 * s, az, 0.7 * s, '#FF7A3A', null, { e: 2.2, seg: 10 }); K.sph(ax + 0.9 * s, 0.5 * s, az + 0.6 * s, 0.35 * s, P.l || '#FF5A5A', null, { e: 1.8, seg: 8 }); } }
  else if (def === 'quartel') { /* Academia: um mastro alto com o emblema dourado (o ★ dos veteranos) e uma ala de instrução */
    const ox = W * 0.42, oz = -W * 0.36, hh = Math.max(Hh * 1.05, 6 * s);
    if (fac === 'vehnar') { K.box(ox, 0, oz, 2.3 * s, 2.2 * s, 2.0 * s, P.a || '#7C8490', 'paint'); K.box(ox, 2.2 * s, oz, 1.6 * s, 1.2 * s, 1.5 * s, P.b || '#59606B', 'steel'); K.box(ox + 1.17 * s, 0.9 * s, oz, 0.06 * s, 0.4 * s, 1.5 * s, '#8FC9F0', null, { e: 1.8 });
      K.seg([ox, 3.4 * s, oz], [ox, hh, oz], 0.1 * s, P.t || '#BCC2CA', 'metal'); K.oct(ox, hh, oz, 0.45 * s, 0.9 * s, OURO, null, { e: 2.4 }); K.box(ox + 0.5 * s, hh - 1.6 * s, oz, 1.0 * s, 0.6 * s, 0.06 * s, OURO, 'paint'); }
    else if (fac === 'erevane') { K.cyl(ox, 0, oz, 0.55 * s, 0.9 * s, hh * 0.85, P.a || '#3A404B', 'gloss', { seg: 6, flat: true }); for (const y of [0.4, 0.62, 0.84]) K.tor(ox, hh * y, oz, 0.95 * s, 0.07 * s, P.t || '#C9B458', null, { e: 1.9, ts: 20 }); K.oct(ox, hh * 0.86, oz, 0.42 * s, 1.1 * s, OURO, null, { e: 2.4 }); }
    else if (fac === 'tessara') { K.seg([ox, 0, oz], [ox + 0.3 * s, hh * 0.9, oz - 0.2 * s], 0.28 * s, P.t || '#8E623A', 'bone'); for (let i = 0; i < 4; i++) { const a = i * 1.7; K.sph(ox + Math.cos(a) * 0.55 * s, hh * (0.45 + i * 0.12), oz + Math.sin(a) * 0.55 * s, 0.42 * s, P.l || '#7FE3A1', null, { e: 1.7, seg: 8, sy: 1.3 }); }
      K.sph(ox + 0.3 * s, hh * 0.92, oz - 0.2 * s, 0.5 * s, OURO, null, { e: 2.2, seg: 10 }); K.sph(ox, 0.5 * s, oz, 1.2 * s, P.a || '#CFC3AA', 'bone', { half: true, seg: 12 }); }
    else if (fac === 'quorith') { K.oct(ox, 0, oz, 0.75 * s, hh * 0.95, P.a || '#C9BFEA', 'crystal', { ry: 0.3 }); K.oct(ox + 0.8 * s, 0, oz + 0.3 * s, 0.4 * s, hh * 0.5, P.b || '#A797DC', 'crystal'); K.tor(ox, hh * 0.7, oz, 1.0 * s, 0.07 * s, OURO, null, { e: 2.2, ts: 6 }); K.oct(ox, hh * 0.98, oz, 0.3 * s, 0.8 * s, OURO, null, { e: 2.6 }); }
    else { K.seg([ox, 0, oz], [ox, hh * 0.85, oz], 0.22 * s, P.bo || '#E8DCC8', 'bone'); for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; K.seg([ox + Math.cos(a) * 0.9 * s, 0, oz + Math.sin(a) * 0.9 * s], [ox, hh * 0.55, oz], 0.12 * s, P.bo || '#E8DCC8', 'bone'); }
      for (let i = 0; i < 4; i++) K.sph(ox + Math.cos(i * 1.6) * 0.5 * s, hh * (0.35 + i * 0.13), oz + Math.sin(i * 1.6) * 0.5 * s, 0.4 * s, P.m || '#E6455A', null, { e: 1.6, seg: 8, sy: 1.3 }); K.sph(ox, hh * 0.88, oz, 0.48 * s, OURO, null, { e: 2.2, seg: 10 }); } }
  else if (def === 'torre') { /* Bateria Pesada: blindagem em volta da base e o paiol, abaixo do giro da torreta */
    const rr = W * 0.5, top = Math.max(1.2 * s, (mt || Hh * 0.6) * 0.62);
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + Math.PI / 6, x = Math.cos(a) * rr, z = Math.sin(a) * rr, ry = -a;
      if (fac === 'vehnar') { K.box(x, 0, z, 0.35 * s, top, 1.5 * s, P.a || '#7C8490', 'steel', { ry }); if (i % 2 === 0) K.box(x * 1.04, top * 0.75, z * 1.04, 0.12 * s, 0.22 * s, 0.22 * s, '#FF4A2A', null, { e: 2.4, ry }); }
      else if (fac === 'erevane') { K.box(x, 0, z, 0.25 * s, top * 1.1, 1.3 * s, P.a || '#3A404B', 'gloss', { ry, rz: 0.18 }); K.box(x * 1.02, top * 0.5, z * 1.02, 0.08 * s, top * 0.9, 0.08 * s, P.c || '#3FE6CF', null, { e: 2.2, ry }); }
      else if (fac === 'tessara') { K.cone(x, 0, z, 0.45 * s, top * 1.6, P.d || '#5E4F3C', 'bone', { seg: 5, rz: Math.cos(a) * 0.4, rx: -Math.sin(a) * 0.4 }); if (i % 2) K.sph(x * 0.9, 0.4 * s, z * 0.9, 0.3 * s, P.l || '#7FE3A1', null, { e: 1.8, seg: 8 }); }
      else if (fac === 'quorith') { K.oct(x, 0, z, 0.4 * s, top * 1.7, P.a || '#C9BFEA', 'crystal', { rz: Math.cos(a) * 0.3, rx: -Math.sin(a) * 0.3 }); if (i % 2 === 0) K.oct(x * 1.05, top * 1.2, z * 1.05, 0.15 * s, 0.5 * s, P.c || '#B388FF', null, { e: 2.4 }); }
      else { K.cone(x, 0, z, 0.35 * s, top * 1.8, P.bo || '#E8DCC8', 'bone', { seg: 6, rz: Math.cos(a) * 0.5, rx: -Math.sin(a) * 0.5 }); K.sph(x * 0.85, 0.3 * s, z * 0.85, 0.55 * s, P.a || '#5C2B37', 'chitin', { half: true, seg: 8 }); if (i % 2) K.sph(x * 0.85, 0.75 * s, z * 0.85, 0.18 * s, P.l || '#FF5A5A', null, { e: 2, seg: 6 }); } }
    const bx = W * 0.5, bz = W * 0.5; /* o paiol (Vehnar e Erevane) ou o casulo de munição (Tessara, Vorag) do lado de fora */
    if (fac === 'vehnar') { K.box(bx, 0, bz, 1.4 * s, 0.9 * s, 1.0 * s, '#59606B', 'steel'); K.box(bx, 0.9 * s, bz, 1.2 * s, 0.6 * s, 0.9 * s, '#8A5A3A', 'paint'); K.box(bx + 0.72 * s, 0.4 * s, bz, 0.05 * s, 0.25 * s, 0.6 * s, '#E8B23A', null, { e: 1.6 }); }
    else if (fac === 'erevane') { K.box(bx, 0, bz, 1.2 * s, 0.6 * s, 1.2 * s, P.b || '#262A31', 'gloss', { ry: 0.6 }); K.box(bx, 0.6 * s, bz, 0.5 * s, 0.08 * s, 0.5 * s, P.c || '#3FE6CF', null, { e: 2, ry: 0.6 }); }
    else if (fac === 'quorith') { K.oct(bx, 0, bz, 0.6 * s, 1.6 * s, P.b || '#A797DC', 'crystal'); K.oct(bx, 1.0 * s, bz, 0.22 * s, 0.6 * s, P.l || '#DCCBFF', null, { e: 2.2 }); }
    else { K.sph(bx, 0.6 * s, bz, 0.8 * s, fac === 'tessara' ? (P.a || '#CFC3AA') : (P.b || '#7C3546'), fac === 'tessara' ? 'bone' : 'wet', { seg: 10, sy: 0.8 }); K.sph(bx, 0.9 * s, bz, 0.3 * s, fac === 'tessara' ? (P.l || '#7FE3A1') : '#FF7A3A', null, { e: 2, seg: 8 }); } }
  else return null;
  return K.fim();
}

/* ---------- vida de base: um trabalhador por Raça (medidas do mundo: o put usa escala 1) ---------- */
function trabalhador(fac) {
  const K = new Kit(), P = pal(fac);
  if (fac === 'vehnar') { /* trator de carga: cabine, caçamba com caixa, quatro rodas que giram pela distância e o giroflex laranja */
    K.box(0, 1.2, 0, 7.2, 1.6, 3.6, P.h || '#E8B23A', 'paint'); K.box(1.8, 2.8, 0, 2.6, 2.0, 3.2, P.a || '#7C8490', 'steel'); K.box(-1.4, 2.8, 0, 3.2, 1.4, 3.0, '#8A5A3A', 'paint'); K.box(3.12, 3.3, 0, 0.06, 1.0, 2.6, '#8FC9F0', null, { e: 1.4 });
    for (const x of [-2.4, 2.4]) for (const z of [-1.9, 1.9]) K.cyl(x, 0, z, 1.1, 1.1, 0.8, '#26282D', 'rubber', { seg: 10, rx: Math.PI / 2, y: 1.1, z: z + (z > 0 ? -0.4 : 0.4), anim: { t: 'wheel', p: [x, 1.1, z], r: 1.1 } });
    K.box(1.8, 3.8, 0, 0.5, 0.4, 0.5, '#FF8C1A', null, { e: 2.6 }); }
  else if (fac === 'erevane') { /* drone de carga: corpo em losango, dois anéis de rotor acesos e a caixa pendurada */
    const bob = { t: 'bob', p: [0, 0, 0], amp: 0.6, speed: 2.2 }; K.oct(0, 0, 0, 2.6, 1.6, P.a || '#3A404B', 'gloss', { sx: 1.4, anim: bob }); K.box(0, -1.9, 0, 1.6, 1.2, 1.6, P.t || '#C9B458', 'gloss', { anim: bob });
    for (const x of [-2.6, 2.6]) K.tor(x, 0.6, 0, 1.2, 0.12, P.c || '#3FE6CF', null, { e: 2.4, ts: 16, anim: bob }); K.oct(0, 1.4, 0, 0.3, 0.6, P.l || '#E05CFF', null, { e: 2.4, anim: bob }); }
  else if (fac === 'tessara') { /* esporo: bola de fibra cor de osso com poros acesos, que flutua e gira devagar */
    const gi = { t: 'spin', p: [0, 0, 0], speed: 0.6 }; K.sph(0, 0, 0, 2.3, P.a || '#CFC3AA', 'bone', { seg: 10, anim: gi }); for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, y = (i % 2 ? 0.9 : -0.6); K.sph(Math.cos(a) * 2.1, y, Math.sin(a) * 2.1, 0.55, P.l || '#7FE3A1', null, { e: 2.8, seg: 6, anim: gi }); } K.sph(0, 2.2, 0, 0.6, P.l || '#7FE3A1', null, { e: 2.6, seg: 6, anim: gi });
    for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2 + 0.5; K.seg([Math.cos(a) * 1.3, -1.2, Math.sin(a) * 1.3], [Math.cos(a) * 1.7, -3.0, Math.sin(a) * 1.7], 0.12, P.g || '#A9E3BA', 'skin', { anim: gi }); } }
  else if (fac === 'quorith') { /* cristal-mensageiro: um cristal duplo que gira, com o anel aceso */
    const gi = { t: 'spin', p: [0, 0, 0], speed: 1.4 }; K.oct(0, -2.0, 0, 1.0, 4.0, P.a || '#C9BFEA', 'crystal', { anim: gi }); K.oct(0, -0.6, 0, 0.42, 1.2, P.c || '#B388FF', null, { e: 2.6, anim: gi }); K.tor(0, 0, 0, 1.8, 0.1, P.l || '#DCCBFF', null, { e: 2.2, ts: 6, anim: gi }); }
  else { /* larva: quatro gomos de quitina que rastejam balançando, com os pontos vermelhos acesos */
    const ba = { t: 'sway', p: [1.6, 0, 0], amp: 0.22, speed: 6 }; for (let i = 0; i < 4; i++) { const x = 2.4 - i * 1.6, r = 1.15 - Math.abs(i - 1.2) * 0.18; K.sph(x, r * 0.8, 0, r, i % 2 ? (P.a || '#5C2B37') : (P.b || '#7C3546'), 'chitin', { seg: 9, sy: 0.8, anim: i < 2 ? null : ba }); K.sph(x, r * 1.35, 0, 0.18, P.l || '#FF5A5A', null, { e: 2, seg: 5, anim: i < 2 ? null : ba }); }
    K.sph(3.4, 0.7, 0, 0.6, P.bo || '#E8DCC8', 'bone', { seg: 7 }); }
  return K.fim();
}
const VOA = { vehnar: 0, erevane: 1, tessara: 1, quorith: 1, vorag: 0 };
const VEL = { vehnar: 26, erevane: 34, tessara: 9, quorith: 22, vorag: 7 };

/* ---------- ligação com o render3d (criada uma vez por partida, no create) ---------- */
B.criar = function (ctx) {
  const R = ctx.R, S = ARD.sim; const M = { ctx, rep: {}, mods: new Map(), trab: new Map(), anel: new Map(), anelL: [], anelT: -9, anelE: -1, workers: [], v: [0, 0, 0, 0, 0, 0, 0, 0, 0] };
  B.atual = M; M.vida = B.vida; /* o render3d chama BASE.vida no animFor */
  /* aquecimento (R.warm, antes do compile): as peças de cada Raça em jogo nascem na carga, escondidas */
  M.aquecer = function (sim) {
    const W1 = new (window.THREE.Color)(1, 1, 1);
    for (const p of sim.players) { const fac = p.faction; if (!RACA[fac] || M.rep[fac] != null) continue; M.rep[fac] = p.id;
      if (B.modulos) for (const def of ['reator', 'quartel', 'torre']) { const hull = def === 'torre' ? 'torre_base' : def; const g0 = ctx.geoOf(hull, p.id, 0); if (!g0 || !g0.width) continue;
        const g = pecaModulo(def, fac, g0.width, g0.height, g0.mount); if (!g) continue; const key = 'mod_' + def; R.geos.set(key + '|' + p.id + '|0', g); const it = ctx.instOf(key, p.id, 0); if (it) { M.mods.set(def + '|' + fac, it); if (it.main) it.main.setColorAt(0, W1); if (it.em) it.em.setColorAt(0, W1); } }
      { const g = trabalhador(fac); if (g) { const key = 'vida_' + fac; R.geos.set(key + '|' + p.id + '|0', g); const it = ctx.instOf(key, p.id, 0); if (it) { M.trab.set(fac, it); for (const mm of [it.main, it.em]) if (mm) { mm.castShadow = false; mm.setColorAt(0, W1); } } } } }
  };
  /* uma construção à vista, depois do put dela: a peça do módulo (pronta ou subindo) e as partículas da avaria da Raça */
  M.predio = function (e, wx, wy, fit, g, hpf, sim, own) {
    const p = sim.players[e.owner]; const fac = p ? p.faction : null; if (!RACA[fac]) return; const st = ctx.AN.get(e.id); const v = st && st.v ? st.v : ZERO9;
    if (B.modulos && (e.mod === 1 || e.upT > 0)) { const it = M.mods.get(e.def + '|' + fac); if (it) { const md = S.BUILDINGS[e.def].module; const pr = e.mod === 1 ? 1 : Math.max(0, Math.min(1, 1 - e.upT / ((md && md.time) || 15)));
      const tint = hpf < 0.33 ? 0.62 : hpf < 0.66 ? 0.85 : 1; ctx.put(it, wx, wy, 0, 0, fit, 0.12 + 0.88 * pr, tint, v); B.est.modulos++;
      if (pr < 1 && ctx.FX && !R.paused && Math.random() < 0.3 * R.quality.particles) { const c = FAISCA[fac] || FAISCA.vehnar; const a = Math.random() * 6.283, gx = wx + g.width * fit * 0.44 + Math.cos(a) * 4, gy = wy + g.width * fit * 0.3 + Math.sin(a) * 4; ctx.FX.spark(gx, ctx.H(gx, gy) + g.height * fit * 0.4 * pr + 2, -gy, c, 30, 2); } } }
    if (B.avaria && hpf < 0.45 && ctx.FX && !R.paused) { B.est.avariadas++; const pp = R.quality.particles; const k = (0.45 - hpf) / 0.45; const top = g.height * fit; const hs = ((e.id * 0.7548) % 1) - 0.5, hz = ((e.id * 0.5698) % 1) - 0.5; const sx = wx + hs * e.r * 1.1, sy = wy + hz * e.r * 1.1, gy = ctx.H(wx, wy);
      if (Math.random() < 0.16 * pp * k) { const c = AVC[fac]; if (fac === 'vehnar') ctx.FX.spark(sx, gy + top * (0.4 + 0.4 * Math.random()), -sy, c, 34, 3);
        else if (fac === 'erevane') ctx.FX.spark(sx, gy + top * (0.3 + 0.5 * Math.random()), -sy, c, 26, 2);
        else if (fac === 'tessara') ctx.FX.smoke(sx, gy + top * 0.6, -sy, c, 2.6, 7, 4);
        else if (fac === 'quorith') ctx.FX.spark(sx, gy + top * (0.4 + 0.4 * Math.random()), -sy, c, 22, 3);
        else ctx.FX.glow(sx, gy + top * (0.2 + 0.3 * Math.random()), -sy, c, 2.5 + Math.random() * 2, 0.5 + Math.random() * 0.4, 6); }
      if (Math.random() < 0.1 * pp * k) ctx.FX.smoke(sx, gy + top * (0.7 + 0.3 * Math.random()), -sy, fac === 'tessara' ? FUM_T : FUM, 3 + Math.random() * 2, 12 + Math.random() * 6, 4 + e.r * 0.12); }
  };
  /* fim do laço: os trabalhadores de cada base à vista, indo de uma construção à vizinha (a ordem é a do ângulo em volta do centro da base) */
  M.fim = function (sim, dt, human, vis) {
    const nv = B.nivel != null ? B.nivel : 1; const toque = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches; let por = nv === 0 ? 0 : nv === 1 ? (toque ? 2 : 3) : nv === 2 ? 5 : 7; if (B.vidaN != null && B.vidaN !== '') por = Math.max(0, Math.min(12, +B.vidaN | 0)); if (!por || !M.trab.size) return;
    if (R.time - M.anelT > 0.5 || R.time < M.anelT || (sim.ents.length !== M.anelE && R.time - M.anelT > 0.09)) { M.anelT = R.time; M.anelE = sim.ents.length; /* a cada 0,5 s, ou 0,1 s depois que entra ou sai entidade (numa batalha os projéteis mudam a lista a todo quadro: no máximo 10 por segundo) */ for (let i = 0; i < M.anelL.length; i++) M.anelL[i].n = 0;
      for (const e of sim.ents) { if (!e.alive || e.kind !== 'building' || !e.built) continue; const bd = S.BUILDINGS[e.def]; if (!bd || bd.wall) continue; if (e.owner !== human && !vis.has(e.id)) continue;
        let a = M.anel.get(e.owner); if (!a) { a = { pid: e.owner, n: 0, b: [], cx: 0, cy: 0 }; M.anel.set(e.owner, a); M.anelL.push(a); } const o = a.b[a.n] || (a.b[a.n] = { x: 0, y: 0, r: 0, h: 0, ang: 0 }); o.x = e.x; o.y = e.y; o.r = e.r; o.ang = 0; a.n++; }
      for (let ai = 0; ai < M.anelL.length; ai++) { const a = M.anelL[ai]; if (a.n < 2) continue; let cx = 0, cy = 0; for (let i = 0; i < a.n; i++) { cx += a.b[i].x; cy += a.b[i].y; } cx /= a.n; cy /= a.n; a.cx = cx; a.cy = cy; for (let i = 0; i < a.n; i++) a.b[i].ang = Math.atan2(a.b[i].y - cy, a.b[i].x - cx); a.b.length = a.n; a.b.sort(ORD_ANG); } }
    const sp = R.paused ? 0 : dt; let w = 0;
    for (let ai = 0; ai < M.anelL.length; ai++) { const a = M.anelL[ai], pid = a.pid; if (a.n < 2) continue; const p = sim.players[pid]; /* por índice: sem iterador por quadro */ const fac = p && p.faction; const it = M.trab.get(fac); if (!it) continue; const falta = B.falta[pid] || 0; const n = Math.min(por, Math.max(1, Math.floor(a.n / 2)));
      for (let k = 0; k < n; k++) { const wk = M.workers[w] || (M.workers[w] = { ph: Math.random() * 7, od: 0, pid: -1, v: [0, 0, 0, 0, 0, 0, 0, 0, 0] }); w++; if (wk.pid !== pid) { wk.pid = pid; wk.ph = (k * 2.37 + pid * 1.13) % a.n; }
        const i0 = Math.floor(wk.ph) % a.n, i1 = (i0 + 1) % a.n; const A = a.b[i0], Bb = a.b[i1]; let dx = Bb.x - A.x, dy = Bb.y - A.y; const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl;
        const x0 = A.x + dx * (A.r + 8), y0 = A.y + dy * (A.r + 8), x1 = Bb.x - dx * (Bb.r + 8), y1 = Bb.y - dy * (Bb.r + 8); const len = Math.max(8, Math.hypot(x1 - x0, y1 - y0));
        const vel = VEL[fac] * (1 - 0.75 * falta); const f = wk.ph - Math.floor(wk.ph); const e2 = f * f * (3 - 2 * f); const lat = Math.sin(f * Math.PI) * (k % 2 ? 10 : -10);
        const x = x0 + (x1 - x0) * e2 - dy * lat, y = y0 + (y1 - y0) * e2 + dx * lat; const z = VOA[fac] ? 20 + 8 * Math.sin(f * Math.PI) + (fac === 'tessara' ? 4 * Math.sin(R.time * 0.7 + k) : 0) : 0;
        if (fac === 'vorag') { /* a larva rasteja em volta da construção de partida, devagar */ const ang = R.time * vel / (A.r + 9) * (k % 2 ? 1 : -1) + k * 2.1; const lx = A.x + Math.cos(ang) * (A.r + 9), ly = A.y + Math.sin(ang) * (A.r + 9); wk.od += vel * sp; const v = wk.v; v[0] = wk.od; v[1] = R.time + k; v[2] = 1 - falta * 0.7; v[3] = 0; v[4] = 0; v[5] = 0; v[6] = falta; v[7] = 0; v[8] = RACA[fac] + 0.05 + 0.9 * hash(k + pid * 31);
          ctx.put(it, lx, ly, 0, ang + (k % 2 ? Math.PI / 2 : -Math.PI / 2), 1, 1, 1, v); }
        else { const v = wk.v; wk.od += vel * sp; v[0] = wk.od; v[1] = R.time + k * 1.7; v[2] = 1 - falta * 0.7; v[3] = 0; v[4] = R.time * (1 - falta * 0.6); v[5] = 0; v[6] = falta; v[7] = 0; v[8] = RACA[fac] + 0.05 + 0.9 * hash(k + pid * 31);
          ctx.put(it, x, y, z, Math.atan2(y1 - y0, x1 - x0), 1, 1, 1, v); }
        wk.ph += vel * sp / len; if (wk.ph >= a.n) wk.ph -= a.n; B.est.vida++; } }
  };
  return M;
};
const ORD_ANG = (u, w) => u.ang - w.ang;
const AVC = { vehnar: [1.7, 1.15, 0.45], erevane: [0.6, 2.0, 1.9], tessara: [0.32, 0.62, 0.22], quorith: [1.7, 1.2, 2.6], vorag: [0.7, 1.5, 0.2] }, FUM = [0.07, 0.065, 0.065], FUM_T = [0.12, 0.1, 0.07]; /* cores das partículas da avaria (criadas uma vez) */
const FAISCA = { vehnar: [1.8, 1.25, 0.5], erevane: [0.6, 2.0, 1.9], tessara: [0.8, 1.8, 0.6], quorith: [1.7, 1.3, 2.6], vorag: [1.9, 0.7, 0.4] };
B.pecaModulo = pecaModulo; B.trabalhador = trabalhador; /* ferramentas de teste */
/* ?m5basems=1: ms de CPU somados em B.ms (vida, predio, fim, quadro) e quadros em B.ms.n; média por quadro = soma / n (só para medir) */
if (MEDE) { const now = () => performance.now(); const embrulha = (o, k) => { const f = o[k]; o[k] = function () { const t = now(); try { return f.apply(this, arguments); } finally { B.ms[k] += now() - t; } }; };
  embrulha(B, 'vida'); const cr = B.criar; B.criar = function () { const M = cr.apply(this, arguments); M.vida = B.vida; embrulha(M, 'predio'); embrulha(M, 'fim'); return M; };
}
})(globalThis.ARD = globalThis.ARD || {});
