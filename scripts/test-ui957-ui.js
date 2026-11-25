#!/usr/bin/env node
/* bitGen Studio — 2.957.0 in a REAL browser (Tim: "go with your suggestion" - a piano roll with note clips, clip editing - split,
 * duplicate, fades, crossfades, gain - and undo / redo across the Synth tab). Against the running app (H3_URL). */
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
  const made = [];
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => window.H3Synth && window.H3SynthRoll && window.H3SynthUndo && typeof dsReady !== "undefined" && dsReady, null, { timeout: 60000 });
    await ev(() => { Object.keys(localStorage).filter((k) => /^h3\.synth\./.test(k)).forEach((k) => localStorage.removeItem(k)); });
    await p.reload({ waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => window.H3Synth && window.H3SynthTL && typeof dsReady !== "undefined" && dsReady && document.querySelector("#synthdock .autabs"), null, { timeout: 60000 });
    await ev(() => { window.H3Audio.tab("synthdock"); window.toggleMax("synthdock", true); window.H3Synth.fold("rack", true); window.H3Synth.fold("loop", true); }); await sleep(600);
    await p.click("#syBody", { position: { x: 900, y: 6 } });
    await ev(() => { window.H3SynthTL.setTL(null); window.H3Synth.commit(); });
    /* ---- the keyboard's notes -> a note clip */
    await p.click("#syScRec"); await sleep(150);
    for (const [m, v] of [[60, 0.5], [64, 0.9], [67, 0.7]]) { await ev(([n, vv]) => window.H3Synth.noteOn(n, vv), [m, v]); await sleep(220); await ev((n) => window.H3Synth.noteOff(n), m); await sleep(30); }
    await p.click("#syScStop");
    await p.waitForFunction(() => window.H3SynthScore.take() && window.H3SynthScore.take().file, null, { timeout: 15000 });
    made.push((await ev(() => window.H3SynthScore.take().file)));
    check("● on the keyboard keeps the notes as played (pitch, timing, velocity); → 🎞 ♪ is on", JSON.stringify((await ev(() => window.H3SynthScore.notes())).map((n) => [n.m, n.v])) === "[[60,0.5],[64,0.9],[67,0.7]]" && !(await ev(() => document.getElementById("syScSendN").disabled)));
    await ev(() => window.H3SynthTL.seek(0.5)); await p.click("#syScSendN");
    await p.waitForFunction(() => window.H3SynthTL.tl().layers.some((l) => l.clips.some((c) => c.kind === "notes")), null, { timeout: 8000 });
    let T0 = await tl(), li = T0.layers.findIndex((l) => l.clips.some((c) => c.kind === "notes")), nc = T0.layers[li].clips[0];
    check("→ 🎞 ♪: a NOTE clip on a new layer (\"Keys notes\") at the playhead - 3 notes, the patch with it", T0.layers[li].name === "Keys notes" && nc.notes.length === 3 && nc.start === 0.5 && !!nc.patch && nc.notes[0].t === 0, { name: T0.layers[li].name, nc });
    // played by the synth: the mix of the timeline is not silent
    const lvl = await ev(async () => { const r = await window.H3SynthTL.render(); let m = 0; for (const v of r.chans[0]) m = Math.max(m, Math.abs(v)); return m; });
    check("…played by the synth (the mixdown sounds)", lvl > 0.02, lvl);
    /* ---- the piano roll */
    const ok = await ev((l) => window.H3SynthTL.openRoll(l, 0), li); await sleep(300);
    let ri = await ev(() => window.H3SynthRoll.info());
    check("double-click / 🎹: the piano roll opens with the clip's notes", ok && ri && ri.notes === 3 && !!(await ev(() => document.getElementById("syRollCv"))), ri);
    const cvb = await p.locator("#syRollCv").boundingBox();
    const X = (t) => cvb.x + ri.kw + t / (60 / ri.bpm) * ri.zx - ri.sx, Y = (m) => cvb.y + (ri.top - m) * ri.rh + ri.rh / 2;
    // draw a note (72 at beat 2), make it longer by dragging
    const beat = 60 / ri.bpm;
    await p.mouse.move(X(2 * beat + 0.01), Y(72)); await p.mouse.down(); await p.mouse.move(X(2.9 * beat), Y(72), { steps: 5 }); await p.mouse.up();
    let notes = await ev((l) => window.H3SynthTL.tl().layers[l].clips[0].notes, li);
    const n72 = notes.find((n) => n.m === 72);
    check("click an empty place = a note there (snapped to 1/16), dragged = longer", !!n72 && Math.abs(n72.t - 2 * beat) < 0.01 && n72.d > 0.5 * beat, n72);
    // move it up two semitones and a beat later
    await p.mouse.move(X(n72.t + 0.05), Y(72)); await p.mouse.down(); await p.mouse.move(X(n72.t + beat + 0.05), Y(74), { steps: 6 }); await p.mouse.up();
    notes = await ev((l) => window.H3SynthTL.tl().layers[l].clips[0].notes, li);
    const n74 = notes.find((n) => n.m === 74);
    check("drag a note = move it (pitch + time)", !!n74 && Math.abs(n74.t - 3 * beat) < 0.01 && !notes.some((n) => n.m === 72), notes.map((n) => [n.m, +n.t.toFixed(3)]));
    // velocity lane
    const vb = await p.locator("#syRollVel").boundingBox();
    await p.mouse.move(X(n74.t) + 2, vb.y + vb.height - 5); await p.mouse.down(); await p.mouse.move(X(n74.t) + 2, vb.y + vb.height * 0.75, { steps: 3 }); await p.mouse.up();
    const v74 = (await ev((l) => window.H3SynthTL.tl().layers[l].clips[0].notes, li)).find((n) => n.m === 74).v;
    check("the velocity lane: drag a note's bar down = softer", v74 < 0.5, v74);
    // keys: ↑ transposes the picked note, Delete removes it
    await p.keyboard.press("ArrowDown"); notes = await ev((l) => window.H3SynthTL.tl().layers[l].clips[0].notes, li);
    check("↓ = a semitone down (the picked note)", notes.some((n) => n.m === 73) && !notes.some((n) => n.m === 74));
    await p.mouse.click(X(notes.find((n) => n.m === 73).t + 0.03), Y(73), { button: "right" });
    notes = await ev((l) => window.H3SynthTL.tl().layers[l].clips[0].notes, li);
    check("right-click = gone", notes.length === 3 && !notes.some((n) => n.m === 73), notes.length);
    // quantize: nudge a note off the grid, then ⌗
    await ev((l) => { const c = window.H3SynthTL.tl().layers[l].clips[0]; c.notes[1].t = 0.29; }, li);
    await p.click("#syRollQ");
    notes = await ev((l) => window.H3SynthTL.tl().layers[l].clips[0].notes, li);
    check("⌗ Quantize: every note on the 1/16 grid", notes.every((n) => Math.abs(n.t / (beat / 4) - Math.round(n.t / (beat / 4))) < 1e-6), notes.map((n) => n.t));
    await p.keyboard.press("Escape"); await sleep(150);
    check("Esc closes the piano roll", !(await ev(() => window.H3SynthRoll.isOpen())));
    /* ---- clip editing */
    await ev(() => window.H3SynthTL.setTL(null));
    await ev(() => window.H3SynthTL.addClip("kit:crash", 0, 0));
    await p.waitForFunction(() => window.H3SynthTL.tl().layers[0].clips.length === 1, null, { timeout: 8000 });
    const len0 = (await tl()).layers[0].clips[0].len;
    await ev(() => { window.H3SynthTL.select(0, 0); window.H3SynthTL.seek(0.5); });
    await p.click("#syTSplit");
    let c0 = (await tl()).layers[0].clips;
    check("✂ Split at the playhead: two clips, the right one starts at 0.5 s and plays on from there", c0.length === 2 && c0[0].len === 0.5 && c0[1].start === 0.5 && c0[1].off === 0.5 && Math.abs(c0[0].len + c0[1].len - len0) < 1e-9, c0.map((c) => [c.start, c.off, c.len]));
    await p.click("#syTDup");
    c0 = (await tl()).layers[0].clips;
    check("⧉ Duplicate: a copy right after it", c0.length === 3 && Math.abs(c0[2].start - (c0[1].start + c0[1].len)) < 1e-9 && c0[2].off === c0[1].off, c0.map((c) => [c.start, c.len]));
    // the clip bar's Gain / Fade knobs
    await p.focus('#syTKeyEd [data-clip="gain"]'); for (let i = 0; i < 10; i++) await p.keyboard.press("ArrowDown");
    await p.focus('#syTKeyEd [data-clip="fi"]'); for (let i = 0; i < 8; i++) await p.keyboard.press("ArrowUp");
    const sel = (await tl()).layers[0].clips[2];
    check("the picked clip's knobs: Gain (in dB) and Fade in", sel.gain < 0.95 && sel.fi > 0 && /dB/.test(await ev(() => document.querySelector('#syTKeyEd [data-clip="gain"] .sykv').textContent)), { gain: sel.gain, fi: sel.fi });
    // a fade handle dragged on the canvas
    const G = await ev(() => window.H3SynthTL.geo()), tcv = await p.locator("#syTCanvas").boundingBox(), c1 = (await tl()).layers[0].clips[1];
    await p.mouse.move(tcv.x + (c1.start + c1.len) * G.zoom - G.scroll - 1, tcv.y + G.RULER + 5); await p.mouse.down(); await p.mouse.move(tcv.x + (c1.start + c1.len - 0.3) * G.zoom - G.scroll, tcv.y + G.RULER + 5, { steps: 4 }); await p.mouse.up();
    const fo = (await tl()).layers[0].clips[1].fo;
    check("drag a clip's top-right handle = its fade out", Math.abs(fo - 0.3) < 0.06, fo);
    // overlap -> automatic crossfade in the mix
    const xf = await ev(() => { const L0 = window.H3SynthTL.tl().layers[0]; return window.H3SynthTLCore.fades([{ start: 0, len: 1, fi: 0, fo: 0 }, { start: 0.6, len: 1, fi: 0, fo: 0 }]); });
    check("overlapping clips crossfade by themselves (the overlap = the fade)", Math.abs(xf[0].fo - 0.4) < 1e-9 && Math.abs(xf[1].fi - 0.4) < 1e-9, xf);
    /* ---- undo / redo */
    await ev(() => window.H3Synth.commit());
    const before = JSON.stringify((await tl()).layers[0].clips.length);
    await ev(() => window.H3SynthTL.select(0, 0)); await p.focus("#syTCanvas"); await p.keyboard.press("Delete"); await sleep(500);
    check("(a clip removed)", (await tl()).layers[0].clips.length === 2);
    check("↶ is on", !(await ev(() => document.getElementById("syUndo").disabled)));
    await p.keyboard.press("Control+z"); await sleep(150);
    check("Ctrl+Z: the clip is back", JSON.stringify((await tl()).layers[0].clips.length) === before && /undone/.test(await ev(() => document.getElementById("syMsg").textContent)));
    await p.click("#syRedo"); await sleep(150);
    check("↷ Redo: gone again", (await tl()).layers[0].clips.length === 2);
    await ev(() => window.H3Synth.set("cut", 777)); await sleep(500);
    await p.click("#syUndo"); await sleep(150);
    check("undo covers the knobs too (Cutoff back)", (await ev(() => window.H3Synth.info().p.cut)) !== 777, await ev(() => window.H3Synth.info().p.cut));
    await ev(() => { const L = window.H3SynthLoop.loop(); L.bpm = 141; window.H3SynthLoop.changed(); }); await sleep(500);
    await p.keyboard.press("Control+z"); await sleep(150);
    check("…and the looper (BPM back)", (await ev(() => window.H3SynthLoop.loop().bpm)) !== 141);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: the test stopped - " + (e && e.stack || e)); }
  finally {
    try {
      for (const n of made) { await ev((nm) => fetch("/api/synth/files/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: nm }) }), n);
        await ev((nm) => fetch("/api/synth/samples/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: nm.replace(/\.sfx$/, ".wav") }) }), n); }
      await ev(() => { Object.keys(localStorage).filter((k) => /^h3\.synth\./.test(k)).forEach((k) => localStorage.removeItem(k)); });
    } catch (e) { /* gone */ }
    await b.close();
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
