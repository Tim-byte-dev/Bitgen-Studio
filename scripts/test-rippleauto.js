#!/usr/bin/env node
/* bitGen Studio — 2.343.0: LTX Ripple renders as soon as its ✎ first frame is
 * made, and a failed render says why. Run: node scripts/test-rippleauto.js
 * Tim: "[swap] 1 segment(s) queued - they render one at a time, ltx doesn't
 * start the render after the picture is generated".
 *   1. the record: ⚙ auto_render (on by default), the first frame's auto flag;
 *   2. syncFirstFrames hands back the segments to render (and forgets the flag);
 *   3. SS.workerError / SS.sync: the worker's own ERROR line on the row;
 *   4. the wiring in routes/swapdlg.js;
 *   5. static/swapdlg.js in jsdom: the ⚙ checkbox, the news line. */
"use strict";
const fs = require("fs");
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

// ---- 1. the record
check("⚙ auto_render: on by default, off kept, junk = on", RS.settingsBlank().auto_render === true && RS.settingsSafe({}).auto_render === true
  && RS.settingsSafe({ auto_render: false }).auto_render === false && RS.settingsSafe({ auto_render: "no" }).auto_render === true);
check("the first frame keeps ▶ Swap's auto flag + its prompt (and nothing when not asked)",
  JSON.stringify(RS.ffSafe({ job: "j", status: "running", auto: 1, text: "hi" })).includes('"auto":true,"text":"hi"')
  && !("auto" in RS.ffSafe({ job: "j", status: "running" })));
check("...through the saved record", (() => {
  const st = SS.safe({ segments: [{ id: "a", start: 0, dur: 2, frames: 48, ff: { job: "j", status: "running", auto: true, text: "t" } }] });
  return st.segments[0].ff.auto === true && st.segments[0].ff.text === "t";
})());

// ---- 2. syncFirstFrames
const segs = () => ({ segments: [
  { id: "a", ff: { job: "ja", status: "running", auto: true, text: "go" } },
  { id: "b", ff: { job: "jb", status: "running" } },
  { id: "c", ff: { job: "jc", status: "running", auto: true } },
  { id: "d", ff: { job: "jd", status: "running", auto: true } }] });
const jobs = { ja: { status: "done", output: "a.png" }, jb: { status: "done", output: "b.png" }, jc: { status: "failed", error: "boom" }, jd: { status: "running" } };
const st = segs();
const r = RS.syncFirstFrames(st, (id) => jobs[id], (g) => "_ripple_ff_" + g.id + ".png");
check("done + ▶ Swap asked -> handed back to render (with its prompt); done without the flag -> not; failed -> not; still running -> not",
  JSON.stringify(r.ready) === '[{"id":"a","text":"go"}]', r.ready);
check("...the flag is forgotten once the frame is done or failed (never rendered twice), kept while it runs",
  !("auto" in st.segments[0].ff) && !("auto" in st.segments[2].ff) && st.segments[3].ff.auto === true && st.segments[2].ff.error === "boom");

// ---- 3. the reason
check("workerError: the worker's last ERROR line", SS.workerError(["[worker] x", "[worker] ERROR: first", "[worker] ERROR: ComfyUI does not have these node types: Frames Slice (RES4LYF)", "[bitgen-studio] worker exited with code 1."])
  === "ComfyUI does not have these node types: Frames Slice (RES4LYF)");
check("workerError: a crash -> the traceback's last line", SS.workerError(["Traceback (most recent call last):", '  File "x.py", line 3', "ModuleNotFoundError: No module named 'ripple_graph'"])
  === "the worker crashed: ModuleNotFoundError: No module named 'ripple_graph'");
check("workerError: nothing useful -> empty", SS.workerError(["[worker] fine"]) === "" && SS.workerError(null) === "");
const s2 = SS.sync({ results: [{ id: "r1", seg: "a", job: "x", status: "running" }, { id: "r2", seg: "b", job: "y", status: "running" }] },
  (id) => (id === "x" ? { status: "failed", error: "the LTX Ripple LoRA is not in ComfyUI's loras folder" } : { status: "failed", error: "" }), () => "");
check("sync: a failed row carries the reason; with none the old words", s2.state.results[0].error === "the render failed: the LTX Ripple LoRA is not in ComfyUI's loras folder"
  && s2.state.results[1].error === "the render failed - see the job's log", s2.state.results);

check("2.345.0 workerError: the lines the error goes on with are the reason too (Tim: \"rejected the workflow:\" and nothing after it)",
  SS.workerError(["[worker] ===== chunk 1/1", "[worker] ERROR: ComfyUI rejected the workflow:", "Prompt outputs failed validation",
    "  node 821: Value not in list [unet_name] = ltx.safetensors", "[bitgen-studio] worker exited with code 1."])
  === "ComfyUI rejected the workflow: Prompt outputs failed validation · node 821: Value not in list [unet_name] = ltx.safetensors",
  SS.workerError(["[worker] ERROR: ComfyUI rejected the workflow:", "Prompt outputs failed validation"]));
check("2.345.0 a long reason survives the saved record (800)", SS.safe({ results: [{ id: "r", seg: "a", job: "j", status: "failed", error: "x".repeat(900) }] }).results[0].error.length === 800);
check("2.345.0 a new video that looks nothing like VR switches VR off (Tim's flat video + VR left on -> \"stereo VR needs OpenCV\")",
  read("routes", "swapdlg.js").includes('else if (!d.mode && st.vr.mode !== "off") st.vr = SS.vrSafe({ ...st.vr, mode: "off" });')
  && (read("routes", "swapdlg.js").match(/vrForNew\(st, /g) || []).length === 3 && SS.detectVr("clip.mp4", 1344, 768).mode === "");

// ---- 4. the wiring
const R = read("routes", "swapdlg.js");
check("jobOf: a failed job's error = the worker's own line", R.includes('error: j.error || (j.status === "failed" ? SS.workerError(j.log) : "")'));
check("current(): each segment handed back is queued (not twice, only on Ripple, with the character), a refusal lands on its card",
  R.includes("for (const w of f.ready || [])") && R.includes("if (!seg || !RS.usesFirstFrame(st.engine) || !st.picture) continue;")
  && R.includes("const q = queue(st, seg, { text: w.text });") && R.includes('error: "▶ could not start the render: " + q.error'));
check("▶ Swap marks the first frames it makes (⚙ on; 2.348: only when it makes ONE - several = pick first), the note says it renders next",
  R.includes("...(n === 1 && RS.settingsSafe(st.settings).auto_render ? { auto: true, text:") && R.includes("each segment renders as soon as its frame is made"));

// ---- 5. the dialog (jsdom)
(async () => {
  let JSDOM;
  try { ({ JSDOM } = require("jsdom")); } catch { console.log("(jsdom missing - the dialog checks are skipped)"); return done(); }
  const dom = new JSDOM('<!doctype html><body><button id="vdSwapDlg">⇄ Swap</button></body>', { runScripts: "outside-only", pretendToBeVisual: true, url: "http://127.0.0.1/" });
  const w = dom.window, d = w.document;
  w.HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  w.HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
  w.HTMLMediaElement.prototype.pause = function () {};
  w.HTMLMediaElement.prototype.load = function () {};
  w.HTMLMediaElement.prototype.play = function () { return Promise.resolve(); };
  const seg = { id: "g1", start: 0, dur: 2, frames: 48 };
  let STATE = { video: "movie.mp4", picture: "p.png", text: "", max: 2, ceiling: 362, max_seconds: 15, best_seconds: 5, picture_url: "",
    engine: "ripple", engines: [], quality: "full", segments: [{ ...seg, ff: { status: "running", job: "j" } }], results: [],
    settings: { auto_size: true, width: 0, height: 0, steps: 8, seed_mode: "random", seed: 0, strength: 1.35, auto_render: true },
    video_info: { width: 1920, height: 1080 }, render_size: { width: 1376, height: 768, auto: true }, loras: [] };
  const calls = [];
  w.fetch = async (url, o) => {
    const body = o && typeof o.body === "string" ? JSON.parse(o.body) : null;
    calls.push({ url, body });
    const J = (x) => ({ ok: true, json: async () => x });
    if (url === "/api/swapdlg/set" && body && body.settings) { STATE = { ...STATE, settings: { ...STATE.settings, ...body.settings } }; return J(STATE); }
    if (url === "/api/swapdlg") return J(STATE);
    if (url.startsWith("/api/swapdlg/info")) return J({ name: "movie.mp4", fps: 24, frames: 48, duration: 2, width: 1920, height: 1080 });
    if (url.startsWith("/api/frames")) return J({ key: "k", frames: [] });
    return J(STATE);
  };
  w.mountTempLoras = () => {};
  w.eval(read("static", "swapdlg.js"));
  const SD = w.SwapDialog;
  SD.install({ size: () => ({}), styleId: () => "", styleName: () => "", drag: () => null, refVideo: () => "", note: () => {},
               confirm: async () => true, llmFile: () => "", refreshAssets: () => {} });
  d.getElementById("vdSwapDlg").dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  await new Promise((res) => setTimeout(res, 60));
  const dlg = d.querySelector("dialog.swdlg[open]");
  dlg.querySelector(".swBar .swSet").click();
  await new Promise((res) => setTimeout(res, 20));
  const sd = d.querySelector("dialog.swSetDlg[open]");
  const box = sd && sd.querySelector(".ssAutoRender");
  check("⚙: the \"▶ render as soon as the ✎ first frame is made\" box, ticked by default", box && box.checked && /render as soon as the ✎ first frame is made/.test(box.parentNode.textContent));
  box.checked = false;
  await SD._api.saveSettings();
  const c = calls.filter((x) => x.url === "/api/swapdlg/set").pop();
  check("...Save sends auto_render: false", c && c.body.settings.auto_render === false, c && c.body);
  const F = SD._api.failNews;
  const A = { segments: [{ id: "g1", ff: { status: "running" } }, { id: "g2", ff: { status: "running" } }], results: [{ id: "r0", seg: "g2", status: "running", engine: "ripple" }] };
  const B = { segments: [{ id: "g1", ff: { status: "done" } }, { id: "g2", ff: { status: "failed", error: "Qwen said no" } }],
              results: [{ id: "r0", seg: "g2", status: "failed", engine: "ripple", error: "the render failed: ComfyUI does not have LTXAddVideoICLoRAGuide" },
                        { id: "r1", seg: "g1", status: "queued", engine: "ripple" }] };
  const n = F(A, B);
  check("the news line: a render that started on its own, a failed render WITH its reason, a failed first frame",
    /▶ #1 has its first frame - rendering with LTX Ripple/.test(n) && /⚠ #2 the render failed: ComfyUI does not have LTXAddVideoICLoRAGuide/.test(n)
    && /⚠ #2 first frame: Qwen said no/.test(n), n);
  check("...nothing to say when nothing changed; a row ▶ Swap itself queued is not re-announced",
    F(B, B) === "" && F({ segments: [{ id: "g1", ff: { status: "done" } }], results: [] }, { segments: [{ id: "g1", ff: { status: "done" } }], results: [{ id: "r9", seg: "g1", status: "queued", engine: "ripple" }] }) === "");
  done();
})();
function done() {
  console.log(`RESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
