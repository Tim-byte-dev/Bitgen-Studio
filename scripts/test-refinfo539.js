#!/usr/bin/env node
/* bitGen Studio — 2.539.0 units: A DESCRIPTION FOR EVERY REFERENCE, THE HOUSE TYPES, REFERENCE PICTURES IN THE HOUSE
 * BUILDER (a wall's / a floor's texture, a piece's look for ✨ Make it real) AND IN THE IMAGE EDITOR (a layer, an Edit's
 * Picture 2).
 * Tim (verbatim): "can we use our reference docker images , like walls, furniture, lights etc in homebuilder and
 * image-editor?" + "add an input for all types of references so user can add a brief description of the references" +
 * "and add all 4 of the suggestions u gave" */
"use strict";
const fs = require("fs"), os = require("os"), path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, cond, got) => { if (cond) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 800))); } };
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const PNG = Buffer.from("89504e470d0a1a0a0000000d4948445200000002000000020802000000fdd49a730000001649444154789c63f8cfc0f09f818181e1ff7f0606000037f005fd8a5a6fb10000000049454e44ae426082", "hex");

(async () => {
  /* ---- static/refinfo.js */
  const RI = require("../static/refinfo.js");
  check("clean: one line, no doubled spaces, at most 200 characters", RI.clean("  a  green\nvelvet\tsofa ") === "a green velvet sofa" && RI.clean("x".repeat(300)).length === 200 && RI.clean(null) === "");
  check("mapLine: + its description in brackets; person / subject say no role word",
    RI.mapLine(2, "furniture", 2, "a green velvet chesterfield") === "<subject 2> furniture is in <Picture 2> (a green velvet chesterfield)"
    && RI.mapLine(1, "person", 1, "") === "<subject 1> is in <Picture 1>" && RI.mapLine(1, "face", 3, "  ") === "<subject 1> face is in <Picture 3>");
  const nf = RI.notesFor(["a.mp4", "b.mp4"], ["v.wav"], { videos: { "a.mp4": " the dance ", "gone.mp4": "x", "b.mp4": "" }, audio: { "v.wav": "her voice" } });
  check("notesFor: only the videos / sounds still in the lists, only non-empty", JSON.stringify(nf) === JSON.stringify({ videos: { "a.mp4": "the dance" }, audio: { "v.wav": "her voice" } }), nf);
  check("notesIn: a stored manifest / a group (audios) -> {videos, audio}; nothing = empty", JSON.stringify(RI.notesIn({ notes: { videos: { a: "x" }, audios: { s: "y" } } })) === JSON.stringify({ videos: { a: "x" }, audio: { s: "y" } }) && JSON.stringify(RI.notesIn(null)) === JSON.stringify({ videos: {}, audio: {} }));
  const hf = RI.houseFirst([{ role: "person", i: 0 }, { role: "light", i: 1 }, { role: "wall", i: 2 }, { role: "furniture", i: 3 }], "furniture").map((r) => r.i);
  check("houseFirst: the wanted kind first, then wall / floor / furniture / light, then the rest (in their order)", JSON.stringify(hf) === "[3,2,1,0]", hf);
  check("the house types are wall, floor, furniture, light", JSON.stringify(RI.HOUSE) === JSON.stringify(["wall", "floor", "furniture", "light"]));

  /* ---- the page */
  const ix = read("static", "index.html");
  check("the Type dropdown has wall · floor · furniture · light", ["wall", "floor", "furniture", "light"].every((t) => ix.includes(`<option value="${t}" title="2.539.0`)));
  check("every tray picture, video and sound gets a description box (RefInfo.descBox) bound to r.desc / refNotes",
    /RefInfo\.descBox\(r\.desc \|\| ""/.test(ix) && /RefInfo\.descBox\(refNotes\.videos\[n\]/.test(ix) && /RefInfo\.descBox\(refNotes\.audio\[n\]/.test(ix) && /<script src="\/static\/refinfo\.js"><\/script>/.test(ix));
  check("…kept with the project (images[].desc + notes) and a saved group, read back on open; into the mapping lines, ✨ Enhance and the chat (note / ref_notes)",
    /roleOther: r\.roleOther, desc: r\.desc \|\| "" \}\)\),/.test(ix) && /notes: window\.RefInfo \? RefInfo\.notesFor\(refVids, refAuds, refNotes\)/.test(ix) && /refNotes = RefInfo\.notesIn\(m\)/.test(ix) && /refNotes = RefInfo\.notesIn\(g\)/.test(ix)
    && /RefInfo\.mapLine\(r\.subject, role, i \+ 1, r\.desc\)/.test(ix) && /note: r\.desc \|\| "" \}\)\)/.test(ix) && /chatCtx\.ref_notes = /.test(ix));
  check("window.H3Refs gives the other dockers the dock (images / videos / sounds with their descriptions); a tray picture drags as application/x-h3ref",
    /window\.H3Refs = \{/.test(ix) && /images: \(\) => refs\.map/.test(ix) && /setData\("application\/x-h3ref"/.test(ix));

  /* ---- the project manifest + groups */
  const PR = require("../lib/projectRefs.js");
  const nm = PR.normalize({ images: [{ file: "a.png", desc: "  her  face " }], videos: ["d.mp4"], audio: ["v.wav"], notes: { videos: { "d.mp4": "the dance", "x.mp4": "gone" }, audio: { "v.wav": "calm voice" } } });
  check("projectRefs.normalize: a picture's desc; notes for the videos / sounds in the lists only", nm.images[0].desc === "her face" && JSON.stringify(nm.notes) === JSON.stringify({ videos: { "d.mp4": "the dance" }, audio: { "v.wav": "calm voice" } }), nm);
  check("…an old manifest (no desc / notes) still reads, with empty ones", JSON.stringify(PR.normalize({ images: ["b.png"], videos: [], audio: [] })) === JSON.stringify({ images: [{ file: "b.png", subject: 1, role: "person", roleOther: "", desc: "" }], videos: [], audio: [], notes: { videos: {}, audio: {} } }));
  const T = fs.mkdtempSync(path.join(os.tmpdir(), "bg539-"));
  try {
    fs.mkdirSync(path.join(T, "reference", "videos"), { recursive: true });
    fs.writeFileSync(path.join(T, "reference", "videos", "d.mp4"), "x");
    const v = PR.verify(T, { videos: ["d.mp4", "lost.mp4"], audio: [], notes: { videos: { "d.mp4": "kept", "lost.mp4": "dropped" } } });
    check("…verify: a missing file's note goes with it", JSON.stringify(v.manifest.notes.videos) === JSON.stringify({ "d.mp4": "kept" }) && v.missing.includes("videos/lost.mp4"), v);
    const RG = require("../lib/refGroups.js");
    const g = RG.save(T, { name: "band", images: [{ name: "a.png", subject: 2, role: "furniture", roleOther: "", desc: "green sofa" }], videos: ["d.mp4"], audios: ["v.wav"], notes: { videos: { "d.mp4": "the dance" }, audios: { "v.wav": "her voice" } } });
    const g2 = RG.read(T).find((x) => x.name === "band");
    check("refGroups: a group keeps every reference's description (pictures, videos, sounds) and gives it back",
      g.images[0].desc === "green sofa" && g2.images[0].desc === "green sofa" && g2.notes.videos["d.mp4"] === "the dance" && g2.notes.audios["v.wav"] === "her voice" && g2.images[0].role === "furniture", g2);
  } finally { fs.rmSync(T, { recursive: true, force: true }); }
  const ri = read("routes", "index.js");
  check("the project save keeps the notes of what it stored (2.548.0: lib/projectRefs.store); the group route takes notes", /projectRefs\.store\(pdir, data\.references/.test(ri) && /out\.notes = notesKept\(want\.notes, out\)/.test(require("fs").readFileSync(require("path").join(__dirname, "..", "lib", "projectRefs.js"), "utf8")) && /notes: b\.notes && typeof b\.notes === "object"/.test(ri));

  /* ---- the LLM sees the descriptions */
  const RC = require("../lib/refContext.js");
  const d = RC.dock({ refs: [{ name: "a.png", subject: 1, role: "person", note: "the bride, red hair" }, { name: "b.png", subject: 2, role: "furniture" }], ref_videos: ["d.mp4"], ref_audios: ["v.wav"], ref_notes: { videos: { "d.mp4": "a slow waltz" }, audio: { "v.wav": "calm low voice" } } }, ["a woman", "a sofa"]);
  const bl = RC.block(d);
  check("refContext: the user's description beats the captioner's guess; none = the guess", d.pictures[0].desc === "the bride, red hair" && d.pictures[1].desc === "a sofa", d.pictures);
  check("…the videos' / sounds' descriptions are in the block the chat gets", /<Video 1> - reference video, file d\.mp4 \(its motion \/ action \/ camera\): a slow waltz/.test(bl) && /<Audio 1> - reference sound, file v\.wav \(a voice, music or sound\): calm low voice/.test(bl), bl);
  check("…✨ Enhance's mapping lines carry them too", /const note = String\(r\.note \|\| ""\)/.test(ri) && /ref_notes: eb\.ref_notes/.test(ri));

  /* ---- the house builder */
  const G = require("../static/housegeo.js"), HB = null;
  const m = G.normalize({ refs: [{ id: "x1", file: "sofa.png", kind: "furniture", desc: "green  velvet" }, { id: "x2", file: "brick.png", kind: "wall" }, { file: "../evil.png" }, { file: ".hidden" }],
    walls: [{ a: [0, 0], b: [6, 0], tex: "x2", texScale: 2 }, { a: [6, 0], b: [6, 5] }, { a: [6, 5], b: [0, 5] }, { a: [0, 5], b: [0, 0], tex: "nope" }],
    rooms: [{ name: "Lounge", poly: [[0, 0], [6, 0], [6, 5], [0, 5]], tex: "x2", texScale: 99 }],
    items: [{ type: "sofa", x: 4, y: 2.5, ref: "x1" }, { type: "sofa", x: 0.5, y: 2.5, ref: "x1" }, { type: "sofa", x: 3, y: 1, ref: "ghost" }],
    lights: [{ x: 3, y: 2.5, ref: "x1" }], cameras: [{ x: 1, y: 2.5, yaw: 0, fov: 70 }] });
  check("housegeo: refs [{id, file, kind, desc}] - a path or a hidden name is refused; a kind it does not know = other", m.refs.length === 2 && m.refs[0].desc === "green velvet" && m.refs[1].kind === "wall", m.refs);
  check("…walls / rooms keep {tex, texScale 0.1-10} only for a picture the house has; items / lights keep {ref}", m.walls[0].tex === "x2" && m.walls[0].texScale === 2 && !("tex" in m.walls[3]) && m.rooms[0].texScale === 10 && m.items[0].ref === "x1" && !("ref" in m.items[2]) && m.lights[0].ref === "x1");
  const tm = G.build(m).meshes.filter((x) => x.tex);
  check("build: a textured wall / floor is its own mesh with the picture + its tile size (the 3D view maps it)", tm.length === 2 && tm.some((x) => x.mat === "plaster" && x.tex === "brick.png" && x.texScale === 2) && tm.some((x) => x.mat === "oak" && x.tex === "brick.png" && x.texScale === 10), tm.map((x) => x.key));
  /* 2.630.0: the House builder is gone - this check went with it */
  /* 2.630.0: the House builder is gone - this check went with it */
  /* 2.630.0: the House builder is gone - this check went with it */
  /* 2.630.0: the House builder is gone - this check went with it */
  /* 2.630.0: the House builder is gone - this check went with it */

  /* ---- lib/house.js: kept with the house */
  check("refFileName: the stem's safe letters + the picture's own extension", require("../lib/house.js").refFileName("My Sofa (1).JPG", ".jpg") === "My_Sofa_1.jpg" && require("../lib/house.js").refFileName("", ".png") === "ref.png");
  const H = require("../lib/house.js");
  const hname = "E2E ref house 539";
  try {
    H.save(G.normalize({ name: hname }));
    const r1 = H.saveRef(hname, PNG, "brick wall.png"), r2 = H.saveRef(hname, PNG, "brick wall.png"), r3 = H.saveRef(hname, Buffer.concat([PNG, Buffer.from([0])]), "brick wall.png");
    check("saveRef: refs/<name> beside house.json; the same picture again = the same file; another with the name = -2", r1.file === "brick_wall.png" && r2.file === "brick_wall.png" && r2.reused && r3.file === "brick_wall-2.png" && !!H.refPath(hname, r1.file), [r1, r2, r3]);
    let bad = ""; try { H.saveRef(hname, Buffer.from("GIF89a"), "x.gif"); } catch (e) { bad = e.message; }
    check("…only PNG / JPEG / WebP; a path in the name never reaches outside", /PNG, JPEG or WebP/.test(bad) && H.refPath(hname, "../house.json") === null && H.refPath(hname, "nope.png") === null);
    const a = H.refAsset(hname, r1.file);
    const imgDir = require("../lib/core.js").pDir("images");
    check("refAsset: into the Image assets as house-<house>-ref-<file> (✨ Make it real takes pictures from there)", a.name === "house-e2e-ref-house-539-ref-brick_wall.png" && fs.existsSync(path.join(imgDir, a.name)), a);
    H.remove(hname, true);
    check("…🗑 the house with its assets takes them too", !fs.existsSync(path.join(imgDir, a.name)));
  } finally { try { H.remove(hname, true); } catch { /* gone */ } }
  const rh = read("routes", "house.js");
  check("routes/house.js: POST /api/house/:name/ref, GET /api/house/:name/ref/:file, POST /api/house/refasset (mounted from routes/index.js)",
    /app\.post\("\/api\/house\/:name\/ref"/.test(rh) && /app\.get\("\/api\/house\/:name\/ref\/:file"/.test(rh) && /app\.post\("\/api\/house\/refasset"/.test(rh) && !/house\/refasset|house\/:name\/ref/.test(read("misc/server.js")));

  /* ---- the image editor */
  const AE = require("../lib/aiEdit.js");
  check("aiEdit.refPrompt: the crop is Picture 1, the reference Picture 2 (with its description); Qwen 2.1 tags <image1> / <image2>",
    /^Picture 1 is the scene; Picture 2 is a reference \(a brass floor lamp\)\./.test(AE.refPrompt("put it by the sofa", "a brass floor lamp")) && /\nput it by the sofa$/.test(AE.refPrompt("put it by the sofa", "x")) && /^<image1> is the scene; <image2> is a reference\./.test(AE.refPrompt("t", "", true)));
  const ra = read("routes", "aiedit.js"), ie = read("ext", "imageeditdock", "imageedit.js"), mt = read("ext", "imageeditdock", "mount.js");
  check("/api/aiedit takes ref0 + ref_desc with an Edit (a second picture slot when the graph has one); other modes refuse it",
    /\{ name: "ref0", maxCount: 1 \}/.test(ra) && /aiEdit\.composePlan\(style, 1 \+ nr, core\.BASE\)/.test(ra) && /names\.refs\.length \? \[names\.crop\]\.concat\(names\.refs\)/.test(ra) && /a reference picture goes with ✨ Edit/.test(ra));
  check("the editor: a reference picture dropped on an open picture = a new layer named by its description (2.549.0: after ▦ Add as a layer); ✨ AI Edit has a 'reference' dropdown (the dock's pictures)",
    /asLayer: true/.test(mt) && /dropPicture\(e, d\.url, d\.name\)/.test(ie) && /data-as="layer">▦ Add as a layer/.test(ie) && /id="kxRowRef"/.test(ie) && /function paintRefs\(\)/.test(ie) && /req\.refs\.push\(rr\.file/.test(ie) && /fd\.append\("ref0", req\.ref/.test(mt) && /fd\.append\(`ref\$\{i\}`, b/.test(mt) && /refList: \(\) =>/.test(mt));

  /* ---- the checklist */
  const tp = JSON.parse(read("lib", "testPlan.json")), gg = tp.groups.find((x) => x.id === "g539");
  check("lib/testPlan.json: 2.539.0, group g539 first", /^2\.(539|5[4-9]\d|[6-9]\d\d)\.\d+$/.test(tp.version) && !!gg && ["ref_desc", "ref_types", "ie_ref_layer", "ie_ref_edit"].every((id) => gg.items.some((i) => i.id === id)));
  /* 2.630.0: the House builder is gone - this check went with it */

  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log("FAIL: crashed " + (e.stack || e)); console.log("RESULT: FAIL"); process.exit(1); });
