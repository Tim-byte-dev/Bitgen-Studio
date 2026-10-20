#!/usr/bin/env node
/* bitGen Studio — 2.542.0 in a REAL browser (WebGL) + a REAL Blender: a BLENDER LAYER in the image editor (pcblendlayer.js +
 * the timeline's scene tools lent by TlBlend.attach).
 * Tim: "add blender button to open scene tools to image-editor as a blender layer - open blender scene etc. the same as the
 * timeline docker - when user clicks the edit button in prompt use the current scene as the reference to generate the
 * image from. create a new layer. right now the canvas is getting the rendered image and it cannot be deleted."
 *   1. 🟧 on the editor's menu bar: the timeline's scene tools cover the canvas, their Properties in the 🟧 Blender tab; the
 *      open scene loads; a picture at the scene's shape + a Blender layer "🟧 <scene>" with the view;
 *   2. an object moved in the tools, ✕ closes them: the layer keeps the new view (one undo step), the tools go back to
 *      the timeline (detached);
 *   3. the layer is an ordinary layer: deleted (and back with undo);
 *   4. Blender mode: ▾ Edit with the Blender layer picked -> the view goes to the edit model with the prompt, the result is
 *      a NEW LAYER (no preview over the canvas), the Blender layer stays picked; "Blender render - Solid" -> Blender
 *      renders the view at the picture's size first;
 *   5. the timeline's own 🟧 takes the tools back while the editor has them.
 * The edit model is a stand-in. Against the running app (H3_URL). No Playwright / no Blender = SKIP. */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execSync, execFileSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.542.0 browser test did not run"); process.exit(0); }
let exe = ""; try { exe = execSync("command -v blender", { encoding: "utf8", shell: "/bin/bash" }).trim(); } catch { exe = ""; }
if (!exe) { console.log("SKIP: Blender is not installed here - the 2.542.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const ROOT = path.join(__dirname, "..");
const P = "zz_bl542_" + process.pid;
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const api = async (u, body) => (await fetch(URL_ + u.replace(/^\//, ""), body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();

const T = fs.mkdtempSync(path.join(os.tmpdir(), "bl542_"));
const SRC = path.join(T, "Room Shot.blend");
fs.writeFileSync(path.join(T, "make.py"), `
import bpy, sys
for o in list(bpy.data.objects): bpy.data.objects.remove(o)
sc=bpy.context.scene; sc.frame_start=1; sc.frame_end=24; sc.render.fps=24
sc.render.resolution_x, sc.render.resolution_y = 1280, 704
def mat(n, rgb):
    m=bpy.data.materials.new(n); m.diffuse_color=(*rgb,1); m.use_nodes=True
    b=m.node_tree.nodes.get("Principled BSDF")
    if b: b.inputs["Base Color"].default_value=(*rgb,1)
    return m
bpy.ops.mesh.primitive_plane_add(size=20); g=bpy.context.active_object; g.name="Ground"; g.data.materials.append(mat("g",(0.2,0.2,0.2)))
bpy.ops.mesh.primitive_cube_add(location=(0,0,1)); c=bpy.context.active_object; c.name="Cube"; c.data.materials.append(mat("r",(0.9,0.05,0.05)))
bpy.ops.object.camera_add(location=(0,-12,5), rotation=(1.2,0,0)); cam=bpy.context.active_object; cam.name="Cam"; sc.camera=cam
bpy.ops.object.light_add(type="SUN", location=(0,0,10)); bpy.context.active_object.name="Sun"
bpy.ops.wm.save_as_mainfile(filepath=sys.argv[-1])
`);
execFileSync(exe, ["-b", "--factory-startup", "-P", path.join(T, "make.py"), "--", SRC], { stdio: "ignore", timeout: 300000 });

(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const p = await b.newPage({ viewport: { width: 1900, height: 1150 } });
  await p.addInitScript(() => { window.__H3_PENDING_AUTO = true; });   // 2.556.0: results straight in, as when this test was written (no ⏳ Pending)
  const errs = []; p.on("pageerror", (e) => errs.push(e.message + " @ " + String(e.stack || "").split("\n").slice(1, 3).join(" | ")));
  p.setDefaultTimeout(30000);
  const ev = (f, a) => p.evaluate(f, a);
  try {
    await api("/api/projects/load", { name: P });
    const st = await api("/api/blendview/open", { path: SRC });
    if (!st.stem) throw new Error("the scene did not open: " + JSON.stringify(st));
    try { await fetch(URL_ + "api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docks: { imageeditdock: { state: "open", hidden: false, maximized: false } } }) }); } catch { /* older */ }
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.blendLayer && window.TlBlend, null, { timeout: 60000 });
    await p.waitForTimeout(1500);
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await p.waitForTimeout(500);
    await ev(() => {
      const E = window.imageEditorInstance.E;
      window.__rq = [];
      E.api.aiedit = async (req) => { const crop = await createImageBitmap(req.crop); const c = document.createElement("canvas"); c.width = crop.width; c.height = crop.height; c.getContext("2d").drawImage(crop, 0, 0);
        const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; let red = 0, white = 0, n = 0; for (let i = 0; i < d.length; i += 16) { n++; if (d[i] > 110 && d[i + 1] < 80 && d[i + 2] < 80) red++; if (d[i] > 245 && d[i + 1] > 245 && d[i + 2] > 245) white++; }
        window.__rq.push({ mode: req.mode, prompt: req.prompt, w: req.width, h: req.height, red, white, n }); return { jobs: [{ id: "bl" + window.__rq.length, seed: 3 }] }; };
      E.api.awaitResult = async () => { const r = window.__rq[window.__rq.length - 1], c = document.createElement("canvas"); c.width = r.w; c.height = r.h; const g = c.getContext("2d"); g.fillStyle = "#00ff00"; g.fillRect(0, 0, r.w, r.h); return c.toDataURL("image/png"); };
      E.docs.setTabs(true);
    });
    const layerInfo = () => ev(() => { const E = window.imageEditorInstance.E, L = E.layer(); if (!L) return null; const d = L.canvas.getContext("2d").getImageData(0, 0, L.canvas.width, L.canvas.height).data;
      let red = 0, rx = 0, any = 0; for (let i = 0; i < d.length; i += 4 * 7) { if (d[i + 3] > 0) any++; if (d[i] > 110 && d[i + 1] < 80 && d[i + 2] < 80) { red++; rx += (i / 4) % L.canvas.width; } }
      return { name: L.name, blend: L.bscene ? { stem: L.bscene.stem } : null, red, cx: red ? Math.round(rx / red) : null, any, n: E.S.layers.length, w: E.S.w, h: E.S.h, undo: E.S.undo.length }; });

    /* 1 🟧 -> the scene tools over the canvas, the Blender layer */
    await p.click("#kblBtn");
    await p.waitForFunction(() => window.TlBlend.state.st && window.TlBlend.state.on && window.imageEditorInstance.E.layer() && window.imageEditorInstance.E.layer().bscene, null, { timeout: 120000 });
    await p.waitForTimeout(800);
    const o1 = await ev(() => ({ wrap: document.getElementById("ieBlendWrap").style.display, inWrap: document.getElementById("tlBlendView").parentNode.id, on: document.getElementById("tlBlendView").classList.contains("on"),
      props: !!document.querySelector("#kblTl #tlBlendProps #tlbSave"), tab: document.getElementById("kblBody").classList.contains("on"), stem: window.TlBlend.state.st.stem, host: !!window.TlBlend.host() }));
    const l1 = await layerInfo();
    if (process.env.DBG) console.log('DBG', JSON.stringify(await ev(() => window.imageEditorInstance.E.S.layers.map((L) => [L.name, !!L.bscene, L.canvas.width]))), JSON.stringify(await ev(() => window.__ev || null)));
    check("🟧 on the editor's menu bar: the timeline's scene tools cover the canvas (the same view, lent), their Properties (💾 Save …) in the 🟧 Blender tab, the open scene loaded",
      o1.wrap === "block" && o1.inWrap === "ieBlendWrap" && o1.on && o1.props && o1.tab && o1.stem === st.stem && o1.host, o1);
    check("...a picture at the scene's shape (1280 x 704) and a Blender layer \"🟧 " + st.stem + "\" holding the view (the red cube in it)", l1 && l1.w === 1280 && l1.h === 704 && l1.name === "🟧 " + st.stem && l1.blend && l1.blend.stem === st.stem && l1.red > 50, l1);

    /* 2 move the cube in the tools, ✕: the layer keeps the new view, the tools go back to the timeline */
    const mv = await ev(() => { try { const TB = window.TlBlend; TB.setView("scene"); TB.select("Cube"); const t = TB.trs("Cube"); t.t = [t.t[0] + 4, t.t[1], t.t[2]]; TB.setTrs(t); TB.draw(); return "ok"; } catch (e) { return String(e.stack || e); } });
    if (mv !== "ok") console.log("      move:", mv);
    await p.waitForTimeout(500);
    await ev(() => document.getElementById("tlbClose").click()); await p.waitForTimeout(800);
    const l2 = await layerInfo();
    const o2 = await ev(() => ({ wrap: document.getElementById("ieBlendWrap").style.display, parent: document.getElementById("tlBlendView").parentNode.id, host: !!window.TlBlend.host(), on: window.TlBlend.state.on }));
    check("the cube moved in the tools, ✕: the layer keeps the NEW view (the red further right), one undo step; the tools go back to the timeline (detached)",
      l2.n === l1.n && l2.cx > l1.cx + 40 && l2.undo === l1.undo + 1 && o2.wrap === "none" && o2.parent === "tlCanvasWrap" && !o2.host && !o2.on, { l1, l2, o2 });

    /* 3 an ordinary layer: delete it, undo */
    await ev(() => window.imageEditorInstance.E.ui.run("layer.del")); await p.waitForTimeout(300);
    const d1 = await ev(() => window.imageEditorInstance.E.S.layers.map((L) => L.name));
    await ev(() => window.imageEditorInstance.E.undo()); await p.waitForTimeout(300);
    const d2 = await ev(() => { const E = window.imageEditorInstance.E; return { names: E.S.layers.map((L) => L.name), act: E.layer() && E.layer().name }; });
    check("the Blender layer is an ordinary layer: Delete takes it out, Ctrl+Z brings it back", !d1.includes("🟧 " + st.stem) && d2.names.includes("🟧 " + st.stem), { d1, d2 });
    await ev((n) => { const E = window.imageEditorInstance.E, i = E.S.layers.findIndex((L) => L.name === n); E.S.active = i; E.renderLayersPanel(); }, "🟧 " + st.stem);

    /* 4 Blender mode: ▾ Edit -> the view to the edit model, the result a NEW layer */
    await ev(() => { const s = document.getElementById("genModeSel"); s.value = "image"; s.onchange(); }); await p.waitForTimeout(700);
    await p.selectOption("#pmOpSel", "edit"); await p.waitForTimeout(900);
    const g0 = await ev(() => ({ go: document.getElementById("go").textContent, chip: !document.getElementById("pmBlendChip").hidden }));
    check("Blender mode with the Blender layer picked: the chip, the button reads \"✏ Edit · 🟧 Blender\"", g0.chip && g0.go === "✏ Edit · 🟧 Blender", g0);
    const n0 = await ev(() => window.imageEditorInstance.E.S.layers.length);
    await ev(() => { document.getElementById("prompt").value = "a photo of a red armchair in a sunny room"; }); await p.click("#go");
    await p.waitForFunction((n) => window.imageEditorInstance.E.S.layers.length > n, n0, { timeout: 60000 });
    await p.waitForTimeout(500);
    const e1 = await ev(() => { const E = window.imageEditorInstance.E, top = E.S.layers.find((L) => /edit: a photo of a red armchair/.test(L.name)); const d = top ? top.canvas.getContext("2d").getImageData(600, 300, 1, 1).data : null;
      return { last: window.__rq[window.__rq.length - 1], act: E.layer().name, preview: !!E.S.preview, thumbs: document.querySelectorAll("#kxResults .kxth").length, top: top && top.name, px: d && [...d], n: E.S.layers.length, aboveBlend: top ? E.S.layers.indexOf(top) > E.S.layers.findIndex((L) => !!L.bscene) : false }; });
    check("✏ Edit: the scene's view (the moved red cube, not a blank canvas) goes to the edit model with the prompt",
      e1.last.mode === "edit" && e1.last.prompt === "a photo of a red armchair in a sunny room" && e1.last.red > 20 && e1.last.white < e1.last.n * 0.5 && e1.last.w > 0, e1.last);
    check("...the result is a NEW LAYER above the Blender layer (the green stand-in) - nothing previewed over the canvas, no thumbnails left; the Blender layer stays picked",
      e1.n === n0 + 1 && /^🟧 .* edit: a photo of a red armchair/.test(e1.top) && e1.px && e1.px[1] > 240 && e1.px[0] < 20 && !e1.preview && e1.thumbs === 0 && e1.act === "🟧 " + st.stem && e1.aboveBlend, e1);
    // a Blender render of the view first
    await ev(() => { const r = document.getElementById("kblRef"); if (r) { r.value = "WORKBENCH"; r.dispatchEvent(new Event("change")); } else window.imageEditorInstance.E.store.set("bl.ref", "WORKBENCH"); });
    const n1 = await ev(() => window.imageEditorInstance.E.S.layers.length);
    await p.click("#go");
    await p.waitForFunction((n) => window.imageEditorInstance.E.S.layers.length > n, n1, { timeout: 240000 });
    const e2 = await ev(() => window.__rq[window.__rq.length - 1]);
    check("Edit from \"Blender render - Solid\": Blender renders the view at the picture's size (lib/blendView.still), that picture to the edit model -> another new layer", e2.red > 20 && e2.mode === "edit" && e2.white < e2.n * 0.5, e2);

    /* 5 the timeline's 🟧 takes the tools back */
    await ev(() => window.imageEditorInstance.E.blendLayer.start()); await p.waitForTimeout(1500);
    const t0 = await ev(() => document.getElementById("tlBlendView").parentNode.id);
    await ev(() => document.getElementById("tlTool_blend").click()); await p.waitForTimeout(1200);
    const t1 = await ev(() => ({ parent: document.getElementById("tlBlendView").parentNode.id, wrap: document.getElementById("ieBlendWrap").style.display, open: window.imageEditorInstance.E.blendLayer.isOpen(), on: window.TlBlend.state.on }));
    check("the timeline's own 🟧 while the editor has the tools: they go back to the timeline (shown there), the editor's overlay closes", t0 === "ieBlendWrap" && t1.parent === "tlCanvasWrap" && t1.wrap === "none" && !t1.open && t1.on, { t0, t1 });
    await ev(() => window.TlBlend.show(false));
    check("no page errors", errs.length === 0, errs);
  } catch (e) { check("crashed: " + (e.stack || e), false); }
  finally {
    try { await api("/api/blendview/close", {}); await api("/api/projects/load", { name: "default" }); } catch { /* fine */ }
    try { fs.rmSync(path.join(ROOT, "projects", P), { recursive: true, force: true }); fs.rmSync(T, { recursive: true, force: true }); } catch { /* fine */ }
    await b.close();
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
