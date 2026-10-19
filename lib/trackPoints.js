// bitGen Studio — lib/trackPoints.js (2.499.0): 🎯 TRACK POINTS / A PLANE through a clip (scripts/track_points.py -
// template matching to a fraction of a pixel, each point on its own; OpenCV's optical flow + a homography for a flat
// surface). Tim (verbatim): "... and the rest of the After Effects gap list (expressions, Bézier masks, tracking and so
// on).." - the timeline's 🎯 Track (ext/timelinedock/tltrack.js): point, two points (+ scale / rotation), corner pin,
// planar; served by routes/trackpts.js.
//
//   run({name, from, to, mode: "points" | "planar", pts: [[x, y], ...] (0..1 of the frame at <from>), box, width})
//     -> Promise {fps, track: [{t (source seconds), pts}], method, lost, frames}
"use strict";
const path = require("path");
const { spawn } = require("child_process");

function core() { return require("./core"); }
function bad(msg, status) { const e = new Error(msg); e.status = status || 400; return e; }
const num = (v, d) => { const x = Number(v); return Number.isFinite(x) ? x : d; };

/** the request made safe: -> {name, from, to, mode, pts, box, width} or throws */
function clean(o) {
  const name = path.basename(String((o && o.name) || ""));
  if (!name) throw bad("which clip? (name)");
  const from = Math.max(0, num(o.from, 0)), to = num(o.to, from + 5);
  if (!(to > from + 0.05)) throw bad("nothing to track: the playhead is at the clip's end");
  if (to - from > 600) throw bad("a track of at most 10 minutes at a time");
  const mode = o.mode === "planar" ? "planar" : "points";
  const pts = Array.isArray(o.pts) ? o.pts.slice(0, 8).map((p) => [Math.max(0, Math.min(1, num(p && p[0], 0.5))), Math.max(0, Math.min(1, num(p && p[1], 0.5)))]) : [];
  if (!pts.length) throw bad("which points? (pts: [[x, y], ...] 0..1)");
  if (mode === "planar" && pts.length !== 4) throw bad("a plane is 4 corners");
  return { name, from, to, mode, pts, box: Math.max(0.01, Math.min(0.3, num(o.box, 0.05))), width: Math.round(Math.max(320, Math.min(1920, num(o.width, 960)))) };
}
function run(o) {
  let q; try { q = clean(o || {}); } catch (e) { return Promise.reject(e); }
  const src = require("./asr").findAsset(q.name);
  if (!src) return Promise.reject(bad("not in this project: " + q.name, 404));
  const c = core();
  const py = ((c.getConfig().paths || {}).python) || (process.platform === "win32" ? "python" : "python3");
  const args = [path.join(c.resolvePath("scripts"), "track_points.py"), src, q.from.toFixed(4), q.to.toFixed(4), q.mode, JSON.stringify(q.pts), String(q.box), String(q.width)];
  return new Promise((resolve, reject) => {
    const p = spawn(py, args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "", err = "";
    const kill = setTimeout(() => { try { p.kill(); } catch { /* gone */ } }, 600000);
    p.stdout.on("data", (d) => { out += d; });
    p.stderr.on("data", (d) => { err += d; });
    p.on("error", (e) => { clearTimeout(kill); reject(bad("could not start the tracker: " + e.message, 500)); });
    p.on("close", (code) => {
      clearTimeout(kill);
      if (code !== 0) return reject(bad((err.trim().split("\n").pop() || "the tracker failed").slice(0, 300), 500));
      try { resolve(JSON.parse(out)); } catch { reject(bad("the tracker said nothing useful", 500)); }
    });
  });
}

module.exports = { run, clean };
