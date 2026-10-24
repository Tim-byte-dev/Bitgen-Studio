#!/usr/bin/env node
/* bitGen Studio — 2.325.0: THE REFERENCE VIDEO SELECTION DIALOG.
 * Run: node scripts/test-refselect.js
 * Tim: "when user clicks a video in the reference docker show a dialog,
 * show filmstrip of the clicked reference video and preview. show a
 * selection box ... the length of the duration input ... zoom in and out
 * ... the selected portion will be the reference video for generation ...
 * show the selected region in the preview only, add an apply and cancel".
 *   1. lib/refSelect: fps parse, plan (frames, clamps), names, and a REAL
 *      ffmpeg cut (frame count, fps, audio), the registry, reopen-on-source;
 *   2. the wiring (routes/refvideo.js mounted from routes/index.js);
 *   3. static/refselect.js in jsdom: the pure maths, the dialog, the box,
 *      zoom limits, the region-only preview, Apply / Cancel;
 *   4. the reference dock: a click opens it, Apply replaces the slot. */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
let pass = 0, fail = 0;
function check(name, ok, extra) {
  if (ok) { pass++; console.log("PASS: " + name); }
  else { fail++; console.log("FAIL: " + name + (extra !== undefined ? " :: " + JSON.stringify(extra) : "")); }
}
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const RS = require(path.join(ROOT, "lib", "refSelect"));

// ---- 1. lib/refSelect
check("fpsOf: 30000/1001, 25/1, 24; junk = 0",
  Math.abs(RS.fpsOf("30000/1001") - 29.97) < 0.01 && RS.fpsOf("25/1") === 25 && RS.fpsOf("24") === 24
  && RS.fpsOf("0/0") === 0 && RS.fpsOf("x") === 0);
const info = { fps: 25, frames: 150 };
let p = RS.plan(info, 1.23, 2);
check("plan: start snapped to a frame, the duration to a frame count, the end frame",
  p.startFrame === 31 && p.frames === 50 && p.endFrame === 80 && p.start === 1.24 && p.dur === 2 && !p.whole, p);
p = RS.plan(info, 5.5, 2);
check("plan: a box past the end slides back inside the video", p.startFrame === 100 && p.endFrame === 149, p);
p = RS.plan(info, 0, 99);
check("plan: longer than the video = the whole video (whole)", p.frames === 150 && p.whole, p);
check("plan: blank duration = the whole video; negative start = 0",
  RS.plan(info, -3, "").whole && RS.plan(info, -3, 1).startFrame === 0);
check("cutName: <stem>_sel_f<a>-f<b>.mp4, and a cut of a cut names the SOURCE stem",
  RS.cutName("dance.mov", { startFrame: 3, endFrame: 40 }) === "dance_sel_f3-f40.mp4"
  && RS.cutName("dance_sel_f3-f40.mp4", { startFrame: 5, endFrame: 9 }) === "dance_sel_f5-f9.mp4");

const hasFF = !spawnSync("ffmpeg", ["-version"]).error && !spawnSync("ffprobe", ["-version"]).error;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "rsel-"));
try {
  if (hasFF) {
    const proj = path.join(tmp, "proj"), vid = path.join(proj, "video");
    fs.mkdirSync(vid, { recursive: true });
    spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc=size=320x180:rate=25:duration=6",
      "-f", "lavfi", "-i", "sine=frequency=500:duration=6", "-shortest", "-c:v", "libx264", "-pix_fmt", "yuv420p",
      "-c:a", "aac", path.join(vid, "dance.mp4")]);
    const pr = RS.probe(path.join(vid, "dance.mp4"));
    check("probe: fps, frames, size, audio", pr && pr.fps === 25 && pr.frames === 150 && pr.width === 320
      && pr.height === 180 && pr.audio === true, pr);
    const d0 = RS.describe(proj, vid, "dance.mp4");
    check("describe: a plain video opens on itself, no selection yet",
      d0.source === "dance.mp4" && d0.selection === null && d0.frames === 150, d0);
    const s1 = RS.select(proj, vid, "dance.mp4", 1, 2);
    check("select: the frames are cut into dance_sel_f25-f74.mp4 (said)",
      s1.ok && s1.cut && s1.name === "dance_sel_f25-f74.mp4" && fs.existsSync(path.join(vid, s1.name))
      && /frames 25-74 of dance\.mp4/.test(s1.note), s1);
    const pc = RS.probe(path.join(vid, s1.name));
    check("select: the cut is EXACTLY the selected frames, the source fps, with its audio",
      pc && pc.frames === 50 && pc.fps === 25 && pc.audio === true, pc);
    const fr = spawnSync("ffmpeg", ["-v", "error", "-i", path.join(vid, s1.name), "-frames:v", "1", "-f", "image2pipe",
      "-vcodec", "png", "-"], { encoding: "buffer" });
    check("select: the cut decodes", fr.status === 0 && fr.stdout.length > 100);
    check("select: the registry remembers the source and frames",
      RS.read(proj)[s1.name].source === "dance.mp4" && RS.read(proj)[s1.name].startFrame === 25);
    const d1 = RS.describe(proj, vid, s1.name);
    check("describe: clicking the CUT reopens the SOURCE with the box where it was",
      d1.source === "dance.mp4" && d1.name === s1.name && d1.selection.startFrame === 25
      && d1.selection.endFrame === 74 && d1.frames === 150, d1);
    const m1 = fs.statSync(path.join(vid, s1.name)).mtimeMs;
    const s2 = RS.select(proj, vid, "dance.mp4", 1, 2);
    check("select: the same selection reuses its cut (no second encode)",
      s2.name === s1.name && fs.statSync(path.join(vid, s1.name)).mtimeMs === m1);
    const w = RS.select(proj, vid, "dance.mp4", 0, 60);
    check("select: the whole video = no cut, the source is the reference",
      w.ok && !w.cut && w.name === "dance.mp4", w);
    check("select / describe: refusals in words (missing, not a video)",
      /no such video/.test(RS.select(proj, vid, "nope.mp4", 0, 1).error)
      && /not a video/.test(RS.describe(proj, vid, "x.png").error));
    fs.unlinkSync(path.join(vid, "dance.mp4"));
    fs.writeFileSync(path.join(vid, "stand.mp4"), fs.readFileSync(path.join(vid, s1.name)));
    const d2 = RS.describe(proj, vid, s1.name);
    check("describe: a cut whose source is gone opens on itself", d2.source === s1.name, d2);
  } else console.log("(ffmpeg not on PATH - the real cut checks are skipped)");
} finally { fs.rmSync(tmp, { recursive: true, force: true }); }

// ---- 2. wiring
check("routes/index.js mounts routes/refvideo.js (server.js untouched)",
  /require\("\.\/refvideo"\)\.mount\(app\)/.test(read("routes", "index.js")) && !/refvideo/.test(read("misc/server.js")));
const rv = read("routes", "refvideo.js");
check("routes/refvideo.js: GET + POST /api/refvideo/select over lib/refSelect",
  rv.includes('app.get("/api/refvideo/select"') && rv.includes('app.post("/api/refvideo/select"')
  && /rsel\.describe\(/.test(rv) && /rsel\.select\(/.test(rv));

// ---- 3 + 4. the dialog + the dock (jsdom)
const html = read("static", "index.html");
check("the page loads static/refselect.js", html.includes('<script src="/static/refselect.js"></script>'));
check("the reference dock: a video click opens the dialog (not the lightbox); ▶ / ✕ keep their jobs",
  html.includes("el.onclick = (e) => { if (!e.target.closest(\"button, select\")) openRefSelect(i); };")   // 2.388.0: + the Use dropdown
  && html.includes("el.dataset.refvid = n;") && !/refVids\.forEach\(\(n, i\) => \{[\s\S]{0,300}lbUrl/.test(html));
check("the reference dock: Apply puts the cut in THAT slot",
  html.includes("if (at >= 0) refVids[at] = name; else refVids.push(name);"));

(async () => {
  let JSDOM;
  try { ({ JSDOM } = require("jsdom")); } catch { console.log("(jsdom missing - the dialog checks are skipped)"); return; }
  const dom = new JSDOM("<!doctype html><head></head><body></body>", { runScripts: "outside-only", pretendToBeVisual: true });
  const w = dom.window;
  w.HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  w.HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
  w.HTMLMediaElement.prototype.pause = function () {};
  w.HTMLMediaElement.prototype.load = function () {};
  const calls = [];
  const INFO = { name: "clip_sel_f25-f74.mp4", source: "clip.mp4", fps: 25, frames: 250, duration: 10,
                 width: 1280, height: 720, audio: true,
                 selection: { start: 1, dur: 2, startFrame: 25, endFrame: 74 } };
  const fakeFetch = async (url, o) => {
    calls.push({ url, o });
    if (url.startsWith("/api/refvideo/select?")) return { json: async () => INFO };
    if (url.startsWith("/api/frames")) {
      const u = new URL("http://x" + url), st = +u.searchParams.get("start"), en = +u.searchParams.get("end"),
            f = +u.searchParams.get("fps");
      const frames = [];
      for (let t = st, i = 0; t < en - 1e-9; t += 1 / f, i++) frames.push({ i, t, file: `f${String(i + 1).padStart(5, "0")}.jpg` });
      return { json: async () => ({ key: "abcd1234", frames }) };
    }
    if (url === "/api/refvideo/select") {
      const b = JSON.parse(o.body);
      return { json: async () => ({ ok: true, cut: true, name: "clip_sel_f50-f99.mp4", note: "n", got: b }) };
    }
    return { json: async () => ({}) };
  };
  w.eval(read("static", "refselect.js"));
  const R = w.RefSelect;
  check("snapSel: frames, clamped inside the video",
    JSON.stringify(R.snapSel(1.01, 2, 25, 250)) === JSON.stringify({ startFrame: 25, frames: 50, endFrame: 74, start: 1, dur: 2 })
    && R.snapSel(9.5, 2, 25, 250).startFrame === 200 && R.snapSel(0, 99, 25, 250).frames === 250);
  check("thumbStep: one thumbnail width, never finer than a frame, whole frames",
    R.thumbStep(96, 96, 24) === 1 && Math.abs(R.thumbStep(1e6, 96, 24) - 1 / 24) < 1e-6
    && Math.abs(R.thumbStep(100, 96, 25) * 25 - Math.round(R.thumbStep(100, 96, 25) * 25)) < 1e-6);
  const zz = R.zoomRange(600, 10, 25, 96);
  check("zoomRange: the whole video in view .. one thumbnail per frame", zz.min === 60 && zz.max === 2400, zz);
  let applied = null, cancelled = 0;
  const c = await R.open({ name: "clip_sel_f25-f74.mp4", fetch: fakeFetch,
                           onApply: (n, d) => { applied = { n, d }; }, onCancel: () => { cancelled++; } });
  const dlg = w.document.querySelector("dialog.refsel");
  check("open: the dialog shows the SOURCE (reopened from the cut) with preview, filmstrip, box, inputs, zoom, Apply / Cancel",
    dlg && dlg.hasAttribute("open") && dlg.querySelector("video.rsPrev").getAttribute("src") === "/passets/video/clip.mp4"
    && dlg.querySelector(".rsView .rsBox") && dlg.querySelector(".rsDur") && dlg.querySelector(".rsZoomR")
    && dlg.querySelector(".rsApply") && dlg.querySelector(".rsCancel")
    && /reopened from clip_sel_f25-f74\.mp4/.test(dlg.querySelector(".rsName").textContent));
  const box = dlg.querySelector(".rsBox");
  check("the box starts at the remembered selection, as wide as the Duration input",
    c.sel.startFrame === 25 && c.sel.endFrame === 74 && dlg.querySelector(".rsDur").value === "2.000"
    && parseFloat(box.style.left) === 1 * c.pps && parseFloat(box.style.width) === 2 * c.pps
    && /f25 – f74/.test(box.textContent), [box.style.left, box.style.width, c.pps]);
  const durIn = dlg.querySelector(".rsDur");
  durIn.value = "3.03"; durIn.dispatchEvent(new w.Event("change"));
  check("Duration input: the box width follows it (snapped to frames: 3.03 s -> 76 frames)",
    c.sel.frames === 76 && Math.abs(parseFloat(box.style.width) - c.sel.dur * c.pps) < 1e-6
    && /76 frames/.test(dlg.querySelector(".rsDurF").textContent), c.sel);
  c.setSel(9, c.sel.dur);
  check("the box cannot leave the video (end frame = the last frame)", c.sel.endFrame === 249, c.sel);
  box.dispatchEvent(new w.KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
  check("← moves the box one frame", c.sel.endFrame === 248, c.sel);
  const before = c.pps;
  dlg.querySelector(".rsIn").click();
  check("+ zooms in (the box and ruler rescale)", c.pps > before
    && Math.abs(parseFloat(box.style.width) - c.sel.dur * c.pps) < 1e-6);
  c.setZoom(1e9);
  check("zoom stops at one thumbnail per frame", c.pps === c.zoomRange().max, c.pps);
  dlg.querySelector(".rsFit").click();
  check("Fit: the whole video in view", c.pps === c.zoomRange().min, c.pps);
  c.loadNow();
  await new Promise((r) => setTimeout(r, 30));
  const fr = calls.filter((x) => x.url.startsWith("/api/frames"));
  check("filmstrip: thumbnails come from /api/frames for the SOURCE, chunk by chunk",
    fr.length >= 1 && fr.every((x) => /name=clip\.mp4/.test(x.url) && /src=video/.test(x.url))
    && dlg.querySelectorAll(".rsThumbs img").length > 0
    && /^\/framecache\/abcd1234\/f\d+\.jpg$/.test(dlg.querySelector(".rsThumbs img").getAttribute("src")), fr.map((x) => x.url));
  // the preview plays only the region
  const v = dlg.querySelector("video.rsPrev");
  let ct = 0;
  Object.defineProperty(v, "currentTime", { get: () => ct, set: (x) => { ct = x; }, configurable: true });
  c.setSel(2, 1);
  ct = 7.5; v.dispatchEvent(new w.Event("timeupdate"));
  check("preview: a time outside the box is pulled back to its start", ct === 2, ct);
  ct = 2.5; v.dispatchEvent(new w.Event("timeupdate"));
  check("preview: inside the box it plays on", ct === 2.5, ct);
  ct = 2.999; v.dispatchEvent(new w.Event("timeupdate"));
  check("preview: at the box's end it loops to the start", ct === 2, ct);
  const res = await c.apply();
  const post = calls.find((x) => x.url === "/api/refvideo/select");
  check("Apply: POSTs the source + the snapped start / duration, closes, hands the new name back",
    res && post && JSON.parse(post.o.body).source === "clip.mp4" && JSON.parse(post.o.body).start === 2
    && JSON.parse(post.o.body).dur === 1 && applied && applied.n === "clip_sel_f50-f99.mp4"
    && !w.document.querySelector("dialog.refsel"), post && post.o.body);
  await R.open({ name: "clip.mp4", fetch: fakeFetch, onApply: () => { throw new Error("no"); },
                 onCancel: () => { cancelled++; } });
  w.document.querySelector("dialog.refsel .rsCancel").click();
  check("Cancel: closes, nothing posted, onCancel", cancelled === 1 && !w.document.querySelector("dialog.refsel")
    && calls.filter((x) => x.url === "/api/refvideo/select").length === 1);
  // the dock wiring: openRefSelect replaces the slot
  const src = html.match(/function openRefSelect\(i\) \{[\s\S]*?\n\}/);
  check("openRefSelect found", !!src);
  if (src) {
    w.refVids = ["a.mp4", "b.mp4"];
    let painted = 0;
    w.renderRefLists = () => { painted++; }; w.logLine = () => {}; w.alert = () => {};
    w.RefSelect = { open: async (o) => { o.onApply("b_sel_f1-f9.mp4", { note: "x" }); } };
    w.eval("var refVids = window.refVids; var refVidOps = {};" + src[0]);   // 2.388.0: the Use dropdown's record
    await w.openRefSelect(1);
    check("the dock: Apply replaces the clicked slot with the cut and repaints",
      w.refVids.join() === "a.mp4,b_sel_f1-f9.mp4" && painted === 1, w.refVids);
  }
})().then(() => {
  console.log(`RESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
});
