#!/usr/bin/env node
/* bitGen Studio — 2.579.0 in a REAL browser: 🗑 a model deleted from the model manager (and from the disk), Settings ▸
 * Dockers (every docker incl. a NEW extension docker, ↺ Reset back to its default place and size), the 📐 SolidCraft
 * docker not shown while SolidCraft is not installed, and Blender opening a SolidCraft OBJ in metres (the script run
 * headless when this machine has Blender). Tim: "allow user to delete models in model manager ... delete it from the
 * disk too" + "in settings dialog add dockers tab, add all the dockers to that tab including custom/new dockers with a
 * reset button" + "only show the docker is solidcraft is installed". Against the running app (H3_URL). */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execSync, spawnSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.579.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const api = async (u, body) => (await fetch(URL_ + u.replace(/^\//, ""), body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();

(async () => {
  const cfg0 = await api("/api/config");
  const keepDir = ((cfg0.engine || {}).comfy || {}).dir || "";
  const T = fs.mkdtempSync(path.join(os.tmpdir(), "bg579ui-"));
  const FX = require("./mmfixture518.js"), F = FX.make(T);
  const MODEL = path.join(F.models, "checkpoints", "e2e579_doomed.safetensors");
  FX.safetensors(MODEL, { "modelspec.architecture": "stable-diffusion-xl-v1-base" }, ["conditioner.embedders.1.x"]);
  fs.writeFileSync(MODEL.replace(/\.safetensors$/, ".preview.png"), "png");
  const KEY = "checkpoints|e2e579_doomed.safetensors";
  const INFO = path.join(ROOT, "model_info", "models", "e2e579_doomed");
  fs.mkdirSync(INFO, { recursive: true }); fs.writeFileSync(path.join(INFO, "info.json"), JSON.stringify({ v: 1, file: "e2e579_doomed.safetensors", status: "nomatch" }));
  await api("/api/config", { engine: { comfy: { dir: F.comfy } } });
  // a NEW extension docker (the page is put together per request - it is listed without a restart)
  const EXT = path.join(ROOT, "ext", "e2e579dock");
  fs.mkdirSync(EXT, { recursive: true });
  fs.writeFileSync(path.join(EXT, "ext.json"), JSON.stringify({ id: "e2e579dock", name: "E2E579 Dock", order: 99, html: "dock.html", scripts: [] }));
  fs.writeFileSync(path.join(EXT, "dock.html"), '<div class="bdock" id="e2e579dock"><div class="bhead" data-collapse="e2e579dock">▾ E2E579 Dock<button class="maxbtn" data-max="e2e579dock">⛶</button></div><div class="bbody"><p>a custom docker</p></div></div>');
  const scWas = (await api("/api/solidcraft/status")).installed;
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 2200, height: 1300 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3ModelMgr && window.H3DockReset, null, { timeout: 90000 });
    await p.waitForTimeout(2500);
    /* 1 🗑 a model, from the disk */
    await api("/api/modelmgr/cards?refresh=1");
    await ev(() => { document.getElementById("mmBtn").click(); });
    await p.waitForFunction((k) => document.querySelector('.mmcard[data-key="' + k + '"] [data-mmdel]'), KEY, { timeout: 30000 });
    await ev((k) => document.querySelector('.mmcard[data-key="' + k + '"] [data-mmdel]').click(), KEY);
    await p.waitForFunction(() => document.querySelector("dialog[open] #note_body"), null, { timeout: 10000 });
    const ask = await ev(() => document.querySelector("dialog[open] #note_body").textContent);
    await ev(() => document.querySelector("dialog[open] #note_ok").click());
    await p.waitForFunction((k) => /deleted from the disk/.test((document.getElementById("mmMsg") || {}).textContent || "") && !document.querySelector('.mmcard[data-key="' + k + '"]'), KEY, { timeout: 20000 });
    check("🗑 on a card: a confirmation naming the file, what is beside it and its model_info page - then the model is gone from the disk (and its preview, and model_info), the card gone",
      /e2e579_doomed\.safetensors/.test(ask) && /preview\.png/.test(ask) && /model_info/.test(ask) && !fs.existsSync(MODEL) && !fs.existsSync(MODEL.replace(/\.safetensors$/, ".preview.png")) && !fs.existsSync(INFO), ask);
    await ev(() => { try { window.SecFloat.show("modelmgr", false); } catch (e) { /* fine */ } });
    /* 2 the SolidCraft docker while it is not installed */
    if (!scWas) {
      await p.waitForTimeout(1800);
      const sc = await ev(() => { const d = document.getElementById("solidcraftdock"), t = document.getElementById("tX_solidcraftdock"); return { dock: d && d.classList.contains("sc-absent"), shown: d && d.offsetParent !== null, btn: !t || (t.classList.contains("sc-absent") && t.offsetParent === null), listed: window.H3DockReset.list().some((x) => x.id === "solidcraftdock") }; });
      check("SolidCraft not installed: no 📐 SolidCraft docker, no status-bar button, not in the Dockers list", sc.dock && !sc.shown && sc.btn && !sc.listed, sc);
    }
    /* 3 Settings ▸ Dockers */
    await ev(() => window.H3DockReset.open());
    await p.waitForSelector("#stab-dockers.active #drList table", { timeout: 10000 });
    const rows = await ev(() => [...document.querySelectorAll("#drList tr td:first-child")].map((t) => t.textContent));
    const want = ["Timeline", "StoryBoard", "Image editor", "Prompt", "Settings", "Gallery", "E2E579 Dock", "Basic Settings"];
    check("Settings ▸ Dockers lists every docker - the main column, the side dockers, the floating windows and a NEW extension docker", want.every((w) => rows.some((r) => r.indexOf(w) === 0)), rows);
    // move / size some, then ↺ Reset each
    await ev(() => { window.setVar("th", 420); const tl = document.getElementById("timelinedock"); if (!tl.classList.contains("collapsed")) window.toggleCollapse("timelinedock");
      const e = document.getElementById("e2e579dock"); e.style.height = "44px"; if (!e.classList.contains("collapsed")) window.toggleCollapse("e2e579dock");
      window.applyLayout({ rdock: { width: 520 } });
      window.SecFloat.show("basic", true); window.SecFloat.float("basic", 700, 420, 380, 300); });
    await p.waitForTimeout(500);
    const before = await ev(() => ({ th: getComputedStyle(document.documentElement).getPropertyValue("--th").trim(), tl: document.getElementById("timelinedock").classList.contains("collapsed"), rd: getComputedStyle(document.documentElement).getPropertyValue("--rdock").trim(), bx: window.SecFloat.state("basic").x }));
    for (const id of ["timelinedock", "e2e579dock", "rdock", "basic"]) {
      await ev((i) => { const b2 = [...document.querySelectorAll("[data-drreset]")].find((x) => x.dataset.drreset.split(":")[1] === i); b2.click(); }, id);
      await p.waitForTimeout(600);
    }
    const after = await ev(() => { const e = document.getElementById("e2e579dock"); return { th: getComputedStyle(document.documentElement).getPropertyValue("--th").trim(), tl: document.getElementById("timelinedock").classList.contains("collapsed"),
      eh: e.style.height, ec: e.classList.contains("collapsed"), rd: getComputedStyle(document.documentElement).getPropertyValue("--rdock").trim(), bs: window.SecFloat.state("basic"), msg: document.getElementById("drMsg").textContent }; });
    check("↺ Reset Timeline: its default height (150 px) and open again", before.th === "420px" && before.tl && after.th === "150px" && !after.tl, { before, after });
    check("↺ Reset a NEW extension docker: its own size again (no fixed height) and open", after.eh === "" && !after.ec, after);
    check("↺ Reset Gallery: its default width (300 px)", before.rd === "520px" && after.rd === "300px", { before, after });
    check("↺ Reset a floating window (Basic Settings): back at its first place and size", before.bx === 700 && after.bs.x !== 700 && after.bs.mode === "float", { before: before.bx, after: after.bs });
    const st = await api("/api/docker-status");
    check("...and written to docker_status.json (timeline 150, gallery 300)", st.docks.timelinedock.height === 150 && st.docks.rdock.width === 300, st.docks.timelinedock);
    await ev(() => { window.SecFloat.show("basic", false); const d = document.getElementById("settings"); if (d && d.open) d.close(); });
    /* 4 Blender opens a SolidCraft OBJ in metres (the script, headless here) */
    let bl = ""; try { bl = execSync("command -v blender", { encoding: "utf8" }).trim(); } catch { bl = ""; }
    if (bl) {
      const obj = path.join(T, "sc_part.obj"), out = path.join(T, "b", "sc_part.blend");
      fs.writeFileSync(obj, "o Body1\nv 0 0 0\nv 40 0 0\nv 40 30 0\nv 0 30 0\nv 0 0 20\nv 40 0 20\nv 40 30 20\nv 0 30 20\nf 1 2 3 4\nf 5 6 7 8\nf 1 2 6 5\nf 2 3 7 6\nf 3 4 8 7\nf 4 1 5 8\n");
      spawnSync(bl, ["-b", "--python", path.join(ROOT, "scripts", "blend_open_model.py"), "--", obj, out], { timeout: 120000 });
      const r = spawnSync(bl, ["-b", out, "--python-expr", "import bpy;o=bpy.data.objects[0];print('DIMS',o.name,*[round(v,4) for v in o.dimensions],len(bpy.data.objects))"], { encoding: "utf8", timeout: 120000 });
      const m = /DIMS (\S+) ([\d.]+) ([\d.]+) ([\d.]+) (\d+)/.exec(r.stdout || "");
      check("🟠 Send to Blender's script: a 40 × 30 × 20 mm SolidCraft part is 0.04 × 0.03 × 0.02 m in Blender, Z up, alone in the scene, named after the file, saved as the .blend",
        m && m[1] === "sc_part" && +m[2] === 0.04 && +m[3] === 0.03 && +m[4] === 0.02 && m[5] === "1", (r.stdout || "").slice(-300));
    } else console.log("NOTE: no Blender here - its script was not run");
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + (e && e.stack || e)); }
  finally {
    await b.close();
    try { await api("/api/config", { engine: { comfy: { dir: keepDir } } }); } catch (e) { /* fine */ }
    fs.rmSync(EXT, { recursive: true, force: true }); fs.rmSync(INFO, { recursive: true, force: true }); fs.rmSync(T, { recursive: true, force: true });
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
