#!/usr/bin/env node
/* bitGen Studio — 2.399.0 unit tests: the timeline's 🎥 camera path and what MiniMax H3 / Wan / LTX are told.
 * Tim (verbatim): "can we add camera movement to follow a 3d path, pan,roll and dolly, height and angle to the tools in
 * timeline docker. will we be able to tell mmh3 , wan and ltx to follow these paths and camera movement" (asked: "Also
 * an exact-path guide").
 *   1. static/campath.js: the lens, the path (arc length, easing), the keys, poseAt (aim, pan / tilt / roll / height /
 *      dolly / lens), the frame on the picture, the presets, describe (the moves), the words per model
 *   2. lib/camPlan.js: parse, forH3 / forWan / forLtx, the ComfyUI inventory; lib/camGuide.js: the encode, resolve
 *   3. the wiring (routes, /api/generate, lib/wan.js, routes/ltx.js, the workers, the page, the timeline extension)
 *   4. LIVE (the running app, H3_URL - default the e2e server on :8311): guide frames -> two videos; /api/generate with
 *      a camera (H3: its sentence + the guide as <Video 1>); /api/campath/plan; /api/campath/models. No app = SKIP. */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0, skip = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const near = (a, b, e) => Math.abs(a - b) <= (e == null ? 1e-3 : e);

(async () => {
  // ---- 1
  const CP = require("../static/campath.js");
  check("the lens: 35 mm on a 24 mm sensor = 37.8° tall; the picture (2 units) fills the frame at 2.917",
    near(CP.fovOf(35) * 180 / Math.PI, 37.85, 0.05) && near(CP.distFor(35), 2.917, 0.002) && CP.distFor(70) > CP.distFor(35));
  const n = CP.norm({ use: 1, exact: "yes", dur: 999, ease: "zig", aim: "nope", path: [[1, 2, 3], "x", [0, 0]], keys: [{ f: 2, pan: 500 }, { f: 0.5, tilt: -100 }] });
  check("norm: flags to booleans, the length and angles clamped, bad points / ease / aim dropped, keys sorted with every field",
    n.use === true && n.exact === true && n.dur === 60 && n.ease === "inout" && n.aim === "fixed" && n.path.length === 1 && n.path[0].join() === "1,2,3"
    && n.keys.map((k) => k.f).join() === "0.5,1" && n.keys[1].pan === 180 && n.keys[0].tilt === -89 && n.keys[0].lens === 35, n);
  const S = CP.sample([[0, 0, 3], [0, 0, 1]]);
  check("the path: a curve through the points, its length (here 2), the point at half the LENGTH and the way it goes",
    near(S.total, 2, 1e-6) && near(CP.pointAt(S, 0.5).p[2], 2, 1e-6) && CP.pointAt(S, 0.5).t[2] === -1);
  check("easing: in + out is slow at the ends, linear is even", CP.ease(0.1, "inout") < 0.1 && near(CP.ease(0.5, "inout"), 0.5) && CP.ease(0.3, "linear") === 0.3);
  const st = CP.preset("static", 35), p0 = CP.poseAt(st, 0);
  check("poseAt (static): at (0, 0, D) looking down -z, up = +y, no roll",
    near(p0.pos[2], 2.917) && p0.fwd.join() === "0,0,-1" && near(p0.up[1], 1) && p0.yaw === 0 && p0.pitch === 0 && p0.roll === 0);
  const q = CP.frameOnPicture(p0, 1280, 720, 16 / 9);
  check("the frame on the picture: a static 35 mm camera frames exactly the picture",
    q && near(q[0].x, 0, 0.5) && near(q[0].y, 0, 0.5) && near(q[2].x, 1280, 0.5) && near(q[2].y, 720, 0.5), q);
  const pr = CP.poseAt(CP.preset("pan_right", 35), 1), tu = CP.poseAt(CP.preset("tilt_up", 35), 1), rc = CP.poseAt(CP.preset("roll_cw", 35), 1);
  check("pan right turns toward +x, tilt up looks up, roll clockwise drops the frame's right side",
    pr.fwd[0] > 0.3 && near(pr.yaw, 20) && tu.fwd[1] > 0.15 && near(tu.pitch, 12) && rc.rright[1] < -0.2 && near(rc.roll, 15), { pr: pr.fwd, tu: tu.fwd, rc: rc.rright });
  const orb = CP.poseAt(CP.preset("orbit_left", 35), 1);
  check("orbit (aim at the centre): the camera goes left round the picture and keeps looking at its centre",
    orb.pos[0] < -1.5 && orb.fwd[0] > 0.5 && near(Math.hypot(...orb.pos), 2.917, 0.01), orb.pos);
  const hd = CP.poseAt(CP.norm({ path: [[0, 0, 3]], keys: [{ f: 0, height: 0.5, dolly: 1, lens: 50 }] }), 0);
  check("height raises it, dolly moves it along where it looks, lens sets the field of view",
    near(hd.pos[1], 0.5) && near(hd.pos[2], 2) && near(hd.lens, 50) && hd.fov < CP.fovOf(35));
  const k2 = CP.keysAt(CP.norm({ keys: [{ f: 0, pan: 0 }, { f: 1, pan: 20 }] }), 0.5);
  check("keys: smoothly in between (half way = half), before the first = the first", near(k2.pan, 10) && CP.keysAt(CP.norm({ keys: [{ f: 0.5, pan: 7 }] }), 0.1).pan === 7);
  check("a camera looking away from the picture has no frame on it", CP.frameOnPicture(CP.poseAt(CP.norm({ keys: [{ f: 0, pan: 180 }] }), 0), 1280, 720, 16 / 9) === null);

  const expect = { static: "static", push_in: "dolly in", pull_out: "dolly out", truck_left: "truck left", truck_right: "truck right",
    pedestal_up: "pedestal up", pedestal_down: "pedestal down", pan_left: "pan left", pan_right: "pan right", tilt_up: "tilt up",
    tilt_down: "tilt down", roll_cw: "roll cw", roll_ccw: "roll ccw", orbit_left: "orbit left", orbit_right: "orbit right",
    crane_up: "pedestal up", crane_down: "pedestal down", zoom_in: "zoom in", zoom_out: "zoom out", fly_in: "dolly in" };
  const got = Object.keys(CP.PRESETS).map((k) => { const d = CP.describe(CP.preset(k, 35), 5).primary; return [k, (d.kind + " " + d.dir).trim()]; });
  check("describe: every preset is read back as the move it is (20 presets)", got.length === 20 && got.every(([k, v]) => v === expect[k]), got.filter(([k, v]) => v !== expect[k]));
  const comp = CP.describe(CP.norm({ path: [[0, 0, 2.9], [0, 0, 1.8]], keys: [{ f: 0, pan: 0 }, { f: 0.5, pan: 0 }, { f: 1, pan: 25 }], ease: "linear" }), 6);
  check("a path that pushes in, then pans right: two moves, in order (not mistaken for an orbit)",
    comp.segments.map((s) => s.kind + " " + s.dir).join(" -> ") === "dolly in -> pan right", comp.segments);
  const pl = CP.plan(CP.preset("push_in", 35), { seconds: 5 });
  check("MiniMax H3's words: its own phrase + amplitude / speed (\"The camera pushes in with large amplitude.\")",
    pl.h3 === "The camera pushes in with large amplitude." && CP.h3Sentence({ kind: "pedestal", dir: "up", size: "small", speed: "slow" }) === "The camera pedestals up with small amplitude at slow speed."
    && CP.h3Sentence({ kind: "static" }) === "The camera holds a static shot.", pl.h3);
  const hi = CP.plan(CP.norm({ keys: [{ f: 0, tilt: -30 }] }), { seconds: 5 });
  check("the starting angle is said: a high-angle view looking down", /^A high-angle view looking down\. The camera holds a static shot\.$/.test(hi.h3) && /high-angle view looking down/.test(hi.prose), hi.h3);
  check("Wan: the Fun Camera move for the main move (ComfyUI's camera_pose names), a speed from its size; pan / tilt / orbit said as the nearest",
    pl.wan.pose === "Zoom In" && pl.wan.speed === 1.6 && CP.plan(CP.preset("roll_ccw", 35)).wan.pose === "Anti Clockwise (ACW)"
    && CP.plan(CP.preset("pan_left", 35)).wan.approx === true && CP.WAN_POSES.length === 9 && CP.WAN_POSES.includes(CP.plan(CP.preset("pedestal_up", 35)).wan.pose));
  check("LTX: the camera-control LoRA for dolly in / out / left / right, jib up / down, static - none for a pan (words only, said)",
    pl.ltx.key === "dolly-in" && pl.ltx.file === "ltx-2-19b-lora-camera-control-dolly-in.safetensors" && pl.ltx.repo === "Lightricks/LTX-2-19b-LoRA-Camera-Control-Dolly-In"
    && CP.plan(CP.preset("truck_left", 35)).ltx.key === "dolly-left" && CP.plan(CP.preset("crane_up", 35)).ltx.key === "jib-up"
    && CP.plan(CP.preset("static", 35)).ltx.key === "static" && CP.plan(CP.preset("pan_left", 35)).ltx === null
    && CP.plan(CP.preset("pan_left", 35)).notes.some((x) => /LTX has no camera LoRA for a pan/.test(x)));
  const two = CP.plan(CP.norm({ path: [[0, 0, 2.9], [0, 0, 1.8]], keys: [{ f: 0, pan: 0 }, { f: 0.5, pan: 0 }, { f: 1, pan: 25 }], ease: "linear", exact: true }), { seconds: 6 });
  check("prose (Wan, LTX, the LLM): every move in order, one continuous take; H3's ONE move said in a note",
    two.prose === "Camera: a push in toward the subject, then a pan to the right, one continuous take with no cuts."
    && two.notes.some((x) => /MiniMax H3 takes ONE camera move a shot/.test(x) && /guide video carries the rest/.test(x)), two);
  check("sig changes with the path and with what the guide is made from", CP.sig(st) !== CP.sig(CP.preset("push_in", 35)) && CP.sig(st, ["a"]) !== CP.sig(st, ["b"]));

  // ---- 2
  const CPl = require("../lib/camPlan.js");
  check("camPlan.parse: nothing / off / bad JSON = null; on = the camera made safe, no guide when its names are not camguide_* files",
    CPl.parse("") === null && CPl.parse("{x") === null && CPl.parse({ cam: { use: false } }) === null
    && (() => { const p = CPl.parse(JSON.stringify({ cam: { use: true, exact: true }, guide: { rgb: "../../etc/passwd", depth: "x.mp4" } })); return p && p.exact && p.rgb === null && p.depth === null; })());
  const pk = { cam: CP.norm(Object.assign(CP.preset("push_in", 35), { use: true, exact: true })), exact: true, rgb: "/x/camguide_a_rgb.mp4", depth: "/x/camguide_a_depth.mp4", rgbName: "camguide_a_rgb.mp4", depthName: "camguide_a_depth.mp4" };
  const h3a = CPl.forH3(pk, { mode: "ref2va", refVideos: ["dance.mp4"] });
  check("H3 (References): its sentence + the RGB guide as the NEXT reference video (<Video 2>), said as experimental",
    h3a.addVideo === "camguide_a_rgb.mp4" && /^The camera pushes in with large amplitude\. Follow the camera movement of <Video 2> exactly/.test(h3a.text) && h3a.notes.some((x) => /experimental/.test(x)), h3a);
  const h3b = CPl.forH3(pk, { mode: "fl2va", refVideos: [] }), h3c = CPl.forH3(pk, { mode: "ref2va", refVideos: ["a", "b", "c"] });
  check("H3: a First / Last render (fl2va takes no video) or a full dock (3 videos) = words only, said",
    !h3b.addVideo && h3b.notes.some((x) => /fl2va\) takes no video/.test(x)) && !h3c.addVideo && h3c.notes.some((x) => /3 videos/.test(x)));
  const wa = CPl.forWan(pk, { seconds: 5 }), lt = CPl.forLtx(pk, { seconds: 5 });
  check("Wan: the prose + {pose, speed, exact, depth}; LTX: the prose + the LoRA + the depth guide",
    /^Camera: a sweeping push in/.test(wa.text) && wa.camera.pose === "Zoom In" && wa.camera.exact === true && wa.camera.depth === pk.depth
    && lt.lora.key === "dolly-in" && lt.depth === pk.depth && /^Camera:/.test(lt.text), { wa, lt });
  check("join: the typed prompt, a blank line, the camera words", CPl.join("a tree", "Camera: x.") === "a tree\n\nCamera: x." && CPl.join("a", "") === "a");
  const inv = CPl.inventory({ UNETLoader: { input: { required: { unet_name: [["wan2.2_fun_camera_high_noise_14B.safetensors", "wan2.1_vace_14B.safetensors", "flux.safetensors"]] } } },
    LoraLoaderModelOnly: { input: { required: { lora_name: ["COMBO", { options: ["ltx/ltx-2-19b-lora-camera-control-jib-up.safetensors", "other.safetensors"] }] } } },
    WanCameraEmbedding: {}, DepthAnythingV2Preprocessor: {} });
  check("inventory: Wan Fun Camera / VACE files, the LTX camera LoRAs by move (a subfolder too), the nodes, the depth preprocessor",
    inv.wanCamera.length === 1 && inv.wanVace.length === 1 && inv.ltxLoras["jib-up"] === "ltx/ltx-2-19b-lora-camera-control-jib-up.safetensors"
    && !inv.ltxLoras["dolly-in"] && inv.nodes.WanCameraEmbedding && !inv.nodes.WanVaceToVideo && inv.depth, inv);
  const CG = require("../lib/camGuide.js");
  const ea = CG.encodeArgs("/d/f_%05d.png", 24, 121, "/o.mp4");
  check("camGuide: H.264 at the frame rate, exactly the frames, a SILENT sound track (LTX's style-transfer mode reads the video's sound), even sizes",
    ea.includes("anullsrc=channel_layout=stereo:sample_rate=48000") && ea[ea.indexOf("-frames:v") + 1] === "121" && ea.includes("libx264") && ea.includes("-shortest")
    && ea.join(" ").includes("trunc(iw/2)*2") && ea[ea.indexOf("-framerate") + 1] === "24");
  check("camGuide.resolve: only camguide_<id>_rgb|depth.mp4 names (no paths, no other files)",
    CG.NAME_RE.test("camguide_ab12_rgb.mp4") && CG.NAME_RE.test("camguide_x_depth.mp4") && !CG.NAME_RE.test("camguide_x_rgb.webm") && !CG.NAME_RE.test("song.mp4") && CG.resolve("../x") === null);

  // ---- 3 the wiring
  const R = read("routes", "index.js"), RL = read("routes", "ltx.js"), W = read("lib", "wan.js"), I = read("static", "index.html"),
        WW = read("misc/wan_worker.py"), LW = read("misc/ltx_worker.py"), WG = read("scripts", "wan_graph.py"), LG = read("scripts", "ltx_graph.py"),
        EX = JSON.parse(read("ext", "timelinedock", "ext.json")), CJ = read("ext", "timelinedock", "camera.js"), SF = read("static", "secfloat.js"), DS = read("lib", "dockerStatus.js");
  check("routes: routes/camPath.js mounted from routes/index.js (frame, encode, plan, models); nothing in server.js",
    /require\("\.\/camPath"\)\.mount\(app\)/.test(R) && ["/api/campath/frame", "/api/campath/encode", "/api/campath/plan", "/api/campath/models"].every((u) => read("routes", "camPath.js").includes(u))
    && !/campath|camPlan|camGuide/i.test(read("misc/server.js")));
  check("/api/generate: the camera parsed BEFORE the prompt is taken as typed; Wan -> forWan (+ camera on the Wan job), else forH3 (its sentence, the guide added to ref_videos); notes in the job log",
    R.indexOf("camPlan.parse(f.camera)") > 0 && R.indexOf("camPlan.parse(f.camera)") < R.indexOf("const askedMode = mode, typedPrompt = prompt;")
    && /camWan = w\.camera/.test(R) && /f\.ref_videos = JSON\.stringify\(vids\.concat\(\[h\.addVideo\]\)\)/.test(R) && /cfg: bo && bo\.cfg != null \? bo\.cfg : styles\.numOr\(f\.cfg, 0\),\s+cfgExact: !!\(bo && bo\.cfg != null\), camera: camWan \}\)/.test(R)
    && /job\.log\.push\("\[camera\] " \+ n\)/.test(R));
  check("lib/wan.js: the camera made safe (cameraOf: a known pose, the depth file must exist) onto the job; the summary says it",
    /\.\.\.\(cameraOf\(x\.camera\) \? \{ camera: cameraOf\(x\.camera\) \} : \{\}\)/.test(W) && /camera: x\.camera/.test(W)
    && require("../lib/wan.js").cameraOf({ pose: "Nope", depth: "/nope", exact: true }).pose === "Static" && require("../lib/wan.js").cameraOf({ pose: "Zoom In", depth: "/nope", exact: true }).exact === false);
  check("routes/ltx.js: the words, the exact path = mode v2v with the depth guide as the video + raw_guide, else the camera LoRA on the job",
    /camPlan"\)\.parse\(b\.camera\)/.test(RL) && /ltxMode = "v2v"; vid = \{ path: cam\.depth, start: 0 \}/.test(RL) && /p\.raw_guide = true/.test(RL) && /p\.camera_lora = cam\.lora/.test(RL));
  check("wan_graph.py: modes camera (WanCameraEmbedding -> WanCameraImageToVideo) and vctrl (LoadVideo -> GetVideoComponents -> WanVaceToVideo control_video); 'camera' files never taken for plain ones",
    /MODES = \("t2v", "i2v", "flf2v", "ref", "ati", "camera", "vctrl"\)/.test(WG) && /"WanCameraEmbedding", \{"camera_pose"/.test(WG) && /add\("WanCameraImageToVideo", ins\)/.test(WG)
    && /"control_video": \[comp, 0\]/.test(WG) && /KEYWORD = \{"ati": \("ati",\), "camera": \("camera",\)/.test(WG));
  check("wan_worker.py: exact = the depth guide resampled to 16 fps and uploaded (VACE listed), else the Fun Camera move (a Fun Camera model + a start picture), else the words - each said",
    /WG\.pick_models\(unets0, fam, "vctrl", \[\], hh\)/.test(WW) && /"fps=16"/.test(WW) && /wmode, picked = "vctrl", True/.test(WW)
    && /WG\.pick_models\(unets0, fam, "camera", \[\], hh\)/.test(WW) && /the camera words carry it/.test(WW) && /"camera": cam or \{\}/.test(WW));
  check("ltx_worker.py / ltx_graph.py: the camera LoRA found in ComfyUI's loras (said when missing, with the file to download) onto the style LoRAs; raw_guide for the exact path",
    /LG\.camera_lora\(names, cl\.get\("re"\)\)/.test(LW) && /style_loras\.append/.test(LW) && /"style_loras": style_loras/.test(LW) && /\{"raw_guide": True\} if params\.get\("raw_guide"\) and not rp/.test(LW)
    && /def camera_lora\(names, pattern\)/.test(LG));
  check("the page: static/campath.js loaded; Generate (H3 / Wan) and LTX send TlCamera.field() as `camera`",
    /<script src="\/static\/campath\.js"><\/script>/.test(I) && (I.match(/TlCamera\.field\(\) : ""; if \(cf\) fd\.append\("camera", cf\);/g) || []).length === 2);
  check("the timeline extension: camera.js after paths.js; a 🎥 tool (Shift+C), a 🎥 Camera bar button, a SecFloat window (dockable), the frame drawn on the canvas",
    EX.scripts.indexOf("camera.js") === EX.scripts.indexOf("paths.js") + 1 && /C\.addTool\(\{ id: "camera", icon: "🎥"/.test(CJ) && /key: "shift\+c"/.test(CJ)
    && /SecFloat\.add\(\{ id: "camera"/.test(CJ) && /C\.onDraw\(/.test(CJ) && /CP\.frameOnPicture\(/.test(CJ) && /\/api\/campath\/frame\?id=/.test(CJ));
  check("SecFloat.add (any dockable window, kept in docker_status.json floats.<id>); floats.camera in lib/dockerStatus.js",
    /function add\(spec\)/.test(SF) && /window\.SecFloat = \{ started: true, show, add,/.test(SF) && /const FLOATS = \["basic", "llmtok", "camera"(, "negprompt")?\]/.test(DS)
    && JSON.stringify(require("../lib/dockerStatus.js").normalize({}).floats.camera) !== undefined);

  // ---- 4 LIVE
  let where = null;
  try { where = await (await fetch(URL_ + "api/outputs/where")).json(); } catch { where = null; }
  const proj = where && (where.dirs || where).find && (where.dirs || where).find((d) => d.where === "project");
  let haveFf = true;
  try { execFileSync("ffmpeg", ["-version"], { stdio: "ignore" }); } catch { haveFf = false; }
  if (!proj || !haveFf) { skip++; console.log("SKIP: no app at " + URL_ + " (or no ffmpeg) - the live legs did not run"); }
  else {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "campath-"));
    const id = "t" + process.pid;
    let ok = true;
    for (const kind of ["rgb", "depth"]) for (let i = 0; i < 6; i++) {
      const f = path.join(tmp, `${kind}${i}.png`);
      execFileSync("ffmpeg", ["-y", "-v", "error", "-f", "lavfi", "-i", `color=c=${kind === "rgb" ? "0x3070c0" : "0x808080"}:s=64x36`, "-frames:v", "1", f]);
      const r = await fetch(`${URL_}api/campath/frame?id=${id}&kind=${kind}&i=${i}`, { method: "POST", headers: { "Content-Type": "image/png" }, body: fs.readFileSync(f) });
      ok = ok && r.ok;
    }
    const bad = await fetch(`${URL_}api/campath/frame?id=${id}&kind=nope&i=0`, { method: "POST", headers: { "Content-Type": "image/png" }, body: fs.readFileSync(path.join(tmp, "rgb0.png")) });
    const enc = await (await fetch(URL_ + "api/campath/encode", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, fps: 24, frames: 6 }) })).json();
    const vdir = path.join(proj.dir, "video");
    const probe = (n) => { try { return execFileSync("ffprobe", ["-v", "error", "-show_entries", "stream=codec_type,codec_name,nb_frames", "-of", "csv=p=0", path.join(vdir, n)], { encoding: "utf8" }).trim().split("\n").sort().join("|"); } catch { return ""; } };
    check("LIVE guide: 6 RGB + 6 depth frames -> camguide_<id>_rgb.mp4 + _depth.mp4 in the project's video/ (H.264, 6 frames, a silent AAC track); a bad kind refused",
      ok && bad.status === 400 && enc.rgb === `camguide_${id}_rgb.mp4` && enc.depth === `camguide_${id}_depth.mp4` && /aac/.test(probe(enc.rgb)) && /h264,video,6/.test(probe(enc.rgb)) && /h264,video,6/.test(probe(enc.depth)),
      { enc, rgb: probe(enc.rgb || "x"), bad: bad.status });
    const camf = JSON.stringify({ cam: Object.assign(CP.preset("push_in", 35), { use: true, exact: true }), guide: { rgb: enc.rgb, depth: enc.depth } });
    const fd = new FormData();
    for (const [k, v] of Object.entries({ mode: "ref2va", prompt: "e2e a tree in a meadow", frames: 120, width: 320, height: 192, ref_videos: "[]", camera: camf })) fd.append(k, String(v));
    const gj = await (await fetch(URL_ + "api/generate", { method: "POST", body: fd })).json();
    const pp = gj.params || {};
    check("LIVE /api/generate (H3): the prompt + its camera sentence + 'follow <Video 1>', the guide as the job's reference video, the notes in the reply",
      /^e2e a tree in a meadow\n\nThe camera pushes in with large amplitude\. Follow the camera movement of <Video 1> exactly/.test(pp.prompt || "")
      && (pp.ref_videos || []).length === 1 && path.basename(pp.ref_videos[0]) === enc.rgb && /exact path: the guide/.test(gj.note || ""), { prompt: pp.prompt, rv: pp.ref_videos, note: gj.note });
    if (gj.id) { try { await fetch(`${URL_}api/jobs/${gj.id}/cancel`, { method: "POST" }); } catch { /* fine */ } }
    const fd2 = new FormData();
    for (const [k, v] of Object.entries({ mode: "fl2va", prompt: "e2e first last", frames: 120, width: 320, height: 192, ref_videos: "[]", camera: camf })) fd2.append(k, String(v));
    const gj2 = await (await fetch(URL_ + "api/generate", { method: "POST", body: fd2 })).json();
    check("LIVE /api/generate (H3 fl2va): the camera sentence, NO guide video (fl2va takes none - said)",
      /The camera pushes in/.test((gj2.params || {}).prompt || "") && !((gj2.params || {}).ref_videos || []).length && /takes no video/.test(gj2.note || ""), { p: (gj2.params || {}).prompt, note: gj2.note });
    if (gj2.id) { try { await fetch(`${URL_}api/jobs/${gj2.id}/cancel`, { method: "POST" }); } catch { /* fine */ } }
    const plj = await (await fetch(URL_ + "api/campath/plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cam: CP.preset("truck_right", 35), seconds: 5 }) })).json();
    check("LIVE /api/campath/plan: what each model is told (H3 sentence, Wan pose, LTX LoRA)",
      plj.h3 && /trucks right/.test(plj.h3.text) && plj.wan.camera.pose === "Pan Right" && plj.ltx.lora.key === "dolly-right", plj);
    const mj = await (await fetch(URL_ + "api/campath/models")).json();
    check("LIVE /api/campath/models answers (what ComfyUI has, or reachable false)", typeof mj.reachable === "boolean" && (!mj.reachable || (mj.nodes && Array.isArray(mj.wanCamera))), mj);
    for (const n of [enc.rgb, enc.depth]) try { fs.rmSync(path.join(vdir, n), { force: true }); } catch { /* fine */ }
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed${skip ? ", " + skip + " skipped" : ""}`);
  process.exit(fail ? 1 : 0);
})();
