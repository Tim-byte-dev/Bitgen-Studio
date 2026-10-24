// scripts/test-layer3d.js — the 3D layer, pure parts + wiring (2.460.0: ext/imageeditdock/pc3d.js, lib/layer3d.js,
// routes/layer3d.js, scripts/blend_layer3d.py). Blender itself: scripts/test-layer3d.py; the page: test-layer3d-ui.js.
"use strict";
const fs = require("fs"), path = require("path");
const P = require("../ext/imageeditdock/pc3d.js");
const L3 = require("../lib/layer3d.js");
let fail = 0;
const check = (name, ok, extra) => { console.log((ok ? "ok   " : "FAIL ") + name + (ok || extra === undefined ? "" : " " + JSON.stringify(extra))); if (!ok) fail++; };
const near = (a, b, e) => a.every((v, i) => Math.abs(v - b[i]) < (e || 1e-6));

const cam = { target: [0, 0, 1], dist: 6, yaw: -90, pitch: 0, fov: 45 };
check("orbitPos: yaw -90 = in front (-Y), 6 away, level", near(P.orbitPos(cam), [0, -6, 1]), P.orbitPos(cam));
check("...the server's sum is the same (lib/layer3d orbitFrom)", near(L3.orbitFrom(Object.assign({}, cam, { yaw: 33, pitch: 21 })), P.orbitPos(Object.assign({}, cam, { yaw: 33, pitch: 21 }))));
const B = P.basis(cam);
check("basis: looking along +Y, right = +X, up = +Z", near(B.f, [0, 1, 0]) && near(B.r, [1, 0, 0]) && near(B.u, [0, 0, 1]), B);
check("project: the target lands in the middle of the picture", near(P.project(cam, 640, 480, [0, 0, 1]), [320, 240]));
const pr = P.project(cam, 640, 480, [1, 0, 1]), f = 320 / Math.tan((22.5 * Math.PI) / 180);
check("...a point 1 to the right lands fpx/6 right of the middle (the fov across the longer side)", Math.abs(pr[0] - (320 + f / 6)) < 1e-6 && Math.abs(pr[1] - 240) < 1e-6, pr);
check("...a point above lands higher; one behind the camera = null", P.project(cam, 640, 480, [0, 0, 2])[1] < 240 && P.project(cam, 640, 480, [0, -9, 1]) === null);
const o = P.orbitDrag(cam, 100, -50, "orbit");
check("orbitDrag orbit: 100 px right turns 40° (yaw -130), 50 px up tilts -15°", Math.abs(o.yaw + 130) < 1e-9 && Math.abs(o.pitch + 15) < 1e-9 && o.dist === 6, o);
check("...the tilt stops at ±89", P.orbitDrag(cam, 0, 1000, "orbit").pitch === 89);
const pn = P.orbitDrag(cam, 100, 0, "pan", 480);
check("orbitDrag pan: dragging right moves the target LEFT (the picture follows the pointer)", pn.target[0] < 0 && Math.abs(pn.target[2] - 1) < 1e-9 && pn.yaw === -90, pn.target);
const z = P.orbitDrag(cam, 0, 50, "zoom");
check("orbitDrag zoom: down = further (6 · e^0.5)", Math.abs(z.dist - 6 * Math.exp(0.5)) < 1e-9);
check("VIEWS: front / back / left / right / top", JSON.stringify(P.VIEWS) === JSON.stringify({ front: [-90, 0], back: [90, 0], left: [180, 0], right: [0, 0], top: [-90, 89] }));
let pose = P.setBone({}, "Figure", "arm", [0, 0, 45]);
check("setBone: a turn kept", JSON.stringify(pose) === '{"Figure":{"arm":[0,0,45]}}');
pose = P.setBone(pose, "Figure", "arm", [0, 0, 0]);
check("...back to 0 = the bone and the empty figure dropped", JSON.stringify(pose) === "{}");
check("boxPoints: 8 corners round the centre", P.boxPoints([0, 0, 1], Math.sqrt(3)).length === 8 && near(P.boxPoints([0, 0, 1], Math.sqrt(3))[0], [-1, -1, 0]));

// the server's job cleaning
const j = L3.cleanJob({ cam: { target: [1, 2], dist: -5, yaw: 725, pitch: 120, fov: 500 }, pose: { Figure: { arm: [10, "x", 999], hip: [0, 0, 0] }, Bad: 5 }, w: 99999, h: 3, engine: "eevee", frame: "12" });
check("cleanJob: the camera made safe (target padded, distance > 0, yaw wrapped, tilt ±89.9, fov ≤ 170)", JSON.stringify(j.cam) === JSON.stringify({ target: [1, 2, 0], dist: 0.001, yaw: 5, pitch: 89.9, fov: 170 }), j.cam);
check("...the pose: numbers, ±360, zero bones / bad figures dropped", JSON.stringify(j.pose) === '{"Figure":{"arm":[10,0,360]}}', j.pose);
check("...the size 16 - 4096, the engine named (EEVEE), the frame a number", j.w === 4096 && j.h === 16 && j.engine === "EEVEE" && j.frame === 12);
check("...no camera = the scene's own; an unknown engine = Quick (WORKBENCH)", L3.cleanJob({}).cam === null && L3.cleanJob({ engine: "x" }).engine === "WORKBENCH" && L3.cleanJob({}).frame === null);
check("sizeFor: a quick view's long side 640", JSON.stringify(L3.sizeFor(1920, 1080, 640)) === "[640,360]" && JSON.stringify(L3.sizeFor(300, 200, 640)) === "[300,200]");

// wiring
const rd = (...f) => fs.readFileSync(path.join(__dirname, "..", ...f), "utf8");
const ext = JSON.parse(rd("ext", "imageeditdock", "ext.json")).scripts, IE = rd("ext", "imageeditdock", "imageedit.js"), DOC = rd("ext", "imageeditdock", "pcdoc.js"), RI = rd("routes", "index.js"), SV = rd("misc/server.js"), PY = rd("scripts", "blend_layer3d.py");
check("wiring: pc3d.js after pcdimauto.js, before pchandles.js; installed before PCHandles (its drag wins)", ext.indexOf("pc3d.js") === ext.indexOf("pcdimauto.js") + 1 && ext.indexOf("pchandles.js") === ext.indexOf("pc3d.js") + 5 && IE.indexOf("PC3D.install(E)") < IE.indexOf("PCHandles.install(E)") && IE.indexOf("PC3D.install(E)") > IE.indexOf("PCDimAuto.install(E)"));
check("...undo keeps L.l3d (pcdoc DEEP)", /"dimPart", "l3d"[\],]/.test(DOC));
check("...routes/layer3d.js mounted from routes/index.js (not server.js)", /require\("\.\/layer3d"\)\.mount\(app\)/.test(RI) && !/layer3d/.test(SV));
check("...the Blender script: inspect / serve / render, the pose reset per job, the orbit camera = pc3d's sum", /def serve\(src\)/.test(PY) && /def inspect\(src, out\)/.test(PY) && /back to the file's own pose first/.test(PY) && /math\.cos\(pitch\) \* math\.cos\(yaw\), math\.cos\(pitch\) \* math\.sin\(yaw\), math\.sin\(pitch\)/.test(PY));
const R = require("../routes/layer3d.js"), seen = [];
R.mount({ get: (p) => seen.push("GET " + p), post: (p) => seen.push("POST " + p) });
check("routes: sources, list, open, get, render, render status, png, close", ["GET /api/layer3d/sources", "GET /api/layer3d", "POST /api/layer3d/open", "GET /api/layer3d/:id", "POST /api/layer3d/:id/render", "GET /api/layer3d/render/:rid", "GET /api/layer3d/:id/png", "POST /api/layer3d/:id/close"].every((x) => seen.includes(x)), seen);

console.log(fail ? `\n${fail} FAILED` : "\nall 3D layer checks passed");
process.exit(fail ? 1 : 0);
