#!/usr/bin/env node
/* bitGen Studio — 2.979.0 in a REAL browser: 🧍 Pose + 💪 the figure's own muscle reactions (JCMs) in the Sketcher.
 * A made-up library (test-979.js's makeLib - OUR OWN arm figure, no Daz content) set as the library folder, put back after.
 * POST /api/dazlib/build -> 📚 ▸ 🧍 Pose… -> three.js loads the skinned .glb (sparse morph targets): the elbow bent 90° -> the
 * JCM's weight 1 and the chained crease 0.5 ON THE MESHES; the hand really moves (skinning); the shoulder mirrored to the
 * other side; a click on the hand picks its bone; ↺ the whole pose; 💾 Keep comes back on reopening.
 * Tim: "is there a way we can do live physics like deform [a character's] lips ... physical muscle reactions to animate?" */
"use strict";
const path = require("path");
const fs = require("fs");
const os = require("os");
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
  const t979 = fs.readFileSync(path.join(__dirname, "test-979.js"), "utf8");
  const code = t979.slice(t979.indexOf("const pt = "), t979.indexOf("(async () => {"));
  const makeLib = new Function("require", "path", "fs", code + "; return makeLib;")(require, path, fs);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ui979_")), lib = path.join(tmp, "ArmLib"); makeLib(lib, true);
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] }), p = await b.newPage({ viewport: { width: 1700, height: 1050 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  let before = null, made = "";
  try {
    before = (await (await p.request.get(URL_ + "api/dazlib")).json());
    await p.request.post(URL_ + "api/dazlib/roots", { data: { roots: [lib] } });
    const br = await (await p.request.post(URL_ + "api/dazlib/build", { data: { root: lib, rel: "People/Arm/Arm.duf", name: "ui979_arm" } })).json();
    made = br.model || "";
    check("the build: <name>_daz.glb with 💪 2 muscle shapes from the figure's own JCM formulas", /^ui979_arm_daz(_\d+)?\.glb$/.test(made) && br.info.muscles.kind === "jcm" && br.info.muscles.shapes === 2, br.info && br.info.muscles);
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3PushPull && window.H3DazLib && window.H3DazPose && document.getElementById("tX_pushpulldock"), null, { timeout: 60000 });
    await ev(() => { const d = document.getElementById("pushpulldock"); if (d.classList.contains("dockgone")) toggleDockGone("pushpulldock", "tX_pushpulldock"); localStorage.setItem("h3.dockmax.off", "1"); H3PushPullFrame.toggleMaxed(true); });
    await p.waitForFunction(() => H3PushPull.state.booted && H3PushPull.state.V, null, { timeout: 40000 });
    await ev((m) => localStorage.removeItem("h3.dazpose." + m), made);
    await p.evaluate(() => H3DazLib.open());   // 2.983.0: the 📚 button toggles the DAZ dockers - the dialog by its API
    await p.waitForSelector("#pdlDlg[open]", { timeout: 10000 });
    check("📚 has 🧍 Pose…", await ev(() => !!document.getElementById("pdlPose")));
    await ev((m) => { H3DazLib.state.last = { model: m }; }, made);
    await p.click("#pdlPose");
    await p.waitForFunction(() => H3DazPose.info().bones > 0 || /⚠/.test(document.getElementById("pdpMsg").textContent), null, { timeout: 30000 });
    const i0 = await ev(() => Object.assign(H3DazPose.info(), { note: document.querySelector("#pdpDlg .pdp-note").textContent, kind: document.getElementById("pdpKind").textContent, msg: document.getElementById("pdpMsg").textContent, opts: [...document.querySelectorAll("#pdpBone option")].map((o) => o.textContent.trim()), rows: [...document.querySelectorAll("#pdpAxes .pdp-ax span")].map((s) => s.textContent) }));
    check("🧍 Pose opens: the not-a-replacement words; the skeleton found (5 bones); the JCMs said", /not a replacement for Daz Studio/.test(i0.note) && /very powerful character creator/.test(i0.note) && i0.bones === 5 && i0.muscles === "jcm" && /2 muscle shape/.test(i0.kind), i0);
    check("the bones listed (labels, in tree order); the forearm picked first, its rows X (twist) / Y / Z", i0.opts.join("|") === "Arm|Left Shoulder|Left Forearm|lHand|rShldr" && i0.sel === "lForearm" && i0.rows.join() === "X (twist),Y,Z", i0);
    const hand0 = await ev(() => { const v = H3DazPose.state.view, h = v.bones.get("lHand"); h.updateWorldMatrix(true, false); const q = h.getWorldPosition(new v.T.Vector3()); return [q.x, q.y, q.z]; });
    await ev(() => { const r = document.querySelector('#pdpAxes input[data-ax="y"]'); r.value = "-90"; r.dispatchEvent(new Event("input")); });
    const i1 = await ev(() => { const v = H3DazPose.state.view, h = v.bones.get("lHand"); h.updateWorldMatrix(true, false); const q = h.getWorldPosition(new v.T.Vector3()); return Object.assign(H3DazPose.info(), { hand: [q.x, q.y, q.z], out: document.querySelector('#pdpAxes input[data-ax="y"]').nextElementSibling.textContent, act: [...document.querySelectorAll("#pdpActive .pdp-act span")].map((s) => s.textContent) }); });
    const inf = i1.influences.filter((x) => "jcm:pJCMElbow" in x);
    check("the elbow bent 90°: the JCM's weight 1, the chained crease 0.5 - ON EVERY MESH that has them (three.js morph targets)", inf.length >= 1 && inf.every((x) => Math.abs(x["jcm:pJCMElbow"] - 1) < 1e-4 && Math.abs(x["jcm:pJCMElbowB"] - 0.5) < 1e-4) && i1.act.join() === "pJCMElbow,pJCMElbowB" && i1.out === "-90.0°", { inf, act: i1.act, out: i1.out });
    check("the hand really moves with the forearm (skinned): 25 cm round the elbow", Math.abs(Math.hypot(i1.hand[0] - hand0[0], i1.hand[2] - hand0[2]) - Math.SQRT2 * 0.25) < 0.01, { hand0, hand1: i1.hand });
    const px = await ev(() => { const c = document.getElementById("pdpView"), g = document.createElement("canvas"); g.width = c.width; g.height = c.height; const x = g.getContext("2d"); x.drawImage(c, 0, 0); const d = x.getImageData(0, 0, g.width, g.height).data; let lit = 0; for (let i = 0; i < d.length; i += 16) if (d[i] + d[i + 1] + d[i + 2] > 120) lit++; return lit; });
    check("the figure is drawn in the view", px > 200, px);
    await ev(() => H3DazPose.pick("lShldr"));
    await ev(() => { const r = document.querySelector('#pdpAxes input[data-ax="z"]'); r.value = "30"; r.dispatchEvent(new Event("input")); });
    const i2 = await ev(() => H3DazPose.info());
    check("Mirror: the left shoulder's turn goes to the right one, y / z the other way", i2.pose.lShldr.z === 30 && i2.pose.rShldr && i2.pose.rShldr.z === -30, i2.pose);
    await p.click("#pdpResetAll");
    const i3 = await ev(() => H3DazPose.info());
    check("↺ The whole pose: nothing turned, every muscle shape back to 0", Object.keys(i3.pose).length === 0 && i3.influences.every((x) => !x["jcm:pJCMElbow"] && !x["jcm:pJCMElbowB"]), i3);
    const mv = await ev(() => {
      const v = H3DazPose.state.view, m = v.meshes.find((x) => x.morphTargetDictionary && "jcm:pJCMElbow" in x.morphTargetDictionary), k = m.morphTargetDictionary["jcm:pJCMElbow"], A = m.geometry.morphAttributes.position[k];
      let best = 0, bi = -1; for (let i = 0; i < A.count; i++) { const l = Math.hypot(A.getX(i), A.getY(i), A.getZ(i)); if (l > best) { best = l; bi = i; } }
      const p0 = m.getVertexPosition(bi, new v.T.Vector3()); m.morphTargetInfluences[k] = 1; const p1 = m.getVertexPosition(bi, new v.T.Vector3()); m.morphTargetInfluences[k] = 0;
      return { best, moved: p1.distanceTo(p0), n: A.count, pos: m.geometry.attributes.position.count };
    });
    check("the sparse target really moves the vertices in three.js (the elbow's most-moved corner by its full delta)", mv.best > 0.003 && Math.abs(mv.moved - mv.best) < 1e-5 && mv.n === mv.pos, mv);
    // a click on the hand (projected from its rest place, a little in front of its skin) picks its bone
    const at = await ev(() => { const v = H3DazPose.state.view, c = document.getElementById("pdpView"), r = c.getBoundingClientRect(); v.ctl.update(); v.cam.updateMatrixWorld(); const q = new v.T.Vector3(0.575, 1.40, 0.039).project(v.cam); return [r.left + (q.x + 1) / 2 * r.width, r.top + (1 - q.y) / 2 * r.height]; });
    await p.mouse.click(at[0], at[1]);
    check("a click on the hand picks its bone", (await ev(() => H3DazPose.info().sel)) === "lHand", at);
    await ev(() => { H3DazPose.pick("lForearm"); const r = document.querySelector('#pdpAxes input[data-ax="y"]'); r.value = "-45"; r.dispatchEvent(new Event("input")); });
    await p.click("#pdpKeep");
    await p.click("#pdpX");
    await ev((m) => H3DazPose.open(m), made);
    await p.waitForFunction(() => H3DazPose.info().bones > 0, null, { timeout: 30000 });
    const i4 = await ev(() => H3DazPose.info());
    check("💾 Keep: the pose comes back when the character is opened again (the JCM between 0 and 1 at 45°)", i4.pose.lForearm && i4.pose.lForearm.y === -45 && i4.weights.pJCMElbow > 0.3 && i4.weights.pJCMElbow < 0.7, i4.pose);
    await p.uncheck("#pdpMuscle");
    check("💪 off: the shapes go back to 0 (the pose stays)", (await ev(() => H3DazPose.info().influences.every((x) => !x["jcm:pJCMElbow"]))) && (await ev(() => H3DazPose.info().pose.lForearm.y)) === -45);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + e.message); }
  try { await p.request.post(URL_ + "api/dazlib/roots", { data: { roots: (before && before.roots && before.detected && before.roots.join() !== before.detected.join()) ? before.roots : [] } }); } catch (e) { /* fine */ }
  try { const d = path.join(__dirname, "..", "projects"); for (const pr of fs.readdirSync(d)) { const f = path.join(d, pr, "models3d", made); if (made && fs.existsSync(f)) fs.rmSync(f); } } catch (e) { /* fine */ }
  fs.rmSync(tmp, { recursive: true, force: true });
  await b.close();
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
