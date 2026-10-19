#!/usr/bin/env node
/* bitGen Studio — 2.443.0 units: EDIT THEME MODE's element styles (static/themeedit.js): the selector / value checks
 * (nothing can break out of its CSS rule), the stylesheet made from the rules, a button's icon split from its words, the
 * ways to aim a rule; themes/<name>.json keeps them (lib/themeStore.js); the wiring. */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const T = require(path.join(ROOT, "static", "themeedit.js"));

check("cleanSel: ids, classes, descendants, attributes, :not() - not braces, lists, at-rules, comments, slashes, unbalanced brackets / quotes",
  T.cleanSel("#tb button.ghost") === "#tb button.ghost" && T.cleanSel('[data-stab="themes"]') === '[data-stab="themes"]' && T.cleanSel("button:not(.on)") === "button:not(.on)"
  && ["a{color:red}", "a,b", "@import x", "a /* x */", "a\\b", "a[x", 'a[x="y]', "", "a</style>"].every((s) => T.cleanSel(s) === ""));
const r = T.cleanRule({ font: "Georgia", size: "18", weight: 650, color: "#FF0000", bg: "url(x)", border: "#0f0", radius: 999, tshadow: { x: 1, y: 2, b: 3, c: "#000000" },
  bshadow: { x: 0, y: 4, b: 10, s: 1, c: "#123456", inset: true }, icon: { text: "★☆★☆★☆★☆★☆", img: "data:image/png;base64,AAAA", pos: "top", size: 24, fill: "#00ff00" }, evil: "x" });
check("cleanRule: each value checked and clamped (weight to a hundred, radius ≤ 200, a background that is not a colour dropped, an icon of 8 characters at most, a picture as a data: URL only, unknown keys dropped)",
  JSON.stringify(r) === JSON.stringify({ font: "Georgia", size: 18, weight: 700, color: "#ff0000", border: "#0f0", radius: 200, tshadow: { x: 1, y: 2, b: 3, c: "#000000" }, bshadow: { x: 0, y: 4, b: 10, c: "#123456", s: 1, inset: true }, icon: { text: "★☆★☆★☆★☆", img: "data:image/png;base64,AAAA", pos: "top", size: 24, fill: "#00ff00" } }), r);
check("...a font with ; or { } is refused; a picture that is not an image data: URL is refused", !T.cleanRule({ font: "x;}body{display:none" }).font && !T.cleanRule({ icon: { img: "javascript:alert(1)" } }).icon && !T.cleanRule({ icon: { img: "data:text/html;base64,AAAA" } }).icon);
const S = T.cleanStyles({ "button.ghost": { size: 14 }, "x{y": { size: 3 }, "#a": {}, "#b": { bogus: 1 } });
check("cleanStyles: only good selectors with something set", JSON.stringify(Object.keys(S)) === '["button.ghost"]');
check("cssStr: everything but letters / digits / spaces escaped (a quote or a brace cannot end the string)", T.cssStr('a"}b') === '"a\\22 \\7d b"' && T.cssStr("★ 1") === '"\\2605  1"');
const css = T.compile({ "button.ghost": { size: 14, color: "#ff0000", tshadow: { x: 1, y: 1, b: 2, c: "#000000" }, bshadow: { x: 0, y: 2, b: 6, s: 0, c: "#111111" }, icon: { text: "★", pos: "right", size: 20, fill: "#00ff00" } } });
check("compile: the rule (!important, never the Style panel itself), the icon's place (flex direction), size, fill (an emoji tinted by text-shadow), its new text",
  css.includes("button.ghost:not(#thEditPanel *){font-size:14px !important;color:#ff0000 !important;text-shadow:1px 1px 2px #000000 !important;box-shadow:0px 2px 6px 0px #111111 !important}")
  && css.includes("flex-direction:row-reverse !important") && /> \.h3ic\{[^}]*color:transparent !important;text-shadow:0 0 0 #00ff00/.test(css) && css.includes('> .h3ic::after{content:"\\2605 ";font-size:20px'), css);
const css2 = T.compile({ "#x": { icon: { img: "data:image/svg+xml;base64,PHN2Zy8+", fill: "#336699", pos: "only" } }, "#y": { icon: { pos: "hide" } } });
check("...a picture icon tinted through a mask; icon only hides the words; hidden hides the icon",
  /#x:not\(#thEditPanel \*\) > \.h3ic::after\{content:"";[^}]*background:#336699;-webkit-mask:url\("data:image\/svg\+xml;base64,PHN2Zy8\+"\)/.test(css2) && css2.includes("#x:not(#thEditPanel *) > .h3lb{display:none !important}") && css2.includes("#y:not(#thEditPanel *) > .h3ic{display:none !important}"), css2);
check("splitIcon: the symbols / emoji before the words, the space kept; none = all words",
  JSON.stringify(T.splitIcon("💾 Save theme")) === JSON.stringify({ lead: "", icon: "💾", gap: " ", label: "Save theme" }) && T.splitIcon("⤓ Export").icon === "⤓" && T.splitIcon("Reset").icon === "" && T.splitIcon("Reset").label === "Reset" && T.splitIcon("⚙").icon === "⚙" && T.splitIcon("+ New").icon === "+");
const sf = T.selectorsFor({ tag: "BUTTON", id: "s_thsave", classes: ["ghost", "on", "h3icon"], panelId: "stab-themes" });
check("selectorsFor: this element (#id), all like it in its panel, all like it (tag + classes, the passing ones like .on left out), every <tag>",
  JSON.stringify(sf.map((o) => o.sel)) === JSON.stringify(["#s_thsave", "#stab-themes button.ghost", "button.ghost", "button"]), sf);

// themes/<name>.json keeps them (cleaned)
const TS = require(path.join(ROOT, "lib", "themeStore.js"));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "thedit-")); TS.setBase(tmp);
const saved = TS.save("Styled", { base: "dark", vars: { ink: "#000000" }, styles: { "button.ghost": { size: 15, icon: { text: "✦", pos: "left" } }, "a{b": { size: 9 } } });
const back = TS.read("Styled");
check("themeStore: a saved theme keeps its element styles (cleaned: the bad selector gone); read back the same", JSON.stringify(Object.keys(saved.styles)) === '["button.ghost"]' && back.styles["button.ghost"].icon.text === "✦" && back.styles["button.ghost"].size === 15, back.styles);
fs.rmSync(tmp, { recursive: true, force: true });

const IDX = read("static", "index.html"), TH = read("static", "themes.js");
check("the wiring: index.html loads themeedit.js in <head> right after themes.js (the styles before the page paints); a theme's snapshot carries the styles, loading one sets them",
  IDX.indexOf('<script src="/static/themeedit.js">') > IDX.indexOf('<script src="/static/themes.js">') && IDX.indexOf('<script src="/static/themeedit.js">') < IDX.indexOf("</head>")
  && /styles = root\.H3ThemeEdit \? root\.H3ThemeEdit\.styles\(\) : \{\}/.test(TH) && /root\.H3ThemeEdit\.setStyles\(rec && rec\.styles \? rec\.styles : \{\}\)/.test(TH));
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
