/* bitGen Studio — FLOWHMR MOTION CAPTURE (2.730.0): a video of a person -> 3D motion in the project's models3d/.
 *
 * Tim (verbatim): "and one more for today https://flowhmr.github.io/ . we can add a reference video for motion?" + "add it
 * to addons with a disclaimer that it is for non commercial use only".
 * One job (mode "flowhmr", misc/flowhmr_worker.py) runs FlowHMR's own command (run_v2m_demo_generation.py) on one video in
 * its venv (Settings ▸ Add-ons ▸ FlowHMR, lib/flowhmrAddon.js) and files the motion as <video>_motion.fbx (+ .npz, SMPL-H)
 * in models3d/ - where the timeline's 3D layers, 🧊 and the Blender bridge read models. NON-COMMERCIAL USE ONLY (the SMPL-H
 * body model and Meta's SAM 3D Body / VGGT-Omega licences). The door: the preview bar's 🕺 Motion (static/flowhmrpanel.js).
 *   options: camera "moving" (VGGT-Omega every `every` frames: 1 = most exact, ~30 GB VRAM; 10 = lighter) | "still" (no
 *   camera estimate - the lightest); steps (the model's sampling steps, 20).
 * jobParams(file, o, extra) -> {params, note} | {error} */
"use strict";
const path = require("path");
const seedvr2 = require("./seedvr2");                  // resolve (a named video) + probe - the same as the upscalers'

const CAMERAS = ["moving", "still"];
const EVERY = [1, 5, 10];
const DEFAULTS = { camera: "moving", every: 10, steps: 20 };

function normalize(o) {
  const s = o && typeof o === "object" ? o : {};
  const every = parseInt(s.every, 10), steps = parseInt(s.steps, 10);
  return { camera: CAMERAS.includes(String(s.camera)) ? String(s.camera) : DEFAULTS.camera,
    every: EVERY.includes(every) ? every : DEFAULTS.every,
    steps: Number.isFinite(steps) ? Math.max(1, Math.min(100, steps)) : DEFAULTS.steps };
}
function jobParams(file, o, extra) {
  const s = normalize(o);
  if (!file) return { error: "name a video first" };
  const A = require("./flowhmrAddon");
  const miss = A.missing();
  if (miss.length) return { error: "FlowHMR is not ready - Settings ▸ Add-ons ▸ FlowHMR: " + miss.map((m) => m.what).join(", ") + " missing", missing: miss };
  const x = extra || {};
  const label = x.label || `FlowHMR 🕺 ${path.basename(file)}`;
  const params = { mode: "flowhmr", source: file, camera: s.camera, every: s.every, steps: s.steps, prompt: label, label,
    flowhmr: A.paths() };
  const note = `FlowHMR captures the motion of ${path.basename(file)} (${s.camera === "still" ? "still camera" : `moving camera, estimated every ${s.every} frame${s.every === 1 ? "" : "s"}`}, ${s.steps} steps) -> models3d/ (.fbx + .npz). ${A.NOTICE}`;
  return { params, note };
}
module.exports = { CAMERAS, EVERY, DEFAULTS, normalize, jobParams, resolve: seedvr2.resolve, probe: seedvr2.probe };
