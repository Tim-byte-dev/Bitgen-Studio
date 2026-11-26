#!/usr/bin/env node
// bitGen Studio 2.978.0 - ONE PICTURE PICKER (Gallery / Assets / References / a folder / a file) for 🧱 Picture → 3D scene and
// the 📚 Daz library's face photo; 💾 saved Daz characters. Tim: "the create 3d from picture does not load the picture. it should
// load from gallery,assets, references or from a folder select and continue with the daz work". Browser leg: test-ui978-ui.js.
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let P = 0, F = 0;
const check = (n, ok, got) => { if (ok) { P++; console.log("PASS:", n); } else { F++; console.log("FAIL:", n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 500))); } };
const src = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const K = require(path.join(ROOT, "ext/pushpulldock/pppicpick.js"));
check("the picker's sources: Gallery, Assets, References, Folder, File", JSON.stringify(K.SOURCES.map((x) => x[0])) === JSON.stringify(["gallery", "assets", "refs", "folder", "file"]));
check("isPic(): pictures only", K.isPic("a.PNG") && K.isPic("b.jpeg") && K.isPic("c.webp") && !K.isPic("d.mp4") && !K.isPic(""));
const pk = src("ext/pushpulldock/pppicpick.js");
check("the picker: /api/outputs (Gallery), /api/passets (Assets), the page's refs (References), webkitdirectory (Folder), a tile that will not load says so",
  /\/api\/outputs\?kind=images/.test(pk) && /\/api\/passets/.test(pk) && /typeof refs !== "undefined"/.test(pk) && /webkitdirectory/.test(pk) && /can't show/.test(pk) && /\/api\/dazlib\/photo/.test(pk));
const sc = src("ext/pushpulldock/ppscene.js"), dl = src("ext/pushpulldock/ppdazlib.js"), ext = JSON.parse(src("ext/pushpulldock/ext.json")).scripts;
check("🧱 Picture → 3D scene uses the picker (a name + where, or the picture's bytes)", /H3PicPick\.mount\(\$\("pscPicker"\)/.test(sc) && /name: pk\.name, where: pk\.where/.test(sc) && /body: blob/.test(sc) && !/pscPics/.test(sc));
check("📚 the face photo uses the picker (blobs saved to the project first)", /H3PicPick\.mount\(\$\("pdlFacePick"\)/.test(dl) && /H3PicPick\.toProject\(st\.face\)/.test(dl));
check("💾 save / 📂 load a Daz character", /\/api\/dazlib\/chars/.test(dl) && /function loadChar/.test(dl) && /app\.post\("\/api\/dazlib\/chars"/.test(src("routes/dazLibrary.js")) && /app\.post\("\/api\/dazlib\/photo"/.test(src("routes/dazLibrary.js")));
check("ext.json: pppicpick.js before the dialogs that use it", ext.indexOf("pppicpick.js") >= 0 && ext.indexOf("pppicpick.js") < ext.indexOf("ppdazlib.js") && ext.indexOf("pppicpick.js") < ext.indexOf("ppscene.js"));
const S = require(path.join(ROOT, "lib/picScene.js"));
check("runFiles(): everything a 🧱 run needs besides the style - Hunyuan3D 2.1 (auto) / TRELLIS.2's 5 files, + Stable Audio Open's 2 with sound",
  JSON.stringify(S.runFiles({ engine: "auto", sound: "1" }).map((x) => x.name)) === JSON.stringify(["hunyuan_3d_v2.1.safetensors", "stable-audio-open-1.0.safetensors", "t5_base.safetensors"])
  && S.runFiles({ engine: "trellis", sound: "0" }).length === 5);
check("ONE models check: /api/models/check {kind, style_id, extra_loras, files} = the style's files + these; the 🧱 dialog sends it before it starts (and before ↻)",
  /if \(b\.kind\) \{ const p = plan\(b\)/.test(src("routes/modelsFound.js")) && /files: \(need && need\.files\) \|\| \[\]/.test(sc) && (sc.match(/MF\.ensure\(/g) || []).length === 2 && !/\/api\/picscene\/needs"\);/.test(sc));
check("a failed job says why (models not found / its error lines); ↻ Try again carries on (POST /api/picscene/:id/retry)", /models not found: /.test(src("lib/picScene.js")) && /function retry\(id\)/.test(src("lib/picScene.js")) && /\/retry"/.test(src("routes/picScene.js")) && /pscRetry/.test(sc));
check("the docs", /📌 References/.test(src("docs/USAGE.md")) && /2\.978\.0/.test(src("misc/CHANGELOG.md")));
console.log(`\n${P} passed, ${F} failed`);
process.exit(F ? 1 : 0);
