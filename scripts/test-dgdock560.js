#!/usr/bin/env node
/* bitGen Studio — 2.560.0 units: the ▣ docker docks by drop zones (static/dgdock.js + static/dockgroup.js makePerm(id,
 * restoring, place)), and Basic Settings / LLM tokens / the prompt docker go into a ▣ docker.
 * Tim: "the new docker is now at the right z level but won't dock and won't allow other dockers to doc in it". */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const rd = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 500))); } };
const D = require(path.join(ROOT, "static", "dgdock.js"));
const DF = require(path.join(ROOT, "static", "dockfloat.js"));

const cl = (...c) => ({ contains: (x) => c.includes(x) });
check("memberIdOf: the prompt docker -> pf.promptdock; a SecFloat window sf-<id> -> sf.<id>; anything else -> null",
  D.memberIdOf({ id: "promptdock", classList: cl("bdock") }) === "pf.promptdock" && D.memberIdOf({ id: "sf-basic", classList: cl("secfloat") }) === "sf.basic"
  && D.memberIdOf({ id: "sf-llmtok", classList: cl("secfloat", "df-float") }) === "sf.llmtok" && D.memberIdOf({ id: "previewdock", classList: cl("bdock") }) === null && D.memberIdOf(null) === null);
check("wants: a kept dock place {mode dock, to <id>, side top / bottom / left / right}; not a float, not a tab, not a bad id",
  D.wants({ mode: "dock", to: "previewdock", side: "top" }) && D.wants({ mode: "dock", to: "refsdock", side: "bottom" }) && !D.wants({ mode: "float", to: "x", side: "top" })
  && !D.wants({ mode: "dock", to: "x", side: "inside" }) && !D.wants({ mode: "dock", to: "1x", side: "top" }) && !D.wants(null));
const T = [{ key: "refsdock", kind: "side", l: 0, t: 100, r: 300, b: 900 }, { key: "previewdock", kind: "column", l: 400, t: 100, r: 1200, b: 500 }];
const z1 = D.pickZone(800, 110, T, DF), z2 = D.pickZone(1190, 300, T, DF), z3 = D.pickZone(10, 500, T, DF), z4 = D.pickZone(150, 890, T, DF), z5 = D.pickZone(800, 300, T, DF);
check("pickZone: a column docker's top / right edge (36 px band); a side docker only top / bottom (not its left edge); the middle = nothing (no \"inside\")",
  z1 && z1.key === "previewdock" && z1.side === "top" && z2 && z2.side === "right" && z3 === null && z4 && z4.key === "refsdock" && z4.side === "bottom" && z5 === null, { z1, z2, z3, z4, z5 });
check("...the zone lights the half it docks into (DockFloat zoneRect)", z1.r.t === 100 && z1.r.b === 300 && z2.r.l === 800);
const R = { left: 100, top: 100, right: 700, bottom: 500 };
check("nearEdge: DockFloat's 36 px band; the prompt docker's own (30 % up to 90 px)",
  D.nearEdge(120, 300, R, 36) && !D.nearEdge(150, 300, R, 36) && D.nearEdge(150, 300, R, "pf") && !D.nearEdge(400, 300, R, "pf") && D.EDGE === 36);

const DG = rd("static", "dockgroup.js"), DD = rd("static", "dgdock.js"), DFs = rd("static", "dockfloat.js"), IX = rd("static", "index.html");
check("index.html loads dgdock.js right after dockgroup.js", /<script src="\/static\/dockgroup\.js"><\/script>\n<script src="\/static\/dgdock\.js"><\/script>/.test(IX));
check("makePerm(id, restoring, place): measured where the window was BEFORE it moves; a drop zone / the kept perm.dock -> H3DGDock.place, else the main column as before (with its grip)",
  /function makePerm\(id, restoring, place\)/.test(DG) && DG.indexOf("const before = placeFor(r, main") < DG.indexOf('d.querySelector(".bbody").appendChild(r.win)')
  && /DD\.place\(id, d, dock, !!restoring && !place\)/.test(DG) && /DD\.wants\(r\.perm\.dock\)/.test(DG) && /if \(DD\) DD\.headOut\(head, id\)/.test(DG));
check("unPerm(id, at) / remove: a docked ▣ docker leaves its row first (DockFloat unplace)",
  /function unPerm\(id, at\)/.test(DG) && (DG.match(/if \(d && d\._dfPanel\) d\._dfPanel\.unplace\(\);/g) || []).length === 2);
check("dgdock: a DockFloat panel around the docked ▣ docker (its own edge sizes it), kept as perm.dock; the column laid out first at the start, retried while its docker is not there",
  /DF\(\)\.panel\(\{ id: "dg-" \+ id/.test(DD) && /P\(\)\.setPerm\(id, \{ dock: DF\(\)\.pure\.cleanState\(stateOf\(id\)\) \}\)/.test(DD) && /\(quiet && !layoutReady\(\)\)/.test(DD) && /retries\[id\]/.test(DD));
check("dgdock: one bubbling pointerdown for every ▣ docker's title bar (a new one works at once); over another ▣ docker floatpanels has it",
  /doc\.addEventListener\("pointerdown", \(e\) => \{/.test(DD) && /if \(!G\(\)\.isGroup\(id\)/.test(DD) && /doc\.querySelector\("\.h3fp\.drop"\)/.test(DD));
check("dgdock: Basic Settings / LLM tokens / the prompt docker dragged (sf-drag / pf-dragging) over a ▣ docker go in after their own drop; out of it = they float on their own; back after a reload",
  /\.secfloat\.sf-drag, #promptdock\.pf-dragging/.test(DD) && /root\.addEventListener\("pointerup", drop, false\)/.test(DD) && /root\.setTimeout\(\(\) => takeIn\(c\.id, c\.g, c\.slot\), 0\)/.test(DD)
  && /root\.setTimeout\(\(\) => P\(\)\.home\(id\), 0\)/.test(DD) && /w\.panel\.float\(at\.x, at\.y/.test(DD) && /root\.PFloat\.float\(at\.x, at\.y/.test(DD) && /lay\[id\]\.state === "in"/.test(DD));
check("dockfloat: a docked ▣ docker offers its edges to Basic Settings, not a tab over it (it takes them INTO itself)",
  /const hd = t\.classList\.contains\("dgperm"\) \? null : headerOf\(t\)/.test(DFs));
console.log(`\n${pass} passed, ${fail} failed`);
console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
process.exit(fail ? 1 : 0);
