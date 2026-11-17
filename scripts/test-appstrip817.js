#!/usr/bin/env node
/* bitGen Studio — 2.817.0: the app strip on the menu bar (static/appstrip.js) - pins.
 * Tim (verbatim): "put the button for this on the top menu-strip as icon only, not in the statusbar, add a separator before
 * and after this group of buttons (editor,mail,spreadsheet,slides) then add (solidcraft and sketcher buttons)". */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n); } };
const A = fs.readFileSync(path.join(ROOT, "static/appstrip.js"), "utf8"), IX = fs.readFileSync(path.join(ROOT, "static/index.html"), "utf8");
check("group 1 = Editor, Mail, Spreadsheet, Slides; group 2 = SolidCraft, Sketcher (by their buttons' ids)", /\["tIE", "🖼", "Image editor"\], \["tX_maildock", "✉", "Mail"\], \["tX_sheetdock", "▦", "Spreadsheet"\], \["tX_slidesdock", "🎞", "Slides"\]/.test(A) && /\["tX_solidcraftdock", "📐", "SolidCraft"\], \["tX_pushpulldock", "📏", "Sketcher"\]/.test(A));
check("separator, group 1, separator, group 2, separator", /'<span class="asep"><\/span><span class="asgrp" id="appGrp1"><\/span><span class="asep"><\/span><span class="asgrp" id="appGrp2"><\/span><span class="asep"><\/span>'/.test(A));
check("the buttons are MOVED (ids kept - GONE_DOCKS, workspaces, layouts work), icon only with the name as the tooltip", /g\.insertBefore\(b, next \|\| null\)/.test(A) && /b\.textContent = icon/.test(A) && /b\.title = name/.test(A));
check("the tip is not a modal note (it blocked the pointer)", !/appNote/.test(A) && /getElementById\("sblog"\)/.test(A));
check("loaded by index.html after remotebtns.js; tIE still declared in the statusbar markup (moved at load)", IX.indexOf('/static/appstrip.js') > IX.indexOf('/static/remotebtns.js') && /<button id="tIE"/.test(IX));
console.log("\nRESULT: " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
