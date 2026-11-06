/* Aether Rift: Dominion — 5.0g (agente g-visual): os chefões na tela. Só desenha: lê o contrato da simulação (e.boss, e.parte, sim.avisos, os
   eventos 'chefe' e 'aviso', S.BOSSES, S.bossOf) e nunca escreve nela.
   - Modelos: ARD.chefes.modelo(e) escolhe a variante do src/chefes-modelos.js pela fase (o render3d troca o def do desenho por ela); as cópias
     espectrais (e.eco ou e.espectro com o dono original) usam o modelo da unidade com o material fantasma, na cor do dono original.
   - Chão (um desenho só para tudo, nos dois motores): a telegrafia de sim.avisos (anel que enche, faixa que acende, sombra que cresce e poço
     que puxa; o preenchimento é o tempo até t1, em âmbar e vermelho de perigo, com borda escura) e as marcas do chefão (vidro sob o Arauto,
     metal derretido no rastro da Forja, elo aceso dos pilares). Malha deitada no relevo (a altura é lida na CPU quando um aviso nasce),
     posições fixas por vaga: nada é recalculado por quadro, só o relógio (uniform). Motor 5: MeshBasicNodeMaterial (TSL) = 1 pipeline, criado
     na carga só quando a partida tem chefão ou evento. Clássico: ShaderMaterial. 2D: o mesmo desenho no canvas.
   - 3D extra (src/render3d.js chama R.chefe3d.quadro): as quatro pernas da Forja (cada uma cai quando a parte morre), as marcas dos pontos
     fracos, fumaça das chaminés, solda, brasas do núcleo e a luz do Arauto no chão (mapa de clarões).
   - Interface: barra do chefe no alto (nome, título, marcas das fases, escudo, pontos fracos que restam), aviso de fase nova e da janela de
     dano, nos três idiomas. Apresentação: a entrada pelo ARD.cinema.chefe, a luz da cena por fase (R.tintChefe, um tom leve que nunca
     escurece) e a música ARD.musica.cena('chefao') enquanto o chefão vive.
   Chaves de URL: ?chefevfx=0 (sem as marcas do chefão no chão nem fumaça/solda/brasas: só a telegrafia e o modelo), ?chefeluz=0 (sem a luz
   por fase), ?chefebarra=0 (sem a barra). Qualidade: na Baixa (e no celular) menos marcas no chão e sem fumaça. */
(function (ARD) {
'use strict';
const Q = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
const liga = (k, d) => (Q.get(k) == null ? d : Q.get(k) !== '0');
const T = (k, v, r) => (ARD.t ? ARD.t(k, v, r) : String(r != null ? r : k));
const S = () => ARD.sim;
const TOQUE = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
const CH = ARD.chefes = { versao: '5.0g', chaves: { vfx: liga('chefevfx', true), luz: liga('chefeluz', true), barra: liga('chefebarra', true) } };
const TIPOS_AVISO = { anel: 0, faixa: 1, sombra: 2, poco: 3, vidro: 4, metal: 5, elo: 6 };

/* ---------- leitura do contrato ---------- */
CH.temChefe = sim => !!sim && ((sim.fenda != null && sim.fenda >= 0) || !!(sim.cacada) || !!(sim.cfg && (sim.cfg.cacada || sim.cfg.eventos)));
CH.bossOf = function (sim) { const s = S(); if (s && typeof s.bossOf === 'function') { try { return s.bossOf(sim); } catch (e) { return null; } }
  let best = null; for (const e of sim.ents) if (e.alive && e.boss && (!best || e.maxHp > best.maxHp)) best = e; return best; };
const fase = e => Math.max(1, Math.min(3, (e.boss && e.boss.fase) | 0 || 1)); /* lido como 1, 2, 3 (0 conta como a 1) */
CH.ecoDono = function (e) { const v = e.eco != null ? e.eco : e.espectro; if (v == null || v === false) return -1; if (typeof v === 'number') return v; if (typeof v === 'object' && v.dono != null) return v.dono | 0; return -1; };
const PERNAS = new Map(); /* id do chefe → { vistas: já houve partes 'perna', vivas: máscara dos 4 cantos } (o 3D e o modelo leem) */
CH.modelo = function (e) {
  const b = e.boss; if (b) { const f = fase(e);
    if (b.tipo === 'arauto') return 'chefe_arauto_' + (b.janela ? 'j' : f);
    if (b.tipo === 'sentinela') return b.janela ? 'chefe_sentinela_j' : 'chefe_sentinela';
    if (b.tipo === 'forja') { const pg = PERNAS.get(e.id); return f >= 3 || (pg && pg.vistas && !pg.vivas) ? 'chefe_forja_caida' : f >= 2 ? 'chefe_forja_b' : 'chefe_forja'; }
    return null; }
  const p = e.parte; if (p) return p.tipo === 'pilar' ? 'chefe_pilar' : p.tipo === 'nucleo' ? 'chefe_nucleo' : 'chefe_junta';
  return null; };
const LARG = { arauto: 49, sentinela: 37, forja: 37 }; /* largura de referência por chefão: as variantes das fases ficam do mesmo tamanho */
CH.fit = (e, fit) => (e.boss && LARG[e.boss.tipo] ? 2 * e.r * 1.25 / LARG[e.boss.tipo] : fit);
CH.MODELOS = ['chefe_arauto_1', 'chefe_arauto_2', 'chefe_arauto_3', 'chefe_arauto_j', 'chefe_sentinela', 'chefe_sentinela_j', 'chefe_pilar', 'chefe_forja', 'chefe_forja_b', 'chefe_forja_caida', 'chefe_forja_perna', 'chefe_forja_perna_caida', 'chefe_junta', 'chefe_nucleo'];
const nomeDe = tipo => T('chefe.' + tipo + '.nome', null, tipo);
const tituloDe = tipo => T('chefe.' + tipo + '.titulo', null, '');
function limiares(tipo) { const s = S(); const B = s && s.BOSSES && s.BOSSES[tipo]; const fs = B && (B.fases || B.phases); const out = [];
  if (Array.isArray(fs)) for (const f of fs) { const l = f && (f.limiar != null ? f.limiar : f.hp != null ? f.hp : null); if (l != null && l > 0 && l < 1) out.push(l); }
  return out.length ? out : (tipo === 'sentinela' ? [0.5] : [0.66, 0.33]); }

/* ---------- aquecimento (R.prepare do render3d): modelos e a camada do chão nascem na carga, só com chefão ---------- */
CH.jobs = function (sim, jobs, lod, api) {
  if (!CH.temChefe(sim)) return; const pid = sim.fenda != null && sim.fenda >= 0 ? sim.fenda : -1;
  const RX = ARD.meshes && ARD.meshes.receitas, SU = S().UNITS; if (RX) for (const d in SU) if (SU[d] && SU[d].boss && !RX[d]) RX[d] = RX[/forja/.test(d) ? 'chefe_forja' : /sentinela/.test(d) ? 'chefe_sentinela' : 'chefe_arauto_1']; /* ícone do chefe pelo def da simulação */
  for (const k of CH.MODELOS) { jobs.push([k, pid, 0]); if (lod) jobs.push([k, pid, 0, true]); } jobs.push(['chefe_marca', pid, 0]); /* no material do dono do chefão (o neutro seria um pipeline a mais no Motor 5) */
  if (api && !api.R.chefe3d) { try { api.R.chefe3d = cria3d(api); } catch (err) { console.warn('[ARD] 5.0g: camada dos chefões indisponível: ' + err.message); } } };

/* ---------- o chão: telegrafia e marcas (malha de vagas, deitada no relevo) ---------- */
const GN = 20, GV = (GN + 1) * (GN + 1), GI = GN * GN * 6; /* grade de cada vaga */
function geoVagas(Tm, cap) {
  const pos = new Float32Array(cap * GV * 3), uv = new Float32Array(cap * GV * 2), d = new Float32Array(cap * GV * 4); d.fill(-1);
  const idx = new (cap * GV > 65535 ? Uint32Array : Uint16Array)(cap * GI); let k = 0;
  for (let s = 0; s < cap; s++) { const o = s * GV; for (let j = 0; j < GN; j++) for (let i = 0; i < GN; i++) { const a = o + j * (GN + 1) + i, b = a + 1, c = a + GN + 1, e = c + 1; idx[k++] = a; idx[k++] = b; idx[k++] = c; idx[k++] = b; idx[k++] = e; idx[k++] = c; } /* face para cima (o +v do mapa é o −z do three) */ }
  const g = new Tm.BufferGeometry(); const A = (arr, n) => { const at = new Tm.BufferAttribute(arr, n); at.setUsage && at.setUsage(Tm.DynamicDrawUsage); return at; };
  g.setAttribute('position', A(pos, 3)); g.setAttribute('aUV', A(uv, 2)); g.setAttribute('aD', A(d, 4)); g.setIndex(new Tm.BufferAttribute(idx, 1)); g.setDrawRange(0, GI); /* uma vaga vazia (descartada no fragmento) desde o início: o aquecimento compila o pipeline */
  g.boundingSphere = new Tm.Sphere(new Tm.Vector3(1600, 0, -1600), 4000); return g; }
/* GLSL (clássico): o mesmo desenho do TSL abaixo */
const GLSL_V = `attribute vec2 aUV; attribute vec4 aD; varying vec2 vUV; varying vec4 vD;
void main() { vUV = aUV; vD = aD; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const GLSL_F = `uniform float uT; varying vec2 vUV; varying vec4 vD;
const vec3 Y = vec3(1.0, 0.78, 0.12), RD = vec3(1.0, 0.16, 0.06), DK = vec3(0.015, 0.012, 0.01);
float linha(float d, float px, float w) { return 1.0 - smoothstep(w, w + px * 1.2, d); }
void main() {
  float tipo = vD.x; if (tipo < -0.5) discard; float t0 = vD.y, t1 = vD.z, dur = max(t1 - t0, 0.05);
  float p = clamp((uT - t0) / dur, 0.0, 1.0), dep = uT - t1, ent = clamp((uT - t0) * 6.0, 0.0, 1.0);
  float rho = length(vUV), px = max(fwidth(rho), 0.002); vec3 col = vec3(0.0); float a = 0.0;
  if (tipo < 3.5 || tipo > 5.5) { /* avisos e o elo */
    float sai = tipo > 5.5 ? 1.0 : 1.0 - clamp(dep / 0.45, 0.0, 1.0); float flash = tipo > 5.5 ? 0.0 : clamp(1.0 - dep / 0.35, 0.0, 1.0) * step(0.0, dep);
    float dentro = 0.0, borda = 0.0, cheio = 0.0, frente = 0.0, listra = 0.0;
    if (tipo < 0.5 || tipo > 2.5 && tipo < 3.5) { /* anel (enche do centro) e poço (anéis que puxam para dentro) */
      dentro = step(rho, 1.0); borda = linha(abs(rho - 0.97), px, px * 1.6 + 0.012);
      float halo = linha(abs(rho - 0.97), px, px * 4.0 + 0.03) * (1.0 - borda);
      listra = step(0.5, fract((vUV.x + vUV.y) * 5.0 - uT * 0.6)) * step(0.86, rho) * dentro;
      if (tipo < 0.5) { cheio = step(rho, p) * dentro; frente = linha(abs(rho - p), px, px * 1.2 + 0.01) * dentro; }
      else { float an = fract(rho * 4.0 + uT * 1.6); cheio = (1.0 - smoothstep(0.0, 0.18, an)) * dentro * (0.35 + 0.65 * p); frente = linha(abs(rho - (1.0 - p)), px, px * 1.4 + 0.012) * dentro; }
      col = mix(DK, mix(Y, RD, p), 1.0 - step(0.5, halo)); a = halo * 0.55;
      vec3 cf = mix(Y, RD, p); col = mix(col, cf * 0.9, cheio * 0.7); a = max(a, cheio * (0.3 + 0.25 * p));
      col = mix(col, mix(Y, DK, 0.75), listra * 0.6); a = max(a, listra * 0.35);
      col = mix(col, vec3(1.0, 0.95, 0.75), frente); a = max(a, frente * 0.95);
      col = mix(col, Y * 1.25, borda); a = max(a, borda);
    } else if (tipo < 1.5 || tipo > 5.5) { /* faixa (acende do começo ao fim) e elo (tracejado andando) */
      float u = vUV.x, v = abs(vUV.y), pxu = max(fwidth(u), 0.002), pxv = max(fwidth(v), 0.002); dentro = step(v, 1.0) * step(abs(u), 1.0);
      if (tipo > 5.5) { float tr = step(0.45, fract(u * vD.w * 0.5 - uT * 1.4)); float l = linha(v, pxv, 0.35) * dentro; col = vec3(0.5, 0.95, 1.1) * (0.6 + 0.6 * tr); a = l * (0.3 + 0.5 * tr); }
      else { borda = linha(abs(v - 0.96), pxv, pxv * 1.6 + 0.02) * step(abs(u), 1.0) + linha(abs(abs(u) - 0.985), pxu, pxu * 1.6 + 0.004) * step(v, 1.0);
        float halo = linha(abs(v - 0.96), pxv, pxv * 4.0 + 0.05) * step(abs(u), 1.0) * (1.0 - borda);
        cheio = step(u, p * 2.0 - 1.0) * dentro; frente = linha(abs(u - (p * 2.0 - 1.0)), pxu, pxu * 1.4 + 0.004) * dentro;
        float chev = step(0.55, fract(u * vD.w * 0.35 - abs(vUV.y) * 0.5 - uT * 1.2)) * dentro * step(v, 0.7);
        col = DK; a = halo * 0.55; col = mix(col, mix(Y, RD, p) * 0.9, cheio * 0.7); a = max(a, cheio * (0.3 + 0.25 * p));
        col = mix(col, Y, chev * 0.5 * (1.0 - cheio)); a = max(a, chev * 0.3 * (1.0 - cheio));
        col = mix(col, vec3(1.0, 0.95, 0.75), frente); a = max(a, frente * 0.95); col = mix(col, Y * 1.25, clamp(borda, 0.0, 1.0)); a = max(a, clamp(borda, 0.0, 1.0)); }
    } else { /* sombra (cresce até o tamanho do golpe) */
      float rr = mix(0.2, 1.0, p); dentro = step(rho, 1.0); cheio = step(rho, rr);
      float tr = step(0.5, fract((vUV.x - vUV.y) * 6.0)) * cheio; float alvo = linha(abs(rho - 0.97), px, px * 1.2 + 0.008) * step(0.5, fract(atan(vUV.y, vUV.x) * 3.8197 + uT * 0.3));
      float aro = linha(abs(rho - rr), px, px * 1.6 + 0.014); float halo = linha(abs(rho - rr), px, px * 4.0 + 0.03) * (1.0 - aro);
      col = mix(RD * 0.55, DK, tr * 0.6); a = cheio * (0.28 + 0.18 * p);
      col = mix(col, DK, halo); a = max(a, halo * 0.5); col = mix(col, Y, alvo); a = max(a, alvo * 0.85); col = mix(col, mix(Y, RD, p) * 1.2, aro); a = max(a, aro);
    }
    col = mix(col, vec3(1.4, 1.2, 0.9), flash * dentro); a = max(a, flash * dentro * 0.75); a *= sai * ent;
  } else if (tipo < 4.5) { /* vidro: o chão vitrificado sob o Arauto, com rachaduras acesas */
    float vida = clamp((t1 - uT) / max(dur * 0.35, 0.1), 0.0, 1.0); float m = 1.0 - smoothstep(0.7, 1.0, rho);
    float rc = abs(sin(vUV.x * 7.0 + sin(vUV.y * 5.0 + vD.w) * 1.7) * sin(vUV.y * 6.0 + vD.w * 1.3)); float racha = 1.0 - smoothstep(0.0, 0.06 + px * 2.0, rc);
    col = mix(vec3(0.03, 0.06, 0.1), vec3(0.45, 0.9, 1.1), racha); a = m * (0.5 + 0.35 * racha) * vida * ent;
  } else { /* metal derretido: amarelo no meio, esfria para vermelho escuro e some */
    float idade = clamp((uT - t0) / dur, 0.0, 1.0); float bord = 0.75 + 0.15 * sin(atan(vUV.y, vUV.x) * 5.0 + vD.w * 3.0); float m = 1.0 - smoothstep(bord - 0.12, bord, rho);
    vec3 quente = mix(vec3(1.6, 0.95, 0.3), vec3(1.2, 0.3, 0.05), smoothstep(0.0, 0.35, idade)); col = mix(quente, vec3(0.1, 0.05, 0.04), smoothstep(0.3, 0.9, idade) * smoothstep(0.2, 0.9, rho + 0.3));
    a = m * (0.85 - 0.5 * idade) * (1.0 - smoothstep(0.85, 1.0, idade)) * ent;
  }
  if (a < 0.01) discard; gl_FragColor = vec4(col, a);
}`;
function matClassico(Tm) { const m = new Tm.ShaderMaterial({ uniforms: { uT: { value: 0 } }, vertexShader: GLSL_V, fragmentShader: GLSL_F, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  return m; }
function matM5(Tm, TL) { /* o mesmo desenho em TSL (um material, um pipeline) */
  const { Fn, attribute, uniform, float, vec2, vec3, vec4, abs, fract, length, max, min, mix, smoothstep, step, sin, atan, clamp, fwidth, Discard, If } = TL;
  const uT = uniform(0); const m = new Tm.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }); m.fog = false;
  const Y = vec3(1.0, 0.78, 0.12), RD = vec3(1.0, 0.16, 0.06), DK = vec3(0.015, 0.012, 0.01), BR = vec3(1.0, 0.95, 0.75);
  const linha = (d, px, w) => float(1).sub(smoothstep(w, w.add(px.mul(1.2)), d));
  m.fragmentNode = Fn(() => {
    const UV = attribute('aUV', 'vec2'), D = attribute('aD', 'vec4'); const tipo = D.x, t0 = D.y, t1 = D.z, dur = max(t1.sub(t0), 0.05);
    const p = clamp(uT.sub(t0).div(dur), 0, 1), dep = uT.sub(t1), ent = clamp(uT.sub(t0).mul(6), 0, 1);
    const rho = length(UV), px = max(fwidth(rho), 0.002);
    /* máscaras dos tipos */
    const eAnel = step(tipo, 0.5).mul(step(-0.5, tipo)), eFaixa = step(0.5, tipo).mul(step(tipo, 1.5)), eSombra = step(1.5, tipo).mul(step(tipo, 2.5)), ePoco = step(2.5, tipo).mul(step(tipo, 3.5));
    const eVidro = step(3.5, tipo).mul(step(tipo, 4.5)), eMetal = step(4.5, tipo).mul(step(tipo, 5.5)), eElo = step(5.5, tipo);
    const sai = float(1).sub(clamp(dep.div(0.45), 0, 1)), flash = clamp(float(1).sub(dep.div(0.35)), 0, 1).mul(step(0, dep));
    /* anel e poço */
    const dC = step(rho, 1.0); const bC = linha(abs(rho.sub(0.97)), px, px.mul(1.6).add(0.012)); const hC = linha(abs(rho.sub(0.97)), px, px.mul(4).add(0.03)).mul(float(1).sub(bC));
    const lst = step(0.5, fract(UV.x.add(UV.y).mul(5).sub(uT.mul(0.6)))).mul(step(0.86, rho)).mul(dC);
    const an = fract(rho.mul(4).add(uT.mul(1.6)));
    const chA = step(rho, p).mul(dC).mul(eAnel).add(float(1).sub(smoothstep(0, 0.18, an)).mul(dC).mul(p.mul(0.65).add(0.35)).mul(ePoco));
    const frA = linha(abs(rho.sub(p)), px, px.mul(1.2).add(0.01)).mul(dC).mul(eAnel).add(linha(abs(rho.sub(float(1).sub(p))), px, px.mul(1.4).add(0.012)).mul(dC).mul(ePoco));
    const cf = mix(Y, RD, p);
    let cA = DK, aA = hC.mul(0.55); cA = mix(cA, cf.mul(0.9), chA.mul(0.7)); aA = max(aA, chA.mul(p.mul(0.25).add(0.3))); cA = mix(cA, mix(Y, DK, 0.75), lst.mul(0.6)); aA = max(aA, lst.mul(0.35));
    cA = mix(cA, BR, frA); aA = max(aA, frA.mul(0.95)); cA = mix(cA, Y.mul(1.25), bC); aA = max(aA, bC);
    /* faixa e elo */
    const u = UV.x, v = abs(UV.y), pxu = max(fwidth(u), 0.002), pxv = max(fwidth(v), 0.002), dF = step(v, 1.0).mul(step(abs(u), 1.0));
    const bF = clamp(linha(abs(v.sub(0.96)), pxv, pxv.mul(1.6).add(0.02)).mul(step(abs(u), 1.0)).add(linha(abs(abs(u).sub(0.985)), pxu, pxu.mul(1.6).add(0.004)).mul(step(v, 1.0))), 0, 1);
    const hF = linha(abs(v.sub(0.96)), pxv, pxv.mul(4).add(0.05)).mul(step(abs(u), 1.0)).mul(float(1).sub(bF));
    const chF = step(u, p.mul(2).sub(1)).mul(dF), frF = linha(abs(u.sub(p.mul(2).sub(1))), pxu, pxu.mul(1.4).add(0.004)).mul(dF);
    const chev = step(0.55, fract(u.mul(D.w).mul(0.35).sub(v.mul(0.5)).sub(uT.mul(1.2)))).mul(dF).mul(step(v, 0.7)).mul(float(1).sub(chF));
    let cF = DK, aF = hF.mul(0.55); cF = mix(cF, cf.mul(0.9), chF.mul(0.7)); aF = max(aF, chF.mul(p.mul(0.25).add(0.3))); cF = mix(cF, Y, chev.mul(0.5)); aF = max(aF, chev.mul(0.3));
    cF = mix(cF, BR, frF); aF = max(aF, frF.mul(0.95)); cF = mix(cF, Y.mul(1.25), bF); aF = max(aF, bF);
    const trE = step(0.45, fract(u.mul(D.w).mul(0.5).sub(uT.mul(1.4)))); const cE = vec3(0.5, 0.95, 1.1).mul(trE.mul(0.6).add(0.6)), aE = linha(v, pxv, float(0.35)).mul(dF).mul(trE.mul(0.5).add(0.3));
    /* sombra */
    const rr = mix(float(0.2), float(1.0), p), chS = step(rho, rr); const trS = step(0.5, fract(UV.x.sub(UV.y).mul(6))).mul(chS);
    const alvo = linha(abs(rho.sub(0.97)), px, px.mul(1.2).add(0.008)).mul(step(0.5, fract(atan(UV.y, UV.x).mul(3.8197).add(uT.mul(0.3)))));
    const aro = linha(abs(rho.sub(rr)), px, px.mul(1.6).add(0.014)), hS = linha(abs(rho.sub(rr)), px, px.mul(4).add(0.03)).mul(float(1).sub(aro));
    let cS = mix(RD.mul(0.55), DK, trS.mul(0.6)), aS = chS.mul(p.mul(0.18).add(0.28)); cS = mix(cS, DK, hS); aS = max(aS, hS.mul(0.5)); cS = mix(cS, Y, alvo); aS = max(aS, alvo.mul(0.85)); cS = mix(cS, cf.mul(1.2), aro); aS = max(aS, aro);
    /* vidro e metal */
    const vida = clamp(t1.sub(uT).div(max(dur.mul(0.35), 0.1)), 0, 1); const mV = float(1).sub(smoothstep(0.7, 1.0, rho));
    const rc = abs(sin(UV.x.mul(7).add(sin(UV.y.mul(5).add(D.w)).mul(1.7))).mul(sin(UV.y.mul(6).add(D.w.mul(1.3))))); const racha = float(1).sub(smoothstep(0, px.mul(2).add(0.06), rc));
    const cV = mix(vec3(0.03, 0.06, 0.1), vec3(0.45, 0.9, 1.1), racha), aV = mV.mul(racha.mul(0.35).add(0.5)).mul(vida);
    const idade = p; const bord = sin(atan(UV.y, UV.x).mul(5).add(D.w.mul(3))).mul(0.15).add(0.75); const mM = float(1).sub(smoothstep(bord.sub(0.12), bord, rho));
    const quente = mix(vec3(1.6, 0.95, 0.3), vec3(1.2, 0.3, 0.05), smoothstep(0, 0.35, idade)); const cM = mix(quente, vec3(0.1, 0.05, 0.04), smoothstep(0.3, 0.9, idade).mul(smoothstep(0.2, 0.9, rho.add(0.3))));
    const aM = mM.mul(float(0.85).sub(idade.mul(0.5))).mul(float(1).sub(smoothstep(0.85, 1.0, idade)));
    /* junta: avisos com o clarão do golpe e a saída; marcas com a vida própria */
    const eAv = eAnel.add(ePoco), dAv = dC.mul(eAv).add(dF.mul(eFaixa)).add(step(rho, 1.0).mul(eSombra));
    let col = cA.mul(eAv).add(cF.mul(eFaixa)).add(cS.mul(eSombra)).add(cE.mul(eElo)).add(cV.mul(eVidro)).add(cM.mul(eMetal));
    let a = aA.mul(eAv).add(aF.mul(eFaixa)).add(aS.mul(eSombra)).mul(sai).add(aE.mul(eElo)).add(aV.mul(eVidro)).add(aM.mul(eMetal));
    const fl = flash.mul(dAv); col = mix(col, vec3(1.4, 1.2, 0.9), fl); a = max(a, fl.mul(0.75).mul(sai)); a = a.mul(ent);
    If(a.lessThan(0.01).or(tipo.lessThan(-0.5)), () => { Discard(); });
    return vec4(col, a);
  })();
  m.userData.uT = uT; return ARD.m5 && ARD.m5.registrar ? ARD.m5.registrar('chefe-chao', m) : m; }

function cria3d(api) {
  const R = api.R, M5X = api.M5X, Tm = M5X ? window.THREE_M5 : window.THREE, H = api.H; if (!Tm) return null;
  const leve = TOQUE || (R.quality && R.quality.resolved === 'baixa');
  const CAP = 48; const geo = geoVagas(Tm, CAP); const mat = M5X ? matM5(Tm, window.TSL) : matClassico(Tm); const uT = M5X ? mat.userData.uT : mat.uniforms.uT;
  const mesh = new Tm.Mesh(geo, mat); mesh.frustumCulled = false; mesh.renderOrder = 0; mesh.castShadow = false; mesh.receiveShadow = false; mesh.name = 'ard-chefe-chao'; mesh.matrixAutoUpdate = false; api.scene.add(mesh);
  const P = geo.attributes.position.array, U = geo.attributes.aUV.array, Dd = geo.attributes.aD.array;
  const vagas = new Array(CAP).fill(null), porChave = new Map(); let sujo0 = CAP, sujo1 = -1, topo = 0;
  function escreve(s, o) { /* o = { tipo, x, y, r | x2, y2, w, t0, t1, w4 } */
    const base = s * GV; const tp = TIPOS_AVISO[o.tipo] != null ? TIPOS_AVISO[o.tipo] : 0; const linear = tp === 1 || tp === 6;
    let dx = 0, dy = 0, nx = 0, ny = 0, L = 0, hw = 0; if (linear) { dx = o.x2 - o.x; dy = o.y2 - o.y; L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L; nx = -dy; ny = dx; hw = (o.w || 40) / 2; }
    const R0 = (o.r || 60) * 1.06, lift = 0.9 + (linear ? hw : R0) * 0.004;
    for (let j = 0; j <= GN; j++) for (let i = 0; i <= GN; i++) { const u = i / GN * 2 - 1, v = j / GN * 2 - 1, k = base + j * (GN + 1) + i; let wx, wy;
      if (linear) { wx = o.x + dx * (u + 1) * 0.5 * L + nx * v * hw * 1.15; wy = o.y + dy * (u + 1) * 0.5 * L + ny * v * hw * 1.15; U[k * 2] = u; U[k * 2 + 1] = v * 1.15; }
      else { wx = o.x + u * R0; wy = o.y + v * R0; U[k * 2] = u * 1.06; U[k * 2 + 1] = v * 1.06; }
      P[k * 3] = wx; P[k * 3 + 1] = H(wx, wy) + lift; P[k * 3 + 2] = -wy;
      Dd[k * 4] = tp; Dd[k * 4 + 1] = o.t0; Dd[k * 4 + 2] = o.t1; Dd[k * 4 + 3] = o.w4 != null ? o.w4 : linear ? L / Math.max(1, hw * 2) : (o.seed || 0); }
    if (s < sujo0) sujo0 = s; if (s > sujo1) sujo1 = s; }
  function mostra(s, on) { const v = vagas[s]; if (!v || v.vis === on) return; v.vis = on; const tp = on ? (TIPOS_AVISO[v.tipo] != null ? TIPOS_AVISO[v.tipo] : 0) : -1, base = s * GV; for (let k = base; k < base + GV; k++) Dd[k * 4] = tp; if (s < sujo0) sujo0 = s; if (s > sujo1) sujo1 = s; }
  let visT = -1; function visibilidade(sim, view) { /* só o que você vê agora (as marcas e avisos no escuro da névoa de guerra ficam escondidos: nunca entregam onde o chefão está) */
    if (R.time - visT < 0.4 && visT >= 0) return; visT = R.time; const SS = S(); const ve = (x, y) => view.reveal || !SS.seesPoint || SS.seesPoint(sim, view.human, x, y);
    for (let s = 0; s < CAP; s++) { const v = vagas[s]; if (!v) continue; const lin = v.tipo === 'faixa' || v.tipo === 'elo'; mostra(s, ve(v.x, v.y) || (lin && (ve(v.x2, v.y2) || ve((v.x + v.x2) / 2, (v.y + v.y2) / 2)))); } }
  function apaga(s) { const base = s * GV; for (let k = base; k < base + GV; k++) { Dd[k * 4] = -1; P[k * 3] = P[k * 3 + 1] = P[k * 3 + 2] = 0; } if (s < sujo0) sujo0 = s; if (s > sujo1) sujo1 = s; }
  function poe(chave, o) { let s = porChave.get(chave); if (s == null) { s = vagas.indexOf(null); if (s < 0) { /* cheio: a marca visual mais velha sai (avisos nunca) */ let vk = -1, vt = Infinity; for (let i = 0; i < CAP; i++) { const v = vagas[i]; if (v && !v.aviso && v.t0 < vt) { vt = v.t0; vk = i; } } if (vk < 0) return -1; porChave.delete(vagas[vk].chave); s = vk; } porChave.set(chave, s); }
    vagas[s] = Object.assign({ chave, vis: true }, o); escreve(s, o); visT = -1; return s; }
  function solta(s) { const v = vagas[s]; if (!v) return; porChave.delete(v.chave); vagas[s] = null; apaga(s); }
  function sobe() { if (sujo1 < 0) return; topo = 0; for (let i = CAP - 1; i >= 0; i--) if (vagas[i]) { topo = i + 1; break; } geo.setDrawRange(0, Math.max(1, topo) * GI);
    for (const [nm, n] of [['position', 3], ['aUV', 2], ['aD', 4]]) { const a = geo.attributes[nm]; a.clearUpdateRanges(); a.addUpdateRange(sujo0 * GV * n, (sujo1 - sujo0 + 1) * GV * n); a.needsUpdate = true; } sujo0 = CAP; sujo1 = -1; }
  /* estado por chefão: rastro, pernas, luz */
  const EST = new Map(), QUEDAS = [], vistos = new Set(); let ultAviso = -1, somT = -9;
  const C3 = { mesh, poe, solta, vagas };
  C3.quadro = function (sim, view, dt, alpha, vis) {
    const agora = sim.time + (alpha || 0) * (S().TICK || 0.1); uT.value = agora; const vfx = CH.chaves.vfx; const FX = R.FX;
    /* 1. avisos da simulação */
    vistos.clear(); const av = sim.avisos || [];
    for (let i = 0; i < av.length; i++) { const a = av[i]; if (!a) continue; const k = 'a' + a.id; vistos.add(k); if (!porChave.has(k)) poe(k, { aviso: true, tipo: a.tipo, x: a.x, y: a.y, r: a.r, x2: a.x2 != null ? a.x2 : a.x, y2: a.y2 != null ? a.y2 : a.y, w: a.w, t0: a.t0, t1: a.t1 }); }
    for (let s = 0; s < CAP; s++) { const v = vagas[s]; if (!v) continue; if (v.aviso) { if (!vistos.has(v.chave) && agora > v.t1 + 0.5) solta(s); else if (!v.caiu && agora >= v.t1) { v.caiu = true; golpe(v, sim, view); } } else if (agora > v.t1) solta(s); }
    /* 5.0g junção: o chão que muda na simulação (sim.terreno: metal derretido da Forja e o chão rachado do Arauto) dá dano: desenhado onde o dano cai, em toda qualidade */
    const tz = sim.terreno || []; for (let i = 0; i < tz.length; i++) { const z = tz[i]; const k = 't' + z.id; if (!porChave.has(k)) poe(k, { tipo: z.tipo === 'metal' ? 'metal' : 'vidro', x: z.x, y: z.y, r: z.r, t0: z.t0, t1: z.t1, seed: (z.id * 1.7) % 6.28 }); }
    /* 2. chefões: rastro (vidro e metal), pernas, marcas, luz */
    let lider = null; for (const e of sim.ents) { if (!e.alive) continue;
      if (e.boss) { if (!lider || e.maxHp > lider.maxHp) lider = e; const st = estado(e, agora); const visto = view.reveal || e.owner === view.human || !vis || vis.has(e.id); if (!visto) continue;
        const b = e.boss, tipo = b.tipo, wx = e.px + (e.x - e.px) * alpha, wy = e.py + (e.y - e.py) * alpha; const moveu = Math.hypot(wx - st.x, wy - st.y);
        if (tipo === 'arauto' || tipo === 'sentinela') { if (vfx && (moveu > e.r * 0.5 || st.n === 0)) { st.x = wx; st.y = wy; st.n++; poe('v' + e.id + '-' + (st.n % (leve ? 3 : 6)), { tipo: 'vidro', x: wx, y: wy, r: e.r * (tipo === 'arauto' ? 1.15 : 1.0), t0: agora, t1: agora + (leve ? 25 : 60), seed: (e.id * 1.7 + st.n) % 6.28 }); }
          const pul = 0.75 + 0.25 * Math.sin(R.time * 2.2 + e.id), jan = b.janela ? 1 : 0; if (R.flashNow) { const cor = tipo === 'sentinela' ? [1.0, 0.7, 0.25] : jan ? [1.0, 0.45, 1.1] : [0.45, 0.9, 1.15]; R.flashNow(wx, wy, e.r * (1.7 + jan * 0.6), cor, (0.5 + 0.45 * jan) * pul); } }
        if (tipo === 'forja') { const f = fase(e); st.trav += moveu / Math.max(0.01, st.fit || 1); /* 5.0g junção: o rastro de metal vem do sim.terreno (acima), onde o dano cai */
          st.x = wx; st.y = wy; st.mov += ((moveu > 0.05 ? 1 : 0) - st.mov) * Math.min(1, dt * 4); pernas3d(e, st, wx, wy, f, sim, agora); if (f >= 3) nucleo3d(e, st, wx, wy); /* 5.0g junção: o núcleo exposto é o próprio corpo na fase 3 (não há parte 'nucleo' na simulação) */ forjaFx(e, st, wx, wy, f, vfx, agora); }
        }
      else if (e.parte) { const visto = view.reveal || !vis || vis.has(e.id); if (!visto) continue; marca3d(e, alpha);
        if (e.parte.tipo === 'pilar' && vfx) { const ch = sim.byId && sim.byId.get(e.parte.chefe); if (ch && ch.alive) { const k = 'e' + e.id, s = porChave.get(k), v = s != null ? vagas[s] : null; if (!v || Math.hypot(v.x2 - ch.x, v.y2 - ch.y) > 25) poe(k, { tipo: 'elo', x: e.x, y: e.y, x2: ch.x, y2: ch.y, w: 14, t0: agora, t1: agora + 1e6 }); } }
        if (e.parte.tipo === 'nucleo' && R.flashNow) R.flashNow(e.x, e.y, e.r * 2.2, [1.4, 0.55, 0.15], 0.7 + 0.3 * Math.sin(R.time * 9)); } }
    for (const [k, s] of porChave) if (k[0] === 'e') { const id = +k.slice(1); const e = sim.byId && sim.byId.get(id); if (!e || !e.alive) solta(s); }
    quedas(dt); visibilidade(sim, view);
    /* 3. luz da cena por fase (lida pelo R.draw no próximo quadro) */
    if (CH.chaves.luz && lider) { const b = lider.boss, f = fase(lider); const c = b.tipo === 'forja' ? [1.25, 0.86, 0.6] : b.tipo === 'sentinela' ? [1.2, 0.95, 0.65] : b.janela ? [1.15, 0.82, 1.25] : [0.8, 0.95, 1.2]; const k = b.tipo === 'sentinela' ? 0.06 : (b.janela ? 0.2 : [0, 0.1, 0.14, 0.18][f]);
      const tc = R.tintChefe || (R.tintChefe = [1, 1, 1, 0]); for (let i = 0; i < 3; i++) tc[i] += (c[i] - tc[i]) * Math.min(1, dt * 1.5); tc[3] += (k - tc[3]) * Math.min(1, dt * 1.2); }
    else if (R.tintChefe) { R.tintChefe[3] *= Math.max(0, 1 - dt * 1.2); if (R.tintChefe[3] < 0.003) R.tintChefe = null; }
    sobe(); mesh.visible = topo > 0 || !!R.warming;
  };
  function estado(e, agora) { let st = EST.get(e.id); if (!st) { st = { x: e.x, y: e.y, n: 0, d: 0, trav: 0, mov: 0, fit: 1, cantos: 15, t: agora }; EST.set(e.id, st); } st.t = agora; return st; }
  /* golpe que cai: sacode a câmera de leve e toca o impacto (só o que está à vista) */
  function golpe(v, sim, view) { const vis = view.reveal ? null : sim.vis && sim.vis[view.human]; const S0 = S(); const tile = S0.TILE || 64, tiles = S0.WORLD / tile; const ix = Math.max(0, Math.min(tiles - 1, (v.x / tile) | 0)), iy = Math.max(0, Math.min(tiles - 1, (v.y / tile) | 0));
    if (vis && sim.explored && !(sim.explored[view.human] || [])[iy * tiles + ix]) return; R.shake = Math.max(R.shake || 0, 0.35);
    if (R.flash) R.flash(v.x, v.y, (v.r || 80) * 1.1, [1.6, 0.9, 0.35], 1.2, 0.35, 1); const now = performance.now(); if (now - somT > 250) { somT = now; try { if (ARD.audio && ARD.audio.sfx) ARD.audio.sfx('explosion', 0.8); } catch (e) {} } }
  /* Forja: as quatro pernas (cada uma um modelo, presa no canto do casco e andando com o passo), as que caem e os efeitos */
  const CANTOS = [[15, 12], [15, -12], [-15, 12], [-15, -12]];
  function cantosVivos(e, st, f) { const sim = R.sim; let pg = PERNAS.get(e.id); if (!pg) { pg = { vistas: false, vivas: 15 }; PERNAS.set(e.id, pg); }
    let m = 0, achou = false; const a = e.ang || 0, ca = Math.cos(a), sa = Math.sin(a);
    for (const p of sim.ents) { if (!p.alive || !p.parte || p.parte.chefe !== e.id || p.parte.tipo !== 'perna') continue; achou = true; const dx = p.x - e.x, dy = p.y - e.y; const lx = dx * ca + dy * sa, lz = dx * sa - dy * ca; let best = 0, bd = -1e9; for (let i = 0; i < 4; i++) { const d = lx * CANTOS[i][0] + lz * CANTOS[i][1]; if (d > bd) { bd = d; best = i; } } m |= 1 << best; }
    if (achou) pg.vistas = true; pg.vivas = f >= 3 ? 0 : pg.vistas ? m : 15; return pg.vivas; }
  const IA = [0, 0, 0, 0, 0];
  function pernas3d(e, st, wx, wy, f, sim, agora) { const A = api; const fit = CH.fit(e, 1); st.fit = fit;
    const vivas = cantosVivos(e, st, f); const a = e.ang || 0, ca = Math.cos(a), sa = Math.sin(a); const it = A.instOf('chefe_forja_perna', e.owner, 0, false, false);
    for (let i = 0; i < 4; i++) { const lx = CANTOS[i][0], lz = CANTOS[i][1]; const cx = wx + (lx * ca + lz * sa) * fit, cy = wy + (lx * sa - lz * ca) * fit; const th = Math.atan2(-lz, lx);
      const viva = (vivas >> i) & 1; if (!viva && f < 3 && ((st.cantos >> i) & 1)) QUEDAS.push({ x: cx, y: cy, ang: a + th, fit, t0: R.time, owner: e.owner, poeira: false });
      if (!viva) continue; IA[0] = st.trav + (i === 0 || i === 3 ? 7 : 0); IA[1] = R.time; IA[2] = st.mov; IA[3] = 0; IA[4] = R.time; A.put(it, cx, cy, 0, a + th, fit, 1, 1, it.anim ? IA : null); }
    st.cantos = vivas; }
  function quedas(dt) { const A = api; for (let i = QUEDAS.length - 1; i >= 0; i--) { const q = QUEDAS[i]; const k = R.time - q.t0; if (k > 22) { QUEDAS.splice(i, 1); continue; }
      const tomb = Math.min(1, k / 1.1), afunda = Math.max(0, k - 12) / 10; if (!q.poeira && k > 1.0) { q.poeira = true; R.shake = Math.max(R.shake || 0, 0.5); if (R.FX) { for (let j = 0; j < 6; j++) R.FX.smoke(q.x + Math.cos(q.ang) * 14 * q.fit + (Math.random() - 0.5) * 20, A.H(q.x, q.y) + 3, -(q.y + Math.sin(q.ang) * 14 * q.fit) + (Math.random() - 0.5) * 20, [0.32, 0.28, 0.25], 6 + Math.random() * 4, 18, 8); } if (R.flash) R.flash(q.x, q.y, 50, [1.5, 0.7, 0.3], 1, 0.3, 1); try { ARD.audio && ARD.audio.sfx && ARD.audio.sfx('explosion', 0.9); } catch (e) {} }
      if (tomb < 1) { const it = A.instOf('chefe_forja_perna', q.owner, 0, false, false); A.put(it, q.x, q.y, 0, q.ang, q.fit, 1 - 0.85 * tomb * tomb, 1, it.anim ? IA0 : null, 1, -0.5 * tomb); } /* desaba: encolhe e tomba para fora */
      else { const it = A.instOf('chefe_forja_perna_caida', q.owner, 0, false, false); A.put(it, q.x, q.y, -afunda * 6 * q.fit, q.ang, q.fit, 1, 0.55 + 0.45 * Math.max(0, 1 - k / 6), null, Math.max(0.05, 1 - k / 4)); } } }
  function forjaFx(e, st, wx, wy, f, vfx, agora) { const FX = R.FX; if (!FX || !vfx || R.paused) return; const pp = (R.quality && R.quality.particles) || 1; if (leve && pp < 0.6) return; const fit = st.fit, a = e.ang || 0, ca = Math.cos(a), sa = Math.sin(a), h0 = api.H(wx, wy);
    const P = (lx, lz) => [wx + (lx * ca + lz * sa) * fit, wy + (lx * sa - lz * ca) * fit];
    if (f < 3) { for (const c of [[-11, -7, 39], [-11, 7, 36]]) if (Math.random() < 0.35 * pp) { const p = P(c[0], c[1]); FX.smoke(p[0], h0 + c[2] * fit, -p[1], [0.16, 0.15, 0.15], 5 + Math.random() * 4, 22 + Math.random() * 10, 4 * fit); }
      if (Math.random() < 0.25 * pp) { const s = Math.random() < 0.5 ? 1 : -1, p = P(15, s * 6); FX.spark(p[0], h0 + 30.6 * fit, -p[1], [1.6, 1.2, 0.6], 30, 3); if (R.flash && Math.random() < 0.4) R.flash(p[0], p[1], 22, [1.4, 1.2, 0.8], 0.8, 0.08, 1); }
      if (f >= 2 && Math.random() < 0.3 * pp) { const p = P(18, (Math.random() - 0.5) * 14); FX.glow(p[0], h0 + 18 * fit, -p[1], [1.6, 0.7, 0.2], 3, 0.4); } }
    else { if (Math.random() < 0.5 * pp) FX.spark(wx + (Math.random() - 0.5) * e.r, h0 + 8 * fit, -(wy + (Math.random() - 0.5) * e.r), [1.7, 0.8, 0.3], 40, 3); if (Math.random() < 0.3 * pp) FX.smoke(wx, h0 + 12 * fit, -wy, [0.12, 0.1, 0.1], 7, 24, 6 * fit); if (R.flashNow) R.flashNow(wx, wy, e.r * 1.8, [1.4, 0.5, 0.12], 0.6 + 0.3 * Math.sin(R.time * 7)); } }
  function nucleo3d(e, st, wx, wy) { const A = api, fit = st.fit || CH.fit(e, 1); const it = A.instOf('chefe_nucleo', e.owner, 0, false, false); A.put(it, wx, wy, 6.5 * fit, e.ang || 0, fit * 0.9, 1, 1, it.anim ? IA0 : null); } /* 5.0g junção */
  /* marca do ponto fraco: losango âmbar girando acima da parte (sempre à vista, lido de longe e no celular) */
  function marca3d(e, alpha) { const A = api; const m = CH.modelo(e); const g = A.geoOf(m, e.owner, 0); if (!g || !g.width) return; const fit = 2 * e.r * 1.25 / g.width;
    const wx = e.kind === 'unit' ? e.px + (e.x - e.px) * alpha : e.x, wy = e.kind === 'unit' ? e.py + (e.y - e.py) * alpha : e.y; const it = A.instOf('chefe_marca', e.owner, 0, false, false);
    const s = Math.max(2.4, e.r * 0.22) * (TOQUE ? 1.35 : 1); A.put(it, wx, wy, g.height * fit + 8 + Math.sin(R.time * 3 + e.id) * 1.5, R.time * 2, s, 1, 1, it.anim ? IA0 : null); }
  const IA0 = [0, 0, 0, 0, 0];
  C3.limpa = () => { for (let s = 0; s < CAP; s++) if (vagas[s]) solta(s); EST.clear(); QUEDAS.length = 0; sobe(); };
  return C3;
}

/* ---------- 2D (src/render.js): o chão e os chefões desenhados no canvas ---------- */
CH.chao2d = function (c, sim, P, k, R, alpha) {
  const tz = sim.terreno; if (tz && tz.length) { const ag = sim.time + (alpha || 0) * (S().TICK || 0.1); /* 5.0g junção: o chão que dá dano (sim.terreno) também no 2D */
    for (const z of tz) { const g = P(z.x, z.y, 0), rr = (z.r || 40) * k, id = Math.max(0, Math.min(1, (ag - z.t0) / Math.max(0.1, z.t1 - z.t0))); c.save(); c.translate(g[0], g[1]); c.scale(1, 0.5); c.beginPath(); c.arc(0, 0, Math.max(0.5, rr), 0, Math.PI * 2);
      c.fillStyle = z.tipo === 'metal' ? `rgba(255,${Math.round(150 - 110 * id)},30,${0.5 - 0.3 * id})` : `rgba(90,210,255,${0.32 - 0.2 * id})`; c.fill(); c.lineWidth = 1.5; c.strokeStyle = z.tipo === 'metal' ? 'rgba(120,30,10,0.7)' : 'rgba(20,60,90,0.7)'; c.stroke(); c.restore(); } }
  const av = sim.avisos; if (!av || !av.length) return; const agora = sim.time + (alpha || 0) * (S().TICK || 0.1);
  for (const a of av) { const dur = Math.max(0.05, a.t1 - a.t0), p = Math.max(0, Math.min(1, (agora - a.t0) / dur)), dep = agora - a.t1; if (dep > 0.45) continue; const sai = dep > 0 ? 1 - dep / 0.45 : 1;
    const corF = `rgba(255,${Math.round(200 - 160 * p)},${Math.round(30 - 15 * p)},`; c.save(); c.globalAlpha = sai;
    if (a.tipo === 'faixa') { const dx = a.x2 - a.x, dy = a.y2 - a.y, L = Math.hypot(dx, dy) || 1, nx = -dy / L * (a.w || 40) / 2, ny = dx / L * (a.w || 40) / 2; const q = (u, v) => P(a.x + dx * u + nx * v, a.y + dy * u + ny * v, 0);
      const poly = (u0, u1) => { const p1 = q(u0, -1), p2 = q(u1, -1), p3 = q(u1, 1), p4 = q(u0, 1); c.beginPath(); c.moveTo(p1[0], p1[1]); c.lineTo(p2[0], p2[1]); c.lineTo(p3[0], p3[1]); c.lineTo(p4[0], p4[1]); c.closePath(); };
      poly(0, p); c.fillStyle = corF + (0.3 + 0.2 * p) + ')'; c.fill(); poly(0, 1); c.lineWidth = 5; c.strokeStyle = 'rgba(0,0,0,0.6)'; c.stroke(); c.lineWidth = 2.2; c.strokeStyle = '#FFC81F'; c.stroke(); }
    else { const g = P(a.x, a.y, 0), rr = (a.r || 60) * k; c.translate(g[0], g[1]); c.scale(1, 0.5);
      const circ = (r) => { c.beginPath(); c.arc(0, 0, Math.max(0.5, r), 0, Math.PI * 2); };
      if (a.tipo === 'sombra') { circ(rr * (0.2 + 0.8 * p)); c.fillStyle = `rgba(150,25,10,${0.3 + 0.2 * p})`; c.fill(); c.lineWidth = 3; c.strokeStyle = corF + '1)'; c.stroke(); c.setLineDash([8, 8]); circ(rr); c.lineWidth = 2; c.strokeStyle = '#FFC81F'; c.stroke(); c.setLineDash([]); }
      else if (a.tipo === 'poco') { for (let i = 0; i < 4; i++) { const f = ((i / 4) - (agora * 0.4) % 1 + 1) % 1; circ(rr * f); c.lineWidth = 2; c.strokeStyle = corF + (0.25 + 0.5 * p) + ')'; c.stroke(); } circ(rr * (1 - p)); c.lineWidth = 3; c.strokeStyle = '#FFF2C0'; c.stroke(); circ(rr); c.lineWidth = 5; c.strokeStyle = 'rgba(0,0,0,0.6)'; c.stroke(); c.lineWidth = 2.5; c.strokeStyle = '#FFC81F'; c.stroke(); }
      else { circ(rr * p); c.fillStyle = corF + (0.28 + 0.2 * p) + ')'; c.fill(); circ(rr * p); c.lineWidth = 2.5; c.strokeStyle = '#FFF2C0'; c.stroke(); circ(rr); c.lineWidth = 5; c.strokeStyle = 'rgba(0,0,0,0.6)'; c.stroke(); c.lineWidth = 2.5; c.strokeStyle = '#FFC81F'; c.stroke(); }
      if (dep > 0) { circ(rr); c.fillStyle = `rgba(255,230,180,${0.5 * (1 - dep / 0.45)})`; c.fill(); } }
    c.restore(); } };
CH.ent2d = function (c, e, alpha, P, k, view, R, hpBar) { /* devolve true quando desenhou (o render.js pula o desenho genérico) */
  const isU = e.kind === 'unit'; const wx = isU ? e.px + (e.x - e.px) * alpha : e.x, wy = isU ? e.py + (e.y - e.py) * alpha : e.y; const g = P(wx, wy, 0), s = e.r * k, t = R.time;
  const ell = (x, y, rx, ry, rot) => { c.beginPath(); c.ellipse(x, y, Math.max(0.5, rx), Math.max(0.5, ry), rot || 0, 0, Math.PI * 2); };
  c.save(); c.fillStyle = 'rgba(0,0,0,0.35)'; ell(g[0], g[1], s * 1.1, s * 0.55); c.fill();
  if (view.sel.has(e.id)) { c.strokeStyle = 'rgba(255,255,255,0.9)'; c.lineWidth = 1.5; ell(g[0], g[1], (e.r + 5) * k, (e.r + 5) * k * 0.5); c.stroke(); }
  let topo = g[1] - s * 2;
  if (e.boss && (e.boss.tipo === 'arauto' || e.boss.tipo === 'sentinela')) { const sen = e.boss.tipo === 'sentinela', f = fase(e), jan = !!e.boss.janela, cor = sen ? '#FFC24A' : '#BFF4FF';
    const gr = c.createRadialGradient(g[0], g[1], 1, g[0], g[1], s * 1.2); gr.addColorStop(0, sen ? 'rgba(255,190,80,0.35)' : 'rgba(120,220,255,0.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); c.save(); c.translate(g[0], g[1]); c.scale(1, 0.5); c.fillStyle = gr; c.beginPath(); c.arc(0, 0, s * 1.2, 0, Math.PI * 2); c.fill(); c.restore();
    const cy = g[1] - s * 1.6 + Math.sin(t * 0.9) * s * 0.04; topo = cy - s * 1.15;
    c.beginPath(); c.moveTo(g[0], cy - s * 1.1); c.lineTo(g[0] + s * 0.42, cy); c.lineTo(g[0], cy + s * 1.1); c.lineTo(g[0] - s * 0.42, cy); c.closePath(); c.fillStyle = '#16121F'; c.fill(); c.lineWidth = 2; c.strokeStyle = cor; c.stroke();
    const RS = f === 3 && !jan ? [0.75, 0.85] : jan ? [1.35, 1.6] : [1.0, 1.25]; const vel = jan ? 0.3 : f === 3 ? 2.6 : 1;
    for (let i = 0; i < (sen ? 2 : 3); i++) { const rr = s * (RS[0] + i * (RS[1] - RS[0]) / 2); ell(g[0], cy, rr, rr * (0.25 + 0.15 * Math.sin(t * vel * (i % 2 ? -1 : 1) + i)), 0.3 * i + t * 0.1 * vel); c.lineWidth = 2; c.strokeStyle = '#B8975A'; c.stroke(); }
    if (f === 1 && !sen) { c.setLineDash([4, 5]); ell(g[0], cy, s * 1.6, s * 1.6); c.lineWidth = 1.5; c.strokeStyle = 'rgba(127,232,255,0.7)'; c.stroke(); c.setLineDash([]); }
    if (jan) { ell(g[0], cy, s * 0.36, s * 0.36); c.fillStyle = '#E07CFF'; c.fill(); ell(g[0], cy, s * 0.14, s * 0.14); c.fillStyle = '#1A0526'; c.fill(); } else { c.fillStyle = '#E07CFF'; c.fillRect(g[0] - s * 0.3, cy - 1.5, s * 0.6, 3); } }
  else if (e.boss && e.boss.tipo === 'forja') { const f = fase(e); const a = (e.ang || 0); const pg = PERNAS.get(e.id); const vivas = f >= 3 ? 0 : pg && pg.vistas ? pg.vivas : 15; const caida = f >= 3 || vivas === 0;
    const iso = (lx, lz, z) => { const ca = Math.cos(a), sa = Math.sin(a); return P(wx + (lx * ca + lz * sa) * e.r / 18, wy + (lx * sa - lz * ca) * e.r / 18, z * e.r / 18); };
    const CN = [[15, 12], [15, -12], [-15, 12], [-15, -12]]; c.lineCap = 'round';
    for (let i = 0; i < 4; i++) { if (!((vivas >> i) & 1)) continue; const h = iso(CN[i][0], CN[i][1], 20), d = Math.hypot(CN[i][0], CN[i][1]); const kx = CN[i][0] / d, kz = CN[i][1] / d; const kn = iso(CN[i][0] + kx * 8, CN[i][1] + kz * 8, 30 + Math.sin(t * 4 + i * 1.6) * 1.5), ft = iso(CN[i][0] + kx * 16, CN[i][1] + kz * 16, 0);
      c.strokeStyle = '#4A4E57'; c.lineWidth = Math.max(2, s * 0.14); c.beginPath(); c.moveTo(h[0], h[1]); c.lineTo(kn[0], kn[1]); c.lineTo(ft[0], ft[1]); c.stroke(); c.fillStyle = '#FF7A1A'; c.beginPath(); c.arc(kn[0], kn[1], Math.max(2, s * 0.07), 0, Math.PI * 2); c.fill(); }
    const z0 = caida ? 2 : 16, z1 = caida ? 12 : 30; const q = [iso(17, 15, z0), iso(17, -15, z0), iso(-17, -15, z0), iso(-17, 15, z0)], w = [iso(17, 15, z1), iso(17, -15, z1), iso(-17, -15, z1), iso(-17, 15, z1)];
    c.fillStyle = '#3A3E46'; c.beginPath(); c.moveTo(q[0][0], q[0][1]); for (const p of [q[1], w[1], w[0]]) c.lineTo(p[0], p[1]); c.closePath(); c.fill(); c.fillStyle = '#2A2D33'; c.beginPath(); c.moveTo(q[1][0], q[1][1]); for (const p of [q[2], w[2], w[1]]) c.lineTo(p[0], p[1]); c.closePath(); c.fill();
    c.fillStyle = '#5A5F69'; c.beginPath(); c.moveTo(w[0][0], w[0][1]); for (const p of [w[1], w[2], w[3]]) c.lineTo(p[0], p[1]); c.closePath(); c.fill(); c.strokeStyle = '#FFD23F'; c.lineWidth = 1.5; c.stroke();
    const nc = iso(2, 0, z1 + 2); c.fillStyle = caida ? '#FFD27A' : '#FF9A3A'; c.beginPath(); c.arc(nc[0], nc[1], s * (caida ? 0.32 + 0.04 * Math.sin(t * 8) : 0.2), 0, Math.PI * 2); c.fill();
    if (!caida) for (const ch of [[-11, -7], [-11, 7]]) { const b0 = iso(ch[0], ch[1], z1), b1 = iso(ch[0], ch[1], z1 + 12); c.strokeStyle = '#22252B'; c.lineWidth = Math.max(3, s * 0.18); c.beginPath(); c.moveTo(b0[0], b0[1]); c.lineTo(b1[0], b1[1]); c.stroke(); if (Math.random() < 0.3) R.fx.parts.push({ x: wx, y: wy, z: (z1 + 14) * e.r / 18, vx: 4, vy: -3, vz: 16, t: 0, life: 2.2, c: '#3A3A3E', s: 3, smoke: true }); }
    topo = w[0][1] - s * 0.8; }
  else if (e.parte) { const tp = e.parte.tipo; if (tp === 'pilar') { c.beginPath(); c.moveTo(g[0], g[1] - s * 3); c.lineTo(g[0] + s * 0.45, g[1] - s * 0.2); c.lineTo(g[0] - s * 0.45, g[1] - s * 0.2); c.closePath(); c.fillStyle = '#16121F'; c.fill(); c.strokeStyle = '#7FE8FF'; c.lineWidth = 1.5; c.stroke(); topo = g[1] - s * 3.2; }
    else { const r0 = s * (tp === 'nucleo' ? 0.8 : 0.6); c.beginPath(); c.arc(g[0], g[1] - r0, r0, 0, Math.PI * 2); c.fillStyle = tp === 'nucleo' ? '#FFD27A' : '#FF9A3A'; c.fill(); c.lineWidth = 2; c.strokeStyle = '#FFD23F'; c.stroke(); topo = g[1] - r0 * 2; }
    const my = topo - 10 - Math.sin(t * 3 + e.id) * 2; c.beginPath(); c.moveTo(g[0], my - 7); c.lineTo(g[0] + 5, my); c.lineTo(g[0], my + 7); c.lineTo(g[0] - 5, my); c.closePath(); c.fillStyle = '#FFD23F'; c.fill(); c.strokeStyle = '#000'; c.lineWidth = 1.5; c.stroke(); topo = my - 8; }
  else { c.restore(); return false; }
  if (hpBar && (e.hp < e.maxHp - 0.5 || view.sel.has(e.id) || e.parte)) hpBar(c, g[0], topo - 4, Math.max(18, e.r * 1.6 * k), e.hp / e.maxHp);
  c.restore(); return true; };

/* ---------- interface: barra do chefe, aviso de fase e a janela de dano ---------- */
const CSS = `
#chefe-hud{position:fixed;left:50%;top:calc(env(safe-area-inset-top,0px) + 120px);transform:translateX(-50%);width:min(560px,44vw);z-index:5;pointer-events:none;font-family:var(--fb,system-ui);color:#fff;text-shadow:0 1px 2px #000;padding:5px 10px 6px;background:linear-gradient(180deg,#0B0E13,#080A0E);border-top:2px solid #FFD23F;clip-path:polygon(10px 0,calc(100% - 10px) 0,100% 10px,100% 100%,0 100%,0 10px)}
#chefe-hud[hidden]{display:none}
#chefe-hud .cab{display:flex;align-items:baseline;gap:.6rem;justify-content:center;white-space:nowrap;overflow:hidden}
#chefe-hud .nm{font-family:var(--fd,inherit);font-weight:800;font-size:1.05rem;letter-spacing:.06em;text-transform:uppercase;color:#FFE9B0}
#chefe-hud .ti{font:500 .74rem/1 var(--fm,monospace);letter-spacing:.14em;text-transform:uppercase;color:#C9CED8;overflow:hidden;text-overflow:ellipsis}
#chefe-hud .fs{font:600 .7rem/1 var(--fm,monospace);letter-spacing:.12em;text-transform:uppercase;color:#FFD23F}
#chefe-hud .br{position:relative;height:14px;margin-top:4px;background:rgba(10,12,16,.82);border:1px solid rgba(255,210,63,.55);clip-path:polygon(8px 0,100% 0,calc(100% - 8px) 100%,0 100%);overflow:hidden}
#chefe-hud .hp,#chefe-hud .rc,#chefe-hud .es{position:absolute;left:0;top:0;bottom:0;width:100%;transform-origin:left;transform:scaleX(1)}
#chefe-hud .rc{background:#FFF3C2;opacity:.75;transition:transform .6s ease-in .25s}
#chefe-hud .hp{background:linear-gradient(180deg,#FF6A3D,#C4241A)}
#chefe-hud .es{background:repeating-linear-gradient(115deg,rgba(127,232,255,.85) 0 6px,rgba(127,232,255,.55) 6px 12px);height:5px;top:auto}
#chefe-hud .mk{position:absolute;top:-1px;bottom:-1px;width:2px;background:#0A0C10;box-shadow:0 0 0 1px rgba(255,210,63,.6)}
#chefe-hud .rod{display:flex;justify-content:space-between;margin-top:3px;font:600 .66rem/1 var(--fm,monospace);letter-spacing:.1em;text-transform:uppercase;color:#E8E2D6}
#chefe-hud .pf b{color:#FFD23F}#chefe-hud .esc b{color:#7FE8FF}
#chefe-hud.dorme .fs{color:#7FE8FF;font-size:.8rem}#chefe-hud.dorme .hp{filter:saturate(.35) brightness(.8)}
#hints.abaixo-chefe{top:calc(var(--chefe-fim,0px) + 6px)!important}
#chefe-hud.jan .br{border-color:#E07CFF;box-shadow:0 0 12px rgba(224,124,255,.6)}
#chefe-av{position:fixed;left:50%;top:32%;transform:translate(-50%,-50%);z-index:6;pointer-events:none;text-align:center;opacity:0;transition:opacity .25s}
#chefe-av.on{opacity:1}
#chefe-av .k{font:600 .78rem/1.2 var(--fm,monospace);letter-spacing:.3em;text-transform:uppercase;color:#FFD23F;text-shadow:0 1px 3px #000}
#chefe-av .n{font-family:var(--fd,inherit);font-weight:800;font-size:clamp(1.6rem,4.6vw,3rem);text-transform:uppercase;color:#fff;letter-spacing:.04em;text-shadow:0 2px 14px rgba(0,0,0,.9),0 0 2px #000}
#chefe-av .ln{height:3px;width:200px;margin:.35rem auto 0;background:linear-gradient(90deg,transparent,#FFD23F,transparent)}
#chefe-av.jan .k,#chefe-av.jan .n{color:#F3B8FF}
body.cine-on #chefe-hud,body.cine-on #chefe-av{visibility:hidden}
@media (max-width:700px){#chefe-hud{top:calc(env(safe-area-inset-top,0px) + 90px);width:auto;left:58px;right:130px;transform:none;padding:4px 7px 5px}#chefe-hud .cab{flex-direction:column;align-items:flex-start;gap:1px}#chefe-hud .nm{font-size:.9rem}#chefe-hud .fs{font-size:.6rem;letter-spacing:.06em}#chefe-hud .ti{display:none}#chefe-hud .br{height:12px}#chefe-hud .rod{font-size:.6rem;letter-spacing:.04em}}
@media (orientation:landscape) and (max-height:500px){#chefe-hud{top:calc(env(safe-area-inset-top,0px) + 110px);width:min(320px,38vw);left:auto;right:calc(env(safe-area-inset-right,0px) + 130px);transform:none;padding:4px 7px 5px}#chefe-hud .ti{display:none}#chefe-hud .nm{font-size:.9rem}#chefe-hud .fs{font-size:.6rem}#chefe-hud .br{height:11px}#chefe-av{top:40%}}
`;
let H = null; const HS = { id: -1, nome: '', hp: -1, es: -1, pf: -1, fase: -1, jan: null, lim: '', dorme: -1 };
function monta() { if (H) return H; if (!document.getElementById('chefe-css')) { const st = document.createElement('style'); st.id = 'chefe-css'; st.textContent = CSS; document.head.appendChild(st); }
  const d = document.createElement('div'); d.id = 'chefe-hud'; d.hidden = true; d.setAttribute('role', 'status');
  d.innerHTML = '<div class="cab"><span class="nm"></span><span class="ti"></span><span class="fs"></span></div><div class="br"><div class="rc"></div><div class="hp"></div><div class="es"></div><div class="mks"></div></div><div class="rod"><span class="esc"></span><span class="pf"></span></div>';
  const av = document.createElement('div'); av.id = 'chefe-av'; av.setAttribute('aria-live', 'polite'); av.innerHTML = '<div class="k"></div><div class="n"></div><div class="ln"></div>';
  (document.getElementById('game') || document.body).appendChild(d); (document.getElementById('game') || document.body).appendChild(av);
  H = { d, nm: d.querySelector('.nm'), ti: d.querySelector('.ti'), fs: d.querySelector('.fs'), hp: d.querySelector('.hp'), rc: d.querySelector('.rc'), es: d.querySelector('.es'), mks: d.querySelector('.mks'), esc: d.querySelector('.esc'), pf: d.querySelector('.pf'), av, avK: av.querySelector('.k'), avN: av.querySelector('.n'), avT: 0 }; return H; }
const setT = (el, v) => { v = String(v); if (el.textContent !== v) el.textContent = v; };
const setX = (el, f) => { const v = 'scaleX(' + Math.max(0, Math.min(1, f)).toFixed(3) + ')'; if (el.style.transform !== v) el.style.transform = v; };
function anuncia(k, n, jan, dur) { const h = monta(); setT(h.avK, k); setT(h.avN, n); h.av.classList.toggle('jan', !!jan); h.av.classList.add('on'); h.avT = performance.now() + (dur || 2600); }
function barra(sim, human) {
  const h = monta(); const b = CH.chaves.barra ? CH.bossOf(sim) : null; if (!b || !b.boss) { if (!h.d.hidden) h.d.hidden = true; HS.id = -1; return null; }
  const bb = b.boss, tipo = bb.tipo; if (h.d.hidden) h.d.hidden = false;
  if (HS.id !== b.id || HS.nome !== ARD.idioma) { HS.id = b.id; HS.nome = ARD.idioma; setT(h.nm, nomeDe(tipo)); setT(h.ti, tituloDe(tipo)); const lim = limiares(tipo); h.mks.innerHTML = lim.map(l => '<i class="mk" style="left:' + (l * 100).toFixed(1) + '%"></i>').join(''); HS.fase = -1; HS.dorme = -1; /* 5.0g.1 */ HS.pf = -1; HS.es = -1; HS.jan = null; }
  const dorme = bb.dorme > sim.time ? Math.ceil(bb.dorme - sim.time) : 0; /* 5.0g.1: Caçada, contagem do despertar no lugar da fase */
  if (dorme !== HS.dorme) { HS.dorme = dorme; HS.fase = -1; h.d.classList.toggle('dorme', dorme > 0); if (dorme > 0) setT(h.fs, T('chefe.ui.desperta', { t: Math.floor(dorme / 60) + ':' + String(dorme % 60).padStart(2, '0') }, 'Desperta em ' + Math.floor(dorme / 60) + ':' + String(dorme % 60).padStart(2, '0'))); }
  const f = fase(b); if (!dorme && f !== HS.fase) { HS.fase = f; setT(h.fs, T('chefe.ui.fase', { n: f }, 'Fase ' + f) + ' · ' + T('chefe.' + tipo + '.fase.' + f, null, '')); }
  const fr = b.hp / Math.max(1, b.maxHp); if (Math.abs(fr - HS.hp) > 0.0005) { HS.hp = fr; setX(h.hp, fr); setX(h.rc, fr); }
  const em = bb.escudoMax || 0, es = em > 0 ? Math.max(0, bb.escudo || 0) / em : 0; if (Math.abs(es - HS.es) > 0.002) { HS.es = es; setX(h.es, es); setT(h.esc, es > 0 ? '' : ''); if (es > 0) h.esc.innerHTML = T('chefe.ui.escudo', null, 'Escudo') + ' <b>' + Math.round(es * 100) + '%</b>'; else setT(h.esc, ''); }
  let pf = 0; for (const e of sim.ents) if (e.alive && e.parte && e.parte.chefe === b.id && e.parte.tipo !== 'nucleo') pf++;
  if (pf !== HS.pf) { HS.pf = pf; if (pf > 0) h.pf.innerHTML = T('chefe.ui.pontos', null, 'Pontos fracos') + ' <b>◆ ' + pf + '</b>'; else setT(h.pf, ''); }
  const jan = !!bb.janela; if (jan !== HS.jan) { HS.jan = jan; h.d.classList.toggle('jan', jan); }
  return b; }

/* ---------- eventos e quadro (src/main.js) ---------- */
let musicaMinha = false, ultFase = new Map();
CH.eventos = function (ev, G) { if (!ev || !ev.length || !G || !G.sim) return; const sim = G.sim;
  for (let i = 0; i < ev.length; i++) { const e = ev[i];
    if (e.t === 'chefe') { const tipo = e.tipo || (sim.byId && sim.byId.get(e.id) && sim.byId.get(e.id).boss ? sim.byId.get(e.id).boss.tipo : '');
      if (e.ev === 'entra') { const u = sim.byId && sim.byId.get(e.id); try { if (ARD.audio && ARD.audio.sfx) ARD.audio.sfx('danger'); } catch (er) {}
        if (u && ARD.cinema && ARD.cinema.ligada && ARD.cinema.ligada('chefe')) ARD.cinema.chefe(G, u, { nome: nomeDe(tipo), epiteto: tituloDe(tipo), cor: tipo === 'forja' ? '#FF9A3A' : tipo === 'sentinela' ? '#FFC24A' : '#9FE8FF', kicker: T('cine.chefao', null, 'Chefão') + ' · ' + T('chefe.ui.fenda', null, 'Da Fenda') });
        else anuncia(T('cine.chefao', null, 'Chefão'), nomeDe(tipo), false, 3000); }
      else if (e.ev === 'fase') { const f = Math.max(1, e.fase | 0 || 1); if (ultFase.get(e.id) === f) continue; ultFase.set(e.id, f); if (f > 1) { anuncia(T('chefe.ui.fase', { n: f }, 'Fase ' + f), T('chefe.' + tipo + '.fase.' + f, null, ''), false, 2800); try { ARD.audio && ARD.audio.sfx && (ARD.audio.sfx('storm'), ARD.audio.sfx('danger')); } catch (er) {} if (G.R) G.R.shake = Math.max(G.R.shake || 0, 0.6); } }
      else if (e.ev === 'desperta') { anuncia(nomeDe(tipo), T(e.atacado ? 'chefe.ui.despertou-atacado' : 'chefe.ui.despertou', null, 'Despertou!'), false, 2800); try { ARD.audio && ARD.audio.sfx && ARD.audio.sfx('danger'); } catch (er) {} if (G.R) G.R.shake = Math.max(G.R.shake || 0, 0.5); } /* 5.0g.1 */
      else if (e.ev === 'janela') { anuncia(T('chefe.ui.janela-k', null, 'Agora!'), T('chefe.ui.janela', null, 'Janela de dano'), true, 2000); try { ARD.audio && ARD.audio.sfx && ARD.audio.sfx('promote'); } catch (er) {} }
      else if (e.ev === 'morre') { anuncia(nomeDe(tipo), T('chefe.ui.derrotado', null, 'Derrotado'), false, 3600); try { ARD.audio && ARD.audio.sfx && ARD.audio.sfx('explosion'); } catch (er) {} if (G.R) G.R.shake = Math.max(G.R.shake || 0, 1); } }
    else if (e.t === 'aviso') { const now = performance.now(); if (now - (CH._somAv || 0) > 1200) { CH._somAv = now; try { ARD.audio && ARD.audio.sfx && ARD.audio.sfx('alert'); } catch (er) {} } } } };
/* 5.0g.1: a dica do tutorial (#hints) desce para baixo da barra do chefe quando as duas dividem a mesma faixa da tela (celular em pé e o
   computador); conferido a cada 0,4 s, sem mexer no layout a cada quadro */
let dicaT = 0; function dicaAbaixo(b) { const hi = document.getElementById('hints'); if (!hi) return; const nt = performance.now(); if (nt - dicaT < 400) return; dicaT = nt;
  let fim = 0; if (b && H && !H.d.hidden && !hi.hidden && hi.offsetParent) { const a = H.d.getBoundingClientRect(), d = hi.getBoundingClientRect(); if (a.height > 0 && d.left < a.right && d.right > a.left) fim = Math.ceil(a.bottom); }
  if (fim) { hi.style.setProperty('--chefe-fim', fim + 'px'); hi.classList.add('abaixo-chefe'); } else if (hi.classList.contains('abaixo-chefe')) hi.classList.remove('abaixo-chefe'); }
CH.quadro = function (now, dt, G) { if (!G || !G.sim) return; const sim = G.sim; if (!CH.temChefe(sim) && !H) return;
  const b = barra(sim, G.human); if (H && H.avT && performance.now() > H.avT) { H.avT = 0; H.av.classList.remove('on'); } dicaAbaixo(b); /* 5.0g.1 */
  /* música: o tema do chefão enquanto ele vive (fora das cenas, que trocam a música sozinhas) */
  const M = ARD.musica; if (!M || typeof M.cena !== 'function') return; const cine = ARD.cinema && ARD.cinema.ativa && ARD.cinema.ativa();
  if (b && !G.ended) { if (!cine) { const st = M.estado ? M.estado() : null; if (!st || st.cena !== 'chefao') { M.cena('chefao'); musicaMinha = true; } } }
  else if (musicaMinha && !cine) { musicaMinha = false; const st = M.estado ? M.estado() : null; if (st && st.cena === 'chefao') M.cena(null); } };
})(globalThis.ARD = globalThis.ARD || {});
