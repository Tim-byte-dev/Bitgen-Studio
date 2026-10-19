#!/usr/bin/env node
/* bitGen Studio — 2.540.0 units: BLENDER / UNREAL RENDERS MADE REAL WITH THE REFERENCE DOCKER'S PICTURES.
 * Tim (verbatim): "can we make it so the timeline and image-edit renders of blender and unreal use our references from
 * the reference docker. so it sees a block in a blender layer, the block is a car, the reference for the car is in our
 * reference docker etc. for all objects/meshes and is animated with our 3dreal" (matched by name + set by hand).
 * static/realrefs.js (pure), lib/realRefs.js (the edit job + the 3DREAL chain - core.makeJob stood in), a REAL Blender
 * render of a small scene with the first frame + where each mesh is (when Blender is here), blend_layer3d's boxes,
 * the Unreal bridge's actors_in_view through scripts/ue-stub.js. */
"use strict";
const fs = require("fs"), os = require("os"), path = require("path");
const { execFileSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, cond, got) => { if (cond) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const PNG = Buffer.from("89504e470d0a1a0a0000000d4948445200000002000000020802000000fdd49a730000001649444154789c63f8cfc0f09f818181e1ff7f0606000037f005fd8a5a6fb10000000049454e44ae426082", "hex");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const R = require("../static/realrefs.js");
  /* ---- matching */
  check("words: camelCase, digits, _ . - split; SM_ / generic words out; a plural also as its singular", JSON.stringify(R.words("SM_SportsCar.002")) === JSON.stringify(["sports", "car"]) && R.words("Chairs_Set").includes("chair") && R.words("Cube.001").join() === "cube");
  const refs = [{ name: "brick.png", desc: "red brick", role: "wall" }, { name: "sofa.png", desc: "a green velvet chesterfield", role: "furniture" }, { name: "IMG_0042.jpg", desc: "a red 1982 Trans Am", role: "other" }, { name: "lamp.png", desc: "brass floor lamp", role: "light" }];
  const objs = [{ name: "Car.001", box: [0.1, 0.5, 0.3, 0.8] }, { name: "SM_Couch_02", box: [0.5, 0.4, 0.7, 0.6] }, { name: "Wall_North" }, { name: "Cube" }, { name: "Vehicle_Hero" }, { name: "LightFixture" }];
  const am = R.autoMatch(objs, refs);
  check("autoMatch: by the object's name - Wall_North = the wall picture, SM_Couch_02 = the chesterfield (couch = sofa), LightFixture = the lamp; a 'Trans Am' with no word for car is not guessed; Cube = nothing", am["Wall_North"] === 0 && am["SM_Couch_02"] === 1 && am["LightFixture"] === 3 && am["Car.001"] === undefined && am["Cube"] === undefined, am);
  const refs2 = refs.concat([{ name: "car.png", desc: "a red 1982 Trans Am car", role: "other" }]);
  const am3 = R.autoMatch([{ name: "Ground" }, { name: "Seat" }, { name: "Road" }, { name: "Lamp" }], [{ desc: "a brass floor lamp", role: "light" }, { desc: "a car seat" }, { desc: "grey street pavement" }]);
  check("autoMatch: a word that only describes the next one is not the thing - 'a brass floor lamp' is a lamp (Ground is not it), 'a car seat' is a seat, 'street pavement' is the ground", am3.Ground === 2 && am3.Seat === 1 && am3.Road === 2 && am3.Lamp === 0, am3);
  const am2 = R.autoMatch(objs, refs2);
  check("…words that mean the same: Couch = chesterfield / sofa, Vehicle = car, Car = car", am2["Car.001"] === 4 && am2["Vehicle_Hero"] === 4 && am2["SM_Couch_02"] === 1, am2);
  const rs = R.resolve(objs, refs2, { Cube: "2", Wall_North: "-" });
  check("resolve: a choice by hand beats the match ('2' = the dock's 3rd picture), '-' = no reference, no match = left out", rs.find((x) => x.object === "Cube").ref === 2 && rs.find((x) => x.object === "Cube").how === "manual" && !rs.some((x) => x.object === "Wall_North") && rs.find((x) => x.object === "Car.001").how === "auto", rs);
  check("where: left / middle / right, near the top / at the front / filling the picture", R.where([0.05, 0.6, 0.3, 0.95]) === "on the left, at the front" && R.where([0.4, 0.05, 0.6, 0.3]) === "in the middle, near the top" && R.where([0, 0, 1, 1]) === "in the middle, filling much of the picture" && R.where(null) === "");
  const fp = R.framePrompt([{ object: "Car.001", box: [0.1, 0.5, 0.3, 0.8], ref: 4 }, { object: "Wall_North", box: null, ref: 0 }, { object: "Car.002", box: [0.7, 0.5, 0.9, 0.8], ref: 4 }], refs2, "at golden hour");
  check("framePrompt: Picture 1 = the render, each picture once (Picture 2, 3 … in order), which shape becomes what, walls / floors 'look like', the user's words last",
    JSON.stringify(fp.pics) === "[4,0]" && /^Picture 1 is a grey 3D layout render/.test(fp.prompt) && /The grey shape on the left \(the object "Car\.001"\) becomes a red 1982 Trans Am car in Picture 2\./.test(fp.prompt)
    && /The wall surface \(the object "Wall_North"\) looks like Picture 3 \(red brick\)\./.test(fp.prompt) && /"Car\.002"\) becomes a red 1982 Trans Am car in Picture 2/.test(fp.prompt) && /no extra objects\. At golden hour$/.test(fp.prompt), fp);
  check("…Qwen Image 2.1 writes <image1> <image2>; an Unreal render is said to be one", /^<image1> is an Unreal Engine render/.test(R.framePrompt([{ object: "SM_Car", ref: 4 }], refs2, "", { tags: true, kind: "unreal" }).prompt) && /in <image2>/.test(R.framePrompt([{ object: "SM_Car", ref: 4 }], refs2, "", { tags: true }).prompt));
  check("videoPrompt: the user's words + what each object really is (once each)", R.videoPrompt([{ object: "Car.001", ref: 4 }, { object: "Car.002", ref: 4 }, { object: "SM_Couch_02", ref: 1 }], refs2, "the car drives away") === "The car drives away. The car is a red 1982 Trans Am car; the couch is a green velvet chesterfield. Keep them exactly as in the first frame.");
  check("boxOf: projected points -> a 0-1 box, clipped; nothing / a sliver = null", JSON.stringify(R.boxOf([[100, 50], [300, 200], null], 400, 400)) === JSON.stringify([0.25, 0.125, 0.75, 0.5]) && R.boxOf([null], 10, 10) === null && R.boxOf([[1, 1], [1.001, 1.001]], 1000, 1000) === null && JSON.stringify(R.boxOf([[-50, -50], [100, 100]], 200, 200)) === JSON.stringify([0, 0, 0.5, 0.5]));
  const cam = { loc: [0, 0, 100], rot: [0, 0, 0], fov: 90 };
  const ahead = R.ueBox(cam, 1280, 720, [500, 0, 100], [50, 50, 50]), left = R.ueBox(cam, 1280, 720, [500, -300, 100], [50, 50, 50]), behind = R.ueBox(cam, 1280, 720, [-500, 0, 100], [50, 50, 50]);
  const turned = R.ueBox({ loc: [0, 0, 100], rot: [0, 0, 90], fov: 90 }, 1280, 720, [0, 500, 100], [50, 50, 50]);
  check("ueBox: an Unreal actor straight ahead is in the middle; Y- is on the left; behind the camera = null; the camera turned 90° (yaw) sees +Y ahead", ahead && Math.abs((ahead[0] + ahead[2]) / 2 - 0.5) < 0.01 && Math.abs((ahead[1] + ahead[3]) / 2 - 0.5) < 0.01
    && left && left[2] < 0.5 && behind === null && turned && Math.abs((turned[0] + turned[2]) / 2 - 0.5) < 0.01, { ahead, left, behind, turned });
  const ff = R.formFor([{ object: "a", ref: 4 }, { object: "b", ref: 1 }, { object: "c", ref: 4 }], refs2);
  check("formFor: the pictures used, once each, renumbered for the upload", JSON.stringify(ff.used) === "[4,1]" && ff.items[2].ref === 0 && ff.items[1].ref === 1 && ff.refs[0].desc === "a red 1982 Trans Am car");
  const lh = R.listHtml(objs.slice(0, 2), refs2, { "Car.001": "1" });
  check("listHtml: a dropdown per object - auto: <its match>, no reference, the dock's pictures (a choice by hand selected)", /data-rrobj="Car\.001"/.test(lh) && /<option value="1" selected>a green velvet chesterfield/.test(lh) && /auto: a green velvet chesterfield/.test(lh));

  /* ---- lib/realRefs.js */
  const RR = require("../lib/realRefs.js"), core = require("../lib/core.js");
  const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xc0, 0, 17, 8, 0x01, 0x2c, 0x02, 0x58, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1]);
  check("sizeOf: a PNG's / a JPEG's size from its header; renderSize: the aspect at about 1 MP in 16-px steps", JSON.stringify(RR.sizeOf(PNG)) === "[2,2]" && JSON.stringify(RR.sizeOf(jpg)) === "[600,300]" && JSON.stringify(RR.renderSize(1920, 1080)) === "[1360,768]" && JSON.stringify(RR.renderSize(720, 1280)) === "[768,1360]", [RR.sizeOf(jpg), RR.renderSize(1920, 1080)]);
  let bad = ""; try { RR.upload([{ buffer: Buffer.from("GIF89a") }], []); } catch (e) { bad = e.message; }
  const up = RR.upload([{ buffer: PNG }, { buffer: PNG }], [{ desc: "a red 1982 Trans Am car", role: "other" }, { desc: "brick", role: "wall" }]);
  check("upload: the pictures + their descriptions kept in the project's temp/realrefs/<token> (not a picture = refused)", /not a PNG, JPEG or WebP/.test(bad) && /^[a-z0-9]{6,}$/.test(up.token) && up.refs.length === 2 && fs.existsSync(path.join(RR.tokDir(up.token), "ref1.png")) && RR.readRefs(up.token).refs[0].desc === "a red 1982 Trans Am car", up);
  let tb = ""; try { RR.tokDir("../x"); } catch (e) { tb = e.message; }
  check("…a token that is not ours never reaches outside", /no such reference set/.test(tb));
  const es = RR.editStyles();
  check("editStyles: the edit styles, the one that takes the most pictures first (" + es.map((x) => x.name + " " + x.max).join(", ") + ")", Array.isArray(es) && es.every((x, i) => i === 0 || es[i - 1].max >= x.max));
  if (es.length) {
    // the chain, with core.makeJob stood in (no worker starts) and blenderScene.queue recorded
    const made = [], realMake = core.makeJob, scene = require("../lib/blenderScene.js"), realQ = scene.queue, queued = [];
    core.makeJob = (p) => { const j = { id: "fake" + made.length, status: "queued", params: p, log: [], output: null }; made.push(j); core.jobs.set(j.id, j); return j; };
    scene.queue = (saved, meta) => { queued.push({ saved, meta }); const j = { id: "fake3dreal", status: "queued", log: [] }; core.jobs.set(j.id, j); return { job: j, params: {}, note: "" }; };
    const T = fs.mkdtempSync(path.join(os.tmpdir(), "rr540-")), frame = path.join(T, "f.png"), video = path.join(T, "v.mp4");
    fs.writeFileSync(frame, PNG); fs.writeFileSync(video, "x");
    try {
      let e1 = ""; try { RR.start({ kind: "video", token: up.token, items: [{ object: "Car", ref: 5 }], frame, video }); } catch (e) { e1 = e.message; }
      check("start: no object with a picture of the set = refused in words", /no object has a reference picture/.test(e1), e1);
      const c = RR.start({ kind: "video", source: "blender", token: up.token, items: [{ object: "Car.001", box: [0.1, 0.5, 0.3, 0.8], ref: 0 }, { object: "Wall", ref: 1 }], frame, video, seconds: 4, prompt: "it drives off", style_id: es[0].id, ltx: { ic_strength: 0.8 } });
      const A = made[0];
      check("start: ONE edit image job - Picture 1 = the render's first frame, then the reference pictures; the prompt says which shape becomes what", A && A.params.mode === "image" && A.params.images.length === Math.min(3, es[0].max) && /frame\.png$/.test(A.params.images[0]) && /ref0\.png$/.test(A.params.images[1]) && /becomes a red 1982 Trans Am car in (Picture 2|<image2>)/.test(A.params.prompt) && A.params.aiedit === "compose" && c.edit === A.id, A && A.params);
      check("…its size keeps the frame's aspect; the chain waits for it", A.params.width >= 256 && A.params.width === A.params.height && RR.status(c.id).state === "edit" && queued.length === 0, [A.params.width, A.params.height]);
      // the edit finishes: its picture is in the outputs -> 3DREAL with it as the first frame
      const outName = "rr540test_" + Date.now() + ".png"; fs.mkdirSync(core.pDir("output"), { recursive: true }); fs.writeFileSync(path.join(core.pDir("output"), outName), PNG);
      A.status = "done"; A.output = outName;
      for (let i = 0; i < 40 && !queued.length; i++) await sleep(100);
      const q = queued[0] || {};
      check("…when it is done: LTX 2.3 3DREAL with THAT picture as the first frame and the render as the guide; the prompt names every object", q.meta && q.meta.first === path.join(core.pDir("output"), outName) && q.saved.path === video && q.saved.seconds === 4 && /^It drives off\. The car is a red 1982 Trans Am car; the wall is brick\./.test(q.meta.prompt) && q.meta.ic_strength === 0.8 && RR.status(c.id).state === "real", q);
      core.jobs.get("fake3dreal").status = "done";
      for (let i = 0; i < 40 && RR.status(c.id).state !== "done"; i++) await sleep(100);
      check("…and the chain says done", RR.status(c.id).state === "done" && RR.status(c.id).real === "fake3dreal");
      const ci = RR.start({ kind: "image", source: "unreal", token: up.token, items: [{ object: "SM_Car_01", ref: 0 }], frame, prompt: "", style_id: es[0].id });
      check("start kind image (the image editor): one edit job, not filed in the assets (it comes back as a layer); an Unreal render is said to be one", made[1].params.no_assets === true && /Unreal Engine render/.test(made[1].params.prompt) && ci.edit === made[1].id);
      fs.rmSync(path.join(core.pDir("output"), outName), { force: true });
    } finally { core.makeJob = realMake; scene.queue = realQ; fs.rmSync(T, { recursive: true, force: true }); made.forEach((j) => core.jobs.delete(j.id)); core.jobs.delete("fake3dreal"); }
  } else check("(no edit style here - the chain was not tried)", true);
  fs.rmSync(RR.tokDir(up.token), { recursive: true, force: true });
  const bs = read("lib", "blenderScene.js");
  check("blenderScene.queue: meta.first = the real first frame (images [first]) - 3DREAL reads a picture as its first frame", /images: m\.first && fs\.existsSync\(m\.first\) \? \[m\.first\] : \[\]/.test(bs));

  /* ---- a REAL Blender: the first frame + where each mesh is */
  let blender = null; try { blender = require("../lib/blender.js").find(); } catch { blender = null; }
  if (blender) {
    const T = fs.mkdtempSync(path.join(os.tmpdir(), "rr540b-")), blend = path.join(T, "rr540.blend");
    try {
      execFileSync(blender, ["-b", "--factory-startup", "-P", path.join(ROOT, "scripts", "make_layer3d_fixture.py"), "--", blend], { stdio: "ignore", timeout: 120000 });
      const BV = require("../lib/blendView.js"), up2 = RR.upload([{ buffer: PNG }], [{ desc: "a red sports car", role: "other" }]);
      const st = await BV.open(blend, { fresh: true });
      let got = null; const realStart = RR.start; RR.start = (spec) => { got = spec; return { id: "rrx", edit: "jx", note: "1 reference picture" }; };
      try {
        const r = BV.render(st.stem || st.info.stem, { start: 1, end: 2, view: null, engine: "WORKBENCH", prompt: "a car in the street", realrefs: { token: up2.token, items: [{ object: "Body", ref: 0 }] } });
        let s = null; for (let i = 0; i < 600; i++) { s = BV.renderStatus(r.id); if (s.state !== "running") break; await sleep(200); }
        const bx = got && got.items[0] && got.items[0].box;
        check("Blender renders the segment AND its first frame (a PNG) + each mesh's box on it; the chain starts with them (kind video, the render, its length)",
          s.state === "done" && got && got.kind === "video" && fs.existsSync(got.frame) && fs.readFileSync(got.frame).readUInt32BE(0) === 0x89504e47 && /\.mp4$/.test(got.video) && got.prompt === "a car in the street" && Array.isArray(bx) && bx[0] < bx[2] && bx[1] < bx[3], { s, got });
        check("…the objects in view are listed for the page (Body, Arm, …)", (s.objects2d || []).some((o) => o.id === "Body") && (s.objects2d || []).every((o) => o.box.length === 4), s.objects2d);
      } finally { RR.start = realStart; try { BV.close(); } catch { /* fine */ } fs.rmSync(RR.tokDir(up2.token), { recursive: true, force: true }); }
      // blend_layer3d: the meshes' world boxes in the scene's meta (the image editor projects them)
      const L3 = require("../lib/layer3d.js"), sc = await L3.open(blend);
      const body = ((sc.meta || {}).objects || []).find((o) => o.name === "Body");
      check("layer3d meta: each mesh's world box [lo, hi] (the 3D layer's 🖼 References put them on the picture)", body && Array.isArray(body.box) && body.box[0].length === 3 && body.box[0][2] < body.box[1][2], body);
      const PC3D = require("../ext/imageeditdock/pc3d.js"), on = PC3D.objectsOnPicture(sc.meta.objects, sc.meta.orbit, 1280, 720);
      check("pc3d.objectsOnPicture: the meshes through the layer's camera -> boxes on the picture", on.some((o) => o.name === "Body" && o.box && o.box[0] < o.box[2]), on);
      try { L3.close(sc.id); } catch { /* fine */ }
    } finally { fs.rmSync(T, { recursive: true, force: true }); }
  } else check("(no Blender here - the real Blender render was not tried)", true);
  check("blend_scene.py: job still + objects2d (world_to_camera_view of every visible mesh's bound box at the first frame)", /def objects2d\(sc, cam\):/.test(read("scripts", "blend_scene.py")) && /world_to_camera_view/.test(read("scripts", "blend_scene.py")) && /extra\["still"\]/.test(read("scripts", "blend_scene.py")));

  /* ---- Unreal: the actors a camera sees (the bridge 1.3.0, the stand-in) */
  const UE = require("../lib/unreal.js"), stub = require("./ue-stub.js");
  const cfg0 = JSON.parse(JSON.stringify((core.getConfig() || {}).unreal || null)), S0 = await stub.start(0);
  try {
    UE.saveSettings({ port: S0.port });
    const a = await UE.actorsInView({ camera: { loc: [-600, 0, 170], rot: [0, -5, 0], fov: 60 }, w: 1280, h: 720 });
    const car = a.objects.find((o) => o.name === "SM_Car_01"), sofa = a.objects.find((o) => o.name === "Sofa"), lamp = a.objects.find((o) => o.name === "FloorLamp");
    check("actorsInView: the mesh actors on the picture (the car in the middle, the sofa on the left, the lamp on the right; behind the camera = left out)",
      car && Math.abs((car.box[0] + car.box[2]) / 2 - 0.5) < 0.05 && sofa && sofa.box[2] < 0.5 && lamp && lamp.box[0] > 0.5 && !a.objects.some((o) => o.name === "BehindTheCamera"), a.objects);
    const call = S0.calls.filter((c) => c.cmd === "actors_in_view").pop();
    check("…the bridge was asked with the still's camera", call && JSON.stringify(call.args.camera.loc) === "[-600,0,170]");
    const mt = R.resolve(a.objects, refs2, {});
    check("…and the actors match the references by name (SM_Car_01 = the car, Sofa = the chesterfield, FloorLamp = the lamp)", mt.find((x) => x.object === "SM_Car_01").ref === 4 && mt.find((x) => x.object === "Sofa").ref === 1 && mt.find((x) => x.object === "FloorLamp").ref === 3, mt);
  } finally { await S0.close(); const c = core.getConfig(); if (cfg0) c.unreal = cfg0; else delete c.unreal; core.setConfig(c); }
  const py = read("ue", "bitGenBridge", "Content", "Python", "bitgen_bridge.py");
  check("the bridge 1.3.0: cmd actors_in_view (mesh actors' bounds + the camera; hidden / bitGen_* / landscape / lights / cameras out)", /def cmd_actors_in_view\(a\):/.test(py) && /"actors_in_view": cmd_actors_in_view/.test(py) && /get_actor_bounds/.test(py) && /"VersionName": "1\.3\.0"/.test(read("ue", "bitGenBridge", "bitGenBridge.uplugin")));
  try { execFileSync("python3", ["-c", "import ast,sys;ast.parse(open(sys.argv[1]).read())", path.join(ROOT, "ue", "bitGenBridge", "Content", "Python", "bitgen_bridge.py")]); check("…bitgen_bridge.py parses", true); } catch (e) { check("…bitgen_bridge.py parses", false, String(e.stderr || e.message)); }

  /* ---- the pages + routes */
  const ri = read("routes", "index.js"), rr = read("routes", "realRefs.js"), sv = read("server.js");
  check("routes/realRefs.js mounted from routes/index.js (never server.js): styles, upload, start, status", /require\("\.\/realRefs"\)\.mount\(app\)/.test(ri) && /\/api\/realrefs\/styles/.test(rr) && /\/api\/realrefs\/upload/.test(rr) && /\/api\/realrefs\/start/.test(rr) && /\/api\/realrefs\/:id/.test(rr) && !/realrefs|realRefs/i.test(sv));
  check("/api/unreal/actors (routes/unreal.js) + UEBridge.actors", /\/api\/unreal\/actors/.test(read("routes", "unreal.js")) && /const actors = \(o\) => api\("\/api\/unreal\/actors", o\)/.test(read("static", "unreal.js")));
  const bv = read("ext", "timelinedock", "blendview.js"), pc = read("ext", "imageeditdock", "pc3d.js"), pu = read("ext", "imageeditdock", "pcunreal.js"), tu = read("ext", "timelinedock", "tlunreal.js");
  check("the timeline's .blend: 🖼 References (Use them, the edit model, a dropdown per mesh); Render to real uploads the pictures and sends realrefs", /refsHtml\(st\)/.test(bv) && /id="tlbRefsOn"/.test(bv) && /RealRefs\.upload\(items, refs\)/.test(bv) && /body\.realrefs = \{ token: u\.token/.test(bv));
  check("the image editor: the 3D layer's 🖼 References + ✨ Generate from it with them; the Unreal layer's 🔍 Find the objects + ✨ Make it real", /generateWithRefs\(L, items, text\)/.test(pc) && /id="ueFind"/.test(pu) && /id="ueReal"/.test(pu) && /U\(\)\.actors\(stillRequest\(u, U\(\)\.framing\)\)/.test(pu));
  check("the timeline's UNREAL ▸ Render to Real (🔍, the dropdowns, 3DREAL) -> /api/realrefs/start kind video with the clip", /label: "Render to Real"/.test(tu) && /video_asset: s\.c\.name/.test(tu) && /kind: "video", source: "unreal"/.test(tu));
  check("index.html loads static/realrefs.js", /<script src="\/static\/realrefs\.js"><\/script>/.test(read("static", "index.html")));
  const tp = JSON.parse(read("lib", "testPlan.json"));
  check("lib/testPlan.json: 2.540.0, g540 first", tp.version === "2.540.0" && tp.groups[0].id === "g540" && /"ie_realrefs"\]/.test(read("lib", "testPlan.js")));

  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log("FAIL: crashed " + (e.stack || e)); console.log("RESULT: FAIL"); process.exit(1); });
