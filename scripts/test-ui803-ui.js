#!/usr/bin/env node
/* bitGen Studio — 2.803.0 in a REAL browser: THE LASER PANEL (pclaser.js) - operations per layer, centreline tracing, fill, offset fill,
 * raster engraving, the preview, G-code for GRBL / Marlin, Line art from the picture. Tim: "can we add a lightburn feature to
 * image editor, it can do a linedrawing using controlnet or import a vector or create a vector and generate a toolpath?". Against the running app (H3_URL, default :8311). No Playwright = SKIP. */
"use strict";
const path = require("path"), fs = require("fs"), os = require("os");
const { execSync, execFileSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the laser browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const SHOTS = process.env.SHOTS || "";
let pass = 0, fail = 0;
const check = (n, cond, got) => { if (cond) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const has = (bin) => { try { execSync("command -v " + bin, { stdio: "ignore" }); return true; } catch { return false; } };

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1700, height: 1000 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message + " @ " + String(e.stack || "").split("\n").slice(1, 3).join(" | ")));
  const ev = (f, a) => p.evaluate(f, a);
  const shot = async (n) => { if (SHOTS) await p.screenshot({ path: path.join(SHOTS, n + ".png") }); };
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.laser, null, { timeout: 60000 });
    await p.waitForTimeout(600);
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await ev(() => document.getElementById("kxFull").click()); await p.waitForTimeout(800);
    await ev(() => {
      const E = window.imageEditorInstance.E, D = window.PCDoc;
      E.pages.newDocument({ preset: "Custom", wmm: 100, hmm: 80, orient: "landscape", dpi: 127 }, 1, "Sign");   // 500 x 400 px, 0.2 mm a px
      const mk = (name, kind, x, y, w, h) => { const L = E.makeLayer(name, E.S.w, E.S.h, "shape"); L.shape = Object.assign({}, D.SHAPE_DEFAULT || {}, { kind, x, y, w, h, fill: "#000000", fillOn: true, strokeOn: false }); D.rasterize(L); E.addLayer(L, name, false); return L; };
      mk("Oval", "ellipse", 20, 20, 160, 100); mk("Plate", "rect", 220, 20, 120, 80); mk("Badge", "ellipse", 360, 20, 100, 100);
      const P = E.makeLayer("Drawing", E.S.w, E.S.h); let g = P.canvas.getContext("2d"); g.fillStyle = "#000"; g.fillRect(50, 200, 300, 9); E.addLayer(P, "drawing", false);
      const Q = E.makeLayer("Photo", E.S.w, E.S.h); g = Q.canvas.getContext("2d"); const gr = g.createLinearGradient(50, 0, 450, 0); gr.addColorStop(0, "#000"); gr.addColorStop(1, "#fff"); g.fillStyle = gr; g.fillRect(50, 280, 400, 60); E.addLayer(Q, "photo", false);
    });
    await p.waitForTimeout(300);

    /* 1 Window ▸ Laser */
    await ev(() => window.imageEditorInstance.E.ui.run("win.laser")); await p.waitForTimeout(300);
    let st = await ev(() => ({ shown: window.imageEditorInstance.E.laser.shown(), rows: [...document.querySelectorAll("#pcLaserPanel .lzl b")].map((x) => x.textContent), size: document.getElementById("lzMmpp").value }));
    check("Window ▸ Laser: the panel lists the layers (top first) with an operation each; 0.2 mm a px from the page's dpi", st.shown && st.rows.join() === "Photo,Drawing,Badge,Plate,Oval,Background" && Math.abs(+st.size - 0.2) < 1e-6, st);
    const setOp = (name, patch) => ev(([n, pt]) => { const E = window.imageEditorInstance.E, L = E.S.layers.find((x) => x.name === n); for (const [k, v] of Object.entries(pt)) { const el = document.querySelector(`#pcLaserPanel [data-lz="${L.id}"][data-k="${k}"]`); el.value = v; el.dispatchEvent(new Event("change")); } }, [name, patch]);
    await setOp("Oval", { op: "line" }); await setOp("Oval", { power: 80, speed: 600, passes: 2 });
    await setOp("Plate", { op: "fill" }); await setOp("Plate", { interval: 1, angle: 45 });
    await setOp("Badge", { op: "offset" }); await setOp("Badge", { interval: 2 });
    await setOp("Drawing", { op: "line" });
    await setOp("Photo", { op: "image" }); await setOp("Photo", { interval: 0.5 });
    const traceSel = await ev(() => { const E = window.imageEditorInstance.E, L = E.S.layers.find((x) => x.name === "Drawing"); return document.querySelector(`#pcLaserPanel [data-lz="${L.id}"][data-k="trace"]`).value; });
    check("a picture layer set to Line offers Centreline / Outline (Centreline first)", traceSel === "centre", traceSel);

    /* 2 preview */
    await p.click("#lzGo"); await p.waitForTimeout(1500);
    st = await ev(() => { const E = window.imageEditorInstance.E, r = E.laser.last(); const by = (n) => r.job.ops.find((o) => o.name === n); const cv = document.getElementById("lzPrev"), d = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data; let red = 0; for (let i = 0; i < d.length; i += 4) { const a = d[i], b2 = d[i + 1], c = d[i + 2]; if (!(a === 0x1b && b2 === 0x1b && c === 0x1b) && !(a === 0xf4 && b2 === 0xf1 && c === 0xea)) red++; }
      const dr = by("Drawing"), ys = dr ? dr.paths.flatMap((q) => q.pts.map((pt) => pt[1])) : [];
      return { ops: r.job.ops.map((o) => o.name + ":" + o.kind), oval: by("Oval") && by("Oval").paths.length, ovalClosed: by("Oval") && by("Oval").paths[0].closed, plate: by("Plate") && by("Plate").paths.length, badge: by("Badge") && by("Badge").paths.length, drawing: dr && dr.paths.length, ymin: Math.min(...ys), ymax: Math.max(...ys), rows: by("Photo") && by("Photo").rows.length, stats: document.getElementById("lzStats").textContent, red, box: r.box }; });
    check("⟳ Preview: five operations, engraving first and cutting last (Photo raster, Plate hatched, Badge concentric rings, then the lines: Oval closed, Drawing traced)", st.ops.join() === "Photo:raster,Plate:vector,Badge:vector,Oval:vector,Drawing:vector" && st.oval === 1 && st.ovalClosed && st.plate > 20 && st.badge >= 8 && st.rows >= 20, st);
    check("…the 9-px-thick drawn line becomes ONE centreline down its middle (y = (400 − 204.5) × 0.2 ≈ 39.1 mm)", st.drawing <= 2 && Math.abs(st.ymin - 39.1) < 0.6 && Math.abs(st.ymax - 39.1) < 0.6, st);
    check("…the preview draws it and gives the time, burn and travel and the size on the bed", st.red > 50 && /about \d+ min \d+ s · burn \d+ mm · travel \d+ mm · on the bed/.test(st.stats) && st.box.x1 <= 100.01 && st.box.y1 <= 80.01, st);
    await shot("2-preview");

    /* 3 save G-code (GRBL) */
    await p.click("#lzSave"); await p.waitForTimeout(1500);
    const ls = await ev(() => fetch("/api/laser/list").then((r) => r.json()));
    const code = await ev(() => fetch("/api/laser/file/Sign.gcode").then((r) => r.text()));
    const lines = code.split("\n"), ss = lines.filter((l) => / S(\d+)/.test(l)).map((l) => +/ S(\d+)/.exec(l)[1]);
    const xy = lines.filter((l) => /^G[01] /.test(l)).map((l) => [+(/X(-?[\d.]+)/.exec(l) || [0, NaN])[1], +(/Y(-?[\d.]+)/.exec(l) || [0, NaN])[1]]).filter(([x, y]) => !isNaN(x) && !isNaN(y));
    check("⤓ Save G-code: Sign.gcode in the project's laser folder (GRBL: G21 G90 M4 S0 … M5 G0 X0 Y0 M2)", ls.files.some((f) => f.name === "Sign.gcode") && /\nG21\nG90\nM4 S0\n/.test(code) && /\nM5\nG0 X0 Y0\nM2\n/.test(code), code.slice(0, 200));
    check("…powers in GRBL's 0-1000 (Oval at 80 % = S800), every move on the 100 × 80 mm job, 2 passes of the Oval", ss.includes(800) && ss.every((v) => v >= 0 && v <= 1000) && xy.every(([x, y]) => x >= -3 && x <= 103 && y >= -0.1 && y <= 80.1) && (code.match(/S800 F600/g) || []).length === 2, { max: Math.max(...ss), n: xy.length });
    check("…each operation named in a comment", ["Oval: vector", "Plate: vector", "Badge: vector", "Drawing: vector", "Photo: raster"].every((t) => code.includes("; --- " + t)));

    /* 4 Marlin */
    await ev(() => { const f = document.getElementById("lzFlavor"); f.value = "marlin"; f.dispatchEvent(new Event("change")); });
    await p.waitForTimeout(200);
    const sMax = await ev(() => document.getElementById("lzSMax").value);
    const mcode = await ev(async () => { const r = await window.imageEditorInstance.E.laser.save(false); return r && r.code; });
    check("Marlin: max S 255; M3 S<0-255> before burning, M5 before travel, no M4", sMax === "255" && /M3 S204\n/.test(mcode) && /M5\nG0 X/.test(mcode) && !/M4/.test(mcode), mcode && mcode.slice(0, 300));
    await ev(() => { const f = document.getElementById("lzFlavor"); f.value = "grbl"; f.dispatchEvent(new Event("change")); });

    /* 5 ✎ Line art from the picture (the preprocessor answered by a stand-in here) */
    const art = await ev(async () => {
      const E = window.imageEditorInstance.E, was = E.api.preprocess;
      E.api.preprocess = async () => { const c = document.createElement("canvas"); c.width = 500; c.height = 400; const g = c.getContext("2d"); g.fillStyle = "#000"; g.fillRect(0, 0, 500, 400); g.strokeStyle = "#fff"; g.lineWidth = 3; g.beginPath(); g.moveTo(100, 100); g.lineTo(400, 300); g.stroke(); return c.toDataURL(); };
      try { await E.laser.lineArt(); } finally { E.api.preprocess = was; }
      const L = E.S.layers.find((x) => x.name === "Line art"); if (!L) return null;
      const d = L.canvas.getContext("2d").getImageData(250, 200, 1, 1).data;
      return { op: L.laser.op, trace: L.laser.trace, px: Array.from(d), row: !![...document.querySelectorAll("#pcLaserPanel .lzl b")].find((x) => x.textContent === "Line art") };
    });
    check("✎ Line art from the picture: the preprocessor's white-on-black lines become a dark-lines layer set to Line · centreline (and listed)", art && art.op === "line" && art.trace === "centre" && art.px[3] > 150 && art.px[0] < 30 && art.row, art);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed " + (e && e.stack)); }
  await b.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
