#!/usr/bin/env node
/* bitGen Studio — 2.752.0 units: THE BRAIN FILM, UPSCALED, AND THE ONLY SPLASH.
 * Tim (verbatim): "only use the brain video for the splash screen and the tigerart video, maybe just add the logo to the top left"
 *   + "are you able to upscale the video and make the text more sharp?"
 *   docs/images/bitgen-neural.mp4 (H.264, 1280 x 720 - the website copies it) and the app's static/splash-neural.webm (VP9,
 *   1920 x 1080), 15 s, silent; misc/brand/upscale_brain.py makes them (Real-ESRGAN general-x4v3 through ONNX Runtime - no
 *   PyTorch, a maintainer's tool the app never loads), its downloaded weights kept out of git; splash.html plays only the brain
 *   with the logo; docs/BRAND.md says so. ffprobe missing = those legs SKIP. */
"use strict";
const fs = require("fs"), path = require("path"), { execFileSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 500))); } };
const R = (...p) => path.join(ROOT, ...p), rd = (...p) => fs.readFileSync(R(...p), "utf8");
const probe = (f) => { try { return execFileSync("ffprobe", ["-v", "error", "-show_entries", "stream=codec_type,codec_name,width,height:format=duration", "-of", "json", R(f)], { encoding: "utf8" }); } catch { return null; } };
for (const [f, codec, w, h] of [["docs/images/bitgen-neural.mp4", "h264", 1280, 720], ["static/splash-neural.webm", "vp9", 1920, 1080]]) {
  const j = probe(f);
  if (j === null) { console.log("SKIP: no ffprobe here (or no " + f + ")"); continue; }
  const p = JSON.parse(j), v = p.streams.find((s) => s.codec_type === "video");
  check(f + ": " + codec + ", " + w + " x " + h + ", 15 s, no sound (the upscaled brain), small enough (< 8 MB)", v && v.codec_name === codec && v.width === w && v.height === h && fs.statSync(R(f)).size < 8e6
    && Math.abs(+p.format.duration - 15) < 0.3 && !p.streams.some((s) => s.codec_type === "audio"), { v, d: p.format.duration });
}
const up = rd("misc", "brand", "upscale_brain.py");
check("misc/brand/upscale_brain.py: Real-ESRGAN general-x4v3 (its release on GitHub) through ONNX Runtime, no PyTorch; writes both films via temporary names",
  /realesr-general-x4v3\.pth/.test(up) && /import onnx, onnxruntime as ort/.test(up) && !/import torch/.test(up) && /docs" \/ "images" \/ "bitgen-neural\.mp4"/.test(up)
  && /"static" \/ "splash-neural\.webm"/.test(up) && /t1\.replace\(mp4\); t2\.replace\(webm\)/.test(up));
check("…its downloaded weights stay out of git (.gitignore misc/brand/.cache/)", /^\/misc\/brand\/\.cache\/$/m.test(rd(".gitignore")));
check("…and the app never loads it (nothing in lib / routes / static / electron names it)", ["lib", "routes", "static", "electron"].every((d) =>
  fs.readdirSync(R(d)).filter((f) => /\.(js|html)$/.test(f)).every((f) => !/upscale_brain/.test(fs.readFileSync(R(d, f), "utf8")))));
const sp = rd("static", "splash.html");
check("splash.html: only the brain film (no orange film, no random pick), the logo (icon.png) in the top left", /v\.src = "splash-neural\.webm"/.test(sp) && !/"splash\.webm"|Math\.random/.test(sp)
  && /<img id="mark" alt="" src="icon\.png">/.test(sp) && /#mark \{ position: absolute; left: 2\.6%; top: 4%;/.test(sp) && !fs.existsSync(R("static", "splash.webm")));
const br = rd("docs", "BRAND.md");
check("docs/BRAND.md: the splash is the brain film with the logo; the upscaled master and its script", /static\/splash-neural\.webm/.test(br) && /docs\/images\/bitgen-neural\.mp4/.test(br) && /misc\/brand\/upscale_brain\.py/.test(br));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
