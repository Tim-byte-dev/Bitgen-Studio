#!/usr/bin/env node
/* bitGen Studio — 2.476.0 units: UNREAL LIGHTS, VOLUMETRIC LIGHTS AND FOG (static/uerig.js, pcuelights.js pure parts,
 * lib/unreal.js cleanRig, the plugin's rig, the wiring).
 * Tim (verbatim): "allow user to add unreal lights to the scene, volumetric lights, volumetric fog etc. in bitgen image
 * editor and timeline. it would be good to be able to do it all in one app - bitgen studio." */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
let pass = 0, fail = 0;
const check = (n, ok, got) => { if (ok) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got))); } };
const near = (a, b, e) => Math.abs(a - b) <= (e == null ? 1e-6 : e);
const R = require(path.join(ROOT, "static", "uerig.js"));
globalThis.UERig = R; globalThis.UEBridge = require(path.join(ROOT, "static", "unreal.js")); globalThis.PCUECam = require(path.join(ROOT, "ext", "imageeditdock", "pcuecam.js"));
const PL = require(path.join(ROOT, "ext", "imageeditdock", "pcuelights.js"));
const cam = { loc: [-600, 0, 170], rot: [0, -5, 20], fov: 40 };
const w = R.unproject(cam, 16 / 9, 0.3, 0.7, 450), pr = R.project(cam, 16 / 9, w);
check("project / unproject: a point of the picture at a depth and back (u 0.3, v 0.7, 450 cm)", near(pr.u, 0.3, 1e-3) && near(pr.v, 0.7, 1e-3) && near(pr.z, 450, 0.2), pr);
check("project: the picture's middle straight ahead; behind the camera = no place on the picture", near(R.project({ loc: [0, 0, 0], rot: [0, 0, 0], fov: 90 }, 1, [100, 0, 0]).u, 0.5) && near(R.project({ loc: [0, 0, 0], rot: [0, 0, 0], fov: 90 }, 1, [100, 100, 0]).u, 1) && !(R.project(cam, 1.7, [-900, 0, 170]).z > 0));
const am = R.aim([0, 0, 0], [100, 100, 100]);
check("aim: yaw 45°, pitch 35.3° up toward (100, 100, 100)", near(am[2], 45, 0.05) && near(am[1], 35.3, 0.05));
const l = R.newLight("spot", cam, { name: "Key", intensity: 80, temperature: 5600 }), lp = R.project(cam, 16 / 9, l.loc), subj = R.unproject(cam, 16 / 9, 0.5, 0.5, 300);
const B = R.basis(l.rot), toS = [subj[0] - l.loc[0], subj[1] - l.loc[1], subj[2] - l.loc[2]], d = Math.hypot(...toS);
check("newLight: in front of the camera, up and to the left, aimed at the subject (3 m ahead)", lp.z > 0 && lp.u < 0.5 && lp.v < 0.5 && near((B.f[0] * toS[0] + B.f[1] * toS[1] + B.f[2] * toS[2]) / d, 1, 1e-3) && l.intensity === 80 && l.temperature === 5600, { lp, l });
const P = R.applyPreset("neon", cam), G = R.applyPreset("golden", cam);
check("presets: Neon = two rect lights (magenta, cyan) + volumetric fog; Golden hour = a low warm sun + a sky light; every preset makes lights", P.lights.length === 2 && P.lights.every((x) => x.type === "rect") && P.fog.volumetric === true
  && G.lights.some((x) => x.type === "directional" && x.temperature === 3200 && x.rot[1] === -8) && G.lights.some((x) => x.type === "sky") && Object.keys(R.LIGHT_PRESETS).every((k) => R.applyPreset(k, cam).lights.length > 0));
const n = R.norm({ lights: [{ type: "laser", color: "red", intensity: -5, outer: 200, loc: [1, "x"] }, ...new Array(40).fill({ type: "point" })], fog: { on: 1, density: 99, color: "#ABCDEF" } });
check("norm: an unknown type = point, colours #rrggbb, numbers kept in range, at most 32 lights; the fog's too", n.lights.length === 32 && n.lights[0].type === "point" && n.lights[0].color === "#ffffff" && n.lights[0].intensity === 0 && n.lights[0].outer === 89 && n.lights[0].loc.join() === "0,0,200" && n.fog.on === true && n.fog.density === 10 && n.fog.color === "#abcdef");
check("empty: no lights on and no fog = nothing to send", R.empty({ lights: [{ on: false }], fog: { on: false } }) && !R.empty({ lights: [], fog: { on: true } }) && R.empty(null));
const u = { kind: "scene", camera: cam, rig: { lights: [l, R.newLight("sky", cam), Object.assign(R.newLight("point", cam), { loc: [-900, 0, 170] })] } };
const mk = PL.markers(u, 16 / 9);
check("pcuelights markers: the lights in front of the camera (not the sky light, not one behind), a spot with where it points", mk.length === 1 && mk[0].id === l.id && mk[0].to && mk[0].to.u > mk[0].u, mk);
const L = require(path.join(ROOT, "lib", "unreal.js"));
check("lib cleanRig: the same rules (static/uerig.js); nothing = null; stills and renders carry it", L.cleanRig({ lights: [] }) === null && L.cleanRig({ lights: [{ type: "spot", intensity: 9e9 }] }).lights[0].intensity === 1e6
  && L.cleanStill({ rig: { fog: { on: true } } }).rig.fog.on === true && L.cleanRender({ sequence: "/Game/S", rig: { lights: [{ type: "rect" }] } }).rig.lights[0].type === "rect");
const PY = read("ue", "bitGenBridge", "Content", "Python", "bitgen_bridge.py"), UP = JSON.parse(read("ue", "bitGenBridge", "bitGenBridge.uplugin"));
check("the plugin (1.2.0 or newer): point / spot / rect / directional / sky lights (movable, candelas, colour or temperature, reach, soft size, cone, size, volumetric scattering, shadows) + ExponentialHeightFog with volumetric fog; named bitGen_*, cleared before the next picture, removed after it unless kept; the capture shows fog + volumetric fog",
  require(path.join(ROOT, "lib", "ueProject.js")).newer(UP.VersionName, "1.1.9") && /LIGHT_CLASSES = \{"point": "PointLight", "spot": "SpotLight", "rect": "RectLight", "directional": "DirectionalLight", "sky": "SkyLight"\}/.test(PY) && /volumetric_scattering_intensity/.test(PY)
  && /unreal\.ExponentialHeightFog/.test(PY) && /"volumetric_fog", bool/.test(PY) && /volumetric_fog_extinction_scale/.test(PY) && /bitGen_light_/.test(PY) && /def _clear_rig/.test(PY) && /show_flag_name=nm/.test(PY) && /placed = _apply_rig\(a\.get\("rig"\)\)/.test(PY));
const PU = read("ext", "imageeditdock", "pcunreal.js"), PC = read("ext", "imageeditdock", "pcuelights.js"), TL = read("ext", "timelinedock", "tlunreal.js"), EXT = JSON.parse(read("ext", "imageeditdock", "ext.json")).scripts, IE = read("ext", "imageeditdock", "imageedit.js"), IDX = read("static", "index.html");
check("wiring: stills send u.rig; the UNREAL tab's Lights + Lights & Fog; pcuelights after pcuecam (installed after PCUECam); the 💡 Lights tab (kuelights), the light tool, Window ▸ Unreal Lights; static/uerig.js after unreal.js; the timeline's Lights & Fog… + renderRequest's rig",
  /if \(u\.rig\) o\.rig = u\.rig;/.test(PU) && /id: "u_lights"/.test(PU) && /id: "u_fog"/.test(PU) && EXT.indexOf("pcuelights.js") === EXT.indexOf("pcuecam.js") + 1 && IE.indexOf("PCUELights.install(E)") > IE.indexOf("PCUECam.install(E)")
  && /dataset\.tab = "kuelights"/.test(PC) && /E\.tools\.uelight = \{/.test(PC) && /"win\.uelights", "Unreal Lights"/.test(PC) && IDX.indexOf('src="/static/uerig.js"') > IDX.indexOf('src="/static/unreal.js"') && /function lightsDialog\(\)/.test(TL) && /if \(ue\.rig\) o\.rig = ue\.rig;/.test(TL));
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
