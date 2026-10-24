#!/usr/bin/env node
/* bitGen Studio — scripts/test-graphcheck587.js (2.587.0): ⤒ IMPORT & CHECK a ComfyUI workflow (lib/graphCheck.js) - the
 * inputs it takes, its output made to save, missing nodes / model files, the controls it gets (Prompt / Negative from the
 * prompt box, bitGen's seed, Steps, CFG, Width / Height, Length), the picture of the graph (a UI export's own layout, an
 * API prompt by depth), fillSources, the placeholders, the wiring. Tim: "in settings -comfyui- graph can we add total
 * number of input images,videos,audio and allow user to import a comfy graph, bitgen checks the graph and adds the
 * image/video/audio inputs as needed and saves the output and reports missing nodes ..." + "show the graph ... when file
 * is imported". No ComfyUI. */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const GC = require("../lib/graphCheck");
const CG = require("../lib/comfyGraphs");
const UI = require("../static/graphcheck.js");

// a picture-to-video style workflow: 2 pictures, 1 sound, a preview at the end, a pack node, a missing model
const API = {
  "1": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: "dreamy_v3.safetensors" } },
  "2": { class_type: "LoadImage", inputs: { image: "a.png" } },
  "3": { class_type: "LoadImage", inputs: { image: "b.png" } },
  "4": { class_type: "LoadAudio", inputs: { audio: "song.wav" } },
  "5": { class_type: "PrimitiveStringMultiline", inputs: { value: "a cat on a roof" } },
  "6": { class_type: "CLIPTextEncode", inputs: { clip: ["1", 1], text: ["5", 0] } },
  "7": { class_type: "CLIPTextEncode", inputs: { clip: ["1", 1], text: "blurry" } },
  "8": { class_type: "EmptyLatentImage", inputs: { width: 832, height: 480, batch_size: 1 } },
  "9": { class_type: "KSampler", inputs: { model: ["1", 0], positive: ["6", 0], negative: ["7", 0], latent_image: ["8", 0], seed: 42, steps: 28, cfg: 6.5, sampler_name: "euler", scheduler: "normal", denoise: 1 } },
  "10": { class_type: "VAEDecode", inputs: { samples: ["9", 0], vae: ["1", 2] } },
  "11": { class_type: "PreviewImage", inputs: { images: ["10", 0] } },
  "12": { class_type: "Fancy_PackNode", inputs: { image: ["2", 0], other: ["3", 0], sound: ["4", 0] } },
};
const INFO = {
  CheckpointLoaderSimple: { input: { required: { ckpt_name: [["sdxl_base.safetensors", "sd15/dreamy_v2.safetensors"]] } } },
  LoadImage: { input: { required: { image: [["x.png"], { image_upload: true }] } } }, LoadAudio: { input: { required: { audio: ["COMBO", { options: ["x.wav"] }] } } },
  PrimitiveStringMultiline: { input: { required: { value: ["STRING", {}] } } }, CLIPTextEncode: { input: { required: { text: ["STRING", {}] } } },
  EmptyLatentImage: { input: { required: {} } }, KSampler: { input: { required: {} } }, VAEDecode: { input: { required: {} } },
  PreviewImage: { input: { required: {} } }, SaveImage: { input: { required: {} } },
};

try {
  check("counts: an API prompt -> 2 pictures, 0 videos, 1 sound", JSON.stringify(GC.counts(API)) === '{"images":2,"videos":0,"audio":1}');
  const uiG = { nodes: [{ id: 1, type: "LoadImage", pos: [0, 0], size: [300, 200] }, { id: 2, type: "LoadVideo", pos: [0, 300], size: [300, 200] }, { id: 3, type: "LoadImage", pos: [0, 600], mode: 4 }, { id: 4, type: "SaveVideo", pos: [500, 100], size: [300, 120] }],
    links: [[1, 1, 0, 4, 0, "IMAGE"], [2, 2, 0, 4, 1, "VIDEO"]] };
  check("counts: a saved (UI) workflow -> its loaders, a bypassed one not counted", JSON.stringify(GC.counts(uiG)) === '{"images":1,"videos":1,"audio":0}');

  const fx = GC.fixOutputs(API);
  check("fixOutputs: the PreviewImage becomes a SaveImage (its images kept, a filename prefix) - the original untouched", fx.api["11"].class_type === "SaveImage" && JSON.stringify(fx.api["11"].inputs.images) === '["10",0]' && fx.api["11"].inputs.filename_prefix && API["11"].class_type === "PreviewImage" && fx.fixes[0].from === "PreviewImage");
  const vc = GC.fixOutputs({ "1": { class_type: "VHS_VideoCombine", inputs: { images: ["2", 0], save_output: false } } });
  check("fixOutputs: a video combine with save_output off is turned on", vc.api["1"].inputs.save_output === true && vc.fixes.length === 1);
  check("outputsOf: the save nodes and what they write", JSON.stringify(GC.outputsOf(fx.api)) === '[{"node":"11","class_type":"SaveImage","kind":"image"}]' && GC.outputsOf({ a: { class_type: "SaveAudioMP3" } })[0].kind === "audio" && GC.outputsOf({ a: { class_type: "VHS_VideoCombine" } })[0].kind === "video");
  check("outputsOf: a pack's own save node (…SegmentSave) and ComfyUI's OUTPUT_NODE flag count; a preview does not", GC.outputsOf({ a: { class_type: "MiniMaxH3ChainSegmentSave" }, b: { class_type: "PackWriter" }, c: { class_type: "PreviewImage" } }, { PackWriter: { output_node: true } }).map((o) => o.node).join() === "a,b");
  check("counts: the VHS audio upload is a sound input (MM3_Characters: 2 pictures + 2 sounds)", JSON.stringify(GC.counts(JSON.parse(fs.readFileSync(path.join(ROOT, "comfy_workflows", "MM3_Characters.json"), "utf8")))) === '{"images":2,"videos":0,"audio":2}');
  check("missingNodes: the pack node ComfyUI does not have (none without ComfyUI's list)", GC.missingNodes(API, INFO).join() === "Fancy_PackNode" && GC.missingNodes(API, null).length === 0);
  const mm = GC.missingModels(API, INFO);
  check("missingModels: a model file not in ComfyUI's list (a file in a sub folder matches by name; pictures are not models)", mm.length === 1 && mm[0].value === "dreamy_v3.safetensors" && mm[0].node === "1"
    && GC.missingModels({ "1": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: "dreamy_v2.safetensors" } } }, INFO).length === 0);

  const C = GC.suggestControls(fx.api), by = (id) => C.find((c) => c.id === id);
  check("controls: Prompt -> the words behind the sampler's positive (through a Primitive), from the prompt box", by("prompt") && JSON.stringify(by("prompt").targets) === '[{"node":"5","input":"value"}]' && by("prompt").source === "prompt" && by("prompt").default === "a cat on a roof");
  check("controls: Negative -> the negative encoder; Seed = bitGen's; Steps / CFG / Width / Height with the workflow's own values",
    JSON.stringify(by("negative").targets) === '[{"node":"7","input":"text"}]' && by("seed").source === "seed" && by("seed").targets[0].input === "seed"
    && by("steps").default === 28 && by("cfg").default === 6.5 && by("cfg").step === 0.1 && by("width").default === 832 && by("height").targets[0].node === "8" && !by("length"));
  check("controls: a video's length (frames) is found", GC.suggestControls({ "1": { class_type: "EmptyHunyuanLatentVideo", inputs: { width: 848, height: 480, length: 73 } } }).find((c) => c.id === "length").default === 73);
  check("controls normalize with their source kept (comfyGraphs.normalizeControl)", CG.normalizeControl(by("prompt")).source === "prompt" && CG.normalizeControl({ type: "text", source: "evil" }).source === undefined);
  const vals = CG.fillSources({ controls: C }, { steps: 10 }, { prompt: "a dog in the rain", negative: "", seed: 777 });
  check("fillSources: an empty Prompt takes the prompt box, Seed takes bitGen's, an empty negative stays empty, the others as given", vals.prompt === "a dog in the rain" && vals.seed === 777 && vals.negative === undefined && vals.steps === 10);
  check("...a Prompt typed in its own box wins", CG.fillSources({ controls: C }, { prompt: "mine" }, { prompt: "box" }).prompt === "mine");
  const ap = CG.apply(fx.api, { controls: C }, vals);
  check("apply: the prompt box's words go into node 5, the seed into the sampler", ap.graph["5"].inputs.value === "a dog in the rain" && ap.graph["9"].inputs.seed === 777 && ap.graph["9"].inputs.steps === 10);

  const r = GC.check(API, INFO);
  check("check: inputs 2 pictures + 1 sound, the output saved, the missing pack node = a problem (not ok), the missing model = a warning",
    r.media.images === 2 && r.media.audio === 1 && r.outputs.length === 1 && r.fixes.length === 1 && !r.ok && /Fancy_PackNode/.test(r.problems.join()) && /dreamy_v3/.test(r.warnings.join()), r);
  const ok = GC.check(Object.fromEntries(Object.entries(API).filter(([k]) => k !== "12")), INFO);
  check("check: without the pack node it is ok to test", ok.ok && ok.problems.length === 0);
  const none = GC.check({ "1": { class_type: "KSampler", inputs: {} } }, null);
  check("check: nothing saved = a problem; ComfyUI not running = said", !none.ok && /saves nothing/.test(none.problems.join()) && /not running/.test(none.warnings.join()));

  const vUi = GC.view(uiG, { missing_nodes: ["SaveVideo"] });
  check("view (UI): the nodes at their own places, links, loaders / outputs / missing / bypassed tagged", vUi.layout === "ui" && vUi.nodes.length === 4 && vUi.links.length === 2 && vUi.nodes[0].tags.includes("image") && vUi.nodes[1].tags.includes("video") && vUi.nodes[2].tags.includes("bypassed") && vUi.nodes[3].tags.includes("missing") && vUi.nodes[3].x === 500, vUi.nodes);
  const vApi = GC.view(r.api, r);
  const n9 = vApi.nodes.find((n) => n.id === "9"), n1 = vApi.nodes.find((n) => n.id === "1");
  check("view (API): laid out by depth (a loader left of the sampler), every link drawn, tags from the check", vApi.layout === "depth" && n1.x < n9.x && vApi.links.length === 13 && vApi.nodes.find((n) => n.id === "11").tags.includes("output") && vApi.nodes.find((n) => n.id === "12").tags.includes("missing") && n1.tags.includes("model"), vApi.links.length);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bg-gc587-"));
  const ph = GC.placeholders(tmp);
  check("placeholders: a test picture always (ffmpeg, else a PNG made here); sound / video when ffmpeg is there", ph.images && fs.statSync(ph.images).size > 50 && fs.readFileSync(ph.images).slice(1, 4).toString() === "PNG");
  const png = GC.tinyPng();
  check("tinyPng: a valid PNG header + IEND", png.slice(1, 4).toString() === "PNG" && png.slice(-8, -4).toString() === "IEND");
  fs.rmSync(tmp, { recursive: true, force: true });

  check("the page: fit / mediaWords / curve", UI.mediaWords({ images: 2, videos: 1, audio: 0 }) === "🖼 2 pictures · 🎞 1 video · 🔊 0 sounds" && UI.fit([{ x: 0, y: 0, w: 100, h: 50 }, { x: 300, y: 200, w: 100, h: 50 }], 10).w === 420 && /^M100 25 C/.test(UI.curve({ x: 0, y: 0, w: 100, h: 50 }, { x: 300, y: 0, w: 100, h: 50 })));
  const IDX = fs.readFileSync(path.join(ROOT, "routes", "index.js"), "utf8"), H = fs.readFileSync(path.join(ROOT, "static", "index.html"), "utf8");
  check("wiring: routes/graphCheck.js mounted; /api/graphs/run fills the sources (prompt box, negative, seed); the page sends prompt + negative; the tab announces a loaded workflow; graphcheck.js loaded",
    /require\("\.\/graphCheck"\)\.mount\(app\)/.test(IDX) && /comfyGraphs\.fillSources\(g, b\.values \|\| \{\}, \{ prompt: b\.prompt, negative: b\.negative, seed: seed\.seed \}\)/.test(IDX)
    && /prompt: \$\("prompt"\) \? \$\("prompt"\)\.value : ""/.test(H) && /h3:graph-analyzed/.test(H) && /src="\/static\/graphcheck\.js"/.test(H));
} catch (e) { fail++; console.log("FAIL: crashed - " + (e && e.stack || e)); }
console.log(`\n${pass} passed, ${fail} failed`);
console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
process.exit(fail ? 1 : 0);
