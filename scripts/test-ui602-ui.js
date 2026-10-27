#!/usr/bin/env node
/* bitGen Studio — 2.602.0 in a REAL browser: THE IMAGE EDITOR'S TYPE TOOL - the frame hugs the typed text, the
 * edit-text cursor over a text, a click edits FROM the click.
 * Tim: "in image-editor text tool make the select tool fit the text that is typed dynamically. change the cursor to a
 * edit text cursor when hover over text, on click edit text from the position of the click".
 *   typing     the dashed frame starts small and grows with every key, always round all the letters (never scrolled),
 *              see-through (the letters are the layer's own), centred text grows both ways
 *   boxes      the Move tool's box (pcdoc.textBox) is as wide as the ink now (it was measured at 10 px)
 *   cursor     the Type tool over a text = the I-beam; elsewhere the new-text cursor (an I-beam in a dotted box)
 *   click      on a committed text: the caret between the letters at the click (not all selected) - typing goes in
 *              there; a click inside the typing box moves the caret and keeps typing; a paragraph text's second line
 * Against the running app (H3_URL, default the e2e server on :8311). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.602.0 browser test did not run"); process.exit(0); }
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
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.type && window.PCCaret, null, { timeout: 60000 });
    await p.waitForTimeout(1000);
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await p.click("#kxFull"); await p.waitForTimeout(900);
    await ev(() => { const E = window.imageEditorInstance.E; E.setBg("#ffffff"); E.setFg("#000000"); });
    await p.click('#pcMenus .mi[data-menu="File"]'); await p.waitForTimeout(120); await p.click('.kxmenu [data-cmd="file.new"]'); await p.waitForTimeout(200);
    await p.fill(".kxdlg.pcd #pdW", "500"); await p.fill(".kxdlg.pcd #pdH", "300"); await p.click(".kxdlg.pcd .ok"); await p.waitForTimeout(400);
    const T = async (x, y) => { const v = await ev(() => { const s = window.imageEditorInstance.state; return { z: s.zoom, x: s.panX, y: s.panY }; }); const r = await p.locator("#ieStage").boundingBox(); return [r.x + v.x + x * v.z, r.y + v.y + y * v.z]; };
    const frame = () => ev(() => { const s = window.imageEditorInstance.state, ta = document.querySelector(".kx textarea.pctext"); if (!ta) return null; const r = ta.getBoundingClientRect(), st = document.getElementById("ieStage").getBoundingClientRect();
      return { x0: (r.left - st.left - s.panX) / s.zoom, x1: (r.right - st.left - s.panX) / s.zoom, y0: (r.top - st.top - s.panY) / s.zoom, y1: (r.bottom - st.top - s.panY) / s.zoom, scroll: ta.scrollLeft, bg: getComputedStyle(ta).backgroundColor, col: getComputedStyle(ta).color, pad: getComputedStyle(ta).paddingLeft, sel: [ta.selectionStart, ta.selectionEnd] }; });
    const ink = () => ev(() => { const s = window.imageEditorInstance.state, A = s.layers[s.active], W = A.canvas.width, H = A.canvas.height, d = A.canvas.getContext("2d").getImageData(0, 0, W, H).data; let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1; for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 60) { const k = i / 4, x = k % W, y = Math.floor(k / W); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } return { x0, x1, y0, y1 }; });
    const layerText = () => ev(() => { const E = window.imageEditorInstance.E, L = E.layer(); return L && L.text ? L.text.str : null; });

    /* 1 typing: the frame hugs the letters and grows with them */
    await ev(() => { const S = window.imageEditorInstance.state; S.typeSize = 24; S.typeAlign = "left"; window.imageEditorInstance.E.setTool("type"); });
    const [ax, ay] = await T(30, 60); await p.mouse.click(ax, ay); await p.waitForSelector(".kx textarea.pctext");
    const f0 = await frame();
    const widths = [];
    for (const ch of "Hello wide World") { await p.keyboard.type(ch); widths.push(Math.round((await frame()).x1)); }
    const f1 = await frame(), k1 = await ink();
    check("typing: the dashed frame starts small (a caret's room) and grows with every letter", f0.x1 - f0.x0 < 12 && widths.every((w, i) => i === 0 || w >= widths[i - 1]) && widths[widths.length - 1] - widths[0] > 120, { f0, widths });
    check("…it is round ALL the letters, snug (left within 6 px, right within 12 px of the ink), never scrolled",
      f1.x0 <= k1.x0 && k1.x0 - f1.x0 <= 6 && f1.x1 >= k1.x1 && f1.x1 - k1.x1 <= 12 && f1.y0 <= k1.y0 && f1.y1 >= k1.y1 && f1.scroll === 0, { f1, k1 });
    check("…see-through: no background, no visible textarea letters, no padding (the layer's own letters show)", f1.bg === "rgba(0, 0, 0, 0)" && f1.col === "rgba(0, 0, 0, 0)" && f1.pad === "0px", f1);
    await p.keyboard.press("Control+Enter"); await p.waitForTimeout(250);
    const mb = await ev(() => { const E = window.imageEditorInstance.E, L = E.layer(); return window.PCDoc.textBox(L.text, L.canvas.getContext("2d")); });
    check("the text's box (Move tool handles, Align, hit test) is as wide as the ink - it was measured at the canvas's 10 px", Math.abs(mb.x + mb.w - k1.x1) <= 4 && mb.x <= k1.x0, { mb, k1 });

    /* 2 the cursor */
    await p.mouse.move(...(await T(80, 72))); await p.waitForTimeout(150);
    const cOn = await ev(() => document.getElementById("ieStage").style.cursor);
    await p.mouse.move(...(await T(300, 250))); await p.waitForTimeout(150);
    const cOff = await ev(() => document.getElementById("ieStage").style.cursor);
    check("the Type tool over a text = the edit-text I-beam; elsewhere the new-text cursor (an I-beam in a dotted box)", cOn === "text" && /^url\("data:image\/svg\+xml/.test(cOff) && /crosshair$/.test(cOff), { cOn, cOff: cOff.slice(0, 40) });

    /* 3 2.606.0 (Tim: "the click on element in this case text layer is not auto selecting the move tool"): a CLICK on the
       text with the Type tool picks it + the Move tool; a DOUBLE-click edits it from the click (2.602.0's caret) */
    const xAfterWide = await ev(() => { const L = window.imageEditorInstance.E.layer(), g = L.canvas.getContext("2d"); g.save(); g.font = window.PCDoc.fontCss(L.text); const w = g.measureText("Hello wide").width; g.restore(); return L.text.x + w; });
    await p.mouse.click(...(await T(xAfterWide + 1, 72))); await p.waitForTimeout(250);
    const k0 = await ev(() => ({ tool: window.imageEditorInstance.state.tool, type: window.imageEditorInstance.E.layer().type, typing: !!document.querySelector(".kx textarea.pctext") }));
    check("2.606.0: a click on a text with the Type tool = the text PICKED and the Move tool on (no typing box)", k0.tool === "move" && k0.type === "text" && !k0.typing, k0);
    await p.mouse.dblclick(...(await T(xAfterWide + 1, 72))); await p.waitForTimeout(250);
    const c1 = await frame();
    await p.keyboard.type("XYZ"); await p.waitForTimeout(150);
    check("a DOUBLE-click on the text between 'wide' and ' World': editing, the caret THERE (nothing selected), typing goes in there", c1 && c1.sel[0] === 10 && c1.sel[1] === 10 && (await layerText()) === "Hello wideXYZ World", { sel: c1 && c1.sel, str: await layerText() });
    await p.mouse.click(...(await T(36, 72))); await p.waitForTimeout(200);
    const c2 = await frame();
    await p.keyboard.type("_"); await p.waitForTimeout(100);
    check("…a click inside the typing box moves the caret there and keeps typing (it used to end the typing)", c2 && c2.sel[0] <= 1 && /^H?_/.test(await layerText()), { c2, str: await layerText() });
    await p.keyboard.press("Control+Enter"); await p.waitForTimeout(200);

    /* 4 centred text grows both ways and stays round its letters */
    await ev(() => { const S = window.imageEditorInstance.state; S.typeAlign = "center"; window.imageEditorInstance.E.setTool("type"); });
    await p.mouse.click(...(await T(250, 160))); await p.waitForSelector(".kx textarea.pctext");
    await p.keyboard.type("Centred words"); await p.waitForTimeout(150);
    const f3 = await frame(), k3 = await ink();
    check("centred text: the frame grows both ways round the letters (centre near 250)", f3.x0 <= k3.x0 && f3.x1 >= k3.x1 && Math.abs((f3.x0 + f3.x1) / 2 - 250) < 8 && f3.scroll === 0, { f3, k3 });
    await p.keyboard.press("Control+Enter"); await p.waitForTimeout(200);

    /* 5 a paragraph text: a click on its second line */
    await ev(() => { const S = window.imageEditorInstance.state; S.typeAlign = "left"; window.imageEditorInstance.E.setTool("type"); });
    await p.mouse.move(...(await T(30, 200))); await p.mouse.down(); await p.mouse.move(...(await T(140, 290)), { steps: 5 }); await p.mouse.up();
    await p.waitForSelector(".kx textarea.pctext");
    await p.keyboard.type("alpha beta gamma delta"); await p.keyboard.press("Control+Enter"); await p.waitForTimeout(250);
    const lay = await ev(() => { const E = window.imageEditorInstance.E; return E.type.layout(E.layer().text).lines.map((l) => ({ text: l.text, x: l.x, y: l.y })); });
    const l2 = lay[1];
    const x2 = await ev((l2) => { const E = window.imageEditorInstance.E, m = E.type.measure(E.layer().text); return l2.x + m(l2.text.slice(0, 2)); }, l2);
    await p.mouse.dblclick(...(await T(x2 + 1, l2.y + 8))); await p.waitForTimeout(250);
    const c5 = await frame(), want = "alpha beta gamma delta".indexOf(l2.text) + 2;
    check("a paragraph (wrapped) text: a double-click on its SECOND line puts the caret in that line", lay.length >= 2 && c5 && c5.sel[0] === want && c5.sel[1] === want, { lay, sel: c5 && c5.sel, want });
    await p.keyboard.press("Escape");
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + (e && e.stack || e)); }
  finally { try { await b.close(); } catch { /* fine */ } }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
