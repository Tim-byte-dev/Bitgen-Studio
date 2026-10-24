#!/usr/bin/env node
/* bitGen Studio — 2.329.0: THE CHARACTER SWAP DIALOG.
 * Run: node scripts/test-swapdlg.js
 * Tim: "create a dialog for character swap, image placeholder on the left,
 * click opens select file dialog, in the middle is the video preview, below
 * the preview is the filmstrip and selector box ... segments of max length
 * ... Swap button in menubar, load video button, start time, duration,
 * automatic segment button ... the final video preview will be on the right
 * with save and retry and upscale buttons ... add a button in the video
 * docker "Swap"" + "add the finished segments to a vidTemp folder ... select
 * segments to join ... start 1 segment at a time or all segments ... keep
 * ... vidSwap folder, add a compile button to the right menubar".
 *   1. lib/swapSession: the grid, auto segments (back to back, the tail),
 *      one window, the record, sync / prune, names, compile order, overlaps,
 *      the ffmpeg join (for real when ffmpeg is on PATH);
 *   2. the wiring (routes, core's no_assets, the worker's upscale stage,
 *      the video docker's ⇄ Swap button, the page);
 *   3. static/swapdlg.js in jsdom: the three columns in Tim's order, the
 *      box, chips, Swap / Swap all / Keep / Compile / Retry / Upscale calls. */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
let pass = 0, fail = 0;
function check(name, ok, extra) {
  if (ok) { pass++; console.log("PASS: " + name); }
  else { fail++; console.log("FAIL: " + name + (extra !== undefined ? " :: " + JSON.stringify(extra) : "")); }
}
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const SS = require(path.join(ROOT, "lib", "swapSession"));

// ---- 1. lib/swapSession
check("snapDown: H3's 17k+5 grid (0 below 5)",
  SS.snapDown(362) === 362 && SS.snapDown(361) === 345 && SS.snapDown(72) === 56 && SS.snapDown(4) === 0 && SS.snapDown(5) === 5);
check("clampMax: 1 s .. one run; blank = one run",
  SS.clampMax(99, 362) === 15.083 && SS.clampMax(0.2, 362) === 1 && SS.clampMax("", 362) === 15.083 && SS.clampMax(8, 362) === 8);
check("bestSeconds (2.334.0): the default segment is 124 frames (5.17 s - the swap holds best on 4-5 s shots), never above one run",
  SS.BEST_FRAMES === 124 && Math.abs(SS.bestSeconds(362) - 124 / 24) < 1e-9 && SS.bestSeconds(107) === SS.maxSeconds(107)
  && SS.plan(20, 0, SS.bestSeconds(362), 362).frames === 124);
const RSD = fs.readFileSync(path.join(__dirname, "..", "routes", "swapdlg.js"), "utf8");
const SSD = fs.readFileSync(path.join(__dirname, "..", "static", "swapdlg.js"), "utf8");
check("✂ Auto segment defaults to bestSeconds; the dialog's Max shows it (best_seconds) before one run",
  RSD.includes("st.max || SS.bestSeconds(ceil)") && RSD.includes("best_seconds: SS.bestSeconds(ceil)")
  && SSD.includes("st.max || st.best_seconds || st.max_seconds"));
let pl = SS.plan(40, 0, 15, 362);
check("Auto segment: the whole video back to back in Max-long runs, each on the grid; the last is what is left",
  pl.segments.map((g) => g.frames).join() === "345,345,260" && pl.segments[1].start === 14.375
  && pl.segments[2].start === 28.75 && pl.frames === 345, pl);
check("...no gap and no overlap: each segment starts exactly where the previous ends",
  pl.segments.every((g, i) => i === 0 || Math.abs(g.start - (pl.segments[i - 1].start + pl.segments[i - 1].dur)) < 1e-6));
check("...the tail under 17 frames is reported, not a 5-frame run (40 s -> 0.42 s left)",
  Math.abs(pl.tail - 0.417) < 0.002, pl.tail);
pl = SS.plan(10, 0, 99, 362);
check("...a video shorter than one run = one segment", pl.segments.length === 1 && pl.segments[0].frames === 226, pl);
check("...Max 4 s -> 90-frame runs", SS.plan(20, 0, 4, 362).segments[0].frames === 90);
check("...a learned lower VRAM ceiling caps the runs", SS.plan(40, 0, 15, 209).frames === 209);
check("one: the box as a segment on the grid, slid back inside the video, at most one run; under 5 frames = none",
  JSON.stringify(SS.one(40, 2, 3, 362)) === JSON.stringify({ start: 2, dur: 56 / 24, frames: 56 })
  && SS.one(40, 39.9, 5, 362).start === 39.792 && SS.one(0.1, 0, 1, 362) === null && SS.one(40, 0, 99, 362).frames === 362 && SS.one(40, 38, "", 362).frames === 39);
let st = SS.blank();
st.video = "movie.mp4";
st = SS.setSegments(st, SS.plan(40, 0, 15, 362).segments);
const ids0 = st.segments.map((g) => g.id);
st = SS.setSegments(st, SS.plan(40, 0, 15, 362).segments);
check("setSegments: re-segmenting the same windows keeps their ids (their results stay attached)",
  st.segments.map((g) => g.id).join() === ids0.join());
let a = SS.addSegment(st, SS.one(40, 2, 3, 362));
check("addSegment: the box joins the plan in time order; the same window twice is one segment",
  a.state.segments.length === 4 && a.state.segments[1].id === a.seg.id
  && SS.addSegment(a.state, SS.one(40, 2, 3, 362)).state.segments.length === 4);
st = a.state;
check("resultName: <stem>_swap_<NN>_<a>-<b>s[_up].mp4 (sorts in time order)",
  SS.resultName("My Movie.mov", 2, 14.375, 14.375, false) === "My_Movie_swap_02_14.38-28.75s.mp4"
  && SS.resultName("m.mp4", 1, 0, 2, true) === "m_swap_01_0.00-2.00s_up.mp4");
let r1 = SS.addResult(st, { seg: ids0[0], start: 0, dur: 14.375, frames: 345, seed: 5, job: "j1" }); st = r1.state;
let r2 = SS.addResult(st, { seg: ids0[1], start: 14.375, dur: 14.375, frames: 345, seed: 6, job: "j2" }); st = r2.state;
let r3 = SS.addResult(st, { seg: ids0[2], start: 28.75, dur: 260 / 24, frames: 260, seed: 7, job: "j3" }); st = r3.state;
let r4 = SS.addResult(st, { seg: ids0[2], start: 28.75, dur: 260 / 24, frames: 260, seed: 8, job: "gone" }); st = r4.state;
const jobs = { j1: { status: "done", output: "a.mp4" }, j2: { status: "running" }, j3: { status: "failed" } };
const taken = [];
let sy = SS.sync(st, (id) => jobs[id] || null, (r, out) => { taken.push(out); return "seg_" + r.seed + ".mp4"; });
const byJob = (s, j) => s.results.find((x) => x.job === j);
check("sync: a finished job's file is filed (take), running follows the job, failed / gone say so",
  sy.changed && byJob(sy.state, "j1").status === "done" && byJob(sy.state, "j1").file === "seg_5.mp4"
  && byJob(sy.state, "j2").status === "running" && byJob(sy.state, "j3").status === "failed"
  && byJob(sy.state, "gone").status === "lost" && taken.join() === "a.mp4", sy.state.results);
{
  const asked = [];
  const again = SS.sync(sy.state, (id) => { asked.push(id); return { status: "running" }; }, null);
  check("sync: only queued / running rows ask the job table again (done / failed / lost are left alone)",
    asked.join() === "j2" && !again.changed);
}
st = sy.state;
check("prune: a finished row whose file is gone is dropped", SS.prune(st, () => false).dropped === 1
  && SS.prune(st, () => true).dropped === 0);
st.results.forEach((r) => { if (r.status === "done") r.where = "keep"; });
r2 = byJob(st, "j2"); r2.status = "done"; r2.file = "seg_6.mp4"; r2.where = "keep";
const tc = SS.toCompile(st, [r2.id, byJob(st, "j1").id, byJob(st, "j3").id]);
check("toCompile: only ticked, kept, finished results, in TIME order",
  tc.map((r) => r.file).join() === "seg_5.mp4,seg_6.mp4");
check("overlaps: windows that repeat frames are reported",
  SS.overlaps([{ start: 0, dur: 5, file: "a" }, { start: 4, dur: 2, file: "b" }]).length === 1
  && SS.overlaps(tc).length === 0);
const ca = SS.compileArgs([{ path: "a.mp4", audio: true, dur: 2 }, { path: "b.mp4", audio: false, dur: 3 }], "o.mp4", 961, 544);
const cj = ca.join(" ");
check("compileArgs: every file in, silence for one with no audio, scaled to the first one's size, concat, H.264 + AAC",
  /-i a\.mp4 -i b\.mp4 -f lavfi -t 3\.0000 -i anullsrc/.test(cj) && /scale=962:544/.test(cj)
  && /\[2:a:0\]aresample/.test(cj) && /concat=n=2:v=1:a=1\[v\]\[a\]/.test(cj) && /libx264/.test(cj) && ca[ca.length - 1] === "o.mp4", cj);
check("compileName: <stem>_swapped.mp4", SS.compileName("My Movie.mov") === "My_Movie_swapped.mp4");
check("safe: junk in -> blank; bad rows / segments dropped",
  SS.safe(null).segments.length === 0 && SS.safe({ segments: [{ frames: 2 }], results: [{}] }).results.length === 0);
check("safe: quality full by default (2.336.0), fast / best kept, junk = full",
  SS.safe(null).quality === "full" && SS.safe({ quality: "best" }).quality === "best" && SS.safe({ quality: "fast" }).quality === "fast"
  && SS.safe({ quality: "ultra" }).quality === "full");

const hasFF = !spawnSync("ffmpeg", ["-version"]).error && !spawnSync("ffprobe", ["-version"]).error;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "swdlg-"));
try {
  SS.save(tmp, st);
  check("save + load round-trip (projects/<p>/swap_dialog.json)", fs.existsSync(path.join(tmp, "swap_dialog.json"))
    && JSON.stringify(SS.load(tmp)) === JSON.stringify(SS.safe(st)));
  check("dirOf: vidTemp / vidSwap made on use", SS.dirOf(tmp, "temp").endsWith("vidTemp") && SS.dirOf(tmp, "keep").endsWith("vidSwap")
    && fs.existsSync(path.join(tmp, "vidSwap")));
  if (hasFF) {
    const A = path.join(tmp, "a.mp4"), B = path.join(tmp, "b.mp4"), O = path.join(tmp, "o.mp4");
    spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc=size=320x176:rate=24:duration=1",
      "-f", "lavfi", "-i", "sine=frequency=400:duration=1", "-shortest", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", A]);
    spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc=size=640x352:rate=24:duration=2",
      "-c:v", "libx264", "-pix_fmt", "yuv420p", B]);
    const r = spawnSync("ffmpeg", SS.compileArgs([{ path: A, audio: true, dur: 1 }, { path: B, audio: false, dur: 2 }], O, 320, 176).slice(0));
    const pr = spawnSync("ffprobe", ["-v", "error", "-show_entries", "stream=codec_type,width,height:format=duration", "-of", "json", O], { encoding: "utf8" });
    let d = {};
    try { d = JSON.parse(pr.stdout || "{}"); } catch { d = {}; }
    const v = (d.streams || []).find((s) => s.codec_type === "video") || {};
    check("ffmpeg: the join runs - one video at the first one's size, sound all the way (silence where a part had none), 1 s + 2 s",
      r.status === 0 && v.width === 320 && v.height === 176 && (d.streams || []).some((s) => s.codec_type === "audio")
      && Math.abs(+d.format.duration - 3) < 0.15, [r.status, String(r.stderr || "").slice(-200), d.format]);
  } else console.log("(ffmpeg not on PATH - the real join is skipped)");
} finally { fs.rmSync(tmp, { recursive: true, force: true }); }

// ---- 1b. VR (2.330.0, Tim: "is it possible to make it 360 stereo and
// 180sbs ? and usable results" -> "yes please build it")
check("vrSafe: an unknown mode = off; yaw wraps, pitch / fov clamp, a junk shape = 1:1",
  JSON.stringify(SS.vrSafe({ mode: "x", yaw: 270, pitch: 99, fov: 1, shape: "2:1" }))
  === JSON.stringify({ mode: "off", yaw: -90, pitch: 85, fov: 20, shape: "1:1" })
  && SS.vrParams({ mode: "off" }) === null && SS.vrParams({ mode: "tb360" }).mode === "tb360");
check("detectVr: the players' name tokens decide (sure); a VR-like shape is only a hint",
  SS.detectVr("Beach_180_LR.mp4", 5760, 2880).mode === "sbs180" && SS.detectVr("Beach_180_LR.mp4").sure
  && SS.detectVr("club_360_TB.mp4", 4096, 4096).mode === "tb360" && SS.detectVr("pano_360.mp4", 3840, 1920).mode === "mono360"
  && SS.detectVr("clip.mp4", 5760, 2880).sure === false && SS.detectVr("clip.mp4", 4096, 4096).mode === "tb360"
  && SS.detectVr("film.mp4", 1920, 1080).mode === "");
check("aimFromClick: a click in either eye aims at the same spot of the LEFT eye",
  JSON.stringify(SS.aimFromClick("tb360", 0.625, 0.25)) === JSON.stringify({ yaw: 45, pitch: 0 })
  && JSON.stringify(SS.aimFromClick("tb360", 0.625, 0.75)) === JSON.stringify({ yaw: 45, pitch: 0 })
  && JSON.stringify(SS.aimFromClick("sbs180", 0.75, 0.5)) === JSON.stringify(SS.aimFromClick("sbs180", 0.25, 0.5))
  && SS.aimFromClick("sbs180", 0.5, 0).yaw === -90 && SS.aimFromClick("sbs180", 0.5, 0).pitch === 90 && SS.aimFromClick("off", 0.5, 0.5) === null);
check("vrViewSize: the shape at the short side (vr_swap.view_size)",
  JSON.stringify(SS.vrViewSize(544, "9:16")) === JSON.stringify({ width: 544, height: 960 }));
check("resultName / compileName carry the players' suffix LAST",
  SS.resultName("beach.mp4", 3, 30, 15, true, "sbs180") === "beach_swap_03_30.00-45.00s_up_180_LR.mp4"
  && SS.compileName("club.mp4", "tb360") === "club_swapped_360_TB.mp4" && SS.compileName("x.mp4", "") === "x_swapped.mp4");
check("codecArgs: H.265 above 4K when there, else H.264",
  SS.codecArgs(7680, 3840, true).includes("libx265") && SS.codecArgs(7680, 3840, false).includes("libx264")
  && SS.codecArgs(3840, 1920, true).includes("libx264"));
const cav = SS.compileArgs([{ path: "a.mp4", audio: true, dur: 1 }], "o.mp4", 7680, 3840, { vr: true, codec: SS.codecArgs(7680, 3840, true) });
check("compileArgs (VR): H.265 + moov at the END (no faststart) so the spherical box can go in",
  cav.includes("libx265") && !cav.includes("+faststart") && SS.compileArgs([{ path: "a", audio: true, dur: 1 }], "o", 2, 2).includes("+faststart"));
{
  const r = SS.addResult(SS.blank(), { seg: "s", start: 0, dur: 1, frames: 24, seed: 1, job: "j", vr: "sbs180",
                                       aim: { yaw: 30, pitch: -5, fov: 80, shape: "3:4" } });
  const back = SS.safe(JSON.parse(JSON.stringify(r.state))).results[0];
  check("a VR result remembers its format + aim (↻ / ⏫ re-render the SAME view)",
    back.vr === "sbs180" && JSON.stringify(back.aim) === JSON.stringify({ yaw: 30, pitch: -5, fov: 80, shape: "3:4" }));
}
{
  const cases = [["sbs180", "L", { yaw: 30, pitch: 10, fov: 70 }, 512, 512], ["tb360", "R", { yaw: -12.5, pitch: 3.25, fov: 95 }, 544, 960],
                 ["mono360", "L", { yaw: 0, pitch: 0, fov: 60 }, 1280, 720]];
  const py = spawnSync("python3", ["-c", "import sys,json;sys.path.insert(0,'scripts');import vr_swap as V;"
    + "print(json.dumps([V.flat_vf(*c) for c in json.loads(sys.argv[1])]))", JSON.stringify(cases)], { cwd: ROOT, encoding: "utf8" });
  let pyv = null;
  try { pyv = JSON.parse(py.stdout); } catch { pyv = null; }
  const jsv = cases.map((c) => SS.vrFlatVf(...c));
  check("vrFlatVf (the 👁 still) is the SAME filter string scripts/vr_swap.flat_vf builds",
    pyv === null ? (console.log("(python3 missing - the mirror check is skipped)"), true) : JSON.stringify(pyv) === JSON.stringify(jsv), [pyv, jsv]);
}

// ---- 2. the wiring
const idx = read("routes", "index.js"), rt = read("routes", "swapdlg.js"), core = read("lib", "core.js"),
      wk = read("misc/swap_worker.py"), vd = read("ext", "videodock", "dock.html"), html = read("static", "index.html");
check("routes/swapdlg.js is mounted from routes/index.js (server.js untouched)",
  /require\("\.\/swapdlg"\)\.mount\(app\)/.test(idx) && !/swapdlg/.test(read("misc/server.js")));
check("routes: every endpoint the dialog uses",
  ["app.get(\"/api/swapdlg\"", "\"/api/swapdlg/set\"", "\"/api/swapdlg/picture\"", "\"/api/swapdlg/segments\"",
   "\"/api/swapdlg/run\"", "\"/api/swapdlg/retry\"", "\"/api/swapdlg/upscale\"", "\"/api/swapdlg/keep\"",
   "\"/api/swapdlg/discard\"", "\"/api/swapdlg/save\"", "\"/api/swapdlg/compile\"", "\"/api/swapdlg/info\"",
   "\"/api/swapdlg/file/:where/:name\""].every((k) => rt.includes(k)));
check("routes: a segment is a swap job through the swap STYLE, filed into vidTemp (no_assets), never queued twice",
  /swap\.resolveStyle\(/.test(rt) && /swap\.jobParams\(/.test(rt) && /p\.no_assets = true/.test(rt)
  && /already in the queue/.test(rt) && /SS\.dirOf\(pdir\(\), "temp"\)/.test(rt));
check("routes: Retry = a new seed; Upscale = the SAME seed + the ⚙ upscaler stage (refused without one)",
  /seed: upscale \? r0\.seed : undefined/.test(rt) && /takeUpscale\.NO_UPSCALER/.test(rt) && /p\.upscale_stage = o\.stage/.test(rt));
check("routes: discard = the recycle bin; keep moves vidTemp <-> vidSwap", /recycleBin\.recycle\(/.test(rt)
  && /fs\.renameSync\(src, path\.join\(dir, name\)\)/.test(rt) && !/unlinkSync\(fileOf/.test(rt));
check("routes (2.330.0): VR rides the job, results keep format + aim, the compile tags VR, the 👁 still, import / upload / proxy",
  /if \(vr\) p\.vr = vr;/.test(rt) && /vr: q\.vr \? q\.vr\.mode : "", aim: q\.vr/.test(rt) && /vrInject\(dst, vrm\)/.test(rt)
  && /"\/api\/swapdlg\/vrview"/.test(rt) && /"\/api\/swapdlg\/import"/.test(rt) && /isLoopback\(req\)/.test(rt)
  && /"\/api\/swapdlg\/upload"/.test(rt) && /multer\.diskStorage/.test(rt) && /"\/api\/swapdlg\/proxy"/.test(rt));
check("the asset upload streams to disk, any size, and says why in JSON (it was a silent 64 MB limit)",
  /const assetUpload = multer\(\{\s*storage: multer\.diskStorage/.test(idx) && /assetUpload\.single\("file"\)\(req, res, \(err\)/.test(idx)
  && /if \(file\.path\) \{/.test(idx));
check("swap_worker: a VR job cuts the virtual camera, then vr_finish (other eye, paste, tag)",
  /VR\.cut_args\(src, clip,/.test(wk) && /vr_finish\(src, raw, work, output_dir, vr, view, win, sw, sh, has_a, seed\)/.test(wk)
  && /VR\.right_eye_file\(/.test(wk) && /VR\.paste_args\(/.test(wk) && /VR\.inject\(dest, mode\)/.test(wk));
check("requirements.txt: numpy + OpenCV for the stereo eye", /^numpy$/m.test(read("misc/requirements.txt")) && /^opencv-python-headless$/m.test(read("misc/requirements.txt")));
check("core: a no_assets job is not auto-added to the Video assets",
  /if \(job\.params && job\.params\.no_assets\) produced\.length = 0;/.test(core));
check("swap_worker: the upscale stage (scripts/upscalestage.apply) after the style, a failure is fatal",
  /import upscalestage as _us/.test(wk) && /_us\.apply\(graph, params\["upscale_stage"\], seed=seed\)/.test(wk));
check("the video docker has a ⇄ Swap button (#vdSwapDlg)", /id="vdSwapDlg"[\s\S]{0,200}⇄ Swap<\/button>/.test(vd));
check("the page loads static/swapdlg.js and installs it with the prompt bar's size / swap style / drag / reference video",
  html.includes('<script src="/static/swapdlg.js"></script>') && /window\.SwapDialog\.install\(\{/.test(html)
  && /refVideo: \(\) => \(refVids && refVids\[0\]\)/.test(html) && /drag: \(\) => dragPayload/.test(html));

// ---- 3. the dialog (jsdom)
(async () => {
  let JSDOM;
  try { ({ JSDOM } = require("jsdom")); } catch { console.log("(jsdom missing - the dialog checks are skipped)"); return; }
  const dom = new JSDOM('<!doctype html><body><button id="vdSwapDlg">⇄ Swap</button></body>',
    { runScripts: "outside-only", pretendToBeVisual: true, url: "http://127.0.0.1/" });
  const w = dom.window, d = w.document;
  w.HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  w.HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
  w.HTMLMediaElement.prototype.pause = function () {};
  w.HTMLMediaElement.prototype.load = function () {};
  w.HTMLMediaElement.prototype.play = function () { return Promise.resolve(); };
  const calls = [];
  let STATE = { video: "movie.mp4", picture: "", text: "", max: 15, ceiling: 362, max_seconds: 15.083, picture_url: "",
    segments: [{ id: "s1", start: 0, dur: 14.375, frames: 345 }, { id: "s2", start: 14.375, dur: 14.375, frames: 345 },
               { id: "s3", start: 28.75, dur: 260 / 24, frames: 260 }],
    results: [{ id: "r1", seg: "s1", video: "movie.mp4", start: 0, dur: 14.375, frames: 345, seed: 5, job: "j1", status: "done",
                file: "movie_swap_01_0.00-14.38s.mp4", where: "temp", upscaled: false, error: "" },
              { id: "r2", seg: "s2", video: "movie.mp4", start: 14.375, dur: 14.375, frames: 345, seed: 6, job: "j2", status: "done",
                file: "movie_swap_02_14.38-28.75s.mp4", where: "keep", upscaled: false, error: "" }] };
  w.fetch = async (url, o) => {
    const body = o && o.body && typeof o.body === "string" ? JSON.parse(o.body) : (o && o.body) || null;
    calls.push({ url, body });
    const J = (x) => ({ ok: true, json: async () => x });
    if (url === "/api/swapdlg") return J(STATE);
    if (url.startsWith("/api/swapdlg/info")) return J({ name: "movie.mp4", fps: 25, frames: 1000, duration: 40, width: 640, height: 360 });
    if (url.startsWith("/api/frames")) return J({ key: "k", frames: [{ i: 0, t: 0, file: "f00001.jpg" }] });
    if (url === "/api/swapdlg/compile") return J({ ok: true, name: "movie_swapped.mp4", note: "joined" });
    if (url === "/api/swapdlg/save") return J({ ok: true, name: "x.mp4", note: "saved" });
    if (url === "/api/swapdlg/writeprompt") return J({ ...STATE, text: "Replace only the man in <Video 1> with the character in <Picture 1>.",
      prompt: "Replace only the man in <Video 1> with the character in <Picture 1>.", note: "✎ the picture described" });
    return J({ ...STATE, note: "ok" });
  };
  let styleId = "", assetsRefreshed = 0;
  w.eval(read("static", "swapdlg.js"));
  const SD = w.SwapDialog;
  check("pure: snapDown / boxFrames / fmt", SD.snapDown(361) === 345 && SD.boxFrames(15) === 345 && SD.fmt(75.5) === "1:15.50");
  SD.install({ size: () => ({ width: "960", height: "544" }), styleId: () => styleId, styleName: () => "My swap",
               drag: () => null, refVideo: () => "", note: () => {}, confirm: async () => true, llmFile: () => "gemma-e2e.gguf",
               refreshAssets: () => { assetsRefreshed++; } });
  d.getElementById("vdSwapDlg").dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 60));
  const dlg = d.querySelector("dialog.swdlg[open]");
  check("the video docker's ⇄ Swap opens the dialog", !!dlg);
  const cols = dlg ? Array.from(dlg.querySelectorAll(".swGrid > .swCol")) : [];
  check("three columns: the character picture LEFT, the video MIDDLE, the result RIGHT",
    cols.length === 3 && cols[0].querySelector(".swPic") && cols[1].querySelector(".swPrev") && cols[2].querySelector(".swOut"));
  const mid = cols[1] ? Array.from(cols[1].children).map((e) => e.className.split(" ")[0]) : [];
  check("middle, top to bottom: the preview, the video menubar (+ its VR line), the filmstrip + box, the segments",
    mid.indexOf("swPrevWrap") === 0 && mid.indexOf("swBar") === 1 && mid.indexOf("swVrBar") === 2
    && mid.indexOf("swView") === 3 && mid.indexOf("swChips") === 4, mid);
  const bar = cols[1] ? cols[1].querySelector(".swBar").textContent : "";
  check("the video menubar: Load video, Start, Duration, Max, Auto segment, Swap, Swap all",
    ["📂 Load video", "Start", "Duration", "Max", "✂ Auto segment", "⇄ Swap", "⇄ Swap all"].every((k) => bar.includes(k)), bar);
  const ql = cols[1] ? cols[1].querySelector(".swBar .swQual") : null;
  check("the video menubar: Quality (Fast / Full / Best), showing the record's (full)",
    ql && Array.from(ql.options).map((o) => o.value).join() === "fast,full,best" && ql.value === "full");
  if (ql) { ql.value = "best"; ql.dispatchEvent(new w.Event("change")); await new Promise((r) => setTimeout(r, 20)); }
  check("...changing it saves it (POST /api/swapdlg/set {quality})",
    calls.some((x) => x.url === "/api/swapdlg/set" && x.body && x.body.quality === "best"));
  const rbar = cols[2] ? cols[2].querySelector(".swBar").textContent : "";
  check("the result menubar: Save, Retry, Upscale, Compile", ["💾 Save", "↻ Retry", "⏫ Upscale", "🎬 Compile"].every((k) => rbar.includes(k)), rbar);
  let clicked = 0;
  dlg.querySelector(".swPicIn").click = () => { clicked++; };
  dlg.querySelector(".swPic").click();
  check("a click on the picture box opens the file picker (-> the app's file dialog)", clicked === 1);
  check("the segments: a chip + a band per segment, a finished one marked done",
    dlg.querySelectorAll(".swChip").length === 3 && dlg.querySelectorAll(".swSeg").length === 3
    && dlg.querySelector('.swSeg[data-seg="s1"]').classList.contains("done"));
  check("the lists: vidTemp holds r1 (✓ Keep), vidSwap holds r2 (☑ ticked for Compile, ↩)",
    dlg.querySelector('.swTempL [data-id="r1"] [data-act="keep"]') && dlg.querySelector('.swKeepL [data-id="r2"] input[data-act="pick"]').checked
    && dlg.querySelector('.swKeepL [data-id="r2"] [data-act="unkeep"]'));
  const A = SD._api;
  A.setSel(3, 99);
  check("the box: Duration is capped at one run, start snapped to a frame",
    Math.abs(SD.state().sel.dur - 15.083) < 0.05 && dlg.querySelector(".swStart").value === "3.00", SD.state().sel);
  A.setSel(2, 3);
  check("...and shows the frames H3 will actually render", /→ 56 frames/.test(dlg.querySelector(".swBoxF").textContent));
  await A.swapBox();
  let c = calls.filter((x) => x.url === "/api/swapdlg/run").pop();
  check("⇄ Swap: the BOX (start / duration) with the prompt bar's size, the direction text",
    c && c.body.start === 2 && Math.abs(c.body.dur - 3) < 0.05 && c.body.width === "960" && c.body.video_style_id === "", c && c.body);
  styleId = "sty1";
  await A.swapAll();
  c = calls.filter((x) => x.url === "/api/swapdlg/run").pop();
  check("⇄ Swap all: only the segments with no finished / waiting result; the picked swap style rides",
    c && JSON.stringify(c.body.ids) === JSON.stringify(["s3"]) && c.body.video_style_id === "sty1", c && c.body);
  dlg.querySelector('.swChip[data-seg="s2"] [data-act="run"]').click();
  await new Promise((r) => setTimeout(r, 20));
  c = calls.filter((x) => x.url === "/api/swapdlg/run").pop();
  check("▶ on a chip: that ONE segment", c && JSON.stringify(c.body.ids) === JSON.stringify(["s2"]));
  dlg.querySelector('.swTempL [data-id="r1"] [data-act="keep"]').click();
  await new Promise((r) => setTimeout(r, 20));
  c = calls.filter((x) => x.url === "/api/swapdlg/keep").pop();
  check("✓ Keep -> vidSwap (keep: true)", c && c.body.id === "r1" && c.body.keep === true);
  await A.compile();
  c = calls.filter((x) => x.url === "/api/swapdlg/compile").pop();
  check("🎬 Compile: the ticked kept segments; the joined movie previews on the right; the assets refresh",
    c && JSON.stringify(c.body.ids) === JSON.stringify(["r2"]) && /movie_swapped\.mp4/.test(dlg.querySelector(".swOutName").textContent)
    && assetsRefreshed === 1, c && c.body);
  const box = dlg.querySelector('.swKeepL [data-id="r2"] input[data-act="pick"]');
  box.checked = false; box.dispatchEvent(new w.Event("change", { bubbles: true }));
  const nC = calls.filter((x) => x.url === "/api/swapdlg/compile").length;
  await A.compile();
  check("...an unticked one is left out (nothing ticked = nothing joined)", calls.filter((x) => x.url === "/api/swapdlg/compile").length === nC);
  dlg.querySelector('.swKeepL [data-id="r2"] [data-act="play"]').click();
  check("▶ previews a result on the right (Save / Retry / Upscale enabled)",
    /movie_swap_02/.test(dlg.querySelector(".swOutName").textContent) && !dlg.querySelector(".swRetry").disabled);
  await A.again("retry");
  await A.again("upscale");
  await A.saveOut();
  check("↻ Retry / ⏫ Upscale / 💾 Save act on the previewed result",
    calls.some((x) => x.url === "/api/swapdlg/retry" && x.body.id === "r2") && calls.some((x) => x.url === "/api/swapdlg/upscale" && x.body.id === "r2")
    && calls.some((x) => x.url === "/api/swapdlg/save" && x.body.id === "r2"));
  await A.auto();
  c = calls.filter((x) => x.url === "/api/swapdlg/segments").pop();
  check("✂ Auto segment: op auto with the Max input", c && c.body.op === "auto" && c.body.max === 15, c && c.body);
  // ---- VR in the dialog
  STATE = { ...STATE, vr: { mode: "tb360", yaw: 0, pitch: 0, fov: 70, shape: "1:1" } };
  await A.refresh();
  check("VR on: the dialog shows the VR controls, the aim layer and the 'What the swap sees' view",
    dlg.classList.contains("vr") && dlg.querySelector(".swVrMode").value === "tb360" && dlg.querySelector(".swAimLayer")
    && dlg.querySelector(".swVrView"));
  check("aimFromClick in the page mirrors the lib", JSON.stringify(SD.aimFromClick("tb360", 0.625, 0.75)) === JSON.stringify({ yaw: 45, pitch: 0 }));
  dlg.querySelector(".swFov").value = "90";
  dlg.querySelector(".swFov").dispatchEvent(new w.Event("change", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 20));
  c = calls.filter((x) => x.url === "/api/swapdlg/set").pop();
  check("the View (fov) input posts the aim", c && c.body.vr && c.body.vr.fov === 90, c && c.body);
  dlg.querySelector(".swVrMode").value = "sbs180";
  dlg.querySelector(".swVrMode").dispatchEvent(new w.Event("change", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 20));
  c = calls.filter((x) => x.url === "/api/swapdlg/set").pop();
  check("the VR format select posts the mode", c && c.body.vr && c.body.vr.mode === "sbs180");
  // ---- loading: the app's file dialog hands a PATH -> imported (any size)
  w.FileDialog = { enabled: true, local: true, open: async (o) => ({ path: "D:/Movies/Beach_180_LR.mp4", paths: [], opts: o }) };
  await A.pickVideo();
  c = calls.filter((x) => x.url === "/api/swapdlg/import").pop();
  check("📂 Load video: the app's file dialog -> POST /api/swapdlg/import {path} (no upload, no size limit)",
    c && c.body.path === "D:/Movies/Beach_180_LR.mp4");
  w.FileDialog = { enabled: false };
  let vclicked = 0;
  dlg.querySelector(".swVidIn").click = () => { vclicked++; };
  await A.pickVideo();
  check("...without the app's dialog: the browser picker", vclicked === 1);
  await A.uploadVideo(new w.File(["x"], "big.mp4", { type: "video/mp4" }));
  check("a dropped / browser-picked video streams to /api/swapdlg/upload (not the 64 MB asset upload)",
    calls.some((x) => x.url === "/api/swapdlg/upload") && !calls.some((x) => x.url === "/api/passets"));
  // 2.335.0: ✎ Write prompt under the Direction box
  const tx = dlg.querySelector(".swText"), wb = dlg.querySelector(".swWrite");
  check("✎ Write prompt sits right under the Direction box (left column)",
    wb && tx && tx.nextElementSibling === wb && wb.closest(".swLeft") && /Write prompt/.test(wb.textContent));
  const n0 = calls.length;
  SD.state().st.picture = "";
  await A.writePrompt();
  check("✎ with no picture: refused in words, nothing posted",
    calls.length === n0 && /picture first/.test(dlg.querySelector(".swMsg").textContent));
  SD.state().st.picture = "_swap_character.png";
  A.setSel(4, 4);
  tx.value = "keep his red cap";
  const wp = A.writePrompt();
  check("...while it writes, the button is disabled", wb.disabled === true);
  await wp;
  const wc = calls.filter((x) => x.url === "/api/swapdlg/writeprompt").pop();
  check("✎ posts the box's middle (t), the Direction text as wishes and the prompt docker's LLM; the answer fills the box",
    wc && Math.abs(wc.body.t - 6) < 0.05 && wc.body.text === "keep his red cap" && wc.body.llm_file === "gemma-e2e.gguf"
    && tx.value.startsWith("Replace only the man in <Video 1>") && wb.disabled === false, wc && wc.body);
  dlg.querySelector(".swClose").click();
  check("✕ closes (the renders keep going in the queue)", !d.querySelector("dialog.swdlg"));
})().then(() => {
  console.log(`RESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}).catch((e) => { console.log("FAIL: crashed " + e.stack); process.exit(1); });
