#!/usr/bin/env node
/* bitGen Studio — 2.490.0 in a REAL browser: PARENTING + NULL OBJECTS (ext/timelinedock/tlparent.js) - a layer follows a
 * keyed null on the canvas, and the compile (the parented layer baked by the page) draws the same.
 * Tim (verbatim): "go with 1,2,4,5 and 6 as you suggested. we a getting close to building a fully featured professional app"
 * Against the running app (H3_URL, default the e2e server on :8311), from the app folder (projects/e2e_par490). No
 * Playwright = SKIP. */
"use strict";
const fs = require("fs");
const path = require("path");
const { execSync, execFileSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the parenting browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const ROOT = path.join(__dirname, "..");
const P = "e2e_par490";
const KF = require(path.join(ROOT, "static", "keyframes.js"));
let pass = 0, fail = 0;
const check = (n, cond, got) => {
  if (cond) { pass++; console.log("PASS: " + n); }
  else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); }
};
const api = async (u, body) => (await fetch(URL_ + u.replace(/^\//, ""), body === undefined ? {} :
  { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();
const ff = (args) => execFileSync("ffmpeg", ["-y", "-loglevel", "error"].concat(args), { stdio: "ignore" });
function rgbOf(file, w, h, at) {
  const a = ["-loglevel", "error"].concat(at != null ? ["-ss", String(at)] : []).concat(["-i", file, "-frames:v", "1",
    "-vf", `scale=${w}:${h}:flags=neighbor`, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]);
  return execFileSync("ffmpeg", a, { maxBuffer: 64 * 1024 * 1024 });
}
const meanDiff = (A, B) => { let d = 0; for (let i = 0; i < A.length; i++) d += Math.abs(A[i] - B[i]); return d / A.length; };
const near = (a, b, tol) => Math.abs(a - b) <= tol;

(async () => {
  const b = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
  const p = await b.newPage({ viewport: { width: 2200, height: 1300 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  try {
    await api("/api/projects/load", { name: P });
    const pd = path.join(ROOT, "projects", P);
    ff(["-f", "lavfi", "-i", "color=c=0x208030:s=640x360:r=24:d=4", "-f", "lavfi", "-i", "sine=frequency=330:duration=4",
        "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "30", "-deadline", "realtime", "-c:a", "libopus", "-shortest", path.join(pd, "video", "par_base.webm")]);
    ff(["-f", "lavfi", "-i", "color=c=red:s=60x40", "-frames:v", "1", path.join(pd, "images", "par_red.png")]);
    const booted = Promise.all([
      p.waitForResponse((r) => /\/api\/ui\/layout(\?|$)/.test(r.url()), { timeout: 60000 }).catch(() => null),
      p.waitForResponse((r) => /\/api\/dockers(\?|$)/.test(r.url()) && r.request().method() === "GET", { timeout: 60000 }).catch(() => null),
    ]);
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await booted;
    await p.waitForFunction(() => window.TlCanvas && window.TlParent && window.TlParent.world, null, { timeout: 30000 });
    await p.waitForTimeout(800);
    await p.evaluate(() => {
      const d = document.getElementById("timelinedock");
      if (/collapsed|dockgone/.test(d.className) && typeof toggleCollapse === "function") toggleCollapse("timelinedock");
      setVar("th", 820);
      if (document.getElementById("tlStage").classList.contains("off")) document.getElementById("tlStageTog").click();
      tl.video = [{ name: "par_base.webm", src: "video", start: 0, dur: 4, in: 0, out: 4, opacity: 1 }];
      tl.vlayers = []; tl.audio = []; tl.images = [mkLayer("I1", [{ name: "par_red.png", start: 0, len: 4, opacity: 1, tf: { x: 150, y: 0, scale: 1, rot: 0 } }])]; tlSave(); renderTimeline();
    });
    await p.waitForFunction(() => TlCanvas.state.W === 640, null, { timeout: 20000 });
    const goT = (t) => p.evaluate((t) => { setPlayhead(t); TlCanvas.state.t = t; TlCanvas.draw(); TlCanvas.paintLayers(); }, t);
    await goT(0.5);
    // a null, keyed: x 0 -> 100, rotation 0 -> 90 between 0.5 s and 3 s
    await p.evaluate(() => TlCanvas.select(tl.images[0].clips[0], { lk: "i:0" }));
    await p.waitForTimeout(300);
    await p.click("#tlpNull"); await p.waitForTimeout(400);
    const nl = await p.evaluate(() => { const L = tl.images[tl.images.length - 1], c = L.clips[0]; c.kf = [{ at: 0.5, x: 0, y: 0, rot: 0 }, { at: 3, x: 100, y: 0, rot: 90 }]; tlSave(); renderTimeline(); return { name: L.name, nul: c.nul, uid: c.uid, len: c.len }; });
    check("＋ Null: an empty control layer ('Null 1') as long as the timeline, with an id", nl.name === "Null 1" && nl.nul === true && /^u/.test(nl.uid) && nl.len >= 4, nl);
    await goT(0.5); await p.waitForTimeout(500);
    const notDrawn = await p.evaluate(() => { const g = document.createElement("canvas"); g.width = 640; g.height = 360; TlCanvas.paintComp(g.getContext("2d"), 0.5); return Array.from(g.getContext("2d").getImageData(320, 180, 1, 1).data); });
    check("a null is never drawn in the picture (the base shows through at its centre)", notDrawn[1] > 100 && notDrawn[0] < 60, notDrawn);
    // parent the red picture to it (the Properties' ⛓ Parent)
    await p.evaluate(() => TlCanvas.select(tl.images[0].clips[0], { lk: "i:0" })); await p.waitForTimeout(300);
    const before = await p.evaluate(() => { const bx = TlCanvas.box(tl.images[0].clips[0], "img", 0.5); return [bx.cx, bx.cy]; });
    const opts = await p.evaluate(() => Array.from(document.querySelectorAll("#tlpParent option")).map((o) => o.textContent));
    check("⛓ Parent lists the other layers (the null marked)", opts[0] === "none" && opts.some((t) => /Null 1 \(null\)/.test(t)), opts);
    await p.selectOption("#tlpParent", nl.uid); await p.waitForTimeout(300);
    const pa = await p.evaluate(() => { const c = tl.images[0].clips[0], bx = TlCanvas.box(c, "img", 0.5), b3 = TlCanvas.box(c, "img", 3); return { parent: c.parent, at05: [bx.cx, bx.cy], at3: [b3.cx, b3.cy, b3.rot] }; });
    check("choosing the parent keeps the picture where it is", pa.parent === nl.uid && near(pa.at05[0], before[0], 0.01) && near(pa.at05[1], before[1], 0.01), { before, pa });
    check("...and then it follows the null: moved 100 px and swung 90° about it by 3 s (at 420, 330, turned 90°)", near(pa.at3[0], 420, 0.01) && near(pa.at3[1], 330, 0.01) && near(pa.at3[2], 90, 1e-6), pa.at3);
    // a drag on the canvas while parented moves it in the parent's space - one screen pixel stays one screen pixel
    await goT(3); await p.waitForTimeout(300);
    const dr = await p.evaluate(() => { const r = document.getElementById("tlCanvas").getBoundingClientRect(), bx = TlCanvas.box(tl.images[0].clips[0], "img", 3), s = TlCanvas.toScreen(bx.cx, bx.cy); return { x: r.left + s.x, y: r.top + s.y, z: TlCanvas.state.view.z, cx: bx.cx, cy: bx.cy }; });
    await p.evaluate(() => TlCanvas.setTool("move"));
    await p.mouse.move(dr.x, dr.y); await p.mouse.down(); await p.mouse.move(dr.x + 40 * dr.z, dr.y, { steps: 5 }); await p.mouse.up(); await p.waitForTimeout(300);
    const dd = await p.evaluate(() => { const bx = TlCanvas.box(tl.images[0].clips[0], "img", 3); return [bx.cx, bx.cy]; });
    check("dragging a parented layer 40 px right moves it 40 px right on screen", near(dd[0], dr.cx + 40, 1.5) && near(dd[1], dr.cy, 1.5), { dd, from: [dr.cx, dr.cy] });
    await p.evaluate(() => { const c = tl.images[0].clips[0]; c.tf.x = 150; c.tf.y = 0; tlSave(); TlCanvas.mark(); });
    // the compile: the parented layer baked by the page
    const snapAt = async (t) => { await goT(t); await p.waitForTimeout(700); await goT(t); await p.waitForTimeout(300); return Buffer.from((await p.evaluate(() => TlCanvas.snapshot())).split(",")[1], "base64"); };
    const s1 = await snapAt(1.5), s2 = await snapAt(2.8);
    fs.writeFileSync(path.join(pd, "temp_par_1.png"), s1); fs.writeFileSync(path.join(pd, "temp_par_2.png"), s2);
    const resp = p.waitForResponse((r) => /\/api\/export$/.test(r.url()), { timeout: 120000 });
    await p.click("#tlExport");
    const job = await (await resp).json();
    const baked = await p.evaluate(() => tl.images[0].clips[0].bake);
    check("before the compile the page baked the parented layer (video/tlb_<id>.webm)", /^tlb_u[a-z0-9]+\.webm$/.test(baked || "") && fs.existsSync(path.join(pd, "video", baked)), baked);
    let st = "", log = [];
    for (let i = 0; i < 150 && job.id; i++) { const d = await api("/api/jobs/" + job.id); st = d.status; log = d.log || []; if (st === "done" || st === "failed") break; await new Promise((ok) => setTimeout(ok, 1000)); }
    const movie = path.join(pd, P + ".mp4");
    check("⚙ Compile finished - the baked layer overlaid, the null left out", st === "done" && fs.existsSync(movie) && log.some((l) => /a baked layer \(it follows its parent\)/.test(l)), [st, log.slice(-6)]);
    if (st === "done") {
      const W = 640, H = 360, c1 = rgbOf(path.join(pd, "temp_par_1.png"), W, H), m1 = rgbOf(movie, W, H, 1.5), c2 = rgbOf(path.join(pd, "temp_par_2.png"), W, H), m2 = rgbOf(movie, W, H, 2.8);
      const d1 = meanDiff(c1, m1), d2 = meanDiff(c2, m2);
      check("COMPILE = CANVAS for a layer following a moving, turning null (mean difference under 8, two moments)", d1 < 8 && d2 < 8, [Math.round(d1 * 100) / 100, Math.round(d2 * 100) / 100]);
    }
    // unparenting keeps it where it is too
    await goT(3); await p.waitForTimeout(800); await p.evaluate(() => TlCanvas.select(tl.images[0].clips[0], { lk: "i:0" })); await p.waitForTimeout(300); await goT(3); await p.waitForTimeout(300);
    const pre = await p.evaluate(() => { const bx = TlCanvas.box(tl.images[0].clips[0], "img", 3); return [bx.cx, bx.cy, bx.rot]; });
    await p.selectOption("#tlpParent", ""); await p.waitForTimeout(300);
    const post = await p.evaluate(() => { const c = tl.images[0].clips[0], bx = TlCanvas.box(c, "img", 3); return { p: c.parent || null, b: [bx.cx, bx.cy, bx.rot] }; });
    check("⛓ Parent: none - the layer stays where it was, now on its own", post.p === null && near(post.b[0], pre[0], 0.01) && near(post.b[1], pre[1], 0.01) && near(post.b[2], pre[2], 1e-6), { pre, post });
    check("no page errors", errs.length === 0, errs);
  } catch (e) {
    check("the browser run finished", false, String(e && e.stack || e).slice(0, 600));
  } finally {
    try { await p.evaluate(() => { tl.video = []; tl.vlayers = []; tl.images = []; tl.audio = []; tlSave(); renderTimeline(); }); } catch { /* closed */ }
    await b.close();
    try { await api("/api/projects/load", { name: "default" }); } catch { /* best effort */ }
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
