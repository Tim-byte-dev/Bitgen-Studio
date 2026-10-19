#!/usr/bin/env node
/* bitGen Studio — 2.499.0 in a REAL browser: TRACKING + CORNER PIN (ext/timelinedock/tltrack.js, scripts/track_points.py)
 * - a point tracked on V1 applied to a picture (its position keys), a planar track pinning a picture and a video layer
 * into the moving surface, ▢ corner-pin editing, and the compile (a baked picture, a perspective-warped video) = canvas.
 * Tim (verbatim): "... and the rest of the After Effects gap list (expressions, Bézier masks, tracking and so on).."
 * Against the running app (H3_URL, default the e2e server on :8311), from the app folder (projects/e2e_tk499). No
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
if (!chromium) { console.log("SKIP: playwright is not installed here - the tracking browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const ROOT = path.join(__dirname, "..");
const P = "e2e_tk499";
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
    const pat = path.join(pd, "temp_tk_pat.png");
    ff(["-f", "lavfi", "-i", "mandelbrot=s=160x120", "-frames:v", "1", pat]);
    ff(["-f", "lavfi", "-i", "color=c=0x404040:s=640x360:r=24:d=3", "-i", pat, "-f", "lavfi", "-i", "sine=frequency=330:duration=3", "-filter_complex", "[0][1]overlay=x='100+t*60':y='80+t*30'",
        "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "18", "-deadline", "realtime", "-c:a", "libopus", "-shortest", path.join(pd, "video", "tk_base.webm")]);
    ff(["-f", "lavfi", "-i", "smptebars=s=320x180:r=24:d=3", "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "20", "-deadline", "realtime", path.join(pd, "video", "tk_bars.webm")]);
    ff(["-f", "lavfi", "-i", "color=c=0xe03030:s=40x40", "-frames:v", "1", path.join(pd, "images", "tk_red.png")]);
    ff(["-f", "lavfi", "-i", "testsrc=s=200x150", "-frames:v", "1", path.join(pd, "images", "tk_poster.png")]);
    const booted = Promise.all([
      p.waitForResponse((r) => /\/api\/ui\/layout(\?|$)/.test(r.url()), { timeout: 60000 }).catch(() => null),
      p.waitForResponse((r) => /\/api\/dockers(\?|$)/.test(r.url()) && r.request().method() === "GET", { timeout: 60000 }).catch(() => null),
    ]);
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await booted;
    await p.waitForFunction(() => window.TlCanvas && window.TlTrack && TlTrack.ready && window.TlParent, null, { timeout: 30000 });
    await p.waitForTimeout(800);
    await p.evaluate(() => {
      const d = document.getElementById("timelinedock");
      if (/collapsed|dockgone/.test(d.className) && typeof toggleCollapse === "function") toggleCollapse("timelinedock");
      setVar("th", 820);
      if (document.getElementById("tlStage").classList.contains("off")) document.getElementById("tlStageTog").click();
      tl.video = [{ name: "tk_base.webm", src: "video", start: 0, dur: 3, in: 0, out: 3, opacity: 1 }];
      tl.vlayers = [mkLayer("Bars", [{ name: "tk_bars.webm", src: "video", start: 0, dur: 3, in: 0, out: 3, opacity: 1, tf: { x: 200, y: 120, scale: 0.4, rot: 0 } }])];
      tl.audio = [];
      tl.images = [mkLayer("Red", [{ name: "tk_red.png", start: 0, len: 3, opacity: 1, tf: { x: -140, y: -40, scale: 1, rot: 0 } }]),
                   mkLayer("Poster", [{ name: "tk_poster.png", start: 0, len: 3, opacity: 1, tf: { x: -200, y: 120, scale: 0.5, rot: 0 } }])];
      tlSave(); renderTimeline();
    });
    await p.waitForFunction(() => TlCanvas.state.W === 640, null, { timeout: 20000 });
    const goT = (t) => p.evaluate((t) => { setPlayhead(t); TlCanvas.state.t = t; TlCanvas.draw(); TlCanvas.paintLayers(); }, t);
    await goT(0); await p.waitForTimeout(800);
    // 🎯 Track on V1: one point on the sliding picture's middle (180, 140 at 0 s)
    await p.evaluate(() => TlCanvas.select(tl.video[0], { lk: "v1" })); await p.waitForTimeout(300);
    const ui = await p.evaluate(() => ({ modes: Array.from(document.querySelectorAll("#tlpTkMode option")).map((o) => o.value), place: !!document.getElementById("tlpTkPlace") }));
    check("🎯 Track in V1's Properties: a point / two points / corner pin / planar, ◎ Place", ui.modes.join() === "point,scalerot,pin,planar" && ui.place, ui);
    await p.click("#tlpTkPlace"); await p.waitForTimeout(200);
    const scr = (x, y) => p.evaluate(([x, y]) => { const r = document.getElementById("tlCanvas").getBoundingClientRect(), s = TlCanvas.toScreen(x, y); return [r.left + s.x, r.top + s.y]; }, [x, y]);
    const a = await scr(320, 180), c0 = await scr(180, 140);
    await p.mouse.move(a[0], a[1]); await p.mouse.down(); await p.mouse.move(c0[0], c0[1], { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(200);
    const placed = await p.evaluate(() => tl.video[0].trk.pts[0]);
    check("◎ Place: the point dragged onto the detail (the Track points tool)", Math.abs(placed[0] - 180 / 640) < 0.01 && Math.abs(placed[1] - 140 / 360) < 0.01, placed);
    await p.evaluate(() => TlCanvas.select(tl.video[0], { lk: "v1" })); await p.waitForTimeout(250);
    await p.click("#tlpTkRun");
    await p.waitForFunction(() => tl.video[0].trk && tl.video[0].trk.data && tl.video[0].trk.data.length > 30 && !tl.video[0].trk.busy, null, { timeout: 120000 });
    const tr = await p.evaluate(() => { const d = tl.video[0].trk.data, k = d.filter((q) => Math.abs(q.at - 1) < 0.021)[0]; return { n: d.length, at1: k && [k.pts[0][0] * 640, k.pts[0][1] * 360], m: tl.video[0].trk.method }; });
    check("▶ Track: every frame of the clip, the point on the picture (1 s: 240, 170 within a pixel)", tr.n >= 70 && tr.at1 && Math.abs(tr.at1[0] - 240) < 1 && Math.abs(tr.at1[1] - 170) < 1, tr);
    // Apply to the red square: its position follows
    await p.evaluate(() => TlCanvas.select(tl.video[0], { lk: "v1" })); await p.waitForTimeout(250);
    const red = await p.evaluate(() => tl.images[0].clips[0].uid || (tl.images[0].clips[0].uid = "ured1"));
    await p.evaluate(() => TlCanvas.select(tl.video[0], { lk: "v1" })); await p.waitForTimeout(250);
    await p.selectOption("#tlpTkTgt", red); await p.click("#tlpTkApply"); await p.waitForTimeout(300);
    const rf = await p.evaluate(() => { const c = tl.images[0].clips[0]; return { k: (c.kf || []).filter((q) => q.x != null).length, b0: TlCanvas.box(c, "img", 0), b2: TlCanvas.box(c, "img", 2) }; });
    check("Apply to a picture: its position keys follow the point (2 s: moved 120 px right, 60 px down)", rf.k >= 2 && Math.abs(rf.b2.cx - rf.b0.cx - 120) < 1.5 && Math.abs(rf.b2.cy - rf.b0.cy - 60) < 1.5, { k: rf.k, d: [rf.b2.cx - rf.b0.cx, rf.b2.cy - rf.b0.cy] });
    // ▣ planar on the sliding picture: its 4 corners; pin the poster and the bars video into it
    await goT(0); await p.evaluate(() => TlCanvas.select(tl.video[0], { lk: "v1" })); await p.waitForTimeout(250);
    await p.selectOption("#tlpTkMode", "planar"); await p.waitForTimeout(250);
    await p.evaluate(() => { tl.video[0].trk.pts = [[100 / 640, 80 / 360], [260 / 640, 80 / 360], [260 / 640, 200 / 360], [100 / 640, 200 / 360]]; tlSave(); TlCanvas.select(tl.video[0], { lk: "v1" }); });
    await p.waitForTimeout(250);
    await p.click("#tlpTkRun");
    await p.waitForFunction(() => tl.video[0].trk && tl.video[0].trk.mode === "planar" && tl.video[0].trk.data && tl.video[0].trk.data.length > 30 && !tl.video[0].trk.busy, null, { timeout: 120000 });
    const poster = await p.evaluate(() => tl.images[1].clips[0].uid || (tl.images[1].clips[0].uid = "uposter1"));
    await p.evaluate(() => TlCanvas.select(tl.video[0], { lk: "v1" })); await p.waitForTimeout(250);
    await p.selectOption("#tlpTkTgt", poster); await p.click("#tlpTkApply"); await p.waitForTimeout(250);
    const bars = await p.evaluate(() => tl.vlayers[0].clips[0].uid || (tl.vlayers[0].clips[0].uid = "ubars1"));
    await p.evaluate(() => TlCanvas.select(tl.video[0], { lk: "v1" })); await p.waitForTimeout(250);
    await p.selectOption("#tlpTkTgt", bars); await p.click("#tlpTkApply"); await p.waitForTimeout(250);
    const pins = await p.evaluate(() => { const a = tl.images[1].clips[0].pin, v = tl.vlayers[0].clips[0].pin; return { a: a && a.keys.length, v: v && v.keys.length, q1: a && TlTrack.ptsAt ? null : null, k1: a && a.keys.filter((k) => Math.abs(k.at - 1) < 0.021)[0] }; });
    check("▣ planar track Applied: the poster and the video layer pinned into the moving surface (a quad per frame; 1 s: its corner at 160, 110)", pins.a >= 70 && pins.v >= 70 && pins.k1 && Math.abs(pins.k1.q[0][0] - 160) < 1.5 && Math.abs(pins.k1.q[0][1] - 110) < 1.5, pins);
    const px = (x, y, t) => p.evaluate(([x, y, t]) => { const g = document.createElement("canvas"); g.width = 640; g.height = 360; const c = g.getContext("2d"); TlCanvas.paintComp(c, t); return Array.from(c.getImageData(x, y, 1, 1).data).slice(0, 3); }, [x, y, t]);
    await goT(1); await p.waitForTimeout(600);
    const inside = await px(240, 170, 1), outside = await px(400, 300, 1);
    check("canvas: the pinned layer is drawn inside the tracked quad (not the base's grey), outside it the base", !(Math.abs(inside[0] - 64) < 6 && Math.abs(inside[1] - 64) < 6) && Math.abs(outside[0] - 64) < 8, { inside, outside });
    // ▢ edit a corner (a static pin on the red square)
    await p.evaluate(() => { const c = tl.images[0].clips[0]; delete c.kf; TlCanvas.select(c, { lk: "i:0" }); }); await p.waitForTimeout(300);
    await p.click("#tlpPinOn"); await p.waitForTimeout(250);
    const rb = await p.evaluate(() => tl.images[0].clips[0].pin.keys[0].q);
    const s0 = await scr(rb[2][0], rb[2][1]), s1 = await scr(rb[2][0] + 40, rb[2][1] + 30);
    await p.mouse.move(s0[0], s0[1]); await p.mouse.down(); await p.mouse.move(s1[0], s1[1], { steps: 5 }); await p.mouse.up(); await p.waitForTimeout(200);
    const rq = await p.evaluate(() => tl.images[0].clips[0].pin.keys);
    check("▢ Corner pin on a layer: starts as its own corners; ✥ dragging a corner moves it (one key - a static pin)", rq.length === 1 && Math.abs(rq[0].q[2][0] - rb[2][0] - 40) < 1.5 && Math.abs(rq[0].q[2][1] - rb[2][1] - 30) < 1.5, { rb, rq });
    // the compile
    const snapAt = async (t) => { await goT(t); await p.waitForTimeout(900); await goT(t); await p.waitForTimeout(300); return Buffer.from((await p.evaluate(() => TlCanvas.snapshot())).split(",")[1], "base64"); };
    fs.writeFileSync(path.join(pd, "temp_tk_1.png"), await snapAt(1)); fs.writeFileSync(path.join(pd, "temp_tk_2.png"), await snapAt(2));
    const resp = p.waitForResponse((r) => /\/api\/export$/.test(r.url()), { timeout: 180000 });
    await p.click("#tlExport");
    const job = await (await resp).json();
    let stt = "", log = [];
    for (let i = 0; i < 300 && job.id; i++) { const d = await api("/api/jobs/" + job.id); stt = d.status; log = d.log || []; if (stt === "done" || stt === "failed") break; await new Promise((ok) => setTimeout(ok, 1000)); }
    const movie = path.join(pd, P + ".mp4");
    check("⚙ Compile finished - the video layer corner-pinned by the compile, the pictures baked", stt === "done" && fs.existsSync(movie) && log.some((l) => /corner-pinned/.test(l)), [stt, log.slice(-8)]);
    if (stt === "done") {
      const W = 640, H = 360, c1 = rgbOf(path.join(pd, "temp_tk_1.png"), W, H), m1 = rgbOf(movie, W, H, 1), c2 = rgbOf(path.join(pd, "temp_tk_2.png"), W, H), m2 = rgbOf(movie, W, H, 2);
      const d1 = meanDiff(c1, m1), d2 = meanDiff(c2, m2);
      check("COMPILE = CANVAS at 1 s and 2 s (a picture + a video pinned into a tracked surface, a corner-pinned square): mean difference under 6", d1 < 6 && d2 < 6, [Math.round(d1 * 100) / 100, Math.round(d2 * 100) / 100]);
    }
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
