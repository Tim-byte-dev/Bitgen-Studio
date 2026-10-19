#!/usr/bin/env node
/* bitGen Studio — 2.383.0: the timeline's red position marker, double-click to play, the marker rows, the layer
 * colours, the selected layer, no transport in the timeline's menu bar - in a REAL browser.
 * Tim: "allow the user to drag the red marker in the timeline so that he can edit the timeline without waiting for the
 * song to play through changing position of the song at will. if the video is playing continue playing from the
 * dropped position if stopped move the preview to the frame the marker was dropped on. when the user double clicks on
 * a time like 33 seconds then move the red marker to that position and continue playing from that position. scale
 * the height of the timeline markers with zoom to a minimum of 1em. make each layers placeholder a different color.
 * highlight the selected layer, remove the media play,stop,pause next and previous buttons from the timeline menubar"
 * Run against the running app (H3_URL, default the e2e server on :8311); it uses a project of its own and loads
 * "default" back after. No Playwright here = SKIP (exit 0). */
"use strict";
const fs = require("fs");
const path = require("path");
const { execSync, execFileSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the timeline marker browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const ROOT = path.join(__dirname, "..");
const P = "zz_tlmark_" + process.pid;
let pass = 0, fail = 0;
const check = (n, cond, got) => {
  if (cond) { pass++; console.log("PASS: " + n); }
  else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 500))); }
};
const api = async (u, body) => (await fetch(URL_ + u.replace(/^\//, ""), body === undefined ? {} :
  { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();
const ff = (args) => execFileSync("ffmpeg", ["-y", "-loglevel", "error"].concat(args), { stdio: "ignore" });

(async () => {
  const b = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
  const p = await b.newPage({ viewport: { width: 1900, height: 1200 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  try {
    await api("/api/projects/load", { name: P });
    const pd = path.join(ROOT, "projects", P);
    ff(["-f", "lavfi", "-i", "color=c=0x305080:s=320x180:r=24:d=40", "-f", "lavfi", "-i", "sine=frequency=330:duration=40",
        "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "40", "-deadline", "realtime", "-c:a", "libopus", "-shortest", path.join(pd, "video", "mk_base.webm")]);
    ff(["-f", "lavfi", "-i", "sine=frequency=500:duration=40", path.join(pd, "sound", "mk_song.wav")]);
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => window.TlCanvas && typeof dsReady !== "undefined" && dsReady, null, { timeout: 30000 });
    await p.waitForTimeout(800);
    await p.evaluate(() => {
      const d = document.getElementById("timelinedock");
      if (/collapsed|dockgone/.test(d.className) && typeof toggleCollapse === "function") toggleCollapse("timelinedock");
      // 2.420.0: the floating prompt docker can sit over the timeline (its tool bar grew) - out of the way for the clicks
      { const pd = document.getElementById("promptdock"); if (pd) pd.style.visibility = "hidden"; }   // this page only - nothing saved
      setVar("th", 760);
      tl.video = [{ name: "mk_base.webm", src: "video", start: 0, dur: 40, in: 0, out: 40, opacity: 1 }];
      tl.vlayers = []; tl.images = [mkLayer("I1", [])]; tl.audio = [mkLayer("A1", [{ name: "mk_song.wav", start: 0, in: 0, out: 40, dur: 40 }])];
      tl.sel = null; tlSave();
      $("tlZoom").value = "30"; $("tlZoom").dispatchEvent(new Event("input"));
      setPlayhead(2); renderTimeline();
    });
    await p.waitForTimeout(500);

    // the menu bar
    check("the timeline's menu bar has no ⏮ ▶ ⏭ ⏸ ⏹ ⏪ ⏩ (the canvas keeps its own transport)",
      await p.evaluate(() => !document.querySelector("#tlbar .transport") && ["tlToStart", "tlPlay", "tlToEnd", "tlPause", "tlStop", "tlStepBack", "tlStepFwd"].every((id) => !document.getElementById(id))
        && !!document.getElementById("tlCPlay")));

    // layer colours + the selected layer
    const col = await p.evaluate(() => [...document.querySelectorAll("#tlinner .tltrack.lcol")].map((t) => [t.dataset.lk, getComputedStyle(t).getPropertyValue("--lc").trim()]));
    check("every layer has its own colour (V1, A1, I1 - three different hues), kept on the layer",
      col.length === 3 && new Set(col.map((c) => c[1])).size === 3 && await p.evaluate(() => [v1(), ...tl.audio, ...tl.images].every((L) => Number.isFinite(L.hue))), col);
    const clipBorder = await p.evaluate(() => { const c = document.querySelector('#tlinner .tltrack[data-lk="a:0"] .clip'); return c && getComputedStyle(c).borderTopColor; });
    const lcA = await p.evaluate(() => { const t = document.querySelector('#tlinner .tltrack[data-lk="a:0"]'); const x = document.createElement("i"); x.style.color = getComputedStyle(t).getPropertyValue("--lc"); document.body.appendChild(x); const v = getComputedStyle(x).color; x.remove(); return v; });
    check("...a layer's clips are drawn in its colour", clipBorder === lcA, [clipBorder, lcA]);
    await p.click('#tlinner .tltrack[data-lk="i:0"]', { position: { x: 600, y: 20 } });
    await p.waitForTimeout(250);
    const sl = await p.evaluate(() => { const t = document.querySelector('#tlinner .tltrack[data-lk="i:0"]'); const o = document.querySelector('#tlinner .tltrack[data-lk="a:0"]');
      return { sel: t.classList.contains("sellayer"), bg: getComputedStyle(t).backgroundColor, other: getComputedStyle(o).backgroundColor, lab: getComputedStyle(t.querySelector(".tlab")).backgroundColor }; });
    check("the selected layer is highlighted (its row and header lit, unlike the others)", sl.sel && sl.bg !== sl.other && sl.lab === "rgb(59, 42, 15)", sl);

    // the marker rows follow the zoom, never under 1em
    const mk = async (z) => { await p.evaluate((z) => { $("tlZoom").value = String(z); $("tlZoom").dispatchEvent(new Event("input")); }, z); await p.waitForTimeout(250);
      return p.evaluate(() => { const r = document.querySelector("#tlinner .tltrack.short.mk"); return { h: r.getBoundingClientRect().height, em: parseFloat(getComputedStyle(r).fontSize) }; }); };
    const z0 = await mk(0), z60 = await mk(60), z100 = await mk(100);
    check("the F/L and REF marker rows grow with the zoom and never get smaller than 1em", z0.h >= z0.em + 8 - 0.5 && z60.h > z0.h && z100.h > z60.h, [z0, z60, z100]);
    await mk(30);

    // drag the marker while stopped -> the preview shows that frame
    await p.evaluate(() => { setPlayhead(2); renderTimeline(); });
    await p.waitForTimeout(300);
    // where a time is on screen NOW (the timeline may have scrolled since the last look)
    let geo = null;
    const look = async () => { geo = await p.evaluate(() => { const r = document.getElementById("tlinner").getBoundingClientRect(); return { x: r.left, y: r.top, labw: LABW, pxs: PXS }; }); };
    const xAt = (t) => geo.x + geo.labw + t * geo.pxs;
    await look();
    const ph = await p.evaluate(() => { const r = document.querySelector("#playhead .phline").getBoundingClientRect(), x = r.left + r.width / 2;
      // 2.420.0: a point of the line nothing floats over (the floating prompt docker may cover part of the timeline)
      for (let y = r.top + Math.min(60, r.height / 2); y < r.bottom - 2; y += 6) { const e = document.elementFromPoint(x, y); if (e && e.closest && e.closest("#playhead")) return { x, y }; }
      return { x, y: r.top + Math.min(60, r.height / 2) }; });
    await p.mouse.move(ph.x, ph.y); await p.mouse.down();
    for (let k = 1; k <= 8; k++) await p.mouse.move(ph.x + (xAt(6) - ph.x) * k / 8, ph.y);
    const mid = await p.evaluate(() => [playhead, TlCanvas.state.t]);
    await p.mouse.up(); await p.waitForTimeout(400);
    const st1 = await p.evaluate(() => ({ ph: playhead, playing: TlCanvas.state.playing, ct: TlCanvas.state.t, meta: document.getElementById("vmeta").textContent }));
    check("stopped: the LINE itself drags the marker (the head is not needed); the canvas follows while dragging",
      Math.abs(mid[0] - 6) < 0.2 && Math.abs(mid[1] - 6) < 0.2, mid);
    check("...dropped at 6 s: the marker stays there, nothing plays, the preview shows that frame", Math.abs(st1.ph - 6) < 0.1 && !st1.playing && Math.abs(st1.ct - 6) < 0.1 && /@6\.0/.test(st1.meta), st1);

    // double-click a time -> the marker goes there and plays from there
    await look();
    const rul = await p.evaluate(() => document.querySelector("#tlinner .tlruler").getBoundingClientRect().top + 8);
    await p.mouse.dblclick(xAt(15), rul);
    await p.waitForTimeout(900);
    const st2 = await p.evaluate(() => ({ ph: playhead, playing: TlCanvas.state.playing, t: TlCanvas.state.t }));
    check("double-click on the ruler at 15 s: the marker moves there and the preview PLAYS from there", st2.playing && st2.t > 15.2 && st2.t < 17 && st2.ph > 15.2, st2);

    // drag while playing -> continues from the drop
    await look();
    const ph2 = await p.evaluate(() => { const r = document.querySelector("#playhead .phgrab").getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    await p.mouse.move(ph2.x, ph2.y); await p.mouse.down();
    for (let k = 1; k <= 8; k++) await p.mouse.move(ph2.x + (xAt(30) - ph2.x) * k / 8, ph2.y);
    await p.waitForTimeout(400);
    const during = await p.evaluate(() => { const r = document.getElementById("playhead").getBoundingClientRect(); return { left: r.left, playing: TlCanvas.state.playing }; });
    await p.mouse.up(); await p.waitForTimeout(800);
    const st3 = await p.evaluate(() => ({ ph: playhead, playing: TlCanvas.state.playing, t: TlCanvas.state.t }));
    check("playing: the marker stays under the pointer while dragged (playback carries on)", during.playing && Math.abs(during.left - xAt(30)) < 6, [during, xAt(30)]);
    check("...dropped at 30 s: playback CONTINUES from 30 s", st3.playing && st3.t > 30.2 && st3.t < 32, st3);

    // a click on an empty part of a track while playing -> continues from there too
    await look();
    await p.mouse.click(xAt(10), await p.evaluate(() => document.querySelector('#tlinner .tltrack[data-lk="i:0"]').getBoundingClientRect().top + 20));
    await p.waitForTimeout(600);
    const st4 = await p.evaluate(() => ({ playing: TlCanvas.state.playing, t: TlCanvas.state.t }));
    check("a click on a track while playing: playback continues from the click (10 s)", st4.playing && st4.t > 10.1 && st4.t < 11.5, st4);
    await p.evaluate(() => TlCanvas.pause());
    // with a range selection, the marker still drags
    await p.evaluate(() => { tl.sel = { a: 2, b: 4 }; setPlayhead(8); renderTimeline(); });
    await p.waitForTimeout(250);
    await look();
    const ph3 = await p.evaluate(() => { const r = document.querySelector("#playhead .phgrab").getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, locked: document.getElementById("playhead").classList.contains("locked") }; });
    await p.mouse.move(ph3.x, ph3.y); await p.mouse.down();
    for (let k = 1; k <= 6; k++) await p.mouse.move(ph3.x + (xAt(12) - ph3.x) * k / 6, ph3.y);
    await p.mouse.up(); await p.waitForTimeout(300);
    check("...and with a range selection up too (no lock)", !ph3.locked && Math.abs(await p.evaluate(() => playhead) - 12) < 0.1, await p.evaluate(() => playhead));
    check("no page errors", errs.length === 0, errs);
  } catch (e) {
    check("the browser run finished", false, String(e && e.stack || e).slice(0, 600));
  } finally {
    try { await p.evaluate(() => { if (window.TlCanvas) TlCanvas.pause(); tl.video = []; tl.vlayers = []; tl.images = []; tl.audio = []; tl.sel = null; tlSave(); renderTimeline(); }); } catch { /* closed */ }
    await b.close();
    try { await api("/api/projects/load", { name: "default" }); } catch { /* best effort */ }
    try { fs.rmSync(path.join(ROOT, "projects", P), { recursive: true, force: true }); } catch { /* best effort */ }
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
