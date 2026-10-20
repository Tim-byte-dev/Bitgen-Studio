#!/usr/bin/env node
/* bitGen Studio — 2.547.0 units: several picked layers - 🗑 / Delete Layer deletes them all, Ctrl+G groups them, Ctrl+G on
 * one group ungroups it (pcmultisel.js); the built-in styles back (lib/styles.js missingStarters / restoreStarters /
 * RESEED, routes/stylesRestore.js, static/stylerestore.js).
 * Tim: "the krea2 style is gone,please add them back. when the user selects multiple layers in the image-editor and
 * presses the delete button, delete all the selected layers, if the user pressed ctrl+g then group the layers, if user
 * selects 1 group and presses ctrl+g then ungroup that group." */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const rd = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const M = require(path.join(ROOT, "ext", "imageeditdock", "pcmultisel.js"));
const D = require(path.join(ROOT, "ext", "imageeditdock", "pcdoc.js"));
const ST = require(path.join(ROOT, "lib", "styles.js"));
const R = require(path.join(ROOT, "static", "stylerestore.js"));

check("groupKey: 2+ selected = group them; one group = ungroup; one plain layer = a group of its own; nothing = nothing",
  M.groupKey(2, "pixel") === "many" && M.groupKey(3, "group") === "many" && M.groupKey(1, "group") === "ungroup" && M.groupKey(0, "group") === "ungroup" && M.groupKey(1, "pixel") === "one" && M.groupKey(0, null) === null);
// the tree: A C D picked out of A B C D -> one group, order kept
const mk = (id, name, extra) => Object.assign({ id, name, type: "pixel", parent: null }, extra || {});
const Ls = [mk(1, "A"), mk(2, "B"), mk(3, "C"), mk(4, "D")];
const G = mk(9, "Group 1", { type: "group" });
const g1 = D.group(Ls, [1, 3, 4], G);
check("pcdoc.group with the picked ids: A, C, D inside one group (in their order), B outside", g1.filter((L) => L.parent === 9).map((L) => L.name).join() === "A,C,D" && g1.find((L) => L.name === "B").parent === null && g1.some((L) => L.id === 9), g1.map((L) => [L.name, L.parent]));
const u1 = D.ungroup(g1, 9);
check("...and ungroup puts them back at the top level, the group gone", !u1.some((L) => L.id === 9) && u1.every((L) => L.parent === null) && u1.length === 4);

const d = fs.mkdtempSync(path.join(os.tmpdir(), "st547_"));
const made = ST.seedStarters(d);
check("a fresh styles folder gets the Krea 2 styles (Turbo, Raw, both GGUF)", ["Krea 2 Turbo", "Krea 2 Raw", "Krea 2 Turbo GGUF", "Krea 2 Raw GGUF"].every((n) => made.includes(n)), made);
for (const f of fs.readdirSync(path.join(d, "image"))) if (/^Krea 2/.test(f)) fs.unlinkSync(path.join(d, "image", f));
check("deleted: they stay deleted on the next start (the stamp knows them), and missingStarters lists them", ST.seedStarters(d).length === 0 && ST.missingStarters(d, "image").join() === "Krea 2 Turbo,Krea 2 Raw,Krea 2 Turbo GGUF,Krea 2 Raw GGUF" && ST.missingStarters(d, "video").length === 0);
const stamp = path.join(d, ".starters"), seen = JSON.parse(fs.readFileSync(stamp, "utf8"));
fs.writeFileSync(stamp, JSON.stringify(seen.filter((x) => !/^reseed:/.test(x))));
const re1 = ST.seedStarters(d), re2 = ST.seedStarters(d);
check("an install from before 2.547.0 (no reseed tag in its stamp): the missing Krea 2 styles come back ONCE at the start", re1.length === 4 && re2.length === 0 && JSON.parse(fs.readFileSync(stamp, "utf8")).includes("reseed:2.547.0:krea2"), { re1, re2 });
fs.writeFileSync(path.join(d, "image", "Krea 2 Raw.json"), JSON.stringify({ name: "Krea 2 Raw", arch: "krea2", steps: 99 }));
fs.unlinkSync(path.join(d, "image", "Krea 2 Turbo.json"));
const r3 = ST.restoreStarters(d, null, "image");
check("restoreStarters: only what is missing (Turbo), a style there is never overwritten (Raw keeps its 99 steps); names narrow it",
  r3.join() === "Krea 2 Turbo" && JSON.parse(fs.readFileSync(path.join(d, "image", "Krea 2 Raw.json"), "utf8")).steps === 99 && ST.restoreStarters(d, ["Nope"]).length === 0, r3);
fs.rmSync(d, { recursive: true, force: true });
check("the question: names them (at most 20), says yours are not touched; none missing = says so",
  /^Put back 2 built-in image styles\?/.test(R.listText(["Krea 2 Turbo", "Krea 2 Raw"], "image")) && /Your own styles/.test(R.listText(["x"], "image")) && R.listText([], "video") === "Every built-in video style is there." && /and 5 more/.test(R.listText(Array.from({ length: 25 }, (_, i) => "s" + i))));

const MS = rd("ext", "imageeditdock", "pcmultisel.js"), IE = rd("ext", "imageeditdock", "imageedit.js"), RI = rd("routes", "index.js"), RR = rd("routes", "stylesRestore.js"), IX = rd("static", "index.html");
check("pcmultisel: E.deleteLayer = every picked layer (else the old one), E.groupActive by groupKey (many / ungroup / one); the 🗑 button calls E.deleteLayer",
  /E\.deleteLayer = function \(\) \{ if \(list\(\)\.length > 1\) return deleteAll\(\);/.test(MS) && /if \(how === "many"\) return groupAll\(\);/.test(MS) && /if \(how === "ungroup"\) return ungroupOne/.test(MS) && /D\.group\(S\.layers, ids, G\)/.test(MS)
  && /\$\("kxLDel"\)\.onclick = \(\) => E\.deleteLayer\(\);/.test(IE));
check("the route is its own file, mounted from routes/index.js (server.js untouched); stylerestore.js loaded",
  /require\("\.\/stylesRestore"\)\.mount\(app\)/.test(RI) && /app\.get\("\/api\/styles\/missing"/.test(RR) && /app\.post\("\/api\/styles\/restore"/.test(RR) && /src="\/static\/stylerestore\.js"/.test(IX)
  && !/stylesRestore/.test(rd("server.js")));
console.log(`\n${pass} passed, ${fail} failed`);
console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
process.exit(fail ? 1 : 0);
