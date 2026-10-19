# bitGen Studio — technical reference

> The engineering notes and the full changelog behind bitGen Studio: how the
> frame planner, the ComfyUI integration, the styles, the queue and every
> feature were built and why. Sections are dated by the version that
> introduced them, so some early material (the sd-cli engine, the 4n+1 grid)
> describes the original engine. For installing and using the app, read
> [INSTALL.md](INSTALL.md) and [USAGE.md](USAGE.md).


Self-hosted video generator/editor for **MiniMax H3** (GGUF) via
**stable-diffusion.cpp**. Node.js serves the UI/API and owns the job queue; a
Python worker builds, validates and runs each sd-cli job. No accounts, no
cloud, nothing leaves the machine.

```
browser ── server.js (minimal entry — logic lives in lib/ + routes/)
              ├─ spawns: python -u worker.py <job.json>          (VIDEO)
              │             └─ spawns: sd-cli … (streams log lines back up)
              ├─ spawns: python -u image_worker.py <job.json>    (IMAGES)
              │             └─ spawns: sd-cli --mode img_gen …  (or ComfyUI)
              └─ spawns: python -u music_worker.py <job.json>    (MUSIC)
                            └─ ComfyUI only: MiniMax Music3 → sound/
```

- Reference-to-video (**ref2va**): up to 9 ordered reference images
  (`<Picture 1>`…`<Picture 9>`), plus reference video/audio
- First/last-frame (**fl2va**), text-to-video (**t2va**), native 32 kHz audio
- **Still images** with named styles (FLUX.1, FLUX.2 klein 9B, SDXL, Z-Image,
  Qwen-Image) and LoRA stacks — see the 2.66.0 changelog entry
- **Music** with named styles (MiniMax Music3 through ComfyUI): the prompt is
  the lyrics, the style is the caption — see the 2.90.0 changelog entry
- Projects (assets, timeline, Compile), ✨ Enhance LLM (llama.cpp), job queue,
  live console, system stats, inline player

## Generation tools (the 4n+1 planner)

H3 is fixed **24 fps**, valid frame counts sit on the **4n+1 grid**
(5, 9, …, 121, …, 361), and a single run tops out at **361 frames (15.04 s)**.

* **Auto (default)** — resolves to **ONE generation** whenever the target fits
  the ceiling. **15 s → 360 frames → one 361-frame run → trim 1 → exactly
  360 f / 15.00 s**, full character consistency. Only past 15.04 s does it
  fall back to chunking.
* **Single** — one run, ≤ 361 frames, exact trim.
* **Chunked** — fl2va hand-off from each chunk's true last frame, the seam
  duplicate is dropped at join time, **audio is preserved through every join**
  (H3 generates audio jointly), a joined preview updates in the player after
  every chunk, and the final join trims to the exact requested duration.
  "Max seconds per segment" maps to the largest valid 4n+1 chunk (15 → 361).
  Character identity can drift between chunks — the hand-off carries only one
  frame; that's why Auto avoids chunking whenever it can.
* **PNG rebuild** — chunks exploded to PNGs, seam PNGs dropped, sequence
  renumbered and rebuilt frame-exact at 24 fps; audio muxed back from the
  seam-dropped join.

Worker log lines `[worker] ===== chunk i/N` and
`[worker] joined preview updated` are a **stable protocol** — the UI's
progress and preview-reload logic parse them. Do not change them.

## Images and styles (Settings → Image)

Images render through **ComfyUI by default** — the same ComfyUI this app already
drives for video. **stable-diffusion.cpp is not required to generate images**;
sd-cli remains a per-style alternative for anyone who has it set up.

A **style** is a saved renderer + workflow (+ optional model overrides) +
sampler settings + LoRA stack under one name, so the **Style** dropdown beside
the prompt can reproduce a look without retyping anything. Press
**🖼 Generate Image** to render one, or up to 8 at a time.

### Ready-made styles

A fresh install ships with two working styles for **FLUX.2 [Klein] 9B**, built
from ComfyUI's own published template:

| Style | Checkpoint | cfg / steps |
| --- | --- | --- |
| FLUX.2 Klein 9B | `flux-2-klein-9b-fp8.safetensors` | 1.0 / 4 (distilled) |
| FLUX.2 Klein 9B base | `flux-2-klein-base-9b-fp8.safetensors` | 5.0 / 20 (undistilled) |
| FLUX.2 Klein 9B edit | `flux-2-klein-base-9b-fp8.safetensors` | 5.0 / 20 (image edit) |

Put the models in **ComfyUI's own** folders and they work as they are:

```
ComfyUI/models/diffusion_models/flux-2-klein-9b-fp8.safetensors
ComfyUI/models/diffusion_models/flux-2-klein-base-9b-fp8.safetensors
ComfyUI/models/text_encoders/qwen_3_8b_fp8mixed.safetensors
ComfyUI/models/vae/flux2-vae.safetensors
```

**Image editing.** The *edit* style takes up to **three reference pictures**
from the Refs dock: put them there, write what you want changed, and press
Generate Image. Each reference is scaled to 1 MP, VAE-encoded and chained into
the guider as a `ReferenceLatent` pair, exactly as ComfyUI's own template does.
The output keeps the **source picture's dimensions**, so the style's width and
height are deliberately ignored. With no picture in the dock the button says so
rather than failing at ComfyUI — there would be nothing to edit and nothing to
take the size from. Unused image slots are removed from the graph along with
the scale/encode/reference nodes behind them, and the conditioning chain is
rewired around the gap.

All three templates carry **four LoRA slots, shipped bypassed**. Add a LoRA to the
style and the next slot is filled; leave a slot unused and it is removed from
the graph, with model and CLIP passed straight through, before the graph is
queued. (An empty `lora_name` is not a no-op in ComfyUI — it fails validation —
so the slots must be either filled or gone.) A fifth LoRA builds a new node.

The starters are written **once**, on first run. Delete one and it stays
deleted; rename or edit one and it is yours. A style you have already created
with the same name is never overwritten.

Note the distilled template has **no real negative prompt**: it feeds the
positive conditioning through `ConditioningZeroOut`, which is what a distilled
model uses instead. bitGen Studio detects that and refuses to write a negative
prompt into it — doing so would replace your prompt and render *that*. Use the
**base** style when you want a negative prompt that does something.

### ComfyUI styles (the default)

Point the style at an **Export (API)** workflow: in ComfyUI open or build the
graph you want (its Template Library has one per model), then
**Workflow → Export (API)** and save the file. That is all a style needs — the
workflow already names its own models.

On every render bitGen Studio patches your prompt, negative prompt, seed, steps,
cfg, width/height and batch size into a copy of that graph, and **builds the
style's LoRA stack into it** as `LoraLoader` nodes, so the exported workflow
needs no LoRA nodes of its own. Your file on disk is never modified.

The patching is **structural**: it finds the sampler by the fact that something
takes both a positive and a negative conditioning, finds the prompt by walking
upstream from there, finds the image size by following the sampler's latent
input. It matches on ComfyUI's *input names* (`ckpt_name`, `seed`, `steps`,
`width`), never on node class names, which is why it works on a plain SDXL
KSampler graph and equally on the FLUX shape that splits sampling across
`RandomNoise` + `BasicScheduler` + `SamplerCustomAdvanced` with no negative
prompt at all.

It refuses rather than guesses when guessing would be invisible:

- **two text prompts with no sampler wiring** to say which is positive — getting
  that backwards renders your negative prompt as the subject and looks like a
  bad model, not a bug;
- **an override that has nowhere to go** (a VAE override on a workflow with no
  VAE loader) — silently using the workflow's own model gives you a perfect
  picture of the wrong thing;
- **a UI workflow export instead of an API one** — the file most people reach
  for first, named as such instead of failing on a missing key.

The style's Model / VAE / text-encoder fields are **optional overrides**, and in
ComfyUI mode they are *dropdown values from ComfyUI's own model folders*, not
paths on this machine — the labels say so, and no file picker is offered for
them. Blank means "use whatever the workflow already loads". LoRA names are
likewise as ComfyUI lists them, relative to its own `loras` folder
(`flux/grain.safetensors`), and a batch is one queued prompt with `batch_size`,
not N round trips.

### sd-cli styles

Set **Rendered by** to sd-cli to drive stable-diffusion.cpp directly instead.
Here the fields *are* paths on this machine, LoRAs are `<lora:name:weight>`
tokens resolved against the LoRA folder in Settings → Paths, and the
architecture table below decides the flags.

| Architecture | Model flag | Text encoder |
| --- | --- | --- |
| FLUX.1 (dev/schnell) | `--diffusion-model` | `--clip_l` + `--t5xxl` |
| FLUX.2 klein 9B | `--diffusion-model` | `--llm` (Qwen3-8B) |
| SDXL / SDXL-Turbo | `-m` (full checkpoint) | usually built in |
| Z-Image (Turbo/Base) | `--diffusion-model` | `--llm` (Qwen3-4B) |
| Qwen-Image | `--diffusion-model` | `--llm` (Qwen2.5-VL 7B) |

(That table applies to **sd-cli** styles. A ComfyUI style gets its models from
its workflow instead.) Every architecture's flags, defaults and slot labels live in **one** file,
`lib/imageArch.json`, read by the Settings dropdown, the validator and the
command builder alike. stable-diffusion.cpp states in its own README that
command-line options change frequently: if a flag is renamed upstream, edit
that file, or override per style with **Extra sd-cli args**.

Each style is its own file, `styles\<style name>.json`, so you can read one,
edit it by hand, copy it to another install or back it up on its own. The name
is the filename, so names must be unique — a clash is refused rather than
overwriting somebody's style. Renaming a style moves its file and keeps its
identity, so a saved selection still points at the same style. A file dropped
into the folder by hand is picked up on the next read, and one unparseable file
is skipped rather than emptying the whole list.

LoRAs are passed as sd.cpp's `<lora:name:weight>` tokens and resolved against
the LoRA folder in Settings → Paths. **A weight of 0 means "off but still in
the stack"** and is preserved everywhere, as are a `cfg` of 0 and a
`clip_skip` of 0 — a legitimate zero is never quietly replaced by a default.

Generated stills land in `projects\<project>\output\`, appear in the gallery's
**Images** tab, and are hard-linked into the **Images** asset column so they can
be dragged onto the timeline. Images run through `image_worker.py`; the video
worker is not involved and none of the frame-grid rules apply.

### Picking models in comfy mode (2.71.0)

When a style is **Rendered by ComfyUI**, its Model / VAE / text-encoder / LoRA
fields are not paths on this machine — they are the strings from ComfyUI's own
dropdowns, resolved inside ComfyUI's own models folders. Typing one by hand is
how you get `Value not in list` with no clue why, so those fields are dropdowns
of what ComfyUI can actually load:

- **The list comes from ComfyUI itself when it is running.** `/object_info` is
  literally what its dropdowns hold, including anything a custom node
  registered, so a name picked from it cannot be rejected. The line under the
  fields says which source you are looking at.
- **When ComfyUI is not running** — which is often, since Settings is where you
  configure things *before* starting it — the list is derived from
  `<ComfyUI>\models\…` **and** every search path in `extra_model_paths.yaml`,
  and says that it is derived.
- **Folder filters** sit beside the Model and LoRA dropdowns, with **All
  folders** first. The Model filter also names the category, because the Model
  field spans `checkpoints`, `diffusers` *and* `diffusion_models` at once — the
  workflow's loader node decides which kind it needs, and one dropdown covers
  all three so nobody has to know which.
- **Diffusers models are folders, and are listed as folders.** ComfyUI's
  `DiffusersLoader` offers the directory containing `model_index.json`, so that
  is what appears; the weights *inside* one are never offered as models of their
  own. They are their own category rather than being folded into checkpoints,
  because `CheckpointLoaderSimple`'s live dropdown does not contain them and
  folding them in would make the live list erase them.
- The **📁** button opens a browser over the same list, with a name filter, the
  category and — for anything that came from the yaml — the group that added it,
  so a surprising entry can be traced back to the line responsible.
- **⟳** rescans. The list is cached for 30 seconds and re-read automatically
  whenever `extra_model_paths.yaml` changes.
- A value already saved in a style that the scan cannot find is **kept and
  marked "not found"**, never quietly replaced. If a model moved, you are told;
  your style is not rewritten behind your back.
- **Every model file in a folder is listed**, judged by ComfyUI's own
  `supported_pt_extensions` (`.ckpt .pt .pt2 .bin .pth .safetensors .pkl .sft`,
  plus `.gguf` and `.onnx` for the custom loaders). A file ComfyUI will load
  cannot be missing from a dropdown; a README sitting in the VAE folder cannot
  appear in one.
- `unet` and `diffusion_models`, and `clip` and `text_encoders`, are treated as
  one category each — ComfyUI renamed them and still accepts both.

If the dropdowns are empty, the line under them says why (no ComfyUI folder set,
the folder does not exist, a yaml that could not be parsed). An empty dropdown
never means "you own no models" without saying so.

**▶ Start ComfyUI & scan models** sits under the model fields. It launches
ComfyUI from the folder set in **Settings → ComfyUI** (there is deliberately no
second folder box here — one setting, one place), streams the startup output
into the app console, waits for the API, then re-reads the model folders so the
dropdowns fill without leaving the dialog. Once ComfyUI is up the same button
becomes **⟳ Rescan model folders**, so it always says which of its two jobs it
is about to do. Unlike the button on the ComfyUI tab it does *not* close
Settings — the point of pressing it here is to watch the dropdowns fill. If you
have just changed the ComfyUI folder, save it on that tab first.

Styles rendered by **sd-cli** are unchanged: those fields are real paths on this
machine and keep their plain text box and local file picker, and the launch
button is hidden for them.

### Generate Image starts ComfyUI for you (2.73.0)

If the selected style is rendered by ComfyUI and ComfyUI is not answering,
**Generate Image** launches it, streams the startup output into the app console,
waits for the API, and then submits — the button reads `⏳ starting ComfyUI…`
meanwhile. Model loading is slow, so it waits up to five minutes; if the process
dies during startup it says so instead of leaving you watching a spinner.

This asks the **style's** engine, not the video backend. Running video on sd-cli
while images go through ComfyUI is an ordinary setup, and it is exactly the
combination that used to skip the launch and fail on a ComfyUI nobody had
started. Once ComfyUI answers, the model dropdowns are re-read from it, so they
stop being the folder-scan fallback and become the real thing.

A style rendered by sd-cli never triggers a launch.

## Music and music styles (Settings → Music)

Songs render through **ComfyUI only**, with the **MiniMax Music3** native nodes
(`comfy_workflows/audio_minimax_music3.json` is the template). There is no
sd-cli path for a song, so a music style has no engine choice.

The split that matters: **the prompt box is the lyrics** — with section tags
like `[verse]`, `[chorus]`, `[bridge]` on their own lines — and **the style's
caption is the music**: genre, BPM, key, mood, vocal character, arrangement.
The caption is the reusable part, so one style serves many songs; the lyrics go
per press. The ready-made **MiniMax Music3** style carries the template's own
lo-fi caption as a worked example of the *Global Metadata / Vocal Details /
Arrangement* layout the model was trained on.

Songs are made in the **Music dock** under the timeline (2.91.0): the lyrics
box on the left is the prompt, the middle box is an optional per-song caption
override (empty = the style's), and the right column holds the style, length
in seconds, how many songs (up to 4), an optional seed, and **🎶 Generate
Music**. Blank fields fall through to the style. The status line under the
button follows the job to the end, so the console can stay shut. The mode
dropdown's **🎶 Music** entry still works from the prompt box.

A music style stores: the workflow, optional Model/VAE/text-encoder overrides
(the same ComfyUI dropdowns as an image style; blank = the workflow's own),
steps, cfg, **sampler and scheduler by ComfyUI's own names**, the caption, and
**max_duration** in seconds (capped per architecture — 300 s for Music3).
Image and music styles live in the same `styles/` folder; each file says which
kind it is, the two dropdowns are filtered by kind, and names are unique across
both. A style never changes kind on edit — want the other kind, make a new one.

Finished songs land in the project's `output/` folder, are hard-linked into
`sound/` (so they appear in the Assets dock and can be dragged onto the
timeline as an audio layer), and are listed on the gallery's **Audio** tab with
inline players. The seed is in the filename, like a still.

## Model Manager (Settings → Models)

Lists the **Comfy-Org/MiniMax-H3** (ComfyUI) repo files — including the
**int8_convrot** diffusion/text-encoder variants the repo recommends, the
fp8_scaled fallbacks, bf16 sources and both VAEs — and downloads any of them
(or a custom repo path) into `models\` as a queued job with console progress.

**Generate GGUF**: convert any local `.safetensors` (e.g. a downloaded bf16 or
int8_convrot file) into a GGUF sd-cli can load — quant selectable
(**q8_0 = int8**, q6_K, q5_K, q4_K, f16). Conversion runs
`sd-cli --mode convert -m <src> -o <out> --type <quant>`; the flag names are
editable in **Settings → Paths** (check `sd-cli --help`), because sd.cpp's H3
tooling is new. bf16 is the safest conversion **source**; int8_convrot is a
ComfyUI-oriented packing that not every sd.cpp build can ingest — if a
conversion fails, download the bf16 source and convert that instead, or use
the int8_convrot safetensors directly if your build loads it.

## 1. Requirements

- Windows 11 (works anywhere Node + Python + sd.cpp run; defaults assume
  Windows paths). Node.js 18+, Python 3.10+.
- **sd-cli** (stable-diffusion.cpp, Aug 2026+ CUDA build) — three ways in:
  **Settings → Paths → "⬇ Install sd-cli"** (runs as a queued job, full log in
  the console — the easiest retry if it ever fails), `start.bat`'s prompt, or
  `get-sd-cli.ps1` (right-click → Run with PowerShell; double-click opens
  Notepad). Manual fallback: from
  github.com/leejet/stable-diffusion.cpp/releases grab the
  `…win-cuda12-x64.zip` **and** the `cudart…cu12-x64.zip`, extract BOTH into
  `sd-cpp\` so `sd-cli.exe` sits directly in it. The installer forces TLS 1.2
  and survives GitHub API rate limits via a redirect fallback.
- **ffmpeg on PATH** for chunked/png/exact-trim renders and the timeline
  Compile (`winget install Gyan.FFmpeg`).

## 2. Models

Either drop your existing GGUF set into `models\` (unsloth Q6_K defaults are
pre-wired in Settings), run `download-models.ps1`, or use
**Settings → Models** to pull files straight from the ComfyUI repo and
generate your own GGUF quantizations. Licence note: H3 uses the MiniMax H3
Community License — read it once before shipping anything built on outputs.

## 3. Run

Double-click **`start.bat`** (checks Node/Python, installs deps, starts the
server, opens http://127.0.0.1:8311). Manual: `npm install` +
`pip install -r requirements.txt` + `npm start`. Confirm paths in Settings —
the health dot goes green when everything is found. Outputs land in
`projects\<name>\output\`; every job's `job.json` in `workspace\jobs\<id>\` is
replayable: `python worker.py workspace\jobs\<id>\job.json`.

## 4. Reference mode

Slot order matters: slot 1 is `<Picture 1>`, and prompts that assign each
reference a job work far better. Click a tray slot to insert its tag.

### Filling the References dock by dragging (2.70.0)

Drag a picture, a video or a sound file onto the **References** dock from the
**Assets** dock, from the **Gallery**, or straight off the desktop. The dock as
a whole is the target — you do not have to switch to the matching tab first,
because the file's kind picks the list and the dock then reveals the tab it
landed in. The line above the tabs says what happened, including every refusal
(tray full, already a reference, wrong mode, more than three clips).

Caps are the model's: **9 pictures, 3 reference videos, 3 audio clips**.

What happens underneath depends on the kind, because the generator receives
them differently:

- **Pictures** travel *with* the job, as bytes in the multipart POST. A picture
  dragged from the Gallery is read straight into the request; nothing is copied
  to disk and no name has to resolve.
- **Video and audio** are passed to the generator *by name*, and those names are
  resolved under `projects/<project>/video` and `.../sound` and nowhere else. A
  Gallery file lives in `output/` or `final/`, so it is **adopted** first —
  `POST /api/passets/adopt` hard-links it into the right asset folder and
  answers with the name it actually got (a clash is uniquified, never
  overwritten). Only that name is used. Because it is a hard link, referencing a
  render costs no extra disk even when the render is several gigabytes, and
  deleting either copy leaves the other whole.

Dragging the compiled movie (`<project>.mp4`) in is allowed and the dock says so:
the link keeps *those* bytes, so recompiling the timeline will not change the
reference underneath you.

## 5. Honest caveats

- Flag names (`--ref-image`, `--init-img`, `--end-img`, convert flags) are
  config values, not certainties — sd.cpp's H3 support is new; fix them in
  Settings if your build spells them differently.
- Hard-coded per H3's requirements: `--mode vid_gen`, `--cfg-scale 1.0`,
  `--fps 24`, `--diffusion-fa`, and the denoiser/encoder/VAE quartet.
- Speed presets use `--cache-mode easycache`, which **corrupts H3 audio** —
  Quality is the honest default.
- Queued rows that have not started survive a reload (2.125.0); a running job
  belongs to the server and is resumed from the Queue dock's Pending tab.
- Bound to 127.0.0.1 on purpose; no auth layer.

## Development

- `bash scripts/e2e-stub-test.sh` — full-stack test with a stub sd-cli
  (357 checks: Auto resolution, seam-dropped audio-preserving joins, exact
  trims, png rebuild, ref2va, GGUF conversion, image generation + styles,
  reference drag-and-drop, ComfyUI model scanning, API guards). It also runs the unit suites below, so
  one command covers everything. **This became true in 2.70.0** — three of the
  suites listed here were not actually invoked by the script before then,
  although the notes claimed they were.
- Unit suites, individually: `node scripts/test-timeline.js`,
  `node scripts/test-dockscroll.js`, `node scripts/test-waveform.js`,
  `node scripts/test-autoassets.js`, `node scripts/test-adopt.js`,
  `node scripts/test-comfymodels.js`, `node scripts/test-modelinstall.js`,
  `node scripts/test-comfyspawn.js`, `node scripts/test-refgroups.js`,
  `node scripts/test-styles.js`,
  `node scripts/test-imagedom.js` (needs `npm install jsdom`; skips without it),
  `node scripts/test-imageui.js`, `python3 scripts/test-span.py`,
  `python3 scripts/test-imagegen.py`, `python3 scripts/test-transitions.py`,
  `python3 scripts/test-comfyimage.py`, `python3 scripts/test-patcher.py`,
  `python3 scripts/test-comfyfree.py` (the clear-before-generation hand-off
  and the out-of-memory advice), `node scripts/test-settings.js` (the
  default/custom settings layers and the plan-ceiling mirror).
- `bash scripts/make_zips.sh` — builds the full + flat delivery zips.
- After interrupted sessions verify: `node --check` server.js lib/*.js
  routes/*.js and `python3 -m py_compile worker.py image_worker.py`.

Every path field in Settings has a 📁 picker — an in-app, server-side file/
folder browser (browsers can't hand real OS paths to a text field). Picks
inside the app folder are stored relative, keeping the install portable.

### Known model-format issue (int8_convrot text encoder)

Some sd-cli builds reject `qwen3vl_32b_minimax_h3_int8_convrot.safetensors`
with a wall of `Conditioner model tensor … wrong shape in model metadata`
(per-channel int8 scales on the Qwen MLP), while the int8_convrot **diffusion**
models validate fine. Fix: keep the convrot diffusion model, switch
**Settings → Text encoder** to the GGUF `qwen3vl_32b_minimax_h3-Q4_K_M.gguf`
(one-click, tagged ✓safe in Settings → Models). The worker now prints this
diagnosis automatically when it sees that failure.

### VRAM at 540p × 361 frames

960×544×361f needs ~15 GiB of *compute* buffer on top of ~25.6 GiB of weights
(diffusion + VAE) — over a single 32 GB card. The intended configs:
**⚡ dual-GPU preset** (Settings → GPU: splits diffusion weights across both
cards, VAE on the second card, VAE tiling, 13 GiB segment budget), or
single-GPU **Low-VRAM segmented execution** with a budget ≤ your free VRAM.
The worker now auto-retries an OOM'd chunk once with `--max-vram` before
failing, and the DIAGNOSIS line names the preset.

### Using big system RAM (CPU weight offload)

**Settings → GPU → CPU weight offload** appends `--offload-to-cpu`: model
weights live in system RAM and stream to the GPU on demand (CUDA loads them
asynchronously), freeing ~20 GB of VRAM for the compute buffer. With 128 GB
RAM the entire 44.5 GB H3 set fits with room to spare. Combine with the
segment budget for near-unOOMable renders. Note the diffusion *compute* stays
on the GPU — setting the diffusion **device** itself to cpu would sample on
the CPU and is orders of magnitude slower; RAM is for weights, not sampling.
The OOM auto-retry now ladders: measured budget (+VAE relocation) → CPU
weight offload → fail with DIAGNOSIS.

### CUDA stability mode (cuMemSetAccess / "device not ready")

ggml grows its CUDA memory pool via the driver's VMM API; some driver builds
intermittently fail that growth with `cuMemSetAccess … device not ready` and
abort — a driver bug, not capacity (it can hit with the card nearly empty,
esp. combined with `--offload-to-cpu`). **Settings → GPU → CUDA stability
mode** runs sd-cli with `GGML_CUDA_DISABLE_GRAPHS=1` + `GGML_CUDA_NO_VMM=1`
(the second applies only if the build honors it). The retry ladder detects
the crash and applies it automatically once. Also keep the NVIDIA driver and
sd-cli current. Freeform "Extra engine env" field for future knobs.

## ComfyUI as the engine

**Settings → ComfyUI** drives your *existing* ComfyUI install (default
http://127.0.0.1:8188) instead of sd-cli — nothing inside ComfyUI is
modified. Recommended path: **ComfyUI ≥ 0.30 native MiniMax H3 nodes**
(`MiniMaxH3ReferenceToVideo` / `MiniMaxH3ImageToVideo`); the shipped
`comfy_workflows/ref2va.json` is an Export (API) of the official R2V
template and works out of the box once ComfyUI has the official model files
in ITS OWN models folders (diffusion_models/, text_encoders/, vae/). The
older RH_MinMaxH3 pack path still works and is kept as
`comfy_workflows/ref2va_rh_example.json`.

At Generate time bitGen Studio patches values into your exported workflow:
prompt, seed (`RandomNoise`), frame count (the native `length` input — the
worker owns the snapping), width/height, and steps (`BasicScheduler`, so
the UI Steps field is live: 20 = full model convention, 4 = lightning).
Every loader slot you didn't feed and **all LoRA nodes** are bypassed
automatically, and helper chains detached by literal patching (duration
math, resolution selector, step switches, prompt primitives) are pruned.
The shipped template carries the FULL reference complement baked in:
**9 image slots** (`ref_images.ref_image_0..8`), **3 video slots**
(`ref_videos.ref_video_0..2`, each with its own soundtrack extracted via
`GetVideoComponents` into `ref_video_audios.ref_video_audio_0..2`) and
**3 standalone audio slots** (`ref_audios.ref_audio_0..2`). Feed any subset
— unused slots (and each dead video's soundtrack extractor) are pruned per
generation. Reference them in the prompt as `<Picture n>` / `<Video n>` /
`<Audio n>` (1-based, in slot order). Bare one-slot exports still work:
extra refs auto-clone new dotted slots. Known upstream quirk (ComfyUI issue
#15667): some builds silently ignore API-submitted references — if refs
show no effect, update ComfyUI; the dotted-key form this app submits is the
same one ComfyUI's own Export (API) produces.

**When a clip does not fit (2.99.0):** a single run that dies of GPU
out-of-memory is re-planned into chunks that fit and finished; the ceiling it
learned is kept (Settings → ComfyUI, *VRAM ceiling*, with ↺ Model max to
forget it), so from then on long clips are planned to render from the start.

**VRAM (2.98.0):** every generation starts from an empty card — the worker
asks ComfyUI to unload all models and empty its cache (`POST /free`) and waits
for the unload to land before queueing (Settings → ComfyUI, on by default;
🧹 Free VRAM now does it by hand). Turn it off only if you generate the same
kind of thing back-to-back and want to skip the few-second reload. If a clip
still hits `OutOfMemoryError`, the log lists the levers: **force split** with
Max seconds per segment = 10 (Generate → Advanced), a smaller frame, whatever
else sits on that card (the status bar shows VRAM per GPU), or
`--reserve-vram 4` in ComfyUI's launch command.

**Frame grid:** the native nodes snap to **17k+5** (5, 22, 39 … 345, 362 =
15.08 s ceiling), not sd-cli's 4n+1. The planner, chunking, UI readout and
exact end trims are grid-aware and switch automatically with the engine —
outputs stay frame-exact either way. Submission: `/prompt`, poll
`/history`, download `/view`, normalize to 24 fps; fl2va chunk hand-off,
seam-dropped audio-preserving joins and progressive previews run unchanged
on top. If `t2va.json` is absent, the fl2va workflow is reused with the
frame inputs stripped. Comfy mode uses ComfyUI's own models — bitGen Studio's
model paths are not required.

## Putting this on GitHub (2.123.0)

From the project root:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\init-repo.ps1 -Name bitgen-studio -Private
```

It checks `.gitignore` against `scripts/make_zips.sh`, stages, **shows you what
it is about to commit and asks**, then creates the repo and pushes with the
[GitHub CLI](https://cli.github.com). Without `gh` it stops after the commit and
prints the two remaining commands. It refuses to run if the staged tree is over
200 MB, and names the offending files — that size means something got past
`.gitignore`, and pushing tens of gigabytes of model weights to a personal
account is not a mistake you want to make twice.

It will not touch an existing `origin`, and it never force-pushes.

### What is deliberately not in the repo

`.gitignore` mirrors the release-zip exclusions, from the same reasoning: model
weights (`models/`, `loras/`, `llm-models/`, `checkpoints/`), the Python venvs,
your renders (`output/`, `workspace/`), your work (`projects/`, `styles/`,
`graphs/`) and `custom.settings` — which holds absolute paths to your own
drives. `default.settings` **does** ship; it is the authored default layer and
the app will not start without it. `scripts/check-gitignore.sh` fails the test
suite if the two lists ever drift apart.

### Licence

**MIT** — see `LICENSE`, and `NOTICE.md` for why that is compatible with
everything this drives.

The short version: bitGen Studio **bundles no third-party generation
software**. ComfyUI runs as a separate program on its own port; the speech,
transcription and LLM engines run as subprocesses; the installer scripts
*download* them from their own projects rather than redistributing them. A GPL
program you run imposes nothing on the program that runs it — the GPL's
conditions attach to distributing a combined work, and there is no combined
work here. So MIT is safe, and it is permissive in the other direction too: MIT
code can be folded into a GPL project, so nothing here can become an obstacle
downstream.

Everything in `package.json` is MIT / BSD / ISC / Apache-2.0 / CC0 / BlueOak.
Nothing copyleft, nothing with a field-of-use restriction.

**Model weights are a separate question entirely.** MiniMax H3, FLUX.2, SDXL,
the TTS voices — each has its own licence and several of the most useful are
**non-commercial**. A permissive licence on this application says nothing about
what you may do with the output of a model whose licence restricts it. If you
plan to sell what you render, read the licence of the checkpoint that rendered
it.


## The generation queue (2.122.0)

**Generate adds to a queue instead of blocking.** Press it, and the generation
appears as a row in the Queue dock; press it again and you get another. The
button never greys out, so you can line up six variations while the first one
renders. They run **one at a time** — these jobs each want a whole GPU, so the
next starts when the previous has actually finished, not when its request
returned.

**Each row remembers the type it was queued as.** Queue an image, flip the
Generate dropdown to video, queue that — both run as what they were when you
pressed the button, not as whatever the dropdown says by the time they get
their turn. `/br/` still splits a prompt, now into rows you can see.

Each row's status and buttons sit on their own line, and the summary spans the
full width of the Queue dock underneath them, wrapping to three lines. Six
variations on one prompt are told apart by their tails, so the tail is what has
to be visible; the whole prompt is on the row's tooltip.

**Delete a row with ✕**, reorder with ▲ ▼. A row that is *currently rendering*
cannot be deleted by ✕ — that is a real job on a real GPU, and a delete button
that quietly meant "throw away four minutes" is a mis-click waiting to happen.
Use Abort. A finished, failed or cancelled row gets a ↻ to queue it again.

**A reload no longer loses the queue (2.125.0).** Rows that have not started yet
come back when the page does. What does *not* come back is the row that was
rendering when you left — that one became a real job, it kept going without the
page, and Settings → Queue dock → Pending is where an interrupted job is resumed.
Finished rows are history and live in the job list underneath.

A restored queue **waits for you to press Generate**. It does not start on its
own: after a reload the panels hold whatever the settings file and the project
put back, and starting a render against controls you have not looked at yet —
because you merely opened the app — is not something the queue should decide.

### Enter sends to chat

Enter in the prompt box now sends the text to the Prompt chat; Shift+Enter is
still a newline. Between 2.86.0 and now Enter generated, which meant a stray
keypress could start minutes of GPU work on a half-written prompt. Sending a
half-written line to an LLM costs a second and is undoable. Generate is the
button (or 🖼 for a still).

### ⏹ Abort

The old **💬 Send to chat** button is now **Abort** — Enter took over its job,
and the queue needed somewhere to put this one. It lights up only while
something is rendering, and asks which of three things you meant:

* **Stop this render** — cancel the running job, carry on with the rest of the
  queue.
* **Retry this one** — cancel it and put it back at the *front* of the queue.
* **Stop everything** — cancel the render and empty the queue.

All three cancel the job on the server, not with a flag in the page: a
page-local stop would leave the worker running and the GPU busy, which is the
opposite of what the button says.


## Wire a ComfyUI graph to bitGen Studio's inputs (2.120.0)

Any ComfyUI workflow can become a first-class thing this app renders, with
controls you design yourself. Three screens:

### The ComfyUI dock

`ComfyUI` in the dock toolbar opens ComfyUI's **own interface** inside H3
Studio, framed. Not a re-implementation: the canvas, the queue, the Manager and
every node pack's widgets are ComfyUI's, and the one thing this app must never
grow is a second, worse copy of them. `⟳` reloads, `⧉` opens ComfyUI in a real
browser window. The page is not loaded until the dock is opened for the first
time, so a closed dock costs nothing at start-up. Its size and open/closed
state live in the settings file with every other dock.

### Settings → ComfyUI → Graphs

1. **Load a workflow** — pick one from `comfy_workflows/`, or `📁 File…` to load
   one from anywhere on the machine. A file loaded from disk is copied into
   `comfy_workflows/` first: a binding names a file, so a graph the studio
   cannot open again next week is a binding that silently stops working.
2. **Is it an API workflow?** The readout beside the buttons says so. ComfyUI's
   *Save* writes a UI workflow (nodes + links); an API prompt (node id →
   class_type) is what the API takes.
3. **⚙ Export as API** converts a UI workflow into an API prompt, using
   **ComfyUI's own `/object_info`** for the widget names and order. That is why
   it works with any node pack you have installed and has no table here to keep
   up to date — but it does need ComfyUI running, and it says so rather than
   guessing. A node class ComfyUI does not know fails **by name**, so you know
   which pack to install. Bypassed (Ctrl+B) and muted nodes are removed and
   rewired exactly as ComfyUI's own export does; Notes, Reroutes and
   `control_after_generate` never reach the prompt.
4. **Add inputs and wire them.** The right-hand list is every value in the
   workflow you can change. The left is the controls you add: **toggle**,
   **dropdown**, **text**, **slider** (with your own min / max / step) and
   **spinner**. Drag from a control's dot to a value's dot to connect them;
   click a line to disconnect it. `⊕` on a value makes a control already wired
   to it, with a type guessed from the value — a boolean gets a toggle, `steps`
   and `cfg` get sliders, a seed gets a spinner (a slider over four billion is
   not a control).
5. **💾 Save graph.** Bindings are one readable file each at
   `graphs/<name>.json`, the same as styles — browsable, hand-editable and
   copyable between installs. A duplicate name is refused, never overwritten.

Two rules are deliberate and worth knowing:

* **A value connected to another node is not offered for wiring.** Writing a
  number over a wire would disconnect the graph and ComfyUI would refuse the
  prompt with a type error nobody could trace back to this screen.
* **A wire that no longer resolves is reported, not skipped.** Re-exporting a
  workflow with different node ids is the normal way a binding goes stale, and
  the graph picker says which control broke rather than letting a render come
  back quietly using the old value.

### Basic Settings → Graph

Pick **⚙ Graph** in the Generate dropdown and Basic Settings shows the graph
picker and the controls you wired — drawn from the binding itself, so there is
no second list to keep in step. Press **Generate** and `graph_worker.py` runs
it through ComfyUI. **Shows in** on the Graphs tab decides which Generate modes
offer a given graph (`any` offers it in all of them).

The controls are applied **server-side**, in `lib/comfyGraphs.js`. There is no
copy of the control model in Python, because two copies of "how a graph is
patched" is exactly how `worker.py` and `comfy_client.py` drifted apart once
already.

**The values you set are saved with the project (2.125.0).** Reopen a project and
the graph it was using comes back selected, with every slider, toggle and text
box where you left it. Only the *selection* is stored in the project — the
wiring itself stays one file in `graphs/`, shared by every project, so there is
never a second definition of the same graph to drift out of step.

### Folded workflows: subgraphs and Set/Get (2.126.0)

A modern ComfyUI canvas can be **folded**: a node whose type is a UUID is an
instance of a subgraph saved inside the same file, and wires can be drawn by name
with KJNodes' `SetNode` / `GetNode` instead of dragged across the screen. Neither
appears in ComfyUI's `/object_info` — a subgraph is not a node pack, it is a fold
in one workflow — so a converter that trusts `/object_info` alone rejects the
file outright.

`lib/subgraphs.js` unfolds both before conversion: every subgraph instance is
inlined (including subgraphs inside subgraphs), and every Get is rewired to
whatever its Set was fed by. Inlined nodes are named `<instance>:<inner>`, the
same way ComfyUI's own subgraph export names them, so an error from ComfyUI maps
straight onto what you see on the canvas. A flat workflow is passed through
untouched.

Checked against ComfyUI 0.34's own API export of the same blueprint: same node
ids, same classes, same 42 wires. That export ships as
`comfy_workflows/h3_longform_blueprint_api.json` and the test suite diffs against
it, so if ComfyUI ever changes how it unfolds a subgraph, the suite says so.

One thing that export corrected: `PrimitiveInt`, `PrimitiveFloat` and
`PrimitiveString` used to be canvas-only widgets and are now real nodes that
ComfyUI wires like any other. They are inlined only on a ComfyUI that does not
know the class — on a current one they stay wired, which matters because
inlining one would write a literal over a dynamic input such as
`ComfyMathExpression`'s `values.a`.

A `GetNode` with no matching `SetNode` is reported and its consumer is left
unplugged rather than deleted — a silently removed LoRA is a quality change with
nothing in the log to explain it.

### The `minimaxH3-I` video style (2.128.0)

A second MiniMax H3 video style, seeded beside `MiniMax H3 SS`. The two differ in
exactly one way: `MiniMax H3 SS` uses the Settings → ComfyUI templates, while
`minimaxH3-I` brings its own graph — the single shot lifted out of the Longform
blueprint (`comfy_workflows/h3_scene_api.json`). Same architecture, same
accelerators, same Basic Settings, so picking one and then the other is a fair
comparison.

It names no model, text encoder or VAE of its own: the graph's loaders carry
those, and a style-level value would override them.

It renders **one shot**. For multi-shot chaining, load the full blueprint in
Settings → ComfyUI → Graphs — see below.

### Continuous video: shots that chain (2.126.0)

H3 renders about **15 seconds** of video-with-audio per generation. Longer pieces
are not longer prompts — they are a **chain**, and there are two ways to make one:

* **Straight continuation.** Set Seconds past the ceiling and the planner splits
  the render into chunks, handing the *exact last frame* of each chunk to the
  next. One prompt, arbitrary length.
* **A scripted multi-shot piece.** Load `comfy_workflows/h3_longform_blueprint.json`
  in Settings → ComfyUI → Graphs. Each scene emits `tail_frames`, the next scene
  takes it as `continuity_ref`, and a merge stage joins the clips and their audio
  at the end. Every shot carries its own prompt, so the piece can be directed
  rather than merely continued.

The Prompt chat knows how to write for this. Ask for something longer than the
ceiling — "a three minute video", "longform", "chain these shots" — and the LLM
switches to a numbered shot list: the cast defined once as `<Subject 1>`,
`<Subject 2>`..., every recurring person or place described in *identical words*
in every shot (a paraphrase is how a face drifts over a chain), one camera move
per shot, cuts only on shot boundaries, and each shot ending on a held frame the
next one can start from. Asking for "one continuous take" still means a single
clip and is left alone.

### Load nodes fill themselves from the reference dock (2.121.0)

You do not wire a control for a picture. Every `LoadImage`, `LoadVideo` and
`LoadAudio` in the workflow takes its file from the **Reference dock**, in node
order — first loader, first reference — and the Graphs tab marks those values
so you can see which ones the dock owns.

**Load nodes the dock has nothing for are bypassed**: removed from that render
and their consumers rewired, exactly as Ctrl+B does in ComfyUI. So a workflow
with three `LoadImage` slots still runs with one picture in the dock, and an
empty dock leaves none of them behind. This matters more than it sounds: a
loader left in place would still be pointing at whatever filename the workflow
was exported with — a file from somebody else's machine — and ComfyUI would
fail the render naming a file you have never seen.

If you *do* wire a control to a loader's filename (a dropdown of names, say),
your control wins and that loader is never bypassed. A deliberate choice
outranks the dock.

The files themselves are uploaded to ComfyUI by `graph_worker.py`, because
ComfyUI cannot see this machine's disk. Which loader gets which file, and which
ones are bypassed, is decided once in `lib/comfyGraphs.js` — the worker does the
upload and nothing else.

Requires the ComfyUI engine (Settings → ComfyUI → Engine); a run on the sd-cli
engine is refused with that as the reason.


## 360° VR video + the built-in 360 player (2.119.0)

**Making one**: ask any LLM helper for a "360 vr video" / "equirectangular
panorama" and the 360 addendum teaches the prompt shape — one equirect
frame (full sphere unwrapped, 2:1, horizon at centre), seamless left/right
edges, subjects kept off the frame edges and out of the pole bands, a fixed
level camera at eye height (turning is the viewer's job), and action placed
at different compass directions so looking around pays off. Set the new
**2:1 (360°)** aspect in Basic Settings (or a video style). Honest caveat:
H3 has no 360 training and no equirect LoRA exists yet (checked
2026-08-28 — watch github.com/wildminder/awesome-minimax-H3), so the wrap
seam and poles are approximations; keep the action front-and-centre and
treat the edges as scenery. A 360-degree camera *orbit* in a prompt never
triggers any of this.

**Playing one**: the player bar's **360°** button covers the player with a
WebGL equirect view of the same video — drag to look around, wheel to zoom
(30–110°), click to play/pause, double-click to level. Audio, seeking and
the other player buttons keep working underneath. The button lights up when
the loaded video is ~2:1, and it works on any equirect file, including real
360 footage you drop into outputs. Dependency-free (`static/vr360.js`, one
fragment shader); if the window has no WebGL it says so and leaves the flat
view alone.

## SBS VR prompting (2.118.0)

Ask any of the LLM helpers for an **SBS / VR / stereoscopic** video — the
prompt chat, ✨ Enhance, or the music-video shot writer — and a VR
stereo-pair guide rides along with the normal H3 guide, triggered by your
own words ("sbs", "vr", "stereoscopic", "side by side 3d" — a VR headset as
a prop or "stereo sound" won't trip it). It teaches the one rule that
matters most: **the right half is never a mirror** — it's the same scene
from a viewpoint ~6.5 cm to the right, both halves facing the same
direction in perfect sync — plus parallax depth cues, VR comfort camera
rules (level horizon, eye height, one slow move), seam-safe composition,
matched halves, no on-screen text, and the 21:9 aspect tip so each eye is
near-square. Custom additions live in `styles/prompt-guides.json` under
`addenda` (same by-id override as the guides).

## Timeline capture + prompt clear (2.117.0)

The ⊢ First / Last ⊣ / ＋ Ref frame buttons now resolve the playhead against
**every** layer, preferring the one you selected: the selected video **or
picture** layer first (click its label — V1, V2, I1 …), then V1, then each
overlay video layer, then the image layers. A picture clip hands over the
image itself. The playhead parked at the very end of a clip or of the whole
composition captures that clip's **last frame** (half a frame of slack for
pixel-rounded drags) instead of refusing. Captures from project-asset clips
now load from the right place, and saved markers remember their source and
kind so a project reload restores image and asset-clip captures too.

The Prompt dock's title bar has a **🧹 Clear** button — empties the prompt
textarea only (chat, negative and everything else stay put) and returns the
caret.

## Video accelerators — Sage attention + Spectrum (2.116.0)

Two optional speedups for the ComfyUI MiniMax H3 path, switched on **per
video style** and injected into the graph in front of the sampler at render
time. The ready-made **MiniMax H3 SS** style (seeded to
`styles/video/MiniMax H3 SS.json`, never overwriting an existing file of
that name) is a plain H3 render + Sage `auto` + Spectrum `on`; your other
styles are untouched until you set their own Accelerator fields
(Settings → Video styles).

**Sage attention** replaces the model's attention with SageAttention's
quantized kernels — the single biggest s/it win on long clips. Two pieces:

* the `sageattention` **library inside ComfyUI's own python**. Windows
  wheels are built per torch/CUDA pair — the wrong pair is exactly the
  `DLL load failed while importing _fused` in `minimax-fixed.txt`. The
  matching stable-ABI wheel (any torch ≥ 2.10, python ≥ 3.10, one per CUDA
  major) comes from <https://github.com/woct0rdho/SageAttention/releases>;
  for a cu130 torch (2.13.0+cu130 is the known-good from
  `minimax-fixed.txt`):

  ```
  E:\ComfyUI\venv\Scripts\python.exe -m pip install triton-windows "https://github.com/woct0rdho/SageAttention/releases/download/v2.2.0-windows.post6/sageattention-2.2.0+cu130torch2.10.0andhigher.post6-cp310-abi3-win_amd64.whl"
  ```

* **ComfyUI-KJNodes** (<https://github.com/kijai/ComfyUI-KJNodes>), which
  applies it per-model: the style's Sage field maps to
  `Patch Sage Attention KJ` (`auto` or a named backend) or, for `memeff`,
  the recent H3-specific `MiniMax H3 Mem Eff Sage Attention Patch` (lower
  peak VRAM). Keep KJNodes updated — `git pull` in
  `custom_nodes\ComfyUI-KJNodes`.

Backend notes: `auto` is fine on Blackwell (the 5090 picks its own kernel);
if a clip ever comes out black or noisy, `sageattn_qk_int8_pv_fp16_cuda` is
the overflow-safe choice; `sageattn3` is the Blackwell FP4 experiment.
Do **not** use ComfyUI's global `--use-sage-attention` flag alongside — the
per-style patch is the whole point, and the global flag's triton path is the
one known to blacken some models.

**Spectrum** (<https://github.com/xmarre/ComfyUI-Spectrum-MiniMax-H3>) is
xmarre's H3-specific feature-forecast accelerator: it fits a Chebyshev
ridge model to the transformer's output features and *skips* ~30% of the
transformer evaluations. Install:

```
cd E:\ComfyUI\custom_nodes
git clone https://github.com/xmarre/ComfyUI-Spectrum-MiniMax-H3.git
```

No python dependencies of its own; restart ComfyUI. It is **approximate**:
fast or brief motion can follow a different trajectory than a native run,
and fast-moving fine detail (eyes, fingers) can degrade — A/B the same seed
when quality matters. The style's `On` setting writes only `enabled`; every
other knob comes from the node's own defaults, which are its audio-safe
conservative path (`offline_smoothing_replay` on, `audio_blend_weight` 0).
`Aggressive` adds the README preset (`blend_weight 0.75`, `flex_window 3.0`).
Spectrum forecasts only on its allow-listed samplers — `euler` and
`res_multistep` (+CFG++) — which the shipped H3 templates already use;
anything else silently runs native. Budget ~2.3 GB of history at 0.5 MP
(system RAM by default).

**LoRAs compose with the accelerators** — all three sources at once:
a style's own LoRA list, the temporary LoRAs from Basic Settings (merged
into the picked style per render), and the template's switch-gated Turbo
LoRA (the Basic Settings toggle). The worker builds the chain
`model → style LoRAs → temp LoRAs → (turbo) → sage → spectrum → sampler`,
and only the template's turbo LoRA is ever bypassed — a chain you asked
for is never dropped. This holds for any minimax-h3 style, the SS starter
included.

**One-click path**: Settings → ComfyUI → **Video accelerators** has two
buttons, each with an installed / not-installed label beside it that flips
to **Reinstall** once the piece is in place (checked automatically when
Settings opens). **Install Sage** does the whole sage story in one go: the
sageattention wheel matching ComfyUI's *own* torch tag (+ triton-windows),
then a chained git clone/update of ComfyUI-KJNodes — the pack whose nodes
actually apply it. **Install Spectrum** is a git clone/update of the
Spectrum repo. Everything streams to the app console. Restart ComfyUI
after installing. If a render asks for an accelerator whose node
pack is missing, the job fails **before queueing** with the exact repo to
install; a Sage DLL/torch mismatch at run time is recognized and explained
in the job log with the wheel link.

## Changelog

* **2.170.0** — **The render-aware harvest** (Tim: "when i select the
  scenes and click generate selected, only the first scene is rendered
  ... if i have 6 scenes the first scene is generated 6 times"). The
  queue itself was sound — each job wrote its own scene_range into the
  tmp graph (e2e-pinned). The wrong file was being HARVESTED: his loop
  runs with verify_resume_history, so on a single-scene render the
  ASSEMBLE writes a film resumed from history — a file that starts at
  scene 1 no matter which scene was asked — and 2.165.0's assemble-first
  pick (the sound fix) took that film every time: audible, but always
  opening on scene 1. The pick now reads the queued graph's own
  scene_range: a single-scene render prefers the scene's OWN segment; a
  full render keeps the assembled film first. And because his segments
  are video-only (the pre-2.165.0 silent takes proved it), a silent
  segment triggers a deterministic fallback: the assembled film is
  downloaded and this scene's window is CUT from it at the plan's own
  frame offsets — audio arrives, the right scene stays, every step is
  logged. The stub now answers chain renders faithfully (video-only
  segment + audible film + recorded scene_range) and the e2e proves the
  whole path: each queued job asks for its own scene, both takes carry
  audio, and the job log says the cut happened.

* **2.169.0** — **Chat recall** (Tim: "the llm sends the scenes to the
  video docker once, but if i ask a second time in the same session it
  just produces a prompt not related to the characters ... can we have
  it do a rag for the current chat"). ROOT CAUSE: the chat replayed the
  WHOLE session every call; once the history outgrew the model's context
  window, llama-server truncated the prompt from the TOP — and the first
  thing to fall off was the system prompt carrying the cast. The second
  screenplay ask in a session came back about nobody; a restart "fixed"
  it only because a fresh session is short. NOW: every call rebuilds the
  conversation to a hard budget derived from the model's context size —
  the SEED (first user message) always rides, the recent tail rides
  verbatim, and the middle is RETRIEVED by word-overlap relevance with a
  recency lean (lib/chatRecall.js, pure functions). The CAST NOTE — every
  @tag with its type and headline facts, plus referenced locations — is
  re-sent in the system prompt on EVERY call, so no amount of history can
  push the characters out of the model's sight. Short chats ride whole;
  recall never loses a conversation that fits.

* **2.168.0** — **The shooting-script guide, the stitch, and clothing**
  (by instruction, with a screenplay PDF as the style pointer). (1) The
  LLM guide gains "WRITE LIKE A SHOOTING SCRIPT": action in short active
  present-tense sentences where hands DO things; props as named things,
  never categories; locations established with period, weather, light and
  one telling detail, worded the same on every return; sensory specifics
  the camera and microphone can capture; vague words banned. All original
  teaching text — the uploaded screenplay steered the style, none of it
  is reproduced. (2) ONE PICTURE PER CHARACTER: several sheets are now
  STITCHED side by side into a single _composite.png (ffmpeg, at save and
  upload time) and the chain carries exactly one loader + reference per
  character — reversing 2.144.0's every-sheet rule after the live
  finding that two images register the same character twice, which the
  pack does not allow. Voices keep the many-clips rule. The graph and the
  upload list share one decision, so a failed stitch falls back to the
  first sheet consistently. Card labels: one number per character, with
  "(N sheets stitched)" when it applies. (3) A ＋ button beside the
  dialog thumbnail opens the picture picker; its tooltip teaches the
  stitch. (4) **Clothing** joins the type dropdown — subtype + color
  rows, and a garment subject definition that preserves cut, fabric,
  pattern and stitching on any wearer.

* **2.167.0** — **The ScenePromptEditor bypass** (Tim: "setting the
  default duration doesn't change the duration of each scene ... it is
  only rendering scene 1 regardless of which scene i try to render ...
  the settings in the character ref workflow are not following all the
  inputs from the app"). His export routes the plan THROUGH
  MiniMaxH3ChainScenePromptEditor (ChainPlan 9 → editor 11 → loop 17) —
  an interactive per-scene editor, the same species as ChainReview
  (2.147.0), whose UI-edited state rides the workflow and OVERRIDES the
  plan_json the app writes: with a stale one-scene plan stored in it,
  every duration, prompt and scene selection the app set was shadowed,
  and any scene range clamps to scene 1. An API render has no editor at
  the desk and THE PLAN IS THE TRUTH: the worker now bypasses the editor
  per run (consumers rewired to its own plan input — the Ctrl+B physical
  removal rule; the export on disk keeps its editor) and says so in the
  log. A pure pass-through loses nothing; a node holding edits stops
  shadowing the app. The e2e asserts the QUEUED graph carries no editor
  and the loop's plan comes straight from ChainPlan.

* **2.166.1** — **v2.166.0 confirmed: video AND sound** (Tim: "mark video
  and sound works"). The silent-takes chase closes — the 2.165.0 harvest
  ranking (take the ChainAssemble film, not a segment artifact) was the
  fix, proven on the 5090 against a real ComfyUI. WORKING-VERSIONS.md
  gains the row; the known-good rollback target advances to 2.166.0.
  Docs-only; no code changed.

* **2.166.0** — **The detailed character sheet** (by instruction). The
  character dialog gains a **Type** dropdown — Person / Animal / Vehicle —
  and the fields follow it: animals get sub type, breed and color;
  vehicles get sub type, color, model and year made; people keep the
  human measurements and wardrobe. Values are stored for every type and
  only HIDDEN on a switch, never erased. The screenplay's subject
  definitions speak each type's facts ("@kitt is the sports car defined
  by the provided reference sheet — a 1982 black Trans Am...") with
  identity-preservation phrased per type — a sedan has no bone structure.
  The dialog also gains the character's **thumbnail**: it shows the first
  sheet, clicking it opens the picture picker, and the Pictures input now
  takes SEVERAL files at once — in both Add and Save modes, uploads are
  ADDED, nothing replaced. Junk types are refused quietly (the stored
  type stays); the roster card's facts line leads with each type's
  headline detail.

* **2.165.0** — **The default duration rules them all; the harvest names
  its file** (by instruction + Tim: "I don't think sound is being
  rendered. the volume button on the preview is disabled"). (1) Changing
  Default s now rewrites EVERY scene's duration to match (snapped;
  changed scenes reset to idle, takes kept) — each card's own duration
  stays editable and wins until the default changes again. The save is
  MERGED into the chain settings, fixing a 2.163.0 bug where the plain
  config post REPLACED the chain section and wiped the tab's other
  overrides. (2) A disabled volume control means the FILE has no audio
  track — and the worker picked its output file by dict order, which on a
  chain render can land on a segment artifact instead of the ASSEMBLED
  film that carries the muxed audio. The harvest now ranks candidates by
  class (ChainAssemble first, then video-combine, segment saves last) and
  logs "[comfy] taking <file> from <class>#<id>" — so a silent take names
  its source instead of leaving a mute mystery.

* **2.164.0** — **Menubars for the prompt and the chat** (by instruction).
  The prompt dock gains a menubar at the top of its body holding the whole
  action row — ✨ Enhance and 🧹 Clear from the old header, ⏹ Abort,
  🎥 Camera, 🎤 Speak and 🔊 Read replies from the old right column — same
  ids, same wiring, only the furniture moved. The chat dock gains its own
  menubar: 🆕/⬇/📖 and the last-chat note move down from the titlebar,
  joined by 💾 Save, a saved-chats picker, and 📂 Load. A conversation was
  already a file (projects/<p>/chat/<date_time>.chat, the 2.85.0
  doctrine): Save freezes the current file as the archive and continues in
  a fresh copy; Load opens a picked conversation the same way — the
  original file is never edited again. Junk or traversal names are
  refused by name.

* **2.163.1** — **v2.162.0 confirmed working** (Tim: "v2.162 is
  working", on the 5090 against a real ComfyUI). WORKING-VERSIONS.md
  gains its second confirmed row of the Comfy era — the first since
  2.129.0 — carrying the whole Scene Board line with it. Docs-only
  release; no code changed.

* **2.163.0** — **Delete selected, clear, default duration** (by
  instruction). 🗑 Selected removes the ticked scenes' shots from the
  plan — the continuity chain HEALS over each gap (a survivor whose
  visual_context_source named a deleted shot follows the shot now before
  it), surviving scenes keep their statuses and takes, and rendered files
  stay in the gallery. 🧹 Clear empties the whole board while the shared
  prompt and chapter list stay (the movie's frame, not its scenes). Both
  sit behind appConfirm — a declined confirm posts nothing. The bar's
  right edge gains a **Default s** input: the default duration for every
  NEW scene, stored as chain.length (the one override layer new shots
  already default from), snapped per shot to the pack's valid lengths —
  each scene's own card duration stays editable and always wins.

* **2.162.0** — **Chat verbs for the board** (by instruction: "when the
  user asks for a new scene ... add a scene to the current chapter, if a
  user asks to change or edit a scene eg 'edit scene 2 make it more
  realistic' then edit that scene"). The chat intent now recognizes
  three requests, most specific first: **edit scene N <instruction>**
  (also change/rewrite/update/revise — but never redo, which means
  re-render on the board) sends the shot and the instruction to the LLM
  under a tight contract, and the rewritten prompt lands through the same
  normalize→validate→fromPlan gate as every editor — the scene resets to
  idle, take kept; a bare 'edit scene 2' asks what to change. **add a
  scene / new scene [description]** appends a shot — and every added
  scene (chat or the ＋ Scene button) now joins the CURRENT chapter, the
  last scene's. Questions ('can you add a scene?') stay ordinary chat.

* **2.161.0** — **Picture C-labels + the silent-file badge** (Tim: "the
  reference image and the character image share a title picture 1 ...
  make the character image picture c<n>? and the sound doesn't work").
  (1) Character cards now label sheets **Picture C1, C2, ...** so they
  can never be confused with the reference dock's own Picture numbers —
  LABEL ONLY: in prompts the pack's token stays `<Picture 1>` (its
  numbering, its vocabulary; `<Picture C1>` in a prompt would render
  nothing), and the tooltip teaches exactly that. (2) "the sound doesn't
  work" cannot be fixed blind, so the app now finds the fact: every
  harvested take is ffprobed for an audio stream, and a take with none
  wears **🔇 silent file (no audio track)** on its badge. Silence in the
  FILE points at the graph; a file WITH audio that plays silent points at
  the playback environment — the badge says which conversation to have.

* **2.160.0** — **Save, not Add, while editing** (by instruction: "when
  character is being edited, change the add character button to Save and
  save the changes without adding another character"). The save flow was
  already an in-place upsert by name (the name is locked while editing,
  so the folder key cannot fork) — the LABEL was the lie: the button read
  "Add character" in both modes. Now editing shows **Save** with a
  tooltip saying no new character is created; NEW, a completed save, and
  Cancel each restore **Add character**. Dialog resets also moved to
  state-first/view-last so a close() that throws under partial <dialog>
  support can never strand the button mid-mode.

* **2.159.0** — **dockers.json: the global dock layout** (by instruction:
  "allow all horizontal dockers height to be resizable, store the settings
  in a dockers.json file ... global settings across all projects ...
  normal state will be the resized height"). Every horizontal dock was
  already draggable (the elastic preview resizes through its neighbours'
  splitters); what was missing was one global memory. lib/dockers.js owns
  dockers.json at the install root — { docks: { id: { height, state } } },
  states normal/min/max, heights clamped 60..2000, unknown ids dropped,
  one max at a time, atomic writes. A drag end saves the height; collapse
  saves min/normal; maximize saves max, restore saves normal — and normal
  reopens AT the stored height because resizing writes it. Boot fetches
  and applies the file over the local fallbacks, so every project opens
  with the same layout. Maximizing one dock still only TUCKS the others
  (a view, never saved) — selecting a dock leaves the rest's stored state
  and heights untouched, exactly as instructed.

* **2.158.0** — **The console follows the render** (Tim: "it says it's
  rendering, but nothing is showing in the console"). The console streams
  only the SELECTED job's log, and the Scene Board never selected the
  jobs it started — the render ran fine, invisibly. The board poll now
  selects a running scene's job (or upscale job) the moment it appears,
  once per job — which also keeps the console walking through each job a
  render-selected queue launches — and 🎬 Compile selects its export job
  the same way. Selecting a job yourself still works; the board only
  re-selects when a NEW render starts.

* **2.157.0** — **The repair round hardened** (Tim: the model invented
  @jot on slot S1, and "a repair pass was attempted but the model's second
  reply was not a JSON plan"). Three changes to make the second pass
  land: (1) the repair context hands back the PARSED plan as compact JSON
  instead of the model's raw reply — the raw carries think-blocks and
  prose that could pass llm.ctx and garble the retry into non-JSON;
  (2) the correction now TEACHES THE CAST ROSTER ("The ONLY characters
  that exist are: @joan (S1), ... Replace any other @tag with one of
  these or remove that line") — the direct cure for invented characters;
  (3) when the second reply still is not a plan, its own opening words
  are quoted in the failure ("It said: ...") — an apology, a truncation
  and a ramble each read differently and each has a different remedy.
  The stub-llm plays the apologizing model (ninth faithful-mock case) and
  the e2e proves the quote surfaces and the roster is taught. Also: a
  changed LLM setting now RESTARTS a running llama-server (Tim: "i have
  set the context to 64k — is the slider working?" — it saved and the
  launch line used it, but a running model was reused on a file match
  alone, so the old -c kept serving; ensureLlama now carries a launch
  signature of device|port|ctx|gpu_layers and restarts when it differs).

* **2.156.0** — **H3-valid lengths, from the pack's own words** (Tim's
  card: "node 9 (MiniMaxH3ChainPlan): ValueError: Shot 1 length must be an
  H3-valid frame length between 5 and 3592 with length % 17 == 5; got
  360." — the itemizing card of 2.153.0 finally speaking in specifics).
  The rule is VERIFIED, not guessed: every length in the shipped exports
  obeys it (141, 158, 22, 39). screenplay.snapLength() is its one
  spelling; normalize snaps every shot's length through it, so a duration
  typed in seconds (15s -> 360 -> 362) or a length a model invented lands
  on the nearest valid frame count instead of dying at preflight — the
  card's duration input repaints to the snapped value after save. The
  writing guide teaches the rule so models write valid lengths first
  time.

* **2.155.0** — **The [Language] tag repairs itself; ▶ carries unsaved
  edits** (Tim's card named the rules at last: a speaker line whose next
  beat was '<d>Just you and me, old friend.</d>' — no [Language] tag — and
  even the repair round could not teach it; plus "the duration setting in
  scene reverts to 5.9 seconds when i hit the play button"). (1) A <d>
  line missing its [Language] tag is a SPELLING, not a creative choice:
  normalize now inserts the plan's own dominant dialogue language (English
  when the plan has none) — both of Tim's validator errors were that one
  tag, and his exact failing pair now validates. Tagged lines pass through
  untouched; an unclosed <d> line is a different error and is left alone.
  (2) 5.9s IS 141 frames — the plan default: clicking ▶ blurred the
  duration input and the refresh repainted the unsaved value away. Play
  now saves the card's prompt and duration first whenever they differ
  from the record, then generates — "set it and press play" is the
  intent; an untouched card generates straight away with no needless
  save.

* **2.154.0** — **The repair round** (Tim: supergemma4_uncensored "returns
  ⚠ the screenplay would not render: shot 1 (clip_01).. it does not
  populate the scenes"). The model now ANSWERS (2.152.0's fold) but its
  plan missed a validation rule — and the flow just gave up. The
  validator's messages are written to teach, so now they teach the MODEL:
  a plan that fails validation goes back to it once, with its own plan and
  every error listed, asking for the corrected JSON. A repaired plan
  populates the board with a note that it happened; a plan the model
  cannot fix even with the errors in hand returns the final errors plus
  what was tried. The chat's failure line now also carries the repair and
  fold notes, so nothing that was attempted is invisible. The stub-llm
  faithfully plays the miss-one-rule model (broken @stranger tag first,
  fixed only when the errors come back), and the e2e proves the repair
  request carries the model's own plan and the validator's exact words.

* **2.153.0** — **The preflight card itemizes; scene durations; thumbnail
  cast** (Tim's card: "node 17 (MiniMaxH3ChainLoopStart): ValueError: H3
  preflight error: 2 error(s), 2 warning(s), 3 scene(s)." — a count is not
  a reason). (1) The pack puts its itemized errors and warnings on the
  FOLLOWING lines of the same exception; comfy_client.culprit_details now
  extracts them (traceback tail as fallback), the worker says each as a
  "[comfy]   <detail>" continuation, and the scene card carries up to two
  beside the summary — so the card names WHICH scene and WHICH rule, not
  how many. (2) Every scene card gains a duration input in SECONDS beside
  💾 (frames in the plan at 24 fps, the H3 unit); a changed duration is a
  changed scene — back to idle, last take kept for preview — with a
  legacy guard so boards saved before records carried lengths do not reset
  on their first write. (3) Character cards are compact roster rows with a
  56px thumbnail (by instruction — replaces the 2.150.0 full-width slot
  look), Picture N mapping in the text and tooltip.

* **2.152.0** — **Every model writes screenplays, not just one** (Tim: "the
  majority of my llms like supergemma4uncensored are not populating the
  scenes in video, only one of them does"). Three causes, all real: (1)
  many chat templates — the Gemma family most famously — RAISE on the
  system role, and llama-server answers 500; the writer sent its whole
  guide as a system message, so every such model died with a bare "LLM
  returned 500" while one template happened to accept it. complete() now
  folds the instructions into the head of the user turn and retries once —
  nothing lost, and the screenplay's warnings say what happened. (2)
  llama-server's default context is 4096 tokens and the screenplay's
  instructions alone can pass that; the server now gets an explicit -c
  from the new llm.ctx setting (default 8192, 0 = the model's own training
  context; Settings → LLM). (3) failures were blind: server error BODIES
  now reach the user ("System role not supported" instead of a status
  number), and a reply that would not parse shows the model's own opening
  words — a refusal, a ramble and a truncation each read differently.
  The stub-llm faithfully refuses the system role on demand (seventh
  faithful-mock repair), and the e2e proves the fold rescues it.

* **2.151.0** — **The movie file menu** (by instruction: "add a file menu
  bar at the top of the videodock tab, New ... load ... save ... compile").
  A movie is everything the docker shows, as one bundle under the project's
  movies/ folder (lib/movies.js): the cast with its sheet and voice FILES,
  the chapters, the scenes (plan + statuses + takes, with job ids and the
  render queue blanked — a loaded movie never resurrects dead machinery),
  and the rendered takes themselves. 🆕 New clears the docker WITHOUT
  deleting anything: the cast folders are MOVED into a timestamped stash
  under movies/, the board is blanked, and the gallery's render files stay
  put (armed-double-press confirm — Electron has no native confirm()).
  💾 Save replaces its named movie; 📂 Load writes the cast back (files
  restored if missing), returns the takes to the project's Video assets so
  the gallery shows them, and the saved board replaces the current one.
  🎬 Compile joins EVERY rendered take of the loaded movie in scene order
  through the same flat-timeline export path Produce uses (Produce joins
  only the KEPT scenes; scenes.allOutputs is Compile's list, upscaled
  preferred).

* **2.150.0** — **The chain answers to you** (by instruction, six parts).
  (1) Basic Settings gains a **Character chain** tab exposing the MM3
  export's own per-shot inputs — steps, length, continuation_mode, context
  lengths, blend frames, source_reference, generated_continuity. Saved to
  config.chain (REPLACE semantics: an emptied field means the export's own
  default), applied by screenplay.normalize to every NEW scene; a scene's
  own values always win, so existing plans never shift under you. This
  also answers "are the character workflows using my basic settings?":
  resolution comes from Basic Settings; steps/length/prompt ride the PLAN
  — and this tab is now where the plan's defaults come from. (2) Character
  cards wear the refs dock's thumbnail look (full-width 4:3 tile) with the
  chain's **Picture N** number overlaid — the numbering <Picture N> prompts
  address, cast order, each character's sheets in listed order, then
  environment views; the screenplay guide now teaches the model the same
  phrasing (the vocabulary is the export's own: "takes <Picture 1> as
  reference"). (3) Clicking a character opens the editor prefilled (name
  locked — it is the folder key) with new pronouns + wardrobe fields; new
  uploads ADD sheets/voices, nothing is replaced. (4) Adding a chapter now
  CLEARS the board — scenes, render queue, plan shots — keeping the shared
  prompt and every rendered take in Video assets: finish a chapter,
  produce it, add the next. (5) Token slider ceiling raised to 128k.

* **2.149.0** — **Render selected** (by instruction: "add a checkbox to
  each scene. and an add all checkbox, add a render selected button").
  Every scene card has a selection checkbox; a select-all checkbox in the
  board bar mirrors reality (checked only when every scene is); ▶ Selected
  renders the ticked scenes ONE AFTER ANOTHER: the route starts the first
  and stores the rest as record ids in the board's render queue
  (scenes.queueRenders), and the board poll (syncJobs) launches each
  successor when its predecessor finishes — the tmp graph is rewritten per
  scene at queue time, so two live scene jobs would race on it and both
  render the last-written scene. Queued scenes wear a ⏳ queued badge; the
  queue lives in the .prj (ids, not numbers, so a plan edit mid-queue
  cannot shift which scene an entry means, and deleted shots drop out);
  scenes already rendering or already queued are skipped, never doubled.

* **2.148.0** — **Preview dock, LLM token budget, hybrid offload** (by
  instruction). (1) Everything above the timeline — the player, its
  controls, the 360° viewer — now lives in a Preview dock: collapse header,
  maximize, a status-bar Preview toggle, remembered across restarts. It is
  the one FLEX dock in the column (no height var), so it takes whatever the
  fixed-height docks leave. (2) The settings docker shows a live ≈token
  count of the Prompt box (an honest 4-chars-per-token estimate, labelled
  as such) and a reply-budget slider saving llm.max_tokens (128–8192);
  llmChat's default budget follows it, and the screenplay writer keeps its
  4096 floor — the slider can only raise it. (3) Settings → LLM gains GPU +
  CPU/RAM offloading: gpu_layers -1 = all layers on GPU (the old -ngl 99),
  N ≥ 0 = hybrid — llama-server keeps N layers in VRAM and streams the rest
  from system RAM, so a bigger model fits beside a render.

* **2.147.0** — **The chain pipeline survives whole** (Tim: "check the
  workflow for the character ref, make sure it runs to the end. i am getting
  a high noise render that doesn't complete"). Four defects, all found by
  running the real patcher on the shipped MM3H_Character_ref.json: (1)
  resolve_steps mistook the upscale stage's BasicScheduler literal (steps=1,
  denoise=0.2) for "the template's base literal" — ONE step on the main
  sampler is a render that is mostly noise; a partial-denoise scheduler is a
  refine pass and never supplies the base count. (2) The sink-ancestor prune
  deleted everything DOWNSTREAM of ChainSegmentSave — ChainReview,
  ChainLoopEnd, ChainAssemble and both decodes — so the loop never closed
  and the film was never assembled; "assemble" joins the sink vocabulary.
  (3) The stamping loop overwrote ChainCurrent LINKS (the plan's per-shot
  prompt/seed/length/size/steps) with one literal each; a chain link is now
  never overwritten and the log says which inputs ride the plan. (4)
  ChainReview enabled=True gates every segment on a reviewer an API run
  does not have (10 min idle each); it is turned off for the run, reported,
  the export untouched. Steps 0 is now a do-not-write sentinel end to end,
  a refine scheduler keeps its exported count even under an explicit user
  step count, and the stub — faithful again — rejects BasicScheduler
  steps<1 exactly as real validation does.

* **2.146.0** — **The editable Scene Board** (Tim: "put an add scene button,
  make all the scenes editable, with an icon only save button, add a shared
  prompt input. populate the shared prompt like the example shows with
  character assignments and tags"). Every scene card's prompt is now a
  textarea with an icon-only 💾; a ＋ Scene button appends a shot (normalize
  assigns the id, a digit-built seed, the export DEFAULTS and chains
  visual_context_source — the same one copy of those rules every plan writer
  uses); a shared prompt box edits the plan's prompt_prefix, with 👥
  populating it from the cast via screenplay.buildPrefix (subject
  definitions, @tags, voice assignments in (S1)/(S2)) — filled, never saved
  behind the user's back. New routes /api/scenes/prefix, /api/scenes/:n/
  prompt, /api/scenes/add and GET /api/screenplay/prefix all funnel through
  the ONE normalize→validate→fromPlan gate, so an invented @tag is refused
  exactly as the writer refuses it and an edited scene resets to idle while
  every other scene keeps its status. The 4-second poll never wipes an edit
  in progress (repaint guarded while an editor has focus).

* **2.145.1** — docs only: HANDOVER's "Continuing in a fresh conversation"
  section told the next session to upload the 2.129.0 flat zip — pinned
  sixteen releases ago and never noticed since, because a version literal
  in continuity notes rots silently. Now version-agnostic: upload the
  LATEST flat zip, whose filename must match package.json.

* **2.145.0** — **Stable tags + the selected LLM** (both from Tim's Scene 1
  card, now naming real culprits). (1) His pack validates the reference tag
  widget — "Reference tag must be a stable tag such as 'hero_face' or
  '@hero-face'" — and buildChain's voice tag carried a space ("<tag> voice").
  New `chars.tagOf()` is the one spelling of the stable-tag rule (lowercase
  letters/digits/_/-); voice tags are now `<tag>_voice` by instruction;
  environment tags go through the same helper; and the worker repairs any
  remaining unstable tag on a Scheduled*Reference at patch time (old tmp
  files, the verbatim MM3H-Character-ref demo tags), reported old→new — the
  canonicalise_combos doctrine: same tag, accepted spelling, never a guess.
  The stub now refuses unstable tags with the pack's own ValueError, so a
  spaced tag can never pass the suite again. (2) "it is not loading the llm
  that i select": the screenplay route never passed the dropdown's pick, so
  `complete()` fell back to the alphabetically-first .gguf — and ensureLlama
  then STOPPED the loaded model to start the wrong one. The client now sends
  `llm_file`, the route passes it through, and `complete()` with no explicit
  file prefers the model ALREADY RUNNING (the user's loaded pick) over
  files[0], which fixes every LLM-consuming route at once.

* **2.144.0** — **The chain's voice loaders are managed at last** (Tim's
  Scene 1 diagnosis: "the input nodes (image) and voice have not been filled.
  only one was filled"). The MM3 chain's voice loaders are
  `VHS_LoadAudioUpload` — absent from the worker's `LOADER_KINDS`, so the
  slot report said "0/0 audio", the uploaded voice never reached the node
  (it kept the tmp file's project-disk basename, right only by coincidence
  of names), and an unused voice slot could never be pruned. Now: the class
  is in the table (input key `audio`, from Tim's own export), voices fill
  with the name ComfyUI's upload actually returned, unused slots prune, and
  the count shows (`1/1 audio`). Pruning a mid-chain reference now HEALS the
  chain instead of killing everything downstream: `previous` joins
  `references` as a rewired-never-cascaded link, and a removed reference is
  reported by name with its tag. buildChain builds a loader + reference for
  **every** sheet and **every** voice ("add nodes if more pictures or voices
  are added"), all under the character's one tag, first-asset ids unchanged
  so slot alignment never moves; queueScene sends the files in the same
  walk. The stub is faithful again: a `VHS_LoadAudioUpload` naming a file
  never uploaded fails at execution exactly as the real server would.

* **2.143.1** — **The execution-error verdict names the real culprit.**
  Tim's Scene 1 card showed "check the MiniMax H3 nodes exist ... model files
  sit inside ComfyUI's OWN models folders" — advice that is wrong by
  construction for an EXECUTION error (missing node classes and unknown model
  filenames are rejected at /prompt validation and never reach execution).
  `comfy_client.execution_culprits()` reads the node id, class and exception
  out of ComfyUI's own history event; the worker now says a
  `[comfy] node <id> (<class>): <type>: <message>` line and fails with
  "ComfyUI execution error in node <id> (<class>): ..." so the scene card and
  the queue both name the true failure. `scenes.reasonFromLog` prefers those
  lines and no longer repeats the node when the verdict already names it.
  Stub gains a `generic` error kind; e2e proves the misleading advice is gone.

* **2.143.0** — **New video style: MM3H-Character-ref.** Tim's Short Film
  Director + Upscale export (52-node API graph: the full chain family,
  scheduled picture/audio references, in-graph Sage accelerator and the
  upscale stage), saved verbatim as `comfy_workflows/MM3H_Character_ref.json`
  and served for **ref2va** via the style's per-mode workflow map. Unlike
  MM3_Characters it does not render through the cast-rebuilt TMP file — the
  export is untouched, its own references included; no model/te/vae on the
  style, the graph's loaders are the single source of truth. Seeded on
  existing installs (legacy-stamp pin extended). Tests: +1.

* **2.142.6** — **Fix: scene renders died with "worker exited with code 2"
  when ComfyUI wasn't up.** Two halves. (1) The likely cause: the ordinary
  Generate button's client calls `/api/comfy/ensure` before queueing, but the
  scene board's ▶/⏫/redo went straight to the queue — on a machine where
  ComfyUI hadn't started yet, the worker met "ComfyUI is not reachable" and
  exited 2. The scene routes now ensure ComfyUI SERVER-side (force — this
  style always renders on ComfyUI) and refuse with a clear 502 if it cannot
  start, instead of queueing a doomed job. (2) The card's failure reason was
  the shell's shrug: "exited with code 2" carries none of the extractor's
  keywords, so the real `[worker] …` verdict printed just above it was
  skipped. `scenes.reasonFromLog` now prefers the worker's verdict, includes
  ComfyUI's per-node culprit lines on a rejected workflow (they name the
  exact input), never selects the exit line, and is pinned in tests — so the
  card now reads e.g. "ComfyUI is not reachable at … Start it first" or
  "node 5108 (MiniMaxH3ReferenceToVideo) input 'vae': Required input is
  missing" rather than an exit code. Tests: +3.

* **2.142.5** — **Empty "[Shot N]" scenes refused, and a failed render now
  says WHY on its card.** From the report "[Shot 1] … [Shot 4], it still
  doesn't write any story, and it doesn't render". (1) A model that puts the
  "[Shot N]" marker on a line of its own no longer produces marker-only
  scenes: normalize() glues a bare marker to the next action line, the card
  preview skips the marker and shows the actual action, the guide says
  outright that the marker is a PREFIX and never a whole line, and — the
  backstop — a shot whose prompt is ONLY a marker is now a validation ERROR
  naming the shot, because rendering an empty scene for its full length burns
  the queue for nothing. (2) A scene whose render fails no longer slips
  silently back to idle: the board keeps the worker's last meaningful log
  line on the record and shows it in red on the card ("⚠ …"), a fresh ▶
  clears it, and a kept scene that fails an upscale stays kept. Whatever
  stopped your render will name itself on the next attempt. (The quoted
  "Basic Settings took nothing (no defaults set)" text does not exist in
  this codebase — with the reason now on the card, the real message will be
  visible verbatim.) Tests: +2 screenplay, +3 scenes, +2 sceneui DOM.

* **2.142.4** — **The screenplay writes a STORY, and the story lands on the
  timeline.** Three changes from one report. (1) The twelve identical "no
  blank lines between beats" warnings are gone because the condition is now
  REPAIRED, not reported: `normalize()` inserts the blank line the model
  forgot between every two beats — except between a speaker line and the
  `<d>` dialogue answering it, which are one beat and stay glued — collapses
  blank runs, and leaves already-spaced prompts untouched; every route
  validates the normalized plan, so a warning now only means something
  normalize could not fix (and the chat collapses any future repeats into
  "N shots: …"). (2) The writer's guide now demands ONE CONTINUOUS STORY —
  establish, escalate, land; every shot picks up where the last left off,
  same place/wardrobe/light, locations named with the same words, with
  `visual_context_source` chaining shots that continue in place. (3) New
  **⇥ Timeline** button on the scene board: the kept scenes, in story order,
  are written as the clips of a timeline named `screenplay` (a real file in
  `projects/<p>/timelines/`, the same ones the Timeline dropdown lists) and
  it becomes the project's ACTIVE timeline — the docker opens on your film,
  ready to edit; your other timelines are never touched. Endpoint:
  `POST /api/scenes/to-timeline`. Tests: +5 normalize unit, +2 sceneui DOM,
  +2 e2e (the timeline file's clips and the active-timeline flip are
  asserted on disk).

* **2.142.3** — **Fix: "⚠ the model did not return a JSON plan" on every
  screenplay.** Three real bugs, one seam nobody tested. (1) The route
  unwrapped the LLM reply TWICE: `llmChat.complete()` already returns the
  read reply, and calling `readReply()` on it again found no `choices`,
  produced an error object, and stringified it into `"[object Object]"` — so
  every screenplay failed no matter what the model said. (2) The call rode
  the default **600-token** budget; a whole plan never fits, so even a fixed
  unwrap would have met JSON cut off mid-object. The writer now asks for
  4096. (3) The parser took "first `{` to last `}`" in one `JSON.parse` —
  real local-model replies wear `<think>` blocks whose reasoning itself
  contains braces, fences of any language, prose, and trailing commas.
  `parseReply` now strips thinking (an unclosed block truncates, same rule as
  the chat), drops fences, scans for BALANCED objects with a string-aware
  brace counter, salvages trailing commas, and prefers the object with a
  `shots` array; `parseProblem` says WHY a reply failed ("cut off mid-JSON —
  the model ran out of output tokens" vs "no JSON object at all"), and the
  422 now carries that reason. The missing seam is now tested:
  `scripts/stub-llm.py` — a stub llama-server that records every request and
  replies wearing think-block-with-braces + fence + prose + trailing comma —
  drives `POST /api/screenplay` end to end in the suite, asserting the plan
  parses AND that the app requested the 4096 budget. Tests: +12 parser unit,
  +2 e2e.

* **2.142.2** — **Fix: the Video docker wrecked the whole dock layout when
  visible.** Root cause found by structural parse: since 2.134.0 the Video
  docker was a grid `<aside>` with NO grid column of its own (and zero CSS
  rules — its grid integration was lost the same silent way as 2.142.1's
  button), so CSS auto-placement slid every dock one column over whenever it
  was on screen: the refs button resized the Video docker, the assets dock
  landed in the main 1fr track and "took most of the screen", and the other
  docks fell off the grid — exactly as reported. The markup was never
  unbalanced; the parse proves all tags matched. Per instruction, the Video
  docker now lives **under the Timeline docker** as a proper block, like the
  Image editor: collapse it from its header or the new **Video** button in
  the status bar, drag the splitter above it to resize (persisted, `--vh`),
  maximize with ⛶; its long content scrolls inside the block. The grid is
  back to its five docks and every dock button toggles its own dock again.
  Regressions pinned: `test-sceneui.js` (23 checks now) asserts videodock is
  a block directly under the timeline, that the grid has exactly its five
  asides, and that the status-bar toggle exists; `test-imagedom.js`'s dock-
  order pin updated to Timeline → Video → Image editor → ComfyUI.

* **2.142.1** — **Fix: the ⏫ upscale button never rendered.** The 2.140.0
  upscale queue shipped its endpoint, its state, its badge and its click
  handler — but the button itself was added by a scripted edit whose search
  string didn't match, and that kind of edit fails SILENTLY: the handler
  waited for buttons that never existed, so the upscale queue was unreachable
  from the UI. The button is now really in the scene card (on every rendered
  scene; hidden while rendering; disabled while that scene is queued), and —
  the actual fix — a new DOM regression suite (`scripts/test-sceneui.js`, 18
  checks, in the e2e) renders the docker against the page's own markup with
  canned data and asserts every control EXISTS and posts to the right
  endpoint: play, ⏫, keep/redo/produce, chapter select, environment rows,
  camera-edit saves, and that the preview prefers the upscaled take. A UI
  feature is not shipped until a test has seen it.

* **2.142.0** — **360° environments for scene continuity.** Tim asked whether
  360 environment pics could ride the workflow to keep locations consistent —
  yes, because the chain's references are tagged and scene-ranged
  (`MiniMaxH3ScheduledPictureReference`), not character-specific. A new
  **Environments (360°)** block in the Video docker holds locations: each is
  a 360 equirect pano plus a camera (yaw/pitch/fov — the SAME conventions the
  2.119.0 360 viewer pinned in `VR360.math`, verified against it in tests, so
  what you frame in the viewer is what the render sees) plus a scene range.
  The pano is never fed to the model raw: ffmpeg's `v360` filter projects it
  into a flat camera view (`lib/environments.js`, cached, re-projected when
  the pano or camera changes), and that view rides the reference chain AFTER
  the cast — character `<Picture n>` numbering never shifts — with the
  location's `@tag` and its scene range, so every scene set there references
  the same place. The screenplay writer is told which location tags exist and
  keeps their wording identical across a range; the validator accepts
  environment tags in shots but rejects a location that "speaks". Scene
  renders upload the view beside the cast sheets (slot order pinned).
  Endpoints: `GET/POST/DELETE /api/environments`,
  `POST /api/environments/:name/pano`, `GET /api/environments/:name/file/:f`.
  Tests: +24 unit (`scripts/test-environments.js`, including the ffmpeg-vs-
  viewer projection agreement, sampled pixel by pixel), +5 e2e.

* **2.141.0** — **Pluggable upscale workflow (Comfyui_Minimax_h3_latent_Upscaler
  support).** Tim asked whether the LBH-123-AI pack could provide the missing
  video→AV-latent encode. Verified from its source: **it cannot — the pack has
  no encoder**; every node is latent→latent. What it does ship is valuable:
  learned 2D/3D latent upscalers (`MinimaxH3LatentUpscaler3D`, checkpoint in
  `ComfyUI/models/latent_upscale_models/`) and `MMH3SplitUpscale` — a
  decomposed, improved successor of the `UltimateUpscale` family already in
  Tim's graph — plus example workflows showing the fast pattern: low-res
  generation → `LTXVSeparateAVLatent` → 3D latent upscale →
  `LTXVConcatAVLatent` → short tail-refine (`SplitSigmas`) → decode. To use
  any of that, the upscale queue is now pluggable: **save your own upscale
  export as `comfy_workflows/MM3_Characters_upscale.json`** and every ⏫ job
  drives it instead of re-rendering through the chain — the scene's rendered
  take is uploaded and rides into the export's `LoadVideo` slot (the worker
  already assigns ref videos to `LoadVideo` loaders), the cast's sheets fill
  any `LoadImage` slots, and the job carries the shot's own seed so the
  conditioning matches the take. Without the file, the 2.140.0 fallback
  (re-render with the upscale stage kept, same plan seeds) still works and
  the response names the file to provide. The file is machine-local: zips
  never include it and never overwrite yours (gitignore + make_zips agree).
  Tests: +7 e2e, including one upscale driven end to end through a temporary
  export fixture.

* **2.140.0** — **Fast renders + a one-at-a-time upscale queue.** Tim asked for
  a boolean and a LoadVideo node in the workflow to separate the upscale; the
  honest mechanics differ: API-format ComfyUI has no conditional execution (a
  graph "boolean" is Ctrl+B bypass, which is physical removal — the rule this
  app's LoRA and accelerator bypasses already follow), and no node verified in
  Tim's own exports encodes a video back into an H3 AV-latent, so a
  load-video→upscale graph cannot be assembled without guessing node names.
  What shipped instead does the same job reliably: **a plain scene render now
  strips the in-line `MMH3UltimateUpscale` stage** (`worker._strip_upscale` —
  consumers rewired to the un-upscaled sampler latent, the stage's private
  feeders swept by the existing sink-ancestor prune), so drafts render fast;
  the **⏫ button on a rendered scene adds it to the upscale queue** — each
  press queues one job through the app's one-at-a-time generate queue, so
  several scenes upscale strictly one after another. An upscale re-renders
  that scene through the SAME chain with the upscale stage kept and the same
  plan seeds, and the result is filed beside the base take as
  `scene<n>_<chapter>_upscaled` — keep status is untouched, and Produce
  prefers the upscaled take automatically. Double-queueing a scene is refused
  (409); redo clears a pending upscale; a failed upscale is forgotten without
  losing the base take. The stub now records each queued graph's class list
  (`_classes`), so the suite proves the fast graph lacks the upscaler and the
  upscale graph contains it. New endpoint: `POST /api/scenes/:n/upscale`.
  Tests: +7 patcher, +9 unit (68 in test-scenes.js), +8 e2e.

* **2.139.0** — **The Scene Board is live in the Video docker.** Ask the
  assistant to "create a screenplay …" and the request routes to the
  screenplay writer instead of an ordinary chat turn (the matcher lives
  server-side at `/api/screenplay/intent`, one copy; a question *about*
  screenplays stays a chat turn). Applying a screenplay derives one scene card
  per shot — the plan is the truth, and it now rides with the board in the
  `.prj`, so a cast change rebuilding the tmp graph can no longer lose it.
  Each card has a circular play button that renders exactly that scene through
  the existing queue: the stored plan is written back into
  `MM3_Characters_tmp.json`, `scene_range` is set to `n:n`, and the cast's
  sheets and voices ride as the job's references in cast order so the chain's
  loaders fill instead of pruning. A finished take is filed into the project's
  Video assets as `scene<n>_<chapter>.mp4` (gallery- and timeline-visible;
  a redo's second take is uniquified, never an overwrite). Under the board: a
  chapter adder, a preview player for the selected scene, icon-only keep/redo
  (keep is idempotent — in this workflow the upscale is in-line, so every
  render is already upscaled and keep marks the take), and **Produce**, which
  joins the kept scenes in story order through the timeline's own compile
  path. A failed or vanished job drops its scene back to idle instead of
  showing "running" forever. Endpoints: `GET/POST /api/scenes`,
  `/api/scenes/chapters`, `/api/scenes/:n/{chapter,generate,keep,redo}`,
  `/api/produce`, `/api/screenplay/intent`. Tests: +8 unit (60 in
  test-scenes.js), +12 e2e driving the real endpoints through the stub.

* **2.138.0** — **The Scene Board's foundation: the scene state model.**
  `lib/scenes.js` holds one record per screenplay scene — chapter, prompt,
  status (idle/running/rendered/kept), the rendered take, the upscale and the
  seed — persisted in the project's `.prj` file under its own `scenes` key so
  nothing else stored there is touched, and restored on project load. The plan
  is the truth: records are derived from `plan_json.shots` and re-deriving
  after a rewrite carries render state over by shot id, drops an edited scene
  back to idle (its old take stays attached for the preview) and removes
  records for shots that no longer exist. `keep()` is idempotent — the second
  press reports no change, which is what stops a double upscale — and
  `redo()` clears the upscale but keeps the last take. Rendered scene files
  are named `scene<n>_<chapter>` through the one slugger the project already
  has. Also: `screenplay.wantsScreenplay()` — the narrow chat-box matcher that
  routes "create/make/write a screenplay…" to the screenplay endpoint while a
  question *about* screenplays stays an ordinary chat turn. No UI yet: this is
  build-order step 1 of the Scene Board, tested with no server and no ComfyUI.
  Tests: +52 (`scripts/test-scenes.js`).

* **2.137.0** — **Character descriptions and voice assignments are written into
  the scene plan for you.** Each character's `subject_definitions:` paragraph is
  built from their profile — tag, age, height, weight, pronouns, distinguishing
  features and wardrobe, ending with the do-not-redesign clause the pipeline
  expects — and a `voice_assignments:` paragraph gives every character a speaker
  slot, noting where a voice reference exists. Both go into the plan in the
  workflow's default format, and the model is told to leave them alone and write
  the shots. A character who changes slot part-way through, or two characters
  sharing one, is refused: that swaps voices mid-film. A slot recorded in a
  profile is binding; where none is recorded, only consistency is enforced.
  Tests: +26.

* **2.136.0** — **The LLM can write for this pipeline now.** MiniMax H3 doesn't
  take a screenplay; it takes `MiniMaxH3ChainPlan`'s `plan_json`, which has its
  own grammar — beats as separate lines, `@tag` for every character, dialogue as
  a speaker line followed by `<d>[English] …</d>`, and each shot continuing from
  the one before. `lib/screenplay.js` teaches the model that grammar, with the
  shot settings read out of the working export rather than retyped, and names
  the @tags it is allowed to use. Everything the model sends back is checked
  before it can reach ComfyUI: the check that matters is that a character with
  no reference sheet is refused, because that renders as a stranger and looks
  exactly like character drift. Ask for a scene at `/api/screenplay`, then apply
  it. Tests: +30.

* **2.135.0** — **MM3_Characters is a video style now.** It appears in the video
  style list on a fresh install and on an existing one, and it names no
  checkpoint, text encoder or VAE: the workflow was built in ComfyUI and its own
  loaders are the single source of truth. It renders through
  `MM3_Characters_tmp.json`, which is rebuilt from the Video docker's cast
  automatically whenever a character is added, changed or removed — so a render
  can never go out with the previous cast, and the file exists from the moment
  the app starts.

* **2.134.0** — **The Video docker, with characters.** A new docker called
  *Video* carries your cast on the left: **NEW** opens a dialog for a
  character's name, age, height, weight, character sheet and voice clip, all
  saved to `projects/<project>/characters/<name>/` with the `.profile` as JSON
  the LLM reads directly. **Build** rewrites `MM3_Characters_tmp.json` from
  whoever is in the cast — one picture node and one voice node per character,
  chained and wired into the generator, with the shipped style left untouched.
  Scene controls sit under the cast: start clip, scene range, and *redo scene N*,
  which drive `MiniMaxH3ChainLoopStart`'s own `start_clip` and `scene_range`
  inputs. A character missing a sheet or a voice is named on the card and in the
  build notes rather than quietly dropped. Tests: +9 e2e, and a fix to a UI
  guard that `accept="image/*"` had been silently disabling. 

* **2.133.0** — **Characters: the profile store and the reference chain.** Your
  Short Film Director pipeline is saved as `comfy_workflows/MM3_Characters.json`.
  A character now lives in its own folder —
  `projects/<project>/characters/<name>/<name>.profile` holds the name, age,
  height and weight as JSON the LLM reads directly, with the character sheet and
  voice clip alongside it. `lib/characters.js` rebuilds the workflow's linked
  reference chain from whatever cast you have: one picture node and one voice
  node per character, strung together and wired into the generator, with the
  style's own demo characters stripped out. A character missing a sheet or a
  voice is reported by name, never quietly skipped. The docker UI, the upload
  routes, `MM3_Characters_tmp.json` and the scene controls are not built yet —
  the design and build order are in HANDOVER.md. Tests: +25.

* **2.132.1** — **Fixes "I can't connect to the link".** The network port is
  opened when the app starts, so ticking the remote box and creating a link
  without restarting produced a QR pointing at an address nothing was listening
  on — and the phone just failed with no explanation. Creating a link is now
  refused in that state, with the reason and the fix. Settings also lists every
  network address this computer has: a Windows machine with WSL, Hyper-V,
  VirtualBox or a VPN has several, only one of which is the Wi-Fi your phone is
  on, so if the first QR doesn't reach, you can try the others by name.

* **2.132.0** — **Use the studio from your phone.** Settings → General now has
  *Create remote link*: tick the box to let the computer be reached from your
  network, restart, and scan the QR code with your phone. The phone page can
  take photos and video with the camera, pick from the gallery, send audio, and
  talk to the model by voice or text — everything it sends lands in the current
  project. Exactly one phone is connected at a time; pairing a new one
  disconnects the old. The pairing code works once and expires after ten
  minutes, and the phone holds a sealed cookie whose key never leaves your
  machine. Until you turn it on, the server still listens only on this computer.
  The QR encoder is built in — no internet, no npm package. Tests: +36.

* **2.131.0** — **Remote phone access: the security core.** `lib/remote.js`
  holds the pairing and session rules for using the studio from a phone: an
  AES-256-GCM sealed cookie whose key is generated once on your machine, a
  one-shot 10-minute pairing code (minting a new one invalidates the QR still on
  screen), and a hard single-connection rule — pairing a phone evicts whatever
  was connected before. The server keeps binding to `127.0.0.1` until remote
  access is explicitly switched on. The QR button, the phone UI and the upload
  and voice-chat routes are not built yet; the design and the order to build
  them in are in HANDOVER.md. Tests: +24.

* **2.130.0** — **The character no longer changes every 15 seconds.** Long clips
  render in chunks, and each chunk after the first was handed the previous
  chunk's last frame as a "first frame" while the reference images were dropped.
  That is right for a keyframe workflow — but the MiniMax H3 templates are
  *reference* workflows (`MiniMaxH3ReferenceToVideo` has `ref_image_0` and no
  `first_frame`), so the hand-off frame silently became the only reference, and
  the model re-rolled the character from one arbitrary, often motion-blurred
  picture at every join. Now the references travel with the hand-off: a
  reference template gets your reference images *and* the hand-off frame in
  every chunk, a keyframe template still gets keyframes, and either way the log
  says which and why. With no reference image at all, chunk 1's opening frame is
  extracted once and anchors every later chunk, so drift stays bounded instead
  of compounding. Tests: e2e (+2, a real two-chunk render on the shipped H3
  scene template), test-patcher (+10).

* **2.129.0** — **A broken accelerator no longer costs you the render.** Sage
  attention and Spectrum are third-party patches that reach inside ComfyUI's
  MiniMax H3 model, and when one of them is out of date it fails *late* —
  ComfyUI runs the expensive encode first and only then reaches the patched
  sampler, so a doomed node used to throw away minutes of GPU work. Now, when a
  failure names an accelerator the render injected, that one node is removed
  (its consumers rewired to its own model input) and the graph is queued again:
  ComfyUI keeps its execution cache, so the retry costs seconds, not another
  full render. Only the accelerator that failed is dropped, and only once — a
  Spectrum failure never costs you Sage. Two failure shapes are recognised by
  name: the sageattention wheel built for the wrong torch, and the
  `FinalLayer.forward() missing ... 'sigma', 'sample_sigmas', 'shifts'`
  TypeError that means a pack predates ComfyUI 0.34 (which moved sigma shifting
  into the model and ships its own `MiniMaxH3SigmaShift` node). When Spectrum
  is used against a 0.34 server the log says so *before* the first queue.
  Tests: e2e (+7), test-patcher (+14), test-comfyfree (+28).

* **2.115.1** — **New chat clears the window.** 🆕 now starts a fresh session
  *and* the window and the model's context show only that session — before,
  the window reloaded the last two days of every session, so the old
  conversation came straight back. Earlier sessions stay on disk under the
  project's `chat/` and `GET /api/chat?session=all` still lists them.

* **2.115.0** — **Checkpoint override in Basic Settings → image.** (Tim's
  instruction.) A ComfyUI checkpoint combo sits above the temporary LoRAs;
  pick one to test it and every image render uses it in place of the
  selected style's checkpoint, until it's set back to "— the style's
  checkpoint —". Remembered per browser; the style file is never changed.
  Sent as `model` with the image job. Tests: jsdom (+4), e2e (+1).

* **2.114.0** — **The chat's prompt picks the mode.** (Tim's instruction.) In
  chat mode, ask for a picture and the assistant writes an image prompt for
  the selected image style; ask for a video and it writes an H3 video
  prompt — and the app follows: the Generate mode (and so Basic Settings)
  switches to image or video and the prompt lands in the prompt box, ready
  to Generate. The chat stays open. The assistant marks each fenced prompt
  with its kind (`image` / `video` / `music` / `speech`); an untagged fence
  leaves the mode alone. The chat's system prompt now carries the H3 video
  guide in chat mode as well as the selected image style's guide. Tests:
  jsdom (+5).

* **2.113.1** — **Fix: new starter styles never appeared on older installs.**
  An install whose `styles/.starters` stamp predates 2.90.1 (an ISO date
  rather than a list) treated *every* image starter now in the code as
  already seeded, so SDXL, SDXL img2img, Pony, Illustrious and FLUX Fill
  inpaint were never created there. The legacy set is now pinned to the
  five FLUX.2 starters that actually existed then; the next start seeds the
  rest once and turns the stamp into a list. Nothing you saved is touched.

* **2.113.0** — **Queue tabs and a per-project job list.** (Tim's instruction.)
  The Queue dock has **Pending** (queued, running, and jobs a restart
  interrupted) and **Done** (finished, failed, cancelled) tabs, with counts;
  the choice is remembered. Every job is written to
  `projects/<name>/jobs.info` on each transition, marked `pending` or
  `done` — a job stays with the project it was started from — and the list
  reloads when the project opens. History entries offer **Open** (done) or
  **▶ Resume** (interrupted: re-queued with the same id and settings, so its
  files carry on) and **✕** to drop the entry (output files untouched). New
  `lib/jobsInfo.js`, `GET /api/jobs/history`, `POST
  /api/jobs/history/:id/resume`, `DELETE /api/jobs/history/:id`. Tests:
  lib (7), e2e (+9), jsdom (+6).

* **2.112.0** — **SDXL / Pony / Illustrious out of the box.** Two core-node
  graphs, `comfy_workflows/img_sdxl_t2i.json` and `img_sdxl_i2i.json`
  (img2img from the reference dock's first picture at denoise 0.65; the
  output follows the picture's size), and four built-in image styles —
  **SDXL**, **SDXL img2img**, **Pony** (clip skip 2, score_ negatives) and
  **Illustrious** (clip skip 2, Danbooru negatives). Set the checkpoint in
  Settings → Image (until then the graph's own `sd_xl_base_1.0` name is
  used, and the preflight says so if ComfyUI lacks it). The patcher
  learned **clip skip**: a style's `clip_skip` N becomes
  `CLIPSetLastLayer.stop_at_clip_layer = -N` (a graph without that node
  ignores it). Infill for these styles goes through the SDXL inpaint export
  automatically; the prompt guides pick Pony / Illustrious from the
  checkpoint's file name. Tests: patcher (+6), e2e (+1).

* **2.111.6** — **Basic Settings → image are the render settings.** (Tim: the
  size preset wasn't reaching the render.) Two causes: every style change
  reset the Resolution picker back to "Style's own", and size / steps / cfg
  were only sent when their "touched" flag was set — a flag that same reset
  cleared. Now the chosen resolution + aspect are the user's (remembered per
  browser, kept across style changes) and always go with the job unless
  "Style's own" is selected; the Steps and CFG sliders, seeded from the
  style, are always sent — so what Basic Settings shows is what renders.

* **2.111.5** — Basic Settings → image: the temporary-LoRA frames no longer
  show the folder filter; the LoRA dropdown lists every folder's files (the
  subfolder is part of the name). The video frames are unchanged.

* **2.111.4** — Settings → Video: the saved styles are a dropdown above the
  form (with "— new video style —" first) instead of a list column, so the
  form has the dialog's full width. New / Duplicate / Delete sit beside it.

* **2.111.3** — **Video styles carry presets, Basic Settings renders.**
  (Tim's instruction.) A video style's default size is a resolution preset
  (480p / 540p / 720p / 1080p) plus an aspect (16:9 … 21:9) rather than
  pixels. Picking a style under the prompt makes **Basic Settings inherit**
  its resolution, aspect, and phase 1's steps and cfg; Basic Settings is
  then what the render uses, so any of them can be changed per render.
  Consequently the worker no longer writes phase 1's steps/cfg from the
  style — later phases still keep their own. Tests updated (+4).

* **2.111.2** — Settings dialog widened to `min(1240px, 96vw)` (scrolls
  inside on small screens). Video tab reworked: the saved-styles list is a
  fixed column beside the form, and each phase is a frame — header with its
  number and ✕, the checkpoint combo on its own full-width row, steps and
  cfg side by side. (Tim's instruction.)

* **2.111.1** — Temporary-LoRA rows in Basic Settings are now individual
  **frames** sized to the dock: the folder dropdown on one full-width row,
  the LoRA dropdown (+ browse) on the next, the weight slider with its value
  and ✕ on a third. (Tim's instruction; the style editor's compact rows are
  unchanged.)

* **2.111.0** — **Temporary LoRAs in Basic Settings.** (Tim's instruction.)
  The left dock's Basic Settings gained a LoRA adder for images (in the image
  section) and one for videos (in the video section): ＋ adds a row with the
  ComfyUI LoRA picker, a weight slider and ✕. They are not part of any style;
  they are sent with every Generate (image, video, music video) on top of the
  selected style's LoRAs — a temp entry with the same path as a style LoRA
  re-weights it rather than doubling it — and a video render with no video
  style selected still gets them. Saved per project as
  `projects/<name>/image-loras-temp.json` and `video-loras-temp.json` on every
  change and restored when the project opens; a new project starts empty.
  New `lib/tempLoras.js`, `GET /api/temploras`, `POST /api/temploras/:kind`.
  Tests: lib (6), e2e (+8), jsdom (+8).

* **2.110.0** — **Video styles.** (Tim's instruction.) Settings → **Video**, laid
  out like the Image tab — checkpoint, text encoder, VAE, LoRAs — plus
  **phases**: ＋ beside the checkpoint adds another checkpoint + steps + cfg
  row for models that sample in stages (Wan 2.2 high-noise then low-noise;
  the arch sets how many). A style carries an Export (API) workflow per
  generation mode (t2va / ref2va / fl2va; blank = the Settings → ComfyUI
  template) and optional size / negative. A **Video** dropdown beside the
  image style under the prompt picks the one Generate (and the music video)
  uses; "— template —" is the old behaviour. The worker writes the style into
  the graph in order: phase *i* → the *i*-th model loader and sampler, the
  text encoder → CLIPLoader, the VAE → the *video* VAE loader only (H3's
  audio VAE is left alone), LoRAs → a built LoraLoaderModelOnly chain in
  front of phase 1's model; Basic Settings' explicit Steps still beats phase
  1's. Styles now live in one folder per kind — `styles/image`,
  `styles/video`, `styles/music`; files in the old root move to their
  folder on first read, and names only need to be unique within a kind. New
  `lib/videoArch.json` (MiniMax H3 now; Wan 2.2 and a custom arch ready for
  the templates to come), `GET /api/videoarchs`, `video_style_id` on
  `/api/generate` and the music video. Tests: styles (+8), worker (1 block),
  e2e (+8), jsdom (+7).

* **2.109.0** — **FLUX Fill inpaint style; the editor picks its own Infill
  style.** (Tim's instruction, from his FLUX inpaint export.) A built-in
  image style **FLUX Fill inpaint** (`comfy_workflows/img_flux_fill_inpaint.json`:
  FLUX.1 dev-kontext fp8 → DifferentialDiffusion → KSampler, FluxGuidance 30,
  zeroed negative, InpaintModelConditioning from one LoadImage whose alpha is
  the hole). Its model (`unet_name`) and LoRAs are changed in Settings →
  Image like any style and *are* applied to the graph — a graph with a single
  model loader takes the style's overrides; a multi-loader export (the SDXL
  one: inpaint UNet + checkpoint + refiner) still runs as exported. Every
  style gained an optional **Inpaint workflow** field. The Image editor
  toolbar now has its own **infill style** dropdown listing only styles whose
  inpaint path resolves (`inpaint_capable` on `/api/styles`), defaulting to
  FLUX Fill inpaint and remembered between sessions. Tests: patcher on the
  FLUX graph with model + LoRA (5), infill choice (+2), e2e (+3), jsdom (+1).

* **2.108.1** — **Infill runs Tim's SDXL inpaint export.** The unexported
  standard-node graph is replaced by his workflow: dreamshaperXL CLIP/VAE,
  the SDXL inpaint UNet, a base `KSampler` and the SDXL refiner from step
  16, with the mask read from the picture's **alpha** (one `LoadImage`). The
  editor now also sends the crop with the hole transparent, and the route
  runs such graphs *self-contained* (only prompt, negative, seed and the
  picture are written — never the style's model, LoRAs, steps or cfg). New
  `scripts/ui_to_api.py` converts a UI export (`nodes`/`links`) to an API
  prompt for the node types it knows, inlining Primitives and bypassing a
  pass-through LoRA stack; the original UI file ships beside it as
  `img_inpaint_sdxl_ui_export.json`. The image patcher learned SDXL's
  `text_g`/`text_l` encoders and writes the prompt/negative into **every**
  sampler's chain (refiner included). A style's own `inpaint_workflow` with
  one LoadImage is treated the same way. Tests: `scripts/test-uitoapi.py`
  (13), e2e updated (+3).

* **2.108.0** — **Image editor dock with Krita-style selection and AI infill.**
  (Tim's instruction.) A new bottom dock below the Timeline (toolbar
  "Editor", ships collapsed). Drop a picture in from the gallery, the assets,
  the reference tray or disk, or 📂 Open one. Selection tools: rectangle,
  ellipse, freehand lasso, polygon (double-click/Enter to close), magic wand
  (tolerance; Ctrl for global), selection brush (Alt erases); Shift adds,
  Alt subtracts; All / None / Invert / Grow / Shrink; marching ants.
  **✨ Infill selection** does what Krita's AI Diffusion plugin does: the
  selection's box plus a *context* margin is cropped, sent with a mask and
  the prompt box to the selected image style, rendered at the crop's size,
  and composited back *only under the selection* through a *feather* ramp so
  the fill blends into the rest of the picture. ↶ undoes; 💾 saves the result
  into the project's Images. Graph per style: a style's own
  `inpaint_workflow` if set; FLUX.2 Klein 9B uses its edit graph (mask
  handled by the editor); checkpoint styles (SDXL/Pony/Illustrious) use the
  new `comfy_workflows/img_inpaint_sdxl.json` (VAEEncodeForInpaint, crop +
  mask). New `static/imageedit.js`, `lib/infill.js`, `POST /api/infill`,
  layout entry `imageeditdock`. Tests: editor math + graph choice (23),
  e2e (+9), jsdom (+6).

* **2.107.0** — **Named timelines, empty new projects, chat "Send".** (Tim's
  instructions.) The timeline is saved into
  `projects/<name>/timelines/<timeline>.json` when the project is saved and
  loaded back when the project is opened; a project can hold several. The
  Timeline toolbar gained a dropdown to switch between them, **💾 Save** and
  **Save as…** (which copies to a new name and makes it active). The `.prj`
  now records only the active timeline's name; a pre-2.107 project's inline
  timeline is migrated into `timelines/main.json` on first open. Creating a
  new project now clears the timeline, the prompt, the reference dock, the
  music/speech fields, the camera picks and the chat. In 💬 Chat mode the
  Generate button reads **Send**, and Enter / Send clears the prompt box once
  the message is in the chat. New `lib/timelines.js`, routes
  `GET/POST/DELETE /api/timelines[/:name]`. Tests: lib (7), e2e (+11), jsdom
  executed (+11).

* **2.106.1** — **The visualizer actually shows.** Two bugs in 2.106.0: the
  Gallery's `<audio controls>` ▶ starts playback inside the browser without
  a script `play()` call, so the hook never fired for songs; and with no
  video loaded the preview area has no height, so the canvas had nothing to
  fill. Now a capturing `play` listener catches native controls too, and the
  preview area takes a 16:9 minimum height while a sound plays. No setting
  is involved. Tests +3 (a bare play event attaches; the area gets a height).

* **2.106.0** — **Play a sound, see it.** (Tim's instruction.) Whenever an
  audio file plays — the Gallery's Audio tab, the Assets dock's ▶, the
  Speech dock's test line, the lightbox — a live visualization of it fills
  the preview area, in a style picked at random for that play: spectrum
  bars, mirrored wave, radial rings, particle field, scrolling spectrogram,
  Lissajous strings. Pause or end fades it out. The song's name and the
  style's are labelled bottom-left. Timeline audio tracks play under the
  video and are never painted over. New `static/audioviz.js` (Web Audio
  AnalyserNode + canvas; wraps `<audio>.play()` so `new Audio()` players are
  caught too; one source node per element). Tests: `scripts/test-audioviz.js`
  in jsdom with a fake Web Audio (13), e2e +3, UI +2.

* **2.105.0** — **FLUX.2 Klein 9B renders with the reference dock.** (Tim's
  instruction.) A Klein 9B text-to-image style now takes the pictures in the
  Refs dock as reference images: the server swaps the style's `*_t2i*`
  workflow for its sibling `*_edit*` graph (LoadImage → ReferenceLatent) for
  that render, uploads the pictures, and the log says which graph ran and
  why. Empty dock → text-to-image exactly as before. Only Klein 9B styles are
  swapped; other families keep the rule that a workflow without LoadImage
  slots refuses pictures. A checkpoint-loader t2i is never swapped onto a
  UNET-loader edit graph (the patcher would write the checkpoint name into
  `unet_name`). Your own exports pair by name (`mine_t2i.json` →
  `mine_edit.json`). New `lib/imageRefs.js`, `ref_capable` on
  `/api/styles`, `params.workflow` honoured by `image_worker.py`. In the
  prompt, name the people as `<Picture 1>`, `<Picture 2>` (tray order).

* **2.104.1** — **Install LLM engine works again.** GitHub's `/releases/latest`
  for llama.cpp now points at the semver notes tag (`v0.3.0`) which ships no
  binaries; the Windows CUDA zips live on the rolling `bNNNNN` builds.
  `get-llama.ps1` now scans recent releases for the newest one with a
  Windows x64 CUDA build, prefers CUDA 13 (`-Cuda 12` for older drivers —
  the worker reads the driver's CUDA version from nvidia-smi and passes it),
  downloads the matching cudart DLL pack, falls back to reading the releases
  web page if the API is rate-limited, and writes `llama-cpp/VERSION.txt`.

* **2.104.0** — **The LLMs are taught how to prompt each model.**
  `lib/promptGuides.json` holds a guide (rules + one good example) for
  MiniMax H3, MiniMax Music, FLUX.2 Klein, SDXL, Pony, Illustrious/NoobAI,
  Z-Image and Qwen-Image. `lib/promptGuides.js` picks the one for the model
  that will actually run — Pony and Illustrious are SDXL to the loader, so
  they are told apart by the model file name — and every LLM entry point
  carries it: the prompt chat (by generate mode + selected image/music
  style), ✨ Enhance, and the music-video shot writer. The H3 guide fixes the
  cut problem from this session: `<Picture n>` inside the action sentence,
  one continuous take, `CUT n:` only when cuts are wanted, no time ranges.
  The chat no longer teaches `<subject n>` as a model tag. 📖 in the chat
  dock shows the guide in force; `GET /api/prompt-guides`. Drop your own at
  `styles/prompt-guides.json` (same shape) to replace a guide by id.

* **2.103.0** — **Dock layout lives in the settings file.** (Tim's instruction.)
  Every dock's last size (height for the bottom docks, width for the side
  docks — the splitter position) and status (open / closed / maximized) is
  written to `ui.docks` in the settings layers on every drag, collapse,
  maximize or toggle, and bitGen Studio reopens with all of it applied — the
  console included, which overrides the old "console starts minimized"
  rule. One dock can be maximized at a time; a second is demoted on read.
  New `lib/uiLayout.js` (validation, clamps, merge), `GET/POST
  /api/ui/layout`, `ui` on the config allow-list. The browser's old
  localStorage keys remain only for the first paint; the file is the
  authority. Also fixes: timeline / music / chat heights were never restored
  at all (only prompt and console were). Tests: test-uilayout.js (10),
  jsdom executed checks (+7), e2e (+5).

* **2.102.1** — **mp4 is the default video format** (Tim: webm doesn't share
  over Messenger). Basic Settings → Format now offers mp4 / webm / avi with
  mp4 first; `defaults.format` is `mp4` in both layers. Every generation in
  mp4 is H.264 + AAC with faststart — the same codec choice the compile has
  always used — so it plays in Messenger, WhatsApp, iOS and Windows without a
  transcode. ComfyUI output is normalised through ffmpeg as before; an
  sd-cli mp4 is re-encoded to H.264/AAC too (its own encoder isn't
  guaranteed to be). The music-video Format field follows. webm/avi
  unchanged for anyone who wants them.

* **2.102.0** — **Two speech engines, one dropdown.** Settings → Audio →
  *Speech engine*: **OpenAudio** (fish-speech S1 / S2-Pro, the default) or
  **OmniVoice** (k2-fsa: fast, 600+ languages, voice design). Both take the
  same job — text + reference clip + transcript — and write into the
  project's Sound folder, so the chat 🗣, the Speech dock, Test voice, the
  timeline and the voice store don't know which one ran. New
  `scripts/omnivoice_local.py` (clone / design / auto; the reference is
  encoded once and cached as `<voice>.omnivoice.pt`, rebuilt if the clip is
  re-recorded), own venv (`venvs/omnivoice`, **Install OmniVoice** button,
  same installer path as OpenAudio/whisper), settings `tts.engine` and
  `tts.omnivoice.{venv,model,num_step}` (device shared). **Designed voices**:
  a name + a description ("male, elderly, low pitch, british accent") saved
  beside the clones with no clip — OmniVoice speaks them, OpenAudio refuses
  with a pointer to the switch. Clip-length hints are per engine (OpenAudio
  10–30 s, OmniVoice 3–10 s). Tests: `scripts/test-omnivoice.py` (15, fake
  package), e2e +14, UI +5.

* **2.101.1** — **The 15 s clip renders. Root cause recorded in
  `minimax-fixed.txt`.** It was never VRAM, chunking, stdio or the encoder:
  the ComfyUI 0.33 upgrade left the venv on PyTorch 2.7.1+cu128, which turns
  dynamic VRAM OFF and disables comfy_kitchen's CUDA kernels, so every INT8
  linear ran through the eager fallback that dequantizes to bf16 and
  `torch.cat`s it — 32 GB gone at step 0/20 for any clip length. Upgrading
  torch to 2.13.0+cu130 fixed it; a 362-frame ref2va rendered in one pass.
  `minimax-fixed.txt` is the checklist for a ComfyUI install (version,
  torch+cu130, "DynamicVRAM support detected and enabled", kitchen cuda
  backend not disabled, no --highvram/--lowvram family flags) and the
  remaining non-blocking warnings (SageAttention DLL, bitsandbytes, numpy 2
  vs onnxruntime). No code change.

* **2.101.0** — **The project owns its reference media, and saves everything.**
  (Tim's instruction.) Save copies the reference dock into
  `projects/<name>/reference/images`, `reference/videos`, `reference/audio`
  and writes their names into `<name>.prj` under `references` (pictures with
  subject/role, videos, audio). Opening the project rebuilds the dock from
  that manifest — the tray refetches its pictures from `/projrefs/images/…`.
  The `.prj` now carries the whole state: timeline, gallery tab, every
  generation setting (incl. CFG), the Music dock (lyrics, caption, style,
  length, songs, seed), the Image dock (style, size, batch, touched
  steps/cfg), camera picks, speech text/voice, generate mode, the selected
  reference group. Save is one multipart POST (`data` + `ref_images`);
  closing the window beacons the state (not media) so a project reopens where
  it was left. A manifest entry whose file has gone is dropped and named in
  `missing_references` on open. Nothing under `reference/` is ever deleted by
  a save. New `lib/projectRefs.js` + `scripts/test-projectrefs.js` (18);
  reference GROUPS (`references/<group>.json`) are unchanged.

* **2.100.0** — **The handover's remaining tasks, and the settings audit.**
  1. *The shipped video templates now load the nvfp4 text encoder.*
     `ref2va.json` / `fl2va.json` load `qwen3vl_32b_minimax_h3_nvfp4_awq`
     (~17 GB, the one Tim's own working exports use) instead of
     `..._int8_convrot` (~27 GB, which cannot sit beside a 21 GB video model on
     a 32 GB card). `ref2va` also takes the verified `ref_image_size: max`.
     Found in the diff: `fl2va.json`'s LoRA slot held a **Flux** LoRA
     (`flux\KONTEXT\yard-render`), so the turbo toggle would have loaded junk —
     it is `minimax_h3_fl2v_turbo_8step_v1.0` now.
  2. *Steps follow the LoRA toggle, per workflow.* `defaults.steps` is
     **0 = auto**: the worker (`resolve_steps`) reads the LoRA's count from
     its file name (`_8step_` → 8, `_4step_` → 4) when the turbo LoRA is on,
     else the template's base literal / `on_false` arm (20). The old fixed 8
     was the LoRA count patched into base-model runs. A non-zero Steps is an
     explicit override; the slider readout says "auto".
  3. *[Errno 22]: no more pipes.* A ComfyUI H3 launches writes stdout/stderr
     to `comfy.log` (tailed into the app console) — a file write cannot raise
     the Windows stderr-flush crash a pipe can — or gets **a real console
     window** (`engine.comfy.stdio: file | console`, new `lib/comfyStdio.js`).
     Settings → ComfyUI: **⤴ Relaunch ComfyUI in a real console** (`POST
     /api/comfy/relaunch-console`) stops the managed ComfyUI and brings it back
     in its own window; a ComfyUI you started yourself is never touched.
  4. *Settings audit.* `DEFAULT_CONFIG.engine.backend` said `sdcli` while
     `default.settings` said `comfy` — aligned. The worker's `clip_device`
     docstring claimed "cpu (default)" while both layers ship `default` —
     corrected. `gpu.te` (sd-cli) vs `engine.comfy.clip_device` (ComfyUI) are
     different knobs for different engines, now said so. `lora_4step` keeps
     its key but its label no longer hardcodes "4". test-settings.js now
     fails if any key exists in only one layer or the layers disagree on a
     generation-steering value.

* **2.99.4** — **The 30-chunk disaster fixed, and the real culprit identified.**
  A 5-second clip was being planned as THIRTY 5-frame chunks: 2.99.1's ladder
  had walked a non-memory `[Errno 22]` down to its 5-frame floor and **saved
  that as a permanent VRAM ceiling**. Now a ceiling is learned only from a real
  `torch.OutOfMemoryError`, never below 107 frames, the server refuses to store
  a smaller one, `/api/plan` and the UI ignore one, and a bad value already in
  `custom.settings` is repaired at startup. Also: the prune's sink test only
  matched class names containing "save", so an export ending in
  `VHS_VideoCombine` (as Tim's own working r2v export does) had no sink at all
  and skipped pruning entirely — now matches VideoCombine and PreviewVideo too.
  Tim's ComfyUI 0.33 exports ship as `comfy_workflows/*_tim_0330.json`, and
  diffing them found the likely root cause of the whole saga: **our template
  loads the int8 text encoder (~32 GB) while he runs the nvfp4 one (~16 GB)** —
  double the size, on a 32 GB card that also holds the ~21 GB video model. See
  HANDOVER.md "START HERE".

* **2.99.3** — **The `[Errno 22]` is size-independent, so it is NOT memory —
  the ladder now proves that in one step instead of four.** Tim's log with the
  ladder running: 243f failed, 158f failed, 107f failed, **73f — a 3-second
  clip — failed identically**, on a card with 30 GB free. A memory limit gets
  *better* as the run gets shorter; this does not move at all. That is proof
  the clip size is not the variable, and it retires the reading 2.99.1 shipped
  (that a sampler `[Errno 22]` is the same failure as an OOM). They are not:
  the clean `torch.OutOfMemoryError` at 362f was real and is fixed by chunking;
  the `[Errno 22]` is the **ComfyUI-on-Windows stderr crash** after all — the
  one cause this project has bounced off three times, and the only one that
  explains a 3-second clip failing on an empty card. Now: a non-OOM sampler
  failure gets exactly **one** shrink as a size test, and if that fails the same
  way the worker stops and says so, instead of walking 243→158→107→73 and
  burning ten minutes. A real OOM still gets the full ladder. Also: the CPU
  text encoder (2.99.2) is now **opt-in** — it costs about two minutes of prompt
  encoding per run on a 32B encoder and did not change the outcome, so ComfyUI
  keeps the choice unless you tick the box. Suite: **500 passed, 0 failed.**

* **2.99.2** — **The 32B text encoder now stays in system RAM, so the whole card
  is the sampler's.** Tim: *"v2.85.3 worked perfectly."* That made the previous
  three releases suspect, so this one starts from a diff rather than a theory:
  restoring his 2.89.0 zip and running both patchers over the same inputs shows
  the graph H3 sends is **byte-identical** (one node id apart, from 2.98.1) and
  the chunk plan identical — `ref2va.json` itself has the same md5. H3 is not
  what changed. What did is visible in his own ComfyUI banner: **"Using RAM
  pressure cache"**, a newer memory-management mode. The H3 templates load
  `qwen3vl_32b_minimax_h3_int8_convrot` — a 32-billion-parameter text encoder —
  beside the ~21 GB video model; on a 32 GB card those never both fit, and long
  clips only ever rendered because ComfyUI offloaded the encoder after encoding.
  Held through sampling instead, 10 s squeezes in and 15 s does not — the exact
  symptom. The fix is in the graph, not his install: `CLIPLoader.device = "cpu"`
  pins the encoder in system RAM (he has 128 GB) so it never competes for VRAM.
  A few seconds of prompt encoding, nothing inside ComfyUI touched, and it is a
  checkbox in Settings → ComfyUI (`engine.comfy.clip_device`, on by default;
  a CLIPLoader without a `device` input is left alone). The e2e asserts
  `device: "cpu"` in the JSON ComfyUI actually receives, not just in our log.
  Suite: **495 passed, 0 failed.**

* **2.99.1** — **The sampler's `[Errno 22]` IS the out-of-memory failure, so it
  takes the same ladder.** Tim's next log settled a question three sessions had
  got wrong: the *identical* 15 s clip, on a cleared card (~30 GB free) with the
  switch confirmed intact, throws `torch.OutOfMemoryError` on one run and
  `OSError: [Errno 22] Invalid argument` on the next. A render that *sometimes*
  produces a clean out-of-memory error cannot be a console/stdio bug — a console
  bug is deterministic — and the clean OOM proves the sampler is genuinely
  failing to allocate at 362 frames. `[Errno 22]` is that same allocation
  failure when it takes the CUDA context (and the stderr flush) down with it.
  2.99.0's ladder only fired on `torch.OutOfMemoryError`, so when the same
  over-budget render surfaced as `[Errno 22]` nothing was re-planned, nothing
  was learned, and the old stderr advice was printed instead. Now a
  **sampler** `[Errno 22]` goes through the identical re-plan ladder: chunks
  that fit, the clip finished at full length, the ceiling learned and saved.
  Deliberately narrow — `is_retryable_sampler_failure` requires the `[Errno 22]`
  to be raised *in a Sampler node*; a non-sampler one still gets the genuine
  ComfyUI-on-Windows stderr-flush advice, and if the ladder shrinks to its floor
  and the clip STILL fails, that advice is printed then (with the decisive test),
  because at that point it really is the other bug. Also fixed: the 2.98.1
  diagnostic cried *"UNRESOLVED LITERAL — the Errno-22 shape"* at a perfectly
  intact switch; it now resolves the value through the switch and prints
  `steps=8 (via ComfySwitchNode#142, switch intact)`. Tests: the stub can throw
  either failure shape (`/e2e/oom {"kind":"einval"}`), and the e2e proves the
  Errno-22 clip re-plans and renders, learns the same ceiling, never prints the
  stderr advice when the ladder handles it, and that an unshrinkable one ends
  with that advice after **bounded** retries. Suite: **494 passed, 0 failed.**

* **2.99.0** — **15 s renders again, by fitting; and settings live in
  `default.settings` + `custom.settings` with a Reset button.** Tim's last log
  settled it: a cleared 32 GB card (30 GB free), the switch fix confirmed
  intact, and a 362-frame ref2va *still* dies of `torch.OutOfMemoryError` in
  the sampler while 243 frames render — the ~21 GB int8 model leaves ~9 GB for
  the sampler, enough for 10 s and not for 15. That is a wall, not a bug, and
  no amount of clearing moves it. So the ComfyUI path now has what the sd-cli
  path has had for a long time: **an OOM ladder.** A single run that runs out
  of GPU memory is **re-planned into chunks that fit** (362f → a 243f ceiling →
  `[243, 124]`, fl2va hand-off between them, one seam) and the render is
  started again and finished at full length. The worker **reports the learned
  ceiling** (`@@CFG`, a whitelisted config write) and it is saved as
  `engine.comfy.vram_ceiling` with a note saying when and why — so the *next*
  15 s clip is planned as two chunks from the start instead of failing first,
  10 s clips stay one run, the plan readout says *VRAM ceiling 243f*, and an
  explicit Single run over the ceiling is chunked with a message rather than
  spending minutes to die the same way. Settings → ComfyUI shows the ceiling
  and **↺ Model max** forgets it (do that after changing the model, the frame
  size, or ComfyUI's attention/offload flags — a smaller model or sage/flash
  attention is what would put 15 s back into one run). **Settings files (by
  instruction):** `default.settings` ships as the default layer for every
  feature (engine ComfyUI, VRAM clear on, workflows mapped, no per-machine
  values) and is written from the code defaults if missing; every Save writes
  **only what differs** into `custom.settings`, so editing a default later
  flows through to whatever you never touched; **Settings → General → ↺ Reset
  settings to defaults** drops the custom layer (kept as
  `custom.settings.bak`) and keeps the open project; the General tab shows both
  paths and what is customised. A pre-2.99 `config.json` is migrated on first
  boot (kept as `config.json.migrated`), `clear-comfy.bat` reads the new files
  first, and zips ship `default.settings` but never `custom.settings`. New:
  `lib/settings.js` (path-parameterised, 37 checks in
  `scripts/test-settings.js` incl. the framePlan mirror), `POST
  /api/config/reset`, `GET /api/settings/info`, `plan_chunks(ceiling=)` in
  both planners, `vram_fallback_ceiling`, `ComfyOOM`, the stub's `/e2e/oom`,
  and e2e proof of the whole thing: one OOM, a `[243, 124]` re-plan, 360
  frames delivered, the ceiling saved to `custom.settings` (never
  `default.settings`), the next 15 s planned to fit with zero OOMs, reset back
  to `[362]`, and the General reset restoring `default.settings` with the
  project kept. Suite: **486 passed, 0 failed.**

* **2.98.1** — **The sampler's `[Errno 22]` was the graph, not Windows — the
  LoRA switch fix.** After 2.98.0 cleared VRAM (which fixed a *separate*
  `torch.OutOfMemoryError`), a 10 s ref2va still died with
  `OSError: [Errno 22] Invalid argument` in `SamplerCustomAdvanced` — on a
  cleared 32 GB card, so not memory, and it had been mislabelled the
  ComfyUI-on-Windows stderr crash for three sessions. It was neither. The
  official H3 templates gate step-count and model behind one `PrimitiveBoolean`
  feeding two `ComfySwitchNode`s (full vs. distilled/LoRA). When the worker set
  `BasicScheduler.steps`, it **overwrote the link to that switch with a
  literal**, severing one arm and leaving the boolean + model-switch surviving
  but half-wired — exactly the `PrimitiveBoolean` + `ComfySwitchNode` that
  showed up executing in the log. The patcher now sets the step count on the
  switch's value nodes and **keeps the link**, so the switch stays whole and
  the user's Steps reach the sampler through it whichever arm the LoRA toggle
  selects (a first cut set it on the wrong arm when LoRA was on; caught by
  testing fl2va, fixed by writing both arms — order-independent). A new
  read-only **`_diagnose_sampler`** logs the sampler's resolved inputs
  (`[comfy] DIAG …`: what feeds sigmas, the scheduler's steps + model, the
  guider's model, every switch/boolean state) right before queueing, so this
  class of graph fault is visible at a glance instead of guessed at. No change
  to your ComfyUI, models, or workflows. **NOT yet confirmed on Tim's machine**
  — the DIAG lines in the next render's log are how we confirm the graph
  reaching the sampler is now sound. Tests: 22 focused checks in
  `scripts/test-patcher.py` (steps resolve through the switch for ref2va +
  fl2va × LoRA on/off, link kept, no dangling links, guider resolves to the
  right model, the diagnostic is read-only and never raises).

* **2.98.0** — **VRAM is cleared before every generation (Settings → ComfyUI,
  on by default), and an out-of-memory clip is told in words.** Tim: *"15 sec
  videos used to work. 10 seconds work but 15 doesn't. maybe clear vram before
  generation?"* — the sampler died with `torch.OutOfMemoryError` on a 362-frame
  ref2va that used to render. ComfyUI keeps every model it has touched resident
  (the H3 video model, the image model from the last still, the music model
  from the last song, text encoders, VAEs) and only evicts on its own estimate
  of the next graph; the torch cache holds freed blocks too. After a mixed
  session the card is full of things nobody is using and a 15 s clip no
  longer fits where a 10 s one still does. Now each Generate first asks ComfyUI
  to unload everything and empty its cache (`POST /free`, ComfyUI's own
  mechanism; weights come back from RAM in seconds) **and waits for the unload
  to land** before queueing — `/free` only sets flags, and a `/prompt` sent the
  next instant can run *before* the unload. The worker log shows ComfyUI's own
  before → after (`[comfy] VRAM: 3.2/31.8 GB free -> 30.9/31.8 GB free`), once
  per job (chunk 2+ keeps the model warm). Image and music generations do the
  same. **🧹 Free VRAM now** in Settings → ComfyUI, and a *🧹 free VRAM* link in
  the status bar while ComfyUI is up, do it by hand (`POST /api/comfy/free`);
  the ComfyUI status tooltip shows what ComfyUI itself sees free. If a clip
  still runs out of memory the worker now says so — with the options in order
  of least damage (force split at 10 s, a smaller frame, other GPU users,
  `--reserve-vram`) — instead of "check the MiniMax H3 nodes exist". The VRAM
  helpers live in `scripts/comfy_client.py` and are the first thing
  `worker.py` imports from it (guarded; a failed import is logged and the
  render goes ahead). Also: a calendar-dependent check in
  `scripts/test-chatstore.js` (green on the day it was written, red two days
  later) is pinned to its own date. Suite: 34 new checks in
  `scripts/test-comfyfree.py`, e2e assertions that the clear lands once and
  before the first `/prompt`, that the OFF switch is honoured and said, that
  the button frees and reports, and 13 UI anchors.

* **2.97.1** — **The ControlNet chain's staged plan, pinned.** Per
  instruction the chain runs as three complete generate-and-save stages:
  style 1 renders and saves, the ControlNet pass renders and saves, then
  style 2 finishes and lands in images like any generation. The first two
  park in **`<project>/temp/<date+time>.png`** — `core.tempDir()`/`tempName()`
  ship now (created on demand, collision-proof within a second, and
  deliberately excluded from the output folders so a temp file never
  satisfies a job's completion check and never reaches the gallery). The
  generate refusal for chain styles now names the staged run. Waiting on the
  ControlNet workflow export; the full build plan sits in the handover.

* **2.97.0** — **ControlNet chain styles (Settings → ControlNet).** A new
  Settings tab builds a two-stage style: a name, **stage 1** (the style that
  generates the guide image), a **ControlNet model** (listed straight from
  ComfyUI's models/controlnet folder), and **stage 2** (the style that
  finishes from the ControlNet guidance) — then **💾 Save this as a style**.
  Saved chains appear in the Image dropdown under the prompt like any style,
  list in the tab for editing (name, stages, model, ✕ delete), and are kept
  out of the Settings → Image editor so a plain save can never silently
  strip a chain. The server validates on save: both stages must be existing
  image styles, neither may itself be a chain, and a model must be picked.
  **Generating a chain is refused in words for now** — stage 2 needs the
  verified ControlNet workflow exported from your ComfyUI, and the full
  execution design (two-stage worker loop, image hand-off, patcher keys) is
  written up in the handover so the next build wires it straight in. The
  image Basic Settings already follow the Image dropdown under the prompt
  (that landed in 2.93.0 and is unchanged).

* **2.96.0** — **Keyframes on every layer.** Double-click any clip —
  base video, overlay, audio, image — to drop a **◆ keyframe on that frame**,
  seeded from the value already in effect there so nothing jumps. Click a
  diamond to edit it: **opacity and volume sliders** (an audio clip offers
  volume only, an image opacity only) and ✕ to delete. Values **ramp
  linearly from one keyframe to the next** and hold before the first and
  after the last, exactly like AE; a clip with no diamonds behaves as
  before. The preview interpolates every tick at every application site —
  the base player, overlay layers, audio layers and image overlays, opacity
  and volume alike — so a fade-in or a music duck plays live. Keyframes ride
  with the clip (`kf: [{at, op?, vol?}]`, seconds from clip start) and are
  saved with the timeline. The maths is mirrored in lib/timelineEdit.js
  (`kfValue`/`kfSet`/`kfRemove`) with unit tests, ready for the exporter.
  The old double-click static-opacity prompt is replaced by this (one
  diamond = the same constant value, and more). Export currently still
  renders the static values — wiring ramps into ffmpeg is the next step and
  is written up in the handover.

* **2.95.0** — **Task B complete: trims from each side, one-clip scope, and
  the audio path proven.** The timeline toolbar gains **⇤ Head** and **Tail
  ⇥**: with a layer highlighted and the playhead parked, they trim the one
  clip under the playhead to start or end exactly there — no range selection
  needed, media in/out shifted so the picture under the marker doesn't move,
  and a sub-frame remainder removes the clip rather than leaving a sliver.
  Keep/Cut gain a **scope** control: "layer" is the old behaviour, "clip"
  edits only the clip under the middle of the selection — neighbours are
  untouched, a clip-scoped ripple cut joins the halves into a jump cut, and
  compact deliberately stays a layer-scope, V1-only affair. All maths lives
  in lib/timelineEdit.js (trimAt, applyClip) behind POST /api/timeline/edit,
  unit-tested on video, audio AND image kinds; the e2e now drives the audio
  path it had never touched, and the jsdom suite clicks the real buttons on a
  real audio layer against the real maths. The empty selection readout now
  says how to make one, and the long-dead selectLayer() is gone.

* **2.94.0** — **Two-way playhead sync (Task C).** Playing a clip in the
  player — from the gallery, or after parking the marker on it — now moves
  the red timeline marker live: the player's clip-local time is mapped to
  global with the preview's own arithmetic (clip start + local − clip in),
  and when the same file sits on the track more than once, the placement
  nearest the marker wins. A video that is not on the base track moves
  nothing — the marker is a timeline position. The other direction too:
  dropping the marker on the very clip that is playing seeks it in place and
  keeps it playing, instead of the old paused scrub; every other case still
  parks paused. The preview clock keeps sole ownership of the marker while a
  preview runs, and a guard swallows the echo of programmatic seeks so the
  two directions cannot feed back. The marker element is moved directly on
  each tick — no full timeline re-render several times a second.

* **2.93.0** — **Basic Settings follows the mode.** The Generate dropdown now
  decides what the panel shows. **Image mode:** preset sizes (long edge, or
  "Style's own"), aspect ratio, CFG and Steps **sliders seeded from the
  selected style**, and **every LoRA the style uses listed with its own
  weight slider** for the next render. Only what you actually MOVE is sent —
  an untouched panel means the style's own values, exactly as before; a
  slider you touched rides along as an override, and the LoRA weights go as
  a per-render map merged over the style (weight 0 is honoured; clamps match
  the editor's -4..4). Re-selecting the style reseeds the panel and clears
  every touch. **Video mode:** the familiar set — presets, aspect, seconds —
  with Steps now a slider and a **new CFG slider** wired through both video
  backends (sd-cli's `--cfg-scale` and a `cfg` input on ComfyUI's video
  nodes when the workflow has one). It defaults to 1.0, which is what the
  distilled MiniMax H3 wants; absent means exactly that, so nothing changes
  until you move it. Suite grows to 425 e2e.

* **2.92.1** — **A maximize now shares.** Opening another dock while one is
  maximized no longer tears the maximize down: the maximized dock is the
  stretchy one, so it simply shrinks by the opened dock's height and both are
  on screen. Click a minimized strip's header (or its status-bar button) to
  open it alongside; click an open dock's header while a maximize is active
  to tuck it back to its strip — a view change, not a stored collapse, so
  Escape or 🗗 still restores the layout exactly as it was before the
  maximize, opened-alongside docks included.

* **2.92.0** — **The chat knows what you have selected, and its songs land in
  the Music dock.** Every chat message now carries the current selection
  (Generate mode, image style, music style); the server looks the styles up
  and appends them to the assistant's system prompt — the style names, the
  image arch with FLUX-family prompting rules, and the music style's full
  caption so lyrics are written to fit the sound. The assistant is also taught
  the exact block shape for songs: metadata lines (Theme:, Genre:,
  Instruments:, BPM:, Vocals:), a blank line, then [verse]/[chorus]-tagged
  lyrics. The code-block **🎶 Music button** (replacing 🎵 Song — the
  music-video pipeline keeps its own 🎵 button in the prompt dock) splits a
  block on that shape: lyrics into the Music dock's lyrics box, the metadata
  lines into the caption box, opening the dock to show it. A block with no
  metadata is all lyrics, and metadata after the first lyric line stays a
  lyric — a "BPM:" inside a verse belongs to the song. **The prompt dock
  stays open** through a maximize now: it is the app's main input, so
  maximizing another dock no longer minimizes it (your own collapse still
  works, and is respected).

* **2.91.1** — **The input lock-up after music generation, found and killed —
  twice — and maximize redone as vertical.** (1) **Native `alert()` and
  `confirm()` are gone.** In Electron a native dialog steals the window's
  keyboard focus and does not give it back on close, so after any alert —
  and the music path alerted on every refusal, starting with "Create a music
  style first" — **every input in the app looked locked** until the window was
  re-focused by hand. Same disease that killed `window.prompt()` in 2.87.0,
  same medicine: an in-page dialog. `window.alert` is rebound to it (all 68
  call sites converted at once); all 15 `confirm()` sites now `await` the
  dialog, with OK/Cancel and Esc-cancels. (2) **`fmtT` never existed**: the
  Audio tab's tile painter (2.90.0) threw a ReferenceError on the first song
  with a duration, so the tab painted empty the moment a generation finished.
  Durations now render as m:ss inline, and a jsdom test paints a real tile so
  this class of bug cannot ship silently again. Also: a finished **song no
  longer loads into the video player** (poll routed any non-image output
  there; audio goes to the gallery like stills do). **Maximize, per
  instruction:** only the horizontal (bottom) docks have the ⛶ button — the
  left/right docks are vertical docks and have none. A maximized dock grows
  **vertically only, in place**: the other horizontal docks minimize to their
  30-px headers (a temporary state — the user's own collapsed choices come
  back untouched on restore), the preview keeps its 100-px floor, the
  splitters hide. Escape restores; clicking a minimized dock's header restores
  the layout with that dock open; maximizing a second dock swaps. Verified
  end-to-end against the real server + stub ComfyUI: after a full music
  generation there are no open dialogs, no stuck controls, no errors, a quiet
  fetch rate, and typing works.

* **2.91.0** — **The Music dock, a quiet console, and a maximize toggle on
  every dock.** Songs are now made in a **Music dock under the timeline**:
  lyrics on the left (the prompt), a per-song caption override in the middle,
  and style / length / songs / seed / **🎶 Generate Music** on the right, with
  a status line that follows the job to done. The prompt dock's music controls
  moved there; the mode dropdown's 🎶 entry still renders from the prompt box.
  **The console no longer opens itself** when a job is selected or the ComfyUI
  log is followed, and it **starts minimized on every load** — the log still
  fills in behind it. **Every dock has a ⛶ maximize button** in its header:
  the dock takes all the space above the status bar; click again or press
  Escape to restore; maximizing another dock restores the first; collapsing or
  hiding a maximized dock restores it first. Header buttons no longer collapse
  the dock they sit in (the chat dock's New/⬇ buttons used to). Fixed: **the
  MiniMax Music3 starter style now reaches existing installs** — the starter
  stamp was a single "seeded once" mark, so a style added in a later release
  never appeared for anyone who had installed before it; the stamp now lists
  the starters by name and seeds only the ones you never had (a deleted
  starter stays deleted). Suite: 422 e2e, test-imagedom 207 (the docks are
  exercised in jsdom: console stays shut on job select, Generate Music posts
  the dock's fields, maximize rules), test-imageui 221, test-styles 146.

* **2.90.0** — **Music generation, and the queue gets its own dock.**
  **Settings → Music** is the Image tab's twin: named music styles for the
  **MiniMax Music3** nodes through ComfyUI, each with workflow, the same
  ComfyUI Model/VAE/text-encoder dropdowns (and the same Start-ComfyUI bar),
  steps, cfg, sampler/scheduler, a **caption** box and **max_duration**. The
  doctrine the whole feature is built on: **the prompt is the lyrics, the
  style's caption is the music** — the patcher writes the prompt into the
  encoder's `lyrics` and the caption into `caption`, never the other way round,
  and the job log names both. A third worker, `music_worker.py`, renders it:
  ComfyUI-only, collects whatever arrives under `audio` in the history, keeps
  ComfyUI's own file extension, and files the song into the project's `sound/`
  folder by hard link so it shows up in the Assets dock ready to drag onto the
  timeline as an audio layer. New routes: `POST /api/genmusic`,
  `GET /api/musicarchs`, `GET /api/styles?kind=image|music` (a bare GET still
  returns everything, each row labelled), `GET /api/outputs?kind=audio`. The
  prompt dock gains a **music style** dropdown and **🎶 Generate Music**; the
  mode dropdown's **audio** entry now means music (it used to dead-end on "no
  audio engine"). The gallery gains an **Audio** tab with inline players. A
  ready-made **MiniMax Music3** style ships with the template's lo-fi caption.
  **The queue has moved** out of the left dock into a dock of its own between
  the main column and the gallery, with its own splitter and a **Queue** button
  in the status bar; the left dock is now settings and system stats only.
  Refusals in the user's terms: an image style sent to Generate Music (and the
  reverse) is a 400 that names the style and the tab to look in; a music style
  pointing at a workflow with no SaveAudio node fails before ComfyUI is asked.
  Suite: 422 e2e checks (was 389), with the whole music path proven against the
  stub ComfyUI — lyrics vs caption placement, duration, hard link, gallery tab,
  batch cap, fresh seeds, the right worker.

* **2.89.0** — **The MiniMax Music3 workflow template, and a settings dialog
  that stops resizing.** `comfy_workflows/audio_minimax_music3.json` ships as
  the template for music styles, with its wiring documented in the file: which
  node takes the caption, which takes the lyrics, and why the seed node feeds
  both the text encode and the sampler. The **Settings dialog is now one fixed
  size** — fixed width, a tab strip that wraps, and the active pane scrolling at
  a fixed height — so switching tabs no longer makes the box jump around under
  the pointer, and adding a tab costs nothing. **The Music tab, music styles and
  the dock reorganisation are specified in HANDOVER.md but NOT built** — see the
  note there before assuming any of it works.

* **2.88.0** — **Camera presets, with drawn previews.** 🎥 **Camera** beside the
  prompt opens a picker with four rows — **Framing** (extreme close-up to
  extreme wide), **Angle** (low, high, overhead, dutch, over-shoulder, POV),
  **Lens** (14mm to 135mm, macro, anamorphic) and **Movement** (push, pull, pan,
  tilt, orbit, tracking, crane, handheld, zoom) — each tile showing a **diagram**
  of what it does: how much of the figure is in frame, where the lens is, how
  wide the cone of view is, which way the arrow points. The previews are drawn,
  not generated: an example render would cost a GPU-minute per tile and be a
  different picture every time you opened the panel, which is the opposite of a
  reference. Pick one per row or none; the phrase is shown before you commit and
  **replaces** the last one you added rather than stacking contradictions. The
  phrase is always ordered like a shot list — framing, angle, lens, movement —
  whatever order you clicked, because prompt order matters to these models. In
  Image mode the Movement row is **absent**, not disabled: a still cannot dolly.
  The vocabulary lives in `lib/cameraPresets.json`, so you can reword or add
  presets without touching code.

* **2.87.0** — **Talk to it, and the buttons that were dead in the desktop app
  work again.** 🎤 **Speak** records from the microphone, transcribes with the
  faster-whisper you already have, and appends the words to the Prompt box —
  press once to start, again to stop, and if the mode is Chat it sends straight
  away. Dictation appends rather than replaces, so a second sentence adds to the
  first. The mic is released the moment recording stops, not when transcription
  finishes. **🔊 Read replies** speaks each answer with the selected voice,
  reading only the PROSE — a fenced block is a prompt to be rendered, not
  something to listen to. **And the fix: `window.prompt()` is not implemented in
  Electron.** It returns undefined and logs "prompt() is and will not be
  supported", so 📂 Open project, 💾 Save as, the clip-opacity dialogs and the
  timeline's add-video picker did **nothing at all in the desktop app** while
  working perfectly in a browser tab. All seven now use a real in-page dialog,
  and Open project lists your projects as buttons instead of asking you to read
  a numbered list and type its number.

* **2.86.1** — **Prompts in a reply become blocks you can render from.** The
  assistant is now told to fence every prompt it gives, and each fenced block is
  rendered as a code block with **🖼 Picture · 🎬 Video · 🎵 Song · 🗣 Speech ·
  ⧉ Copy · ⬇ To prompt** underneath — the picture and video buttons run the
  same one-at-a-time queue the Generate button does, so `/br/` inside a block
  still splits it and two clicks cannot start two renders on one GPU. The prompt
  box is borrowed and restored, so whatever you were writing there survives.
  Prose outside a fence stays prose: a question does not grow Generate buttons.
  An unclosed fence still yields its block, because a reply cut short by the
  token cap is when you most want the part that arrived. **Your own messages get
  ↻ Retry and ⧉ Copy** — a reply that failed leaves the question stranded in the
  transcript, and retyping it was the only way to run it again. Replies are
  built as DOM text nodes, never spliced into HTML: a model's reply arrives over
  HTTP and is not trusted.

* **2.86.0** — **One Generate button, five destinations, and `/br/`.**
  A dropdown under Generate picks what it makes — 🎬 Video, 🖼 Image, 🔊 Audio,
  🗣 Speech, 💬 Chat — and **Enter in the prompt box is the Generate button**
  (Shift+Enter is a newline). **`/br/` on its own is a seam**: the text before it
  is one generation, the text after it is the next, so a storyboard is written
  once instead of pasted six times. Segments run **strictly one at a time — the
  next is submitted only when the previous has finished**, not when the POST
  returned, because these jobs each want a whole GPU and a failure at picture
  four of six is much harder to read than a queue that has not got there yet. A
  failed segment stops the run rather than grinding through the rest. The seam
  must stand alone (whitespace or line ends either side), so `https://x.com/br/x`
  is not silently cut in half. **Audio mode reports honestly that no ambience
  engine is wired yet** — the only sound engine here is OpenAudio, which is
  text-to-speech — rather than quietly speaking the words and looking like it
  worked.

* **2.85.3** — **The chat window IS the dock.** It now carries the dock's own
  background with no frame or inset — once the input moved out to the Prompt
  box there was nothing left for a border to separate it from — and it fills the
  dock body, so dragging the splitter above it resizes the conversation.
  **Also a real bug, found by executing the page instead of reading it:**
  collapsing a dock rewrote its header text to swap the arrow, which destroys
  the header's children, and it re-appended exactly one button. That was
  invisible while every header had one button, and wrong the moment the chat
  dock arrived with two and a status span. Worse, its toolbar-button lookup
  returned `undefined` for a dock that has no toolbar button, so it **threw on
  every page load**, because the chat dock starts collapsed. The jsdom suite
  would have caught it and was **silently skipping** because jsdom was not
  installed; a skipped check now fails the run instead of passing it quietly.

* **2.85.2** — **One box: the Prompt field is the chat input.** The chat dock no
  longer has an input of its own — you type in the Prompt box and press
  **💬 Send to chat** (under the icon row, deliberately not an icon) or
  **Ctrl+Enter**. Plain Enter still makes a newline, because that box is also
  where a multi-line generation prompt is written and losing one to a stray
  Return is worse than one extra key. Sending clears the box the way a chat
  input does, which is safe because the message is written to the project's
  transcript before the model is called; **⬇** in the chat dock header puts a
  reply back into the box, ready to edit or generate. And the **LLM dropdown now
  loads the model it names**: selecting one stops the running llama-server and
  starts the new one immediately, instead of recording a preference and leaving
  the load to whichever feature ran next — which looked like the chat hanging.

* **2.85.1** — **The chat answers, and ComfyUI's state moved to the status bar.**
  "⚠ LLM returned an empty response" was a **reasoning model spending its whole
  token budget inside a `<think>` block**: llama-server splits those into
  `reasoning_content` and leaves `content` empty, so the old code reported the
  one thing that was certainly not the problem. Thinking is now switched off in
  the request, `<think>` blocks are stripped if a model emits them inline, an
  answer is taken from `reasoning_content` when that is all there is, and if
  there is genuinely nothing the error names `finish_reason` — "ran out of
  tokens while thinking" and "returned nothing at all" need different fixes and
  looked identical. **No button is labelled with ComfyUI's run state any more**;
  the status bar shows *ComfyUI: not running / starting… / running* beside the
  job and LLM indicators, and clicking it when it is down starts it. And a
  launch that **dies because something already holds port 8188** — almost always
  a ComfyUI left running by a previous session — now runs `clear-comfy.bat` and
  starts again by itself, at most once every five minutes, and only when the
  launch died within a minute.

* **2.85.0** — **A prompt chat, above the prompt box.** Talk through what you
  want to make — a shot, a still, a line of speech — and the assistant answers
  with bitGen Studio's three prompt shapes in mind (video wants camera movement and
  a sound description; an image wants none of the former; speech wants the
  words). The transcript is stored in the project at
  `chat/<date>_<time>.chat`, one JSON-lines file per session, and **today's and
  yesterday's messages are replayed to the model on every turn** so it knows
  where you got to without being re-told. `🆕` starts a new conversation
  without destroying the old one; `⬇` drops the last reply into the Prompt box.
  Enter sends, Shift+Enter is a newline. The **`💬`** button under Generate
  Image hands the prompt box to the chat instead of making you retype it. Your
  message is written to disk **before** the model is called, so an LLM that is
  down cannot cost you what you typed. Enhance and Chat now resolve "which LLM,
  at which URL, started how" through one shared helper (`lib/llmChat.js`)
  rather than two copies. The prompt dock's buttons are now **icon only**, with
  their labels in `title=` and `aria-label=`. Versions confirmed working on a
  real machine are recorded in **WORKING-VERSIONS.md**.

* **2.84.2** — **The separator, decided by the platform instead of hardcoded.**
  ComfyUI builds every dropdown value with `os.path.relpath`, so on Windows it
  contains **backslashes**: `flux_klein_9B\model.safetensors`. The folder scan
  forced forward slashes, so a style saved while ComfyUI was *not* running held
  a name its validator rejects — for a file sitting right there in the folder.
  The scan now spells names with the platform's own separator, exactly as the
  ComfyUI on the same machine would. Existing styles are repaired
  automatically: before a graph is queued, any loader filename that differs
  from ComfyUI's list by **separator or case only** is rewritten to ComfyUI's
  exact spelling and the change is logged. Only a single unambiguous match is
  ever rewritten — a name matching nothing, or two entries at once, is still
  rejected with a suggestion, because rendering with quietly the wrong model
  looks like a bad checkpoint and costs far more than an error does.

* **2.84.1** — **"Value not in list" now names the file ComfyUI actually has.**
  A rejected model, VAE, text-encoder or LoRA name is looked up in ComfyUI's own
  dropdown for that exact input, and the likely intended entry is printed —
  instead of only being told the name is not in a list of 430. ComfyUI names
  each file **relative to the search path it was found under**, so a folder that
  is itself a path in `extra_model_paths.yaml` contributes no prefix, and the
  same file is `flux_2_klein_9B/x.safetensors` to one scanner and
  `x.safetensors` to the other. If nothing matches, the message says the file is
  not on any path ComfyUI searches, which is a different problem with a
  different fix. The pre-flight check also **says when it could not check**
  rather than abstaining silently — a folder-derived list can disagree with
  ComfyUI's, and until now that read exactly like a pass.

* **2.84.0** — **A checkpoint-loader FLUX.2 Klein 9B workflow.**
  `comfy_workflows/img_flux2_klein_9b_ckpt_t2i.json` is the shipped Klein 9B
  text-to-image graph with one node changed: a `CheckpointLoaderSimple` in place
  of the `UNETLoader`. Use it when your model file sits somewhere ComfyUI treats
  as **checkpoints** — typically a Forge/A1111 `Stable-diffusion` folder mapped
  in `extra_model_paths.yaml` — because `UNETLoader` only lists files under its
  own `diffusion_models` search paths and will not show the file at all,
  whatever the file actually contains. Only the checkpoint's MODEL output is
  used; the text encoder and VAE keep coming from their own loaders, because a
  FLUX.2 file usually carries the transformer alone and connecting an empty CLIP
  or VAE output fails at load. The Model dropdown switches to your checkpoints
  list automatically (the loader key decides the category). The alternative
  remains: leave the file where it is and hard-link it into `diffusion_models`
  from Settings → Image. This changes the workflow; that changes the folder.

* **2.83.1** — **`clear-comfy.bat`, so recovering does not mean rebooting.**
  Kills every ComfyUI process (matched on its *command line*, so bitGen Studio's own
  render worker and any other Python you are running survive), frees port 8188,
  empties ComfyUI's node cache, `temp/`, `__pycache__` and the ComfyUI-Manager
  registry cache, then offers to relaunch ComfyUI **in a real console window**.
  Models, output, input, saved workflows and settings are never touched.
  Usage: `clear-comfy.bat [path\to\ComfyUI] [/start|/nostart] [/quiet]`; with no
  arguments it reads the folder from `config.json`. The `[Errno 22]` message in
  the worker log now points at it, because a "restarted" ComfyUI has often been
  the *old* one still holding the port.

* **2.83.0** — **One press of Generate Image, one fresh seed, one fresh
  filename.** The seed is now drawn **when the request arrives**
  (`lib/imageSeed.js`) instead of deep inside the worker, so the number that
  actually made the picture is recorded in the job, printed in the log, and
  **written into the filename**: `20260822-193545_s316826193_61e2ec4b3780.png`.
  A picture worth keeping can therefore be made again from the file itself,
  without the job log — which is trimmed — still existing. A seed you type in is
  obeyed exactly, twice in a row if you ask; only an absent or negative one is
  rolled. A seed saved on a *style* is deliberately **not** treated as pinned: a
  style is a look reused across many prompts, and a frozen seed inside one turns
  every render made with it into the same picture. On the **sd-cli** engine `-1`
  used to be handed straight to sd-cli, which rolled its own seed, never
  reported it, and quietly made the batch walk (`seed + i`) a no-op — a batch of
  four was four rolls of the dice rather than four deliberate neighbours; it now
  walks from a real number and each file names its own seed. Filenames are built
  in one place (`scripts/image_name.py`) for both engines and **checked against
  the disk before every write**, so a clock that goes backwards or a reused job
  directory can no longer overwrite a rendered picture. Finally, a workflow with
  **no seed input the patcher can reach** now says so in the log instead of
  rendering the same image forever — the exact silent condition that made 2.78.0
  look like a LoRA that would not load.

* **2.82.0** — **The full project tree from the first moment, and one file per
  reference group.** Creating — or simply opening — a project now ensures
  `chat/`, the asset folders, and `references/` with `image/`, `video/` and
  `sound/` inside it, so projects made by older builds grow the new folders the
  next time they are touched. Reference groups moved from one shared
  `refgroups.json` to **`references/<group name>.json`**, each item recorded as
  **filename + reference type** (`image` | `video` | `sound`), with an image's
  subject/role assignment kept so the storage change loses no feature. The wire
  format and the UI are untouched — conversion happens at the edge. The old
  file is **migrated automatically on first read and renamed to
  `refgroups.json.migrated`** rather than deleted, because a migration that
  destroys its input cannot be re-run after a bug in it is found; a per-group
  file always wins over a re-appearing legacy file, so nothing can be rolled
  backwards. Group names and item filenames are sanitised with one shared
  normaliser — the first draft had two, and on Linux a backslash is not a path
  separator, so a hostile name saved under one spelling and loaded under
  another.

* **2.81.3** — **Quitting the app now actually stops the ComfyUI it launched.**
  The shutdown sweep (kill the process tree, then a belt-and-braces search for
  stray ComfyUI processes) has existed since the launcher did — but it hung off
  the server's exit handlers, and Electron's quit called `server.kill()`, which
  on Windows is `TerminateProcess`: **the server died with its handlers never
  run**, so the hidden ComfyUI survived, holding port 8188 and the VRAM. That is
  exactly "I quit the app and ComfyUI won't launch by hand". Three layers now:
  Electron holds the quit and asks **`POST /api/shutdown`** first (the server
  replies, sweeps, and exits itself); the quit still completes if the server is
  unreachable or slow, so a dead server can never make the app unquittable; and
  the server carries a **parent watchdog** — Electron hands it its pid, and if
  that process vanishes (Task Manager, crash — nothing fires `before-quit`
  there) the server sweeps and leaves under its own power. If you have an orphan
  from before this build, end the hidden `python.exe` in Task Manager once, or
  reboot; from then on quitting cleans up.

* **2.81.2** — **The Errno-22 sampler crash is now recognised, explained, and
  starved of its trigger.** The same failure —
  `OSError: [Errno 22] Invalid argument` in `SamplerCustomAdvanced` — survived
  both previous fixes, so this release stops guessing at a single cause and does
  three things at once. The launched ComfyUI now also gets **`TQDM_DISABLE=1`**:
  no progress bar means no mid-sampling stderr burst and **no flush to die on**,
  whichever handle is broken — and nothing of value is lost, since job progress
  reaches the UI over ComfyUI's websocket, which does not go through tqdm. The
  worker now **recognises this exact failure signature** and appends what to do,
  in order: update ComfyUI-Manager (the fix is upstream); if ComfyUI was started
  by bitGen Studio before 2.81.1, restart it from Settings → Image so the new stdio
  takes effect; or start ComfyUI in a normal console window. An ordinary error
  gets no speculation appended. **Important:** the env changes only apply to a
  ComfyUI *launched by this build* — a ComfyUI still running from days ago has
  none of them.

* **2.81.1** — **A ComfyUI we launch now gets unbuffered, UTF-8 stdio.** We spawn
  it with piped output and no console, so Python block-buffers its streams — and
  ComfyUI-Manager's prestartup wrapper flushes that handle, which is the
  documented site of `OSError: [Errno 22] Invalid argument` on Windows
  (ComfyUI-Manager #2458, ComfyUI #11629). It surfaces mid-sampling because that
  is when tqdm starts writing progress to stderr, which is exactly where these
  renders were dying: inside `SamplerCustomAdvanced`, on graphs that were
  otherwise fine. `PYTHONUNBUFFERED=1` removes the failing flush and makes the
  app's ComfyUI log stream live instead of arriving in lumps;
  `PYTHONIOENCODING=utf-8` (only when not already set) stops a single non-ASCII
  character in a model name killing the process. **This is a hypothesis with a
  mechanism, not a proven fix** — the 2.80.3 seed cap was not the cause and is
  now documented as such.

* **2.81.0** — **The viewer no longer opens Edge as well, and gained a
  filmstrip.** A gallery still carried its own `window.open` from before the
  lightbox existed, so one click gave you the dialog **and** an external browser
  window — and under Electron that leaves the app entirely. Both stray calls are
  gone (the unplayable-video placeholder had one too); `window.open` now survives
  only behind the explicit **↗ Open externally** button. The dialog gets a **2px
  border and a 5px radius**, and **nothing in it scrolls** — every strip is a
  fixed height and the stage takes the rest, so a scrollbar can never appear to
  fight the pan. **Zoom and navigation moved out of the title bar to a control
  strip under the picture**, and a **filmstrip of the whole set** runs along the
  bottom: click any frame to jump to it, and the current one is highlighted and
  kept in view while you page. The strip is built once per open rather than on
  every slide, because rebuilding it restarts each clip's metadata load and
  throws away the horizontal scroll position.

* **2.80.3** — **Random seeds are capped to 0..2^32-1.** 2.78.0 drew from the
  full int64 space, and the next render died with
  `OSError: [Errno 22] Invalid argument` inside `SamplerCustomAdvanced` — the
  node that consumes `RandomNoise`'s output — on a graph otherwise identical to
  one that had just worked. The seed line was the only difference. The mechanism
  is **not proven** (an upstream ComfyUI/Windows bug produces the same error text
  from a tqdm stderr flush, which is what sent the first diagnosis the wrong
  way), but `0..2^32-1` is the range ComfyUI's own UI, A1111 and
  `numpy.random.seed` all accept, huge seeds buy nothing — four billion distinct
  images per prompt is not a limit anyone reaches — and small seeds are what
  worked. When the cost of being wrong is zero and the evidence points one way,
  take the cheap option.

* **2.80.2** — **Nothing fails silently in the browser any more.** Every uncaught
  error and rejected promise now lands in the app console — on screen,
  selectable, persistent — because "the tab locks up" and "the dropdowns stop
  working" are what a JavaScript exception looks like from the outside: a handler
  dies half-way, the DOM is left half-built, and nothing says so. Every repaint
  of the style form is wrapped, so a failure names itself in the status line
  instead of leaving a dead tab, and every `showModal()` is guarded — calling it
  on an already-open dialog throws `InvalidStateError` and kills the calling
  handler mid-way, which is one way a form ends up half-drawn. **This diagnoses
  rather than fixes**: the reported lockup could not be reproduced, and the DOM
  suite now runs the real Save handler and switches between four differently
  shaped styles (including `te: null` and an sd-cli one) without a fault.

* **2.80.1** — **"ComfyUI does not offer it at all" was wrong, and sent you
  looking in the wrong place.** A LoRA picked from the dropdown could then be
  refused, because the dropdown had been built by the **folder scan** while
  ComfyUI was down — and ComfyUI reads its model lists once at startup and
  caches them, so anything added since is invisible to it (433 LoRAs on disk
  against 430 in its list). The refusal now keeps the disk listing alongside
  ComfyUI's own and tells the two cases apart: *"the file IS on disk in a folder
  ComfyUI searches — ComfyUI just has not noticed it. Restart ComfyUI, then press
  ⟳ Rescan. The name is correct and needs no change."* A name that genuinely is
  not anywhere still says so. Also guards `showModal()` on an already-open
  dialog, which throws `InvalidStateError` and would kill the calling handler
  half-done.

* **2.80.0** — **A proper media viewer.** Clicking any thumbnail in the Gallery,
  the Assets dock or the References dock opens a full-window dialog: **slide**
  through the rest of that list with the arrows or ← →, **zoom** with the wheel,
  the +/− buttons or +/−/0, **pan** by dragging once zoomed, and double-click to
  toggle between fit and 2.5×. Videos play with full controls, sound files get a
  player, and ↗ opens the original in a new tab. Zooming is anchored at the
  pointer, not the centre — centre-anchored zoom makes the edges of a large
  image effectively unreachable. Each pane is its own slideshow, so "next" means
  the next thumbnail beside the one you opened. Media is released on navigate
  and on close, because a `<video>` still holding a source keeps buffering and
  on Windows can keep a deleted file locked. **The player under the timeline is
  now the timeline preview and nothing else** — a gallery click used to hijack
  it, so the preview quietly stopped matching what a compile would produce.
  Clicking a timeline *clip* still drives it, because that is the timeline.

* **2.79.0** — **One-click fix for "the loader is unet, not checkpoint".**
  ComfyUI resolves a combo value inside the search paths registered for *that
  folder type*, so a FLUX diffusion model filed under `checkpoints` can never be
  picked by `UNETLoader`, however correct the file is — which is why copying it
  into ComfyUI's own diffusion folder made it work. The refusal dialog now
  offers **Make it available as a diffusion_models**: it **hard-links** the file
  into a folder that loader does search, preserving the subfolder so your
  style's saved name is unchanged and simply starts working. On one drive that
  is instant and costs no extra space — which matters when the model is 20 GB.
  If your `extra_model_paths.yaml` names a folder that was never created (a
  common case, and Tim's), it creates it; if the source and target are on
  different drives it **refuses and tells you the size** rather than silently
  spending twenty gigabytes, and asks before copying. A name clash is refused
  rather than uniquified, because here the name is load-bearing — it is what the
  workflow asks ComfyUI for. New `lib/modelInstall.js` +
  `POST /api/comfymodels/install`.

* **2.78.0** — **`seed -1` now actually randomises.** It used to leave the
  workflow's own `noise_seed` alone, and the shipped t2i template carries
  `noise_seed 0` — so every render came back **byte-identical**. "Leave the
  template's value" is the right default for steps and cfg, where an export from
  a working session beats anything invented here; for a seed it defeats the
  entire point of generating again. The number drawn is **reported in the worker
  log**, so a picture you liked can be reproduced by typing that seed back in.
  (This also explains "the LoRA isn't loading": with a fixed seed the output
  never moved. The LoRA chain in that template is verified wired — the filled
  slot feeds the guider's model *and* the text encoder's clip, and there are now
  tests pinning that the bypass of the unused slots rewires back to it.)
  The pre-flight refusal also got more useful: when your model is a real
  diffusion model that simply lives in another UI's checkpoint folder, it now
  names **the folder it found it in and the exact `extra_model_paths.yaml` line
  to add**, plus the reminder that ComfyUI reads that file only at startup.

* **2.77.2** — **The pre-flight refusal now says what your model actually is,
  and you can copy it.** "not a diffusion model, 24 found" is true and nearly
  useless. The refusal now looks up the value in every other category and names
  it — *"you have SDXL/jugg.safetensors · wanted a diffusion_models
  (unet\_name) · but it is: a checkpoints"* — explains that this workflow's
  loader will not accept that kind, and lists the entries that would work. A
  spelling-only mismatch prints the exact string ComfyUI uses instead. It is no
  longer an `alert()`: the text goes to the app console (selectable, and it
  stays there) **and** into a dialog with a Copy button, because the one message
  naming the exact model was the one thing that could not be pasted back.

* **2.77.1** — **Fixes empty folder filters on Windows, from Tim's own diagnostic
  dump.** `folderOf()` split names on `/` only. ComfyUI's `/object_info` builds
  its combo values with `os.path.relpath`, so on Windows they contain
  **backslashes** — every live entry got a folder of `""`, and the filter
  dropdowns listed nothing at all on a machine with 190 checkpoints and 433
  LoRAs sitting in subfolders. It only appeared once ComfyUI became the
  authoritative source, because the folder scan emits forward slashes. Making
  the test fixture spell a subfolder the way ComfyUI really does immediately
  caught a **second** bug: the live-to-scan cross-reference was keyed on the raw
  name, so every subfoldered entry silently lost its file size and its root
  attribution. Entry names are still passed through byte-for-byte — only the
  derived folder and the lookup key are normalised. Also adds **show every model
  kind** beside the Model dropdown: narrowing to the workflow's loader category
  is a sensible default, not a cage, and the pre-flight check still refuses a
  value ComfyUI would reject.

* **2.77.0** — **Answers "is it reading my extra_model_paths.yaml?" by showing
  you.** The status line under the model fields now says where the list came
  from, names the yaml it read (or says none was found), and — the likely reason
  folders look missing — states when the **Model list has been narrowed** to the
  categories this workflow's loader accepts, so a `UNETLoader` graph
  deliberately shows no checkpoint folders. A **Show folders** link dumps every
  search root, whether it exists, how many entries it holds and which yaml group
  added it, into the console. The scan now also looks for the yaml where
  **ComfyUI Desktop** keeps it (`%APPDATA%\ComfyUI`, `~/.config/ComfyUI`,
  `~/Library/Application Support/ComfyUI`), accepts an explicit override via
  `engine.comfy.extra_paths` for `--extra-model-paths-config` installs, and
  **reports rather than merges** a second yaml it finds — ComfyUI reads one file,
  and listing models the running ComfyUI cannot see is how "Value not in list"
  happens. Note that when ComfyUI is running, the lists come from ComfyUI itself
  and already have the yaml applied; restart ComfyUI after editing it.

* **2.76.1** — **Fixes empty Model / VAE / text-encoder dropdowns.** The
  "All folders" sentinel was `"\u0000all"`, and a NUL byte does not survive HTML
  parsing — the parser replaces it with U+FFFD. So setting the filter to "All"
  matched no option, the select landed with nothing selected, and the file list
  was then filtered for a folder literally named `""`: **nothing matched, and
  every dropdown came up empty on a machine with models in every folder.** The
  sentinel is now plain ASCII (`*all*`, which cannot collide because real values
  always contain `/`), and a folder select can no longer end up with nothing
  selected. Adds `scripts/test-imagedom.js`, which **executes** the Settings →
  Image paint path in a real DOM and asserts the dropdowns fill —
  `test-imageui.js` greps the source and had passed for several releases while
  this was broken, because a regex cannot tell you a function returns nothing.
  The LoRA dropdown had looked healthy throughout only because the "keep the
  stored value" branch re-added its one saved entry; the new checks ignore that
  fallback so it can never stand in for a working list again.

* **2.76.0** — **▶ Start ComfyUI & scan models in Settings → Image.** Launches
  ComfyUI from the folder already set in Settings → ComfyUI, waits for the API,
  then re-reads the model folders so the Model / VAE / text-encoder / LoRA
  dropdowns fill without leaving the dialog. The rescan is explicit rather than
  left to the shared launch helper, because that helper returns immediately when
  ComfyUI is already running — and "the button did nothing" is the outcome this
  button exists to prevent. It relabels itself to **⟳ Rescan model folders** once
  ComfyUI is up, so it always states which job it will do, and it does not close
  the Settings dialog the way the ComfyUI tab's button does. Hidden for sd-cli
  styles, which never touch ComfyUI.

* **2.75.1** — **LoRA coverage, after a test that proved nothing.** The 2.75.0
  check that the text encoders are rewired through a built LoRA was written as
  *"if the positive node has a clip input"* — and in the text-to-image graph that
  node is the `PrimitiveStringMultiline`, which has none, so the assertion
  silently **skipped** and read green either way. It now finds every
  `CLIPTextEncode` by class and asserts all of them, plus that nothing bypasses
  the chain to read the CLIP loader directly. Also adds the multi-LoRA case that
  was never covered: three LoRAs must chain (each taking the previous one's model
  *and* clip), the last one must be what the sampler reads, and a weight of 0
  must stay in the chain switched off rather than being dropped. All verified
  against both shipped templates. No behaviour changed — `build_loras()` was
  already correct; the tests were not.

* **2.75.0** — **Two confirmed-working FLUX.2 9B templates ship, and the
  patcher learned to read them.** Both drive their prompt and their size from
  shared **Primitive** nodes — what ComfyUI produces when a widget is promoted
  to an input and reused by two consumers — and every writer in
  `scripts/comfy_image.py` correctly skips a link where a literal used to be. So
  the text-to-image graph failed outright with *"no text prompt node could be
  found"*, and had it not, the size would have silently stayed 1024x1024 whatever
  the UI asked for. `is_primitive()` / `widget_key()` now follow the link one hop
  to the widget. That is narrow **on purpose**: only a `Primitive*` node holding
  a literal counts, so a width computed by `GetImageSize` in the image-edit graph
  is still left alone and an edit still keeps its source picture's dimensions.
  **LoRAs are built into these graphs at render time** — neither template carries
  a LoRA node, so the style's stack is inserted in front of the model *and* the
  CLIP consumers, which the tests now assert rather than assume. New starter
  styles **FLUX.2 9B (verified)** and **FLUX.2 9B edit (verified)** (two
  reference slots) are listed first, so a fresh install lands on a known-good
  template.

* **2.74.0** — **Fixes "Value not in list" for good, by fixing the right thing.**
  A render died on `node 70: Value not in list [unet_name] =
  flux_klein_9B/aisha....safetensors — not in (list of length 24)`. The file
  existed, the name was spelled correctly, and 2.72.0 had already changed the
  path separator to chase this exact message. **The separator was never the
  problem.** The fault was the *kind* of model: the Model dropdown merges
  checkpoints, diffusers and diffusion_models into one list so nobody has to
  know which loader their graph uses, but `comfy_image.py` writes the chosen
  name into whichever loader key the graph **has** — so a checkpoint name landed
  in `unet_name`, and ComfyUI validated it against its diffusion_models list and
  refused. The dropdown is now **narrowed to the categories the workflow's own
  loader can accept** (`model_kinds` from `GET /api/styles`, `modelKinds()` in
  `lib/styles.js`), falling back to all of them when the graph cannot be read —
  a wrongly narrow list would hide the only model that works. As a backstop that
  does not depend on that diagnosis being right, **Generate Image now checks the
  style against ComfyUI's live lists before submitting** and refuses with the
  reason, naming the exact spelling when the difference is only case or
  separator, instead of letting the worker die on it. The Settings → Image
  status line now also prints **the resolved ComfyUI folder and a per-category
  count**, because "the VAE dropdown is empty" and "the dropdowns are reading a
  different ComfyUI install" look identical until you can see which folder was
  used.

* **2.73.0** — **Diffusers models, fuller folder listings, and Generate Image
  now starts ComfyUI.** The Model dropdown gained a third source: ComfyUI's
  `diffusers` folder and every `diffusers:` path in `extra_model_paths.yaml`.
  They are listed the way `DiffusersLoader` lists them — the FOLDER holding
  `model_index.json`, never the weights inside it, which are real files and
  values ComfyUI would reject. They are a category of their own rather than an
  alias of checkpoints, because `CheckpointLoaderSimple`'s live dropdown does
  not contain them and folding them in would have let the live list erase them.
  The Model dropdown's category list is now served by the endpoint so the UI
  cannot drift from `lib/comfyModels.js` again. The file-extension set is now
  ComfyUI's own `supported_pt_extensions` rather than a hand-written subset
  (this adds `.pt2`), so the VAE and text-encoder dropdowns list everything
  ComfyUI would load. And **Generate Image** now brings ComfyUI up if it is not
  running, waits for the API and then submits — asking the **style's** engine,
  not the video backend, which is what made video-on-sd-cli plus
  images-through-ComfyUI silently skip the launch and fail on a ComfyUI nobody
  had started. `comfy.ensure()` gained a `force` flag for exactly that case.

* **2.72.0** — **Fixes a comfy render dying on a model that was right there.**
  A model in a *subfolder* was named with a backslash and ComfyUI answered
  `Value not in list [unet_name] = flux_klein_9B\aisha....safetensors`. ComfyUI
  matches these combo values exactly and spells subfolders with forward slashes;
  2.71.0 built them with the platform separator instead, on the reasoning that
  ComfyUI derives its own names with `os.path.relpath`. That reasoning was
  wrong, and only names with a subfolder could expose it. Fixed in two places:
  the scan now emits forward slashes, and `comfy_name()` in
  `scripts/comfy_image.py` normalises **every** loader value — model, VAE and
  text encoder, not just LoRAs, which already had it — so styles saved before
  this work without being re-picked. The deeper fix is that the dropdowns no
  longer *mirror* ComfyUI's naming conventions: when ComfyUI is reachable they
  are populated from its own `/object_info`, which IS the dropdown, and the
  folder scan is the labelled fallback for when it is not running.

* **2.71.0** — **The comfy-mode model fields became dropdowns of what ComfyUI
  can actually load.** Model, VAE, every text-encoder slot and every LoRA row in
  Settings → Image now list real files instead of taking free text, each with an
  icon-only **📁** browser beside it, and Model and LoRA each get a **folder
  filter** with **All folders** first. Both sources are read — ComfyUI's
  `models\` tree *and* every search path in `extra_model_paths.yaml` — because
  reading only the first hides the library of anyone who keeps their models
  outside the ComfyUI folder, which is what that file exists for. New
  `lib/comfyModels.js` + `GET /api/comfymodels`, with a cache keyed on the yaml's
  mtime so editing it invalidates the list by itself. The yaml is parsed by a
  documented subset parser rather than a new dependency (this project has two,
  and installs offline); it handles what real files in the wild contain —
  trailing comments inside block scalars, quoted booleans, Windows separators,
  CRLF, tabs — and **reports** what it will not guess at, including the common
  mistake of keys written outside a group. `unet`/`diffusion_models` and
  `clip`/`text_encoders` are one category each, since ComfyUI renamed them and
  still accepts both. A saved value the scan cannot find is kept and marked
  "not found" rather than silently replaced, and the text input remains the
  stored value, so hand-edited style files still round-trip and sd-cli styles
  keep their plain path field and local picker.

* **2.70.0** — **Drag sound, pictures and video onto the References dock**,
  from the Assets dock, from the Gallery, or straight off the desktop. The
  whole dock is one drop target that routes by kind and then reveals the tab the
  file landed in; a status line above the tabs speaks every result, including
  refusals, because a drop that silently does nothing is indistinguishable from
  a broken one. Caps are the model's: 9 pictures, 3 videos, 3 audio clips.
  Gallery stills became draggable for the first time — they were deliberately
  not, because the Gallery reads `output/` while the resolvers read the asset
  folders and the two names can differ. That reason is removed rather than
  ignored: a dropped clip is **adopted** first (`POST /api/passets/adopt`,
  new `lib/adopt.js`) which hard-links it into the right asset folder and
  returns the name it actually got, and only that name is ever used. Pictures
  skip adoption entirely because they travel with the job as bytes. `.webp` is
  the one extension that cannot be classified by extension — it is both a still
  format and one of this app's video output formats — so the caller passes the
  tab it came from as a hint, and a hint on any *unambiguous* extension is
  ignored. Also fixes a documentation-vs-reality drift found while adding the
  tests: `scripts/test-waveform.js`, `scripts/test-autoassets.js` and
  `scripts/test-span.py` were **never actually invoked** by
  `scripts/e2e-stub-test.sh`, despite the notes stating that a green e2e run
  covered them. They are wired in now.

* **2.69.0** — **Image editing**, from ComfyUI's FLUX.2 [Klein] 9B image-edit
  template (flattened from the file Tim supplied, subgraphs and all). A third
  starter style ships with it, carrying **three reference-image slots and four
  LoRA slots, all bypassed until used**. Reference pictures come from the Refs
  dock: the browser saves them into the project's Images assets, the worker
  uploads them to ComfyUI, and the graph gets the names ComfyUI hands back.
  Unused image slots are not merely left empty — an empty `image` fails
  ComfyUI's validation just as an empty `lora_name` does — so the slot is
  removed together with its `ImageScaleToTotalPixels`, `VAEEncode` and the pair
  of `ReferenceLatent` nodes behind it, and the positive/negative conditioning
  chains are rewired around the gap.
  An edit **keeps the source picture's size**: width and height come from
  `GetImageSize` on reference 1, so the style's own size is not written over
  them. The UI only sends references to a workflow that has slots for them
  (a text-to-image workflow refuses images rather than dropping them silently),
  and an edit style with an empty Refs dock says so before anything is queued.

* **2.68.0** — **Ships with two FLUX.2 [Klein] 9B styles**, distilled and base,
  built from ComfyUI's own published template (node types, widget names and
  defaults taken from that file, not from memory). Drop the models into
  ComfyUI's folders and Generate Image works with no setup.
  Each template carries **four LoRA slots that ship bypassed**. The style's LoRA
  stack fills them in order and every unused slot is *removed* — model and CLIP
  passed straight through — before the graph is queued, because an empty
  `lora_name` is not a no-op in ComfyUI, it fails validation. More LoRAs than
  slots and extra nodes are built as before.
  Two graph shapes handled that the earlier patcher would have got wrong:
  FLUX.2 splits positive/negative onto a `CFGGuider` while the latent lives on a
  separate `SamplerCustomAdvanced`, so the latent had to be found without going
  through "the sampler"; and image size now reaches **every** node that asks for
  one, because `Flux2Scheduler` shifts its sigmas by resolution and leaving it
  at 1024 while rendering 768 silently degrades the result.
  **The distilled template has no negative prompt** — it runs the positive
  conditioning through `ConditioningZeroOut`, so both of the guider's
  conditioning inputs trace back to the *same* text node. Writing a negative
  prompt there would have overwritten the prompt and rendered "blurry, low
  quality" as the subject. That is now detected and refused, and it is covered
  by its own test.

* **2.67.0** — **Images render through ComfyUI**, and sd-cli is no longer
  needed to make one. This install already drives ComfyUI for video, so
  requiring a second inference engine — and a second copy of every model — just
  to render a still made no sense. ComfyUI is now the default for new styles;
  sd-cli stays as a per-style option.
  A ComfyUI style points at an **Export (API)** workflow and nothing else: the
  workflow names its own models, and the style's model/VAE/text-encoder fields
  become optional overrides (ComfyUI *dropdown values*, not paths on this
  machine — the labels change with the engine, and no file picker is offered
  where a path is not meant). Prompt, negative prompt, seed, steps, cfg, size
  and batch are patched into a copy of the graph on every render; the file on
  disk is never touched.
  **The LoRA stack is BUILT INTO the graph** as `LoraLoader` nodes (or
  `LoraLoaderModelOnly` where a workflow has no CLIP), chained, with every model
  and clip consumer rewired — so an exported workflow needs no LoRA nodes of its
  own and a weight of 0 still means "off but in the stack". This is deliberately
  *not* the video patcher, which strips every LoraLoader it finds.
  **Patching is structural, not name-based.** Nodes are found by ComfyUI's input
  names (`ckpt_name`, `seed`, `steps`, `positive`, `latent_image`) rather than
  by class name, so the same code drives a plain SDXL KSampler graph and a FLUX
  graph that splits sampling across `RandomNoise` + `BasicScheduler` +
  `SamplerCustomAdvanced` with no negative prompt at all — both are in the unit
  tests. It refuses, with an explanation, where guessing would be invisible: two
  unwired prompts (rendering the negative one as the subject looks like a bad
  model, not a bug), an override with nowhere to go, or a ComfyUI *UI* workflow
  export where an API one was needed.
  New: `scripts/comfy_image.py` (the patcher, pure and unit-tested),
  `scripts/comfy_client.py` (transport), and `scripts/test-comfyimage.py`
  (55 checks). The e2e renders images with `sd_cli` pointed at a path that does
  not exist, which is the only honest way to prove sd-cli is not needed.

* **2.66.1** — **Styles are stored one file per style**, `styles\<style
  name>.json`, instead of a single blob: readable, hand-editable, copyable to
  another install and backed up individually. The name is the filename so names
  must be unique — a clash is refused rather than overwriting somebody's style —
  while the permanent id stays inside the file, so renaming a style moves its
  file and keeps its identity. A file dropped in by hand is picked up on the
  next read; one unparseable file is skipped rather than emptying the list; a
  2.66.0 `styles.json` is migrated automatically.

* **2.66.0** — **Image generation, with named styles.** bitGen Studio can now render
  still images as well as video: pick a **Style** beside the prompt and press
  **🖼 Generate Image**. Finished stills appear in the gallery's new **Images**
  tab and are added to the **Images** asset column automatically, so they can be
  dragged straight onto the timeline (or used as an ref2va/fl2va input) without
  being hunted down and re-imported.
  **A SEPARATE WORKER.** Images are rendered by `image_worker.py`, not by
  `worker.py`, which is untouched by this feature. The two share an executable
  (sd-cli) and nothing else: the 4n+1 / 17k+5 frame grids, the 361-frame
  single-run ceiling, `--mode vid_gen`, `--video-frames`, `--audio-vae`, chunked
  fl2va hand-off and seam-drop joining are all *video* rules, and every one of
  them is wrong for a still. Two files means a change to image defaults cannot
  perturb a render, and the e2e suite fails if image handling ever leaks into
  the video worker. `lib/core.js` picks the worker per job mode from one map.
  **Styles** (Settings → **Image**) save a model, its VAE and text encoders, the
  sampler settings and a LoRA stack under a name. Five architectures are
  supported — **FLUX.1**, **FLUX.2 klein 9B**, **SDXL**, **Z-Image** and
  **Qwen-Image** — and their flags live in `lib/imageArch.json`, the single
  catalogue that the Settings dropdown, the validator and the command builder
  all read, so the UI and the renderer cannot disagree. Three of the five pass
  their text encoder with `--llm`; SDXL's checkpoint goes to `-m` while the rest
  use `--diffusion-model`; Qwen-Image gets `--flow-shift 3` automatically unless
  your own Extra args set it. The flags were taken from stable-diffusion.cpp's
  own docs, and sd.cpp says in its README that command-line options change
  often — if one is renamed upstream, edit `lib/imageArch.json` (one place) or
  override per style with **Extra sd-cli args**.
  **LoRA stacks** with a weight slider per LoRA, passed as sd.cpp's
  `<lora:name:weight>` tokens against the LoRA folder from Settings → Paths. A
  **weight of 0 is a real setting** ("this one off, keep it in the stack") and
  survives the whole browser → JSON → disk → command-line round trip, as do a
  `cfg` of 0 and a `clip_skip` of 0 — the `+v || default` idiom that turns every
  legitimate zero into a default is tested against at all three layers.
  **Batches**: 1–8 images per press, each with its own seed (a fixed seed is
  walked, so a batch is N different pictures rather than one repeated N times).
  Every image in a batch reaches the dock, not just the last.
  Styles live in `styles\<style name>.json` — one readable file each, behind
  `GET/POST/DELETE /api/styles` — and **not** in `config.json`: `POST /api/config` is an allow-list, and a
  user-owned list that grows every time you press New does not belong behind
  one. Style ids are random and permanent, never array indices, so deleting or
  renaming one never repoints a saved selection at a different style.
  Generate Image is disabled — with the reason in its tooltip — for a style with
  an unfilled required slot, rather than being pressable into a guaranteed
  failure.

* **2.65.0** — **Generated videos appear in the asset dock by themselves.** The
  worker writes renders into `projects\<project>\output\`, but the dock lists
  `projects\<project>\video\` — two different folders, so every generated clip
  had to be found in the gallery and dragged back in by hand before it could be
  used on the timeline or as a continuation source. A successful render is now
  registered into the Video assets the moment it lands, and the dock refreshes
  itself when the job finishes.
  **Hard link, not copy** (`lib/autoAssets.js`): `output\` and `video\` are
  always on the same volume, so the two names point at one set of bytes and a
  2 GB render is not doubled on disk. Deleting either name leaves the other
  intact and complete. Copying is the fallback for a project folder on a
  network share or any filesystem that refuses to link.
  **A timeline compile is deliberately NOT registered.** `<project>.mp4` is
  replaced on every recompile, and a hard link captures the bytes at link time
  — the asset would go quietly stale and you would edit against an older cut.
  Numbered renders in `output\` are never rewritten, which is what makes them
  safe. A name clash uniquifies rather than overwrites, registering twice is a
  no-op, and nothing here can ever fail a job: a render that finished has
  finished, whatever the dock does.
  Tests: `scripts/test-autoassets.js` (29) plus 6 e2e checks that render a real
  clip and assert the dock lists it and that it is genuinely linked, not copied.

* **2.64.0** — **Waveforms in the audio layers.** Every clip on an audio layer
  now draws the actual shape of its sound behind the filename, so you can see
  where the beats, the verses and the silences are instead of trimming against
  a blank blue rectangle. Trimming re-slices the waveform, and dragging or
  zooming stretches it with no refetch.
  **How it works:** the new `GET /api/waveform?src=sound&name=<file>` returns
  1200 amplitude peaks (one byte each, ~1.2 KB) for the **whole source file**,
  extracted once by ffmpeg at 8 kHz mono and cached on disk under
  `projects\<project>\.cache\waveform\`. The cache key includes the file's
  size and mtime, so replacing an asset redraws it. Peaks describe the *file*,
  never the trimmed clip — that is what lets one fetch serve every clip cut
  from the same song at every zoom level, with the browser doing nothing but
  arithmetic and an SVG that stretches itself. Peaks are normalised to each
  file's own loudest point, so a quiet recording still draws a readable shape.
  A file with **no audio stream** (an image, a silent render) returns a flat
  waveform rather than an error. The waveform sits behind the label and takes
  no pointer events, so dragging, trimming and ✕ are unaffected.
  Tests: `scripts/test-waveform.js` (13) plus 9 e2e checks over the endpoint,
  the disk cache, silent files, 404/400 and path traversal.

* **2.63.0** — **Compile runs to the end of the TIMELINE, not the end of the
  video track.** ⚙ Compile used to stop at the last frame of the base video
  track (V1). A clip on V2+, an image layer or a soundtrack that started or
  continued after V1 ended was silently thrown away — no warning, no log line.
  A 2-second base track with an overlay at 3 s produced a 2-second movie.
  **Root cause:** two ffmpeg defaults that both mean *"however long input 0
  is"*. The composite pass fed the joined V1 track in as input 0, and
  `overlay` emits exactly as many frames as its **main** input, while
  `amix=duration=first` stops with the first stream in the mix — V1's own
  audio. Neither had anything to do with the timeline.
  **Fix:** the new `scripts/timeline_span.py` (mirrored in
  `lib/timelineSpan.js`) is now the one place the compile's length is decided:
  the end of the last clip on **any** layer. The worker pads V1 up to it with
  black (`tpad`) and silence (`apad`), mixes with `duration=longest`, and caps
  the output at the exact span with `-t`. Both "just copy the video track"
  fast paths are skipped whenever padding is needed, so a compile that fits
  the video track still costs exactly what it did before.
  `POST /api/export` now also passes each clip's `dur` through and stamps
  `timeline.scene_end` on the job. **An unmeasurable clip contributes
  nothing** — a clip with no `out` and no `dur` is skipped rather than guessed
  at, because the worker can ffprobe it properly and a guess can only ever pad
  a real video with black that was never on the timeline.
  Also fixed: a **silent base video** no longer fails the whole compile — the
  audio mix is only wired up when `allv` actually has an audio stream, the
  same trap `fade_v1` already guarded.
  Tests: `scripts/test-span.py` (28) and 16 new checks in
  `scripts/test-timeline.js` run the same shared case table against the two
  mirrors; the e2e suite measures the **real duration** of three compiles.

* **2.62.0** — **Compile writes `projects\<project>\<project>.mp4`.**
  ⚙ Compile now produces one deterministic file — the project's movie — in the
  **project root**, replaced on each compile, instead of a numbered
  `<project>+N.webm` in `final\`. Every visible layer is composited into it;
  hidden and un-soloed layers are dropped exactly as the preview shows them.

  The container change is real, not just an extension: mp4 must carry
  **H.264/AAC** to play everywhere, so the VP9 stream-copy shortcut is no longer
  valid even when nothing was composited. `mp4_args()` in `worker.py` is the one
  place those codecs are chosen. The old "nothing to composite, just copy the
  file" fast path would have produced a webm wearing an `.mp4` extension, so it
  now transcodes.

  Two supporting changes were needed and are worth knowing about. `lib/core.js`
  gained **`outputDirs()`/`outputExists()`** — the single list of every folder a
  finished job may write into. The job-completion check previously hard-coded
  `output/` and `final/`, so the first compile into the project root exited 0,
  wrote the file, and was still marked **failed**. And `/api/outputs/where`
  returned `dirs[0].dir` as "where generations land"; adding a search location
  silently repointed it, so it now resolves `output/` explicitly.

  e2e: **229 passed**, including that the file really is H.264, that it is
  served back over `/outputs`, and that recompiling replaces it rather than
  piling up.

* **2.61.0** — **Preview plays every layer, through to the end of the timeline.**
  Preview could stop when the *base track* ran out rather than when the
  *timeline* did, so a soundtrack, overlay or image layer that outlasted V1 was
  cut off mid-play. `pvTickBody()` had three separate places that could call
  `pvStop()`, two of them reached purely by V1 exhaustion. There is now exactly
  **one** stop rule, checked before any base-track handling: the preview ends at
  the OUT marker, or at `sceneEnd()` — the last frame on *any* layer. When V1
  runs out early the picture simply goes black and the wall clock keeps running
  so the other layers finish. `pv.stopAt` is never null now; a null used to mean
  "no end", which handed the decision back to the base track.

  **Preview could also play footage that was no longer on the timeline.** The
  cached `<video>` elements were keyed by *layer index : clip index*. Those
  indices are reused the instant a clip is deleted, reordered or moved between
  layers, so the cache returned an element still pointing at the previous file —
  and the cache was only ever added to, never pruned, so a removed clip's audio
  could keep playing from underneath. Caches are now keyed by media URL and
  pruned on every run.

  `pvGlobalT()` no longer dereferences `tl.video[pv.clip]` without checking it.
  This is the third instance of the same failure mode: `pvTick` re-arms only at
  the *bottom* of its body, so a single throw inside the rAF callback kills the
  loop silently and looks exactly like "preview stopped early".

  e2e: **223 passed**, including structural assertions that the tick keeps only
  one stop path, that `sceneEnd()` spans all four layer kinds, and that no
  index-keyed preview cache can come back.

* **2.60.0** — **In/out transitions actually render; assets import safely.**
  The in and out transitions were not merely incomplete — they reached
  *nothing*. `POST /api/export` builds the timeline the worker compiles, and it
  never copied the transition fields onto the job. The UI sent them, the route
  dropped them, and the worker's `video_transition_out` read empty on every
  export. Even the one fully-implemented path, the xfade join between adjacent
  V1 clips, could therefore never fire. The route now passes them through,
  **normalized at the boundary** so an unknown id becomes a cut before it can
  reach ffmpeg.

  Audio and image layers could not carry a transition *at all*: the UI flattened
  each layer to a bare array of clips, throwing the layer object away. Those
  tracks are now sent as `{clips, transition_in, transition_out}`, and the route
  accepts either shape so an older saved project still compiles unchanged.

  **What in and out now mean.** *In* is how a layer enters, *out* is how it
  leaves; on V1 the out transition additionally remains the xfade between
  adjacent clips. A full-frame track dips through a colour (black, or white for
  dip-to-white); an overlay, image or audio layer ramps its own alpha or gain,
  because there is nothing behind it to dip to. A layer's transitions apply at
  its earliest and latest clip — where the layer itself begins and ends.

  **Wipes and slides become a dissolve at a layer boundary.** xfade needs two
  pictures to move between and a layer's opening has only one, so a boundary
  renders the only thing meaningful with a single picture. The wipe still
  applies where that layer's clips *meet*. This is deliberate, not a fallback.

  Boundary fades live in `scripts/transitions.py` beside the xfade arithmetic,
  reading the same `lib/transitions.json` — adding a transition is still a
  one-file change. Nothing was added to `server.js`.

  **Assets.** Dropping a file whose name was already taken silently overwrote
  the existing asset — losing the file *and* repointing every timeline clip that
  referenced that name at different footage. Uploads now uniquify
  (`clip (2).webm`) and report the rename. The drop target is the **whole assets
  dock** rather than just the scroll box, so a file dropped over the empty space
  below a short list no longer vanishes, and the highlight no longer flickers as
  the pointer crosses child elements. The **timeline accepts OS file drops
  directly** — each file is imported into the project's folders and laid onto a
  new layer of the matching type, staggered so a multi-file drop does not stack.

  e2e: **221 passed**, including a luminance check that the exported frames are
  genuinely dark at the head and white at the tail.

* **2.59.0** — **The queue lives in a frame, and no dock shows a scrollbar.**
  The **Queue** is no longer the last section of the left dock's scrolling
  column, where a long list pushed everything else out of reach and the whole
  dock scrolled as one. It is now a **framed region pinned to the bottom of the
  dock**: System and Basic Settings take the height they need, and the queue
  frame claims everything left between them and the footer. Jobs scroll *inside*
  the frame, so the params above never move. The frame header carries a live
  count (`12 · 2 active`).

  Every dock scroll region — left, References, Assets, Gallery — and the queue
  frame itself now hide their **native scrollbar** and draw a slim **slider rail**
  on the right edge instead, which fades in only while the content actually
  overflows. Drag the handle, or click anywhere on the rail to jump. The wheel,
  trackpad and keyboard still scroll normally; only the OS scrollbar is gone.

  This is one new file, **`static/dockscroll.js`** — mark any scrolling element
  `data-dockscroll` and it gets a rail. The rail is an absolutely positioned
  sibling laid out from the scroller's own offsets, so **no wrapper element is
  needed** and the existing flex chains inside the docks are untouched. Nothing
  was added to `server.js`.

  Two flex details do the real work and are easy to break: the queue frame uses
  **`flex: 1 1 0`** (basis `0`, not `auto`) so it claims the *remainder* of the
  dock rather than splitting the free space with the block above it, and
  `#ldock > .scroll` uses **`flex: 0 1 auto`** so that block never grows into the
  frame's share. `min-height: 116px` keeps the queue usable on a short dock; when
  the dock is too short for both, the params block shrinks and scrolls first.

  Covered by `scripts/test-dockscroll.js` — 26 checks over the slider geometry
  (handle size, floor, travel, clamping, round-trip) plus a DOM shim that asserts
  the rail is created once, parented to the right dock, hidden on a collapsed
  dock, and that dragging it actually moves `scrollTop`. e2e: **210 passed**.

* **2.58.0** — **New project dialog, a project bar, and in/out transitions.**
  The left dock's **bitGen Studio** wordmark is gone — it named the app inside the
  app — and the menu bar gains **✚ New**, which opens a dialog for a project
  **name and description** instead of a browser `prompt()`. The project identity
  moved out of the menu bar into its own **project bar directly below it**, where
  a long name can wrap and the description has room to show. The description is
  carried through save and load, so saving no longer wipes it.

  New is a separate endpoint from Save (`POST /api/projects/new`, backed by
  **`lib/projects.js`**) because Save happily writes over whatever is already
  there — which is correct for saving and very wrong for New. Creating a project
  that already exists returns 409 rather than silently replacing someone's work.
  Names are validated in one place: a project name becomes a directory name, so
  path separators, leading dots and the Windows reserved names are refused.

  Each timeline layer now has **two** transition buttons, **⇥ in** and **⇤ out**,
  sharing one dropdown builder. In is how the layer enters (applied at the start
  of its clips); out is how it leaves, and on V1 — the only sequential track —
  it is also the join between adjacent clips. The single 2.57.0 `transition`
  migrates to **out**, not to both: copying it into in as well would silently add
  a fade to the head of every existing timeline.

* **2.57.0** — **Per-layer transitions.** Every layer header gains a **⇄**
  button; clicking it opens a dropdown of the standard transitions grouped by
  kind — cross dissolve, dissolve, dip to black, dip to white, wipe
  left/right/up/down, slide left/right/up/down, circle open/close, clock wipe,
  pixelize and blur — plus a duration slider (hidden for a plain cut, since
  there is nothing to time). The button lights up and its tooltip names the
  chosen transition and length.

  The catalogue lives in **`lib/transitions.json`** and is read by
  `lib/transitions.js` (which serves `GET /api/transitions`) and by
  `scripts/transitions.py` (which builds the ffmpeg graph). The dropdown is
  populated from that endpoint rather than from a list written into the page,
  so adding a transition means editing one JSON file — it cannot appear in the
  menu without the renderer knowing how to draw it.

  A transition belongs to the LAYER, applied where that layer's clips meet.
  V1 is the only sequential track, so its transition becomes a true `xfade`
  between adjacent clips, with `acrossfade` on the audio. **Note that xfade
  overlaps its inputs**: joining N clips with a d-second transition produces
  `sum(durations) - (N-1) × d`, so an export gets shorter as transitions get
  longer. The worker logs the before and after lengths so that is visible
  rather than surprising. A transition is also clamped to half the shortest
  clip it joins — longer than that and the overlap runs past the end of the
  clip.

  A cut still takes the plain concat path untouched, so transitions cost
  nothing when nobody asks for one, and any failure (an unprobeable segment, an
  ffmpeg error) falls back to a hard cut with a log line rather than losing the
  render. `transition` is a real property on the layer object and old timelines
  migrate forward; an unknown id degrades to a cut everywhere rather than
  throwing.

* **2.56.0** — **Checkpoint layout detection: S1 vs S2, and folders with both.**
  The 2.55.0 doctor proved its worth immediately and turned up something neither
  the error message nor the folder name revealed: a checkpoint folder named
  `s2-pro` that actually contained an **OpenAudio S1** checkpoint
  (`tokenizer.tiktoken` + `model.pth`), paired with a *newer* fish-speech that
  asks transformers for a HuggingFace tokenizer. New code, old checkpoint —
  nothing repairable, and no amount of re-downloading the same folder would have
  helped.

  **Check checkpoint** now identifies the layout from the **files, never the
  folder name**: `tokenizer.tiktoken`/`model.pth` = S1
  (`fishaudio/openaudio-s1-mini`), `tokenizer.json`/`model-*.safetensors` = S2
  (`fishaudio/s2-pro`). `codec.pth` ships in both, so it is never a marker. A
  folder whose name and contents disagree is called out by name, and the S1/S2
  mismatch message now names the exact repo to download.

  It also detects **two checkpoints unpacked over each other** — the trap
  waiting for anyone who re-downloads on top of a wrong checkpoint. A stacked
  folder *passes* the tokenizer check and then loads the wrong weights, so the
  warning leads the report and suppresses the green tick. Detection requires
  evidence from both sides of the same pair (`tokenizer.tiktoken` **and**
  `tokenizer.json`, or `model.pth` **and** `.safetensors` shards); a lone
  `model.pth` beside a `tokenizer.json` is a plausible fine-tune and is left
  alone, because a warning that cries wolf gets ignored. Warnings are also
  written into the job log during synthesis.

* **2.55.0** — **The `dual_ar` tokenizer trap: diagnosed, and repaired in
  place.** 2.54.1 correctly identified the tokenizer as the source of
  *"'NoneType' object has no attribute 'encode'"* — and then gave the wrong
  advice about it. Its pre-check reported:

  > the tokenizer in …/checkpoints/s2-pro could not be loaded: The checkpoint
  > you are trying to load has model type `dual_ar` but Transformers does not
  > recognize this architecture … Re-download the weights.

  **Re-downloading cannot fix this, and neither can upgrading transformers.**
  OpenAudio checkpoints declare `"model_type": "dual_ar"` in `config.json` —
  fish-speech's own DualAR architecture, which no transformers release
  registers. `AutoTokenizer.from_pretrained()` only consults `config.json`
  when `tokenizer_config.json` does not name a `tokenizer_class`, so a
  **complete, healthy checkpoint** raises that error. fish-speech then keeps
  the failure to itself, leaving `self._tokenizer = None` and the `NoneType`
  error much later.

  The fix is one key. With `"tokenizer_class": "PreTrainedTokenizerFast"`
  present (or `"LlamaTokenizer"` for a sentencepiece `tokenizer.model`),
  transformers resolves the class directly and never reads the model config.

  New **`scripts/openaudio_checkpoint.py`** owns all of this — scan, live load
  test, repair — and is imported by `scripts/tts_local.py` *and* driven by the
  UI through **`lib/openaudio.js`**, so the button and the inference path
  cannot disagree about what is wrong. Synthesis now **repairs the checkpoint
  and carries on** rather than failing.

  In **Settings → Audio**: a **🩺 Check checkpoint** button reports the folder
  contents, `model_type`, tokenizer files and the real verdict; a **🔧 Repair
  tokenizer_config.json** button appears only when there is something safe to
  fix. Inspection *never* writes to a model folder — the repair is a separate,
  explicit action, and it preserves existing keys and backs the original up to
  `tokenizer_config.json.h3bak`. A failed **Test voice** runs the check
  automatically. Endpoints: `GET /api/tts/checkpoint`,
  `POST /api/tts/checkpoint/repair`.

  The diagnosis is equally clear about what it *cannot* fix: a checkpoint
  carrying only `tokenizer.tiktoken` (the S1-era format fish-speech reads with
  its own `FishTokenizer`) alongside a build that asks transformers for a
  HuggingFace tokenizer is a **version mismatch**, and it says so instead of
  blaming the download. Without transformers importable the verdict is
  *untested*, never a false failure.

* **2.54.1** — **Found the actual `NoneType … encode` — it is the tokenizer.**
  2.54.0 guarded the decoder, which was the wrong object: the failure is in
  `fish_speech/tokenizer.py`, where `self._tokenizer` is `None`. That tokenizer
  is loaded with `AutoTokenizer.from_pretrained(<checkpoint folder>)`, so a
  weights download that fetched the `.pth` files but not the tokenizer JSONs
  produces exactly this error, deep inside inference and far from its cause.
  The checkpoint folder is now checked for tokenizer files before anything
  loads, and the tokenizer is test-loaded up front. A folder with weights but no
  tokenizer is reported by name — *"no tokenizer files in …, found […]"* — with
  the fix: re-run **Download weights**, which fetches the whole repo.

* **2.54.0** — **Diagnose "'NoneType' object has no attribute 'encode'".** That
  error comes from fish-speech's `vq_manager`, which calls
  `self.decoder_model.encode(...)` — so the decoder handed to the engine was
  `None`. A loader that *returns* `None` instead of raising slips past every
  earlier check and only fails deep inside inference.
  Every object is now validated at the point it is produced: the llama queue and
  the decoder must be non-`None`, the decoder must actually expose `.encode()`,
  and after construction the engine is checked to have stored both. Each failure
  names the module that produced the bad object and the checkpoint it came from,
  and points at the likely cause — most often a `codec.pth` that did not
  download completely, so re-running **Download weights** is the fix.

* **2.53.1** — **Fix: selecting CUDA 12.4 failed to install anything.** A bug
  introduced in 2.53.0: `pip --index-url` **replaces** PyPI rather than adding to
  it, so bundling `torchcodec` into the CUDA-index command meant that if that
  index did not host torchcodec, the whole command failed — taking torch with
  it. torch and torchaudio now come from the CUDA index, and torchcodec is a
  separate call resolving from PyPI, which picks a build matching torch. If
  torchcodec still cannot be installed it warns rather than aborting the install.
  The CUDA dropdown now defaults to **auto** (matched to your GPU from
  `nvidia-smi`), lists 12.8 first as the RTX 50-series option, and a failed torch
  install names the likely cause instead of a bare error.

* **2.53.0** — **Fix: "torch codec is required", plus a full dependency audit.**
  Recent `torchaudio` delegates audio decoding to **torchcodec**, which nothing
  declares as a dependency — so loading a reference clip fails even on a
  complete-looking install. `torchcodec` is now installed alongside torch from
  the same CUDA index.
  More generally, **Install OpenAudio now audits its own requirements**: the new
  `scripts/check_deps.py` asks the installed distribution what it declares
  (`importlib.metadata`), checks each one resolves, installs anything missing and
  re-checks — so a package that fails to pull a dependency is repaired at install
  time instead of surfacing as a runtime error weeks later. It reports the
  torchaudio/torchcodec pairing explicitly.
  Asking the package rather than hardcoding a list means this keeps working as
  fish-speech's requirements change.

* **2.52.0** — **Fix: "no decoder found" — fish-speech was installed without
  most of itself.** Its `pyproject.toml` sets
  `packages = ["fish_speech", "tools"]` as an **explicit list**, not
  `find_packages`, so `pip install git+…` ships only those two top-level
  packages and silently omits every subpackage — including
  `fish_speech.models.dac` (the decoder) and
  `fish_speech.models.text2semantic` (the worker). The install succeeds and the
  modules simply are not there.
  **Install OpenAudio** now clones the repo and installs it **editable**
  (`pip install -e`), which is what upstream's own docs do and keeps the whole
  tree importable. The post-install check imports the **subpackages**, since
  importing bare `fish_speech` proves nothing.
  Import failures are also no longer swallowed: a miss now reports which modules
  were tried and what each one raised, plus the `packages=[…]` explanation —
  instead of a bare "no decoder found".

* **2.51.0** — **Fix: RTX 50-series got CUDA 12.4 wheels, which contain no
  kernels for it.** The *"compile with `TORCH_USE_CUDA_DSA`"* line is boilerplate
  PyTorch appends to **every** CUDA failure — the real error above it is
  *"no kernel image is available for execution on the device"*, and recompiling
  torch is not the fix.
  An RTX 5090 is compute capability **12.0 (sm_120)**, which needs **CUDA 12.8**
  wheels; 2.50.0 defaulted to 12.4. The installer now reads the card's compute
  capability from `nvidia-smi` and picks 12.8 for sm_120 and above.
  It also **runs a real kernel** to verify, instead of trusting
  `torch.cuda.is_available()` — which returns **True** in exactly this state and
  is why 2.50.0's check passed while nothing could actually run. The same check
  runs before synthesis, naming the card, its `sm_` level, the real CUDA error
  and the fix — and pointing out that the `TORCH_USE_CUDA_DSA` line is noise.

* **2.50.0** — **Fix: "Torch not compiled with CUDA enabled".** Plain
  `pip install torch` serves the **CPU-only** wheel on Windows, so the venv
  installed cleanly and then could not use the GPU at all.
  **Install OpenAudio** now installs torch from a CUDA wheel index by default
  (CUDA 12.4, selectable in Settings → Audio), and — because installing
  fish-speech can pull a CPU torch back over the top — it **verifies afterwards**
  that `torch.cuda.is_available()`, repairing with a forced reinstall and failing
  loudly with the driver-version hint if it still cannot see the GPU.
  At run time, a CPU-only torch on a CUDA device is now reported as exactly
  that — *"this venv has a CPU-only build of torch (2.5.1+cpu, cuda build None)"*
  — naming both fixes, instead of surfacing as a bare torch assertion.

* **2.49.0** — **Live progress for speech, so a slow load is not a mystery.**
  `tts_local.py` printed nothing until it finished, so five minutes of model
  loading looked exactly like a hang. It now reports each stage — importing
  torch, loading the text2semantic model (*the slow one*), loading the codec,
  synthesizing — and the UI polls `GET /api/tts/progress` to show the current
  stage with elapsed seconds, in Settings and next to the Generate button.
  Also: **a timeout now tells you why.** fish-speech's
  `launch_thread_safe_queue` calls `init_event.wait()` with **no timeout**, so
  if the model load throws inside its worker thread the event is never set and
  the process waits forever — the traceback on stderr being the only evidence.
  A timed-out run now reports the last output it saw (`gave up after 900s.
  Last output: … RuntimeError: CUDA out of memory`) instead of a bare timeout.

* **2.48.2** — **Verified against the fish-speech source.** Cloned
  `github.com/fishaudio/fish-speech` and checked the wiring line by line rather
  than trusting the reconstruction. Everything matched: the engine really is
  `TTSInferenceEngine(llama_queue, decoder_model, precision, compile)`, built
  from `launch_thread_safe_queue(checkpoint_path, device, precision, compile)`
  and `load_model(config_name, checkpoint_path, device)`; the decoder config is
  `modded_dac_vq`, its checkpoint is `codec.pth` inside the folder, `bfloat16`
  is the default precision, `ServeReferenceAudio` is `(audio: bytes, text: str)`,
  and `inference()` yields the **concatenated** audio on its `final` result —
  so taking the last chunk is right.
  One thing worth changing: upstream now defaults to **s2-pro**, not
  `openaudio-s1-mini`. Settings → Audio gains a **Model** picker for the two
  published checkpoints (or *custom…*), which sets both the folder and the
  HuggingFace repo the downloader pulls from.

* **2.48.1** — **Fix: "missing 2 required positional arguments: 'llama_queue'
  and 'decoder_model'".** The reported error named the real signature, and it is
  not what the previous version assumed. `TTSInferenceEngine` takes **no
  checkpoint paths at all** — it takes an already-constructed llama queue and
  decoder model, which have to be built first:
  `launch_thread_safe_queue(...)` for the text→semantic worker and
  `load_model(...)` for the codec, then the engine over both.
  That wiring is now done properly, across both layouts: OpenAudio S1
  (`fish_speech.models.{text2semantic,dac}.inference`, config `modded_dac_vq`)
  and older fish-speech 1.4/1.5 (`tools.llama.generate` + `tools.vqgan.inference`,
  config `firefly_gan_vq`), with the decoder checkpoint located by trying
  `codec.pth`, the firefly generator, then any `.pth` in the folder.
  New `scripts/test-tts-engine.py` runs the helper against mock modules for both
  layouts and asserts a wav actually comes out — verified against a deliberately
  reverted implementation, where it reproduces the exact reported error.

* **2.48.0** — **Fix: Speech failed with "unexpected argument", and the
  OpenAudio weights were never downloaded.** Two separate problems, both real.
  **The weights.** OpenAudio's pip package is **code only** — the model is a
  separate HuggingFace repo that nothing ever fetched, so the venv looked
  correctly installed and synthesis had no model to load. **Install OpenAudio**
  now downloads it (using your HuggingFace token for gated repos), and there is
  a **⬇ Download weights** button to fetch it on its own. A missing or empty
  checkpoint folder is now diagnosed by name instead of surfacing as an
  engine error.
  **The argument.** fish-speech has renamed its engine constructor across
  releases (`llama_checkpoint_path` / `checkpoint_path` / `llama_path`,
  `compile` / `compile_model`), so a fixed call dies on whichever build you
  have. The helper now inspects the signature and passes only what that build
  accepts, tries every known class location, and — if all fail — reports each
  attempt with its arguments rather than one opaque line.
  **New: Test speech** under the voice clones — a text box, a voice picker and
  **▶ Test voice**. It speaks one line and discards it, so you can prove the
  pipeline works without adding anything to your Sound assets.

* **2.47.0** — **Speech from the prompt, a voice picker, and previewable
  references.** A **Voice** dropdown now sits beside the LLM selector, listing
  your saved clones, and a **🗣 Speech** button under Generate speaks whatever is
  in the prompt box in that voice. The wav is written into the project's Sound
  assets — which is what makes it appear in the asset tray — and is added
  straight to the **audio references**, since a spoken line is almost always
  wanted there next. The Sound tab is revealed so you can see it arrive.
  Both voice pickers (this one and the Sound pane's) are filled from one place,
  so they cannot drift apart.
  Every reference — video and audio — now has a **▶ preview**. Video plays in a
  small corner window; audio plays invisibly. One shared player means starting a
  preview always stops the previous one, and clicking the playing item stops it,
  rather than leaving several clips overlapping.

* **2.46.1** — **Fix: the CPU fallback never fired for the error it was written
  for.** 2.46.0 guarded only `WhisperModel(...)`, but CTranslate2 loads cuBLAS
  **lazily** — the DLL error usually surfaces later, at `transcribe()` or while
  draining the generator it returns (which does no work until consumed). So the
  failure landed outside the retry and came back as
  *"transcription failed: Library cublas64_12.dll…"* — exactly as reported.
  Model load, transcription and generator iteration now happen inside **one**
  attempt, so a GPU failure at any of the three retries on CPU.
  The test suite was the real problem: it faked a constructor failure only, so
  it passed while real transcription failed. It now injects the error at all
  three points and is verified against a deliberately broken fallback (10 of the
  11 checks fail without the fix).

* **2.46.0** — **Fix: "Library cublas64_12.dll is not found or cannot be
  loaded".** faster-whisper runs on CTranslate2, which links cuBLAS and cuDNN
  **at load time but does not depend on them via pip** — so the install
  genuinely succeeds and the first GPU transcription then dies looking for a DLL
  that was never fetched.
  Fixed at both ends. **Install faster-whisper** now also installs
  `nvidia-cublas-cu12` and `nvidia-cudnn-cu12` (~600 MB extra, skipped when
  Device is set to `cpu`), and `scripts/asr_local.py` adds
  `site-packages/nvidia/*/bin` to the DLL search path before importing — those
  wheels put their DLLs somewhere that is not on `PATH`, which is the other half
  of the problem.
  If the CUDA libraries are still missing, transcription now **falls back to CPU
  and tells you**, rather than failing: you get the transcript, the dialog shows
  *"⚠ ran on CPU — GPU libraries missing"*, and the log names the exact pip
  command. Setting Device to `cpu` skips the GPU attempt entirely.

* **2.45.1** — **Fix: Electron installed but the app still opened in the
  browser.** `npm install electron` fetches only a small shim — the ~150 MB
  runtime is downloaded by the package's own `install.js`, and current Electron
  releases ship **no postinstall script at all**, so npm "succeeds" in a couple
  of seconds having downloaded nothing and `dist\electron.exe` is never
  created. `start.bat` then found no binary and fell through to the browser.
  `get-electron.ps1` now runs `install.js` itself when the runtime is missing
  instead of trusting npm's exit code, and reports a proxy/GitHub-blocked
  failure explicitly. Detection no longer hardcodes `dist\electron.exe` either:
  `start.bat` asks node via `require("electron")`, which reads the package's own
  `path.txt` and does not change between releases.

* **2.45.0** — **Optional frameless app shell (Electron).** `start.bat` now
  installs Electron on first run (~150 MB, once) and opens bitGen Studio as a
  **frameless window with a custom Windows 11 title bar** — icon, app name,
  and 46px caption buttons with the red close hover — instead of a browser tab.
  Set `H3_NO_SHELL=1` to force the browser.
  The shell is genuinely optional and nothing depends on it: `electron/main.js`
  spawns the same `server.js`, reuses a server already listening on 8311 rather
  than fighting for the port, and every failure path falls back to the browser.
  Electron installs with `--no-save`, so it stays out of `package.json` and the
  server's own dependency install is unaffected. The title bar is hidden in a
  normal browser, which already draws one.
  `contextIsolation` stays on — the page gets three functions from the preload,
  not `require` — and external links open in the real browser rather than
  inside a chromeless window with no address bar.

* **2.44.1** — **Fix: Choose file in the voice cloner did nothing.** The
  **Save voice clone** button lost its click handler in 2.41.0, when the Audio
  settings JavaScript was rewritten wholesale — so picking a file showed its
  name and then nothing happened, because nothing was listening. Restored, and
  every button in the app is now checked for a handler.
  Choosing a file also **loads it into the waveform** now, so the region picker
  works for files that are not project assets: **Save voice clone** saves the
  whole file, **Save selection as voice** saves just the dragged region (cut
  server-side by ffmpeg in the same pass as the transcode), and **⌶ Transcribe**
  works on a browser-only file via the new `POST /api/asr/transcribe-upload`.
  If the browser cannot decode the container, the waveform is skipped with an
  explanation and saving still works — ffmpeg reads far more than the browser.

* **2.44.0** — **Installer progress, m4a references, transcribe-the-reference,
  and no more sd-cli prompt at startup.**
  `start.bat` no longer stops to ask whether to download stable-diffusion.cpp —
  it prints a one-line note and carries on, since ComfyUI mode does not need it.
  **Install progress:** the OpenAudio / faster-whisper installers now report
  numbered stages (`step 2/4: upgrading pip`), run pip unbuffered with progress
  bars off, and say plainly when a step is slow and quiet. Two failures that
  previously looked like "nothing happens" are now named outright: **fish-speech
  installs from GitHub and needs `git` on PATH**, and a venv that cannot be
  created because the configured python is the Microsoft Store stub.
  **m4a:** a voice-clone reference in any format is transcoded to real PCM with
  ffmpeg. It used to be written straight to `<name>.wav`, so an m4a became a
  file claiming to be a wav and was not — anything trusting the extension then
  read garbage. Non-audio files are now rejected with a clear message.
  **⌶ Transcribe** next to the voice-clone transcript fills in what the
  reference says, from the waveform selection or a saved voice.

* **2.43.0** — **LLM: auto-select on startup, and Start/Stop in Settings.** The
  model folder was already scanned at boot, but nothing was ever *selected*, so
  a fresh install had an empty dropdown and Enhance refused with "pick an LLM".
  Startup now selects the running model, or the first `.gguf` on disk, and
  remembers it.
  Settings → LLM gains a **model picker**, **▶ Start server**, **■ Stop server**
  and **↻ Rescan folder**, with a live line showing what is being served
  (`POST /api/llm/start`, `POST /api/llm/stop`).
  **Enhance** already started the server itself via `ensureLlama`; it now also
  falls back to the only model on disk when nothing is picked, rather than
  refusing, and the button distinguishes *"Starting the LLM server…"* (minutes)
  from *"Working…"* (seconds) so a first-use model load doesn't look like a
  hang. With no models at all, the error says where to put one.

* **2.42.0** — **HuggingFace token in Settings → General.** A token field with a
  **Test token** button that validates against `huggingface.co/api/whoami-v2`
  and reports who you are signed in as.
  The token was not merely missing from the UI — nothing used one at all, so
  gated and private repos failed the download with an unexplained error. It is
  now passed to both download paths in the worker: as `token=` to
  `hf_hub_download`, and as an `Authorization: Bearer` header on the raw
  streaming fallback, with a log line confirming it was used.
  The server never echoes the token back in full — `GET /api/hf` reports only
  whether one is set plus its last four characters. A **403** is reported as
  *either* a token lacking read access *or* something on the network blocking
  the request, since a corporate proxy looks identical to a permissions problem.

* **2.41.0** — **Local-only audio: install buttons and a waveform clip
  selector.** Settings → Audio now installs and runs both tools **locally** —
  **Install OpenAudio** and **Install faster-whisper** each build their own
  Python venv (`venvs/openaudio`, `venvs/whisper`) as a worker job you can watch
  in the console. All HTTP/API-key configuration is gone: synthesis and
  transcription run as subprocesses in those venvs via `scripts/tts_local.py`
  and `scripts/asr_local.py`, so nothing leaves the machine.
  The venvs are deliberately **separate**: fish-speech and faster-whisper pin
  conflicting torch versions, and one shared venv would break both whenever
  either upgraded.
  **Voice cloning from a region:** load any project sound or video clip, see its
  waveform, drag to select the part to clone from, preview the selection, and
  save it. The cut is done server-side with ffmpeg so the reference is never a
  re-encode of a browser re-encode. faster-whisper also returns **per-word
  timestamps** now, which is what word-level karaoke highlighting needs.

* **2.40.0** — **Karaoke lyrics layer.** The music-video dialog gains **♪ Add
  lyrics** with three styles (karaoke, subtitle, big/centred). Pick a finished
  render and it builds an ASS subtitle from the song's own words and queues a
  worker job to burn it in.
  ASS rather than SRT because SRT has no styling and no karaoke: ASS carries the
  `\k` tags that sweep the highlight across a line as it is sung. When the
  Whisper server returned per-word timestamps each word gets its own `\k`, so
  the highlight tracks the singer; otherwise the line highlights over its own
  duration, which still reads as karaoke and never mistimes.
  A saved `.lrc` is reused when there is one, so re-burning in a different style
  costs no transcription. New: `POST /api/lyrics/burn`, `lib/lyrics.js`, and a
  `lyrics` worker mode — kept separate from `export` so lyrics can be added to
  any existing render without recompiling the timeline.

* **2.39.0** — **Quick prompt: a song in, a timed shot list out.** The
  music-video dialog gains **⚡ Quick prompt**. Pick a sound or video asset, and
  it transcribes the track, parks the words in `songs/<song>.tmp`, groups the
  lyric lines into shot windows and has the LLM write one visual prompt per
  shot — filling the shot list ready to render. The LLM is loaded on demand if
  it isn't already running.
  Shot boundaries are taken from the **transcript**, not a fixed grid: every
  window starts and ends on a real lyric line from the audio, so the cuts fall
  where the singer changes rather than every N seconds. Windows aim for the
  dialog's shot length but never split a line. Models wrap JSON in prose or code
  fences however firmly you ask them not to, so the reply is parsed
  defensively — first array wins, with a line-by-line fallback — and a short
  reply reuses the last prompt rather than leaving shots empty.
  New: `POST /api/quickprompt`, `lib/quickPrompt.js`.

* **2.38.0** — **Speech to text and lyric extraction.** Hover any sound *or
  video* asset in the tray for two new buttons: **⌶** transcribes speech, **♪**
  extracts timed lyrics. Video is demuxed to 16&nbsp;kHz mono automatically —
  handing a Whisper build an mp4 is the usual cause of an opaque 400 — so a
  render or a song transcribes straight from the tray with no preparation.
  Results open in a dialog with per-line timestamps and are written into the
  project's `transcripts/` folder: `.txt` and `.srt` always, plus a karaoke
  `.lrc` in lyrics mode. Those timed lines are exactly the input the music-video
  pipeline wants for cutting shots to a song.
  Configured in **Settings → Audio** alongside the OpenAudio settings: any
  Whisper server exposing the OpenAI-compatible
  `/v1/audio/transcriptions` (whisper.cpp `server`, faster-whisper-server,
  Speaches, LM Studio). Lyrics mode pins temperature to 0 and disables
  `condition_on_previous_text`, because Whisper's defaults aggressively collapse
  repeated chorus lines.

* **2.37.0** — **OpenAudio TTS + voice cloning (Settings → Audio).** A new
  **Audio** settings tab configures an OpenAudio / fish-speech server and holds
  your saved **voice clones** (a reference clip plus its exact transcript —
  cloning conditions on the pair, so the transcript is not optional if you want
  it to sound right; 10–30s of clean speech is the sweet spot, and short clips
  are flagged). The Sound asset tray gains a **Text to speech** composer: type a
  line, pick a voice, hit Speak. The result is written into the project's Sound
  folder as a WAV, so it is immediately draggable onto an audio layer **or**
  into the audio-reference tray for ref2va.
  The same OpenAudio model answers on genuinely different request shapes
  depending on how it is served, so the **dialect** is configurable —
  `openaudio` (local `tools.api_server`), `openai` (SGLang/LiteLLM-style
  wrappers) or `fishaudio` (hosted, Bearer key). A 404 on synthesis says so
  explicitly rather than failing opaquely.
  **Fix found on the way:** `POST /api/config` merges an explicit allow-list of
  sections, so any new top-level config section saves silently and reads back as
  the defaults. `tts` is now listed — the same trap that once ate
  `engine.comfy.workflows`.

* **2.36.0** — **Fix: preview really does play every layer now, plus marker
  follow and click-to-pause.**
  The remaining cause of playback stopping at the end of the base track was a
  leftover from the 2.29.0 layer refactor: `pvTick`'s audio loop still did
  `for (const ac of track)` where `track` is now a layer **object**, so any
  timeline with an audio layer threw "not iterable" on the very first tick.
  Like the previous case, the throw happened inside the
  `requestAnimationFrame` callback and killed the loop with nothing shown to
  the user. `pvTick` is now wrapped: a tick that throws is logged to the
  console and the loop **survives**, giving up only after sustained failure —
  so a future slip here degrades instead of freezing.
  The red position marker now **rides along with playback** and the orange
  duplicate stays parked where the preview started; double-click it to send the
  marker back there. **Clicking the marker pauses / resumes**, while dragging it
  still scrubs (and re-seeks a running preview).

* **2.35.1** — **Fix: preview stopped at the end of the base video track.**
  A regression introduced in 2.35.0. Letting playback continue past the last V1
  clip meant `next` could legitimately be `undefined`, but the following line
  still read `next.start` — the resulting TypeError was thrown inside the
  `requestAnimationFrame` callback, which killed the tick loop outright. Nothing
  appeared in the UI: the preview simply froze at the end of V1 and never
  reached the V2+ overlay, audio or image layers. The dereference is now
  guarded.

* **2.35.0** — **Draggable position marker and a separate playback cursor.**
  With no range selected, the red position marker now has a grab tab on its
  head: drag it anywhere on the timeline (snapped to whole frames, scrubbing
  the preview as it goes). While a selection is up the marker is locked, since
  the in/out handles own that gesture there.
  **Preview** with no selection now plays from the position marker to the last
  frame on **any** layer — it used to stop when the video track ran out, cutting
  off audio or image layers that ran longer.
  During playback the red marker **stays where you parked it** and an orange
  **playback cursor** tracks the play position, so a preview no longer moves
  your anchor. **Double-click the playback cursor** to bring the position
  marker to that point. The cursor is removed on stop.

* **2.34.0** — **Basic Settings dropdown + UI size in Settings.** The left
  dock's **Generate** section is now **Basic Settings**, a collapsible section:
  click the header to fold away the mode buttons, resolution/aspect/seconds,
  steps/seed/format and segment length, leaving System and Queue in view. The
  open/closed state is remembered.
  Settings gains a **General** tab (first, and the one the dialog opens on)
  carrying a **UI size** slider with a Reset button. It and the slider in the
  bottom-left corner of the dock drive the same setter, so moving either
  updates the other and neither can drift out of step.

* **2.33.0** — **Resolution / Aspect / Seconds share the dock width evenly.**
  `.grid3` and `.grid2` used plain `1fr`, which is `minmax(auto, 1fr)` — and a
  `<select>` will not shrink below its longest option, so *Resolution*
  ("1080p", "Custom…") claimed more than its third and could push the row past
  the dock edge. Both grids now use `repeat(n, minmax(0, 1fr))` with
  `min-width: 0` on their children, so all three columns are exactly equal
  whatever the option text says.
  The line under **Seconds** now reads just `<n>f`. The full plan — chunk
  layout, trim, pipeline — moved to the tooltip, and an over-ceiling warning
  still shows inline as `<n>f ⚠` in red rather than being hidden.

* **2.32.1** — **GPU temp and VRAM read as real graphs.** They were already
  canvas line charts, but at 26px under a load bar they read as strips. Inside
  a GPU frame the history canvases are now 62px tall, with quarter gridlines
  behind the trace. `Spark` also takes an optional plot domain: GPU temp is
  drawn over **20–100°C** instead of 0–100, since a card that idles at 40°C and
  peaks at 85°C was tracing a nearly flat line pinned to the top of a 0-based
  axis. Each chart labels its own range (`Temp 20-100°C`, `VRAM 0-100%`).

* **2.32.0** — **Per-GPU stat frames.** Each GPU now has its own bordered frame
  in the stats panel, titled with the card name and carrying a one-line summary
  (`87% · 71°C · 20.5GB`) in its header. Inside, **load**, **temp** and **VRAM**
  stack one below the other at full width instead of sharing a two-column grid
  with the other card's readouts. Load is a **bar** rather than a sparkline —
  it is an instantaneous level, not a trend you read shape from — while temp
  and VRAM keep their history graphs in distinct colours (temp red, VRAM blue)
  so two charts sitting one above the other are never confused for each other.
  `Spark` takes an optional colour, and the new `Bar` carries a no-op `draw()`
  so it stays safe inside the shared redraw pass.

* **2.31.0** — **Generate starts ComfyUI for you, and ComfyUI survives the
  studio closing.** Pressing Generate (or Render in the music-video dialog)
  now checks whether ComfyUI is answering; if it isn't, the studio launches it,
  streams the startup output into the console, waits for the API (up to five
  minutes) and then submits the job. If ComfyUI dies during startup or never
  comes up you get told, and nothing is queued. New endpoint:
  `POST /api/comfy/ensure`.
  ComfyUI is now **left running when bitGen Studio exits** — closing the studio's
  console window fires `SIGHUP`, which previously ran the shutdown sweep and
  took ComfyUI down with it, so every restart paid the full model-load cost
  again. Controlled by *Leave ComfyUI running when bitGen Studio closes* in
  Settings → ComfyUI (`engine.comfy.keep_alive`, on by default). Turn it off
  for the old behaviour; the explicit **Stop** button always works either way.

* **2.30.0** — **Pipeline controls moved into Settings → ComfyUI.** Pipeline
  (Auto / Single / Chunked / PNG rebuild), *exact trim*, *force split*,
  *Speed* and *Extra sd-cli args* now live under Settings → ComfyUI instead of
  the side dock. The element IDs are unchanged, so the plan readout beside
  Generate still updates the moment you change them, and every value is still
  read per job at Generate time — they are per-job settings that happen to be
  parked in the Settings dialog, not persisted defaults. **Max seconds per
  segment** stayed in the side dock, next to the duration it divides.

* **2.29.0** — **Timeline layers with their own headers.** Every track now has an
  identical fixed-width header (`--labw`, mirrored by `LABW` in the UI script)
  holding, in the same order on every row: a reorder grip, an editable layer
  name, visibility, isolate/solo, opacity, volume and remove. Opacity and
  volume open a slider popover. Visibility drops the layer from both the
  preview and the export; isolate shows only soloed layers and forces the
  filmstrip on regardless of zoom. Layer names are click-to-edit, and dragging
  a header up or down reorders the stack — **which is now what sets render
  order**.
  Marker behaviour: dragging the IN marker scrubs the preview to the frame it
  lands on (one seek in flight, since the `<video>` drops seeks issued while
  already seeking); Preview plays from the IN marker and stops on the OUT
  marker; double-clicking the OUT marker sends it to the end of the scene, and
  double-clicking the IN marker sends it to the middle of the visible timeline.
  **Fixes:** layers were bare arrays with properties hung off them
  (`Object.assign([clip], {muted:false})`), but `JSON.stringify` drops an
  array's own properties — so layer mute never survived a save or reload.
  Layers are now real objects (`{name, clips, opacity, volume, visible, solo,
  muted}`) with a migration for both old shapes. Overlay clips were composited
  in *start-time* order, so an earlier-starting clip always drew underneath a
  later one and the timeline's own stacking was ignored; draw order now
  follows layer order. Exports also log their composite plan
  (`composite z1 'Back': opacity=… volume=… muted=…`, `overlay draw order
  (back to front): …`) — the export ffmpeg command is not echoed, so there was
  previously no way to tell from a job log which layer ended up on top.

* **2.28.0** — **Native fl2va (first/last frame) workflow wired in.** Tim's
  Export (API) of the official MiniMax H3 I2V graph now ships as
  `comfy_workflows/fl2va.json` — the path `engine.comfy.workflows.fl2va`
  already pointed at, which until now did not exist, so fl2va in Comfy mode
  hard-failed with "workflow not found". The template carries two `LoadImage`
  nodes: `114` feeding `first_frame` and a new `116` feeding `last_frame`.
  **Select a last image and the `last_frame` slot is wired; leave it empty and
  the slot is bypassed** — the unused loader is pruned and the gen node's
  `last_frame` key is dropped, so the graph goes out as a plain first-frame
  render. Both decisions are reported in the job console
  (`[comfy] last_frame: wired from loader 116` / `bypassed (no image
  supplied)`).
  Image loaders were previously assigned in node-id order, which put the right
  frame in the right slot only by luck: an export whose last-frame loader
  happened to carry the lower id would have silently swapped the keyframes.
  The new `_frame_slot_loaders()` follows the `first_frame`/`last_frame` links
  back to their loaders (hopping intermediate image nodes), so assignment no
  longer depends on how ComfyUI numbered the nodes on export.

* **2.27.0** — **Timeline range selection, frame inspector and layer
  Keep/Cut.** Drag across the ruler (or shift+drag over the tracks) to mark a
  time range; `⟦ In` / `Out ⟧` set the edges from the playhead and `＋1s`
  grabs exactly one second. Every edge snaps to a whole frame at 24 fps.
  Click any track label (V1, V2, A1, I1 …) to highlight the layer the edit
  will apply to, then `⇥ Keep` (keep the selection, trim everything else on
  that layer away) or `✂ Cut` (remove the selection, splitting clips that
  span it), with an optional ripple that closes the gap. The maths lives in
  the new `lib/timelineEdit.js` behind `POST /api/timeline/edit`, so the UI
  and the unit tests share one implementation.
  `▦ Frames` opens the frame inspector: every frame between the two markers,
  so a 1 s selection is exactly its 24 frames. Extraction is a single ffmpeg
  `fps=` pass in the new `lib/frames.js` (`GET /api/frames`, served from
  `GET /framecache/:key/:file`) with a disk cache and LRU pruning — the old
  approach of seeking a hidden `<video>` once per thumbnail was both slow and
  only keyframe-accurate. Each frame tile parks the playhead, snaps either
  selection edge to that exact frame, or becomes the First/Last/reference
  image using the real extracted JPEG.
  **Fixes:** the ✕ on a timeline clip was mostly unclickable — `.clip .cx`
  had no `z-index` while the right trim handle `.h.r` sits at `z-index: 2`
  over the same corner, so only a sliver of the button responded, and the
  clip's own drag handler could swallow the press. Every ✕ (clips, sounds,
  images, marker chips) now routes through one `wireRemove()` with a real
  16 px target above the handles. Emptied V2+ overlay layers are dropped
  automatically. `Clear` rebuilt `tl` without the `vlayers` key, so the next
  `vLayerClips()` threw on `undefined.flat()` and left the timeline dead
  until a reload. The e2e script built `/tmp/e2e_ref1.png` ~240 lines *after*
  the music-video mode test that uploads it, so that upload silently failed
  and every "ref" shot was downgraded to "cont"; the fixtures are now created
  up front and a failed upload is reported instead of ignored.

* **2.26.0** — **Timeline layers.** Dropping a clip on the timeline now
  creates its own layer instead of being appended to whatever was last used:
  video goes to a new V-layer (V1 is used only while empty), sound to a new
  A-layer, images to a new I-layer — so an arrangement you already built is
  never disturbed. Extra video layers (V2+) render as overlays above the base
  track, each with its own opacity (double-click a clip), trim handles,
  drag-to-move, mute and a remove-layer button. **Preview plays every layer
  together** — stacked video elements for V2+, the audio layers and the image
  overlays all follow the playhead, and it now runs even when the base track
  is empty. Export composites the same way: layer clips are overlaid at their
  start time with their opacity, and their audio joins the mix unless the
  layer is muted. Suites: e2e 88/88, patcher 43/43.

* **2.25.0** — **Anything that fits one generation is never segmented.**
  Previously the Segment-seconds field split a clip even when the whole thing
  fitted a single run — so a 15 s clip with 5 s segments became three chunks
  with two seams and needless identity drift, when both engines render 15 s
  in one pass (361 frames on sd-cli, 362 on ComfyUI's native nodes). The
  planner now collapses to a single run whenever the target fits the ceiling,
  in the worker, the API and the UI readout alike, whatever the pipeline and
  segment length say. Deliberate splitting is still available for tight VRAM
  via a new **force split** checkbox beside *exact trim*
  (`force_chunks`). Also fixed: references were uploaded sorted by subject
  number, which scrambled `<Picture n>` mapping once subjects repeat — they
  now go in slot order, matching the tags. Suites: e2e 84/84, patcher 43/43.

* **2.24.0** — **Gallery fix: exports in `final/` were invisible.** A finished
  job lands in one of two folders — renders in `projects/<p>/output`, timeline
  exports in `projects/<p>/final` — but the gallery, the timeline picker and
  the `/outputs/<name>` route only ever looked in `output`, so anything
  exported never appeared and couldn't be played. All three now read both
  (newest first, `final/` clips marked with ★), delete removes the file from
  whichever folder holds it, and `/api/outputs/where` reports both paths with
  a file count each — the empty-gallery message lists them, so a mismatch is
  visible. Thumbnails also gained an error fallback: a clip the browser can't
  decode (AVI/mpeg4 is the usual one) now shows a clickable "no preview" tile
  naming the format instead of a silent black square, and thumbnail URLs are
  cache-busted by modification time so a re-rendered file refreshes.
  `.mkv`/`.mov` are listed too. Suites: e2e 80/80, patcher 43/43.

* **2.23.1** — Seconds input sized to 4 characters (spinner arrows hidden so
  the box is genuinely 4 wide); the plan readout beside it is unchanged.

* **2.23.0** — **Per-shot mode in the music video: consistency over
  continuity.** Every shot now chooses how it starts — a **fresh reference
  shot** (ref2va, re-anchored to a saved reference group), a **continuation**
  of the previous shot (fl2va hand-off), or **text only** — and each shot can
  point at its own reference group, so a chorus can cut back to the singer's
  reference set while a verse follows the camera. New shots default to
  *fresh reference shot*, since a music video needs the character to look
  the same across cuts more than it needs motion to flow through them.
  Shot-list lines take tokens before the prompt:
  `12s | ref:bandMembers | close on the singer`, with `ref`, `cont` and
  `t2va` available and everything optional. The plan readout shows the mix
  (e.g. "3 reference, 1 continuation"). Timing is unaffected — mixed-mode
  cuts stay frame-exact. Suites: e2e 76/76, patcher 43/43.

* **2.22.0** — **Music video pipeline** (🎵 button next to Generate). Pick a
  song from the project's Sound assets and the app cuts it into shots on the
  frame grid — 15 s each by default, so 0–15, 15–30, … with the remainder as
  a final shorter shot — then renders one shot per segment, each with its own
  prompt, chained by the usual last-frame hand-off and seam-dropped join, and
  muxes the song over the finished cut. Because every shot keeps an exact
  frame count at 24 fps, boundaries land on the song timestamps they should
  with zero drift. Up to **5 minutes** (the frame ceiling rose from 4). Shot
  lengths are per-line editable (`12s | close on the singer`) so cuts can
  follow the song's sections rather than a fixed grid, an optional saved
  reference group supplies character images, and `Start in song` offsets
  which part of the track is used. New endpoints
  `GET /api/musicvideo/plan` and `POST /api/musicvideo`; planner shared with
  the UI via `planShots`/`splitSong` in `lib/framePlan.js`. Suites: e2e
  73/73, patcher 43/43.

* **2.21.0** — **4-step LoRA toggle + saved reference groups.**
  Settings → ComfyUI gained a **4-step turbo LoRA** checkbox
  (`engine.comfy.lora_4step`). Off (the default) every `LoraLoader` is
  bypassed as before; on, the workflow's LoRA node is kept **and** its enable
  switch is flipped, so the model actually routes through it. Set Steps to 4
  to get the speedup — and be aware quality can drop a lot, which is why it's
  off by default.
  The references dock gained a **group bar**: a dropdown of the reference
  groups saved in the current project, `+` to start a fresh group (clears the
  dock, with a confirm), `💾` to save the current references under a name
  (dialog defaults to `refGrp-<n>`, first unused), and `✕` to delete a group.
  A group stores the images with their subject number and aspect plus the
  video and sound selections; images are copied into the project's assets on
  save so a group reloads later. Groups live in
  `projects/<project>/refgroups.json` and are per project. New endpoints:
  `GET/POST /api/refgroups`, `DELETE /api/refgroups/<name>`. Suites: e2e
  66/66, patcher 43/43.

* **2.20.0** — **Comfy Kitchen capability check** (Settings → ComfyUI).
  Comfy Kitchen is a kernel library that runs inside *ComfyUI's* Python, not
  bitGen Studio's, and it only accelerates weights already in FP8, NVFP4 or
  MXFP8 — FP8 needs an Ada card (SM 8.9), NVFP4/MXFP8 need Blackwell (SM
  10.0), plus CUDA 13 and driver r580+. The MiniMax H3 `int8_convrot`
  checkpoints are **none of those formats**, so for most rigs this is not a
  speedup for H3 renders; the `nvfp4_awq` text encoder is the one piece that
  qualifies. Rather than guess, the panel probes ComfyUI's interpreter
  (portable `python_embeded`, a `venv`/`.venv`, or your configured python)
  for `comfy-kitchen` and torch, reads each GPU's compute capability, and
  reports plainly what your hardware can and can't use. Install is offered
  only on capable cards, runs `pip install` into ComfyUI's environment with
  a confirmation, and streams pip output into the app console
  (`pip uninstall comfy-kitchen` to undo). New endpoints
  `GET /api/comfy/accel` and `POST /api/comfy/accel/install`; all logic in
  `lib/comfy.js`. Suites: e2e 60/60, patcher 43/43.

* **2.19.0** — **All 9 subject numbers, always.** The subject dropdown on
  every reference slot now offers 1–9 outright, so the `+` unlock button is
  gone. A subject is whatever you say it is — a person, a second face, a
  prop, a location — and numbers already in use are marked with a dot in the
  list, so reusing one to add another aspect of the same character stays a
  deliberate choice. A newly added picture takes the first *unused* number,
  so nine distinct subjects fill in naturally and grouping is opt-in.

* **2.18.0** — **One subject can now span several reference pictures.**
  Picture numbers follow slot order and the subject number is chosen per
  image and may repeat, so `<subject 1>` can be described by a face shot, a
  full-body shot and a clothing shot at once. The auto-mapping reflects it:
  `<subject 1> face is in <Picture 1>` / `<subject 1> clothing is in
  <Picture 2>`, and the header reports how many subjects across how many
  pictures. Picking a subject number no longer swaps it away from another
  slot, slots are never reshuffled (which would silently invalidate
  `<Picture n>` tags already typed into the prompt), and the aspect list
  gained hair, outfit detail, pose, expression, object and style. Clicking a
  thumbnail inserts its `<subject n>` tag; clicking the badge inserts
  `<Picture n>`. The Enhance endpoint builds the same picture-indexed
  mapping and tells the model that a repeated subject is one character.
  **Layout fix:** the plan readout moved out of the Seconds label into its
  own fixed-height line under the input — it used to wrap to two lines and
  shove the controls grid around; long text now truncates with the full
  readout on hover. Suites: e2e 56/56, patcher 43/43.

* **2.17.0** — **Fix: gallery and timeline showing no videos.** The current
  project lived only in memory, so every app restart silently reset the
  server to `default` while your renders sat in
  `projects\<your project>\output` — the gallery and the timeline then read
  an empty folder. The open project is now saved to `config.json`
  (`current_project`) and restored on boot. `/api/outputs` can no longer
  fail the whole gallery: it recreates a missing project folder, skips files
  deleted mid-scan, and returns an empty list instead of a 500. When the
  gallery is empty it now tells you **which project and folder** it read, so
  a project mismatch is visible instead of invisible; the same info appears
  if the timeline's Add Video finds nothing. Fetch errors are shown in the
  gallery panel rather than swallowed, `/outputs/<name>` returns a clean 404,
  and a new `GET /api/outputs/where` reports the active project, folder and
  file count. Suites: e2e 54/54, patcher 43/43.

* **2.16.0** — **Live ComfyUI progress in the console.** The worker now opens
  ComfyUI's WebSocket (`/ws?clientId=...`, stdlib-only client) alongside each
  generation and streams real progress into the job log: `running <node>` on
  node changes, `step v/m — <node>` per sampler step (the UI progress bar
  parses these, so it moves again), and cached-node counts. The old
  elapsed-seconds heartbeat only appears when no step has arrived for 15 s —
  and then says how long the silence has lasted, so a hang is visible as a
  hang. Best-effort: if the WS is unavailable the old behavior remains.
  e2e stub gained a WS endpoint (now a threading server); suites 46/46 + 43/43.

* **2.15.0** — **Full 9/3/3 reference complement + clean exit.** The native
  ref2va template now bakes all 9 image, 3 video (with per-video soundtrack
  via `GetVideoComponents`) and 3 audio reference slots; the patcher prunes
  whatever you don't feed (generalized dead-media cascade replaces the
  RH-only Reference rule) and logs a `slots filled: i/9 image, v/3 video,
  a/3 audio` summary. **Closing bitGen Studio now shuts down ComfyUI**: managed
  process tree first, then a sweep of every ComfyUI process on the machine
  (command lines matching `ComfyUI/main.py`, the portable standalone flag,
  or your configured ComfyUI folder) — on normal exit, Ctrl+C, kill, and
  console-window close. The sweep runs when ComfyUI is the engine or the
  studio launched it this session; in pure sd-cli mode an unrelated ComfyUI
  is left alone. Suites: e2e 44/44, patcher 43/43.

* **2.14.0** — **Native ref2va wired end-to-end.** Ships Tim's Export (API)
  of the official `MiniMaxH3ReferenceToVideo` template as
  `comfy_workflows/ref2va.json` (RH-pack version preserved as
  `ref2va_rh_example.json`). Patcher: native `length` frame input, seed on
  `RandomNoise`, steps on `BasicScheduler`, LoRA/If-Else switch bypass,
  dangling-helper pruning, and **dynamic `ref_images.ref_image_N` slot
  cloning** (1-slot exports accept up to 9 refs). New **17k+5 frame grid**
  for the comfy engine (ceiling 362f/15.08s) across worker, framePlan,
  /api/plan, /api/generate and the UI readout; sd-cli stays on 4n+1.
  Comfy mode no longer requires sd-cli model files. Suites: e2e 44/44,
  patcher 33/33.

* **2.13.0** — Generate now bypasses **every** unused node automatically: all image/video/sound loader slots you didn't feed (existing chain pruning) **and all LoRA nodes** (passthrough rewiring: model/clip flow straight through removed `LoraLoader`/`LoraLoaderModelOnly` chains). Also fixed: the patcher now recognizes ComfyUI's **native** `MiniMaxH3*` nodes, not just the RH pack — official-template exports get prompt/seed/duration/size patched correctly.

* **2.12.6** — Handover update: ComfyUI **native** MiniMax H3 support documented (official templates + model files, 9/3/3 reference limits, `<Picture n>` tag prompting); recommended path is exporting the official R2V template with added loaders as `comfy_workflows/ref2va.json`. No code changes.

* **2.12.5** — ComfyUI execution errors print in full (900 chars, non-ASCII preserved) with `exception_message` extracted, so runtime model-file errors are readable.

* **2.12.4** — Schema sync v2: missing **required** inputs are filled from the
  live server's declared **defaults** (or a combo's first choice), and numeric
  values are **clamped** into declared min/max. Fixes the DualSigmaSampler
  rejection (audio_shift/video_shift/accel/denoise_video now auto-filled) and
  `seed -1` — comfy mode resolves seed −1 to a real random seed and logs it.

* **2.12.3** — Reachability preflight: if ComfyUI isn't running when a comfy
  generation starts, the worker fails immediately with "start it first via the
  Start ComfyUI button" instead of a ConnectionRefused traceback mid-upload.

* **2.12.2** — Preflight for the missing **RH_MinMaxH3 node pack**: when the
  live ComfyUI's `/object_info` shows the RHMiniMaxH3 node types absent, the
  worker fails *before* queueing with install instructions (open a bundled
  example on the ComfyUI canvas → Manager → Install Missing Custom Nodes →
  restart) instead of a validation error. Stub `/object_info/<class>` now
  answers per-class; suite = 42/42.

* **2.12.1** — Fix: ComfyUI returns workflow validation results in the **body
  of an HTTP 400**, which urllib raised as a bare traceback before the
  per-node reporting could run. `_http_json(read_error_body=True)` now reads
  the 400 body, so rejections print each node's error with input name and the
  received value (e.g. which loader filename isn't in your models folder) in
  the app console. e2e covers the 400 path; suite = 42/42.

* **2.12.0** — Ready-made **API-format `comfy_workflows/ref2va.json`**: up to
  **9 reference images + 3 reference videos + 3 reference sounds** in a single
  chained graph. Unused slots are **bypassed automatically**: the worker prunes
  every loader + reference node you didn't feed and rewires the reference
  chain through the gap, so the queued graph always matches exactly the number
  of images/videos/sounds you loaded (extras beyond the slot counts are
  ignored with a log note). Video/sound references from project assets now
  upload to ComfyUI in ref2va mode. New runtime **schema sync** repairs
  widget-input names against the live server's `/object_info` (connection
  names come from the pack's own exports; equal-count ordered rename fixes
  guessed widget names), and workflow rejections now print **per-node
  node_errors** naming the exact inputs. Model filenames baked in the template
  match the bundled examples — if yours differ inside ComfyUI, edit the three
  loader values (or re-export; the pruning works with any Export (API) too).
  New `scripts/test-patcher.py` (18 prune/rewire cases) + a comfy ref2va
  pipeline e2e (2 img + 1 sound through the 9-slot template); suite = 41/41.

* **2.11.0** — Engine selection made unmissable: the **Engine dropdown + URL
  moved to Settings → ComfyUI** (generation follows the dropdown — setting a
  folder or starting ComfyUI alone never switched it, which read as "still
  trying to use sd-cli"). The tab shows a loud ⚠ warning while the engine is
  sd-cli, plus a live **workflow checklist** (t2va/ref2va/fl2va → mapped file,
  exists?, real Export (API)? — mirrors worker.py's exact lookup incl. the
  t2va→fl2va fallback-only-when-unmapped rule). Bundled `t2va.json` is a UI
  export example, so out of the box the checklist correctly shows what to do:
  Export (API) over t2va/ref2va/fl2va.json.

* **2.10.0** — ComfyUI startup streams into the **app's own console dock** —
  no separate terminal window (the process is spawned hidden with output
  piped). Clicking ▶ Start ComfyUI switches the console to a live "── ComfyUI
  ──" feed (launch line, ComfyUI boot output, "✓ API is up" marker, crash/exit
  lines); selecting any job hands the console back to job logs. New
  incremental endpoint `GET /api/comfy/log?from=N` (same shape as job logs,
  2000-line ring with stable absolute indexing).

* **2.9.1** — ComfyUI launcher detects a `run.bat` in the ComfyUI folder root
  **first** (venv-activating installs: run.bat loads the venv then main.py).
  Previous order fell through to bare `main.py` with the system python, which
  fails when ComfyUI's deps live in a venv. New order: custom launch command →
  `run.bat` → `run_nvidia_gpu*.bat`/`run_cpu.bat` → embedded python →
  `main.py` (last resort).

* **2.9.0** — ComfyUI launcher: **▶ Start ComfyUI** button under Generate
  (shows only while the ComfyUI engine is selected and its API is down; hides
  once reachable; reappears on stop/crash), new **Settings → ComfyUI** tab
  (install folder with a **native Windows 11 folder picker** — real
  IFileOpenDialog `FOS_PICKFOLDERS` via PowerShell — plus the in-app 📁
  fallback, optional custom launch command, start/stop/status). Launcher
  auto-detects `run_nvidia_gpu*.bat` / `run_cpu.bat`, portable
  `python_embeded\python.exe + ComfyUI\main.py`, or `main.py`. New
  `lib/comfy.js` + `/api/comfy/{status,start,stop,pickdir}`; `server.js`
  untouched. Saving Settings now preserves the `engine.comfy.workflows`
  mapping (previously wiped on save).

* **2.8.0** — ComfyUI engine: generation per chunk via your existing
  ComfyUI's HTTP API (upload → patch API workflow → prompt → history → view),
  engine selector + URL in Settings, comfy-aware health, bundled example
  workflows, stub-Comfy e2e (chunked run passes end-to-end).

* **2.7.0** — CUDA stability mode (GPU-tab toggle + auto stage-3 retry on
  cuMemSetAccess/device-not-ready), per-run engine env plumbing
  (`gpu.engine_env`), targeted VMM-crash DIAGNOSIS. Ladder is now: measured
  budget/VAE-move → CPU weight offload → CUDA stability → DIAGNOSIS.

* **2.6.0** — CPU weight offload: GPU-tab toggle + editable flag name
  (`--offload-to-cpu`), wired into build_command, and added as stage 2 of the
  OOM auto-retry ladder. e2e covers the full ladder.

* **2.5.0** — OOM retry v2: budget is now **measured** from the engine's own
  VRAM report (device totals + weight placement, minus 1 GiB headroom) instead
  of trusting the configured budget, and when the VAE shares a single
  diffusion card and a second GPU exists, the retry relocates the VAE there
  for that run. Worker output is UTF-8-forced with an ASCII fallback — a
  cp1252 console can no longer crash the worker (the \u26a1 UnicodeEncodeError).
  All worker-emitted guidance is plain ASCII now.

* **2.4.0** — Compute-buffer OOM auto-retry: the worker re-runs the chunk once
  with segmented execution (`--max-vram`, budget from Settings or 8 GiB) and
  the OOM DIAGNOSIS now points at the ⚡ dual-GPU preset. e2e covers the retry
  path via an [oomtest] stub hook.

* **2.3.0** — Failure diagnosis in the worker (metadata-shape walls and OOMs
  now end with one actionable DIAGNOSIS line); unsloth GGUF set added to the
  Model Manager (✓safe entries, per-entry repos); fixed generate creating two
  job folders (refs and run now share one id).

* **2.2.0** — sd-cli installer fixes: **⬇ Install sd-cli** button in
  Settings → Paths (queued job, log in console, found/missing status line),
  hardened `get-sd-cli.ps1` (TLS 1.2, cuda12 preference, API-rate-limit
  redirect fallback, clearer manual steps), `start.bat` now reports installer
  failure instead of continuing silently.

* **2.1.0** — 📁 folder/file pickers on all nine Settings path fields
  (server-side browser, `GET /api/fsbrowse`; drive buttons on Windows,
  extension filters for model files, app-relative path normalization).

* **2.0.0** — Merged the full studio app (projects, assets, timeline Compile,
  ✨ Enhance LLM, system stats, settings, Windows installers) with the v1.2
  generation tools (Auto/single/chunked/png_rebuild, 4n+1 planner, snap-up
  final chunk, seam-drop **audio-preserving** progressive joins, exact trim,
  stable log protocol). New **Model Manager**: Comfy-Org/MiniMax-H3 downloads
  (int8_convrot etc.) + local safetensors → GGUF quantization. Server split
  into minimal `server.js` + `lib/core.js` + `routes/index.js`.
* 1.2.0 — Auto pipeline: 15 s = ONE 361-frame generation (character
  consistency); chunked only past the ceiling.
* 1.1.0 — chunked/single/png_rebuild pipelines, `snap_4n1_up` fix, stub e2e.
