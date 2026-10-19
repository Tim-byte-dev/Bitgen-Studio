// bitGen Studio — lib/hwPlan.js (2.519.0): THE PACKAGE FOR THIS COMPUTER - what it can use, and what setup installs.
// Tim (verbatim): "in the initial setup ask the user for their gfx card, ram and cpu if setup can't detect it. install a
// package with recommendations for the hardware the user has. our package should be a powerful image and video editor
// even without the ai or using smaller models. let me know your thoughts.show the user what they will be able to use and
// if they still want to install"
//
//   ASKED       GPUS (the cards people own, with their memory and CUDA generation) - the wizard's list when setup
//               could not find the card (or its memory), + RAM and CPU; fromAnswers() turns the answers into the same
//               profile lib/setupGpu.detect() makes (profile.manual = true)
//   PACKAGES    editor   the full video + image editor, CAD / 3D sketching, audio, delivery - no ComfyUI, no models
//               light    + ComfyUI and the small models (Anima 2B, SDXL, a 4B assistant, background removal, voices)
//               standard + the mid-size models for a 12-20 GB card (Krea 2 GGUF, FLUX 3 Klein, Kontext, Qwen Image 2.1,
//                          MiniMax H3 at a small size, MiniMax Music 3, SeedVR2 3B)
//               full     + everything the studio has for a 20 GB+ card (setupTune.recommend - H3 at full size, Qwen
//                          Image Edit ...) + Krea 2, FLUX.2 Klein 9B, SeedVR2 7B
//   recommend() the package for the profile: no usable GPU -> editor, under 12 GB -> light, 12-20 GB -> standard,
//               20 GB+ -> full
//   capabilities(profile, pkg)  every feature as a row: what it is, ✓ yes / ~ slow or limited / ✗ no on THIS computer
//               (and why), and whether the package installs it or it can be added later (Settings -> Models)
//   The editing rows never need a GPU. The AI rows' VRAM needs are ESTIMATES (they say so).
// Pure (scripts/test-hw519.js).
"use strict";

/** cards people own: id -> {vendor, name, vram_gb, cc (NVIDIA compute capability)} */
const GPUS = [
  ["rtx5090", "nvidia", "GeForce RTX 5090", 32, 12], ["rtx5080", "nvidia", "GeForce RTX 5080", 16, 12], ["rtx5070ti", "nvidia", "GeForce RTX 5070 Ti", 16, 12],
  ["rtx5070", "nvidia", "GeForce RTX 5070", 12, 12], ["rtx5060ti16", "nvidia", "GeForce RTX 5060 Ti 16 GB", 16, 12], ["rtx5060ti8", "nvidia", "GeForce RTX 5060 Ti 8 GB", 8, 12],
  ["rtx5060", "nvidia", "GeForce RTX 5060", 8, 12], ["rtx4090", "nvidia", "GeForce RTX 4090", 24, 8.9], ["rtx4080", "nvidia", "GeForce RTX 4080 / 4080 Super", 16, 8.9],
  ["rtx4070tis", "nvidia", "GeForce RTX 4070 Ti Super", 16, 8.9], ["rtx4070ti", "nvidia", "GeForce RTX 4070 Ti", 12, 8.9], ["rtx4070", "nvidia", "GeForce RTX 4070 / 4070 Super", 12, 8.9],
  ["rtx4060ti16", "nvidia", "GeForce RTX 4060 Ti 16 GB", 16, 8.9], ["rtx4060ti8", "nvidia", "GeForce RTX 4060 Ti 8 GB", 8, 8.9], ["rtx4060", "nvidia", "GeForce RTX 4060", 8, 8.9],
  ["rtx3090", "nvidia", "GeForce RTX 3090 / 3090 Ti", 24, 8.6], ["rtx3080ti", "nvidia", "GeForce RTX 3080 Ti", 12, 8.6], ["rtx3080", "nvidia", "GeForce RTX 3080 (10 GB)", 10, 8.6],
  ["rtx3070", "nvidia", "GeForce RTX 3070 / 3070 Ti", 8, 8.6], ["rtx3060", "nvidia", "GeForce RTX 3060 (12 GB)", 12, 8.6], ["rtx3060ti", "nvidia", "GeForce RTX 3060 Ti", 8, 8.6],
  ["rtx2080ti", "nvidia", "GeForce RTX 2080 Ti", 11, 7.5], ["rtx2060", "nvidia", "GeForce RTX 2060 / 2070 / 2080", 8, 7.5], ["gtx1660", "nvidia", "GeForce GTX 1660 / 1650", 6, 7.5],
  ["rtxpro6000", "nvidia", "RTX PRO 6000 Blackwell", 96, 12], ["rtx6000ada", "nvidia", "RTX 6000 Ada", 48, 8.9], ["rtxa6000", "nvidia", "RTX A6000", 48, 8.6],
  ["rx9070xt", "amd", "Radeon RX 9070 / 9070 XT", 16, 0], ["rx7900xtx", "amd", "Radeon RX 7900 XTX", 24, 0], ["rx7900xt", "amd", "Radeon RX 7900 XT", 20, 0],
  ["rx7800xt", "amd", "Radeon RX 7800 XT / 7700 XT", 16, 0], ["rx7600", "amd", "Radeon RX 7600 / 6600", 8, 0], ["rx6800", "amd", "Radeon RX 6800 / 6900", 16, 0],
  ["arcb580", "intel", "Intel Arc B580 / B570", 12, 0], ["arca770", "intel", "Intel Arc A770", 16, 0],
  ["apple", "apple", "Apple Silicon (M1 - M5) - shares the system RAM", 0, 0],
  ["igpu", "none", "No graphics card (built-in graphics only)", 0, 0],
  ["other", "other", "Another card - I'll type its memory", 0, 0],
].map(([id, vendor, name, vram_gb, cc]) => ({ id, vendor, name, vram_gb, cc }));

/** the wizard's answers {gpu: id, vram_gb?, gpu_name?, ram_gb, cpu, cores?} -> a lib/setupGpu profile (manual);
 *  `base` = the detected profile: what was not answered comes from it (a detected NVIDIA card stays when gpu is "") */
function fromAnswers(a, platform, base) {
  const Gpu = require("./setupGpu");
  const o = Object.assign({}, a || {});
  const b = base || null;
  if (b) {
    if (!(+o.ram_gb > 0) && b.ram_gb) o.ram_gb = b.ram_gb;
    if (!o.cpu && b.cpu && b.cpu.model) { o.cpu = b.cpu.model; o.cores = b.cpu.cores; }
    if (!o.gpu && b.gpus && b.gpus.length) {
      const ram = +o.ram_gb || 0, cpu = { model: String(o.cpu || "").slice(0, 120), cores: +o.cores || 0 };
      return Gpu.profile(b.gpus.map((g) => Object.assign({}, g, (g.vram_mb || !(+o.vram_gb > 0)) ? {} : { vram_mb: Math.round(+o.vram_gb * 1024) })),
        ram * 1073741824, platform || process.platform, { cpu, manual: true });
    }
  }
  const g = GPUS.find((x) => x.id === o.gpu) || null;
  const vram = Math.max(0, Math.min(256, +o.vram_gb || (g ? g.vram_gb : 0)));
  const gpus = [];
  if (g && g.vendor !== "none") gpus.push({ vendor: g.vendor === "other" ? (Gpu.vendorOf(o.gpu_name || "") || "other") : g.vendor, index: 0,
    name: g.id === "other" ? String(o.gpu_name || "graphics card").slice(0, 80) : g.name, vram_mb: Math.round(vram * 1024), cc: g.cc || 0, driver: "",
    unified: g.vendor === "apple" });
  const ram = Math.max(0, Math.min(4096, +o.ram_gb || 0));
  const cpu = { model: String(o.cpu || "").slice(0, 120).trim(), cores: Math.max(0, Math.min(512, +o.cores || 0)) };
  const p = Gpu.profile(gpus, ram * 1073741824, platform || process.platform, { cpu, manual: true });
  return p;
}

/** a profile's usable AI memory: the NVIDIA card's VRAM; Apple: ~70 % of the shared RAM; AMD / Intel: their VRAM (not CUDA) */
function aiMemory(p) {
  if (!p) return { gb: 0, kind: "none" };
  if (p.cuda && p.vram_gb > 0) return { gb: p.vram_gb, kind: "cuda" };
  const other = (p.gpus || []).find((g) => g.vendor !== "nvidia");
  if (other && other.vendor === "apple") return { gb: Math.round((p.ram_gb || 0) * 0.7), kind: "apple" };
  if (other && (other.vendor === "amd" || other.vendor === "intel") && other.vram_mb > 0) return { gb: Math.round(other.vram_mb / 102.4) / 10, kind: other.vendor };
  return { gb: 0, kind: "none" };
}

/* every feature: what it needs. Editing rows need nothing but the app. AI rows:
   cpu  "slow" = it runs on the CPU, slowly; "no" = it needs a GPU
   yes  GB of (NVIDIA) VRAM for ✓; lim = GB for ~ (smaller size / quantized / shorter); ram = GB of system RAM it needs
   pkg  the first package that installs it (lighter packages: "add it later") */
const FEATURES = [
  { id: "ed_video", group: "Editing - always", label: "Video editor: timeline, cuts and ripple edits, transitions, keyframes on any setting, speed and time remapping, colour grading and LUTs, effects and adjustment layers, masks and point / planar tracking, titles and text templates, motion blur, multi-camera, nesting, proxies, captions", edit: true },
  { id: "ed_image", group: "Editing - always", label: "Image editor: layers, selections, painting and retouching, transforms and warps, smart objects, adjustments, filters and layer styles, type, pen and vector masks, artboards, actions; PSD, JXL and AVIF files", edit: true },
  { id: "ed_cad", group: "Editing - always", label: "CAD and 3D: sketch layers with constraints and dimensions, parametric 3D bodies, 3D layers and a 3D camera on the timeline, DXF / SVG", edit: true },
  { id: "ed_audio", group: "Editing - always", label: "Sound: mixing, waveform and spectrum layers, beats to keyframes, karaoke captions", edit: true },
  { id: "ed_out", group: "Editing - always", label: "Delivery: compile and export (ffmpeg), Lottie, exchange with other editors (XML), the Blender, Daz Studio and Unreal Engine bridges", edit: true },
  { id: "ai_stt", group: "AI that runs on any computer", label: "Speech to text: transcripts, lyric timing, talking to the assistant (faster-whisper)", cpu: "yes", yes: 4, pkg: "light", gb: 1.5 },
  { id: "ai_cut", group: "AI that runs on any computer", label: "AI background removal and cut-out (rembg)", cpu: "yes", yes: 4, pkg: "light", gb: 0.4 },
  { id: "ai_llm", group: "AI that runs on any computer", label: "The assistant: screenplays, the prompt chat, ✨ Enhance (Qwen3 4B - 8B)", cpu: "slow", yes: 6, pkg: "light", models: ["llm_4b"], ram: 8 },
  { id: "ai_voice", group: "AI that runs on any computer", label: "Voices: text to speech and voice cloning (OmniVoice)", cpu: "slow", yes: 6, pkg: "light", models: ["omnivoice"] },
  { id: "img_small", group: "Pictures", label: "Image generation with small models: Anima 2B (anime), SDXL", cpu: "no", yes: 8, lim: 6, apple: "slow", pkg: "light", models: ["anima_aesthetic", "anima_te", "qwen_vae", "sdxl"], ram: 16 },
  { id: "img_mid", group: "Pictures", label: "Image generation with mid-size models: Krea 2 (GGUF), FLUX 3 Klein", cpu: "no", yes: 12, lim: 10, pkg: "standard", models: ["krea2_turbo_gguf", "krea2_te", "qwen_vae", "flux3_klein", "flux3_te"], ram: 16 },
  { id: "img_big", group: "Pictures", label: "Image generation with the big models: Krea 2 (full), FLUX.2 Klein 9B", cpu: "no", yes: 20, lim: 16, pkg: "full", models: ["krea2_turbo", "krea2_te", "klein9b", "klein_te", "flux2_vae"], ram: 32 },
  { id: "img_edit", group: "Pictures", label: "AI picture editing: Kontext, ✨ Regenerate / infill, Qwen Image 2.1 (✎ First frame)", cpu: "no", yes: 16, lim: 12, pkg: "standard", models: ["kontext", "flux_clip_l", "flux_t5", "flux_ae", "qwen21", "qwen21_te", "qwen21_vae"], ram: 32 },
  { id: "img_qedit", group: "Pictures", label: "Qwen Image Edit (instruction edits in the image editor)", cpu: "no", yes: 24, lim: 20, pkg: "full", models: ["qwen_edit", "qwen_te", "qwen_vae", "qwen_lightning"], ram: 32 },
  { id: "img_3d", group: "Pictures", label: "A picture to a 3D model (Hunyuan3D 2.1, TRELLIS.2)", cpu: "no", yes: 16, lim: 12, pkg: "full", models: ["hunyuan3d21", "birefnet"], ram: 32 },
  { id: "vid_h3", group: "Video", label: "Video generation with MiniMax H3 (scenes, references, first / last frame, the StoryBoard)", cpu: "no", yes: 24, lim: 14, pkg: "standard", ram: 32, h3: true },
  { id: "vid_ltx", group: "Video", label: "Video generation with LTX 2.5 (GGUF for 8-16 GB cards)", cpu: "no", yes: 16, lim: 12, pkg: "full", models: ["ltx25_gguf", "ltx25_te", "ltx25_vvae", "ltx25_avae"], ram: 32 },
  { id: "vid_swap", group: "Video", label: "Character swap and Viggle-Animate", cpu: "no", yes: 24, lim: 20, pkg: "full", ram: 64 },
  { id: "vid_up", group: "Video", label: "AI upscaling (SeedVR2 3B / 7B)", cpu: "no", yes: 16, lim: 8, pkg: "standard", models: ["seedvr2_3b", "seedvr2_vae"], ram: 16 },
  { id: "vid_dlss", group: "Video", label: "DLSS 5 enhance / frame generation (NVIDIA RTX only)", cpu: "no", yes: 8, lim: 6, rtx: true, pkg: "standard" },
  { id: "mus_gen", group: "Music", label: "Song generation (MiniMax Music 3, YuE2)", cpu: "no", yes: 16, lim: 10, pkg: "standard", models: ["music3_dit", "music3_te", "music3_vae", "yue2"], ram: 32 },
  { id: "mus_stems", group: "Music", label: "Stems: split a song into vocals / drums / bass / other", cpu: "slow", yes: 4, pkg: "light" },
];
const PACKAGES = [
  { id: "editor", label: "Editor", tag: "no AI", blurb: "The full video and image editor, CAD and 3D sketching, sound and delivery. No ComfyUI, no models - starts in minutes on any computer.", comfy: false },
  { id: "light", label: "Editor + small AI", tag: "6-12 GB card", blurb: "Everything in Editor, plus ComfyUI and the small models: Anima and SDXL pictures, background removal, speech to text, voices, a small assistant.", comfy: true },
  { id: "standard", label: "Editor + mid-size AI", tag: "12-20 GB card", blurb: "Everything in Editor + small AI, plus Krea 2 / FLUX 3 Klein pictures, Kontext and Qwen 2.1 editing, MiniMax H3 video at a smaller size, songs, upscaling.", comfy: true },
  { id: "full", label: "Everything", tag: "20 GB+ card", blurb: "The whole studio at full size: MiniMax H3 scenes, Qwen Image Edit, the big image models, LTX 2.5, character swap.", comfy: true },
];
const ORDER = PACKAGES.map((p) => p.id);

/** the package for this computer */
function recommend(p) {
  const m = aiMemory(p);
  if (m.kind === "cuda") return m.gb >= 20 ? "full" : m.gb >= 12 ? "standard" : m.gb >= 6 ? "light" : "editor";
  if (m.kind === "apple") return m.gb >= 16 ? "light" : "editor";
  return "editor";
}

/** one feature on this computer -> {state: "yes"|"slow"|"limited"|"no", why} (pure) */
function stateOf(f, p) {
  if (f.edit) return { state: "yes", why: "" };
  const m = aiMemory(p), ram = (p && p.ram_gb) || 0;
  const ramShort = f.ram && ram > 0 && ram < f.ram ? `needs ${f.ram} GB of system RAM (this computer has ${ram})` : "";
  if (f.rtx && !(m.kind === "cuda" && (p.cc || 0) >= 7.5)) return { state: "no", why: "needs an NVIDIA RTX card" };
  if (m.kind === "cuda") {
    if (m.gb >= f.yes) return ramShort ? { state: "limited", why: ramShort + " - it loads slowly" } : { state: "yes", why: "" };
    if (f.lim && m.gb >= f.lim) return { state: "limited", why: f.h3 ? `${m.gb} GB: shorter scenes at a smaller size (${m.gb >= 20 ? "960x544" : m.gb >= 14 ? "768x432" : "640x352"}, long ones split)` : `${m.gb} GB: a smaller / quantized model, slower` };
    if (f.cpu === "yes" || f.cpu === "slow") return { state: f.cpu === "yes" ? "yes" : "slow", why: f.cpu === "yes" ? "on the CPU" : "too little VRAM - runs on the CPU, slowly" };
    return { state: "no", why: `needs about ${f.lim || f.yes} GB of VRAM (this card has ${m.gb})` };
  }
  if (f.cpu === "yes") return { state: "yes", why: "on the CPU" };
  if (f.cpu === "slow") return { state: "slow", why: m.kind === "apple" ? "on Apple Silicon - slower than an NVIDIA card" : "on the CPU - slow" };
  if (m.kind === "apple" && f.apple) return { state: "slow", why: "on Apple Silicon (Metal) - it works, slowly" };
  if ((m.kind === "amd" || m.kind === "intel") && f.lim && m.gb >= f.lim && !f.h3 && !f.rtx)
    return { state: "limited", why: `${m.kind === "amd" ? "AMD" : "Intel"} card: ComfyUI can run it (AMD on Linux with ROCm; Windows is experimental) - the studio is built and tested on NVIDIA` };
  return { state: "no", why: m.kind === "none" ? "needs a graphics card (NVIDIA, 8 GB+ for pictures)" : "needs an NVIDIA card (CUDA)" };
}

/** every row for the package page: {id, group, label, state, why, included, later} */
function capabilities(p, pkgId) {
  const at = ORDER.indexOf(pkgId);
  return FEATURES.map((f) => {
    const st = stateOf(f, p);
    const included = !!f.edit || (at >= 0 && ORDER.indexOf(f.pkg) <= at && st.state !== "no");
    return { id: f.id, group: f.group, label: f.label, state: st.state, why: st.why, included,
             later: !included && st.state !== "no" };
  });
}

/** the catalog ids the package pre-ticks (only what this computer can run) */
function packageModels(p, pkgId, opts) {
  const Tune = require("./setupTune");
  const at = ORDER.indexOf(pkgId);
  if (at <= 0) return [];
  const ids = new Set();
  for (const f of FEATURES) {
    if (f.edit || !f.models || ORDER.indexOf(f.pkg) > at) continue;
    if (stateOf(f, p).state === "no") continue;
    f.models.forEach((x) => ids.add(x));
  }
  if (at >= ORDER.indexOf("standard") && stateOf(FEATURES.find((f) => f.id === "vid_h3"), p).state !== "no")
    Tune.recommend(p, opts || {}).forEach((x) => ids.add(x));                 // MiniMax H3 + its extras sized for the card
  if (at < ORDER.indexOf("full")) for (const x of ["qwen_edit", "qwen_te", "qwen_lightning"]) ids.delete(x);
  if (opts && opts.omnivoice === false) ids.delete("omnivoice");
  // a smaller card: the 3B upscaler, not the 7B; the 4B assistant beside the video model
  return [...ids];
}
/** bytes of the package's models (from lib/modelCatalog.json) */
function packageBytes(ids, catalog) {
  const by = new Map(((catalog && catalog.models) || []).map((m) => [m.id, +m.size || 0]));
  return (ids || []).reduce((a, id) => a + (by.get(id) || 0), 0);
}
/** the wizard's package page: every package with its rows, models and size; the recommended one */
function plan(p, catalog, opts) {
  const rec = recommend(p);
  return {
    recommended: rec, missing: (p && p.missing) || [], manual: !!(p && p.manual),
    hardware: describe(p),
    packages: PACKAGES.map((k) => {
      const ids = packageModels(p, k.id, opts);
      const rows = capabilities(p, k.id);
      return Object.assign({}, k, { recommended: k.id === rec, models: ids, bytes: packageBytes(ids, catalog),
        counts: { yes: rows.filter((r) => r.included && r.state === "yes").length, limited: rows.filter((r) => r.included && r.state !== "yes").length,
                  no: rows.filter((r) => r.state === "no").length },
        rows, fits: ORDER.indexOf(k.id) <= ORDER.indexOf(rec) });
    }),
  };
}
/** one line each: the card, RAM, CPU */
function describe(p) {
  if (!p) return { gpu: "", ram: "", cpu: "" };
  const m = aiMemory(p);
  const g = p.main ? `${p.main.name} - ${p.vram_gb} GB` : p.other ? `${p.other.name}${p.other.vram_gb ? " - " + p.other.vram_gb + " GB" : ""}` : "no graphics card found";
  return { gpu: g, ram: p.ram_gb ? `${p.ram_gb} GB of RAM` : "", cpu: p.cpu && p.cpu.model ? p.cpu.model + (p.cpu.cores ? ` (${p.cpu.cores} threads)` : "") : "", ai_gb: m.gb, ai_kind: m.kind };
}

module.exports = { GPUS, FEATURES, PACKAGES, ORDER, fromAnswers, aiMemory, recommend, stateOf, capabilities, packageModels, packageBytes, plan, describe };
