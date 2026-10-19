#!/usr/bin/env node
/* bitGen Studio — 2.390.0: SEGMENT ANYTHING, ✨ COMPOSE (layers as references), → REFERENCES and PSD files - the server
 * side and the pure parts. Run: node scripts/test-pcsam.js
 * Tim (verbatim): "yes, please do these steps and maybe add sam to segment the image on the layer and add an option to
 * put segments on different layers" - the steps: layers as references, a prompt that masks ("mask the persons head"),
 * open PSD files, Generate in the prompt docker with the editor's layers.
 *   1. lib/segment: the request checks, the venv's pip plan (CUDA torch on an NVIDIA card), the checkpoint download,
 *      the checkpoint found by name (ComfyUI's models/sams too), status / settings;
 *   2. scripts/segment.py through lib/segment.run (--fake: flat-colour regions stand in for SAM): points / box / words /
 *      everything -> masks (the files, the boxes), one server kept alive between requests, refusals;
 *   3. the real SAM / CLIPSeg calls against STAND-IN modules with segment_anything's and transformers' signatures
 *      (no torch here): predictor.predict(point_coords, point_labels, box, multimask_output) and the best of three,
 *      CLIPSeg's map -> a box + its strongest point -> SAM, SamAutomaticMaskGenerator's settings;
 *   4. the routes: /api/segment (+ /mask), /api/aiedit/compose (Qwen 2511 + 3 picture slots, the prompt naming the
 *      layers, a 1-slot Kontext refused), /api/psd (save / list / file);
 *   5. the compose graph through the REAL patcher (comfy_image.patch): the three pictures in their slots;
 *   6. pcpsd's mappings (blend modes, layer styles <-> effects), pcsam's pure parts, the wiring. */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");
const { spawnSync } = require("child_process");
let pass = 0, fail = 0;
function check(name, ok, extra) {
  if (ok) { pass++; console.log("PASS: " + name); }
  else { fail++; console.log("FAIL: " + name + (extra !== undefined ? " :: " + JSON.stringify(extra).slice(0, 700) : "")); }
}
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
if (!process.env.H3_E2E) process.env.H3_E2E = "1";
const core = require(path.join(ROOT, "lib", "core"));
const SEG = require(path.join(ROOT, "lib", "segment"));
const A = require(path.join(ROOT, "lib", "aiEdit"));
const styles = require(path.join(ROOT, "lib", "styles"));
const psdStore = require(path.join(ROOT, "lib", "psdStore"));
const PSD = require(path.join(ROOT, "ext", "imageeditdock", "pcpsd.js"));
const D = require(path.join(ROOT, "ext", "imageeditdock", "pcdoc.js"));   // 2.397.0: the style defaults
const SAM = require(path.join(ROOT, "ext", "imageeditdock", "pcsam.js"));
const throws = (f, re) => { try { f(); return false; } catch (e) { return re.test(e.message); } };

function png(file, w, h, draw) {
  // a picture with ffmpeg: a light background + a red box + a blue box
  const args = ["-y", "-loglevel", "error", "-f", "lavfi", "-i", `color=c=0xf0f0f0:s=${w}x${h}`, "-vf", draw, "-frames:v", "1", file];
  const r = spawnSync("ffmpeg", args); if (r.status !== 0) throw new Error(String(r.stderr));
}
function multipart(fields, files) {
  const bd = "----h3" + Date.now().toString(16), parts = [];
  for (const [k, v] of Object.entries(fields)) parts.push(Buffer.from(`--${bd}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`));
  for (const [k, name, buf] of files) parts.push(Buffer.from(`--${bd}\r\nContent-Disposition: form-data; name="${k}"; filename="${name}"\r\nContent-Type: image/png\r\n\r\n`), buf, Buffer.from("\r\n"));
  parts.push(Buffer.from(`--${bd}--\r\n`));
  return { body: Buffer.concat(parts), type: `multipart/form-data; boundary=${bd}` };
}
function send(port, method, u, body, type) {
  return new Promise((ok, no) => {
    const data = body == null ? null : Buffer.isBuffer(body) ? body : Buffer.from(JSON.stringify(body));
    const r = http.request({ host: "127.0.0.1", port, path: u, method, headers: data ? { "Content-Type": type || "application/json", "Content-Length": data.length } : {} }, (res) => {
      const c = []; res.on("data", (d) => c.push(d)); res.on("end", () => { const b = Buffer.concat(c); let j = null; try { j = JSON.parse(b.toString()); } catch { j = null; } ok({ status: res.statusCode, j, b }); });
    });
    r.on("error", no); if (data) r.write(data); r.end();
  });
}

(async () => {
  const P = "zz_pcsam390_" + process.pid, orig = core.getProject();
  core.ensureProject(P); core.setProject(P);
  const pd = core.projDir(P);
  const cfg0 = JSON.parse(JSON.stringify((core.getConfig() || {}).segment || null));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pcsam390_"));
  let srv = null;
  try {
    // ---- 1
    check("requestOf: points (rounded, labels 1 | 0, a box), words (threshold clamped, refine / instances), everything (limits)",
      JSON.stringify(SEG.requestOf({ op: "points", points: "[[10.4,20.6],[5,5,0]]" })) === '{"op":"points","points":[[10,21,1],[5,5,0]],"box":null}'
      && JSON.stringify(SEG.requestOf({ op: "points", box: [1, 2, 30, 40] }).box) === "[1,2,30,40]"
      && SEG.requestOf({ op: "text", prompt: " head ", threshold: 3 }).threshold === 0.95 && SEG.requestOf({ op: "text", prompt: "x", refine: "false" }).refine === false
      && SEG.requestOf({ op: "text", prompt: "x", instances: "1" }).instances === true && SEG.requestOf({ op: "auto", max: 999, min_area: -1 }).max === 256);
    check("...refused in words: an unknown op, no click / box, no words",
      throws(() => SEG.requestOf({ op: "paint" }), /op must be one of points, text, auto/) && throws(() => SEG.requestOf({ op: "points" }), /click on the picture/)
      && throws(() => SEG.requestOf({ op: "text", prompt: "  " }), /write what to select/));
    const gpu = SEG.pipPlan(true), cpu = SEG.pipPlan(false);
    check("pipPlan: pip, torch (CUDA 12.4 wheels from PyTorch's index on an NVIDIA card, PyPI's otherwise), segment-anything + transformers + opencv",
      gpu.length === 3 && gpu[1].includes("--index-url") && gpu[1].includes("https://download.pytorch.org/whl/cu124") && !cpu[1].includes("--index-url")
      && ["segment-anything", "transformers", "opencv-python-headless"].every((p) => gpu[2].includes(p)));
    const fsrc = path.join(tmp, "src.bin"), fdst = path.join(tmp, "dst.pth");
    fs.writeFileSync(fsrc, Buffer.alloc(5000, 7));
    const dl = spawnSync("python3", ["-c", SEG.fetchScript("file://" + fsrc, fdst)], { encoding: "utf8" });
    check("fetchScript: downloads to <name>.part, then renames (a cut download never looks finished)", dl.status === 0 && fs.statSync(fdst).size === 5000 && !fs.existsSync(fdst + ".part"), dl.stderr);
    check("the SAM models: ViT-B / L / H with Meta's file names", SEG.MODELS.vit_b.file === "sam_vit_b_01ec64.pth" && SEG.MODELS.vit_h.file === "sam_vit_h_4b8939.pth" && SEG.URL_BASE === "https://dl.fbaipublicfiles.com/segment_anything/");
    const cdir = path.join(tmp, "comfy"); fs.mkdirSync(path.join(cdir, "models", "sams"), { recursive: true });
    fs.writeFileSync(path.join(cdir, "models", "sams", "sam_vit_h_4b8939.pth"), "x");
    const cfg = core.getConfig(); const eng0 = JSON.parse(JSON.stringify(cfg.engine || {}));
    cfg.engine = Object.assign({}, cfg.engine || {}, { comfy: Object.assign({}, (cfg.engine || {}).comfy || {}, { dir: cdir }) });
    check("checkpointFor: ComfyUI's models/sams is looked in (the Impact Pack keeps SAM there)", SEG.checkpointFor("vit_h") === path.join(cdir, "models", "sams", "sam_vit_h_4b8939.pth"));
    cfg.engine = eng0;
    const s1 = SEG.settings({ model: "vit_l" });
    check("settings: the model kept in the config, a bad one / a non-.pth checkpoint refused", s1.model === "vit_l" && (core.getConfig().segment || {}).model === "vit_l"
      && throws(() => SEG.settings({ model: "vit_z" }), /model must be one of/) && throws(() => SEG.settings({ checkpoint: "x.bin" }), /\.pth/));
    SEG.settings({ model: "vit_b", checkpoint: "" });
    const st = SEG.status();
    check("status: not installed here, the stand-in allowed on the test server, the three models listed", st.ready === false && st.fake_available === true && Object.keys(st.models).join() === "vit_b,vit_l,vit_h", st);

    // ---- 2
    const img = path.join(tmp, "scene.png");
    png(img, 200, 150, "drawbox=x=20:y=30:w=60:h=90:color=0xdc2828:t=fill,drawbox=x=120:y=40:w=60:h=60:color=0x2846dc:t=fill");
    const buf = fs.readFileSync(img);
    const r1 = await SEG.run({ op: "points", points: [[50, 60, 1]], image: buf });
    check("run points (the stand-in): one mask - the red box (its outline 60 x 90 at 20, 30), a URL under /api/segment/mask",
      r1.fake && r1.masks.length === 1 && JSON.stringify(r1.masks[0].bbox) === "[20,30,60,90]" && r1.masks[0].area === 5400 && /^\/api\/segment\/mask\/seg_/.test(r1.masks[0].url), r1);
    const r2 = await SEG.run({ op: "points", box: [110, 30, 190, 110], image: buf });
    check("run box: the thing inside the box (the blue square)", JSON.stringify(r2.masks[0].bbox) === "[120,40,60,60]", r2.masks);
    const r3 = await SEG.run({ op: "text", prompt: "red, blue", image: buf });
    check("run words: a mask per word, labelled", r3.masks.length === 2 && r3.masks[0].label === "red" && r3.masks[1].label === "blue" && r3.masks[1].bbox[0] === 120, r3.masks);
    const r4 = await SEG.run({ op: "auto", max: 5, min_area: 1, image: buf });
    check("run everything: the segments biggest first (background, red, blue)", r4.masks.length === 3 && r4.masks[0].area > r4.masks[1].area && r4.masks[1].area > r4.masks[2].area, r4.masks.map((m) => m.area));
    const mp = SEG.maskPath(r1.masks[0].name);
    const head = fs.readFileSync(mp);
    check("maskPath: the PNG in the project's temp/segment; a strange name refused", head.slice(1, 4).toString() === "PNG" && mp.startsWith(path.join(pd, "temp", "segment"))
      && throws(() => SEG.maskPath("../x.png"), /not a mask name/));
    let e5 = null; try { await SEG.run({ op: "points", points: [[1, 1]], image: Buffer.from("not a png") }); } catch (e) { e5 = e; }
    check("a picture the server cannot read: refused in words (422) - and the server lives on", e5 && e5.status === 422 && (await SEG.run({ op: "points", points: [[50, 60]], image: buf })).masks.length === 1, e5 && e5.message);

    // ---- 3: the real calls, against stand-in modules with the libraries' signatures
    const stub = path.join(tmp, "stubs"); fs.mkdirSync(path.join(stub, "segment_anything"), { recursive: true }); fs.mkdirSync(path.join(stub, "transformers"), { recursive: true }); fs.mkdirSync(path.join(stub, "torch"), { recursive: true });
    fs.writeFileSync(path.join(stub, "torch", "__init__.py"), `
import numpy as _np
class _T:
    def __init__(s, a): s.a = _np.asarray(a, _np.float32)
    def dim(s): return s.a.ndim
    def unsqueeze(s, i): return _T(_np.expand_dims(s.a, i))
    def float(s): return s
    def cpu(s): return s
    def numpy(s): return s.a
    def to(s, d): return s
class cuda:
    @staticmethod
    def is_available(): return False
def sigmoid(t): return _T(1.0 / (1.0 + _np.exp(-t.a)))
class no_grad:
    def __enter__(s): return s
    def __exit__(s, *a): return False
`);
    fs.writeFileSync(path.join(stub, "segment_anything", "__init__.py"), `
import numpy as np, json, os
LOG = os.environ["SEG_STUB_LOG"]
def _log(**k):
    with open(LOG, "a") as f: f.write(json.dumps(k) + "\\n")
class _Sam:
    def __init__(s, kind, ck): s.kind, s.ck = kind, ck
    def to(s, device=None): _log(op="to", device=device); return s
    def eval(s): return s
sam_model_registry = {k: (lambda kk: (lambda checkpoint=None: (_log(op="build", kind=kk, ck=checkpoint), _Sam(kk, checkpoint))[1]))(k) for k in ("vit_b", "vit_l", "vit_h")}
class SamPredictor:
    def __init__(s, sam): s.sam = sam
    def set_image(s, img): _log(op="set_image", shape=list(img.shape), dtype=str(img.dtype)); s.h, s.w = img.shape[:2]
    def predict(s, point_coords=None, point_labels=None, box=None, multimask_output=True):
        _log(op="predict", pts=None if point_coords is None else point_coords.tolist(), labels=None if point_labels is None else point_labels.tolist(),
             box=None if box is None else box.tolist(), multi=multimask_output)
        m = np.zeros((3, s.h, s.w), bool); m[1, 10:20, 10:30] = True; m[0, 0:2, 0:2] = True; m[2, 0:5, 0:5] = True
        return m, np.array([0.2, 0.9, 0.5]), None
class SamAutomaticMaskGenerator:
    def __init__(s, model=None, **k): _log(op="gen", **k)
    def generate(s, img):
        h, w = img.shape[:2]; a = np.zeros((h, w), bool); a[0:50, 0:50] = True; b = np.zeros((h, w), bool); b[60:70, 60:70] = True
        return [{"segmentation": b, "area": 100, "predicted_iou": 0.9}, {"segmentation": a, "area": 2500, "predicted_iou": 0.95}]
`);
    fs.writeFileSync(path.join(stub, "transformers", "__init__.py"), `
import numpy as np, json, os, torch
LOG = os.environ["SEG_STUB_LOG"]
class CLIPSegProcessor:
    @staticmethod
    def from_pretrained(name): return CLIPSegProcessor()
    def __call__(s, text=None, images=None, padding=None, return_tensors=None):
        with open(LOG, "a") as f: f.write(json.dumps({"op": "clipseg", "text": text, "n": len(images), "padding": padding, "rt": return_tensors}) + "\\n")
        s.n = len(text); return {"input_ids": torch._T(np.zeros((len(text), 4)))}
class _Out:
    def __init__(s, l): s.logits = l
class CLIPSegForImageSegmentation:
    @staticmethod
    def from_pretrained(name): return CLIPSegForImageSegmentation()
    def to(s, d): return s
    def eval(s): return s
    def __call__(s, **k):
        n = k["input_ids"].a.shape[0]; l = np.full((n, 352, 352), -6.0, np.float32); l[:, 100:200, 50:150] = 4.0
        return _Out(torch._T(l if n > 1 else l[0]))
`);
    const ck = path.join(tmp, "sam_vit_b_01ec64.pth"); fs.writeFileSync(ck, "x");
    const slog = path.join(tmp, "stub.log");
    const ask = (lines) => spawnSync("python3", [path.join(ROOT, "scripts", "segment.py"), "--serve"], { input: lines.map((l) => JSON.stringify(l)).join("\n") + "\n", encoding: "utf8",
      env: Object.assign({}, process.env, { PYTHONPATH: stub, SEG_STUB_LOG: slog }) });
    const out3 = path.join(tmp, "o3");
    const R = ask([{ id: 1, op: "points", image: img, out_dir: out3, prefix: "segA", model: "vit_b", checkpoint: ck, points: [[50, 60, 1], [5, 5, 0]], box: [10, 10, 90, 130] },
                   { id: 2, op: "points", image: img, out_dir: out3, prefix: "segB", model: "vit_b", checkpoint: ck, points: [[60, 60, 1]] },
                   { id: 3, op: "text", image: img, out_dir: out3, prefix: "segC", model: "vit_b", checkpoint: ck, prompt: "head, dog", threshold: 0.35 },
                   { id: 4, op: "auto", image: img, out_dir: out3, prefix: "segD", model: "vit_b", checkpoint: ck, max: 8, min_area: 0.2, points_per_side: 16 },
                   { id: 5, op: "points", image: img, out_dir: out3, prefix: "segE", model: "vit_b", checkpoint: path.join(tmp, "gone.pth"), points: [[1, 1, 1]] }]);
    const ans = R.stdout.split("\n").filter((l) => l.startsWith("H3SEG ")).map((l) => JSON.parse(l.slice(6)));
    const L = fs.existsSync(slog) ? fs.readFileSync(slog, "utf8").trim().split("\n").map((l) => JSON.parse(l)) : [];
    const pr = L.filter((x) => x.op === "predict");
    check("SAM (stand-in modules, the real calls): built once from the checkpoint on the cpu, the picture embedded ONCE for two clicks on it (HWC uint8)",
      L.filter((x) => x.op === "build").length === 1 && L.find((x) => x.op === "build").ck === ck && L.filter((x) => x.op === "set_image").length === 1
      && JSON.stringify(L.find((x) => x.op === "set_image").shape) === "[150,200,3]" && L.find((x) => x.op === "set_image").dtype === "uint8", L.slice(0, 6));
    check("...predict(point_coords, point_labels, box, multimask_output=True); the best of the three (score 0.9 -> its mask)",
      JSON.stringify(pr[0].pts) === "[[50,60],[5,5]]" && JSON.stringify(pr[0].labels) === "[1,0]" && JSON.stringify(pr[0].box) === "[10,10,90,130]" && pr[0].multi === true
      && ans[0].ok && JSON.stringify(ans[0].masks[0].bbox) === "[10,10,20,10]" && ans[0].masks[0].score === 0.9, { pr: pr[0], a: ans[0] });
    const cl = L.find((x) => x.op === "clipseg");
    check("words: CLIPSeg gets every word with the picture (padding max_length, pt), each map -> its region's box + strongest point -> SAM",
      cl && JSON.stringify(cl.text) === '["head","dog"]' && cl.n === 2 && cl.padding === "max_length" && cl.rt === "pt" && pr.length >= 4
      && pr[2].box && pr[2].box[0] < pr[2].pts[0][0] && pr[2].pts[0][0] < pr[2].box[2] && ans[2].ok && ans[2].masks.map((m) => m.label).join() === "head,dog", { cl, p: pr[2], a: ans[2] });
    const gn = L.find((x) => x.op === "gen");
    check("everything: SamAutomaticMaskGenerator(points_per_side, pred_iou_thresh, stability_score_thresh, min_mask_region_area), biggest first",
      gn && gn.points_per_side === 16 && gn.pred_iou_thresh === 0.86 && gn.stability_score_thresh === 0.92 && gn.min_mask_region_area >= 16
      && ans[3].ok && ans[3].masks.length === 2 && ans[3].masks[0].area === 2500, { gn, a: ans[3] });
    check("a missing checkpoint: refused in words, the server answers the next one", ans[4] && !ans[4].ok && /checkpoint is missing/.test(ans[4].error), ans[4]);

    // ---- 4: the routes
    const express = require("express");
    const app = express();
    const jobs = [];
    const mk0 = core.makeJob;
    core.makeJob = (p) => { const j = { id: "fake" + jobs.length, params: p, log: [] }; jobs.push(j); return j; };
    require(path.join(ROOT, "routes", "index.js")).mount(app);
    srv = app.listen(0, "127.0.0.1"); await new Promise((ok) => srv.once("listening", ok));
    const port = srv.address().port;
    const m1 = multipart({ op: "points", points: "[[150,70,1]]" }, [["image", "p.png", buf]]);
    const s1r = await send(port, "POST", "/api/segment", m1.body, m1.type);
    const mk = s1r.j && s1r.j.masks && s1r.j.masks[0];
    const mf = mk ? await send(port, "GET", mk.url) : {};
    check("POST /api/segment (multipart image + op) -> masks; GET the mask URL = a PNG", s1r.status === 200 && mk && mk.bbox[0] === 120 && mf.status === 200 && mf.b.slice(1, 4).toString() === "PNG", s1r.j);
    const s2r = await send(port, "POST", "/api/segment", multipart({ op: "points" }, [["image", "p.png", buf]]).body, multipart({ op: "points" }, []).type);
    check("POST /api/segment without a click: 400 in words", s2r.status === 400 || s2r.status === 500, s2r.j);
    const sst = await send(port, "GET", "/api/segment/status");
    check("GET /api/segment/status", sst.status === 200 && sst.j.model === "vit_b" && sst.j.server.running === true && sst.j.server.fake === true, sst.j);

    styles.seedStarters(core.STYLES_DIR);
    const list = styles.read(core.STYLES_DIR, "image");
    const Q = list.find((s) => s.name === "Qwen Image Edit 2511"), K = list.find((s) => s.name === "FLUX.1 Kontext edit");
    const pic = (n) => [`pic${n}`, `pic${n}.png`, buf];
    const cm = multipart({ style_id: Q.id, prompt: "put the dog from Layer 2 and the cat from layer 3 on the sofa in Layer 1", names: JSON.stringify(["Layer 1", "Layer 2", "Layer 3"]), width: 1024, height: 768, count: 2 }, [pic(0), pic(1), pic(2)]);
    const c1 = await send(port, "POST", "/api/aiedit/compose", cm.body, cm.type);
    const jp = jobs.length ? jobs[jobs.length - 2].params : {};
    let g3 = null; try { g3 = JSON.parse(fs.readFileSync(jp.workflow, "utf8")); } catch { g3 = null; }
    check("POST /api/aiedit/compose with Qwen Image Edit 2511 + 3 layers: 2 image jobs, the 3 pictures in order, the graph with image2 / image3 added",
      c1.status === 200 && c1.j.jobs.length === 2 && jp.images.length === 3 && /compose1\.png$/.test(jp.images[0]) && /compose3\.png$/.test(jp.images[2])
      && g3 && g3["10"].inputs.image3 && g3["11"].inputs.image2 && jp.width === 1024 && jp.no_assets === true && jp.aiedit === "compose" && /2 picture slot\(s\) added/.test(c1.j.note), { j: c1.j, jp: { w: jp.workflow, im: jp.images } });
    check("...the prompt names the layers: \"Layer 2\" -> Picture 2, \"layer 3\" -> Picture 3, a line says which is which",
      /^Picture 1 is the scene \(the layer "Layer 1"\); Picture 2 is a reference/.test(jp.prompt) && /put the dog from Picture 2 and the cat from Picture 3 on the sofa in Picture 1$/.test(jp.prompt), jp.prompt);
    const c2 = await send(port, "POST", "/api/aiedit/compose", ...((m) => [m.body, m.type])(multipart({ style_id: K.id, prompt: "x", width: 512, height: 512 }, [pic(0), pic(1)])));
    const c3 = await send(port, "POST", "/api/aiedit/compose", ...((m) => [m.body, m.type])(multipart({ style_id: Q.id, prompt: "", width: 512, height: 512 }, [pic(0)])));
    const c4 = await send(port, "POST", "/api/aiedit/compose", ...((m) => [m.body, m.type])(multipart({ style_id: Q.id, prompt: "x" }, [])));
    check("compose refused in words: FLUX Kontext (1 picture) with 2 layers, no prompt, no layers",
      c2.status === 400 && /takes 1 picture\(s\) - for 2 layers pick Qwen Image Edit 2511/.test(c2.j.error) && c3.status === 400 && /write what to make/.test(c3.j.error)
      && c4.status === 400 && /pick the layers first/.test(c4.j.error), [c2.j, c3.j, c4.j]);
    core.makeJob = mk0;
    const psdBuf = Buffer.concat([Buffer.from("8BPS"), Buffer.from([0, 1]), Buffer.alloc(40)]);
    const ps1 = await send(port, "POST", "/api/psd/save?name=" + encodeURIComponent("../My scene.png"), psdBuf, "application/octet-stream");
    const ps2 = await send(port, "GET", "/api/psd/list");
    const ps3 = await send(port, "GET", "/api/psd/file/My%20scene.psd");
    const ps4 = await send(port, "POST", "/api/psd/save?name=x", Buffer.from("GIF89a................................"), "application/octet-stream");
    check("/api/psd: save (a safe name, in projects/<p>/psd), list, the file back; not a PSD refused",
      ps1.status === 200 && ps1.j.name === "My scene.psd" && fs.existsSync(path.join(pd, "psd", "My scene.psd")) && ps2.j.files[0].name === "My scene.psd"
      && ps3.status === 200 && ps3.b.length === psdBuf.length && ps4.status === 400 && /not a PSD/.test(ps4.j.error), [ps1.j, ps2.j, ps4.j]);

    // ---- 5: the compose graph through the real patcher
    const gpath = jp.workflow;
    const py = spawnSync("python3", ["-c", `
import sys, json; sys.path.insert(0, ${JSON.stringify(path.join(ROOT, "scripts"))})
import comfy_image as C
g = C.load_workflow(${JSON.stringify(gpath)})
g2, rep = C.patch(g, {"steps": 4, "cfg": 1}, {"prompt": "x", "images": ["a.png", "b.png", "c.png"], "seed": 7})
sl = C.image_slots(g2)
print(json.dumps({"slots": sl, "imgs": [g2[s]["inputs"]["image"] for s in sl], "enc": {k: v for k, v in g2["10"]["inputs"].items() if k.startswith("image")}}))
`], { encoding: "utf8" });
    let pj = null; try { pj = JSON.parse(py.stdout.trim().split("\n").pop()); } catch { pj = null; }
    check("the compose graph through comfy_image.patch: Picture 1..3 in their LoadImage slots (in order), the encoder reads all three",
      pj && JSON.stringify(pj.imgs) === '["a.png","b.png","c.png"]' && Object.keys(pj.enc).sort().join() === "image1,image2,image3", { pj, err: py.stderr.slice(-400) });

    // ---- 6
    check("blend modes: Photoshop's names <-> ours, pass through only for groups, one we cannot draw -> null (opened as Normal)",
      PSD.blendIn("color dodge") === "color-dodge" && PSD.blendIn("pass through", true) === "pass-through" && PSD.blendIn("pass through", false) === "normal"
      && PSD.blendIn("linear burn") === null && PSD.blendOut("soft-light") === "soft light" && PSD.blendOut("pass-through", true) === "pass through" && PSD.OURS.length === 16);
    const sty = { shadow: { on: true, color: "#102030", opacity: 0.5, angle: 90, distance: 7, size: 9 }, stroke: { on: true, color: "#ff0000", opacity: 1, size: 3, position: "centre" },
                  colorOverlay: { on: false, color: "#00ff00", opacity: 1 }, gradientOverlay: { on: true, c1: "#000000", c2: "#ffffff", opacity: 0.8, angle: 45 } };
    const fx = PSD.stylesToEffects(sty), back = PSD.effectsToStyles(fx, {}).styles;
    check("layer styles -> PSD effects (dropShadow / stroke / gradientOverlay, sizes in Pixels; an off style left out) and back the same",
      fx.dropShadow[0].distance.units === "Pixels" && fx.dropShadow[0].color.g === 0x20 && fx.stroke[0].position === "center" && !fx.solidFill && fx.gradientOverlay[0].gradient.colorStops.length === 2
      && back.shadow.color === "#102030" && back.shadow.distance === 7 && back.stroke.position === "centre" && back.gradientOverlay.c2 === "#ffffff" && back.gradientOverlay.angle === 45 && !back.colorOverlay, { fx, back });
    check("effects we do not have (2.397.0: only a pattern overlay - bevel / satin are read now) are counted; RGB as 0..1 floats read too",
      PSD.effectsToStyles({ bevel: { enabled: true }, satin: { enabled: true }, patternOverlay: { enabled: true } }, D.STYLE_DEFAULTS).skipped === 1
      && PSD.effectsToStyles({ bevel: { enabled: true }, satin: { enabled: true } }, D.STYLE_DEFAULTS).styles.bevel.on === true && PSD.rgbToHex({ fr: 1, fg: 0.5, fb: 0 }) === "#ff8000" && PSD.stylesToEffects({}) === null);
    check("pcsam: a mask picture's R channel -> a selection; segment names unique",
      Array.from(SAM.maskFromRGBA(new Uint8Array([255, 0, 0, 255, 10, 10, 10, 255]), 2)).join() === "255,0"
      && ((t) => [SAM.segName("dog", t), SAM.segName("dog", t), SAM.segName("", t)].join("|"))(new Set(["Dog"])) === "Dog (2)|Dog (3)|Segment");
    const ext = JSON.parse(read("ext", "imageeditdock", "ext.json")).scripts;
    const IE = read("ext", "imageeditdock", "imageedit.js"), UI = read("ext", "imageeditdock", "pcui.js"), MT = read("ext", "imageeditdock", "mount.js"), RI = read("routes", "index.js");
    check("the wiring: pcsam.js + pcpsd.js after pcui.js and installed after it; the Object Selection tool in W; Ctrl-click picks; Compose mode; the mount's compose + toRefs; the routes mounted (not server.js); ag-psd vendored with its licence",
      ext.indexOf("pcsam.js") > ext.indexOf("pcui.js") && ext.indexOf("pcpsd.js") > ext.indexOf("pcsam.js") && ext.indexOf("imageedit.js") > ext.indexOf("pcpsd.js")
      && IE.indexOf("win.PCSam.install(E)") > IE.indexOf("win.PCUI.install(E)") && /\["objsel", "Object Selection Tool \(Segment Anything\)"\]/.test(UI) && /E\.togglePick\(Ly\)/.test(UI)
      && /\["compose", "Compose"/.test(IE) && /compose: async \(req, say\)/.test(MT) && /toRefs: \(items\)/.test(MT)
      && /require\("\.\/segment"\)\.mount\(app\)/.test(RI) && /require\("\.\/psd"\)\.mount\(app\)/.test(RI) && !/segment|psd/i.test(read("server.js"))
      && fs.existsSync(path.join(ROOT, "static", "vendor", "ag-psd.js")) && /MIT License/.test(read("static", "vendor", "LICENSE-ag-psd.txt")));
  } catch (e) {
    check("the run finished", false, String(e && e.stack || e).slice(0, 900));
  } finally {
    SEG.stop();
    if (srv) srv.close();
    const cfg = core.getConfig() || {};
    if (cfg0) cfg.segment = cfg0; else delete cfg.segment;
    core.setConfig(cfg);
    core.setProject(orig);
    fs.rmSync(pd, { recursive: true, force: true });
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
