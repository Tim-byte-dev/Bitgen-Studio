#!/usr/bin/env node
/* bitGen Studio — 2.764.5 units: floating dockers over docked ones (static/floatz.js tiers) + top / bottom drop zones in every
 * docker that stack two dockers (static/floatpanels.js edgeIn / slotOf / stackWith; dgdock + dockgroup pass the slot).
 * Tim (verbatim): "move floating dockers to the front of all docked dockers. add vertical drop zones to all dockers as well so
 * floating dockers can dock below or above another docker that is docked inside a docked docker if that makes sense" */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got))); } };
const rd = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const Z = require("../static/floatz.js");
check("layered: docked dockers (0) under floating dockers (1) under floating dialogs (2); each tier in the order used", JSON.stringify(Z.layered(["f1", "g1", "d1", "f2", "d2", "g2"], (x) => ({ d: 0, f: 1, g: 2 })[x[0]])) === '["d1","d2","f1","f2","g1","g2"]');
check("…true / false still mean under / over (2.763.5)", JSON.stringify(Z.layered(["c", "D", "b", "E"], (x) => /[A-Z]/.test(x))) === '["D","E","c","b"]');
const FZ = rd("static", "floatz.js"), FP = rd("static", "floatpanels.js");
check("floatz: a ▣ New docker… docker confined to a docker = tier 0 (docked) - pressing it never lifts it over a floating docker", /const tierOf = \(w\) => \(isDocker\(w\) \? \(w\.classList\.contains\("h3fp-dk"\) && w\.parentElement !== doc\.body \? 0 : 1\) : 2\);/.test(FZ) && /layered\(stack, tierOf\)\.forEach/.test(FZ));
// edgeIn is pure on rects - run it out of the file
const src = FP.slice(FP.indexOf("  function edgeIn("), FP.indexOf("  /** 2.545.0: the slot a drop at"));
const edgeIn = new Function("inRect", src + "\nreturn edgeIn;")((r, x, y) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom);
const parts = [{ id: "a", rect: { left: 0, top: 0, right: 400, bottom: 300, width: 400, height: 300 } }, { id: "b", rect: { left: 400, top: 0, right: 800, bottom: 300, width: 400, height: 300 } }];
const t = edgeIn(parts, 200, 20), bo = edgeIn(parts, 600, 290), mid = edgeIn(parts, 200, 150);
check("edgeIn: the top band (28%, 24-90 px) of the docker under the pointer = above it, the bottom band = below, the middle = none",
  t && t.member === "a" && t.edge === "top" && t.line.y === -2 && t.line.w === 400 && bo && bo.member === "b" && bo.edge === "bottom" && mid === null, { t, bo, mid });
check("slotOf: a docker inside under the pointer gives its own slots (not near its sides in a row / column); else top / bottom = {wrap}; a column's own slots stay",
  /const inner = slotOf\(R\[under\.id\], x, y, \(depth \|\| 0\) \+ 1\);/.test(FP) && /if \(under && !sideOf\(under\.rect\)/.test(FP) && /if \(d\.layout !== "col" && d\.win\) \{\s*const e = edgeIn\(shown, x, y\);/.test(FP) && /wrap: e \}/.test(FP));
check("dockInto takes the slot: {into} -> that inner docker, {wrap} -> stackWith (a stacked docker in the member's place, or the member stack's end)",
  /if \(at\.into && at\.into !== into && R\[at\.into\]\) return dockInto\(id, at\.into/.test(FP) && /if \(at\.wrap\) return stackWith\(id, into, at\.wrap\.member, at\.wrap\.edge\);/.test(FP)
  && /if \(m\.kind === "docker" && m\.layout === "col" && canDock\(id, member/.test(FP) && /newDocker\(\{ name: \(m\.title \+ " \/ " \+ r\.title\)\.slice\(0, 40\), layout: "col" \}\)/.test(FP));
check("every way in passes the whole slot: floatpanels' own drag, Basic Settings / PODS / … (dgdock), a main docker's title bar (dockgroup)",
  /dockInto\(r\.id, over, slot \|\| undefined\)/.test(FP) && (rd("static", "dgdock.js").match(/slot \|\| undefined/g) || []).length === 2 && /dockInto\(pid \|\| "bd\." \+ id, over\.id, slot \|\| undefined\)/.test(rd("static", "dockgroup.js")));
console.log(`\n${pass} passed, ${fail} failed`);
console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
process.exit(fail ? 1 : 0);
