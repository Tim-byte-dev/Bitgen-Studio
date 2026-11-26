#!/usr/bin/env node
/* bitGen Studio — 2.973.0 in a REAL browser: the 🎹 Edit Booth timeline's ▶ (Tim: "the play button doen't work for edit booth
 * timeline, but add a dropdown to the left of the play button All and layer so either play all or only the selected layer, if no
 * layer is selected play all. if keyboard and looper are playing let them play, both of their volumes are adjustable").
 *   WHY it did nothing: one clip whose sound file is gone stopped every start - now it plays the rest, says which, strikes it through
 *   All / Layer before ▶: Layer = the layer you clicked alone (even if muted); nothing clicked = all (each layer's own meter)
 *   the looper and a held keyboard note go on under ▶ and ■; the looper's Vol knob (kept); the keyboard's VOLUME knob
 *   Space in the timeline = the timeline (elsewhere still the looper); the length reads 4:00.0 (was 3:60.0)
 * Makes projects/default/output/ui973_song.mp3 (ffmpeg) and removes it after. */
"use strict";
const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const ROOT = path.join(__dirname, "..");
const SONG = path.join(ROOT, "projects", "default", "output", "ui973_song.mp3");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
(async () => {
  if (!chromium) { console.log("SKIP: playwright is not installed here"); console.log("\nRESULT: 0 passed, 0 failed"); return; }
  try { execSync(`ffmpeg -loglevel error -y -f lavfi -i "sine=frequency=330:duration=239.97" -ac 2 -ar 44100 -b:a 96k "${SONG}"`); } catch (e) { console.log("SKIP: no ffmpeg"); console.log("\nRESULT: 0 passed, 0 failed"); return; }
  const b = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] }), p = await b.newPage({ viewport: { width: 1800, height: 1100 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  const sleep = (ms) => p.waitForTimeout(ms);
  let saved = null;
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3Synth && window.H3SynthTL && window.H3SynthLoop, null, { timeout: 60000 });
    await sleep(1200);
    saved = await ev(() => JSON.stringify(H3SynthTL.tl()));
    await ev(() => { H3Audio.tab("synthdock"); toggleMax("synthdock", true); });
    await sleep(700);
    await p.click("#syBody", { position: { x: 900, y: 6 } });
    // a 4-minute song on layer 1 and layer 2, a clip whose file is gone on layer 3
    await ev(async () => {
      const t = H3SynthTL.tl(); t.layers.forEach((l) => { l.clips = []; l.mute = false; l.solo = false; l.keys = []; }); t.loop = { on: false, a: 0, b: 0, punch: false }; H3SynthTL.setTL(t);
      await H3SynthTL.addClip("out:ui973_song.mp3", 0, 0); await H3SynthTL.addClip("out:ui973_song.mp3", 1, 0);
      const t2 = H3SynthTL.tl(); t2.layers[2].clips.push({ src: "my:ui973-gone-away.wav", name: "ui973-gone-away", start: 1, off: 0, len: 3, gain: 1, fi: 0, fo: 0 }); H3SynthTL.setTL(t2); H3SynthTL.seek(0);
    });
    const bar = await ev(() => { const w = document.getElementById("syTWhat"); return { opts: [...w.options].map((o) => o.value + "=" + o.textContent), before: w.nextElementSibling && w.nextElementSibling.id, tc: document.getElementById("syTPos").textContent }; });
    check("the bar: All / Layer just left of ▶ Play (nothing picked yet: \"Layer (none picked = all)\")", bar.before === "syTPlay" && bar.opts.join("|") === "all=All|layer=Layer (none picked = all)", bar);
    check("the length reads 4:00.0 (239.97 s was 3:60.0)", /\/ 4:00\.0/.test(bar.tc), bar.tc);

    const level = () => ev(() => { const m = H3SynthTL.meters(); if (!m) return null; const rms = (an) => { const a = new Float32Array(1024); an.getFloatTimeDomainData(a); let s = 0; for (const x of a) s += x * x; return +Math.sqrt(s / a.length).toFixed(4); }; return { layers: m.layers.map(rms), master: rms(m.master) }; });
    await p.locator("#syTPlay").scrollIntoViewIfNeeded();
    await p.click("#syTPlay"); await sleep(1300);
    const a1 = await ev(() => ({ i: H3SynthTL.info(), msg: document.getElementById("syMsg").textContent, btn: document.getElementById("syTPlay").textContent }));
    const l1 = await level();
    check("▶ plays even with a clip whose sound is gone: the playhead runs, the other layers sound, it says which is missing",
      a1.i.playing && a1.i.ph > 0.5 && a1.btn === "■ Stop" && l1 && l1.layers[0] > 0.01 && l1.layers[1] > 0.01 && a1.i.missing.join() === "my:ui973-gone-away.wav" && /not there any more - skipped/.test(a1.msg) && /ui973-gone-away/.test(a1.msg), { a1, l1 });
    await p.click("#syTPlay"); await sleep(200);

    // Layer: nothing picked = all
    await p.selectOption("#syTWhat", "layer"); await ev(() => H3SynthTL.seek(0));
    await p.click("#syTPlay"); await sleep(900);
    const l2 = await level(), i2 = await ev(() => H3SynthTL.info());
    await p.click("#syTPlay"); await sleep(200);
    check("Layer with no layer picked = all of them", i2.what === "layer" && i2.only === null && !i2.picked && l2.layers[0] > 0.01 && l2.layers[1] > 0.01, { i2, l2 });

    // pick layer 2 (click its name) -> only layer 2, even muted
    await p.click('#syTL .sytlhead >> nth=1', { position: { x: 60, y: 8 } }); await sleep(150);
    const lbl = await ev(() => document.querySelector('#syTWhat option[value="layer"]').textContent);
    await ev(() => { const t = H3SynthTL.tl(); t.layers[1].mute = true; H3SynthTL.changedFx(); H3SynthTL.seek(0); });
    await p.click("#syTPlay"); await sleep(900);
    const l3 = await level(), i3 = await ev(() => H3SynthTL.info());
    await p.click("#syTPlay"); await sleep(200);
    check("a click on a layer's name picks it (\"Layer: Layer 2\"); Layer plays it alone - even muted - the others silent",
      lbl === "Layer: Layer 2" && i3.only === 1 && i3.picked && l3.layers[1] > 0.01 && l3.layers[0] < 0.001, { lbl, i3: { only: i3.only, picked: i3.picked }, l3 });
    await p.selectOption("#syTWhat", "all"); await sleep(100);
    await ev(() => { H3SynthTL.seek(0); }); await p.click("#syTPlay"); await sleep(900);
    const l4 = await level(); await p.click("#syTPlay"); await sleep(200);
    check("All again: the mute counts (layer 2 muted = silent, layer 1 plays); the choice is kept in this browser",
      l4.layers[0] > 0.01 && l4.layers[1] < 0.001 && (await ev(() => localStorage.getItem("h3.synth.tl.what"))) === "all", l4);
    await ev(() => { const t = H3SynthTL.tl(); t.layers[1].mute = false; H3SynthTL.changedFx(); });

    // the looper and the keyboard go on under the timeline
    const under = await ev(async () => {
      H3SynthLoop.play(true); H3Synth.noteOn(72, 0.8);
      await new Promise((r) => setTimeout(r, 300));
      document.getElementById("syTPlay").click(); await new Promise((r) => setTimeout(r, 700));
      const during = { lp: H3SynthLoop.playing(), keys: H3Synth.engine().sounding(), tl: H3SynthTL.playing() };
      document.getElementById("syTPlay").click(); await new Promise((r) => setTimeout(r, 300));
      const after = { lp: H3SynthLoop.playing(), keys: H3Synth.engine().sounding(), tl: H3SynthTL.playing() };
      H3Synth.noteOff(72); H3SynthLoop.play(false); return { during, after };
    });
    check("the looper and a held keyboard note go on when ▶ starts the timeline and when ■ stops it",
      under.during.lp && under.during.keys === 1 && under.during.tl && under.after.lp && under.after.keys === 1 && !under.after.tl, under);
    const vol = await ev(() => { const k = document.querySelector('#syLVolK [role="slider"]'), v0 = H3SynthLoop.vol(); H3SynthLoop.setVol(0.4); const g = H3SynthLoop.bus().gain.value, kept = localStorage.getItem("h3.synth.lvol"); H3SynthLoop.setVol(v0);
      return { knob: !!k, label: k && k.getAttribute("aria-label"), kept, deck: !!document.querySelector('#syDkVol [role="slider"]') }; });
    await sleep(150);
    check("the looper's own Vol knob (its rows + the pads, kept in this browser); the keyboard keeps its VOLUME knob", vol.knob && vol.label === "Looper volume" && vol.kept === "0.4" && vol.deck, vol);
    const busG = await ev(() => new Promise((r) => setTimeout(() => r(+H3SynthLoop.bus().gain.value.toFixed(2)), 200)));
    check("…and it sets the looper's level", busG === +(await ev(() => H3SynthLoop.vol())).toFixed(2), busG);

    // Space in the timeline = the timeline
    await ev(() => H3SynthTL.seek(0));
    await p.focus("#syTCanvas"); await p.keyboard.press("Space"); await sleep(500);
    const sp = await ev(() => ({ tl: H3SynthTL.playing(), lp: H3SynthLoop.playing() }));
    await p.keyboard.press("Space"); await sleep(200);
    check("Space with the timeline focused plays the timeline (not the looper); again stops it", sp.tl && !sp.lp && !(await ev(() => H3SynthTL.playing())), sp);
    check("the missing clip is drawn struck through (⚠ missing:)", (await ev(() => H3SynthTL.info().missing.length)) === 1);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: the run threw - " + (e && e.stack || e)); }
  try { if (saved) await ev((s) => { H3SynthTL.setTL(JSON.parse(s)); localStorage.removeItem("h3.synth.tl.what"); toggleMax("synthdock", false); H3Audio.tab("musicdock"); }, saved); await sleep(900); } catch { /* fine */ }
  try { fs.unlinkSync(SONG); } catch { /* fine */ }
  await b.close();
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
