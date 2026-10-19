#!/usr/bin/env node
/* bitGen Studio — 2.403.0: a .blend in the timeline's preview canvas, in a REAL browser (WebGL) + a REAL Blender.
 * Tim (verbatim): "can we preview the blender scene in our preview canvas (load the blend) file and navigate the scene,
 * select the segment we want to render to real? even better id we could edit the scene, move objects etc" - and: "put an
 * option dropdown in the properties for blender in our toolbox - to write back to blender, copy to new file, only render
 * in our scene, keep the blender filename.tmp in current project folder. save it as .blend if save button is pressed".
 * Run against the running app (H3_URL, default the e2e server on :8311) in a project of its own ("default" after).
 * No Playwright or no Blender = SKIP (exit 0).
 *   1. POST /api/blendview/open: <project>/blender/<name>.tmp + the preview .glb + meta; 🟧 shows it over the canvas;
 *   2. the scene draws (pixels), the scene camera + free view, the toolbox Properties swap in (Save to: 3 choices);
 *   3. a click on an object selects it (raycast); a still object's move = a new rest place, an animated one's = a key at
 *      the frame; duplicate / delete / undo / hide; the edits reach <name>.edits.json;
 *   4. 💾 Save with "Copy to a new file": <project>/blender/<name>.blend + <name>_bitgen.blend beside the original (the
 *      original untouched), the edits baked in (the reloaded preview has the moves, the duplicate is a real object);
 *   5. [ In / Out ] + Render to real through this view: Blender renders the segment -> Video assets (frames counted);
 *   6. ✕ gives the canvas's own Properties back; no page errors. */
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
if (!chromium) { console.log("SKIP: playwright is not installed here - the .blend preview browser test did not run"); console.log("\nRESULT: 0 failed"); process.exit(0); }
let exe = "";
try { exe = execSync("command -v blender", { encoding: "utf8", shell: "/bin/bash" }).trim(); } catch { exe = ""; }
if (!exe) { console.log("SKIP: Blender is not installed here - the .blend preview browser test did not run"); console.log("\nRESULT: 0 failed"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const ROOT = path.join(__dirname, "..");
const P = "zz_bvui_" + process.pid;
let pass = 0, fail = 0;
const check = (n, cond, got) => {
  if (cond) { pass++; console.log("PASS: " + n); }
  else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); }
};
const api = async (u, body) => (await fetch(URL_ + u.replace(/^\//, ""), body === undefined ? {} :
  { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();
const close = (a, b, e) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) < (e || 1e-3));

const T = fs.mkdtempSync(path.join(os.tmpdir(), "bvui_"));
const SRC = path.join(T, "My Shot.blend");
fs.writeFileSync(path.join(T, "make.py"), `
import bpy, sys
for o in list(bpy.data.objects): bpy.data.objects.remove(o)
sc=bpy.context.scene; sc.frame_start=1; sc.frame_end=48; sc.render.fps=24
sc.render.resolution_x, sc.render.resolution_y = 1280, 704
bpy.ops.mesh.primitive_plane_add(size=20); bpy.context.active_object.name="Ground"
bpy.ops.mesh.primitive_cube_add(location=(0,0,1)); c=bpy.context.active_object; c.name="Cube"
c.keyframe_insert("location",frame=1); c.location=(3,0,1); c.keyframe_insert("location",frame=48)
bpy.ops.mesh.primitive_uv_sphere_add(location=(-2,2,1)); bpy.context.active_object.name="Sphere"
bpy.ops.object.camera_add(location=(0,-12,5), rotation=(1.2,0,0)); cam=bpy.context.active_object; cam.name="Cam"; sc.camera=cam
bpy.ops.object.light_add(type="SUN", location=(0,0,10)); bpy.context.active_object.name="Sun"
bpy.ops.wm.save_as_mainfile(filepath=sys.argv[-1])
`);
execFileSync(exe, ["-b", "--factory-startup", "-P", path.join(T, "make.py"), "--", SRC], { stdio: "ignore", timeout: 300000 });
const srcBytes = fs.readFileSync(SRC);

(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const p = await b.newPage({ viewport: { width: 2000, height: 1250 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  try {
    await api("/api/projects/load", { name: P });
    const bd = path.join(ROOT, "projects", P, "blender");
    // 1
    const st = await api("/api/blendview/open", { path: SRC });
    const ids = ((st.meta || {}).objects || []).map((o) => o.id).sort();
    check("open: the .blend is copied to <project>/blender/My_Shot.tmp and exported (.glb + meta)",
      st.stem === "My_Shot" && fs.existsSync(path.join(bd, "My_Shot.tmp")) && fs.existsSync(path.join(bd, "My_Shot.glb"))
      && st.mode === "bitgen" && st.meta.camera === "Cam" && JSON.stringify(ids) === JSON.stringify(["Cam", "Cube", "Ground", "Sphere", "Sun"]), st);
    check("open: not a .blend / not there -> a plain error", /Blender file|not there/.test((await api("/api/blendview/open", { path: path.join(T, "make.py") })).error || "")
      && /not there/.test((await api("/api/blendview/open", { path: path.join(T, "nope.blend") })).error || ""));

    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => window.TlCanvas && typeof dsReady !== "undefined" && dsReady && document.getElementById("tlTool_blend"), null, { timeout: 30000 });
    await p.evaluate(() => {
      const d = document.getElementById("timelinedock");
      if (/collapsed|dockgone/.test(d.className) && typeof toggleCollapse === "function") toggleCollapse("timelinedock");
      setVar("th", 820);
      if (document.getElementById("tlStage").classList.contains("off")) document.getElementById("tlStageTog").click();
    });
    await p.waitForTimeout(400);
    await p.click("#tlTool_blend");
    await p.waitForFunction(() => window.TlBlend && TlBlend.state.st && TlBlend.node("Cube") && TlBlend.node("Sphere"), null, { timeout: 30000 });
    await p.waitForTimeout(500);
    // 2
    const vis = await p.evaluate(() => ({ ov: getComputedStyle(document.getElementById("tlBlendView")).display, props: !!document.getElementById("tlbMode"),
      canvasProps: document.getElementById("tlProps").style.display, opts: [...document.querySelectorAll("#tlbMode option")].map((o) => o.value),
      view: TlBlend.state.view, w: document.getElementById("tlbGl").width, h: document.getElementById("tlbGl").height }));
    check("🟧 shows the open scene over the preview canvas, at the render's aspect (1280x704)", vis.ov === "flex" && Math.abs(vis.w / vis.h - 1280 / 704) < 0.02, vis);
    check("the toolbox Properties are the scene's: Save to = Only bitGen | Write back | Copy (the canvas's own hidden)",
      vis.props && vis.canvasProps === "none" && JSON.stringify(vis.opts) === JSON.stringify(["bitgen", "writeback", "copy"]), vis);
    const pixels = async () => p.evaluate(() => {
      TlBlend.draw();
      const c = document.getElementById("tlbGl"), g = document.createElement("canvas"); g.width = 64; g.height = 36;
      const x = g.getContext("2d"); x.drawImage(c, 0, 0, 64, 36);
      const d = x.getImageData(0, 0, 64, 36).data; const set = new Set();
      for (let i = 0; i < d.length; i += 4) set.add((d[i] >> 4) + "," + (d[i + 1] >> 4) + "," + (d[i + 2] >> 4));
      return set.size;
    });
    check("the scene draws through the scene camera (many colours, not a blank canvas)", vis.view === "scene" && (await pixels()) > 6);
    await p.evaluate(() => { TlBlend.setView("free"); TlBlend.frameAll(); });
    check("🧭 free view draws too", (await pixels()) > 6);

    // 3: click the Sphere on screen -> selected
    await p.evaluate(() => { TlBlend.setView("scene"); TlBlend.goto(1); });     // the scene camera: the Sphere stands clear of the Cube
    const at = await p.evaluate(() => { const v = TlBlend.node("Sphere").getWorldPosition(new window.H3THREE.Vector3()); return { v: [v.x, v.y, v.z] }; });
    const scr = await p.evaluate((v) => {
      const T3 = window.H3THREE; const c = document.getElementById("tlbGl"); const r = c.getBoundingClientRect();
      const pv = new T3.Vector3(v[0], v[1], v[2]).project(TlBlend._cam());
      return { x: r.left + (pv.x + 1) / 2 * r.width, y: r.top + (1 - pv.y) / 2 * r.height };
    }, at.v);
    await p.mouse.click(scr.x, scr.y);
    await p.waitForTimeout(200);
    check("a click on the Sphere in the view selects it", await p.evaluate(() => TlBlend.state.sel) === "Sphere", await p.evaluate(() => TlBlend.state.sel));

    const moved = await p.evaluate(() => { const t = TlBlend.trs("Sphere"); t.t = [t.t[0] + 1, t.t[1], t.t[2] - 2]; TlBlend.setTrs(t); return TlBlend.trs("Sphere"); });
    await p.evaluate(() => { TlBlend.select("Cube"); TlBlend.goto(24); });
    const cubeAt24 = await p.evaluate(() => { const t = TlBlend.trs("Cube"); t.t = [t.t[0], t.t[1] + 2, t.t[2]]; TlBlend.setTrs(t); return TlBlend.trs("Cube"); });
    const E1 = await p.evaluate(() => JSON.parse(JSON.stringify(TlBlend.state.E.objects)));
    check("a still object's move = its new rest place (base); the animated Cube's = a key at frame 24 (no base)",
      close(E1.Sphere && E1.Sphere.base && E1.Sphere.base.t, moved.t) && !E1.Sphere.keys
      && E1.Cube && E1.Cube.keys && close(E1.Cube.keys["24"].t, cubeAt24.t) && !E1.Cube.base, E1);
    const between = await p.evaluate(() => { TlBlend.goto(12); const a = TlBlend.trs("Cube"); TlBlend.goto(24); return a; });
    check("the preview plays the Cube between Blender's key (frame 1) and yours (24): lifted half way up at frame 12",
      Math.abs(between.t[1] - (1 + (cubeAt24.t[1] - 1) * 11 / 23)) < 0.05, { between, cubeAt24 });
    await p.evaluate(() => { TlBlend.select("Sphere"); TlBlend.dup(); });
    const afterDup = await p.evaluate(() => ({ sel: TlBlend.state.sel, e: TlBlend.state.E.objects["Sphere.bg1"], n: !!TlBlend.node("Sphere.bg1") }));
    check("⧉ duplicates the Sphere as Sphere.bg1 beside it (selected)", afterDup.sel === "Sphere.bg1" && afterDup.e && afterDup.e.src === "Sphere" && afterDup.n, afterDup);
    await p.evaluate(() => { TlBlend.select("Ground"); TlBlend.del(); });
    const delOn = await p.evaluate(() => ({ d: !!(TlBlend.state.E.objects.Ground || {}).deleted, v: TlBlend.node("Ground").visible }));
    await p.evaluate(() => TlBlend.undo());
    const delOff = await p.evaluate(() => ({ d: !!(TlBlend.state.E.objects.Ground || {}).deleted, v: TlBlend.node("Ground").visible }));
    check("🗑 deletes the Ground (gone from the view); Ctrl+Z brings it back", delOn.d && !delOn.v && !delOff.d && delOff.v, { delOn, delOff });
    await p.evaluate(() => TlBlend.hide("Sun", true));
    await p.waitForTimeout(900);
    const onDisk = JSON.parse(fs.readFileSync(path.join(bd, "My_Shot.edits.json"), "utf8")).objects;
    check("the edits reach <project>/blender/My_Shot.edits.json (move, key, duplicate, hide)",
      onDisk.Sphere && onDisk.Sphere.base && onDisk.Cube && onDisk.Cube.keys && onDisk.Cube.keys["24"] && onDisk["Sphere.bg1"] && onDisk.Sun && onDisk.Sun.hidden === true
      && !(onDisk.Ground && onDisk.Ground.deleted), onDisk);

    // 4: 💾 Save, "Copy to a new file"
    await p.selectOption("#tlbMode", "copy");
    await p.waitForTimeout(400);
    check("the Save-to choice is kept for the scene", (await api("/api/blendview/current")).mode === "copy");
    await p.evaluate(() => TlBlend.save());
    await p.waitForFunction(() => !TlBlend.state.busy && TlBlend.node("Sphere.bg1") && TlBlend.state.nodes["Sphere.bg1"], null, { timeout: 240000 });
    await p.waitForTimeout(300);
    const copy = path.join(T, "My_Shot_bitgen.blend");
    check("💾 Save (copy): <project>/blender/My_Shot.blend + My_Shot_bitgen.blend beside the original; the original untouched",
      fs.existsSync(path.join(bd, "My_Shot.blend")) && fs.existsSync(copy) && fs.readFileSync(SRC).equals(srcBytes),
      fs.readdirSync(T).concat(fs.readdirSync(bd)));
    const after = await p.evaluate(() => ({ e: Object.keys(TlBlend.state.E.objects).length, s: TlBlend.trs("Sphere"), sun: TlBlend.node("Sun") && TlBlend.node("Sun").visible }));
    check("the edits are baked in: the reloaded preview has the Sphere where it was moved, the duplicate is a real object, no edits left",
      after.e === 0 && close(after.s.t, moved.t, 2e-3), { after, moved });
    const meta2 = (await api("/api/blendview/current")).meta;
    const cube2 = (meta2.objects || []).find((o) => o.id === "Cube") || {};
    check("Blender has the key at 24 on the Cube (its key frames now 1, 24, 48) and Sun hidden in the render",
      JSON.stringify(cube2.keys) === JSON.stringify([1, 24, 48]) && ((meta2.objects || []).find((o) => o.id === "Sun") || {}).hidden === true, meta2.objects);

    // 5: the segment through this view
    await p.evaluate(() => { TlBlend.setRange(3, 14); TlBlend.setView("free"); });
    const seg = await p.evaluate(() => document.getElementById("tlbSeg").textContent);
    check("[ In / Out ]: frames 3-14 = 0.5 s at 24 fps", /3–14 · 0\.5 s/.test(seg), seg);
    const rr = await p.evaluate(() => TlBlend.render({ view: true, render: false, engine: "WORKBENCH" }));
    const vids = fs.readdirSync(path.join(ROOT, "projects", P, "video")).filter((f) => /^blender_My_Shot_3-14/.test(f));
    let frames = 0;
    try { frames = +execFileSync("ffprobe", ["-v", "error", "-count_frames", "-select_streams", "v:0", "-show_entries", "stream=nb_read_frames", "-of", "csv=p=0", path.join(ROOT, "projects", P, "video", vids[0])], { encoding: "utf8" }).trim(); } catch { frames = 0; }
    check("Render to real (this view): Blender renders frames 3-14 -> Video assets (12 frames)", rr && rr.state === "done" && vids.length === 1 && frames === 12, { rr, vids, frames });
    check("the render line in the Properties says where it went", /✓ blender_My_Shot_3-14/.test(await p.evaluate(() => document.getElementById("tlBlendProps").textContent)));

    if (process.env.H3_SHOT) { await p.evaluate(() => { TlBlend.select("Cube"); TlBlend.setView("scene"); TlBlend.goto(20); }); await p.waitForTimeout(400); await p.screenshot({ path: process.env.H3_SHOT }); }
    // 6
    await p.evaluate(() => document.getElementById("tlbClose").click());
    const back = await p.evaluate(() => ({ ov: getComputedStyle(document.getElementById("tlBlendView")).display, props: document.getElementById("tlProps").style.display,
      mine: document.getElementById("tlBlendProps").style.display }));
    check("✕ gives the canvas back with its own Properties", back.ov === "none" && back.props !== "none" && back.mine === "none", back);
    check("no page errors", errs.length === 0, errs);
  } catch (e) {
    fail++; console.log("FAIL: the run stopped: " + (e && e.stack || e));
  } finally {
    try { await api("/api/blendview/close", {}); } catch { /* fine */ }
    try { await api("/api/projects/load", { name: "default" }); } catch { /* fine */ }
    await b.close();
    try { fs.rmSync(path.join(ROOT, "projects", P), { recursive: true, force: true }); } catch { /* fine */ }
    try { fs.rmSync(T, { recursive: true, force: true }); } catch { /* fine */ }
    console.log(`\nRESULT: ${fail} failed (${pass} passed)`);
    process.exit(fail ? 1 : 0);
  }
})();
