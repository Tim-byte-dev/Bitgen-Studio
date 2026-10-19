#!/usr/bin/env bash
# ci-units.sh — the quick test run GitHub Actions does on every push (2.477.0, the public beta).
#
# Every self-contained unit test: scripts/test-*.js that are not browser tests (-ui.js) and need no running studio,
# no stub server and no other program (no H3_URL / 127.0.0.1 / playwright / child_process). About a minute and a
# half on a laptop. Plus the repository's own checks (scripts/test-repo.py). The full suite - the browser tests
# against stub ComfyUI / LLM / Unreal servers - is scripts/e2e-stub-test.sh.
#
#   bash scripts/ci-units.sh            run them all
#   bash scripts/ci-units.sh --list     only say which ones would run
set -u
cd "$(dirname "$0")/.."
tests=()
for f in scripts/test-*.js; do
  case "$f" in *-ui.js) continue ;; esac
  grep -qE 'H3_URL|127\.0\.0\.1|localhost|playwright|spawn\(|execSync|child_process' "$f" && continue
  tests+=("$f")
done
if [ "${1:-}" = "--list" ]; then printf '%s\n' "${tests[@]}"; echo "${#tests[@]} unit tests"; exit 0; fi
pass=0; fail=0; failed=()
for f in "${tests[@]}"; do
  if out=$(timeout 180 node "$f" 2>&1); then pass=$((pass + 1)); echo "ok    $f"
  else fail=$((fail + 1)); failed+=("$f"); echo "FAIL  $f"; echo "$out" | grep -a "FAIL\|Error\|✗" | head -8 | sed 's/^/      /'; fi
done
if out=$(python3 scripts/test-repo.py 2>&1); then pass=$((pass + 1)); echo "ok    scripts/test-repo.py"
else fail=$((fail + 1)); failed+=("scripts/test-repo.py"); echo "FAIL  scripts/test-repo.py"; echo "$out" | grep -a "^FAIL" | head -8 | sed 's/^/      /'; fi
echo
echo "RESULT: $pass passed, $fail failed"
[ "$fail" -eq 0 ] || { printf 'failed: %s\n' "${failed[@]}"; exit 1; }
