// bitGen Studio — lib/socialFormat.js (2.600.0): Basic Settings ▸ Format ▸ SOCIAL MEDIA - a render comes out as a file
// Facebook / Instagram / TikTok take as it is.
//
// Tim: "please ad the social media video presets to the basic settings dropdown as well for quick access".
//   The Format dropdown's social choices (static/socialfmt.js also sets Aspect to match, so the model renders that
//   shape): social (the render's own shape), social_9x16 (Reels / Stories), social_4x5 (the Facebook feed - rendered 3:4,
//   cut to 4:5), social_1x1, social_16x9. The worker renders an ordinary MP4; when the job finishes, BEFORE it is
//   filed (lib/core.js), scripts/social.py --convert puts the 📤 Export preset's settings on it in place: H.264 High
//   8-bit, AAC 48 kHz stereo (a silent track when there is no sound), a steady frame rate, faststart, no timecode, the
//   short side at most 1080, the shape cut from the middle - and checks it (the log says "ready for …").
//   FORMATS                {value: aspect}
//   forJob(fmt)            -> {format: "mp4", social: {aspect}} for a social choice, else {format} (mp4 | webm | avi)
//   apply(job, file, log, opts) -> a promise (never rejects): the file converted in place, or left as it was (said)
//   shapeFor(aspect, w, h) -> {aspect, note}  2.907.0: a shape of another orientation than the render asked = its own
"use strict";
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const FORMATS = { social: "source", social_9x16: "9:16", social_4x5: "4:5", social_1x1: "1:1", social_16x9: "16:9" };
const PLAIN = ["mp4", "webm", "avi"];
function forJob(fmt) {
  const f = String(fmt || "");
  if (Object.prototype.hasOwnProperty.call(FORMATS, f)) return { format: "mp4", social: { aspect: FORMATS[f], choice: f } };
  return { format: PLAIN.includes(f) ? f : "mp4" };
}
/** 2.907.0 (Tim: "every video i tried only renders 16:9"): a social shape that does not match the shape the render was
 *  ASKED for (a 9:16 render with Format "Landscape 16:9" left on) cut the take to a band from its middle - every render
 *  came out 16:9. Landscape / portrait / square are compared: the same orientation = the social shape (16:9 from a 4:3
 *  render, the feed's 4:5 from its 3:4); another orientation = the render's own shape, said. Pure.
 *  -> {aspect, note} */
function orient(w, h) { return Math.abs(w - h) <= Math.max(w, h) * 0.02 ? "square" : w > h ? "landscape" : "portrait"; }
function shapeFor(aspect, w, h) {
  const a = String(aspect || "source");
  const W = parseInt(w, 10), H = parseInt(h, 10);
  if (a === "source" || !(W > 0 && H > 0)) return { aspect: a, note: "" };
  const [aw, ah] = a.split(":").map(Number);
  if (!(aw > 0 && ah > 0)) return { aspect: "source", note: "" };
  const want = orient(aw, ah), got = orient(W, H);
  if (want === got) return { aspect: a, note: "" };
  return { aspect: "source", note: `the render was asked at ${W}x${H} (${got}) but Format says ${a} (${want}) - its own shape is kept, `
    + "not cut to a band; pick the matching 📱 preset (or \"the render's own shape\") in Basic Settings ▸ Format" };
}
function apply(job, file, log, opts) {
  const o = opts || {};
  const say = log || (() => {});
  let soc = (job && job.params && job.params.social) || null;
  if (!soc || !file || !fs.existsSync(file) || !/\.mp4$/i.test(file)) return Promise.resolve({ skipped: true });
  { const pr = job.params || {};
    const sh = shapeFor(soc.aspect, pr._req_w || pr.width, pr._req_h || pr.height);
    if (sh.note) { say(`[social] ${sh.note}`); soc = Object.assign({}, soc, { aspect: sh.aspect }); } }
  const tmp = file.replace(/\.mp4$/i, ".social.mp4");
  const py = o.python || (() => { try { return require("./core").getConfig().python || "python"; } catch { return "python"; } })();
  const script = o.script || path.join(__dirname, "..", "scripts", "social.py");
  say(`[social] making ${path.basename(file)} ready for Facebook / Instagram / TikTok (${soc.aspect === "source" ? "its own shape" : soc.aspect})…`);
  return new Promise((resolve) => {
    let out = "", err = "";
    let p;
    try { p = spawn(py, [script, "--convert", file, tmp, "--aspect", soc.aspect || "source", "--fit", "crop"], { windowsHide: true }); }
    catch (e) { say(`[social] could not run Python (${e.message}) - the plain MP4 is kept`); return resolve({ error: e.message }); }
    const timer = setTimeout(() => { try { p.kill(); } catch { /* gone */ } }, o.timeout_ms || 20 * 60000);
    p.stdout.on("data", (d) => { out += d; });
    p.stderr.on("data", (d) => { err += d; });
    p.on("error", (e) => { clearTimeout(timer); say(`[social] ${e.message} - the plain MP4 is kept`); resolve({ error: e.message }); });
    p.on("close", () => {
      clearTimeout(timer);
      let j = null;
      try { j = JSON.parse(out.trim().split("\n").pop() || "null"); } catch { j = null; }
      if (!j || j.error || !fs.existsSync(tmp)) {
        try { fs.unlinkSync(tmp); } catch { /* none */ }
        say(`[social] could not convert it (${(j && j.error) || err.trim().split("\n").pop() || "no answer"}) - the plain MP4 is kept`);
        return resolve({ error: (j && j.error) || "failed" });
      }
      try { fs.renameSync(tmp, file); } catch (e) {
        try { fs.copyFileSync(tmp, file); fs.unlinkSync(tmp); } catch (e2) { say(`[social] could not replace the file (${e2.message})`); return resolve({ error: e2.message }); }
      }
      say(`[social] ${j.w}x${j.h} at ${j.fps} fps (from ${j.from[0]}x${j.from[1]}) - ${j.check.summary}`);
      for (const n of j.check.notes || []) say(`[social] note: ${n}`);
      resolve(j);
    });
  });
}
module.exports = { FORMATS, PLAIN, forJob, apply, shapeFor };
