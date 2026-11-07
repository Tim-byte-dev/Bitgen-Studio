#!/usr/bin/env node
/* bitGen Studio — 2.708.0: 16 GB MODE - the app side (lib/vram16.js, the add-on, Settings ▸ ComfyUI ▸ 16 GB mode, the
 * model catalog, the route). The graph side: scripts/test-vram16708.py.
 * Tim (verbatim): "this workflow is meant to work with 16gb vram - minimax" */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const rd = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const V = require(path.join(ROOT, "lib", "vram16.js"));

check("settings: Auto by default (on for a card of 16 GB or less), upscale 1.0-2.0 (1.5), pass 1 in 8 steps on; junk falls back",
  JSON.stringify(V.cfg({})) === '{"mode":"auto","scale":1.5,"turbo":true}' && V.cfg({ mode: "OFF", scale: 9, turbo: false }).mode === "off"
  && V.cfg({ scale: 9 }).scale === 2 && V.cfg({ scale: 0.3 }).scale === 1 && V.cfg({ mode: "maybe" }).mode === "auto" && V.cfg({ turbo: false }).turbo === false);
const C = JSON.parse(rd("lib/modelCatalog.json"));
const cat = (C.models || C.items || C.files || (Array.isArray(C) ? C : Object.values(C).find(Array.isArray)) || []);
const by = (id) => cat.find((m) => m.id === id) || null;
check("the files are in the model catalog where DENO's links point (Kijai Acc + 2K refiner, drbaph DMD, the LBH latent upscaler) - into ComfyUI's loras / latent_upscale_models",
  V.ITEMS.every((i) => by(i.file)) && by("h3_acc8").repo === "Kijai/MiniMax-H3-experimental" && /Acc-8Step_pruned_comfy/.test(by("h3_acc8").file)
  && by("h3_dmd_ref").repo === "drbaph/MiniMax-H3-Turbo-Lora-ComfyUI" && /^experimental\//.test(by("h3_dmd_ref").file) && /2k_refiner_rank_16/.test(by("h3_refiner2k").file)
  && ["h3_acc8", "h3_dmd_ref", "h3_refiner2k"].every((id) => by(id).dest === "comfy/loras"), V.ITEMS.map((i) => [i.file, !!by(i.file)]));
const fakeComfy = (inst) => ({ packInstalled: (k) => ({ installed: inst.includes(k) }) });
const pl = { ok: true, models: "/nonexistent/models" };
const s1 = V.status({ place: pl, comfy: fakeComfy([]), cfg: {} });
check("status: each file and node pack with present / installed; nothing there = not ready, and it says what to get (a render leaves out only what is missing)",
  s1.items.length === 4 && s1.items.every((i) => i.present === false) && s1.packs.map((p) => p.key).join() === "deno,h3latentup,kjnodes"
  && !s1.ready && /missing files/.test(s1.note) && /DENO custom nodes/.test(s1.note) && /leaves out only/.test(s1.note) && !/KJNodes/.test(s1.note.split("missing node packs")[1] || ""), s1);
check("…ComfyUI not found: says to set its folder", /set its folder/.test(V.status({ place: { ok: false, error: "no folder" }, comfy: fakeComfy([]) }).note));
const A = require(path.join(ROOT, "lib", "addons.js"));
const list = A.ADDONS || A.LIST || (typeof A.list === "function" ? A.list() : null) || [];
const ad = (Array.isArray(list) ? list : Object.values(list)).find((x) => x && x.id === "vram16");
check("Settings ▸ Add-ons ▸ 16 GB mode downloads the files (lib/vram16.js install / remove / status)", !!ad && typeof ad.install === "function" && typeof ad.remove === "function" && /16 GB/.test(ad.label) || /id: "vram16"/.test(rd("lib/addons.js")));
check("the route: GET /api/vram16 (routes/vram16.js, mounted from routes/index.js - not server.js)", /require\("\.\/vram16"\)\.mount\(app\)/.test(rd("routes/index.js")) && /app\.get\("\/api\/vram16"/.test(rd("routes/vram16.js")) && !/vram16/.test(rd("misc/server.js")));
const IDX = rd("static/index.html");
check("Settings ▸ ComfyUI ▸ 16 GB mode: Auto / On / Off, the upscale, the 8-step pass 1, the status, the latent upscaler nodes' install button, the files button; saved as engine.comfy.vram16",
  ['id="s_c16mode"', 'id="s_c16scale"', 'id="s_c16turbo"', 'id="s_c16status"', 'data-pack="h3latentup"', 'id="s_c16files"'].every((x) => IDX.includes(x))
  && /vram16: window\.H3Vram16 \? H3Vram16\.read\(\)/.test(IDX) && /H3Vram16\.fill\(\(eng\.comfy \|\| \{\}\)\.vram16\)/.test(IDX) && /src="\/static\/vram16\.js"/.test(IDX));
check("the default is Auto in the app's config and in the worker (absent = auto)", /vram16: \{ mode: "auto", scale: 1\.5, turbo: true \}/.test(rd("lib/core.js")) && /get\("mode"\) or "auto"/.test(rd("misc/worker.py")));
check("the latent upscaler node pack is installable (lib/comfy.js VACCEL repo h3latentup) and the DENO one (deno)", /h3latentup: \{ url: "https:\/\/github\.com\/LBH-123-AI\/Comfyui_Minimax_h3_latent_Upscaler\.git"/.test(rd("lib/comfy.js")) && /\bdeno: \{ url: "https:\/\/github\.com\/Deno2026\/comfyui-deno-custom-nodes/.test(rd("lib/comfy.js")));
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
