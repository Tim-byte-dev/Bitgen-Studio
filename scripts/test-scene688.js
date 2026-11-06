#!/usr/bin/env node
/* bitGen Studio — 2.688.0: THE SKETCHER'S ✨ PHOTO PROMPT NAMES ONLY WHAT IS IN THE MODEL - ext/pushpulldock/ppreal.js
 * sceneWords / leadFor / promptFor (pure); the wiring of the other 2.688.0 changes (the bar, the end piece, Ctrl+drag).
 * The browser: scripts/test-ui688-ui.js.
 * Tim (verbatim): "... only add the objects in the scene to the photo generate - for example if there aren't any windows
 * don't add windows to the prompt" */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const R = require(path.join(ROOT, "ext", "pushpulldock", "ppreal.js"));
const D = { furn: (t) => ({ sofa: "Sofa", chair: "Chair", armchair: "Armchair", bench: "Bench" })[t] || t, mat: (k) => ({ plaster: "Plaster", tile: "Roof tiles", brick: "Brick", timber: "Timber" })[k] || k };
const room = (o) => Object.assign({ id: 1, name: "Room 1", pts: [[0, 0], [6, 0], [6, 4], [0, 4]] }, o || {});
// a room, a door, no window
const w1 = R.sceneWords({ rooms: [room({ wall: "mat:plaster" })], ops: [{ kind: "door", style: "single" }], items: [{ type: "sofa" }, { type: "chair" }, { type: "chair" }, { type: "armchair" }, { type: "person" }] }, [], D);
const p1 = R.promptFor("", null, w1);
check("a room + a door + furniture + a person: each named (counted, an / a), no window and no glass anywhere in the prompt",
  /a building with a room with walls and floors, a door, a sofa, 2 chairs, an armchair and a person\./.test(p1) && !/window|glass/i.test(p1) && /Real materials: plaster\./.test(p1), p1);
check("…it says to add nothing else - and does not list what not to add (that would prompt it)", /Show only what is in the render and add nothing else\./.test(p1) && !/no extra/i.test(p1));
// windows + a glass door = glass
const w2 = R.sceneWords({ rooms: [room({ wcol: { 0: "mat:brick" }, wext: { 2: "mat:timber" } })], ops: [{ kind: "window" }, { kind: "window" }, { kind: "door", style: "glass" }, { kind: "opening" }], roofs: [{ type: "hip", col: "mat:tile" }] }, [], D);
check("2 windows, a door, an open doorway, a hip roof; the wall colours kept per wall ({index: colour}) read; glass because of the windows",
  w2.parts.join("|") === "a room with walls and floors|a door|2 windows|an open doorway|a hip roof" && ["brick", "timber", "roof tiles", "glass"].every((m) => w2.materials.includes(m)), w2);
// no rooms: shapes only / the site
const w3 = R.sceneWords({ pools: [{}], roads: [{}, {}], terrain: { n: 1 } }, [], D), w4 = R.sceneWords({}, [{ mat: "mat:timber" }], D);
check("no building: the site's things (a pool, 2 roads, the ground) - not \"a building\"; only drawn shapes = the modelled 3D shapes in timber",
  !w3.building && /photograph of a swimming pool, 2 roads and the ground it stands on\./.test(R.leadFor(w3)) && /photograph of the modelled 3D shapes\. Real materials: timber\./.test(R.leadFor(w4)), [R.leadFor(w3), R.leadFor(w4)]);
check("several roofs of different types; a hidden room / piece left out", R.sceneWords({ rooms: [room(), room({ id: 2, hidden: true })], roofs: [{ type: "gable" }, { type: "flat" }], items: [{ type: "bench", hidden: true }] }, [], D).parts.join("|") === "a room with walls and floors|2 roofs (gable, flat)");
check("an empty model / none given: the 2.627.0 lead as it was (promptFor without a scene too)", R.leadFor(R.sceneWords({}, [], D)) === R.LEAD && R.promptFor("x").startsWith(R.LEAD) && R.promptFor("x", null, null).startsWith(R.LEAD));
const PR = fs.readFileSync(path.join(ROOT, "ext", "pushpulldock", "ppreal.js"), "utf8");
check("wired: run() writes the scene from the model and sends it with the prompt", /const scene = sceneWords\(P\.state\.M\.arch, P\.state\.M\.f/.test(PR) && /promptFor\(text, withBoard \? used : null, scene\)/.test(PR));
const DH = fs.readFileSync(path.join(ROOT, "ext", "pushpulldock", "dock.html"), "utf8"), AT = fs.readFileSync(path.join(ROOT, "ext", "pushpulldock", "pparchtools.js"), "utf8");
check("the bar: the docker clipped (never scrolled), the bar sticky, the view takes what is left", /#pushpulldock, #pushpulldock > #ppBody \{ overflow: clip !important; \}/.test(DH) && /#ppBar \{ flex: none; position: sticky; top: 0;/.test(DH) && /#ppMain \{ flex: 1 1 auto; display: flex; min-height: 220px;/.test(DH));
check("the end piece: a click = the whole wall, a double-click arms push / pull (not a split), dragEndPull along the wall; Ctrl+drag waits then replays as a plain press held to an axis",
  /D\.j\.kind === "end"\) \{ setSel\(\{ ak: "room", id: D\.R\.id, part: "wall"/.test(AT) && /je && je\.kind === "end"/.test(AT) && /function dragEndPull/.test(AT) && /mode: "ctrlwait"/.test(AT) && /st\.drag\.axisLock = true/.test(AT) && /ev\.shiftKey \|\| D\.axisLock/.test(AT));
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
