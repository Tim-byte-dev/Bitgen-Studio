#!/usr/bin/env node
/* bitGen Studio — 2.543.0 units: the prompt docker's ▾ by where the picture comes from (pcimgop.js, pcpromptlink.js).
 * Tim: "if the image editor docker is minimized or closed, use the reference images for the edit,replace background
 * functions, delete fill and remove from the prompt docker dropdown, if image editor docker is open use image editor layer
 * as reference image if user selects multiple layers use those layers as reference images for the operations add the fill
 * and remove functions back to the list. remove the tabs for generate,refine,edit,background and compose from image editor
 * docker. Add compose to the prompt docker dropdown". Pure + the wiring. */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const rd = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const O = require(path.join(ROOT, "ext", "imageeditdock", "pcimgop.js"));
const PL = require(path.join(ROOT, "ext", "imageeditdock", "pcpromptlink.js"));

check("🧩 Compose is in the list (the last)", O.OPS[O.OPS.length - 1].id === "compose" && O.labelFor("compose") === "🧩 Compose" && O.modeFor("compose") === "compose");
check("Fill and Remove only while the image editor is on screen; the rest always",
  ["generate", "edit", "refine", "background", "compose"].every((id) => O.available(id, false)) && !O.available("fill", false) && !O.available("remove", false) && O.available("fill", true) && O.available("remove", true));
const T = (x) => O.sourceText(Object.assign({ op: "edit", editorOn: true, open: true, blender: false, refs: 0, picks: 0, layer: "Photo", hasSel: false }, x));
check("the chip: the editor closed = \"🖼 N references\"; open = \"▦ <the layer>\" / \"▦ N layers\" (at most 3); a selection for Fill / Remove / Refine / Replace background; Generate / Blender = none",
  T({ editorOn: false, refs: 2 }) === "🖼 2 references" && T({ editorOn: false, refs: 1 }) === "🖼 1 reference" && T({ editorOn: false }) === "🖼 no references" && T({}) === "▦ Photo" && T({ picks: 5 }) === "▦ 3 layers"
  && T({ op: "fill", hasSel: true }) === "▭ the selection" && T({ op: "fill" }) === "" && T({ op: "refine", hasSel: true }) === "▭ the selection" && T({ op: "generate" }) === "" && T({ blender: true }) === "", [T({ editorOn: false, refs: 2 }), T({}), T({ picks: 5 })]);

const s = { onScreen: false, open: true, aiShown: false, mode: "generate", genMode: "image", hasSel: false, blender: false, picks: 0, refs: 1 };
const A = (x) => PL.actionFor(Object.assign({}, s, x));
check("the editor closed: Edit with 1 reference = the edit model on it; 2+ = Compose with them; Replace background = the same with the background instruction; Refine = picture 1 at the slider's strength; Compose = Compose",
  JSON.stringify(A({ op: "edit" })) === JSON.stringify({ kind: "refs", op: "edit", mode: "edit", bg: false }) && A({ op: "edit", refs: 3 }).mode === "compose"
  && A({ op: "background" }).bg === true && A({ op: "background" }).mode === "edit" && A({ op: "refine", refs: 2 }).mode === "refine" && A({ op: "compose" }).mode === "compose");
check("...no references = it says so; Fill / Remove = they need the editor", A({ op: "edit", refs: 0 }).kind === "say" && /References docker/.test(A({ op: "edit", refs: 0 }).msg) && A({ op: "fill" }).kind === "say" && /image editor/.test(A({ op: "remove" }).msg));
const B = (x) => A(Object.assign({ onScreen: true }, x));
check("the editor open: Edit / Replace background / Refine from the selected layer; several layers picked = Compose with them (Replace background too); Compose = the picked layers",
  B({ op: "edit" }).kind === "layer" && B({ op: "edit", picks: 2 }).kind === "compose" && JSON.stringify(B({ op: "background" })) === JSON.stringify({ kind: "layer", op: "background", mode: "edit", bg: true })
  && B({ op: "background", picks: 2 }).bg === true && B({ op: "background", picks: 2 }).kind === "compose" && B({ op: "refine" }).kind === "layer" && B({ op: "compose" }).kind === "compose");
check("bgPrompt: the instruction for the edit model (a trailing full stop dropped); nothing typed = nothing",
  PL.bgPrompt("a beach at sunset.") === "Replace the background with a beach at sunset. Keep the main subject exactly as it is - its shape, pose, colours and lighting." && PL.bgPrompt("  ") === "");

const PLs = rd("ext", "imageeditdock", "pcpromptlink.js"), IE = rd("ext", "imageeditdock", "imageedit.js"), MT = rd("ext", "imageeditdock", "mount.js"), OPs = rd("ext", "imageeditdock", "pcimgop.js");
check("the ✨ AI panel's mode tabs are gone (hidden - the prompt docker's ▾ picks the mode)", /#kxAi #kxModes\{display:none!important\}/.test(PLs));
check("window.ieOnScreen is global now (pcimgop / pcpromptlink asked it - it was inside mount.js's closure, so they always saw \"open\")", /window\.ieOnScreen = ieOnScreen;/.test(MT) && /root\.ieOnScreen/.test(OPs));
check("the references: up to 3, the first fitted to the panel's MP, Edit -> /api/aiedit edit, 2+ / Compose -> /api/aiedit/compose, Refine -> /api/aiedit refine (a clear mask = all); the results land in the gallery",
  /async function runRefs\(act, text\)/.test(PLs) && /refsNow\(\)\.slice\(0, 3\)/.test(PLs) && /api\.compose\(\{ pics:/.test(PLs) && /api\.aiedit\(\{ mode: "edit"/.test(PLs) && /api\.aiedit\(\{ mode: "refine"/.test(PLs));
check("the layers: the picked ones (else the selected one; an empty layer = the picture as seen) -> runAI(source) / runCompose({layers, direct}) - each result a new layer",
  /E\.runCompose\(\{ prompt, layers, direct: true, keep: E\.layer\(\) \}\)/.test(PLs) && /if \(c && !hasPixels\(c\)\) c = null;/.test(PLs) && /async function runCompose\(opt\)/.test(IE) && /const picks = \(opt\.layers \|\| \(E\.picked/.test(IE) && /if \(opt\.direct\) \{ discardResults\(true\); say\(added \? `\$\{added\} new layer\(s\) from \$\{picks/.test(IE));
check("a run's own mode does not move the ▾ (Replace background runs the edit model - the ▾ stays on Replace background)", /if \(E\.imgOp && !inTake\) E\.imgOp\.fromMode\(m\)/.test(PLs) && /inTake = true; try \{ E\.setAiMode\(act\.mode\); \} finally \{ inTake = false; \}/.test(PLs));
console.log(`\n${pass} passed, ${fail} failed`);
console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
process.exit(fail ? 1 : 0);
