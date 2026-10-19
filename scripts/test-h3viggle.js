#!/usr/bin/env node
/* bitGen Studio — 2.352.0: the H3_Viggle style, the app side.
 * Run: node scripts/test-h3viggle.js
 * Tim: "we should have a fl2va workflow too, can we incorporate viggle into these worklows but make it a
 * new viggle workflow?" - the scene's 🎬 motion video drives, the sheet (ref2va) or the first frame
 * (fl2va) performs, through ComfyUI's Viggle model.
 *   1. lib/h3Viggle: the style, /api/generate's refusals, the board plan per scene type, the length;
 *   2. the motion video on a scene (set / find / clear) + scenes.safe keeps it;
 *   3. routes/h3Viggle (captured app, scenes stubbed);
 *   4. the wiring: the starter, routes/index, routes/characters, worker.py, the video dock. */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
let pass = 0, fail = 0;
function check(name, ok, extra) {
  if (ok) { pass++; console.log("PASS: " + name); }
  else { fail++; console.log("FAIL: " + name + (extra !== undefined ? " :: " + JSON.stringify(extra).slice(0, 500) : "")); }
}
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const core = require(path.join(ROOT, "lib", "core"));
const HV = require(path.join(ROOT, "lib", "h3Viggle"));
const ST = require(path.join(ROOT, "lib", "styles"));
const scenes = require(path.join(ROOT, "lib", "scenes"));

// ---- 1. the lib
const starter = ST.STARTER_STYLES.find((x) => x.name === "H3_Viggle");
check("the H3_Viggle starter: a MiniMax H3 video style with a ref2va AND an fl2va Viggle workflow (no model/te/vae)",
  starter && starter.arch === "minimax-h3" && starter.workflows.ref2va === "comfy_workflows/H3_Viggle_ref2va.json"
  && starter.workflows.fl2va === "comfy_workflows/H3_Viggle_fl2va.json" && !starter.model && !starter.vae
  && Object.values(HV.WORKFLOWS).every((w) => fs.existsSync(path.join(ROOT, w))));
check("isViggleStyle: by name, or by its workflows (a renamed copy); not the other H3 styles",
  HV.isViggleStyle({ kind: "video", name: "H3_Viggle" }) && HV.isViggleStyle({ kind: "video", name: "Mine", workflows: { fl2va: "comfy_workflows/H3_Viggle_fl2va.json" } })
  && !HV.isViggleStyle({ kind: "video", name: "H3_Video_Ref", workflow: "comfy_workflows/ref2va.json" }) && !HV.isViggleStyle({ kind: "image", name: "H3_Viggle" }));
const S = { kind: "video", name: "H3_Viggle" };
check("/api/generate: t2va refused, no motion video refused, no picture refused - each in words; a good ref2va / fl2va passes",
  /pick ref2va \(the character sheet \/ picture performs it\) or fl2va/.test(HV.generateError(S, "t2va", ["v.mp4"], 1))
  && /needs a motion video - add the clip/.test(HV.generateError(S, "ref2va", [], 1))
  && /needs a picture - the first frame/.test(HV.generateError(S, "fl2va", ["v.mp4"], 0))
  && HV.generateError(S, "ref2va", ["v.mp4"], 1) === "" && HV.generateError(S, "fl2va", ["v.mp4"], 1) === ""
  && HV.generateError({ kind: "video", name: "H3_Video_Ref" }, "t2va", [], 0) === "");
const base = { style: S, motion: { file: "/m/motion.mp4", label: "dance.mp4" }, sheet: { file: "/c/ava.png", label: "Ava (ava.png)" },
  picture: null, first: null, cont: null, secs: 6, win: null, width: 480, height: 832, plan: null };
let p = HV.plan({ ...base, r: { n: 1, anchor: "reference", prompt: ["ava dances"], seed: "" } });
check("board, a Ref scene: ref2va - the first cast sheet performs the motion; length = the motion clip; Viggle's 3 steps; no PNG extraction",
  p.params && p.params.mode === "ref2va" && p.params.reference_files[0] === "/c/ava.png" && p.params.ref_videos[0] === "/m/motion.mp4"
  && p.params.frames === 144 && p.params.viggle === true && p.params.viggle_steps === 3 && p.params.seed === -1
  && /H3_Viggle ref2va - the sheet Ava \(ava.png\) performs the motion video dance.mp4, 144 frames \(6s\)/.test(p.note), p);
p = HV.plan({ ...base, first: { file: "/s/fl_first.png", label: "picked" }, r: { n: 2, anchor: "first", length: 120 } });
check("board, a First scene with its First picture: fl2va - the first frame performs; the row's own length",
  p.params.mode === "fl2va" && p.params.reference_files[0] === "/s/fl_first.png" && p.params.frames === 120 && /its First picture/.test(p.note), p.note);
p = HV.plan({ ...base, cont: { file: "/t/cont.png", label: "scene 1's last frame" }, r: { n: 2, anchor: "continue" }, win: { start: 4, dur: 8 } });
check("board, a Cont scene: fl2va from the frame it continues from; the song window is the length, the motion's last frame held past its end",
  p.params.mode === "fl2va" && p.params.reference_files[0] === "/t/cont.png" && p.params.frames === 192 && /its last frame is held to 8s/.test(p.note), p.note);
p = HV.plan({ ...base, r: { n: 3, anchor: "first" } });
check("board, a First scene with nothing to start on: the sheet performs (ref2va)", p.params.mode === "ref2va" && p.params.reference_files[0] === "/c/ava.png");
p = HV.plan({ ...base, motion: null, r: { n: 4 } });
check("board: no motion video -> the scene is refused in words (🎬 Motion on the scene card)", /scene 4 has no motion video - 🎬 Motion on the scene card/.test(p.error), p);
p = HV.plan({ ...base, sheet: null, r: { n: 5 } });
check("board: no sheet / picture / first frame -> refused in words", /scene 5 has no one to perform the motion/.test(p.error), p);

// ---- 2. the motion video on a scene
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "h3vg_"));
const orig = core.projDir;
core.projDir = () => tmp;
const vid = path.join(tmp, "src.mp4"); fs.writeFileSync(vid, "video");
const row = { n: 1, id: "clip_01" };
let out = HV.setMotion("p", row, vid, "video asset: src.mp4");
const m = HV.motionFor("p", row);
check("setMotion: copied into scene_refs/<scene id>/motion.mp4, the row carries {file, label}; motionFor finds it",
  out.ok && row.motion.file === "motion.mp4" && m && m.file === path.join(tmp, "scene_refs", "clip_01", "motion.mp4") && m.label === "video asset: src.mp4");
check("setMotion refuses a picture", HV.setMotion("p", row, path.join(tmp, "src.mp4"), "a.png").ok === true
  && (() => { const pic = path.join(tmp, "x.png"); fs.writeFileSync(pic, "p"); return HV.setMotion("p", { n: 2, id: "c2" }, pic, "x.png").ok === false; })());
check("clearMotion: the file and the field go", HV.clearMotion("p", row) && !row.motion && !fs.existsSync(path.join(tmp, "scene_refs", "clip_01", "motion.mp4")));
core.projDir = orig;
check("scenes: the row's motion survives the sanitizer and a plan rewrite", read("lib", "scenes.js").includes("      motion: slot(r.motion),")
  && read("lib", "scenes.js").includes("motion: o ? o.motion : undefined,"));

// ---- 3. the routes (captured app, scenes stubbed)
const handlers = {};
const app = { get: (p2, ...f) => { handlers["GET " + p2] = f[f.length - 1]; }, post: (p2, ...f) => { handlers["POST " + p2] = f[f.length - 1]; },
              delete: (p2, ...f) => { handlers["DELETE " + p2] = f[f.length - 1]; } };
const RH = require(path.join(ROOT, "routes", "h3Viggle"));
RH.mount(app);
check("routes: status + a scene's motion (set / upload / remove / get)", ["GET /api/h3viggle/status", "POST /api/scenes/:n/motion",
  "POST /api/scenes/:n/motion/upload", "DELETE /api/scenes/:n/motion", "GET /api/scenes/:n/motion"].every((k) => handlers[k]));
const resOf = () => { const r = { code: 200, body: null }; r.status = (c) => { r.code = c; return r; }; r.json = (b) => { r.body = b; return r; }; return r; };
const r0 = resOf(); handlers["GET /api/h3viggle/status"]({}, r0);
check("status: the flow, both workflows on disk, Viggle's steps", r0.body.flow === "H3_Viggle" && r0.body.workflows.ref2va && r0.body.workflows.fl2va && r0.body.steps === 3);
const board = { list: [{ n: 1, id: "clip_01" }, { n: 2, id: "clip_02", output: "take2.mp4", status: "rendered" }] };
const so = { load: scenes.load, save: scenes.save, pDir: core.pDir };
let saved = 0;
scenes.load = () => board; scenes.save = () => { saved++; return {}; };
fs.mkdirSync(path.join(tmp, "video"), { recursive: true });
fs.writeFileSync(path.join(tmp, "video", "dance.mp4"), "v"); fs.writeFileSync(path.join(tmp, "video", "take2.mp4"), "t");
core.pDir = () => path.join(tmp, "video");
core.projDir = () => tmp;
const r1 = resOf(); handlers["POST /api/scenes/:n/motion"]({ params: { n: "1" }, body: { kind: "asset", name: "dance.mp4" } }, r1);
check("POST motion (a Video asset): set on the scene, saved, said", r1.body && r1.body.ok && board.list[0].motion.label === "video asset: dance.mp4" && saved === 1
  && /scene 1's motion video: video asset: dance.mp4/.test(r1.body.note), r1.body);
const r2 = resOf(); handlers["POST /api/scenes/:n/motion"]({ params: { n: "1" }, body: { kind: "take", scene: 2 } }, r2);
check("POST motion (another scene's take)", r2.body.ok && board.list[0].motion.label === "scene 2's take");
const r3 = resOf(); handlers["POST /api/scenes/:n/motion"]({ params: { n: "1" }, body: { kind: "asset", name: "gone.mp4" } }, r3);
check("POST motion: a missing file is refused in words", r3.code === 400 && /gone.mp4 is not in the Video assets/.test(r3.body.error));
const r4 = resOf(); handlers["DELETE /api/scenes/:n/motion"]({ params: { n: "1" }, body: {}, query: {} }, r4);
check("DELETE motion: removed", r4.body.removed === true && !board.list[0].motion);
Object.assign(scenes, { load: so.load, save: so.save }); core.pDir = so.pDir; core.projDir = orig;
fs.rmSync(tmp, { recursive: true, force: true });

// ---- 4. the wiring
const IDX = read("routes", "index.js"), CH = read("routes", "characters.js"), W = read("worker.py"), VD = read("ext", "videodock", "characters.js");
check("routes/index: mounted; /api/generate asks lib/h3Viggle before queueing an H3_Viggle render",
  IDX.includes('require("./h3Viggle").mount(app);') && IDX.includes('const hvWhy = require("../lib/h3Viggle").generateError(vs, mode, refVideos, files.length);'));
check("routes/characters: the board's Workflow H3_Viggle queues through lib/h3Viggle.queue (⏫ refused); its style note",
  CH.includes("if (h3Viggle.isViggleFlow(st.style)) {") && CH.includes("return h3Viggle.queue(project, st, r);")
  && CH.includes("const note = h3Viggle.isViggleFlow(name) ? h3Viggle.STYLE_NOTE"));
check("worker.py: a Viggle graph is filled by scripts/h3viggle.py (no H3 patcher, no accelerators), chunk offsets, a black take refused, no PNG extraction",
  W.includes("import h3viggle as _hv") && W.includes("viggle = _is_viggle_graph(g)") && W.includes("and not viggle:")
  && W.includes('params["_chunk_offset"] = sum(c - 1 for c in chunks[:i - 1])') && W.includes("if viggle and _hv.black(out_path):")
  && W.includes("and not _viggle_job(params):"));
check("the video dock: the H3_Viggle flow, a 🎬 Motion slot on each scene (H3_Viggle board only), its picker (project videos / takes / file), ✕",
  VD.includes('["H3_Viggle", "H3_Viggle · motion video performed (ref2va / fl2va)"]];') && VD.includes('+ (scState.style === "H3_Viggle" ? scMotionSlot(r) : "")')
  && VD.includes('scPost("/api/scenes/" + n + "/motion", payload)') && VD.includes('fetch("/api/scenes/" + n + "/motion/upload"')
  && VD.includes('fetch("/api/scenes/" + b.dataset.scmotiondel + "/motion", { method: "DELETE"'));

// the dock's slot + picker in jsdom (the two functions lifted out of the extension)
(async () => {
  let JSDOM;
  try { ({ JSDOM } = require("jsdom")); } catch { console.log("(jsdom missing - the dock checks are skipped)"); return done(); }
  const grab = (name) => { const a = VD.indexOf("  function " + name + "("); let depth = 0, i = VD.indexOf("{", a);
    for (; i < VD.length; i++) { if (VD[i] === "{") depth++; else if (VD[i] === "}" && --depth === 0) break; } return VD.slice(a, i + 1); };
  const dom = new JSDOM('<!doctype html><body><div id="scNotes"></div></body>', { runScripts: "outside-only" });
  const w = dom.window;
  const posts = [];
  w.eval(`var scState = { style: "H3_Viggle", list: [{ n: 1, output: "" }, { n: 2, output: "take2.mp4", status: "rendered" }] };
    function el(id) { return document.getElementById(id); }
    function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;"); }
    var refreshed = 0; function scRefresh() { refreshed++; }
    function scPost(url, body) { window.__posts.push([url, body]); return Promise.resolve({ ok: true }); }
    window.bgMedia = { load: function () { return Promise.resolve([{ name: "dance.mp4", rel: "video/dance.mp4", group: "Assets", asset: true },
      { name: "walk.mov", rel: "refs/walk.mov", group: "References" }]); } };
    ${grab("scMotionSlot")}
    ${grab("scMotionPicker")}
    window.api = { scMotionSlot: scMotionSlot, scMotionPicker: scMotionPicker, refreshed: function () { return refreshed; } };`);
  w.__posts = posts;
  const d = w.document;
  d.body.insertAdjacentHTML("beforeend", w.api.scMotionSlot({ n: 1 }) + w.api.scMotionSlot({ n: 2, motion: { file: "motion.mp4", label: "video asset: dance.mp4" } }));
  check("slot: none -> 'H3_Viggle needs one' + choose…; set -> its label + ✕ + change",
    /none - H3_Viggle needs one/.test(d.querySelector('[data-scmotion="1"]').textContent) && d.querySelector('[data-scmotionpick="1"]').textContent === "choose…"
    && d.querySelector('[data-scmotionname="2"]').textContent === "video asset: dance.mp4" && d.querySelector('[data-scmotiondel="2"]')
    && d.querySelector('[data-scmotionpick="2"]').textContent === "change");
  const ov = w.api.scMotionPicker(1);
  await new Promise((r) => setTimeout(r, 20));
  ov.querySelector('[data-mvrel="video/dance.mp4"]').click();
  await new Promise((r) => setTimeout(r, 20));
  const ov2 = w.api.scMotionPicker(1);
  await new Promise((r) => setTimeout(r, 20));
  ov2.querySelector('[data-mvrel="refs/walk.mov"]').click();
  await new Promise((r) => setTimeout(r, 20));
  const ov3 = w.api.scMotionPicker(1);
  ov3.querySelector('[data-mvtab="takes"]').click();
  ov3.querySelector('[data-mvtake="2"]').click();
  await new Promise((r) => setTimeout(r, 20));
  check("picker: a Video asset by name, any project video by its path, another scene's take - each posted to the scene's motion; closed + refreshed",
    JSON.stringify(posts) === JSON.stringify([["/api/scenes/1/motion", { kind: "asset", name: "dance.mp4" }],
      ["/api/scenes/1/motion", { kind: "project", rel: "refs/walk.mov" }], ["/api/scenes/1/motion", { kind: "take", scene: 2 }]])
    && !d.getElementById("scMotionPick") && w.api.refreshed() === 3, posts);
  done();
})();
function done() {
  console.log(`RESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
