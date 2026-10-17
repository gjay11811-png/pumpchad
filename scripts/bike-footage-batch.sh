#!/bin/bash
# the final riding takes, one after another (each is 4 segments in fresh browsers, retried on WebGL loss, then encoded): scripts/bike-footage-batch.sh
cd "$(dirname "$0")/.."
export OUT=${OUT:-/c/Users/zafe5/Desktop/Chadverse-Overnight-Review/bike/footage-final}
mkdir -p "$OUT"
take() { # KIND CAM SPECIES
  powershell -NoProfile -Command "Get-Process | Where-Object { \$_.Path -like '*ms-playwright*' } | Stop-Process -Force -ErrorAction SilentlyContinue" >/dev/null 2>&1
  KIND=$1 CAM=$2 SPECIES=$3 FPS=12 scripts/bike-footage-all.sh
}
take surron chase ""
take surron side ""
take street chase ""
take street side ""
take surron chase skeleton
take street chase demon
echo BATCHDONE
