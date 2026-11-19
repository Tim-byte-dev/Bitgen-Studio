#!/usr/bin/env node
/* bitGen Studio — 2.864.0 units: the Web editor's </> Code tab as a code editor (ext/webdock/wbcode.js): tags found past comments, PHP,
 * the doctype and script / style text; not-closed and stray tags (soft for those HTML lets stay open); the colours for HTML / CSS / JS /
 * PHP (all text escaped); quick tags wrapping the selection, quick comments, ⌗ comment / uncomment lines; the wiring. */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const C = require(path.join(ROOT, "ext/webdock/wbcode.js")), src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const t = '<!DOCTYPE html>\n<!-- <div> in a comment -->\n<div class="a">\n <p>hi\n <section><span>x</span>\n<?php if ($a < 3) { echo "<b>"; } ?>\n<script>if (a < b) { x = "<div>"; }</script>\n</div>\n</em>\n<img src="x"><br/><input>';
const P = C.problems(t).map((p) => [p.name, p.kind, p.soft, C.lineOf(t, p.at)]);
check("not closed: <section> (red) and <p> (soft - HTML lets it stay open), a stray </em>; nothing from the comment, PHP, script text or void tags", JSON.stringify(P) === JSON.stringify([["p", "open", true, 4], ["section", "open", false, 5], ["em", "stray", false, 9]]), P);
check("a clean page: no problems", C.problems('<html><body><ul><li>a</li></ul><a href="x>y">z</a></body></html>').length === 0);
const h = C.highlight('<a href="x" data-on>t & u</a><!-- c --><?php echo $x; ?><style>b { color: red; }</style>', "html");
check("colours: tag names, attribute names + values, comments, PHP (its variable + keyword), CSS inside <style>; the text escaped", /<span class="ht">a<\/span>/.test(h) && /<span class="hn">href<\/span>=<span class="hv">"x"<\/span>/.test(h) && /<span class="hn">data-on<\/span>/.test(h) && /t &amp; u/.test(h) && /<span class="hc">&lt;!-- c --&gt;<\/span>/.test(h) && /class="hphp"/.test(h) && /<span class="hk">echo<\/span>/.test(h) && /<span class="hn">color<\/span>/.test(h), h);
const bad = C.problems("<div><span>x</div>"), hb = C.highlight("<div><span>x</div>", "html", bad);
check("...a tag not closed marked (red, 'not closed') in the colours", /class="hbad" title="not closed"><span class="hp">&lt;<\/span><span class="ht">span/.test(hb), hb);
check("...a <script> injected as text can not run: everything escaped", !/<script>/.test(C.highlight('<p>"<script>alert(1)</script>"</p>', "html")) && !/<img/.test(C.highlight("x <img src=x onerror=alert(1)>", "css")));
const js = C.highlight("const a = 'x'; // note\nreturn 3;", "js");
check("JS: keywords, strings, numbers, comments", /<span class="hk">const<\/span>/.test(js) && /<span class="hv">'x'<\/span>/.test(js) && /<span class="hc">\/\/ note<\/span>/.test(js) && /<span class="hm">3<\/span>/.test(js), js);
check("quick tags wrap the selection (the selection kept inside); a link / picture / list come with their parts", JSON.stringify(C.wrap("say hello", 4, 9, "strong")) === JSON.stringify({ text: "say <strong>hello</strong>", a: 12, b: 17 }) && /^<a href="">x<\/a>$/.test(C.wrap("x", 0, 1, "a").text) && C.wrap("", 0, 0, "img").text === '<img src="images/" alt="">' && /<ul>\n  <li>a<\/li>\n<\/ul>/.test(C.wrap("a", 0, 1, "ul").text));
check("quick comments: <!-- --> in HTML, /* */ in CSS, // in JS, a TODO in each", C.comment("x", 0, 1, "html", "block").text === "<!-- x -->" && C.comment("x", 0, 1, "css", "block").text === "/* x */" && C.comment("x", 0, 1, "js", "line").text === "// x" && C.comment("", 0, 0, "css", "todo").text === "/* TODO:  */");
const t1 = C.toggle("a\n  b\nc", 0, 4, "js"), t2 = C.toggle(t1.text, 0, t1.b, "js"), th = C.toggle("<p>x</p>", 0, 3, "html");
check("⌗ comments the selected lines (indent kept), again = back as they were; HTML lines get <!-- -->", t1.text === "// a\n  // b\nc" && t2.text === "a\n  b\nc" && th.text === "<!-- <p>x</p> -->", [t1, t2, th]);
check("the kind by the file: .css / .js / .php / .html", C.kindOf("css/a.css") === "css" && C.kindOf("js/x.js") === "js" && C.kindOf("a.php") === "php" && C.kindOf("index.html") === "html");
const D = src("ext/webdock/dock.html"), J = src("ext/webdock/webdock.js"), E = JSON.parse(src("ext/webdock/ext.json"));
check("wiring: wbcode.js loaded after webdock.js; paintCode refreshes it; the editor's styles (line numbers, the coloured copy under a see-through textarea, red / orange marks)", E.scripts.indexOf("wbcode.js") > E.scripts.indexOf("webdock.js") && /root\.WbCode\.refresh\(\)/.test(J) && /#wbCodeNo/.test(D) && /#wbCodeIn #wbCode \{[^}]*color: transparent; caret-color/.test(D) && /\.hbad/.test(D) && /\.hwarn/.test(D));
console.log(`\nRESULT: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
