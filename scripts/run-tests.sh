#!/bin/bash
# runs the listed browser tests one after another (a software-rendered headless browser: slow, one at a time), killing stray test browsers between them.
#   scripts/run-tests.sh launch-test showhome-test ...      (each is scripts/<name>.mjs; results go to /tmp/tests/<name>.log)
cd "$(dirname "$0")/.."
mkdir -p /tmp/tests
for t in "$@"; do
  powershell -NoProfile -Command "Get-Process | Where-Object { \$_.Path -like '*ms-playwright*' } | Stop-Process -Force -ErrorAction SilentlyContinue" >/dev/null 2>&1
  start=$(date +%s)
  URL=${URL:-http://localhost:5180/chadverse/} timeout ${TMO:-480} node scripts/$t.mjs > /tmp/tests/$t.log 2>&1
  code=$?
  pass=$(grep -c "PASS" /tmp/tests/$t.log); fail=$(grep -c "FAIL" /tmp/tests/$t.log)
  echo "$t: exit $code  pass $pass  fail $fail  ($(( $(date +%s) - start )) s)"
done
echo ALLDONE
