#!/usr/bin/env node
/* bitGen Studio — 2.570.0 in a REAL browser: 🖊 PEN TABLET in the image editor - real pen input (Chromium's DevTools
 * protocol sends pointerType "pen" with a pressure and a tilt, as Windows Ink does): the Pen tab's test pad, the levels,
 * the pressure curve changing a G-pen line, "Pressure -> size" for every brush, tilt, the eraser end and the side button.
 * Tim: "can we add pen tools like xp pen with levels of pressure for freehand drawing?"
 * Against the running app (H3_URL). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the pen tablet browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1700, height: 1050 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  const cdp = await p.context().newCDPSession(p);
  const pen = (type, x, y, force, o) => cdp.send("Input.dispatchMouseEvent", Object.assign({ type, x, y, button: "left", buttons: type === "mouseReleased" ? 0 : 1, clickCount: type === "mouseMoved" ? 0 : 1, pointerType: "pen", force }, o || {}));
  /** a pen stroke in screen px: pressure goes from f0 to f1 along it */
  const stroke = async (x0, y0, x1, y1, f0, f1, o, n) => {
    const N = n || 24;
    await pen("mouseMoved", x0, y0, 0, Object.assign({ buttons: 0 }, o || {}));
    await pen("mousePressed", x0, y0, f0, o);
    for (let i = 1; i <= N; i++) await pen("mouseMoved", x0 + (x1 - x0) * i / N, y0 + (y1 - y0) * i / N, f0 + (f1 - f0) * i / N, o);
    await pen("mouseReleased", x1, y1, 0, o);
    await p.waitForTimeout(150);
  };
  try {
    try { await fetch(URL_ + "api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docks: { imageeditdock: { state: "open", hidden: false, maximized: false } } }) }); } catch { /* older */ }
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.tablet, null, { timeout: 60000 });
    await p.waitForTimeout(1200);
    await ev(() => new Promise((ok) => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock");
      const pd = document.getElementById("promptdock"); if (pd) pd.style.display = "none";
      const E = window.imageEditorInstance.E; if (E.setFull) E.setFull(true);
      E.tablet.set({ preset: "linear", curve: [[0, 0], [1, 1]], lo: 0, hi: 100, size: false, opacity: false, minSize: 10, eraserEnd: true, barrel: "picker", tilt: true, mouseSim: false });
      const c = document.createElement("canvas"); c.width = 800; c.height = 600; const g = c.getContext("2d"); g.fillStyle = "#ffffff"; g.fillRect(0, 0, 800, 600); g.fillStyle = "#12a050"; g.fillRect(700, 500, 100, 100);
      window.imageEditorInstance.load(c.toDataURL("image/png"), "pen570"); setTimeout(() => { if (E.fitView) E.fitView(); ok(); }, 800); }));
    await p.waitForTimeout(400);

    /* 1 the Pen tab + the test pad with a real pen */
    await ev(() => window.imageEditorInstance.E.ui.showTab("pcTablet")); await p.waitForTimeout(300);
    const tab = await ev(() => ({ btn: !!document.querySelector('.pctabs [data-tab="pcTablet"]'), next: (document.querySelector('.pctabs [data-tab="pcTablet"]') || {}).previousElementSibling && document.querySelector('.pctabs [data-tab="pcTablet"]').previousElementSibling.dataset.tab,
      parts: ["ptPad", "ptCurve", "ptPreset", "ptLo", "ptHi", "ptSize", "ptOpa", "ptErase", "ptTilt", "ptBarrel", "ptMouse"].filter((id) => !document.getElementById(id)), stat: document.getElementById("ptStat").textContent }));
    check("🖊 Pen tab next to 🖌 Brush: the test pad, the curve and its presets, the lightest touch / full pressure, every brush, the pen's ends / button / tilt, a mouse's speed", tab.btn && tab.next === "pcBrush" && tab.parts.length === 0 && /no pen seen yet/.test(tab.stat), tab);
    const pad = await ev(() => { const r = document.getElementById("ptPad").getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
    await stroke(pad.x + 20, pad.y + pad.h / 2, pad.x + pad.w - 20, pad.y + pad.h / 2, 0.1, 0.95, {}, 60);
    // a second stroke at neighbouring levels (1/8192 apart) so the levels can be told
    await pen("mousePressed", pad.x + 30, pad.y + 20, 0.5); for (let i = 0; i < 40; i++) await pen("mouseMoved", pad.x + 30 + i * 3, pad.y + 20, (4096 + i) / 8192); await pen("mouseReleased", pad.x + 150, pad.y + 20, 0);
    await p.waitForTimeout(500);
    const padOut = await ev(() => { const c = document.getElementById("ptPad"), g = c.getContext("2d"), col = (x) => { let n = 0; for (let y = Math.round(c.height * 0.3); y < c.height; y++) if (g.getImageData(x, y, 1, 1).data[3] > 100) n++; return n; };
      return { thin: col(Math.round(c.width * 0.1)), thick: col(Math.round(c.width * 0.9)), stat: document.getElementById("ptStat").textContent, seen: window.imageEditorInstance.E.tablet.seen().pen }; });
    check("a real pen on the pad: seen as a pen, the line thin at a light touch and thick at full pressure, the pressure shown", padOut.seen && padOut.thick > padOut.thin + 6 && /🖊 pen · pressure 0\.\d+/.test(padOut.stat), padOut);
    check("...its levels counted from the finest step it sent (8192 here)", /~8192 levels/.test(padOut.stat), padOut.stat);

    if (process.env.SHOTS) { const bx = await p.$("#pcTablet"); if (bx) await bx.screenshot({ path: path.join(process.env.SHOTS, "570-pen.png") }); }
    /* 2 on the canvas: a G-pen line follows the pressure; the curve changes it */
    const at = async (x, y) => ev(([x, y]) => { const E = window.imageEditorInstance.E, r = E.cv.getBoundingClientRect(); return [r.left + x * r.width / E.S.w, r.top + y * r.height / E.S.h]; }, [x, y]);
    const width = (y, x) => ev(([y, x]) => { const E = window.imageEditorInstance.E, f = E.flatten().getContext("2d"); let n = 0; for (let yy = y - 40; yy <= y + 40; yy++) { const d = f.getImageData(x, yy, 1, 1).data; if (d[0] < 128) n++; } return n; }, [y, x]);
    await ev(() => { const E = window.imageEditorInstance.E; E.setTool("paint"); E.S.preset = "gpen"; E.S.size = 30; E.setFg ? E.setFg("#000000") : (E.S.fg = "#000000"); E.renderOptions(); });
    let a = await at(100, 100), c = await at(600, 100);
    await stroke(a[0], a[1], c[0], c[1], 0.15, 1, {}, 40);
    const w1 = { light: await width(100, 150), heavy: await width(100, 560) };
    check("the G-pen on the canvas with a real pen: thin where it was pressed lightly, its full size where pressed hard", w1.heavy >= 22 && w1.light < w1.heavy / 2.5 && w1.light >= 1, w1);
    await ev(() => window.imageEditorInstance.E.tablet.set({ preset: "xsoft", curve: [[0, 0], [0.12, 0.45], [1, 1]] }));
    a = await at(100, 200); c = await at(600, 200);
    await stroke(a[0], a[1], c[0], c[1], 0.15, 1, {}, 40);
    const w2 = { light: await width(200, 150) };
    check("Pressure curve ▸ Extra soft: the same light touch draws a much wider line", w2.light > w1.light * 1.8, { w1, w2 });
    await ev(() => window.imageEditorInstance.E.tablet.set({ preset: "linear", curve: [[0, 0], [1, 1]], lo: 40 }));
    a = await at(100, 300); c = await at(600, 300);
    await stroke(a[0], a[1], c[0], c[1], 0.15, 1, {}, 40);
    const w3 = { light: await width(300, 150), heavy: await width(300, 560) };
    check("Lightest touch 40 %: a touch below it draws only the thinnest line", w3.light <= 3 && w3.heavy >= 22, w3);
    await ev(() => window.imageEditorInstance.E.tablet.set({ lo: 0 }));

    /* 3 every brush: Pressure -> size on the Marker (it has none of its own) */
    await ev(() => { const E = window.imageEditorInstance.E; E.S.preset = "marker"; E.S.size = 30; E.renderOptions(); E.tablet.set({ size: true, minSize: 5 }); });
    a = await at(100, 400); c = await at(600, 400);
    await stroke(a[0], a[1], c[0], c[1], 0.1, 1, {}, 40);
    const w4 = { light: await width(400, 140), heavy: await width(400, 560) };
    check("☑ Pressure -> size: the Marker (no pressure of its own) follows the pen too", w4.heavy > w4.light * 2.5, w4);
    await ev(() => window.imageEditorInstance.E.tablet.set({ size: false }));

    /* 4 tilt reaches the brushes */
    a = await at(100, 480); c = await at(300, 480);
    await stroke(a[0], a[1], c[0], c[1], 0.7, 0.7, { tiltX: 40, tiltY: 0 }, 10);
    const tl = await ev(() => { const s = window.imageEditorInstance.E.tablet.seen(); return { amount: s.tilt.amount, angle: s.tilt.angle, now: window.PCTablet.tilt() }; });
    check("tilt: the pen's lean reaches the brushes (Angle / Roundness control: Pen tilt)", Math.abs(tl.amount - 40 / 60) < 0.05 && Math.abs(tl.angle) < 0.05, tl);

    /* 5 the eraser end and the side button (Windows Ink's buttons; dispatched as the browser hands them over) */
    const er = await ev(async () => {
      const E = window.imageEditorInstance.E, st = E.stage, r = E.cv.getBoundingClientRect(), X = (x) => r.left + x * r.width / E.S.w, Y = (y) => r.top + y * r.height / E.S.h;
      E.setTool("paint");
      const cap = st.setPointerCapture; st.setPointerCapture = () => {};   // (a dispatched pointer has no real pointer to capture)
      const opt = (type, x, y, extra) => new PointerEvent(type, Object.assign({ bubbles: true, cancelable: true, pointerType: "pen", pointerId: 7, isPrimary: true, clientX: X(x), clientY: Y(y), pressure: 0.6 }, extra));
      st.dispatchEvent(opt("pointerdown", 350, 100, { button: 5, buttons: 32 }));
      const during = E.S.tool;
      st.dispatchEvent(opt("pointerup", 350, 100, { button: 5, buttons: 0 }));
      await new Promise((ok) => setTimeout(ok, 50));
      const after = E.S.tool;
      const fg0 = E.S.fg;
      st.dispatchEvent(opt("pointerdown", 750, 550, { button: 2, buttons: 2 }));
      const fg1 = E.S.fg, toolAfterBarrel = E.S.tool;
      st.setPointerCapture = cap;
      return { during, after, fg0, fg1, toolAfterBarrel };
    });
    check("the pen's eraser end: the brush becomes the Eraser while it is used, and comes back after", er.during === "erase" && er.after === "paint", er);
    check("the side button = the Eyedropper: the colour under the pen (the green corner), the tool unchanged", /^#12a050$/i.test(er.fg1 || "") && er.toolAfterBarrel === "paint", er);

    /* 6 the pen brushes in the presets */
    const pr = await ev(() => { const E = window.imageEditorInstance.E; E.setTool("paint"); E.renderOptions(); const bt = document.getElementById("kxPreset"); if (bt) bt.click(); const txt = document.body.innerText; if (bt) bt.click(); return ["G-pen", "Mapping pen", "Brush pen", "Real pencil", "Fineliner", "Technical pen", "Calligraphy"].filter((n) => !txt.includes(n)); });
    check("the 7 pen brushes are in the brush presets ▾", pr.length === 0, pr);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + (e && e.stack || e)); }
  finally {
    try { await ev(() => { const pd = document.getElementById("promptdock"); if (pd) pd.style.display = ""; const E = window.imageEditorInstance && window.imageEditorInstance.E; if (E) { if (E.setFull) E.setFull(false); E.tablet.set({ preset: "linear", curve: [[0, 0], [1, 1]], lo: 0, hi: 100, size: false, opacity: false }); } }); } catch (e) { /* gone */ }
    await b.close();
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
