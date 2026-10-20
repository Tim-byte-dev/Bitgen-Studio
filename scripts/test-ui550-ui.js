#!/usr/bin/env node
/* bitGen Studio — 2.550.0 in a REAL browser (WebGL) + a REAL Blender:
 *   - a rigged (skinned) figure in the Blender view: a click picks its ARMATURE (the mesh alone only moved the widget),
 *     moving it moves the figure; a plain cube is picked as before (ext/timelinedock/blendview.js pickOwner)
 *   - the image editor: Paste drops the selection, the Move tool moves the pasted layer; a selection with none of the
 *     layer's pixels moves the whole layer; ⤡ Transform (Ctrl+T) skews with Ctrl + an edge (pctools.js skewFor)
 *   - Generate with a selection sends the prompt docker's style (Krea 2 …) - a seamless fill (lib/inpaintLatent.js)
 *   - a right-click on a ▣ docker's title bar: Rename / layout / Make permanent - Float it again / Delete docker
 * Tim: "i can't select objects in a blender scene. when an object is selected only the move widget moves, not the actual
 * object ... when a selection is made, it generates a new image not a seamless fill/blend like the krita ai does ...
 * the move tool doesn't work. make the move tool move the selection or layer, add a transform tool, ctrl T, to scale,
 * rotate, skew ... add a right click context menu when user right clicks the new titlebar to delete docker".
 * Against the running app (H3_URL). No Playwright = SKIP; no Blender = the Blender part is skipped. */
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
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.550.0 browser test did not run"); process.exit(0); }
let exe = ""; try { exe = execSync("command -v blender", { encoding: "utf8", shell: "/bin/bash" }).trim(); } catch { exe = ""; }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const ROOT = path.join(__dirname, "..");
const P = "zz_ui550_" + process.pid;
const LAYF = path.join(ROOT, "panel_layout.cfg");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const api = async (u, body) => (await fetch(URL_ + u.replace(/^\//, ""), body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();

const T0 = fs.mkdtempSync(path.join(os.tmpdir(), "ui550_"));
const SRC = path.join(T0, "Rig Shot.blend");
if (exe) {
  fs.writeFileSync(path.join(T0, "make.py"), `
import bpy, sys
for o in list(bpy.data.objects): bpy.data.objects.remove(o)
sc=bpy.context.scene; sc.frame_start=1; sc.frame_end=10
sc.render.resolution_x, sc.render.resolution_y = 1280, 720
bpy.ops.mesh.primitive_cube_add(location=(4,0,1)); c=bpy.context.active_object; c.name="Crate"
bpy.ops.object.armature_add(location=(-2,0,0)); arm=bpy.context.active_object; arm.name="Rig"
bpy.ops.object.mode_set(mode="EDIT"); b=arm.data.edit_bones[0]; b.head=(0,0,0); b.tail=(0,0,3); bpy.ops.object.mode_set(mode="OBJECT")
bpy.ops.mesh.primitive_cylinder_add(radius=0.6, depth=3, location=(-2,0,1.5)); body=bpy.context.active_object; body.name="Body"
body.select_set(True); arm.select_set(True); bpy.context.view_layer.objects.active=arm
bpy.ops.object.parent_set(type="ARMATURE_AUTO")
bpy.ops.object.camera_add(location=(0,-14,4), rotation=(1.35,0,0)); cam=bpy.context.active_object; cam.name="Cam"; sc.camera=cam
bpy.ops.object.light_add(type="SUN", location=(0,0,10))
bpy.ops.wm.save_as_mainfile(filepath=sys.argv[-1])
`);
  execFileSync(exe, ["-b", "--factory-startup", "-P", path.join(T0, "make.py"), "--", SRC], { stdio: "ignore", timeout: 300000 });
}

(async () => {
  const keep = fs.existsSync(LAYF) ? fs.readFileSync(LAYF) : null;
  fs.rmSync(LAYF, { force: true });
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const p = await b.newPage({ viewport: { width: 1900, height: 1150 } });
  await p.addInitScript(() => { window.__H3_PENDING_AUTO = true; });   // 2.556.0: results straight in, as when this test was written (no ⏳ Pending)
  const errs = []; p.on("pageerror", (e) => errs.push(e.message + " @ " + String(e.stack || "").split("\n").slice(1, 3).join(" | ")));
  p.setDefaultTimeout(30000);
  const ev = (f, a) => p.evaluate(f, a);
  try {
    await api("/api/projects/load", { name: P });
    let st = null;
    if (exe) { st = await api("/api/blendview/open", { path: SRC }); if (!st.stem) throw new Error("the scene did not open: " + JSON.stringify(st)); }
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.TlBlend && window.H3DockGroup && window.imageEditorInstance && window.imageEditorInstance.E, null, { timeout: 60000 });
    await p.waitForTimeout(1500);

    /* 1 Blender: the rigged figure */
    if (exe) {
      await ev(() => { const d = document.getElementById("timelinedock"); if (d.classList.contains("dockgone")) toggleDockGone("timelinedock", "tT"); if (d.classList.contains("collapsed")) toggleCollapse("timelinedock"); });
      await ev(() => document.getElementById("tlTool_blend").click());
      await p.waitForFunction(() => window.TlBlend.state.st && window.TlBlend.state.on && window.TlBlend.node("Rig"), null, { timeout: 120000 });
      // the view big (the docker is small in this layout)
      await ev(() => { const v = document.getElementById("tlBlendView"); Object.assign(v.style, { position: "fixed", left: "100px", top: "80px", width: "1200px", height: "700px", zIndex: "9000" }); window.dispatchEvent(new Event("resize")); });
      await p.waitForTimeout(800);
      await ev(() => { window.TlBlend.setView("scene"); window.TlBlend.draw(); });
      await p.waitForTimeout(400);
      const at = (name) => ev((name) => { const TB = window.TlBlend, n = TB.node(name), cam = TB._cam(), cv = document.getElementById("tlbGl"), r = cv.getBoundingClientRect();
        const T = n.constructor; const box = []; n.updateMatrixWorld(true);
        let sk = null; n.traverse((o) => { if (!sk && (o.isMesh || o.isSkinnedMesh)) sk = o; });
        const o = sk || n; if (o.isSkinnedMesh) o.computeBoundingBox(); else if (o.geometry) o.geometry.computeBoundingBox();
        const bb = (o.boundingBox || o.geometry.boundingBox).clone().applyMatrix4(o.matrixWorld), c = bb.getCenter(bb.min.clone());
        const v = c.clone().project(cam); return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height, cx: c.x, cy: c.y, cz: c.z }; }, name);
      const body = await at("Body");
      await p.mouse.click(body.x, body.y); await p.waitForTimeout(300);
      const s1 = await ev(() => window.TlBlend.state.sel);
      check("a click on the rigged figure picks its ARMATURE (Rig) - the mesh alone does not move", s1 === "Rig", { s1, body });
      const crate = await at("Crate");
      await p.mouse.click(crate.x, crate.y); await p.waitForTimeout(300);
      check("a click on the plain cube picks it (Crate)", (await ev(() => window.TlBlend.state.sel)) === "Crate");
      await ev(() => window.TlBlend.select("Body")); await p.waitForTimeout(200);
      check("picking the figure's mesh in the object list picks the rig too (it says so)", (await ev(() => window.TlBlend.state.sel)) === "Rig");
      const b0 = await at("Body");
      await ev(() => { const TB = window.TlBlend, t = TB.trs("Rig"); t.t = [t.t[0] + 2, t.t[1], t.t[2]]; TB.setTrs(t); TB.draw(); });
      await p.waitForTimeout(300);
      const b1 = await at("Body");
      check("moving the picked rig moves the FIGURE (its skinned body 2 m along)", Math.abs((b1.cx - b0.cx) - 2) < 0.3, { b0, b1 });
      await ev(() => { document.getElementById("tlBlendView").removeAttribute("style"); window.TlBlend.show(false); });
    } else console.log("SKIP: Blender is not installed - the rigged-figure checks did not run");

    /* 2 the image editor: paste + Move, transform with skew */
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await p.click("#kxFull"); await p.waitForTimeout(800);
    await ev(() => new Promise((ok) => { const c = document.createElement("canvas"); c.width = 400; c.height = 300; const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, 400, 300); g.fillStyle = "#f00"; g.fillRect(50, 50, 80, 60); window.imageEditorInstance.load(c.toDataURL("image/png"), "mv550"); setTimeout(ok, 700); }));
    const TT = async (x, y) => { const v = await ev(() => { const s = window.imageEditorInstance.state; return { z: s.zoom, x: s.panX, y: s.panY }; }); const r = await p.locator("#ieStage").boundingBox(); return [r.x + v.x + x * v.z, r.y + v.y + y * v.z]; };
    const drag = async (x0, y0, x1, y1, mods) => { const [a, c] = await TT(x0, y0), [d, e] = await TT(x1, y1); for (const m of mods || []) await p.keyboard.down(m); await p.mouse.move(a, c); await p.mouse.down(); await p.mouse.move(d, e, { steps: 8 }); await p.mouse.up(); for (const m of mods || []) await p.keyboard.up(m); await p.waitForTimeout(150); };
    const box = () => ev(() => { const E = window.imageEditorInstance.E; return { box: E.alphaBox(E.layer().canvas), sel: E.hasSel(), name: E.layer().name }; });
    await p.locator("#ieStage").focus(); await p.keyboard.press("m");
    await drag(45, 45, 135, 115);
    await p.keyboard.press("Control+c"); await p.keyboard.press("Control+v"); await p.waitForTimeout(300);
    const pb = await box();
    check("Paste: a new layer in the middle, the selection dropped (it sat on the copied area)", pb.name === "Pasted Layer" && !pb.sel && pb.box && pb.box.x > 140, pb);
    await p.keyboard.press("v");
    await drag(200, 150, 260, 190);
    const mb = await box();
    check("the Move tool moves the pasted layer (60, 40 along)", mb.box && Math.abs(mb.box.x - (pb.box.x + 60)) <= 1 && Math.abs(mb.box.y - (pb.box.y + 40)) <= 1, { pb, mb });
    // a selection with none of the layer's pixels: the whole layer moves
    await ev(() => { const E = window.imageEditorInstance.E, s = new Uint8Array(E.S.w * E.S.h); for (let y = 10; y < 40; y++) for (let x = 10; x < 40; x++) s[y * E.S.w + x] = 255; E.setSel(s, true); });
    await drag(20, 20, 30, 20);
    const mb2 = await box();
    check("a selection with none of the layer's pixels in it: the Move tool moves the whole layer (10 along)", mb2.box && Math.abs(mb2.box.x - (mb.box.x + 10)) <= 1, { mb, mb2 });
    await ev(() => window.imageEditorInstance.E.deselect());
    // ⤡ Transform: the button on the Move tool's bar, Ctrl+T, skew with Ctrl + the bottom edge
    check("the Move tool's bar has ⤡ Transform", await ev(() => !!document.getElementById("pcXform")));
    await p.locator("#ieStage").focus(); await p.keyboard.press("Control+t"); await p.waitForTimeout(200);
    const x0 = await ev(() => window.imageEditorInstance.E.S.tool);
    const bx = mb2.box, bottom = [bx.x + bx.w / 2, bx.y + bx.h];
    await drag(bottom[0], bottom[1], bottom[0] + 40, bottom[1], ["Control"]);
    const sk = await ev(() => ({ kx: +document.getElementById("ptXkx").value, ky: +document.getElementById("ptXky").value }));
    await p.keyboard.press("Enter"); await p.waitForTimeout(200);
    const after = await ev(() => { const E = window.imageEditorInstance.E, L = E.layer(), g = L.canvas.getContext("2d"); return { tool: E.S.tool, box: E.alphaBox(L.canvas) }; });
    check("Ctrl+T = Free Transform; Ctrl + drag the bottom edge = a horizontal skew (the skew field shows it); Enter keeps it - the shape is wider (slanted)",
      x0 === "transform" && sk.kx > 20 && after.tool !== "transform" && after.box && after.box.w > bx.w + 25, { x0, sk, after, bx });

    /* 3 Generate with a selection: the prompt docker's style goes (a seamless fill) */
    const sty = await ev(async () => { const E = window.imageEditorInstance.E, eng = E.S.engines || (await (await fetch("/api/aiedit/engines")).json());
      const sel = document.getElementById("styleSel"), fill = (eng.inpaint || []).find((x) => x.id !== document.getElementById("ieStyle").value && [...sel.options].some((o) => o.value === x.id));
      return { fill: fill ? fill.id : "", ie: document.getElementById("ieStyle").value }; });
    if (sty.fill) {
      await ev((id) => { const E = window.imageEditorInstance.E; window.__rq = []; E.api.aiedit = async (req) => { window.__rq.push({ mode: req.mode, style: req.style_id }); return { jobs: [] }; };
        const s = document.getElementById("genModeSel"); s.value = "image"; s.onchange(); const st = document.getElementById("styleSel"); st.value = id; if (st.onchange) st.onchange();
        if (window.H3ImgOp) window.H3ImgOp.set("generate"); E.setAiMode("generate"); E.ui.showTab("kxAi");
        const m = new Uint8Array(E.S.w * E.S.h); for (let y = 100; y < 160; y++) for (let x = 100; x < 180; x++) m[y * E.S.w + x] = 255; E.setSel(m, true); }, sty.fill);
      await p.waitForTimeout(400);
      await ev(() => { document.getElementById("prompt").value = "a red hat"; window.H3TakeGenerate("image", "a red hat"); }); await p.waitForTimeout(800);
      const rq = await ev(() => window.__rq);
      check("✨ Generate with a selection: the fill uses the PROMPT DOCKER's style (not the editor's inpaint style)", rq.length === 1 && rq[0].mode === "generate" && rq[0].style === sty.fill, { rq, sty });
    } else console.log("SKIP: no second fill-capable style listed - the style check did not run");
    const en = await ev(async () => (await (await fetch("/api/aiedit/engines")).json()).inpaint.map((x) => x.name));
    check("the fill-capable styles now include the ones with their own graph (Krea 2)", en.some((n) => /^Krea 2/.test(n)), en);

    /* 4 a right-click on a ▣ docker's title bar */
    await ev(() => { const E = window.imageEditorInstance.E; if (E.setFull) E.setFull(false); }); await p.waitForTimeout(300);   // the editor out of full screen
    await p.keyboard.press("Control+Alt+KeyD"); await p.waitForTimeout(600);
    await ev(() => H3Panels.float("fd-dockers", { x: 400, y: 120, w: 700, h: 300 })); await p.waitForTimeout(200);
    const t = await ev(() => { const r = H3Panels.get("fd-dockers").win.querySelector(".h3fp-t .h3fp-n").getBoundingClientRect(); return { x: r.left + 10, y: r.top + r.height / 2 }; });
    await p.mouse.click(t.x, t.y, { button: "right" }); await p.waitForTimeout(200);
    const m1 = await ev(() => [...document.querySelectorAll(".dg-menu [data-i]")].map((x) => x.textContent));
    check("right-click on the floating ▣ docker's title: Rename… / Side by side / Stacked / Tabs / 📌 Make permanent / 🗑 Delete docker", m1.join("|") === "Rename…|Side by side|Stacked|Tabs|📌 Make permanent|🗑 Delete docker", m1);
    await ev(() => [...document.querySelectorAll(".dg-menu [data-i]")].find((x) => /Make permanent/.test(x.textContent)).click()); await p.waitForTimeout(600);
    const h = await ev(() => { const r = document.querySelector("#dgp_fd-dockers > .bhead").getBoundingClientRect(); return { x: r.left + 40, y: r.top + r.height / 2, h: document.getElementById("dgp_fd-dockers").getBoundingClientRect().height }; });
    check("made permanent from the menu - in the main column, with room (not squeezed out of sight)", h.h >= 110, h);
    await p.mouse.click(h.x, h.y, { button: "right" }); await p.waitForTimeout(200);
    const m2 = await ev(() => [...document.querySelectorAll(".dg-menu [data-i]")].map((x) => x.textContent));
    check("right-click on the permanent docker's title bar: … ⇱ Float it again / 🗑 Delete docker", m2.includes("⇱ Float it again") && m2.includes("🗑 Delete docker"), m2);
    await ev(() => [...document.querySelectorAll(".dg-menu [data-i]")].find((x) => /Delete docker/.test(x.textContent)).click());
    await p.waitForSelector("#note_ok", { state: "visible", timeout: 8000 }); await p.click("#note_ok"); await p.waitForTimeout(500);
    const gone = await ev(() => ({ el: !!document.getElementById("dgp_fd-dockers"), rec: !!H3Panels.get("fd-dockers"), btn: document.getElementById("tDG") && document.getElementById("tDG").textContent }));
    check("...🗑 Delete docker: the docker and its button gone (▣ Docker makes a new one)", !gone.el && !gone.rec && gone.btn === "▣ Docker", gone);
    const reg = await ev(() => { const h = document.querySelector("#musicdock > .bhead"); const e = new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 10, clientY: 10 }); h.dispatchEvent(e); return !!document.querySelector(".dg-menu"); });
    check("the built-in dockers have no such menu (only user-made ones)", !reg, reg);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { check("crashed: " + (e.stack || e), false); }
  finally {
    try { if (exe) await api("/api/blendview/close", {}); await api("/api/projects/load", { name: "default" }); } catch { /* fine */ }
    try { fs.rmSync(path.join(ROOT, "projects", P), { recursive: true, force: true }); fs.rmSync(T0, { recursive: true, force: true }); } catch { /* fine */ }
    if (keep) fs.writeFileSync(LAYF, keep); else fs.rmSync(LAYF, { force: true });
    await b.close();
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
