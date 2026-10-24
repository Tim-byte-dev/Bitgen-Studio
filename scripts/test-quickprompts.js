#!/usr/bin/env node
/* bitGen Studio — 2.451.0 units: QUICK PROMPTS (lib/quickPrompts.js + routes/quickprompts.js + ext/promptdock/
 * quickprompts.js), Del = delete the layer, the editor's Edit / Generate tabs put the prompt docker into Image. */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const Q = require(path.join(ROOT, "lib", "quickPrompts.js"));
const T = fs.mkdtempSync(path.join(os.tmpdir(), "qp_")); Q.setBase(T);
check("nameOf: the first non-empty line, spaces tidied, 80 characters at most", Q.nameOf("\n\n  A fox   at dawn \nsecond line") === "A fox at dawn" && Q.nameOf("x".repeat(200)).length === 80 && Q.nameOf("") === "");
const a = Q.save("A fox at dawn\nsoft light, 35mm"), b = Q.save("Neon street\nrain"), c = Q.save("A fox at dawn\nhard light");
const l = Q.list();
check("save: kept in <install>/misc/quick_prompts.json (2.591.0), newest first; the same first line = replaced (moved to the top)",
  a.saved && !a.replaced && c.replaced && l.length === 2 && l[0].name === "A fox at dawn" && l[0].text === "A fox at dawn\nhard light" && l[1].name === "Neon street" && fs.existsSync(path.join(T, "misc", "quick_prompts.json")), l);
let threw = ""; try { Q.save("   \n  "); } catch (e) { threw = e.message + e.status; }
check("save: an empty prompt is refused (400)", /empty/.test(threw) && /400$/.test(threw), threw);
check("remove: off the list; an unknown name = nothing", Q.remove("Neon street").removed && !Q.remove("nope").removed && Q.list().length === 1);
const C = require(path.join(ROOT, "ext", "promptdock", "quickprompts.js"));
const html = C.optionsHtml([{ name: "A <fox>", text: "A <fox>\nx" }], null);
check("the dropdown: a heading option, each saved prompt by its first line (escaped), its text as the tip", /⚡ Quick prompts \(1\)/.test(html) && /&lt;fox&gt;/.test(html) && /value="0"/.test(html) && C.nameOf("\n hi \n") === "hi" && /none saved yet/.test(C.optionsHtml([])));
const IX = read("routes", "index.js"), RT = read("routes", "quickprompts.js"), EXT = JSON.parse(read("ext", "promptdock", "ext.json")).scripts, SRV = fs.existsSync(path.join(ROOT, "misc", "server.js")) ? read("misc/server.js") : "";
check("routes: GET /api/quickprompts, POST save / delete - mounted from routes/index.js (not server.js); the prompt docker loads quickprompts.js after promptdock.js",
  /require\("\.\/quickprompts"\)\.mount\(app\)/.test(IX) && /\/api\/quickprompts\/save/.test(RT) && /\/api\/quickprompts\/delete/.test(RT) && !/quickprompts/.test(SRV) && EXT.indexOf("quickprompts.js") === EXT.indexOf("promptdock.js") + 1);
const IE = read("ext", "imageeditdock", "imageedit.js"), PL = read("ext", "imageeditdock", "pcpromptlink.js");
check("Del: no selection = the current layer deleted (a selection: cleared, as before)", /k === "delete"\) \{ if \(hasSel\(\)\) clearSelectionArea\(\); else if \(layer\(\)\) deleteLayer\(\);/.test(IE));
const L = require(path.join(ROOT, "ext", "imageeditdock", "pcpromptlink.js"));
check("the Edit / Generate tab click puts the prompt docker into 🖼 Image (and back on another tab); linked without a picture open; Edit with none says so; the edit model put back if a project's settings changed it",
  /toImageMode\(\); else fromImageMode\(\)/.test(PL) && L.linkedNow({ onScreen: true, open: false, aiShown: true, mode: "edit", genMode: "image" }) && /open a picture to edit first/.test(PL) && /a project's saved settings may have put another style back/.test(PL));
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
