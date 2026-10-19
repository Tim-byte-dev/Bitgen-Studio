// bitGen Studio — 2.224.0 MULTI-SHEET + CLOTHING + THE DATASET FOLDER.
// lib/clothing.js (the scene-mention resolver), the dataset landing points
// in lib/characters.js, the stitch extraction, buildChain's clothing leg,
// and shape pins on the routes and the UI wiring.
// Run from repo root: node scripts/test-clothing.js
const fs = require("fs");
const os = require("os");
const path = require("path");

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bgcloth-"));
process.env.H3_WORKSPACE = tmp;                 // before core is loaded
const core = require(path.join(__dirname, "..", "lib", "core"));
const C = require(path.join(__dirname, "..", "lib", "characters"));
const W = require(path.join(__dirname, "..", "lib", "clothing"));

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { console.log("PASS: " + name); pass++; }
  else { console.log("FAIL: " + name + (extra !== undefined ? " -> " + JSON.stringify(extra) : "")); fail++; }
}

/* ---- THE RESOLVER (Tim verbatim: "only when the scenes chapter mentions
 * the clothing type, but carry over the clothing type from the previous
 * scene unless instructed by the prompt.") ------------------------------ */
const SHOTS = [
  { prompt: ["opening shot, a rainy city street"] },              // 1
  { prompt: ["Jinx pulls on her leather jacket", "she runs"] },   // 2
  { prompt: ["they cross the bridge"] },                          // 3
  { prompt: ["Jinx now in armor, sword drawn"] },                 // 4
  { prompt: ["the final stand"] },                                // 5
];
const ENTRIES = [{ file: "a.png", type: "leather jacket" },
                 { file: "b.png", type: "armor" }];
const R = W.resolveActive(SHOTS, ENTRIES).map((a) => a.map((e) => e.type).join("+"));
check("scene 1 with no mention rides nothing", R[0] === "", R);
check("a mention selects the entry", R[1] === "leather jacket", R);
check("silence inherits the previous scene's set", R[2] === "leather jacket", R);
check("a new mention REPLACES the carried set (the mention is the instruction)",
      R[3] === "armor" && R[4] === "armor", R);
check("matching is whole-word: 'armory' never selects 'armor'",
      !W.mentions("the armory is closed", "armor"));
check("matching is case-insensitive and phrase-tolerant",
      W.mentions("wears her LEATHER  jacket.", "leather jacket"));
check("multiple types mentioned in one scene all ride",
      W.resolveActive([{ prompt: ["leather jacket and armor both"] }], ENTRIES)[0].length === 2);
check("the type is matched as the FULL phrase — 'jacket' alone never selects 'leather jacket'",
      W.resolveActive([{ prompt: ["a jacket"] }], ENTRIES)[0].length === 0);
check("slugType makes a stable tag fragment",
      W.slugType("Leather Jacket!") === "leather_jacket" && W.slugType("") === "clothing",
      [W.slugType("Leather Jacket!"), W.slugType("")]);
// per-character scoping: forScene matches each cast member's OWN entries
const cast2 = [
  { name: "Jinx", tag: "jinx", clothing: [{ file: "a.png", type: "jacket" }] },
  { name: "Rex",  tag: "rex",  clothing: [{ file: "c.png", type: "jacket" }] },
  { name: "Nix",  tag: "nix",  clothing: [{ file: "d.png", type: "cape" }] },
];
const at2 = W.forScene({ shots: [{ prompt: ["everyone in a jacket"] }] }, 1, cast2, C.tagOf);
check("a type mention selects EACH character's own entry, never a global one",
      at2.length === 2 && at2.map((x) => x.char).join(",") === "Jinx,Rex"
      && at2.every((x) => x.type === "jacket"), at2);
check("the queue tag is <chartag>_<typeslug>",
      at2[0].tag === "jinx_jacket" && at2[1].tag === "rex_jacket",
      at2.map((x) => x.tag));
check("a scene outside the plan resolves to nothing",
      W.forScene({ shots: SHOTS }, 99, cast2, C.tagOf).length === 0
      && W.forScene({ shots: SHOTS }, 0, cast2, C.tagOf).length === 0);

/* ---- THE DATASET FOLDER (Tim verbatim: "store it in project name\\
 * character name\\dataset, a place for our refmod to get the folder to
 * train") — ADDITIVE landing points ------------------------------------ */
const { spawnSync } = require("child_process");
function png(p, color, w, h) {
  spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi",
    "-i", `color=c=${color}:s=${w || 32}x${h || 48}:d=1`, "-frames:v", "1", p]);
  return p;
}
C.writeProfile({ name: "Jinx" });
const s1 = png(path.join(tmp, "s1.png"), "red");
C.addAsset("Jinx", s1, "s1.png");
check("addAsset lands the picture in the character's DATASET too (additive)",
      fs.existsSync(path.join(C.datasetDir("Jinx"), "s1.png")));
check("...while the top-level layout keeps feeding the chain unchanged",
      fs.existsSync(path.join(C.charDir("Jinx"), "s1.png"))
      && C.readProfile("Jinx").images.includes("s1.png"));
const v1 = path.join(tmp, "v.wav"); fs.writeFileSync(v1, "notawav");
C.addAsset("Jinx", v1, "v.wav");
check("voices stay OUT of the dataset (it is a picture training set)",
      !fs.existsSync(path.join(C.datasetDir("Jinx"), "v.wav")));
check("datasetAdd is idempotent — the same base name overwrites, no copies pile up",
      (() => { C.datasetAdd("Jinx", s1, "s1.png");
               return fs.readdirSync(C.datasetDir("Jinx"))
                 .filter((f) => f === "s1.png").length === 1; })());
check("datasetAdd for a character that does not exist answers null, never throws",
      C.datasetAdd("NoSuchOne", s1, "s1.png") === null);

// the save-time composite rides the EXTRACTED stitchFiles and lands in the set
const s2 = png(path.join(tmp, "s2.png"), "blue");
C.addAsset("Jinx", s2, "s2.png");
const comp = C.buildComposite("Jinx");
check("two sheets still stitch into the composite (the 2.168.0 rule holds)",
      comp === C.COMPOSITE
      && fs.existsSync(path.join(C.charDir("Jinx"), C.COMPOSITE)));
check("the stitched composite lands in the dataset as composite.png",
      fs.existsSync(path.join(C.datasetDir("Jinx"), "composite.png")));
check("buildComposite rides stitchFiles — ONE ffmpeg implementation, not two",
      (() => { const src = fs.readFileSync(path.join(__dirname, "..", "lib", "characters.js"), "utf8");
               return src.includes("if (!stitchFiles(srcs, out)) return null;")
                   && src.split("hstack=inputs=").length === 2; })());
const st = path.join(tmp, "stitched.png");
check("stitchFiles joins two pictures side by side (wider than either source)",
      (() => { if (!C.stitchFiles([s1, s2], st)) return false;
               const p = spawnSync("ffprobe", ["-v", "error", "-select_streams", "v:0",
                 "-show_entries", "stream=width", "-of", "csv=p=0", st], { encoding: "utf8" });
               return parseInt(p.stdout, 10) > 32; })());
check("stitchFiles with one source refuses (one sheet needs no stitch)",
      C.stitchFiles([s1], path.join(tmp, "no.png")) === false);

/* ---- CLOTHING STORAGE -------------------------------------------------- */
const cp = png(path.join(tmp, "coat.png"), "green");
const added = C.clothingAdd("Jinx", cp, { type: "Leather Jacket", color: "black",
                                          notes: "worn at the shoulders",
                                          original: "coat.png" });
check("clothingAdd files the picture under dataset/clothing/ and the manifest on the profile",
      fs.existsSync(path.join(C.datasetDir("Jinx"), "clothing", added.file))
      && (C.readProfile("Jinx").clothing || []).some((e) =>
           e.file === added.file && e.type === "Leather Jacket"
           && e.color === "black" && e.notes === "worn at the shoulders"), added);
check("clothingPath answers the stored file's absolute path",
      fs.existsSync(C.clothingPath("Jinx", added.file)));
check("a typeless entry is refused in words",
      (() => { try { C.clothingAdd("Jinx", cp, { type: " " }); return false; }
               catch (e) { return /type/.test(e.message); } })());
check("a non-picture is refused",
      (() => { try { C.clothingAdd("Jinx", v1, { type: "coat", original: "v.wav" }); return false; }
               catch (e) { return /picture/.test(e.message); } })());
check("clothingRemove drops the manifest line AND the file",
      (() => { const extra = C.clothingAdd("Jinx", cp, { type: "cape", original: "coat.png" });
               C.clothingRemove("Jinx", extra.file);
               return !fs.existsSync(C.clothingPath("Jinx", extra.file))
                   && !(C.readProfile("Jinx").clothing || []).some((e) => e.file === extra.file); })());
check("the profile blank carries clothing:[] so every save has the shape",
      Array.isArray(C.blank("x").clothing) && C.blank("x").clothing.length === 0);

/* ---- buildChain's CLOTHING LEG ----------------------------------------- */
const STYLE = JSON.parse(fs.readFileSync(
  path.join(__dirname, "..", "comfy_workflows", "MM3_Characters.json"), "utf8"));
const resolve = (c, f) => f;
const worn = [{ char: "Jinx", tag: "jinx_leather_jacket", type: "leather jacket",
                file: added.file }];
const chapter = [{ file: "chref.png", tag: "pose1" }];
const built = C.buildChain(STYLE, C.list(), resolve, undefined, undefined, chapter, worn);
const g = built.graph;
check("clothing rides as wear_img_*/wear_pic_* — a LoadImage + a scheduled picture reference",
      (g.wear_img_0 || {}).class_type === "LoadImage"
      && g.wear_img_0.inputs.image === added.file
      && (g.wear_pic_0 || {}).class_type === C.PIC_NODE, g.wear_pic_0);
check("the reference carries the <chartag>_<typeslug> tag with scenes 'all' (per-queue scoping, the chapter-refs precedent)",
      g.wear_pic_0.inputs.tag === "jinx_leather_jacket"
      && g.wear_pic_0.inputs.scenes === "all", g.wear_pic_0.inputs);
check("clothing rides LAST — after the chapter refs — so no existing <Picture i> number ever shifts",
      (() => { const ks = Object.keys(g);
               return ks.indexOf("wear_img_0") > ks.indexOf("ref_img_0")
                   && ks.indexOf("wear_pic_0") > ks.indexOf("ref_pic_0"); })());
check("the clothing reference chains onto the tail and the schedule consumer sees it",
      built.tail === "wear_pic_0"
      && String((g.wear_pic_0.inputs.previous || [])[0]) === "ref_pic_0");
check("the notes SAY the clothing rides (a silent reference is a debugging session)",
      built.notes.some((n) => /clothing @jinx_leather_jacket/.test(n)), built.notes);
check("no clothing arg keeps the graph free of wear_* nodes (the plain flows are untouched)",
      !Object.keys(C.buildChain(STYLE, C.list(), resolve).graph)
        .some((k) => k.startsWith("wear_")));

/* ---- ROUTE PINS (shape — the live legs run in the e2e proper) ---------- */
const R2 = fs.readFileSync(path.join(__dirname, "..", "routes", "characters.js"), "utf8");
check("routes: the activeClothing helper resolves from the PLAN (the plan is the truth)",
      /function activeClothing\(project, sceneN\)/.test(R2)
      && /clothing\.forScene\(st\.plan, sceneN, chars\.cast\(project\), chars\.tagOf\)/.test(R2));
check("routes: syncTmp is scene-aware and hands buildChain the active clothing",
      /function syncTmp\(project, why, chapter, scene, styleName\)/.test(R2)
      && /scene === undefined \? \[\] : activeClothing\(project, scene\)/.test(R2)
      && /buildChain\(base, cast, \(c, f\) => f, es, project, cr\.refs, cw\)/.test(R2));
check("routes: queueScene names the scene to syncTmp and appends clothing AFTER the chapter refs (chain order = upload order)",
      /syncTmp\(project, `scene \$\{n\} \$\{upscale \? "upscale" : "generate"\}`, r\.chapter \|\| "", n, chainName\)/.test(R2)
      && R2.indexOf("for (const w of activeClothing(project, r.n))")
         // 2.290.0: queueScene's sound split is a block now (the native
         // reference map's metadata rides beside it) - its marker moved
         > R2.indexOf('audMeta.push({ file: x.path, tag: xtag, kind: "sound"')
      && R2.indexOf('audMeta.push({ file: x.path, tag: xtag, kind: "sound"') > 0);
check("routes: queueRefScene rides clothing right after the SHEETS, before the environments (the 9-cap priority)",
      (() => { const i = R2.indexOf("function queueRefScene");
               const j = R2.indexOf("function queueExtend");
               const s = R2.slice(i, j);
               const cast = s.indexOf("chars.referenceImage(c, project)");
               const cloth = s.indexOf("activeClothing(project, r.n)");
               const env = s.indexOf("envs.list(project)");
               return cast >= 0 && cloth > cast && env > cloth; })());
check("routes: queueExtend is GONE (2.227.0) and clothing rides queueRefScene for EVERY H3_Video_Ref scene",
      !R2.includes("function queueExtend")
      && (() => { const i = R2.indexOf("function queueRefScene");
                  return R2.slice(i).includes("activeClothing(project, r.n)"); })());
check("routes: clothing endpoints exist (POST/DELETE, and GET serves the picture)",
      R2.includes('app.post("/api/characters/:name/clothing"')
      && R2.includes('app.delete("/api/characters/:name/clothing"')
      && R2.includes('app.get("/api/characters/:name/clothing/:file"'));
check("routes: the stitch endpoint rides chars.stitchFiles into the OUTPUT dir (a take like any other)",
      R2.includes('app.post("/api/characters/stitch"')
      && R2.includes('chars.stitchFiles(srcs, path.join(core.pDir("output"), out))'));
check("routes: adopt-sheet copies the session's SOURCE pictures into the dataset",
      /for \(const s of \(Array\.isArray\(b\.sources\) \? b\.sources : \[\]\)\)/.test(R2)
      && R2.includes('chars.datasetAdd(name, sp, path.basename(sp), b.project)'));
check("routes: the 2.223.12 TDZ bug is fixed — `photo` is declared BEFORE the h3charcreator branch that reads it",
      R2.indexOf('const photo = path.join(core.pDir("images"), refName)')
      < R2.indexOf('if (b.style_id === "h3charcreator")'));

/* ---- UI PINS (shape — the DOM legs live in test-sceneui) --------------- */
const SHELL = fs.readFileSync(path.join(__dirname, "..", "static", "index.html"), "utf8");
check("shell: the Clothing tab (button + pane + adder) is in the character dialog",
      SHELL.includes('data-chtab="chTabClothing"')
      && SHELL.includes('id="chTabClothing"')
      && ["chClothList", "chClothFile", "chClothType", "chClothColor",
          "chClothNotes", "chClothAdd"].every((id) => SHELL.includes('id="' + id + '"')));
const DOCK = fs.readFileSync(path.join(__dirname, "..", "ext", "videodock", "dock.html"), "utf8");
check("videodock: the source picker takes MULTIPLE pictures and the Stitch bar exists",
      /id="chNewPicFile"[^>]*multiple/.test(DOCK)
      && DOCK.includes('id="chStitchBtn"') && DOCK.includes('id="chStitchBar"'));
const VJS = fs.readFileSync(path.join(__dirname, "..", "ext", "videodock", "characters.js"), "utf8");
check("videodock js: multiple files queue ONE sheet job each (generate from each image separately)",
      VJS.includes("if (fl.length === 1) {")
      && VJS.includes("files.forEach(function (f2)")
      && VJS.split("chSheetUpload(b2,").length === 2);
check("videodock js: takes carry a tick, and 🧵 posts the ticked outs to /api/characters/stitch",
      VJS.includes("j.sel = cb.checked; chStitchHintPaint();")
      && VJS.includes('scPost("/api/characters/stitch"'));
check("videodock js: the stitched result joins the strip as a NEW take",
      /chSheetJobs\.push\(\{ id: "", via: " · stitched from /.test(VJS));
check("videodock js: adopt-sheet carries the session's sources into the dataset",
      VJS.includes("sources: chSheetSrcs")
      && VJS.includes("chSheetSrcs.push(d.input)"));
check("videodock js: queued clothing attaches at Save through the clothing endpoint (the drop-queue pattern)",
      VJS.includes('chClothQueue.forEach(function (q) {')
      && VJS.includes('"/clothing",')
      && VJS.includes('fdc.append("type", q.type);'));
check("videodock js: edit-open paints the profile's clothing; NEW, cancel and save reset it",
      VJS.includes("chClothReset(p.clothing || []);")
      && VJS.split("chClothReset([])").length === 4);


/* ---- THE DATASET BUTTONS (2.228.0, by instruction) ---------------------
 * TRAP (discovered here): the H3_WORKSPACE env line at the top of every
 * suite is a NO-OP — lib/core's BASE is unconditional, so suites share
 * the tree's projects/default. Fixture names must be unique per suite and
 * removed afterwards, or another suite's list() pins break. */
check("datasetCreate makes the folder (clothing subfolder included) and answers a census",
      (() => { C.writeProfile({ name: "Cloth28Tmp" });
               const r = C.datasetCreate("Cloth28Tmp");
               return fs.existsSync(path.join(C.datasetDir("Cloth28Tmp"), "clothing"))
                   && r.dir === C.datasetDir("Cloth28Tmp") && r.files === 0; })());
check("datasetCreate on an existing populated folder counts what is already there",
      (() => { C.datasetAdd("Cloth28Tmp", s1, "s1.png");
               return C.datasetCreate("Cloth28Tmp").files === 1; })());
check("datasetCreate for a character that does not exist refuses in words",
      (() => { try { C.datasetCreate("NoSuchOne"); return false; }
               catch (e) { return /no such character/.test(e.message); } })());
check("routes: the create-dataset and add-files endpoints exist; additions ride datasetAdd; non-media refused in words",
      R2.includes('app.post("/api/characters/:name/dataset"')
      && R2.includes('app.post("/api/characters/:name/dataset/file"')
      && (() => { const i = R2.indexOf('app.post("/api/characters/:name/dataset/file"');
                  const seg = R2.slice(i, i + 2200);
                  return seg.includes("chars.datasetAdd(name, f.path")
                      && /pictures and videos only/.test(seg)
                      && /rides pictures only/.test(seg); })());
const SH28 = fs.readFileSync(path.join(__dirname, "..", "static", "index.html"), "utf8");
check("shell: 📁 create + ＋📁 add sit NEXT TO 🧬 in the character editor, with the hidden multi-file picker",
      (() => { const i = SH28.indexOf('id="chRefmod"');
               const seg = SH28.slice(i, i + 2200);
               return seg.includes('id="chDatasetMake"')
                   && seg.includes('id="chDatasetAdd"')
                   && /id="chDatasetFile"[^>]*multiple/.test(seg.replace(/\n/g, " ")); })());
const DK28 = fs.readFileSync(path.join(__dirname, "..", "ext", "videodock", "dock.html"), "utf8");
check("sheet creator/generator: the ＋📁 Dataset button rides beside 📂 Load picture, with its own picker",
      DK28.includes('id="chSheetDataset"')
      && /id="chSheetDatasetFile"[^>]*multiple/.test(DK28.replace(/\n/g, " ")));
const VJ28 = fs.readFileSync(path.join(__dirname, "..", "ext", "videodock", "characters.js"), "utf8");
C.remove("Cloth28Tmp");   // the shared-default-project contract: clean up
check("the throwaway fixture is gone again (suites share the default project)",
      !C.list().some((c) => c.name === "Cloth28Tmp"));
check("client: all three buttons post to the dataset endpoints and the saved-character guard speaks",
      VJ28.includes('"/dataset", {})')
      && VJ28.includes('"/dataset/file"')
      && VJ28.includes("belongs to a saved character")
      && VJ28.split("chDatasetSend(").length === 4);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
