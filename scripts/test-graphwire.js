#!/usr/bin/env node
"use strict";
/* scripts/test-graphwire.js — the wiring surface (2.120.0).
 *
 * static/graphwire.js draws the lines between "an input the user added" and
 * "a value in the ComfyUI graph". The GEOMETRY is a pure function, so it is
 * pinned here without a browser — the same arrangement as static/vr360.js,
 * which exists because a picture that is subtly wrong is very hard to notice
 * and very easy to test.
 */
const assert = require("assert");
const fs = require("fs");
const PAGE = require("../lib/extensions").pageHtml(require("path").join(__dirname, ".."));

const path = require("path");
const W = require("../ext/comfydock/graphwire.js");

let pass = 0, fail = 0;
const t = (name, fn) => {
  try { fn(); pass++; }
  catch (e) { fail++; console.log(`  FAIL ${name}: ${e.message}`); }
};

const HOST = { left: 100, top: 50, width: 800, height: 400 };
const ROW = { left: 120, top: 60, width: 200, height: 20 };

/* ------------------------------------------------------------- geometry */
t("a right-hand port sits on the row's right edge, vertically centred", () => {
  assert.deepStrictEqual(W.port(ROW, HOST, "right"), { x: 220, y: 20 });
});
t("a left-hand port sits on the row's left edge", () => {
  assert.deepStrictEqual(W.port(ROW, HOST, "left"), { x: 20, y: 20 });
});
t("ports are in the HOST's coordinates, not the page's", () => {
  const p = W.port({ left: 100, top: 50, width: 0, height: 0 }, HOST, "left");
  assert.deepStrictEqual(p, { x: 0, y: 0 });
});
t("a missing row gives null rather than NaN", () => {
  assert.strictEqual(W.port(null, HOST, "left"), null);
  assert.strictEqual(W.port(ROW, null, "left"), null);
});
t("a path starts at a and ends at b", () => {
  const d = W.path({ x: 0, y: 0 }, { x: 300, y: 90 });
  assert.ok(d.startsWith("M 0 0 "), d);
  assert.ok(d.endsWith(" 300 90"), d);
});
t("the handles reach horizontally — a wire leaves and arrives sideways", () => {
  const d = W.path({ x: 0, y: 0 }, { x: 300, y: 90 });
  const c = d.slice(d.indexOf("C") + 1).split(",").map((s) => s.trim().split(/\s+/).map(Number));
  assert.strictEqual(c[0][1], 0, "the first handle left the start's height");
  assert.strictEqual(c[1][1], 90, "the second handle left the end's height");
});
t("a very short wire still gets a 24px reach, so it is a curve not a spike", () => {
  const d = W.path({ x: 0, y: 0 }, { x: 6, y: 40 });
  assert.ok(d.includes("C 24 0"), d);
});
t("an empty path for a missing endpoint", () => assert.strictEqual(W.path(null, { x: 1, y: 1 }), ""));
t("within() is inclusive of the edges", () => {
  assert.strictEqual(W.within(ROW, 120, 60), true);
  assert.strictEqual(W.within(ROW, 320, 80), true);
  assert.strictEqual(W.within(ROW, 321, 80), false);
  assert.strictEqual(W.within(null, 1, 1), false);
});
t("dropTarget returns the first box the point is in", () => {
  const boxes = [{ key: "a", ...ROW }, { key: "b", left: 0, top: 0, width: 1000, height: 1000 }];
  assert.strictEqual(W.dropTarget(boxes, 130, 65), "a");
  assert.strictEqual(W.dropTarget(boxes, 5, 5), "b");
  assert.strictEqual(W.dropTarget(boxes, 5000, 5), null);
  assert.strictEqual(W.dropTarget(null, 1, 1), null);
});

/* ------------------------------------------------------------ the wires */
const bind = () => ({ controls: [
  { id: "c1", type: "slider", label: "Steps", targets: [{ node: "3", input: "steps" }] },
  { id: "c2", type: "text", label: "Prompt", targets: [] },
] });
t("wires() lists every target of every control", () => {
  const b = bind();
  W.link(b, "c2", "6", "text");
  assert.deepStrictEqual(W.wires(b), [
    { control: "c1", node: "3", input: "steps" },
    { control: "c2", node: "6", input: "text" }]);
});
t("wires() of nothing is [] rather than a throw", () => assert.deepStrictEqual(W.wires(null), []));
t("a half-written target is not drawn", () => {
  assert.deepStrictEqual(W.wires({ controls: [{ id: "x", targets: [{ node: "3" }] }] }), []);
});
t("link() reports whether anything changed", () => {
  const b = bind();
  assert.strictEqual(W.link(b, "c2", "6", "text"), true);
  assert.strictEqual(W.link(b, "c2", "6", "text"), false, "a repeat is not a change");
});
t("link() to a control that is not there is a no-op", () =>
  assert.strictEqual(W.link(bind(), "nope", "6", "text"), false));
t("unlink() cuts exactly one wire", () => {
  const b = bind();
  W.link(b, "c1", "9", "filename_prefix");
  assert.strictEqual(W.unlink(b, "c1", "3", "steps"), true);
  assert.deepStrictEqual(W.wires(b), [{ control: "c1", node: "9", input: "filename_prefix" }]);
});
t("unlink() of a wire that is not there is a no-op", () =>
  assert.strictEqual(W.unlink(bind(), "c1", "77", "x"), false));
t("ONE CONTROL CAN DRIVE SEVERAL INPUTS — a two-phase graph needs it", () => {
  const b = bind();
  W.link(b, "c1", "10", "steps");
  assert.strictEqual(W.wires(b).length, 2);
});
t("wiredInputs() keys by node.input so the right column can grey them", () => {
  const s = W.wiredInputs(bind());
  assert.ok(s.has("3.steps"));
  assert.ok(!s.has("6.text"));
});

/* --------------------------------------------------- suggesting a control */
t("a boolean input suggests a toggle", () =>
  assert.strictEqual(W.suggest({ input: "tiled", value: true }), "toggle"));
t("a seed suggests a spinner, never a slider over four billion", () =>
  assert.strictEqual(W.suggest({ input: "seed", value: 12345 }), "spinner"));
t("steps and cfg suggest sliders", () => {
  assert.strictEqual(W.suggest({ input: "steps", value: 20 }), "slider");
  assert.strictEqual(W.suggest({ input: "cfg", value: 8 }), "slider");
  assert.strictEqual(W.suggest({ input: "strength_model", value: 1 }), "slider");
});
t("a prompt suggests a text box", () =>
  assert.strictEqual(W.suggest({ input: "text", value: "a cat" }), "text"));
t("a short string that is not a prompt suggests a dropdown (a combo)", () =>
  assert.strictEqual(W.suggest({ input: "sampler_name", value: "euler" }), "dropdown"));
t("a long string is a text box whatever it is called", () =>
  assert.strictEqual(W.suggest({ input: "sampler_name", value: "x".repeat(80) }), "text"));
t("suggest() of nothing does not throw", () => assert.strictEqual(W.suggest(null), "text"));

t("controlFor() arrives already wired to the input it was made from", () => {
  const c = W.controlFor({ node: "3", input: "steps", value: 20 }, "c9");
  assert.deepStrictEqual(c.targets, [{ node: "3", input: "steps" }]);
  assert.strictEqual(c.id, "c9");
});
t("a slider made from a value gets a range that contains it", () => {
  const c = W.controlFor({ node: "3", input: "steps", value: 20 }, "c1");
  assert.strictEqual(c.type, "slider");
  assert.ok(c.min <= 20 && c.max >= 20, JSON.stringify(c));
  assert.strictEqual(c.default, 20);
});
t("a fractional value gets a fractional step", () =>
  assert.strictEqual(W.controlFor({ input: "denoise", value: 0.5 }, "c1").step, 0.05));
t("A ZERO VALUE STAYS ZERO (the truthiness trap)", () => {
  const c = W.controlFor({ node: "1", input: "strength_model", value: 0 }, "c1");
  assert.strictEqual(c.default, 0, "0 became " + c.default);
  assert.ok(c.max > c.min, "a zero value must not collapse the range");
});
t("a dropdown made from a value starts with that value as its one option", () => {
  const c = W.controlFor({ node: "3", input: "sampler_name", value: "euler" }, "c1");
  assert.deepStrictEqual(c.options, ["euler"]);
  assert.strictEqual(c.default, "euler");
});
t("a toggle made from a value keeps it as the default", () =>
  assert.strictEqual(W.controlFor({ input: "tiled", value: true }, "c1").default, true));

/* ------------------------------------------------------- the shipped file */
t("attach() returns null without a DOM instead of throwing", () =>
  assert.strictEqual(W.attach({ host: null }), null));
t("attach() with no options at all is still null", () =>
  assert.strictEqual(W.attach(), null));
t("graphwire.js carries no control model of its own", () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "ext", "comfydock", "graphwire.js"), "utf8");
  assert.ok(!/normalizeControl|function coerce/.test(src),
    "the control model must live only in lib/comfyGraphs.js");
});
t("the page loads graphwire.js", () => {
  const html = PAGE;
  assert.ok(html.includes("/ext/comfydock/graphwire.js"), "the script tag is missing");
});

/* ------------------------------------------------- the shipped UI anchors */
const HTML = PAGE;
const anchor = (name, re) => t(name, () =>
  assert.ok(re.test(HTML), `index.html is missing ${re}`));

anchor("the ComfyUI dock exists", /id="comfydock"/);
anchor("...and frames ComfyUI rather than re-implementing it", /<iframe id="comfyframe"/);
anchor("...with a reload and an open-in-browser button", /id="cfReload"[\s\S]*id="cfOpen"/);
anchor("...and a toolbar toggle", /id="tCF"/);
anchor("the ComfyUI settings tab has sub-tabs", /data-ctab="engine"[\s\S]*data-ctab="graphs"/);
anchor("the Graphs panel exists", /id="ctab-graphs"/);
anchor("...with a file selector for a workflow", /type="file" id="g_pick"/);
anchor("...an Export as API button", /id="g_toapi"/);
anchor("...a format readout, so 'is it an API workflow' is answered on screen", /id="g_fmt"/);
anchor("...the two lists", /id="g_controls"[\s\S]*id="g_inputs"/);
anchor("...and the surface the wires are drawn on", /id="gwsurface"/);
anchor("Basic Settings has the graph panel", /id="gset"/);
anchor("...with the graph picker and its controls", /id="gsSel"[\s\S]*id="gsControls"/);
anchor("Generate offers the graph mode", /<option value="graph">/);
t("EVERY control type Tim asked for is offered in the tab", () => {
  for (const ty of ["toggle", "dropdown", "text", "slider", "spinner"])
    assert.ok(new RegExp(`"${ty}"`).test(HTML), `the ${ty} control type is not in the UI`);
});
t("the slider's range is the USER'S — min, max and step are editable", () => {
  const G = require("../lib/comfyGraphs");
  const c = G.normalizeControl({ type: "slider", min: 2, max: 9, step: 0.5 });
  assert.deepStrictEqual([c.min, c.max, c.step], [2, 9, 0.5]);
  assert.ok(/num\("min", "min"\); num\("max", "max"\); num\("step", "step"\)/.test(HTML),
    "the tab does not offer min/max/step fields for a slider");
});
t("the dock's size is persisted through the settings file, not localStorage only", () =>
  assert.ok(/comfydock: "cfh"/.test(HTML) && /"cfh"/.test(HTML)));
t("the iframe src is set LAZILY — a closed dock must not boot ComfyUI's frontend", () => {
  // 2.223.14: the painter moved with its docker (ext-owned wiring) — the
  // guard is pinned in its new home, ext/comfydock/comfydock.js
  const DOCKJS = require("fs").readFileSync(
    require("path").join(__dirname, "..", "ext", "comfydock", "comfydock.js"), "utf8");
  assert.ok(/if \(open && f\.getAttribute\("src"\) !== url\)/.test(DOCKJS),
    "the iframe would load before the dock is opened");
});
t("Basic Settings shows the graph panel only in graph mode", () => {
  // 2.150.0: the Character chain tab hides ALL mode panels, gset included
assert.ok(/\$\("gset"\)\.classList\.toggle\("hidden", chain \|\| !graph\)/.test(HTML));
  assert.ok(/\$\("vset"\)\.classList\.toggle\("hidden", chain \|\| img \|\| graph\)/.test(HTML));
});
t("Generate routes graph mode to startGraphJob, not to a video submit", () =>
  assert.ok(/gm === "graph" \? await startGraphJob\(\)/.test(HTML)));
t("the run posts the wired VALUES, and the server applies them", () => {
  assert.ok(/\/api\/graphs\/run/.test(HTML));
  assert.ok(/values: gsValues/.test(HTML));
});
t("THE UI DOES NOT PATCH THE GRAPH ITSELF", () => {
  /* The whole point of applying the controls server-side is that there is ONE
     implementation of the control model. The UI may READ a node's class name to
     label a row; it must never WRITE into a node's inputs. */
  const block = HTML.slice(HTML.indexOf("COMFYUI DOCK + WIRED GRAPHS"),
                           HTML.indexOf("(function init() {"));
  assert.ok(!/\.inputs\[/.test(block), "the Graphs UI writes into node inputs");
  assert.ok(!/class_type:/.test(block), "the Graphs UI builds graph nodes");
  assert.ok(/\/api\/graphs\/run/.test(block), "the run must go through the server");
});

/* ------------------ the wired values belong to the project (2.125.0) ------ */
t("the project's state carries the graph selection and its values", () => {
  const st = (/function projectState\(\) \{[\s\S]*?\n\}/.exec(HTML) || [""])[0];
  assert.ok(/graph:\s*\(typeof graphState === "function"\)/.test(st),
    "projectState() does not include the graph");
  const gs = (/function graphState\(\) \{[\s\S]*?\n\}/.exec(HTML) || [""])[0];
  assert.ok(/gsSel/.test(gs) && /\.\.\.gsValues/.test(gs), `graphState is thin: ${gs}`);
});
t("the BINDING is not copied into the project — only its id", () => {
  /* graphs/<n>.json is shared by every project. Copying the controls into each
     .prj would give one wiring two definitions and they would drift. */
  const gs = (/function graphState\(\) \{[\s\S]*?\n\}/.exec(HTML) || [""])[0];
  assert.ok(!/controls/.test(gs), "graphState copies the binding's controls");
  assert.ok(!/graphList/.test(gs), "graphState reaches into the binding list");
});
t("opening a project restores the values, and repaints the controls", () => {
  const ag = (/function applyGraphState\(g\) \{[\s\S]*?\n\}/.exec(HTML) || [""])[0];
  assert.ok(/delete gsValues\[k\]/.test(ag), "the previous project's values are left behind");
  assert.ok(/store\.set\("graphsel"/.test(ag), "the picker's stored key is not updated");
  assert.ok(/paintGraphControls\(\)/.test(ag), "the controls are not repainted");
});
t("a project saved before 2.125.0 does not wipe a live selection", () => {
  assert.ok(/if \(d\.graph && typeof applyGraphState === "function"\)/.test(HTML),
    "applyGraphState is called even when the .prj has no graph key");
});
t("a NEW project starts with no graph selected and no values", () => {
  const rw = (/function resetWorkspace\(\) \{[\s\S]*?\n\}/.exec(HTML) || [""])[0];
  assert.ok(/applyGraphState\(null\)/.test(rw), "resetWorkspace leaves the last graph wired up");
});
t("gsValues is no longer described as a per-session thing", () =>
  assert.ok(!/control id -> what the user set, this session/.test(HTML),
    "the comment still says the values die with the tab"));

console.log(`test-graphwire: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
