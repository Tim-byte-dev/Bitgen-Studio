#!/usr/bin/env node
/* bitGen Studio — 2.430.0 in a REAL browser: the image editor's DOCUMENTS (floating windows / tabs - pcdocs.js) and
 * CorelDRAW's COLOUR PALETTE, ⊠ transparent, AUTO-FILL (pcpalette.js).
 * Tim: "in image editor open/create new file in a modular docker, when docked show open documents as tabs. add a
 * transparent color to the color pallet. when a shape is drawn autofill it when it is closed" + "create a pallet docker
 * like coreldraw on the right side of the image-edit docker the autofill color will be the last color selected".
 * Against the running app (H3_URL, default the e2e server on :8311). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the documents / palette browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, cond, got) => {
  if (cond) { pass++; console.log("PASS: " + n); }
  else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); }
};

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1700, height: 1050 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message + " @ " + String(e.stack || "").split("\n").slice(1, 3).join(" | ")));
  const ev = (f, a) => p.evaluate(f, a);
  try {
    try { await fetch(URL_ + "api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docks: { imageeditdock: { state: "open", hidden: false, maximized: false } } }) }); } catch { /* older */ }
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.evaluate(() => { try { for (const k of ["kx.docs.tabs", "kx.pal.off", "kx.pal.which", "kx.lastColor", "kx.vl.autofill"]) localStorage.removeItem(k); } catch (e) { /* fine */ } });
    await p.reload({ waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.docs && window.imageEditorInstance.E.palette, null, { timeout: 60000 });
    await p.waitForTimeout(800);
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await p.click("#kxFull"); await p.waitForTimeout(900);
    const st = () => ev(() => { const E = window.imageEditorInstance.E, s = document.getElementById("ieStage");
      return { list: E.docs.list(), name: E.S.name, tabs: [...document.querySelectorAll(".pcdtab")].map((t) => t.querySelector(".nm").textContent + (t.classList.contains("on") ? "*" : "") + t.querySelector(".dt").textContent),
        wins: [...document.querySelectorAll(".pcdwin")].map((w) => w.querySelector(".nm").textContent + (w.classList.contains("on") ? "*" : "")), inWin: !!s.closest(".pcdwin"), docked: !!s.closest("#pcDHold") && !s.closest(".pcdwin"),
        layers: E.S.layers.map((L) => L.name), undo: E.S.undo.length, w: E.S.w }; });
    const run = (id) => ev((id) => window.imageEditorInstance.E.ui.run(id), id);

    /* 1 New / Open = a document each: the first docks, the next floats */
    await ev(() => { const E = window.imageEditorInstance.E;
      E.openDoc(400, 300, "a.png", (g) => { g.fillStyle = "#ff0000"; g.fillRect(0, 0, 400, 300); });
      E.openDoc(300, 200, "b.png", (g) => { g.fillStyle = "#0000ff"; g.fillRect(0, 0, 300, 200); }); });
    await p.waitForTimeout(250);
    let s = await st();
    check("New / Open: a document each - the first docks as a tab, the second opens in its own floating window (the canvas inside it)", s.tabs.join() === "a.png" && s.wins.join() === "b.png*" && s.inWin && s.name === "b.png" && s.list.length === 2, s);
    const stillOn = await ev(() => getComputedStyle(document.getElementById("pcDStill")).display === "block");
    check("...behind the window the docked room shows a.png as it was left", stillOn);
    // b changes: a new layer (an undo step) -> ● on its window
    await ev(() => window.imageEditorInstance.E.newLayer()); await p.waitForTimeout(150);
    s = await st();
    check("...b's change: its window says ● (not saved)", s.wins[0] === "b.png*" && await ev(() => document.querySelector(".pcdwin .dt").textContent === "●") && s.layers.length === 2, s);

    /* 2 a click on the docked picture brings a.png to the front; b keeps its layers and undo */
    await p.click('.pcdtab[data-id="d1"] .nm'); await p.waitForTimeout(250);
    s = await st();
    check("a click on its tab: a.png in front (the canvas docked), b's window shows its picture", s.name === "a.png" && s.docked && s.tabs[0] === "a.png*" && s.layers.length === 1 && s.undo === 0
      && await ev(() => !!document.querySelector(".pcdwin canvas.still")), s);
    const px = await ev(() => Array.from(window.imageEditorInstance.E.flatten().getContext("2d").getImageData(5, 5, 1, 1).data.slice(0, 3)).join());
    check("...its pixels are its own (red)", px === "255,0,0", px);
    await ev(() => { const E = window.imageEditorInstance.E; E.newLayer(); E.newLayer(); E.undo(); });
    await p.click(".pcdwin canvas.still"); await p.waitForTimeout(250);
    s = await st();
    check("a click on b's window: b in front again - its 2 layers and its own undo (1 step), a's are kept apart", s.name === "b.png" && s.inWin && s.layers.length === 2 && s.undo === 1, s);
    await ev(() => window.imageEditorInstance.E.undo());
    s = await st();
    check("...undo in b only undoes b", s.layers.length === 1 && await ev(() => { const E = window.imageEditorInstance.E, a = E.docs.list().find((d) => d.name === "a.png"); return !!a && !a.live; }), s);

    /* 3 drag the window onto the tab strip = docked; drag a tab off = floating */
    const tb = await p.$(".pcdwin .tb .nm"), tbb = await tb.boundingBox(), strip = await (await p.$("#pcDTabs")).boundingBox();
    await p.mouse.move(tbb.x + 20, tbb.y + 5); await p.mouse.down(); await p.mouse.move(tbb.x + 200, strip.y + 40, { steps: 6 }); await p.mouse.move(strip.x + 300, strip.y + strip.height / 2, { steps: 6 }); await p.mouse.up();
    await p.waitForTimeout(250);
    s = await st();
    check("dragging b's window onto the tab strip docks it: two tabs, no window, b in front", s.tabs.length === 2 && s.wins.length === 0 && s.docked && s.tabs[1].startsWith("b.png*"), s);
    const t1 = await (await p.$('.pcdtab[data-id="d1"]')).boundingBox();
    await p.mouse.move(t1.x + 20, t1.y + 10); await p.mouse.down(); await p.mouse.move(t1.x + 300, t1.y + 260, { steps: 8 }); await p.mouse.up();
    await p.waitForTimeout(250);
    s = await st();
    check("dragging a.png's tab off the strip floats it there (in front)", s.tabs.join() === "b.png" && s.wins.join() === "a.png*" && s.inWin && s.name === "a.png", s);
    await ev(() => { const w = document.querySelector(".pcdwin .tb"); w.dispatchEvent(new MouseEvent("dblclick", { bubbles: true })); });
    await p.waitForTimeout(200);
    s = await st();
    check("...a double-click on its title bar docks it again", s.wins.length === 0 && s.tabs.length === 2 && s.docked, s);

    /* 4 Window ▸ Arrange */
    await run("win.tile"); await p.waitForTimeout(200);
    s = await st();
    const tiles = await ev(() => [...document.querySelectorAll(".pcdwin")].map((w) => [w.offsetLeft, w.offsetTop, w.offsetWidth]));
    check("Window ▸ Arrange ▸ Tile: both in windows side by side", s.wins.length === 2 && s.tabs.length === 0 && tiles[0][1] === tiles[1][1] && tiles[0][0] !== tiles[1][0], tiles);
    await run("win.consolidate"); await p.waitForTimeout(200);
    s = await st();
    check("...Consolidate All to Tabs: both tabs again", s.wins.length === 0 && s.tabs.length === 2, s);
    await run("win.docnext"); s = await st(); const n1 = s.name; await run("win.docnext"); s = await st();
    check("...Next Document (Ctrl+Tab) goes round", n1 !== s.name && ["a.png", "b.png"].includes(n1), [n1, s.name]);
    const arr = await ev(() => { const W = window.imageEditorInstance.E.ui.MENUS.find(([n]) => n === "Window")[1][0]; return W.label + ":" + W.items.filter((x) => x !== "-").join(); });
    check("...the Arrange submenu: Consolidate, Float in Window, Float All, Tile, Cascade, Next / Previous Document, Open Documents as Tabs",
      arr === "Arrange:win.consolidate,win.floatone,win.floatall,win.tile,win.cascade,win.docnext,win.docprev,win.docmode", arr);
    await run("win.docmode");
    await ev(() => window.imageEditorInstance.E.openDoc(200, 200, "c.png", (g) => { g.fillStyle = "#00ff00"; g.fillRect(0, 0, 200, 200); }));
    s = await st();
    check("...Open Documents as Tabs: a new one docks as a tab", s.tabs.length === 3 && s.wins.length === 0 && s.name === "c.png" && s.docked, s);
    await run("win.docmode");

    /* 5 close: unsaved asks; Close without saving; Close All; the last one = the empty editor */
    await ev(() => window.imageEditorInstance.E.newLayer());
    await run("file.close"); await p.waitForTimeout(150);
    const asked = await ev(() => { const d = document.querySelector(".kxdlg.pcd"); return d ? d.querySelector("h4").textContent + "|" + !!d.querySelector("#pcdNoSave") : ""; });
    check("File ▸ Close (Ctrl+W) on unsaved changes asks: 💾 Save and close / Close without saving / Cancel", asked === "Close|true", asked);
    await p.click("#pcdNoSave"); await p.waitForTimeout(200);
    s = await st();
    check("...Close without saving: c.png is gone, the tab next to it in front", s.list.length === 2 && !s.tabs.some((t) => t.startsWith("c.png")) && s.w > 0, s);
    await ev(() => { const E = window.imageEditorInstance.E; E.docs.list().forEach(() => {}); });
    await ev(() => window.imageEditorInstance.E.docs.closeAll(true)); await p.waitForTimeout(200);
    s = await st();
    check("Close All: no document - the canvas empty, the hint back, the strip gone", s.list.length === 0 && s.w === 0 && s.tabs.length === 0 && await ev(() => getComputedStyle(document.getElementById("ieHint")).display !== "none"), s);
    // the save marks it clean
    await ev(() => window.imageEditorInstance.E.openDoc(120, 80, "d.png", (g) => { g.fillStyle = "#fff"; g.fillRect(0, 0, 120, 80); }));
    await ev(() => window.imageEditorInstance.E.newLayer());
    const dirty1 = await ev(() => window.imageEditorInstance.E.docs.list()[0].dirty);
    await ev(() => window.imageEditorInstance.E.saveToImages()); await p.waitForTimeout(600);
    const dirty2 = await ev(() => window.imageEditorInstance.E.docs.list()[0].dirty);
    check("💾 Save to Images marks it saved (● goes)", dirty1 === true && dirty2 === false, [dirty1, dirty2]);
    await run("file.close"); await p.waitForTimeout(150);
    check("...a saved document closes without asking", await ev(() => window.imageEditorInstance.E.docs.list().length === 0 && !document.querySelector(".kxdlg.pcd")));

    /* 6 the palette: on the right, ⊠ first; on a shape left = fill, right = outline; on pixels fg / bg; ⊠ */
    await ev(() => { const E = window.imageEditorInstance.E, P = window.PCDraw;
      E.openDoc(600, 400, "pal.png", (g) => { g.fillStyle = "#ffffff"; g.fillRect(0, 0, 600, 400); });
      const L = E.vline.newLine({ closed: false, op: "add", pts: [] }, "Box", { fill: "#888888", fillOn: true, strokeW: 2, strokeOn: true, stroke: "#000000" });
      L.shape.path = P.genPath({ type: "rect", frame: { cx: 150, cy: 150, w: 200, h: 100, rot: 0 }, corners: [0, 0, 0, 0] }); window.PCPath.syncShape(L.shape); E.D.rasterize(L);
      E.S.undo = []; E.refresh(); E.renderLayersPanel(); });
    const pal = await ev(() => { const s = document.getElementById("pcPalette"), side = document.getElementById("pcPanels"), c = s.querySelectorAll(".c");
      return { right: s.getBoundingClientRect().left >= side.getBoundingClientRect().right - 2, first: c[0].dataset.c, n: c.length }; });
    check("the colour palette: a strip on the right of the panels, ⊠ first, then the colours", pal.right && pal.first === "none" && pal.n > 40, pal);
    await p.click('#pcPalette .c[data-c="#ff0000"]');
    let sh = await ev(() => { const L = window.imageEditorInstance.E.layer(); return { fill: L.shape.fill, on: L.shape.fillOn, undo: window.imageEditorInstance.E.S.undo.length, last: window.imageEditorInstance.E.S.lastColor }; });
    const redChip = await ev(() => document.querySelectorAll("#pcPalette .c")[0] && [...document.querySelectorAll("#pcPalette .c")].find((c) => c.dataset.c === "#ff0000"));
    void redChip;
    check("a click on red with the curve active = its FILL (one undo step), red is the colour picked last", sh.fill === "#ff0000" && sh.on && sh.undo === 1 && sh.last === "#ff0000", sh);
    const blue = await ev(() => [...document.querySelectorAll("#pcPalette .c")].map((c) => c.dataset.c).find((c) => /^#0[0-9a-f]{3}ff$/i.test(c)) || "#0000ff");
    await p.click(`#pcPalette .c[data-c="${blue}"]`, { button: "right" });
    sh = await ev(() => { const L = window.imageEditorInstance.E.layer(); return { stroke: L.shape.stroke, on: L.shape.strokeOn, last: window.imageEditorInstance.E.S.lastColor }; });
    check("...a right-click = its OUTLINE (the colour picked last stays red)", sh.stroke === blue && sh.on && sh.last === "#ff0000", sh);
    await p.click('#pcPalette .c[data-c="none"]');
    sh = await ev(() => window.imageEditorInstance.E.layer().shape.fillOn);
    await p.click('#pcPalette .c[data-c="none"]', { button: "right" });
    const so = await ev(() => window.imageEditorInstance.E.layer().shape.strokeOn);
    check("...⊠ click = no fill, ⊠ right-click = no outline", sh === false && so === false, [sh, so]);

    /* 7 auto-fill: a curve closed with the Polyline tool is filled with the colour picked last */
    await p.click('#pcPalette .c[data-c="#ff0000"]');          // the curve: red fill back, red = last
    await ev(() => { const E = window.imageEditorInstance.E; E.setActive(0); E.setTool("polyline"); });
    const pt = (x, y) => ev(([x, y]) => { const r = document.getElementById("kxPaper").getBoundingClientRect(), z = window.imageEditorInstance.E.S.zoom; return [r.left + x * z, r.top + y * z]; }, [x, y]);
    for (const [x, y] of [[350, 100], [500, 100], [500, 300], [350, 300]]) { const [cx, cy] = await pt(x, y); await p.mouse.click(cx, cy); await p.waitForTimeout(60); }
    { const [cx, cy] = await pt(350, 100); await p.mouse.click(cx, cy); }
    await p.waitForTimeout(250);
    const af = await ev(() => { const L = window.imageEditorInstance.E.layer(); return L && L.shape ? { name: L.name, closed: L.shape.path.subs[0].closed, fill: L.shape.fill, on: L.shape.fillOn } : null; });
    const afPx = await ev(() => Array.from(window.imageEditorInstance.E.flatten().getContext("2d").getImageData(425, 200, 1, 1).data.slice(0, 3)).join());
    check("AUTO-FILL: a polyline closed on its first point is filled with the colour picked last (red) - inside it is red", !!af && af.closed && af.on && af.fill === "#ff0000" && afPx === "255,0,0", [af, afPx]);
    const bar = await ev(() => { const c = document.getElementById("vlFillOn"); return c ? c.checked && /Auto-fill|this curve/.test(c.parentElement.title) : null; });
    check("...the property bar's ▨ (auto-fill) is on by default", bar === true, bar);
    await ev(() => { const E = window.imageEditorInstance.E; E.palette.pick("none", false); });   // nothing active? a curve is active - pick on pixels instead
    await ev(() => { const E = window.imageEditorInstance.E; E.setActive(0); E.palette.pick("#00ff00", false); E.palette.pick("none", false); });
    const fgn = await ev(() => ({ none: window.imageEditorInstance.E.S.fgNone, last: window.imageEditorInstance.E.S.lastColor, sw: document.querySelector(".kxsw").classList.contains("fgnone") }));
    check("on a pixel layer: a colour = the foreground; ⊠ = a TRANSPARENT foreground (the swatch shows it), picked last = none", fgn.none === true && fgn.last === "none" && fgn.sw, fgn);
    // the brush paints transparency
    await ev(() => { const E = window.imageEditorInstance.E; E.setActive(0); E.setTool("paint"); E.setSize(30); });
    { const [a1, b1] = await pt(80, 350), [a2, b2] = await pt(200, 350); await p.mouse.move(a1, b1); await p.mouse.down(); await p.mouse.move(a2, b2, { steps: 8 }); await p.mouse.up(); }
    await p.waitForTimeout(200);
    const alpha = await ev(() => window.imageEditorInstance.E.S.layers[0].canvas.getContext("2d").getImageData(140, 350, 1, 1).data[3]);
    check("...the brush with ⊠ paints transparency (the Background's pixels there are clear)", alpha === 0, alpha);
    // a new closed curve with ⊠ last: not filled
    await ev(() => window.imageEditorInstance.E.setTool("polyline"));
    for (const [x, y] of [[50, 20], [120, 20], [120, 80]]) { const [cx, cy] = await pt(x, y); await p.mouse.click(cx, cy); await p.waitForTimeout(60); }
    { const [cx, cy] = await pt(50, 20); await p.mouse.click(cx, cy); }
    await p.waitForTimeout(200);
    const nf = await ev(() => { const L = window.imageEditorInstance.E.layer(); return L && L.shape ? [L.shape.path.subs[0].closed, L.shape.fillOn, L.shape.path.subs[0].pts.length] : null; });
    check("...with ⊠ picked last a closed curve is not filled", nf && nf[0] === true && nf[1] === false && nf[2] === 3, nf);
    const swn = await ev(() => { window.imageEditorInstance.E.ui.showTab("pcSwatches"); const b = document.querySelector("#pcSwatches .pcsw.none"); return !!b; });
    check("the Swatches panel has ⊠ too", swn);
    // Window ▸ Color Palette hides / shows it; the palette menu
    await run("win.palette"); const hid = await ev(() => getComputedStyle(document.getElementById("pcPalette")).display === "none");
    await run("win.palette"); const back = await ev(() => getComputedStyle(document.getElementById("pcPalette")).display !== "none");
    await run("pal.document"); const dc = await ev(() => [...document.querySelectorAll("#pcPalette .c")].map((c) => c.dataset.c));
    await run("pal.default");
    check("Window ▸ Color Palette hides / shows it; Palette: Document Colours = the colours the document's shapes use", hid && back && dc[0] === "none" && dc.includes("#ff0000"), dc);

    check("no page errors", errs.length === 0, errs);
  } catch (e) {
    fail++; console.log("FAIL: the browser run finished\n      got " + JSON.stringify(String(e && e.stack || e)).slice(0, 900));
  } finally { await b.close(); }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
