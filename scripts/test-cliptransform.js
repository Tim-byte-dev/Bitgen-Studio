#!/usr/bin/env node
/* bitGen Studio — 2.377.0: a layer clip's canvas transform (position / scale / rotation) from the page to the compile,
 * the text layer's picture route, and the timeline docker's canvas wiring.
 * Run: node scripts/test-cliptransform.js
 *   1. lib/clipTransform.normalize: clean numbers, clamps, identity = undefined;
 *   2. POST /api/export keeps `tf` on video-layer and image clips (the route's allow-list) - captured, not run;
 *   3. worker.py _tf_chain: scale (even sizes), rotate (transparent corners, the box grows), the centre offset;
 *   4. POST /api/tlcanvas/text writes images/text_<id>.png in place (PNG only, an id required);
 *   5. the dock: the stage markup (toolbar | canvas + transport | layers), ⧉, canvas.js in ext.json, starts after the
 *      core page, the canvas draws the compile order, the Timeline settings' song-sync switch. */
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
const CT = require(path.join(ROOT, "lib", "clipTransform"));
const core = require(path.join(ROOT, "lib", "core"));

function req(port, method, u, body, type) {
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

(async () => {
  // 1
  check("normalize: numbers cleaned and clamped", JSON.stringify(CT.normalize({ x: "12.345", y: -7, scale: 99, rot: 30.04 }))
    === JSON.stringify({ x: 12.35, y: -7, scale: 20, rot: 30.04 }));
  check("normalize: identity / junk = undefined (the compile's plain path)", CT.normalize({ x: 0, y: 0, scale: 1, rot: 0 }) === undefined
    && CT.normalize(null) === undefined && CT.normalize("x") === undefined && CT.isIdentity({}));

  // 2 + 4
  const express = require("express");
  const app = express();
  require(path.join(ROOT, "routes", "index.js")).mount(app);
  const srv = app.listen(0, "127.0.0.1");
  await new Promise((ok) => srv.once("listening", ok));
  const port = srv.address().port;
  const realMake = core.makeJob;
  let captured = null;
  core.makeJob = (params) => { captured = params; return { id: "cap", params, log: [], status: "queued" }; };
  try {
    await req(port, "POST", "/api/export", {
      video: [{ name: "a.mp4", src: "video", start: 0, in: 0, out: 2, dur: 2 }],
      video_layers: [{ name: "V2", clips: [{ name: "b.mp4", src: "video", start: 0, in: 0, out: 2, tf: { x: 10, y: -20, scale: 0.5, rot: 15 } },
                                           { name: "c.mp4", src: "video", start: 2, in: 0, out: 2, tf: { x: 0, y: 0, scale: 1, rot: 0 } }] }],
      images: [{ clips: [{ name: "text_ab.png", start: 0, len: 3, tf: { x: 5, y: 6, scale: 2, rot: -10 }, text: { content: "x" } }] }],
      audio: [] });
  } finally { core.makeJob = realMake; }
  const T = captured && captured.timeline;
  check("POST /api/export keeps tf on a video-layer clip (identity dropped)", T && JSON.stringify(T.video_layers[0].clips[0].tf)
    === JSON.stringify({ x: 10, y: -20, scale: 0.5, rot: 15 }) && T.video_layers[0].clips[1].tf === undefined, T && T.video_layers);
  check("...and on an image / text clip", T && JSON.stringify(T.images[0].clips[0].tf) === JSON.stringify({ x: 5, y: 6, scale: 2, rot: -10 }), T && T.images);

  const png = execFileSync("ffmpeg", ["-loglevel", "error", "-f", "lavfi", "-i", "color=c=white:s=40x20", "-frames:v", "1", "-f", "image2pipe", "-vcodec", "png", "-"]);
  let r = await req(port, "POST", "/api/tlcanvas/text?id=ztest" + process.pid, png, "image/png");
  const f = path.join(core.pDir("images"), "text_ztest" + process.pid + ".png");
  check("POST /api/tlcanvas/text writes images/text_<id>.png", r.status === 200 && r.j.name === "text_ztest" + process.pid + ".png"
    && fs.existsSync(f) && fs.readFileSync(f).equals(png), r);
  r = await req(port, "POST", "/api/tlcanvas/text?id=ztest" + process.pid, png, "image/png");
  check("...an edit rewrites the SAME file (no piling up)", r.status === 200 && fs.readdirSync(core.pDir("images")).filter((n) => n.startsWith("text_ztest")).length === 1);
  check("...not a PNG / no id: refused", (await req(port, "POST", "/api/tlcanvas/text?id=zz", Buffer.from("nope"), "image/png")).status === 400
    && (await req(port, "POST", "/api/tlcanvas/text", png, "image/png")).status === 400);
  try { fs.unlinkSync(f); } catch { /* gone */ }
  srv.close();

  // 3
  let py = "";
  try {
    py = execFileSync("python3", ["-c", "import sys,json; sys.argv=['x']; sys.path.insert(0, '.'); sys.path.insert(0, 'misc'); import worker; "
      + "print(json.dumps([worker._tf_chain({'x':-150,'y':60,'scale':0.75,'rot':30}), worker._tf_chain(None), worker._tf_chain({'x':0,'y':0,'scale':1,'rot':0})]))"],
      { cwd: ROOT, encoding: "utf8" }).trim().split("\n").pop();
  } catch (e) { py = "[]"; }
  const W = JSON.parse(py || "[]");
  check("worker _tf_chain: scale to even sizes, rotate with transparent corners and a grown box, the centre offsets",
    W[0] && /scale=w='max\(2,trunc\(iw\*0\.75000\/2\)\*2\)'/.test(W[0][0]) && /rotate=a=30\.0000\*PI\/180:c=none:ow='rotw\(30\.0000\*PI\/180\)':oh='roth/.test(W[0][0])
    && W[0][1] === "+(-150.00)" && W[0][2] === "+(60.00)", W[0]);
  check("...no transform = nothing added", W[1] && W[1].join("") === "" && W[2] && W[2].join("") === "", W);
  const WK = read("misc/worker.py");
  check("worker: the video layers and the image layers both use it in the composite",
    /tfv, tx, ty = _tf_chain\(c\.get\("tf"\)\)/.test(WK) && /tfi, tx, ty = _tf_chain\(c\.get\("tf"\)\)/.test(WK)
    // 2.519.0: since 2.491.0 the layers are queued as ops ({"src": "ov<i>"/"im<i>", "x": ..{tx}, "y": ..{ty}}) and laid
    // on by _composite_ops (overlay=...x={op['x']}:y={op['y']}) - the same centre offsets, a new spelling
    && /\{"src": f"ov\{i\}", "x": f"\(main_w-overlay_w\)\/2\{tx\}", "y": f"\(main_h-overlay_h\)\/2\{ty\}"/.test(WK)
    && /\{"src": f"im\{i\}", "x": f"\(main_w-overlay_w\)\/2\{tx\}", "y": f"\(main_h-overlay_h\)\/2\{ty\}"/.test(WK)
    && /overlay=\{'eof_action=pass:' if op\.get\('eof'\) else ''\}"\s*f"x=\{op\['x'\]\}:y=\{op\['y'\]\}/.test(WK));

  // 5
  const D = read("ext", "timelinedock", "dock.html"), C = read("ext", "timelinedock", "canvas.js"), S = read("ext", "timelinedock", "tlsettings.js");
  const order = ["id=\"tlStage\"", "id=\"tlTools\"", "id=\"tlCanvasCol\"", "id=\"tlCanvas\"", "id=\"tlCTrans\"", "id=\"tlLayersPanel\"", "id=\"tlbar\""].map((k) => D.indexOf(k));
  check("the dock: toolbar | canvas + its transport | layers panel, above the menu bar", order.every((v, i) => v > 0 && (i === 0 || v > order[i - 1])), order);
  check("...⧉ shows / hides it; canvas.js is in the extension", /id="tlStageTog"/.test(D)
    && JSON.parse(read("ext", "timelinedock", "ext.json")).scripts.includes("canvas.js"));
  check("canvas.js starts only once the core timeline exists (extension scripts load first)", /function ready\(\) \{ try \{ return typeof tl === "object"/.test(C) && /setTimeout\(boot, 50\)/.test(C));
  check("canvas.js draws in the compile's order: V1, the video layers, then the image / text layers",
    /out\.push\(\{ kind: "v1"[\s\S]{0,200}\(tl\.vlayers \|\| \[\]\)\.forEach[\s\S]{0,200}\(tl\.images \|\| \[\]\)\.forEach/.test(C));
  check("...a video layer at its own pixel size, a picture capped at the frame's width (as the compile does)",
    /if \(kind === "vl"\) \{\s*var vv = video\(c\); src = vv; w = vv\.videoWidth \|\| S\.W/.test(C) && /w = Math\.min\(im\.naturalWidth, S\.W\)/.test(C));
  check("Timeline settings: the scenes' song-sync switch (ui.tl_scene_song_sync)", /id="tlsSongSync"/.test(S) && /tl_scene_song_sync: \$\("tlsSongSync"\)\.checked/.test(S));
  check("the videodock places a song-synced take at its song time (no 'after')", /after: prev && r\.tl_from !== "song" \? prev\.output : ""/.test(read("ext", "videodock", "characters.js")));

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log("FAIL: crashed " + e.stack); process.exit(1); });
