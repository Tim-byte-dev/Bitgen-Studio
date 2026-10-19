#!/usr/bin/env node
/* bitGen Studio — 2.396.0 unit tests: the image editor's New background, the colour swap (a plain Background takes
 * the new background colour), the swatches, the Paint Bucket's own button and its Foreground / Background / Gradient
 * fill (ext/imageeditdock/pcfill.js and its wiring).
 * Tim (verbatim): "can we do more work on the image editor, start with making the tools in the toolbar functional -
 * when new make the background the color in the background select, when swap with foreground change the background
 * color, add a bucket fill/gradient fill" */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const X = (f) => path.join(ROOT, "ext", "imageeditdock", f);
const read = (f) => fs.readFileSync(f, "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 500))); } };

const F = require(X("pcfill.js"));
const px = (arr) => Uint8ClampedArray.from(arr);
check("solidOf: one opaque colour -> its hex; two colours / any transparency -> null",
  F.solidOf(px([32, 80, 192, 255, 32, 80, 192, 255])) === "#2050c0" && F.solidOf(px([32, 80, 192, 255, 33, 80, 192, 255])) === null
  && F.solidOf(px([32, 80, 192, 254, 32, 80, 192, 254])) === null && F.solidOf(px([])) === null);
const m = new Uint8Array(6 * 4); m[1 * 6 + 2] = 255; m[2 * 6 + 4] = 128;
check("maskBox: the set pixels' box; none = null", JSON.stringify(F.maskBox(m, 6, 4)) === '{"x":2,"y":1,"w":3,"h":2}' && F.maskBox(new Uint8Array(4), 2, 2) === null);
const box = { x: 10, y: 20, w: 40, h: 60 };
check("gradLine: a drag = the drag; a click = the region top -> bottom through its middle",
  JSON.stringify(F.gradLine(box, 5, 5, 50, 5)) === '{"x0":5,"y0":5,"x1":50,"y1":5,"dragged":true}'
  && JSON.stringify(F.gradLine(box, 12, 30, 13, 31)) === '{"x0":30,"y0":20,"x1":30,"y1":80,"dragged":false}');
check("swapPlan: the colours change places; a plain Background (another colour) is recoloured to the NEW background; not when not plain / already that colour",
  JSON.stringify(F.swapPlan("#000000", "#ffffff", "#ffffff")) === '{"fg":"#ffffff","bg":"#000000","recolour":"#000000"}'
  && F.swapPlan("#000000", "#ffffff", null).recolour === null && F.swapPlan("#ff0000", "#000000", "#FF0000").recolour === null);
check("bucketPlan: foreground / background colour, gradient (no colour), anything else = foreground",
  JSON.stringify(F.bucketPlan("fg", "#111111", "#222222")) === '{"source":"fg","color":"#111111"}' && F.bucketPlan("bg", "#111111", "#222222").color === "#222222"
  && F.bucketPlan("gradient", "#1", "#2").color === null && F.bucketPlan("zzz", "#111111", "#2").source === "fg" && F.SOURCES.join() === "fg,bg,gradient");

// the wiring
const ext = JSON.parse(read(X("ext.json"))).scripts, IE = read(X("imageedit.js")), UI = read(X("pcui.js")), PF = read(X("pcfill.js"));
check("ext.json: pcfill.js after pcpsd.js, before imageedit.js; installed last (after PCPsd)",
  ext.indexOf("pcfill.js") === ext.indexOf("pcpsd.js") + 1 && ext.indexOf("pcfill.js") < ext.indexOf("imageedit.js")
  && /win\.PCPsd\.install\(E\);[^\n]*\n\s*if \(win\.PCFill && win\.PCFill\.install\) win\.PCFill\.install\(E\);/.test(IE));
check("File ▸ New: Background starts on 'Background colour' (first, selected), its swatch beside it follows the choice",
  /<select id="pdBg" style="flex:1;min-width:0"><option value="bg" selected>Background colour<\/option><option value="white">White<\/option>/.test(UI) && /id="pdBgSw"[^>]*background:\$\{S\.bg\}/.test(UI)
  && /sw\.style\.background = v === "white" \? "#fff"/.test(UI) && /g\.fillStyle = bg === "white" \? "#fff" : bg === "black" \? "#000" : S\.bg/.test(UI));
check("swap: ⇄ (the tool column + the Color panel) and X go through E.swapColors; it recolours a plain, unlocked, unmasked bottom pixel layer as ONE undo step",
  /const sx = \$\("kxSwap"\); if \(sx\) sx\.onclick = \(e\) => \{ e\.preventDefault\(\); swapColors\(\); \};/.test(PF) && /if \(k === "x"\) \{ if \(E\.swapColors\) E\.swapColors\(\);/.test(UI)
  && /\$\("pcCSwap"\)\.onclick = \(\) => \{ if \(E\.swapColors\) E\.swapColors\(\);/.test(UI) && /L\.type === "pixel" && L\.canvas && !L\.mask/.test(PF)
  && /locks\.all \|\| L\.locks\.px/.test(PF) && /E\.endPx\(L, copy, null, "background colour"\); if \(px\) E\.push\(px\);/.test(PF));
check("swatches: 22 px, ringed (a dark colour shows on the dark theme), ⇄ / ◩ real 13 px buttons; the default foreground is black",
  /\.kxsw input\{position:absolute;width:22px;height:22px;[^}]*box-shadow:0 0 0 1px #9a917f/.test(IE) && /\.kxsw \.sx,\.kxsw \.sd\{position:absolute;width:13px;height:13px/.test(IE)
  && /fg: store\.get\("fg", "#000000"\)/.test(IE));
check("the tool column: the Paint Bucket its own button, G on both; Shift+G cycles across every button of a key",
  /\{ k: "g", tools: \[\["gradient", "Gradient Tool"\]\] \},\s*\n\s*\{ k: "g", tools: \[\["fill", "Paint Bucket Tool"\]\] \}/.test(UI)
  && /const gs = GROUPS\.filter\(\(x\) => x && x\.k === k\);/.test(UI) && /const g = \{ tools: \[\]\.concat\(\.\.\.gs\.map\(\(x\) => x\.tools\)\) \};/.test(UI));
check("the Paint Bucket: Fill Foreground / Background / Gradient, Tolerance, Contiguous, All layers, Opacity; a drag sets the gradient's direction; Alt-click picks",
  /T\.fill = \{/.test(PF) && /id="pfSrc"/.test(PF) && /\["fg", "Foreground"\], \["bg", "Background"\], \["gradient", "Gradient"\]/.test(PF) && /id="pfContig"/.test(PF) && /id="pfAll"/.test(PF) && /id="pfOp"/.test(PF)
  && /gradLine\(b\.box, b\.fx, b\.fy, x1, y1\)/.test(PF) && /if \(e\.altKey\) \{ E\.pickColor\(x, y\); return false; \}/.test(PF) && /root\.PCTools/.test(PF));

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
