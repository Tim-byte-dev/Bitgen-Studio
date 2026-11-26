#!/usr/bin/env node
/* bitGen Studio — 2.975.0 in a REAL browser: 🧱 Picture → 3D scene in the Sketcher.
 *   The real routes first (GET /api/picscene, /needs, a picture that is not there -> 404); then the dialog with the jobs
 *   stubbed (page.route): the 🧱 button opens it, a gallery picture picked, the models checked (the edit style, then the
 *   sound models), POST /api/picscene with the options, the steps painted as the scene runs, then done: ⤒ Open in the
 *   Sketcher brings the objects in as a group WITHOUT the panorama sphere, 👁 Look round draws the .glb (a real one made by
 *   lib/glbMerge.js), ⤓ Download points at the .glb.
 * Tim: "is this worth adding to sketcher docker https://github.com/neilsonnn/image-blaster" -> "yes, please do 1-5" */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };

function boxGlb(G) {
  const pos = [-0.5, 0, -0.5, 0.5, 0, -0.5, 0.5, 1, -0.5, -0.5, 1, -0.5, -0.5, 0, 0.5, 0.5, 0, 0.5, 0.5, 1, 0.5, -0.5, 1, 0.5];
  const idx = [0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 4, 5, 0, 5, 1, 3, 2, 6, 3, 6, 7, 0, 3, 7, 0, 7, 4, 1, 5, 6, 1, 6, 2];
  const pb = Buffer.from(new Float32Array(pos).buffer), ib = Buffer.from(new Uint16Array(idx).buffer), bin = Buffer.concat([pb, ib]);
  return G.glb({ asset: { version: "2.0" }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0, name: "body" }], meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1, material: 0 }] }],
    materials: [{ pbrMetallicRoughness: { baseColorFactor: [0.8, 0.3, 0.2, 1] } }],
    accessors: [{ bufferView: 0, componentType: 5126, count: 8, type: "VEC3", min: [-0.5, 0, -0.5], max: [0.5, 1, 0.5] }, { bufferView: 1, componentType: 5123, count: 36, type: "SCALAR" }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: pb.length }, { buffer: 0, byteOffset: pb.length, byteLength: ib.length }], buffers: [{ byteLength: bin.length }] }, bin);
}

(async () => {
  if (!chromium) { console.log("SKIP: playwright is not installed here"); console.log("\nRESULT: 0 passed, 0 failed"); return; }
  const G = require(path.join(__dirname, "..", "lib", "glbMerge.js"));
  let png;
  try { png = execSync("ffmpeg -loglevel error -f lavfi -i testsrc=s=256x128 -frames:v 1 -f image2pipe -vcodec png -"); } catch (e) { console.log("SKIP: no ffmpeg"); console.log("\nRESULT: 0 passed, 0 failed"); return; }
  const scene = G.merge([{ glb: boxGlb(G), name: "bench", translation: [-1, 0, -4], rotation: [0, 0.1, 0, Math.sqrt(0.99)], scale: 0.8 }, { glb: boxGlb(G), name: "bin", translation: [1.5, 0, -6] }],
    { name: "ui975", pano: { data: png, mime: "image/png" }, camera: { vfov: 40, aspect: 1.6 } });
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1700, height: 1050 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  const sleep = (ms) => p.waitForTimeout(ms);
  try {
    /* ---- the real routes ---- */
    const l = await (await p.request.get(URL_ + "api/picscene")).json();
    check("GET /api/picscene: the project's scenes (a list)", Array.isArray(l.scenes), l);
    const nd = await (await p.request.get(URL_ + "api/picscene/needs")).json();
    check("GET /api/picscene/needs: the sound models checked (checked + a missing list)", typeof nd.checked === "boolean" && Array.isArray(nd.missing), nd);
    const nf = await p.request.post(URL_ + "api/picscene", { data: { name: "no_such_picture_975.png" } });
    check("POST /api/picscene with a picture that is not there -> 404, nothing started", nf.status() === 404 && /not in this project/.test((await nf.json()).error), nf.status());
    const mc = await (await p.request.post(URL_ + "api/models/check", { data: { files: [{ name: "stable-audio-open-1.0.safetensors", cat: "checkpoints" }] } })).json();
    check("POST /api/models/check {files} - just those files (the box checks them again after ⬇ Download)", mc.kind === "files", mc);
    const gone = await p.request.get(URL_ + "api/picscene/sc_nope");
    check("GET /api/picscene/<not there> -> 404", gone.status() === 404);

    /* ---- the dialog, the jobs stubbed ---- */
    const posted = []; let polls = 0;
    const steps = (o) => Object.assign({ find: { state: "wait", msg: "" }, cut: { state: "wait", msg: "" }, pano: { state: "wait", msg: "" }, mesh: { state: "wait", msg: "" }, sound: { state: "wait", msg: "" }, scene: { state: "wait", msg: "" } }, o);
    const running = { id: "sc_ui975", name: "ui975", status: "running", msg: "the Vision model is looking for the objects…", steps: steps({ find: { state: "run", msg: "looking…" } }), objects: [] };
    const done = { id: "sc_ui975", name: "ui975", status: "done", msg: "done", sceneGlb: "ui975_scene.glb", pano: "pano.png", ambient: "amb.flac",
      steps: steps({ find: { state: "done", msg: "2 objects: bench, bin" }, cut: { state: "done", msg: "" }, pano: { state: "done", msg: "" }, mesh: { state: "done", msg: "2 model(s)" }, sound: { state: "done", msg: "" }, scene: { state: "done", msg: "ui975_scene.glb" } }),
      objects: [{ name: "bench", cut: "cut1.png", glb: "ui975_bench.glb", sfx: "s1.flac", place: { dist: 4.1, height: 0.8 } }, { name: "bin", cut: "cut2.png", glb: "ui975_bin.glb", place: { dist: 6, height: 1 } }] };
    await p.route(/\/api\/outputs\?kind=images/, (r) => r.fulfill({ json: [{ name: "ui975.png", mtime: 2 }] }));
    await p.route(/\/outputs\/ui975\.png/, (r) => r.fulfill({ body: png, contentType: "image/png" }));
    await p.route(/\/api\/pano360$/, (r) => r.fulfill({ json: { ok: true, style_id: "st_ui975" } }));
    await p.route(/\/api\/picscene\/needs/, (r) => r.fulfill({ json: { checked: true, missing: [{ name: "t5_base.safetensors", cat: "text_encoders", folder: "models/text_encoders", source: { id: "t5_base", size: 892000000 } }] } }));
    await p.route(/\/api\/picscene(\?.*)?$/, (r) => { if (r.request().method() === "POST") { posted.push(r.request().postDataJSON()); return r.fulfill({ json: running }); } return r.fulfill({ json: { scenes: [] } }); });
    await p.route(/\/api\/picscene\/sc_ui975$/, (r) => { polls++; r.fulfill({ json: polls < 2 ? running : done }); });
    await p.route(/\/api\/picscene\/sc_ui975\/file/, (r) => { const f = new URL(r.request().url()).searchParams.get("f"); return /png$/.test(f) ? r.fulfill({ body: png, contentType: "image/png" }) : r.fulfill({ body: Buffer.alloc(0), contentType: "audio/flac" }); });
    await p.route(/\/api\/tlcanvas\/model\/ui975_scene\.glb/, (r) => r.fulfill({ body: scene, contentType: "model/gltf-binary" }));

    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3PushPull && window.H3PicScene && document.getElementById("tX_pushpulldock"), null, { timeout: 60000 });
    await ev(() => { const d = document.getElementById("pushpulldock"); if (d.classList.contains("dockgone")) toggleDockGone("pushpulldock", "tX_pushpulldock"); localStorage.setItem("h3.dockmax.off", "1"); H3PushPullFrame.toggleMaxed(true); });
    await p.waitForFunction(() => H3PushPull.state.booted && H3PushPull.state.M && H3PushPull.state.V, null, { timeout: 40000 });
    await ev(() => { H3PushPull.newModel && H3PushPull.newModel(); });
    await sleep(600);
    await ev(() => { window.__mf = []; H3ModelsFound.ensure = (q) => { window.__mf.push(["ensure", q]); return Promise.resolve(true); }; H3ModelsFound.box = (r, q) => { window.__mf.push(["box", q, r.missing.length]); return Promise.resolve(true); }; });
    check("the Sketcher's bar: 🧱 Picture → 3D scene", await p.locator("#ppScene").isVisible());
    await p.click("#ppScene");
    await p.waitForSelector("#pscDlg[open] .psc-pics img", { timeout: 8000 });
    check("🧱 opens the dialog - the gallery's pictures, the options, the licences said", await ev(() => !!document.getElementById("pscDlg").open && document.querySelectorAll("#pscPics img").length === 1
      && /Stability AI Community/.test(document.querySelector("#pscDlg .psc-note").textContent)));
    await p.click("#pscGo");
    check("🧱 Make the scene with no picture: it says pick one, nothing sent", /pick a picture/.test(await p.textContent("#pscMsg")) && posted.length === 0);
    await p.click("#pscPics img");
    await p.fill("#pscMax", "3"); await p.selectOption("#pscLens", "80");
    await p.click("#pscGo");
    await p.waitForFunction(() => /◐/.test(document.getElementById("pscMsg").textContent), null, { timeout: 8000 });
    const mf = await ev(() => window.__mf);
    check("the models first: the edit style (ensure), then the sound models (the Download / Cancel box with just those files)",
      mf.length === 2 && mf[0][0] === "ensure" && mf[0][1].style_id === "st_ui975" && mf[1][0] === "box" && mf[1][1].files.length === 2 && mf[1][2] === 1, mf);
    check("POST /api/picscene: the picture + the options", posted.length === 1 && posted[0].name === "ui975.png" && posted[0].max === 3 && posted[0].hfov === 80 && posted[0].pano === true && posted[0].sound === true, posted);
    check("running: the steps - find running, ■ Stop shown", await ev(() => document.querySelector(".psc-step.run") && /Find the objects/.test(document.querySelector(".psc-step.run").textContent) && !document.getElementById("pscStop").hidden));
    await p.waitForFunction(() => /✔/.test(document.getElementById("pscMsg").textContent), null, { timeout: 10000 });
    const d1 = await ev(() => ({ done: document.querySelectorAll(".psc-step.done").length, objs: [...document.querySelectorAll(".psc-obj b")].map((x) => x.textContent), audio: document.querySelectorAll("#pscDlg audio").length,
      pano: !document.getElementById("pscPanoImg").hidden, open: !document.getElementById("pscOpen").hidden, look: !document.getElementById("pscLook").hidden, dl: document.getElementById("pscDl").getAttribute("href"), stop: document.getElementById("pscStop").hidden }));
    check("done: every step ticked, the objects with their cut-outs, the panorama, the sounds, the buttons", d1.done === 6 && d1.objs.join() === "bench,bin" && d1.audio === 2 && d1.pano && d1.open && d1.look && d1.stop && /ui975_scene\.glb$/.test(d1.dl), d1);
    await p.route(/\/api\/picscene\/world$/, (r) => r.fulfill({ json: { installed: false, note: "not installed. LICENCE: ...", missing: [] } }));
    await ev(() => { window.__act = []; window.H3Addons = Object.assign(window.H3Addons || {}, { refresh: () => Promise.resolve(), act: (id, what) => { window.__act.push(id + ":" + what); return Promise.resolve(null); } }); });
    check("🌍 Walk-in world offered on a finished scene with a panorama (and no world yet)", await p.locator("#pscWorldGo").isVisible());
    await p.click("#pscWorldGo");
    await p.waitForFunction(() => window.__act.length > 0, null, { timeout: 5000 }).catch(() => {});
    const wa = await ev(() => ({ act: window.__act, msg: document.getElementById("pscMsg").textContent }));
    check("🌍 with HunyuanWorld 1.0 not installed: its add-on's Install / Cancel box (Settings ▸ Add-ons), nothing sent", wa.act.join() === "hyworld:install" && /not installed/.test(wa.msg), wa);
    await p.click("#pscLook");
    await p.waitForFunction(() => /drag to look round/.test(document.getElementById("pscMsg").textContent) || /⚠/.test(document.getElementById("pscMsg").textContent), null, { timeout: 15000 });
    const lk = await ev(() => ({ msg: document.getElementById("pscMsg").textContent, shown: getComputedStyle(document.getElementById("pscView")).display, view: !!H3PicScene.state.view }));
    check("👁 Look round in 3D: the scene .glb (the models + the panorama sphere) drawn", lk.shown === "block" && lk.view && /drag to look round/.test(lk.msg), lk);
    await p.click("#pscLook");
    const g0 = await ev(() => H3PushPull.state.M.g.length);
    await p.click("#pscOpen");
    await p.waitForFunction(() => !document.getElementById("pscDlg").open, null, { timeout: 15000 }).catch(() => {});
    const im = await ev(() => { const M = H3PushPull.state.M, g = M.g[M.g.length - 1]; return { groups: M.g.length, name: g && g.name, faces: M.f.filter((f) => f.grp === (g && g.id)).length, msg: document.getElementById("ppMsg").textContent }; });
    check("⤒ Open in the Sketcher: the scene's two boxes as ONE group named after it - 24 triangles, the panorama sphere left out", im.groups === g0 + 1 && im.name === "ui975_scene" && im.faces > 0 && im.faces <= 24, im);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + e.message); }
  await b.close();
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
