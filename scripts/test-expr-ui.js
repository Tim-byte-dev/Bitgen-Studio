#!/usr/bin/env node
/* bitGen Studio — 2.497.0 in a REAL browser: EXPRESSIONS (ext/timelinedock/tlexpr.js) - the ƒx section, a rotation by
 * time, a wiggle, a link to a keyed null, an opacity ramp, a video layer turned by an expression - canvas and compile.
 * Tim (verbatim): "... and the rest of the After Effects gap list (expressions, Bézier masks, tracking and so on).."
 * Against the running app (H3_URL, default the e2e server on :8311), from the app folder (projects/e2e_ex497). No
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
if (!chromium) { console.log("SKIP: playwright is not installed here - the expressions browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const ROOT = path.join(__dirname, "..");
const P = "e2e_ex497";
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
        "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "30", "-deadline", "realtime", "-c:a", "libopus", "-shortest", path.join(pd, "video", "ex_base.webm")]);
    ff(["-f", "lavfi", "-i", "smptebars=s=120x80:r=24:d=3", "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "20", "-deadline", "realtime", path.join(pd, "video", "ex_bars.webm")]);
    ff(["-f", "lavfi", "-i", "color=c=0xe03030:s=80x80", "-frames:v", "1", path.join(pd, "images", "ex_red.png")]);
    const booted = Promise.all([
      p.waitForResponse((r) => /\/api\/ui\/layout(\?|$)/.test(r.url()), { timeout: 60000 }).catch(() => null),
      p.waitForResponse((r) => /\/api\/dockers(\?|$)/.test(r.url()) && r.request().method() === "GET", { timeout: 60000 }).catch(() => null),
    ]);
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await booted;
    await p.waitForFunction(() => window.TlCanvas && window.TlExpr && TlExpr.ready && window.TlParent, null, { timeout: 30000 });
    await p.waitForTimeout(800);
    await p.evaluate(() => {
      const d = document.getElementById("timelinedock");
      if (/collapsed|dockgone/.test(d.className) && typeof toggleCollapse === "function") toggleCollapse("timelinedock");
      setVar("th", 820);
      if (document.getElementById("tlStage").classList.contains("off")) document.getElementById("tlStageTog").click();
      tl.video = [{ name: "ex_base.webm", src: "video", start: 0, dur: 3, in: 0, out: 3, opacity: 1 }];
      tl.vlayers = [mkLayer("Bars", [{ name: "ex_bars.webm", src: "video", start: 0, dur: 3, in: 0, out: 3, opacity: 1, tf: { x: 180, y: 100, scale: 1, rot: 0 } }])];
      tl.audio = [];
      tl.images = [mkLayer("Red", [{ name: "ex_red.png", start: 0, len: 3, opacity: 1, tf: { x: -150, y: -60, scale: 1, rot: 0 } }])];
      tlSave(); renderTimeline();
    });
    await p.waitForFunction(() => TlCanvas.state.W === 640, null, { timeout: 20000 });
    const goT = (t) => p.evaluate((t) => { setPlayhead(t); TlCanvas.state.t = t; TlCanvas.draw(); TlCanvas.paintLayers(); }, t);
    await goT(1); await p.waitForTimeout(500);
    // ƒx on the red square: rotation = time * 90 (a preset)
    await p.evaluate(() => TlCanvas.select(tl.images[0].clips[0], { lk: "i:0" })); await p.waitForTimeout(300);
    const ui = await p.evaluate(() => ({ props: Array.from(document.querySelectorAll("#tlpExP option")).map((o) => o.value), pre: Array.from(document.querySelectorAll("#tlpExPre option")).map((o) => o.value) }));
    check("ƒx Expressions in the Properties: the properties (x, y, scale, rotation, opacity, anchor) and the presets", ["x", "y", "scale", "rot", "op", "ax", "ay"].every((k) => ui.props.includes(k)) && ui.pre.includes("wiggle(2, 20)") && ui.pre.includes("loopOut()"), ui);
    await p.selectOption("#tlpExP", "rot"); await p.selectOption("#tlpExPre", "time * 90"); await p.click("#tlpExAdd"); await p.waitForTimeout(250);
    const r1 = await p.evaluate(() => ({ e: tl.images[0].clips[0].expr, rot1: TlCanvas.box(tl.images[0].clips[0], "img", 1).rot, rot2: TlCanvas.box(tl.images[0].clips[0], "img", 2).rot }));
    check("＋ ƒx rotation = time * 90: turned 90° at 1 s, 180° at 2 s", r1.e && r1.e.rot === "time * 90" && Math.abs(r1.rot1 - 90) < 1e-6 && Math.abs(r1.rot2 - 180) < 1e-6, r1);
    // a mistake is said at once, and the value falls back
    const inp = '[data-ex="rot"]';
    await p.fill(inp, "time * (90"); await p.dispatchEvent(inp, "input"); await p.waitForTimeout(120);
    const er = await p.evaluate(() => ({ msg: document.querySelector('[data-exe="rot"]').textContent, kept: tl.images[0].clips[0].expr.rot }));
    check("typing a broken expression: the mistake shown at once (the last good one kept)", /expected|ends too soon/.test(er.msg) && er.kept === "time * 90", er);
    await p.fill(inp, "time * 90 + wiggle(3, 10) - value"); await p.dispatchEvent(inp, "input"); await p.waitForTimeout(120);
    const wg = await p.evaluate(() => { const c = tl.images[0].clips[0]; const a = [0.5, 1, 1.5].map((t) => TlCanvas.box(c, "img", t).rot - t * 90); return { a, ok: document.querySelector('[data-exe="rot"]').textContent }; });
    check("…then a wiggle on top: within ±10° of time * 90, different moment to moment", wg.ok === "✓" && wg.a.every((v) => Math.abs(v) <= 10) && new Set(wg.a.map((v) => v.toFixed(3))).size === 3, wg);
    // a null keyed in x; the square's x linked to it (+ 100); opacity: linear(t, 0, 2, 0, 1)
    await p.click("#tlpNull"); await p.waitForTimeout(400);
    await p.evaluate(() => { const c = tl.images[tl.images.length - 1].clips[0]; c.kf = [{ at: 0, x: -200, y: 0 }, { at: 3, x: 100, y: 0 }]; tlSave(); renderTimeline(); });
    await p.evaluate(() => TlCanvas.select(tl.images[0].clips[0], { lk: "i:0" })); await p.waitForTimeout(300);
    await p.selectOption("#tlpExP", "x"); await p.selectOption("#tlpExPre", "layer(\"Null 1\", \"x\")"); await p.click("#tlpExAdd"); await p.waitForTimeout(200);
    await p.fill('[data-ex="x"]', 'layer("Null 1", "x") + 100'); await p.dispatchEvent('[data-ex="x"]', "input"); await p.waitForTimeout(100);
    await p.selectOption("#tlpExP", "op"); await p.selectOption("#tlpExPre", "linear(t, 0, 2, 0, 1)"); await p.click("#tlpExAdd"); await p.waitForTimeout(200);
    const lk = await p.evaluate(() => { const c = tl.images[0].clips[0]; return { x1: TlCanvas.box(c, "img", 1).cx, x2: TlCanvas.box(c, "img", 2).cx, e: c.expr }; });
    check("a LINK: x = layer(\"Null 1\", \"x\") + 100 - follows the keyed null (1 s: 320 - 100 + 100, 2 s: 320 + 0 + 100)", Math.abs(lk.x1 - 320) < 1e-6 && Math.abs(lk.x2 - 420) < 1e-6, lk);
    // the video layer: rotation = time * 45
    await p.evaluate(() => TlCanvas.select(tl.vlayers[0].clips[0], { lk: "vl:0" })); await p.waitForTimeout(300);
    await p.selectOption("#tlpExP", "rot"); await p.selectOption("#tlpExPre", "time * 90"); await p.click("#tlpExAdd"); await p.waitForTimeout(200);
    await p.fill('[data-ex="rot"]', "time * 45"); await p.dispatchEvent('[data-ex="rot"]', "input"); await p.waitForTimeout(100);
    const wk = await p.evaluate(() => { const v = TlParent.worldKeys(tl.vlayers[0].clips[0], "vl"), i = TlParent.worldKeys(tl.images[0].clips[0], "img"); return { vr: v.kf.filter((k) => k.rot != null).length, iop: i.kf.filter((k) => k.op != null).length, ix: i.kf.filter((k) => k.x != null).length }; });
    check("the compile gets keys sampled from the expressions (the video's turn, the square's x, turn and opacity)", wk.vr >= 2 && wk.iop >= 2 && wk.ix >= 2, wk);
    // compile parity
    const snapAt = async (t) => { await goT(t); await p.waitForTimeout(800); await goT(t); await p.waitForTimeout(300); return Buffer.from((await p.evaluate(() => TlCanvas.snapshot())).split(",")[1], "base64"); };
    fs.writeFileSync(path.join(pd, "temp_ex_1.png"), await snapAt(1)); fs.writeFileSync(path.join(pd, "temp_ex_2.png"), await snapAt(2));
    const resp = p.waitForResponse((r) => /\/api\/export$/.test(r.url()), { timeout: 180000 });
    await p.click("#tlExport");
    const job = await (await resp).json();
    let stt = "", log = [];
    for (let i = 0; i < 240 && job.id; i++) { const d = await api("/api/jobs/" + job.id); stt = d.status; log = d.log || []; if (stt === "done" || stt === "failed") break; await new Promise((ok) => setTimeout(ok, 1000)); }
    const movie = path.join(pd, P + ".mp4");
    check("⚙ Compile finished", stt === "done" && fs.existsSync(movie), [stt, log.slice(-6)]);
    if (stt === "done") {
      const W = 640, H = 360, c1 = rgbOf(path.join(pd, "temp_ex_1.png"), W, H), m1 = rgbOf(movie, W, H, 1), c2 = rgbOf(path.join(pd, "temp_ex_2.png"), W, H), m2 = rgbOf(movie, W, H, 2);
      const d1 = meanDiff(c1, m1), d2 = meanDiff(c2, m2);
      check("COMPILE = CANVAS at 1 s and 2 s (a wiggling, turning, linked, fading square + a video turned by an expression): mean difference under 6", d1 < 6 && d2 < 6, [Math.round(d1 * 100) / 100, Math.round(d2 * 100) / 100]);
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
