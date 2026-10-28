#!/usr/bin/env node
/* bitGen Studio — 2.385.0: the BLENDER BRIDGE (lib/blender.js, routes/blender.js, scripts/blender_render.py,
 * scripts/blender_common.py, blender/bitgen_bridge) + the 3D layers' new parts on disk and in the page's files
 * (glTF, textures, lights, materials, the widgets, the floating docker, the ◆ drag).
 * Run: node scripts/test-blender.js
 * Tim: "is it possible for us to create a blender to bitgen bridge?" -> "Add-on + Blender render bake" (+ the rest of
 * the 2.385.0 message: the floating Tools & Properties docker, lights, materials, ◆ drag / remove, 3D widgets).
 *   1. settings (config.blender) and finding Blender (a set path that is not there = not found);
 *   2. the add-on's sends: models3d/ + the inbox (per project, newer than `since`); a non-model refused;
 *   3. the render bake with a STUB Blender (a script that writes the frames): the job it gets (the spec, every frame,
 *      the model's / the font's path), the progress, the frames -> video/m3d_<id>.webm; a failing Blender says why;
 *   4. the routes;
 *   5. a REAL Blender, when this machine has one: a cube .glb and a 3D text rendered see-through, the object in frame;
 *   6. the files: the add-on's register / panel / operators, the render script's pieces, glTF in the three bundle,
 *      the page's new scripts in the timeline docker. */
"use strict";
const fs = require("fs");
const os = require("os");
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
// a test server never installs components (mounting the routes would start the Viggle engine's install otherwise)
if (!process.env.H3_E2E) process.env.H3_E2E = "1";
const core = require(path.join(ROOT, "lib", "core"));
const BL = require(path.join(ROOT, "lib", "blender"));
const M = require(path.join(ROOT, "lib", "m3d"));
const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));
function send(port, method, u, body, type) {
  return new Promise((ok, no) => {
    const data = body == null ? null : Buffer.isBuffer(body) ? body : Buffer.from(JSON.stringify(body));
    const r = http.request({ host: "127.0.0.1", port, path: u, method,
      headers: data ? { "Content-Type": type || "application/json", "Content-Length": data.length } : {} }, (res) => {
      const parts = []; res.on("data", (c) => parts.push(c));
      res.on("end", () => { const buf = Buffer.concat(parts); let j = null; try { j = JSON.parse(buf.toString()); } catch { j = null; } ok({ status: res.statusCode, j }); });
    });
    r.on("error", no); if (data) r.write(data); r.end();
  });
}
async function until(id, ms) {
  const t0 = Date.now();
  for (;;) {
    const s = BL.status(id);
    if (s.state !== "running" || Date.now() - t0 > ms) return s;
    await sleep(250);
  }
}
/* a stub "Blender": answers the version question, renders a job by writing solid PNG frames */
function stubBlender(dir, mode) {
  const f = path.join(dir, "blender_stub_" + mode + ".py");
  fs.writeFileSync(f, `#!/usr/bin/env python3
import sys, json, zlib, struct, os
a = sys.argv
if "--python-expr" in a:
    print("H3BV 9.9.9-stub"); sys.exit(0)
job = json.load(open(a[a.index("--") + 1]))
json.dump(job, open(os.path.join(${JSON.stringify(dir)}, "last_job.json"), "w"))
def png(w, h):
    raw = b"".join(b"\\x00" + b"\\xff\\x40\\x20\\xff" * w for _ in range(h))
    ch = lambda t, d: struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)
    return b"\\x89PNG\\r\\n\\x1a\\n" + ch(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)) + ch(b"IDAT", zlib.compress(raw)) + ch(b"IEND", b"")
print("H3B engine BLENDER_EEVEE", flush=True)
n = len(job["frames"])
for i in range(n):
    if ${JSON.stringify(mode)} == "fail" and i == 1:
        print("H3B error: the stub broke on purpose", flush=True); sys.exit(1)
    open(os.path.join(job["out"], "f_%05d.png" % i), "wb").write(png(job["w"], job["h"]))
    print("H3B frame %d/%d" % (i + 1, n), flush=True)
print("H3B done %d" % n, flush=True)
`);
  fs.chmodSync(f, 0o755);
  return f;
}
const glbMin = () => {      // a tiny valid glTF binary (one triangle)
  const bin = Buffer.from(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]).buffer);
  let js = Buffer.from(JSON.stringify({ asset: { version: "2.0" }, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }], buffers: [{ byteLength: 36 }],
    bufferViews: [{ buffer: 0, byteLength: 36 }], accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: "VEC3", min: [0, 0, 0], max: [1, 1, 0] }] }));
  js = Buffer.concat([js, Buffer.alloc((4 - (js.length % 4)) % 4, 0x20)]);
  const h = Buffer.alloc(12), a = Buffer.alloc(8), b = Buffer.alloc(8);
  h.writeUInt32LE(0x46546c67, 0); h.writeUInt32LE(2, 4); h.writeUInt32LE(12 + 8 + js.length + 8 + bin.length, 8);
  a.writeUInt32LE(js.length, 0); a.writeUInt32LE(0x4e4f534a, 4); b.writeUInt32LE(bin.length, 0); b.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([h, a, js, b, bin]);
};

(async () => {
  const P = "zz_blender385_" + process.pid, orig = core.getProject();
  const cfg0 = JSON.parse(JSON.stringify((core.getConfig() || {}).blender || null));
  core.ensureProject(P); core.setProject(P);
  const pd = core.projDir(P);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "h3bl-"));
  try {
    // 1
    const s1 = BL.saveSettings({ path: path.join(tmp, "nope", "blender"), engine: "cycles", samples: 64, gpu: true });
    check("settings: path / engine / samples / gpu saved in the settings (config.blender)",
      s1.engine === "cycles" && s1.samples === 64 && s1.gpu === true && core.getConfig().blender.engine === "cycles", s1);
    check("...a set path that is not there = Blender not found (no guessing past it)", BL.find() === null);
    const s2 = BL.saveSettings({ engine: "bogus", samples: -5 });
    check("...an unknown engine keeps the last one; samples clamped to 0-4096", s2.engine === "cycles" && s2.samples === 0, s2);

    // 2
    const it = BL.push("from blender.glb", glbMin(), true);
    check("push: the add-on's .glb -> models3d/ (name made safe) + the inbox (Add as 3D layer)",
      it.name === "from blender.glb" && it.layer === true && fs.existsSync(path.join(pd, "models3d", "from blender.glb")), it);
    check("...a .glb / .gltf is a MODEL now (the 3D layers list it)", M.listModels().some((m) => m.name === "from blender.glb") && M.MODEL_EXT.includes(".gltf") && M.SIDE_EXT.includes(".bin"));
    const in1 = BL.inbox(it.seq - 1), in2 = BL.inbox(it.seq);
    check("inbox: what arrived after `since`, only this project's", in1.items.length === 1 && in1.items[0].name === "from blender.glb" && in2.items.length === 0, [in1, in2]);
    let e1 = null; try { BL.push("notes.png", Buffer.from("x"), false); } catch (e) { e1 = e; }
    check("...a picture is not a model: refused (the add-on sends glTF)", e1 && e1.status === 400, e1 && e1.message);
    M.saveModel("wood.jpg", Buffer.from([0xff, 0xd8, 0xff]));
    check("textures: the pictures in models3d/ listed for a material", M.listTextures().map((t) => t.name).join() === "wood.jpg", M.listTextures());

    // 3
    const stub = stubBlender(tmp, "ok");
    BL.saveSettings({ path: stub, engine: "eevee", samples: 16 });
    const inf = await BL.info();
    check("info: the Blender set is found and asked its version", inf.found === stub && inf.version === "9.9.9-stub", inf);
    const spec = { type: "model", model: "from blender.glb", keepMat: true, color: "#ffffff", metal: 0.2, rough: 0.4, w: 64, h: 48,
                   lights: [{ type: "point", power: 2, x: 1, y: 1, z: 2 }], mat: { preset: "gold" }, renderer: "blender" };
    const frames = [0, 1, 2].map((i) => ({ t: i / 24, rx: 0, ry: i * 10, rz: 0, pz: 0, sx: 1, sy: 1, sz: 1 }));
    const r1 = BL.render("blid1", { spec, w: 64, h: 48, fps: 24, frames, parts: { 0: "Cube" } });
    check("render: started (running, of 3 frames)", r1.state === "running" && r1.of === 3, r1);
    const st1 = await until("blid1", 30000);
    const job = JSON.parse(fs.readFileSync(path.join(tmp, "last_job.json"), "utf8"));
    check("...Blender got the job: the spec, every frame, the model's path, the engine + samples, the parts' names",
      job.spec.mat.preset === "gold" && job.frames.length === 3 && job.frames[2].ry === 20 && job.model === path.join(pd, "models3d", "from blender.glb")
      && job.engine === "eevee" && job.samples === 16 && job.parts["0"] === "Cube" && job.w === 64 && job.h === 48, job);
    check("...done: the frames -> video/m3d_blid1.webm (3 frames), the frames folder cleaned",
      st1.state === "done" && st1.done === 3 && st1.result && st1.result.name === "m3d_blid1.webm" && fs.existsSync(path.join(pd, "video", "m3d_blid1.webm"))
      && !fs.existsSync(M.frameDir("blid1")) && st1.engine === "BLENDER_EEVEE", st1);
    const r2 = BL.render("blid2", { spec: { type: "text", text: "Hi", font: "Arial", w: 32, h: 32 }, fps: 24, frames: frames.slice(0, 1) });
    await until("blid2", 30000);
    const job2 = JSON.parse(fs.readFileSync(path.join(tmp, "last_job.json"), "utf8"));
    check("...3D text: the machine's font file goes with it (same family as the canvas)", r2.state === "running" && job2.model === null && (job2.font === M.fontFile("Arial", false, false)), job2.font);
    const bad = stubBlender(tmp, "fail");
    BL.saveSettings({ path: bad });
    BL.render("blid3", { spec, fps: 24, frames });
    const st3 = await until("blid3", 30000);
    check("...a Blender that fails: error, with its own words", st3.state === "error" && /broke on purpose/.test(st3.error || ""), st3);
    let e2 = null; try { BL.render("blid4", { spec: { type: "model", model: "missing.glb" }, frames }); } catch (e) { e2 = e; }
    let e3 = null; try { BL.saveSettings({ path: path.join(tmp, "none") }); BL.render("blid5", { spec, frames }); } catch (e) { e3 = e; }
    check("...a missing model (404) and a missing Blender (404) are said before anything runs", e2 && e2.status === 404 && e3 && e3.status === 404 && /not found/.test(e3.message), [e2 && e2.message, e3 && e3.message]);

    // 4
    BL.saveSettings({ path: stub });
    const express = require("express");
    const app = express();
    require(path.join(ROOT, "routes", "index.js")).mount(app);
    const srv = app.listen(0, "127.0.0.1"); await new Promise((ok) => srv.once("listening", ok));
    const port = srv.address().port;
    const ping = await send(port, "GET", "/api/blender/ping");
    check("GET /api/blender/ping: the app, its version, the project (the add-on's Test)", ping.j && ping.j.app === "bitGen Studio" && ping.j.project === P && /^\d+\.\d+\.\d+$/.test(ping.j.version), ping.j);
    const pu = await send(port, "POST", "/api/blender/push?name=routed.glb&layer=1", glbMin(), "application/octet-stream");
    const ib = await send(port, "GET", "/api/blender/inbox?since=" + (pu.j.seq - 1));
    check("POST /api/blender/push + GET /api/blender/inbox", pu.j && pu.j.ok && pu.j.layer === true && ib.j.items.length === 1 && ib.j.items[0].name === "routed.glb", [pu.j, ib.j]);
    const stt = await send(port, "GET", "/api/blender/status");
    const set = await send(port, "POST", "/api/blender/settings", { engine: "workbench", samples: 8 });
    check("GET /api/blender/status + POST /api/blender/settings", stt.j.found === stub && set.j.engine === "workbench" && set.j.samples === 8, [stt.j, set.j]);
    const rr = await send(port, "POST", "/api/blender/render", { id: "blid6", spec, w: 32, h: 32, fps: 24, frames });
    let rs = null;
    for (let i = 0; i < 120; i++) { rs = (await send(port, "GET", "/api/blender/render/blid6")).j; if (rs.state !== "running") break; await sleep(250); }
    check("POST /api/blender/render + GET /api/blender/render/:id", rr.j.ok && rs.state === "done" && rs.result.name === "m3d_blid6.webm", rs);
    const tx = await send(port, "GET", "/api/tlcanvas/textures");
    check("GET /api/tlcanvas/textures", tx.j && tx.j.textures.some((t) => t.name === "wood.jpg"), tx.j);
    srv.close();

    // 5 - a real Blender
    BL.saveSettings({ path: "" });
    const real = BL.find();
    if (!real || process.env.H3_NO_REAL_BLENDER) console.log("SKIP: no Blender on this machine - the real render was not tried");
    else {
      try { execFileSync(real, ["-b", "--factory-startup", "--python-expr", "import numpy"], { stdio: "ignore", timeout: 60000 }); } catch { /* glTF needs numpy */ }
      const cube = path.join(ROOT, "scripts", "fixtures", "cube_blue.glb");
      if (fs.existsSync(cube)) fs.copyFileSync(cube, path.join(pd, "models3d", "cube_blue.glb"));
      const rf = [0, 1].map((i) => ({ t: i / 24, rx: 20, ry: 30 + i * 10, rz: 0, pz: 0, sx: 1, sy: 1, sz: 1 }));
      BL.saveSettings({ engine: "eevee", samples: 4 });
      BL.render("blreal1", { spec: { type: "model", model: "cube_blue.glb", keepMat: true, w: 96, h: 96 }, w: 96, h: 96, fps: 24, frames: rf });
      const sr = await until("blreal1", 240000);
      let px = null;
      if (sr.state === "done") {
        const raw = execFileSync("ffmpeg", ["-loglevel", "error", "-c:v", "libvpx-vp9", "-i", path.join(pd, "video", "m3d_blreal1.webm"), "-frames:v", "1",
          "-f", "rawvideo", "-pix_fmt", "rgba", "-"], { maxBuffer: 16 * 1024 * 1024 });
        const at = (x, y) => { const i = (y * 96 + x) * 4; return [raw[i], raw[i + 1], raw[i + 2], raw[i + 3]]; };
        px = { centre: at(48, 48), corner: at(2, 2) };
      }
      check("REAL Blender (" + (await BL.version(real)) + "): a blue .glb cube rendered see-through - opaque blue in the middle, clear in the corner",
        sr.state === "done" && px && px.centre[3] > 200 && px.centre[2] > px.centre[0] + 20 && px.corner[3] < 30, { sr, px });
      BL.render("blreal2", { spec: { type: "text", text: "H3", font: "Arial", bold: true, depth: 0.3, color: "#f59e2c", w: 96, h: 64,
        mat: { preset: "gold" }, lights: [{ type: "spot", power: 3, x: -2, y: 3, z: 3, angle: 30 }] }, w: 96, h: 64, fps: 24, frames: rf.slice(0, 1) });
      const st = await until("blreal2", 240000);
      check("REAL Blender: 3D text (gold, a spot light) rendered", st.state === "done", st);
    }

    // 6
    const ad = read("blender", "bitgen_bridge", "__init__.py");
    check("the add-on: bl_info, Send / Test / Get operators, the sidebar panel, the live link on Save, glTF export, register",
      /bl_info = \{/.test(ad) && /"bitgen\.send"/.test(ad) && /"bitgen\.test"/.test(ad) && /"bitgen\.get"/.test(ad) && /bl_category = "bitGen"/.test(ad)
      && /save_post\.append\(on_save\)/.test(ad) && /export_scene\.gltf\(/.test(ad) && /"\/api\/blender\/push\?"/.test(ad) && /def register\(\)/.test(ad));
    const rp = read("scripts", "blender_render.py");
    check("the render script: film transparent, Standard view, the same framing / lights / materials, a line per frame",
      /film_transparent = True/.test(rp) && /view_transform = "Standard"/.test(rp) && /B\.framing\(/.test(rp) && /B\.lights_of\(/.test(rp)
      && /B\.mat_spec\(/.test(rp) && /say\("frame %d\/%d"/.test(rp) && /import_scene\.gltf/.test(rp));
    const ext = JSON.parse(read("ext", "timelinedock", "ext.json")).scripts;
    check("the timeline docker loads the new scripts (widgets, look, Blender, the floating docker)",
      ["m3dgizmo.js", "m3dlook.js", "m3dblender.js", "tlfloat.js"].every((s) => ext.includes(s)) && ext.indexOf("tlfloat.js") === ext.indexOf("tlgrid.js") - 1 && ext.slice(ext.indexOf("tlgrid.js") + 1).every((s) => ["tlselhl.js", "tlcadbar.js", "tlbody.js", "tlunreal.js", "tluelive.js", "tlgraph.js", "tlparent.js", "tlblend.js", "tlshape.js", "tltextanim.js", "tlexpr.js", "tlmask.js", "tltrack.js", "tltime.js", "tlvbake.js", "tlparticles.js", "tlaudio.js", "tlgen.js", "tldist.js", "tlrays.js", "tlwarp.js", "tlmotion.js", "tl3d.js", "tldata.js", "tllottie.js", "tlsizebar.js", "tlscene.js", "tlcutout.js", "tlcamtrack.js", "tlvfill.js", "tlanykey.js", "tltextfill.js", "tlmorph.js", "tlframe.js", "tljoin.js"].includes(s))   /* 2.470.0: tlselhl + tlcadbar after it */, ext);   // 2.445.0: tlgrid.js (the grid / rulers) loads after tlfloat.js
    check("glTF in the local three.js bundle (GLTFLoader) and the renderer (.glb / .gltf)",
      /GLTFLoader/.test(read("scripts", "vendor", "m3d-entry.js")) && /GLTFLoader/.test(read("static", "vendor", "three-m3d.min.js")) && /new T\.GLTFLoader\(\)/.test(read("static", "m3d.js")));
    const R = read("static", "m3d.js");
    check("the renderer: lights (point / spot / sun / ambient / sky), materials (MeshPhysicalMaterial + presets + texture), depth + own scale keyed, view()",
      /new T\.PointLight\(/.test(R) && /new T\.SpotLight\(/.test(R) && /new T\.HemisphereLight\(/.test(R) && /MeshPhysicalMaterial/.test(R)
      && /PRESETS = \{/.test(R) && /TextureLoader/.test(R) && /KEYED = \["rx", "ry", "rz", "pz", "sx", "sy", "sz"\]/.test(R) && /function viewOf\(/.test(R));
    const I = read("static", "index.html");
    check("the ◆ drag: limits (previous + 1 frame .. next - 1 frame, 0 .. the clip's end), remove (right-click / Alt / Delete)",
      /function kfLimits\(/.test(I) && /ks\[i - 1\]\.at \+ f/.test(I) && /ks\[i \+ 1\]\.at - f : kfLen\(c, kind\)/.test(I)
      && /d\.oncontextmenu = e => \{ e\.preventDefault\(\); e\.stopPropagation\(\); kfRemove\(c, k\); \}/.test(I) && /function kfUnder\(/.test(I));
  } catch (e) {
    check("the run finished", false, String(e && e.stack || e).slice(0, 800));
  } finally {
    const cfg = core.getConfig() || {};
    if (cfg0) cfg.blender = cfg0; else delete cfg.blender;
    core.setConfig(cfg);
    core.setProject(orig);
    fs.rmSync(pd, { recursive: true, force: true });
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
