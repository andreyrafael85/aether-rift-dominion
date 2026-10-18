/* Aether Rift: Dominion — Modo Foto (4.3j).
   O jogador para (ou não) a partida e tira fotos de cinema do que construiu. O main.js cria um por partida 3D
   (ARD.photo3d.create({ G, R, view, I, ui, net, canvas, isTouch })); o botão 📷 do HUD e a tecla J ligam e desligam.
   O render3d chama os ganchos só com o modo ligado (R.photo.on):
   - R.photo.frame(dt) no começo de R.draw: anda a câmera livre e devolve { view, dt } — a vista sem HUD (seleção vazia, sem fantasma
     de construção, sem marcador; a câmera do foto no lugar da do jogo) e o dt dos efeitos (0 congelado, ¼ lento)
   - R.photo.night: a noite pedida no painel (null = a da partida)
   - R.photo.place(camera, sun, sky, home) no fim de updateCamera: câmera do foto (posição, giro do horizonte, lente, plano próximo),
     céu, planeta-mãe e a sombra do sol em volta do ponto da órbita
   - R.photo.light(sun, hemi, amb): tom quente do entardecer no sol
   - R.photo.render(composer, scene, camera, renderer, dt) no lugar do composer.render: encaixa o desfoque e o filtro, desenha e captura
   Câmera: órbita em volta de um ponto que desliza rente ao relevo (ou desce no vazio do Cinturão); tudo amortecido (alvo → atual).
   Não atravessa o relevo nem as construções; no vazio do Cinturão desce abaixo da borda, e ali encurta a distância em vez de
   atravessar o paredão das plataformas. Lente de 15° a 90° (vertical), giro do horizonte de ±25°.
   Profundidade de campo: DepthOfFieldEffect do pmndrs num passe próprio logo antes do passe do bloom e do tone mapping (HDR linear,
   já com a bruma de altura); foco no centro da órbita, num ponto tocado (profundidade lida do próprio quadro) ou numa unidade que
   o foco acompanha; a abertura (f/1,4 a f/22) define o alcance do foco (proporcional à distância) e o tamanho do desfoque.
   Filtros: um efeito próprio no fim da cadeia (depois do tone mapping e do SMAA, em espaço de tela): balanço de branco, contraste,
   saturação, preto e branco com filtro de canal, tom em sombras e luzes, preto lavado, curva em S, vinheta, grão de filme e
   aberração cromática, e faixas de cinema 2,39:1. Exposição pela exposição do tone mapping; brilho pela intensidade do bloom.
   Captura: Tela, 2K (2560×1440) e 4K (3840×2160) no computador; Tela e 2K no celular. O quadro da foto é desenhado inteiro na
   resolução pedida (canvas maior, sem mexer no tamanho dele na tela; a câmera mantém o enquadramento da tela, com guia quando a
   proporção muda) e lido do canvas no mesmo quadro (PNG aether-rift-AAAA-MM-DD-HHMMSS.png); no quadro seguinte tudo volta ao
   tamanho da tela e os alvos grandes são liberados.
   Custo: desligado, nada por quadro (só o atalho de teclado e o botão; o painel e os efeitos nascem na primeira entrada); ligado,
   +2 passes (desfoque, ~7 subpasses em meia resolução; filtro, 1 passe) e nenhuma alocação por quadro. */
(function (ARD) {
'use strict';
const DEG = Math.PI / 180;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const ease = (k, dt) => 1 - Math.exp(-k * dt);
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;
const num = (v, d) => v.toFixed(d).replace('.', ',').replace(/^-/, '−'); /* 4.3j: números com vírgula e sinal de menos */
const fNum = a => 1.4 * Math.pow(22 / 1.4, a); /* 4.3j: abertura do painel (0..1) → número f */
const STORE = 'ard-foto-1';
const NOOP = function () {};
const LIVE = ['fov', 'roll']; /* controles que o mouse e o teclado também mudam */

/* 4.3j: filtros com nome — os ajustes do painel (ev … ab) e o caráter de cada um (preto e branco com filtro de canal, tom das sombras
   e das luzes, preto lavado e curva em S). Escolher um filtro põe os ajustes nos valores dele; o caráter fica até trocar de filtro */
const LOOKS = [
  { id: 'natural', nome: 'Natural' },
  { id: 'cinema', nome: 'Cinema', con: 1.1, sat: 1.06, temp: 0.06, vig: 0.38, grao: 0.12, ab: 0.12, curva: 0.35, sh: [0.2, 0.55, 0.62], hi: [1.0, 0.74, 0.5], split: 0.42 },
  { id: 'noir', nome: 'Noir', ev: -0.2, con: 1.36, vig: 0.58, grao: 0.42, mono: 1, monoW: [0.62, 0.34, 0.04], curva: 0.78 },
  { id: 'quente', nome: 'Quente', ev: 0.05, con: 1.04, sat: 1.12, temp: 0.55, vig: 0.22, grao: 0.06, sh: [0.62, 0.45, 0.4], hi: [1.0, 0.8, 0.55], split: 0.2, fade: 0.02 },
  { id: 'frio', nome: 'Frio', con: 1.08, sat: 0.86, temp: -0.55, vig: 0.24, grao: 0.06, sh: [0.3, 0.45, 0.7], hi: [0.85, 0.92, 1.0], split: 0.25 },
  { id: 'fenda', nome: 'Fenda', con: 1.12, sat: 1.18, vig: 0.38, grao: 0.1, ab: 0.3, sh: [0.2, 0.8, 0.95], hi: [1.0, 0.55, 0.9], split: 0.34, curva: 0.28 },
  { id: 'vintage', nome: 'Vintage', ev: 0.05, con: 0.9, sat: 0.7, temp: 0.32, vig: 0.42, grao: 0.36, ab: 0.22, fade: 0.1, sh: [0.3, 0.36, 0.45], hi: [1.0, 0.86, 0.62], split: 0.32 },
  { id: 'epico', nome: 'Épico', ev: -0.1, con: 1.2, sat: 1.16, temp: 0.04, vig: 0.46, grao: 0.08, ab: 0.1, curva: 0.6, sh: [0.25, 0.4, 0.65], hi: [1.0, 0.78, 0.52], split: 0.28 },
];
const ADJ = { ev: 0, con: 1, sat: 1, temp: 0, vig: 0, grao: 0, ab: 0 };
const DEF = Object.assign({ look: 'natural', faixas: false, dof: true, abert: 0.63, res: 'tela', tab: 'cam', fold: false, bloom: 1, hora: 0, horaJogo: true, luzAz: 0 }, ADJ);

/* 4.3j: filtro em espaço de tela (entra já com tone mapping, sai linear para a codificação sRGB do último passe) */
const FOTO_FS = 'uniform vec3 uWB; uniform float uCon; uniform float uSat; uniform float uMono; uniform vec3 uMonoW; uniform vec3 uSh; uniform vec3 uHi; uniform float uSplit; uniform float uFade; uniform float uCurve; uniform float uVig; uniform float uGrain; uniform float uCA; uniform float uBars; uniform float uSeed;\n' +
  'float fotoHash(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }\n' +
  'float fotoNoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(fotoHash(i), fotoHash(i + vec2(1.0, 0.0)), f.x), mix(fotoHash(i + vec2(0.0, 1.0)), fotoHash(i + vec2(1.0, 1.0)), f.x), f.y); }\n' +
  'void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {\n' +
  '  vec3 c = inputColor.rgb; vec2 dc = uv - 0.5; const vec3 LW = vec3(0.2126, 0.7152, 0.0722);\n' +
  '  if (uCA > 0.0) { vec2 o = dc * dot(dc, dc) * uCA * 0.05; c.r = texture2D(inputBuffer, uv - o).r; c.b = texture2D(inputBuffer, uv + o).b; }\n' +
  '  c = pow(max(c, vec3(0.0)), vec3(0.4545)) * uWB;\n' +
  '  c = mix(c, vec3(dot(c, uMonoW)), uMono);\n' +
  '  float l = dot(c, LW); c = max(mix(vec3(l), c, uSat), vec3(0.0));\n' +
  '  c = clamp((c - 0.45) * uCon + 0.45, 0.0, 1.0); c = mix(c, c * c * (3.0 - 2.0 * c), uCurve);\n' +
  '  if (uSplit > 0.0) { float lt = dot(c, LW); vec3 t = mix(uSh, uHi, smoothstep(0.15, 0.85, lt)); t /= max(dot(t, LW), 0.001); c = mix(c, c * t, uSplit); }\n' +
  '  c = mix(vec3(uFade), vec3(1.0 - uFade * 0.3), c);\n' +
  '  float ar = resolution.x / max(resolution.y, 1.0); float dv = length(dc * vec2(ar, 1.0)) / length(vec2(ar * 0.5, 0.5)); c *= 1.0 - uVig * 0.92 * smoothstep(0.3, 1.0, dv);\n' +
  '  if (uGrain > 0.0) { vec2 gp = uv * resolution / (1.25 * max(1.0, resolution.y / 1100.0)) + uSeed * 57.0; float n = fotoNoise(gp) + 0.6 * fotoNoise(gp * 1.93 + 11.7) - 0.8; float lt = dot(c, LW); c += n * uGrain * 0.17 * (0.35 + 0.65 * (1.0 - min(1.0, abs(lt - 0.5) * 1.6))); }\n' +
  '  if (uBars > 0.0 && ar < uBars && abs(dc.y) > 0.5 * ar / uBars) c = vec3(0.0);\n' +
  '  outputColor = vec4(pow(clamp(c, 0.0, 1.0), vec3(2.2)), inputColor.a);\n}';
/* 4.3j: leitura da profundidade de um pixel (foco por toque): profundidade 0..1 em 24 bits num alvo 1×1 */
const DS_VS = 'void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }';
const DS_FS = 'uniform sampler2D tDepth; uniform vec2 uUv; void main() { float d = texture2D(tDepth, uUv).r; if (d >= 0.9999999) { gl_FragColor = vec4(1.0); return; } vec3 e = fract(d * vec3(1.0, 255.0, 65025.0)); e -= e.yzz * vec3(1.0 / 255.0, 1.0 / 255.0, 0.0); gl_FragColor = vec4(e, 0.0); }';

const CSS = `body.foto #hud,body.foto #overlay{display:none}
.fo-root{position:absolute;inset:0;z-index:4;pointer-events:none;color:var(--fg);font-family:var(--fb)}
.fo-layer{position:absolute;inset:0;pointer-events:auto;touch-action:none;cursor:grab;outline:none}
.fo-layer.fo-drag{cursor:grabbing}
.fo-guide{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);border:1px dashed rgba(255,255,255,.62);box-shadow:0 0 0 200vmax rgba(0,0,0,.34);pointer-events:none}
.fo-bars{position:absolute;inset:0;pointer-events:none}.fo-bars i{position:absolute;left:0;right:0;background:#000}.fo-bars i:first-child{top:0}.fo-bars i:last-child{bottom:0}
.fo-flash{position:absolute;inset:0;background:#fff;opacity:0;pointer-events:none;transition:opacity .55s ease-out}.fo-flash.on{opacity:.72;transition:none}
.fo-ring{position:absolute;width:44px;height:44px;margin:-22px 0 0 -22px;border:2px solid #fff;border-radius:50%;pointer-events:none;opacity:0;box-shadow:0 0 0 1px rgba(0,0,0,.45),inset 0 0 0 1px rgba(0,0,0,.45)}
.fo-ring.on{animation:foRing .75s ease-out}
@keyframes foRing{0%{opacity:.95;transform:scale(1.6)}55%{opacity:.9;transform:scale(1)}100%{opacity:0;transform:scale(.92)}}
.fo-toast{position:absolute;left:50%;top:calc(.8rem + env(safe-area-inset-top,0px));transform:translateX(-50%);max-width:min(560px,calc(100vw - 2rem));background:rgba(13,15,19,.92);border:1px solid var(--line);border-left:3px solid var(--good);border-radius:8px;padding:.45rem .85rem;font:500 12.5px var(--fm);opacity:0;transition:opacity .25s;pointer-events:none;text-align:center}
.fo-toast.on{opacity:1}.fo-toast.warn{border-left-color:var(--warn)}
.fo-panel{position:absolute;top:calc(.6rem + env(safe-area-inset-top,0px));right:.6rem;width:306px;max-height:calc(100% - 1.2rem);display:flex;flex-direction:column;pointer-events:auto;background:rgba(13,15,20,.86);-webkit-backdrop-filter:blur(12px) saturate(1.15);backdrop-filter:blur(12px) saturate(1.15);border:1px solid rgba(255,255,255,.1);border-radius:12px;box-shadow:0 14px 36px rgba(0,0,0,.5);font-size:12.5px;overflow:hidden}
.fo-head{display:flex;align-items:center;gap:.4rem;padding:.45rem .5rem .45rem .5rem;border-bottom:1px solid rgba(255,255,255,.07)}
.fo-head b{font-family:var(--fd);font-size:17px;font-weight:700;letter-spacing:.05em;text-transform:uppercase}
.fo-sp{flex:1}
.fo-ib{width:30px;height:30px;flex:none;border-radius:7px;border:1px solid var(--line);background:rgba(28,31,37,.9);display:grid;place-items:center;font-size:14px;line-height:1}
.fo-ib.fo-cam{background:var(--rift1);border-color:var(--rift1)}
.fo-ib:hover,.fo-seg button:hover:not(:disabled),.fo-chip:hover,.fo-btns button:hover{border-color:var(--fg2)}
.fo-body{overflow:auto;padding:.55rem .8rem .35rem;display:grid;gap:.55rem;overscroll-behavior:contain}
.fo-panel.fold .fo-body{display:none}.fo-panel.fold .fo-head{border-bottom:0}
.fo-seg{display:flex;gap:3px}.fo-seg button{flex:1;min-height:30px;border:1px solid var(--line);border-radius:6px;background:rgba(28,31,37,.9);font:500 11.5px var(--fm);padding:0 .3rem;white-space:nowrap}
.fo-seg button.on{background:var(--rift1);border-color:var(--rift1);color:#14161A}
.fo-seg button:disabled{opacity:.38;cursor:default}
.fo-note{margin:0;font-size:11.5px;color:var(--warn);border-left:2px solid var(--warn);padding-left:.5rem;line-height:1.35}
.fo-tabs{display:flex;gap:2px;border-bottom:1px solid rgba(255,255,255,.08)}
.fo-tabs button{flex:1;padding:.35rem 0 .4rem;font:600 11px var(--fm);letter-spacing:.06em;text-transform:uppercase;color:var(--fg2);border-bottom:2px solid transparent;margin-bottom:-1px}
.fo-tabs button.on{color:var(--fg);border-bottom-color:var(--rift1)}
.fo-pane{display:grid;gap:.5rem}
.fo-sl{display:grid;grid-template-columns:5.4rem 1fr 4.4rem;align-items:center;gap:.45rem}
.fo-sl span{color:var(--fg2)}.fo-sl output{font:500 10.5px var(--fm);text-align:right;color:var(--fg);white-space:nowrap}
.fo-sl input{width:100%;accent-color:var(--rift1);height:22px;margin:0}
.fo-sl.off{opacity:.4}
.fo-chk{display:flex;align-items:center;gap:.45rem;min-height:26px;cursor:pointer}.fo-chk input{accent-color:var(--rift1);width:16px;height:16px;margin:0}.fo-chk.off{opacity:.4}
.fo-looks{display:grid;grid-template-columns:repeat(4,1fr);gap:4px}
.fo-chip{min-height:30px;border:1px solid var(--line);border-radius:6px;background:rgba(28,31,37,.9);font:500 11px var(--fm);padding:0 .15rem}
.fo-chip.on{border-color:var(--rift1);color:#FF8A6C;background:rgba(255,94,58,.12)}.fo-chip:disabled{opacity:.38;cursor:default}
.fo-btns{display:flex;gap:4px;flex-wrap:wrap}.fo-btns button{flex:1;min-height:30px;border:1px solid var(--line);border-radius:6px;background:rgba(28,31,37,.9);font:500 11px var(--fm);padding:0 .4rem;white-space:nowrap}
.fo-help{margin:0;font-size:11px;line-height:1.5;color:var(--fg2)}.fo-help b{color:var(--fg);font-weight:500}
.fo-focus{font-size:12px;color:var(--fg2)}.fo-focus b{color:var(--fg);font-weight:500}
.fo-foot{display:flex;align-items:center;gap:.6rem;padding:.5rem .8rem .6rem;border-top:1px solid rgba(255,255,255,.07)}
.fo-panel.fold .fo-foot{border-top:0;padding-top:.15rem}
.fo-foot .fo-seg{flex:1}
.fo-shot{flex:none;width:52px;height:52px;border-radius:50%;border:3px solid #fff;display:grid;place-items:center;background:rgba(0,0,0,.3);box-shadow:0 2px 10px rgba(0,0,0,.5)}
.fo-shot i{width:38px;height:38px;border-radius:50%;background:#fff;transition:transform .12s}
.fo-shot:active i{transform:scale(.86)}.fo-shot.busy i{background:var(--rift1);animation:foPulse .7s infinite alternate}
@keyframes foPulse{to{opacity:.45}}
@media (max-width:640px){.fo-panel{left:.5rem;right:.5rem;top:auto;bottom:calc(.5rem + env(safe-area-inset-bottom,0px));width:auto;max-height:min(44vh,400px)}}
body.touch .fo-panel{left:.5rem;right:.5rem;top:auto;bottom:calc(.5rem + env(safe-area-inset-bottom,0px));width:auto;max-height:min(44vh,400px)}
body.touch .fo-sl{grid-template-columns:4.9rem 1fr 4.2rem}body.touch .fo-sl input{height:30px}
body.touch .fo-seg button,body.touch .fo-chip,body.touch .fo-btns button{min-height:38px}
body.touch .fo-ib{width:38px;height:38px}
body.touch .fo-shot{width:60px;height:60px}body.touch .fo-shot i{width:45px;height:45px}
body.touch .fo-toast{top:calc(.6rem + env(safe-area-inset-top,0px))}
@media (prefers-reduced-motion:reduce){.fo-flash{transition:none}.fo-ring.on,.fo-shot.busy i{animation:none}}`;

function create(ctx) {
  const THREE = window.THREE, S = ARD.sim;
  const G = ctx.G, R = ctx.R, view = ctx.view, ui = ctx.ui || null, canvas = ctx.canvas || R.canvas, net = ctx.net || null, isTouch = !!ctx.isTouch;
  const PH = { on: false, view: null, dt: 0, night: null };
  R.photo = PH;
  const btn = document.getElementById('btn-foto');
  if (btn) { btn.hidden = false; btn.addEventListener('click', () => (PH.on ? exit() : enter())); }

  /* ---------- estado ---------- */
  const st = {
    root: null, el: null, cfg: null, look: LOOKS[0],
    tx: 0, ty: 0, txG: 0, tyG: 0, hOff: 0, hOffG: 0, ref: 0, yaw: 0, yawG: 0, pitch: 0.95, pitchG: 0.95, dist: 760, distG: 760, roll: 0, rollG: 0, fov: 38, fovG: 38, near: 30,
    T: new THREE.Vector3(), C: new THREE.Vector3(), entry: null,
    follow: -1, focusMode: 'centro', focusEnt: -1, focusP: new THREE.Vector3(), focusName: '',
    time: 'livre', stepT: 0, frozen: false, emit0: null, flash0: null, part0: 1, saved: null,
    comp: null, fx: null, dof: null, dofPass: null, fotoFx: null, fotoPass: null, bloomFx: null, bloom0: 0.75, exp0: null, lookDirty: true,
    renderer: null, camera: null, near0: 30, far0: 11000, firstPlace: true,
    elev0: 0.7, az0: 0, len0: 985, warm: 0,
    cap: null, lastShot: null, keys: new Set(), ptr: new Map(), drag: null, pinch: null, lastTap: 0, lastTapX: 0, lastTapY: 0,
    occ: false, uiT: 0, uiDirty: true, saveT: 0, toastT: 0, ds: null,
  };
  const pcam = { x: 0, y: 0, zoom: 1, yaw: Math.PI / 4, pitch: 0.95, pitchT: 0.95 }; /* 4.3j: câmera que o R.draw usa no lugar da do jogo (alvo, distância e giro do foto) */
  const PV = { cam: pcam, sel: new Set(), hover: null, ghost: null, wallGhost: null, box: null, human: view.human, memory: view.memory, marker: null, mode: 'normal', lastAlert: null, reveal: false };
  PH.view = PV;
  const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _w2 = new THREE.Vector3();

  /* ---------- relevo ---------- */
  const H = (x, y) => R.H(x, y);
  const isVoid = (x, y) => !!R.cinturao && H(x, y) < -90; /* 4.3j: no Cinturão, abaixo de −90 o chão é o vazio do espaço (o terreno some ali) */
  const groundRef = (x, y) => { const h = H(x, y); return R.cinturao ? Math.max(h, -30) : h; }; /* altura de referência do ponto da órbita (no vazio, a das plataformas) */
  const topAt = (x, z) => { const h = H(x, -z); return R.cinturao && h < -90 ? -1e9 : h; }; /* topo sólido numa coluna (coordenadas three) */
  const WORLD = S.WORLD;

  /* ---------- configuração guardada ---------- */
  function loadCfg() {
    let c = null; try { c = JSON.parse(localStorage.getItem(STORE) || 'null'); } catch (e) { c = null; }
    const o = Object.assign({}, DEF, { fold: isTouch }); /* no celular o painel começa recolhido (a cena inteira à vista) */
    if (c && typeof c === 'object') for (const k in DEF) if (c[k] != null && typeof c[k] === typeof DEF[k]) o[k] = c[k];
    if (!LOOKS.some(L => L.id === o.look)) o.look = 'natural';
    if (isTouch && o.res === '4k') o.res = '2k';
    if (['cam', 'foco', 'filtro', 'luz'].indexOf(o.tab) < 0) o.tab = 'cam';
    o.horaJogo = true; o.luzAz = 0; o.hora = 0; /* a luz volta à da partida a cada entrada */
    return o;
  }
  function saveCfg() { clearTimeout(st.saveT); st.saveT = setTimeout(() => { try { localStorage.setItem(STORE, JSON.stringify(st.cfg)); } catch (e) {} }, 400); }

  /* ---------- entrar e sair ---------- */
  function modalOpen() { if (ui && ui.modalOpen && ui.modalOpen()) return true; return !!document.querySelector('.modal:not([hidden])'); }
  function canEnter() { const ld = document.getElementById('loading'); return !!R.is3d && !G.ended && !G.bench && !(ld && !ld.hidden) && !modalOpen(); }
  function canPause() { return !net && !(G.camp && G.camp.noPause); }
  function enter() {
    if (PH.on || !canEnter()) return;
    if (!st.root) build();
    const cam = view.cam, sd = R.sunDir;
    st.saved = { cam: Object.assign({}, cam), paused: G.paused, speed: G.speed, pauseWhy: G.pauseWhy, autoPaused: G.autoPaused, perfAuto: G.perf ? G.perf.auto : null, sunDir: [sd[0], sd[1], sd[2]], fixedDt: R.fixedDt };
    if (G.perf) G.perf.auto = false; /* o ajuste de qualidade pelo FPS não mexe na qualidade durante as fotos */
    st.len0 = Math.hypot(sd[0], sd[1], sd[2]) || 985; st.elev0 = Math.atan2(sd[1], Math.hypot(sd[0], sd[2])); st.az0 = Math.atan2(sd[2], sd[0]);
    /* a câmera do foto começa exatamente na do jogo */
    st.tx = st.txG = cam.x; st.ty = st.tyG = cam.y; st.ref = groundRef(cam.x, cam.y);
    st.hOff = st.hOffG = (R.camTy != null ? R.camTy : st.ref) - st.ref;
    st.yaw = st.yawG = cam.yaw == null ? Math.PI / 4 : cam.yaw; st.pitch = st.pitchG = R.pitchEff != null ? R.pitchEff : (cam.pitch == null ? 0.95 : cam.pitch);
    st.dist = st.distG = R.camDist || 760; st.roll = st.rollG = 0; st.fov = st.fovG = R.h > R.w * 1.05 ? 46 : 38;
    st.entry = { tx: st.tx, ty: st.ty, hOff: st.hOff, yaw: st.yaw, pitch: st.pitch, dist: st.dist, fov: st.fov };
    st.follow = -1; st.focusMode = 'centro'; st.focusEnt = -1; st.firstPlace = true; st.keys.clear(); st.ptr.clear(); st.drag = null; st.pinch = null;
    st.cfg.horaJogo = true; st.cfg.luzAz = 0; st.cfg.hora = horaOf(R.night || 0);
    PH.on = true; st.lookDirty = true; st.uiDirty = true;
    if (canPause()) setTime('congelado'); else st.time = 'livre';
    document.body.classList.add('foto'); st.root.hidden = false; if (btn) btn.classList.add('on');
    refreshNotes(); syncUI(); guide();
    toast(isTouch ? 'Modo Foto · um dedo orbita, dois arrastam e fazem pinça' : 'Modo Foto · arraste para orbitar · Espaço tira a foto · Esc sai', false, 2600);
  }
  function exit() {
    if (!PH.on) return; PH.on = false;
    const sv = st.saved;
    freeze(false);
    if (st.cap) capAbort();
    if (canPause()) { G.paused = sv.paused; G.speed = sv.speed; G.pauseWhy = sv.pauseWhy; G.autoPaused = sv.autoPaused; }
    if (G.perf && sv.perfAuto != null) { G.perf.auto = sv.perfAuto; const now = performance.now(); G.perf.t0 = now; G.perf.frames = 0; G.perf.low = 0; G.perf.high = 0; }
    Object.assign(view.cam, sv.cam); R.camTy = null; /* a altura do alvo do jogo encaixa de novo na hora */
    R.sunDir[0] = sv.sunDir[0]; R.sunDir[1] = sv.sunDir[1]; R.sunDir[2] = sv.sunDir[2]; R.fixedDt = sv.fixedDt; PH.night = null; st.warm = 0;
    if (st.renderer && st.exp0 != null) st.renderer.toneMappingExposure = st.exp0; st.exp0 = null;
    detachPasses(true);
    if (st.camera) { st.camera.near = st.near0; st.camera.far = st.far0; }
    if (R.resize) R.resize(); /* lente e proporção da câmera do jogo */
    document.body.classList.remove('foto'); st.root.hidden = true; if (btn) btn.classList.remove('on');
    st.keys.clear(); st.ptr.clear(); st.drag = null; st.pinch = null; saveCfg();
  }

  /* ---------- tempo ---------- */
  function freeze(on) { /* 4.3j: congelado = nada nasce nem envelhece: sem partículas novas (FX.emit), sem clarões novos (R.flash) e sem as chuvas antigas do clima */
    const FX = R.FX;
    if (on && !st.frozen) { st.frozen = true; if (FX) { st.emit0 = FX.emit; FX.emit = NOOP; } st.flash0 = R.flash; R.flash = NOOP; st.part0 = R.quality.particles; R.quality.particles = 0; }
    else if (!on && st.frozen) { st.frozen = false; if (FX && st.emit0) FX.emit = st.emit0; st.emit0 = null; if (st.flash0) R.flash = st.flash0; st.flash0 = null; R.quality.particles = st.part0; }
  }
  function setTime(t) {
    if (!canPause()) { st.time = 'livre'; syncTime(); return; }
    st.time = t; st.stepT = 0;
    if (t === 'congelado') { G.paused = true; G.pauseWhy = 'Modo Foto: tempo congelado.'; freeze(true); }
    else { G.paused = false; G.speed = t === 'lento' ? 0.25 : (st.saved && st.saved.speed > 0 ? st.saved.speed : 1); freeze(false); }
    syncTime();
  }
  function step() { if (st.time !== 'congelado') return; setTime('lento'); st.stepT = 0.9; } /* avança ~0,2 s de jogo em câmera lenta e congela de novo */

  /* ---------- quadro (começo do R.draw) ---------- */
  PH.frame = function (dt) {
    if (G.ended) { exit(); return null; }
    const rdt = clamp(dt || 0, 0, 0.1);
    if (st.stepT > 0) { st.stepT -= rdt; if (st.stepT <= 0) setTime('congelado'); }
    if (st.keys.size) keysMove(rdt);
    if (st.follow >= 0) { const e = G.sim.byId.get(st.follow); if (e && e.alive) { st.txG = e.x; st.tyG = e.y; st.hOffG = centerY(e) - groundRef(e.x, e.y); } else st.follow = -1; }
    if (st.focusMode === 'ent') { const e = G.sim.byId.get(st.focusEnt); if (e && e.alive) st.focusP.set(e.x, centerY(e), -e.y); }
    smooth(rdt); place0();
    pcam.x = st.tx; pcam.y = st.ty; pcam.yaw = st.yaw; pcam.pitch = pcam.pitchT = clamp(st.pitch, 0.2, 1.12);
    pcam.zoom = (R.CAM ? R.CAM.baseDist : 760) * frameK() / st.dist; /* o R.draw deduz a distância (detalhe do chão, sombra, mapa de clarões) desta "lente" */
    PV.memory = view.memory; PV.reveal = view.reveal; PV.human = view.human;
    lightTick();
    if (st.cap) { if (st.cap.phase === 'pre') capPre(); else if (st.cap.phase === 'restore') capRestore(); }
    if ((st.uiT -= rdt) <= 0) { st.uiT = 0.15; if (st.uiDirty) syncLive(); }
    PH.dt = st.time === 'congelado' ? 0 : st.time === 'lento' ? dt * 0.25 : dt;
    return PH;
  };
  function frameK() { return R.h > R.w * 1.05 ? 1 + Math.min(0.85, (R.h / R.w - 1) * 0.6) : 1; } /* mesma moldura do celular em pé do updateCamera */
  function centerY(e) { const ud = e.kind === 'unit' ? S.UNITS[e.def] : null; return H(e.x, e.y) + (ud && ud.flying ? 14 : 0) + e.r * 0.55; }
  function keysMove(rdt) {
    const K = st.keys, fast = K.has('ShiftLeft') || K.has('ShiftRight') ? 3 : 1;
    const fw = (K.has('KeyW') || K.has('ArrowUp') ? 1 : 0) - (K.has('KeyS') || K.has('ArrowDown') ? 1 : 0);
    const rt = (K.has('KeyD') || K.has('ArrowRight') ? 1 : 0) - (K.has('KeyA') || K.has('ArrowLeft') ? 1 : 0);
    const up = (K.has('KeyE') ? 1 : 0) - (K.has('KeyQ') ? 1 : 0);
    if (fw || rt) { const sp = Math.max(30, st.distG * 0.8) * fast * rdt, s = Math.sin(st.yaw), c = Math.cos(st.yaw); moveTarget((-s * fw + c * rt) * sp, (c * fw + s * rt) * sp); st.follow = -1; }
    if (up) { st.hOffG += up * Math.max(18, st.distG * 0.45) * fast * rdt; st.follow = -1; }
    const pt = (K.has('KeyF') ? 1 : 0) - (K.has('KeyR') ? 1 : 0); if (pt) st.pitchG = clamp(st.pitchG + pt * 0.8 * fast * rdt, -0.45, 1.52);
    const yw = (K.has('KeyC') ? 1 : 0) - (K.has('KeyZ') ? 1 : 0); if (yw) st.yawG += yw * 1.1 * fast * rdt;
    const rl = (K.has('Period') ? 1 : 0) - (K.has('Comma') ? 1 : 0); if (rl) st.rollG = clamp(st.rollG + rl * 0.35 * rdt, -25 * DEG, 25 * DEG);
    const fv = (K.has('Equal') || K.has('NumpadAdd') ? 1 : 0) - (K.has('Minus') || K.has('NumpadSubtract') ? 1 : 0); if (fv) st.fovG = clamp(st.fovG * Math.exp(-fv * 0.8 * rdt), 15, 90);
    st.uiDirty = true;
  }
  function moveTarget(dx, dy) { /* desliza o ponto da órbita; do vazio abaixo da borda não entra por dentro de uma plataforma */
    const nx = clamp(st.txG + dx, -400, WORLD + 400), ny = clamp(st.tyG + dy, -400, WORLD + 400);
    if (R.cinturao && !isVoid(nx, ny) && groundRef(st.txG, st.tyG) + st.hOffG < H(nx, ny) - 2) return;
    st.txG = nx; st.tyG = ny;
  }
  function smooth(rdt) {
    const k = ease(10, rdt), kz = ease(8, rdt);
    if (!isVoid(st.txG, st.tyG)) st.hOffG = Math.max(st.hOffG, 0); else st.hOffG = Math.max(st.hOffG, -650);
    st.hOffG = Math.min(st.hOffG, 2400);
    st.tx += (st.txG - st.tx) * k; st.ty += (st.tyG - st.ty) * k; st.hOff += (st.hOffG - st.hOff) * k;
    st.yaw += (st.yawG - st.yaw) * k; st.pitch += (st.pitchG - st.pitch) * k; st.roll += (st.rollG - st.roll) * k;
    st.dist *= Math.exp(Math.log(st.distG / st.dist) * kz); st.fov += (st.fovG - st.fov) * kz;
    const g = groundRef(st.tx, st.ty); if (Math.abs(g - st.ref) > 300) st.ref = g; else st.ref += (g - st.ref) * ease(6, rdt); /* segue o relevo sem tremer */
  }
  function snap() { st.tx = st.txG; st.ty = st.tyG; st.hOff = st.hOffG; st.yaw = st.yawG; st.pitch = st.pitchG; st.roll = st.rollG; st.dist = st.distG; st.fov = st.fovG; st.ref = groundRef(st.tx, st.ty); place0(); }
  function place0() { /* ponto da órbita (T) e posição da câmera (C), sem atravessar o relevo, as plataformas e as construções */
    let th = st.ref + st.hOff; const g = H(st.tx, st.ty); if (!isVoid(st.tx, st.ty)) th = Math.max(th, g + 0.6);
    const T = st.T, C = st.C; T.set(st.tx, th, -st.ty);
    const cp = Math.cos(st.pitch); C.set(st.tx + Math.sin(st.yaw) * cp * st.dist, th + Math.sin(st.pitch) * st.dist, -st.ty + Math.cos(st.yaw) * cp * st.dist);
    C.x = clamp(C.x, -1500, WORLD + 1500); C.z = clamp(C.z, -WORLD - 1500, 1500); C.y = clamp(C.y, -950, 3600);
    const m0 = 2;
    let top = topAt(C.x, C.z);
    if (C.y < top + m0) {
      const lift = top + m0 - C.y;
      if (lift > 70 && R.cinturao) { /* câmera no vazio abaixo da borda indo para dentro da plataforma: encurta a distância e fica rente ao paredão */
        let t0 = 0; const N = 28; for (let i = 1; i <= N; i++) { const t = i / N; const x = T.x + (C.x - T.x) * t, y = T.y + (C.y - T.y) * t, z = T.z + (C.z - T.z) * t; if (y < topAt(x, z) + m0) break; t0 = t; }
        t0 = Math.max(0.04, t0); C.set(T.x + (C.x - T.x) * t0, T.y + (C.y - T.y) * t0, T.z + (C.z - T.z) * t0); top = topAt(C.x, C.z); if (C.y < top + m0) C.y = top + m0;
      } else C.y = top + m0; /* desliza por cima do relevo */
    }
    if (C.y - Math.max(top, -60) < 220) { /* não entra nas construções */
      const ents = G.sim.ents; for (let i = 0; i < ents.length; i++) { const e = ents[i]; if (!e.alive || e.kind !== 'building') continue; const dx = C.x - e.x, dz = C.z + e.y, rr = e.r * 0.92; if (dx * dx + dz * dz > rr * rr) continue; const bt = H(e.x, e.y) + e.r * 1.3 + m0; if (C.y < bt) C.y = bt; }
    }
    const hag = C.y - Math.max(top, -1e5); st.near = clamp(Math.min(st.dist * 0.04, hag * 0.55 + 0.3, C.distanceTo(T) * 0.4), 0.5, 30); /* plano próximo pequeno rente ao chão */
  }

  /* ---------- luz ---------- */
  function horaOf(n) { if (n <= 0.001) return 0; let a = 0.42, b = 0.95; for (let i = 0; i < 16; i++) { const m = (a + b) / 2; if (sstep(0.42, 0.95, m) < n) a = m; else b = m; } return (a + b) / 2; }
  function lightTick() {
    const c = st.cfg, sd = R.sunDir, sv = st.saved.sunDir;
    if (c.horaJogo && Math.abs(c.luzAz) < 0.01) { PH.night = null; st.warm = 0; sd[0] = sv[0]; sd[1] = sv[1]; sd[2] = sv[2]; return; }
    let elev = st.elev0;
    if (!c.horaJogo) { const h = c.hora; PH.night = sstep(0.42, 0.95, h); st.warm = Math.max(0, 1 - Math.abs(h - 0.47) / 0.24); elev = h <= 0.5 ? mix(st.elev0, 9 * DEG, sstep(0, 0.5, h)) : mix(9 * DEG, 34 * DEG, sstep(0.5, 1, h)); }
    else { PH.night = null; st.warm = 0; }
    const az = st.az0 + c.luzAz * DEG, L = st.len0, ce = Math.cos(elev);
    sd[0] = Math.cos(az) * ce * L; sd[1] = Math.sin(elev) * L; sd[2] = Math.sin(az) * ce * L;
  }
  PH.light = function (sun) { const w = st.warm; if (w > 0.001) { sun.color.r *= 1 + 0.24 * w; sun.color.g *= 1 - 0.08 * w; sun.color.b *= 1 - 0.46 * w; } }; /* entardecer dourado */

  /* ---------- câmera (fim do updateCamera) ---------- */
  PH.place = function (camera, sun, sky, home) {
    if (st.firstPlace) { st.firstPlace = false; st.camera = camera; st.near0 = camera.near; st.far0 = camera.far; }
    camera.position.copy(st.C); camera.up.set(0, 1, 0); camera.lookAt(st.T); if (Math.abs(st.roll) > 1e-4) camera.rotateZ(st.roll);
    let fov = st.fov, asp = R.w / Math.max(1, R.h);
    if (st.cap && st.cap.aspect && st.cap.phase === 'shoot') { const a2 = st.cap.aspect; if (a2 > asp) fov = 2 * Math.atan(Math.tan(fov * DEG / 2) * asp / a2) / DEG; asp = a2; } /* foto com outra proporção: o quadro cabe dentro do da tela (o guia mostra o recorte) */
    camera.fov = fov; camera.aspect = asp; camera.near = st.near; camera.far = 11000; camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    if (sky) sky.position.copy(camera.position);
    if (home) home.position.set(camera.position.x - 0.36 * 4200, camera.position.y * 0.15 + 4200 * 0.06, camera.position.z - 0.93 * 4200);
    if (sun) { const sd = R.sunDir; sun.position.set(st.T.x + sd[0], st.T.y + sd[1], st.T.z + sd[2]); sun.target.position.copy(st.T); sun.target.updateMatrixWorld();
      const sc = sun.shadow.camera, ext = clamp(st.dist * (1.4 + 1.6 * (1 - Math.abs(Math.sin(st.pitch)))), 320, 900); sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.near = 100; sc.far = 2200; sc.updateProjectionMatrix(); } /* sombra em volta do ponto da órbita; mais larga nas vistas baixas */
  };

  /* ---------- desfoque e filtro (no lugar do composer.render) ---------- */
  PH.render = function (composer, scene, camera, renderer, dt) {
    st.renderer = renderer; if (!st.camera) st.camera = camera;
    if (st.exp0 == null) st.exp0 = renderer.toneMappingExposure;
    renderer.toneMappingExposure = st.exp0 * Math.pow(2, st.cfg.ev); /* exposição: a do tone mapping (pós de cinema e render direto) */
    const pp = !!(R.pp && composer && composer.passes);
    if (pp) { if (composer !== st.comp) { detachPasses(false); st.fx = R.ppFx ? R.ppFx() : {}; attachPasses(composer, camera); } syncPasses(camera); } /* referências do pós lidas uma vez por composer (nada alocado por quadro) */
    else if (st.comp) detachPasses(false);
    occStart();
    if (composer) composer.render(dt); else renderer.render(scene, camera);
    occEnd();
    if (st.cap && st.cap.phase === 'shoot') grab(renderer);
  };
  /* 4.3j: câmera no vazio do Cinturão, abaixo da borda: a rocha das plataformas é da camada do espaço, colada na profundidade do céu, e não
     esconde nada da cena do jogo. Aqui some o que a rocha esconderia: cada instância (unidade, construção, nó, rocha, adereço) cujo topo a
     câmera não enxerga por cima da borda (marcha da reta câmera → topo pelo relevo) e os blocos de vegetação na mesma situação */
  function hiddenP(px, py, pz) { const C = st.C, dx = px - C.x, dy = py - C.y, dz = pz - C.z; for (let i = 1; i < 12; i++) { const t = i * 0.078, x = C.x + dx * t, z = C.z + dz * t, h = H(x, -z); if (h > -90 && C.y + dy * t < h - 1.5) return true; } return false; }
  function occInst(it) {
    if (!it.n || !it.main) return; const A = it.main.instanceMatrix.array, E = it.em ? it.em.instanceMatrix.array : null, gh = (it.geo && it.geo.height) || 12;
    for (let i = 0; i < it.n; i++) { const o = i * 16, sy = Math.hypot(A[o + 4], A[o + 5], A[o + 6]); if (!(sy > 0)) continue; if (hiddenP(A[o + 12], A[o + 13] + gh * sy, A[o + 14])) { A.fill(0, o, o + 16); if (E) E.fill(0, o, o + 16); } }
  }
  function occStart() {
    st.occ = !!R.cinturao && st.C.y < -25; if (!st.occ) return;
    if (R.inst) R.inst.forEach(occInst);
    const M = R.mist; if (M) for (let i = 0; i < M.length; i++) { const sp = M[i]; sp.userData.fo4 = sp.visible; if (sp.visible && hiddenP(sp.position.x, sp.position.y, sp.position.z)) sp.visible = false; } /* névoa da Fenda no abismo, atrás da rocha */
    const D = R.DR && R.DR.meshes; if (D) for (let i = 0; i < D.length; i++) { const b = D[i], bx = b.box; b.fo4 = b.far; if (bx && hiddenP((bx.min.x + bx.max.x) / 2, bx.max.y, (bx.min.z + bx.max.z) / 2)) b.far = -1; } /* o dress3d recorta de novo no onBeforeRender; distância negativa = bloco apagado neste desenho */
  }
  function occEnd() { if (!st.occ) return; st.occ = false; const M = R.mist; if (M) for (let i = 0; i < M.length; i++) { const sp = M[i]; if (sp.userData.fo4 != null) { sp.visible = sp.userData.fo4; sp.userData.fo4 = null; } } const D = R.DR && R.DR.meshes; if (D) for (let i = 0; i < D.length; i++) { const b = D[i]; if (b.fo4 != null) { b.far = b.fo4; b.fo4 = null; } } }
  function attachPasses(comp, camera) {
    st.comp = comp; const fx = st.fx || {}, PP = fx.PP || window.THREE_PP; if (!PP) return;
    try {
      let idx = -1; for (let i = 0; i < comp.passes.length; i++) { const p = comp.passes[i]; if (p.effects && fx.toneFx && p.effects.indexOf(fx.toneFx) >= 0) { idx = i; break; } }
      if (PP.DepthOfFieldEffect && idx >= 0) { st.dof = new PP.DepthOfFieldEffect(camera, { worldFocusDistance: 300, worldFocusRange: 150, bokehScale: 2, resolutionScale: 0.5 }); st.dofPass = new PP.EffectPass(camera, st.dof); comp.addPass(st.dofPass, idx); } /* HDR linear, depois da bruma e antes do bloom e do tone mapping */
      const U = new Map(), u = {}; const add = (k, v) => { const x = new THREE.Uniform(v); U.set(k, x); u[k] = x; };
      add('uWB', new THREE.Vector3(1, 1, 1)); add('uCon', 1); add('uSat', 1); add('uMono', 0); add('uMonoW', new THREE.Vector3(0.2126, 0.7152, 0.0722)); add('uSh', new THREE.Vector3(1, 1, 1)); add('uHi', new THREE.Vector3(1, 1, 1));
      add('uSplit', 0); add('uFade', 0); add('uCurve', 0); add('uVig', 0); add('uGrain', 0); add('uCA', 0); add('uBars', 0); add('uSeed', 0);
      st.fotoFx = new PP.Effect('ArdFoto', FOTO_FS, { blendFunction: PP.BlendFunction.SRC, attributes: PP.EffectAttribute.CONVOLUTION, uniforms: U }); st.fotoFx.U = u;
      st.fotoPass = new PP.EffectPass(camera, st.fotoFx); comp.addPass(st.fotoPass); st.lookDirty = true;
    } catch (err) { console.warn('[ARD] Modo Foto: desfoque e filtros indisponíveis: ' + err.message); detachPasses(true); st.comp = comp; }
    refreshNotes();
  }
  function detachPasses(alive) { /* alive: o composer ainda é o do jogo (tirar e liberar os passes); senão ele já foi descartado junto com os passes */
    const comp = st.comp;
    if (comp && alive) { try { if (st.dofPass) { comp.removePass(st.dofPass); st.dofPass.dispose(); } if (st.fotoPass) { comp.removePass(st.fotoPass); st.fotoPass.dispose(); } } catch (e) {} }
    if (st.bloomFx && alive) st.bloomFx.intensity = st.bloom0;
    st.comp = null; st.fx = null; st.dof = null; st.dofPass = null; st.fotoFx = null; st.fotoPass = null; st.bloomFx = null;
    if (st.ds && alive) { st.ds.rt.dispose(); st.ds.mat.dispose(); st.ds.geo.dispose(); st.ds = null; }
    refreshNotes();
  }
  function focusDistance(camera) { return Math.max(1, camera.position.distanceTo(st.focusMode === 'centro' ? st.T : st.focusP)); }
  function syncPasses(camera) {
    const c = st.cfg, fx = st.fx || {};
    if (st.dofPass) { st.dofPass.enabled = !!c.dof;
      if (c.dof) { const coc = st.dof.cocMaterial; coc.copyCameraSettings(camera); const fd = focusDistance(camera), f = fNum(c.abert); coc.focusDistance = fd; coc.focusRange = Math.max(2, fd * f / 14);
        st.dof.bokehScale = clamp(4.4 / Math.sqrt(f / 1.4), 0.8, 4.4) * (st.cap && st.cap.phase === 'shoot' ? st.cap.k : 1); } } /* na foto maior o desfoque cresce junto (mesmo tamanho relativo) */
    if (st.fotoFx && st.lookDirty) lookUniforms();
    if (fx.bloomFx) { if (st.bloomFx !== fx.bloomFx) { st.bloomFx = fx.bloomFx; st.bloom0 = fx.bloomFx.intensity; } fx.bloomFx.intensity = st.bloom0 * c.bloom; }
  }
  function lookUniforms() {
    st.lookDirty = false; const u = st.fotoFx.U, c = st.cfg, L = st.look, t = clamp(c.temp + 0.38 * st.warm, -1, 1); /* no entardecer o balanço de branco esquenta junto (a bruma e o céu também ficam dourados) */
    const r = 1 + 0.16 * t, g = 1 + 0.015 * t, b = 1 - 0.2 * t, lw = 0.2126 * r + 0.7152 * g + 0.0722 * b; u.uWB.value.set(r / lw, g / lw, b / lw);
    u.uCon.value = c.con; u.uSat.value = c.sat; u.uMono.value = L.mono || 0; if (L.monoW) u.uMonoW.value.set(L.monoW[0], L.monoW[1], L.monoW[2]); else u.uMonoW.value.set(0.2126, 0.7152, 0.0722);
    if (L.sh) u.uSh.value.set(L.sh[0], L.sh[1], L.sh[2]); else u.uSh.value.set(1, 1, 1); if (L.hi) u.uHi.value.set(L.hi[0], L.hi[1], L.hi[2]); else u.uHi.value.set(1, 1, 1);
    u.uSplit.value = L.split || 0; u.uFade.value = L.fade || 0; u.uCurve.value = L.curva || 0; u.uVig.value = c.vig; u.uGrain.value = c.grao; u.uCA.value = c.ab; u.uBars.value = c.faixas ? 2.39 : 0; u.uSeed.value = (performance.now() % 997) / 997;
  }

  /* ---------- foco por toque e escolha de unidade ---------- */
  function depthAt(u, v) { /* profundidade do pixel no último quadro (a do composer, estável depois do passe da cena) */
    const fx = R.ppFx ? R.ppFx() : {}, comp = fx.composer, rr = st.renderer; if (!R.pp || !comp || !rr) return -1; const tex = comp.stableDepthTexture; if (!tex) return -1;
    try {
      if (!st.ds) { const geo = new THREE.PlaneGeometry(2, 2), mat = new THREE.ShaderMaterial({ uniforms: { tDepth: { value: null }, uUv: { value: new THREE.Vector2() } }, vertexShader: DS_VS, fragmentShader: DS_FS, depthTest: false, depthWrite: false });
        const sc = new THREE.Scene(), m = new THREE.Mesh(geo, mat); m.frustumCulled = false; sc.add(m); st.ds = { geo, mat, scene: sc, cam: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), rt: new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false }), buf: new Uint8Array(4) }; }
      const D = st.ds; D.mat.uniforms.tDepth.value = tex; D.mat.uniforms.uUv.value.set(u, v);
      const prev = rr.getRenderTarget(); rr.setRenderTarget(D.rt); rr.render(D.scene, D.cam); rr.readRenderTargetPixels(D.rt, 0, 0, 1, 1, D.buf); rr.setRenderTarget(prev);
      const b = D.buf; return b[0] === 255 && b[1] === 255 && b[2] === 255 ? 1 : b[0] / 255 + b[1] / 65025 + b[2] / 16581375;
    } catch (err) { return -1; }
  }
  function pointAt(sx, sy, out) { /* ponto do mundo sob o pixel: pela profundidade do quadro; sem o pós, marchando o raio pelo relevo */
    const cam = st.camera; if (!cam) return false; const u = sx / Math.max(1, R.w), v = 1 - sy / Math.max(1, R.h);
    const d = depthAt(u, v);
    if (d >= 0) { if (d >= 0.99999) return false; out.set(u * 2 - 1, v * 2 - 1, d * 2 - 1).unproject(cam); return true; }
    _w.set(u * 2 - 1, v * 2 - 1, 0.5).unproject(cam).sub(cam.position).normalize(); const o = cam.position;
    let t = Math.max(1, cam.near), prev = t;
    for (let i = 0; i < 900 && t < 9000; i++) { const x = o.x + _w.x * t, y = o.y + _w.y * t, z = o.z + _w.z * t; if (y < topAt(x, z)) { let a = prev, b = t; for (let k = 0; k < 10; k++) { const m = (a + b) / 2; if (o.y + _w.y * m < topAt(o.x + _w.x * m, o.z + _w.z * m)) b = m; else a = m; } out.set(o.x + _w.x * b, o.y + _w.y * b, o.z + _w.z * b); return true; } prev = t; t += Math.max(1.5, t * 0.015); }
    return false;
  }
  function pickEnt(sx, sy) { /* unidade ou construção sob o toque (as que o jogador vê) */
    const cam = st.camera; if (!cam) return null; const sim = G.sim, vis = sim.vis[view.human], fy = R.h / 2 / Math.tan(cam.fov * DEG / 2);
    let best = null, bd = 1e12;
    for (let i = 0; i < sim.ents.length; i++) { const e = sim.ents[i]; if (!e.alive || (e.kind !== 'unit' && e.kind !== 'building')) continue; if (e.owner !== view.human && !view.reveal && !(vis && vis.has(e.id))) continue;
      _v.set(e.x, centerY(e), -e.y); const dz = _v.distanceTo(cam.position); _v.project(cam); if (_v.z < -1 || _v.z > 1) continue;
      const px = (_v.x + 1) / 2 * R.w, py = (1 - _v.y) / 2 * R.h, rad = Math.max(12, e.r * 1.15 * fy / Math.max(1, dz)), d = Math.hypot(px - sx, py - sy);
      if (d > rad) continue; const sc = dz + d * 2; if (sc < bd) { bd = sc; best = e; } }
    return best;
  }
  function entName(e) { const d = e.kind === 'unit' ? S.UNITS[e.def] : S.BUILDINGS[e.def]; return d && d.name ? d.name : e.def; }
  function centerOn(e) { st.follow = e.id; st.txG = e.x; st.tyG = e.y; st.hOffG = centerY(e) - groundRef(e.x, e.y); }
  function focusOn(e) { st.focusMode = 'ent'; st.focusEnt = e.id; st.focusName = entName(e); st.focusP.set(e.x, centerY(e), -e.y); st.uiDirty = true; }
  function tap(sx, sy, dbl) {
    const e = pickEnt(sx, sy); if (e) { centerOn(e); focusOn(e); ring(sx, sy); return; }
    if (!pointAt(sx, sy, _v)) { if (dbl) toast('Nada para focar aí (céu ou espaço)', true); return; }
    if (dbl) { st.follow = -1; st.txG = clamp(_v.x, -400, WORLD + 400); st.tyG = clamp(-_v.z, -400, WORLD + 400); st.hOffG = Math.max(isVoid(st.txG, st.tyG) ? -650 : 0, _v.y - groundRef(st.txG, st.tyG)); st.focusMode = 'centro'; st.focusEnt = -1; }
    else { st.focusMode = 'ponto'; st.focusEnt = -1; st.focusP.copy(_v); }
    st.uiDirty = true; ring(sx, sy);
  }

  /* ---------- mouse, toque e teclado ---------- */
  const MOVE = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyQ', 'KeyE', 'KeyR', 'KeyF', 'KeyZ', 'KeyC', 'Comma', 'Period', 'Minus', 'Equal', 'NumpadAdd', 'NumpadSubtract', 'ShiftLeft', 'ShiftRight']);
  const typing = t => !!t && (t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || (t.tagName === 'INPUT' && t.type !== 'range' && t.type !== 'checkbox'));
  function onKeyDown(e) {
    if (!PH.on) { if (e.code === 'KeyJ' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.repeat && !typing(e.target) && canEnter()) { e.preventDefault(); e.stopPropagation(); enter(); } return; }
    if (typing(e.target) && e.code !== 'Escape') return;
    e.stopPropagation(); /* com o Modo Foto ligado o jogo não recebe teclas (nada de ordens, grupos, pausa ou salvar) */
    const c = e.code;
    if ((e.ctrlKey || e.metaKey) && c === 'KeyS') { e.preventDefault(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const onRange = e.target && e.target.tagName === 'INPUT' && e.target.type === 'range';
    if (onRange && /^(Arrow|Home|End|Page)/.test(c)) return;
    if (c === 'Escape' || c === 'KeyJ') { e.preventDefault(); exit(); return; }
    if (c === 'Space') { e.preventDefault(); if (!e.repeat) shoot(); return; }
    if (c === 'KeyH') { e.preventDefault(); st.cfg.fold = !st.cfg.fold; syncUI(); saveCfg(); return; }
    if (c === 'KeyT') { e.preventDefault(); if (canPause()) setTime(st.time === 'congelado' ? 'normal' : 'congelado'); return; }
    if (c === 'KeyX') { e.preventDefault(); st.rollG = 0; st.uiDirty = true; return; }
    if (MOVE.has(c)) { e.preventDefault(); st.keys.add(c); }
  }
  function onKeyUp(e) { if (st.keys.size) st.keys.delete(e.code); }
  window.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('keyup', onKeyUp, true);
  window.addEventListener('blur', () => { st.keys.clear(); });

  function orbitBy(dx, dy) { st.yawG -= dx / Math.max(320, R.w) * 2.8; st.pitchG = clamp(st.pitchG + dy / Math.max(240, R.h) * 2.1, -0.45, 1.52); st.uiDirty = true; }
  function panBy(dx, dy) { const wpp = 2 * st.dist * Math.tan(st.fov * DEG / 2) / Math.max(1, R.h), kf = 1 / Math.max(0.35, Math.abs(Math.sin(st.pitch))), s = Math.sin(st.yaw), c = Math.cos(st.yaw);
    moveTarget((-c * dx - s * dy * kf) * wpp, (-s * dx + c * dy * kf) * wpp); st.follow = -1; }
  function onDown(e) {
    const L = st.el.layer; try { L.setPointerCapture(e.pointerId); } catch (err) {}
    st.ptr.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (st.ptr.size === 2) { const p = [...st.ptr.values()]; st.pinch = { d: Math.max(20, Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y)), dist: st.distG, mx: (p[0].x + p[1].x) / 2, my: (p[0].y + p[1].y) / 2 }; st.drag = null; return; }
    if (st.ptr.size > 2) return;
    st.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t0: e.timeStamp || performance.now(), pan: e.button === 1 || e.button === 2 || (e.button === 0 && e.shiftKey), btn: e.button, moved: false };
    L.classList.add('fo-drag'); L.focus({ preventScroll: true });
  }
  function onMove(e) {
    const p = st.ptr.get(e.pointerId); if (!p) return; p.x = e.clientX; p.y = e.clientY;
    if (st.pinch) { if (st.ptr.size < 2) return; const q = [...st.ptr.values()], d = Math.max(20, Math.hypot(q[0].x - q[1].x, q[0].y - q[1].y)), mx = (q[0].x + q[1].x) / 2, my = (q[0].y + q[1].y) / 2;
      st.distG = clamp(st.pinch.dist * st.pinch.d / d, 6, 3200); panBy(mx - st.pinch.mx, my - st.pinch.my); st.pinch.mx = mx; st.pinch.my = my; st.uiDirty = true; return; }
    const d = st.drag; if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y; d.x = e.clientX; d.y = e.clientY;
    if (!d.moved && Math.hypot(e.clientX - d.x0, e.clientY - d.y0) > 6) d.moved = true;
    if (d.moved) { if (d.pan) panBy(dx, dy); else orbitBy(dx, dy); }
  }
  function onUp(e) {
    st.ptr.delete(e.pointerId);
    if (st.pinch) { if (st.ptr.size < 2) st.pinch = null; st.drag = null; st.el.layer.classList.remove('fo-drag'); return; }
    const d = st.drag; st.el.layer.classList.remove('fo-drag'); if (!d || d.id !== e.pointerId) return; st.drag = null;
    const now = e.timeStamp || performance.now(); /* hora do evento (não a de quando foi tratado): toque e toque duplo valem mesmo com quadros lentos */
    if (e.type === 'pointercancel' || d.moved || d.btn !== 0 || now - d.t0 > 650) return;
    const r = canvas.getBoundingClientRect(), sx = e.clientX - r.left, sy = e.clientY - r.top;
    const dbl = now - st.lastTap < 360 && Math.hypot(sx - st.lastTapX, sy - st.lastTapY) < 30; st.lastTap = dbl ? 0 : now; st.lastTapX = sx; st.lastTapY = sy;
    tap(sx, sy, dbl);
  }
  function onWheel(e) {
    e.preventDefault(); const k = e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 400 : 1, dy = (e.deltaY || e.deltaX || 0) * k;
    if (e.shiftKey && !e.ctrlKey) st.fovG = clamp(st.fovG * Math.exp(dy * 0.0011), 15, 90); else st.distG = clamp(st.distG * Math.exp(dy * 0.0012), 6, 3200);
    st.uiDirty = true;
  }

  /* ---------- captura ---------- */
  function fileName() { const d = new Date(), p = n => String(n).padStart(2, '0'); return 'aether-rift-' + d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds()) + '.png'; }
  function capSize(res) {
    if (res === 'tela') { const rr = st.renderer; if (!rr) return null; const gl = rr.getContext(); return [gl.drawingBufferWidth, gl.drawingBufferHeight]; }
    const big = res === '4k', a = big ? 3840 : 2560, b = big ? 2160 : 1440, port = R.h > R.w * 1.05;
    return port ? [b, a] : [a, b];
  }
  function maxDim() { const gl = st.renderer.getContext(); const vp = gl.getParameter(gl.MAX_VIEWPORT_DIMS); return Math.min(gl.getParameter(gl.MAX_RENDERBUFFER_SIZE), gl.getParameter(gl.MAX_TEXTURE_SIZE), vp ? Math.min(vp[0], vp[1]) : 4096); }
  function shoot() {
    if (!PH.on || st.cap) return;
    if (!st.renderer) { toast('Aguarde um instante e tente de novo', true); return; }
    const res = st.cfg.res, sz = capSize(res); if (!sz) return;
    if (res !== 'tela' && Math.max(sz[0], sz[1]) > maxDim()) { toast('Este aparelho não desenha ' + sz[0] + '×' + sz[1] + '; use ' + (res === '4k' ? '2K ou ' : '') + 'Tela', true); return; }
    st.cap = { res, W: sz[0], H: sz[1], phase: 'pre', aspect: res === 'tela' ? 0 : sz[0] / sz[1], k: 1, pr: 1, lv: null, done: null };
    st.el.shot.classList.add('busy'); flash();
    return new Promise(res2 => { st.cap.done = res2; });
  }
  function capPre() { /* começo do quadro da foto: canvas e alvos do pós na resolução pedida (o tamanho na tela não muda) */
    const c = st.cap, rr = st.renderer; c.phase = 'shoot'; if (c.res === 'tela') return;
    const fx = R.ppFx ? R.ppFx() : {}, comp = fx.composer; c.pr = rr.getPixelRatio(); c.k = c.H / Math.max(1, rr.getContext().drawingBufferHeight);
    if (fx.bloomFx && fx.bloomFx.mipmapBlurPass && R.pp) { c.lv = fx.bloomFx.mipmapBlurPass.levels; const add = Math.round(Math.log2(Math.max(1, c.k))); if (add > 0) fx.bloomFx.mipmapBlurPass.levels = Math.min(10, c.lv + add); } /* o bloom espalha do mesmo tamanho relativo */
    rr.setPixelRatio(1);
    if (comp && R.pp) comp.setSize(c.W, c.H, false);
    else if (comp) { if (comp.setPixelRatio) comp.setPixelRatio(1); rr.setSize(c.W, c.H, false); comp.setSize(c.W, c.H); }
    else rr.setSize(c.W, c.H, false);
  }
  function capRestore() { /* quadro seguinte: tudo volta ao tamanho da tela (os alvos grandes são liberados no redimensionamento) */
    const c = st.cap; st.cap = null; if (st.el) st.el.shot.classList.remove('busy'); if (c.res === 'tela') return;
    const fx = R.ppFx ? R.ppFx() : {}, comp = fx.composer, rr = st.renderer;
    if (c.lv != null && fx.bloomFx && fx.bloomFx.mipmapBlurPass) fx.bloomFx.mipmapBlurPass.levels = c.lv;
    if (comp && R.pp) { comp.setSize(R.w, R.h, false); rr.setPixelRatio(c.pr); comp.setSize(R.w, R.h, false); }
    else if (comp) { rr.setSize(R.w, R.h, false); rr.setPixelRatio(c.pr); if (comp.setPixelRatio) comp.setPixelRatio(c.pr); comp.setSize(R.w, R.h); }
    else { rr.setSize(R.w, R.h, false); rr.setPixelRatio(c.pr); }
  }
  function capAbort() { const c = st.cap; if (!c) return; if (c.phase === 'shoot' || c.phase === 'restore') { c.phase = 'restore'; capRestore(); } else st.cap = null; if (c.done) c.done(null); }
  function grab(rr) { /* lê o canvas no mesmo quadro em que foi desenhado (sem preserveDrawingBuffer) */
    const c = st.cap; c.phase = 'restore'; const cv = rr.domElement, W = cv.width, Hh = cv.height, name = fileName();
    const done = blob => { if (!blob) { toast('Não deu para gerar a foto ' + W + '×' + Hh + '; tente uma resolução menor', true); if (c.done) c.done(null); return; }
      download(blob, name); st.lastShot = { name, w: W, h: Hh, bytes: blob.size }; toast('Foto salva · ' + W + '×' + Hh + ' · ' + name, false, 3200); if (c.done) c.done(st.lastShot); };
    try {
      if (st.cfg.faixas && !(R.pp && st.fotoPass)) { const c2 = document.createElement('canvas'); c2.width = W; c2.height = Hh; const x = c2.getContext('2d'); x.drawImage(cv, 0, 0); const bh = barH(W, Hh); if (bh > 0) { x.fillStyle = '#000'; x.fillRect(0, 0, W, bh); x.fillRect(0, Hh - bh, W, bh); } c2.toBlob(b => { done(b); c2.width = 0; c2.height = 0; }, 'image/png'); } /* sem o pós, as faixas entram aqui */
      else cv.toBlob(done, 'image/png');
    } catch (err) { toast('Falha na captura: ' + err.message, true); if (c.done) c.done(null); }
  }
  function download(blob, name) { const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = name; a.style.display = 'none'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 4000); }
  function barH(W, Hh) { const ar = W / Math.max(1, Hh); return ar < 2.39 ? Math.round(Hh * (1 - ar / 2.39) / 2) : 0; }

  /* ---------- painel ---------- */
  const SL = [ /* aba, chave, rótulo, mín, máx, passo, precisa do pós, formato */
    ['cam', 'fov', 'Lente', 15, 90, 1, false, v => Math.round(v) + '° · ' + Math.round(12 / Math.tan(v * DEG / 2)) + ' mm'],
    ['cam', 'roll', 'Horizonte', -25, 25, 0.5, false, v => num(v, 1) + '°'],
    ['foco', 'abert', 'Abertura', 0, 1, 0.01, true, v => 'f/' + num(fNum(v), fNum(v) < 10 ? 1 : 0)],
    ['filtro', 'ev', 'Exposição', -2, 2, 0.05, false, v => (v > 0.001 ? '+' : '') + num(v, 2) + ' EV'],
    ['filtro', 'con', 'Contraste', 0.5, 1.6, 0.01, true, v => Math.round(v * 100) + '%'],
    ['filtro', 'sat', 'Saturação', 0, 2, 0.01, true, v => Math.round(v * 100) + '%'],
    ['filtro', 'temp', 'Temperatura', -1, 1, 0.01, true, v => (v > 0.02 ? 'quente ' : v < -0.02 ? 'fria ' : 'neutra') + (Math.abs(v) > 0.02 ? Math.round(Math.abs(v) * 100) : '')],
    ['filtro', 'vig', 'Vinheta', 0, 1, 0.01, true, v => Math.round(v * 100) + '%'],
    ['filtro', 'grao', 'Grão', 0, 1, 0.01, true, v => Math.round(v * 100) + '%'],
    ['filtro', 'ab', 'Aberração', 0, 1, 0.01, true, v => Math.round(v * 100) + '%'],
    ['luz', 'hora', 'Hora', 0, 1, 0.01, false, v => v < 0.18 ? 'dia' : v < 0.36 ? 'tarde' : v < 0.58 ? 'entardecer' : v < 0.8 ? 'anoitecer' : 'noite'],
    ['luz', 'luzAz', 'Direção', -180, 180, 1, false, v => Math.round(v) + '°'],
    ['luz', 'bloom', 'Brilho', 0, 2.5, 0.01, true, v => Math.round(v * 100) + '%'],
  ];
  const slGet = k => k === 'fov' ? st.fovG : k === 'roll' ? st.rollG / DEG : st.cfg[k];
  function slSet(k, v) {
    if (k === 'fov') st.fovG = v; else if (k === 'roll') st.rollG = v * DEG;
    else { st.cfg[k] = v; if (k === 'hora') st.cfg.horaJogo = false; st.lookDirty = true; saveCfg(); }
  }
  function build() {
    st.cfg = loadCfg(); st.look = LOOKS.find(L => L.id === st.cfg.look) || LOOKS[0];
    if (!document.getElementById('foto-css')) { const s = document.createElement('style'); s.id = 'foto-css'; s.textContent = CSS; document.head.appendChild(s); }
    const sl = pane => SL.filter(d => d[0] === pane).map(d => `<label class="fo-sl" data-sl="${d[1]}"><span>${d[2]}</span><input type="range" min="${d[3]}" max="${d[4]}" step="${d[5]}" aria-label="${d[2]}"><output></output></label>`).join('');
    const helpCam = isTouch ? '<b>Um dedo</b> orbita · <b>dois dedos</b> arrastam o ponto e fazem pinça · <b>toque</b> numa unidade ou construção centraliza e foca · <b>toque duplo</b> leva a órbita ao ponto'
      : '<b>Arrastar</b> orbita · <b>botão direito</b> (ou Shift) arrasta o ponto · <b>roda</b> aproxima (<b>Shift</b> + roda: lente) · <b>WASD</b>/setas movem · <b>Q</b>/<b>E</b> descem e sobem · <b>R</b>/<b>F</b> inclinam · <b>Z</b>/<b>C</b> giram em volta · <b>,</b> <b>.</b> horizonte · <b>−</b>/<b>+</b> lente · <b>Espaço</b> foto · <b>T</b> tempo · <b>H</b> painel · <b>Esc</b> sai';
    const root = document.createElement('div'); root.className = 'fo-root'; root.hidden = true;
    root.innerHTML = '<div class="fo-layer" tabindex="-1" aria-label="Câmera do Modo Foto"></div><div class="fo-guide" hidden></div><div class="fo-bars" hidden><i></i><i></i></div><div class="fo-flash"></div><div class="fo-ring"></div><div class="fo-toast" role="status" aria-live="polite"></div>' +
      '<section class="fo-panel" aria-label="Modo Foto"><header class="fo-head"><button class="fo-ib fo-cam" data-a="sair" title="Sair do Modo Foto (J ou Esc)" aria-label="Sair do Modo Foto">📷</button><b>Modo Foto</b><span class="fo-sp"></span>' +
      '<button class="fo-ib" data-a="fold" title="Recolher ou abrir o painel (H)" aria-label="Recolher ou abrir o painel">▾</button><button class="fo-ib" data-a="sair" title="Sair (Esc)" aria-label="Sair do Modo Foto">✕</button></header>' +
      '<div class="fo-body"><div class="fo-seg fo-time" role="group" aria-label="Tempo"><button data-t="congelado" title="Congela a cena (T)">❄ Congelado</button><button data-t="lento" title="Câmera lenta, ¼ da velocidade">◔ Lento</button><button data-t="normal" title="A partida anda (T)">▶ Normal</button><button data-a="passo" title="Avança um instante e congela de novo" aria-label="Avançar um instante">⏭</button></div>' +
      '<p class="fo-note" hidden></p>' +
      '<nav class="fo-tabs" role="tablist"><button data-tab="cam" role="tab">Câmera</button><button data-tab="foco" role="tab">Foco</button><button data-tab="filtro" role="tab">Filtros</button><button data-tab="luz" role="tab">Luz</button></nav>' +
      '<div class="fo-pane" data-pane="cam">' + sl('cam') + '<div class="fo-btns"><button data-a="nivelar">Nivelar horizonte</button><button data-a="voltar">Câmera do jogo</button></div><p class="fo-help">' + helpCam + '</p></div>' +
      '<div class="fo-pane" data-pane="foco"><label class="fo-chk" data-ck="dof"><input type="checkbox" data-k="dof"> Profundidade de campo</label>' + sl('foco') + '<div class="fo-focus">Foco: <b data-v="foco">no centro da órbita</b></div><div class="fo-btns"><button data-a="centro">Focar no centro</button></div><p class="fo-help">' + (isTouch ? 'Toque' : 'Clique') + ' num ponto para focar ali; numa unidade ou construção, a órbita vai até ela e o foco a acompanha. Abertura maior (f menor) desfoca mais.</p></div>' +
      '<div class="fo-pane" data-pane="filtro"><div class="fo-looks">' + LOOKS.map(L => `<button class="fo-chip" data-look="${L.id}">${L.nome}</button>`).join('') + '</div>' + sl('filtro') + '<label class="fo-chk" data-ck="faixas"><input type="checkbox" data-k="faixas"> Faixas de cinema 2,39:1</label><div class="fo-btns"><button data-a="zerar">Voltar ao filtro</button></div></div>' +
      '<div class="fo-pane" data-pane="luz"><label class="fo-chk" data-ck="horaJogo"><input type="checkbox" data-k="horaJogo"> Hora da partida</label>' + sl('luz') + '<p class="fo-help">A hora e a direção da luz mudam só a imagem; a partida não muda.</p></div></div>' +
      '<footer class="fo-foot"><div class="fo-seg fo-res" role="radiogroup" aria-label="Resolução da foto"><button data-r="tela" title="Tamanho da tela">Tela</button><button data-r="2k" title="2560 × 1440">2K</button>' + (isTouch ? '' : '<button data-r="4k" title="3840 × 2160">4K</button>') + '</div>' +
      '<button class="fo-shot" data-a="foto" title="Tirar a foto (Espaço)" aria-label="Tirar a foto"><i></i></button></footer></section>';
    (canvas.parentElement || document.body).appendChild(root); st.root = root;
    const q = s => root.querySelector(s), qa = s => [...root.querySelectorAll(s)];
    st.el = { layer: q('.fo-layer'), guide: q('.fo-guide'), bars: q('.fo-bars'), flash: q('.fo-flash'), ring: q('.fo-ring'), toast: q('.fo-toast'), panel: q('.fo-panel'), note: q('.fo-note'), shot: q('.fo-shot'), foco: q('[data-v="foco"]'), sl: {}, ck: {} };
    for (const d of SL) { const lab = q(`[data-sl="${d[1]}"]`), inp = lab.querySelector('input'), out = lab.querySelector('output'); st.el.sl[d[1]] = { lab, inp, out, d };
      inp.addEventListener('input', () => { const v = +inp.value; slSet(d[1], v); out.textContent = d[7](v); if (d[1] === 'hora') syncChecks(); });
      inp.addEventListener('change', () => inp.blur()); }
    for (const k of ['dof', 'faixas', 'horaJogo']) { const lab = q(`[data-ck="${k}"]`), inp = lab.querySelector('input'); st.el.ck[k] = { lab, inp }; inp.addEventListener('change', () => { st.cfg[k] = inp.checked; st.lookDirty = true; saveCfg(); bars(); inp.blur(); }); }
    qa('[data-tab]').forEach(b => b.addEventListener('click', () => { st.cfg.tab = b.dataset.tab; syncUI(); saveCfg(); }));
    qa('[data-look]').forEach(b => b.addEventListener('click', () => { applyLook(b.dataset.look); syncUI(); saveCfg(); b.blur(); }));
    qa('[data-t]').forEach(b => b.addEventListener('click', () => { setTime(b.dataset.t); b.blur(); }));
    qa('[data-r]').forEach(b => b.addEventListener('click', () => { st.cfg.res = b.dataset.r; syncUI(); guide(); saveCfg(); b.blur(); }));
    qa('[data-a]').forEach(b => b.addEventListener('click', () => { const a = b.dataset.a; b.blur();
      if (a === 'sair') exit(); else if (a === 'fold') { st.cfg.fold = !st.cfg.fold; syncUI(); saveCfg(); } else if (a === 'foto') shoot(); else if (a === 'passo') step();
      else if (a === 'nivelar') { st.rollG = 0; st.uiDirty = true; } else if (a === 'voltar') { const E = st.entry; st.follow = -1; st.txG = E.tx; st.tyG = E.ty; st.hOffG = E.hOff; st.yawG = E.yaw; st.pitchG = E.pitch; st.distG = E.dist; st.fovG = E.fov; st.rollG = 0; st.uiDirty = true; }
      else if (a === 'centro') { st.focusMode = 'centro'; st.focusEnt = -1; st.uiDirty = true; } else if (a === 'zerar') { applyLook(st.cfg.look); syncUI(); saveCfg(); } }));
    const L = st.el.layer;
    L.addEventListener('pointerdown', onDown); L.addEventListener('pointermove', onMove); L.addEventListener('pointerup', onUp); L.addEventListener('pointercancel', onUp);
    L.addEventListener('wheel', onWheel, { passive: false }); L.addEventListener('contextmenu', e => e.preventDefault());
    st.el.panel.addEventListener('wheel', e => e.stopPropagation(), { passive: true });
    window.addEventListener('resize', () => { if (PH.on) { guide(); bars(); } });
  }
  function applyLook(id) { const L = LOOKS.find(x => x.id === id) || LOOKS[0]; st.look = L; st.cfg.look = L.id; for (const k in ADJ) st.cfg[k] = L[k] != null ? L[k] : ADJ[k]; st.lookDirty = true; }
  function syncTime() {
    if (!st.el) return; const cp = canPause();
    for (const b of st.root.querySelectorAll('[data-t]')) { b.disabled = !cp; b.classList.toggle('on', cp && b.dataset.t === st.time); }
    const sb = st.root.querySelector('[data-a="passo"]'); if (sb) sb.disabled = !cp || st.time !== 'congelado';
  }
  function syncChecks() { for (const k in st.el.ck) st.el.ck[k].inp.checked = !!st.cfg[k]; }
  function syncUI() {
    if (!st.el) return; const c = st.cfg, pp = !!(R.pp && st.fotoPass) || (!!R.pp && !st.comp);
    st.el.panel.classList.toggle('fold', !!c.fold); st.root.querySelector('[data-a="fold"]').textContent = c.fold ? '▴' : '▾';
    for (const b of st.root.querySelectorAll('[data-tab]')) { const on = b.dataset.tab === c.tab; b.classList.toggle('on', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); }
    for (const p of st.root.querySelectorAll('[data-pane]')) p.hidden = p.dataset.pane !== c.tab;
    for (const b of st.root.querySelectorAll('[data-look]')) { b.classList.toggle('on', b.dataset.look === c.look); b.disabled = !pp; }
    for (const b of st.root.querySelectorAll('[data-r]')) b.classList.toggle('on', b.dataset.r === c.res);
    for (const k in st.el.sl) { const s = st.el.sl[k], v = slGet(k); s.inp.value = v; s.out.textContent = s.d[7](+s.inp.value); const off = s.d[6] && !pp; s.inp.disabled = off; s.lab.classList.toggle('off', off); }
    syncChecks(); st.el.ck.dof.inp.disabled = !pp; st.el.ck.dof.lab.classList.toggle('off', !pp);
    syncTime(); syncLive(); bars();
  }
  function syncLive() { /* valores que mudam com o mouse e o teclado (no máximo ~7 vezes por segundo) */
    st.uiDirty = false; if (!st.el) return;
    for (let i = 0; i < LIVE.length; i++) { const k = LIVE[i], s = st.el.sl[k], v = slGet(k); if (Math.abs(+s.inp.value - v) > s.d[5] * 0.5) { s.inp.value = v; s.out.textContent = s.d[7](+s.inp.value); } }
    const t = st.focusMode === 'ent' ? 'em ' + st.focusName : st.focusMode === 'ponto' ? 'no ponto escolhido' : 'no centro da órbita'; if (st.el.foco.textContent !== t) st.el.foco.textContent = t;
  }
  function refreshNotes() {
    if (!st.el) return; const n = [];
    if (net) n.push('Multiplayer: a partida continua rodando; o Modo Foto só solta a câmera.'); else if (G.camp && G.camp.noPause) n.push('Dificuldade Fenda: sem pausa; o Modo Foto só solta a câmera.');
    if (!R.pp) n.push('Sem o pós de cinema nesta qualidade (' + (isTouch ? 'celular' : 'Baixa') + '): profundidade de campo, filtros e brilho ficam desligados. Câmera, luz, exposição, faixas e captura funcionam.');
    else if (st.comp && !st.fotoPass) n.push('O desfoque e os filtros não subiram nesta placa; câmera, luz e captura funcionam.');
    st.el.note.hidden = !n.length; st.el.note.textContent = n.join(' '); if (PH.on) syncUI();
  }
  function guide() { /* recorte da foto quando a proporção da resolução escolhida é outra que a da tela */
    if (!st.el) return; const g = st.el.guide, res = st.cfg.res;
    if (res === 'tela' || !R.w || !R.h) { g.hidden = true; return; }
    const sz = capSize(res); const a2 = sz[0] / sz[1], a = R.w / R.h;
    if (Math.abs(a2 - a) / a < 0.02) { g.hidden = true; return; }
    let w = R.w, h = R.h; if (a2 > a) h = R.w / a2; else w = R.h * a2; g.style.width = Math.round(w) + 'px'; g.style.height = Math.round(h) + 'px'; g.hidden = false;
  }
  function bars() { /* sem o pós, as faixas na tela são do painel (na foto, do 2D da captura) */
    if (!st.el) return; const b = st.el.bars, on = st.cfg.faixas && !(R.pp && st.fotoPass); b.hidden = !on; if (!on) return;
    const h = barH(R.w, R.h); b.children[0].style.height = h + 'px'; b.children[1].style.height = h + 'px';
  }
  function flash() { const f = st.el.flash; f.classList.remove('on'); void f.offsetWidth; f.classList.add('on'); setTimeout(() => f.classList.remove('on'), 60); }
  function ring(x, y) { const r = st.el.ring; r.style.left = x + 'px'; r.style.top = y + 'px'; r.classList.remove('on'); void r.offsetWidth; r.classList.add('on'); }
  function toast(t, warn, ms) { if (!st.el) return; const e = st.el.toast; e.textContent = t; e.classList.toggle('warn', !!warn); e.classList.add('on'); clearTimeout(st.toastT); st.toastT = setTimeout(() => e.classList.remove('on'), ms || 2400); }

  /* ---------- testes e ferramentas ---------- */
  PH.enter = enter; PH.exit = exit; PH.shoot = shoot; PH.snap = snap;
  PH.set = function (o) {
    o = o || {}; if (!PH.on) enter(); if (!PH.on) return null;
    if (o.x != null) st.txG = o.x; if (o.y != null) st.tyG = o.y; if (o.h != null) st.hOffG = o.h; if (o.yaw != null) st.yawG = o.yaw; if (o.pitch != null) st.pitchG = o.pitch; if (o.dist != null) st.distG = o.dist; if (o.roll != null) st.rollG = o.roll * DEG; if (o.fov != null) st.fovG = o.fov;
    if (o.x != null || o.y != null) st.follow = -1;
    if (o.follow != null) { const e = G.sim.byId.get(o.follow); if (e) { centerOn(e); focusOn(e); } }
    if (o.focus === 'centro') { st.focusMode = 'centro'; st.focusEnt = -1; } else if (Array.isArray(o.focus)) { st.focusMode = 'ponto'; st.focusEnt = -1; st.focusP.set(o.focus[0], o.focus[1], o.focus[2]); }
    if (o.look) applyLook(o.look);
    for (const k of ['ev', 'con', 'sat', 'temp', 'vig', 'grao', 'ab', 'abert', 'bloom', 'hora', 'luzAz']) if (o[k] != null) st.cfg[k] = o[k];
    for (const k of ['dof', 'faixas', 'horaJogo', 'fold']) if (o[k] != null) st.cfg[k] = !!o[k];
    if (o.hora != null && o.horaJogo == null) st.cfg.horaJogo = false;
    if (o.res) st.cfg.res = o.res; if (o.tab) st.cfg.tab = o.tab; if (o.time) setTime(o.time);
    if (o.snap) { if (st.follow >= 0) { const e = G.sim.byId.get(st.follow); if (e) centerOn(e); } snap(); }
    st.lookDirty = true; syncUI(); guide(); return PH.state();
  };
  PH.tap = (sx, sy, dbl) => tap(sx, sy, !!dbl);
  PH.pick = (sx, sy) => { const e = pickEnt(sx, sy); return e ? e.id : null; }; PH.point = (sx, sy) => (pointAt(sx, sy, _w2) ? [_w2.x, _w2.y, _w2.z] : null); /* testes */
  PH.state = () => ({ on: PH.on, time: st.time, x: st.tx, y: st.ty, h: st.hOff, yaw: st.yaw, pitch: st.pitch, dist: st.dist, roll: st.roll / DEG, fov: st.fov, near: st.near, target: [st.T.x, st.T.y, st.T.z], cam: [st.C.x, st.C.y, st.C.z], ground: H(st.C.x, -st.C.z), focus: st.focusMode, focusName: st.focusName, follow: st.follow,
    pp: !!R.pp, dof: !!(st.dofPass && st.dofPass.enabled), foto: !!st.fotoPass, night: PH.night, warm: st.warm, cfg: Object.assign({}, st.cfg), lastShot: st.lastShot, paused: G.paused, speed: G.speed, frozen: st.frozen, cap: st.cap ? st.cap.phase : null });
  return PH;
}
ARD.photo3d = { create, LOOKS };
})(globalThis.ARD = globalThis.ARD || {});
