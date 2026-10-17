#!/bin/bash
# re-record the listed segments with retries (context loss is detected and retried): OUT=dir KIND=.. CAM=.. SPECIES=.. scripts/bike-segs.sh 1 2
cd "$(dirname "$0")/.."
FPS=${FPS:-12}; N="ride-${KIND:-surron}-${SPECIES:-pumpchad}-${CAM:-chase}"
for s in "$@"; do
  for try in 1 2 3; do
    rm -f "$OUT/frames-$N/s$s-"*.jpg
    if SEG=$s FPS=$FPS node scripts/bike-footage.mjs; then echo "seg $s ok"; break; else echo "seg $s attempt $try failed"; fi
  done
done
echo ALLDONE
