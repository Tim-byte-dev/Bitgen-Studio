#!/usr/bin/env node
/* bitGen Studio — 2.962.0 in a REAL browser (Tim: "lets do the last cakewalk item" - the step sequencer: step clips on a layer,
 * edited in a grid, heard hit by hit on the tempo's beats). Against the running app (H3_URL). */
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
    await p.waitForFunction(() => window.H3Synth && window.H3SynthTL && window.H3SynthSteps && typeof dsReady !== "undefined" && dsReady, null, { timeout: 60000 });
    await ev(() => { Object.keys(localStorage).filter((k) => /^h3\.synth\./.test(k)).forEach((k) => localStorage.removeItem(k)); });
    await p.reload({ waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => window.H3Synth && window.H3SynthTL && typeof dsReady !== "undefined" && dsReady && document.querySelector("#synthdock .autabs"), null, { timeout: 60000 });
    await ev(() => { window.H3Audio.tab("synthdock"); window.toggleMax("synthdock", true); window.H3Synth.fold("rack", true); window.H3Synth.fold("keys", true); window.H3Synth.fold("loop", true);
      window.H3SynthTL.setTL({ layers: [{}, {}, {}, {}], tempoOn: true, tempo: [{ t: 0, bpm: 120 }] }); window.H3SynthTL.select(1); window.H3SynthTL.seek(0); }); await sleep(500);
    const hits = (li) => ev(async (i) => { const r = await window.H3SynthTL.render(48000, i); const d = r.chans[0], o = []; let last = -1e9; for (let k = 0; k < d.length; k++) if (Math.abs(d[k]) > 0.02) { if (k - last > 0.03 * 48000) o.push(+(k / 48000).toFixed(3)); last = k; } return o; }, li);   // a hit = loud after 30 ms of quiet
    await p.click("#syTSteps"); await sleep(150);
    let c = (await tl()).layers[1].clips[0], inf = await ev(() => window.H3SynthSteps.info());
    check("＋ ▦ Steps: a step clip on the picked layer at the playhead, one bar (2 s at 120), the sequencer open (4 rows x 16)", c && c.kind === "steps" && c.start === 0 && Math.abs(c.len - 2) < 1e-6 && inf && inf.rows === 4 && inf.n === 16, { c, inf });
    check("…the default beat: kick + snare + 8 hats (the first of each beat accented)", inf.on + inf.acc === 12 && inf.acc === 8, inf);
    // clear it, then: kick on steps 0 and 8 only
    await ev(() => { const cc = window.H3SynthTL.tl().layers[1].clips[0]; cc.rows.forEach((r) => { r.hits = r.hits.map(() => 0); }); window.H3SynthSteps.close(); window.H3SynthTL.openSteps(1, 0); });
    const cellSel = (r, s) => `#syStepGrid [data-r="${r}"][data-s="${s}"]`;
    await p.click(cellSel(0, 0)); await p.click(cellSel(0, 8));
    c = (await tl()).layers[1].clips[0];
    check("click a cell = on", c.rows[0].hits[0] === 1 && c.rows[0].hits[8] === 1 && c.rows[0].hits.filter(Boolean).length === 2);
    await p.click(cellSel(0, 8));
    check("…again = accent", (await tl()).layers[1].clips[0].rows[0].hits[8] === 2 && (await ev(() => window.H3SynthSteps.info().acc)) === 1);
    await p.click(cellSel(0, 8), { button: "right" });
    check("right-click = off", (await tl()).layers[1].clips[0].rows[0].hits[8] === 0);
    await p.click(cellSel(0, 8));
    const b1 = await p.locator(cellSel(3, 0)).boundingBox(), b2 = await p.locator(cellSel(3, 3)).boundingBox();
    await p.mouse.move(b1.x + 4, b1.y + 8); await p.mouse.down(); await p.mouse.move(b2.x + 4, b2.y + 8, { steps: 8 }); await p.mouse.up();
    check("drag across = paints", (await tl()).layers[1].clips[0].rows[3].hits.slice(0, 4).join() === "1,1,1,1", (await tl()).layers[1].clips[0].rows[3].hits);
    await ev(() => { window.H3SynthTL.tl().layers[1].clips[0].rows[3].hits = Array(16).fill(0); });
    let h = await hits(1);
    check("heard: the kick on steps 1 and 9 = 0 s and 1 s (120 BPM)", h.length === 2 && Math.abs(h[0]) < 0.02 && Math.abs(h[1] - 1) < 0.02, h);
    await ev(() => { window.H3SynthTL.tl().tempo = [{ t: 0, bpm: 120 }, { t: 0.5, bpm: 60 }]; window.H3SynthTL.draw(); });
    h = await hits(1);
    check("…it follows the tempo track (120 BPM to 0.5 s, then 60: step 9 = the 3rd beat = 0.5 + 1 s)", h.length === 2 && Math.abs(h[1] - 1.5) < 0.02, h);
    await ev(() => { window.H3SynthTL.tl().tempo = [{ t: 0, bpm: 120 }]; });
    await p.selectOption("#syStepN", "8");
    c = (await tl()).layers[1].clips[0];
    check("Steps 8: the pattern is 8 long (a hit every half bar now repeats twice a bar)", c.n === 8 && c.rows[0].hits.length === 8 && (await hits(1)).length === 2);
    await p.selectOption("#syStepN", "16");
    check("…back to 16: it repeats into the new steps", (await tl()).layers[1].clips[0].rows[0].hits.join() === "1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0");
    await p.selectOption('#syStepGrid [data-snd="0"]', "kit:clap");
    check("a row's sound", (await tl()).layers[1].clips[0].rows[0].src === "kit:clap");
    await p.click("#syStepAdd"); const r5 = (await tl()).layers[1].clips[0].rows.length;
    await p.click('#syStepGrid [data-delrow="4"]');
    check("＋ Row / 🗑 a row", r5 === 5 && (await tl()).layers[1].clips[0].rows.length === 4);
    await ev(() => { const cc = window.H3SynthTL.tl().layers[1].clips[0]; cc.rows[0].hits = Array(16).fill(0); cc.rows[0].hits[1] = 1; });
    await p.locator("#syStepSwing").fill("0.5"); await ev(() => document.getElementById("syStepSwing").dispatchEvent(new Event("input", { bubbles: true })));
    h = await hits(1);
    check("Swing 50%: step 2 plays half a step late (0.1875 s, not 0.125)", (await tl()).layers[1].clips[0].swing === 0.5 && h.length === 1 && Math.abs(h[0] - 0.1875) < 0.02, h);
    await p.keyboard.press("Escape"); await sleep(100);
    check("Esc closes the sequencer (and leaves the tab full-window)", !(await ev(() => window.H3SynthSteps.isOpen())) && (await ev(() => document.body.classList.contains("sy-full"))));
    await ev(() => { const cc = window.H3SynthTL.tl().layers[1].clips[0]; cc.swing = 0; cc.rows[0].hits = Array(16).fill(0); cc.rows[0].hits[0] = 2; cc.len = 6; window.H3SynthTL.draw(); });
    h = await hits(1);
    check("a longer clip repeats the pattern (3 bars = 3 hits)", h.length === 3 && Math.abs(h[2] - 4) < 0.02, h);
    await ev(() => { window.H3SynthTL.select(1, 0); window.H3SynthTL.seek(1); });
    check("✂ refuses a step clip", (await ev(() => window.H3SynthTL.split())) === false);
    const G = await ev(() => window.H3SynthTL.geo()), cvb = await p.locator("#syTCanvas").boundingBox();
    await p.mouse.dblclick(cvb.x + 3 * G.zoom - G.scroll, cvb.y + G.RULER + G.LH + G.LH / 2); await sleep(150);
    check("double-click the clip = the sequencer", await ev(() => window.H3SynthSteps.isOpen()));
    await ev(() => window.H3SynthSteps.close());
    const kept = await ev(() => { const j = JSON.parse(JSON.stringify(window.H3SynthTL.tl())); window.H3SynthTL.setTL(j); return window.H3SynthTL.tl().layers[1].clips[0]; });
    check("kept with the timeline", kept.kind === "steps" && kept.rows[0].hits[0] === 2 && kept.len === 6);
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
