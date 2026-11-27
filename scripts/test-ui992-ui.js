#!/usr/bin/env node
/* bitGen Studio — 2.992.0 in a REAL browser (Tim: "our own Magenta" in the 🎹 Edit Booth - 🥁 Drumify first: a played or tapped
 * rhythm -> a drum pattern in the step sequencer with a human feel; local only). Against the running app (H3_URL). */
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
  if (!chromium) { console.log("FAIL: playwright is not installed here"); console.log("\nRESULT: 0 passed, 1 failed"); process.exit(1); }
  const b = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
  const p = await (await b.newContext({ viewport: { width: 1500, height: 1000 } })).newPage();
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  const clip = (li) => ev((i) => window.H3SynthTL.tl().layers[i].clips[0], li);
  let sample = "";
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => window.H3Synth && window.H3SynthTL && window.H3SynthSteps && window.H3SynthGroove && typeof dsReady !== "undefined" && dsReady, null, { timeout: 60000 });
    await ev(() => { Object.keys(localStorage).filter((k) => /^h3\.synth\./.test(k)).forEach((k) => localStorage.removeItem(k)); });
    await p.reload({ waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => window.H3Synth && window.H3SynthTL && window.H3SynthGroove && typeof dsReady !== "undefined" && dsReady && document.querySelector("#synthdock .autabs"), null, { timeout: 60000 });
    await ev(() => { window.H3Audio.tab("synthdock"); window.toggleMax("synthdock", true); window.H3Synth.fold("rack", true); window.H3Synth.fold("keys", true); window.H3Synth.fold("loop", true);
      window.H3SynthTL.setTL({ layers: [{}, {}, {}, {}], tempoOn: true, tempo: [{ t: 0, bpm: 120 }] }); window.H3SynthTL.select(1); window.H3SynthTL.seek(0); }); await sleep(500);

    await p.click("#syTSteps"); await sleep(150);
    check("the step sequencer has a Feel slider (1 = as played) and 🥁 Drumify…", await p.locator("#syStepFeel").isVisible() && (await p.inputValue("#syStepFeel")) === "1" && await p.locator("#syStepGroove").isVisible());
    await p.click("#syStepGroove");
    const note = await p.textContent(".sygrvnote");
    check("🥁 Drumify… opens its part: tap / a note clip / a sound, and it says plainly it is simple rules, not an AI model, nothing leaves the PC",
      await p.locator("#syGrv").isVisible() && (await p.getAttribute("#syStepGroove", "aria-expanded")) === "true" && /not an AI model/.test(note) && /nothing leaves your PC/.test(note) && /Light tasks/.test(note)
      && (await p.locator("#syGrvFrom option").allTextContents()).length === 3, note);

    // ---- ● Tap: real keys - one in the count-in (ignored), one after it (taken)
    await p.click("#syGrvTap"); await sleep(120);
    check("● Tap records (■ Stop, the pad lit, a bar of clicks first)", await ev(() => window.H3SynthSteps.tapping()) && /Stop/.test(await p.textContent("#syGrvTap")) && await p.locator("#syGrvPad.live").count() === 1);
    await p.keyboard.press("j");
    check("…a key in the bar of clicks is not a hit", (await ev(() => window.H3SynthSteps.taps().length)) === 0, await ev(() => window.H3SynthSteps.taps()));
    const clk = await ev(() => window.H3SynthSteps.tapClock());
    await p.waitForFunction((st) => window.H3SynthSteps.audioAt(window.H3SynthTL._ctx()) > st + 0.2, clk.start, { timeout: 8000 });
    await p.keyboard.press("k");
    const t1 = await ev(() => window.H3SynthSteps.taps());
    check("…a key after it = a hit, on the clip's beats (0 - 4 beats in)", t1.length === 1 && t1[0].b >= 0 && t1[0].b < 4 && Math.abs(t1[0].v - 0.75) < 1e-9, { t1, clk });
    await p.keyboard.press("Escape"); await sleep(100);
    check("Esc while tapping stops the tap (the box stays)", !(await ev(() => window.H3SynthSteps.tapping())) && await ev(() => window.H3SynthSteps.isOpen()) && /Tap/.test(await p.textContent("#syGrvTap")));

    // ---- taps placed by time: 1, 2, the "and" of 2 played late, 3, 4 (the audio clock round trip)
    const made = await ev(async () => {
      const S = window.H3SynthSteps; S.tapStart(); const c = S.tapClock(), ctx = window.H3SynthTL._ctx();
      const now = performance.now(), a = S.audioAt(ctx, now);
      [0, 1, 1.55, 2, 3].forEach((beat) => S.tap(0.75, now + (c.start + beat * c.bsec - a) * 1000));
      const taps = S.taps(); S.tapStop(true); await new Promise((r) => setTimeout(r, 100));
      return { taps, res: S.result(), msg: document.getElementById("syGrvMsg").textContent };
    });
    const R = (k) => made.res && made.res.rows.filter((r) => r.kind === k)[0];
    check("the hits land on the clip's beats by the audio clock (0, 1, 1.55, 2, 3)", made.taps.length === 5 && made.taps.map((t) => Math.round(t.b * 100) / 100).join() === "0,1,1.55,2,3", made.taps);
    check("✨ the pattern: kick on 1, on the pushed 'and' of 2 and on 3; snare on 2 and 4; hats added (in your feel)",
      R("kick") && R("kick").hits.map((h, i) => h ? i : -1).filter((i) => i >= 0).join() === "0,6,8" && R("snare").hits.map((h, i) => h ? i : -1).filter((i) => i >= 0).join() === "4,12" && R("hat").hits.filter(Boolean).length + R("open").hits.filter(Boolean).length >= 8, made.res && made.res.rows);
    check("…the late 'and' is kept: 0.2 of a step late on the kick, and the added hats on the 'and's lean late too", Math.abs(R("kick").off[6] - 0.2) < 0.01 && R("hat").off.filter((o, i) => i % 4 === 2 && R("hat").hits[i]).every((o) => o > 0.1), { k: R("kick").off, h: R("hat").off });
    check("…said under ✨: what was read and what was added", /5 hits read/.test(made.msg) && /kick 3/.test(made.msg) && /added: hats/.test(made.msg), made.msg);
    let c = await clip(1);
    check("the step clip now holds it: rows with how hard (vel) + how early / late (off), Feel 1", c.rows[0].src === "kit:kick" && Math.abs(c.rows[0].off[6] - 0.2) < 0.01 && c.rows[0].vel[0] > 0 && c.feel === 1, c);
    check("the grid shows it: a tick on the late cell, brightness by strength", await p.locator('#syStepGrid [data-r="0"][data-s="6"].felt').count() === 1 && /0\.2/.test(await p.getAttribute('#syStepGrid [data-r="0"][data-s="6"]', "style")));
    const ksteps = await ev(() => window.H3SynthTLCore.stepEvents(window.H3SynthTL.tl().layers[1].clips[0], [{ t: 0, bpm: 120 }]).filter((x) => x.row === 0).map((x) => x.t));
    check("played late: the pushed kick at 0.75 + 0.2 x 0.125 = 0.775 s (120 BPM, 16ths)", ksteps.join() === "0,0.775,1", ksteps);
    // heard: our own reader finds the kick late, then on the grid with Feel 0
    const kickAt = async () => ev(async () => { const r = await window.H3SynthTL.render(48000, 1); return window.H3SynthGroove.onsets(r.chans, 48000).filter((h) => h.bands.indexOf("low") >= 0).map((h) => h.t); });
    // the mix's compressor looks ahead (~12 ms) - so times are read against the kick on beat 3 (1 s), which is on the grid
    const rel = (ka) => { const ref = ka.filter((t) => Math.abs(t - 1) < 0.03)[0], k = ka.filter((t) => t > 0.7 && t < 0.83)[0]; return ref == null || k == null ? null : Math.round((k - ref + 1) * 1000) / 1000; };
    let ka = await kickAt(), late = rel(ka);
    check("heard (rendered, read back by our own reader): the pushed kick ~0.775 s", late != null && Math.abs(late - 0.775) < 0.006, ka);
    await p.fill("#syStepFeel", "0"); await p.dispatchEvent("#syStepFeel", "input"); ka = await kickAt(); const grid = rel(ka);
    check("Feel 0: the same kick on the grid ~0.75 s (25 ms earlier)", (await clip(1)).feel === 0 && grid != null && Math.abs(grid - 0.75) < 0.006 && Math.abs(late - grid - 0.025) < 0.005, { ka, late, grid });
    await p.fill("#syStepFeel", "1"); await p.dispatchEvent("#syStepFeel", "input");

    // ---- 🎲 Another, ↶ Put back, a cell by hand
    const before = JSON.stringify((await clip(1)).rows.map((r) => r.hits));
    let changedOnce = false;
    for (let i = 0; i < 6 && !changedOnce; i++) { await p.click("#syGrvAgain"); changedOnce = JSON.stringify((await clip(1)).rows.map((r) => r.hits)) !== before; }
    check("🎲 Another: the same taps, another take (a different pattern)", changedOnce);
    await p.click("#syGrvUndo");
    c = await clip(1);
    check("↶ Put back: the pattern as it was before ✨ (the default beat, no timing kept)", c.rows.length === 4 && c.rows[1].hits[4] === 2 && c.rows[2].hits.filter(Boolean).length === 8 && !c.rows[0].off && c.feel == null, c.rows);
    await p.click("#syGrvGo"); await sleep(100);
    await p.click('#syStepGrid [data-r="0"][data-s="6"]', { button: "right" }); await p.click('#syStepGrid [data-r="0"][data-s="6"]');
    c = await clip(1);
    check("a cell set by hand: plain strength, on the grid (its tick gone)", c.rows[0].hits[6] === 1 && c.rows[0].off[6] === 0 && c.rows[0].vel[6] === 0.7 && await p.locator('#syStepGrid [data-r="0"][data-s="6"].felt').count() === 0, c.rows[0]);

    // ---- from a note clip: low notes = kick
    await ev(() => window.H3SynthTL.addNotes([{ m: 36, t: 0, d: 0.2, v: 0.9 }, { m: 72, t: 0.25, d: 0.1, v: 0.5 }, { m: 72, t: 0.5, d: 0.2, v: 0.9 }, { m: 36, t: 0.875, d: 0.1, v: 0.9 }, { m: 72, t: 1.5, d: 0.2, v: 0.8 }], "Riff", null, 2, 0));
    await ev(() => { window.H3SynthSteps.close(); window.H3SynthTL.openSteps(1, 0); window.H3SynthSteps.groove(true); });
    await p.selectOption("#syGrvFrom", "notes");
    check("From 🎹 a note clip: the timeline's note clips are listed", (await p.locator("#syGrvNotes option").allTextContents()).some((t) => /Riff/.test(t)) && await p.locator("#syGrvNotes").isVisible());
    await p.click("#syGrvGo"); await sleep(150);
    c = await clip(1);
    const on = (r) => r.hits.map((h, i) => h ? i : -1).filter((i) => i >= 0).join();
    check("…its rhythm -> the pattern: the low notes + beat 1 = kick (0, 7 = the 'a' before 3), beat 2 = snare (4), the quiet 16th = a hat",
      on(c.rows[0]) === "0,7" && on(c.rows[1]).split(",").indexOf("4") >= 0 && c.rows[2].hits[2] > 0 && /from Layer/.test(await p.textContent("#syGrvMsg")), c.rows.map(on));

    // ---- from a sound: our own kit beat uploaded as a sample, put on the timeline
    sample = await ev(async () => {
      const K = window.H3SynthKit, sr = 48000, L = 2 * sr, mix = new Float32Array(L);
      const add = (id, t, g) => { const x = K.make(id, sr), o = Math.round(t * sr); for (let i = 0; i < x.length && o + i < L; i++) mix[o + i] += x[i] * g; };
      [[0, "kick"], [0.25, "chat"], [0.5, "snare"], [0.75, "chat"], [1, "kick"], [1.25, "kick"], [1.5, "snare"], [1.75, "chat"]].forEach((q) => add(q[1], q[0], q[1] === "chat" ? 0.5 : 0.8));
      const fd = new FormData(); fd.append("files", new Blob([window.H3SynthCore.wav([mix], sr)], { type: "audio/wav" }), "ui992_beat.wav");
      const j = await (await fetch("/api/synth/samples", { method: "POST", body: fd })).json();
      return j.added && j.added[0] && j.added[0].name;
    });
    await ev((nm) => { const t = window.H3SynthTL.tl(); t.layers[0].clips = [{ src: "my:" + nm, name: "beat", start: 0, off: 0, len: 2 }]; window.H3SynthTL.setTL(t); window.H3SynthTL.openSteps(1, 0); window.H3SynthSteps.groove(true); }, sample);
    await p.selectOption("#syGrvFrom", "sound");
    const opts = await p.locator("#syGrvSnd option").allTextContents();
    check("From 🔊 a sound: the timeline's sound clips first (▤), then the kit and your samples", /▤ .*beat/.test(opts[0]) && opts.some((t) => /Kick/.test(t)), opts.slice(0, 4));
    await p.selectOption("#syGrvKeep", "auto"); await ev(() => { document.getElementById("syGrvHats").checked = false; document.getElementById("syGrvBack").checked = false; document.getElementById("syGrvGhost").value = "0"; });
    await p.click("#syGrvGo"); await p.waitForFunction(() => /hits? read/.test(document.getElementById("syGrvMsg").textContent), null, { timeout: 10000 });
    c = await clip(1);
    check("…its hits found by band: kicks 0 / 8 / 10, snares 4 / 12, hats 2 / 6 / 14 - nothing added", on(c.rows[0]) === "0,8,10" && on(c.rows[1]) === "4,12" && on(c.rows[2]) === "2,6,14", c.rows.map(on));
    check("…played on the grid (it was): every hit within 0.05 of a step", c.rows.every((r) => r.off.every((o) => Math.abs(o) < 0.05)), c.rows.map((r) => r.off));

    // ---- kept over a save (cleanTL)
    const kept = await ev(() => { const t = window.H3SynthTLCore.cleanTL(JSON.parse(JSON.stringify(window.H3SynthTL.tl()))); const s = t.layers[1].clips[0]; return { feel: s.feel, off: !!s.rows[0].off, vel: !!s.rows[0].vel }; });
    check("kept when saved (cleanTL keeps off / vel / feel)", kept.feel === 1 && kept.off && kept.vel, kept);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: the test stopped: " + (e && e.stack || e)); }
  finally {
    try { await ev(() => { window.H3SynthSteps.close(); window.toggleMax("synthdock", false); window.H3Audio.tab("musicdock"); }); await sleep(900); } catch (e) { /* page gone */ }
    if (sample) { try { await ev((nm) => fetch("/api/synth/samples/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: nm }) }), sample); } catch (e) { /* gone */ } }
    await b.close();
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
