#!/usr/bin/env node
/* bitGen Studio — 2.500.0 in a REAL browser: ⏱ TIME on a layer (ext/timelinedock/tltime.js) - motion blur on a fast
 * picture and a video layer, posterize time, an echo trail; the compile (a baked picture, worker.py's sampled move +
 * tmix, setpts posterize, delayed copies) = the canvas.
 * Tim (verbatim): "... and the rest of the After Effects gap list (expressions, Bézier masks, tracking and so on).."
 * Against the running app (H3_URL, default the e2e server on :8311), from the app folder (projects/e2e_tm500). No
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
if (!chromium) { console.log("SKIP: playwright is not installed here - the time effects browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const ROOT = path.join(__dirname, "..");
const P = "e2e_tm500";
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
    ff(["-f", "lavfi", "-i", "color=c=0x203040:s=640x360:r=24:d=3", "-f", "lavfi", "-i", "sine=frequency=330:duration=3",
        "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "30", "-deadline", "realtime", "-c:a", "libopus", "-shortest", path.join(pd, "video", "tm_base.webm")]);
    ff(["-f", "lavfi", "-i", "color=c=0x30c040:s=80x80:r=24:d=3", "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "20", "-deadline", "realtime", path.join(pd, "video", "tm_green.webm")]);
    ff(["-f", "lavfi", "-i", "color=c=0xe03030:s=60x60", "-frames:v", "1", path.join(pd, "images", "tm_red.png")]);
    const booted = Promise.all([
      p.waitForResponse((r) => /\/api\/ui\/layout(\?|$)/.test(r.url()), { timeout: 60000 }).catch(() => null),
      p.waitForResponse((r) => /\/api\/dockers(\?|$)/.test(r.url()) && r.request().method() === "GET", { timeout: 60000 }).catch(() => null),
    ]);
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await booted;
    await p.waitForFunction(() => window.TlCanvas && window.TlTime && TlTime.ready, null, { timeout: 30000 });
    await p.waitForTimeout(800);
    await p.evaluate(() => {
      const d = document.getElementById("timelinedock");
      if (/collapsed|dockgone/.test(d.className) && typeof toggleCollapse === "function") toggleCollapse("timelinedock");
      setVar("th", 820);
      if (document.getElementById("tlStage").classList.contains("off")) document.getElementById("tlStageTog").click();
      tl.video = [{ name: "tm_base.webm", src: "video", start: 0, dur: 3, in: 0, out: 3, opacity: 1 }];
      // the green video slides left -> right along the bottom; the red square fast along the top
      tl.vlayers = [mkLayer("Green", [{ name: "tm_green.webm", src: "video", start: 0, dur: 3, in: 0, out: 3, opacity: 1, tf: { x: -250, y: 100, scale: 1, rot: 0 }, kf: [{ at: 0, x: -250, y: 100 }, { at: 3, x: 250, y: 100 }] }])];
      tl.audio = [];
      tl.images = [mkLayer("Red", [{ name: "tm_red.png", start: 0, len: 3, opacity: 1, tf: { x: -250, y: -90, scale: 1, rot: 0 }, kf: [{ at: 0, x: -250, y: -90 }, { at: 3, x: 250, y: -90 }] }])];
      tlSave(); renderTimeline();
    });
    await p.waitForFunction(() => TlCanvas.state.W === 640, null, { timeout: 20000 });
    const goT = (t) => p.evaluate((t) => { setPlayhead(t); TlCanvas.state.t = t; TlCanvas.draw(); TlCanvas.paintLayers(); }, t);
    await goT(1); await p.waitForTimeout(600);
    const row = (t, y) => p.evaluate(([t, y]) => { const g = document.createElement("canvas"); g.width = 640; g.height = 360; const c = g.getContext("2d"); TlCanvas.paintComp(c, t); return Array.from(c.getImageData(0, y, 640, 1).data).filter((_, i) => i % 4 === 0); }, [t, y]);
    const partial = (r) => r.filter((v) => v > 60 && v < 200).length;
    const r0 = await row(1, 90);
    // ⏱ the red square: motion blur 360°
    await p.evaluate(() => TlCanvas.select(tl.images[0].clips[0], { lk: "i:0" })); await p.waitForTimeout(300);
    const ui = await p.evaluate(() => ({ blur: !!document.getElementById("tlpTmBlur"), post: !!document.getElementById("tlpTmPo"), echo: !!document.getElementById("tlpTmEc") }));
    check("⏱ Time in the Properties: motion blur, posterize time, echo", ui.blur && ui.post && ui.echo, ui);
    await p.click("#tlpTmBlur"); await p.waitForTimeout(200);
    await p.fill("#tlpTmSh", "360"); await p.dispatchEvent("#tlpTmSh", "input"); await p.waitForTimeout(150);
    const r1 = await row(1, 90);
    check("motion blur: the moving square's edges smear (more part-red pixels along its row: " + partial(r0) + " -> " + partial(r1) + ")", partial(r1) >= partial(r0) + 4, { a: partial(r0), b: partial(r1) });
    // posterize the red square at 4 a second: 1.30 s and 1.45 s look the same, 1.55 s moved on
    await p.fill("#tlpTmPo", "4"); await p.dispatchEvent("#tlpTmPo", "input"); await p.waitForTimeout(150);
    const pa = await row(1.3, 90), pb = await row(1.45, 90), pc = await row(1.55, 90);
    check("posterize time 4 fps: held between 1.25 and 1.5 s, on at 1.5 s", JSON.stringify(pa) === JSON.stringify(pb) && JSON.stringify(pb) !== JSON.stringify(pc));
    // the green video: motion blur + an echo trail
    await p.evaluate(() => TlCanvas.select(tl.vlayers[0].clips[0], { lk: "vl:0" })); await p.waitForTimeout(300);
    await p.click("#tlpTmBlur"); await p.waitForTimeout(150); await p.click("#tlpTmEc"); await p.waitForTimeout(200);
    await p.fill("#tlpTmEd", "0.25"); await p.dispatchEvent("#tlpTmEd", "input"); await p.waitForTimeout(150);
    const tmv = await p.evaluate(() => tl.vlayers[0].clips[0].tm);
    const g1 = await row(2, 280);
    const greenRuns = g1.filter((v) => v < 60).length;
    check("echo on the video layer: 3 copies 0.25 s apart behind it (a trail of fading greens to its left)", tmv.blur && tmv.echo && tmv.echo.n === 3 && Math.abs(tmv.echo.dt - 0.25) < 1e-9, tmv);
    // the compile
    const snapAt = async (t) => { await goT(t); await p.waitForTimeout(900); await goT(t); await p.waitForTimeout(300); return Buffer.from((await p.evaluate(() => TlCanvas.snapshot())).split(",")[1], "base64"); };
    fs.writeFileSync(path.join(pd, "temp_tm_1.png"), await snapAt(1.1)); fs.writeFileSync(path.join(pd, "temp_tm_2.png"), await snapAt(2));
    const resp = p.waitForResponse((r) => /\/api\/export$/.test(r.url()), { timeout: 180000 });
    await p.click("#tlExport");
    const job = await (await resp).json();
    let stt = "", log = [];
    for (let i = 0; i < 300 && job.id; i++) { const d = await api("/api/jobs/" + job.id); stt = d.status; log = d.log || []; if (stt === "done" || stt === "failed") break; await new Promise((ok) => setTimeout(ok, 1000)); }
    const movie = path.join(pd, P + ".mp4");
    check("⚙ Compile finished - the video layer's motion blur + echo made by the compile", stt === "done" && fs.existsSync(movie) && log.some((l) => /motion blur \(/.test(l)) && log.some((l) => /echo \(3 copies/.test(l)), [stt, log.slice(-8)]);
    if (stt === "done") {
      const W = 640, H = 360, c1 = rgbOf(path.join(pd, "temp_tm_1.png"), W, H), m1 = rgbOf(movie, W, H, 1.1), c2 = rgbOf(path.join(pd, "temp_tm_2.png"), W, H), m2 = rgbOf(movie, W, H, 2);
      const d1 = meanDiff(c1, m1), d2 = meanDiff(c2, m2);
      const reg = (A, B, y0, y1) => { let d = 0, n = 0; for (let y = y0; y < y1; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 3; d += Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2]); n += 3; } return d / n; };
      check("COMPILE = CANVAS at 1.1 s and 2 s (a blurred, posterized square + a blurred video with an echo trail): mean difference under 6", d1 < 6 && d2 < 6, [Math.round(d1 * 100) / 100, Math.round(d2 * 100) / 100]);
      check("…the video's band (its blur + echo trail) under 8 at 2 s", reg(c2, m2, 230, 330) < 8, Math.round(reg(c2, m2, 230, 330) * 100) / 100);
    }
    void greenRuns;
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
