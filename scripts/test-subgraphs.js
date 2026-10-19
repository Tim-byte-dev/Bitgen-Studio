#!/usr/bin/env node
"use strict";
/* scripts/test-subgraphs.js — FOLDED CANVASES (2.126.0).
 *
 * lib/subgraphs.js turns a workflow that uses ComfyUI subgraphs and KJNodes
 * Set/Get into the flat graph they stand for. The fixtures are Tim's own
 * blueprints, shipped in comfy_workflows/, because a synthetic fixture would
 * only ever prove that the code agrees with my idea of the format.
 *
 * THE ASSERTION THAT MATTERS MOST is the boring one: after flattening, no link
 * points at a node that is not there and no input names a link that is not
 * there. A dangling wire converts into an API prompt that ComfyUI rejects with
 * a node id the user has never seen, which is a very expensive way to find out.
 */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const SG = require("../lib/subgraphs.js");
const G2A = require("../lib/graphToApi.js");

let pass = 0, fail = 0;
const t = (name, fn) => {
  try { fn(); pass++; }
  catch (e) { fail++; console.log(`  FAIL ${name}: ${e.message}`); }
};
const wf = (n) => JSON.parse(fs.readFileSync(path.join(__dirname, "..", "comfy_workflows", n), "utf8"));

/* ---------------------------------------------------------- the no-op ---- */
t("a flat workflow is returned UNTOUCHED, not rebuilt", () => {
  const flat = { nodes: [{ id: 1, type: "UNETLoader", widgets_values: ["m.safetensors"] }], links: [] };
  const r = SG.flatten(flat);
  assert.strictEqual(r.changed, false);
  assert.strictEqual(r.graph, flat, "a flat graph was copied instead of passed through");
  assert.deepStrictEqual(r.warnings, []);
});
t("needsFlatten only says yes when there is something folded", () => {
  assert.strictEqual(SG.needsFlatten({ nodes: [{ id: 1, type: "KSampler" }] }), false);
  assert.strictEqual(SG.needsFlatten({ nodes: [{ id: 1, type: "SetNode" }] }), true);
  assert.strictEqual(SG.needsFlatten({ nodes: [{ id: 1, type: "abc" }],
    definitions: { subgraphs: [{ id: "abc", nodes: [], links: [] }] } }), true);
  assert.strictEqual(SG.needsFlatten(null), false);
  assert.strictEqual(SG.needsFlatten({}), false);
});

/* ------------------------------------------------- the real blueprints --- */
const SCENE = "h3_simple_scene_blueprint.json";
const LONG = "h3_longform_blueprint.json";

const integrity = (g, label) => {
  const ids = new Set(g.nodes.map((n) => String(n.id)));
  const lids = new Set(g.links.map((l) => String(l.id)));
  for (const l of g.links) {
    assert.ok(ids.has(String(l.origin_id)), `${label}: link ${l.id} comes from missing node ${l.origin_id}`);
    assert.ok(ids.has(String(l.target_id)), `${label}: link ${l.id} goes to missing node ${l.target_id}`);
  }
  for (const n of g.nodes) {
    for (const i of (n.inputs || [])) {
      if (i && i.link !== null && i.link !== undefined) {
        assert.ok(lids.has(String(i.link)), `${label}: node ${n.id} input "${i.name}" names missing link ${i.link}`);
      }
    }
  }
  const dup = g.nodes.length - new Set(g.nodes.map((n) => String(n.id))).size;
  assert.strictEqual(dup, 0, `${label}: ${dup} duplicate node id(s)`);
};

t("the Simple Scene blueprint flattens with nothing dangling", () => {
  const r = SG.flatten(wf(SCENE));
  assert.strictEqual(r.changed, true);
  integrity(r.graph, "simple scene");
  assert.deepStrictEqual(r.warnings, [], `warnings: ${r.warnings.join(" | ")}`);
});
t("the Longform blueprint flattens with nothing dangling", () => {
  const r = SG.flatten(wf(LONG));
  integrity(r.graph, "longform");
  assert.deepStrictEqual(r.warnings, [], `warnings: ${r.warnings.join(" | ")}`);
});
t("no subgraph instance and no Set/Get survives", () => {
  for (const name of [SCENE, LONG]) {
    const src = wf(name);
    const ids = new Set((src.definitions.subgraphs || []).map((s) => String(s.id)));
    const r = SG.flatten(src);
    for (const n of r.graph.nodes) {
      assert.ok(!ids.has(String(n.type)), `${name}: subgraph ${n.type} still folded`);
      assert.ok(!SG.SET_TYPES.has(String(n.type)), `${name}: a ${n.type} survived`);
    }
    assert.ok(!r.graph.definitions, `${name}: the definitions block was left behind`);
  }
});
t("NESTED subgraphs are expanded too", () => {
  /* "H3 Simple Shot" contains "Merge Videos". One pass would leave the inner
     one folded and the graph would fail conversion on a UUID. */
  const r = SG.flatten(wf(LONG));
  assert.ok(r.expanded.some((e) => e.name === "H3 Simple Shot"), "the outer one did not expand");
  assert.ok(r.expanded.some((e) => e.name === "Merge Videos"), "the nested one did not expand");
  assert.ok(r.graph.nodes.some((n) => n.type === "AudioConcat"),
    "a node from inside the nested subgraph is missing");
});
t("every shot in the Longform blueprint keeps its generation node", () => {
  const r = SG.flatten(wf(LONG));
  const gen = r.graph.nodes.filter((n) => n.type === "MiniMaxH3ReferenceToVideo");
  assert.strictEqual(gen.length, 4, `expected 4 chained shots, found ${gen.length}`);
});
t("inlined ids are namespaced by the instance, ComfyUI's own way", () => {
  const r = SG.flatten(wf(SCENE));
  const inner = r.graph.nodes.filter((n) => String(n.id).includes(":"));
  assert.ok(inner.length > 5, "nothing was namespaced");
  for (const n of inner) assert.ok(/^\d+:/.test(String(n.id)), `odd id ${n.id}`);
});
t("a value typed on the instance is carried in as a primitive", () => {
  /* The Prompt and Duration boxes live on the scene node; the widgets that
     want them live inside the definition. */
  const r = SG.flatten(wf(LONG));
  const prims = r.graph.nodes.filter((n) => n.type === "PrimitiveNode");
  assert.ok(prims.length >= 4, `expected the typed-in values, found ${prims.length}`);
  const texts = prims.map((p) => String((p.widgets_values || [])[0] || ""));
  assert.ok(texts.some((x) => /viking/i.test(x)), "the prompt typed on a scene node was lost");
});

/* --------------------------------------------------------- Set / Get ----- */
t("a Get is rewired to the source behind its Set", () => {
  const ui = {
    nodes: [
      { id: 1, type: "UNETLoader", outputs: [{ name: "MODEL", type: "MODEL", links: [10] }] },
      { id: 2, type: "SetNode", widgets_values: ["Model"], inputs: [{ name: "MODEL", type: "MODEL", link: 10 }], outputs: [] },
      { id: 3, type: "GetNode", widgets_values: ["Model"], inputs: [], outputs: [{ name: "MODEL", type: "MODEL", links: [11] }] },
      { id: 4, type: "KSampler", inputs: [{ name: "model", type: "MODEL", link: 11 }] },
    ],
    links: [[10, 1, 0, 2, 0, "MODEL"], [11, 3, 0, 4, 0, "MODEL"]],
  };
  const r = SG.flatten(ui);
  assert.deepStrictEqual(r.graph.nodes.map((n) => n.type), ["UNETLoader", "KSampler"]);
  const l = r.graph.links.find((x) => String(x.target_id) === "4");
  assert.strictEqual(String(l.origin_id), "1", "the sampler is not fed by the loader");
  assert.strictEqual(r.resolved.length, 1);
});
t("a Get with no Set is a WARNING, not a silent removal", () => {
  const ui = {
    nodes: [
      { id: 3, type: "GetNode", widgets_values: ["Lora"], inputs: [], outputs: [{ name: "MODEL", type: "MODEL", links: [11] }] },
      { id: 4, type: "KSampler", inputs: [{ name: "model", type: "MODEL", link: 11 }] },
    ],
    links: [[11, 3, 0, 4, 0, "MODEL"]],
  };
  const r = SG.flatten(ui);
  assert.ok(r.warnings.some((w) => /GetNode "Lora" has no matching SetNode/.test(w)), r.warnings.join("|"));
  const k = r.graph.nodes.find((n) => n.type === "KSampler");
  assert.ok(k, "the consumer was removed instead of being left unplugged");
  assert.strictEqual(k.inputs[0].link, null);
});
t("a Set fed by a Get is followed through", () => {
  const ui = {
    nodes: [
      { id: 1, type: "UNETLoader", outputs: [{ name: "MODEL", type: "MODEL", links: [10] }] },
      { id: 2, type: "SetNode", widgets_values: ["A"], inputs: [{ name: "MODEL", type: "MODEL", link: 10 }], outputs: [] },
      { id: 3, type: "GetNode", widgets_values: ["A"], inputs: [], outputs: [{ name: "MODEL", type: "MODEL", links: [11] }] },
      { id: 5, type: "SetNode", widgets_values: ["B"], inputs: [{ name: "MODEL", type: "MODEL", link: 11 }], outputs: [] },
      { id: 6, type: "GetNode", widgets_values: ["B"], inputs: [], outputs: [{ name: "MODEL", type: "MODEL", links: [12] }] },
      { id: 7, type: "KSampler", inputs: [{ name: "model", type: "MODEL", link: 12 }] },
    ],
    links: [[10, 1, 0, 2, 0, "MODEL"], [11, 3, 0, 5, 0, "MODEL"], [12, 6, 0, 7, 0, "MODEL"]],
  };
  const r = SG.flatten(ui);
  const l = r.graph.links.find((x) => String(x.target_id) === "7");
  assert.strictEqual(String(l.origin_id), "1");
});

/* ---------------------------------------------------------- purity ------- */
t("flatten does not mutate what it was given", () => {
  const src = wf(SCENE);
  const before = JSON.stringify(src);
  SG.flatten(src);
  assert.strictEqual(JSON.stringify(src), before, "the caller's workflow was modified");
});
t("lib/subgraphs.js holds no I/O", () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "lib", "subgraphs.js"), "utf8");
  for (const word of ["require(\"fs\")", "require('fs')", "fetch(", "http"])
    assert.ok(!src.includes(word), `subgraphs.js reaches for ${word} — it must stay pure`);
});

/* -------------------------------------- the converter now gets this far -- */
t("graphToApi runs the flattener, so a folded graph is not 'unknown'", () => {
  const src = wf(SCENE);
  const ids = new Set((src.definitions.subgraphs || []).map((s) => String(s.id)));
  const r = G2A.convert(src, {});
  for (const u of r.unknown) {
    assert.ok(!ids.has(u), `the converter still reports the subgraph id ${u} as an unknown pack`);
    assert.ok(!SG.SET_TYPES.has(u), `the converter still reports ${u} as an unknown pack`);
  }
});
t("...and the expansion is reported, not silent", () => {
  const r = G2A.convert(wf(SCENE), {});
  assert.ok(r.dropped.some((d) => d.type === "subgraph" && /expanded/.test(d.why)),
    "nothing in the result says a subgraph was unfolded");
});
t("a folded graph converts once ComfyUI knows the real classes", () => {
  /* The classes left after flattening are ordinary ones. Given a spec for them,
     the conversion must SUCCEED — this is the end-to-end claim of the feature. */
  const src = wf(SCENE);
  const flatG = SG.flatten(src).graph;
  const info = {};
  for (const n of flatG.nodes) {
    if (!info[n.type]) info[n.type] = { input: { required: {} } };
  }
  const r = G2A.convert(src, info);
  assert.deepStrictEqual(r.unknown, [], `still unknown: ${r.unknown.join(", ")}`);
  assert.ok(r.graph && Object.keys(r.graph).length > 10, "the API prompt came back empty");
  for (const [id, node] of Object.entries(r.graph)) {
    for (const [k, v] of Object.entries(node.inputs)) {
      if (Array.isArray(v)) assert.ok(r.graph[v[0]], `node ${id}.${k} points at missing node ${v[0]}`);
    }
  }
});

/* ------------------------------ GROUND TRUTH: ComfyUI 0.34's own export --- */
/* Tim exported the same blueprint from ComfyUI 0.34 itself. That file is the
 * only unarguable statement of what these subgraphs MEAN, so it is shipped
 * beside the UI one and diffed against here. If ComfyUI ever changes how it
 * unfolds a subgraph, this is the test that says so. */
const API = "h3_longform_blueprint_api.json";

const myWires = (g) => {
  const links = new Map(g.links.map((l) => [String(l.id), l]));
  const w = new Map();
  for (const n of g.nodes) {
    for (const i of (n.inputs || [])) {
      if (i && i.link !== null && i.link !== undefined && links.has(String(i.link))) {
        const l = links.get(String(i.link));
        w.set(String(n.id) + "|" + i.name, [String(l.origin_id), Number(l.origin_slot)]);
      }
    }
  }
  return w;
};

t("every node ComfyUI kept is a node we produce, with the SAME id", () => {
  const mine = new Set(SG.flatten(wf(LONG)).graph.nodes.map((n) => String(n.id)));
  const theirs = Object.keys(wf(API));
  const absent = theirs.filter((id) => !mine.has(id));
  assert.deepStrictEqual(absent, [], `ComfyUI has nodes we do not: ${absent.join(", ")}`);
  assert.ok(theirs.some((id) => /^\d+:\d+$/.test(id)), "the fixture has no inlined ids to compare");
});
t("...and the same class for each", () => {
  const types = new Map(SG.flatten(wf(LONG)).graph.nodes.map((n) => [String(n.id), String(n.type)]));
  for (const [id, node] of Object.entries(wf(API))) {
    assert.strictEqual(types.get(id), node.class_type, `node ${id}`);
  }
});
t("EVERY WIRE ComfyUI drew, we draw — same source, same output slot", () => {
  const w = myWires(SG.flatten(wf(LONG)).graph);
  let checked = 0;
  for (const [id, node] of Object.entries(wf(API))) {
    for (const [k, v] of Object.entries(node.inputs)) {
      if (!Array.isArray(v)) continue;
      const got = w.get(id + "|" + k);
      assert.ok(got, `node ${id}: ComfyUI wires "${k}" and we do not`);
      assert.deepStrictEqual(got, [String(v[0]), Number(v[1])], `node ${id} input "${k}"`);
      checked += 1;
    }
  }
  assert.ok(checked >= 40, `only ${checked} wires compared — the fixture looks wrong`);
});
t("the Set/Get names resolved to the same loaders ComfyUI resolved them to", () => {
  /* model / clip / vae / audio_vae / steps / width / height were all drawn by
     NAME on the canvas. This is the assertion that they came back as wires to
     the real loaders rather than to nothing. */
  const w = myWires(SG.flatten(wf(LONG)).graph);
  const api = wf(API);
  for (const [id, node] of Object.entries(api)) {
    for (const k of ["model", "clip", "vae", "audio_vae", "steps", "width", "height"]) {
      if (!Array.isArray(node.inputs[k])) continue;
      const src = String(node.inputs[k][0]);
      assert.ok(api[src], `${id}.${k} should come from ${src}`);
      assert.deepStrictEqual(w.get(id + "|" + k), [src, Number(node.inputs[k][1])], `${id}.${k}`);
    }
  }
});
t("the whole conversion reproduces ComfyUI's prompt, wire for wire", () => {
  const src = wf(LONG);
  const info = {};
  for (const n of SG.flatten(src).graph.nodes) info[n.type] = { input: { required: {} } };
  const r = G2A.convert(src, info);
  assert.deepStrictEqual(r.unknown, [], `unknown: ${r.unknown.join(", ")}`);
  for (const [id, node] of Object.entries(wf(API))) {
    assert.ok(r.graph[id], `we dropped node ${id}, which ComfyUI kept`);
    for (const [k, v] of Object.entries(node.inputs)) {
      if (!Array.isArray(v)) continue;
      assert.deepStrictEqual(r.graph[id].inputs[k], [String(v[0]), Number(v[1])], `${id}.${k}`);
    }
  }
});

/* --------------------------- primitives are only virtual on OLD ComfyUI --- */
t("a primitive ComfyUI can execute is WIRED, not inlined", () => {
  /* ComfyUI 0.34 keeps PrimitiveInt as a node. Inlining its value would write a
     literal over ComfyMathExpression's dynamic `values.a`. */
  const src = wf(LONG);
  const info = {};
  for (const n of SG.flatten(src).graph.nodes) info[n.type] = { input: { required: {} } };
  const r = G2A.convert(src, info);
  assert.ok(r.graph["247"], "PrimitiveInt 247 was dropped even though ComfyUI knows it");
  const sched = Object.entries(r.graph).find(([, n]) => n.class_type === "BasicScheduler");
  assert.deepStrictEqual(sched[1].inputs.steps, ["247", 0], "steps was inlined instead of wired");
});
t("...but on a ComfyUI that does NOT know it, it is still inlined", () => {
  /* The older frontends where Primitive* really was canvas-only. Removing this
     path would break every graph exported before 0.34. */
  const src = wf(LONG);
  const info = {};
  for (const n of SG.flatten(src).graph.nodes) {
    if (!G2A.SOFT_DROP_TYPES.has(n.type)) info[n.type] = { input: { required: {} } };
  }
  const r = G2A.convert(src, info);
  assert.ok(!r.graph["247"], "the virtual primitive survived");
  const sched = Object.entries(r.graph).find(([, n]) => n.class_type === "BasicScheduler");
  assert.strictEqual(sched[1].inputs.steps, 6, "the value was not inlined");
});
t("the always-virtual PrimitiveNode is inlined either way", () => {
  assert.ok(G2A.DROP_TYPES.has("PrimitiveNode"));
  assert.ok(!G2A.SOFT_DROP_TYPES.has("PrimitiveNode"),
    "PrimitiveNode must never depend on /object_info — it has no backend at all");
});

console.log(`test-subgraphs: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
