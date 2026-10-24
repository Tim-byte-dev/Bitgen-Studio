#!/usr/bin/env bash
# check-brand.sh — the product is bitGen Studio; the MODEL is still MiniMax H3.
#
# THE MISTAKE THIS EXISTS TO CATCH. Renaming "H3 Studio" to "bitGen Studio"
# (2.124.0, by instruction) is a global text replace over 59 files, and the
# string "H3" appears throughout the codebase meaning something completely
# different: the MiniMax H3 MODEL. Its accelerator notes, its step defaults, its
# node-pack URLs and its workflow names all say H3 and all must keep saying it.
# A sweep one character too greedy turns
#     https://github.com/xmarre/ComfyUI-Spectrum-MiniMax-H3
# into a dead link and "H3-only" into a sentence about a product. Neither fails
# any other test.
#
# So this pins BOTH directions: the brand is gone, and the model is intact.
set -u
set -f
cd "$(dirname "$0")/.."
fails=0
note() { echo "  $1"; fails=$((fails + 1)); }
SKIP='--exclude-dir=node_modules --exclude-dir=.git --exclude-dir=venvs
      --exclude-dir=workspace --exclude-dir=projects --exclude-dir=output
      --exclude-dir=__pycache__ --exclude-dir=dist --exclude-dir=models'

# --- the brand is gone -----------------------------------------------------
# clear-comfy.bat deliberately still names the OLD folder: an install that has
# not been moved is still in one called h3-studio, and that regex is what stops
# the cleaner killing your own ComfyUI. It is the one allowed survivor.
# THREE allowed survivors, all deliberate, all named right here so that adding
# a fourth is a decision somebody has to make on purpose:
#   clear-comfy.bat      - its process matcher must keep excluding an install
#                          still living in a folder called h3-studio (see below)
#   scripts/check-brand.sh - this file, which names the old brand to explain it
#   HANDOVER.md          - the record of the rename; a handover that cannot say
#                          what the old name was is not a handover
#   HANDOVER-ARCHIVE.md  - (2.295.0) the older half of that same record, split
#                          out when project knowledge hit its size limit
hits=$(grep -rl $SKIP -e "H3 Studio" -e "h3-studio" . 2>/dev/null \
       | grep -v "^./misc/clear-comfy.bat$" \
       | grep -v "^./scripts/check-brand.sh$" \
       | grep -v "^./misc/HANDOVER.md$" \
       | grep -v "^./misc/HANDOVER-ARCHIVE.md$" || true)
[ -n "$hits" ] && note "the old product name survives in: $(echo "$hits" | tr '\n' ' ')"
grep -q "h3-studio" misc/clear-comfy.bat \
  || note "misc/clear-comfy.bat no longer excludes an install still in an h3-studio folder"

# --- the MODEL is intact ---------------------------------------------------
for needle in "MiniMax H3" "ComfyUI-Spectrum-MiniMax-H3" "H3-only" "minimax-h3"; do
  grep -rq $SKIP -e "$needle" . 2>/dev/null \
    || note "\"$needle\" is gone — the rebrand ate a MiniMax H3 reference"
done
grep -rq $SKIP -e "github.com/xmarre/ComfyUI-Spectrum-MiniMax-H3" . 2>/dev/null \
  || note "the Spectrum node-pack URL is broken"

# --- the licence -----------------------------------------------------------
[ -f LICENSE ] || note "there is no LICENSE file"
grep -q "MIT License" LICENSE 2>/dev/null || note "LICENSE is not the MIT text"
[ -f misc/NOTICE.md ] || note "there is no misc/NOTICE.md explaining the third-party position"
node -e 'process.exit(require("./package.json").license === "MIT" ? 0 : 1)' \
  || note "package.json does not declare the MIT licence"
node -e 'process.exit(require("./electron/package.json").license === "MIT" ? 0 : 1)' \
  || note "electron/package.json does not declare the MIT licence"
# A licence nobody receives is not a licence: both must be in the release zips.
for f in LICENSE NOTICE.md; do
  grep -q "\"./$f\"" scripts/make_zips.sh 2>/dev/null \
    && note "make_zips.sh EXCLUDES $f — it must ship"
done
grep -qxF "LICENSE" .gitignore 2>/dev/null && note "LICENSE is gitignored"

if [ "$fails" -gt 0 ]; then
  echo "check-brand: $fails problem(s)"
  exit 1
fi
echo "check-brand: bitGen Studio throughout, MiniMax H3 intact, MIT declared"
