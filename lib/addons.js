// bitGen Studio — lib/addons.js (2.540.4): THE ADD-ONS - optional engines installed from Settings ▸ Add-ons.
//
// Tim: "all generation works except for yue2, can we add an add ons tab to settings - install yue2?" (his log: "YuE2 is
// not installed - run misc\\get-yue2.ps1 once"). One list of the optional engines, what each is for, what it needs and how
// big it is, whether it is installed, and an Install / Remove that runs IN the app (no PowerShell window), one at a
// time, every line in a log the tab shows.
//
//   YuE2 (the "YuE2" music style): its own venv at <app>/yue2/.venv (where music_worker.py looks), the app's Python
//     (3.10-3.13), PyTorch 2.10.0 - the version the pipeline pins - from the PyTorch CUDA index for THIS card first
//     (cu130 / cu128 - PyPI's Windows wheel is CPU-only), then the pinned pipeline yue2-infer 0.1.6 from its GitHub
//     release zip (no git needed). The model (m-a-p/YuE2-3B + its VAE) downloads on the first song.
//   Viggle (native): the existing installer (routes/native.js) - its job runs in the queue; shown here with its state.
//   2.557.0 AI fill models: the image editor's Krita-AI fill helpers - a node pack + the model files ticked in the tab
//     (lib/aiFillAddon.js); an add-on may list items (status().items) and install(opts.items) gets the ticked ones.
//
//   list()                       -> [{id, label, for, needs, size, installed, note, busy, actions}]
//   installYue2(ctx)             ctx = {log, run (X.run), python, gpu, env, base} -> {ok, error}
//   start(id) / remove(id)       one job at a time -> {ok} | {error}; job() -> {id, action, state, lines[], error}
"use strict";
const fs = require("fs");
const path = require("path");
const core = require("./core");
const X = require("./setupExec");

const YUE2 = {
  tag: "yue2-v0.1.6",
  torch: "2.10.0",
  pkg: "yue2-infer @ https://github.com/multimodal-art-projection/YuE/archive/refs/tags/yue2-v0.1.6.zip",
  model: "m-a-p/YuE2-3B",
};
const IS_WIN = process.platform === "win32";

const yueDir = (base) => path.join(base || core.BASE, "yue2");
const yueVenv = (base) => path.join(yueDir(base), ".venv");
const venvPy = (v) => path.join(v, IS_WIN ? "Scripts" : "bin", IS_WIN ? "python.exe" : "python");
const yueCli = (base) => path.join(yueVenv(base), IS_WIN ? "Scripts" : "bin", IS_WIN ? "yue2.exe" : "yue2");

/** The CUDA wheel indexes to try for this machine (setupGpu's choice; cu128 when it cannot tell). */
function torchIndexes(gpu) {
  const g = gpu || {};
  if (!g.cuda) return [];
  return (Array.isArray(g.torch) && g.torch.length ? g.torch : ["cu128"]).filter((x) => /^cu\d+$/.test(x));
}

/** The YuE2 install, step by step (pure apart from ctx.run / the file system - the tests pass a fake run). */
async function installYue2(ctx) {
  const log = ctx.log || (() => {});
  const run = ctx.run || X.run;
  const env = Object.assign({}, ctx.env || process.env, { PYTHONUTF8: "1", PIP_DISABLE_PIP_VERSION_CHECK: "1" });
  const base = ctx.base || core.BASE;
  const py = ctx.python;
  if (!py) return { ok: false, error: "no Python found - the app's setup installs one (Settings ▸ General ▸ Setup), or set Python in Settings ▸ Paths" };
  const idx = torchIndexes(ctx.gpu);
  if (!idx.length) return { ok: false, error: "YuE2 needs an NVIDIA GPU with CUDA (BF16, ~24 GB VRAM) - none was found on this computer" };
  // the app's Python must be 3.10 - 3.13 (the pipeline: >=3.10; PyTorch 2.10 has wheels up to 3.13)
  let ver = "";
  await run(py, ["-c", "import sys; print('PYV %d.%d' % sys.version_info[:2])"], { log: (l) => { const m = /PYV (\d+\.\d+)/.exec(l); if (m) ver = m[1]; }, env });
  const [maj, min] = ver.split(".").map(Number);
  if (!ver || maj !== 3 || min < 10 || min > 13) return { ok: false, error: `YuE2 needs Python 3.10 - 3.13; ${py} is ${ver || "not runnable"}` };
  log(`[ok] Python ${ver} (${py})`, false);
  fs.mkdirSync(yueDir(base), { recursive: true });
  const venv = yueVenv(base), vpy = venvPy(venv);
  if (!fs.existsSync(vpy)) {
    log(`[..] its own Python environment: ${venv}`, false);
    if (await run(py, ["-m", "venv", venv], { log, env }) !== 0 || !fs.existsSync(vpy)) return { ok: false, error: "could not make the venv " + venv };
  } else log(`[ok] venv already there: ${venv}`, false);
  await run(vpy, ["-m", "pip", "install", "--upgrade", "pip", "--progress-bar", "off"], { log, env, timeout: 10 * 60000 });
  // PyTorch first, from the CUDA index (PyPI's Windows torch is CPU-only, and the pipeline pins torch==2.10.0)
  let torchOk = false;
  for (const i of idx) {
    log(`[..] PyTorch ${YUE2.torch} (${i} wheels, ~3 GB)`, false);
    const code = await run(vpy, ["-m", "pip", "install", `torch==${YUE2.torch}`, "--index-url", `https://download.pytorch.org/whl/${i}`, "--progress-bar", "off"], { log, env, timeout: 60 * 60000 });
    if (code === 0) { torchOk = true; log(`[ok] torch ${YUE2.torch}+${i}`, false); break; }
    log(`[warn] the ${i} wheels did not install - trying the next`, true);
  }
  if (!torchOk) return { ok: false, error: `PyTorch ${YUE2.torch} with CUDA would not install - update the NVIDIA driver and try again` };
  log(`[..] the YuE2 pipeline (${YUE2.tag})`, false);
  if (await run(vpy, ["-m", "pip", "install", YUE2.pkg, "--progress-bar", "off"], { log, env, timeout: 60 * 60000 }) !== 0)
    return { ok: false, error: `pip could not install ${YUE2.tag} - see the log above` };
  if (!fs.existsSync(yueCli(base))) return { ok: false, error: `installed, but ${yueCli(base)} is not there - see the log above` };
  log(`[ok] YuE2 installed: ${yueCli(base)}`, false);
  log(`[ok] pick the "YuE2" style in the Music docker. The first song downloads ${YUE2.model} from Hugging Face (one time), later songs work offline.`, false);
  return { ok: true };
}

/* ---------------- the one running job */
let J = null;   // {id, action, state: running | done | error, lines: [], error, started, finished}
function job() { return J; }
function busy() { return !!(J && J.state === "running"); }
function startJob(id, action, fn) {
  if (busy()) return { error: `${J.id} is already being ${J.action === "remove" ? "removed" : "installed"} - one at a time` };
  J = { id, action, state: "running", lines: [], error: "", started: Date.now(), finished: 0 };
  const me = J;
  const log = (line, err) => { me.lines.push((err ? "! " : "") + String(line)); if (me.lines.length > 4000) me.lines.splice(0, me.lines.length - 4000); };
  Promise.resolve().then(() => fn(log)).then((r) => {
    me.state = r && r.ok ? "done" : "error"; me.error = (r && r.error) || ""; me.finished = Date.now();
    log(r && r.ok ? `[done] ${id} ${action === "remove" ? "removed" : "installed"}` : `[failed] ${me.error}`, !(r && r.ok));
  }).catch((e) => { me.state = "error"; me.error = String((e && e.message) || e); me.finished = Date.now(); log("[failed] " + me.error, true); });
  return { ok: true, job: J };
}

/** The app's Python + this machine's GPU (lazy - setupRun / setupGpu are heavy). */
function machine() {
  const SR = require("./setupRun");
  let gpu = {};
  try { gpu = require("./setupGpu").detect(); } catch { gpu = {}; }
  return { python: SR.appPython(), gpu, env: SR.env() };
}

/* ---------------- the list */
const LIST = [
  // 3.3.0 (Tim: "could you add the hf install to the top of the addons in settings-addons please" - UniRig's log: "Xet Storage
  // is enabled for this repo, but the 'hf_xet' package is not installed. Falling back to regular HTTP download"): FIRST in the list
  { id: "hf", label: "🤗 Hugging Face downloads (hf_xet - faster, resumable)",
    for: "Every model the add-ons download from Hugging Face: most repos are stored with Xet now - without hf_xet the downloads fall back to plain HTTP (slower; a broken one starts over). Installs hf_xet into the app's Python and every add-on's Python environment that is here; add-ons installed later get it on their own",
    size: "~10 MB a Python environment",
    needs: "nothing - a gated model still needs your Hugging Face token (Settings ▸ Paths ▸ Hugging Face)",
    status() { return require("./hfAddon").status(); },
    install() { const m = machine(); return (log) => require("./hfAddon").install(Object.assign({ log }, m)); },
    remove() { const m = machine(); return (log) => require("./hfAddon").remove(Object.assign({ log }, m)); } },
  { id: "yue2", label: "YuE2 music",
    for: "Songs from lyrics + a style caption with the \"YuE2\" style in the Music docker (vocals, instruments, 48 kHz stereo)",
    needs: "an NVIDIA GPU with BF16 and ~24 GB VRAM; the app's Python 3.10 - 3.13",
    size: "~5 GB now (PyTorch 2.10 + the pipeline, in its own venv) + the model (~10 GB) on the first song",
    status(base) { const ok = fs.existsSync(yueCli(base)); return { installed: ok, note: ok ? yueCli(base) : (fs.existsSync(venvPy(yueVenv(base))) ? "its venv is there but the pipeline is not - Install again" : "not installed") }; },
    install() { const m = machine(); return (log) => installYue2(Object.assign({ log }, m)); },
    remove() { return async (log) => { const d = yueDir(); log(`[..] removing ${d}`, false); const ok = require("./setupPacks").safeRm(d, log); return ok ? { ok: true } : { ok: false, error: `could not remove ${d} - close anything using it and try again` }; }; } },
  // 2.557.0 (Tim: "add download ai fill models to addons tab in settings dialog"): the image editor's selection fill the
  // Krita AI way (lib/kritaInpaint.js) - the node pack + the models you tick (lib/aiFillAddon.js)
  { id: "aifill", label: "AI fill models (the Krita AI way)",
    for: "Generate / Fill / Remove in a selection in the image editor fill like the Krita AI plugin - SDXL / Pony with the Fooocus inpaint patch, Illustrious / FLUX.1 / SD 1.5 with inpainting ControlNets, Remove with MAT",
    needs: "ComfyUI (its folder set in Settings ▸ ComfyUI); restart ComfyUI once after the first install",
    get size() { return "the node pack (small) + the models you tick: " + require("./aiFillAddon").ITEMS.map((i) => `${i.label.replace(/ \(.*\)$/, "")} ${require("./aiFillAddon").fmt(i.files.reduce((s, id) => s + ((require("./setupModels").byId(id) || {}).size || 0), 0))}`).join(", "); },
    status() { return require("./aiFillAddon").status(); },
    install(opts) { const picks = (opts || {}).items; return (log) => require("./aiFillAddon").install(log, picks); },
    remove() { return (log) => require("./aiFillAddon").remove(log); } },
  // 2.566.0 (Tim: "can you add this model type to bitgen please...https://huggingface.co/Comfy-Org/MOSS-Image, add an option
  // in add-ons to download and install it"): MOSS-Image's files from Comfy-Org/MOSS-Image (lib/mossAddon.js)
  { id: "moss", label: "MOSS-Image (image model)",
    for: "The MOSS-Image image styles (OpenMOSS's open 5B model - strong text in pictures and layouts): SFT for pictures, Base for LoRAs",
    needs: "ComfyUI 0.42.2 or newer (its own MOSS-Image nodes - no node pack); about 14 GB of VRAM with the int8 files (a 16 GB card)",
    get size() { const M = require("./mossAddon"); return "the files you tick: " + M.ITEMS.map((i) => `${i.label.replace(/ \(.*\)$/, "")}${/\(/.test(i.label) ? " " + i.label.match(/\(([^)]*)\)/)[1] : ""} ${require("./aiFillAddon").fmt(i.files.reduce((s, id) => s + ((require("./setupModels").byId(id) || {}).size || 0), 0))}`).join(", "); },
    status() { return require("./mossAddon").status(); },
    install(opts) { const picks = (opts || {}).items; return (log) => require("./mossAddon").install(log, picks); },
    remove() { return (log) => require("./mossAddon").remove(log); } },
  // 2.870.0 (Tim: "https://github.com/ukr8b3g-cmyk/H3-Character-Sheet-Designer can we integrate this into bitgen, if we can then
  // remove our character designer and use this one"): the node pack + MiniMax H3 Image (lib/h3SheetAddon.js, lib/charSheetH3.js)
  { id: "h3sheet", label: "H3 Character Sheet Designer (character sheets)",
    for: "The Character creator's 🪪 Character sheet: one picture of a character becomes a reference sheet of up to 13 views (6 head, 3 full body, clothing front / back, hands, feet), with part pictures and notes, drawn by MiniMax H3 Image. The designer is ukr8b3g-cmyk's ComfyUI node pack (MIT)",
    needs: "ComfyUI 0.45 or newer (its MiniMax H3 Image Conditioning node), git for the pack; a big NVIDIA card - MiniMax H3 Image int8 is the size of the video model",
    get size() { const M = require("./h3SheetAddon"); return "about " + require("./aiFillAddon").fmt(M.ITEMS.filter((i) => i.files && i.id !== "te").reduce((s, i) => s + i.files.reduce((t, id) => t + ((require("./setupModels").byId(id) || {}).size || 0), 0), 0)) + " (the MiniMax H3 Image transformer + VAE) + the MiniMax H3 text encoder (16.9 GB) if you do not have it yet"; },
    links: () => [{ kind: "pack", label: "H3 Character Sheet Designer (GitHub)", url: require("./charSheetH3").PACK.url, dest: "ComfyUI/custom_nodes" },
                  { kind: "model", label: "minimax_h3_image_pruned_int8_convrot.safetensors", url: "https://huggingface.co/Comfy-Org/MiniMax-H3-Image/tree/main/diffusion_models", dest: "ComfyUI/models/diffusion_models" },
                  { kind: "model", label: "minimax_h3_image_vae_fp16.safetensors", url: "https://huggingface.co/Comfy-Org/MiniMax-H3-Image/tree/main/vae", dest: "ComfyUI/models/vae" }],
    status() { return require("./h3SheetAddon").status(); },
    install() { return (log) => require("./h3SheetAddon").install(log); },
    remove() { return (log) => require("./h3SheetAddon").remove(log); } },
  // 2.872.0 (Tim: "this workflow is for 40 second h3 video. can we add this one and remove the 30sec one - the 30sec one changes
  // faces and flow after 15secs"): chained MiniMax H3 shots (lib/h3LongVideo.js, lib/h3LongAddon.js)
  { id: "h3long", label: "H3 Long Video (40 s and longer)",
    for: "The \"H3 Long Video (40 s)\" video style and the StoryBoard's ⚙ Long video: one prompt becomes several MiniMax H3 shots, each one starting from the last frame of the one before - the first paragraph is the scene + style, every later paragraph is one shot. Faces and the flow hold past 15 s. Optional 2K pass (NVIDIA RTX Video Super Resolution)",
    needs: "ComfyUI with MiniMax H3 support, git for the node packs; a big NVIDIA card (the fused turbo model is 21 GB); an RTX card for the 2K pass",
    get size() { const M = require("./h3LongAddon"); return "about " + require("./aiFillAddon").fmt(M.ITEMS.filter((i) => i.id === "dit").reduce((s, i) => s + i.files.reduce((t, id) => t + ((require("./setupModels").byId(id) || {}).size || 0), 0), 0)) + " (the fused turbo model) + the MiniMax H3 text encoder and VAEs (23 GB) if you do not have them yet"; },
    links: () => { const L = require("./h3LongVideo"); return [
      { kind: "pack", label: "H3-LongVideos (Hugging Face - its own licence)", url: L.PACKS.long.url, dest: "ComfyUI/custom_nodes/" + L.PACKS.long.folder },
      { kind: "pack", label: "PlagueKind nodes (GitHub)", url: L.PACKS.sla.url, dest: "ComfyUI/custom_nodes" },
      { kind: "pack", label: "NVIDIA VFX nodes (GitHub)", url: L.PACKS.rtx.url, dest: "ComfyUI/custom_nodes" },
      { kind: "model", label: L.MODEL_FILE, url: "https://huggingface.co/MATLOWAI/minimax-h3-fused-turbo-int8-convrot/tree/main/diffusion_models", dest: "ComfyUI/models/diffusion_models" }]; },
    status() { return require("./h3LongAddon").status(); },
    install(opts) { const picks = (opts || {}).items; return (log) => require("./h3LongAddon").install(log, picks); },
    remove() { return (log) => require("./h3LongAddon").remove(log); } },
  // 2.869.0 (Tim: "can we add this to timeline for mocap, https://github.com/toyxyz/toyxyz_RGBMocap"): RGB MoCap - a Windows app
  // (MIT; its models keep their own licences) cloned + its install.cmd run; the timeline's 🕺 Mocap sends clips to it (lib/rgbMocap.js)
  { id: "rgbmocap", label: "RGB MoCap (motion capture app, Windows)",
    for: "The timeline's 🕺 Mocap: a clip of a person becomes editable body animation in RGB MoCap's own window (PEAR, ExMR, FlowHMR, GVHMR, MAMMA, PromptHMR - contacts, retargeting to your character), exported as FBX / BVH and brought back onto the timeline as a 3D layer. The app is MIT; each model keeps its own licence (some are non-commercial - its THIRD_PARTY_NOTICES.md)",
    needs: "64-bit Windows, an NVIDIA GPU + driver, OpenGL 4.3, git; its install.cmd brings Blender, FFmpeg and its runtimes",
    size: "~32 GB free for its setup + ~70 GB for the models you pick in its own Model Manager (some need you to register)",
    links: () => require("./rgbMocap").LINKS,
    status() { const s = require("./rgbMocap").status(); return Object.assign({ installed: s.installed }, s); },
    install() { return (log) => require("./rgbMocap").install(log); },
    remove() { return require("./rgbMocap").remove(); } },
  // 2.976.0 (Tim: "are we able to make a 3d model of a person animal and car from a photo... like daz studio does it with
  // facegen?" -> "yes please"): 🦴 Rig it - UniRig (MIT) in its own Python 3.11 venv (lib/rigAddon.js)
  { id: "unirig", label: "🦴 Rig it (UniRig) - skeletons for any 3D model",
    for: "🦴 Rig it in the Sketcher: a project 3D model (a person, an animal, a creature from 🧊 Convert to 3D or 🧱 Picture → 3D scene) gets a skeleton and skin weights - <name>_rigged.glb in models3d, ready to pose and animate in Blender or on the timeline",
    size: "~7 GB (PyTorch, Blender's bpy module, spconv, flash-attn in its own Python 3.11) + the checkpoints (~1.5 GB)",
    needs: "an NVIDIA card with 8 GB or more, git; uv when the app's Python is not 3.11 (the setup installs it)",
    links: () => require("./rigAddon").LINKS,
    status() { return require("./rigAddon").status(); },
    install() { const m = machine(); const tok = ((core.getConfig() || {}).hf || {}).token || ""; return (log) => require("./rigAddon").installRig(Object.assign({ log, hfToken: tok }, m)); },
    remove() { return require("./rigAddon").remove(); } },
  // 2.975.0 (Tim: "is this worth adding to sketcher docker https://github.com/neilsonnn/image-blaster" -> "yes, please do 1-5"):
  // 🧱 Picture → 3D scene's 🌍 walk-in world - HunyuanWorld 1.0 in its own venv (lib/hyworldAddon.js)
  { id: "hyworld", label: "HunyuanWorld 1.0 - walk-in 3D worlds (not in the EU / UK / South Korea; FLUX.1 Fill is non-commercial)",
    for: "🧱 Picture → 3D scene (the Sketcher): 🌍 Walk-in world - the scene's 360° panorama becomes a layered 3D mesh world you can walk into (one .glb in the project's models3d)",
    size: "~6 GB of code + packages, ~45 GB of models (FLUX.1 Fill [dev] + the HunyuanWorld LoRAs + ZIM)",
    needs: "an NVIDIA card with 24 GB (Low memory on), git, a Hugging Face token with FLUX.1 Fill [dev]'s licence accepted",
    links: () => require("./hyworldAddon").LINKS,
    status() { return require("./hyworldAddon").status(); },
    install() { const m = machine(); const tok = ((core.getConfig() || {}).hf || {}).token || ""; return (log) => require("./hyworldAddon").installHyworld(Object.assign({ log, hfToken: tok }, m)); },
    remove() { return require("./hyworldAddon").remove(); } },
  // 2.994.0 (Tim: "is this worth adding? https://pager360.github.io/" -> "yes do it please, first time dl, add disclaimer that
  // these models are for non-commercial use only"): ⛰ Panorama depth - PaGeR in its own venv (lib/pagerAddon.js)
  { id: "pager", label: "⛰ Panorama depth (PaGeR) - non-commercial use only",
    for: "⛰ Depth in the 🌐 Panorama 3D view: a 360° panorama's depth in metres, its sky and surface normals -> a walk-in depth mesh (.glb in the project's models3d) and a stereo 360 (top / bottom) for VR World and headsets. The weights are CC BY-NC 4.0: NON-COMMERCIAL use only",
    size: "~6 GB (PyTorch + its packages in its own Python) + the weights (~5 GB, Depth Anything 3 ViT-Giant inside) + CLIP ViT-B-32 (~600 MB)",
    needs: "an NVIDIA card with 12 GB or more (RTX 3090 / 4090 / 5090 class), git; uv when the app's Python is not 3.10 - 3.12 (the setup installs it)",
    links: () => require("./pagerAddon").LINKS,
    status() { return require("./pagerAddon").status(); },
    install() { const m = machine(); const tok = ((core.getConfig() || {}).hf || {}).token || ""; return (log) => require("./pagerAddon").installPager(Object.assign({ log, hfToken: tok }, m)); },
    remove() { return require("./pagerAddon").remove(); } },
  // 2.730.0 (Tim: "https://flowhmr.github.io/ . we can add a reference video for motion?" + "add it to addons with a
  // disclaimer that it is for non commercial use only"): FlowHMR motion capture in its own venv (lib/flowhmrAddon.js)
  { id: "flowhmr", label: "FlowHMR motion capture (non-commercial use only)",
    for: "🕺 Motion in the preview bar: a video of a person becomes 3D motion - an animated skeleton (.fbx) and SMPL-H (.npz) in the project's models3d, for the timeline's 3D layers, Blender, Daz or Unreal. ⚠ NON-COMMERCIAL USE ONLY: it needs the SMPL-H body model and Meta's SAM 3D Body / VGGT-Omega, whose licences forbid commercial use",
    needs: "an NVIDIA GPU (up to ~30 GB VRAM for a moving camera - less with a still camera or a camera every 10 frames); the app's Python 3.10 - 3.12; git (Settings ▸ General ▸ Setup); YOUR Hugging Face token with access to facebook/VGGT-Omega and facebook/sam-3d-body-dinov3, and the SMPL-H model from mano.is.tue.mpg.de (you register and put it in place - the links below)",
    size: "~8 GB (PyTorch + its packages in its own venv, the code) + the models (~6 GB: FlowHMR 0.46B, YOLOX, VGGT-Omega, SAM 3D Body)",
    links: () => require("./flowhmrAddon").LINKS,
    status() { return require("./flowhmrAddon").status(); },
    install() { const m = machine(); const tok = ((core.getConfig() || {}).hf || {}).token || ""; return (log) => require("./flowhmrAddon").installFlowhmr(Object.assign({ log, hfToken: tok }, m)); },
    remove() { return require("./flowhmrAddon").remove(); } },
  // 2.729.0 (Tim: "can u add this please https://chendaryen.github.io/NitroFusion2.github.io/"): NitroFusion2's files from
  // ChenDY/NitroFusion2 + Z-Image-Turbo's text encoder - ComfyUI's own nodes run it (lib/nf2Addon.js)
  { id: "nf2", label: "NitroFusion2 (image model, 1-2 steps)",
    for: "The NitroFusion2 image styles: Z-Image-Turbo distilled to 1-2 steps - sharp text and fine detail in one step (1 step, 2 steps with its de-distillation LoRA, or GGUF for smaller cards)",
    needs: "ComfyUI (its own nodes - no node pack; ComfyUI-GGUF only for the GGUF files, installed here); about 16 GB of VRAM with bf16, less with GGUF",
    get size() { const M = require("./nf2Addon"); return "the files you tick: " + M.ITEMS.map((i) => `${i.label.replace(/ \(.*\)$/, "")} ${require("./aiFillAddon").fmt(i.files.reduce((s, id) => s + ((require("./setupModels").byId(id) || {}).size || 0), 0))}`).join(", "); },
    status() { return require("./nf2Addon").status(); },
    install(opts) { const picks = (opts || {}).items; return (log) => require("./nf2Addon").install(log, picks); },
    remove() { return (log) => require("./nf2Addon").remove(log); } },
  // 2.890.0 (Tim: "can you add this to our video models https://huggingface.co/Comfy-Org/PAN2"): PAN 2's files from
  // Comfy-Org/PAN2 - ComfyUI's own nodes run it since 0.46.0, no node pack (lib/pan2Addon.js)
  { id: "pan2", label: "PAN 2 (video world model, up to 20 s)",
    for: "The PAN 2 video style: MBZUAI's 29B world model - text, or a first picture + text, becomes a video at 24 fps (1248 x 704, 10 s by default, up to 20 s); your words are written into PAN 2's own structured caption by the LLM",
    needs: "ComfyUI 0.46.0 or newer (its own PAN 2 support - ⤓ Update ComfyUI); a 32 GB card for the int8 model (RTX 5090; ComfyUI moves what does not fit to RAM, slowly), 80 GB+ for bf16; an LLM to write the caption. Apache-2.0",
    get size() { const M = require("./pan2Addon"); return "the sets you tick: " + M.ITEMS.map((i) => `${i.label.replace(/ \(.*\)$/, "")} ${require("./aiFillAddon").fmt(i.files.reduce((s, id) => s + ((require("./setupModels").byId(id) || {}).size || 0), 0))}`).join(", ") + " (the text encoder + VAE once)"; },
    status() { return require("./pan2Addon").status(); },
    install(opts) { const picks = (opts || {}).items; return (log) => require("./pan2Addon").install(log, picks); },
    remove() { return (log) => require("./pan2Addon").remove(log); } },
  // 2.918.0 (Tim: "https://meigen-ai.github.io/LongCat-Video-Avatar-1.6-Page/, can you add this"): LongCat-Video-Avatar 1.6 -
  // PedroMarinhoDev's node pack + his single-file copies of the release (lib/longcatAddon.js)
  { id: "longcat", label: "LongCat Avatar 1.6 (a person talking / singing to a sound)",
    for: "The LongCat Avatar 1.6 video style: Meituan LongCat's audio-driven avatar model - a picture of the person (or just the prompt) and the speech (or a song's vocals) become a lip-synced video as long as the sound, 25 fps, 480p or 720p; holds up past 10 minutes",
    needs: "ComfyUI 0.44 or newer, git for the node pack (ComfyUI-LongCat-Avatar, GPL-3.0); a 24-32 GB NVIDIA card for the int8 model (12-16 GB with W4A8); ComfyUI restarted once after installing. Model weights MIT",
    get size() { const M = require("./longcatAddon"), f = require("./aiFillAddon").fmt, sz = (id) => (M.ITEMS.find((i) => i.id === id).files || []).reduce((s, x) => s + ((require("./setupModels").byId(x) || {}).size || 0), 0);
      return `the DiT you tick (int8 ${f(sz("int8"))}, W4A8 ${f(sz("w4a8"))}, bf16 ${f(sz("bf16"))}) + the LoRAs, Whisper, umT5 and VAE ${f(sz("loras") + sz("whisper") + sz("te") + sz("vae"))} (umT5 / VAE skipped when you have them)`; },
    links: () => [{ kind: "pack", label: "ComfyUI-LongCat-Avatar (GitHub)", url: "https://github.com/PedroMarinhoDev/ComfyUI-LongCat-Avatar", dest: "ComfyUI/custom_nodes" },
                  { kind: "model", label: "LongCat-Video-Avatar 1.6 for ComfyUI (DiT, LoRAs, Whisper)", url: "https://huggingface.co/PedroMarinhoDev/LongCat-Video-Avatar-1.6-ComfyUI", dest: "ComfyUI/models" },
                  { kind: "model", label: "umt5_xxl_fp8_e4m3fn_scaled.safetensors + wan_2.1_vae.safetensors", url: "https://huggingface.co/Comfy-Org/Wan_2.1_ComfyUI_repackaged/tree/main/split_files", dest: "ComfyUI/models/text_encoders + vae" }],
    status() { return require("./longcatAddon").status(); },
    install(opts) { const picks = (opts || {}).items; return (log) => require("./longcatAddon").install(log, picks); },
    remove() { return (log) => require("./longcatAddon").remove(log); } },
  // 2.949.0 (Tim: "is this worth adding? https://github.com/D3voz/openjutsu" -> "lets do it"): the ⇄ Swap dialog's OpenJutsu
  // engine - its node packs + files (lib/openjutsuAddon.js); OpenJutsu's workflows ship with bitGen (comfy_workflows/openjutsu)
  { id: "openjutsu", label: "OpenJutsu swap (the ⇄ Swap dialog's OpenJutsu engine)",
    for: "Swap the people (1-4, each with a role) or the things in a video: SAM 3.1 follows them, a grey mannequin carries their movement and MiniMax H3 repaints only them - the rest of the shot and the sound stay. Also 👁 Check mask, 🎨 Fix colours and (opt-in) 🙂 Fix faces. OpenJutsu by D3voz (MIT); about 6-13 min for 6 s at 480p on a 16 GB card",
    needs: "ComfyUI 0.41.2 or newer (its own MiniMax H3, SAM 3.1 and text-generation nodes - ⤓ Update ComfyUI), git for the node packs (GPL-3.0 / MIT), a 16 GB+ NVIDIA card; ComfyUI restarted once after installing. MiniMax H3 weights: the MiniMax H3 Community License; SAM 3.1: the SAM License. 🙂 Fix faces is opt-in: InsightFace buffalo_l is non-commercial research only, the YOLO detectors AGPL-3.0",
    get size() { const M = require("./openjutsuAddon"), f = require("./aiFillAddon").fmt, sz = (id) => (M.ITEMS.find((i) => i.id === id).files || []).reduce((s, x) => s + ((require("./setupModels").byId(x) || {}).size || 0), 0);
      return `DMAD ${f(sz("dmad"))} + SAM 3.1 ${f(sz("sam"))}; MiniMax H3 (model, text encoder, VAEs, describer) only when ComfyUI has none: up to ${f(sz("h3") + sz("te") + sz("vae") + sz("describer"))}; 🙂 Fix faces ${f(sz("face"))}`; },
    links: () => [{ kind: "pack", label: "OpenJutsu (GitHub - its workflows ship with bitGen)", url: "https://github.com/D3voz/openjutsu", dest: "bitGen comfy_workflows/openjutsu" },
                  { kind: "pack", label: "comfyui-h3-oneclick-swap", url: "https://github.com/D3voz/comfyui-h3-oneclick-swap", dest: "ComfyUI/custom_nodes" },
                  { kind: "model", label: "DMAD 4-step LoRA (Kijai/MiniMax-H3-experimental)", url: "https://huggingface.co/Kijai/MiniMax-H3-experimental/tree/main/loras", dest: "ComfyUI/models/loras" },
                  { kind: "model", label: "SAM 3.1 multiplex fp16 (Comfy-Org/sam3.1)", url: "https://huggingface.co/Comfy-Org/sam3.1", dest: "ComfyUI/models/checkpoints" }],
    status() { return require("./openjutsuAddon").status(); },
    install(opts) { const picks = (opts || {}).items; return (log) => require("./openjutsuAddon").install(log, picks); },
    remove() { return (log) => require("./openjutsuAddon").remove(log); } },
  // 2.728.0 (Tim: "add https://github.com/kopperx/RelayVSR"): RelayVSR's files from Comfy-Org/RelayVSR - ComfyUI's own
  // nodes run it, no node pack (lib/relayvsrAddon.js)
  { id: "relayvsr", label: "RelayVSR (video upscaling x2 / x4)",
    for: "🔁 RelayVSR in the preview bar and the video docker's ⚙ Upscaler: a one-step video upscaler (Wan 2.2 on every 15th frame, a small decoder for the rest) - the x2 is trained on MiniMax H3 clips, 1920 × 1080 from a 960x544 render",
    needs: "ComfyUI newer than the v0.44.0 release (its own RelayVSR nodes since 5 Nov 2026 - ⤓ Update ComfyUI, \"latest\"); an NVIDIA GPU",
    get size() { const M = require("./relayvsrAddon"); return "the pairs you tick: " + M.ITEMS.map((i) => `${i.label.replace(/ \(.*\)$/, "")} ${require("./aiFillAddon").fmt(i.files.reduce((s, id) => s + ((require("./setupModels").byId(id) || {}).size || 0), 0))}`).join(", "); },
    status() { return require("./relayvsrAddon").status(); },
    install(opts) { const picks = (opts || {}).items; return (log) => require("./relayvsrAddon").install(log, picks); },
    remove() { return (log) => require("./relayvsrAddon").remove(log); } },
  // 2.678.0 (Tim: "please add this image edit model, https://huggingface.co/PrunaAI/P-H3-Image-Comfy"): P-H3 Image's files
  // (PrunaAI/P-H3-Image-Comfy) on the MiniMax H3 transformer the video already uses (lib/ph3Addon.js)
  { id: "ph3", label: "P-H3 Image (image + edit model)",
    for: "The P-H3 Image styles (PrunaAI on MiniMax H3): text to image at 4-8 MP and editing with up to 8 pictures - its own prompt upsampler writes the full prompt",
    needs: "ComfyUI with the P-H3 nodes (master / the nightly - the next release, 0.44; no node pack); about 21-31 GB of VRAM at 8 MP, NVIDIA Ampere or newer for its int8 / w4a8 files; the MiniMax H3 Community License",
    get size() { const M = require("./ph3Addon"); return "about " + require("./aiFillAddon").fmt(M.ITEMS.filter((i) => i.id !== "h3").reduce((s, i) => s + i.files.reduce((t, id) => t + ((require("./setupModels").byId(id) || {}).size || 0), 0), 0)) + " (LoRA, text encoder, VAE, prompt upsampler) + the MiniMax H3 FL2VA transformer (22.5 GB) if you do not have it yet"; },
    status() { return require("./ph3Addon").status(); },
    install(opts) { const picks = (opts || {}).items; return (log) => require("./ph3Addon").install(log, picks); },
    remove() { return (log) => require("./ph3Addon").remove(log); } },
  // 2.582.0 (Tim: "please add fibo to the model edit tools https://huggingface.co/realrebelai/Fibo-2.0_GGUFs/tree/main. this
  // model should work with very low vram"): Fibo 2.0's files (lib/fiboAddon.js)
  { id: "fibo", label: "Fibo 2.0 (image editing, low VRAM)",
    for: "The Fibo 2.0 styles: Edit Turbo edits a picture from an instruction in 4 steps (the image editor's ✨ AI ▸ Edit, up to 4 pictures <image_1>..<image_4>); Dev makes and edits pictures - Bria's 8B model",
    needs: "ComfyUI from 21 Oct 2026 or later (its own Fibo 2.0 nodes); about an 8 GB card with the w4a8 or GGUF Q4_0 file (ComfyUI moves the rest to RAM); ComfyUI-GGUF for a .gguf (installed when you tick one). The weights are CC BY-NC 4.0 - non-commercial use only",
    get size() { const M = require("./fiboAddon"); return "the files you tick: " + M.ITEMS.map((i) => `${i.label.replace(/ \(.*\)$/, "")} ${require("./aiFillAddon").fmt(i.files.reduce((s, id) => s + ((require("./setupModels").byId(id) || {}).size || 0), 0))}`).join(", "); },
    status() { return require("./fiboAddon").status(); },
    install(opts) { const picks = (opts || {}).items; return (log) => require("./fiboAddon").install(log, picks); },
    remove() { return (log) => require("./fiboAddon").remove(log); } },
  // 2.573.0 (Tim: "please add this workflow https://www.fasth3-omni.com/en, fasth3 omni"): FastH3 Omni's model from
  // FastVideo/FastH3-Omni-Comfy + H3's shared encoder / VAEs when missing (lib/fasth3Addon.js)
  { id: "fasth3", label: "FastH3 Omni (video model, 8 steps)",
    for: "The FastH3 Omni video style and StoryBoard Workflow: MiniMax H3's reference-to-video (pictures, videos, voices -> video with sound) distilled to 8 steps by FastVideo - several times faster than H3's own",
    needs: "ComfyUI 0.43 or later (its own nodes - no node pack; Settings ▸ ComfyUI ▸ ⤓ Update ComfyUI); about the VRAM of MiniMax H3's int8 model (a 24-32 GB card). The weights carry the MiniMax H3 Community License",
    get size() { const M = require("./fasth3Addon"); return "the files you tick: " + M.ITEMS.map((i) => `${i.label.replace(/ \(.*\)$/, "")}${/\(/.test(i.label) ? " " + i.label.match(/\(([^)]*)\)/)[1] : ""} ${require("./aiFillAddon").fmt(i.files.reduce((s, id) => s + ((require("./setupModels").byId(id) || {}).size || 0), 0))}`).join(", ") + " (the shared H3 files only when missing)"; },
    status() { return require("./fasth3Addon").status(); },
    install(opts) { const picks = (opts || {}).items; return (log) => require("./fasth3Addon").install(log, picks); },
    remove() { return (log) => require("./fasth3Addon").remove(log); } },
  // 2.708.0 (Tim: "this workflow is meant to work with 16gb vram - minimax"): 16 GB mode's files - the two LoRAs of
  // each pass and the H3 latent upscaler (lib/vram16.js; the switch: Settings ▸ ComfyUI ▸ 16 GB mode)
  { id: "vram16", label: "16 GB mode (MiniMax H3 on a 16 GB card)",
    for: "MiniMax H3 renders on a 16 GB card, as DENO's R2V Turbo 8+2 does it: the text encoder leaves VRAM before sampling, pass 1 in 8 steps at your size, then a latent upscale and 2 refine steps with sparse attention - the sound from pass 1 kept",
    needs: "a ComfyUI with MiniMax H3 and Sol attention (0.43 or later); the DENO custom nodes and the H3 latent upscaler nodes (Settings ▸ ComfyUI ▸ 16 GB mode installs them). LoRAs by Kijai and drbaph, the latent upscaler by LBH - each keeps its own licence",
    get size() { const M = require("./vram16"); return M.ITEMS.map((i) => `${i.label} ${require("./aiFillAddon").fmt(((require("./setupModels").byId(i.file) || {}).size) || 0)}`).join(", "); },
    status() { return require("./vram16").status(); },
    install() { return (log) => require("./vram16").install(log); },
    remove() { return (log) => require("./vram16").remove(log); } },
  // 2.589.0 (Tim: "i suspect the malwarebytes detection is due to the team renderhub ext. i think we remove this from
  // bitgen and give it as an additional addon with notes saying this may trigger virus checkers"): the render farm is the
  // optional extension ext/teamdock, shipped only as its own zip (lib/teamAddon.js)
  { id: "teamdock", label: "Team render farm (optional - may trigger virus checkers)",
    for: "Settings ▸ Team + the status bar's 🖥 Render on: a team on one NAS folder, the leader's daily keys, rendering on another member's PC with their permission (time-limited or unrestricted). No longer part of bitGen - it comes as its own zip, bitgen-ext-teamdock-v<version>.zip",
    get needs() { return "every PC of the team with it installed, the team folder on a NAS (or Tailscale). ⚠ It " + require("./teamAddon").WARN; },
    size: "about 60 KB (the extension zip)",
    zip: { url: "/api/addons/teamdock/install-zip", accept: ".zip", hint: "bitgen-ext-teamdock-v<version>.zip" },
    status() { return require("./teamAddon").status(); },
    install() { return (log) => require("./teamAddon").install(log); },
    installZip(buf) { return (log) => require("./teamAddon").installZip(buf, log); },
    remove() { return (log) => require("./teamAddon").remove(log); } },
  // 2.588.0 (Tim: "add https://enderfga.cn/SolarRenderer/"): SolarRenderer - a structure video (grey boxes, depth,
  // skeletons, sketches ...) -> the finished clip in 4 steps; its node pack + LoRAs on MiniMax H3 (lib/solarAddon.js)
  { id: "solar", label: "SolarRenderer (structure video -> video, 4 steps)",
    for: "Render a STRUCTURE video - grey boxes, a semantic map, skeletons, depth, normals, a body mesh, a sketch - plus an optional first frame and a six-part prompt into the finished clip in 4 steps (Enderfga's control + four-step LoRAs on MiniMax H3). Its workflows come in through Settings ▸ ComfyUI ▸ Graphs ▸ ☀ SolarRenderer (⤒ Import & check)",
    needs: "MiniMax H3's ref2va model, text encoder and VAE (Settings ▸ Setup - the same files the H3 styles use); ComfyUI with MiniMax H3 (v0.30 or later; update it in Settings ▸ ComfyUI); git for the node pack. The weights carry the MiniMax H3 Community License - the EU, the UK, South Korea and the US are excluded territories (NOTICE.md); the code is Apache-2.0",
    size: "the node pack (a few MB) + the LoRAs you tick (sizes read on download)",
    status() { return require("./solarAddon").status(); },
    install(opts) { const picks = (opts || {}).items; return (log) => require("./solarAddon").install(log, picks); },
    remove() { return (log) => require("./solarAddon").remove(log); } },
  // 2.593.0 (Tim: "make facefix and controlnet into addons and put the links to dl in addons tab. only show if they are
  // enabled in the general tab. if they are enabled check for all the models and download them into the correct folder
  // if they do not exist"): shown only while Settings ▸ General switches them on (feature); lib/featureAddons.js
  { id: "facefix", feature: "facefix", get label() { return require("./featureAddons").ADDONS.facefix.label; },
    get for() { return require("./featureAddons").ADDONS.facefix.for; }, get needs() { return require("./featureAddons").ADDONS.facefix.needs; },
    size: "about 52 MB (the face detector) + the node packs",
    links() { return require("./featureAddons").links("facefix"); },
    status() { return require("./featureAddons").status("facefix"); },
    install(opts) { const picks = (opts || {}).items; return (log) => require("./featureAddons").install("facefix", log, picks); },
    remove() { return (log) => require("./featureAddons").remove("facefix", log); } },
  { id: "controlnet", feature: "controlnet", get label() { return require("./featureAddons").ADDONS.controlnet.label; },
    get for() { return require("./featureAddons").ADDONS.controlnet.for; }, get needs() { return require("./featureAddons").ADDONS.controlnet.needs; },
    size: "about 1.7 GB (the preprocessors) + 2.5 GB per SDXL ControlNet (four, about 10 GB) + the node pack",
    links() { return require("./featureAddons").links("controlnet"); },
    status() { return require("./featureAddons").status("controlnet"); },
    install(opts) { const picks = (opts || {}).items; return (log) => require("./featureAddons").install("controlnet", log, picks); },
    remove() { return (log) => require("./featureAddons").remove("controlnet", log); } },
  // 2.592.0 (Tim: "lets just add the regional character lora and prompt relay"): Winnougan's Nougan_Nodes (MIT) - its
  // regional character LoRA (🔲 Zones ▸ 🎭) and Prompt Relay (⏱ timed lines in an LTX prompt) (lib/nouganAddon.js)
  // 2.965.0 (Tim: "is there a local model that will use my voice to sing a song that is already generated" -> "lets get all of
  // them and add them to a dropdown"): the 🎹 Synth tab's 🎤 Sing it in my voice - three engines, each ticked (lib/singVoiceAddon.js)
  { id: "singvoice", label: "🎤 Sing in my voice (singing voice conversion)",
    for: "The 🎹 Synth tab's 🎤 row: the vocal of a song sung again in YOUR voice - the same notes, timing and feeling, only the voice changes. Seed-VC and SoulX-Singer need a 10-30 s clip of your voice; RVC (Applio) trains a model on about 10 minutes of it",
    needs: "the app's Python 3.10 - 3.13, git; an NVIDIA GPU (8 GB or more is plenty - each also runs on the CPU, slowly); Hugging Face for the models. Licences: Seed-VC GPL-3.0 (installed from its own repository, run as its own program), SoulX-Singer Apache-2.0, Applio MIT - use voices you have the right to use, like your own",
    get size() { return "the engines you tick: " + require("./singVoiceAddon").ITEMS.map((i) => `${i.label.replace(/ \(.*\)$/, "")} ${i.size}`).join("; "); },
    links: () => [{ kind: "pack", label: "Seed-VC (GitHub, GPL-3.0)", url: "https://github.com/Plachtaa/seed-vc", dest: "singvoice/seedvc/src" },
                  { kind: "pack", label: "SoulX-Singer (GitHub, Apache-2.0)", url: "https://github.com/Soul-AILab/SoulX-Singer", dest: "singvoice/soulx/src" },
                  { kind: "model", label: "Soul-AILab/SoulX-Singer (model-svc.pt) + SoulX-Singer-Preprocess (rmvpe)", url: "https://huggingface.co/Soul-AILab/SoulX-Singer", dest: "singvoice/soulx/models" },
                  { kind: "pack", label: "Applio (GitHub, MIT)", url: "https://github.com/IAHispano/Applio", dest: "singvoice/rvc/src" }],
    status() { return require("./singVoiceAddon").status(); },
    install(opts) { const picks = (opts || {}).items; return (log) => require("./singVoiceAddon").install(log, picks); },
    remove() { return (log) => require("./singVoiceAddon").remove(log); } },
  // 2.594.0 (Tim: "can you add https://nomorecoding.github.io/Ming-3.0-tts/ as an option for tts ... and add option to use
  // https://underdog.ai/bark as stt engine"): two speech engines in their own venvs (lib/speechAddons.js)
  { id: "ming", label: "Ming-3.0 TTS (speech engine)",
    for: "Speech with Ming-3.0 TTS (inclusionAI, 0.5B, 44.1 kHz) - cloned voices (a clip + its transcript) and designed voices; pick it in Settings ▸ Audio ▸ Speech engine",
    needs: "the app's Python 3.10 - 3.13; an NVIDIA GPU is best (it runs on the CPU, slowly). Its authors test on Linux with CUDA 12.4 - here it gets the CUDA wheels for your card (cu128 on a 50-series)",
    size: "~5 GB (PyTorch + its packages, in its own venv) + the model (~2 GB)",
    links: () => [{ label: "Ming-3.0 TTS (GitHub)", url: "https://github.com/inclusionAI/Ming-3.0-tts", kind: "pack", dest: "ming-tts/src" },
                  { label: "inclusionAI/Ming-3.0-tts-0.5B (Hugging Face)", url: "https://huggingface.co/inclusionAI/Ming-3.0-tts-0.5B", kind: "model", dest: "ming-tts/model" }],
    status() { return require("./speechAddons").mingStatus(); },
    install() { const m = machine(); return (log) => require("./speechAddons").installMing(Object.assign({ log }, m)); },
    remove() { return require("./speechAddons").removeDir("ming"); } },
  { id: "bark", label: "Bark 3.0 speech-to-text (Underdog)",
    for: "Speech to text with Underdog Bark 3.0 (163 MB, from NVIDIA Parakeet) - English only, no word times: plain transcripts, voice clone transcripts, the phone remote and the 🎙 voice chat; lyrics and captions stay on faster-whisper. Pick it in Settings ▸ Audio",
    needs: "the app's Python 3.10 - 3.13; any NVIDIA GPU or the CPU",
    size: "~3 GB (PyTorch in its own venv) + the model (163 MB). License CC-BY-4.0 (its NOTICE is kept beside the model)",
    links: () => [{ label: "ConwayResearch/Underdog-Bark-3.0 (Hugging Face)", url: "https://huggingface.co/ConwayResearch/Underdog-Bark-3.0", kind: "model", dest: "bark-stt/model (model.bark, bark_loader.py, NOTICE)" }],
    status() { return require("./speechAddons").barkStatus(); },
    install() { const m = machine(); return (log) => require("./speechAddons").installBark(Object.assign({ log }, m)); },
    remove() { return require("./speechAddons").removeDir("bark"); } },
  // 2.919.0 (Tim: "https://inworld.ai/open-source#voice-isolator, would this be something we can use to have a conversation
  // with bitgen" -> "go ahead"): Inworld's SAVA + Voice Isolator in their own venv (lib/voiceKitAddon.js, lib/voiceStream.js)
  { id: "voicekit", label: "Voice conversation (SAVA turn detection + Voice Isolator)",
    for: "Talking with bitGen feels like a conversation: the 📱 app's 🎙 Talk and the studio's 🎙 voice chat stream your voice to the PC while you speak - Inworld's SAVA hears when you have FINISHED your sentence (a pause to think no longer cuts you off, a quick \"yes\" is answered at once) and the Voice Isolator takes the room's noise (TV, fans, a car) out before Whisper hears it",
    needs: "the app's Python 3.10 - 3.13; faster-whisper (Settings ▸ Audio) to hear the words; any NVIDIA GPU or the CPU (SAVA alone is light on the CPU). Code and weights Apache-2.0 (Inworld AI)",
    size: "~3 GB (PyTorch in its own venv) + the models (SAVA 51 MB, the Voice Isolator ~250 MB)",
    links: () => [{ label: "inworld-ai/sava (GitHub)", url: "https://github.com/inworld-ai/sava", kind: "model", dest: "voice-kit/.venv (pip) + the Hugging Face cache (inworld/sava)" },
                  { label: "inworld-ai/voice-isolator (GitHub)", url: "https://github.com/inworld-ai/voice-isolator", kind: "model", dest: "voice-kit/.venv (pip) + the Hugging Face cache (inworld/voice-isolator)" }],
    status() { return require("./voiceKitAddon").status(); },
    install() { const m = machine(); return (log) => require("./voiceKitAddon").install(Object.assign({ log }, m)); },
    remove() { return require("./voiceKitAddon").remove(); } },
  // 2.932.0 (the plan agreed at 2.929.0: "the garment designer - GarmentCode"): sewing patterns in their own venv
  // (lib/garmentAddon.js). GarmentCode's drape simulator is NOT used - its NVIDIA Warp fork is non-commercial.
  { id: "garment", label: "Garment designer (GarmentCode sewing patterns)",
    for: "👗 the Garment designer: T-shirts, tops, hoodies, dresses, skirts, trousers, jumpsuits - pick a kind, change it with sliders or describe it in words, and get the sewing pattern made to the display mannequin's (or your own) measurements, as a PDF at actual size to print at home or at a copy shop",
    needs: "the app's Python 3.10 - 3.12 (or uv, which the app's setup brings, makes one); no graphics card. GarmentCode is MIT (Korosteleva et al., ETH Zurich)",
    size: "~150 MB (numpy, scipy, matplotlib and GarmentCode in its own venv)",
    links: () => require("./garmentAddon").LINKS,
    status() { return require("./garmentAddon").status(); },
    install() { const m = machine(); return (log) => require("./garmentAddon").install(Object.assign({ log }, m)); },
    remove() { return require("./garmentAddon").remove(); } },
  { id: "nougan", label: "Nougan Nodes (🎭 regional character LoRAs + ⏱ Prompt Relay)",
    for: "🎭 two character LoRAs in one picture, each only inside its own boxes (image editor ▸ ✨ AI ▸ 🔲 Zones ▸ ▦ Regional - a box's 🎭 picks its LoRA), and ⏱ Prompt Relay: timed lines in an LTX prompt ([0-2s] the fox sniffs … [2-4s] it looks up) give each stretch of the clip its own words in one render",
    needs: "ComfyUI with git (Settings ▸ General ▸ Setup installs git). The regional LoRA works on FLUX.2 / Krea 2 / Qwen Image type styles with character LoRAs made for that model; Prompt Relay on the LTX 2.3 / 2.5 styles. Kijai's ComfyUI-PromptRelay is enough for Prompt Relay alone. MIT licence",
    size: "the node pack (a few MB) - no model files",
    status() { return require("./nouganAddon").status(); },
    install() { return (log) => require("./nouganAddon").install(log); },
    remove() { return (log) => require("./nouganAddon").remove(log); } },
  // 2.578.0 (Tim: "yes, lets build a solidcraft bridge, but we will put it in it's own docker"): SolidCraft's browser
  // build (open-source parametric 3D CAD, MIT OR Apache-2.0) for the 📐 SolidCraft docker (lib/solidcraftAddon.js)
  { id: "solidcraft", label: "SolidCraft (parametric 3D CAD)",
    for: "The 📐 SolidCraft docker: sketches with constraints, extrude / revolve / sweep / loft, fillets, shells, holes, threads, patterns, sheet metal, assemblies with joints and motion, STEP / IGES / STL / OBJ / 3MF - its pictures and parts go to the image editor, the timeline and the project",
    needs: "nothing else - it runs inside the app (WebAssembly); the download comes from SolidCraft's GitHub releases (or install a zip you downloaded, in the docker)",
    size: "about 20 MB download (about 50 MB unpacked)",
    zip: { url: "/api/solidcraft/install-zip", accept: ".zip", hint: "solidcraft-web-<version>.zip from github.com/tangency-labs/solidcraft/releases" },
    status() { return require("./solidcraftAddon").status(); },
    install(opts) { return (log) => require("./solidcraftAddon").install(log, opts || {}); },
    remove() { return (log) => require("./solidcraftAddon").remove(log); } },
  // 2.581.0 (Tim: "yes, please build your suggestion" - models that make parts for SolidCraft): ✨ Generate in the 📐
  // SolidCraft docker - CadQuery runs the part's code (always), cadrille writes it from text / a picture (lib/cadGen.js)
  { id: "cadgen", label: "CAD generate (✨ Generate in SolidCraft)",
    for: "✨ Generate in the 📐 SolidCraft docker: describe a part (or give a picture) and it comes into SolidCraft as editable sketches, extrudes, holes and fillets - cadrille writes it, or the app's local LLM",
    needs: "the app's Python 3.9 - 3.13; for cadrille an NVIDIA GPU (8 GB) is best. cadrille (github.com/col14m/cadrille): its code is Apache-2.0, its weights CC BY-NC 4.0 (non-commercial use only) - downloaded from Hugging Face on the install, not shipped with the app (NOTICE.md)",
    size: "CadQuery about 400 MB; cadrille about 3 GB (PyTorch) + 4.5 GB (the model)",
    status() { return require("./cadGen").addonStatus(); },
    install(opts) { const picks = (opts || {}).items; return (log) => require("./cadGen").install(log, picks); },
    remove() { return (log) => require("./cadGen").remove(log); } },
  // 2.586.0 (Tim: "what would be the best llm base to build our checkpoint, add it as a download in addons in a dropdown
  // called llm"): the chat / writing LLMs as ONE dropdown - the .gguf into the LLM folder (lib/llmAddon.js)
  { id: "llm", label: "LLM", select: true,
    for: "The prompt docker's LLM - chat, ✨ Enhance, screenplays, songs, 🔁 Compare LLMs - and the base of your own checkpoint (🎓 LoRA trainer ▸ an LLM job). ★ Qwen3.8 27B is the one we recommend building on",
    needs: "llama.cpp (misc\\get-llama.ps1 - recent for Qwen3.8 / Gemma 4); the VRAM of the file you pick (it runs on the LLM's GPU - Settings ▸ LLM)",
    get size() { return "the one you pick: from 2.5 GB (Qwen3 4B) to 29 GB (Qwen3.8 27B Q8_0)"; },
    status() { return require("./llmAddon").status(); },
    install(opts) { const picks = (opts || {}).items; return (log) => require("./llmAddon").install(log, picks); },
    remove(opts) { const picks = (opts || {}).items; return (log) => require("./llmAddon").remove(log, picks); } },
  // 2.595.0 (Tim: "can we add https://tencent.github.io/WeVisOne-VL/, add it to addons to dl, dl it to the llm vision folder
  // set by the user"): a dropdown like LLM - the GGUF + its projector into the vision folder (lib/visionAddon.js)
  { id: "wevisone", label: "WeVisOne-VL (vision model)", select: true, folder: "the vision folder",
    for: "Tencent's WeVisOne-VL (built on Qwen3-VL, Apache-2.0) as the prompt docker's vision model - 📎 pictures in the prompt are read and described for the LLM (text in pictures, counts, where things are). It goes into your vision models folder (Settings ▸ LLM), its own subfolder",
    needs: "llama.cpp (a recent one - misc\\get-llama.ps1); the VRAM of the file you pick (it runs on the vision GPU - Settings ▸ LLM)",
    get size() { return "the one you pick: from 2.2 GB (2B Q4_K_M + projector) to 5.6 GB (4B Q8_0 + projector)"; },
    links: () => [{ label: "WeVisOne-VL (Tencent)", url: "https://tencent.github.io/WeVisOne-VL/", kind: "pack", dest: "the project page" },
                  { label: "mradermacher/WeVisOne-VL-4B-GGUF", url: "https://huggingface.co/mradermacher/WeVisOne-VL-4B-GGUF", kind: "model", dest: "<vision folder>/WeVisOne-VL-4B" },
                  { label: "mradermacher/WeVisOne-VL-2B-GGUF", url: "https://huggingface.co/mradermacher/WeVisOne-VL-2B-GGUF", kind: "model", dest: "<vision folder>/WeVisOne-VL-2B" }],
    status() { return require("./visionAddon").status(); },
    install(opts) { const picks = (opts || {}).items; return (log) => require("./visionAddon").install(log, picks); },
    remove(opts) { const picks = (opts || {}).items; return (log) => require("./visionAddon").remove(log, picks); } },
  { id: "viggle", label: "Viggle (native)",
    for: "The native Viggle engine for character swaps without ComfyUI (the swap dialog's ⚙ Native)",
    needs: "an NVIDIA GPU; uses the ComfyUI model files it finds",
    size: "its own venv (~6 GB) + only the model files your ComfyUI does not have",
    external: true,
    status() {
      try { const s = require("../routes/native").statusView(); const j = s.job; return { installed: !!s.viggle.ready, note: s.viggle.note || (s.viggle.ready ? "ready" : "not installed"), busy: !!(j && (j.status === "queued" || j.status === "running")) }; }
      catch (e) { return { installed: false, note: "status unavailable: " + e.message }; }
    } },
];

function list() {
  // 2.593.0: an add-on behind a Settings ▸ General switch (Face fix, ControlNet) shows only while it is on
  return LIST.filter((a) => !a.feature || require("./featureAddons").enabled(a.feature)).map((a) => {
    const s = a.status();
    const mine = J && J.id === a.id && J.state === "running";
    return { id: a.id, label: a.label, for: a.for, needs: a.needs, size: a.size, external: !!a.external,
             installed: !!s.installed, note: s.note || "", busy: !!(s.busy || mine),
             items: s.items || undefined,                      // 2.557.0: pick what to download (AI fill models)
             select: !!a.select,                               // 2.586.0: the list is a dropdown - one at a time (LLM)
             zip: a.zip || undefined,                          // 2.579.0: 📦 install from a zip you downloaded (SolidCraft)
             links: typeof a.links === "function" ? a.links() : undefined,   // 2.593.0: the download links (Face fix, ControlNet)
             feature: a.feature || undefined,
             folder: a.folder || undefined,                    // 2.595.0: where a dropdown add-on puts its files (the words)                  // 2.594.0: the links' words (a switch downloads for you)
             actions: a.external ? ["install"] : s.installed ? ["reinstall", "remove"] : ["install"] };
  });
}

/** 2.589.0: an add-on that installs from a zip the page sent (installZip) -> {ok} | {error} */
function startZip(id, buf) {
  const a = LIST.find((x) => x.id === id);
  if (!a || !a.installZip) return { error: "the add-on " + id + " does not install from a zip" };
  return startJob(id, "install", a.installZip(buf));
}

function start(id, action, opts) {   // 2.557.0: opts {items} - what to download (an add-on with a list)
  const a = LIST.find((x) => x.id === id);
  if (!a) return { error: "no add-on " + id };
  if (a.feature && !require("./featureAddons").enabled(a.feature)) return { error: `${a.label} is off - switch it on in Settings ▸ General first` };
  if (a.external) {           // Viggle: its own installer + queue job
    const r = require("../routes/native").install({});
    return r.status >= 400 ? { error: (r.body && r.body.error) || "could not start" } : { ok: true, external: true, job: r.body };
  }
  if (action === "remove") return startJob(id, "remove", a.remove(opts || {}));   // 2.586.0: a dropdown add-on removes the picked one
  // 2.601.0: ⟳ Reinstall / ⟳ Download again ({reinstall: true}) - the files already there are fetched again
  const job = a.install(opts || {});
  return startJob(id, "install", opts && opts.reinstall ? require("./reinstallForce").wrap(job) : job);
}

module.exports = { YUE2, LIST, list, start, startZip, startJob, job, busy, installYue2, torchIndexes, yueDir, yueVenv, yueCli, venvPy, _reset: () => { J = null; } };
