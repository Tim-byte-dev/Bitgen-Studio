#!/usr/bin/env node
/* bitGen Studio — scripts/test-to3d594.js (2.594.0): RIGHT-CLICK 🧊 CONVERT TO 3D.
 * Tim: "right click on an image in gallery, assets, reference or image-editor and convert to 3d using context menu , the
 * 3d model can go into image-editor or solidcraft docker" (Hi3D skipped: "Skip Hi3D for now").
 *   lib/to3d.js           a sent picture: PNG / JPEG / WebP only, kept in images/ under a new name (never overwritten)
 *   routes/to3d.js        POST /api/to3d/picture refuses what is not a picture (400)
 *   lib/layer3d.js        a MODEL opens as a 3D layer: sources() lists models3d/, open("<name>.glb") resolves it there and
 *                         Blender imports it (blend_layer3d.py import: a camera framed on it, a sun) - a REAL Blender run
 *                         when one is here (H3_BLENDER, or BITGEN_BPY_PYTHON = a Python with the bpy module) - else SKIP
 *   static/mesh3dctx.js   the menu (pure): engines, destinations, the editor's whole picture / picked layer, cleanPick
 *   the page              the script is loaded; the context menu, the Layers panel command, the deliveries
 * No server; a temp project. */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0, skip = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const SKIP = (n) => { skip++; console.log("SKIP: " + n); };
const rd = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bg-to3d594-"));
const core = require("../lib/core");
const PD = path.join(tmp, "proj");
core.projDir = () => PD;
core.getProject = () => "p";
core.ensureProject = () => {};
core.pDir = (k) => { const d = path.join(PD, k); fs.mkdirSync(d, { recursive: true }); return d; };
const T = require("../lib/to3d");
const PNG = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex");

(async () => {
  try {
    check("kindOf: PNG / JPEG / WebP by their bytes, anything else ''", T.kindOf(PNG) === "png" && T.kindOf(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0])) === "jpg"
      && T.kindOf(Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBPVP8 ")])) === "webp" && T.kindOf(Buffer.from("hello world!")) === "" && T.kindOf(null) === "");
    check("stemOf: a safe stem", T.stemOf("../a b/My Ref (1).png") === "My_Ref_1" && T.stemOf("") === "picture");
    const f1 = T.savePicture(PNG, "ref one.png"), f2 = T.savePicture(PNG, "ref one.png");
    check("savePicture: into images/, a second one gets a new name (nothing overwritten)", path.dirname(f1) === path.join(PD, "images") && path.basename(f1) === "ref_one.png" && path.basename(f2) === "ref_one-2.png");
    check("savePicture: not a picture = 400", (() => { try { T.savePicture(Buffer.from("not a picture"), "x"); return false; } catch (e) { return e.status === 400; } })());
    check("queue: a picture that is not there = 404", (() => { try { T.queue(path.join(tmp, "nope.png"), {}); return false; } catch (e) { return e.status === 404; } })());

    // ---- the route (a tiny express app)
    const express = require("express");
    const app = express(); require("../routes/to3d").mount(app);
    const srv = await new Promise((r) => { const s = app.listen(0, "127.0.0.1", () => r(s)); });
    const u = `http://127.0.0.1:${srv.address().port}`;
    const r1 = await fetch(u + "/api/to3d/picture?name=x.png", { method: "POST", body: "plain text" });
    check("POST /api/to3d/picture: text = 400 with words", r1.status === 400 && /PNG, JPEG or WebP/.test((await r1.json()).error));
    srv.close();
    check("routes/index.js mounts routes/to3d.js (never server.js); /api/mesh3d queues through lib/to3d.js",
      /require\("\.\/to3d"\)\.mount\(app\)/.test(rd("routes", "index.js")) && !/to3d/.test(rd("misc", "server.js")) && /require\("\.\.\/lib\/to3d"\)\.queue\(pic/.test(rd("routes", "sceneAI.js")));

    // ---- a model as a 3D layer
    const L3 = require("../lib/layer3d");
    const md = path.join(PD, "models3d"); fs.mkdirSync(md, { recursive: true });
    check("layer3d.MESH: glb / gltf / obj / fbx / stl", ["a.glb", "a.GLTF", "a.obj", "a.fbx", "a.stl"].every((f) => L3.MESH.test(f)) && !L3.MESH.test("a.blend"));
    const bpyPy = process.env.BITGEN_BPY_PYTHON || (fs.existsSync("/tmp/bpyenv/bin/python") ? "/tmp/bpyenv/bin/python" : "");
    let wrapper = process.env.H3_BLENDER && fs.existsSync(process.env.H3_BLENDER) ? process.env.H3_BLENDER : "";
    if (!wrapper && bpyPy && process.platform !== "win32") {
      wrapper = path.join(tmp, "blender"); fs.writeFileSync(wrapper, `#!/bin/sh\nshift 3\n"${bpyPy}" "$@"\nexit 0\n`); fs.chmodSync(wrapper, 0o755);   // (the bpy module can crash on exit - Blender itself does not)
      process.env.H3_BLENDER = wrapper;
    }
    const blender = require("../lib/blender");
    const realBlender = !!wrapper && blender.find() === wrapper;
    if (!realBlender) SKIP("a real Blender import (no Blender here - set H3_BLENDER, or BITGEN_BPY_PYTHON to a Python with bpy)");
    else {
      // a model made by Blender itself
      const { execFileSync } = require("child_process");
      const glb = path.join(md, "my_robot.glb");
      try { execFileSync(bpyPy, ["-c", `import bpy\nbpy.ops.wm.read_factory_settings(use_empty=True)\nbpy.ops.mesh.primitive_monkey_add(location=(0,0,0.5))\nbpy.ops.export_scene.gltf(filepath=${JSON.stringify(glb)})`], { stdio: "ignore" }); } catch { /* the bpy module's exit */ }
      const src = L3.sources();
      check("sources(): the project's models3d/ models are listed (kind model)", src.some((s) => s.kind === "model" && s.name === "my_robot.glb"), src);
      const sc = await L3.open("my_robot.glb");
      check("open(\"my_robot.glb\"): found in models3d/, imported by Blender into a scene with a camera framed on it (front, a little above), 1024 x 1024",
        sc.name === "my_robot" && sc.model === true && fs.existsSync(path.join(PD, "scene3d", sc.id, "scene.blend")) && sc.meta.camera === "Camera"
        && Math.round(sc.meta.orbit.yaw) === -90 && Math.round(sc.meta.orbit.pitch) === 12 && sc.meta.resolution[0] === 1024 && sc.meta.objects.some((o) => o.type === "MESH"), sc.meta);
      const { rid } = L3.render(sc.id, { w: 256, h: 256, engine: "WORKBENCH" });
      let st = null; for (let i = 0; i < 120; i++) { st = L3.renderStatus(rid); if (st.state === "done" || st.state === "error") break; await new Promise((r) => setTimeout(r, 500)); }
      check("it renders like any 3D layer (the kept-up Blender)", st && st.state === "done" && (() => { const f = /[?&]f=([^&]+)/.exec(st.png); const p = f && L3.pngPath(sc.id, decodeURIComponent(f[1])); return !!p && fs.existsSync(p) && fs.statSync(p).size > 1000; })(), st);
      L3.close(sc.id);
      let e2 = ""; try { await L3.open("nothing.glb"); } catch (e) { e2 = e.message; }
      check("open: a model that is not there is refused with what it takes", /\.glb \/ \.gltf \/ \.obj \/ \.fbx \/ \.stl/.test(e2), e2);
    }

    // ---- the menu (pure)
    const M = require("../static/mesh3dctx.js");
    check("cleanPick: unknown = Hunyuan3D, the image editor, the whole picture", JSON.stringify(M.cleanPick({ engine: "x", dest: "y", part: "z" })) === '{"engine":"auto","dest":"editor","part":"all"}'
      && JSON.stringify(M.cleanPick({ engine: "trellis", dest: "solidcraft", part: "layer" })) === '{"engine":"trellis","dest":"solidcraft","part":"layer"}');
    const h = M.menuHtml({ title: "a<b>.png", pick: { engine: "trellis", dest: "solidcraft" }, editor: true });
    check("menuHtml: the title escaped, the engines (TRELLIS.2 picked), the three places (SolidCraft picked), the editor's whole picture / picked layer",
      /a&lt;b&gt;\.png/.test(h) && /value="trellis" checked/.test(h) && /value="solidcraft" checked/.test(h) && /value="editor"/.test(h) && /value="save"/.test(h) && /name="t3part"/.test(h) && /data-t3="go"/.test(h)
      && !/name="t3part"/.test(M.menuHtml({ title: "x" })));
    const js = rd("static", "mesh3dctx.js"), html = rd("static", "index.html");
    check("the page: mesh3dctx.js loaded; right-click on Gallery / Assets / References, the editor's canvas menu (pcframes.js reads E.ui.stageCtxItems); sent pictures to /api/to3d/picture, names to /api/mesh3d; the job followed; the editor's 3D layer / SolidCraft's openFile; Layer ▸ Convert Layer to 3D",
      /<script src="\/static\/mesh3dctx\.js">/.test(html) && /addEventListener\("contextmenu"/.test(js) && /\.thumb\[data-lb-kind="image"\]/.test(js) && /\.aitem\[data-lb-kind="image"\]/.test(js)
      && /#tray \.slot/.test(js) && /stageCtxItems/.test(js) && /"pic\.to3d"/.test(js) && /E\.ui\.stageCtxItems \|\| \[\]/.test(rd("ext", "imageeditdock", "pcframes.js")) && /\/api\/to3d\/picture/.test(js) && /\/api\/mesh3d/.test(js) && /\/api\/jobs\//.test(js)
      && /layer3d\.openScene\(model\)/.test(js) && /H3SolidCraft\.openFile\(model, b\)/.test(js) && /"layer\.to3d"/.test(js) && /layerCtxItems/.test(js));
  } catch (e) { fail++; console.log("FAIL: crashed - " + (e && e.stack || e)); }
  finally { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* fine */ } }
  console.log(`\n${pass} passed, ${fail} failed${skip ? ", " + skip + " skipped" : ""}`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
