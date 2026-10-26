#!/usr/bin/env node
/* bitGen Studio — scripts/test-socialfmt600.js (2.600.0): Basic Settings ▸ Format ▸ 📱 SOCIAL MEDIA.
 * Tim: "please ad the social media video presets to the basic settings dropdown as well for quick access".
 *   lib/socialFormat.js   forJob (a social choice = an mp4 render + social {aspect}), apply (REAL: python
 *                         scripts/social.py --convert on a made MP4 - in place, 9:16 cut, H.264 High, AAC 48 kHz stereo
 *                         from a movie with no sound, faststart; a broken file = kept, said) - needs ffmpeg, else SKIP
 *   scripts/social.py     target (the biggest frame of the shape inside the render, 1080 at most, no upscale)
 *   lib/core.js           a finished job with params.social is converted BEFORE it is filed
 *   routes                /api/generate, the Wan path, the music video, /api/ltx
 *   the page              the Format dropdowns' optgroup, static/socialfmt.js (Aspect follows, the line under it)
 * Temp files only. */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0, skip = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const rd = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const SF = require("../lib/socialFormat");
const W = require("../static/socialfmt.js");

(async () => {
  try {
    check("forJob: the five social choices = an mp4 render + social {aspect}; mp4 / webm / avi as before; junk = mp4",
      JSON.stringify(SF.forJob("social_9x16")) === '{"format":"mp4","social":{"aspect":"9:16","choice":"social_9x16"}}' && SF.forJob("social_4x5").social.aspect === "4:5"
      && SF.forJob("social").social.aspect === "source" && JSON.stringify(SF.forJob("webm")) === '{"format":"webm"}' && JSON.stringify(SF.forJob("<x>")) === '{"format":"mp4"}');
    check("the page's rule: 9:16 / 1:1 / 16:9 set Aspect to the same, the feed's 4:5 renders 3:4; the line says what happens",
      JSON.stringify(W.ASPECT) === '{"social_9x16":"9:16","social_4x5":"3:4","social_1x1":"1:1","social_16x9":"16:9"}' && /made ready for Facebook \/ Instagram \/ TikTok: 9:16/.test(W.words("social_9x16")) && W.words("mp4") === "");
    const py = ["python3", "python"].find((p) => spawnSync(p, ["-c", "print(1)"]).status === 0);
    const tg = spawnSync(py, ["-c", "import sys; sys.path.insert(0, " + JSON.stringify(path.join(ROOT, "scripts")) + "); import social as S; print(S.target(1280,720,'9:16'), S.target(540,720,'4:5'), S.target(3840,2160,'source'), S.target(1080,1920,'9:16'))"], { encoding: "utf8" });
    check("social.target: the biggest frame of the shape inside the render (no upscale), 1080 on the short side at most", tg.stdout.trim() === "(404, 720) (540, 676) (1920, 1080) (1080, 1920)", tg.stdout + tg.stderr);
    if (spawnSync("ffmpeg", ["-version"]).status !== 0) { skip++; console.log("SKIP: the real conversion (no ffmpeg here)"); }
    else {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bg-sf600-"));
      const f = path.join(tmp, "render.mp4");
      spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc2=s=1280x720:r=24:d=2", "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv444p", f]);
      const lines = [];
      const r = await SF.apply({ params: { social: { aspect: "9:16" } } }, f, (l) => lines.push(l), { python: py });
      const pr = JSON.parse(spawnSync("ffprobe", ["-v", "error", "-show_entries", "stream=codec_type,codec_name,profile,pix_fmt,width,height,sample_rate,channels", "-of", "json", f], { encoding: "utf8" }).stdout);
      const v = pr.streams.find((s) => s.codec_type === "video"), a = pr.streams.find((s) => s.codec_type === "audio");
      check("apply: the render converted IN PLACE - 404x720 (9:16 cut from 1280x720), H.264 High yuv420p, a silent AAC 48 kHz stereo track; the log says ready",
        r.ok && v.width === 404 && v.height === 720 && v.profile === "High" && v.pix_fmt === "yuv420p" && a && a.codec_name === "aac" && a.sample_rate === "48000" && a.channels === 2
        && !fs.existsSync(path.join(tmp, "render.social.mp4")) && lines.some((l) => /ready for Facebook \/ Instagram \/ TikTok/.test(l)), { r, v, a, lines });
      fs.writeFileSync(path.join(tmp, "broken.mp4"), "not a video");
      const lines2 = [];
      const r2 = await SF.apply({ params: { social: { aspect: "1:1" } } }, path.join(tmp, "broken.mp4"), (l) => lines2.push(l), { python: py });
      check("apply: a file it cannot convert is kept as it was, and said (never a throw)", r2.error && fs.readFileSync(path.join(tmp, "broken.mp4"), "utf8") === "not a video" && lines2.some((l) => /the plain MP4 is kept/.test(l)), { r2, lines2 });
      const r3 = await SF.apply({ params: {} }, f, () => {});
      check("apply: a job without the social choice is left alone", r3.skipped === true);
      fs.rmSync(tmp, { recursive: true, force: true });
    }
    const C = rd("lib", "core.js"), R = rd("routes", "index.js"), L = rd("routes", "ltx.js"), H = rd("static", "index.html");
    check("lib/core.js converts a finished social job BEFORE it is filed (the job stays running meanwhile), then the usual close",
      /job\.params\.social && job\.output && !TOOL_MODES\.includes\(job\.params\.mode\) && !job\._social/.test(C) && /require\("\.\/socialFormat"\)\.apply\(job, f, \(l\) => log\(job, l\)\)\.then\(\(\) => closed\(code\), \(\) => closed\(code\)\)/.test(C) && /function closed\(code\) \{/.test(C));
    check("the routes: /api/generate + the music video (forJob), the Wan path, /api/ltx carry the social choice",
      (R.match(/\.\.\.socialFormat\.forJob\(/g) || []).length === 2 && /socialFormat\.forJob\(f\.format\)\.social \? \{ social:/.test(R) && /socialFormat"\)\.forJob\(b\.format\); if \(sf\.social\) p\.social = sf\.social;/.test(L));
    check("the page: Basic Settings' Format + the music video's Format have the 📱 Social media group (9:16, 4:5, 1:1, 16:9, own shape); the line; LTX sends the Format; socialfmt.js loaded",
      (H.match(/<optgroup label="📱 Social media \(Facebook \/ Instagram \/ TikTok\)">/g) || []).length === 2 && /value="social_9x16">mp4 · Reels \/ Stories 9:16/.test(H) && /value="social_4x5">mp4 · Facebook feed 4:5/.test(H)
      && /id="formatSocial"/.test(H) && /fd\.append\("format", \$\("format"\)\.value\)/.test(H) && /<script src="\/static\/socialfmt\.js">/.test(H));
  } catch (e) { fail++; console.log("FAIL: crashed - " + (e && e.stack || e)); }
  console.log(`\n${pass} passed, ${fail} failed${skip ? ", " + skip + " skipped" : ""}`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
