# The bitGen pod image (2.900.0)

`ghcr.io/tim-byte-dev/bitgen-pod` — RunPod's PyTorch image with **ComfyUI, its Python environment, ComfyUI-Manager and the
node packs bitGen Studio's styles use most already installed**. A pod made from it is ready in a few minutes instead of the
10–15 minutes bitGen's own install takes on RunPod's plain PyTorch template.

GitHub builds it (`.github/workflows/pod-image.yml`) when these files or `lib/nodePacks.json` change, and every Monday (a
fresh ComfyUI). It is published to GitHub's registry, which keeps public images for free.

| File | What it does |
|---|---|
| `Dockerfile` | RunPod's PyTorch image (the first of `bases.txt` on Docker Hub), then `bake.sh`, then the two start scripts |
| `bases.txt` | RunPod PyTorch images to start from, CUDA 12.8 |
| `packs.txt` | the node packs baked in (ids from `lib/nodePacks.json`) |
| `bake.sh` | ComfyUI at `/workspace/ComfyUI`, its venv (reusing the image's PyTorch), the packs, bitGen's markers — then moved to `/opt/bitgen/ComfyUI` |
| `pre_start.sh` | first pod start: copies ComfyUI to the pod's disk (`/workspace/ComfyUI`); later starts leave it alone |
| `post_start.sh` | starts ComfyUI on port 8188 (not on a pod bitGen made — bitGen starts it with your PODS memory setting) |

The layout is the one `lib/podInstall.js` makes on a blank pod, so bitGen's install job finds every step done.

## The RunPod template

runpod.io ▸ **My Templates ▸ New Template**:

| Field | Value |
|---|---|
| Name | `bitGen Studio pod` |
| Type | Pod |
| Visibility | Public (or Private — bitGen finds it either way in your own account) |
| Container image | `ghcr.io/tim-byte-dev/bitgen-pod:latest` |
| Container disk | 50 GB |
| Volume disk | 50 GB (or more for models), mount path `/workspace` |
| HTTP ports | `8188, 8888` |
| TCP ports | `22` |
| Environment | `JUPYTER_PASSWORD` = any password (bitGen sets its own on the pods it makes) |

bitGen Studio picks it on its own (`lib/podImage.js`): your RunPod account's templates made from the image, the public
template once its id is in `lib/podImage.js` (`TEMPLATE_ID`), or the id in config `rgpu.bitgen_template`. Without it bitGen uses
RunPod's PyTorch template and installs ComfyUI itself, as before.

## Settings on the pod (environment variables)

| Variable | |
|---|---|
| `BITGEN_NO_COMFY=1` | do not start ComfyUI |
| `BITGEN_COMFY_ARGS="--lowvram"` | ComfyUI's arguments instead of bitGen's (`--disable-dynamic-vram --highvram` on 24 GB+ cards) |
| `BITGEN_START_COMFY=1` | start ComfyUI even on a pod bitGen made |

ComfyUI's output goes to `/workspace/.bitgen_comfy.log`.

## Tests

`python3 scripts/test-podimage900.py` runs the three scripts against stand-ins (no download, no graphics card);
`node scripts/test-900.js` tests how bitGen finds and uses the template. The workflow tries a real first start before it
publishes.
