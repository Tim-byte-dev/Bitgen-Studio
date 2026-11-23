#!/usr/bin/env node
/* bitGen Studio — 2.934.0 units: THE MANNEQUIN SHEET IS THE REFERENCE, never the start picture.
 * Tim (verbatim): "in character sheet editor the mannequin sheet is the reference sheet of poses and camera angles and another
 * image must be loaded or generated to create the character sheet."
 * lib/sheetLibrary.js reference(), lib/charSheetH3.js MANNEQUIN_WORDS, routes/charSheetH3.js (template "mannequin:<sex>" /
 * "mannequin:own:<id>"), ext/videodock/h3sheet.js (🧍 = the reference, Dress it gone), ext/videodock/mannequinlife.js
 * (the lifelike views laid into one reference sheet). */
"use strict";
const fs = require("fs"), path = require("path"), os = require("os"), vm = require("vm");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

// --- lib/sheetLibrary.js reference()
const L = require("../lib/sheetLibrary");
L.setStatic(path.join(ROOT, "static", "mannequins"));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "t934-"));
L.setRoot(tmp);
const male = L.reference("mannequin:male"), female = L.reference("mannequin:female");
check("mannequin:male -> bitGen's male reference sheet (static/mannequins/male_sheet.png, its size read, kind mannequin)",
  male && male.kind === "mannequin" && /male_sheet\.png$/.test(male.path) && male.w === 2600 && male.h === 2400 && male.name === "Male display mannequin", male);
check("mannequin:female -> the female sheet", female && /female_sheet\.png$/.test(female.path) && female.name === "Female display mannequin", female);
check("an unknown mannequin / template / nothing -> null", L.reference("mannequin:robot") === null && L.reference("nope") === null && L.reference("") === null && L.reference("mannequin:own:zz") === null);
const png = (w, h) => { const b = Buffer.alloc(64); b.writeUInt32BE(0x89504e47, 0); b.writeUInt32BE(0x0d0a1a0a, 4); b.writeUInt32BE(13, 8); b.write("IHDR", 12); b.writeUInt32BE(w, 16); b.writeUInt32BE(h, 20); return b; };
const own = L.add("mannequins", { buffer: png(900, 400), name: "doll sheet.png" });
const tpl = L.add("templates", { buffer: png(1600, 800), name: "my sheet.png" });
const ro = L.reference("mannequin:own:" + own.id), rt = L.reference(tpl.id);
check("mannequin:own:<id> -> your mannequin's picture (kind mannequin, own)", ro && ro.kind === "mannequin" && ro.own && ro.w === 900 && ro.h === 400 && ro.name === "doll sheet" && fs.existsSync(ro.path), ro);
check("a template id -> your sheet (kind template)", rt && rt.kind === "template" && rt.w === 1600 && rt.name === "my sheet" && fs.existsSync(rt.path), rt);
L.setRoot(null); L.setStatic(null);

// --- lib/charSheetH3.js: the words follow the kind
const S = require("../lib/charSheetH3");
const st = S.state({ views: ["body_front", "body_left"] });
const base = { state: st, names: { unet: "u", clip: "c", vae: "v" }, character: "/x/char.png", concat: true, seed: 1 };
const gm = S.graph(Object.assign({ template: { path: "/x/male_sheet.png", w: 2600, h: 2400, name: "Male display mannequin", kind: "mannequin" } }, base)).graph;
const gt = S.graph(Object.assign({ template: { path: "/x/t.png", w: 1600, h: 800, name: "t", kind: "template" } }, base)).graph;
check("a mannequin reference: <Picture 2> = the sheet (layout-guide slot), the canvas its shape, MANNEQUIN_WORDS added",
  gm.tpl && gm.tpl.inputs.image === "male_sheet.png" && gm.cond.inputs["images.image_1"][0] === "tpl" && gm.char.inputs.image === "char.png"
  && Math.abs(gm.cond.inputs.width / gm.cond.inputs.height - 2600 / 2400) < 0.02 && gm.tplPrompt.inputs.string_b === S.MANNEQUIN_WORDS, gm.cond && gm.cond.inputs);
check("...the words: poses + camera angles followed, the character from <Picture 1>, never the mannequin's surface or its labels",
  /REFERENCE SHEET of poses and camera angles/.test(S.MANNEQUIN_WORDS) && /draw the character from <Picture 1> in every panel/.test(S.MANNEQUIN_WORDS)
  && /never the mannequin's glossy white surface/.test(S.MANNEQUIN_WORDS) && /title and labels/.test(S.MANNEQUIN_WORDS));
check("a template keeps its own words", gt.tplPrompt.inputs.string_b === S.TEMPLATE_WORDS);

// --- the route
const R = src("routes/charSheetH3.js");
check("POST /api/charsheet/h3: template resolved by sheetLibrary.reference (mannequin:<sex> / mannequin:own:<id> / a template id), gone = said",
  /require\("\.\.\/lib\/sheetLibrary"\)\.reference\(String\(b\.template\)\)/.test(R) && /that mannequin's reference sheet is not there any more/.test(R)
  && /poses and camera angles from/.test(R));
check("POST /api/charsheet/h3/mannequin answers ref + the sheet's size (bitGen's and yours)",
  /ref: "mannequin:" \+ sex, sheet_w: ref\.w \|\| 0/.test(R) && /ref: "mannequin:own:" \+ it\.id/.test(R));
check("the character picture is still required (load a picture of the character first)", /load a picture of the character first/.test(R));

// --- the sheet tab
const HS = src("ext/videodock/h3sheet.js");
const win = { localStorage: { getItem: () => null, setItem: () => {} } };
const ctx = { window: win, document: { getElementById: () => null }, localStorage: win.localStorage, console };
vm.createContext(ctx); vm.runInContext(HS, ctx);
const D = win.H3SheetDesign;
check("h3sheet.js: the mannequin is never opened as the start picture; Dress it gone", !/H3CharSheetPic\.open\(x\.j/.test(HS) && !/h3sDress/.test(HS) && !/dressBody/.test(HS) && !("dress" in D.state()));
check("...picking it: S.template cleared, its sheet = refItem() (sent as the template, drawn in the Layout box, the Layout guide locked)",
  /S\.mannequin = sex; S\.template = "";/.test(HS) && /function refItem\(\)/.test(HS) && /var t = refItem\(\);\n    return \{ choices: choices\(\)/.test(HS)
  && /var t = refItem\(\), cv = \$\("h3sCv"\)/.test(HS) && /lg\.disabled = !!r/.test(HS) && /"Reference: " \+ t\.name/.test(HS));
check("...a template picked (or uploaded) sets the mannequin aside", /if \(MANNEQUIN\.ref\) \{ clearMannequin\(\); \}/.test(HS) && /clearMannequin\(\); S\.template = x\.j\.id/.test(HS));
check("...bitGen's mannequin ticks the views its sheet shows (all real view ids)", D.MQ_VIEWS.length === 8 && D.MQ_VIEWS.every((v) => S.VIEW_IDS.includes(v)), D.MQ_VIEWS);
check("...nothing picked = no reference; the pick comes back on open (quiet)", D.reference() === null && /if \(S\.mannequin && !MANNEQUIN\.ref\) loadMannequin\(S\.mannequin, true\)/.test(HS));
check("...the line tells you to 📂 load or ✨ generate the character", /The character is the picture you 📂 load or ✨ generate, then ▶ Generate sheet/.test(HS));

// --- ✨ Lifelike: the views into ONE reference sheet
const ML = require("../ext/videodock/mannequinlife.js"), MLS = src("ext/videodock/mannequinlife.js");
const lay = ML.sheetLayout([{ w: 832, h: 1216 }, { w: 832, h: 1216 }, { w: 832, h: 1216 }], 1200, 24);
check("sheetLayout: three views side by side, one height, a gap around", lay.cells.length === 3 && lay.cells.every((c) => c.h === 1200 && c.y === 24) && lay.cells[1].x === lay.cells[0].x + lay.cells[0].w + 24
  && lay.w === lay.cells[2].x + lay.cells[2].w + 24 && lay.h === 1248, lay);
check("...Lifelike puts that sheet (not the front) into Your mannequins and makes it the reference",
  /sheetBlob\(\[out\.front, out\.side, out\.back\]\)/.test(MLS) && /mannequin - front, side, back/.test(MLS) && /D\.loadMannequin\("own:" \+ it\.id\)/.test(MLS) && /st\.picStyle/.test(MLS));

check("server.js untouched", !/sheetLibrary|mannequin/.test(src("misc/server.js")));
console.log(`\n${pass} passed, ${fail} failed`);
console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
process.exit(fail ? 1 : 0);
