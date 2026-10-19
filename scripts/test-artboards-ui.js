#!/usr/bin/env node
/* bitGen Studio — 2.447.0 in a REAL browser: ARTBOARDS in the image editor (pcartboards.js). Tim: "more photoshop features
 * to close the gap" - Artboards. Against the running app (H3_URL, default :8311). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the artboards browser test did not run"); process.exit(0); }
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
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.artboards, null, { timeout: 60000 });
    await p.waitForTimeout(600);
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await p.click("#kxFull"); await p.waitForTimeout(800);
    await ev(() => {
      const E = window.imageEditorInstance.E;
      E.docs.setTabs(true); E.openDoc(400, 300, "boards.png", (g) => { g.fillStyle = "#ffffff"; g.fillRect(0, 0, 400, 300); });
      const R = E.makeLayer("Red", 400, 300); const g = R.canvas.getContext("2d"); g.fillStyle = "#ff0000"; g.fillRect(0, 0, 400, 300); E.addLayer(R, "t", false);
      E.setActive(E.S.layers.indexOf(R));
    });
    const flatPx = (x, y) => ev(([x, y]) => Array.from(window.imageEditorInstance.E.flatten().getContext("2d").getImageData(x, y, 1, 1).data.slice(0, 3)), [x, y]);

    /* 1 Layer ▸ New ▸ Artboard…: 200 x 150, green, the Red layer in it */
    await ev(() => window.imageEditorInstance.E.ui.run("layer.newartboard")); await p.waitForTimeout(250);
    await ev(() => { const s = (id, v) => { document.getElementById(id).value = v; }; s("abN", "Post"); s("abW", "200"); s("abH", "150"); s("abBg", "#00ff00"); document.querySelector(".kxdlg.pcd .ok").click(); });
    await p.waitForTimeout(300);
    const a1 = await ev(() => { const E = window.imageEditorInstance.E, G = E.S.layers.find((L) => L.name === "Post"), R = E.S.layers.find((L) => L.name === "Red"); return { board: G && G.artboard, inIt: R.parent === (G && G.id), type: G && G.type }; });
    const inP = await flatPx(100, 75), outP = await flatPx(300, 200);
    check("Layer ▸ New ▸ Artboard…: a group with its rectangle (0, 0, 200 x 150, green) holding the picked layer", a1.type === "group" && a1.board && a1.board.x === 0 && a1.board.w === 200 && a1.board.h === 150 && a1.board.bg === "#00ff00" && a1.inIt, a1);
    check("...its layers show only INSIDE it: red at 100,75, the white Background at 300,200 (outside)", inP[0] > 240 && inP[1] < 20 && outP.every((v) => v > 240), { inP, outP });

    /* 2 a second one, 300 x 100 blue: to the right of the first; the canvas grows to hold it */
    await ev(() => { const E = window.imageEditorInstance.E; E.setActive(0); E.ui.run("layer.newartboard"); });
    await p.waitForTimeout(250);
    await ev(() => { const s = (id, v) => { document.getElementById(id).value = v; }; s("abN", "Banner"); s("abW", "300"); s("abH", "100"); s("abBg", "#0000ff"); document.getElementById("abMove").checked = false; document.querySelector(".kxdlg.pcd .ok").click(); });
    await p.waitForTimeout(400);
    const a2 = await ev(() => { const E = window.imageEditorInstance.E, G = E.S.layers.find((L) => L.name === "Banner"); return { board: G && G.artboard, w: E.S.w, h: E.S.h }; });
    const blue = await flatPx(430, 50);
    await shot("2-two");
    check("a second artboard goes right of the first (x 280 = 200 + the gap); the canvas grows to hold it (580 wide); its blue background shows", a2.board && a2.board.x === 280 && a2.board.y === 0 && a2.w === 580 && blue[2] > 240 && blue[0] < 20, { a2, blue });

    /* 3 moved: its rectangle and its layers together; undo */
    const m3 = await ev(() => { const E = window.imageEditorInstance.E, G = E.S.layers.find((L) => L.name === "Post"); E.setActive(E.S.layers.indexOf(G)); E.setTool("move"); E.nudge(10, 5);
      const R = E.S.layers.find((L) => L.name === "Red"), px = R.canvas.getContext("2d").getImageData(5, 3, 1, 1).data[3], after = Object.assign({}, G.artboard); E.undo(); return { after, px, back: G.artboard.x }; });
    check("moving an artboard (the arrows / Move tool) moves its rectangle and its layers together; one undo puts both back", m3.after.x === 10 && m3.after.y === 5 && m3.px === 0 && m3.back === 0, m3);

    /* 4 Properties of an artboard */
    await ev(() => window.imageEditorInstance.E.ui.showTab("pcProps")); await p.waitForTimeout(200);
    const pp = await ev(() => !!document.getElementById("ppArtboard") && document.getElementById("ppAbW").value === "200");
    await ev(() => { const x = document.getElementById("ppAbW"); x.value = "220"; x.onchange(); });
    const w4 = await ev(() => window.imageEditorInstance.E.S.layers.find((L) => L.name === "Post").artboard.w);
    check("Properties of an artboard: X / Y / W / H / background - W 220 kept", pp && w4 === 220, { pp, w4 });

    /* 5 File ▸ Export ▸ Artboards to Files…: each its own PNG, its size, only its own layers */
    const ex = await ev(async () => {
      const E = window.imageEditorInstance.E, got = [];
      const keep = E.api.save; E.api.save = async (blob, name) => { const bm = await createImageBitmap(blob), c = document.createElement("canvas"); c.width = bm.width; c.height = bm.height; const g = c.getContext("2d"); g.drawImage(bm, 0, 0);
        got.push({ name, w: bm.width, h: bm.height, px: Array.from(g.getImageData(5, 5, 1, 1).data.slice(0, 3)) }); return name; };
      try { await E.artboards.exportAll(true, false); } finally { E.api.save = keep; }
      return got;
    });
    check("Export Artboards: one PNG each, named <picture>-<artboard>.png, its own size, only what is in it (Post red, Banner its blue background)",
      ex.length === 2 && ex[0].name === "boards-Post.png" && ex[0].w === 220 && ex[0].h === 150 && ex[0].px[0] > 240 && ex[1].name === "boards-Banner.png" && ex[1].w === 300 && ex[1].h === 100 && ex[1].px[2] > 240 && ex[1].px[0] < 20, ex);

    /* 6 the Artboard tool: drag a rectangle */
    await ev(() => window.imageEditorInstance.E.setTool("artboard")); await p.waitForTimeout(150);
    const sc = (x, y) => ev(([x, y]) => { const r = document.getElementById("kxPaper").getBoundingClientRect(), z = window.imageEditorInstance.E.S.zoom; return [r.left + x * z, r.top + y * z]; }, [x, y]);
    const [x0, y0] = await sc(300, 150), [x1, y1] = await sc(420, 260);
    await p.mouse.move(x0, y0); await p.mouse.down(); await p.mouse.move(x1, y1, { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(300);
    const t6 = await ev(() => { const E = window.imageEditorInstance.E, list = E.artboards.list(); const G = list[list.length - 1]; return { n: list.length, a: G.artboard, inMenu: E.ui.CMD.has("layer.newartboard") && E.ui.CMD.has("file.exportboards") }; });
    await shot("6-tool");
    check("the Artboard tool (in the Move tool's group): a dragged rectangle = a new artboard there", t6.n === 3 && Math.abs(t6.a.x - 300) <= 2 && Math.abs(t6.a.w - 120) <= 3 && Math.abs(t6.a.h - 110) <= 3 && t6.inMenu, t6);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + e.stack); }
  finally { await b.close(); }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
