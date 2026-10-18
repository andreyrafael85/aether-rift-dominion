/* Aether Rift: Dominion — Tempestade de Éter volumétrica (4.3h).
   A simulação cria de tempos em tempos uma tempestade: sim.storm = { x, y, r (420), t, phase: 'warn' (aviso, 30 s) | 'active' (90 s), warn, dur }
   (drones e sensores a 50% dentro dela) e manda eventos { t: 'storm', phase: 'warn' | 'active' | 'end', x, y, r }. O render3d chama:
   - ST.event(e): eventos de tempestade
   - ST.update(dt, time, camera, storm, sim): a cada quadro (storm = sim.storm ou null)
   Ambiente (env): FX, flash(x, y, r, cor, força, vida, tremular), flashNow(x, y, r, cor, k) (luz só deste quadro; se faltar, usa flash), quality(), light(),
   H(x, y), lightning(k) (relâmpago que clareia a cena, 0..1). Ganchos: ST.onStrike(x, y, grande) a cada raio (som do trovão); ST.debug (testes).
   4.3h — como é feita:
   - volume: um único passe com marcha de raio curta (RawShaderMaterial: um programa só, compilado no carregamento, que não depende do
     tone mapping nem do alvo) dentro de um cilindro em volta da área. Dossel de nuvens de éter que gira devagar (giro rígido + cisalhamento:
     o centro gira mais rápido e os braços viram espiral), torres no paredão perto da borda que pegam o sol, base escura, olho aberto no centro
     com o funil de éter descendo até o chão, névoa que escurece a área com borda nítida, cortina de éter e poeira varrida na borda.
     Fora do cilindro a entrada é a face da frente (teste de profundidade correto para o que está na frente); com a câmera dentro ou perto,
     a entrada é uma esfera pequena em volta da câmera. Ruído 3D periódico (48³, forma + detalhe) gerado em fatias nos primeiros quadros;
     alturas do chão da área num mapa 64² (a marcha para no chão e a chuva cai até ele).
   - borda: faixa colada no relevo com linha elétrica e brilho correndo no sentido do giro (tracejada e pulsando no aviso).
   - chuva de éter: riscos na GPU (sem laço por gota na CPU), com respingo no chão; relâmpagos: canal com ramos (deslocamento do ponto médio),
     líder descendo e golpes de retorno, clarão no chão pelo mapa de clarões, nuvem acesa por dentro, faíscas e onda no chão; poeira pelo FX.
   Custo: até 4 chamadas de desenho com a tempestade na tela (volume, borda, chuva, raios); nada alocado por quadro; partículas pelo FX.mult. */
(function (ARD) {
'use strict';
const TAU = Math.PI * 2;
const NN = 48; /* 4.3h: lado do ruído 3D */
const HM = 64; /* lado do mapa de alturas da área */
const RP = 1.22; /* raio do cilindro do volume (× raio da área) */
const TOP = 470, FLOOR = -70; /* topo e piso da marcha, relativos ao chão da tempestade */
const RAIN_N = 2600, BOLT_SEG = 48, BOLT_N = 3; /* gotas (máximo), segmentos por raio, raios ao mesmo tempo */

/* 4.3h: ruído 3D periódico (canal r: forma = valor fbm + Worley; canal g: detalhe = Worley fino invertido) gerado em fatias */
function noiseMaker(N) {
  const data = new Uint8Array(N * N * N * 2);
  const hash = (i, s) => { let h = (i * 374761393 + s * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
  const valT = (p, s) => { const t = new Float32Array(p * p * p); for (let i = 0; i < t.length; i++) t[i] = hash(i, s); return { p, t }; };
  const featT = (c, s) => { const f = new Float32Array(c * c * c * 3); for (let i = 0; i < c * c * c; i++) { f[i * 3] = hash(i, s); f[i * 3 + 1] = hash(i, s + 1); f[i * 3 + 2] = hash(i, s + 2); } return { c, f }; };
  const V4 = valT(4, 101), V8 = valT(8, 102), V16 = valT(16, 103), W4 = featT(4, 201), W8 = featT(8, 301), W16 = featT(16, 302);
  function val(q, x, y, z) { const p = q.p, t = q.t; const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z); let fx = x - xi, fy = y - yi, fz = z - zi; fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy); fz = fz * fz * (3 - 2 * fz);
    const x0 = xi % p, x1 = (xi + 1) % p, y0 = (yi % p) * p, y1 = ((yi + 1) % p) * p, z0 = (zi % p) * p * p, z1 = ((zi + 1) % p) * p * p;
    const a = t[x0 + y0 + z0] + (t[x1 + y0 + z0] - t[x0 + y0 + z0]) * fx, b = t[x0 + y1 + z0] + (t[x1 + y1 + z0] - t[x0 + y1 + z0]) * fx, c = t[x0 + y0 + z1] + (t[x1 + y0 + z1] - t[x0 + y0 + z1]) * fx, d = t[x0 + y1 + z1] + (t[x1 + y1 + z1] - t[x0 + y1 + z1]) * fx;
    const e = a + (b - a) * fy, g = c + (d - c) * fy; return e + (g - e) * fz; }
  function wor(q, x, y, z) { const c = q.c, f = q.f; const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z); let m = 9;
    for (let dz = -1; dz <= 1; dz++) { const cz = zi + dz, wz = cz < 0 ? cz + c : cz >= c ? cz - c : cz; for (let dy = -1; dy <= 1; dy++) { const cy = yi + dy, wy = cy < 0 ? cy + c : cy >= c ? cy - c : cy; for (let dx = -1; dx <= 1; dx++) { const cx = xi + dx, wx = cx < 0 ? cx + c : cx >= c ? cx - c : cx; const i = (wx + wy * c + wz * c * c) * 3;
      const ex = cx + f[i] - x, ey = cy + f[i + 1] - y, ez = cz + f[i + 2] - z; const dd = ex * ex + ey * ey + ez * ez; if (dd < m) m = dd; } } }
    return Math.sqrt(m); }
  let z = 0; const k = 1 / N;
  function slice() { let o = z * N * N * 2; const w = z * k;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const u = x * k, v = y * k;
      const fb = val(V4, u * 4, v * 4, w * 4) * 0.57 + val(V8, u * 8, v * 8, w * 8) * 0.29 + val(V16, u * 16, v * 16, w * 16) * 0.14;
      const ws = 1 - Math.min(1, wor(W4, u * 4, v * 4, w * 4)); const sh = Math.max(0, Math.min(1, (fb * 0.55 + ws * 0.6 - 0.12 - 0.12) * 1.45));
      const wd = (1 - Math.min(1, wor(W8, u * 8, v * 8, w * 8))) * 0.62 + (1 - Math.min(1, wor(W16, u * 16, v * 16, w * 16))) * 0.38;
      data[o++] = Math.round(sh * 255); data[o++] = Math.round(Math.max(0, Math.min(1, (wd - 0.2) * 1.6)) * 255); }
    z++; }
  return { data, N, done: () => z >= N, step(ms) { const t0 = performance.now(); while (z < N) { slice(); if (performance.now() - t0 > ms) break; } return z >= N; } };
}

/* 4.3h: trechos de GLSL comuns (saída na tela: ACES igual ao do three + sRGB; no alvo do pós: linear) */
const GL_OUT = `
vec3 ardAces(vec3 c) { c *= 1.0 / 0.6; const mat3 mi = mat3(0.59719, 0.07600, 0.02840, 0.35458, 0.90834, 0.13383, 0.04823, 0.01566, 0.83777); const mat3 mo = mat3(1.60475, -0.10208, -0.00327, -0.53108, 1.10813, -0.07276, -0.07367, -0.00605, 1.07602);
  c = mi * c; vec3 a = c * (c + 0.0245786) - 0.000090537; vec3 b = c * (0.983729 * c + 0.4329510) + 0.238081; return clamp(mo * (a / b), 0.0, 1.0); }
vec3 ardOut(vec3 c, float scr) { if (scr < 0.5) return c; c = ardAces(c); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
`;

/* ---------- volume ---------- */
const VOL_VS = `precision highp float;
uniform mat4 modelMatrix; uniform mat4 viewMatrix; uniform mat4 projectionMatrix;
in vec3 position; out vec3 vW;
void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const VOL_FS = `precision highp float; precision highp sampler3D; precision highp sampler2D;
uniform vec3 cameraPosition;
uniform sampler3D uN; uniform sampler2D uHm;
uniform vec4 uC;   /* centro (x, chão G, z) e raio R da área */
uniform vec4 uHm4; /* mapa de alturas: 1/lado, altura mínima (rel. a G), faixa, piso da marcha (rel. a G) */
uniform vec4 uA;   /* forma (0..1), névoa, funil (0..1: desce do dossel até o chão), poeira */
uniform vec4 uB;   /* giro rígido (rad), cisalhamento (rad), subida do dossel (fim), escala radial do envelope */
uniform vec4 uD;   /* passos, entrada (0: face do cilindro; 1: esfera da câmera), saída na tela (ACES + sRGB), noite */
uniform vec4 uE;   /* limiar de cobertura, brilho do éter, cortina da borda, topo da marcha (rel. a G) */
uniform vec4 uF;   /* clarão na nuvem: posição local + força */
uniform vec3 uSunD; uniform vec3 uSunC; uniform vec3 uSkyC;
uniform float uT;
in vec3 vW; out vec4 oC;
const vec3 ETER = vec3(0.62, 0.24, 1.35), ELET = vec3(0.42, 0.66, 1.65), ALB = vec3(0.42, 0.34, 0.64);
float gAcc = 0.0; vec3 cAcc = vec3(0.0); float gT = 1.0; bool gHit = false; vec3 gRd = vec3(0.0, -1.0, 0.0); float gNfC = 1.0;
${GL_OUT}
float gnd(vec2 xz) { return uHm4.y + texture(uHm, xz * uHm4.x + 0.5).r * uHm4.z; }
vec2 slab(float oy, float dy, float y0, float y1) { if (abs(dy) < 1e-5) return (oy >= y0 && oy <= y1) ? vec2(-1e9, 1e9) : vec2(1e9, -1e9); float a = (y0 - oy) / dy, b = (y1 - oy) / dy; return vec2(min(a, b), max(a, b)); }
/* densidade (por unidade de mundo) e radiância do meio num ponto local p (y = altura sobre G); hg = altura sobre o chão */
float med(vec3 p, float hg, out vec3 col) {
  float R = uC.w * uB.w; float rr = length(p.xz); float rho = rr / R; float h = p.y; col = vec3(0.0);
  if (rho > 1.22) return 0.0;
  float dTot = 0.0; vec3 cTot = vec3(0.0);
  vec3 fl = uF.xyz - p; float fk = uF.w / (1.0 + dot(fl, fl) * (1.0 / 17000.0)); /* luz do relâmpago espalhada */
  float lift = uB.z;
  /* dossel: base escura e chata, camada média rala com braços em espiral, torres altas no anel perto da borda (pegam o sol), olho aberto */
  if (h > 100.0 + lift) {
    float ang = uB.x + uB.y / (0.42 + rho) + h * 0.0016; float ca = cos(ang), sa = sin(ang);
    vec2 q = vec2(ca * p.x - sa * p.z, sa * p.x + ca * p.z);
    vec3 nq = vec3(q.x, h * 1.5, q.y) * 0.0016; float n1 = texture(uN, nq).r;
    float tw = exp(-(rho - 0.79) * (rho - 0.79) * 34.0);
    float hb = 148.0 + lift - 26.0 * n1 + 24.0 * smoothstep(0.88, 1.12, rho);
    float hT = 205.0 + lift * 1.3 + tw * (70.0 + 190.0 * n1) + 40.0 * (n1 - 0.4) - 60.0 * (1.0 - smoothstep(0.12, 0.45, rho));
    if (h > hb - 26.0 && h < hT) {
      float n2 = uD.x < 10.0 ? 0.35 + 0.3 * n1 : texture(uN, nq * 2.6 + vec3(uT * 0.0021, -uT * 0.0034, 0.0)).g; /* versão leve: sem a busca do detalhe */
      float v = smoothstep(hb - 26.0, hb + 38.0, h) * (1.0 - smoothstep(hT - 80.0, hT, h)); /* base macia: vista de lado não vira um corte reto */
      float edge = 1.0 - smoothstep(0.98 + 0.08 * tw, 1.16, rho + (n2 - 0.5) * 0.14);
      float eye = smoothstep(0.1, 0.36, rho + (n1 - 0.5) * 0.2);
      float th = atan(p.z, p.x); float arms = sin(3.0 * (th + uB.x) + 5.5 * log(rho + 0.05)) * smoothstep(0.2, 0.5, rho) * (1.0 - tw);
      float c1 = n1 * 0.85 + 0.3 * tw + 0.22 * arms - (1.0 - v * edge * eye) * 0.75;
      float c2 = c1 - (n2 - 0.35) * 0.45 * (1.15 - c1);
      float den = smoothstep(uE.x, uE.x + 0.16, c2);
      if (den > 0.002) {
        float d = den * (0.0132 + 0.0168 * tw) * uA.x * gNfC;
        float hn = clamp((h - hb) / max(hT - hb, 1.0), 0.0, 1.0);
        vec2 sd = normalize(uSunD.xz + vec2(1e-5)); float bq = dot(p.xz, sd), rc = R * 1.12; float s = -bq + sqrt(max(bq * bq - rr * rr + rc * rc, 0.0));
        float od = min((hT - h) / max(uSunD.y, 0.25), s / max(length(uSunD.xz), 0.25)) * 0.04 * (0.15 + den);
        float sunT = exp(-od);
        if (uD.x > 9.5) { vec3 L = vec3(ca * uSunD.x - sa * uSunD.z, uSunD.y * 1.5, sa * uSunD.x + ca * uSunD.z) * (34.0 * 0.0016); float nS = texture(uN, nq + L).r; sunT *= clamp(0.55 + (n1 - nS) * 3.2, 0.12, 1.25); }
        float ph = 0.8 + 0.9 * pow(max(dot(gRd, uSunD), 0.0), 6.0), ao = 0.35 + 0.65 * smoothstep(0.0, 0.6, hn);
        vec3 c = vec3(0.4, 0.3, 0.68) * uSunC * sunT * ph * ao * 0.82 + ALB * uSkyC * vec3(0.45, 0.55, 1.05) * (0.04 + 0.22 * hn);
        float vein = pow(clamp(1.0 - abs(n2 - 0.52) * 3.2, 0.0, 1.0), 5.0) * smoothstep(0.3, 0.8, den) * smoothstep(0.5, 0.68, n1); /* veios de éter só em manchas */
        c += ETER * uE.y * ((0.02 + 0.04 * uD.w) * (1.0 - hn) + vein * (0.14 + 0.16 * uD.w) * (1.0 - hn * 0.6));
        c += ELET * fk * (0.5 + 0.5 * (1.0 - hn)) * 1.5;
        dTot += d; cTot += c * d;
      }
    }
  }
  /* embaixo: névoa da área, funil, cortina e poeira da borda */
  if (h < 175.0 + lift) {
    float ang = uB.x * 1.7 + uB.y * 1.3 / (0.3 + rho) + h * 0.004; float ca = cos(ang), sa = sin(ang);
    vec2 q = vec2(ca * p.x - sa * p.z, sa * p.x + ca * p.z);
    vec2 n = texture(uN, vec3(q.x, h * 0.55 - uT * 5.0, q.y) * 0.0021).rg;
    float inA = 1.0 - smoothstep(0.985, 1.0, rho);
    float cab = 0.5; /* quanto de dossel há em cima deste ponto (mesmo giro do dossel, na altura da base) */
    if (uD.x > 9.5) { float a2 = uB.x + uB.y / (0.42 + rho) + 0.26; float c2 = cos(a2), s2 = sin(a2); vec2 q2 = vec2(c2 * p.x - s2 * p.z, s2 * p.x + c2 * p.z); cab = smoothstep(0.38, 0.68, texture(uN, vec3(q2.x, 255.0, q2.y) * 0.0016).r) * smoothstep(0.1, 0.4, rho); }
    float hz = uA.y * inA * (0.36 + 0.9 * exp(-hg / 30.0)) * (0.55 + 0.9 * n.r) * (0.7 + 0.9 * cab) * (1.0 - smoothstep(130.0, 175.0, h - lift * 0.5));
    if (hz > 0.001) { float d = hz * 0.009; vec3 c = uSkyC * 0.05 + vec3(0.02, 0.008, 0.05) + ETER * 0.014 * uD.w + ELET * fk * 0.9; dTot += d; cTot += c * d; }
    float rs = uA.y * inA * cab * cab * smoothstep(0.35, 0.8, n.g) * (1.0 - smoothstep(120.0, 165.0, h - lift));
    if (rs > 0.001) { float d = rs * 0.006; vec3 c = ALB * uSkyC * 0.32 + ETER * 0.05 + ELET * fk * 0.7; dTot += d; cTot += c * d; }
    float bw = (rho - 1.0) * uC.w / 10.0; bw = exp(-bw * bw);
    float cur = uE.z * bw * exp(-max(hg, 0.0) / 34.0) * (0.35 + 1.1 * n.g);
    if (cur > 0.001) { float d = cur * 0.012; vec3 c = ETER * (0.9 + 0.8 * n.g) + ELET * fk; dTot += d; cTot += c * d; }
    float fb = mix(175.0, -40.0, uA.z); /* fundo do funil: desce do dossel até o chão quando a tempestade abre */
    if (uA.z > 0.001 && h > fb - 30.0) {
      float rcf = 0.045 + 0.16 * smoothstep(-10.0, 170.0, h) + 0.03 * sin(h * 0.05 + uT * 1.7);
      float x = rho / rcf + (n.g - 0.5) * 0.55;
      float df = (1.0 - smoothstep(0.55, 1.05, x)) * smoothstep(fb - 30.0, fb + 25.0, h) * uA.z;
      if (df > 0.001) { float st = 0.5 + 0.5 * sin(atan(p.z, p.x) * 3.0 + h * 0.06 - uT * 2.4 + n.r * 3.0); df *= 0.45 + 0.85 * st; float d = df * 0.022; float core = exp(-x * x * 3.0); float vein = pow(clamp(1.0 - abs(n.g - 0.5) * 3.0, 0.0, 1.0), 4.0) * st;
        vec3 c = ALB * (uSkyC * 0.18 + uSunC * 0.05) + ETER * (0.05 + 0.25 * core + 1.1 * vein) * (0.6 + 0.6 * n.r) * uE.y + ELET * (core * 0.12 + fk); dTot += d; cTot += c * d; }
    }
    float dr = (rho - 1.03) * 7.5; dr = exp(-dr * dr) * exp(-max(hg, 0.0) / 15.0) * uA.w * smoothstep(0.42, 0.78, n.r);
    if (dr > 0.001) { float d = dr * 0.011; vec3 c = vec3(0.4, 0.34, 0.33) * (uSunC * 0.3 + uSkyC * 0.55) + ETER * 0.05 + ELET * fk * 0.5; dTot += d; cTot += c * d; }
  }
  if (dTot <= 0.0) return 0.0;
  col = cTot / dTot; return dTot;
}
void seg(vec3 ro, vec3 rd, float ta, float tb, float stp, float nmax, float j, vec2 nf) {
  if (tb <= ta || gT < 0.03 || gHit) return;
  float n = clamp(ceil((tb - ta) / stp), 2.0, nmax); float dt = (tb - ta) / n; float t = ta + dt * j;
  for (int i = 0; i < 40; i++) {
    if (float(i) >= n || gT < 0.03) break;
    vec3 p = ro + rd * t; float g = gnd(p.xz);
    if (p.y < g) { gHit = true; break; }
    gNfC = smoothstep(nf.x + 40.0 * nf.y, nf.x + 230.0 * nf.y, t); vec3 c; float d = med(p, p.y - g, c) * smoothstep(nf.x, nf.x + 110.0 * nf.y, t);
    if (d > 0.0) { float a = 1.0 - exp(-d * dt); cAcc += gT * a * c; gT *= 1.0 - a; }
    t += dt;
  }
}
void main() {
  vec3 ro = cameraPosition - uC.xyz; vec3 rd = normalize(vW - cameraPosition); gRd = rd;
  float Rp = uC.w * ${RP.toFixed(2)};
  float a = dot(rd.xz, rd.xz), b = dot(ro.xz, rd.xz), cc = dot(ro.xz, ro.xz) - Rp * Rp; float disc = b * b - a * cc;
  if (disc <= 0.0 || a < 1e-8) discard;
  float sq = sqrt(disc); vec2 ty = slab(ro.y, rd.y, uHm4.w, uE.w);
  float tf = length(vW - cameraPosition);
  float t0 = max(max((-b - sq) / a, ty.x), uD.y > 0.5 ? tf : tf - 2.0), t1 = min((-b + sq) / a, ty.y);
  if (rd.y < 0.0) t1 = min(t1, (uHm4.y - 2.0 - ro.y) / rd.y);
  if (t1 <= t0) discard;
  uvec2 ui = uvec2(gl_FragCoord.xy); uint hs = ui.x * 1973u + ui.y * 9277u; hs = (hs << 13u) ^ hs; hs = hs * (hs * hs * 15731u + 789221u) + 1376312589u; float j = float(hs & 0xffffu) / 65536.0; /* ruído branco: grão sem padrão */
  vec2 nf = uD.y > 0.5 ? vec2(tf, 1.0) : vec2(-1e4, 0.0); /* x: início; y: 1 dentro (esmaece perto da câmera), 0 fora */
  float yb = 108.0 + uB.z; vec2 tb = slab(ro.y, rd.y, yb, uE.w), tl = slab(ro.y, rd.y, uHm4.w, yb);
  float b0 = max(t0, tb.x), b1 = min(t1, tb.y), l0 = max(t0, tl.x), l1 = min(t1, tl.y);
  /* passo alvo pela qualidade (uD.x): dossel 12/20/40, embaixo 18/30/60 unidades; teto de passos por trecho */
  float sb = uD.x > 20.0 ? 12.0 : uD.x > 12.0 ? 20.0 : 40.0, sl = sb * 1.5, mb = uD.x > 20.0 ? 40.0 : uD.x > 12.0 ? 28.0 : 12.0, ml = uD.x > 20.0 ? 24.0 : uD.x > 12.0 ? 14.0 : 8.0;
  if (rd.y < 0.0) { seg(ro, rd, b0, b1, sb, mb, j, nf); seg(ro, rd, l0, l1, sl, ml, j, nf); }
  else { seg(ro, rd, l0, l1, sl, ml, j, nf); seg(ro, rd, b0, b1, sb, mb, j, nf); }
  float al = 1.0 - gT; if (al < 0.003) discard;
  vec3 col = ardOut(cAcc / al, uD.z);
  oC = vec4(col * al, al);
}`;

/* ---------- borda (faixa colada no relevo) ---------- */
const RING_VS = `precision highp float;
uniform mat4 viewMatrix; uniform mat4 projectionMatrix;
in vec3 position; in vec3 aU; out vec3 vU;
void main() { vU = aU; gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0); }`;
const RING_FS = `precision highp float; precision highp sampler3D;
uniform sampler3D uN; uniform vec4 uK; /* força, aviso (0..1), tempo, giro */
uniform float uScr; in vec3 vU; out vec4 oC;
${GL_OUT}
void main() {
  float off = vU.y, u = vU.x;
  float core = exp(-off * off / 4.5), inner = off < 0.0 ? exp(off / 15.0) : exp(-off / 3.5);
  float fl = texture(uN, vec3(u * 7.0 + uK.w * 1.1, off * 0.012, uK.z * 0.015)).g;
  float fl2 = texture(uN, vec3(u * 19.0 - uK.z * 0.02, off * 0.03 + 0.3, uK.z * 0.03 + 0.5)).r;
  float dash = mix(1.0, smoothstep(0.25, 0.4, fract(u * 72.0 + uK.w * 3.0)) * (1.0 - smoothstep(0.75, 0.9, fract(u * 72.0 + uK.w * 3.0))), uK.y);
  float pulse = mix(1.0, 0.55 + 0.45 * sin(uK.z * (3.5 + 5.0 * uK.y)), uK.y);
  vec3 col = vec3(0.6, 0.78, 1.9) * core * (1.4 + 1.6 * fl2) * dash + vec3(0.62, 0.25, 1.45) * inner * (0.2 + 1.3 * fl * fl) * 0.55;
  col *= uK.x * pulse * vU.z;
  oC = vec4(ardOut(col, uScr), 1.0);
}`;

/* ---------- chuva de éter (riscos na GPU) ---------- */
const RAIN_VS = `precision highp float;
uniform mat4 viewMatrix; uniform mat4 projectionMatrix; uniform vec3 cameraPosition;
uniform sampler2D uHm; uniform vec4 uHm4; uniform vec4 uC; uniform vec4 uR; /* fração de gotas, vento, brilho, giro */ uniform float uT;
in vec3 position; in vec4 aR; out vec2 vQ; out float vA; out float vS;
float h1(float n) { return fract(sin(n) * 43758.5453); }
void main() {
  vQ = position.xy; vA = 0.0; vS = 0.0;
  if (aR.x > uR.x) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  float fall = 175.0 + 25.0 * aR.z, spd = 330.0 + 140.0 * aR.y, per = fall / spd + 0.12;
  float cyc = uT / per + aR.w * 17.0; float k = fract(cyc), ci = floor(cyc);
  float s1 = h1(aR.x * 911.0 + ci * 12.9898), s2 = h1(aR.x * 577.0 + ci * 78.233);
  float rr = sqrt(s1) * 0.985 * uC.w, th = s2 * 6.2831853;
  vec2 lp = vec2(cos(th), sin(th)) * rr; vec2 tg = vec2(lp.y, -lp.x) / max(rr, 1.0);
  float g = uHm4.y + texture(uHm, lp * uHm4.x + 0.5).r * uHm4.z; float yTop = max(fall, g + 40.0); float vd = g < uHm4.w - 3.0 ? 1.0 : 0.0; /* abismo: sem respingo */
  float kf = (fall + 0.12 * spd) / fall; float kk = k * kf; /* parte do ciclo caindo; o resto é o respingo */
  vec3 P; vec3 C = vec3(uC.x, uC.y, uC.z);
  if (kk < 1.0) {
    float y = mix(yTop, g, kk); vec2 w = tg * uR.y; vec2 xz = lp + w * (1.0 - kk) * per * 0.6;
    vec3 head = C + vec3(xz.x, y, xz.y); vec3 vel = normalize(vec3(w.x, -spd, w.y)); float len = 9.0 + 9.0 * aR.y;
    vec3 tail = head - vel * len; vec3 mid = mix(tail, head, position.y + 0.5);
    vec3 side = normalize(cross(vel, cameraPosition - mid)); float wd = max(0.45, 0.0019 * length(cameraPosition - mid));
    P = mid + side * position.x * wd; vA = (position.y + 0.5) * smoothstep(0.0, 0.08, kk) * (1.0 - vd * smoothstep(0.5, 1.0, kk)) * uR.z; vS = 0.0;
  } else {
    float ks = clamp((cyc - floor(cyc)) * kf - 1.0, 0.0, 1.0) / max(kf - 1.0, 0.01); ks = clamp(ks, 0.0, 1.0);
    float s = 0.8 + 2.6 * ks; P = C + vec3(lp.x + position.x * 2.0 * s, g + 0.8, lp.y - position.y * 2.0 * s); vA = (1.0 - ks) * uR.z * (1.0 - vd) * step(0.6, fract(aR.z * 7.0)) * 0.8; vS = 1.0;
  }
  gl_Position = projectionMatrix * viewMatrix * vec4(P, 1.0);
}`;
const RAIN_FS = `precision highp float;
uniform float uScr; in vec2 vQ; in float vA; in float vS; out vec4 oC;
${GL_OUT}
void main() {
  float a;
  if (vS > 0.5) { float r = length(vQ) * 2.0; a = smoothstep(0.55, 0.85, r) * (1.0 - smoothstep(0.85, 1.0, r)) * vA * 0.9; }
  else { float x = abs(vQ.x) * 2.0; a = (1.0 - x * x) * vA; }
  if (a < 0.004) discard;
  oC = vec4(ardOut(vec3(0.34, 0.36, 1.2) * a * 0.62, uScr), 1.0);
}`;

/* ---------- raios ---------- */
const BOLT_VS = `precision highp float;
uniform mat4 viewMatrix; uniform mat4 projectionMatrix; uniform vec3 cameraPosition; uniform float uT;
in vec3 position; in vec4 aA; in vec4 aB; in vec4 aC; out vec2 vQ; out float vI;
float strokes(float t, float sd) { float s = exp(-t * 26.0); float t2 = t - 0.06 - 0.03 * sd; if (t2 > 0.0) s += 0.85 * exp(-t2 * 24.0); float t3 = t - 0.15 - 0.05 * sd; if (t3 > 0.0) s += 0.6 * exp(-t3 * 20.0); float t4 = t - 0.28 - 0.06 * sd; if (t4 > 0.0) s += 0.4 * exp(-t4 * 12.0); return s; }
void main() {
  vQ = vec2(0.0); vI = 0.0; float age = uT - aC.x; float along = fract(aC.w), sd = floor(aC.w) / 100.0;
  if (aC.y <= 0.0 || age < 0.0 || age > aC.y || along > clamp(age / 0.05, 0.0, 1.0) + 0.001) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  float I = (age < 0.05 ? 0.35 : strokes(age - 0.05, sd)) * (1.0 - smoothstep(aC.y * 0.7, aC.y, age)) * aC.z;
  vec3 P = mix(aA.xyz, aB.xyz, position.y + 0.5); vec3 dir = normalize(aB.xyz - aA.xyz); vec3 side = normalize(cross(dir, cameraPosition - P));
  float w = mix(aA.w, aB.w, position.y + 0.5) * 9.0; float dc = length(cameraPosition - P); w = max(w, dc * 0.012);
  P += side * position.x * w; vQ = vec2(position.x * 2.0, position.y + 0.5); vI = I;
  gl_Position = projectionMatrix * viewMatrix * vec4(P, 1.0);
}`;
const BOLT_FS = `precision highp float;
uniform float uScr; in vec2 vQ; in float vI; out vec4 oC;
${GL_OUT}
void main() {
  float x = abs(vQ.x); float core = exp(-x * x * 110.0), glow = exp(-x * x * 9.0) * 0.32 + exp(-x * 3.2) * 0.1;
  vec3 col = (vec3(0.85, 0.9, 1.0) * core * 7.0 + vec3(0.55, 0.36, 1.35) * glow * 2.6) * vI;
  if (col.r + col.g + col.b < 0.004) discard;
  oC = vec4(ardOut(col, uScr), 1.0);
}`;

function create(THREE, scene, env) {
  const ST = { on: false, owns: true, onStrike: null }; /* owns: o render3d desliga o disco, os flocos e os sprites antigos */
  const renderer = env.renderer; const FX = env.FX || null; const isTouch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  const H = (x, y) => env.H(x, y);
  /* estado da tempestade na tela */
  const S = { has: false, x: 0, y: 0, r: 420, G: 0, gMin: 0, gMax: 0, phase: '', t: 0, tSeen: -1, tAt: 0, warn: 30, dur: 90, endAt: 0, inEnd: false, ts: 0, tsEnd: 0,
    form: 0, lift: 0, glow: 1, nextStrike: 0, nextIC: 0, inView: false, pend: null, burst: false, forceStrike: null, endShift: null };
  /* ruído 3D: provisório até as fatias terminarem */
  const NG = noiseMaker(NN);
  const tmp3 = new THREE.Data3DTexture(new Uint8Array(8 * 2).fill(128), 2, 2, 2); tmp3.format = THREE.RGFormat; tmp3.needsUpdate = true;
  let noiseTex = null;
  function noiseReady() { if (noiseTex) return true; if (!NG.done()) return false; const t = new THREE.Data3DTexture(NG.data, NN, NN, NN); t.format = THREE.RGFormat; t.type = THREE.UnsignedByteType; t.minFilter = t.magFilter = THREE.LinearFilter; t.wrapS = t.wrapT = t.wrapR = THREE.RepeatWrapping; t.unpackAlignment = 1; t.generateMipmaps = false; t.needsUpdate = true; noiseTex = t; for (const u of [UV, UR]) u.uN.value = t; return true; }
  /* mapa de alturas da área */
  const hmData = new Uint8Array(HM * HM); const hmTex = new THREE.DataTexture(hmData, HM, HM, THREE.RedFormat, THREE.UnsignedByteType); hmTex.minFilter = hmTex.magFilter = THREE.LinearFilter; hmTex.wrapS = hmTex.wrapT = THREE.ClampToEdgeWrapping; hmTex.unpackAlignment = 1; hmTex.needsUpdate = true;
  const hmF = new Float32Array(HM * HM);
  const hm4 = new THREE.Vector4(1 / 1024, 0, 1, FLOOR);
  /* ---------- volume ---------- */
  const UV = { uN: { value: tmp3 }, uHm: { value: hmTex }, uC: { value: new THREE.Vector4() }, uHm4: { value: hm4 }, uA: { value: new THREE.Vector4() }, uB: { value: new THREE.Vector4(0, 0, 0, 1) }, uD: { value: new THREE.Vector4(20, 0, 0, 0) }, uE: { value: new THREE.Vector4(0.6, 1, 0, TOP) }, uF: { value: new THREE.Vector4() }, uSunD: { value: new THREE.Vector3(-0.47, 0.64, 0.6).normalize() }, uSunC: { value: new THREE.Color(1.6, 1.45, 1.2) }, uSkyC: { value: new THREE.Color(0.6, 0.66, 0.74) }, uT: { value: 0 } };
  const volMat = o => new THREE.RawShaderMaterial(Object.assign({ glslVersion: THREE.GLSL3, uniforms: UV, vertexShader: VOL_VS, fragmentShader: VOL_FS, transparent: true, depthWrite: false, depthTest: true, premultipliedAlpha: true, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendEquationAlpha: THREE.AddEquation, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor }, o)); /* 4.3h: cor como antes (pré-multiplicada); no alfa do alvo do pós fica 1 − cobertura, que a bruma do render3d lê para não lavar a nuvem */
  const matOut = volMat({ side: THREE.FrontSide }), matIn = volMat({ side: THREE.BackSide });
  const volOut = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 40, 1, false).translate(0, 0.5, 0), matOut); volOut.renderOrder = 11; volOut.visible = false;
  const volIn = new THREE.Mesh(new THREE.SphereGeometry(60, 18, 12), matIn); volIn.renderOrder = 11; volIn.visible = false; volIn.frustumCulled = false;
  const setScr = function (r) { this.uniforms.uScr.value = r.getRenderTarget() === null ? 1 : 0; };
  const setScrV = r => { UV.uD.value.z = r.getRenderTarget() === null ? 1 : 0; };
  volOut.onBeforeRender = setScrV; volIn.onBeforeRender = setScrV;
  /* ---------- borda ---------- */
  const RS = 160, ROWS = [-46, -20, -8, -3, 0, 3, 12], RN = ROWS.length;
  const ringPos = new Float32Array((RS + 1) * RN * 3), ringU = new Float32Array((RS + 1) * RN * 3); const ringIdx = [];
  for (let i = 0; i < RS; i++) for (let j = 0; j < RN - 1; j++) { const a = i * RN + j, b = (i + 1) * RN + j; ringIdx.push(a, a + 1, b, a + 1, b + 1, b); } /* face para cima */
  const ringGeo = new THREE.BufferGeometry(); ringGeo.setAttribute('position', new THREE.BufferAttribute(ringPos, 3)); ringGeo.setAttribute('aU', new THREE.BufferAttribute(ringU, 3)); ringGeo.setIndex(ringIdx);
  const UR = { uN: { value: tmp3 }, uK: { value: new THREE.Vector4() }, uScr: { value: 0 } };
  const ringMat = new THREE.RawShaderMaterial({ glslVersion: THREE.GLSL3, uniforms: UR, vertexShader: RING_VS, fragmentShader: RING_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
  const ring = new THREE.Mesh(ringGeo, ringMat); ring.renderOrder = 11.5; ring.visible = false; ring.onBeforeRender = setScr.bind(ringMat);
  /* ---------- chuva ---------- */
  const quad = new THREE.PlaneGeometry(1, 1);
  const rainGeo = new THREE.InstancedBufferGeometry(); rainGeo.index = quad.index; rainGeo.setAttribute('position', quad.attributes.position);
  { const a = new Float32Array(RAIN_N * 4); for (let i = 0; i < RAIN_N; i++) { a[i * 4] = (i + 0.5) / RAIN_N; a[i * 4 + 1] = Math.random(); a[i * 4 + 2] = Math.random(); a[i * 4 + 3] = Math.random(); } rainGeo.setAttribute('aR', new THREE.InstancedBufferAttribute(a, 4)); }
  rainGeo.instanceCount = RAIN_N;
  const URn = { uHm: { value: hmTex }, uHm4: { value: hm4 }, uC: UV.uC, uR: { value: new THREE.Vector4() }, uT: { value: 0 }, uScr: { value: 0 } };
  const rainMat = new THREE.RawShaderMaterial({ glslVersion: THREE.GLSL3, uniforms: URn, vertexShader: RAIN_VS, fragmentShader: RAIN_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const rain = new THREE.Mesh(rainGeo, rainMat); rain.frustumCulled = false; rain.renderOrder = 10.5; rain.visible = false; rain.onBeforeRender = setScr.bind(rainMat);
  /* ---------- raios ---------- */
  const BN = BOLT_SEG * BOLT_N; const boltGeo = new THREE.InstancedBufferGeometry(); boltGeo.index = quad.index; boltGeo.setAttribute('position', quad.attributes.position);
  const bA = new THREE.InstancedBufferAttribute(new Float32Array(BN * 4), 4), bB = new THREE.InstancedBufferAttribute(new Float32Array(BN * 4), 4), bC = new THREE.InstancedBufferAttribute(new Float32Array(BN * 4), 4);
  const BATT = [bA, bB, bC]; for (const at of BATT) at.setUsage(THREE.DynamicDrawUsage);
  boltGeo.setAttribute('aA', bA); boltGeo.setAttribute('aB', bB); boltGeo.setAttribute('aC', bC); boltGeo.instanceCount = BN;
  const UBo = { uT: { value: 0 }, uScr: { value: 0 } };
  const boltMat = new THREE.RawShaderMaterial({ glslVersion: THREE.GLSL3, uniforms: UBo, vertexShader: BOLT_VS, fragmentShader: BOLT_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const bolts = new THREE.Mesh(boltGeo, boltMat); bolts.frustumCulled = false; bolts.renderOrder = 12.5; bolts.visible = false; bolts.onBeforeRender = setScr.bind(boltMat);
  const boltSt = []; for (let i = 0; i < BOLT_N; i++) boltSt.push({ t0: -9, life: 0, x: 0, y: 0, z: 0, gx: 0, gy: 0, k: 1, sd: 0, hits: 0, big: false });
  let boltI = 0;
  const MESHES = [volOut, volIn, ring, rain, bolts]; const hideAll = () => { for (let i = 0; i < MESHES.length; i++) MESHES[i].visible = false; };
  /* 4.3h: compila os programas agora (RawShaderMaterial: a chave do programa não depende do pós, das luzes nem do lado), não no meio da partida */
  try { const tmp = new THREE.Scene(); for (const m of MESHES) { m.visible = true; tmp.add(m); } renderer.compile(tmp, env.camera); } catch (err) { console.warn('[ST] compilação antecipada falhou: ' + err.message); }
  for (const m of MESHES) { m.visible = false; scene.add(m); }
  const ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  /* ---------- montagem por tempestade (sem alocar: só reescreve buffers) ---------- */
  function setup(x, y, r) {
    S.x = x; S.y = y; S.r = r; const Rp = r * RP, half = Rp + 24, cell = 2 * half / HM;
    let gMin = 1e9, gMax = -1e9, sum = 0, n = 0;
    for (let j = 0; j < HM; j++) for (let i = 0; i < HM; i++) { const lx = -half + (i + 0.5) * cell, lz = -half + (j + 0.5) * cell; const h = H(x + lx, y - lz); hmF[j * HM + i] = h; if (lx * lx + lz * lz < r * r) { if (h > -200) { sum += h; n++; } } }
    S.G = n ? sum / n : H(x, y);
    for (let i = 0; i < HM * HM; i++) { const h = Math.max(hmF[i], S.G + FLOOR - 6); hmF[i] = h; if (h < gMin) gMin = h; if (h > gMax) gMax = h; }
    const rng = Math.max(1, gMax - gMin); for (let i = 0; i < HM * HM; i++) hmData[i] = Math.round((hmF[i] - gMin) / rng * 255);
    hmTex.needsUpdate = true; hm4.set(1 / (2 * half), gMin - S.G, rng, FLOOR); S.gMin = gMin; S.gMax = gMax;
    UV.uC.value.set(x, S.G, -y, r);
    volOut.position.set(x, S.G + FLOOR, -y); volOut.scale.set(Rp, TOP - FLOOR, Rp); volOut.updateMatrixWorld();
    /* borda: faixa colada no chão; some sobre o abismo */
    for (let i = 0; i <= RS; i++) { const a = i / RS * TAU, ca = Math.cos(a), sa = Math.sin(a);
      for (let j = 0; j < RN; j++) { const rr = r + ROWS[j], px = x + ca * rr, py = y + sa * rr, h = H(px, py), k = (i * RN + j) * 3; ringPos[k] = px; ringPos[k + 1] = h + 1.6; ringPos[k + 2] = -py; ringU[k] = i / RS; ringU[k + 1] = ROWS[j];
        const sl = Math.max(Math.abs(H(px + 5, py) - H(px - 5, py)), Math.abs(H(px, py + 5) - H(px, py - 5))) / 10; ringU[k + 2] = h < S.G - 60 ? 0 : 1 - ss(1.1, 2.4, sl); } } /* 4.3h: some no abismo e no paredão (não desce a parede da plataforma) */
    ringGeo.attributes.position.needsUpdate = true; ringGeo.attributes.aU.needsUpdate = true; ringGeo.computeBoundingSphere();
    S.has = true;
  }
  /* ---------- relâmpago ---------- */
  const PTS = new Float32Array((16 + 1) * 3), MAINP = new Float32Array((16 + 1) * 3), _c = [0, 0, 0];
  function path(x0, y0, z0, x1, y1, z1, L, rough) { const n = 1 << L; PTS[0] = x0; PTS[1] = y0; PTS[2] = z0; PTS[n * 3] = x1; PTS[n * 3 + 1] = y1; PTS[n * 3 + 2] = z1;
    for (let st = n; st > 1; st >>= 1) { const hf = st >> 1; for (let i = 0; i < n; i += st) { const a = i * 3, b = (i + st) * 3, m = (i + hf) * 3; const dx = PTS[b] - PTS[a], dy = PTS[b + 1] - PTS[a + 1], dz = PTS[b + 2] - PTS[a + 2]; const L2 = Math.sqrt(dx * dx + dy * dy + dz * dz) * rough;
      PTS[m] = (PTS[a] + PTS[b]) / 2 + (Math.random() - 0.5) * L2; PTS[m + 1] = (PTS[a + 1] + PTS[b + 1]) / 2 + (Math.random() - 0.5) * L2 * 0.35; PTS[m + 2] = (PTS[a + 2] + PTS[b + 2]) / 2 + (Math.random() - 0.5) * L2; } }
    return n; }
  function putSeg(i, n, w0, w1, t0, life, k, along0, along1, sd) { const A = bA.array, B = bB.array, C = bC.array;
    for (let s = 0; s < n && i < BN; s++, i++) { const a = s * 3, b = (s + 1) * 3, o = i * 4; A[o] = PTS[a]; A[o + 1] = PTS[a + 1]; A[o + 2] = PTS[a + 2]; A[o + 3] = w0 + (w1 - w0) * s / n; B[o] = PTS[b]; B[o + 1] = PTS[b + 1]; B[o + 2] = PTS[b + 2]; B[o + 3] = w0 + (w1 - w0) * (s + 1) / n;
      C[o] = t0; C[o + 1] = life; C[o + 2] = k; C[o + 3] = Math.floor(sd * 99) + Math.min(0.999, along0 + (along1 - along0) * s / n); }
    return i; }
  function strike(gx, gy, k, time, big) {
    const b = boltSt[boltI], slot = boltI; boltI = (boltI + 1) % BOLT_N; const base = slot * BOLT_SEG;
    const gz = H(gx, gy); const ox = gx + (Math.random() - 0.5) * 90, oy = gy + (Math.random() - 0.5) * 90, oz = S.G + 150 + S.lift + Math.random() * 40;
    const sd = Math.random(); const life = big ? 0.7 : 0.5;
    let n = path(ox, oz, -oy, gx, gz + 0.5, -gy, 4, 0.42); let i = putSeg(base, n, big ? 2.4 : 1.8, big ? 1.9 : 1.3, time, life, k, 0, 0.98, sd);
    MAINP.set(PTS);
    const nb = 2 + (Math.random() * 3 | 0);
    for (let q = 0; q < nb && i < base + BOLT_SEG - 8; q++) { const si = 2 + (Math.random() * 9 | 0); /* ramo nasce num ponto do canal principal */
      const f = si / 16, sx = MAINP[si * 3], sy = MAINP[si * 3 + 1], sz = MAINP[si * 3 + 2];
      const a = Math.random() * TAU, L = 40 + Math.random() * 70; n = path(sx, sy, sz, sx + Math.cos(a) * L, sy - (30 + Math.random() * 60), sz + Math.sin(a) * L, 3, 0.5);
      i = putSeg(i, n, 1.0, 0.45, time, life * 0.8, k * 0.5, f, f + 0.25, sd); }
    for (; i < base + BOLT_SEG; i++) bC.array[i * 4 + 1] = 0;
    for (let ai = 0; ai < 3; ai++) { const at = BATT[ai]; at.clearUpdateRanges(); at.addUpdateRange(base * 4, BOLT_SEG * 4); at.needsUpdate = true; }
    b.t0 = time; b.life = life; b.x = ox; b.y = oz; b.z = -oy; b.gx = gx; b.gy = gy; b.k = k; b.sd = sd; b.hits = 0; b.big = !!big;
    if (ST.onStrike) { try { ST.onStrike(gx, gy, !!big); } catch (err) {} } /* 4.3h: gancho para o som do trovão (o áudio decide o atraso pela distância) */
    /* chão: onda, brilho, faíscas e poeira; o clarão no chão e na cena sai em update() junto com os golpes */
    if (FX && S.inView) { const m = FX.mult; _c[0] = 0.7; _c[1] = 0.55; _c[2] = 1.9; _p[0] = gx; _p[1] = gz + 0.8; _p[2] = -gy; _v[0] = _v[1] = _v[2] = 0; const rw = big ? 170 : 62; FX.emit(FX.add, _p, _v, big ? 1.1 : 0.6, rw * 0.12, rw, 6, _c, 0, 2.2, 0, 1, 0, 1); /* onda só no aro */ _c[0] = 1.1; _c[1] = 1.0; _c[2] = 2.4; FX.glow(gx, gz + 5, -gy, _c, big ? 22 : 12, 0.3, 0);
      _c[0] = 1.3; _c[1] = 1.0; _c[2] = 2.4; FX.spark(gx, gz + 2, -gy, _c, big ? 150 : 110, big ? 16 : 9);
      const nd = Math.round((big ? 10 : 5) * m); for (let q = 0; q < nd; q++) { const a = Math.random() * TAU, sp = 30 + Math.random() * 50; _v[0] = Math.cos(a) * sp; _v[1] = 6 + Math.random() * 8; _v[2] = Math.sin(a) * sp; _p[0] = gx; _p[1] = gz + 1.5; _p[2] = -gy; _c[0] = 0.4; _c[1] = 0.34; _c[2] = 0.36; FX.emit(FX.alp, _p, _v, 1.2 + Math.random() * 0.8, 6, 22, 4, _c, 0, 1.5, (Math.random() - 0.5) * 0.6, 0.7, 0, 2.2); } }
    return b;
  }
  const _p = [0, 0, 0], _v = [0, 0, 0], FLC = [0.75, 0.6, 1.7], FLC2 = [0.55, 0.42, 1.4], FUNC = [0.62, 0.3, 1.45]; const NOW = typeof env.flashNow === 'function'; /* 4.3h: luz só deste quadro (render3d novo) */
  function strokeK(t, sd) { let s = Math.exp(-t * 26); const t2 = t - 0.06 - 0.03 * sd; if (t2 > 0) s += 0.85 * Math.exp(-t2 * 24); const t3 = t - 0.15 - 0.05 * sd; if (t3 > 0) s += 0.6 * Math.exp(-t3 * 20); const t4 = t - 0.28 - 0.06 * sd; if (t4 > 0) s += 0.4 * Math.exp(-t4 * 12); return s; }
  const IC = { t0: -9, x: 0, y: 0, z: 0, k: 0 };
  /* ---------- eventos ---------- */
  ST.event = function (e) {
    if (!e || e.t !== 'storm') return;
    if (e.phase === 'warn' || e.phase === 'active') { if (!S.has || Math.abs(e.x - S.x) > 1 || Math.abs(e.y - S.y) > 1) { S.inEnd = false; S.has = false; } S.pend = e.phase; }
  };
  ST.debug = { S, strike: (x, y) => { S.forceStrike = [x, y]; }, sinceEnd: t => { S.endShift = t; }, stats: () => ({ calls: MESHES.filter(m => m.visible).length, steps: UV.uD.value.x, rain: Math.round(URn.uR.value.x * RAIN_N), noise: !!noiseTex, inside: volIn.visible, form: +S.form.toFixed(2), phase: S.phase }) };
  /* ---------- quadro ---------- */
  const _fr = new THREE.Frustum(), _pm = new THREE.Matrix4(), _sp = new THREE.Sphere(), _sun = new THREE.Vector3(); let sunL = null, sunN = 0;
  ST.update = function (dt, time, camera, storm, sim) {
    if (!noiseTex && !NG.done()) NG.step(storm ? 1e9 : 2.5); /* fatias do ruído nos primeiros quadros; com tempestade, termina já */
    if (!noiseReady()) return;
    /* fase e tempo contínuo (a simulação anda a 10 Hz) */
    if (storm) {
      if (!S.has || Math.abs(storm.x - S.x) > 0.5 || Math.abs(storm.y - S.y) > 0.5) { setup(storm.x, storm.y, storm.r || 420); S.ts = 0; S.inEnd = false; S.nextStrike = time + 0.15; S.nextIC = time + 0.8; S.phase = ''; }
      if (storm.t !== S.tSeen || storm.phase !== S.phase) { if (storm.phase !== S.phase && storm.phase === 'active' && S.pend === 'active' && storm.t < 1.5) S.burst = true; S.tSeen = storm.t; S.tAt = time; S.phase = storm.phase; }
      S.pend = null; S.warn = storm.warn > 0 ? storm.warn : 30; S.dur = storm.dur || 90; S.inEnd = false;
      S.t = storm.t + Math.min(0.12, time - S.tAt);
      S.ts = S.phase === 'active' ? 30 + S.t : S.t; S.tsEnd = S.ts;
    } else if (S.has) {
      if (!S.inEnd) { S.inEnd = true; S.endAt = time; S.phase = 'end'; } /* 4.3h: o fim se desfaz pelo relógio próprio (a simulação já apagou a tempestade) */
      if (S.endShift != null) { S.endAt = time - S.endShift; S.endShift = null; }
      S.ts = S.tsEnd + (time - S.endAt);
    }
    if (!S.has) { ST.on = false; hideAll(); return; }
    /* metas pela fase */
    let form, haze, fun, dust, ringK, ringW, rainK, cur, lift = 0, grow = 1, glow = 1, strikes = 0, ic = 0;
    if (S.phase === 'warn') { const w = Math.max(0, Math.min(1, S.t / S.warn)), sw = ss(0, 1, w);
      form = 0.22 + 0.68 * sw; haze = 0.12 + 0.48 * sw; fun = ss(0.86, 1, w) * 0.65; dust = 0.3 + 0.55 * w; ringK = 0.75 + 0.25 * w; ringW = 1; rainK = ss(0.8, 1, w) * 0.3; cur = 0.25 + 0.35 * w; lift = 40 * (1 - sw); grow = 1.35 - 0.35 * sw; glow = 0.6 + 0.4 * w; ic = ss(0.45, 1, w); }
    else if (S.phase === 'active') { const k = 1 - ss(S.dur - 4, S.dur, S.t) * 0.35;
      form = 1; haze = 1; fun = 1; dust = 1; ringK = 1; ringW = 0; rainK = k; cur = 1; glow = 1; strikes = k; ic = 1; }
    else { const e = Math.max(0, (time - S.endAt) / 7), se = ss(0, 1, e);
      form = 1 - se; haze = Math.max(0, 1 - e * 4); fun = Math.max(0, 1 - e * 2.2); dust = Math.max(0, 1 - e * 3); ringK = Math.max(0, 1 - e * 11); ringW = 0; rainK = Math.max(0, 1 - e * 5); cur = Math.max(0, 1 - e * 6); lift = 95 * se; grow = 1 + 0.3 * se; glow = 1 - se; ic = e < 0.4 ? 0.6 : 0;
      if (e >= 1) { S.has = false; S.inEnd = false; S.phase = ''; hideAll(); ST.on = false; return; } }
    S.form = form; S.lift = lift; ST.on = true;
    /* qualidade: leve na Baixa e no celular */
    const q = env.quality() || {}; const tier = q.resolved || q.name || 'media'; const light = isTouch || tier === 'baixa'; const mult = FX ? FX.mult : (q.particles || 1);
    const steps = light ? 9 : tier === 'media' ? 16 : 22;
    /* na tela? */
    _pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); _fr.setFromProjectionMatrix(_pm); _sp.center.set(S.x, S.G + 160, -S.y); _sp.radius = S.r * RP + 260; S.inView = _fr.intersectsSphere(_sp);
    /* luz do mapa: sol (direção pela luz direcional da cena), céu, noite */
    if (!sunL || (!sunL.parent && ++sunN % 120 === 0)) { sunL = null; for (const o of scene.children) if (o.isDirectionalLight) { sunL = o; break; } }
    if (sunL) { _sun.subVectors(sunL.position, sunL.target.position); if (_sun.lengthSq() > 1e-6) UV.uSunD.value.copy(_sun.normalize()); }
    const LS = env.light ? env.light() : null; const night = LS ? LS.night : 0;
    if (LS) { const si = (LS.sunI || 1.6) * 0.9; UV.uSunC.value.setRGB(LS.sun[0] * si, LS.sun[1] * si, LS.sun[2] * si); UV.uSkyC.value.setRGB(LS.sky[0] * 0.95 + 0.02, LS.sky[1] * 0.95 + 0.02, LS.sky[2] * 0.95 + 0.04); }
    /* relâmpagos (só na ativa) e clarões dentro da nuvem */
    let fk = 0, fx = 0, fy = 0, fz = 0;
    if (S.burst) { S.burst = false; strike(S.x, S.y, 1.25, time, true); if (FX && S.inView) { _c[0] = 0.6; _c[1] = 0.42; _c[2] = 1.5; _p[0] = S.x; _p[1] = H(S.x, S.y) + 0.8; _p[2] = -S.y; _v[0] = _v[1] = _v[2] = 0; FX.emit(FX.add, _p, _v, 1.6, S.r * 0.1, S.r * 0.95, 6, _c, 0, 2.2, 0, 1, 0, 1); } /* a tempestade abre: o funil toca o chão e a onda corre até a borda */ S.nextStrike = time + 0.7; }
    if (S.forceStrike) { strike(S.forceStrike[0], S.forceStrike[1], 1, time - 0.07, false); S.forceStrike = null; S.nextStrike = time + 1.2; }
    if (strikes > 0 && time >= S.nextStrike) { let sx = S.x, sy = S.y; for (let k = 0; k < 6; k++) { const a = Math.random() * TAU, rr = Math.sqrt(Math.random()) * S.r * 0.9; sx = S.x + Math.cos(a) * rr; sy = S.y + Math.sin(a) * rr; if (H(sx, sy) > S.G - 60) break; } strike(sx, sy, 0.8 + Math.random() * 0.3, time, false); S.nextStrike = time + (0.9 + Math.random() * 1.6) / strikes; }
    if (ic > 0 && time >= S.nextIC) { const a = Math.random() * TAU, rr = Math.sqrt(Math.random()) * S.r * 0.85; IC.t0 = time; IC.x = Math.cos(a) * rr; IC.z = Math.sin(a) * rr; IC.y = 175 + lift + Math.random() * 60; IC.k = 0.5 + Math.random() * 0.6; S.nextIC = time + (0.5 + Math.random() * 1.5) / ic; }
    { const a = time - IC.t0; if (a >= 0 && a < 0.45) { const k = IC.k * strokeK(a, 0.5) * (1 - a / 0.45); if (k > fk) { fk = k; fx = IC.x; fy = IC.y; fz = IC.z; } if (NOW && S.inView) env.flashNow(S.x + IC.x, S.y - IC.z, 260, FLC2, k * 0.45); } } /* clarão dentro da nuvem clareia de leve o chão embaixo */
    if (NOW && S.inView && fun > 0.05) env.flashNow(S.x, S.y, 95, FUNC, (0.55 + 0.25 * Math.sin(time * 3.1) + 0.12 * Math.sin(time * 7.3)) * fun * (0.8 + 0.7 * night)); /* o pé do funil acende o chão em volta */
    for (let bi = 0; bi < BOLT_N; bi++) { const b = boltSt[bi]; const a = time - b.t0; if (a < 0 || a > b.life) continue; const k = (a < 0.05 ? 0.35 : strokeK(a - 0.05, b.sd)) * b.k * (1 - ss(b.life * 0.7, b.life, a));
      if (k * 1.2 > fk) { fk = k * 1.2; fx = b.x - S.x; fy = b.y - S.G - 10; fz = b.z + S.y; }
      /* clarão no chão acompanhando os golpes de retorno (luz deste quadro; sem ela, um clarão por golpe); a cena inteira clareia uma vez por raio, de leve, pela distância */
      if (NOW) env.flashNow(b.gx, b.gy, b.big ? 230 : 150, FLC, k * (b.big ? 4.6 : 3.4));
      const hitN = a < 0.05 ? 0 : a < 0.11 ? 1 : a < 0.2 ? 2 : a < 0.33 ? 3 : 4; if (hitN > b.hits) { b.hits = hitN; if (!NOW && hitN <= 4) env.flash(b.gx, b.gy, b.big ? 230 : 150, hitN === 1 ? FLC : FLC2, (b.big ? 5 : 3.6) * (hitN === 1 ? 1 : 0.7), hitN === 4 ? 0.3 : 0.12, 1);
        if (hitN === 1 && env.lightning) { const dx = camera.position.x - b.gx, dz = camera.position.z + b.gy, dc = Math.sqrt(dx * dx + dz * dz); env.lightning(Math.max(0, Math.min(0.5, (1.7 - dc / 1300) * 0.35)) * (b.big ? 1.4 : 1)); } } }
    /* uniformes do volume */
    S.glow = glow; const U = UV;
    U.uA.value.set(form, haze, fun, dust); U.uB.value.set(S.ts * 0.05, 26 * (1 - Math.exp(-S.ts / 45)) * 0.11, lift, grow);
    U.uD.value.x = steps; U.uD.value.w = night; U.uE.value.set(0.84 - 0.44 * form, glow * (1 + 0.3 * night), cur, Math.min(TOP, 420 + lift * 1.3)); U.uF.value.set(fx, fy, fz, fk); U.uT.value = time % 1000;
    /* dentro (ou perto) do cilindro: entra pela esfera da câmera */
    const cx = camera.position.x - S.x, cz = camera.position.z + S.y, Rp = S.r * RP; const inside = cx * cx + cz * cz < (Rp + 90) * (Rp + 90) && camera.position.y < S.G + TOP + 60;
    U.uD.value.y = inside ? 1 : 0; volIn.position.copy(camera.position); volIn.updateMatrixWorld();
    volOut.visible = S.inView && !inside; volIn.visible = S.inView && inside;
    /* borda */
    ring.visible = S.inView && ringK > 0.01; UR.uK.value.set(ringK * (1 + 0.5 * night), ringW, time % 1000, -S.ts * 0.05 / TAU * 1.3);
    /* chuva */
    URn.uR.value.set(rainK * mult * (light ? 0.25 : tier === 'media' ? 0.45 : 0.6), 70, (0.75 + 0.6 * night) * (rainK > 0 ? 1 : 0), 0); URn.uT.value = time % 1000; rain.visible = S.inView && rainK > 0.01;
    /* raios */
    UBo.uT.value = time; let anyB = false; for (let bi = 0; bi < BOLT_N; bi++) if (time - boltSt[bi].t0 < boltSt[bi].life) anyB = true; bolts.visible = S.inView && anyB;
    /* poeira varrida na borda e faíscas de éter (FX, pela qualidade) */
    if (FX && S.inView && dt > 0) {
      const nD = dust * 16 * mult * Math.min(dt, 0.1) * (light ? 0.6 : 1); let nd = Math.floor(nD) + (Math.random() < nD - Math.floor(nD) ? 1 : 0);
      while (nd-- > 0) { const a = Math.random() * TAU, rr = S.r * (0.94 + Math.random() * 0.16) * (S.phase === 'warn' ? 1 + 0.25 * Math.random() : 1), px = S.x + Math.cos(a) * rr, py = S.y + Math.sin(a) * rr; const g = H(px, py); if (g < S.G - 60) continue;
        const lx = px - S.x, lz = -(py - S.y), ln = Math.max(1, Math.sqrt(lx * lx + lz * lz)), sp = 55 + Math.random() * 45, inw = S.phase === 'warn' ? 22 : 6;
        _p[0] = px; _p[1] = g + 2; _p[2] = -py; _v[0] = lz / ln * sp - lx / ln * inw; _v[1] = 3 + Math.random() * 6; _v[2] = -lx / ln * sp - lz / ln * inw;
        _c[0] = 0.22; _c[1] = 0.19; _c[2] = 0.25; FX.emit(FX.alp, _p, _v, 2.0 + Math.random() * 1.4, 8 + Math.random() * 6, 22 + Math.random() * 14, 4, _c, 0, 1.4, (Math.random() - 0.5) * 0.5, 0.3, 0, 0.35); }
      /* partículas de éter boiando no vento da tempestade: metade perto do ponto que a câmera olha (de perto viram faíscas grandes) */
      const nM = (S.phase === 'active' ? 1 : S.phase === 'warn' ? 0.35 * form : 0.3 * form) * 34 * mult * Math.min(dt, 0.1); let nm = Math.floor(nM) + (Math.random() < nM - Math.floor(nM) ? 1 : 0);
      const me = camera.matrixWorld.elements, fwy = -me[9]; let tx = S.x, ty = S.y, near = false; if (fwy < -0.05) { const tt = (camera.position.y - S.G) / -fwy; tx = camera.position.x - me[8] * tt; ty = -(camera.position.z - me[10] * tt); near = (tx - S.x) * (tx - S.x) + (ty - S.y) * (ty - S.y) < S.r * S.r && tt < 700; }
      while (nm-- > 0) { let px, py; if (near && Math.random() < 0.6) { const a = Math.random() * TAU, rr = Math.sqrt(Math.random()) * 220; px = tx + Math.cos(a) * rr; py = ty + Math.sin(a) * rr; if ((px - S.x) * (px - S.x) + (py - S.y) * (py - S.y) > S.r * S.r) continue; } else { const a = Math.random() * TAU, rr = Math.sqrt(Math.random()) * S.r * 0.97; px = S.x + Math.cos(a) * rr; py = S.y + Math.sin(a) * rr; }
        const g = H(px, py); if (g < S.G - 60) continue; const lx = px - S.x, lz = S.y - py, ln = Math.max(1, Math.sqrt(lx * lx + lz * lz)), sp = 22 + Math.random() * 30;
        _p[0] = px; _p[1] = g + 4 + Math.random() * 90; _p[2] = -py; _v[0] = lz / ln * sp; _v[1] = (Math.random() - 0.35) * 10; _v[2] = -lx / ln * sp; const kk = 0.7 + Math.random() * 0.8;
        if (Math.random() < 0.5) { _c[0] = 0.9 * kk; _c[1] = 0.42 * kk; _c[2] = 2.0 * kk; } else { _c[0] = 0.45 * kk; _c[1] = 0.75 * kk; _c[2] = 2.1 * kk; } FX.emit(FX.add, _p, _v, 1.4 + Math.random() * 1.8, 1.6 + Math.random() * 1.6, 0.6, 7, _c, 0, 1.5, 0, 0.85, 0, 0); }
      const nS = ringK * 7 * mult * Math.min(dt, 0.1); if (Math.random() < nS) { const a = Math.random() * TAU, px = S.x + Math.cos(a) * S.r, py = S.y + Math.sin(a) * S.r, g = H(px, py); if (g > S.G - 60) { _c[0] = 0.9; _c[1] = 0.8; _c[2] = 2.2; FX.spark(px, g + 2, -py, _c, 45, 2); _c[0] = 0.6; _c[1] = 0.4; _c[2] = 1.6; FX.glow(px, g + 3, -py, _c, 9, 0.25, 4); } }
    }
  };
  return ST;
}
ARD.storm3d = { create };
})(globalThis.ARD = globalThis.ARD || {});
