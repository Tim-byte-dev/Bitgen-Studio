#!/usr/bin/env node
/* bitGen Studio — LTX 2.5: one mode of Tim's all-in-one canvas -> an API
 * prompt (2.338.0). Run by ltx_worker.py with the app's own node (Electron
 * as node: ELECTRON_RUN_AS_NODE=1), so the conversion uses the SAME code as
 * Settings -> ComfyUI -> Graphs (lib/subgraphs + lib/graphToApi) against the
 * LIVE ComfyUI's /object_info - the widget order comes from the server that
 * will run it, never from a table here.
 *
 *   node scripts/ltx_convert.js classes <ui.json> <mode> [opts.json]
 *       -> stdout JSON {classes:[...]}   (what to ask /object_info for)
 *   node scripts/ltx_convert.js convert <ui.json> <mode> <opts.json> <object_info.json> <out.json>
 *       -> writes {graph, warnings, dropped, unknown, notes, loader}
 * opts.json = { model, te } (lib/ltxWorkflow.prepare). */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const LW = require(path.join(ROOT, "lib", "ltxWorkflow"));
const G2A = require(path.join(ROOT, "lib", "graphToApi"));

/* 2.401.5: Comfy-Org's LTX 2.5 templates (lib/ltxOfficial):
 *   node scripts/ltx_convert.js oclasses <template.json> <opts.json>                 -> {classes, notes, models}
 *   node scripts/ltx_convert.js oconvert <template.json> <opts.json> <info.json> <out.json>
 * opts.json = {mode, prompt, seconds, width, height, seed, fps, images, prefix, lists, style} */
function official(cmd, uiPath, optsPath, infoPath, outPath) {
  const LO = require(path.join(ROOT, "lib", "ltxOfficial"));
  const ui = JSON.parse(fs.readFileSync(uiPath, "utf8"));
  const opts = optsPath && fs.existsSync(optsPath) ? JSON.parse(fs.readFileSync(optsPath, "utf8") || "{}") : {};
  const p = LO.prepare(ui, opts);
  if (cmd === "oclasses") {
    process.stdout.write(JSON.stringify({ classes: LW.classesOf(p.ui).filter((c) => c !== "PrimitiveNode"), notes: p.notes, models: p.models }));
    return 0;
  }
  const info = JSON.parse(fs.readFileSync(infoPath, "utf8"));
  const out = G2A.convert(p.ui, info);
  fs.writeFileSync(outPath, JSON.stringify({ graph: out.graph, warnings: out.warnings || [], dropped: out.dropped || [],
    unknown: out.unknown ? [...out.unknown] : [], notes: p.notes, models: p.models }, null, 1));
  return out.graph ? 0 : 3;
}

function main(argv) {
  const [cmd, uiPath, mode, optsPath, infoPath, outPath] = argv;
  if (cmd === "oclasses" || cmd === "oconvert") return official(cmd, argv[1], argv[2], argv[3], argv[4]);
  const ui = JSON.parse(fs.readFileSync(uiPath, "utf8"));
  let opts = {};
  if (optsPath && fs.existsSync(optsPath)) {
    const t = fs.readFileSync(optsPath, "utf8").trim();
    if (t) opts = JSON.parse(t);
  }
  const p = LW.prepare(ui, { ...opts, mode });
  if (cmd === "classes") {
    process.stdout.write(JSON.stringify({ classes: LW.classesOf(p.ui), notes: p.notes, loader: p.loader }));
    return 0;
  }
  if (cmd === "convert") {
    const info = JSON.parse(fs.readFileSync(infoPath, "utf8"));
    const out = G2A.convert(p.ui, info);
    /* rgthree's Power Lora Loader keeps its rows (lora_1, lora_2 ...) as
       dict widgets /object_info does not declare - carried across from the
       canvas, the shape its own API export writes, so Tim's LoRAs stay on. */
    if (out.graph) {
      for (const n of p.ui.nodes) {
        if (!String(n.type).startsWith("Power Lora Loader")) continue;
        const api = out.graph[String(n.id)];
        if (!api) continue;
        let k = 0;
        for (const w of Array.isArray(n.widgets_values) ? n.widgets_values : []) {
          if (w && typeof w === "object" && "lora" in w) api.inputs[`lora_${++k}`] = { on: w.on !== false, lora: w.lora, strength: w.strength, strengthTwo: w.strengthTwo == null ? null : w.strengthTwo };
        }
        api.inputs.PowerLoraLoaderHeaderWidget = { type: "PowerLoraLoaderHeaderWidget" };
        api.inputs["➕ Add Lora"] = "";
      }
    }
    fs.writeFileSync(outPath, JSON.stringify({ graph: out.graph, warnings: out.warnings || [], dropped: out.dropped || [],
      unknown: out.unknown ? [...out.unknown] : [], notes: p.notes, loader: p.loader }, null, 1));
    return out.graph ? 0 : 3;
  }
  throw new Error("usage: ltx_convert.js classes|convert ...");
}

if (require.main === module) {
  try { process.exit(main(process.argv.slice(2))); }
  catch (e) { process.stderr.write(String((e && e.message) || e) + "\n"); process.exit(2); }
}
module.exports = { main };
