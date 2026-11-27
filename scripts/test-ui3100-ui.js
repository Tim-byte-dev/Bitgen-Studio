#!/usr/bin/env node
/* bitGen Studio — 3.1.0 in a REAL browser: the Edit Booth's 💾 Save song (Tim: "add a button to edit booth timeline to save as
 * mp3 or wav. compile all the layers into a song") - every layer mixed, through the real /api/synth/song + ffmpeg. Against the running app (H3_URL). */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  if (!chromium) { console.log("SKIP: playwright is not installed here"); console.log("\nRESULT: 0 passed, 0 failed"); return; }
  const b = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
  const p = await (await b.newContext({ viewport: { width: 1500, height: 1000 } })).newPage();
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  const tl = () => ev(() => window.H3SynthTL.tl());
  const madeFiles = [];
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => window.H3Synth && window.H3SynthMix && window.H3SynthClick && typeof dsReady !== "undefined" && dsReady, null, { timeout: 60000 });
    await ev(() => { Object.keys(localStorage).filter((k) => /^h3\.synth\./.test(k)).forEach((k) => localStorage.removeItem(k)); });
    await p.reload({ waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => window.H3Synth && window.H3SynthTL && typeof dsReady !== "undefined" && dsReady && document.querySelector("#synthdock .autabs"), null, { timeout: 60000 });
    await ev(() => { window.H3Audio.tab("synthdock"); window.toggleMax("synthdock", true); window.H3Synth.fold("rack", true); window.H3Synth.fold("keys", true); window.H3Synth.fold("loop", true); }); await sleep(600);
    await p.click("#syBody", { position: { x: 900, y: 6 } });
    await ev(async () => { window.H3SynthTL.setTL(null); await window.H3SynthTL.addClip("kit:crash", 0, 0); await window.H3SynthTL.addClip("kit:boom", 1, 0.25); });
    const made = [];
    await p.click("#sySong"); await sleep(150);
    const box = await ev(() => ({ shown: document.getElementById("sySongBox").style.display !== "none", fmt: document.getElementById("sySongFmt").value, dl: document.getElementById("sySongDl").checked, focus: document.activeElement && document.activeElement.id }));
    check("💾 Save song opens its row: a name (focused), MP3 by default, ⬇ a copy ticked", box.shown && box.fmt === "mp3" && box.dl && box.focus === "sySongName", box);
    await p.fill("#sySongName", "ui3100 my song"); await p.uncheck("#sySongDl");
    const r1 = p.waitForResponse((r) => r.url().endsWith("/api/synth/song"), { timeout: 60000 });
    await p.click("#sySongGo");
    const j = await (await r1).json(); made.push(j.name, j.gallery);
    await p.waitForFunction(() => /💾 .* is in the Sound assets/.test((document.getElementById("syMsg") || document.body).textContent), null, { timeout: 30000 });
    check("…Save: every layer mixed into ONE MP3 in the Sound assets + the gallery (both layers' 2.3 s), the row closed", j.ok && j.name === "ui3100 my song.mp3" && j.format === "mp3" && j.gallery === "song_ui3100 my song.mp3" && j.seconds > 1.5 && (await ev(() => document.getElementById("sySongBox").style.display)) === "none", j);
    // the mix has BOTH layers: layer 2 (boom at 0.25 s) heard after layer 1 alone has ended? - the song's length is the timeline's
    const tlEnd = await ev(() => window.H3SynthTL.render(48000).then((r) => r.seconds));
    check("…as long as the timeline (all its layers)", Math.abs(j.seconds - tlEnd) < 0.2, { song: j.seconds, tl: tlEnd });
    const got = await ev((u) => fetch(u).then((r) => r.ok ? r.arrayBuffer().then((x) => x.byteLength) : 0), j.url);
    check("…the gallery serves it (/outputs/song_…)", got > 5000, got);
    await p.click("#sySong"); await ev(() => { document.getElementById("sySongFmt").value = "wav"; });
    const r2 = p.waitForResponse((r) => r.url().endsWith("/api/synth/song"), { timeout: 60000 });
    await p.click("#sySongGo"); const j2 = await (await r2).json(); made.push(j2.name, j2.gallery);
    check("WAV: the same song as a 16-bit WAV (a second name - nothing overwritten); MP3 / WAV kept for next time", j2.ok && j2.name === "ui3100 my song.wav" && j2.format === "wav" && (await ev(() => localStorage.getItem("h3.synth.song.fmt"))) === "wav", j2);
    await ev(() => { window.__madeSongs = []; });
    madeFiles.push.apply(madeFiles, []); global.__made = made;
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: the test stopped - " + (e && e.stack || e)); }
  finally {
    try {
      for (const n of (global.__made || [])) for (const k of ["sound", "output"]) { const d = path.join(__dirname, "..", "projects"); for (const pr of require("fs").readdirSync(d)) { const f = path.join(d, pr, k, n || ""); if (n && require("fs").existsSync(f)) require("fs").unlinkSync(f); } }
      for (const n of madeFiles) { await ev((nm) => fetch("/api/synth/files/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: nm }) }), n);
        await ev((nm) => fetch("/api/synth/samples/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: nm.replace(/\.sfx$/, ".wav") }) }), n); }
      await ev(() => { Object.keys(localStorage).filter((k) => /^h3\.synth\./.test(k)).forEach((k) => localStorage.removeItem(k)); });
    } catch (e) { /* gone */ }
    await b.close();
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
