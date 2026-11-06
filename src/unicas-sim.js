/* Aether Rift: Dominion — 5.0h (agente h-unicas): construções únicas (duas por Raça), módulos com escolha e comandantes em campo, na simulação.
   Simulação pura: sem DOM, sem Math.random e sem relógio; só o tique, a matemática determinística (DM) e o estado da partida.
   Entra no build antes do src/sim.js; os dois se ligam por ARD.unicas.instala(ARD.sim), em qualquer ordem de carga (o mesmo padrão do src/chefes-sim.js).
   Estado: sim.unicas (só existe quando alguém constrói uma única, instala um módulo ou a partida tem comandantes) + campos nas entidades
   (e.modulo, e.cmd, e.liga, e.raizAte, e.lentoAte/lentoF, e.buffAte/buffF, e.veuAte) e nos jogadores (p.cmdVolta, p.cmdNivel, p.cmdXp).
   Partida sem nada disso não passa por nada daqui: o mesmo hash, a mesma fotografia e as mesmas 20 missões de antes. */
(function (ARD) {
'use strict';
let S = null, I = null; /* ARD.sim e as funções internas dele (ARD.sim._int) */
const PI = Math.PI, TAU = PI * 2;
const cl = (v, a, b) => v < a ? a : v > b ? b : v;

/* ---------- construções únicas: duas por Raça, no máximo uma de cada por jogador, liberadas por Era ----------
   Atalhos J e K (na Raça de quem joga). Números conservadores (tabela no RELATORIO); nenhuma decide a partida sozinha. */
const UNICAS = {
  esteira:    { fac: 'vehnar',  name: 'Esteira de Montagem', key: 'J', era: 2, hp: 900, r: 20, cost: { minerio: 250, plasma: 80 }, buildTime: 20, energyUse: 8, sensor: 140, liga: { r: 260, n: 2, prod: 1.2 },
    desc: 'Liga as duas construções de produção mais próximas (até 260): +20% de velocidade de produção nelas.' },
  silo:       { fac: 'vehnar',  name: 'Silo de Sucata', key: 'K', era: 1, hp: 800, r: 18, cost: { minerio: 180 }, buildTime: 14, energyUse: 4, sensor: 160, sucata: { r: 240, n: 3, taxa: 3 },
    desc: 'Carcaças a até 240 viram Minério sozinhas: 3 por segundo de cada uma, até 3 carcaças ao mesmo tempo.' },
  espelho:    { fac: 'erevane', name: 'Espelho do Véu', key: 'J', era: 2, hp: 600, r: 16, cost: { minerio: 200, plasma: 60, dados: 20 }, buildTime: 18, energyUse: 10, sensor: 180, veu: { r: 200 },
    desc: 'Camufla as suas construções a até 200 (menos o Núcleo e ele mesmo). Torres e detectores inimigos ainda as revelam.' },
  farol:      { fac: 'erevane', name: 'Farol Falso', key: 'K', era: 1, hp: 1400, r: 18, cost: { minerio: 120, plasma: 20 }, buildTime: 8, energyUse: 0, sensor: 120, isca: { r: 120, atordoa: 2 },
    desc: 'Isca: unidades e torres inimigas por perto preferem atirar nele. Ao cair, solta um pulso que atordoa os inimigos a até 120 por 2 s.' },
  arvore:     { fac: 'tessara', name: 'Árvore-Mãe', key: 'J', era: 1, hp: 1200, r: 22, cost: { minerio: 220, plasma: 40 }, buildTime: 22, energyUse: 6, sensor: 200, cura: { r: 150, rEra: 40, hp: 3, hpEra: 2, vidaEra: 0.25 },
    desc: 'Cura as suas unidades e construções a até 150 (+40 por Era): 3 de vida/s (+2 por Era). Cresce e ganha vida a cada Era.' },
  viveiro:    { fac: 'tessara', name: 'Viveiro', key: 'K', era: 2, hp: 800, r: 20, cost: { minerio: 200, plasma: 50 }, buildTime: 18, energyUse: 6, sensor: 180, cultiva: { def: 'esporo', cada: 45, max: 3 },
    desc: 'Cultiva Esporos-sentinela de graça: um a cada 45 s, até 3 vivos ao mesmo tempo.' },
  pilar:      { fac: 'quorith', name: 'Pilar de Ressonância', key: 'J', era: 2, hp: 900, r: 16, cost: { minerio: 180, plasma: 60, dados: 20 }, buildTime: 16, energyUse: 8, sensor: 200, elo: { r: 200 },
    desc: 'Estende o Elo: as suas unidades a até 200 contam um vizinho a mais no acorde (até um acima do teto).' },
  eco:        { fac: 'quorith', name: 'Câmara de Eco', key: 'K', era: 2, hp: 1000, r: 18, cost: { minerio: 220, plasma: 60 }, buildTime: 16, energyUse: 10, sensor: 240, weapon: 'eco_pulso',
    desc: 'Torre de ressonância: onda de 200 de alcance que fere em área e atrasa veículos e estruturas.' },
  incubadora: { fac: 'vorag',   name: 'Câmara de Incubação', key: 'J', era: 2, hp: 1000, r: 22, cost: { minerio: 200, plasma: 60 }, buildTime: 18, energyUse: 6, sensor: 150, produces: ['cria', 'cuspidor'], prod: 1.25,
    desc: 'Choca Crias e Cuspidores 25% mais rápido que o Quartel.' },
  tumor:      { fac: 'vorag',   name: 'Tumor de Território', key: 'K', era: 1, hp: 700, r: 16, cost: { minerio: 140, plasma: 30 }, buildTime: 12, energyUse: 2, sensor: 220, territory: 240, lento: { f: 0.7 },
    desc: 'Reclama território em 240 e desacelera em 30% os inimigos dentro dele.' },
};
const ARMAS = { eco_pulso: { dmg: 22, range: 200, cd: 1.6, proj: 'beam', speed: 0, inacc: 0, splash: 40, cls: 'est', stun: true, versusOverride: { inf: 1.1, vei: 1, dro: 0.6, est: 0.8, sup: 1.1 } } };
const UNICAS_DE = {}; for (const k in UNICAS) (UNICAS_DE[UNICAS[k].fac] = UNICAS_DE[UNICAS[k].fac] || []).push(k);

/* ---------- módulos com escolha: dois por construção, um para sempre (as que já têm módulo da 4.1d ficam como estão) ---------- */
const MOD_CUSTO = { minerio: 150, plasma: 50 }, MOD_T = 15, MOD_ERA = 2;
const MODULOS = {
  refinaria:   [{ id: 'prensa', name: 'Prensa de Minério', desc: '+0,5 Minério por segundo.', renda: { minerio: 0.5 } },
                { id: 'cofre', name: 'Cofre Blindado', desc: '+60% de vida e regenera 4 de vida/s.', vida: 1.6, regen: 4 }],
  fabrica:     [{ id: 'linha', name: 'Linha Rápida', desc: 'Produção 20% mais rápida nesta Fábrica.', prod: 1.2 },
                { id: 'chassi', name: 'Chassi Reforçado', desc: 'Os veículos daqui saem com +15% de vida.', nasceVida: 1.15 }],
  hangar:      [{ id: 'posq', name: 'Pós-combustão', desc: 'Os drones daqui saem 12% mais rápidos.', nasceVel: 1.12 },
                { id: 'doca', name: 'Doca de Reparo', desc: 'Repara as suas unidades voadoras a até 160 (5 de vida/s).', doca: { r: 160, hp: 5 } }],
  laboratorio: [{ id: 'antena', name: 'Antena de Dados', desc: '+0,3 Dados por segundo.', renda: { dados: 0.3 } },
                { id: 'contra', name: 'Contraespionagem', desc: 'Detecta as unidades camufladas inimigas a até 260, como uma Torre.', revela: 260 }],
  nodulo:      [{ id: 'posto', name: 'Posto Avançado', desc: '+50% de vida e regenera 3 de vida/s.', vida: 1.5, regen: 3 },
                { id: 'mina', name: 'Mina de Pulso', desc: 'Pulso de 45 de dano em área nos inimigos a até 90, a cada 6 s.', mina: { r: 90, dano: 45, cada: 6 } }],
};
for (const d in MODULOS) MODULOS[d].forEach((m, i) => { m.k = i ? 'b' : 'a'; m.cost = MOD_CUSTO; m.time = MOD_T; m.era = MOD_ERA; });

/* ---------- comandantes em campo (cfg.comandantes): um avatar por líder, 3 habilidades, nível pela veterania (patente + 1) ----------
   alvo: 'chao' (ponto até 'alcance' do avatar), 'unidade' (inimigo visível até 'alcance') ou 'proprio' (em volta do avatar). cd em segundos (−5% por nível acima do 1).
   O dano e a cura crescem 15% por nível. Quando cai, volta no Núcleo depois de VOLTA_BASE + VOLTA_NIVEL × nível segundos, com o nível que tinha. */
const VOLTA_BASE = 40, VOLTA_NIVEL = 10, NIVEL_K = 0.15, NIVEL_CD = 0.05, NIVEL_VIDA = 0.1;
const COMANDANTES = {
  vehnar:  { def: 'exoforja', lider: 'barao', habilidades: [
    { id: 'martelo', alvo: 'chao', alcance: 220, r: 90, cd: 18, dano: 110, raiz: 1.2 },
    { id: 'reparo', alvo: 'proprio', r: 180, cd: 25, cura: 140, curaEst: 240 },
    { id: 'fundicao', alvo: 'chao', alcance: 260, cd: 60, invoca: { def: 'soldador', n: 2, dura: 30 } }] },
  erevane: { def: 'espectro', lider: 'vesper', habilidades: [
    { id: 'veu', alvo: 'proprio', r: 150, cd: 30, dura: 8 },
    { id: 'lamina', alvo: 'unidade', alcance: 230, cd: 14, dano: 180 },
    { id: 'ecofalso', alvo: 'chao', alcance: 320, cd: 35, invoca: { def: 'espectro_eco', n: 3, dura: 15 } }] },
  tessara: { def: 'guardia', lider: 'sylvia', habilidades: [
    { id: 'raizes', alvo: 'chao', alcance: 240, r: 100, cd: 22, raiz: 3 },
    { id: 'florescer', alvo: 'proprio', r: 200, cd: 28, cura: 160, curaEst: 200 },
    { id: 'esporos', alvo: 'chao', alcance: 260, r: 90, cd: 30, nuvem: { dura: 8, dps: 14 } }] },
  quorith: { def: 'prismavivo', lider: 'zayin', habilidades: [
    { id: 'acorde', alvo: 'proprio', r: 180, cd: 26, buff: { f: 1.2, dura: 8 } },
    { id: 'estilhaco', alvo: 'chao', alcance: 220, r: 70, cd: 14, dano: 140 },
    { id: 'silencio', alvo: 'chao', alcance: 240, r: 110, cd: 30, cala: 4 }] },
  vorag:   { def: 'devorador', lider: 'oru', habilidades: [
    { id: 'devorar', alvo: 'unidade', alcance: 70, cd: 20, dano: 220, cura: 0.5 },
    { id: 'ninhada', alvo: 'proprio', cd: 40, invoca: { def: 'cria', n: 4, dura: 25 } },
    { id: 'rugido', alvo: 'proprio', r: 170, cd: 30, lento: { f: 0.6, dura: 4 }, buff: { f: 1.15, dura: 6 } }] },
};
/* avatares (S.UNITS): faction 'comandante' e epic tiram tudo das listas de produção, do teste de desempenho e do aquecimento por Raça;
   raca = a Raça do líder (o desenho usa a do dono). cost dá a escala da veterania (patentes a 320, 960 e 2000 de dano). */
const AVATARES = {
  exoforja:     { name: 'Exo-Forja', raca: 'vehnar', cls: 'vei', hp: 950, r: 16, speed: 78, weapon: 'martelo_exo', sensor: 240, desc: 'Avatar do Barão-Forja: exoesqueleto de fundição com martelo sísmico.' },
  espectro:     { name: 'Espectro', raca: 'erevane', cls: 'inf', hp: 720, r: 14, speed: 112, weapon: 'lamina_luz', sensor: 270, desc: 'Avatar de Vesper Ísk: lâmina de luz e um véu que esconde quem está perto.' },
  guardia:      { name: 'Guardiã', raca: 'tessara', cls: 'sup', hp: 820, r: 14, speed: 86, weapon: 'espinho_guardia', sensor: 260, desc: 'Avatar de Sylvia Oriel: raízes, flores que curam e esporos.' },
  prismavivo:   { name: 'Prisma Vivo', raca: 'quorith', cls: 'vei', hp: 850, r: 15, speed: 82, weapon: 'acorde_prisma', sensor: 250, flutua: true, desc: 'Avatar de Zayin Coral: um prisma que canta o acorde do Coro.' },
  devorador:    { name: 'Devorador', raca: 'vorag', cls: 'vei', hp: 1100, r: 17, speed: 98, weapon: 'mandibula', sensor: 220, desc: 'Avatar de Oru Voraz: a fera que devora e chama a ninhada.' },
  espectro_eco: { name: 'Eco Falso', raca: 'erevane', cls: 'inf', hp: 120, r: 14, speed: 118, sensor: 120, eco: true, desc: 'Cópia de luz do Espectro: não fere, só engana.' },
};
for (const k in AVATARES) Object.assign(AVATARES[k], { key: '', faction: 'comandante', epic: true, cmd: k !== 'espectro_eco', cost: k === 'espectro_eco' ? {} : { minerio: 300, plasma: 100 }, time: 0, energyUse: 0 });
const ARMAS_CMD = {
  martelo_exo:     { dmg: 34, range: 120, cd: 1.2, proj: 'shell', speed: 320, inacc: 6, splash: 18, cls: 'vei' },
  lamina_luz:      { dmg: 26, range: 140, cd: 0.9, proj: 'beam', speed: 0, inacc: 0, splash: 0, cls: 'inf' },
  espinho_guardia: { dmg: 18, range: 150, cd: 1.0, proj: 'bullet', speed: 760, inacc: 3, splash: 0, cls: 'sup' },
  acorde_prisma:   { dmg: 30, range: 160, cd: 1.3, proj: 'beam', speed: 0, inacc: 0, splash: 14, cls: 'vei' },
  mandibula:       { dmg: 40, range: 34, cd: 0.9, proj: 'beam', speed: 0, inacc: 0, splash: 0, cls: 'vei' },
};

function instala(sim0) {
  if (!sim0 || !sim0._int || S === sim0) return; S = sim0; I = sim0._int;
  const arma = (k, w) => { if (S.WEAPONS[k]) return; w.versus = Object.assign({ inf: 1, vei: 1, dro: 1, est: 1, sup: 1, civ: 1, chefe: 1 }, S.COUNTER[w.cls] || {}, w.versusOverride || {}); S.WEAPONS[k] = w; };
  for (const k in ARMAS) arma(k, ARMAS[k]); for (const k in ARMAS_CMD) arma(k, ARMAS_CMD[k]);
  for (const k in UNICAS) if (!S.BUILDINGS[k]) { const d = Object.assign({ unica: true }, UNICAS[k]); if (d.weapon) d.attack = S.WEAPONS[d.weapon]; S.BUILDINGS[k] = d; }
  for (const k in AVATARES) if (!S.UNITS[k]) { const d = AVATARES[k]; if (d.weapon) d.attack = S.WEAPONS[d.weapon]; S.UNITS[k] = d; }
  S.MODULOS = MODULOS; S.COMANDANTES = COMANDANTES; S.UNICAS = UNICAS; S.UNICAS_DE = UNICAS_DE;
  S.unicaLivre = unicaLivre; S.moduloDe = moduloDe; S.cdHab = cdHab; S.habDe = habDe; S.avatarDe = avatarDe;
}

/* ---------- estado ---------- */
function novo() { return { v: 1, lista: [], cmds: [], zonas: [], veuAte: 0 }; }
function garante(sim) { if (!sim.unicas) sim.unicas = novo(); return sim.unicas; }
function vivo(sim, id) { const e = sim.byId.get(id); return e && e.alive ? e : null; }
function jogadorDeVerdade(p) { return p && !p.fenda && !p.mundo; }
function nivelK(e) { return 1 + NIVEL_K * (((e.cmd && e.cmd.nivel) || 1) - 1); }
function moduloDe(e) { if (!e || !e.modulo) return null; const L = MODULOS[e.def]; return L ? L[e.modulo.k === 'b' ? 1 : 0] : null; }
function modAtivo(e) { return e.modulo && e.modulo.pronto ? moduloDe(e) : null; }
function habDe(e) { const p = e && e.cmd ? COMANDANTES[(AVATARES[e.def] || {}).raca] : null; return p ? p.habilidades : null; }
function cdHab(h, e) { return h.cd * (1 - NIVEL_CD * (((e.cmd && e.cmd.nivel) || 1) - 1)); }
function avatarDe(sim, pid) { if (!sim.unicas) return null; for (const id of sim.unicas.cmds) { const e = vivo(sim, id); if (e && e.owner === pid) return e; } return null; }
/* a única pode ser construída por este jogador? (Raça certa e nenhuma igual de pé ou em obra) */
function unicaLivre(sim, pid, def) { const d = UNICAS[def], p = sim.players[pid]; if (!d || !p || p.faction !== d.fac) return false;
  for (const e of sim.ents) if (e.alive && e.kind === 'building' && e.owner === pid && e.def === def) return false; return true; }

/* ---------- configuração (createSim, rede e salvamento) ---------- */
function cfgDe(cfg) { const src = cfg && cfg.resume && cfg.resume.simCfg ? cfg.resume.simCfg : (cfg || {}); const o = {};
  if (src.comandantes) o.comandantes = true;
  for (const k of ['unicasTeste', 'cmdNivel']) if (src[k] != null) o[k] = src[k]; /* chaves de teste (?unicas=1, ?cmdnivel=N) */
  return o; }
function criar(sim, cfg) {
  if (!cfg) return;
  if (cfg.comandantes) { garante(sim); for (const p of sim.players) if (jogadorDeVerdade(p)) poeAvatar(sim, p, cfg.cmdNivel | 0); }
  if (cfg.unicasTeste) { garante(sim); for (const p of sim.players) if (p.human || cfg.unicasTeste === 'todos') testeUnicas(sim, p); }
}
function poeAvatar(sim, p, nivel) {
  const C = COMANDANTES[p.faction]; const n = I.nucleoOf(sim, p.id); if (!C || !n) return null;
  const a = S.DM.atan2(S.CY - n.y, S.CX - n.x); const u = I.addUnit(sim, p.id, C.def, cl(n.x + S.DM.cos(a) * (n.r + 34), 40, S.WORLD - 40), cl(n.y + S.DM.sin(a) * (n.r + 34), 40, S.WORLD - 40));
  u.cmd = { nivel: 1, xp: 0, cd: [0, 0, 0] };
  const nv = cl(nivel || p.cmdNivel || 1, 1, 4); if (p.cmdXp) u.xp = p.cmdXp; if (nv > 1) { u.rank = nv - 1; if (!p.cmdXp) u.xp = 400 * S.VET_RANKS[nv - 1]; }
  sobeNivel(sim, u, true); garante(sim).cmds.push(u.id); p.cmdVolta = 0; return u;
}
function sobeNivel(sim, u, quieto) { const nv = 1 + (u.rank || 0); if (nv === u.cmd.nivel && !quieto) return; const k0 = 1 + NIVEL_VIDA * (u.cmd.nivel - 1), k1 = 1 + NIVEL_VIDA * (nv - 1);
  u.maxHp = S.UNITS[u.def].hp * k1; u.hp = Math.min(u.maxHp, u.hp * k1 / k0); const subiu = nv > u.cmd.nivel; u.cmd.nivel = nv; u.cmd.xp = u.xp;
  if (subiu && !quieto) { I.emit(sim, { t: 'cmd', ev: 'nivel', p: u.owner, id: u.id, nivel: nv, x: u.x, y: u.y }); I.alertTo(sim, u.owner, 'Comandante no nível ' + nv, u.x, u.y, 'good'); } }
/* chave de teste ?unicas=1: as duas únicas da Raça já prontas perto do Núcleo (fotos e testes) */
function testeUnicas(sim, p) { const n = I.nucleoOf(sim, p.id); if (!n) return; const L = UNICAS_DE[p.faction] || []; const a0 = S.DM.atan2(S.CY - n.y, S.CX - n.x);
  L.forEach((def, i) => { for (let k = 0; k < 12; k++) { const a = a0 + (i ? -1 : 1) * (0.9 + k * 0.25), R = 120 + (k % 3) * 30; const x = n.x + S.DM.cos(a) * R, y = n.y + S.DM.sin(a) * R;
    if (S.canBuild(sim, p.id, def, x, y).ok) { S.addBuilding(sim, p.id, def, x, y, true); break; } } });
  refazLista(sim); }

/* ---------- comandos ---------- */
function podeConstruir(sim, pid, def, avisa) { const p = sim.players[pid]; const d = UNICAS[def]; if (!d || !p) return false;
  if (p.faction !== d.fac) return false;
  if (!unicaLivre(sim, pid, def)) { if (avisa) I.emit(sim, { t: 'notice', p: pid, text: 'Construção única: só uma por jogador' }); return false; }
  garante(sim); return true; }
function comando(sim, c, p) {
  if (c.t === 'modulo') {
    const b = sim.byId.get(c.id); if (!b || !b.alive || b.kind !== 'building' || b.owner !== c.p || !b.built || b.modulo) return; const L = MODULOS[b.def]; if (!L) return;
    const m = L[c.escolha === 'b' ? 1 : 0]; if ((p.era || 1) < m.era) { if (p.human) I.emit(sim, { t: 'notice', p: c.p, text: 'Requer Era II (Expansão)' }); return; }
    if (!S.canAfford(p, m.cost)) { if (p.human) I.emit(sim, { t: 'notice', p: c.p, text: 'Recursos insuficientes' }); return; }
    for (const k in m.cost) p.res[k] = Math.max(0, p.res[k] - m.cost[k]);
    b.modulo = { k: m.k, ate: sim.time + m.time, pronto: false }; const U = garante(sim); if (U.lista.indexOf(b.id) < 0) U.lista.push(b.id);
    I.emit(sim, { t: 'unica', ev: 'modulo', p: c.p, id: b.id, def: b.def, k: m.k, x: b.x, y: b.y }); return;
  }
  if (c.t === 'habilidade') {
    const u = sim.byId.get(c.id); if (!u || !u.alive || u.owner !== c.p || !u.cmd) return; const H = habDe(u); const n = c.n | 0; if (!H || n < 0 || n > 2) return; const h = H[n];
    if (sim.time < u.cmd.cd[n]) { if (p.human) I.emit(sim, { t: 'notice', p: c.p, text: 'Habilidade em recarga' }); return; }
    let x = u.x, y = u.y, alvo = null;
    if (h.alvo === 'chao') { if (typeof c.x !== 'number' || typeof c.y !== 'number' || !isFinite(c.x) || !isFinite(c.y)) return; x = cl(c.x, 30, S.WORLD - 30); y = cl(c.y, 30, S.WORLD - 30);
      if (S.dist(u.x, u.y, x, y) > h.alcance) { if (p.human) I.emit(sim, { t: 'notice', p: c.p, text: 'Longe demais do comandante' }); return; } }
    else if (h.alvo === 'unidade') { alvo = sim.byId.get(c.alvo); if (!alvo || !alvo.alive || (alvo.kind !== 'unit' && alvo.kind !== 'building') || alvo.owner < 0 || !S.isEnemy(sim, c.p, alvo.owner) || !S.canSee(sim, c.p, alvo)) { if (p.human) I.emit(sim, { t: 'notice', p: c.p, text: 'Escolha um inimigo visível' }); return; }
      if (S.dist(u.x, u.y, alvo.x, alvo.y) - alvo.r > h.alcance) { if (p.human) I.emit(sim, { t: 'notice', p: c.p, text: 'Longe demais do comandante' }); return; }
      if (h.id === 'devorar' && alvo.kind !== 'unit') { if (p.human) I.emit(sim, { t: 'notice', p: c.p, text: 'Escolha um inimigo visível' }); return; } x = alvo.x; y = alvo.y; }
    u.cmd.cd[n] = sim.time + cdHab(h, u); usa(sim, u, h, n, x, y, alvo); return;
  }
}

/* ---------- habilidades ---------- */
function inimigosEm(sim, pid, x, y, r, soUnid, fn) { I.queryGrid(sim, x, y, r + 40, e => { if (!e.alive || e.owner < 0 || e.owner === pid || (e.kind !== 'unit' && e.kind !== 'building') || (soUnid && e.kind !== 'unit')) return; if (!S.isEnemy(sim, pid, e.owner)) return; if (S.dist(x, y, e.x, e.y) - (e.r || 0) > r) return; fn(e); }); }
function aliadosEm(sim, pid, x, y, r, fn) { I.queryGrid(sim, x, y, r + 40, e => { if (!e.alive || e.owner !== pid || (e.kind !== 'unit' && e.kind !== 'building')) return; if (S.dist(x, y, e.x, e.y) > r) return; fn(e); }); }
function fere(sim, u, alvos, dano) { for (const e of alvos) if (e.alive) S.applyDamage(sim, u.owner, u, e, dano, null); }
function invoca(sim, u, inv, x, y, nv) { const n = inv.n + (inv.def === 'cria' ? ((nv - 1) >> 1) : 0); const out = [];
  for (let i = 0; i < n; i++) { const a = i / n * TAU + 0.4; const sx = cl(u.x + S.DM.cos(a) * (u.r + 16), 30, S.WORLD - 30), sy = cl(u.y + S.DM.sin(a) * (u.r + 16), 30, S.WORLD - 30);
    const s = I.addUnit(sim, u.owner, inv.def, sx, sy); s.tempUntil = sim.time + inv.dura; s.invocado = u.id; s.state = inv.def === 'espectro_eco' ? 'move' : 'attackmove'; s.tx = cl(x + S.DM.cos(a) * 26, 30, S.WORLD - 30); s.ty = cl(y + S.DM.sin(a) * 26, 30, S.WORLD - 30); s.gx = x; s.gy = y; s.gn = 0; s.stuck = 0; s.stk = 0;
    if (inv.def === 'espectro_eco') s.ang = u.ang; out.push(s); I.emit(sim, { t: 'spawn', p: u.owner, x: s.x, y: s.y, def: inv.def }); } return out; }
function usa(sim, u, h, n, x, y, alvo) {
  const k = nivelK(u), t = sim.time, nv = u.cmd.nivel; let afetados = 0;
  switch (h.id) {
    case 'martelo': case 'estilhaco': { const L = []; inimigosEm(sim, u.owner, x, y, h.r, false, e => L.push(e)); afetados = L.length; fere(sim, u, L, h.dano * k);
      if (h.raiz) for (const e of L) if (e.alive && e.kind === 'unit' && !e.boss) e.raizAte = Math.max(e.raizAte || 0, t + h.raiz); break; }
    case 'reparo': case 'florescer': aliadosEm(sim, u.owner, u.x, u.y, h.r, e => { if (e.kind === 'building' && !e.built) return; const c = (e.kind === 'unit' ? h.cura : h.curaEst) * k; if (e.hp < e.maxHp) { e.hp = Math.min(e.maxHp, e.hp + c); afetados++; } }); break;
    case 'fundicao': case 'ecofalso': case 'ninhada': afetados = invoca(sim, u, h.invoca, x, y, nv).length; break;
    case 'veu': aliadosEm(sim, u.owner, u.x, u.y, h.r, e => { if (e.kind !== 'unit') return; e.veuAte = t + h.dura; afetados++; }); { const U = garante(sim); U.veuAte = Math.max(U.veuAte || 0, t + h.dura); } break;
    case 'lamina': if (alvo) { fere(sim, u, [alvo], h.dano * k); afetados = 1; } break;
    case 'raizes': inimigosEm(sim, u.owner, x, y, h.r, true, e => { if (e.boss) return; e.raizAte = Math.max(e.raizAte || 0, t + h.raiz + 0.5 * (nv - 1)); afetados++; }); break;
    case 'esporos': { const Z = garante(sim).zonas; Z.push({ id: sim.nextId++, tipo: 'esporos', dono: u.owner, de: u.id, x, y, r: h.r, t0: t, t1: t + h.nuvem.dura, dps: h.nuvem.dps * k }); afetados = 1; break; }
    case 'acorde': aliadosEm(sim, u.owner, u.x, u.y, h.r, e => { if (e.kind !== 'unit') return; e.buffAte = t + h.buff.dura; e.buffF = h.buff.f; afetados++; }); break;
    case 'silencio': inimigosEm(sim, u.owner, x, y, h.r, false, e => { if (e.boss) return; e.cd = Math.max(e.cd || 0, h.cala); afetados++; }); break;
    case 'devorar': if (alvo && alvo.alive) { const fraco = !S.UNITS[alvo.def].epic && !alvo.cmd && alvo.hp <= h.dano * k; const antes = alvo.hp;
      if (fraco) { alvo.hp = 0.0001; S.applyDamage(sim, u.owner, u, alvo, 1, null); u.hp = Math.min(u.maxHp, u.hp + alvo.maxHp * h.cura); }
      else { fere(sim, u, [alvo], h.dano * k); u.hp = Math.min(u.maxHp, u.hp + Math.max(0, antes - Math.max(0, alvo.hp)) * 0.3); } afetados = 1; } break;
    case 'rugido': inimigosEm(sim, u.owner, u.x, u.y, h.r, true, e => { if (e.boss) return; e.lentoAte = t + h.lento.dura; e.lentoF = h.lento.f; afetados++; });
      aliadosEm(sim, u.owner, u.x, u.y, h.r, e => { if (e.kind !== 'unit' || e === u) return; e.buffAte = t + h.buff.dura; e.buffF = h.buff.f; }); break;
  }
  I.emit(sim, { t: 'cmd', ev: 'habilidade', p: u.owner, id: u.id, def: u.def, n, hab: h.id, x, y, r: h.r || 0, alvo: alvo ? alvo.id : null, afetados, nivel: nv });
}

/* ---------- passo (depois das construções e das unidades: as camuflagens do Véu e do Espelho valem para a visão deste mesmo tique) ---------- */
function refazLista(sim) { const U = sim.unicas, L = []; for (const e of sim.ents) if (e.alive && e.kind === 'building' && (UNICAS[e.def] || e.modulo)) L.push(e.id); U.lista = L; }
function passo(sim, dt) {
  const U = sim.unicas, t = sim.time, tk = sim.tick;
  if (tk % 10 === 0) refazLista(sim);
  for (const id of U.lista) { const b = vivo(sim, id); if (!b || !b.built) continue; const d = UNICAS[b.def];
    if (d) predio(sim, b, d, dt, t, tk);
    if (b.modulo) modulo(sim, b, dt, t, tk); }
  /* comandantes: nível, volta no Núcleo */
  if (U.cmds.length) { let poda = false; for (const id of U.cmds) { const u = vivo(sim, id); if (!u) { poda = true; continue; } if (tk % 5 === 0 && 1 + (u.rank || 0) !== u.cmd.nivel) sobeNivel(sim, u, false); u.cmd.xp = u.xp; } if (poda) U.cmds = U.cmds.filter(id => vivo(sim, id)); }
  if (sim.cfg && sim.cfg.comandantes && tk % 5 === 0) for (const p of sim.players) if (p.alive && p.cmdVolta > 0 && t >= p.cmdVolta) { const u = poeAvatar(sim, p, 0); if (u) { I.emit(sim, { t: 'cmd', ev: 'volta', p: p.id, id: u.id, x: u.x, y: u.y }); I.alertTo(sim, p.id, 'Seu comandante voltou ao campo', u.x, u.y, 'good'); } }
  /* efeitos com tempo nas unidades */
  for (const id of U.cmds) { const u = vivo(sim, id); if (u && u.veuAte > t) u.cloaked = true; }
  if (U.veuAte > t) for (const e of sim.ents) if (e.alive && e.kind === 'unit' && e.veuAte > t) e.cloaked = true; /* só enquanto algum Véu dura */
  /* nuvens de esporos */
  if (U.zonas.length) { if (tk % 5 === 0) for (const z of U.zonas) if (t < z.t1) { const atk = vivo(sim, z.de); inimigosEm(sim, z.dono, z.x, z.y, z.r, true, e => S.applyDamage(sim, z.dono, atk, e, z.dps * 0.5, null)); }
    if (U.zonas.some(z => t >= z.t1)) U.zonas = U.zonas.filter(z => t < z.t1); }
}
function predio(sim, b, d, dt, t, tk) {
  const p = sim.players[b.owner]; const era = p.era || 1;
  if (d.veu) { const r2 = d.veu.r; I.queryGrid(sim, b.x, b.y, r2 + 40, e => { if (e.alive && e.kind === 'building' && e.owner === b.owner && e !== b && e.def !== 'nucleo' && e.built && S.dist(b.x, b.y, e.x, e.y) <= r2) e.cloaked = true; }); return; }
  if (d.liga) { if (tk % 20 === 0 || !b.liga) { const c = []; for (const e of sim.ents) if (e.alive && e.kind === 'building' && e.owner === b.owner && e.built && e !== b && e.def !== 'nucleo' && S.BUILDINGS[e.def].produces) { const dd = S.dist(b.x, b.y, e.x, e.y); if (dd <= d.liga.r) c.push([dd, e.id]); }
      c.sort((a, z) => a[0] - z[0] || a[1] - z[1]); b.liga = c.slice(0, d.liga.n).map(x => x[1]); } return; }
  if (d.sucata) { if (tk % 10 !== 0) return; const c = []; for (const e of sim.ents) if (e.alive && e.kind === 'wreck' && e.amount > 0) { const dd = S.dist(b.x, b.y, e.x, e.y); if (dd <= d.sucata.r) c.push([dd, e]); }
      c.sort((a, z) => a[0] - z[0] || a[1].id - z[1].id); let g = 0; for (let i = 0; i < c.length && i < d.sucata.n; i++) { const w = c[i][1]; const q = Math.min(w.amount, d.sucata.taxa); w.amount -= q; g += q; if (w.amount <= 0) w.alive = false; }
      if (g > 0) { p.res.minerio += g; p.stats.collected += g; if (tk % 50 === 0) I.emit(sim, { t: 'float', x: b.x, y: b.y, text: '+' + Math.round(g * 5), owner: b.owner, kind: 'gain' }); } return; }
  if (d.cura) { if (b.arvEra !== era) { const k0 = 1 + d.cura.vidaEra * ((b.arvEra || 1) - 1), k1 = 1 + d.cura.vidaEra * (era - 1); b.maxHp = d.hp * k1; b.hp = Math.min(b.maxHp, b.hp * k1 / k0); b.arvEra = era; if (era > 1) I.emit(sim, { t: 'unica', ev: 'cresce', p: b.owner, id: b.id, def: b.def, era, x: b.x, y: b.y }); }
    if (tk % 5 !== 0) return; const r2 = d.cura.r + d.cura.rEra * (era - 1), hp = (d.cura.hp + d.cura.hpEra * (era - 1)) * 0.5;
    aliadosEm(sim, b.owner, b.x, b.y, r2, e => { if (e.hp < e.maxHp && (e.kind === 'unit' || e.built)) e.hp = Math.min(e.maxHp, e.hp + hp); }); return; }
  if (d.cultiva) { if (!(b.vivT > 0)) b.vivT = t + d.cultiva.cada; if (t < b.vivT || tk % 10 !== 0) return; b.vivT = t + d.cultiva.cada; let n = 0; for (const e of sim.ents) if (e.alive && e.viveiro === b.id) n++;
      if (n >= d.cultiva.max) return; const a = S.DM.atan2(S.CY - b.y, S.CX - b.x); const u = S.spawnUnit(sim, b.owner, d.cultiva.def, b.x + S.DM.cos(a) * (b.r + 14), b.y + S.DM.sin(a) * (b.r + 14)); if (u) { u.viveiro = b.id; if (b.rally) { u.state = 'move'; u.tx = b.rally.x; u.ty = b.rally.y; u.gx = null; } } return; }
  if (d.elo) { if (tk % 5 !== 0) return; const F = S.FACTIONS[p.faction]; if (!F.elo) return; const cap = F.elo.cap + ((p.mods && p.mods.eloBonus) || 0) + 1;
    I.queryGrid(sim, b.x, b.y, d.elo.r + 40, e => { if (e.alive && e.kind === 'unit' && e.owner === b.owner && e.cls !== 'civ' && S.dist(b.x, b.y, e.x, e.y) <= d.elo.r) e.elo = Math.min((e.elo || 0) + 1, cap); }); return; }
  if (d.lento) { if (tk % 5 !== 0) return; const r2 = d.territory; inimigosEm(sim, b.owner, b.x, b.y, r2, true, e => { if (e.boss || e.parte) return; e.lentoAte = t + 0.6; e.lentoF = d.lento.f; }); return; }
}
function modulo(sim, b, dt, t, tk) {
  const M = b.modulo; const m = moduloDe(b); if (!m) return; const p = sim.players[b.owner];
  if (!M.pronto) { if (t < M.ate) return; M.pronto = true; if (m.vida) { b.maxHp *= m.vida; b.hp *= m.vida; } I.emit(sim, { t: 'unica', ev: 'modulo-pronto', p: b.owner, id: b.id, def: b.def, k: m.k, x: b.x, y: b.y }); I.alertTo(sim, b.owner, m.name + ' pronta: ' + m.desc, b.x, b.y, 'good'); return; }
  if (tk % 10 !== 0) return;
  if (m.renda) for (const k in m.renda) { p.res[k] += m.renda[k]; if (k !== 'dados') p.stats.collected += m.renda[k]; }
  if (m.regen && b.hp < b.maxHp) b.hp = Math.min(b.maxHp, b.hp + m.regen);
  if (m.doca) aliadosEm(sim, b.owner, b.x, b.y, m.doca.r, e => { if (e.kind === 'unit' && S.UNITS[e.def].flying && e.hp < e.maxHp) e.hp = Math.min(e.maxHp, e.hp + m.doca.hp); });
  if (m.revela) inimigosEm(sim, b.owner, b.x, b.y, m.revela, true, e => { if (e.cloaked) e.revealT = Math.max(e.revealT || 0, 1.1); });
  if (m.mina) { if (!(M.minaT > t) ) { const L = []; inimigosEm(sim, b.owner, b.x, b.y, m.mina.r, true, e => L.push(e)); if (L.length) { M.minaT = t + m.mina.cada; for (const e of L) if (e.alive) S.applyDamage(sim, b.owner, b, e, m.mina.dano, null); I.emit(sim, { t: 'unica', ev: 'mina', p: b.owner, id: b.id, x: b.x, y: b.y, r: m.mina.r }); } } }
}

/* ---------- ganchos chamados pelo src/sim.js (só com sim.unicas) ---------- */
function prod(sim, b) { let m = 1; const am = modAtivo(b); if (am && am.prod) m *= am.prod; const d = UNICAS[b.def]; if (d && d.prod) m *= d.prod;
  for (const id of sim.unicas.lista) { const e = vivo(sim, id); if (e && e.owner === b.owner && e.def === 'esteira' && e.built && e.liga && e.liga.indexOf(b.id) >= 0) { m *= UNICAS.esteira.liga.prod; break; } } return m; }
function nasce(sim, b, u) { const am = modAtivo(b); if (!am) return; if (am.nasceVida && u.cls === 'vei') { u.maxHp *= am.nasceVida; u.hp *= am.nasceVida; } if (am.nasceVel && S.UNITS[u.def].flying) u.speed *= am.nasceVel; }
function vel(sim, u) { const t = sim.time; if (u.raizAte > t) return 0; return u.lentoAte > t ? (u.lentoF || 1) : 1; }
function buff(sim, a) { return a.buffAte > sim.time ? (a.buffF || 1) : 1; }
function morte(sim, e, killer) {
  if (e.cmd) { const p = sim.players[e.owner]; if (p && p.alive) { p.cmdNivel = e.cmd.nivel; p.cmdXp = e.xp; p.cmdVolta = sim.time + VOLTA_BASE + VOLTA_NIVEL * e.cmd.nivel; }
    I.emit(sim, { t: 'cmd', ev: 'cai', p: e.owner, id: e.id, def: e.def, x: e.x, y: e.y, volta: p ? p.cmdVolta : 0, por: killer }); if (p && p.alive) I.alertTo(sim, e.owner, 'Seu comandante caiu: volta no Núcleo em ' + Math.round(p.cmdVolta - sim.time) + ' s', e.x, e.y, 'danger'); return; }
  if (e.def === 'farol' && e.built) { const d = UNICAS.farol.isca; const t = sim.time; inimigosEm(sim, e.owner, e.x, e.y, d.r, false, o => { if (o.boss) return; o.cd = Math.max(o.cd || 0, d.atordoa); if (o.kind === 'unit') o.raizAte = Math.max(o.raizAte || 0, t + d.atordoa); });
    I.emit(sim, { t: 'unica', ev: 'isca', p: e.owner, id: e.id, x: e.x, y: e.y, r: d.r }); }
}
function hash(sim, mix) { const U = sim.unicas; mix(U.lista.length); mix(U.cmds.length); mix(U.zonas.length);
  for (const z of U.zonas) { mix(z.id); mix(Math.round(z.x)); mix(Math.round(z.y)); mix(Math.round(z.t1 * 10)); }
  for (const id of U.cmds) { const u = sim.byId.get(id); if (!u || !u.cmd) continue; mix(u.cmd.nivel); for (const c of u.cmd.cd) mix(Math.round(c * 10)); }
  for (const id of U.lista) { const b = sim.byId.get(id); if (b && b.modulo) { mix(b.modulo.k === 'b' ? 2 : 1); mix(b.modulo.pronto ? 1 : 0); } }
  for (const p of sim.players) mix(Math.round((p.cmdVolta || 0) * 10)); }
function foto(sim) { return sim.unicas ? S.jsonSafe(sim.unicas) : undefined; }
function volta(sim, d) { sim.unicas = d ? S.jsonBack(d) : null; }

ARD.unicas = { instala, cfgDe, criar, podeConstruir, comando, passo, prod, nasce, vel, buff, morte, hash, foto, volta, garante,
  UNICAS, UNICAS_DE, MODULOS, COMANDANTES, AVATARES, ARMAS, ARMAS_CMD, VOLTA_BASE, VOLTA_NIVEL, NIVEL_K, NIVEL_CD, moduloDe, habDe, cdHab, avatarDe, unicaLivre };
if (ARD.sim && ARD.sim._int) instala(ARD.sim);
})(globalThis.ARD = globalThis.ARD || {});
