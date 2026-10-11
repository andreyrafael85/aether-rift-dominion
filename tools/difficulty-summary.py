#!/usr/bin/env python3
import json, collections, sys
rows = [json.loads(l) for l in open(sys.argv[1] if len(sys.argv) > 1 else 'dist/difficulty.jsonl') if l.strip()]
by = collections.defaultdict(list)
for r in rows: by[r['diff']].append(r)
print('| Nível | Defensor cai | Minuto da queda | Construções IA aos 5 min | Exército IA aos 5 min | Pico antes do 1º ataque | 1º ataque |')
print('|---|---|---|---|---|---|---|')
for d in ['facil', 'normal', 'dificil', 'brutal']:
    rs = by.get(d, []); n = len(rs) or 1
    fell = [r['fell'] for r in rs if r.get('fell')]; fa = [r['firstAttack'] for r in rs if r.get('firstAttack')]
    print(f"| {d} | {len(fell)}/{len(rs)} | {('%.1f' % (sum(fell)/len(fell)/60)) if fell else '—'} | {sum(r['b300'] or 0 for r in rs)/n:.1f} | {sum(r.get('a300') or 0 for r in rs)/n:.0f} | {sum(r.get('peak') or 0 for r in rs)/n:.0f} | {('%.1f min' % (sum(fa)/len(fa)/60)) if fa else 'nenhum'} |")
