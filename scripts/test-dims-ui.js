#!/usr/bin/env node
/* bitGen Studio — 2.441.0 in a REAL browser: CAD DIMENSIONS (pcdims.js) - exact points, an end dragged with its number
 * live, Shift = horizontal / Ctrl = vertical (2.457.0), the property bar's size + unit = the document's scale for all dimensions.
 * 2.457.0: the dimension tools make DIMENSION GROUPS (pcdimgroup.js - test-dimgroup-ui.js); an older one-layer dimension still
 * drags by its ends (step 3).
 * Tim: "with the dimension tools let the user select the size and units of the dimension line selected, then use those
 * measurements to create a scale for all the other existing dimensions and future dimensions ..."
 * Against the running app (H3_URL, default the e2e server on :8311). No Playwright = SKIP. SHOTS=<dir> keeps pictures. */
"use strict";
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the dimensions browser test did not run"); process.exit(0); }
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
  const tag = "zzd" + process.pid;
  let proj = "default";
  try {
    try { await fetch(URL_ + "api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docks: { imageeditdock: { state: "open", hidden: false, maximized: false } } }) }); } catch { /* older */ }
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.dims, null, { timeout: 60000 });
    await p.waitForTimeout(800);
    proj = (await (await fetch(URL_ + "api/projects")).json()).current;
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await p.click("#kxFull"); await p.waitForTimeout(800);
    await ev(() => { const E = window.imageEditorInstance.E, D = window.PCDoc; Object.assign(E.guides.settings, { snap: true, guides: true, objects: false, nodes: true, midpoints: false, intersections: true, page: false });
      E.docs.setTabs(true); E.openDoc(500, 300, "dims.png", (g) => { g.fillStyle = "#fff"; g.fillRect(0, 0, 500, 300); });
      // a picture to measure: a red block 100..300 x 100..180 on its own layer, and a vector triangle
      const P = E.makeLayer("Block", 500, 300); const g = P.canvas.getContext("2d"); g.fillStyle = "#c00"; g.fillRect(100, 100, 200, 80); E.addLayer(P, "t", false);
      const T = E.makeLayer("Tri", 500, 300, "shape"); T.shape = Object.assign({}, D.SHAPE_DEFAULT, { kind: "path", path: { subs: [{ closed: true, op: "add", pts: [{ x: 350, y: 250 }, { x: 450, y: 250 }, { x: 400, y: 200 }].map((a) => ({ x: a.x, y: a.y, ix: a.x, iy: a.y, ox: a.x, oy: a.y })) }] }, fill: "#3366cc" });
      window.PCPath.syncShape(T.shape); D.rasterize(T); E.addLayer(T, "t", false);
      Object.assign(E.S.cd, { unit: "px", dec: 1 }); E.setTool("cdimpar"); });
    await p.waitForTimeout(300);
    const sc = (x, y) => ev(([x, y]) => { const r = document.getElementById("kxPaper").getBoundingClientRect(), z = window.imageEditorInstance.E.S.zoom; return [r.left + x * z, r.top + y * z]; }, [x, y]);
    const click = async (x, y) => { const [a, bb] = await sc(x, y); await p.mouse.move(a, bb, { steps: 2 }); await p.mouse.down(); await p.mouse.up(); await p.waitForTimeout(120); };
    const dimNow = () => ev(() => { const E = window.imageEditorInstance.E, L = E.layer(), G = E.dimGroups.groupOf(L), r = (q) => q.map((v) => Math.round(v * 10) / 10);
      if (G) { const ln = E.S.layers.find((x) => x.parent === G.id && x.dimPart === "line"); return { name: G.name, kind: G.dimg.kind, pts: [G.dimg.a, G.dimg.b, G.dimg.m].map(r), text: ln.shape.line.labels[0].text }; }
      const d = E.dims.defOf(L); return d ? { name: L.name, kind: d.kind, pts: d.pts.map(r), text: L.shape.line.labels[0].text } : null; });
    const textOf = () => ev(() => { const E = window.imageEditorInstance.E, L = E.layer(), G = E.dimGroups.groupOf(L); return G ? E.S.layers.find((x) => x.parent === G.id && x.dimPart === "line").shape.line.labels[0].text : L.shape.line.labels[0].text; });

    /* 1 exact points: clicked 4-5 px off the block's corners -> its corners */
    await click(104, 96); await p.mouse.move(...(await sc(296, 104))); await p.waitForTimeout(100);
    const mk = await ev(() => { const m = window.imageEditorInstance.E.dims.mark(); return m && m.k; });
    await click(296, 104); await click(200, 70);
    const d1 = await dimNow();
    await shot("1-corners");
    check("CAD points: clicked a few px off the block's top corners, the dimension measures exactly between them (100,100 -> 300,100: 200.0 px); the point is named while hovering", d1 && JSON.stringify(d1.pts.slice(0, 2)) === "[[100,100],[300,100]]" && d1.text === "200.0 px" && /corner/.test(mk || ""), { d1, mk });
    // the triangle's apex node + a point on its outline
    await click(398, 203); await click(426, 226); await click(470, 210);
    const d2 = await dimNow();
    const onOutline = Math.abs(d2.pts[1][0] - d2.pts[1][1] - 200) < 1.5 || Math.abs((d2.pts[1][0] - 400) + (d2.pts[1][1] - 200)) < 1.5;
    check("...a shape's node (the apex 400,200) and a point ON its outline", JSON.stringify(d2.pts[0]) === "[400,200]" && onOutline, d2);
    await ev(() => window.imageEditorInstance.E.undo());

    /* 2 the scale from the property bar: this dimension = 5 m */
    await ev(() => { const E = window.imageEditorInstance.E; E.setActive(E.S.layers.findIndex((L) => L.name === d1.name)); }, null).catch(() => {});
    await ev((n) => { const E = window.imageEditorInstance.E; E.setActive(E.S.layers.findIndex((L) => L.name === n)); }, d1.name);
    await p.waitForTimeout(700);
    const hasRow = await ev(() => !!document.getElementById("pbDimV") && !!document.getElementById("pbDimU"));
    await p.selectOption("#pbDimU", "m"); await p.waitForTimeout(150);
    await p.fill("#pbDimV", "5"); await p.press("#pbDimV", "Enter"); await p.waitForTimeout(400);
    const s1 = { sc: await ev(() => window.imageEditorInstance.E.S.dimScale), text: await textOf() };
    check("the property bar of a picked dimension: 📏 its size + its unit; 5 m typed = the scale (1 px = 0.025 m), the dimension reads 5.00 m", hasRow && s1.sc && Math.abs(s1.sc.k - 0.025) < 1e-9 && s1.sc.unit === "m" && s1.text === "5.00 m", { hasRow, s1 });
    // a second, new dimension uses it: the block's height (80 px = 2.00 m)
    await ev(() => window.imageEditorInstance.E.setTool("cdimpar"));
    await click(303, 103); await click(303, 177); await click(340, 140);
    const d3 = await dimNow();
    check("...a dimension drawn next uses the scale (the block's height 80 px = 2.00 m)", d3.text === "2.00 m", d3);

    /* 3 an older ONE-LAYER dimension (pictures from before 2.457.0): drag an end - live number; Shift = horizontal */
    const old = await ev(() => { const E = window.imageEditorInstance.E, D = window.PCDoc, mk = (nm, pts) => { const L = E.makeLayer(nm, E.S.w, E.S.h, "shape"); L.shape = Object.assign({}, D.SHAPE_DEFAULT, { kind: "path", fillOn: false, strokeOn: true, strokeW: 1.5, line: Object.assign({}, window.PCBez.LINE_DEFAULT, { start: "arrow", end: "arrow", asize: 5, labels: [{ text: "", size: 14 }] }) }); E.dimNew(L, "cdimpar", pts); E.addLayer(L, "t", false); return L.name; };
      return [mk("Old Dim A", [[100, 100], [300, 100], [200, 70]]), mk("Old Dim B", [[300, 100], [300, 180], [340, 140]])]; });
    d1.name = old[0]; d3.name = old[1];
    await ev(() => window.imageEditorInstance.E.setTool("move"));
    await ev((n) => { const E = window.imageEditorInstance.E; E.setActive(E.S.layers.findIndex((L) => L.name === n)); }, d1.name);
    await p.waitForTimeout(400);
    const [hx, hy] = await sc(300, 100), [tx, ty] = await sc(380, 130);
    await p.mouse.move(hx, hy); await p.mouse.down(); await p.keyboard.down("Shift");
    await p.mouse.move((hx + tx) / 2, (hy + ty) / 2, { steps: 4 });
    const mid = await ev(() => window.imageEditorInstance.E.layer().shape.line.labels[0].text);
    await p.mouse.move(tx, ty, { steps: 4 }); await p.keyboard.up("Shift"); await p.mouse.up(); await p.waitForTimeout(300);
    const d4 = await dimNow();
    await shot("3-dragged");
    check("an end dragged with Shift: it stays level (y 100), the number follows live (mid-drag " + mid + ") and ends at 280 px = 7.00 m", d4.pts[1][1] === 100 && Math.abs(d4.pts[1][0] - 380) < 1.5 && d4.text === "7.00 m" && mid !== "5.00 m" && mid !== d4.text, { d4, mid });
    const bl = await ev(() => { const E = window.imageEditorInstance.E; return E.S.layers.find((L) => L.name === "Block") ? true : false; });
    // Ctrl = vertical, on the other dimension's end
    await ev((n) => { const E = window.imageEditorInstance.E; E.setActive(E.S.layers.findIndex((L) => L.name === n)); }, d3.name);
    await p.waitForTimeout(400);
    const [h2x, h2y] = await sc(300, 180), [t2x, t2y] = await sc(330, 240);
    await p.mouse.move(h2x, h2y); await p.mouse.down(); await p.keyboard.down("Control"); await p.mouse.move(t2x, t2y, { steps: 6 }); await p.keyboard.up("Control"); await p.mouse.up(); await p.waitForTimeout(300);
    const d5 = await dimNow();
    check("Ctrl: straight below the other end (x 300); 140 px = 3.50 m", d5.pts[1][0] === 300 && Math.abs(d5.pts[1][1] - 240) < 1.5 && d5.text === "3.50 m", d5);
    const un = await ev(() => { const E = window.imageEditorInstance.E; E.undo(); const L = E.layer(); return L.shape.line.labels[0].text; });
    check("...one undo step puts the end back", un === "2.00 m", un);

    /* 4 the scale changed again: every dimension measured again; kept in the .bgi */
    await ev(() => window.imageEditorInstance.E.dims.setScale(250, "cm", 1));
    const all = await ev(() => { const E = window.imageEditorInstance.E; return E.S.layers.filter((L) => E.dims.isDim(L)).map((L) => L.shape.line.labels[0].text).concat(E.S.layers.filter((L) => E.dimGroups.isGroup(L)).map((G) => E.S.layers.find((x) => x.parent === G.id && x.dimPart === "line").shape.line.labels[0].text)).sort(); });
    check("a new scale (the picked 80 px = 250 cm): every dimension measured again, groups and older ones (280 px = 875.0 cm, 200 px = 625.0 cm)", JSON.stringify(all) === JSON.stringify(["250.0 cm", "250.0 cm", "625.0 cm", "875.0 cm"]), all);
    await ev((n) => window.imageEditorInstance.E.bgi.save(n, false), tag);
    await ev((n) => window.imageEditorInstance.E.bgi.openFromProject(n + ".bgi"), tag); await p.waitForTimeout(700);
    const re = await ev(() => { const E = window.imageEditorInstance.E; return { sc: E.S.dimScale, defs: E.S.layers.filter((L) => E.dims.isDim(L)).map((L) => !!L.shape.dim), groups: E.S.layers.filter((L) => E.dimGroups.isGroup(L)).length }; });
    check("...the .bgi keeps the scale and each dimension's definition (its ends still drag)", re.sc && re.sc.unit === "cm" && re.defs.length === 2 && re.defs.every(Boolean) && re.groups === 2, re);
    check("Layer ▸ Dimension Scale…", await ev(() => window.imageEditorInstance.E.ui.CMD.has("layer.dimscale")) && bl);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + e.stack); }
  finally {
    fs.rmSync(path.join(ROOT, "projects", proj, "bgi", tag + ".bgi"), { force: true });
    await b.close();
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
