#!/usr/bin/env node
// bitGen Studio 2.917.0 - the prompt docker's ▾ Edit / Compose with the image editor CLOSED takes the References docker's pictures
// (Tim: "for the desktop app, when the image-editor is closed and prompt docker is in edit mode, use the reference images as the
// images to edit/compose"). Run: node scripts/test-917.js
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let P = 0, F = 0;
const check = (n, ok, got) => { if (ok) { P++; console.log("PASS:", n); } else { F++; console.log("FAIL:", n, got === undefined ? "" : JSON.stringify(got).slice(0, 400)); } };
const src = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

const L = require("../ext/imageeditdock/pcpromptlink.js");
const A = (s) => L.actionFor(Object.assign({ genMode: "image", onScreen: false, open: false, refs: 0 }, s));
check("closed + ✏ Edit + 1 reference = edit it; 2 = compose; ▾ Compose + 1 = compose",
  A({ op: "edit", refs: 1 }).kind === "refs" && A({ op: "edit", refs: 1 }).mode === "edit" && A({ op: "edit", refs: 2 }).mode === "compose" && A({ op: "compose", refs: 1 }).mode === "compose");
check("closed + no references = it says so", A({ op: "edit" }).kind === "say");
const o = (s) => A(Object.assign({ onScreen: true }, s));
check("on screen, NO picture open + references = the references too (Edit / Compose / Refine / background)",
  o({ op: "edit", refs: 1 }).kind === "refs" && o({ op: "compose", refs: 2 }).mode === "compose" && o({ op: "refine", refs: 1 }).mode === "refine" && o({ op: "background", refs: 1 }).bg === true);
check("…Fill / Remove still need a picture; no references = \"open a picture\" as before",
  o({ op: "fill", refs: 1 }).kind === "say" && o({ op: "remove", refs: 1 }).kind === "say" && o({ op: "edit" }).kind === "say");
check("a picture open = the editor's layer, not the references", o({ op: "edit", open: true, refs: 2 }).kind === "layer");
const I = require("../ext/imageeditdock/pcimgop.js");
check("the chip: closed or no picture open = 🖼 N reference(s)", I.sourceText({ op: "edit", editorOn: false, refs: 2 }) === "🖼 2 references"
  && I.sourceText({ op: "edit", editorOn: true, open: false, refs: 1 }) === "🖼 1 reference" && I.sourceText({ op: "fill", editorOn: true, open: false, refs: 1 }) === "");
const m = src("ext/imageeditdock/mount.js");
check("ieOnScreen: + 👁 off, a hidden workspace part / docker group, not drawn at all", /classList\.contains\("dockoff"\)/.test(m) && /closest\("\.dockoff,\.ws-hide,\.dockgone"\)/.test(m) && /getClientRects\(\)\.length > 0/.test(m));
check("ieeditonly asks the same ieOnScreen", /root\.ieOnScreen\(\)/.test(src("ext/imageeditdock/ieeditonly.js")));
console.log(`RESULT: ${P} passed, ${F} failed`);
process.exit(F ? 1 : 0);
