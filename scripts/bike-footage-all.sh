#!/bin/bash
# records all 4 segments of one take and joins them: KIND=surron CAM=chase SPECIES=skeleton OUT=dir scripts/bike-footage-all.sh
cd "$(dirname "$0")/.."
OUT=${OUT:-.}; KIND=${KIND:-surron}; CAM=${CAM:-chase}; FPS=${FPS:-12}
N="ride-$KIND-${SPECIES:-pumpchad}-$CAM"
for s in 1 2 3 4; do SEG=$s KIND=$KIND CAM=$CAM FPS=$FPS OUT=$OUT SPECIES=$SPECIES node scripts/bike-footage.mjs || echo "seg $s failed"; done
node scripts/bike-encode.mjs "$OUT/frames-$N" "$OUT/$N.webm" $FPS && rm -rf "$OUT/frames-$N"
echo "done $OUT/$N.webm"
