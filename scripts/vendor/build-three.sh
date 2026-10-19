#!/usr/bin/env bash
# bitGen Studio — rebuild static/vendor/three-m3d.min.js (2.382.0). Needs network once (npm); the app never does.
#   bash scripts/vendor/build-three.sh
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$HERE/../.."
T="$(mktemp -d)"; cp "$HERE/m3d-entry.js" "$HERE/TTFLoader.local.js" "$T/"
cd "$T" && npm i --no-save --silent three@0.186.1 opentype.js@1.3.4 esbuild >/dev/null
npx esbuild m3d-entry.js --bundle --format=iife --global-name=H3THREE --minify --legal-comments=eof \
  --outfile="$ROOT/static/vendor/three-m3d.min.js"
cp node_modules/three/LICENSE "$ROOT/static/vendor/LICENSE-three.txt"
cp node_modules/opentype.js/LICENSE "$ROOT/static/vendor/LICENSE-opentype.txt"
echo "built $(du -h "$ROOT/static/vendor/three-m3d.min.js" | cut -f1)"
