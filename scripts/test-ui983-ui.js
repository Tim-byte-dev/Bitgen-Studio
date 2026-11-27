#!/usr/bin/env node
/* bitGen Studio — 2.983.0 in a REAL browser: DAZ in the Sketcher itself. test-981's DOLL + test-983's dressDoll() (OUR OWN
 * shirt, shoes, pose and shape preset) + test-982's mixamoFbx(). The Sketcher's 📚 button -> the floating library + the
 * explorer / parameters dockers; the doll DRAGGED into the 3D view = a rigged object in the Sketcher's scene where it was
 * dropped; the shirt (click) and the shoes (dropped onto it) worn = rebuilt in place; the pose preset; a click on its body
 * picks a bone; the shape preset; X / turn; a second character + clicking picks; motion; off hides the dockers only; kept
 * over a reload. Tim: "can we move all of the daz features out of the dialog and into the main sketcher docker please ..." */
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
  const { dressDoll } = new Function("require", "path", "fs", grab("test-983.js", "/** the doll's wardrobe", "(async () => {") + "; return { dressDoll };")(require, path, fs);
  const { mixamoFbx } = new Function(grab("test-982.js", "/** a Mixamo-like ASCII FBX", "const grab = ") + "; return { mixamoFbx };")();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ui983_")), lib = path.join(tmp, "DollLib"), fbx = path.join(tmp, "Wave.fbx"), t0 = Date.now() - 1000;
  makeDoll(lib); dressDoll(lib); fs.writeFileSync(fbx, mixamoFbx({ duration: 1, keys: { LeftForeArm: (t) => ({ R: [0, -90 * t, 0] }) } }));
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] }), p = await b.newPage({ viewport: { width: 2200, height: 1150 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  const box = (id) => ev((i) => { const e = document.getElementById(i); if (!e) return null; const r = e.getBoundingClientRect(); return { l: Math.round(r.left), t: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), d: getComputedStyle(e).display }; }, id);
  const tile = (name) => p.locator("#dzGrid .dzit", { hasText: name }).first();
  const kind = async (k, name) => { await p.click('#dzTabs [data-kind="' + k + '"]'); await p.waitForFunction((n) => [...document.querySelectorAll("#dzGrid .dzit span")].some((s) => s.textContent === n), name, { timeout: 10000 }); };
  const built = (n) => p.waitForFunction((k) => H3DazScene.list().length === k && !H3DazTools.state.busy, n, { timeout: 60000 });
  const scr = (pt) => ev((q) => { const V = H3PushPull.state.V, s = V.screen(q), r = V.canvas.getBoundingClientRect(); return [r.left + s[0], r.top + s[1]]; }, pt);
  let before = null;
  try {
    before = (await (await p.request.get(URL_ + "api/dazlib")).json());
    await p.request.post(URL_ + "api/dazlib/roots", { data: { roots: [lib] } });
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await ev(() => { Object.keys(localStorage).filter((k) => /^h3\.daztools\./.test(k)).forEach((k) => localStorage.removeItem(k)); });
    await p.reload({ waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3DazTools && window.H3DazScene && document.getElementById("tX_pushpulldock"), null, { timeout: 60000 });
    await ev(() => { const d = document.getElementById("pushpulldock"); if (d.classList.contains("dockgone")) toggleDockGone("pushpulldock", "tX_pushpulldock"); localStorage.setItem("h3.dockmax.off", "1"); H3PushPullFrame.toggleMaxed(true); });
    await p.waitForFunction(() => H3PushPull.state.booted && H3PushPull.state.V, null, { timeout: 40000 });
    await p.click("#ppDazLib");
    await p.waitForSelector("#dzGrid .dzit", { timeout: 15000 });
    const L = await box("dzLib"), S = await box("dzSide"), Vw = await box("ppView");
    check("📚 on: the library FLOATS over the Sketcher's view, the explorer + parameters dock right of it; no dialog", L.d !== "none" && L.l >= Vw.l - 220 && L.l + L.w <= Vw.l + Vw.w && S.l >= Vw.l + Vw.w - 2 && S.h > 400 && !(await ev(() => !!document.querySelector("#pdlDlg[open]"))) && (await ev(() => document.getElementById("ppDazLib").getAttribute("aria-pressed"))) === "true", { L, S, Vw });
    check("the parameters docker: 🎚 Shape / 🕺 Pose / 🎬 Motion tabs, only Shape shown", (await ev(() => [...document.querySelectorAll("#dzParTabs [data-tab]")].map((x) => x.dataset.tab).join() + "|" + [...document.querySelectorAll("#dzPar [data-pane]")].filter((x) => getComputedStyle(x).display !== "none").map((x) => x.dataset.pane).join())) === "shape,pose,motion|shape");
    // drag the doll into the view
    await tile("Doll").dragTo(p.locator("#ppView"), { targetPosition: { x: Math.round(Vw.w * 0.6), y: Math.round(Vw.h * 0.7) } });
    await built(1);
    const r1 = await ev(() => { const id = H3DazScene.list()[0], r = H3DazScene.rig(id), g = H3PushPull.state.V.scene.getObjectByName("pp-daz"); return { id, place: r.place, model: r.model, inScene: !!g && g.children.includes(r.outer), sel: H3DazScene.sel(), tree: [...document.querySelectorAll("#dzTree .dzc span")].map((s) => s.textContent.trim()), placeShown: !document.getElementById("dzPlace").hidden }; });
    check("dragged into the 3D view: the doll is a rigged object IN the Sketcher's scene, standing where it was dropped, picked", r1.inScene && /^Doll_daz(_\d+)?\.glb$/.test(r1.model) && (Math.abs(r1.place.x) > 0.05 || Math.abs(r1.place.y) > 0.05) && r1.sel === r1.id && /Doll/.test(r1.tree[0]) && r1.placeShown, r1);
    const up = await ev((id) => { const r = H3DazScene.rig(id), V = H3PushPull.state.V, T = V.T, h = r.bones.get("head").getWorldPosition(new T.Vector3()), f = r.bones.get("lFoot").getWorldPosition(new T.Vector3()); return [h.z, f.z]; }, r1.id);
    check("it stands up in the Sketcher (Z up): the head 1.5 m over the feet", up[0] - up[1] > 1.3, up);
    // the shirt by a click (the doll picked), the shoes DROPPED onto the doll
    await kind("clothing", "Shirt"); await tile("Shirt").click();
    await p.waitForFunction(() => /Shirt/.test(document.getElementById("dzTree").textContent) && !H3DazTools.state.busy && H3DazScene.rig(H3DazScene.list()[0]).model !== "", null, { timeout: 60000 });
    await p.waitForFunction((m) => H3DazScene.rig(H3DazScene.list()[0]).model !== m, r1.model, { timeout: 60000 });
    const at = await scr([r1.place.x, r1.place.y, 1.2]);
    const vb = await box("ppView");
    await tile("Shoes").dragTo(p.locator("#ppView"), { targetPosition: { x: Math.round(at[0] - vb.l), y: Math.round(at[1] - vb.t) } });
    await p.waitForFunction(() => /Shoes/.test(document.getElementById("dzTree").textContent), null, { timeout: 30000 });
    await p.waitForFunction(() => !H3DazTools.state.busy && H3DazScene.rig(H3DazScene.list()[0]).meshes.length >= 3, null, { timeout: 60000 });
    const r2 = await ev(() => { const r = H3DazScene.rig(H3DazScene.list()[0]); return { model: r.model, place: r.place, n: H3DazScene.list().length, comps: [...document.querySelectorAll("#dzTree .dzcomp:not(.dzpiece):not(.dzpieces):not(.dzwarn) span")].map((s) => s.textContent.trim()) }; });
    check("👕 the shirt (clicked) and 👟 the shoes (dropped onto the doll) worn - rebuilt IN PLACE, still one character", r2.n === 1 && r2.comps.join("|") === "🦴 Doll (figure)|👕 Shirt|👕 Shoes" && Math.abs(r2.place.x - r1.place.x) < 1e-9 && r2.model !== r1.model, r2);
    // the pose preset
    await kind("pose", "Wave"); await tile("Wave").click();
    await p.waitForFunction(() => H3DazTools.cur() && H3DazTools.cur().pose.lForearm, null, { timeout: 15000 });
    const pz = await ev(() => { const r = H3DazScene.rig(H3DazScene.list()[0]), q = r.bones.get("lForearm").quaternion, hp = r.bones.get("hip").position.z - r.restLocal.get("hip")[2]; return { q: [q.x, q.y, q.z, q.w], hip: hp, w: r.weights, tab: H3DazTools.state.tab, msg: document.getElementById("dzMsg").textContent }; });
    check("🕴 the pose preset on the doll: its elbow bent, the hips 10 cm on, our flex following, the 🕺 Pose tab open; the bones it lacks said", Math.abs(pz.q[3]) < 0.8 && Math.abs(pz.hip - 0.1) < 1e-6 && (pz.w.flex_lShldr || 0) > 0.5 && pz.tab === "pose" && /3 of 4 bone/.test(pz.msg), pz);
    // a click on the body picks a bone (the Pose tab), its slider turns it
    const chest = await scr([r1.place.x, r1.place.y, 1.25]);
    await p.mouse.click(chest[0], chest[1]);
    const bone = await ev(() => H3DazTools.state.bone);
    check("🕺 a click on the doll's body picks its bone", /^(chest|hip|neck|lShldr|rShldr)$/.test(bone), bone);
    await ev(() => { const r = document.querySelector('#dzAxes input[data-ax="x"]'); r.value = "25"; r.dispatchEvent(new Event("input")); });
    check("its slider turns it (the pose kept with the character)", (await ev((b) => H3DazTools.cur().pose[b] && H3DazTools.cur().pose[b].x, bone)) === 25);
    // the shape preset
    await kind("shape", "Wide"); await tile("Wide").click();
    await p.waitForFunction(() => Object.values(H3DazTools.cur().dials).includes(0.8), null, { timeout: 15000 });
    await p.waitForFunction(() => !H3DazTools.state.busy, null, { timeout: 60000 });
    check("🎚 the shape preset: its dial on the doll (Body Wide 0.8), rebuilt", (await ev(() => Object.entries(H3DazTools.cur().dials).map(([u, v]) => decodeURIComponent(u.split("#").pop()) + "=" + v).join())) === "BodyWide=0.8");
    // place it
    await p.fill("#dzPX", "2"); await p.dispatchEvent("#dzPX", "change"); await p.fill("#dzPR", "90"); await p.dispatchEvent("#dzPR", "change");
    check("🧭 X / Turn: the doll moved to x 2 m, turned 90°", (await ev(() => { const r = H3DazScene.rig(H3DazScene.list()[0]); return [r.outer.position.x, +r.outer.rotation.z.toFixed(4)]; })).join() === "2," + (Math.PI / 2).toFixed(4));
    // 🎬 motion on it
    await p.click('#dzParTabs [data-tab="motion"]');
    await p.setInputFiles("#dzFbx", fbx);
    await p.waitForFunction(() => /bones matched|⚠/.test(document.getElementById("dzMsg").textContent), null, { timeout: 20000 });
    const mo = await ev(() => { const M = H3DazScene.motion.state(); return M && { mapped: M.mapped, playing: M.playing, msg: document.getElementById("dzMsg").textContent }; });
    check("🎬 a Mixamo-like FBX on the doll in the Sketcher: bones matched, playing", mo && mo.mapped >= 10 && mo.playing, mo);
    await p.click("#dzMOff");
    // a second character, then clicking picks
    await kind("figure", "Doll");
    const it = await ev(async () => (await (await fetch("/api/dazlib/scan?kind=figure")).json()).items[0]);
    await ev((i) => H3DazTools.libClick(i, [-1.5, 0]), it); await built(2);
    const ids = await ev(() => H3DazScene.list());
    check("a second doll in the scene, picked", ids.length === 2 && (await ev(() => H3DazScene.sel())) === ids[1]);
    await p.click('#dzParTabs [data-tab="shape"]');
    const pl0 = await ev((id) => H3DazScene.rig(id).place, ids[0]), first = await scr([pl0.x, pl0.y, 1.0]);   // 2.985.0: where it stands (motion ✕ no longer leaves the hips walked off)
    await p.mouse.click(first[0], first[1]);
    check("a click on the first doll in the view picks it (the explorer follows)", (await ev(() => H3DazScene.sel())) === ids[0] && (await ev((id) => document.querySelector('#dzTree .dzc.sel').dataset.char === id, ids[0])), await ev((a) => ({ sel: H3DazScene.sel(), ids: H3DazScene.list(), cur: H3DazTools.cur().id, places: H3DazScene.list().map((i) => H3DazScene.rig(i).place), at: a, el: document.elementFromPoint(a[0], a[1]).id }), first));
    // the floating library moves
    const lh = await box("dzLibHead");
    await p.mouse.move(lh.l + 40, lh.t + 8); await p.mouse.down(); await p.mouse.move(lh.l + 140, lh.t + 68, { steps: 5 }); await p.mouse.up();
    const L2 = await box("dzLib");
    check("the floating library moves by its title (kept)", Math.abs(L2.l - L.l - 100) <= 2 && Math.abs(L2.t - L.t - 60) <= 2 && (await ev(() => JSON.parse(localStorage.getItem("h3.daztools.w")).lib.x)) > 0, { L, L2 });
    // off: the dockers hidden, the characters stay
    await p.click("#ppDazLib");
    check("📚 off: the three DAZ dockers hidden - the dolls stay in the scene", (await box("dzLib")).d === "none" && (await box("dzSide")).d === "none" && (await ev(() => H3DazScene.list().length)) === 2);
    await p.click("#ppDazLib");
    await p.reload({ waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3DazScene && window.H3PushPull && H3PushPull.state.V, null, { timeout: 60000 });
    await p.waitForFunction(() => H3DazScene.list().length === 2, null, { timeout: 60000 });
    const r9 = await ev(() => { const r = H3DazScene.rig(H3DazTools.state.scene.chars[0].id); return { on: H3DazTools.state.on, x: r.outer.position.x, pose: Object.keys(r.pose).length, shown: getComputedStyle(document.getElementById("dzSide")).display !== "none" }; });
    check("after a reload: the DAZ dockers on, both dolls back in the scene where they stood, the pose kept", r9.on && r9.shown && r9.x === 2 && r9.pose >= 3, r9);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + e.message); }
  try { await ev(() => { if (window.H3DazScene) H3DazScene.clear(); Object.keys(localStorage).filter((k) => /^h3\.daztools\./.test(k)).forEach((k) => localStorage.removeItem(k)); }); } catch (e) { /* fine */ }
  try { await p.request.post(URL_ + "api/dazlib/roots", { data: { roots: (before && before.roots && before.detected && before.roots.join() !== before.detected.join()) ? before.roots : [] } }); } catch (e) { /* fine */ }
  try { const d = path.join(ROOT, "projects"); for (const pr of fs.readdirSync(d)) { const m = path.join(d, pr, "models3d"); if (!fs.existsSync(m)) continue; for (const f of fs.readdirSync(m)) if (/^Doll.*_daz.*\.glb$/.test(f) && fs.statSync(path.join(m, f)).mtimeMs >= t0) fs.rmSync(path.join(m, f)); } } catch (e) { /* fine */ }
  fs.rmSync(tmp, { recursive: true, force: true });
  await b.close();
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
