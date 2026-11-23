#!/usr/bin/env node
/* bitGen Studio — 2.937.0 units: 🚓 POLICE CHASE's 3D CARS, BURGERS AND A CAKE.
 * Tim: "it would be nice if the cars were the 3d models with a little aesthetics and the square cubes were hamburgers or cakes" */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 500))); } };
const src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const CC = src("scripts/chase_car.py"), A = src("scripts/chase_assets.py"), JS = src("ext/chasedock/chasedock.js"), DH = src("ext/chasedock/dock.html");
check("chase_car.py: .fbx / .glb / .obj in, the insides left out (--drop), one mesh, nose turned to +Y (--turn), centred, wheels on the ground",
  /import_scene\.fbx/.test(CC) && /import_scene\.gltf/.test(CC) && /obj_import/.test(CC) && /DROP/.test(CC) && /bpy\.ops\.object\.join\(\)/.test(CC)
  && /Matrix\.Rotation\(math\.radians\(TURN\), 4, "Z"\)/.test(CC) && /-lo\.z/.test(CC));
check("...cut down with Decimate to --tris, the paint renamed Body, textures shrunk to --tex, a binary glTF out",
  /"DECIMATE"/.test(CC) && /mod\.ratio = max\(0\.005, TRIS \/ tris0\)/.test(CC) && /m\.name = "Body"/.test(CC) && /im\.scale\(/.test(CC) && /export_format="GLB"/.test(CC));
check("chase_assets.py: --getaway / --police copied into cars/, pack.json cars {getaway, police}", /for role in \("getaway", "police"\)/.test(A) && /pack\["cars"\]\[role\] = "cars\/" \+ role \+ "\.glb"/.test(A));
check("chasedock.js: the pack's cars loaded with the glTF loader (a car that fails stays a box)", /new T\.GLTFLoader\(\)/.test(JS) && /G\.pack\.cars\[role\] = gl\.scene/.test(JS) && /if \(o\.model\) return modelCar\(o\)/.test(JS));
check("...a model car: its own materials, 0.8 of a tile, wheels on the ground; police: Body in the car's colour + our red / blue light bar",
  /m0\.clone\(\)/.test(JS) && /k = 0\.8 \/ Math\.max\(sz\.x, sz\.z/.test(JS) && /car\.position\.y -= bb\.min\.y/.test(JS) && /m0\.name === "Body"/.test(JS) && /m\.color\.setHex\(o\.body\)/.test(JS)
  && /c\.red = M\(/.test(JS) && /c\.blue = M\(/.test(JS));
check("the pick-ups are burgers (bun, patty, cheese, lettuce, bun - five instanced layers moving together)",
  /function burgerParts\(\)/.test(JS) && (JS.match(/lay\(/g) || []).length >= 5 && /V\.cash = burgerParts\(\)\.map/.test(JS) && /V\.cash\[L\]\.setMatrixAt\(j, M4\)/.test(JS));
check("...the bonus a cake (plate, pink sponge, icing, cream tier, a cherry, a candle); the words say burgers",
  /V\.bonus = makeCake\(\)/.test(JS) && /function makeCake\(\)/.test(JS) && /the cherry/.test(JS) && /a candle/.test(JS) && /Pick up every burger/.test(JS) && /Pick up every burger/.test(DH) && !/bag of cash/.test(JS + DH));
check("server.js untouched", !/chase/i.test(src("misc/server.js")));
console.log(`\n${pass} passed, ${fail} failed`);
console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
process.exit(fail ? 1 : 0);
