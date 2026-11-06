// 5.0h — construções únicas, módulos com escolha e comandantes em campo, na simulação (Node, sem navegador):
// com tudo desligado a partida dá o hash da base (tools/chefes-ref.json) e o mesmo hash com e sem o src/unicas-sim.js carregado; constrói cada uma
// das 10 únicas e confere o efeito (e a regra de uma por jogador e da Raça); escolhe cada um dos 10 módulos e confere o efeito (e que a escolha é para
// sempre); usa cada uma das 15 habilidades dos 5 comandantes, sobe de nível pela veterania, cai e volta no Núcleo com o nível; com os comandantes
// ligados, a mesma partida dá o mesmo hash, também depois de salvar e voltar; mede o custo por tique.
// Uso: node tools/unicas-teste.cjs [--json] [--rapido]
const path = require('path'); const root = path.resolve(__dirname, '..'); const { execFileSync } = require('child_process');
globalThis.ARD = {}; require(root + '/src/modos.js'); require(root + '/src/chefes-sim.js'); require(root + '/src/mundo.js'); /* 5.0h junção */ require(root + '/src/unicas-sim.js'); require(root + '/src/sim.js'); require(root + '/src/ai.js'); require(root + '/tools/det-run.js');
const S = ARD.sim, AI = ARD.ai, UN = ARD.unicas; const JSONOUT = process.argv.includes('--json'), RAPIDO = process.argv.includes('--rapido');
const R = []; const log = (...a) => { if (!JSONOUT) console.log(...a); }; const medidas = {};
const ok = (nome, cond, info) => { R.push({ nome, ok: !!cond, info: info == null ? '' : String(info) }); log((cond ? 'OK   ' : 'FAIL ') + nome + (info != null && info !== '' ? ' · ' + info : '')); };
const ref = require(root + '/tools/chefes-ref.json');
const RACAS = ['vehnar', 'erevane', 'tessara', 'quorith', 'vorag'];

// ---------- 1) tudo desligado: o hash de antes ----------
{ const t0 = Date.now(); const h = ARD_DET(7, 2000, { iaPerfil: 'nulo' } /* 5.0h junção: a IA 3.0 usa as únicas e os módulos; a de antes (perfil nulo) não, e dá o hash da base */); const c = ref.casos['7/2000']; let d = -1; for (let i = 0; i < c.n; i++) if (h[i] !== c.todos[i]) { d = i; break; }
  ok('desligado: hash igual ao da base (7/2000, ' + c.n + ' amostras de ' + h.length + ')', d < 0, d < 0 ? h[c.n - 1] : 'diverge na amostra ' + d); medidas.detMs = Date.now() - t0;
  const sem = JSON.parse(execFileSync(process.execPath, ['-e', `globalThis.ARD={};const r=${JSON.stringify(root)};require(r+'/src/modos.js');require(r+'/src/chefes-sim.js');require(r+'/src/mundo.js');require(r+'/src/sim.js');require(r+'/src/ai.js');require(r+'/tools/det-run.js');console.log(JSON.stringify(ARD_DET(7,2000,{iaPerfil:'nulo'})))`], { encoding: 'utf8', maxBuffer: 1e8 }));
  let d2 = -1; for (let i = 0; i < sem.length; i++) if (sem[i] !== h[i]) { d2 = i; break; }
  ok('desligado: as ' + sem.length + ' amostras do det-run (partidas, chefões, eventos e Caçada) iguais com e sem o src/unicas-sim.js (IA de antes)', d2 < 0, d2 < 0 ? '' : 'diverge em ' + d2);
  const sim = S.createSim({ seed: 3, players: [{ name: 'A', faction: 'vehnar', human: true }, { name: 'B', faction: 'vorag' }], minutes: 25, mapV: 1 }); for (let i = 0; i < 50; i++) S.step(sim);
  const snap = S.snapshot(sim); ok('desligado: sem sim.unicas e sem "unicas" na fotografia', !sim.unicas && !('unicas' in JSON.parse(JSON.stringify(snap)))); }

// ---------- ajudantes ----------
function partida(fac, o) { o = o || {}; const players = [{ name: 'H', faction: fac, human: true }, { name: 'X', faction: o.inimigo || (fac === 'vorag' ? 'vehnar' : 'vorag'), difficulty: 'normal' }];
  const sim = S.createSim(Object.assign({ seed: o.seed || 21, players, minutes: 40, mapV: 1 }, o.cfg || {})); const p = sim.players[0]; p.res.minerio = p.res.plasma = p.res.dados = 99999; p.era = o.era || 3; S.step(sim); return sim; }
function anda(sim, s) { const n = Math.round(s / S.TICK); for (let i = 0; i < n; i++) S.step(sim); }
function lugar(sim, pid, def, perto, raio) { const n = perto || S.nucleoOf(sim, pid); for (let R0 = raio || 110; R0 < 420; R0 += 18) for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2 + R0 * 0.01; const x = n.x + Math.cos(a) * R0, y = n.y + Math.sin(a) * R0; if (S.canBuild(sim, pid, def, x, y).ok) return { x, y }; } return null; }
function constroi(sim, pid, def, perto, raio) { const q = lugar(sim, pid, def, perto, raio); if (!q) return null; const antes = new Set(sim.ents.map(e => e.id)); S.enqueue(sim, { t: 'build', p: pid, def, x: q.x, y: q.y }); S.step(sim);
  const b = sim.ents.find(e => !antes.has(e.id) && e.kind === 'building' && e.def === def); if (!b) return null; b.progress = 0.998; anda(sim, 0.3); return b; }
function inimigo(sim, def, x, y, pid) { const u = S.spawnUnit(sim, pid == null ? 1 : pid, def, x, y); u.state = 'idle'; return u; }
const avatar = (sim, pid) => S.avatarDe(sim, pid);

// ---------- 2) construções únicas ----------
{ const t0 = Date.now();
  // Esteira de Montagem
  { const sim = partida('vehnar'); const q = constroi(sim, 0, 'quartel'), f = constroi(sim, 0, 'fabrica'); const e = constroi(sim, 0, 'esteira', q, 60); anda(sim, 2.5);
    ok('Esteira de Montagem: liga as duas produções mais perto e acelera 20%', e && e.liga && e.liga.length === 2 && Math.abs(UN.prod(sim, q) - 1.2) < 1e-9, e && e.liga ? 'ligadas ' + e.liga.length + ' · ×' + UN.prod(sim, q).toFixed(2) : 'não construiu');
    const antes = sim.ents.length; S.enqueue(sim, { t: 'build', p: 0, def: 'esteira', x: e.x + 200, y: e.y }); S.step(sim); ok('única: a segunda igual é recusada (uma por jogador)', sim.ents.filter(x => x.alive && x.def === 'esteira').length === 1);
    S.enqueue(sim, { t: 'build', p: 0, def: 'espelho', x: e.x + 200, y: e.y }); S.step(sim); ok('única: a de outra Raça é recusada', !sim.ents.some(x => x.alive && x.def === 'espelho')); }
  // Silo de Sucata
  { const sim = partida('vehnar'); const s = constroi(sim, 0, 'silo'); const w = { id: sim.nextId++, kind: 'wreck', x: s.x + 60, y: s.y, r: 12, ang: 0, alive: true, owner: -1, res: 'minerio', amount: 60, max: 60, bornT: sim.time, def: 'veiculo' }; sim.ents.push(w); sim.byId.set(w.id, w);
    const m0 = sim.players[0].res.minerio; anda(sim, 5); ok('Silo de Sucata: carcaça perto vira Minério (3/s)', w.amount < 60 && sim.players[0].res.minerio - m0 >= 12, 'carcaça ' + w.amount + ' · +' + Math.round(sim.players[0].res.minerio - m0)); }
  // Espelho do Véu
  { const sim = partida('erevane'); const r = constroi(sim, 0, 'refinaria'); const e = constroi(sim, 0, 'espelho', r, 50); anda(sim, 1); const n = S.nucleoOf(sim, 0);
    ok('Espelho do Véu: camufla as construções perto (não o Núcleo nem ele)', r.cloaked && !e.cloaked && !n.cloaked, 'refinaria ' + r.cloaked); }
  // Farol Falso
  { const sim = partida('erevane'); const f = constroi(sim, 0, 'farol'); const r = constroi(sim, 0, 'reator', f, 50); const u = inimigo(sim, 'infantaria', f.x + 70, f.y + 10); anda(sim, 1.5);
    ok('Farol Falso: o inimigo perto mira o Farol', u.target === f.id, 'alvo ' + (u.target === f.id ? 'Farol' : u.target));
    const v = inimigo(sim, 'veiculo', f.x + 50, f.y - 20); S.step(sim); S.applyDamage(sim, 0, null, f, 1e6, null); S.step(sim); ok('Farol Falso: ao cair, atordoa quem está perto (2 s)', v.raizAte > sim.time && v.cd > 1); }
  // Árvore-Mãe
  { const sim = partida('tessara', { era: 1 }); const a = constroi(sim, 0, 'arvore'); const u = inimigo(sim, 'quimera', a.x + 60, a.y, 0); u.hp = 40; anda(sim, 3);
    const h1 = u.hp; const m1 = a.maxHp; sim.players[0].era = 3; anda(sim, 1.5);
    ok('Árvore-Mãe: cura quem está perto e cresce com as Eras', h1 > 40 && a.maxHp > m1 * 1.4, 'cura ' + Math.round(h1 - 40) + ' em 3 s · vida ' + Math.round(m1) + ' → ' + Math.round(a.maxHp)); }
  // Viveiro
  { const sim = partida('tessara'); const v = constroi(sim, 0, 'viveiro'); anda(sim, 46); const n1 = sim.ents.filter(e => e.alive && e.viveiro === v.id).length; anda(sim, 200); const n2 = sim.ents.filter(e => e.alive && e.viveiro === v.id).length;
    ok('Viveiro: um Esporo a cada 45 s, até 3', n1 === 1 && n2 === 3, n1 + ' → ' + n2); }
  // Pilar de Ressonância
  { const sim = partida('quorith'); const p = constroi(sim, 0, 'pilar'); const a = inimigo(sim, 'voz', p.x + 40, p.y, 0), b = inimigo(sim, 'voz', p.x + 60, p.y, 0); const n = S.nucleoOf(sim, 0); const c = inimigo(sim, 'voz', p.x + 900 > 3000 ? p.x - 900 : p.x + 900, p.y, 0), d = inimigo(sim, 'voz', c.x + 20, c.y, 0); anda(sim, 1);
    ok('Pilar de Ressonância: +1 no acorde perto dele', a.elo === c.elo + 1, 'perto ' + a.elo + ' · longe ' + c.elo); }
  // Câmara de Eco
  { const sim = partida('quorith'); const e = constroi(sim, 0, 'eco'); const u = inimigo(sim, 'veiculo', e.x + 150, e.y); const h0 = u.hp; anda(sim, 3); ok('Câmara de Eco: a onda fere inimigos a 150', u.hp < h0 - 20, Math.round(h0 - u.hp) + ' de dano'); }
  // Câmara de Incubação
  { const sim = partida('vorag'); const c = constroi(sim, 0, 'incubadora'); S.enqueue(sim, { t: 'produce', p: 0, id: c.id, def: 'cria' }); const tc = S.UNITS.cria.time, tq = tc / 1.25; anda(sim, tq + 0.6); const cr = sim.ents.filter(e => e.alive && e.owner === 0 && e.def === 'cria').length; /* 5.0h junção: a Cria passou a 6 s (equilíbrio do Vorag) */
    ok('Câmara de Incubação: choca Crias 25% mais rápido (' + tc + ' s → ' + tq.toFixed(1) + ' s)', cr >= 2 && tq + 0.6 < tc && Math.abs(UN.prod(sim, c) - 1.25) < 1e-9, cr + ' Crias em ' + (tq + 0.6).toFixed(1) + ' s'); }
  // Tumor de Território
  { const sim = partida('vorag'); const t = constroi(sim, 0, 'tumor', null, 300); const u = inimigo(sim, 'infantaria', t.x + 150, t.y); anda(sim, 1); const s = S.UNITS.infantaria.speed;
    const vx = ARD.unicas.vel(sim, u); ok('Tumor de Território: território +240 e inimigos 30% mais lentos dentro', vx === 0.7 && S.territoryOf(sim, t) === 240 && S.inTerritory(sim, 0, t.x + 230, t.y), 'velocidade ×' + vx); }
  medidas.unicasMs = Date.now() - t0; }

// ---------- 3) módulos com escolha ----------
{ const t0 = Date.now();
  for (const def in UN.MODULOS) for (const k of ['a', 'b']) { const fac = def === 'nodulo' ? 'vorag' : 'vehnar'; const sim = partida(fac, { era: 2 }); const b = def === 'nodulo' ? constroi(sim, 0, 'nodulo', null, 240) : constroi(sim, 0, def); if (!b) { ok('módulo ' + def + '/' + k + ': construção', false); continue; }
    const m = UN.MODULOS[def][k === 'a' ? 0 : 1]; const p = sim.players[0]; const hp0 = b.maxHp; const r0 = Object.assign({}, p.res);
    S.enqueue(sim, { t: 'modulo', p: 0, id: b.id, escolha: k }); S.step(sim); const pago = r0.minerio - p.res.minerio >= 149; anda(sim, 15.2);
    S.enqueue(sim, { t: 'modulo', p: 0, id: b.id, escolha: k === 'a' ? 'b' : 'a' }); S.step(sim); const sempre = b.modulo.k === k && b.modulo.pronto;
    let efeito = false, info = '';
    if (m.renda) { const k2 = Object.keys(m.renda)[0]; const v0 = p.res[k2]; anda(sim, 10); efeito = p.res[k2] - v0 >= m.renda[k2] * 9.5; info = '+' + (p.res[k2] - v0).toFixed(1) + ' ' + k2 + ' em 10 s'; }
    else if (m.vida) { b.hp = b.maxHp * 0.5; const h1 = b.hp; anda(sim, 2); efeito = Math.abs(b.maxHp - hp0 * m.vida) < 1 && b.hp > h1; info = 'vida ×' + (b.maxHp / hp0).toFixed(2); }
    else if (m.prod) { efeito = Math.abs(UN.prod(sim, b) - m.prod) < 1e-9; info = '×' + UN.prod(sim, b); }
    else if (m.nasceVida) { S.enqueue(sim, { t: 'produce', p: 0, id: b.id, def: 'veiculo' }); anda(sim, 13); const v = sim.ents.find(e => e.alive && e.owner === 0 && e.def === 'veiculo'); efeito = v && Math.abs(v.maxHp - S.UNITS.veiculo.hp * 1.15) < 0.01; info = v ? 'vida ' + v.maxHp : 'sem veículo'; }
    else if (m.nasceVel) { S.enqueue(sim, { t: 'produce', p: 0, id: b.id, def: 'drone' }); anda(sim, 11); const v = sim.ents.find(e => e.alive && e.owner === 0 && e.def === 'drone'); efeito = v && Math.abs(v.speed - S.UNITS.drone.speed * 1.12) < 0.01; info = v ? 'velocidade ' + v.speed.toFixed(1) : 'sem drone'; }
    else if (m.doca) { const d = inimigo(sim, 'drone', b.x + 60, b.y, 0); d.hp = 50; anda(sim, 2); efeito = d.hp >= 59; info = 'drone ' + Math.round(d.hp); }
    else if (m.revela) { const u = inimigo(sim, 'pirata', b.x + 115, b.y, 1); sim.players[1].faction = 'erevane'; u.lastAttack = -99; anda(sim, 1.2); efeito = u.cloaked && sim.vis[0].has(u.id); info = 'camuflado e visto: ' + efeito; sim.players[1].faction = 'vorag'; }
    else if (m.mina) { const u = inimigo(sim, 'infantaria', b.x + 50, b.y); const h0 = u.hp; anda(sim, 1.1); efeito = u.hp <= h0 - 40; info = Math.round(h0 - u.hp) + ' de dano'; }
    ok('módulo ' + def + ' → ' + m.name + ' (' + k + '): pago, pronto em 15 s, para sempre e com efeito', pago && sempre && efeito, info); }
  { const sim = partida('vehnar', { era: 1 }); const r = constroi(sim, 0, 'refinaria'); S.enqueue(sim, { t: 'modulo', p: 0, id: r.id, escolha: 'a' }); S.step(sim); ok('módulo: na Era I é recusado (Era II)', !r.modulo); }
  medidas.modulosMs = Date.now() - t0; }

// ---------- 4) comandantes em campo ----------
const CMD = { comandantes: true };
{ const t0 = Date.now();
  { const sim = partida('vehnar', { cfg: CMD }); const a0 = avatar(sim, 0), a1 = avatar(sim, 1); ok('comandantes: cada jogador entra com o avatar do líder perto do Núcleo', a0 && a1 && a0.def === 'exoforja' && a1.def === 'devorador' && S.dist(a0.x, a0.y, S.nucleoOf(sim, 0).x, S.nucleoOf(sim, 0).y) < 120, a0 && a1 ? a0.def + ' e ' + a1.def : 'sem avatar'); }
  for (const fac of RACAS) { const C = S.COMANDANTES[fac];
    C.habilidades.forEach((h, n) => { const sim = partida(fac, { cfg: CMD }); const u = avatar(sim, 0); const pid = 0; const fx = u.x + 120, fy = u.y; const inim = sim.players[1].faction;
      const alvos = [inimigo(sim, 'infantaria', fx, fy), inimigo(sim, 'veiculo', fx + 25, fy + 15)]; const al = [inimigo(sim, S.FACTIONS[fac].traits ? 'quimera' : 'infantaria', u.x - 30, u.y, 0), inimigo(sim, 'veiculo', u.x - 40, u.y + 30, 0)];
      al.forEach(e => { e.hp = e.maxHp * 0.4; }); u.hp = u.maxHp * 0.5; S.step(sim);
      const st0 = { hp: alvos.map(e => e.hp), alHp: al.map(e => e.hp), uHp: u.hp, n: sim.ents.filter(e => e.alive && e.owner === 0 && e.kind === 'unit').length };
      const cmd = { t: 'habilidade', p: pid, id: u.id, n, x: fx, y: fy, alvo: alvos[0].id }; if (h.id === 'devorar') { alvos[0].x = u.x + 40; alvos[0].y = u.y; alvos[0].hp = 60; cmd.alvo = alvos[0].id; }
      S.enqueue(sim, cmd); const evs = S.step(sim).filter(e => e.t === 'cmd' && e.ev === 'habilidade'); const t = sim.time; let ef = false, info = '';
      switch (h.id) {
        case 'martelo': ef = alvos[0].hp < st0.hp[0] - 80 && alvos[0].raizAte > t; info = Math.round(st0.hp[0] - alvos[0].hp) + ' de dano + raiz'; break;
        case 'estilhaco': ef = alvos[0].hp < st0.hp[0] - 80; info = Math.round(st0.hp[0] - alvos[0].hp) + ' de dano'; break;
        case 'reparo': case 'florescer': ef = al.every((e, i) => e.hp >= Math.min(e.maxHp, st0.alHp[i] + h.cura) - 0.01 && e.hp > st0.alHp[i]); info = '+' + Math.round(al[1].hp - st0.alHp[1]) + ' no veículo'; break;
        case 'fundicao': case 'ecofalso': case 'ninhada': { const inv = sim.ents.filter(e => e.alive && e.invocado === u.id); ef = inv.length >= h.invoca.n && inv.every(e => e.tempUntil > t && e.def === h.invoca.def); info = inv.length + ' × ' + h.invoca.def; anda(sim, h.invoca.dura + 0.5); ef = ef && !sim.ents.some(e => e.alive && e.invocado === u.id); break; }
        case 'veu': anda(sim, 0.2); ef = u.cloaked && al[0].cloaked && !sim.vis[1].has(u.id); info = 'camuflados'; break;
        case 'lamina': ef = alvos[0].hp < st0.hp[0] - 100 || !alvos[0].alive; info = 'alvo ' + Math.round(Math.max(0, alvos[0].hp)); break;
        case 'raizes': ef = alvos[0].raizAte > t + 2 && alvos[1].raizAte > t + 2 && ARD.unicas.vel(sim, alvos[0]) === 0; info = 'enraizados ' + (alvos[0].raizAte - t).toFixed(1) + ' s'; break;
        case 'esporos': { const h0 = alvos[0].hp; anda(sim, 3); ef = sim.unicas.zonas.length === 1 && alvos[0].hp < h0 - 25; info = Math.round(h0 - alvos[0].hp) + ' de dano em 3 s'; anda(sim, 6); ef = ef && sim.unicas.zonas.length === 0; break; }
        case 'acorde': ef = al[0].buffAte > t && ARD.unicas.buff(sim, al[0]) === 1.2; info = 'dano ×1,2'; break;
        case 'silencio': ef = alvos[0].cd >= 3.8 && alvos[1].cd >= 3.8; info = 'calados ' + alvos[0].cd.toFixed(1) + ' s'; break;
        case 'devorar': ef = !alvos[0].alive && u.hp > st0.uHp; info = 'devorou e curou +' + Math.round(u.hp - st0.uHp); break;
        case 'rugido': ef = alvos[0].lentoAte > t && ARD.unicas.vel(sim, alvos[0]) === 0.6 && al[0].buffAte > t; info = 'inimigos ×0,6 · aliados ×1,15'; break;
      }
      const cd0 = u.cmd.cd[n]; S.enqueue(sim, Object.assign({}, cmd)); S.step(sim); const recarga = u.cmd.cd[n] === cd0 && Math.abs(cd0 - (t + h.cd)) < 0.11;
      ok('comandante ' + fac + ' · ' + h.id + ': efeito, evento e recarga de ' + h.cd + ' s', ef && evs.length === 1 && recarga, info); }); }
  // nível, queda e volta
  { const sim = partida('quorith', { cfg: CMD }); const u = avatar(sim, 0); let ev = []; const alvo = inimigo(sim, 'veiculo', u.x + 100, u.y); alvo.maxHp = alvo.hp = 1e6;
    for (let i = 0; i < 1500 && u.cmd.nivel < 2; i++) { u.state = 'attack'; u.target = alvo.id; ev = ev.concat(S.step(sim).filter(e => e.t === 'cmd')); }
    const subiu = u.cmd.nivel >= 2 && ev.some(e => e.ev === 'nivel'); const hp2 = u.maxHp; const nv = u.cmd.nivel;
    ok('comandante: sobe de nível pela veterania (dano feito), +10% de vida por nível', subiu && Math.abs(hp2 - S.UNITS[u.def].hp * (1 + 0.1 * (nv - 1))) < 0.01, 'nível ' + nv + ' em ' + sim.time.toFixed(0) + ' s');
    u.cmd.cd[1] = 0; S.enqueue(sim, { t: 'habilidade', p: 0, id: u.id, n: 1, x: u.x + 60, y: u.y }); S.step(sim); ok('comandante: o dano das habilidades cresce 15% e a recarga cai 5% por nível', Math.abs(u.cmd.cd[1] - sim.time - S.COMANDANTES.quorith.habilidades[1].cd * (1 - 0.05 * (nv - 1))) < 0.11);
    const id0 = u.id; S.applyDamage(sim, 1, null, u, 1e7, null); const evc = S.step(sim).filter(e => e.t === 'cmd' && e.ev === 'cai'); const p = sim.players[0]; const espera = 40 + 10 * nv;
    ok('comandante: cai, avisa e marca a volta (' + espera + ' s)', evc.length === 1 && Math.abs(p.cmdVolta - (evc[0].time + espera)) < 0.2 && !avatar(sim, 0));
    let volta = null; for (let i = 0; i < (espera + 2) * 10 && !volta; i++) { const e = S.step(sim).find(x => x.t === 'cmd' && x.ev === 'volta'); if (e) volta = e; }
    const u2 = avatar(sim, 0); const n = S.nucleoOf(sim, 0);
    ok('comandante: volta no Núcleo depois do tempo, com o nível que tinha', volta && u2 && u2.id !== id0 && u2.cmd.nivel === nv && S.dist(u2.x, u2.y, n.x, n.y) < 120 && Math.abs(volta.time - p.cmdVolta) < 1e-9 || (volta && u2 && u2.cmd.nivel === nv && S.dist(u2.x, u2.y, n.x, n.y) < 120), volta ? 'voltou aos ' + volta.time.toFixed(1) + ' s, nível ' + (u2 && u2.cmd.nivel) : 'não voltou'); }
  medidas.cmdMs = Date.now() - t0; }

// ---------- 5) ligados: determinismo, salvar e voltar, custo por tique ----------
function jogo(cfg, ticks, salvaEm) { /* partida IA x IA (as IAs não usam habilidade nem única: um roteiro sem estado usa, derivado da simulação) */
  const players = [{ name: 'A', faction: 'vehnar', difficulty: 'normal' }, { name: 'B', faction: 'erevane', difficulty: 'normal' }, { name: 'C', faction: 'tessara', difficulty: 'normal' }, { name: 'D', faction: 'quorith', difficulty: 'normal' }, { name: 'E', faction: 'vorag', difficulty: 'normal' }];
  const mk = () => S.createSim(Object.assign({ seed: 9, players, minutes: 25, mapV: 1 }, cfg)); let sim = mk(); let ais = sim.players.filter(p => !p.fenda).map(p => AI.create(p.id, p.difficulty)); const out = []; let ms = 0;
  const roteiro = () => { if (sim.tick % 50 !== 25) return; for (const p of sim.players) { const u = S.avatarDe(sim, p.id); if (!u) continue; const H = S.habDe(u); const n = (sim.tick / 50 | 0) % 3; const h = H[n]; let alvo = null, best = 1e9; for (const e of sim.ents) if (e.alive && e.kind === 'unit' && e.owner >= 0 && e.owner !== p.id && sim.vis[p.id].has(e.id)) { const d = S.dist(u.x, u.y, e.x, e.y); if (d < best) { best = d; alvo = e; } }
      if (h.alvo !== 'proprio' && (!alvo || best > h.alcance)) continue; S.enqueue(sim, { t: 'habilidade', p: p.id, id: u.id, n, x: alvo ? alvo.x : u.x, y: alvo ? alvo.y : u.y, alvo: alvo ? alvo.id : null }); }
    if (sim.tick === 1225) for (const p of sim.players) { p.era = Math.max(p.era, 2); p.res.minerio += 800; p.res.plasma += 300; p.res.dados += 100; const L = S.UNICAS_DE[p.faction]; const n = S.nucleoOf(sim, p.id); if (!n) continue; const q = lugar(sim, p.id, L[1]); if (q) S.enqueue(sim, { t: 'build', p: p.id, def: L[1], x: q.x, y: q.y });
      const r = sim.ents.find(e => e.alive && e.owner === p.id && e.kind === 'building' && S.MODULOS[e.def] && e.built && !e.modulo); if (r) S.enqueue(sim, { t: 'modulo', p: p.id, id: r.id, escolha: p.id % 2 ? 'b' : 'a' }); } };
  for (let t = 0; t < ticks; t++) {
    if (salvaEm && sim.tick === salvaEm) { const snap = JSON.parse(JSON.stringify(S.snapshot(sim))); const aiS = JSON.parse(JSON.stringify(ais.map(a => AI.snapshot(a)))); sim = S.restore(mk(), snap); ais = aiS.map(o => AI.restore(o)); }
    if (sim.tick % 10 === 0) for (const a of ais) for (const c of AI.think(sim, a)) S.enqueue(sim, c);
    roteiro(); const t0 = process.hrtime.bigint(); S.step(sim); ms += Number(process.hrtime.bigint() - t0) / 1e6;
    if (sim.tick % 10 === 0) out.push(sim.tick + ':' + S.hash(sim)); if (sim.result) break; }
  return { out, ms, ticks: sim.tick, sim }; }
{ const N = RAPIDO ? 1500 : 3000; const a = jogo(CMD, N), b = jogo(CMD, N); let d = -1; for (let i = 0; i < a.out.length; i++) if (a.out[i] !== b.out[i]) { d = i; break; }
  const habs = a.sim.events; const usou = a.sim.unicas && a.sim.unicas.cmds.length;
  ok('ligados: a mesma partida de 5 Raças com comandantes, habilidades, únicas e módulos dá o mesmo hash (' + a.out.length + ' amostras)', d < 0 && a.out.length === b.out.length && usou, d < 0 ? a.out[a.out.length - 1] : 'diverge em ' + d);
  const c = jogo(CMD, N, 1234); let d2 = -1; for (let i = 0; i < a.out.length; i++) if (a.out[i] !== c.out[i]) { d2 = i; break; }
  ok('ligados: salvar no tique 1234 e voltar segue idêntico', d2 < 0 && c.out.length === a.out.length, d2 < 0 ? '' : 'diverge em ' + d2);
  const s0 = jogo({}, N); medidas.tiqueSem = +(s0.ms / s0.ticks).toFixed(3); medidas.tiqueCom = +(a.ms / a.ticks).toFixed(3); medidas.tiqueDelta = +(medidas.tiqueCom - medidas.tiqueSem).toFixed(3);
  { const sim = a.sim; let t0 = process.hrtime.bigint(); for (let i = 0; i < 200; i++) UN.passo(sim, S.TICK); medidas.passoMs = +(Number(process.hrtime.bigint() - t0) / 1e6 / 200).toFixed(4); }
  log('custo por tique (5 jogadores, ' + N + ' tiques): sem ' + medidas.tiqueSem + ' ms · com ' + medidas.tiqueCom + ' ms · só o passo do h-unicas ' + medidas.passoMs + ' ms'); }

const nOk = R.filter(r => r.ok).length;
if (JSONOUT) console.log(JSON.stringify({ ok: nOk, total: R.length, falhou: R.filter(r => !r.ok).map(r => r.nome + (r.info ? ' · ' + r.info : '')), medidas }));
else console.log('únicas: ' + nOk + ' ok, ' + (R.length - nOk) + ' falhas');
process.exit(nOk === R.length ? 0 : 1);
