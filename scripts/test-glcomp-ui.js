#!/usr/bin/env node
/* bitGen Studio — 2.420.0 in a REAL browser: THE GPU COMPOSITOR - while playing the canvas's frame is put
 * together by static/glcomp.js (S.lastGL), and it matches the 2D reference path frame for frame: a graded V1 (graded in
 * the compositor's draw), a layer moved / scaled / turned at 70 % opacity, a layer with a blur (its own look pass), a
 * text picture; a layer's wipe drawing now and an adjustment layer go the 2D way; GPU off = 2D.
 * Run against the running app (H3_URL, default :8311). No Playwright = SKIP (exit 0). */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execSync, execFileSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the GPU compositor browser test did not run"); console.log("\nRESULT: 0 failed"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const ROOT = path.join(__dirname, "..");
const P = "zz_glui_" + process.pid;
let pass = 0, fail = 0;
const check = (n, cond, got) => {
  if (cond) { pass++; console.log("PASS: " + n); }
  else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); }
};
const api = async (u, body) => (await fetch(URL_ + u.replace(/^\//, ""), body === undefined ? {} :
  { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();
const T = fs.mkdtempSync(path.join(os.tmpdir(), "glui_"));
const ff = (a) => execFileSync("ffmpeg", ["-y", "-loglevel", "error"].concat(a), { stdio: "ignore" });
const VP9 = ["-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "20", "-deadline", "realtime", "-cpu-used", "8"];
ff(["-f", "lavfi", "-i", "testsrc2=s=320x180:r=24:d=4"].concat(VP9, [path.join(T, "glv1.webm")]));
ff(["-f", "lavfi", "-i", "smptebars=s=320x180:r=24:d=4"].concat(VP9, [path.join(T, "glv2.webm")]));

(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const p = await b.newPage({ viewport: { width: 2000, height: 1200 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
  p.on("dialog", (d) => { d.accept().catch(() => {}); });
  const ev = (f, a) => p.evaluate(f, a);
  try {
    await api("/api/projects/new", { name: P });
    await api("/api/projects/load", { name: P });
    for (const f of ["glv1.webm", "glv2.webm"]) { const fd = new FormData(); fd.append("file", new Blob([fs.readFileSync(path.join(T, f))]), f); await fetch(URL_ + "api/passets", { method: "POST", body: fd }); }
    const booted = Promise.all([
      p.waitForResponse((r) => /\/api\/ui\/layout(\?|$)/.test(r.url()), { timeout: 60000 }).catch(() => null),
      p.waitForResponse((r) => /\/api\/dockers(\?|$)/.test(r.url()) && r.request().method() === "GET", { timeout: 60000 }).catch(() => null),
    ]);
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await booted;
    await p.waitForFunction(() => window.H3GLComp && window.TlCanvas && document.getElementById("tlCGpu"), null, { timeout: 60000 });
    await p.waitForTimeout(800);
    await ev(() => {
      const d = document.getElementById("timelinedock");
      if (/collapsed|dockgone/.test(d.className) && typeof toggleCollapse === "function") toggleCollapse("timelinedock");
      if (document.getElementById("tlStage").classList.contains("off")) document.getElementById("tlStageTog").click();
      tl.video = [{ name: "glv1.webm", src: "video", in: 0, out: 4, dur: 4, start: 0, opacity: 1, fx: { grade: { exposure: 0.6, saturation: 1.4, contrast: 1.2 } } }];
      tl.vlayers = [mkLayer("V2", [{ name: "glv2.webm", src: "video", in: 0, out: 4, dur: 4, start: 0, opacity: 1, tf: { x: 60, y: -20, scale: 0.4, rot: 15 } }]),
                    mkLayer("V3", [{ name: "glv2.webm", src: "video", in: 0, out: 4, dur: 4, start: 0, opacity: 1, tf: { x: -90, y: 40, scale: 0.3, rot: 0 }, fx: { vfx: { blur: 6 } } }])];
      tl.vlayers[0].opacity = 0.7;
      tl.images = []; tl.audio = []; delete tl.glComp;
      tlSave(); renderTimeline(); TlCanvas.go(1.25);
    });
    await p.waitForTimeout(1500);
    // the same moment both ways: the compositor (as while playing) and the 2D reference
    const both = () => ev(() => {
      const S = TlCanvas.state, W = 160, H = 90;
      const grab = (playing) => { const c = document.createElement("canvas"); c.width = W; c.height = H; const g = c.getContext("2d"); const was = S.playing; S.playing = playing;
        g.save(); g.scale(W / S.W, H / S.H); TlCanvas.paintComp(g, S.t); g.restore(); const gl = S.lastGL; S.playing = was; return { d: g.getImageData(0, 0, W, H).data, gl: gl }; };
      const a = grab(true), b2 = grab(false);
      let sum = 0, mx = 0, n = 0, lum = 0;
      for (let i = 0; i < a.d.length; i += 4) for (let k = 0; k < 3; k++) { const e = Math.abs(a.d[i + k] - b2.d[i + k]); sum += e; mx = Math.max(mx, e); n++; lum += a.d[i + k]; }
      return { gl: a.gl, ref: b2.gl, mean: +(sum / n).toFixed(2), max: mx, lum: +(lum / n).toFixed(1) };
    });
    const r1 = await both();
    check("while playing the frame is the GPU compositor's (graded V1, a turned 70 % layer, a blurred layer) - and it matches the 2D reference (mean difference under 2 levels)",
      r1.gl === true && r1.ref === false && r1.mean < 2 && r1.lum > 20, r1);
    // a layer transition drawing now: the 2D way
    await ev(() => { tl.vlayers[0].transitionIn = { type: "wipeleft", dur: 2 }; tlSave(); TlCanvas.go(0.6); });
    await p.waitForTimeout(800);
    const r2 = await both();
    check("a layer's wipe drawing now -> that frame goes the 2D way (no difference)", r2.gl === false && r2.mean === 0, r2);
    await ev(() => { tl.vlayers[0].transitionIn = { type: "none", dur: 0.5 }; tl.images = [mkLayer("Adj", [{ name: "adjust.png", adjust: true, start: 0, len: 4, fx: { grade: { exposure: -1 } } }])]; tlSave(); TlCanvas.go(1.25); });
    await p.waitForTimeout(800);
    const r3 = await both();
    check("an adjustment layer -> the 2D way", r3.gl === false, r3);
    await ev(() => { tl.images = []; document.getElementById("tlCGpu").click(); });
    const r4 = await both();
    const off = await ev(() => tl.glComp);
    check("GPU switched off (beside ⏱) -> the 2D way while playing too", off === false && r4.gl === false, { off, r4 });
    await ev(() => document.getElementById("tlCGpu").click());
    const r5 = await both();
    check("...on again -> the compositor", r5.gl === true, r5);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed " + String(e.stack || e).split("\n").slice(0, 3).join(" ")); if (process.env.SHOT) await p.screenshot({ path: process.env.SHOT }).catch(() => {}); }
  finally {
    try { await ev(() => { tl.video = []; tl.vlayers = []; tl.audio = []; tl.images = []; delete tl.glComp; tlSave(); }); } catch { /* closed */ }
    await b.close();
    try { await api("/api/projects/load", { name: "default" }); } catch { /* fine */ }
    try { fs.rmSync(path.join(ROOT, "projects", P), { recursive: true, force: true }); } catch { /* fine */ }
    try { fs.rmSync(T, { recursive: true, force: true }); } catch { /* fine */ }
    console.log(`\n${pass} passed, ${fail} failed`);
    console.log("RESULT: " + fail + " failed");
    process.exit(fail ? 1 : 0);
  }
})();
