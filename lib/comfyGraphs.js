"use strict";
/**
 * comfyGraphs.js — WIRING A COMFYUI GRAPH TO H3 STUDIO'S INPUTS (2.120.0,
 * by instruction).
 *
 * Tim: "create a tab in settings-comfyui called graphs. have an input with a
 * file selector to load a workflow. check to see if it is an api workflow,
 * create a button to export the workflow as api, create 2 lists, one with all
 * the api inputs that can be changed and the other to add input types (toggle
 * switch, dropdown, text input, slider (allow user to create range), spinner.
 * then allow user to link the inputs to the comfy nodes by dragging a line
 * from the input to the node value. these settings will be shown in basic
 * settings when the workflow type is selected for use."
 *
 * THE MODEL. A *graph binding* is one file at `graphs/<name>.json` — same
 * doctrine as styles/: one readable file per thing, browsable, hand-editable,
 * copyable between installs. It names a workflow in `comfy_workflows/` and a
 * list of CONTROLS. A control is a widget the user drew (toggle / dropdown /
 * text / slider / spinner), and each control carries the list of NODE INPUTS
 * it writes to. One control may drive several inputs (one "Steps" slider into
 * two samplers is the normal case in a two-phase graph), which is why
 * `targets` is a list and not a pair of fields.
 *
 *   { "id": "...", "name": "My upscaler", "file": "comfy_workflows/up.json",
 *     "kind": "image",
 *     "controls": [
 *       { "id": "c1", "type": "slider", "label": "Steps", "default": 20,
 *         "min": 1, "max": 60, "step": 1,
 *         "targets": [{ "node": "12", "input": "steps" }] },
 *       { "id": "c2", "type": "toggle", "label": "Tiled VAE",
 *         "on": true, "off": false, "default": false,
 *         "targets": [{ "node": "9", "input": "tile" }] }
 *     ] }
 *
 * WHY THE VALUES ARE NOT IN THIS FILE. A control has a `default`; what the
 * user actually picked for the next render is sent with the job. A binding is
 * the WIRING, not a saved render — the same separation as a style (the recipe)
 * versus Basic Settings (this press).
 *
 * WHAT COUNTS AS A "CHANGEABLE API INPUT". In an API prompt a node's inputs
 * are either a LINK (`[from_node_id, slot]` — an array, drawn by ComfyUI's
 * canvas and not ours to touch) or a WIDGET VALUE (a number, string or
 * boolean). Only the second kind can be wired to a control, so `apiInputs()`
 * returns exactly those. Refusing to bind a link is not a limitation: writing
 * a scalar over a link would disconnect the graph, and ComfyUI would reject
 * the prompt with a type error nobody could read back to this screen.
 *
 * NEVER THROWS on read. A hand-dropped file with a syntax error costs that one
 * file, exactly like styles.js — a graphs folder is user content and one bad
 * file must not empty the dropdown.
 */
const fs = require("fs");
const path = require("path");
// fileStem / newId live in styles.js and are reused rather than re-written:
// the traversal, reserved-name and separator rules for "a user-named thing
// that becomes a filename" must have ONE implementation (see styles.js).
const { fileStem, newId } = require("./styles");

const TYPES = ["toggle", "dropdown", "text", "slider", "spinner"];
/** Which Generate mode a binding belongs to. "any" shows in every mode. */
const KINDS = ["any", "image", "video", "music"];
/** Inputs whose value is a LINK cannot be wired — see the header. */
const isLink = (v) => Array.isArray(v) && v.length === 2
  && (typeof v[0] === "string" || typeof v[0] === "number");

/* ---------------------------------------------------------------- format --
   An API prompt is `{ "<node id>": { class_type, inputs } }`. A UI export is
   `{ nodes: [...], links: [...] }` — what "Save" writes, and what ComfyUI's
   "Export (API)" turns into the former. Telling them apart is the first thing
   the Graphs tab does, because every other operation depends on the answer. */
function isApi(graph) {
  if (!graph || typeof graph !== "object" || Array.isArray(graph)) return false;
  const keys = Object.keys(graph);
  if (!keys.length) return false;
  return keys.every((k) => {
    const n = graph[k];
    return n && typeof n === "object" && !Array.isArray(n)
      && typeof n.class_type === "string";
  });
}
function isUi(graph) {
  return !!graph && typeof graph === "object" && Array.isArray(graph.nodes);
}
function format(graph) {
  if (isApi(graph)) return "api";
  if (isUi(graph)) return "ui";
  return "unknown";
}

/** Every widget value in an API prompt, as wiring targets. */
function apiInputs(graph) {
  if (!isApi(graph)) return [];
  const out = [];
  for (const node of Object.keys(graph).sort((a, b) => Number(a) - Number(b) || a.localeCompare(b))) {
    const n = graph[node] || {};
    const inputs = n.inputs && typeof n.inputs === "object" ? n.inputs : {};
    const title = (n._meta && n._meta.title) || n.class_type;
    for (const input of Object.keys(inputs)) {
      const value = inputs[input];
      if (isLink(value)) continue;
      if (value !== null && typeof value === "object") continue;   // nested config, not a widget
      out.push({ node: String(node), class_type: String(n.class_type || ""),
                 title: String(title || ""), input: String(input), value,
                 value_type: typeof value });
    }
  }
  return out;
}

/** Nodes of an API prompt, for the wiring canvas' left-hand column. */
function apiNodes(graph) {
  if (!isApi(graph)) return [];
  return Object.keys(graph)
    .sort((a, b) => Number(a) - Number(b) || a.localeCompare(b))
    .map((id) => ({ node: String(id), class_type: String(graph[id].class_type || ""),
                    title: String((graph[id]._meta && graph[id]._meta.title) || graph[id].class_type || "") }));
}

/** Everything the Graphs tab needs to draw one loaded file. Never throws. */
function analyze(graph) {
  const fmt = format(graph);
  if (fmt !== "api") {
    return { format: fmt, api: false, nodes: [], inputs: [], loaders: [], node_count: fmt === "ui" ? (graph.nodes || []).length : 0,
             note: fmt === "ui"
               ? "This is a ComfyUI UI export (a saved workflow), not an API prompt. Press “Export as API” to convert it."
               : "Not a ComfyUI workflow: expected either an API prompt (node id → class_type) or a UI export (nodes + links)." };
  }
  const nodes = apiNodes(graph);
  // 2.121.0: the loaders are reported too, so the Graphs tab can mark the
  // values the reference dock fills rather than inviting a control for them.
  return { format: "api", api: true, nodes, inputs: apiInputs(graph),
           loaders: loaderNodes(graph), node_count: nodes.length, note: "" };
}

/* --------------------------------------------------------------- controls */
function numOrNull(v) {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return isFinite(n) ? n : null;
}
function targets(list) {
  const seen = new Set();
  return (Array.isArray(list) ? list : [])
    .map((t) => ({ node: String((t && t.node) ?? "").trim(), input: String((t && t.input) ?? "").trim() }))
    .filter((t) => {
      if (!t.node || !t.input) return false;
      const k = t.node + "\u0000" + t.input;
      if (seen.has(k)) return false;                 // one control, one wire per input
      seen.add(k);
      return true;
    });
}

/**
 * Junk in, a usable control out. The RANGE IS THE USER'S (Tim asked for a
 * slider "allow user to create range"), so min/max/step are kept as given and
 * only ordered — a slider from 60 down to 1 is a typo, not a feature, and
 * swapping is friendlier than refusing.
 */
function normalizeControl(input, i = 0) {
  const c = input && typeof input === "object" ? input : {};
  const type = TYPES.includes(String(c.type)) ? String(c.type) : "text";
  const out = {
    id: String(c.id || "").trim() || `c${i + 1}_${newId().slice(0, 6)}`,
    type,
    label: String(c.label ?? "").trim() || `Input ${i + 1}`,
    hint: String(c.hint ?? "").trim(),
    targets: targets(c.targets),
  };
  // 2.587.0 (lib/graphCheck.js - an imported workflow's controls): where an EMPTY value comes from at run time -
  // prompt = the prompt box, negative = the negative prompt, seed = Basic Settings' seed (routes/index.js /api/graphs/run)
  if (["prompt", "negative", "seed"].includes(String(c.source || ""))) out.source = String(c.source);
  if (type === "toggle") {
    out.on = c.on === undefined ? true : c.on;
    out.off = c.off === undefined ? false : c.off;
    out.default = c.default === undefined ? false : !!c.default;
  } else if (type === "dropdown") {
    out.options = (Array.isArray(c.options) ? c.options : [])
      .map((o) => (o && typeof o === "object")
        ? { label: String(o.label ?? o.value ?? ""), value: o.value === undefined ? String(o.label ?? "") : o.value }
        : { label: String(o), value: o })
      .filter((o) => o.label !== "");
    const first = out.options.length ? out.options[0].value : "";
    out.default = c.default === undefined ? first : c.default;
  } else if (type === "slider" || type === "spinner") {
    let min = numOrNull(c.min); let max = numOrNull(c.max);
    if (min === null) min = 0;
    if (max === null) max = type === "slider" ? 100 : 1000000;
    if (min > max) { const t = min; min = max; max = t; }
    out.min = min; out.max = max;
    const step = numOrNull(c.step);
    out.step = step === null || step <= 0 ? 1 : step;
    const d = numOrNull(c.default);
    // Zero is a legitimate default and `d || min` would eat it — the LoRA
    // weight slider trap (0.75 -> 0 via `+v || default`), paid for once.
    out.default = d === null ? min : Math.max(min, Math.min(max, d));
  } else {
    out.default = c.default === undefined ? "" : String(c.default);
    out.multiline = !!c.multiline;
  }
  return out;
}

/** The value a control's raw UI value becomes in the graph. */
function coerce(control, raw) {
  const c = normalizeControl(control);
  if (c.type === "toggle") {
    const on = raw === undefined || raw === null ? c.default
      : (raw === true || raw === "true" || raw === 1 || raw === "1" || raw === "on");
    return on ? c.on : c.off;
  }
  if (c.type === "slider" || c.type === "spinner") {
    const n = numOrNull(raw);
    if (n === null) return c.default;
    return Math.max(c.min, Math.min(c.max, n));
  }
  if (c.type === "dropdown") {
    if (raw === undefined || raw === null || raw === "") return c.default;
    const hit = c.options.find((o) => String(o.value) === String(raw));
    return hit ? hit.value : c.default;
  }
  return raw === undefined || raw === null ? c.default : String(raw);
}

/* ------------------------------------------------------------------ store */
/** THE field list for a binding. The route must never hand-copy fields. */
function normalize(input) {
  const b = input && typeof input === "object" ? input : {};
  const name = String(b.name ?? "").trim();
  if (!name) { const e = new Error("a graph needs a name"); e.code = "no-name"; throw e; }
  const file = String(b.file ?? "").trim().replace(/\\/g, "/");
  const kind = KINDS.includes(String(b.kind)) ? String(b.kind) : "any";
  return {
    id: String(b.id || "").trim() || newId(),
    name,
    file,
    kind,
    notes: String(b.notes ?? "").trim(),
    controls: (Array.isArray(b.controls) ? b.controls : []).map(normalizeControl),
    created: Number(b.created) || Date.now(),
    updated: Date.now(),
  };
}

function fileFor(dir, name) { return path.join(dir, fileStem(name) + ".json"); }
/** A hand-dropped file with no id gets a STABLE one, so a saved pick sticks. */
function idForFile(stem) {
  let h = 0;
  for (let i = 0; i < stem.length; i++) h = (h * 31 + stem.charCodeAt(i)) >>> 0;
  return "g" + h.toString(36);
}

function read(dir, kind) {
  let names = [];
  try { names = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".json")); } catch { return []; }
  const out = [];
  for (const f of names.sort()) {
    let raw;
    try { raw = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")); } catch { continue; }
    if (!raw || typeof raw !== "object") continue;
    const stem = f.replace(/\.json$/i, "");
    raw.name = raw.name || stem;
    raw.id = raw.id || idForFile(stem);
    let g;
    try { g = normalize(raw); } catch { continue; }
    g.updated = Number(raw.updated) || g.created;
    g._file = f;
    out.push(g);
  }
  return kind && KINDS.includes(kind)
    ? out.filter((g) => g.kind === kind || g.kind === "any")
    : out;
}

function byId(dir, id) { return read(dir).find((g) => g.id === String(id)) || null; }

function save(dir, input) {
  const g = normalize(input);
  fs.mkdirSync(dir, { recursive: true });
  const dest = fileFor(dir, g.name);
  // NAME = FILENAME, ID = KEY (styles doctrine): a rename MOVES the file and
  // keeps the identity, and a name already taken by ANOTHER binding is
  // refused rather than overwritten — 409, never silent data loss.
  const clash = read(dir).find((x) => x.id !== g.id
    && path.join(dir, x._file) === dest);
  if (clash) { const e = new Error(`a graph named "${g.name}" already exists`); e.code = "duplicate-name"; throw e; }
  const prev = read(dir).find((x) => x.id === g.id);
  if (prev && path.join(dir, prev._file) !== dest) {
    try { fs.unlinkSync(path.join(dir, prev._file)); } catch { /* gone already */ }
  }
  const { _file, ...body } = g;
  fs.writeFileSync(dest, JSON.stringify(body, null, 2));
  g._file = path.basename(dest);
  return g;
}

function remove(dir, id) {
  const g = byId(dir, id);
  if (!g) return null;
  try { fs.unlinkSync(path.join(dir, g._file)); } catch { /* already gone */ }
  return read(dir);
}

/* ------------------------------------------------------------------ apply */
/**
 * Write the user's control values into an API prompt. PURE — takes a graph,
 * returns a NEW graph — so the same function runs in a unit test, in the route
 * that previews the patch, and in graph_worker.py's Node-free sibling has
 * nothing to drift from: there is only this one.
 *
 * A target whose node or input is not in the graph is REPORTED, not silently
 * skipped: a workflow re-exported with different node ids is the normal way a
 * binding goes stale, and the user needs to be told which wire broke rather
 * than watching a render come back with the old value.
 */
function apply(graph, binding, values) {
  const warnings = [];
  const applied = [];
  if (!isApi(graph)) return { graph, applied, warnings: ["not an API workflow — nothing was patched"] };
  const out = JSON.parse(JSON.stringify(graph));
  const b = binding && typeof binding === "object" ? binding : { controls: [] };
  const vals = values && typeof values === "object" ? values : {};
  for (const rawC of (Array.isArray(b.controls) ? b.controls : [])) {
    const c = normalizeControl(rawC);
    const v = coerce(c, vals[c.id]);
    if (!c.targets.length) { warnings.push(`"${c.label}" is not wired to anything`); continue; }
    for (const t of c.targets) {
      const node = out[t.node];
      if (!node) { warnings.push(`"${c.label}" → node ${t.node} is not in this workflow`); continue; }
      node.inputs = node.inputs || {};
      if (!(t.input in node.inputs)) {
        warnings.push(`"${c.label}" → ${node.class_type} (${t.node}) has no input "${t.input}"`);
        continue;
      }
      if (isLink(node.inputs[t.input])) {
        warnings.push(`"${c.label}" → ${t.node}.${t.input} is connected to another node; left alone`);
        continue;
      }
      node.inputs[t.input] = v;
      applied.push({ node: t.node, input: t.input, value: v, control: c.id, label: c.label });
    }
  }
  return { graph: out, applied, warnings };
}

/** 2.587.0: the values of controls with a `source` (an imported workflow's Prompt / Negative / Seed) - an empty value
 *  takes the prompt box's text, the negative prompt, bitGen's seed (pure) -> a new values object */
function fillSources(binding, values, src) {
  const out = Object.assign({}, values || {});
  const S = src || {};
  for (const raw of ((binding && binding.controls) || [])) {
    const c = normalizeControl(raw);
    if (!c.source) continue;
    const v = out[c.id];
    const empty = v === undefined || v === null || String(v).trim() === "";
    if (c.source === "seed") { if (S.seed != null && Number(S.seed) >= 0) out[c.id] = Number(S.seed); }
    else if (empty && S[c.source] != null && String(S[c.source]).trim()) out[c.id] = String(S[c.source]);
  }
  return out;
}

/** Which wires no longer resolve against a workflow — the staleness check. */
function validate(graph, binding) {
  const { warnings } = apply(graph, binding, {});
  return warnings;
}

/* ------------------------------------------------- loaders and the dock ----
 * Tim: "load image/load video/load sound node types will get the files from
 * the reference docker, if there are unused 'load' nodes bypass them".
 *
 * A wired graph's LoadImage / LoadVideo / LoadAudio nodes are not something the
 * user should have to make a control for: the app already has a reference dock,
 * and that is where the pictures, clips and sound for a render live. So the
 * loaders are filled from it automatically, IN NODE-ID ORDER — the same rule
 * worker.py uses for the H3 templates, and the same order ComfyUI itself
 * numbers them in, so "the first LoadImage gets the first picture" is a
 * sentence the user can predict without opening anything.
 *
 * AN UNUSED LOADER IS REMOVED, not left pointing at whatever filename the
 * workflow was exported with. That is what Ctrl+B means in ComfyUI and what a
 * graph with three LoadImage slots and one picture in the dock has to do:
 * leaving it would send ComfyUI a request for a file from someone else's
 * machine, and the render fails with a filename nobody recognises. Consumers of
 * a removed loader are rewired transitively through anything behind it, and
 * when there is nothing behind it — the normal case, a loader is a source —
 * the consumer's input key is DROPPED rather than left dangling, because an
 * empty value fails ComfyUI's validation while an absent optional input does
 * not.
 *
 * A LOADER THE USER WIRED A CONTROL TO IS LEFT ALONE. If someone built a
 * dropdown of filenames and pointed it at `image`, that is a deliberate choice
 * and the dock must not overrule it; it also counts as USED, so it is never
 * bypassed.
 */
const LOADERS = {
  LoadImage: { kind: "images", keys: ["image"] },
  LoadImageMask: { kind: "images", keys: ["image"] },
  LoadImageOutput: { kind: "images", keys: ["image"] },
  ImageBatchLoader: { kind: "images", keys: ["image"] },
  LoadVideo: { kind: "videos", keys: ["file", "video"] },
  VHS_LoadVideo: { kind: "videos", keys: ["video", "file"] },
  VHS_LoadVideoPath: { kind: "videos", keys: ["video", "file"] },
  LoadAudio: { kind: "audio", keys: ["audio", "file"] },
  VHS_LoadAudio: { kind: "audio", keys: ["audio", "file"] },
  LoadAudioUpload: { kind: "audio", keys: ["audio", "file"] },
  VHS_LoadAudioUpload: { kind: "audio", keys: ["audio", "file"] },     // 2.587.0: the VHS pack's audio upload (MM3_Characters)
};
const REF_KINDS = ["images", "videos", "audio"];

/**
 * Every loader in an API prompt, in node-id order, with the input key that
 * holds its filename. A loader whose filename input is a LINK is skipped: it is
 * being fed by another node, so it is not ours to fill.
 */
function loaderNodes(graph) {
  if (!isApi(graph)) return [];
  const out = [];
  for (const node of Object.keys(graph).sort((a, b) => Number(a) - Number(b) || a.localeCompare(b))) {
    const n = graph[node] || {};
    const spec = LOADERS[n.class_type];
    if (!spec) continue;
    const inputs = n.inputs && typeof n.inputs === "object" ? n.inputs : {};
    const key = spec.keys.find((k) => k in inputs && !isLink(inputs[k]));
    if (!key) continue;
    out.push({ node: String(node), class_type: String(n.class_type), kind: spec.kind, input: key });
  }
  return out;
}

/** Delete nodes and rewire their consumers; a source with nothing behind it
 *  drops the consumer's input key rather than leaving an empty value. */
function removeNodes(graph, dead) {
  const gone = new Set(dead.map(String));
  const resolve = (id, slot, seen) => {
    const s = seen || new Set();
    if (!gone.has(String(id))) return [String(id), Number(slot)];
    if (s.has(String(id))) return null;               // a cycle of dead nodes
    s.add(String(id));
    // Anything behind this node of a matching shape takes its place. A loader
    // has nothing behind it, so this is null and the input is dropped.
    const ins = (graph[id] || {}).inputs || {};
    for (const v of Object.values(ins)) if (isLink(v)) return resolve(v[0], v[1], s);
    return null;
  };
  for (const id of gone) delete graph[id];
  for (const n of Object.values(graph)) {
    const ins = n.inputs;
    if (!ins || typeof ins !== "object") continue;
    for (const [k, v] of Object.entries(ins)) {
      if (!isLink(v) || !gone.has(String(v[0]))) continue;
      const src = resolve(v[0], v[1]);
      if (src) ins[k] = src; else delete ins[k];
    }
  }
  return graph;
}

/**
 * Fill the loaders from the reference dock and bypass the ones left over.
 * PURE — returns a new graph.
 *
 * @param refs  { images: [...], videos: [...], audio: [...] } — anything with a
 *              `name` (what to write) is enough; entries may be plain strings.
 * @param keep  Set of "node.input" the user wired a control to; left untouched.
 * @returns { graph, assigned, bypassed, warnings }
 */
function assignRefs(graph, refs, keep) {
  const warnings = [];
  const assigned = [];
  const bypassed = [];
  if (!isApi(graph)) return { graph, assigned, bypassed, warnings: ["not an API workflow — no loaders were filled"] };
  const out = JSON.parse(JSON.stringify(graph));
  const held = keep instanceof Set ? keep : new Set(Array.isArray(keep) ? keep : []);
  const pool = {};
  for (const k of REF_KINDS) {
    const list = (refs && refs[k]) || [];
    pool[k] = (Array.isArray(list) ? list : [])
      .map((x) => (x && typeof x === "object" ? x : { name: String(x), path: String(x) }))
      .filter((x) => x.name);
  }
  const loaders = loaderNodes(out);
  const dead = [];
  for (const kind of REF_KINDS) {
    const mine = loaders.filter((l) => l.kind === kind);
    let i = 0;
    for (const l of mine) {
      if (held.has(l.node + "." + l.input)) continue;   // the user wired this one
      const ref = pool[kind][i];
      if (!ref) { dead.push(l.node); bypassed.push({ ...l, why: "nothing in the reference dock for it" }); continue; }
      i += 1;
      out[l.node].inputs[l.input] = ref.name;
      assigned.push({ ...l, name: ref.name, path: ref.path || ref.name, index: i - 1 });
    }
    if (pool[kind].length > i) {
      warnings.push(`the dock has ${pool[kind].length} ${kind} but this workflow has ${i} slot(s) for them — the rest were not used`);
    }
  }
  if (dead.length) removeNodes(out, dead);
  return { graph: out, assigned, bypassed, warnings };
}

module.exports = {
  TYPES, KINDS, isLink, isApi, isUi, format, analyze, apiInputs, apiNodes,
  normalizeControl, normalize, coerce, apply, validate,
  LOADERS, REF_KINDS, loaderNodes, removeNodes, assignRefs,
  read, byId, save, remove, fileFor, idForFile, numOrNull, fillSources,
};
