#!/bin/bash
# bitGen Studio — the bitGen pod image, BUILD STEP (2.900.0): ComfyUI, its Python environment, ComfyUI-Manager and the node
# packs bitGen's styles use most, installed INTO THE IMAGE - so a pod made from the bitGen template is ready in minutes
# instead of the 10-15 minutes bitGen's own install takes on RunPod's plain PyTorch template.
#
# Tim: "is it possible to create a community template for bitgen-studio in runpod?" -> "yes please" (a ready-made bitGen pod)
#
# The SAME layout lib/podInstall.js makes on a blank pod, so bitGen sees every step as done:
#   /workspace/ComfyUI                ComfyUI (a git checkout - bitGen reads its commit)
#   /workspace/ComfyUI/venv           its own Python environment, REUSING the image's PyTorch (--system-site-packages)
#   /workspace/ComfyUI/.bitgen_pip_ok the commit its requirements were installed for (lib/podInstall.js, podComfyUpdate.js)
#   /workspace/ComfyUI/.bitgen_install.json   {by: "bitGen", version, at, python, image}
# Built at /workspace/ComfyUI (so every path inside it is the one it runs at) and then moved to /opt/bitgen/ComfyUI: RunPod
# mounts the pod's disk OVER /workspace, hiding what an image put there - pre_start.sh copies it back on the pod's first start.
#
# Run by the Dockerfile with the repo's lib/nodePacks.json + misc/pod-image/packs.txt next to it. Environment:
#   COMFY_REPO / COMFY_REF   where ComfyUI comes from (default: its GitHub, the newest commit)
#   BITGEN_IMAGE             the image's own name + tag (written into .bitgen_install.json)
#   POD_HERE                 a folder holding packs.txt + nodePacks.json (default: this script's folder)
#   POD_ROOT                 build under this folder instead of / (tests: the stand-in runs it in a temporary folder)
#   POD_SKIP_TEST=1          no ComfyUI start-up test at the end (tests)
set -euo pipefail
HERE="${POD_HERE:-$(cd "$(dirname "$0")" && pwd)}"
ROOT="${POD_ROOT:-}"
D="$ROOT/workspace/ComfyUI"
SEED="$ROOT/opt/bitgen"
COMFY_REPO="${COMFY_REPO:-https://github.com/comfyanonymous/ComfyUI}"
PY="$(command -v python3 || command -v python)"
say() { echo "[bitgen-pod] $*"; }

say "Python: $($PY --version 2>&1)"
$PY -c 'import torch; print("[bitgen-pod] PyTorch", torch.__version__, "CUDA", torch.version.cuda)' || say "no PyTorch in the image - ComfyUI's requirements install it"

# ---- ComfyUI
mkdir -p "$(dirname "$D")"
if [ -n "${COMFY_REF:-}" ]; then
  git clone --depth 1 --branch "$COMFY_REF" "$COMFY_REPO" "$D"
else
  git clone --depth 1 "$COMFY_REPO" "$D"
fi
HEAD="$(git -C "$D" rev-parse HEAD)"
VER="$(sed -n 's/^__version__ *= *["'\'']\([^"'\'']*\)["'\''].*/\1/p' "$D/comfyui_version.py" 2>/dev/null | head -1)"
say "ComfyUI ${VER:-?} ($HEAD)"

# ---- its Python environment (the image's PyTorch reused - no second multi-GB download)
$PY -m venv --system-site-packages "$D/venv"
VPY="$D/venv/bin/python"
"$VPY" -m pip install --no-cache-dir --progress-bar off -r "$D/requirements.txt"
echo "$HEAD" > "$D/.bitgen_pip_ok"

# ---- the node packs (each on its own: one that will not install is noted, the rest go on - bitGen installs a missing one
#      on the pod when a style needs it)
mkdir -p "$D/custom_nodes"
PACKS_OK=(); PACKS_FAILED=()
while read -r id; do
  id="${id%%#*}"; id="$(echo "$id" | tr -d '[:space:]')"
  [ -z "$id" ] && continue
  line="$($PY - "$HERE/nodePacks.json" "$id" <<'PYEOF'
import json, sys
packs = json.load(open(sys.argv[1]))["packs"]
p = next((x for x in packs if x["id"] == sys.argv[2]), None)
print((p["folder"] + "\t" + p["url"]) if p and p.get("url", "").startswith("https://github.com/") else "")
PYEOF
)"
  if [ -z "$line" ]; then say "pack $id: not in lib/nodePacks.json (or not on GitHub) - left out"; PACKS_FAILED+=("$id"); continue; fi
  folder="${line%%$'\t'*}"; url="${line#*$'\t'}"
  say "pack $id: $folder from $url"
  if ! git clone --depth 1 "$url" "$D/custom_nodes/$folder"; then say "pack $id: the clone did not work"; PACKS_FAILED+=("$id"); continue; fi
  if [ -f "$D/custom_nodes/$folder/requirements.txt" ]; then
    if ! "$VPY" -m pip install --no-cache-dir --progress-bar off -r "$D/custom_nodes/$folder/requirements.txt"; then
      say "pack $id: its requirements did not install"; PACKS_FAILED+=("$id"); continue
    fi
  fi
  PACKS_OK+=("$folder")
done < "$HERE/packs.txt"
say "packs in: ${PACKS_OK[*]:-none}; left out: ${PACKS_FAILED[*]:-none}"

# ---- the marker bitGen reads (the same one lib/podInstall.js writes)
$PY - "$D" "$VER" "$VPY" "${BITGEN_IMAGE:-ghcr.io/tim-byte-dev/bitgen-pod}" "$HEAD" "${PACKS_OK[*]:-}" "${PACKS_FAILED[*]:-}" <<'PYEOF'
import json, sys, time
d, ver, vpy, image, head, ok, bad = sys.argv[1:8]
json.dump({"by": "bitGen", "version": ver, "at": time.time(), "python": vpy, "image": image, "commit": head,
           "packs": ok.split(), "packs_left_out": bad.split()}, open(d + "/.bitgen_install.json", "w"))
PYEOF

# ---- does it start? (CPU only - the build machine has no graphics card; it loads every node pack and stops)
if [ "${POD_SKIP_TEST:-}" != "1" ]; then
  say "start-up test (ComfyUI --cpu --quick-test-for-ci)"
  ( cd "$D" && "$VPY" main.py --cpu --quick-test-for-ci 2>&1 | tee /tmp/bitgen-quicktest.log ) || { say "ComfyUI did not start"; exit 1; }
  if grep -q "IMPORT FAILED" /tmp/bitgen-quicktest.log; then say "a node pack did not load:"; grep -B1 "IMPORT FAILED" /tmp/bitgen-quicktest.log || true; fi
  rm -rf "$D/user" "$D/temp" "$D/output" /tmp/bitgen-quicktest.log
fi

# ---- smaller image: no caches; then out of /workspace (RunPod mounts the pod's disk there)
find "$D" -name __pycache__ -type d -prune -exec rm -rf {} + 2>/dev/null || true
[ -z "$ROOT" ] && rm -rf /root/.cache/pip 2>/dev/null || true
mkdir -p "$SEED"
mv "$D" "$SEED/ComfyUI"
echo "$HEAD" > "$SEED/comfy-commit.txt"
say "baked into $SEED/ComfyUI - copied to /workspace/ComfyUI on the pod's first start"
