#!/usr/bin/env node
// bitGen Studio 2.929.0 - ✨ Lifelike: the display mannequin made real by an edit style on your PC.
// Tim: "your mannequins don't look human" -> "3D + your PC makes them real" -> "go next".
// Units: the prompt (pure - each view, male / female, faceless gloss on black, the pose kept), the wiring (ext.json after
// h3sheet.js, the views route, the library). The browser run: test-ui929-ui.js. Run: node scripts/test-929.js
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let P = 0, F = 0;
const check = (n, ok, got) => { if (ok) { P++; console.log("PASS:", n); } else { F++; console.log("FAIL:", n, got === undefined ? "" : JSON.stringify(got).slice(0, 400)); } };
const src = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const L = require("../ext/videodock/mannequinlife.js");
const m = L.prompt("male", "front"), f = L.prompt("female", "side"), bk = L.prompt("male", "back");
check("the views: front, side, back", L.VIEWS.join() === "front,side,back");
check("the prompt: <Picture 1> made a photographed glossy white fibreglass store mannequin, faceless egg head, on black", [m, f, bk].every((p) => /^Turn <Picture 1> into a photorealistic studio photograph/.test(p) && /glossy white fibreglass/.test(p) && /faceless egg-shaped head with no eyes, nose, mouth, ears or hair/.test(p) && /Pure black background/.test(p)));
check("…keeps the pose, the proportions, the arms, the camera and the framing", [m, f, bk].every((p) => /Keep the pose, the body proportions, the arms, the camera angle and the framing exactly the same/.test(p)));
check("…the body by sex (athletic sculpted male, slim elegant female) and the view named", /athletic male/.test(m) && /slim, elegant female/.test(f) && /from the front/.test(m) && /in profile/.test(f) && /from behind/.test(bk));
check("…no clothes, no text, no stand", /no clothes, no text, no stand/.test(m));
const EJ = JSON.parse(src("ext/videodock/ext.json"));
check("ext.json: mannequinlife.js right after h3sheet.js", EJ.scripts.indexOf("mannequinlife.js") === EJ.scripts.indexOf("h3sheet.js") + 1);
const R = src("routes/charSheetH3.js"), ML = src("ext/videodock/mannequinlife.js");
check("POST /api/charsheet/h3/mannequin-view puts the view in the project's Images (front / side / back only)", /app\.post\("\/api\/charsheet\/h3\/mannequin-view"/.test(R) && /"mannequin-" \+ sex \+ "-" \+ view \+ "\.png"/.test(R) && /\["front", "side", "back"\]\.includes\(view\)/.test(R));
check("the client: an EDIT style (2.934.0: the picked style when it edits, else the first), one view at a time, the sheet into the library, a failure said", /\/api\/aiedit\/engines/.test(ML) && /st\.picStyle/.test(ML) && /VIEWS\.reduce/.test(ML) && /\/api\/charsheet\/library\/mannequins/.test(ML) && /could not be kept in your mannequins/.test(ML));
check("server.js untouched", !/mannequin-view/.test(src("misc/server.js")));
console.log("\n" + P + " passed, " + F + " failed");
process.exit(F ? 1 : 0);
