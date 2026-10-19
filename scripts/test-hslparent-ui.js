#!/usr/bin/env node
/* bitGen Studio — 2.495.0 in a REAL browser: THE COLOUR BLEND MODES (hue / saturation / color / luminosity - canvas.js
 * blendYUV, worker.py _hsl_blend) + A VIDEO LAYER FOLLOWING A KEYED NULL (tlparent.js worldKeys) - canvas and compile.
 * Tim (verbatim): "fix the parented layers so video layers can follow. is there someway to get hue saturation, clor,
 * luminosity blend modes to work?"
 * Against the running app (H3_URL, default the e2e server on :8311), from the app folder (projects/e2e_hsl495). No
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
if (!chromium) { console.log("SKIP: playwright is not installed here - the colour modes + video parenting browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const ROOT = path.join(__dirname, "..");
const P = "e2e_hsl495";
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
    const still = path.join(pd, "temp_hs_still.png");
    ff(["-f", "lavfi", "-i", "testsrc2=s=640x360:d=1", "-frames:v", "1", still]);
    ff(["-loop", "1", "-r", "24", "-i", still, "-f", "lavfi", "-i", "sine=frequency=330:duration=3", "-t", "3", "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "20", "-deadline", "realtime", "-pix_fmt", "yuv420p", "-c:a", "libopus", "-shortest", path.join(pd, "video", "hs_base.webm")]);
    ff(["-f", "lavfi", "-i", "smptebars=s=120x80:r=24:d=3", "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "20", "-deadline", "realtime", path.join(pd, "video", "hs_kid.webm")]);
    ff(["-f", "lavfi", "-i", "rgbtestsrc=s=200x120,hue=h=30", "-frames:v", "1", path.join(pd, "images", "hs_bars.png")]);
    const booted = Promise.all([
      p.waitForResponse((r) => /\/api\/ui\/layout(\?|$)/.test(r.url()), { timeout: 60000 }).catch(() => null),
      p.waitForResponse((r) => /\/api\/dockers(\?|$)/.test(r.url()) && r.request().method() === "GET", { timeout: 60000 }).catch(() => null),
    ]);
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await booted;
    await p.waitForFunction(() => window.TlCanvas && window.TlBlendMode && window.TlParent && TlParent.worldKeys, null, { timeout: 30000 });
    await p.waitForTimeout(800);
    const MODES = ["hue", "saturation", "color", "luminosity"], POS = [[-160, -90], [160, -90], [-160, 90], [160, 90]];
    await p.evaluate(([MODES, POS]) => {
      const d = document.getElementById("timelinedock");
      if (/collapsed|dockgone/.test(d.className) && typeof toggleCollapse === "function") toggleCollapse("timelinedock");
      setVar("th", 820);
      if (document.getElementById("tlStage").classList.contains("off")) document.getElementById("tlStageTog").click();
      tl.video = [{ name: "hs_base.webm", src: "video", start: 0, dur: 3, in: 0, out: 3, opacity: 1 }];
      tl.vlayers = [mkLayer("Kid", [{ name: "hs_kid.webm", src: "video", start: 0, dur: 3, in: 0, out: 3, opacity: 1, tf: { x: -60, y: 0, scale: 1, rot: 0 } }])];
      tl.audio = [];
      tl.images = MODES.map((m, k) => mkLayer(m[0].toUpperCase() + m.slice(1), [{ name: "hs_bars.png", start: 0, len: 3, opacity: 1, tf: { x: POS[k][0], y: POS[k][1], scale: 1, rot: 0 } }]));
      tlSave(); renderTimeline();
    }, [MODES, POS]);
    await p.waitForFunction(() => TlCanvas.state.W === 640, null, { timeout: 20000 });
    const goT = (t) => p.evaluate((t) => { setPlayhead(t); TlCanvas.state.t = t; TlCanvas.draw(); TlCanvas.paintLayers(); }, t);
    await goT(1); await p.waitForTimeout(900);
    // ◐ Blend: the four colour modes offered; set one on each picture layer (the Properties)
    await p.evaluate(() => TlCanvas.select(tl.images[0].clips[0], { lk: "i:0" })); await p.waitForTimeout(300);
    const opts = await p.evaluate(() => Array.from(document.querySelectorAll("#tlpBlend option")).map((o) => o.value));
    check("◐ Blend offers 17 modes - with Hue, Saturation, Color, Luminosity", opts.length === 17 && MODES.every((m) => opts.includes(m)), opts);
    for (let k = 0; k < 4; k++) {
      await p.evaluate((k) => TlCanvas.select(tl.images[k].clips[0], { lk: "i:" + k }), k); await p.waitForTimeout(250);
      await p.selectOption("#tlpBlend", MODES[k]); await p.waitForTimeout(150);
    }
    const set = await p.evaluate(() => tl.images.map((L) => L.blend));
    check("set on the four picture layers", set.join() === MODES.join(), set);
    // the canvas = the sums: base pixel (the layers hidden) + layer pixel (blend normal) -> TlCanvas.mixYUV
    const px = await p.evaluate(([POS]) => {
      const g = document.createElement("canvas"); g.width = 640; g.height = 360; const x = g.getContext("2d");
      const at = (a, b2) => Array.from(x.getImageData(a, b2, 1, 1).data).slice(0, 3);
      const pts = POS.map((q) => [320 + q[0] - 50, 180 + q[1] + 10]);
      TlCanvas.paintComp(x, 1); const got = pts.map((q) => at(q[0], q[1]));
      const modes = tl.images.map((L) => L.blend);
      tl.images.forEach((L) => { L.visible = false; }); TlCanvas.mark(); TlCanvas.paintComp(x, 1); const base = pts.map((q) => at(q[0], q[1]));
      tl.images.forEach((L) => { L.visible = true; delete L.blend; }); TlCanvas.mark(); TlCanvas.paintComp(x, 1); const lay = pts.map((q) => at(q[0], q[1]));
      tl.images.forEach((L, k) => { L.blend = modes[k]; }); TlCanvas.mark();
      return { got, want: base.map((bq, k) => TlCanvas.mixYUV(modes[k], bq[0], bq[1], bq[2], lay[k][0], lay[k][1], lay[k][2])), base, lay };
    }, [POS]);
    check("canvas: each colour mode = its YUV sums on the base under it (Hue, Saturation, Color, Luminosity within 2)", px.got.every((g, k) => g.every((v, c) => Math.abs(v - px.want[k][c]) <= 2)), px);
    // a VIDEO layer follows a keyed null
    await p.evaluate(() => TlCanvas.select(tl.vlayers[0].clips[0], { lk: "vl:0" })); await p.waitForTimeout(300);
    await p.click("#tlpNull"); await p.waitForTimeout(400);
    const nl = await p.evaluate(() => { const L = tl.images[tl.images.length - 1], c = L.clips[0]; c.kf = [{ at: 0, x: 0, y: 0, rot: 0 }, { at: 3, x: 140, y: -50, rot: 75 }]; tlSave(); renderTimeline(); return { uid: c.uid, nul: c.nul }; });
    await p.evaluate(() => TlCanvas.select(tl.vlayers[0].clips[0], { lk: "vl:0" })); await p.waitForTimeout(300);
    const sel = await p.evaluate(() => ({ has: !!document.getElementById("tlpParent"), note: (document.querySelector(".tlp-parent") || {}).textContent || "" }));
    check("a VIDEO layer's Properties: ⛓ Parent is a list now (not 'video layers can be parents')", sel.has && !/can be parents/.test(sel.note), sel);
    await goT(0); await p.waitForTimeout(200);                 // (choosing a parent keeps the layer where it is at the playhead)
    await p.selectOption("#tlpParent", nl.uid); await p.waitForTimeout(300);
    const fol = await p.evaluate(() => { const c = tl.vlayers[0].clips[0], b0 = TlCanvas.box(c, "vl", 0), b3 = TlCanvas.box(c, "vl", 3); const wk = TlParent.worldKeys(c, "vl"); return { parent: c.parent, b0: [b0.cx, b0.cy, b0.rot], b3: [b3.cx, b3.cy, b3.rot], keys: wk.kf.length, tf: wk.tf }; });
    // world at 3 s: the null at (140, -50) turned 75°; the kid -60 px to its left in its space
    const r75 = 75 * Math.PI / 180, wx = 320 + 140 + Math.cos(r75) * -60, wy = 180 - 50 + Math.sin(r75) * -60;
    check("…it follows: where it was at 0 s, then moved + swung 75° round the null by 3 s; the compile gets its world keys (tf at 0 s + thinned keys)", fol.parent === nl.uid && near(fol.b0[0], 260, 0.05) && near(fol.b0[1], 180, 0.05)
      && near(fol.b3[0], wx, 0.05) && near(fol.b3[1], wy, 0.05) && near(fol.b3[2], 75, 1e-6) && fol.keys >= 4 && fol.keys < 200 && near(fol.tf.x, -60, 0.01), { fol, wx, wy });
    // compile parity at two moments
    const snapAt = async (t) => { await goT(t); await p.waitForTimeout(900); await goT(t); await p.waitForTimeout(400); return Buffer.from((await p.evaluate(() => TlCanvas.snapshot())).split(",")[1], "base64"); };
    fs.writeFileSync(path.join(pd, "temp_hs_1.png"), await snapAt(1)); fs.writeFileSync(path.join(pd, "temp_hs_2.png"), await snapAt(2.2));
    const resp = p.waitForResponse((r) => /\/api\/export$/.test(r.url()), { timeout: 120000 });
    await p.click("#tlExport");
    const job = await (await resp).json();
    let stt = "", log = [];
    for (let i = 0; i < 240 && job.id; i++) { const d = await api("/api/jobs/" + job.id); stt = d.status; log = d.log || []; if (stt === "done" || stt === "failed") break; await new Promise((ok) => setTimeout(ok, 1000)); }
    const movie = path.join(pd, P + ".mp4");
    check("⚙ Compile finished - the four colour modes (worked out in YUV)", stt === "done" && fs.existsSync(movie) && MODES.every((m) => log.some((l) => new RegExp("blend mode " + m).test(l))), [stt, log.slice(-8)]);
    if (stt === "done") {
      const W = 640, H = 360, c1 = rgbOf(path.join(pd, "temp_hs_1.png"), W, H), m1 = rgbOf(movie, W, H, 1), c2 = rgbOf(path.join(pd, "temp_hs_2.png"), W, H), m2 = rgbOf(movie, W, H, 2.2);
      const quad = (A, B, k) => { const [qx, qy] = POS[k]; let d = 0, n = 0; for (let y = 180 + qy - 50; y < 180 + qy + 50; y++) for (let x = 320 + qx - 90; x < 320 + qx + 90; x++) { const i = (y * W + x) * 3; d += Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2]); n += 3; } return d / n; };
      const dq = MODES.map((m, k) => Math.round(quad(c1, m1, k) * 100) / 100), d1 = meanDiff(c1, m1), d2 = meanDiff(c2, m2);
      check("COMPILE = CANVAS for each colour mode (its quarter: mean difference under 6)", dq.every((d) => d < 6), dq);
      check("COMPILE = CANVAS with the video layer following the moving, turning null (whole frame at 1 s and 2.2 s: mean difference under 6)", d1 < 6 && d2 < 6, [Math.round(d1 * 100) / 100, Math.round(d2 * 100) / 100]);
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
