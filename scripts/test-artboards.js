#!/usr/bin/env node
/* bitGen Studio — 2.447.0 units: ARTBOARDS (ext/imageeditdock/pcartboards.js): a board's values, where the next one goes,
 * the canvas that holds them, the union of boxes, file names; the wiring (pcdoc, imageedit, pctools, pcpsd, pcui). */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const A = require(path.join(ROOT, "ext", "imageeditdock", "pcartboards.js"));
check("PRESETS: social / video / print sizes", A.PRESETS.length >= 6 && A.PRESETS.some(([n, w, h]) => w === 1080 && h === 1920) && A.PRESETS.some(([n, w, h]) => w === 1920 && h === 1080));
check("cleanBoard: whole numbers in range, a #rrggbb background or none", JSON.stringify(A.cleanBoard({ x: 10.4, y: -3, w: 0, h: 99999, bg: "red" })) === '{"x":10,"y":-3,"w":1,"h":16384,"bg":""}' && A.cleanBoard({ bg: "#ABCDEF" }).bg === "#abcdef");
check("nextPlace: right of the rightmost one (a gap), at the top of the first; none = 0, 0", JSON.stringify(A.nextPlace([], 100, 100)) === '{"x":0,"y":0}' && JSON.stringify(A.nextPlace([{ x: 0, y: 0, w: 500, h: 400 }, { x: 580, y: 20, w: 300, h: 300 }], 100, 100)) === '{"x":960,"y":0}');
check("docFor: the canvas that holds every board (never smaller)", JSON.stringify(A.docFor([{ x: 960, y: 0, w: 1080, h: 1920 }], 800, 600)) === '{"w":2040,"h":1920}' && JSON.stringify(A.docFor([], 800, 600)) === '{"w":800,"h":600}');
check("unionBox / safeName", JSON.stringify(A.unionBox([{ x: 10, y: 20, w: 30, h: 40 }, null, { x: 0, y: 50, w: 5, h: 5 }])) === '{"x":0,"y":20,"w":40,"h":40}' && A.unionBox([]) === null && A.safeName("Story / Reel #1") === "Story _ Reel _1");
const DOC = read("ext", "imageeditdock", "pcdoc.js"), IE = read("ext", "imageeditdock", "imageedit.js"), PT = read("ext", "imageeditdock", "pctools.js"), PS = read("ext", "imageeditdock", "pcpsd.js"), UI = read("ext", "imageeditdock", "pcui.js");
const ext = JSON.parse(read("ext", "imageeditdock", "ext.json")).scripts;
check("pcdoc: an artboard group draws through PCArtboards.content (never pass-through), \"artboard\" in the undo snapshot",
  /L\.artboard && root\.PCArtboards\) return root\.PCArtboards\.content/.test(DOC) && /L\.type === "group" && !L\.artboard && blend === "pass-through"/.test(DOC) && /"frame", "artboard"[\],]/.test(DOC));
check("imageedit: moving / nudging an artboard moves its rectangle (E.moveBoard); duplicating keeps it; installed after pcpromptlink; Canvas Size / Image Size move / scale them (pctools shiftBoards); a PSD artboard; the Artboard tool in the Move group",
  (IE.match(/E\.moveBoard\(/g) || []).length === 2 && /"frame", "artboard"(, "sketch")?\]\) d\[k\]/.test(IE) && IE.indexOf("PCArtboards.install(E)") > IE.indexOf("PCPromptLink.install(E)") && ext.indexOf("pcartboards.js") === ext.indexOf("pcpromptlink.js") + 1
  && /shiftBoards\(ox, oy, 1, 1\)/.test(PT) && /shiftBoards\(0, 0, kx, ky\)/.test(PT) && /o\.artboard = \{ rect:/.test(PS) && /\["move", "Move Tool"\], \["artboard", "Artboard Tool"\]/.test(UI));
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
