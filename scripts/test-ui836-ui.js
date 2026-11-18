#!/usr/bin/env node
/* bitGen Studio — 2.836.0 in a REAL browser: the image editor. Tim: "when image editor is open and a selection is made on an
 * empty layer and generate is set in prompt docker , generate an image in the selection, if no selection, generate to the full
 * size, if selection is not a square or rectangle remove anything generated outside the selection. use any image model and basic
 * settings if overide is checked. if user clicks a wp layer the go back to word processing mode. change the curser to match the
 * handle the cursor is over but highlight the cursor when performing the transform. change Artist Mode to Full Screen".
 *   An empty layer + an ellipse selection -> the prompt docker's own Generate at the selection's shape, the picture put into the
 *   layer only inside the ellipse (one undo); no selection -> into the empty layer over the whole canvas; a picture layer + a
 *   shaped selection -> the editor's fill with a hard edge (a rectangle: soft as before); a click on a WP layer's row / its
 *   frame = word processing again; the handles' pointers (plain over a handle, the accent arrow while dragging); 🎨 Full Screen.
 *   Against the running app (H3_URL). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here"); console.log("\nRESULT: 0 passed, 0 failed"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1700, height: 1050 } });
  await p.addInitScript(() => { window.__H3_PENDING_AUTO = true; });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  try {
    try { await fetch(URL_ + "api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docks: { imageeditdock: { state: "open", hidden: false, maximized: false } } }) }); } catch { /* older */ }
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.aiFill && window.H3ImgOp, null, { timeout: 60000 });
    await p.waitForTimeout(1500);
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await ev(() => { document.querySelectorAll(".h3fp.dfm-float, #promptdock").forEach((d) => { if (d.style.display !== "none") d.style.display = "none"; }); const d = document.getElementById("imageeditdock"); d.style.cssText += ";position:fixed;left:10px;top:60px;width:1600px;height:900px;z-index:9999"; });
    await p.waitForTimeout(400);
    await ev(() => new Promise((ok) => { const c = document.createElement("canvas"); c.width = 800; c.height = 600; const g = c.getContext("2d"); g.fillStyle = "#3060c0"; g.fillRect(0, 0, 800, 600); window.imageEditorInstance.load(c.toDataURL("image/png"), "f836"); setTimeout(() => { window.imageEditorInstance.E.fitView(); ok(); }, 800); }));
    await ev(() => { const g = document.getElementById("genModeSel"); if (g.value !== "image") { g.value = "image"; if (g.onchange) g.onchange(); } window.H3ImgOp.set("generate"); });
    const E_ = "window.imageEditorInstance.E";
    // an empty layer + an ellipse selection
    await ev(() => { const E = window.imageEditorInstance.E; E.newLayer(); const m = new Uint8Array(E.S.w * E.S.h); for (let y = 0; y < E.S.h; y++) for (let x = 0; x < E.S.w; x++) { if (((x - 400) / 200) ** 2 + ((y - 300) / 150) ** 2 <= 1) m[y * E.S.w + x] = 255; } E.setSel(m, true); });
    const s1 = await ev(() => { const E = window.imageEditorInstance.E; window.__runs = []; const r0 = E.runAI; E.runAI = (o) => { window.__runs.push(o || {}); }; window.__r0 = r0;
      const took = window.H3TakeGenerate("image", "a flower"); const wh = window.H3ImageSize({}); return { took, empty: E.aiFill.layerEmpty(), wh, place: !!E.aiFill.placing(), runs: window.__runs.length, n: E.S.layers.length }; });
    check("an EMPTY layer + a selection + ✨ Generate: not the editor's fill - the prompt docker's own Generate (any image style, Basic Settings), asked at the selection's shape (400 x 300 -> 4:3)",
      s1.took === false && s1.empty && s1.runs === 0 && s1.wh && Math.abs(s1.wh.width / s1.wh.height - 4 / 3) < 0.03 && s1.place, s1);
    const png = await ev(([w, h]) => { const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d"); g.fillStyle = "#20c040"; g.fillRect(0, 0, w, h); return c.toDataURL("image/png").split(",")[1]; }, [s1.wh.width, s1.wh.height]);
    await p.route("**/outputs/t836.png*", (r) => r.fulfill({ status: 200, contentType: "image/png", body: Buffer.from(png, "base64") }));
    const n1 = await ev(() => window.H3OnGenerated({ outputs: ["t836.png"], text: "a flower" }));
    const px = (x, y) => ev(([x, y]) => Array.from(window.imageEditorInstance.E.layer().canvas.getContext("2d").getImageData(x, y, 1, 1).data), [x, y]);
    const a1 = { n: n1, mid: await px(400, 300), edge: await px(590, 300), corner: await px(215, 160), out: await px(100, 100), layers: await ev(() => window.imageEditorInstance.E.S.layers.length) };
    check("…the picture goes INTO that layer (no new layer), only inside the ellipse - the selection's box corners and outside stay empty",
      a1.n === 1 && a1.layers === s1.n && a1.mid[1] > 150 && a1.mid[3] === 255 && a1.edge[3] > 0 && a1.corner[3] === 0 && a1.out[3] === 0, a1);
    await ev(() => window.imageEditorInstance.E.undo());
    check("…one undo takes it out again", (await px(400, 300))[3] === 0);
    // no selection: into the empty layer, the whole canvas
    await ev(() => window.imageEditorInstance.E.deselect());
    const wh2 = await ev(() => window.H3ImageSize({}));
    const png2 = await ev(([w, h]) => { const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d"); g.fillStyle = "#c04020"; g.fillRect(0, 0, w, h); return c.toDataURL("image/png").split(",")[1]; }, [wh2.width, wh2.height]);
    await p.route("**/outputs/t836b.png*", (r) => r.fulfill({ status: 200, contentType: "image/png", body: Buffer.from(png2, "base64") }));
    const n2 = await ev(() => window.H3OnGenerated({ outputs: ["t836b.png"], text: "a castle" }));
    const a2 = { n: n2, tl: await px(1, 1), br: await px(798, 598), layers: await ev(() => window.imageEditorInstance.E.S.layers.length) };
    check("no selection + an empty layer: the canvas's shape, the picture over the WHOLE canvas in that layer", a2.n === 1 && a2.layers === s1.n && a2.tl[0] > 150 && a2.tl[3] === 255 && a2.br[3] === 255, a2);
    // a picture layer + a shaped / a rectangular selection: the editor's fill, hard edge only for the shape
    const s3 = await ev(() => { const E = window.imageEditorInstance.E, m = new Uint8Array(E.S.w * E.S.h);
      for (let y = 0; y < E.S.h; y++) for (let x = 0; x < E.S.w; x++) if (((x - 400) / 100) ** 2 + ((y - 300) / 80) ** 2 <= 1) m[y * E.S.w + x] = 255;
      E.setSel(m, true); window.__runs = []; const t1 = window.H3TakeGenerate("image", "a cat");
      const r = new Uint8Array(E.S.w * E.S.h); for (let y = 100; y < 200; y++) for (let x = 100; x < 300; x++) r[y * E.S.w + x] = 255; E.setSel(r, true);
      const t2 = window.H3TakeGenerate("image", "a dog"); E.runAI = window.__r0; return { t1, t2, runs: window.__runs.map((o) => ({ hard: !!o.hardEdge, whole: o.whole })) }; });
    check("a picture layer + a shaped selection: the editor fills it with a HARD edge (nothing outside the shape); a rectangle: soft as before",
      s3.t1 === true && s3.t2 === true && s3.runs.length === 2 && s3.runs[0].hard === true && s3.runs[1].hard === false && s3.runs[0].whole === false, s3);
    // a WP layer clicked = word processing again
    await ev(() => { const E = window.imageEditorInstance.E; E.deselect(); E.docText.addFrame(100, 100, 300, 200, {}, false); E.docText.end(); E.setTool("move"); });
    const w0 = await ev(() => ({ editing: !!window.imageEditorInstance.E.docText.editing(), tool: window.imageEditorInstance.E.S.tool }));
    await ev(() => { const E = window.imageEditorInstance.E, i = E.S.layers.findIndex((L) => L.type === "doc"); const row = document.querySelector(`.kxlayer[data-i="${i}"]`); row.click(); });
    await p.waitForTimeout(200);
    const w1 = await ev(() => ({ editing: !!window.imageEditorInstance.E.docText.editing(), tool: window.imageEditorInstance.E.S.tool }));
    check("a click on a WP layer's row in Layers = word processing again (the Document Text tool, typing in it)", !w0.editing && w1.editing && w1.tool === "doctext", { w0, w1 });
    await ev(() => { const E = window.imageEditorInstance.E; E.docText.end(); E.setTool("move"); });
    const sp = (x, y) => ev(([x, y]) => { const E = window.imageEditorInstance.E, r = E.stage.getBoundingClientRect(); return [r.left + E.S.panX + x * E.S.zoom, r.top + E.S.panY + y * E.S.zoom]; }, [x, y]);
    const f = await sp(250, 200); await p.mouse.move(f[0], f[1]); await p.mouse.down(); await p.mouse.up(); await p.waitForTimeout(200);
    check("…a click (no drag) on its frame with the Move tool does the same", await ev(() => !!window.imageEditorInstance.E.docText.editing()));
    await ev(() => { const E = window.imageEditorInstance.E; E.docText.end(); });
    // the handles' pointers
    await ev(() => { const E = window.imageEditorInstance.E; const L = E.makeLayer("box"); const g = L.canvas.getContext("2d"); g.fillStyle = "#ffcc00"; g.fillRect(500, 350, 200, 150); E.addLayer(L, "box", false); E.setTool("move"); E.refresh(); E.renderLayersPanel(); });
    await p.waitForTimeout(200);
    const bx = await ev(() => window.imageEditorInstance.E.handles.box());
    const se = await sp(bx.x + bx.w, bx.y + bx.h), ne = await sp(bx.x + bx.w, bx.y), mid = await sp(bx.x + bx.w / 2, bx.y + bx.h / 2);
    await p.mouse.click(mid[0], mid[1]); await p.waitForTimeout(150); await ev(() => window.imageEditorInstance.E.handles.setMode("scale"));   // picked (the handles show), the scale handles
    await p.mouse.move(se[0] - 30, se[1] - 30); await p.mouse.move(se[0], se[1], { steps: 3 }); await p.waitForTimeout(100);
    const c1 = await ev(() => { const st = window.imageEditorInstance.E.stage; return { on: st.classList.contains("pchcur"), hot: st.classList.contains("pchhot"), cur: st.style.getPropertyValue("--pch-cur") }; });
    await p.mouse.down(); await p.mouse.move(se[0] + 20, se[1] + 20, { steps: 3 });
    const c2 = await ev(() => { const st = window.imageEditorInstance.E.stage; return { hot: st.classList.contains("pchhot"), cur: st.style.getPropertyValue("--pch-cur").slice(0, 40) }; });
    await p.mouse.up(); await p.waitForTimeout(100);
    const c3 = await ev(() => { const st = window.imageEditorInstance.E.stage; return { hot: st.classList.contains("pchhot") }; });
    await p.mouse.move(ne[0], ne[1] - 200, { steps: 3 });
    const c4 = await ev(() => window.imageEditorInstance.E.stage.classList.contains("pchcur"));
    check("the pointer over a corner handle = that corner's two-way arrow (nwse); while dragging = the arrow drawn in the accent (highlighted); after = plain again; away = the tool's own",
      c1.on && !c1.hot && c1.cur === "nwse-resize" && c2.hot && /^url\("data:image\/svg\+xml/.test(c2.cur) && !c3.hot && !c4, { c1, c2, c3, c4 });
    await ev(() => window.imageEditorInstance.E.handles.setMode("rotate"));
    const bx2 = await ev(() => window.imageEditorInstance.E.handles.box()), ne2 = await sp(bx2.x + bx2.w, bx2.y);   // the box after the drag
    await p.mouse.move(ne2[0], ne2[1], { steps: 3 }); await p.waitForTimeout(100);
    const c5 = await ev(() => window.imageEditorInstance.E.stage.style.getPropertyValue("--pch-cur"));
    check("…in rotate mode a corner shows the turning arrow", /svg/.test(c5) && /grab/.test(c5), c5.slice(-30));
    // Full Screen
    const fs = await ev(() => { const b2 = document.getElementById("kxFocus"); return b2 ? b2.textContent : ""; });
    check("Artist Mode is called 🎨 Full Screen (the button; its features unchanged)", /Full Screen/.test(fs) && !/Artist/.test(fs), fs);
    check("no page errors", !errs.length, errs);
  } catch (e) { fail++; console.log("FAIL: " + (e.stack || e)); }
  finally {
    await b.close();
    console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
  }
})();
