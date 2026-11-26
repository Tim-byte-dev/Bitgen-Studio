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
| `polygon-clipping.umd.min.js` | polygon-clipping (with splaytree and robust-predicates) - the 📏 PushPull docker's walls (2.620.0) | MIT (robust-predicates: Unlicense) | `LICENSE-polygon-clipping.txt` |
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

### Node packages for Word files (2.814.0)

Installed by `npm` with the rest of the server's packages (not copied into the repo):

| Package | Role | Licence |
|---|---|---|
| `docx` (dolanmiu/docx) | writes the image editor's document text as a Word file (.docx) | MIT |
| `mammoth` (mwilliamson/mammoth.js) | reads a Word file (.docx) into document text | BSD-2-Clause |
| `jszip` (Stuk/jszip) | packs mail merge's Word files into a .zip (2.816.0) | MIT (dual MIT / GPL-3.0 - used under MIT) |
| `exceljs` (exceljs/exceljs) | opens and saves the spreadsheet's Excel workbooks (.xlsx) (2.824.0) | MIT |
| `basic-ftp` (patrickjuchli/basic-ftp) | sends the Web editor's www folder to your host over FTP / FTPS (2.860.0) | MIT |
| `pptxgenjs` (gitbrent/PptxGenJS) | saves 🎞 Slides presentations as PowerPoint files (.pptx) (2.831.0) | MIT |
| `@xmldom/xmldom` (xmldom/xmldom) | reads PowerPoint files (.pptx) into 🎞 Slides (2.832.0) | MIT |
| `mysql2` (sidorares/node-mysql2) | talks to the 🗄 Database docker's MySQL / MariaDB servers (2.842.0) | MIT |
| MariaDB Server (mariadb.org) - NOT bundled | downloaded on request from archive.mariadb.org into `<app>/mariadb/` and run as its own program for the 🗄 Database docker (2.842.0) | GPL-2.0 (a separate program, unmodified) |

### Node packages for ✉ Mail (2.818.0)

Installed by `npm` with the rest of the server's packages (not copied into the repo):

| Package | Role | Licence |
|---|---|---|
| `imapflow` (postalsys/imapflow) | reads the user's own mailbox over IMAP | MIT |
| `mailparser` (nodemailer/mailparser) | opens an email (text, HTML, attachments) | MIT |
| `nodemailer` (nodemailer/nodemailer) | builds and sends email over the user's own SMTP server | MIT-0 |
| `hoodiecrow-imap` (postalsys/hoodiecrow-imap) | a stand-in IMAP + SMTP server for the tests only (a devDependency - never run by the app) | MIT |

## 🟧 Blender skills (2.855.0)

`blender/skills/` is the `skills/` folder of [blender-skills](https://github.com/EL4CTEO/blender-skills) (commit 9e7e04a,
MIT, `blender/skills/LICENSE`): the SKILL.md sheets are given to the LLM for ✨ Model with AI, and its scripts are the 🧰
Blender tools (LODs, UV packing, baking, export, toon, time of day, weather, turntable, QA). They run in your own Blender
(5.2 or newer), headless, on a copy of the scene.

## 🎬 PAN 2's caption policy (2.890.0)

`lib/pan2/system_prompt.md` and `lib/pan2/generic_negative.txt` are PAN 2's prompt rewriter policy and fixed negative from
[ifm-ai/PAN2](https://github.com/ifm-ai/PAN2) (`inference/pan-prompt-rewriter/`, commit 0fb907b, Apache-2.0 - Copyright 2026
MBZUAI, developed by the Institute of Foundation Models), unchanged: the policy is given to your LLM so it writes PAN 2's
structured caption, the negative is sent with every PAN 2 render. The PAN 2 model files themselves are not shipped - Settings
▸ Add-ons ▸ PAN 2 downloads Comfy-Org/PAN2's repacks (Apache-2.0; the Qwen3.5-9B text encoder and the Wan 2.2 VAE under their
own Apache-2.0 licences).

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
| CadQuery | runs the part code for ✨ Generate in SolidCraft (Settings ▸ Add-ons ▸ CAD generate, its own venv) | https://github.com/CadQuery/cadquery |
| cadrille | writes that part code from a description or a picture (optional; CAD generate's ticked item) | https://github.com/col14m/cadrille |
| H3 Character Sheet Designer (ukr8b3g-cmyk) | lays out and writes the Character creator's character sheet (2.870.0 - Settings ▸ Add-ons ▸ H3 Character Sheet Designer clones it into ComfyUI's custom_nodes). Its code is MIT; its mannequin artwork and pictures are outside that licence and are not used or copied by bitGen Studio | https://github.com/ukr8b3g-cmyk/H3-Character-Sheet-Designer |
| H3-LongVideos (Smite79) | chains MiniMax H3 shots for H3 Long Video (2.872.0 - Settings ▸ Add-ons ▸ H3 Long Video clones it from its own page into ComfyUI's custom_nodes). Its licence (h3-longvideos-no-redistribution) does not allow passing it on, so bitGen Studio never ships or copies it; bitGen only builds a graph that names its node | https://huggingface.co/Smite79/MiniMax-H3-Longvideos |
| ComfyUI-PlagueKind-Nodes (PlagueKind, MIT) | H3 SLA sparse attention for H3 Long Video (2.872.0, downloaded by the add-on) | https://github.com/PlagueKind/ComfyUI-PlagueKind-Nodes |
| ComfyUI_Nvidia_VFX_Nodes (Comfy-Org, Apache-2.0) | RTX Video Super Resolution - H3 Long Video's optional 2K pass (2.872.0, downloaded by the add-on; NVIDIA's nvidia-vfx package keeps its own licence) | https://github.com/Comfy-Org/ComfyUI_Nvidia_VFX_Nodes |
| MiniMax H3 fused turbo int8 ConvRot (MATLOWAI) | H3 Long Video's model (2.872.0, downloaded by you through the add-on; the MiniMax H3 model licence applies) | https://huggingface.co/MATLOWAI/minimax-h3-fused-turbo-int8-convrot |

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

## ✨ Generate in SolidCraft: cadrille + CadQuery (2.581.0)

**What it is for.** ✨ Generate in the 📐 SolidCraft docker turns a description or a picture of a mechanical part into
CadQuery code, runs it, and rebuilds the part in SolidCraft as editable sketches, extrudes, holes and fillets (or inserts
it as one STEP solid when a step cannot be rebuilt).

- **[cadrille](https://github.com/col14m/cadrille)** - "cadrille: Multi-modal CAD Reconstruction with Reinforcement
  Learning", Kolodiazhnyi et al., ICLR 2026 ([paper](https://huggingface.co/papers/2505.22914)). A 2B vision-language model
  (built on Qwen2-VL-2B and CAD-Recode) that writes CadQuery from text, pictures or point clouds. bitGen Studio uses its
  text and picture modes, the way its own `test.py` calls it.
  - Its **code** (the GitHub repository) is **Apache-2.0**. bitGen Studio does not copy it; `cad_worker.py` loads the
    weights with Hugging Face `transformers`.
  - Its **weights** ([maksimko123/cadrille](https://huggingface.co/maksimko123/cadrille)) are **CC BY-NC 4.0**:
    attribution, **non-commercial use only**. They are **not shipped** with bitGen Studio. Settings ▸ Add-ons ▸ CAD
    generate downloads them (with the Qwen/Qwen2-VL-2B-Instruct processor files, Apache-2.0) from Hugging Face onto your
    machine, and you accept their licence when you tick it. Do not use cadrille's output commercially. Untick it and the
    app's local LLM writes the code instead (its own model licence applies).
- **[CadQuery](https://github.com/CadQuery/cadquery)** (Apache-2.0, on OpenCascade OCCT: LGPL-2.1 with an exception) is
  installed from PyPI into `<install>/cadgen/.venv` by the same add-on. It is a separate program, not redistributed.

## SolarRenderer (2.588.0)

Settings ▸ Add-ons ▸ SolarRenderer clones [Enderfga/SolarRenderer](https://github.com/Enderfga/SolarRenderer) (code:
Apache-2.0) into ComfyUI's custom_nodes and downloads its LoRAs from
[Enderfga/SolarRenderer](https://huggingface.co/Enderfga/SolarRenderer) on Hugging Face. The weights are released under
the **MiniMax H3 Community License**, including its territorial restrictions (the EU, the UK, the Republic of Korea and
the US are excluded) and its Acceptable Use Policy; the four-step LoRA is fine-tuned from DMAD under the same licence.
Nothing of it ships with bitGen Studio.

## Nougan Nodes (2.592.0)

Settings ▸ Add-ons ▸ Nougan Nodes clones [Winnougan/Nougan_Nodes](https://github.com/Winnougan/Nougan_Nodes) (MIT) into
ComfyUI's custom_nodes. bitGen Studio builds graphs with two of its nodes - NouganRegionalCharacterLoRA (🔲 Zones ▸ 🎭)
and PromptRelayEncode (⏱ timed lines in an LTX prompt; Nougan's Prompt Relay is a rewrite of Kijai's
[ComfyUI-PromptRelay](https://github.com/kijai/ComfyUI-PromptRelay), which provides the same node). Nothing of either
pack ships with bitGen Studio.

## The LLMs in Settings ▸ Add-ons ▸ LLM (2.586.0)

Downloaded on request from Hugging Face into the LLM folder - none ships with bitGen Studio: **Qwen3.8 27B** (Alibaba
Qwen, Apache 2.0; GGUF from [unsloth/Qwen3.8-27B-GGUF](https://huggingface.co/unsloth/Qwen3.8-27B-GGUF)), **Gemma 4 31B
/ 12B** (Google, Apache 2.0; [unsloth/gemma-4-31B-it-GGUF](https://huggingface.co/unsloth/gemma-4-31B-it-GGUF),
[unsloth/gemma-4-12B-it-qat-GGUF](https://huggingface.co/unsloth/gemma-4-12B-it-qat-GGUF)), **Qwen3.5 9B** and **Qwen3
4B / 8B / 14B** (Apache 2.0, unsloth's GGUFs). A model you fine-tune from one of them carries its licence.

## Fibo 2.0 (2.582.0)

The Fibo 2.0 styles use **Bria AI's Fibo 2.0** weights (Edit Turbo / Dev, 8B), released under **CC BY-NC 4.0 -
non-commercial use only**; commercial use needs a licence from Bria AI. Settings ▸ Add-ons ▸ Fibo 2.0 downloads the
files you tick from [Comfy-Org/Fibo-2.0](https://huggingface.co/Comfy-Org/Fibo-2.0) (the text encoder, the VAE, the
official int8 file) and the community low-VRAM quantizations at
[realrebelai/Fibo-2.0_GGUFs](https://huggingface.co/realrebelai/Fibo-2.0_GGUFs) (w4a8 ConvRot and GGUF, the same
licence). Nothing of it ships with bitGen Studio. A GGUF file loads with [ComfyUI-GGUF](https://github.com/city96/ComfyUI-GGUF)
(Apache-2.0), installed into ComfyUI by the add-on when a GGUF is ticked.

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

## 🔎 Web search: SearXNG (2.886.0)

- **[SearXNG](https://github.com/searxng/searxng)** (AGPL-3.0) through **[SimpleXNG](https://pypi.org/project/simplexng/)** (AGPL-3.0)
  - not bundled. Settings ▸ General ▸ 🌐 ⬇ Install SearXNG here installs the `simplexng` package from PyPI into its own Python
  environment (`<app>/searxng/`) and runs it unchanged on 127.0.0.1:8888 for bitGen's own LLM; its source is at the links above.
- **Brave Search API** and **Wikipedia's API** are services the user chooses; bitGen sends them only the search words.

## 🗣 LongCat-Video-Avatar 1.6 (2.918.0)

No LongCat code or weights are shipped. Settings ▸ Add-ons ▸ LongCat Avatar 1.6 clones
[PedroMarinhoDev/ComfyUI-LongCat-Avatar](https://github.com/PedroMarinhoDev/ComfyUI-LongCat-Avatar) (GPL-3.0, like ComfyUI)
into your ComfyUI's custom_nodes and downloads
[PedroMarinhoDev/LongCat-Video-Avatar-1.6-ComfyUI](https://huggingface.co/PedroMarinhoDev/LongCat-Video-Avatar-1.6-ComfyUI)
(single-file copies of [meituan-longcat/LongCat-Video-Avatar-1.6](https://huggingface.co/meituan-longcat/LongCat-Video-Avatar-1.6),
MIT - Meituan LongCat Team; Whisper large-v3's encoder, MIT - OpenAI) and Wan 2.1's umT5 text encoder and VAE from
Comfy-Org/Wan_2.1_ComfyUI_repackaged (Apache-2.0). bitGen Studio talks to the pack through ComfyUI's API only
(misc/longcat_worker.py builds the graph).

## 🎙 SAVA and Voice Isolator (2.919.0)

No Inworld code or weights are shipped. Settings ▸ Add-ons ▸ Voice conversation installs
[inworld-ai/sava](https://github.com/inworld-ai/sava) (SAVA - voice activity and end-of-turn detection) and
[inworld-ai/voice-isolator](https://github.com/inworld-ai/voice-isolator) (Voice Isolator - 48 kHz speech denoising) with pip
into its own venv (voice-kit/.venv); their weights (huggingface.co/inworld/sava, huggingface.co/inworld/voice-isolator) come
from Hugging Face. Code and weights are Apache-2.0 (Copyright 2026 Inworld AI); their NOTICE files travel with the packages.
scripts/voice_stream.py uses their published Python APIs only.

## ✂ SAM 3 (2.920.0)

No SAM 3 code or weights are shipped. The image editor's Segment Anything install (Select ▸ Segment Anything settings ▸ ⬇
Install) downloads Meta's SAM 3 weights (huggingface.co/facebook/sam3 - gated: your own Hugging Face token once Meta approves
you - else the unmodified mirror huggingface.co/ml-resources/sam3) into models/sam3 under the **SAM License** (Copyright Meta
Platforms, Inc.; commercial use and redistribution allowed with the licence kept - its LICENSE file is downloaded beside the
weights) and runs them through Hugging Face transformers (Apache-2.0).


## 👗 GarmentCode - the Garment designer (2.932.0)

No GarmentCode code is shipped. Settings ▸ Add-ons ▸ Garment designer clones
[maria-korosteleva/GarmentCode](https://github.com/maria-korosteleva/GarmentCode) (MIT, (c) 2024 Maria Korosteleva) into
`garmentcode/GarmentCode` and installs numpy, scipy, svgwrite, svgpathtools, PyYAML, psutil and matplotlib from PyPI into its
own Python. bitGen uses only its sewing-pattern programs (pygarment + `assets/garment_programs`). `lib/garment/schema.json` is
a copy of its design tree (`assets/design_params/default.yaml`, MIT); the display mannequins' measurements
(`static/mannequins/mesh/*.measure.json`) are measured on bitGen's own MakeHuman (CC0) bodies, the measurements that cannot be
taken from a mesh scaled from GarmentCode's average bodies (`assets/bodies/mean_female.yaml` / `mean_male.yaml`, MIT).
NOT used: GarmentCode's drape simulator (its NVIDIA Warp fork is under the NVIDIA Source Code License - non-commercial), its
SMPL-based bodies, and ChatGarment (non-commercial).

## 🧍 The garment drape (2.933.0)

The drape is Blender's own cloth simulation, run as a separate program (Blender is GPL; nothing of it is shipped - bitGen
runs the Blender you installed with scripts/garment_drape.py). GarmentCode's simulator is still not used.
`static/mannequins/mesh/<sex>_drape.obj` is bitGen's display mannequin (MakeHuman base mesh + targets, CC0) with its arms
raised to GarmentCode's A-pose by scripts/make_mannequin_mesh.py --drape.

## ⇄ OpenJutsu - the swap dialog's OpenJutsu engine (2.949.0)

bitGen ships OpenJutsu's ComfyUI workflows UNMODIFIED in `comfy_workflows/openjutsu/` (simple, advanced, advanced_maxq,
object, mask, color, face `.api.json`) - [D3voz/openjutsu](https://github.com/D3voz/openjutsu) at commit 7fe118b (2026-10-30),
MIT, Copyright (c) 2026 D3voz; its licence is beside them (`LICENSE.txt`). `lib/openjutsu.js` fills them the way OpenJutsu's
own `lib/*.ts` do (a port - checked graph-for-graph against its code). OpenJutsu's Next.js page and comfy-api-proxy are NOT
used. Settings ▸ Add-ons ▸ OpenJutsu swap clones into your ComfyUI's custom_nodes (none of it is shipped):
[comfyui-h3-oneclick-swap](https://github.com/D3voz/comfyui-h3-oneclick-swap) (MIT, D3voz),
[ComfyUI-MiniMaxH3-Contex-Loop](https://github.com/ethanfel/ComfyUI-MiniMaxH3-Contex-Loop) 0.7.3+ (GPL-3.0),
[ComfyUI-Fantastic-MiniMaxH3-PromptBuilder](https://github.com/Adudeguyman/ComfyUI-Fantastic-MiniMaxH3-PromptBuilder) (MIT),
ComfyUI-KJNodes and ComfyUI-VideoHelperSuite (GPL-3.0), [comfyui-image-detail-contrast](https://github.com/D3voz/comfyui-image-detail-contrast)
(MIT) and [Orion4D_FXMax](https://github.com/orion4d/Orion4D_FXMax) (MIT, Philippe Joye) for 🎨 Fix colours, and - only when
ticked - [ComfyUI-Spectrum-MiniMax-H3](https://github.com/xmarre/ComfyUI-Spectrum-MiniMax-H3) (GPL-3.0). It downloads the DMAD
4-step LoRA ([Kijai/MiniMax-H3-experimental](https://huggingface.co/Kijai/MiniMax-H3-experimental), from ByteDance + Texas A&M's
DMAD), SAM 3.1 ([Comfy-Org/sam3.1](https://huggingface.co/Comfy-Org/sam3.1), the SAM License) and - only when ComfyUI has none -
MiniMax H3's files (the MiniMax H3 Community License: its Applicable Territory excludes the EU, the UK, South Korea and the USA).

🙂 Fix faces is OPT-IN (off until you tick "I accept" in the dialog): it installs
[ComfyUI-H3-FaceRefine](https://github.com/Carasibana/ComfyUI-H3-FaceRefine) (MIT) and ComfyUI-Impact-Pack (GPL-3.0), downloads
the Ultralytics YOLOv8 face / person detectors from [Bingsu/adetailer](https://huggingface.co/Bingsu/adetailer) (AGPL-3.0) and
SAM ViT-B (Apache-2.0); H3-FaceRefine fetches InsightFace's buffalo_l on first use, which is licensed for NON-COMMERCIAL
RESEARCH ONLY. bitGen ships none of these weights.

## 🌐 360 panorama (2.971.0)

No code from [nomadoor/ComfyUI-Panorama-Stickers](https://github.com/nomadoor/ComfyUI-Panorama-Stickers) (MIT, nomadoor) is
shipped or installed: the image editor's Image ▸ 🌐 360 Panorama builds the pack's green equirectangular canvas itself
(ext/imageeditdock/pcpano.js), and comfy_workflows/img_qwen21_pano360.json follows the pack's example workflow using only
ComfyUI's own nodes. The models check downloads
[nomadoor/qwen-image-2.1-360-panorama-outpaint-lora](https://huggingface.co/nomadoor/qwen-image-2.1-360-panorama-outpaint-lora)
(v0.1) into comfy/loras when it is missing; like Qwen Image 2.1 itself it is under the Qwen Research License -
NON-COMMERCIAL use. bitGen ships none of these weights.
