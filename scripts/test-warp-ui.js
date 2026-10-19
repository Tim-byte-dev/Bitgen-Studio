#!/usr/bin/env node
/* bitGen Studio — 2.507.0 in a REAL browser: 📌 PUPPET PINS and ⌗ MESH WARP (tlwarp.js).
 * Tim (verbatim): "lets do steps 1,2,3 , 4,5,6 and 7" (step 1: particles, light rays, mesh warp, puppet pins)
 *   1. the 📌 tool: click twice on a picture layer = two pins; drag one = the layer bends past its box, the other holds
 *   2. ◇ key here, then a drag at another moment = a second key; in between the pin glides
 *   3. ⌗ Mesh warp on a VIDEO layer: drag a grid point = the picture bends; it now needs the page bake
 *   4. ⚙ Compile: COMPILE = CANVAS at two moments; Alt+click a pin = gone
 * Against the running app (H3_URL, default the e2e server on :8311), from the app folder (projects/e2e_wp507). No
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
if (!chromium) { console.log("SKIP: playwright is not installed here - the warp browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const ROOT = path.join(__dirname, "..");
const P = "e2e_wp507";
let pass = 0, fail = 0;
const check = (n, cond, got) => {
  if (cond) { pass++; console.log("PASS: " + n); }
  else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); }
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

(async () => {
  const b = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
  const p = await b.newPage({ viewport: { width: 2200, height: 1300 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  try {
    await api("/api/projects/load", { name: P });
    const pd = path.join(ROOT, "projects", P);
    fs.mkdirSync(path.join(pd, "video"), { recursive: true }); fs.mkdirSync(path.join(pd, "images"), { recursive: true });
    ff(["-f", "lavfi", "-i", "color=c=0x202020:s=640x360:r=24:d=3", "-f", "lavfi", "-i", "sine=frequency=330:duration=3",
        "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "30", "-deadline", "realtime", "-c:a", "libopus", "-shortest", path.join(pd, "video", "wp_base.webm")]);
    ff(["-f", "lavfi", "-i", "testsrc2=s=240x136:r=24:d=3", "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "12", "-deadline", "realtime", path.join(pd, "video", "wp_clip.webm")]);
    ff(["-f", "lavfi", "-i", "testsrc=s=200x60:r=1:d=1", "-frames:v", "1", path.join(pd, "images", "wp_bar.png")]);
    const booted = Promise.all([
      p.waitForResponse((r) => /\/api\/ui\/layout(\?|$)/.test(r.url()), { timeout: 60000 }).catch(() => null),
      p.waitForResponse((r) => /\/api\/dockers(\?|$)/.test(r.url()) && r.request().method() === "GET", { timeout: 60000 }).catch(() => null),
    ]);
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await booted;
    await p.waitForFunction(() => window.TlCanvas && window.TlWarp && TlWarp.ready && window.TlVBake && TlVBake.ready, null, { timeout: 30000 });
    await p.waitForTimeout(800);
    await p.evaluate(() => {
      const d = document.getElementById("timelinedock");
      if (/collapsed|dockgone/.test(d.className) && typeof toggleCollapse === "function") toggleCollapse("timelinedock");
      setVar("th", 820);
      if (document.getElementById("tlStage").classList.contains("off")) document.getElementById("tlStageTog").click();
      tl.video = [{ name: "wp_base.webm", src: "video", start: 0, dur: 3, in: 0, out: 3, opacity: 1 }];
      tl.vlayers = [mkLayer("Clip", [{ name: "wp_clip.webm", src: "video", start: 0, dur: 3, in: 0, out: 3, opacity: 1, tf: { x: -170, y: -60, scale: 1, rot: 0 } }])];
      tl.audio = [];
      tl.images = [mkLayer("Bar", [{ name: "wp_bar.png", start: 0, len: 3, opacity: 1, tf: { x: 150, y: -40, scale: 1, rot: 0 } }])];
      tlSave(); renderTimeline();
    });
    await p.waitForFunction(() => TlCanvas.state.W === 640, null, { timeout: 20000 });
    const goT = (t) => p.evaluate((t) => { setPlayhead(t); TlCanvas.state.t = t; TlCanvas.draw(); TlCanvas.paintLayers(); }, t);
    await goT(0); await p.waitForTimeout(800);
    const scr = (x, y) => p.evaluate(([x, y]) => { const r = document.getElementById("tlCanvas").getBoundingClientRect(), s = TlCanvas.toScreen(x, y); return [r.left + s.x, r.top + s.y]; }, [x, y]);
    const comp = (t) => p.evaluate((t) => { const g = document.createElement("canvas"); g.width = 640; g.height = 360; const c = g.getContext("2d"); TlCanvas.paintComp(c, t); return Array.from(c.getImageData(0, 0, 640, 360).data); }, t);
    const region = (px, x0, y0, x1, y1) => { const o = []; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = (y * 640 + x) * 4; o.push(px[i], px[i + 1], px[i + 2]); } return o; };
    const lum = (arr) => arr.reduce((s, v) => s + v, 0) / arr.length;
    const boxPt = (which, u, v) => p.evaluate(([which, u, v]) => { const c = which === "img" ? tl.images[0].clips[0] : tl.vlayers[0].clips[0], b = TlCanvas.box(c, which === "img" ? "img" : "vl", TlCanvas.state.t);
      const a = (b.rot || 0) * Math.PI / 180, dx = (u - 0.5) * b.w, dy = (v - 0.5) * b.h; return [b.cx + dx * Math.cos(a) - dy * Math.sin(a), b.cy + dx * Math.sin(a) + dy * Math.cos(a), b.w, b.h]; }, [which, u, v]);
    const drag = async (a, z, alt) => { const s0 = await scr(a[0], a[1]), s1 = await scr(z[0], z[1]); if (alt) await p.keyboard.down("Alt"); await p.mouse.move(s0[0], s0[1]); await p.mouse.down();
      for (let k = 1; k <= 6; k++) await p.mouse.move(s0[0] + (s1[0] - s0[0]) * k / 6, s0[1] + (s1[1] - s0[1]) * k / 6); await p.mouse.up(); if (alt) await p.keyboard.up("Alt"); await p.waitForTimeout(300); };

    /* 1. two pins on the bar, drag the right one down */
    await p.evaluate(() => TlCanvas.select(tl.images[0].clips[0], TlCanvas.layerOf(tl.images[0].clips[0]))); await p.waitForTimeout(300);
    await p.evaluate(() => TlCanvas.setTool("puppet"));
    const L = await boxPt("img", 0.1, 0.5), R = await boxPt("img", 0.9, 0.5);
    await drag(L, L); await drag(R, R);
    const below0 = region(await comp(0), Math.round(R[0]) - 20, Math.round(R[1] + R[3] / 2) + 10, Math.round(R[0]) + 20, Math.round(R[1] + R[3] / 2) + 60);
    const lreg = async () => region(await comp(0), Math.round(L[0]) - 6, Math.round(L[1]) - 6, Math.round(L[0]) + 6, Math.round(L[1]) + 6);
    const left0 = await lreg();
    await drag(R, [R[0], R[1] + 70]);
    const w1 = await p.evaluate(() => JSON.parse(JSON.stringify(tl.images[0].clips[0].warp)));
    const below1 = region(await comp(0), Math.round(R[0]) - 20, Math.round(R[1] + R[3] / 2) + 10, Math.round(R[0]) + 20, Math.round(R[1] + R[3] / 2) + 60);
    const leftSame = meanDiff(left0, await lreg());
    check("📌 two clicks = two pins; dragging the right one down bends the bar past its box (the dark area below it fills), the left pin holds",
      w1 && w1.pins.length === 2 && w1.pins[1].dy > 0.8 && Math.abs(w1.pins[0].dx) < 1e-6 && meanDiff(below0, below1) > 15 && leftSame < 12, { pins: w1 && w1.pins, d: meanDiff(below0, below1), left: leftSame });

    /* 2. keys */
    await p.click("#tlpWpKey"); await p.waitForTimeout(300);
    await goT(2); await p.waitForTimeout(300);
    const R2 = [R[0], R[1] + 70];
    await drag(R2, [R[0], R[1] - 40]);
    const ks = await p.evaluate(() => (tl.images[0].clips[0].kf || []).filter((k) => k.wp2y != null).map((k) => [k.at, k.wp2y]));
    const mid = await p.evaluate(() => TlWarp.stateAt(tl.images[0].clips[0], 1, H3Keyframes).pins[1].dy);
    check("◇ key here, then a drag at 2 s = a second key; at 1 s the pin is between the two", ks.length === 2 && ks[0][0] === 0 && ks[1][0] === 2 && ks[1][1] < 0 && mid < ks[0][1] && mid > ks[1][1], { ks, mid });

    /* 3. mesh warp on the video layer */
    await goT(1); await p.waitForTimeout(300);
    await p.evaluate(() => TlCanvas.select(tl.vlayers[0].clips[0], TlCanvas.layerOf(tl.vlayers[0].clips[0]))); await p.waitForTimeout(300);
    await p.click("#tlpWpMesh"); await p.waitForTimeout(400);
    const vb0 = region(await comp(1), 40, 40, 260, 200);
    const N = await boxPt("vl", 1 / 3, 1 / 3);
    await drag(N, [N[0] + 40, N[1] + 30]);
    const vw = await p.evaluate(() => ({ m: tl.vlayers[0].clips[0].warp.mesh, needs: TlVBake.needs(tl.vlayers[0].clips[0]), tool: TlCanvas.state.tool }));
    const vb1 = region(await comp(1), 40, 40, 260, 200);
    check("⌗ Mesh warp on the video layer: dragging a grid point moves it (offset kept) and bends the picture; the layer now needs the page bake",
      vw.m && vw.m[5][0] > 0.1 && vw.m[5][1] > 0.1 && meanDiff(vb0, vb1) > 4 && vw.needs === true && vw.tool === "puppet", { m5: vw.m && vw.m[5], d: meanDiff(vb0, vb1), needs: vw.needs });

    /* 4. the compile */
    const snapAt = async (t) => { await goT(t); await p.waitForTimeout(900); await goT(t); await p.waitForTimeout(400); return Buffer.from((await p.evaluate(() => TlCanvas.snapshot())).split(",")[1], "base64"); };
    fs.writeFileSync(path.join(pd, "temp_wp_1.png"), await snapAt(1)); fs.writeFileSync(path.join(pd, "temp_wp_2.png"), await snapAt(2));
    const resp = p.waitForResponse((r) => /\/api\/export$/.test(r.url()), { timeout: 400000 });
    await p.click("#tlExport");
    const job = await (await resp).json();
    let stt = "", log = [];
    for (let i = 0; i < 400 && job.id; i++) { const d = await api("/api/jobs/" + job.id); stt = d.status; log = d.log || []; if (stt === "done" || stt === "failed") break; await new Promise((ok) => setTimeout(ok, 1000)); }
    const movie = path.join(pd, P + ".mp4");
    const baked = await p.evaluate(() => ({ img: !!tl.images[0].clips[0].bake, vb: tl.vlayers[0].clips[0].vbake }));
    check("⚙ Compile: the warped bar baked, the mesh-warped video layer baked whole and overlaid", stt === "done" && fs.existsSync(movie) && baked.img && /^tlb_.*_vb\.webm$/.test(baked.vb || ""), [stt, baked, log.slice(-6)]);
    if (stt === "done") {
      const W = 640, H = 360, c1 = rgbOf(path.join(pd, "temp_wp_1.png"), W, H), m1 = rgbOf(movie, W, H, 1), c2 = rgbOf(path.join(pd, "temp_wp_2.png"), W, H), m2 = rgbOf(movie, W, H, 2);
      const d1 = meanDiff(c1, m1), d2 = meanDiff(c2, m2);
      check("COMPILE = CANVAS at 1 s and 2 s (a pinned bar mid-glide and at its key, a mesh-warped video): mean difference under 7", d1 < 7 && d2 < 7, [Math.round(d1 * 100) / 100, Math.round(d2 * 100) / 100]);
    }

    /* 5. Alt+click removes a pin (and its keys) */
    await goT(0); await p.waitForTimeout(300);
    await p.evaluate(() => { TlCanvas.select(tl.images[0].clips[0], TlCanvas.layerOf(tl.images[0].clips[0])); TlCanvas.setTool("puppet"); }); await p.waitForTimeout(300);
    const Lp = await boxPt("img", 0.1, 0.5);
    await drag(Lp, Lp, true);
    const after = await p.evaluate(() => ({ n: tl.images[0].clips[0].warp.pins.length, k: (tl.images[0].clips[0].kf || []).some((k) => k.wp1x != null) }));
    check("Alt+click a pin = it is gone, its keys too", after.n === 1 && !after.k, after);
    check("no page errors", errs.length === 0, errs);
  } catch (e) {
    check("the browser run finished", false, String(e && e.stack || e).slice(0, 700));
  } finally {
    try { await p.evaluate(() => { tl.video = []; tl.vlayers = []; tl.images = []; tl.audio = []; tlSave(); renderTimeline(); }); } catch { /* closed */ }
    await b.close();
    try { await api("/api/projects/load", { name: "default" }); } catch { /* best effort */ }
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
