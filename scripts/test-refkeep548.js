#!/usr/bin/env node
/* bitGen Studio — 2.548.0 units: the reference docker kept (lib/projectRefs.store / writeManifest, lib/refKeep.js,
 * static/refkeep.js, static/refroles.js plan), the storyboard's shared prompt kept (ext/videodock/characters.js).
 * Tim: "keep the references in the reference docker on close and on project save. they clear right now. and the
 * references in storyboard general prompt and the references in scenes". */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const rd = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const PR = require(path.join(ROOT, "lib", "projectRefs.js"));
const RK = require(path.join(ROOT, "lib", "refKeep.js"));
const K = require(path.join(ROOT, "static", "refkeep.js"));
const RR = require(path.join(ROOT, "static", "refroles.js"));

check("uniqueNames: pasted pictures all called image.png get their own names, in order (case does not matter)",
  JSON.stringify(K.uniqueNames(["image.png", "image.png", "Image.png", "b.png"])) === '["image.png","image_2.png","Image_3.png","b.png"]' && JSON.stringify(K.uniqueNames(["x", "x"])) === '["x","x_2"]');
check("sigOf: the manifest as JSON (changed = different)", K.sigOf({ a: 1 }) === '{"a":1}' && K.sigOf({ images: [] }) !== K.sigOf({ images: [{ file: "a" }] }));
check("the dock keeps up to MAX_IMAGES pictures (48) / MAX_MEDIA videos and sounds (24) - the 10th and later were dropped", PR.MAX_IMAGES >= 40 && PR.MAX_MEDIA >= 10
  && PR.normalize({ images: Array.from({ length: 12 }, (_, i) => `${i}.png`) }).images.length === 12);

const T = fs.mkdtempSync(path.join(os.tmpdir(), "rk548_")), pdir = path.join(T, "p"), prjPath = path.join(pdir, "p.prj"), assets = path.join(T, "assets");
fs.mkdirSync(pdir, { recursive: true }); fs.mkdirSync(path.join(assets, "video"), { recursive: true });
fs.writeFileSync(prjPath, JSON.stringify({ scenes: { list: [{ n: 1 }] }, chapterRefs: { "": [{ file: "hat.png" }] }, prompt: "x" }));
fs.writeFileSync(path.join(assets, "video", "clip.mp4"), "vid");
const A = (k, n) => path.join(assets, k, n);
const s1 = RK.keep({ project: "p", current: "p", projDir: pdir, prjPath, assetPath: A,
  manifest: { images: [{ file: "a.png" }, { file: "b.png", desc: "a red car" }], videos: ["clip.mp4"] }, files: [{ originalname: "a.png", buffer: Buffer.from("A") }, { originalname: "b.png", buffer: Buffer.from("B") }] });
const d1 = JSON.parse(fs.readFileSync(prjPath, "utf8"));
check("keep: the pictures stored, the video copied from the assets, ONLY `references` written - the scene board, the chapter references and the rest stay",
  s1.images.map((x) => x.file).join() === "a.png,b.png" && s1.images[1].desc === "a red car" && s1.videos.join() === "clip.mp4" && fs.existsSync(path.join(pdir, "reference", "videos", "clip.mp4"))
  && d1.scenes && d1.chapterRefs[""][0].file === "hat.png" && d1.prompt === "x" && d1.references.images.length === 2, { s1, d1 });
const s2 = RK.keep({ project: "p", current: "p", projDir: pdir, prjPath, assetPath: A, manifest: { images: [{ file: "a.png" }, { file: "b.png" }, { file: "c.png" }] }, files: [{ originalname: "c.png", buffer: Buffer.from("C") }] });
check("keep with ONLY the new picture: the stored ones are kept by name, the new one added (no picture stands in for another)",
  s2.images.map((x) => x.file).join() === "a.png,b.png,c.png" && fs.readFileSync(path.join(pdir, "reference", "images", "a.png"), "utf8") === "A" && fs.readFileSync(path.join(pdir, "reference", "images", "c.png"), "utf8") === "C", s2);
const s3 = PR.store(pdir, { images: [{ file: "a.png" }, { file: "zz.png" }] }, [], A);
check("a picture neither sent nor stored is left out (never guessed)", s3.images.map((x) => x.file).join() === "a.png", s3);
let refused = null; try { RK.keep({ project: "other", current: "p", projDir: pdir, prjPath, manifest: { images: [] } }); } catch (e) { refused = e; }
check("a page showing another project: refused with 409, nothing written", refused && refused.status === 409 && JSON.parse(fs.readFileSync(prjPath, "utf8")).references.images.length === 3);
fs.rmSync(T, { recursive: true, force: true });

check("refroles.plan: F/L sends the first 2, Swap 1, Text none - the dock keeps the rest (it threw them away on the mode change)",
  RR.plan("fl2va", [1, 2, 3, 4]).refs.length === 2 && RR.plan("swap", [1, 2]).refs.length === 1 && RR.plan("t2va", [1, 2]).refs.length === 0 && /kept in the dock/.test(RR.plan("fl2va", [1, 2, 3]).note));

const IX = rd("static", "index.html"), RI = rd("routes", "index.js"), RT = rd("routes", "refKeep.js"), KS = rd("static", "refkeep.js"), CH = rd("ext", "videodock", "characters.js");
check("index.html: a mode change no longer pops pictures; extra ones faded (.unused); Text says how many are kept; refkeep.js loaded",
  !/while \(refs\.length > CAP\[mode\]\) URL\.revokeObjectURL\(refs\.pop\(\)\.url\);/.test(IX) && /s\.classList\.add\("unused"\)/.test(IX) && /kept for Ref \/ F\/L/.test(IX) && /src="\/static\/refkeep\.js"/.test(IX));
check("the project save takes up to MAX_IMAGES pictures through lib/refKeep's multer and lib/projectRefs.store; the dock's route is its own file (server.js untouched)",
  /require\("\.\.\/lib\/refKeep"\)\.upload\(\)\.array\("ref_images", projectRefs\.MAX_IMAGES\)/.test(RI) && /projectRefs\.store\(pdir, data\.references/.test(RI) && /require\("\.\/refKeep"\)\.mount\(app\)/.test(RI)
  && /app\.post\("\/api\/projects\/refs"/.test(RT) && !/refKeep/.test(rd("misc/server.js")));
check("refkeep.js: waits for the project's references to load, sends only the new pictures, flushes on close / before another project, adopts the server's names",
  /loading\+\+/.test(KS) && /!onServer\.has\(r\.file\)/.test(KS) && /addEventListener\("beforeunload"/.test(KS) && /root\.saveLeavingState = w/.test(KS) && /imgs\[i\]\.file !== r\.file\.name/.test(KS));
check("the storyboard's shared prompt: kept as it is typed (input 1.5 s, change, close), never painted over while it differs",
  /el\("scPrefix"\)\.addEventListener\("input"/.test(CH) && /el\("scPrefix"\)\.addEventListener\("change", function \(\) \{ scPrefixKeep\(false\); \}\);/.test(CH)
  && /navigator\.sendBeacon\("\/api\/scenes\/prefix"/.test(CH) && /if \(el\("scPrefix"\) && !scPrefixDirty\(\)\) \{/.test(CH));
console.log(`\n${pass} passed, ${fail} failed`);
console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
process.exit(fail ? 1 : 0);
