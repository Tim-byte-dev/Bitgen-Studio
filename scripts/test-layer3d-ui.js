#!/usr/bin/env node
/* bitGen Studio — 2.460.0 in a REAL browser: a DAZ / BLENDER SCENE AS A 3D LAYER (pc3d.js + lib/layer3d.js + a real
 * Blender): Layer ▸ New 3D Layer picks a Daz send (a fixture .blend in blender/daz/), the 🧊 3D tab, a bone turned (the
 * picture changes, one undo step back), the views, 🖐 dragging the view, 🎥 the scene camera, ▶ Render with EEVEE,
 * ✨ Generate from it (the Edit mode + the prompt docker), the .bgi keeps the layer's scene / camera / pose.
 * Tim: "bridge daz3d to image editor and timeline - allow me to move the camera and adjust poses in daz3d through the
 * image editor or timeline docker. use the image in the daz layer to generate a new image"
 * Against the running app (H3_URL, default the e2e server on :8311). No Playwright or no Blender = SKIP. */
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
if (!BLENDER) { console.log("SKIP: Blender is not installed here - the 3D layer browser test did not run"); process.exit(0); }
if (!chromium) { console.log("SKIP: playwright is not installed here - the 3D layer browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const ROOT = path.join(__dirname, "..");
const SHOTS = process.env.SHOTS || "";
let pass = 0, fail = 0;
const check = (n, cond, got) => {
  if (cond) { pass++; console.log("PASS: " + n); }
  else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); }
};

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1700, height: 1000 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message + " @ " + String(e.stack || "").split("\n").slice(1, 3).join(" | ")));
  const ev = (f, a) => p.evaluate(f, a);
  const shot = async (n) => { if (SHOTS) await p.screenshot({ path: path.join(SHOTS, n + ".png") }); };
  const tag = "zzl3d" + process.pid;
  let proj = "default", blend = "";
  try {
    try { await fetch(URL_ + "api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docks: { imageeditdock: { state: "open", hidden: false, maximized: false } } }) }); } catch { /* older */ }
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.dims, null, { timeout: 60000 });
    await p.waitForTimeout(800);
    proj = (await (await fetch(URL_ + "api/projects")).json()).current;
    const dazDir = path.join(ROOT, "projects", proj, "blender", "daz"); fs.mkdirSync(dazDir, { recursive: true });
    blend = path.join(dazDir, tag + ".blend");
    execSync(`"${BLENDER}" -b --factory-startup -P "${path.join(ROOT, "scripts", "make_layer3d_fixture.py")}" -- "${blend}"`, { stdio: "ignore", timeout: 300000 });
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await p.click("#kxFull"); await p.waitForTimeout(800);
    await ev(() => { const E = window.imageEditorInstance.E; E.docs.setTabs(true); E.openDoc(640, 480, "l3d.png", (g) => { g.fillStyle = "#fff"; g.fillRect(0, 0, 640, 480); }); });
    const L3 = () => ev(() => { const E = window.imageEditorInstance.E, L = E.layer(); if (!L || !L.l3d) return null; const g = L.canvas.getContext("2d"), d = g.getImageData(0, 0, L.canvas.width, L.canvas.height).data;
      let red = 0, blue = 0, armBlue = 0; for (let y = 0; y < 480; y += 2) for (let x = 0; x < 640; x += 2) { const i = (y * 640 + x) * 4; if (d[i] > 120 && d[i + 1] < 90 && d[i + 2] < 90) red++; if (d[i + 2] > 120 && d[i + 2] > d[i] + 50) { blue++; if (x >= 360 && x < 500 && y >= 180 && y < 240) armBlue++; } }
      return { name: L.name, l3d: JSON.parse(JSON.stringify(L.l3d)), red, blue, armBlue, undo: E.S.undo.length }; });
    const idle = async (ms) => { const t0 = Date.now(); await p.waitForTimeout(300); while (Date.now() - t0 < (ms || 60000)) { const b = await ev(() => { const L = window.imageEditorInstance.E.layer(); return !!(L && L.l3d && L.l3d.busy); }); if (!b) break; await p.waitForTimeout(250); } await p.waitForTimeout(200); };

    /* 1 Layer ▸ New 3D Layer (Daz / Blender)…: the Daz send is listed; Open */
    await ev(() => window.imageEditorInstance.E.ui.run("layer.new3d"));
    await p.waitForFunction(() => document.querySelectorAll(".kxdlg.pcd #l3Src option").length > 0, null, { timeout: 60000 }); await p.waitForTimeout(300);
    const opts = await ev(() => [...document.querySelectorAll(".kxdlg.pcd #l3Src option")].map((o) => o.textContent));
    const want = opts.findIndex((t) => t === "Daz · " + tag);
    check("Layer ▸ New 3D Layer (Daz / Blender)…: the scene sent from Daz is listed (\"Daz · " + tag + "\")", want >= 0, opts);
    await p.selectOption(".kxdlg.pcd #l3Src", String(want)); await p.click(".kxdlg.pcd .ok");
    await p.waitForFunction(() => { const L = window.imageEditorInstance.E.layer(); return L && L.l3d && !L.l3d.busy && L.l3d.last; }, null, { timeout: 300000 });
    await p.waitForTimeout(400);
    const a = await L3();
    await shot("1-opened");
    check("a 3D layer \"3D: " + tag + "\" drawn by Blender through the scene camera: the red body and the blue arm", a && a.name === "3D: " + tag && a.l3d.cam === null && a.red > 300 && a.armBlue > 200, a && { name: a.name, red: a.red, armBlue: a.armBlue, l3d: a.l3d });
    const tab = await ev(() => ({ on: document.getElementById("k3dBody").classList.contains("on"), yaw: document.getElementById("l3Yaw").value, dist: document.getElementById("l3Dist").value, bones: [...document.querySelectorAll("#l3Bone option")].map((o) => o.value).join(), arm: document.getElementById("l3Arm").value }));
    check("...the 🧊 3D tab shows it: the scene camera as Turn -90 / Distance 6, the figure + its bones", tab.on && tab.yaw === "-90" && tab.dist === "6" && tab.arm === "Figure" && tab.bones === "hip,arm", tab);

    /* 2 a bone turned: the picture changes; one undo step back */
    await p.selectOption("#l3Bone", "arm"); await p.fill("#l3NZ", "60"); await p.press("#l3NZ", "Enter"); await idle();
    const b = await L3();
    await shot("2-posed");
    check("the arm bone turned 60° (Z): the pose kept, the blue arm moved off its place", JSON.stringify(b.l3d.pose) === '{"Figure":{"arm":[0,0,60]}}' && b.armBlue < a.armBlue / 3, { pose: b.l3d.pose, arm: [a.armBlue, b.armBlue] });
    await ev(() => window.imageEditorInstance.E.undo()); await p.waitForTimeout(300);
    const bu = await L3();
    check("...one undo step: the arm back (pixels + pose)", JSON.stringify(bu.l3d.pose) === "{}" && Math.abs(bu.armBlue - a.armBlue) < 20, { pose: bu.l3d.pose, armBlue: bu.armBlue });
    await ev(() => window.imageEditorInstance.E.redo()); await p.waitForTimeout(300);

    /* 3 a view button, dragging the view, the scene camera */
    await p.click('#k3dBody [data-view="right"]'); await idle();
    const c = await L3();
    check("Right: the camera turns to the side (Turn 0) - another picture", c.l3d.cam && c.l3d.cam.yaw === 0 && Math.abs(c.red - a.red) + Math.abs(c.blue - a.blue) > 200, c.l3d.cam);
    await p.click("#l3Drag");
    const r = await ev(() => document.getElementById("kxPaper").getBoundingClientRect());
    await p.mouse.move(r.left + r.width / 2, r.top + r.height / 2); await p.mouse.down(); await p.mouse.move(r.left + r.width / 2 + 50, r.top + r.height / 2, { steps: 5 });
    const mid = await ev(() => document.getElementById("l3Yaw").value);
    await p.mouse.move(r.left + r.width / 2 + 100, r.top + r.height / 2, { steps: 5 }); await p.mouse.up(); await idle();
    const d = await L3();
    check("🖐 Drag the view: dragging right orbits (the Turn follows the pointer live: " + mid + "), Blender draws the view on release", d.l3d.cam && d.l3d.cam.yaw < -20 && d.l3d.cam.yaw > -60 && +mid < 0 && +mid > d.l3d.cam.yaw, { cam: d.l3d.cam, mid });
    await p.click("#l3Drag");
    await p.click("#l3Scene"); await idle();
    const e = await L3();
    check("🎥 Scene camera: back to the scene's own view (the first picture)", e.l3d.cam === null && Math.abs(e.red - a.red) < 40, { cam: e.l3d.cam, red: [a.red, e.red] });

    /* 4 ▶ Render with EEVEE at the layer's full size */
    await p.selectOption("#l3Eng", "EEVEE"); await p.click("#l3Render");
    await p.waitForFunction(() => /rendered 640 x 480 · EEVEE/.test((document.getElementById("l3Msg") || {}).textContent || ""), null, { timeout: 180000 });
    const f = await L3();
    check("▶ Render with EEVEE: the layer's full 640 x 480", f.l3d.last && f.l3d.last.w === 640 && f.l3d.last.engine === "EEVEE", f.l3d.last);

    /* 5 ✨ Generate from it: empty prompt = a message; with one = the Edit mode + the prompt docker's run */
    const g0 = await ev(() => { document.getElementById("prompt").value = ""; window.__gen = 0; window.__rg = window.runGenerate; window.runGenerate = () => { window.__gen++; }; return window.imageEditorInstance.E.layer3d.generate(window.imageEditorInstance.E.layer()); });
    await ev(() => { document.getElementById("prompt").value = "a photo of a man in a red coat waving, in a park"; });
    await p.click("#l3Gen"); await p.waitForTimeout(900);
    const g1 = await ev(() => { const r = { gen: window.__gen, mode: window.imageEditorInstance.E.S.aiMode }; window.runGenerate = window.__rg; return r; });
    check("✨ Generate from it: no prompt = it asks for one; with a prompt the editor goes to Edit and the prompt docker runs", g0 === false && g1.gen === 1 && g1.mode === "edit", { g0, g1 });

    /* 6 the .bgi keeps the 3D layer */
    await ev((n) => window.imageEditorInstance.E.bgi.save(n, false), tag);
    await ev((n) => window.imageEditorInstance.E.bgi.openFromProject(n + ".bgi"), tag); await p.waitForTimeout(900);
    const k = await ev(() => { const E = window.imageEditorInstance.E, L = E.S.layers.find((x) => x.l3d); return L ? { id: L.l3d.id, engine: L.l3d.engine, pose: L.l3d.pose } : null; });
    check("...the .bgi keeps the layer's scene, engine and pose", k && k.id === f.l3d.id && k.engine === "EEVEE" && JSON.stringify(k.pose) === '{"Figure":{"arm":[0,0,60]}}', k);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + e.stack); }
  finally {
    try { fs.rmSync(path.join(ROOT, "projects", proj, "bgi", tag + ".bgi"), { force: true }); if (blend) fs.rmSync(blend, { force: true }); for (const d of fs.readdirSync(path.join(ROOT, "projects", proj, "scene3d"))) if (d.startsWith(tag)) { try { await fetch(URL_ + "api/layer3d/" + d + "/close", { method: "POST" }); } catch { /* fine */ } fs.rmSync(path.join(ROOT, "projects", proj, "scene3d", d), { recursive: true, force: true }); } } catch { /* fine */ }
    await b.close();
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
