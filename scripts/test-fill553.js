#!/usr/bin/env node
/* bitGen Studio — 2.553.0 units: Generate / Remove / New background in a selection through the EDIT model (the Krita AI
 * plugin's way for models that can edit: the picture as the reference, the selection painted green, an instruction - and
 * our noise mask so only the selection changes); Edit of a selection / of a layer with transparent parts.
 * Tim: "fill and generate don't work - they generate a full image in the selection, edit works but it redraws the entire
 * layer and fills in the edges to fill the canvas size. krita create images over the area you select the rest of the
 * layer is untouched and it looks like it belongs in the scene". */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const rd = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const A = require(path.join(ROOT, "lib", "aiEdit.js"));
const PL = require(path.join(ROOT, "ext", "imageeditdock", "pcpromptlink.js"));
const styleOf = (n) => Object.assign({ id: n }, JSON.parse(rd("styles", "image", n + ".json")));

const qwen = styleOf("Qwen Image Edit 2511"), krea = styleOf("Krea 2 Turbo");
const f1 = A.fillEditPlan(qwen, { mode: "generate", fill_kind: "generate", prompt: "a red ball" }, ROOT);
const f2 = A.fillEditPlan(qwen, { mode: "remove", fill_kind: "remove", prompt: "" }, ROOT);
const f3 = A.fillEditPlan(qwen, { mode: "generate", fill_kind: "background", prompt: "a beach" }, ROOT);
check("fillEditPlan: a fill = Krita's instruction + the prompt through the edit graph (the crop is the picture)",
  f1.prompt === "Fill the green spaces according to the image.\na red ball" && f1.editFill === "generate" && f1.mode === "generate" && f1.input === "crop" && /img_qwen_edit_2511/.test(f1.workflow) && f1.denoise == null, f1);
check("...Remove = \"Remove the object.\" alone; New background = \"Replace the background while keeping the main subject.\" + the prompt",
  f2.prompt === "Remove the object." && f2.mode === "remove" && f3.prompt === "Replace the background while keeping the main subject.\na beach" && f3.editFill === "background");
let threw = ""; try { A.fillEditPlan(krea, { mode: "generate", prompt: "x" }, ROOT); } catch (e) { threw = e.message; }
check("...a style that cannot edit (Krea 2) throws in words (the route then fills with the style itself)", /cannot follow an edit instruction/.test(threw), threw);
const ST = require(path.join(ROOT, "lib", "styles.js")), all = ST.read(path.join(ROOT, "styles"), "image");
const eng = A.engines(all.filter((x) => /^(Krea 2 Turbo|FLUX Fill inpaint|Qwen Image Edit 2511)$/.test(x.name)), ROOT);
const ek = eng.inpaint.find((x) => x.name === "Krea 2 Turbo"), ef = eng.inpaint.find((x) => x.name === "FLUX Fill inpaint");
check("engines: Krea 2 is a 'latent' fill (no inpaint training - the editor fills with the edit model); FLUX Fill inpaint is a real inpaint (kept)",
  ek && ek.latent === true && (!ef || ef.latent === false) && eng.edit.some((x) => x.name === "Qwen Image Edit 2511"), { ek, ef });

/* the prompt docker's ▾ Edit */
const base = { genMode: "image", onScreen: true, open: true, aiShown: true, mode: "edit", op: "edit" };
const e1 = PL.actionFor(Object.assign({}, base, { hasSel: true })), e2 = PL.actionFor(Object.assign({}, base, { hasSel: false }));
check("actionFor: ▾ Edit with a selection = the selection (Krita - the rest untouched); without = the selected layer as before",
  e1 && e1.kind === "run" && e1.mode === "edit" && e1.whole === false && e2 && e2.kind === "layer", { e1, e2 });

/* wiring */
const IE = rd("ext", "imageeditdock", "imageedit.js"), RA = rd("routes", "aiedit.js"), PLs = rd("ext", "imageeditdock", "pcpromptlink.js");
check("the editor: 👁 fill with the edit model (on by default, remembered); a real inpaint style is used as it is; the selection painted green for a fill; the request says fill_edit + the edit model + the kind",
  /id="kxSee"/.test(IE) && /S\.fillEdit = store\.get\("fillEdit", true\) !== false/.test(IE) && /fillInfo\.latent !== false && !fillInfo\.helper/.test(IE)
  && /\(kind === "fill" \|\| kind === "expand"\) && cropMask\[i\] >= 252/.test(IE) && /req\.fill_edit = "1"; req\.edit_style_id = editId; req\.fill_kind = mode === "generate" \? \(kind === "add" \? "add" : "generate"\) : mode;/.test(IE));
check("the editor: opt.sel / opt.clip - a layer's own pixels only, its transparent surroundings filled with its colours, the result keeps the layer's outline",
  /if \(!sel && opt\.sel && opt\.sel\.length === S\.w \* S\.h\) sel = Uint8Array\.from\(opt\.sel\)/.test(IE) && /else if \(clip\) \{ P\.fillHole/.test(IE) && /feather: whole \|\| S\.genInto \|\| clip \? 0 : S\.feather/.test(IE)
  && /const am = c && act\.mode === "edit" && !act\.bg \? alphaMask\(c\) : null;/.test(PLs) && /clip: !!am/.test(PLs));
check("the route: fill_edit -> fillEditPlan with the edit style (else the style's own fill), run under the noise mask, no control layers; the answer names it",
  /plan = aiEdit\.fillEditPlan\(es, b, core\.BASE\); style = es;/.test(RA) && /\(plan\.mode === "edit" \|\| plan\.editFill\) && mask && mask\.buffer/.test(RA) && /!plan\.editFill && b\.controls/.test(RA) && /edit_fill: plan\.editFill \|\| null, style_name: style\.name/.test(RA));
console.log(`\n${pass} passed, ${fail} failed`);
console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
process.exit(fail ? 1 : 0);
