#!/usr/bin/env node
/* bitGen Studio — 2.448.0 in a REAL browser: THE CONTENT-AWARE FILL WORKSPACE in the image editor (pccafill.js). Tim:
 * "more photoshop features to close the gap" - the Content-Aware Fill workspace. Against the running app (H3_URL,
 * default :8311). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the content-aware fill browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const SHOTS = process.env.SHOTS || "";
let pass = 0, fail = 0;
const check = (n, cond, got) => {
  if (cond) { pass++; console.log("PASS: " + n); }
  else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); }
};

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1700, height: 1000 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message + " @ " + String(e.stack || "").split("\n").slice(1, 3).join(" | ")));
  const ev = (f, a) => p.evaluate(f, a);
  const shot = async (n) => { if (SHOTS) await p.screenshot({ path: path.join(SHOTS, n + ".png") }); };
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.cafill, null, { timeout: 60000 });
    await p.waitForTimeout(600);
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await p.click("#kxFull"); await p.waitForTimeout(800);
    // a picture: green on the left, blue on the right; the hole straddles the middle
    await ev(() => {
      const E = window.imageEditorInstance.E;
      E.docs.setTabs(true); E.openDoc(240, 120, "caf.png", (g) => { g.fillStyle = "#00ff00"; g.fillRect(0, 0, 120, 120); g.fillStyle = "#0000ff"; g.fillRect(120, 0, 120, 120); });
      E.cafill.settings.mode = "auto"; E.cafill.settings.out = "cur"; E.cafill.settings.adapt = "none";
      const m = new Uint8Array(240 * 120); for (let y = 40; y < 80; y++) for (let x = 105; x < 135; x++) m[y * 240 + x] = 255; E.setSel(m);
    });
    const flatPx = (x, y) => ev(([x, y]) => Array.from(window.imageEditorInstance.E.flatten().getContext("2d").getImageData(x, y, 1, 1).data.slice(0, 3)), [x, y]);

    /* 1 Edit ▸ Content-Aware Fill… opens the workspace */
    await ev(() => window.imageEditorInstance.E.ui.run("edit.cafill")); await p.waitForTimeout(900);
    const w1 = await ev(() => { const d = document.getElementById("pcCaFill"), W = window.imageEditorInstance.E.cafill.state(); let n = 0; if (W) for (const v of W.samp) if (v > 127) n++;
      return { open: !!d, view: !!(d && d.querySelector("#cafView")), prev: !!(d && d.querySelector("#cafPrev")), tools: ["cafAdd", "cafSub", "cafSize", "cafMode", "cafReset", "cafShow", "cafAdapt", "cafOut"].every((id) => d && d.querySelector("#" + id)), samp: n, mode: d && d.querySelector("#cafMode").value }; });
    await shot("1-open");
    check("Edit ▸ Content-Aware Fill… opens the WORKSPACE: the picture, the Sampling Brush (+ / −, size), Auto / Rectangular / Custom, Reset, show, Preview, Colour Adaptation, Output To", w1.open && w1.view && w1.prev && w1.tools && w1.mode === "auto" && w1.samp > 500, w1);

    /* 2 the preview is drawn (after its pause) */
    await p.waitForTimeout(900);
    const pv = await ev(() => { const c = document.getElementById("cafPrev"), d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; let ink = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) ink++; return ink; });
    check("the Preview shows the fill (drawn after a short pause)", pv > 500, pv);

    /* 3 the view: the sampling area tinted green, the hole red */
    const tint = await ev(() => { const c = document.getElementById("cafView"), g = c.getContext("2d"), W = window.imageEditorInstance.E.cafill.state(), f = W.fit;
      const at = (x, y) => Array.from(g.getImageData(Math.round(x * f), Math.round(y * f), 1, 1).data.slice(0, 3)); return { hole: at(120, 60), far: at(10, 10) }; });
    check("the picture in it: the hole tinted red (what is filled), away from the sampling area untinted", tint.hole[0] > 60 && JSON.stringify(tint.far) !== JSON.stringify(tint.hole), tint);

    /* 4 the Sampling Brush, − : wipe the LEFT (green) side out of the sampling area -> Custom */
    await ev(() => { const d = document.getElementById("pcCaFill"); d.querySelector("#cafSub").click(); const s = d.querySelector("#cafSize"); s.value = "60"; s.oninput(); });
    const vr = await ev(() => { const r = document.getElementById("cafView").getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width, h: r.height }; });
    await p.mouse.move(vr.l + 0.3 * vr.w, vr.t + 1); await p.mouse.down();
    for (const [fx, fy] of [[0.3, 0], [0.3, 0.999], [0.4, 0.999], [0.4, 0]]) await p.mouse.move(vr.l + fx * vr.w, vr.t + fy * vr.h, { steps: 14 });
    await p.mouse.up(); await p.waitForTimeout(1200);
    const s4 = await ev(() => { const W = window.imageEditorInstance.E.cafill.state(); let left = 0, right = 0; for (let y = 0; y < 120; y++) for (let x = 0; x < 240; x++) if (W.samp[y * 240 + x] > 127) { if (x < 120) left++; else right++; } return { left, right, mode: document.getElementById("cafMode").value }; });
    check("the Sampling Brush (−) takes the left of the sampling area away; the mode becomes Custom", s4.mode === "custom" && s4.left === 0 && s4.right > 300, s4);
    await shot("4-brush");

    /* 5 OK, Output To = New Layer: the fill only from the right = blue all through the hole; one undo */
    await ev(() => { const o = document.getElementById("cafOut"); o.value = "new"; o.onchange(); document.querySelector("#pcCaFill .ok").click(); });
    await p.waitForTimeout(500);
    const r5 = await ev(() => { const E = window.imageEditorInstance.E; return { n: E.S.layers.length, top: E.S.layers[E.S.active].name, gone: !document.getElementById("pcCaFill") }; });
    const h1 = await flatPx(110, 60), h2 = await flatPx(130, 60), out1 = await flatPx(60, 60);
    check("OK with Output To New Layer: a \"Content-Aware Fill\" layer; the hole filled from the sampling area only (blue at 110 and 130), the rest untouched (green at 60)",
      r5.gone && r5.n === 2 && r5.top === "Content-Aware Fill" && h1[2] > 200 && h1[1] < 80 && h2[2] > 200 && out1[1] > 200 && out1[2] < 40, { r5, h1, h2, out1 });
    await ev(() => window.imageEditorInstance.E.undo()); await p.waitForTimeout(200);
    const u5 = await ev(() => window.imageEditorInstance.E.S.layers.length), back = await flatPx(110, 60);
    check("...one undo takes it away", u5 === 1 && back[1] > 200 && back[2] < 40, { u5, back });

    /* 6 Rectangular + Current Layer: the pixel layer itself is filled */
    await ev(() => { const E = window.imageEditorInstance.E, g = E.S.layers[0].canvas.getContext("2d"); g.fillStyle = "#ff0000"; g.fillRect(110, 45, 20, 30); E.refresh && E.refresh(); E.cafill.settings.out = "cur"; E.ui.run("edit.cafill"); });   // a red "object" to remove
    await p.waitForTimeout(400);
    const r6 = await ev(() => { const d = document.getElementById("pcCaFill"), m = d.querySelector("#cafMode"); m.value = "rect"; m.onchange(); const W = window.imageEditorInstance.E.cafill.state(); let n = 0; for (const v of W.samp) if (v > 127) n++; return { n, out: d.querySelector("#cafOut").value }; });
    await ev(() => document.querySelector("#pcCaFill .ok").click()); await p.waitForTimeout(500);
    const r6b = await ev(() => { const E = window.imageEditorInstance.E, c = E.S.layers[0].canvas.getContext("2d"), a = c.getImageData(105, 40, 30, 40).data; let red = 0; for (let i = 0; i < a.length; i += 4) if (a[i] > 150 && a[i + 1] < 90 && a[i + 2] < 90) red++; return { n: E.S.layers.length, red }; });
    check("Rectangular sampling (the box round the hole) + Output To Current Layer: the layer's own pixels are filled (the red object gone), no new layer", r6.n > 1000 && r6.out === "cur" && r6b.n === 1 && r6b.red === 0, { r6, r6b });
    check("the workspace's choices are kept (Rectangular, Current Layer, size 60)", await ev(() => { const s = window.imageEditorInstance.E.cafill.settings; return s.mode === "rect" && s.out === "cur" && s.size === 60; }));
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + e.stack); }
  finally {
    try { await ev(() => { const E = window.imageEditorInstance.E; Object.assign(E.cafill.settings, { mode: "auto", adapt: "default", out: "cur", size: 30, show: true }); E.store.set("caf", E.cafill.settings); }); } catch { /* closed */ }
    await b.close();
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
