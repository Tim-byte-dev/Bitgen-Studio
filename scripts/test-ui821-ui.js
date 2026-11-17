#!/usr/bin/env node
/* bitGen Studio — 2.821.0 against the RUNNING app (+ a real browser): the image editor - Insert Into Frame (a thick black
 * arrow, a click on the shape = the layer inside it, its fill behind), the right-click menu's Bring Forward / Send Backward
 * / to Front / to Back (inside a frame they stay inside), the Gradient tool on a shape (a vector gradient fill) and a text
 * (Gradient Overlay), a REAL cut / join with the Shape tool's modes.
 * Tim (verbatim): "in image-editor when user selects insert in frame change the cursor to a thick black arrow then when user
 * clicks a shape insert the layer into that frame like envelope ... when user clicks an object on a layer add bring
 * foward, send backward, to front and to back to the context menu. layers inside a frame will be moved inside the frame
 * group. fix the gradient fill, it is only filling selection and background, it should also fill shapes and text. if a
 * shape is cut merge the shapes together and do a real cut(subtract)" No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };

(async () => {
  if (!chromium) { console.log("SKIP: playwright is not installed here"); console.log("\nRESULT: 0 passed, 0 failed"); return; }
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1900, height: 1100 } });
  const errs = []; p.on("pageerror", (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
  const ev = (f, x) => p.evaluate(f, x);
  try {
    try { await fetch(URL_ + "api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docks: { imageeditdock: { state: "open", hidden: false, maximized: false } } }) }); } catch { /* older */ }
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.shapeMode, null, { timeout: 60000 });
    await p.waitForTimeout(1500);
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await p.waitForTimeout(400);
    await ev(() => { const f = document.getElementById("kxFull"); if (f) f.click(); });
    await p.waitForTimeout(600);
    await ev(() => { const P = document.getElementById("promptdock"); if (P && !P.classList.contains("dockgone")) toggleDockGone("promptdock", "tP"); });
    await ev(() => window.imageEditorInstance.E.openDoc(400, 300, "frame821.png", (g) => { g.fillStyle = "#ffffff"; g.fillRect(0, 0, 400, 300); }));
    await p.waitForTimeout(500);
    const E = "window.imageEditorInstance.E";
    await ev(() => { const E = window.imageEditorInstance.E; E.store.set("draw.automove", false); E.setTool("shape"); E.S.shapeOp = "new"; E.S.shapeKind = "rect"; E.renderOptions(); });
    await p.waitForTimeout(200);
    // the floating dockers (StoryBoard …) can sit over the picture - out of the way for this test
    await ev(() => document.querySelectorAll(".h3fp.dfm-float").forEach((d) => { d.dataset.t819 = d.style.display; d.style.display = "none"; }));
    const scr = (x, y) => ev(([x, y]) => { const E = window.imageEditorInstance.E, r = E.stage.getBoundingClientRect(); return [r.left + E.S.panX + x * E.S.zoom, r.top + E.S.panY + y * E.S.zoom]; }, [x, y]);
    const drag = async (x0, y0, x1, y1) => { const a = await scr(x0, y0), c = await scr(x1, y1); await p.mouse.move(a[0], a[1]); await p.mouse.down(); await p.mouse.move((a[0] + c[0]) / 2, (a[1] + c[1]) / 2, { steps: 3 }); await p.mouse.move(c[0], c[1], { steps: 3 }); await p.mouse.up(); await p.waitForTimeout(250); };
    const L = (name) => ev((n) => { const E = window.imageEditorInstance.E, X = E.S.layers.find((x) => x.name === n); if (!X) return null; const b = E.dockers.boxOf(X); return { id: X.id, parent: X.parent, idx: E.S.layers.indexOf(X), frame: !!X.frame, box: b && [Math.round(b.x), Math.round(b.y), Math.round(b.w), Math.round(b.h)], grad: X.shape && X.shape.fillGrad ? X.shape.fillGrad : null, ov: X.styles && X.styles.gradientOverlay ? X.styles.gradientOverlay : null, subs: X.shape && X.shape.path ? X.shape.path.subs.map((s) => s.op || "add") : null }; }, name);
    const px = (name, x, y) => ev(([n, x, y]) => { const E = window.imageEditorInstance.E, X = E.S.layers.find((q) => q.name === n); return Array.from(X.canvas.getContext("2d").getImageData(x, y, 1, 1).data); }, [name, x, y]);
    // a red picture layer (40..90 x 40..90) and a blue rectangle (30..200 x 30..150) - the frame
    await ev(() => { const E = window.imageEditorInstance.E, S = E.S; E.structOp("t", () => { const R = E.makeLayer("Red", S.w, S.h, "pixel"); const g = R.canvas.getContext("2d"); g.fillStyle = "#ff0000"; g.fillRect(40, 40, 50, 50); S.layers.push(R); S.active = S.layers.length - 1; }); E.store.set("draw.automove", false); E.setTool("shape"); E.S.shapeOp = "new"; E.S.shapeKind = "rect"; E.setFg("#0000ff"); E.renderOptions(); });
    await drag(30, 30, 200, 150);
    await ev(() => { const E = window.imageEditorInstance.E, S = E.S, R = S.layers.find((x) => x.type === "shape"); R.name = "Frame"; const i = S.layers.findIndex((x) => x.name === "Red"); S.layers.splice(S.layers.indexOf(R), 1); S.layers.splice(i, 0, R); E.setActive(S.layers.findIndex((x) => x.name === "Red")); E.refresh(); E.renderLayersPanel(); E.setTool("move"); });

    /* 1 Insert Into Frame: the arrow, the frame lit, a click = inside */
    await ev(() => window.imageEditorInstance.E.ui.run("frame.insert")); await p.waitForTimeout(200);
    const cur = await ev(() => window.imageEditorInstance.E.stage.style.cursor);
    check("Insert Into Frame: the pointer is a thick black arrow (a picture cursor)", /data:image\/svg\+xml/.test(cur) && /M2%2011h22/.test(cur), cur.slice(0, 120));
    { const a = await scr(150, 120); await p.mouse.move(a[0], a[1], { steps: 3 }); await p.waitForTimeout(200); }
    check("…the shape under it is lit (its outline drawn)", await ev(() => { const E = window.imageEditorInstance.E, d = E.ov.getContext("2d").getImageData(29, 90, 3, 3).data; for (let i = 3; i < d.length; i += 4) if (d[i] > 40) return true; return false; }));
    { const a = await scr(150, 120); await p.mouse.click(a[0], a[1]); await p.waitForTimeout(400); }
    let red = await L("Red"), fr = await L("Frame");
    check("a click on the shape: the layer is inside it (a frame now), where it was", red.parent === fr.id && fr.frame && JSON.stringify(red.box) === "[40,40,50,50]", { red, fr });
    check("…the pointer is back to normal", !/data:image/.test(await ev(() => window.imageEditorInstance.E.stage.style.cursor)));
    const comp = await ev(() => { const E = window.imageEditorInstance.E, c = E.cv.getContext("2d"); const at = (x, y) => Array.from(c.getImageData(x, y, 1, 1).data).slice(0, 3).join(); return null; });
    // the frame's fill behind, the picture over it: the flattened picture
    const flat = await ev(() => { const E = window.imageEditorInstance.E, c = E.flatten ? E.flatten() : null; if (!c) return null; const g = c.getContext("2d"); const at = (x, y) => Array.from(g.getImageData(x, y, 1, 1).data).slice(0, 3).join(); return { red: at(60, 60), fill: at(150, 120) }; });
    check("the frame's fill is the background, the layer inside on top of it", !flat || (flat.red === "255,0,0" && flat.fill === "0,0,255"), flat);
    /* 2 the frame moved = its contents with it */
    await ev(() => { const E = window.imageEditorInstance.E; E.setActive(E.S.layers.findIndex((x) => x.name === "Frame")); E.setTool("move"); E.S.objSel = true; });
    await drag(180, 140, 210, 160);
    red = await L("Red"); fr = await L("Frame");
    check("the frame dragged 30 / 20: the layer inside moved with it", JSON.stringify(red.box) === "[70,60,50,50]" && fr.box[0] === 60, { red, fr });
    await ev(() => window.imageEditorInstance.E.undo()); await p.waitForTimeout(200);

    /* 3 the right-click menu: the order items; inside a frame they stay inside */
    await ev(() => { const E = window.imageEditorInstance.E, S = E.S; E.structOp("t", () => { const G = E.makeLayer("Green", S.w, S.h, "pixel"); const g = G.canvas.getContext("2d"); g.fillStyle = "#00ff00"; g.fillRect(100, 60, 40, 40); S.layers.push(G); S.active = S.layers.length - 1; }); E.setTool("move"); });
    await ev(() => window.imageEditorInstance.E.ui.run("frame.insert")); { const a = await scr(150, 130); await p.mouse.click(a[0], a[1]); await p.waitForTimeout(400); }
    check("a second layer inserted: both inside, the newer above", (await L("Green")).parent === fr.id && (await L("Green")).idx > (await L("Red")).idx);
    await ev(() => { const E = window.imageEditorInstance.E; E.ui.run("frame.edit"); });
    { const a = await scr(60, 60); await p.mouse.click(a[0], a[1], { button: "right" }); await p.waitForTimeout(300); }
    const items = await ev(() => { const m = [...document.querySelectorAll(".kxmenu")].pop(); return m ? [...m.querySelectorAll("[data-cmd]")].map((d) => d.dataset.cmd) : []; });
    check("right-click on an object: Bring to Front, Bring Forward, Send Backward, Send to Back", ["layer.front", "layer.forward", "layer.backward", "layer.back"].every((c) => items.includes(c)), items);
    await ev(() => { const m = [...document.querySelectorAll(".kxmenu")].pop(); m.querySelector('[data-cmd="layer.front"]').click(); });
    await p.waitForTimeout(300);
    red = await L("Red");
    check("Bring to Front on the layer in the frame: on top of the frame's layers, still IN the frame", red.parent === fr.id && red.idx > (await L("Green")).idx, red);
    await ev(() => { const E = window.imageEditorInstance.E; E.setActive(E.S.layers.findIndex((x) => x.name === "Red")); E.moveLayer(1); E.moveLayer(1); });
    check("Bring Forward again at the top of the frame: it stays in the frame", (await L("Red")).parent === fr.id);
    await ev(() => window.imageEditorInstance.E.ui.run("frame.finish"));

    /* 4 the Gradient tool on a shape = its gradient fill (a vector); on a text = Gradient Overlay */
    await ev(() => { const E = window.imageEditorInstance.E; E.setActive(E.S.layers.findIndex((x) => x.name === "Frame")); E.setFg("#000000"); E.setBg("#ffffff"); E.S.gradKind = "fgbg"; E.S.gradType = "linear"; E.setTool("gradient"); E.renderOptions(); });
    await drag(30, 100, 200, 100);
    fr = await L("Frame");
    const g0 = await px("Frame", 33, 140), g1 = await px("Frame", 197, 140);
    check("Gradient tool on a shape: its fill is a gradient from the drag (it stays a shape) - dark at the start, light at the end", fr.grad && fr.grad.x0 === 30 && fr.grad.x1 === 200 && g0[0] < 40 && g1[0] > 215 && g0[3] > 200, { grad: fr.grad, g0, g1 });
    await ev(() => { const E = window.imageEditorInstance.E, S = E.S; S.typeSize = 40; E.setTool("type"); });
    { const a = await scr(220, 200); await p.mouse.click(a[0], a[1]); }
    await p.waitForSelector(".kx textarea.pctext"); await p.keyboard.type("HELLO"); await p.keyboard.press("Control+Enter"); await p.waitForTimeout(300);
    const tname = await ev(() => { const E = window.imageEditorInstance.E, T = E.S.layers.filter((x) => x.type === "text").pop(); T.name = "Txt"; E.setActive(E.S.layers.indexOf(T)); E.setTool("gradient"); return T.name; });
    await drag(220, 200, 320, 200);
    const tx = await L(tname);
    check("Gradient tool on a text: a Gradient Overlay from the drag (the words stay a text)", tx.ov && tx.ov.on && Math.abs(tx.ov.angle) <= 2 && tx.ov.stops && tx.ov.stops.length === 2, tx.ov);

    /* 5 a REAL cut / join with the Shape tool's modes */
    await ev(() => { const E = window.imageEditorInstance.E; E.setTool("shape"); E.S.shapeKind = "rect"; E.shapeModes.go("new", true); E.renderOptions(); });
    await drag(260, 40, 360, 120);
    await ev(() => { const E = window.imageEditorInstance.E, X = E.layer(); X.name = "Cut"; E.shapeModes.go("subtract", true); });
    await drag(300, 70, 330, 100);
    let cut = await L("Cut");
    const hole = await px("Cut", 315, 85), solid = await px("Cut", 270, 50);
    check("⊖ Subtract inside: a REAL hole - the shape's outline and the hole's, no subtract part left; the hole empty", cut.subs && cut.subs.length === 2 && cut.subs.every((o) => o === "add") && hole[3] === 0 && solid[3] > 200, { cut, hole, solid });
    await ev(() => window.imageEditorInstance.E.shapeModes.go("add", true));
    await drag(340, 100, 400, 150);
    cut = await L("Cut");
    check("⊕ Add overlapping: merged into one outline (plus the hole) - still no separate parts", cut.subs.length === 2 && cut.subs.every((o) => o === "add") && cut.box[2] === 140, cut);
    await ev(() => window.imageEditorInstance.E.shapeModes.go("new", true));
    await ev(() => document.querySelectorAll(".h3fp.dfm-float").forEach((d) => { if (d.dataset.t819 != null) { d.style.display = d.dataset.t819; delete d.dataset.t819; } }));
    check("no page errors", !errs.length, errs);
  } catch (e) { fail++; console.log("FAIL: " + (e.stack || e)); }
  finally { await b.close(); }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
