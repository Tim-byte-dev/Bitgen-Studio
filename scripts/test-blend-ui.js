#!/usr/bin/env node
/* bitGen Studio — 2.491.0 in a REAL browser: BLEND MODES + TRACK MATTES (ext/timelinedock/tlblend.js, canvas.js) - on the
 * canvas and in the compile.
 * Tim (verbatim): "go with 1,2,4,5 and 6 as you suggested. we a getting close to building a fully featured professional app"
 * Against the running app (H3_URL, default the e2e server on :8311), from the app folder (projects/e2e_bl491). No
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
if (!chromium) { console.log("SKIP: playwright is not installed here - the blend modes browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const ROOT = path.join(__dirname, "..");
const P = "e2e_bl491";
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
    ff(["-f", "lavfi", "-i", "color=c=0x208030:s=640x360:r=24:d=3", "-f", "lavfi", "-i", "sine=frequency=330:duration=3",
        "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "30", "-deadline", "realtime", "-c:a", "libopus", "-shortest", path.join(pd, "video", "bl_base.webm")]);
    ff(["-f", "lavfi", "-i", "color=c=0x808080:s=160x120", "-frames:v", "1", path.join(pd, "images", "bl_grey.png")]);
    ff(["-f", "lavfi", "-i", "color=c=blue:s=200x200", "-frames:v", "1", path.join(pd, "images", "bl_blue.png")]);
    ff(["-f", "lavfi", "-i", "color=c=black@0:s=160x160,format=rgba,geq=r=255:g=255:b=255:a='255*lt(hypot(X-80,Y-80),70)'", "-frames:v", "1", path.join(pd, "images", "bl_disc.png")]);
    const booted = Promise.all([
      p.waitForResponse((r) => /\/api\/ui\/layout(\?|$)/.test(r.url()), { timeout: 60000 }).catch(() => null),
      p.waitForResponse((r) => /\/api\/dockers(\?|$)/.test(r.url()) && r.request().method() === "GET", { timeout: 60000 }).catch(() => null),
    ]);
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await booted;
    await p.waitForFunction(() => window.TlCanvas && window.TlBlendMode, null, { timeout: 30000 });
    await p.waitForTimeout(800);
    await p.evaluate(() => {
      const d = document.getElementById("timelinedock");
      if (/collapsed|dockgone/.test(d.className) && typeof toggleCollapse === "function") toggleCollapse("timelinedock");
      setVar("th", 820);
      if (document.getElementById("tlStage").classList.contains("off")) document.getElementById("tlStageTog").click();
      tl.video = [{ name: "bl_base.webm", src: "video", start: 0, dur: 3, in: 0, out: 3, opacity: 1 }];
      tl.vlayers = []; tl.audio = [];
      tl.images = [mkLayer("Grey", [{ name: "bl_grey.png", start: 0, len: 3, opacity: 1, tf: { x: -180, y: 0, scale: 1, rot: 0 } }]),
                   mkLayer("Blue", [{ name: "bl_blue.png", start: 0, len: 3, opacity: 1, tf: { x: 150, y: 0, scale: 1, rot: 0 } }]),
                   mkLayer("Disc", [{ name: "bl_disc.png", start: 0, len: 3, opacity: 1, tf: { x: 150, y: 0, scale: 1, rot: 0 } }])];
      tlSave(); renderTimeline();
    });
    await p.waitForFunction(() => TlCanvas.state.W === 640, null, { timeout: 20000 });
    const goT = (t) => p.evaluate((t) => { setPlayhead(t); TlCanvas.state.t = t; TlCanvas.draw(); TlCanvas.paintLayers(); }, t);
    await goT(1); await p.waitForTimeout(700);
    // the Properties: ◐ Blend on the grey picture
    await p.evaluate(() => TlCanvas.select(tl.images[0].clips[0], { lk: "i:0" })); await p.waitForTimeout(300);
    const ui = await p.evaluate(() => ({ b: Array.from(document.querySelectorAll("#tlpBlend option")).map((o) => o.value), m: Array.from(document.querySelectorAll("#tlpMatte option")).map((o) => o.value) }));
    check("◐ Blend (17 modes) and ▣ Matte (none, alpha, alpha inverted, luma, luma inverted) in the Properties", ui.b.length === 17 && ui.b.includes("screen") && ui.b.includes("hue") && ui.m.join() === ",alpha,alphainv,luma,lumainv", ui);
    await p.selectOption("#tlpBlend", "screen"); await p.waitForTimeout(200);
    await p.evaluate(() => TlCanvas.select(tl.images[1].clips[0], { lk: "i:1" })); await p.waitForTimeout(300);
    const up = await p.evaluate(() => document.querySelector(".tlp-blend .tlp-none").textContent);
    await p.selectOption("#tlpMatte", "alpha"); await p.waitForTimeout(200);
    const st = await p.evaluate(() => ({ g: tl.images[0].blend, m: tl.images[1].matte }));
    check("set on the LAYERS: Grey = screen, Blue = alpha matte (by the layer above: Disc)", st.g === "screen" && st.m === "alpha" && /Disc/.test(up), { st, up });
    const snapPx = () => p.evaluate(() => { const g = document.createElement("canvas"); g.width = 640; g.height = 360; const x = g.getContext("2d"); TlCanvas.paintComp(x, 1); const at = (a, b) => Array.from(x.getImageData(a, b, 1, 1).data).slice(0, 3); return { scr: at(140, 180), inD: at(470, 180), outD: at(470 - 95, 180 - 95), edge: at(470 + 85, 180) }; });
    const s1 = await snapPx();
    const scr = (a, b2) => Math.round(255 - (255 - a) * (255 - b2) / 255), want = [32, 128, 48].map((v) => scr(v, 128));
    check("canvas: the grey layer SCREENS the green (" + want + ")", s1.scr.every((v, k) => Math.abs(v - want[k]) <= 4), s1.scr);
    check("canvas: the blue square shows only inside the disc above it; the disc itself is not drawn", s1.inD[2] > 230 && s1.inD[0] < 20 && s1.outD[1] > 100 && s1.outD[2] < 80 && s1.edge[1] > 100, s1);
    // inverted
    await p.selectOption("#tlpMatte", "alphainv"); await p.waitForTimeout(200);
    const s2 = await snapPx();
    check("canvas: Alpha Inverted - the square shows outside the disc, not inside", s2.inD[1] > 100 && s2.inD[2] < 80 && s2.outD[2] > 230, s2);
    await p.selectOption("#tlpMatte", "alpha"); await p.waitForTimeout(200);
    // compile parity
    const shot = async () => { await goT(1); await p.waitForTimeout(700); await goT(1); await p.waitForTimeout(300); return Buffer.from((await p.evaluate(() => TlCanvas.snapshot())).split(",")[1], "base64"); };
    fs.writeFileSync(path.join(pd, "temp_bl_1.png"), await shot());
    const resp = p.waitForResponse((r) => /\/api\/export$/.test(r.url()), { timeout: 120000 });
    await p.click("#tlExport");
    const job = await (await resp).json();
    let stt = "", log = [];
    for (let i = 0; i < 150 && job.id; i++) { const d = await api("/api/jobs/" + job.id); stt = d.status; log = d.log || []; if (stt === "done" || stt === "failed") break; await new Promise((ok) => setTimeout(ok, 1000)); }
    const movie = path.join(pd, P + ".mp4");
    check("⚙ Compile finished - a blend mode and a track matte", stt === "done" && fs.existsSync(movie) && log.some((l) => /blend mode screen/.test(l)) && log.some((l) => /alpha track matte/.test(l)), [stt, log.slice(-8)]);
    if (stt === "done") {
      const W = 640, H = 360, c1 = rgbOf(path.join(pd, "temp_bl_1.png"), W, H), m1 = rgbOf(movie, W, H, 1);
      const d1 = meanDiff(c1, m1);
      check("COMPILE = CANVAS with a screened layer and a matted layer (mean difference under 6)", d1 < 6, Math.round(d1 * 100) / 100);
      const at = (buf, x, y) => { const i = (y * W + x) * 3; return [buf[i], buf[i + 1], buf[i + 2]]; };
      check("...the matted square only inside the disc in the movie too", at(m1, 470, 180)[2] > 200 && at(m1, 375, 85)[1] > 90, [at(m1, 470, 180), at(m1, 375, 85)]);
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
