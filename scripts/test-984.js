#!/usr/bin/env node
/* bitGen Studio — 2.984.0: the Sketcher's arrow keys (pptools.js arrowNav) and its ⚙ properties docker (ppdocks.js:
 * normalize / move / visibleOf / dropAt / sig). Tim: "in sketcher use up and down arrow keys to zoom in and out, use left
 * and right to orbit on the xy plane ... make the properties panel next to the left toolbox a collapsible docker. allow
 * other dockers that are confined to sketcher to dock inside the properties docker either as a docker below or as a tab." */
"use strict";
const path = require("path");
const fs = require("fs");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const near = (a, b, e) => Math.abs(a - b) < (e || 1e-9);
const rd = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

require(path.join(ROOT, "ext/pushpulldock/pptools.js"));
const A = globalThis.PPTools.arrowNav;
check("↑ zooms in (×1.15), ↓ out", near(A("ArrowUp", false).zoom, 1.15) && near(A("ArrowDown", false).zoom, 1 / 1.15));
check("← / → turn the view 5° around Z (← one way, → the other)", near(A("ArrowLeft", false).turn, -Math.PI / 36) && near(A("ArrowRight", false).turn, Math.PI / 36));
check("Shift = 3 steps (15°, 1.15³)", near(A("ArrowRight", false, true).turn, Math.PI / 12) && near(A("ArrowUp", false, true).zoom, Math.pow(1.15, 3)));
check("a tool half-way: no view move (the arrows keep an axis as before)", A("ArrowUp", true) === null && A("ArrowLeft", true) === null);
check("other keys: nothing", A("a", false) === null && A("Enter", false) === null);
const tools = rd("ext/pushpulldock/pptools.js");
check("pptools.key: the view moves only when arrowNav says so, before the axis lock", tools.indexOf("arrowNav(k, Object.keys(st).length > 0, e.shiftKey)") > 0 && tools.indexOf("arrowNav(k, Object.keys(st).length") < tools.indexOf('lock = k === "ArrowRight"'));
const view = rd("ext/pushpulldock/ppview.js");
check("ppview: orbitZ turns the camera round the target in the xy plane (and is exported)", /function orbitZ\(rad\)/.test(view) && /zoomAt, orbitZ, diag/.test(view));

require(path.join(ROOT, "ext/pushpulldock/ppdocks.js"));
const D = globalThis.H3PPDocks;
const ids = D.PANELS.map((p) => p.id), def = D.PANELS.reduce((o, p) => { o[p.id] = p.def; return o; }, {});
check("the Sketcher's panels: Outline, Properties, Wall types, DAZ Library / Explorer / Parameters", ids.join() === "outline,props,walltypes,dzlib,dzexp,dzpar");
const L0 = D.normalize(null, ids, def);
check("the start: 🗂 Outline above ⚙ Properties in the docker, the rest in their own places, 240 px, open (narrow: folded)", L0.groups.map((g) => g.tabs.join("+")).join("|") === "outline|props" && L0.home.join() === "walltypes,dzlib,dzexp,dzpar" && L0.w === 240 && !L0.folded && L0.foldedN, L0);
const L1 = D.normalize({ groups: [{ tabs: ["props", "nope", "props"], on: "x", h: -3 }, { tabs: [] }], home: ["props", "dzlib"], w: 9999 }, ids, def);
check("normalize: unknown / doubled ids dropped, empty dockers gone (a new panel then joins docker 0), a bad 'on' -> the first tab, h > 0, the width kept in 150 - 640", L1.groups.length === 1 && L1.groups[0].tabs.join() === "props,outline" && L1.groups[0].on === "props" && L1.groups[0].h === 1 && L1.w === 640 && L1.home.join() === "dzlib,walltypes,dzexp,dzpar", L1);
check("normalize: a panel new to a saved layout joins the docker it starts in (a tab), or a new docker past the last", D.normalize({ groups: [{ tabs: ["props"] }], home: [] }, ids, def).groups.map((g) => g.tabs.join("+")).join("|") === "props+outline" && D.normalize({ groups: [{ tabs: ["outline"] }], home: [] }, ids, def).groups.map((g) => g.tabs.join("+")).join("|") === "outline|props");
const t1 = D.move(L0, "dzlib", "tab", 1);
check("move → tab: a tab in that docker, shown", t1.groups[1].tabs.join() === "props,dzlib" && t1.groups[1].on === "dzlib" && !t1.home.includes("dzlib"));
const b1 = D.move(t1, "dzexp", "below", 0);
check("move → below: its own docker right after that one", b1.groups.map((g) => g.tabs.join("+")).join("|") === "outline|dzexp|props+dzlib");
const h1 = D.move(b1, "dzexp", "home");
check("move → home: out of the column, an empty docker removed", h1.groups.map((g) => g.tabs.join("+")).join("|") === "outline|props+dzlib" && h1.home.includes("dzexp"));
const s1 = D.move(L0, "props", "below", 1);
check("move a lone tab below itself: no change", s1.groups.map((g) => g.tabs.join("+")).join("|") === "outline|props");
const p1 = D.move(t1, "props", "tab", 0);
check("move the shown tab away: its old docker shows the next", p1.groups[0].tabs.join() === "outline,props" && p1.groups[1].on === "dzlib");
check("move past the last docker = a new docker", D.move(L0, "walltypes", "tab", 9).groups.map((g) => g.tabs.join("+")).join("|") === "outline|props|walltypes");
check("move leaves the layout it was given alone", L0.groups.length === 2 && L0.groups[1].tabs.length === 1);
const V = D.visibleOf(t1, (id) => id !== "outline" && id !== "dzlib");
check("visibleOf: switched-off panels have no tab; a docker with none left out; the shown tab falls back", V.length === 1 && V[0].gi === 1 && V[0].tabs.join() === "props" && V[0].on === "props", V);
const R = { col: { l: 0, t: 0, r: 200, b: 600 }, groups: [{ gi: 0, bar: { l: 0, t: 20, r: 200, b: 40 }, box: { l: 0, t: 20, r: 200, b: 300 } }, { gi: 2, bar: { l: 0, t: 305, r: 200, b: 325 }, box: { l: 0, t: 305, r: 200, b: 500 } }] };
check("dropAt: on a tab bar = a tab there", JSON.stringify(D.dropAt(R, 50, 30)) === '{"where":"tab","gi":0}' && JSON.stringify(D.dropAt(R, 50, 310)) === '{"where":"tab","gi":2}');
check("dropAt: the upper part of a docker = a tab, the lower third = its own docker below", D.dropAt(R, 50, 100).where === "tab" && JSON.stringify(D.dropAt(R, 50, 280)) === '{"where":"below","gi":0}' && JSON.stringify(D.dropAt(R, 50, 480)) === '{"where":"below","gi":2}');
check("dropAt: under the last docker = below it; outside the column = its own place", JSON.stringify(D.dropAt(R, 50, 560)) === '{"where":"below","gi":2}' && D.dropAt(R, 300, 100).where === "home" && D.dropAt({ col: null, groups: [] }, 1, 1).where === "home");
check("dropAt: a column with no docker shown (folded) = a tab in the first", JSON.stringify(D.dropAt({ col: R.col, groups: [] }, 10, 10)) === '{"where":"tab","gi":0}');
check("sig: changes with the folded state, the tabs and the one shown - not otherwise", D.sig(V, false) === D.sig(D.visibleOf(t1, (id) => id !== "outline" && id !== "dzlib"), false) && D.sig(V, false) !== D.sig(V, true) && D.sig(D.visibleOf(t1, () => true), false) !== D.sig(V, false));

// the wiring
const ej = JSON.parse(rd("ext/pushpulldock/ext.json"));
check("ext.json loads ppdocks.js after the DAZ dockers", ej.scripts.indexOf("ppdocks.js") > ej.scripts.indexOf("ppdaztools.js") && ej.scripts.indexOf("ppdocks.js") > ej.scripts.indexOf("ppoutline.js"));
check("ppwalltype mounts beside ⚙ Properties only when it is still in the main row", /main\.insertBefore\(box, props\.parentNode === main \? props : null\)/.test(rd("ext/pushpulldock/ppwalltype.js")));
check("the DAZ library keeps its floating size while docked", /lib\.closest\("#ppDockCol"\)\) return;/.test(rd("ext/pushpulldock/ppdaztools.js")));
const dk = rd("ext/pushpulldock/ppdocks.js");
check("nothing added to server.js; the docker is the Sketcher extension's own file", !/ppdocks/.test(rd("misc/server.js")) && /root\.H3PPDocks = /.test(dk));
check("⚙ Properties in the docker: shown with a hint when nothing is picked; its narrow ⚙ tab hidden", /#ppProps\.ppdk-none::before/.test(dk) && /#ppProps \.pptog\{display:none!important\}/.test(dk));
console.log("\nRESULT: " + pass + " passed, " + fail + " failed");
process.exitCode = fail ? 1 : 0;
