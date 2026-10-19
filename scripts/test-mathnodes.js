#!/usr/bin/env node
/* bitGen Studio — 2.401.2: custom math nodes -> ComfyUI's core Math Expression (lib/mathNodes.js).
 * Tim (verbatim): "comfy math nodes are no longer available, ltx2.5 workflow does not work, nodes not found -
 * Cloning into 'ComfyMath'... remote: Repository not found."
 *   1. migrate: CM_IntToFloat / CM_FloatToInt -> "a"; pysssss MathExpression keeps its expression; inputs a/b/c ->
 *      values.a/b/c (links kept, target slots follow); outputs FLOAT / INT / BOOL with every leaving link re-pointed
 *      (INT 0 -> 1, FLOAT 1 -> 0) - top-level array links AND a subgraph definition's object links; `only` filter;
 *      a graph without them untouched;
 *   2. the shipped LTX canvas: no ComfyMath / pysssss math left, every link at a math node consistent;
 *   3. ltx_convert per mode: no CM_ / pysssss class asked for; the lipsync API prompt has the core Math Expression
 *      with its expression + values.a/values.b wired; a canvas still carrying CM_* (Tim's own export) converts too;
 *   4. graphToApi.convert: a ComfyUI WITHOUT ComfyMath -> migrated + said; WITH it -> left as exported;
 *   5. the packs: ComfyMath gone from lib/nodePacks.json; the worker's hint names the core node.
 * Run from repo root: node scripts/test-mathnodes.js */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const ROOT = path.resolve(__dirname, "..");
const M = require(path.join(ROOT, "lib", "mathNodes.js"));
const G2A = require(path.join(ROOT, "lib", "graphToApi.js"));
let pass = 0, fail = 0;
const check = (n, cond, got) => {
  if (cond) { pass++; console.log("PASS: " + n); }
  else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); }
};
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");

// 1
const ui = {
  nodes: [
    { id: 1, type: "PrimitiveInt", outputs: [{ name: "INT", type: "INT", links: [10] }], widgets_values: [4] },
    { id: 2, type: "CM_IntToFloat", inputs: [{ name: "a", type: "INT", widget: { name: "a" }, link: 10 }],
      outputs: [{ name: "FLOAT", type: "FLOAT", links: [11] }], properties: { cnr_id: "ComfyMath", ver: "abc" }, widgets_values: [0] },
    { id: 3, type: "MathExpression|pysssss", inputs: [{ name: "a", type: "INT,FLOAT,IMAGE,LATENT", link: 11 }, { name: "b", type: "INT,FLOAT,IMAGE,LATENT", link: 12 },
      { name: "c", type: "INT,FLOAT,IMAGE,LATENT", link: null }], outputs: [{ name: "INT", type: "INT", links: [13] }, { name: "FLOAT", type: "FLOAT", links: [14] }],
      widgets_values: ["a*b+1"] },
    { id: 4, type: "KSampler", inputs: [{ name: "steps", type: "INT", link: 13 }, { name: "cfg", type: "FLOAT", link: 14 }] },
    { id: 5, type: "PrimitiveInt", outputs: [{ name: "INT", type: "INT", links: [12] }], widgets_values: [24] },
  ],
  links: [[10, 1, 0, 2, 0, "INT"], [11, 2, 0, 3, 0, "FLOAT"], [12, 5, 0, 3, 1, "INT"], [13, 3, 0, 4, 0, "INT"], [14, 3, 1, 4, 1, "FLOAT"]],
  definitions: { subgraphs: [{ id: "sg1", name: "Inner", nodes: [
    { id: 7, type: "CM_FloatToInt", inputs: [{ name: "a", type: "FLOAT", link: 20 }], outputs: [{ name: "INT", type: "INT", links: [21] }], widgets_values: [0] },
    { id: 8, type: "EmptyLatentImage", inputs: [{ name: "width", type: "INT", link: 21 }] }],
    links: [{ id: 20, origin_id: -10, origin_slot: 0, target_id: 7, target_slot: 0, type: "FLOAT" },
            { id: 21, origin_id: 7, origin_slot: 0, target_id: 8, target_slot: 0, type: "INT" }] }] },
};
const done = M.migrate(ui);
const n2 = ui.nodes[1], n3 = ui.nodes[2], n7 = ui.definitions.subgraphs[0].nodes[0];
check("migrate: 3 nodes (CM_IntToFloat, pysssss, CM_FloatToInt in a subgraph) -> ComfyMathExpression, said with their expressions",
  done.length === 3 && [n2, n3, n7].every((n) => n.type === "ComfyMathExpression") && done.map((d) => d.from + "=" + d.expression).join() === "CM_IntToFloat=a,MathExpression|pysssss=a*b+1,CM_FloatToInt=a"
  && n3.widgets_values[0] === "a*b+1" && n2.widgets_values[0] === "a" && n2.properties.cnr_id === "comfy-core" && !("ver" in n2.properties), done);
check("migrate: inputs a / b / c -> values.a / values.b / values.c, links kept; outputs FLOAT, INT, BOOL",
  n3.inputs.map((i) => i.name + ":" + i.link).join() === "values.a:11,values.b:12,values.c:null" && n2.inputs[0].name === "values.a" && !n2.inputs[0].widget
  && n3.outputs.map((o) => o.name).join() === "FLOAT,INT,BOOL", { n2: n2.inputs, n3: n3.inputs });
const L = (id) => ui.links.find((l) => l[0] === id);
check("migrate: pysssss' INT (slot 0) -> slot 1, its FLOAT (slot 1) -> slot 0, in the node AND the link records; IntToFloat's FLOAT stays 0",
  L(13)[2] === 1 && L(14)[2] === 0 && JSON.stringify(n3.outputs[1].links) === "[13]" && JSON.stringify(n3.outputs[0].links) === "[14]"
  && L(11)[2] === 0 && JSON.stringify(n2.outputs[0].links) === "[11]" && L(12)[4] === 1, ui.links);
const SL = ui.definitions.subgraphs[0].links;
check("migrate: a subgraph definition's object links - FloatToInt's INT now leaves slot 1",
  SL.find((l) => l.id === 21).origin_slot === 1 && JSON.stringify(n7.outputs[1].links) === "[21]" && SL.find((l) => l.id === 20).target_slot === 0, SL);
check("leftover: none after; a graph without custom math untouched; `only` converts just the classes named",
  !M.leftover(ui).length && (() => { const g = { nodes: [{ id: 1, type: "KSampler" }], links: [] }; const s = JSON.stringify(g); return !M.migrate(g).length && JSON.stringify(g) === s; })()
  && (() => { const g = { nodes: [{ id: 1, type: "CM_IntToFloat", outputs: [] }, { id: 2, type: "MathExpression|pysssss", widgets_values: ["a"], outputs: [] }], links: [] };
    M.migrate(g, new Set(["CM_IntToFloat"])); return g.nodes[0].type === "ComfyMathExpression" && g.nodes[1].type === "MathExpression|pysssss"; })());

// 2
const canvas = JSON.parse(read("comfy_workflows", "LTX25_All_In_One.json"));
let bad = 0, maths = 0;
const scopes = [[canvas.nodes, canvas.links]].concat(((canvas.definitions || {}).subgraphs || []).map((d) => [d.nodes, d.links]));
for (const [ns, ls] of scopes) {
  const by = new Map(ns.map((n) => [String(n.id), n]));
  for (const l of ls || []) {
    const o = Array.isArray(l) ? { id: l[0], from: l[1], fs: l[2], to: l[3], ts: l[4] } : { id: l.id, from: l.origin_id, fs: l.origin_slot, to: l.target_id, ts: l.target_slot };
    const a = by.get(String(o.from)), b = by.get(String(o.to));
    if (a && a.type === "ComfyMathExpression") { maths++; if (!((a.outputs[o.fs] || {}).links || []).includes(o.id)) bad++; }
    if (b && b.type === "ComfyMathExpression" && (b.inputs[o.ts] || {}).link !== o.id) bad++;
  }
}
check("the shipped LTX canvas: no ComfyMath / pysssss math left (15 core Math Expressions), every link at one consistent",
  !M.leftover(canvas).length && scopes.reduce((k, [ns]) => k + ns.filter((n) => n.type === "ComfyMathExpression").length, 0) === 15 && maths > 0 && bad === 0, { bad, maths });

// 3
const WF = path.join(ROOT, "comfy_workflows", "LTX25_All_In_One.json");
const conv = (wf, mode) => spawnSync(process.execPath, [path.join(ROOT, "scripts", "ltx_convert.js"), "classes", wf, mode], { encoding: "utf8" });
const asked = new Set();
for (const mode of ["t2v", "i2v", "flf", "lipsync", "v2v"]) {
  const r = conv(WF, mode);
  if (r.status === 0) for (const c of JSON.parse(r.stdout).classes || []) asked.add(c);
}
check("ltx_convert: no mode asks ComfyUI for a CM_ / pysssss class; the core Math Expression is asked for",
  asked.size > 0 && ![...asked].some((c) => /^CM_|pysssss/.test(c)) && asked.has("ComfyMathExpression"), [...asked].filter((c) => /Math|CM_/.test(c)));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mn401-"));
const info = {};
for (const c of asked) info[c] = { input: { required: {} } };
info.ComfyMathExpression = { input: { required: { expression: ["STRING", { multiline: true }], values: ["COMFY_AUTOGROW_V3", {}] } }, output: ["FLOAT", "INT", "BOOLEAN"] };
fs.writeFileSync(path.join(tmp, "info.json"), JSON.stringify(info));
fs.writeFileSync(path.join(tmp, "none.json"), "{}");
const cv = spawnSync(process.execPath, [path.join(ROOT, "scripts", "ltx_convert.js"), "convert", WF, "lipsync", path.join(tmp, "none.json"), path.join(tmp, "info.json"), path.join(tmp, "out.json")], { encoding: "utf8" });
const api = cv.status === 0 ? JSON.parse(fs.readFileSync(path.join(tmp, "out.json"), "utf8")).graph : {};
const me = Object.values(api || {}).filter((v) => v.class_type === "ComfyMathExpression");
check("ltx_convert lipsync: the core Math Expression nodes carry their expression + values.a / values.b links",
  cv.status === 0 && me.length > 0 && me.every((v) => typeof v.inputs.expression === "string" && Array.isArray(v.inputs["values.a"]))
  && me.some((v) => v.inputs.expression === "a*b+1" && Array.isArray(v.inputs["values.b"])), { st: cv.status, err: cv.stderr, me: me.slice(0, 3) });
// Tim's own re-export, still with the custom nodes: prepare migrates it on the fly
const old = JSON.parse(read("comfy_workflows", "LTX25_All_In_One.json"));
for (const scope of [old.nodes].concat(((old.definitions || {}).subgraphs || []).map((d) => d.nodes))) {
  for (const n of scope) if (n.type === "ComfyMathExpression" && n.widgets_values[0] === "a") { n.type = "CM_IntToFloat"; n.inputs = [{ name: "a", type: "INT", link: (n.inputs[0] || {}).link }]; n.outputs = [{ name: "FLOAT", type: "FLOAT", links: (n.outputs[0] || {}).links || [] }]; }
}
fs.writeFileSync(path.join(tmp, "old.json"), JSON.stringify(old));
const r2 = conv(path.join(tmp, "old.json"), "lipsync");
const j2 = r2.status === 0 ? JSON.parse(r2.stdout) : {};
check("a canvas still carrying CM_* (Tim's own export): converted on the fly, said in the notes, nothing custom asked for",
  r2.status === 0 && !(j2.classes || []).some((c) => /^CM_/.test(c)) && (j2.notes || []).some((x) => /math node\(s\) \(CM_IntToFloat\) -> ComfyUI's core Math Expression/.test(x)), { st: r2.status, notes: j2.notes, err: r2.stderr });
fs.rmSync(tmp, { recursive: true, force: true });

// 4
const small = () => ({ nodes: [
  { id: 1, type: "PrimitiveFloat", outputs: [{ name: "FLOAT", type: "FLOAT", links: [1] }], widgets_values: [2.5] },
  { id: 2, type: "CM_FloatToInt", inputs: [{ name: "a", type: "FLOAT", link: 1 }], outputs: [{ name: "INT", type: "INT", links: [2] }], widgets_values: [0] },
  { id: 3, type: "EmptyLatentImage", inputs: [{ name: "width", type: "INT", widget: { name: "width" }, link: 2 }], widgets_values: [512, 512, 1] }],
  links: [[1, 1, 0, 2, 0, "FLOAT"], [2, 2, 0, 3, 0, "INT"]] });
const baseInfo = { PrimitiveFloat: { input: { required: { value: ["FLOAT", {}] } } }, EmptyLatentImage: { input: { required: { width: ["INT", {}], height: ["INT", {}], batch_size: ["INT", {}] } } } };
const without = G2A.convert(small(), { ...baseInfo, ComfyMathExpression: info.ComfyMathExpression });
const withIt = G2A.convert(small(), { ...baseInfo, CM_FloatToInt: { input: { required: { a: ["FLOAT", {}] } } }, ComfyMathExpression: info.ComfyMathExpression });
check("graphToApi: a ComfyUI WITHOUT ComfyMath -> the core Math Expression (expression a, values.a wired, the latent reads its INT slot 1), said; WITH it -> as exported",
  without.graph && without.graph["2"].class_type === "ComfyMathExpression" && without.graph["2"].inputs.expression === "a"
  && JSON.stringify(without.graph["3"].inputs.width) === '["2",1]' && /math node\(s\) \(CM_FloatToInt - not in this ComfyUI\)/.test(without.warnings[0] || "")
  && withIt.graph && withIt.graph["2"].class_type === "CM_FloatToInt", { without, withIt: withIt.graph });

// 5
const NP = JSON.parse(read("lib", "nodePacks.json")).packs;
check("lib/nodePacks.json: ComfyMath gone (the setup no longer clones a repo that is not there); the LTX worker's hint names the core node",
  !NP.some((p) => /ComfyMath/i.test(p.folder || "") || /ComfyMath/i.test(p.url || "")) && /"ComfyMathExpression": "a core ComfyUI node/.test(read("ltx_worker.py"))
  && !/"CM_IntToFloat": "ComfyMath"/.test(read("ltx_worker.py")));

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
