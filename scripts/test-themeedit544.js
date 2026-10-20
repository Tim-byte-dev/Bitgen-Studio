#!/usr/bin/env node
/* bitGen Studio — 2.544.0 units: theme edit mode's "hidden in Expert mode" (static/themeedit.js xhide).
 * Tim: "in theme edit mode, add a checkbox for visibility in expert mode to the properties dialog. this will change the
 * visibility of the element in expert mode but not in basic mode". Pure - no server. */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const T = require(path.join(ROOT, "static", "themeedit.js"));
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
check("cleanRule keeps xhide: true only (not \"yes\" / 1)", JSON.stringify(T.cleanRule({ xhide: true })) === '{"xhide":true}' && JSON.stringify(T.cleanRule({ xhide: "yes" })) === "{}" && JSON.stringify(T.cleanRule({ xhide: 1 })) === "{}");
const css = T.compile({ "#go": { xhide: true } });
check("compile: gone under html.expert (live mode), faint + a blue dashed outline in edit mode; nothing for Basic mode",
  /html\.expert body:not\(\.h3-thedit\) #go:not\(#thEditPanel \*\)\{display:none !important\}/.test(css) && /html\.expert body\.h3-thedit #go[^{]*\{opacity:\.35 !important;outline:1px dashed #2680eb !important\}/.test(css) && !/^body:not/m.test(css), css);
check("...hidden everywhere (hide) wins - no Expert-only rule then", !/html\.expert/.test(T.compile({ "#go": { hide: true, xhide: true } })));
check("the page itself (html / body) is never hidden that way either (2.540.6's guard)", JSON.stringify(T.cleanStyles({ body: { xhide: true, color: "#ffffff" } })) === '{"body":{"color":"#ffffff"}}');
const SRC = fs.readFileSync(path.join(ROOT, "static", "themeedit.js"), "utf8");
check("the Style panel: ☐ hidden in Expert mode beside ☐ hidden, read into the rule", /id="teXHide"\$\{r\.xhide \? " checked" : ""\}>hidden in Expert mode/.test(SRC) && /if \(\$\("teXHide"\) && \$\("teXHide"\)\.checked\) o\.xhide = true;/.test(SRC));
check("Expert mode is html.expert (index.html applyExpert)", /document\.documentElement\.classList\.toggle\("expert", on\)/.test(fs.readFileSync(path.join(ROOT, "static", "index.html"), "utf8")));
console.log(`\n${pass} passed, ${fail} failed`);
console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
process.exit(fail ? 1 : 0);
