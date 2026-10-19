#!/usr/bin/env node
/* bitGen Studio — image -> 3D (2.404.0): Comfy-Org's Hunyuan3D / TRELLIS.2 template -> an API prompt. Run by
 * mesh3d_worker.py with the app's own node, so the conversion is the same code as the LTX templates (lib/graphToApi,
 * = ComfyUI's frontend) against the LIVE ComfyUI's /object_info.
 *   node scripts/mesh3d_convert.js classes <opts.json>                          -> stdout {classes, notes, label, engine}
 *   node scripts/mesh3d_convert.js convert <opts.json> <info.json> <out.json>   -> {graph, warnings, notes, label, engine}
 * opts.json = {engine, lists, image, seed, prefix} - lists = {"Class.input": [files ComfyUI lists]} (lib/mesh3d.LOADERS) */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const M = require(path.join(ROOT, "lib", "mesh3d"));
const G2A = require(path.join(ROOT, "lib", "graphToApi"));

function main(argv) {
  const [cmd, optsPath, infoPath, outPath] = argv;
  const o = JSON.parse(fs.readFileSync(optsPath, "utf8") || "{}");
  const pk = M.pick(o.lists || {}, o.engine);
  if (pk.error) { process.stdout.write(JSON.stringify({ error: pk.error })); return 2; }
  let prep;
  try { prep = M.prepare(M.template(pk.template, ROOT), { pick: pk, image: o.image, seed: o.seed, prefix: o.prefix }); }
  catch (e) { process.stdout.write(JSON.stringify({ error: String(e.message || e) })); return 2; }
  if (cmd === "classes") {
    const classes = [...new Set(prep.ui.nodes.map((n) => n.type))];
    process.stdout.write(JSON.stringify({ classes, notes: prep.notes, label: pk.label, engine: pk.engine }));
    return 0;
  }
  if (cmd === "convert") {
    const info = JSON.parse(fs.readFileSync(infoPath, "utf8"));
    const out = G2A.convert(prep.ui, info);
    fs.writeFileSync(outPath, JSON.stringify({ graph: out.graph, warnings: out.warnings || [], dropped: out.dropped || [],
      unknown: out.unknown ? [...out.unknown] : [], notes: prep.notes, label: pk.label, engine: pk.engine }, null, 1));
    return out.graph ? 0 : 3;
  }
  process.stdout.write(JSON.stringify({ error: "usage: classes <opts> | convert <opts> <info> <out>" }));
  return 1;
}
if (require.main === module) process.exitCode = main(process.argv.slice(2));
module.exports = { main };
