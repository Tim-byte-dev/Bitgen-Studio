#!/usr/bin/env node
/* bitGen Studio — 2.556.0 units: ⏳ Pending (ext/imageeditdock/pcpending.js), the References docker in every ✨ mode
 * (imageedit.js P.refMentions / pickRefNums / composeRefNums, lib/refWords.js withRefs, lib/aiEdit.js fillEditPlan refine,
 * routes/aiedit.js ref0 + ref1), and the editor's settings reaching the server (mount.js).
 * Tim: "allow user to add multiple generations, edits, refine, fills, etc to queue ... call it pending ... check to see if
 * the reference images can still be used in generate, edit, fill, refine, compose modes". */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const rd = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const PP = require(path.join(ROOT, "ext", "imageeditdock", "pcpending.js"));
const RW = require(path.join(ROOT, "lib", "refWords.js"));
const A = require(path.join(ROOT, "lib", "aiEdit.js"));
const ST = require(path.join(ROOT, "lib", "styles.js"));
const IE = rd("ext", "imageeditdock", "imageedit.js");
const P = new Function("P", IE.slice(IE.indexOf("P.refMentions = function"), IE.indexOf("P.contextRect = function")) + "; return P;")({});

/* 1 Pending */
const layers = [{ id: 1, name: "Background", type: "pixel", parent: null }, { id: 2, name: "✨ changes: Background", type: "group", changesOf: 1, parent: null },
  { id: 3, name: "result", type: "pixel", parent: 2 }, { id: 4, name: "Sky", type: "pixel", parent: null }];
const g1 = PP.groupFor(layers, 1), g3 = PP.groupFor(layers, 3), g2 = PP.groupFor(layers, 2), g4 = PP.groupFor(layers, 4), g9 = PP.groupFor(layers, 9);
check("groupFor: a layer -> its own changes group (one per layer); a result inside it / the group itself -> the same group and owner; a layer with none yet -> make one; gone -> nothing",
  g1.owner.id === 1 && g1.group.id === 2 && g3.owner.id === 1 && g3.group.id === 2 && g2.owner.id === 1 && g2.group.id === 2 && g4.owner.id === 4 && g4.group === null && g9.owner === null);
const c1 = PP.clampPos({ x: 5000, y: 5000 }, { w: 262, h: 300 }, { w: 1200, h: 800 }), c2 = PP.clampPos({ x: -50, y: -9 }, { w: 262, h: 300 }, { w: 1200, h: 800 });
check("clampPos: kept inside the editor (its title always reachable)", c1.x === 938 && c1.y === 760 && c2.x === 0 && c2.y === 0, { c1, c2 });
check("caption: the mode / label, n of m, the prompt cut", PP.caption({ mode: "generate", prompt: "a red ball", n: 1, of: 2 }) === "✨ Generate 1/2: a red ball" && PP.caption({ mode: "edit", label: "🟧 scene edit", prompt: "x".repeat(80) }).endsWith("…"));
const PS = rd("ext", "imageeditdock", "pcpending.js");
check("apply: a new layer above the target inside ONE \"✨ changes: <layer>\" group (D.insert above, then into it), one structOp; a shape fill still goes into its shape",
  /group = E\.makeLayer\(`✨ changes: \$\{owner\.name\}`, S\.w, S\.h, "group"\); group\.changesOf = owner\.id;/.test(PS) && /S\.layers = D\.insert\(S\.layers, group, owner\.id, false\);/.test(PS)
  && /S\.layers = D\.insert\(S\.layers, L, group\.id, true\);/.test(PS) && /E\.structOp\("apply AI result"/.test(PS) && /win\.PCGenFill\.placeOnto\(E, L, T0, into\.how\)/.test(PS) && /kx\.appendChild\(box\)/.test(PS));
check("runAI / runCompose queue into Pending (never 'still working'), keep the target layer, each result a card; ext.json loads pcpending before imageedit.js",
  /if \(S\.busy && !\(E\.pending && !E\.pending\.auto\)\) return say/.test(IE) && /const pend = !!\(E\.pending && !E\.pending\.auto\);/.test(IE) && /E\.pending\.add\(\{ (job: j\.id, )?seed: j\.seed, mode, prompt/.test(IE)
  && /E\.pending\.ready\(its\[i\], resultLayer\(await imgOf\(url\), ctxInfo\)\)/.test(IE) && /E\.pending\.add\(\{ (job: j\.id, )?seed: j\.seed, mode: "compose"/.test(IE)
  && JSON.parse(rd("ext", "imageeditdock", "ext.json")).scripts.indexOf("pcpending.js") === JSON.parse(rd("ext", "imageeditdock", "ext.json")).scripts.indexOf("imageedit.js") - 1);

/* 2 references */
check("the ↳ reference dropdown keeps 2.539.0's meaning (that picture = Picture 2, the prompt as written); else the docker numbers named",
  /const refNums = refLegacy \? \[kxr\] : refsAll\.length \? P\.pickRefNums\(typed0, refsAll\.length, 2, 0\) : \[\];/.test(IE) && /if \(refLegacy\) req\.ref_nums = \[\];/.test(IE));
check("refMentions / pickRefNums: the docker numbers named (picture / image / pic / ref, <Picture n>), only those that exist, + the dropdown's, at most 2",
  P.refMentions("face of picture 1, hat from image 3, <Picture 2>").join() === "1,3,2" && P.pickRefNums("picture 1 and picture 7", 3, 2, 3).join() === "1,3"
  && P.pickRefNums("no mention", 3, 2, 2).join() === "2" && P.pickRefNums("picture 1 picture 2 picture 3", 3, 2, 0).join() === "1,2");
check("composeRefNums: only \"ref N\" / \"reference N\" (\"picture N\" is a picked layer in Compose)", P.composeRefNums("the dog from picture 2 with ref 1 and reference 3", 2).join() === "1");
const w1 = RW.withRefs("a hat like picture 3 on a chair like picture 5", [3, 5], "picture", ["a red hat", "a wooden chair"]);
check("refWords.withRefs: picture 1 = the picture to change, the docker's 3 / 5 become the model's Picture 2 / 3 (with their descriptions); FLUX.2 says image n; the 3D scene line unchanged",
  /^Picture 1 is the picture to change - keep everything the instruction does not change; Picture 2 is a reference picture \(a red hat\); Picture 3 is a reference picture \(a wooden chair\)\.\na hat like Picture 2 on a chair like Picture 3$/.test(w1)
  && /image 2/.test(RW.withRefs("like picture 1", [1], "image", [])) && /^Picture 1 is the 3D scene/.test(RW.sceneRefsPrompt("x picture 1", [1], "picture", [])), w1);
const qwen = ST.read(path.join(ROOT, "styles"), "image").find((s) => s.name === "Qwen Image Edit 2511");
const rf = A.fillEditPlan(qwen, { mode: "refine", prompt: "like picture 1", strength: "40", fill_kind: "refine" }, ROOT);
check("fillEditPlan refine: the prompt as written at the Refine strength through the edit graph", rf.mode === "refine" && rf.denoise === 0.4 && rf.prompt === "like picture 1" && rf.editFill === "refine", rf);
const cp = A.composePlan(qwen, 3, ROOT);
check("composePlan(edit style, 3): Qwen Image Edit 2511 gets two more picture slots (the crop + two references)", cp.slots === 3 && cp.graph && Object.values(cp.graph).filter((n) => /LoadImage/.test(n.class_type)).length === 3);
const RA = rd("routes", "aiedit.js"), MT = rd("ext", "imageeditdock", "mount.js");
check("route: ref0 + ref1 + ref_nums + ref_descs; with an Edit or a run through the edit model (Refine too); composePlan(1 + n); the prompt renumbered (withRefs); images [crop, mask, refs…]",
  /\{ name: "ref1", maxCount: 1 \}/.test(RA) && /aiEdit\.composePlan\(style, 1 \+ nr, core\.BASE\)/.test(RA) && /refWords\.withRefs\(plan\.prompt, refNums, wording, refDescs\)/.test(RA)
  && /\(b\.mode !== "refine" \|\| refFiles\.length\)/.test(RA) && /editMask \? \[names\.crop, names\.mask\]\.concat\(names\.refs\)/.test(RA));
check("mount.js: the editor's settings now reach the server (mask_grow, mask_feather, whole, fill_edit, edit_style_id, fill_kind) + the references (ref0.., ref_nums, ref_descs)",
  /for \(const k of \["mask_grow", "mask_feather", "whole", "fill_edit", "edit_style_id", "fill_kind"(, "live", "live_id", "live_steps", "seed")?\]\)/.test(MT) && /fd\.append\(`ref\$\{i\}`, b, `ref\$\{i\}\.png`\)/.test(MT) && /fd\.append\("ref_nums"/.test(MT));
check("editor: references named with Generate / Fill / Remove / Background / Refine go through the edit model (wantRefs); without an edit model their descriptions go in the prompt; Compose adds \"Ref N\"",
  /\|\| \(wantRefs && \(mode === "generate" \|\| mode === "remove" \|\| mode === "background" \|\| mode === "refine"\)\)/.test(IE) && /its description goes in the prompt instead/.test(IE) && /refNames\.push\(`Ref \$\{n\}`\)/.test(IE));
console.log(`\n${pass} passed, ${fail} failed`);
console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
process.exit(fail ? 1 : 0);
