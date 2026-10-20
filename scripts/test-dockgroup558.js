#!/usr/bin/env node
/* bitGen Studio — 2.558.0 units: the ▣ docker in the app's floating band, the side dockers and the StoryBoard dragged in
 * (static/dockgroup.js). Tim: "the new docker still doesn't work. i suspect it's z-index it too high = putting it above all
 * other dockers so nothing can find its drop zones". */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 500))); } };
const G = require(path.join(ROOT, "static", "dockgroup.js"));
const DG = fs.readFileSync(path.join(ROOT, "static", "dockgroup.js"), "utf8"), SF = fs.readFileSync(path.join(ROOT, "static", "secfloat.js"), "utf8"), PF = fs.readFileSync(path.join(ROOT, "ext", "promptdock", "pfloat.js"), "utf8");
check("Z: the ▣ dockers' band sits with the app's other floating dockers (the prompt docker 44, Basic Settings 47 / 49) - not 9300",
  G.Z.base === 45 && G.Z.front === 48 && /#promptdock\.pf-float\{position:fixed;z-index:44/.test(PF) && /\.secfloat\.df-float\{position:fixed;z-index:47/.test(SF) && /\.h3fp\.dg-app\{z-index:" \+ Z\.base \+ "\}\.h3fp\.dg-app\.dg-front\{z-index:" \+ Z\.front/.test(DG));
check("CANDIDATES: the main dockers + the side dockers (Settings, References, Assets, Queue, Gallery); not the prompt docker; the StoryBoard through its own record (OWN sb.dock)",
  ["ldock", "refsdock", "assetsdock", "qdock", "rdock", "musicdock", "previewdock"].every((x) => G.CANDIDATES.includes(x)) && !G.CANDIDATES.includes("promptdock") && !G.CANDIDATES.includes("videodock") && G.OWN.videodock === "sb.dock");
check("SIDE: each side docker's column class on #app", G.SIDE.refsdock === "no-refs" && G.SIDE.ldock === "no-left" && G.SIDE.qdock === "no-queue" && G.SIDE.rdock === "no-right" && G.SIDE.assetsdock === "no-assets");
check("wiring: a side docker out = a stand-in in its grid place + its column closed, home = the stand-in gone + the column open; the ▣ dockers outlined while dragging; markApp on the windows; a press = the front",
  /function sideState\(id, d, s\)/.test(DG) && /x\.id = "dgph_" \+ id/.test(DG) && /app\.classList\.add\(SIDE\[id\]\)/.test(DG) && /if \(s === "home"\) \{ if \(ph\) ph\.remove\(\); if \(app\) app\.classList\.remove\(SIDE\[id\]\)/.test(DG)
  && /g\.win\.classList\.add\("dg-target"\)/.test(DG) && /w\.classList\.add\("dg-front"\)/.test(DG) && /:scope > \.dockhead/.test(DG) && /headDrag\(h, id, pid\)/.test(DG));
console.log(`\n${pass} passed, ${fail} failed`);
console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
process.exit(fail ? 1 : 0);
