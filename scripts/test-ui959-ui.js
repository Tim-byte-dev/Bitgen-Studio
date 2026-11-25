#!/usr/bin/env node
/* bitGen Studio — 2.959.0 in a REAL browser (Tim: "continue next please" - automation lanes for Pan / Filter / Rev drawn over a
 * layer, a per-layer lowpass Filter knob, ⤓ bounce a layer to audio). Against the running app (H3_URL). */
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
  const madeSamples = [];
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => window.H3Synth && window.H3SynthMix && window.H3SynthTL && typeof dsReady !== "undefined" && dsReady, null, { timeout: 60000 });
    await ev(() => { Object.keys(localStorage).filter((k) => /^h3\.synth\./.test(k)).forEach((k) => localStorage.removeItem(k)); });
    await p.reload({ waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => window.H3Synth && window.H3SynthTL && typeof dsReady !== "undefined" && dsReady && document.querySelector("#synthdock .autabs"), null, { timeout: 60000 });
    await ev(() => { window.H3Audio.tab("synthdock"); window.toggleMax("synthdock", true); window.H3Synth.fold("rack", true); window.H3Synth.fold("keys", true); window.H3Synth.fold("loop", true); }); await sleep(600);
    await ev(async () => { window.H3SynthTL.setTL(null); await window.H3SynthTL.addClip("kit:crash", 0, 0); await window.H3SynthTL.addClip("kit:boom", 1, 0.25); });
    const pk = (r, c) => { let m = 0; for (const x of r) m = Math.max(m, Math.abs(x)); return m; };
    /* ---- the lane picker */
    const opts = await ev(() => [...document.querySelectorAll('.sytlhead[data-l="0"] select.sytlview option')].map((o) => o.value).join());
    check("each layer's head: a lane picker (◆ Vol / Pan / Filter / Rev) and ⤓", opts === "vol,pan,cut,rev" && (await ev(() => document.querySelectorAll(".sytlhead [data-bounce]").length)) >= 2, opts);
    await p.selectOption('.sytlhead[data-l="0"] select.sytlview', "cut"); await sleep(100);
    check("…Filter picked: the layer shows its Filter lane", (await ev(() => window.H3SynthTL.info().views[0])) === "cut");
    /* ---- points by mouse */
    const G = await ev(() => window.H3SynthTL.geo()), cvb = await p.locator("#syTCanvas").boundingBox();
    const X = (t) => cvb.x + t * G.zoom - G.scroll, Y = (li, v) => cvb.y + 22 + li * 64 + 16 + (64 - 21) * (1 - v);
    await p.mouse.dblclick(X(0.25), Y(0, 0.9)); await sleep(100);
    await p.mouse.dblclick(X(1), Y(0, 0.1)); await sleep(100);
    let au = (await tl()).layers[0].auto.cut;
    check("double-click the layer = a point on the lane (time + value from where you click)", au.length === 2 && au[0].t < au[1].t && au[0].v > 0.8 && au[1].v < 0.2, au);
    check("…the clip under it was not touched (no keyframe, no roll)", (await tl()).layers[0].keys.length === 0 && !(await ev(() => !!document.querySelector("#syRollBack.on"))));
    await p.mouse.move(X(1), Y(0, 0.1)); await p.mouse.down(); await p.mouse.move(X(1), Y(0, 0.5), { steps: 4 }); await p.mouse.up(); await sleep(100);
    au = (await tl()).layers[0].auto.cut;
    check("drag a point = a new value", au.length === 2 && au[1].v > 0.4 && au[1].v < 0.6, au);
    await p.mouse.click(X(1), Y(0, au[1].v), { button: "right" }); await sleep(100);
    check("right-click a point = gone", (await tl()).layers[0].auto.cut.length === 1);
    await p.mouse.click(X(0.25), Y(0, (await tl()).layers[0].auto.cut[0].v)); await p.keyboard.press("Delete"); await sleep(100);
    check("…or select it + Delete", (await tl()).layers[0].auto.cut.length === 0 && (await tl()).layers[0].clips.length === 1);
    /* ---- heard */
    const open = await ev(async () => { const r = await window.H3SynthTL.render(48000, 0); let m = 0; for (const x of r.chans[0]) m = Math.max(m, Math.abs(x)); return m; });
    await ev(() => { const l = window.H3SynthTL.tl().layers[0]; l.auto.cut = [{ t: 0, v: 0 }]; });
    const shut = await ev(async () => { const r = await window.H3SynthTL.render(48000, 0); let m = 0; for (const x of r.chans[0]) m = Math.max(m, Math.abs(x)); return m; });
    check("the Filter lane is heard (a crash through a 40 Hz lowpass is far quieter than open)", open > 0.01 && shut < open * 0.5, { open, shut });
    await ev(() => { const l = window.H3SynthTL.tl().layers[0]; l.auto.cut = []; l.auto.pan = [{ t: 0, v: 0 }]; });
    const lr = await ev(async () => { const r = await window.H3SynthTL.render(48000, 0); const m = (d) => { let x = 0; for (const s of d) x = Math.max(x, Math.abs(s)); return x; }; return [m(r.chans[0]), m(r.chans[1])]; });
    check("the Pan lane is heard (all the way left: the right channel silent)", lr[0] > 0.01 && lr[1] < lr[0] * 0.05, lr);
    await ev(() => { window.H3SynthTL.tl().layers[0].auto.pan = []; window.H3SynthTL.changedFx(); });
    await p.selectOption('.sytlhead[data-l="0"] select.sytlview', "rev"); await sleep(50);
    await p.mouse.dblclick(X(0.1), Y(0, 0.8)); await sleep(50);
    check("a lane with points is marked • in the picker", /Rev •/.test(await ev(() => document.querySelector('.sytlhead[data-l="0"] select.sytlview').selectedOptions[0].textContent)));
    await ev(() => window.H3SynthTL.seek(0)); await p.click("#syTPlay"); await sleep(400); await p.click("#syTPlay");
    check("▶ plays with lanes (no errors)", errs.length === 0, errs);
    /* ---- the mixer's Filter knob */
    await p.click("#syTMixBtn"); await sleep(200);
    await p.focus('#syMix .systrip[data-l="1"] [data-mix="cut"]'); for (let i = 0; i < 8; i++) await p.keyboard.press("ArrowDown");
    const cut = (await tl()).layers[1].fx.cut;
    check("🎚 Mixer: a Filter knob per strip (down = darker, log scale)", cut < 20000 && cut > 40, cut);
    await p.click("#syTMixBtn");
    /* ---- bounce */
    const n0 = (await tl()).layers.length;
    await p.click('.sytlhead[data-l="1"] [data-bounce]');
    await p.waitForFunction(() => window.H3SynthTL.tl().layers.some((l) => / \(bounced\)$/.test(l.name) && l.clips.length), null, { timeout: 20000 });
    const T2 = await tl(), bl = T2.layers.find((l) => / \(bounced\)$/.test(l.name));
    madeSamples.push(bl.clips[0].src.replace(/^my:/, ""));
    check("⤓ Bounce: a new layer \"Layer 2 (bounced)\" with one sound from 0; the original muted", bl.name === "Layer 2 (bounced)" && bl.clips.length === 1 && bl.clips[0].start === 0 && /^my:bounce /.test(bl.clips[0].src) && T2.layers[1].mute && T2.layers.length >= n0, bl);
    const bounced = await ev(async (i) => { const r = await window.H3SynthTL.render(48000, i); let m = 0; for (const x of r.chans[0]) m = Math.max(m, Math.abs(x)); return m; }, T2.layers.indexOf(bl));
    check("…the bounced layer sounds", bounced > 0.005, bounced);
    await ev(() => window.H3SynthTL.setTL(null));
    const dead = await ev(() => window.H3SynthTL.bounce(0));
    check("…an empty layer: nothing to bounce (no new layer)", dead === null && (await tl()).layers.length === 4);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: the test stopped - " + (e && e.stack || e)); }
  finally {
    try {
      for (const n of madeSamples) await ev((nm) => fetch("/api/synth/samples/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: nm }) }), n);
      await ev(() => { Object.keys(localStorage).filter((k) => /^h3\.synth\./.test(k)).forEach((k) => localStorage.removeItem(k)); });
    } catch (e) { /* gone */ }
    await b.close();
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
