"use strict";
/**
 * graphToApi.js — "EXPORT AS API", DONE FROM COMFYUI'S OWN SCHEMA (2.120.0).
 *
 * A ComfyUI *UI export* (what "Workflow → Save"/"Export" writes) lists each
 * node's widget VALUES in order but not their NAMES. An API prompt needs the
 * names. `scripts/ui_to_api.py` solved that once with a hand-written table of
 * widget orders — which works for the node types Tim had that day and stops
 * dead on anything else, by design, so nothing is silently mis-wired.
 *
 * That table cannot be the answer for a tab whose whole point is "bring me any
 * workflow". So this module asks the SOURCE OF TRUTH instead: ComfyUI's
 * `/object_info`, which is where the canvas itself gets the widget order from.
 * Any node pack the user has installed is therefore supported the moment
 * ComfyUI can see it, with no table to keep up to date.
 *
 * PURE. The spec map is passed in (routes/index.js fetches it), so this runs in
 * a unit test with a fixture and never opens a socket.
 *
 * WHAT IT HANDLES, and why each one is here rather than "later":
 *  - widget-to-input conversions: a converted widget appears in the node's
 *    `inputs` array with a link, and its value is NOT in `widgets_values`, so
 *    those names are struck off the list before the positional walk.
 *  - `control_after_generate`: a UI-only widget that sits immediately after a
 *    seed-ish INT and has no place in an API prompt. It is consumed only when
 *    there are values left over to consume, so a graph saved without it still
 *    lines up.
 *  - Bypassed (mode 4) and muted (mode 2) nodes: removed, with their inputs
 *    reconnected to their consumers by SLOT TYPE. This is what Ctrl+B means,
 *    and ComfyUI's own Export (API) does it too — a bypassed LoRA that came
 *    through as a node would be a silent quality change.
 *  - Reroute / Note / MarkdownNote: dropped the same way (Reroute passes its
 *    one input through; the notes have no outputs).
 *  - PrimitiveNode: its value is inlined into every widget it feeds.
 *
 * WHAT IT REFUSES. A node class `/object_info` does not know is reported by
 * NAME and the conversion fails. Guessing a widget order is how a workflow
 * comes back rendering the wrong thing with no error, which is worse than a
 * message naming the pack the user has to install.
 */

/** Types whose value is typed into a widget rather than dragged from a wire. */
const subgraphs = require("./subgraphs.js");

/* 2.404.0: ComfyUI's V3 value widgets (comfy_api/latest/_io.py: a WidgetInput the canvas draws and saves in
   widgets_values) - ImageCropToMask's background "COLOR" in Comfy-Org's TRELLIS.2 template; read as a socket, its
   "#000000" slid nowhere and the node went to /prompt without it ("Required input is missing: background"). */
const WIDGET_TYPES = new Set(["INT", "FLOAT", "STRING", "BOOLEAN", "COMBO",
  "COLOR", "COLORS", "BOUNDING_BOX", "BOUNDING_BOXES", "CURVE", "VIDEO_EDIT", "RANGE"]);
/** Node classes that never reach an API prompt, whatever ComfyUI thinks. */
const DROP_TYPES = new Set(["Note", "MarkdownNote", "Reroute", "PrimitiveNode"]);
/**
 * Classes that USED to be canvas-only and are now real backend nodes.
 *
 * ComfyUI 0.34's own API export keeps `PrimitiveInt`/`PrimitiveFloat`/
 * `PrimitiveString` as nodes and wires them (`"steps": ["247", 0]`) instead of
 * inlining their values — checked against Tim's export of the Longform
 * blueprint, which is shipped beside it as a fixture. So the rule is not a
 * fixed list: a primitive is DROPPED AND INLINED only when this ComfyUI does
 * not know the class, which is exactly the older frontends where it was
 * virtual. Inlining one that ComfyUI can execute would write a literal over a
 * DYNAMIC input such as ComfyMathExpression's `values.a`, which the old list
 * would have done to this very workflow.
 */
const SOFT_DROP_TYPES = new Set(["PrimitiveInt", "PrimitiveFloat", "PrimitiveString",
                                 "PrimitiveStringMultiline", "PrimitiveBoolean"]);
/** ComfyUI node modes: 0 = always, 2 = muted/never, 4 = bypassed. */
const SKIP_MODES = new Set([2, 4]);

function isWidgetSpec(spec) {
  if (Array.isArray(spec)) {
    const t = spec[0];
    if (Array.isArray(t)) return true;                  // a combo: the list IS the type
    /* 2.402.1 (Tim's LTX 2.5 run: SamplerCustomAdvanced "Sizes of tensors must match except in dimension 2. Expected
       size 1 but got size 25"): a MULTI-TYPE input ("FLOAT,INT" - LTXVEmptyLatentAudio's frame_rate) is a widget
       when its options name a widgetType, exactly as the canvas draws it. Read as "not a widget", its saved value
       slid onto the next widget: batch_size = 25 (the frame rate), an audio latent 25 deep beside a video latent 1. */
    if (typeof t === "string" && t.includes(",")) {
      const o = spec[1] && typeof spec[1] === "object" ? spec[1] : {};
      return WIDGET_TYPES.has(String(o.widgetType || ""));
    }
    return WIDGET_TYPES.has(String(t));                 // incl. ["COMBO", {...}]
  }
  // 2.280.0 (Tim's field report: "Required input is missing sampler_name /
  // scheduler / clip_name ..."): newer ComfyUI builds can answer
  // /object_info with OBJECT-form specs — {type: "COMBO", options: [...]},
  // {type: "INT", default: ...} — instead of the classic arrays. The old
  // test required an array, so on such a server EVERY widget fell out of
  // widgetNames, the export's saved values (model names, sampler,
  // scheduler) were never mapped, and the converted base carried empty
  // loaders that failed /prompt validation by name.
  if (spec && typeof spec === "object" && !Array.isArray(spec)) {
    if (Array.isArray(spec.options) || Array.isArray(spec.values)) return true;
    return WIDGET_TYPES.has(String(spec.type || ""));
  }
  return false;
}
/* 2.401.5 (Tim's LTX run: "ResizeImageMaskNode.execute() missing 1 required positional argument: 'resize_type'"):
   a V3 DYNAMIC COMBO (comfy_api/latest/_io.py DynamicCombo, io_type "COMFY_DYNAMICCOMBO_V3") is a widget too - its
   value is the chosen option's key - and each option brings its own widgets, sent as "<name>.<sub>" (resize_type =
   "scale dimensions" + resize_type.width / .height / .crop). /object_info: [type, {options: [{key, inputs:
   {required, optional}}]}]. The UI saves the key, then the chosen option's values, then the next widget. */
const DYN_TYPE = /DYNAMICCOMBO/i;
function dynOptions(spec) {
  const t = Array.isArray(spec) ? spec[0] : spec && spec.type;
  if (!DYN_TYPE.test(String(t || ""))) return null;
  const o = Array.isArray(spec) ? spec[1] : spec;
  const opts = o && Array.isArray(o.options) ? o.options : [];
  return opts.filter((x) => x && typeof x === "object" && "key" in x);
}
/** The widget names a dynamic combo adds for its chosen `key` (prefixed with its own name), nested ones expanded the
 *  same way: [{name, opts, dyn?}]. */
function dynChildren(prefix, options, key) {
  const opt = options.find((x) => String(x.key) === String(key)) || null;
  if (!opt) return [];
  const out = [];
  for (const group of ["required", "optional"]) {
    const g = opt.inputs && opt.inputs[group];
    if (!g || typeof g !== "object") continue;
    for (const k of Object.keys(g)) {
      const sub = dynOptions(g[k]);
      if (sub) out.push({ name: `${prefix}.${k}`, opts: {}, dyn: sub });
      else if (isWidgetSpec(g[k]) && !forced(g[k])) out.push({ name: `${prefix}.${k}`, opts: specOptions(g[k]), kind: specKind(g[k]) });
    }
  }
  return out;
}
/** names with every dynamic combo followed by its chosen option's widgets; the key is read from the saved values at
 *  that combo's place (or the first saved value that IS one of its keys) */
function expandDynamic(names, values) {
  if (!names.some((w) => w.dyn)) return names;
  const out = [];
  let vi = 0;
  const walk = (list) => {
    for (const w of list) {
      out.push(w);
      if (!w.dyn) { vi++; continue; }
      const keys = w.dyn.map((x) => String(x.key));
      let key = values[vi];
      if (!keys.includes(String(key))) { const hit = values.find((v) => keys.includes(String(v))); key = hit !== undefined ? hit : keys[0]; }
      vi++;
      walk(dynChildren(w.name, w.dyn, key));
    }
  };
  walk(names);
  return out;
}
/* 2.401.5: what a saved value must look like to belong to a widget - used to choose between the two value layouts
   below when the array's length cannot (a template saved before ComfyUI added a widget, Comfy-Org's LTX 2.5 ones:
   TextGenerateLTX2Prompt gained "mtp", so 12 saved values for 13 widgets, and the old walk shifted every value one
   place - "max_length: ''", "mtp: True not in list", CreateVideo "bit_depth: 24 not in ['auto', 8, 10]"). */
function specKind(spec) {
  const o = specOptions(spec);
  let t = Array.isArray(spec) ? spec[0] : spec && spec.type;
  if (typeof t === "string" && t.includes(",") && o.widgetType) t = o.widgetType;     // 2.402.1: "FLOAT,INT"
  if (Array.isArray(t)) return { t: "COMBO", list: t };
  const list = Array.isArray(o.options) ? o.options : Array.isArray(o.values) ? o.values
    : (spec && !Array.isArray(spec) && Array.isArray(spec.options)) ? spec.options : null;
  return { t: String(t || ""), list };
}
function fits(w, v) {
  if (w.dyn) return w.dyn.some((x) => String(x.key) === String(v));
  const k = w.kind || {};
  if (k.list) return k.list.some((x) => x === v || String(x) === String(v));
  if (k.t === "INT" || k.t === "FLOAT") return typeof v === "number";
  if (k.t === "BOOLEAN") return typeof v === "boolean";
  if (k.t === "STRING") return typeof v === "string";
  return true;
}
const forced = (spec) => !!specOptions(spec).forceInput;
/* 2.402.1: a widget the saved workflow predates (TextGenerateLTX2Prompt's mtp, CreateVideo's codec / color_space)
   gets its DEFAULT - what ComfyUI's own frontend sends when it loads such a workflow (checked against its
   graphToPrompt: the official LTX templates now convert identically). A combo without one takes its first option. */
function fillDefault(inputs, w) {
  const o = w.opts || {};
  if (o.default !== undefined) { inputs[w.name] = o.default; return; }
  if (Array.isArray(w.dyn) && w.dyn.length) { inputs[w.name] = w.dyn[0].key; return; }   // a dynamic combo: its first key
  const k = w.kind || {};
  if (Array.isArray(k.list) && k.list.length) inputs[w.name] = k.list[0];
}
function specOptions(spec) {
  if (Array.isArray(spec)) {
    return (spec[1] && typeof spec[1] === "object") ? spec[1] : {};
  }
  return (spec && typeof spec === "object") ? spec : {};   // object-form IS its options
}

/**
 * The ordered widget names for one node class, from /object_info.
 * `input_order` is authoritative when present (ComfyUI ships it precisely so a
 * client can rebuild the canvas order); otherwise key order is what the
 * canvas uses too.
 */
function widgetNames(classSpec) {
  if (!classSpec || typeof classSpec !== "object") return null;
  const inp = classSpec.input || {};
  const order = classSpec.input_order || {};
  const names = [];
  for (const group of ["required", "optional"]) {
    const g = inp[group];
    if (!g || typeof g !== "object") continue;
    const keys = Array.isArray(order[group]) && order[group].length
      ? order[group].filter((k) => k in g) : Object.keys(g);
    for (const k of keys) {
      const dyn = dynOptions(g[k]);
      if (dyn) names.push({ name: k, opts: {}, dyn });            // 2.401.5: a dynamic combo (expanded per node)
      // 2.401.5: a forceInput spec (TextGenerateLTX2Prompt's system_prompt) is a socket on the canvas, never a widget
      else if (isWidgetSpec(g[k]) && !forced(g[k])) names.push({ name: k, opts: specOptions(g[k]), kind: specKind(g[k]) });
    }
  }
  return names;
}

/** Both link shapes ComfyUI has shipped: the array and the object. */
function linkTable(ui) {
  const t = new Map();
  for (const l of (Array.isArray(ui.links) ? ui.links : [])) {
    if (Array.isArray(l) && l.length >= 5) {
      t.set(String(l[0]), { from: String(l[1]), slot: Number(l[2]), to: String(l[3]), toSlot: Number(l[4]), type: l[5] });
    } else if (l && typeof l === "object" && l.id !== undefined) {
      t.set(String(l.id), { from: String(l.origin_id), slot: Number(l.origin_slot),
                            to: String(l.target_id), toSlot: Number(l.target_slot), type: l.type });
    }
  }
  return t;
}

/**
 * Convert. Returns { graph, warnings, dropped, unknown }. Throws only when the
 * input is not a UI export at all — an unknown node class comes back in
 * `unknown` with `graph` null, so the caller can name the packs to install.
 */
function convert(ui, objectInfo) {
  let mathNote = "";
  if (!ui || typeof ui !== "object" || !Array.isArray(ui.nodes)) {
    const e = new Error("not a ComfyUI workflow: no `nodes` array");
    e.code = "not-ui"; throw e;
  }
  /* SUBGRAPHS AND Set/Get FIRST (2.126.0). Both are canvas conveniences with no
     entry in /object_info, so without this the rule below - an unknown class
     fails by name - would reject a folded workflow outright. lib/subgraphs.js
     is a no-op for a flat one, so nothing that worked before changed path. */
  const info = objectInfo && typeof objectInfo === "object" ? objectInfo : {};
  /* 2.401.2 (Tim: "comfy math nodes are no longer available ... Repository not found"): a custom math node this
     ComfyUI does not have (ComfyMath's CM_*, pysssss' MathExpression) becomes the CORE Math Expression
     (lib/mathNodes.js) - on a copy, before the flatten, so a subgraph's math is covered too. A ComfyUI that still
     has the pack keeps the node as exported. */
  const mathMissing = require("./mathNodes").leftover(ui).filter((t) => Object.keys(info).length && !(t in info));
  if (mathMissing.length) {
    ui = JSON.parse(JSON.stringify(ui));
    const done = require("./mathNodes").migrate(ui, new Set(mathMissing));
    if (done.length) mathNote = `${done.length} math node(s) (${mathMissing.join(", ")} - not in this ComfyUI) run as ComfyUI's core Math Expression`;
  }
  // 2.401.3: the same for a node swap (lib/nodeSwaps.js - MediaMixer's frame selectors -> KJNodes)
  const swapMissing = require("./nodeSwaps").leftover(ui).filter((t) => Object.keys(info).length && !(t in info)
    && (require("./nodeSwaps").TABLE[t].type in info));
  if (swapMissing.length) {
    if (!mathMissing.length) ui = JSON.parse(JSON.stringify(ui));
    const sw = require("./nodeSwaps").swap(ui, new Set(swapMissing));
    if (sw.length) mathNote = [mathNote, `${sw.length} node(s) (${swapMissing.join(", ")} - not in this ComfyUI) run as KJNodes GetImageRangeFromBatch`].filter(Boolean).join("; ");
  }
  const flat = subgraphs.flatten(ui);
  ui = flat.graph;
  const links = linkTable(ui);
  const nodes = new Map();
  for (const n of ui.nodes) if (n && n.id !== undefined) nodes.set(String(n.id), n);

  const warnings = flat.warnings.slice();
  const dropped = [];
  const unknown = new Set();
  for (const e of flat.expanded) dropped.push({ node: e.node, type: "subgraph", why: `expanded "${e.name}"` });

  // 1. Which nodes leave the graph, and what replaces each of their outputs.
  const gone = new Set();
  for (const [id, n] of nodes) {
    const type = String(n.type || "");
    const virtualHere = SOFT_DROP_TYPES.has(type) && !info[type];
    if (DROP_TYPES.has(type) || virtualHere || SKIP_MODES.has(Number(n.mode) || 0)) gone.add(id);
  }
  /** The value a PrimitiveNode hands to whatever it feeds. */
  const primitive = new Map();
  for (const [id, n] of nodes) {
    if (!String(n.type || "").startsWith("Primitive")) continue;
    const wv = Array.isArray(n.widgets_values) ? n.widgets_values
      : (n.widgets_values && typeof n.widgets_values === "object" ? Object.values(n.widgets_values) : []);
    primitive.set(id, wv.length ? wv[0] : null);
  }
  /** (dead node, output slot) -> the live source that takes its place. */
  const redirect = new Map();
  for (const id of gone) {
    const n = nodes.get(id);
    const byType = new Map();
    let only = null;
    for (const i of (Array.isArray(n.inputs) ? n.inputs : [])) {
      if (i && i.link !== null && i.link !== undefined && links.has(String(i.link))) {
        const l = links.get(String(i.link));
        byType.set(String(i.type), [l.from, l.slot]);
        if (!only) only = [l.from, l.slot];
      }
    }
    (Array.isArray(n.outputs) ? n.outputs : []).forEach((o, si) => {
      const hit = byType.get(String(o && o.type)) || (byType.size === 1 ? only : null);
      if (hit) redirect.set(id + ":" + si, hit);
    });
    dropped.push({ node: id, type: String(n.type || ""),
                   why: (DROP_TYPES.has(String(n.type || "")) || SOFT_DROP_TYPES.has(String(n.type || "")))
                     ? "pass-through" : "bypassed" });
  }
  /** Follow a chain of dead nodes to the first live producer. */
  function resolve(from, slot, hops = 0) {
    if (hops > 50) return null;                       // a cycle of bypassed nodes
    if (!gone.has(String(from))) return [String(from), Number(slot)];
    const hit = redirect.get(String(from) + ":" + Number(slot));
    return hit ? resolve(hit[0], hit[1], hops + 1) : null;
  }

  // 2. Every live node becomes an API entry.
  const out = {};
  for (const [id, n] of nodes) {
    if (gone.has(id)) continue;
    const type = String(n.type || "");
    const spec = info[type];
    const names0 = widgetNames(spec);
    if (!names0) { unknown.add(type); continue; }
    // 2.401.5: a dynamic combo's chosen option brings its own widgets (resize_type -> resize_type.width ...)
    const names = expandDynamic(names0, Array.isArray(n.widgets_values) ? n.widgets_values : []);

    // Widgets that were converted to inputs are not in widgets_values.
    const linked = new Set();
    const inputs = {};
    for (const i of (Array.isArray(n.inputs) ? n.inputs : [])) {
      if (!i || !i.name) continue;
      if (i.link === null || i.link === undefined || !links.has(String(i.link))) {
        if (i.widget) linked.add(String(i.name));      // converted but unplugged: no value either
        continue;
      }
      const l = links.get(String(i.link));
      linked.add(String(i.name));
      if (gone.has(l.from) && primitive.has(l.from)) { inputs[String(i.name)] = primitive.get(l.from); continue; }
      const src = resolve(l.from, l.slot);
      if (src) inputs[String(i.name)] = [src[0], src[1]];
      else warnings.push(`node ${id} (${type}): input "${i.name}" came from a bypassed node with nothing behind it`);
    }

    const wanted = names.filter((w) => !linked.has(w.name));
    let values = Array.isArray(n.widgets_values) ? n.widgets_values.slice() : [];
    if (!Array.isArray(n.widgets_values) && n.widgets_values && typeof n.widgets_values === "object") {
      // Some frontend versions write a NAMED object — the easy case.
      for (const w of wanted) if (w.name in n.widgets_values) inputs[w.name] = n.widgets_values[w.name];
      out[id] = { class_type: type, inputs, _meta: { title: String(n.title || type) } };
      continue;
    }
    /* 2.292.0 (Tim's card: "MiniMaxH3ReferenceToVideo input
       'ref_image_size': Value not in list ref_image_size: '' not in
       ['match', 'max']"): the modern frontend KEEPS a converted widget's
       value in widgets_values (the NativeAudio export's R2V node saves
       ['', 1344, 768, 124, 'max'] with prompt/width/height/length all
       linked). Walking only the unlinked names handed ref_image_size the
       PROMPT's stale '' - every render refused. When the array is long
       enough to hold every widget, it is POSITIONAL over all of them:
       a linked widget's value is consumed and skipped. A shorter array is
       the older shape (converted widgets omitted) and keeps the old walk. */
    const anyLinked = names.some((w) => linked.has(w.name));
    const walkAll = () => {           // positional over every widget, a linked one's slot consumed
      const got = {};
      let extraAll = Math.max(0, values.length - names.length), vj = 0, score = 0;
      for (const w of names) {
        if (vj >= values.length) break;
        const v = values[vj++];
        if (!linked.has(w.name)) { got[w.name] = v; if (fits(w, v)) score++; else score -= 2; }
        if (extraAll > 0 && w.opts && w.opts.control_after_generate) { vj++; extraAll--; }
      }
      return { got, vj, score };
    };
    const walkWanted = () => {        // the older shape: converted widgets left out of the array
      const got = {};
      let extra = values.length - wanted.length, vi = 0, score = 0;
      for (const w of wanted) {
        if (vi >= values.length) break;
        const v = values[vi++];
        got[w.name] = v; if (fits(w, v)) score++; else score -= 2;
        if (extra > 0 && w.opts && w.opts.control_after_generate) { vi++; extra--; }
      }
      return { got, vj: vi, score };
    };
    if (anyLinked) {
      const a = walkAll(), b = walkWanted();
      const useAll = a.score > b.score || (a.score === b.score && values.length >= names.length);
      const r = useAll ? a : b;
      if (useAll || values.length >= names.length || a.score !== b.score) {
        Object.assign(inputs, r.got);
        for (const w of (useAll ? names.filter((x) => !linked.has(x.name)) : wanted))
          if (!(w.name in r.got)) { warnings.push(`node ${id} (${type}): no saved value for "${w.name}" — its default is sent`); fillDefault(inputs, w); }
        if (r.vj < values.length)
          warnings.push(`node ${id} (${type}): ignored ${values.length - r.vj} UI-only widget value(s)`);
        out[id] = { class_type: type, inputs, _meta: { title: String(n.title || type) } };
        continue;
      }
    }
    let extra = values.length - wanted.length;
    let vi = 0;
    for (const w of wanted) {
      if (vi >= values.length) {
        warnings.push(`node ${id} (${type}): no saved value for "${w.name}" — its default is sent`);
        fillDefault(inputs, w);
        continue;
      }
      inputs[w.name] = values[vi++];
      // control_after_generate rides immediately behind its number and is
      // UI-only; consume it only when there is a spare value to consume.
      if (extra > 0 && w.opts && w.opts.control_after_generate) { vi++; extra--; }
    }
    if (vi < values.length) {
      // Trailing UI-only widgets (the "choose file" button on LoadImage, the
      // preview toggles some packs add). Not an error; worth a line.
      warnings.push(`node ${id} (${type}): ignored ${values.length - vi} UI-only widget value(s)`);
    }
    out[id] = { class_type: type, inputs, _meta: { title: String(n.title || type) } };
  }

  if (unknown.size) {
    if (mathNote) warnings.unshift(mathNote);
    return { graph: null, warnings, dropped, unknown: [...unknown].sort() };
  }
  if (mathNote) warnings.unshift(mathNote);
  return { graph: out, warnings, dropped, unknown: [] };
}

module.exports = { convert, widgetNames, isWidgetSpec, linkTable, expandDynamic, dynOptions,
                   WIDGET_TYPES, DROP_TYPES, SOFT_DROP_TYPES, SKIP_MODES };
