#!/usr/bin/env node
/* bitGen Studio — THE NATIVE-AUDIO MUSIC VIDEO'S TWO MODES (2.292.0).
 * Run: node scripts/test-nativeaudio.js
 *
 * Tim (verbatim): "if we use minimax h3 singularity model, can we use
 * ref2va and fl2va in the mmh3 native audio workflow? so our following
 * scenes can follow from the frame we select in the scene before using
 * fl2va, or if we change location to use ref2va for the new location and
 * transition from the previous scene?" ... "yes please build it, but i
 * can't get a scene rendered" (ref_image_size: '' not in ['match','max']).
 *   1. lib/nativeAudio.plan - Ref / First / Transition / legacy Last, the
 *      no-frame fallback, the transition still, plain tags, the take's
 *      tail as <Video 1> (LIVE ffmpeg);
 *   2. the render failure: lib/graphToApi keeps a linked widget's value in
 *      the positional walk (a realistic schema), the worker repairs an
 *      empty combo, and the converted base re-converts (converter version
 *      in the sidecar hash);
 *   3. the fl2va twin graph through the REAL worker patcher (python):
 *      first frame wired, last frame bypassed, the song loaded, the lock
 *      in place; and the fl2va upload rule;
 *   4. the anchors (sanitizer, route, radio, pick-frame default) and the
 *      queue wiring. The LIVE render path rides the e2e. */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
let pass = 0, fail = 0;
function check(name, ok, extra) {
  if (ok) { pass++; console.log("PASS: " + name); }
  else { fail++; console.log("FAIL: " + name + (extra !== undefined ? " :: " + JSON.stringify(extra) : "")); }
}
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const NA = require("../lib/nativeAudio");
const SC = require("../lib/scenes");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "na292-"));
const touch = (n) => { const p = path.join(tmp, n); fs.writeFileSync(p, "x"); return p; };

// ---- 1. the plan ------------------------------------------------------------
{
  const sheet = touch("vera_sheet.png"), loc = touch("rooftop.png"), prop = touch("guitar.png");
  const frame = { file: touch("scene2_continuation.png"), name: "continuation frame (c1)",
                  kind: "frame", label: "scene 1 at 4.2s" };
  const imgMeta = [
    { file: sheet, name: "vera_sheet.png", tag: "vera", kind: "sheet", label: "Vera - the singer" },
    { file: prop, name: "guitar.png", tag: "guitar", kind: "reference", label: "guitar" },
    { file: loc, name: "rooftop.png", tag: "rooftop", kind: "location", label: "Rooftop: night" }];
  const song = touch("song.wav");
  const base = { prompt: "@vera sings on @rooftop holding @guitar", imgMeta, audMeta: [],
                 song, window: { start: 12, dur: 8 }, tmpDir: tmp, n: 2 };

  const ref = NA.plan({ ...base, anchor: "reference", frame });
  check("Ref = ref2va: every picture as <Picture n> (the picked frame is NOT one - a new location is not pulled back to the old), the song first among the audios, @tags numbered",
    ref.mode === "ref2va" && ref.files.join() === [sheet, prop, loc].join()
    && ref.audios[0] === song && ref.videos.length === 0
    && ref.prompt.includes("<Picture 1> sings on <Picture 3> holding <Picture 2>")
    && ref.prompt.includes("<Audio 1> is the song segment (12s + 8s of song.wav"), ref);

  const first = NA.plan({ ...base, anchor: "first", frame });
  check("First = fl2va: the clip starts on the frame (the only picture), the song rides as the one audio, the @tags become names (fl2va has no reference slots)",
    first.mode === "fl2va" && first.files.join() === frame.file && first.audios.join() === song
    && first.prompt === "Vera sings on Rooftop holding guitar"
    && first.notes.some((x) => /fl2va \(First\): starts on scene 1 at 4.2s/.test(x)), first);

  const trans = NA.plan({ ...base, anchor: "transition", frame });
  check("Transition = fl2va from the frame to the location the prompt NAMES (last frame = its still)",
    trans.mode === "fl2va" && trans.files.join() === [frame.file, loc].join()
    && trans.notes.some((x) => x.includes("to @rooftop (location)")), trans);
  const trans2 = NA.plan({ ...base, prompt: "@vera walks on", anchor: "transition", frame });
  check("...no location named: the first location view is the destination",
    trans2.files[1] === loc, trans2.files);
  const trans3 = NA.plan({ ...base, imgMeta: [imgMeta[0]], anchor: "transition", frame });
  check("...no location or reference picture at all: continues as First and SAYS so",
    trans3.mode === "fl2va" && trans3.files.length === 1
    && trans3.missing.some((x) => /Transition needs the new location's picture/.test(x)), trans3);

  const noFrame = NA.plan({ ...base, anchor: "first", frame: null });
  check("First with no frame to continue from (boards render out of order) falls back to ref2va, in words",
    noFrame.mode === "ref2va" && noFrame.files.length === 3
    && noFrame.missing.some((x) => /needs a frame to continue from/.test(x)), noFrame.missing);

  const last = NA.plan({ ...base, anchor: "last", frame });
  check("a pre-2.292 'last' anchor renders as First (as it always did) and says so",
    last.mode === "fl2va" && last.files.length === 1
    && last.notes.some((x) => /anchor "last" renders as First/.test(x)), last.notes);

  check("locationStill: a location view outranks a named prop (the clip travels to a PLACE); with no location a named reference picture wins",
    NA.locationStill(imgMeta, "a close-up of @guitar").file === loc
    && NA.locationStill(imgMeta.slice(0, 2).concat([{ file: touch("pier.png"), tag: "pier",
      kind: "reference", label: "pier" }]), "@vera on @pier").file.endsWith("pier.png"));
  check("plainTags: an unknown @tag becomes its words, a tag inside a word is left alone",
    NA.plainTags("@red_car at mail@host", []) === "red car at mail@host");

  // LIVE: the take's end as <Video 1>
  let take = "";
  try {
    take = path.join(tmp, "scene1_take.mp4");
    execFileSync("ffmpeg", ["-y", "-f", "lavfi", "-i", "testsrc=duration=6:size=160x96:rate=24",
      "-pix_fmt", "yuv420p", take], { stdio: "ignore", timeout: 60000 });
  } catch { take = ""; }
  const withTake = NA.plan({ ...base, anchor: "reference", frame,
                             take: { path: take, n: 1, id: "c1" } });
  let tailDur = 0;
  try {
    tailDur = parseFloat(execFileSync("ffprobe", ["-v", "error", "-show_entries",
      "format=duration", "-of", "csv=p=0", withTake.videos[0]], { encoding: "utf8" }));
  } catch {}
  check("LIVE: Ref with a previous take cuts its last 3 s as <Video 1> (the transition into the new location), silent, and the header says what it is",
    take && withTake.videos.length === 1 && /scene2_prev_tail\.mp4$/.test(withTake.videos[0])
    && Math.abs(tailDur - NA.TAIL_SECONDS) < 0.3
    && withTake.prompt.includes("<Video 1> is reference video (the last 3s of scene 1's take"),
    { videos: withTake.videos, tailDur, head: withTake.prompt.slice(0, 400) });
  const gone = NA.plan({ ...base, anchor: "reference", frame,
                         take: { path: path.join(tmp, "nope.mp4"), n: 1 } });
  check("...a take no longer on disk simply brings no video",
    gone.videos.length === 0 && gone.mode === "ref2va");
}

// ---- 2. Tim's render failure ------------------------------------------------------
{
  const G2A = require("../lib/graphToApi");
  // the realistic shape: a MiniMaxH3ReferenceToVideo whose width/height are
  // LINKED to a primitive-free source, and the modern frontend still writes
  // the linked widgets' values into widgets_values
  const info = {
    MiniMaxH3ReferenceToVideo: { input: {
      required: { clip: ["CLIP"], vae: ["VAE"], prompt: ["STRING", { multiline: true }],
                  width: ["INT", { default: 1344 }], height: ["INT", { default: 768 }],
                  length: ["INT", { default: 121 }],
                  ref_image_size: [["match", "max"], { default: "match" }] } },
      input_order: { required: ["clip", "vae", "prompt", "width", "height", "length", "ref_image_size"] } },
    PrimitiveNodeX: { input: { required: { value: ["INT", { default: 1 }] } } },
    CLIPLoader: { input: { required: { clip_name: [["a.safetensors"]] } } },
    VAELoader: { input: { required: { vae_name: [["v.safetensors"]] } } },
  };
  const ui = { nodes: [
      { id: 1, type: "CLIPLoader", inputs: [], widgets_values: ["a.safetensors"] },
      { id: 2, type: "VAELoader", inputs: [], widgets_values: ["v.safetensors"] },
      { id: 3, type: "PrimitiveNodeX", inputs: [], widgets_values: [1280] },
      { id: 136, type: "MiniMaxH3ReferenceToVideo", inputs: [
          { name: "clip", link: 1 }, { name: "vae", link: 2 },
          { name: "width", link: 3, widget: { name: "width" } }],
        widgets_values: ["a prompt", 1280, 720, 124, "max"] }],
    links: [[1, 1, 0, 136, 0, "CLIP"], [2, 2, 0, 136, 1, "VAE"], [3, 3, 0, 136, 2, "INT"]] };
  const out = G2A.convert(ui, info);
  const n = out.graph && out.graph["136"];
  check("graphToApi: a LINKED widget's value is consumed in the positional walk - ref_image_size stays 'max', height 720, length 124 (the '' rejection Tim hit)",
    n && n.inputs.ref_image_size === "max" && n.inputs.height === 720 && n.inputs.length === 124
    && n.inputs.prompt === "a prompt" && Array.isArray(n.inputs.width), n && n.inputs);
  const old = { ...ui, nodes: ui.nodes.map((x) => x.id === 136
    ? { ...x, widgets_values: ["a prompt", 720, 124, "max"] } : x) };
  const n2 = G2A.convert(old, info).graph["136"];
  check("...and an OLD export that left the linked value out still maps by the unlinked names",
    n2.inputs.ref_image_size === "max" && n2.inputs.height === 720 && n2.inputs.length === 124, n2.inputs);

  const W = read("worker.py");
  check("worker schema sync repairs an EMPTY combo value (server default, else first choice) and says so",
    W.includes("schema sync: {ct}.{name} was EMPTY (not a choice) -> "));
  // the REAL _schema_sync against Tim's live schema shapes (his log): the
  // V3 dynamic combo SaveVideo.format and the '' ref_image_size
  const pySync = `
import json, sys
sys.path.insert(0, ".")
import worker
worker.say = lambda *a, **k: None
CODEC = ['COMFY_DYNAMICCOMBO_V3', {'options': [{'key': 'auto', 'inputs': {'required': {}}},
         {'key': 'h264', 'inputs': {'required': {}, 'optional': {}}}]}]
SCHEMA = {
  'SaveVideo': {'input': {'required': {'video': ['VIDEO'], 'filename_prefix': ['STRING', {'default': 'video/ComfyUI'}],
      'format': ['COMFY_DYNAMICCOMBO_V3', {'options': [{'key': 'auto', 'inputs': {'required': {'codec': CODEC}}}]}]}}},
  'MiniMaxH3ReferenceToVideo': {'input': {'required': {'prompt': ['STRING', {}],
      'ref_image_size': [['match', 'max'], {'default': 'match'}]}}},
}
worker._http_json = lambda url, timeout=10: {url.rsplit('/', 1)[1]: SCHEMA.get(url.rsplit('/', 1)[1])}
g = {'1': {'class_type': 'SaveVideo', 'inputs': {'video': ['2', 0], 'filename_prefix': 'mv'}},
     '3': {'class_type': 'SaveVideo', 'inputs': {'video': ['2', 0], 'filename_prefix': 'mv',
           'format': {'key': 'auto', 'inputs': {}}}},
     '136': {'class_type': 'MiniMaxH3ReferenceToVideo', 'inputs': {'prompt': 'p', 'ref_image_size': '',
             'ref_images.ref_image_0': ['9', 0]}}}
worker._schema_sync('http://x', g)
print('@@SY ' + json.dumps({k: g[k]['inputs'] for k in g}))`;
  let sy = null;
  try {
    const o = execFileSync("python3", ["-c", pySync], { cwd: ROOT, encoding: "utf8", timeout: 60000 });
    sy = JSON.parse(o.split("\n").find((l) => l.startsWith("@@SY ")).slice(5));
  } catch (e) { sy = { error: String(e.message).slice(0, 400) }; }
  check("worker _schema_sync (real, Tim's schema): the '' ref_image_size becomes the server default, the dotted ref slots are untouched",
    sy && sy["136"] && sy["136"].ref_image_size === "match"
    && JSON.stringify(sy["136"]["ref_images.ref_image_0"]) === '["9",0]', sy);
  check("worker _schema_sync: a missing V3 dynamic combo (SaveVideo.format) is filled with its option KEY plus the option's own required sub-input (format.codec) - not the whole option object Tim's log showed",
    sy && sy["1"] && sy["1"].format === "auto" && sy["1"]["format.codec"] === "auto", sy && sy["1"]);
  check("...and a whole-option value an older sync wrote heals to its key",
    sy && sy["3"] && sy["3"].format === "auto" && sy["3"]["format.codec"] === "auto", sy && sy["3"]);
  const RC = read("routes", "characters.js");
  check("the converted base re-converts after the fix: the converter version is part of the sidecar hash",
    RC.includes('const CONVERTER_VERSION = "2.292.0";')
    && RC.includes('.update("|converter " + CONVERTER_VERSION)'));
}

// ---- 3. the fl2va twin through the real worker patcher -----------------------------
{
  const G = JSON.parse(read("comfy_workflows", "MMH3_NativeAudio_MV_fl2va.json"));
  const types = Object.values(G).map((x) => x.class_type);
  check("the fl2va twin: MiniMaxH3ImageToVideo (first/last frame) -> MiniMaxH3NativeAudioLock on the SAME song chain (LoadAudio -> TrimAudioDuration), the lock's model/latent/audio feeding the sampler and CreateVideo",
    types.includes("MiniMaxH3ImageToVideo") && types.includes("MiniMaxH3NativeAudioLock")
    && types.includes("TrimAudioDuration") && types.includes("LoadAudio")
    && JSON.stringify(G["41"].inputs.av_latent) === '["40",1]'
    && JSON.stringify(G["54"].inputs.latent_image) === '["41",1]'
    && JSON.stringify(G["61"].inputs.audio) === '["41",2]'
    && JSON.stringify(G["40"].inputs.first_frame) === '["20",0]'
    && JSON.stringify(G["40"].inputs.last_frame) === '["21",0]');
  const py = `
import json, sys
sys.path.insert(0, ".")
import worker
worker.say = lambda *a, **k: None
g = json.load(open("comfy_workflows/MMH3_NativeAudio_MV_fl2va.json"))
def run(images):
    out = worker._patch_workflow(json.loads(json.dumps(g)), prompt="p", seed=1, frames=121,
        width=1344, height=768, steps=20, cfg=1.0, images=images, videos=[],
        audios=["song.wav"], use_lora=False, clip_device=None, upscale=False)
    return out[0] if isinstance(out, tuple) else out
a = run(["first.png"]); b = run(["first.png", "rooftop.png"])
print("@@PY " + json.dumps({
  "a20": a["20"]["inputs"].get("image"), "a21": "21" in a,
  "alast": "last_frame" in a["40"]["inputs"], "a30": a["30"]["inputs"].get("audio"),
  "b20": b["20"]["inputs"].get("image"), "b21": b["21"]["inputs"].get("image"),
  "lock": a["41"]["class_type"]}))`;
  let d = null;
  try {
    const o = execFileSync("python3", ["-c", py], { cwd: ROOT, encoding: "utf8", timeout: 60000 });
    d = JSON.parse(o.split("\n").find((l) => l.startsWith("@@PY ")).slice(5));
  } catch (e) { d = { error: String(e.message).slice(0, 400) }; }
  check("worker (real _patch_workflow): First wires the frame into first_frame, bypasses last_frame (loader pruned), and loads the song",
    d && d.a20 === "first.png" && d.a21 === false && d.alast === false && d.a30 === "song.wav"
    && d.lock === "MiniMaxH3NativeAudioLock", d);
  check("worker: Transition wires frame -> first_frame and the location still -> last_frame",
    d && d.b20 === "first.png" && d.b21 === "rooftop.png", d);
  const W = read("worker.py");
  check("worker uploads the song (and video refs) for an fl2va graph that LOADS audio - before 2.292 only ref2va did, which would starve the song loader",
    W.includes('_fl_takes_av = seg_mode == "fl2va" and (any(')   // 2.353.0: or an H3 reference graph (scripts/refslots.py)
    && W.includes('if seg_mode == "ref2va" or _fl_takes_av:'));
  const ST = read("lib", "styles.js");
  check("the MMH3_NativeAudio_MV starter's fl2va is the twin",
    ST.includes('fl2va: "comfy_workflows/MMH3_NativeAudio_MV_fl2va.json"'));
}

// ---- 4. anchors + queue wiring ----------------------------------------------------------
{
  const s = SC.safe({ list: [{ n: 1, id: "c1", prompt: ["a"], anchor: "transition" },
                             { n: 2, id: "c2", prompt: ["b"], anchor: "sideways" }] });
  check("scenes.safe keeps 'transition' (the sanitizer-whitelist lesson) and drops junk",
    s.list[0].anchor === "transition" && s.list[1].anchor === undefined
    // 2.296.0: + "continue" (Cont)
    && SC.ANCHORS.join() === "reference,first,continue,transition,last");
  const RC = read("routes", "characters.js");
  check("the anchor route validates against the ONE list (scenes.ANCHORS)",
    RC.includes("if (!scenes.ANCHORS.includes(a))"));
  check("picking a frame on the filmstrip makes an un-chosen next scene First (follow from here); a chosen anchor is kept",
    RC.includes('if (!next.anchor) next.anchor = "first";'));
  const VD = read("ext", "videodock", "characters.js");
  check("the scene card's radios are Ref / First / Trans (a legacy 'last' shows as First)",
    // 2.296.0: Cont joined between First and Trans
    // 2.299.2: the list is SC_TYPES (scene_<n>_type_group, scripts/test-scenetype.js)
    VD.includes('var SC_TYPES = ["reference", "first", "continue", "transition"];')
    && VD.includes("SC_TYPES.map(function (a) {")
    && VD.includes('(a === "reference" ? "Ref" : a === "first" ? "First" : a === "continue" ? "Cont" : "Trans")')
    && VD.includes('var a = r && r.anchor === "last" ? "first" : ((r && r.anchor) || "reference");'));
  check("queueScene: the CONVERT entry names the fl2va twin, fl2va is pinned to it, the source take rides into the plan, and a missing twin falls back to ref2va in words",
    RC.includes('fl2va: "MMH3_NativeAudio_MV_fl2va.json",')
    && RC.includes('fl2va: "comfy_workflows/" + convFl } };')
    // 2.301.0: the source take is its lossless master when it has one
    && RC.includes("contTake = { path: srcMaster || srcPath, n: srcRow.n, id: srcId };")
    && RC.includes("refVideos.length = 0; refVideos.push(...p.videos);")
    && RC.includes("is missing - restore it from the "));
}

try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
