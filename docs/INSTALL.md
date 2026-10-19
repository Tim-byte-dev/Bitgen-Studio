# Installing bitGen Studio

**The easy way (2.331.0): run the installer for your system.** It sets up
everything - its own Node.js and Python, ComfyUI, every custom node pack, the
Hugging Face models - tuned for your graphics card, and opens the studio when
it is done. Plan for an hour or two; almost all of it is downloads (ComfyUI
with PyTorch is several GB, the MiniMax H3 models about 70 GB).

The manual route (sections 1-9) is still here for anyone who wants it.

- [The installer](#the-installer)
- [1. Prerequisites](#1-prerequisites)
- [2. Get bitGen Studio](#2-get-bitgen-studio)
- [3. First launch (start.bat)](#3-first-launch-startbat)
- [4. The MiniMax H3 models](#4-the-minimax-h3-models)
- [5. ComfyUI node packs](#5-comfyui-node-packs)
- [6. The local LLM (screenplays, chat, ✨ Enhance)](#6-the-local-llm-screenplays-chat--enhance)
- [7. Optional engines](#7-optional-engines)
- [8. Updating](#8-updating)
- [9. Troubleshooting](#9-troubleshooting)


---

## The installer

| System | File | How to run it |
|---|---|---|
| Windows 10 / 11 | `bitGen-Studio-Setup-<version>.exe` | double-click. No administrator rights - it installs for your user into `%LOCALAPPDATA%\Programs\bitGenStudio` (change the folder on the second page; a big, fast drive is best) |
| Linux (x64 / arm64) | `bitgen-studio-setup-<version>-linux.sh` | `sh bitgen-studio-setup-<version>-linux.sh` (optional `--dir /big/drive/bitGenStudio`) |
| macOS | `bitgen-studio-setup-<version>-macos.command` | double-click, or `sh bitgen-studio-setup-<version>-macos.command`. If macOS blocks it: right-click -> Open |

Build them from a full release zip with `sh scripts/build-installers.sh
dist/bitgen-studio-v<version>-full.zip` (the Windows one needs `makensis`,
from `apt install nsis` or `choco install nsis`).

**What happens**

1. **The app and its runtime.** The app is copied, then `installer/bootstrap.ps1`
   (Windows) or `installer/bootstrap.sh` (Linux / macOS) puts everything it runs
   on INSIDE the app folder - nothing system-wide: Node.js LTS (`runtime/node`),
   Python 3.12 through uv (`runtime/python`), git (MinGit, Windows, only if you
   have none), ffmpeg (only if you have none), the app window (Electron) and the
   Python packages. On Windows the Visual C++ runtime PyTorch needs is installed
   if it is missing (Windows asks once). A Start-menu + desktop shortcut (Linux:
   the app menu; macOS: `~/Applications/bitGen Studio.app`) opens the studio
   straight in its window.
2. **The setup wizard** opens on the first start:
   - **Your hardware** - the GPU check (nvidia-smi / the Mac's GPU), VRAM, RAM
     and what the studio will do with them.
   - **ComfyUI** - *Install a new ComfyUI* (the folder is yours to choose; it
     gets its own Python environment and the right PyTorch for your card:
     CUDA 13.0 / 12.8 wheels for RTX 50, 12.8 / 12.6 for RTX 20-40, Metal on a
     Mac, CPU otherwise) or *Use my existing ComfyUI* with a **Browse...** button
     - a portable build, a git install or a folder with a venv. The wizard
     shows which of the studio's 14 node packs it already has.
   - **Custom nodes** - every pack the studio's workflows use is installed if it
     is missing (git clone, or GitHub's zip when there is no git), with its
     requirements, then ComfyUI's own import check says whether each one loads.
   - **OmniVoice** (voices), optionally faster-whisper (lyric timing), and the
     assistant's engine (llama.cpp).
   - **Viggle (native)** (optional, unticked by default): Viggle-Animate in
     bitGen's own engine. The box shows the download size: its Python
     environment (~5 GB) plus the model parts your ComfyUI folder does not
     already have (up to ~80 GB). Ticked, it installs when the studio first
     opens (`components.txt`: `viggle native=0`); unticked, it is not
     installed (`viggle native=2`). The swap dialog's Viggle (H3) engine runs
     on ComfyUI and works without it.
   - **Settings for your hardware** - render size and per-run length for your
     VRAM, the text encoder placement below 14 GB, where the LLM runs (a second
     card if you have one), speech / transcription on the GPU or CPU, ComfyUI
     starting with the app.
3. **Models from Hugging Face.** A **Hugging Face token** box comes first, then
   the list - every model the studio's workflows load, with live sizes, those
   right for your GPU ticked. **Without a token only the open (not gated)
   models can be downloaded**; with one, gated models whose licence your
   account has accepted can be too (FLUX.2 Klein 9B and Lightricks' LTX files are
   gated - accept their licences on Hugging Face). Downloads resume
   if they are interrupted - run setup again and they continue.
   **Download with** (2.341.0): the **Hugging Face CLI** (`hf download` - faster
   on big files, resumes by itself; **Install hf CLI** puts it in the studio's
   Python) or the built-in downloader. The default uses the CLI when it is
   installed.
4. **Done.** With nothing to report, the studio opens by itself 8 seconds later
   - ComfyUI starts with it and you can generate right away. Anything that
   needs your attention is listed instead (and in `setup.log`).

**Headless / terminal:** `node scripts/setup-cli.js --comfy new --models
recommended [--hf-token hf_...] [--downloader hf] [--install-hf-cli]` does the
same as the wizard (`--help` for the options; `--detect` prints the hardware
check). Just some model files into an installed studio:
`node scripts/setup-cli.js --only-models --models ltx23_omninft,taeltx23
--downloader hf` (`--list-models` prints the ids).

**Models later:** *Settings → Models → ⤓ Model catalog* (2.341.0) is the same
model page inside the studio - token, Hugging Face CLI or built-in, tick,
Download (it keeps going if you close the dialog). **The whole setup again:**
start the app with `H3_SETUP=1`, or delete `.setup-done` in the app folder.

**Uninstalling (Windows):** *Settings -> Apps -> bitGen Studio*. It asks whether
to keep your projects, ComfyUI, models and settings.

---
# Manual install


## 1. Prerequisites

| Install | Why | How |
|---|---|---|
| **NVIDIA driver** (current) | CUDA for ComfyUI / llama.cpp | [nvidia.com/drivers](https://www.nvidia.com/drivers) — RTX 50-series cards need a CUDA 13 driver |
| **Node.js 18+** | runs the bitGen Studio server | [nodejs.org](https://nodejs.org) (LTS) |
| **Python 3.10+** | runs the workers | [python.org](https://www.python.org/downloads/) — tick **Add python.exe to PATH** |
| **Git** | installs ComfyUI and its node packs | [git-scm.com](https://git-scm.com/download/win) or `winget install Git.Git` |
| **ffmpeg** | cutting, joining, trimming, previews, the timeline compile | `winget install Gyan.FFmpeg`, then open a **new** terminal so it is on PATH |

Check them in a new PowerShell window:

```powershell
node --version; python --version; git --version; ffmpeg -version
```

## 2. Get bitGen Studio

Pick a folder on a drive with at least **100 GB free** — ComfyUI, its Python
environment and the models all live under the app folder by default.

```powershell
cd D:\
git clone https://github.com/Tim-byte-dev/Bitgen-Studio.git bitgen-studio
cd bitgen-studio
```

No Git? Use **Code → Download ZIP** on the GitHub page and unzip it — but you
still need Git installed for the ComfyUI step.

## 3. First launch (start.bat)

Double-click **`start.bat`**. It:

1. checks Node.js and Python,
2. installs the Node dependencies (`npm install`) and the Python ones
   (`pip install -r requirements.txt`),
3. downloads the **app window** (Electron, ~150 MB, once) — set the
   environment variable `H3_NO_SHELL=1` if you would rather use your browser,
4. starts the server and opens the app.

On the first run the **setup window** offers to install **ComfyUI**: choose a
folder (default `comfy\` inside the app) and it will

- `git clone` ComfyUI and create its **own** Python venv with CUDA PyTorch,
- write `comfy\ComfyUI\run.bat` (what the app uses to launch it),
- install **ComfyUI-Manager** and the packs the app relies on
  (KJNodes, Spectrum for MiniMax H3, MMH3 Ultimate Upscale).

Keep the black console window open — closing it stops the server.

> **Already have ComfyUI?** Decline the setup window, then in
> **Settings → ComfyUI** set *ComfyUI folder* to your install (the folder with
> `main.py`, `run_nvidia_gpu.bat` or a `run.bat`) and the *ComfyUI URL*
> (default `http://127.0.0.1:8188`). Declined by mistake? Delete
> `comfy\.declined` and restart.
>
> **Browser mode:** run `powershell -ExecutionPolicy Bypass -File get-comfy.ps1`
> yourself, then open <http://127.0.0.1:8311>.

## 4. The MiniMax H3 models

bitGen Studio renders video through ComfyUI, so the model files go into
**ComfyUI's** `models` folder (`comfy\ComfyUI\models\` for the built-in
install). They come from the [Comfy-Org/MiniMax-H3](https://huggingface.co/Comfy-Org/MiniMax-H3)
repository, whose folders already match ComfyUI's:

| File | Folder | Size | Used for |
|---|---|---|---|
| `minimax_h3_ref2va_pruned_int8_convrot.safetensors` ★ | `diffusion_models` | ~21 GB | Ref / Cont scenes, character swap |
| `minimax_h3_fl2va_pruned_int8_convrot.safetensors` ★ | `diffusion_models` | ~21 GB | First / Trans scenes, F/L mode |
| `qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors` ★ | `text_encoders` | ~17 GB | the text encoder the shipped workflows load |
| `minimax_h3_video_vae_fp16.safetensors` | `vae` | 1.4 GB | video VAE |
| `minimax_h3_audio_vae_fp32.safetensors` | `vae` | 0.4 GB | audio VAE |

The quickest way is the Hugging Face CLI (installed by `start.bat`):

```powershell
hf download Comfy-Org/MiniMax-H3 `
  diffusion_models/minimax_h3_ref2va_pruned_int8_convrot.safetensors `
  diffusion_models/minimax_h3_fl2va_pruned_int8_convrot.safetensors `
  text_encoders/qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors `
  vae/minimax_h3_video_vae_fp16.safetensors `
  vae/minimax_h3_audio_vae_fp32.safetensors `
  --local-dir comfy\ComfyUI\models
```

Alternatively open any of the shipped workflows (`comfy_workflows\*.ui.json`)
in ComfyUI — its *Missing models* dialog lists each file with a download
link, including the optional 4-step turbo LoRA some workflows use.

> The `fp8_scaled` diffusion files are the fallback if `int8_convrot` will not
> load on your setup. The GGUF files in **Settings → Models** /
> `download-models.ps1` are for the older **sd-cli** engine only; ComfyUI mode
> does not need them.

## 5. ComfyUI node packs

Current ComfyUI includes the MiniMax H3 nodes (update ComfyUI if a
`MiniMaxH3…` node is reported missing). Some features need extra packs — install them from **ComfyUI-Manager → Install Missing Custom Nodes**
(open the matching workflow from `comfy_workflows\` first), or with
`git clone` into `ComfyUI\custom_nodes\`:

| Feature | Node pack |
|---|---|
| Native-audio scene board **with a song** | ComfyUI-H3-NativeAudioLock (MiniMax-H3-NativeAudio-MusicVideo-Workflow) |
| Character swap | [ComfyUI-VideoHelperSuite](https://github.com/Kosinkadink/ComfyUI-VideoHelperSuite), [rgthree-comfy](https://github.com/rgthree/rgthree-comfy) |
| ControlNet preprocessors | [comfyui_controlnet_aux](https://github.com/Fannovel16/comfyui_controlnet_aux) |
| Face fix | [ComfyUI-Impact-Pack](https://github.com/ltdrdata/ComfyUI-Impact-Pack) + ComfyUI-Impact-Subpack (and `models\ultralytics\bbox\face_yolov8m.pt`) |
| RefMod character identity | [ComfyUI-MiniMaxH3Mod](https://github.com/Luisacaotica/ComfyUI-MiniMaxH3Mod) |
| Sage attention / Spectrum speed-ups | installed by the setup window (KJNodes, Spectrum) |
| Upscaling a take | installed by the setup window (MMH3 Ultimate Upscale) |

When a render needs a node ComfyUI does not have, the job fails with the node's
name and the pack to install — nothing fails silently.

## 6. The local LLM (screenplays, chat, ✨ Enhance)

The screenplay writer, the prompt chat and ✨ Enhance run a local model through
**llama.cpp**:

1. **Settings → LLM → ⬇ Install engine** (or run
   `powershell -ExecutionPolicy Bypass -File get-llama.ps1`). It downloads the
   newest Windows CUDA build of `llama-server` into `llama-cpp\`.
2. Put a chat model (`.gguf`, any instruct model your VRAM allows) into
   `llm-models\`.
3. Pick it in the **LLM** dropdown under the prompt box.

For *Describe image* (the vision model), run `get-qwen3vl.ps1` — it adds
Qwen3-VL and its projector next to the same llama.cpp.

With two GPUs, **Settings → LLM → Device** puts the LLM on the other card
(ComfyUI keeps its own); on one card, pick an LLM small enough to sit beside the
video model or unload it before long renders.

## 7. Optional engines

| Engine | Install | Used by |
|---|---|---|
| OmniVoice (voice cloning / TTS) | Settings → Audio → **Install OmniVoice** | voice clones, TTS, Read replies |
| faster-whisper (speech-to-text) | Settings → Audio → **Install faster-whisper** | transcription, 🎤 Speak |
| demucs (stems) | the Stems docker's **⚙ Install** | stem separation |
| YuE2 (songs) | Settings ▸ Add-ons ▸ YuE2 music (or `get-yue2.ps1`) | Music docker → YuE2 |
| MiniMax Music3 (songs) | ComfyUI workflow `audio_minimax_music3.json` | Music docker → MiniMax |
| sd-cli (legacy engine) | `get-sd-cli.ps1` | only when Settings → ComfyUI → Engine is *sd-cli* |

Each engine gets its own venv / folder under the app; nothing is installed
globally.

## 8. Updating

```powershell
cd D:\bitgen-studio
git pull
```

then run `start.bat` again. Your work is never in the repository:
`projects\`, `styles\`, `graphs\`, `custom.settings` (your settings), the
models and the engines are all ignored by Git, so a pull never touches them.

## 9. Troubleshooting

| Symptom | Fix |
|---|---|
| *ComfyUI is not running and could not be started* | Settings → ComfyUI: check the folder and URL; the **Console** docker shows ComfyUI's own output. |
| A job fails naming a node type | install that node pack (section 5), restart ComfyUI. |
| `OutOfMemoryError` / a render dies near the end | lower the resolution or the scene length; leave *Free VRAM before every generation* on. The app remembers the largest clip your card finished and splits longer ones. |
| Very slow first render | ComfyUI loads ~40 GB of weights the first time; later renders reuse them. |
| `You need pytorch with cu130` in the ComfyUI console | RTX 50-series: update the driver and reinstall ComfyUI's torch (see `minimax-fixed.txt`). |
| No sound on a take | the take's badge says whether the file has an audio stream; a native-audio scene always has one. |
| The app window never appears | run with `H3_NO_SHELL=1` and use the browser at <http://127.0.0.1:8311>. |

Still stuck? Open an issue with the **Console** docker's output and the failing
job's log from the **Queue** docker.
