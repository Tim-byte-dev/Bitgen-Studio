#!/usr/bin/env node
/* bitGen Studio — 2.687.0 in a REAL browser: THE SKETCHER'S SKETCH PLANE IS NOT DRAWN. A face clicked with ➤ Select is still the
 * sketch plane (the ✎ chip names it, ⊥ Look at, the tools draw in it - test-ui663), but no orange square / grid is drawn over
 * it any more; a KEPT plane (📌 - a construction plane) keeps its own faint outline.
 * Tim (verbatim): "when clicking on a face keep the face as a plane but do not show the plane grid - there is too much on the
 * screen"
 * Against the running app (H3_URL). No Playwright = SKIP. SHOT=<file.png> also saves a picture of the view. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.687.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1500, height: 950 } });
  const errs = []; p.on("pageerror", (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
  const ev = (f, a) => p.evaluate(f, a);
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3PushPull && window.PPSketchPlane && document.getElementById("tX_pushpulldock"), null, { timeout: 60000 });
    await ev(() => { const d = document.getElementById("pushpulldock"); if (d.classList.contains("dockgone")) toggleDockGone("pushpulldock", "tX_pushpulldock"); localStorage.setItem("h3.dockmax.off", "1"); H3PushPullFrame.toggleMaxed(true); });
    await p.waitForFunction(() => H3PushPull.state.booted && H3PushPull.state.TV && H3PushPull.state.M && document.getElementById("ppLookAt"), null, { timeout: 40000 });
    // the saved model opens a moment after boot ("📂 …") - build the test room after it, or the open replaces it
    await p.waitForFunction(() => /📂/.test((document.getElementById("ppMsg") || {}).textContent || ""), null, { timeout: 15000 }).catch(() => {});
    await p.waitForTimeout(800);
    await ev(() => { const S = H3PushPull.state, b0 = H3PushPull.snapshot(); S.M.arch = PPArch.empty(); PPArch.addRoom(S.M.arch, PPArch.rectPts([0, 0], [6, 4]), true); H3PushPull.commit("rooms", b0); S.T.use("select"); S.V.view("iso"); S.V.extents(); });
    await p.waitForTimeout(400);
    check("(the test room is in the Sketcher)", await ev(() => H3PushPull.state.M.arch.rooms.length === 1));
    const scr = (x, y, z) => ev(([x, y, z]) => { const S = H3PushPull.state, s = S.V.screen([x, y, z]), r = S.V.canvas.getBoundingClientRect(); return [r.left + s[0], r.top + s[1]]; }, [x, y, z]);
    // the first click picks the wall - its panel opens and the view settles (test-ui663 does the same) - then the face
    for (let i = 0; i < 3; i++) { const f = await scr(1, 0, 1.2); await p.mouse.click(f[0], f[1]); await p.waitForTimeout(900); if (await ev(() => !!PPSketchPlane.get())) break; }
    const st = await ev(() => { const S = H3PushPull.state, g = S.V.scene.getObjectByName("pp-plane-ui"), s = PPSketchPlane.get();
      return { plane: !!s, n: s && s.n.map((v) => +v.toFixed(3)), chip: getComputedStyle(document.getElementById("ppPlaneChip")).display !== "none" && /✎/.test(document.getElementById("ppPlaneChip").textContent), drawn: g ? g.children.length : 0 }; });
    check("➤ a wall's face clicked: it is the sketch plane (facing -y), the ✎ chip names it", st.plane && st.n[1] === -1 && st.chip, st);
    check("…and NOTHING is drawn over it - no orange square, no grid", st.drawn === 0, st);
    if (process.env.SHOT) await p.screenshot({ path: process.env.SHOT });
    await ev(() => document.getElementById("ppLookAt").click()); await p.waitForTimeout(300);
    check("⊥ Look at still turns to it - and still nothing drawn over it", await ev(() => !!PPSketchPlane.get() && H3PushPull.state.V.scene.getObjectByName("pp-plane-ui").children.length === 0));
    await ev(() => H3PushPull.state.T.use("rect")); await p.waitForTimeout(100);
    const r0 = await scr(1.5, -0.075, 0.5), r1 = await scr(2.5, -0.075, 1.5);
    await p.mouse.click(r0[0], r0[1]); await p.waitForTimeout(100); await p.mouse.click(r1[0], r1[1]); await p.waitForTimeout(300);
    const face = await ev(() => { const M = H3PushPull.state.M; return M.v.length >= 4 ? M.v.slice(-4).map((v) => +v[1].toFixed(2)) : []; });
    check("▭ a rectangle still draws IN that plane (every corner on the wall's face)", face.length === 4 && face.every((y) => Math.abs(y - face[0]) < 0.01), face);
    await ev(() => H3PushPull.state.T.use("select"));
    await p.click("#ppPlaneKeep"); await p.waitForTimeout(300);
    const kept = await ev(() => { let n = 0; H3PushPull.state.V.scene.traverse((o) => { if (o.isLineSegments && o.material && o.material.isLineDashedMaterial) n++; }); return n; });
    check("📌 kept as a construction plane: that one keeps its faint dashed outline", kept >= 1, kept);
    await ev(() => PPSketchPlane.clear());
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: the test stopped - " + (e.stack || e.message)); }
  await b.close();
  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
