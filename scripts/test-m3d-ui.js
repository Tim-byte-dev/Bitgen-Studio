#!/usr/bin/env node
/* bitGen Studio — 2.382.0: the timeline canvas's 🧊 3D layers in a REAL browser (WebGL), and the compile.
 * Tim: "can we add 3d model(fbx, obj) to timeline canvas and 3d text? Please make the info above the generate button
 * show the steps only not the full details - below the generate button add a progress bar while generating".
 * Run against the running app (H3_URL, default the e2e server on :8311); it uses a project of its own and loads
 * "default" back after. No Playwright here = SKIP (exit 0).
 *   1. 🧊 under T opens 3D text / 3D model file; 3D text lands on a new 🧊 layer, drawn live on the canvas;
 *   2. an OBJ with its .mtl (red) and an FBX (green) load as 3D layers;
 *   3. spin + ◆ keyframed rotation; the 3D properties; an edit makes the bake due, the bake writes video/m3d_<id>.webm;
 *   4. COMPILE = CANVAS: the compiled frame has the 3D text where the canvas drew it;
 *   5. the prompt docker: steps above Generate, the bar under it, hidden while idle. */
"use strict";
const fs = require("fs");
const path = require("path");
const { execSync, execFileSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 3D layers browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const ROOT = path.join(__dirname, "..");
const P = "zz_m3dui_" + process.pid;
let pass = 0, fail = 0;
const check = (n, cond, got) => {
  if (cond) { pass++; console.log("PASS: " + n); }
  else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 500))); }
};
const api = async (u, body) => (await fetch(URL_ + u.replace(/^\//, ""), body === undefined ? {} :
  { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();
const ff = (args) => execFileSync("ffmpeg", ["-y", "-loglevel", "error"].concat(args), { stdio: "ignore" });
function rgbOf(file, w, h, at) {
  const a = ["-loglevel", "error"].concat(at != null ? ["-ss", String(at)] : []).concat(["-i", file, "-frames:v", "1",
    "-vf", `scale=${w}:${h}:flags=neighbor`, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]);
  return execFileSync("ffmpeg", a, { maxBuffer: 64 * 1024 * 1024 });
}
const px = (buf, w, x, y) => { const i = (Math.round(y) * w + Math.round(x)) * 3; return [buf[i], buf[i + 1], buf[i + 2]]; };
const OBJ = "mtllib cube.mtl\no Cube\nv -1 -1 -1\nv 1 -1 -1\nv 1 1 -1\nv -1 1 -1\nv -1 -1 1\nv 1 -1 1\nv 1 1 1\nv -1 1 1\nusemtl red\n"
  + "f 1 2 3 4\nf 5 8 7 6\nf 1 5 6 2\nf 2 6 7 3\nf 3 7 8 4\nf 5 1 4 8\n";
const MTL = "newmtl red\nKd 0.9 0.1 0.1\n";
function fbxCube() {      // a minimal ASCII FBX 7.3 cube with a green material
  const v = [-1, -1, -1, 1, -1, -1, 1, 1, -1, -1, 1, -1, -1, -1, 1, 1, -1, 1, 1, 1, 1, -1, 1, 1];
  const f = [0, 1, 2, -4, 4, 7, 6, -6, 0, 4, 5, -2, 1, 5, 6, -3, 2, 6, 7, -4, 4, 0, 3, -8];
  return "; FBX 7.3.0 project file\nFBXHeaderExtension:  {\n\tFBXHeaderVersion: 1003\n\tFBXVersion: 7300\n}\n"
    + "GlobalSettings:  {\n\tVersion: 1000\n\tProperties70:  {\n\t\tP: \"UpAxis\", \"int\", \"Integer\", \"\",1\n\t}\n}\n"
    + "Objects:  {\n\tGeometry: 1000, \"Geometry::Cube\", \"Mesh\" {\n\t\tVertices: *" + v.length + " {\n\t\t\ta: " + v.join(",") + "\n\t\t}\n"
    + "\t\tPolygonVertexIndex: *" + f.length + " {\n\t\t\ta: " + f.join(",") + "\n\t\t}\n\t\tGeometryVersion: 124\n\t}\n"
    + "\tModel: 2000, \"Model::Cube\", \"Mesh\" {\n\t\tVersion: 232\n\t\tProperties70:  {\n\t\t}\n\t}\n"
    + "\tMaterial: 3000, \"Material::green\", \"\" {\n\t\tVersion: 102\n\t\tShadingModel: \"phong\"\n\t\tProperties70:  {\n"
    + "\t\t\tP: \"DiffuseColor\", \"Color\", \"\", \"A\",0.1,0.8,0.2\n\t\t}\n\t}\n}\n"
    + "Connections:  {\n\tC: \"OO\",1000,2000\n\tC: \"OO\",3000,2000\n\tC: \"OO\",2000,0\n}\n";
}

(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"] });
  const p = await b.newPage({ viewport: { width: 2200, height: 1300 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  try {
    await api("/api/projects/load", { name: P });
    const pd = path.join(ROOT, "projects", P);
    ff(["-f", "lavfi", "-i", "color=c=0x208030:s=640x360:r=24:d=6", "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "30", "-deadline", "realtime", path.join(pd, "video", "m3_base.webm")]);
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => window.TlM3D && window.TlCanvas && typeof dsReady !== "undefined" && dsReady, null, { timeout: 30000 });
    await p.waitForTimeout(600);
    await p.evaluate(() => {
      const d = document.getElementById("timelinedock");
      if (/collapsed|dockgone/.test(d.className) && typeof toggleCollapse === "function") toggleCollapse("timelinedock");
      setVar("th", 820);
      if (document.getElementById("tlStage").classList.contains("off")) document.getElementById("tlStageTog").click();
      tl.video = [{ name: "m3_base.webm", src: "video", start: 0, dur: 6, in: 0, out: 6, opacity: 1 }];
      tl.vlayers = []; tl.images = []; tl.audio = []; tlSave(); renderTimeline(); setPlayhead(1);
    });
    await p.waitForFunction(() => TlCanvas.state.W === 640 && TlCanvas.state.H === 360, null, { timeout: 15000 });

    // 1
    check("🧊 sits right under T in the canvas toolbar", await p.evaluate(() => document.getElementById("tlTool_text").nextElementSibling.id === "tlTool_m3d"));
    await p.click("#tlTool_m3d");
    const items = await p.evaluate(() => [...document.querySelectorAll("#m3dMenu button")].map((x) => x.textContent));
    check("...it opens the menu: 3D text, 3D model file…", items[0] === "🔤 3D text" && items[1] === "📦 3D model file…", items);
    await p.click('#m3dMenu button[data-m="text"]');
    await p.waitForTimeout(300);
    const L1 = await p.evaluate(() => ({ n: tl.vlayers.length, name: tl.vlayers[0] && tl.vlayers[0].name, c: tl.vlayers[0] && tl.vlayers[0].clips[0],
      icon: [...document.querySelectorAll("#tlLayerList .tll-ic")].map((x) => x.textContent) }));
    check("3D text: a new 🧊 video layer (3D1) whose clip is m3d_<id>.webm carrying m3d at the playhead",
      L1.n === 1 && L1.name === "3D1" && /^m3d_\w+\.webm$/.test(L1.c.name) && L1.c.src === "video" && L1.c.m3d.type === "text" && L1.c.start === 1 && L1.icon.includes("🧊"), L1);
    await p.waitForFunction(() => { const c = tl.vlayers[0].clips[0]; const f = H3M3D.frame(c, 0); return f && !f.error; }, null, { timeout: 30000 });
    const T1 = await p.evaluate(() => {
      const c = tl.vlayers[0].clips[0], f = H3M3D.frame(c, 0), g = f.canvas.getContext("2d");
      const a = (x, y) => Array.from(g.getImageData(x, y, 1, 1).data);
      let lit = 0;
      const d = g.getImageData(0, 0, f.w, f.h).data;
      for (let i = 3; i < d.length; i += 4) if (d[i] > 200) lit++;
      return { w: f.w, h: f.h, corner: a(1, 1), lit: lit / (f.w * f.h) };
    });
    check("...drawn by three.js on a SEE-THROUGH picture (the letters opaque, the corners clear)", T1.corner[3] === 0 && T1.lit > 0.05 && T1.lit < 0.9, T1);
    const props = await p.evaluate(() => ["tlp3Text", "tlp3Font", "tlp3Depth", "tlp3Bevel", "tlp3Color", "tlp3RX", "tlp3SY", "tlp3W", "tlp3Len", "tlp3Bake"].filter((id) => !document.getElementById(id)));
    check("...its Properties: text, font, depth, bevel, colour, rotation + spin, size, length, 🧊 Bake", props.length === 0, props);

    // 2
    const mods = await p.evaluate(async ({ OBJ, MTL, FBX }) => {
      const names = await TlM3D.upload([new File([OBJ], "cube.obj"), new File([MTL], "cube.mtl"), new File([FBX], "cube.fbx")]);
      const cs = names.map((n, i) => TlM3D.add("model", n, { x: -200 + i * 400, y: 0 }));
      for (let k = 0; k < 300; k++) {
        if (cs.every((c) => H3M3D.frame(c, 0))) break;
        await new Promise((ok) => setTimeout(ok, 100));
      }
      return cs.map((c) => { const f = H3M3D.frame(c, 0.2); return { model: c.m3d.model, err: f && f.error,
        mid: f && Array.from(f.canvas.getContext("2d").getImageData(f.w / 2, f.h / 2, 1, 1).data) }; });
    }, { OBJ, MTL, FBX: fbxCube() });
    const obj = mods.find((m) => m.model === "cube.obj"), fbx = mods.find((m) => m.model === "cube.fbx");
    check("an OBJ with its .mtl loads as a 3D layer (its red material)", obj && !obj.err && obj.mid[0] > 120 && obj.mid[1] < 80 && obj.mid[3] === 255, obj);
    check("an FBX loads as a 3D layer (its green material)", fbx && !fbx.err && fbx.mid[1] > 100 && fbx.mid[0] < 90 && fbx.mid[3] === 255, fbx);
    check("...both listed in the project's models (the 🧊 menu offers them again)",
      (await api("/api/tlcanvas/models")).models.map((m) => m.name).sort().join() === "cube.fbx,cube.obj");

    // 3
    const rot = await p.evaluate(() => {
      const c = tl.vlayers[0].clips[0];
      c.m3d.spinY = 90; c.kf = [{ at: 0, rx: 0 }, { at: 2, rx: 90 }];
      return H3M3D.rotAt(c, 1);
    });
    check("rotation: ◆ keyframed X (0 -> 90 over 2 s = 45 at 1 s) + spin Y (90°/s)", rot.x === 45 && rot.y === 90, rot);
    const kk = await p.evaluate(() => { const c = tl.vlayers[0].clips[0]; delete c.kf; c.m3d.spinY = 0; kfAdd(c, 0.5, "video", "vl:0"); const k = c.kf[0]; delete c.kf; return k; });
    check("◇ Key on a 3D layer keys its X / Y / Z rotation too", "rx" in kk && "ry" in kk && "rz" in kk, kk);
    // keep only the text layer for the compile; an edit -> the bake is due; then baked
    await p.evaluate(() => { tl.vlayers = tl.vlayers.slice(0, 1); const c = tl.vlayers[0].clips[0]; c.tf = { x: -120, y: 40, scale: 1, rot: 0 }; c.in = 0; c.out = 3; c.dur = 3; tlSave(); renderTimeline(); TlCanvas.select(c, { lk: "vl:0" }); });
    await p.waitForTimeout(300);
    await p.fill("#tlp3Text", "H3");
    const st1 = await p.evaluate(() => [TlM3D.due(tl.vlayers[0].clips[0]), document.getElementById("tlp3State").textContent]);
    check("an edit makes the bake due (the state line says so)", st1[0] === true && /due|baking/.test(st1[1]), st1);
    const bk = await p.evaluate(async () => { const c = tl.vlayers[0].clips[0]; await TlCanvas.beforeExport(); return { due: TlM3D.due(c), name: c.name, state: document.getElementById("tlp3State") && document.getElementById("tlp3State").textContent }; });
    const webm = path.join(pd, "video", bk.name);
    const pr = fs.existsSync(webm) ? JSON.parse(execFileSync("ffprobe", ["-v", "error", "-count_frames", "-select_streams", "v:0", "-show_entries",
      "stream=codec_name,nb_read_frames:stream_tags=alpha_mode", "-of", "json", webm], { encoding: "utf8" })).streams[0] : null;
    check("TlCanvas.beforeExport bakes it: video/m3d_<id>.webm, see-through VP9, 3 s = 72 frames; no longer due",
      bk.due === false && pr && pr.codec_name === "vp9" && String((pr.tags || {}).alpha_mode) === "1" && +pr.nb_read_frames === 72, [bk, pr]);

    // 4
    await p.evaluate(() => setPlayhead(2));
    await p.waitForTimeout(800);
    const snap = await p.evaluate(() => TlCanvas.snapshot());
    const snapFile = path.join(pd, "temp_m3d_snap.png");
    fs.writeFileSync(snapFile, Buffer.from(snap.split(",")[1], "base64"));
    const payload = await p.evaluate(() => ({
      video: tl.video.map((c) => ({ ...c })), video_layers: tl.vlayers.map((L) => ({ name: L.name, clips: L.clips.map((c) => ({ name: c.name, src: c.src, in: c.in, out: c.out, opacity: 1, start: c.start, tf: c.tf })) })),
      images: [], audio: [] }));
    const job = await api("/api/export", payload);
    let st = "";
    for (let i = 0; i < 150 && job.id; i++) {
      st = (await api("/api/jobs/" + job.id)).status;
      if (st === "done" || st === "failed") break;
      await new Promise((ok) => setTimeout(ok, 1000));
    }
    const movie = path.join(pd, P + ".mp4");
    check("the compile finished", st === "done" && fs.existsSync(movie), st);
    if (st === "done") {
      const W = 640, H = 360, A = rgbOf(snapFile, W, H), B = rgbOf(movie, W, H, 2.0);
      let diff = 0, lit = 0, both = 0;
      for (let i = 0; i < A.length; i += 3) {
        diff += Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2]);
        const a = A[i] > 150 && A[i + 1] < 200 && A[i + 2] < 120, bb = B[i] > 150 && B[i + 1] < 200 && B[i + 2] < 120;   // the orange letters
        if (a) lit++; if (a && bb) both++;
      }
      diff /= A.length;
      check("COMPILE = CANVAS: the 3D text's letters are where the canvas drew them (most orange pixels match)", lit > 200 && both / lit > 0.8, { lit, both });
      check("...the whole frame agrees (mean difference per channel under 12)", diff < 12, Math.round(diff * 100) / 100);
    }

    // 5 (the compile's job has to leave the stats first)
    await p.waitForFunction(() => document.getElementById("progbar").classList.contains("idle"), null, { timeout: 30000 }).catch(() => null);
    const pg = await p.evaluate(() => {
      const go = document.getElementById("go"), bar = document.getElementById("progbar"), det = document.getElementById("progdetail");
      return { order: !!(det.compareDocumentPosition(go) & 4) && !!(go.compareDocumentPosition(bar) & 4),
               hidden: getComputedStyle(bar).visibility === "hidden", text: det.textContent };
    });
    check("prompt docker: the steps line above Generate, the progress bar under it - hidden while nothing runs", pg.order && pg.hidden && (pg.text === "" || /^\d+\/\d+$|…/.test(pg.text)), pg);
    check("no page errors", errs.length === 0, errs);
  } catch (e) {
    check("the browser run finished", false, String(e && e.stack || e).slice(0, 600));
  } finally {
    try { await p.evaluate(() => { tl.video = []; tl.vlayers = []; tl.images = []; tl.audio = []; tlSave(); renderTimeline(); }); } catch { /* closed */ }
    await b.close();
    try { await api("/api/projects/load", { name: "default" }); } catch { /* best effort */ }
    try { fs.rmSync(path.join(ROOT, "projects", P), { recursive: true, force: true }); } catch { /* best effort */ }
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
