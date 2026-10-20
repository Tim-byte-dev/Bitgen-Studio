#!/usr/bin/env node
/* bitGen Studio — 2.546.0 units: a Blender / 3D scene + the References docker's pictures in one edit (lib/refWords.js,
 * pcblendlayer.js), the model's own word for its pictures, the Blender view's zoom and no player / Auto-key in the image
 * editor (blendview.js wiring).
 * Tim: "allow user to use reference images from reference docker when generating an image from a blender scene when in
 * image-edit docker, for example photo real blonde woman on a beach with face of woman in picture 1.if model needs image 1
 * instead of picture 1 change automatically to image n. add zoom in and zoom out controls for blender - alt+drag foward =
 * zoom in,alt+drag back=zoom out, add a zoom to object button. remove auto key and media player from image-edit mode". */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const rd = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const W = require(path.join(ROOT, "lib", "refWords.js"));
const B = require(path.join(ROOT, "ext", "imageeditdock", "pcblendlayer.js"));
const A = require(path.join(ROOT, "lib", "aiEdit.js"));

check("the model's word: Qwen 2511 \"Picture 2\", FLUX.2 / FLUX 3 Klein \"image 2\", Qwen 2.1 \"<image2>\"", W.tag(2, "picture") === "Picture 2" && W.tag(2, "image") === "image 2" && W.tag(2, "qwen21") === "<image2>");
check("wordingFor: a Klein workflow / model = image; Qwen 2511 = picture",
  W.wordingFor({ engine: "comfy", workflow: "comfy_workflows/flux2_klein_9b_edit.json" }) === "image" && W.wordingFor({ engine: "comfy", model: "flux-2-klein-4b.safetensors" }) === "image"
  && W.wordingFor({ engine: "comfy", workflow: "comfy_workflows/qwen_image_edit_2511.json" }) === "picture" && W.wordingFor(null) === "picture");
const T = "photo real blonde woman on a beach with face of woman in picture 1";
check("mentions: picture / image / img / pic / photo / ref / reference N, #N, <Picture N>, <imageN> - in order, once each; \"photo real\" is not one",
  JSON.stringify(W.mentions(T)) === "[1]" && JSON.stringify(W.mentions("the dress from Image 3, pic 2, <Picture 1>, <image3>, ref #2, reference 4, img 5")) === "[3,2,1,4,5]" && W.mentions("a photo real look").length === 0);
check("pickRefs: named = the ones named that the docker has (at most 2); always = + the first ones; never = none",
  JSON.stringify(W.pickRefs("picture 3 and picture 9", 4, 2, "named")) === "[3]" && JSON.stringify(W.pickRefs("x", 4, 2, "named")) === "[]" && JSON.stringify(W.pickRefs("x", 4, 2, "always")) === "[1,2]"
  && JSON.stringify(W.pickRefs("pic 3", 4, 2, "always")) === "[3,1]" && W.pickRefs(T, 4, 2, "never").length === 0 && W.pickRefs(T, 0, 2, "always").length === 0 && JSON.stringify(W.pickRefs("p1 picture 1 picture 2 picture 3", 3, 2, "named")) === "[1,2]");
const P1 = W.sceneRefsPrompt(T, [1], "image", ["a blonde woman"]);
check("Tim's example for a Klein model: the scene is image 1, \"picture 1\" (the References docker's) becomes image 2, a first line says which is which",
  P1 === "image 1 is the 3D scene - keep its layout, camera angle, poses and composition; image 2 is a reference picture (a blonde woman).\nphoto real blonde woman on a beach with face of woman in image 2", P1);
const P2 = W.sceneRefsPrompt("the dog from picture 3 beside the cat in picture 1, not picture 2", [3, 1], "qwen21", []);
check("two references in the order named (3 then 1) -> <image2>, <image3>; one not sent (picture 2) is left as written",
  P2.split("\n")[1] === "the dog from <image2> beside the cat in <image3>, not picture 2" && /^<image1> is the 3D scene/.test(P2) && /<image3> is a reference picture\./.test(P2), P2);
check("Qwen 2511 keeps Picture N; no references = the prompt as typed", /Picture 2/.test(W.sceneRefsPrompt("face in image 1", [1], "picture")) && W.sceneRefsPrompt("x", [], "image") === "x");
check("retag: only the word (\"picture 2\" -> \"image 2\" / \"<image2>\" / \"Picture 2\")", W.retag("the hat in picture 2 and <Picture 1>", "image") === "the hat in image 2 and image 1" && W.retag("image 3", "qwen21") === "<image3>" && W.retag("Image 1", "picture") === "Picture 1");
check("compose / reference prompts speak the model's word too (aiEdit composePrompt / refPrompt take the wording)",
  /^image 1 is the scene/.test(A.composePrompt("x", ["A", "B"], "image")) && /^Picture 1 is the scene/.test(A.composePrompt("x", ["A", "B"], false)) && /^<image1> is the scene/.test(A.composePrompt("x", ["A"], true))
  && /^image 1 is the scene; image 2 is a reference/.test(A.refPrompt("x", "", "image")) && /^Picture 1 is the scene; Picture 2/.test(A.refPrompt("x", "", false)));
const S = ["face of woman in picture 1", "pic 2 and Image 3, <image1>", "photo real hair, ref #2", "nothing", "reference 12 and photos 4"];
check("the page's picker (pcblendlayer) finds the same numbers as the server's", S.every((t) => JSON.stringify(B.mentions(t)) === JSON.stringify(W.mentions(t)))
  && JSON.stringify(B.pickRefs("pic 3", 4, 2, "always")) === JSON.stringify(W.pickRefs("pic 3", 4, 2, "always")) && B.ruleOf("zz") === "named" && B.RULES.map((r) => r[0]).join() === "named,always,never");

const RT = rd("routes", "aiedit.js"), MT = rd("ext", "imageeditdock", "mount.js"), IE = rd("ext", "imageeditdock", "imageedit.js"), BL = rd("ext", "imageeditdock", "pcblendlayer.js"), C3 = rd("ext", "imageeditdock", "pc3d.js"), BV = rd("ext", "timelinedock", "blendview.js");
check("the route: scene_refs -> sceneRefsPrompt in the model's word; otherwise compose with the typed text re-worded",
  /const refWords = require\("\.\.\/lib\/refWords"\)/.test(RT) && /refWords\.sceneRefsPrompt\(typed, sceneRefs, wording, names\.slice\(1\)\)/.test(RT) && /aiEdit\.composePrompt\(refWords\.retag\(typed, wording\)/.test(RT) && /refWords\.wordingFor\(style, core\.BASE\)/.test(RT));
check("the page: compose sends scene_refs; runCompose takes pictures (opt.pics) + a label; Edit from a Blender layer / a 3D layer goes through E.sceneRefs first",
  /fd\.append\("scene_refs"/.test(MT) && /const given = Array\.isArray\(opt\.pics\)/.test(IE) && /scene_refs: opt\.sceneRefs \|\| undefined/.test(IE)
  && /if \(mode === "edit" && await sceneWithRefs\(c, t, editStyle, L,/.test(BL) && /E\.sceneRefs\.run\(c, t, editStyle, L,/.test(C3) && /id="kblRefs"/.test(BL));
check("blendview: 🔍＋ 🔍－ ⌖, Alt+drag caught before the orbit (capture), Z = zoom to object, lent = no player (CSS .ext), no Auto-key row / keys, no Space play",
  /id="tlbZoomIn"/.test(BV) && /id="tlbZoomObj"/.test(BV) && /\$\("tlbStage"\)\.addEventListener\("pointerdown", function \(ev\) \{\s*if \(!ev\.altKey/.test(BV) && /zoomBy\(Math\.exp\(dy \* 0\.006\)\)/.test(BV)
  && /k === "z" && !ev\.ctrlKey/.test(BV) && /#tlBlendView\.ext #tlbBar\{display:none\}/.test(BV) && /if \(!ext\) h \+= '<div class="tlp-row"><label title="Every move keys/.test(BV) && /\(S\.autoKey && !ext\)/.test(BV) && /k === " " && !ext/.test(BV) && /\n\s+trs: function \(id\)/.test(BV));
console.log(`\n${pass} passed, ${fail} failed`);
console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
process.exit(fail ? 1 : 0);
