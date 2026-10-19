#!/usr/bin/env node
/* bitGen Studio — 2.412.0 in a REAL browser against the REAL app: 📤 drop-frame (29.97: on, the timecode readout
 * HH:MM:SS;FF; 25: off), a marker range (the editor's length, the band, its end dragged), a clip marker (Ctrl+Shift+M on
 * the selected clip, its flag on the clip, Shift+M stops there), ◎ track targets (Ctrl+K splits every targeted layer),
 * 🔗 a video's sound as its own clip + linked selection (moves together, off = apart), 🎧 EQ / multiband / reverb, 🎨
 * H/H + H/S curves, ✨ effect keyframes (◆ key here, a slider away from a key makes another, the canvas shows each).
 * Tim: "do the smaller jobs and complete the 10 partly done jobs".
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
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.412 browser test did not run"); console.log("\nRESULT: 0 failed"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const ROOT = path.join(__dirname, "..");
const P = "zz_prem7ui_" + process.pid;
let pass = 0, fail = 0;
const check = (n, cond, got) => {
  if (cond) { pass++; console.log("PASS: " + n); }
  else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); }
};
const api = async (u, body) => (await fetch(URL_ + u.replace(/^\//, ""), body === undefined ? {} :
  { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();
const T = fs.mkdtempSync(path.join(os.tmpdir(), "prem7ui_"));
const ff = (a) => execFileSync("ffmpeg", ["-y", "-loglevel", "error"].concat(a), { stdio: "ignore" });
ff(["-f", "lavfi", "-i", "color=c=0xd0d0d0:s=320x180:d=8:r=25", "-f", "lavfi", "-i", "sine=frequency=330:duration=8",
    "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "40", "-deadline", "realtime", "-c:a", "libopus", "-shortest", path.join(T, "ui7.webm")]);

(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const p = await b.newPage({ viewport: { width: 2560, height: 1400 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
  p.on("dialog", (d) => { d.accept().catch(() => {}); });
  const ev = (f, a) => p.evaluate(f, a);
  try {
    await api("/api/projects/new", { name: P });
    await api("/api/projects/load", { name: P });
    { const fd = new FormData(); fd.append("file", new Blob([fs.readFileSync(path.join(T, "ui7.webm"))]), "ui7.webm"); await fetch(URL_ + "api/passets", { method: "POST", body: fd }); }
    const booted = Promise.all([
      p.waitForResponse((r) => /\/api\/ui\/layout(\?|$)/.test(r.url()), { timeout: 60000 }).catch(() => null),
      p.waitForResponse((r) => /\/api\/dockers(\?|$)/.test(r.url()) && r.request().method() === "GET", { timeout: 60000 }).catch(() => null),
    ]);
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await booted;
    await p.waitForFunction(() => window.TlKeys && window.TlMarks && TlMarks.clipMark && window.TlTargets && window.H3Targets && window.TlDeliver && window.H3Timecode && H3Timecode.canDrop, null, { timeout: 60000 });
    await p.waitForTimeout(800);
    await ev(() => {
      const d = document.getElementById("timelinedock");
      if (/collapsed|dockgone/.test(d.className) && typeof toggleCollapse === "function") toggleCollapse("timelinedock");
      setVar("th", 900);
      if (document.getElementById("tlStage").classList.contains("off")) document.getElementById("tlStageTog").click();
      document.documentElement.style.setProperty("--tlsh", "520px");
      tl.video = [{ name: "ui7.webm", src: "video", in: 0, out: 4, dur: 8, start: 0, opacity: 1 }];
      tl.vlayers = [mkLayer("V2", [{ name: "ui7.webm", src: "video", in: 0, out: 4, dur: 8, start: 0, opacity: 0.5 }])];
      tl.images = []; tl.audio = []; tl.sel = null; tl.seqMarkers = []; tl.selLayer = "v1"; delete tl.tc;
      PXS = 60; tlSave(); renderTimeline(); if (window.TlFloat) TlFloat.show(false); TlCanvas.go(0);
    });
    await p.waitForTimeout(500);
    const key = async (k) => { await p.keyboard.press(k); await p.waitForTimeout(150); };
    const lp = await ev(() => { const r = document.getElementById("tlscroll").getBoundingClientRect();
      for (let y = r.top + 30; y < r.bottom - 5; y += 8) for (let x = r.left + 400; x < r.right - 20; x += 60) {
        const e = document.elementFromPoint(x, y); if (e && e.closest("#tlscroll") && !e.closest(".clip, #playhead, .tlmk, .tlab")) return { x, y }; }
      return { x: r.left + 600, y: r.top + 40 }; });

    /* ---- 1. 📤 drop-frame */
    await p.click("#tlDeliverBtn");
    await p.waitForSelector("#tdlDrop");
    const d0 = await ev(() => document.getElementById("tdlDrop").disabled);
    await p.selectOption("#tdlFps", "29.97");
    await p.waitForTimeout(100);
    await p.check("#tdlDrop");
    await p.waitForTimeout(150);
    const d1 = await ev(() => ({ tc: tl.tc, box: document.getElementById("tdlTc").value, dis: document.getElementById("tdlDrop").disabled }));
    await ev(() => { document.querySelector("#tlDeliverDlg .fx-x").click(); TlCanvas.go(60.0); });
    await p.waitForTimeout(400);
    const ro = await ev(() => (document.getElementById("tlTc") || {}).textContent || "");
    check("📤 drop-frame: off at 25 fps; at 29.97 on -> tl.tc {start 00:00:00;00, drop}; the readout counts HH:MM:SS;FF (60 s = 00:00:59;28)",
      d0 && !d1.dis && d1.tc && d1.tc.drop === true && d1.tc.start === "00:00:00;00" && d1.box === "00:00:00;00" && ro === "00:00:59;28", { d0, d1, ro });
    await ev(() => { delete tl.tc; tlSave(); TlCanvas.go(0); });

    /* ---- 2. a marker range */
    await ev(() => { const m = TlMarks.add(1); TlMarks.edit(m, 300, 300); });
    await p.waitForSelector("#tlmkLen");
    await p.fill("#tlmkLen", "2");
    await p.press("#tlmkLen", "Enter");
    await p.waitForTimeout(200);
    const r1 = await ev(() => { const bd = document.querySelector("#tlinner .tlruler .tlmk-rng"); return { m: tl.seqMarkers[0], w: bd ? parseFloat(bd.style.width) : 0, end: !!document.querySelector(".tlmk-end") }; });
    check("a marker's length 2 s -> a range: a band 2 s wide on the ruler with an end handle", r1.m.d === 2 && Math.abs(r1.w - 120) < 1 && r1.end, r1);
    const eb = await ev(() => { const r = document.querySelector(".tlmk-end").getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    await p.mouse.move(eb.x, eb.y); await p.mouse.down(); await p.mouse.move(eb.x + 30, eb.y, { steps: 4 }); await p.mouse.move(eb.x + 60, eb.y, { steps: 4 }); await p.mouse.up();
    await p.waitForTimeout(200);
    const r2 = await ev(() => tl.seqMarkers[0].d);
    check("...its end dragged 1 s right: 3 s long", Math.abs(r2 - 3) < 0.05, r2);

    /* ---- 3. a clip marker */
    await ev(() => { window.__c = tl.video[0]; tl.video[0].in = 0; TlCanvas.select(__c, TlCanvas.layerOf(__c)); TlCanvas.go(1.6); });
    await p.mouse.move(lp.x, lp.y);
    await key("Control+Shift+M");
    await p.waitForTimeout(250);
    const c1 = await ev(() => ({ marks: tl.video[0].marks, flags: [...document.querySelectorAll("#tlinner .clip .tlcmk")].length }));
    await ev(() => { tl.video[0].in = 0.5; tl.video[0].start = 0; tl.seqMarkers = []; tlSave(); renderTimeline(); TlCanvas.go(0); });   // the range marker (at 1 s) out of the way
    const c2 = await ev(() => { const f = document.querySelector("#tlinner .clip .tlcmk"); const cl = f && f.closest(".clip"); return f ? (parseFloat(f.style.left) / PXS) : null; });
    await p.mouse.move(lp.x, lp.y);
    await key("Shift+M");
    const c3 = await ev(() => TlCanvas.state.t), fr = await ev(() => 1 / ((tl.tc && +tl.tc.fps) || (typeof TLFPS === "number" ? TLFPS : 25)));
    // the marker lands on the frame at 1.6 s (the project's frame rate decides which), trimmed 0.5 s it is 0.5 s earlier
    check("Ctrl+Shift+M: a clip marker on the selected clip at 1.6 s (its source second, to the frame), a flag on the clip; trimmed 0.5 s it stays on its frame (0.5 s earlier); Shift+M stops there",
      c1.marks && c1.marks.length === 1 && Math.abs(c1.marks[0].t - 1.6) <= fr + 1e-3 && c1.flags === 1 && Math.abs(c2 - (c1.marks[0].t - 0.5)) < 0.02 && Math.abs(c3 - c2) < 0.02, { c1, c2, c3, fr });

    /* ---- 4. ◎ track targets */
    await ev(() => { tl.video[0].in = 0; delete tl.video[0].marks; tl.seqMarkers = []; tlSave(); renderTimeline(); });
    const tb = await ev(() => [...document.querySelectorAll("#tlinner .tltrack")].filter((t) => t.querySelector(".tgt")).map((t) => t.dataset.lk));
    await ev(() => { const by = (lk) => document.querySelector('#tlinner .tltrack[data-lk="' + lk + '"] .tgt'); by("v1").click(); by("vl:0").click(); });
    await ev(() => { if (typeof tlSelClip !== "undefined") tlSelClip = null; TlCanvas.deselect && TlCanvas.deselect(); TlCanvas.go(2); });
    await p.mouse.move(lp.x, lp.y);
    await key("Control+k");
    await p.waitForTimeout(200);
    const k1 = await ev(() => ({ v1: tl.video.length, v2: tl.vlayers[0].clips.length, t: [!!(tl.v1 && tl.v1.target), !!tl.vlayers[0].target] }));
    check("◎ in every layer header; V1 + V2 targeted, no clip selected: Ctrl+K splits both layers' clips at the position marker",
      tb.includes("v1") && tb.includes("vl:0") && k1.v1 === 2 && k1.v2 === 2 && k1.t[0] && k1.t[1], { tb, k1 });

    /* ---- 5. 🔗 the sound as its own clip + linked selection */
    await ev(() => { tl.video = [{ name: "ui7.webm", src: "video", in: 0, out: 4, dur: 8, start: 0, opacity: 1 }]; tl.vlayers = []; delete tl.v1.target; tlSave(); renderTimeline();
      if (window.TlFloat) TlFloat.show(true);                // Tools & Properties shown
      window.__c = tl.video[0]; TlCanvas.select(__c, TlCanvas.layerOf(__c)); TlCanvas.paintProps(); });
    await p.waitForSelector("#tlpSndOut", { state: "attached" });
    await ev(() => document.getElementById("tlpSndOut").click());
    await p.waitForTimeout(250);
    const l1 = await ev(() => ({ aud: tl.audio.map((L) => ({ n: L.name, c: (L.clips || []).map((c) => ({ name: c.name, src: c.src, start: c.start, link: !!c.link })) })), out: tl.video[0].soundOut, link: !!tl.video[0].link,
      btns: ["tlpUnlink", "tlpSndBack"].map((id) => !!document.getElementById(id)) }));
    check("🔗 Sound ⤓ as its own clip: 'V1 sound' holds it (the video file, linked), the picture's sound out; ⛓ Unlink + ↩ Sound back offered",
      l1.aud.length === 1 && l1.aud[0].n === "V1 sound" && l1.aud[0].c[0].src === "video" && l1.aud[0].c[0].link && l1.out && l1.link && l1.btns.every(Boolean), l1);
    await ev(() => { tl.video[0].start = 1.5; tlSave(); });
    const l2 = await ev(() => tl.audio[0].clips[0].start);
    await p.click("#tlLinkSel");
    await ev(() => { tl.video[0].start = 3; tlSave(); });
    const l3 = await ev(() => ({ a: tl.audio[0].clips[0].start, on: tl.linkSel, cls: document.getElementById("tlLinkSel").classList.contains("on") }));
    check("linked selection on: the picture moved to 1.5 s, its sound followed; 🔗 off: moved again, the sound stays", l2 === 1.5 && l3.a === 1.5 && l3.on === false && !l3.cls, { l2, l3 });
    await ev(() => { tl.linkSel = true; tlSave(); TlCanvas.paintProps(); });
    await ev(() => document.getElementById("tlpSndBack").click());
    await p.waitForTimeout(200);
    const l4 = await ev(() => ({ aud: tl.audio.length, out: !!tl.video[0].soundOut }));
    check("↩ Sound back: the separate clip gone, the picture has its sound", l4.aud === 0 && !l4.out, l4);

    /* ---- 6. 🎧 EQ / multiband / reverb, ✨ effect keyframes */
    await ev(() => { tl.video[0].start = 0; tlSave(); renderTimeline(); TlCanvas.go(0); TlCanvas.paintProps(); document.getElementById("tfxSound").open = true; document.getElementById("tfxEffects").open = true; });
    await ev(() => { const s = (id, v) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event("input")); e.dispatchEvent(new Event("change")); };
      s("tfxEq_low", "6"); s("tfxComp", "40"); s("tfxRev", "30"); });
    const a1 = await ev(() => tl.video[0].fx && tl.video[0].fx.afx);
    check("🎧 EQ low +6 dB, multiband 40 %, reverb 30 % (room) kept on the clip", a1 && a1.eq && a1.eq.low === 6 && a1.comp === 0.4 && a1.reverb && a1.reverb.mix === 0.3 && a1.reverb.room === "room", a1);
    await ev(() => document.getElementById("tfxKfAdd").click());
    await ev(() => { TlCanvas.go(2); TlCanvas.paintProps(); document.getElementById("tfxEffects").open = true; });
    await ev(() => { const e = document.querySelector('#tlProps input[data-vfx="vignette"]'); e.value = "1"; e.dispatchEvent(new Event("input")); e.dispatchEvent(new Event("change")); });
    const k2 = await ev(() => (tl.video[0].fx.vfx || {}).kf);
    const cornerAt = (t) => ev(async (t) => {
      TlCanvas.go(t);
      for (let i = 0; i < 40; i++) { TlCanvas.draw(); const bx = TlCanvas.box(tl.video[0], "v1", t), v = bx && bx.src; if (!v || v.tagName !== "VIDEO" || (v.readyState >= 2 && !v.seeking)) break; await new Promise((r) => setTimeout(r, 100)); }
      await new Promise((r) => setTimeout(r, 300)); TlCanvas.draw();
      const im = new Image(); im.src = TlCanvas.snapshot(); await im.decode();
      const cv = document.createElement("canvas"); cv.width = 320; cv.height = 180; const g = cv.getContext("2d"); g.drawImage(im, 0, 0, 320, 180);
      const d = g.getImageData(0, 0, 12, 12).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += d[i]; return s / (d.length / 4);
    }, t);
    const v0 = await cornerAt(0.1), v1 = await cornerAt(2);
    check("✨ ◆ key here at 0 s (vignette 0); at 2 s the vignette slider made a second key (1); the canvas: the corner bright at the start, darker at 2 s",
      k2 && k2.length === 2 && k2[0].at === 0 && k2[0].vignette === 0 && Math.abs(k2[1].at - 2) < 0.05 && k2[1].vignette === 1 && v0 > v1 + 25, { k2, v0, v1 });

    /* ---- 7. 🎨 H/H + H/S */
    await p.click("#tlColourBtn").catch(() => ev(() => document.getElementById("tlColourBtn").click()));
    await p.waitForSelector('.tcp-tabs [data-ch="hs"]', { timeout: 8000 });
    await p.click('.tcp-tabs [data-ch="hs"]');
    const cb = await ev(() => { const r = document.getElementById("tcpCurve").getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
    await p.mouse.move(cb.x + cb.w * 0.33, cb.y + cb.h * 0.5); await p.mouse.down(); await p.mouse.move(cb.x + cb.w * 0.33, cb.y + cb.h * 0.85, { steps: 5 }); await p.mouse.up();
    await p.waitForTimeout(200);
    const hc = await ev(() => ((tl.video[0].fx || {}).grade || {}).hcurves);
    check("🎨 H/S: a point pulled down at green - grade.hcurves.hs keeps it (the ends at 0.5)", hc && hc.hs && hc.hs.some((q) => Math.abs(q[0] - 0.33) < 0.03 && q[1] < 0.3) && hc.hs[0][1] === 0.5, hc);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed " + String(e.stack || e).split("\n").slice(0, 3).join(" ")); if (process.env.SHOT) await p.screenshot({ path: process.env.SHOT }).catch(() => {}); }
  finally {
    try { await ev(() => { tl.video = []; tl.vlayers = []; tl.audio = []; tl.seqMarkers = []; delete tl.tc; tl.sel = null; tlSave(); }); } catch { /* closed */ }
    await b.close();
    try { await api("/api/projects/load", { name: "default" }); } catch { /* fine */ }
    try { fs.rmSync(path.join(ROOT, "projects", P), { recursive: true, force: true }); } catch { /* fine */ }
    try { fs.rmSync(T, { recursive: true, force: true }); } catch { /* fine */ }
    console.log(`\n${pass} passed, ${fail} failed`);
    console.log("RESULT: " + fail + " failed");
    process.exit(fail ? 1 : 0);
  }
})();
