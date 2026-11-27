#!/usr/bin/env node
// bitGen Studio 2.983.0 - DAZ IN THE SKETCHER ITSELF: the 📚 library as a floating docker, the 🧭 explorer + 🎚 parameters
// (Shape / Pose / Motion) as dockers, characters as rigged objects in the Sketcher's own scene; clothes, hair, shoes, poses and
// shape presets used on the picked character. Tim: "can we move all of the daz features out of the dialog and into the main
// sketcher docker please ... the character will be in the sketcher scene when dragged from the library to the scene. when
// the character is selected, other daz assets can be used on that character, like hair, clothes, genitals, shoes, poses etc".
// dressDoll() adds OUR OWN made-up shirt / shoes / pose / shape preset to test-981's doll (no Daz content).
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let P = 0, F = 0;
const check = (n, ok, got) => { if (ok) { P++; console.log("PASS:", n); } else { F++; console.log("FAIL:", n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 800))); } };
const src = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const near = (a, b, e) => Math.abs(a - b) < (e || 1e-6);
/** the doll's wardrobe: a shirt (a tube round the torso), shoes, a pose preset (an arm out, the elbow bent, the hips 10 cm on), a shape preset */
function dressDoll(dir) {
  const wr = (rel, obj) => { const f = path.join(dir, ...rel.split("/")); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(obj)); return f; };
  const pt = (x, y, z) => [{ id: "x", value: x }, { id: "y", value: y }, { id: "z", value: z }];
  const tube = (cx, y0, y1, r, rings, bone) => { const v = [], p = [], w = [], NS = 12; for (let i = 0; i <= rings; i++) for (let k = 0; k < NS; k++) { const a = k / NS * Math.PI * 2, y = y0 + (y1 - y0) * i / rings; v.push([cx + r * Math.cos(a), y, r * 0.75 * Math.sin(a)]); w.push(typeof bone === "function" ? bone(y) : bone); } for (let i = 0; i < rings; i++) for (let k = 0; k < NS; k++) { const a = i * NS + k, b = i * NS + (k + 1) % NS; p.push([0, 0, a, b, b + NS, a + NS]); } return { v, p, w }; };
  const piece = (id, parts, boneList) => {
    const v = [], p = [], w = []; for (const t of parts) { const b0 = v.length; v.push(...t.v); w.push(...t.w); p.push(...t.p.map((q) => [q[0], q[1], ...q.slice(2).map((x) => x + b0)])); }
    wr("data/Test Co/" + id + "/" + id + ".dsf", { geometry_library: [{ id: id + "-geo", vertices: { values: v }, polygon_material_groups: { values: ["Cloth"] }, polylist: { values: p } }],
      node_library: [{ id, type: "figure" }].concat(boneList.map(([b, c]) => ({ id: b, type: "bone", center_point: pt(...c) }))),
      modifier_library: [{ id: "skin", skin: { joints: boneList.map(([b]) => ({ node: "#" + b, node_weights: { values: w.map((x, i) => (x === b ? [i, 1] : null)).filter(Boolean) } })) } }] });
  };
  piece("Shirt", [tube(0, 95, 142, 16.5, 8, (y) => (y < 112 ? "hip" : "chest"))], [["hip", [0, 95, 0]], ["chest", [0, 120, 0]]]);
  wr("People/Doll/Clothing/Shirt.duf", { asset_info: { type: "wearable" }, scene: { nodes: [{ id: "Shirt", url: "/data/Test%20Co/Shirt/Shirt.dsf#Shirt", conform_target: "#Doll" }] } });
  piece("Shoes", [tube(10, -0.5, 9, 6, 2, "lFoot"), tube(-10, -0.5, 9, 6, 2, "rFoot")], [["lFoot", [10, 8, 0]], ["rFoot", [-10, 8, 0]]]);
  wr("People/Doll/Clothing/Shoes.duf", { asset_info: { type: "wearable" }, scene: { nodes: [{ id: "Shoes", url: "/data/Test%20Co/Shoes/Shoes.dsf#Shoes", conform_target: "#Doll" }] } });
  wr("People/Doll/Poses/Wave.duf", { asset_info: { type: "preset_pose" }, scene: { animations: [
    { url: "name://@selection/lShldr:?rotation/z/value", keys: [[0, 0], [1, 30]] }, { url: "name://@selection#lForearm:?rotation/y/value", keys: [[0, -90]] },
    { url: "name://@selection/rThigh:?rotation/x/value", keys: [[0, -20]] }, { url: "name://@selection/lPinkyFinger:?rotation/z/value", keys: [[0, 40]] },
    { url: "name://@selection/hip:?translation/z/value", keys: [[0, 10]] }, { url: "name://@selection:?rotation/y/value", keys: [[0, 5]] }] } });
  wr("People/Doll/Shapes/Wide.duf", { asset_info: { type: "preset_shape" }, scene: { modifiers: [{ id: "BodyWide", url: "/data/Test%20Co/Doll/Morphs/Test%20Co/BodyWide.dsf#BodyWide", channel: { id: "value", current_value: 0.8 } }] } });
}
(async () => {
  const PR = require(path.join(ROOT, "lib/dazPreset")), T = require(path.join(ROOT, "ext/pushpulldock/ppdaztools.js")), S = require(path.join(ROOT, "ext/pushpulldock/ppdazscene.js")), D = require(path.join(ROOT, "lib/dazLib")), core = require(path.join(ROOT, "lib/core"));
  const t981 = fs.readFileSync(path.join(__dirname, "test-981.js"), "utf8"), { makeDoll } = new Function("require", "path", "fs", t981.slice(t981.indexOf("const pt = "), t981.indexOf("(async () => {")) + "; return { makeDoll };")(require, path, fs);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "daz983_")), lib = path.join(tmp, "DollLib"); makeDoll(lib); dressDoll(lib);
  const realCfg = core.getConfig; core.getConfig = () => ({ daz_library: { roots: [lib] } });
  try {
    const pp = PR.parsePose(D.readDson(path.join(lib, "People/Doll/Poses/Wave.duf")));
    check("parsePose(): the bones' turns (the LAST key - '/bone' and '#bone' both), the hips' move (cm); the figure's own turn left out", pp.pose.lShldr.z === 30 && pp.pose.lForearm.y === -90 && pp.pose.rThigh.x === -20 && pp.n === 4 && JSON.stringify(pp.hips) === "[0,0,10]" && !pp.pose[""], pp);
    check("parsePose(): junk / no keys / no hips move -> nothing, hips null", PR.parsePose({ scene: { animations: [{ url: "x" }, { url: "name://@selection/a:?rotation/x/value", keys: [] }, null] } }).n === 0 && PR.parsePose({}).hips === null);
    check("parseShape(): a shape preset's dial values", JSON.stringify(PR.parseShape(D.readDson(path.join(lib, "People/Doll/Shapes/Wide.duf")))) === JSON.stringify([{ url: "/data/Test%20Co/Doll/Morphs/Test%20Co/BodyWide.dsf#BodyWide", value: 0.8 }]));
    const sc = D.scan({ root: lib }), by = Object.fromEntries(sc.items.map((x) => [x.name, x.kind]));
    check("the library sorts the doll's things: the figure, clothing (shirt + shoes), a pose, a shape preset", by.Doll === "figure" && by.Shirt === "clothing" && by.Shoes === "clothing" && by.Wave === "pose" && by.Wide === "shape", by);
    const out = await D.build({ root: lib, rel: "People/Doll/Doll.duf", wear: [{ rel: "People/Doll/Clothing/Shirt.duf" }, { rel: "People/Doll/Clothing/Shoes.duf" }] });
    check("the doll builds wearing its shirt and shoes (3 pieces, each on the doll's bones)", out.info.pieces.map((x) => x.name + ":" + x.kind).join() === "Doll:figure,Shirt:clothing,Shoes:clothing", out.info.pieces);
  } catch (e) { check("crashed: " + e.message, false); }
  finally { core.getConfig = realCfg; fs.rmSync(tmp, { recursive: true, force: true }); }
  /* the page parts (pure) */
  check("freeSpot(): a new character 1 m along x from the ones in the scene", JSON.stringify(T.freeSpot([])) === '{"x":0,"y":0,"rot":0}' && T.freeSpot([{ inScene: true, place: { x: 0 } }, { inScene: true, place: { x: 1 } }, { inScene: false, place: { x: 2 } }]).x === 2);
  const pk = T.posePick({ lShldr: { z: 30 }, nope: { x: 1 }, lForearm: { y: "-90" } }, { lShldr: {}, lForearm: {} });
  check("posePick(): only the bones the figure has (numbers made safe)", pk.n === 2 && pk.pose.lForearm.y === -90 && !pk.pose.nope);
  const cs = T.cleanScene({ chars: [{ id: "a", fig: { rel: "x.duf" }, inScene: 1, hidden: 0, place: { x: "2", y: -1, rot: 90 }, pose: { lShldr: { z: 30 }, bad: 5 } }] }).chars[0];
  check("cleanScene(): a character's place in the Sketcher, its pose, in the scene / hidden kept", cs.inScene === true && cs.hidden === false && JSON.stringify(cs.place) === '{"x":2,"y":-1,"rot":90}' && cs.pose.lShldr.z === 30 && !("bad" in cs.pose));
  check("KINDS: + 🕴 Poses + 🎚 Shapes; WEAR = what is worn", T.KINDS.map((k) => k[0]).join() === "figure,character,clothing,hair,anatomy,pose,shape,material,other" && T.WEAR.join() === "clothing,hair,anatomy,material,other");
  check("placeOf(): a place made safe (the turn 0..360)", JSON.stringify(S.placeOf({ x: "1.5", y: null, rot: -90 })) === '{"x":1.5,"y":0,"rot":270}');
  check("groundHit(): a ray onto the Sketcher's floor (z 0); looking along / up = none", JSON.stringify(S.groundHit({ o: [0, -5, 5], d: [0, 0.6, -0.8] })) === "[0,-1.25]" && S.groundHit({ o: [0, 0, 5], d: [1, 0, 0] }) === null && S.groundHit({ o: [0, 0, 5], d: [0, 0, 1] }) === null);
  /* wiring */
  const ui = src("ext/pushpulldock/ppdaztools.js"), sc2 = src("ext/pushpulldock/ppdazscene.js"), EJ = JSON.parse(src("ext/pushpulldock/ext.json")).scripts;
  check("ext.json: ppdazscene.js between ppdazpose.js and ppdaztools.js", EJ.indexOf("ppdazscene.js") === EJ.indexOf("ppdazpose.js") + 1 && EJ.indexOf("ppdaztools.js") === EJ.indexOf("ppdazscene.js") + 1);
  check("the Sketcher's 📚 button shows / hides the DAZ dockers (no dialog)", /\$\("ppDazLib"\)\.onclick = \(\) => \(root\.H3DazTools \? root\.H3DazTools\.toggle\(\)/.test(src("ext/pushpulldock/ppdock.js")));
  check("the dockers live in the Sketcher (#ppMain): the floating #dzLib, the #dzSide column (#dzExp + #dzPar tabs Shape / Pose / Motion); off = hidden", /\$\("ppMain"\)/.test(ui) && /L\.id = "dzLib"/.test(ui) && /R\.id = "dzSide"/.test(ui) && /data-tab="pose"/.test(ui) && /data-tab="motion"/.test(ui) && /#pushpulldock:not\(\.dz-on\) \.dz-el\{display:none!important\}/.test(ui) && /\.dz-el \[hidden\]\{display:none!important\}/.test(ui));
  check("drag a library item into the 3D view (dragover / drop on #ppView); a click picks a character / its bone", /draggable = true/.test(ui) && /view\.addEventListener\("drop"/.test(ui) && /S\.pickBone\(e, id\)/.test(ui));
  check("the characters are rigged objects in the Sketcher's scene (glTF Y-up turned to its Z-up), drawn on demand", /inner\.rotation\.x = Math\.PI \/ 2/.test(sc2) && /v\.scene\.getObjectByName\("pp-daz"\)/.test(sc2) && /v\.draw\(\)/.test(sc2) && /BoxHelper/.test(sc2));
  check("the preset route: GET /api/dazlib/preset (pose / shape)", /\/api\/dazlib\/preset/.test(src("routes/dazBody.js")) && /parsePose/.test(src("routes/dazBody.js")));
  check("the docs: USAGE (the DAZ dockers in the Sketcher) + CHANGELOG 2.983.0 + FEATURES", /DAZ dockers/.test(src("docs/USAGE.md")) && /2\.983\.0/.test(src("misc/CHANGELOG.md")) && /DAZ dockers/.test(src("docs/FEATURES.md")));
  console.log(`\n${P} passed, ${F} failed`);
  process.exit(F ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
