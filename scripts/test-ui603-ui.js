#!/usr/bin/env node
/* bitGen Studio — 2.603.0 in a REAL browser: A RANGE ON ONE LAYER (the position marker, then Shift+click on the layer),
 * ✂ Cut removes it from that layer only, all of it, and the timeline's UNDO (ext/timelinedock/tlrange.js).
 * Tim: "selecting range in timeline is not intuitive. lets drag the timeline marker to the start of the range then
 * shift+click on a different part of the layer and that will be our range in that layer - cut will remove the range in
 * the selected layer only completely(must be able to undo)".
 *   I1: two pictures 0-4 s and 5-8 s; I2: one picture 0-8 s. The marker at 2 s, Shift+click on I1 at 6 s:
 *   the range 2-6 s, I1 highlighted, drawn on I1's row. ✂ Cut (ripple off, the scope box on "clip" - a layer range
 *   ignores it): I1 = 0-2 and 6-8, I2 untouched. Ctrl+Z over the layers: back as it was; Ctrl+Shift+Z: cut again;
 *   ↶: back. With ripple: I1 = 0-2, 2-4 (the gap closed on I1 only). Shift+drag: the end follows the pointer; a ruler
 *   drag afterwards is a plain selection again. No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.603.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 2000, height: 1200 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  const clips = (i) => ev((i) => tl.images[i].clips.map((c) => [+(+c.start).toFixed(2), +(+c.start + +c.len).toFixed(2)]), i);
  const at = (lk, t) => ev(([lk, t]) => { const inner = document.getElementById("tlinner"), tr = inner.querySelector('.tltrack[data-lk="' + lk + '"]'); tr.scrollIntoView({ block: "center" }); const ri = inner.getBoundingClientRect(), rt = tr.getBoundingClientRect(); return [ri.left + LABW + t * PXS, rt.top + rt.height / 2]; }, [lk, t]);
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.TlRange && window.TlKeys && document.getElementById("tlinner") && document.getElementById("tlUndo"), null, { timeout: 60000 });
    await p.waitForTimeout(800);
    await ev(() => {
      const d = document.getElementById("timelinedock");
      if (/collapsed|dockgone/.test(d.className) && typeof toggleCollapse === "function") toggleCollapse("timelinedock");
      if (typeof setVar === "function") setVar("th", 700);
      tl.video = []; tl.vlayers = []; tl.audio = [];
      tl.images = [mkLayer("I1", [{ name: "a.png", start: 0, len: 4, opacity: 1 }, { name: "b.png", start: 5, len: 3, opacity: 1 }]), mkLayer("I2", [{ name: "c.png", start: 0, len: 8, opacity: 1 }])];
      tl.sel = null; tlSave(); renderTimeline();
      document.getElementById("tlRipple").checked = false; document.getElementById("tlScope").value = "clip";
    });
    await p.waitForTimeout(300);
    const und0 = await ev(() => TlRange.sizes()[0]);
    // the marker to 2 s (the position marker - as dragging it does), then Shift+click on I1 at 6 s (on its 2nd picture)
    await ev(() => tlGoto(2));
    await p.keyboard.down("Shift"); await p.mouse.click(...(await at("i:0", 6))); await p.keyboard.up("Shift");
    await p.waitForTimeout(300);
    const s1 = await ev(() => ({ sel: tl.sel && { a: tl.sel.a, b: tl.sel.b, layer: tl.sel.layer }, lk: tl.selLayer, row: !!document.querySelector('.tltrack[data-lk="i:0"] .tlrsel'), other: !!document.querySelector('.tltrack[data-lk="i:1"] .tlrsel'), moved: tl.images[0].clips[1].start }));
    check("the marker at 2 s, Shift+click on I1 at 6 s: the range 2-6 s ON I1 (I1 highlighted, the range drawn on its row only), nothing moved",
      s1.sel && s1.sel.a === 2 && s1.sel.b === 6 && s1.sel.layer === true && s1.lk === "i:0" && s1.row && !s1.other && s1.moved === 5, s1);
    await p.click("#tlCutSel"); await p.waitForTimeout(400);
    const c1 = [await clips(0), await clips(1)];
    check("✂ Cut (ripple off, the scope box on 'clip'): the WHOLE range is gone from I1 - 0-2 and 6-8 left; I2 untouched",
      JSON.stringify(c1) === JSON.stringify([[[0, 2], [6, 8]], [[0, 8]]]), c1);
    check("…one undo step more", (await ev(() => TlRange.sizes()[0])) === und0 + 1, await ev(() => TlRange.sizes()));
    await p.mouse.move(...(await at("i:1", 10))); await p.waitForTimeout(100);
    await p.keyboard.press("Control+z"); await p.waitForTimeout(400);
    const c2 = [await clips(0), await clips(1)];
    check("Ctrl+Z over the layers: back exactly as it was", JSON.stringify(c2) === JSON.stringify([[[0, 4], [5, 8]], [[0, 8]]]), c2);
    await p.keyboard.press("Control+Shift+z"); await p.waitForTimeout(400);
    check("Ctrl+Shift+Z: cut again", JSON.stringify(await clips(0)) === JSON.stringify([[0, 2], [6, 8]]), await clips(0));
    await p.click("#tlUndo"); await p.waitForTimeout(400);
    check("↶ in the menu bar undoes too", JSON.stringify(await clips(0)) === JSON.stringify([[0, 4], [5, 8]]), await clips(0));
    // ripple: the gap closes on I1 only
    await ev(() => { document.getElementById("tlRipple").checked = true; tlGoto(2); });
    await p.keyboard.down("Shift"); await p.mouse.click(...(await at("i:0", 6))); await p.keyboard.up("Shift"); await p.waitForTimeout(300);
    await p.click("#tlCutSel"); await p.waitForTimeout(400);
    const c3 = [await clips(0), await clips(1)];
    check("with ripple: I1 closes the gap (0-2, 2-4) - I2 still 0-8", JSON.stringify(c3) === JSON.stringify([[[0, 2], [2, 4]], [[0, 8]]]), c3);
    await p.click("#tlUndo"); await p.waitForTimeout(400);
    check("…and ↶ brings it back", JSON.stringify(await clips(0)) === JSON.stringify([[0, 4], [5, 8]]), await clips(0));
    // Shift+drag: the end follows the pointer
    await ev(() => tlGoto(1));
    await p.keyboard.down("Shift"); await p.mouse.move(...(await at("i:1", 3))); await p.mouse.down(); await p.mouse.move(...(await at("i:1", 5)), { steps: 5 }); await p.mouse.move(...(await at("i:1", 7)), { steps: 5 }); await p.mouse.up(); await p.keyboard.up("Shift");
    await p.waitForTimeout(300);
    const s4 = await ev(() => ({ a: tl.sel && tl.sel.a, b: tl.sel && tl.sel.b, layer: tl.sel && tl.sel.layer, lk: tl.selLayer }));
    check("Shift+drag on I2: the range from the marker (1 s) to where the pointer let go (7 s), on I2", s4.a === 1 && s4.b === 7 && s4.layer === true && s4.lk === "i:1", s4);
    // a ruler drag is a plain selection (the scope box rules again)
    await ev(() => { document.getElementById("tlscroll").scrollTop = 0; });
    const rr = await ev(() => { const r = document.querySelector("#tlinner .tlruler").getBoundingClientRect(), inner = document.getElementById("tlinner").getBoundingClientRect(); const y = r.top + r.height / 2, x0 = inner.left + LABW + 3 * PXS, el = document.elementFromPoint(x0, y); return { y, x0, x1: inner.left + LABW + 4 * PXS, el: el && (el.className || el.id || el.tagName) }; });
    await p.mouse.move(rr.x0, rr.y); await p.mouse.down(); await p.mouse.move(rr.x1, rr.y, { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(300);
    const s5 = await ev(() => ({ a: tl.sel && tl.sel.a, b: tl.sel && tl.sel.b, layer: !!(tl.sel && tl.sel.layer), row: !!document.querySelector(".tlrsel") }));
    check("a ruler drag afterwards = a plain selection (not a layer range, nothing drawn on a row)", s5.a === 3 && s5.b === 4 && !s5.layer && !s5.row, s5);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + (e && e.stack || e)); }
  finally {
    try { await ev(() => { tl.video = []; tl.vlayers = []; tl.images = []; tl.audio = []; tl.sel = null; tlSave(); renderTimeline(); }); } catch { /* closed */ }
    try { await b.close(); } catch { /* fine */ }
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
