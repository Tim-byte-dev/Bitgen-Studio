#!/usr/bin/env node
/* bitGen Studio — 2.540.6: theme edit mode never sizes, moves or hides the page itself.
 * Tim: "when i try to edit the theme by dragging the handles the entire ui gets dragged to the left" / "the ui breaks
 * when i try to resize anything". A rule for html / body / :root / * keeps its colours but loses w / h / dx / dy / hide -
 * when it is set, when the styles are cleaned (so a theme or this browser's storage that already holds one heals on
 * load) and when a theme is saved (lib/themeStore.js uses cleanStyles). Pure - no server. */
"use strict";
const path = require("path"), fs = require("fs");
const ROOT = path.join(__dirname, "..");
const T = require(path.join(ROOT, "static", "themeedit.js"));
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const page = ["html", "body", ":root", "*", "html.dark", "body#x", "#app > *", "#a body", "BODY"];
const not = ["#app", ".body", "div", "#body", "button.html", "#x .y", "#mainArea"];
check("isRootSel: the page itself (html, body, :root, *, …)", page.every((s) => T.isRootSel(s)), page.map((s) => [s, T.isRootSel(s)]));
check("…but not an element, a class called body, or a container like #app", not.every((s) => !T.isRootSel(s)), not.map((s) => [s, T.isRootSel(s)]));
const c = T.cleanStyles({ html: { w: 4, dx: 331, dy: 20, bg: "#101010" }, body: { dx: -391, hide: true }, "#projBgp": { w: 335, dx: -300 } });
check("cleanStyles: html keeps its colour, loses its size / move; body with only a move is dropped; an element keeps its size and move",
  JSON.stringify(c) === JSON.stringify({ html: { bg: "#101010" }, "#projBgp": { w: 335, dx: -300 } }), c);
check("compile: no width / translate on html or body", !/(^|\n)(html|body)[^{]*\{[^}]*(width|translate|display:none)/.test(T.compile({ html: { w: 4, dx: 9, color: "#ffffff" }, body: { h: 9 } })), T.compile({ html: { w: 4, dx: 9, color: "#ffffff" } }));
const src = fs.readFileSync(path.join(ROOT, "static", "themeedit.js"), "utf8");
check("the page: the release of a handle drag always ends it (block() calls sizing), the handle captures the pointer, the click after a drag is not a pick, the page itself is never picked, nothing is left scrolled",
  /if \(e\.type === "pointerup" && sizing\) \{ sizing\(\); return; \}/.test(src) && /setPointerCapture\(e\.pointerId\)/.test(src) && /if \(sized\) swallowClick = true/.test(src)
  && /if \(isPage\(e\.target\)\) return;/.test(src) && /function unscroll\(\)/.test(src) && /if \(e\.type === "pointerdown"\) swallowClick = false;/.test(src));
const EM = fs.readFileSync(path.join(ROOT, "electron", "main.js"), "utf8");
check("the desktop app: Ctrl+Shift+R reloads without the cache (before-input-event - the frameless window has no menu)", /before-input-event/.test(EM) && /k\.shift && !k\.alt && String\(k\.key \|\| ""\)\.toLowerCase\(\) === "r"/.test(EM) && /reloadIgnoringCache\(\)/.test(EM));
const TS = fs.readFileSync(path.join(ROOT, "lib", "themeStore.js"), "utf8");
check("lib/themeStore.js cleans a saved theme's styles with the same cleanStyles", /cleanStyles/.test(TS));
console.log(`\n${pass} passed, ${fail} failed`);
console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
process.exit(fail ? 1 : 0);
