// bitGen Studio — BASIC SETTINGS -> FACE FIX (2.322.0).
//
// Tim: "is there any way to get the persons face to look 'not distorted'" ->
// "please add the 2 reccommendations": (1) a Pose "face points" switch in
// the ControlNet section (lib/cnBasics pose_face), (2) a FACE FIX pass -
// ComfyUI-Impact-Pack's FaceDetailer with an Ultralytics face detector
// re-renders each face of the FINAL image (scripts/face_fix.py). It works on
// a plain image render (the style's model) and on a ControlNet render (the
// second model's final only - the first picture is just a control source).
//
// One record per project, projects/<p>/face_fix.json:
//   enabled   the Face fix checkbox
//   denoise   how much each face is re-drawn (0.05..1, default 0.4)
//   detector  an Ultralytics bbox model from ComfyUI models/ultralytics
//             ("" = bbox/face_yolov8m.pt)
"use strict";
const fs = require("fs");
const path = require("path");

const FILE = "face_fix.json";
const DEFAULT_DETECTOR = "bbox/face_yolov8m.pt";
const DEFAULTS = Object.freeze({ enabled: false, denoise: 0.4, detector: "" });

function normalize(b, old) {
  const src = { ...DEFAULTS, ...(old || {}), ...(b || {}) };
  const out = { ...DEFAULTS };
  out.enabled = src.enabled === true;
  const d = Number(src.denoise);
  out.denoise = Number.isFinite(d) ? Math.max(0.05, Math.min(1, Math.round(d * 100) / 100)) : 0.4;
  const det = String(src.detector == null ? "" : src.detector).trim();
  out.detector = det && !det.includes("..") ? det.slice(0, 300) : "";
  return out;
}

function fileFor(projDir) { return path.join(projDir, FILE); }

function read(projDir) {
  try { return normalize(JSON.parse(fs.readFileSync(fileFor(projDir), "utf8"))); }
  catch { return normalize({}); }
}

function save(projDir, patch) {
  const n = normalize(patch, read(projDir));
  fs.mkdirSync(projDir, { recursive: true });
  fs.writeFileSync(fileFor(projDir), JSON.stringify(n, null, 2));
  return n;
}

/** What an image job carries: null (off) or {denoise, detector}. */
function jobSpec(rec) {
  const r = normalize(rec);
  if (!r.enabled) return null;
  return { denoise: r.denoise, detector: r.detector || DEFAULT_DETECTOR };
}

module.exports = { FILE, DEFAULT_DETECTOR, DEFAULTS, normalize, read, save, fileFor, jobSpec };
