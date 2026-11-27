#!/usr/bin/env node
// bitGen Studio 2.980.0 - 🧬 DAZ TOOLS: the Daz library (left docker), the explorer + shape controls (right docker), one
// toggle on the menu bar. Tim: "add a toggle button to the top toolbar DAZ Tools, open the daz library in a left docker, daz
// explorer (characters and components) and shape controls in the right docker when on, hide when off".
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let P = 0, F = 0;
const check = (n, ok, got) => { if (ok) { P++; console.log("PASS:", n); } else { F++; console.log("FAIL:", n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const src = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const T = require(path.join(ROOT, "ext/pushpulldock/ppdaztools.js"));
const G = T.groupDials([{ label: "Tall", group: "Size" }, { label: "Nose", group: "Head" }, { label: "Big", group: "Size" }, { label: "X" }]);
check("groupDials(): by group A-Z, dials A-Z inside, no group = Other", G.map((g) => g.group + ":" + g.dials.map((d) => d.label).join("/")).join() === "Head:Nose,Other:X,Size:Big/Tall", G);
const c = T.newChar({ root: "/L", rel: "People/Mini/Mini.duf", name: "Mini", kind: "figure" }, 2);
check("newChar(): a character from a figure (numbered when the same figure is there already), nothing worn, muscles on", c.name === "Mini 2" && c.fig.rel === "People/Mini/Mini.duf" && c.wear.length === 0 && c.muscles === true && /^c/.test(c.id));
const shirt = { root: "/L", rel: "People/Mini/Clothing/Shirt.duf", name: "Shirt", kind: "clothing" };
check("wearToggle(): on, then off again", T.wearToggle(c, shirt) === true && c.wear.length === 1 && T.wearToggle(c, shirt) === false && c.wear.length === 0);
const cs = T.cleanScene({ chars: [{ id: "a", fig: { rel: "x.duf" }, dials: { u: 0.5, z: 0, bad: "q" }, drape: { kinds: ["clothing", "evil"], frames: 999 }, wear: [{ rel: "s.duf" }, null] }, { fig: {} }, null], sel: "nope" });
check("cleanScene(): characters need a figure; dials kept only when set; drape kinds / frames clamped; the picked one found (else the first)", cs.chars.length === 1 && JSON.stringify(cs.chars[0].dials) === '{"u":0.5}' && cs.chars[0].drape.kinds.join() === "clothing" && cs.chars[0].drape.frames === 240 && cs.chars[0].wear.length === 1 && cs.sel === "a", cs);
check("cleanScene(): junk = an empty scene", JSON.stringify(T.cleanScene("x")) === '{"chars":[],"sel":""}');
check("TEMPLATE: the library column + its splitter before the main column, a splitter + the explorer after it (15 tracks)", T.TEMPLATE.split(/ (?![^(]*\))/).length === 15 && /var\(--dzl\) 5px minmax\(200px, 1fr\) 5px var\(--dzr\)/.test(T.TEMPLATE));
check("the words: not a replacement for Daz Studio", /Not a replacement for Daz Studio/.test(T.NOTE) && /very powerful character creator/.test(T.NOTE));
const ui = src("ext/pushpulldock/ppdaztools.js");
check("3.2.0: no menu-bar button (an old #dazTools removed) - the Sketcher's #ppDazLib is the switch, aria-pressed; on = #pushpulldock.dz-on, kept (h3.daztools.on)", !/id = "dazTools"/.test(ui) && /const b = \$\("dazTools"\); if \(b\) b\.remove\(\);/.test(ui) && /b2 = \$\("ppDazLib"\)/.test(ui) && /aria-pressed/.test(ui) && /classList\.toggle\("dz-on", on\)/.test(ui) && /LS\.set\("on", on\)/.test(ui));
check("2.983.0: the dockers live in the Sketcher (#ppMain: the floating #dzLib, the #dzSide column) - hidden when off", /\$\("ppMain"\)/.test(ui) && /L\.id = "dzLib"/.test(ui) && /R\.id = "dzSide"/.test(ui) && /📚 DAZ Library/.test(ui) && /🧭 DAZ Explorer/.test(ui) && /🎚 Parameters/.test(ui) && /#pushpulldock:not\(\.dz-on\) \.dz-el\{display:none!important\}/.test(ui));
check("static/dgdock.js knows the two columns (a docked ▣ column regrids with them)", /dzLeft: "var\(--dzl\)", dzRight: "var\(--dzr\)"/.test(src("static/dgdock.js")) && /dzl: "5px", dzr: "5px"/.test(src("static/dgdock.js")));
check("the build route passes 💪 muscles on (lib/dazLib build({muscles}))", /muscles: b\.muscles !== false/.test(src("routes/dazLibrary.js")));
const EJ = JSON.parse(src("ext/pushpulldock/ext.json")).scripts;
check("ext.json: ppdaztools.js after ppdazpose.js (2.983.0: ppdazscene.js between them)", EJ.indexOf("ppdaztools.js") === EJ.indexOf("ppdazpose.js") + 2 && EJ.indexOf("ppdazscene.js") === EJ.indexOf("ppdazpose.js") + 1);
check("the docs: USAGE (🧬 DAZ Tools) + CHANGELOG 2.980.0 + FEATURES", /🧬 DAZ Tools/.test(src("docs/USAGE.md")) && /2\.980\.0/.test(src("misc/CHANGELOG.md")) && /DAZ Tools/.test(src("docs/FEATURES.md")));
console.log(`\n${P} passed, ${F} failed`);
process.exit(F ? 1 : 0);
