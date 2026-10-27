#!/usr/bin/env node
/* bitGen Studio — 2.605.0 in a REAL browser: HOVER = THE MOVE TOOL'S THIN FRAME, A CLICK WITH A DRAWING TOOL PICKS + THE
 * MOVE TOOL - the image editor and the timeline canvas.
 * Tim: "when user hovers over text don't show the thick bounding box,do this with all drawing objects show the same one
 * as the move tool, if user clicks on the element select it and automatically go to the move tool."
 *   image editor  a rectangle + a text; with the Move tool, the Rectangle tool and the Type tool the object under the
 *                 pointer shows only the thin dashed blue frame (no thick outline - few pixels, no white halo); the
 *                 Rectangle tool's CLICK on the rectangle picks it and switches to the Move tool (nothing drawn); its
 *                 DRAG over the rectangle still draws a new one
 *   timeline      a text on the canvas: the Shape tool's click on it = picked + the Move tool (no new shape); the Text
 *                 tool's click = the same (no new text); the hover frame is the thin dashed one
 * Against the running app (H3_URL, default the e2e server on :8311). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.605.0 browser test did not run"); process.exit(0); }
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
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.selHl && window.TlSelHl, null, { timeout: 60000 });
    await p.waitForTimeout(1000);
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await p.click("#kxFull"); await p.waitForTimeout(900);
    await ev(() => { const E = window.imageEditorInstance.E; E.setBg("#ffffff"); E.setFg("#000000"); });
    await p.click('#pcMenus .mi[data-menu="File"]'); await p.waitForTimeout(120); await p.click('.kxmenu [data-cmd="file.new"]'); await p.waitForTimeout(200);
    await p.fill(".kxdlg.pcd #pdW", "500"); await p.fill(".kxdlg.pcd #pdH", "350"); await p.click(".kxdlg.pcd .ok"); await p.waitForTimeout(400);
    const T = async (x, y) => { const v = await ev(() => { const s = window.imageEditorInstance.state; return { z: s.zoom, x: s.panX, y: s.panY }; }); const r = await p.locator("#ieStage").boundingBox(); return [r.x + v.x + x * v.z, r.y + v.y + y * v.z]; };
    const drag = async (x0, y0, x1, y1) => { await p.waitForTimeout(120); const [a, c] = await T(x0, y0), [d, e] = await T(x1, y1); await p.mouse.move(a, c); await p.mouse.down(); await p.mouse.move(d, e, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(150); };
    const st = () => ev(() => { const s = window.imageEditorInstance.state, L = s.layers[s.active]; return { n: s.layers.length, tool: s.tool, type: L && L.type, name: L && L.name }; });
    // the overlay's blue / white / orange pixels; ratio = blue / the hovered box's perimeter in overlay pixels (a thin dashed
    // frame about 1 (a 1 px line covers two pixel rows half each), the old 1.6 px solid line 2 and more - and its white halo)
    const ov = () => ev(() => { const E = window.imageEditorInstance.E, S = window.imageEditorInstance.state; E.drawOverlay(); const c = E.ov, D = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; let blue = 0, halo = 0, orange = 0;
      for (let i = 0; i < D.length; i += 4) { const r = D[i], g = D[i + 1], bl = D[i + 2], a = D[i + 3]; if (a < 120) continue; if (r < 90 && g > 100 && g < 160 && bl > 200) blue++; else if (r > 240 && g > 240 && bl > 240) halo++; else if (r > 225 && g > 110 && g < 165 && bl < 70) orange++; }
      const h = E.selHl.hover(), b = h ? E.dockers.boxOf(h) : null, k = c.width / (c.getBoundingClientRect().width || c.width), per = b ? 2 * (b.w + b.h) * S.zoom * k : 0;
      return { blue, halo, orange, hover: h && h.type, ratio: per ? Math.round(blue / per * 100) / 100 : null }; });
    // a rectangle (drawn with the Rectangle tool -> the Move tool picks it) and a text
    await ev(() => window.imageEditorInstance.E.setTool("shape")); await drag(80, 80, 220, 180);
    const s0 = await st();
    await ev(() => { const S = window.imageEditorInstance.state; S.typeSize = 40; window.imageEditorInstance.E.setTool("type"); });
    await p.mouse.click(...(await T(300, 240))); await p.waitForSelector(".kx textarea.pctext"); await p.keyboard.type("Hello"); await p.keyboard.press("Control+Enter"); await p.waitForTimeout(250);
    const n0 = (await st()).n;
    // hover with the Move tool over the rectangle (the text picked): the thin dashed frame only
    await ev(() => window.imageEditorInstance.E.setTool("move"));
    await p.mouse.click(...(await T(470, 40))); await p.waitForTimeout(150);          // nothing picked (no handles)
    await p.mouse.move(...(await T(150, 130))); await p.waitForTimeout(200);
    const o1 = await ov();
    check("Move tool, the pointer over the rectangle: the thin dashed blue frame (the handles' style) - not a thick outline (no white halo, thin)",
      s0.type === "shape" && o1.hover === "shape" && o1.ratio > 0.2 && o1.ratio < 1.5 && o1.halo < 20, { s0, o1 });
    // the Rectangle tool: hover shows the same frame; a CLICK on the rectangle picks it + the Move tool
    await ev(() => { window.imageEditorInstance.E.setTool("shape"); const s = window.imageEditorInstance.state; s.active = s.layers.findIndex((x) => x.type === "text"); });
    await p.mouse.move(...(await T(150, 130))); await p.waitForTimeout(200);
    const o2 = await ov();
    check("the Rectangle tool over the rectangle: the same thin frame shows", o2.hover === "shape" && o2.ratio > 0.2 && o2.ratio < 1.5 && o2.halo < 20, o2);
    await p.mouse.click(...(await T(150, 130))); await p.waitForTimeout(300);
    const s2 = await st();
    check("the Rectangle tool's CLICK on the rectangle: it is picked and the Move tool is on - nothing new drawn", s2.tool === "move" && s2.type === "shape" && s2.n === n0, s2);
    // a DRAG over it with the Rectangle tool still draws a new rectangle
    await ev(() => window.imageEditorInstance.E.setTool("shape")); await drag(120, 110, 260, 200);
    const s3 = await st();
    check("…a DRAG over the rectangle with the Rectangle tool still draws a new one (picked, the Move tool) - it used to be lost with a shape picked", s3.n === n0 + 1 && s3.type === "shape" && s3.name === "Rectangle 2" && s3.tool === "move", s3);
    // the Type tool over the text: the same frame (a click still edits it there - 2.602.0)
    await ev(() => window.imageEditorInstance.E.setTool("type"));
    await p.mouse.move(...(await T(330, 260))); await p.waitForTimeout(200);
    const o4 = await ov();
    check("the Type tool over a text (between its letters too): the same thin frame", o4.hover === "text" && o4.ratio > 0.2 && o4.ratio < 1.5 && o4.halo < 20, o4);
    await p.mouse.move(...(await T(150, 130))); await p.waitForTimeout(200);
    const o5 = await ov();
    check("…over a shape with the Type tool: no frame (it types, it does not pick shapes)", !o5.hover && o5.blue < 20, o5);
    await p.keyboard.press("Escape"); await ev(() => { if (window.imageEditorInstance.E.setFull) window.imageEditorInstance.E.setFull(false); });

    /* the timeline canvas */
    await ev(() => {
      const d = document.getElementById("timelinedock");
      if (/collapsed|dockgone/.test(d.className) && typeof toggleCollapse === "function") toggleCollapse("timelinedock");
      window.__tlCss = d.style.cssText; d.style.cssText += ";position:fixed;left:0;top:0;width:1500px;height:1000px;z-index:99990"; d.style.setProperty("--tlsh", "560px");
      if (document.getElementById("tlStage").classList.contains("off")) document.getElementById("tlStageTog").click();
      tl.video = []; tl.vlayers = []; tl.audio = []; tl.images = []; tlSave(); renderTimeline();
      TlCanvas.addText({ x: TlCanvas.state.W / 2, y: TlCanvas.state.H / 2 });
    });
    await p.waitForTimeout(1000);
    await ev(() => { const a = document.getElementById("tlpText"); if (a) { a.value = "Pick me"; a.dispatchEvent(new Event("input", { bubbles: true })); a.blur(); } });
    await p.waitForTimeout(800); await ev(() => { window.dispatchEvent(new Event("resize")); if (TlCanvas.fit) TlCanvas.fit(); }); await p.waitForTimeout(800);
    const at = await ev(() => { const C = TlCanvas, c = tl.images[0].clips[0], bx = C.box(c, "img"), s = C.toScreen(bx.cx, bx.cy), r = document.getElementById("tlCanvas").getBoundingClientRect(); return { x: r.left + s.x, y: r.top + s.y }; });
    const nClips = () => ev(() => (tl.vlayers || []).concat(tl.images || []).reduce((a, L) => a + (L.clips || []).length, 0));
    const c0 = await nClips();
    await ev(() => { TlCanvas.select(null, null); TlCanvas.setTool("shape"); });
    await p.mouse.move(at.x, at.y); await p.waitForTimeout(250);
    const hov = await ev(() => !!(window.TlSelHl.hover() && window.TlSelHl.hover().c));
    check("timeline canvas, the Shape tool over a text: it shows the hover frame", hov);
    await p.mouse.click(at.x, at.y); await p.waitForTimeout(300);
    const t1 = await ev(() => ({ tool: TlCanvas.state.tool, sel: !!(TlCanvas.selClip() && TlCanvas.selClip().c && TlCanvas.selClip().c.text) }));
    check("…the Shape tool's CLICK on it: picked + the Move tool, no new shape", t1.tool === "move" && t1.sel && (await nClips()) === c0, Object.assign(t1, { n: await nClips(), c0 }));
    await ev(() => { TlCanvas.select(null, null); TlCanvas.setTool("text"); });
    await p.mouse.click(at.x, at.y); await p.waitForTimeout(300);
    const t2 = await ev(() => ({ tool: TlCanvas.state.tool, sel: !!(TlCanvas.selClip() && TlCanvas.selClip().c && TlCanvas.selClip().c.text) }));
    check("…the Text tool's CLICK on it: picked + the Move tool, no new text", t2.tool === "move" && t2.sel && (await nClips()) === c0, Object.assign(t2, { n: await nClips() }));
    await ev(() => { TlCanvas.select(null, null); TlCanvas.setTool("shape"); });
    await p.mouse.move(at.x - 30, at.y - 10); await p.mouse.down(); await p.mouse.move(at.x + 20, at.y + 20, { steps: 6 }); await p.mouse.move(at.x + 60, at.y + 40, { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(400);
    check("…a DRAG over it with the Shape tool still draws a new shape", (await nClips()) === c0 + 1, { n: await nClips(), c0 });
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
