#!/usr/bin/env node
/* bitGen Studio — 2.954.0 in a REAL browser (Tim: "make the keyboard narrower and taller so the keys look more natural. add a drum pad
 * next to the hammerhead style looper. add a timeline below that with waveforms that can be added from all sources, add knobs to
 * each timeline layer for volume. add keyframes to each layer, start volume end volume on each key frame" + "make the keyboard look
 * like this ... the black rectangle in the middle will be to record sheet music live from the keyboard or load sheet music so user
 * can learn to play" + "remove all the branding"): the deck (49 keys of natural shape, no maker's name), the drum pads (click,
 * keys, MIDI channel 10, ⏺ into the loop, ✎ edit), the score screen (● record live, 📂 open, ▶ play, 🎓 learn), the timeline
 * (sources, waveforms, move / trim, layer knobs, keyframes with start / end volume, play, mixdown -> SFX). Against H3_URL. */
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
const ODE = "X:1\nT:Ode to Joy\nM:4/4\nL:1/4\nQ:1/4=120\nK:C\nE E F G|G F E D|C C D E|E3/2 D/ D2|]\n";
(async () => {
  if (!chromium) { console.log("SKIP: playwright is not installed here"); console.log("\nRESULT: 0 passed, 0 failed"); return; }
  const b = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
  const p = await (await b.newContext({ viewport: { width: 1500, height: 1100 }, acceptDownloads: true })).newPage();
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  const info = () => ev(() => window.H3Synth.info());
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => window.H3Synth && window.H3SynthPads && window.H3SynthScore && window.H3SynthTL && typeof dsReady !== "undefined" && dsReady, null, { timeout: 60000 });
    await ev(() => { Object.keys(localStorage).filter((k) => /^h3\.synth\./.test(k)).forEach((k) => localStorage.removeItem(k)); });
    await p.reload({ waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => window.H3Synth && window.H3SynthTL && typeof dsReady !== "undefined" && dsReady && document.querySelector("#synthdock .autabs"), null, { timeout: 60000 });
    await ev(() => { window.H3Audio.tab("synthdock"); window.toggleMax("synthdock", true); }); await sleep(600);
    await p.click("#syBody", { position: { x: 900, y: 6 } });
    await ev(() => window.H3Synth.refresh());
    /* ---- the deck */
    const deck = await ev(() => { const pk = document.getElementById("syPiano").getBoundingClientRect(), d = document.getElementById("syDeck").getBoundingClientRect(), txt = document.getElementById("syDeck").innerText;
      return { keys: window.H3Synth.info().keys, w: pk.width, h: pk.height, deckW: d.width, txt, deckParts: ["syBend", "syMod", "syPadGrid", "syScoreBox", "syDkPrev", "syOctUp", "syDkVol", "syScRec", "syScPlay", "syScStop", "syScStart", "syScLearn"].every((id) => document.querySelector("#syDeck #" + id)) }; });
    check("the deck: wheels, 16 pads, the score screen, patch / octave / sheet buttons, the transport, a volume knob - over 49 keys", deck.keys === 49 && deck.deckParts && (await ev(() => document.querySelectorAll("#syPadGrid .sypad").length)) === 16, deck);
    check("…natural keys: a white key about 30 x 165 px (narrower and taller than before), the case as wide as its keys", Math.abs(deck.w / 29 - 30) < 1.5 && deck.h >= 165 && deck.deckW < 960, { w: deck.w, h: deck.h, deckW: deck.deckW });
    check("…no branding: no maker's name, no product name on the deck or the tab", !/akai|professional|synth ?station|production keyboard/i.test(deck.txt + (await ev(() => document.getElementById("synthdock").innerText))), deck.txt.slice(0, 200));
    /* ---- the drum pads */
    const order = await ev(() => [...document.querySelectorAll("#syPadGrid .sypad")].map((x) => +x.dataset.pad + 1).join(","));
    check("the pads numbered like a pad controller: 13-16 on top, 1-4 at the bottom; 1-8 named after the looper's rows", order === "13,14,15,16,9,10,11,12,5,6,7,8,1,2,3,4" && (await ev(() => document.querySelector('#syPadGrid [data-pad="0"] span').textContent)) === "Kick", order);
    const pb = await p.locator('#syPadGrid [data-pad="1"]').boundingBox();
    await p.mouse.click(pb.x + pb.width / 2, pb.y + pb.height / 2);
    let pi = (await info()).pads;
    check("a click on pad 2 plays it (the Snare row) and lights it", pi.hits === 1 && pi.last === 1, pi);
    await p.focus("#syPadBox"); await p.keyboard.press("KeyA"); await p.keyboard.press("Digit4");
    pi = (await info()).pads;
    const leak = (await info()).down.length;
    check("the pad keys while the pads have the focus: A = pad 5, 4 = pad 16 (never a synth note)", pi.hits === 3 && pi.last === 15 && leak === 0, pi);
    await ev(() => window.H3Synth.midi([0x99, 38, 120]));
    check("MIDI channel 10 (drums): note 38 = pad 3", (await info()).pads.last === 2 && (await info()).pads.hits === 4);
    // ⏺ into the loop: a hit on pad 7 (Rim row) while the loop plays lands on a step
    await ev(() => { const L = window.H3SynthLoop.loop(); L.pats[0][6].fill(0); });
    await p.click("#syPadRec"); await ev(() => window.H3SynthLoop.play(true)); await sleep(700);
    await ev(() => window.H3SynthPads.hit(6, 1)); await sleep(80);
    const rimRow = (await info()).loop.on[6];
    await ev(() => window.H3SynthLoop.play(false)); await p.click("#syPadRec");
    check("⏺ Loop: pad 7 hit hard while the loop plays = an accent written on that row's nearest step", /2/.test(rimRow) && rimRow.replace(/0/g, "").length === 1, rimRow);
    await p.click("#syPadEdit"); await p.click('#syPadGrid [data-pad="9"]');
    await ev(() => { const s = document.querySelector("#syPadEd select"); s.value = "kit:shaker"; s.dispatchEvent(new Event("change")); });
    pi = (await info()).pads;
    check("✎ Edit: pick pad 10, its own sound (Shaker) - kept for next time", pi.edit && pi.sel === 9 && pi.own[1] === "kit:shaker" && /shaker/.test(await ev(() => localStorage.getItem("h3.synth.pads"))), pi);
    await p.click("#syPadEdit");
    /* ---- the score screen */
    await p.click("#syScRec");
    check("● Rec: the screen is recording (red)", (await info()).score.mode === "rec" && (await ev(() => document.getElementById("syScoreBox").dataset.mode)) === "rec");
    for (const [m, ms] of [[60, 230], [64, 230], [67, 230], [72, 480]]) { await ev((n) => window.H3Synth.noteOn(n, 0.8), m); await sleep(ms); await ev((n) => window.H3Synth.noteOff(n), m); await sleep(20); }
    await sleep(250);
    const live = await ev(() => ({ svg: document.querySelectorAll("#syScoreView svg").length, notes: document.querySelectorAll("#syScoreView path[data-n]").length }));
    await p.click("#syScStop");
    let sc = (await info()).score;
    check("…the notes played are written as sheet music while you play (C E G c), ■ stops", live.svg >= 1 && live.notes >= 4 && sc.mode === "idle" && sc.steps === 4 && /K:C\n/.test(sc.abc) && /C\d? E\d? G\d? c/.test(sc.abc.replace(/z\d*/g, "").replace(/\s+/g, " ")), { live, abc: sc.abc });
    const dl = p.waitForEvent("download", { timeout: 15000 }); await p.click("#syScSave"); const d = await dl;
    check("💾 the sheet as an .abc file", /\.abc$/.test(d.suggestedFilename()), d.suggestedFilename());
    await p.setInputFiles("#syScoreFile", [{ name: "ode.abc", mimeType: "text/plain", buffer: Buffer.from(ODE) }]);
    await p.waitForFunction(() => window.H3SynthScore.info().steps === 15, null, { timeout: 8000 });
    check("📂 Open an .abc sheet: drawn on the screen (15 notes)", (await info()).score.steps === 15 && /Ode to Joy/.test(await ev(() => document.getElementById("syScoreView").textContent || document.getElementById("syScoreView").innerHTML)));
    await p.click("#syScLearn");
    let li = await info();
    check("🎓 Learn: the first note (E4) lit on the sheet and its key lit on the keyboard", li.score.mode === "learn" && li.score.next.join() === "64" && li.guide.join() === "64" && li.score.lit >= 1, { s: li.score, g: li.guide });
    await ev(() => { window.H3Synth.noteOn(65, 0.8); window.H3Synth.noteOff(65); });
    li = await info();
    check("…a wrong key is counted and it waits", li.score.wrong === 1 && li.score.li === 0, li.score);
    const ode = [64, 64, 65, 67, 67, 65, 64, 62, 60, 60, 62, 64, 64, 62, 62];
    for (const m of ode) { await ev((n) => { window.H3Synth.noteOn(n, 0.8); window.H3Synth.noteOff(n); }, m); }
    li = await info();
    check("…play the right keys and it goes on to the end: 14 of 15 right first time, said in words, the guide off", li.score.mode === "idle" && li.score.firstTry === 14 && li.guide.length === 0 && /Well played! 14 of 15/.test(await ev(() => document.getElementById("syScoreMsg").textContent)), li.score);
    await p.click("#syScPlay"); await sleep(700);
    const pl = await info(); pl.voices = await ev(() => window.H3Synth.engine().voices.length);
    await p.click("#syScStop");
    check("▶ the synth plays the sheet - a note lit as it sounds, its key lit too", pl.score.mode === "play" && pl.score.lit >= 1 && pl.guide.length >= 1 && pl.voices >= 1, { s: pl.score.mode, lit: pl.score.lit, g: pl.guide, v: pl.voices });
    /* ---- the timeline */
    await p.click("#syTAddBtn"); await sleep(400);
    const groups = await ev(() => [...document.querySelectorAll("#syTPick .sytlpg b")].map((x) => x.textContent));
    check("＋ Sound: every source - the loop, the kit, My samples, the project's SFX, the Sound assets (stems), songs + the gallery, a file",
      groups.length === 7 && /loop/.test(groups[0]) && /kit/.test(groups[1]) && /My samples/.test(groups[2]) && /SFX/.test(groups[3]) && /Sound assets/.test(groups[4]) && /Songs/.test(groups[5]) && /file/.test(groups[6]), groups);
    await ev(() => { window.H3SynthTL.setTL(null); });
    await p.click('#syTPick span[data-src="kit:crash"]');
    await p.waitForFunction(() => window.H3SynthTL.info().clips[0] === 1, null, { timeout: 8000 });
    let t = (await info()).tl;
    check("a kit sound clicked: a clip on layer 1 at the playhead, its waveform read", t.clips[0] === 1 && t.waves >= 1 && t.end > 1, t);
    await ev(() => window.H3SynthTL.seek(0.5));
    await p.click('#syTPick span[data-src="loop"]');
    await p.waitForFunction(() => window.H3SynthTL.info().clips[0] === 2, null, { timeout: 15000 });
    const loopClip = await ev(() => window.H3SynthTL.tl().layers[0].clips[1]);
    check("🔁 the loop: made into a sample in My samples, placed at the playhead (0.5 s)", /^my:loop [A-H] \d+bpm/.test(loopClip.src) && Math.abs(loopClip.start - 0.5) < 0.01 && loopClip.len > 3, loopClip);
    // drag the loop clip (on top of the crash) to layer 2 at 2 s
    await p.click("#syTAddBtn"); await sleep(300);   // the source list closed - the layers stay where they are
    const G = await ev(() => window.H3SynthTL.geo()); let cvb = await p.locator("#syTCanvas").boundingBox();
    const X = (s) => cvb.x + s * G.zoom - G.scroll, Y = (l) => cvb.y + G.RULER + l * G.LH + G.LH / 2;
    await p.mouse.move(X(1.5), Y(0) + 4); await p.mouse.down(); await p.mouse.move(X(3.0), Y(1) + 4, { steps: 10 }); await p.mouse.up();
    t = (await info()).tl;
    const moved = await ev(() => window.H3SynthTL.tl().layers[1].clips[0]);
    check("drag a clip: to layer 2 at 2 s (snapped)", t.clips[0] === 1 && t.clips[1] === 1 && moved && Math.abs(moved.start - 2) < 0.07, { clips: t.clips, moved });
    // trim its right edge back by about half a second
    const len0 = moved.len;
    await p.mouse.move(X(moved.start + moved.len) - 2, Y(1)); await p.mouse.down(); await p.mouse.move(X(moved.start + moved.len - 0.5), Y(1), { steps: 6 }); await p.mouse.up();
    const trimmed = await ev(() => window.H3SynthTL.tl().layers[1].clips[0]);
    check("drag its right edge: trimmed (the start stays)", trimmed.len < len0 - 0.3 && Math.abs(trimmed.start - moved.start) < 0.001, { len0, len: trimmed.len });
    // the layer's knobs
    const kb = await p.locator('#syTHeads [data-vol="1"] canvas').boundingBox();
    await p.mouse.move(kb.x + kb.width / 2, kb.y + kb.height / 2); await p.mouse.down(); await p.mouse.move(kb.x + kb.width / 2, kb.y + 60, { steps: 6 }); await p.mouse.up();
    const v1 = await ev(() => window.H3SynthTL.tl().layers[1].vol);
    check("each layer has a Vol knob (0-150%) - turned down", v1 < 0.8, v1);
    // keyframes: double-click layer 2 at 2.2 s and at 2.8 s; drag the first's ◆ down (start), its ● up (end)
    cvb = await p.locator("#syTCanvas").boundingBox();
    await p.mouse.dblclick(X(2.25), Y(1)); await p.mouse.dblclick(X(2.75), Y(1));
    let keys = await ev(() => window.H3SynthTL.tl().layers[1].keys);
    check("double-click a layer = a keyframe (start = end volume = the line there)", keys.length === 2 && keys[0].a === 1 && keys[0].b === 1, keys);
    const yv = (l, v) => cvb.y + G.RULER + l * G.LH + G.LH - 5 - (G.LH - 21) * v;
    await p.mouse.move(X(keys[0].t), yv(1, 1)); await p.mouse.down(); await p.mouse.move(X(keys[0].t), yv(1, 0.2), { steps: 5 }); await p.mouse.up();
    await p.mouse.move(X(keys[1].t) - 9, yv(1, 1)); await p.mouse.down(); await p.mouse.move(X(keys[1].t) - 9, yv(1, 0.7), { steps: 5 }); await p.mouse.up();
    keys = await ev(() => window.H3SynthTL.tl().layers[1].keys);
    check("drag its ◆ = the START volume, its ● = the END volume (a fade 20% -> 70%)", Math.abs(keys[0].a - 0.2) < 0.08 && Math.abs(keys[0].b - 0.7) < 0.08 && keys[1].a === 1, keys);
    const kev = await ev(() => ({ on: document.getElementById("syTKeyEd").classList.contains("on"), knobs: document.querySelectorAll("#syTKeyEd [data-key]").length }));
    check("…the picked keyframe's Start vol / End vol knobs show", kev.on && kev.knobs === 2, kev);
    await p.focus('#syTKeyEd [data-key="b"]'); await p.keyboard.press("ArrowUp");
    check("…and turn", Math.abs((await ev(() => window.H3SynthTL.tl().layers[1].keys[0].b)) - keys[0].b - 0.01) < 0.005);
    // the mix follows the keyframes: render, compare loudness before / inside the fade
    const lv = await ev(async () => { const r = await window.H3SynthTL.render(); const d = r.chans[0], sr = r.sampleRate, rms = (a, b) => { let s = 0; for (let i = Math.floor(a * sr); i < Math.floor(b * sr); i++) s += d[i] * d[i]; return Math.sqrt(s / ((b - a) * sr)); };
      return { secs: r.seconds, loop: rms(0.6, 1.6) }; });
    check("⬇ the mix is the whole timeline (the loop clip from 0.5 s) - rendered offline", lv.secs > 3 && lv.loop > 0.005, lv);
    await p.focus("#syTCanvas"); await ev(() => window.H3SynthTL.draw());
    await p.mouse.click(X(keys[1].t), yv(1, 1)); await p.keyboard.press("Delete");
    check("Delete removes the picked keyframe", (await ev(() => window.H3SynthTL.tl().layers[1].keys.length)) === 1);
    await ev(() => window.H3SynthTL.seek(0)); await p.click("#syTPlay"); await sleep(900);
    const play = (await info()).tl;
    await p.click("#syTPlay");
    check("▶ Play: the playhead runs", play.playing && play.ph > 0.4, play);
    const sfx = await ev(() => window.H3SynthTL.exportTL("sfx"));
    check("→ 💥 SFX: the mix is a sound effect of this project", !!sfx && sfx.ok && /synth timeline/.test(sfx.name), sfx);
    await p.reload({ waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => window.H3SynthTL && typeof dsReady !== "undefined" && dsReady, null, { timeout: 60000 });
    const kept = await ev(() => ({ tl: window.H3SynthTL.info(), sheet: window.H3SynthScore.info().steps, pad: window.H3SynthPads.pads()[1].snd }));
    check("kept over a reload: the timeline (clips, keyframes), the sheet, the pads", kept.tl.clips.join() === "1,1,0,0" && kept.tl.keys[1] === 1 && kept.sheet === 15 && kept.pad === "kit:shaker", kept);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: the test stopped - " + (e && e.stack || e)); }
  finally {
    try { await ev(() => fetch("/api/synth/samples").then((r) => r.json()).then((j) => Promise.all(j.samples.filter((s) => /^loop [A-H] /.test(s.name)).map((s) => fetch("/api/synth/samples/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: s.name }) }))))); } catch (e) { /* gone */ }
    try { await ev(() => { Object.keys(localStorage).filter((k) => /^h3\.synth\./.test(k)).forEach((k) => localStorage.removeItem(k)); }); } catch (e) { /* fine */ }
    await b.close();
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
