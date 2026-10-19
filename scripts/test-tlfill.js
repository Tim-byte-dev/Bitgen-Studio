#!/usr/bin/env node
/* bitGen Studio — 2.380.0: the timeline canvas's ✨ Fill on disk (lib/tlFill.js, routes/tlCanvas.js).
 * Run: node scripts/test-tlfill.js
 * Tim: "add a selection box and masking tools - allow user to generate an image or video in that selection that blends
 * with the rest of the scene".
 *   1. saveLayer: a PNG -> images/layer_<id>.png; not a PNG / no id: refused;
 *   2. maskVideo: a rendered clip scaled to the selection's box with the feathered mask as its ALPHA -> a VP9 webm with
 *      alpha (alpha_mode=1) in the video assets, as long as the clip (the looped mask never runs on);
 *   3. the routes (raw PNG upload, JSON in / out);
 *   4. the wiring: fill.js registers ⬚ Select (M) and 🖌 Mask (B), inpaints through /api/aiedit, animates through
 *      /api/generate (fl2va), masks through /api/tlcanvas/maskvideo, new layers through TlCanvas.newLayer. */
"use strict";
const fs = require("fs");
const path = require("path");
const http = require("http");
const { execFileSync } = require("child_process");
let pass = 0, fail = 0;
function check(name, ok, extra) {
  if (ok) { pass++; console.log("PASS: " + name); }
  else { fail++; console.log("FAIL: " + name + (extra !== undefined ? " :: " + JSON.stringify(extra).slice(0, 600) : "")); }
}
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const core = require(path.join(ROOT, "lib", "core"));
const TF = require(path.join(ROOT, "lib", "tlFill"));

function send(port, method, u, body, type) {
  return new Promise((ok, no) => {
    const data = body == null ? null : Buffer.isBuffer(body) ? body : Buffer.from(JSON.stringify(body));
    const r = http.request({ host: "127.0.0.1", port, path: u, method,
      headers: data ? { "Content-Type": type || "application/json", "Content-Length": data.length } : {} }, (res) => {
      let b = ""; res.on("data", (c) => { b += c; });
      res.on("end", () => { let j = null; try { j = JSON.parse(b); } catch { j = { raw: b.slice(0, 80) }; } ok({ status: res.statusCode, j }); });
    });
    r.on("error", no); if (data) r.write(data); r.end();
  });
}
const ff = (a) => execFileSync("ffmpeg", ["-y", "-loglevel", "error"].concat(a));

(async () => {
  const P = "zz_fill380_" + process.pid, orig = core.getProject();
  core.ensureProject(P); core.setProject(P);
  const pd = core.projDir(P);
  try {
    // 1
    const png = ff(["-f", "lavfi", "-i", "color=c=white:s=40x20", "-frames:v", "1", "-f", "image2pipe", "-vcodec", "png", "-"]);
    const r1 = TF.saveLayer("abc", png);
    check("saveLayer: images/layer_<id>.png", r1.name === "layer_abc.png" && fs.readFileSync(path.join(pd, "images", "layer_abc.png")).equals(png));
    let e1 = null; try { TF.saveLayer("x", Buffer.from("nope")); } catch (e) { e1 = e; }
    let e2 = null; try { TF.saveLayer("", png); } catch (e) { e2 = e; }
    check("...not a PNG / no id: refused (400)", e1 && e1.status === 400 && e2 && e2.status === 400);

    // 2: a 2 s clip + a mask whose LEFT half is white (keep), right half black
    ff(["-f", "lavfi", "-i", "color=c=red:s=320x240:r=24:d=2", "-c:v", "libx264", "-pix_fmt", "yuv420p", path.join(pd, "output", "clip.mp4")]);
    ff(["-f", "lavfi", "-i", "color=c=white:s=100x80", "-f", "lavfi", "-i", "color=c=black:s=100x80", "-filter_complex", "hstack", "-frames:v", "1", path.join(pd, "images", "layer_m1.png")]);
    const t0 = Date.now();
    const mv = await TF.maskVideo({ id: "v1", output: "clip.mp4", mask: "layer_m1.png", width: 200, height: 80 });
    const dst = path.join(pd, "video", mv.name);
    const probe = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=codec_name,width,height:stream_tags=alpha_mode",
      "-of", "json", dst], { encoding: "utf8" })).streams[0];
    const raw = execFileSync("ffmpeg", ["-loglevel", "error", "-c:v", "libvpx-vp9", "-i", dst, "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgba", "-"]);
    const a = (x, y) => raw[(y * 200 + x) * 4 + 3];
    check("maskVideo: video/fillv_<id>.webm, VP9 with alpha, the box's size, as long as the clip, quickly (no endless mask loop)",
      mv.name === "fillv_v1.webm" && probe.codec_name === "vp9" && probe.width === 200 && probe.height === 80
      && String((probe.tags || {}).alpha_mode || (probe.tags || {}).ALPHA_MODE) === "1" && Math.abs((mv.dur || 0) - 2) < 0.15 && Date.now() - t0 < 60000, { mv, probe });
    check("...the mask IS the alpha: opaque where it is white (left), transparent where black (right)", a(20, 40) > 230 && a(180, 40) < 20, [a(20, 40), a(180, 40)]);

    // 3: routes
    const express = require("express");
    const app = express();
    require(path.join(ROOT, "routes", "index.js")).mount(app);
    const srv = app.listen(0, "127.0.0.1"); await new Promise((ok) => srv.once("listening", ok));
    const port = srv.address().port;
    let r = await send(port, "POST", "/api/tlcanvas/layer?id=r1", png, "image/png");
    check("POST /api/tlcanvas/layer (raw PNG)", r.status === 200 && r.j.name === "layer_r1.png", r);
    r = await send(port, "POST", "/api/tlcanvas/maskvideo", { id: "r2", output: "clip.mp4", mask: "layer_m1.png", width: 100, height: 40 });
    check("POST /api/tlcanvas/maskvideo -> {name, dur}", r.status === 200 && r.j.name === "fillv_r2.webm" && r.j.dur > 1.8, r);
    r = await send(port, "POST", "/api/tlcanvas/maskvideo", { output: "nope.mp4", mask: "layer_m1.png", width: 10, height: 10 });
    check("...an unknown clip: 404 in JSON", r.status === 404 && /not in this project/.test(r.j.error), r);
    srv.close();
  } finally {
    core.setProject(orig);
    fs.rmSync(pd, { recursive: true, force: true });
  }

  // 4
  const F = read("ext", "timelinedock", "fill.js"), C = read("ext", "timelinedock", "canvas.js");
  check("fill.js: ⬚ Select (M) and 🖌 Mask (B) are canvas tools (TlCanvas.addTool); the mask is painted over the picture",
    /C\.addTool\(\{ id: "select", icon: "⬚", title: "Select", key: "m"/.test(F) && /C\.addTool\(\{ id: "mask", icon: "🖌", title: "Mask", key: "b"/.test(F)
    && /C\.onDraw\(function/.test(F) && /function addTool\(t\)/.test(C) && /drawHooks\.forEach/.test(C));
  check("...Image: the frame around the selection -> /api/aiedit (the image editor's format: crop, mask transparent = the area, rgba)",
    /C\.paintComp\(frame\.getContext\("2d"\), S\.t\)/.test(F) && /fd\.append\("crop"/.test(F) && /fd\.append\("mask"/.test(F) && /fd\.append\("rgba"/.test(F)
    && /fetch\("\/api\/aiedit", \{ method: "POST", body: fd \}\)/.test(F) && /mode: "generate"/.test(F));
  check("...the result cut out by the FEATHERED mask and placed exactly over the area on a new layer",
    /g\.filter = "blur\(" \+ \(F\.feather \/ 2\) \+ "px\)"/.test(F) && /lg\.globalCompositeOperation = "destination-in"; lg\.drawImage\(soft, 0, 0\)/.test(F)
    && /C\.newLayer\("image", \{ name: name, start: when\.start, len: when\.len/.test(F)
    && /tf = \{ x: Math\.round\(box\.x \+ box\.w \/ 2 - S\.W \/ 2\), y: Math\.round\(box\.y \+ box\.h \/ 2 - S\.H \/ 2\)/.test(F));
  check("...Video: the filled picture animated by /api/generate (fl2va, the prompt docker's video style), masked into a see-through clip",
    /mode: "fl2va"/.test(F) && /fetch\("\/api\/generate", \{ method: "POST", body: fd \}\)/.test(F) && /videoStyleSel/.test(F)
    && /\/api\/tlcanvas\/maskvideo/.test(F) && /C\.newLayer\("video", \{ name: mj\.name, src: "video"/.test(F)
    && JSON.parse(read("ext", "timelinedock", "ext.json")).scripts.includes("fill.js"));

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log("FAIL: crashed " + e.stack); process.exit(1); });
