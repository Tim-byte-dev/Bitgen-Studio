// bitGen Studio — CONTROLNET TYPES + THE PREPROCESSOR (INPUT) MODELS (2.305.0).
//
// Tim (verbatim): "in settings controlnet, add types, pose, scribble, lineart,
// depth. add select file input for control net model for input controlnet and
// output controlnet" -> input = the PREPROCESSOR (annotator) model that turns
// a picture into the control map, output = the ControlNet model that guides
// the render from that map.
//
// A chain style's `chain` gains:
//   cn_type       "pose" | "scribble" | "lineart" | "depth" ("" = not set)
//   preprocessor  the annotator file (INPUT) - a name under the aux ckpts
//                 folder, or an absolute path picked with 📁; "" = the
//                 preprocessor node's own default download
//   controlnet    the ControlNet model (OUTPUT) - unchanged since 2.97.0
//
// Annotators are not ComfyUI "models": comfyui_controlnet_aux keeps them in
// custom_nodes/comfyui_controlnet_aux/ckpts/<repo>/…, so they get their own
// scan here (lib/comfyModels only walks models/ and extra_model_paths.yaml).
const fs = require("fs");
const path = require("path");

/** The four types, in menu order. `node` is the comfyui_controlnet_aux node
 *  that makes the control map; `match` recognises a file (annotator or
 *  ControlNet) as belonging to the type; `example` is what to look for. */
const TYPES = [
  { id: "pose", label: "Pose", node: "DWPreprocessor",
    match: /(dw-?ll|dwpose|yolox|rtmpose|body_pose|hand_pose|facenet|openpose|\bpose)/i,
    example: "dw-ll_ucoco_384.onnx + yolox_l.onnx (DWPose)",
    cn_example: "control_v11p_sd15_openpose / *openpose*.safetensors" },
  { id: "scribble", label: "Scribble", node: "Scribble_PiDiNet_Preprocessor",
    match: /(scribble|pidinet|table5|controlnethed|\bhed\b|_hed|hed_)/i,
    example: "table5_pidinet.pth (PiDiNet) or ControlNetHED.pth",
    cn_example: "control_v11p_sd15_scribble / *scribble*.safetensors" },
  { id: "lineart", label: "Lineart", node: "LineArtPreprocessor",
    match: /(lineart|line_art|sk_model|netg|anime_?line|mangaline)/i,
    example: "sk_model.pth + sk_model2.pth (Lineart)",
    cn_example: "control_v11p_sd15_lineart / *lineart*.safetensors" },
  { id: "depth", label: "Depth", node: "DepthAnythingV2Preprocessor",
    match: /(depth|midas|dpt_|zoe|leres|marigold)/i,
    example: "depth_anything_v2_vitl.pth (Depth Anything V2)",
    cn_example: "control_v11f1p_sd15_depth / *depth*.safetensors" },
];
const IDS = TYPES.map((t) => t.id);
const EXTS = [".pth", ".pt", ".onnx", ".safetensors", ".bin", ".ckpt", ".torchscript"];

/** "" for anything that is not one of the four ids. */
function normType(v) {
  const s = String(v == null ? "" : v).trim().toLowerCase();
  return IDS.includes(s) ? s : "";
}

/** The types a file name belongs to (a file can match none). */
function typesOf(name) {
  const n = path.basename(String(name || ""));
  return TYPES.filter((t) => t.match.test(n)).map((t) => t.id);
}

/** The aux ckpts folders under a ComfyUI install - every custom node folder
 *  whose name carries "controlnet_aux" (the repo is cloned under a few names). */
function auxDirs(comfyDirAbs) {
  if (!comfyDirAbs) return [];
  const cn = path.join(comfyDirAbs, "custom_nodes");
  let names = [];
  try { names = fs.readdirSync(cn); } catch { return []; }
  return names.filter((n) => /controlnet_aux/i.test(n))
    .map((n) => path.join(cn, n, "ckpts"))
    .filter((d) => { try { return fs.statSync(d).isDirectory(); } catch { return false; } });
}

/** Every annotator file under the aux ckpts folders:
 *  [{ name (relative, forward slashes), path, size, types }]. Bounded
 *  (depth 8, 2000 files) so a stray huge tree cannot stall Settings. */
function scan(comfyDirAbs) {
  const dirs = auxDirs(comfyDirAbs);
  const files = [];
  const seen = new Set();
  const walk = (root, dir, depth) => {
    if (depth > 8 || files.length >= 2000) return;
    let ents = [];
    try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) { if (!e.name.startsWith(".")) walk(root, abs, depth + 1); continue; }
      if (!EXTS.includes(path.extname(e.name).toLowerCase())) continue;
      const name = path.relative(root, abs).split(path.sep).join("/");
      if (seen.has(name)) continue;
      seen.add(name);
      let size = 0;
      try { size = fs.statSync(abs).size; } catch {}
      files.push({ name, path: abs, size, types: typesOf(name) });
    }
  };
  for (const d of dirs) walk(d, d, 0);
  files.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  return { dirs, exists: dirs.length > 0, files };
}

/** The shape the page needs (regexes do not travel as JSON). */
function catalogue() {
  // 2.317.0: + the file matcher's source, so Basic Settings -> ControlNet can
  // list the type's ControlNet models first
  return TYPES.map(({ id, label, node, example, cn_example, match }) =>
    ({ id, label, node, example, cn_example, match: match.source }));
}

module.exports = { TYPES, IDS, EXTS, normType, typesOf, auxDirs, scan, catalogue };
