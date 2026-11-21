// bitGen Studio 2.905.0 - OVERRIDE STYLE ON EVERY VIDEO MODEL (Tim: "make sure it works with all video models - it is not
// overiding with fast h3 omni"). The JavaScript half:
//   - routes/index.js + routes/characters.js mark Override's cfg on the job (cfg_override) - misc/worker.py keeps it on
//     FastH3 / 16 GB mode instead of their distilled cfg 1 (the Python half: scripts/test-905.py)
//   - H3 Long Video (lib/h3LongVideo.js withBasic + graph cfg / model / LoRAs, routes/h3LongVideo.js, static/h3longgen.js,
//     the StoryBoard's long scenes) and Swap mode (lib/swap.js withBasic + jobParams basic, routes/swap.js, index.html)
//   - the StoryBoard's Viggle scenes (lib/h3Viggle.js), the sampler header on /api/h3long + /api/swap
// The real browser run: scripts/test-ui905-ui.js. Run: node scripts/test-905.js
"use strict";
const fs = require("fs"), path = require("path"), os = require("os");
let ok = 0, fail = 0;
const check = (n, c, x) => { if (c) { ok++; console.log("ok   ", n); } else { fail++; console.log("FAIL ", n, x === undefined ? "" : JSON.stringify(x).slice(0, 600)); } };
const R = (p) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");
const on = (o) => JSON.stringify(Object.assign({ override: true, steps: 0, cfg: null, seed: -1, model: "", loras: [] }, o));

// 1. the routes mark Override's cfg on the job
const ix = R("routes/index.js");
check("routes/index.js: the H3 job carries cfg_override while Override style is on", /\.\.\.\(bo \? \{ cfg_override: bo\.cfg != null \} : \{\}\),/.test(ix));
const ch = R("routes/characters.js");
check("routes/characters.js: both board H3 job builders carry cfg_override from the kept Basic Settings",
  (ch.match(/\.\.\.\(rs\.basic \? \{ cfg_override: rs\.basic\.cfg != null \} : \{\}\),/g) || []).length === 2);
check("routes/characters.js: the board's H3 Long Video scenes take Override's steps / cfg / seed / model",
  /const ovb = rsAll\.basic_override \?/.test(ch) && /steps: ovb \? ovb\.steps : 0, cfg: ovb \? ovb\.cfg : null, model: ovb \? ovb\.model : ""/.test(ch));
const hv = R("lib/h3Viggle.js");
check("lib/h3Viggle.js: the board's Viggle scenes take Override's steps (cfg_override marks it)",
  /if \(rs\.basic\) \{\s*if \(rs\.basic\.steps > 0\) pre\.params\.steps = rs\.basic\.steps;/.test(hv) && /pre\.params\.cfg_override = rs\.basic\.cfg != null;/.test(hv));

// 2. H3 Long Video
const L = require("../lib/h3LongVideo");
let w = L.withBasic(on({ steps: 9, cfg: 3.5, seed: 777 }), { seed: "-1", steps: "0" });
check("h3long withBasic: Override on, both boxes unticked - steps / cfg / seed, no model / LoRAs", w.steps === 9 && w.cfg === 3.5 && w.seed === 777 && w.model === "" && w.loras.length === 0, w);
w = L.withBasic(on({ model: "minimax_h3_other.safetensors", loras: [{ path: "t.safetensors", weight: 0.6 }] }), {});
check("h3long withBasic: Use model / Use temporary LoRAs ticked - they come along; blank = the node's own", w.model === "minimax_h3_other.safetensors" && w.loras.length === 1 && w.steps === 0 && w.cfg === null && w.seed === null, w);
w = L.withBasic("", { seed: "5", steps: "12", cfg: "4" });
check("h3long withBasic: Override off - the request's seed / steps, the node's cfg and model", w.bo === null && w.seed === 5 && w.steps === 12 && w.cfg === null && w.model === "", w);
const F = (o) => ["FLOAT", o || {}], I = (o) => ["INT", o || {}], S = (o) => ["STRING", o || {}];
const info = {
  UNETLoader: { input: { required: { unet_name: [["minimax_h3_other.safetensors", L.MODEL_FILE]], weight_dtype: [["default", "fp8_e4m3fn"]] } } },
  CLIPLoader: { input: { required: { clip_name: [["qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors"]], type: [["minimax"]] } } },
  VAELoader: { input: { required: { vae_name: [["minimax_h3_audio_vae_fp32.safetensors", "minimax_h3_video_vae_fp16.safetensors"]] } } },
  LoadImage: { input: { required: { image: [["a.png"], { image_upload: true }] } } },
  CreateVideo: { input: { required: { images: ["IMAGE"], fps: F({ default: 30 }) }, optional: { audio: ["AUDIO"] } } },
  SaveVideo: { input: { required: { video: ["VIDEO"], filename_prefix: S({}), format: [["auto"]], codec: [["auto"]] } } },
  LoraLoaderModelOnly: { input: { required: { model: ["MODEL"], lora_name: [["t.safetensors"]], strength_model: F({ default: 1 }) } } },
  H3LongVideos: { input: { required: { model: ["MODEL"], clip: ["CLIP"], vae: ["VAE"], audio_vae: ["VAE"], prompt: S({ multiline: true }),
    resolution: [["16:9", "9:16", "1:1"]], megapixels: F({ default: 0.5 }), shot_seconds: F({ default: 15 }), steps: I({ default: 8 }),
    cfg: F({ default: 1 }), seed: I({ default: 0 }), shot_length: [["fixed"]], character_memory: S({ multiline: true }) } } },
};
const names = L.readiness(info).names;
let b = L.graph({ info, names, prompt: "A.\n\nB.", seed: 777, width: 640, height: 384, steps: 9, cfg: 3.5 });
const node = (g, c) => Object.values(g).find((n) => n.class_type === c);
let main = node(b.graph, "H3LongVideos");
check("h3long graph: Override's steps / cfg / seed / size on the node", main.inputs.steps === 9 && main.inputs.cfg === 3.5 && main.inputs.seed === 777
  && main.inputs.resolution === "16:9" && main.inputs.megapixels === 0.25, main.inputs);
check("h3long graph: no Override model = the fused turbo file, no LoRA node", node(b.graph, "UNETLoader").inputs.unet_name === L.MODEL_FILE && !node(b.graph, "LoraLoaderModelOnly"), node(b.graph, "UNETLoader").inputs);
b = L.graph({ info, names, prompt: "A.", seed: 1, width: 640, height: 384, model: "minimax_h3_other.safetensors", loras: [{ path: "t.safetensors", weight: 0.6 }] });
const lo = node(b.graph, "LoraLoaderModelOnly");
check("h3long graph: Use model + Use temporary LoRAs - that model, its LoRA chained before the node", node(b.graph, "UNETLoader").inputs.unet_name === "minimax_h3_other.safetensors"
  && lo && lo.inputs.lora_name === "t.safetensors" && lo.inputs.strength_model === 0.6, b.graph);
main = node(b.graph, "H3LongVideos");
check("h3long graph: cfg left blank = the node's own (1)", main.inputs.cfg === 1, main.inputs);
const rh = R("routes/h3LongVideo.js");
check("routes/h3LongVideo.js: the job is made from withBasic (seed / steps / cfg / model / loras) and logs the override",
  /const ov = L\(\)\.withBasic\(b\.basic, b\);/.test(rh) && /seed: ov\.seed, steps: ov\.steps, cfg: ov\.cfg, model: ov\.model, loras: ov\.loras,/.test(rh) && /note\(ov\.bo, "H3 Long Video"\)/.test(rh));
check("static/h3longgen.js: Generate sends Basic Settings' Override", /fd\.append\("basic", root\.H3Basic\.json\(\)\);\s*var res = await fetch\("\/api\/h3long"/.test(R("static/h3longgen.js")));

// 3. Swap mode
const SW = require("../lib/swap");
const st = { id: "s", name: "mmh3_chr_swap", kind: "video", arch: "minimax-h3", phases: [{ model: "own.safetensors" }], loras: [] };
let v = SW.withBasic(st, on({ steps: 9, cfg: 3.5, seed: 777 }), "-1");
check("swap withBasic: Override on with the boxes unticked - the style's model, Override's seed", v.style === st && v.seed === 777 && v.bo.steps === 9, v);
v = SW.withBasic(st, on({ model: "m2.safetensors", loras: [{ path: "t.safetensors", weight: 1 }] }), "5");
check("swap withBasic: Use model / LoRAs ticked - a style copy with them; Override's random seed = the request's", v.style.phases[0].model === "m2.safetensors"
  && v.style.loras.length === 1 && st.phases[0].model === "own.safetensors" && v.seed === "5", v);
v = SW.withBasic(st, "", "5");
check("swap withBasic: Override off - nothing changes", v.bo === null && v.style === st && v.seed === "5");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "t905-"));
const wf = path.join(tmp, "wf.json"), vid = path.join(tmp, "v.mp4"), pic = path.join(tmp, "p.png");
for (const f of [wf, vid, pic]) fs.writeFileSync(f, "{}");
let p = SW.jobParams({ workflow: wf, video: vid, image: pic, seed: 777, basic: JSON.parse(on({ steps: 9, cfg: 3.5 })) });
check("swap jobParams: basic {steps, cfg} + cfg_override for swap_worker", p.basic && p.basic.steps === 9 && p.basic.cfg === 3.5 && p.cfg_override === true && p.seed === 777, p);
p = SW.jobParams({ workflow: wf, video: vid, image: pic, seed: 3 });
check("swap jobParams: Override off - no basic", !("basic" in p) && !("cfg_override" in p));
fs.rmSync(tmp, { recursive: true, force: true });
const rs = R("routes/swap.js");
check("routes/swap.js: /api/swap and a scene's ⇄ both go through withBasic (the scene's from the board's kept Basic Settings)",
  (rs.match(/swap\.withBasic\(ps\.style, /g) || []).length === 2 && /const bo = rs\.basic_override \? \{ override: true,/.test(rs) && (rs.match(/basic: ov\.bo/g) || []).length === 2);
check("static/index.html: Swap mode sends Basic Settings' Override", /fd\.append\("basic", H3Basic\.json\(\)\);   \/\/ 2\.905\.0: Override style \(lib\/swap\.js withBasic\)\s*const res = await fetch\("\/api\/swap"/.test(R("static/index.html")));

// 4. the sampler / scheduler header
const SS = require("../static/samplerset.js");
check("samplerset: /api/h3long and /api/swap carry the header (their sub-addresses do not)", SS.kindOfUrl("/api/h3long") === "video" && SS.kindOfUrl("/api/swap") === "video"
  && SS.kindOfUrl("/api/swap/cast") === "" && SS.kindOfUrl("/api/pan2") === "video" && SS.kindOfUrl("/api/pan2/caption") === "");

console.log(`\n${ok} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
