#!/usr/bin/env node
/* bitGen Studio — 2.557.0 units: Settings ▸ Add-ons ▸ AI fill models (lib/aiFillAddon.js, lib/addons.js, routes/addons.js,
 * static/addons.js) - the Krita AI plugin's fill helpers: the node pack + the ticked models from the model list.
 * Tim: "add download ai fill models to addons tab in settings dialog". */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const rd = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const F = require(path.join(ROOT, "lib", "aiFillAddon.js"));
const M = require(path.join(ROOT, "lib", "setupModels.js"));
const A = require(path.join(ROOT, "lib", "addons.js"));

(async () => {
  check("ITEMS: every file is in the model list's inpaint group; Fooocus = head + patch; the defaults are Fooocus, MAT, NoobAI",
    F.ITEMS.every((i) => i.files.every((id) => { const m = M.byId(id); return m && m.group === "inpaint"; })) && F.ITEMS.find((i) => i.id === "fooocus").files.join() === "fooocus_head,fooocus_patch"
    && F.DEFAULTS.join() === "fooocus,mat,noobai");
  // a ComfyUI folder of our own
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "aifill-"));
  const pl = { ok: true, customNodes: path.join(tmp, "custom_nodes"), models: path.join(tmp, "models"), python: "" };
  fs.mkdirSync(pl.customNodes, { recursive: true });
  let s = F.status(pl);
  check("status: nothing there = not installed, every item listed with its size, none downloaded", !s.installed && !s.pack && s.items.length === F.ITEMS.length && s.items.every((i) => !i.present && /B$/.test(i.size)), s);
  // install with fakes: the packs, then the files
  const did = [];
  const packInstall = async (p) => { did.push("pack:" + p.id); fs.mkdirSync(path.join(pl.customNodes, p.folder), { recursive: true }); return { ok: true }; };
  const download = async (m) => { did.push("file:" + m.id); const d = M.destPath(m, { comfyModels: pl.models, app: ROOT }); fs.mkdirSync(path.dirname(d), { recursive: true }); fs.writeFileSync(d, "x"); return { ok: true }; };
  const lines = [], log = (l) => lines.push(l);
  const r = await F.install(log, ["fooocus", "noobai"], { place: pl, packInstall, download });
  check("install: comfyui-inpaint-nodes, then the ControlNet preprocessor pack (a ControlNet was ticked), then the ticked files (Fooocus head + patch, NoobAI)",
    r.ok && did.join() === "pack:inpaint,pack:cnaux,file:fooocus_head,file:fooocus_patch,file:cn_noobai_inpaint" && lines.some((l) => /restart ComfyUI once/.test(l)), { r, did });
  s = F.status(pl);
  check("...status: installed, the pack there, Fooocus + NoobAI downloaded (into models/inpaint + models/controlnet)", s.installed && s.pack && s.items.find((i) => i.id === "fooocus").present && s.items.find((i) => i.id === "noobai").present && !s.items.find((i) => i.id === "mat").present
    && fs.existsSync(path.join(pl.models, "inpaint", "inpaint_v26.fooocus.patch")) && fs.existsSync(path.join(pl.models, "controlnet", "noobaiInpainting_v10.fp16.safetensors")), s);
  did.length = 0;
  const r2 = await F.install(log, ["mat"], { place: pl, packInstall, download });
  check("a second install: the pack is there (skipped), no ControlNet ticked = no preprocessor pack; only MAT", r2.ok && did.join() === "file:mat_places", did);
  const r3 = await F.install(log, [], { place: Object.assign({}, pl, { ok: false, error: "folder not found" }), packInstall, download });
  check("no ComfyUI = an error in words (set its folder first)", !r3.ok && /ComfyUI not found/.test(r3.error), r3);
  const bad = await F.install(log, ["fooocus"], { place: pl, packInstall, download: async () => ({ ok: false, error: "gated" }) });
  check("a download that fails stops with its reason", !bad.ok && /gated/.test(bad.error), bad);
  const rm = await F.remove(log, pl);
  s = F.status(pl);
  check("remove: the model files deleted, the node pack stays", rm.ok && s.items.every((i) => !i.present) && s.pack, s);
  fs.rmSync(tmp, { recursive: true, force: true });
  // the add-ons list + the job
  const it = A.list().find((x) => x.id === "aifill");
  check("lib/addons.js: \"AI fill models\" is in the list with its items (what can be ticked), a size line naming each", it && Array.isArray(it.items) && it.items.length === F.ITEMS.length && /Fooocus inpaint .*GB/.test(it.size) && /Krita/.test(it.label), it);
  A._reset();
  const st = A.start("aifill", "install", { items: ["mat"] });
  for (let i = 0; i < 40 && A.job() && A.job().state === "running"; i++) await new Promise((r) => setTimeout(r, 50));
  check("start(aifill, install, {items}) runs one job (here: no ComfyUI in the test folder -> it ends with the reason)", st.ok && A.job().id === "aifill" && (A.job().state === "error" ? /ComfyUI/.test(A.job().error) : A.job().state === "done"), A.job());
  A._reset();
  const RA = rd("routes", "addons.js"), SA = rd("static", "addons.js"), KI = require(path.join(ROOT, "lib", "kritaInpaint.js"));
  check("route: POST /api/addons/:id/install passes {items}; the tab draws the items with checkboxes + ✓ downloaded and sends the ticked ones; the editor's 'missing' says where to get them",
    /A\.start\(String\(req\.params\.id \|\| ""\), action, \{ items, reinstall \}\)/.test(RA) && /data-aoi=/.test(SA) && /✓ downloaded/.test(SA) && /opt\.body = JSON\.stringify\(\{ items: picks, reinstall: again \}\)/.test(SA) && /⤓ Download ticked/.test(SA)
    && KI.missing({ online: true, cn: {} }).every((m) => /Settings ▸ Add-ons ▸ AI fill models/.test(m)) && typeof KI.reset === "function");
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
