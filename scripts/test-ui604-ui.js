#!/usr/bin/env node
/* bitGen Studio — 2.604.0 in a REAL browser: the IMAGE EDITOR - no thick box round a picked object, right-click ▸
 * Rasterize Text, the SKEW handles (the opposite side stays; type skews and stays type), 💾 Save to Images (a temp copy,
 * flattened, the format picked, into Images AND the Gallery); the TIMELINE canvas - a thin frame, right-click ▸ 🅰
 * Rasterize Text (undoable).
 * Tim: "remove the thick bounding box when text or element is selected in timeline and image-editor add a rightclick
 * context menu with rasterize text. fix the skew tool" + "when user clicks save to images in image-editor, save all the
 * visible the file as a tmp file then flatten the file and save as the image format selected, load it in gallery and
 * assets". Against the running app (H3_URL, default the e2e server on :8311). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.604.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1700, height: 1050 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  try {
    try { await fetch(URL_ + "api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docks: { imageeditdock: { state: "open", hidden: false, maximized: false } } }) }); } catch { /* older */ }
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.handles && window.TlCtx, null, { timeout: 60000 });
    await p.waitForTimeout(1000);
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await p.click("#kxFull"); await p.waitForTimeout(900);
    await ev(() => { const E = window.imageEditorInstance.E; E.setBg("#ffffff"); E.setFg("#000000"); });
    await p.click('#pcMenus .mi[data-menu="File"]'); await p.waitForTimeout(120); await p.click('.kxmenu [data-cmd="file.new"]'); await p.waitForTimeout(200);
    await p.fill(".kxdlg.pcd #pdW", "400"); await p.fill(".kxdlg.pcd #pdH", "300"); await p.click(".kxdlg.pcd .ok"); await p.waitForTimeout(400);
    const T = async (x, y) => { const v = await ev(() => { const s = window.imageEditorInstance.state; return { z: s.zoom, x: s.panX, y: s.panY }; }); const r = await p.locator("#ieStage").boundingBox(); return [r.x + v.x + x * v.z, r.y + v.y + y * v.z]; };
    const rows = (ys) => ev((ys) => { const s = window.imageEditorInstance.state, A = s.layers[s.active], W = A.canvas.width, d = A.canvas.getContext("2d").getImageData(0, 0, W, A.canvas.height).data; return ys.map((y) => { let x0 = -1, x1 = -1; for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3] > 128) { if (x0 < 0) x0 = x; x1 = x; } return [x0, x1]; }); }, ys);

    /* 1 the skew handles: the opposite side stays put */
    await ev(() => { const E = window.imageEditorInstance.E, S = window.imageEditorInstance.state; const L = E.makeLayer("Sq", S.w, S.h, "pixel"); const g = L.canvas.getContext("2d"); g.fillStyle = "#000"; g.fillRect(150, 100, 100, 100); E.addLayer(L, "sq", false); E.setTool("move"); E.refresh(); });
    await p.mouse.click(...(await T(200, 150))); await p.waitForTimeout(150);
    await p.mouse.dblclick(...(await T(200, 150))); await p.waitForTimeout(150);
    const bx = await ev(() => window.imageEditorInstance.E.handles.box());
    const [hx, hy] = await T(bx.x + bx.w / 2, bx.y);
    await p.mouse.move(hx, hy); await p.mouse.down(); await p.mouse.move(hx + 20, hy, { steps: 4 }); await p.mouse.move(hx + 40, hy, { steps: 4 }); await p.mouse.up(); await p.waitForTimeout(300);
    const [top, bot] = await rows([102, 198]);
    check("skew: the top side dragged 40 px right slants the square - the top moves ~40 px, the BOTTOM stays where it was (it used to run the other way)", top[0] >= 185 && top[0] <= 192 && Math.abs(bot[0] - 150) <= 2 && Math.abs(bot[1] - 249) <= 2, { top, bot });

    /* 2 type skews and stays type */
    await ev(() => { const S = window.imageEditorInstance.state; S.typeSize = 48; window.imageEditorInstance.E.setTool("type"); });
    await p.mouse.click(...(await T(60, 30))); await p.waitForSelector(".kx textarea.pctext"); await p.keyboard.type("IIII"); await p.keyboard.press("Control+Enter"); await p.waitForTimeout(250);
    await ev(() => window.imageEditorInstance.E.setTool("move"));
    await p.mouse.click(...(await T(80, 50))); await p.waitForTimeout(150);
    // 2.606.0: a double-click INSIDE a text edits it - on one of its handles it switches to the rotate / skew handles
    const tb0 = await ev(() => window.imageEditorInstance.E.handles.box());
    await p.mouse.dblclick(...(await T(tb0.x + tb0.w, tb0.y + tb0.h / 2))); await p.waitForTimeout(150);
    const tb = await ev(() => window.imageEditorInstance.E.handles.box());
    const r0 = await rows([Math.round(tb.y + 6), Math.round(tb.y + tb.h - 6)]);
    const [tx, ty] = await T(tb.x + tb.w / 2, tb.y);
    await p.mouse.move(tx, ty); await p.mouse.down(); await p.mouse.move(tx + 15, ty, { steps: 4 }); await p.mouse.move(tx + 30, ty, { steps: 4 }); await p.mouse.up(); await p.waitForTimeout(300);
    const st = await ev(() => { const L = window.imageEditorInstance.E.layer(); return { type: L.type, xm: L.text && L.text.xm, str: L.text && L.text.str }; });
    const r1 = await rows([Math.round(tb.y + 6), Math.round(tb.y + tb.h - 6)]);
    check("a TEXT skews too and stays text (t.xm), the letters slanted: the top runs right, the bottom stays", st.type === "text" && Array.isArray(st.xm) && Math.abs(st.xm[2]) > 0.2 && st.str === "IIII" && r1[0][0] - r0[0][0] >= 15 && Math.abs(r1[1][0] - r0[1][0]) <= 4, { st, r0, r1 });

    /* 3 no thick box: with the Move tool the picked text shows only its handles' thin frame (no orange outline) */
    await p.mouse.click(...(await T(80, 50))); await p.waitForTimeout(200);
    const orange = await ev(() => { const E = window.imageEditorInstance.E, ov = E.ov, d = ov.getContext("2d").getImageData(0, 0, ov.width, ov.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] > 230 && d[i + 1] > 110 && d[i + 1] < 160 && d[i + 2] < 40 && d[i + 3] > 200) n++; return n; });
    check("no thick box: the picked text has no orange outline on top of its handles' frame", orange < 10, orange);

    /* 4 right-click ▸ Rasterize Text */
    await p.mouse.click(...(await T(80, 50)), { button: "right" }); await p.waitForTimeout(250);
    const items = await ev(() => [...document.querySelectorAll(".kxmenu [data-cmd]")].map((x) => x.dataset.cmd));
    check("right-click on a text layer: the menu starts with Rasterize Text", items[0] === "layer.rasterizetext", items);
    await p.click('.kxmenu [data-cmd="layer.rasterizetext"]'); await p.waitForTimeout(250);
    const after = await ev(() => { const L = window.imageEditorInstance.E.layer(); return { type: L.type, text: !!L.text }; });
    check("…Rasterize Text: the layer is pixels now (one undo step)", after.type === "pixel" && !after.text, after);
    await ev(() => window.imageEditorInstance.E.undo()); await p.waitForTimeout(200);
    check("…and Ctrl+Z gives the text back", await ev(() => window.imageEditorInstance.E.layer().type === "text"));

    /* 5 💾 Save to Images: JPEG -> the temp copy, flattened on white, Images + Gallery */
    await ev(() => { const s = document.getElementById("ieSaveFmt"); s.dispatchEvent(new Event("focus")); });
    await p.selectOption("#ieSaveFmt", "jpeg"); await p.waitForTimeout(100);
    const reqs = []; p.on("request", (r) => { if (/\/api\/imagesave/.test(r.url())) reqs.push(r.url().replace(/^.*\/api/, "/api").split("?")[0]); });
    await p.click("#ieSave");
    await p.waitForFunction(() => /saved .*JPEG/.test(document.querySelector(".kx #kxStatus, .kx .kxstatus, .kx [id$=Status]") ? document.querySelector(".kx #kxStatus, .kx .kxstatus, .kx [id$=Status]").textContent : document.body.textContent), null, { timeout: 20000 }).catch(() => {});
    await p.waitForTimeout(800);
    const gal = await ev(async () => (await (await fetch("/api/outputs?kind=images")).json()).map((f) => f.name));
    const name = gal.find((n) => /-edit-[a-z0-9]+\.jpg$/.test(n));
    const px = name ? await ev(async (n) => { const im = new Image(); im.src = "/passets/images/" + encodeURIComponent(n) + "?v=" + Date.now(); await im.decode(); const c = document.createElement("canvas"); c.width = im.width; c.height = im.height; const g = c.getContext("2d"); g.drawImage(im, 0, 0); return { w: im.width, h: im.height, corner: Array.from(g.getImageData(5, 290, 1, 1).data).slice(0, 3), sq: Array.from(g.getImageData(160, 190, 1, 1).data).slice(0, 3) }; }, name) : null;
    check("💾 with JPEG picked: a temp copy first, then the picture - in the GALLERY and in the project's Images (Assets)", reqs.join() === "/api/imagesave/tmp,/api/imagesave" && !!name && px && px.w === 400 && px.h === 300, { reqs, name, gal: gal.slice(0, 5) });
    check("…flattened on WHITE (a see-through corner is white, not the black a JPEG gets), the visible layers in it", px && px.corner.every((v) => v > 235) && px.sq.every((v) => v < 40), px);
    const tmpLeft = await ev(async () => { try { return (await (await fetch("/api/fsbrowse?dir=" + encodeURIComponent("projects"))).json()) && true; } catch { return true; } });
    void tmpLeft;

    /* 6 the timeline canvas: a thin frame, right-click ▸ Rasterize Text */
    await p.keyboard.press("Escape"); await ev(() => { if (window.imageEditorInstance.E.setFull) window.imageEditorInstance.E.setFull(false); });
    await ev(() => {
      const d = document.getElementById("timelinedock");
      if (/collapsed|dockgone/.test(d.className) && typeof toggleCollapse === "function") toggleCollapse("timelinedock");
      // a big timeline docker for the test (the saved layout may have it small) - put back after
      window.__tlCss = d.style.cssText; d.style.cssText += ";position:fixed;left:0;top:0;width:1500px;height:1000px;z-index:99990"; d.style.setProperty("--tlsh", "560px");
      if (document.getElementById("tlStage").classList.contains("off")) document.getElementById("tlStageTog").click();
      tl.video = []; tl.vlayers = []; tl.audio = []; tl.images = []; tlSave(); renderTimeline();
      TlCanvas.addText({ x: TlCanvas.state.W / 2, y: TlCanvas.state.H / 2 });
    });
    await p.waitForTimeout(1200);
    await ev(() => { const a = document.getElementById("tlpText"); if (a) { a.value = "Rasterize me"; a.dispatchEvent(new Event("input", { bubbles: true })); a.blur(); } });
    await p.waitForTimeout(800); await ev(() => { window.dispatchEvent(new Event("resize")); if (TlCanvas.fit) TlCanvas.fit(); }); await p.waitForTimeout(800);
    const cpt = await ev(() => { const C = TlCanvas, c = tl.images[0].clips[0], bx2 = C.box(c, "img"), s = C.toScreen(bx2.cx, bx2.cy), r = document.getElementById("tlCanvas").getBoundingClientRect(); document.getElementById("tlCanvas").scrollIntoView({ block: "center" }); return { x: r.left + s.x, y: r.top + s.y }; });
    const cpt2 = await ev(() => { const C = TlCanvas, c = tl.images[0].clips[0], bx2 = C.box(c, "img"), s = C.toScreen(bx2.cx, bx2.cy), r = document.getElementById("tlCanvas").getBoundingClientRect(); return { x: r.left + s.x, y: r.top + s.y }; });
    void cpt;
    await p.mouse.click(cpt2.x, cpt2.y, { button: "right" }); await p.waitForTimeout(300);
    const mi = await ev(() => { const b2 = document.getElementById("tlctxRaster"); return b2 ? { text: b2.textContent, dis: b2.disabled } : null; });
    check("timeline canvas: right-click on a text layer = a menu with 🅰 Rasterize Text", mi && /Rasterize Text/.test(mi.text) && !mi.dis, mi);
    await p.click("#tlctxRaster"); await p.waitForTimeout(1200);
    const rc = await ev(() => { const c = tl.images[0].clips[0]; return { text: !!c.text, name: c.name, layerText: !!tl.images[0].text }; });
    check("…the text clip is a picture now (its PNG kept, no letters, the layer no longer a text layer)", !rc.text && /^text_.+\.png$/.test(rc.name) && !rc.layerText, rc);
    await ev(() => TlRange.undo()); await p.waitForTimeout(400);
    check("…↶ undo gives the text back", await ev(() => !!tl.images[0].clips[0].text));
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + (e && e.stack || e)); }
  finally {
    try { await ev(() => { tl.video = []; tl.vlayers = []; tl.images = []; tl.audio = []; tl.sel = null; tlSave(); renderTimeline(); const d = document.getElementById("timelinedock"); if (d && window.__tlCss != null) d.style.cssText = window.__tlCss; }); } catch { /* closed */ }
    try { await b.close(); } catch { /* fine */ }
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
