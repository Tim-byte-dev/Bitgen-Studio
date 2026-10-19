#!/usr/bin/env node
/* bitGen Studio — 2.305.0: CONTROLNET TYPES + THE INPUT / OUTPUT MODELS.
 * Run: node scripts/test-cntypes.js
 *
 * Tim (verbatim): "in settings controlnet, add types, pose, scribble,
 * lineart, depth. add select file input for control net model for input
 * controlnet and output controlnet" (input = the preprocessor that makes the
 * control map, output = the ControlNet model).
 *   1. lib/controlnetTypes: the four types, type recognition by file name,
 *      the aux ckpts scan (a fake ComfyUI tree), the JSON catalogue;
 *   2. lib/styles: a chain keeps cn_type + preprocessor, drops a bad type,
 *      a PATCH without chain keeps both;
 *   3. the wiring: the route, the route's type check, the tab's controls.
 * The tab itself runs in scripts/test-imagedom.js (paint, re-sort, save). */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
let pass = 0, fail = 0;
function check(name, ok, extra) {
  if (ok) { pass++; console.log("PASS: " + name); }
  else { fail++; console.log("FAIL: " + name + (extra !== undefined ? " :: " + JSON.stringify(extra) : "")); }
}
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const CT = require(path.join(ROOT, "lib", "controlnetTypes"));

// ---- 1. the lib -------------------------------------------------------------------
check("four types, in menu order", JSON.stringify(CT.IDS) === '["pose","scribble","lineart","depth"]', CT.IDS);
check("normType keeps the four (any case), anything else is \"\"",
  CT.normType("Depth") === "depth" && CT.normType(" pose ") === "pose" && CT.normType("canny") === ""
  && CT.normType(null) === "" && CT.normType("") === "");
const names = {
  "dw-ll_ucoco_384.onnx": "pose", "yolox_l.onnx": "pose", "body_pose_model.pth": "pose",
  "control_v11p_sd15_openpose.pth": "pose",
  "table5_pidinet.pth": "scribble", "ControlNetHED.pth": "scribble", "control_v11p_sd15_scribble.pth": "scribble",
  "sk_model.pth": "lineart", "sk_model2.pth": "lineart", "control_v11p_sd15_lineart.pth": "lineart",
  "depth_anything_v2_vitl.pth": "depth", "dpt_hybrid-midas-501f0c75.pt": "depth", "control_v11f1p_sd15_depth.pth": "depth",
};
const wrong = Object.entries(names).filter(([n, t]) => JSON.stringify(CT.typesOf(n)) !== JSON.stringify([t]));
check("typesOf recognises annotators AND ControlNets by name (13 names, one type each)", wrong.length === 0,
  wrong.map(([n]) => [n, CT.typesOf(n)]));
check("...an unrelated file matches none", CT.typesOf("upscaler_4x.pth").length === 0 && CT.typesOf("").length === 0);
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cnt-"));
  try {
    const ck = path.join(tmp, "custom_nodes", "comfyui_controlnet_aux", "ckpts");
    const put = (rel) => { const f = path.join(ck, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, "x"); };
    put("yzd-v/DWPose/dw-ll_ucoco_384.onnx");
    put("lllyasviel/Annotators/table5_pidinet.pth");
    put("lllyasviel/Annotators/sk_model.pth");
    put("depth-anything/Depth-Anything-V2-Large/depth_anything_v2_vitl.pth");
    put("lllyasviel/Annotators/README.md");
    fs.mkdirSync(path.join(tmp, "custom_nodes", "some_other_node", "ckpts"), { recursive: true });
    fs.writeFileSync(path.join(tmp, "custom_nodes", "some_other_node", "ckpts", "x.pth"), "x");
    const sc = CT.scan(tmp);
    check("scan: only the controlnet_aux ckpts folder, model files only, relative names with /",
      sc.exists === true && sc.dirs.length === 1 && sc.files.length === 4
      && sc.files.every(f => !f.name.includes("\\") && path.isAbsolute(f.path))
      && !sc.files.some(f => /README|x\.pth$/.test(f.name)), sc.files.map(f => f.name));
    check("...each file carries its type",
      JSON.stringify(sc.files.map(f => [f.name.split("/").pop(), f.types[0]]).sort()) === JSON.stringify([
        ["depth_anything_v2_vitl.pth", "depth"], ["dw-ll_ucoco_384.onnx", "pose"],
        ["sk_model.pth", "lineart"], ["table5_pidinet.pth", "scribble"]]), sc.files.map(f => [f.name, f.types]));
    check("scan: no ComfyUI folder / no aux node -> empty, never throws",
      CT.scan("").exists === false && CT.scan(path.join(tmp, "nope")).files.length === 0);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}
const cat = CT.catalogue();
check("catalogue: JSON-safe, each type with its preprocessor node and examples (2.317.0: + the matcher as a string, for Basic Settings)",
  cat.length === 4 && cat.every(t => t.id && t.label && t.node && t.example && t.cn_example && typeof t.match === "string"
    && new RegExp(t.match, "i").test(t.cn_example.split(" ")[0]))
  && JSON.stringify(JSON.parse(JSON.stringify(cat))) === JSON.stringify(cat)
  && cat.find(t => t.id === "pose").node === "DWPreprocessor" && cat.find(t => t.id === "depth").node === "DepthAnythingV2Preprocessor",
  cat);

// ---- 2. the style store -----------------------------------------------------------
{
  const S = require(path.join(ROOT, "lib", "styles"));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cnts-"));
  try {
    const a = S.save(tmp, { name: "A", kind: "image" }), b = S.save(tmp, { name: "B", kind: "image" });
    const ch = S.save(tmp, { name: "Pose Chain", kind: "image",
      chain: { first_id: a.id, controlnet: "openpose.safetensors", second_id: b.id,
               cn_type: "Pose", preprocessor: "yzd-v/DWPose/dw-ll_ucoco_384.onnx" } });
    check("a chain saves its type (normalised) and its input model",
      ch.chain.cn_type === "pose" && ch.chain.preprocessor === "yzd-v/DWPose/dw-ll_ucoco_384.onnx"
      && ch.chain.controlnet === "openpose.safetensors", ch.chain);
    check("...and a PATCH without chain keeps both", (() => {
      const r = S.save(tmp, { id: ch.id, caption: "x" }).chain;
      return r.cn_type === "pose" && r.preprocessor === "yzd-v/DWPose/dw-ll_ucoco_384.onnx"; })());
    const bad = S.save(tmp, { name: "Bad", kind: "image",
      chain: { first_id: a.id, controlnet: "c.safetensors", second_id: b.id, cn_type: "canny", preprocessor: "" } });
    check("an unknown type and a blank input are left off (not stored as junk)",
      bad.chain && !("cn_type" in bad.chain) && !("preprocessor" in bad.chain), bad.chain);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}

// ---- 3. the wiring ------------------------------------------------------------------
{
  const RI = read("routes", "index.js"), IX = read("static", "index.html");
  check("the route: GET /api/controlnet/preprocessors scans the configured ComfyUI folder",
    RI.includes('app.get("/api/controlnet/preprocessors"') && RI.includes("const sc = cnTypes.scan(dirAbs);")
    && RI.includes("res.json({ types: cnTypes.catalogue(), exts: cnTypes.EXTS,"));
  check("POST /api/styles refuses an unknown type with the four named",
    RI.includes("if (String(b.chain.cn_type || \"\").trim() && !cnTypes.normType(b.chain.cn_type))")
    && RI.includes('cnTypes.IDS.join(", ")'));
  check("the tab: Type select, INPUT select + 📁 + ⟳, OUTPUT models combo",
    /<select id="s_cntype"[^>]*>\s*<option value="pose">Pose<\/option>\s*<option value="scribble">Scribble<\/option>\s*<option value="lineart">Lineart<\/option>\s*<option value="depth">Depth<\/option>/.test(IX)
    && IX.includes('<label class="f" for="s_cnpresel">Input ControlNet')
    && IX.includes('id="s_cnprepick"') && IX.includes('id="s_cnprescan"')
    && IX.includes('<label class="f">Output ControlNet')
    && IX.includes('<div id="s_cnmodelcombo"></div>') && IX.includes('<input id="s_cnmodel" type="hidden">'));
  check("📁 browses the machine for the input file (the fs picker reports back), the output uses the models browser",
    IX.includes('openFsPicker($("s_cnpre"), "file", (cnPre.exts || []).join(","), () => cnPaintPre())')
    && IX.includes("const f = typeof onPick === \"function\" ? onPick : fsOnPick;")   // 2.326.0: the file dialog
    && IX.includes('cmCombo($("s_cnmodelcombo"), $("s_cnmodel"), ["controlnet"],'));
  check("the ControlNet combo does not mark the IMAGE style unsaved (onChange hook), and a rescan repaints it",
    IX.includes('const dirty = typeof o.onChange === "function" ? o.onChange : () => { styleDirty = true; };')
    && IX.includes("#stab-cnet .cmcombo"));
}

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
