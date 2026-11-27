#!/usr/bin/env node
/* bitGen Studio — 2.982.0 in a REAL browser: 📏 a body from height / weight (DAZ Tools) + 🎬 Mixamo motion in 🕺 Pose.
 * Made-up data only: test-981's DOLL, test-982's mixamoFbx() (OUR OWN Mixamo-like ASCII FBX - read by the page's real
 * three.js FBXLoader through the real file input). The motion: the left elbow bends forward over 1 s while the hips walk
 * 40 cm; checked on the doll's own three.js bones; ⤓ Bake -> a new .glb that three.js's GLTFLoader loads with the clip. */
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
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/", ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
(async () => {
  if (!chromium) { console.log("SKIP: playwright is not installed here"); console.log("\nRESULT: 0 passed, 0 failed"); return; }
  const grab = (file, a, b) => { const t = fs.readFileSync(path.join(__dirname, file), "utf8"); return t.slice(t.indexOf(a), t.indexOf(b)); };
  const { makeDoll } = new Function("require", "path", "fs", grab("test-981.js", "const pt = ", "(async () => {") + "; return { makeDoll };")(require, path, fs);
  const { mixamoFbx } = new Function(grab("test-982.js", "/** a Mixamo-like ASCII FBX", "const grab = ") + "; return { mixamoFbx };")();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ui982_")), lib = path.join(tmp, "DollLib"), fbx = path.join(tmp, "Waving.fbx"); makeDoll(lib);
  fs.writeFileSync(fbx, mixamoFbx({ clip: "mixamo.com", duration: 1, steps: 10, keys: { LeftForeArm: (t) => ({ R: [0, -90 * t, 0] }), Hips: (t) => ({ T: [0, 100, 40 * t], R: [0, 0, 0] }) } }));
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] }), p = await b.newPage({ viewport: { width: 2400, height: 1150 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  let before = null; const made = [];
  try {
    before = (await (await p.request.get(URL_ + "api/dazlib")).json());
    await p.request.post(URL_ + "api/dazlib/roots", { data: { roots: [lib] } });
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await ev(() => { Object.keys(localStorage).filter((k) => /^h3\.(daztools|dazpose)\./.test(k)).forEach((k) => localStorage.removeItem(k)); });
    await p.reload({ waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3DazTools && window.H3DazPose && document.getElementById("dazTools"), null, { timeout: 60000 });
    await p.click("#dazTools");
    await p.waitForSelector("#dzLeft .dzit", { timeout: 15000 });
    await p.click("#dzGrid .dzit");
    await p.click("#dzMeasure summary");
    await p.click("#dzMRead");
    await p.waitForFunction(() => /Now:/.test(document.getElementById("dzMNow").textContent), null, { timeout: 30000 });
    const now = await ev(() => document.getElementById("dzMNow").textContent), kg0 = +((now.match(/([\d.]+) kg/) || [])[1]);
    check("📏 Measure it: the doll's height (176 cm), its weight from its volume, its tapes", /176\.0 cm/.test(now) && kg0 > 5 && /waist \d+/.test(now), now);
    const H = 185, W = +(kg0 * 1.25).toFixed(1);
    await p.fill("#dzMH", String(H)); await p.fill("#dzMW", String(W));
    const mr = p.waitForResponse((r) => r.url().includes("/api/dazlib/body/measures") && r.request().postData().includes('"target"'), { timeout: 60000 }), br = p.waitForResponse((r) => r.url().includes("/api/dazlib/build"), { timeout: 120000 });
    await p.click("#dzMMake");
    const mj = await (await mr).json(), bj = await (await br).json(); made.push(bj.model);
    await p.waitForFunction(() => /built|⚠/.test(document.getElementById("dzMsg").textContent), null, { timeout: 60000 });
    const ci = await ev(() => ({ name: H3DazTools.cur().name, n: H3DazTools.info().chars, last: H3DazTools.cur().last }));
    check("▶ Make: 185 cm and 25% heavier reached with the doll's own dials (within 2%) - a NEW character, built", Math.abs(mj.after.height - H) / H < 0.02 && Math.abs(mj.after.weight - W) / W < 0.02 && ci.n === 2 && ci.name === "Doll · 📏 " + H + " cm " + W + " kg" && ci.last === bj.model, { after: mj.after, W, ci });
    // 🎬 the plain doll in 🕺 Pose + the Mixamo-like FBX through the real file input
    const plain = await (await p.request.post(URL_ + "api/dazlib/build", { data: { root: lib, rel: "People/Doll/Doll.duf", name: "ui982_doll" } })).json(); made.push(plain.model);
    await ev((m) => H3DazPose.open(m), plain.model);
    await p.waitForFunction(() => H3DazPose.info().bones > 0, null, { timeout: 30000 });
    check("🕺 Pose has 🎬 Motion (Mixamo) with the download words (FBX, Without Skin)", await ev(() => /Without Skin/.test(document.getElementById("pdpMotion").textContent) && !!document.getElementById("pdpFbxB")));
    await p.setInputFiles("#pdpFbx", fbx);
    await p.waitForFunction(() => /bones matched|⚠/.test(document.getElementById("pdpMsg").textContent), null, { timeout: 20000 });
    const msg = await ev(() => document.getElementById("pdpMsg").textContent);
    check("the FBX read by three.js's FBXLoader; Mixamo's bones matched to the doll's", /bones matched/.test(msg) && +((msg.match(/(\d+) bones matched/) || [])[1]) >= 10, msg);
    const look = (t) => ev((tt) => {
      H3DazPose.motion.play(false); H3DazPose.motion.at(tt);
      const v = H3DazPose.state.view, T = v.T, w = (id) => { const o = v.bones.get(id); o.updateWorldMatrix(true, false); return o.getWorldPosition(new T.Vector3()); };
      const a = w("lForearm"), h = w("lHand"), d = h.clone().sub(a).normalize(), hip = v.bones.get("hip").position;
      return { d: [d.x, d.y, d.z].map((x) => +x.toFixed(3)), hz: +hip.z.toFixed(4), w: H3DazPose.info().weights };
    }, t);
    const f0 = await look(0), f1 = await look(0.999);
    check("t 0: the doll's forearm out to the side, the hips home; t 1: the forearm points forward (+Z), the hips 40 cm x the leg scale on", f0.d[0] > 0.99 && Math.abs(f0.hz) < 1e-3 && f1.d[2] > 0.97 && Math.abs(f1.d[0]) < 0.25 && f1.hz > 0.3, { f0, f1 });
    check("💪 the doll's own flex follows the motion's elbow (our flex - it has no JCMs)", (f1.w.flex_lShldr || 0) > 0.7 && !(f0.w.flex_lShldr > 0.01), { f0: f0.w, f1: f1.w });
    await p.check("#pdpInPlace");
    check("In place: the hips stay home (no walk forward)", Math.abs((await look(0.999)).hz) < 1e-4);
    await ev(() => H3DazPose.motion.at(0)); await p.click("#pdpPlay"); await p.waitForTimeout(600);
    const tp = await ev(() => H3DazPose.state.motion.t); await p.click("#pdpPlay");
    check("▶ plays it (time moves on), ⏸ pauses", tp > 0.2, tp);
    await p.uncheck("#pdpInPlace");
    const bk = p.waitForResponse((r) => r.url().includes("/api/dazlib/motion/bake"), { timeout: 60000 });
    await p.click("#pdpBake");
    const bj2 = await (await bk).json(); made.push(bj2.model);
    check("⤓ Bake: a new .glb (the character + the FBX's name), 31 frames at 30 a second", /^ui982_doll_daz(_\d+)?_Waving\.glb$/.test(bj2.model) && bj2.frames === 31 && bj2.channels >= 3, bj2);
    const gl = await ev(async (m) => { const T = await window.H3THREE; const g = await new Promise((ok, no) => new H3THREE.GLTFLoader().load("/api/tlcanvas/model/" + encodeURIComponent(m), ok, undefined, no)); const c = g.animations[0]; return { n: g.animations.length, name: c && c.name, dur: c && c.duration, tracks: c ? c.tracks.map((t) => t.name) : [] }; }, bj2.model);
    check("three.js's GLTFLoader loads the baked .glb with its clip - the forearm's turn, the hips' walk, the muscle shapes' weights", gl.n === 1 && Math.abs(gl.dur - 1) < 0.01 && gl.tracks.some((t) => /lForearm\.quaternion/.test(t)) && gl.tracks.some((t) => /hip\.position/.test(t)) && gl.tracks.some((t) => /morphTargetInfluences/.test(t)), gl);
    await p.click("#pdpMotOff");
    check("✕: back to posing by hand (the bones at rest)", await ev(() => !H3DazPose.state.motion && Math.abs(H3DazPose.state.view.bones.get("hip").position.z) < 1e-6 && Object.keys(H3DazPose.info().pose).length === 0));
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + e.message); }
  try { await ev(() => { Object.keys(localStorage).filter((k) => /^h3\.(daztools|dazpose)\./.test(k)).forEach((k) => localStorage.removeItem(k)); }); } catch (e) { /* fine */ }
  try { await p.request.post(URL_ + "api/dazlib/roots", { data: { roots: (before && before.roots && before.detected && before.roots.join() !== before.detected.join()) ? before.roots : [] } }); } catch (e) { /* fine */ }
  try { const d = path.join(ROOT, "projects"); for (const pr of fs.readdirSync(d)) for (const n of made) { const f = path.join(d, pr, "models3d", String(n || "")); if (n && fs.existsSync(f)) fs.rmSync(f); } } catch (e) { /* fine */ }
  fs.rmSync(tmp, { recursive: true, force: true });
  await b.close();
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
