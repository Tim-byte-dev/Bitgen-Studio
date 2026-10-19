// bitGen Studio — lib/aaf.js (2.417.0): the timeline as an AAF for Avid Media Composer and Pro Tools.
//
// Tim: "continue with the next part please the gap is getting smaller - soon bitgen should be superior".
//
//   job(tl, o)          -> the job scripts/aaf_export.py takes: every video layer a picture track (V1 first), V1's sound
//                          + every sound layer a sound track (a stereo file on two mono tracks, L / R), in FRAMES at o.fps;
//                          pictures / text stills and 3D layers are left out (said in `skipped`)
//   write(tl, o, out)   -> Promise {ok, file, video_tracks, audio_tracks, clips, notes, skipped}
// o = lib/interchange's {fps, tc, name, abs(x) -> the file's absolute path}. The media is LINKED (AMA), not copied in.
// Speed / reverse go as the stretch they cover (named in notes); opacity, volume, moves and the grade are not carried -
// the FCP 7 XML carries them for Premiere / Resolve.
"use strict";
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const TC = require("../static/timecode.js");
const ix = require("./interchange");

function core() { return require("./core"); }

function job(tl, o) {
  const fps = (o && o.fps) || 25, it = ix.items(tl || {}), F = (s) => TC.frames(s, fps), skipped = [];
  const track = (t) => ({
    name: t.name,
    items: t.items.filter((x) => {
      if (x.kind === "image") { skipped.push(x.name + " (a still - not carried in the AAF)"); return false; }
      return true;
    }).map((x) => ({ path: o && o.abs ? o.abs(x) : x.name, name: x.name, start: F(x.start), len: Math.max(1, F(x.len)), in: F(x.in),
      speed: x.speed, reverse: x.reverse })),
  });
  const start = o && o.tc && o.tc.start ? TC.parse(o.tc.start, fps, TC.isDrop(o.tc, fps)) || 0 : 0;
  return { name: (o && o.name) || "bitGen timeline", fps, tc_start: start,
    video: it.video.map(track).filter((t) => t.items.length), audio: it.audio.map(track).filter((t) => t.items.length), skipped };
}

function write(tl, o, out) {
  const j = job(tl, o), c = core();
  const missing = [];
  j.video.concat(j.audio).forEach((t) => t.items.forEach((x) => { if (!fs.existsSync(x.path)) missing.push(x.name); }));
  if (missing.length) return Promise.reject(Object.assign(new Error("not found: " + Array.from(new Set(missing)).join(", ")), { status: 404 }));
  if (!j.video.length && !j.audio.length) return Promise.reject(Object.assign(new Error("the timeline has no clips to put in an AAF"), { status: 400 }));
  const py = ((c.getConfig().paths || {}).python) || (process.platform === "win32" ? "python" : "python3");
  return new Promise((resolve, reject) => {
    let so = "", se = "";
    const p = spawn(py, [path.join(c.resolvePath("scripts"), "aaf_export.py"), out], { stdio: ["pipe", "pipe", "pipe"] });
    p.stdout.on("data", (d) => { so += d; });
    p.stderr.on("data", (d) => { se += d; });
    p.on("error", reject);
    p.on("close", (code) => {
      if (code !== 0) {
        const last = se.trim().split("\n").pop() || "the AAF export failed";
        return reject(new Error(/No module named 'aaf2'/.test(se) ? "pyaaf2 is not installed (pip install pyaaf2 - requirements.txt)" : last.slice(0, 300)));
      }
      try { resolve(Object.assign(JSON.parse(so), { skipped: j.skipped })); } catch (e) { reject(e); }
    });
    p.stdin.end(JSON.stringify(j));
  });
}

module.exports = { job, write };
