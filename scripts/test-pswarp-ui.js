#!/usr/bin/env node
/* bitGen Studio — 2.422.0 in a REAL browser: SMART OBJECTS + SMART FILTERS, SKEW / DISTORT / PERSPECTIVE / WARP,
 * PUPPET WARP, CONTENT-AWARE SCALE, LIQUIFY (ext/imageeditdock/pcsmart.js, pcwarp.js, pcmesh.js) - gaps 2 + 3.
 * Tim (verbatim): "can we close the gap with 1,2,3,4 and 5 first"
 * Against the running app (H3_URL, default the e2e server on :8311). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the smart objects / transforms browser test did not run"); process.exit(0); }
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
  p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  try {
    try { await fetch(URL_ + "api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docks: { imageeditdock: { state: "open", hidden: false, maximized: false } } }) }); } catch { /* older */ }
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.smart && window.imageEditorInstance.E.warp, null, { timeout: 60000 });
    await p.waitForTimeout(1000);
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await p.click("#kxFull"); await p.waitForTimeout(900);
    await ev(() => { const E = window.imageEditorInstance.E; E.setBg("#ffffff"); E.setFg("#ff0000"); });
    await p.click('#pcMenus .mi[data-menu="File"]'); await p.waitForTimeout(120); await p.click('.kxmenu [data-cmd="file.new"]'); await p.waitForTimeout(200);
    await p.fill(".kxdlg.pcd #pdW", "600"); await p.fill(".kxdlg.pcd #pdH", "400"); await p.click(".kxdlg.pcd .ok"); await p.waitForTimeout(400);
    const T = async (x, y) => { const v = await ev(() => { const s = window.imageEditorInstance.state; return { z: s.zoom, x: s.panX, y: s.panY }; }); const r = await p.locator("#ieStage").boundingBox(); return [r.x + v.x + x * v.z, r.y + v.y + y * v.z]; };
    const drag = async (x0, y0, x1, y1, mods, steps) => { await p.waitForTimeout(120); const [a, c] = await T(x0, y0), [d, e] = await T(x1, y1); for (const m of mods || []) await p.keyboard.down(m); await p.mouse.move(a, c); await p.mouse.down(); await p.mouse.move(d, e, { steps: steps || 8 }); await p.mouse.up(); for (const m of mods || []) await p.keyboard.up(m); await p.waitForTimeout(100); };
    const click = async (x, y, mods) => { await p.waitForTimeout(120); const [a, c] = await T(x, y); for (const m of mods || []) await p.keyboard.down(m); await p.mouse.click(a, c); for (const m of mods || []) await p.keyboard.up(m); await p.waitForTimeout(80); };
    const key = async (k) => { await p.locator("#ieStage").focus(); await p.keyboard.press(k); await p.waitForTimeout(120); };
    const st = () => ev(() => { const s = window.imageEditorInstance.state, L = s.layers[s.active]; return { n: s.layers.length, tool: s.tool, undo: s.undo.length, type: L && L.type, name: L && L.name,
      smart: L && L.smart ? JSON.parse(JSON.stringify(L.smart)) : null, fmask: !!(L && L.fmask), names: s.layers.map((x) => x.type + ":" + x.name) }; });
    const lpx = (x, y) => ev(([x, y]) => { const s = window.imageEditorInstance.state, L = s.layers[s.active]; return Array.from(L.canvas.getContext("2d").getImageData(x, y, 1, 1).data); }, [x, y]);
    const count = (x0, y0, x1, y1, f) => ev(([a, b2, c, d, fs]) => { const s = window.imageEditorInstance.state, L = s.layers[s.active]; const D = L.canvas.getContext("2d").getImageData(a, b2, c - a, d - b2).data; const fn = new Function("r", "g", "b", "a", "return " + fs); let n = 0; for (let i = 0; i < D.length; i += 4) if (fn(D[i], D[i + 1], D[i + 2], D[i + 3])) n++; return n; }, [x0, y0, x1, y1, f]);
    const layerData = () => ev(() => { const s = window.imageEditorInstance.state, L = s.layers[s.active]; return Array.from(L.canvas.getContext("2d").getImageData(0, 0, s.w, s.h).data); });

    /* a layer with a fine checkerboard square (sharp detail: any resampling would blur it) */
    await ev(() => { const E = window.imageEditorInstance.E; E.newLayer(); const L = E.layer(), g = L.canvas.getContext("2d"); for (let y = 100; y < 300; y += 2) for (let x = 200; x < 400; x += 2) { g.fillStyle = ((x + y) / 2) % 2 ? "#ff0000" : "#0000ff"; g.fillRect(x, y, 2, 2); } L.ver++; E.refresh(); });
    const orig = await layerData();

    /* 1 convert */
    const u0 = (await st()).undo;
    await ev(() => window.imageEditorInstance.E.ui.run("so.convert"));
    let s = await st();
    const thumb = await ev(() => !!document.querySelector("#kxLayers .kxlayer.on canvas.so"));
    check("Layer ▸ Smart Objects ▸ Convert to Smart Object: the layer becomes a smart object (its contents = the 200 × 200 content, its quad there), ▣ thumbnail, one undo step",
      s.type === "smart" && s.smart.w === 200 && s.smart.h === 200 && JSON.stringify(s.smart.t.quad) === "[[200,100],[400,100],[400,300],[200,300]]" && thumb && s.undo === u0 + 1, { s, thumb });
    const same = (a, c) => { let d = 0; for (let i = 0; i < a.length; i++) if (Math.abs(a[i] - c[i]) > 2) d++; return d; };
    check("...it looks exactly as before", same(orig, await layerData()) === 0);

    /* 2 Ctrl+T: scale down to a quarter and back - nothing lost */
    await key("Control+t");
    s = await st();
    check("Ctrl+T on a smart object opens the transform (quad handles)", s.tool === "qxform", s.tool);
    await drag(400, 300, 250, 150); await key("Enter");
    s = await st();
    const small = s.smart.t.quad;
    check("...dragging the bottom-right corner scales it (the top-left stays) - one undo step", JSON.stringify(small[0]) === "[200,100]" && Math.abs(small[2][0] - 250) < 2 && Math.abs(small[2][1] - 150) < 2, small);
    await key("Control+t"); await drag(250, 150, 400, 300); await key("Enter");
    const back = await layerData();
    check("...scaled back up it is as sharp as the original (re-drawn from the contents: the 2-px checkerboard intact)", same(orig, back) < 400, same(orig, back));

    /* 3 perspective + warp */
    await ev(() => window.imageEditorInstance.E.warp.startQ("perspective"));
    await drag(200, 100, 260, 100); await key("Enter");
    s = await st();
    const q = s.smart.t.quad;
    check("Edit ▸ Transform: Perspective - the top-left corner moved in and its partner (top-right) mirrored it: a trapezoid", Math.abs(q[0][0] - 260) < 2 && Math.abs(q[1][0] - 340) < 2 && q[2][0] === 400 && q[3][0] === 200, q);
    const corner = await lpx(215, 105), mid = await lpx(300, 200);
    check("...drawn in perspective (the old top-left corner is empty now, the middle still the pattern)", corner[3] === 0 && mid[3] > 200, { corner, mid });
    await key("Control+z");
    await ev(() => window.imageEditorInstance.E.warp.startQ("warp"));
    await ev(() => { const o = document.querySelector("#xfWS"); o.value = "arc"; o.dispatchEvent(new Event("change")); });
    const lifted = await lpx(300, 80);
    await key("Enter");
    s = await st();
    check("Warp with the Arc preset: the top middle bulges up over the old top edge; the warp is kept on the smart object (16 points)", lifted[3] > 200 && s.smart.t.warp && s.smart.t.warp.length === 16, { lifted, w: s.smart.t.warp && s.smart.t.warp.length });
    await key("Control+z");

    /* 4 smart filters */
    await ev(() => window.imageEditorInstance.E.openFilter("gaussian"));
    await p.waitForTimeout(400);
    const dlg = await ev(() => !!document.querySelector(".kxdlg.pcd #pcSfParams"));
    await ev(() => document.querySelector(".kxdlg.pcd .ok").click()); await p.waitForTimeout(300);
    s = await st();
    const blurred = await layerData();
    const rows = await ev(() => [...document.querySelectorAll("#kxLayers .sfrow, #kxLayers .sfitem")].map((r) => r.textContent.trim()));
    check("Filter ▸ Gaussian Blur on a smart object = a SMART filter (its own dialog), a filter mask, rows under the layer: Smart Filters + Gaussian Blur",
      dlg && s.smart.filters.length === 1 && s.smart.filters[0].id === "gaussian" && s.fmask && rows.length === 2 && /Smart Filters/.test(rows[0]) && /Gaussian/.test(rows[1]) && same(orig, blurred) > 1000, { dlg, f: s.smart.filters, rows });
    await ev(() => document.querySelector("#kxLayers .sfitem .eye").click()); await p.waitForTimeout(200);
    const off = await layerData();
    await ev(() => document.querySelector("#kxLayers .sfitem .eye").click()); await p.waitForTimeout(200);
    check("...its eye turns it off (the original pixels) and on again", same(orig, off) === 0 && same(blurred, await layerData()) === 0);
    // the filter mask: black on the left half hides the blur there
    await ev(() => { const r = document.querySelector("#kxLayers .sfrow canvas.mk"); r.dispatchEvent(new MouseEvent("click", { bubbles: true })); });
    const fm = await ev(() => window.imageEditorInstance.state.fmaskEdit);
    await ev(() => { const E = window.imageEditorInstance.E, S = E.S; E.changeSel(E.P.rectMask(0, 0, 300, S.h, S.w, S.h), "left"); E.fillSelection("#000000", 1, "normal"); E.deselect(); });
    await p.waitForTimeout(200);
    const masked = await layerData();
    const leftSame = await ev(([a, c]) => { const W = 600; let d = 0; for (let y = 100; y < 300; y++) for (let x = 202; x < 296; x++) { const i = (y * W + x) * 4; if (Math.abs(a[i] - c[i]) > 2) d++; } return d; }, [orig, masked]);
    const rightBlur = await ev(([a, c]) => { const W = 600; let d = 0; for (let y = 100; y < 300; y++) for (let x = 304; x < 398; x++) { const i = (y * W + x) * 4; if (Math.abs(a[i] - c[i]) > 2) d++; } return d; }, [orig, masked]);
    check("...the FILTER MASK: a click on its thumbnail paints on it; black on the left half = no blur there, the right half still blurred", fm && leftSame === 0 && rightBlur > 5000, { fm, leftSame, rightBlur });
    await ev(() => { window.imageEditorInstance.E.setActive(window.imageEditorInstance.state.active); });

    /* 5 edit contents (shared by a duplicate) */
    await ev(() => window.imageEditorInstance.E.duplicateLayer());
    const nBefore = (await st()).n;
    await ev(() => window.imageEditorInstance.E.smart.editContents());
    s = await st();
    const ban = await ev(() => !!document.querySelector("#pcSoBanner"));
    const inner = await ev(() => ({ w: window.imageEditorInstance.state.w, h: window.imageEditorInstance.state.h }));
    check("Edit Contents (double-click the thumbnail): the INSIDE opens - its own 200 × 200 document with the original layer, a ✔ Done / ✕ Cancel banner", ban && inner.w === 200 && inner.h === 200 && s.n === 1 && s.type === "pixel", { ban, inner, s: s.names });
    await ev(() => { const E = window.imageEditorInstance.E; E.setFg("#00ff00"); E.fillSelection("#00ff00", 1, "normal"); });
    await ev(() => document.querySelector("#pcSoDone").click()); await p.waitForTimeout(300);
    s = await st();
    const g1 = await lpx(350, 200);
    const other = await ev(() => { const S = window.imageEditorInstance.state, L = S.layers[S.active - 1]; return Array.from(L.canvas.getContext("2d").getImageData(350, 200, 1, 1).data); });
    check("...✔ Done: back in the picture (same layers), the smart object AND its duplicate show the new contents (green)", s.n === nBefore && g1[1] > 150 && other[1] > 150 && !(await ev(() => !!document.querySelector("#pcSoBanner"))), { n: s.n, nBefore, g1, other });
    await key("Control+z");
    const red = await lpx(350, 200);
    check("...Ctrl+Z gives the old contents back", red[1] < 100, red);

    /* 6 via copy is independent; convert to layers; rasterize */
    await ev(() => window.imageEditorInstance.E.ui.run("so.copy"));
    const srcs = await ev(() => window.imageEditorInstance.state.layers.filter((L) => L.type === "smart").map((L) => L.smart.src));
    check("New Smart Object via Copy: its own contents (a different source from the original's)", srcs.length === 3 && new Set(srcs).size === 2, srcs);
    await ev(() => { const E = window.imageEditorInstance.E, S = E.S; E.newLayer(); const L = E.layer(); L.canvas.getContext("2d").fillStyle = "#123456"; L.canvas.getContext("2d").fillRect(20, 20, 50, 40); L.ver++; E.refresh(); E.ui.run("so.convert"); });
    await ev(() => window.imageEditorInstance.E.ui.run("so.layers"));
    s = await st();
    const grp = await ev(() => { const S = window.imageEditorInstance.state, g = S.layers[S.active], kids = S.layers.filter((x) => x.parent === g.id); return { type: g.type, kids: kids.length, px: Array.from(kids[0].canvas.getContext("2d").getImageData(30, 30, 1, 1).data) }; });
    check("Convert to Layers: the inside back in the picture as a group, at its place", grp.type === "group" && grp.kids === 1 && grp.px[2] === 0x56, grp);
    await ev(() => { const E = window.imageEditorInstance.E, S = E.S; E.setActive(S.layers.findIndex((L) => L.type === "smart")); E.ui.run("so.raster"); });
    s = await st();
    check("Smart Objects: Rasterize - a plain pixel layer again", s.type === "pixel" && !s.smart, s.type);

    /* 7 the move tool and Image Size move the transform */
    await ev(() => { const E = window.imageEditorInstance.E, S = E.S; E.setActive(S.layers.findIndex((L) => L.type === "smart")); E.setTool("move"); });
    const q0 = (await st()).smart.t.quad[0];
    await drag(300, 200, 340, 230);
    const q1 = (await st()).smart.t.quad[0];
    check("the Move tool moves a smart object's quad (40, 30) - re-drawn there", Math.round(q1[0] - q0[0]) === 40 && Math.round(q1[1] - q0[1]) === 30, { q0, q1 });
    await ev(() => window.imageEditorInstance.E.img.size(300, 200));
    const q2 = (await st()).smart.t.quad[0];
    check("Image Size 50 %: the quad halves (the contents keep their pixels)", Math.abs(q2[0] - q1[0] / 2) < 0.6 && Math.abs(q2[1] - q1[1] / 2) < 0.6, { q1, q2 });
    await key("Control+z");

    /* 8 a pixel layer: distort (one undo step) */
    await ev(() => { const E = window.imageEditorInstance.E; E.newLayer(); const L = E.layer(), g = L.canvas.getContext("2d"); g.fillStyle = "#ff00ff"; g.fillRect(100, 100, 100, 100); L.ver++; E.refresh(); E.warp.startQ("distort"); });
    const u8 = (await st()).undo;
    await drag(200, 200, 260, 240); await key("Enter");
    s = await st();
    const stretched = await lpx(240, 225), gone = await count(100, 100, 200, 200, "a > 200");
    check("Distort on a pixel layer: the bottom-right corner dragged out - the pixels follow (one undo step)", stretched[3] > 200 && s.undo === u8 + 1 && gone > 9000, { stretched, u: s.undo, u8, gone });
    await key("Control+z");

    /* 9 puppet warp */
    await ev(() => { const E = window.imageEditorInstance.E, S = E.S; E.newLayer(); const L = E.layer(), g = L.canvas.getContext("2d"); g.fillStyle = "#00aa00"; g.fillRect(100, 280, 400, 30); L.ver++; E.refresh(); E.ui.run("xf.puppet"); });
    await click(110, 295); await click(300, 295); await click(490, 295);
    s = await st();
    await drag(490, 295, 490, 360);
    const pins = await ev(() => (window.imageEditorInstance.E.warp.puppetState() || { pins: [] }).pins.length);
    await key("Enter");
    s = await st();
    const tip = await count(470, 340, 510, 380, "a > 200"), leftEnd = await count(100, 280, 140, 310, "a > 200");
    check("Puppet Warp: three pins on a bar, the right one dragged down - the right end bends down, the left end stays (Enter applies)", pins === 3 && s.tool !== "puppet" && tip > 300 && leftEnd > 1000, { pins, tip, leftEnd, tool: s.tool });

    /* 10 content-aware scale: two textured squares apart on flat grey -> narrower, the squares keep their width */
    await ev(() => { const E = window.imageEditorInstance.E, S = E.S; E.newLayer(); const L = E.layer(), g = L.canvas.getContext("2d"); g.fillStyle = "#808080"; g.fillRect(50, 50, 400, 100);
      for (const ox of [70, 360]) for (let y = 60; y < 140; y += 4) for (let x = ox; x < ox + 60; x += 4) { g.fillStyle = (x + y) % 8 ? "#ffcc00" : "#0033cc"; g.fillRect(x, y, 4, 4); } L.ver++; E.refresh(); });
    await ev(() => window.imageEditorInstance.E.warp.runCas(window.imageEditorInstance.E.layer(), { x: 50, y: 50, w: 400, h: 100 }, 70, 100, false, "tl"));
    await p.waitForTimeout(3500);
    const yellow = await count(0, 0, 600, 400, "r > 200 && g > 150 && b < 80"), wide = await ev(() => window.imageEditorInstance.E.alphaBox(window.imageEditorInstance.E.layer().canvas));
    check("Content-Aware Scale to 70 % wide: the layer is 280 px wide, both textured squares kept (the grey between them went)", wide && wide.w === 280 && yellow > 2 * 60 * 80 * 0.4, { wide, yellow });
    const casDlg = await ev(() => { window.imageEditorInstance.E.warp.cas(); const d = document.querySelector(".kxdlg.pcd #casPv"); const ok = !!d; document.querySelector(".kxdlg.pcd .cn").click(); return ok; });
    check("...Edit ▸ Content-Aware Scale… opens its dialog with a live preview", casDlg);

    /* 11 liquify */
    await ev(() => { const E = window.imageEditorInstance.E; E.newLayer(); const L = E.layer(), g = L.canvas.getContext("2d"); g.fillStyle = "#ff8800"; g.fillRect(250, 150, 100, 100); L.ver++; E.refresh(); E.warp.liquify(); });
    await p.waitForTimeout(400);
    const lq = await ev(() => !!document.querySelector("#pcLiquify #lqCv"));
    const box = await p.locator("#lqCv").boundingBox(), sz = await ev(() => { const s2 = window.imageEditorInstance.E.liquifyState(); return { pw: s2.pw, ph: s2.ph }; });
    const at = (x, y) => [box.x + x / 600 * box.width, box.y + y / 400 * box.height];
    await p.mouse.move(...at(345, 200)); await p.mouse.down(); for (let i = 1; i <= 12; i++) await p.mouse.move(...at(345 + i * 6, 200)); await p.mouse.up();
    await p.click("#lqOk"); await p.waitForTimeout(300);
    const pushed = await lpx(395, 200), still = await lpx(300, 200);
    check("Filter ▸ Liquify…: its own window; Forward Warp dragged right from the square's edge pushes orange out to the right (OK applies)", lq && pushed[0] > 200 && pushed[3] > 200 && still[0] > 200 && !(await ev(() => !!document.querySelector("#pcLiquify"))), { lq, pushed, still, sz });
    await ev(() => { const E = window.imageEditorInstance.E; E.ui.run("so.convert"); E.warp.liquify(); });
    await p.waitForTimeout(300);
    await p.mouse.move(...at(250, 200)); await p.mouse.down(); for (let i = 1; i <= 8; i++) await p.mouse.move(...at(250 - i * 6, 200)); await p.mouse.up();
    await p.click("#lqOk"); await p.waitForTimeout(300);
    s = await st();
    check("...on a smart object Liquify is a SMART filter (in the list, editable again)", s.type === "smart" && s.smart.filters.length === 1 && s.smart.filters[0].id === "liquify", s.smart && s.smart.filters);

    check("no page errors", errs.length === 0, errs);
  } catch (e) {
    fail++; console.log("FAIL: the test crashed - " + (e && e.stack || e));
  } finally { await b.close(); }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
