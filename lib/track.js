// bitGen Studio — lib/track.js (2.416.0): 🎯 TRACK a mask - what it sits on followed through the clip (scripts/track.py:
// colour template matching, OpenCV's or numpy's). Tim: "continue with the next part please the gap is getting smaller".
//
//   run({name, from, to, x, y, w, h}) -> Promise {track: [{t (source seconds), x, y}], lost, gaps, method, frames}
//     from / to = source seconds (the page sends the position marker's frame of the clip and the clip's end)
// routes/clipfx.js serves POST /api/clipfx/track; the 🎨 Colour panel's mask has 🎯 Track (the page turns the source
// times into seconds into the clip - static/clipfx.js localTime - for fx.mask.track).
"use strict";
const path = require("path");
const { spawn } = require("child_process");

function core() { return require("./core"); }
function bad(msg, status) { const e = new Error(msg); e.status = status || 400; return e; }
const num = (v, d) => { const x = Number(v); return Number.isFinite(x) ? x : d; };

function run(o) {
  const name = path.basename(String((o && o.name) || ""));
  if (!name) return Promise.reject(bad("which clip? (name)"));
  const src = require("./asr").findAsset(name);
  if (!src) return Promise.reject(bad("not in this project: " + name, 404));
  const from = Math.max(0, num(o.from, 0)), to = num(o.to, from + 5);
  if (!(to > from + 0.05)) return Promise.reject(bad("nothing to track: the position marker is at the clip's end"));
  if (to - from > 600) return Promise.reject(bad("a track of at most 10 minutes at a time"));
  const c = core();
  const py = ((c.getConfig().paths || {}).python) || (process.platform === "win32" ? "python" : "python3");
  const args = [path.join(c.resolvePath("scripts"), "track.py"), src, from.toFixed(4), to.toFixed(4)]
    .concat(["x", "y", "w", "h"].map((k) => String(Math.min(k === "w" || k === "h" ? 2 : 1.5, Math.max(k === "w" || k === "h" ? 0.01 : -0.5, num(o[k], k === "w" || k === "h" ? 0.2 : 0.5))))));
  return new Promise((resolve, reject) => {
    const p = spawn(py, args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "", err = "";
    const kill = setTimeout(() => { try { p.kill(); } catch { /* gone */ } }, 300000);
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

module.exports = { run };
