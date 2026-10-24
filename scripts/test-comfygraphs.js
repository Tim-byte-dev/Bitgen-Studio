#!/usr/bin/env node
"use strict";
/* scripts/test-comfygraphs.js — the ComfyUI graph BINDING (2.120.0).
 *
 * Two libraries under one suite because they are two halves of one screen:
 *   lib/comfyGraphs.js  — is this an API workflow, what can be changed in it,
 *                         the control model, and writing the values back in.
 *   lib/graphToApi.js   — turning a UI export into an API prompt using
 *                         ComfyUI's own /object_info.
 *
 * The cases that matter are the ones that cost something when they are wrong:
 * a link is never overwritten, a stale wire is REPORTED rather than skipped, a
 * zero default survives (the LoRA-slider truthiness trap), a bypassed node is
 * actually removed and rewired, and an unknown node class FAILS instead of
 * being guessed.
 */
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const G = require("../lib/comfyGraphs");
const T = require("../lib/graphToApi");

let pass = 0, fail = 0;
const t = (name, fn) => {
  try { fn(); pass++; }
  catch (e) { fail++; console.log(`  FAIL ${name}: ${e.message}`); }
};

/* ---------------------------------------------------------------- fixtures */
const API = {
  "3": { class_type: "KSampler", _meta: { title: "Sampler" },
         inputs: { seed: 12345, steps: 20, cfg: 8.0, sampler_name: "euler",
                   denoise: 1.0, model: ["4", 0], positive: ["6", 0] } },
  "4": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: "sd.safetensors" } },
  "6": { class_type: "CLIPTextEncode", inputs: { text: "a cat", clip: ["4", 1] } },
  "9": { class_type: "SaveImage", inputs: { filename_prefix: "H3", images: ["8", 0] } },
};
const UI = {
  nodes: [
    { id: 1, type: "CheckpointLoaderSimple", widgets_values: ["sd.safetensors"],
      inputs: [], outputs: [{ type: "MODEL" }, { type: "CLIP" }, { type: "VAE" }] },
    { id: 2, type: "LoraLoaderModelOnly", mode: 4, widgets_values: ["turbo.safetensors", 1.0],
      inputs: [{ name: "model", type: "MODEL", link: 10 }], outputs: [{ type: "MODEL" }] },
    { id: 3, type: "KSampler", title: "Sampler",
      widgets_values: [12345, "randomize", 20, 8.0, "euler", "normal", 1.0],
      inputs: [{ name: "model", type: "MODEL", link: 11 }], outputs: [{ type: "LATENT" }] },
    { id: 4, type: "Note", widgets_values: ["ignore me"], inputs: [], outputs: [] },
  ],
  links: [[10, 1, 0, 2, 0, "MODEL"], [11, 2, 0, 3, 0, "MODEL"]],
};
const INFO = {
  CheckpointLoaderSimple: { input: { required: { ckpt_name: [["sd.safetensors"]] } },
                            input_order: { required: ["ckpt_name"] } },
  LoraLoaderModelOnly: { input: { required: { model: ["MODEL"], lora_name: [["turbo.safetensors"]],
                                              strength_model: ["FLOAT", {}] } },
                         input_order: { required: ["model", "lora_name", "strength_model"] } },
  KSampler: { input: { required: { model: ["MODEL"], seed: ["INT", { control_after_generate: true }],
                                   steps: ["INT", {}], cfg: ["FLOAT", {}],
                                   sampler_name: [["euler"]], scheduler: [["normal"]],
                                   denoise: ["FLOAT", {}] } },
              input_order: { required: ["model", "seed", "steps", "cfg", "sampler_name", "scheduler", "denoise"] } },
};

/* ------------------------------------------------------------- the format */
t("an API prompt is recognised", () => assert.strictEqual(G.format(API), "api"));
t("a UI export is recognised", () => assert.strictEqual(G.format(UI), "ui"));
t("neither is 'unknown'", () => assert.strictEqual(G.format({ hello: 1 }), "unknown"));
t("an empty object is not an API prompt", () => assert.strictEqual(G.isApi({}), false));
t("an array is not an API prompt", () => assert.strictEqual(G.isApi([1, 2]), false));
t("null never throws", () => assert.strictEqual(G.format(null), "unknown"));
t("a UI export's analysis says how to fix it", () => {
  const a = G.analyze(UI);
  assert.strictEqual(a.api, false);
  assert.ok(/Export as API/.test(a.note), a.note);
});
t("an unknown shape's analysis says what was expected", () =>
  assert.ok(/API prompt/.test(G.analyze(42).note)));

/* ---------------------------------------------------- the changeable inputs */
t("widget values are listed", () => {
  const names = G.apiInputs(API).map((i) => i.node + "." + i.input);
  assert.ok(names.includes("3.steps"));
  assert.ok(names.includes("6.text"));
  assert.ok(names.includes("4.ckpt_name"));
});
t("LINKS are not listed — writing a scalar over one breaks the graph", () => {
  const names = G.apiInputs(API).map((i) => i.node + "." + i.input);
  assert.ok(!names.includes("3.model"), "3.model is a link and must not be offered");
  assert.ok(!names.includes("6.clip"));
  assert.ok(!names.includes("9.images"));
});
t("inputs carry the node's title so the list is readable", () =>
  assert.strictEqual(G.apiInputs(API).find((i) => i.node === "3").title, "Sampler"));
t("a node with no title falls back to its class", () =>
  assert.strictEqual(G.apiInputs(API).find((i) => i.node === "4").title, "CheckpointLoaderSimple"));
t("value_type is reported so the tab can suggest a control", () => {
  const byKey = Object.fromEntries(G.apiInputs(API).map((i) => [i.input, i.value_type]));
  assert.strictEqual(byKey.steps, "number");
  assert.strictEqual(byKey.text, "string");
});
t("nodes are listed in numeric id order", () =>
  assert.deepStrictEqual(G.apiNodes(API).map((n) => n.node), ["3", "4", "6", "9"]));
t("apiInputs of a UI export is empty, never a throw", () =>
  assert.deepStrictEqual(G.apiInputs(UI), []));

/* ------------------------------------------------------------- the controls */
t("an unknown control type becomes text rather than being dropped", () =>
  assert.strictEqual(G.normalizeControl({ type: "hologram" }).type, "text"));
t("every advertised type survives normalize", () => {
  for (const ty of G.TYPES) assert.strictEqual(G.normalizeControl({ type: ty }).type, ty);
});
t("a slider's range is the USER'S", () => {
  const c = G.normalizeControl({ type: "slider", min: 4, max: 64, step: 4 });
  assert.strictEqual(c.min, 4); assert.strictEqual(c.max, 64); assert.strictEqual(c.step, 4);
});
t("a backwards range is ordered, not refused", () => {
  const c = G.normalizeControl({ type: "slider", min: 60, max: 1 });
  assert.strictEqual(c.min, 1); assert.strictEqual(c.max, 60);
});
t("a zero step becomes 1 — a slider that cannot move is not a slider", () =>
  assert.strictEqual(G.normalizeControl({ type: "slider", step: 0 }).step, 1));
t("A ZERO DEFAULT SURVIVES (the LoRA-weight truthiness trap)", () => {
  const c = G.normalizeControl({ type: "slider", min: 0, max: 2, step: 0.05, default: 0 });
  assert.strictEqual(c.default, 0, "0 became " + c.default);
});
t("a default outside the range is clamped into it", () =>
  assert.strictEqual(G.normalizeControl({ type: "slider", min: 1, max: 10, default: 99 }).default, 10));
t("a dropdown accepts plain strings and {label,value} pairs", () => {
  const c = G.normalizeControl({ type: "dropdown", options: ["a", { label: "Bee", value: "b" }] });
  assert.deepStrictEqual(c.options, [{ label: "a", value: "a" }, { label: "Bee", value: "b" }]);
  assert.strictEqual(c.default, "a");
});
t("a toggle's on/off values default to true/false but can be anything", () => {
  assert.strictEqual(G.normalizeControl({ type: "toggle" }).on, true);
  assert.strictEqual(G.normalizeControl({ type: "toggle", on: "enable", off: "disable" }).on, "enable");
});
t("duplicate wires to the same input collapse to one", () => {
  const c = G.normalizeControl({ targets: [{ node: "3", input: "steps" }, { node: "3", input: "steps" }] });
  assert.strictEqual(c.targets.length, 1);
});
t("a half-written target is dropped", () =>
  assert.strictEqual(G.normalizeControl({ targets: [{ node: "3" }, { input: "steps" }] }).targets.length, 0));
t("a control with no label gets a numbered one", () =>
  assert.strictEqual(G.normalizeControl({}, 2).label, "Input 3"));

/* --------------------------------------------------------------- coercion */
t("a toggle sends its on value when on", () =>
  assert.strictEqual(G.coerce({ type: "toggle", on: "yes", off: "no" }, true), "yes"));
t("a toggle sends its off value when off", () =>
  assert.strictEqual(G.coerce({ type: "toggle", on: "yes", off: "no" }, false), "no"));
t("a toggle reads the string 'true' from a form", () =>
  assert.strictEqual(G.coerce({ type: "toggle" }, "true"), true));
t("a slider clamps to its range", () =>
  assert.strictEqual(G.coerce({ type: "slider", min: 1, max: 10 }, 999), 10));
t("a slider given nonsense falls back to its default, not NaN", () =>
  assert.strictEqual(G.coerce({ type: "slider", min: 1, max: 10, default: 4 }, "abc"), 4));
t("a slider accepts 0 rather than treating it as absent", () =>
  assert.strictEqual(G.coerce({ type: "slider", min: 0, max: 1, default: 1 }, 0), 0));
t("a dropdown refuses a value that is not one of its options", () =>
  assert.strictEqual(G.coerce({ type: "dropdown", options: ["a", "b"] }, "z"), "a"));
t("a text control stringifies", () =>
  assert.strictEqual(G.coerce({ type: "text" }, 12), "12"));

/* ------------------------------------------------------------------ apply */
const BIND = { name: "b", controls: [
  { id: "steps", type: "slider", label: "Steps", min: 1, max: 60, default: 20,
    targets: [{ node: "3", input: "steps" }] },
  { id: "txt", type: "text", label: "Prompt", targets: [{ node: "6", input: "text" }] },
] };
t("values are written into the graph", () => {
  const r = G.apply(API, BIND, { steps: 8, txt: "a dog" });
  assert.strictEqual(r.graph["3"].inputs.steps, 8);
  assert.strictEqual(r.graph["6"].inputs.text, "a dog");
});
t("apply is PURE — the source graph is untouched", () => {
  G.apply(API, BIND, { steps: 8 });
  assert.strictEqual(API["3"].inputs.steps, 20, "the fixture was mutated");
});
t("an unsent value uses the control's default", () =>
  assert.strictEqual(G.apply(API, BIND, {}).graph["3"].inputs.steps, 20));
t("what was applied is reported back", () => {
  const r = G.apply(API, BIND, { steps: 8 });
  assert.ok(r.applied.some((a) => a.node === "3" && a.input === "steps" && a.value === 8));
});
t("a wire to a node that is gone is REPORTED, not silently skipped", () => {
  const r = G.apply(API, { controls: [{ id: "x", label: "Gone", targets: [{ node: "99", input: "steps" }] }] }, {});
  assert.ok(r.warnings.some((w) => /node 99/.test(w)), JSON.stringify(r.warnings));
});
t("a wire to an input the node does not have is reported", () => {
  const r = G.apply(API, { controls: [{ id: "x", label: "Nope", targets: [{ node: "3", input: "wobble" }] }] }, {});
  assert.ok(r.warnings.some((w) => /wobble/.test(w)));
});
t("A LINK IS NEVER OVERWRITTEN", () => {
  const r = G.apply(API, { controls: [{ id: "x", label: "Model", targets: [{ node: "3", input: "model" }] }] }, { x: "oops" });
  assert.deepStrictEqual(r.graph["3"].inputs.model, ["4", 0]);
  assert.ok(r.warnings.some((w) => /connected to another node/.test(w)));
});
t("an unwired control is reported", () => {
  const r = G.apply(API, { controls: [{ id: "x", label: "Lonely" }] }, {});
  assert.ok(r.warnings.some((w) => /not wired/.test(w)));
});
t("apply on a UI export patches nothing and says so", () => {
  const r = G.apply(UI, BIND, {});
  assert.deepStrictEqual(r.applied, []);
  assert.ok(/not an API workflow/.test(r.warnings[0]));
});
t("validate() lists exactly the broken wires", () => {
  assert.deepStrictEqual(G.validate(API, BIND), []);
  assert.strictEqual(G.validate(API, { controls: [{ id: "x", label: "X", targets: [{ node: "77", input: "a" }] }] }).length, 1);
});

/* ------------------------------------------------------------- the store */
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), "h3graphs-"));
t("a graph with no name is refused", () =>
  assert.throws(() => G.normalize({}), /needs a name/));
t("save then read round-trips", () => {
  const g = G.save(DIR, { name: "My upscaler", file: "comfy_workflows/up.json", kind: "image", controls: BIND.controls });
  const back = G.read(DIR).find((x) => x.id === g.id);
  assert.strictEqual(back.name, "My upscaler");
  assert.strictEqual(back.controls.length, 2);
  assert.strictEqual(back._file, "My upscaler.json", back._file);
});
t("a rename MOVES the file and keeps the id", () => {
  const g = G.read(DIR)[0];
  const moved = G.save(DIR, { ...g, name: "Renamed" });
  assert.strictEqual(moved.id, g.id);
  assert.ok(fs.existsSync(path.join(DIR, "Renamed.json")));
  assert.ok(!fs.existsSync(path.join(DIR, "My upscaler.json")));
});
t("a duplicate name is REFUSED, never overwritten", () => {
  assert.throws(() => G.save(DIR, { name: "Renamed", file: "x.json" }), /already exists/);
  try { G.save(DIR, { name: "Renamed", file: "x.json" }); } catch (e) { assert.strictEqual(e.code, "duplicate-name"); }
});
t("a name that walks the filesystem cannot", () => {
  const g = G.save(DIR, { name: "../../evil", file: "a.json" });
  assert.ok(!g._file.includes(".."), g._file);
  assert.ok(fs.existsSync(path.join(DIR, g._file)));
  G.remove(DIR, g.id);
});
t("one unparseable file costs one file, not the list", () => {
  fs.writeFileSync(path.join(DIR, "broken.json"), "{ not json");
  assert.ok(G.read(DIR).length >= 1);
  fs.unlinkSync(path.join(DIR, "broken.json"));
});
t("a hand-dropped file gets a STABLE id, so a saved pick sticks", () => {
  fs.writeFileSync(path.join(DIR, "handmade.json"), JSON.stringify({ file: "h.json", controls: [] }));
  const a = G.read(DIR).find((x) => x._file === "handmade.json");
  const b = G.read(DIR).find((x) => x._file === "handmade.json");
  assert.strictEqual(a.id, b.id);
  assert.strictEqual(a.name, "handmade");
});
t("kind filtering includes 'any' graphs", () => {
  G.save(DIR, { name: "anykind", file: "a.json", kind: "any" });
  const ids = G.read(DIR, "video").map((g) => g.name);
  assert.ok(ids.includes("anykind"));
});
t("an unknown kind falls back to 'any'", () =>
  assert.strictEqual(G.normalize({ name: "k", kind: "sausage" }).kind, "any"));
t("read of a missing folder is [] and not a throw", () =>
  assert.deepStrictEqual(G.read(path.join(DIR, "nope")), []));
t("remove returns null for an id that is not there", () =>
  assert.strictEqual(G.remove(DIR, "nosuch"), null));

/* ------------------------------------------------------- UI export -> API */
t("a UI export converts to an API prompt", () => {
  const r = T.convert(UI, INFO);
  assert.ok(r.graph, JSON.stringify(r));
  assert.strictEqual(r.graph["3"].class_type, "KSampler");
});
t("widget VALUES get their NAMES from /object_info", () => {
  const k = T.convert(UI, INFO).graph["3"].inputs;
  assert.strictEqual(k.seed, 12345);
  assert.strictEqual(k.steps, 20);
  assert.strictEqual(k.cfg, 8.0);
  assert.strictEqual(k.sampler_name, "euler");
  assert.strictEqual(k.denoise, 1.0);
});
t("control_after_generate is consumed, not written into the prompt", () => {
  const k = T.convert(UI, INFO).graph["3"].inputs;
  assert.ok(!("control_after_generate" in k));
  assert.ok(!Object.values(k).includes("randomize"), JSON.stringify(k));
});
t("A BYPASSED NODE IS REMOVED", () => {
  const r = T.convert(UI, INFO);
  assert.ok(!("2" in r.graph), "the bypassed LoRA survived");
  assert.ok(r.dropped.some((d) => d.node === "2" && d.why === "bypassed"));
});
t("...and its consumers are rewired to what fed it", () =>
  assert.deepStrictEqual(T.convert(UI, INFO).graph["3"].inputs.model, ["1", 0]));
t("a Note never reaches the prompt", () =>
  assert.ok(!("4" in T.convert(UI, INFO).graph)));
t("the node's title is carried into _meta", () =>
  assert.strictEqual(T.convert(UI, INFO).graph["3"]._meta.title, "Sampler"));
t("AN UNKNOWN NODE CLASS FAILS by name rather than being guessed", () => {
  const r = T.convert({ nodes: [{ id: 1, type: "SomePack_Thing", widgets_values: [1], inputs: [], outputs: [] }], links: [] }, INFO);
  assert.strictEqual(r.graph, null);
  assert.deepStrictEqual(r.unknown, ["SomePack_Thing"]);
});
t("something that is not a UI export throws with a code", () => {
  try { T.convert({ hello: 1 }, INFO); assert.fail("did not throw"); }
  catch (e) { assert.strictEqual(e.code, "not-ui"); }
});
t("a widget converted to an input takes its value from the link, not the list", () => {
  const ui = { nodes: [
    { id: 1, type: "CheckpointLoaderSimple", widgets_values: ["sd.safetensors"], inputs: [], outputs: [{ type: "MODEL" }] },
    { id: 3, type: "KSampler", widgets_values: [20, 8.0, "euler", "normal", 1.0],
      inputs: [{ name: "model", type: "MODEL", link: 1 }, { name: "seed", type: "INT", link: 2, widget: { name: "seed" } }],
      outputs: [] },
    { id: 5, type: "PrimitiveNode", widgets_values: [777], inputs: [], outputs: [{ type: "INT" }] },
  ], links: [[1, 1, 0, 3, 0, "MODEL"], [2, 5, 0, 3, 1, "INT"]] };
  const k = T.convert(ui, INFO).graph["3"].inputs;
  assert.strictEqual(k.seed, 777, "the primitive's value should be inlined");
  assert.strictEqual(k.steps, 20, "steps must not have eaten the seed's slot");
});
t("the link table reads the object link shape too", () => {
  const tbl = T.linkTable({ links: [{ id: 7, origin_id: 1, origin_slot: 0, target_id: 2, target_slot: 0, type: "MODEL" }] });
  assert.strictEqual(tbl.get("7").from, "1");
});
t("a combo input counts as a widget; a MODEL input does not", () => {
  assert.strictEqual(T.isWidgetSpec([["a", "b"]]), true);
  assert.strictEqual(T.isWidgetSpec(["INT", {}]), true);
  assert.strictEqual(T.isWidgetSpec(["MODEL"]), false);
});
t("input_order decides the order, not key order", () => {
  const info = { X: { input: { required: { b: ["INT", {}], a: ["INT", {}] } },
                      input_order: { required: ["a", "b"] } } };
  const g = T.convert({ nodes: [{ id: 1, type: "X", widgets_values: [10, 20], inputs: [], outputs: [] }], links: [] }, info).graph;
  assert.strictEqual(g["1"].inputs.a, 10);
  assert.strictEqual(g["1"].inputs.b, 20);
});
t("a trailing UI-only widget value is ignored with a warning, not mis-assigned", () => {
  const info = { L: { input: { required: { image: [["a.png"]] } }, input_order: { required: ["image"] } } };
  const r = T.convert({ nodes: [{ id: 1, type: "L", widgets_values: ["a.png", "image"], inputs: [], outputs: [] }], links: [] }, info);
  assert.strictEqual(r.graph["1"].inputs.image, "a.png");
  assert.ok(r.warnings.some((w) => /UI-only/.test(w)), JSON.stringify(r.warnings));
});
t("a named widgets_values object is read directly", () => {
  const info = { X: { input: { required: { a: ["INT", {}] } }, input_order: { required: ["a"] } } };
  const g = T.convert({ nodes: [{ id: 1, type: "X", widgets_values: { a: 5 }, inputs: [], outputs: [] }], links: [] }, info).graph;
  assert.strictEqual(g["1"].inputs.a, 5);
});
t("a converted graph is one comfyGraphs recognises — the two halves meet", () => {
  const g = T.convert(UI, INFO).graph;
  assert.strictEqual(G.format(g), "api");
  assert.ok(G.apiInputs(g).some((i) => i.input === "steps"));
});

/* ------------------------------------- loaders fed from the reference dock */
/* Tim: "load image/load video/load sound node types will get the files from
   the reference docker, if there are unused 'load' nodes bypass them". */
const LG = () => ({
  "1": { class_type: "LoadImage", inputs: { image: "someone_elses.png", upload: "image" } },
  "2": { class_type: "LoadImage", inputs: { image: "also_theirs.png" } },
  "5": { class_type: "VHS_LoadVideo", inputs: { video: "clip.mp4" } },
  "6": { class_type: "LoadAudio", inputs: { audio: "song.wav" } },
  "7": { class_type: "VAEEncode", inputs: { pixels: ["1", 0], vae: ["9", 0] } },
  "8": { class_type: "ImageBlend", inputs: { image1: ["1", 0], image2: ["2", 0] } },
  "9": { class_type: "VAELoader", inputs: { vae_name: "v.safetensors" } },
});
t("every loader kind is found, in node-id order", () => {
  const l = G.loaderNodes(LG());
  assert.deepStrictEqual(l.map((x) => x.node), ["1", "2", "5", "6"]);
  assert.deepStrictEqual(l.map((x) => x.kind), ["images", "images", "videos", "audio"]);
});
t("...and the right input key is chosen per class", () => {
  const by = Object.fromEntries(G.loaderNodes(LG()).map((x) => [x.node, x.input]));
  assert.deepStrictEqual(by, { 1: "image", 2: "image", 5: "video", 6: "audio" });
});
t("a loader whose filename is fed by another node is not ours to fill", () => {
  const g = { "1": { class_type: "LoadImage", inputs: { image: ["4", 0] } } };
  assert.deepStrictEqual(G.loaderNodes(g), []);
});
t("the dock's files land in node order — first loader, first reference", () => {
  const r = G.assignRefs(LG(), { images: ["a.png", "b.png"], videos: ["v.mp4"], audio: ["s.wav"] });
  assert.strictEqual(r.graph["1"].inputs.image, "a.png");
  assert.strictEqual(r.graph["2"].inputs.image, "b.png");
  assert.strictEqual(r.graph["5"].inputs.video, "v.mp4");
  assert.strictEqual(r.graph["6"].inputs.audio, "s.wav");
});
t("...and the workflow's exported filenames never survive", () => {
  const r = G.assignRefs(LG(), { images: ["a.png", "b.png"], videos: ["v.mp4"], audio: ["s.wav"] });
  const left = JSON.stringify(r.graph);
  for (const stale of ["someone_elses.png", "also_theirs.png", "clip.mp4", "song.wav"])
    assert.ok(!left.includes(stale), `${stale} survived — ComfyUI would be asked for a file from another machine`);
});
t("AN UNUSED LOADER IS REMOVED, not left pointing at a stale filename", () => {
  const r = G.assignRefs(LG(), { images: ["a.png"] });
  assert.ok(!("2" in r.graph), "the second LoadImage survived with one picture in the dock");
  assert.ok(!("5" in r.graph) && !("6" in r.graph), "the video/audio loaders survived an empty dock");
  assert.strictEqual(r.bypassed.length, 3);
});
t("...and its consumer's input is DROPPED, never left empty", () => {
  const r = G.assignRefs(LG(), { images: ["a.png"] });
  assert.ok(!("image2" in r.graph["8"].inputs), "an empty value fails ComfyUI's validation");
  assert.deepStrictEqual(r.graph["8"].inputs.image1, ["1", 0], "the LIVE loader's wire must survive");
});
t("...while every other node is untouched", () => {
  const r = G.assignRefs(LG(), { images: ["a.png"] });
  assert.deepStrictEqual(r.graph["7"].inputs, { pixels: ["1", 0], vae: ["9", 0] });
  assert.strictEqual(r.graph["9"].inputs.vae_name, "v.safetensors");
});
t("an empty dock bypasses every loader rather than failing", () => {
  const r = G.assignRefs(LG(), {});
  assert.strictEqual(r.bypassed.length, 4);
  assert.ok(!Object.values(r.graph).some((n) => G.LOADERS[n.class_type]));
});
t("assignRefs is PURE — the source graph keeps its nodes", () => {
  const g = LG();
  G.assignRefs(g, { images: ["a.png"] });
  assert.ok("2" in g, "the fixture was mutated");
});
t("A CONTROL WIRED TO A LOADER WINS, and keeps that loader alive", () => {
  const r = G.assignRefs(LG(), { images: ["a.png"] }, new Set(["2.image"]));
  assert.ok("2" in r.graph, "a deliberately wired loader was bypassed");
  assert.strictEqual(r.graph["2"].inputs.image, "also_theirs.png", "the dock overruled the control");
  assert.strictEqual(r.graph["1"].inputs.image, "a.png", "the unheld loader still took the dock's file");
});
t("more references than slots is reported, not silently dropped", () => {
  const r = G.assignRefs(LG(), { images: ["a.png", "b.png", "c.png"] });
  assert.ok(r.warnings.some((w) => /3 images/.test(w) && /2 slot/.test(w)), JSON.stringify(r.warnings));
});
t("entries may be plain strings or {name,path} pairs", () => {
  const r = G.assignRefs(LG(), { images: [{ name: "a.png", path: "/proj/a.png" }] });
  assert.strictEqual(r.assigned[0].path, "/proj/a.png");
  assert.strictEqual(G.assignRefs(LG(), { images: ["a.png"] }).assigned[0].path, "a.png");
});
t("assignRefs on a UI export patches nothing and says so", () => {
  const r = G.assignRefs(UI, { images: ["a.png"] });
  assert.deepStrictEqual(r.assigned, []);
  assert.ok(/not an API workflow/.test(r.warnings[0]));
});
t("a chain of removed nodes is resolved through, not left dangling", () => {
  const g = { "1": { class_type: "LoadImage", inputs: { image: "x.png" } },
              "2": { class_type: "LoadImage", inputs: { image: "y.png" } },
              "3": { class_type: "SaveImage", inputs: { images: ["2", 0] } } };
  const r = G.assignRefs(g, { images: ["a.png"] });
  assert.ok(!("2" in r.graph));
  assert.ok(!("images" in r.graph["3"].inputs), "a source with nothing behind it drops the consumer's input");
});
t("analyze() reports the loaders so the tab can mark them", () => {
  const a = G.analyze(LG());
  assert.strictEqual(a.loaders.length, 4);
  assert.deepStrictEqual(G.analyze(UI).loaders, []);
});
/* ---------------------------------------------------- the shipped wiring */
const ROOT = path.join(__dirname, "..");
t("lib/comfyGraphs.js reuses fileStem from styles.js rather than copying it", () => {
  const src = fs.readFileSync(path.join(ROOT, "lib", "comfyGraphs.js"), "utf8");
  assert.ok(/require\("\.\/styles"\)/.test(src));
  assert.ok(!/function fileStem/.test(src), "fileStem was re-implemented");
});
t("graph_worker.py exists and refuses any mode but graph", () => {
  const src = fs.readFileSync(path.join(ROOT, "misc", "graph_worker.py"), "utf8");
  assert.ok(/mode=graph/.test(src));
  assert.ok(/only runs mode=graph/.test(src));
});
t("THE CONTROL MODEL IS NOT DUPLICATED IN PYTHON", () => {
  const src = fs.readFileSync(path.join(ROOT, "misc", "graph_worker.py"), "utf8");
  for (const word of ["normalizeControl", "def coerce", "\"slider\"", "'slider'"]) {
    assert.ok(!src.includes(word), `graph_worker.py mentions ${word} — the control model must live only in lib/comfyGraphs.js`);
  }
});
t("THE UPLOAD IS THE WORKER'S ONLY JOB HERE", () => {
  const src = fs.readFileSync(path.join(ROOT, "misc", "graph_worker.py"), "utf8");
  assert.ok(/graph_uploads/.test(src), "the worker does not upload the dock's files");
  assert.ok(/upload_image/.test(src));
  // The class names are the tell: a worker that knows what a LoadImage is has
  // started deciding. (The word "bypassed" appears in a comment naming where
  // the decision actually lives, which is the opposite problem.)
  for (const word of ["LoadImage", "LoadAudio", "VHS_LoadVideo", "LOADERS"])
    assert.ok(!src.includes(word),
      `graph_worker.py mentions ${word} — which loader gets which file is lib/comfyGraphs.js's decision`);
});
t("the route sends a path per upload, never a bare name", () => {
  const src = fs.readFileSync(path.join(ROOT, "routes", "index.js"), "utf8");
  assert.ok(/graph_uploads: fill\.assigned\.map/.test(src));
  assert.ok(/path: a\.path/.test(src));
});
t("core.js maps mode=graph to graph_worker.py", () => {
  const src = fs.readFileSync(path.join(ROOT, "lib", "core.js"), "utf8");
  assert.ok(/graph: "graph_worker\.py"/.test(src));
});
t("the comfy dock is a real dock in uiLayout, so its size persists", () => {
  const ui = require("../lib/uiLayout");
  assert.ok("comfydock" in ui.BOTTOM);
  assert.strictEqual(ui.defaults().comfydock.state, "closed");
  assert.strictEqual(ui.normalize({ comfydock: { height: 500, state: "max" } }).comfydock.height, 500);
});
t("lib/comfy.js exposes objectInfo — the widget order comes from ComfyUI", () => {
  const src = fs.readFileSync(path.join(ROOT, "lib", "comfy.js"), "utf8");
  assert.ok(/async function objectInfo/.test(src));
  assert.ok(/objectInfo,/.test(src.slice(src.lastIndexOf("module.exports"))));
});

fs.rmSync(DIR, { recursive: true, force: true });
console.log(`test-comfygraphs: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
