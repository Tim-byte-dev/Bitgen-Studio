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
function apply(job, file, log, opts) {
  const o = opts || {};
  const say = log || (() => {});
  const soc = (job && job.params && job.params.social) || null;
  if (!soc || !file || !fs.existsSync(file) || !/\.mp4$/i.test(file)) return Promise.resolve({ skipped: true });
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
module.exports = { FORMATS, PLAIN, forJob, apply };
