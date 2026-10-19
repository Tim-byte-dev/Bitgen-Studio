#!/usr/bin/env node
/* bitGen Studio — 2.402.1: our UI -> API conversion against COMFYUI'S OWN FRONTEND.
 *
 * Tim's LTX 2.5 run (verbatim log): "SamplerCustomAdvanced ... Sizes of tensors must match except in dimension 2.
 * Expected size 1 but got size 25 for tensor number 1" - "i am using the latest comfy". The cause:
 * LTXVEmptyLatentAudio's frame_rate is a MULTI-TYPE input ("FLOAT,INT", widgetType FLOAT) that lib/graphToApi did not
 * count as a widget, so its saved 25 slid onto batch_size (an audio latent 25 deep beside a video latent of 1).
 *
 * The ground truth: scripts/fixtures/frontend/ltx_templates_graphToPrompt.json = what ComfyUI's frontend
 * (comfyui-frontend-package with ComfyUI master 0df64eb, headless Chromium: app.loadGraphData + app.graphToPrompt)
 * sends for each of the seven Comfy-Org LTX templates after lib/ltxOfficial.prepare. Our converter must send the SAME
 * graph: every node, every input, every link.
 * Run: node scripts/test-frontendparity.js */
"use strict";
const path = require("path");
const ROOT = path.join(__dirname, "..");
const LO = require(path.join(ROOT, "lib", "ltxOfficial.js"));
const G = require(path.join(ROOT, "lib", "graphToApi.js"));
const FX = require(path.join(ROOT, "scripts", "fixtures", "frontend", "ltx_templates_graphToPrompt.json"));
const OI = require(path.join(ROOT, "scripts", "fixtures", "ltx25_object_info.json"));
let pass = 0, fail = 0;
const check = (n, cond, got) => {
  if (cond) { pass++; console.log("PASS: " + n); }
  else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 1500))); }
};
const same = (a, b) => {
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => String(x) === String(b[i]));
  if (typeof a === "number" && typeof b === "number") return Math.abs(a - b) < 1e-9;
  return JSON.stringify(a) === JSON.stringify(b);
};

for (const [name, c] of Object.entries(FX.cases)) {
  const ui = require(path.join(ROOT, "comfy_workflows", name + ".json"));
  let ours = null, err = "";
  try { ours = G.convert(LO.prepare(ui, { ...FX.opts, mode: c.mode, family: c.family }).ui, OI).graph; } catch (e) { err = String(e.message || e); }
  const fe = c.frontend, diffs = [];
  for (const id of new Set([...Object.keys(fe), ...Object.keys(ours || {})])) {
    const a = fe[id], b = (ours || {})[id];
    if (!a || !b) { diffs.push([id, a ? "missing in ours" : "extra in ours", (a || b).class_type]); continue; }
    if (a.class_type !== b.class_type) { diffs.push([id, a.class_type, b.class_type]); continue; }
    for (const k of new Set([...Object.keys(a.inputs || {}), ...Object.keys(b.inputs || {})])) {
      const x = (a.inputs || {})[k], y = (b.inputs || {})[k];
      if (!same(x, y)) diffs.push([id, a.class_type, k, "frontend", x, "ours", y]);
    }
  }
  check(`${name}: our API graph = ComfyUI's own frontend (graphToPrompt) - ${Object.keys(fe).length} nodes, every input and link`,
    ours && !err && !diffs.length, err || diffs.slice(0, 12));
}

// the multi-type widget itself
const ui = require(path.join(ROOT, "comfy_workflows", "ltx25_official_i2v.json"));
const g = G.convert(LO.prepare(ui, { ...FX.opts, mode: "i2v", family: "ltx25" }).ui, OI).graph;
const au = Object.values(g).filter((v) => v.class_type === "LTXVEmptyLatentAudio");
const names = G.widgetNames(OI.LTXVEmptyLatentAudio).map((w) => w.name);
check("LTXVEmptyLatentAudio: frame_rate (\"FLOAT,INT\", widgetType FLOAT) is a widget - batch_size 1, not the frame rate 25 (Tim's tensor mismatch)",
  JSON.stringify(names) === JSON.stringify(["frames_number", "frame_rate", "batch_size"]) && au.length && au.every((v) => v.inputs.batch_size === 1), { names, au });
check("a multi-type input with no widgetType stays a socket (COMFY_* / FILE_3D lists)",
  !G.isWidgetSpec(["INT,FLOAT,STRING,BOOLEAN", {}]) && !G.isWidgetSpec(["FILE_3D_GLB,FILE_3D", {}]) && G.isWidgetSpec(["FLOAT,INT", { widgetType: "FLOAT" }]));

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
