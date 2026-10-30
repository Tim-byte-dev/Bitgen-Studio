#!/usr/bin/env node
/* bitGen Studio — 2.622.0 in a REAL browser: THE COMFYUI INSTALLED HERE, IN THE MODEL LISTS.
 * Tim: "if comfyui is installed add the diffusion models and checkpoint folder models to our model list in basic settings
 * and the model manager"
 *   Settings has no ComfyUI folder; a ComfyUI is on this computer (the test's fixture, handed to the e2e-only
 *   /api/comfy/detect/e2e) -> Basic Settings' checkpoint list and video Model list hold its checkpoints + diffusion
 *   models, the 🧩 Model manager shows a card for each, Settings ▸ ComfyUI says where it was found and "Use this folder"
 *   sets it. Against the running app (H3_URL, H3_E2E=1). No Playwright = SKIP. */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.622.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const api = async (u, body) => (await fetch(URL_ + u.replace(/^\//, ""), body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();

(async () => {
  const T = fs.mkdtempSync(path.join(os.tmpdir(), "ui622_")), C = path.join(T, "ComfyUI");
  const mk = (p) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, "x".repeat(64)); };
  mk(path.join(C, "main.py")); fs.mkdirSync(path.join(C, "comfy"), { recursive: true });
  mk(path.join(C, "models", "checkpoints", "SDXL", "zz622_juggernaut.safetensors")); mk(path.join(C, "models", "diffusion_models", "zz622_flux1-dev.safetensors")); mk(path.join(C, "models", "unet", "zz622_wan-q4.gguf"));
  const cfg0 = await api("/api/config"), dir0 = ((cfg0.engine || {}).comfy || {}).dir || "";
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1600, height: 1200 } });
  const errs = []; p.on("pageerror", (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
  const ev = (f, a) => p.evaluate(f, a);
  try {
    await api("/api/config", { engine: { comfy: { dir: "" } } });
    const e2e = await api("/api/comfy/detect/e2e", { dir: C });
    if (!e2e.ok) { console.log("SKIP: the app is not the e2e stub (H3_E2E=1) - " + JSON.stringify(e2e)); process.exit(0); }
    const det = await api("/api/comfy/detect?refresh=1");
    check("a ComfyUI on this computer is found while Settings has no folder", det.found && det.found.root === C && det.found.configured === false && det.found.kind === "folder", det);
    const cm = await api("/api/comfymodels?refresh=1");
    const names = (cat) => ((cm.categories[cat] || {}).files || []).map((f) => f.name);
    check("/api/comfymodels lists its checkpoints and diffusion models (unet too) and says where it found them",
      names("checkpoints").includes("SDXL/zz622_juggernaut.safetensors") && names("diffusion_models").includes("zz622_flux1-dev.safetensors") && names("diffusion_models").includes("zz622_wan-q4.gguf") && cm.detected && cm.detected.root === C, { cats: Object.keys(cm.categories), det: cm.detected });

    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && typeof loadComfyModels === "function" && window.H3ModelMgr, null, { timeout: 60000 });
    await ev(() => loadComfyModels(true)); await p.waitForTimeout(500);
    const ck = await ev(() => { const s = document.querySelector("#imgCkptCombo select.cmfile"); return s ? [...s.options].map((o) => o.value) : []; });
    check("Basic Settings ▸ the checkpoint list (image): its checkpoints AND diffusion models", ck.some((v) => /zz622_juggernaut\.safetensors$/.test(v)) && ck.some((v) => /zz622_flux1-dev\.safetensors$/.test(v)) && ck.some((v) => /zz622_wan-q4\.gguf$/.test(v)), ck);
    await ev(() => { const m = document.getElementById("vidModel"); m.dispatchEvent(new Event("focus")); });
    await p.waitForTimeout(800);
    const vm = await ev(() => [...document.querySelectorAll("#vidModelList option")].map((o) => o.value));
    check("Basic Settings ▸ the video Model list: the same models", vm.includes("SDXL/zz622_juggernaut.safetensors") && vm.includes("zz622_flux1-dev.safetensors") && vm.includes("zz622_wan-q4.gguf"), vm);

    const mm = await ev(async () => { await H3ModelMgr.load(true); const S = H3ModelMgr.state(); return { models: ((S.data || {}).models || []).map((c) => c.cat + ":" + c.name), msg: (document.getElementById("mmMsg") || {}).textContent || "" }; });
    check("🧩 Model manager: a card for each of its checkpoints and diffusion models, and it says where ComfyUI was found",
      ["checkpoints:SDXL/zz622_juggernaut.safetensors", "diffusion_models:zz622_flux1-dev.safetensors", "diffusion_models:zz622_wan-q4.gguf"].every((k) => mm.models.includes(k)) && /ComfyUI found at/.test(mm.msg), mm);

    // Settings ▸ ComfyUI ▸ Folder: the line + Use this folder
    await ev(() => { const i = document.getElementById("s_cdir"); i.value = ""; H3ComfyDetect.paint(); });
    await p.waitForTimeout(700);
    const hint = await ev(() => { const h = document.getElementById("s_cdetect"); return h ? { shown: h.style.display, text: h.textContent, btn: !!document.getElementById("s_cdetectUse") } : null; });
    check("Settings ▸ ComfyUI ▸ Folder (empty): \"ComfyUI found: <folder>\" + Use this folder", hint && hint.shown === "block" && hint.text.includes(C) && hint.btn, hint);
    await ev(() => document.getElementById("s_cdetectUse").click()); await p.waitForTimeout(700);
    const used = await ev(() => document.getElementById("s_cdir").value);
    const cfg1 = await api("/api/config");
    check("…Use this folder: it is the ComfyUI folder now (the box and the saved settings)", used === C && ((cfg1.engine || {}).comfy || {}).dir === C, { used, dir: ((cfg1.engine || {}).comfy || {}).dir });
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + (e.stack || e)); }
  finally {
    await b.close();
    try { await api("/api/comfy/detect/e2e", { dir: "" }); await api("/api/config", { engine: { comfy: { dir: dir0 } } }); await api("/api/comfymodels?refresh=1"); } catch { /* fine */ }
    fs.rmSync(T, { recursive: true, force: true });
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log("RESULT: " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
