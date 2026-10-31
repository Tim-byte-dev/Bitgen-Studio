#!/usr/bin/env node
/* bitGen Studio — 2.455.0 units: EDIT THEME MODE LEAVES DIALOGS / MENUS WORKING (static/themeedit.js DIALOG_SEL). */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const T = require(path.join(ROOT, "static", "themeedit.js")), SRC = fs.readFileSync(path.join(ROOT, "static", "themeedit.js"), "utf8");
const S = T.DIALOG_SEL || "";
check("DIALOG_SEL: <dialog>, every *dlg box (the editor's .kxdlg, the file dialog .fdlg, Liquify …), role=dialog except the floating dockers (.h3fp), the popup menus",
  ["dialog[open]", '[class*="dlg"]', '[role="dialog"]:not(.h3fp)', ".kxmenu", ".h3fp-menu", ".fd-menu", '[role="menu"]'].every((x) => S.includes(x)), S);
check("theme edit mode treats them as its own: no outline, their clicks / keys reach them, never picked; Esc inside one is the dialog's",
  /: el\.closest\(DIALOG_SEL\)\)\)\);   \/\/ 2\.455\.0/.test(SRC) && /t\.closest\("#thEditPanel"\) \|\| t\.closest\("#thExitBox"\) \|\| (t\.closest\("#thInline"\) \|\| )?\(!dlgs && t\.closest\(DIALOG_SEL\)\)/.test(SRC) && /DIALOG_SEL, cleanSel/.test(SRC));
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
