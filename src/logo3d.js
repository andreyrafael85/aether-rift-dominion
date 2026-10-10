/* Aether Rift: Dominion — logo vivo (4.0d): a Final 2 "Escudo-Órbita" aprovada, renderizada em tempo real com os cinco
   mundos girando na órbita, o núcleo pulsando e a rachadura da Fenda cintilando. Mesma cena da galeria (tools/arte3d.html).
   Só no desktop e sem prefers-reduced-motion; no celular, em falha ou com ?logo=estatico fica a imagem (assets/logo.jpg). */
(function (ARD) {
'use strict';
const RACES = ['vehnar', 'erevane', 'tessara', 'quorith', 'vorag'];
let st = null;
function mount(img) {
  const THREE = window.THREE, ADD = window.THREE_ADDONS || {}, W3 = ARD.world3d;
  if (!THREE || !W3 || !img || st) return false;
  if (new URLSearchParams(location.search).get('logo') === 'estatico' || matchMedia('(prefers-reduced-motion: reduce)').matches || matchMedia('(pointer: coarse)').matches) return false;
  let renderer = null;
  try {
    const cv = document.createElement('canvas'); cv.className = img.className; cv.id = 'logo-live'; cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', 'Logo Aether Rift Dominion');
    const css = img.getBoundingClientRect().width || 168; const px = Math.round(Math.max(160, css) * Math.min(2, window.devicePixelRatio || 1));
    renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, powerPreference: 'low-power' }); renderer.setPixelRatio(1); renderer.setSize(px, px, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
    const scene = new THREE.Scene(); scene.background = new THREE.Color(0x06070c);
    if (ADD.RoomEnvironment) { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new ADD.RoomEnvironment(), 0.04).texture; pm.dispose(); }
    { const n = 700, pos = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u); pos[i * 3] = 60 * s * Math.cos(th); pos[i * 3 + 1] = 60 * s * Math.sin(th); pos[i * 3 + 2] = 60 * u; } const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xdfe6ff, size: 1.1, sizeAttenuation: false, transparent: true, opacity: 0.85, depthWrite: false }))); }
    const g = new THREE.Group(); scene.add(g);
    const steel = new THREE.MeshStandardMaterial({ color: 0xb4bcc9, metalness: 0.95, roughness: 0.3, envMapIntensity: 0.6 }), gun = new THREE.MeshStandardMaterial({ color: 0x242934, metalness: 0.85, roughness: 0.42, envMapIntensity: 0.5 });
    const glowMat = (c, k) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: k, roughness: 0.3 });
    // escudo (mesma forma da galeria): contorno escuro, aro de aço e placa
    const r = 2.2, sh = new THREE.Shape(); sh.moveTo(0, -r * 1.15); sh.quadraticCurveTo(r * 0.95, -r * 0.65, r, r * 0.3); sh.lineTo(r, r * 0.85); sh.lineTo(-r, r * 0.85); sh.lineTo(-r, r * 0.3); sh.quadraticCurveTo(-r * 0.95, -r * 0.65, 0, -r * 1.15); sh.closePath();
    const ex = (d, bs, bt) => new THREE.ExtrudeGeometry(sh, { depth: d, bevelEnabled: true, bevelSize: bs, bevelThickness: bt, bevelSegments: 3, curveSegments: 40 });
    const outline = new THREE.Mesh(ex(0.12, 0.06, 0.06), new THREE.MeshStandardMaterial({ color: 0x07080c, roughness: 0.6, metalness: 0.4 })); outline.scale.set(1.12, 1.12, 1); outline.position.z = -0.55; g.add(outline);
    const rim = new THREE.Mesh(ex(0.1, 0.05, 0.05), steel); rim.scale.set(1.06, 1.06, 1); rim.position.z = -0.45; g.add(rim);
    const plate = new THREE.Mesh(ex(0.2, 0.06, 0.08), gun); plate.position.z = -0.32; g.add(plate);
    { const tg = []; for (let k = 0; k < 60; k++) { const a = k / 60 * Math.PI * 2; const t = new THREE.BoxGeometry(0.03, k % 5 === 0 ? 0.16 : 0.08, 0.05); t.rotateZ(a + Math.PI / 2); t.translate(Math.cos(a) * 1.62, Math.sin(a) * 1.62 - 0.1, 0.02); tg.push(t); } for (const t of tg) g.add(new THREE.Mesh(t, steel)); }
    const seal = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.045, 12, 128), steel); seal.position.set(0, -0.1, 0.08); g.add(seal);
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 0), glowMat(0xff7a4a, 2.4)); core.scale.set(0.8, 1.15, 0.8); core.position.set(0, -0.1, 0.55); g.add(core);
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.035, 10, 64), glowMat(0xb23cff, 1.4)); halo.position.set(0, -0.1, 0.5); g.add(halo);
    const orb = new THREE.Group(); orb.position.set(0, -0.02, 0.25); orb.rotation.x = 0.42; orb.rotation.z = -0.1; g.add(orb);
    orb.add(new THREE.Mesh(new THREE.TorusGeometry(1.18, 0.028, 10, 160), steel)); const spin = new THREE.Group(); orb.add(spin); const planets = [];
    RACES.forEach((rid, i) => { const a = Math.PI / 2 + i * Math.PI * 2 / 5; const P = W3.PLANETS[rid]; const pl = new THREE.Mesh(new THREE.SphereGeometry(0.3, 32, 22), new THREE.MeshStandardMaterial({ map: W3.planetTexture(THREE, rid, 7 + i, 128), roughness: 0.9 })); pl.position.set(Math.cos(a) * 1.18, Math.sin(a) * 1.18, 0.12); spin.add(pl); planets.push(pl);
      const at = new THREE.Mesh(new THREE.SphereGeometry(0.315, 32, 22), new THREE.ShaderMaterial({ uniforms: { col: { value: new THREE.Color(P.atmo) } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position,1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }', fragmentShader: 'uniform vec3 col; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 3.0); gl_FragColor = vec4(col * f * 1.3, f * 1.3); }' })); at.position.copy(pl.position); spin.add(at); });
    const crackPts = [[-2.4, -1.85, 0.9], [-1.6, -1.5, 0.95], [-0.9, -1.8, 1.0], [0.1, -1.4, 1.05], [0.9, -1.72, 1.0], [1.7, -1.35, 0.95], [2.4, -1.65, 0.9]].map(p => new THREE.Vector3(...p)); const curve = new THREE.CatmullRomCurve3(crackPts, false, 'catmullrom', 0.05);
    const crack = new THREE.Mesh(new THREE.TubeGeometry(curve, 120, 0.06, 8, false), glowMat(0xff7a4a, 3.5)); scene.add(crack); const hz = new THREE.Mesh(new THREE.TubeGeometry(curve, 120, 0.2, 8, false), new THREE.MeshBasicMaterial({ color: 0xb23cff, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false })); scene.add(hz);
    for (const sx of [-1, 1]) { const wing = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.1), steel); wing.position.set(sx * 2.0, 1.55, -0.1); wing.rotation.z = sx * -0.25; g.add(wing); }
    g.rotation.x = -0.12; g.rotation.y = 0.06;
    const key = new THREE.DirectionalLight(0xfff4e6, 1.8); key.position.set(-3, 4, 6); scene.add(key); const rl = new THREE.DirectionalLight(0xb23cff, 1.0); rl.position.set(3, 1, -4); scene.add(rl); const warm = new THREE.DirectionalLight(0xff6a3d, 0.7); warm.position.set(3, -2, 3); scene.add(warm); scene.add(new THREE.AmbientLight(0x404860, 0.4));
    const glow = new THREE.Mesh(new THREE.CircleGeometry(3.3, 48), new THREE.MeshBasicMaterial({ color: 0xb23cff, transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending, depthWrite: false })); glow.position.z = -2.5; scene.add(glow);
    const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 200); cam.position.set(0, 0.1, 9.8); cam.lookAt(0, -0.05, 0);
    let composer = null; if (ADD.EffectComposer && ADD.UnrealBloomPass) { composer = new ADD.EffectComposer(renderer, new THREE.WebGLRenderTarget(px, px, { type: THREE.HalfFloatType, samples: 4 })); composer.addPass(new ADD.RenderPass(scene, cam)); composer.addPass(new ADD.UnrealBloomPass(new THREE.Vector2(px, px), 0.4, 0.5, 0.9)); composer.addPass(new ADD.OutputPass()); }
    img.parentNode.insertBefore(cv, img); img.hidden = true;
    let visible = true; const io = 'IntersectionObserver' in window ? new IntersectionObserver(es => { visible = es[0].isIntersecting; }) : null; if (io) io.observe(cv);
    let last = 0; const t0 = performance.now();
    const frame = now => { if (!st) return; st.raf = requestAnimationFrame(frame); if (!visible || document.hidden || (st.screen && st.screen.hidden) || now - last < 33) return; last = now; const t = (now - t0) / 1000;
      spin.rotation.z = t * 0.105; for (let i = 0; i < planets.length; i++) planets[i].rotation.y = t * (0.3 + i * 0.07);
      core.material.emissiveIntensity = 2.4 + Math.sin(t * 2.1) * 0.55; halo.material.emissiveIntensity = 1.4 + Math.sin(t * 1.3 + 1) * 0.35; crack.material.emissiveIntensity = 3.3 + Math.sin(t * 7.3) * 0.25 + Math.sin(t * 17.1) * 0.2; hz.material.opacity = 0.2 + Math.sin(t * 3.1) * 0.05;
      g.rotation.y = 0.06 + Math.sin(t * 0.4) * 0.05; if (composer) composer.render(); else renderer.render(scene, cam); };
    st = { renderer, cv, img, io, raf: requestAnimationFrame(frame), screen: document.getElementById('start') };
    return true;
  } catch (err) { console.warn('[ARD] logo vivo indisponível: ' + err.message); if (renderer) try { renderer.dispose(); } catch (e) {} img.hidden = false; return false; }
}
function stop() { if (!st) return; cancelAnimationFrame(st.raf); if (st.io) st.io.disconnect(); try { st.renderer.dispose(); st.renderer.forceContextLoss(); } catch (e) {} if (st.cv.parentNode) st.cv.parentNode.removeChild(st.cv); st.img.hidden = false; st = null; }
ARD.logo3d = { mount, stop, active: () => !!st };
})(globalThis.ARD = globalThis.ARD || {});
