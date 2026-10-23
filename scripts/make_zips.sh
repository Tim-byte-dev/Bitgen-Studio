#!/usr/bin/env bash
# bitGen Studio — build delivery zips (2.217.0: dockers are extensions;
# 2.233.0, by instruction: workflows ride their OWN zip too).
#   full: bitgen-studio-v<ver>-full.zip      (install package, tree layout,
#                                             INCLUDING every ext/<id>/ and
#                                             comfy_workflows/ — the one zip
#                                             that installs alone)
#   flat: bitgen-studio-v<ver>-flat.zip      (CORE ONLY — ext/ AND
#                                             comfy_workflows/ excluded — every
#                                             file at top level, '__' separators,
#                                             plus _MANIFEST.txt; unflatten with
#                                             unflatten.ps1 or scripts/unflatten.py.
#                                             This is the project-knowledge copy:
#                                             extensions and workflows ride their
#                                             own zips and are uploaded only when
#                                             a session must edit them)
#   wf:   bitgen-workflows-v<ver>.zip        (comfy_workflows/, tree layout —
#                                             unzip at the install root; a core
#                                             without it cannot render, so a
#                                             restored session needs it beside
#                                             the ext zips)
#   ext:  bitgen-ext-<id>-v<ver>.zip         (one per extension, tree layout —
#                                             unzip at the install root)
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$(pwd)"
VER=$(node -p "require('./package.json').version")
OUT="${1:-$ROOT/dist}"
mkdir -p "$OUT"

FILES=$(find . -type f \
  ! -path "./node_modules/*" ! -path "./dist/*" \
  ! -path "./.git/*" \
  ! -path "./workspace/*" ! -path "./projects/*" ! -path "./styles/*" \
  ! -path "./music/*" \
  ! -name "MM3_Characters_upscale.json" \
  ! -path "./graphs/*" \
  ! -path "./pose_sheets/*" \
  ! -path "./solidcraft/*" \
  ! -path "./models/*" ! -path "./loras/*" ! -path "./llm-models/*" \
  ! -path "./sd-cpp/*" ! -path "./llama-cpp/*" \
  ! -path "./comfy/*" \
  ! -path "./venvs/*" ! -path "./checkpoints/*" \
  ! -path "*/__pycache__/*" ! -name "*.pyc" ! -name "*.log" \
  ! -name "config.json" ! -name "config.json.migrated" ! -name "custom.settings" \
  ! -name "images.tmp" \
  ! -name "custom.settings.bak" ! -name "default.settings.broken" \
  ! -name "dockers.json" ! -name "dockers.json.tmp" ! -name "docker_status.json" ! -name "docker_status.json.tmp" \
  ! -name "workspaces.json" ! -name "workspaces.json.tmp" \
  ! -name "basic.cfg" ! -name "folder_filters.cfg" \
  ! -name "*.zip" | sed 's|^\./||' | sort)
# default.settings SHIPS (it is the authored default layer); custom.settings
# never does — it is this machine's diff from the defaults (2.99.0).
[ -f default.settings ] || { echo "default.settings is missing — run the server once (it writes it) or restore it"; exit 1; }

FULL="$OUT/bitgen-studio-v${VER}-full.zip"
rm -f "$FULL"
echo "$FILES" | zip -q "$FULL" -@
echo "built $FULL"

# ---- the flat CORE (project-knowledge copy): no ext/, no comfy_workflows/ ----
CORE=$(echo "$FILES" | grep -v '^ext/' | grep -v '^comfy_workflows/')
STAGE=$(mktemp -d)
MAN="$STAGE/_MANIFEST.txt"
{
  echo "bitGen Studio v${VER} — flat CORE delivery ($(date -u +%F))"
  echo "Files named a__b.ext belong at a/b.ext. Restore the tree with:"
  echo "  powershell -ExecutionPolicy Bypass -File unflatten.ps1   (Windows)"
  echo "  python3 scripts__unflatten.py                            (anywhere)"
  echo
  echo "ext/ IS NOT IN THIS ZIP (2.217.0): each docker extension ships as its"
  echo "own bitgen-ext-<id>-v${VER}.zip — unzip those at the install root."
  echo "A core without ext/ still serves a working page with no dockers."
  echo
  echo "comfy_workflows/ IS NOT IN THIS ZIP EITHER (2.233.0, by instruction):"
  echo "it ships as bitgen-workflows-v${VER}.zip — unzip it at the install"
  echo "root. A core without it cannot render video/images through ComfyUI,"
  echo "and the e2e suite needs it, so a restored session unzips it beside"
  echo "the ext zips."
  echo
} > "$MAN"
while IFS= read -r f; do
  flat="${f//\//__}"
  cp "$f" "$STAGE/$flat"
  echo "$flat  <-  $f" >> "$MAN"
done <<< "$CORE"
FLAT="$OUT/bitgen-studio-v${VER}-flat.zip"
rm -f "$FLAT"
(cd "$STAGE" && zip -qr "$FLAT" .)
rm -rf "$STAGE"
echo "built $FLAT (core only — ext/ and comfy_workflows/ excluded)"

# ---- the workflows zip (2.233.0): comfy_workflows/, unzip at install root ----
# 2.234.0: TOLERATE an absent comfy_workflows/ — a continuation session
# restored from the flat + ext zips alone has none (the workflows ride
# their own zip), and grep's empty match must not abort the ext zips
# below under set -e. A release that touches no workflow keeps the LAST
# workflows zip current; say so instead of building an empty (or worse,
# stub-only) one.
WFZ="$OUT/bitgen-workflows-v${VER}.zip"
rm -f "$WFZ"
WFFILES=$(echo "$FILES" | grep '^comfy_workflows/' || true)
if [ -n "$WFFILES" ]; then
  echo "$WFFILES" | zip -q "$WFZ" -@
  echo "built $WFZ"
else
  echo "comfy_workflows/ absent — NO workflows zip built (the previous release's stays current)"
fi

# ---- one zip per extension (tree layout: unzip at the install root) ----
# 2.292.0 (Tim: "you can remove the extensions we are not working on, i
# will add them as needed"): EXTS names the extensions a release actually
# changed - only those get a zip (EXTS="videodock timelinedock", commas
# fine; EXTS=none builds no ext zip). Unset = every extension, as before.
# The FULL zip always carries every ext/ (it installs alone).
EXTS_SEL=" $(echo "${EXTS:-}" | tr ',' ' ') "
if [ -d ext ]; then
  for d in ext/*/; do
    id=$(basename "$d")
    [ -f "$d/ext.json" ] || continue
    if [ -n "${EXTS:-}" ] && [[ "$EXTS_SEL" != *" $id "* ]]; then continue; fi
    EZ="$OUT/bitgen-ext-${id}-v${VER}.zip"
    rm -f "$EZ"
    echo "$FILES" | grep "^ext/${id}/" | zip -q "$EZ" -@
    echo "built $EZ"
  done
fi
