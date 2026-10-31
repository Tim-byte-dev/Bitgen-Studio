#!/bin/sh
# bitGen Studio - INSTALL ALL for Linux and macOS (2.616.0).
#
# Tim (verbatim): "is it possible to create an install_all file that will install git and nodejs if they are not
# installed then run start for all our supported os?"
#
#   sh install_all.sh          (macOS: double-click install_all.command)
#
#   1. Git      - installed when missing: Linux through the system's package manager (apt / dnf / yum / pacman /
#                 zypper / apk - it asks for your password once, sudo), macOS through Homebrew when you have it, else
#                 Apple's Command Line Tools (a window asks to install them; this waits until they are in).
#   2. The app  - this folder when it is a bitGen Studio folder; otherwise it is cloned from GitHub into
#                 ./Bitgen-Studio next to this file (and this runs from there).
#   3. Node.js  - a Node.js 18+ already installed is used. If there is none, the first start installs Node.js LTS
#                 INSIDE the app folder (runtime/node - nothing system-wide, no sudo) together with Python 3.12, ffmpeg,
#                 the Node packages and the app window (installer/bootstrap.sh), adds a launcher and opens the setup
#                 wizard (ComfyUI, the node packs, the models).
#   4. Start    - an installed studio just starts (misc/bitgen-studio.sh) - run this file any time to open it.
#
# Switches: BITGEN_REPO (another clone URL), BITGEN_DIR (where to clone), BITGEN_NO_START=1 (install, do not start).
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="${BITGEN_REPO:-https://github.com/Tim-byte-dev/Bitgen-Studio}"
OS="$(uname -s)"
say() { printf '%s\n' "[install_all] $*"; }
die() { printf '%s\n' "[install_all] ERROR: $*" >&2; exit 1; }
has() { command -v "$1" >/dev/null 2>&1; }

SUDO=""
if [ "$(id -u)" != "0" ]; then has sudo && SUDO="sudo"; fi

# install packages with whatever package manager this Linux has: pkg <apt name> <other name>
pkg() {
  if has apt-get; then $SUDO apt-get update -qq && $SUDO apt-get install -y "$1"
  elif has dnf; then $SUDO dnf install -y "$2"
  elif has yum; then $SUDO yum install -y "$2"
  elif has pacman; then $SUDO pacman -Sy --noconfirm "$2"
  elif has zypper; then $SUDO zypper --non-interactive install "$2"
  elif has apk; then $SUDO apk add "$2"
  else return 1; fi
}

echo "============================================"
echo " bitGen Studio - install all"
echo "============================================"
case "$OS" in Linux|Darwin) ;; *) die "this is for Linux and macOS - on Windows run install_all.bat";; esac

# ---- 1. Git ---------------------------------------------------------------------------------------------------
if has git; then
  say "[ok] $(git --version)"
else
  say "[..] Git is not installed - installing it"
  if [ "$OS" = Linux ]; then
    pkg git git || die "could not install Git - install it with your package manager (e.g. sudo apt install git) and run this again"
  elif has brew; then
    brew install git || die "brew could not install Git"
  else
    say "     macOS asks to install the Command Line Tools (they bring Git) - click Install in the window that opens"
    xcode-select --install >/dev/null 2>&1 || true
    n=0
    until xcode-select -p >/dev/null 2>&1 && git --version >/dev/null 2>&1; do
      n=$((n + 1)); [ "$n" -gt 360 ] && die "the Command Line Tools did not arrive in 60 minutes - install them, then run this again"
      sleep 10
    done
  fi
  has git || die "Git is still not found - open a new terminal and run this again"
  say "[ok] $(git --version)"
fi

# the downloads below need curl or wget, the Node.js archive xz / gzip
if ! has curl && ! has wget; then
  [ "$OS" = Linux ] && { say "[..] installing curl"; pkg curl curl || die "install curl and run this again"; }
fi
if [ "$OS" = Linux ] && ! has xz; then pkg xz-utils xz >/dev/null 2>&1 || true; fi

# ---- 2. The app: this folder, or a clone next to this file -----------------------------------------------------
if [ -f "$HERE/misc/server.js" ]; then
  APP="$HERE"
else
  APP="${BITGEN_DIR:-$HERE/Bitgen-Studio}"
  if [ -f "$APP/misc/server.js" ]; then
    say "[ok] bitGen Studio found in $APP"
  else
    say "[..] getting bitGen Studio: git clone $REPO"
    git clone "$REPO" "$APP" || die "git clone failed - check your internet connection"
  fi
fi
cd "$APP" || die "no app folder: $APP"
chmod +x "$APP/misc/bitgen-studio.sh" "$APP/installer/bootstrap.sh" "$APP/install_all.sh" "$APP/install_all.command" 2>/dev/null

# ---- 3. Node.js: one that is installed (18+), else the app's own (installed by the first start) ----------------
node_ok() { "$1" -e "process.exit(+process.versions.node.split('.')[0] >= 18 ? 0 : 1)" >/dev/null 2>&1; }
NODE=""
if [ -x "$APP/runtime/node/bin/node" ] && node_ok "$APP/runtime/node/bin/node"; then NODE="$APP/runtime/node/bin/node"
elif has node && node_ok node; then NODE="$(command -v node)"; fi
if [ -n "$NODE" ]; then say "[ok] Node.js $("$NODE" --version) ($NODE)"
else say "[..] Node.js 18+ is not installed - the first start installs Node.js LTS inside the app folder (runtime/node)"; fi

# ---- 4. Start: installed = run it; not yet = the first-start install (Node.js, Python, ffmpeg, packages, wizard) --
if [ -n "$NODE" ] && [ -d "$APP/node_modules/express" ]; then
  say "[ok] bitGen Studio is installed - starting it"
  [ -n "${BITGEN_NO_START:-}" ] && exit 0
  exec sh "$APP/misc/bitgen-studio.sh"
fi
say "[..] first start: installing what bitGen Studio needs (installer/bootstrap.sh)"
if [ -n "${BITGEN_NO_START:-}" ]; then exec sh "$APP/installer/bootstrap.sh" --no-launch; fi
exec sh "$APP/installer/bootstrap.sh"
