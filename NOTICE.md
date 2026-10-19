# Third-party notices

bitGen Studio is **MIT licensed** (see `LICENSE`). This file explains why that
is compatible with everything it works with, and what it does and does not
ship.

## The short version

**bitGen Studio bundles no third-party generation software.** It drives each
tool as a **separate program**: ComfyUI over its HTTP API on another port, the
speech and transcription engines as subprocesses in their own Python virtual
environments, `llama-server` and `sd-cli` as executables. None of them is
linked into this code, imported into this process, or redistributed in the
release zips — the installer scripts *download* them from their own projects,
onto your machine, under their own licences.

That is the whole licensing story. A GPL program you *run* imposes nothing on
the program that runs it; the GPL's conditions attach to distributing a
combined or derived work, and there is no combined work here. So MIT — the most
permissive common choice — is safe, and it is also compatible in the other
direction: MIT code can be included in a GPL project, so nothing here can ever
become a licensing obstacle for anyone downstream.

## What ships in the repo and the release zips

The runtime dependencies in `package.json` are `express`, `multer` and `jsdom`
(the last used only by the test suite). Their trees are permissive throughout —
MIT, BSD-2/3-Clause, ISC, Apache-2.0, CC0-1.0 and BlueOak-1.0.0. Nothing
copyleft, nothing with a field-of-use restriction.

### Browser libraries in `static/vendor/` (2.477.0)

The page loads these from the studio itself, never from the internet. Each
one's licence file sits beside it, unchanged.

| File | Library | Licence | Licence file |
|---|---|---|---|
| `three-m3d.min.js` | three.js (with its loaders) and opentype.js (3D text) | MIT | `LICENSE-three.txt`, `LICENSE-opentype.txt` |
| `pdf.min.js`, `pdf.worker.min.js` | pdf.js (Mozilla) | Apache-2.0 | `LICENSE-pdfjs.txt` |
| `pdf-lib.min.js` | pdf-lib | MIT | `LICENSE-pdf-lib.txt` |
| `fontkit.umd.min.js` | @pdf-lib/fontkit (a fork of foliojs/fontkit) | MIT | `LICENSE-fontkit.txt` |
| `ag-psd.js` | ag-psd | MIT | `LICENSE-ag-psd.txt` |
| `replicad/replicad.umd.js` | replicad | MIT | `replicad/LICENSE-replicad.txt` |
| `jxl/jxl_oxide_wasm.js`, `jxl/jxl_oxide_wasm_bg.wasm` | jxl-oxide (the JPEG XL decoder, 2.479.0) | MIT (dual MIT / Apache-2.0) | `jxl/LICENSE-jxl-oxide.txt` |
| `jxl/jxl_enc.js`, `jxl/jxl_enc.wasm` | the JPEG XL encoder: libjxl compiled by @jsquash/jxl (2.479.0) | Apache-2.0 (the wrapper) + BSD-3-Clause (libjxl) | `jxl/LICENSE-jsquash-jxl.txt`, `jxl/LICENSE-libjxl.txt` |
| `replicad/replicad_single.js`, `replicad/replicad_single.wasm` | replicad-opencascadejs: OpenCascade Technology compiled to WebAssembly | **LGPL-2.1** (with the OCCT exception) | `replicad/LICENSE-replicad-opencascadejs.txt` |

**The one LGPL component.** OpenCascade (the 3D body kernel, `static/vendor/replicad/`)
is LGPL-2.1. It ships **unmodified, as its own separate files**. bitGen loads it
at run time and does not link it into its own code, so the LGPL's terms apply
to those files only and the rest of bitGen Studio stays MIT. You may replace
`replicad_single.js` / `replicad_single.wasm` with your own build of the same
library. Its source is at <https://github.com/sgenoud/replicad> (the
`replicad-opencascadejs` package) and <https://dev.opencascade.org>. If you do
not want an LGPL file in your copy, delete the `replicad/` folder and pick the
Blender engine for 3D bodies in Settings ▸ 3D.

`requirements.txt` is a single package, `huggingface_hub`, used to fetch model
weights.

## What is downloaded and run, not shipped

| Tool | Role | Where it comes from |
|---|---|---|
| ComfyUI | the primary generation backend | https://github.com/comfyanonymous/ComfyUI |
| ComfyUI custom node packs | KJNodes, Spectrum-MiniMax-H3, and whatever else you install | their own repositories, via ComfyUI Manager |
| llama.cpp / `llama-server` | the local LLM for prompt assistance | https://github.com/ggml-org/llama.cpp |
| stable-diffusion.cpp / `sd-cli` | the legacy image backend | https://github.com/leejet/stable-diffusion.cpp |
| faster-whisper | speech-to-text | https://github.com/SYSTRAN/faster-whisper |
| OpenAudio / fish-speech | text-to-speech | https://github.com/fishaudio/fish-speech |
| OmniVoice | text-to-speech | its own project |
| Electron | the optional desktop shell | https://github.com/electron/electron |

ComfyUI is **GPL-3.0**; llama.cpp, stable-diffusion.cpp, faster-whisper and
Electron are **MIT**. The remaining projects — and every custom node pack you
choose to install — carry their own terms, and some of them change over time.
**Check them at the source before you rely on one commercially.** None of it
changes the licence of this repository, for the reason above: they are separate
programs, and this project does not redistribute them.

## Model weights are not covered by any of this

The models you download — MiniMax H3, FLUX.2, SDXL, the TTS voices, the LLMs —
each come with their **own licence**, and several of the most useful ones are
**non-commercial**. A permissive licence on this application says nothing
whatsoever about what you may do with the output of a model whose licence
restricts it. If you intend to sell anything you render, read the licence of
the specific checkpoint that rendered it.

## Image-to-3D models (2.404.0)

The 🧊 picture -> 3D feature and ✨ Build a scene with AI run Comfy-Org's own ComfyUI templates (shipped as
`comfy_workflows/mesh3d_*.json`) with weights you download yourself. **Hunyuan3D 2.1** is released under Tencent's
Hunyuan 3D community licence, which does not cover the EU, the UK or South Korea and has its own use terms;
**TRELLIS.2** (Microsoft) is MIT-licensed code (some of its parts carry their own licences). Read each model's licence before commercial use.

## Attribution

If you redistribute bitGen Studio, or a modified version, keep `LICENSE` with
it — that is the one condition MIT imposes. Keeping this file alongside it is
not required, but it saves the next person the same research.

## MiniMax-H3-NativeAudio-MusicVideo-Workflow
`comfy_workflows/MMH3_NativeAudio_MV.ui.json` is derived from
`MiniMaxH3_NativeAudio_MusicVideo_TEMPLATE.json` from
https://github.com/Shrek3OnVH5/MiniMax-H3-NativeAudio-MusicVideo-Workflow
(MIT). 2.290.0 modification (bitGen Studio): eight more LoadImage nodes
wired to MiniMaxH3ReferenceToVideo's ref_image_1..8 and two more LoadAudio
nodes wired to ref_audio_1..2 (the core node's own 9/3 limits), plus a
group labelling them. The original nodes keep their values; only the
reference node's input list (and so its links' slot indices) grew.
It is shipped as configuration data; the repo's
ComfyUI-H3-NativeAudioLock custom node (unmodified - it locks the song
into the audio latent and never sees a reference) must be installed in
ComfyUI for the MMH3_NativeAudio_MV style to render.

## The native engine (2.351.0 Viggle (native); 2.352.0 the shared native engine)
`scripts/native/` is bitGen Studio's own renderer. It is written for bitGen
Studio and draws on three Apache-2.0 sources, re-implemented rather than
copied wholesale:

- **Viggle-Animate** (`inference/sample.py`, https://huggingface.co/Viggle/Viggle-Animate,
  code under Apache-2.0 - `LICENSE-CODE` there; Copyright Viggle AI): the
  frozen-prompt injection (`MiniMaxH3Ref2VATextEncoderStep.__call__` replaced),
  the reference order `<Video 1>` then `<Picture 1>`, the canvas on the clip's
  short edge, `load_lora_adapter(prefix=None, weight_name=...)`, flow shift 3,
  4 steps. Modified: driven by the engine server's jobs; the LoRA is merged into
  the packed weights at load; a check that it attached; NaN / out-of-memory
  reasons in words; no audio track.
- **Hugging Face diffusers** (`scripts/convert_minimax_h3_to_diffusers.py`):
  the MiniMax-H3 key renames, the fused-QKV split, the SwiGLU half swap and the
  VAE's per-head QKV reorder (`scripts/native/wstream.py` h3_dit_key / h3_vae_key).
  The engine runs diffusers' own `minimax_h3` modular pipeline, installed at the
  commit the Viggle release was tested with.
- **comfy-kitchen** (Comfy Org, Apache-2.0): the int8 ConvRot layout - rows
  multiplied by a normalised regular Hadamard block before row-wise int8 -
  re-implemented in `wstream.py` (hadamard / rotate) to read ComfyUI's
  `int8_tensorwise` + `convrot` files.

The block streaming (weights packed in RAM, each block unpacked on the GPU
just before it runs) follows the idea Wan2GP / mmgp made popular; no Wan2GP
code is used. The weights (MiniMaxAI/MiniMax-H3, Viggle/Viggle-Animate, or
the user's own ComfyUI files) are NOT shipped: they carry the MiniMax H3
Community License and are fetched by the user.
