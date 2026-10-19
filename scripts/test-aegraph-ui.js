#!/usr/bin/env node
/* bitGen Studio — 2.489.0 in a REAL browser: THE GRAPH EDITOR, EASY EASE, THE ANCHOR POINT, BÉZIER MOTION PATHS
 * (ext/timelinedock/tlgraph.js, canvas.js, static/keyframes.js) - and the compile draws the same.
 * Tim (verbatim): "go with 1,2,4,5 and 6 as you suggested. we a getting close to building a fully featured professional app"
 * Against the running app (H3_URL, default the e2e server on :8311), from the app folder (test media in
 * projects/e2e_aeg489). No Playwright = SKIP. */
"use strict";
const fs = require("fs");
const path = require("path");
const { execSync, execFileSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the graph editor browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const ROOT = path.join(__dirname, "..");
const P = "e2e_aeg489";
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
        "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "30", "-deadline", "realtime", "-c:a", "libopus", "-shortest", path.join(pd, "video", "aeg_base.webm")]);
    ff(["-f", "lavfi", "-i", "color=c=blue:s=80x80", "-frames:v", "1", path.join(pd, "images", "aeg_blue.png")]);
    ff(["-f", "lavfi", "-i", "color=c=red:s=160x40", "-frames:v", "1", path.join(pd, "images", "aeg_red.png")]);
    const booted = Promise.all([
      p.waitForResponse((r) => /\/api\/ui\/layout(\?|$)/.test(r.url()), { timeout: 60000 }).catch(() => null),
      p.waitForResponse((r) => /\/api\/dockers(\?|$)/.test(r.url()) && r.request().method() === "GET", { timeout: 60000 }).catch(() => null),
    ]);
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await booted;
    await p.waitForFunction(() => window.TlCanvas && window.H3Keyframes && window.TlGraph, null, { timeout: 30000 });
    await p.waitForTimeout(800);
    await p.evaluate(() => {
      const d = document.getElementById("timelinedock");
      if (/collapsed|dockgone/.test(d.className) && typeof toggleCollapse === "function") toggleCollapse("timelinedock");
      setVar("th", 820);
      if (document.getElementById("tlStage").classList.contains("off")) document.getElementById("tlStageTog").click();
      tl.video = [{ name: "aeg_base.webm", src: "video", start: 0, dur: 4, in: 0, out: 4, opacity: 1 }];
      // the red bar: turned 90° about an anchor 60 px right of its centre - its centre lands 60 px ABOVE the position
      const red = { name: "aeg_red.png", start: 0, len: 4, opacity: 1, tf: { x: 0, y: 0, scale: 1, rot: 90, ax: 60, ay: 0 } };
      const blue = { name: "aeg_blue.png", start: 0, len: 4, opacity: 1, tf: { x: -200, y: 100, scale: 1, rot: 0 }, kf: [{ at: 0.5, x: -200, y: 100 }, { at: 3, x: 200, y: 100 }] };
      tl.vlayers = []; tl.audio = []; tl.images = [mkLayer("I1", [red]), mkLayer("I2", [blue])]; tlSave(); renderTimeline();
    });
    await p.waitForFunction(() => TlCanvas.state.W === 640, null, { timeout: 20000 });
    const goT = (t) => p.evaluate((t) => { setPlayhead(t); TlCanvas.state.t = t; TlCanvas.draw(); TlCanvas.paintLayers(); }, t);
    await goT(0.5); await p.waitForTimeout(600);
    const anc = await p.evaluate(() => { const c = tl.images[0].clips[0], bx = TlCanvas.box(c, "img", 0.5); return bx && { cx: bx.cx, cy: bx.cy, px: bx.px, py: bx.py }; });
    check("the anchor point: turned 90° about an anchor 60 px from its centre, the bar's centre sits 60 px above its position", anc && near(anc.cx, 320, 0.01) && near(anc.cy, 120, 0.01) && anc.px === 320 && anc.py === 180, anc);
    // select the blue square: the Properties' anchor, ease and graph controls
    await p.evaluate(() => TlCanvas.select(tl.images[1].clips[0], { lk: "i:1" }));
    await p.waitForTimeout(400);
    const ui = await p.evaluate(() => ["tlpAX", "tlpAY", "tlpEase", "tlpEaseIn", "tlpEaseOut", "tlpGraph", "tlpSmooth"].map((id) => !!document.getElementById(id)));
    check("Properties: ⊕ Anchor X / Y, Easy Ease / Ease In / Ease Out, 📈 Graph, ↝ Smooth path", ui.every(Boolean), ui);
    await p.click("#tlpEase"); await p.waitForTimeout(200);
    const ez = await p.evaluate(() => { const c = tl.images[1].clips[0]; return { e: c.kf[0].ease, bz: c.kf[0].bz }; });
    check("Easy Ease on the first key at the playhead: its tween leaves slowly (Bézier out-handle 0.333, 0 - no key before it to ease into)", ez.e === "bezier" && ez.bz[0] === 0.333 && ez.bz[1] === 0, ez);
    const eased = await p.evaluate(() => TlCanvas.tfAt(tl.images[1].clips[0], 0.75).x);
    check("...so it starts slowly (a tenth of the time in: well under a tenth of the way)", eased < -200 + 400 * 0.05, eased);
    // the anchor field keeps the layer where it is
    await p.evaluate(() => { TlCanvas.select(tl.images[0].clips[0], { lk: "i:0" }); });
    await p.waitForTimeout(300);
    const before = await p.evaluate(() => { const bx = TlCanvas.box(tl.images[0].clips[0], "img", 0.5); return [bx.cx, bx.cy]; });
    await p.evaluate(() => { const a = document.getElementById("tlpAX"); a.value = "0"; a.dispatchEvent(new Event("change")); });
    await p.waitForTimeout(200);
    const after = await p.evaluate(() => { const c = tl.images[0].clips[0], bx = TlCanvas.box(c, "img", 0.5); return { c: [bx.cx, bx.cy], tf: c.tf }; });
    check("changing the anchor keeps the layer in place (its position moves to match)", near(after.c[0], before[0], 0.05) && near(after.c[1], before[1], 0.05) && after.tf.ax === 0 && near(after.tf.y, -60, 0.05), { before, after });
    await p.evaluate(() => { const c = tl.images[0].clips[0]; c.tf = { x: 0, y: 0, scale: 1, rot: 90, ax: 60, ay: 0 }; tlSave(); TlCanvas.select(tl.images[1].clips[0], { lk: "i:1" }); });
    // ↝ Smooth path + the motion path on the canvas
    await p.click("#tlpSmooth"); await p.waitForTimeout(200);
    const sm = await p.evaluate(() => { const c = tl.images[1].clips[0]; return { to: c.kf[0].to, ti: c.kf[1].ti }; });
    check("↝ Smooth path: the position keys get Bézier handles", sm.to && sm.ti && near(sm.to[0], 400 / 6, 0.01) && near(sm.ti[0], -400 / 6, 0.01), sm);
    // drag the first key's handle upwards on the canvas: the path bends
    const hs = await p.evaluate(() => { const r = document.getElementById("tlCanvas").getBoundingClientRect(), c = tl.images[1].clips[0], k = c.kf[0], s = TlCanvas.toScreen(320 + k.x + k.to[0], 180 + k.y + k.to[1]); return { x: r.left + s.x, y: r.top + s.y, z: TlCanvas.state.view.z }; });
    await p.mouse.move(hs.x, hs.y); await p.mouse.down(); await p.mouse.move(hs.x, hs.y - 150 * hs.z, { steps: 6 }); await p.mouse.up();
    await p.waitForTimeout(300);
    const bent = await p.evaluate(() => { const c = tl.images[1].clips[0]; return { to: c.kf[0].to, ti0: c.kf[0].ti, mid: TlCanvas.tfAt(c, 1.75).y }; });
    check("dragging a ● handle on the canvas bends the motion path (the square passes above its straight line)", bent.to && bent.to[1] < -100 && bent.mid < 100 - 30, bent);
    // the Graph Editor
    await p.click("#tlpGraph"); await p.waitForTimeout(400);
    const gp = await p.evaluate(() => { const el = document.getElementById("tlGraph"); return { on: !!el && el.style.display !== "none", opts: Array.from(document.querySelectorAll("#tgProp option")).map((o) => o.textContent), keys: TlGraph.state.c && TlGraph.state.c.kf.length }; });
    check("📈 Graph Editor: a panel with the properties (the keyed ones marked ◆) and the value / speed graph", gp.on && gp.opts.some((t) => /Position X ◆/.test(t)) && gp.opts.some((t) => /Anchor X/.test(t)) && gp.keys === 2, gp);
    // drag the second Position X key down in the graph (a lower value)
    const kp = await p.evaluate(() => { const M = TlGraph.state.map, cv = document.getElementById("tgCv"), r = cv.getBoundingClientRect(), k = TlGraph.state.c.kf[1], s = r.width / cv.width; return { x: r.left + M.tx(k.at) * s, y: r.top + M.vy(k.x) * s, s }; });
    await p.mouse.move(kp.x, kp.y); await p.mouse.down(); await p.mouse.move(kp.x, kp.y + 40, { steps: 5 }); await p.mouse.up();
    await p.waitForTimeout(300);
    const kv = await p.evaluate(() => ({ x: tl.images[1].clips[0].kf[1].x, at: tl.images[1].clips[0].kf[1].at, info: document.getElementById("tgInfo").textContent }));
    check("dragging a ■ key down in the value graph lowers its value (and selects it)", kv.x < 190 && near(kv.at, 3, 0.05) && /key \+3\.00s/.test(kv.info), kv);
    // the speed graph
    await p.click('#tlGraph input[value="speed"]'); await p.waitForTimeout(200);
    const sp = await p.evaluate(() => TlGraph.state.mode);
    check("the speed graph shows instead of the value graph", sp === "speed");
    // F9 in the graph = Easy Ease on the selected key
    await p.evaluate(() => { const c = tl.images[1].clips[0]; delete c.kf[0].ease; delete c.kf[0].bz; TlGraph.state.sel = 0; TlGraph.state.mode = "value"; TlGraph.paint(); document.getElementById("tgCv").focus(); });
    await p.keyboard.press("F9"); await p.waitForTimeout(200);
    const f9 = await p.evaluate(() => tl.images[1].clips[0].kf[0]);
    check("F9 in the graph: Easy Ease on the selected key", f9.ease === "bezier" && f9.bz[0] === 0.333 && f9.bz[1] === 0, f9);
    // a strong slow-in / fast-out Bézier for the compile
    await p.evaluate(() => { const c = tl.images[1].clips[0]; c.kf[0].bz = [0.8, 0, 0.2, 1]; c.kf[1].x = 200; tlSave(); renderTimeline(); });
    // compile parity
    const snapAt = async (t) => { await goT(t); await p.waitForTimeout(700); await goT(t); await p.waitForTimeout(300); return Buffer.from((await p.evaluate(() => TlCanvas.snapshot())).split(",")[1], "base64"); };
    const s1 = await snapAt(1.5), s2 = await snapAt(2.4);
    fs.writeFileSync(path.join(pd, "temp_aeg_1.png"), s1); fs.writeFileSync(path.join(pd, "temp_aeg_2.png"), s2);
    const resp = p.waitForResponse((r) => /\/api\/export$/.test(r.url()), { timeout: 30000 });
    await p.click("#tlExport");
    const job = await (await resp).json();
    let st = "", log = [];
    for (let i = 0; i < 150 && job.id; i++) { const d = await api("/api/jobs/" + job.id); st = d.status; log = d.log || []; if (st === "done" || st === "failed") break; await new Promise((ok) => setTimeout(ok, 1000)); }
    const movie = path.join(pd, P + ".mp4");
    check("⚙ Compile finished", st === "done" && fs.existsSync(movie), [st, log.slice(-6)]);
    if (st === "done") {
      const W = 640, H = 360, c1 = rgbOf(path.join(pd, "temp_aeg_1.png"), W, H), m1 = rgbOf(movie, W, H, 1.5), c2 = rgbOf(path.join(pd, "temp_aeg_2.png"), W, H), m2 = rgbOf(movie, W, H, 2.4);
      const d1 = meanDiff(c1, m1), d2 = meanDiff(c2, m2);
      check("COMPILE = CANVAS with a Bézier ease, a curved motion path and the anchor (mean difference under 8, two moments)", d1 < 8 && d2 < 8, [Math.round(d1 * 100) / 100, Math.round(d2 * 100) / 100]);
      const red = (buf, x, y) => { const i = (y * W + x) * 3; return buf[i] > 150 && buf[i + 1] < 90; };
      check("...the anchored bar is where the canvas put it (red at 60 px above the position, not at the position's sides)", red(m1, 320, 120) && red(c1, 320, 120) && !red(m1, 390, 180), [red(m1, 320, 120), red(c1, 320, 120)]);
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
