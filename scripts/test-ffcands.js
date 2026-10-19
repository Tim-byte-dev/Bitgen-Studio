#!/usr/bin/env node
/* bitGen Studio — 2.348.0: several ✎ first frames per segment, pick one.
 * Run: node scripts/test-ffcands.js
 * Tim: "allow user to generate multiple "first image" for a scene and let the
 * user select the one he wants to use, double click will do the preview,
 * single click will select the file".
 *   1. lib/rippleSwap: ffSafe keeps the candidates (an old single-file record
 *      becomes one), jobs; syncFirstFrames lands each run as a candidate and
 *      uses the newest; ffSelect / ffDrop;
 *   2. the wiring (routes/swapdlg): candidates never delete each other,
 *      /firstframe count, /select, ?f=, ✕ one, ▶ Swap ✎×N does not auto-render;
 *   3. static/swapdlg.js in jsdom: the strip, click = use it, double-click =
 *      the big preview, ✎×N sent. */
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

// ---- 1. the record
const old = RS.ffSafe({ file: "_ripple_ff_g1.png", status: "done", label: "✎ Qwen 2.1", at: 5 });
check("an older single-file first frame reads as ONE candidate (nothing lost)", JSON.stringify(old.cands) === '[{"file":"_ripple_ff_g1.png","label":"✎ Qwen 2.1","at":5}]'
  && old.file === "_ripple_ff_g1.png" && old.status === "done" && old.jobs.length === 0);
check("an older running record (job) reads as one pending run", JSON.stringify(RS.ffSafe({ job: "j9", status: "running" }).jobs) === '["j9"]'
  && RS.ffSafe({ job: "j9", status: "running" }).status === "running");
check("candidate names: the classic one first, then _2, _3", RS.ffCandName("g1", 1, ".png") === "_ripple_ff_g1.png" && RS.ffCandName("g1", 3, ".jpg") === "_ripple_ff_g1_3.jpg");
const st = { segments: [{ id: "g1", ff: { ...old, jobs: ["a", "b", "c"], status: "running" } }] };
const J = { a: { status: "done", output: "o_a.png" }, b: { status: "running" }, c: { status: "failed", error: "Qwen said no" } };
let r = RS.syncFirstFrames(st, (id) => J[id], (g, o) => "c_" + o);
let ff = st.segments[0].ff;
check("sync: a finished run lands as a candidate and is USED (the newest), a failed one says why, a running one stays",
  r.changed && ff.cands.map((c) => c.file).join() === "_ripple_ff_g1.png,c_o_a.png" && ff.file === "c_o_a.png" && JSON.stringify(ff.jobs) === '["b"]'
  && ff.status === "running" && ff.error === "Qwen said no", ff);
J.b = { status: "done", output: "o_b.png" };
RS.syncFirstFrames(st, (id) => J[id], (g, o) => "c_" + o);
ff = st.segments[0].ff;
check("...the last run done -> done, three candidates, the newest used", ff.status === "done" && ff.cands.length === 3 && ff.file === "c_o_b.png" && ff.jobs.length === 0);
const sel = RS.ffSelect(ff, "_ripple_ff_g1.png");
check("ffSelect: use an older one (its label with it); a stranger -> false", sel && sel.file === "_ripple_ff_g1.png" && sel.label === "✎ Qwen 2.1" && sel.cands.length === 3
  && RS.ffSelect(ff, "../swap_dialog.json") === false);
const d1 = RS.ffDrop(sel, "c_o_a.png");
check("ffDrop: a candidate that is not used -> gone, the used one stays", d1.removed === "c_o_a.png" && d1.ff.file === "_ripple_ff_g1.png" && d1.ff.cands.length === 2);
const d2 = RS.ffDrop(d1.ff);
check("ffDrop: the used one -> the newest left is used", d2.removed === "_ripple_ff_g1.png" && d2.ff.file === "c_o_b.png" && d2.ff.cands.length === 1);
check("ffDrop: the last one -> no first frame at all", RS.ffDrop(d2.ff).ff === null);
check("auto-render waits for ALL the runs of that press", (() => {
  const s2 = { segments: [{ id: "g", ff: { jobs: ["x", "y"], status: "running", auto: true, text: "t" } }] };
  const j2 = { x: { status: "done", output: "x.png" }, y: { status: "running" } };
  const a = RS.syncFirstFrames(s2, (id) => j2[id], (g, o) => o).ready.length;
  j2.y = { status: "done", output: "y.png" };
  const b = RS.syncFirstFrames(s2, (id) => j2[id], (g, o) => o).ready;
  return a === 0 && b.length === 1 && b[0].id === "g";
})());

// ---- 2. the wiring
const R = read("routes", "swapdlg.js");
check("a new first frame is a new candidate file - never deleting the others", R.includes("while (fs.existsSync(path.join(dir, name)) && n < 999) name = RS.ffCandName(seg.id, ++n, e);")
  && !R.includes('if (f.startsWith(RS.ffName(seg.id, ""))) fs.rmSync'));
check("/firstframe: count 1-4, adds to a segment already making some", R.includes("const n = Math.max(1, Math.min(RS.FF_MAX_COUNT, Math.round(+b.count || 1)));")
  && R.includes("g.ff = { ...ff0, jobs: [...ff0.jobs, ...ids], job: \"\", status: \"running\", error: \"\" };"));
check("/firstframe/select, ✕ one candidate, ?f= only this segment's", R.includes('app.post("/api/swapdlg/firstframe/select"') && R.includes("const d = RS.ffDrop(g.ff, b.file);")
  && R.includes("if (want && !(g && RS.ffSafe(g.ff).cands.some((c) => c.file === want))) return res.status(404)"));
check("▶ Swap with ✎×N>1 makes N and does NOT render on its own (pick first)", R.includes("const n = Math.max(1, Math.min(RS.FF_MAX_COUNT, Math.round(+b.ff_count || 1)));")
  && R.includes("...(n === 1 && RS.settingsSafe(st.settings).auto_render ?"));
check("2.349.0 ⇄ Swap: a segment with no picked first frame gets one made, one WITH a picked frame renders from it",
  R.includes("for (const g of todo.filter((x) => !ffReady(x))) {") && R.includes('const image = path.join(dir, (viggle ? "viggle_first" : "ripple_first") + path.extname(g.ff.file).toLowerCase());'));
check("a picked candidate renders even while more are being made", R.includes('(seg.ff.status === "done" || seg.ff.status === "running") && fs.existsSync(ffPath(seg))'));

// ---- 3. the dialog (jsdom)
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
  const cands = [{ file: "_ripple_ff_g1.png", label: "✎ Qwen 2.1", at: 1 }, { file: "_ripple_ff_g1_2.png", label: "✎ Qwen 2.1", at: 2 }, { file: "_ripple_ff_g1_3.png", label: "⤒ mine.png", at: 3 }];
  let STATE = { video: "movie.mp4", picture: "p.png", text: "", max: 2, ceiling: 362, max_seconds: 15, best_seconds: 5, picture_url: "",
    engine: "viggle", engines: [], quality: "full",
    segments: [{ id: "g1", start: 0, dur: 2, frames: 48, ff: { file: "_ripple_ff_g1_3.png", status: "done", label: "⤒ mine.png", at: 3, cands, jobs: [] } }],
    results: [], settings: {}, video_info: { width: 1920, height: 1080 }, render_size: { width: 864, height: 480, auto: true }, loras: [] };
  const calls = [];
  w.fetch = async (url, o) => {
    const body = o && typeof o.body === "string" ? JSON.parse(o.body) : null;
    calls.push({ url, body });
    const Jx = (x) => ({ ok: true, json: async () => x });
    if (url === "/api/swapdlg/firstframe/select") {
      STATE = { ...STATE, segments: [{ ...STATE.segments[0], ff: { ...STATE.segments[0].ff, file: body.file } }], note: "segment at 0s: first frame = x" };
      return Jx(STATE);
    }
    if (url.startsWith("/api/swapdlg/info")) return Jx({ name: "movie.mp4", fps: 24, frames: 48, duration: 2, width: 1920, height: 1080 });
    if (url.startsWith("/api/frames")) return Jx({ key: "k", frames: [] });
    return Jx(STATE);
  };
  w.eval(read("static", "swapdlg.js"));
  const SD = w.SwapDialog;
  SD.install({ size: () => ({}), styleId: () => "", styleName: () => "", drag: () => null, refVideo: () => "", note: () => {},
               confirm: async () => true, llmFile: () => "", refreshAssets: () => {} });
  d.getElementById("vdSwapDlg").dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  await new Promise((res) => setTimeout(res, 80));
  const dlg = d.querySelector("dialog.swdlg[open]");
  const q = (c) => dlg.querySelector("." + c);
  const card = dlg.querySelector(".swFFCard");
  const thumbs = card.querySelectorAll(".ffc");
  check("the card: the used picture + a strip of all three, the used one marked, 3/3 in its title line",
    card.querySelector("img.ffMain") && thumbs.length === 3 && thumbs[2].classList.contains("on") && !thumbs[0].classList.contains("on")
    && /· 3\/3/.test(card.firstChild.textContent) && /\?f=_ripple_ff_g1\.png/.test(thumbs[0].getAttribute("src")), card.firstChild.textContent);
  check("✎×N in the menubar (shown for the first-frame engines)", !q("swFFN").hidden && q("swFFN").options.length === 4);
  thumbs[0].dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  await new Promise((res) => setTimeout(res, 30));
  const s1 = calls.filter((c) => c.url === "/api/swapdlg/firstframe/select").pop();
  check("a single click on a candidate = use it (POST /select), the preview untouched", s1 && s1.body.id === "g1" && s1.body.file === "_ripple_ff_g1.png"
    && q("swPrevImg").hidden, s1 && s1.body);
  const t2 = dlg.querySelector(".swFFCard .ffc");
  check("...the strip repaints with it marked", t2.classList.contains("on"));
  const n0 = calls.length;
  t2.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  check("...clicking the one in use does nothing", calls.length === n0);
  dlg.querySelectorAll(".swFFCard .ffc")[1].dispatchEvent(new w.MouseEvent("dblclick", { bubbles: true }));
  check("a double-click on a candidate = the big preview (that candidate, 2/3)", !q("swPrevImg").hidden && /\?f=_ripple_ff_g1_2\.png/.test(q("swPrevImg").getAttribute("src"))
    && /first frame #1 at .* · 2\/3$/.test(q("swPrevBack").textContent), q("swPrevBack").textContent);
  q("swPrevBack").click();
  q("swFFN").value = "3";
  card.ownerDocument.querySelector(".swFFCard [data-ff=make]").click();
  await new Promise((res) => setTimeout(res, 30));
  const mk = calls.filter((c) => c.url === "/api/swapdlg/firstframe").pop();
  check("✎ on a card sends ✎×N (3)", mk && mk.body.count === 3 && JSON.stringify(mk.body.ids) === '["g1"]', mk && mk.body);

  // 2.349.0 (Tim: "when user clicks first frame button, create another image
  // for the first frame ... when user deletes the first frame image (x)
  // remove the placeholder and reorder the list of first frames")
  STATE = { ...STATE, segments: [
    { id: "g1", start: 0, dur: 2, frames: 48, ff: { file: "a.png", status: "done", cands: [{ file: "a.png", at: 1 }], jobs: [] } },
    { id: "g2", start: 2, dur: 2, frames: 48, ff: { file: "b.png", status: "done", cands: [{ file: "b.png", at: 2 }], jobs: [] } },
    { id: "g3", start: 4, dur: 2, frames: 48 }] };
  w.fetch = async (url, o) => {
    const body = o && typeof o.body === "string" ? JSON.parse(o.body) : null;
    calls.push({ url, body });
    const Jx = (x) => ({ ok: true, json: async () => x });
    if (url === "/api/swapdlg/firstframe/clear") {
      STATE = { ...STATE, segments: STATE.segments.map((g) => (g.id === body.id ? { id: g.id, start: g.start, dur: g.dur, frames: g.frames } : g)) };
      return Jx(STATE);
    }
    if (url === "/api/swapdlg/segments" && body.op === "add") {
      const seg = { id: "g9", start: body.start, dur: body.dur, frames: 48 };
      STATE = { ...STATE, segments: [...STATE.segments, seg] };
      return Jx({ ...STATE, seg });
    }
    if (url.startsWith("/api/swapdlg/info")) return Jx({ name: "movie.mp4", fps: 24, frames: 240, duration: 10, width: 1920, height: 1080 });
    if (url.startsWith("/api/frames")) return Jx({ key: "k", frames: [] });
    return Jx(STATE);
  };
  q("swFFN").value = "1";
  // repaint from the new state (a set round-trip)
  q("swEng").value = "viggle"; q("swEng").dispatchEvent(new w.Event("change"));
  await new Promise((res) => setTimeout(res, 40));
  let cards = Array.from(dlg.querySelectorAll(".swFFCard"));
  check("a card for each segment WITH first frames only - g3 (none) has no empty placeholder", cards.map((c) => c.dataset.seg).join() === "g1,g2"
    && !/no first frame/.test(q("swFF").textContent), cards.map((c) => c.dataset.seg));
  cards[0].querySelector("[data-ff=clear]").click();
  await new Promise((res) => setTimeout(res, 40));
  cards = Array.from(dlg.querySelectorAll(".swFFCard"));
  check("✕ the last first frame of g1 -> its card is gone, g2's moves up (still labelled #2)", cards.length === 1 && cards[0].dataset.seg === "g2"
    && /^#2 /.test(cards[0].firstChild.textContent), cards.map((c) => c.firstChild.textContent));
  // the box on no segment (0.5 s + 0.5 s): ✎ First frames makes it a segment first, then a first frame for it
  q("swDur").value = "0.5"; q("swDur").dispatchEvent(new w.Event("change"));
  q("swStart").value = "0.5"; q("swStart").dispatchEvent(new w.Event("change"));
  await new Promise((res) => setTimeout(res, 20));
  const before = calls.length;
  q("swFFAll").click();
  await new Promise((res) => setTimeout(res, 60));
  const after = calls.slice(before).map((c) => c.url + (c.body ? " " + JSON.stringify(c.body) : ""));
  const add = calls.slice(before).find((c) => c.url === "/api/swapdlg/segments");
  const ffm = calls.slice(before).find((c) => c.url === "/api/swapdlg/firstframe");
  check("✎ First frames with the box on no segment: the box becomes a segment, then ANOTHER first frame for it",
    add && add.body.op === "add" && Math.abs(add.body.start - 0.5) < 0.05 && ffm && JSON.stringify(ffm.body.ids) === '["g9"]' && ffm.body.count === 1, after);
  const before2 = calls.length;
  q("swFFAll").click();
  await new Promise((res) => setTimeout(res, 60));
  const again = calls.slice(before2);
  check("...pressed again (the box now on g9): just another first frame for g9, no second segment", !again.some((c) => c.url === "/api/swapdlg/segments")
    && again.some((c) => c.url === "/api/swapdlg/firstframe" && JSON.stringify(c.body.ids) === '["g9"]'), again.map((c) => c.url));
  done();
})();
function done() {
  console.log(`RESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
