#!/usr/bin/env node
/* bitGen Studio — 2.457.0 in a REAL browser: DIMENSION GROUPS (pcdimgroup.js) - every dimension a
 * group of parts: an edge pressed + dragged, two picks (edge / node), an extension line dragged (the length live), Shift =
 * horizontal / Ctrl = vertical, an extension line's own nodes, the group moved as one, the scale, the .bgi.
 * Tim: "fix dimension lines. keep all of the dimesions elements (dimension line, dimension group, arrowhead and extension
 * line. add option to click on an edge and drag the dimension line from the edge of the object as a dimension group ..."
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
if (!chromium) { console.log("SKIP: playwright is not installed here - the dimension groups browser test did not run"); process.exit(0); }
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
  const tag = "zzdg" + process.pid;
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
      E.docs.setTabs(true); E.openDoc(500, 320, "dimg.png", (g) => { g.fillStyle = "#fff"; g.fillRect(0, 0, 500, 320); });
      const P = E.makeLayer("Block", 500, 320); const g = P.canvas.getContext("2d"); g.fillStyle = "#c00"; g.fillRect(100, 100, 200, 80); E.addLayer(P, "t", false);
      const T = E.makeLayer("Rect", 500, 320, "shape"); T.shape = Object.assign({}, D.SHAPE_DEFAULT, { kind: "path", path: { subs: [{ closed: true, op: "add", pts: [[350, 200], [450, 200], [450, 260], [350, 260]].map(([x, y]) => ({ x, y, ix: x, iy: y, ox: x, oy: y })) }] }, fill: "#3366cc" });
      window.PCPath.syncShape(T.shape); D.rasterize(T); E.addLayer(T, "t", false);
      Object.assign(E.S.cd, { unit: "px", dec: 1 }); E.setTool("cdimpar"); });
    await p.waitForTimeout(300);
    const sc = (x, y) => ev(([x, y]) => { const r = document.getElementById("kxPaper").getBoundingClientRect(), z = window.imageEditorInstance.E.S.zoom; return [r.left + x * z, r.top + y * z]; }, [x, y]);
    const click = async (x, y) => { const [a, bb] = await sc(x, y); await p.mouse.move(a, bb, { steps: 2 }); await p.mouse.down(); await p.mouse.up(); await p.waitForTimeout(140); };
    const drag = async (x0, y0, x1, y1, key, mid) => {
      const [a, bb] = await sc(x0, y0), [c, d] = await sc(x1, y1);
      await p.mouse.move(a, bb, { steps: 2 }); await p.mouse.down(); if (key) await p.keyboard.down(key);
      await p.mouse.move((a + c) / 2, (bb + d) / 2, { steps: 4 }); const m = mid ? await ev(mid) : null;
      await p.mouse.move(c, d, { steps: 4 }); if (key) await p.keyboard.up(key); await p.mouse.up(); await p.waitForTimeout(250); return m;
    };
    const grp = (name) => ev((n) => { const E = window.imageEditorInstance.E, G = n ? E.S.layers.find((L) => L.name === n) : E.dimGroups.groupOf(E.layer()); if (!G) return null;
      const parts = E.S.layers.filter((L) => L.parent === G.id), line = parts.find((L) => L.dimPart === "line"), r = (v) => Math.round(v * 10) / 10;
      return { name: G.name, kind: G.dimg.kind, a: G.dimg.a.map(r), b: G.dimg.b.map(r), m: G.dimg.m.map(r), ext: G.dimg.ext, len: r(E.dimGroups.geom(G.dimg).len),
        roles: parts.map((L) => L.dimPart).sort().join(), arrows: parts.map((L) => L.dimPart + ":" + L.shape.line.start + "/" + L.shape.line.end).sort().join(),
        text: line && line.shape.line.labels[0] && line.shape.line.labels[0].text, active: E.layer() === G }; }, name || null);
    const liveText = () => { const E = window.imageEditorInstance.E, G = E.dimGroups.groupOf(E.layer()), L = G && E.S.layers.find((x) => x.parent === G.id && x.dimPart === "line"); return L ? L.shape.line.labels[0].text : null; };
    const midOf = () => ev(() => { const E = window.imageEditorInstance.E, g = E.dimGroups.geom(E.dimGroups.groupOf(E.layer()).dimg); return [(g.d0[0] + g.d1[0]) / 2, (g.d0[1] + g.d1[1]) / 2]; });

    /* 1 press on the Rect's top edge and drag up: a dimension GROUP of that edge */
    const nBefore = await ev(() => window.imageEditorInstance.E.S.layers.length);
    await drag(378, 201, 378, 170);
    const g1 = await grp();
    await shot("1-edge-drag");
    const nAfter = await ev(() => window.imageEditorInstance.E.S.layers.length);
    check("an edge pressed and dragged: a dimension group of that edge (350..450 = 100.0 px), its line at the pointer (y 170)", g1 && g1.len === 100 && g1.text === "100.0 px" && Math.abs(g1.m[1] - 170) < 1.5 && JSON.stringify(g1.a) === "[350,200]" && JSON.stringify(g1.b) === "[450,200]" && g1.active, g1);
    check("...the group holds the 3 parts (Extension Line 1, Extension Line 2, the Dimension Line) = 4 new layers; the arrowheads only on the dimension line", g1 && g1.roles === "ext1,ext2,line" && g1.arrows === "ext1:none/none,ext2:none/none,line:arrow/arrow" && nAfter - nBefore === 4, { g1, nBefore, nAfter });
    const px = await ev(() => { const E = window.imageEditorInstance.E, G = E.layer(), k = E.S.layers.filter((L) => L.parent === G.id), a = (L, x, y) => L.canvas.getContext("2d").getImageData(x, y, 1, 1).data[3];
      const e1 = k.find((L) => L.dimPart === "ext1"), e2 = k.find((L) => L.dimPart === "ext2"), ln = k.find((L) => L.dimPart === "line");
      return { e1: a(e1, 350, 182), e1gap: a(e1, 350, 199), e2: a(e2, 450, 182), ln: a(ln, 400, 170) }; });
    check("...each part drawn on its own layer: the extension lines (a gap left at the edge), the dimension line", px.e1 > 100 && px.e1gap < 20 && px.e2 > 100 && px.ln > 100, px);
    await ev(() => window.imageEditorInstance.E.undo());
    check("...one undo step takes the whole group away", (await ev(() => window.imageEditorInstance.E.S.layers.length)) === nBefore);
    await ev(() => window.imageEditorInstance.E.redo());

    /* 2 two picks: the Rect's bottom EDGE, then the Block's corner NODE (300,180) -> square to the edge = 80; then the place */
    await click(395, 259); await click(302, 182); await click(250, 220);
    const g2 = await grp();
    check("two picks (an edge, then a node): measured from the node square to the edge (300,180 -> 300,260 = 80.0 px)", g2 && g2.len === 80 && JSON.stringify(g2.b) === "[300,180]" && JSON.stringify(g2.a) === "[300,260]" && g2.name !== g1.name, g2);
    await click(101, 140); await click(299, 141); await click(200, 60);
    const g3 = await grp();
    check("...a node then another (the Block's sides): 200.0 px", g3 && g3.len === 200, g3);

    /* 3 the Move tool: drag Extension Line 2 of the first group - the length changes live */
    await ev((n) => { const E = window.imageEditorInstance.E; E.setTool("move"); E.setActive(E.S.layers.findIndex((L) => L.name === n)); }, g1.name);
    await p.waitForTimeout(300);
    const mid = await drag(450, 182, 480, 184, "Alt", liveText);   // Alt: no CAD point
    const g4 = await grp(g1.name);
    await shot("3-ext-dragged");
    check("an extension line dragged 30 px along: its point slides, the length follows live (mid-drag " + mid + ") and ends at 130.0 px", g4.len === 130 && g4.text === "130.0 px" && mid && mid !== "100.0 px" && mid !== "130.0 px" && JSON.stringify(g4.a) === "[350,200]", { g4, mid });
    await ev(() => window.imageEditorInstance.E.undo());
    check("...one undo step puts it back (100.0 px)", (await grp(g1.name)).len === 100);
    await ev(() => { window.imageEditorInstance.E.guides.settings.objects = true; });
    await drag(450, 182, 303, 143);   // onto the Block's right side middle (a CAD point): it lines up with it
    await ev(() => { window.imageEditorInstance.E.guides.settings.objects = false; });
    const g4b = await grp(g1.name);
    check("...dragged onto a CAD point (the Block's right side, x 300): its point lines up with it (50.0 px)", JSON.stringify(g4b.b) === "[300,200]" && g4b.len === 50, g4b);
    await ev(() => window.imageEditorInstance.E.undo());

    /* 4 an extension line's own nodes: only that one changes */
    await drag(350, 164, 350, 140);
    const g5 = await grp(g1.name);
    check("an extension line's end node dragged: that line runs 30 past the dimension line, the other stays (6); the length stays", Math.abs(g5.ext[0].over - 30) < 1 && g5.ext[1].over === 6 && g5.len === 100, g5.ext);
    await drag(450, 196, 450, 190);
    const g6 = await grp(g1.name);
    check("...Extension Line 2's start node: its gap 10, Extension Line 1's gap stays 4", Math.abs(g6.ext[1].gap - 10) < 1 && g6.ext[0].gap === 4, g6.ext);

    /* 5 Shift / Ctrl: a slanted dimension's line dragged by its middle dot */
    await ev(() => { const E = window.imageEditorInstance.E; E.dimGroups.create(window.PCDimGroup.makeDef("parallel", [60, 240], [160, 280], [96, 290])); });
    const gs = await grp();
    const gm = await midOf();
    await drag(gm[0], gm[1], gm[0] + 10, 305, "Shift");
    const gH = await grp(gs.name);
    check("a slanted dimension (" + gs.len + " px) - its line dragged with Shift: horizontal (measures across: 100.0 px)", gs.kind === "parallel" && gH.kind === "horizontal" && gH.len === 100 && gH.text === "100.0 px", { gs, gH });
    const gm2 = await midOf();
    await drag(gm2[0], gm2[1], 190, 262, "Control");
    const gV = await grp(gs.name);
    check("...with Ctrl: vertical (measures up / down: 40.0 px)", gV.kind === "vertical" && gV.len === 40, gV);

    /* 6 the whole group moved with the Move tool (by its line): the definition follows */
    await ev((n) => { const E = window.imageEditorInstance.E; E.setActive(E.S.layers.findIndex((L) => L.name === n)); }, g1.name);
    await p.waitForTimeout(200);
    await drag(372, 170, 392, 140);
    const g7 = await grp(g1.name);
    await shot("6-moved");
    check("the group moved as one by its dimension line (+20, -30): its points follow, still 100.0 px", JSON.stringify(g7.a) === "[370,170]" && JSON.stringify(g7.b) === "[470,170]" && g7.len === 100, g7);
    await ev(() => window.imageEditorInstance.E.undo());
    const g8 = await grp(g1.name);
    check("...one undo step puts it back", JSON.stringify(g8.a) === "[350,200]", g8);

    /* 7 a part clicked on the canvas picks its group; the scale; the .bgi */
    const pick = await ev(() => { const E = window.imageEditorInstance.E, i = E.layerAt(400, 170); return i >= 0 ? E.S.layers[i].name : null; });
    check("a part clicked on the canvas picks its dimension group (so it moves as one)", pick === g1.name, pick);
    await ev((n) => { const E = window.imageEditorInstance.E; E.setActive(E.S.layers.findIndex((L) => L.name === n)); }, g1.name);
    await p.waitForTimeout(600);
    const row = await ev(() => !!document.getElementById("pbDimV"));
    await ev(() => window.imageEditorInstance.E.dims.setScale(5, "m", 2));
    const all = await ev(() => { const E = window.imageEditorInstance.E; return E.S.layers.filter((L) => E.dimGroups.isGroup(L)).map((G) => E.S.layers.find((x) => x.parent === G.id && x.dimPart === "line").shape.line.labels[0].text).sort(); });
    check("the property bar of a picked group: its size + unit; 100 px = 5 m: every group measured again", row && all.includes("5.00 m") && all.includes("10.00 m") && all.includes("4.00 m"), { row, all });
    await ev((n) => window.imageEditorInstance.E.bgi.save(n, false), tag);
    await ev((n) => window.imageEditorInstance.E.bgi.openFromProject(n + ".bgi"), tag); await p.waitForTimeout(800);
    const re = await ev(() => { const E = window.imageEditorInstance.E; return E.S.layers.filter((L) => E.dimGroups.isGroup(L)).map((G) => E.S.layers.filter((x) => x.parent === G.id).map((x) => x.dimPart).sort().join()); });
    check("...the .bgi keeps every group with its parts' roles (still editable)", re.length === 4 && re.every((x) => x === "ext1,ext2,line"), re);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + e.stack); }
  finally {
    fs.rmSync(path.join(ROOT, "projects", proj, "bgi", tag + ".bgi"), { force: true });
    await b.close();
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
