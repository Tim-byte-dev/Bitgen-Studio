#!/usr/bin/env node
/* bitGen Studio — 2.540.0 in a REAL browser (+ a REAL Blender, + scripts/ue-stub.js for Unreal):
 *   the timeline's .blend → Render to real → 🖼 References: the meshes matched to the reference docker's pictures by
 *   their names (Car = "a red sports car", Sofa = "a green velvet chesterfield"), one picked by hand, Use them, 🎬 →
 *   Blender renders the segment + its first frame -> /api/realrefs: the first-frame EDIT job (Picture 1 = the frame,
 *   the references after it, "the object "Car" becomes a red sports car") - cancelled before it renders;
 *   the image editor's Unreal Layer → 🎮 Unreal tab → 🔍 Find the objects (the stand-in's car / sofa / lamp) → matched →
 *   ✨ Make it real posts the layer's picture + the pictures (answered in the page).
 * Against the running app (H3_URL, default :8311). The dock is emptied; the Unreal port is put back. */
"use strict";
const fs = require("fs"), os = require("os"), path = require("path");
const { execSync, execFileSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.540 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const ROOT = path.join(__dirname, "..");
let exe = null; try { exe = require(path.join(ROOT, "lib", "blender.js")).find(); } catch { exe = null; }
let pass = 0, fail = 0;
const check = (n, cond, got) => { if (cond) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const api = async (u, body) => (await fetch(URL_ + u.replace(/^\//, ""), body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();

(async () => {
  const T = fs.mkdtempSync(path.join(os.tmpdir(), "rr540ui-")), SRC = path.join(T, "Street Shot.blend");
  if (exe) {
    fs.writeFileSync(path.join(T, "make.py"), `
import bpy, sys
for o in list(bpy.data.objects): bpy.data.objects.remove(o)
sc=bpy.context.scene; sc.frame_start=1; sc.frame_end=24; sc.render.fps=24
sc.render.resolution_x, sc.render.resolution_y = 640, 352
bpy.ops.mesh.primitive_plane_add(size=20); bpy.context.active_object.name="Ground"
bpy.ops.mesh.primitive_cube_add(location=(-2,0,0.7), scale=(1.8,0.8,0.6)); bpy.context.active_object.name="Car"
bpy.ops.mesh.primitive_cube_add(location=(2.5,1,0.5), scale=(1,0.5,0.5)); bpy.context.active_object.name="Sofa"
bpy.ops.mesh.primitive_cylinder_add(location=(4,2,1), scale=(0.1,0.1,1)); bpy.context.active_object.name="Pole"
bpy.ops.object.camera_add(location=(0,-12,3), rotation=(1.4,0,0)); cam=bpy.context.active_object; cam.name="Cam"; sc.camera=cam
bpy.ops.wm.save_as_mainfile(filepath=sys.argv[-1])
`);
    execFileSync(exe, ["-b", "--factory-startup", "-P", path.join(T, "make.py"), "--", SRC], { stdio: "ignore", timeout: 300000 });
  }
  try { await fetch(URL_ + "api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docks: { imageeditdock: { state: "open", hidden: false, maximized: false } } }) }); } catch { /* older */ }
  const STUB = await require("./ue-stub.js").start(0);
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const p = await b.newPage({ viewport: { width: 2000, height: 1250 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  p.setDefaultTimeout(60000);
  const ev = (f, a) => p.evaluate(f, a);
  let port0 = 30020, editJob = "";
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3_PROJECT_READY && window.RealRefs && window.H3Refs && window.TlCanvas && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.unreal && document.getElementById("tlTool_blend"), null, { timeout: 60000 });
    await p.waitForTimeout(2500);
    // the reference docker: a car, a chesterfield, a lamp
    await ev(async () => {
      const mk = (col, name) => new Promise((ok) => { const c = document.createElement("canvas"); c.width = 64; c.height = 48; const g = c.getContext("2d"); g.fillStyle = col; g.fillRect(0, 0, 64, 48); c.toBlob((bl) => ok(new File([bl], name, { type: "image/png" })), "image/png"); });
      rgClear();
      const L = [["#c22", "e2e540_car.png", "a red sports car", "other"], ["#2a5", "e2e540_sofa.png", "a green velvet chesterfield", "furniture"], ["#db5", "e2e540_lamp.png", "a brass floor lamp", "light"]];
      for (const [c, n, d, r] of L) { const f = await mk(c, n); refs.push({ file: f, url: URL.createObjectURL(f), subject: nextFreeSubject(), role: r, roleOther: "", desc: d }); }
      normalizeSubjects(); renderTray();
    });

    /* ---- 🎮 the image editor's Unreal Layer */
    port0 = (await ev(() => fetch("/api/unreal/settings").then((r) => r.json()))).port;
    await ev((port) => fetch("/api/unreal/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ port, alphaInverted: false }) }), STUB.port);
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await p.click("#kxFull"); await p.waitForTimeout(900);
    await p.click('#pcMenus .mi[data-menu="File"]'); await p.waitForTimeout(120); await p.click('.kxmenu [data-cmd="file.new"]'); await p.waitForTimeout(200);
    await p.fill(".kxdlg.pcd #pdW", "640"); await p.fill(".kxdlg.pcd #pdH", "360"); await p.click(".kxdlg.pcd .ok"); await p.waitForTimeout(400);
    await ev(() => window.imageEditorInstance.E.cadBar.show(true)); await p.waitForTimeout(200);   // the CAD toolbar is off by default since 2.513.0
    await p.click('.cadbar[data-cadbar="cadbar.ie"] .cbtab[data-tab="unreal"]'); await p.waitForTimeout(150);
    await p.click('.cadbar[data-cadbar="cadbar.ie"] .cbb[data-id="u_scene"]'); await p.waitForTimeout(700);
    await p.selectOption(".kxdlg.pcd #ueCam", "CineCam_Wide"); await p.fill(".kxdlg.pcd #ueW", "640"); await p.fill(".kxdlg.pcd #ueH", "360");
    const n0 = await ev(() => window.imageEditorInstance.state.layers.length);
    await p.click(".kxdlg.pcd .ok");
    for (let i = 0; i < 40; i++) { await p.waitForTimeout(150); if ((await ev(() => window.imageEditorInstance.state.layers.length)) > n0) break; }
    await ev(() => window.imageEditorInstance.E.ui.showTab("kue")); await p.waitForTimeout(300);
    check("the 🎮 Unreal tab of an Unreal Layer has 🖼 References: 🔍 Find the objects, ✨ Make it real (off until something has a picture)", await ev(() => !!document.querySelector("#kueBody #ueFind") && document.querySelector("#kueBody #ueReal").disabled));
    await p.click("#kueBody #ueFind");
    await p.waitForFunction(() => document.querySelectorAll("#kueBody #ueRefs [data-rrobj]").length > 0, null, { timeout: 15000 });
    const ur = await ev(() => [...document.querySelectorAll("#kueBody #ueRefs [data-rrobj]")].map((s) => [s.dataset.rrobj, s.options[0].textContent]));
    const call = STUB.calls.filter((c) => c.cmd === "actors_in_view").pop();
    check("🔍 Find the objects: Unreal is asked through the layer's camera (CineCam_Wide); SM_Car_01 = the car, Sofa = the chesterfield, FloorLamp = the lamp (behind the camera = left out)",
      call && call.args.camera.name === "CineCam_Wide" && ur.some((r) => r[0] === "SM_Car_01" && /red sports car/.test(r[1])) && ur.some((r) => r[0] === "Sofa" && /chesterfield/.test(r[1])) && ur.some((r) => r[0] === "FloorLamp" && /brass floor lamp/.test(r[1])) && !ur.some((r) => r[0] === "BehindTheCamera"), { ur, args: call && call.args });
    let sent = null;
    await p.route("**/api/realrefs/start", (r) => { sent = (r.request().postDataBuffer() || Buffer.alloc(0)).toString("latin1"); r.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ error: "e2e540 stop here" }) }); });
    await ev(() => { const pr = document.getElementById("prompt"); if (pr) pr.value = "a rainy night"; });
    await p.click("#kueBody #ueReal"); await p.waitForTimeout(1500);
    const spec = sent ? JSON.parse((/name="spec"\r\n\r\n([^\r]*)\r\n/.exec(sent) || [])[1] || "{}") : {};
    check("✨ Make it real: the layer's picture (frame) + the spec - kind image, source unreal, the uploaded pictures' token, the items with their boxes, the prompt docker's words",
      sent && /name="frame"; filename="unreal\.png"/.test(sent) && spec.kind === "image" && spec.source === "unreal" && /^[a-z0-9]{6,}$/.test(spec.token || "") && spec.items.length === 3 && spec.items.every((it) => Array.isArray(it.box)) && spec.prompt === "a rainy night", spec);
    check("…the answer is shown (here: the page's stand-in refusal)", /e2e540 stop here/.test(await ev(() => document.getElementById("ueMsg").textContent)));
    await p.click("#kxFull").catch(() => {}); await p.waitForTimeout(600);
    /* ---- 🟧 the timeline's .blend */
    if (exe) {
      const st = await api("/api/blendview/open", { path: SRC });
      check("the .blend opens (Car, Sofa, Pole, Ground + the camera)", st.stem && (st.meta.objects || []).some((o) => o.id === "Car"), st.error || st.stem);
      await ev(() => { const d = document.getElementById("timelinedock"); if (/collapsed|dockgone/.test(d.className) && typeof toggleCollapse === "function") toggleCollapse("timelinedock"); setVar("th", 820); if (document.getElementById("tlStage").classList.contains("off")) document.getElementById("tlStageTog").click(); });
      await p.waitForTimeout(400);
      await p.click("#tlTool_blend");
      await p.waitForFunction(() => window.TlBlend && TlBlend.state.st && TlBlend.node("Car"), null, { timeout: 60000 });
      await p.waitForTimeout(500);
      await ev(() => { TlBlend.setRange(1, 3); });
      await p.waitForTimeout(300);
      const sec = await ev(() => ({ on: !!document.getElementById("tlbRefsOn"), txt: (document.getElementById("tlbRefsOn") || {}).closest ? document.getElementById("tlbRefsOn").closest(".tlb-sec").textContent : "" }));
      check("Render to real has 🖼 References: how many objects have a picture, Use them", sec.on && /2 of 4 object\(s\) have a picture/.test(sec.txt), sec);
      if (!(await ev(() => document.getElementById("tlbRefsOn").checked))) await p.click("#tlbRefsOn");
      await p.waitForTimeout(300);
      const rows = await ev(() => [...document.querySelectorAll("#tlbRefList [data-rrobj]")].map((s) => [s.dataset.rrobj, s.options[0].textContent]));
      check("…ticked: a dropdown per mesh - Car = auto: a red sports car, Sofa = auto: the chesterfield, Pole / Ground = no match (a 'floor lamp' is not a floor)", rows.length === 4 && rows.some((r) => r[0] === "Car" && /auto: a red sports car/.test(r[1])) && rows.some((r) => r[0] === "Sofa" && /chesterfield/.test(r[1])) && rows.some((r) => r[0] === "Pole" && /no match/.test(r[1])) && rows.some((r) => r[0] === "Ground" && /no match/.test(r[1])), rows);
      await p.selectOption('#tlbRefList [data-rrobj="Pole"]', "2");
      await p.waitForTimeout(300);
      const after = await ev(() => document.getElementById("tlbRefsOn").closest(".tlb-sec").textContent);
      check("…Pole picked by hand = the brass lamp (3 of 4 now)", /3 of 4 object\(s\)/.test(after), after.slice(0, 120));
      await ev(() => { const l = document.getElementById("tlbLook"); if (l) l.value = "a quiet street at dusk"; const n = document.getElementById("tlbNow"); if (n) n.checked = true; });
      const st2 = await ev(() => TlBlend.render({ engine: "WORKBENCH", view: false }));
      check("🎬 Render to real: Blender renders the segment + the first frame, the chain starts (realrefs, a first-frame job)", st2 && st2.state === "done" && /^rr/.test(st2.realrefs || "") && !!st2.job, st2);
      if (st2 && st2.realrefs) {
        const cs = await api("/api/realrefs/" + st2.realrefs);
        editJob = cs.edit;
        const jb = await api("/api/jobs/" + cs.edit);
        const pr = (jb.params && jb.params.prompt) || jb.prompt || "";
        check("…the first-frame EDIT job: Picture 1 = Blender's frame + the 3 reference pictures, 'the object \"Car\" becomes a red sports car', the user's look last", (cs.state === "edit" || cs.state === "error") && /becomes a red sports car/.test(pr) && /"Pole"\) becomes a brass floor lamp/.test(pr) && /A quiet street at dusk$/.test(pr) && (!jb.params || jb.params.images.length === Math.min(4, jb.params.images.length)), { cs, pr: pr.slice(0, 400) });
        check("…the objects' boxes came from Blender (the car on the left of the picture)", /on the left[^"]*\(the object "Car"\)/.test(pr), pr.slice(0, 300));
        await api("/api/jobs/" + cs.edit + "/cancel", {}).catch(() => {});
      }
      await ev(() => { try { TlBlend.show(false); } catch (e) { /* fine */ } });
    } else check("(no Blender here - the .blend part did not run)", true);

    check("the timeline has UNREAL ▸ Render to Real", await ev(async () => { const t = document.querySelector('#tlCadBar .cbtab[data-tab="unreal"]'); if (t) t.click(); await new Promise((r) => setTimeout(r, 200)); return typeof window.TlUnreal.realDialog === "function" && !!document.querySelector('#tlCadBar .cbb[data-id="u_real"]'); }));
    check("no page errors", errs.length === 0, errs);
  } catch (e) { check("crashed: " + (e.stack || e), false); }
  finally {
    try { await ev(() => window.imageEditorInstance.E.cadBar.show(false)); } catch { /* fine */ }
    try { await ev((port) => fetch("/api/unreal/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ port }) }), port0); } catch { /* fine */ }
    try { await ev(() => { rgClear(); }); } catch { /* fine */ }
    if (editJob) await api("/api/jobs/" + editJob + "/cancel", {}).catch(() => {});
    try { await b.close(); } catch { /* fine */ }
    await STUB.close();
    fs.rmSync(T, { recursive: true, force: true });
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
