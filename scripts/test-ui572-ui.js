#!/usr/bin/env node
/* bitGen Studio — 2.572.0 in a REAL browser + a REAL compile: ✨ Auto transition (N frames at every cut, nothing moved -
 * the clip before held under the next one) and 🔇 Video sound (every video layer muted at once).
 * Tim: "can we have an auto transition button with number of frames input in the timeline menubar. for music videos it is
 * important that the lipsync is timed well. add a mute all button to mute all video layers. i prefer to have a full sound
 * clip and the video lipsync match - the full soundclip prevents abrupt cuts in the song"
 * A red 2 s clip on V1, a blue 2 s clip on V2 from 2 s: with 12 frames of dissolve the compile is red to 2.0 s, a blend
 * from 2.0 to 2.5 s, blue after - and still 4 s long (blue starts EXACTLY at 2 s). Against the running app (H3_URL). */
"use strict";
const fs = require("fs");
const path = require("path");
const { execSync, execFileSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the auto transition browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const BASE = URL_.replace(/\/$/, "");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const api = async (u, b) => { const r = await fetch(BASE + u, b ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) } : undefined); return r.json().catch(() => ({})); };
const ff = (args) => execFileSync("ffmpeg", ["-y", "-loglevel", "error"].concat(args), { stdio: "ignore" });
const rgbAt = (file, t) => [...execFileSync("ffmpeg", ["-loglevel", "error", "-ss", String(t), "-i", file, "-frames:v", "1", "-vf", "scale=1:1:flags=area", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"])];
const durOf = (file) => +execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", file]).toString().trim();

(async () => {
  const P = "zz-autotr572";
  let before = null;
  try { before = (await api("/api/projects/current")).name || null; } catch { before = null; }
  await api("/api/projects/new", { name: P }); await api("/api/projects/load", { name: P });
  const pd = path.join(ROOT, "projects", P);
  fs.mkdirSync(path.join(pd, "video"), { recursive: true });
  for (const [n, col] of [["at_red", "red"], ["at_blue", "blue"]])
    ff(["-f", "lavfi", "-i", `color=c=${col}:s=320x180:r=24:d=2`, "-f", "lavfi", "-i", "sine=f=330:d=2", "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "30", "-deadline", "realtime", "-c:a", "libopus", "-shortest", path.join(pd, "video", n + ".webm")]);
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3TlSeq && document.getElementById("tlAutoTr"), null, { timeout: 60000 });
    await p.waitForTimeout(1000);
    /* eslint-disable no-undef */
    await ev(() => {
      tl.audio = []; tl.images = []; tl.seqAuto = false; tl.autoTr = { on: false, frames: 12, type: "dissolve" };
      tl.v1.muted = false; tl.v1.transitionOut = { type: "none", dur: 0.5 };
      tl.video = [{ name: "at_red.webm", src: "video", start: 0, dur: 2, in: 0, out: 2, opacity: 1 }];
      tl.vlayers = [mkLayer("V2", [{ name: "at_blue.webm", src: "video", start: 2, dur: 2, in: 0, out: 2, opacity: 1 }])];
      tlSave(); renderTimeline();
    });
    const ui = await ev(() => ({ btn: !!document.getElementById("tlAutoTr"), n: document.getElementById("tlAutoTrN").value, ty: document.getElementById("tlAutoTrT").value, mute: document.getElementById("tlMuteV").textContent,
      order: [...document.querySelectorAll("#tlbar #tlSeqBtn, #tlbar #tlAutoTr, #tlbar #tlAutoTrN, #tlbar #tlMuteV")].map((x) => x.id).join() }));
    check("the timeline's bar: ✨ Auto transition, its frames (12) and its type (dissolve), 🔊 Video sound - after ⛓ Sequential", ui.btn && ui.n === "12" && ui.ty === "dissolve" && /Video sound/.test(ui.mute) && ui.order === "tlSeqBtn,tlAutoTr,tlAutoTrN,tlMuteV", ui);

    /* 1 on: a tail on the red clip, the dissolve In on V2; nothing moved */
    await p.click("#tlAutoTr"); await p.waitForTimeout(300);
    const s1 = await ev(() => ({ on: document.getElementById("tlAutoTr").classList.contains("on"), tail: tl.video[0].tail, tin: tl.vlayers[0].transitionIn, starts: [tl.video[0].start, tl.vlayers[0].clips[0].start], outs: [tl.video[0].out, tl.vlayers[0].clips[0].out] }));
    check("✨ on: the clip before the cut is held 12 frames (0.5 s) under the next one, V2 dissolves in over 0.5 s - and every clip keeps its start and length",
      s1.on && s1.tail === 0.5 && s1.tin && s1.tin.type === "dissolve" && s1.tin.dur === 0.5 && s1.starts.join() === "0,2" && s1.outs.join() === "2,2", s1);
    await p.fill("#tlAutoTrN", "6"); await ev(() => document.getElementById("tlAutoTrN").dispatchEvent(new Event("change")));
    const s2 = await ev(() => ({ tail: tl.video[0].tail, tin: tl.vlayers[0].transitionIn.dur, keep: tl.autoTr.frames }));
    check("...6 frames: 0.25 s (kept with the timeline)", s2.tail === 0.25 && s2.tin === 0.25 && s2.keep === 6, s2);
    await p.fill("#tlAutoTrN", "12"); await ev(() => document.getElementById("tlAutoTrN").dispatchEvent(new Event("change")));

    /* 2 the preview: half way through the dissolve both clips are on the canvas */
    await ev(() => { setPlayhead(2.25); if (window.TlCanvas && TlCanvas.mark) TlCanvas.mark(); });
    await p.waitForTimeout(1500);
    const pv = await ev(async () => {
      const u = TlCanvas.snapshot(); const im = new Image(); await new Promise((ok) => { im.onload = ok; im.src = u; });
      const c = document.createElement("canvas"); c.width = 1; c.height = 1; const g = c.getContext("2d"); g.drawImage(im, 0, 0, 1, 1); return Array.from(g.getImageData(0, 0, 1, 1).data);
    });
    check("the preview at 2.25 s: the red clip held underneath, the blue one half in (a mix of both)", pv[0] > 50 && pv[2] > 50, pv);

    /* 3 the compile: red to 2 s, the blend 2 - 2.5 s, blue from there; still 4 s - blue starts exactly at 2 s */
    const payload = await ev(() => window.TlExportBody(tl));
    const sent = { v1tail: payload.video[0].tail, v2in: payload.video_layers[0].transition_in };
    const job = await api("/api/export", payload);
    let st = "";
    for (let i = 0; i < 180 && job.id; i++) { st = (await api("/api/jobs/" + job.id)).status; if (st === "done" || st === "failed") break; await new Promise((ok) => setTimeout(ok, 1000)); }
    const movie = path.join(pd, P + ".mp4");
    check("the compile finished (the tail sent with the clip)", st === "done" && fs.existsSync(movie) && sent.v1tail === 0.5 && sent.v2in && sent.v2in.type === "dissolve", { st, sent, job });
    if (st === "done") {
      const d = durOf(movie), r1 = rgbAt(movie, 1.0), mid = rgbAt(movie, 2.25), b1 = rgbAt(movie, 3.0), early = rgbAt(movie, 1.95);
      check("COMPILE: red before the cut, red + blue blended at 2.25 s (not black), blue after; the same length (4 s) - nothing slid",
        r1[0] > 180 && r1[2] < 70 && early[0] > 180 && mid[0] > 60 && mid[2] > 60 && b1[2] > 180 && b1[0] < 70 && Math.abs(d - 4) < 0.15, { d, r1, early, mid, b1 });
    }

    /* 4 🔇 Video sound */
    await p.click("#tlMuteV"); await p.waitForTimeout(200);
    const m1 = await ev(() => ({ v1: tl.v1.muted, v2: tl.vlayers[0].muted, txt: document.getElementById("tlMuteV").textContent, on: document.getElementById("tlMuteV").classList.contains("on") }));
    await p.click("#tlMuteV"); await p.waitForTimeout(200);
    const m2 = await ev(() => ({ v1: tl.v1.muted, v2: tl.vlayers[0].muted, txt: document.getElementById("tlMuteV").textContent }));
    check("🔇 Video sound: V1 and every video layer muted at once (the song plays alone); again = their sound back", m1.v1 && m1.v2 && m1.on && /🔇/.test(m1.txt) && !m2.v1 && !m2.v2 && /🔊/.test(m2.txt), { m1, m2 });

    /* 5 off: what it added goes; a transition the user set stays */
    await ev(() => { tl.vlayers.push(mkLayer("V3", [{ name: "at_red.webm", src: "video", start: 4, dur: 2, in: 0, out: 2, opacity: 1 }])); tl.vlayers[1].transitionIn = { type: "wipeleft", dur: 0.3 }; tlSave(); renderTimeline(); });
    const s3 = await ev(() => ({ tailB: tl.vlayers[0].clips[0].tail, v3in: tl.vlayers[1].transitionIn }));
    check("...a clip added after (V3 at 4 s): its cut gets a tail on save; the wipe the user set on V3 stays as it is", s3.tailB === 0.5 && s3.v3in.type === "wipeleft" && s3.v3in.dur === 0.3, s3);
    await p.click("#tlAutoTr"); await p.waitForTimeout(300);
    const s4 = await ev(() => ({ tail: tl.video[0].tail, tailB: tl.vlayers[0].clips[0].tail, v2in: tl.vlayers[0].transitionIn.type, v3in: tl.vlayers[1].transitionIn.type, on: tl.autoTr.on }));
    check("✨ off: the tails and its dissolves are gone (plain cuts again); the user's wipe stays", !s4.on && s4.tail == null && s4.tailB == null && s4.v2in === "none" && s4.v3in === "wipeleft", s4);
    /* eslint-enable no-undef */
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + (e && e.stack || e)); }
  finally {
    try { await ev(() => { tl.video = []; tl.vlayers = []; tl.autoTr = { on: false, frames: 12, type: "dissolve" }; tl.v1.muted = false; tlSave(); }); } catch (e) { /* gone */ }   // eslint-disable-line no-undef
    await b.close();
    try { await api("/api/projects/load", { name: before && before !== P ? before : "default" }); } catch { /* fine */ }
    try { fs.rmSync(pd, { recursive: true, force: true }); } catch { /* fine */ }
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
