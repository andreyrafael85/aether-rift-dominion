// Constrói todas as malhas 3D (5 Raças × construções e unidades + cenário) no Node com o three vendorizado e mede triângulos.
// Uso: node tools/meshes-test.mjs  (precisa de dist/vendor/three: node tools/vendor.mjs)
import { readFileSync } from 'node:fs';
const root = new URL('..', import.meta.url).pathname;
const THREE = await import(root + 'dist/vendor/three/build/three.module.min.js'); globalThis.THREE = THREE; globalThis.ARD = {};
(0, eval)(readFileSync(root + 'src/sim.js', 'utf8')); (0, eval)(readFileSync(root + 'src/meshes.js', 'utf8'));
const M = globalThis.ARD.meshes, S = globalThis.ARD.sim; if (process.env.LOD) M.setLod(+process.env.LOD); const races = Object.keys(S.FACTIONS); let ok = 0, fail = 0; const rows = []; const warn = console.warn; const warns = []; console.warn = m => warns.push(m);
const tri = g => g ? g.attributes.position.count / 3 : 0;
for (const race of races) { const defs = M.BUILDING_DEFS.concat(M.unitsOf(race), ['veiculo_hull', 'veiculo_turret', 'torre_base', 'torre_turret', 'bastiao_base', 'bastiao_turret']); let tb = 0, tu = 0, maxU = ['', 0];
  for (const d of defs) { const t0 = performance.now(); const g = M.build(d, race, '#FF8C1A', 0); const ms = performance.now() - t0; if (!g || !g.main || !(g.width > 0) || !(g.height > 0) || Number.isNaN(g.width)) { fail++; rows.push('FALHA ' + race + '/' + d); continue; } ok++; const n = tri(g.main) + tri(g.em); if (M.BUILDING_DEFS.includes(d)) tb += n; else { tu += n; if (n > maxU[1]) maxU = [d, n]; } if (ms > 60) rows.push('lento ' + race + '/' + d + ' ' + ms.toFixed(0) + ' ms'); if ((d.endsWith('_hull') || d.endsWith('_base')) && g.mount == null) rows.push('sem mount ' + race + '/' + d); }
  rows.push(race.padEnd(8) + ' construções ' + Math.round(tb / M.BUILDING_DEFS.length) + ' tri/modelo · unidades ' + Math.round(tu / M.unitsOf(race).length) + ' tri/modelo · maior unidade ' + maxU[0] + ' ' + maxU[1]); }
for (const d of M.NEUTRAL_DEFS) for (let s = 0; s < 4; s++) { const g = M.build(d, null, null, s); if (g && g.main) ok++; else { fail++; rows.push('FALHA neutro ' + d); } }
for (const r of M.PROP_RACES) for (let s = 0; s < 4; s++) { const g = M.build('prop_' + r, null, null, s); if (g && g.main) ok++; else { fail++; rows.push('FALHA prop ' + r); } }
console.warn = warn; console.log(rows.join('\n')); if (warns.length) console.log('avisos: ' + warns.slice(0, 6).join(' | '));
console.log('malhas: ' + ok + ' ok, ' + fail + ' falhas'); process.exit(fail ? 1 : 0);
