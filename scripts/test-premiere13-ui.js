#!/usr/bin/env node
/* bitGen Studio — 2.418.0 in a REAL browser against the REAL app: ⚡ REAL-TIME PLAYBACK - the render bar under the
 * ruler (a heavy stretch red, a dropped-frame stretch red), ⚡ Render -> every stretch green, playing over it draws the
 * rendered preview, an edit turns only its own stretch red again, the ⏱ meter and the playback resolution (½).
 * Tim: "continue with the next part please the gap is getting smaller - soon bitgen should be superior".
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
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.418 browser test did not run"); console.log("\nRESULT: 0 failed"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const ROOT = path.join(__dirname, "..");
const P = "zz_prem13ui_" + process.pid;
let pass = 0, fail = 0;
const check = (n, cond, got) => {
  if (cond) { pass++; console.log("PASS: " + n); }
  else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); }
};
const api = async (u, body) => (await fetch(URL_ + u.replace(/^\//, ""), body === undefined ? {} :
  { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();
const T = fs.mkdtempSync(path.join(os.tmpdir(), "prem13ui_"));
const ff = (a) => execFileSync("ffmpeg", ["-y", "-loglevel", "error"].concat(a), { stdio: "ignore" });
const VP9 = ["-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "34", "-deadline", "realtime", "-cpu-used", "8"];
ff(["-f", "lavfi", "-i", "testsrc2=s=320x180:r=25:d=4", "-f", "lavfi", "-i", "sine=f=440:d=4", "-t", "4"].concat(VP9, ["-c:a", "libopus", path.join(T, "uisrc.webm")]));
const HEAVY = { grade: { exposure: 1 }, vfx: { blur: 3, glow: 0.4, vignette: 0.5 }, mask: { shape: "ellipse", x: 0.5, y: 0.5, w: 0.5, h: 0.5, feather: 0.05 } };

(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"] });
  const p = await b.newPage({ viewport: { width: 2400, height: 1350 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
  p.on("dialog", (d) => { d.accept().catch(() => {}); });
  const ev = (f, a) => p.evaluate(f, a);
  try {
    await api("/api/projects/new", { name: P });
    await api("/api/projects/load", { name: P });
    { const fd = new FormData(); fd.append("file", new Blob([fs.readFileSync(path.join(T, "uisrc.webm"))]), "uisrc.webm"); await fetch(URL_ + "api/passets", { method: "POST", body: fd }); }
    const booted = Promise.all([
      p.waitForResponse((r) => /\/api\/ui\/layout(\?|$)/.test(r.url()), { timeout: 60000 }).catch(() => null),
      p.waitForResponse((r) => /\/api\/dockers(\?|$)/.test(r.url()) && r.request().method() === "GET", { timeout: 60000 }).catch(() => null),
    ]);
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await booted;
    await p.waitForFunction(() => window.TlRender && window.H3TlRender && document.getElementById("tlRenderBtn") && document.getElementById("tlCFps") && document.getElementById("tlCRes"), null, { timeout: 60000 });
    await p.waitForTimeout(800);
    await ev((HEAVY) => {
      const d = document.getElementById("timelinedock");
      if (/collapsed|dockgone/.test(d.className) && typeof toggleCollapse === "function") toggleCollapse("timelinedock");
      setVar("th", 900);
      if (document.getElementById("tlStage").classList.contains("off")) document.getElementById("tlStageTog").click();
      document.documentElement.style.setProperty("--tlsh", "420px");
      tl.video = [{ name: "uisrc.webm", src: "video", in: 0, out: 2, dur: 4, start: 0, opacity: 1 },
                  { name: "uisrc.webm", src: "video", in: 2, out: 4, dur: 4, start: 2, opacity: 1, fx: HEAVY }];
      tl.vlayers = []; tl.images = []; tl.audio = []; tl.sel = null; tl.selLayer = "v1"; delete tl.previewRender; delete tl.playRes;
      PXS = 60; tlSave(); renderTimeline(); if (window.TlFloat) TlFloat.show(false); TlCanvas.go(0.5);
    }, HEAVY);
    await p.waitForTimeout(600);

    /* ---- 1. the render bar */
    const bar = await ev(() => [...document.querySelectorAll(".tlruler .tlrbar")].map((x) => [x.className.replace("tlrbar ", ""), +x.dataset.a, +x.dataset.b]));
    check("the render bar: the graded + blurred + glowing + vignetted + masked stretch (2 - 4 s) RED, the plain one (0 - 2 s) no bar", bar.length === 1 && bar[0][0] === "red" && bar[0][1] === 2 && bar[0][2] === 4, bar);
    await ev(() => { TlRender.resetMeter(); TlRender.note(0.5, 500); });
    await p.waitForTimeout(700);
    const dr = await ev(() => ({ m: TlRender.meter(), txt: document.getElementById("tlCFps").textContent, l: TlRender.list().map((s) => [s.a, s.level, s.why.includes("dropped frames")]),
      bars: [...document.querySelectorAll(".tlruler .tlrbar")].map((x) => [x.className.replace("tlrbar ", ""), +x.dataset.a]) }));
    check("⏱ a frame drawn late (500 ms) while playing over 0 - 2 s: counted (⏱ 1), that stretch marked red too (dropped frames)",
      dr.m.late === 1 && /⏱ 1/.test(dr.txt) && dr.l[0][1] === "red" && dr.l[0][2] && dr.bars.some((x) => x[0] === "red" && x[1] === 0), dr);

    /* ---- 2. ⚡ Render */
    await p.click("#tlRenderBtn");
    await p.waitForFunction(() => tl.previewRender && document.querySelectorAll(".tlruler .tlrbar.green").length === 2, null, { timeout: 180000 }).catch(() => {});
    const rd = await ev(() => ({ pr: tl.previewRender, bars: [...document.querySelectorAll(".tlruler .tlrbar")].map((x) => [x.className.replace("tlrbar ", ""), +x.dataset.a, +x.dataset.b]) }));
    check("⚡ Render: the timeline compiled as a preview (cache/preview), every stretch GREEN", rd.pr && /^\/api\/tlrender\/file\/[0-9a-f]{16}\.mp4$/.test(rd.pr.url) && rd.bars.length === 2 && rd.bars.every((x) => x[0] === "green")
      && fs.existsSync(path.join(ROOT, "projects", P, "cache", "preview", rd.pr.id + ".mp4")), rd);
    await ev(() => { TlCanvas.go(2.4); TlCanvas.play(); });
    await p.waitForTimeout(1500);
    const pl = await ev(() => { const v = TlRender.frame(TlCanvas.state.t), h264 = document.createElement("video").canPlayType('video/mp4; codecs="avc1.42E01E"');
      return { v: !!v, src: v ? v.currentSrc || v.src : "", vt: v ? v.currentTime : -1, t: TlCanvas.state.t, cov: TlRender.covers(TlCanvas.state.t), h264: h264 }; });
    await ev(() => TlCanvas.pause());
    // the preview is the compile's H.264 .mp4 - the app's Chromium (Electron) plays it; Playwright's Chromium has no
    // H.264, so there the canvas must fall back to drawing live (frame() null) - never a black frame
    check("...playing over it: the canvas draws the rendered preview in step with the playhead (no H.264 in this browser: it draws live instead)",
      pl.cov && (pl.h264 ? pl.v && /\/api\/tlrender\/file\//.test(pl.src) && Math.abs(pl.vt - pl.t) < 0.4 : !pl.v), pl);
    if (!pl.h264) {
      // ...and with the same preview as VP9 (this browser can decode that) the rendered path itself is seen working
      const f = path.join(ROOT, "projects", P, "cache", "preview", rd.pr.id + ".mp4"), tmp = path.join(T, "vp9.mp4");
      execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", f, "-an"].concat(VP9, [tmp])); fs.copyFileSync(tmp, f);
      await ev(() => { tl.previewRender.url = tl.previewRender.url.split("?")[0] + "?vp9"; TlCanvas.go(2.2); TlCanvas.play(); });
      await p.waitForTimeout(1500);
      let p2 = null;
      for (let k = 0; k < 8 && !(p2 && p2.v && p2.md <= 2); k++) { if (k) await p.waitForTimeout(150); p2 = await ev(() => { const v = TlRender.frame(TlCanvas.state.t), S = TlCanvas.state;
        const c = document.createElement("canvas"); c.width = 32; c.height = 18; const g = c.getContext("2d"); g.save(); g.scale(32 / S.W, 18 / S.H); TlCanvas.paintComp(g, S.t); g.restore();
        const d = g.getImageData(0, 0, 32, 18).data;
        const c2 = document.createElement("canvas"); c2.width = 32; c2.height = 18; const g2 = c2.getContext("2d"); if (v) g2.drawImage(v, 0, 0, 32, 18);
        const e = g2.getImageData(0, 0, 32, 18).data; let md = 0, sum = 0; for (let i = 0; i < d.length; i++) { if (i % 4 === 3) continue; md = Math.max(md, Math.abs(d[i] - e[i])); sum += d[i]; }
        return { v: !!v, vt: v ? v.currentTime : -1, t: S.t, md: md, mean: sum / (d.length * 0.75) }; }); }   // a frame mid-seek: look again
      await ev(() => TlCanvas.pause());
      check("...(as VP9) playing over the green stretch, the canvas's picture IS the preview file's frame, in step with the playhead",
        p2.v && Math.abs(p2.vt - p2.t) < 0.4 && p2.md <= 2 && p2.mean > 10, p2);
    }

    /* ---- 3. an edit turns only its stretch red */
    await ev(() => { tl.video[1].fx.grade.exposure = -1; tlSave(); renderTimeline(); });
    await p.waitForTimeout(600);
    const ed = await ev(() => [...document.querySelectorAll(".tlruler .tlrbar")].map((x) => [x.className.replace("tlrbar ", ""), +x.dataset.a]));
    check("an edit on the 2 - 4 s clip: that stretch red again, 0 - 2 s stays green", ed.length === 2 && ed.find((x) => x[1] === 0)[0] === "green" && ed.find((x) => x[1] === 2)[0] === "red", ed);

    /* ---- 4. the playback resolution */
    await p.selectOption("#tlCRes", "0.5");
    await ev(() => { TlCanvas.go(2.4); TlCanvas.play(); });
    await p.waitForTimeout(1000);
    let rs = null;
    for (let k = 0; k < 8 && !(rs && rs.mean > 10); k++) { if (k) await p.waitForTimeout(200); rs = await ev(() => { const S = TlCanvas.state, c = document.createElement("canvas"); c.width = 32; c.height = 18; const g = c.getContext("2d"); g.save(); g.scale(32 / S.W, 18 / S.H); TlCanvas.paintComp(g, S.t); g.restore();
      const d = g.getImageData(0, 0, 32, 18).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += d[i] + d[i + 1] + d[i + 2]; return { res: S.res, saved: tl.playRes, mean: s / (d.length / 4) / 3, live: !TlRender.frame(S.t) }; }); }   // a frame still decoding: look again
    await ev(() => TlCanvas.pause());
    check("Full / ½ / ¼: ½ kept on the timeline; the edited (now live) stretch still draws while playing at ½", rs.res === 0.5 && rs.saved === 0.5 && rs.live && rs.mean > 10, rs);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed " + String(e.stack || e).split("\n").slice(0, 3).join(" ")); if (process.env.SHOT) await p.screenshot({ path: process.env.SHOT }).catch(() => {}); }
  finally {
    try { await ev(() => { tl.video = []; tl.vlayers = []; tl.audio = []; tl.images = []; delete tl.previewRender; delete tl.playRes; tlSave(); }); } catch { /* closed */ }
    await b.close();
    try { await api("/api/projects/load", { name: "default" }); } catch { /* fine */ }
    try { fs.rmSync(path.join(ROOT, "projects", P), { recursive: true, force: true }); } catch { /* fine */ }
    try { fs.rmSync(T, { recursive: true, force: true }); } catch { /* fine */ }
    console.log(`\n${pass} passed, ${fail} failed`);
    console.log("RESULT: " + fail + " failed");
    process.exit(fail ? 1 : 0);
  }
})();
