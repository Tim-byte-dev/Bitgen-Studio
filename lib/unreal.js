/* bitGen Studio — lib/unreal.js (2.472.0): the UNREAL ENGINE 5.8 BRIDGE on the server.
 *
 * Tim (verbatim): "can we add an unreal engine 5.8 bridge, get ue5.8 scenes/projects and render them in our timeline,
 * unreal models/assets metahuman and render in our image editor and timeline we can add metahuman layer, ue5.8 layer,
 * ue5.8 camera in our timeline?"
 *
 * The Unreal side is the bitGen Bridge plugin (ue/bitGenBridge - Python in the editor, a small HTTP server on
 * 127.0.0.1:30020). This file talks to it, keeps where the pictures go, and turns rendered frames into videos.
 *
 *   settings() / saveSettings(o)  {host, port, alphaInverted} (config.unreal) - Settings ▸ 3D ▸ Unreal Engine
 *   call(cmd, args, ms)           -> the bridge's answer (throws {status 503} when the editor is not reachable)
 *   status()                      {connected, engine, project, level, bridge} | {connected: false, error}
 *   list(kind)                    levels | sequences | metahumans | anims | cameras -> items
 *   still(o)                      ONE PICTURE: o = {level?, camera {name | loc, rot, fov | viewport, yaw?, pitch?, dolly?},
 *                                 metahuman? {bp, anim?, time?, loc?, rot?}, onlyMetahuman?, w, h, alpha} ->
 *                                 {name} (projects/<p>/unreal/stills/<name>.png - GET /api/unreal/file/<name>)
 *   render(o)                     A VIDEO: o = {sequence? | camera_keys? [{t, loc, rot, fov}], metahuman?, level?, fps,
 *                                 frames, w, h, alpha} -> {job}; the frames land in projects/<p>/unreal/jobs/<job>/
 *   job(id)                       {state: running | encoding | done | error, frames, of, video (in the project's
 *                                 video folder - a timeline clip), dur, error}
 *   cleanStill(o) / cleanRender(o)  the checks (pure)
 * Routes: routes/unreal.js. Tests: scripts/test-unreal.js against scripts/ue-stub.js (a stand-in for the editor).
 */
"use strict";
const fs = require("fs");
const path = require("path");
const http = require("http");
const { execFile } = require("child_process");
const core = require("./core");
const UERig = require("../static/uerig.js");          // 2.476.0: the lights + fog rules, the same file the page uses

const LISTS = ["levels", "sequences", "metahumans", "anims", "cameras"];
const bad = (m, status) => { const e = new Error(m); e.status = status || 400; return e; };

function settings() {
  const c = (core.getConfig() || {}).unreal || {};
  const port = Math.round(Number(c.port) || 30020);
  return { host: "127.0.0.1", port: port > 0 && port < 65536 ? port : 30020, alphaInverted: !!c.alphaInverted };
}
function saveSettings(o) {
  const cfg = core.getConfig() || {}, cur = settings();
  const port = o && o.port != null ? Math.round(Number(o.port)) : cur.port;
  if (!(port > 0 && port < 65536)) throw bad("the port is 1 - 65535");
  cfg.unreal = { port, alphaInverted: o && o.alphaInverted != null ? !!o.alphaInverted : cur.alphaInverted };
  core.setConfig(cfg);
  return settings();
}

/** one request to the bridge (always this computer - the host is fixed to 127.0.0.1) */
function call(cmd, args, ms) {
  const s = settings(), body = JSON.stringify({ cmd, args: args || {} });
  return new Promise((ok, no) => {
    const req = http.request({ host: s.host, port: s.port, path: "/bitgen", method: "POST", headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) }, timeout: ms || 60000 }, (res) => {
      let buf = ""; res.setEncoding("utf8"); res.on("data", (d) => { buf += d; });
      res.on("end", () => {
        let j = null; try { j = JSON.parse(buf); } catch (e) { return no(bad("the Unreal bridge sent something that is not JSON", 502)); }
        if (!j.ok) return no(bad("Unreal: " + (j.error || "failed"), res.statusCode === 422 ? 422 : 502));
        ok(j);
      });
    });
    req.on("timeout", () => { req.destroy(bad("Unreal did not answer in time", 504)); });
    req.on("error", (e) => no(e.status ? e : bad(`the Unreal Editor is not reachable on 127.0.0.1:${s.port} - open your project with the bitGen Bridge plugin (Output Log: "[bitGen Bridge] listening")`, 503)));
    req.end(body);
  });
}
async function status() {
  try { const j = await call("ping", {}, 5000); return { connected: true, engine: j.engine, project: j.project, level: j.level, bridge: j.bridge, port: settings().port }; }
  catch (e) { return { connected: false, error: e.message, port: settings().port }; }
}
async function list(kind, args) {
  if (!LISTS.includes(kind)) throw bad("unknown list " + kind);
  const j = await call(kind, args || {});
  return j.items || [];
}

function uDir(...p) { const d = path.join(core.projDir(core.getProject()), "unreal", ...p); fs.mkdirSync(d, { recursive: true }); return d; }
const num = (v, d) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
const vec = (a) => (Array.isArray(a) && a.length >= 3 && a.slice(0, 3).every((x) => Number.isFinite(Number(x))) ? a.slice(0, 3).map(Number) : null);
const assetPath = (p) => (typeof p === "string" && /^\/[A-Za-z0-9_\-/. ]+$/.test(p) && !p.includes("..") ? p : null);
function cleanCamera(c) {
  c = c || {};
  if (c.name) return { name: String(c.name).slice(0, 200), yaw: num(c.yaw, 0), pitch: num(c.pitch, 0), dolly: num(c.dolly, 0), fov: c.fov != null ? Math.max(5, Math.min(170, num(c.fov, 60))) : undefined };
  if (c.loc) { const loc = vec(c.loc), rot = vec(c.rot || [0, 0, 0]); if (!loc || !rot) throw bad("the camera's place is not 3 numbers"); return { loc, rot, fov: Math.max(5, Math.min(170, num(c.fov, 60))) }; }
  return { viewport: true, fov: Math.max(5, Math.min(170, num(c.fov, 90))) };
}
function cleanMetahuman(m) {
  if (!m) return null;
  const bp = assetPath(m.bp); if (!bp) throw bad("pick a MetaHuman");
  const o = { bp, time: Math.max(0, num(m.time, 0)) };
  if (m.anim) { o.anim = assetPath(m.anim); if (!o.anim) throw bad("the animation is not an asset path"); }
  if (m.loc) o.loc = vec(m.loc); if (m.rot) o.rot = vec(m.rot);
  return o;
}
/** 2.475.0: a lens {focal mm, sensor mm, fstop, focus cm, exposure EV} - each kept in range, the missing ones left out */
function cleanLens(l) {
  if (!l || typeof l !== "object") return null;
  const o = {}, put = (k, lo, hi) => { if (l[k] != null && l[k] !== "") { const n = Number(l[k]); if (Number.isFinite(n)) o[k] = Math.max(lo, Math.min(hi, n)); } };
  put("focal", 4, 1200); put("sensor", 2, 100); put("fstop", 0.7, 32); put("focus", 0, 1e7); put("exposure", -15, 15);
  return Object.keys(o).length ? o : null;
}
/** 2.476.0: lights + fog (static/uerig.js norm: types, ranges, colours; 32 lights at most) - null when there is nothing */
function cleanRig(r) {
  if (!r || typeof r !== "object") return null;
  const n = UERig.norm(r);
  return UERig.empty(n) && !n.keep ? null : n;
}
const size = (v, d) => Math.max(16, Math.min(8192, Math.round(num(v, d))));
function cleanStill(o) {
  o = o || {};
  const c = { camera: cleanCamera(o.camera), w: size(o.w, 1280), h: size(o.h, 720), alpha: !!o.alpha, only_metahuman: !!o.onlyMetahuman };
  if (o.level) { c.level = assetPath(o.level); if (!c.level) throw bad("the level is not an asset path"); }
  const m = cleanMetahuman(o.metahuman); if (m) c.metahuman = m;
  const ln = cleanLens(o.lens); if (ln) c.lens = ln;
  const rg = cleanRig(o.rig); if (rg) c.rig = rg;
  return c;
}
function cleanRender(o) {
  o = o || {};
  const c = { fps: Math.max(1, Math.min(120, Math.round(num(o.fps, 24)))), w: size(o.w, 1280), h: size(o.h, 720), alpha: !!o.alpha };
  c.frames = Math.max(1, Math.min(24 * 60 * 10, Math.round(num(o.frames, c.fps * 5))));
  if (o.level) { c.level = assetPath(o.level); if (!c.level) throw bad("the level is not an asset path"); }
  if (o.sequence) { c.sequence = assetPath(o.sequence); if (!c.sequence) throw bad("the sequence is not an asset path"); }
  if (Array.isArray(o.camera_keys) && o.camera_keys.length) {
    c.camera_keys = o.camera_keys.slice(0, 2000).map((k) => { const loc = vec(k.loc), rot = vec(k.rot || [0, 0, 0]); if (!loc || !rot) throw bad("a camera key's place is not 3 numbers"); return { t: Math.max(0, num(k.t, 0)), loc, rot, fov: Math.max(5, Math.min(170, num(k.fov, 60))) }; })
      .sort((a, b) => a.t - b.t);
  }
  const m = cleanMetahuman(o.metahuman); if (m) c.metahuman = m;
  const ln = cleanLens(o.lens); if (ln) c.lens = ln;
  const rg = cleanRig(o.rig); if (rg) c.rig = rg;
  if (!c.sequence && !c.camera_keys && !c.metahuman) throw bad("pick a Level Sequence, or give camera keys / a MetaHuman");
  if (c.metahuman && !c.camera_keys && !c.sequence) throw bad("a MetaHuman needs a camera (camera keys)");
  return c;
}

let seq = 0;
const stamp = () => Date.now().toString(36) + (++seq).toString(36);
async function still(o) {
  const c = cleanStill(o), name = "ue_" + stamp() + ".png", out = path.join(uDir("stills"), name);
  c.out = out;
  const j = await call("still", c, 300000);
  if (!fs.existsSync(out)) throw bad("Unreal said it was done but no picture arrived (" + (j.out || out) + ")", 502);
  return { name, w: c.w, h: c.h, camera: j.camera || null, alphaInverted: settings().alphaInverted };
}
function stillPath(name) {
  if (!/^ue_[a-z0-9]+\.png$/.test(String(name))) throw bad("no such picture", 404);
  const p = path.join(uDir("stills"), name); if (!fs.existsSync(p)) throw bad("no such picture", 404); return p;
}

const JOBS = new Map();
async function render(o) {
  const c = cleanRender(o), id = "j" + stamp(), dir = uDir("jobs", id);
  c.out_dir = dir;
  const j = await call("render", c, 300000);
  JOBS.set(id, { id, ue: j.job, state: "running", frames: 0, of: c.frames, fps: c.fps, alpha: c.alpha, dir, video: null, dur: 0, error: "", sequence: j.sequence || c.sequence || "" });
  return { job: id, of: c.frames, sequence: j.sequence || c.sequence || "" };
}
function framesIn(dir) { try { return fs.readdirSync(dir).filter((f) => /^f_\d{5}\.png$/.test(f)).sort(); } catch (e) { return []; } }
function ffmpeg(args) {
  return new Promise((ok, no) => execFile("ffmpeg", args, { maxBuffer: 8 * 1024 * 1024 }, (err, _o, se) => (err ? no(new Error(String(se || err.message).trim().split("\n").slice(-2).join(" "))) : ok())));
}
async function encode(J) {
  const files = framesIn(J.dir); if (!files.length) throw bad("no frames arrived", 502);
  core.ensureProject(core.getProject());
  const vdir = core.pDir("video"); fs.mkdirSync(vdir, { recursive: true });
  const start = Number(files[0].slice(2, 7)), alpha = J.alpha;
  const name = `ue_${J.id}.${alpha ? "webm" : "mp4"}`, out = path.join(vdir, name), tmp = path.join(vdir, `.ue_${J.id}.tmp.${alpha ? "webm" : "mp4"}`);
  const vf = alpha && settings().alphaInverted ? ["-vf", "lutrgb=a=negval"] : [];
  const args = ["-y", "-loglevel", "error", "-framerate", String(J.fps), "-start_number", String(start), "-i", path.join(J.dir, "f_%05d.png"), ...vf];
  if (alpha) args.push("-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p", "-auto-alt-ref", "0", "-b:v", "0", "-crf", "24", "-row-mt", "1", "-deadline", "good", "-cpu-used", "4", "-f", "webm", tmp);
  else args.push("-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", "-preset", "medium", "-movflags", "+faststart", "-f", "mp4", tmp);
  await ffmpeg(args);
  fs.renameSync(tmp, out);
  fs.rmSync(J.dir, { recursive: true, force: true });
  return { name, dur: files.length / J.fps, frames: files.length };
}
async function job(id) {
  const J = JOBS.get(String(id)); if (!J) throw bad("no such render", 404);
  if (J.state === "running") {
    let s = null; try { s = await call("job", { id: J.ue }, 10000); } catch (e) { s = { state: "running" }; }
    J.frames = framesIn(J.dir).length;
    if (s.state === "error") { J.state = "error"; J.error = s.error || "Unreal could not render it"; }
    else if (s.state === "done") {
      J.state = "encoding";
      encode(J).then((r) => { J.state = "done"; J.video = r.name; J.dur = r.dur; J.frames = r.frames; }).catch((e) => { J.state = "error"; J.error = e.message; });
    }
  }
  return { state: J.state, frames: J.frames, of: J.of, video: J.video, dur: J.dur, error: J.error, sequence: J.sequence };
}

/** 2.540.0: the level's mesh actors on a w x h picture through the still's camera -> {camera, objects: [{name, cls, box}]}
 *  (the ones in view only; nearest first) - the 🖼 References list (static/realrefs.js ueBox) */
async function actorsInView(o) {
  const c = cleanStill(o || {});
  const j = await call("actors_in_view", { camera: c.camera, level: c.level }, 60000);
  const RR = require("../static/realrefs.js"), cam = j.camera || {};
  const objects = (j.actors || []).map((a) => ({ name: String(a.label || "").slice(0, 120), cls: String(a.cls || "").slice(0, 80), box: Array.isArray(a.origin) && Array.isArray(a.extent) ? RR.ueBox(cam, c.w, c.h, a.origin, a.extent) : null }))
    .filter((x) => x.name && x.box && !(x.box[0] <= 0.001 && x.box[1] <= 0.001 && x.box[2] >= 0.999 && x.box[3] >= 0.999));
  return { camera: cam, w: c.w, h: c.h, objects };
}
/** 2.475.0: Unreal's level viewport looks through a camera {loc, rot} */
async function setViewport(o) {
  const loc = vec(o && o.loc), rot = vec((o && o.rot) || [0, 0, 0]); if (!loc || !rot) throw bad("the camera's place is not 3 numbers");
  return call("set_viewport", { loc, rot }, 10000);
}
/** 2.475.0: click to focus - the distance to what is under (u, v) of the camera's picture */
async function focusAt(o) {
  o = o || {};
  const u = Math.max(0, Math.min(1, num(o.u, 0.5))), v = Math.max(0, Math.min(1, num(o.v, 0.5)));
  const j = await call("focus_at", { camera: cleanCamera(o.camera), u, v, aspect: Math.max(0.1, Math.min(10, num(o.aspect, 16 / 9))) }, 20000);
  return { hit: !!j.hit, focus: j.focus || 0, at: j.at || null };
}
module.exports = { actorsInView, cleanRig, setViewport, focusAt, cleanLens, LISTS, settings, saveSettings, call, status, list, cleanStill, cleanRender, cleanCamera, still, stillPath, render, job, framesIn, JOBS };
