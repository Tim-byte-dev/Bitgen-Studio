#!/usr/bin/env node
/* bitGen Studio — 2.664.0: THE SKETCHER'S MANNEQUIN MODEL (ext/pushpulldock/ppfurn.js pose "mannequin" + the licensed asset
 * ext/pushpulldock/assets/mannequin-female.json - kept out of the public repo) + its credits (lib/credits.json "3D models").
 * The clicks: scripts/test-ui664-ui.js.
 * Tim (verbatim): "can you use these models for our mannequins - and give credit to
 * https://www.cgtrader.com/designers/dimasalcalde ... and https://www.cgtrader.com/designers/zahers ..." */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 400))); } };
globalThis.H3HouseGeo = { POSES: { stand: "standing", sit: "sitting" }, CATALOGUE: {}, MATERIALS: {} };
const F = require(path.join(ROOT, "ext/pushpulldock/ppfurn.js"));
check("the poses: + mannequin (model) beside the House builder's", F.POSES().mannequin === "mannequin (model)" && F.POSES().stand === "standing");
const it = F.make("person", [1, 2], 0, 0, "", "mannequin");
check("a person made with it keeps the pose; its label says so", it.pose === "mannequin" && /mannequin \(model\)/.test(F.label(it)));
check("clean keeps it", F.clean([Object.assign({ id: 3 }, it)])[0].pose === "mannequin");
const GI = fs.readFileSync(path.join(ROOT, ".gitignore"), "utf8"), MZ = fs.readFileSync(path.join(ROOT, "scripts/make_zips.sh"), "utf8");
check("the licensed model never in the public repo / the release zips (.gitignore + make_zips.sh)", /^ext\/pushpulldock\/assets\/$/m.test(GI) && /\.\/ext\/pushpulldock\/assets\/\*/.test(MZ));
const C = JSON.parse(fs.readFileSync(path.join(ROOT, "lib/credits.json"), "utf8")), S = C.sections.find((s) => s.title === "3D models");
check("credits: 3D models - dimasalcalde and zahers (CGTrader, their links as Tim gave them)", S && S.items.some((i) => i.url === "https://www.cgtrader.com/designers/dimasalcalde?utm_source=credit&utm_source=credit_item_page") && S.items.some((i) => i.url === "https://www.cgtrader.com/designers/zahers?utm_source=credit&utm_source=credit_item_page"));
check("…and in the Guide's Credits (docs/USAGE.md)", /dimasalcalde/.test(fs.readFileSync(path.join(ROOT, "docs/USAGE.md"), "utf8")) && /zahers/.test(fs.readFileSync(path.join(ROOT, "docs/USAGE.md"), "utf8")));
const A = path.join(ROOT, "ext/pushpulldock/assets/mannequin-female.json");
if (fs.existsSync(A)) { const j = JSON.parse(fs.readFileSync(A, "utf8")); const zs = j.pos.filter((_, i) => i % 3 === 2);
  check("the model here: feet at 0, 1 high (scaled to the person), its triangles' corners all there", Math.min(...zs) === 0 && Math.max(...zs) === 1 && j.idx.length % 3 === 0 && Math.max(...j.idx) < j.pos.length / 3 && j.nrm.length === j.pos.length); }
else console.log("SKIP: the model file is not here (it ships apart) - its own check did not run");
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
