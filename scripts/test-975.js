#!/usr/bin/env node
// bitGen Studio 2.975.0 - 🧱 PICTURE → 3D SCENE (the Sketcher): one picture -> the objects found, cut out, made 3D, placed where
// they stood, the surroundings as a 360° panorama round the camera, a sound for the place + each object -> one scene .glb.
// Tim: "is this worth adding to sketcher docker https://github.com/neilsonnn/image-blaster" -> "yes, please do 1-5"
// Pure parts + the whole run with stub jobs (no ComfyUI, no models). The browser leg is test-ui975-ui.js.
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let P = 0, F = 0;
const check = (n, ok, got) => { if (ok) { P++; console.log("PASS:", n); } else { F++; console.log("FAIL:", n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const src = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const near = (a, b, e) => Math.abs(a - b) <= (e || 1e-6);

/** a tiny glTF binary: one box mesh, size w x h x d, its bottom at y0 */
function box(G, w, h, d, y0) {
  const x = w / 2, z = d / 2, yb = y0 || 0, yt = yb + h;
  const pos = [-x, yb, -z, x, yb, -z, x, yt, -z, -x, yt, -z, -x, yb, z, x, yb, z, x, yt, z, -x, yt, z];
  const idx = [0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 4, 5, 0, 5, 1, 3, 2, 6, 3, 6, 7, 0, 3, 7, 0, 7, 4, 1, 5, 6, 1, 6, 2];
  const pb = Buffer.from(new Float32Array(pos).buffer), ib = Buffer.from(new Uint16Array(idx).buffer), bin = Buffer.concat([pb, ib, Buffer.alloc((4 - ib.length % 4) % 4)]);
  const json = { asset: { version: "2.0" }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1, material: 0 }] }], materials: [{ pbrMetallicRoughness: { baseColorTexture: { index: 0 } } }],
    textures: [{ source: 0 }], images: [{ uri: "data:image/png;base64,AA==" }],
    accessors: [{ bufferView: 0, componentType: 5126, count: 8, type: "VEC3", min: [-x, yb, -z], max: [x, yt, z] }, { bufferView: 1, componentType: 5123, count: 36, type: "SCALAR" }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: pb.length }, { buffer: 0, byteOffset: pb.length, byteLength: ib.length }], buffers: [{ byteLength: bin.length }] };
  return G.glb(json, bin);
}

(async () => {
  const G = require(path.join(ROOT, "lib/glbMerge.js")), S = require(path.join(ROOT, "lib/picScene.js"));

  /* ---- glbMerge ---- */
  const a = box(G, 1, 2, 1), b = box(G, 0.5, 0.5, 0.5, -1);
  const pa = G.parse(a);
  check("parse(): a glTF 2.0 binary -> its JSON + BIN; not a .glb throws", pa.json.asset.version === "2.0" && pa.bin.length >= 96 + 72
    && (() => { try { G.parse(Buffer.from("hello world, this is no glb")); return false; } catch (e) { return /not a \.glb/.test(e.message); } })());
  check("bounds(): over the POSITION accessors", JSON.stringify(G.bounds(G.parse(b).json)) === JSON.stringify({ min: [-0.25, -1, -0.25], max: [0.25, -0.5, 0.25] }));
  const sp = G.sphere(10, 8, 4);
  check("sphere(): (seg+1)(rings+1) points, ERP: u 0.5 = FRONT (-Z), u 0.75 = right (+X), v 0 = straight up",
    sp.pos.length === 9 * 5 * 3 && sp.uv.length === 9 * 5 * 2 && sp.idx.length === 8 * 4 * 6
    && near(sp.pos[(2 * 9 + 4) * 3 + 2], -10) && near(sp.pos[(2 * 9 + 6) * 3], 10) && near(sp.pos[1], 10));
  const png = Buffer.from("89504e470d0a1a0a0000000d4948445200000001000000010806000000", "hex");
  const merged = G.merge([{ glb: a, name: "chair", translation: [1, 0, -4], rotation: [0, 0.2, 0, Math.sqrt(1 - 0.04)], scale: 0.5 }, { glb: b, name: "lamp", scale: [2, 2, 2] }],
    { name: "room", pano: { data: png, mime: "image/png" }, camera: { vfov: 40, aspect: 1.5, y: 1.6 } });
  const m = G.parse(merged), J = m.json;
  const names = J.scenes[0].nodes.map((k) => J.nodes[k].name);
  check("merge(): one scene - a root per object (its place, turn, size) + the surroundings + the camera",
    JSON.stringify(names) === JSON.stringify(["chair", "lamp", "surroundings (360 panorama)", "camera"])
    && JSON.stringify(J.nodes[J.scenes[0].nodes[0]].translation) === "[1,0,-4]" && JSON.stringify(J.nodes[J.scenes[0].nodes[0]].scale) === "[0.5,0.5,0.5]"
    && JSON.stringify(J.nodes[J.scenes[0].nodes[1]].scale) === "[2,2,2]", names);
  const lampRoot = J.nodes[J.scenes[0].nodes[1]], lampMesh = J.meshes[J.nodes[lampRoot.children[0]].mesh];
  check("merge(): the second model's indices shifted - its node -> its mesh -> its accessors -> its bufferViews (inside the one BIN)",
    J.meshes.length === 3 && lampMesh.primitives[0].attributes.POSITION === 2 && lampMesh.primitives[0].indices === 3 && lampMesh.primitives[0].material === 1
    && J.accessors[2].bufferView === 2 && J.bufferViews[2].byteOffset >= pa.bin.length && J.bufferViews[2].byteOffset % 4 === 0
    && J.materials[1].pbrMetallicRoughness.baseColorTexture.index === 1 && J.textures[1].source === 1 && J.buffers.length === 1 && J.buffers[0].byteLength <= m.bin.length && J.buffers[0].byteLength > m.bin.length - 4);
  const lampPos = J.accessors[2], v0 = new Float32Array(m.bin.buffer.slice(m.bin.byteOffset + J.bufferViews[2].byteOffset, m.bin.byteOffset + J.bufferViews[2].byteOffset + 12));
  check("merge(): the bytes moved with their bufferView (the lamp's first point is still -0.25, -1, -0.25)", lampPos.count === 8 && near(v0[0], -0.25) && near(v0[1], -1) && near(v0[2], -0.25), [...v0]);
  const pano = J.meshes[2], pm = J.materials[pano.primitives[0].material];
  check("merge(): the panorama - an unlit double-sided material, its picture inside the BIN, the sphere at eye height",
    pm.doubleSided === true && pm.extensions.KHR_materials_unlit && J.extensionsUsed.includes("KHR_materials_unlit")
    && J.images[pm.pbrMetallicRoughness.baseColorTexture.index === 2 ? J.textures[2].source : -1].mimeType === "image/png"
    && JSON.stringify(J.nodes[J.scenes[0].nodes[2]].translation) === "[0,1.6,0]" && J.accessors[pano.primitives[0].indices].componentType === 5125);
  const img = J.images[J.textures[2].source], ibv = J.bufferViews[img.bufferView];
  check("merge(): the panorama's bytes are the PNG given", m.bin.slice(ibv.byteOffset, ibv.byteOffset + ibv.byteLength).equals(png));
  check("merge(): the camera - perspective, 40° high, at 1.6 m", J.cameras[0].type === "perspective" && near(J.cameras[0].perspective.yfov, 40 * Math.PI / 180) && J.nodes[J.scenes[0].nodes[3]].camera === 0);
  const bare = G.parse(G.merge([{ glb: a, name: "x" }], { camera: false })).json;
  check("merge(): no panorama, no camera -> just the models", bare.scenes[0].nodes.length === 1 && !bare.cameras && !bare.extensionsUsed && bare.nodes.length === 2);

  /* ---- picScene: the pure parts ---- */
  const t = 'Here: ```json\n{"place": "a sunny  street café", "objects": [{"name": "red bicycle", "box": [100, 400, 380, 900], "sound": "a bike bell"},'
    + '{"name":"table","bbox":[0.5,0.55,0.7,0.85],"sound":"cups"},{"name":"table","box":[700,550,900,850]},{"name":"sky","box":[0,0,1000,1000]},'
    + '{"name":"","box":[1,1,2,2]},{"name":"dot","box":[10,10,20,20]}]}\n```';
  const f = S.parseFind(t, { max: 6 });
  check("parseFind(): the JSON out of the answer - boxes 0..1 rescaled, the sky (the whole picture) and specks dropped, a second 'table' numbered",
    f.place === "a sunny street café" && f.objects.length === 3 && f.objects[0].name === "red bicycle" && f.objects[0].sound === "a bike bell"
    && JSON.stringify(f.objects[1].box) === "[500,550,700,850]" && f.objects[2].name === "table 2", f);
  check("parseFind(): pixel boxes rescaled by the picture's size; a bare list; <think> skipped; nothing usable -> no objects",
    JSON.stringify(S.parseFind('<think>{"no":1}</think>[{"name":"car","box":[192,108,1536,972]}]', { w: 1920, h: 1080 }).objects[0].box) === "[100,100,800,900]"
    && S.parseFind("I can't see anything").objects.length === 0 && S.parseFind(t, { max: 1 }).objects.length === 1);
  check("cutPrompt() / platePrompt(): the edit model told which one (and which side) / what to take out",
    /only the red bicycle on the left of <image1>/.test(S.cutPrompt(f.objects[0])) && /white background/.test(S.cutPrompt(f.objects[0]))
    && /Remove the red bicycle, the table, the table 2 from <image1>/.test(S.platePrompt(f.objects, f.place)) && /sunny street café/.test(S.platePrompt(f.objects, f.place)));
  const c0 = S.place([450, 300, 550, 900], { hfov: 65, aspect: 16 / 9 });
  check("place(): in the middle -> straight ahead (yaw 0), on the ground in front (-Z), no turn", near(c0.yaw, 0) && near(c0.translation[0], 0) && c0.translation[2] < 0 && near(c0.rotation[1], 0), c0);
  const vf = 2 * Math.atan(Math.tan(32.5 * Math.PI / 180) / (16 / 9)), dist = 1.6 / Math.tan(Math.atan(0.4 * 2 * Math.tan(vf / 2)));
  check("place(): the box's bottom below the horizon -> the distance (eye 1.6 m); its height in the picture -> its size", near(c0.dist, dist, 1e-6) && near(c0.height, 2 * dist * Math.tan(vf / 2) * 0.6, 1e-6), c0);
  const r = S.place([800, 400, 1000, 700]), l = S.place([0, 400, 200, 700]);
  check("place(): on the right -> +X, turned to face the camera (yaw > 0, the turn the other way); the left mirrors it",
    r.yaw > 20 && r.translation[0] > 0 && r.rotation[1] < 0 && near(l.yaw, -r.yaw) && near(l.translation[0], -r.translation[0]) && near(r.rotation[1] ** 2 + r.rotation[3] ** 2, 1));
  const far = S.place([400, 100, 600, 480]), close = S.place([300, 500, 700, 1000]);
  check("place(): standing above the horizon -> the default 4 m; right at the bottom -> no nearer than 1.2 m; never past 18 m", far.dist === 4 && close.dist >= 1.2 && S.place([490, 495, 510, 501]).dist <= 18);
  const ag = S.audioGraph("rain on a tin roof", 99, 42, "rain");
  check("audioGraph(): Stable Audio Open 1.0 with ComfyUI's own nodes - the checkpoint, the T5 (stable_audio), ≤ 47 s, 50 steps / cfg 4.98, saved as audio",
    ag["1"].inputs.ckpt_name === "stable-audio-open-1.0.safetensors" && ag["2"].inputs.type === "stable_audio" && ag["2"].inputs.clip_name === "t5_base.safetensors"
    && ag["5"].inputs.seconds === 47 && ag["6"].inputs.steps === 50 && ag["6"].inputs.cfg === 4.98 && ag["6"].inputs.seed === 42 && ag["8"].class_type === "SaveAudio" && ag["7"].inputs.vae[1] === 2);
  check("safeName(): file-safe", S.safeName("red bike / #2!") === "red_bike_2" && S.safeName("") === "object");

  /* ---- the whole run with stub jobs ---- */
  const core = require(path.join(ROOT, "lib/core"));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sc975_")), out = path.join(dir, "output"), m3d = path.join(dir, "models3d");
  [out, m3d].forEach((d) => fs.mkdirSync(d, { recursive: true }));
  const pic = path.join(dir, "street.png");
  require("child_process").execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "testsrc=s=640x360", "-frames:v", "1", pic]);
  const realP = core.pDir, realOD = core.outputDirs, real = Object.assign({}, S.deps);
  core.pDir = (k) => path.join(dir, k); core.outputDirs = () => [dir, out];
  const jobs = new Map(); let n = 0; const made = [];
  S.deps.describe = async () => '{"place":"a quiet street","objects":[{"name":"bench","box":[100,500,400,900],"sound":"wood creak"},{"name":"bin","box":[700,600,800,850],"sound":"lid clang"}]}';
  S.deps.makeJob = (p) => {
    const id = "j" + (++n); made.push(p);
    let file = "";
    if (p.mode === "image") { file = "img_" + n + ".png"; fs.copyFileSync(pic, path.join(out, file)); }
    if (p.mode === "graph") { file = p.graph["8"].inputs.filename_prefix + ".flac"; fs.writeFileSync(path.join(out, file), "fLaC"); }
    jobs.set(id, { id, status: "done", output: file, project: "x" }); return id;
  };
  S.deps.job = (id) => jobs.get(id);
  S.deps.to3d = (pc, o) => { const id = "m" + (++n); fs.writeFileSync(path.join(m3d, o.model_name + ".glb"), box(G, 0.8, 1.2, 0.5)); jobs.set(id, { id, status: "done", output: null }); return { id, model: o.model_name + ".glb" }; };
  S.deps.m3dDir = () => m3d; S.deps.sleep = () => new Promise((r2) => setImmediate(r2));
  const styles = require(path.join(ROOT, "lib/styles")), realRead = styles.read;
  styles.read = () => [{ id: "st_ba4bce9c1e93", name: "Qwen Image 2.1 edit", workflow: "comfy_workflows/img_qwen21_edit.json", steps: 25, cfg: 1 }];
  try {
    const s0 = S.create(pic, { max: 4 });
    check("create(): a scene id, running, every step waiting", /^sc_/.test(s0.id) && s0.status === "running" && S.STEPS.every((k) => s0.steps[k]));
    for (let i = 0; i < 200 && S.read(s0.id).status === "running"; i++) await new Promise((r2) => setTimeout(r2, 20));
    const s = S.read(s0.id);
    check("the run: done - every step done (the 🌍 world off: skipped, and says how)", s.status === "done" && S.STEPS.every((k) => s.steps[k].state === (k === "world" ? "skip" : "done")) && /🌍/.test(s.steps.world.msg), s.steps);
    const imgs = made.filter((p) => p.mode === "image"), snd = made.filter((p) => p.mode === "graph");
    check("the run: 2 cut-outs + the clean plate + the panorama = 4 image jobs (Qwen edit, the picture in, not in the assets)",
      imgs.length === 4 && imgs.every((p) => p.no_assets && p.images.length === 1) && imgs.slice(0, 3).every((p) => p.images[0] === pic)
      && /Remove the bench, the bin/.test(imgs[2].prompt) && imgs[3].pano360 === "make" && /2048x1024|pano_canvas/.test(imgs[3].images[0]), imgs.map((p) => p.prompt));
    const canvas = imgs[3].images[0], sz = require("child_process").execFileSync("ffprobe", ["-v", "error", "-show_entries", "stream=width,height", "-of", "csv=p=0:s=x", canvas], { encoding: "utf8" }).trim();
    check("the run: the 360 canvas - the clean plate at FRONT on 2048 x 1024 (pcpano.js in Node, ffmpeg the pixels)", sz === "2048x1024", sz);
    check("the run: the sounds - an ambience (20 s) + one per object (5 s)", snd.length === 3 && snd[0].graph["5"].inputs.seconds === 20 && /quiet street/.test(snd[0].graph["3"].inputs.text) && /wood creak/.test(snd[1].graph["3"].inputs.text) && s.ambient && s.objects.every((o) => o.sfx));
    check("the run: a 3D model per object (named after the scene + the object)", s.objects.every((o) => o.glb && fs.existsSync(o.glb)) && /street_bench\.glb$/.test(s.objects[0].glb));
    const sc = G.parse(fs.readFileSync(s.sceneGlb)).json, roots = sc.scenes[0].nodes.map((k) => sc.nodes[k]);
    check("the run: <name>_scene.glb in the models folder - the bench, the bin, the surroundings, the camera", path.basename(s.sceneGlb) === "street_scene.glb"
      && JSON.stringify(roots.map((x) => x.name)) === JSON.stringify(["bench", "bin", "surroundings (360 panorama)", "camera"]), roots.map((x) => x.name));
    const bench = roots[0], pl = s.objects[0].place;
    check("the run: each model scaled to its height in the picture, its feet on the ground, on its spot (left = -X)",
      near(bench.scale[0], pl.height / 1.2, 1e-9) && near(bench.translation[1], 0) && bench.translation[0] < 0 && bench.translation[2] < 0 && pl.yaw < 0, { bench, pl });
    /* 🌍 the walk-in world (5b) - the add-on not installed, then installed (stubbed) */
    S.deps.hyworld = () => ({ ready: () => false });
    await S.worldStep(s);
    check("🌍 worldStep(): HunyuanWorld 1.0 not installed -> skipped, says where to install it", s.steps.world.state === "skip" && /Settings ▸ Add-ons ▸ HunyuanWorld/.test(s.steps.world.msg));
    let wp = null;
    S.deps.hyworld = () => ({ ready: () => true, jobParams: (pano, o) => { wp = { pano, o }; return { params: { mode: "hyworld", source: pano, name: o.name } }; } });
    const realMake = S.deps.makeJob;
    S.deps.makeJob = (pp) => { if (pp.mode !== "hyworld") return realMake(pp); const id = "w" + (++n); fs.writeFileSync(path.join(m3d, "street_world.glb"), box(G, 1, 1, 1)); jobs.set(id, { id, status: "done", output: "street_world.glb" }); return id; };
    const w1 = S.world(s.id);
    check("🌍 world(id) on a finished scene: running again (just the world step)", w1.status === "running");
    for (let i = 0; i < 200 && S.read(s.id).status === "running"; i++) await new Promise((r2) => setTimeout(r2, 20));
    const sw = S.read(s.id);
    check("🌍 the world: the panorama + the objects (lifted out as layer 1) + indoor / outdoor -> models3d/<name>_world.glb",
      sw.status === "done" && sw.steps.world.state === "done" && /street_world\.glb$/.test(sw.worldGlb) && wp.pano === sw.pano && JSON.stringify(wp.o.fg1) === '["bench","bin"]' && wp.o.indoor === false, { steps: sw.steps.world, wp });
    S.deps.makeJob = realMake;
    check("🌍 world(): a scene that is not there -> 404", (() => { try { S.world("sc_nope"); return false; } catch (e) { return e.status === 404; } })());
    check("list(): the scene listed", S.list().some((x) => x.id === s.id && x.status === "done" && x.objects === 2));
    // a failing job stops the run and says where
    S.deps.to3d = () => { const id = "bad" + (++n); jobs.set(id, { id, status: "failed", error: "out of memory" }); return { id, model: "x.glb" }; };
    const s1 = S.create(pic, { sound: false, pano: false });
    for (let i = 0; i < 200 && S.read(s1.id).status === "running"; i++) await new Promise((r2) => setTimeout(r2, 20));
    const b1 = S.read(s1.id);
    check("a failed job: the scene failed, the step that broke says why; the panorama / the sounds switched off say so",
      b1.status === "failed" && b1.steps.mesh.state === "fail" && /out of memory/.test(b1.steps.mesh.msg) && b1.steps.pano.state === "skip" && b1.steps.cut.state === "done", b1.steps);
    // 2.978.0 ↻ Try again: the 3D step again (a model downloaded), the find / cut steps kept (no new edit jobs)
    const imgJobs0 = made.filter((pp) => pp.mode === "image").length;
    S.deps.to3d = (pc, o) => { const id = "m" + (++n); fs.writeFileSync(path.join(m3d, o.model_name + ".glb"), box(G, 0.8, 1.2, 0.5)); jobs.set(id, { id, status: "done", output: null }); return { id, model: o.model_name + ".glb" }; };
    S.retry(s1.id);
    for (let i = 0; i < 200 && S.read(s1.id).status === "running"; i++) await new Promise((r2) => setTimeout(r2, 20));
    const b2 = S.read(s1.id);
    check("↻ retry(): carries on from the failed 3D step - done, no new cut-out / plate jobs, the scene .glb made", b2.status === "done" && b2.steps.mesh.state === "done" && made.filter((pp) => pp.mode === "image").length === imgJobs0 && b2.sceneGlb && fs.existsSync(b2.sceneGlb), { st: b2.steps, imgJobs0 });
    // stop
    S.deps.job = (id) => (/^j/.test(id) ? { status: "running" } : jobs.get(id));
    const s2 = S.create(pic, {});
    await new Promise((r2) => setTimeout(r2, 30));
    check("cancel(): a running scene stops", S.cancel(s2.id) === true);
    for (let i = 0; i < 100 && S.read(s2.id).status === "running"; i++) await new Promise((r2) => setTimeout(r2, 20));
    check("cancel(): it says stopped", S.read(s2.id).status === "cancelled" && S.cancel("sc_nope") === false);
    S.deps.describe = async () => "nothing here";
    S.deps.job = (id) => jobs.get(id);
    const s3 = S.create(pic, {});
    for (let i = 0; i < 100 && S.read(s3.id).status === "running"; i++) await new Promise((r2) => setTimeout(r2, 20));
    check("no objects found -> it says so (and why it may be)", S.read(s3.id).status === "failed" && /found no objects/.test(S.read(s3.id).error));
    check("create(): a picture that is not there -> 404", (() => { try { S.create(path.join(dir, "nope.png")); return false; } catch (e) { return e.status === 404; } })());
  } finally { core.pDir = realP; core.outputDirs = realOD; Object.assign(S.deps, real); styles.read = realRead; fs.rmSync(dir, { recursive: true, force: true }); }

  /* ---- 🌍 the HunyuanWorld 1.0 add-on (pure parts) ---- */
  const HW = require(path.join(ROOT, "lib/hyworldAddon.js"));
  const yml = "name: HunyuanWorld\ndependencies:\n  - python=3.10\n  - pip:\n      - torch==2.5.0+cu124\n      - diffusers==0.34.0  # pinned\n      - nvidia-cublas-cu12==12.4\n      - open3d>=0.18\n      - moge @ git+https://github.com/microsoft/MoGe.git\n  - numpy\nprefix: /x\n";
  check("yamlPip(): the pip part of docker/HunyuanWorld.yaml - torch / nvidia pins out, comments off, git+ kept", JSON.stringify(HW.yamlPip(yml)) === JSON.stringify(["diffusers==0.34.0", "open3d>=0.18", "moge @ git+https://github.com/microsoft/MoGe.git"]), HW.yamlPip(yml));
  const hb = fs.mkdtempSync(path.join(os.tmpdir(), "hw975_"));
  check("missing() / status(): nothing installed -> not installed + the licence said (EU / UK / South Korea, FLUX.1 Fill non-commercial)",
    HW.missing(hb).length === 6 && HW.status(hb).installed === false && /EU, the UK or South Korea/.test(HW.status(hb).note) && /NON-COMMERCIAL/.test(HW.status(hb).note));
  check("jobParams(): not installed -> says so (Settings ▸ Add-ons), no job", /Settings ▸ Add-ons ▸ HunyuanWorld 1\.0/.test(HW.jobParams(__filename, {}).error || ""));
  fs.rmSync(hb, { recursive: true, force: true });
  const ad = require(path.join(ROOT, "lib/addons.js")).LIST.find((a) => a.id === "hyworld");
  check("Settings ▸ Add-ons: HunyuanWorld 1.0 (its size, needs, links, install / remove)", ad && /45 GB/.test(ad.size) && /24 GB/.test(ad.needs) && typeof ad.install === "function" && ad.links().length === 3);
  check("the worker: mode hyworld -> misc/hyworld_worker.py (core's WORKER_FOR, the misc/ list)", /hyworld: "hyworld_worker\.py"/.test(src("lib/core.js")) && fs.existsSync(path.join(ROOT, "misc/hyworld_worker.py")) && /"hyworld_worker\.py"/.test(src("lib/miscMigrate.js")));
  const pyOut = require("child_process").execFileSync("python3", ["-c", "import sys; sys.path.insert(0, sys.argv[1]); import hyworld_worker as w; "
    + "c = w.scene_cmd('py', 'demo.py', 'p.png', 'out', {'classes': 'indoor', 'labels_fg1': ['red bike', 'x;rm'], 'labels_fg2': [], 'seed': 7, 'low_memory': True}, 'parser --seed --fp8_attention --cache'); print('|'.join(c))", path.join(ROOT, "misc")], { encoding: "utf8" }).trim();
  check("the worker's command: the panorama, indoor, the objects (one word each), the seed and the low-memory switches only when the demo has them",
    pyOut === "py|demo.py|--image_path|p.png|--classes|indoor|--output_path|out|--labels_fg1|red_bike|x_rm|--seed|7|--fp8_attention|--cache", pyOut);

  /* ---- the routes, the catalog, the Sketcher ---- */
  const idx = src("routes/index.js"), rt = src("routes/picScene.js");
  check("routes: mounted from routes/index.js (never server.js)", /require\("\.\/picScene"\)\.mount\(app\)/.test(idx) && !/picScene/.test(src("misc/server.js")));
  check("routes: POST /api/picscene, GET /api/picscene(/:id), cancel, needs (the sound models)", ["app.post(\"/api/picscene\"", "app.get(\"/api/picscene\"", "app.get(\"/api/picscene/needs\"", "app.get(\"/api/picscene/:id\"", "app.post(\"/api/picscene/:id/cancel\"", "/api/picscene/:id/file", "app.get(\"/api/picscene/world\"", "app.post(\"/api/picscene/:id/world\""].every((x) => rt.includes(x)));
  check("routes: /needs and /world come before /:id", rt.indexOf("app.get(\"/api/picscene/needs") < rt.indexOf("app.get(\"/api/picscene/:id\"") && rt.indexOf("app.get(\"/api/picscene/world") < rt.indexOf("app.get(\"/api/picscene/:id\""));
  const cat = JSON.parse(src("lib/modelCatalog.json")), list = Array.isArray(cat) ? cat : cat.models || cat.list || Object.values(cat).find(Array.isArray);
  const sa = list.find((e) => e.id === "stable_audio_open"), t5 = list.find((e) => e.id === "t5_base");
  check("the catalog: Stable Audio Open 1.0 (-> comfy/checkpoints) + the T5 base encoder (-> comfy/text_encoders/t5_base.safetensors)",
    sa && sa.file === "stable-audio-open-1.0.safetensors" && sa.dest === "comfy/checkpoints" && t5 && t5.as === "t5_base.safetensors" && t5.dest === "comfy/text_encoders");
  const ui = src("ext/pushpulldock/ppscene.js"), ext = JSON.parse(src("ext/pushpulldock/ext.json")), dock = src("ext/pushpulldock/ppdock.js");
  check("the Sketcher: ppscene.js loaded by the dock; the 🧱 Picture → 3D scene button", JSON.stringify(ext).includes("ppscene.js") && /Picture → 3D scene/.test(ui) && /H3PicScene/.test(dock));
  check("the Sketcher: the models checked first (the edit style, then the sound models) - the Download / Cancel box", /H3ModelsFound\.ensure/.test(ui) && /H3ModelsFound\.box/.test(ui) && /\/api\/picscene\/needs/.test(ui));
  check("the Sketcher: Open in the Sketcher (importModel) + Look round in 3D + the sounds + download", /importModel|openModel/.test(ui) && /OrbitControls/.test(ui) && /<audio|new Audio/.test(ui) && /download/.test(ui));
  check("the docs: USAGE + CHANGELOG + NOTICE (the licences)", /Picture → 3D scene/.test(src("docs/USAGE.md")) && /2\.975\.0/.test(src("misc/CHANGELOG.md")) && /Stable Audio Open/.test(src("misc/NOTICE.md")));

  console.log(`\n${P} passed, ${F} failed`);
  process.exit(F ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
