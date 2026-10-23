/* Aether Rift: Dominion — Sala de Comando (5.0b): o líder em holograma sobre o Núcleo. O busto é o mesmo do src/leaders3d.js (buildHead,
   rig, humores e reações), montado aqui com materiais de nós do Motor 5: pele com translucidez aproximada (MeshSSSNodeMaterial: a luz de
   contorno atravessa as bordas), olhos com brilho úmido (verniz e reflexo afiado da luz principal na córnea) e a camada de holograma em TSL
   (contorno na cor da Raça, linhas de varredura, faixa que sobe, cintilação, tremida rara e a dissolução que materializa o busto a partir do
   projetor). Luz de estúdio própria (lightsNode), sem pesar no resto da cena. A boca acompanha a voz do sistema (evento 'ard-voz' do
   src/audio.js, palavra por palavra pelo boundary do speechSynthesis; sem boundary, as palavras saem por estimativa do texto). */
(function (ARD) {
'use strict';
const COR = { vehnar: 0xff7733, erevane: 0x33ffd0, tessara: 0x55e68a, quorith: 0xb388ff, vorag: 0xe6455a };
const SSS = { vehnar: 0xff4a2a, erevane: 0x30d8ff, tessara: 0x9aff5a, quorith: 0xc49aff, vorag: 0xff3040 }; /* cor que a luz ganha ao atravessar a pele */
const SSSK = { tessara: 0.42, erevane: 0.5, quorith: 0.75 }; /* peles claras (verde, ciano, lilás) passam do limiar do bloom: translucidez mais contida */
const PELE = /^(pele|pele-escura|labio|membrana|goela|cristal-opaco|seiva)$/;
function criar(C) { const { W, T } = C.L; const { float, vec3, color, uniform, mix, smoothstep, abs, max, pow, dot, normalize, reflect, sin, fract, floor, hash, time, step,
    positionWorld, positionLocal, normalWorld, cameraPosition, materialEmissive, materialOpacity, mx_noise_float, lights } = T;
  const H = { group: new W.Group(), it: null, race: null, prep: {}, disp: [] }; H.group.name = 'holograma';
  const U = H.U = { cor: uniform(new W.Color(COR.vehnar)), y0: uniform(0), h: uniform(30), revela: uniform(0), k: uniform(1), key: uniform(new W.Vector3(-0.6, 0.6, 0.5).normalize()) };
  /* luz de estúdio do busto (as posições do leaders3d, no espaço do busto); o alvo fica no centro do busto */
  const rig = new W.Group(); H.group.add(rig); const alvo = new W.Object3D(); rig.add(alvo);
  const L = { key: new W.DirectionalLight(0xfff0dc, 3.0), fill: new W.DirectionalLight(0xffffff, 0.35), rimA: new W.DirectionalLight(0xd6e6ff, 2.6), rimB: new W.DirectionalLight(0xff7733, 3.4), cons: new W.DirectionalLight(0xff7733, 0.6), hemi: new W.HemisphereLight(0x9fb0cc, 0x1a1512, 0.45) };
  L.key.position.set(-3.3, 3.4, 2.5); L.fill.position.set(3.4, 0.2, 2.0); L.rimA.position.set(-3.0, 2.6, -3.0); L.rimB.position.set(3.4, 1.2, -2.6); L.cons.position.set(0.3, -3.2, 2.4);
  for (const k in L) { rig.add(L[k]); if (L[k].target) L[k].target = alvo; }
  const luz = lights([L.key, L.fill, L.rimA, L.rimB, L.cons, L.hemi]);
  /* camada de holograma: máscara de dissolução (de baixo para cima, borda serrilhada por ruído) e brilho */
  const yr = positionWorld.y.sub(U.y0).div(U.h), nz = mx_noise_float(positionWorld.mul(0.9)).mul(0.05), lim = U.revela.mul(1.3).sub(0.15);
  const vis = smoothstep(lim.add(0.012), lim.sub(0.012), yr.add(nz)).mul(smoothstep(0.035, 0.07, yr.add(nz)));
  const borda = float(1).sub(smoothstep(0.0, 0.03, abs(yr.add(nz).sub(lim)))).mul(step(0.02, U.revela)).add(float(1).sub(smoothstep(0.0, 0.025, abs(yr.add(nz).sub(0.055)))).mul(0.6));
  const V = normalize(cameraPosition.sub(positionWorld)), rim = pow(float(1).sub(max(dot(normalize(normalWorld), V), 0)), 3.0);
  const scan = smoothstep(0.82, 1.0, sin(positionWorld.y.mul(2.6).sub(time.mul(5.0))).mul(0.5).add(0.5)), faixa = float(1).sub(smoothstep(0.0, 0.05, abs(yr.sub(fract(time.mul(0.16)).mul(1.4).sub(0.2)))));
  const cint = float(0.93).add(hash(floor(time.mul(24.0))).mul(0.07));
  const brilho = U.cor.mul(rim.mul(1.0).add(scan.mul(0.1)).add(faixa.mul(0.32)).add(0.03)).mul(U.k).mul(cint).add(U.cor.mul(borda).mul(3.0));
  const tremida = step(0.985, hash(floor(time.mul(13.0)))).mul(sin(positionWorld.y.mul(1.7).add(time.mul(90.0)))).mul(0.06);
  /* brilho úmido do olho: reflexo afiado da luz principal (o olho é pequeno: um ponto vivo lê melhor que um reflexo largo) */
  const R = reflect(U.key.negate(), normalize(normalWorld)), glint = pow(max(dot(R, V), 0), 420.0).mul(9.0).add(pow(max(dot(R, V), 0), 40.0).mul(0.25));
  H.make = (type, o, name) => { o = Object.assign({}, o); let m;
    if (type === 'PointsMaterial') { m = new W.PointsNodeMaterial(o); m.visible = false; return m; } /* no WebGPU o ponto tem 1 pixel: faíscas e auras do retrato ficam de fora (aqui há bloom) */
    if (PELE.test(name) && type === 'MeshPhysicalMaterial' && !o.transparent) { m = new W.MeshSSSNodeMaterial(o); m.thicknessColorNode = color(SSS[H.building] || SSS.vehnar).mul((SSSK[H.building] || 1) * (name === 'labio' ? 1.2 : 1.0));
      m.thicknessDistortionNode = float(0.14); m.thicknessAmbientNode = float(0.0); m.thicknessAttenuationNode = float(0.8); m.thicknessPowerNode = float(3.0); m.thicknessScaleNode = float(name === 'pele-escura' ? 1.6 : 2.6); }
    else if (name === 'olho') { m = new W.MeshPhysicalNodeMaterial(Object.assign(o, { clearcoat: 1, clearcoatRoughness: 0.03, roughness: Math.min(o.roughness == null ? 0.3 : o.roughness, 0.16) })); }
    else if (name === 'cornea') { m = new W.MeshPhysicalNodeMaterial(Object.assign(o, { roughness: 0.02, clearcoat: 1, clearcoatRoughness: 0.01, envMapIntensity: 2.6 })); m.emissiveNode = vec3(1.0, 0.98, 0.94).mul(glint); }
    else if (name === 'lente') { m = new W.MeshPhysicalNodeMaterial(o); m.emissiveNode = materialEmissive.add(vec3(1.0, 0.97, 0.9).mul(glint)); }
    else { const cls = { MeshPhysicalMaterial: 'MeshPhysicalNodeMaterial', MeshStandardMaterial: 'MeshStandardNodeMaterial', MeshBasicMaterial: 'MeshBasicNodeMaterial' }[type] || 'MeshStandardNodeMaterial'; m = new W[cls](o); }
    m.fog = false; const lit = !m.isMeshBasicNodeMaterial && !m.isMeshBasicMaterial;
    if (lit) { m.lightsNode = luz; if (!m.emissiveNode) m.emissiveNode = materialEmissive.mul(cint).add(brilho); else m.emissiveNode = m.emissiveNode.add(brilho); }
    m.positionNode = positionLocal.add(vec3(tremida, 0, 0));
    if (m.transparent) m.opacityNode = materialOpacity.mul(vis); else { m.opacityNode = vis; m.alphaTest = 0.5; }
    return m; };
  /* projetor no topo do Núcleo: anel emissor e o feixe que sobe até o busto */
  { const m = new W.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: W.AdditiveBlending, side: W.DoubleSide }); m.fog = false; const p = positionLocal, ang = T.atan(p.z, p.x);
    const raios = mx_noise_float(vec3(ang.mul(5.0), p.y.mul(0.2).sub(time.mul(0.9)), 0)).mul(0.5).add(0.5), sobe = p.y.div(14).add(0.5);
    m.colorNode = U.cor.mul(raios.mul(0.6).add(0.4)).mul(float(1).sub(smoothstep(0.1, 1.0, sobe))).mul(U.revela.mul(0.7).add(0.3)).mul(1.4); m.opacityNode = float(0.55).mul(smoothstep(0.0, 0.08, sobe));
    const g = new W.CylinderGeometry(15, 4.5, 14, 48, 1, true); H.feixe = new W.Mesh(g, m); H.feixe.renderOrder = 7; H.disp.push(g, m); H.group.add(H.feixe); }
  { const m = new W.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: W.AdditiveBlending, side: W.DoubleSide }); m.fog = false; const r = T.length(positionLocal.xy);
    const an = fract(T.atan(positionLocal.y, positionLocal.x).div(Math.PI * 2).add(time.mul(0.08))).mul(24.0); const tique = smoothstep(0.85, 1.0, fract(an));
    m.colorNode = U.cor.mul(smoothstep(4.5, 5.2, r).mul(smoothstep(6.6, 5.8, r)).mul(1.6).add(tique.mul(smoothstep(6.8, 7.0, r)).mul(smoothstep(7.6, 7.4, r)).mul(2.2)));
    const g = new W.RingGeometry(4.2, 7.8, 96, 1); H.anel = new W.Mesh(g, m); H.anel.rotation.x = -Math.PI / 2; H.anel.renderOrder = 7; H.disp.push(g, m); H.group.add(H.anel); }
  H.L = L; H.rig = rig; H.alvo = alvo;
  /* monta o busto de uma Raça num grupo escondido (para trocar sem travar: compila antes de mostrar) */
  H.preparar = race => { if (H.prep[race]) return H.prep[race]; const g = new W.Group(); g.visible = false; H.group.add(g); H.building = race;
    const it = ARD.leaders3d.attach(g, race, { hi: !C.leve, make: H.make, mood: 1, yaw: 0 }); H.building = null;
    g.updateMatrixWorld(true); const box = new W.Box3().setFromObject(g); const sz = box.getSize(new W.Vector3()), ct = box.getCenter(new W.Vector3());
    const p = { race, g, it, h: sz.y, base: box.min.y, cx: ct.x, cz: ct.z }; H.prep[race] = p; return p; };
  /* coloca o busto: escala s, base no topo do Núcleo (y), virado para a câmera (giro) */
  H.mostrar = (race, yTopo, s, giro) => { const p = H.preparar(race); for (const k in H.prep) H.prep[k].g.visible = k === race; H.it = p.it; H.race = race; const y = yTopo + 6;
    p.g.scale.setScalar(s); p.g.position.set(-p.cx * s, y - p.base * s, -p.cz * s); H.rig.position.set(0, y + p.h * s * 0.55, 0); H.rig.scale.setScalar(s); H.group.rotation.y = giro;
    U.y0.value = y; U.h.value = p.h * s; U.cor.value.setHex(COR[race] || COR.vehnar); U.k.value = { tessara: 0.6, erevane: 0.7, quorith: 0.85 }[race] || 1; L.rimB.color.setHex(COR[race]); L.cons.color.setHex(COR[race]);
    H.feixe.position.set(0, yTopo + 6.5, 0); H.anel.position.set(0, yTopo + 0.4, 0); H.topo = y + p.h * s; H.centro = y + p.h * s * 0.55; H.base = y;
    U.key.value.copy(L.key.position).normalize().applyQuaternion(H.group.quaternion); return p; };
  H.descartar = race => { const p = H.prep[race]; if (!p || p.race === H.race) return; ARD.leaders3d.detach(p.it); H.group.remove(p.g); delete H.prep[race]; };
  H.step = (now, dt) => { if (H.it) ARD.leaders3d.step(H.it, now, dt); };
  /* voz: a boca abre por palavra; sem boundary (vozes de rede), as palavras saem por estimativa */
  let falso = null, ultimo = 0; const onVoz = e => { const d = e.detail || {}; const it = H.it; if (!it) return;
    if (d.tipo === 'inicio') { ultimo = 0; clearTimeout(falso); const txt = String(d.texto || ''); falso = setTimeout(() => { if (ultimo) return; let t = 0; for (const w of txt.split(/\s+/)) { if (!w) continue; const tt = t; setTimeout(() => { if (H.it === it && !ultimo) ARD.leaders3d.word(it, w.length, w); }, tt); t += (w.length * 0.065 + 0.12) * 1000 / 1.05; } }, 380); }
    else if (d.tipo === 'palavra') { ultimo = performance.now(); const w = String(d.texto || '').substr(d.i || 0, d.n || 0) || 'aaa'; ARD.leaders3d.word(it, d.n || w.length, w); }
    else if (d.tipo === 'fim') { clearTimeout(falso); } };
  addEventListener('ard-voz', onVoz); H.onVoz = onVoz;
  H.dispose = () => { removeEventListener('ard-voz', onVoz); clearTimeout(falso); for (const k in H.prep) { try { ARD.leaders3d.detach(H.prep[k].it); } catch (e) {} } H.prep = {}; H.it = null; for (const d of H.disp) if (d && d.dispose) d.dispose(); };
  return H; }
ARD.salaHolo = { criar, COR };
})(globalThis.ARD = globalThis.ARD || {});
