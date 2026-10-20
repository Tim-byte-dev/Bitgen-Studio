#!/usr/bin/env node
/* bitGen Studio — 2.549.0 units: ▣ Docker made useful (static/dockgroup.js, floatpanels.js setPerm), Krea 2 listed with
 * the editor open (ieeditonly.js needsEdit), a Generate is a new layer (pcpromptlink.js), Ctrl+G reaches the editor
 * (imageedit.js focus), a dropped picture asks (imageedit.js askDrop).
 * Tim: "krea2 is available when editimagedocker is minimized but not when edit-image docker is open, it should be
 * availaible at all times ... dragging an image onto the canvas from gallery,assets or references should give user option
 * to add as layer or add as new document ... newly created docker is useless ... add another 2 buttons to the new docker
 * titlebar - delete ..., make permanent ... when in image-edit mode a generated image is becoming the canvas instead of a
 * new layer. group layers work from the context menu but not with the shortcut keys". */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const rd = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const G = require(path.join(ROOT, "static", "dockgroup.js"));
const IO = require(path.join(ROOT, "ext", "imageeditdock", "ieeditonly.js"));

check("isGroup: fd-dockers and fd-dockers-N only", G.isGroup("fd-dockers") && G.isGroup("fd-dockers-3") && !G.isGroup("fd-audio") && !G.isGroup(""));
check("btnIdFor: the first keeps tDG, the others tDG_<id>", G.btnIdFor("fd-dockers") === "tDG" && G.btnIdFor("fd-dockers-2") === "tDG_fd-dockers-2");
check("nextGroupId: fd-dockers, then fd-dockers-2, -3 … (a gap is used)", G.nextGroupId([]) === "fd-dockers" && G.nextGroupId(["fd-dockers"]) === "fd-dockers-2" && G.nextGroupId(["fd-dockers", "fd-dockers-3"]) === "fd-dockers-2");
check("dragged: more than 8 px = a drag (a click still folds the docker)", !G.dragged(0, 0, 5, 5) && G.dragged(0, 0, 9, 0));
check("needsEdit: only Edit / Replace background / Compose narrow the style list; Generate / Refine / Fill / Remove list every style (Krea 2)",
  IO.needsEdit("edit") && IO.needsEdit("background") && IO.needsEdit("compose") && !IO.needsEdit("generate") && !IO.needsEdit("refine") && !IO.needsEdit("fill") && !IO.needsEdit("remove") && IO.needsEdit(null));

const DG = rd("static", "dockgroup.js"), FP = rd("static", "floatpanels.js"), IOs = rd("ext", "imageeditdock", "ieeditonly.js"), PL = rd("ext", "imageeditdock", "pcpromptlink.js"), IE = rd("ext", "imageeditdock", "imageedit.js");
check("the ⇱ button has its label (a comment had swallowed `b.type = …; b.textContent = \"⇱\"` in 2.545.0)", /b\.id = "dgFloat_" \+ id; b\.type = "button"; b\.textContent = "⇱";/.test(DG));
check("a main docker's title bar drags in (headDrag: the tag, the orange line, dockInto at the slot, the click after a drag eaten)",
  /function headDrag\(h, id\)/.test(DG) && /headDrag\(h, id\);/.test(DG) && /P\(\)\.dockInto\("bd\." \+ id, over\.id, slot \? slot\.index : undefined\)/.test(DG) && /root\.addEventListener\("click", eat, true\)/.test(DG));
check("📌 / 🗑 in the title bar; Make permanent = a .bdock in #maincol with the regular title bar (▾ name, ⇱, 🗑, ⛶), its statusbar button in H3GoneDocks; restored on load",
  /h3fp-perm/.test(DG) && /h3fp-del/.test(DG) && /d\.className = "bdock dgperm"/.test(DG) && /main\.insertBefore\(d, before\)/.test(DG) && /root\.H3GoneDocks\[btnIdFor\(id\)\] = d\.id/.test(DG) && /if \(r\.perm\) makePerm\(r\.id, true\)/.test(DG));
check("the buttons carry the docker's name (▣ <name>), one per ▣ docker", /const name = r \? r\.title : "Docker", text = "▣ " \+ name;/.test(DG));
check("floatpanels: setPerm (state perm, kept in panel_layout.cfg, no relayout), restored by newDocker",
  /function setPerm\(id, on\)/.test(FP) && /r\.perm \? \{ perm: Object\.assign\(\{\}, r\.perm\) \} : \{\}/.test(FP) && /if \(lay && lay\.perm && typeof lay\.perm === "object"\) r\.perm/.test(FP) && /r\.state !== "float" \|\| r\.perm/.test(FP));
check("ieeditonly: narrows only for the ops that edit; a non-edit style picked on Edit puts the ▾ on Generate", /needsEdit\(opNow\)/.test(IOs) && /root\.H3ImgOp\.set\("generate"\)/.test(IOs));
check("Generate in image-edit mode: no selection = the prompt docker's own Generate (its style) -> a new layer; a selection = the editor fills it as a NEW layer (direct), never blended into the layer",
  /if \(S\.aiMode === "generate" && !\(E\.hasSel && E\.hasSel\(\)\)\) return false;/.test(PL) && /E\.runAI\(\{ prompt: text, editStyle, style: fillStyle, into: false, whole: false, direct: true/.test(PL));
check("Ctrl+G: a press in the editor that is not a box / button gives the canvas the focus", /host\.addEventListener\("pointerdown", \(e\) => \{\s*const t = e\.target;[\s\S]{0,800}stage\.focus\(\{ preventScroll: true \}\)/.test(IE));
check("a dropped picture asks (▦ Add as a layer / 🗋 Open as a new document); Shift = a layer; nothing open = a document",
  /function askDrop\(x, y, name, go\)/.test(IE) && /if \(!S\.w\) return load\(url, name, false\);/.test(IE) && /if \(e\.shiftKey\) return load\(url, name, true\);/.test(IE) && /dropPicture\(e, d\.url, d\.name\)/.test(IE));
console.log(`\n${pass} passed, ${fail} failed`);
console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
process.exit(fail ? 1 : 0);
