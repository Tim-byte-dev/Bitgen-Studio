#!/usr/bin/env node
/* bitGen Studio — 2.998.0: ✨ Photo's finished picture in the gallery, its steps out of it (routes/sketcherPhoto.js).
 * Tim: "edit sketcher is working better but it shows both renders in gallery, only show the finished render" */
"use strict";
const fs = require("fs"), path = require("path"), os = require("os");
const ROOT = path.join(__dirname, ".."), src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 500))); } };
const SP = require(path.join(ROOT, "routes/sketcherPhoto.js"));
check("safeName: a plain name, .png added, no folders / odd characters", SP.safeName("../x/sketcher real é.png") === "sketcher_real_.png" && SP.safeName("a") === "a.png" && SP.safeName("") === "sketcher_real.png");
const t = fs.mkdtempSync(path.join(os.tmpdir(), "sp998_")), out = path.join(t, "output"), steps = path.join(t, "temp", "sketcher-steps");
fs.mkdirSync(out, { recursive: true }); ["s1.png", "s2.png", "keep.png"].forEach((n) => fs.writeFileSync(path.join(out, n), n)); fs.writeFileSync(path.join(t, "outside.png"), "x");
check("freeName: x.png, then x_2.png when taken", SP.freeName(out, "s1.png") === "s1_2.png" && SP.freeName(out, "new.png") === "new.png");
const moved = ["s1.png", "s2.png", "../outside.png", "nope.png", "notes.txt"].filter((n) => SP.dropStep(out, steps, n));
check("dropStep: the steps' pictures MOVED out of output/ into temp/sketcher-steps; never a file outside output/, a missing one or a non-picture",
  moved.join() === "s1.png,s2.png" && !fs.existsSync(path.join(out, "s1.png")) && fs.existsSync(path.join(steps, "s1.png")) && fs.existsSync(path.join(t, "outside.png")) && fs.existsSync(path.join(out, "keep.png")), moved);
fs.rmSync(t, { recursive: true, force: true });
const PR = src("ext/pushpulldock/ppreal.js"), IX = src("routes/index.js");
check("every step's job output recorded (aiJob(…, R) -> R.outs) - step 1, its second try, step 2, its second try", (PR.match(/aiJob\([^\n]*, R\)/g) || []).length === 7 && /if \(R\) \(R\.outs = R\.outs \|\| \[\]\)\.push\(out\);/.test(PR));
check("…when done: POST /api/sketcher/photo with the finished picture + drop = those outputs, then the gallery refreshed", /root\.fetch\("\/api\/sketcher\/photo", \{ method: "POST", body: gf \}\)/.test(PR) && /gf\.append\("drop", JSON\.stringify\(R\.outs \|\| \[\]\)\)/.test(PR) && /root\.refreshGallery\(\)/.test(PR));
check("mounted from routes/index.js (not server.js)", /require\("\.\/sketcherPhoto"\)\.mount\(app\);/.test(IX) && !/sketcherPhoto/.test(src("misc/server.js")));
console.log("\nRESULT: " + pass + " passed, " + fail + " failed");
process.exitCode = fail ? 1 : 0;
