/* Aether Rift: Dominion — lagos de plasma e de gelo (4.3h).
   sim.map.lakes = [{ x, y, r, kind: 'plasma' | 'gelo', seed }] (forma: borda = ARD.sim.edgeR(r, ângulo, seed)); o terrain3d escava a bacia e
   devolve em T.lakes o nível da água de cada lago (k.level, altura no mundo). Plasma: derretido, intransponível para quem anda. Gelo: congelado,
   dá para andar por cima. O render3d chama:
   - LK.build(sim, T): uma vez, depois do terreno
   - LK.update(dt, time, camera): a cada quadro
   Ambiente (env): renderer, FX, flash(x, y, r, cor, força, vida, tremular), quality(), light(), H(x, y). Coordenadas: mundo three (x, y para cima, z = -y do mapa).

   4.3h — como cada lago é feito:
   - Dados do lago (uma textura pequena por lago, meia precisão): distância com sinal até a margem de verdade (onde o plano do lago corta a malha
     do terreno, calculada com a mesma triangulação do terrain3d), profundidade e distância até a borda da simulação. A superfície é um plano
     um pouco maior que a margem: o próprio terreno recorta a borda, e o shader sabe a que distância da margem está cada ponto.
   - PLASMA: rocha derretida sob crosta escura em placas que racham e se mexem devagar (Voronoi animado), correntes incandescentes por baixo
     (ruído deformado que muda), costura brilhante onde a lava encosta na rocha e crosta grossa e fria na margem; bolhas guiadas pela CPU que
     crescem e estouram (gotas, brasas e um sopro de vapor no FX) e microbolhas; vapor e brasas contínuos; margem de basalto queimado com fendas
     em brasa (decalque sobre a malha do terreno). Luz: clarões (env.flash) — ilumina o chão e as unidades sem luz de verdade.
   - GELO: plano no fundo da bacia (as unidades pisam nele), azul profundo pela distância à margem, rachaduras na superfície e por dentro com
     paralaxe, bolhas presas em camadas, geada e rastros de neve, neve acumulada na margem (decalque sobre o terreno e borda do próprio gelo)
     e brilho especular. Reflexo plano de verdade: um passe com a câmera espelhada no plano do gelo mais visível (os outros lagos de gelo no
     mesmo nível usam o mesmo passe), plano de corte oblíquo na projeção (sem programa novo), recorte da projeção ao retângulo do lago na tela
     e meia resolução por eixo; sem os lagos e sem as partículas; unidades e adereços instanciados entram só se alguma instância cai no
     recorte; no passe o terreno inteiro é trocado por um pedaço simplificado em volta do gelo (mesmas alturas, cor do bioma). Fora disso
     (Baixa, celular, sem pós ou ?sem=reflexo) o gelo reflete o céu pelo mapa de ambiente com fresnel.
   - Sem alocação por quadro e sem programa novo durante o jogo (os materiais são compilados no build).
   Chaves de teste: ?sem=reflexo, ?sem=lagofx (partículas), ?sem=margem, ?sem=chaoreflexo, ?reflexok=N (força do reflexo).
   Diagnóstico: R.LKS.stats (passe do reflexo: chamadas, triângulos, tamanho), R.LKS.debugRefl() (o que entra no passe), R.LKS.progs(). */
(function (ARD) {
'use strict';
const TAU = Math.PI * 2;

/* 4.3h: GLSL comum — hash sem seno, ruído de valor, fbm, Voronoi (F1, F2−F1 e id da célula) e relevo por derivadas de tela */
const GL_COMMON = `
float lkH1(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
vec2 lkH2(vec2 p) { vec3 q = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); q += dot(q, q.yzx + 33.33); return fract((q.xx + q.yz) * q.zy); }
float lkN(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(lkH1(i), lkH1(i + vec2(1.0, 0.0)), f.x), mix(lkH1(i + vec2(0.0, 1.0)), lkH1(i + vec2(1.0, 1.0)), f.x), f.y); }
float lkF(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { v += a * lkN(p); p = mat2(1.6, 1.2, -1.2, 1.6) * p + vec2(1.7, 9.2); a *= 0.5; } return v / 0.9375; }
float lkF2(vec2 p) { return (0.5 * lkN(p) + 0.25 * lkN(mat2(1.6, 1.2, -1.2, 1.6) * p + vec2(1.7, 9.2))) / 0.75; }
vec4 lkV(vec2 p, float t, float jit) { /* x: F1, y: F2 − F1 (perto de 0 na aresta), z: id da célula, w: id da vizinha (a aresta é o par) */
  vec2 ip = floor(p), fp = fract(p); float d1 = 9.0, d2 = 9.0, id = 0.0, id2 = 0.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) { vec2 g = vec2(float(i), float(j)); vec2 h = lkH2(ip + g); vec2 o = 0.5 + jit * (h - 0.5) + 0.16 * sin(t + 6.2831 * h); vec2 r = g + o - fp; float d = dot(r, r); if (d < d1) { d2 = d1; id2 = id; d1 = d; id = h.x; } else if (d < d2) { d2 = d; id2 = h.x; } }
  return vec4(sqrt(d1), sqrt(d2) - sqrt(d1), id, id2);
}
float lkEdge(vec4 v) { return lkH1(vec2(v.z + v.w, v.z * v.w) * 97.0); } /* sorteio por aresta (o mesmo dos dois lados) */
vec3 lkBump(vec3 sp, vec3 sn, vec2 dh, float fd) { vec3 sx = normalize(dFdx(sp)), sy = normalize(dFdy(sp)); vec3 r1 = cross(sy, sn), r2 = cross(sn, sx); float det = dot(sx, r1) * fd; vec3 g = sign(det) * (dh.x * r1 + dh.y * r2); return normalize(abs(det) * sn - g); }
`;
/* uniforms de todos: tempo, dados do lago, névoa de guerra (mapa do terreno), clarões, detalhe */
const GL_PARS = `uniform float uTime; uniform float uDetail; uniform float uNight; uniform sampler2D uLkData; uniform vec4 uLkRect; uniform vec4 uLkInfo; uniform sampler2D uFog; uniform float uWorld; uniform sampler2D uFlash; uniform vec4 uFlashR; uniform vec3 uSunDir; varying vec3 vLkW; varying float vLkNy;
` + GL_COMMON + `
float lkGlit(vec2 P, vec3 V) { vec2 gp = P * 0.8; vec2 gc = floor(gp); if (lkH1(gc + 3.7) < 0.93) return 0.0; float d = length(fract(gp) - 0.25 - 0.5 * lkH2(gc + 5.1)); vec3 gn = normalize(vec3(lkH1(gc + 1.1) - 0.5, 0.9, lkH1(gc + 2.3) - 0.5)); return pow(max(dot(reflect(-uSunDir, gn), V), 0.0), 48.0) * (1.0 - smoothstep(0.08, 0.3, d)); } /* cristais de neve que piscam com o sol */
`;
const GL_VS_PARS = 'varying vec3 vLkW; varying float vLkNy;\n';
const GL_VS_POS = '#include <project_vertex>\nvLkW = (modelMatrix * vec4(transformed, 1.0)).xyz; vLkNy = normalize(mat3(modelMatrix) * objectNormal).y;';
/* lê os dados do lago e a névoa de guerra; P = posição no mapa (x, y do mapa) */
const GL_HEAD = `
vec2 P = vec2(vLkW.x, -vLkW.z); vec4 lkD = texture2D(uLkData, (P - uLkRect.xy) / uLkRect.zw); float s = lkD.r; float dep = lkD.g;
float fogK = texture2D(uFog, P / uWorld).r; float lkFw = length(fwidth(P)); /* unidades do mapa por pixel: some o detalhe fino de longe */
`;
const GL_FLASH = '{ vec2 fu = (vLkW.xz - uFlashR.xy) / uFlashR.zw; if (fu.x > 0.0 && fu.y > 0.0 && fu.x < 1.0 && fu.y < 1.0) { vec3 fl = texture2D(uFlash, fu).rgb; totalEmissiveRadiance += diffuseColor.rgb * fl / (1.0 + 0.3 * fl) * 0.8; } }';

/* ---------- PLASMA ---------- */
const GL_LAVA = GL_HEAD + `
float t = uTime; float sd = uLkInfo.w;
vec2 q = P * 0.016 + vec2(sd * 3.1, sd * 1.7);
vec2 wv = vec2(lkF2(q + vec2(t * 0.010, -t * 0.007)), lkF2(q * 1.3 + vec2(5.2, 1.3) - vec2(t * 0.008, t * 0.011))) - 0.5;
float heat = lkF(q * 1.35 + wv * 1.8 + vec2(t * 0.005, -t * 0.003));
heat = clamp((heat - 0.36) * 1.8 + 0.18 * smoothstep(3.0, 26.0, s), 0.0, 1.0); /* manchas quentes que mudam devagar; o fundo é mais quente */
heat *= 0.3 + 0.7 * smoothstep(1.5, 12.0, s); /* a margem esfria */
float fine = 1.0 - smoothstep(0.9, 2.2, lkFw); /* detalhe fino só de perto */
/* crosta em placas (~10 un), deformadas pela corrente e que se mexem devagar (escala fixa: escala variável com a posição absoluta comprime o padrão) */
vec2 pw = P + wv * 8.0 + (vec2(lkN(P * 0.09 + 3.0), lkN(P * 0.09 + 17.0)) - 0.5) * 6.0; /* placas tortas, de tamanhos diferentes */
vec4 vc = lkV(pw / 10.0, t * 0.1, 0.9); float ek = lkEdge(vc); /* cada aresta sorteia se está aberta (lava) ou soldada (crosta) */
float cw = mix(0.03, 0.3, heat) * (0.55 + 0.9 * ek) * (0.85 + 0.15 * sin(t * 0.5 + vc.z * 6.2831));
float crack = (1.0 - smoothstep(cw * 0.3, cw, vc.y)) * mix(0.5, 1.0, fine) * smoothstep(0.5, 0.75, ek + heat * 0.45); /* na parte fria só parte das arestas abre */
/* blocos grandes (~36 un): fendas largas, nem todas abertas */
vec4 vb = lkV(pw / 36.0 + 3.7, t * 0.04, 0.9);
float crackB = (1.0 - smoothstep(0.01, (0.03 + 0.11 * heat) * (0.5 + lkN(P * 0.07 + 2.0)), vb.y)) * step(0.35, lkEdge(vb));
float open = smoothstep(0.7, 0.92, heat); /* lava exposta, sem crosta */
float molten = clamp(max(max(crack, crackB), open), 0.0, 1.0);
/* bolhas guiadas pela CPU: crescem (pele escura com aro aceso), estouram (clarão) e deixam um anel que se abre */
float bub = 0.0, bubRim = 0.0, bubSkin = 0.0;
for (int i = 0; i < 6; i++) { vec4 b = uBub[i]; float age = t - b.z; if (b.w <= 0.0 || age < 0.0 || age > 2.5) continue; float d = length(P - b.xy);
  if (age < 1.6) { float r = b.w * (0.25 + 0.75 * smoothstep(0.0, 1.6, age)); float inb = 1.0 - smoothstep(r * 0.8, r, d); bubSkin = max(bubSkin, inb); bubRim = max(bubRim, inb * smoothstep(r * 0.45, r * 0.9, d) * (0.5 + 0.5 * smoothstep(0.8, 1.6, age))); }
  else { float a2 = (age - 1.6) / 0.9; float rr = b.w * (1.0 + a2 * 2.4); bub = max(bub, (1.0 - smoothstep(0.0, b.w * 1.1, d)) * (1.0 - a2) * 1.4); bubRim = max(bubRim, (1.0 - smoothstep(0.0, 0.5 + a2 * 1.2, abs(d - rr))) * (1.0 - a2)); } }
/* microbolhas: pontinhos que acendem e estouram nas partes quentes */
float mb = 0.0; if (uDetail > 0.3) { vec2 mp = P / 3.4; vec2 mi = floor(mp); vec2 mh = lkH2(mi + 41.0); float per = 3.0 + 5.0 * mh.x; float ph = fract((t + mh.y * 17.0) / per); vec2 mc = mi + 0.25 + 0.5 * lkH2(mi + 7.0); float mr = 0.3 * smoothstep(0.0, 0.85, ph) * (1.0 - smoothstep(0.85, 1.0, ph)); mb = (1.0 - smoothstep(mr * 0.5, mr, length(mp - mc))) * step(0.7, mh.y) * smoothstep(0.45, 0.85, heat) * molten * fine; }
/* cor da lava: vermelho escuro -> laranja -> amarelo; correntes e veios que andam por baixo */
float flowN = lkF2(P * 0.09 + wv * 3.0 + vec2(t * 0.05, -t * 0.04));
float veins = smoothstep(0.55, 0.85, lkF2(P * 0.22 + wv * 4.0 + vec2(-t * 0.08, t * 0.06)));
float lv = clamp(0.12 + 0.55 * heat + 0.45 * (flowN - 0.5) + 0.25 * veins + bub * 0.7 + mb * 0.5, 0.0, 1.0);
vec3 lavaC = mix(vec3(0.35, 0.03, 0.004), vec3(2.0, 0.42, 0.045), smoothstep(0.05, 0.6, lv)); lavaC = mix(lavaC, vec3(3.0, 1.35, 0.35), smoothstep(0.66, 1.0, lv));
lavaC *= mix(1.0, 0.55, open * (1.0 - veins)); /* lava aberta: mais escura entre os veios (a pele esfria) */
/* crosta: basalto escuro em corda (pahoehoe); o calor aparece como brilho vermelho na beira das placas */
float cn = lkN(P * 0.7 + 3.0), cn2 = lkN(P * 2.3 + 9.0);
float rope = sin(dot(pw, vec2(0.8, 0.6)) * 1.4 + lkN(pw * 0.15) * 6.0 + vc.z * 20.0) * 0.5 + 0.5;
vec3 crustC = vec3(0.05, 0.043, 0.041) * (0.55 + 0.5 * cn + 0.35 * cn2);
float edgeGlow = exp(-vc.y / max(cw, 0.02) * 1.2) * (1.0 - crack) * (0.2 + heat) * fine * ek;
/* margem: costura acesa (em trechos) onde a lava encosta na rocha; crosta grossa e fria logo atrás */
float seamN = smoothstep(0.55, 0.85, lkN(P * 0.05 + vec2(t * 0.03, sd)));
float seam = (1.0 - smoothstep(0.1, 1.0 + seamN, s)) * smoothstep(-0.6, 0.1, s) * seamN; /* só em trechos: lava encostando na rocha */
float shoreCrust = 1.0 - smoothstep(1.4, 8.0 + 4.0 * cn, s);
molten *= 1.0 - shoreCrust * 0.9; molten = max(molten, bub * 0.9);
float skin = bubSkin * (1.0 - bub);
vec3 lkEm = lavaC * molten + vec3(0.8, 0.1, 0.012) * edgeGlow + lavaC * bubRim * 0.9 + vec3(1.0, 0.16, 0.02) * skin * 0.35 + vec3(1.2, 0.34, 0.05) * seam + vec3(2.6, 1.0, 0.22) * mb * 0.7;
lkEm *= fogK;
diffuseColor.rgb = mix(crustC, vec3(0.025, 0.012, 0.004), max(molten, skin * 0.6)) * mix(0.06, 1.0, fogK);
float lkRough = mix(0.72 + 0.15 * cn2, 0.45, max(molten, skin));
float lkHt = (1.0 - max(molten, open)) * (smoothstep(0.0, 0.3, vc.y) * 0.9 + 0.25 * cn + 0.3 * rope * fine) + skin * 0.9 - shoreCrust * 0.15; /* placas abauladas que descem para as fendas */
`;

/* ---------- GELO ---------- */
const GL_ICE = GL_HEAD + `
float sd = uLkInfo.w; vec3 Vw = normalize(cameraPosition - vLkW); vec2 par = vec2(Vw.x, -Vw.z) / max(Vw.y, 0.28); /* paralaxe das camadas de dentro */
float fine = 1.0 - smoothstep(0.7, 1.8, lkFw);
float nN = lkF(P * 0.05 + sd * 7.0); float nB = lkF(P * 0.012 + sd * 3.0 + 11.0); /* manchas grandes: gelo limpo (escuro) ou leitoso */
/* neve na borda do gelo (irregular) e poucos rastros de neve levados pelo vento */
float snowEdge = 1.0 - smoothstep(0.8 + nN * 3.0, 2.6 + nN * 7.0, s);
vec2 wd = vec2(0.94, 0.34); vec2 ws = vec2(dot(P, wd), dot(P, vec2(-wd.y, wd.x)));
float streak = smoothstep(0.7, 0.86, lkF(ws * vec2(0.018, 0.1) + 7.7 + sd)) * smoothstep(5.0, 22.0, s) * smoothstep(0.4, 0.65, nB);
float frost = smoothstep(0.55, 0.85, lkF(P * 0.02 + 3.3 + sd)) * 0.6;
float snow = clamp(max(snowEdge, streak * 0.35), 0.0, 1.0);
/* rachaduras na superfície: só algumas arestas de células de ~30 un (sorteio por aresta) — trechos retos que se encontram em ângulo; trincas finas em volta */
vec4 c0 = lkV(P / 30.0 + 1.3 + sd, 0.0, 0.95); float e0 = lkEdge(c0);
float crk0 = (1.0 - smoothstep(0.0, 0.018 + 0.012 * nN, c0.y)) * step(0.58, e0) * fine;
float near0 = (1.0 - smoothstep(0.0, 0.16, c0.y)) * step(0.58, e0);
float crkH = 0.0, crk1 = 0.0, crk2 = 0.0; if (uDetail > 0.3) { vec4 ch = lkV(P / 7.0 + 3.1, 0.0, 0.9); crkH = (1.0 - smoothstep(0.0, 0.035, ch.y)) * step(0.5, lkEdge(ch)) * near0 * fine * 0.7;
/* fraturas por dentro, com paralaxe (rasa e funda), esparsas e suaves */
  vec4 c1 = lkV((P - par * 0.9) / 16.0 + 5.1, 0.0, 0.85); crk1 = (1.0 - smoothstep(0.0, 0.16, c1.y)) * step(0.7, lkEdge(c1)) * smoothstep(0.55, 0.78, lkN(P * 0.02 + 31.0)) * fine; /* só em algumas manchas */
  if (uDetail > 0.5) { vec4 c2 = lkV((P - par * 2.2) / 9.0 + 9.7, 0.0, 0.8); crk2 = (1.0 - smoothstep(0.0, 0.22, c2.y)) * step(0.66, lkEdge(c2)) * smoothstep(0.5, 0.75, lkN(P * 0.025 + 47.0)) * fine; } } /* Baixa e celular: só as rachaduras grandes */
crk0 = max(crk0, crkH);
/* bolhas presas: cachos em manchas, duas profundidades */
float bubs = 0.0; float bz = smoothstep(0.62, 0.8, lkN(P * 0.03 + 21.0));
for (int L = 0; L < 2; L++) { float dz = L == 0 ? 0.6 : 1.6; vec2 bp = (P - par * dz) / (L == 0 ? 1.8 : 2.8) + float(L) * 13.7; vec2 bi = floor(bp); vec2 bh = lkH2(bi + 17.0);
  if (bh.x > 0.84) { vec2 bc = bi + 0.25 + 0.5 * lkH2(bi + 3.0); float br = 0.12 + 0.2 * bh.y; float bd = length(bp - bc); bubs = max(bubs, (1.0 - smoothstep(br * 0.6, br, bd)) * (0.6 + 0.4 * smoothstep(br * 0.15, br * 0.75, bd)) * (L == 0 ? 1.0 : 0.55)); } }
bubs *= bz * (1.0 - smoothstep(0.35, 0.9, lkFw)) * smoothstep(4.0, 12.0, s);
/* cor: o gelo limpo é escuro (vê-se a água funda), mais claro perto da margem e onde é leitoso */
float deep = smoothstep(2.0, clamp(uLkInfo.z * 0.2, 10.0, 24.0), s); float milky = smoothstep(0.55, 0.8, nB) * 0.45; /* lago pequeno escurece mais perto da margem */
vec3 iceC = mix(vec3(0.16, 0.37, 0.46), vec3(0.008, 0.06, 0.13), deep);
iceC = mix(iceC, vec3(0.3, 0.5, 0.6), milky * 0.5);
iceC += vec3(0.1, 0.22, 0.28) * crk2 * 0.16 + vec3(0.22, 0.38, 0.46) * crk1 * 0.16 + vec3(0.5, 0.66, 0.74) * bubs * 0.5;
iceC = mix(iceC, vec3(0.72, 0.8, 0.86), crk0 * 0.85);
iceC = mix(iceC, vec3(0.5, 0.62, 0.7), frost * 0.6);
float sp = lkN(P * 0.45 + 2.0); vec3 snowC = vec3(0.76, 0.81, 0.88) * (0.9 + 0.1 * sp);
diffuseColor.rgb = mix(iceC, snowC, snow) * mix(0.06, 1.0, fogK);
float lkRough = mix(mix(0.04, 0.3, max(frost, milky * 0.5)), 0.8, snow); lkRough = max(lkRough, crk0 * 0.4);
float lkRefK = (1.0 - snow) * (1.0 - frost * 0.6) * (1.0 - crk0 * 0.7) * (1.0 - milky * 0.35) * fogK;
float lkHt = -crk0 * 0.5 + snow * (0.5 + 0.6 * nN) + frost * 0.08 * sp;
vec3 lkEm = vec3(1.7, 1.8, 1.9) * lkGlit(P, Vw) * max(snow, frost * 0.5) * (1.0 - smoothstep(0.6, 1.6, lkFw)) * (1.0 - 0.6 * uNight) * fogK;
`;
/* reflexo: plano (passe do reflexo) ou céu pelo mapa de ambiente; fresnel exagerado de propósito (gelo polido, "com reflexo") */
const GL_ICE_REFL = `
{ vec3 nV = normalize(normal); float NdV = clamp(dot(nV, normalize(vViewPosition)), 0.0, 1.0); float g4 = pow(1.0 - NdV, 4.0);
  float fr = 0.16 + 0.84 * g4; /* céu: pouco reflexo de cima (o gelo fica fundo e azul) e muito rasante */
  vec3 rfl = vec3(0.0);
  if (uReflOn > 0.5) { vec4 rc = uReflMat * vec4(vLkW, 1.0); vec2 ruv = rc.xy / max(rc.w, 1e-4); vec3 nW = inverseTransformDirection(nV, viewMatrix); ruv += nW.xz * vec2(0.02, -0.02); ruv = clamp(ruv, uReflBox.xy, uReflBox.zw); rfl = texture2D(uRefl, ruv).rgb;
    float isObj = step(texture2D(uReflDepth, ruv).r, 0.99995); fr = mix(fr, 0.5 + 0.5 * g4, isObj); } /* unidades, margens e construções refletem forte: o reflexo aparece sem lavar o azul */
  else {
#ifdef USE_ENVMAP
    rfl = getIBLRadiance(geometryViewDir, geometryNormal, max(material.roughness, 0.08)) * 1.5;
#else
    rfl = vec3(0.35, 0.45, 0.55);
#endif
    rfl = mix(rfl, uSky * 1.3, uNight); /* o mapa de ambiente é o céu de dia: à noite vale a cor do céu do quadro */
  }
  float k = clamp(lkRefK * fr * uReflK, 0.0, 1.0); reflectedLight.indirectSpecular = mix(reflectedLight.indirectSpecular, rfl * vec3(0.82, 0.94, 1.0), k); reflectedLight.indirectDiffuse *= 1.0 - k * 0.6; reflectedLight.directDiffuse *= 1.0 - k * 0.4; }
`;

/* ---------- margens (decalques sobre a malha do terreno) ---------- */
const GL_BURN = GL_HEAD + `
if (s > 0.4) discard; /* dentro da lava o decalque fica por baixo dela */
float sd = uLkInfo.w; float o = -s; /* distância para fora da margem */
float nN = lkF(P * 0.045 + sd * 5.0); float cn = lkN(P * 0.6 + 1.0);
float a = 1.0 - smoothstep(5.0 + nN * 12.0, 12.0 + nN * 22.0, o);
vec4 vc = lkV(P / 6.5 + nN, 0.0, 0.9); float cr = (1.0 - smoothstep(0.0, 0.06 + 0.04 * nN, vc.y)) * step(0.7, lkEdge(vc)); /* só algumas arestas: fendas, não rede */
float hot = 1.0 - smoothstep(0.0, 2.5 + nN * 4.0, o); float pulse = 0.7 + 0.3 * sin(uTime * 0.8 + vc.z * 6.2831);
vec3 burnt = mix(vec3(0.032, 0.028, 0.027), vec3(0.075, 0.062, 0.055), cn) * (1.0 - 0.25 * cr);
diffuseColor.rgb = burnt * mix(0.06, 1.0, fogK); diffuseColor.a = clamp(a * (0.78 + 0.22 * hot), 0.0, 1.0);
vec3 lkEm = (vec3(2.0, 0.42, 0.05) * cr * hot * hot * pulse * (0.4 + 0.6 * (1.0 - smoothstep(0.9, 2.5, lkFw))) + vec3(1.4, 0.3, 0.03) * (1.0 - smoothstep(0.0, 2.2, o)) * 0.8 * smoothstep(0.4, 0.75, lkN(P * 0.06 + vec2(uTime * 0.02, sd)))) * fogK; /* rocha em brasa colada na lava, em trechos */
float lkRough = 0.9 - 0.25 * hot; float lkHt = cn * 0.5 - cr * 0.6;
`;
const GL_SNOW = GL_HEAD + `
if (s > 0.4) discard; /* dentro do gelo o decalque fica por baixo dele */
float sd = uLkInfo.w; float o = -s;
float nN = lkF(P * 0.04 + sd * 5.0); float sp = lkN(P * 0.5 + 4.0);
float thr = 3.0 + 15.0 * nN * nN; float a = 1.0 - smoothstep(thr - 2.5, thr + 2.0, o); /* borda irregular: de 1 a ~20 un da margem */
a *= mix(0.3, 1.0, smoothstep(0.5, 0.85, vLkNy)); /* pouca neve no paredão */
vec3 snowC = vec3(0.76, 0.81, 0.88) * (0.88 + 0.12 * sp);
diffuseColor.rgb = snowC * mix(0.06, 1.0, fogK); diffuseColor.a = clamp(a, 0.0, 1.0) * 0.95;
vec3 lkEm = vec3(1.7, 1.8, 1.9) * lkGlit(P, normalize(cameraPosition - vLkW)) * a * (1.0 - smoothstep(0.6, 1.6, lkFw)) * (1.0 - 0.6 * uNight) * fogK; float lkRough = 0.8; float lkHt = nN * 0.8 + sp * 0.15;
`;

function create(THREE, scene, env) {
  const renderer = env.renderer, camera = env.camera, S = ARD.sim;
  const qs = typeof location !== 'undefined' ? location.search : '';
  const OFF = new Set(((qs.match(/[?&]sem=([^&]*)/) || [])[1] || '').split(',')); /* ?sem=reflexo, ?sem=lagofx (partículas), ?sem=margem */
  const isTouch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  const LK = { group: new THREE.Group(), lakes: [], stats: { refl: 0, lakes: 0, calls: 0, tris: 0, w: 0, h: 0, ms: 0, skipped: 0 }, reflScale: 0.5 };
  LK.group.name = 'lagos3d'; scene.add(LK.group);
  const FLASH = ARD.meshes && ARD.meshes.FLASH ? ARD.meshes.FLASH : null;
  const white = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1); white.needsUpdate = true;
  const black = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1); black.needsUpdate = true;
  /* uniforms compartilhados (um objeto para todos os lagos) */
  const G = { uTime: { value: 0 }, uDetail: { value: 1 }, uNight: { value: 0 }, uFog: { value: white }, uWorld: { value: S.WORLD }, uSunDir: { value: new THREE.Vector3(-0.47, 0.64, 0.6).normalize() }, uSky: { value: new THREE.Color(0.62, 0.69, 0.77) },
    uFlash: FLASH ? FLASH.uFlash : { value: black }, uFlashR: FLASH ? FLASH.uFlashR : { value: new THREE.Vector4(0, 0, 1, 1) },
    uRefl: { value: black }, uReflDepth: { value: white }, uReflMat: { value: new THREE.Matrix4() }, uReflBox: { value: new THREE.Vector4(0, 0, 1, 1) }, uReflK: { value: +((qs.match(/[?&]reflexok=([0-9.]+)/) || [])[1] || 1) } };

  /* ---------- materiais (um onBeforeCompile por tipo: o programa é o mesmo para todos os lagos do tipo) ---------- */
  function patch(sh, mat, body, opts) {
    const L = mat.userData.U; for (const k in G) sh.uniforms[k] = G[k]; sh.uniforms.uLkData = L.uLkData; sh.uniforms.uLkRect = L.uLkRect; sh.uniforms.uLkInfo = L.uLkInfo; if (L.uBub) sh.uniforms.uBub = L.uBub; if (L.uReflOn) sh.uniforms.uReflOn = L.uReflOn;
    sh.vertexShader = GL_VS_PARS + sh.vertexShader.replace('#include <project_vertex>', GL_VS_POS);
    let fs = GL_PARS + (opts.bub ? 'uniform vec4 uBub[6];\n' : '') + (opts.refl ? 'uniform sampler2D uRefl; uniform mat4 uReflMat; uniform vec4 uReflBox; uniform float uReflOn; uniform float uReflK; uniform sampler2D uReflDepth; uniform vec3 uSky;\n' : '') + sh.fragmentShader;
    fs = fs.replace('#include <color_fragment>', '#include <color_fragment>\n' + body)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = lkRough;')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = 0.0;')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = lkBump(-vViewPosition, normal, vec2(dFdx(lkHt), dFdy(lkHt)) * ' + opts.bump.toFixed(2) + ', faceDirection);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + (opts.em ? 'totalEmissiveRadiance += lkEm;\n' : '') + (opts.flash ? GL_FLASH : ''));
    if (opts.refl) fs = fs.replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\n' + GL_ICE_REFL);
    sh.fragmentShader = fs;
  }
  const COMPILE = {
    plasma(sh) { patch(sh, this, GL_LAVA, { bub: true, em: true, bump: 1.3 }); },
    gelo(sh) { patch(sh, this, GL_ICE, { refl: true, em: true, flash: true, bump: 0.7 }); },
    queimado(sh) { patch(sh, this, GL_BURN, { em: true, flash: true, bump: 0.8 }); },
    neve(sh) { patch(sh, this, GL_SNOW, { em: true, flash: true, bump: 0.6 }); },
  };
  function mkMat(kind, U, decal) {
    const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, metalness: 0, envMapIntensity: kind === 'gelo' ? 1 : 0.3, transparent: !!decal, depthWrite: !decal });
    if (decal) { m.polygonOffset = true; m.polygonOffsetFactor = 0; m.polygonOffsetUnits = -2; } /* só um empurrão mínimo: o decalque já fica 0,05 acima do chão e não pode passar na frente do gelo (0,12 acima) */
    m.userData.U = U; m.userData.env = m.envMapIntensity; m.onBeforeCompile = COMPILE[kind]; m.customProgramCacheKey = () => 'ard-lago-' + kind + '-v1'; return m;
  }

  /* ---------- altura exata da malha do terreno (mesma triangulação do terrain3d.mapGeo: (a,b,c) e (b,d,c)) ---------- */
  function terrH(T, x, y) { const HN = T.HN, HS = T.HS, h = T.heights; const gx = Math.max(0, Math.min(HN - 1.0001, x / HS)), gy = Math.max(0, Math.min(HN - 1.0001, y / HS)); const i = gx | 0, j = gy | 0, fx = gx - i, fy = gy - j;
    const a = h[j * HN + i], b = h[j * HN + i + 1], c = h[(j + 1) * HN + i], d = h[(j + 1) * HN + i + 1]; return fx + fy <= 1 ? a + (b - a) * fx + (c - a) * fy : d + (c - d) * (1 - fx) + (b - d) * (1 - fy); }

  /* ---------- dados do lago: distância com sinal até a margem real, profundidade e borda da simulação ---------- */
  function lakeData(k, T, surf, margin) {
    const R0 = k.r * 1.16 + margin; const N = Math.max(40, Math.min(150, Math.ceil(R0 * 2 / 2.6))); const cell = R0 * 2 / N; const x0 = k.x - R0, y0 = k.y - R0;
    const h = new Float32Array(N * N), ins = new Uint8Array(N * N), ssd = new Float32Array(N * N);
    /* dentro = terreno abaixo do plano E no máximo 3 un além da borda da simulação (onde a margem do terreno é mais baixa que o nível, o lago não escorre) */
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const x = x0 + (i + 0.5) * cell, y = y0 + (j + 0.5) * cell, v = terrH(T, x, y), p = j * N + i; h[p] = v; ssd[p] = S.edgeR(k.r, Math.atan2(y - k.y, x - k.x), k.seed) - Math.hypot(x - k.x, y - k.y); ins[p] = v < surf && ssd[p] > -3 ? 1 : 0; }
    /* só a bacia ligada ao centro (outras depressões da caixa não viram lago) */
    const conn = new Uint8Array(N * N); let ci = Math.min(N - 1, Math.max(0, Math.floor((k.x - x0) / cell))), cj = Math.min(N - 1, Math.max(0, Math.floor((k.y - y0) / cell)));
    if (!ins[cj * N + ci]) { let best = -1, bd = 1e9; for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) if (ins[j * N + i]) { const d = (i - ci) * (i - ci) + (j - cj) * (j - cj); if (d < bd) { bd = d; best = j * N + i; } } if (best >= 0 && bd * cell * cell < k.r * k.r * 0.36) { ci = best % N; cj = (best / N) | 0; } }
    if (ins[cj * N + ci]) { const st = [cj * N + ci]; conn[cj * N + ci] = 1; while (st.length) { const p = st.pop(), i = p % N, j = (p / N) | 0; if (i > 0 && ins[p - 1] && !conn[p - 1]) { conn[p - 1] = 1; st.push(p - 1); } if (i < N - 1 && ins[p + 1] && !conn[p + 1]) { conn[p + 1] = 1; st.push(p + 1); } if (j > 0 && ins[p - N] && !conn[p - N]) { conn[p - N] = 1; st.push(p - N); } if (j < N - 1 && ins[p + N] && !conn[p + N]) { conn[p + N] = 1; st.push(p + N); } } }
    /* distância até a margem: estimativa abaixo de uma célula nos vizinhos da margem (interpolação da altura) e chanfro nas outras */
    const D = new Float32Array(N * N).fill(1e9);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const p = j * N + i; const m = conn[p]; let best = 1e9;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= N || jj >= N) continue; const q = jj * N + ii; if (conn[q] === m) continue; const hp = h[p], hq = h[q]; let f = Math.abs(hq - hp) > 1e-5 ? (surf - hp) / (hq - hp) : 0.5; if (!(f >= 0 && f <= 1)) f = 0.5; best = Math.min(best, f * cell); }
      D[p] = best; }
    const d1 = cell, d2 = cell * Math.SQRT2;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const p = j * N + i; let v = D[p]; if (i > 0) v = Math.min(v, D[p - 1] + d1); if (j > 0) { v = Math.min(v, D[p - N] + d1); if (i > 0) v = Math.min(v, D[p - N - 1] + d2); if (i < N - 1) v = Math.min(v, D[p - N + 1] + d2); } D[p] = v; }
    for (let j = N - 1; j >= 0; j--) for (let i = N - 1; i >= 0; i--) { const p = j * N + i; let v = D[p]; if (i < N - 1) v = Math.min(v, D[p + 1] + d1); if (j < N - 1) { v = Math.min(v, D[p + N] + d1); if (i < N - 1) v = Math.min(v, D[p + N + 1] + d2); if (i > 0) v = Math.min(v, D[p + N - 1] + d2); } D[p] = v; }
    const sdf = new Float32Array(N * N); const H16 = new Uint16Array(N * N * 4); const toH = THREE.DataUtils.toHalfFloat; let area = 0;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const p = j * N + i; const v = Math.min(D[p], 500) * (conn[p] ? 1 : -1); sdf[p] = v; if (conn[p]) area++;
      H16[p * 4] = toH(v); H16[p * 4 + 1] = toH(surf - h[p]); H16[p * 4 + 2] = toH(ssd[p]); H16[p * 4 + 3] = toH(1); }
    const tex = new THREE.DataTexture(H16, N, N, THREE.RGBAFormat, THREE.HalfFloatType); tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter; tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping; tex.generateMipmaps = false; tex.needsUpdate = true;
    return { N, cell, x0, y0, R0, sdf, tex, area: area * cell * cell };
  }
  function sdfAt(D, x, y) { const gx = (x - D.x0) / D.cell - 0.5, gy = (y - D.y0) / D.cell - 0.5; const N = D.N; const i = Math.max(0, Math.min(N - 2, Math.floor(gx))), j = Math.max(0, Math.min(N - 2, Math.floor(gy))); const fx = Math.max(0, Math.min(1, gx - i)), fy = Math.max(0, Math.min(1, gy - j)); const a = D.sdf;
    return (a[j * N + i] * (1 - fx) + a[j * N + i + 1] * fx) * (1 - fy) + (a[(j + 1) * N + i] * (1 - fx) + a[(j + 1) * N + i + 1] * fx) * fy; }

  /* superfície: plano em grade de ~5 un, só onde a bacia está (um pouco além da margem: o terreno recorta a borda) */
  function surfGeo(D, surf) {
    const span = D.N * D.cell, GN = Math.max(8, Math.ceil(span / 5)), gc = span / GN; const pos = new Float32Array((GN + 1) * (GN + 1) * 3), nrm = new Float32Array((GN + 1) * (GN + 1) * 3); const sv = new Float32Array((GN + 1) * (GN + 1));
    for (let j = 0; j <= GN; j++) for (let i = 0; i <= GN; i++) { const v = j * (GN + 1) + i, x = D.x0 + i * gc, y = D.y0 + j * gc; pos[v * 3] = x; pos[v * 3 + 1] = surf; pos[v * 3 + 2] = -y; nrm[v * 3 + 1] = 1; sv[v] = sdfAt(D, x, y); }
    const idx = []; const lim = -gc * 1.6;
    for (let j = 0; j < GN; j++) for (let i = 0; i < GN; i++) { const a = j * (GN + 1) + i, b = a + 1, c = a + GN + 1, d = c + 1; if (Math.max(sv[a], sv[b], sv[c], sv[d]) < lim) continue; idx.push(a, b, c, b, d, c); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3)); g.setIndex(idx); g.computeBoundingSphere(); return g;
  }
  /* margem: pedaço da própria malha do terreno (mesmos vértices e diagonais), um pouco acima, onde a distância à margem está na faixa */
  function shoreGeo(D, T, lo, hi) {
    const HN = T.HN, HS = T.HS; const i0 = Math.max(0, Math.floor(D.x0 / HS)), i1 = Math.min(HN - 1, Math.ceil((D.x0 + D.N * D.cell) / HS)), j0 = Math.max(0, Math.floor(D.y0 / HS)), j1 = Math.min(HN - 1, Math.ceil((D.y0 + D.N * D.cell) / HS));
    const W = i1 - i0 + 1, Hh = j1 - j0 + 1; const pos = new Float32Array(W * Hh * 3), nrm = new Float32Array(W * Hh * 3), sv = new Float32Array(W * Hh); const hts = T.heights; const at = (i, j) => hts[Math.max(0, Math.min(HN - 1, j)) * HN + Math.max(0, Math.min(HN - 1, i))];
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const v = (j - j0) * W + (i - i0); pos[v * 3] = i * HS; pos[v * 3 + 1] = at(i, j) + 0.05; pos[v * 3 + 2] = -j * HS; const nx = at(i - 1, j) - at(i + 1, j), nz = at(i, j + 1) - at(i, j - 1), ny = 2 * HS; const l = Math.hypot(nx, ny, nz); nrm[v * 3] = nx / l; nrm[v * 3 + 1] = ny / l; nrm[v * 3 + 2] = -nz / l; sv[v] = sdfAt(D, i * HS, j * HS); }
    const idx = [];
    for (let j = 0; j < Hh - 1; j++) for (let i = 0; i < W - 1; i++) { const a = j * W + i, b = a + 1, c = a + W, d = c + 1; const mx = Math.max(sv[a], sv[b], sv[c], sv[d]), mn = Math.min(sv[a], sv[b], sv[c], sv[d]); if (mn > hi || mx < lo) continue; idx.push(a, b, c, b, d, c); }
    if (!idx.length) return null; const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3)); g.setIndex(idx); g.computeBoundingSphere(); g.userData.grid = { i0, j0, W, Hh }; return g;
  }
  /* o terreno pode ser aplainado sob construções durante o jogo: a margem relê as alturas de vez em quando */
  function shoreSync(L, T) { const g = L.shore && L.shore.geometry; if (!g || !g.userData.grid) return; const { i0, j0, W, Hh } = g.userData.grid, HN = T.HN, hts = T.heights, pa = g.attributes.position.array; let ch = false;
    for (let j = 0; j < Hh; j++) for (let i = 0; i < W; i++) { const v = j * W + i, hv = hts[Math.min(HN - 1, j + j0) * HN + Math.min(HN - 1, i + i0)] + 0.05; if (Math.abs(pa[v * 3 + 1] - hv) > 0.01) { pa[v * 3 + 1] = hv; ch = true; } }
    if (ch) g.attributes.position.needsUpdate = true; }

  /* reflexo: chão simplificado em volta do gelo — a mesma grade e as mesmas alturas do terreno (a neve da margem assenta igual), cor do bioma por vértice.
     No passe do reflexo ele entra no lugar do terreno inteiro (321² vértices, ~205 mil triângulos): o reflexo da margem custa poucos milhares */
  const BIO = (ARD.terrain3d && ARD.terrain3d.BIO_MEAN) || [[0.78, 0.83, 0.9], [0.6, 0.46, 0.32], [0.27, 0.3, 0.18], [0.16, 0.15, 0.16]];
  const proxyMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0.02, envMapIntensity: 0.22 }); proxyMat.userData.env = 0.22;
  LK.proxy = new THREE.Group(); LK.proxy.name = 'lagos3d-chao-do-reflexo'; LK.proxy.visible = false; LK.group.add(LK.proxy);
  function proxyGeo(D, T, pad) {
    const HN = T.HN, HS = T.HS, span = D.N * D.cell; const i0 = Math.max(0, Math.floor((D.x0 - pad) / HS)), i1 = Math.min(HN - 1, Math.ceil((D.x0 + span + pad) / HS)), j0 = Math.max(0, Math.floor((D.y0 - pad) / HS)), j1 = Math.min(HN - 1, Math.ceil((D.y0 + span + pad) / HS));
    const W = i1 - i0 + 1, Hh = j1 - j0 + 1; const pos = new Float32Array(W * Hh * 3), nrm = new Float32Array(W * Hh * 3), col = new Float32Array(W * Hh * 3); const hts = T.heights, bio = T.bio; const at = (i, j) => hts[Math.max(0, Math.min(HN - 1, j)) * HN + Math.max(0, Math.min(HN - 1, i))];
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const v = (j - j0) * W + (i - i0), gi = j * HN + i; pos[v * 3] = i * HS; pos[v * 3 + 1] = hts[gi]; pos[v * 3 + 2] = -j * HS;
      const nx = at(i - 1, j) - at(i + 1, j), nz = at(i, j + 1) - at(i, j - 1), ny = 2 * HS, l = Math.hypot(nx, ny, nz); nrm[v * 3] = nx / l; nrm[v * 3 + 1] = ny / l; nrm[v * 3 + 2] = -nz / l;
      let r = 0, g = 0, b = 0, w = 0; if (bio) for (let c = 0; c < 4; c++) { const k = bio[gi * 4 + c]; r += k * BIO[c][0]; g += k * BIO[c][1]; b += k * BIO[c][2]; w += k; } w = w || 1; const rk = Math.max(0, Math.min(1, (1 - ny / l - 0.06) / 0.14)); /* encosta: rocha */
      col[v * 3] = (r / w * (1 - rk) + 0.3 * rk) * 0.8; col[v * 3 + 1] = (g / w * (1 - rk) + 0.27 * rk) * 0.8; col[v * 3 + 2] = (b / w * (1 - rk) + 0.25 * rk) * 0.8; }
    const idx = []; for (let j = 0; j < Hh - 1; j++) for (let i = 0; i < W - 1; i++) { const a = j * W + i, b = a + 1, c = a + W, d = c + 1; idx.push(a, b, c, b, d, c); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setIndex(idx); g.computeBoundingSphere(); return g;
  }
  function clear() { for (const L of LK.lakes) { for (const m of [L.mesh, L.shore]) if (m) { LK.group.remove(m); m.geometry.dispose(); m.material.dispose(); } if (L.proxy) { LK.proxy.remove(L.proxy); L.proxy.geometry.dispose(); } if (L.D && L.D.tex) L.D.tex.dispose(); } LK.lakes.length = 0; }

  LK.build = function (sim, T) {
    clear(); if (!T || !T.lakes || !T.heights) return; LK.T = T;
    for (const k of T.lakes) { if (!(k.r > 0) || k.level == null) continue; const plasma = k.kind === 'plasma';
      /* o gelo fica no fundo da bacia (as unidades pisam no chão, que lá está ~2,5 abaixo do nível); o plasma no nível da água */
      let surf = k.level; if (!plasma) { const hs = []; for (let a = 0; a < 24; a++) for (const f of [0, 0.25, 0.45]) { const ang = a / 24 * TAU, rr = S.edgeR(k.r, ang, k.seed) * f; hs.push(terrH(T, k.x + Math.cos(ang) * rr, k.y + Math.sin(ang) * rr)); } hs.sort((p, q) => p - q); surf = Math.min(k.level - 0.05, hs[hs.length >> 1] + 0.12); }
      const D = lakeData(k, T, surf, plasma ? 34 : 30); if (D.area < 40) continue;
      const U = { uLkData: { value: D.tex }, uLkRect: { value: new THREE.Vector4(D.x0, D.y0, D.N * D.cell, D.N * D.cell) }, uLkInfo: { value: new THREE.Vector4(k.x, k.y, k.r, (k.seed || 0) % 6.2831853) } };
      if (plasma) { U.uBub = { value: [] }; for (let i = 0; i < 6; i++) U.uBub.value.push(new THREE.Vector4(0, 0, -99, 0)); } else U.uReflOn = { value: 0 };
      const mesh = new THREE.Mesh(surfGeo(D, surf), mkMat(plasma ? 'plasma' : 'gelo', U)); mesh.receiveShadow = true; mesh.castShadow = false; mesh.name = 'lago-' + k.kind; LK.group.add(mesh);
      let shore = null; if (!OFF.has('margem')) { const g = shoreGeo(D, T, plasma ? -40 : -34, plasma ? 2 : 6); if (g) { shore = new THREE.Mesh(g, mkMat(plasma ? 'queimado' : 'neve', U, true)); shore.receiveShadow = true; shore.renderOrder = 1; shore.name = 'margem-' + k.kind; LK.group.add(shore); } }
      let proxy = null; if (!plasma && !OFF.has('chaoreflexo')) { proxy = new THREE.Mesh(proxyGeo(D, T, 110), proxyMat); proxy.receiveShadow = true; proxy.name = 'chao-reflexo'; LK.proxy.add(proxy); }
      const L = { k, plasma, x: k.x, y: k.y, r: k.r, surf, D, U, mesh, shore, proxy, vis: false, area: 0, fogK: 1, ft: Math.random() * 0.1, bt: 0.5 + Math.random(), bubs: [], ph: Math.random() * TAU, outline: [] };
      for (let a = 0; a < 20; a++) { const ang = a / 20 * TAU, rr = S.edgeR(k.r, ang, k.seed) * 0.98; L.outline.push(new THREE.Vector3(k.x + Math.cos(ang) * rr, surf, -(k.y + Math.sin(ang) * rr))); }
      if (plasma) for (let i = 0; i < 6; i++) L.bubs.push({ x: 0, y: 0, t0: -99, r: 0, popped: true });
      /* pontos onde nascem bolhas, vapor e brasas: dentro da lava, longe da margem */
      L.spots = []; for (let tries = 0; tries < 400 && L.spots.length < 48; tries++) { const ang = Math.random() * TAU, rr = Math.sqrt(Math.random()) * k.r; const x = k.x + Math.cos(ang) * rr, y = k.y + Math.sin(ang) * rr; if (sdfAt(D, x, y) > (plasma ? 5 : 8)) L.spots.push(x, y); }
      LK.lakes.push(L); }
    LK.stats.lakes = LK.lakes.length; prewarm(); hideList(true);
  };

  /* compila os materiais agora (no build), na variante que o jogo usa (pós → alvo de render; sem pós → tela) */
  function prewarm() { if (!LK.lakes.length) return; try { const q = env.quality ? env.quality() : null; const prev = renderer.getRenderTarget(); let tmp = null; if (q && q.post) { tmp = new THREE.WebGLRenderTarget(4, 4, { type: rtType() }); renderer.setRenderTarget(tmp); } renderer.compile(LK.group, camera, scene); renderer.setRenderTarget(prev); if (tmp) tmp.dispose(); } catch (err) { console.warn('[ARD] lagos: pré-compilação falhou: ' + err.message); } }
  function rtType() { const c = renderer.capabilities, e = renderer.extensions; return c.isWebGL2 && (e.has('EXT_color_buffer_float') || e.has('EXT_color_buffer_half_float')) ? THREE.HalfFloatType : THREE.UnsignedByteType; }

  /* ---------- reflexo plano ---------- */
  const RF = { rt: null, cam: new THREE.PerspectiveCamera(), want: false, busy: false, plane: 0, vpW: 0, vpH: 0, hide: [], inst: [], save: [], hideT: 0, terrain: null, missed: 0, dead: false, probe: 0 };
  RF.cam.matrixAutoUpdate = true; RF.cam.name = 'reflexo-lagos';
  const _pv = new THREE.Matrix4(), _pm = new THREE.Matrix4(), _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _up = new THREE.Vector3(), _fw = new THREE.Vector3(), _clip = new THREE.Vector4(), _qv = new THREE.Vector4(), _plane = new THREE.Plane(), _fr = new THREE.Frustum(), _sph = new THREE.Sphere(), _sz = new THREE.Vector2(), _cc = new THREE.Color(), _bg = new THREE.Color(0x101418), _box = new Float32Array(4), _bias = new THREE.Matrix4();
  const LAKE_SET = new Set(); let sunL = null;
  /* o que o passe não desenha: os lagos, partículas (FX, pontos, sprites) e transparentes sem profundidade (clarões, decalques, brilhos) */
  const addLake = o => LAKE_SET.add(o);
  const visitHide = o => { if (o.isDirectionalLight && !sunL) sunL = o; if (o === scene || LAKE_SET.has(o)) return; const FX = env.FX; if (FX && ((FX.add && o === FX.add.mesh) || (FX.alp && o === FX.alp.mesh))) { RF.hide.push(o); return; } if (o.isPoints || o.isSprite || o.isLine) { RF.hide.push(o); return; }
    const m = o.material; if (o.isMesh && m && !Array.isArray(m) && m.transparent && !m.depthWrite && o.renderOrder > -100) { RF.hide.push(o); return; } if (o.isInstancedMesh) { RF.inst.push(o); return; }
    const T = LK.T; if (!RF.terrain && T && o.isMesh && o.geometry && o.geometry.attributes && o.geometry.attributes.bio && o.geometry.attributes.position.count === T.HN * T.HN) RF.terrain = o; };
  function hideList(force) { if (!force && RF.hideT > 0) return; RF.hideT = 1.5; RF.hide.length = 0; RF.inst.length = 0; LAKE_SET.clear(); LK.group.traverse(addLake); sunL = null; RF.terrain = null; scene.traverse(visitHide);
    for (const L of LK.lakes) RF.hide.push(L.mesh); /* os decalques da margem ficam no reflexo (a neve aparece refletida); as superfícies saem */ if (!LK.proxy.children.length) RF.terrain = null; }
  function instSeen(m) { const n = m.count; if (!n) return false; const a = m.instanceMatrix.array, g = m.geometry; if (!g.boundingSphere) g.computeBoundingSphere(); const bs = g.boundingSphere, r0 = bs.radius + bs.center.length(); const e = m.matrixWorld.elements; const ident = e[0] === 1 && e[5] === 1 && e[10] === 1 && e[12] === 0 && e[13] === 0 && e[14] === 0;
    for (let i = 0; i < n; i++) { const o = i * 16; const sc = Math.sqrt(a[o] * a[o] + a[o + 1] * a[o + 1] + a[o + 2] * a[o + 2]); _sph.center.set(a[o + 12], a[o + 13], a[o + 14]); _sph.radius = r0 * sc; if (!ident) _sph.applyMatrix4(m.matrixWorld); if (_fr.intersectsSphere(_sph)) return true; } return false; }
  function reflAllowed() { if (OFF.has('reflexo') || isTouch || !renderer.capabilities.isWebGL2) return false; const q = env.quality ? env.quality() : null; if (!q || !q.post) return false; return (q.resolved || q.name) !== 'baixa'; }
  /* caixa (NDC) dos pontos do contorno numa câmera; devolve a área recortada na tela ou −1 se algum ponto está atrás */
  function ndcBox(pts, m, out) { let x0 = 9, y0 = 9, x1 = -9, y1 = -9, back = 0; const e = m.elements; for (const p of pts) { const w = e[3] * p.x + e[7] * p.y + e[11] * p.z + e[15]; if (w <= 1e-3) { back++; continue; } const x = (e[0] * p.x + e[4] * p.y + e[8] * p.z + e[12]) / w, y = (e[1] * p.x + e[5] * p.y + e[9] * p.z + e[13]) / w; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (back === pts.length) { out[0] = out[1] = 9; out[2] = out[3] = -9; return 0; } if (back) { out[0] = -1; out[1] = -1; out[2] = 1; out[3] = 1; return -1; }
    out[0] = x0; out[1] = y0; out[2] = x1; out[3] = y1; const cx0 = Math.max(-1, x0), cy0 = Math.max(-1, y0), cx1 = Math.min(1, x1), cy1 = Math.min(1, y1); return cx1 > cx0 && cy1 > cy0 ? (cx1 - cx0) * (cy1 - cy0) : 0; }
  function setupRefl(cam) {
    if (RF.want) { if (++RF.missed >= 3 && !RF.dead) { RF.dead = true; RF.probe = G.uTime.value; console.warn('[ARD] lagos: o passe de reflexo não rodou (scene.onBeforeRender substituído?) — gelo volta ao reflexo do céu'); } } else RF.missed = 0; /* o gancho não disparou: não amostra um alvo velho */
    let probing = false; if (RF.dead) { if (G.uTime.value - RF.probe < 5) { RF.want = false; for (const L of LK.lakes) if (L.U.uReflOn) L.U.uReflOn.value = 0; LK.stats.refl = 0; return; } RF.probe = G.uTime.value; probing = true; } /* a cada 5 s tenta de novo (sem usar o alvo neste quadro) */
    let best = null; for (const L of LK.lakes) if (!L.plasma && L.vis && L.fogK > 0.05 && (!best || L.area > best.area)) best = L;
    for (const L of LK.lakes) if (L.U.uReflOn) L.U.uReflOn.value = 0;
    if (!best || !reflAllowed()) { RF.want = false; LK.stats.refl = 0; return; }
    if (renderer.shadowMap.enabled && sunL && sunL.castShadow && !sunL.shadow.map) { RF.want = false; return; } /* sem o mapa de sombra ainda (primeiro quadro): o passe usaria uma textura vazia no amostrador de sombra */
    const Ly = best.surf; RF.plane = Ly;
    /* câmera espelhada: posição, frente e alto refletidos no plano y = Ly (câmera própria, sem inverter a face) */
    cam.updateMatrixWorld(); const ce = cam.matrixWorld.elements; _v.set(ce[12], ce[13], ce[14]); if (_v.y <= Ly + 1) { RF.want = false; return; }
    _fw.set(-ce[8], -ce[9], -ce[10]); _up.set(ce[4], ce[5], ce[6]);
    RF.cam.position.set(_v.x, 2 * Ly - _v.y, _v.z); _fw.y = -_fw.y; _up.y = -_up.y; RF.cam.up.copy(_up); _v2.copy(RF.cam.position).add(_fw); RF.cam.lookAt(_v2); RF.cam.updateMatrixWorld();
    RF.cam.near = cam.near; RF.cam.far = cam.far; RF.cam.projectionMatrix.copy(cam.projectionMatrix);
    /* recorte: retângulo dos lagos do grupo (mesmo nível) vistos pela câmera espelhada */
    _pv.multiplyMatrices(RF.cam.projectionMatrix, RF.cam.matrixWorldInverse); let x0 = 9, y0 = 9, x1 = -9, y1 = -9, n = 0;
    for (const L of LK.lakes) { if (L.plasma || !L.vis || Math.abs(L.surf - Ly) > 0.75) continue; ndcBox(L.outline, _pv, _box); x0 = Math.min(x0, _box[0]); y0 = Math.min(y0, _box[1]); x1 = Math.max(x1, _box[2]); y1 = Math.max(y1, _box[3]); L.U.uReflOn.value = 1; n++; }
    x0 = Math.max(-1, x0 - 0.04); y0 = Math.max(-1, y0 - 0.04); x1 = Math.min(1, x1 + 0.04); y1 = Math.min(1, y1 + 0.04); if (!n || x1 - x0 < 0.01 || y1 - y0 < 0.01) { for (const L of LK.lakes) if (L.U.uReflOn) L.U.uReflOn.value = 0; RF.want = false; return; }
    const pe = RF.cam.projectionMatrix.elements; const sx = 2 / (x1 - x0), sy = 2 / (y1 - y0), tx = -(x1 + x0) / (x1 - x0), ty = -(y1 + y0) / (y1 - y0);
    for (let c = 0; c < 4; c++) { const r3 = pe[c * 4 + 3]; pe[c * 4] = sx * pe[c * 4] + tx * r3; pe[c * 4 + 1] = sy * pe[c * 4 + 1] + ty * r3; } /* linhas 0 e 1 da projeção: o recorte vira a tela inteira do alvo */
    /* plano de corte oblíquo (Lengyel): o plano próximo da câmera espelhada passa a ser o plano do gelo — some o que está abaixo dele */
    _plane.setFromNormalAndCoplanarPoint(_up.set(0, 1, 0), _v2.set(0, Ly - 0.04, 0)).applyMatrix4(RF.cam.matrixWorldInverse); _clip.set(_plane.normal.x, _plane.normal.y, _plane.normal.z, _plane.constant);
    _qv.set((Math.sign(_clip.x) + pe[8]) / pe[0], (Math.sign(_clip.y) + pe[9]) / pe[5], -1, (1 + pe[10]) / pe[14]); _clip.multiplyScalar(2 / _clip.dot(_qv)); pe[2] = _clip.x; pe[6] = _clip.y; pe[10] = _clip.z + 1; pe[14] = _clip.w;
    RF.cam.projectionMatrixInverse.copy(RF.cam.projectionMatrix).invert();
    /* alvo: metade da resolução por eixo, só do tamanho do recorte */
    const q = env.quality ? env.quality() : null; renderer.getDrawingBufferSize(_sz); const k = Math.min(LK.reflScale * ((q && (q.resolved || q.name)) === 'media' ? 0.8 : 1), 960 / Math.max(1, _sz.x)); const W = Math.max(64, Math.round(_sz.x * k)), Hh = Math.max(64, Math.round(_sz.y * k)); /* Média: 0,4 por eixo; no máximo 960 de largura (telas 2× e 4K) */
    if (!RF.rt) { RF.rt = new THREE.WebGLRenderTarget(W, Hh, { type: rtType(), depthBuffer: true, stencilBuffer: false, generateMipmaps: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthTexture: new THREE.DepthTexture(W, Hh) }); RF.rt.texture.name = 'reflexo-lagos'; G.uRefl.value = RF.rt.texture; G.uReflDepth.value = RF.rt.depthTexture; } /* a profundidade separa céu (1) de objeto */
    else if (RF.rt.width !== W || RF.rt.height !== Hh) RF.rt.setSize(W, Hh);
    RF.vpW = Math.max(16, Math.min(W, Math.round((x1 - x0) / 2 * _sz.x * k))); RF.vpH = Math.max(16, Math.min(Hh, Math.round((y1 - y0) / 2 * _sz.y * k))); RF.rt.viewport.set(0, 0, RF.vpW, RF.vpH); RF.rt.scissor.set(0, 0, RF.vpW, RF.vpH); RF.rt.scissorTest = true;
    const su = RF.vpW / W, sv = RF.vpH / Hh; _bias.set(0.5 * su, 0, 0, 0.5 * su, 0, 0.5 * sv, 0, 0.5 * sv, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
    G.uReflMat.value.multiplyMatrices(_bias, RF.cam.projectionMatrix).multiply(RF.cam.matrixWorldInverse); G.uReflBox.value.set(0.5 / W, 0.5 / Hh, su - 0.5 / W, sv - 0.5 / Hh);
    _fr.setFromProjectionMatrix(_pm.multiplyMatrices(RF.cam.projectionMatrix, RF.cam.matrixWorldInverse));
    RF.want = true; LK.stats.lakes = n; if (probing) for (const L of LK.lakes) if (L.U.uReflOn) L.U.uReflOn.value = 0;
  }
  /* o passe roda no começo do passe principal (scene.onBeforeRender): as unidades já estão no lugar deste quadro e a sombra é a do quadro anterior */
  function reflRender(r, cam) {
    if (!RF.want || RF.busy || cam !== camera || !RF.rt) return; RF.want = false; RF.busy = true; RF.dead = false; RF.missed = 0; const t0 = performance.now();
    const prevRT = r.getRenderTarget(), prevFace = r.getActiveCubeFace(), prevMip = r.getActiveMipmapLevel(), prevAuto = r.autoClear, prevSh = r.shadowMap.autoUpdate, prevXr = r.xr.enabled, prevA = r.getClearAlpha(); r.getClearColor(_cc);
    let nh = 0; for (const o of RF.hide) { RF.save[nh++] = o.visible ? 1 : 0; o.visible = false; } let skip = 0; const tv = RF.terrain ? RF.terrain.visible : false; if (RF.terrain) { RF.terrain.visible = false; LK.proxy.visible = true; } for (const m of RF.inst) { RF.save[nh++] = m.visible ? 1 : 0; if (m.visible && m.parent && !instSeen(m)) { m.visible = false; skip++; } }
    try { r.xr.enabled = false; r.shadowMap.autoUpdate = false; r.autoClear = false; r.setRenderTarget(RF.rt); r.setClearColor(scene.background && scene.background.isColor ? scene.background : _bg, 1); r.clear(true, true, false);
      const inf = r.info.render, ar = r.info.autoReset, c0 = ar ? 0 : inf.calls, tr0 = ar ? 0 : inf.triangles; r.render(scene, RF.cam); LK.stats.calls = inf.calls - c0; LK.stats.tris = inf.triangles - tr0;
    } finally { r.setRenderTarget(prevRT, prevFace, prevMip); r.setClearColor(_cc, prevA); r.autoClear = prevAuto; r.shadowMap.autoUpdate = prevSh; r.xr.enabled = prevXr;
      nh = 0; for (const o of RF.hide) o.visible = RF.save[nh++] === 1; for (const m of RF.inst) m.visible = RF.save[nh++] === 1; if (RF.terrain) RF.terrain.visible = tv; LK.proxy.visible = false; RF.busy = false; }
    LK.stats.refl = 1; LK.stats.w = RF.vpW; LK.stats.h = RF.vpH; LK.stats.skipped = skip; LK.stats.ms = Math.round((performance.now() - t0) * 10) / 10;
  }
  const prevHook = scene.onBeforeRender; scene.onBeforeRender = function (r, s, cam, rt) { if (prevHook) prevHook.call(this, r, s, cam, rt); if (s === scene) reflRender(r, cam); };
  LK.dispose = function () { clear(); proxyMat.dispose(); if (RF.rt) RF.rt.dispose(); scene.remove(LK.group); if (scene.onBeforeRender && prevHook !== undefined) scene.onBeforeRender = prevHook; };

  /* ---------- efeitos: clarões, bolhas, vapor, brasas e neve soprada (FX.emit com vetores reaproveitados) ---------- */
  const _P = [0, 0, 0], _V = [0, 0, 0], _C = [0, 0, 0]; const rnd = Math.random;
  const C_GLOW = [1.55, 0.5, 0.12], C_EDGE = [1.3, 0.38, 0.08], C_POP = [1.9, 0.75, 0.2];
  function emit(b, x, y, z, vx, vy, vz, life, s0, s1, type, r, g, bl, grav, ease, spin, alpha, extra) { _P[0] = x; _P[1] = y; _P[2] = z; _V[0] = vx; _V[1] = vy; _V[2] = vz; _C[0] = r; _C[1] = g; _C[2] = bl; env.FX.emit(b, _P, _V, life, s0, s1, type, _C, grav, ease, spin, alpha, 0, extra); }
  function spot(L) { const n = L.spots.length >> 1; if (!n) return -1; return (Math.random() * n | 0) * 2; }
  function fogAt(x, y) { const t = G.uFog.value; const im = t && t.image; if (!im || !im.data || im.width < 2) return 1; const ix = Math.max(0, Math.min(im.width - 1, (x / S.WORLD * im.width) | 0)), iy = Math.max(0, Math.min(im.height - 1, (y / S.WORLD * im.height) | 0)); return im.data[(iy * im.width + ix) * 4] / 255; }
  function plasmaFx(L, dt, t, fxOn, pk) {
    /* luz: brilho largo que pulsa devagar (centro) e clarões menores pela margem — o mapa de clarões acende o chão e as unidades */
    const k = (0.62 + 0.14 * Math.sin(t * 0.7 + L.ph) + 0.06 * Math.sin(t * 2.3 + L.ph * 3)) * L.fogK * (0.45 + 0.55 * G.uNight.value); /* de dia o sol manda */
    if (env.flashNow) { /* clarão de um quadro só (se o render3d expuser): luz contínua sem ocupar a lista de clarões */
      env.flashNow(L.x, L.y, L.r * 1.5, C_GLOW, k * 1.5); for (let e = 0; e < 4; e++) { const a = L.ph + e * TAU / 4 + t * 0.05, rr = S.edgeR(L.r, a, L.k.seed) + 6; env.flashNow(L.x + Math.cos(a) * rr, L.y + Math.sin(a) * rr, 34 + L.r * 0.3, C_EDGE, k * (1.6 + 0.5 * Math.sin(t * 1.3 + e * 2.1))); } }
    else { L.ft -= dt; if (L.ft <= 0) { L.ft += 0.1; env.flash(L.x, L.y, L.r * 1.5, C_GLOW, k, 0.45, 0); for (let e = 0; e < 2; e++) { const a = rnd() * TAU, rr = S.edgeR(L.r, a, L.k.seed) + 6; env.flash(L.x + Math.cos(a) * rr, L.y + Math.sin(a) * rr, 34 + L.r * 0.3, C_EDGE, 1.2 * k, 0.45, 0); } } }
    const U = L.U.uBub.value;
    for (let i = 0; i < 6; i++) { const b = L.bubs[i]; if (!b.popped && t - b.t0 >= 1.6) { b.popped = true; if (fxOn) { const y = L.surf + 0.4; emit(env.FX.add, b.x, y + b.r * 0.3, -b.y, 0, 0, 0, 0.28, b.r * 1.4, b.r * 3.2, 1, 2.2, 0.9, 0.25, 0, 1.6, 0, 0.75, 0.2);
          for (let j = 0, nj = Math.round((3 + b.r * 1.5) * pk); j < nj; j++) { const a = rnd() * TAU, sp = 8 + rnd() * 16; emit(env.FX.add, b.x, y, -b.y, Math.cos(a) * sp, 18 + rnd() * 26, -Math.sin(a) * sp, 0.55 + rnd() * 0.4, 0.55 + rnd() * 0.4, 0.2, 2, C_POP[0], C_POP[1], C_POP[2], 150, 1, 0, 1, 0.6); }
          emit(env.FX.alp, b.x, y + 1, -b.y, 0, 5 + rnd() * 4, 0, 2.2 + rnd(), b.r * 1.2, b.r * 4.5, 3, 0.5, 0.46, 0.44, -0.4, 1.5, (rnd() - 0.5) * 0.6, 0.45, 2.5);
          env.flash(b.x, b.y, 14 + b.r * 6, C_POP, 1.3 * L.fogK, 0.35, 0); } }
      U[i].set(b.x, b.y, b.t0, b.popped && t - b.t0 > 2.5 ? 0 : b.r); }
    if (!fxOn) return;
    L.bt -= dt; if (L.bt <= 0) { L.bt = (0.7 + rnd() * 1.4) * 60 / Math.max(30, L.r); const s = spot(L); if (s >= 0) { for (let i = 0; i < 6; i++) { const b = L.bubs[i]; if (b.popped && t - b.t0 > 2.6) { b.x = L.spots[s] + (rnd() - 0.5) * 4; b.y = L.spots[s + 1] + (rnd() - 0.5) * 4; b.t0 = t; b.r = 1.4 + rnd() * 2.2; b.popped = false; break; } } } }
    /* vapor (aceso por baixo pela lava) e brasas que sobem e balançam */
    const dk = Math.min(0.25, dt) * pk * Math.min(1.6, L.r / 60);
    if (rnd() < 1.6 * dk) { const s = spot(L); if (s >= 0) emit(env.FX.alp, L.spots[s] + (rnd() - 0.5) * 8, L.surf + 3, -(L.spots[s + 1] + (rnd() - 0.5) * 8), (rnd() - 0.5) * 3, 10 + rnd() * 8, (rnd() - 0.5) * 3, 3.0 + rnd() * 1.5, 1.5 + rnd() * 1.5, 14 + rnd() * 10, 3, 0.6, 0.56, 0.54, -1.2, 1.2, (rnd() - 0.5) * 0.5, 0.24, 2.45); } /* vapor: nasce fino, sobe e abre */
    for (let n = 0, nn = Math.floor(4.5 * dk) + (rnd() < (4.5 * dk) % 1 ? 1 : 0); n < nn; n++) { const s = spot(L); if (s < 0) break; emit(env.FX.add, L.spots[s] + (rnd() - 0.5) * 10, L.surf + 0.6, -(L.spots[s + 1] + (rnd() - 0.5) * 10), (rnd() - 0.5) * 4, 7 + rnd() * 10, (rnd() - 0.5) * 4, 1.2 + rnd() * 1.6, 0.45 + rnd() * 0.45, 0.15, 10, 1.9, 0.72, 0.2, -1.5, 1, 0, 1, 1 + rnd() * 1.5); }
  }
  function iceFx(L, dt, pk) { const dk = Math.min(0.25, dt) * pk * Math.min(1.5, L.r / 80); if (rnd() < 0.9 * dk) { const s = spot(L); if (s < 0) return; const wv = 18 + rnd() * 14; emit(env.FX.alp, L.spots[s], L.surf + 0.4, -L.spots[s + 1], 0.94 * wv, 0.2, -0.34 * wv, 1.8 + rnd(), 1.2 + rnd() * 0.6, 4 + rnd() * 2.5, 4, 0.86, 0.9, 0.95, 0, 1.2, 0, 0.14, 0.3); } } /* neve soprada: rasteira, rápida e rala (não pode parecer fumaça) */

  /* ---------- quadro ---------- */
  let syncT = 2, fogT = 0;
  LK.update = function (dt, time, cam) {
    if (!LK.lakes.length) { RF.want = false; return; } cam = cam || camera;
    G.uTime.value = time; const q = env.quality ? env.quality() : null; const qn = q ? (q.resolved || q.name) : 'media'; G.uDetail.value = isTouch || qn === 'baixa' ? 0 : qn === 'media' ? 0.6 : 1;
    const LS = env.light ? env.light() : null; const nt = LS ? LS.night || 0 : 0; G.uNight.value = nt; if (LS && LS.sky) G.uSky.value.setRGB(LS.sky[0], LS.sky[1], LS.sky[2]);
    if ((fogT -= dt) <= 0) { fogT = 1; if (G.uFog.value === white) { const ft = findFog(); if (ft) G.uFog.value = ft; } }
    for (const L of LK.lakes) { L.mesh.material.envMapIntensity = L.mesh.material.userData.env * (1 - 0.72 * nt); if (L.shore) L.shore.material.envMapIntensity = L.shore.material.userData.env * (1 - 0.72 * nt); } proxyMat.envMapIntensity = proxyMat.userData.env * (1 - 0.72 * nt);
    if ((syncT -= dt) <= 0 && LK.T) { syncT = 3; for (const L of LK.lakes) shoreSync(L, LK.T); }
    RF.hideT -= dt; hideList(false); if (sunL) { const sd = G.uSunDir.value.subVectors(sunL.position, sunL.target.position); if (sd.lengthSq() > 1e-6) sd.normalize(); else sd.set(-0.47, 0.64, 0.6).normalize(); }
    /* visibilidade de cada lago na câmera principal */
    cam.updateMatrixWorld(); _pv.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    for (const L of LK.lakes) { const a = ndcBox(L.outline, _pv, _box); L.vis = a !== 0; L.area = a < 0 ? 4 : a; L.near = L.vis || (_box[0] < 1.6 && _box[2] > -1.6 && _box[1] < 1.6 && _box[3] > -1.6); L.fogK = fogAt(L.x, L.y); }
    setupRefl(cam);
    const fxOn = !!(env.FX && env.FX.emit) && !OFF.has('lagofx'); const pk = q ? q.particles == null ? 1 : q.particles : 1;
    for (const L of LK.lakes) { if (L.plasma) { if (L.near && L.fogK > 0.5) plasmaFx(L, dt, time, fxOn, pk); else { const U = L.U.uBub.value; for (let i = 0; i < 6; i++) U[i].w = 0; } } else if (fxOn && L.vis && L.fogK > 0.5) iceFx(L, dt, pk); }
  };
  /* névoa de guerra: o render3d passa env.fogTex (se não passar, acha a textura no material do terreno depois do primeiro quadro) */
  function findFog() { if (env.fogTex) return env.fogTex; let tex = null; scene.traverse(o => { if (tex || !o.isMesh || !o.geometry || !o.geometry.attributes || !o.geometry.attributes.bio || !o.material) return; const p = renderer.properties && renderer.properties.get(o.material); const u = p && p.uniforms; if (u && u.fogMap && u.fogMap.value) tex = u.fogMap.value; }); return tex; }
  LK.RF = RF; /* diagnóstico */
  LK.progs = () => { const P = renderer.info.programs || []; let n = 0; for (const pr of P) if (String(pr.cacheKey).indexOf('ard-lago') >= 0) n++; return { lagos: n, total: P.length }; }; /* programas dos lagos (devem existir desde o build) */
  /* diagnóstico: o que o último passe de reflexo desenharia (nome, triângulos × instâncias), do maior para o menor */
  LK.debugRefl = function () { const out = [], hid = new Set(RF.hide); if (RF.terrain) hid.add(RF.terrain); scene.traverseVisible(o => { if (!o.isMesh || hid.has(o)) return; let p = o; while (p) { if (hid.has(p)) return; p = p.parent; } if (o.isInstancedMesh && (!o.count || !instSeen(o))) return; if (o.frustumCulled !== false && !o.isInstancedMesh) { if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere(); _sph.copy(o.geometry.boundingSphere).applyMatrix4(o.matrixWorld); if (!_fr.intersectsSphere(_sph)) return; } const g = o.geometry, tri = (g.index ? g.index.count : g.attributes.position.count) / 3 * (o.isInstancedMesh ? o.count : g.isInstancedBufferGeometry ? g.instanceCount : 1); out.push([o.name || o.type + (o.material && o.material.type ? ':' + o.material.type : ''), Math.round(tri)]); });
    if (RF.terrain) for (const c of LK.proxy.children) { _sph.copy(c.geometry.boundingSphere); if (_fr.intersectsSphere(_sph)) out.push(['chao-reflexo', c.geometry.index.count / 3]); }
    return out.sort((a, b) => b[1] - a[1]).slice(0, 25); };
  return LK;
}
ARD.lakes3d = { create };
})(globalThis.ARD = globalThis.ARD || {});
