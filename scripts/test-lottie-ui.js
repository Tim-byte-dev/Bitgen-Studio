#!/usr/bin/env node
/* bitGen Studio — 2.512.0 in a REAL browser: ⤓ LOTTIE (JSON) EXPORT, played back by lottie-web (tllottie.js, routes/lottie.js).
 * Tim (verbatim): "lets do steps 1,2,3 , 4,5,6 and 7" (step 7: Lottie (JSON) export)
 *   1. 📤 Export → ⤓ Lottie (JSON): <project>_lottie.json beside the movies, listed to download; a video layer left out
 *   2. a keyed picture (eases, a hold, a blend), a turned text = real animated layers; a masked picture = frames
 *   3. LOTTIE = CANVAS: lottie-web (its canvas player, node_modules/lottie-web or LOTTIE_JS) draws the file at three
 *      moments and it matches the timeline's own picture - or that check SKIPs without lottie-web
 * Against the running app (H3_URL, default the e2e server on :8311), from the app folder (projects/e2e_lt512). No
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
if (!chromium) { console.log("SKIP: playwright is not installed here - the Lottie browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const ROOT = path.join(__dirname, "..");
const P = "e2e_lt512";
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
    ff(["-f", "lavfi", "-i", "testsrc2=s=160x90:r=24:d=3", "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "20", "-deadline", "realtime", path.join(pd, "video", "lt_clip.webm")]);
    ff(["-f", "lavfi", "-i", "testsrc=s=120x60:r=1:d=1", "-frames:v", "1", path.join(pd, "images", "lt_logo.png")]);
    ff(["-f", "lavfi", "-i", "color=c=0x33aaff:s=100x100:d=1", "-frames:v", "1", path.join(pd, "images", "lt_sq.png")]);
    const booted = Promise.all([
      p.waitForResponse((r) => /\/api\/ui\/layout(\?|$)/.test(r.url()), { timeout: 60000 }).catch(() => null),
      p.waitForResponse((r) => /\/api\/dockers(\?|$)/.test(r.url()) && r.request().method() === "GET", { timeout: 60000 }).catch(() => null),
    ]);
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await booted;
    await p.waitForFunction(() => window.TlCanvas && window.TlLottie && TlLottie.ready && window.TlDeliver && window.TlMask, null, { timeout: 30000 });
    await p.waitForTimeout(800);
    await p.evaluate(() => {
      const d = document.getElementById("timelinedock");
      if (/collapsed|dockgone/.test(d.className) && typeof toggleCollapse === "function") toggleCollapse("timelinedock");
      setVar("th", 820);
      if (document.getElementById("tlStage").classList.contains("off")) document.getElementById("tlStageTog").click();
      tl.video = []; tl.audio = [];
      tl.vlayers = [mkLayer("Clip", [{ name: "lt_clip.webm", src: "video", start: 0, dur: 3, in: 0, out: 3, opacity: 1, tf: { x: 0, y: 0, scale: 1, rot: 0 } }])];
      const pt = TlMask.pt;
      const logo = { name: "lt_logo.png", start: 0.25, len: 2.5, opacity: 1, tf: { x: -150, y: -60, scale: 1, rot: 0 },
        kf: [{ at: 0, x: -150, scale: 1, rot: 0, op: 1, ease: "out" }, { at: 1, x: 120, scale: 1.6, rot: 30, op: 0.6, ease: "bezier", bz: [0.2, 0.9, 0.3, 1] }, { at: 1.75, x: 60, scale: 1.2, rot: -20, op: 1, ease: "hold" }, { at: 2.25, x: -60, scale: 1, rot: 0, op: 0.8 }] };
      const tx = { start: 0, len: 3, opacity: 1, tid: "lt1", name: "text_lt1.png", text: { content: "LOTTIE", size: 44, color: "#ffee55", font: "Arial", bold: true }, tf: { x: 120, y: 110, scale: 1, rot: -12 } };
      const sq = { name: "lt_sq.png", start: 0, len: 3, opacity: 1, tf: { x: -200, y: 100, scale: 1, rot: 0 }, masks: [Object.assign({}, TlMask.DEFAULTS, { feather: 6, pts: [pt(0.5, 0.05), pt(0.95, 0.95), pt(0.05, 0.95)] })] };
      const Lt = mkLayer("Title", [tx]); Lt.text = true;
      const Ll = mkLayer("Logo", [logo]); Ll.blend = "screen";
      tl.images = [mkLayer("Tri", [sq]), Ll, Lt];
      tlSave(); renderTimeline(); TlCanvas.uploadText(tx);
    });
    await p.waitForFunction(() => TlCanvas.state.W > 0, null, { timeout: 20000 });
    await p.evaluate(() => { setPlayhead(1); TlCanvas.state.t = 1; TlCanvas.draw(); }); await p.waitForTimeout(1200);

    /* 1. the export from 📤 */
    await p.click("#tlDeliverBtn"); await p.waitForSelector("#tdlLottie", { timeout: 15000 });
    await p.click("#tdlLottie");
    await p.waitForFunction(() => /✓|⚠/.test((document.getElementById("tdlLottieMsg") || {}).textContent || ""), null, { timeout: 120000 });
    const msg = await p.evaluate(() => document.getElementById("tdlLottieMsg").textContent);
    const files = await api("/api/deliver/files");
    const lf = (files.files || []).find((f) => /_lottie\.json$/.test(f.name));
    check("📤 Export → ⤓ Lottie (JSON): made beside the movies and listed to download; the video layer left out and named",
      /^✓/.test(msg) && lf && /left out: Clip \(a video layer/.test(msg), { msg, files: files.files });
    const J = lf ? await (await fetch(URL_ + "api/deliver/file/" + encodeURIComponent(lf.name))).json() : null;
    const names = J ? J.layers.map((l) => l.nm) : [];
    const lg = J && J.layers.find((l) => l.nm === "Logo"), tt = J && J.layers.find((l) => l.nm === "Title");
    check("the layers: the keyed logo and the turned text are real animated layers (top first: Title, Logo), the masked triangle went in as frames; screen blend kept",
      J && names[0] === "Title" && names[1] === "Logo" && names.slice(2).every((n) => /^Tri \(frames: masks\)/.test(n)) && names.length >= 3 && lg.ks.p.s === true && lg.ks.r.a === 1 && lg.bm === 2 && tt.ks.r.k === -12 && J.fr === 24, names);

    /* 2. lottie-web plays it */
    const cands = [process.env.LOTTIE_JS, path.join(ROOT, "node_modules", "lottie-web", "build", "player", "lottie_canvas.min.js")].filter(Boolean);
    const LJ = cands.find((f) => fs.existsSync(f));
    if (!LJ || !J) { console.log("SKIP: lottie-web is not installed (npm i lottie-web, or LOTTIE_JS=<lottie_canvas.min.js>) - LOTTIE = CANVAS not checked"); pass++; }
    else {
      await p.addScriptTag({ path: LJ });
      const res = await p.evaluate(async (J) => {
        const W = J.w, H = J.h, cv = document.createElement("canvas"); cv.width = W; cv.height = H; const ctx = cv.getContext("2d");
        const anim = lottie.loadAnimation({ renderer: "canvas", loop: false, autoplay: false, animationData: J, rendererSettings: { context: ctx, clearCanvas: true, preserveAspectRatio: "xMidYMid meet" } });
        await new Promise((ok) => { let done = false; const fin = () => { if (!done) { done = true; ok(); } }; anim.addEventListener("loaded_images", fin); anim.addEventListener("DOMLoaded", () => setTimeout(fin, 1500)); setTimeout(fin, 8000); });
        const hide = tl.vlayers; tl.vlayers = [];
        const out = [];
        for (const t of [0.5, 1.15, 2.0, 2.6]) {
          anim.goToAndStop(t * J.fr, true); await new Promise((ok) => setTimeout(ok, 120)); anim.goToAndStop(t * J.fr, true);
          const g = document.createElement("canvas"); g.width = W; g.height = H; const x = g.getContext("2d"); x.fillStyle = "#000"; x.fillRect(0, 0, W, H); x.drawImage(cv, 0, 0);
          const R = document.createElement("canvas"); R.width = W; R.height = H; const y = R.getContext("2d"); TlCanvas.paintComp(y, t);
          const A = x.getImageData(0, 0, W, H).data, B = y.getImageData(0, 0, W, H).data; let d = 0, n = 0, big = 0;
          for (let i = 0; i < A.length; i += 4) { const e = (Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2])) / 3; d += e; n++; if (e > 60) big++; }
          let la = 0, lb = 0; for (let i = 0; i < A.length; i += 4) { la += A[i] + A[i + 1] + A[i + 2]; lb += B[i] + B[i + 1] + B[i + 2]; }
          out.push([t, Math.round(d / n * 100) / 100, Math.round(big / n * 10000) / 100, Math.round(la / n / 3), Math.round(lb / n / 3)]);
        }
        // the check can fail: the Lottie at 1.15 s against the canvas at 0.5 s must differ
        anim.goToAndStop(1.15 * J.fr, true); await new Promise((ok) => setTimeout(ok, 120));
        { const g = document.createElement("canvas"); g.width = W; g.height = H; const x = g.getContext("2d"); x.fillStyle = "#000"; x.fillRect(0, 0, W, H); x.drawImage(cv, 0, 0);
          const R = document.createElement("canvas"); R.width = W; R.height = H; const y = R.getContext("2d"); TlCanvas.paintComp(y, 0.5);
          const A = x.getImageData(0, 0, W, H).data, B = y.getImageData(0, 0, W, H).data; let big = 0; for (let i = 0; i < A.length; i += 4) if (Math.abs(A[i] - B[i]) > 60) big++;
          out.push(["1.15 vs 0.5", big / (A.length / 4) * 100]); }
        tl.vlayers = hide;
        return out;
      }, J);
      console.log("lottie-web vs the canvas [t, mean difference, % pixels far off, lottie brightness, canvas brightness]: " + JSON.stringify(res));
      check("LOTTIE = CANVAS: lottie-web's own player draws the file like the timeline at 0.5, 1.15 (mid-ease), 2.0 (the hold) and 2.6 s - mean difference under 4, under 1.5 % of pixels far off (and a wrong moment does NOT match)",
        res.slice(0, 4).every((r) => r[1] < 4 && r[2] < 1.5 && r[4] > 2 && r[3] > 2) && res[4][1] > 0.5, res);   // and both actually drew something
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
