#!/usr/bin/env node
/* bitGen Studio — 2.506.0 in a REAL browser: ✨ PARTICLES, ☀ LIGHT RAYS and a VIDEO LAYER BAKED WHOLE (tlparticles.js, tlrays.js, tlvbake.js).
 * Tim (verbatim): "lets do steps 1,2,3 , 4,5,6 and 7" (step 1: particles, light rays, mesh warp, puppet pins)
 *   1. the 🌫 tool with Shift: a particle emitter where you click; its particles move (1 s vs 1.5 s), pre-roll fills the air
 *   2. ☀ Light rays on a bright picture: rays reach PAST the picture's own edges
 *   3. ☀ Light rays on a VIDEO layer -> ⚙ Compile bakes it whole (seeked frame by frame) and overlays that;
 *      COMPILE = CANVAS at two moments
 * Against the running app (H3_URL, default the e2e server on :8311), from the app folder (projects/e2e_pt506). No
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
if (!chromium) { console.log("SKIP: playwright is not installed here - the particles / rays browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const ROOT = path.join(__dirname, "..");
const P = "e2e_pt506";
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
        "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "30", "-deadline", "realtime", "-c:a", "libopus", "-shortest", path.join(pd, "video", "pt_base.webm")]);
    ff(["-f", "lavfi", "-i", "testsrc2=s=240x136:r=24:d=3", "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "12", "-deadline", "realtime", path.join(pd, "video", "pt_clip.webm")]);
    ff(["-f", "lavfi", "-i", "color=c=black@0.0:s=120x120,format=rgba", "-vf", "geq=r='255':g='255':b='230':a='255*lt(hypot(X-60,Y-60),40)'", "-frames:v", "1", path.join(pd, "images", "pt_sun.png")]);
    const booted = Promise.all([
      p.waitForResponse((r) => /\/api\/ui\/layout(\?|$)/.test(r.url()), { timeout: 60000 }).catch(() => null),
      p.waitForResponse((r) => /\/api\/dockers(\?|$)/.test(r.url()) && r.request().method() === "GET", { timeout: 60000 }).catch(() => null),
    ]);
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await booted;
    await p.waitForFunction(() => window.TlCanvas && window.TlGen && TlGen.ready && window.TlRays && TlRays.ready && window.TlVBake && TlVBake.ready, null, { timeout: 30000 });
    await p.waitForTimeout(800);
    await p.evaluate(() => {
      const d = document.getElementById("timelinedock");
      if (/collapsed|dockgone/.test(d.className) && typeof toggleCollapse === "function") toggleCollapse("timelinedock");
      setVar("th", 820);
      if (document.getElementById("tlStage").classList.contains("off")) document.getElementById("tlStageTog").click();
      tl.video = [{ name: "pt_base.webm", src: "video", start: 0, dur: 3, in: 0, out: 3, opacity: 1 }];
      tl.vlayers = [mkLayer("Clip", [{ name: "pt_clip.webm", src: "video", start: 0, dur: 3, in: 0, out: 3, opacity: 1, tf: { x: -170, y: -60, scale: 1, rot: 0 } }])];
      tl.audio = [];
      tl.images = [mkLayer("Sun", [{ name: "pt_sun.png", start: 0, len: 3, opacity: 1, tf: { x: 170, y: -60, scale: 1, rot: 0 } }])];
      tlSave(); renderTimeline();
    });
    await p.waitForFunction(() => TlCanvas.state.W === 640, null, { timeout: 20000 });
    const goT = (t) => p.evaluate((t) => { setPlayhead(t); TlCanvas.state.t = t; TlCanvas.draw(); TlCanvas.paintLayers(); }, t);
    await goT(1); await p.waitForTimeout(800);
    const scr = (x, y) => p.evaluate(([x, y]) => { const r = document.getElementById("tlCanvas").getBoundingClientRect(), s = TlCanvas.toScreen(x, y); return [r.left + s.x, r.top + s.y]; }, [x, y]);
    const comp = (t) => p.evaluate((t) => { const g = document.createElement("canvas"); g.width = 640; g.height = 360; const c = g.getContext("2d"); TlCanvas.paintComp(c, t); return Array.from(c.getImageData(0, 0, 640, 360).data); }, t);
    const region = (px, x0, y0, x1, y1) => { const o = []; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = (y * 640 + x) * 4; o.push(px[i], px[i + 1], px[i + 2]); } return o; };
    const lum = (arr) => arr.reduce((s, v) => s + v, 0) / arr.length;

    /* 1. particles */
    const before = region(await comp(1), 200, 220, 440, 360);
    await p.evaluate(() => TlCanvas.setTool("gen"));
    const e0 = await scr(320, 330); await p.keyboard.down("Shift"); await p.mouse.click(e0[0], e0[1]); await p.keyboard.up("Shift"); await p.waitForTimeout(400);
    const pc = await p.evaluate(() => { const L = tl.images.find((L) => L.clips[0].gen && L.clips[0].gen.kind === "particles"); return L ? { n: L.name, g: L.clips[0].gen } : null; });
    check("🌫 tool + Shift-click: a Particles layer with its emitter where it was clicked", pc && /Particles/.test(pc.n) && pc.g.ex === 0 && pc.g.ey === 150, pc);
    await p.evaluate(() => { const L = tl.images.find((L) => L.clips[0].gen && L.clips[0].gen.kind === "particles"); TlCanvas.select(L.clips[0], TlCanvas.layerOf(L.clips[0])); });
    await p.waitForTimeout(300);
    const ui = await p.evaluate(() => ({ kind: (document.getElementById("tlpGnKind") || {}).value, rate: !!document.querySelector('[data-gn="rate"]'), pre: !!document.getElementById("tlpGnPre") }));
    await p.fill('[data-gn="rate"]', "80"); await p.dispatchEvent('[data-gn="rate"]', "input");
    await p.click("#tlpGnPre"); await p.waitForTimeout(300);
    const at1 = region(await comp(1), 200, 220, 440, 360), at15 = region(await comp(1.5), 200, 220, 440, 360);
    check("✨ Generator shows Particles (rate, pre-roll); the fountain lights the area above the emitter and moves (1 s vs 1.5 s)",
      ui.kind === "particles" && ui.rate && ui.pre && lum(at1) > lum(before) + 4 && meanDiff(at1, at15) > 1.5, { ui, l0: lum(before), l1: lum(at1), d: meanDiff(at1, at15) });

    /* 2. rays on the sun picture */
    const outside0 = region(await comp(1), 470, 20, 640, 90);
    await p.evaluate(() => TlCanvas.select(tl.images[0].clips[0], TlCanvas.layerOf(tl.images[0].clips[0]))); await p.waitForTimeout(300);
    await p.click("#tlpRyOn"); await p.waitForTimeout(300);
    await p.fill('[data-ry="length"]', "150"); await p.dispatchEvent('[data-ry="length"]', "input"); await p.waitForTimeout(300);
    const outside1 = region(await comp(1), 470, 20, 640, 90);
    check("☀ Light rays on the sun: rays reach past the picture's own box (the dark area beyond it brightens)", lum(outside1) > lum(outside0) + 3, { a: lum(outside0), b: lum(outside1) });

    /* 3. rays on the video layer + the compile */
    await p.evaluate(() => TlCanvas.select(tl.vlayers[0].clips[0], TlCanvas.layerOf(tl.vlayers[0].clips[0]))); await p.waitForTimeout(300);
    await p.click("#tlpRyOn"); await p.waitForTimeout(300);
    const needs = await p.evaluate(() => TlVBake.needs(tl.vlayers[0].clips[0]));
    check("☀ on a video layer: it now needs the page bake", needs === true);
    const snapAt = async (t) => { await goT(t); await p.waitForTimeout(900); await goT(t); await p.waitForTimeout(400); return Buffer.from((await p.evaluate(() => TlCanvas.snapshot())).split(",")[1], "base64"); };
    fs.writeFileSync(path.join(pd, "temp_pt_1.png"), await snapAt(1)); fs.writeFileSync(path.join(pd, "temp_pt_2.png"), await snapAt(2));
    const resp = p.waitForResponse((r) => /\/api\/export$/.test(r.url()), { timeout: 400000 });
    await p.click("#tlExport");
    const job = await (await resp).json();
    let stt = "", log = [];
    for (let i = 0; i < 400 && job.id; i++) { const d = await api("/api/jobs/" + job.id); stt = d.status; log = d.log || []; if (stt === "done" || stt === "failed") break; await new Promise((ok) => setTimeout(ok, 1000)); }
    const movie = path.join(pd, P + ".mp4");
    const baked = await p.evaluate(() => ({ imgs: tl.images.map((L) => !!L.clips[0].bake), vb: tl.vlayers[0].clips[0].vbake }));
    check("⚙ Compile: the particles + the sun baked, the video layer baked whole (seeked) and overlaid as its frames; the sound kept",
      stt === "done" && fs.existsSync(movie) && baked.imgs.every(Boolean) && /^tlb_.*_vb\.webm$/.test(baked.vb || "") && log.some((l) => /baked whole by the page/.test(l)), [stt, baked, log.slice(-6)]);
    if (stt === "done") {
      const W = 640, H = 360, c1 = rgbOf(path.join(pd, "temp_pt_1.png"), W, H), m1 = rgbOf(movie, W, H, 1), c2 = rgbOf(path.join(pd, "temp_pt_2.png"), W, H), m2 = rgbOf(movie, W, H, 2);
      const d1 = meanDiff(c1, m1), d2 = meanDiff(c2, m2);
      const reg = (A, B, x0, y0, x1, y1) => { let d = 0, n = 0; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = (y * W + x) * 3; for (let k = 0; k < 3; k++) { d += Math.abs(A[i + k] - B[i + k]); n++; } } return d / n; };
      const aud = execFileSync("ffprobe", ["-v", "error", "-select_streams", "a", "-show_entries", "stream=codec_type", "-of", "csv=p=0", movie], { encoding: "utf8" }).trim();
      check("COMPILE = CANVAS at 1 s and 2 s (particles, a sun with rays, a video with rays): mean difference under 7; the movie has sound", d1 < 7 && d2 < 7 && /audio/.test(aud), [Math.round(d1 * 100) / 100, Math.round(d2 * 100) / 100, aud]);
      check("…the baked video's own area under 12 at 2 s", reg(c2, m2, 30, 50, 280, 200) < 12, Math.round(reg(c2, m2, 30, 50, 280, 200) * 100) / 100);
    }
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
