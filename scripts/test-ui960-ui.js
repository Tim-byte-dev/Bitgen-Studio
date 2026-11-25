#!/usr/bin/env node
/* bitGen Studio — 2.960.0 in a REAL browser (Tim: "lets do the next one" - takes and comping: ● Rec onto an armed layer, ⟳ loop
 * recording (a take a pass, placed to the sample), punch, comping by dragging across takes, flatten). Against the running app (H3_URL). */
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
  const made = new Set();
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => window.H3Synth && window.H3SynthTL && window.H3SynthRec && typeof dsReady !== "undefined" && dsReady, null, { timeout: 60000 });
    await ev(() => { Object.keys(localStorage).filter((k) => /^h3\.synth\./.test(k)).forEach((k) => localStorage.removeItem(k)); });
    await p.reload({ waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => window.H3Synth && window.H3SynthTL && typeof dsReady !== "undefined" && dsReady && document.querySelector("#synthdock .autabs"), null, { timeout: 60000 });
    await ev(() => { window.H3Audio.tab("synthdock"); window.toggleMax("synthdock", true); window.H3Synth.fold("rack", true); window.H3Synth.fold("keys", true); window.H3Synth.fold("loop", true); window.H3SynthTL.setTL(null); window.H3Synth.ctx(); }); await sleep(600);
    // bursts in a render (or a buffer) -> their onsets (s)
    const bursts = (i) => ev(async (li) => { const r = await window.H3SynthTL.render(48000, li); const d = r.chans[0], o = []; for (let k = 1; k < d.length; k++) if (Math.abs(d[k]) > 0.01 && (!o.length || k / 48000 - o[o.length - 1] > 0.15)) o.push(+(k / 48000).toFixed(3)); return o; }, i);
    /* ---- the bar + arming */
    const bar = await ev(() => ({ ids: ["syTRec", "syTIn", "syTLoop", "syTPunch"].every((id) => document.getElementById(id)), ins: [...document.querySelectorAll("#syTIn option")].map((o) => o.value).join(), arms: document.querySelectorAll(".sytlhead [data-arm]").length }));
    check("the bar: ● Rec, what it records (Keys / Looper + pads / both / Mic), ⟳ Loop, Punch; ● arm in every layer's head", bar.ids && bar.ins === "keys,loop,both,mic" && bar.arms === 4, bar);
    await p.click('.sytlhead[data-l="0"] [data-arm]');
    check("● arm: one layer", (await ev(() => window.H3SynthTL.info().arm)) === 0 && (await ev(() => document.querySelectorAll(".sytlhead .arm.on").length)) === 1);
    /* ---- the range: ⟳ Loop with none = 2 bars from the playhead; Shift+drag the ruler */
    await p.click("#syTLoop");
    let lp = (await tl()).loop;
    check("⟳ Loop with no range: 2 bars from the playhead's bar (on)", lp.on && lp.a === 0 && Math.abs(lp.b - 8 * 60 / (await ev(() => window.H3SynthLoop.loop().bpm))) < 1e-6, lp);
    const G = await ev(() => window.H3SynthTL.geo()), cvb = await p.locator("#syTCanvas").boundingBox();
    const X = (t) => cvb.x + t * G.zoom - G.scroll, LT = (li) => cvb.y + G.RULER + li * G.LH;
    await p.keyboard.down("Shift"); await p.mouse.move(X(0.5), cvb.y + 12); await p.mouse.down(); await p.mouse.move(X(1.5), cvb.y + 12, { steps: 5 }); await p.mouse.up(); await p.keyboard.up("Shift");
    lp = (await tl()).loop;
    check("Shift+drag the ruler = the range (still looping)", lp.on && Math.abs(lp.a - 0.5) < 0.07 && Math.abs(lp.b - 1.5) < 0.07, lp);
    await ev(() => window.H3SynthTL.setLoop({ a: 0, b: 1.2, on: true }));
    /* ---- loop recording: a burst at a different time in each pass -> a take a pass */
    await p.click("#syTRec");
    const passes = await ev(() => new Promise((res) => {
      const ctx = window.H3Synth.ctx(), E = window.H3Synth.engine(), done = new Set();
      const iv = setInterval(() => {
        const R = window.H3SynthTL.recording(); if (!R) return;
        R.passes.forEach((pt, k) => { if (done.has(k) || k > 2) return; done.add(k); const o = ctx.createOscillator(); o.frequency.value = 330; o.connect(E.out); o.start(pt + 0.3 * (k + 1)); o.stop(pt + 0.3 * (k + 1) + 0.08); });
        if (R.passes.length >= 4 && ctx.currentTime > R.passes[3] + 0.06) { clearInterval(iv); res(R.passes.length); }
      }, 10);
    }));
    const recOn = await ev(() => ({ btn: document.getElementById("syTRec").classList.contains("on"), txt: document.getElementById("syTRec").textContent }));
    await p.click("#syTRec");
    await p.waitForFunction(() => !window.H3SynthTL.recording() && window.H3SynthTL.tl().layers[0].clips.length >= 3, null, { timeout: 20000 });
    let L0 = (await tl()).layers[0]; L0.clips.forEach((c) => made.add(c.src.replace(/^my:/, "")));
    check("● Rec with ⟳ Loop: pressed while recording; ■ -> a take per pass (3), one group, take 1..3", recOn.btn && /Stop/.test(recOn.txt) && passes >= 4 && L0.clips.length === 3 && L0.clips.every((c) => c.grp === "g1") && L0.clips.map((c) => c.ti).join() === "0,1,2", { recOn, passes, clips: L0.clips });
    const lat = (await ev(() => window.H3SynthTL.lastRec())).lat;
    const ons = await ev(async () => { const out = []; for (const c of window.H3SynthTL.tl().layers[0].clips) { const b = await window.H3SynthLoop.buffer(c.src); const d = b.getChannelData(0); let i = 0; while (i < d.length && Math.abs(d[i]) < 0.005) i++; out.push(c.start + i / b.sampleRate); } return out; });
    check("…each take sits where it was played, to the sample (the output latency taken off)", ons.every((o, k) => Math.abs(o - (0.3 * (k + 1) - lat)) < 0.004), { ons, lat });
        // (a render's onsets sit ~12 ms after the take's: the compressor's look-ahead + the sine reaching the threshold)
    const near = (a, b) => Math.abs(a - b) < 0.02;
    let b0 = await bursts(0);
    check("…the newest take plays (take 3's sound only)", b0.length === 1 && near(b0[0], 0.9 - lat), b0);
    /* ---- comping with the mouse */
    await ev(() => { window.H3SynthTL.setLoop({ on: false }); });
    await p.locator("#syTCanvas").scrollIntoViewIfNeeded();
    const cvb2 = await p.locator("#syTCanvas").boundingBox(), X2 = (t) => cvb2.x + t * G.zoom - G.scroll, rowY = (r) => cvb2.y + G.RULER + 3 + 12 + (G.LH - 7 - 12) / 3 * (r + 0.5);
    await p.mouse.move(X2(0.1), rowY(0)); await p.mouse.down(); await p.mouse.move(X2(0.45), rowY(0), { steps: 5 }); await p.mouse.up(); await sleep(100);
    b0 = await bursts(0);
    check("drag across take 1 (0.1 - 0.45 s) = it plays there: take 1's sound + take 3's", b0.length === 2 && near(b0[0], 0.3 - lat) && near(b0[1], 0.9 - lat), b0);
    await p.mouse.click(X2(0.8), rowY(1)); await sleep(100);
    b0 = await bursts(0);
    check("click take 2 = all of take 2 plays", b0.length === 1 && near(b0[0], 0.6 - lat), b0);
    check("…its bar: ⧉ Take 2 of 3, ▶ Solo take, ▤ Flatten", /Take 2 of 3/.test(await ev(() => document.getElementById("syTKeyEd").textContent)) && !!(await ev(() => document.getElementById("syTFlat"))));
    await p.mouse.click(X2(0.8), rowY(2), { button: "right" }); await sleep(100);
    L0 = (await tl()).layers[0];
    check("right-click a take = gone (2 left)", L0.clips.length === 2 && L0.clips.every((c) => c.grp === "g1"), L0.clips);
    b0 = await bursts(0);
    await p.mouse.move(X2(0.5), cvb2.y + G.RULER + 8); await p.mouse.down(); await p.mouse.move(X2(1.5), cvb2.y + G.RULER + 8, { steps: 5 }); await p.mouse.up(); await sleep(100);
    const moved = await bursts(0);
    check("drag the group's top strip = the takes (and the comp) move together", moved.length === b0.length && moved.every((t, k) => Math.abs(t - b0[k] - 1) < 0.01), { b0, moved });
    check("✂ / ⧉ refuse a take (flatten first)", (await ev(() => window.H3SynthTL.split())) === false && (await ev(() => window.H3SynthTL.dup())) === false);
    await p.click("#syTFlat"); await sleep(100);
    L0 = (await tl()).layers[0];
    const flat = await bursts(0);
    check("▤ Flatten: plain clips, exactly what played", L0.clips.length >= 1 && L0.clips.every((c) => !c.grp) && JSON.stringify(flat) === JSON.stringify(moved), { clips: L0.clips, flat, moved });
    /* ---- punch */
    await p.click('.sytlhead[data-l="1"] [data-arm]');
    await ev(() => { window.H3SynthTL.setLoop({ a: 1, b: 1.5, on: false, punch: true }); window.H3SynthTL.seek(0.5); });
    await p.click("#syTRec");
    await ev(() => new Promise((res) => {
      const ctx = window.H3Synth.ctx(), E = window.H3Synth.engine();
      const iv = setInterval(() => { const R = window.H3SynthTL.recording(); if (!R || R.at == null) return; clearInterval(iv);
        [0.7, 1.2].forEach((t) => { const o = ctx.createOscillator(); o.connect(E.out); o.start(R.at + (t - R.from)); o.stop(R.at + (t - R.from) + 0.08); });
        setTimeout(res, (R.at + 1.9 - R.from - ctx.currentTime) * 1000); }, 10);
    }));
    await p.click("#syTPlay");
    await p.waitForFunction(() => !window.H3SynthTL.recording() && window.H3SynthTL.tl().layers[1].clips.length === 1, null, { timeout: 20000 });
    const L1 = (await tl()).layers[1]; L1.clips.forEach((c) => made.add(c.src.replace(/^my:/, "")));
    const b1 = await bursts(1);
    check("Punch: recorded from 0.5 s, kept only 1.0 - 1.5 (■ Play stops it); over nothing = a plain clip", Math.abs(L1.clips[0].start - 1) < 1e-6 && Math.abs(L1.clips[0].len - 0.5) < 0.002 && !L1.clips[0].grp && b1.length === 1 && near(b1[0], 1.2 - lat), { c: L1.clips[0], b1 });
    /* ---- a second recording over the clip = takes */
    await ev(() => window.H3SynthTL.seek(0.5)); await p.click("#syTRec"); await sleep(1500); await p.click("#syTRec");
    await p.waitForFunction(() => !window.H3SynthTL.recording() && window.H3SynthTL.tl().layers[1].clips.length === 2, null, { timeout: 20000 });
    const L1b = (await tl()).layers[1]; L1b.clips.forEach((c) => made.add(c.src.replace(/^my:/, "")));
    check("recording again over a clip: it becomes take 1, the new one take 2 (and plays)", L1b.clips.every((c) => c.grp) && L1b.clips.map((c) => c.ti).sort().join() === "0,1" && (await bursts(1)).length === 0, L1b.clips);
    await p.focus("#syTCanvas"); await ev(() => window.H3Synth.undo()); await sleep(150);
    check("↶ undoes it (one clip again)", (await tl()).layers[1].clips.length === 1);
    await ev(() => window.H3SynthTL.setTL(null));
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: the test stopped - " + (e && e.stack || e)); }
  finally {
    try {
      for (const n of made) await ev((nm) => fetch("/api/synth/samples/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: nm }) }), n);
      await ev(() => { Object.keys(localStorage).filter((k) => /^h3\.synth\./.test(k)).forEach((k) => localStorage.removeItem(k)); });
    } catch (e) { /* gone */ }
    await b.close();
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
