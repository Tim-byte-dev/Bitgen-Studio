// scripts/test-blendpose.js — 2.461.0: poses in the timeline's .blend preview + the hand-overs (ext/timelinedock/blendpose.js,
// lib/blendView.js clean, scripts/blend_scene.py + blend_pose.py), the Daz live link's page side (pc3d.js dazView). Pure + wiring.
// The browser: test-blendpose-ui.js; Blender: test-layer3d.py; the Daz script: test-dazlive.js.
"use strict";
const fs = require("fs"), path = require("path");
const BP = require("../ext/timelinedock/blendpose.js");
const P3 = require("../ext/imageeditdock/pc3d.js");
const DL = require("../lib/dazLive.js");
let fail = 0;
const check = (name, ok, extra) => { console.log((ok ? "ok   " : "FAIL ") + name + (ok || extra === undefined ? "" : " " + JSON.stringify(extra))); if (!ok) fail++; };
const near = (a, b, e) => a.every((v, i) => Math.abs(v - b[i]) < (e || 1e-6));
const rd = (...f) => fs.readFileSync(path.join(__dirname, "..", ...f), "utf8");

check("setBone: a turn kept, zero dropped", JSON.stringify(BP.setBone({}, "F", "arm", [0, 0, 60])) === '{"F":{"arm":[0,0,60]}}' && JSON.stringify(BP.setBone({ F: { arm: [0, 0, 60] } }, "F", "arm", [0, 0, 0])) === "{}");
// a three.js camera at glTF (0, 1.2, 6) looking at (0, 1.2, 0) = Blender (0, -6, 1.2) -> (0, 0, 1.2): yaw -90, level, 6 away
const v = BP.blenderView([0, 1.2, 6], [0, 1.2, 0], 45, 1);
check("blenderView: glTF (Y up) -> Blender (Z up): in front (yaw -90), level, 6 away; a square picture keeps the fov", near(v.target, [0, 0, 1.2]) && Math.abs(v.yaw + 90) < 1e-9 && Math.abs(v.pitch) < 1e-9 && Math.abs(v.dist - 6) < 1e-9 && Math.abs(v.fov - 45) < 1e-9, v);
const v2 = BP.blenderView([3, 4, 5], [1, 0.5, -2], 40, 16 / 9);
check("...the orbit puts the camera back where three.js had it (pc3d orbitPos)", near(P3.orbitPos(v2), [3, -5, 4]), P3.orbitPos(v2));
check("...a wide picture: the fov across its long side (Blender's AUTO fit)", Math.abs(v2.fov - 2 * Math.atan(Math.tan((20 * Math.PI) / 180) * 16 / 9) * 180 / Math.PI) < 1e-9);
const dz = P3.dazView({ target: [0, 0, 1.2], dist: 6, yaw: -90, pitch: 0, fov: 45 });
check("pc3d dazView: the 3D layer's view in Daz (cm, Y up) = lib/dazLive toDaz of its place", near(dz.pos, DL.toDaz([0, -6, 1.2])) && near(dz.pos, [0, 120, 600]) && near(dz.target, [0, 120, 0]) && dz.fov === 45, dz);

// wiring
const EXT = JSON.parse(rd("ext", "timelinedock", "ext.json")).scripts, BV = rd("ext", "timelinedock", "blendview.js"), LBV = rd("lib", "blendView.js"), SC = rd("scripts", "blend_scene.py"), L3 = rd("scripts", "blend_layer3d.py"), PO = rd("scripts", "blend_pose.py");
check("wiring: blendpose.js right after blendview.js; blendview calls it after a frame is drawn and after the Properties are painted, and exports what it needs", EXT.indexOf("blendpose.js") === EXT.indexOf("blendview.js") + 1
  && /window\.TlBlendPose\.apply\(\)/.test(BV) && /window\.TlBlendPose\.props\(PR\)/.test(BV) && /persist: persist, pushUndo: pushUndo, drawFrame: drawFrame, msg: msg, paint: paint/.test(BV));
check("...lib/blendView clean keeps the pose (checked like the 3D layer's)", /require\("\.\/layer3d"\)\.cleanJob\(\{ pose: edits\.pose \}\)\.pose/.test(LBV));
check("...blend_scene: the meta lists the armatures, save / render apply the pose over the frames (blend_pose)", /"armatures": blend_pose\.armatures\(\)/.test(SC) && /pose_edits\(edits, range\(start, end \+ 1\)\)/.test(SC) && /pose_edits\(edits, range\(sc\.frame_start, sc\.frame_end \+ 1\)\)/.test(SC));
check("...blend_layer3d shares it (mute = one still frame)", /blend_pose\.apply\(pose, \[frame\], mute=True\)/.test(L3) && /def apply\(pose, frames=None, mute=False\)/.test(PO) && /MUTED\.pop\(\)\.mute = False/.test(PO));
const DZ = rd("routes", "daz.js"), DSA = rd("daz", "bitgen_bridge", "bitGen Live Link.dsa");
check("the Daz live link: routes in routes/daz.js (status, cmd, poll), the Daz script (DAZ Script, experimental, polls /api/daz/live/poll, the bitGen Camera, bones on top of their own values)",
  /app\.get\("\/api\/daz\/live"/.test(DZ) && /\/api\/daz\/live\/cmd/.test(DZ) && /\/api\/daz\/live\/poll/.test(DZ) && /^\/\/ DAZ Script/.test(DSA) && /EXPERIMENTAL/.test(DSA)
  && /\/api\/daz\/live\/poll/.test(DSA) && /"bitGen Camera"/.test(DSA) && /BASE\[k\]\.v\[i\] \+/.test(DSA) && fs.existsSync(path.join(__dirname, "..", "daz", "bitgen_bridge", "bitGen Live Link.png")));
const LV = rd("lib", "layer3d.js"), README = rd("daz", "bitgen_bridge", "README.txt");
check("...the bridge README tells about the live link (1.1.0)", /bitGen Live Link/.test(README) && /1\.1\.0/.test(README));
void LV;

console.log(fail ? `\n${fail} FAILED` : "\nall timeline pose / hand-over checks passed");
process.exit(fail ? 1 : 0);
