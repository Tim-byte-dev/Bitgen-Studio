#!/usr/bin/env node
/* bitGen Studio — 2.513.0 in a REAL browser: 🎮 LOAD UE PROJECT, THE TIMELINE'S FRAME SIZE BAR, the hidden CAD buttons.
 * Tim (verbatim): "lets do steps 1,2,3 , 4,5,6 and 7" (step 1: particles, light rays, mesh warp, puppet pins)
 *   1. 🎮 in the menu bar: the folder dialog's Select (stubbed with a made-up project folder) puts the plugin in and
 *      switches the plugins on at once; the dialog lists the steps
 *   2. the timeline's menu bar: Preset / width / Aspect set the frame; the CAD toolbar checkbox; the ⌬ buttons hidden
 *   3. ⚙ Compile at 640 x 360 with a 320 x 240 V1: the movie is 640 x 360, V1 centred; COMPILE = CANVAS
 * Against the running app (H3_URL, default the e2e server on :8311), from the app folder (projects/e2e_ue513). No
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
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.513 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const ROOT = path.join(__dirname, "..");
const P = "e2e_ue513";
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
  const tmp = fs.mkdtempSync(path.join(require("os").tmpdir(), "ueui513-")), proj = path.join(tmp, "Shooter");
  fs.mkdirSync(proj); fs.writeFileSync(path.join(proj, "Shooter.uproject"), JSON.stringify({ FileVersion: 3, EngineAssociation: "5.8", Plugins: [] }, null, "\t"));
  try {
    await api("/api/projects/load", { name: P });
    const pd = path.join(ROOT, "projects", P);
    fs.mkdirSync(path.join(pd, "video"), { recursive: true }); fs.mkdirSync(path.join(pd, "images"), { recursive: true });
    ff(["-f", "lavfi", "-i", "testsrc2=s=320x240:r=24:d=3", "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "20", "-deadline", "realtime", "-an", path.join(pd, "video", "ue_base.webm")]);
    ff(["-f", "lavfi", "-i", "testsrc=s=100x60:r=1:d=1", "-frames:v", "1", path.join(pd, "images", "ue_pic.png")]);
    const booted = Promise.all([
      p.waitForResponse((r) => /\/api\/ui\/layout(\?|$)/.test(r.url()), { timeout: 60000 }).catch(() => null),
      p.waitForResponse((r) => /\/api\/dockers(\?|$)/.test(r.url()) && r.request().method() === "GET", { timeout: 60000 }).catch(() => null),
    ]);
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await booted;
    await p.waitForFunction(() => window.TlCanvas && window.TlSizeBar && window.H3UeProject && document.getElementById("projUe"), null, { timeout: 30000 });
    await p.waitForTimeout(800);

    /* 1. 🎮 Load UE project */
    await p.evaluate((dir) => { window.FileDialog = Object.assign({}, window.FileDialog || {}, { isLocalPage: () => true, open: (o) => { window.__fdOpt = o; return Promise.resolve({ path: dir }); } }); }, proj);
    const menu = await p.evaluate(() => [...document.querySelectorAll("#menubar .projbtns > button")].map((x) => x.id));
    await p.click("#projUe");
    await p.waitForFunction(() => /bitGen Bridge .* added/.test((document.getElementById("uepSteps") || {}).textContent || ""), null, { timeout: 30000 });
    const st = await p.evaluate(() => ({ steps: document.getElementById("uepSteps").textContent, info: document.getElementById("uepInfo").textContent, fd: window.__fdOpt }));
    const uj = JSON.parse(fs.readFileSync(path.join(proj, "Shooter.uproject"), "utf8"));
    check("🎮 in the menu bar (after 📦): the folder dialog (mode dir, Select) -> the plugin put into the project, the plugins switched on; the dialog lists the steps and the project",
      menu.includes("projUe") && st.fd.mode === "dir" && st.fd.okLabel === "Select" && fs.existsSync(path.join(proj, "Plugins", "bitGenBridge", "bitGenBridge.uplugin"))
      && uj.Plugins.filter((x) => x.Enabled).length === 5 && /switched on/.test(st.steps) && /Shooter/.test(st.info) && /✓ bitGenBridge/.test(st.info), { menu, st });
    await p.evaluate(() => document.getElementById("uepX").click());

    /* 2. the timeline's menu bar */
    await p.evaluate(() => {
      const d = document.getElementById("timelinedock");
      if (/collapsed|dockgone/.test(d.className) && typeof toggleCollapse === "function") toggleCollapse("timelinedock");
      setVar("th", 820);
      if (document.getElementById("tlStage").classList.contains("off")) document.getElementById("tlStageTog").click();
      tl.video = [{ name: "ue_base.webm", src: "video", start: 0, dur: 3, in: 0, out: 3, opacity: 1 }];
      tl.vlayers = []; tl.audio = []; delete tl.frame;
      tl.images = [mkLayer("Pic", [{ name: "ue_pic.png", start: 0, len: 3, opacity: 1, tf: { x: 200, y: -100, scale: 1, rot: 0 }, kf: [{ at: 0, x: 200 }, { at: 3, x: -200 }] }])];
      tlSave(); renderTimeline();
    });
    await p.waitForFunction(() => TlCanvas.state.W === 320, null, { timeout: 20000 });
    await p.waitForTimeout(1600);
    const auto = await p.evaluate(() => ({ pre: document.getElementById("tlFrPreset").value, w: document.getElementById("tlFrW").value, cad: [document.getElementById("tlCadBtn"), document.getElementById("pcCadBtn")].map((b) => b ? getComputedStyle(b).display : "missing") }));
    await p.selectOption("#tlFrPreset", "360"); await p.waitForTimeout(400);
    const s1 = await p.evaluate(() => ({ f: tl.frame, W: TlCanvas.state.W, H: TlCanvas.state.H, asp: document.getElementById("tlFrAspect").value }));
    await p.selectOption("#tlFrAspect", "1:1"); await p.waitForTimeout(300);
    const s2 = await p.evaluate(() => ({ f: tl.frame, W: TlCanvas.state.W, H: TlCanvas.state.H }));
    await p.selectOption("#tlFrAspect", "16:9"); await p.fill("#tlFrW", "800"); await p.dispatchEvent("#tlFrW", "change"); await p.waitForTimeout(300);
    const s3 = await p.evaluate(() => ({ f: tl.frame, pre: document.getElementById("tlFrPreset").value }));
    await p.selectOption("#tlFrPreset", "360"); await p.waitForTimeout(300);
    check("the timeline's menu bar: Auto = V1's 320 × 240 at first; Preset 640 × 360 -> the frame (16:9); Aspect 1:1 -> 640 × 640; 16:9 + width 800 -> 800 × 450 (Custom); the ⌬ CAD buttons hidden",
      auto.pre === "auto" && auto.w === "320" && auto.cad.every((d) => d === "none") && s1.W === 640 && s1.H === 360 && s1.asp === "16:9" && s2.W === 640 && s2.H === 640 && s3.f.w === 800 && s3.f.h === 450 && s3.pre === "", { auto, s1, s2, s3 });
    await p.click("#tlFrCad"); await p.waitForTimeout(200);
    const cadOn = await p.evaluate(() => getComputedStyle(document.getElementById("tlCadBar")).display);
    await p.click("#tlFrCad"); await p.waitForTimeout(200);
    const cadOff = await p.evaluate(() => getComputedStyle(document.getElementById("tlCadBar")).display);
    check("☐ CAD toolbar in the menu bar shows / hides the CAD toolbar over the preview", cadOn !== "none" && cadOff === "none", [cadOn, cadOff]);

    /* 3. the compile at 640 x 360 */
    const goT = (t) => p.evaluate((t) => { setPlayhead(t); TlCanvas.state.t = t; TlCanvas.draw(); TlCanvas.paintLayers(); }, t);
    const snapAt = async (t) => { await goT(t); await p.waitForTimeout(900); await goT(t); await p.waitForTimeout(400); return Buffer.from((await p.evaluate(() => TlCanvas.snapshot())).split(",")[1], "base64"); };
    fs.writeFileSync(path.join(pd, "temp_ue_1.png"), await snapAt(1)); fs.writeFileSync(path.join(pd, "temp_ue_2.png"), await snapAt(2));
    const resp = p.waitForResponse((r) => /\/api\/export$/.test(r.url()), { timeout: 400000 });
    await p.click("#tlExport");
    const job = await (await resp).json();
    let stt = "", log = [];
    for (let i = 0; i < 400 && job.id; i++) { const d = await api("/api/jobs/" + job.id); stt = d.status; log = d.log || []; if (stt === "done" || stt === "failed") break; await new Promise((ok) => setTimeout(ok, 1000)); }
    const movie = path.join(pd, P + ".mp4");
    const dims = stt === "done" ? execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0:s=x", movie], { encoding: "utf8" }).trim() : "";
    check("⚙ Compile: the movie is 640 × 360 (V1 fitted in - the log says so)", stt === "done" && dims === "640x360" && log.some((l) => /frame 640x360: V1 \(320x240\) fitted in/.test(l)), [stt, dims, log.slice(-5)]);
    if (stt === "done") {
      const W = 640, H = 360, c1 = rgbOf(path.join(pd, "temp_ue_1.png"), W, H), m1 = rgbOf(movie, W, H, 1), c2 = rgbOf(path.join(pd, "temp_ue_2.png"), W, H), m2 = rgbOf(movie, W, H, 2);
      const d1 = meanDiff(c1, m1), d2 = meanDiff(c2, m2), side = meanDiff(Array.from(c1).filter((_, i) => (i / 3 | 0) % W < 70), Array.from(m1).filter((_, i) => (i / 3 | 0) % W < 70));
      check("COMPILE = CANVAS at 1 s and 2 s in the 640 × 360 frame (V1 centred with black at the sides, a moving picture): mean difference under 7", d1 < 7 && d2 < 7 && side < 3, [Math.round(d1 * 100) / 100, Math.round(d2 * 100) / 100, Math.round(side * 100) / 100]);
    }
    check("no page errors", errs.length === 0, errs);
  } catch (e) {
    check("the browser run finished", false, String(e && e.stack || e).slice(0, 700));
  } finally {
    try { await p.evaluate(() => { tl.video = []; tl.vlayers = []; tl.images = []; tl.audio = []; delete tl.frame; tlSave(); renderTimeline(); }); } catch { /* closed */ }
    await b.close();
    try { await api("/api/projects/load", { name: "default" }); } catch { /* best effort */ }
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
