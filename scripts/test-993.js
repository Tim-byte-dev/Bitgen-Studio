#!/usr/bin/env node
// bitGen Studio 2.993.0 - (1) ✨ Photo never leaves the grey: an "environment" reference = the model drawn into it; else pass 2
// fills the grey (painted green) under a mask. Tim: "it still produces a gray background but it does use the reference picture".
// (2) ⤓ Import Daz content: a library folder + its layout, zips found in folders and unpacked to the right place. Tim: "add an
// import button next to my library ...". Browser: test-ui993-ui.js, test-ui993dz-ui.js.
"use strict";
const fs = require("fs");
const path = require("path");
const os = require("os");
const ROOT = path.join(__dirname, "..");
let P = 0, F = 0;
const check = (n, ok, got) => { if (ok) { P++; console.log("PASS:", n); } else { F++; console.log("FAIL:", n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const src = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const J = (x) => JSON.stringify(x);
const R = require("../ext/pushpulldock/ppreal.js");
const DI = require("../lib/dazImport.js");

(async () => {
  // ---------------- (1) the photo's background
  check("envRef: the reference whose Type is environment (or a place word) - not a person / face / object", R.envRef([{ role: "person" }, { role: "environment", src: "a" }]).src === "a" && R.envRef([{ role: "person" }, { role: "face" }]) === null && !!R.envRef([{ role: "Location" }]) && R.envRef(null) === null);
  check("refTiles keeps each reference's Type (role; Other = its own word)", J(R.refTiles([{ url: "u", role: "environment" }, { url: "v", role: "other", roleOther: "park" }]).map((r) => r.role)) === J(["environment", "park"]));
  const a = new Uint8Array(8 * 6); for (let y = 2; y < 5; y++) for (let x = 3; x < 6; x++) a[y * 8 + x] = 255;   // a 3 x 3 model in an 8 x 6 shot
  const m0 = R.bgMask(a, 8, 6, 0), m1 = R.bgMask(a, 8, 6, 1);
  check("bgMask: the background = where the model is not", m0.reduce((s, v) => s + v, 0) === 48 - 9 && m0[3 * 8 + 4] === 0 && m0[0] === 1);
  check("…grown into the model's edge (a halo painted over too): grow 1 leaves only its middle", m1.reduce((s, v) => s + v, 0) === 47 && m1[3 * 8 + 4] === 0 && m1[2 * 8 + 3] === 1);
  const d = new Uint8ClampedArray(8 * 6 * 4).fill(128), n = R.greenFill(d, m0);
  check("greenFill: the background painted pure green (Krita's fill-the-green), the model untouched", n === 39 && J(Array.from(d.slice(0, 4))) === J([0, 255, 0, 255]) && d[(3 * 8 + 4) * 4 + 1] === 128);
  const fp = R.fillPrompt("a woman standing in a park", true), fp0 = R.fillPrompt("", false);
  check("fillPrompt: fill all the green with a real place in the same light, never green / grey / white, the subject kept; the prompt's place; {img2} = the reference's look",
    /fill all of it with a real, detailed photographic place/.test(fp) && /Never leave green, grey, white or a plain backdrop/.test(fp) && /stays exactly as it is/.test(fp) && /\{img2\} is the reference picture/.test(fp) && /The place and the scene: a woman standing in a park$/.test(fp)
    && !/\{img2\}/.test(fp0) && !/The place and the scene/.test(fp0) && !/The place and the scene/.test(R.fillPrompt(R.DEFAULT, false)));
  const sc = R.sceneWords({ rooms: [{ closed: true }] }, [], {}), pl = R.promptFor("a woman in a park", { refs: [{}], tiles: [], single: true }, sc, { placed: true }), pl0 = R.promptFor("", { refs: [{}], tiles: [], single: true }, sc, { placed: true });
  check("an environment reference: the prompt says the place is already in picture 1 (PLACED), never the grey EMPTY line - with or without words",
    pl.includes(R.PLACED) && !pl.includes(R.EMPTY) && pl0.includes(R.PLACED) && !/add nothing else/.test(pl0) && R.promptFor("x", null, sc).includes(R.EMPTY));
  const PR = src("ext/pushpulldock/ppreal.js");
  check("the run: env reference -> placedPic (the reference behind the model alone); words / other references -> fill on the grey, then fillPass; the shot of the model alone is TRANSPARENT (photo would give it the sky)",
    /const env = used\.bg \? null : envRef\(used\.refs\), fillBg = !used\.bg && !env && !!\(words \|\| used\.refs\.length\)/.test(PR) && /if \(env\) \{ const pc = await placedPic\(env\.src, tr\); if \(pc\) c = pc; \}/.test(PR)
    && /V\.shot\(sz\.w, sz\.h, \{ clean: true, transparent: true \}\)/.test(PR) && /const f = await fillPass\(pic, tr, text, style, used\)/.test(PR));
  check("pass 2 = /api/aiedit fill_edit (the same edit model, generate, under the mask, ref_raw), the first reference as {img2}; refused = the first photo kept and said; the model's own pixels from pass 1",
    /fill_edit: "1", edit_style_id: style, fill_kind: "generate"/.test(PR) && /ref_raw: "1"/.test(PR) && /fd\.append\("mask", mb/.test(PR) && /could not be filled \(/.test(PR) && /if \(!sel\[i\]\) \{ fd2\.data\[i \* 4\] = first\.data\[i \* 4\]/.test(PR));

  // ---------------- (2) Daz import
  check("mapEntry: the first library top folder starts the path, in Daz's case (Content/ and wrappers dropped)",
    DI.mapEntry("Content/runtime/Textures/V/a.jpg").dest === "Runtime/Textures/V/a.jpg" && DI.mapEntry("data/V/x.dsf").dest === "data/V/x.dsf" && DI.mapEntry("My Library/people/Genesis 9/x.duf").dest === "People/Genesis 9/x.duf"
    && DI.mapEntry("Product\\Content\\Light Presets\\s.duf").dest === "Light Presets/s.duf" && DI.mapEntry("a/b/").dir);
  check("…refused: .. / absolute paths; left out: the DIM notes, readmes outside the folders, __MACOSX; a zip inside = opened",
    /unsafe/.test(DI.mapEntry("../data/x").skip) && /absolute/.test(DI.mapEntry("/etc/data/x").skip) && /absolute/.test(DI.mapEntry("C:/data/x").skip) && /DIM/.test(DI.mapEntry("Manifest.dsx").skip)
    && /not in a library/.test(DI.mapEntry("readme.txt").skip) && /system/.test(DI.mapEntry("__MACOSX/data/x").skip) && DI.mapEntry("sub/Part2.zip").zip && /not in a library/.test(DI.mapEntry("data").skip));
  const pz = DI.planZip(["Manifest.dsx", "Content/data/V/a.dsf", "Content/People/V/b.duf", "Content/", "ReadMe.pdf"]);
  check("planZip: a DIM package (kind dim), its files, its tops, what is left out", pz.kind === "dim" && pz.files.length === 2 && J(pz.tops) === J(["People", "data"]) && pz.skipped.length === 2);
  check("…plain Daz content = daz; only zips inside = zips; nothing of a library = none", DI.planZip(["People/x.duf"]).kind === "daz" && DI.planZip(["a.zip"]).kind === "zips" && DI.planZip(["a.txt"]).kind === "none");
  const JSZip = require("jszip"), T = fs.mkdtempSync(path.join(os.tmpdir(), "t993-"));
  try {
    const mk = async (f, files) => { fs.mkdirSync(path.dirname(f), { recursive: true }); const z = new JSZip(); for (const [k, v] of Object.entries(files)) z.file(k, v); fs.writeFileSync(f, await z.generateAsync({ type: "nodebuffer" })); };
    const dl = path.join(T, "dl");
    await mk(path.join(dl, "a.zip"), { "data/V/a.dsf": "a", "People/V/b.duf": "b", "readme.txt": "r", "../evil.txt": "x" });
    await mk(path.join(dl, "deep", "dim.ZIP"), { "Manifest.dsx": "m", "Content/runtime/Textures/V/t.jpg": "t" });
    const iz = new JSZip(); iz.file("Lib/Props/V/p.duf", "p");
    await mk(path.join(dl, ".hidden", "skip.zip"), { "data/x": "x" });
    await mk(path.join(dl, "deep", "set.zip"), { "S/Content/Scripts/V/s.dsa": "s", "Part2.zip": await iz.generateAsync({ type: "nodebuffer" }) });
    fs.writeFileSync(path.join(dl, "bad.zip"), "nope");
    const z1 = DI.findZips([dl]).map((z) => path.relative(dl, z.path).split(path.sep).join("/")), z0 = DI.findZips([dl], { recursive: false }).map((z) => path.basename(z.path));
    check("findZips: every .zip (any case) in the folder and its subfolders, hidden folders skipped; not recursive = the folder only", J(z1) === J(["a.zip", "bad.zip", "deep/dim.ZIP", "deep/set.zip"]) && J(z0) === J(["a.zip", "bad.zip"]), { z1, z0 });
    const pk = await DI.peek(path.join(dl, "a.zip")), pb = await DI.peek(path.join(dl, "bad.zip"));
    check("peek: what a zip holds (a '..' entry does not spoil the whole zip); a broken one says so", pk.kind === "daz" && pk.files === 2 && pk.skipped === 2 && pb.kind === "bad" && /can't read it/.test(pb.error), { pk, pb });
    const nl = DI.newLibrary(T, "My Lib");
    check("newLibrary: the folder + the Daz layout (13 folders); makeStructure again = nothing to make", nl.made.length === DI.STRUCTURE.length && fs.existsSync(path.join(T, "My Lib", "Runtime", "Textures")) && DI.makeStructure(nl.dir).length === 0);
    let thrown = 0; for (const f of [() => DI.newLibrary(path.join(T, "nope"), "x"), () => DI.newLibrary(T, "a/b"), () => DI.newLibrary(T, ".."), () => DI.makeStructure("")]) { try { f(); } catch (e) { if (e.status === 400) thrown++; } }
    check("…refused in words: a parent that is not there, a name with / or .., no folder", thrown === 4);
    const r1 = await DI.importZip(path.join(dl, "a.zip"), nl.dir), r2 = await DI.importZip(path.join(dl, "deep", "dim.ZIP"), nl.dir), r3 = await DI.importZip(path.join(dl, "deep", "set.zip"), nl.dir);
    const has = (f) => fs.existsSync(path.join(nl.dir, ...f.split("/")));
    check("importZip: each file in its place - plain, a DIM package (Content/ dropped, runtime -> Runtime), wrappers dropped, a zip inside opened",
      has("data/V/a.dsf") && has("People/V/b.duf") && has("Runtime/Textures/V/t.jpg") && has("Scripts/V/s.dsa") && has("Props/V/p.duf") && r1.written === 2 && r2.written === 1 && r3.written === 2 && r3.nested === 1, { r1, r2, r3 });
    check("…nothing outside the library (the '..' entry) and no readme / notes in it", !fs.existsSync(path.join(T, "evil.txt")) && !fs.existsSync(path.join(nl.dir, "readme.txt")) && !fs.existsSync(path.join(nl.dir, "Manifest.dsx")) && !fs.readdirSync(os.tmpdir()).some((f) => /^bitgen-dazimp-/.test(f) && fs.statSync(path.join(os.tmpdir(), f)).mtimeMs > Date.now() - 60000));
    fs.writeFileSync(path.join(nl.dir, "data", "V", "a.dsf"), "mine");
    const k = await DI.importZip(path.join(dl, "a.zip"), nl.dir), o = await DI.importZip(path.join(dl, "a.zip"), nl.dir, { overwrite: true });
    check("a file that is there is kept; overwrite replaces it", k.kept === 2 && k.written === 0 && o.written === 2 && fs.readFileSync(path.join(nl.dir, "data", "V", "a.dsf"), "utf8") === "a");
    check("inside(): only paths in the library", DI.inside(nl.dir, path.join(nl.dir, "data", "x")) && !DI.inside(nl.dir, path.join(T, "x")) && !DI.inside(nl.dir, nl.dir));
    let e409 = 0; DI.start([path.join(dl, "a.zip")], nl.dir, {}); try { DI.start([path.join(dl, "a.zip")], nl.dir, {}); } catch (e) { e409 = e.status; }
    for (let i = 0; i < 100 && DI.job().state === "running"; i++) await new Promise((ok) => setTimeout(ok, 20));
    check("the import job: one at a time (409), counts what it did", e409 === 409 && DI.job().state === "done" && DI.job().done === 1 && DI.job().kept === 2);
    let e400 = 0; try { DI.start([], nl.dir); } catch (e) { e400 = e.status; }
    check("…no zips / no library folder = 400 in words", e400 === 400);
  } finally { fs.rmSync(T, { recursive: true, force: true }); }
  const RI = src("routes/index.js"), RD = src("routes/dazImport.js"), PT = src("ext/pushpulldock/ppdaztools.js"), PI = src("ext/pushpulldock/ppdazimport.js"), EJ = JSON.parse(src("ext/pushpulldock/ext.json")), PK = JSON.parse(src("package.json"));
  check("routes: mounted from routes/index.js (library, structure, zips, import + cancel); yauzl (MIT, streams big zips) is a dependency; server.js untouched",
    /require\("\.\/dazImport"\)\.mount\(app\)/.test(RI) && ["/api/dazlib/library", "/api/dazlib/structure", "/api/dazlib/zips", "/api/dazlib/import", "/api/dazlib/import/cancel"].every((u) => RD.includes('"' + u + '"')) && !!PK.dependencies.yauzl && !/dazImport|yauzl/.test(src("misc/server.js")));
  check("the ⤓ button beside 📁 in the DAZ Library docker's title -> H3DazImport.open(); ppdazimport.js right after ppdaztools.js",
    /id="dzFolders"[^>]*>📁<\/button><button type="button" class="ghost dzx" id="dzImport"/.test(PT) && /\$\("dzImport"\)\.onclick = \(\) => \{ if \(root\.H3DazImport\) root\.H3DazImport\.open\(\); \}/.test(PT) && EJ.scripts.indexOf("ppdazimport.js") === EJ.scripts.indexOf("ppdaztools.js") + 1);
  check("the dialog: the library (one of mine / 📂 another / ＋ new / ▦ the layout here / add to my folders), the zips' folders (＋ / ✕, subfolders), 🔍, the list, replace, ⤓ Import, ■ Stop; the app's own folder picker; the light-tasks words",
    ["dziLib", "dziPick", "dziNew", "dziNewBox", "dziParent", "dziParentPick", "dziName", "dziNewGo", "dziMake", "dziAddRoot", "dziSrc", "dziAdd", "dziRec", "dziScan", "dziList", "dziOver", "dziGo", "dziStop", "dziLog"].every((id) => PI.includes('id="' + id + '"'))
    && /FileDialog\.open\(\{ mode: "dir"/.test(PI) && /Not a replacement for Daz Studio or its Install Manager - light tasks/.test(PI) && /#dziDlg \[hidden\]\{display:none!important\}/.test(PI));
  console.log(`\nRESULT: ${P} passed, ${F} failed`);
  process.exit(F ? 1 : 0);
})();
