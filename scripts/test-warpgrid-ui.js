#!/usr/bin/env node
/* bitGen Studio — 2.450.0 in a REAL browser: the WARP GRID + SPLIT LINES and the LIQUIFY EXTRAS (Smooth, Push Left,
 * Face-Aware Liquify) - pcwarp.js / pcmesh.js. Tim: "more photoshop features to close the gap" - warp grid + liquify
 * extras. Against the running app (H3_URL, default :8311). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the warp grid / liquify extras browser test did not run"); process.exit(0); }
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
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.warp && window.imageEditorInstance.E.warp.setGrid, null, { timeout: 60000 });
    await p.waitForTimeout(600);
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await p.click("#kxFull"); await p.waitForTimeout(800);
    await ev(() => {
      const E = window.imageEditorInstance.E;
      E.docs.setTabs(true); E.openDoc(600, 400, "warp.png", (g) => { g.fillStyle = "#ffffff"; g.fillRect(0, 0, 600, 400); });
      E.newLayer(); const L = E.layer(), g = L.canvas.getContext("2d"); for (let y = 100; y < 300; y += 20) for (let x = 200; x < 400; x += 20) { g.fillStyle = ((x + y) / 20) % 2 ? "#ff0000" : "#0000ff"; g.fillRect(x, y, 20, 20); } L.ver++; E.refresh();
    });
    const T = async (x, y) => { const v = await ev(() => { const s = window.imageEditorInstance.state; return { z: s.zoom, x: s.panX, y: s.panY }; }); const r = await p.locator("#ieStage").boundingBox(); return [r.x + v.x + x * v.z, r.y + v.y + y * v.z]; };
    const Q = () => ev(() => { const q = window.imageEditorInstance.E.warp.state(); return q ? { n: q.warp && q.warp.length, G: q.wgrid ? JSON.parse(JSON.stringify(q.wgrid)) : null, split: q.split || null, mode: q.mode } : null; });

    /* 1 Warp: the Grid menu */
    await ev(() => window.imageEditorInstance.E.warp.startQ("warp")); await p.waitForTimeout(300);
    const has = await ev(() => ["xfWG", "xfGC", "xfGR"].every((id) => document.getElementById(id)) && document.querySelectorAll("[data-xfsplit]").length === 3);
    await ev(() => { const s = document.getElementById("xfWG"); s.value = "3"; s.dispatchEvent(new Event("change")); }); await p.waitForTimeout(250);
    const q1 = await Q();
    const same1 = await ev(() => { const E = window.imageEditorInstance.E, L = E.layer(); E.renderSoon && E.renderSoon(); return null; });
    void same1;
    check("Edit ▸ Transform ▸ Warp: Grid (Default / 3 x 3 / 4 x 4 / 5 x 5 / Custom + columns x rows) and the three Split buttons in the options bar; Grid 3 x 3 = 3 x 3 patches (10 x 10 points)",
      has && q1.n === 100 && q1.G && q1.G.c === 3 && q1.G.r === 3, { has, q1 });
    await ev(() => { const c = document.getElementById("xfGC"), r = document.getElementById("xfGR"); c.value = "2"; r.value = "4"; c.dispatchEvent(new Event("change")); }); await p.waitForTimeout(250);
    const q2 = await Q(), wgSel = await ev(() => document.getElementById("xfWG").value);
    check("...a custom grid (2 columns x 4 rows): 7 x 13 points, the menu says Custom", q2.n === 91 && q2.G.c === 2 && q2.G.r === 4 && wgSel === "custom", { q2, wgSel });
    await ev(() => { const s = document.getElementById("xfWG"); s.value = "1"; s.dispatchEvent(new Event("change")); }); await p.waitForTimeout(200);

    /* 2 Split crosswise where clicked; a grid point dragged bends only its patches */
    await p.click('[data-xfsplit="cross"]'); await p.waitForTimeout(150);
    const [cx, cy] = await T(250, 150); await p.mouse.click(cx, cy); await p.waitForTimeout(250);
    const q3 = await Q();
    check("Split Warp Crosswise + a click at (250, 150): a vertical and a horizontal split line there (2 x 2 patches, knots at 0.25 / 0.25)",
      q3.G && q3.G.c === 2 && q3.G.r === 2 && Math.abs(q3.G.us[1] - 0.25) < 0.05 && Math.abs(q3.G.vs[1] - 0.25) < 0.05, q3);
    await p.click('[data-xfsplit="cross"]'); await p.waitForTimeout(150);         // split mode off
    const before = await ev(() => Array.from(window.imageEditorInstance.E.layer().canvas.getContext("2d").getImageData(0, 0, 600, 400).data.filter((v, i) => i % 4 === 3)).reduce((a, v) => a + (v > 0 ? 1 : 0), 0));
    // the anchor where the split lines cross is lattice point (3, 3) of 7 x 7
    const anchor = await ev(() => { const q = window.imageEditorInstance.E.warp.state(); return q.warp[3 * 7 + 3]; });
    const [ax, ay] = await T(anchor[0], anchor[1]), [bx, by] = await T(anchor[0] - 30, anchor[1] - 30);
    await p.mouse.move(ax, ay); await p.mouse.down(); await p.mouse.move(bx, by, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(300);
    const moved = await ev(() => { const q = window.imageEditorInstance.E.warp.state(); return { a: q.warp[3 * 7 + 3], h: q.warp[3 * 7 + 4], far: q.warp[6 * 7 + 6] }; });
    await shot("2-split");
    check("...dragging the crossing point moves it with its handles; the far corner stays", Math.abs(moved.a[0] - (anchor[0] - 30)) < 3 && Math.abs(moved.a[1] - (anchor[1] - 30)) < 3 && Math.abs(moved.far[0] - 400) < 1 && Math.abs(moved.far[1] - 300) < 1, { anchor, moved });

    /* 3 Alt-click a split line takes it away; Enter applies */
    const ln = await ev(() => { const q = window.imageEditorInstance.E.warp.state(); const X = window.PCMesh; return X.latPoint(q.warp, q.wgrid, q.wgrid.us[1], 0.75); });
    const [lx, ly] = await T(ln[0], ln[1]);
    await p.keyboard.down("Alt"); await p.mouse.click(lx, ly); await p.keyboard.up("Alt"); await p.waitForTimeout(250);
    const q4 = await Q();
    check("Alt-click on the vertical split line: it is taken away (1 x 2 patches now)", q4.G && q4.G.c === 1 && q4.G.r === 2, q4);
    await ev(() => { document.getElementById("ieStage").focus(); }); await p.keyboard.press("Enter"); await p.waitForTimeout(400);
    const after = await ev(() => Array.from(window.imageEditorInstance.E.layer().canvas.getContext("2d").getImageData(0, 0, 600, 400).data.filter((v, i) => i % 4 === 3)).reduce((a, v) => a + (v > 0 ? 1 : 0), 0));
    check("Enter applies the gridded warp to the pixels (one undo step)", !(await Q()) && after > 1000 && Math.abs(after - before) > 50, { before, after });

    /* 4 Liquify: Smooth + Push Left tools; the Face-Aware sliders */
    await ev(() => window.imageEditorInstance.E.warp.liquify()); await p.waitForTimeout(500);
    const tools = await ev(() => [...document.querySelectorAll("#pcLiquify [data-lq]")].map((x) => x.dataset.lq));
    check("Liquify's tools: + Smooth (E), Push Left (O), the Face tool (A); 13 Face-Aware sliders", ["smooth", "pushleft", "face"].every((t) => tools.includes(t)) && (await ev(() => document.querySelectorAll("#lqFace input[type=range]").length)) === 13, tools);
    const box = await p.locator("#lqCv").boundingBox(), sz = await ev(() => { const s = window.imageEditorInstance.E.liquifyState(); return { pw: s.pw, ph: s.ph }; });
    const at = (x, y) => [box.x + x / 600 * box.width, box.y + y / 400 * box.height];
    await p.keyboard.press("o"); await p.waitForTimeout(100);
    await p.mouse.move(...at(300, 260)); await p.mouse.down(); for (let i = 1; i <= 12; i++) await p.mouse.move(...at(300, 260 - i * 6)); await p.mouse.up(); await p.waitForTimeout(200);
    const pl = await ev(() => { const s = window.imageEditorInstance.E.liquifyState(), f = s.field, i = Math.round(s.ph * 0.55) * s.pw + Math.round(s.pw / 2); let mx = 0; for (let k = 0; k < f.dx.length; k++) mx = Math.max(mx, f.dx[k]); return { tool: s.tool, mx }; });
    check("Push Left (O) dragged UP: the pixels go left (the field takes them from the right: dx > 0)", pl.tool === "pushleft" && pl.mx > 1, pl);
    const sum = () => ev(() => { const f = window.imageEditorInstance.E.liquifyState().field; let a = 0; for (let k = 0; k < f.dx.length; k++) a += Math.abs(f.dx[k] - (f.dx[k + 1] || 0)); return a; });
    const rough = await sum();
    await p.keyboard.press("e"); await p.waitForTimeout(100);
    await p.mouse.move(...at(300, 220)); await p.mouse.down(); for (let i = 1; i <= 10; i++) await p.mouse.move(...at(300 + (i % 2 ? 8 : -8), 220 - i * 4)); await p.waitForTimeout(400); await p.mouse.up(); await p.waitForTimeout(200);
    const smooth = await sum();
    check("Smooth (E) over it evens the distortion out (less change from pixel to pixel)", smooth < rough * 0.98, { rough, smooth });

    // Face-Aware: place a face with the Face tool, Eye Size up = the eye areas grow
    await p.keyboard.press("a"); await p.waitForTimeout(100);
    await p.mouse.move(...at(240, 120)); await p.mouse.down(); await p.mouse.move(...at(360, 290), { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(200);
    const face = await ev(() => { const s = window.imageEditorInstance.E.liquifyState(); return s.face ? { cx: s.face.cx / s.pw * 600, cy: s.face.cy / s.ph * 400, eyes: s.face.eyes.length } : null; });
    check("the Face tool (A): an oval dragged round the face places it (its eyes / nose / mouth guessed inside, draggable)", face && Math.abs(face.cx - 300) < 6 && Math.abs(face.cy - 205) < 6 && face.eyes === 2, face);
    await ev(() => { const s = document.getElementById("lqF_eyeSize"); s.value = "80"; s.dispatchEvent(new Event("input")); }); await p.waitForTimeout(250);
    const ff = await ev(() => { const s = window.imageEditorInstance.E.liquifyState(), F = s.faceF, e = s.face.eyes[0], r = s.face.rx * 0.32; if (!F) return null; const i = Math.round(e[1]) * s.pw + Math.round(e[0] + r * 0.5); return { dx: F.dx[i], label: document.getElementById("lqFV_eyeSize").textContent }; });
    await shot("4-face");
    check("Face-Aware: Eye Size +80 enlarges round each eye (a pixel right of the eye takes from nearer its centre: dx < 0)", ff && ff.dx < -0.3 && ff.label === "80", ff);
    await p.click("#lqOk"); await p.waitForTimeout(400);
    check("OK applies the brushes AND the face sliders (the window closes, the layer changed)", !(await ev(() => !!document.querySelector("#pcLiquify"))), true);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + e.stack); }
  finally { await b.close(); }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
