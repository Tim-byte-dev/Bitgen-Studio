#!/usr/bin/env node
/* bitGen Studio — 2.608.0 in a REAL browser: SHAPES FILLED WITH TEXT, 5 MORE WARP PRESETS, A WARP GRID ON TEXT / SHAPES.
 * Tim: "can we fill shapes with text, please add 5 more preset warps and an interactive warp grid for text and shapes"
 * (all three kinds of fill; the image editor and the timeline).
 *   image editor  16 warp styles (+ Shell Lower / Upper, Fisheye, Twist, Wedge) in ⌒ Shape / 3D and Transform ▸ Warp;
 *                 Twist / Fisheye bend a text sideways too; ⌗ Warp Grid on a TEXT layer: the grid, a preset, a drag, Enter
 *                 - still a text layer (re-typed: the warp follows), one undo step; on a SHAPE layer the same; 🅰 Fill
 *                 Shape with Text: Repeat (rows, clipped, it stays a shape), Flow (a text layer inside, Fit), Stretch
 *                 (the letters fill the outline top to bottom)
 *   timeline      ⌗ Mesh warp ▸ Preset ▾ (16) on a text / shape layer bends it; a shape layer's Fill ▸ Text (repeat);
 *                 a text layer's 🔤 In a shape: stretch / flow into a shape layer's outline
 * Against the running app (H3_URL, default the e2e server on :8311). No Playwright = SKIP. */
"use strict";
const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.608.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const ROOT = path.join(__dirname, "..");
const P = "zz_ui608_" + process.pid;
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const api = async (u, body) => (await fetch(URL_ + u.replace(/^\//, ""), body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1900, height: 1150 } });
  const errs = []; p.on("pageerror", (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
  p.on("dialog", (d) => { d.accept().catch(() => {}); });
  const ev = (f, a) => p.evaluate(f, a);
  try {
    await api("/api/projects/new", { name: P });
    await api("/api/projects/load", { name: P });
    try { await fetch(URL_ + "api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docks: { imageeditdock: { state: "open", hidden: false, maximized: false } } }) }); } catch { /* older */ }
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.PCLiveWarp && window.PCTextFill && window.H3Warps && window.H3TextFill, null, { timeout: 60000 });
    await p.waitForTimeout(800);
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await p.click("#kxFull"); await p.waitForTimeout(700);
    await p.click('#pcMenus .mi[data-menu="File"]'); await p.waitForTimeout(120); await p.click('.kxmenu [data-cmd="file.new"]'); await p.waitForTimeout(200);
    await p.fill(".kxdlg.pcd #pdW", "800"); await p.fill(".kxdlg.pcd #pdH", "600"); await p.click(".kxdlg.pcd .ok"); await p.waitForTimeout(400);
    // a box of the opaque pixels of a canvas
    const boxJs = `(c) => { const W = c.width, d = c.getContext("2d").getImageData(0, 0, W, c.height).data; let n = 0, x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1; for (let i = 3; i < d.length; i += 4) if (d[i] > 100) { n++; const k = (i - 3) / 4, x = k % W, y = (k - x) / W; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } return { n, x0, x1, y0, y1, w: x1 - x0, h: y1 - y0 }; }`;
    await ev((bj) => { window.__box = eval(bj); }, boxJs);

    /* ================= 1. the warp presets ================= */
    const st = await ev(() => ({ text: PCText.WARPS.map((w) => w[0]), xf: PCMesh.WARP_STYLES.map((w) => w[0]) }));
    check("16 warp presets (+ Shell Lower, Shell Upper, Fisheye, Twist, Wedge) - in ⌒ Shape / 3D and in Transform ▸ Warp",
      st.text.length === 17 && ["shellLower", "shellUpper", "fisheye", "twist", "wedge"].every((k) => st.text.includes(k) && st.xf.includes(k)) && st.xf.length === 17, st);
    const wr = await ev(() => {
      const E = window.imageEditorInstance.E, S = window.imageEditorInstance.state, D = PCDoc, out = {};
      const L = E.makeLayer("W", S.w, S.h, "text");
      L.text = Object.assign({}, D.TEXT_DEFAULT, { str: "TWISTED TEXT", x: 120, y: 240, size: 70, weight: 700, font: "DejaVu Sans", color: "#000000", align: "left" });
      D.rasterize(L); out.plain = __box(L.canvas);
      for (const s of ["shellLower", "shellUpper", "fisheye", "twist", "wedge"]) { L.text.warp = { style: s, bend: 70 }; D.rasterize(L); out[s] = __box(L.canvas); out[s].bx = PCText.box(L.text, L.canvas.getContext("2d")); }
      // the wedge: the ink's height near its left end and near its right end
      const colH = (x0, x1) => { const c = L.canvas, d = c.getContext("2d").getImageData(x0, 0, x1 - x0, c.height).data, w = x1 - x0; let a = 1e9, z = -1; for (let i = 3; i < d.length; i += 4) if (d[i] > 100) { const y = Math.floor((i - 3) / 4 / w); a = Math.min(a, y); z = Math.max(z, y); } return z - a; };
      L.text.warp = { style: "wedge", bend: 70 }; D.rasterize(L); const wb = __box(L.canvas); out.wedge.leftH = colH(wb.x0, wb.x0 + 60); out.wedge.rightH = colH(wb.x1 - 60, wb.x1);
      return out;
    });
    const diff = (a, c) => Math.abs(a.w - c.w) + Math.abs(a.h - c.h) + Math.abs(a.x0 - c.x0) + Math.abs(a.y0 - c.y0);
    check("each new style bends the text its own way (none draws it straight, none loses it)",
      ["shellLower", "shellUpper", "fisheye", "twist", "wedge"].every((s) => wr[s].n > wr.plain.n * 0.5 && (s === "wedge" ? wr.wedge.rightH < wr.wedge.leftH * 0.8 : diff(wr[s], wr.plain) > 12)), wr);
    check("Twist turns the middle (taller than straight), Shell Lower bows the bottom down, Shell Upper the top up, Wedge tapers (shorter on one side)",
      wr.twist.h > wr.plain.h + 20 && wr.shellLower.y1 > wr.plain.y1 + 15 && wr.shellUpper.y0 < wr.plain.y0 - 15 && wr.wedge.h <= wr.plain.h + 4, wr);
    check("…the text's box holds the warped letters (Move tool / hit test)", ["shellLower", "shellUpper", "fisheye", "twist"].every((s) => { const b = wr[s].bx, k = wr[s]; return b.x <= k.x0 + 2 && b.y <= k.y0 + 2 && b.x + b.w >= k.x1 - 2 && b.y + b.h >= k.y1 - 2; }), wr);

    /* ================= 2. ⌗ Warp Grid on a TEXT layer ================= */
    await ev(() => {
      const E = window.imageEditorInstance.E, S = window.imageEditorInstance.state, D = PCDoc;
      const L = E.makeLayer("Grid text", S.w, S.h, "text");
      L.text = Object.assign({}, D.TEXT_DEFAULT, { str: "GRID", x: 200, y: 200, size: 120, weight: 700, font: "DejaVu Sans", color: "#cc0000", align: "left" });
      D.rasterize(L); E.addLayer(L, "t", false); window.__T = L; window.__T0 = __box(L.canvas);
      E.quadTransform("warp");
    });
    await p.waitForTimeout(300);
    const g1 = await ev(() => { const Q = window.imageEditorInstance.E.warp.state(); return { live: Q && Q.live, mode: Q && Q.mode, tool: window.imageEditorInstance.state.tool, modes: [...document.querySelectorAll("[data-xfm]")].map((b) => b.dataset.xfm), ws: !!document.querySelector("#xfWS"), grid: !!document.querySelector("#xfWG") }; });
    check("⌗ Warp Grid on a text layer: the warp grid comes up LIVE (warp only - presets and Grid in the bar)", g1.live && g1.mode === "warp" && g1.tool === "qxform" && g1.modes.join() === "warp" && g1.ws && g1.grid, g1);
    // a preset from the bar, then a drag of a point
    await ev(() => { const s = document.querySelector("#xfWS"); s.value = "twist"; s.dispatchEvent(new Event("change")); });
    await p.waitForTimeout(200);
    const T = async (x, y) => { const v = await ev(() => { const s = window.imageEditorInstance.state; return { z: s.zoom, x: s.panX, y: s.panY }; }); const r = await p.locator("#ieStage").boundingBox(); return [r.x + v.x + x * v.z, r.y + v.y + y * v.z]; };
    const pt = await ev(() => { const Q = window.imageEditorInstance.E.warp.state(); return Q.warp[0]; });
    const [sx, sy] = await T(pt[0], pt[1]), [ex, ey] = await T(pt[0] - 60, pt[1] - 50);
    await p.mouse.move(sx, sy); await p.mouse.down(); await p.mouse.move((sx + ex) / 2, (sy + ey) / 2, { steps: 4 }); await p.mouse.move(ex, ey, { steps: 4 }); await p.mouse.up();
    await p.waitForTimeout(200);
    await p.keyboard.press("Enter"); await p.waitForTimeout(300);
    const g2 = await ev(() => { const L = window.__T; return { type: L.type, mesh: !!(L.text && L.text.mesh), n: L.text.mesh ? L.text.mesh.P.length : 0, G: L.text.mesh && L.text.mesh.G, b: __box(L.canvas), tool: window.imageEditorInstance.state.tool, Q: !!window.imageEditorInstance.E.warp.state() }; });
    check("…Twist + a corner dragged up-left, Enter: still a TEXT layer, its grid kept on it (text.mesh), the picture bent past where it was", g2.type === "text" && g2.mesh && g2.n >= 16 && !g2.Q && g2.b.y0 < (await ev(() => __T0.y0)) - 20, g2);
    const g3 = await ev(() => { const E = window.imageEditorInstance.E, L = window.__T, w0 = __box(L.canvas).w; E.setLayer(L, "retype", (x) => { x.text.str = "GRID WARP"; }); const b1 = __box(L.canvas); const bx = PCDoc.textBox(L.text, L.canvas.getContext("2d")); return { w0, w1: b1.w, mesh: !!L.text.mesh, bx, b1 }; });
    check("…re-typed (GRID → GRID WARP): the warp follows the longer text (wider, still warped); the text's box is the warped one", g3.mesh && g3.w1 > g3.w0 * 1.4 && g3.bx.x <= g3.b1.x0 + 3 && g3.bx.x + g3.bx.w >= g3.b1.x1 - 3, g3);
    const g4 = await ev(() => { const E = window.imageEditorInstance.E; E.undo(); const a = !!window.imageEditorInstance.state.layers.find((x) => x.id === __T.id).text.mesh; E.undo(); const L = window.imageEditorInstance.state.layers.find((x) => x.id === __T.id); return { afterRetypeUndo: a, afterWarpUndo: !!L.text.mesh }; });
    check("…undo: one step takes the re-type back, the next the whole warp", g4.afterRetypeUndo === true && g4.afterWarpUndo === false, g4);

    /* ================= 3. a SHAPE layer: the grid, the text fill ================= */
    await ev(() => {
      const E = window.imageEditorInstance.E, S = window.imageEditorInstance.state, D = PCDoc;
      S.layers.filter((x) => x.type === "text").forEach((x) => { x.visible = false; });
      const L = E.makeLayer("Ellipse", S.w, S.h, "shape");
      L.shape = Object.assign({}, D.SHAPE_DEFAULT, { kind: "ellipse", x: 200, y: 150, w: 400, h: 300, fill: "#2050c0", fillOn: true });
      D.rasterize(L); E.addLayer(L, "shape", false); window.__S = L; window.__S0 = __box(L.canvas);
      E.setTool("shape"); E.renderOptions();
    });
    await p.waitForTimeout(250);
    const sb = await ev(() => ({ fill: !!document.querySelector("#ptSTextFill"), warp: !!document.querySelector("#ptSWarp") }));
    check("the Shape tool's bar (a shape picked): 🅰 Fill with Text… and ⌗ Warp Grid", sb.fill && sb.warp, sb);
    await p.click("#ptSWarp"); await p.waitForTimeout(200);
    await ev(() => { const s = document.querySelector("#xfWS"); s.value = "arc"; document.querySelector("#xfWB").value = 60; s.dispatchEvent(new Event("change")); });
    await p.waitForTimeout(150); await p.keyboard.press("Enter"); await p.waitForTimeout(250);
    const s1 = await ev(() => ({ type: __S.type, mesh: !!__S.shape.mesh, b: __box(__S.canvas), b0: __S0, tool: window.imageEditorInstance.state.tool }));
    check("⌗ Warp Grid on the shape (Arc 60): still a SHAPE layer with its grid, the ellipse bent up past its old box", s1.type === "shape" && s1.mesh && s1.b.y0 < s1.b0.y0 - 20 && s1.tool === "shape", s1);
    await ev(() => { const E = window.imageEditorInstance.E; E.setLayer(__S, "colour", (x) => { x.shape.fill = "#20a050"; }); });
    const s2 = await ev(() => { const d = __S.canvas.getContext("2d").getImageData(400, 300, 1, 1).data; return { rgb: [d[0], d[1], d[2]], mesh: !!__S.shape.mesh, b: __box(__S.canvas) }; });
    check("…its colour changed afterwards: the new colour, still warped", s2.mesh && s2.rgb[1] > 120 && s2.rgb[2] < 120 && s2.b.w === s1.b.w, s2);
    await ev(() => { const E = window.imageEditorInstance.E; E.setLayer(__S, "unwarp", (x) => { delete x.shape.mesh; }); });

    // 🅰 Repeat
    await ev(() => { const E = window.imageEditorInstance.E; E.setTool("shape"); E.renderOptions(); });
    await p.click("#ptSTextFill"); await p.waitForSelector(".kxdlg.pcd #tfMode");
    const dl = await ev(() => ({ modes: [...document.querySelectorAll("#tfMode option")].map((o) => o.value + (o.disabled ? "-" : "")), fonts: !!document.querySelector("#tfFont optgroup.h3f-more") || [...document.querySelectorAll("#tfFont option")].length }));
    check("🅰 Fill Shape with Text…: Flow inside / Stretch to fill / Repeat as fill, the fonts (every one on this computer)", dl.modes.join() === "flow,stretch,repeat", dl);
    // 2.608.0 (Tim: "make the font in the fonts dropdown the same font as the name for easy preview")
    await p.waitForFunction(() => document.querySelector("#tfFont optgroup.h3f-more"), null, { timeout: 10000 }).catch(() => {});
    const fp = await ev(() => { const s = document.querySelector("#tfFont"), o = [...s.options].find((x) => /DejaVu Serif/.test(x.value)); return { opt: o && o.style.fontFamily, sel: s.style.fontFamily, val: s.value }; });
    await p.locator("#tfFont").dispatchEvent("mousedown", { button: 0 }); await p.waitForTimeout(250);
    const rows = await ev(() => { const r = [...document.querySelectorAll(".selsearch .ssrow")].map((x) => ({ t: x.textContent.replace("✓ ", ""), f: x.querySelector(".t").style.fontFamily })); return { n: r.length, dv: r.find((x) => /DejaVu Serif/.test(x.t)), arial: r.find((x) => x.t === "Arial") }; });
    await p.keyboard.press("Escape"); await p.waitForTimeout(150);
    check("font lists preview each font: every name written in its own font (the searchable list's rows and the plain options), the list itself in the picked font",
      /DejaVu Serif/.test(fp.opt || "") && fp.sel.includes(fp.val) && rows.n > 10 && rows.dv && /DejaVu Serif/.test(rows.dv.f) && rows.arial && /Arial/.test(rows.arial.f), { fp, rows });
    await ev(() => { const d = document.querySelector(".kxdlg.pcd"); d.querySelector("#tfMode").value = "repeat"; d.querySelector("#tfMode").dispatchEvent(new Event("change")); d.querySelector("#tfStr").value = "HELLO"; d.querySelector("#tfSize").value = 22; d.querySelector("#tfCol").value = "#ffff00"; d.querySelector("#tfAngN").value = 20; d.querySelector("#tfBg").checked = true; });
    await p.click(".kxdlg.pcd .ok"); await p.waitForTimeout(300);
    const r1 = await ev(() => {
      const c = __S.canvas, g = c.getContext("2d"), d = g.getImageData(0, 0, c.width, c.height).data, W = c.width; let yel = 0, out = 0, blue = 0;
      for (let i = 0; i < d.length; i += 4) { const k = i / 4, x = k % W, y = (k - x) / W, inside = ((x - 400) / 200) ** 2 + ((y - 300) / 150) ** 2 < 0.96, outside = ((x - 400) / 200) ** 2 + ((y - 300) / 150) ** 2 > 1.05;
        if (d[i] > 200 && d[i + 1] > 200 && d[i + 2] < 90 && d[i + 3] > 200) { if (inside) yel++; if (outside) out++; } if (inside && d[i + 1] > 120 && d[i + 2] < 120 && d[i] < 80) blue++; }
      return { yel, out, blue, tfill: __S.shape.tfill, type: __S.type };
    });
    check("…Repeat: yellow HELLO rows inside the ellipse only (none outside), its colour still behind, it stays a shape (shape.tfill)", r1.type === "shape" && r1.tfill && r1.tfill.str === "HELLO" && r1.yel > 2000 && r1.out === 0 && r1.blue > 5000, { yel: r1.yel, out: r1.out, blue: r1.blue });

    // 🅰 Flow
    await ev(() => window.imageEditorInstance.E.textFillDialog(__S)); await p.waitForSelector(".kxdlg.pcd #tfMode");
    await ev(() => { const d = document.querySelector(".kxdlg.pcd"); d.querySelector("#tfMode").value = "flow"; d.querySelector("#tfMode").dispatchEvent(new Event("change")); d.querySelector("#tfStr").value = "Words flow inside the round shape line by line and fill it from the top to the bottom nicely"; d.querySelector("#tfFit").checked = true; d.querySelector("#tfCol").value = "#000000"; });
    await p.click(".kxdlg.pcd .ok"); await p.waitForTimeout(400);
    const f1 = await ev(() => { const S = window.imageEditorInstance.state, L = S.layers[S.active]; const lay = window.imageEditorInstance.E.type.layout(L.text); return { type: L.type, area: !!L.text.area, size: L.text.size, over: lay.overflow, lines: lay.lines.length, b: __box(L.canvas), widths: lay.lines.map((l) => Math.round(l.w)) }; });
    check("…Flow (Fit): a text layer flowing INSIDE the ellipse - every word in, sized up to fill it, the middle lines wider than the top / bottom ones",
      f1.type === "text" && f1.area && !f1.over && f1.size > 20 && f1.lines >= 4 && f1.b.x0 >= 195 && f1.b.x1 <= 605 && f1.b.y0 >= 145 && f1.b.y1 <= 455 && Math.max(...f1.widths) > f1.widths[0] + 30, f1);

    // 🅰 Stretch
    await ev(() => { const S = window.imageEditorInstance.state; S.layers.forEach((x) => { if (x.type === "text") x.visible = false; }); window.imageEditorInstance.E.setActive(S.layers.indexOf(__S)); window.imageEditorInstance.E.textFillDialog(__S); });
    await p.waitForSelector(".kxdlg.pcd #tfMode");
    await ev(() => { const d = document.querySelector(".kxdlg.pcd"); d.querySelector("#tfMode").value = "stretch"; d.querySelector("#tfMode").dispatchEvent(new Event("change")); d.querySelector("#tfStr").value = "OVAL"; d.querySelector("#tfCol").value = "#ff00ff"; d.querySelector("#tfHide").checked = true; });
    await p.click(".kxdlg.pcd .ok"); await p.waitForTimeout(400);
    const e1 = await ev(() => { const S = window.imageEditorInstance.state, L = S.layers[S.active]; const c = L.canvas, d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
      const span = (xa, xb) => { let a = 1e9, z = -1; for (let y = 0; y < c.height; y++) for (let x = xa; x < xb; x++) if (d[(y * c.width + x) * 4 + 3] > 100) { a = Math.min(a, y); z = Math.max(z, y); } return z - a; };
      return { type: L.type, env: !!L.text.env, b: __box(c), shapeHidden: __S.visible === false, mid: span(380, 420), edge: span(204, 224) }; });
    check("…Stretch: a text layer whose letters fill the oval top to bottom (its box = the ellipse's), the shape hidden",
      e1.type === "text" && e1.env && e1.shapeHidden && Math.abs(e1.b.x0 - 200) <= 6 && Math.abs(e1.b.x1 - 600) <= 6 && Math.abs(e1.b.y0 - 150) <= 8 && Math.abs(e1.b.y1 - 450) <= 8, e1);
    check("…the letters follow the outline: tall in the middle, short near the ends", e1.mid > 250 && e1.edge < e1.mid * 0.6, e1);
    await ev(() => { const k = document.getElementById("kxFull"); if (k) k.click(); });
    await p.waitForTimeout(400);

    /* ================= 4. the timeline ================= */
    await ev(() => {
      const d = document.getElementById("timelinedock");
      if (/collapsed|dockgone/.test(d.className) && typeof toggleCollapse === "function") toggleCollapse("timelinedock");
      setVar("th", 900);
      if (document.getElementById("tlStage").classList.contains("off")) document.getElementById("tlStageTog").click();
      tl.video = []; tl.vlayers = []; tl.images = []; tl.audio = []; tlSave(); renderTimeline();
      if (window.TlFloat) { TlFloat.show(true); TlFloat.place(1300, 100); }
      window.__sh = TlShape.add({ kind: "ellipse", w: 420, h: 260, fill: "#2050c0" }, 0, 0);
    });
    await p.waitForFunction(() => window.TlTextFill && TlTextFill.ready, null, { timeout: 20000 });
    const tsum = (cv) => `(${boxJs})`;
    void tsum;
    await ev(() => { TlCanvas.select(__sh, TlCanvas.layerOf(__sh)); TlCanvas.paintProps(); });
    await p.waitForTimeout(300);
    const tf0 = await ev(() => !!document.querySelector("#tlpShTf"));
    await p.click("#tlpShTf"); await p.waitForTimeout(300);
    await ev(() => { const set = (k, v) => { const el = document.querySelector('[data-shtf="' + k + '"]'); el.value = v; el.dispatchEvent(new Event(el.tagName === "SELECT" ? "change" : "input")); }; set("str", "HELLO"); set("size", 22); set("color", "#ffff00"); });
    const tf1 = await ev(() => {
      const cv = TlShape.picture(__sh, 0), d = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data, W = cv.width, cx = W / 2, cy = cv.height / 2; let yel = 0, out = 0;
      for (let i = 0; i < d.length; i += 4) { if (!(d[i] > 200 && d[i + 1] > 200 && d[i + 2] < 90 && d[i + 3] > 200)) continue; const k = i / 4, x = k % W, y = (k - x) / W, r = ((x - cx) / 210) ** 2 + ((y - cy) / 130) ** 2; if (r < 1.02) yel++; else out++; }
      return { yel, out, tfill: __sh.shape.tfill };
    });
    check("timeline shape layer: ◆ Shape ▸ 🅰 Text fill - yellow HELLO rows inside the ellipse only", tf0 && tf1.tfill && tf1.tfill.on && tf1.tfill.str === "HELLO" && tf1.yel > 1500 && tf1.out === 0, tf1);

    // a text in the shape
    await ev(() => { TlCanvas.addText({ x: TlCanvas.state.W / 2, y: TlCanvas.state.H / 2 }); window.__tc = tl.images[tl.images.length - 1].clips[0]; Object.assign(__tc.text, { content: "BIG OVAL", font: "DejaVu Sans", color: "#ff00ff", shadow: false, strokeW: 0 }); TlCanvas.select(__tc, TlCanvas.layerOf(__tc)); TlCanvas.paintProps(); });
    await p.waitForTimeout(300);
    const ui = await ev(() => ({ mode: !!document.querySelector("#tlpTsMode"), opts: [...document.querySelectorAll("#tlpTsShape option")].map((o) => o.value), ps: !!document.querySelector("#tlpWpPs"), psn: document.querySelectorAll("#tlpWpPs option").length }));
    check("a timeline text's Properties: 🔤 In a shape (the shape layers listed) and 📌 Warp ▸ ⌇ Preset (16)", ui.mode && ui.opts.includes(await ev(() => __sh.uid)) && ui.ps && ui.psn === 17, ui);
    await ev(() => { const m = document.querySelector("#tlpTsMode"); m.value = "stretch"; m.dispatchEvent(new Event("change")); });
    await p.waitForTimeout(300);
    const st1 = await ev(() => { const cv = TlTextFill.picture(__tc, 0); const b = __box(cv), sp = (xa, xb) => { const d = cv.getContext("2d").getImageData(xa, 0, xb - xa, cv.height).data, w = xb - xa; let a = 1e9, z = -1; for (let i = 3; i < d.length; i += 4) if (d[i] > 100) { const y = Math.floor((i - 3) / 4 / w); a = Math.min(a, y); z = Math.max(z, y); } return z - a; };
      const bx = TlCanvas.box(__tc, "img", TlCanvas.state.t); return { w: cv.width, h: cv.height, b, mid: sp(Math.round(cv.width / 2) - 10, Math.round(cv.width / 2) + 10), edge: sp(b.x0 + 4, b.x0 + 18), inshape: __tc.text.inshape, tf: __tc.tf, sh: __sh.tf, bx: { cx: bx.cx, cy: bx.cy } }; });
    check("…Stretch to fill: the letters fill the ellipse (its width / height), tall in the middle, short at the ends; placed on the shape",
      st1.inshape && st1.inshape.uid && Math.abs(st1.b.w - 420) <= 8 && Math.abs(st1.b.h - 260) <= 8 && st1.mid > 220 && st1.edge < st1.mid * 0.6 && st1.tf.x === st1.sh.x && st1.tf.y === st1.sh.y, st1);
    await ev(() => { const m = document.querySelector("#tlpTsMode"); m.value = "flow"; m.dispatchEvent(new Event("change")); });
    await p.waitForTimeout(300);
    await ev(() => { __tc.text.content = "Words flow inside the oval shape from the top line down to the bottom"; const f = document.querySelector("#tlpTsFit"); f.checked = true; f.dispatchEvent(new Event("change")); });
    const fl1 = await ev(() => { const cv = TlTextFill.picture(__tc, 0), b = __box(cv); return { b, w: cv.width, h: cv.height }; });
    check("…Flow inside (Fit): the words wrap inside the ellipse - several lines, all within it", fl1.b.n > 2000 && fl1.b.h > 120 && fl1.b.x0 >= (fl1.w - 420) / 2 - 2 && fl1.b.x1 <= (fl1.w + 420) / 2 + 2 && fl1.b.y0 >= (fl1.h - 260) / 2 - 2 && fl1.b.y1 <= (fl1.h + 260) / 2 + 2, fl1);
    // ⌇ a warp preset on the text (no longer in the shape)
    await ev(() => { delete __tc.text.inshape; __tc.text.content = "WARPED"; TlCanvas.paintProps(); });
    await p.waitForTimeout(200);
    await ev(() => { const s = document.querySelector("#tlpWpPs"); s.value = "twist"; document.querySelector("#tlpWpPb").value = 80; s.dispatchEvent(new Event("change")); });
    await p.waitForTimeout(300);
    const wp = await ev(() => { const b = TlCanvas.box(__tc, "img", TlCanvas.state.t), out = TlWarp.apply(b.src, __tc, 0, false); return { ps: __tc.warp && __tc.warp.ps, n: __tc.warp && __tc.warp.mesh && __tc.warp.mesh.length, tool: TlCanvas.state.tool, moved: out !== b.src, plain: __box(b.src), warped: __box(out) }; });
    check("…⌇ Preset Twist 80 on a timeline text: an editable 9 x 5 mesh (📌 tool on to drag it), the picture bent", wp.ps === "twist" && wp.n === 45 && wp.tool === "puppet" && wp.moved && Math.abs(wp.warped.h - wp.plain.h) > 10, wp);

    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed " + String(e.stack || e).split("\n").slice(0, 3).join(" ")); if (process.env.SHOT) await p.screenshot({ path: process.env.SHOT }).catch(() => {}); }
  finally {
    try { await ev(() => { tl.images = []; tl.vlayers = []; tlSave(); }); } catch { /* closed */ }
    await b.close();
    try { await api("/api/projects/load", { name: "default" }); } catch { /* fine */ }
    try { fs.rmSync(path.join(ROOT, "projects", P), { recursive: true, force: true }); } catch { /* fine */ }
    console.log(`\n${pass} passed, ${fail} failed`);
    console.log("RESULT: " + fail + " failed");
    process.exit(fail ? 1 : 0);
  }
})();
