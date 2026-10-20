#!/usr/bin/env node
/* bitGen Studio — 2.545.0 units: ▣ Docker (static/dockgroup.js), a named docker's row / column layout and drop slots
 * (static/floatpanels.js slotIn), the StoryBoard keeping its name. Pure + the wiring.
 * Tim: "do we have a way to add an empty docker with dropzones for other dockers. should be able to be horizontal or
 * vertical with a editable titlebar, ctrl+alt+D can open it and add the button to the statustbar list of dockers.
 * Storyboard docker changes it's name back to videodocker, keep it as storyboard throughout". */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const rd = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const P = require(path.join(ROOT, "static", "floatpanels.js"));
const G = require(path.join(ROOT, "static", "dockgroup.js"));

const parts = [{ rect: { left: 0, right: 100, top: 0, bottom: 200 } }, { rect: { left: 105, right: 300, top: 0, bottom: 200 } }];
const box = { left: 0, top: 0, right: 300, bottom: 200 };
check("slotIn (side by side): left of the first's middle = 0, between = 1, past the last's middle = the end; the line is a 4 px upright one at that edge",
  P.slotIn(parts, "x", 20, 50, box).index === 0 && P.slotIn(parts, "x", 80, 50, box).index === 1 && P.slotIn(parts, "x", 290, 50, box).index === 2
  && JSON.stringify(P.slotIn(parts, "x", 80, 50, box).line) === JSON.stringify({ x: 103, y: 0, w: 4, h: 200 }) && P.slotIn(parts, "x", 290, 50, box).line.x === 298);
const col = [{ rect: { left: 0, right: 300, top: 0, bottom: 100 } }, { rect: { left: 0, right: 300, top: 100, bottom: 200 } }];
check("slotIn (stacked): by y; the line lies across the docker", P.slotIn(col, "y", 10, 140, box).index === 1 && JSON.stringify(P.slotIn(col, "y", 10, 140, box).line) === JSON.stringify({ x: 0, y: 98, w: 300, h: 4 }) && P.slotIn(col, "y", 10, 10, box).index === 0);
check("slotIn: an empty docker = 0, the line through its middle; parts without a rect skipped", P.slotIn([], "x", 5, 5, box).index === 0 && P.slotIn([], "x", 5, 5, box).line.x === 148 && P.slotIn([null, { x: 1 }], "y", 5, 5, box).index === 0);
check("the layouts: tabs, row (horizontal), col (vertical)", P.LAYOUTS.join() === "tabs,row,col");

check("Ctrl+Alt+D (either case, by key or code); not with Shift / Meta, not Ctrl+D, not an AltGr character on D",
  G.isToggleKey({ ctrlKey: true, altKey: true, key: "d", code: "KeyD" }) && G.isToggleKey({ ctrlKey: true, altKey: true, key: "D", code: "KeyD" }) && G.isToggleKey({ ctrlKey: true, altKey: true, key: "d", code: "" })
  && !G.isToggleKey({ ctrlKey: true, altKey: true, shiftKey: true, key: "D", code: "KeyD" }) && !G.isToggleKey({ ctrlKey: true, key: "d", code: "KeyD" }) && !G.isToggleKey({ ctrlKey: true, altKey: true, key: "đ", code: "KeyD" }) && !G.isToggleKey(null));
check("titleOf: the header's own words (▾ / ▸ and spaces dropped), else the fallback", G.titleOf(["▾ ", " Music  ", ""]) === "Music" && G.titleOf(["▸"], "musicdock") === "musicdock");
check("the main dockers ⇱ floats (not the prompt docker - its own float; not the StoryBoard - its own ⇱)", G.CANDIDATES.length === 9 && !G.CANDIDATES.includes("promptdock") && !G.CANDIDATES.includes("videodock") && G.GROUP === "fd-dockers");

const FP = rd("static", "floatpanels.js"), DG = rd("static", "dockgroup.js"), IX = rd("static", "index.html"), SJ = JSON.parse(rd("docs", "shortcuts.json"));
check("floatpanels: the layout is kept (snapshot + newDocker + load), each one's share (grow), drop = at the slot, a docker restored in its saved place",
  /layout: r\.layout \|\| "tabs"/.test(FP) && /newDocker\(\{ id, name: d\.name, confine: d\.confine, layout: d\.layout \}\)/.test(FP) && /s\.grow = r\.grow/.test(FP)
  && /dockInto\(r\.id, over, slot \? slot\.index : undefined\)/.test(FP) && /dockInto\(o\.id, lay\.docker, at\)/.test(FP));
check("floatpanels: the title edited in place (double-click), ⇆ / ⇅ in the title bar, Layout in ⚙, splitters, ⇱ on a docker in one",
  /\.ondblclick = \(\) => editTitle\(r\.id\)/.test(FP) && /class="h3fp-lay"/.test(FP) && /\["h", "Layout:"\]/.test(FP) && /h3fd-split/.test(FP) && /class="h3fp-out"/.test(FP));
check("index.html loads dockgroup.js after floatpanels.js; the shortcut is listed (Anywhere)",
  IX.indexOf('src="/static/dockgroup.js"') > IX.indexOf('src="/static/floatpanels.js"') && SJ.groups[0].rows.some((r) => r[0] === "Ctrl+Alt+D"));
check("dockgroup: the button after Queue, Ctrl+Alt+D in the capture phase, a floating main docker's statusbar button hides the whole window",
  /let after = \$\("tQ"\);/.test(DG) && /sb\.insertBefore\(b, after \? after\.nextSibling/.test(DG) && /addEventListener\("keydown", \(e\) => \{ if \(isToggleKey\(e\)\)/.test(DG) && /:has\(>\.h3fp-b>\.bdock\.dg-floating\.dockgone\)/.test(DG));

const DC = rd("static", "dockcfg.js"), VH = rd("ext", "videodock", "dock.html");
check("the StoryBoard is \"StoryBoard\" everywhere: Docker configs, its header, the statusbar button", /videodock: "StoryBoard"/.test(DC) && /▾ StoryBoard/.test(VH) && />StoryBoard<\/button>/.test(IX));
check("collapsing keeps the header's own words (it wrote \"videodock\" - the names map had no videodock)", /videodock: "StoryBoard"/.test(IX) && /head\.textContent = \(el\.classList\.contains\("collapsed"\) \? "▸ " : "▾ "\)\s*\+ \(had \|\| names\[id\] \|\| id\)/.test(IX) && /const had = \[\.\.\.head\.childNodes\]\.filter\(\(n\) => n\.nodeType === 3\)/.test(IX));
console.log(`\n${pass} passed, ${fail} failed`);
console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
process.exit(fail ? 1 : 0);
