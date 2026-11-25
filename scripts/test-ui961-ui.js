#!/usr/bin/env node
/* bitGen Studio — 2.961.0 in a REAL browser (Tim: "continue please" - the tempo track: tempo changes over the song that the beat
 * grid, ⌗ snap, 🕒 click, the loop's bars and bar.beat follow). Against the running app (H3_URL). */
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
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => window.H3Synth && window.H3SynthTL && typeof dsReady !== "undefined" && dsReady, null, { timeout: 60000 });
    await ev(() => { Object.keys(localStorage).filter((k) => /^h3\.synth\./.test(k)).forEach((k) => localStorage.removeItem(k)); });
    await p.reload({ waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => window.H3Synth && window.H3SynthTL && typeof dsReady !== "undefined" && dsReady && document.querySelector("#synthdock .autabs"), null, { timeout: 60000 });
    await ev(() => { window.H3Audio.tab("synthdock"); window.toggleMax("synthdock", true); window.H3Synth.fold("rack", true); window.H3Synth.fold("keys", true); window.H3Synth.fold("loop", true); window.H3SynthTL.setTL(null); }); await sleep(600);
    const lbpm = await ev(() => window.H3SynthLoop.loop().bpm);
    check("no tempo track at first: the ruler as before, the looper's BPM", (await ev(() => window.H3SynthTL.geo().RULER)) === 22 && !(await ev(() => window.H3SynthTL.info().tempoOn)) && (await ev(() => window.H3SynthTL.info().bpmNow)) === lbpm);
    await p.click("#syTTempo");
    let I = await ev(() => window.H3SynthTL.info());
    check("♩ Tempo: on (pressed), a strip under the ruler, its first tempo = the looper's BPM, \"♩ Tempo\" beside it",
      I.tempoOn && (await ev(() => window.H3SynthTL.geo().RULER)) === 44 && I.tempo.length === 1 && I.tempo[0].bpm === lbpm && (await ev(() => document.getElementById("syTTempo").getAttribute("aria-pressed"))) === "true" && !!(await ev(() => document.querySelector(".sytltempo"))), I);
    await ev(() => { window.H3SynthTL.tl().zoom = 60; window.H3SynthTL.draw(); });
    const G = await ev(() => window.H3SynthTL.geo()), cvb = await p.locator("#syTCanvas").boundingBox();
    const X = (t) => cvb.x + t * G.zoom - G.scroll, SY = cvb.y + 33;
    await p.mouse.dblclick(X(4.1), SY); await sleep(100);
    I = await ev(() => window.H3SynthTL.info());
    const beat = 60 / lbpm, t1 = Math.round(4.1 / beat) * beat;
    check("double-click the strip = a tempo change on the beat there, at the tempo playing there (picked)", I.tempo.length === 2 && Math.abs(I.tempo[1].t - t1) < 1e-6 && I.tempo[1].bpm === lbpm && I.tpt === 1, I.tempo);
    await p.mouse.move(X(I.tempo[1].t), SY); await p.mouse.down(); await p.mouse.move(X(I.tempo[1].t), SY - 40, { steps: 6 }); await p.mouse.up(); await sleep(100);
    I = await ev(() => window.H3SynthTL.info());
    check("drag it up = faster (half a BPM a pixel)", Math.abs(I.tempo[1].bpm - (lbpm + 20)) < 0.6 && Math.abs(I.tempo[1].t - t1) < 1e-6, I.tempo);
    await p.fill("#syTBpm", "60"); await p.press("#syTBpm", "Enter"); await ev(() => document.getElementById("syTBpm").dispatchEvent(new Event("change"))); await sleep(50);
    check("its bar: BPM typed in", (await ev(() => window.H3SynthTL.info().tempo[1].bpm)) === 60);
    await ev(() => window.H3SynthTL.selTempo(0)); await p.check("#syTRamp"); await sleep(50);
    check("…Ramp to the next on the first change: the tempo glides (mid-way between)", (await ev(() => window.H3SynthTL.info().tempo[0].ramp)) && Math.abs((await ev((t) => { const T = window.H3SynthTLCore; return T.bpmAt(window.H3SynthTL.tmap(), t / 2); }, t1)) - (lbpm + 60) / 2) < 1e-6);
    await p.uncheck("#syTRamp");
    await p.mouse.move(X(t1), SY); await p.mouse.down(); await p.mouse.move(X(t1 + 2.2), SY, { steps: 6 }); await p.mouse.up(); await sleep(100);
    I = await ev(() => window.H3SynthTL.info());
    const tm = I.tempo[1].t;
    check("drag it sideways = later, on a beat of the tempo before it", tm > t1 + 1.5 && Math.abs(tm / beat - Math.round(tm / beat)) < 1e-6, I.tempo);
    /* ---- the grid follows: snap after the change = 16ths at 60 BPM (0.25 s) */
    await ev(() => window.H3SynthTL.setTL(Object.assign(window.H3SynthTL.tl(), { tempo: [{ t: 0, bpm: 60 }], tempoOn: true, zoom: 60 }))); await sleep(100);
    const G2 = await ev(() => window.H3SynthTL.geo()), cb2 = await p.locator("#syTCanvas").boundingBox();
    await p.mouse.dblclick(cb2.x + 1.4 * G2.zoom - G2.scroll, cb2.y + 12); await p.waitForSelector("#syDlg input", { timeout: 1500 }).catch(() => null);
    const mk = await ev(() => window.H3SynthTL.tl().markers.map((m) => m.t));
    check("⌗ snap follows the tempo (a marker at 1.4 s -> 1.5: 60 BPM's 16ths, not 120's 1.375)", mk.length === 1 && Math.abs(mk[0] - 1.5) < 1e-6, mk);
    await ev(() => { window.H3SynthTL.tl().markers = []; window.H3SynthTL.seek(5.5); });
    check("the readout: time · bar.beat · ♩ BPM", /5\.5.*·\s+2\.2\s+♩60/.test(await ev(() => document.getElementById("syTPos").textContent)), await ev(() => document.getElementById("syTPos").textContent));
    await ev(() => window.H3SynthTL.seek(5.5)); await p.click("#syTLoop");
    const lp = (await tl()).loop;
    check("⟳ Loop with no range: 2 bars of THIS tempo from the playhead's bar (4 - 12 s at 60 BPM)", Math.abs(lp.a - 4) < 1e-6 && Math.abs(lp.b - 12) < 1e-6, lp);
    await p.click("#syTLoop");
    /* ---- the click follows the map while it plays */
    await ev(() => { window.H3SynthTL.setTL(Object.assign(window.H3SynthTL.tl(), { tempo: [{ t: 0, bpm: 240 }, { t: 0.5, bpm: 60 }], loop: { on: false, a: 0, b: 0 } })); });
    const clicks = await ev(() => window.H3SynthClick && window.H3SynthTLCore.beatTimes(window.H3SynthTL.tmap(), 0, 2.01, 4).map((c) => c.t).join());
    check("🕒 the click's beats from the map (4 quick ones, then a second apart)", clicks === "0,0.25,0.5,1.5", clicks);
    /* ---- remove, keep, off */
    await ev(() => window.H3SynthTL.setTL(Object.assign(window.H3SynthTL.tl(), { tempo: [{ t: 0, bpm: 100 }, { t: 2, bpm: 140 }, { t: 4, bpm: 90 }] })));
    await p.mouse.click(X(2), SY, { button: "right" }); await sleep(50);
    check("right-click a change = gone", (await ev(() => window.H3SynthTL.info().tempo.map((q) => q.bpm).join())) === "100,90");
    await p.mouse.click(X(4), SY); await p.focus("#syTCanvas"); await p.keyboard.press("Delete"); await sleep(50);
    await p.mouse.click(X(0) + 1, SY); await p.keyboard.press("Delete"); await sleep(50);
    check("…or pick it + Delete; the first tempo stays", (await ev(() => window.H3SynthTL.info().tempo.map((q) => q.bpm).join())) === "100");
    const kept = await ev(() => { const j = JSON.parse(JSON.stringify(window.H3SynthTL.tl())); window.H3SynthTL.setTL(null); window.H3SynthTL.setTL(j); return window.H3SynthTL.info(); });
    check("kept with the timeline (its file, undo): on, 100 BPM", kept.tempoOn && kept.tempo[0].bpm === 100 && (await ev(() => window.H3SynthTL.geo().RULER)) === 44);
    await p.click("#syTTempo");
    check("♩ Tempo off: the ruler back, the looper's BPM again", (await ev(() => window.H3SynthTL.geo().RULER)) === 22 && (await ev(() => window.H3SynthTL.info().bpmNow)) === lbpm && !(await ev(() => document.querySelector(".sytltempo"))));
    await ev(() => window.H3SynthTL.setTL(null));
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: the test stopped - " + (e && e.stack || e)); }
  finally {
    try { await ev(() => { Object.keys(localStorage).filter((k) => /^h3\.synth\./.test(k)).forEach((k) => localStorage.removeItem(k)); }); } catch (e) { /* gone */ }
    await b.close();
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
