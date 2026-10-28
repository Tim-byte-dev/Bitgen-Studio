#!/usr/bin/env node
/* bitGen Studio — 2.614.0 in a REAL browser: ▼ ranges PICKED and cut by ✂ Cut; Ctrl taps counted WHILE IT PLAYS whatever
 * is focused (a list, a ticked box, ▶) and while the preview docker's player plays a timeline clip.
 * Tim: "if a range or ranges are selected and user clicks cut then cut the selected ranges ... our ctrl ranges work better
 * and are more intuitive. however they are only working when i drag the timeline and press ctrl not while the clip is
 * playing, it would be better to add the ranges as the clip is playing as well as the ctrl press over the timeline marker
 * when not playing".
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
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.614.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const P = "zz_pick_" + process.pid;
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const api = async (u, body) => (await fetch(URL_ + u.replace(/^\//, ""), body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();
const T = fs.mkdtempSync(path.join(os.tmpdir(), "pickui_"));
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc=s=160x90:r=24:d=8", "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "40", "-deadline", "realtime", path.join(T, "long.webm")], { stdio: "ignore" });

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 2200, height: 1300 } });
  const errs = []; p.on("pageerror", (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
  p.on("dialog", (d) => { d.accept().catch(() => {}); });
  const ev = (f, a) => p.evaluate(f, a);
  try {
    await api("/api/projects/new", { name: P });
    await api("/api/projects/load", { name: P });
    { const fd = new FormData(); fd.append("file", new Blob([fs.readFileSync(path.join(T, "long.webm"))]), "long.webm"); await fetch(URL_ + "api/passets", { method: "POST", body: fd }); }
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.TlRanges && TlRanges.pick && document.getElementById("tlRangeGrp") && applySel._tlranges, null, { timeout: 60000 });
    await p.waitForTimeout(600);
    await ev(() => {
      const d = document.getElementById("timelinedock");
      if (/collapsed|dockgone/.test(d.className) && typeof toggleCollapse === "function") toggleCollapse("timelinedock");
      if (typeof setVar === "function") setVar("th", 700);
      if (document.getElementById("tlStage").classList.contains("off")) document.getElementById("tlStageTog").click();
      tl.video = [];
      tl.vlayers = [mkLayer("Shots", [{ name: "long.webm", src: "video", in: 0, out: 8, dur: 8, start: 0, opacity: 1 }])];
      tl.images = []; tl.audio = []; tl.ranges = []; tl.sel = null;
      tlSave(); renderTimeline(); pickLayer("vl:0"); TlCanvas.go(0);
      document.getElementById("tlRipple").checked = true;
      const n = document.getElementById("tlCutNew"); if (n.checked) n.click();
    });
    await p.waitForTimeout(500);

    /* Ctrl taps while it plays - ▶ clicked, the speed list / the ripple box focused, the pointer far from the timeline */
    await p.mouse.move(5, 5);
    await p.click("#tlCPlay"); await p.waitForTimeout(400);
    await p.focus("#tlCSpeed");
    await p.keyboard.press("Control"); await p.waitForTimeout(500); await p.keyboard.press("Control"); await p.waitForTimeout(150);
    await p.focus("#tlRipple");
    await p.keyboard.down("Control"); await p.waitForTimeout(900); await p.keyboard.up("Control");     // a slow tap
    await p.waitForTimeout(500);
    await p.focus("#tlCPlay");                                                                             // ▶ focused
    await p.keyboard.press("Control"); await p.waitForTimeout(100);
    const s1 = await ev(() => ({ R: tl.ranges.map((r) => [r.a, r.b, r.lk]), playing: TlCanvas.state.playing, act: document.activeElement.id, pend: TlRanges.pending() }));
    await ev(() => { TlCanvas.pause(); }); await p.keyboard.press("Escape");
    await ev(() => TlCanvas.pause());
    check("while it plays (▶ clicked, the pointer away): Ctrl taps make ranges with the speed list, the ripple box or ▶ focused, a slow tap too - playback goes on",
      s1.R.length === 2 && s1.R.every((r) => r[2] === "vl:0" && r[1] > r[0]) && s1.R[1][0] >= s1.R[0][1] - 1e-6 && s1.playing && s1.act === "tlCPlay" && !s1.pend, s1);   // taps: start, end, (slow) start, (▶ focused) end
    const ty = await ev(async () => {
      const i = document.createElement("input"); i.type = "text"; document.body.appendChild(i); i.focus();
      TlCanvas.play(); return true;
    });
    await p.keyboard.press("Control"); await p.waitForTimeout(100);
    const s2 = await ev(() => { const n = !!TlRanges.pending(); document.activeElement.remove(); TlCanvas.pause(); return n; });
    check("…but not while typing in a text box", ty && s2 === false);

    /* the preview docker's player playing a clip that is on the timeline */
    await ev(async () => {
      const pl = document.getElementById("player"); window.curVideo = "long.webm"; try { curVideo = "long.webm"; } catch (e) { /* fine */ }
      pl.classList.remove("hidden"); pl.muted = true; pl.src = "/passets/video/long.webm";
      await new Promise((ok) => { pl.onloadeddata = ok; setTimeout(ok, 5000); });
      pl.currentTime = 5; await new Promise((ok) => { pl.onseeked = ok; setTimeout(ok, 3000); });
      await pl.play().catch(() => {});
    });
    await p.waitForTimeout(300);
    await p.keyboard.press("Control"); await p.waitForTimeout(400); await p.keyboard.press("Control"); await p.waitForTimeout(100);
    const s3 = await ev(() => { document.getElementById("player").pause(); return tl.ranges.map((r) => [r.a, r.b, r.lk]); });
    check("while the preview docker's player plays that clip: the range at its time ON THE TIMELINE (5 s on)", s3.length === 3 && s3[2][0] >= 5 && s3[2][0] < 6.5 && s3[2][1] > s3[2][0] && s3[2][2] === "vl:0", s3);

    /* pick + ✂ Cut */
    await ev(() => { tl.ranges = [{ a: 1, b: 2, lk: "vl:0", hue: 30 }, { a: 3, b: 4, lk: "vl:0", hue: 170 }, { a: 5, b: 6, lk: "vl:0", hue: 300 }]; tlSave(); renderTimeline(); });
    await p.waitForTimeout(450);
    const mk = (i, side) => ev(([i, side]) => { const m = document.querySelector('.tlruler .tlrm[data-i="' + i + '"][data-side="' + side + '"]'); m.scrollIntoView({ block: "nearest", inline: "center" }); const r = m.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, [i, side]);
    await p.mouse.click(...(await mk(0, "a")));
    await p.keyboard.down("Control"); await p.mouse.click(...(await mk(2, "b"))); await p.keyboard.up("Control");
    await p.waitForTimeout(150);
    const pk = await ev(() => ({ picked: TlRanges.picked(), btn: document.getElementById("tlRangeCut").textContent, n: tl.ranges.length, picks: document.querySelectorAll(".tlrm.pick").length, pend: !!TlRanges.pending() }));
    check("a click on a ▼ picks its range, Ctrl+click picks one more (no range started by that Ctrl); the button says ✂ Cut 2 picked",
      JSON.stringify(pk.picked) === "[0,2]" && pk.btn === "✂ Cut 2 picked" && pk.n === 3 && pk.picks === 4 && !pk.pend, pk);
    await p.click("#tlRangeCut");
    await p.waitForFunction(() => tl.vlayers[0].clips.length === 1 && /-join1\.webm$/.test(tl.vlayers[0].clips[0].name), null, { timeout: 60000 });
    const c1 = await ev(() => ({ c: tl.vlayers[0].clips.map((c) => [c.start, c.in, c.out]), R: tl.ranges.map((r) => [r.a, r.b]), btn: document.getElementById("tlRangeCut").textContent }));
    check("✂ Cut cuts the PICKED ranges only (one joined clip 6 s), the other range stays; nothing picked = ✂ Cut all",
      JSON.stringify(c1.c) === JSON.stringify([[0, 0, 6]]) && JSON.stringify(c1.R) === JSON.stringify([[3, 4]]) && c1.btn === "✂ Cut all", c1);
    await p.click("#tlUndo"); await p.waitForTimeout(400);
    await ev(() => TlRanges.pick([1]));
    await ev(() => { tl.sel = { a: 0, b: 0.5 }; tl.selLayer = "vl:0"; tlSave(); renderTimeline(); });
    await p.waitForTimeout(450);
    await ev(() => TlRanges.pick([1]));
    await p.click("#tlCutSel");
    await p.waitForFunction(() => tl.vlayers[0].clips.length === 1 && /-join\d\.webm$/.test(tl.vlayers[0].clips[0].name), null, { timeout: 60000 });
    const c2 = await ev(() => ({ c: tl.vlayers[0].clips.map((c) => [c.start, c.in, c.out]), R: tl.ranges.map((r) => [r.a, r.b]) }));
    check("the selection bar's ✂ Cut with a range picked cuts the PICKED range (3 – 4 s), not the ruler selection", JSON.stringify(c2.c) === JSON.stringify([[0, 0, 7]]) && c2.R.length === 2, c2);

    /* Esc unpicks; Del removes the picked markers */
    await ev(() => TlRanges.pick([0]));
    await p.mouse.move(...(await mk(0, "a"))); await p.keyboard.press("Escape"); await p.waitForTimeout(100);
    const e1 = await ev(() => TlRanges.picked().length);
    await ev(() => TlRanges.pick([0])); await p.keyboard.press("Delete"); await p.waitForTimeout(150);
    const e2 = await ev(() => ({ n: tl.ranges.length, clips: tl.vlayers[0].clips.length }));
    check("Esc unpicks; Del removes the picked range's markers (the clips stay)", e1 === 0 && e2.n === 1 && e2.clips === 1, { e1, e2 });

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
