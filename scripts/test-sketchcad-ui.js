#!/usr/bin/env node
/* bitGen Studio — 2.464.0 in a REAL browser: the sketch's TYPED VALUES, MEASURE TOOL, UNITS and CAD FILES
 * (pcsketchtools.js + pcsketchcad.js + pcsketchcadui.js + /api/cad) - a line typed 150 at 30°, the next one typed 80
 * (level by itself), a rectangle typed 120 x 60, a circle typed ⌀50; Measure (M): a line, two lines, a region, in mm;
 * Export Sketch as DXF / SVG (kept in the project's cad folder), Import DXF (fit, a new sketch layer), Import DXF from
 * Project.
 * Tim: "continue with the photoshop gap closure. add cad tools, create sketch layers for cad in image editor".
 * Against the running app (H3_URL, default the e2e server on :8311). No Playwright = SKIP. SHOTS=<dir> keeps pictures. */
"use strict";
const fs = require("fs");
const path = require("path");
const os = require("os");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the sketch CAD browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const ROOT = path.join(__dirname, "..");
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
  const tag = "zzskc" + process.pid;
  let proj = "default";
  try {
    try { await fetch(URL_ + "api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docks: { imageeditdock: { state: "open", hidden: false, maximized: false } } }) }); } catch { /* older */ }
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.dims, null, { timeout: 60000 });
    await p.waitForTimeout(800);
    proj = (await (await fetch(URL_ + "api/projects")).json()).current;
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await p.click("#kxFull"); await p.waitForTimeout(800);
    await ev(() => { const E = window.imageEditorInstance.E; Object.assign(E.guides.settings, { snap: false }); E.docs.setTabs(true); E.openDoc(800, 500, "skc.png", (g) => { g.fillStyle = "#fff"; g.fillRect(0, 0, 800, 500); }); E.ui.run("layer.newsketch"); });
    await p.waitForTimeout(300);
    const sc = (x, y) => ev(([x, y]) => { const r = document.getElementById("kxPaper").getBoundingClientRect(), z = window.imageEditorInstance.E.S.zoom; return [r.left + x * z, r.top + y * z]; }, [x, y]);
    const click = async (x, y) => { const [a, bb] = await sc(x, y); await p.mouse.move(a, bb, { steps: 2 }); await p.mouse.down(); await p.mouse.up(); await p.waitForTimeout(150); };
    const drag = async (x0, y0, x1, y1) => { const [a, bb] = await sc(x0, y0), [c, d] = await sc(x1, y1); await p.mouse.move(a, bb, { steps: 2 }); await p.mouse.down(); await p.mouse.move(c, d, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(250); };
    const tool = (t) => ev((t) => window.imageEditorInstance.E.setTool(t), t);
    const info = () => ev(() => { const L = window.imageEditorInstance.E.layer(), K = window.PCSketch, s = L.sketch, r1 = (v) => Math.round(v * 100) / 100;
      return { ents: s.ents.filter((e) => !e.axis).map((e) => ({ id: e.id, t: e.t, cons: !!e.cons, pts: K.ptsOf(e).map((q) => [r1(K.pt(s, q).x), r1(K.pt(s, q).y)]) })), cons: s.cons.map((k) => k.t), dims: s.dims.map((m) => [m.t, r1(m.v), !!m.driven]), prof: K.profiles(s).map((q) => Math.round(q.area)), dof: K.dof(s).dof }; });

    const typeIn = async (txt) => { for (const ch of txt) { if (ch === "\t") await p.keyboard.press("Tab"); else if (ch === "\n") await p.keyboard.press("Enter"); else await p.keyboard.type(ch); await p.waitForTimeout(40); } await p.waitForTimeout(250); };
    const focusStage = () => ev(() => document.getElementById("ieStage").focus());
    const moveTo = async (x, y) => { const [a, bb] = await sc(x, y); await p.mouse.move(a, bb, { steps: 3 }); await p.waitForTimeout(80); };

    /* 1 typed values: a line 150 at 30°, then 80 toward a level pointer */
    await tool("sk_line"); await click(100, 300); await moveTo(300, 200); await focusStage();
    await typeIn("150");
    const hud = await ev(() => { const h = document.getElementById("skTyped"); return h ? { n: h.querySelectorAll("input").length, v: document.getElementById("skT_len").value, focus: document.activeElement && document.activeElement.id } : null; });
    check("typing a digit while a line is being drawn opens the Length / Angle box (the digit in Length, focused)", hud && hud.n === 2 && hud.v === "150" && hud.focus === "skT_len", hud);
    await typeIn("\t30\n");
    let a = await info();
    const L1 = a.ents.find((e) => e.t === "line" && e.pts[0][0] === 100 && e.pts[0][1] === 300);
    check("Enter: a line 150 long at 30° (to 229.9, 225) - kept as a length + an angle dimension; the box closes", L1 && Math.abs(L1.pts[1][0] - 229.9) < 0.02 && Math.abs(L1.pts[1][1] - 225) < 0.02 && a.dims.some((d) => d[0] === "len" && d[1] === 150 && !d[2]) && a.dims.some((d) => d[0] === "angle" && d[1] === 30 && !d[2]) && !(await ev(() => document.getElementById("skTyped"))), { L1, dims: a.dims });
    await moveTo(420, 226); await focusStage();
    await typeIn("80\n");
    a = await info();
    const L2 = a.ents.find((e) => e.t === "line" && Math.abs(e.pts[0][0] - 229.9) < 0.02 && Math.abs(e.pts[0][1] - 225) < 0.02);
    check("the chain goes on: the next one typed 80 toward a nearly level pointer = level (Horizontal), 80 long", L2 && Math.abs(L2.pts[1][0] - 309.9) < 0.02 && Math.abs(L2.pts[1][1] - 225) < 0.02 && a.cons.includes("horizontal") && a.dims.some((d) => d[0] === "len" && d[1] === 80), { L2, ents: a.ents });
    await p.keyboard.press("Escape");
    await ev(() => window.imageEditorInstance.E.undo()); a = await info();
    check("one undo = the last typed line only", a.ents.filter((e) => e.t === "line").length === 1, a.ents.length);

    /* 2 a rectangle typed 120 x 60, a circle typed ⌀50 */
    await tool("sk_rect"); await click(100, 380); await moveTo(150, 420); await focusStage();
    await typeIn("120\t60\n");
    await tool("sk_circle"); await click(500, 300); await moveTo(540, 300); await focusStage();
    await typeIn("50\n");
    a = await info();
    check("a 2-Point Rectangle typed 120 x 60 (width + height dimensions); a Circle typed ⌀50", a.prof.includes(7200) && a.dims.some((d) => d[0] === "len" && d[1] === 120) && a.dims.some((d) => d[0] === "len" && d[1] === 60) && a.dims.some((d) => d[0] === "diameter" && d[1] === 50) && a.ents.some((e) => e.t === "circle"), { prof: a.prof, dims: a.dims });

    /* 3 Measure (M): a line, two lines, inside the rectangle; in mm */
    await tool("sk_line"); await focusStage(); await p.keyboard.press("m"); await p.waitForTimeout(150);
    const tl = await ev(() => window.imageEditorInstance.E.S.tool);
    const box = () => ev(() => { const b = document.getElementById("skMeasure"); return b ? b.innerText.replace(/\s+/g, " ") : ""; });
    await click(160, 380); let t1 = await box();
    await click(220, 410); const t2 = await box();
    await click(160, 410); const t3 = await box();
    check("M picks the Measure tool; a line = Length 120; a second line = the angle 90; inside the rectangle = area 7200, perimeter 360", tl === "sk_measure" && /Line .*Length 120 px/.test(t1) && /Two lines .*Angle 90 °/.test(t2) && /Area 7200 px² Perimeter 360 px/.test(t3), { tl, t1, t2, t3 });
    await ev(() => window.imageEditorInstance.E.ui.showTab("ksk")); await p.waitForTimeout(200);
    await p.selectOption("#skUnit", "mm"); await p.waitForTimeout(250);
    await ev(() => { const i = document.getElementById("skUnitK"); i.value = "0.5"; i.dispatchEvent(new Event("change")); }); await p.waitForTimeout(250);
    await click(160, 410); t1 = await box();
    check("📐 Sketch tab ▸ Units mm, 1 px = 0.5: the region now 1800 mm², 180 mm round", /Area 1800 mm² Perimeter 180 mm/.test(t1) && (await ev(() => JSON.stringify(window.imageEditorInstance.E.layer().sketch.units))) === JSON.stringify({ u: "mm", k: 0.5 }), t1);
    await shot("skc-measure");

    /* 4 Export as DXF + SVG (into the project's cad folder) */
    await ev(() => window.imageEditorInstance.E.ui.run("sketch.exportdxf")); await p.waitForSelector(".kxdlg.pcd #skXN");
    check("Export Sketch as DXF…: the dialog takes the sketch's units (mm, 0.5)", (await ev(() => [document.querySelector(".kxdlg.pcd #skXU").value, document.querySelector(".kxdlg.pcd #skXK").value].join())) === "mm,0.5");
    await p.fill(".kxdlg.pcd #skXN", tag); await p.uncheck(".kxdlg.pcd #skXDl"); await p.click(".kxdlg.pcd .ok");
    const waitFile = async (n) => { for (let i = 0; i < 40; i++) { const f = (await (await fetch(URL_ + "api/cad/list")).json()).files.map((x) => x.name); if (f.includes(n)) return f; await p.waitForTimeout(250); } return (await (await fetch(URL_ + "api/cad/list")).json()).files.map((x) => x.name); };
    const files = await waitFile(tag + ".dxf");
    const dxf = await (await fetch(URL_ + "api/cad/file/" + tag + ".dxf")).text();
    const pd = await ev((t) => { const P = window.PCSketchCAD.parseDXF(t); return { n: P.items.length, units: P.units, lines: P.items.filter((i) => i.t === "line").map((i) => [i.a, i.b]) }; }, dxf);
    check("...saved as <name>.dxf in the project's cad folder: mm, the rectangle's 120 px top = a 60 mm line", files.includes(tag + ".dxf") && pd.units === 4 && pd.lines.some((l) => Math.abs(Math.abs(l[1][0] - l[0][0]) - 60) < 1e-6 && Math.abs(l[1][1] - l[0][1]) < 1e-6), { files: files.slice(0, 5), pd });
    await ev(() => window.imageEditorInstance.E.ui.run("sketch.exportsvg")); await p.waitForSelector(".kxdlg.pcd #skXN");
    await p.fill(".kxdlg.pcd #skXN", tag); await p.uncheck(".kxdlg.pcd #skXDl"); await p.click(".kxdlg.pcd .ok"); await waitFile(tag + ".svg");
    const svg = await (await fetch(URL_ + "api/cad/file/" + tag + ".svg")).text();
    check("Export Sketch as SVG…: <name>.svg, the picture's size in mm (400 x 250 mm)", /<svg [^>]*width="400mm" height="250mm"/.test(svg), svg.slice(0, 300));
    const bad = await fetch(URL_ + "api/cad/save?name=" + tag + "x.svg", { method: "POST", headers: { "Content-Type": "text/plain" }, body: "<svg><script>alert(1)</script></svg>" });
    check("the cad route refuses an SVG with a script in it", bad.status === 400);

    /* 5 Import the DXF: fitted, into a NEW sketch layer (the background picked) */
    await ev(() => { const E = window.imageEditorInstance.E; E.S.active = E.S.layers.findIndex((L) => L.type !== "sketch"); E.renderLayersPanel(); });
    await ev(([t, n]) => window.imageEditorInstance.E.sketchCAD.importText(t, n), [dxf, tag + ".dxf"]); await p.waitForSelector(".kxdlg.pcd input[name=skIP]");
    await p.click(".kxdlg.pcd .ok"); await p.waitForTimeout(500);
    a = await info();
    const nl = await ev(() => window.imageEditorInstance.E.S.layers.filter((L) => L.type === "sketch").length);
    check("Import DXF (fit): a new sketch layer with the lines + the circle; the rectangle a closed profile at once (ends joined)", nl === 2 && a.ents.filter((e) => e.t === "line").length >= 5 && a.ents.some((e) => e.t === "circle") && a.prof.length >= 2, { nl, n: a.ents.length, prof: a.prof });
    const n0 = a.ents.length;
    await ev(() => window.imageEditorInstance.E.ui.run("sketch.importdxfproj")); await p.waitForSelector(".kxdlg.pcd #skPL");
    await p.selectOption(".kxdlg.pcd #skPL", tag + ".dxf"); await p.click(".kxdlg.pcd .ok");
    await p.waitForSelector(".kxdlg.pcd input[name=skIP]", { timeout: 4000 });
    await p.check(".kxdlg.pcd input[name=skIP][value=origin]"); await p.fill(".kxdlg.pcd #skIK", "2"); await p.click(".kxdlg.pcd .ok"); await p.waitForTimeout(500);
    a = await info();
    check("Import DXF from Project… (real size round the origin, 1 mm = 2 px): the same entities again in the picked sketch - the rectangle 120 x 60 px again", a.ents.length === n0 * 2 && a.prof.some((x) => Math.abs(x - 7200) < 1), { n0, n: a.ents.length, prof: a.prof });
    await shot("skc-final");
    await p.screenshot({ path: path.join(SHOTS || os.tmpdir(), "skc-final.png") }).catch(() => {});
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + e.stack); }
  finally {
    await b.close();
    try { for (const ext of ["dxf", "svg"]) fs.rmSync(path.join(ROOT, "projects", proj, "cad", tag + "." + ext), { force: true }); } catch { /* fine */ }
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
