#!/usr/bin/env node
/* bitGen Studio — 2.426.0 units: THE CHARACTER AND PARAGRAPH PANELS' LAYOUT (pctype.js) + the wiring
 *   1. wants / owns (which texts this layout draws), small caps runs, the em stand-in measure
 *   2. wrapping: words, long words broken, hyphenation
 *   3. the layout: point text (alignment round x, indents), paragraph text (the box, wrapping, justified lines and
 *      their last line, indents, space before / after, the hidden overflow), scales / tracking in the widths
 *   4. styles: pick / matches; Image Size scaling
 *   5. the wiring: ext.json, pcdoc (draw / box), pctext (its straight block), pcui (tabs, layers -> panels), imageedit
 *      (the tabs, the install), pctools (Image Size, the paragraph textarea), the commands
 * Tim: "continue with the photoshop gap closure" - the agreed order: 2.426.0 Character / Paragraph panels + styles. */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const P = require(path.join(ROOT, "ext", "imageeditdock", "pctype.js"));
const near = (a, b, e) => Math.abs(a - b) <= (e == null ? 1e-6 : e);

/* ---- 1 */
check("wants: plain text no; any panel setting yes (scales, baseline, faux, small caps, super / sub, justify, indents, spacing, a box, kerning off)",
  !P.wants({ str: "a", size: 20 }) && !P.wants({ hscale: 100, vscale: 100 }) && ["hscale:150", "vscale:80", "baseline:3", "fauxBold:true", "fauxItalic:true", "smallcaps:true", "pos:super", "justify:left", "indL:4", "indF:10", "spB:6", "spA:2", "kern:none"]
    .every((kv) => { const [k, v] = kv.split(":"); return P.wants({ [k]: isNaN(+v) ? (v === "true" ? true : v) : +v }); }) && P.wants({ box: { w: 10, h: 10 } }));
check("owns: not a text on a path / vertical / warped / 3D (pctext draws those, its straight block through us)",
  P.owns({ hscale: 120 }) && !P.owns({ hscale: 120, vertical: true }) && !P.owns({ hscale: 120, path: { kind: "circle" } }) && !P.owns({ hscale: 120, warp: { style: "arc", bend: 40 } }) && !P.owns({ hscale: 120, extrude: { on: true } }) && P.owns({ hscale: 120, warp: { style: "none", bend: 40 } }));
check("runs: small caps = the lower-case letters as smaller capitals", JSON.stringify(P.runs("Hello World", { smallcaps: true })) === '[["H",false],["ELLO",true],[" W",false],["ORLD",true]]' && P.runs("abc", {}).length === 1);
const m = P.measureOf({ size: 20 }), mh = P.measureOf({ size: 20, hscale: 150 }), mt = P.measureOf({ size: 20, tracking: 100 }), ms = P.measureOf({ size: 20, pos: "super" }), msc = P.measureOf({ size: 20, smallcaps: true });
check("measureOf: 0.55 em a letter; horizontal scale, tracking (1/1000 em a letter), superscript (58.3 %), small caps (75 %) change the width",
  near(m("ab"), 22) && near(mh("ab"), 33) && near(mt("ab"), 26) && near(ms("ab"), 22 * 0.583, 1e-6) && near(msc("ab"), 22 * 0.75, 1e-6) && near(msc("AB"), 22), [m("ab"), mh("ab"), mt("ab"), ms("ab"), msc("ab")]);

/* ---- 2 */
check("wrapLine: words onto lines no wider than the room (spaces at line ends dropped); no room = one line",
  JSON.stringify(P.wrapLine("aa bb cc dd", 60, m)) === '["aa bb","cc dd"]' && P.wrapLine("aa bb cc", Infinity, m).length === 1 && JSON.stringify(P.wrapLine("", 50, m)) === '[""]', P.wrapLine("aa bb cc dd", 60, m));
check("...a word longer than the line is broken; hyphenated (both parts 3+ letters) when asked",
  JSON.stringify(P.wrapLine("abcdefghij", 60, m)) === '["abcde","fghij"]' && JSON.stringify(P.wrapLine("abcdefghij", 60, m, true)) === '["abcd-","efg-","hij"]' && P.wrapLine("abcdefghijklmnop", 60, m, true).every((l) => m(l) <= 60), P.wrapLine("abcdefghij", 60, m, true));
check("...the first line can have its own room (a first-line indent)", JSON.stringify(P.wrapLine("aa bb cc dd", (first) => (first ? 30 : 70), m)) === '["aa","bb cc","dd"]', P.wrapLine("aa bb cc dd", (first) => (first ? 30 : 70), m));

/* ---- 3 */
const pt = P.layout({ str: "abc\nab", size: 20, x: 100, y: 10, align: "center", leading: 1.5 });
check("layout, point text: a line per paragraph centred on x, 1.5 × size apart; its box", pt.lines.length === 2 && near(pt.lines[0].x, 100 - 16.5) && near(pt.lines[1].y, 40) && near(pt.box.x, 83.5) && near(pt.box.w, 33) && near(pt.box.h, 60), pt);
const pr = P.layout({ str: "abc", size: 20, x: 100, y: 0, align: "right", indR: 10 }), pl = P.layout({ str: "abc", size: 20, x: 100, y: 0, indL: 8, indF: 4 });
check("...right-aligned ends at x minus the right indent; left starts at x plus the left + first-line indents", near(pr.lines[0].x, 100 - 33 - 10) && near(pl.lines[0].x, 112));
const box = { str: "aa bb cc dd ee ff", size: 20, x: 10, y: 20, box: { w: 70, h: 200 } };
const b1 = P.layout(box);
check("layout, paragraph text: wrapped in the box (x / y = its top-left), the box is the text's box", b1.lines.map((l) => l.text).join("|") === "aa bb|cc dd|ee ff" && b1.lines.every((l) => l.x === 10) && JSON.stringify(b1.box) === '{"x":10,"y":20,"w":70,"h":200}', b1.lines);
const bj = P.layout(Object.assign({}, box, { justify: "left" })), bja = P.layout(Object.assign({}, box, { justify: "all" })), bjc = P.layout(Object.assign({}, box, { justify: "center" }));
check("...justified: every line but the last as wide as the box (the extra spread over its spaces); the last left / centred, or justified too with Justify All",
  bj.lines.slice(0, 2).every((l) => near(l.w, 70) && near(l.gap, 70 - m("aa bb"))) && bj.lines[2].gap === 0 && bja.lines[2].gap > 0 && near(bjc.lines[2].x, 10 + (70 - m("ee ff")) / 2), [bj.lines, bja.lines[2]]);
const bi = P.layout(Object.assign({}, box, { str: "aa bb cc dd ee ff", indL: 5, indR: 5, indF: 20, box: { w: 90, h: 200 } }));
check("...indents: the room narrower by left + right (+ the first line's), the lines start after them", bi.lines[0].text === "aa bb" && m(bi.lines[0].text) <= 60 && near(bi.lines[0].x, 35) && near(bi.lines[1].x, 15) && bi.lines.slice(1).every((l) => m(l.text) <= 80), bi.lines);
const sp = P.layout({ str: "a\nb\nc", size: 10, x: 0, y: 0, spB: 5, spA: 3, leading: 1 });
check("...space before / after a paragraph", sp.lines.map((l) => l.y).join() === "0,18,36", sp.lines.map((l) => l.y));
const ov = P.layout(Object.assign({}, box, { box: { w: 70, h: 50 } }));
check("...what does not fit the box's height is hidden (over), the layout says it overflows", ov.overflow && ov.lines.filter((l) => l.over).length === 1 && ov.lines[2].over && !ov.lines[1].over, ov.lines.map((l) => l.over));
const caps = P.layout({ str: "ab", size: 20, x: 0, y: 0, caps: true });
check("...All Caps lays out the capitals", caps.lines[0].text === "AB");

/* ---- 4 */
const t = { font: "Arial", size: 30, hscale: 120, fauxBold: true, justify: "left", indL: 4, str: "x" };
const cs = P.pick(t, P.CHAR_KEYS), ps = P.pick(t, P.PARA_KEYS);
check("pick: a character style takes the character keys, a paragraph style the paragraph keys", cs.hscale === 120 && cs.fauxBold && cs.font === "Arial" && !("justify" in cs) && ps.justify === "left" && ps.indL === 4 && !("size" in ps));
check("matches: the text still as its style (no override) / changed (an override)", P.matches(t, { props: cs }, P.CHAR_KEYS) && !P.matches(Object.assign({}, t, { size: 31 }), { props: cs }, P.CHAR_KEYS));
const sc = { box: { w: 100, h: 50 }, indL: 4, indF: 6, spB: 2, baseline: 3 }; P.scale(sc, 2, 3);
check("scale (Image Size): the box, indents (× width) and spacing / baseline (× height)", sc.box.w === 200 && sc.box.h === 150 && sc.indL === 8 && sc.indF === 12 && sc.spB === 6 && sc.baseline === 9, sc);

/* ---- 5 */
const EXT = JSON.parse(read("ext", "imageeditdock", "ext.json")).scripts, DOC = read("ext", "imageeditdock", "pcdoc.js"), TX = read("ext", "imageeditdock", "pctext.js"), UI = read("ext", "imageeditdock", "pcui.js"),
  IE = read("ext", "imageeditdock", "imageedit.js"), TL = read("ext", "imageeditdock", "pctools.js"), TY = read("ext", "imageeditdock", "pctype.js");
check("ext.json: pctype right after pctext (before imageedit.js); installed after PCText", EXT.indexOf("pctype.js") === EXT.indexOf("pctext.js") + 1 && EXT.indexOf("pctype.js") < EXT.indexOf("imageedit.js") && IE.indexOf("PCText.install(E)") < IE.indexOf("PCType.install(E)"));
check("pcdoc draws / boxes the texts pctype owns; pctext's straight block (warp / 3D) goes through pctype when it wants",
  /else if \(root\.PCType && root\.PCType\.owns\(L\.text\)\) root\.PCType\.draw\(g, L\.text\);/.test(DOC) && /if \(root\.PCType && root\.PCType\.owns\(t\)\) return root\.PCType\.box\(t, g\);/.test(DOC)
  && /if \(root\.PCType && root\.PCType\.wants\(t\)\) return root\.PCType\.box\(t, g\);/.test(TX) && /if \(root\.PCType && root\.PCType\.wants\(t\)\) \{ root\.PCType\.drawAt\(g, t, ox, oy\); return; \}/.test(TX));
check("the panels: Character / Paragraph tabs in the colour group (imageedit + pcui TABS), shown on demand, repainted with the layers",
  /\$\{tab\("color", "pcChar", "Character"\)\}\$\{tab\("color", "pcPara", "Paragraph"\)\}/.test(IE) && /\["pcChar", "Character"\], \["pcPara", "Paragraph"\]/.test(UI)
  && /if \(id === "pcChar" && E\.ui\.character\) E\.ui\.character\(\);/.test(UI) && /props\(\); history\(\); if \(E\.ui\.typePanels\) E\.ui\.typePanels\(\);/.test(UI));
check("pctools: Image Size scales the box / indents (PCType.scale); the paragraph textarea is the box (wraps, its indents)",
  /if \(root\.PCType\) root\.PCType\.scale\(L\.text, kx, ky\);/.test(TL) && /if \(t\.box\) \{\s+\/\/ 2\.426\.0: paragraph text - the textarea IS the box/.test(TL) && /ta\.style\.whiteSpace = "pre-wrap";/.test(TL));
check("pctype: the Type tool's drag makes paragraph text; Convert to Paragraph / Point Text; Window ▸ Character / Paragraph; styles kept with the app",
  /TT\.down = function \(e, fx, fy\)/.test(TY) && /TT\.up = function \(\)/.test(TY) && /C\("type\.para", "Type: Convert to Paragraph Text"/.test(TY) && /C\("type\.point", "Type: Convert to Point Text"/.test(TY)
  && /C\("win\.pcChar", "Character"/.test(TY) && /C\("win\.pcPara", "Paragraph"/.test(TY) && /store\.get\("t\.cstyles", \[\]\)/.test(TY) && /store\.get\("t\.pstyles", \[\]\)/.test(TY));
check("server.js untouched", !/pctype|cstyles/.test(read("server.js")));

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
