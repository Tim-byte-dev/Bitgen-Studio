#!/usr/bin/env node
/* bitGen Studio — 2.426.0 in a REAL browser: THE CHARACTER AND PARAGRAPH PANELS, PARAGRAPH (AREA) TEXT, CHARACTER /
 * PARAGRAPH STYLES (ext/imageeditdock/pctype.js).
 * Tim: "continue with the photoshop gap closure" - the agreed order: 2.426.0 Character / Paragraph panels + styles.
 * Against the running app (H3_URL, default the e2e server on :8311). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the type panels browser test did not run"); process.exit(0); }
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
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.type, null, { timeout: 60000 });
    await p.waitForTimeout(1000);
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await p.click("#kxFull"); await p.waitForTimeout(900);
    await ev(() => { const E = window.imageEditorInstance.E; E.setBg("#ffffff"); E.setFg("#000000"); localStorage.removeItem("kx.t.cstyles"); localStorage.removeItem("kx.t.pstyles"); localStorage.removeItem("kx.t.extra"); });
    await p.click('#pcMenus .mi[data-menu="File"]'); await p.waitForTimeout(120); await p.click('.kxmenu [data-cmd="file.new"]'); await p.waitForTimeout(200);
    await p.fill(".kxdlg.pcd #pdW", "700"); await p.fill(".kxdlg.pcd #pdH", "500"); await p.click(".kxdlg.pcd .ok"); await p.waitForTimeout(400);
    const T = async (x, y) => { const v = await ev(() => { const s = window.imageEditorInstance.state; return { z: s.zoom, x: s.panX, y: s.panY }; }); const r = await p.locator("#ieStage").boundingBox(); return [r.x + v.x + x * v.z, r.y + v.y + y * v.z]; };
    const drag = async (pts) => { await p.waitForTimeout(120); const q = []; for (const [x, y] of pts) q.push(await T(x, y)); await p.mouse.move(...q[0]); await p.mouse.down(); for (const r of q.slice(1)) await p.mouse.move(r[0], r[1], { steps: 5 }); await p.mouse.up(); await p.waitForTimeout(200); };
    const txt = () => ev(() => { const s = window.imageEditorInstance.state, A = s.layers[s.active]; return A && A.text ? JSON.parse(JSON.stringify(A.text)) : null; });
    const ink = (x0, y0, x1, y1) => ev(([x0, y0, x1, y1]) => { const s = window.imageEditorInstance.state, A = s.layers[s.active], d = A.canvas.getContext("2d").getImageData(x0, y0, x1 - x0, y1 - y0).data; let n = 0, mx = -1, my = -1, nx = 1e9, ny = 1e9; for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 100) { n++; const k = i / 4, x = x0 + k % (x1 - x0), y = y0 + Math.floor(k / (x1 - x0)); mx = Math.max(mx, x); my = Math.max(my, y); nx = Math.min(nx, x); ny = Math.min(ny, y); } return { n, x0: nx, y0: ny, x1: mx, y1: my }; }, [x0, y0, x1, y1]);
    const tab = (id) => ev((id) => window.imageEditorInstance.E.ui.showTab(id), id);

    /* 1 the panels */
    const tabs = await ev(() => [...document.querySelectorAll('.pcgrp[data-g="color"] .pctabs [data-tab]')].map((x) => x.dataset.tab));
    check("the Character and Paragraph tabs sit next to Color / Swatches (Window menu too)", tabs.join() === "pcColor,pcSwatches,pcChar,pcPara" && await ev(() => !!window.imageEditorInstance.E.ui.CMD.get("win.pcChar") && !!window.imageEditorInstance.E.ui.CMD.get("win.pcPara")), tabs);

    /* 2 paragraph text: a Type-tool drag draws a box; the text wraps in it */
    await ev(() => { const S = window.imageEditorInstance.state; S.typeSize = 24; window.imageEditorInstance.E.setTool("type"); });
    await drag([[60, 60], [320, 300]]);
    await p.waitForSelector(".kx textarea.pctext");
    await p.keyboard.type("The quick brown fox jumps over the lazy dog and keeps on running far away");
    await p.keyboard.press("Control+Enter"); await p.waitForTimeout(250);
    let t = await txt();
    const lay = await ev(() => window.imageEditorInstance.E.type.layout(window.imageEditorInstance.E.layer().text).lines.map((l) => [l.text, Math.round(l.x), Math.round(l.y), Math.round(l.w)]));
    check("Type-tool drag = PARAGRAPH TEXT: the box (260 x 240 at 60,60), the words wrap inside it (3+ lines, none wider than the box)",
      t && t.box && t.box.w === 260 && t.box.h === 240 && t.x === 60 && lay.length >= 3 && lay.every((l) => l[3] <= 260 && l[1] >= 60), [t && t.box, lay]);
    const ik = await ink(0, 0, 700, 500);
    check("...drawn inside the box", ik.n > 500 && ik.x0 >= 58 && ik.x1 <= 322 && ik.y0 >= 58, ik);

    /* 3 the Paragraph panel */
    await tab("pcPara");
    await p.click('#pcPara [data-pal="jleft"]'); await p.waitForTimeout(200);
    t = await txt();
    const lay2 = await ev(() => window.imageEditorInstance.E.type.layout(window.imageEditorInstance.E.layer().text).lines.map((l) => [Math.round(l.w), +l.gap.toFixed(2), l.last]));
    const ik2 = await ink(0, 0, 700, 500);
    check("Paragraph panel ☰⯇ Justify last left: every line but the last fills the box (word gaps grow), drawn to the right edge", t.justify === "left" && lay2.slice(0, -1).every((l) => l[0] === 260 && l[1] > 0) && lay2[lay2.length - 1][1] === 0 && ik2.x1 >= 312, [lay2, ik2]);
    await p.fill("#pcPara #pcyIL", "20"); await p.dispatchEvent("#pcPara #pcyIL", "change"); await p.waitForTimeout(150);
    await p.fill("#pcPara #pcyIF", "30"); await p.dispatchEvent("#pcPara #pcyIF", "change"); await p.waitForTimeout(150);
    const lay3 = await ev(() => window.imageEditorInstance.E.type.layout(window.imageEditorInstance.E.layer().text).lines.map((l) => [Math.round(l.x), Math.round(l.w)]));
    check("...indents: left 20 px, first line +30 px (the lines narrower by them)", lay3[0][0] === 110 && lay3[1][0] === 80 && lay3[0][1] === 210 && lay3[1][1] === 240, lay3);
    const u0 = await ev(() => window.imageEditorInstance.state.undo.length);
    await p.fill("#pcPara #pcyBH", "60"); await p.dispatchEvent("#pcPara #pcyBH", "change"); await p.waitForTimeout(200);
    const over = await ev(() => window.imageEditorInstance.E.type.layout(window.imageEditorInstance.E.layer().text).overflow);
    const warn = await ev(() => /does not fit the box/.test(document.getElementById("pcPara").textContent));
    check("...a box too small: the text that does not fit is hidden, the panel says so (one undo step each change)", over && warn && (await ev(() => window.imageEditorInstance.state.undo.length)) > u0, [over, warn]);
    await ev(() => window.imageEditorInstance.E.undo()); await p.waitForTimeout(150);

    /* 4 the Character panel */
    await tab("pcChar");
    const before = await ink(0, 0, 700, 500);
    await p.fill("#pcChar #pcyHS", "150"); await p.dispatchEvent("#pcChar #pcyHS", "change"); await p.waitForTimeout(200);
    const lay4 = await ev(() => window.imageEditorInstance.E.type.layout(window.imageEditorInstance.E.layer().text).lines.length);
    check("Character ↔T horizontal scale 150 %: wider letters, so more lines in the same box", (await txt()).hscale === 150 && lay4 > lay2.length, [lay4, lay2.length]);
    await p.click("#pcChar #pcyFB"); await p.waitForTimeout(150);
    const fb = await ink(0, 0, 700, 500);
    check("...Faux Bold: heavier strokes (more ink)", (await txt()).fauxBold === true && fb.n > before.n * 1.1, [fb.n, before.n]);
    await p.click("#pcChar #pcySC"); await p.click("#pcChar #pcyU"); await p.waitForTimeout(150);
    t = await txt();
    check("...Small Caps and Underline on the layer", t.smallcaps === true && t.underline === true, t);

    /* 5 character styles */
    await p.click("#pcChar #pcyCNew"); await p.waitForTimeout(200);
    const cs = await ev(() => JSON.parse(localStorage.getItem("kx.t.cstyles") || "[]"));
    t = await txt();
    check("Character Styles ＋: a style from the text (font, size, scales, faux bold, small caps ...), the text uses it", cs.length === 1 && cs[0].props.hscale === 150 && cs[0].props.fauxBold === true && t.cstyle === cs[0].name, [cs, t.cstyle]);
    // a second text, the style applied to it
    await ev(() => { const E = window.imageEditorInstance.E, S = E.S, D = E.D; const L = E.makeLayer("Text 2", S.w, S.h, "text"); L.text = Object.assign({}, D.TEXT_DEFAULT, { str: "Second", x: 400, y: 380, size: 30 }); D.rasterize(L); E.addLayer(L, "text", false); });
    await tab("pcChar"); await p.click('#pcChar [data-ci="0"]'); await p.waitForTimeout(200);
    t = await txt();
    check("...a click applies it to another text (its settings, its name on the layer)", t.str === "Second" && t.hscale === 150 && t.fauxBold === true && t.smallcaps === true && t.cstyle === cs[0].name, t);
    await p.fill("#pcChar #pcySize", "40"); await p.dispatchEvent("#pcChar #pcySize", "change"); await p.waitForTimeout(150);
    const plus = await ev(() => /\+/.test(document.querySelector("#pcChar .pcty").textContent.split("Character Styles")[1].slice(0, 40)));
    await p.click("#pcChar #pcyCClear"); await p.waitForTimeout(150);
    t = await txt();
    check("...an override shows + ; Clear Override puts the style back (size)", plus && t.size === cs[0].props.size, [plus, t.size]);
    await p.fill("#pcChar #pcyVS", "130"); await p.dispatchEvent("#pcChar #pcyVS", "change"); await p.click("#pcChar #pcyCRedef"); await p.waitForTimeout(250);
    const both = await ev(() => window.imageEditorInstance.state.layers.filter((x) => x.type === "text").map((x) => x.text.vscale));
    check("...Redefine: every text with that style follows (vertical scale 130 on both)", both.length === 2 && both.every((v) => v === 130), both);

    /* 6 paragraph styles + point / paragraph conversion */
    await ev(() => { const S = window.imageEditorInstance.state; S.active = S.layers.findIndex((x) => x.text && x.text.box); window.imageEditorInstance.E.renderLayersPanel(); });
    await tab("pcPara"); await p.click("#pcPara #pcyPNew"); await p.waitForTimeout(150);
    await ev(() => { const S = window.imageEditorInstance.state; S.active = S.layers.findIndex((x) => x.text && x.text.str === "Second"); window.imageEditorInstance.E.renderLayersPanel(); });
    await tab("pcPara"); await p.click('#pcPara [data-pi="0"]'); await p.waitForTimeout(150);
    t = await txt();
    check("Paragraph Styles: made from the paragraph text, applied to the other (justify, indents)", t.justify === "left" && t.indL === 20 && t.indF === 30 && /^Paragraph Style/.test(t.pstyle), t);
    await ev(() => window.imageEditorInstance.E.ui.run("type.para")); await p.waitForTimeout(150);
    t = await txt();
    const pb = !!t.box;
    await ev(() => window.imageEditorInstance.E.ui.run("type.point")); await p.waitForTimeout(150);
    t = await txt();
    check("Layer ▸ Type: Convert to Paragraph Text / Convert to Point Text", pb && !t.box && t.str === "Second", [pb, t]);

    /* 7 undo, Image Size */
    const nU = await ev(() => window.imageEditorInstance.state.undo.length);
    check("every change was an undo step", nU >= 12, nU);
    await ev(() => { const S = window.imageEditorInstance.state; S.active = S.layers.findIndex((x) => x.text && x.text.box); });
    const b0 = (await txt()).box;
    await ev(() => window.imageEditorInstance.E.ui.run("image.size")); await p.waitForTimeout(200);
    await p.fill(".kxdlg.pcd #pdW", "1400"); await p.fill(".kxdlg.pcd #pdH", "1000"); await p.click(".kxdlg.pcd .ok"); await p.waitForTimeout(500);
    await ev(() => { const S = window.imageEditorInstance.state; S.active = S.layers.findIndex((x) => x.text && x.text.box); });
    t = await txt();
    check("Image Size ×2: the paragraph box, indents and size double with it", t.box && Math.round(t.box.w) === b0.w * 2 && Math.round(t.indL) === 40 && Math.round(t.size) === 48, [t.box, t.indL, t.size]);

    check("no page errors", errs.length === 0, errs);
  } catch (e) {
    fail++; console.log("FAIL: the run stopped: " + (e && e.stack || e));
  } finally { await b.close(); }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
