#!/usr/bin/env node
/* bitGen Studio — 2.440.0 in a REAL browser: RULERS, GUIDELINES AND SNAPPING in the image editor (pcguides.js).
 * Tim: "add rulers, guidelines, snap options like coreldraw to image editor."
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
if (!chromium) { console.log("SKIP: playwright is not installed here - the guidelines / snapping browser test did not run"); process.exit(0); }
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
  const tag = "zzg" + process.pid;
  let proj = "default";
  try {
    try { await fetch(URL_ + "api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docks: { imageeditdock: { state: "open", hidden: false, maximized: false } } }) }); } catch { /* older */ }
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.guides, null, { timeout: 60000 });
    await p.waitForTimeout(800);
    proj = (await (await fetch(URL_ + "api/projects")).json()).current;
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await p.click("#kxFull"); await p.waitForTimeout(800);
    await ev(() => { const E = window.imageEditorInstance.E, G = E.guides.settings; Object.assign(G, { snap: true, guides: true, objects: true, nodes: true, midpoints: false, intersections: true, page: true, grid: false, show: true, lock: false, unit: "px", dist: 8 });
      E.docs.setTabs(true); E.openDoc(400, 300, "guides.png", (g) => { g.fillStyle = "#fff"; g.fillRect(0, 0, 400, 300); });
      if (!document.querySelector(".kx").classList.contains("rulers")) E.ui.run("view.rulers"); E.setTool("move"); });
    await p.waitForTimeout(300);
    const sc = (x, y) => ev(([x, y]) => { const r = document.getElementById("kxPaper").getBoundingClientRect(), z = window.imageEditorInstance.E.S.zoom; return [r.left + x * z, r.top + y * z]; }, [x, y]);
    const guides = () => ev(() => window.imageEditorInstance.E.S.guides.map((q) => [q.o, Math.round(q.p * 10) / 10]));

    /* 1 guidelines out of the rulers */
    const rh = await (await p.$("#pcRulerH")).boundingBox(), rv = await (await p.$("#pcRulerV")).boundingBox();
    let [x, y] = await sc(120, 100);
    await p.mouse.move(x, rh.y + 8); await p.mouse.down(); await p.mouse.move(x, y, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(150);
    [x, y] = await sc(203, 60);
    await p.mouse.move(rv.x + 8, y); await p.mouse.down(); await p.mouse.move(x, y, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(150);
    const g1 = await guides();
    await shot("1-guides");
    const bg = await ev(() => { const E = window.imageEditorInstance.E, L = E.S.layers[0]; return Array.from(L.canvas.getContext("2d").getImageData(200, 150, 1, 1).data); });
    check("...a press on a ruler does not reach the picture (the Move tool did not move the Background)", bg[3] === 255 && bg[0] === 255, bg);
    check("dragged out of the top ruler = a horizontal guideline (y 100), out of the left one a vertical one - snapped to the page centre (x 200)", g1.length === 2 && g1[0][0] === "h" && Math.abs(g1[0][1] - 100) <= 1 && g1[1][0] === "v" && g1[1][1] === 200, g1);

    /* 2 a rectangle drawn from near the crossing starts ON it */
    await ev(() => window.imageEditorInstance.E.setTool("crect"));
    await ev(() => { const b = document.querySelector('[data-dop="new"]'); if (b) b.click(); });
    [x, y] = await sc(204, 104); const [x2, y2] = await sc(296, 176);
    await p.mouse.move(x, y); await p.mouse.down(); await p.mouse.move(x2 - 20, y2 - 10, { steps: 4 });
    const snapShown = await ev(() => { const l = window.imageEditorInstance.E.guides.last(); return l && l.k; });
    await p.mouse.move(x2, y2, { steps: 3 }); await p.mouse.up(); await p.waitForTimeout(250);
    const box = await ev(() => { const E = window.imageEditorInstance.E; return E.dockers.boxOf(E.layer()); });
    check("Snap: a rectangle drawn from 4 px off the guideline crossing starts on it (200, 100)", Math.abs(box.x - 200) < 0.6 && Math.abs(box.y - 100) < 0.6, { box, snapShown });

    /* 3 the Move tool snaps a layer's box */
    await ev(() => { const E = window.imageEditorInstance.E; const L = E.makeLayer("Square", 400, 300); const g = L.canvas.getContext("2d"); g.fillStyle = "#c00"; g.fillRect(20, 200, 40, 40); E.addLayer(L, "t", false); E.setTool("move"); });
    [x, y] = await sc(40, 220); const [mx, my] = await sc(40 + 137, 220);
    await p.mouse.move(x, y); await p.mouse.down(); await p.mouse.move(mx, my, { steps: 10 }); await p.mouse.up(); await p.waitForTimeout(300);
    const sq = await ev(() => { const E = window.imageEditorInstance.E; return E.dockers.boxOf(E.layer()); });
    check("Move: a layer dragged so its right edge comes 3 px short of the guideline lands with it on the guideline (x 160..200)", Math.abs(sq.x + sq.w - 200) < 1, sq);

    /* 4 a guideline moved with the Move tool, then dragged back onto the ruler = gone */
    [x, y] = await sc(330, 100); const [x3, y3] = await sc(330, 262);
    await p.mouse.move(x, y); await p.mouse.down(); await p.mouse.move(x3, y3, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(150);
    const g2 = await guides();
    check("the Move tool drags a guideline (y 100 -> 262, nothing to snap to there)", g2.some((q) => q[0] === "h" && Math.abs(q[1] - 262) <= 1), g2);
    [x, y] = await sc(330, 262);
    await p.mouse.move(x, y); await p.mouse.down(); await p.mouse.move(x, rh.y + 8, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(150);
    const g3 = await guides();
    check("...dragged back onto the ruler: removed", g3.length === 1 && g3[0][0] === "v", g3);

    /* 5 units: millimetres - the Guidelines dialog in mm, a new one by typing */
    await ev(() => window.imageEditorInstance.E.ui.run("ruler.mm"));
    await ev(() => window.imageEditorInstance.E.ui.run("guide.edit")); await p.waitForTimeout(200);
    const inMm = await ev(() => [...document.querySelectorAll(".kxdlg .gdP")].map((x) => +x.value));
    await p.selectOption("#gdO", "h"); await p.fill("#gdN", "25.4"); await p.click("#gdAdd"); await p.waitForTimeout(150);
    await ev(() => document.querySelector(".kxdlg.pcd .ok").click());
    const g4 = await guides();
    await shot("5-mm");
    check("Ruler Units ▸ Millimetres: the Guidelines dialog in mm (x 200 px = 52.92 mm at 96 dpi); 25.4 mm typed = a guideline at 96 px", Math.abs(inMm[0] - 52.92) < 0.01 && g4.some((q) => q[0] === "h" && Math.abs(q[1] - 96) < 0.01), { inMm, g4 });
    await ev(() => window.imageEditorInstance.E.ui.run("ruler.px"));

    /* 6 snapping off: no pull */
    await ev(() => window.imageEditorInstance.E.ui.run("snap.on"));
    await ev(() => window.imageEditorInstance.E.setTool("crect"));
    [x, y] = await sc(204, 304 - 200); const [x4, y4] = await sc(250, 150);
    await p.mouse.move(x, y); await p.mouse.down(); await p.mouse.move(x4, y4, { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(250);
    const free = await ev(() => { const E = window.imageEditorInstance.E; return E.dockers.boxOf(E.layer()); });
    await ev(() => window.imageEditorInstance.E.ui.run("snap.on"));
    check("Snap off (Shift+Ctrl+;): drawn where the pointer is (204, 104)", Math.abs(free.x - 204) < 1 && Math.abs(free.y - 104) < 1, free);
    const menu = await ev(() => { const V = window.imageEditorInstance.E.ui.MENUS.find(([n]) => n === "View")[1]; const sub = V.find((x) => x && x.label === "Snap To"); return { snap: sub && sub.items.filter((x) => typeof x === "string"), ids: V.filter((x) => typeof x === "string"), units: (V.find((x) => x && x.label === "Ruler Units") || {}).items }; });
    check("View: Ruler Units ▸ (px mm cm in pt), Guidelines / Lock / New… / Guidelines… / Clear, Snap To ▸ (Snap, Grid, Guidelines, Objects, Nodes, Midpoints, Intersections, Page), Grid and Snapping…",
      menu.units.length === 5 && ["guide.show", "guide.lock", "guide.new", "guide.edit", "guide.clear", "snap.settings"].every((i) => menu.ids.includes(i)) && ["snap.on", "snap.grid", "snap.guides", "snap.objects", "snap.nodes", "snap.midpoints", "snap.intersections", "snap.page"].every((i) => menu.snap.includes(i)), menu);

    /* 7 locked guidelines: none out of the ruler, none moved */
    await ev(() => window.imageEditorInstance.E.ui.run("guide.lock"));
    const n0 = (await guides()).length;
    [x, y] = await sc(60, 60);
    await p.mouse.move(x, rh.y + 8); await p.mouse.down(); await p.mouse.move(x, y, { steps: 5 }); await p.mouse.up(); await p.waitForTimeout(150);
    check("Lock Guidelines: no new one out of the ruler", (await guides()).length === n0);
    await ev(() => window.imageEditorInstance.E.ui.run("guide.lock"));

    /* 8 a .bgi keeps them */
    await ev((n) => window.imageEditorInstance.E.bgi.save(n, false), tag);
    await ev(() => { window.imageEditorInstance.E.S.guides = []; });
    await ev((n) => window.imageEditorInstance.E.bgi.openFromProject(n + ".bgi"), tag); await p.waitForTimeout(600);
    const g5 = await guides();
    check("...a .bgi keeps the document's guidelines", g5.length === g4.length && g5.some((q) => q[0] === "v" && q[1] === 200), { g4, g5 });
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + e.stack); }
  finally {
    fs.rmSync(path.join(ROOT, "projects", proj, "bgi", tag + ".bgi"), { force: true });
    await b.close();
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
