#!/usr/bin/env node
/* bitGen Studio — 2.401.3: MediaMixer's frame selectors -> KJNodes GetImageRangeFromBatch (lib/nodeSwaps.js).
 * Tim's run: "ComfyUI does not have these node types, which the LTX 2.5 workflow needs: FinalFrameSelector".
 *   1. swap: FinalFrameSelector -> GetImageRangeFromBatch(start_index -1, num_frames 1), FirstFrameSelector -> (0, 1);
 *      images stays input 0 with its link, IMAGE stays output 0 with its links (+ MASK); subgraphs too; `only`;
 *   2. the shipped canvas has none left; ltx_convert i2v (mode 3, Tim's failing run) asks for no MediaMixer class and
 *      its API prompt carries GetImageRangeFromBatch with start_index -1 / num_frames 1 on the images link;
 *   3. a re-export still carrying FinalFrameSelector is swapped on the fly (a note); graphToApi swaps it only for a
 *      ComfyUI without MediaMixer that has KJNodes; the LTX worker names KJNodes for it.
 * Run from repo root: node scripts/test-nodeswaps.js */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const ROOT = path.resolve(__dirname, "..");
const S = require(path.join(ROOT, "lib", "nodeSwaps.js"));
const G2A = require(path.join(ROOT, "lib", "graphToApi.js"));
let pass = 0, fail = 0;
const check = (n, cond, got) => {
  if (cond) { pass++; console.log("PASS: " + n); }
  else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); }
};

// 1
const ui = { nodes: [{ id: 1, type: "FinalFrameSelector", inputs: [{ name: "images", type: "IMAGE", link: 5 }], outputs: [{ name: "IMAGE", type: "IMAGE", links: [6, 7] }],
  properties: { cnr_id: "ComfyUI-MediaMixer", ver: "x" }, widgets_values: [] }],
  links: [[5, 9, 0, 1, 0, "IMAGE"], [6, 1, 0, 3, 0, "IMAGE"]],
  definitions: { subgraphs: [{ id: "s", name: "Inner", nodes: [{ id: 2, type: "FirstFrameSelector", inputs: [{ name: "images", type: "IMAGE", link: 8 }], outputs: [{ name: "IMAGE", type: "IMAGE", links: [] }] }], links: [] }] } };
const ch = S.swap(ui);
const a = ui.nodes[0], b = ui.definitions.subgraphs[0].nodes[0];
check("swap: Final -> GetImageRangeFromBatch(-1, 1), First -> (0, 1); images input 0 + its link, IMAGE output 0 + its links, a MASK after; KJNodes",
  ch.length === 2 && a.type === "GetImageRangeFromBatch" && JSON.stringify(a.widgets_values) === "[-1,1]" && JSON.stringify(b.widgets_values) === "[0,1]"
  && a.inputs[0].name === "images" && a.inputs[0].link === 5 && JSON.stringify(a.outputs[0].links) === "[6,7]" && a.outputs[1].name === "MASK"
  && a.properties.cnr_id === "comfyui-kjnodes" && !("ver" in a.properties) && JSON.stringify(ui.links) === '[[5,9,0,1,0,"IMAGE"],[6,1,0,3,0,"IMAGE"]]', { ch, a });
check("swap `only` + leftover", (() => { const g = { nodes: [{ id: 1, type: "FinalFrameSelector", outputs: [] }, { id: 2, type: "FirstFrameSelector", outputs: [] }] };
  S.swap(g, new Set(["FirstFrameSelector"])); return g.nodes[0].type === "FinalFrameSelector" && S.leftover(g).join() === "FinalFrameSelector"; })());

// 2
const WF = path.join(ROOT, "comfy_workflows", "LTX25_All_In_One.json");
const canvas = JSON.parse(fs.readFileSync(WF, "utf8"));
const cls = spawnSync(process.execPath, [path.join(ROOT, "scripts", "ltx_convert.js"), "classes", WF, "i2v"], { encoding: "utf8" });
const asked = cls.status === 0 ? JSON.parse(cls.stdout).classes : [];
check("the shipped canvas: no FinalFrameSelector left; i2v (Tim's failing mode 3) asks for GetImageRangeFromBatch, nothing from MediaMixer",
  !S.leftover(canvas).length && asked.includes("GetImageRangeFromBatch") && !asked.some((c) => /FrameSelector/.test(c)), asked);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ns4013-"));
const info = {};
for (const c of asked) info[c] = { input: { required: {} } };
info.GetImageRangeFromBatch = { input: { required: { start_index: ["INT", { default: 0, min: -1 }], num_frames: ["INT", { default: 1 }] }, optional: { images: ["IMAGE"], masks: ["MASK"] } } };
info.ComfyMathExpression = { input: { required: { expression: ["STRING", {}], values: ["COMFY_AUTOGROW_V3", {}] } } };
fs.writeFileSync(path.join(tmp, "info.json"), JSON.stringify(info));
fs.writeFileSync(path.join(tmp, "none.json"), "{}");
const cv = spawnSync(process.execPath, [path.join(ROOT, "scripts", "ltx_convert.js"), "convert", WF, "i2v", path.join(tmp, "none.json"), path.join(tmp, "info.json"), path.join(tmp, "out.json")], { encoding: "utf8" });
const api = cv.status === 0 ? JSON.parse(fs.readFileSync(path.join(tmp, "out.json"), "utf8")).graph : {};
const gr = Object.values(api || {}).filter((v) => v.class_type === "GetImageRangeFromBatch");
check("ltx_convert i2v: GetImageRangeFromBatch in the prompt with start_index -1, num_frames 1, its images wired",
  cv.status === 0 && gr.length >= 1 && gr.every((v) => v.inputs.start_index === -1 && v.inputs.num_frames === 1 && Array.isArray(v.inputs.images)), { st: cv.status, err: cv.stderr, gr });

// 3
const old = JSON.parse(fs.readFileSync(WF, "utf8"));
for (const d of old.definitions.subgraphs) for (const n of d.nodes) if (n.type === "GetImageRangeFromBatch" && (n.widgets_values || [])[0] === -1) { n.type = "FinalFrameSelector"; n.widgets_values = []; }
fs.writeFileSync(path.join(tmp, "old.json"), JSON.stringify(old));
const r2 = spawnSync(process.execPath, [path.join(ROOT, "scripts", "ltx_convert.js"), "classes", path.join(tmp, "old.json"), "i2v"], { encoding: "utf8" });
const j2 = r2.status === 0 ? JSON.parse(r2.stdout) : {};
check("a re-export still carrying FinalFrameSelector: swapped on the fly, said in the notes",
  r2.status === 0 && !(j2.classes || []).includes("FinalFrameSelector") && (j2.notes || []).some((x) => /node\(s\) \(FinalFrameSelector\) -> KJNodes GetImageRangeFromBatch/.test(x)), { notes: j2.notes, err: r2.stderr });
fs.rmSync(tmp, { recursive: true, force: true });
const small = () => ({ nodes: [{ id: 1, type: "LoadImage", outputs: [{ name: "IMAGE", type: "IMAGE", links: [1] }], widgets_values: ["example.png", "image"] },
  { id: 2, type: "FinalFrameSelector", inputs: [{ name: "images", type: "IMAGE", link: 1 }], outputs: [{ name: "IMAGE", type: "IMAGE", links: [2] }] },
  { id: 3, type: "SaveImage", inputs: [{ name: "images", type: "IMAGE", link: 2 }], widgets_values: ["x"] }], links: [[1, 1, 0, 2, 0, "IMAGE"], [2, 2, 0, 3, 0, "IMAGE"]] });
const base = { LoadImage: { input: { required: { image: [["example.png"], {}] } } }, SaveImage: { input: { required: { filename_prefix: ["STRING", {}] } } } };
const w1 = G2A.convert(small(), { ...base, GetImageRangeFromBatch: info.GetImageRangeFromBatch });
const w2 = G2A.convert(small(), { ...base, GetImageRangeFromBatch: info.GetImageRangeFromBatch, FinalFrameSelector: { input: { required: { images: ["IMAGE"] } } } });
check("graphToApi: no MediaMixer + KJNodes -> GetImageRangeFromBatch(-1, 1), said; MediaMixer installed -> as exported; the worker's hint names KJNodes",
  w1.graph && w1.graph["2"].class_type === "GetImageRangeFromBatch" && w1.graph["2"].inputs.start_index === -1 && /FinalFrameSelector - not in this ComfyUI\) run as KJNodes/.test(w1.warnings.join(" "))
  && w2.graph && w2.graph["2"].class_type === "FinalFrameSelector"
  && /"GetImageRangeFromBatch": "ComfyUI-KJNodes/.test(fs.readFileSync(path.join(ROOT, "misc", "ltx_worker.py"), "utf8")), { w1, w2: w2.graph });

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
