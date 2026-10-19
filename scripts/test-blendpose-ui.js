#!/usr/bin/env node
/* bitGen Studio — 2.461.0 in a REAL browser + a REAL Blender: POSES in the timeline's .blend preview (blendpose.js) and the
 * hand-over to the image editor / Daz. A posable fixture (scripts/make_layer3d_fixture.py) opened in 🟧: the Pose section
 * (figure + bones), a bone turned (the edits keep it, the three.js bone turns, Ctrl+Z takes it back), 💾 Save bakes it
 * into the .blend (Blender's pose bone = the turn), 🧊 To the image editor = a 3D layer with that pose + the free view,
 * 📡 View + pose → Daz queues the live link's commands.
 * Tim: "bridge daz3d to image editor and timeline - allow me to move the camera and adjust poses in daz3d through the
 * image editor or timeline docker"
 * Against the running app (H3_URL, default the e2e server on :8311), in a project of its own. No Playwright / Blender = SKIP. */
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
if (!chromium) { console.log("SKIP: playwright is not installed here - the timeline pose browser test did not run"); process.exit(0); }
let exe = "";
try { exe = execSync("command -v blender", { encoding: "utf8", shell: "/bin/bash" }).trim(); } catch { exe = ""; }
if (!exe) { console.log("SKIP: Blender is not installed here - the timeline pose browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const ROOT = path.join(__dirname, "..");
const P = "zz_bpose_" + process.pid;
let pass = 0, fail = 0;
const check = (n, cond, got) => { if (cond) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const api = async (u, body) => (await fetch(URL_ + u.replace(/^\//, ""), body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();
const T = fs.mkdtempSync(path.join(os.tmpdir(), "bpose_"));
const SRC = path.join(T, "Posed Fig.blend");
execFileSync(exe, ["-b", "--factory-startup", "-P", path.join(ROOT, "scripts", "make_layer3d_fixture.py"), "--", SRC], { stdio: "ignore", timeout: 300000 });

(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const p = await b.newPage({ viewport: { width: 2000, height: 1250 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  try {
    await api("/api/projects/load", { name: P });
    const st = await api("/api/blendview/open", { path: SRC });
    check("the .blend preview's meta lists the figure's bones (Figure: hip, arm)", JSON.stringify(st.meta && st.meta.armatures) === '[{"name":"Figure","bones":[{"name":"hip","parent":null},{"name":"arm","parent":"hip"}]}]', st.meta && st.meta.armatures);
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => window.TlCanvas && typeof dsReady !== "undefined" && dsReady && document.getElementById("tlTool_blend") && window.TlBlendPose, null, { timeout: 30000 });
    await ev(() => {
      const d = document.getElementById("timelinedock");
      if (/collapsed|dockgone/.test(d.className) && typeof toggleCollapse === "function") toggleCollapse("timelinedock");
      setVar("th", 820);
      if (document.getElementById("tlStage").classList.contains("off")) document.getElementById("tlStageTog").click();
    });
    await p.waitForTimeout(400);
    await p.click("#tlTool_blend");
    await p.waitForFunction(() => window.TlBlend && TlBlend.state.st && TlBlend.node("Figure") && document.getElementById("tlbPose"), null, { timeout: 60000 });
    await p.waitForTimeout(400);
    const sec = await ev(() => ({ arm: document.getElementById("tlbPArm").value, bones: [...document.querySelectorAll("#tlbPBone option")].map((o) => o.value).join(), to3d: !!document.getElementById("tlbTo3d"), daz: !!document.getElementById("tlbDaz") }));
    check("the Properties have a Pose section: the figure, its bones, 🧊 To the image editor, 📡 View + pose → Daz", sec.arm === "Figure" && sec.bones === "hip,arm" && sec.to3d && sec.daz, sec);
    const q = () => ev(() => { const n = TlBlend.state.nodes.Figure; let bo = null; n.traverse((o) => { if (!bo && o.isBone && o.name === "arm") bo = o; }); return bo ? [bo.quaternion.x, bo.quaternion.y, bo.quaternion.z, bo.quaternion.w].map((v) => Math.round(v * 1e4) / 1e4) : null; });
    const q0 = await q();
    await p.selectOption("#tlbPBone", "arm"); await p.waitForTimeout(200);
    await p.fill("#tlbPZ", "60"); await p.dispatchEvent("#tlbPZ", "change"); await p.waitForTimeout(900);
    const q1 = await q(), pose = await ev(() => TlBlend.state.E.pose), cur = await api("/api/blendview/current");
    check("a bone turned (arm Z 60): the edits keep it - here and on the server", JSON.stringify(pose) === '{"Figure":{"arm":[0,0,60]}}' && JSON.stringify(cur.edits && cur.edits.pose) === '{"Figure":{"arm":[0,0,60]}}', { pose, server: cur.edits });
    const ang = q0 && q1 ? 2 * Math.acos(Math.min(1, Math.abs(q0[0] * q1[0] + q0[1] * q1[1] + q0[2] * q1[2] + q0[3] * q1[3]))) * 180 / Math.PI : 0;
    check("...the preview's bone turns by 60° at once", Math.abs(ang - 60) < 0.5, { q0, q1, ang });
    await ev(() => TlBlend.undo()); await p.waitForTimeout(500);
    const q2 = await q(), pose2 = await ev(() => TlBlend.state.E.pose || null);
    check("...Ctrl+Z (undo) takes the turn back (the edits and the bone)", pose2 === null && JSON.stringify(q2) === JSON.stringify(q0), { pose2, q2, q0 });
    await p.fill("#tlbPZ", "60"); await p.dispatchEvent("#tlbPZ", "change"); await p.waitForTimeout(900);

    /* 💾 Save: Blender bakes the pose into the project's .blend */
    const sv = await api("/api/blendview/save", { stem: st.stem, mode: "bitgen" });
    const saved = path.join(ROOT, "projects", P, "blender", st.stem + ".blend");
    fs.writeFileSync(path.join(T, "chk.py"), `import bpy, json, math
from mathutils import Euler
pb = bpy.data.objects["Figure"].pose.bones["arm"]
d = Euler((0, 0, math.radians(60)), "XYZ").to_quaternion()
print("H3L check " + json.dumps({"mode": pb.rotation_mode, "err": min((pb.rotation_quaternion - d).magnitude, (pb.rotation_quaternion + d).magnitude)}), flush=True)
`);
    const out = fs.existsSync(saved) ? execFileSync(exe, ["-b", saved, "--factory-startup", "-P", path.join(T, "chk.py")], { encoding: "utf8", timeout: 300000 }) : "";
    const ln = out.split("\n").find((l) => l.startsWith("H3L check ")), res = ln ? JSON.parse(ln.slice(10)) : null;
    check("💾 Save: Blender wrote the pose into the project's .blend (arm = the 60° turn)", sv && !sv.error && res && res.mode === "QUATERNION" && res.err < 1e-4, { err: sv && sv.error, res });
    await p.waitForFunction(() => window.TlBlend && TlBlend.state.st && TlBlend.node("Figure") && document.getElementById("tlbPose"), null, { timeout: 60000 });

    /* 🧊 To the image editor: a 3D layer with this pose + the free view */
    await ev(() => { TlBlend.setView("free"); TlBlend.frameAll(); });
    await p.waitForTimeout(300);
    await ev(() => { if (TlBlend.state.E.pose == null) TlBlend.state.E.pose = { Figure: { arm: [0, 0, 60] } }; });
    await ev(() => window.TlBlendPose.to3d());
    await p.waitForFunction(() => { const E = window.imageEditorInstance && window.imageEditorInstance.E, L = E && E.layer(); return L && L.l3d && L.l3d.cam && !L.l3d.busy && L.l3d.last; }, null, { timeout: 180000 });
    await p.waitForTimeout(1500);
    const l3 = await ev(() => { const L = window.imageEditorInstance.E.layer(); return { pose: L.l3d.pose, cam: L.l3d.cam, last: L.l3d.last }; });
    check("🧊 To the image editor: a 3D layer of the scene with the pose and the free view (an orbit camera), drawn by Blender", JSON.stringify(l3.pose) === '{"Figure":{"arm":[0,0,60]}}' && l3.cam && l3.cam.dist > 0 && l3.last && l3.last.w > 0, l3);

    /* 📡 View + pose → Daz: the live link's queue */
    try { const d0 = await api("/api/daz/live/poll", { since: 0 }); await api("/api/daz/live/poll", { since: d0.seq }); } catch { /* fine */ }
    await ev(() => window.TlBlendPose.toDaz()); await p.waitForTimeout(400);
    const lv = await api("/api/daz/live/poll", { since: 0 });
    const view = lv.cmds.find((c) => c.type === "view"), ps = lv.cmds.find((c) => c.type === "pose");
    check("📡 View + pose → Daz: the free view (Daz cm) and the figure's turns wait for Daz's live link", view && view.cam.pos.length === 3 && ps && ps.figure === "Figure" && JSON.stringify(ps.bones) === '{"arm":[0,0,60]}', lv);
    await api("/api/daz/live/poll", { since: lv.seq });
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + e.stack); }
  finally {
    try { const ls = await api("/api/layer3d"); for (const it of ls.items || []) await api(`/api/layer3d/${it.id}/close`, {}); } catch { /* fine */ }
    await b.close();
    try { await api("/api/projects/load", { name: "default" }); } catch { /* fine */ }
    try { fs.rmSync(path.join(ROOT, "projects", P), { recursive: true, force: true }); } catch { /* fine */ }
    try { fs.rmSync(T, { recursive: true, force: true }); } catch { /* fine */ }
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
