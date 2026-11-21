# The bitGen pod image (2.900.1)

`ghcr.io/tim-byte-dev/bitgen-pod` — RunPod's PyTorch image with **ComfyUI, its Python environment, ComfyUI-Manager and the
node packs bitGen Studio's styles use most already installed**. A pod made from it is ready in a few minutes instead of the
10–15 minutes bitGen's own install takes on RunPod's plain PyTorch template.

## Setting up the RunPod template

### 1. Make the image public (once)

RunPod can only download the image when it is public. GitHub makes a new package private:

github.com → your profile → **Packages** → **bitgen-pod** → **Package settings** → Danger Zone → **Change visibility** →
**Public**.

### 2. RunPod ▸ My Templates ▸ New Template

The fields in the order RunPod's form shows them:

| Field | What to put |
|---|---|
| **Template name** | `bitGen Studio pod` |
| **Template type** | **Pod** (not Serverless) |
| **Compute type** | **Nvidia GPU** |
| **Public template** | On to share it with every RunPod user (it costs you nothing; RunPod's creator programme pays 1 % in credits once people use it). Off = only your account - bitGen finds it either way |
| **Container image** | `ghcr.io/tim-byte-dev/bitgen-pod:latest` |
| **Container image validation** | Nothing to add - no registry credentials, the image is public. If RunPod says it cannot find or pull the image, step 1 is not done yet |
| **Container disk** | `50` GB |
| **Persistent storage** | `50` GB or more (your models live here), mounted at `/workspace` |
| **Expose HTTP ports** | `8188, 8888` (ComfyUI, Jupyter) |
| **Expose TCP ports** | `22` (SSH) |
| **Environment variables** | `JUPYTER_PASSWORD` = any password (bitGen sets its own on the pods it makes) |

Then **Save template**.

**About the `:latest` warning:** RunPod warns about `:latest` because the image behind it can change. Here that is the point -
GitHub rebuilds the image every Monday with the newest ComfyUI, and a new pod gets it. To freeze a pod on one build, use a
dated tag instead, e.g. `ghcr.io/tim-byte-dev/bitgen-pod:20261121` (each build is kept under its date). bitGen recognises the
template by the image name, whatever the tag.

### 3. In bitGen Studio

Nothing to type. bitGen finds a template made from this image in your RunPod account (or the id set in config
`rgpu.bitgen_template`) and uses it for **PODS ▸ Create pod…** and the box that asks which pod renders a style, before
RunPod's PyTorch template. Without it bitGen installs ComfyUI on RunPod's PyTorch template as before.

## What happens on a pod

- **First start:** ComfyUI is copied from the image to the pod's disk (`/workspace/ComfyUI`, about a minute). bitGen's
  install steps then all say *already there*; it only starts ComfyUI with your GPU-memory setting.
- **Later starts:** everything on the pod's disk is kept - models, node packs, updates.
- **Without bitGen:** ComfyUI starts on port 8188 by itself. Its log is `/workspace/.bitgen_comfy.log`.

### Settings on the pod (environment variables)

| Variable | |
|---|---|
| `BITGEN_NO_COMFY=1` | do not start ComfyUI |
| `BITGEN_COMFY_ARGS="--lowvram"` | ComfyUI's arguments instead of bitGen's (`--disable-dynamic-vram --highvram` on 24 GB+ cards) |
| `BITGEN_START_COMFY=1` | start ComfyUI even on a pod bitGen made |

## How the image is made

GitHub builds it (`.github/workflows/pod-image.yml`) when these files or `lib/nodePacks.json` change, every Monday, or by
hand (Actions ▸ pod image ▸ Run workflow). It is published only after a test start on an empty disk: ComfyUI copied in, its
Python environment still on the image's PyTorch, every node pack loading.

| File | What it does |
|---|---|
| `Dockerfile` | RunPod's PyTorch image (the first of `bases.txt` on Docker Hub), then `bake.sh`, then the two start scripts |
| `bases.txt` | RunPod PyTorch images to start from, CUDA 12.8 |
| `packs.txt` | the node packs baked in (ids from `lib/nodePacks.json`) |
| `bake.sh` | ComfyUI at `/workspace/ComfyUI`, its venv (reusing the image's PyTorch, every install held to it), the packs, bitGen's markers — then moved to `/opt/bitgen/ComfyUI` |
| `pre_start.sh` | first pod start: copies ComfyUI to the pod's disk; later starts leave it alone |
| `post_start.sh` | starts ComfyUI on port 8188 (not on a pod bitGen made — bitGen starts it with your PODS memory setting) |

The layout is the one `lib/podInstall.js` makes on a blank pod, so bitGen's install job finds every step done.

## Tests

`python3 scripts/test-podimage900.py` runs the three scripts against stand-ins (no download, no graphics card);
`node scripts/test-900.js` tests how bitGen finds and uses the template.
