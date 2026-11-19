// lib/rgbMocap.js — 2.869.0 🕺 RGB MoCap for the timeline (Tim: "can we add this to timeline for mocap,
// https://github.com/toyxyz/toyxyz_RGBMocap").
// RGB MoCap (toyxyz, MIT; its models keep their own licences - THIRD_PARTY_NOTICES.md) is a native WINDOWS app that turns a video into
// editable human animation (PEAR, ExMR, FlowHMR, GVHMR, MAMMA, PromptHMR; contacts, retargeting) and exports FBX / BVH. It has NO
// command line for a whole job - its own window does the work (File ▸ Open Video ▸ Reconstruct 3D ▸ Export). So bitGen:
//   INSTALL  Settings ▸ Add-ons ▸ RGB MoCap: git clone into <app>/rgbmocap/toyxyz_RGBMocap + its install.cmd (Blender + FFmpeg + the
//            runtimes, ~32 GB free first); the models (~70 GB) are picked in ITS Model Manager (some need you to register)
//   PREPARE  the timeline clip's used part (in -> out) cut to projects/<p>/mocap/<clip>/<clip>.mp4 (ffmpeg, the frames kept) - the
//            folder is where you export to; RGB MoCap opens (RGBMoCap.cmd), the video's path is given to copy
//   BRING    every .fbx / .bvh exported into projects/<p>/mocap/ is listed; ⤓ To the timeline copies an .fbx into models3d (the
//            timeline's 3D layers play its animation); a .bvh is made an .fbx by Blender first (scripts/bvh_to_fbx.py)
"use strict";
const fs = require("fs"), path = require("path"), cp = require("child_process");
const core = require("./core");
const bad = (m, s) => Object.assign(new Error(m), { status: s || 400 });
const REPO = "https://github.com/toyxyz/toyxyz_RGBMocap.git";
let BASE = null, RUN = null, IS_WIN = process.platform === "win32";
function setBase(b) { BASE = b; } function setRun(f) { RUN = f; } function setWin(w) { IS_WIN = !!w; }   // tests
const base = () => BASE || core.BASE;
const dir = () => path.join(base(), "rgbmocap", "toyxyz_RGBMocap");
const mocapDir = () => { const d = path.join(core.projDir(core.getProject()), "mocap"); fs.mkdirSync(d, { recursive: true }); return d; };
const LINKS = [["RGB MoCap (toyxyz)", "https://github.com/toyxyz/toyxyz_RGBMocap"], ["Its user guide", "https://github.com/toyxyz/toyxyz_RGBMocap/blob/main/docs/USER_GUIDE.md"]];
function status() {
  const d = dir(), installed = fs.existsSync(path.join(d, "runtime", "python.exe")) && fs.existsSync(path.join(d, "RGBMoCap.cmd"));
  return { windows: IS_WIN, cloned: fs.existsSync(path.join(d, "RGBMoCap.cmd")), installed, dir: d, note: IS_WIN ? "" : "RGB MoCap runs on Windows only (64-bit, an NVIDIA GPU, OpenGL 4.3)" };
}
const run = (cmd, args, opts) => (RUN || require("./setupExec").run)(cmd, args, opts);
/** Settings ▸ Add-ons: clone + install.cmd (update: update.cmd) - the log shows its own lines */
async function install(log, o) {
  const L = log || (() => {}), st = status();
  if (!IS_WIN) throw bad(st.note, 409);
  fs.mkdirSync(path.dirname(dir()), { recursive: true });
  if (!st.cloned) { L("⬇ git clone " + REPO); const c = await run("git", ["clone", "--depth", "1", REPO, dir()], { log: L }); if (c !== 0) throw bad("git clone failed - is git installed (Settings ▸ General ▸ Setup)?", 502); }
  const script = o && o.update && st.installed ? "update.cmd" : "install.cmd";
  L(`▶ ${script} - RGB MoCap's own setup (Blender, FFmpeg, its runtimes; it needs about 32 GB free before the models)`);
  const code = await run("cmd", ["/c", script], { cwd: dir(), log: L, env: Object.assign({}, process.env, { RGBMOCAP_NONINTERACTIVE: "1" }), timeout: 6 * 3600 * 1000 });
  if (code !== 0) throw bad(`${script} stopped (exit ${code}) - its lines are in the log above`, 502);
  L("✓ RGB MoCap is installed - pick its models in ITS Model Manager (the timeline's 🕺 ▸ Open RGB MoCap)");
  return status();
}
function remove() { fs.rmSync(path.join(base(), "rgbmocap"), { recursive: true, force: true }); return status(); }
/** open the app (its console stays open while it runs - its own rule) */
function open() {
  const st = status(); if (!st.windows) throw bad(st.note, 409); if (!st.installed) throw bad("RGB MoCap is not installed - Settings ▸ Add-ons ▸ RGB MoCap", 412);
  const ch = (RUN && RUN.spawn ? RUN.spawn : cp.spawn)("cmd", ["/c", "start", "\"RGB MoCap\"", "RGBMoCap.cmd"], { cwd: st.dir, detached: true, stdio: "ignore", windowsHide: false });
  if (ch && ch.unref) ch.unref();
  return { opened: true };
}
const clean = (s) => String(s || "").replace(/\.[^.]+$/, "").replace(/[^\w.-]+/g, "_").replace(/^[._]+/, "").slice(0, 60) || "clip";
/** the clip's used part -> projects/<p>/mocap/<name>/<name>.mp4 */
async function prepare(o) {
  const a = o || {}, src = require("./frames").resolveMedia(a.name, a.src || "video");
  if (!src || !fs.existsSync(src)) throw bad("the clip's video was not found: " + a.name, 404);
  const tin = Math.max(0, +a.in || 0), tout = +a.out > tin ? +a.out : 0, nm = clean(a.name) + (tin || tout ? `_${Math.round(tin * 10)}-${Math.round(tout * 10)}` : "");
  const d = path.join(mocapDir(), nm); fs.mkdirSync(d, { recursive: true });
  const out = path.join(d, nm + ".mp4");
  const args = ["-y", "-loglevel", "error"].concat(tin ? ["-ss", String(tin)] : [], ["-i", src], tout ? ["-t", String(tout - tin)] : [],
    ["-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "16", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out]);
  const code = await run("ffmpeg", args, {});
  if (code !== 0 || !fs.existsSync(out)) throw bad("ffmpeg could not cut the clip", 500);
  fs.writeFileSync(path.join(d, "EXPORT HERE.txt"), "bitGen Studio: in RGB MoCap, File > Open Video > " + out + "\r\nReconstruct 3D, then export FBX (or BVH) into THIS folder:\r\n" + d + "\r\nbitGen's timeline lists it under 🕺 Mocap - ⤓ To the timeline.\r\n");
  return { video: out, folder: d, rel: path.relative(core.projDir(core.getProject()), out).split(path.sep).join("/") };
}
/** every .fbx / .bvh under projects/<p>/mocap -> [{rel, name, kind, size, mtime, inTimeline}] newest first */
function results() {
  const root = mocapDir(), out = [], m3 = path.join(core.projDir(core.getProject()), "models3d");
  const walk = (d, depth) => { if (depth > 4) return; for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) walk(p, depth + 1); else if (/\.(fbx|bvh)$/i.test(f.name)) { const s = fs.statSync(p); out.push({ rel: path.relative(root, p).split(path.sep).join("/"), name: f.name, kind: path.extname(f.name).slice(1).toLowerCase(), size: s.size, mtime: s.mtimeMs, inTimeline: fs.existsSync(path.join(m3, modelName(path.relative(root, p)))) }); } } };
  walk(root, 0);
  return { folder: root, results: out.sort((a, b) => b.mtime - a.mtime), status: status() };
}
const modelName = (rel) => "mocap_" + String(rel).replace(/\.(fbx|bvh)$/i, "").replace(/[\\/]+/g, "_").replace(/[^A-Za-z0-9 ._()-]+/g, "_").slice(0, 100) + ".fbx";
/** ⤓ a result into models3d (a .bvh through Blender) -> {model} for TlM3D.add("model", model) */
async function bring(o) {
  const rel = String((o || {}).rel || "").replace(/\\/g, "/");
  if (!rel || /(^|\/)\.\.(\/|$)/.test(rel) || path.isAbsolute(rel)) throw bad("no such result");
  const src = path.join(mocapDir(), rel); if (!fs.existsSync(src) || !/\.(fbx|bvh)$/i.test(src)) throw bad("no such result", 404);
  const model = modelName(rel), dst = path.join(core.projDir(core.getProject()), "models3d", model);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  if (/\.fbx$/i.test(src)) { fs.copyFileSync(src, dst); return { model, via: "copy" }; }
  const exe = require("./blender").find(); if (!exe) throw bad("a .bvh is made an .fbx by Blender - set Blender's path in 🟧 Blender settings, or export FBX from RGB MoCap", 412);
  const code = await run(exe, ["-b", "--factory-startup", "-P", path.join(__dirname, "..", "scripts", "bvh_to_fbx.py"), "--", src, dst], {});
  if (code !== 0 || !fs.existsSync(dst)) throw bad("Blender could not turn the .bvh into an .fbx", 500);
  return { model, via: "blender" };
}
module.exports = { setBase, setRun, setWin, status, install, remove, open, prepare, results, bring, modelName, LINKS, REPO };
