#!/usr/bin/env node
/* bitGen Studio — 2.541.0 in a REAL browser: the prompt docker's ▾ Generate / Edit / Refine / Fill / Replace background /
 * Remove (pcimgop.js + pcpromptlink.js) and BLENDER MODE in the image editor (pc3d.js: the Model + Edit from the scene).
 * Tim: "add blender bridge to image-editor so user can modify model/view/camera - add a dropdown to the prompt top
 * menubar- Generate,edit,refine,fill,replace background,remove. when in refine mode add a slider on the top menubar for
 * percentage of refine , change the generate button text to match the dropdown ... only show the dropdown when in image
 * mode. if image editor is in blender mode and the user clicks edit use the blender scene to render the picture from the
 * prompt add it to the gallery, if user selects apply on the thumbnail then add a new layer to the image-editor."
 * The edit model is a stand-in (E.api); Blender is real. Against the running app (H3_URL). No Playwright / no Blender = SKIP. */
"use strict";
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
const BLENDER = ["/usr/bin/blender", "/usr/local/bin/blender", "/snap/bin/blender"].find((p) => fs.existsSync(p)) || (() => { try { return execSync("command -v blender", { encoding: "utf8" }).trim(); } catch { return ""; } })();
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.541.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1700, height: 1000 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message + " @ " + String(e.stack || "").split("\n").slice(1, 3).join(" | ")));
  p.setDefaultTimeout(30000);
  const ev = (f, a) => p.evaluate(f, a);
  const tag = "zz541" + process.pid;
  let proj = "default", blend = "";
  try {
    try { await fetch(URL_ + "api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docks: { imageeditdock: { state: "open", hidden: false, maximized: false } } }) }); } catch { /* older */ }
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.H3ImgOp, null, { timeout: 60000 });
    await p.waitForTimeout(1600);
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await p.waitForTimeout(500);
    // the stand-in edit model: every request kept, each result a magenta picture
    await ev(() => {
      const E = window.imageEditorInstance.E;
      window.__rq = [];
      E.api.aiedit = async (req) => { const crop = await createImageBitmap(req.crop); const c = document.createElement("canvas"); c.width = crop.width; c.height = crop.height; c.getContext("2d").drawImage(crop, 0, 0);
        const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; let red = 0; for (let i = 0; i < d.length; i += 16) if (d[i] > 120 && d[i + 1] < 90 && d[i + 2] < 90) red++;
        window.__rq.push({ mode: req.mode, prompt: req.prompt, strength: req.strength, w: req.width, h: req.height, cropRed: red }); return { jobs: [{ id: "rq" + window.__rq.length, seed: 7 }] }; };
      E.api.awaitResult = async () => { const r = window.__rq[window.__rq.length - 1], c = document.createElement("canvas"); c.width = r.w; c.height = r.h; const g = c.getContext("2d"); g.fillStyle = "#ff00ff"; g.fillRect(0, 0, r.w, r.h); return c.toDataURL("image/png"); };
      E.docs.setTabs(true);
      E.openDoc(320, 240, "op.png", (g) => { g.fillStyle = "#ffffff"; g.fillRect(0, 0, 320, 240); });
    });
    const gm = async (v) => { await ev((x) => { const s = document.getElementById("genModeSel"); s.value = x; s.onchange(); }, v); await p.waitForTimeout(600); };
    const st = () => ev(() => ({ shown: !document.getElementById("pmImgOp").hidden && document.getElementById("pmImgOp").getClientRects().length > 0, op: document.getElementById("pmOpSel").value,
      opts: [...document.querySelectorAll("#pmOpSel option")].map((o) => o.textContent), go: document.getElementById("go").textContent, ref: !document.getElementById("pmRefWrap").hidden,
      refV: document.getElementById("pmRefine").value, panel: window.imageEditorInstance.E.S.aiMode, kx: document.getElementById("kxStrength").value, chip: !document.getElementById("pmBlendChip").hidden }));

    /* 1 only in Image mode; the six choices */
    await gm("video"); await p.waitForTimeout(200);
    const v = await st();
    await gm("image"); await p.waitForTimeout(200);
    const i0 = await st();
    check("the ▾ is on the prompt docker's menu bar only in 🖼 Image mode - Generate, Edit, Refine, Fill, Replace background, Remove",
      !v.shown && i0.shown && i0.opts.join("|") === "✨ Generate|✏ Edit|🔁 Refine|🪣 Fill|🖼 Replace background|🧽 Remove|🧩 Compose", { v, i0 });

    /* 2 Refine: the slider, the button's words, the ✨ AI panel follows (both ways) */
    await p.selectOption("#pmOpSel", "refine"); await p.waitForTimeout(200);
    await ev(() => { const r = document.getElementById("pmRefine"); r.value = "30"; r.dispatchEvent(new Event("input")); }); await p.waitForTimeout(200);
    const r1 = await st();
    check("Refine: a strength slider appears on the menu bar; 30 % -> the button reads \"🔁 Refine 30%\", the ✨ AI panel is on Refine at 30 %",
      r1.ref && r1.go === "🔁 Refine 30%" && r1.panel === "refine" && r1.kx === "30", r1);
    await ev(() => { const k = document.getElementById("kxStrength"); k.value = "70"; k.dispatchEvent(new Event("input")); }); await p.waitForTimeout(200);
    const r2 = await st();
    check("...the panel's slider moved to 70 % -> the menu bar's follows, \"🔁 Refine 70%\"", r2.refV === "70" && r2.go === "🔁 Refine 70%", r2);
    await ev(() => document.querySelector('#kxModes [data-mode="edit"]').click()); await p.waitForTimeout(300);
    const r3 = await st();
    check("the panel's Edit tab -> the ▾ says Edit, no slider, the button reads \"✏ Edit\"", r3.op === "edit" && !r3.ref && r3.go === "✏ Edit", r3);

    /* 3 run them from the prompt docker */
    const press = async (op, text) => { await p.selectOption("#pmOpSel", op); await p.waitForTimeout(150); await ev((t) => { document.getElementById("prompt").value = t; }, text); await p.click("#go"); await p.waitForTimeout(700); };
    const n0 = await ev(() => window.__rq.length);
    await ev(() => window.imageEditorInstance.E.deselect && window.imageEditorInstance.E.deselect());
    await press("fill", "a red ball");
    const f0 = await ev(() => ({ n: window.__rq.length, msg: (document.querySelector("#imageeditdock .kxstatus, #kxStatus, #ieStatus") || {}).textContent || "" }));
    check("🪣 Fill with nothing selected: nothing is sent (it asks for a selection)", f0.n === n0, f0);
    await ev(() => { const E = window.imageEditorInstance.E, a = new Uint8Array(320 * 240); for (let y = 60; y < 180; y++) a.fill(255, y * 320 + 80, y * 320 + 240); E.applyShape(a, "replace", "t"); });
    await press("fill", "a red ball");
    await p.waitForFunction(() => document.querySelectorAll("#kxResults .kxth").length > 0, null, { timeout: 20000 });
    const f1 = await ev(() => ({ last: window.__rq[window.__rq.length - 1], ai: document.getElementById("kxAi").classList.contains("on"), th: document.querySelectorAll("#kxResults .kxth .kxthok").length }));
    check("🪣 Fill with a selection: the editor's Generate (100 %) into it, the results in the ✨ AI panel's gallery, each with its own ✔",
      f1.last.mode === "generate" && f1.last.prompt === "a red ball" && f1.last.strength === 100 && f1.ai && f1.th === 1, f1);
    const fn0 = await ev(() => window.imageEditorInstance.E.S.layers.length);
    await ev(() => document.querySelector("#kxResults .kxth .kxthok").click()); await p.waitForTimeout(400);
    const fap = await ev(() => ({ n: window.imageEditorInstance.E.S.layers.length, left: document.querySelectorAll("#kxResults .kxth").length }));
    check("...✔ on the thumbnail keeps that result (Fill blends it into the layer - pl.blend - or a new layer); the gallery is cleared", fap.left === 0 && fap.n >= fn0, { fn0, fap });
    await ev(() => window.imageEditorInstance.discardResults(true));
    await press("refine", "sharper, golden light");
    await p.waitForFunction(() => document.querySelectorAll("#kxResults .kxth").length > 0, null, { timeout: 20000 });
    const f2 = await ev(() => window.__rq[window.__rq.length - 1]);
    check("🔁 Refine: the editor's Refine at the slider's strength (70 %)", f2.mode === "refine" && f2.strength === 70 && f2.prompt === "sharper, golden light", f2);
    await ev(() => window.imageEditorInstance.discardResults(true));
    for (const [op, mode] of [["background", "generate"], ["remove", "remove"]]) {
      await press(op, op === "remove" ? "" : "a beach at sunset");
      await p.waitForFunction((n) => window.__rq.length >= n, (await ev(() => window.__rq.length)), { timeout: 20000 }).catch(() => {});
      await p.waitForTimeout(400);
      const f3 = await ev(() => window.__rq[window.__rq.length - 1]);
      check(`${op === "background" ? "🖼 Replace background" : "🧽 Remove"}: the editor's ${op === "background" ? "New background (the selection kept)" : "Remove"}`, f3.mode === mode, f3);
      await ev(() => window.imageEditorInstance.discardResults(true));
    }
    // the editor closed: Edit opens it (no picture = it says so)
    await p.selectOption("#pmOpSel", "generate"); await p.waitForTimeout(200);
    const g0 = await st();
    check("✨ Generate: the prompt docker's own button again (the editor's panel not on Generate - not taken)", g0.op === "generate" && !/Edit|Refine|Fill|Remove/.test(g0.go), g0);

    /* 4 BLENDER MODE: a 3D layer - the Model, and Edit from the scene */
    if (!BLENDER) { console.log("SKIP: Blender is not installed here - the Blender mode part did not run"); }
    else {
      proj = (await (await fetch(URL_ + "api/projects")).json()).current;
      const dazDir = path.join(ROOT, "projects", proj, "blender", "daz"); fs.mkdirSync(dazDir, { recursive: true });
      blend = path.join(dazDir, tag + ".blend");
      execSync(`"${BLENDER}" -b --factory-startup -P "${path.join(ROOT, "scripts", "make_layer3d_fixture.py")}" -- "${blend}"`, { stdio: "ignore", timeout: 300000 });
      await ev(() => { const E = window.imageEditorInstance.E; E.deselect(); E.openDoc(640, 480, "bl.png", (g) => { g.fillStyle = "#fff"; g.fillRect(0, 0, 640, 480); }); });
      const L3 = () => ev(() => { const E = window.imageEditorInstance.E, L = E.layer(); if (!L || !L.l3d) return null; const d = L.canvas.getContext("2d").getImageData(0, 0, 640, 480).data;
        let red = 0, rx = 0, ry = 0; for (let y = 0; y < 480; y += 2) for (let x = 0; x < 640; x += 2) { const i = (y * 640 + x) * 4; if (d[i] > 120 && d[i + 1] < 90 && d[i + 2] < 90) { red++; rx += x; ry += y; } }
        return { red, cx: red ? Math.round(rx / red) : null, cy: red ? Math.round(ry / red) : null, obj: window.imageEditorInstance.E.layer3d.objName(), objs: JSON.parse(JSON.stringify(L.l3d.objs || {})), busy: !!L.l3d.busy, undo: E.S.undo.length }; });
      const idle = async () => { await p.waitForTimeout(300); for (let i = 0; i < 400; i++) { if (!(await ev(() => { const L = window.imageEditorInstance.E.layer(); return !!(L && L.l3d && L.l3d.busy); }))) break; await p.waitForTimeout(250); } await p.waitForTimeout(300); };
      await ev((t) => { window.imageEditorInstance.E.layer3d.openScene(t); }, blend);
      await p.waitForFunction(() => { const L = window.imageEditorInstance.E.layer(); return L && L.l3d && !L.l3d.busy && L.l3d.last; }, null, { timeout: 300000 });
      await p.waitForTimeout(500);
      await ev(() => window.imageEditorInstance.E.ui.showTab("k3d")); await p.waitForTimeout(400);
      const a = await L3();
      const model = await ev(() => ({ opts: [...document.querySelectorAll("#l3Obj option")].map((o) => o.value), sel: document.getElementById("l3Obj").value }));
      check("the 🧊 3D tab has a Model section: the scene's objects (no camera), a mesh picked", model.opts.includes("Body") && model.opts.includes("Figure") && !model.opts.includes("Cam") && !!model.sel, model);
      // move the red Body 1.5 m along X with the numbers
      await p.selectOption("#l3Obj", "Body"); await p.fill("#l3MX", "1.5"); await p.press("#l3MX", "Enter"); await idle();
      const bm = await L3();
      check("Model: Body moved 1.5 m along X - Blender draws it to the right (the red moves right), kept in the layer", bm.objs.Body && bm.objs.Body.move[0] === 1.5 && bm.cx > a.cx + 40 && Math.abs(bm.red - a.red) < a.red * 0.5, { a: [a.red, a.cx], b: [bm.red, bm.cx], objs: bm.objs });
      await ev(() => window.imageEditorInstance.E.undo()); await p.waitForTimeout(400);
      const bu = await L3();
      check("...one undo: back where the file has it", !bu.objs.Body && Math.abs(bu.cx - a.cx) < 10, { cx: [a.cx, bu.cx], objs: bu.objs });
      await ev(() => window.imageEditorInstance.E.redo()); await p.waitForTimeout(300);
      // 🖐 Drag the object: drag Body to the left on the canvas
      await ev(() => document.getElementById("l3ObjDrag").click());
      await ev(() => document.getElementById("kxFull").click()); await p.waitForTimeout(1000);   // full screen: the canvas has room to drag on
      const r = await ev(() => { const E = window.imageEditorInstance.E, S = E.S, rr = E.stage.getBoundingClientRect(); return { x: rr.left + S.panX + 0 * S.zoom, y: rr.top + S.panY, z: S.zoom }; });
      const b0 = await L3(), cx = b0.cx, cy = b0.cy;
      if (process.env.DBG) console.log('DBG', JSON.stringify(await ev(([x, y]) => { const el = document.elementFromPoint(x, y); return { el: el && (el.id || el.className || el.tagName), r: window.imageEditorInstance.E.stage.getBoundingClientRect().toJSON(), on: document.getElementById('l3ObjDrag').className, z: window.imageEditorInstance.E.S.zoom, pan: [window.imageEditorInstance.E.S.panX, window.imageEditorInstance.E.S.panY] }; }, [r.x + cx * r.z, r.y + cy * r.z])), cx, cy, JSON.stringify(r));
      await p.mouse.move(r.x + cx * r.z, r.y + cy * r.z); await p.mouse.down();
      await p.mouse.move(r.x + (cx - 60) * r.z, r.y + cy * r.z, { steps: 6 }); await p.mouse.move(r.x + (cx - 120) * r.z, r.y + cy * r.z, { steps: 6 }); await p.mouse.up(); await idle();
      const bd = await L3();
      check("🖐 Drag the object: a click on the red Body picks it, dragging it left on the canvas -> its Move X goes down, Blender draws it further left", bd.obj === "Body" && bd.objs.Body && bd.objs.Body.move[0] < 1.4 && bd.cx < cx - 20, { cx: [cx, bd.cx], obj: bd.obj, objs: bd.objs });
      await ev(() => document.getElementById("kxFull").click()); await p.waitForTimeout(800);    // back: the prompt docker on screen
      await ev(() => document.getElementById("l3ObjDrag").click());
      // Blender mode: the chip + the label; Edit renders the scene and sends THAT picture
      await gm("image"); await p.selectOption("#pmOpSel", "edit"); await p.waitForTimeout(900);
      const c1 = await st();
      check("🟧 Blender mode (a 3D layer selected): the chip shows, the button reads \"✏ Edit · 🟧 Blender\"", c1.chip && c1.go === "✏ Edit · 🟧 Blender", c1);
      // paint the 3D layer white on the canvas: the edit must still see the red body (it comes from Blender, not the canvas)
      await ev(() => { const L = window.imageEditorInstance.E.layer(), g = L.canvas.getContext("2d"); g.fillStyle = "#ffffff"; g.fillRect(0, 0, 640, 480); window.imageEditorInstance.E.refresh(); });
      const nb = await ev(() => window.__rq.length), nl = await ev(() => window.imageEditorInstance.E.S.layers.length);
      await ev(() => { document.getElementById("prompt").value = "a photo of a red armchair in a sunny room"; }); await p.click("#go");
      try { await p.waitForFunction(([n, l]) => window.__rq.length > n && window.imageEditorInstance.E.S.layers.length > l, [nb, nl], { timeout: 180000 }); }
      catch (er) { console.log("      status:", await ev(() => [(document.getElementById("l3Msg") || {}).textContent, (document.getElementById("ieStatus") || {}).textContent, window.imageEditorInstance.E.S.busy])); throw er; }
      await p.waitForTimeout(500);
      const e1 = await ev(() => ({ last: window.__rq[window.__rq.length - 1] }));
      check("Edit in Blender mode: Blender renders the scene (the red body is in the picture sent, though the canvas was painted white), the edit model gets it with the prompt",
        e1.last.mode === "edit" && e1.last.prompt === "a photo of a red armchair in a sunny room" && e1.last.cropRed > 100, e1);
      const ap = await ev(() => { const E = window.imageEditorInstance.E, T = E.S.layers.find((x) => /edit: a photo of a red armchair/.test(x.name)); const d = T ? T.canvas.getContext("2d").getImageData(320, 240, 1, 1).data : []; return { n: E.S.layers.length, name: T && T.name, px: [...d], left: document.querySelectorAll("#kxResults .kxth").length, preview: !!E.S.preview, act: E.layer().name }; });
      check("2.542.0: the result comes in as a NEW layer (\"🟧 … edit: …\") at once - nothing previewed over the canvas, no thumbnails; the 3D layer stays picked", ap.n === nl + 1 && /^🟧 .* edit: a photo of a red armchair/.test(ap.name) && ap.px[0] > 240 && ap.px[1] < 20 && ap.left === 0 && !ap.preview && /^3D: /.test(ap.act), ap);
    }
    check("no page errors", errs.length === 0, errs);
  } catch (e) { check("crashed: " + (e.stack || e), false); }
  finally {
    try { if (blend) fs.rmSync(blend, { force: true }); const sd = path.join(ROOT, "projects", proj, "scene3d"); if (fs.existsSync(sd)) for (const d of fs.readdirSync(sd)) if (d.startsWith(tag)) { try { await fetch(URL_ + "api/layer3d/" + d + "/close", { method: "POST" }); } catch { /* fine */ } fs.rmSync(path.join(sd, d), { recursive: true, force: true }); } } catch { /* fine */ }
    await b.close();
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
