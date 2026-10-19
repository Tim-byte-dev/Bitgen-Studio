#!/usr/bin/env node
/* bitGen Studio — 2.301.0: the app reads frames from a take's LOSSLESS
 * master. Run: node scripts/test-rawmaster-app.js
 *
 * Tim (verbatim): "why am i losing quality with each scene rendered with a
 * first/last image" -> "we create 2 separate files, 1 raw files and 1 mp4
 * to playback ... save the raw renders in project name\raw".
 *   1. lib/rawMaster: projects/<p>/raw/<take stem>.avi, found by take path
 *      or take name, the take itself when there is no master;
 *   2. LIVE ffmpeg: sceneRefs.extractFrame and addFrame read the MASTER
 *      (the scratch take is RED, its master BLUE - the frame is blue), and
 *      a take without a master still gives its own frame;
 *   3. wiring: scene renders ask for the master, the job carries raw_dir,
 *      the continuation frame + tail read it, Compile joins masters at
 *      CRF 14, the worker taps before schema sync and encodes playback
 *      once. The pixel-exactness of the master itself is proved against
 *      real ffmpeg in scripts/test-rawmaster.py. */
"use strict";
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
let pass = 0, fail = 0;
function check(name, ok, extra) {
  if (ok) { pass++; console.log("PASS: " + name); }
  else { fail++; console.log("FAIL: " + name + (extra !== undefined ? " :: " + JSON.stringify(extra) : "")); }
}
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");

// ---- 1 + 2. LIVE -------------------------------------------------------------------
{
  const probe = `
const fs = require("fs"), path = require("path"), cp = require("child_process");
const core = require("./lib/core"), RM = require("./lib/rawMaster"), SR = require("./lib/sceneRefs");
const P = "e2e_rm301";
const root = core.projDir(P);
const out = {};
const ff = (a) => cp.execFileSync("ffmpeg", ["-y", "-loglevel", "error"].concat(a), { stdio: "ignore" });
const px = (png) => {         // the centre pixel's RGB
  const b = cp.execFileSync("ffmpeg", ["-loglevel", "error", "-i", png, "-vf", "crop=1:1:16:16",
    "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]);
  return [b[0], b[1], b[2]];
};
try {
  fs.mkdirSync(path.join(root, "video"), { recursive: true });
  fs.mkdirSync(path.join(root, "raw"), { recursive: true });
  const take = path.join(root, "video", "20260924-120000_ab12.mp4");
  const other = path.join(root, "video", "20260924-120500_cd34.mp4");
  ff(["-f", "lavfi", "-i", "color=c=red:s=32x32:r=24:d=1", "-c:v", "libx264", "-pix_fmt", "yuv420p", take]);
  ff(["-f", "lavfi", "-i", "color=c=0x00ff00:s=32x32:r=24:d=1", "-c:v", "libx264", "-pix_fmt", "yuv420p", other]);
  const master = path.join(root, "raw", "20260924-120000_ab12.avi");
  ff(["-f", "lavfi", "-i", "color=c=blue:s=32x32:r=24:d=1", "-c:v", "ffv1", "-pix_fmt", "bgr0", "-g", "1", master]);
  out.dir = path.relative(core.projDir(P), RM.dir(P));
  out.byPath = RM.forTake(take) === master;
  out.byName = RM.forOutput(P, "20260924-120000_ab12.mp4") === master;
  out.none = [RM.forTake(other), RM.forOutput(P, "20260924-120500_cd34.mp4"), RM.forOutput(P, ""), RM.forTake(null)];
  out.source = [RM.sourceFor(take) === master, RM.sourceFor(other) === other];
  const f1 = SR.extractFrame(take, 0.5);
  out.fromMaster = f1 && px(f1);
  const f2 = SR.extractFrame(other, null);
  out.noMaster = f2 && px(f2);
  const row = { n: 2, id: "c2", refs: [] };
  const add = SR.addFrame(P, row, take, null, 1);
  const refFile = add.added && add.added[0] ? path.join(SR.dir(P, row.id), add.added[0]) : null;
  out.addFrame = refFile && px(refFile);
  // the board registers the take as scene1.mp4: the master follows it
  const wm = path.join(root, "raw", "20260924-130000_ef56.avi");
  fs.writeFileSync(wm, "MASTER");
  fs.writeFileSync(path.join(root, "raw", "scene1.avi"), "ORPHAN");
  out.adopt = RM.adopt(P, "20260924-130000_ef56.mp4", "scene1.mp4");
  out.adoptState = [fs.existsSync(wm), fs.readFileSync(path.join(root, "raw", "scene1.avi"), "utf8"),
                    RM.forOutput(P, "scene1.mp4") === path.join(root, "raw", "scene1.avi")];
  out.adoptNone = RM.adopt(P, "no_such_take.mp4", "scene2.mp4");
} catch (e) { out.error = String(e.message || e); }
finally { fs.rmSync(root, { recursive: true, force: true }); }
console.log("@@RM " + JSON.stringify(out));`;
  let d = null;
  try {
    const o = execFileSync(process.execPath, ["-e", probe], { cwd: ROOT, encoding: "utf8", timeout: 60000 });
    d = JSON.parse(o.split("\n").find((l) => l.startsWith("@@RM ")).slice(5));
  } catch (e) { d = { error: String(e.message).slice(0, 500) }; }
  const blue = (c) => Array.isArray(c) && c[2] > 200 && c[0] < 40 && c[1] < 40;
  const green = (c) => Array.isArray(c) && c[1] > 200 && c[0] < 40 && c[2] < 40;
  check("rawMaster: masters live in <project>/raw", d && d.dir === "raw", d);
  check("rawMaster: a take's master is found by its PATH and by its NAME",
    d && d.byPath === true && d.byName === true, d);
  check("rawMaster: no master -> null, and sourceFor gives the take itself",
    d && Array.isArray(d.none) && d.none.every((x) => x === null) && JSON.stringify(d.source) === "[true,true]", d);
  check("LIVE: the next scene's frame comes from the MASTER (the red take's blue master gives blue)",
    d && blue(d.fromMaster), d && d.fromMaster);
  check("LIVE: a take without a master still gives its own frame (green)", d && green(d.noMaster), d && d.noMaster);
  check("LIVE: a frame added as the next scene's picture is read from the master too",
    d && blue(d.addFrame), d && d.addFrame);
  check("adopt: the master follows the take to its SCENE name (an orphan of that name is replaced), and a render with no master adopts nothing",
    d && typeof d.adopt === "string" && /scene1\.avi$/.test(d.adopt)
    && JSON.stringify(d.adoptState) === '[false,"MASTER",true]' && d.adoptNone === null, d && [d.adopt, d.adoptState, d.adoptNone]);
  check("the board's take registration moves the master with it (scenes.recordRender)",
    read("lib", "scenes.js").includes('try { require("./rawMaster").adopt(project, path.basename(srcAbs), name); }'));
}

// ---- 3. wiring -------------------------------------------------------------------
{
  const RC = read("routes", "characters.js"), CO = read("lib", "core.js"), W = read("worker.py");
  const NA = read("lib", "nativeAudio.js");
  check("scene renders ask for the master (not an upscale); the job carries raw_dir = projects/<p>/raw",
    RC.includes("raw_master: !upscale && !bridgeFit,") && RC.includes("raw_master: true,                  // 2.301.0")
    && CO.includes('...(job.params.raw_master ? { raw_dir: pDir("raw") } : {}),'));
  check("the continuation frame and the take's tail are read from the master, said in the notes",
    RC.includes("const srcMaster = rawMaster.forTake(srcPath);")
    && RC.includes('["-y", ...seekArgs, "-i", srcMaster || srcPath, "-frames:v", "1",')
    && RC.includes("contTake = { path: srcMaster || srcPath, n: srcRow.n, id: srcId };")
    && RC.includes('" (from its lossless master)"'));
  check("the tail clip (<Video 1>) is near-transparent (CRF 14)", NA.includes('"-an", "-c:v", "libx264", "-crf", "14",'));
  check("Compile: masters only when EVERY scene has one, then CRF 14 (one encode)",
    RC.includes("const fromMasters = masters.length > 0 && masters.every(Boolean);")
    && RC.includes("...(fromMasters ? { crf: 14 } : {}),")
    && W.includes('export_crf = str(int(params.get("crf") or 20))'));
  check("worker: the taps go in BEFORE schema sync, and the playback copy is encoded once from the master",
    W.indexOf("g, rnote, raw_fps = _rm.add_taps(g)") > 0
    && W.indexOf("g, rnote, raw_fps = _rm.add_taps(g)") < W.indexOf("g = _schema_sync(base, g)")
    && W.includes("enc_args(out_path.suffix.lstrip(\".\"), crf=16)"));
  check("worker: a chunk hand-off inside a long job reads the master too",
    W.includes("extract_last_frame(mst if mst.exists() else seg_out, cframes - 1, handoff)"));
}

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
