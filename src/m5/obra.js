/* Aether Rift: Dominion — Motor 5 (5.0e): Obra 2.0. Só visual: lê o progresso da obra que a simulação já tem (e.progress, e.built) e só desenha.
   A construção em obra é desenhada inteira, no tamanho final, e sobe por um corte com a borda no estilo da Raça:
   - o corte é feito no vértice do material dos modelos (o mesmo shader e o mesmo pipeline de toda unidade e construção): o que está acima do
     corte desce até ele e vira a tampa da obra (sem discard, que tiraria o teste de profundidade antecipado de todo modelo, e sem material novo);
   - a altura do corte vem de um atributo por instância que os modelos já têm (aInst, o da animação por peça): na obra ele leva
     [fase, progresso, altura do modelo, −(1 + estilo)] e a animação das peças fica parada (aInst.w < −0,5 marca a obra);
   - a borda e a tampa acendem no fragmento dos modelos e da parte emissiva (as duas acendem igual, então a tampa não pisca onde as duas se cruzam):
     Vehnar: solda (fio branco, brilho laranja que esfria e a tampa de metal derretido); Erevane: trama de luz (linhas que sobem e uma grade na tampa;
     o holograma da planta só aparece acima do corte); Tessara: crescimento orgânico (a frente sobe irregular, puxada pelas veias que pulsam);
     Quorith: cristal que se acumula (a frente sobe em facetas, cada uma no seu tempo, e se fecha no fim); Vorag: biomassa que borbulha (a frente
     ondula e a tampa ferve em bolhas);
   - as faíscas e partículas da obra vão para o conjunto de partículas em compute de src/m5/destrocos.js (um desenho só para todas as obras e os
     destroços); ao concluir, uma onda no chão em volta da construção (as mesmas partículas, rentes ao relevo) e, na Alta e na Ultra, um anel de
     refração (src/m5/destrocos.js).
   Os invólucros da 4.3f: o andaime (Vehnar) fica (é o material dos modelos: nenhum pipeline); o holograma (Erevane) fica, cortado; o casulo
   (Tessara e Vorag) e a coroa de cristais (Quorith) saem no Motor 5 (eram um pipeline cada e o corte faz o papel deles).
   Chaves: ?obra5=0 volta à obra da 5.0d (invólucros e degraus); ?faiscas5=0 tira as partículas da obra; ?onda5=0 tira a onda ao concluir. */
(function (ARD) {
'use strict';
const M5 = ARD.m5 = ARD.m5 || {};
const QS = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
const L = () => window.TSL;
const LIGADA = QS.get('obra5') !== '0', FAISCAS = QS.get('faiscas5') !== '0', ONDA = QS.get('onda5') !== '0';
const ESTILO = { vehnar: 0, erevane: 1, tessara: 2, quorith: 3, vorag: 4 };
const O = M5.obra = { versao: '5.0e', ativo: LIGADA, ESTILO };

/* ---------- funções do shader (WGSL/GLSL, criadas uma vez): o corte (vértice) e a cor da borda e da tampa (fragmento) ----------
   Sem uniform no vértice nem no fragmento (o relógio vem do atributo por instância): no r186 um uniform do bloco por objeto usado nos dois
   estágios do mesmo material entra duas vezes no bloco e o fragmento lê um valor parado (achado da 5.0d) */
let F = null;
function fns() {
  if (F) return F; const TL = L(); const { Fn, If, float, vec2, vec3, vec4, floor, fract, sin, cos, abs, min, max, mix, pow, clamp, smoothstep } = TL;
  const R0 = M5.modelos && M5.modelos.ruidos ? M5.modelos.ruidos() : null; /* os ruídos do src/m5/modelos.js (ardH2, ardVN): as mesmas funções do detalhe de superfície, sem cópia no WGSL */
  const H2 = R0 ? R0.H2 : Fn(([p]) => fract(sin(p.x.mul(127.1).add(p.y.mul(311.7))).mul(43758.5453))).setLayout({ name: 'ardObH2', type: 'float', inputs: [{ name: 'p', type: 'vec2' }] });
  const VN = R0 ? R0.VN : Fn(([p]) => { const i = floor(p).toVar(), f = fract(p).toVar(), u = f.mul(f).mul(f.mul(-2).add(3)).toVar(); return mix(mix(H2(i), H2(i.add(vec2(1, 0))), u.x), mix(H2(i.add(vec2(0, 1))), H2(i.add(vec2(1, 1))), u.x), u.y); }).setLayout({ name: 'ardObVN', type: 'float', inputs: [{ name: 'p', type: 'vec2' }] });
  /* altura do corte no espaço do modelo: sobe com o progresso (de logo abaixo do chão a um pouco acima do topo); a frente ondula pela Raça, com a
     ondulação nula no começo e no fim (a obra pronta sai inteira, igual à construção acabada) */
  const corte = Fn(([pg, aI]) => {
    const Hm = max(aI.z, 0.5).toVar(), p = clamp(aI.y, 0, 1).toVar(), s = aI.w.negate().sub(1).toVar();
    const q = pg.xz.div(Hm).toVar(); const m = float(0).toVar();
    If(s.greaterThan(1.5), () => {
      If(s.lessThan(2.5), () => { /* Tessara: a frente sobe irregular e as veias puxam na frente */
        const v = abs(sin(q.x.mul(7.3).add(sin(q.y.mul(5.1)).mul(1.7))).mul(sin(q.y.mul(6.7).add(cos(q.x.mul(4.3)).mul(1.6)))));
        m.assign(VN(q.mul(3.2)).sub(0.5).mul(0.14).add(float(1).sub(smoothstep(0, 0.25, v)).mul(0.08)));
      }).ElseIf(s.lessThan(3.5), () => { /* Quorith: facetas, cada uma no seu tempo */
        m.assign(H2(floor(q.mul(3.4).add(vec2(0.37, 0.11)))).sub(0.5).mul(0.26));
      }).Else(() => { /* Vorag: a frente ondula (biomassa) */
        m.assign(sin(aI.x.mul(2.3).add(VN(q.mul(4.1)).mul(6.283))).mul(0.035).add(VN(q.mul(2.6).add(aI.x.mul(0.25))).sub(0.5).mul(0.09)));
      });
    });
    const k = smoothstep(0, 0.12, p).mul(float(1).sub(smoothstep(0.82, 0.97, p)));
    return p.mul(1.04).sub(0.02).add(m.mul(k)).mul(Hm);
  }).setLayout({ name: 'ardObCorte', type: 'float', inputs: [{ name: 'pg', type: 'vec3' }, { name: 'aI', type: 'vec4' }] });
  /* linha fina nos inteiros de x */
  const fio = (x, w) => float(1).sub(smoothstep(0, w, abs(fract(x.add(0.5)).sub(0.5))));
  /* cor da obra no fragmento: v = o varying ardObra [distância ao corte ÷ altura (≤ 0), código (1 + 2·estilo + progresso), fase, tampa], wp = posição
     no mundo; devolve [emissivo rgb, multiplicador do albedo]. Fora da obra (código 0) devolve [0, 0, 0, 1] sem calcular nada */
  const cor = Fn(([v, wp]) => {
    const r = vec4(0, 0, 0, 1).toVar();
    If(v.y.greaterThan(0.5), () => {
      const c = v.y.sub(1).toVar(), s = floor(c.mul(0.5).add(0.001)).toVar(), p = c.sub(s.mul(2)).toVar();
      const d = max(v.x.negate(), 0).toVar(), cap = clamp(v.w, 0, 1).toVar(), t = v.z.toVar();
      const parede = float(1).sub(cap); /* na tampa a distância ao corte é 0: o fio e a faixa são só das paredes (sem isto a tampa inteira virava o fio branco) */
      const faixa = float(1).sub(smoothstep(0, 0.075, d)).mul(parede).toVar(), linha = float(1).sub(smoothstep(0, 0.012, d)).mul(parede).toVar();
      const em = vec3(0).toVar(), dm = float(1).toVar();
      If(s.lessThan(0.5), () => { /* Vehnar: solda — fio branco, brilho laranja que esfria para baixo e a tampa de metal derretido com crosta */
        const fl = sin(t.mul(37).add(wp.x.mul(0.9)).add(wp.z.mul(1.3))).mul(0.15).add(0.85);
        const veio = float(1).sub(smoothstep(0.02, 0.09, abs(VN(wp.xz.mul(0.35).add(vec2(t.mul(0.11), t.mul(-0.07)))).sub(0.5)))); /* veios de metal derretido na crosta escura */
        em.assign(vec3(3.2, 2.0, 1.1).mul(linha.mul(fl)).add(vec3(1.4, 0.4, 0.07).mul(faixa.mul(faixa).mul(fl))).add(vec3(0.3, 0.07, 0.015).add(vec3(1.9, 0.62, 0.1).mul(veio.mul(fl))).mul(cap)));
        dm.assign(float(1).sub(max(cap, faixa.mul(faixa)).mul(0.88)));
      }).ElseIf(s.lessThan(1.5), () => { /* Erevane: trama de luz — linhas que sobem e a grade da planta; a matéria entra por linhas */
        const ly = fio(wp.y.mul(0.62).sub(t.mul(0.8)), 0.09), la = fio(wp.x.add(wp.z).mul(0.13), 0.05), lb = fio(wp.x.sub(wp.z).mul(0.13), 0.05);
        const grade = max(la, lb); const trama = max(ly, grade.mul(0.7)); /* tampa de vidro escuro com a grade da planta, rala (a tampa inteira acesa estourava no bloom) */
        em.assign(vec3(0.25, 1.5, 1.3).mul(linha.mul(2.2).add(faixa.mul(trama).mul(0.9)).add(faixa.mul(0.08))).add(vec3(0.03, 0.16, 0.15).add(vec3(0.25, 1.3, 1.15).mul(grade.mul(0.75))).mul(cap)));
        dm.assign(float(1).sub(faixa.mul(0.75)).mul(float(1).sub(cap.mul(0.9))));
      }).ElseIf(s.lessThan(2.5), () => { /* Tessara: veias verdes que pulsam e sobem na frente; a tampa é polpa úmida */
        const vv = abs(sin(wp.x.mul(0.21).add(sin(wp.y.mul(0.17).add(wp.z.mul(0.13))).mul(1.7))).mul(sin(wp.z.mul(0.19).add(cos(wp.y.mul(0.11).sub(wp.x.mul(0.07))).mul(1.6)))));
        const veia = float(1).sub(smoothstep(0, 0.09, vv)); const pulso = sin(t.mul(3).sub(wp.y.mul(0.2))).mul(0.4).add(0.6);
        em.assign(vec3(0.45, 1.5, 0.55).mul(veia.mul(pulso).mul(faixa).mul(1.4)).add(vec3(0.35, 0.9, 0.4).mul(linha.mul(0.8))).add(vec3(0.1, 0.26, 0.08).add(vec3(0.5, 1.6, 0.55).mul(veia.mul(pulso))).mul(cap)));
        dm.assign(float(1).sub(faixa.mul(0.55)).sub(cap.mul(0.4)));
      }).ElseIf(s.lessThan(3.5), () => { /* Quorith: facetas com aresta acesa que brilham cada uma no seu tempo */
        const cc = vec2(wp.x.add(wp.z), wp.x.sub(wp.z)).mul(0.13).add(vec2(0, wp.y.mul(0.07))); const f = fract(cc), id = floor(cc);
        const aresta = float(1).sub(smoothstep(0, 0.06, min(min(f.x, float(1).sub(f.x)), min(f.y, float(1).sub(f.y)))));
        const brilho = pow(sin(t.mul(2.1).add(H2(id).mul(6.283))).mul(0.5).add(0.5), 6);
        em.assign(vec3(1.2, 0.7, 2.4).mul(linha.mul(1.6).add(faixa.mul(aresta).mul(1.1)).add(faixa.mul(0.08))).add(vec3(0.22, 0.12, 0.45).mul(brilho.mul(1.3).add(0.4)).add(vec3(0.8, 0.5, 1.6).mul(aresta.mul(0.7))).mul(cap)));
        dm.assign(float(1).sub(faixa.mul(0.45)).sub(cap.mul(0.5)));
      }).Else(() => { /* Vorag: biomassa — bolhas com a borda acesa que fervem na frente e na tampa */
        const b = VN(wp.xz.mul(0.32).add(vec2(t.mul(0.15), t.mul(0.4))));
        const bolha = smoothstep(0.6, 0.68, b).mul(float(1).sub(smoothstep(0.72, 0.8, b))); const pulso = sin(t.mul(5.5).sub(wp.y.mul(0.3))).mul(0.4).add(0.6);
        em.assign(vec3(1.5, 0.18, 0.25).mul(linha.mul(1.4).add(faixa.mul(bolha).mul(pulso).mul(1.5))).add(vec3(0.45, 0.04, 0.07).add(vec3(1.6, 0.25, 0.3).mul(bolha.mul(pulso))).mul(cap)));
        dm.assign(float(1).sub(faixa.mul(0.5)).sub(cap.mul(0.55)));
      });
      const fim = float(1).sub(smoothstep(0.9, 0.995, p)); /* o brilho apaga no fim da obra: a construção pronta entra sem salto */
      r.assign(vec4(em.mul(fim), mix(float(1), max(min(dm, float(1).sub(cap.mul(0.94))), 0.04), fim))); /* na tampa o albedo quase some: o casco e a parte emissiva, que se cruzam ali, saem com a mesma cor */
    });
    return r;
  }).setLayout({ name: 'ardObCor', type: 'vec4', inputs: [{ name: 'v', type: 'vec4' }, { name: 'wp', type: 'vec3' }] });
  F = { corte, cor, H2, VN };
  return F;
}

/* ---------- vértice (src/m5/modelos.js chama dentro do passo prévio da animação, no espaço do modelo, antes da instância; a sombra roda o mesmo) ---------- */
O.vertice = function (aI) {
  const { If, Var, vec3, positionGeometry, positionLocal, normalLocal } = L(); const f = fns();
  If(aI.w.lessThan(-0.5), () => { const yc = Var(f.corte(positionGeometry, aI), 'ardOc');
    If(positionLocal.y.greaterThan(yc), () => { positionLocal.assign(vec3(positionLocal.x, yc, positionLocal.z)); normalLocal.assign(vec3(0, 1, 0)); }); });
};
/* a obra pede a animação parada (as peças não giram nem recuam com o atributo da obra) */
O.parada = aI => aI.w.greaterThan(-0.5);
/* ---------- varying do fragmento (um por material, como a queda da ruína): calculado no vértice só dos atributos; na ruína e em quem não tem
   aInst vale 0 (o mesmo fragmento) ---------- */
O.varying = function (ctx) {
  if (ctx.ardObra) return ctx.ardObra; const { Fn, If, varying, vec4, float, min, max, clamp, select, positionGeometry } = L(); const f = fns();
  const aI = M5.attr('aInst', vec4(0, 0, 0, 0));
  const ex = Fn(() => { const r = vec4(0, 0, 0, 0).toVar('ardObV'); /* fora da obra (quase todo vértice) nem chama o corte */
    If(aI.w.lessThan(-0.5), () => { const Hm = max(aI.z, 0.5); const yc = f.corte(positionGeometry, aI).toVar('ardObVc'); const y = positionGeometry.y; const s = aI.w.negate().sub(1);
      r.assign(vec4(min(y.sub(yc), 0).div(Hm), s.mul(2).add(1).add(clamp(aI.y, 0, 1).mul(0.98)), aI.x, select(y.greaterThan(yc), float(1), float(0)))); });
    return r; })();
  ctx.ardObra = varying(ex, 'ardObra'); return ctx.ardObra;
};
/* [emissivo rgb, multiplicador do albedo] do fragmento */
O.cor = function (ctx) { const f = fns(); return f.cor(O.varying(ctx), L().positionWorld); };

/* ---------- CPU: o atributo da obra e as partículas (src/render3d.js chama no desenho de cada construção em obra) ----------
   devolve o vetor [fase, progresso, altura, −(1 + estilo), 0] para o put (reaproveitado: o put copia na hora) ou null (obra da 5.0d) */
const IA = [0, 0, 0, 0, 0];
const TAXA = [40, 16, 12, 14, 12]; /* partículas por segundo e por construção: faíscas, luzes, esporos, cristais, gosma */
const TIPO = [2, 3, 4, 5, 6];
const COR = [[2.6, 1.4, 0.45], [0.35, 2.0, 1.75], [0.75, 1.8, 0.6], [1.5, 0.95, 2.6], [0.42, 0.04, 0.06]];
O.poe = function (e, fac, pr, g, fit, wx, wy, gy, tempo, dt, R) {
  if (!LIGADA || !g) return null; const s = ESTILO[fac] != null ? ESTILO[fac] : 0;
  IA[0] = tempo + (e.id % 97) * 0.731; IA[1] = Math.min(1, Math.max(0, pr)); IA[2] = Math.max(0.5, g.height || 1); IA[3] = -(1 + s); IA[4] = 0;
  const D = M5.destrocos;
  if (FAISCAS && D && D.ligado() && dt > 0) { const q = R && R.quality ? R.quality.particles : 1; const n0 = TAXA[s] * dt * q * D.mult * Math.min(1.6, Math.max(0.6, (e.r || 20) / 22)); let n = Math.floor(n0); if (Math.random() < n0 - n) n++;
    if (n > 0) { const W = g.width * fit, Hw = g.height * fit, yc = gy + Math.max(0.5, (IA[1] * 1.04 - 0.02) * Hw); const c = COR[s];
      if (s === 4) D.emite(6, s, wx, yc, -wy, n, 0.9, 0, W * 0.4, 0, D.cor(c[0], c[1], c[2]), 1.1); /* Vorag: gosma em cima da tampa */
      else D.emite(TIPO[s], s, wx, yc, -wy, n, s === 0 ? 0.55 : s === 3 ? 0.7 : 0.6, 0, W * 0.47, s === 1 ? Hw * 0.12 : Hw * 0.04, D.cor(c[0], c[1], c[2]), s === 0 ? 0.9 : s === 2 ? 2.6 : 1.5); } }
  return IA;
};
/* altura do corte do holograma da Erevane (espaço do modelo): a mesma conta do shader sem a ondulação (a frente da Erevane é reta) */
O.corteHolo = (pr, h) => (Math.min(1, Math.max(0, pr)) * 1.04 - 0.02) * h;
/* ---------- ao concluir: a onda no chão (partículas rentes ao relevo) e, na Alta e na Ultra, um anel de refração ---------- */
const CORONDA = [[2.2, 1.2, 0.4], [0.35, 1.9, 1.7], [0.7, 1.8, 0.6], [1.5, 0.9, 2.5], [1.9, 0.3, 0.38]];
O.concluiu = function (x, y, gy, rb, fac) {
  if (!LIGADA || !ONDA) return; const D = M5.destrocos; if (!D) return; const s = ESTILO[fac] != null ? ESTILO[fac] : 0; const c = CORONDA[s];
  if (D.ligado()) D.emite(7, s, x, gy + 0.4, -y, Math.round(Math.min(200, 90 + rb * 2) * Math.min(1, D.mult)), 1.6 + rb * 0.03, 95 + rb * 1.2, rb * 0.95, 0, D.cor(c[0], c[1], c[2]), 1.0);
  if (D.calor) D.calor(x, gy + rb * 0.3, -y, rb * 3.2, 1, 0.55, 0.7);
};
})(globalThis.ARD = globalThis.ARD || {});
