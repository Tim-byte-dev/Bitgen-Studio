#!/usr/bin/env node
/* bitGen Studio — 2.618.0 (pure + wiring): A BRIDGE LAYER DELETED OR HIDDEN = ITS BRIDGE CLOSED, ITS SCENE NOT SHOWN.
 * Tim: "when the blender or unreal or daz layer is deleted or made "hidden" or deleted then close the bridge and don't show
 * the scene in image editor or timeline".
 *   ext/imageeditdock/pcbridgeoff.js keysOf / dropped; the wiring in pcblendlayer (leave drop, reopen from the layer's
 *   .blend), blendview (TlBlend.close), uelive (clear), pcuelive / tluelive (hidden / deleted), dazLive (clear) */
"use strict";
const fs = require("fs");
const path = require("path");
const R = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const read = (p) => fs.readFileSync(path.join(R, p), "utf8");
const B = require(path.join(R, "ext", "imageeditdock", "pcbridgeoff.js"));
const D = require(path.join(R, "ext", "imageeditdock", "pcdoc.js"));
const g = { id: 1, visible: false, parent: null }, a = { id: 2, visible: true, parent: 1, bscene: { stem: "car" } }, b = { id: 3, visible: true, parent: null, bscene: { stem: "room" } },
  c = { id: 4, visible: true, parent: null, l3d: { id: "s1" } }, d = { id: 5, visible: false, parent: null, l3d: { id: "s2" } }, e = { id: 6, visible: true, parent: null, bscene: { stem: "car" } };
const layers = [g, a, b, c, d];
const k = B.keysOf(layers, (L) => D.shown(layers, L));
check("keysOf: the scenes of the SHOWN layers - a Blender layer in a hidden group and a hidden 3D layer do not count", JSON.stringify([...k.blend]) === '["room"]' && JSON.stringify([...k.l3d]) === '["s1"]', { b: [...k.blend], l: [...k.l3d] });
const k2 = B.keysOf(layers.concat([e]), (L) => D.shown(layers.concat([e]), L));
check("…a scene still shown by ANOTHER layer stays open (two Blender layers of one scene, one hidden)", k2.blend.has("car"));
check("dropped: what was shown before and is not now", JSON.stringify(B.dropped(new Set(["room", "car"]), new Set(["car"]))) === '["room"]' && B.dropped(new Set(["x"]), new Set(["x"])).length === 0 && B.dropped(null, new Set()).length === 0);
const L = require(path.join(R, "lib", "dazLive.js"));
L._reset && L._reset(); L.push({ type: "reset" }); L.push({ type: "reset" });
check("dazLive.clear(): the commands still waiting for Daz dropped", L.clear() >= 1 && L.status().queued === 0);

const BO = read("ext/imageeditdock/pcbridgeoff.js"), BL = read("ext/imageeditdock/pcblendlayer.js"), BV = read("ext/timelinedock/blendview.js"), UL = read("static/uelive.js"),
  PU = read("ext/imageeditdock/pcuelive.js"), TU = read("ext/timelinedock/tluelive.js"), RD = read("routes/daz.js"), IE = read("ext/imageeditdock/imageedit.js");
check("image editor: the scene tools on a layer that is gone / hidden close WITHOUT keeping a view (no new layer); a scene no shown layer holds closes (TlBlend.close); a 3D scene's Blender ends + Daz's queue drops",
  /BL\.leave\(false, false, true\)/.test(BO) && /TB\.close\(stem\)/.test(BO) && /\/api\/layer3d\/" \+ encodeURIComponent\(id\) \+ "\/close"/.test(BO) && /\/api\/daz\/live\/clear/.test(BO)
  && /if \(drop\) \{ target = null;/.test(BL) && /target: \(\) => target/.test(BL) && /else if \(target && target\.bscene && target\.bscene\.source\) return tb\.open\(target\.bscene\.source\)/.test(BL));
check("TlBlend.close(stem): off the screen (the timeline's overlay, a borrower's tools), the scene unloaded, POST /api/blendview/close",
  /function closeScene\(stem\)/.test(BV) && /if \(ext\) detach\(\); else if \(S\.on\) show\(false\);/.test(BV) && /fetch\("\/api\/blendview\/close", \{ method: "POST" \}\)/.test(BV) && /close: closeScene/.test(BV));
check("📺 Unreal View: clear() (stopped + the picture gone); the editor's: a hidden layer asks nothing, its layer hidden / deleted = closed + the tab hidden; the timeline's: a clip not on a layer or on a hidden one = closed + the window hidden",
  /clear\(why\) \{ running = false;/.test(UL) && /const shownL = \(L\) =>/.test(PU) && /V\.clear\(E\.S\.layers\.includes\(ueL\)/.test(PU) && /function live\(s\)/.test(TU) && /V\.clear\(C\.layerOf && C\.layerOf\(shownC\)/.test(TU) && /box\.show\(false\); revealed = false; shownC = null;/.test(TU));
check("routes/daz.js: POST /api/daz/live/clear; the editor loads pcbridgeoff.js (after pccoldock.js) and installs it", /app\.post\("\/api\/daz\/live\/clear"/.test(RD) && /PCBridgeOff\.install\(E\)/.test(IE)
  && (() => { const s = JSON.parse(read("ext/imageeditdock/ext.json")).scripts; return s.indexOf("pcbridgeoff.js") === s.indexOf("pccoldock.js") + 1; })());
check("server.js untouched by this release", !/bridgeoff|live\/clear/.test(read("misc/server.js")));
console.log(`\n${pass} passed, ${fail} failed`);
console.log("RESULT: " + fail + " failed");
process.exit(fail ? 1 : 0);
