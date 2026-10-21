#!/usr/bin/env node
/* bitGen Studio — 2.559.0 in a REAL browser: a folder filter keeps its folder (a ComfyUI model combo, the 📁 model browser)
 * across rebuilding and reloading (folder_filters.cfg); Basic Settings written to basic.cfg when changed and read back at
 * the start (static/folderfilter.js, static/basiccfg.js, lib/layoutCfg.js).
 * Tim: "when user selects a folder to filter remember the folder selection until changed for all folder select dropdowns.
 * keep basic settings in a file basic.cfg and edit and save when basic settings are changed". Against the running app. */
"use strict";
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.559.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const ROOT = path.join(__dirname, "..");
const LAYF = path.join(ROOT, "panel_layout.cfg");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };

(async () => {
  const keep = fs.existsSync(LAYF) ? fs.readFileSync(LAYF) : null;
  fs.rmSync(LAYF, { force: true });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1700, height: 1050 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  const open = async () => {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3DockGroup && document.getElementById("dgFloat_musicdock") && document.getElementById("tDG"), null, { timeout: 60000 });
    await p.waitForTimeout(1200);
  };
  const serverLay = async (ok) => { let o = {}; for (let i = 0; i < 40; i++) { o = await ev(() => fetch("/api/layout/panel").then((r) => r.json())); if (ok(o)) return o; await p.waitForTimeout(400); } return o; };
  const lay = (n) => ev((n) => fetch("/api/layout/" + n).then((r) => r.json()), n);
  const combo = () => ev(() => {
    cmData = Object.assign({}, cmData || {}, { categories: Object.assign({}, (cmData || {}).categories || {}, { loras: { files: [{ name: "a.safetensors", folder: "flux" }, { name: "b.safetensors", folder: "sdxl" }, { name: "c.safetensors", folder: "" }] } }) });
    let host = document.getElementById("t559host"); if (host) host.remove();
    host = document.createElement("div"); host.id = "t559host"; document.body.appendChild(host);
    let inp = document.getElementById("t559lora"); if (!inp) { inp = document.createElement("input"); inp.id = "t559lora"; inp.type = "hidden"; document.body.appendChild(inp); }
    const w = cmCombo(host, inp, ["loras"], { onChange: () => {} });
    const f = w.querySelector("select.cmfolder"), s = w.querySelector("select.cmfile");
    return { folder: f.value, files: [...s.options].map((o) => o.value).filter(Boolean) };
  });
  try {
    await open();
    await ev(() => fetch("/api/layout/folders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ all: {} }) }));
    await ev(() => localStorage.setItem("h3.folders", JSON.stringify({ "cm:t559lora:loras": "loras/flux" })));   // a stale browser copy: the file wins
    await p.reload({ waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3FolderMem && window.H3BasicCfg, null, { timeout: 60000 });
    await p.waitForTimeout(800);
    const c0 = await combo();
    check("a model combo starts on All folders (nothing kept yet)", /all/i.test(c0.folder) || c0.folder.length <= 4, c0);
    await ev(() => { const f = document.querySelector("#t559host select.cmfolder"); f.value = "loras/sdxl"; f.dispatchEvent(new Event("change")); });
    await p.waitForTimeout(900);
    const L1 = await lay("folders");
    check("picking a folder keeps it in folder_filters.cfg (this combo's own key)", L1["cm:t559lora:loras"] === "loras/sdxl", L1);
    const c1 = await combo();
    check("...the combo made again comes back on that folder, its list filtered", c1.folder === "loras/sdxl" && c1.files.join() === "b.safetensors", c1);
    await p.reload({ waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3FolderMem && typeof cmCombo === "function", null, { timeout: 60000 });
    await ev(() => new Promise((ok) => window.H3FolderMem.onReady(ok)));
    const c2 = await combo();
    check("...and after a reload (until it is changed)", c2.folder === "loras/sdxl" && c2.files.join() === "b.safetensors", c2);
    // the 📁 browser
    const br = await ev(async () => {
      cmBrowse(["loras"], "", () => {}); const f = document.getElementById("cm_folder"); f.value = "loras/flux"; f.dispatchEvent(new Event("change")); document.getElementById("cmdlg").close();
      await new Promise((r) => setTimeout(r, 700));
      cmBrowse(["loras"], "", () => {}); const v = document.getElementById("cm_folder").value; document.getElementById("cmdlg").close(); return v;
    });
    check("the 📁 model browser keeps its folder too", br === "loras/flux", br);
    // Basic Settings -> basic.cfg
    await p.waitForFunction(() => window.H3BasicCfg.state().started, null, { timeout: 40000 });
    const B0 = await lay("basic");
    check("basic.cfg is written at the start with the Basic Settings (steps, cfg, the override switch …) - not the style card's model dropdowns",
      Object.keys(B0).length > 10 && "steps" in B0 && "cfg" in B0 && "ovrStyle" in B0 && !Object.keys(B0).some((k) => /^bs/.test(k) && k !== "bsTabStd"), Object.keys(B0).slice(0, 30));
    const want = await ev(() => { const s = document.getElementById("steps"), v = String((+s.value === 23 ? 24 : 23)); s.value = v; s.dispatchEvent(new Event("input", { bubbles: true })); s.dispatchEvent(new Event("change", { bubbles: true })); return v; });
    await p.waitForTimeout(1500);
    const B1 = await lay("basic");
    check("a change in Basic Settings is saved to basic.cfg a moment later", B1.steps === want, { want, got: B1.steps });
    await ev(() => fetch("/api/layout/basic", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ set: { steps: "31" } }) }));
    await p.reload({ waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3BasicCfg && window.H3BasicCfg.state().started, null, { timeout: 60000 });
    await p.waitForTimeout(800);
    check("basic.cfg is read back at the start (steps 31 from the file)", (await ev(() => document.getElementById("steps").value)) === "31");
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + (e && e.stack || e)); }
  finally { await b.close(); }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
