#!/usr/bin/env node
/* bitGen Studio — 2.387.0: PATH LAYERS on the server and in the files (lib/matte.js, scripts/matte.py,
 * routes/pathGen.js, lib/wan.js mode ati, the page's ext/timelinedock/paths.js wiring).
 * Run: node scripts/test-paths.js
 * Tim: "can we add a paths layer , then generate parts of the scene on each path layer so animals, cars, people can be
 * rendered separately have transparent backgrounds and compose the scene".
 *   1. the cut-out by CHROMA KEY: a subject on a green screen -> see-through VP9 (alpha_mode 1), the green gone, the
 *      subject kept, the screen's colour found from the border, the mirror (hflip) beside it, the subject's box;
 *   2. the cut-out through scripts/matte.py (its fake = a green-distance matte: the same pipes as the AI model);
 *   3. the AI matte not installed: auto = chroma key, ai = refused (409); status / models;
 *   4. lib/wan: mode ati = a start picture + tracks (Wan 2.1 only), the summary;
 *   5. the routes; 6. the page's files. */
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
if (!process.env.H3_E2E) process.env.H3_E2E = "1";
const core = require(path.join(ROOT, "lib", "core"));
const M = require(path.join(ROOT, "lib", "matte"));
const wan = require(path.join(ROOT, "lib", "wan"));
const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));
const ff = (a) => execFileSync("ffmpeg", ["-y", "-loglevel", "error"].concat(a));
async function until(id, ms) {
  const t0 = Date.now();
  for (;;) { const j = M.job(id); if (j.state !== "running" || Date.now() - t0 > ms) return j; await sleep(200); }
}
function rgba(file, w, h, frame) {
  return execFileSync("ffmpeg", ["-loglevel", "error", "-c:v", "libvpx-vp9", "-i", file, "-vf", `select=eq(n\\,${frame || 0})`, "-vsync", "0", "-frames:v", "1",
    "-f", "rawvideo", "-pix_fmt", "rgba", "-s", `${w}x${h}`, "-"], { maxBuffer: 64 * 1024 * 1024 });
}
const px = (buf, w, x, y) => { const i = (y * w + x) * 4; return [buf[i], buf[i + 1], buf[i + 2], buf[i + 3]]; };
function send(port, method, u, body) {
  return new Promise((ok, no) => {
    const data = body == null ? null : Buffer.from(JSON.stringify(body));
    const r = http.request({ host: "127.0.0.1", port, path: u, method, headers: data ? { "Content-Type": "application/json", "Content-Length": data.length } : {} }, (res) => {
      let b = ""; res.on("data", (c) => { b += c; }); res.on("end", () => { let j = null; try { j = JSON.parse(b); } catch { j = null; } ok({ status: res.statusCode, j }); });
    });
    r.on("error", no); if (data) r.write(data); r.end();
  });
}

(async () => {
  const P = "zz_paths387_" + process.pid, orig = core.getProject();
  core.ensureProject(P); core.setProject(P);
  const pd = core.projDir(P);
  const cfg0 = JSON.parse(JSON.stringify((core.getConfig() || {}).matte || null));
  try {
    fs.mkdirSync(core.pDir("output"), { recursive: true });
    // a red subject moving right on a green screen (320 x 180, 1 s)
    ff(["-f", "lavfi", "-i", "color=c=0x00b140:s=320x180:r=24:d=1", "-f", "lavfi", "-i", "color=c=0xd02020:s=60x90:r=24:d=1",
        "-filter_complex", "[0][1]overlay=x=40+t*100:y=60", "-c:v", "libx264", "-pix_fmt", "yuv420p", path.join(core.pDir("output"), "gs.mp4")]);

    // 1
    const kc = await M.keyColour(path.join(core.pDir("output"), "gs.mp4"), 320, 180);
    check("keyColour: the green screen's colour from the frame's border", Math.abs(kc[0] - 0) < 12 && Math.abs(kc[1] - 177) < 12 && Math.abs(kc[2] - 64) < 12, kc);
    M.start({ id: "k1", output: "gs.mp4", method: "key" });
    const k1 = await until("k1", 60000);
    const r = k1.result || {};
    check("chroma key: done, video/pathv_k1.webm + its mirror pathv_k1_l.webm", k1.state === "done" && r.name === "pathv_k1.webm" && r.left === "pathv_k1_l.webm"
      && fs.existsSync(path.join(core.pDir("video"), r.name)) && fs.existsSync(path.join(core.pDir("video"), r.left)) && k1.method === "key", k1);
    check("...see-through VP9 (ALPHA_MODE 1)", /ALPHA_MODE\s*[=:]\s*1/i.test(execFileSync("ffprobe", ["-v", "error", "-show_entries", "stream_tags", path.join(core.pDir("video"), r.name)], { encoding: "utf8" })));
    const f0 = rgba(path.join(core.pDir("video"), r.name), 320, 180, 0);
    const g = px(f0, 320, 5, 5), s = px(f0, 320, 70, 105);
    check("...the green is clear, the subject solid red", g[3] < 20 && s[3] > 230 && s[0] > 150 && s[1] < 90, { g, s });
    const m0 = rgba(path.join(core.pDir("video"), r.left), 320, 180, 0);
    const sm = px(m0, 320, 320 - 1 - 70, 105), gm = px(m0, 320, 320 - 1 - 20, 105);
    check("...the mirror: the subject on the other side", sm[3] > 230 && sm[0] > 150 && gm[3] < 20, { sm, gm });
    check("...the subject's box over the clip (x from 40, as wide as it travelled, y 60, 90 tall) and its height", r.bbox && Math.abs(r.bbox.x - 40) <= 2 && Math.abs(r.bbox.y - 60) <= 2
      && r.bbox.w >= 130 && r.bbox.w <= 160 && Math.abs(r.bbox.h - 90) <= 2 && Math.abs(r.height - 90) <= 2 && r.w === 320 && r.h === 180 && Math.abs(r.dur - 1) < 0.1, r);

    // 2
    M.start({ id: "a1", output: "gs.mp4", method: "ai", fake: true });
    const a1 = await until("a1", 60000);
    const fa = a1.state === "done" ? rgba(path.join(core.pDir("video"), a1.result.name), 320, 180, 12) : null;
    check("scripts/matte.py (its fake matte - the AI model's pipes): every frame, see-through, the subject kept, despilled",
      a1.state === "done" && a1.done === 24 && a1.method === "ai" && fa && px(fa, 320, 5, 5)[3] < 20 && px(fa, 320, 120, 105)[3] > 230
      && px(fa, 320, 120, 105)[1] <= px(fa, 320, 120, 105)[0], { a1, p: fa && px(fa, 320, 120, 105) });

    // 3
    const cfg = core.getConfig(); cfg.matte = { venv: path.join(pd, "no_venv_here") }; core.setConfig(cfg);
    const st = M.status();
    check("status: not installed (no venv), the models offered, the venv and model folders", st.ai === false && st.models.includes("birefnet-general") && /no_venv_here/.test(st.venv) && /rembg/.test(st.model_dir), st);
    let e1 = null; try { M.start({ id: "x1", output: "gs.mp4", method: "ai" }); } catch (e) { e1 = e; }
    check("...asked for the AI matte without it: refused (409), in words", e1 && e1.status === 409 && /Install/.test(e1.message), e1 && e1.message);
    const au = M.start({ id: "x2", output: "gs.mp4", method: "auto" });
    await until("x2", 60000);
    check("...auto without it = the chroma key", au.method === "key" && M.job("x2").state === "done");
    let e2 = null; try { M.start({ id: "x3", output: "nope.mp4" }); } catch (e) { e2 = e; }
    check("...a clip that is not in the project: 404", e2 && e2.status === 404);

    // 4
    const style = { id: "w21", name: "Wan 2.1", kind: "video", arch: "wan21" };
    const img = path.join(pd, "start.png");
    ff(["-f", "lavfi", "-i", "color=c=0x00b140:s=64x64", "-frames:v", "1", img]);
    const tr = [[{ x: 10, y: 20 }, { x: 300, y: 40 }]];
    const jp = wan.jobParams({ style, wanMode: "ati", prompt: "a fox trots along its path", images: [img], tracks: tr, seconds: 5, width: 832, height: 480 });
    check("lib/wan mode ati: the start picture, the tracks, Wan 2.1, 81 frames", jp.wan_mode === "ati" && jp.images.start === img && jp.tracks.length === 1
      && jp.tracks[0][1].x === 300 && jp.frames === 81 && /along 1 drawn path/.test(wan.summary(jp)), jp);
    check("...refused: a Wan 2.2 style, no picture, no path", /Wan 2.1/.test(wan.jobParams({ style: { ...style, arch: "wan22" }, wanMode: "ati", images: [img], tracks: tr }).error || "")
      && /start picture/.test(wan.jobParams({ style, wanMode: "ati", images: [], tracks: tr }).error || "")
      && /draw a path/.test(wan.jobParams({ style, wanMode: "ati", images: [img], tracks: [[{ x: 1, y: 1 }]] }).error || ""));

    // 5
    const express = require("express");
    const app = express();
    require(path.join(ROOT, "routes", "index.js")).mount(app);
    const srv = app.listen(0, "127.0.0.1"); await new Promise((ok) => srv.once("listening", ok));
    const port = srv.address().port;
    const s5 = await send(port, "GET", "/api/pathgen/matte");
    const m5 = await send(port, "POST", "/api/pathgen/matte", { id: "r1", output: "gs.mp4", method: "key" });
    let j5 = null;
    for (let i = 0; i < 200; i++) { j5 = (await send(port, "GET", "/api/pathgen/matte/r1")).j; if (j5.state !== "running") break; await sleep(200); }
    check("GET /api/pathgen/matte + POST /api/pathgen/matte + GET /api/pathgen/matte/:id", s5.j && s5.j.ai === false && m5.j.ok && j5.state === "done" && j5.result.name === "pathv_r1.webm", [s5.j && s5.j.ai, m5.j, j5 && j5.state]);
    const a5 = await send(port, "POST", "/api/pathgen/ati", { prompt: "x" });
    check("POST /api/pathgen/ati without a Wan 2.1 style: 400 in words", a5.status === 400 && /Wan 2.1/.test(a5.j.error), a5);
    srv.close();

    // 6
    const ext = JSON.parse(read("ext", "timelinedock", "ext.json")).scripts;
    const PJ = read("ext", "timelinedock", "paths.js");
    check("the page: paths.js in the timeline docker; ＋ Path layer, the ⤳ Path tool (Shift+P - 2.389.0), the panel, the pipeline's steps",
      ext.includes("paths.js") && /id = "tlAddPath"/.test(PJ) && /id: "path", icon: "⤳"/.test(PJ) && /key: "shift\+p"/.test(PJ) && /"\/api\/genimage"/.test(PJ)
      && /"\/api\/generate"/.test(PJ) && /"\/api\/pathgen\/ati"/.test(PJ) && /"\/api\/pathgen\/matte"/.test(PJ) && /chroma-key green background/.test(PJ));
    const I = read("static", "index.html");
    check("the timeline: a path layer's span, and it stays when its last clip goes", /ps\.className = "pathspan"/.test(I) && /!track\.length && !L\.path/.test(I));
    const MP = read("scripts", "matte.py");
    check("matte.py: rembg new_session / remove, the green pockets keyed out too, despill, VP9 alpha out", /new_session\(/.test(MP) && /remove\(Image\.fromarray/.test(MP)
      && /np\.minimum\(a, key_alpha\(rgb, key\)\)/.test(MP) && /def despill\(/.test(MP) && /alpha_mode=1/.test(MP));
  } catch (e) {
    check("the run finished", false, String(e && e.stack || e).slice(0, 800));
  } finally {
    const cfg = core.getConfig() || {};
    if (cfg0) cfg.matte = cfg0; else delete cfg.matte;
    core.setConfig(cfg);
    core.setProject(orig);
    fs.rmSync(pd, { recursive: true, force: true });
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
