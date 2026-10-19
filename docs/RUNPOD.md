# Rendering on a RunPod GPU

Two routes. Both work: a pod running plain ComfyUI (zero configuration
beyond a URL), or a Serverless worker-comfyui endpoint via the built-in
adapter (2.197.0). Read the serverless constraints before choosing.

## Route 1 — a RunPod Pod running ComfyUI (works today, recommended for H3)

The app talks to ComfyUI over plain HTTP + websockets at `engine.comfy.url`
(Settings → ComfyUI). Nothing in the render path requires that URL to be
local — the whole e2e suite renders through a remote, non-spawned ComfyUI —
and the app only manages ComfyUI instances IT started, so a remote one is
left alone.

1. On RunPod, create a **Pod** (a 4090/5090 or an A-series card with the
   VRAM your H3 quant needs) with a **Network Volume** big enough for the
   models (the GGUFs, encoders, VAE — tens of GB).
2. Install ComfyUI on the pod plus the custom node pack the chain needs:
   `comfyui-minimaxh3-contex-loop` (and anything else your style's graph
   references — the render log's "pruned/served" lines name every
   class_type). Put the models on the volume in ComfyUI's model folders.
3. Expose port 8188 (HTTP proxy). The pod gives you a URL like
   `https://<pod-id>-8188.proxy.runpod.net`.
4. In bitGen Studio: Settings → ComfyUI → url = that proxy URL, and do NOT
   press Start ComfyUI (the pod is already running it). Leave "VRAM clear
   before generation" off — that endpoint frees the POD's memory, which is
   fine, but pressing local start/stop does nothing to the pod.
5. Render as normal. Reference images/audio upload over the same API; takes
   download back the same way. Expect upload time for the first render of a
   session (sheets, panos, voice refs travel to the pod).

Billing: per-second while the pod runs. Stop the pod when done; the network
volume keeps the models so the next start is minutes, not hours.

## Route 2 — RunPod Serverless ("Flash" = Flashboot fast cold-start)

The standard `worker-comfyui` serverless endpoint speaks a DIFFERENT
protocol than ComfyUI itself:

- `POST https://api.runpod.ai/v2/<endpoint>/run` (async; poll
  `/status/<id>`) or `/runsync` (short jobs only), with
  `Authorization: Bearer <api key>`
- body `{"input": {"workflow": <API-format graph>,
  "images": [{"name": "...", "image": "<base64>"}]}}` — inputs are written
  into ComfyUI's input folder by name
- output: `{"status": "COMPLETED", "output": {"images": [{filename,
  type: "base64"|"s3_url", data}]}}`

What that means for THIS app, honestly:

1. **An adapter is required.** worker.py uploads refs, queues, follows the
   websocket for per-node progress, and downloads outputs — all of that
   must be replaced with: base64-pack the refs into the request, POST /run,
   poll /status, decode/download outputs. Live per-node progress is gone;
   the console shows poll status instead.
2. **Request size caps: ~10 MB on /run, ~20 MB on /runsync.** Our chain
   ships 6 images + 2 audio refs; base64 inflates by 4/3. Big sheets or
   long voice refs can blow the cap — refs may need downscaling/trimming,
   or a volume-based flow instead of inline base64.
3. **Video out wants S3.** A 15 s take can be tens of MB; configure the
   worker's S3 upload rather than base64-in-response.
4. **A custom worker image + network volume.** The stock image knows
   nothing of the H3 context-loop pack; bake the pack into the image and
   put the models on a volume. Flashboot then makes cold starts short, but
   the FIRST model load into VRAM still takes its real time per cold
   worker.
5. **Long renders are fine** if the endpoint's execution timeout is raised
   past your longest chain.

Serverless is worth it when renders are OCCASIONAL (pay only seconds used,
no pod to remember to stop). For iterating on a film — many renders back to
back — Route 1 is cheaper in wall-clock and attention.

### Using the built-in adapter (2.197.0)

Set in settings (custom.settings / POST /api/config):

    "engine": { "runpod": { "enabled": true,
                            "endpoint": "<your endpoint id>",
                            "api_key": "<your RunPod API key>",
                            "poll_seconds": 5 } }

Then render as normal. The worker builds the exact same graph it would
queue locally (style, patches, bypass, widget overrides, audio census,
sampler diagnosis all still run), rides the reference files inside the
request as base64 (hard-failing with the file list if they exceed the
~10 MB /run cap), submits to /run, polls /status with progress lines in
the job console, and writes the returned outputs locally — segment vs
assembled-film preference works exactly as it does locally, because each
returned file is mapped back to its save node by filename_prefix. Checks
that need a live ComfyUI (preflight, schema sync, continuity check, accel
preflight, VRAM clear) are skipped, each with a note. Failures name the
RunPod status and point at the endpoint's own console logs. Set
engine.runpod.enabled back to false to render locally again.

Your endpoint must be a worker-comfyui image CUSTOMIZED with the
MiniMax H3 context-loop pack and the models on a network volume — the
stock Hub listing only knows FLUX.
