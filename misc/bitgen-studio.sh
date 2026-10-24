#!/bin/sh
# bitGen Studio launcher for Linux and macOS (2.331.0) - the Unix start.bat.
# The desktop entry / Applications app made by installer/bootstrap.sh runs
# this. The installer's portable tools (runtime/) come first on PATH; the app
# window is Electron when it is installed, otherwise the browser.
#   H3_NO_SHELL=1 misc/bitgen-studio.sh     force the browser (2.591.0: in misc/)
ROOT="$(cd "$(dirname "$0")/.." && pwd)"   # 2.591.0: this script is in misc/
cd "$ROOT" || exit 1
for d in "$ROOT/runtime/uv" "$ROOT/runtime/ffmpeg" "$ROOT/runtime/python/bin" "$ROOT/runtime/node/bin"; do
  [ -d "$d" ] && PATH="$d:$PATH"
done
export PATH
PORT="${H3_PORT:-8311}"
if [ -z "${H3_NO_SHELL:-}" ]; then
  EL="$(node -e "try{process.stdout.write(require('electron'))}catch(e){}" 2>/dev/null)"
  if [ -n "$EL" ] && [ -e "$EL" ]; then
    exec "$EL" "$ROOT/electron" "$@"
  fi
fi
# browser mode: the server in this terminal, the page in the default browser
( sleep 2
  if command -v xdg-open >/dev/null 2>&1; then xdg-open "http://127.0.0.1:$PORT" >/dev/null 2>&1
  elif command -v open >/dev/null 2>&1; then open "http://127.0.0.1:$PORT"; fi ) &
exec node misc/server.js
