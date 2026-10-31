#!/usr/bin/env node
/* bitGen Studio — 2.578.0 in a REAL browser: the 📐 SolidCraft docker - SolidCraft's browser build (the add-on, from a
 * release zip) running in the docker's frame and the bridge around it: a model made by SolidCraft commands, 🖼 → Image
 * editor (the three.js picture of the view, and Shift = SolidCraft's own render), 💾 Save to project + SolidCraft's own
 * Save keeping the project's copy current, ⤓ Export STEP into the project, 🎞 → Timeline (a 3D layer; again = updated),
 * ✏ the image editor's sketch layer into SolidCraft, 📁 Designs opening the saved design.
 * Tim: "yes, lets build a solidcraft bridge, but we will put it in it's own docker". Against the running app (H3_URL).
 * Needs a solidcraft-web-<v>.zip (SC_ZIP, or the one this sandbox downloaded) when the add-on is not installed - SKIP
 * without one. WebGL in headless Chromium = SwiftShader. */
"use strict";
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.578.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const api = async (u, o) => (await fetch(URL_ + u.replace(/^\//, ""), o)).json();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  let st = await api("/api/solidcraft/status"), weInstalled = false;
  if (!st.installed) {
    const zip = [process.env.SC_ZIP, "/home/claude/sc017/solidcraft-web-0.17.0.zip"].find((z) => z && fs.existsSync(z));
    if (!zip) { console.log("SKIP: SolidCraft is not installed and no solidcraft-web zip is here (SC_ZIP)"); process.exit(0); }
    const r = await api("/api/solidcraft/install-zip", { method: "POST", headers: { "Content-Type": "application/zip" }, body: fs.readFileSync(zip) });
    for (let i = 0; i < 120; i++) { const j = await api("/api/addons/job"); if (!j.job || j.job.state !== "running") break; await sleep(500); }
    st = await api("/api/solidcraft/status"); weInstalled = true;
    check("the add-on installs from a release zip (Install from a zip…) - the Add-ons job", r.ok && st.installed && /^\d+\.\d+\.\d+$/.test(st.version), { r, st });
  }
  const prj = (await api("/api/projects")).current || "default";
  const SCD = path.join(ROOT, "projects", prj, "solidcraft"), M3D = path.join(ROOT, "projects", prj, "models3d");
  const NAME = "e2e578 bracket";
  const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const p = await b.newPage({ viewport: { width: 1800, height: 1100 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  const msg = () => ev(() => document.getElementById("scMsg").textContent);
  const idle = async (ms) => { const t0 = Date.now(); while (Date.now() - t0 < (ms || 120000)) { if (!(await ev(() => window.H3SolidCraftDock.state.busy))) return true; await sleep(300); } return false; };
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3SolidCraftDock && window.imageEditorInstance, null, { timeout: 90000 });
    await ev(() => { const d = document.getElementById("solidcraftdock"); if (d.classList.contains("dockgone") && window.toggleDockGone) window.toggleDockGone("solidcraftdock"); if (d.classList.contains("collapsed") && window.toggleCollapse) window.toggleCollapse("solidcraftdock"); d.scrollIntoView(); });
    await p.waitForFunction(() => window.H3SolidCraft.api(), null, { timeout: 150000 });
    const top = await ev(() => ({ src: document.getElementById("scFrame").getAttribute("src"), ver: document.getElementById("scVer").textContent, inst: document.getElementById("scInstall").style.display, n: window.H3SolidCraft.api() && Object.keys(window.H3SolidCraft.api()) }));
    check("the docker runs SolidCraft from the app's copy (/solidcraft-app/) - its command API reachable from the page; the version in the bar",
      top.src === "/solidcraft-app/index.html" && top.ver.indexOf("v" + st.version) === 0 && top.inst === "none" && /execute/.test(String(top.n)), top);
    /* a model made with SolidCraft's own commands */
    const made = await ev(async () => { const X = window.H3SolidCraft; await X.exec("file.new", {}); await X.exec("solid.box", { length: "60", width: "40", height: "10" }); await X.exec("solid.cylinder", { radius: "8", height: "30", base: [45, 20, 0] }); await X.exec("view.apply", { view: "iso" }); const i = await X.inspect(); return { bodies: i.bodies.length, tl: i.timeline.length }; });
    check("SolidCraft commands through the bridge: a box + a cylinder on its timeline", made.bodies === 2 && made.tl === 2, made);
    /* 🖼 → Image editor (the view, drawn here) */
    await ev(() => { const s = document.getElementById("scSize"); const o = document.createElement("option"); o.value = "320x240"; o.textContent = "320 × 240"; s.appendChild(o); s.value = "320x240"; });
    const n0 = await ev(() => { const E = window.imageEditorInstance.E; return E.S.w ? E.S.layers.length : 0; });
    await p.click("#scToEditor");
    await idle(60000);
    const ed = await ev(() => { const E = window.imageEditorInstance.E, L = E.S.layers[E.S.layers.length - 1] || {}; let px = null; try { const c = (E.layer() || {}).canvas || L.canvas; if (c) { const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; let op = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) op++; px = op; } } catch (e) { px = String(e); } return { w: E.S.w, h: E.S.h, n: E.S.layers.length, act: (E.layer() || {}).name, opaque: px, msg: document.getElementById("scMsg").textContent }; });
    check("🖼 → Image editor: the model from the view's angle as a picture (transparent around it) - a new document when none is open; at once, no render wait",
      (n0 ? ed.n > n0 : ed.w === 320 && ed.h === 240) && /→ the image editor \(320 × 240\)/.test(ed.msg) && ed.opaque > 2000 && ed.opaque < 320 * 240, ed);
    await p.click("#scToEditor"); await idle(60000);
    const ed2 = await ev(() => { const E = window.imageEditorInstance.E; return { n: E.S.layers.length, act: (E.layer() || {}).name }; });
    check("...again with the document open: a new LAYER named after the design", ed2.n === ed.n + 1 && /Untitled/.test(ed2.act || ""), ed2);
    /* View: a preset turns SolidCraft's view; its Named Views are listed */
    await p.selectOption("#scView", "front");
    await p.waitForFunction(() => /the view: front/.test(document.getElementById("scMsg").textContent), null, { timeout: 15000 });
    await ev(() => window.H3SolidCraft.exec("view.save", { name: "e2e578 angle", camera: { target: [30, 20, 5], yaw: 1, pitch: 0.4, distance: 150 } }));
    await ev(() => document.getElementById("scView").dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })));
    await p.waitForFunction(() => [...document.querySelectorAll("#scView option")].some((o) => o.textContent === "★ e2e578 angle"), null, { timeout: 10000 });
    await p.selectOption("#scView", "e2e578 angle");
    await p.click("#scToEditor"); await idle(60000);
    const nv = await ev(() => ({ m: document.getElementById("scMsg").textContent, v: document.getElementById("scView").value }));
    check("View: a preset (Front) turns SolidCraft's view; SolidCraft's Named Views are listed (★) and a picture is taken from one", /→ the image editor/.test(nv.m) && nv.v === "e2e578 angle", nv);
    await p.selectOption("#scView", "");
    /* 💾 Save to project (asks the name of an Untitled design) */
    await p.click("#scSave");
    await p.waitForSelector("#askdlg[open]", { timeout: 15000 });
    await p.fill("#ask_input", NAME); await p.click("#ask_ok");
    await idle(60000);
    const f1 = path.join(SCD, NAME + ".solidcraft"), s1 = fs.existsSync(f1) ? fs.statSync(f1).size : 0;
    const link = await ev(() => window.H3SolidCraftDock.state.link);
    check("💾 Save to project: the design as projects/<p>/solidcraft/" + NAME + ".solidcraft (named in a dialog)", s1 > 500 && link && link.name === NAME + ".solidcraft", { s1, link, m: await msg() });
    /* SolidCraft's own Save on that design -> the project's copy */
    await ev(async () => { const X = window.H3SolidCraft; await X.exec("solid.box", { length: "10", width: "10", height: "10", corner: [0, 0, 10] }); await X.exec("file.save", {}); });
    let s2 = s1;
    for (let i = 0; i < 40 && s2 === s1; i++) { await sleep(500); s2 = fs.existsSync(f1) ? fs.statSync(f1).size : 0; }
    check("SolidCraft's own Save (Ctrl+S) on a project design keeps the project's copy current", s2 !== s1 && /project's copy updated/.test(await msg()), { s1, s2, m: await msg() });
    /* ⤓ Export ▸ STEP */
    await ev(() => window.H3SolidCraftDock.exportAs("step")); await idle(60000);
    const stp = path.join(SCD, NAME + ".step"), stTxt = fs.existsSync(stp) ? fs.readFileSync(stp, "utf8").slice(0, 200) : "";
    check("⤓ Export ▸ STEP: " + NAME + ".step in the project's solidcraft folder (a real ISO 10303-21 file)", /ISO-10303-21/.test(stTxt), stTxt.slice(0, 80));
    /* 🎞 → Timeline, twice */
    await p.click("#scToTimeline"); await idle(60000);
    const obj = path.join(M3D, "sc_e2e578_bracket.obj");
    const tl1 = await ev(() => ({ m: document.getElementById("scMsg").textContent, n: window.TlM3D ? window.TlM3D.all().filter((c) => c.m3d && c.m3d.model === "sc_e2e578_bracket.obj").length : -1 }));
    check("🎞 → Timeline: the model (OBJ) in the project's 3D models and a 3D layer at the playhead", fs.existsSync(obj) && /^v /m.test(fs.readFileSync(obj, "utf8")) && tl1.n === 1, tl1);
    await p.click("#scToTimeline"); await idle(60000);
    const tl2 = await ev(() => ({ m: document.getElementById("scMsg").textContent, n: window.TlM3D.all().filter((c) => c.m3d && c.m3d.model === "sc_e2e578_bracket.obj").length }));
    check("...sent again: the same 3D layer updated (no second one)", tl2.n === 1 && /updated/.test(tl2.m), tl2);
    /* ✏ the image editor's sketch layer -> a SolidCraft sketch */
    const sk0 = await ev(async () => (await window.H3SolidCraft.inspect()).sketches.length);
    await ev(() => { const E = window.imageEditorInstance.E, K = window.PCSketch; E.sketch.newSketch("e2e578 plate"); const L = E.layer(), o = K.pt(L.sketch, L.sketch.origin.pt); E.sketch.edit(L, "test shapes", (s) => { K.rect2(s, [o.x, o.y], [o.x + 80, o.y - 40]); K.circle(s, [o.x + 40, o.y - 20], 8); }); });
    await p.click("#scSketchIn"); await idle(60000);
    const sk = await ev(async () => ({ m: document.getElementById("scMsg").textContent, n: (await window.H3SolidCraft.inspect()).sketches.length }));
    check("✏ Sketch → SolidCraft: the selected sketch layer (a rectangle + a circle) becomes a SolidCraft sketch", sk.n === sk0 + 1 && /5 curves/.test(sk.m), sk);
    await ev(() => window.H3SolidCraft.exec("sketch.finish", {}).catch(() => null));
    /* 📁 Designs: the saved design listed, opened */
    await p.click("#scDesigns");
    await p.waitForSelector(".scMenu", { timeout: 8000 });
    const rows = await ev(() => [...document.querySelectorAll(".scMenu button")].map((x) => x.textContent));
    await ev((n) => { const b = [...document.querySelectorAll(".scMenu button")].find((x) => x.textContent === "📐 " + n); if (b) b.click(); }, NAME);
    await idle(90000);
    const op = await ev(async () => { const i = await window.H3SolidCraft.inspect(); return { name: i.name, bodies: i.bodies.length, path: i.path, m: document.getElementById("scMsg").textContent }; });
    check("📁 Designs lists the project's designs and parts; a click opens the design in SolidCraft (its bodies back)",
      rows.indexOf("📐 " + NAME) >= 0 && rows.indexOf("🧱 " + NAME + ".step") >= 0 && op.name === NAME && op.bodies >= 2 && /opened/.test(op.m), { rows, op });
    /* 2.579.0: 📏 Send to Sketcher (2.630.0 - was the House builder), 🟠 Blender, 🎮 Unreal */
    await p.click("#scToSketcher"); await idle(60000);
    await p.waitForFunction(() => window.H3PushPull && H3PushPull.state && H3PushPull.state.M && H3PushPull.state.M.g.length > 0, null, { timeout: 30000 }).catch(() => {});
    const hs = await ev(() => { const S = window.H3PushPull.state, d = document.getElementById("pushpulldock"); return { groups: S.M.g.length, faces: S.M.f.length, shown: !d.classList.contains("dockgone"), m: document.getElementById("scMsg") ? document.getElementById("scMsg").textContent : "" }; });
    check("📏 Send to Sketcher (2.630.0): the Sketcher opens with the part in it as a group", hs.groups >= 1 && hs.faces > 4 && hs.shown, hs);
    let bl = ""; try { bl = execSync("command -v blender", { encoding: "utf8" }).trim(); } catch (e) { bl = ""; }
    await ev(() => window.H3SolidCraftDock.checkTools()); await sleep(1500);
    const tools = await ev(() => ({ blender: !document.getElementById("scToBlender").hidden, unreal: !document.getElementById("scToUnreal").hidden }));
    const uep = await api("/api/ue/project"), bst = await api("/api/blender/status");
    check("2.579.0 🟠 / 🎮 shown only when Blender is found / an Unreal project or editor is set", tools.blender === !!bst.found && tools.unreal === !!(uep.current || uep.editor || (uep.info && uep.info.editor)), { tools, bl, found: bst.found, uep: { current: uep.current, editor: uep.editor } });
    const UE = require("./ue-stub.js"), stub = await UE.start(0);
    const ueWas = await api("/api/unreal/settings");
    await api("/api/unreal/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ port: stub.port }) });
    try {
      await ev(() => window.H3SolidCraftDock.toUnreal()); await idle(60000);
      const im = stub.state.imported || [], um = await msg();
      const vline = ((im[0] && im[0].text) || "").split("\n").find((l) => /^v /.test(l)) || "";
      check("2.579.0 🎮 Send to Unreal: the part (Y up, centimetres) imported by the bridge's import_mesh into /Game/bitGen/SolidCraft and placed",
        im.length === 1 && im[0].name === "sc_e2e578_bracket" && im[0].folder === "SolidCraft" && /\/unreal\/import\/sc_e2e578_bracket\.obj$/.test(im[0].file.replace(/\\/g, "/")) && /^v /.test(vline) && /→ Unreal: \/Game\/bitGen\/SolidCraft\//.test(um), { im, um });
    } finally { await api("/api/unreal/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ port: ueWas.port || 30020 }) }); await stub.close(); }
    /* Shift + 🖼: SolidCraft's own render (small - the sandbox renders on its CPU) */
    await ev(() => { document.getElementById("scSize").value = "320x240"; window.H3SolidCraftDock.toEditor(true); });
    const tR = Date.now(); let prog = 0;
    for (let i = 0; i < 600; i++) { await sleep(500); const s = await ev(() => ({ b: window.H3SolidCraftDock.state.busy, w: document.getElementById("scProgBar").style.width })); if (s.w && s.w !== "0px" && s.w !== "0%") prog++; if (!s.b) break; }
    const rr = await ev(() => ({ m: document.getElementById("scMsg").textContent, act: (window.imageEditorInstance.E.layer() || {}).name }));
    check("Shift + 🖼: SolidCraft's own render (its progress in the bar) as a layer in the image editor", /320 × 240, rendered/.test(rr.m) && prog > 0, Object.assign(rr, { prog, s: Math.round((Date.now() - tR) / 1000) }));
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + (e && e.stack || e)); try { console.log("      msg " + (await msg())); } catch (e2) { /* fine */ } }
  finally {
    await b.close();
    for (const f of [NAME + ".solidcraft", NAME + ".step"]) fs.rmSync(path.join(SCD, f), { force: true });
    fs.rmSync(path.join(M3D, "sc_e2e578_bracket.obj"), { force: true });
    if (weInstalled && !process.env.SC_KEEP) { await api("/api/addons/solidcraft/remove", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }); for (let i = 0; i < 40; i++) { const j = await api("/api/addons/job"); if (!j.job || j.job.state !== "running") break; await sleep(300); } }
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
