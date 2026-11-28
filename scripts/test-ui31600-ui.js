#!/usr/bin/env node
/* bitGen Studio — 3.16.0 in a REAL browser: 🕳 Text Tunnel (ext/imageeditdock/pctunnel.js) - drag a square with the tool: a
 * new layer with the word down four walls, crowding toward a see-through hole; a preset / Rows changed in the options bar
 * redraws THAT tunnel (one undo, the settings back too); an ellipse shape layer -> ⚪ rings (the shape hidden); a tunnel moved
 * keeps its place when redrawn.
 * Tim: "can we add these text effects to image editor as a preset, we draw a shape like a square or circle and it creates this
 * 3d text effect?" */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
(async () => {
  if (!chromium) { console.log("SKIP: playwright is not installed here"); console.log("\nRESULT: 0 passed, 0 failed"); return; }
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1700, height: 1050 } });
  await p.addInitScript(() => { window.__H3_PENDING_AUTO = true; });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message)); p.on("dialog", (d) => d.dismiss().catch(() => {}));
  const ev = (f, a) => p.evaluate(f, a);
  try {
    try { await fetch(URL_ + "api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docks: { imageeditdock: { state: "open", hidden: false, maximized: false } } }) }); } catch { /* older */ }
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.tunnel, null, { timeout: 90000 });
    await p.waitForTimeout(800);
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await ev(() => { const E = window.imageEditorInstance.E; E.store.set("tunnel.p", null); E.openDoc(400, 400, "Tunnel", (g) => { g.fillStyle = "#0b3b3f"; g.fillRect(0, 0, 400, 400); }); });
    // ---- the tool: a drag
    await ev(() => window.imageEditorInstance.E.ui.run("layer.tunneltool"));
    const t0 = await ev(() => { const E = window.imageEditorInstance.E; return { tool: E.S.tool, opts: !!document.getElementById("tnPre"), presets: [...document.querySelectorAll("#tnPre option")].length - 1 }; });
    check("Layer ▸ 🕳 Text Tunnel Tool: the tool, its options bar with the 7 presets", t0.tool === "tunnel" && t0.opts && t0.presets === 7, t0);
    const r1 = await ev(() => {
      const E = window.imageEditorInstance.E, T = E.tools.tunnel, n0 = E.S.layers.length;
      T.down({}, 20, 20); T.move({ shiftKey: true }, 380, 360); T.up();
      const L = E.layer(), d = L.canvas.getContext("2d").getImageData(0, 0, 400, 400).data, a = (x, y) => d[(y * 400 + x) * 4 + 3];
      let top = 0, left = 0, right = 0, bot = 0;
      for (let y = 30; y < 120; y++) for (let x = 150; x < 250; x++) top += a(x, y) > 128;
      for (let y = 280; y < 370; y++) for (let x = 150; x < 250; x++) bot += a(x, y) > 128;
      for (let x = 30; x < 120; x++) for (let y = 150; y < 250; y++) left += a(x, y) > 128;
      for (let x = 280; x < 370; x++) for (let y = 150; y < 250; y++) right += a(x, y) > 128;
      return { added: E.S.layers.length - n0, name: L.name, box: L.tunnel && L.tunnel.box, hole: a(200, 200) + a(195, 205) + a(205, 195), top, bot, left, right, outside: a(5, 5) + a(395, 395), text: L.tunnel.p.text };
    });
    check("a Shift+drag: one new layer '🕳 DESIGN tunnel', its box a square", r1.added === 1 && r1.name === "🕳 DESIGN tunnel" && r1.box.w === 360 && r1.box.h === 360, r1);
    check("…the hole in the middle see-through, nothing outside the square", r1.hole === 0 && r1.outside === 0, r1);
    check("…all four walls lettered, about as much ink on each (the walls are the same wall turned)", [r1.top, r1.bot, r1.left, r1.right].every((v) => v > 1500) && Math.max(r1.top, r1.bot, r1.left, r1.right) / Math.min(r1.top, r1.bot, r1.left, r1.right) < 1.35, r1);
    // ---- live settings + one undo
    const r2 = await ev(async () => {
      const E = window.imageEditorInstance.E, L = E.layer(), sum = () => { const d = L.canvas.getContext("2d").getImageData(0, 0, 400, 400).data; let s = 0; for (let i = 3; i < d.length; i += 16) s += d[i]; return s; };
      const s0 = sum(), u0 = E.S.undo.length;
      const rows = document.getElementById("tnRows"); rows.value = "14"; rows.dispatchEvent(new Event("change"));
      const s1 = sum(), after = L.tunnel.p.rows, u1 = E.S.undo.length;
      E.ui.run("edit.undo");
      return { s0, s1, after, steps: u1 - u0, back: L.tunnel.p.rows, s2: sum(), same: E.layer() === L };
    });
    check("Rows 8 → 14 in the options bar redraws the picked tunnel (one undo step)", r2.after === 14 && r2.s1 !== r2.s0 && r2.steps === 1 && r2.same, r2);
    check("…undo: the pixels AND its settings back to 8 rows", r2.back === 8 && r2.s2 === r2.s0, r2);
    const r3 = await ev(() => {
      const E = window.imageEditorInstance.E, L = E.layer(); E.renderOptions();
      const pre = document.getElementById("tnPre"); pre.value = "tower"; pre.dispatchEvent(new Event("change"));
      return { face: L.tunnel.p.face, rows: L.tunnel.p.rows, hole: L.tunnel.p.hole, text: L.tunnel.p.text, shown: document.getElementById("tnFace").value };
    });
    check("Preset 🗼 Tower from above on the picked tunnel: letters face out, hole 30 %, the words kept; the bar shows it", r3.face === "out" && r3.hole === 30 && r3.text === "DESIGN" && r3.shown === "out", r3);
    // ---- moved, then redrawn: it stays where it was moved to
    const r4 = await ev(() => {
      const E = window.imageEditorInstance.E, L = E.layer(), c = L.canvas, cp = E.newCanvas(400, 400); cp.getContext("2d").drawImage(c, 0, 0);
      const g = c.getContext("2d"); g.clearRect(0, 0, 400, 400); g.drawImage(cp, 0, 0, 400, 400, -30, 10, 400, 400); L.ver++;   // the Move tool: 30 left, 10 down
      const b0 = E.alphaBox(c); E.tunnel.redraw(L, L.tunnel.p); const b1 = E.alphaBox(c);
      return { b0, b1, box: L.tunnel.box };
    });
    check("a tunnel moved 30 left / 10 down, then redrawn: it stays where it was moved", Math.abs(r4.b1.x - r4.b0.x) <= 2 && Math.abs(r4.b1.y - r4.b0.y) <= 2 && Math.abs(r4.box.x - -10) <= 2, r4);
    // ---- from an ellipse shape layer
    const r5 = await ev(() => {
      const E = window.imageEditorInstance.E, S = E.S, D = E.D;
      E.structOp("shape", () => { const L = E.makeLayer("Ellipse", 400, 400, "shape"); L.shape = Object.assign({}, D.SHAPE_DEFAULT, { kind: "ellipse", x: 50, y: 50, w: 300, h: 300 }); D.rasterize && D.rasterize(L); S.layers = E.D.insert(S.layers, L, E.layer().id, false); S.active = S.layers.indexOf(L); });
      const shape = E.layer(), en = E.ui.isEnabled ? E.ui.isEnabled("layer.tunnelshape") : true;
      E.ui.run("layer.tunnelshape");
      const L = E.layer(), d = L.canvas.getContext("2d").getImageData(0, 0, 400, 400).data, a = (x, y) => d[(y * 400 + x) * 4 + 3];
      let ink = 0; for (let y = 50; y < 350; y += 2) for (let x = 50; x < 350; x += 2) ink += a(x, y) > 128;
      return { en, name: L.name, shape: L.tunnel.p.shape, box: L.tunnel.box, hidden: shape.visible === false, hole: a(200, 200), corner: a(55, 55), ink };
    });
    check("Layer ▸ 🕳 Text Tunnel From Shape on an ellipse: ⚪ rings in its box, the shape hidden under it", r5.en !== false && r5.name === "🕳 DESIGN rings" && r5.shape === "ellipse" && r5.box.x === 50 && r5.box.w === 300 && r5.hidden, r5);
    check("…the rings lettered, the hole and the corners outside the circle see-through", r5.ink > 2000 && r5.hole === 0 && r5.corner === 0, r5);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: " + (e && e.stack || e)); }
  await b.close();
  console.log("\nRESULT: " + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
