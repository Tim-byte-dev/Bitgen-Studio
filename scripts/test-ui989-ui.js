#!/usr/bin/env node
/* bitGen Studio — 2.989.0 in a REAL browser: the Sketcher's picture for the image editor has a TRANSPARENT background (no sky,
 * no ground) and the model in it; the view itself keeps its sky / ground. Tim: "sketcher should render a transparent background
 * when scene is sent to image-editor ..." */
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
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
(async () => {
  if (!chromium) { console.log("SKIP: playwright is not installed here"); console.log("\nRESULT: 0 passed, 0 failed"); return; }
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] }), p = await b.newPage({ viewport: { width: 1700, height: 1000 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && document.getElementById("tX_pushpulldock"), null, { timeout: 60000 });
    await ev(() => { const d = document.getElementById("pushpulldock"); if (d.classList.contains("dockgone")) toggleDockGone("pushpulldock", "tX_pushpulldock"); });
    await p.waitForFunction(() => H3PushPull.state.booted && H3PushPull.state.V, null, { timeout: 40000 });
    await p.waitForTimeout(1200); await ev(() => H3PushPull.newModel()); await p.waitForFunction(() => !H3PushPull.state.M.f.length, null, { timeout: 10000 });
    await ev(() => { const G = PPGeo, S = H3PushPull.state, before = H3PushPull.snapshot(); const F = G.addFace(S.M, [[0, 0, 0], [2, 0, 0], [2, 2, 0], [0, 2, 0]]); G.pushPull(S.M, F.id, 1.5); H3PushPull.commit("t", before); S.V.extents(); S.V.shadows(true); });
    const r = await ev(() => {
      const V = H3PushPull.state.V, alpha = (c) => { const t = document.createElement("canvas"); t.width = c.width; t.height = c.height; const g = t.getContext("2d"); g.drawImage(c, 0, 0); const d = g.getImageData(0, 0, c.width, c.height).data; let clear = 0, solid = 0; for (let i = 3; i < d.length; i += 4) { if (d[i] === 0) clear++; else if (d[i] === 255) solid++; } return { clear, solid, n: d.length / 4, corner: d[3] }; };
      const tr = alpha(V.shot(320, 240, { clean: true, transparent: true })), op = alpha(V.shot(320, 240, { clean: true }));
      const fc = V.shot(320, 240, { clean: true, photo: true, fill: 0x808080 }), t2 = document.createElement("canvas"); t2.width = 320; t2.height = 240; const g2 = t2.getContext("2d"); g2.drawImage(fc, 0, 0); const k = [...g2.getImageData(2, 2, 1, 1).data].slice(0, 3);
      return { tr, op, groundAfter: V.ground.visible, fill: k };
    });
    check("→ the image editor's picture: a TRANSPARENT background (no sky, no ground) with the model solid in it", r.tr.corner === 0 && r.tr.clear > r.tr.n * 0.4 && r.tr.solid > 500, r.tr);
    check("…the view keeps its own background and ground (put back after the shot)", r.op.corner === 255 && r.op.clear === 0 && r.groundAfter === true, r);
    check("2.990.0 a photo with words: the model on a flat grey round it (no sky / ground) - the place comes from the prompt", r.fill.every((v) => Math.abs(v - 128) <= 3) && r.groundAfter === true, r.fill);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { check("ran without throwing", false, String(e && e.stack || e)); }
  await b.close();
  console.log("\nRESULT: " + pass + " passed, " + fail + " failed");
  process.exitCode = fail ? 1 : 0;
})();
