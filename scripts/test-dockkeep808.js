#!/usr/bin/env node
/* bitGen Studio — 2.808.0 pins: a ▣ custom docker keeps the dockers put in it (nothing but the user takes them out) and a docked
 * one sits with the docked dockers (z 1, its own stacking context), under every floating docker.
 * Tim (verbatim): "please fix the new custom docker in this case settings but fix all custom dockers that would be made. it
 * doesn't hold it's contents(other dockers) after restart and is in front of other dockers like model manager and gpu, but it
 * is a placeholder docker it should be at the level of the system docker + 1" */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n); } };
const src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const DG = src("static/dgdock.js"), SF = src("static/secfloat.js"), WS = src("static/workspaces.js"), DC = src("static/dockcfg.js"), GR = src("static/dockgroup.js"), FZ = src("static/floatz.js");
check("dgdock: holds(id) exported; a member moved out by anything but the user is put back (takeIn), not forgotten (no P().home in look)",
  /function holds\(id\)/.test(DG) && /holds, place, leaveCol/.test(DG) && /docker_member_back/.test(DG) && !/QUIET\[r\.id\] = true; P\(\)\.home\(r\.id\); rec\.home = \{ parent: doc\.body, before: null \}; \}\n    \}/.test(DG));
check("SecFloat.applyStates (⊞ layouts, workspaces, resets) skips a window in a ▣ docker", /H3DGDock\.holds\("sf\." \+ id\)\) continue;/.test(SF));
check("workspaces: setFloats and the prompt docker's restore leave ▣ members alone; ⊞ docker layout too",
  /holds\("sf\." \+ id\)\) return;/.test(WS) && /holds\("pf\.promptdock"\)/.test(WS) && /holds\("pf\.promptdock"\)/.test(DC));
check("a docked ▣ docker: position relative, z-index 1, isolation isolate; its members' own z ignored",
  /\.bdock\.dgperm\{position:relative;z-index:1;isolation:isolate\}/.test(GR) && /\.bdock\.dgperm \.secfloat,\.bdock\.dgperm #promptdock\{z-index:auto!important\}/.test(GR));
check("floatz: a docker / dialog that stops floating leaves the order and loses its band z", /before === true && !floating\(w\)\) drop\(w\)/.test(FZ));
console.log("\nRESULT: " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
