#!/usr/bin/env node
/* bitGen Studio — 2.498.0 in a REAL browser: BÉZIER MASKS (ext/timelinedock/tlmask.js) - the ✒ Mask Pen on a picture and
 * on a video layer, the modes / invert / feather, an animated mask path, and the compile (a picture baked, a video's
 * masks as a grey mask video + alphamerge) = the canvas. Also: a text on a path reaches the compile baked.
 * Tim (verbatim): "... and the rest of the After Effects gap list (expressions, Bézier masks, tracking and so on).."
 * Against the running app (H3_URL, default the e2e server on :8311), from the app folder (projects/e2e_mk498). No
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
if (!chromium) { console.log("SKIP: playwright is not installed here - the masks browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const ROOT = path.join(__dirname, "..");
const P = "e2e_mk498";
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
        "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "30", "-deadline", "realtime", "-c:a", "libopus", "-shortest", path.join(pd, "video", "mk_base.webm")]);
    ff(["-f", "lavfi", "-i", "color=c=0x30c040:s=320x180:r=24:d=3", "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "20", "-deadline", "realtime", path.join(pd, "video", "mk_green.webm")]);
    ff(["-f", "lavfi", "-i", "color=c=0xe03030:s=200x200", "-frames:v", "1", path.join(pd, "images", "mk_red.png")]);
    const booted = Promise.all([
      p.waitForResponse((r) => /\/api\/ui\/layout(\?|$)/.test(r.url()), { timeout: 60000 }).catch(() => null),
      p.waitForResponse((r) => /\/api\/dockers(\?|$)/.test(r.url()) && r.request().method() === "GET", { timeout: 60000 }).catch(() => null),
    ]);
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await booted;
    await p.waitForFunction(() => window.TlCanvas && window.TlMask && TlMask.ready && window.TlParent && window.TlTextAnim, null, { timeout: 30000 });
    await p.waitForTimeout(800);
    await p.evaluate(() => {
      const d = document.getElementById("timelinedock");
      if (/collapsed|dockgone/.test(d.className) && typeof toggleCollapse === "function") toggleCollapse("timelinedock");
      setVar("th", 820);
      if (document.getElementById("tlStage").classList.contains("off")) document.getElementById("tlStageTog").click();
      tl.video = [{ name: "mk_base.webm", src: "video", start: 0, dur: 3, in: 0, out: 3, opacity: 1 }];
      tl.vlayers = [mkLayer("Green", [{ name: "mk_green.webm", src: "video", start: 0, dur: 3, in: 0, out: 3, opacity: 1, tf: { x: 140, y: 0, scale: 1, rot: 0 } }])];
      tl.audio = [];
      tl.images = [mkLayer("Red", [{ name: "mk_red.png", start: 0, len: 3, opacity: 1, tf: { x: -170, y: 0, scale: 1, rot: 0 } }])];
      tlSave(); renderTimeline();
    });
    await p.waitForFunction(() => TlCanvas.state.W === 640, null, { timeout: 20000 });
    const goT = (t) => p.evaluate((t) => { setPlayhead(t); TlCanvas.state.t = t; TlCanvas.draw(); TlCanvas.paintLayers(); }, t);
    await goT(0); await p.waitForTimeout(600);
    const scr = (x, y) => p.evaluate(([x, y]) => { const r = document.getElementById("tlCanvas").getBoundingClientRect(), s = TlCanvas.toScreen(x, y); return [r.left + s.x, r.top + s.y]; }, [x, y]);
    const clickAt = async (x, y) => { const s = await scr(x, y); await p.mouse.click(s[0], s[1]); await p.waitForTimeout(120); };
    const dragAt = async (x0, y0, x1, y1) => { const a = await scr(x0, y0), c = await scr(x1, y1); await p.mouse.move(a[0], a[1]); await p.mouse.down(); await p.mouse.move(c[0], c[1], { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(150); };
    const px = (x, y, t) => p.evaluate(([x, y, t]) => { const g = document.createElement("canvas"); g.width = 640; g.height = 360; const c = g.getContext("2d"); TlCanvas.paintComp(c, t); return Array.from(c.getImageData(x, y, 1, 1).data).slice(0, 3); }, [x, y, t || 0]);
    // the red picture (centre 150, 180; 200 x 200): a diamond mask with the Pen
    await p.evaluate(() => TlCanvas.select(tl.images[0].clips[0], { lk: "i:0" })); await p.waitForTimeout(300);
    const none = await p.evaluate(() => !!document.getElementById("tlpMkPen"));
    await p.evaluate(() => TlCanvas.setTool("maskpen"));
    await clickAt(150, 100); await clickAt(230, 180); await clickAt(150, 260); await clickAt(70, 180); await clickAt(150, 100);
    const m1 = await p.evaluate(() => { const c = tl.images[0].clips[0]; return { n: (c.masks || []).length, closed: c.masks && c.masks[0].closed, pts: c.masks && c.masks[0].pts.length, x0: c.masks && c.masks[0].pts[0].x }; });
    check("✒ Mask Pen (the Properties' ✒ Masks offered it): 4 clicks + the first point again = a closed 4-point mask, kept as fractions of the picture", none && m1.n === 1 && m1.closed === true && m1.pts === 4 && Math.abs(m1.x0 - 0.5) < 0.01, m1);
    const r1 = await px(150, 180), r2 = await px(80, 110);
    check("canvas: the picture shows inside the diamond (red), not in its corners (the background)", r1[0] > 200 && r1[1] < 80 && r2[0] < 60 && r2[2] > 40, { r1, r2 });
    await p.click('[data-mkinv="0"]'); await p.waitForTimeout(150);
    const r3 = await px(150, 180), r4 = await px(80, 110);
    check("invert: now only the corners show", r3[0] < 60 && r4[0] > 200, { r3, r4 });
    await p.click('[data-mkinv="0"]'); await p.waitForTimeout(100);
    await p.fill('[data-mkn="0:feather"]', "30"); await p.dispatchEvent('[data-mkn="0:feather"]', "input"); await p.waitForTimeout(150);
    const edge = await px(150 + 76, 180), edge2 = await px(150, 180);
    check("feather 30 px: the edge goes soft (part red), the middle stays red", edge[0] > 50 && edge[0] < 200 && edge2[0] > 200, { edge, edge2 });
    // the green video layer (centre 460, 180; 320 x 180): a curved mask (drags), keyed at 0 s and changed at 2 s
    await p.evaluate(() => TlCanvas.select(tl.vlayers[0].clips[0], { lk: "vl:0" })); await p.waitForTimeout(300);
    await p.evaluate(() => TlCanvas.setTool("maskpen"));
    await dragAt(400, 130, 440, 130); await dragAt(540, 180, 540, 220); await dragAt(460, 240, 420, 240); await clickAt(380, 180); await p.keyboard.press("Enter"); await p.waitForTimeout(200);
    const m2 = await p.evaluate(() => { const c = tl.vlayers[0].clips[0]; const q = c.masks && c.masks[0]; return q ? { closed: q.closed, n: q.pts.length, smooth: Math.abs(q.pts[0].ox - q.pts[0].x) > 0.01 } : null; });
    check("dragging while placing = smooth points (handles); Enter closes the mask", m2 && m2.closed && m2.n === 4 && m2.smooth, m2);
    await p.click('[data-mkkey="0"]'); await p.waitForTimeout(150);
    await goT(2); await p.waitForTimeout(300);
    const a = await scr(540, 180); await p.mouse.move(a[0], a[1]); await p.mouse.down(); const c2 = await scr(600, 180); await p.mouse.move(c2[0], c2[1], { steps: 5 }); await p.mouse.up(); await p.waitForTimeout(200);
    const k2 = await p.evaluate(() => { const q = tl.vlayers[0].clips[0].masks[0]; return { keys: (q.keys || []).map((k) => k.at), x0: TlMask.pathAt(q, 0)[1].x, x2: TlMask.pathAt(q, 2)[1].x, x1: TlMask.pathAt(q, 1)[1].x }; });
    check("◇ keys the path at 0 s; dragging a point at 2 s makes a 2nd key there; in between it glides", k2.keys.length === 2 && k2.keys[1] === 2 && k2.x2 > k2.x0 + 0.1 && k2.x1 > k2.x0 && k2.x1 < k2.x2, k2);
    // a text on a path (the 2.496.0 gap: its bake must reach the compile)
    await goT(0);
    await p.evaluate(async () => {
      TlCanvas.addText({ x: 320, y: 60 });
      const c = tl.images[tl.images.length - 1].clips[0];
      const ta = document.getElementById("tlpText"); ta.value = "MASKS AND PATHS"; ta.dispatchEvent(new Event("input"));
      const sz = document.getElementById("tlpSize"); sz.value = "30"; sz.dispatchEvent(new Event("input"));
      c.len = 3; c.text.onpath = { on: true, path: "arc", r: 180, span: 120 }; tlSave(); await new Promise((ok) => setTimeout(ok, 300)); TlCanvas.mark();
    });
    // the compile
    const snapAt = async (t) => { await goT(t); await p.waitForTimeout(900); await goT(t); await p.waitForTimeout(300); return Buffer.from((await p.evaluate(() => TlCanvas.snapshot())).split(",")[1], "base64"); };
    fs.writeFileSync(path.join(pd, "temp_mk_1.png"), await snapAt(1)); fs.writeFileSync(path.join(pd, "temp_mk_2.png"), await snapAt(2));
    const resp = p.waitForResponse((r) => /\/api\/export$/.test(r.url()), { timeout: 180000 });
    await p.click("#tlExport");
    const job = await (await resp).json();
    const bk = await p.evaluate(() => ({ mb: tl.vlayers[0].clips[0].mbake, ib: tl.images[0].clips[0].bake, tb: tl.images[tl.images.length - 1].clips[0].bake }));
    let stt = "", log = [];
    for (let i = 0; i < 240 && job.id; i++) { const d = await api("/api/jobs/" + job.id); stt = d.status; log = d.log || []; if (stt === "done" || stt === "failed") break; await new Promise((ok) => setTimeout(ok, 1000)); }
    const movie = path.join(pd, P + ".mp4");
    check("before the compile: the masked picture and the text on a path baked, the video's masks made into a mask video", /^tlb_u[a-z0-9]+m\.webm$/.test(bk.mb || "") && /^tlb_/.test(bk.ib || "") && /^tlb_/.test(bk.tb || "") && fs.existsSync(path.join(pd, "video", bk.mb)), bk);
    check("⚙ Compile finished - the video's masks laid on as its alpha", stt === "done" && fs.existsSync(movie) && log.some((l) => /its masks \(the mask video/.test(l)), [stt, log.slice(-8)]);
    if (stt === "done") {
      const W = 640, H = 360, c1 = rgbOf(path.join(pd, "temp_mk_1.png"), W, H), mv1 = rgbOf(movie, W, H, 1), c2 = rgbOf(path.join(pd, "temp_mk_2.png"), W, H), mv2 = rgbOf(movie, W, H, 2);
      const d1 = meanDiff(c1, mv1), d2 = meanDiff(c2, mv2);
      const reg = (A, B, x0, y0, x1, y1) => { let d = 0, n = 0; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = (y * W + x) * 3; d += Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2]); n += 3; } return d / n; };
      const dt = reg(c1, mv1, 180, 0, 460, 110), dv = reg(c2, mv2, 300, 90, 620, 270);
      check("COMPILE = CANVAS at 1 s and 2 s (a feathered diamond on the picture, a moving curved mask on the video): mean difference under 6", d1 < 6 && d2 < 6, [Math.round(d1 * 100) / 100, Math.round(d2 * 100) / 100]);
      check("…region by region too: the text on its arc (under 8) and the masked video at 2 s (under 8)", dt < 8 && dv < 8, [Math.round(dt * 100) / 100, Math.round(dv * 100) / 100]);
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
