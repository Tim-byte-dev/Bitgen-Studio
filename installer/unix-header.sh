#!/bin/sh
# bitGen Studio @VERSION@ installer (@OS@) - a self-extracting archive.
#   sh bitgen-studio-setup-@VERSION@-@OS@.*  [--dir DIR] [--no-launch]
# Unpacks the app to ~/bitGenStudio (or DIR), sets up its own Node.js, Python
# and app window there (installer/bootstrap.sh - no sudo, nothing
# system-wide), then opens the setup wizard: ComfyUI, the custom nodes,
# OmniVoice, the Hugging Face models, tuned for this machine's GPU.
set -u
DIR="$HOME/bitGenStudio"
NOLAUNCH=""
while [ $# -gt 0 ]; do
  case "$1" in
    --dir) DIR="${2:?--dir needs a folder}"; shift 2;;
    --dir=*) DIR="${1#--dir=}"; shift;;
    --no-launch) NOLAUNCH="--no-launch"; shift;;
    -h|--help) sed -n '2,7p' "$0"; exit 0;;
    *) echo "unknown option $1"; exit 2;;
  esac
done
echo "bitGen Studio @VERSION@ -> $DIR"
LINE=$(awk '/^__BITGEN_PAYLOAD__$/ { print NR + 1; exit 0 }' "$0")
[ -n "$LINE" ] || { echo "this installer is damaged (no payload) - download it again"; exit 1; }
mkdir -p "$DIR" || exit 1
tail -n +"$LINE" "$0" | tar -xzf - -C "$DIR" || { echo "unpacking failed (disk full?)"; exit 1; }
# a reinstall over a set-up copy keeps everything the user made: only the
# program files in the archive are replaced
exec sh "$DIR/installer/bootstrap.sh" $NOLAUNCH
exit 0
__BITGEN_PAYLOAD__
