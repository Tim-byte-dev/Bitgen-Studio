#!/usr/bin/env node
/* bitGen Studio — 2.472.0 units: THE UNREAL ENGINE 5.8 BRIDGE - lib/unreal.js against scripts/ue-stub.js (a stand-in
 * for the Unreal Editor with the bitGen Bridge plugin - the same protocol), the pure parts of pcunreal.js / tlunreal.js /
 * static/unreal.js, the plugin itself (ue/bitGenBridge: the .uplugin, the Python parses, every command there) and the
 * wiring.
 * Tim (verbatim): "can we add an unreal engine 5.8 bridge, get ue5.8 scenes/projects and render them in our timeline,
 * unreal models/assets metahuman and render in our image editor and timeline we can add metahuman layer, ue5.8 layer,
 * ue5.8 camera in our timeline?" */
"use strict";
const fs = require("fs"), path = require("path"), { execFileSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
let pass = 0, fail = 0;
const check = (n, ok, got) => { if (ok) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const PU = require(path.join(ROOT, "ext", "imageeditdock", "pcunreal.js"));
const TU = require(path.join(ROOT, "ext", "timelinedock", "tlunreal.js"));
const UB = require(path.join(ROOT, "static", "unreal.js"));

// ---- pure
const fr = UB.framing("full", 90);
check("framing: Full body = the camera 4.2 m in front along X at 1 m, looking back (yaw 180), the figure turned 90°", fr.camera.loc.join() === "420,0,100" && fr.camera.rot[2] === 180 && fr.figure.rot[2] === 90 && UB.framing("nope", 0).camera.loc[0] === 140);
const sr = PU.stillRequest({ kind: "metahuman", metahuman: { bp: "/Game/MetaHumans/Ada/BP_Ada.BP_Ada", anim: "/Game/Anims/Wave.Wave", time: 1.5 }, preset: "face", turn: 30, w: 800, h: 1000 }, UB.framing);
check("stillRequest (MetaHuman): the face framing, the figure turned, its pose at 1.5 s, only the figure, a clear background", sr.onlyMetahuman && sr.alpha && sr.camera.fov === 28 && sr.metahuman.rot[2] === 30 && sr.metahuman.time === 1.5 && sr.metahuman.anim === "/Game/Anims/Wave.Wave" && sr.w === 800, sr);
const sc = PU.stillRequest({ kind: "scene", level: "/Game/Maps/Street", camera: { name: "CineCam_Wide", yaw: 10, dolly: -50 }, w: 640, h: 360 }, UB.framing);
check("stillRequest (scene): a level camera by name with the nudges (turn, dolly)", sc.camera.name === "CineCam_Wide" && sc.camera.yaw === 10 && sc.camera.dolly === -50 && sc.level === "/Game/Maps/Street" && !sc.alpha, sc);
const keys = [{ t: 0, loc: [0, 0, 100], rot: [0, 0, 170], fov: 40 }, { t: 2, loc: [200, 0, 100], rot: [0, 10, -170], fov: 60 }];
const mid = TU.keyAt(keys, 1);
check("keyAt: straight between keys - the place, the field of view, the turn the short way round (170° -> -170° passes 180°)", mid.loc[0] === 100 && mid.fov === 50 && Math.abs(Math.abs(mid.rot[2]) - 180) < 1e-9 && mid.rot[1] === 5 && TU.keyAt(keys, 5).loc[0] === 200 && TU.keyAt([], 1) === null, mid);
const rr = TU.renderRequest({ kind: "camera", level: "/Game/Maps/Studio", keys, dur: 3 }, 1280, 720, 24, UB.framing);
check("renderRequest (Unreal camera): the keys, the timeline's size and fps, 3 s = 72 frames", rr.camera_keys.length === 2 && rr.frames === 72 && rr.w === 1280 && rr.fps === 24 && rr.level === "/Game/Maps/Studio", rr);
const rm = TU.renderRequest({ kind: "metahuman", metahuman: { bp: "/Game/MetaHumans/Kai/BP_Kai", anim: "/Game/Anims/Idle" }, preset: "bust", dur: 2, fps: 30 }, 640, 360, 24, UB.framing);
check("renderRequest (MetaHuman): a camera key from the framing, the MetaHuman + animation, a clear background, its own fps", rm.alpha && rm.metahuman.anim === "/Game/Anims/Idle" && rm.camera_keys.length === 1 && rm.frames === 60, rm);

// ---- the server against the stand-in
const core = require(path.join(ROOT, "lib", "core"));
const UE = require(path.join(ROOT, "lib", "unreal.js"));
const errOf = (f) => { try { f(); return null; } catch (e) { return e.status + " " + e.message; } };
check("cleanRender: refuses a request with nothing to render, a MetaHuman without a camera, a bad asset path, bad camera keys", /pick a Level Sequence/.test(errOf(() => UE.cleanRender({}))) && /needs a camera/.test(errOf(() => UE.cleanRender({ metahuman: { bp: "/Game/MH/BP_A" } })))
  && /not an asset path/.test(errOf(() => UE.cleanRender({ sequence: "C:\\evil" }))) && /not 3 numbers/.test(errOf(() => UE.cleanRender({ camera_keys: [{ t: 0, loc: [1, 2] }] }))) && /^400/.test(errOf(() => UE.cleanStill({ metahuman: { bp: "../x" } }))));
check("cleanStill / cleanRender: sizes kept in 16 - 8192, fps 1 - 120, keys sorted by time", UE.cleanStill({ w: 99999, h: 3 }).w === 8192 && UE.cleanStill({ w: 99999, h: 3 }).h === 16 && UE.cleanRender({ sequence: "/Game/S", fps: 500 }).fps === 120
  && UE.cleanRender({ camera_keys: [{ t: 3, loc: [0, 0, 0] }, { t: 1, loc: [1, 1, 1] }] }).camera_keys[0].t === 1);
const stub = require(path.join(__dirname, "ue-stub.js"));
const cfg0 = JSON.parse(JSON.stringify((core.getConfig() || {}).unreal || null));
(async () => {
  const off = await UE.status.call(null).catch(() => null);
  const S0 = await stub.start(0);
  try {
    UE.saveSettings({ port: 1 }); const down = await UE.status();
    check("status with no editor: not connected + how to fix it (open the project with the plugin)", down.connected === false && /not reachable on 127\.0\.0\.1:1/.test(down.error) && /bitGen Bridge plugin/.test(down.error), down);
    UE.saveSettings({ port: S0.port });
    const st = await UE.status();
    check("status: connected - the engine, the project, the level open now", st.connected && st.engine === "5.8.1-stub" && /StubProject/.test(st.project) && /Studio/.test(st.level), st);
    const lv = await UE.list("levels"), mh = await UE.list("metahumans"), cams = await UE.list("cameras"), sq = await UE.list("sequences");
    check("lists: levels, MetaHumans, cameras, sequences (an unknown list refused)", lv.length === 2 && mh[0].name === "Ada" && cams[1].name === "CineCam_Close" && sq[0].name === "Seq_Intro" && /unknown list/.test(await UE.list("nope").catch((e) => e.message)));
    const s1 = await UE.still({ camera: { name: "CineCam_Wide" }, w: 320, h: 180 });
    const p1 = UE.stillPath(s1.name), b1 = fs.readFileSync(p1);
    check("still: a PNG in the project's unreal/stills (served by name only)", /^ue_[a-z0-9]+\.png$/.test(s1.name) && b1.readUInt32BE(16) === 320 && b1.readUInt32BE(20) === 180 && /^404 no such picture/.test(errOf(() => UE.stillPath("../../x.png"))), s1);
    const sBad = await UE.still({ camera: { name: "Nope" } }).catch((e) => e);
    check("still: Unreal's own error comes back (a camera that is not there)", sBad instanceof Error && /no camera named Nope/.test(sBad.message) && sBad.status === 422, sBad && sBad.message);
    const call = S0.calls.filter((c) => c.cmd === "still")[0];
    check("still: what the plugin is sent - the camera, the size, the output file in the project", call.args.camera.name === "CineCam_Wide" && call.args.w === 320 && /unreal[\\/]stills[\\/]ue_/.test(call.args.out), call.args);
    const r = await UE.render({ camera_keys: [{ t: 0, loc: [0, 0, 100], rot: [0, 0, 0], fov: 50 }], fps: 12, frames: 12, w: 64, h: 36 });
    let j = null; for (let i = 0; i < 80; i++) { await new Promise((ok) => setTimeout(ok, 150)); j = await UE.job(r.job); if (j.state === "done" || j.state === "error") break; }
    const vid = j && j.video ? path.join(core.pDir("video"), j.video) : "";
    check("render: the Movie Render Queue's frames -> a video in the project's video folder (12 frames at 12 fps = 1 s); the frames folder cleaned up", j.state === "done" && /^ue_j[a-z0-9]+\.mp4$/.test(j.video) && fs.existsSync(vid) && Math.abs(j.dur - 1) < 1e-9 && !fs.existsSync(path.join(core.projDir(core.getProject()), "unreal", "jobs", r.job)), j);
    const ra = await UE.render({ sequence: "/Game/Cine/Seq_Intro", fps: 24, frames: 8, w: 64, h: 36, alpha: true });
    for (let i = 0; i < 80; i++) { await new Promise((ok) => setTimeout(ok, 150)); j = await UE.job(ra.job); if (j.state === "done" || j.state === "error") break; }
    const probe = j.video ? execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=codec_name:stream_tags=alpha_mode", "-of", "json", path.join(core.pDir("video"), j.video)]).toString() : "";
    check("render with a clear background: a VP9 .webm with alpha (as the 3D layers)", j.state === "done" && /\.webm$/.test(j.video) && /vp9/.test(probe) && /"alpha_mode": "1"/.test(probe), [j, probe]);
    check("render: a job that does not exist = 404", /404/.test(await UE.job("nope").catch((e) => e.status + " " + e.message)));
    for (const f of [p1, vid, path.join(core.pDir("video"), j.video || "x")]) try { fs.unlinkSync(f); } catch (e) { /* gone */ }
  } catch (e) { check("the bridge tests ran", false, e.stack); }
  finally {
    await S0.close();
    const cfg = core.getConfig() || {}; if (cfg0) cfg.unreal = cfg0; else delete cfg.unreal; core.setConfig(cfg);
    void off;
  }
  done();
})();
function done() {
  // the plugin
  const UP = JSON.parse(read("ue", "bitGenBridge", "bitGenBridge.uplugin")), PY = read("ue", "bitGenBridge", "Content", "Python", "bitgen_bridge.py"), INIT = read("ue", "bitGenBridge", "Content", "Python", "init_unreal.py");
  check("the plugin: a content-only .uplugin for 5.8 needing Python, Editor Scripting, Sequencer Scripting, Movie Render Queue", UP.CanContainContent === true && UP.EngineVersion === "5.8.0" && ["PythonScriptPlugin", "EditorScriptingUtilities", "SequencerScripting", "MovieRenderPipeline"].every((n) => UP.Plugins.some((p) => p.Name === n && p.Enabled)));
  let parsed = false; try { execFileSync("python3", ["-c", "import ast,sys; [ast.parse(open(f, encoding='utf-8').read()) for f in sys.argv[1:]]", path.join(ROOT, "ue", "bitGenBridge", "Content", "Python", "bitgen_bridge.py"), path.join(ROOT, "ue", "bitGenBridge", "Content", "Python", "init_unreal.py")]); parsed = true; } catch (e) { parsed = false; }
  check("the plugin's Python parses; init_unreal.py starts the bridge", parsed && /bitgen_bridge\.start\(\)/.test(INIT));
  const cmds = ["ping", "levels", "sequences", "metahumans", "anims", "cameras", "viewport", "open_level", "still", "render", "job"];
  const stubCmds = read("scripts", "ue-stub.js");
  check("the plugin answers every command the stand-in does (and lib/unreal.js uses), on 127.0.0.1 only, the work on the editor's thread (a Slate tick), stills wait for the capture frames",
    cmds.every((c) => new RegExp('"' + c + '": cmd_' + c).test(PY) && new RegExp("\\b" + c + ": \\(").test(stubCmds)) && /ThreadingHTTPServer\(\("127\.0\.0\.1", PORT\)/.test(PY) && /register_slate_post_tick_callback\(_on_tick\)/.test(PY) && /for _ in range\(3\):[\s\S]{0,120}yield/.test(PY));
  check("the plugin: the Movie Render Queue (PNG frames f_00000…, the output folder bitGen gives) + a Level Sequence for bitGen's camera keys / a MetaHuman", /MoviePipelineQueueSubsystem/.test(PY) && /MoviePipelineImageSequenceOutput_PNG/.test(PY) && /"f_\{frame_number\}"/.test(PY) && /MovieSceneCameraCutTrack/.test(PY) && /MovieSceneSkeletalAnimationTrack/.test(PY) && /MoviePipelinePIEExecutor/.test(PY));
  check("the plugin's README: install into <Project>/Plugins, the alpha setting, what it changes in the project", /Plugins\\bitGenBridge/.test(read("ue", "README.txt")) && /alpha channel support/.test(read("ue", "README.txt")));
  // wiring
  const EXT = JSON.parse(read("ext", "imageeditdock", "ext.json")).scripts, IE = read("ext", "imageeditdock", "imageedit.js"), TX = JSON.parse(read("ext", "timelinedock", "ext.json")).scripts, IDX = read("static", "index.html"), RI = read("routes", "index.js");
  check("wiring: pcunreal.js after pcbody.js (installed after PCBody), tlunreal.js after tlbody.js, static/unreal.js after settings3d.js, routes/unreal.js mounted from routes/index.js",
    EXT.indexOf("pcunreal.js") === EXT.indexOf("pcbody.js") + 1 && IE.indexOf("PCUnreal.install(E)") > IE.indexOf("PCBody.install(E)") && TX.indexOf("tlunreal.js") === TX.indexOf("tlbody.js") + 1
    && IDX.indexOf('<script src="/static/unreal.js">') > IDX.indexOf('<script src="/static/settings3d.js">') && /require\("\.\/unreal"\)\.mount\(app\)/.test(RI));
  const PC = read("ext", "imageeditdock", "pcunreal.js"), TL = read("ext", "timelinedock", "tlunreal.js");
  check("the UNREAL tabs: image editor (Unreal Layer, MetaHuman Layer, Use Viewport, Render Again, settings) + the 🎮 Unreal tab; timeline (Unreal Layer, MetaHuman Layer, Unreal Camera, ＋ Key, Keys…, Render Again)",
    /E\.cadBar\.addTab\(\{ id: "unreal"/.test(PC) && /data(set)?\.tab = "kue"/.test(PC) && /window\.TlCadBar\.addTab\(\{ id: "unreal"/.test(TL) && ["u_scene", "u_mh", "u_cam", "u_key", "u_keys", "u_again"].every((id) => TL.includes('"' + id + '"')));
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
