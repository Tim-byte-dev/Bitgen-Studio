#!/bin/bash
# bitGen Studio — the bitGen pod image, AFTER RunPod has started SSH + Jupyter (2.900.0): ComfyUI started on port 8188.
#
# The way bitGen Studio starts it (lib/podInstall.js): /workspace/ComfyUI's own Python, --listen 0.0.0.0 --port 8188, its log
# /workspace/.bitgen_comfy.log, as its OWN process in the background (never the pod's main process - bitGen restarts it with
# other settings: lib/podVram.js). On a card with 24 GB or more the models are kept on the card (--disable-dynamic-vram
# --highvram, when this ComfyUI knows them) - bitGen's default (PODS ▸ GPU memory changes it later).
# A pod bitGen made (BITGEN_MADE=1, lib/pods.js createBody) is left to bitGen: its install job finds every step done and
# starts ComfyUI itself, with the GPU-memory setting chosen in PODS - two starts at once would fight over port 8188.
# Anyone using the template without bitGen gets a working ComfyUI on port 8188.
#   BITGEN_NO_COMFY=1       do not start ComfyUI (bitGen starts it when it uses the pod)
#   BITGEN_START_COMFY=1    start it even on a pod bitGen made
#   BITGEN_COMFY_ARGS="…"   other arguments instead of bitGen's (e.g. "--lowvram")
#   POD_ROOT / POD_NO_GPU_GB tests
set -uo pipefail
ROOT="${POD_ROOT:-}"
D="$ROOT/workspace/ComfyUI"
LOG="$ROOT/workspace/.bitgen_comfy.log"
PORT=8188
say() { echo "[bitgen-pod] $*"; }

if [ "${BITGEN_NO_COMFY:-}" = "1" ]; then say "BITGEN_NO_COMFY=1 - ComfyUI not started"; exit 0; fi
if [ "${BITGEN_MADE:-}" = "1" ] && [ "${BITGEN_START_COMFY:-}" != "1" ]; then say "made by bitGen Studio - it starts ComfyUI when it uses the pod"; exit 0; fi
if [ ! -f "$D/main.py" ]; then say "no ComfyUI in $D - not started (bitGen Studio installs it when it first uses the pod)"; exit 0; fi
PY="$D/venv/bin/python"; [ -x "$PY" ] || PY="$(command -v python3 || command -v python)"
if curl -s -m 3 "http://127.0.0.1:$PORT/system_stats" 2>/dev/null | grep -q '"system"'; then say "ComfyUI already answers on port $PORT"; exit 0; fi

if [ -n "${BITGEN_COMFY_ARGS:-}" ]; then
  read -ra EXTRA <<< "$BITGEN_COMFY_ARGS"
else
  EXTRA=()
  GB="${POD_NO_GPU_GB:-$(nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits 2>/dev/null | sort -n | head -1)}"
  GB="${GB%%.*}"
  if [ -n "$GB" ] && [ "$GB" -ge $((24 * 1024)) ] 2>/dev/null; then
    grep -q -- "--disable-dynamic-vram" "$D/comfy/cli_args.py" 2>/dev/null && EXTRA+=("--disable-dynamic-vram")
    grep -q -- "--highvram" "$D/comfy/cli_args.py" 2>/dev/null && EXTRA+=("--highvram")
  fi
fi
say "starting ComfyUI on port $PORT ${EXTRA[*]:-} (log: $LOG)"
cd "$D" || exit 0
setsid "$PY" main.py --listen 0.0.0.0 --port "$PORT" "${EXTRA[@]}" >> "$LOG" 2>&1 < /dev/null &
say "ComfyUI started (pid $!)"
exit 0
