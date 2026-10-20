#!/usr/bin/env node
/* bitGen Studio — 2.442.0 in a REAL browser: FRAMES (CorelDRAW's PowerClip - pcframes.js). Tim: "let user add any layer
 * or layers to frame(a closed shape). add option to edit frame ... the frame will move and rotate and scale as normal but
 * everything inside will rotate, scale and move at the same time ... keep he layers in the frame in a tree of layers
 * inside the shape layer" + "if a shape is selected and user generates image , put that image in the shape".
 * Against the running app (H3_URL, default the e2e server on :8311). No Playwright = SKIP. SHOTS=<dir> keeps pictures. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the frames browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const SHOTS = process.env.SHOTS || "";
let pass = 0, fail = 0;
const check = (n, cond, got) => {
  if (cond) { pass++; console.log("PASS: " + n); }
  else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); }
};

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1700, height: 1000 } });
  await p.addInitScript(() => { window.__H3_PENDING_AUTO = true; });   // 2.556.0: results straight in, as when this test was written (no ⏳ Pending)
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message + " @ " + String(e.stack || "").split("\n").slice(1, 3).join(" | ")));
  const ev = (f, a) => p.evaluate(f, a);
  const shot = async (n) => { if (SHOTS) await p.screenshot({ path: path.join(SHOTS, n + ".png") }); };
  try {
    try { await fetch(URL_ + "api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docks: { imageeditdock: { state: "open", hidden: false, maximized: false } } }) }); } catch { /* older */ }
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.frames, null, { timeout: 60000 });
    await p.waitForTimeout(800);
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await p.click("#kxFull"); await p.waitForTimeout(800);
    await ev(() => {
      const E = window.imageEditorInstance.E, D = window.PCDoc;
      Object.assign(E.guides.settings, { snap: false });
      E.docs.setTabs(true); E.openDoc(400, 300, "frames.png", (g) => { g.fillStyle = "#fff"; g.fillRect(0, 0, 400, 300); });
      // a picture: red 50..150, blue 150..250 (y 50..200), a green dot at (120, 90)
      const P = E.makeLayer("Pic", 400, 300), g = P.canvas.getContext("2d");
      g.fillStyle = "#e00000"; g.fillRect(50, 50, 100, 150); g.fillStyle = "#0000e0"; g.fillRect(150, 50, 100, 150); g.fillStyle = "#00c000"; g.fillRect(116, 86, 8, 8);
      E.addLayer(P, "t", false);
      const F = E.makeLayer("Frame", 400, 300, "shape"); F.shape = Object.assign({}, D.SHAPE_DEFAULT, { kind: "rect", x: 100, y: 80, w: 100, h: 80, fill: "#ffee00" }); D.rasterize(F); E.addLayer(F, "t", false);
      E.S.picks = [P.id]; E.setActive(E.S.layers.indexOf(F)); E.setTool("move");
    });
    await p.waitForTimeout(300);
    const flatPx = (x, y) => ev(([x, y]) => Array.from(window.imageEditorInstance.E.flatten().getContext("2d").getImageData(x, y, 1, 1).data.slice(0, 3)), [x, y]);
    const screenPx = (x, y) => ev(([x, y]) => Array.from(document.getElementById("ieCanvas").getContext("2d").getImageData(x, y, 1, 1).data.slice(0, 3)), [x, y]);
    const near = (a, b2, t) => a.every((v, i) => Math.abs(v - b2[i]) <= (t || 30));
    const RED = [224, 0, 0], BLUE = [0, 0, 224], WHITE = [255, 255, 255], YEL = [255, 238, 0], GREEN = [0, 192, 0];
    const sc = (x, y) => ev(([x, y]) => { const r = document.getElementById("kxPaper").getBoundingClientRect(), z = window.imageEditorInstance.E.S.zoom; return [r.left + x * z, r.top + y * z]; }, [x, y]);
    const st = () => ev(() => { const E = window.imageEditorInstance.E, S = E.S, F = S.layers.find((L) => L.name === "Frame"), P = S.layers.find((L) => L.name === "Pic");
      return { order: S.layers.map((L) => L.name), pParent: P && P.parent, fId: F && F.id, frame: !!(F && F.frame), active: E.layer() && E.layer().name, kind: F && F.shape.kind }; });

    /* 1 Place Inside Frame: the picked layer into the active closed shape */
    await ev(() => window.imageEditorInstance.E.ui.run("frame.place")); await p.waitForTimeout(250);
    const dlg = await ev(() => ({ title: (document.querySelector(".kxdlg.pcd h4") || {}).textContent, sel: (document.getElementById("frSel") || {}).value, ctr: !!document.getElementById("frCtr") }));
    await ev(() => document.querySelector(".kxdlg.pcd .ok").click()); await p.waitForTimeout(300);
    const s1 = await st();
    check("Layer ▸ Frame ▸ Place Inside Frame…: the picked layer goes INTO the active closed shape (the dialog offers it), right below it in the tree", /Place Inside Frame/.test(dlg.title || "") && dlg.ctr && s1.pParent === s1.fId && s1.frame && s1.order.join() === "Background,Pic,Frame", { dlg, s1 });
    const rows = await ev(() => [...document.querySelectorAll("#kxLayers .kxlayer")].map((r) => ({ n: r.querySelector(".nm").textContent, tw: !!r.querySelector(".tw"), ind: parseInt(r.querySelector("span[style*=width]") ? r.querySelector("span[style*=width]").style.width : "0", 10) })));
    check("...the Layers panel shows it as a tree: the frame with ▾, the picture indented under it", rows.some((r) => r.n === "Frame" && r.tw) && rows.some((r) => r.n === "Pic" && r.ind >= 12), rows);
    const in1 = await flatPx(120, 100), out1 = await flatPx(70, 100), dot = await flatPx(120, 90), yel = await flatPx(60, 60);
    check("...the picture shows only INSIDE the frame (red at 120,100; the green dot), white outside it where it was red (70,100); no fill seen where the picture covers it",
      near(in1, RED) && near(out1, WHITE, 3) && near(dot, GREEN) && near(yel, WHITE, 3), { in1, out1, dot, yel });
    await shot("1-placed");

    /* 2 the Move tool moves the frame - the contents follow LIVE and in the same undo step */
    const [ax, ay] = await sc(110, 150), [bx, by] = await sc(150, 170);
    await p.mouse.move(ax, ay); await p.mouse.down(); await p.mouse.move((ax + bx) / 2, (ay + by) / 2, { steps: 4 }); await p.mouse.move(bx, by, { steps: 4 });
    await p.waitForTimeout(250);
    const live = await screenPx(160, 110);           // the dot moved (120, 90) + (40, 20)
    if (process.env.DBG) console.log("DBG", JSON.stringify(await ev(() => { const E = window.imageEditorInstance.E, F = E.S.layers.find((L) => L.name === "Frame"); return { geo: F.frame.geo, now: E.frames.geoOf(F.shape), m: window.PCFrames.liveMatrix(F), cw: document.getElementById("ieCanvas").width, drag: !!E.S.drag, flat: Array.from(E.flatten().getContext("2d").getImageData(160, 110, 1, 1).data) }; })));
    await p.mouse.up(); await p.waitForTimeout(350);
    const m2 = await ev(() => { const S = window.imageEditorInstance.E.S, F = S.layers.find((L) => L.name === "Frame"), P = S.layers.find((L) => L.name === "Pic");
      const px = (x, y) => Array.from(P.canvas.getContext("2d").getImageData(x, y, 1, 1).data.slice(0, 3)); return { fx: F.shape.x, fy: F.shape.y, dot: px(160, 110), old: px(120, 90), undo: S.undo.length, label: S.undo[S.undo.length - 1].label }; });
    check("dragging the frame (40, 20): while dragging its contents are drawn moved with it (live); after, the picture itself moved by the same (the dot at 160,110)", near(live, GREEN) && m2.fx === 140 && m2.fy === 100 && near(m2.dot, GREEN) && !near(m2.old, GREEN), { live, m2 });
    const u2 = await ev(() => { const E = window.imageEditorInstance.E; const n = E.S.undo.length; E.undo(); const S = E.S, F = S.layers.find((L) => L.name === "Frame"), P = S.layers.find((L) => L.name === "Pic");
      const r = { n, fx: F.shape.x, dot: Array.from(P.canvas.getContext("2d").getImageData(120, 90, 1, 1).data.slice(0, 3)) }; E.redo(); return r; });
    check("...ONE undo step puts the frame and the picture back (redo: both again)", u2.fx === 100 && near(u2.dot, GREEN), u2);

    /* 3 the Transform docker turns + scales the frame: everything inside turns and scales with it */
    const before = await ev(() => { const E = window.imageEditorInstance.E, F = E.S.layers.find((L) => L.name === "Frame"); const c = E.flatten().getContext("2d"); const pts = [[150, 110], [180, 150], [215, 105], [155, 170]];
      return { geo: E.frames.geoOf(F.shape), cols: pts.map(([x, y]) => Array.from(c.getImageData(x, y, 1, 1).data.slice(0, 3))), pts }; });
    await ev(() => { const E = window.imageEditorInstance.E; E.setActive(E.S.layers.findIndex((L) => L.name === "Frame")); Object.assign(E.dockers.settings, { tab: "rotate", angle: 90, anchor: "c", copies: 0 }); E.dockers.doTransform();
      Object.assign(E.dockers.settings, { tab: "scale", sx: 120, sy: 120, prop: true, mirrorH: false, mirrorV: false, anchor: "c" }); E.dockers.doTransform(); });
    await p.waitForTimeout(300);
    const after = await ev((B) => { const E = window.imageEditorInstance.E, F = E.S.layers.find((L) => L.name === "Frame"), m = window.PCFrames.fitAffine(B.geo, E.frames.geoOf(F.shape)); const c = E.flatten().getContext("2d");
      return { m, kind: F.shape.kind, cols: B.pts.map(([x, y]) => { const [u, v] = window.PCFrames.applyM(m, x, y); return Array.from(c.getImageData(Math.round(u), Math.round(v), 1, 1).data.slice(0, 3)); }) }; }, before);
    const okT = after.m && Math.abs(Math.hypot(after.m[0], after.m[1]) - 1.2) < 0.01 && after.cols.every((c, i) => near(c, before.cols[i], 60));
    check("the Transform docker: Rotate 90° then Scale 120% - the frame turned and grew, and every point of its contents went with it (the same colours at the mapped points)", okT, { after, before: before.cols });
    await shot("3-turned");

    /* 4 Edit Frame Contents: the contents are worked on alone; ✓ Finish Editing Frame goes back */
    await ev(() => window.imageEditorInstance.E.ui.run("frame.edit")); await p.waitForTimeout(300);
    const e4 = await ev(() => { const E = window.imageEditorInstance.E, bar = document.getElementById("pcFrameBar"); return { bar: !!bar && bar.style.display !== "none" && /Editing the contents/.test(bar.textContent), active: E.layer().name, editing: E.frames.editing() != null }; });
    const fBox = await ev(() => { const E = window.imageEditorInstance.E, F = E.S.layers.find((L) => L.name === "Frame"); return { geo: JSON.stringify(E.frames.geoOf(F.shape)) }; });
    await ev(() => window.imageEditorInstance.E.nudge(10, 0));
    const e4b = await ev((g0) => { const E = window.imageEditorInstance.E, F = E.S.layers.find((L) => L.name === "Frame"); return { same: JSON.stringify(E.frames.geoOf(F.shape)) === g0 }; }, fBox.geo);
    await shot("4-editing");
    check("Edit Frame Contents: the bar on the canvas, the picture active - moving it moves it alone inside the frame (the frame stays)", e4.bar && e4.active === "Pic" && e4.editing && e4b.same, { e4, e4b });
    await ev(() => document.getElementById("pcFrameDone").click()); await p.waitForTimeout(250);
    const e5 = await ev(() => { const E = window.imageEditorInstance.E, bar = document.getElementById("pcFrameBar"); return { hidden: !bar || bar.style.display === "none", active: E.layer().name, editing: E.frames.editing() }; });
    check("✓ Finish Editing Frame: normal mode, the frame active again", e5.hidden && e5.active === "Frame" && e5.editing == null, e5);

    /* 5 a click on the picture inside the frame (Move tool, Ctrl = pick) picks the FRAME; a double-click enters editing */
    await ev(() => { const E = window.imageEditorInstance.E; E.setActive(0); });
    const F0 = await ev(() => { const E = window.imageEditorInstance.E, F = E.S.layers.find((L) => L.name === "Frame"), b = E.dockers.boxOf(F); return [b.x + b.w / 2, b.y + b.h / 2]; });
    const [cx, cy] = await sc(F0[0], F0[1]);
    await p.keyboard.down("Control"); await p.mouse.click(cx, cy); await p.keyboard.up("Control"); await p.waitForTimeout(250);
    const pk = await ev(() => window.imageEditorInstance.E.layer().name);
    // 2.453.0: a right-click ▸ Edit Frame Contents (a double-click is the Move tool's rotate handles now)
    if (pk === "Frame") { await p.mouse.click(cx, cy, { button: "right" }); await p.waitForTimeout(250); await ev(() => { const it = document.querySelector('.kxmenu [data-cmd="frame.edit"]'); if (it) it.click(); }); await p.waitForTimeout(250); }
    const dbl = await ev(() => window.imageEditorInstance.E.frames.editing() != null);
    check("Ctrl-click (auto-select) on what is inside picks the frame, not the picture; right-click ▸ Edit Frame Contents edits it", pk === "Frame" && dbl, { pk, dbl });
    await ev(() => window.imageEditorInstance.E.frames.finish(true));

    /* 6 a layer dropped on the frame's row goes in; Extract Contents takes them out */
    await ev(() => { const E = window.imageEditorInstance.E; const N = E.makeLayer("Note", 400, 300); const g = N.canvas.getContext("2d"); g.fillStyle = "#00c0c0"; g.fillRect(0, 0, 40, 40); E.addLayer(N, "t", false); E.setActive(E.S.layers.indexOf(N)); });
    const dropIn = await ev(() => { const E = window.imageEditorInstance.E, S = E.S, rows = [...document.querySelectorAll("#kxLayers .kxlayer")], fr = rows.find((r) => r.querySelector(".nm").textContent === "Frame"), nr = rows.find((r) => r.querySelector(".nm").textContent === "Note");
      const dt = new DataTransfer(); nr.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer: dt }));
      const r = fr.getBoundingClientRect(); fr.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, clientX: r.left + 20, clientY: r.top + r.height / 2, dataTransfer: dt }));
      const cls = fr.classList.contains("drop-in"); fr.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, clientX: r.left + 20, clientY: r.top + r.height / 2, dataTransfer: dt }));
      const N = S.layers.find((L) => L.name === "Note"), F = S.layers.find((L) => L.name === "Frame"); return { cls, inside: N.parent === F.id, kids: S.layers.filter((L) => L.parent === F.id).map((L) => L.name) }; });
    check("dragging a layer onto the middle of a closed shape's row in Layers puts it inside (drop-in)", dropIn.cls && dropIn.inside && dropIn.kids.join() === "Pic,Note", dropIn);
    await ev(() => { const E = window.imageEditorInstance.E; E.setActive(E.S.layers.findIndex((L) => L.name === "Frame")); E.ui.run("frame.extract"); });
    const ex = await ev(() => { const S = window.imageEditorInstance.E.S, F = S.layers.find((L) => L.name === "Frame"); return { frame: F.frame, order: S.layers.map((L) => L.name + ":" + (L.parent == null ? "-" : "in")) }; });
    check("Extract Contents: both out, above the frame, at the top level; the frame a plain shape", ex.frame === null && ex.order.join() === "Background:-,Frame:-,Pic:-,Note:-", ex);
    await ev(() => window.imageEditorInstance.E.undo());
    const back = await ev(() => window.imageEditorInstance.E.S.layers.filter((L) => L.parent != null).length);
    check("...one undo puts them back in", back === 2, back);

    /* 7 ✨ Generate with a closed shape active: in its box, ✔ Apply = the picture inside it */
    await ev(() => {
      const E = window.imageEditorInstance.E, D = window.PCDoc;
      window.__fr = [];
      E.api.aiedit = async (req) => { window.__fr.push({ prompt: req.prompt, mode: req.mode, w: req.width, h: req.height }); return { jobs: [{ id: "fr" + window.__fr.length, seed: 3 }] }; };
      E.api.awaitResult = async () => { const r = window.__fr[window.__fr.length - 1], c = document.createElement("canvas"); c.width = r.w; c.height = r.h; const g = c.getContext("2d"); g.fillStyle = "#ff00ff"; g.fillRect(0, 0, r.w, r.h); return c.toDataURL("image/png"); };
      const O = E.makeLayer("Oval", 400, 300, "shape"); O.shape = Object.assign({}, D.SHAPE_DEFAULT, { kind: "ellipse", x: 20, y: 200, w: 120, h: 80, fill: "#808080" }); D.rasterize(O); E.addLayer(O, "t", false);
      E.setActive(E.S.layers.indexOf(O)); E.deselect(); E.setAiMode("generate");
      if (document.getElementById("iePrompt")) document.getElementById("iePrompt").value = "a sunset";
      document.getElementById("kxRun").click();
    });
    await p.waitForFunction(() => { const S = window.imageEditorInstance.E.S; return S.results.length && S.results[0].layer; }, null, { timeout: 15000 });
    const g7 = await ev(() => { const S = window.imageEditorInstance.E.S; return { into: S.results[0].info.into, box: S.results[0].info.box, req: window.__fr[0] }; });
    await ev(() => document.getElementById("kxApply").click()); await p.waitForTimeout(300);
    const a7 = await ev(() => { const S = window.imageEditorInstance.E.S, O = S.layers.find((L) => L.name === "Oval"), R = S.layers[S.active]; return { frame: !!O.frame, parent: R.parent === O.id, name: R.name }; });
    const inO = await flatPx(80, 240), corner = await flatPx(24, 204);
    check("✨ Generate with a closed shape active (no selection): it generates in the shape's box, ✔ Apply puts the picture INSIDE the shape (a frame) - magenta in the oval, not in its box's corner",
      g7.into && g7.into.how === "frame" && g7.req && g7.req.mode === "generate" && a7.frame && a7.parent && near(inO, [255, 0, 255]) && !near(corner, [255, 0, 255]), { g7, a7, inO, corner });
    await shot("7-generated");
    const cmds = await ev(() => ["frame.place", "frame.edit", "frame.finish", "frame.extract", "frame.lock", "frame.gen"].every((c) => window.imageEditorInstance.E.ui.CMD.has(c)));
    check("Layer ▸ Frame (PowerClip): Place Inside Frame…, Edit Frame Contents, Finish Editing Frame, Extract Contents, Lock Contents to Frame, ✨ Generate Into the Picked Shape", cmds);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + e.stack); }
  finally { await b.close(); }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
