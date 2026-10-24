#!/usr/bin/env node
/* bitGen Studio — 2.587.0 in a REAL browser, against the running app (H3_URL) + a stub ComfyUI started here:
 *   Settings ▸ ComfyUI ▸ Graphs ▸ ⤒ Import & check - a workflow with 2 pictures and a preview: the inputs counted (🖼 2),
 *   the preview made a save, the graph drawn (3 nodes, the loaders marked); ▶ Test run -> it worked -> saved into
 *   comfy_workflows/ + a graph binding, picked in the tab; a workflow ComfyUI refuses -> its error said, nothing saved;
 *   a workflow loaded with ↻ Load -> its inputs + its picture.
 *   Settings ▸ Dockers - 👁 turns SFX off (the docker and its status-bar button hidden) and on; 🗂 Layouts: 💾 Save,
 *   ↺ Apply (the page reloads into it), ⤒ Import, ★ Save as the default (layouts/default.json + themes/default.json).
 * Tim: "in settings -comfyui- graph can we add total number of input images,videos,audio and allow user to import a comfy
 * graph ... bitgen will do a run of the workflow and if successful it will save it to workflows if unsuccessful it will
 * report the errors" + "show the graph in the settings-comfyui-graph tab when file is imported" + "in dockers add a
 * visible icon next to the dockers name ... allow user to export/import theme and dockers layout". Settings put back,
 * what it made removed. No Playwright = SKIP. */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execSync, spawn } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.587.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const APP = process.env.H3_APP_DIR || path.join(__dirname, "..");
const CPORT = 8399;
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const post = async (p, b) => (await fetch(URL_ + p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b || {}) })).json();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bg-ui587-"));
const GOOD = { "1": { class_type: "LoadImage", inputs: { image: "a.png" } }, "2": { class_type: "LoadImage", inputs: { image: "b.png" } },
  "3": { class_type: "ImageBlend", inputs: { image1: ["1", 0], image2: ["2", 0], blend_factor: 0.5, blend_mode: "normal" } }, "4": { class_type: "PreviewImage", inputs: { images: ["3", 0] } } };
// the stub answers E2E_Reject the way ComfyUI refuses a model it does not have ("Value not in list")
const BAD = { "1": { class_type: "LoadImage", inputs: { image: "a.png" } }, "2": { class_type: "E2E_Reject", inputs: { image: ["1", 0], model: "nope.safetensors" } }, "3": { class_type: "SaveImage", inputs: { images: ["2", 0], filename_prefix: "x" } } };
fs.writeFileSync(path.join(tmp, "ui587_blend.json"), JSON.stringify(GOOD));
fs.writeFileSync(path.join(tmp, "ui587_bad.json"), JSON.stringify(BAD));

(async () => {
  const cfg0 = await (await fetch(URL_ + "api/config")).json();
  const eng0 = JSON.parse(JSON.stringify(cfg0.engine || {}));
  const stub = spawn("python3", [path.join(__dirname, "stub-comfy.py"), String(CPORT), path.join(tmp, "comfy-out")], { stdio: "ignore" });
  for (let i = 0; i < 40; i++) { try { if ((await fetch(`http://127.0.0.1:${CPORT}/system_stats`)).ok) break; } catch { /* not yet */ } await sleep(250); }
  await post("api/config", { engine: { backend: "comfy", comfy: Object.assign({}, eng0.comfy || {}, { url: `http://127.0.0.1:${CPORT}` }) } });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1700, height: 1050 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  const made = [];
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3GraphCheck && window.H3Layouts, null, { timeout: 60000 });
    await p.waitForTimeout(1500);
    await ev(() => { document.getElementById("openSettings").click(); });
    await p.waitForTimeout(500);
    await ev(() => { document.querySelector('#settings .stabs [data-stab="comfy"]').click(); document.querySelector('[data-ctab="graphs"]').click(); });
    await p.waitForSelector("#gcBox #gcImport", { timeout: 10000 });

    // ------------------------------------------------ ⤒ Import & check -> test run -> saved
    await p.setInputFiles("#gcFile", path.join(tmp, "ui587_blend.json"));
    await p.waitForSelector("#gcTest", { timeout: 15000 });
    const rep = await ev(() => ({ txt: document.getElementById("gcReport").textContent, counts: document.getElementById("gcCounts").textContent, nodes: document.querySelectorAll("#gcSvg .gcn").length, links: document.querySelectorAll("#gcSvg path").length, loaderStroke: (document.querySelector('#gcSvg .gcn[data-id="1"] rect') || {}).getAttribute && document.querySelector('#gcSvg .gcn[data-id="1"] rect').getAttribute("style"), disabled: document.getElementById("gcTest").disabled }));
    check("⤒ Import & check: the inputs counted (🖼 2 pictures · 🎞 0 · 🔊 0), the preview made a save, the output named", /🖼 2 pictures · 🎞 0 videos · 🔊 0 sounds/.test(rep.counts) && /PreviewImage \(node 4\) → SaveImage/.test(rep.txt) && /Output: SaveImage \(node 4\)/.test(rep.txt), rep);
    check("...the graph is drawn when the file is imported: 4 nodes, 3 links, a picture input marked", rep.nodes === 4 && rep.links === 3 && /stroke:#4c8fd6/.test(rep.loaderStroke || ""), rep);
    check("...ok to test (▶ Test run on)", rep.disabled === false, rep);
    await p.click("#gcTest");
    await p.waitForFunction(() => /saved as comfy_workflows\//.test((document.getElementById("gcTestMsg") || {}).textContent || "") || /✗/.test((document.getElementById("gcTestMsg") || {}).textContent || ""), null, { timeout: 120000 });
    const tm = await ev(() => document.getElementById("gcTestMsg").textContent);
    const m = /saved as (comfy_workflows\/[^ ]+\.json)/.exec(tm);
    if (m) made.push(m[1]);
    check("▶ Test run: it worked - saved into comfy_workflows/ + a graph binding", !!m && /✓ it worked/.test(tm) && /the graph “ui587_blend”/.test(tm), tm);
    const wf = m ? JSON.parse(fs.readFileSync(path.join(APP, m[1]), "utf8")) : {};
    check("...the saved workflow is the fixed API prompt (its output saves)", wf["4"] && wf["4"].class_type === "SaveImage");
    await p.waitForFunction(() => { const s = document.getElementById("g_sel"); return s && s.value && /ui587_blend/.test(s.options[s.selectedIndex].textContent); }, null, { timeout: 10000 });
    const gl = await (await fetch(URL_ + "api/graphs")).json();
    const g = (gl.graphs || []).find((x) => /^ui587_blend/.test(x.name));
    if (g) made.push("graph:" + g.id);
    check("...picked in the tab (Graph dropdown) and listed - Generate ▸ ⚙ Graph can run it", g && g.file === m[1] && g.kind === "image", g);

    // ------------------------------------------------ a workflow ComfyUI refuses
    await p.setInputFiles("#gcFile", path.join(tmp, "ui587_bad.json"));
    await p.waitForFunction(() => document.getElementById("gcTest") && /ui587_bad/.test(document.getElementById("gcCounts").textContent), null, { timeout: 15000 });
    await p.click("#gcTest");
    await p.waitForFunction(() => /✗ the test run/.test((document.getElementById("gcTestMsg") || {}).textContent || ""), null, { timeout: 120000 });
    const bad = await ev(() => document.getElementById("gcTestMsg").textContent);
    check("a workflow ComfyUI refuses: the test run's error is reported (ComfyUI's own words), nothing saved", /not saved/.test(bad) && /not in list|nope\.safetensors|failed validation/i.test(bad) && !fs.readdirSync(path.join(APP, "comfy_workflows")).some((f) => /^ui587_bad/.test(f)), bad);

    // ------------------------------------------------ a loaded workflow: its inputs + its picture
    await ev(() => { const s = document.getElementById("g_file"); s.value = "comfy_workflows/fl2va.json"; document.getElementById("g_load").click(); });
    await p.waitForFunction(() => /fl2va\.json takes 🖼/.test(document.getElementById("gcCounts").textContent), null, { timeout: 15000 });
    const lv = await ev(() => ({ c: document.getElementById("gcCounts").textContent, n: document.querySelectorAll("#gcSvg .gcn").length }));
    check("↻ Load a workflow in comfy_workflows/: its inputs (🖼 · 🎞 · 🔊) and its graph", /takes 🖼 \d+ picture/.test(lv.c) && lv.n > 3, lv);

    // ------------------------------------------------ Settings ▸ Dockers: 👁 off / on
    await ev(() => { document.querySelector('#settings .stabs [data-stab="dockers"]').click(); });
    await p.waitForSelector('[data-drvis="main:sfxdock"]', { timeout: 10000 });
    await ev(() => document.querySelector('[data-drvis="main:sfxdock"]').click());
    await p.waitForTimeout(500);
    const off = await ev(() => ({ dock: document.getElementById("sfxdock").classList.contains("dockoff"), btn: getComputedStyle(document.getElementById("tSfx")).display, ls: localStorage.getItem("h3.dockoff"), icon: document.querySelector('[data-drvis="main:sfxdock"]').textContent }));
    check("👁 on SFX: the docker AND its status-bar button are hidden, the icon says 🚫, kept (h3.dockoff)", off.dock && off.btn === "none" && /sfxdock/.test(off.ls) && off.icon === "🚫", off);
    await ev(() => document.querySelector('[data-drvis="main:sfxdock"]').click());
    await p.waitForTimeout(500);
    const on = await ev(() => ({ dock: document.getElementById("sfxdock").classList.contains("dockoff"), gone: document.getElementById("sfxdock").classList.contains("dockgone"), btn: getComputedStyle(document.getElementById("tSfx")).display, icon: document.querySelector('[data-drvis="main:sfxdock"]').textContent }));
    check("🚫 again: both back (the docker shown, its button there), 👁", !on.dock && !on.gone && on.btn !== "none" && on.icon === "👁", on);

    // ------------------------------------------------ 🗂 Layouts
    await p.fill("#lyName", "ui587");
    await p.click("#lySave");
    await p.waitForFunction(() => /saved as layouts\/ui587\.json/.test(document.getElementById("lyMsg").textContent), null, { timeout: 8000 });
    made.push("layout:ui587");
    const lay = JSON.parse(fs.readFileSync(path.join(APP, "layouts", "ui587.json"), "utf8"));
    check("💾 Save layout: layouts/ui587.json - the layout files (docker_status.json …), this browser's docker memory, the theme", lay.files["docker_status.json"] && Object.keys(lay.local).length > 0 && lay.theme && lay.theme.vars, Object.keys(lay.files));
    // turn SFX off, then apply ui587 (SFX on there) - the page reloads into it
    await ev(() => document.querySelector('[data-drvis="main:sfxdock"]').click());
    await p.waitForTimeout(400);
    await Promise.all([p.waitForNavigation({ timeout: 20000 }), ev(() => document.querySelector('[data-lyapply="ui587"]').click())]);
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3Layouts, null, { timeout: 60000 });
    await p.waitForTimeout(1800);
    const after = await ev(() => ({ ls: localStorage.getItem("h3.dockoff"), dock: document.getElementById("sfxdock").classList.contains("dockoff") }));
    check("↺ Apply: the page reloads into the layout - SFX is on again (as saved)", !/sfxdock/.test(after.ls || "") && !after.dock, after);
    // import (an exported one under another name), ★ default
    const ex = await (await fetch(URL_ + "api/layouts/ui587?download=1")).text();
    fs.writeFileSync(path.join(tmp, "ui587 copy.json"), ex);
    await ev(() => { document.getElementById("openSettings").click(); });
    await p.waitForTimeout(400);
    await ev(() => { document.querySelector('#settings .stabs [data-stab="dockers"]').click(); });
    await p.waitForSelector("#lyFile", { state: "attached", timeout: 10000 });
    await p.setInputFiles("#lyFile", path.join(tmp, "ui587 copy.json"));
    await p.waitForFunction(() => /imported as layouts\/ui587 copy\.json/.test(document.getElementById("lyMsg").textContent), null, { timeout: 8000 });
    made.push("layout:ui587 copy");
    check("⤓ Export -> ⤒ Import: the layout comes back under the file's name", fs.existsSync(path.join(APP, "layouts", "ui587 copy.json")) && /ui587 copy/.test(await ev(() => document.getElementById("lyList").textContent)));
    const hadDefault = fs.existsSync(path.join(APP, "layouts", "default.json")), hadTheme = fs.existsSync(path.join(APP, "themes", "default.json"));
    if (!hadDefault) {
      await p.click("#lyDefault");
      await p.waitForFunction(() => /layouts\/default\.json \+ themes\/default\.json/.test(document.getElementById("lyMsg").textContent), null, { timeout: 8000 });
      check("★ Save as the default: layouts/default.json + themes/default.json (to copy into the repo); listed first", fs.existsSync(path.join(APP, "layouts", "default.json")) && fs.existsSync(path.join(APP, "themes", "default.json")) && /^★ default/.test(await ev(() => document.querySelector("#lyList tr:nth-child(2) td").textContent)));
      made.push("layout:default"); if (!hadTheme) made.push("theme:default");
    }
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + (e && e.stack || e)); }
  finally {
    await b.close();
    for (const x of made) {
      try {
        if (x.startsWith("graph:")) await fetch(URL_ + "api/graphs/" + encodeURIComponent(x.slice(6)), { method: "DELETE" });
        else if (x.startsWith("layout:")) await post("api/layouts/delete", { name: x.slice(7) });
        else if (x.startsWith("theme:")) await post("api/themes/delete", { name: x.slice(6) });
        else fs.unlinkSync(path.join(APP, x));
      } catch { /* fine */ }
    }
    try { await post("api/config", { engine: eng0 }); } catch { /* fine */ }
    try { stub.kill(); } catch { /* gone */ }
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* fine */ }
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
