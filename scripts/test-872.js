// scripts/test-872.js — 2.872.0: H3 Long Video (lib/h3LongVideo.js, lib/h3LongAddon.js, the style, the retired 30 s run)
"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const os = require("os");
const ROOT = path.join(__dirname, "..");
const L = require("../lib/h3LongVideo");
let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };
const eq = (a, b, m) => { assert.deepStrictEqual(a, b, m); n++; };

const F = (o) => ["FLOAT", o || {}], I = (o) => ["INT", o || {}], B = (o) => ["BOOLEAN", o || {}], S = (o) => ["STRING", o || {}];
function info(o) {
  const x = {
    UNETLoader: { input: { required: { unet_name: [["minimax_h3_t2va_int8.safetensors", L.MODEL_FILE]], weight_dtype: [["default", "fp8_e4m3fn"]] } } },
    CLIPLoader: { input: { required: { clip_name: [["qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors"]], type: [["stable_diffusion", "minimax"]] }, optional: { device: [["default", "cpu"]] } } },
    VAELoader: { input: { required: { vae_name: [["minimax_h3_audio_vae_fp32.safetensors", "minimax_h3_video_vae_fp16.safetensors"]] } } },
    LoadImage: { input: { required: { image: [["a.png", "b.png"], { image_upload: true }] } } },
    CreateVideo: { input: { required: { images: ["IMAGE"], fps: F({ default: 30 }) }, optional: { audio: ["AUDIO"] } } },
    SaveVideo: { input: { required: { video: ["VIDEO"], filename_prefix: S({ default: "video/ComfyUI" }), format: [["auto", "mp4"]], codec: [["auto", "h264"]] } } },
    H3LongVideos: { input: {
      required: { model: ["MODEL"], clip: ["CLIP"], vae: ["VAE"], audio_vae: ["VAE"], prompt: S({ multiline: true, forceInput: false }),
        resolution: [["16:9", "9:16", "1:1", "4:3"]], megapixels: F({ default: 0.5 }), shot_seconds: F({ default: 15 }), steps: I({ default: 8 }),
        cfg: F({ default: 1 }), seed: I({ default: 0 }), shot_length: [["from the beat", "fixed"]], character_memory: S({ multiline: true }),
        verbatim: B({ default: false }), pace: F({ default: 1 }) },
      optional: { first_frame: ["IMAGE"], ref_image_1: ["IMAGE"], ref_image_2: ["IMAGE"], ref_image_3: ["IMAGE"], ref_image_4: ["IMAGE"], ambient_audio: ["AUDIO"] } } },
    H3SLAAttention: { input: { required: { model: ["MODEL"], sparsity_ratio: F({ default: 0.5 }), block_size: [["32", "64"]], enabled: B({ default: false }) } } },
    ModelAttentionBackend: { input: { required: { model: ["MODEL"], attention: [["default", "comfy kitchen attention"]] } } },
    "easy cleanGpuUsed": { input: { required: { anything: ["*", {}] } } },
    RTXVideoSuperResolution: { input: { required: { images: ["IMAGE"],
      resize_type: ["COMFY_DYNAMICCOMBO_V3", { options: [{ key: "scale by multiplier", inputs: { required: { scale: F({ default: 4 }) } } },
                                                         { key: "target resolution", inputs: { required: { width: I({ default: 1920 }), height: I({ default: 1080 }) } } }] }],
      quality: [["LOW", "HIGH", "ULTRA"]] } } },
  };
  for (const k of (o && o.without) || []) delete x[k];
  return x;
}

// 1 readiness
{
  const rd = L.readiness(info());
  ok(rd.ok, "all there -> ready");
  eq(rd.names, { unet: L.MODEL_FILE, clip: "qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors", vvae: "minimax_h3_video_vae_fp16.safetensors", avae: "minimax_h3_audio_vae_fp32.safetensors" }, "the files picked by name");
  const r2 = L.readiness(info({ without: ["H3LongVideos", "H3SLAAttention"] }));
  ok(!r2.ok && r2.missing.some((m) => /H3-LongVideos/.test(m)), "no node -> the pack is missing");
  ok(r2.warnings.some((w) => /H3SLAAttention/.test(w)), "no SLA -> a warning, not missing");
  const i3 = info(); i3.UNETLoader.input.required.unet_name = [["minimax_h3_t2va_int8.safetensors"]];
  ok(L.readiness(i3).missing.some((m) => m.includes(L.MODEL_FILE)), "no fused model -> missing by its name");
}
// 2 the graph
{
  const inf = info(), rd = L.readiness(inf);
  const b = L.graph({ info: inf, names: rd.names, prompt: "A.\n\nB.", seed: 7, first: "/x/first.png", refs: ["/x/r1.png", "/x/r2.png"],
    memory: "Ann: <Picture 2>", width: 1280, height: 720, shotSeconds: 15, shotLength: "fixed", upscale2k: true, prefix: "t" });
  const g = b.graph, by = (c) => Object.entries(g).filter(([, v]) => v.class_type === c);
  const [[mid, main]] = by("H3LongVideos");
  eq(main.inputs.prompt, "A.\n\nB.", "the prompt");
  eq(main.inputs.resolution, "16:9", "1280x720 -> 16:9");
  eq(main.inputs.megapixels, 0.92, "megapixels from the size");
  eq(main.inputs.seed, 7, "seed"); eq(main.inputs.shot_length, "fixed", "shot length"); eq(main.inputs.character_memory, "Ann: <Picture 2>", "memory");
  eq(main.inputs.verbatim, true, "the export's values on inputs that exist");
  ok(!("hold_camera" in main.inputs), "an input this version lacks is never written");
  ok(Array.isArray(main.inputs.first_frame) && Array.isArray(main.inputs.ref_image_2) && !("ref_image_3" in main.inputs), "first frame + 2 refs wired, no empty slots");
  eq(b.uploads.map((u) => u.path), ["/x/first.png", "/x/r1.png", "/x/r2.png"], "the pictures are uploads");
  const sla = by("H3SLAAttention")[0][1];
  eq([sla.inputs.sparsity_ratio, sla.inputs.block_size, sla.inputs.enabled], [0.9, "64", true], "SLA values");
  eq(by("ModelAttentionBackend")[0][1].inputs.attention, "comfy kitchen attention", "kitchen backend");
  eq(main.inputs.model[0], by("ModelAttentionBackend")[0][0], "the model goes through SLA then the backend");
  eq(by("easy cleanGpuUsed").length, 4, "the four loaders go through the GPU clean-up");
  const rtx = by("RTXVideoSuperResolution")[0][1];
  eq([rtx.inputs.resize_type, rtx.inputs["resize_type.scale"], rtx.inputs.quality], ["scale by multiplier", 2, "ULTRA"], "the 2K pass's dynamic combo");
  const saves = by("SaveVideo");
  eq(saves.map(([, v]) => v.inputs.filename_prefix), ["video/t", "2K_Video/t"], "1K then 2K");
  ok(+saves[1][0] > +saves[0][0], "the 2K save is the last node (the job's file)");
  eq(by("CreateVideo")[0][1].inputs.fps, 24, "24 fps");
  eq(by("CreateVideo")[0][1].inputs.audio, [mid, 1], "the node's sound");
  const b2 = L.graph({ info: info({ without: ["RTXVideoSuperResolution", "easy cleanGpuUsed", "H3SLAAttention"] }), names: rd.names, prompt: "x", upscale2k: true });
  ok(b2.warnings.some((w) => /2K pass is skipped/.test(w)), "no RTX node -> 2K skipped with a word");
  eq(Object.values(b2.graph).filter((v) => v.class_type === "SaveVideo").length, 1, "one save without it");
}
// 3 the prompt
{
  eq(L.beats("Anchor.\n\nShot one.\n \nShot two."), ["Anchor.", "Shot one.", "Shot two."], "paragraphs");
  const p = L.plan("Anchor here.\n\nOne.\n\nTwo.", 40);
  eq([p.shots, p.shotSeconds, p.split], [2, 20, false], "the writer's paragraphs are kept");
  const q = L.plan("A sunny market in Olympia. She smiles. She points. She laughs. She waves.", 40);
  eq([q.shots, q.split], [3, true], "one block, 40 s -> 3 shots");
  ok(q.prompt.startsWith("A sunny market in Olympia.\n\n"), "the first sentence is the anchor");
  eq(L.beats(q.prompt).length, 4, "anchor + 3 beats");
  eq(L.memory([{ name: "Ann", desc: "26, red hair" }, { name: "Bo" }], true), "Ann: <Picture 2>, 26, red hair\nBo: <Picture 3>", "memory after a first frame");
  eq(L.memory([{ name: "Ann" }], false), "Ann: <Picture 1>", "memory without one");
  eq(L.ratio(1080, 1920, ["16:9", "9:16", "1:1"]), "9:16", "portrait");
}
// 4 wants + params
{
  ok(L.wants({ style: { arch: "h3-long" } }), "an H3 Long Video style");
  ok(L.wants({ style: { arch: "minimax-h3" }, longRun: true, noSong: true, seconds: 40 }), "⚙ Long video, no song, 40 s");
  ok(!L.wants({ style: { arch: "minimax-h3" }, longRun: true, noSong: false, seconds: 40 }), "a song scene stays");
  ok(!L.wants({ style: { arch: "minimax-h3" }, longRun: true, noSong: true, seconds: 12 }), "one shot stays");
  L.remember(null);
  ok(/node list/.test(L.params({ prompt: "x" }).error), "no node list -> said");
  const p = L.params({ info: info(), prompt: "Anchor.\n\nOne.\n\nTwo.", seconds: 40, width: 960, height: 544, seed: 5, first: "/f.png" });
  eq([p.params.mode, p.params.seed, p.params.graph_uploads.length], ["graph", 5, 1], "a graph job");
  ok(p.notes[0].includes("2 shots of 20 s"), p.notes[0]);
  const p2 = L.params({ info: info({ without: ["H3LongVideos"] }), prompt: "x" });
  eq(p2.needs, "h3long", "missing -> needs h3long");
}
// 5 the 30 s single run is retired; the style + add-on
{
  const h3Long = require("../lib/h3Long");
  ok(!h3Long.on({ kind: "video", arch: "minimax-h3", accel: { long: "on" } }), "h3Long.on is always no");
  const S = require("../lib/styles");
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "st872-"));
  S.seedStarters(d);
  const v = S.read(d, "video");
  ok(v.some((s) => s.name === "H3 Long Video (40 s)" && s.arch === "h3-long"), "the H3 Long Video starter");
  ok(!v.some((s) => /Long \(30 s\)/.test(s.name)), "the 30 s style is gone");
  const arch = JSON.parse(fs.readFileSync(path.join(ROOT, "lib/videoArch.json"), "utf8")).archs;
  ok(arch.some((a) => a.id === "h3-long"), "the arch");
  eq(arch.find((a) => a.id === "minimax-h3").accel.long, false, "MiniMax H3 offers no 30 s Long video");
  const RS = require("../lib/renderSettings");
  const style = { kind: "video", arch: "minimax-h3", accel: { long: "on" } };
  const jo = RS.jobOverrides({ long_run: true }, { width: 960, height: 544, style });
  ok(!("long" in jo.video_style.accel) && !jo.notes.some((x) => /one run up to 30 s/.test(x)), "the ⚙ no longer asks for a 30 s run");
  const packs = JSON.parse(fs.readFileSync(path.join(ROOT, "lib/nodePacks.json"), "utf8"));
  const list = packs.packs || packs.LIST || packs;
  const ids = (Array.isArray(list) ? list : Object.values(list).find(Array.isArray)).map((x) => x.id);
  ok(["h3long", "plaguekind", "nvvfx", "easyuse"].every((i) => ids.includes(i)), "the node packs");
  const cat = require("../lib/setupModels").byId("h3long_dit");
  eq([cat.size, cat.repo], [20980178976, "MATLOWAI/minimax-h3-fused-turbo-int8-convrot"], "the fused model");
  const A = require("../lib/addons").LIST.find((x) => x.id === "h3long");
  ok(A && /21\.0 GB/.test(A.size), "the add-on and its size");
  const w = fs.readFileSync(path.join(ROOT, "misc/worker.py"), "utf8");
  ok(/def long_on[\s\S]{0,600}return False/.test(w), "worker.long_on says no");
  ok(!fs.existsSync(path.join(ROOT, "comfy_workflows/H3_Long_Videos_2K.json")), "the third-party export is not shipped");
}
// 6 the add-on installs with fakes
(async () => {
  const A = require("../lib/h3LongAddon");
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "h3l-"));
  fs.mkdirSync(path.join(tmp, "custom_nodes")); fs.mkdirSync(path.join(tmp, "models"));
  const pl = { ok: true, models: path.join(tmp, "models"), customNodes: path.join(tmp, "custom_nodes"), python: "python" };
  const packs = [], files = [], lines = [];
  const r = await A.install((l) => lines.push(l), null, { place: pl,
    packInstall: async (pk) => { packs.push(pk.id); fs.mkdirSync(path.join(pl.customNodes, pk.folder), { recursive: true }); fs.writeFileSync(path.join(pl.customNodes, pk.folder, "__init__.py"), ""); return { ok: true }; },
    download: async (m) => { files.push(m.id); return { ok: true }; }, comfy: async () => ({ online: false }) });
  ok(r.ok, "installed");
  eq(packs.sort(), ["easyuse", "h3long", "nvvfx", "plaguekind"], "four packs");
  eq(files.sort(), ["h3_avae", "h3_te", "h3_vvae", "h3long_dit"], "the model files");
  ok(lines.some((l) => /no-redistribution/.test(l)), "the licence is said");
  const bad = await A.install(() => {}, null, { place: { ok: true, models: pl.models, customNodes: fs.mkdtempSync(path.join(os.tmpdir(), "h3l2-")) },
    packInstall: async (pk) => (pk.id === "nvvfx" ? { ok: false, error: "no git" } : { ok: true }), download: async () => ({ ok: true }), comfy: async () => ({}) });
  ok(bad.ok, "an optional pack that fails does not stop it");
  console.log(`test-872: ${n} passed`);
})().catch((e) => { console.error(e); process.exit(1); });
