#!/usr/bin/env node
/* bitGen Studio — 2.936.0 units: 🚓 POLICE CHASE's ART PACK - scripts/chase_assets.py + scripts/chase_bake.py make
 * ext/chasedock/assets/ (never in the repo), ext/chasedock/chasedock.js shows it when it is there. */
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 500))); } };
const src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const A = src("scripts/chase_assets.py"), B = src("scripts/chase_bake.py"), JS = src("ext/chasedock/chasedock.js");
check("chase_bake.py: every innermost collection taller than 1.5 m = a building, rendered alone (Cycles, orthographic, transparent) from +X, -X, -Y, +Y and above",
  /def leaves\(c\)/.test(B) && /hi\.z - lo\.z < 1\.5/.test(B) && /cam_d\.type = "ORTHO"/.test(B) && /r\.film_transparent = True/.test(B)
  && ["\"pz\"", "\"nz\"", "\"px\"", "\"nx\"", "\"py\""].every((f) => B.includes(f)) && /o\.hide_render = o not in keep/.test(B) && /bake\.json/.test(B));
check("...works in the Blender app (after --) and in a Python with bpy; the models themselves never leave Blender", /sys\.argv\.index\("--"\)/.test(B) && /open_mainfile/.test(B) && !/export_scene/.test(B));
check("chase_assets.py: roads cut from the kit's atlas (straight, plain, pavement, plaza), the buildings' PNGs to JPG on a dark fill, pack.json v1 with credits",
  /ROAD_CROPS = \{/.test(A) && ["straight", "plain", "pavement", "plaza"].every((k) => A.includes('"' + k + '"')) && /alpha_composite/.test(A) && /"version": 1/.test(A) && /--credit/.test(A) && /--bpy-python/.test(A));
check("the pack is never committed nor zipped (.gitignore = misc/_gitignore, make_zips.sh)", /^ext\/chasedock\/assets\/$/m.test(src(".gitignore")) && src(".gitignore") === src("misc/_gitignore") && /! -path "\.\/ext\/chasedock\/assets\/\*"/.test(src("scripts/make_zips.sh")));
check("chasedock.js: pack.json read before the first city (no pack = the painted city, as before)", /started = three\(\)\.then\(loadPack\)/.test(JS) && /r\.ok \? r\.json\(\) : null/.test(JS) && /j\.version !== 1\) return null/.test(JS));
check("...the ground from the road pictures (64 px a tile; straights turned to the road; no painted lane marks over them)",
  /P = RP \? 64 : CITY \? 32 : 48/.test(JS) /* 2.939.0: 48 for the other settings */ && /if \(RP\) paintRoads\(g, m, P, home, RP\)/.test(JS) && /g\.rotate\(Math\.PI \/ 2\)/.test(JS) && /y3 < m\.H && !RP && CITY/.test(JS) && /y < m\.H && !RP && CITY/.test(JS));
check("...each block a building of the pack: a box wearing its five pictures in three.js's face order, a random one, a random quarter turn, the footprint 0.94 of a tile",
  /var mats = \[mat\("px"\), mat\("nx"\), mat\("py"\), new T\.MeshStandardMaterial\(\{ color: 0x161b26 \}\), mat\("pz"\), mat\("nz"\)\]/.test(JS)
  && /Math\.floor\(R\(\) \* PB\.length\)/.test(JS) && /Math\.floor\(R\(\) \* 4\)/.test(JS) && /0\.94 \/ Math\.max\(sz\[0\], sz\[1\]/.test(JS) && /new T\.InstancedMesh\(new T\.BoxGeometry\(1, 1, 1\), mats, list\.length\)/.test(JS));
check("...the edge of the city keeps its low wall; the pictures' loading draws once more; the credits on the title", /if \(!edge && PB\)/.test(JS) && /G\.camSettling = Math\.max\(G\.camSettling \|\| 0, 2\); kick\(\)/.test(JS) && /G\.pack\.json\.credits\.map\(esc\)/.test(JS));
// roadKind (pure) - pulled out of the page script
const rk = JS.slice(JS.indexOf("function roadKind"), JS.indexOf("function paintRoads"));
const ctx = { C: require("../ext/chasedock/chasecore.js") }; vm.createContext(ctx); vm.runInContext(rk + "; this.roadKind = roadKind;", ctx);
const m = ctx.C.makeMaze(7, 21, 17);
let h = 0, v = 0, x = 0; for (let yy = 1; yy < m.H - 1; yy++) for (let xx = 1; xx < m.W - 1; xx++) { if (!ctx.C.open(m, xx, yy)) continue; const k = ctx.roadKind(m, xx, yy); if (k === "h") h++; else if (k === "v") v++; else x++; }
check("roadKind: straights left-right / up-down, everything else a junction or a corner", h > 10 && v > 10 && x > 10 && ctx.roadKind(m, 1, 1) === "x", { h, v, x });
check("server.js untouched", !/chase/i.test(src("misc/server.js")));
console.log(`\n${pass} passed, ${fail} failed`);
console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
process.exit(fail ? 1 : 0);
