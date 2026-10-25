#!/usr/bin/env node
/* bitGen Studio — 2.593.0 in a REAL browser, against the running app (H3_URL): FACE FIX and CONTROLNET as add-ons.
 *   Settings ▸ General ▸ Add-ons in the studio - both off: Basic Settings' Face fix / ControlNet sections, the ControlNet
 *   Settings tab and their Add-ons cards are hidden; Face fix on: its section + its card with the download links (the
 *   node packs + the detector, each with its folder), "everything it needs is there" (a temp ComfyUI that has it all);
 *   ControlNet on: its section, its Settings tab, its card (11 links); off again = hidden. Settings put back.
 * Tim: "make facefix and controlnet into addons and put the links to dl in addons tab. only show if they are enabled in
 * the general tab. if they are enabled check for all the models and download them into the correct folder if they do
 * not exist". No Playwright = SKIP. */
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
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.593.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const post = async (p, b) => (await fetch(URL_ + p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b || {}) })).json();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bg-ui593-"));
const M = require("../lib/setupModels");

(async () => {
  const cfg0 = await (await fetch(URL_ + "api/config")).json();
  const eng0 = JSON.parse(JSON.stringify(cfg0.engine || {}));
  const f0 = (await (await fetch(URL_ + "api/features")).json()).features || {};
  // a ComfyUI that already has everything both add-ons need (nothing downloads)
  const C = path.join(tmp, "ComfyUI");
  fs.mkdirSync(path.join(C, "comfy"), { recursive: true }); fs.writeFileSync(path.join(C, "main.py"), "#");
  for (const f of ["ComfyUI-Impact-Pack", "ComfyUI-Impact-Subpack", "comfyui_controlnet_aux"]) fs.mkdirSync(path.join(C, "custom_nodes", f), { recursive: true });
  const P = { comfyModels: path.join(C, "models"), comfyNodes: path.join(C, "custom_nodes"), app: tmp };
  for (const id of ["face_yolo", "cn_ann_dwpose_det", "cn_ann_dwpose_pose", "cn_ann_pidinet", "cn_ann_lineart", "cn_ann_lineart2", "cn_ann_depth", "cn_sdxl_union", "cn_sdxl_openpose", "cn_sdxl_scribble", "cn_sdxl_depth"]) {
    const d = M.destPath(M.byId(id), P); fs.mkdirSync(path.dirname(d), { recursive: true }); fs.writeFileSync(d, "x");
  }
  await post("api/config", { engine: { comfy: Object.assign({}, eng0.comfy || {}, { dir: C }) } });
  await post("api/features", { id: "facefix", on: false }); await post("api/features", { id: "controlnet", on: false });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  const look = () => ev(() => {
    const shown = (sel) => { const e = document.querySelector(sel); return !!e && !e.classList.contains("feat-off") && getComputedStyle(e).display !== "none"; };
    return { ffSec: shown('h2.sec[data-sec="facefix"]'), ffBody: !!document.getElementById("sec-facefix") && !document.getElementById("sec-facefix").classList.contains("feat-off"),
      cnSec: shown('h2.sec[data-sec="cnet"]'), cnTab: shown('#settings .stabs [data-stab="cnet"]'),
      ffCb: document.getElementById("s_feat_facefix").checked, cnCb: document.getElementById("s_feat_controlnet").checked,
      msg: document.getElementById("s_feat_msg").textContent };
  });
  const cards = async () => { await ev(() => window.H3Addons.refresh()); return ev(() => [...document.querySelectorAll("#aoList .ao")].map((c) => ({ id: c.dataset.addon,
    links: [...c.querySelectorAll(".lnk a")].map((a) => a.href), dests: [...c.querySelectorAll(".lnk .to")].map((s) => s.textContent) }))); };
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3Features && window.H3Addons && document.getElementById("s_feat_facefix"), null, { timeout: 60000 });
    await p.waitForTimeout(1200);
    await ev(() => window.H3Features.load());
    await ev(() => { if (typeof openSettings === "function") openSettings(); else document.getElementById("settings").showModal(); });
    await ev(() => document.querySelector('#settings .stabs [data-stab="general"]').click());
    const off = await look();
    check("both off: Basic Settings' Face fix + ControlNet hidden, the ControlNet Settings tab hidden, the switches unticked", !off.ffSec && !off.ffBody && !off.cnSec && !off.cnTab && !off.ffCb && !off.cnCb, off);
    await ev(() => document.querySelector('#settings .stabs [data-stab="addons"]').click());
    const c0 = await cards();
    check("Settings ▸ Add-ons: no Face fix / ControlNet card while they are off", !c0.some((c) => c.id === "facefix" || c.id === "controlnet") && c0.length > 3, c0.map((c) => c.id));
    await ev(() => document.querySelector('#settings .stabs [data-stab="general"]').click());
    await ev(() => { const cb = document.getElementById("s_feat_facefix"); cb.checked = true; cb.dispatchEvent(new Event("change", { bubbles: true })); });
    await p.waitForFunction(() => /Face fix is on/.test(document.getElementById("s_feat_msg").textContent), null, { timeout: 15000 });
    const on1 = await look();
    check("Face fix on: its Basic Settings section shows (ControlNet still hidden); the switch is saved; everything it needs is there (nothing downloads)",
      on1.ffSec && on1.ffBody && !on1.cnSec && on1.ffCb && /everything it needs is there/.test(on1.msg) && (await (await fetch(URL_ + "api/features")).json()).features.facefix === true, on1);
    await ev(() => document.querySelector('#settings .stabs [data-stab="addons"]').click());
    const c1 = await cards();
    const ff = c1.find((c) => c.id === "facefix") || {};
    check("its Add-ons card: the download links - Impact Pack + Subpack (GitHub), face_yolov8m.pt (Hugging Face) -> ComfyUI/models/ultralytics/bbox",
      ff.links && ff.links.length === 3 && ff.links.some((u) => /github\.com\/ltdrdata\/ComfyUI-Impact-Pack$/.test(u)) && ff.links.some((u) => /huggingface\.co\/Bingsu\/adetailer\/blob\/main\/face_yolov8m\.pt$/.test(u))
      && ff.dests.some((d) => /ComfyUI\/models\/ultralytics\/bbox\/face_yolov8m\.pt/.test(d)) && !c1.some((c) => c.id === "controlnet"), ff);
    await ev(() => document.querySelector('#settings .stabs [data-stab="general"]').click());
    await ev(() => { const cb = document.getElementById("s_feat_controlnet"); cb.checked = true; cb.dispatchEvent(new Event("change", { bubbles: true })); });
    await p.waitForFunction(() => /ControlNet is on/.test(document.getElementById("s_feat_msg").textContent), null, { timeout: 15000 });
    const on2 = await look();
    check("ControlNet on: its Basic Settings section and its Settings tab show", on2.cnSec && on2.cnTab && on2.cnCb, on2);
    await ev(() => document.querySelector('#settings .stabs [data-stab="addons"]').click());
    const cn = ((await cards()).find((c) => c.id === "controlnet")) || {};
    check("its card: 11 links - comfyui_controlnet_aux, the six preprocessor models -> custom_nodes/comfyui_controlnet_aux/ckpts/<repo>, the four SDXL ControlNets -> models/controlnet",
      cn.links && cn.links.length === 11 && cn.dests.filter((d) => /custom_nodes\/comfyui_controlnet_aux\/ckpts\//.test(d)).length === 6 && cn.dests.filter((d) => /models\/controlnet\/xinsir-/.test(d)).length === 4, cn);
    await ev(() => document.querySelector('#settings .stabs [data-stab="cnet"]').click());
    await ev(() => document.querySelector('#settings .stabs [data-stab="general"]').click());
    await ev(() => { for (const id of ["facefix", "controlnet"]) { const cb = document.getElementById("s_feat_" + id); cb.checked = false; cb.dispatchEvent(new Event("change", { bubbles: true })); } });
    await p.waitForFunction(() => /is off/.test(document.getElementById("s_feat_msg").textContent), null, { timeout: 15000 });
    await p.waitForTimeout(500);
    const off2 = await look();
    check("both off again: hidden again", !off2.ffSec && !off2.cnSec && !off2.cnTab, off2);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + (e && e.stack || e)); }
  finally {
    try { await b.close(); } catch { /* fine */ }
    try { for (const id of ["facefix", "controlnet"]) await post("api/features", { id, on: !!f0[id] }); } catch { /* fine */ }
    try { await post("api/config", { engine: eng0 }); } catch { /* fine */ }
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* fine */ }
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
