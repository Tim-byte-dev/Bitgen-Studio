#!/usr/bin/env node
/* bitGen Studio — 2.733.0 in a REAL browser against a running studio (H3_URL, or H3_PORT - default 8311).
 * Tim (verbatim): "if we select an image thumbnail and press the enhance buton can we upscale the image" + "in sheet music
 * tab add media buttons play/pause, rewind,rewind to start,foward , foward to end buttons for the songs sheet music and
 * highlight the notes as the song is played"
 *   ⏫ Enhance on a PICTURE: a gallery image clicked = Enhance says so and opens the picture panel (320×180 → 640×360),
 *     Lanczos queues a job that writes <name>_upscaled_640x360.png at that size; a video clicked after = the SeedVR2
 *     panel again; a reference-dock picture (it lives in the browser) is sent and planned too;
 *   ▶ the score: the song beside the .abc is offered; ▶ plays it - the time runs, notes light (data-n heads get
 *     .abcOn), the bar gets its band, ⏸; ⏩ / ⏮ / ⏭; a click on a note jumps to it; Sync moves the clock and is
 *     remembered; 🎹 the notes play without a song; ⛶ Read has the same buttons and lights.
 * No server / no Playwright = SKIP. The test's files are removed afterwards. */
"use strict";
const fs = require("fs");
const path = require("path");
const { execSync, spawnSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.733.0 browser test did not run"); process.exit(0); }
const URL0 = process.env.H3_URL || ("http://127.0.0.1:" + (process.env.H3_PORT || 8311) + "/");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PIC = "E2E-Pic733.png", ABC = "E2E-Play733_20261109-100000.abc", WAV = "E2E-Play733_20261109-100000.wav";
const SCORE = `X:1
T:Play Test
M:4/4
L:1/16
Q:1/4=120
V: Vocal clef=treble name="Vocal Melody" snm="Vocal"
V: Ins clef=treble name="Ins Melody" snm="Inst."
K:C
% verse
V: Vocal
"C"E4G4A4G4|"G"D4E4G4E4|"Am"E4G4A4c4|"F"F4E4D4C4|
V: Ins
z8 [CEG]8|z8 [B,DG]8|z8 [A,CE]8|z8 [A,CF]8|
`;
const size = (f) => { const r = spawnSync("ffprobe", ["-v", "error", "-show_entries", "stream=width,height", "-of", "csv=p=0", f], { encoding: "utf8" }); return (r.stdout || "").trim(); };

(async () => {
  try { const r = await fetch(URL0); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL0 + " - the 2.733.0 browser test did not run"); process.exit(0); }
  const where = await fetch(URL0 + "api/outputs/where").then((r) => r.json()).catch(() => null);
  const out = where && where.dir;
  if (!out || !fs.existsSync(out)) { console.log("SKIP: the studio's output folder is not on this machine"); process.exit(0); }
  const made = [PIC, ABC, WAV, "E2E-Pic733_upscaled_640x360.png"].map((n) => path.join(out, n));
  spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc2=size=320x180:rate=1", "-frames:v", "1", made[0]]);
  fs.writeFileSync(made[1], SCORE);
  spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "sine=frequency=330:sample_rate=32000", "-t", "12", made[2]]);
  const b = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
  try {
    const p = await (await b.newContext({ viewport: { width: 1500, height: 950 } })).newPage();
    const errs = []; p.on("pageerror", (e) => errs.push(e.message));
    const ev = (f, a) => p.evaluate(f, a);
    await p.goto(URL0);
    await p.waitForFunction(() => window.SelVideo && SelVideo.getImage && window.ImgUpscalePanel && window.MuScore && window.ScorePlayer && document.getElementById("enhanceBtn"), null, { timeout: 30000 });

    // ── ⏫ Enhance on a picture ──
    await ev(() => document.querySelector('.gtabs button[data-gtab="images"]').click());
    await p.waitForFunction((n) => document.querySelector(`#gallery .thumb[data-name="${n}"]`), PIC, { timeout: 15000 }).catch(() => {});
    await ev((n) => document.querySelector(`#gallery .thumb[data-name="${n}"]`).click(), PIC);
    await sleep(300);
    await ev(() => { const lb = document.getElementById("lb"); if (lb && lb.open) lb.close(); document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })); });
    const sel = await ev(() => ({ kind: SelVideo.kind(), img: SelVideo.getImage(), title: document.getElementById("enhanceBtn").title }));
    check("a gallery image clicked: the selection is a PICTURE and ⏫ Enhance says it will upscale it", sel.kind === "image" && sel.img && sel.img.name === "E2E-Pic733.png"
      && sel.img.from === "gallery" && /Upscale the picture E2E-Pic733\.png \(gallery Images\)/.test(sel.title), sel);
    await ev(() => document.getElementById("enhanceBtn").click());
    await p.waitForFunction(() => /→/.test((document.getElementById("iuPlan") || {}).textContent || ""), null, { timeout: 15000 }).catch(() => {});
    const pa = await ev(() => ({ shown: ImgUpscalePanel.shown(), src: document.getElementById("iuSrc").textContent, plan: document.getElementById("iuPlan").textContent,
      sv: !!(window.SeedVR2Panel && SeedVR2Panel.shown()), ways: [...document.getElementById("iuMethod").options].map((o) => o.value), sizes: [...document.getElementById("iuSize").options].map((o) => o.value) }));
    check("⏫ Enhance opens the PICTURE panel (not SeedVR2's): the picture named, 320×180 → 640×360 at ×2, the three ways, the six sizes",
      pa.shown && !pa.sv && /E2E-Pic733\.png · gallery/.test(pa.src) && /320×180 → 640×360 \(×2\)/.test(pa.plan) && pa.ways.join() === "seedvr2,model,lanczos" && pa.sizes.join() === "x2,x3,x4,1080,1440,2160", pa);
    await p.selectOption("#iuMethod", "lanczos");
    await p.selectOption("#iuSize", "x2");
    await sleep(300);
    const off = await ev(() => ({ model: document.getElementById("iuModel").disabled, color: document.getElementById("iuColor").disabled }));
    check("Lanczos greys out the model, colour match and denoise", off.model && off.color, off);
    await ev(() => document.getElementById("iuGo").click());
    let ok = false;
    for (let i = 0; i < 120 && !ok; i++) { await sleep(500); ok = fs.existsSync(made[3]) && size(made[3]) === "640,360"; }
    check("⏫ Upscale queues the job: E2E-Pic733_upscaled_640x360.png lands in the output folder at exactly 640×360; the panel closes",
      ok && !(await ev(() => ImgUpscalePanel.shown())), fs.existsSync(made[3]) ? size(made[3]) : "no file");
    // a video after the picture
    await ev(() => document.querySelector('.gtabs button[data-gtab="video"]').click());
    await p.waitForFunction(() => document.querySelector("#gallery .thumb[data-name$='.mp4'], #gallery .thumb[data-name$='.webm']"), null, { timeout: 15000 }).catch(() => {});
    const vname = await ev(() => { const t = document.querySelector("#gallery .thumb[data-name$='.mp4'], #gallery .thumb[data-name$='.webm']"); if (t) t.querySelector(".gmeta, video").dispatchEvent(new MouseEvent("click", { bubbles: true })); return t && t.dataset.name; });
    if (vname) {
      await sleep(300);
      await ev(() => { const lb = document.getElementById("lb"); if (lb && lb.open) lb.close(); });
      await ev(() => document.getElementById("enhanceBtn").click());
      await sleep(600);
      const vv = await ev(() => ({ kind: SelVideo.kind(), sv: !!(window.SeedVR2Panel && SeedVR2Panel.shown()), iu: ImgUpscalePanel.shown() }));
      check("a video clicked after it: ⏫ Enhance opens SeedVR2's panel again", vv.kind === "video" && vv.sv && !vv.iu, vv);
      await ev(() => { if (window.SeedVR2Panel) SeedVR2Panel.close(); });
    } else console.log("SKIP: no video in the gallery - the 'video after picture' check did not run");
    // a reference-dock picture: it lives in the browser, so it is sent first
    const refOk = await ev(async () => {
      if (typeof refs === "undefined" || typeof renderTray !== "function") return "no tray";
      const blob = await (await fetch("/outputs/E2E-Pic733.png")).blob();
      const file = new File([blob], "my ref.png", { type: "image/png" });
      refs.push({ file, url: URL.createObjectURL(file), subject: 1, role: "person", roleOther: "" });
      renderTray();
      const w = [...document.querySelectorAll('#tray .imgwrap[data-lb-kind="image"]')].pop();
      if (!w) return "no tile";
      w.click();
      const lb = document.getElementById("lb"); if (lb && lb.open) lb.close();
      return SelVideo.kind() + " " + (SelVideo.getImage() || {}).from;
    });
    if (refOk === "image ref") {
      await ev(() => document.getElementById("enhanceBtn").click());
      await p.waitForFunction(() => /→/.test(document.getElementById("iuPlan").textContent), null, { timeout: 15000 }).catch(() => {});
      const rr = await ev(() => ({ src: document.getElementById("iuSrc").textContent, plan: document.getElementById("iuPlan").textContent, st: ImgUpscalePanel.state() }));
      check("a reference-dock picture: sent to the studio once (an upload token), planned 320×180 → 640×360", /my ref\.png · reference dock/.test(rr.src)
        && /320×180 → 640×360/.test(rr.plan) && rr.st.upload && rr.st.upload.from === "upload" && /_my ref\.png$/.test(rr.st.upload.name), rr);
      await ev(() => { ImgUpscalePanel.close(); refs.pop(); renderTray(); });
    } else { fail++; console.log("FAIL: the reference-dock picture could not be set up: " + refOk); }

    // ── ▶ the score ──
    await ev(() => document.querySelector('button[data-mutab="sheet"]').click());
    await p.waitForFunction(() => document.querySelector("#muScoreList option[value]") && window.MuScore.state.listed, null, { timeout: 15000 }).catch(() => {});
    await sleep(800);
    await ev(() => MuScore.refresh());
    await p.selectOption("#muScoreList", ABC);
    await p.waitForFunction((n) => document.getElementById("muSheetStatus").textContent.indexOf(n) >= 0 && MuScore.player(), ABC, { timeout: 15000 }).catch(() => {});
    await sleep(500);
    const s0 = await ev(() => ({ sound: [...document.getElementById("muPlaySound").options].map((o) => o.value + ":" + o.textContent), time: document.getElementById("muPlayTime").textContent,
      on: [...document.querySelectorAll("#muPlayBar [data-act]")].every((x) => !x.disabled), heads: document.querySelectorAll("#muScore path[data-n]").length, mode: MuScore.player().mode,
      listed: [...document.getElementById("muScoreList").options].some((o) => /^🎵 E2E-Play733/.test(o.textContent)) }));
    check("the score with a song beside it: 🎵 in the list, Sound = the song (its file) or the notes, the five buttons on, 0:00 / 0:12, each note head numbered (a chord's three heads share one)",
      s0.sound[0] === "song:🎵 the song (" + WAV + ")" && s0.sound[1] === "synth:🎹 the notes" && s0.on && s0.mode === "song" && /^0:00 \/ 0:1[12]$/.test(s0.time) && s0.heads === 28 && s0.listed, s0);
    await ev(() => document.querySelector('#muPlayBar [data-act="toggle"]').click());
    await sleep(2200);
    const s1 = await ev(() => ({ time: document.getElementById("muPlayTime").textContent, bar: document.getElementById("muPlayBarNo").textContent, lit: [...document.querySelectorAll("#muScore path.abcOn")].map((x) => +x.getAttribute("data-n")),
      band: +document.querySelector("#muScore .abcBar").getAttribute("width"), btn: (document.getElementById("muPlayToggle").dataset.icon === "pause" ? "⏸" : "▶"), pos: MuScore.player().position() }));
    const T = await ev(() => MuScore.state.result.timing);
    const want = (sec) => T.notes.filter((n) => n.t0 <= sec * 960 && sec * 960 < n.t1).map((n) => n.id);
    check("▶ plays the song: the time runs, ⏸ shows, bar 2 of 4 (120 bpm = 2 s a bar), its band drawn, the notes sounding lit (and only they)",
      s1.pos > 1.5 && /^0:0[2-3]/.test(s1.time) && s1.btn === "⏸" && /^bar [12] \/ 4$/.test(s1.bar) && s1.band > 20 && s1.lit.length >= 1 && s1.lit.length <= 3
      && s1.lit.every((id) => want(s1.pos - 0.3).includes(id) || want(s1.pos).includes(id) || want(s1.pos + 0.3).includes(id)), s1);
    await ev(() => document.querySelector('#muPlayBar [data-act="toggle"]').click());
    await ev(() => MuScore.player().seek(0.1));
    await ev(() => document.querySelector('#muPlayBar [data-act="fwd"]').click());
    const f1 = await ev(() => ({ bar: document.getElementById("muPlayBarNo").textContent, pos: MuScore.player().position(), btn: (document.getElementById("muPlayToggle").dataset.icon === "pause" ? "⏸" : "▶") }));
    await ev(() => document.querySelector('#muPlayBar [data-act="fwd"]').click());
    await ev(() => document.querySelector('#muPlayBar [data-act="back"]').click());
    const f2 = await ev(() => ({ bar: document.getElementById("muPlayBarNo").textContent, pos: MuScore.player().position() }));
    check("⏸ pauses (▶ again); ⏩ = the next bar (bar 2 at 2.0 s), ⏩ ⏪ = back to bar 2's start", f1.btn === "▶" && f1.bar === "bar 2 / 4" && Math.abs(f1.pos - 2) < 0.01
      && f2.bar === "bar 2 / 4" && Math.abs(f2.pos - 2) < 0.01, { f1, f2 });
    await ev(() => document.querySelector('#muPlayBar [data-act="end"]').click());
    const e1 = await ev(() => ({ time: document.getElementById("muPlayTime").textContent, lit: document.querySelectorAll("#muScore path.abcOn").length, bar: document.getElementById("muPlayBarNo").textContent }));
    await ev(() => document.querySelector('#muPlayBar [data-act="start"]').click());
    const e2 = await ev(() => ({ time: document.getElementById("muPlayTime").textContent, pos: MuScore.player().position(), lit: [...document.querySelectorAll("#muScore path.abcOn")].map((x) => +x.getAttribute("data-n")) }));
    check("⏭ = the end (nothing lit, no bar); ⏮ = 0:00 with the first notes lit", /^0:1[12] \/ 0:1[12]$/.test(e1.time) && e1.lit === 0 && e1.bar === "bar –" && e2.time.startsWith("0:00") && e2.pos === 0
      && e2.lit.length >= 1 && e2.lit.every((id) => T.notes[id].t0 === 0), { e1, e2 });
    const n12 = T.notes.find((n) => n.bar === 2 && n.v === 0);
    await ev((id) => document.querySelector(`#muScore path[data-n="${id}"]`).dispatchEvent(new MouseEvent("click", { bubbles: true })), n12.id);
    const c1 = await ev(() => ({ bar: document.getElementById("muPlayBarNo").textContent, pos: MuScore.player().position() }));
    check("a click on a note in bar 3 jumps there (4.0 s)", c1.bar === "bar 3 / 4" && Math.abs(c1.pos - 4) < 0.01, c1);
    await ev(() => { const s = document.getElementById("muPlaySync"); s.value = "1.5"; s.dispatchEvent(new Event("change", { bubbles: true })); MuScore.player().seek(0); });
    const y1 = await ev((n) => ({ pos: MuScore.player().position(), saved: JSON.parse(localStorage.getItem("h3.muScoreSync") || "{}")[n], bar: document.getElementById("muPlayBarNo").textContent }), ABC);
    check("Sync 1.5 s: the song's first 1.5 s are before bar 1 (the clock moves with it), remembered for this score", Math.abs(y1.pos) < 0.01 && y1.saved === 1.5 && y1.bar === "bar 1 / 4", y1);
    await ev(() => { MuScore.player().seek(-1.5); });
    const y2 = await ev(() => ({ bar: document.getElementById("muPlayBarNo").textContent, a: MuScore.player().audio.currentTime }));
    check("…the song's start (0 s) is 1.5 s before bar 1: no bar, nothing lit", y2.bar === "bar –" && y2.a < 0.01, y2);
    await ev(() => { const s = document.getElementById("muPlaySync"); s.value = "0"; s.dispatchEvent(new Event("change", { bubbles: true })); });
    // the notes, no song
    await p.selectOption("#muPlaySound", "synth");
    await sleep(200);
    await ev(() => MuScore.player().seek(0));
    await ev(() => document.querySelector('#muPlayBar [data-act="toggle"]').click());
    await sleep(1500);
    const sy = await ev(() => ({ mode: MuScore.player().mode, playing: MuScore.player().playing(), pos: MuScore.player().position(), lit: document.querySelectorAll("#muScore path.abcOn").length, sync: document.getElementById("muPlaySyncL").classList.contains("hidden") }));
    check("🎹 the notes: played by the browser (no song), the clock runs, notes lit, no Sync", sy.mode === "synth" && sy.playing && sy.pos > 1 && sy.lit >= 1 && sy.sync, sy);
    // ⛶ Read has the same
    await ev(() => MuScore.openView());
    await sleep(500);
    const v = await ev(() => ({ btns: [...document.querySelectorAll("#muSvPlay [data-act]")].map((x) => x.getAttribute("data-act")), lit: document.querySelectorAll("#muSvPages path.abcOn").length,
      toggle: (document.getElementById("muSvToggle").dataset.icon === "pause" ? "⏸" : "▶"), time: document.getElementById("muSvTime").textContent }));
    check("⛶ Read: the same five buttons, ⏸ while it plays, the time, the notes lit there too", v.btns.join() === "start,back,toggle,fwd,end" && v.toggle === "⏸" && v.lit >= 1 && /^0:0\d \/ 0:/.test(v.time), v);
    await ev(() => document.querySelector('#muSvPlay [data-act="toggle"]').click());
    const v2 = await ev(() => ({ playing: MuScore.player().playing(), t: (document.getElementById("muSvToggle").dataset.icon === "pause" ? "⏸" : "▶") }));
    check("…its ⏸ pauses", !v2.playing && v2.t === "▶", v2);
    await ev(() => document.getElementById("muScoreView").close());
    // a score with no song: the notes only
    await ev(() => MuScore.show("X:1\nT:No Song\nL:1/4\nK:C\nC D E F|]\n", "no-song.abc", "📂 "));
    const ns = await ev(() => ({ sound: [...document.getElementById("muPlaySound").options].map((o) => o.value), mode: MuScore.player().mode, time: document.getElementById("muPlayTime").textContent }));
    check("a score with no song beside it (📂 Open .abc): only 🎹 the notes, 0:00 / 0:02 (120 bpm, no tempo given)", ns.sound.join() === "synth" && ns.mode === "synth" && ns.time === "0:00 / 0:02", ns);
    check("no page errors", errs.length === 0, errs);
  } catch (e) {
    fail++; console.log("FAIL: the test crashed: " + (e && e.stack || e));
  } finally {
    await b.close();
    for (const f of made) { try { fs.unlinkSync(f); } catch { /* gone */ } }
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
