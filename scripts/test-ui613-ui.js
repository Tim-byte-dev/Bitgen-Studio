#!/usr/bin/env node
/* bitGen Studio — 2.613.0 in a REAL browser: ▼ RANGES MARKED WITH CTRL WHILE IT PLAYS, cut / sped up all at once; the time
 * under the pointer; the playback speed.
 * Tim: "in timeline mode if user presses ctrl while the clip is playing add an upsidedown triangle at the time marker ...
 * ctrl again ... the end of the range. allow the clip to continue to play ... multiple ranges on the same layer ... the
 * selected layer, change the color of the range markers for each range, allow the user to move the range markers show the
 * fram in preview ... when user hovers over the timeline show the time in a small box. add option to cut all the ranges.
 * add 2x,4x,8x,0.5x,0.25,0.125 playback options. can i speed up a range in my clip".
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
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.613.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const P = "zz_ranges_" + process.pid;
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const api = async (u, body) => (await fetch(URL_ + u.replace(/^\//, ""), body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();
const T = fs.mkdtempSync(path.join(os.tmpdir(), "rangesui_"));
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc=s=160x90:r=24:d=6", "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "40", "-deadline", "realtime", path.join(T, "long.webm")], { stdio: "ignore" });

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
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.TlRanges && document.getElementById("tlRangeGrp") && document.getElementById("tlCSpeed"), null, { timeout: 60000 });
    await p.waitForTimeout(600);
    const setup = () => ev(() => {
      const d = document.getElementById("timelinedock");
      if (/collapsed|dockgone/.test(d.className) && typeof toggleCollapse === "function") toggleCollapse("timelinedock");
      if (typeof setVar === "function") setVar("th", 700);
      if (document.getElementById("tlStage").classList.contains("off")) document.getElementById("tlStageTog").click();
      tl.video = [];
      tl.vlayers = [mkLayer("Shots", [{ name: "long.webm", src: "video", in: 0, out: 6, dur: 6, start: 0, opacity: 1 }])];
      tl.images = []; tl.audio = []; tl.ranges = []; tl.sel = null;
      const z = document.getElementById("tlZoom"); z.value = "75"; z.dispatchEvent(new Event("input"));
      tlSave(); renderTimeline(); pickLayer("vl:0"); TlCanvas.go(0);
      document.getElementById("tlRipple").checked = true;
      const n = document.getElementById("tlCutNew"); if (n.checked) n.click();
    }).then(() => p.waitForTimeout(500));
    await setup();

    const ui = await ev(() => ({ grp: !!document.getElementById("tlRangeGrp"), n: document.getElementById("tlRangeN").textContent, none: document.getElementById("tlRangeGrp").classList.contains("none"),
      rates: [...document.getElementById("tlCSpeed").options].map((o) => o.value), spd: [...document.getElementById("tlRangeSpd").options].map((o) => o.value), keys: TlKeys.KEYS.map((k) => k[0]) }));
    check("the menu bar's ▼ group (0 ranges: its buttons dimmed), the transport's speed 0.125× … 8×, Ctrl (tap) in the shortcut list",
      ui.grp && ui.n === "0" && ui.none && ui.rates.join() === "0.125,0.25,0.5,1,2,4,8" && ui.spd.join() === "2,4,8,10" && ui.keys.includes("Ctrl (tap)"), ui);

    /* Ctrl while it plays */
    await ev(() => TlCanvas.play()); await p.waitForTimeout(500);
    await p.keyboard.press("Control"); await p.waitForTimeout(120);
    const p1 = await ev(() => ({ pend: TlRanges.pending(), playing: TlCanvas.state.playing, m: document.querySelectorAll(".tlruler .tlrm.pend").length }));
    await p.waitForTimeout(700);
    await p.keyboard.press("Control"); await p.waitForTimeout(120);
    const r1 = await ev(() => ({ R: tl.ranges.slice(), playing: TlCanvas.state.playing, pend: TlRanges.pending() }));
    check("Ctrl while it plays: a ▼ in the ruler at the marker = a range START on the highlighted layer; Ctrl again = its END; it keeps playing",
      p1.pend && p1.pend.lk === "vl:0" && p1.m === 1 && p1.playing && r1.R.length === 1 && r1.R[0].lk === "vl:0" && r1.R[0].b - r1.R[0].a > 0.4 && r1.R[0].b - r1.R[0].a < 1.4 && r1.playing && !r1.pend, { p1, r1 });
    await p.waitForTimeout(300);
    await p.keyboard.press("Control"); await p.waitForTimeout(500); await p.keyboard.press("Control"); await p.waitForTimeout(150);
    await ev(() => TlCanvas.pause()); await p.waitForTimeout(200);
    const r2 = await ev(() => ({ R: tl.ranges.slice(), marks: [...document.querySelectorAll(".tlruler .tlrm")].map((m) => m.style.color), bands: document.querySelectorAll('.tltrack[data-lk="vl:0"] .tlrband').length, n: document.getElementById("tlRangeN").textContent }));
    check("a second range on the same layer: its own colour (2 × ▼ each), both bands on the layer's row, ▼ 2",
      r2.R.length === 2 && r2.R[1].a >= r2.R[0].b - 1e-6 && r2.R[0].hue !== r2.R[1].hue && r2.marks.length === 4 && r2.marks[0] === r2.marks[1] && r2.marks[0] !== r2.marks[2] && r2.bands === 2 && r2.n === "2", r2);

    /* drag a ▼: the frame in the preview */
    const pos = (t) => ev((t) => { const i = document.getElementById("tlinner").getBoundingClientRect(); return i.left + LABW + t * PXS; }, t);
    const m1 = await ev(() => { const m = document.querySelector('.tlruler .tlrm[data-i="0"][data-side="b"]'); m.scrollIntoView({ block: "nearest", inline: "center" }); const r = m.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    const x15 = await pos(1.5 + 0.01);
    await p.mouse.move(m1.x, m1.y); await p.mouse.down(); await p.mouse.move((m1.x + x15) / 2, m1.y, { steps: 3 }); await p.mouse.move(x15, m1.y, { steps: 4 }); await p.mouse.up(); await p.waitForTimeout(300);
    const d1 = await ev(() => ({ b: tl.ranges[0].b, t: TlCanvas.state.t, ph: playhead, pick: TlRanges.picked(), playing: TlCanvas.state.playing }));
    check("a ▼ dragged: that end moves (whole frames) and the preview shows its frame (the marker there)", Math.abs(d1.b - 1.5) < 1e-6 && Math.abs(d1.t - 1.5) < 1e-6 && Math.abs(d1.ph - 1.5) < 1e-6 && JSON.stringify(d1.pick) === "[0]" && !d1.playing, d1);

    /* right-click removes; Ctrl with the pointer on the timeline (paused) */
    const m2 = await ev(() => { const r = document.querySelector('.tlruler .tlrm[data-i="1"][data-side="a"]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    await p.mouse.click(m2.x, m2.y, { button: "right" }); await p.waitForTimeout(200);
    const after = await ev(() => tl.ranges.length);
    const tr = await ev(() => { const sc = document.getElementById("tlscroll"), el = document.querySelector('.tltrack[data-lk="vl:0"]'); sc.scrollLeft = 0; sc.scrollTop = Math.max(0, el.offsetTop - 20); const r = el.getBoundingClientRect(); return { y: r.top + r.height / 2 }; });
    await p.mouse.move(await pos(2.6), tr.y);
    await ev(() => TlCanvas.go(2.5)); await p.keyboard.press("Control"); await ev(() => TlCanvas.go(3)); await p.keyboard.press("Control"); await p.waitForTimeout(200);
    const r3 = await ev(() => tl.ranges.map((r) => [r.a, r.b, r.lk]));
    check("right-click on a ▼ removes its range; paused, Ctrl with the pointer on the timeline marks one too (2.5 – 3 s)", after === 1 && r3.length === 2 && r3[1][0] === 2.5 && r3[1][1] === 3 && r3[1][2] === "vl:0", { after, r3 });

    /* the hover box */
    await p.mouse.move(await pos(2), tr.y); await p.waitForTimeout(100);
    const hv = await ev(() => { const b = document.getElementById("tlHovT"); return { on: b.style.display === "block", txt: b.textContent }; });
    check("hovering over the timeline: the time under the pointer in a small box (timecode · seconds · frame)", hv.on && /2\.0\d s · f 4[89]/.test(hv.txt), hv);

    /* playback speed */
    await p.selectOption("#tlCSpeed", "2");
    await ev(() => { TlCanvas.go(0); TlCanvas.play(); }); await p.waitForTimeout(300);
    const sp = await ev(() => ({ rate: TlCanvas.state.rate, shown: (document.getElementById("tlCRate") || {}).textContent, keep: localStorage.getItem("h3.tl.prate") }));
    await p.selectOption("#tlCSpeed", "0.125"); await p.waitForTimeout(150);
    const sp2 = await ev(() => ({ rate: TlCanvas.state.rate, playing: TlCanvas.state.playing }));
    await ev(() => TlCanvas.pause());
    await p.selectOption("#tlCSpeed", "1");
    check("the speed picked: ▶ plays at 2× (shown beside ▶, kept), changed while playing = at once (0.125×)",
      sp.rate === 2 && /2×/.test(sp.shown) && sp.keep === "2" && sp2.rate === 0.125 && sp2.playing, { sp, sp2 });

    /* ✂ Cut all */
    const rs = await ev(() => tl.ranges.map((r) => [r.a, r.b]));
    const gone = rs.reduce((s, r) => s + r[1] - r[0], 0);
    await p.waitForTimeout(450);
    await ev(() => TlRanges.pick([]));            // 2.614.0: none picked = ✂ Cut all
    await p.click("#tlRangeCut");
    await p.waitForFunction(() => tl.vlayers[0].clips.length === 1 && /-join1\.webm$/.test(tl.vlayers[0].clips[0].name), null, { timeout: 60000 });
    const c1 = await ev(() => ({ c: tl.vlayers[0].clips.map((c) => [c.name, c.start, c.in, c.out]), R: tl.ranges.length, n: document.getElementById("tlRangeN").textContent }));
    check("✂ Cut all: every range out of its layer (ripple), the clip cut twice is ONE clip again (one file, 6 s minus the ranges), the ranges gone",
      c1.c.length === 1 && Math.abs(c1.c[0][3] - (6 - gone)) < 0.02 && c1.c[0][1] === 0 && c1.R === 0 && c1.n === "0", { c1, gone });
    await p.click("#tlUndo"); await p.waitForTimeout(400);
    const u1 = await ev(() => ({ c: tl.vlayers[0].clips.map((c) => [c.name, c.start, c.in, c.out]), R: tl.ranges.length }));
    check("…one ↶: the clip and the ranges back", JSON.stringify(u1.c) === JSON.stringify([["long.webm", 0, 0, 6]]) && u1.R === 2, u1);

    /* ⏩ Speed up */
    await ev(() => { tl.ranges = [{ a: 1, b: 3, lk: "vl:0", hue: 40 }]; tlSave(); renderTimeline(); });
    await p.waitForTimeout(450);
    await p.selectOption("#tlRangeSpd", "4"); await p.click("#tlRangeFast"); await p.waitForTimeout(300);
    const f1 = await ev(() => ({ c: tl.vlayers[0].clips.map((c) => [c.start, c.in, c.out, c.fx && c.fx.speed || 1, +effDur(c).toFixed(4)]), R: tl.ranges.length }));
    check("⏩ 4× on 1 – 3 s: the clip split there, the middle plays 4× faster (0.5 s), what follows moved up 1.5 s",
      JSON.stringify(f1.c) === JSON.stringify([[0, 0, 1, 1, 1], [1, 1, 3, 4, 0.5], [1.5, 3, 6, 1, 3]]) && f1.R === 0, f1);

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
