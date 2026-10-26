#!/usr/bin/env node
/* bitGen Studio — scripts/test-modelmgr598.js (2.598.0): the 🧩 MODEL MANAGER FINDS WHAT THE RUNNING COMFYUI HAS.
 * Tim: "the model manager can't find the list of models or loras, comfui is running, models show in the dropdown".
 * The dropdowns ask ComfyUI; the manager only scanned Settings ▸ ComfyUI ▸ Folder (+ its yaml). A fake ComfyUI whose
 * models live in a folder Settings does not know (no Folder set at all):
 *   lib/comfyFolders.js   rootsFrom (/internal/folder_paths, both answer shapes, unet -> diffusion_models), refresh
 *                         (60 s, a ComfyUI that is not running = none, fast)
 *   GET /api/modelmgr/cards   the checkpoint, the diffusion model and the LoRA in ComfyUI's own folders are cards with
 *                         their sizes; a name ComfyUI offers whose file is elsewhere = a name-only card (on_disk false)
 *   comfyModels.scan      extraRoots
 * Nothing written outside a temp folder. */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bg-mm598-"));
process.env.BITGEN_APP_DIR = process.env.BITGEN_APP_DIR || tmp;
const core = require("../lib/core");
const express = require("express");

(async () => {
  const servers = [];
  try {
    const F = require("../lib/comfyFolders");
    const r1 = F.rootsFrom({ checkpoints: [["/m/ckpt"], [".safetensors"]], unet: ["/m/unet"], loras: [["/m/loras", "/n/loras"], []], custom_nodes: [["/x"], []] });
    check("rootsFrom: [[paths], [exts]] and [paths] both read; unet -> diffusion_models; unknown categories left out",
      JSON.stringify(r1.map((r) => r.category + ":" + r.dir)) === '["checkpoints:/m/ckpt","diffusion_models:/m/unet","loras:/m/loras","loras:/n/loras"]', r1);
    const t0 = Date.now(); const none = await F.refresh("http://127.0.0.1:9", { force: true });
    check("a ComfyUI that is not running: no roots, no names, quickly", none.roots.length === 0 && Object.keys(none.names).length === 0 && Date.now() - t0 < 5000);

    // a ComfyUI keeping its models in its own folder (the Desktop app's), unknown to Settings
    const M = path.join(tmp, "Documents", "ComfyUI", "models");
    for (const d of ["checkpoints/SDXL", "diffusion_models", "loras/chars"]) fs.mkdirSync(path.join(M, d), { recursive: true });
    fs.writeFileSync(path.join(M, "checkpoints", "SDXL", "juggernaut.safetensors"), Buffer.alloc(2048));
    fs.writeFileSync(path.join(M, "diffusion_models", "flux2-klein.safetensors"), Buffer.alloc(4096));
    fs.writeFileSync(path.join(M, "loras", "chars", "tim.safetensors"), Buffer.alloc(1024));
    const sep = path.sep;
    const lists = { CheckpointLoaderSimple: ["SDXL" + sep + "juggernaut.safetensors"], UNETLoader: ["flux2-klein.safetensors", "remote-only.gguf"],
                    LoraLoader: ["chars" + sep + "tim.safetensors", "elsewhere" + sep + "style.safetensors"] };
    const fake = express();
    fake.get("/internal/folder_paths", (_q, r) => r.json({ checkpoints: [path.join(M, "checkpoints")], diffusion_models: [[path.join(M, "diffusion_models")], [".safetensors"]], loras: [[path.join(M, "loras")], []] }));
    fake.get("/object_info/:cls", (q, r) => {
      const cls = q.params.cls, key = { CheckpointLoaderSimple: "ckpt_name", UNETLoader: "unet_name", LoraLoader: "lora_name" }[cls];
      if (!key) return r.status(404).json({});
      r.json({ [cls]: { input: { required: { [key]: [lists[cls]] } } } });
    });
    const fsrv = await new Promise((r) => { const s = fake.listen(0, "127.0.0.1", () => r(s)); }); servers.push(fsrv);
    const url = `http://127.0.0.1:${fsrv.address().port}`;
    let CFG = { engine: { comfy: { dir: "", url } } };
    core.getConfig = () => CFG;
    const app = express(); require("../routes/modelMgr").mount(app);
    const asrv = await new Promise((r) => { const s = app.listen(0, "127.0.0.1", () => r(s)); }); servers.push(asrv);
    const d = await (await fetch(`http://127.0.0.1:${asrv.address().port}/api/modelmgr/cards?refresh=1`)).json();
    const names = (a) => (a || []).map((c) => c.name.split(/[\\/]/).join("/") + (c.on_disk === false ? " (name only)" : " " + c.size)).sort();
    check("no ComfyUI folder in Settings - the cards come from the folders the running ComfyUI reports: the checkpoint, the diffusion model (with sizes)",
      JSON.stringify(names(d.models)) === JSON.stringify(["SDXL/juggernaut.safetensors 2048", "flux2-klein.safetensors 4096", "remote-only.gguf (name only)"]), { models: names(d.models), warnings: d.warnings, error: d.error });
    check("…and the LoRAs: the one on disk + a name ComfyUI offers whose file is elsewhere (a name-only card)",
      JSON.stringify(names(d.loras)) === JSON.stringify(["chars/tim.safetensors 1024", "elsewhere/style.safetensors (name only)"]), names(d.loras));
    check("the folder tabs still work (SDXL, chars) and the answer says how many ComfyUI folders it used", d.models.some((c) => c.folder === "SDXL") && d.loras.some((c) => c.folder === "chars") && d.comfy_roots === 3, d.comfy_roots);
    const S = require("../lib/comfyModels").scan("", { extraRoots: [{ dir: path.join(M, "loras"), category: "loras" }] });
    check("comfyModels.scan takes extraRoots (source comfyui)", S.categories.loras.files.length === 1 && S.categories.loras.roots[0].source === "comfyui", S.categories.loras);
  } catch (e) { fail++; console.log("FAIL: crashed - " + (e && e.stack || e)); }
  finally { for (const s of servers) try { s.close(); } catch { /* fine */ } try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* fine */ } }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
