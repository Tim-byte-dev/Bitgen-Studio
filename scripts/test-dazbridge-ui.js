#!/usr/bin/env node
/* bitGen Studio — 2.405.0: what the Daz Studio bridge sends, in a REAL browser + a REAL Blender: the MERGE dialog.
 * Tim (verbatim): "can we add option to merge daz3d scene with blender scene - create a dialog for list of objects,
 * lights, cameras to merge. dialogs must have a titlebar".
 *   1. a Daz scene sent to merge while a .blend is open in the 🟧 preview -> the Merge dialog opens by itself: a title
 *      bar (its name, ✕) that drags the dialog, the Daz scene's Figures & objects / Lights / Cameras with a tick each,
 *      all / none per group, the scene-camera choice (only ticked cameras), stretch the range
 *   2. untick the prop, pick the Daz camera, Merge -> Blender appends the ticked ones (the figure with its body under it)
 *      into the open .blend; the preview reloads with them, without the prop, the Daz camera the scene camera
 *   3. Esc / ✕ close it (kept to merge later); "Open on its own" opens the Daz scene instead; Cancel dismisses it
 *   4. a picture from Daz -> the Gallery shows it; no page errors
 * Run against the running app (H3_URL, default :8311). No Playwright / no Blender = SKIP (exit 0). */
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
if (!chromium) { console.log("SKIP: playwright is not installed here - the Daz merge browser test did not run"); console.log("\nRESULT: 0 failed"); process.exit(0); }
let exe = "";
try { exe = execSync("command -v blender", { encoding: "utf8", shell: "/bin/bash" }).trim(); } catch { exe = ""; }
if (!exe) { console.log("SKIP: Blender is not installed here - the Daz merge browser test did not run"); console.log("\nRESULT: 0 failed"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const ROOT = path.join(__dirname, "..");
const P = "zz_dazui_" + process.pid;
let pass = 0, fail = 0;
const check = (n, cond, got) => {
  if (cond) { pass++; console.log("PASS: " + n); }
  else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); }
};
const api = async (u, body) => (await fetch(URL_ + u.replace(/^\//, ""), body === undefined ? {} :
  { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();
const T = fs.mkdtempSync(path.join(os.tmpdir(), "dazui_"));
fs.writeFileSync(path.join(T, "mk.py"), `
import bpy, sys
for o in list(bpy.data.objects): bpy.data.objects.remove(o)
sc = bpy.context.scene; sc.render.fps = 30
bpy.ops.object.armature_add(location=(0, 0, 0)); arm = bpy.context.active_object; arm.name = "Genesis 9"
bpy.ops.mesh.primitive_cylinder_add(radius=0.2, depth=1.7, location=(0, 0, 0.85)); body = bpy.context.active_object; body.name = "Genesis 9 Mesh"
body.parent = arm; m = body.modifiers.new("Armature", "ARMATURE"); m.object = arm
vg = body.vertex_groups.new(name="Bone"); vg.add([v.index for v in body.data.vertices], 1.0, "REPLACE")
arm.keyframe_insert("location", frame=0); arm.location = (2, 0, 0); arm.keyframe_insert("location", frame=30)
bpy.ops.mesh.primitive_cube_add(size=1, location=(3, 3, 0.5)); bpy.context.active_object.name = "Crate"
bpy.ops.object.light_add(type="SPOT", location=(4, -4, 5)); bpy.context.active_object.name = "Spotlight 1"
bpy.ops.object.camera_add(location=(0, -8, 1.6), rotation=(1.5, 0, 0)); bpy.context.active_object.name = "Camera 1"
bpy.ops.export_scene.fbx(filepath=sys.argv[-2], bake_anim=True, add_leaf_bones=False)
for o in list(bpy.data.objects): bpy.data.objects.remove(o)
sc.render.fps = 24; sc.frame_start = 1; sc.frame_end = 48
bpy.ops.mesh.primitive_plane_add(size=20); bpy.context.active_object.name = "Ground"
bpy.ops.mesh.primitive_cube_add(location=(-3, 2, 1)); bpy.context.active_object.name = "Box"
bpy.ops.object.camera_add(location=(0, -12, 3), rotation=(1.35, 0, 0)); c = bpy.context.active_object; c.name = "Cam"; sc.camera = c
bpy.ops.wm.save_as_mainfile(filepath=sys.argv[-1])
`);
execFileSync(exe, ["-b", "--factory-startup", "-P", path.join(T, "mk.py"), "--", path.join(T, "daz.fbx"), path.join(T, "Stage.blend")], { stdio: "ignore", timeout: 300000 });
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc2=size=800x800", "-frames:v", "1", path.join(T, "still.png")]);
const send = (b) => api("/api/daz/send", Object.assign({ kind: "scene", file: path.join(T, "daz.fbx"), name: "Daz Shot", fps: 30, start: 0, end: 30, merge: true }, b));

(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const p = await b.newPage({ viewport: { width: 2000, height: 1250 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
  try {
    await api("/api/projects/load", { name: P });
    await api("/api/blendview/open", { path: path.join(T, "Stage.blend") });
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => window.TlDaz && window.TlBlend && typeof dsReady !== "undefined" && dsReady, null, { timeout: 30000 });
    await p.evaluate(() => {
      const d = document.getElementById("timelinedock");
      if (/collapsed|dockgone/.test(d.className) && typeof toggleCollapse === "function") toggleCollapse("timelinedock");
      setVar("th", 820);
      if (document.getElementById("tlStage").classList.contains("off")) document.getElementById("tlStageTog").click();
    });
    await p.evaluate(() => TlBlend.reload());
    await p.waitForFunction(() => TlBlend.state.st && TlBlend.node("Box"), null, { timeout: 30000 });
    // 1
    const r1 = await send({});
    check("the Daz scene sent to merge: bitGen holds it (state merge, into Stage)", r1.state === "merge" && r1.into === "Stage", r1);
    await p.waitForFunction(() => document.getElementById("dzMergeDlg") && document.getElementById("dzMergeDlg").open, null, { timeout: 15000 });
    const d1 = await p.evaluate(() => {
      const dl = document.getElementById("dzMergeDlg"), bar = dl.querySelector(".dz-title");
      const g = (k) => [...dl.querySelectorAll(`fieldset[data-g="${k}"] input[data-obj]`)].map((x) => x.dataset.obj);
      return { title: bar && bar.querySelector("h2").textContent, x: !!bar.querySelector(".dz-x"), first: dl.firstElementChild === bar,
        figs: g("figures"), lights: g("lights"), cams: g("cameras"), allChecked: [...dl.querySelectorAll("input[data-obj]")].every((x) => x.checked),
        camOpts: [...dl.querySelectorAll("#dzCam option")].map((o) => o.value), sub: dl.querySelector(".dz-sub").textContent };
    });
    check("the Merge dialog opens by itself with a TITLE BAR (its name + ✕) at the top", d1.title === "Merge the Daz scene" && d1.x && d1.first, d1);
    check("... listing the Daz scene: Figures & objects (Genesis 9, Crate), Lights (Spotlight 1), Cameras (Camera 1), all ticked",
      JSON.stringify(d1.figs) === '["Genesis 9","Crate"]' && JSON.stringify(d1.lights) === '["Spotlight 1"]' && JSON.stringify(d1.cams) === '["Camera 1"]' && d1.allChecked
      && /Daz Shot/.test(d1.sub) && /30 fps/.test(d1.sub) && /into the open scene Stage/.test(d1.sub), d1);
    check("... the scene camera: keep the scene's own, or a ticked Daz camera", JSON.stringify(d1.camOpts) === '["","Camera 1"]', d1.camOpts);
    if (process.env.H3_SHOT) await p.screenshot({ path: process.env.H3_SHOT });
    const box0 = await p.evaluate(() => { const r = document.getElementById("dzMergeDlg").getBoundingClientRect(); return [r.left, r.top]; });
    const bar = await (await p.$("#dzMergeDlg .dz-title h2")).boundingBox();
    await p.mouse.move(bar.x + 30, bar.y + 10); await p.mouse.down(); await p.mouse.move(bar.x + 150, bar.y + 90, { steps: 6 }); await p.mouse.up();
    const box1 = await p.evaluate(() => { const r = document.getElementById("dzMergeDlg").getBoundingClientRect(); return [r.left, r.top]; });
    check("dragging the title bar moves the dialog", Math.abs(box1[0] - box0[0] - 120) < 3 && Math.abs(box1[1] - box0[1] - 80) < 3, { box0, box1 });
    await p.evaluate(() => { document.querySelector('#dzMergeDlg button[data-none="cameras"]').click(); });
    const noCam = await p.evaluate(() => [...document.querySelectorAll("#dzCam option")].map((o) => o.value));
    check("'none' on Cameras unticks them and the camera choice drops the Daz camera", JSON.stringify(noCam) === '[""]', noCam);
    await p.evaluate(() => { document.querySelector('#dzMergeDlg button[data-all="cameras"]').click(); });
    // 2
    await p.evaluate(() => {
      const x = document.querySelector('#dzMergeDlg input[data-obj="Crate"]'); x.checked = false; x.dispatchEvent(new Event("change"));
      document.getElementById("dzCam").value = "Camera 1";
    });
    await p.click("#dzMerge");
    await p.waitForFunction(() => !document.getElementById("dzMergeDlg").open && TlBlend.state.st && TlBlend.state.nodes["Genesis 9"], null, { timeout: 240000 });
    await p.waitForTimeout(500);
    const m = await p.evaluate(() => ({ ids: Object.keys(TlBlend.state.nodes).sort(), cam: TlBlend.state.meta.camera, stem: TlBlend.state.st.stem }));
    check("Merge: the preview reloads with the figure (and its body), the light and the Daz camera - the prop left out, Stage's own objects kept",
      m.stem === "Stage" && ["Genesis 9", "Genesis 9 Mesh", "Spotlight 1", "Camera 1", "Box", "Ground", "Cam"].every((x) => m.ids.includes(x)) && !m.ids.includes("Crate"), m);
    check("... the Daz camera is the scene camera now", m.cam === "Camera 1", m.cam);
    const meta = (await api("/api/blendview/current")).meta;
    const g9 = (meta.objects || []).find((o) => o.id === "Genesis 9") || {};
    check("... in Blender's file: the figure animated, its keys respaced from Daz's 30 fps to Stage's 24 (frame 31 -> 25)",
      g9.animated && Array.isArray(g9.keys) && g9.keys.includes(1) && g9.keys.includes(25), g9);
    // 3
    const r2 = await send({ name: "Daz Shot B" });
    await p.waitForFunction(() => document.getElementById("dzMergeDlg").open, null, { timeout: 15000 });
    await p.keyboard.press("Escape");
    const escClosed = await p.evaluate(() => !document.getElementById("dzMergeDlg").open);
    const still = (await api("/api/daz/item/" + r2.id)).state;
    check("Esc closes the dialog - the Daz scene stays waiting to be merged", escClosed && still === "merge", { escClosed, still });
    await p.evaluate(async (id) => { const it = await (await fetch("/api/daz/item/" + id)).json(); TlDaz.open(it); }, r2.id);
    await p.click("#dzOpen");
    await p.waitForFunction(() => TlBlend.state.st && /^Daz_Shot_B/.test(TlBlend.state.st.stem) && TlBlend.state.nodes.Crate && !document.getElementById("dzMergeDlg").open, null, { timeout: 240000 });
    const own = await p.evaluate(() => ({ stem: TlBlend.state.st.stem, ids: Object.keys(TlBlend.state.nodes) }));
    check("'Open on its own': the Daz scene opens in the preview instead (all of it, the prop too)", own.ids.includes("Crate") && own.ids.includes("Genesis 9"), own);
    await api("/api/blendview/open", { path: path.join(T, "Stage.blend") });
    await p.evaluate(() => TlBlend.reload());
    const r3 = await send({ name: "Daz Shot C" });
    await p.waitForFunction(() => document.getElementById("dzMergeDlg").open, null, { timeout: 15000 });
    await p.click("#dzCancel");
    await p.waitForTimeout(600);
    const it3 = await api("/api/daz/item/" + r3.id);
    check("Cancel: closed and dismissed (not merged)", it3.dismissed === true && !it3.merged && await p.evaluate(() => !document.getElementById("dzMergeDlg").open), it3);
    // 4
    const pic = await api("/api/daz/send", { kind: "picture", file: path.join(T, "still.png"), name: "Daz still" });
    await p.evaluate(() => document.querySelector('[data-gtab="images"]').click());
    await p.waitForFunction((n) => document.querySelector(`.thumb[data-name="${n}"]`), pic.picture, { timeout: 15000 }).catch(() => {});
    check("a picture from Daz -> the Gallery shows it", pic.ok && !!(await p.$(`.thumb[data-name="${pic.picture}"]`)), pic);
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
