#!/bin/sh
# bitGen Studio - build the three installers from a full release zip (2.331.0).
#
#   sh scripts/build-installers.sh <bitgen-studio-vX-full.zip> [OUT_DIR]
#
#   OUT_DIR/bitGen-Studio-Setup-<v>.exe             Windows (NSIS; needs makensis)
#   OUT_DIR/bitgen-studio-setup-<v>-linux.sh        Linux   (self-extracting)
#   OUT_DIR/bitgen-studio-setup-<v>-macos.command   macOS   (self-extracting;
#                                                   double-click opens Terminal)
#
# The Unix installers are a small sh header + a tar.gz of the app; they unpack
# to ~/bitGenStudio (or --dir DIR) and run installer/bootstrap.sh. Every
# installer ends by opening the app's setup wizard.
set -eu
ZIP="${1:?usage: build-installers.sh <full.zip> [OUT_DIR]}"
OUT="${2:-$(dirname "$ZIP")}"
ZIP="$(cd "$(dirname "$ZIP")" && pwd)/$(basename "$ZIP")"
mkdir -p "$OUT"; OUT="$(cd "$OUT" && pwd)"
VER="$(basename "$ZIP" | sed -n 's/^bitgen-studio-v\(.*\)-full\.zip$/\1/p')"
[ -n "$VER" ] || { echo "cannot read the version from $ZIP"; exit 1; }
HERE="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# ---- stage: the app exactly as the full zip carries it ------------------------
mkdir -p "$TMP/app"
python3 - "$ZIP" "$TMP/app" <<'EOF'
import sys, zipfile, os
z = zipfile.ZipFile(sys.argv[1])
z.extractall(sys.argv[2])
for n in z.namelist():
    if n.endswith((".sh", ".command")):
        os.chmod(os.path.join(sys.argv[2], n), 0o755)
EOF

# ---- Windows: CRLF batch files, then makensis --------------------------------
if command -v makensis >/dev/null 2>&1; then
  cp -a "$TMP/app" "$TMP/win"
  find "$TMP/win" -name "*.bat" -o -name "*.cmd" | while read -r f; do
    python3 -c "import sys;p=sys.argv[1];b=open(p,'rb').read().replace(b'\r\n',b'\n').replace(b'\n',b'\r\n');open(p,'wb').write(b)" "$f"
  done
  EXE="$OUT/bitGen-Studio-Setup-$VER.exe"
  makensis -V2 -DVERSION="$VER" -DSRC="$TMP/win" -DOUT="$EXE" "$HERE/installer/windows/bitgen-setup.nsi"
  echo "windows: $EXE"
else
  echo "windows: SKIPPED (makensis not installed - apt install nsis / choco install nsis)"
fi

# ---- Linux + macOS: sh header + tar.gz payload ------------------------------
(cd "$TMP/app" && tar -czf "$TMP/payload.tgz" .)
for OS in linux macos; do
  EXT=sh; [ "$OS" = macos ] && EXT=command
  F="$OUT/bitgen-studio-setup-$VER-$OS.$EXT"
  sed -e "s/@VERSION@/$VER/g" -e "s/@OS@/$OS/g" "$HERE/installer/unix-header.sh" > "$F"
  cat "$TMP/payload.tgz" >> "$F"
  chmod 755 "$F"
  echo "$OS: $F"
done
