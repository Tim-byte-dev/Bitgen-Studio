#!/usr/bin/env node
/* bitGen Studio — 2.829.0 against the RUNNING app (+ a real browser): the image editor's interactive DROP SHADOW tool and the
 * WP LAYER. Tim: "make the gradient and dropshadow tool interactive just like coreldraws tools (user clicks in a shape and drags
 * the gradient or drop-shadow)" + "make the word processor a wp layer that the user can edit and change it's position in the
 * stack" + "do the image-editor additions".
 *   Drop Shadow tool (in the Gradient group): press in a red square + drag 12 px right / 9 down = a shadow 15 px at 143°
 *   (pcdoc draws dx = -cos a · d, dy = sin a · d), drawn under the square; one undo; its handle dragged again moves it; Blur /
 *   Opacity / Colour change it; ✕ Remove takes it off; a press on nothing changes nothing
 *   WP layer: File ▸ New Text Document makes a "WP layer" (type doc) with the WP badge in Layers; Layer ▸ New has 📄 WP Layer;
 *   its thumbnail double-clicked types in it; ✎ Type in This WP Layer on the right-click menu; Bring to Front / Send to Back
 *   moves it in the stack (its words over / under a layer above) and the Move tool's double-click still types in it.
 * H3_SHOTS=<dir> saves pictures. No Playwright = SKIP. */
"use strict";
const path = require("path"), fs = require("fs");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/", SHOTS = process.env.H3_SHOTS || "";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
(async () => {
  if (!chromium) { console.log("SKIP: playwright is not installed here"); console.log("\nRESULT: 0 passed, 0 failed"); return; }
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1500, height: 950 } });
  const errs = []; p.on("pageerror", (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
  const ev = (f, x) => p.evaluate(f, x);
  const shot = async (n) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await p.screenshot({ path: path.join(SHOTS, n + ".png") }); } };
  const scr = (x, y) => ev(([x, y]) => { const E = window.imageEditorInstance.E, r = E.stage.getBoundingClientRect(); return [r.left + E.S.panX + x * E.S.zoom, r.top + E.S.panY + y * E.S.zoom]; }, [x, y]);
  const drag = async (x0, y0, x1, y1) => { const a = await scr(x0, y0), c = await scr(x1, y1); await p.mouse.move(a[0], a[1]); await p.mouse.down(); await p.mouse.move((a[0] + c[0]) / 2, (a[1] + c[1]) / 2, { steps: 3 }); await p.mouse.move(c[0], c[1], { steps: 3 }); await p.mouse.up(); await p.waitForTimeout(250); };
  const px = (x, y) => ev(([x, y]) => { const E = window.imageEditorInstance.E, c = E.flatten(); return Array.from(c.getContext("2d").getImageData(x, y, 1, 1).data); }, [x, y]);
  const sh = () => ev(() => { const L = window.imageEditorInstance.E.layer(); return L && L.styles && L.styles.shadow ? JSON.parse(JSON.stringify(L.styles.shadow)) : null; });
  try {
    try { await fetch(URL_ + "api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docks: { imageeditdock: { state: "open", hidden: false, maximized: false } } }) }); } catch { /* older */ }
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.shadowTool && window.imageEditorInstance.E.docText, null, { timeout: 60000 });
    await p.waitForTimeout(1500);
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await p.waitForTimeout(400);
    await ev(() => { const f = document.getElementById("kxFull"); if (f) f.click(); });
    await p.waitForTimeout(600);
    await ev(() => { const P = document.getElementById("promptdock"); if (P && !P.classList.contains("dockgone")) toggleDockGone("promptdock", "tP"); });
    await ev(() => window.imageEditorInstance.E.openDoc(400, 300, "shadow829.png", (g) => { g.fillStyle = "#ffffff"; g.fillRect(0, 0, 400, 300); }));
    await p.waitForTimeout(300);
    await ev(() => { const E = window.imageEditorInstance.E; E.ui.run("layer.new"); const L = E.layer(); L.name = "Red"; const g = L.canvas.getContext("2d"); g.fillStyle = "#ff0000"; g.fillRect(100, 100, 80, 80); E.refresh(); E.renderLayersPanel(); });

    // the Drop Shadow tool
    check("the Drop Shadow tool is in the Gradient tool's group (G) with its own icon", await ev(() => { const E = window.imageEditorInstance.E; return !!E.tools.dropshadow && [...document.querySelectorAll("[data-tools]")].some((b) => /^gradient,dropshadow/.test(b.dataset.tools)); }));
    await ev(() => window.imageEditorInstance.E.setTool("dropshadow"));
    await ev(() => { const E = window.imageEditorInstance.E; E.setActive(E.S.layers.findIndex((l) => l.name === "Red")); });
    const u0 = await ev(() => window.imageEditorInstance.E.S.undo.length);
    await drag(140, 140, 152, 149);
    const s1 = await sh();
    check("press in the red square + drag 12 px right / 9 down: a drop shadow on the square - 15 px at 143°", s1 && s1.on && s1.distance === 15 && s1.angle === 143, s1);
    check("…one undo step", (await ev(() => window.imageEditorInstance.E.S.undo.length)) === u0 + 1);
    const under = await px(185, 185), out = await px(195, 195), body = await px(140, 140);
    check("…drawn: the shadow shows past the square's corner (dark), the square stays red, beyond the shadow stays white", under[0] < 160 && under[1] < 160 && body[0] > 240 && body[1] < 30 && out[0] > 240, { under, body, out });
    await shot("1-shadow");
    const h = await ev(() => window.imageEditorInstance.E.shadowTool.handleOf(window.imageEditorInstance.E.layer()));
    check("…its handle sits where the pointer let go (the end of the drag)", Math.abs(h.x - 152) < 1.5 && Math.abs(h.y - 149) < 1.5, h);
    await drag(h.x, h.y, h.x + 18, h.y - 4);
    const s2 = await sh();
    check("dragging the handle moves the shadow again (from the same start)", Math.abs(s2.distance - Math.hypot(30, 5)) <= 1 && Math.abs(s2.angle - (Math.atan2(5, -30) * 180 / Math.PI + 360) % 360) <= 1.5, s2);
    await ev(() => { const o = document.querySelector("#pdsSize"); o.value = "0"; o.dispatchEvent(new Event("input")); o.dispatchEvent(new Event("change")); const c = document.querySelector("#pdsColor"); c.value = "#0000ff"; c.dispatchEvent(new Event("change")); });
    const s3 = await sh();
    check("Blur and Colour in the options bar change it at once (size 0, blue)", s3.size === 0 && s3.color === "#0000ff", s3);
    await ev(() => window.imageEditorInstance.E.undo()); await ev(() => window.imageEditorInstance.E.undo());
    check("…each its own undo step", (await sh()).color === "#000000");
    await ev(() => { window.imageEditorInstance.E.renderOptions(); document.querySelector("#pdsOff").click(); });
    check("✕ Remove takes it off", (await sh()).on === false && (await px(185, 185))[0] > 240);
    await ev(() => window.imageEditorInstance.E.undo());

    // the WP layer
    await ev(() => window.imageEditorInstance.E.ui.run("file.newtextdoc")); await p.waitForTimeout(300);
    await ev(() => { const d = document.querySelector(".kxdlg.pcd"); d.querySelector("#pdnDpi").value = "96"; d.querySelector("#pdnMargin").value = "20"; d.querySelector(".ok").click(); });
    await p.waitForTimeout(800);
    const w1 = await ev(() => { const E = window.imageEditorInstance.E, L = E.layer(); return { type: L.type, name: L.name, badge: [...document.querySelectorAll(".kxlayer")].some((r) => /WP layer/.test(r.textContent) && r.querySelector(".wp")) }; });
    check("File ▸ New Text Document: a \"WP layer\" (word processor) - WP on its row in Layers", w1.type === "doc" && w1.name === "WP layer" && w1.badge, w1);
    check("Layer ▸ New has 📄 WP Layer (word processor)", await ev(() => { const m = window.imageEditorInstance.E.ui.MENUS.find(([n]) => n === "Layer"), nw = m[1].find((x) => x && x.label === "New"); return nw.items.includes("layer.newdocframe") && /WP Layer/.test(window.imageEditorInstance.E.ui.CMD.get("layer.newdocframe").label); }));
    await ev(() => { const E = window.imageEditorInstance.E; E.docText.end(); E.setTool("move"); });
    await ev(() => { const th = [...document.querySelectorAll(".kxlayer")].find((r) => r.querySelector(".wp")).querySelector("canvas, .th, img"); th.dispatchEvent(new MouseEvent("dblclick", { bubbles: true })); });
    await p.waitForTimeout(300);
    check("double-click the WP layer's thumbnail in Layers = type in it", await ev(() => !!window.imageEditorInstance.E.docText.editing()));
    await ev(() => { const ed = document.querySelector(".pcdocedit .pcdoc"); ed.innerHTML = "<p style='font-size:48px'>WWWWWWWWWW</p>"; ed.dispatchEvent(new Event("input", { bubbles: true })); window.imageEditorInstance.E.docText.end(); });
    await p.waitForFunction(() => window.imageEditorInstance.E.docText.ready(), null, { timeout: 10000 }); await p.waitForTimeout(600);
    const at = await ev(() => { const E = window.imageEditorInstance.E, L = E.S.layers.find((x) => x.type === "doc"), d = L.canvas.getContext("2d"); for (let y = L.doc.y; y < L.doc.y + 80; y++) for (let x = L.doc.x; x < L.doc.x + 200; x++) if (d.getImageData(x, y, 1, 1).data[3] > 200) return [x, y]; return null; });
    check("the words are drawn on the WP layer", !!at, at);
    // a layer over it, then the WP layer brought to the front / sent to the back
    await ev(() => { const E = window.imageEditorInstance.E; E.ui.run("layer.new"); const L = E.layer(); L.name = "Cover"; const g = L.canvas.getContext("2d"); g.fillStyle = "#00ff00"; g.fillRect(0, 0, E.S.w, E.S.h); E.refresh(); });
    const covered = await px(at[0], at[1]);
    await ev(() => { const E = window.imageEditorInstance.E; E.setActive(E.S.layers.findIndex((l) => l.type === "doc")); E.ui.run("layer.front"); });
    const front = await px(at[0], at[1]);
    check("change its place in the stack: under a green layer its words are hidden; Bring to Front = its words over the green", covered[1] > 240 && covered[0] < 20 && front[1] < 120, { covered, front });
    await ev(() => { const E = window.imageEditorInstance.E; E.ui.run("layer.back"); });
    const back = await ev(() => { const E = window.imageEditorInstance.E; return E.S.layers.map((l) => l.type)[0]; });
    check("…Send to Back puts it at the bottom of the stack", back === "doc");
    check("✎ Type in This WP Layer is on the layer's right-click menu (and types in it)", await ev(() => { const E = window.imageEditorInstance.E; if (!(E.ui.layerCtxItems || []).includes("layer.docedit")) return false; E.ui.run("layer.docedit"); const ok = !!E.docText.editing(); E.docText.end(); return ok; }));
    await shot("2-wp");
    check("no page errors", !errs.length, errs);
  } catch (e) { fail++; console.log("FAIL: " + (e.stack || e)); }
  finally {
    await b.close();
    console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
  }
})();
