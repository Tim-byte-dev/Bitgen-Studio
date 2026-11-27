#!/usr/bin/env node
/* bitGen Studio — 2.985.0 in a REAL browser: Delete takes a picked DAZ character too (↶ brings it back); the model's pieces
 * listed with 👁; a pose that turns the whole figure (lying down) kept over a reload; 🔍 Zoom in the toolbox; 🏛 Architecture
 * hides / shows the building tools; ✨ Photo names the person and its depth map reaches the character.
 * Tim: "del button deletes the selected object including the daz characters. rendering via ai is not working (make photo) ...
 * daz characters and assets should be rendered too. show the added assets to the model like hair, eyes, mouth, genitals and
 * fix the pose positions from daz poses. add a zoom button to toolbar. add and architecture button to the top toolbar,
 * hide/show all the architecture tools when toggled". Our own made-up doll (test-981 / test-983) - no Daz content. */
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
  const grab = (file, a, b) => { const t = fs.readFileSync(path.join(__dirname, file), "utf8"); return t.slice(t.indexOf(a), t.indexOf(b)); };
  const { makeDoll } = new Function("require", "path", "fs", grab("test-981.js", "const pt = ", "(async () => {") + "; return { makeDoll };")(require, path, fs);
  const { dressDoll } = new Function("require", "path", "fs", grab("test-983.js", "/** the doll's wardrobe", "(async () => {") + "; return { dressDoll };")(require, path, fs);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ui985_")), lib = path.join(tmp, "DollLib");
  makeDoll(lib); dressDoll(lib);
  // our own LYING pose: the whole figure turned 90° (its own channel, no bone) + the hips lowered
  const lie = path.join(lib, "People/Doll/Poses/Lie down.duf");
  fs.writeFileSync(lie, JSON.stringify({ asset_info: { type: "preset_pose" }, scene: { animations: [
    { url: "name://@selection:?rotation/x/value", keys: [[0, -90]] }, { url: "name://@selection:?translation/y/value", keys: [[0, 15]] },
    { url: "name://@selection/hip:?translation/y/value", keys: [[0, -5]] }, { url: "name://@selection/lShldr:?rotation/z/value", keys: [[0, 20]] }] } }));
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] }), p = await b.newPage({ viewport: { width: 2100, height: 1100 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => { if (/shader|webglprogram/i.test(m.text())) errs.push(m.text().slice(0, 300)); });
  const ev = (f, a) => p.evaluate(f, a);
  const box = (id) => ev((i) => { const e = document.getElementById(i); if (!e) return null; const r = e.getBoundingClientRect(); return { l: Math.round(r.left), t: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), d: getComputedStyle(e).display }; }, id);
  const tile = (name) => p.locator("#dzGrid .dzit", { hasText: name }).first();
  const kind = async (k, name) => { await p.click('#dzTabs [data-kind="' + k + '"]'); await p.waitForFunction((n) => [...document.querySelectorAll("#dzGrid .dzit span")].some((s) => s.textContent === n), name, { timeout: 10000 }); };
  const built = (n) => p.waitForFunction((k) => H3DazScene.list().length === k && !H3DazTools.state.busy, n, { timeout: 60000 });
  const scr = (pt) => ev((q) => { const V = H3PushPull.state.V, s = V.screen(q), r = V.canvas.getBoundingClientRect(); return [r.left + s[0], r.top + s[1]]; }, pt);
  const camD = () => ev(() => { const V = H3PushPull.state.V, c = V.cam(); return c.position.distanceTo(V.controls.target) / (c.zoom || 1); });
  const boot = async () => {
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3DazTools && window.H3PPArch && document.getElementById("tX_pushpulldock"), null, { timeout: 60000 });
    await ev(() => { const d = document.getElementById("pushpulldock"); if (d.classList.contains("dockgone")) toggleDockGone("pushpulldock", "tX_pushpulldock"); localStorage.setItem("h3.dockmax.off", "1"); H3PushPullFrame.toggleMaxed(true); });
    await p.waitForFunction(() => H3PushPull.state.booted && H3PushPull.state.V && document.getElementById("ppT_zoom"), null, { timeout: 40000 });
  };
  const made = [];
  try {
    await p.request.post(URL_ + "api/dazlib/roots", { data: { roots: [lib] } });
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await ev(() => { Object.keys(localStorage).filter((k) => /^h3\.(daztools\.|ppdocks|pparch)/.test(k)).forEach((k) => localStorage.removeItem(k)); });
    await p.reload({ waitUntil: "domcontentloaded" });
    await boot();

    // ---- 🏛 Architecture
    const ab = await ev(() => { const b = document.getElementById("ppArchBtn"), pl = document.getElementById("ppPlan"); return { there: !!b, before: !!(b && pl && b.nextElementSibling === pl), on: b && b.classList.contains("on") }; });
    check("🏛 Architecture is on the Sketcher's top bar (before 📐 Plan), lit", ab.there && ab.before && ab.on, ab);
    await ev(() => H3PushPull.tool("wall"));
    await p.click("#ppArchBtn"); await p.waitForTimeout(150);
    const off = await ev(() => { const d = (id) => { const e = document.getElementById(id); return e ? getComputedStyle(e).display : "gone"; }; return { wall: d("ppT_wall"), terrain: d("ppT_terrain"), plan: d("ppPlan"), cut: d("ppCut"), plans: d("ppPlans"), wt: d("ppWTBtn"), sel: d("ppT_select"), line: d("ppT_line"), seps: [...document.querySelectorAll("#ppTools .pptsep")].filter((x) => getComputedStyle(x).display !== "none").length, tool: H3PushPull.state.T.name() }; });
    check("off: the Build + Ground tools and 📐 Plan / ⌂ Cut-away / 📄 Plans / 🧱 Wall types hide; the drawing tools stay; the wall tool in use -> Select", off.wall === "none" && off.terrain === "none" && off.plan === "none" && off.cut === "none" && off.plans === "none" && off.wt === "none" && off.sel !== "none" && off.line !== "none" && off.seps === 0 && off.tool === "select", off);
    await p.reload({ waitUntil: "domcontentloaded" }); await boot(); await p.waitForTimeout(800);
    check("kept over a reload (still hidden)", await ev(() => getComputedStyle(document.getElementById("ppT_wall")).display === "none" && !document.getElementById("ppArchBtn").classList.contains("on")));
    await p.click("#ppArchBtn"); await p.waitForTimeout(150);
    check("on again: they are back", await ev(() => ["ppT_wall", "ppT_terrain", "ppPlan", "ppCut"].every((id) => getComputedStyle(document.getElementById(id)).display !== "none")));

    // ---- 🔍 Zoom
    const vb = await box("ppView");
    await p.click("#ppT_zoom");
    const z0 = await camD(); await p.mouse.click(vb.l + vb.w / 2, vb.t + vb.h / 2); await p.waitForTimeout(100); const z1 = await camD();
    await p.keyboard.down("Shift"); await p.mouse.click(vb.l + vb.w / 2, vb.t + vb.h / 2); await p.keyboard.up("Shift"); await p.waitForTimeout(100); const z2 = await camD();
    check("🔍 Zoom in the toolbox: a click zooms in (×1.5), Shift+click out", Math.abs(z0 / z1 - 1.5) < 0.02 && Math.abs(z2 / z1 - 1.5) < 0.02, [z0, z1, z2]);
    await p.mouse.move(vb.l + vb.w / 2, vb.t + vb.h / 2); await p.mouse.down(); await p.mouse.move(vb.l + vb.w / 2, vb.t + vb.h / 2 - 120, { steps: 6 }); await p.mouse.up(); const z3 = await camD();
    check("🔍 a drag up zooms in", z3 < z2 * 0.95, [z2, z3]);
    await ev(() => H3PushPull.tool("select")); await ev(() => H3PushPull.state.V.view("iso"));

    // ---- a DAZ character: its pieces with 👁
    await p.click("#ppDazLib"); await p.waitForSelector("#dzGrid .dzit", { timeout: 15000 });
    await tile("Doll").click(); await built(1);
    await kind("clothing", "Shirt"); await tile("Shirt").click();
    await p.waitForFunction(() => !H3DazTools.state.busy && document.querySelectorAll("#dzTree .dzpiece").length >= 2, null, { timeout: 60000 });
    const pcs = await ev(() => [...document.querySelectorAll("#dzTree .dzpiece")].map((x) => x.textContent.trim()));
    check("🧭 the explorer lists what the model really has (the figure + the shirt), each with 👁", pcs.some((t) => /🧍 .*figure/.test(t)) && pcs.some((t) => /👕 Shirt/.test(t)), pcs);
    await p.locator("#dzTree .dzpiece", { hasText: "Shirt" }).locator("input").uncheck();
    const hid = await ev(() => { const id = H3DazScene.list()[0], r = H3DazScene.rig(id); let vis = null; r.root.traverse((o) => { if (o.userData && /^Shirt \(/.test(o.userData.name || "")) vis = o.visible; }); return { vis, kept: H3DazTools.cur().hidePieces }; });
    check("unticked: the shirt hides in the 3D view (kept with the character)", hid.vis === false && hid.kept.join() === "Shirt", hid);

    // ---- a lying pose: the whole figure turned, kept over a reload
    await kind("pose", "Lie down"); await tile("Lie down").click();
    await p.waitForFunction(() => (H3DazTools.cur().figPose || {}).rot && H3DazTools.cur().figPose.rot.x === -90, null, { timeout: 15000 });
    const lyi = () => ev(() => { const id = H3DazScene.list()[0], r = H3DazScene.rig(id), T = r.T; r.root.updateMatrixWorld(true); const h = r.bones.get("head").getWorldPosition(new T.Vector3()), f = r.bones.get("lFoot").getWorldPosition(new T.Vector3()); return { dz: h.z - f.z, len: Math.hypot(h.x - f.x, h.y - f.y), z: Math.max(h.z, f.z) }; });
    const L1 = await lyi();
    check("🕴 a pose that turns the whole figure (its own channel): the doll LIES (head and feet level, 1.5 m apart), near the floor", Math.abs(L1.dz) < 0.2 && L1.len > 1.3 && L1.z < 0.5, L1);
    const kept1 = await ev(() => ({ fig: H3DazTools.cur().figPose, hips: H3DazTools.cur().hips }));
    check("its turn / move and the hips' move are kept with the character (cm -> m)", kept1.fig.rot.x === -90 && Math.abs(kept1.fig.move[1] - 0.15) < 1e-9 && Math.abs(kept1.hips[1] + 0.05) < 1e-9, kept1);
    await p.reload({ waitUntil: "domcontentloaded" }); await boot();
    await p.waitForFunction(() => H3DazScene.list().length === 1, null, { timeout: 60000 }); await p.waitForTimeout(500);
    const L2 = await lyi();
    check("over a reload it still lies there (it used to stand up: the hips / figure were not kept)", Math.abs(L2.dz) < 0.2 && L2.len > 1.3, L2);
    check("…and the hidden shirt stays hidden", await ev(() => { const r = H3DazScene.rig(H3DazScene.list()[0]); let v = null; r.root.traverse((o) => { if (o.userData && /^Shirt \(/.test(o.userData.name || "")) v = o.visible; }); return v === false; }));
    await ev(() => H3DazTools.tab("pose")); await p.click("#dzPRAll"); await p.waitForTimeout(200);
    check("↺ all: it stands again", (await lyi()).dz > 1.3);

    // ---- ✨ Photo: the person named; the depth map reaches the character
    const pl = await ev(() => H3DazScene.rig(H3DazScene.list()[0]).place);
    await ev((q) => H3DazScene.place(H3DazScene.list()[0], { x: 6, y: 4 }), pl);
    const dep = await ev(() => { const V = H3PushPull.state.V; V.extents(); const d = V.shot(320, 240, { clean: true, depth: true }); const t = document.createElement("canvas"); t.width = 320; t.height = 240; const g = t.getContext("2d"); g.drawImage(d, 0, 0); const D = g.getImageData(0, 0, 320, 240).data; let lit = 0; for (let i = 0; i < D.length; i += 4) if (D[i] > 30) lit++; return { lit, box: H3DazScene.box() }; });
    check("the depth map (✨ Photo's picture 2) reaches the character standing away from the model (Zoom extents frames it too)", dep.lit > 300 && dep.box && dep.box.max[0] > 6, dep);
    let sent = "";
    await p.route("**/api/aiedit", (rt) => { sent = (rt.request().postDataBuffer() || Buffer.alloc(0)).toString("latin1"); rt.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ error: "stub" }) }); });
    await p.click("#ppReal"); await p.waitForFunction(() => /stub/.test(document.getElementById("ppMsg").textContent), null, { timeout: 20000 }).catch(() => {});
    check("✨ Photo: the prompt names the person and asks to keep the pose, body, hair and clothes", /a person/.test(sent) && /same pose, body shape, hair and clothes/.test(sent), sent.slice(sent.indexOf("prompt"), sent.indexOf("prompt") + 600));

    // ---- Delete: the picked character goes; ↶ brings it back
    await ev(() => H3PushPull.state.V.view("iso")); await ev(() => H3PushPull.state.V.extents());
    await ev(() => { H3DazTools.pickChar(H3DazScene.list()[0]); }); await p.waitForTimeout(100);
    const at = await scr([6, 4, 1.0]); await p.mouse.click(at[0], at[1]); await p.waitForTimeout(150);
    check("a click on the character picks it (its box)", (await ev(() => H3DazScene.sel())) === (await ev(() => H3DazScene.list()[0])));
    const name = await ev(() => H3DazTools.cur().name);
    await p.keyboard.press("Delete"); await p.waitForTimeout(200);
    check("Delete: the picked DAZ character leaves the scene and the explorer", (await ev(() => H3DazScene.list().length)) === 0 && (await ev(() => H3DazTools.state.scene.chars.length)) === 0 && /deleted/.test(await ev(() => document.getElementById("dzMsg").textContent)), await ev(() => ({ n: H3DazScene.list().length, sel: H3DazScene.sel(), tool: H3PushPull.state.T.name(), st: Object.keys(H3PushPull.state.T.state()), msg: document.getElementById("ppMsg").textContent, act: document.activeElement && (document.activeElement.id || document.activeElement.tagName) })));
    await p.click("#dzUndoDel"); await built(1);
    const back = await ev(() => ({ name: H3DazTools.cur() && H3DazTools.cur().name, x: H3DazScene.rig(H3DazScene.list()[0]).place.x }));
    check("↶ Undo brings it back, where it stood", back.name === name && Math.abs(back.x - 6) < 1e-6, back);
    const vb2 = await box("ppView"); await p.mouse.click(vb2.l + vb2.w - 60, vb2.t + vb2.h - 60); await p.waitForTimeout(100);
    check("a click past the characters un-picks (Delete is the Sketcher's again)", (await ev(() => H3DazScene.sel())) === "");
    await p.keyboard.press("Delete"); await p.waitForTimeout(150);
    check("…so Delete then leaves the character alone", (await ev(() => H3DazScene.list().length)) === 1);
    check("no page / shader errors", errs.length === 0, errs);
    made.push(...(await ev(() => H3DazTools.state.scene.chars.map((c) => c.last).filter(Boolean))));
  } catch (e) { check("ran without throwing", false, String(e && e.stack || e)); }
  try {
    await ev(() => { Object.keys(localStorage).filter((k) => /^h3\.(daztools\.|ppdocks|pparch)/.test(k)).forEach((k) => localStorage.removeItem(k)); });
    await p.request.post(URL_ + "api/dazlib/roots", { data: { roots: [] } });
    for (const m of made) await p.request.delete(URL_ + "api/tlcanvas/model/" + encodeURIComponent(m)).catch(() => {});
  } catch (e) { /* fine */ }
  await b.close(); fs.rmSync(tmp, { recursive: true, force: true });
  console.log("\nRESULT: " + pass + " passed, " + fail + " failed");
  process.exitCode = fail ? 1 : 0;
})();
