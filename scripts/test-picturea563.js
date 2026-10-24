#!/usr/bin/env node
/* bitGen Studio — 2.563.0 units: 🅰 Picture A on the ✎ First frame (lib/sceneEdit.js plan / pickPlace / llmMessages /
 * cleanWritten / setPic pica, routes/sceneedit.js gather / write / pictures), every scene's pictures in the pickers
 * (lib/scenePictures.js, the 🎬 Scenes tab, 🎞 Clips for the reference pictures - routes/characters.js refs/project).
 * Tim: "in the scene frame in storyboard, allow user to add reference images to each scene, include images from previous
 * scenes. maybe we can use a reference image as the start frame but keep location the same - we use the llm to say, scene
 * starts with "ref image we choose(picture a)", style, composition and pose is exactly the same as (picture a), and we add
 * reference image for our new location, if location remains unchanged use the global prompts location". */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const rd = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const E = require(path.join(ROOT, "lib", "sceneEdit.js"));

/* 1 the record + the base */
check("BASES + picture; safe keeps Picture A (pica); a record with only Picture A is not blank",
  E.BASES.includes("picture") && E.safe({ pica: { file: "qe_pica.png", label: "scene 1 · First frame" } }).pica.file === "qe_pica.png" && !E.isBlank({ pica: { file: "qe_pica.png" } }) && E.safe({ pica: { file: "x.png" } }).pica === null);
check("resolveBase: Auto with a Picture A = picture (before continue / location); a chosen base stays",
  E.resolveBase("auto", { hasPicA: true, canContinue: true, hasLocation: true }) === "picture" && E.resolveBase("auto", { canContinue: true }) === "continue" && E.resolveBase("location", { hasPicA: true }) === "location");

/* 2 the plan */
const A = "/x/a.png", L = "/x/loc.png", V = "/x/pier_view.png";
const p1 = E.plan({ base: "picture", picAPath: A, picALabel: "scene 1 · First frame", locationPath: L, chars: [{ name: "Mara", path: "/x/m.png" }], props: [{ path: "/x/qe_prop_1_cup.png", label: "cup" }], sceneText: "Mara waits" });
check("Picture A + a 📍 location: <image1> = Picture A (its style, composition, framing, poses kept exactly), <image2> = the new location, then the cast and props",
  p1.images.join() === [A, L, "/x/m.png", "/x/qe_prop_1_cup.png"].join() && /^This scene starts from <image1> \(Picture A\): its style, composition, camera framing and the people's poses and positions stay exactly the same as in <image1>\./.test(p1.prompt)
  && /Move them into the location shown in <image2>/.test(p1.prompt) && /exactly like the character in <image3>/.test(p1.prompt) && /^Picture A: scene 1/.test(p1.roles[0]), p1);
const p2 = E.plan({ base: "picture", picAPath: A, place: { name: "Pier", path: V }, sceneText: "x" });
check("no 📍 picture: the place the scene / the global prompt names, with its view picture", p2.images.join() === [A, V].join() && /The place is Pier, shown in <image2>/.test(p2.prompt) && p2.roles[1] === "the location: Pier", p2);
const p3 = E.plan({ base: "picture", picAPath: A, place: { name: "Pier" } }), p4 = E.plan({ base: "picture", picAPath: A });
check("...a named place with no picture = in words; no place at all = Picture A's own place kept",
  p3.images.length === 1 && /The place is Pier;/.test(p3.prompt) && /Keep the place in <image1> as it is\./.test(p4.prompt));
let e1 = ""; try { E.plan({ base: "picture" }); } catch (e) { e1 = e.message; }
check("base picture with no Picture A says so", /pick Picture A first/.test(e1), e1);
const p5 = E.plan({ base: "picture", picAPath: A, locationPath: L, text: "<image1> stays; the pier from <image2> at dusk." });
let e2 = ""; try { E.plan({ base: "picture", picAPath: A, text: "<image1> and <image3>" }); } catch (e) { e2 = e.message; }
check("a direction written with the tags (🤖 Write) IS the whole instruction (+ the one-frame line); a tag past the pictures is refused",
  p5.full === true && p5.prompt.startsWith("<image1> stays; the pier from <image2> at dusk.") && /One single cinematic film frame/.test(p5.prompt) && !/This scene starts from/.test(p5.prompt) && /names <image3> but this frame sends 1/.test(e2), { p5, e2 });

/* 3 the place, the LLM */
const envs = [{ tag: "pier", name: "Pier" }, { tag: "cafe", name: "Cafe" }];
check("pickPlace: the scene's own @tag, else the global prompt's, else the only location; none = null",
  E.pickPlace(envs, "Mara at @cafe", ["@pier is the location"]).name === "Cafe" && E.pickPlace(envs, "Mara waits", ["location_definitions:", "@pier is the location \"Pier\""]).name === "Pier"
  && E.pickPlace([{ tag: "x", name: "X" }], "", []).name === "X" && E.pickPlace(envs, "", []) === null);
const M = E.llmMessages({ base: "picture", roles: ["Picture A: scene 1", "the location: Pier"], prefix: ["A noir film.", "@pier is the location"], sceneText: "Mara waits", notes: "rain" });
check("llmMessages: the system says Picture A first (style, composition, framing, poses the same), the place from the location picture else the global prompt; the user turn lists <image1>.. and the global prompt, the scene, the notes",
  /This scene starts from <image1> \(Picture A\)/.test(M[0].content) && /the place is the location the global prompt describes/.test(M[0].content)
  && /<image1> = Picture A: scene 1\n<image2> = the location: Pier/.test(M[1].content) && /A noir film\./.test(M[1].content) && /Mara waits/.test(M[1].content) && /rain/.test(M[1].content));
check("cleanWritten: no quotes / markdown / 'Instruction:', a tag past the pictures becomes words",
  E.cleanWritten('Instruction: "**This** starts from <image1> and <image4>."', 2) === "This starts from <image1> and the picture.");

/* 4 Picture A on disk */
const d = fs.mkdtempSync(path.join(os.tmpdir(), "qe563-"));
try {
  const src = path.join(d, "src.png"); fs.writeFileSync(src, "png1");
  const q0 = E.safe({});
  const r1 = E.setPic(d, q0, "pica", src, "scene 1 · First frame");
  const own = path.join(d, r1.file);
  const r2 = E.setPic(d, r1.qedit, "pica", own, "again");            // its own file as the source: copied first, not lost
  const kept = fs.readFileSync(own, "utf8");
  const r3 = E.delPic(d, r2.qedit, "pica");
  check("setPic pica: one picture (qe_pica.<ext>), replaced safely even from its own file; delPic takes it away",
    r1.ok && r1.file === "qe_pica.png" && r2.ok && kept === "png1" && r2.qedit.pica.label === "again" && r3.ok && r3.qedit.pica === null && !fs.existsSync(own), { r1, r2, r3 });
} finally { fs.rmSync(d, { recursive: true, force: true }); }

/* 5 every scene's pictures */
const core = require(path.join(ROOT, "lib", "core.js")), SP = require(path.join(ROOT, "lib", "scenePictures.js")), sceneRefs = require(path.join(ROOT, "lib", "sceneRefs.js"));
const P = "__t563_pics";
try {
  const row1 = { n: 1, id: "clip_01", refs: [{ file: "door.png", label: "the red door" }, { file: "gone.png", label: "missing" }], fl_first: { file: "fl_first.png", label: "storyboard" },
                 qedit: { pica: { file: "qe_pica.png", label: "scene 0" } }, output: "scene1.mp4" };
  const dd = sceneRefs.dir(P, "clip_01"); fs.mkdirSync(dd, { recursive: true });
  for (const f of ["door.png", "fl_first.png", "qe_pica.png"]) fs.writeFileSync(path.join(dd, f), "x");
  const L1 = SP.list(P, { list: [row1, { n: 2, id: "clip_02" }, { n: 3, id: "clip_03", output: "s3.mp4" }] }, 2);
  check("scenePictures.list: by scene number, the other scenes only, their First / Last frames, references, ✎ Picture A - files on disk only, project-relative (the pickers' rel), a take = listed for 🎞",
    L1.length === 2 && L1[0].n === 1 && L1[0].items.map((x) => x.what).join() === "first,ref,pica" && L1[0].items[1].rel === "scene_refs/clip_01/door.png"
    && L1[0].items[1].url === "/api/scenes/1/refs/door.png" && L1[0].items[0].url === "/api/scenes/1/fl/first" && L1[1].n === 3 && L1[1].items.length === 0 && L1[1].take, L1);
} finally { fs.rmSync(core.projDir(P), { recursive: true, force: true }); }

/* 6 wiring */
const RS = rd("routes", "sceneedit.js"), RC = rd("routes", "characters.js"), CH = rd("ext", "videodock", "characters.js"), QE = rd("ext", "videodock", "qedit.js");
check("routes: gather() shared by ✎ run and 🤖 Write (Picture A, the place without a 📍 picture); POST qedit/write asks the LLM, keeps the tags, saves the direction; GET /api/scenes/pictures",
  /function gather\(project, st, r, q, cast\)/.test(RS) && (RS.match(/gather\(project, st, r, q, /g) || []).length === 3 && /const place = base === "picture" && !locationPath \? placeFor\(project, st, r\) : null;/.test(RS)
  && /app\.post\("\/api\/scenes\/:n\/qedit\/write", trap\.guard\(async/.test(RS) && /sceneEdit\.llmMessages\(/.test(RS) && /app\.get\("\/api\/scenes\/pictures"/.test(RS) && !/scenePictures|qedit\/write/.test(rd("misc/server.js")));
check("a picked picture keeps the 🎬 tab's words (label) in the ✎, reference and First / Last routes; references take a frame of ANY take (kind frame)",
  /label = b\.label \? String\(b\.label\)\.slice\(0, 80\)/.test(RS) && /if \(b\.kind === "frame"\) \{\s*const from = scenes\.at\(st, b\.scene\);[\s\S]{0,400}sceneRefs\.addFrame\(b\.project, r, takeOf\(from\)/.test(RC)
  && /x\.label = \(b\.label \? String\(b\.label\)/.test(RC) && /label = b\.label \? String\(b\.label\)\.slice\(0, 80\) : `\$\{projectMedia\.groupFor/.test(RC));
check("the picker: 🎬 Scenes (opens first) / 🎞 Clips / 📁 Project / ⤒ File for every slot (the reference pictures too); qe_pica = choose PICTURE A",
  /\["scenes", "clips", "project", "file"\]\.map/.test(CH) && /tabs\.scenes\(\);\s*return ov;/.test(CH) && /fetch\("\/api\/scenes\/pictures\?except=" \+ n\)/.test(CH) && /choose\(\{ kind: "project", rel: it\.rel, label: words \}\)/.test(CH) && /choose PICTURE A/.test(CH));
check("the ✎ accordion: Start from 🅰 Picture A, its picture row, 🤖 Write, ✎ with Picture A and no direction writes first; its title names no model (the edit style picked is the model)",
  /\["picture", "🅰 Picture A/.test(QE) && /data-slot="qe_pica"/.test(QE) && /data-qewrite="/.test(QE) && /\/qedit\/write"/.test(QE) && /write\(n, ""\) : Promise\.resolve\(null\)/.test(QE) && /\+ "✎ First frame" \+ \(st \?/.test(QE));
console.log(`\n${pass} passed, ${fail} failed`);
console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
process.exit(fail ? 1 : 0);
