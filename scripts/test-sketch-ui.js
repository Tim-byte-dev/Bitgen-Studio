#!/usr/bin/env node
/* bitGen Studio — 2.462.0 in a REAL browser: SKETCH LAYERS (pcsketch.js + pcsketchtools.js) - Layer ▸ New Sketch, a
 * closed Line chain with its level / upright snaps, Sketch Dimension (typed values, a sum), fully constrained, Sketch
 * Select drags (a fixed corner stays; a freed one moves with the constraints), a circle + Tangent, X = construction,
 * Profiles → Shapes, undo, the layer moved, the .bgi, the N key.
 * Tim: "continue with the photoshop gap closure. add cad tools, create sketch layers for cad in image editor" - "something
 * like fusion 360 sketch".
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
if (!chromium) { console.log("SKIP: playwright is not installed here - the sketch layers browser test did not run"); process.exit(0); }
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
  const tag = "zzsk" + process.pid;
  let proj = "default";
  try {
    try { await fetch(URL_ + "api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docks: { imageeditdock: { state: "open", hidden: false, maximized: false } } }) }); } catch { /* older */ }
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.dims, null, { timeout: 60000 });
    await p.waitForTimeout(800);
    proj = (await (await fetch(URL_ + "api/projects")).json()).current;
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await p.click("#kxFull"); await p.waitForTimeout(800);
    await ev(() => { const E = window.imageEditorInstance.E; Object.assign(E.guides.settings, { snap: false }); E.docs.setTabs(true); E.openDoc(800, 500, "sk.png", (g) => { g.fillStyle = "#fff"; g.fillRect(0, 0, 800, 500); }); });
    await p.waitForTimeout(300);
    const sc = (x, y) => ev(([x, y]) => { const r = document.getElementById("kxPaper").getBoundingClientRect(), z = window.imageEditorInstance.E.S.zoom; return [r.left + x * z, r.top + y * z]; }, [x, y]);
    const click = async (x, y, mods) => { const [a, bb] = await sc(x, y); await p.mouse.move(a, bb, { steps: 2 }); for (const m of mods || []) await p.keyboard.down(m); await p.mouse.down(); await p.mouse.up(); for (const m of mods || []) await p.keyboard.up(m); await p.waitForTimeout(150); };
    const drag = async (x0, y0, x1, y1) => { const [a, bb] = await sc(x0, y0), [c, d] = await sc(x1, y1); await p.mouse.move(a, bb, { steps: 2 }); await p.mouse.down(); await p.mouse.move(c, d, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(250); };
    const sk = () => ev(() => { const E = window.imageEditorInstance.E, L = E.layer(), K = window.PCSketch; if (!L || !L.sketch) return null; const s = L.sketch, d = K.dof(s), r1 = (v) => Math.round(v * 100) / 100;
      return { type: L.type, name: L.name, dof: d.dof, ents: s.ents.filter((e) => !e.axis).map((e) => ({ id: e.id, t: e.t, cons: !!e.cons, r: e.r && r1(e.r) })), cons: s.cons.filter((k) => !(k.t === "fix" && K.isOrigin(s, k.a))).map((k) => k.t), dims: s.dims.map((m) => ({ id: m.id, t: m.t, v: r1(m.v), driven: !!m.driven })),
        pts: s.pts.filter((q) => !K.isOrigin(s, q.id) || q.id === s.origin.pt).map((q) => [r1(q.x), r1(q.y)]), tool: E.S.tool, prof: K.profiles(s).length }; });

    /* 1 Layer ▸ New Sketch */
    await ev(() => window.imageEditorInstance.E.ui.run("layer.newsketch")); await p.waitForTimeout(400);
    const a0 = await sk();
    const tab = await ev(() => ({ on: document.getElementById("kskBody").classList.contains("on"), txt: document.getElementById("kskBody").textContent, icon: [...document.querySelectorAll("#pcLayers .ic")].map((x) => x.textContent).join("") }));
    check("Layer ▸ New Sketch: a sketch layer (📐 in Layers) with its origin at the middle, the Line tool picked, the 📐 Sketch tab: fully constrained", a0 && a0.type === "sketch" && JSON.stringify(a0.pts) === "[[400,250]]" && a0.tool === "sk_line" && tab.on && /fully constrained/.test(tab.txt) && /📐/.test(tab.icon), { a0, tab });

    /* 2 a closed chain with the Line tool: from the origin round a rectangle and back */
    await click(401, 251); await click(600, 252); await click(601, 150); await click(402, 151); await click(400, 249);
    const a1 = await sk();
    await shot("2-chain");
    check("Line: a chain from the origin (joined to it), level / upright snaps (and onto the origin's axes), back on the first point = closed (one profile), 2 degrees of freedom left (its width + height)",
      a1.ents.filter((e) => e.t === "line").length === 4 && a1.cons.length >= 3 && a1.prof === 1 && a1.dof === 2 && JSON.stringify(a1.pts.slice().sort()) === JSON.stringify([[400, 150], [400, 250], [600, 150], [600, 250]].sort()), a1);
    const px = await ev(() => { const L = window.imageEditorInstance.E.layer(), g = L.canvas.getContext("2d"); return [g.getImageData(500, 250, 1, 1).data[3], g.getImageData(500, 200, 1, 1).data[3]]; });
    check("...the layer's picture: the lines drawn (the bottom edge), nothing inside", px[0] > 100 && px[1] === 0, px);

    /* 3 Sketch Dimension: the bottom line = 150, the right line = 80 -> fully constrained */
    await ev(() => window.imageEditorInstance.E.setTool("sk_dim"));
    await click(500, 250); await click(500, 285);
    await p.waitForSelector("#skDimIn", { timeout: 3000 }); await p.fill("#skDimIn", "150"); await p.press("#skDimIn", "Enter"); await p.waitForTimeout(300);
    const rx = await ev(() => { const s = window.imageEditorInstance.E.layer().sketch; return Math.max(...s.pts.filter((q) => !window.PCSketch.isOrigin(s, q.id)).map((q) => q.x)); });
    await click(rx, 200); await click(rx + 40, 200);
    await p.waitForSelector("#skDimIn", { timeout: 3000 }); await p.fill("#skDimIn", "100-20"); await p.press("#skDimIn", "Enter"); await p.waitForTimeout(400);
    const a2 = await sk();
    await shot("3-dims");
    const tabTxt = await ev(() => document.getElementById("kskBody").textContent);
    check("Sketch Dimension: the bottom line typed 150, the right one \"100-20\" = 80 -> the rectangle 150 x 80 on the origin, ✓ fully constrained",
      a2.dims.length === 2 && a2.dims.map((d) => d.v).join() === "150,80" && a2.dof === 0 && /fully constrained/.test(tabTxt) && JSON.stringify(a2.pts.slice().sort()) === JSON.stringify([[400, 170], [400, 250], [550, 170], [550, 250]].sort()), { a2, tabTxt });

    /* 4 Sketch Select: a fully constrained corner does not move; a dimension deleted -> it drags */
    await ev(() => window.imageEditorInstance.E.setTool("sk_select"));
    await drag(550, 170, 600, 120);
    const a3 = await sk();
    check("dragging a corner of the fully constrained rectangle: nothing moves", JSON.stringify(a3.pts) === JSON.stringify(a2.pts), a3.pts);
    const lab = await ev(() => { const s = window.imageEditorInstance.E.layer().sketch, G = window.PCSketch.dimGeom(s, s.dims[1]); return [G.x, G.y]; });
    await click(lab[0], lab[1]); await p.keyboard.press("Delete"); await p.waitForTimeout(300);
    const a4 = await sk();
    await drag(550, 170, 560, 120);
    const a5 = await sk();
    check("its height dimension picked + Delete: 1 degree of freedom; dragging the corner up - only the height changes (still 150 wide, still square)",
      a4.dims.length === 1 && a4.dof === 1 && a5.pts.some((q) => q[0] === 550 && q[1] === 120) && a5.pts.some((q) => q[0] === 400 && q[1] === 120) && a5.pts.some((q) => q[0] === 550 && q[1] === 250), { a4: a4.dims, a5: a5.pts });

    /* 5 a circle, made tangent to the top line; then construction */
    await ev(() => window.imageEditorInstance.E.setTool("sk_circle"));
    await click(475, 70); await click(500, 70);
    let a6 = await sk();
    const circ = a6.ents.find((e) => e.t === "circle");
    const top = await ev(() => { const s = window.imageEditorInstance.E.layer().sketch, K = window.PCSketch; return s.ents.find((e) => e.t === "line" && !e.axis && Math.abs(K.pt(s, e.p1).y - 120) < 0.5 && Math.abs(K.pt(s, e.p2).y - 120) < 0.5).id; });
    await ev(([c, t]) => { const E = window.imageEditorInstance.E; E.sketch.setSel([{ k: "ent", id: c }, { k: "ent", id: t }]); }, [circ.id, top]);
    await p.click('#kskBody [data-con="tangent"]'); await p.waitForTimeout(300);
    const tg = await ev(([c, t]) => { const s = window.imageEditorInstance.E.layer().sketch, K = window.PCSketch, e = K.ent(s, c), l = K.ent(s, t); return { cy: K.pt(s, e.c).y, r: e.r, ly: K.pt(s, l.p1).y }; }, [circ.id, top]);
    check("Circle (centre + edge, r 25) + ✓ Tangent with the top line: it touches it (its centre one radius above the line)", circ && circ.r === 25 && Math.abs(tg.cy + tg.r - tg.ly) < 0.01, { circ, tg });
    await ev((c) => window.imageEditorInstance.E.sketch.setSel([{ k: "ent", id: c }]), circ.id);
    await p.locator("#ieStage").focus(); await p.keyboard.press("x"); await p.waitForTimeout(300);
    a6 = await sk();
    const cpx = await ev((c) => { const E = window.imageEditorInstance.E, s = E.layer().sketch, K = window.PCSketch, e = K.ent(s, c), ce = K.pt(s, e.c); return E.layer().canvas.getContext("2d").getImageData(Math.round(ce.x + e.r), Math.round(ce.y), 1, 1).data[3]; }, circ.id);
    check("X = construction: the circle dashed while sketching, not in the layer's picture", a6.ents.find((e) => e.id === circ.id).cons === true && cpx === 0, { cpx });

    /* 6 Profiles → Shapes; undo */
    const n0 = await ev(() => window.imageEditorInstance.E.S.layers.length);
    await p.click("#skProf"); await p.waitForTimeout(400);
    const sh = await ev(() => { const S = window.imageEditorInstance.E.S, N = S.layers.find((L) => / profile 1$/.test(L.name)); return N ? { type: N.type, kind: N.shape.kind, subs: N.shape.path.subs.length, n: S.layers.length } : null; });
    check("⬚ Profiles → Shapes: the closed rectangle as a shape layer (a path) above the sketch", sh && sh.type === "shape" && sh.kind === "path" && sh.subs === 1 && sh.n === n0 + 1, sh);
    await ev(() => window.imageEditorInstance.E.undo()); await ev(() => window.imageEditorInstance.E.undo()); await p.waitForTimeout(200);
    const a7 = await ev(() => { const E = window.imageEditorInstance.E, L = E.S.layers.find((x) => x.type === "sketch"); return { n: E.S.layers.length, cons: L.sketch.ents.find((e) => e.t === "circle").cons }; });
    check("...undo takes the shapes back, undo again the construction (one step each)", a7.n === n0 && a7.cons === false, a7);

    /* 7 the layer moves its points; the .bgi keeps it */
    await ev(() => { const E = window.imageEditorInstance.E; E.setActive(E.S.layers.findIndex((x) => x.type === "sketch")); E.shiftLayer(E.layer(), 10, 5); });
    const mv = await ev(() => { const s = window.imageEditorInstance.E.layer().sketch, K = window.PCSketch; return [K.pt(s, s.origin.pt).x, K.pt(s, s.origin.pt).y, K.solve(s).ok]; });
    check("moving the sketch layer moves its points and fixed places (still solved)", Math.abs(mv[0] - 410) < 1e-6 && Math.abs(mv[1] - 255) < 1e-6 && mv[2], mv);
    const d0 = (await sk()).dof;
    await ev((n) => window.imageEditorInstance.E.bgi.save(n, false), tag);
    await ev((n) => window.imageEditorInstance.E.bgi.openFromProject(n + ".bgi"), tag); await p.waitForTimeout(800);
    const re = await ev(() => { const E = window.imageEditorInstance.E, i = E.S.layers.findIndex((x) => x.type === "sketch"); E.setActive(i); const L = E.layer(); return L && L.sketch ? { dof: window.PCSketch.dof(L.sketch).dof, ents: L.sketch.ents.length, a: L.canvas.getContext("2d").getImageData(480, 255, 1, 1).data[3] } : null; });
    check("...the .bgi keeps the sketch: the same degrees of freedom, drawn again", re && re.dof === d0 && re.ents >= 7 && re.a > 100, { re, d0 });
    /* 8 the K key */
    await ev(() => { window.imageEditorInstance.E.setTool("move"); });
    await p.locator("#ieStage").focus(); await p.keyboard.press("n"); await p.waitForTimeout(150);
    const kt = await ev(() => window.imageEditorInstance.E.S.tool);
    check("N picks the sketch tools (the tool column's N group)", /^sk_/.test(kt), kt);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + e.stack); }
  finally {
    try { fs.rmSync(path.join(ROOT, "projects", proj, "bgi", tag + ".bgi"), { force: true }); } catch { /* fine */ }
    await b.close();
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
