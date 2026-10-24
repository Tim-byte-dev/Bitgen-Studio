#!/usr/bin/env node
/* bitGen Studio — 2.339.0: the character swap's second engine, LTX Ripple.
 * Run: node scripts/test-rippleswap.js
 * Tim: "a dropdown in character swap for ltx2 ripple, with ltx2 style, i think
 * ripple is a lora" (WepeNerd/LTX-Ripple LTX25_Ripple_v11, an IC-LoRA at 1.35:
 * edit the first frame, it carries the edit through the video).
 *   1. lib/rippleSwap: engines, 8k+1, the size, the two prompts (an H3 prompt's
 *      tags never reach LTX), the ff record + its sync, the job params;
 *   2. lib/swapSession keeps engine / ff / a result's engine; a replan keeps a
 *      kept segment's first frame;
 *   3. the wiring: routes/swapdlg (the endpoints, run's two steps, retry /
 *      upscale), ltx_worker (the cut, the IC-LoRA, the finish), the catalog,
 *      the image editor hook;
 *   4. static/swapdlg.js in jsdom: Engine, the first-frame cards and their
 *      buttons, Quality / Upscale hidden on Ripple. */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
let pass = 0, fail = 0;
function check(name, ok, extra) {
  if (ok) { pass++; console.log("PASS: " + name); }
  else { fail++; console.log("FAIL: " + name + (extra !== undefined ? " :: " + JSON.stringify(extra).slice(0, 400) : "")); }
}
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const RS = require(path.join(ROOT, "lib", "rippleSwap"));
const SS = require(path.join(ROOT, "lib", "swapSession"));
const LTX = require(path.join(ROOT, "lib", "ltx"));

// ---- 1. the lib
check("engines: MiniMax H3 (default), LTX Ripple, 2.344: Viggle (H3); junk = h3", RS.ENGINE_IDS.join() === "h3,ripple,viggle,viggle_native"
  && RS.engineOf("ripple") === "ripple" && RS.engineOf("x") === "h3" && RS.engineOf(undefined) === "h3");
check("the Ripple LoRA and its README strength", RS.LORA === "LTX25_Ripple_v11.safetensors" && RS.STRENGTH === 1.35);
check("8k+1: the smallest LTX frame count covering the segment + the still at frame 0 (2.342.0, Tim's workflow)",
  RS.renderFrames(124) === 129 && RS.renderFrames(121) === 129 && RS.renderFrames(120) === 121
  && RS.renderFrames(345) === 353 && RS.renderFrames(5) === 9 && RS.renderFrames(128) === 129);
check("size: multiples of 32 at the source aspect", JSON.stringify(RS.size(1920, 1080, 544)) === '{"width":960,"height":544}'
  && JSON.stringify(RS.size(1080, 1920, 544)) === '{"width":544,"height":960}');
check("the LTX prompt is the README's default + the character line", RS.ltxPrompt("").startsWith(RS.DEFAULT_PROMPT)
  && RS.DEFAULT_PROMPT.startsWith("Use the reference video for motion, timing, camera movement"));
check("an H3 swap prompt (<Video 1> / <Picture 1>) is not LTX direction; plain words are",
  RS.direction("Replace only the man in <Video 1> with the character in <Picture 1>.") === ""
  && RS.ltxPrompt("rain on her coat").endsWith(" rain on her coat"));
check("the Qwen edit prompt: <image1> the frame, <image2> the character, everything else kept",
  /^<image1> is a frame from a video\. Replace the person in <image1> with the character from <image2>/.test(RS.editPrompt(""))
  && /the pose, the expression, the hands, the camera framing, the lighting, the background/.test(RS.editPrompt("")));
check("ff names live in vidTemp per segment", RS.ffName("ab12", ".jpg") === "_ripple_ff_ab12.jpg" && RS.ffName("a/../b") === "_ripple_ff_ab.png");
{
  const st = { segments: [{ id: "a", ff: { job: "j1", status: "running" } }, { id: "b", ff: { job: "j2", status: "running" } },
                          { id: "c", ff: { job: "j3", status: "running" } }, { id: "d", ff: { file: "x.png", status: "done" } }] };
  const J = { j1: { status: "done", output: "o1.png" }, j2: { status: "failed", error: "OOM" }, j3: { status: "running" } };
  const r = RS.syncFirstFrames(st, (id) => J[id] || null, (g, out) => `_ripple_ff_${g.id}.png<-${out}`);
  const [a, b, c, d] = st.segments.map((g) => g.ff);
  check("syncFirstFrames: done -> moved in; failed -> why; running stays; done ones untouched",
    r.changed && a.status === "done" && a.file === "_ripple_ff_a.png<-o1.png" && a.job === "" && a.label === "✎ Qwen 2.1"
    && b.status === "failed" && b.error === "OOM" && c.status === "running" && d.file === "x.png", st.segments);
}
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ripple-"));
const vid = path.join(tmp, "movie.mp4"); fs.writeFileSync(vid, "x");
const ff = path.join(tmp, "ff.png"); fs.writeFileSync(ff, "x");
const WF = path.join(ROOT, "comfy_workflows", "LTX25_All_In_One.json");
const RWF = path.join(ROOT, "comfy_workflows", RS.WORKFLOW);
const p = RS.jobParams({ workflow: RWF, video: vid, start: 5.5, frames: 124, image: ff, text: "Replace only <Video 1>", seed: 9,
                         width: 1152, height: 768, steps: 10, strength: 1.2, loras: [{ path: "a.safetensors", weight: 0.6 }, { path: "" }] });
check("jobParams (2.342.0): mode ripple through Tim's workflow - the frame, the video from the segment, the size / steps / seed / strength / LoRAs",
  p.mode === "ripple" && p.workflow === RWF && p.image === ff && p.video === vid && p.start === 5.5 && p.width === 1152 && p.height === 768
  && p.steps === 10 && p.seed === 9 && p.strength === 1.2 && JSON.stringify(p.loras) === '[{"path":"a.safetensors","weight":0.6}]'
  && p.prompt.startsWith(RS.DEFAULT_PROMPT), p);
check("...129 rendered (8k+1 >= 124 + the still) -> 124 kept, the window", p.frames === 129 && p.trim_frames === 124
  && p.ripple.frames === 129 && Math.abs(p.dur - 124 / 24) < 1e-9, p);
check("jobParams refuses in words: a too-short segment, no workflow", /too short/.test(RS.jobParams({ frames: 3 }).error)
  && /LTX_Ripple_FFAF_Edit_v11_api\.json is missing - it ships in the full zip/.test(RS.jobParams({ frames: 124 }).error));
check("summary", /^LTX Ripple swap · 124 frames \(5\.17s from 5\.50s, rendered as 129\) · LTX25_Ripple_v11\.safetensors @ 1\.2 · 1152x768 · 10 steps · \+1 LoRA\(s\)$/.test(RS.summary(p)), RS.summary(p));
check("settings (2.342.0): the defaults (size from the video, 8 steps, random seed, 1.35, 2.343: render after the first frame), junk clamped",
  JSON.stringify(RS.settingsBlank()) === '{"auto_size":true,"width":0,"height":0,"steps":8,"seed_mode":"random","seed":0,"strength":1.35,"auto_render":true,"viggle_steps":3,"viggle_strength":1,"viggle_solattn":false,"viggle_safe":false,"vn_steps":4,"vn_shift":3}'
  && RS.settingsSafe({ auto_size: false, width: 1000, height: 10, steps: 999, seed_mode: "x", strength: 9 }).auto_size === true
  && RS.settingsSafe({ steps: 999 }).steps === 100 && RS.settingsSafe({ strength: 9 }).strength === 3);
check("sizeFor: the video's aspect at 768 (32-multiples), or the fixed size", JSON.stringify(RS.sizeFor({}, 1920, 1080)) === '{"width":1376,"height":768,"auto":true}'
  && JSON.stringify(RS.sizeFor({ auto_size: false, width: 1152, height: 768 }, 1920, 1080)) === '{"width":1152,"height":768,"auto":false}');
check("seedFor: fixed = the settings' seed, random = drawn", RS.seedFor({ seed_mode: "fixed", seed: 77 }, () => 5) === 77 && RS.seedFor({}, () => 5) === 5);

// ---- 2. the record
{
  const s = SS.safe({ engine: "ripple", segments: [{ id: "a", start: 0, dur: 124 / 24, frames: 124, ff: { file: "_ripple_ff_a.png", status: "done", label: "✎ Qwen 2.1" } },
                                                   { id: "b", start: 124 / 24, dur: 124 / 24, frames: 124 }],
                      results: [{ id: "r", seg: "a", status: "done", engine: "ripple" }, { id: "r2", seg: "b" }] });
  check("swapSession: engine, a segment's ff, a result's engine (old records = h3)", s.engine === "ripple"
    && s.segments[0].ff.file === "_ripple_ff_a.png" && !s.segments[1].ff && s.results[0].engine === "ripple" && s.results[1].engine === "h3"
    && SS.blank().engine === "h3" && SS.safe({ engine: "zzz" }).engine === "h3");
  const re = SS.setSegments(s, [{ start: 0, dur: 124 / 24, frames: 124 }, { start: 10, dur: 5, frames: 120 }]);
  check("a replan keeps a kept segment's first frame", re.segments[0].id === "a" && re.segments[0].ff.file === "_ripple_ff_a.png" && !re.segments[1].ff);
  check("addResult records the engine", SS.addResult(s, { seg: "a", engine: "ripple" }).result.engine === "ripple");
}

// ---- 3. the wiring
const R = read("routes", "swapdlg.js"), W = read("misc/ltx_worker.py"), G = read("scripts", "ltx_graph.py");
check("routes/swapdlg: the first-frame endpoints", ['app.post("/api/swapdlg/firstframe"', 'app.post("/api/swapdlg/firstframe/put"',
  'app.post("/api/swapdlg/firstframe/clear"', 'app.get("/api/swapdlg/ff/:id"'].every((k) => R.includes(k)));
check("routes/swapdlg: /set takes the engine; the view lists the engines",
  R.includes("if (b.engine != null) st.engine = RS.engineOf(b.engine);") && R.includes("engines: RS.ENGINES,"));
check("routes/swapdlg: a Ripple /run makes the missing first frames first, renders the ready ones",
  R.includes("if (RS.usesFirstFrame(st.engine)) {") && R.includes("const q = queueFirstFrame(st, seg, { text: b.text });")
  && R.includes("for (const g of todo.filter((x) => !firsts.includes(x.id))) {"));
check("routes/swapdlg: queue() -> queueRipple on the Ripple engine; retry keeps the result's engine; ⏫ refused on Ripple",
  R.includes("if (RS.usesFirstFrame(o.engine || st.engine)) return queueRipple(st, seg, { ...o, engine: o.engine || st.engine });") && R.includes("engine: r0.engine,")
  && R.includes("if (upscale && RS.usesFirstFrame(r0.engine))"));
check("routes/swapdlg: the first frame = the frame at the segment's start + the character -> the Qwen 2.1 edit style",
  R.includes('"-ss", (+seg.start || 0).toFixed(3), "-i", videoPath(st.video)') && R.includes("images: [frame, image], no_assets: true")
  && R.includes("prompt: RS.editPrompt(") && R.includes("/qwen.*2\\.1/i"));
check("routes/swapdlg: ⤓ = the picture saved last in the Image assets", R.includes('if (String(b.asset) === "@latest") {'));
check("routes/swapdlg: the current() poll files finished first frames", R.includes("RS.syncFirstFrames(st, jobOf, takeFirstFrame)"));
check("ltx_worker: the segment cut + uploaded whole, the IC-LoRA found in ComfyUI's list, the finish trims + muxes",
  W.includes("LG.ripple_cut_args(src, clip,") && W.includes('vd = {"name": up(clip, "segment clip"), "skip": 0}')
  && W.includes('ripple_lora(info.get("LTXICLoRALoaderModelOnly") or {}') && W.includes('"frames": int(rp["frames"]), "ic_lora": ic, "raw_guide": True')
  && W.includes("LG.ripple_finish_args(raw, clip, output_dir / name, int(rp[\"trim_frames\"]), has_a)"));
check("ltx_graph: the Ripple helpers", ["def ripple_size(", "def ripple_cut_args(", "def ripple_finish_args(", "tpad=stop_mode=clone"].every((k) => G.includes(k)));
const CAT = JSON.parse(read("lib", "modelCatalog.json")).models.find((m) => m.id === "ltx_ripple");
check("the catalog: LTX Ripple (WepeNerd/LTX-Ripple) -> comfy/loras", CAT && CAT.repo === "WepeNerd/LTX-Ripple" && CAT.file === RS.LORA && CAT.dest === "comfy/loras");
check("the image editor opens a picture for another window (window.ieOpenUrl)", read("ext", "imageeditdock", "mount.js").includes("window.ieOpenUrl = function (url, name) {"));

// ---- 4. the dialog (jsdom)
(async () => {
  let JSDOM;
  try { ({ JSDOM } = require("jsdom")); } catch { console.log("(jsdom missing - the dialog checks are skipped)"); return done(); }
  const dom = new JSDOM('<!doctype html><body><button id="vdSwapDlg">⇄ Swap</button></body>',
    { runScripts: "outside-only", pretendToBeVisual: true, url: "http://127.0.0.1/" });
  const w = dom.window, d = w.document;
  w.HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  w.HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
  w.HTMLMediaElement.prototype.pause = function () {};
  w.HTMLMediaElement.prototype.load = function () {};
  w.HTMLMediaElement.prototype.play = function () { return Promise.resolve(); };
  const calls = [];
  let STATE = { video: "movie.mp4", picture: "_swap_character.png", text: "", max: 5, ceiling: 362, max_seconds: 15.083, picture_url: "",
    engine: "h3", engines: RS.ENGINES, quality: "full",
    segments: [{ id: "s1", start: 0, dur: 124 / 24, frames: 124, ff: { file: "_ripple_ff_s1.png", status: "done", label: "✎ Qwen 2.1", at: 1 } },
               { id: "s2", start: 124 / 24, dur: 124 / 24, frames: 124, ff: { status: "running", job: "q2" } },
               { id: "s3", start: 248 / 24, dur: 124 / 24, frames: 124 }],
    results: [] };
  w.fetch = async (url, o) => {
    const body = o && o.body && typeof o.body === "string" ? JSON.parse(o.body) : (o && o.body) || null;
    calls.push({ url, body });
    const J = (x) => ({ ok: true, json: async () => x });
    if (url === "/api/swapdlg/set" && body && body.engine) { STATE = { ...STATE, engine: body.engine }; return J(STATE); }
    if (url === "/api/swapdlg") return J(STATE);
    if (url.startsWith("/api/swapdlg/info")) return J({ name: "movie.mp4", fps: 24, frames: 400, duration: 16, width: 640, height: 360 });
    if (url.startsWith("/api/frames")) return J({ key: "k", frames: [] });
    return J({ ...STATE, note: "ok" });
  };
  let opened = null;
  w.ieOpenUrl = (url, name) => { opened = { url, name }; return true; };
  w.eval(read("static", "swapdlg.js"));
  const SD = w.SwapDialog;
  SD.install({ size: () => ({ width: "960", height: "544" }), styleId: () => "", styleName: () => "", drag: () => null,
               refVideo: () => "", note: () => {}, confirm: async () => true, llmFile: () => "", refreshAssets: () => {} });
  d.getElementById("vdSwapDlg").dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 60));
  const dlg = d.querySelector("dialog.swdlg[open]");
  const eng = dlg && dlg.querySelector(".swBar .swEng");
  check("the video menubar: Engine (MiniMax H3 / LTX Ripple / Viggle (H3)), showing the record's", eng
    && Array.from(eng.options).map((x) => x.textContent).join() === "MiniMax H3,LTX Ripple,Viggle (H3),Viggle (native)" && eng.value === "h3");
  check("on H3: no first-frame strip, Quality + ⏫ Upscale shown", dlg.querySelector(".swFF").hidden && !dlg.querySelector(".swQualL").hidden
    && !dlg.querySelector(".swUp").hidden && dlg.querySelector(".swFFAll").hidden);
  eng.value = "ripple"; eng.dispatchEvent(new w.Event("change"));
  await new Promise((r) => setTimeout(r, 40));
  check("...changing it saves it (POST /api/swapdlg/set {engine})", calls.some((x) => x.url === "/api/swapdlg/set" && x.body && x.body.engine === "ripple"));
  const cards = Array.from(dlg.querySelectorAll(".swFF .swFFCard"));
  check("on Ripple: a first-frame card for each segment that HAS some (2.349.0: no empty placeholder) - the done one shows its picture, the running one says so",
    !dlg.querySelector(".swFF").hidden && cards.length === 2 && cards[0].querySelector('img[src^="/api/swapdlg/ff/s1?v="]')
    && /making/.test(cards[1].textContent) && !dlg.querySelector('.swFFCard[data-seg="s3"]'));
  check("on Ripple: Quality and ⏫ Upscale hidden, ✎ First frames shown", dlg.querySelector(".swQualL").hidden
    && dlg.querySelector(".swUp").hidden && !dlg.querySelector(".swFFAll").hidden);
  dlg.querySelector('.swFFCard[data-seg="s2"] [data-ff="make"]').click();
  await new Promise((r) => setTimeout(r, 20));
  let c = calls.filter((x) => x.url === "/api/swapdlg/firstframe").pop();
  check("✎ on a card: more first frames for that segment (the Direction text rides)", c && JSON.stringify(c.body.ids) === '["s2"]' && c.body.text === "");
  dlg.querySelector('.swChip[data-seg="s1"]').dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  dlg.querySelector(".swFFAll").click();
  await new Promise((r) => setTimeout(r, 20));
  c = calls.filter((x) => x.url === "/api/swapdlg/firstframe").pop();
  check("✎ First frames (2.349.0): ANOTHER first frame for the segment in the box - even one that has one (s1)", c && JSON.stringify(c.body.ids) === '["s1"]' && c.body.count === 1);
  dlg.querySelector('.swFFCard[data-seg="s1"] [data-ff="latest"]').click();
  await new Promise((r) => setTimeout(r, 20));
  c = calls.filter((x) => x.url === "/api/swapdlg/firstframe/put").pop();
  check("⤓: the last picture saved in the Image assets", c && c.body.id === "s1" && c.body.asset === "@latest");
  dlg.querySelector('.swFFCard[data-seg="s1"] [data-ff="edit"]').click();
  await new Promise((r) => setTimeout(r, 20));
  check("🖌: the frame opens in the Image editor, the dialog steps aside", opened && opened.url.startsWith("/api/swapdlg/ff/s1?v=")
    && /^ripple_first_0_00\.png$/.test(opened.name) && !d.querySelector("dialog.swdlg[open]"), opened);
  check("🖌 is off for a segment still making its first one", dlg.querySelector('.swFFCard[data-seg="s2"] [data-ff="edit"]').disabled);
  done();
})();
function done() {
  console.log(`RESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
