/* bitGen Studio — lib/mesh3d.js (2.404.0): A PICTURE -> A 3D MODEL (.glb) in ComfyUI, with ComfyUI's own core nodes.
 *
 * Tim (verbatim): "is it possible for our llm to use blender to create 3d models?" then "can we add option 1 + the
 * image to workflow?" - option 1 = the LLM writes a scene plan that Blender builds (lib/scenePlan.js), "the image to
 * workflow" = detailed objects made from a picture. His answers: "Both, Hunyuan default" (Hunyuan3D 2.1 = the shape,
 * TRELLIS.2 = textured) and pictures "Both" (the plan's hero objects get a generated picture; any gallery / asset
 * picture can be sent to 3D by hand).
 *
 * Comfy-Org's own templates, shipped in comfy_workflows/ and converted against the LIVE ComfyUI (lib/graphToApi - the
 * same converter as the LTX templates, = ComfyUI's frontend):
 *   mesh3d_hunyuan21.json   3d_hunyuan3d-v2.1.json            hunyuan_3d_v2.1.safetensors (checkpoints)
 *   mesh3d_hunyuan20.json   3d_hunyuan3d_image_to_model.json  hunyuan3d-dit-v2*.safetensors (the 2.0 family)
 *   mesh3d_trellis2.json    3d_pixal3d_trellis2_image_to_model.json  TRELLIS.2 (its switch on) - or Pixal3D when only
 *                           that model is there - shape + UV-baked texture
 * prepare(ui, opts): the switches resolved (TRELLIS.2 / Pixal3D, background removal), Save3DAdvanced (a frontend
 * viewport) -> SaveGLB, the 3D previews and every branch that feeds no SaveGLB pruned, the files ComfyUI lists set,
 * the picture, the seeds, the prefix. Hunyuan gets background removal + a centred crop on white in front of it when a
 * background-removal model is there (Hunyuan wants the object alone).
 * mesh3d_worker.py runs it (mode "mesh3d"); scripts/mesh3d_convert.js is its node side. jobParams() is the job. */
"use strict";
const fs = require("fs");
const path = require("path");

const ENGINES = ["auto", "hunyuan", "trellis"];
const TEMPLATES = { hunyuan21: "mesh3d_hunyuan21.json", hunyuan20: "mesh3d_hunyuan20.json", trellis: "mesh3d_trellis2.json" };
// what each loader input lists (the worker asks ComfyUI's /object_info for these)
const LOADERS = [["ImageOnlyCheckpointLoader", "ckpt_name"], ["UNETLoader", "unet_name"], ["VAELoader", "vae_name"],
                 ["CLIPVisionLoader", "clip_name"], ["LoadBackgroundRemovalModel", "bg_removal_name"], ["LoadMoGeModel", "model_name"]];
// the files to download (Settings -> Models -> Model catalog -> "3D models"), by ComfyUI folder
const FILES = {
  hunyuan: [["checkpoints", "hunyuan_3d_v2.1.safetensors"]],
  trellis: [["diffusion_models", "trellis_2_int8_convrot.safetensors"], ["vae", "trellis_2_shape_vae_bf16.safetensors"],
            ["vae", "trellis_2_texture_vae_bf16.safetensors"], ["clip_vision", "dino_v3_L_naf_fp32.safetensors"],
            ["background_removal", "birefnet.safetensors"]],
};
const ENGINE_NAME = { hunyuan: "Hunyuan3D", trellis: "TRELLIS.2" };
// the picture a hero object is drawn as before it becomes 3D: one object, whole, centred, plain background
const PICTURE_SUFFIX = "a single object, the whole object in view, centred, isolated on a plain white background, "
  + "soft even studio light, no shadow, no text, sharp product photo";

const low = (s) => String(s || "").toLowerCase();
const listOf = (lists, c, k) => (lists && Array.isArray(lists[`${c}.${k}`]) ? lists[`${c}.${k}`] : []).map(String);
const find = (list, ...rx) => { for (const r of rx) { const h = list.find((f) => r.test(f)); if (h) return h; } return ""; };

/** Which engine and which files, from what ComfyUI lists. lists = {"Class.input": [files]}.
 *  -> {engine, template, label, files: {...}, notes} | {error} */
function pick(lists, want) {
  const w = ENGINES.includes(want) ? want : "auto";
  const ck = listOf(lists, "ImageOnlyCheckpointLoader", "ckpt_name");
  const un = listOf(lists, "UNETLoader", "unet_name"), va = listOf(lists, "VAELoader", "vae_name");
  const cv = listOf(lists, "CLIPVisionLoader", "clip_name"), bg = listOf(lists, "LoadBackgroundRemovalModel", "bg_removal_name");
  const mo = listOf(lists, "LoadMoGeModel", "model_name");
  const hy21 = find(ck, /hunyuan.?3d.?v?2[._]1/i, /hy3d.?2[._]1/i);
  const hy20 = find(ck, /hunyuan3d.?dit.?v2/i, /hunyuan.?3d/i, /hy3d/i);
  const birefnet = find(bg, /birefnet/i) || bg[0] || "";
  const tr = {
    unet: find(un, /trellis.?2/i), pixal: find(un, /pixal.?3d/i),
    shape: find(va, /trellis.?2.*shape/i), texture: find(va, /trellis.?2.*tex/i),
    dino: find(cv, /dino.?v3/i, /dino/i), bg: birefnet, moge: find(mo, /moge/i),
  };
  const trellisOk = !!((tr.unet || (tr.pixal && tr.moge)) && tr.shape && tr.texture && tr.dino && tr.bg);
  const hunyuanOk = !!(hy21 || hy20);
  const missing = (eng) => FILES[eng].filter(([, f]) => {
    if (eng === "hunyuan") return !hunyuanOk;
    if (/trellis_2_int8/.test(f)) return !(tr.unet || (tr.pixal && tr.moge));
    if (/shape/.test(f)) return !tr.shape;
    if (/texture/.test(f)) return !tr.texture;
    if (/dino/.test(f)) return !tr.dino;
    return !tr.bg;
  }).map(([d, f]) => `${f} (models/${d})`);
  let eng = w;
  if (w === "auto") eng = hunyuanOk ? "hunyuan" : trellisOk ? "trellis" : "";
  if (!eng) return { error: "no image-to-3D model in ComfyUI - download Hunyuan3D 2.1 (" + missing("hunyuan").join(", ")
    + ") or TRELLIS.2 (" + missing("trellis").join(", ") + ") from Settings -> Models -> Model catalog -> 3D models" };
  if (eng === "hunyuan") {
    if (!hunyuanOk) return { error: `${ENGINE_NAME.hunyuan} needs ${missing("hunyuan").join(", ")} - Settings -> Models -> Model catalog -> 3D models` };
    const v21 = !!hy21;
    const notes = [`${ENGINE_NAME.hunyuan} ${v21 ? "2.1" : "2.0"}: ${v21 ? hy21 : hy20} (the shape, no colours - 3DREAL paints the real look)`];
    if (birefnet) notes.push(`background removed first (${birefnet}), the object centred on white`);
    else notes.push("no background-removal model (birefnet) - the picture goes in as it is; a plain background works best");
    return { engine: "hunyuan", template: v21 ? TEMPLATES.hunyuan21 : TEMPLATES.hunyuan20, label: `${ENGINE_NAME.hunyuan} ${v21 ? "2.1" : "2.0"}`,
             version: v21 ? "2.1" : "2.0", files: { ckpt: v21 ? hy21 : hy20, bg: birefnet }, notes };
  }
  if (!trellisOk) return { error: `${ENGINE_NAME.trellis} needs ${missing("trellis").join(", ")} - Settings -> Models -> Model catalog -> 3D models` };
  const usePixal = !tr.unet;
  return { engine: "trellis", template: TEMPLATES.trellis, label: usePixal ? "Pixal3D (TRELLIS.2 family)" : ENGINE_NAME.trellis,
           files: { ...tr, use: usePixal ? "pixal" : "trellis" },
           notes: [`${usePixal ? "Pixal3D " + tr.pixal + " + MoGe " + tr.moge : ENGINE_NAME.trellis + " " + tr.unet}: shape + baked texture `
             + `(VAEs ${tr.shape} / ${tr.texture}, ${tr.dino}, background ${tr.bg})`] };
}

/* ---------- a UI graph, edited */
const lid = (l) => String(Array.isArray(l) ? l[0] : l.id);
const lfrom = (l) => (Array.isArray(l) ? [l[1], l[2]] : [l.origin_id, l.origin_slot]);
const lto = (l) => (Array.isArray(l) ? [l[3], l[4]] : [l.target_id, l.target_slot]);
const byId = (ui, id) => ui.nodes.find((n) => String(n.id) === String(id));
const linkOf = (ui, id) => (ui.links || []).find((l) => lid(l) === String(id));
function unlink(ui, ids) {
  const drop = new Set([...ids].map(String));
  ui.links = (ui.links || []).filter((l) => !drop.has(lid(l)));
  for (const n of ui.nodes) {
    for (const out of n.outputs || []) if (Array.isArray(out.links)) out.links = out.links.filter((x) => !drop.has(String(x)));
    for (const inp of n.inputs || []) if (inp.link != null && drop.has(String(inp.link))) inp.link = null;
  }
}
const nextNode = (ui) => 1 + Math.max(0, +ui.last_node_id || 0, ...ui.nodes.map((n) => +n.id || 0));
const nextLink = (ui) => 1 + Math.max(0, +ui.last_link_id || 0, ...(ui.links || []).map((l) => +lid(l) || 0));
/** a new link origin[slot] -> target.input (by name); the input made if the node has none of that name */
function connect(ui, origin, oslot, target, iname, type) {
  const L = nextLink(ui);
  ui.last_link_id = L;
  const o = byId(ui, origin), t = byId(ui, target);
  o.outputs = o.outputs || [];
  while (o.outputs.length <= oslot) o.outputs.push({ name: type, type, links: [] });
  o.outputs[oslot].links = (o.outputs[oslot].links || []).concat([L]);
  t.inputs = t.inputs || [];
  let k = t.inputs.findIndex((i) => i.name === iname);
  if (k < 0) { t.inputs.push({ name: iname, type, link: null }); k = t.inputs.length - 1; }
  if (t.inputs[k].link != null) unlink(ui, [t.inputs[k].link]);
  t.inputs[k].link = L;
  ui.links.push([L, +origin, oslot, +target, k, type]);
  return L;
}
function addNode(ui, type, widgets, outputs) {
  const id = nextNode(ui);
  ui.last_node_id = id;
  ui.nodes.push({ id, type, pos: [0, 0], size: [240, 100], flags: {}, order: 0, mode: 0, inputs: [],
                  outputs: (outputs || []).map((t) => ({ name: t, type: t, links: [] })), properties: {}, widgets_values: widgets || [] });
  return id;
}
/** the source [node, slot] feeding target's input `name` */
function sourceOf(ui, node, name) {
  const inp = (node.inputs || []).find((i) => i.name === name);
  const l = inp && inp.link != null ? linkOf(ui, inp.link) : null;
  return l ? lfrom(l) : null;
}
/** ComfySwitchNode -> the branch it picks, wired straight through; the switch goes */
function resolveSwitches(ui, notes) {
  for (;;) {
    const sw = ui.nodes.find((n) => n.type === "ComfySwitchNode");
    if (!sw) return;
    let on;
    const s = sourceOf(ui, sw, "switch");
    if (s) { const src = byId(ui, s[0]); on = !!(src && Array.isArray(src.widgets_values) ? src.widgets_values[0] : false); }
    else on = !!(Array.isArray(sw.widgets_values) ? sw.widgets_values[0] : false);
    const pickFrom = sourceOf(ui, sw, on ? "on_true" : "on_false");
    const outs = ((sw.outputs || [])[0] || {}).links || [];
    for (const L of outs.slice()) {
      const l = linkOf(ui, L); if (!l) continue;
      const [t, ts] = lto(l);
      const tn = byId(ui, t), iname = tn && tn.inputs && tn.inputs[ts] ? tn.inputs[ts].name : null;
      const type = Array.isArray(l) ? l[5] : l.type;
      unlink(ui, [L]);
      if (pickFrom && tn && iname) connect(ui, pickFrom[0], pickFrom[1], t, iname, type);
    }
    unlink(ui, (sw.inputs || []).filter((i) => i.link != null).map((i) => i.link));
    ui.nodes = ui.nodes.filter((n) => n !== sw);
    if (sw.title) notes.push(`${sw.title}: ${on ? "on" : "off"}`);
  }
}
/** only what feeds a SaveGLB stays */
function prune(ui) {
  const keep = new Set();
  const stack = ui.nodes.filter((n) => n.type === "SaveGLB").map((n) => String(n.id));
  while (stack.length) {
    const id = stack.pop();
    if (keep.has(id)) continue;
    keep.add(id);
    const n = byId(ui, id);
    for (const i of (n && n.inputs) || []) if (i.link != null) { const l = linkOf(ui, i.link); if (l) stack.push(String(lfrom(l)[0])); }
  }
  const gone = ui.nodes.filter((n) => !keep.has(String(n.id))).map((n) => String(n.id));
  const dead = (ui.links || []).filter((l) => gone.includes(String(lfrom(l)[0])) || gone.includes(String(lto(l)[0]))).map(lid);
  unlink(ui, dead);
  ui.nodes = ui.nodes.filter((n) => keep.has(String(n.id)));
  return gone.length;
}

/** Fill a template for one job. opts = {engine (pick() result), image (ComfyUI input name), seed, prefix}.
 *  -> {ui, notes} or throws with the words */
function prepare(ui0, opts) {
  const o = opts || {};
  const p = o.pick;
  if (!p || !p.engine) throw new Error("no engine picked");
  const ui = JSON.parse(JSON.stringify(ui0));
  ui.links = ui.links || [];
  const notes = [];
  const seed = Math.max(0, Math.floor(+o.seed || 0));
  const prefix = String(o.prefix || "bitgen_mesh3d/mesh");
  ui.nodes = ui.nodes.filter((n) => !["MarkdownNote", "Note"].includes(n.type));
  // the picked model (TRELLIS.2 or Pixal3D) + background removal on
  if (p.engine === "trellis") {
    for (const n of ui.nodes) if (n.type === "PrimitiveBoolean") n.widgets_values = [p.files.use !== "pixal"];
    for (const n of ui.nodes) if (n.type === "ComfySwitchNode" && /background/i.test(n.title || "")) n.widgets_values = [true];
  }
  resolveSwitches(ui, notes);
  // a frontend viewport saver -> SaveGLB on the same mesh
  for (const n of ui.nodes.filter((x) => x.type === "Save3DAdvanced")) {
    const src = sourceOf(ui, n, "model_3d");
    unlink(ui, (n.inputs || []).filter((i) => i.link != null).map((i) => i.link));
    ui.nodes = ui.nodes.filter((x) => x !== n);
    if (!src) continue;
    const s = addNode(ui, "SaveGLB", [prefix]);
    connect(ui, src[0], src[1], s, "mesh", "FILE_3D_GLB");
  }
  for (const n of ui.nodes) if (n.type === "SaveGLB") n.widgets_values = [prefix].concat((n.widgets_values || []).slice(1));
  if (!ui.nodes.some((n) => n.type === "SaveGLB")) throw new Error(`Comfy-Org's ${p.label} template has no SaveGLB / Save3DAdvanced - re-download it`);
  const li = ui.nodes.find((n) => n.type === "LoadImage");
  if (!li) throw new Error(`Comfy-Org's ${p.label} template has no LoadImage`);
  li.widgets_values = [String(o.image || "example.png"), "image"];
  // Hunyuan: the object alone, centred on white, when a background-removal model is there
  if (p.engine === "hunyuan" && p.files.bg) {
    const enc = ui.nodes.find((n) => n.type === "CLIPVisionEncode");
    const src = enc && sourceOf(ui, enc, "image");
    if (src && String(src[0]) === String(li.id)) {
      const m = addNode(ui, "LoadBackgroundRemovalModel", [p.files.bg], ["BACKGROUND_REMOVAL"]);
      const rb = addNode(ui, "RemoveBackground", [], ["MASK"]);
      const cr = addNode(ui, "ImageCropToMask", [1024, 1024, 1.15, 0, "#ffffff"], ["IMAGE"]);
      connect(ui, m, 0, rb, "bg_removal_model", "BACKGROUND_REMOVAL");
      connect(ui, li.id, 0, rb, "image", "IMAGE");
      connect(ui, li.id, 0, cr, "images", "IMAGE");
      connect(ui, rb, 0, cr, "masks", "MASK");
      connect(ui, cr, 0, enc.id, "image", "IMAGE");
    }
  }
  const pruned = prune(ui);
  // files
  for (const n of ui.nodes) {
    const w = Array.isArray(n.widgets_values) ? n.widgets_values : [];
    if (n.type === "ImageOnlyCheckpointLoader") n.widgets_values = [p.files.ckpt].concat(w.slice(1));
    else if (n.type === "UNETLoader") n.widgets_values = [p.files.use === "pixal" ? p.files.pixal : p.files.unet].concat(w.slice(1).length ? w.slice(1) : ["default"]);
    else if (n.type === "VAELoader") n.widgets_values = [/tex/i.test(String(w[0])) ? p.files.texture : p.files.shape];
    else if (n.type === "CLIPVisionLoader") n.widgets_values = [p.files.dino];
    else if (n.type === "LoadBackgroundRemovalModel") n.widgets_values = [p.files.bg];
    else if (n.type === "LoadMoGeModel") n.widgets_values = [p.files.moge];
  }
  // seeds: the job's seed for the first sampler, +1, +2 ... for the stages after it (in id order, as the template)
  const ks = ui.nodes.filter((n) => n.type === "KSampler").sort((a, b) => (+a.id) - (+b.id));
  ks.forEach((n, i) => { const w = n.widgets_values.slice(); w[0] = seed + i; w[1] = "fixed"; n.widgets_values = w; });
  notes.push(...p.notes);
  notes.push(`Comfy-Org's ${p.label} template, seed ${seed}${pruned ? `, ${pruned} preview / unused node(s) left out` : ""}`);
  return { ui, notes };
}

/** read a shipped template */
function template(name, root) {
  const f = path.join(root || path.join(__dirname, ".."), "comfy_workflows", path.basename(String(name)));
  return JSON.parse(fs.readFileSync(f, "utf8"));
}

/** The job: picture (absolute) -> <project>/models3d/<name>.glb. -> {params} | {error} */
function jobParams(o) {
  const x = o || {};
  const pic = String(x.picture || "");
  if (!pic || !fs.existsSync(pic)) return { error: "the picture is not there: " + pic };
  if (!/\.(png|jpe?g|webp|bmp)$/i.test(pic)) return { error: "image to 3D takes a picture (.png / .jpg / .webp)" };
  const m3d = require("./m3d");
  const stem = m3d.safeName(String(x.name || path.basename(pic).replace(/\.[^.]+$/, ""))).replace(/\.[^.]+$/, "").replace(/\s+/g, "_") || "model";
  const engine = ENGINES.includes(x.engine) ? x.engine : "auto";
  const seed = Number.isFinite(+x.seed) && +x.seed >= 0 ? Math.floor(+x.seed) : Math.floor(Math.random() * 2 ** 31);
  const label = x.label || `🧊 3D model · ${path.basename(pic)}`;
  return { params: { mode: "mesh3d", picture: pic, name: stem, engine, seed, label, prompt: label,
                     models_dir: x.models_dir || null, no_assets: true } };
}

module.exports = { ENGINES, TEMPLATES, LOADERS, FILES, ENGINE_NAME, PICTURE_SUFFIX, pick, prepare, template, jobParams,
                   resolveSwitches, prune, connect, addNode };
