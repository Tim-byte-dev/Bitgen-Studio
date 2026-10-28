#!/usr/bin/env node
/* bitGen Studio — 2.609.0 (pure + wiring): THE IMAGE EDITOR'S PANEL COLUMN TAKES ANY FLOATING DOCKER, KEPT.
 * Tim: "add docker dropzones to the image-editor panel where layers are in so user can add floating dockers to that
 * panel. pending docker should be able to dock in that panel" + "also keep the dockers status and parent dockers saved .
 * when the parent docker is visible keep all child dockers within the parent".
 *   pccoldock.js   keyOfPart, parseKey, placeIndex (where a docked docker goes back among the parts there now)
 *   floatpanels    zone hosts with slot(): zoneInto (queued until the host is there), zoneOut, state "zone" kept in
 *                  panel_layout.cfg (+ restored by adopt / newDocker), leaving a zone on float / home / dockInto
 *   dgdock         Basic Settings / LLM tokens / the prompt docker / ▣ dockers into a zone host; members restored
 *   pcpending      its title drag docks it; moveTo; the editor installs pccoldock last */
"use strict";
const fs = require("fs");
const path = require("path");
const R = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const read = (p) => fs.readFileSync(path.join(R, p), "utf8");

const C = require(path.join(R, "ext", "imageeditdock", "pccoldock.js"));
check("keyOfPart: an editor group by its data-g, a docked docker as fd:<id>, anything else nothing",
  C.keyOfPart({ dataset: { g: "layers" } }) === "layers" && C.keyOfPart({ dataset: { fd: "bd.assetsdock" } }) === "fd:bd.assetsdock" && C.keyOfPart({ dataset: {} }) === null && C.keyOfPart(null) === null);
check("parseKey: before / after a part, first, the end", JSON.stringify(C.parseKey("after:fd:bd.qdock")) === JSON.stringify({ how: "after", ref: "fd:bd.qdock" })
  && C.parseKey("before:layers").how === "before" && C.parseKey("first").how === "first" && C.parseKey("end").how === "end" && C.parseKey(undefined).how === "end");
const order = ["color", "fd:ie.pending", "props", "fd:bd.assetsdock", "layers", "fd:sf.basic"];
check("placeIndex: back before the first part after it in the kept order that is here (the editor's groups in any order of arrival)",
  C.placeIndex(order, ["color", "props", "layers"], "fd:ie.pending") === 1 && C.placeIndex(order, ["color", "props", "layers"], "fd:bd.assetsdock") === 2
  && C.placeIndex(order, ["color", "props", "layers"], "fd:sf.basic") === 3 && C.placeIndex(order, ["layers"], "fd:ie.pending") === 0
  && C.placeIndex(order, [], "fd:sf.basic") === 0 && C.placeIndex(order, ["color", "props"], "fd:new") === 2 && C.placeIndex(order, ["color", "fd:ie.pending"], "fd:sf.basic") === 2);

const FP = read("static/floatpanels.js");
check("floatpanels: zone hosts with slot() take any docker (zoneInto - queued until the host loads, then put in), zoneOut (floatOut or a window), its state \"zone\" + {host, key} kept and put back (adopt / newDocker)",
  /function zoneInto\(id, hostId, key\)/.test(FP) && /\(ZQ\[hostId\] = ZQ\[hostId\] \|\| \[\]\)\.push\(\[id, key\]\)/.test(FP) && /if \(o\.slot && ZQ\[o\.id\]/.test(FP)
  && /function zoneOut\(id, at\)/.test(FP) && /if \(r\.floatOut\)/.test(FP) && /lay\.state === "zone" && lay\.zone && lay\.zone\.host\) \{ Object\.assign/.test(FP)
  && /if \(lay && lay\.state === "zone" && lay\.zone && lay\.zone\.host\) \{ restoring\+\+; try \{ zoneInto\(id/.test(FP) && /s\.zone = \{ host: r\.zone\.host, key:/.test(FP) && /else if \(r\.zoneWant\) \{ s\.state = "zone"/.test(FP));
check("…a docker out of a zone first (float / home / into a ▣ docker): its place in the column goes", (FP.match(/if \(r\.state === "zone"\) leaveZone\(r\);/g) || []).length >= 3 && /h3fp\.h3fp-zoned\{position:relative!important/.test(FP));
global.window = undefined;
const P = require(path.join(R, "static", "floatpanels.js"));
check("…exported: zoneInto, zoneOut, zoneMark, zones", ["zoneInto", "zoneOut", "zoneMark", "zones", "zoneHost", "zoneAt"].every((k) => typeof P[k] === "function"));
const DG = read("static/dgdock.js");
check("dgdock: Basic Settings / LLM tokens / the prompt docker dragged over a zone host go in (takeInZone), a ▣ docker too; members kept in a zone come back at the start",
  /function takeInZone\(id, zh\)/.test(DG) && /if \(c\.zh\) root\.setTimeout\(\(\) => takeInZone/.test(DG) && /if \(s === "in" \|\| s === "zone"\)/.test(DG) && /lay\[id\]\.state === "zone" && lay\[id\]\.zone/.test(DG) && /P\(\)\.zoneInto\(id, zh\.host\.id, zh\.zone\.key\)/.test(DG));
const PD = read("ext/imageeditdock/pcpending.js"), CD = read("ext/imageeditdock/pccoldock.js");
check("⏳ Pending: its title drag shows the column's line and docks it there; docked its own drag stays off; floats back where it is let go (moveTo)",
  /E\.coldock\.hover\(ev\.clientX, ev\.clientY\)/.test(PD) && /E\.coldock\.drop\(ev\.clientX, ev\.clientY\)/.test(PD) && /box\.closest\("\.pcfd"\)\) return/.test(PD) && /function moveTo\(at\)/.test(PD)
  && /id: "ie\.pending", title: "⏳ Pending", el: pend/.test(CD) && /r\.floatOut = \(at\) =>/.test(CD));
check("pccoldock: the column host (slot / free / keyOf / zones / drop), the bar (fold kept, drag in the column / out, ⇱, ⚙), its height kept; the docked ones hide with the editor",
  /P\.zoneHost\(\{ id: HOST, el: .*zones, drop, slot, free, keyOf \}\)/.test(CD) && /store\.set\(FKEY\(id\), on\)/.test(CD) && /store\.set\(HKEY\(id\)/.test(CD) && /P\.zoneOut\(id,/.test(CD) && /P\.cfgMenu\(id/.test(CD)
  && /pcfd:has\(>\.pcfdb>\.off\)/.test(CD));
const ej = JSON.parse(read("ext/imageeditdock/ext.json")).scripts, IE = read("ext/imageeditdock/imageedit.js");
check("the editor loads pccoldock.js after pctabdock.js and installs it last (every tab and Pending exist)",
  ej.indexOf("pccoldock.js") === ej.indexOf("pctabdock.js") + 1 && IE.indexOf("PCColDock.install(E)") > IE.indexOf("PCTabDock.install(E)") && IE.indexOf("PCColDock.install(E)") > IE.indexOf("PCPending.install(E)"));
check("server.js untouched by this release", !/coldock|zoneInto/i.test(read("misc/server.js")));

console.log(`\n${pass} passed, ${fail} failed`);
console.log("RESULT: " + fail + " failed");
process.exit(fail ? 1 : 0);
