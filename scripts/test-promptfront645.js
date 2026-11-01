#!/usr/bin/env node
/* bitGen Studio — 2.645.0: Ctrl+P BRINGS THE PROMPT DOCKER TO THE FRONT (static/promptfront.js) - the key test (pure) + the
 * wiring. The real presses: scripts/test-ui645-ui.js. */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 500))); } };

const SRC = read("static/promptfront.js");
const root = { document: { getElementById: () => null, body: { classList: { contains: () => false } }, querySelector: () => null }, addEventListener() {}, setInterval() {}, getComputedStyle: () => ({}) };
new Function("window", "globalThis", SRC.replace(/\(typeof window !== "undefined" \? window : globalThis\)\s*;?\s*$/, "(window);"))(root, root);
const F = root.H3PromptFront;
check("H3PromptFront loads (front, isKey, coveredBy, unlift)", F && ["front", "isKey", "coveredBy", "unlift"].every((k) => typeof F[k] === "function"));
check("isKey: Ctrl+P, Cmd+P, a layout where P is another letter (code KeyP)", [{ ctrlKey: true, key: "p" }, { ctrlKey: true, key: "P" }, { metaKey: true, key: "p" }, { ctrlKey: true, key: "з", code: "KeyP" }].every((e) => F.isKey(e)));
check("…not Ctrl+Shift+P (the image editor's Print), Ctrl+Alt+P (AltGr), P alone, nothing", ![{ ctrlKey: true, shiftKey: true, key: "P" }, { ctrlKey: true, altKey: true, key: "p" }, { key: "p" }, null].some((e) => F.isKey(e)));
check("lifted over a maximized docker (the Sketcher's 9000) - under menus / dialogs", F.FRONT_Z > 9000 && F.FRONT_Z < 10000);
check("the key is caught first (capture) - never the browser's print; a modal dialog left alone; over 🎨 Artist mode's canvas (2.646.0)",
  /root\.addEventListener\("keydown", \(e\) => \{[\s\S]*?\}, true\);/.test(SRC) && /ie-focus/.test(SRC) && /matches\(":modal"\)/.test(SRC) && /e\.preventDefault\(\)/.test(SRC));
check("front(): closed -> opened, folded -> unfolded, a closed ▣ docker shown + its tab, covered -> lifted (after layout), focused",
  /toggleDockGone\("promptdock", "tP"\)/.test(SRC) && /toggleCollapse\("promptdock"\)/.test(SRC) && /G\.toggle\(true, rec\.docker\)/.test(SRC) && /\.h3fd-tab\[data-t="pf\.promptdock"\]/.test(SRC) && /requestAnimationFrame/.test(SRC) && /b\.focus\(/.test(SRC));
check("the lift ends when nothing covers it any more", /setInterval\(\(\) => \{\s*if \(!lifted\) return;/.test(SRC) && /if \(!still\) unlift\(\);/.test(SRC));
const H = read("static/index.html"), FP = read("ext/imageeditdock/pcfileplus.js"), SC = JSON.parse(read("docs/shortcuts.json"));
check("loaded by the page", /<script src="\/static\/promptfront\.js"><\/script>/.test(H));
check("the image editor's File ▸ Print moved to Ctrl+Shift+P", /C\("file\.print", "Print…", "Shift\+Ctrl\+P"/.test(FP));
const any = SC.groups.find((g) => g.title === "Anywhere in the app");
check("the shortcut list: Ctrl+P under Anywhere in the app", any && any.rows.some(([k, v]) => k === "Ctrl+P" && /prompt docker to the front/.test(v)));

console.log(`\n${pass} passed, ${fail} failed`);
console.log("RESULT: " + fail + " failed");
process.exit(fail ? 1 : 0);
