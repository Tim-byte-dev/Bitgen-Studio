#!/usr/bin/env node
/* bitGen Studio — 2.963.0 in a REAL browser (Tim: "please put the panel with the filename and 3 knobs top left of the layers. when
 * user clicks a layer it edits the selected layer. allow user to change the names of layers"). Against the running app (H3_URL). */
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
    await p.waitForFunction(() => window.H3Synth && window.H3SynthTL && typeof dsReady !== "undefined" && dsReady && document.querySelector("#synthdock .autabs"), null, { timeout: 60000 });
    await ev(async () => { window.H3Audio.tab("synthdock"); window.toggleMax("synthdock", true); window.H3Synth.fold("rack", true); window.H3Synth.fold("keys", true); window.H3Synth.fold("loop", true);
      window.H3SynthTL.setTL(null); await window.H3SynthTL.addClip("kit:crash", 0, 0); window.H3SynthTL.select(0, null); }); await sleep(400);
    const geo = () => ev(() => { const k = document.getElementById("syTKeyEd").getBoundingClientRect(), c = document.getElementById("syTCanvas").getBoundingClientRect(), hd = document.getElementById("syTHeads").getBoundingClientRect(); return { kx: k.left, ky: k.top, kb: k.bottom, cy: c.top, hx: hd.left, h: k.height }; });
    let g = await geo();
    check("the panel sits top left, above the layers (always there)", Math.abs(g.kx - g.hx) < 4 && g.kb <= g.cy + 1 && g.h > 40 && (await ev(() => document.getElementById("syTKeyEd").classList.contains("on"))), g);
    check("nothing picked on a layer = the layer: its name + Vol / Pan / Filter", (await ev(() => document.getElementById("syTLName").value)) === "Layer 1" && (await ev(() => [...document.querySelectorAll("#syTKeyEd [data-lay]")].map((k) => k.dataset.lay).join()))
      === "vol,pan,cut");
    await p.click('.sytlhead[data-l="2"]', { position: { x: 120, y: 50 } }); await sleep(100);
    check("click a layer = the panel edits that layer", (await ev(() => document.getElementById("syTLName").value)) === "Layer 3" && (await ev(() => window.H3SynthTL.info().sel)) === 2);
    await p.fill("#syTLName", "Drums"); await p.press("#syTLName", "Enter"); await sleep(100);
    check("rename it in the panel (the head follows)", (await tl()).layers[2].name === "Drums" && (await ev(() => document.querySelector('.sytlhead[data-l="2"] input').value)) === "Drums");
    await p.focus("#syTKeyEd [data-lay=\"vol\"]"); for (let i = 0; i < 5; i++) await p.keyboard.press("ArrowDown");
    check("its Vol knob sets the layer", (await tl()).layers[2].vol < 0.95);
    await p.click('.sytlhead[data-l="1"] input'); await p.keyboard.press("Control+a"); await p.keyboard.type("Bass"); await p.keyboard.press("Tab"); await sleep(100);
    check("…or rename it right in its head (click the name, type)", (await tl()).layers[1].name === "Bass" && (await ev(() => document.getElementById("syTLName").value)) === "Bass", (await tl()).layers.map((l) => l.name));
    const before = (await geo()).cy;
    const G = await ev(() => window.H3SynthTL.geo()), cvb = await p.locator("#syTCanvas").boundingBox();
    await p.mouse.click(cvb.x + 0.3 * G.zoom - G.scroll, cvb.y + G.RULER + 30); await sleep(100);
    check("pick a clip = the panel shows its file name + Gain / Fade in / Fade out", /crash/.test(await ev(() => document.getElementById("syTKeyEd").textContent)) && (await ev(() => document.querySelectorAll("#syTKeyEd [data-clip]").length)) === 3);
    check("…and the layers never move", (await geo()).cy === before);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: the test stopped - " + (e && e.stack || e)); }
  finally {
    try { await ev(() => { window.H3SynthTL.setTL(null); Object.keys(localStorage).filter((k) => /^h3\.synth\./.test(k)).forEach((k) => localStorage.removeItem(k)); }); } catch (e) { /* gone */ }
    await b.close();
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
