#!/usr/bin/env node
/* bitGen Studio — 2.546.0 in a REAL browser (WebGL) + a REAL Blender: the Blender scene in the image editor - the
 * References docker's pictures with the scene, zoom (🔍＋ / 🔍－ / Alt+drag / ⌖ zoom to object), no player / Auto-key there.
 * Tim: "allow user to use reference images from reference docker when generating an image from a blender scene when in
 * image-edit docker, for example photo real blonde woman on a beach with face of woman in picture 1.if model needs image 1
 * instead of picture 1 change automatically to image n. add zoom in and zoom out controls for blender - alt+drag foward =
 * zoom in,alt+drag back=zoom out, add a zoom to object button. remove auto key and media player from image-edit mode"
 * (2.542.0's setup: a .blend made by Blender, the edit model a stand-in).
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
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.546.0 browser test did not run"); process.exit(0); }
let exe = ""; try { exe = execSync("command -v blender", { encoding: "utf8", shell: "/bin/bash" }).trim(); } catch { exe = ""; }
if (!exe) { console.log("SKIP: Blender is not installed here - the 2.546.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const ROOT = path.join(__dirname, "..");
const P = "zz_bl546_" + process.pid;
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const api = async (u, body) => (await fetch(URL_ + u.replace(/^\//, ""), body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();

const T = fs.mkdtempSync(path.join(os.tmpdir(), "bl546_"));
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
      window.__rq = []; window.__cq = [];
      const stat = async (blob) => { const im = await createImageBitmap(blob); const c = document.createElement("canvas"); c.width = im.width; c.height = im.height; c.getContext("2d").drawImage(im, 0, 0);
        const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; let red = 0, blue = 0, n = 0; for (let i = 0; i < d.length; i += 16) { n++; if (d[i] > 110 && d[i + 1] < 80 && d[i + 2] < 80) red++; if (d[i + 2] > 180 && d[i] < 60 && d[i + 1] < 60) blue++; } return { w: c.width, h: c.height, red, blue, n }; };
      E.api.aiedit = async (req) => { window.__rq.push({ mode: req.mode, prompt: req.prompt, w: req.width, h: req.height }); return { jobs: [{ id: "e" + window.__rq.length, seed: 3 }] }; };
      E.api.compose = async (req) => { const pics = []; for (const p of req.pics) pics.push(await stat(p)); window.__cq.push({ pics, names: req.names, scene_refs: req.scene_refs, prompt: req.prompt, style_id: req.style_id, w: req.width, h: req.height }); return { jobs: [{ id: "c" + window.__cq.length, seed: 4 }] }; };
      E.api.awaitResult = async () => { const c = document.createElement("canvas"); c.width = E.S.w || 64; c.height = E.S.h || 64; const g = c.getContext("2d"); g.fillStyle = "#00ff00"; g.fillRect(0, 0, c.width, c.height); return c.toDataURL("image/png"); };
      E.docs.setTabs(true);
    });

    /* 1 the tools in the editor: no player, no Auto-key; the zoom buttons */
    await p.click("#kblBtn");
    await p.waitForFunction(() => window.TlBlend.state.st && window.TlBlend.state.on && window.imageEditorInstance.E.layer() && window.imageEditorInstance.E.layer().bscene, null, { timeout: 120000 });
    await p.waitForTimeout(1200);
    const u1 = await ev(() => ({ bar: getComputedStyle(document.getElementById("tlbBar")).display, play: document.getElementById("tlbPlay").offsetWidth, auto: !!document.getElementById("tlbAuto"), ext: document.getElementById("tlBlendView").classList.contains("ext"),
      zoom: ["tlbZoomIn", "tlbZoomOut", "tlbZoomObj"].map((id) => !!document.getElementById(id) && document.getElementById(id).offsetWidth > 0) }));
    check("in the image editor the scene tools have no player (⏮ ▶ frame / In / Out bar gone) and no Auto-key; 🔍＋ 🔍－ ⌖ are there", u1.bar === "none" && u1.play === 0 && !u1.auto && u1.ext && u1.zoom.every(Boolean), u1);
    const f0 = await ev(() => window.TlBlend.state.frame);
    await ev(() => { const cv = document.getElementById("tlbGl"); cv.focus(); cv.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true })); });
    await p.waitForTimeout(600);
    check("Space does not play there", !(await ev(() => window.TlBlend.state.playing)) && (await ev(() => window.TlBlend.state.frame)) === f0);

    /* 2 zoom (the editor docker is small in this test layout: the scene tools' overlay made big for the mouse) */
    await ev(() => { const w = document.getElementById("ieBlendWrap"); Object.assign(w.style, { position: "fixed", left: "120px", top: "90px", width: "1000px", height: "620px", zIndex: "9000" }); });
    await p.waitForTimeout(600);
    await ev(() => window.TlBlend.setView("free")); await ev(() => window.TlBlend.frameAll()); await p.waitForTimeout(300);
    const look = () => ev(() => window.TlBlend.look());
    const z0 = await look();
    await p.click("#tlbZoomIn"); const z1 = await look();
    await p.click("#tlbZoomOut"); await p.click("#tlbZoomOut"); const z2 = await look();
    check("🔍＋ moves the view closer (the same point), 🔍－ further", z1.dist < z0.dist * 0.85 && z2.dist > z1.dist * 1.4 && Math.abs(z1.target[0] - z0.target[0]) < 1e-6, { z0, z1, z2 });
    const box = await ev(() => { const r = document.getElementById("tlbGl").getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    const a0 = await look();
    await p.keyboard.down("Alt"); await p.mouse.move(box.x, box.y); await p.mouse.down(); await p.mouse.move(box.x, box.y - 120, { steps: 10 }); await p.mouse.up(); await p.keyboard.up("Alt");
    const a1 = await look();
    await p.keyboard.down("Alt"); await p.mouse.move(box.x, box.y); await p.mouse.down(); await p.mouse.move(box.x, box.y + 200, { steps: 10 }); await p.mouse.up(); await p.keyboard.up("Alt");
    const a2 = await look();
    check("Alt+drag forward (up) = zoom in, back (down) = zoom out - no orbit (it looks at the same point)", a1.dist < a0.dist * 0.7 && a2.dist > a1.dist * 1.5 && Math.abs(a1.target[1] - a0.target[1]) < 1e-6, { a0, a1, a2 });
    await ev(() => window.TlBlend.select("Cube")); await p.click("#tlbZoomObj"); await p.waitForTimeout(200);
    const o1 = await look();
    check("⌖ Zoom to object: the view centres on the picked cube (its middle, 1 m up in Blender = y 1 here), close to it", Math.hypot(o1.target[0], o1.target[1] - 1, o1.target[2]) < 0.2 && o1.dist < 8, o1);
    await ev(() => window.TlBlend.select(null)); await p.click("#tlbZoomObj"); const o2 = await look();
    check("...nothing picked = the whole scene (further out: the 20 m ground)", o2.dist > o1.dist * 2, { o1, o2 });
    await ev(() => window.TlBlend.setView("scene")); await p.waitForTimeout(200);
    await p.click("#tlbZoomIn"); const s1 = await look();
    check("zooming from the 🎥 Scene camera: the free view takes over at the camera's place (and goes closer)", s1.view === "free", s1);

    /* 3 close the tools: the Blender layer; ✏ Edit with "picture 1" -> the scene + the References docker's picture 1 */
    await ev(() => document.getElementById("tlbClose").click()); await p.waitForTimeout(800);
    await ev(async () => { const E = window.imageEditorInstance.E, c = document.createElement("canvas"); c.width = 300; c.height = 400; const g = c.getContext("2d"); g.fillStyle = "#0000ff"; g.fillRect(0, 0, 300, 400);
      const blob = await new Promise((r) => c.toBlob(r, "image/png")); const c2 = document.createElement("canvas"); c2.width = 200; c2.height = 200; c2.getContext("2d").fillRect(0, 0, 200, 200);
      E.api.toRefs([{ blob, name: "woman.png" }, { blob: await new Promise((r) => c2.toBlob(r, "image/png")), name: "other.png" }]); });
    await p.waitForTimeout(300);
    await ev((n) => { const E = window.imageEditorInstance.E, i = E.S.layers.findIndex((L) => L.name === n); E.S.active = i; E.renderLayersPanel(); }, "🟧 " + st.stem);
    await ev(() => { const s = document.getElementById("genModeSel"); s.value = "image"; s.onchange(); }); await p.waitForTimeout(700);
    await p.selectOption("#pmOpSel", "edit"); await p.waitForTimeout(900);
    const refsRow = await ev(() => { window.imageEditorInstance.E.ui.showTab("kbl"); const s = document.getElementById("kblRefs"); return { v: s && s.value, n: document.getElementById("kblRefN") && document.getElementById("kblRefN").textContent }; });
    check("the 🟧 Blender tab: References = \"When the prompt names them\", says how many the References docker has", refsRow.v === "named" && /^2 in the References docker/.test(refsRow.n), refsRow);
    const n0 = await ev(() => window.imageEditorInstance.E.S.layers.length);
    await ev(() => { document.getElementById("prompt").value = "photo real blonde woman on a beach with face of woman in picture 1"; }); await p.click("#go");
    await p.waitForFunction((n) => window.imageEditorInstance.E.S.layers.length > n, n0, { timeout: 60000 });
    await p.waitForTimeout(400);
    const c1 = await ev(() => { const E = window.imageEditorInstance.E; return { q: window.__cq[window.__cq.length - 1], nq: window.__cq.length, ne: window.__rq.length, top: E.S.layers.map((L) => L.name).find((x) => /🖼 1/.test(x)), act: E.layer().name }; });
    check("✏ Edit naming \"picture 1\": the scene (the red cube, at the picture's size) AND the References docker's picture 1 (blue) go to the edit model together, scene_refs [1], the typed prompt as it is (the server words it for the model)",
      c1.nq === 1 && c1.ne === 0 && c1.q.pics.length === 2 && c1.q.pics[0].red > 20 && c1.q.pics[1].blue > c1.q.pics[1].n * 0.8 && JSON.stringify(c1.q.scene_refs) === "[1]"
      && c1.q.prompt === "photo real blonde woman on a beach with face of woman in picture 1" && c1.q.names[0] === "the 3D scene", c1);
    check("...the result is a new layer (\"… edit + 🖼 1\"), the Blender layer stays picked", !!c1.top && /^🟧 /.test(c1.top) && c1.act === "🟧 " + st.stem, c1);
    // the server's own words for the models (the route + lib/refWords.js)
    const r1 = await ev(async () => { const fd = new FormData(); const c = document.createElement("canvas"); c.width = 64; c.height = 64; const bl = await new Promise((r) => c.toBlob(r, "image/png"));
      fd.append("pic0", bl, "a.png"); fd.append("pic1", bl, "b.png"); fd.append("names", JSON.stringify(["the 3D scene", "a woman"])); fd.append("scene_refs", "[1]"); fd.append("prompt", "a woman with the face of picture 1"); fd.append("style_id", "nope");
      const r = await fetch("/api/aiedit/compose", { method: "POST", body: fd }); return { s: r.status, j: await r.json() }; });
    check("/api/aiedit/compose takes scene_refs (an unknown style is refused in words - no render)", r1.s === 400 && /Edit model/.test(r1.j.error || ""), r1);
    // nothing named -> the scene alone (the edit as before); "Never" -> alone even when named
    const n1 = await ev(() => window.imageEditorInstance.E.S.layers.length);
    await ev(() => { document.getElementById("prompt").value = "a cosy room at night"; }); await p.click("#go");
    await p.waitForFunction((n) => window.imageEditorInstance.E.S.layers.length > n, n1, { timeout: 60000 });
    const c2 = await ev(() => ({ nq: window.__cq.length, ne: window.__rq.length, last: window.__rq[window.__rq.length - 1] }));
    check("no picture named: the scene alone to the edit model (as before)", c2.nq === 1 && c2.ne === 1 && c2.last.mode === "edit", c2);
    await ev(() => { const s = document.getElementById("kblRefs"); s.value = "never"; s.dispatchEvent(new Event("change")); });
    const n2 = await ev(() => window.imageEditorInstance.E.S.layers.length);
    await ev(() => { document.getElementById("prompt").value = "the woman in picture 1 on a beach"; }); await p.click("#go");
    await p.waitForFunction((n) => window.imageEditorInstance.E.S.layers.length > n, n2, { timeout: 60000 });
    const c3 = await ev(() => ({ nq: window.__cq.length, ne: window.__rq.length }));
    check("References: Never - the scene alone even when the prompt names a picture", c3.nq === 1 && c3.ne === 2, c3);
    await ev(() => { const s = document.getElementById("kblRefs"); s.value = "named"; s.dispatchEvent(new Event("change")); });

    /* 4 back in the timeline: the player and Auto-key come back */
    await ev(() => document.getElementById("tlTool_blend").click()); await p.waitForTimeout(1200);
    const t1 = await ev(() => ({ parent: document.getElementById("tlBlendView").parentNode.id, bar: getComputedStyle(document.getElementById("tlbBar")).display, auto: !!document.getElementById("tlbAuto"), ext: document.getElementById("tlBlendView").classList.contains("ext") }));
    check("in the timeline the player and Auto-key are there again", t1.parent === "tlCanvasWrap" && t1.bar !== "none" && t1.auto && !t1.ext, t1);
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
