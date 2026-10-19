#!/usr/bin/env node
/* bitGen Studio — 2.463.0 in a REAL browser: the SKETCH MODIFY TOOLS (pcsketch.js + pcsketchtools.js) - a rectangle
 * dragged, Trim (T), Fillet (F) with a typed radius, ⇉ Offset…, ⇋ Mirror, ▦ Rectangular Pattern…, Polygon (dragged),
 * Slot, Spline (Enter), Extend (E).
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
if (!chromium) { console.log("SKIP: playwright is not installed here - the sketch modify browser test did not run"); process.exit(0); }
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
  const tag = "zzskm" + process.pid;
  let proj = "default";
  try {
    try { await fetch(URL_ + "api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docks: { imageeditdock: { state: "open", hidden: false, maximized: false } } }) }); } catch { /* older */ }
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.dims, null, { timeout: 60000 });
    await p.waitForTimeout(800);
    proj = (await (await fetch(URL_ + "api/projects")).json()).current;
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await p.click("#kxFull"); await p.waitForTimeout(800);
    await ev(() => { const E = window.imageEditorInstance.E; Object.assign(E.guides.settings, { snap: false }); E.docs.setTabs(true); E.openDoc(800, 500, "skm.png", (g) => { g.fillStyle = "#fff"; g.fillRect(0, 0, 800, 500); }); E.ui.run("layer.newsketch"); });
    await p.waitForTimeout(300);
    const sc = (x, y) => ev(([x, y]) => { const r = document.getElementById("kxPaper").getBoundingClientRect(), z = window.imageEditorInstance.E.S.zoom; return [r.left + x * z, r.top + y * z]; }, [x, y]);
    const click = async (x, y) => { const [a, bb] = await sc(x, y); await p.mouse.move(a, bb, { steps: 2 }); await p.mouse.down(); await p.mouse.up(); await p.waitForTimeout(150); };
    const drag = async (x0, y0, x1, y1) => { const [a, bb] = await sc(x0, y0), [c, d] = await sc(x1, y1); await p.mouse.move(a, bb, { steps: 2 }); await p.mouse.down(); await p.mouse.move(c, d, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(250); };
    const tool = (t) => ev((t) => window.imageEditorInstance.E.setTool(t), t);
    const info = () => ev(() => { const L = window.imageEditorInstance.E.layer(), K = window.PCSketch, s = L.sketch, r1 = (v) => Math.round(v * 100) / 100;
      return { ents: s.ents.filter((e) => !e.axis).map((e) => ({ id: e.id, t: e.t, cons: !!e.cons, pts: K.ptsOf(e).map((q) => [r1(K.pt(s, q).x), r1(K.pt(s, q).y)]) })), cons: s.cons.map((k) => k.t), dims: s.dims.map((m) => [m.t, r1(m.v), !!m.driven]), prof: K.profiles(s).map((q) => Math.round(q.area)), dof: K.dof(s).dof }; });

    /* 1 a rectangle 100..300 x 100..200 (drawn by dragging) + a line across it -> Trim the piece between */
    await tool("sk_rect"); await drag(100, 100, 300, 200);
    await tool("sk_line"); await click(200, 60); await click(200, 240); await p.keyboard.press("Escape");
    let a = await info();
    check("a 2-point rectangle drawn by DRAGGING + a line across it", a.ents.filter((e) => e.t === "line").length === 5 && a.prof.length === 1, a);
    await tool("sk_trim"); await p.mouse.move(...(await sc(200, 80))); await p.waitForTimeout(200);
    await click(200, 80); await click(200, 220);
    a = await info();
    const v = a.ents.filter((e) => e.t === "line" && e.pts[0][0] === 200 && e.pts[1][0] === 200);
    check("Trim the line's two ends outside the rectangle: what is left runs 100 -> 200, kept on the rectangle's sides - two profiles now", v.length === 1 && JSON.stringify(v[0].pts.map((q) => q[1]).sort((x, y) => x - y)) === "[100,200]" && a.prof.length === 2 && a.cons.filter((t) => t === "onLine").length === 2, { v, prof: a.prof });
    await click(250, 100);
    a = await info();
    check("...Trim the top edge's right half (between the cut and the corner): the right region opens (one profile left)", a.prof.length === 1, a.prof);
    await ev(() => window.imageEditorInstance.E.undo());

    /* 2 Fillet: click the bottom-right corner point, type 25 */
    await tool("sk_fillet"); await click(300, 200);
    await p.waitForSelector("#skDimIn", { timeout: 3000 }); await p.fill("#skDimIn", "25"); await p.press("#skDimIn", "Enter"); await p.waitForTimeout(400);
    a = await info();
    const arc = a.ents.find((e) => e.t === "arc");
    check("Fillet (F): the corner point clicked -> a tangent arc, its radius typed 25 (centre 275, 175)", arc && a.dims.some((d) => d[0] === "radius" && d[1] === 25) && JSON.stringify(arc.pts[0]) === "[275,175]" && a.cons.filter((t) => t === "tangent").length === 2, { arc, dims: a.dims });

    /* 3 Offset the rectangle's left half lines: pick + the dialog */
    const ids = await ev(() => { const s = window.imageEditorInstance.E.layer().sketch, K = window.PCSketch; return s.ents.filter((e) => e.t === "circle" || (e.t === "line" && !e.axis)).map((e) => e.id); });
    await tool("sk_select");
    await ev((ids) => window.imageEditorInstance.E.sketch.setSel(ids.map((id) => ({ k: "ent", id }))), ids);
    await ev(() => window.imageEditorInstance.E.ui.showTab("ksk")); await p.waitForTimeout(200);
    await p.click("#skOffset"); await p.fill(".kxdlg.pcd #skOffD", "8"); await p.click(".kxdlg.pcd .ok"); await p.waitForTimeout(500);
    const a2 = await info();
    check("⇉ Offset… the picked lines by 8: one new line each, parallel, at 8 (a dimension each)", a2.ents.filter((e) => e.t === "line").length === a.ents.filter((e) => e.t === "line").length * 2 && a2.cons.filter((t) => t === "parallel").length >= a.ents.filter((e) => e.t === "line").length && a2.dims.some((d) => d[0] === "ptline" && d[1] === 8), { before: a.ents.length, after: a2.ents.length, dims: a2.dims });
    await ev(() => window.imageEditorInstance.E.undo());

    /* 4 Mirror a circle about the middle line; a rectangular pattern of it */
    await tool("sk_circle"); await click(150, 150); await click(165, 150);
    const circ = await ev(() => { const s = window.imageEditorInstance.E.layer().sketch; return s.ents.filter((e) => e.t === "circle").pop().id; });
    const mid = await ev(() => { const s = window.imageEditorInstance.E.layer().sketch, K = window.PCSketch; return s.ents.find((e) => e.t === "line" && Math.abs(K.pt(s, e.p1).x - 200) < 0.01 && Math.abs(K.pt(s, e.p2).x - 200) < 0.01).id; });
    await tool("sk_select"); await ev(([c, m]) => window.imageEditorInstance.E.sketch.setSel([{ k: "ent", id: c }, { k: "ent", id: m }]), [circ, mid]);
    await p.click("#skMirror"); await p.waitForTimeout(400);
    a = await info();
    const mc = a.ents.filter((e) => e.t === "circle");
    check("⇋ Mirror (the circle, then the middle line LAST): a copy at x 250, kept symmetric", mc.length === 2 && mc.some((e) => e.pts[0][0] === 250 && e.pts[0][1] === 150) && a.cons.includes("symmetric"), mc);
    await ev((c) => window.imageEditorInstance.E.sketch.setSel([{ k: "ent", id: c }]), circ);
    await p.click("#skRectPat"); await p.fill(".kxdlg.pcd #skPnx", "1"); await p.fill(".kxdlg.pcd #skPny", "3"); await p.fill(".kxdlg.pcd #skPdy", "120"); await p.click(".kxdlg.pcd .ok"); await p.waitForTimeout(400);
    a = await info();
    check("▦ Rectangular Pattern 1 x 3, 120 apart: two copies below (y 270, 390)", a.ents.filter((e) => e.t === "circle").length === 4 && [270, 390].every((y) => a.ents.some((e) => e.t === "circle" && e.pts[0][0] === 150 && e.pts[0][1] === y)), a.ents.filter((e) => e.t === "circle").map((e) => e.pts[0]));

    /* 5 Polygon, slot, spline, extend */
    await tool("sk_poly"); await drag(600, 120, 640, 120);
    await tool("sk_slot"); await click(520, 300); await click(680, 300); await click(600, 320);
    await tool("sk_spline"); await click(450, 420); await click(500, 380); await click(560, 440); await ev(() => document.getElementById("ieStage").focus()); await p.keyboard.press("Enter"); await p.waitForTimeout(200);
    a = await info();
    check("Polygon (dragged: a hexagon r 40), Slot (3 clicks: 160 long, 40 wide), Spline (3 points, Enter)", a.ents.filter((e) => e.t === "line").length >= 6 + 2 && a.ents.some((e) => e.t === "spline" && e.pts.length === 3) && a.ents.filter((e) => e.t === "arc").length >= 3 && a.prof.some((x) => Math.abs(x - 4157) < 15) && a.prof.some((x) => Math.abs(x - (160 * 40 + Math.PI * 400)) < 60), a.prof);
    await tool("sk_line"); await click(80, 260); await click(120, 230); await p.keyboard.press("Escape");
    await tool("sk_extend"); await click(118, 231);
    a = await info();
    const ext = a.ents.find((e) => e.t === "line" && e.pts[0][0] === 80 && e.pts[0][1] === 260);
    check("Extend (E): the short line's end runs on to the rectangle (its bottom side, y 200)", ext && Math.abs(ext.pts[1][1] - 200) < 0.01, ext);
    await p.screenshot({ path: path.join(SHOTS || os.tmpdir(), "skm-final.png") }).catch(() => {});
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + e.stack); }
  finally {
    await b.close();
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
