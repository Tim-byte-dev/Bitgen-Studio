// bitGen Studio — lib/picScene.js (2.975.0): 🧱 PICTURE → 3D SCENE - one picture in, a 3D scene out, all on this computer.
// Tim: "is this worth adding to sketcher docker https://github.com/neilsonnn/image-blaster" -> "yes, please do 1-5": that
// project's pipeline (cloud: World Labs, FAL, nano-banana, ElevenLabs) rebuilt from bitGen's own local parts:
//   1 find      the Vision model names the main objects, their boxes and their sounds, and describes the place (JSON)
//   2 cut       Qwen Image 2.1 edit: each object alone on white (for its 3D model) + the CLEAN PLATE (the objects taken out)
//   3 pano      the plate at FRONT on the 2:1 green canvas (pcpano.js in Node) -> the 360 outpaint LoRA -> the surroundings
//   4 mesh      each object picture -> Hunyuan3D 2.1 / TRELLIS.2 (lib/to3d.js) -> a .glb
//   5 sound     Stable Audio Open 1.0 in ComfyUI (core nodes, a graph job): an ambience for the place + an effect per object
//   6 scene     lib/glbMerge.js: the objects where they stood (their box -> direction, distance on the ground, height) + the
//               panorama round the camera -> <project>/models3d/<name>_scene.glb (the Sketcher, Blender, Unity, Godot...)
//   7 world     (5b, optional) the panorama -> a layered walk-in 3D mesh world: HunyuanWorld 1.0, its own add-on (Settings ▸
//               Add-ons ▸ HunyuanWorld 1.0 - lib/hyworldAddon.js, misc/hyworld_worker.py) -> models3d/<name>_world_world.glb;
//               ticked at the start, or 🌍 Walk-in world on a finished scene (world(id))
// A scene: <project>/scenes3d/<id>/scene.json - it runs here, in the server, so closing the page does not stop it.
// Pure (Node: scripts/test-975.js): parseFind, place, cutPrompt, platePrompt, audioGraph, safeName.
"use strict";
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const core = require("./core");

const STEPS = ["find", "cut", "pano", "mesh", "sound", "scene", "world"];
const MAX_OBJECTS = 8;
const CAM = { hfov: 65, y: 1.6, near: 1.2, far: 18, dist: 4 };      // the picture's camera (a guess - a phone / a normal lens)
const SFX_CKPT = "stable-audio-open-1.0.safetensors", SFX_T5 = "t5_base.safetensors";

function findPrompt(n) {
  return "Look at this picture. List the main separate OBJECTS in it that could each be made into a 3D model - furniture, vehicles, "
    + "people, animals, props, plants, buildings - at most " + n + ", the biggest first. NOT the floor, the walls, the sky, the ground or "
    + "the background. For each give its name (2-4 words), its box in the picture as [x0, y0, x1, y1] with coordinates from 0 to 1000 "
    + "(0,0 = top left), and a few words for the sound it makes for a sound effect. Then describe the PLACE itself in one sentence "
    + "(where it is, what is round it, the light, the weather) without the objects, and whether it is indoors. Answer ONLY with JSON: "
    + "{\"place\": \"...\", \"indoor\": false, \"objects\": [{\"name\": \"...\", \"box\": [x0, y0, x1, y1], \"sound\": \"...\"}]}";
}
function safeName(s) { return String(s || "").replace(/[^A-Za-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) || "object"; }
/** the vision model's answer -> {place, objects [{name, box [0..1000 x4], sound}]} (boxes in pixels or 0..1 are rescaled) */
function parseFind(text, o) {
  const x = o || {}, max = Math.max(1, Math.min(MAX_OBJECTS, +x.max || 6)), W = +x.w || 0, H = +x.h || 0;
  let t = String(text || "").replace(/<think>[\s\S]*?<\/think>/g, "").replace(/```(json)?/g, "");
  let j = null;
  const a = t.indexOf("{"), b = t.lastIndexOf("}"), c = t.indexOf("["), d = t.lastIndexOf("]");
  const tryArr = () => { if (c >= 0 && d > c) { try { const v = JSON.parse(t.slice(c, d + 1)); if (Array.isArray(v)) j = { objects: v }; } catch (e) { /* not a list */ } } };
  if (c >= 0 && (a < 0 || c < a)) tryArr();   // a bare list [{...}, ...]
  if (!j && a >= 0 && b > a) { try { j = JSON.parse(t.slice(a, b + 1)); } catch (e) { j = null; } }
  if (!j) tryArr();
  if (!j) return { place: "", indoor: false, objects: [] };
  const list = Array.isArray(j) ? j : Array.isArray(j.objects) ? j.objects : [];
  const seen = {}, out = [];
  for (const it of list) {
    if (!it || typeof it !== "object") continue;
    let bx = (it.box || it.bbox || it.bbox_2d || []).map(Number);
    if (bx.length !== 4 || bx.some((v) => !isFinite(v))) continue;
    if (bx.every((v) => v <= 1.0001)) bx = bx.map((v) => v * 1000);
    else if (bx.some((v) => v > 1000) && W && H) bx = [bx[0] / W * 1000, bx[1] / H * 1000, bx[2] / W * 1000, bx[3] / H * 1000];
    let [x0, y0, x1, y1] = bx.map((v) => Math.max(0, Math.min(1000, Math.round(v))));
    if (x1 < x0) [x0, x1] = [x1, x0]; if (y1 < y0) [y0, y1] = [y1, y0];
    const area = (x1 - x0) * (y1 - y0) / 1e6;
    if (area < 0.004 || area > 0.85) continue;
    let name = String(it.name || it.label || "").replace(/\s+/g, " ").trim().slice(0, 40);
    if (!name) continue;
    const k = name.toLowerCase(); seen[k] = (seen[k] || 0) + 1; if (seen[k] > 1) name += " " + seen[k];
    out.push({ name, box: [x0, y0, x1, y1], sound: String(it.sound || "").replace(/\s+/g, " ").trim().slice(0, 120) });
    if (out.length >= max) break;
  }
  return { place: String(j.place || "").replace(/\s+/g, " ").trim().slice(0, 300), indoor: j.indoor === true || j.indoor === "true", objects: out };
}
function side(box) { const c = (box[0] + box[2]) / 2; return c < 380 ? " on the left" : c > 620 ? " on the right" : " in the middle"; }
function cutPrompt(o) { return "Show only the " + o.name + side(o.box) + " of <image1> - the whole " + o.name + ", nothing cut off, centred, seen from the same side, "
  + "on a plain pure white background with nothing else in it, no shadow, sharp and evenly lit."; }
function platePrompt(objs, place) { return "Remove " + objs.map((o) => "the " + o.name).join(", ") + " from <image1> and fill where they were with the background, "
  + "so the place looks natural and empty. Keep everything else exactly the same - the same light, the same camera, the same colours." + (place ? " The place: " + place : ""); }
/** where an object stood: its box -> {yaw (deg, + = right), dist (m), height (m), translation, rotation} on the ground in front of
 *  the camera (glTF: Y up, the camera looking down -Z). The box's bottom edge below the horizon gives the distance. */
function place(box, o) {
  const c = Object.assign({}, CAM, o || {}), aspect = +c.aspect || 16 / 9;
  const hf = c.hfov * Math.PI / 180, vf = 2 * Math.atan(Math.tan(hf / 2) / aspect);
  const cx = (box[0] + box[2]) / 2000 - 0.5, bottom = box[3] / 1000 - 0.5, bh = (box[3] - box[1]) / 1000;
  const yaw = Math.atan(cx * 2 * Math.tan(hf / 2));
  const below = Math.atan(bottom * 2 * Math.tan(vf / 2));
  let dist = below > 0.02 ? c.y / Math.tan(below) : c.dist;
  dist = Math.max(c.near, Math.min(c.far, dist));
  const height = Math.max(0.1, Math.min(30, 2 * dist * Math.tan(vf / 2) * bh));
  const a = -yaw;   // turned to face the camera
  return { yaw: yaw * 180 / Math.PI, dist, height, translation: [dist * Math.sin(yaw), 0, -dist * Math.cos(yaw)], rotation: [0, Math.sin(a / 2), 0, Math.cos(a / 2)] };
}
/** Stable Audio Open 1.0 - ComfyUI's core nodes only (an API prompt for the graph worker) */
function audioGraph(text, seconds, seed, prefix) {
  return {
    "1": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: SFX_CKPT } },
    "2": { class_type: "CLIPLoader", inputs: { clip_name: SFX_T5, type: "stable_audio" } },
    "3": { class_type: "CLIPTextEncode", inputs: { text: String(text || "").slice(0, 400), clip: ["2", 0] } },
    "4": { class_type: "CLIPTextEncode", inputs: { text: "low quality, distorted, music, speech, voice", clip: ["2", 0] } },
    "5": { class_type: "EmptyLatentAudio", inputs: { seconds: Math.max(1, Math.min(47, +seconds || 6)), batch_size: 1 } },
    "6": { class_type: "KSampler", inputs: { model: ["1", 0], positive: ["3", 0], negative: ["4", 0], latent_image: ["5", 0], seed: seed >>> 0, steps: 50, cfg: 4.98, sampler_name: "dpmpp_3m_sde_gpu", scheduler: "exponential", denoise: 1 } },
    "7": { class_type: "VAEDecodeAudio", inputs: { samples: ["6", 0], vae: ["1", 2] } },
    "8": { class_type: "SaveAudio", inputs: { audio: ["7", 0], filename_prefix: prefix || "picscene_sound" } },
  };
}
const SFX_NEEDS = [{ name: SFX_CKPT, cat: "checkpoints" }, { name: SFX_T5, cat: "text_encoders" }];

/* ================================ the run ================================ */
const live = new Map();   // id -> scene (in memory while it runs)
function dirOf(id) { return path.join(core.pDir("scenes3d"), safeName(id)); }
function save(s) { fs.mkdirSync(dirOf(s.id), { recursive: true }); fs.writeFileSync(path.join(dirOf(s.id), "scene.json"), JSON.stringify(s, null, 1)); }
function read(id) { if (live.has(id)) return live.get(id); const f = path.join(dirOf(id), "scene.json"); if (!fs.existsSync(f)) return null; try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch (e) { return null; } }
function list() {
  let d = []; try { d = fs.readdirSync(core.pDir("scenes3d")); } catch (e) { return []; }
  return d.map(read).filter(Boolean).sort((a, b) => (b.created || 0) - (a.created || 0))
    .map((s) => ({ id: s.id, name: s.name, status: s.status, created: s.created, objects: (s.objects || []).length, sceneGlb: s.sceneGlb || "" }));
}
function step(s, k, state, msg) { s.steps[k] = { state, msg: msg || "" }; s.msg = msg || s.msg; save(s); }
const deps = {   // tests swap these
  describe: (file, prompt) => require("./captioner").describe(core, [{ path: file, prompt, max_tokens: 1200 }]).then((r) => r[0] || ""),
  makeJob: (p) => { const j = core.makeJob(p); j.chunk = { i: 0, n: 1 }; return j.id; },
  job: (id) => core.jobs.get(id),
  to3d: (pic, o) => require("./to3d").queue(pic, o),
  m3dDir: () => require("./m3d").dir(),
  hyworld: () => require("./hyworldAddon"),
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
};
async function wait(s, id) {
  for (;;) {
    if (s.cancelled) throw new Error("stopped");
    const j = deps.job(id);
    if (!j) throw new Error("the job " + id + " is gone");
    if (j.status === "done") {
      const out = j.output ? core.outputDirs(j.project).map((d) => path.join(d, path.basename(j.output))).find((f) => fs.existsSync(f)) : null;
      return { job: j, file: out || null };
    }
    if (j.status === "failed" || j.status === "cancelled" || j.status === "error") throw new Error("the job " + id + " " + j.status + (j.error ? ": " + j.error : ""));
    await deps.sleep(1500);
  }
}
function imgSize(f) {
  const r = spawnSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0:s=x", f], { encoding: "utf8" });
  const m = /(\d+)x(\d+)/.exec(r.stdout || ""); return m ? { w: +m[1], h: +m[2] } : null;
}
function fit16(w, h, mp) { const k = Math.sqrt((mp || 1.05e6) / (w * h)); return { w: Math.max(256, Math.round(w * k / 16) * 16), h: Math.max(256, Math.round(h * k / 16) * 16) }; }
/** the plate at FRONT on the green 2:1 canvas -> a PNG file (pcpano.js does the sphere maths; ffmpeg the pixels) */
function erpCanvas(plate, out, fov) {
  const P = require("../ext/imageeditdock/pcpano.js"), sz = imgSize(plate); if (!sz) throw new Error("could not read the clean plate");
  const w = Math.min(1600, sz.w), h = Math.round(sz.h * w / sz.w);
  const r = spawnSync("ffmpeg", ["-v", "error", "-i", plate, "-vf", "scale=" + w + ":" + h, "-f", "rawvideo", "-pix_fmt", "rgba", "-"], { maxBuffer: 1 << 30 });
  if (r.status !== 0 || !r.stdout || r.stdout.length !== w * h * 4) throw new Error("could not read the clean plate's pixels");
  const can = P.build(2048, 1024, [{ src: P.img(w, h, new Uint8ClampedArray(r.stdout.buffer, r.stdout.byteOffset, r.stdout.length)), yaw: 0, pitch: 0, fov: fov || CAM.hfov }]);
  const e = spawnSync("ffmpeg", ["-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgba", "-s", "2048x1024", "-i", "-", "-frames:v", "1", out], { input: Buffer.from(can.data.buffer) });
  if (e.status !== 0 || !fs.existsSync(out)) throw new Error("could not write the 360 canvas");
  return out;
}

function create(picture, opts) {
  if (!picture || !fs.existsSync(picture)) { const e = new Error("that picture is not in this project"); e.status = 404; throw e; }
  const o = opts || {};
  const id = "sc_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const s = { id, name: safeName(o.name || path.basename(picture).replace(/\.[^.]+$/, "")), picture, created: Date.now(), status: "running", msg: "starting…",
    opts: { max: Math.max(1, Math.min(MAX_OBJECTS, +o.max || 5)), sound: o.sound !== false && o.sound !== "0", engine: o.engine || "", hfov: Math.max(30, Math.min(120, +o.hfov || CAM.hfov)), pano: o.pano !== false && o.pano !== "0",
      world: o.world === true || o.world === "1" },
    steps: {}, place: "", indoor: false, objects: [], plate: "", pano: "", ambient: "", sceneGlb: "", worldGlb: "" };
  STEPS.forEach((k) => { s.steps[k] = { state: "wait", msg: "" }; });
  live.set(id, s); save(s);
  run(s).catch(() => { /* written into the scene */ });
  return s;
}
async function run(s) {
  const P360 = require("./pano360"), styles = require("./styles"), imageSeed = require("./imageSeed");
  const seed = () => imageSeed.forRequest(null).seed;
  try {
    // 1 find
    step(s, "find", "run", "the Vision model is looking for the objects…");
    const sz = imgSize(s.picture) || { w: 1024, h: 1024 };
    const found = parseFind(await deps.describe(s.picture, findPrompt(s.opts.max)), { max: s.opts.max, w: sz.w, h: sz.h });
    if (!found.objects.length) throw new Error("the Vision model found no objects in the picture (is a Vision model chosen in the prompt docker?)");
    s.place = found.place; s.indoor = found.indoor; s.objects = found.objects.map((x) => Object.assign(x, { file: safeName(s.name + "_" + x.name) }));
    step(s, "find", "done", s.objects.length + " object" + (s.objects.length > 1 ? "s" : "") + ": " + s.objects.map((x) => x.name).join(", "));
    // 2 cut + the plate
    const st = P360.pickStyle(styles.read(core.STYLES_DIR)); if (!st) throw new Error("the Qwen Image 2.1 edit style is not there - Settings ▸ Styles ▸ restore the starter styles");
    const edit = (prompt, w, h, note) => deps.makeJob({ mode: "image", prompt, style: st, style_id: st.id, style_name: "🧱 Picture → 3D scene (" + st.name + ")", width: w, height: h,
      batch: 1, workflow: st.workflow, images: [s.picture], seed: seed(), no_assets: true, workflow_note: note });
    step(s, "cut", "run", "cutting out " + s.objects.length + " object(s) and the clean plate…");
    s.objects.forEach((x) => { x.cutJob = edit(cutPrompt(x), 1024, 1024, "🧱 " + x.name + " alone on white"); });
    const ps = fit16(sz.w, sz.h); s.plateJob = edit(platePrompt(s.objects, s.place), ps.w, ps.h, "🧱 the clean plate (the objects taken out)"); save(s);
    for (const x of s.objects) { x.cut = (await wait(s, x.cutJob)).file; save(s); }
    s.plate = (await wait(s, s.plateJob)).file;
    step(s, "cut", "done", "the objects cut out + the clean plate");
    // 3 the surroundings
    if (s.opts.pano && s.plate) {
      step(s, "pano", "run", "the clean plate grown into a 360° panorama…");
      const can = erpCanvas(s.plate, path.join(dirOf(s.id), "pano_canvas.png"), s.opts.hfov);
      const p = P360.jobParams(st, { desc: s.place, size: "2048", file: can }); p.seed = seed(); s.panoJob = deps.makeJob(p); save(s);
      s.pano = (await wait(s, s.panoJob)).file;
      step(s, "pano", "done", "the 360° surroundings");
    } else step(s, "pano", "skip", "no panorama (off)");
    // 4 the meshes
    step(s, "mesh", "run", "making " + s.objects.length + " 3D model(s)…");
    for (const x of s.objects) { if (!x.cut) continue; const q = deps.to3d(x.cut, { engine: s.opts.engine || undefined, model_name: x.file }); x.meshJob = q.id; x.model = q.model; }
    save(s);
    for (const x of s.objects) { if (!x.meshJob) continue; await wait(s, x.meshJob); const g = path.join(deps.m3dDir(), x.model); x.glb = fs.existsSync(g) ? g : ""; save(s); }
    step(s, "mesh", "done", s.objects.filter((x) => x.glb).length + " model(s)");
    // 5 the sounds
    if (s.opts.sound) {
      step(s, "sound", "run", "the sounds (Stable Audio Open)…");
      const aj = (text, secs, pre) => deps.makeJob({ mode: "graph", graph: audioGraph(text, secs, seed(), pre), graph_name: "🧱 sound: " + text.slice(0, 40), graph_file: "(Picture → 3D scene - Stable Audio Open)", no_assets: true });
      s.ambientJob = aj("ambience, " + (s.place || "an outdoor place") + ", loopable background sound, no music", 20, safeName(s.name + "_ambience"));
      s.objects.forEach((x) => { if (x.sound) x.sfxJob = aj(x.sound + ", sound effect, " + x.name, 5, safeName(x.file + "_sfx")); });
      save(s);
      s.ambient = (await wait(s, s.ambientJob)).file || "";
      for (const x of s.objects) if (x.sfxJob) { x.sfx = (await wait(s, x.sfxJob)).file || ""; save(s); }
      step(s, "sound", "done", "an ambience + " + s.objects.filter((x) => x.sfx).length + " effect(s)");
    } else step(s, "sound", "skip", "no sounds (off)");
    // 6 the scene
    step(s, "scene", "run", "putting the scene together…");
    const G = require("./glbMerge"), parts = [];
    for (const x of s.objects) {
      if (!x.glb) continue;
      const buf = fs.readFileSync(x.glb), g = G.parse(buf), bb = G.bounds(g.json), pl = place(x.box, { hfov: s.opts.hfov, aspect: sz.w / sz.h });
      const mh = Math.max(1e-6, bb.max[1] - bb.min[1]), k = pl.height / mh, cxm = (bb.min[0] + bb.max[0]) / 2, czm = (bb.min[2] + bb.max[2]) / 2;
      // the model's own centre on its spot, its bottom on the ground (the turn is about the spot: the offset turned too)
      const a = -pl.yaw * Math.PI / 180, ox = -cxm * k, oz = -czm * k;
      x.place = pl;
      parts.push({ glb: buf, name: x.name, scale: k, rotation: pl.rotation,
        translation: [pl.translation[0] + ox * Math.cos(a) + oz * Math.sin(a), -bb.min[1] * k, pl.translation[2] - ox * Math.sin(a) + oz * Math.cos(a)] });
    }
    const pano = s.pano && fs.existsSync(s.pano) ? { data: fs.readFileSync(s.pano), mime: /\.jpe?g$/i.test(s.pano) ? "image/jpeg" : "image/png", center: CAM.y } : null;
    const out = path.join(deps.m3dDir(), s.name + "_scene.glb");
    fs.writeFileSync(out, G.merge(parts, { name: s.name, pano, camera: { y: CAM.y, vfov: 2 * Math.atan(Math.tan(s.opts.hfov * Math.PI / 360) * sz.h / sz.w) * 180 / Math.PI, aspect: sz.w / sz.h } }));
    s.sceneGlb = out;
    step(s, "scene", "done", path.basename(out) + " - " + parts.length + " object(s)" + (pano ? " + the 360° surroundings" : ""));
    // 7 the walk-in world (optional - its own add-on)
    if (s.opts.world) await worldStep(s); else step(s, "world", "skip", "🌍 Walk-in world: off (or 🌍 on the finished scene)");
    s.status = "done"; s.msg = "done - " + path.basename(out) + (s.worldGlb ? " + " + path.basename(s.worldGlb) : "");
  } catch (e) {
    s.status = s.cancelled ? "cancelled" : "failed"; s.error = e.message;
    const k = STEPS.find((x) => s.steps[x].state === "run"); if (k) s.steps[k] = { state: "fail", msg: e.message };
    s.msg = (s.cancelled ? "■ stopped" : "⚠ ") + (s.cancelled ? "" : e.message);
  } finally { save(s); live.delete(s.id); }
  return s;
}
/** the 🌍 walk-in world: HunyuanWorld 1.0 on the panorama, the objects lifted out as their own layer. Not installed / no
 *  panorama = said in the step, the scene is still done (it is an extra) */
async function worldStep(s) {
  if (!s.pano || !fs.existsSync(s.pano)) { step(s, "world", "skip", "🌍 needs the 360° surroundings"); return; }
  const A = deps.hyworld();
  if (!A.ready()) { step(s, "world", "skip", "🌍 HunyuanWorld 1.0 is not installed - Settings ▸ Add-ons ▸ HunyuanWorld 1.0, then 🌍 Walk-in world"); return; }
  step(s, "world", "run", "🌍 building the walk-in world (HunyuanWorld 1.0 - a long one)…");
  const jp = A.jobParams(s.pano, { name: s.name, indoor: s.indoor, fg1: s.objects.map((x) => x.name), models_dir: deps.m3dDir() });
  if (jp.error) { step(s, "world", "fail", jp.error); return; }
  s.worldJob = deps.makeJob(jp.params); save(s);
  try {
    const r = await wait(s, s.worldJob);
    const g = r.job && r.job.output ? path.join(deps.m3dDir(), path.basename(r.job.output)) : "";
    s.worldGlb = g && fs.existsSync(g) ? g : (r.file || "");
    step(s, "world", s.worldGlb ? "done" : "fail", s.worldGlb ? path.basename(s.worldGlb) : "no world file came back");
  } catch (e) { if (s.cancelled) throw e; step(s, "world", "fail", e.message); }
}
/** 🌍 on a finished scene: just the world step */
function world(id) {
  const s = read(id);
  if (!s) { const e = new Error("no such scene"); e.status = 404; throw e; }
  if (live.has(id)) { const e = new Error("that scene is still being made"); e.status = 409; throw e; }
  if (!s.pano) { const e = new Error("this scene has no 360° surroundings - make it again with them ticked"); e.status = 400; throw e; }
  s.status = "running"; s.cancelled = false; s.error = ""; live.set(id, s); save(s);
  (async () => {
    try { await worldStep(s); s.status = s.cancelled ? "cancelled" : "done"; s.msg = s.steps.world.state === "done" ? "🌍 " + path.basename(s.worldGlb) : s.steps.world.msg; }
    catch (e) { s.status = s.cancelled ? "cancelled" : "failed"; s.error = e.message; s.msg = e.message; }
    finally { save(s); live.delete(s.id); }
  })();
  return s;
}
function cancel(id) { const s = live.get(id); if (!s) return false; s.cancelled = true; return true; }

module.exports = { STEPS, MAX_OBJECTS, CAM, SFX_CKPT, SFX_T5, SFX_NEEDS, findPrompt, parseFind, safeName, cutPrompt, platePrompt, place, audioGraph, fit16,
  erpCanvas, create, run, read, list, cancel, world, worldStep, deps };
