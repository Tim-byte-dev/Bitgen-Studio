// bitGen Studio — lib/camPlan.js (2.399.0): WHAT EACH VIDEO MODEL IS TOLD ABOUT THE TIMELINE'S CAMERA PATH.
//
// Tim: "can we add camera movement to follow a 3d path, pan,roll and dolly, height and angle to the tools in timeline
// docker. will we be able to tell mmh3 , wan and ltx to follow these paths and camera movement" - he chose "Also an
// exact-path guide". None of the three takes a free 3D camera path, so each gets what it CAN follow:
//
//   MiniMax H3  its own camera sentence (ONE move a shot - the main move of the path, with H3's amplitude / speed words)
//               + exact: the guide video (the picture along the path) rides as a reference video (<Video n>) in a
//               References render, "follow the camera movement of <Video n>" - EXPERIMENTAL (H3 reads a reference
//               video's motion; nothing guarantees it copies the camera only). A First / Last render takes no video:
//               words only, said.
//   Wan         the path in prose + the Fun Camera model's move (WanCameraEmbedding) when ComfyUI has a Fun Camera
//               model; exact: the DEPTH guide as VACE's control video (the first picture as its reference) when it
//               has a VACE model - wan_worker.py decides from what ComfyUI lists
//   LTX         the path in prose + the LTX-2 camera-control LoRA for the main move when it is in ComfyUI's loras;
//               exact: the DEPTH guide through the canvas's style-transfer mode (v2v: the union-control IC-LoRA reads
//               it as depth, the picture is the first frame) - ltx_worker.py
// The request's `camera` field: {cam (static/campath.js), guide: {rgb, depth} (names from lib/camGuide)}; it applies
// only with cam.use on.
"use strict";
const path = require("path");
const CP = require("../static/campath.js");
const guide = require("./camGuide");

/** the request field -> null (no camera / not in use) | {cam, exact, rgb, depth, rgbName, depthName} */
function parse(raw) {
  let j = raw;
  if (typeof raw === "string") { try { j = JSON.parse(raw || "null"); } catch { return null; } }
  if (!j || typeof j !== "object") return null;
  const cam = CP.norm(j.cam || j);
  if (!cam.use) return null;
  const g = j.guide && typeof j.guide === "object" ? j.guide : {};
  const rgb = guide.resolve(g.rgb), depth = guide.resolve(g.depth);
  return { cam, exact: !!cam.exact, rgb, depth, rgbName: rgb ? path.basename(rgb) : "", depthName: depth ? path.basename(depth) : "" };
}

const join = (text, more) => (String(text || "").trim() + (more ? "\n\n" + more : "")).trim();

/** MiniMax H3. o = {mode, refVideos: [names], seconds} -> {text, addVideo, notes} */
function forH3(pk, o) {
  const x = o || {};
  const pl = CP.plan(pk.cam, { seconds: x.seconds });
  const notes = [`camera: ${pl.desc.segments.map((s) => s.kind + (s.dir ? " " + s.dir : "")).join(" -> ")}`].concat(pl.notes);
  let text = pl.h3, addVideo = "";
  if (pk.exact) {
    const vids = (x.refVideos || []).filter(Boolean);
    if (!pk.rgbName) notes.push("exact path: no guide video yet (🎬 Make guide in the Camera panel) - words only");
    else if (x.mode === "fl2va") notes.push("exact path: a First / Last render (H3's fl2va) takes no video - words only");
    else if (vids.length >= 3) notes.push("exact path: the reference dock already has 3 videos (H3's limit) - words only");
    else {
      addVideo = pk.rgbName;
      const n = vids.includes(pk.rgbName) ? vids.indexOf(pk.rgbName) + 1 : vids.length + 1;
      text += ` Follow the camera movement of <Video ${n}> exactly - the same path, turns and speed; it is a camera guide made from the first picture.`;
      notes.push(`exact path: the guide ${pk.rgbName} rides as <Video ${n}> (experimental - H3 reads a reference video's motion)`);
    }
  }
  return { text, addVideo, notes };
}

/** Wan. -> {text, camera: {pose, speed, approx, depth, exact}, notes} (the worker picks Fun Camera / VACE by the files) */
function forWan(pk, o) {
  const pl = CP.plan(pk.cam, { seconds: (o || {}).seconds });
  const notes = pl.notes.filter((n) => !/^MiniMax|^LTX/.test(n));
  if (pk.exact && !pk.depth) notes.push("exact path: no guide video yet (🎬 Make guide) - the Fun Camera move / words only");
  return { text: pl.prose, notes,
           camera: { pose: pl.wan.pose, speed: pl.wan.speed, approx: pl.wan.approx, exact: pk.exact && !!pk.depth, depth: pk.exact ? pk.depth || "" : "" } };
}

/** LTX. -> {text, lora, depth, notes} */
function forLtx(pk, o) {
  const pl = CP.plan(pk.cam, { seconds: (o || {}).seconds });
  const notes = pl.notes.filter((n) => !/^MiniMax|^Wan/.test(n));
  if (pk.exact && !pk.depth) notes.push("exact path: no guide video yet (🎬 Make guide) - the camera LoRA / words only");
  return { text: pl.prose, lora: pl.ltx, depth: pk.exact ? pk.depth || "" : "", notes };
}

/** what ComfyUI has for camera control, from its /object_info (pure) -> {nodes, wanCamera, wanVace, ltxLoras, depth} */
function inventory(info) {
  const I = info && typeof info === "object" ? info : {};
  const list = (cls, key) => {
    const spec = ((I[cls] || {}).input) || {};
    for (const grp of ["required", "optional"]) {
      const v = (spec[grp] || {})[key];
      if (Array.isArray(v) && Array.isArray(v[0])) return v[0].map(String);
      if (Array.isArray(v) && v[0] === "COMBO" && v[1] && Array.isArray(v[1].options)) return v[1].options.map(String);
      if (v && typeof v === "object" && Array.isArray(v.options)) return v.options.map(String);
    }
    return [];
  };
  const unets = list("UNETLoader", "unet_name");
  const loras = Array.from(new Set(list("LoraLoaderModelOnly", "lora_name").concat(list("LoraLoader", "lora_name"))));
  const base = (n) => String(n).split(/[\\/]/).pop().toLowerCase();
  const ltxLoras = {};
  for (const key of ["dolly-in", "dolly-out", "dolly-left", "dolly-right", "jib-up", "jib-down", "static"]) {
    const re = new RegExp("camera[-_ ]?control[-_ ]?" + key.replace("-", "[-_ ]?"), "i");
    const hit = loras.find((n) => re.test(base(n)));
    if (hit) ltxLoras[key] = hit;
  }
  return {
    nodes: { WanCameraEmbedding: !!I.WanCameraEmbedding, WanCameraImageToVideo: !!I.WanCameraImageToVideo, WanVaceToVideo: !!I.WanVaceToVideo,
             LoadVideo: !!I.LoadVideo, DepthAnythingV2Preprocessor: !!I.DepthAnythingV2Preprocessor },
    wanCamera: unets.filter((n) => /wan/i.test(base(n)) && /camera/i.test(base(n))),
    wanVace: unets.filter((n) => /wan/i.test(base(n)) && /vace/i.test(base(n))),
    ltxLoras, depth: !!I.DepthAnythingV2Preprocessor,
  };
}

module.exports = { parse, join, forH3, forWan, forLtx, inventory };
