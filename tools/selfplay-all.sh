#!/bin/bash
# Round-robin 1v1 entre as cinco Raças em paralelo. Uso: tools/selfplay-all.sh [sementes=4] [minutos=20] [procs=4] > dist/selfplay.jsonl
cd "$(dirname "$0")/.."
R=(vehnar erevane tessara quorith vorag); P=()
for ((i=0;i<5;i++)); do for ((j=i+1;j<5;j++)); do P+=("${R[$i]} ${R[$j]}"); done; done
printf '%s\n' "${P[@]}" | xargs -P "${3:-4}" -I{} sh -c "node tools/selfplay.cjs {} ${1:-4} ${2:-20}"
