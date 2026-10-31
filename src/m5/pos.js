/* Aether Rift: Dominion — Motor 5 (5.0a, fase 1): pós-processamento no RenderPipeline do three r186 (o PostProcessing virou RenderPipeline no r183).
   Mesma cadeia do buildPP de hoje: cena → oclusão ambiente (GTAONode; meia resolução no Média) → bruma de altura e perspectiva aérea
   (a ArdAtmo portada para TSL, com sombras de nuvem) → bloom (BloomNode) → gradação por clima, noite e Raça → tons ACES (renderOutput)
   → SMAA (FXAA no celular). Opção preparada: ?m5up=fsr1 troca a resolução dinâmica do renderer pela do passe da cena e sobe com o FSR1.
   O objeto devolvido imita o composer do clássico (render, setSize, dispose) e expõe atmoFx.U e gradeFx.U com as mesmas chaves,
   para o render3d atualizar os uniforms sem mudar de código. */
(function (ARD) {
'use strict';
const M5 = ARD.m5 = ARD.m5 || {};
const Q = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
M5.up = Q.get('m5up') === 'fsr1' ? 'fsr1' : null; /* TAAU fica para quando houver o passe de velocidade (fase 3) */
/* ---------- 5.0b.1: bloom igual ao do clássico ----------
   O clássico usa o BloomEffect do pmndrs (postprocessing 6.39.5, mipmapBlur): limiar pela luminância em resolução cheia (a cor vezes
   smoothstep(1, 1,35, luminância)), 8 níveis que reduzem à metade com o filtro de 13 amostras (sem as amostras de fora da imagem), a volta
   com uma tenda de 9 amostras misturada ao nível do mesmo tamanho (mix(nível, ampliado, 0,72): pesos 0,28 · 0,20 · 0,15 · 0,10 · 0,08 · 0,05 ·
   0,04 · 0,10, que somam 1) e a mistura "screen" do pmndrs (base + bloom − min(base × bloom, 1)) com intensidade 0,75. O BloomNode do r186
   (o UnrealBloomPass) limiava em meia resolução, espalhava em 5 gaussianas com quase o mesmo peso (raio 0,62: 0,50 a 0,70) e somava
   0,55 × 3 = 1,65 vez a luz que passa do limiar, 2,2 vezes a do clássico, com a maior parte em halos de 40 a 250 px. Aqui o mesmo
   algoritmo do pmndrs em TSL, com 3 materiais (limiar, redução e ampliação: um pipeline cada) no lugar dos 7 do BloomNode.
   Mesma interface do BloomNode para o Modo Foto (src/m5/foto.js): strength (o brilho do painel), set/getResolutionScale (fotos 2K e 4K
   com o mesmo tamanho relativo), setSize e dispose. ?m5bloom=antigo volta ao BloomNode da 5.0b (comparação no aparelho). */
M5.bloomAntigo = Q.get('m5bloom') === 'antigo';
let BloomC = null;
M5.bloomClassico = function (entrada, o) {
  if (!BloomC) { const Tm = window.THREE_M5, L = window.TSL; const { Fn, vec2, uv, uniform, texture, luminance, smoothstep, mix, step, passTexture, context } = L;
    const quad = new Tm.QuadMesh(); const tam = new Tm.Vector2(); let estado; /* undefined: o resetRendererState do r186 só cria o estado sem argumento */
    const alvo = nome => { const t = new Tm.RenderTarget(1, 1, { depthBuffer: false, type: Tm.HalfFloatType }); t.texture.name = nome; t.texture.generateMipmaps = false; return t; };
    BloomC = class ArdBloomNode extends Tm.TempNode {
      static get type() { return 'ArdBloomNode'; }
      constructor(inputNode, op) { super('vec4'); op = op || {};
        this.inputNode = inputNode;
        this.strength = uniform(op.intensidade != null ? op.intensidade : 0.75); /* intensity do pmndrs (o nome do BloomNode: o Modo Foto muda) */
        this.radius = uniform(op.raio != null ? op.raio : 0.72); this.threshold = uniform(op.limiar != null ? op.limiar : 1); this.smoothWidth = uniform(op.suave != null ? op.suave : 0.35);
        this.niveis = op.niveis || 8; this._escala = 1; /* o limiar em resolução cheia, como o LuminancePass do pmndrs */
        this._lum = alvo('ard-bloom-limiar'); this._desce = []; this._sobe = [];
        for (let i = 0; i < this.niveis; i++) this._desce.push(alvo('ard-bloom-desce' + i));
        for (let i = 0; i < this.niveis - 1; i++) this._sobe.push(alvo('ard-bloom-sobe' + i)); /* o sobe0 (metade da tela) é a saída */
        this._saida = passTexture(this, this._sobe[0].texture);
        this._mLum = null; this._mDesce = null; this._mSobe = null;
        this.updateBeforeType = Tm.NodeUpdateType.FRAME; }
      getTextureNode() { return this._saida; }
      setResolutionScale(s) { this._escala = s; return this; }
      getResolutionScale() { return this._escala; }
      setSize(w, h) { let x = Math.max(1, Math.round(w * this._escala)), y = Math.max(1, Math.round(h * this._escala)); this._lum.setSize(x, y);
        for (let i = 0; i < this.niveis; i++) { x = Math.max(1, Math.round(x * 0.5)); y = Math.max(1, Math.round(y * 0.5)); this._desce[i].setSize(x, y); if (i < this._sobe.length) this._sobe[i].setSize(x, y); } } /* Math.round(0,5 × lado) por nível, como o MipmapBlurPass */
      updateBefore(frame) { const r = frame.renderer; estado = Tm.RendererUtils.resetRendererState(r, estado);
        const s = r.getDrawingBufferSize(tam); this.setSize(s.width, s.height);
        r.setRenderTarget(this._lum); quad.material = this._mLum; quad.render(r);
        let ent = this._lum; const D = this._mDesce, S = this._mSobe;
        quad.material = D; for (let i = 0; i < this._desce.length; i++) { D.ardTex.value = ent.texture; D.ardTexel.value.set(1 / ent.width, 1 / ent.height); r.setRenderTarget(this._desce[i]); quad.render(r); ent = this._desce[i]; }
        quad.material = S; for (let i = this._sobe.length - 1; i >= 0; i--) { S.ardTex.value = ent.texture; S.ardBase.value = this._desce[i].texture; S.ardTexel.value.set(1 / ent.width, 1 / ent.height); r.setRenderTarget(this._sobe[i]); quad.render(r); ent = this._sobe[i]; }
        Tm.RendererUtils.restoreRendererState(r, estado); }
      setup(builder) { const ctx = context(builder.getSharedContext()); const nm = (n, f) => { const m = new Tm.NodeMaterial(); m.contextNode = ctx; m.fragmentNode = f; if (M5.registrar) M5.registrar(n, m); else m.name = 'ard-' + n; return m; };
        /* limiar: a cor vezes smoothstep(limiar, limiar + suave, luminância), como o LuminanceMaterial com colorOutput */
        if (!this._mLum) this._mLum = nm('bloom-limiar', Fn(() => { const c = this.inputNode; return c.mul(smoothstep(this.threshold, this.threshold.add(this.smoothWidth), luminance(c.rgb))); })());
        /* redução: o DownsamplingMaterial do pmndrs (4 amostras de dentro × 0,125, 8 de fora e o centro × 0,05556; fora da imagem pesa 0) */
        if (!this._mDesce) { const tx = texture(this._lum.texture), tl = uniform(new Tm.Vector2(1, 1)); const W1 = 0.125, W2 = 0.05556;
          this._mDesce = nm('bloom-desce', Fn(() => { const c = uv(); const borda = p => step(0, p.x).mul(step(p.x, 1)).mul(step(0, p.y)).mul(step(p.y, 1));
            const a = (dx, dy, w) => { const p = c.add(tl.mul(vec2(dx, dy))); return tx.sample(p).mul(borda(p).mul(w)); };
            return a(-1, 1, W1).add(a(1, 1, W1)).add(a(-1, -1, W1)).add(a(1, -1, W1)).add(a(-2, 2, W2)).add(a(0, 2, W2)).add(a(2, 2, W2)).add(a(-2, 0, W2)).add(a(2, 0, W2)).add(a(-2, -2, W2)).add(a(0, -2, W2)).add(a(2, -2, W2)).add(tx.sample(c).mul(W2)); })());
          this._mDesce.ardTex = tx; this._mDesce.ardTexel = tl; }
        /* ampliação: o UpsamplingMaterial do pmndrs (tenda 3×3 no nível de baixo) misturado ao nível do mesmo tamanho pelo raio */
        if (!this._mSobe) { const tx = texture(this._lum.texture), bs = texture(this._lum.texture), tl = uniform(new Tm.Vector2(1, 1));
          this._mSobe = nm('bloom-sobe', Fn(() => { const c = uv(); const t = (dx, dy, w) => tx.sample(c.add(tl.mul(vec2(dx, dy)))).mul(w);
            const soma = t(-1, 1, 0.0625).add(t(0, 1, 0.125)).add(t(1, 1, 0.0625)).add(t(-1, 0, 0.125)).add(tx.sample(c).mul(0.25)).add(t(1, 0, 0.125)).add(t(-1, -1, 0.0625)).add(t(0, -1, 0.125)).add(t(1, -1, 0.0625));
            return mix(bs.sample(c), soma, this.radius); })());
          this._mSobe.ardTex = tx; this._mSobe.ardBase = bs; this._mSobe.ardTexel = tl; }
        return this._saida; }
      dispose() { super.dispose(); for (const t of [this._lum].concat(this._desce, this._sobe)) t.dispose(); for (const m of [this._mLum, this._mDesce, this._mSobe]) if (m) m.dispose(); }
    }; }
  return new BloomC(window.TSL.nodeObject(entrada), o);
};
M5.buildPost = function (X, scene, camera, q, opts) {
  opts = opts || {}; const Tm = window.THREE_M5, L = window.TSL, A = window.THREE_M5_ADDONS; const r = X.renderer;
  const { pass, uniform, texture, float, vec2, vec3, vec4, mix, smoothstep, clamp, max, min, exp, abs, pow, dot, length, distance, uv, getViewPosition, renderOutput, step, luminance, convertToTexture } = L;
  const S = ARD.sim, off = opts.off || new Set();
  const pipe = new Tm.RenderPipeline(r); pipe.outputColorTransform = false; /* tons e espaço de cor no fim da cadeia, antes do SMAA (como no clássico) */
  /* bruma de altura com perspectiva aérea (integral exata ao longo do raio), luz do sol espalhada e sombras de nuvem: a ArdAtmo em TSL */
  const U = { uAtProjInv: uniform(new Tm.Matrix4()), uAtCamWorld: uniform(new Tm.Matrix4()), uAtFog: uniform(new Tm.Color(0.6, 0.66, 0.74)), uAtFar: uniform(new Tm.Color(0.6, 0.66, 0.74)), uAtSun: uniform(new Tm.Color(0.25, 0.2, 0.12)), uAtSunDir: uniform(new Tm.Vector3(-0.4, 0.7, 0.5).normalize()), uAtP: uniform(new Tm.Vector4(1 / 2600, 1 / 70, 0, 120)), uAtQ: uniform(new Tm.Vector4(1 / 14000, S ? S.WORLD : 6000, 0, 0.2)), uAtCloud: texture(opts.cloud || M5.tex.nuvem.value), uAtCov: uniform(0) };
  const atmo = (ic0, dz) => { /* função JS que monta o grafo, sem ramos (select/If com amostra de textura dentro saía preto nos dois motores) */
    const ic = vec4(max(ic0.rgb, vec3(0)), ic0.a); const cov = U.uAtCov.mul(clamp(float(1).sub(ic.a), 0, 1));
    const vp = getViewPosition(uv(), dz, U.uAtProjInv); const wp = U.uAtCamWorld.mul(vec4(vp, 1)).xyz; const co = U.uAtCamWorld.element(3).xyz;
    const rd0 = wp.sub(co), dist = length(rd0), rd = rd0.div(max(dist, 0.001)); const d = max(0, dist.sub(U.uAtP.w));
    const a = U.uAtP.x.mul(exp(U.uAtP.y.negate().mul(co.y.sub(U.uAtP.z)))); const b = U.uAtP.y.mul(rd.y);
    const x = b.mul(d), xs = max(abs(x), 0.0001).mul(step(0, x).mul(2).sub(1)); const od = a.mul(d).mul(float(1).sub(exp(xs.negate())).div(xs)).add(U.uAtQ.x.mul(d)); /* a·(1−e^(−b·d))/b sem ramo (b·d perto de zero tende a a·d) */
    const fog = min(float(1).sub(exp(max(od, 0).negate())), 0.85); const sd = pow(max(dot(rd, U.uAtSunDir), 0), 7);
    const fc = mix(U.uAtFog, U.uAtFar, smoothstep(700, 2600, dist)).add(U.uAtSun.mul(sd));
    const cl = U.uAtCloud.sample(vec2(wp.x, wp.z.negate()).div(U.uAtQ.y).mul(5).add(vec2(U.uAtQ.z.mul(0.006), U.uAtQ.z.mul(0.0035)))).r;
    const shade = float(1).sub(U.uAtQ.w.mul(float(1).sub(cov)).mul(float(1).sub(cl)).mul(float(1).sub(smoothstep(1800, 2600, dist)))); /* além de 2600 o fator já é 1 */
    let out = vec4(mix(ic.rgb.mul(shade), fc, fog.mul(float(1).sub(cov.mul(0.8)))), 1);
    const dbg = opts.atmoDbg || 0; if (dbg === 1) out = vec4(ic.rgb, 1); else if (dbg === 2) out = vec4(vec3(fog), 1); else if (dbg === 3) out = vec4(vec3(dist.div(3000)), 1); else if (dbg === 4) out = vec4(vec3(shade), 1); else if (dbg === 5) out = vec4(fc, 1); else if (dbg === 6) out = vec4(vec3(dz), 1); else if (dbg === 7) out = vec4(co.div(2000).abs(), 1); else if (dbg === 8) out = vec4(wp.div(6000).abs(), 1); /* diagnóstico (R.m5post) */
    return mix(out, vec4(ic.rgb, 1), step(0.999999, dz)); /* céu (sem profundidade) fica de fora; sem select: o ConditionalNode com amostra de textura dentro saía preto */
  };
  /* gradação (linear, antes dos tons): ganho por canal, elevação, saturação, contraste em torno de 0,18 e vinheta; muda com o clima, a noite e a Raça */
  const GU = { uGain: uniform(new Tm.Vector3(1.03, 1.0, 0.97)), uLift: uniform(new Tm.Vector3(0, 0, 0.004)), uSat: uniform(1.08), uCon: uniform(1.06), uVig: uniform(0.28) };
  const touch = matchMedia('(pointer: coarse)').matches;
  const cauda = src => { let c = src, bloomN = null; /* bloom → gradação → tons → AA */
    if (!off.has('bloom') && M5.bloomAntigo && A.bloom) { bloomN = A.bloom(c, 0.55, 0.62, 1.0); bloomN.smoothWidth.value = 0.35; c = vec4(c.rgb.add(bloomN.rgb), 1); } /* ?m5bloom=antigo: o BloomNode da 5.0b */
    else if (!off.has('bloom')) { bloomN = M5.bloomClassico(c); const b = bloomN.rgb.mul(bloomN.strength); c = vec4(c.rgb.add(b).sub(min(c.rgb.mul(b), 1)), 1); } /* 5.0b.1: o bloom do clássico (BloomEffect do pmndrs, mipmapBlur) e a mistura "screen" dele */
    { let col = c.rgb.mul(GU.uGain).add(GU.uLift); const l = luminance(col); col = mix(vec3(l), col, GU.uSat); col = pow(max(col.div(0.18), vec3(0)), vec3(GU.uCon)).mul(0.18); const dv = distance(uv(), vec2(0.5)); col = col.mul(float(1).sub(GU.uVig.mul(smoothstep(0.35, 0.85, dv)))); c = vec4(col, 1); }
    c = renderOutput(c); /* ACES do renderer (toneMapping) e sRGB (outputColorSpace) */
    if (!off.has('aa')) c = touch ? A.fxaa(c) : A.smaa(c);
    return { c, bloomN }; };
  /* 5.0b: a cadeia inteira numa função (P.cadeia): a partida monta uma; o Modo Foto (src/m5/foto.js) monta outra igual, com os mesmos
     uniforms e nós próprios (nós do pós divididos entre dois RenderPipeline se remontam a cada troca e recriam pipelines), e o desfoque no
     meio: meio(hdr, passe) recebe a cena em HDR linear (AO e bruma) e devolve a entrada do bloom e da gradação */
  const cadeia = meio => {
    const sp = pass(scene, camera, { samples: 0 }); /* sem MSAA no passe: a profundidade é lida pelo GTAO e pela bruma */
    const color = sp.getTextureNode('output'), depth = sp.getTextureNode('depth');
    let base = color;
    if (M5.up === 'fsr1' && A.fsr1) base = A.fsr1(color, 0.25, false); /* sobe a cena da escala do passe para a tela (antes da bruma e do bloom) */
    let c = base; let aoN = null;
    if (q.ssao && A.ao && !off.has('ao')) { aoN = A.ao(depth, null, camera); aoN.resolutionScale = q.aoHalf ? 0.5 : 1; aoN.radius.value = 14; aoN.thickness.value = 9; aoN.distanceExponent.value = 1.4; aoN.distanceFallOff.value = 1; aoN.scale.value = 1.25; aoN.samples.value = q.aoHalf ? 12 : q.resolved === 'ultra' ? 24 : 16;
      const ao = aoN.getTextureNode().r; c = vec4(c.rgb.mul(mix(vec3(0.03, 0.025, 0.03), vec3(1), ao)), c.a); } /* sombra de contato puxando para o tom do N8AO de hoje */
    if (M5.clima && M5.clima.reflexo && !off.has('reflexo')) c = M5.clima.reflexo(c, color, depth, camera, q) || c; /* 5.0d: reflexo de tela nas poças da chuva (Alta e Ultra; src/m5/clima.js) */
    if (M5.nuvens && M5.nuvens.compor && !off.has('nuvens')) c = M5.nuvens.compor(c, depth, sp, camera, q); /* 5.0d: nuvens de guerra (src/m5/nuvens.js) entre a oclusão e a bruma; sem efeito na Baixa e no celular */
    if (!off.has('bruma')) c = atmo(c, depth.r); else c = vec4(max(c.rgb, vec3(0)), 1);
    if (M5.raiosSol && !off.has('raios')) { const rs = M5.raiosSol(c, depth, { camera, q, X }); if (rs) { c = rs.cor; sp.ardRaios = rs.no; } } /* 5.0d: raios de sol pela poeira e pela Tempestade (src/m5/ceu.js), só na Alta e na Ultra */
    c = convertToTexture(c); /* um alvo só para a cena com AO e bruma: o bloom e a gradação leem a mesma textura (a bruma não roda duas vezes) */
    const hdr = c, fim = cauda(meio ? meio(hdr, sp) : hdr);
    return { sp, aoN, hdr, bloomN: fim.bloomN, aa: fim.c };
  };
  const g = cadeia(null); const sp = g.sp, aoN = g.aoN, bloomN = g.bloomN, c = g.aa;
  const atmoFx = off.has('bruma') ? null : { U, name: 'ArdAtmo-TSL' };
  pipe.outputNode = vec4(c.rgb, 1);
  const P = { pipe, scenePass: sp, aoNode: aoN, bloomNode: bloomN, atmoFx, gradeFx: { U: GU, name: 'ArdGrade-TSL' }, scale: 1, cadeia, /* 5.0b: P.cadeia para o Modo Foto */
    render() { pipe.render(); },
    setSize() { /* os nós do pós seguem o tamanho do renderer sozinhos */ },
    setPixelRatio() {},
    setScale(s) { P.scale = s; sp.setResolutionScale(s); }, /* só com ?m5up=fsr1 (resolução dinâmica no passe da cena) */
    dispose() { try { pipe.dispose(); sp.dispose(); if (aoN) aoN.dispose(); if (bloomN) bloomN.dispose(); if (sp.ardRaios) sp.ardRaios.dispose(); /* 5.0d */ } catch (e) {} } };
  return P;
};
})(globalThis.ARD = globalThis.ARD || {});
