#!/usr/bin/env node
/* bitGen Studio — 2.338.0: LTX 2.5 as an engine.
 * Run: node scripts/test-ltx.js
 * Tim: "can we add ltx2.5 for our music video and screenplay and first/last
 * frame from reference images/audio/video option ... with ltx2 style".
 *   1. lib/ltxWorkflow on Tim's own canvas (comfy_workflows/LTX25_All_In_One.json):
 *      every mode picked by its img<k> Set, the others gone, one live Any
 *      Switch input, the loader, the model / te, the classes;
 *   2. autoMode / missing / seconds;
 *   3. lib/ltx.jobParams + size; lib/ltxScenes.plan (the scene -> mode table) + untag;
 *   4. scripts/ltx_convert.js end to end (a bare per-class /object_info):
 *      the Power Lora Loader rows and the promoted sampler_name survive;
 *   5. wiring: routes (index.js mounts, /api/generate + /api/musicvideo refuse an
 *      LTX style), queueScene's branch, WORKER_FOR, job.json's node_exe, the
 *      arch, the starter style, the guide, the node packs, the models, the UI. */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
let pass = 0, fail = 0;
function check(name, ok, extra) {
  if (ok) { pass++; console.log("PASS: " + name); }
  else { fail++; console.log("FAIL: " + name + (extra !== undefined ? " :: " + JSON.stringify(extra).slice(0, 400) : "")); }
}
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const LW = require(path.join(ROOT, "lib", "ltxWorkflow"));
const LTX = require(path.join(ROOT, "lib", "ltx"));
const LS = require(path.join(ROOT, "lib", "ltxScenes"));
const SUB = require(path.join(ROOT, "lib", "subgraphs"));
const UI = JSON.parse(read("comfy_workflows", "LTX25_All_In_One.json"));

// ---- 1. the canvas
const GROUP = { t2v: "77545b89", a2v: "7e218797", i2v: "9d472b6b", flf: "ee1e4607", lipsync: "fb293513",
                v2v: "cbd91fa6", fl_lipsync: "f23309a7", fmlf: "689f9236" };
for (const m of LW.MODES) {
  const p = LW.prepare(UI, { mode: m.id });
  const inst = p.ui.nodes.find((n) => String(n.id) === p.instance);
  const flat = SUB.flatten(p.ui).graph;
  const sw = flat.nodes.filter((n) => n.type === "Any Switch (rgthree)").map((n) => (n.inputs || []).filter((i) => i.link != null).length);
  const defs = p.ui.definitions.subgraphs;
  check(`prepare ${m.id}: the instance of Tim's group (${GROUP[m.id]}), its inner nodes enabled, the 7 others gone, each Any Switch one live input`,
    inst && inst.type.startsWith(GROUP[m.id]) && inst.mode === 0 && defs.length === 1 && defs[0].nodes.every((n) => n.mode === 0)
    && sw.join() === "1,1" && !p.ui.nodes.some((n) => String(n.type).startsWith("Fast Groups") || n.type === "Label (rgthree)"),
    { inst: inst && inst.type, sw, defs: defs.length });
}
check("the canvas's Set names are not its group numbers: 08 style transfer = img6, 06 F/L lipsync = img7, 07 FMLF = img8",
  LW.modeById("v2v").k === 6 && LW.modeById("fl_lipsync").k === 7 && LW.modeById("fmlf").k === 8);
let pp = LW.prepare(UI, { mode: "i2v", model: "ltx-2.5-22b-distilled-transformer-comfy-int8-convrot.safetensors", te: "my_gemma.safetensors" });
const plora = pp.ui.nodes.find((n) => String(n.type).startsWith("Power Lora Loader"));
const modelLink = pp.ui.links.find((l) => (Array.isArray(l) ? l[0] : l.id) === plora.inputs.find((i) => i.name === "model").link);
const unet = pp.ui.nodes.find((n) => n.type === "UNETLoader");
check("a .safetensors model: the UNETLoader is wired into the Power Lora Loader and loads it; the text encoder is set",
  pp.loader === "UNETLoader" && String(modelLink[1]) === String(unet.id) && unet.widgets_values[0].startsWith("ltx-2.5-22b-distilled")
  && pp.ui.nodes.find((n) => n.type === "CLIPLoader" && n.widgets_values[0] === "my_gemma.safetensors"));
pp = LW.prepare(UI, { mode: "t2v" });
check("no model given: the canvas's own loader (GGUF, the Q4_K_M it was saved with)", pp.loader === "UnetLoaderGGUF"
  && pp.ui.nodes.find((n) => n.type === "UnetLoaderGGUF").widgets_values[0] === "LTX-2.5-Distilled-Q4_K_M.gguf");
check("prepare refuses an unknown mode and a non-canvas in words",
  (() => { try { LW.prepare(UI, { mode: "x" }); return false; } catch (e) { return /unknown LTX mode/.test(e.message); } })()
  && (() => { try { LW.prepare({ nodes: [], links: [] }, { mode: "t2v" }); return false; } catch (e) { return /no mode 1/.test(e.message); } })());
const cls = LW.classesOf(LW.prepare(UI, { mode: "fmlf" }).ui);
check("classesOf: the node types the mode needs (incl. inside its subgraph), no Set/Get / subgraph ids / canvas-only nodes",
  ["LTXVImgToVideoInplaceKJ", "SimpleCalculatorKJ", "ComfySwitchNode", "mxSlider", "VHS_LoadAudioUpload", "Power Lora Loader (rgthree)"].every((c) => cls.includes(c))
  && !cls.some((c) => /^(SetNode|GetNode|Fast Groups|Label)/.test(c) || c.length === 36), cls);

// ---- 2. auto / missing / seconds
check("autoMode: video -> v2v; audio + 0/1/2/3 pictures -> a2v / lipsync / fl_lipsync / fmlf; no audio 0/1/2 -> t2v / i2v / flf",
  LW.autoMode({ video: true, images: 1 }) === "v2v" && LW.autoMode({ audio: true }) === "a2v" && LW.autoMode({ audio: true, images: 1 }) === "lipsync"
  && LW.autoMode({ audio: true, images: 2 }) === "fl_lipsync" && LW.autoMode({ audio: true, images: 3 }) === "fmlf"
  && LW.autoMode({}) === "t2v" && LW.autoMode({ images: 1 }) === "i2v" && LW.autoMode({ images: 2 }) === "flf");
check("missing: in words", LW.missing("flf", { images: 1 }) === "First / last frame needs 2 pictures (first + last)"
  && /needs a picture \(the first frame\) and an audio clip/.test(LW.missing("lipsync", {})) && LW.missing("t2v", {}) === "");
check("seconds: whole 1..30 (frames = s * 24 + 1, LTX's 8k+1 grid)", LW.seconds(5.4) === 5 && LW.seconds(0) === 5 && LW.seconds(99) === 30 && LW.seconds(0.4) === 1);

// ---- 3. jobParams / plan
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ltx-"));
const img = (n) => { const p = path.join(tmp, n); fs.writeFileSync(p, "png"); return p; };
const aud = path.join(tmp, "song.wav"); fs.writeFileSync(aud, "wav");
const WF = path.join(ROOT, "comfy_workflows", "LTX25_All_In_One.json");
let jp = LTX.jobParams({ workflow: WF, mode: "auto", prompt: "p", images: [img("a.png"), img("b.png")], audio: { path: aud, start: 3 }, seconds: 5.2, width: 960, height: 544, seed: 7 });
check("jobParams auto: 2 pictures + audio = fl_lipsync, whole seconds, the audio window, mode ltx",
  jp.mode === "ltx" && jp.ltx_mode === "fl_lipsync" && jp.images.length === 2 && jp.audio.start === 3 && jp.seconds === 5 && jp.fps === 24 && jp.seed === 7);
jp = LTX.jobParams({ workflow: WF, mode: "i2v", images: [img("a.png"), img("b.png")], audio: { path: aud } });
check("jobParams: only what the mode reads (i2v: picture 1, no audio)", jp.images.length === 1 && jp.audio === null);
check("jobParams refuses in words: a missing input, a missing canvas",
  /First \/ last frame needs 2 pictures/.test(LTX.jobParams({ workflow: WF, mode: "flf", images: [img("a.png")] }).error)
  && /is missing - unzip the workflows zip/.test(LTX.jobParams({ workflow: path.join(tmp, "nope.json") }).error));
check("size: multiples of 32, a tiny size scaled up with its aspect", JSON.stringify(LTX.size(960, 544)) === '{"width":960,"height":544}'
  && JSON.stringify(LTX.size(192, 108)) === '{"width":448,"height":256}');
check("isLtxStyle: arch ltx-2.5 or the canvas file", LTX.isLtxStyle({ kind: "video", arch: "ltx-2.5" })
  && LTX.isLtxStyle({ kind: "video", arch: "custom", workflow: "comfy_workflows/LTX25_All_In_One.json" }) && !LTX.isLtxStyle({ kind: "video", arch: "minimax-h3" }));
const base = { style: { id: "s", name: "LTX 2.5", kind: "video", arch: "ltx-2.5", workflow: "comfy_workflows/LTX25_All_In_One.json" },
  base: ROOT, cast: [{ name: "Ava", tag: "ava" }], width: 960, height: 544 };
const row = (o) => ({ n: 2, chapter: "", prompt: ["@ava walks in.", "<d>hi</d>"], length: 120, seed: "5", ...o });
const P = (o) => LS.plan({ ...base, ...o }).params;
const F = img("first.png"), L = img("last.png"), C = img("cont.png"), PL = img("place.png");
check("scene -> mode: Ref = t2v; Ref + song = a2v", P({ r: row({ anchor: "reference" }) }).ltx_mode === "t2v"
  && P({ r: row({ anchor: "reference" }), song: aud, win: { start: 4, dur: 6 } }).ltx_mode === "a2v");
check("scene -> mode: Cont / First on the frame it continues from = i2v; its First picture wins over it",
  P({ r: row({ anchor: "continue" }), cont: C }).images[0] === C && P({ r: row({ anchor: "first" }), cont: C, first: F }).images[0] === F
  && P({ r: row({ anchor: "continue" }), cont: C }).ltx_mode === "i2v");
check("scene -> mode: Trans = flf (the continue frame -> its Last picture, else its location picture); + song = fl_lipsync on its slice",
  P({ r: row({ anchor: "transition" }), cont: C, place: PL }).images.join() === [C, PL].join()
  && P({ r: row({ anchor: "transition" }), cont: C, last: L }).ltx_mode === "flf"
  && P({ r: row({ anchor: "transition" }), cont: C, last: L, song: aud, win: { start: 4, dur: 6 } }).ltx_mode === "fl_lipsync"
  && P({ r: row({ anchor: "transition" }), cont: C, last: L, song: aud, win: { start: 4, dur: 6 } }).seconds === 6);
check("scene: a Ref scene never takes the continue frame; a Last picture alone is not a mode", P({ r: row({ anchor: "reference" }), cont: C }).ltx_mode === "t2v"
  && P({ r: row({ anchor: "reference" }), last: L }).ltx_mode === "t2v");
check("scene prompt: @tags become names, dialogue marks and [Shot n] go", LS.untag("[Shot 1] @ava waves. <d>Hi</d>", [{ name: "Ava", tag: "ava" }]) === "Ava waves. Hi"
  && P({ r: row({ anchor: "reference" }) }).prompt.startsWith("Ava walks in."));
check("scene: length = the row's frames / 24 (whole seconds), the scene rides along", P({ r: row({ anchor: "reference", length: 120 }) }).seconds === 5
  && P({ r: row({ anchor: "reference" }) }).scene.ltx === true && LS.isLtxFlow("LTX25") && !LS.isLtxFlow("MMH3_NativeAudio_MV"));

// ---- 4. the converter CLI
const ci = spawnSync(process.execPath, [path.join(ROOT, "scripts", "ltx_convert.js"), "classes", WF, "lipsync"], { encoding: "utf8" });
const classes = JSON.parse(ci.stdout || "{}").classes || [];
const info = Object.fromEntries(classes.map((c) => [c, { input: {} }]));
fs.writeFileSync(path.join(tmp, "info.json"), JSON.stringify(info));
const cv = spawnSync(process.execPath, [path.join(ROOT, "scripts", "ltx_convert.js"), "convert", WF, "lipsync", path.join(tmp, "none.json"),
  path.join(tmp, "info.json"), path.join(tmp, "out.json")], { encoding: "utf8" });
const out = cv.status === 0 ? JSON.parse(fs.readFileSync(path.join(tmp, "out.json"), "utf8")) : {};
const g = out.graph || {};
const pl = Object.values(g).find((v) => String(v.class_type).startsWith("Power Lora Loader")) || { inputs: {} };
check("ltx_convert classes + convert: the lipsync API prompt, its titles kept (the patcher finds things by them)",
  cv.status === 0 && Object.keys(g).length > 40 && Object.values(g).some((v) => v.class_type === "CLIPTextEncode" && /positive/.test(v._meta.title))
  && Object.values(g).some((v) => v.class_type === "LoadImage" && v._meta.title === "Load Image1"), cv.stderr);
check("...the Power Lora Loader rows carried across (Tim's LoRAs stay on)", pl.inputs.lora_1 && pl.inputs.lora_1.lora === "LTX-2.3-OmniNFT-RL-Lora_bf16.safetensors"
  && pl.inputs.lora_2 && /transition/.test(pl.inputs.lora_2.lora));
check("...the promoted widget the instance lists no input for (sampler_name) reaches the inner KSamplerSelect (lib/subgraphs 2.338.0)",
  Object.values(g).some((v) => v.class_type === "KSamplerSelect" && v.inputs.sampler_name === "euler_ancestral"));

// ---- 5. wiring
const IDX = read("routes", "index.js"), CH = read("routes", "characters.js"), CORE = read("lib", "core.js");
check("routes/ltx.js mounted from routes/index.js (never server.js)", IDX.includes('require("./ltx").mount(app);') && !read("server.js").includes("ltx"));
check("/api/generate and /api/musicvideo refuse an LTX style in words", (IDX.match(/isLtxStyle\(/g) || []).length >= 2
  && IDX.includes("is an LTX style - it renders through the LTX modes") && IDX.includes("LTX music videos run on the scene board"));   // 2.402.0: 2.5 or 2.3
check("queueScene: the board's LTX 2.5 flow -> queueLtxScene (upscale refused in words)", CH.includes("if (ltxScenes.isLtxFlow(st.style)) {")
  && CH.includes("return queueLtxScene(project, st, r);") && CH.includes("function queueLtxScene(project, st, r)"));
check("core: mode ltx -> ltx_worker.py; job.json carries node_exe (the converter runs on the app's own node)",
  /ltx: "ltx_worker.py"/.test(CORE) && CORE.includes("node_exe: process.execPath"));
const VA = JSON.parse(read("lib", "videoArch.json"));
check("the arch ltx-2.5 (one workflow slot, no H3 accelerators)", VA.archs.some((a) => a.id === "ltx-2.5" && a.modes.join() === "ltx" && a.accel.sage === false));
check("the starter style LTX 2.5 on the shipped canvas", /name: "LTX 2\.5", kind: "video", arch: "ltx-2\.5",\s+workflow: "comfy_workflows\/LTX25_All_In_One\.json"/.test(read("lib", "styles.js")));
const PG = require(path.join(ROOT, "lib", "promptGuides"));
check("the LLM is taught LTX prompts (guide ltx_25) for an LTX style only", (PG.pick(PG.load(null), { kind: "video", arch: "ltx-2.5" }) || {}).id === "ltx_25"
  && (PG.pick(PG.load(null), { kind: "video", arch: "minimax-h3" }) || {}).id === "minimax_h3");
const NP = JSON.parse(read("lib", "nodePacks.json")).packs;
check("the node packs the canvas needs are installable (GGUF, mxToolkit, Easy-Use); 2.401.2: no ComfyMath (gone from GitHub) - its math is core",
  ["UnetLoaderGGUF", "mxSlider", "easy cleanGpuUsed"].every((c) => NP.some((p) => (p.provides || []).includes(c)))
  && !NP.some((p) => p.id === "comfymath" || (p.provides || []).some((c) => /^CM_|MathExpression\|pysssss/.test(c))));
const CAT = JSON.parse(read("lib", "modelCatalog.json")).models;
check("the LTX 2.5 models are in the catalog (the GGUF the canvas loads first)", ["ltx25_gguf", "ltx25_int8", "ltx25_te", "ltx25_vvae", "ltx25_avae", "ltx25_up"].every((id) => CAT.some((m) => m.id === id))
  && CAT.find((m) => m.id === "ltx25_gguf").file === "LTX-2.5-Distilled-Q4_K_M.gguf");
const PD = read("ext", "promptdock", "dock.html"), IH = read("static", "index.html");
check("prompt docker: the LTX mode dropdown (Auto + the 8 modes), shown for an LTX style", /id="ltxModeSel" hidden/.test(PD)
  && ["auto", "t2v", "i2v", "flf", "fmlf", "a2v", "lipsync", "fl_lipsync", "v2v"].every((m) => PD.includes(`<option value="${m}"`))
  && IH.includes("function ltxModePaint()") && IH.includes("ltxModePaint();                        // 2.338.0"));
check("prompt docker: the transition LoRA Auto / On / Off beside it, sent with the job", /id="ltxTransSel" hidden/.test(PD)
  && ["auto", "on", "off"].every((m) => PD.includes(`<option value="${m}">Transition: `))
  && IH.includes('fd.append("transition", $("ltxTransSel") ? $("ltxTransSel").value : "auto")')
  && IH.includes('if ($("ltxTransSel")) $("ltxTransSel").hidden = !on || is23;'));   // 2.402.0: hidden for LTX 2.3
check("prompt docker: Generate with an LTX style posts /api/ltx (pictures in order, first audio / video, mode, whole seconds)",
  IH.includes(": curLtxStyle() ? await submitLtx(text)") && IH.includes('fetch("/api/ltx", { method: "POST", body: fd })')
  && IH.includes('(window.RefRoles ? RefRoles.ltxOrder(refs) : refs).slice(0, 3).forEach((r) => fd.append("references", r.file, r.file.name))'));   // 2.340.0: the First frame first
const VC = read("ext", "videodock", "characters.js"), VH = read("ext", "videodock", "dock.html");
check("video docker: the LTX 2.5 board flow (kept, not migrated away)", VC.includes('["LTX25", "LTX 2.5 · text / first-last / lipsync"]') && VH.includes('<option value="LTX25">'));
check("comfy_client.object_info URL-encodes the class (\"Power Lora Loader (rgthree)\")", read("scripts", "comfy_client.py").includes("urllib.parse.quote(str(class_type), safe='')"));

console.log(`RESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
