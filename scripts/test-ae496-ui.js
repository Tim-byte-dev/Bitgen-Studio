#!/usr/bin/env node
/* bitGen Studio — 2.496.0 in a REAL browser: FREEHAND SHAPE PATHS + MERGE PATHS (ext/timelinedock/tlshape.js), TEXT ON A
 * PATH (tltextanim.js), ROVING KEYFRAMES (static/keyframes.js rove, the Graph Editor's Rove) - canvas and compile.
 * Tim (verbatim): "Merge Paths, freehand shape paths, text on a path, roving keyframes, and the rest of the After Effects
 * gap list"
 * Against the running app (H3_URL, default the e2e server on :8311), from the app folder (projects/e2e_ae496). No
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
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.496.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const ROOT = path.join(__dirname, "..");
const P = "e2e_ae496";
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
        "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "30", "-deadline", "realtime", "-c:a", "libopus", "-shortest", path.join(pd, "video", "ae_base.webm")]);
    ff(["-f", "lavfi", "-i", "color=c=0xe03030:s=60x60", "-frames:v", "1", path.join(pd, "images", "ae_red.png")]);
    const booted = Promise.all([
      p.waitForResponse((r) => /\/api\/ui\/layout(\?|$)/.test(r.url()), { timeout: 60000 }).catch(() => null),
      p.waitForResponse((r) => /\/api\/dockers(\?|$)/.test(r.url()) && r.request().method() === "GET", { timeout: 60000 }).catch(() => null),
    ]);
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await booted;
    await p.waitForFunction(() => window.TlCanvas && window.TlShape && TlShape.drawn && window.TlTextAnim && TlTextAnim.onPath && window.TlGraph && window.H3Keyframes && H3Keyframes.rove, null, { timeout: 30000 });
    await p.waitForTimeout(800);
    await p.evaluate(() => {
      const d = document.getElementById("timelinedock");
      if (/collapsed|dockgone/.test(d.className) && typeof toggleCollapse === "function") toggleCollapse("timelinedock");
      setVar("th", 820);
      if (document.getElementById("tlStage").classList.contains("off")) document.getElementById("tlStageTog").click();
      tl.video = [{ name: "ae_base.webm", src: "video", start: 0, dur: 3, in: 0, out: 3, opacity: 1 }];
      tl.vlayers = []; tl.audio = []; tl.images = []; tlSave(); renderTimeline();
    });
    await p.waitForFunction(() => TlCanvas.state.W === 640, null, { timeout: 20000 });
    const goT = (t) => p.evaluate((t) => { setPlayhead(t); TlCanvas.state.t = t; TlCanvas.draw(); TlCanvas.paintLayers(); }, t);
    await goT(0); await p.waitForTimeout(400);
    const scr = (x, y) => p.evaluate(([x, y]) => { const r = document.getElementById("tlCanvas").getBoundingClientRect(), s = TlCanvas.toScreen(x, y); return [r.left + s.x, r.top + s.y]; }, [x, y]);
    const drawPath = async (pts, mods) => {
      const s0 = await scr(pts[0][0], pts[0][1]); for (const m of mods || []) await p.keyboard.down(m);
      await p.mouse.move(s0[0], s0[1]); await p.mouse.down();
      for (const q of pts.slice(1)) { const s = await scr(q[0], q[1]); await p.mouse.move(s[0], s[1]); }
      await p.mouse.up(); for (const m of mods || []) await p.keyboard.up(m); await p.waitForTimeout(300);
    };
    // ✎ Freehand: a loop (closed) - then an open stroke
    await p.evaluate(() => TlCanvas.setTool("freehand"));
    const loop = Array.from({ length: 48 }, (_, i) => [180 + 90 * Math.cos(i / 47 * Math.PI * 2), 180 + 90 * Math.sin(i / 47 * Math.PI * 2)]);
    await drawPath(loop);
    const f1 = await p.evaluate(() => { const L = tl.images[tl.images.length - 1], c = L && L.clips[0]; return c && c.shape ? { kind: c.shape.kind, closed: c.shape.closed, n: c.shape.path.length, w: c.shape.w, h: c.shape.h, tool: TlCanvas.state.tool, name: L.name } : null; });
    check("✎ Freehand (Shift+Q): a drawn loop = a CLOSED freehand shape layer (~180 x 180, thinned + smoothed), then the Move tool", !!f1 && f1.kind === "path" && f1.closed === true && f1.n > 8 && f1.n < 60 && Math.abs(f1.w - 180) < 8 && f1.tool === "move", f1);
    await p.evaluate(() => TlCanvas.setTool("freehand"));
    await drawPath(Array.from({ length: 30 }, (_, i) => [380 + i * 7, 300 - 40 * Math.sin(i / 29 * Math.PI)]));
    const f2 = await p.evaluate(() => { const c = tl.images[tl.images.length - 1].clips[0]; return { kind: c.shape.kind, closed: c.shape.closed, strokeW: c.shape.strokeW, fillOp: c.shape.fillOp }; });
    check("…an open stroke = an OPEN freehand line (a 4 px stroke, no fill)", f2.kind === "path" && f2.closed === false && f2.strokeW === 4 && f2.fillOp === 0, f2);
    // ⧉ ＋ Path + ⊕ Merge Paths on the loop: an ellipse subtracted at its middle
    await p.evaluate(() => TlCanvas.select(tl.images[0].clips[0], { lk: "i:0" })); await p.waitForTimeout(300);
    await p.selectOption("#tlpShPk", "ellipse"); await p.click("#tlpShPAdd"); await p.waitForTimeout(250);
    const setNum = async (sel, v) => { await p.fill(sel, String(v)); await p.dispatchEvent(sel, "input"); await p.waitForTimeout(60); };
    await setNum('[data-shp="0:x"]', 0); await setNum('[data-shp="0:y"]', 0); await setNum('[data-shp="0:w"]', 70); await setNum('[data-shp="0:h"]', 70);
    await p.selectOption('[data-shpm="0"]', "subtract"); await p.waitForTimeout(100);
    const px = (x, y, t) => p.evaluate(([x, y, t]) => { const g = document.createElement("canvas"); g.width = 640; g.height = 360; const c = g.getContext("2d"); TlCanvas.paintComp(c, t); return Array.from(c.getImageData(x, y, 1, 1).data).slice(0, 3); }, [x, y, t || 0]);
    const before = await px(180, 180);
    await p.click('[data-shb="merge"]'); await p.waitForTimeout(300);
    const mid = await px(180, 180), ring = await px(180 + 60, 180);
    check("⧉ ＋ Path (an ellipse, subtract) + ⊕ Merge Paths: the loop's middle becomes a HOLE (the base shows), the ring keeps the fill", before[0] > 200 && mid[0] < 60 && mid[2] > 40 && ring[0] > 200, { before, mid, ring });
    // text on a path
    await p.evaluate(async () => {
      TlCanvas.addText({ x: 470, y: 150 });
      const c = tl.images[tl.images.length - 1].clips[0];
      const ta = document.getElementById("tlpText"); ta.value = "ROUND AND ROUND WE GO"; ta.dispatchEvent(new Event("input"));
      const sz = document.getElementById("tlpSize"); sz.value = "26"; sz.dispatchEvent(new Event("input"));
      c.len = 3; tlSave(); await new Promise((ok) => setTimeout(ok, 300)); TlCanvas.paintProps();
    });
    await p.waitForTimeout(300);
    await p.click("#tlpTpOn"); await p.waitForTimeout(250);
    await p.selectOption("#tlpTpPath", "circle"); await p.waitForTimeout(250);
    await setNum('[data-tp="r"]', 90);
    await goT(0); await p.click('[data-tpk="off"]'); await p.waitForTimeout(150);
    await goT(2); await setNum('[data-tp="off"]', 50); await p.waitForTimeout(150);
    const tp = await p.evaluate(() => { const c = tl.images[tl.images.length - 1].clips[0], pa = TlTextAnim.picture(c, 0), pb = TlTextAnim.picture(c, 2); return { live: TlTextAnim.live(c), w0: pa.width, h0: pa.height, k: (c.kf || []).filter((k) => k.tp_off != null).map((k) => [k.at, k.tp_off]), s0: pa.toDataURL().length, s2: pb.toDataURL().length }; });
    const a0 = await p.evaluate(() => { const c = tl.images[tl.images.length - 1].clips[0]; const g = TlTextAnim.picture(c, 0); return g.toDataURL(); });
    const a2 = await p.evaluate(() => { const c = tl.images[tl.images.length - 1].clips[0]; const g = TlTextAnim.picture(c, 2); return g.toDataURL(); });
    check("〰 On a path: a circle r 90 - the text's picture is a square round it (~2 x (90 + the letters)); start % keyed 0 → 50 between 0 s and 2 s slides the letters round", tp.live && tp.w0 === tp.h0 && tp.w0 > 200 && tp.w0 < 330 && tp.k.length === 2 && tp.k[1][1] === 50 && a0 !== a2, { tp, same: a0 === a2 });
    // roving keyframes: the red square with 4 position keys, the middle two roving (the Graph Editor's Rove)
    await p.evaluate(() => { tl.images.push(mkLayer("Red", [{ name: "ae_red.png", start: 0, len: 3, opacity: 1, tf: { x: -250, y: -120, scale: 1, rot: 0 }, kf: [{ at: 0, x: -250, y: -120 }, { at: 0.3, x: -150, y: -120 }, { at: 0.6, x: -150, y: 100 }, { at: 3, x: 250, y: 100 }] }])); tlSave(); renderTimeline(); });
    const ri = await p.evaluate(() => tl.images.length - 1);
    await p.evaluate((ri) => { TlCanvas.select(tl.images[ri].clips[0], { lk: "i:" + ri }); TlGraph.open(tl.images[ri].clips[0]); }, ri); await p.waitForTimeout(300);
    for (const k of [1, 2]) { await p.evaluate((k) => { TlGraph.state.prop = "x"; TlGraph.state.sel = k; }, k); await p.click("#tgRove"); await p.waitForTimeout(150); }
    const rv = await p.evaluate((ri) => { TlGraph.close(); return tl.images[ri].clips[0].kf.filter((k) => k.x != null).map((k) => [k.at, !!k.rove]); }, ri);
    // path 100 + 220 + 400 = 720 px over 3 s: 0.417 s, 1.333 s
    check("Graph Editor ▸ Rove on the 2 middle position keys: re-timed for an even speed (0.3 → 0.417 s, 0.6 → 1.333 s)", rv.length === 4 && rv[1][1] && rv[2][1] && Math.abs(rv[1][0] - 0.417) < 0.002 && Math.abs(rv[2][0] - 1.333) < 0.002, rv);
    // the compile: shapes + the text baked by the page, the roving keys as they are now
    const snapAt = async (t) => { await goT(t); await p.waitForTimeout(700); await goT(t); await p.waitForTimeout(300); return Buffer.from((await p.evaluate(() => TlCanvas.snapshot())).split(",")[1], "base64"); };
    fs.writeFileSync(path.join(pd, "temp_ae_1.png"), await snapAt(1)); fs.writeFileSync(path.join(pd, "temp_ae_2.png"), await snapAt(2));
    const resp = p.waitForResponse((r) => /\/api\/export$/.test(r.url()), { timeout: 180000 });
    await p.click("#tlExport");
    const job = await (await resp).json();
    let stt = "", log = [];
    for (let i = 0; i < 240 && job.id; i++) { const d = await api("/api/jobs/" + job.id); stt = d.status; log = d.log || []; if (stt === "done" || stt === "failed") break; await new Promise((ok) => setTimeout(ok, 1000)); }
    const movie = path.join(pd, P + ".mp4");
    check("⚙ Compile finished (the freehand shapes + the text on a path baked by the page)", stt === "done" && fs.existsSync(movie), [stt, log.slice(-6)]);
    if (stt === "done") {
      const W = 640, H = 360, c1 = rgbOf(path.join(pd, "temp_ae_1.png"), W, H), m1 = rgbOf(movie, W, H, 1), c2 = rgbOf(path.join(pd, "temp_ae_2.png"), W, H), m2 = rgbOf(movie, W, H, 2);
      const d1 = meanDiff(c1, m1), d2 = meanDiff(c2, m2);
      check("COMPILE = CANVAS at 1 s and 2 s (merged freehand shape, open line, text sliding round its circle, the roving square): mean difference under 6", d1 < 6 && d2 < 6, [Math.round(d1 * 100) / 100, Math.round(d2 * 100) / 100]);
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
