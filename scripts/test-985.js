#!/usr/bin/env node
/* bitGen Studio — 2.985.0: Delete takes a picked DAZ character; the model's pieces with 👁; a pose's own figure turn / move +
 * the hips kept; 🎨 material presets worn; 🔍 Zoom; 🏛 Architecture; ✨ Photo names the people, reaches them in its depth map,
 * says why a render failed. Tim: "del button deletes the selected object including the daz characters. rendering via ai is not
 * working (make photo) ... daz characters and assets should be rendered too. show the added assets to the model like hair,
 * eyes, mouth, genitals and fix the pose positions from daz poses. add a zoom button to toolbar. add and architecture button
 * to the top toolbar, hide/show all the architecture tools when toggled". */
"use strict";
const path = require("path");
const fs = require("fs");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const rd = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

// pose presets: the figure's own channels = the whole figure, the hips separately
const PR = require(path.join(ROOT, "lib/dazPreset.js"));
const pp = PR.parsePose({ scene: { animations: [
  { url: "name://@selection:?rotation/x/value", keys: [[0, -90]] }, { url: "name://@selection:?translation/y/value", keys: [[0, 15]] },
  { url: "name://@selection/hip:?translation/y/value", keys: [[0, -5]] }, { url: "name://@selection/lShldr:?rotation/z/value", keys: [[0, 20]] }] } });
check("parsePose: the figure's own turn / move (no bone in the url) = fig, the hip's move = hips, bones as before", pp.fig.rot.x === -90 && pp.fig.move.join() === "0,15,0" && pp.hips.join() === "0,-5,0" && pp.pose.lShldr.z === 20 && pp.n === 1, pp);
const p2 = PR.parsePose({ scene: { animations: [{ url: "name://@selection/hip:?translation/y/value", keys: [[0, 0]] }, { url: "name://@selection:?rotation/y/value", keys: [[0, 0]] }] } });
check("parsePose: nothing moved -> fig null, hips null (a plain pose does not turn the figure)", p2.fig === null && p2.hips === null, p2);

// 🎨 material presets
const D = require(path.join(ROOT, "lib/dazLib.js"));
const pm = D.presetMaterials([{ url: "name://@selection#Irises:", diffuse: { channel: { image_file: "/Runtime/x.jpg" } } }, { url: "#materials/Lips:", groups: ["Lips"] }, { url: "" }, null], "/lib/a.duf");
check("presetMaterials: surface names from groups, else the url (#Irises: / #materials/Lips), its own file kept; empty ones dropped", pm.length === 2 && pm[0].groups.join() === "Irises" && pm[1].groups.join() === "Lips" && pm[0]._file === "/lib/a.duf", pm);
const lib = rd("lib/dazLib.js");
check("textureOf reads a preset's pictures from its own file; build(): a worn .duf with materials and no figure = a material preset painting every piece (not a silent nothing)", /fileOfUrl\(found, m\._file \|\| fromFile\)/.test(lib) && /matPresets\.push\(\.\.\.mp\)/.test(lib) && /p\.mats = matPresets\.concat/.test(lib) && /nothing in it to wear/.test(lib));

// the DAZ scene's pure parts
const DS = require(path.join(ROOT, "ext/pushpulldock/ppdazscene.js"));
check("pieceOf: a built piece from its node name '<name> (<kind>)'", JSON.stringify(DS.pieceOf("Genesis 9 Eyes (eyes)")) === '{"name":"Genesis 9 Eyes","kind":"eyes"}' && DS.pieceOf("Shirt (clothing)").kind === "clothing" && DS.pieceOf("hip") === null);
check("figOf / vec3: a pose's figure turn / move made safe", JSON.stringify(DS.figOf({ rot: { x: "-90" }, move: [0, "0.15", 0] })) === '{"rot":{"x":-90,"y":0,"z":0},"move":[0,0.15,0]}' && DS.vec3([1, "x", 2]).join() === "0,0,0" && DS.figOf(null).move.join() === "0,0,0");
const DT = require(path.join(ROOT, "ext/pushpulldock/ppdaztools.js"));
const cs = DT.cleanScene({ chars: [{ id: "a", name: "A", fig: { rel: "x.duf" }, hips: [0, -0.05, 0], figPose: { rot: { x: -90 }, move: [0, 0.15, 0] }, hidePieces: ["Shirt"], warn: ["w1"] }] }).chars[0];
check("cleanScene keeps the hips, the figure's pose, the hidden pieces and the build's warnings", cs.hips.join() === "0,-0.05,0" && cs.figPose.rot.x === -90 && cs.figPose.move[1] === 0.15 && cs.hidePieces.join() === "Shirt" && cs.warn.join() === "w1", cs);
const cs0 = DT.cleanScene({ chars: [{ id: "b", fig: { rel: "y.duf" } }] }).chars[0];
check("…an old character: no hips / figure move, nothing hidden", cs0.hips.join() === "0,0,0" && cs0.figPose.rot.x === 0 && !cs0.hidePieces.length);
check("🎨 Materials: a library tab and worn (painted on)", DT.KINDS.some((k) => k[0] === "material") && DT.WEAR.includes("material") && DT.PIECE_ICON.eyes === "👁" && DT.PIECE_ICON.graft === "🫀");
const dt = rd("ext/pushpulldock/ppdaztools.js");
check("Delete: H3DazTools.deleteSel (only a character picked in the view, DAZ Tools on) + ↶ undoDelete; a click past the characters un-picks", /function deleteSel\(\)/.test(dt) && /st\.on \|\| !id\) return false/.test(dt) && /function undoDelete/.test(dt) && /if \(!id\) \{ if \(S\.sel\(\)\) S\.select\("", true\); return; \}/.test(dt));
check("a worn item taken off (✕) rebuilds the model", /if \(c\.last && cur\(\) === c\) rebuildSoon\(c\);/.test(dt));
const tl = rd("ext/pushpulldock/pptools.js");
check("pptools Delete: the Sketcher's own pick and / or a picked DAZ character", /root\.H3DazTools\.deleteSel && root\.H3DazTools\.deleteSel\(\)/.test(tl));

// 🔍 Zoom + 🏛 Architecture
require(path.join(ROOT, "ext/pushpulldock/pptools.js"));
const z = globalThis.PPTools.TOOLS.find((t) => t[0] === "zoom");
check("🔍 Zoom in the toolbox (no key - Z is 📷 Camera), its hint", z && z[1] === "🔍" && z[3] === "" && /click zooms in/.test(globalThis.PPTools.HINT.zoom));
check("🔍 left drag = dolly (ppview leftDrag), a click = zoomAt ×1.5 at the pointer (Shift: out)", /mode === "zoom" \? T\.MOUSE\.DOLLY/.test(rd("ext/pushpulldock/ppview.js")) && /V\.zoomAt\(ev\.shiftKey \? 1 \/ 1\.5 : 1\.5/.test(tl));
const AR = require(path.join(ROOT, "ext/pushpulldock/pparchtoggle.js"));
check("🏛 hides the bar's 📐 Plan + storey, ⌂ Cut-away, 🧱 Wall types, 📄 Plans", AR.BAR.join() === "ppPlan,ppPlanLvl,ppCut,ppWTBtn,ppPlans" && AR.KEY === "h3.pparch.on");
check("ppdock marks the Build + Ground parts of the toolbox .pparch", (rd("ext/pushpulldock/ppdock.js").match(/"pparch"\)\); \}/g) || []).length === 2 && /pptsep pparch/.test(rd("ext/pushpulldock/ppdock.js")));
const ej = JSON.parse(rd("ext/pushpulldock/ext.json"));
check("ext.json loads pparchtoggle.js (after ppdocks.js)", ej.scripts.indexOf("pparchtoggle.js") === ej.scripts.indexOf("ppdocks.js") + 1);

// ✨ Photo
const RL = require(path.join(ROOT, "ext/pushpulldock/ppreal.js"));
const w = RL.sceneWords({}, [], { daz: 2 });
check("sceneWords: the DAZ characters shown = people; the lead keeps their pose, body, hair and clothes - not \"a building\"", w.parts.join() === "2 people" && !w.building && /photograph of 2 people\./.test(RL.leadFor(w)) && /same pose, body shape, hair and clothes/.test(RL.leadFor(w)), RL.leadFor(w));
check("…with a person of the model's own + one character: 2 people", RL.sceneWords({ items: [{ type: "person" }] }, [], { daz: 1 }).parts.join() === "2 people");
check("…no characters: the words as before", !/same pose/.test(RL.leadFor(RL.sceneWords({ rooms: [{ closed: true }] }, [], {}))));
const rl = rd("ext/pushpulldock/ppreal.js"), vw = rd("ext/pushpulldock/ppview.js");
check("a failed render says why (the missing models, else its log's error lines), not only \"see the job log\"", /async function whyFailed\(id, jj\)/.test(rl) && /log_from=0/.test(rl) && /throw new Error\("the render " \+ jj\.status \+ \(await whyFailed\(id, jj\)\)\)/.test(rl));
check("the edit models' list is asked again when the first answer was empty", /S\.engines && S\.engines\.edit && S\.engines\.edit\.length\) return S\.engines/.test(rl));
check("ppview: fitBox takes V.moreBoxes (the characters) - Zoom extents and the depth's near / far reach them", /for \(const f of V\.moreBoxes \|\| \[\]\)/.test(vw) && /v\.moreBoxes\.push\(box3\)/.test(rd("ext/pushpulldock/ppdazscene.js")));
check("ppview: a camera's depth shader is skinned + morphed (a posed character is drawn posed, not in its rest pose)", /#include <skinning_vertex>/.test(vw) && /#include <morphtarget_vertex>/.test(vw) && /#include <morphinstance_vertex>/.test(vw));
check("nothing added to server.js", !/pparchtoggle|deleteSel|presetMaterials/.test(rd("misc/server.js")));
console.log("\nRESULT: " + pass + " passed, " + fail + " failed");
process.exitCode = fail ? 1 : 0;
