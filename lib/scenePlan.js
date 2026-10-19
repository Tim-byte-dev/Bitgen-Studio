/* bitGen Studio — lib/scenePlan.js (2.404.0): THE LLM LAYS OUT A 3D SCENE - as a small JSON plan, never as code.
 *
 * Tim (verbatim): "is it possible for our llm to use blender to create 3d models?" -> "can we add option 1 + the image
 * to workflow?". Option 1: the local LLM answers a JSON plan (objects of known kinds, sizes in metres, moves, a camera
 * path); clean() makes any model's answer safe and complete; scripts/blend_build.py builds it in Blender. Objects no
 * kind fits (an animal, a statue, a hero vehicle) are kind "model" with a "describe" - lib/sceneAI.js draws a picture
 * of each and turns it into a .glb (lib/mesh3d.js) before the build.
 *   messages(prompt, o)  the chat to send (system + user) - the plan's shape, the kinds, one worked example
 *   parse(text)          the first JSON object in a reply (think blocks, fences, trailing commas, // comments seen
 *                        through) -> object | null
 *   clean(plan, o)       -> a complete plan (see scripts/blend_build.py) + notes; o = {seconds, width, height,
 *                        maxModels, models (false = no image-to-3D: stand-ins)}
 * Axes are Blender's: metres, Z up, the ground at z = 0, the camera starts on -Y looking toward +Y, an object's front
 * faces -Y at turn 0. */
"use strict";

// the kinds scripts/blend_build.py draws (its KINDS + ALIASES - scripts/test-sceneplan.js keeps them in step)
const KINDS = ["box", "cube", "sphere", "ball", "cylinder", "cone", "plane", "torus", "pyramid", "car", "truck", "bus",
  "bicycle", "boat", "tree", "pine", "palm", "bush", "flower", "rock", "mountain", "lamp_post", "street_light",
  "traffic_light", "sign", "bench", "table", "chair", "sofa", "bed", "desk", "shelf", "tv", "lamp", "door", "window",
  "wall", "fence", "stairs", "house", "building", "tower", "road", "sidewalk", "water", "pool", "bridge", "arch",
  "pillar", "statue", "barrel", "crate", "person", "child", "dog", "cat", "horse", "bird"];
const ALIASES = { streetlight: "lamp_post", lamppost: "lamp_post", skyscraper: "building", tower_block: "building",
  column: "pillar", box_crate: "crate", vehicle: "car", suv: "car", van: "truck", human: "person", man: "person",
  woman: "person", character: "person", cupboard: "shelf", bookshelf: "shelf", monitor: "tv", hill: "mountain",
  lake: "water", river: "water", ground: "plane", floor: "plane", pavement: "sidewalk" };
const SPECIAL = ["model", "asset"];
// a sensible size [w, d, h] (m) for a kind the plan gave none
const SIZES = { car: [1.8, 4.4, 1.5], truck: [2.4, 7, 3], bus: [2.5, 11, 3.2], bicycle: [0.6, 1.7, 1.1], boat: [2.5, 6, 2],
  tree: [3, 3, 5], pine: [2.5, 2.5, 7], palm: [3, 3, 7], bush: [1.2, 1.2, 1], flower: [0.3, 0.3, 0.5], rock: [1.2, 1, 0.8],
  mountain: [60, 60, 30], lamp_post: [0.4, 1.2, 5], street_light: [0.4, 1.2, 5], traffic_light: [0.5, 0.5, 4],
  sign: [1.2, 0.1, 2.5], bench: [1.6, 0.6, 0.9], table: [1.6, 0.9, 0.75], chair: [0.5, 0.5, 0.95], sofa: [2.2, 0.9, 0.9],
  bed: [1.6, 2.1, 1], desk: [1.4, 0.7, 0.75], shelf: [1, 0.35, 1.9], tv: [1.2, 0.1, 0.7], lamp: [0.4, 0.4, 1.6],
  door: [1, 0.1, 2.1], window: [1.2, 0.1, 1.2], wall: [6, 0.25, 3], fence: [4, 0.1, 1.2], stairs: [1.5, 3, 1.8],
  house: [8, 7, 6], building: [12, 12, 30], tower: [5, 5, 25], road: [7, 60, 0.02], sidewalk: [2.5, 60, 0.15],
  water: [20, 20, 0.05], pool: [4, 8, 0.3], bridge: [5, 20, 4], arch: [4, 1, 4], pillar: [0.6, 0.6, 4],
  statue: [1, 1, 2.5], barrel: [0.6, 0.6, 0.9], crate: [0.8, 0.8, 0.8], person: [0.5, 0.3, 1.75], child: [0.4, 0.25, 1.2],
  dog: [0.35, 0.9, 0.65], cat: [0.2, 0.5, 0.3], horse: [0.7, 2.2, 1.7], bird: [0.25, 0.3, 0.2], plane: [10, 10, 0.01],
  torus: [1, 1, 0.3], model: [1, 1, 1] };
const MAX_OBJECTS = 80;

const num = (v, d) => (Number.isFinite(+v) ? +v : d);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const vec = (a, n, d, lo, hi) => {
  if (!Array.isArray(a)) return d.slice();
  const out = [];
  for (let i = 0; i < n; i++) out.push(clamp(num(a[i], d[i]), lo, hi));
  return out;
};
const COLOR = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const NAMED = ["red", "blue", "green", "yellow", "orange", "purple", "pink", "white", "black", "grey", "gray", "brown",
  "silver", "gold", "beige", "teal", "navy", "dark", "wood", "skin", "glass", "metal", "leaf", "asphalt", "concrete",
  "sand", "water", "brick", "stone", "grass"];
const color = (c) => { const s = String(c || "").trim().toLowerCase(); return COLOR.test(s) || NAMED.includes(s) ? s : null; };

function kindOf(k) {
  const s = String(k || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (KINDS.includes(s) || SPECIAL.includes(s)) return s;
  if (ALIASES[s]) return ALIASES[s];
  const plural = s.replace(/s$/, "");
  if (KINDS.includes(plural)) return plural;
  return null;
}
/** a stand-in kind for a "model" object from its words (a dog -> dog) */
function likeOf(words) {
  const w = String(words || "").toLowerCase();
  for (const k of KINDS.concat(Object.keys(ALIASES))) if (new RegExp(`\\b${k.replace(/_/g, "[ _]")}s?\\b`).test(w)) return kindOf(k);
  return "box";
}

const EXAMPLE = {
  title: "Rainy street at dusk", seconds: 5, sky: "#5d6b7d", ground: { size: 60, color: "grass" },
  sun: { elevation: 12, azimuth: 250, strength: 1.5, color: "#ffc58a" },
  objects: [
    { name: "Street", kind: "road", at: [0, 10, 0], size: [7, 60, 0.02] },
    { name: "Taxi", kind: "car", color: "yellow", at: [-1.7, 22, 0], size: [1.8, 4.5, 1.5], turn: 0,
      moves: [{ t: 0, at: [-1.7, 22, 0] }, { t: 5, at: [-1.7, 2, 0] }] },
    { name: "Shop", kind: "building", color: "brick", at: [-9, 14, 0], size: [8, 10, 9], turn: 90 },
    { name: "Lamp 1", kind: "lamp_post", at: [4, 8, 0] },
    { name: "Woman", kind: "person", color: "red", at: [4.5, 5, 0], turn: 200 },
    { name: "Dog", kind: "model", describe: "a small brown terrier standing, side view", at: [5.2, 5, 0], size: [0.3, 0.7, 0.5] },
  ],
  camera: { lens: 32, keys: [{ t: 0, at: [1, -8, 1.6], look: [0, 10, 1.4] }, { t: 5, at: [2.5, -3, 1.6], look: [1, 12, 1.4] }] },
};

/** the chat for a plan. o = {seconds, maxModels, models} */
function messages(prompt, o) {
  const x = o || {};
  const maxModels = x.models === false ? 0 : clamp(Math.round(num(x.maxModels, 4)), 0, 8);
  const sys = [
    "BITGEN_SCENE_PLAN. You lay out 3D scenes for Blender. Reply with ONLY one JSON object - no prose, no code fence.",
    "Units are metres. Z is up and the ground is z = 0. The camera starts on the -y side looking toward +y.",
    "Each object: \"name\" (unique), \"kind\", \"at\" [x, y, z] = where its base stands, \"size\" [width x, depth y, height z]"
      + " (real sizes: a car 1.8 x 4.5 x 1.5, a person 0.5 x 0.3 x 1.75, a door 1 x 0.1 x 2.1), \"turn\" = degrees around"
      + " the vertical axis (0 = its front faces -y, toward the camera), \"color\" (#rrggbb or a simple name).",
    "kind is one of: " + KINDS.join(", ") + ".",
    maxModels
      ? `For an important detailed thing no kind fits (an animal, a statue, a special vehicle, a character, a prop) use kind "model" and "describe" = what it looks like (one line, for a picture). At most ${maxModels} "model" objects.`
      : "Do not use kind \"model\" - pick the nearest kind.",
    "Something that moves gets \"moves\": [{\"t\": seconds, \"at\": [x, y, z], \"turn\": degrees}] - the first at t 0, the last at the end.",
    "\"camera\": {\"lens\": mm (24 wide ... 85 close), \"keys\": [{\"t\": seconds, \"at\": [x, y, z], \"look\": [x, y, z] (the point it aims at)}]}.",
    "Also \"title\", \"seconds\", \"sky\" (a colour), \"ground\" {\"size\", \"color\"} or null, \"sun\" {\"elevation\", \"azimuth\", \"strength\"}.",
    "Keep the scene within about 40 m of the origin and in front of the camera. Use as many objects as the scene needs (up to 40).",
    "Example:",
    JSON.stringify(maxModels ? EXAMPLE : { ...EXAMPLE, objects: EXAMPLE.objects.map((ob) => (ob.kind === "model" ? { ...ob, kind: "dog", describe: undefined } : ob)) }),
  ].join("\n");
  const secs = clamp(Math.round(num(x.seconds, 5)), 1, 30);
  return [{ role: "system", content: sys },
          { role: "user", content: `Scene: ${String(prompt || "").trim()}\nLength: ${secs} seconds.\nReply with ONLY the JSON.` }];
}

/** the first balanced {...} in a reply -> object | null */
function parse(text) {
  let t = String(text || "").replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/```(?:json)?/gi, "");
  const i = t.indexOf("{");
  if (i < 0) return null;
  let depth = 0, inStr = false, esc = false, end = -1;
  for (let k = i; k < t.length; k++) {
    const ch = t[k];
    if (inStr) { if (esc) esc = false; else if (ch === "\\") esc = true; else if (ch === "\"") inStr = false; continue; }
    if (ch === "\"") inStr = true;
    else if (ch === "{") depth++;
    else if (ch === "}") { depth--; if (depth === 0) { end = k; break; } }
  }
  if (end < 0) return null;
  const raw = t.slice(i, end + 1);
  const tries = [raw,
    raw.replace(/\/\/[^\n"]*$/gm, "").replace(/,\s*([}\]])/g, "$1"),
    raw.replace(/\/\/[^\n"]*$/gm, "").replace(/,\s*([}\]])/g, "$1").replace(/\bTrue\b/g, "true").replace(/\bFalse\b/g, "false").replace(/\bNone\b/g, "null")];
  for (const s of tries) { try { const v = JSON.parse(s); if (v && typeof v === "object" && !Array.isArray(v)) return v; } catch { /* next */ } }
  return null;
}

/** a complete, safe plan. -> {plan, notes} */
function clean(p0, o) {
  const x = o || {};
  const p = p0 && typeof p0 === "object" ? p0 : {};
  const notes = [];
  const seconds = clamp(num(x.seconds, num(p.seconds, 5)), 1, 30);
  const maxModels = x.models === false ? 0 : clamp(Math.round(num(x.maxModels, 4)), 0, 8);
  const plan = {
    title: String(p.title || x.title || "AI scene").replace(/[\r\n]+/g, " ").slice(0, 60),
    seconds, fps: 24,
    width: clamp(Math.round(num(x.width, 1280)), 256, 4096), height: clamp(Math.round(num(x.height, 704)), 256, 4096),
    sky: color(p.sky) || "#a9c4dc",
    ground: p.ground === null || p.ground === false ? null
      : { size: clamp(num((p.ground || {}).size, 60), 5, 1000), color: color((p.ground || {}).color) || "grass" },
    sun: { elevation: clamp(num((p.sun || {}).elevation, 45), -10, 90), azimuth: num((p.sun || {}).azimuth, 135) % 360,
           strength: clamp(num((p.sun || {}).strength, 3), 0, 20), color: color((p.sun || {}).color) || "#fff4e0" },
    objects: [], camera: null,
  };
  const used = new Set(["Ground", "Sun", "Camera"]);
  let models = 0;
  const list = Array.isArray(p.objects) ? p.objects : [];
  if (list.length > MAX_OBJECTS) notes.push(`${list.length} objects - the first ${MAX_OBJECTS} kept`);
  for (const ob of list.slice(0, MAX_OBJECTS)) {
    if (!ob || typeof ob !== "object") continue;
    let kind = kindOf(ob.kind || ob.type || ob.shape);
    const words = [ob.name, ob.describe, ob.description, ob.kind].filter(Boolean).join(" ");
    if (!kind) { kind = likeOf(words); notes.push(`"${ob.name || ob.kind}": kind "${ob.kind}" is not one Blender draws here - a ${kind}`); }
    let name = String(ob.name || kind).replace(/[^\w .()'-]+/g, " ").trim().slice(0, 48) || kind;
    for (let k = 2; used.has(name); k++) name = `${String(ob.name || kind).slice(0, 44)} ${k}`;
    used.add(name);
    const out = { name, kind };
    if (kind === "model") {
      out.describe = String(ob.describe || ob.description || ob.name || "an object").replace(/[\r\n]+/g, " ").slice(0, 240);
      out.like = likeOf(words);
      if (++models > maxModels) {
        out.kind = out.like;
        notes.push(`"${name}": more than ${maxModels} detailed model(s) asked for - drawn as a ${out.like}`);
        delete out.describe;
      }
    }
    if (kind === "asset") { out.asset = String(ob.asset || ob.file || "").replace(/[\\/]/g, "").slice(0, 120); if (!out.asset) out.kind = "box"; }
    const ds = SIZES[out.kind] || SIZES[out.like] || [1, 1, 1];
    out.size = vec(ob.size, 3, ds, 0.02, 500);
    if (out.kind === "model" && !Array.isArray(ob.size)) out.size = (SIZES[out.like] || [1, 1, 1]).slice();
    out.at = vec(ob.at || ob.position || ob.location, 3, [0, 0, 0], -2000, 2000);
    out.turn = num(ob.turn != null ? ob.turn : ob.rotation, 0) % 360;
    const c = color(ob.color || ob.colour);
    if (c) out.color = c;
    if (Array.isArray(ob.moves) && ob.moves.length >= 2) {
      const mv = ob.moves.filter((m) => m && typeof m === "object").map((m) => ({
        t: clamp(num(m.t != null ? m.t : m.time, 0), 0, seconds), at: vec(m.at || m.position, 3, out.at, -2000, 2000),
        turn: num(m.turn != null ? m.turn : out.turn, out.turn) % 360 })).sort((a, b) => a.t - b.t);
      if (mv.length >= 2) {
        if (mv[0].t > 0) mv.unshift({ ...mv[0], t: 0 });
        out.moves = mv.slice(0, 40);
        out.at = out.moves[0].at.slice();
      }
    }
    plan.objects.push(out);
  }
  if (!plan.objects.length) notes.push("the plan had no objects - an empty stage");
  const cam = p.camera && typeof p.camera === "object" ? p.camera : {};
  const centre = plan.objects.length
    ? [0, 1, 2].map((k) => plan.objects.reduce((s, ob) => s + ob.at[k], 0) / plan.objects.length) : [0, 0, 0];
  const look0 = [centre[0], centre[1], 1.2];
  let keys = (Array.isArray(cam.keys) ? cam.keys : []).filter((k) => k && typeof k === "object").map((k) => ({
    t: clamp(num(k.t != null ? k.t : k.time, 0), 0, seconds), at: vec(k.at || k.position, 3, [look0[0], look0[1] - 14, 1.7], -2000, 2000),
    look: vec(k.look || k.look_at || k.target, 3, look0, -2000, 2000) })).sort((a, b) => a.t - b.t).slice(0, 20);
  if (!keys.length) { keys = [{ t: 0, at: [look0[0], look0[1] - 14, 1.7], look: look0 }]; notes.push("no camera in the plan - one looking at the scene from the front"); }
  if (keys.length > 1 && keys[0].t > 0) keys.unshift({ ...keys[0], t: 0 });
  plan.camera = { lens: clamp(num(cam.lens, 35), 10, 200), keys };
  return { plan, notes };
}

module.exports = { KINDS, ALIASES, SIZES, EXAMPLE, messages, parse, clean, kindOf, likeOf };
