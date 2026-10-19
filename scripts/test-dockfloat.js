#!/usr/bin/env node
/* bitGen Studio — 2.398.0 unit tests: dockable panels (static/dockfloat.js), the prompt docker's height, the wiring.
 * Tim (verbatim): "the prompt docker won't allow me to resize it's height. make the basic settings and llm dialogs into
 * dockers with the ability to dock next to another docker or within another docker" */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };

const D = require("../static/dockfloat.js");
const R = { l: 100, t: 100, r: 500, b: 500 }, HEAD = { l: 100, t: 100, r: 500, b: 132 };

// ---- zones
check("zoneAt: within 36 px of an edge = that side; the middle = nothing (it floats there); outside = null",
  D.zoneAt(110, 300, R, null, HEAD, 36) === "left" && D.zoneAt(490, 300, R, null, HEAD, 36) === "right" && D.zoneAt(300, 490, R, null, HEAD, 36) === "bottom"
  && D.zoneAt(300, 300, R, null, HEAD, 36) === null && D.zoneAt(50, 300, R, null, HEAD, 36) === null);
check("zoneAt: the title bar = inside (a tab), its top 10 px = above",
  D.zoneAt(300, 120, R, null, HEAD, 36) === "inside" && D.zoneAt(300, 104, R, null, HEAD, 36) === "top" && D.zoneAt(300, 131, R, null, HEAD, 36) === "inside");
check("zoneAt: a side docker takes top / bottom only (its left / right band falls through to nothing or its title bar)",
  D.zoneAt(110, 300, R, ["top", "bottom"], HEAD, 36) === null && D.zoneAt(300, 495, R, ["top", "bottom"], HEAD, 36) === "bottom" && D.zoneAt(110, 120, R, ["top", "bottom"], HEAD, 36) === "inside");
check("zoneAt: inside=true = the whole middle; no inside = the prompt docker's old bands (28 %, at most 80 px)",
  D.zoneAt(300, 300, R, null, true) === "inside" && D.zoneAt(300, 300, R, null, false) === null && D.zoneAt(170, 300, R) === "left" && D.zoneAt(190, 300, R) === null);
const zi = D.zoneRect(R, "inside"), zt = D.zoneRect(R, "top");
check("zoneRect: a side lights its half, inside lights the docker (inset)", zt.b === 300 && zt.t === 100 && zi.l > 100 && zi.r < 500 && zi.t > 100 && zi.b < 500, { zi, zt });
check("zoneLabel says what the drop does", D.zoneLabel("Basic Settings", "inside", "Settings") === "Basic Settings inside Settings (a tab)"
  && D.zoneLabel("LLM tokens", "right", "Video") === "Dock LLM tokens right of Video" && D.zoneLabel("X", "top", "Queue") === "Dock X above Queue");

// ---- resize
const S0 = { x: 100, y: 100, w: 400, h: 300 };
const rs = (h, dx, dy, mn, mx) => D.resizeRect(S0, h, dx, dy, mn, mx);
check("resizeRect: s / e grow the far edge; n / w move the near edge with the far one held",
  JSON.stringify(rs("s", 0, 50)) === '{"x":100,"y":100,"w":400,"h":350}' && JSON.stringify(rs("e", 30, 0)) === '{"x":100,"y":100,"w":430,"h":300}'
  && JSON.stringify(rs("n", 0, -40)) === '{"x":100,"y":60,"w":400,"h":340}' && JSON.stringify(rs("w", 25, 0)) === '{"x":125,"y":100,"w":375,"h":300}');
check("resizeRect: the corners do both", JSON.stringify(rs("nw", -10, -20)) === '{"x":90,"y":80,"w":410,"h":320}' && JSON.stringify(rs("se", 5, 6)) === '{"x":100,"y":100,"w":405,"h":306}'
  && JSON.stringify(rs("ne", 10, 10)) === '{"x":100,"y":110,"w":410,"h":290}' && JSON.stringify(rs("sw", -10, 10)) === '{"x":90,"y":100,"w":410,"h":310}');
check("resizeRect: min / max held - a near edge stops where the minimum is (the far edge never moves)",
  JSON.stringify(rs("n", 0, 500, { w: 200, h: 90 })) === '{"x":100,"y":310,"w":400,"h":90}' && rs("e", 5000, 0, null, { w: 900 }).w === 900 && rs("w", 900, 0, { w: 240 }).x === 260);
check("edgeAt: the border pixel finds its edge (corners first), the inside nothing",
  D.edgeAt(200, 299, 400, 300) === "s" && D.edgeAt(1, 150, 400, 300) === "w" && D.edgeAt(399, 1, 400, 300) === "ne" && D.edgeAt(200, 150, 400, 300) === null);

// ---- plans + state
check("planOf: inside = a tab; a side docker stacks top / bottom (no left / right); a bottom docker: top / bottom stack, left / right a row - or above the row it already sits in",
  D.planOf("column", "inside") === "tab" && D.planOf("side", "inside") === "tab" && D.planOf("side", "top") === "side" && D.planOf("side", "left") === null
  && D.planOf("column", "bottom") === "stack" && D.planOf("column", "left") === "row" && D.planOf("column", "right", true) === "stack" && D.planOf("column", "x") === null);
const c1 = D.cleanState({ shown: true, mode: "tab", to: "ldock", side: "inside", active: true, dw: 99999, dh: "300" });
const c2 = D.cleanState({ mode: "dock", to: "" }), c3 = D.cleanState({ mode: "dock", to: "bad id!" }), c4 = D.cleanState(null);
check("cleanState: the fields kept and clamped; docked with no docker = floating; a bad id dropped",
  c1.mode === "tab" && c1.to === "ldock" && c1.active === true && c1.dw === 2000 && c1.dh === 300 && c2.mode === "float" && c3.mode === "float" && c3.to === ""
  && c4.mode === "float" && c4.x === -1 && c4.shown === false, { c1, c2, c3 });

// ---- lib/dockerStatus.js keeps them
const DS = require("../lib/dockerStatus.js");
const n = DS.normalize({ floats: { basic: { shown: true, mode: "tab", to: "ldock", active: true }, llmtok: { mode: "dock", to: "videodock", side: "right", dw: 360 } } }).floats;
const m = DS.merge(DS.normalize({}), { floats: { basic: { mode: "dock", to: "refsdock", side: "top", dh: 280 } } });
check("docker_status.json floats.<id>: mode / to / side / dw / dh / active kept (a tab's side = inside), merged per panel",
  n.basic.mode === "tab" && n.basic.side === "inside" && n.basic.active === true && n.llmtok.mode === "dock" && n.llmtok.side === "right" && n.llmtok.dw === 360
  && (m.floats || m).basic.dh === 280 && (m.floats || m).basic.to === "refsdock" && DS.normalize({}).floats.basic.mode === "float", { n, m: m.floats || m });

// ---- the wiring
const I = read("static", "index.html"), SF = read("static", "secfloat.js"), DF = read("static", "dockfloat.js"), PF = read("ext", "promptdock", "pfloat.js");
check("index.html loads static/dockfloat.js just before secfloat.js", /<script src="\/static\/dockfloat\.js"><\/script>[^\n]*\n<script src="\/static\/secfloat\.js"><\/script>/.test(I));
check("the column's handle: a dock with nothing open below grows from the docks ABOVE (nearest first, an elastic one flexes), put back if the drag turns",
  /const aboves = \[\];/.test(I) && /for \(const a of aboves\) \{\s+\/\/ 2\.398\.0/.test(I) && /for \(const a of aboves\) if \(a\.key\) setVar\(a\.key, a\.start\);/.test(I)
  && /if \(aKey && !belows\.length && !aboves\.length\) return;/.test(I));
check("a hidden docker's handle is hidden too (no empty seam)", /\.bdock\.dockgone \+ \.hsplit \{ display: none; \}/.test(I));
check("the prompt docker: no more resize:both - DockFloat.grips (floating: all eight; in a side docker: its bottom = --ph via setVar)",
  !/resize:both;/.test(PF) && /window\.DockFloat\.grips\(el, \{/.test(PF) && /el\.classList\.contains\("pf-side"\) \? "h"/.test(PF) && /setVar\("ph", r\.h\)/.test(PF)
  && /new MutationObserver\(\(\) => grip\.refresh\(\)\)/.test(PF));
check("Basic Settings / LLM tokens are DockFloat panels (no resize:both, no own drag), placed once the column is laid out, S / L kept",
  /window\.DockFloat\.panel\(\{/.test(SF) && !/resize:both;/.test(SF) && /function layoutReady\(\)/.test(SF) && /W\[id\]\.panel\.restore\(\)/.test(SF)
  && (/if \(!wants\(ev, W\[id\]\.spec\.key, a, dlg, owner( \|\| \(tlOwn && W\[id\]\.spec\.key === "l"\))?\)\) continue;/.test(SF)
     || /if \(!wants\(ev, sp\.key, a, dlg, sp\.free \? false : owner \|\| \(tlOwn && sp\.key === "l"\)\)\) continue;/.test(SF))   /* 2.419.0: spec.free / skip */ && /cleanState\(f\)/.test(SF));
check("dockfloat.js: tabs (a strip after the title bar, the docker's own + each panel, drag a tab out), rows share pf-row (the column code knows them)",
  /function tabsPaint\(host\)/.test(DF) && /hd\.after\(strip\)/.test(DF) && /p\.wireDrag\(b, true\)/.test(DF) && /row\.className = "pf-row df-row"/.test(DF)
  && /\.df-host\.df-guest-on > :not\(\.bhead\):not\(\.dockhead\)/.test(DF));
check("nothing added to server.js", !/dockfloat|DockFloat/.test(read("server.js")));

// ---- 2.401.4 (Tim: "add dropzones to the left docker so the basic settings and llm info can be docked inside the left docker")
const gaps = [{ key: "sec-system", y: 100 }, { key: "sfLaunch", y: 260 }, { key: "", y: 400 }];
check("gapAt: the nearest gap between the left docker's sections (above System / above the panel buttons / the end); none = null",
  D.gapAt(120, gaps).key === "sec-system" && D.gapAt(250, gaps).key === "sfLaunch" && D.gapAt(390, gaps).key === "" && D.gapAt(5, []) === null);
check("inlineLabel: 'Dock <panel> in <docker> - above <section>' / '- below <the last>'",
  D.inlineLabel("Basic Settings", "Settings", "System") === "Dock Basic Settings in Settings - above System"
  && D.inlineLabel("LLM tokens", "Settings", "", "Basic Settings") === "Dock LLM tokens in Settings - below Basic Settings");
const ci = D.cleanState({ shown: true, mode: "dock", to: "ldock", side: "inline", at: "sfLaunch" }), cj = D.cleanState({ mode: "dock", to: "ldock", side: "top", at: "sfLaunch" });
const ni = DS.normalize({ floats: { basic: { shown: true, mode: "dock", to: "ldock", side: "inline", at: "sec-system" }, llmtok: { mode: "dock", to: "ldock", side: "inline", at: "bad id!" } } }).floats;
check("cleanState + docker_status.json: side 'inline' + at kept (only for inline; a bad key = the end)",
  ci.side === "inline" && ci.at === "sfLaunch" && ci.mode === "dock" && cj.at === "" && ni.basic.side === "inline" && ni.basic.at === "sec-system" && ni.llmtok.at === "", { ci, ni });
const DF2 = read("static", "dockfloat.js");
check("the page: LISTS = the left docker's list; the drag lights a line in it before any edge zone; dockTo inline puts the panel above `at`; restore passes it",
  /const LISTS = \{ ldock: "#ldock > \.scroll" \}/.test(DF2) && /if \(!d\.zone\) for \(const t of d\.targets\)/.test(DF2)
  && /if \(plan === "inline"\) \{/.test(DF2) && /s\.mode === "tab" \? s\.active : undefined, s\.at\)/.test(DF2));

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
