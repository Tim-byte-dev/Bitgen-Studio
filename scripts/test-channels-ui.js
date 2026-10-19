#!/usr/bin/env node
/* bitGen Studio — 2.467.0 in a REAL browser: CHANNEL EDITING + SPOT CHANNELS (pcchannels.js, the Channels panel in
 * pcrefine.js, imageedit.js endPx) - Red clicked: a stroke changes only red; Shift-click Green; Ctrl+5 / Ctrl+2; a spot
 * channel from a selection, painted (✎ / ✔), merged.
 * Tim: "continue with the photoshop gap closure. add cad tools, create sketch layers for cad in image editor".
 * Against the running app (H3_URL, default the e2e server on :8311). No Playwright = SKIP. SHOTS=<dir> keeps pictures. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the channels browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const SHOTS = process.env.SHOTS || "";
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
  const shot = async (n) => { if (SHOTS) await p.screenshot({ path: path.join(SHOTS, n + ".png") }); };
  try {
    try { await fetch(URL_ + "api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docks: { imageeditdock: { state: "open", hidden: false, maximized: false } } }) }); } catch { /* older */ }
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.refine, null, { timeout: 60000 });
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
    const pxAt = (x, y) => ev(([x, y]) => { const s = window.imageEditorInstance.state, L = s.layers[s.active]; return Array.from(L.canvas.getContext("2d").getImageData(x, y, 1, 1).data); }, [x, y]);
    await ev(() => { const E = window.imageEditorInstance.E; E.newLayer(); const L = E.layer(), g = L.canvas.getContext("2d"); g.fillStyle = "#808080"; g.fillRect(0, 0, 600, 400); L.ver++; E.refresh(); E.ui.showTab("pcChannels"); });
    await p.waitForTimeout(300);

    /* 1 the Red channel clicked: only red changes when painting white */
    await p.click('#pcChannels [data-ch="r"]'); await p.waitForTimeout(150);
    const t1 = await ev(() => [window.imageEditorInstance.E.refine.target(), window.imageEditorInstance.E.refine.view()]);
    check("Channels ▸ Red clicked: red is the edited channel (and shown in grey)", t1[0] === "r" && t1[1] === "r", t1);
    await ev(() => { const E = window.imageEditorInstance.E; E.setFg("#ffffff"); E.setTool("paint"); E.S.size = 30; });
    await drag(100, 100, 220, 100); await p.waitForTimeout(200);
    const p1 = await pxAt(160, 100), out1 = await pxAt(160, 200);
    check("a white brush stroke on the Red channel: red 255, green + blue still 128; the rest untouched", p1[0] === 255 && p1[1] === 128 && p1[2] === 128 && out1[0] === 128, { p1, out1 });

    /* 2 Shift-click Green: red + green edited (shown in colour without blue); a black stroke */
    await p.click('#pcChannels [data-ch="g"]', { modifiers: ["Shift"] }); await p.waitForTimeout(150);
    const t2 = await ev(() => [window.imageEditorInstance.E.refine.target(), window.imageEditorInstance.E.refine.view()]);
    await ev(() => window.imageEditorInstance.E.setFg("#000000"));
    await drag(100, 160, 220, 160); await p.waitForTimeout(200);
    const p2 = await pxAt(160, 160);
    check("Shift-click Green: R + G edited (the view drops blue); a black stroke = (0, 0, 128)", t2[0] === "rg" && t2[1] === "t:rg" && p2[0] === 0 && p2[1] === 0 && p2[2] === 128, { t2, p2 });

    /* 3 Ctrl+5 = Blue only: a fill (pxOp) changes only blue */
    await ev(() => window.imageEditorInstance.E.ui.run("ch.view.b"));
    await ev(() => window.imageEditorInstance.E.pxOp("fill test", (c, g) => { g.fillStyle = "#ffffff"; g.fillRect(400, 300, 50, 50); }));
    const p3 = await pxAt(420, 320);
    check("Channel: Blue (Ctrl+5) - a fill changes only blue: (128, 128, 255)", JSON.stringify(p3.slice(0, 3)) === "[128,128,255]", p3);
    await ev(() => window.imageEditorInstance.E.ui.run("ch.view.rgb"));
    await ev(() => window.imageEditorInstance.E.pxOp("fill test 2", (c, g) => { g.fillStyle = "#ffffff"; g.fillRect(400, 300, 10, 10); }));
    const p4 = await pxAt(402, 302);
    check("RGB (Ctrl+2): every channel again", JSON.stringify(p4.slice(0, 3)) === "[255,255,255]" && (await ev(() => window.imageEditorInstance.E.refine.target())) === "rgb", p4);

    /* 4 a SPOT channel from a selection; painted more; merged */
    await ev(() => { const E = window.imageEditorInstance.E; E.changeSel(E.P.rectMask(300, 50, 400, 120, 600, 400), "for the spot"); });
    await p.click("#chSpotB"); await p.waitForSelector(".kxdlg.pcd #spN");
    await p.fill(".kxdlg.pcd #spN", "Varnish"); await ev(() => { const i = document.querySelector(".kxdlg.pcd #spC"); i.value = "#00a0ff"; }); await p.fill(".kxdlg.pcd #spS", "100"); await p.click(".kxdlg.pcd .ok"); await p.waitForTimeout(250);
    const sp = await ev(() => { const c = window.imageEditorInstance.state.channels.find((x) => x.spot); return c ? { id: c.id, name: c.name, spot: c.spot, inside: c.data[80 * 600 + 350], outside: c.data[200 * 600 + 350], row: !!document.querySelector('#pcChannels [data-spot="1"]') } : null; });
    check("◍ New Spot Channel (the selection as its ink): Varnish, #00a0ff, solidity 100, a row with its swatch", sp && sp.name === "Varnish" && sp.spot.color === "#00a0ff" && sp.inside === 255 && sp.outside === 0 && sp.row, sp);
    await ev(() => window.imageEditorInstance.E.deselect());
    await ev((id) => window.imageEditorInstance.E.refine.pick(id), sp.id); await p.click("#chEditB"); await p.waitForTimeout(150);
    const editing = await ev(() => [window.imageEditorInstance.E.refine.editing(), !!window.imageEditorInstance.state.qm, window.imageEditorInstance.state.tool]);
    await ev(() => { window.imageEditorInstance.E.S.size = 20; });
    const u0 = await ev(() => window.imageEditorInstance.state.undo.length);
    await drag(300, 250, 400, 250); await p.waitForTimeout(150);
    await p.click("#chEditB"); await p.waitForTimeout(250);
    const after = await ev((id) => { const s = window.imageEditorInstance.state, c = s.channels.find((x) => x.id === id); return { painted: c.data[250 * 600 + 350], still: c.data[80 * 600 + 350], qm: !!s.qm, undo: s.undo.length, label: s.undo[s.undo.length - 1].label, sel: s.selCount }; }, sp.id);
    check("✎ paints the spot channel (the brush adds ink), ✔ keeps it - one undo step, the selection untouched", editing[0] === sp.id && editing[1] && editing[2] === "paint" && after.painted > 200 && after.still === 255 && !after.qm && after.undo === u0 + 1 && after.label === "paint channel" && after.sel === 0, { editing, after, u0 });
    await shot("ch-spot");
    const n0 = await ev(() => window.imageEditorInstance.state.layers.length);
    await p.click("#chMergeB"); await p.waitForTimeout(250);
    const mg = await ev(() => { const s = window.imageEditorInstance.state, L = s.layers[s.layers.length - 1]; return { n: s.layers.length, name: L.name, px: Array.from(L.canvas.getContext("2d").getImageData(350, 80, 1, 1).data), spots: s.channels.filter((c) => c.spot).length }; });
    check("⇣ Merge Spot Channel: its ink a layer on top (Varnish, #00a0ff where the ink was), the channel gone", mg.n === n0 + 1 && mg.name === "Varnish" && mg.px[0] === 0 && mg.px[1] === 160 && mg.px[2] === 255 && mg.px[3] === 255 && mg.spots === 0, mg);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: the test crashed - " + e.stack); }
  finally { await b.close(); }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
