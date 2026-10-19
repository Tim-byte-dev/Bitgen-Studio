#!/usr/bin/env node
/* bitGen Studio — 2.475.0 units: THE UNREAL CAMERA (static/unreal.js camera maths, ext/imageeditdock/pcuecam.js pure
 * parts, lib/unreal.js cleanLens, the plugin's lens / viewport / focus commands, the wiring).
 * Tim (verbatim): "add the unreal camera to image editor allow user to move the camera in the scene to change camera
 * angles, roll, pitch and yaw. add a properties docker for the unreal camera, lens, f-stop, exposure, fov and camera presets" */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
let pass = 0, fail = 0;
const check = (n, ok, got) => { if (ok) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got))); } };
const near = (a, b, e) => Math.abs(a - b) <= (e == null ? 1e-6 : e);
const U = require(path.join(ROOT, "static", "unreal.js"));
global.window = undefined; globalThis.UEBridge = U;
const C = require(path.join(ROOT, "ext", "imageeditdock", "pcuecam.js"));
check("fovOf / focalOf: 36 mm on full frame = 53.13°; 90° = 18 mm; they undo each other", near(U.fovOf(36, 36), 53.1301, 1e-3) && near(U.focalOf(90, 36), 18, 1e-9) && near(U.focalOf(U.fovOf(85, 24.89), 24.89), 85, 1e-9));
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], len = (a) => Math.sqrt(dot(a, a));
const B = U.basis([12, -20, 75]);
check("basis: forward / right / up are unit length and at right angles (any roll / pitch / yaw); yaw 90 looks along +Y", [B.f, B.r, B.u].every((v) => near(len(v), 1, 1e-9)) && near(dot(B.f, B.r), 0, 1e-9) && near(dot(B.f, B.u), 0, 1e-9) && near(dot(B.r, B.u), 0, 1e-9) && near(U.basis([0, 0, 90]).f[1], 1, 1e-9));
const cam = { loc: [-600, 0, 170], rot: [0, -5, 0], fov: 40 }, pivot = (c, d) => [0, 1, 2].map((k) => c.loc[k] + U.basis(c.rot).f[k] * d);
const o = U.moveCam(cam, "orbit", 100, 20, 500), P0 = pivot(cam, 500), P1 = pivot(o, 500);
check("moveCam orbit: yaw + 0.3°/px, pitch - 0.3°/px, the camera stays 500 cm from the same pivot", near(o.rot[2], 30) && near(o.rot[1], -11) && [0, 1, 2].every((k) => near(P0[k], P1[k], 0.02)), { o, P0, P1 });
const lk = U.moveCam(cam, "look", 100, 0, 500), pn = U.moveCam(cam, "pan", 50, 0, 500), dl = U.moveCam(cam, "dolly", 0, -100, 500), rl = U.moveCam(cam, "roll", 30, 0, 500);
check("look turns in place; pan slides (the turn kept); dolly moves along the view; roll tilts the horizon", lk.loc.join() === cam.loc.join() && near(lk.rot[2], 15) && pn.rot.join() === cam.rot.join() && pn.loc[1] !== 0
  && near(Math.hypot(dl.loc[0] - cam.loc[0], dl.loc[2] - cam.loc[2]), 200, 0.05) && dl.loc[0] > cam.loc[0] && near(rl.rot[0], 9), { lk, pn, dl, rl });
check("moveCam: pitch kept within ±89°, yaw wrapped to ±180°", U.moveCam(cam, "orbit", 0, -1000, 500).rot[1] === 89 && U.moveCam({ loc: [0, 0, 0], rot: [0, 0, 170], fov: 60 }, "look", 200, 0, 500).rot[2] === -160);
check("lens presets (18 - 200 mm, macro, anamorphic), filmbacks (full frame … phone), f-stops f/1.2 - f/22", U.LENSES.length >= 9 && U.LENSES.some((x) => x[2].focal === 85 && x[2].fstop === 1.8) && U.FILMBACKS[0][2] === 36 && U.FSTOPS[0] === 1.2 && U.FSTOPS[U.FSTOPS.length - 1] === 22);
// pcuecam pure
const u = { kind: "scene", camera: { name: "CineCam_Wide" }, lastCamera: { loc: [1, 2, 3], rot: [0, 0, 10], fov: 40 }, w: 320, h: 180 };
check("camOf: a named camera moves from where Unreal said it was; lensOf: the focal length from its field of view (40° = 49.5 mm)", C.camOf(u).loc.join() === "1,2,3" && near(C.lensOf(u).focal, 49.5, 0.05) && C.lensOf(u).sensor === 36);
const v = C.withLens(u, { focal: 85 }), w = C.withLens(u, { fov: 60, sensor: 24.89 });
check("withLens: the camera's field of view follows the focal length / the filmback; a field of view sets the focal length", v.lens.focal === 85 && near(v.camera.fov, 23.91, 0.01) && v.camera.loc.join() === "1,2,3" && near(w.lens.focal, 21.6, 0.06) && near(w.camera.fov, 60, 0.15) && u.lens === undefined, { v, w });
const mh = C.camOf({ kind: "metahuman", preset: "face", turn: 0 });
check("camOf (MetaHuman): from its framing until it is moved", mh.loc.join() === "70,0,165" && mh.rot[2] === 180);
// the server
const L = require(path.join(ROOT, "lib", "unreal.js"));
check("cleanLens: in range (focal 4 - 1200 mm, f/0.7 - 32, exposure ±15 EV), junk dropped, nothing = null", JSON.stringify(L.cleanLens({ focal: 5000, fstop: 0.1, exposure: "2", focus: "x", sensor: 36 })) === JSON.stringify({ focal: 1200, sensor: 36, fstop: 0.7, exposure: 2 }) && L.cleanLens({}) === null && L.cleanLens(null) === null);
check("stills and renders carry the lens", L.cleanStill({ lens: { focal: 85, fstop: 1.8 } }).lens.focal === 85 && L.cleanRender({ sequence: "/Game/S", lens: { exposure: -1 } }).lens.exposure === -1);
const PY = read("ue", "bitGenBridge", "Content", "Python", "bitgen_bridge.py"), UP = JSON.parse(read("ue", "bitGenBridge", "bitGenBridge.uplugin"));
check("the plugin (1.1.0 or newer): the lens on a Scene Capture (exposure bias, depth of field f-stop / focal distance / sensor, the DepthOfField show flag) and on the sequence's CineCamera; set_viewport; focus_at (a line trace through the clicked point, the distance to the focal plane)",
  require(path.join(ROOT, "lib", "ueProject.js")).newer(UP.VersionName, "1.0.9") && /override_" \+ name/.test(PY) && /auto_exposure_bias/.test(PY) && /depth_of_field_fstop/.test(PY) && /show_flag_name="DepthOfField"/.test(PY) && /current_aperture/.test(PY) && /manual_focus_distance/.test(PY)
  && /"set_viewport": cmd_set_viewport/.test(PY) && /"focus_at": cmd_focus_at/.test(PY) && /line_trace_single/.test(PY) && /float\(dist\) \/ max\(1e-6, float\(d\.length\(\)\)\)/.test(PY));
const RU = read("routes", "unreal.js"), PC = read("ext", "imageeditdock", "pcuecam.js"), EXT = JSON.parse(read("ext", "imageeditdock", "ext.json")).scripts, IE = read("ext", "imageeditdock", "imageedit.js"), TL = read("ext", "timelinedock", "tlunreal.js"), PU = read("ext", "imageeditdock", "pcunreal.js");
check("wiring: POST /api/unreal/viewport + /focus; pcuecam.js after pcunreal.js, installed after PCUnreal; the tool, the 🎥 Camera tab (kuecam), Window ▸ Unreal Camera; the UNREAL tab's Camera + Lens & Exposure; the timeline's lens in Keys…",
  /app\.post\("\/api\/unreal\/viewport"/.test(RU) && /app\.post\("\/api\/unreal\/focus"/.test(RU) && EXT.indexOf("pcuecam.js") === EXT.indexOf("pcunreal.js") + 1 && IE.indexOf("PCUECam.install(E)") > IE.indexOf("PCUnreal.install(E)")
  && /E\.tools\.uecam = \{/.test(PC) && /dataset\.tab = "kuecam"/.test(PC) && /"win\.uecam", "Unreal Camera"/.test(PC) && /id: "u_cam"/.test(PU) && /id: "u_props"/.test(PU) && /id="tuLf"/.test(TL) && /if \(ue\.lens\) o\.lens = ue\.lens;/.test(TL));
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
