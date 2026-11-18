#!/usr/bin/env node
/* bitGen Studio — 2.855.0 in a REAL browser: 🟧 the Blender skills (Blender + the LLM stood in by page.route):
 *   the 🟧 ▾ menu has ✨ Model with AI… + 🧰 Blender tools…; an old Blender = the ⬇ Download / Cancel box; ✨: the ask ->
 *   ✍ Write the script (shown, the skill + bitGen's check said) -> ▶ Run on a copy sends the ask, the (edited) script and the
 *   open scene -> the preview, the QA line, 🟧 Open as a Blender layer opens the new scene; 🧰: a tool's fields from the server,
 *   ▶ Run sends its values -> the result. The real list comes from GET /api/blendskills (only `need` stood in).
 * Against the running app (H3_URL). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const PNG = require("fs").readFileSync(path.join(__dirname, "..", "static", "favicon.png"));
(async () => {
  if (!chromium) { console.log("SKIP: playwright is not installed here"); console.log("\nRESULT: 0 passed, 0 failed"); return; }
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1700, height: 1050 } });
  await p.addInitScript(() => { window.__H3_PENDING_AUTO = true; });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  p.on("dialog", (d) => d.dismiss().catch(() => {}));
  let old = true, planned = null, ran = null, tooled = null, opened = null;
  await p.route(/\/api\/blendskills$/, async (r) => { const res = await r.fetch(); const j = await res.json(); j.need = old ? { why: "Blender 4.2.0 is too old - the skills need 5.2 or newer", min: "5.2", url: "https://www.blender.org/download/", found: "/usr/bin/blender", version: "4.2.0" } : null; await r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(j) }); });
  await p.route(/\/api\/blendskills\/plan$/, async (r) => { planned = JSON.parse(r.request().postData()); await r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ skill: "blender-hardsurface-modeling", script: "import bpy\nme = bpy.data.meshes.new('Mug')\n", problems: [] }) }); });
  await p.route(/\/api\/blendskills\/model$/, async (r) => { ran = JSON.parse(r.request().postData()); await r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, name: "room_ai.blend", path: "/proj/blender/scenes/room_ai.blend", preview: "/proj/blender/scenes/room_ai.png", objects: [{ name: "Mug", type: "MESH", tris: 980 }], tries: [{ script: "x", error: "AttributeError" }, { script: ran.script, error: null }], script: ran.script, qa: { pass: false, errors: [], warnings: ["Mug: 2 loose verts"] } }) }); });
  await p.route(/\/api\/blendskills\/preview/, (r) => r.fulfill({ status: 200, contentType: "image/png", body: PNG }));
  await p.route(/\/api\/blendskills\/tool$/, async (r) => { tooled = JSON.parse(r.request().postData()); await r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, tool: tooled.tool, result: { ok: true, lods: { Mug: { LOD1: 490 } } }, path: "/proj/blender/scenes/room_lods.blend", name: "room_lods.blend" }) }); });
  const ev = (f, a) => p.evaluate(f, a);
  try {
    try { await fetch(URL_ + "api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docks: { imageeditdock: { state: "open", hidden: false, maximized: false } } }) }); } catch { /* older */ }
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.blendAi, null, { timeout: 60000 });
    await p.waitForTimeout(1500);
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await ev(() => { document.querySelectorAll(".h3fp.dfm-float, #promptdock").forEach((d) => { d.style.display = "none"; }); const d = document.getElementById("imageeditdock"); d.style.cssText += ";position:fixed;left:10px;top:40px;width:1660px;height:960px;z-index:9999"; });
    // the scene the tools see (the scene tools are not open here) + the layer opener
    await ev(() => { const E = window.imageEditorInstance.E; E.blendLayer.sceneInfo = () => ({ stem: "room", source: "/proj/blender/scenes/room.blend" }); E.blendLayer.openFile = (p) => { window.__opened = p; }; });
    await ev(() => window.imageEditorInstance.E.blendLayer.menu()); await p.waitForTimeout(200);
    const menu = await ev(() => [...document.querySelectorAll("#kblMenu button")].map((b) => b.textContent + (b.disabled ? "(off)" : "")));
    await ev(() => window.imageEditorInstance.E.blendLayer.closeMenu());
    check("the 🟧 ▾ menu has ✨ Model with AI… and 🧰 Blender tools…", menu.some((x) => /Model with AI/.test(x)) && menu.some((x) => /Blender tools/.test(x)), menu);
    await ev(() => window.imageEditorInstance.E.blendAi.model());
    await p.waitForSelector(".kxdlg.pcd h4", { timeout: 10000 });
    const nb = await ev(() => { const d = [...document.querySelectorAll(".kxdlg.pcd")].pop(); return { t: d.querySelector("h4").textContent, ok: d.querySelector(".ok").textContent, body: d.textContent }; });
    check("an old Blender: the ⬇ Download / Cancel box (why + blender.org), nothing else opens", /5\.2 or newer is needed/.test(nb.t) && /Download/.test(nb.ok) && /4\.2\.0 is too old/.test(nb.body) && !(await ev(() => !!document.querySelector("#bskAsk"))), nb);
    await ev(() => { const d = [...document.querySelectorAll(".kxdlg.pcd")].pop(); d.querySelector(".cn").click(); });
    old = false;
    await ev(() => window.imageEditorInstance.E.blendAi.model());
    await p.waitForSelector(".kxdlg.pcd #bskAsk", { timeout: 10000 });
    const skillN = await ev(() => document.querySelectorAll("#bskSkill option").length);
    await p.fill(".kxdlg.pcd #bskAsk", "a ceramic coffee mug");
    await p.click(".kxdlg.pcd #bskWrite");
    await p.waitForFunction(() => /Skill:|✗/.test(document.querySelector("#bskWhy").textContent), null, { timeout: 10000 });
    const w = await ev(() => ({ code: document.querySelector("#bskCode").value, why: document.querySelector("#bskWhy").textContent }));
    check("✍ Write the script: the ask sent, the script SHOWN before anything runs, the skill + ✓ checked said; the skills listed (Auto + 27)", planned && planned.ask === "a ceramic coffee mug" && /meshes\.new\('Mug'\)/.test(w.code) && /hardsurface/.test(w.why) && /✓ checked/.test(w.why) && skillN === 28 && !ran, { w, skillN });
    await ev(() => { const t = document.querySelector("#bskCode"); t.value = t.value + "me.name = 'Mug edited'\n"; });
    await p.click(".kxdlg.pcd .ok");
    await p.waitForSelector(".kxdlg.pcd .bsk-prev", { timeout: 10000 });
    const res = await ev(() => { const o = document.querySelector("#bskOut"); const im = o.querySelector(".bsk-prev"); return { t: o.textContent, img: im && im.complete && im.naturalWidth > 0, open: !!o.querySelector("[data-open]") }; });
    check("▶ Run on a copy: the ask, the EDITED script, the skill and the open scene sent; the preview, the tries, the QA warning and 🟧 Open shown", ran && ran.ask === "a ceramic coffee mug" && /Mug edited/.test(ran.script) && ran.skill === "blender-hardsurface-modeling" && ran.blend === "/proj/blender/scenes/room.blend" && res.img && /2 tries/.test(res.t) && /Mug \(980 tris\)/.test(res.t) && /2 loose verts/.test(res.t) && res.open, { ran, res });
    await p.click(".kxdlg.pcd [data-open]"); await p.waitForTimeout(200);
    opened = await ev(() => window.__opened);
    check("🟧 Open as a Blender layer opens the NEW scene (the box closes)", opened === "/proj/blender/scenes/room_ai.blend" && !(await ev(() => !!document.querySelector("#bskAsk"))), opened);
    await ev(() => window.imageEditorInstance.E.blendAi.tools("lods"));
    await p.waitForSelector(".kxdlg.pcd #bskTool", { timeout: 10000 });
    const tf = await ev(() => ({ tools: document.querySelectorAll("#bskTool option").length, sel: document.querySelector("#bskTool").value, fields: [...document.querySelectorAll("#bskFields input, #bskFields select")].map((x) => x.id) }));
    await p.fill(".kxdlg.pcd #bskF_objects", "Mug");
    await p.click(".kxdlg.pcd .ok");
    await p.waitForFunction(() => /✓|✗/.test((document.querySelector("#bskOut") || {}).textContent || ""), null, { timeout: 10000 });
    const tr = await ev(() => document.querySelector("#bskOut").textContent);
    check("🧰 Blender tools: 9 tools, LODs' fields from the server, ▶ Run sends the tool, the open scene and the values; the result + 🟧 Open", tf.tools === 9 && tf.sel === "lods" && tf.fields.join() === "bskF_objects,bskF_ratios,bskF_cleanup" && tooled && tooled.tool === "lods" && tooled.blend === "/proj/blender/scenes/room.blend" && tooled.args.objects === "Mug" && tooled.args.ratios === "0.5 0.25 0.125" && tooled.args.cleanup === true && /LODs done/.test(tr), { tf, tooled, tr });
    await ev(() => { const d = [...document.querySelectorAll(".kxdlg.pcd")].pop(); if (d) d.querySelector(".cn").click(); });
    check("no page errors", !errs.length, errs);
  } catch (e) { fail++; console.log("FAIL: " + (e.stack || e) + "\n      page errors: " + JSON.stringify(errs).slice(0, 600)); }
  finally { await b.close(); }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
