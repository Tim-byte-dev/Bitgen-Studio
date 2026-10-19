#!/usr/bin/env node
/* bitGen Studio — 2.382.0: the timeline canvas's 3D layers on disk (lib/m3d.js, routes/tlCanvas.js) + the wiring, and
 * the prompt docker's progress (steps above Generate, the bar under it).
 * Run: node scripts/test-m3d.js
 * Tim: "can we add 3d model(fbx, obj) to timeline canvas and 3d text? Please make the info above the generate button
 * show the steps only not the full details - below the generate button add a progress bar while generating".
 *   1. models: .fbx / .obj (+ .mtl and textures beside them) -> projects/<p>/models3d/, names made safe, other files
 *      refused; the list is the models only; a model file is served back;
 *   2. fonts for 3D text: the machine's TTF / OTF for a family (bold preferred when asked), a common sans otherwise;
 *   3. the bake: PNG frames (frame 0 starts afresh) -> video/m3d_<id>.webm, VP9 with ALPHA (alpha_mode=1), every
 *      frame, the frames removed after; a bake with frames missing is refused;
 *   4. the routes;
 *   5. the wiring: three.js is LOCAL (static/vendor, no CDN), the canvas draws a 3D clip live and the compile waits
 *      for its bake, ◇ Key keys the 3D rotation, the 🧊 menu;
 *   6. the prompt docker: steps only above Generate, the progress bar under it, shown only while a job runs. */
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
const M = require(path.join(ROOT, "lib", "m3d"));
const ff = (a) => execFileSync("ffmpeg", ["-y", "-loglevel", "error"].concat(a));

function send(port, method, u, body, type) {
  return new Promise((ok, no) => {
    const data = body == null ? null : Buffer.isBuffer(body) ? body : Buffer.from(JSON.stringify(body));
    const r = http.request({ host: "127.0.0.1", port, path: u, method,
      headers: data ? { "Content-Type": type || "application/json", "Content-Length": data.length } : {} }, (res) => {
      const parts = []; res.on("data", (c) => parts.push(c));
      res.on("end", () => { const buf = Buffer.concat(parts); let j = null; try { j = JSON.parse(buf.toString()); } catch { j = null; }
        ok({ status: res.statusCode, j, buf, headers: res.headers }); });
    });
    r.on("error", no); if (data) r.write(data); r.end();
  });
}

(async () => {
  const P = "zz_m3d382_" + process.pid, orig = core.getProject();
  core.ensureProject(P); core.setProject(P);
  const pd = core.projDir(P);
  try {
    // 1
    const OBJ = Buffer.from("v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n");
    const a = M.saveModel("../evil dir/cube.obj", OBJ), b = M.saveModel("cube.mtl", Buffer.from("newmtl x\n"));
    check("saveModel: .obj -> models3d/<name> (the path stripped), a model; .mtl beside it, not a model",
      a.name === "cube.obj" && a.model === true && b.model === false && fs.readFileSync(path.join(pd, "models3d", "cube.obj")).equals(OBJ), [a, b]);
    let e1 = null; try { M.saveModel("x.exe", OBJ); } catch (e) { e1 = e; }
    let e2 = null; try { M.saveModel("y.fbx", Buffer.alloc(0)); } catch (e) { e2 = e; }
    check("...anything else refused (400), an empty file too", e1 && e1.status === 400 && e2 && e2.status === 400);
    M.saveModel("Robot.fbx", Buffer.from("; FBX 7.3.0 project file\n"));
    check("listModels: the models only (.fbx / .obj), sorted", JSON.stringify(M.listModels().map((m) => m.name)) === '["Robot.fbx","cube.obj"]', M.listModels());
    check("modelPath: a file in models3d (null when missing or outside)", !!M.modelPath("cube.mtl") && M.modelPath("nope.obj") === null && M.modelPath("../../package.json") === null);

    // 2
    const any = M.fontFile("Arial", false, false);
    if (any) {
      const bold = M.fontFile("Arial", true, false);
      check("fontFile: a TTF / OTF on this machine for the family; bold asked -> a bold file",
        /\.(ttf|otf)$/i.test(any) && fs.existsSync(any) && /bold|bd/i.test(path.basename(bold)), [any, bold]);
      check("...a family that is not installed still gets a font (a common sans)", /\.(ttf|otf)$/i.test(M.fontFile("No Such Family 123") || ""));
    } else check("fontFile: no fonts on this machine -> null (SKIP the font checks)", M.fontFile("Arial") === null);

    // 3
    const tmp = path.join(pd, "tmpframes"); fs.mkdirSync(tmp, { recursive: true });
    // 12 frames 64x32: the left half opaque orange, the right half transparent
    ff(["-f", "lavfi", "-i", "color=c=0xf59e2c@1.0:s=32x32:r=12:d=1,format=rgba", "-f", "lavfi", "-i", "color=c=black@0.0:s=32x32:r=12:d=1,format=rgba",
        "-filter_complex", "[0][1]hstack,format=rgba", "-frames:v", "12", path.join(tmp, "f%02d.png")]);
    const frames = fs.readdirSync(tmp).sort().map((f) => fs.readFileSync(path.join(tmp, f)));
    let e3 = null; try { M.saveFrame("t1", 0, Buffer.from("nope")); } catch (e) { e3 = e; }
    let e4 = null; try { M.saveFrame("t1", -1, frames[0]); } catch (e) { e4 = e; }
    check("saveFrame: not a PNG / a bad frame number refused (400)", e3 && e3.status === 400 && e4 && e4.status === 400);
    frames.slice(0, 5).forEach((f, i) => M.saveFrame("t1", i, f));
    let e5 = null; try { await M.encode("t1", { fps: 12, frames: 12 }); } catch (e) { e5 = e; }
    check("encode: frames missing -> refused (409), nothing written", e5 && e5.status === 409 && !fs.existsSync(path.join(pd, "video", "m3d_t1.webm")), e5 && e5.message);
    frames.forEach((f, i) => M.saveFrame("t1", i, f));          // frame 0 again: a fresh bake
    const r = await M.encode("t1", { fps: 12, frames: 12 });
    const out = path.join(pd, "video", r.name);
    const pr = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-count_frames", "-select_streams", "v:0", "-show_entries",
      "stream=codec_name,width,height,nb_read_frames:stream_tags=alpha_mode", "-of", "json", out], { encoding: "utf8" })).streams[0];
    check("encode: video/m3d_<id>.webm, VP9 with ALPHA (alpha_mode=1), every frame, as long as frames / fps",
      r.name === "m3d_t1.webm" && pr.codec_name === "vp9" && pr.width === 64 && pr.height === 32 && String((pr.tags || {}).alpha_mode) === "1"
      && +pr.nb_read_frames === 12 && Math.abs(r.dur - 1) < 1e-9, [r, pr]);
    const raw = execFileSync("ffmpeg", ["-loglevel", "error", "-c:v", "libvpx-vp9", "-i", out, "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgba", "-"]);
    const al = (x, y) => raw[(y * 64 + x) * 4 + 3];
    check("...the picture's own transparency kept (opaque left, see-through right); the frames removed",
      al(10, 16) > 230 && al(54, 16) < 20 && !fs.existsSync(path.join(pd, "workspace", "m3d_t1")), [al(10, 16), al(54, 16)]);

    // 4
    const express = require("express");
    const app = express(); app.use(express.json());
    require(path.join(ROOT, "routes", "index.js")).mount(app);
    const srv = app.listen(0, "127.0.0.1"); await new Promise((ok) => srv.once("listening", ok));
    const port = srv.address().port;
    let q = await send(port, "POST", "/api/tlcanvas/model?name=" + encodeURIComponent("tri.obj"), OBJ, "application/octet-stream");
    check("POST /api/tlcanvas/model (raw bytes) -> {name, model}", q.status === 200 && q.j.name === "tri.obj" && q.j.model === true, q.j);
    q = await send(port, "GET", "/api/tlcanvas/models");
    check("GET /api/tlcanvas/models", q.status === 200 && q.j.models.some((m) => m.name === "tri.obj"), q.j);
    q = await send(port, "GET", "/api/tlcanvas/model/tri.obj");
    check("GET /api/tlcanvas/model/<file> serves it (the loaders find an OBJ's .mtl beside it the same way)", q.status === 200 && q.buf.equals(OBJ));
    q = await send(port, "GET", "/api/tlcanvas/model/missing.obj");
    check("...a missing file: 404 in JSON", q.status === 404 && /models3d/.test(q.j.error));
    if (any) {
      q = await send(port, "GET", "/api/tlcanvas/font?family=Arial&bold=1");
      check("GET /api/tlcanvas/font: the font file's bytes (its name in X-Font-File)", q.status === 200 && q.buf.length > 1000 && /\.(ttf|otf)$/i.test(q.headers["x-font-file"]), q.headers);
    }
    for (let i = 0; i < 12; i++) await send(port, "POST", "/api/tlcanvas/m3d/frame?id=t2&i=" + i, frames[i], "image/png");
    q = await send(port, "POST", "/api/tlcanvas/m3d/encode", { id: "t2", fps: 24, frames: 12 });
    check("POST /api/tlcanvas/m3d/frame x12 + /encode -> {name, dur, frames}", q.status === 200 && q.j.name === "m3d_t2.webm" && q.j.frames === 12 && Math.abs(q.j.dur - 0.5) < 1e-9, q.j);
    srv.close();
  } finally {
    core.setProject(orig);
    fs.rmSync(pd, { recursive: true, force: true });
  }

  // 5
  const V = read("static", "vendor", "three-m3d.min.js"), SM = read("static", "m3d.js"), CV = read("ext", "timelinedock", "canvas.js"),
    XM = read("ext", "timelinedock", "m3d.js"), TD = read("ext", "timelinedock", "timelinedock.js"), H = read("static", "index.html");
  check("three.js is LOCAL: static/vendor/three-m3d.min.js (window.H3THREE with the FBX / OBJ / MTL / TTF loaders + TextGeometry), its licences beside it",
    /var H3THREE=/.test(V) && ["FBXLoader", "OBJLoader", "MTLLoader", "TTFLoader", "TextGeometry", "WebGLRenderer"].every((k) => V.includes(k))
    && fs.existsSync(path.join(ROOT, "static", "vendor", "LICENSE-three.txt")) && fs.existsSync(path.join(ROOT, "static", "vendor", "LICENSE-opentype.txt"))
    && !/cdn\.jsdelivr|unpkg\.com|https?:\/\/[^"' ]+\.js/.test(SM) && !/cdn\.jsdelivr\.net\/npm\/opentype/.test(V)
    && fs.existsSync(path.join(ROOT, "scripts", "vendor", "build-three.sh")));
  check("the page loads static/m3d.js; the bundle only when a 3D layer is shown (lazy)", H.includes('<script src="/static/m3d.js"></script>')
    && !H.includes("three-m3d.min.js") && /s\.src = "\/static\/vendor\/three-m3d\.min\.js"/.test(SM));
  check("the canvas draws a 3D clip LIVE (H3M3D.frame at its moment), never plays it as a video; ⚙ Compile waits for the bakes",
    /if \(kind === "vl" && c\.m3d\) \{/.test(CV) && /H3M3D\.frame\(c, Math\.max\(0, \(t == null \? S\.t : t\) - \(c\.start \|\| 0\)\)\)/.test(CV)
    && /if \(c\.m3d\) return;\s+\/\/ 2\.382\.0: a 3D layer is drawn, not played/.test(CV)
    // 2.519.0: 2.490.0 chains the parented layers' bake (TlParent.bakeAll) after the same text + 3D bakes
    && /return Promise\.all\(\[flushText\(\), window\.TlM3D \? TlM3D\.bakeAll\(\) : true\]\)(;|\.then\()/.test(CV)
    && /try \{ await TlCanvas\.beforeExport\(\); \}/.test(TD) && TD.indexOf("await TlCanvas.beforeExport()") < TD.indexOf('fetch("/api/export"'));
  check("a 3D layer is a video-layer clip {name m3d_<id>.webm, src video, m3d}; .fbx / .obj drops become 3D layers; the 🧊 menu",
    /var c = \{ name: "m3d_" \+ id \+ "\.webm", src: "video", mid: id,/.test(XM) && /C\.newLayer\("video", c, "3D" \+ n\)/.test(XM)
    && /if \(files && window\.TlM3D && TlM3D\.takeDrop\(files, t0, off\)\) return;/.test(CV)
    && /🔤 3D text/.test(XM) && /📦 3D model file…/.test(XM) && JSON.parse(read("ext", "timelinedock", "ext.json")).scripts.includes("m3d.js"));
  check("◇ Key keys the 3D rotation (rx / ry / rz) and the renderer tweens it under the spin",
    /if \(c\.m3d\) \{ k\.rx = kfValue\(c, t, "rx"/.test(H) && /x: kfVal\(c, tau, "rx", num\(m\.rx, 0\)\) \+ num\(m\.spinX, 0\) \* tau/.test(SM));

  // 6
  const PD = read("ext", "promptdock", "dock.html");
  check("prompt docker: the steps line ABOVE Generate, the progress bar UNDER it",
    PD.indexOf('id="progdetail"') < PD.indexOf('id="go"') && PD.indexOf('id="go"') < PD.indexOf('id="progbar"') && /id="progbar" class="idle" role="progressbar"/.test(PD));
  check("...the line shows the steps only (the full details are its tooltip); the bar only while a job runs (a moving stripe before the steps start)",
    H.includes('$("progdetail").textContent = m ? `${m[1]}/${m[2]}` : "…";') && H.includes('$("progbar").classList.remove("idle");')
    && H.includes('$("progbar").classList.add("idle");') && /#progbar\.idle \{ visibility: hidden; \}/.test(H) && /#progbar\.busy i/.test(H));

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log("FAIL: crashed " + e.stack); process.exit(1); });
