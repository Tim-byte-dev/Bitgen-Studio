#!/usr/bin/env node
/* bitGen Studio — 2.404.0: ✨ Build a scene with AI + ＋ Model + 🧊 on a picture, in a REAL browser (WebGL), a REAL
 * Blender and the e2e's stub LLM / ComfyUI.
 * Tim (verbatim): "is it possible for our llm to use blender to create 3d models?" -> "can we add option 1 + the image
 * to workflow?".
 *   1. 🟧 with no scene open: the view opens with 📂 Open a .blend and ✨ Build a scene with AI (the image style from
 *      Basic Settings named, the 3D engine select: Hunyuan3D default / TRELLIS.2)
 *   2. ✨ Build: the log fills as it goes, the built scene opens and draws, the dog is the 3D model
 *   3. ＋ Model: models3d's .glb as a new object, 1 m tall, standing on the ground, selected; saved by Blender (a real
 *      object after 💾 Save)
 *   4. 🧊 on a Gallery picture and an Assets picture: the engine asked, the job queued, the .glb lands in models3d/
 * Run against the running app (H3_URL, default :8311) in a project of its own; STUB_MODELS_ROOT = the stub ComfyUI's
 * models. No Playwright / no Blender = SKIP (exit 0). */
"use strict";
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the AI scene browser test did not run"); console.log("\nRESULT: 0 failed"); process.exit(0); }
let exe = "";
try { exe = execSync("command -v blender", { encoding: "utf8", shell: "/bin/bash" }).trim(); } catch { exe = ""; }
if (!exe) { console.log("SKIP: Blender is not installed here - the AI scene browser test did not run"); console.log("\nRESULT: 0 failed"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const ROOT = path.join(__dirname, "..");
const MODELS = process.env.STUB_MODELS_ROOT || "/tmp/e2e_comfy/ComfyUI/models";
const P = "zz_aiui_" + process.pid;
let pass = 0, fail = 0;
const check = (n, cond, got) => {
  if (cond) { pass++; console.log("PASS: " + n); }
  else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); }
};
const api = async (u, body) => (await fetch(URL_ + u.replace(/^\//, ""), body === undefined ? {} :
  { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();
const made = [];
let SIDG = "";
for (const [d, f] of [["checkpoints", "hunyuan_3d_v2.1.safetensors"], ["background_removal", "birefnet.safetensors"]]) {
  const p = path.join(MODELS, d, f);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  if (!fs.existsSync(p)) { fs.writeFileSync(p, "stub"); made.push(p); }
}

(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const p = await b.newPage({ viewport: { width: 2000, height: 1250 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(String(e.stack || e.message).slice(0, 400)));
  try {
    await api("/api/projects/load", { name: P });
    const pd = path.join(ROOT, "projects", P);
    const sty = await api("/api/styles", { name: "aiui pictures " + process.pid, kind: "image", workflow: "comfy_workflows/img_flux2_klein_9b_t2i.json" });
    const SID = (sty.style || {}).id; SIDG = SID;
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => window.TlCanvas && typeof dsReady !== "undefined" && dsReady && document.getElementById("tlTool_blend"), null, { timeout: 30000 });
    await p.evaluate((sid) => {
      const d = document.getElementById("timelinedock");
      if (/collapsed|dockgone/.test(d.className) && typeof toggleCollapse === "function") toggleCollapse("timelinedock");
      setVar("th", 820);
      if (document.getElementById("tlStage").classList.contains("off")) document.getElementById("tlStageTog").click();
      const s = document.getElementById("styleSel");
      if (s && ![...s.options].some((o) => o.value === sid) && typeof refreshStyles === "function") refreshStyles();
    }, SID);
    await p.waitForFunction((sid) => [...document.getElementById("styleSel").options].some((o) => o.value === sid), SID, { timeout: 15000 }).catch(() => {});
    await p.evaluate((sid) => { const s = document.getElementById("styleSel"); s.value = sid; s.dispatchEvent(new Event("change")); }, SID);
    // 1
    await p.click("#tlTool_blend");
    await p.waitForFunction(() => document.getElementById("tlbAiPrompt"), null, { timeout: 15000 });
    const v1 = await p.evaluate(() => ({ ov: getComputedStyle(document.getElementById("tlBlendView")).display, open: !!document.getElementById("tlbOpen"),
      st: !!TlBlend.state.st, eng: [...document.querySelectorAll("#tlbAiEngine option")].map((o) => o.value), txt: document.getElementById("tlBlendProps").innerText }));
    check("🟧 with no scene: the view opens, 📂 Open a .blend + ✨ Build a scene with AI, Hunyuan3D first / TRELLIS.2, the image style named",
      v1.ov === "flex" && v1.open && !v1.st && JSON.stringify(v1.eng) === '["auto","trellis","hunyuan"]' && /Build a scene with AI/.test(v1.txt)
      && /pictures with: aiui pictures/.test(v1.txt) && /Hunyuan3D 2\.1 - shape \(default\)/.test(v1.txt), v1);
    // 2
    await p.evaluate((v) => { const e = document.getElementById("prompt"); e.value = v; e.dispatchEvent(new Event("input")); }, "a quiet street with a dog and a red car");   // 2.419.0: the tool reads the prompt docker
    await p.fill("#tlbAiSecs", "4");
    await p.click("#tlbAiGo");
    await p.waitForFunction(() => TlBlend.state.ai && TlBlend.state.ai.state === "running", null, { timeout: 15000 });
    const midLog = await p.evaluate(() => document.getElementById("tlbAiLog") && document.getElementById("tlbAiLog").textContent);
    await p.waitForFunction(() => TlBlend.state.ai && TlBlend.state.ai.state !== "running" && TlBlend.state.st && TlBlend.node("Dog"), null, { timeout: 240000 });
    await p.waitForTimeout(600);
    const v2 = await p.evaluate(() => ({ stem: TlBlend.state.st.stem, ai: TlBlend.state.ai.state, ids: Object.keys(TlBlend.state.nodes).sort(), list: TlBlend.state.modelList,
      lines: TlBlend.state.ai.lines }));
    check("✨ Build: the log fills while it runs, then the built scene opens (Quiet_street, every object, the dog)",
      /LLM|1\/5|starting/.test(midLog || "") && v2.ai === "done" && v2.stem === "Quiet_street" && ["Dog", "Red car", "Walker", "Camera", "Street"].every((x) => v2.ids.includes(x)), { midLog, v2 });
    const pixels = await p.evaluate(() => {
      TlBlend.draw();
      const c = document.getElementById("tlbGl"), g = document.createElement("canvas"); g.width = 64; g.height = 36;
      const x = g.getContext("2d"); x.drawImage(c, 0, 0, 64, 36);
      const d = x.getImageData(0, 0, 64, 36).data; const set = new Set();
      for (let i = 0; i < d.length; i += 4) set.add((d[i] >> 4) + "," + (d[i + 1] >> 4) + "," + (d[i + 2] >> 4));
      return set.size;
    });
    check("the built scene draws (through its camera)", pixels > 6, pixels);
    // 3
    await p.waitForFunction(() => (TlBlend.state.modelList || []).includes("Quiet_street_Dog.glb"), null, { timeout: 10000 }).catch(() => {});
    await p.evaluate(() => { TlBlend.setView("free"); TlBlend.frameAll(); });
    await p.selectOption("#tlbAddSel", "Quiet_street_Dog.glb");
    await p.click("#tlbAdd");
    await p.waitForFunction(() => TlBlend.state.sel === "Quiet_street_Dog", null, { timeout: 15000 });
    const added = await p.evaluate(() => {
      const T3 = window.H3THREE, n = TlBlend.node("Quiet_street_Dog"); n.updateMatrixWorld(true);
      const bx = new T3.Box3().setFromObject(n);
      return { h: bx.max.y - bx.min.y, bottom: bx.min.y, e: TlBlend.state.E.objects.Quiet_street_Dog };
    });
    check("＋ Model: the .glb as a new object 'Quiet_street_Dog', selected, 1 m tall, standing on the ground",
      Math.abs(added.h - 1) < 1e-3 && Math.abs(added.bottom) < 1e-3 && added.e && added.e.import === "Quiet_street_Dog.glb" && added.e.base, added);
    await p.waitForTimeout(900);
    const ed = JSON.parse(fs.readFileSync(path.join(pd, "blender", "Quiet_street.edits.json"), "utf8")).objects;
    check("... in the edits (import + its place)", ed.Quiet_street_Dog && ed.Quiet_street_Dog.import === "Quiet_street_Dog.glb", ed);
    await p.evaluate(() => TlBlend.save());
    await p.waitForFunction(() => !TlBlend.state.busy && TlBlend.state.nodes["Quiet_street_Dog"], null, { timeout: 240000 });
    const after = await p.evaluate(() => ({ e: Object.keys(TlBlend.state.E.objects).length, real: !!TlBlend.state.nodes.Quiet_street_Dog,
      meta: (TlBlend.state.meta.objects || []).some((o) => o.id === "Quiet_street_Dog" && o.type === "MESH") }));
    check("💾 Save: Blender adds it - a real object of the scene after the reload, no edits left", after.real && after.meta && after.e === 0, after);
    // 4
    await p.evaluate(() => document.getElementById("tlbClose").click());
    await p.evaluate(() => document.querySelector('[data-gtab="images"]').click());     // (the floating toolbox may sit over it)
    await p.waitForFunction(() => document.querySelector('.thumb[data-lb-kind="image"] .gmesh3d'), null, { timeout: 15000 });
    const jobs0 = (await api("/api/jobs")).filter((x) => (x.params || {}).mode === "mesh3d").length;
    await p.evaluate(() => document.querySelector('.thumb[data-lb-kind="image"] .gmesh3d').click());
    const menu = await p.evaluate(() => document.getElementById("mesh3dMenu") && document.getElementById("mesh3dMenu").innerText);
    check("🧊 on a Gallery picture: asks Hunyuan3D 2.1 (shape) or TRELLIS.2 (textured)", /Hunyuan3D 2\.1 - shape/.test(menu || "") && /TRELLIS\.2 - textured/.test(menu || ""), menu);
    await p.evaluate(() => document.querySelector('#mesh3dMenu button[data-e="auto"]').click());
    let job = null;
    for (let i = 0; i < 60 && !job; i++) {
      await p.waitForTimeout(500);
      const js = (await api("/api/jobs")).filter((x) => (x.params || {}).mode === "mesh3d");
      if (js.length > jobs0) job = js.sort((a, c) => c.created - a.created)[0];
    }
    let done = job;
    for (let i = 0; i < 120 && done && !["done", "failed"].includes(done.status); i++) { await p.waitForTimeout(500); done = await api("/api/jobs/" + job.id); }
    const glb = done && done.output ? path.join(pd, "models3d", done.output) : "";
    check("... queued as a mesh3d job, done, its .glb in models3d/", done && done.status === "done" && glb && fs.existsSync(glb), done && { s: done.status, o: done.output, log: (done.log || []).slice(-4) });
    await p.evaluate(() => { if (typeof refreshAssets === "function") return refreshAssets(); });
    await p.waitForFunction(() => document.querySelector('.aitem[data-lb-kind="image"] .gmesh3d'), null, { timeout: 10000 }).catch(() => {});
    const assetBtn = await p.evaluate(() => !!document.querySelector('.aitem[data-lb-kind="image"] .gmesh3d'));
    check("🧊 on an Assets picture too", assetBtn);
    check("no page errors", errs.length === 0, errs);
  } catch (e) {
    fail++; console.log("FAIL: the run stopped: " + (e && e.stack || e));
  } finally {
    for (const f of made) { try { fs.unlinkSync(f); } catch { /* fine */ } }
    try { await fetch(URL_ + "api/styles/" + encodeURIComponent(SIDG), { method: "DELETE" }); } catch { /* fine */ }
    try { await api("/api/blendview/close", {}); } catch { /* fine */ }
    try { await api("/api/projects/load", { name: "default" }); } catch { /* fine */ }
    await b.close();
    try { fs.rmSync(path.join(ROOT, "projects", P), { recursive: true, force: true }); } catch { /* fine */ }
    console.log(`\nRESULT: ${fail} failed (${pass} passed)`);
    process.exit(fail ? 1 : 0);
  }
})();
