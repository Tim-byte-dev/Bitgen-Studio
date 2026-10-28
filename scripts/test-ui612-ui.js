#!/usr/bin/env node
/* bitGen Studio — 2.612.0 in a REAL browser: a CUT clip stays ONE clip; "✂ to new layer" puts the after-cut part on a new layer.
 * Tim: "when clips are cut the remaining portion is being put next to the part before the cut as a separate clip, it is
 * leaving a black frame that can't be edited - can we merge the before cut and after cut portion of the layer so it is 1
 * continuous clip - add a checkbox to the timeline to cut to new layer - then put the after cut portion on a new layer".
 *   ✂ Cut (ripple) through a video: ONE clip, a new file <name>-join1.webm (red | GREEN from 1.5 s | blue | yellow - the cut
 *   second gone, frame-exact), one ↶ back; a picture: one longer clip; Del on frames (▯) joins too; a retimed clip and ripple
 *   off stay two (said why); the checkbox (kept after a reload): the after-cut part on a new layer right above - a video
 *   layer's, V1's (the first video layer), Ctrl+K split's; one ↶.
 * Against the running app (H3_URL, default the e2e server on :8311). No Playwright = SKIP. */
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
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.612.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const P = "zz_join_" + process.pid;
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const api = async (u, body) => (await fetch(URL_ + u.replace(/^\//, ""), body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();
const T = fs.mkdtempSync(path.join(os.tmpdir(), "joinui_"));
const ff = (a) => execFileSync("ffmpeg", ["-y", "-loglevel", "error"].concat(a), { stdio: "ignore" });
// four seconds: red | green | blue | yellow
ff(["-f", "lavfi", "-i", "color=c=red:s=160x90:r=24:d=1", "-f", "lavfi", "-i", "color=c=lime:s=160x90:r=24:d=1", "-f", "lavfi", "-i", "color=c=blue:s=160x90:r=24:d=1", "-f", "lavfi", "-i", "color=c=yellow:s=160x90:r=24:d=1",
  "-filter_complex", "[0:v][1:v][2:v][3:v]concat=n=4:v=1:a=0[v]", "-map", "[v]", "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "30", "-deadline", "realtime", path.join(T, "cols.webm")]);
ff(["-f", "lavfi", "-i", "color=c=white:s=64x64", "-frames:v", "1", path.join(T, "pic.png")]);

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 2200, height: 1300 } });
  const errs = []; p.on("pageerror", (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
  p.on("dialog", (d) => { d.accept().catch(() => {}); });
  const ev = (f, a) => p.evaluate(f, a);
  try {
    await api("/api/projects/new", { name: P });
    await api("/api/projects/load", { name: P });
    for (const f of ["cols.webm", "pic.png"]) { const fd = new FormData(); fd.append("file", new Blob([fs.readFileSync(path.join(T, f))]), f); await fetch(URL_ + "api/passets", { method: "POST", body: fd }); }
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.TlJoin && window.TlFrame && document.getElementById("tlCutNew") && window.applySel && applySel._tljoin, null, { timeout: 60000 });
    await p.waitForTimeout(600);
    const reset = (extra) => ev((x) => {
      const d = document.getElementById("timelinedock");
      if (/collapsed|dockgone/.test(d.className) && typeof toggleCollapse === "function") toggleCollapse("timelinedock");
      tl.video = [{ name: "cols.webm", src: "video", in: 0, out: 4, dur: 4, start: 0, opacity: 1 }];
      tl.vlayers = [mkLayer("Shots", [{ name: "cols.webm", src: "video", in: 0, out: 4, dur: 4, start: 0, opacity: 1 }])];
      tl.images = [mkLayer("Pics", [{ name: "pic.png", start: 0, len: 4, opacity: 1 }])]; tl.audio = [];
      tl.sel = null; tlSave(); renderTimeline();
      document.getElementById("tlRipple").checked = x.ripple !== false;
      const n = document.getElementById("tlCutNew"); if (n.checked !== !!x.toNew) n.click();
      if (document.getElementById("tlScope")) document.getElementById("tlScope").value = "layer";
    }, extra || {}).then(() => p.waitForTimeout(500));      // a save 400 ms later is a step of its own (↶ below)
    const cut = (lk, a, b2) => ev(([lk, a, b2]) => { tl.sel = { a, b: b2, layer: true }; tl.selLayer = lk; tlSave(); renderTimeline(); document.getElementById("tlCutSel").click(); }, [lk, a, b2]);
    const S = () => ev(() => ({ v1: tl.video.map((c) => [c.name, c.start, c.in, c.out]), vl: tl.vlayers.map((L) => [L.name, L.clips.map((c) => [c.name, c.start, c.in, c.out])]), img: tl.images.map((L) => [L.name, L.clips.map((c) => [c.start, c.len])]), log: (document.getElementById("sblog") || {}).textContent || "" }));

    /* the box */
    const bx = await ev(() => { const l = document.getElementById("tlCutNewL"), sel = document.getElementById("tlSelGrp"); return { txt: l.textContent.trim(), before: l.nextElementSibling === sel || (l.nextElementSibling.id === "tlRangeGrp" && l.nextElementSibling.nextElementSibling === sel),   /* 2.613.0: the ▼ ranges group between */ title: l.title }; });
    check("the \"✂ to new layer\" box is in the timeline's menu bar (beside the selection tools, always there)", bx.txt === "✂ to new layer" && bx.before && /new layer right above/.test(bx.title), bx);

    /* ✂ Cut through a video = one clip, a joined file */
    await reset({});
    await cut("vl:0", 1, 2);
    await p.waitForFunction(() => tl.vlayers[0].clips.length === 1 && /-join1\.webm$/.test(tl.vlayers[0].clips[0].name), null, { timeout: 60000 });
    let s = await S();
    check("✂ Cut 1 – 2 s of a video layer's clip (ripple): ONE continuous clip again - a new file cols-join1.webm, 0 – 3 s, the status line says so",
      JSON.stringify(s.vl[0][1]) === JSON.stringify([["cols-join1.webm", 0, 0, 3]]) && /one continuous clip/.test(s.log) && /Video assets/.test(s.log), s);
    const px = await ev(async () => {
      const v = document.createElement("video"); v.muted = true; v.src = "/passets/video/cols-join1.webm"; v.preload = "auto";
      await new Promise((ok, no) => { v.onloadeddata = ok; v.onerror = () => no(new Error("no load")); setTimeout(ok, 8000); });
      const c = document.createElement("canvas"); c.width = 16; c.height = 9; const g = c.getContext("2d"), out = [];
      for (const t of [0.5, 1.25, 2.5]) {
        await new Promise((ok) => { v.onseeked = ok; v.currentTime = t; setTimeout(ok, 4000); });
        g.drawImage(v, 0, 0, 16, 9); const d = g.getImageData(8, 4, 1, 1).data; out.push([d[0], d[1], d[2]]);
      }
      return { dur: v.duration, out };
    });
    const isC = (rgb, c) => c === "r" ? rgb[0] > 180 && rgb[1] < 80 && rgb[2] < 80 : c === "b" ? rgb[2] > 180 && rgb[0] < 80 && rgb[1] < 80 : rgb[0] > 180 && rgb[1] > 180 && rgb[2] < 80;
    check("…the file: 3 s, red then (the cut second - green - gone) blue then yellow, frame-exact",
      Math.abs(px.dur - 3) < 0.1 && isC(px.out[0], "r") && isC(px.out[1], "b") && isC(px.out[2], "y"), px);
    await p.click("#tlUndo"); await p.waitForTimeout(400);
    s = await S();
    check("one ↶ puts back the clip as it was before the cut (the cut + its join are one step)", JSON.stringify(s.vl[0][1]) === JSON.stringify([["cols.webm", 0, 0, 4]]), s.vl);

    /* a picture: just longer */
    await reset({});
    await cut("i:0", 1, 2); await p.waitForTimeout(600);
    s = await S();
    check("a picture cut through: one clip, 1 s shorter (no file made)", JSON.stringify(s.img[0][1]) === JSON.stringify([[0, 3]]), s.img);

    /* ▯ Del joins too */
    await reset({});
    await ev(() => { TlEdit.setMode("frame"); TlFrame.select("vl:0", 48, 48); });
    await ev(() => TlFrame.remove());
    await p.waitForFunction(() => tl.vlayers[0].clips.length === 1 && /-join\d+\.webm$/.test(tl.vlayers[0].clips[0].name), null, { timeout: 60000 });
    s = await S();
    check("▯ Frame + Del on a frame: one clip again (one frame shorter)", s.vl[0][1].length === 1 && Math.abs(s.vl[0][1][0][3] - (4 - 1 / 24)) < 1e-4, s.vl);
    await ev(() => TlEdit.setMode("select"));

    /* kept two: retimed, ripple off */
    await reset({});
    await ev(() => { tl.vlayers[0].clips[0].fx = { speed: 2 }; tlSave(); });
    await cut("vl:0", 0.5, 1); await p.waitForTimeout(800);
    s = await S(); s.last = await ev(() => TlJoin.last);
    const rt = s.vl[0][1].length === 2 && /^a retimed clip/.test(s.last), rts = s;
    await reset({ ripple: false });
    await cut("vl:0", 1, 2); await p.waitForTimeout(800);
    s = await S();
    check("a retimed clip and a cut with ripple off stay two clips - the status line says why", rt && s.vl[0][1].length === 2 && /ripple was off/.test(s.log), { rts, s });

    /* ✂ to new layer */
    await reset({ toNew: true });
    await cut("vl:0", 1, 2); await p.waitForTimeout(600);
    s = await S();
    check("✂ to new layer: the part BEFORE the cut stays, the part AFTER it is on a new layer right above (\"Shots ✂\", from 1 s - the source from 2 s)",
      JSON.stringify(s.vl) === JSON.stringify([["Shots", [["cols.webm", 0, 0, 1]]], ["Shots ✂", [["cols.webm", 1, 2, 4]]]]) && /new layer/.test(s.log), s);
    await p.click("#tlUndo"); await p.waitForTimeout(400);
    s = await S();
    check("…one ↶ takes it back", s.vl.length === 1 && JSON.stringify(s.vl[0][1]) === JSON.stringify([["cols.webm", 0, 0, 4]]), s.vl);
    await reset({ toNew: true });
    await cut("v1", 2, 3); await p.waitForTimeout(600);
    s = await S();
    check("…V1's after-cut part goes on the FIRST video layer (just above V1); the other layers move up one",
      JSON.stringify(s.v1) === JSON.stringify([["cols.webm", 0, 0, 2]]) && s.vl.length === 2 && s.vl[0][0] === "V1 ✂" && JSON.stringify(s.vl[0][1]) === JSON.stringify([["cols.webm", 2, 3, 4]]) && s.vl[1][0] === "Shots", s);

    /* Ctrl+K split with the box ticked */
    await reset({ toNew: true });
    await ev(() => { TlCanvas.go(1.5); });
    await p.waitForTimeout(200);
    const spl = await ev(() => { pickLayer("i:0"); try { if (TlCanvas.select) TlCanvas.select(null); } catch (e) { /* fine */ } if (window.TlTargets && TlTargets.clear) TlTargets.clear(); return { ph: playhead, sel: TlCanvas.selClip && TlCanvas.selClip() ? 1 : 0, r: TlKeys.split() }; });
    await p.waitForTimeout(300);
    s = await S();
    check("Ctrl+K split with the box ticked: the part after the split is on a new layer above it",
      s.img.length === 2 && JSON.stringify(s.img[0][1]) === JSON.stringify([[0, 1.5]]) && s.img[1][0] === "Pics ✂" && Math.abs(s.img[1][1][0][0] - 1.5) < 1e-6, { s, spl });

    /* kept */
    await p.reload({ waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && document.getElementById("tlCutNew"), null, { timeout: 60000 });
    check("the box is kept (after a reload)", await ev(() => document.getElementById("tlCutNew").checked));
    await ev(() => { const n = document.getElementById("tlCutNew"); if (n.checked) n.click(); });

    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + (e.stack || e)); }
  finally {
    await b.close();
    try { await api("/api/projects/delete", { name: P }); } catch { /* fine */ }
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log("RESULT: " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
