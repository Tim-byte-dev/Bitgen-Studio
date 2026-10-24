#!/bin/sh
# bitGen Studio - first-time bootstrap for Linux and macOS (2.331.0).
#
# Tim: "create a windows 11 type installer for the package ... make it
# crossplatform ... start using bitgen studio immediately after setup with
# no further action needed". The self-extracting installer
# (bitgen-studio-setup-<v>-linux.sh / -macos.command) unpacks the app and
# runs THIS. It puts everything the app needs INSIDE the app folder -
# nothing system-wide, no sudo:
#
#   runtime/node     Node.js LTS (the server, npm)
#   runtime/uv       uv (fetches Python)
#   runtime/python   a Python 3.12 environment (the app's python: workers,
#                    OmniVoice / whisper venvs, ComfyUI's venv is built from it)
#   runtime/ffmpeg   ffmpeg + ffprobe (static build) when there is none
#   node_modules     express, multer, jsdom + the Electron window
#
# then marks .setup-pending, adds a desktop / Applications launcher and opens
# the setup wizard (electron/installer.html) - which installs ComfyUI, the
# node packs, OmniVoice, the models, and tunes the settings for the GPU.
#
#   sh installer/bootstrap.sh [--no-launch]
#
# Test / offline switches: BITGEN_USE_SYSTEM=1 (use node / python3 / ffmpeg
# already on PATH, download nothing), BITGEN_NO_ELECTRON=1, BITGEN_SKIP_PIP=1,
# BITGEN_NODE_URL / BITGEN_UV_URL / BITGEN_FFMPEG_URL (mirrors, file:// works),
# BITGEN_PY_VERSION (default 3.12).
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
RT="$ROOT/runtime"
LAUNCH=1
for a in "$@"; do [ "$a" = "--no-launch" ] && LAUNCH=0; done
OS="$(uname -s)"; ARCH="$(uname -m)"
say() { printf '%s\n' "[bitgen] $*"; }
die() { printf '%s\n' "[bitgen] ERROR: $*" >&2; exit 1; }
mkdir -p "$RT"

fetch() {  # fetch URL FILE
  if command -v curl >/dev/null 2>&1; then curl -fL --retry 3 -o "$2" "$1"
  elif command -v wget >/dev/null 2>&1; then wget -O "$2" "$1"
  else die "neither curl nor wget is installed"; fi
}

case "$OS" in
  Linux)  NODE_OS=linux; case "$ARCH" in x86_64) NODE_ARCH=x64; UV_T=x86_64-unknown-linux-gnu;; aarch64|arm64) NODE_ARCH=arm64; UV_T=aarch64-unknown-linux-gnu;; *) die "unsupported CPU $ARCH";; esac;;
  Darwin) NODE_OS=darwin; case "$ARCH" in arm64) NODE_ARCH=arm64; UV_T=aarch64-apple-darwin;; x86_64) NODE_ARCH=x64; UV_T=x86_64-apple-darwin;; *) die "unsupported CPU $ARCH";; esac;;
  *) die "this installer is for Linux and macOS (Windows: bitGen-Studio-Setup.exe)";;
esac

# ---- Node.js ---------------------------------------------------------------
if [ -n "${BITGEN_USE_SYSTEM:-}" ]; then
  NODE="$(command -v node)"; NPM="$(command -v npm)"
  [ -n "$NODE" ] || die "BITGEN_USE_SYSTEM: no node on PATH"
elif [ -x "$RT/node/bin/node" ]; then
  say "Node.js already in runtime/node"
else
  URL="${BITGEN_NODE_URL:-}"
  if [ -z "$URL" ]; then
    # the newest LTS (the index lists newest first; lts is false or a codename)
    VER="$(fetch https://nodejs.org/dist/index.json - 2>/dev/null | tr '{' '\n' | grep '"lts":"' | head -n 1 | sed 's/.*"version":"\([^"]*\)".*/\1/')"
    [ -n "$VER" ] || VER="v22.20.0"
    URL="https://nodejs.org/dist/$VER/node-$VER-$NODE_OS-$NODE_ARCH.tar.gz"
  fi
  say "Node.js: $URL"
  fetch "$URL" "$RT/node.tgz" || die "could not download Node.js"
  mkdir -p "$RT/node" && tar -xzf "$RT/node.tgz" -C "$RT/node" --strip-components=1 && rm -f "$RT/node.tgz"
fi
if [ -z "${BITGEN_USE_SYSTEM:-}" ]; then NODE="$RT/node/bin/node"; NPM="$RT/node/bin/npm"; PATH="$RT/node/bin:$PATH"; export PATH; fi
say "node $("$NODE" --version)"

# ---- Python 3.12 (through uv) ------------------------------------------------
if [ -n "${BITGEN_USE_SYSTEM:-}" ]; then
  PY="$(command -v python3)"
  [ -n "$PY" ] || die "BITGEN_USE_SYSTEM: no python3 on PATH"
elif [ -x "$RT/python/bin/python" ]; then
  PY="$RT/python/bin/python"; say "Python already in runtime/python"
else
  URL="${BITGEN_UV_URL:-https://github.com/astral-sh/uv/releases/latest/download/uv-$UV_T.tar.gz}"
  say "uv: $URL"
  fetch "$URL" "$RT/uv.tgz" || die "could not download uv"
  mkdir -p "$RT/uv" && tar -xzf "$RT/uv.tgz" -C "$RT/uv" --strip-components=1 && rm -f "$RT/uv.tgz"
  UV_PYTHON_INSTALL_DIR="$RT/pythons" "$RT/uv/uv" venv "$RT/python" --python "${BITGEN_PY_VERSION:-3.12}" --seed || die "uv could not set up Python 3.12"
  PY="$RT/python/bin/python"
fi
say "$("$PY" --version 2>&1)"

# ---- ffmpeg ------------------------------------------------------------------
if command -v ffmpeg >/dev/null 2>&1 && command -v ffprobe >/dev/null 2>&1; then
  say "ffmpeg: $(command -v ffmpeg)"
elif [ -x "$RT/ffmpeg/ffmpeg" ]; then
  say "ffmpeg already in runtime/ffmpeg"
elif [ -z "${BITGEN_USE_SYSTEM:-}" ]; then
  mkdir -p "$RT/ffmpeg"
  if [ "$OS" = Linux ]; then
    URL="${BITGEN_FFMPEG_URL:-https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-$( [ "$NODE_ARCH" = arm64 ] && echo arm64 || echo amd64 )-static.tar.xz}"
    say "ffmpeg: $URL"
    if fetch "$URL" "$RT/ffmpeg.txz"; then
      tar -xJf "$RT/ffmpeg.txz" -C "$RT/ffmpeg" --strip-components=1 && rm -f "$RT/ffmpeg.txz"
    else say "WARNING: no ffmpeg - install it (sudo apt install ffmpeg) for video features"; fi
  else
    for T in ffmpeg ffprobe; do
      if fetch "https://evermeet.cx/ffmpeg/getrelease/$T/zip" "$RT/$T.zip"; then
        (cd "$RT/ffmpeg" && unzip -oq "$RT/$T.zip") && rm -f "$RT/$T.zip"
      else say "WARNING: could not download $T - brew install ffmpeg"; fi
    done
  fi
fi

# ---- the app's Node packages + the Electron window ----------------------------
cd "$ROOT" || die "no app folder"
say "npm install (express, multer, jsdom)"
"$NPM" install --no-audit --no-fund --loglevel=error || die "npm install failed"
if [ -z "${BITGEN_NO_ELECTRON:-}" ]; then
  say "the app window (Electron, ~150 MB, one time)"
  "$NPM" install electron --no-save --no-audit --no-fund --loglevel=error || say "WARNING: Electron did not install - the studio opens in your browser instead"
  EL="$("$NODE" -e "try{process.stdout.write(require('electron'))}catch(e){}" 2>/dev/null)"
  if [ -z "$EL" ] || [ ! -e "$EL" ]; then "$NODE" node_modules/electron/install.js >/dev/null 2>&1 || true; fi
fi

# ---- Python packages for the app (Hugging Face downloads, the VR stereo eye) -
if [ -z "${BITGEN_SKIP_PIP:-}" ]; then
  say "pip install -r misc/requirements.txt"
  "$PY" -m pip install --upgrade --quiet -r misc/requirements.txt || say "WARNING: some Python packages did not install - see above"
fi

# ---- settings: THIS python; setup still to do --------------------------------
"$NODE" scripts/setup-cli.js --bootstrap "$PY" || die "could not write the settings"
chmod +x "$ROOT/misc/bitgen-studio.sh" "$ROOT"/scripts/*.sh 2>/dev/null

# ---- a launcher where people look for apps -----------------------------------
if [ "$OS" = Linux ]; then
  APPS="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
  mkdir -p "$APPS"
  cat > "$APPS/bitgen-studio.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=bitGen Studio
Comment=Local AI film studio
Exec="$ROOT/misc/bitgen-studio.sh"
Icon=$ROOT/static/icon.png
Terminal=false
Categories=AudioVideo;Video;Graphics;
EOF
  chmod +x "$APPS/bitgen-studio.desktop"
  [ -d "$HOME/Desktop" ] && cp "$APPS/bitgen-studio.desktop" "$HOME/Desktop/" 2>/dev/null && chmod +x "$HOME/Desktop/bitgen-studio.desktop" 2>/dev/null
  say "launcher: $APPS/bitgen-studio.desktop"
else
  APP="$HOME/Applications/bitGen Studio.app"
  mkdir -p "$APP/Contents/MacOS"
  cat > "$APP/Contents/Info.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleName</key><string>bitGen Studio</string>
<key>CFBundleIdentifier</key><string>com.tigerart.bitgenstudio</string>
<key>CFBundleExecutable</key><string>bitgen-studio</string>
<key>CFBundlePackageType</key><string>APPL</string>
</dict></plist>
EOF
  printf '#!/bin/sh\nexec "%s/misc/bitgen-studio.sh"\n' "$ROOT" > "$APP/Contents/MacOS/bitgen-studio"
  chmod +x "$APP/Contents/MacOS/bitgen-studio"
  say "launcher: $APP"
fi

say "bootstrap done - opening the setup wizard"
[ "$LAUNCH" = 1 ] && exec "$ROOT/misc/bitgen-studio.sh"
exit 0
