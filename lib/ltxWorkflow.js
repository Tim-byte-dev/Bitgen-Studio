"use strict";
/**
 * ltxWorkflow.js — ONE MODE OUT OF TIM'S LTX 2.5 ALL-IN-ONE CANVAS (2.338.0).
 *
 * Tim: "can we add ltx2.5 for our music video and screenplay and first/last
 * frame from reference images/audio/video option".
 *
 * comfy_workflows/LTX25_All_In_One.json is Tim's "LTX 2.5 All-In-One Workflow
 * 260820-1" UI export, shipped as it is. Eight MODES sit side by side as
 * subgraph instances, one enabled at a time by an rgthree Fast Groups
 * Bypasser; each one's picture and sound go into SetNodes img<k> / ad<k>,
 * and the Output group's Any Switch nodes pick whichever ran. Everything a
 * mode needs arrives by NAME through Get nodes: Image1 / Image2 / Image3,
 * Audio_Input, video_input + Video_Audio, pos / neg, width / height, length
 * (the Clip Length slider, seconds), FPS, model, clip, IC Model.
 *
 *   k  id          canvas group                      inputs
 *   1  t2v         01 Text to Video                  -
 *   2  a2v         02 Audio to Video                 audio
 *   3  i2v         03 Image to Video                 Image1 (first frame)
 *   4  flf         04 First/Last Frame               Image1 first, Image2 last
 *   5  lipsync     05 Lipsync                        Image1, audio
 *   6  v2v         08 Style Transfer                 video (+ its audio), Image1
 *   7  fl_lipsync  06 First/Last Frame Lipsync       Image1, Image2, audio
 *   8  fmlf        07 First-Middle-Last + audio      Image1 first, Image2 middle, Image3 last, audio
 *
 * prepare() makes the one-mode canvas: the chosen instance and its
 * definition's nodes enabled (a bypassed group stores mode 4 on every inner
 * node), the other seven instances removed with their img/ad Set nodes and
 * the Gets that read them (the Any Switches keep one live input), the
 * canvas-only rgthree nodes (Fast Groups Bypasser, Label) removed, and the
 * model loader chosen: a .gguf model runs the UnetLoaderGGUF, anything else
 * the UNETLoader - whichever is picked is wired into the Power Lora Loader.
 * The result is still a UI graph: lib/graphToApi.js (via scripts/
 * ltx_convert.js, run by ltx_worker.py against the LIVE ComfyUI's
 * /object_info) turns it into the API prompt; scripts/ltx_graph.py writes
 * the job's values into that.
 *
 * Pure: no files, no ComfyUI.
 */

const MODES = [
  { id: "t2v", k: 1, label: "Text to video", needs: {} },
  { id: "a2v", k: 2, label: "Audio to video (text + audio)", needs: { audio: true } },
  { id: "i2v", k: 3, label: "Image to video (first frame)", needs: { images: 1 } },
  { id: "flf", k: 4, label: "First / last frame", needs: { images: 2 } },
  { id: "lipsync", k: 5, label: "Lipsync (picture + audio)", needs: { images: 1, audio: true } },
  // k = the canvas's img<k> / ad<k> Set names - NOT its group numbers: group
  // 08 (style transfer) writes img6, 06 (F/L lipsync) img7, 07 (FMLF) img8
  { id: "v2v", k: 6, label: "Video to video (style transfer)", needs: { video: true, images: 1 } },
  { id: "fl_lipsync", k: 7, label: "First / last frame lipsync", needs: { images: 2, audio: true } },
  { id: "fmlf", k: 8, label: "First / middle / last frame + audio", needs: { images: 3, audio: true } },
];
const modeById = (id) => MODES.find((m) => m.id === id) || null;
/** Modes whose shots travel between two pictures - the transition LoRA's job. */
const TRANSITION_MODES = ["flf", "fl_lipsync", "fmlf"];
const CANVAS_ONLY = new Set(["Fast Groups Bypasser (rgthree)", "Fast Groups Muter (rgthree)", "Label (rgthree)",
                             "Bookmark (rgthree)", "Note", "MarkdownNote"]);
const LOADERS = { gguf: "UnetLoaderGGUF", unet: "UNETLoader" };

/**
 * The mode for what the user gave. o = {images (count), audio (bool), video (bool)}.
 * video -> v2v; audio -> lipsync by picture count; else by picture count.
 */
function autoMode(o) {
  const x = o || {};
  const n = Math.max(0, x.images | 0);
  if (x.video) return "v2v";
  if (x.audio) return n >= 3 ? "fmlf" : n === 2 ? "fl_lipsync" : n === 1 ? "lipsync" : "a2v";
  return n >= 2 ? "flf" : n === 1 ? "i2v" : "t2v";
}

/** What a mode is missing, in words, or "". */
function missing(mode, o) {
  const m = modeById(mode);
  if (!m) return `unknown LTX mode "${mode}"`;
  const x = o || {};
  const need = m.needs;
  const out = [];
  if (need.images && (x.images | 0) < need.images)
    out.push(need.images === 1 ? "a picture (the first frame)" : `${need.images} pictures (${need.images === 2 ? "first + last" : "first + middle + last"})`);
  if (need.audio && !x.audio) out.push("an audio clip");
  if (need.video && !x.video) out.push("a reference video");
  return out.length ? `${m.label} needs ${out.join(" and ")}` : "";
}

/** Seconds -> an LTX length: whole seconds 1..30 (the canvas's Clip Length
 *  slider; frames = seconds * fps + 1 stays on LTX's 8k+1 grid at 24 fps). */
function seconds(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return 5;             // unset = the canvas's 5 s
  return Math.max(1, Math.min(30, Math.round(n)));
}

const setName = (n) => (n && n.type === "SetNode" ? String((n.widgets_values || [])[0] || n.title || "") : "");
const getName = (n) => (n && n.type === "GetNode" ? String((n.widgets_values || [])[0] || "") : "");
const isInstance = (n, defs) => !!(n && defs.has(String(n.type)));
function linkOf(l) {
  return Array.isArray(l) ? { id: l[0], from: l[1], fslot: l[2], to: l[3], tslot: l[4], type: l[5] }
    : { id: l.id, from: l.origin_id, fslot: l.origin_slot, to: l.target_id, tslot: l.target_slot, type: l.type };
}

/**
 * The one-mode canvas. opts = { mode, model (file name; .gguf picks the GGUF
 * loader), te (text encoder file), notes (array to append to) }.
 * -> { ui, instance, loader, notes } or throws in words.
 */
function prepare(ui, opts) {
  const o = opts || {};
  const m = modeById(o.mode);
  if (!m) throw new Error(`unknown LTX mode "${o.mode}" - one of ${MODES.map((x) => x.id).join(", ")}`);
  if (!ui || !Array.isArray(ui.nodes)) throw new Error("the LTX workflow is not a ComfyUI UI export");
  const g = JSON.parse(JSON.stringify(ui));
  const notes = [];
  // 2.401.2: ComfyMath is gone from GitHub - the canvas's math (CM_* + pysssss MathExpression) runs as ComfyUI's
  // core Math Expression, whatever the export carries (lib/mathNodes.js)
  const math = require("./mathNodes").migrate(g);
  if (math.length) notes.push(`${math.length} math node(s) (${[...new Set(math.map((x) => x.from))].join(", ")}) -> ComfyUI's core Math Expression`);
  // 2.401.3: MediaMixer's Final / First Frame Selector (never installed by the studio) -> KJNodes' GetImageRangeFromBatch
  const swapped = require("./nodeSwaps").swap(g);
  if (swapped.length) notes.push(`${swapped.length} node(s) (${[...new Set(swapped.map((x) => x.from))].join(", ")}) -> KJNodes GetImageRangeFromBatch (the same frame)`);
  const defs = new Map(((g.definitions || {}).subgraphs || []).map((d) => [String(d.id), d]));
  const byId = new Map(g.nodes.map((n) => [String(n.id), n]));
  const links = (g.links || []).map(linkOf);
  // which instance feeds Set img<k>
  const feeds = new Map();                    // instance id -> k
  for (const n of g.nodes) {
    const nm = setName(n);
    const hit = /^(img|ad)(\d+)$/.exec(nm);
    if (!hit) continue;
    const inLink = (n.inputs || []).map((i) => i.link).find((x) => x != null);
    const l = links.find((x) => String(x.id) === String(inLink));
    if (l && isInstance(byId.get(String(l.from)), defs)) feeds.set(String(l.from), +hit[2]);
  }
  const chosen = [...feeds.entries()].find(([, k]) => k === m.k);
  if (!chosen) throw new Error(`the LTX workflow has no mode ${m.k} (${m.label}) - is it Tim's all-in-one export?`);
  const keepId = chosen[0];
  const drop = new Set();
  for (const [id, k] of feeds) if (k !== m.k) drop.add(id);
  for (const n of g.nodes) {
    const sn = setName(n), gn = getName(n);
    const hs = /^(img|ad)(\d+)$/.exec(sn), hg = /^(img|ad)(\d+)$/.exec(gn);
    if ((hs && +hs[2] !== m.k) || (hg && +hg[2] !== m.k)) drop.add(String(n.id));
    if (CANVAS_ONLY.has(String(n.type))) drop.add(String(n.id));
  }
  // enable the chosen instance and every node inside its definition
  const inst = byId.get(keepId);
  inst.mode = 0;
  const def = defs.get(String(inst.type));
  for (const n of (def && def.nodes) || []) n.mode = 0;
  for (const n of g.nodes) {
    const sn = setName(n), gn = getName(n);
    if ((sn === `img${m.k}` || sn === `ad${m.k}` || gn === `img${m.k}` || gn === `ad${m.k}`)) n.mode = 0;
  }
  // the loader: .gguf -> UnetLoaderGGUF, else UNETLoader; its model file set
  const want = /\.gguf$/i.test(String(o.model || "")) || (!o.model && [...byId.values()].some((n) => n.type === LOADERS.gguf && linked(n, links)))
    ? "gguf" : "unet";
  const loader = g.nodes.find((n) => n.type === LOADERS[want]);
  const lora = g.nodes.find((n) => String(n.type).startsWith("Power Lora Loader"));
  if (loader && lora) {
    const modelIn = (lora.inputs || []).find((i) => i.name === "model");
    const l = modelIn && links.find((x) => String(x.id) === String(modelIn.link));
    if (l && String(l.from) !== String(loader.id)) {
      const old = byId.get(String(l.from));
      l.from = loader.id; l.fslot = 0;
      for (const out of old.outputs || []) out.links = (out.links || []).filter((id) => String(id) !== String(l.id));
      const o0 = (loader.outputs || [])[0];
      if (o0) o0.links = [...new Set([...(o0.links || []), l.id])];
      notes.push(`model loader: ${LOADERS[want]} (was ${old.type})`);
    }
    loader.mode = 0;
    if (o.model) {
      loader.widgets_values = Array.isArray(loader.widgets_values) ? loader.widgets_values.slice() : [];
      loader.widgets_values[0] = String(o.model);
      notes.push(`model: ${o.model}`);
    }
  }
  if (o.te) {
    const clipIn = lora && (lora.inputs || []).find((i) => i.name === "clip");
    const l = clipIn && links.find((x) => String(x.id) === String(clipIn.link));
    const cl = l && byId.get(String(l.from));
    if (cl && cl.type === "CLIPLoader") {
      cl.widgets_values = cl.widgets_values.slice(); cl.widgets_values[0] = String(o.te);
      notes.push(`text encoder: ${o.te}`);
    }
  }
  // remove the dropped nodes and every link that touches them
  g.nodes = g.nodes.filter((n) => !drop.has(String(n.id)));
  const alive = new Set(g.nodes.map((n) => String(n.id)));
  const deadLinks = new Set(links.filter((l) => !alive.has(String(l.from)) || !alive.has(String(l.to))).map((l) => String(l.id)));
  for (const n of g.nodes) {
    for (const i of n.inputs || []) if (i.link != null && deadLinks.has(String(i.link))) i.link = null;
    for (const out of n.outputs || []) if (Array.isArray(out.links)) out.links = out.links.filter((id) => !deadLinks.has(String(id)));
  }
  g.links = (g.links || []).filter((l) => !deadLinks.has(String(linkOf(l).id)))
    .map((l) => {                             // carry a rewired loader link back into the array
      const L = links.find((x) => String(x.id) === String(linkOf(l).id));
      return Array.isArray(l) ? [L.id, L.from, L.fslot, L.to, L.tslot, L.type] : { ...l, origin_id: L.from, origin_slot: L.fslot };
    });
  // the definitions of removed instances are no longer referenced
  const used = new Set(g.nodes.map((n) => String(n.type)));
  if (g.definitions && Array.isArray(g.definitions.subgraphs))
    g.definitions.subgraphs = g.definitions.subgraphs.filter((d) => used.has(String(d.id)));
  notes.unshift(`LTX mode ${m.k}: ${m.label} (instance ${keepId})`);
  return { ui: g, instance: keepId, loader: LOADERS[want], mode: m.id, notes };
}

function linked(n, links) {
  return links.some((l) => String(l.from) === String(n.id));
}

/** The node classes the one-mode canvas uses (for /object_info per class):
 *  top-level + inside the kept subgraph definitions, no Set/Get, no UUIDs. */
function classesOf(ui) {
  const defs = new Set(((ui.definitions || {}).subgraphs || []).map((d) => String(d.id)));
  const out = new Set();
  const walk = (nodes) => { for (const n of nodes || []) { const t = String(n.type || ""); if (t && !defs.has(t) && t !== "SetNode" && t !== "GetNode" && !CANVAS_ONLY.has(t) && t !== "Reroute") out.add(t); } };
  walk(ui.nodes);
  for (const d of (ui.definitions || {}).subgraphs || []) walk(d.nodes);
  return [...out].sort();
}

module.exports = { MODES, TRANSITION_MODES, modeById, autoMode, missing, seconds, prepare, classesOf, LOADERS };
