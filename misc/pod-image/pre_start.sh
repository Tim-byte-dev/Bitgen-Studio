#!/bin/bash
# bitGen Studio — the bitGen pod image, BEFORE RunPod starts Jupyter (2.900.0). RunPod's start script (/start.sh of its
# PyTorch images) runs /pre_start.sh, then SSH + Jupyter, then /post_start.sh.
#
# RunPod mounts the pod's disk over /workspace, hiding what the image put there, so the ComfyUI baked into the image
# (/opt/bitgen/ComfyUI, misc/pod-image/bake.sh) is copied to /workspace/ComfyUI on the pod's FIRST start - a local copy,
# about a minute, instead of the 10-15 minute install. Later starts find it there and leave it alone: models, node packs and
# updates bitGen made on the pod stay (they are on the pod's disk). A /workspace/ComfyUI that is not a ComfyUI (no main.py)
# is moved aside, never deleted.
#   POD_ROOT       tests: everything under this folder instead of /
set -uo pipefail
ROOT="${POD_ROOT:-}"
SEED="$ROOT/opt/bitgen/ComfyUI"
W="$ROOT/workspace"
D="$W/ComfyUI"
say() { echo "[bitgen-pod] $*"; }

mkdir -p "$W"
if [ -f "$D/main.py" ]; then
  say "ComfyUI is already on the pod's disk ($D) - left as it is"
elif [ ! -f "$SEED/main.py" ]; then
  say "no ComfyUI in the image ($SEED) - bitGen Studio installs it when it first uses the pod"
else
  if [ -e "$D" ]; then
    aside="$D.before-bitgen-$(date +%Y%m%d-%H%M%S)"
    say "$D is not a ComfyUI - moved aside to $aside"
    mv "$D" "$aside"
  fi
  say "copying ComfyUI to the pod's disk ($D) - the first start only"
  t0=$(date +%s)
  cp -a "$SEED" "$D.copying" && mv "$D.copying" "$D"
  say "copied in $(( $(date +%s) - t0 )) s"
fi
# bitGen's Jupyter kernels may run in / or /workspace (RunPod's images differ): its ComfyUI log reachable from both
touch "$W/.bitgen_comfy.log"
[ -e "$ROOT/.bitgen_comfy.log" ] || ln -s "$W/.bitgen_comfy.log" "$ROOT/.bitgen_comfy.log" 2>/dev/null || true
exit 0
