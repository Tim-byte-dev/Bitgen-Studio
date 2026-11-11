#!/usr/bin/env node
/* bitGen Studio — 2.763.0 units + LIVE: YOUR STYLES ON YOUR PODS (lib/stylePods.js, lib/podPrep.js, lib/podSetup.js, the page's
 * static/podsetup.js + static/stylepodask.js). Stand-ins: RunPod's REST API (pods, GPUs, templates incl. "ComfyUI CUDA 13"),
 * a pod's ComfyUI (/object_info, model lists, ComfyUI-Manager's reboot), its Jupyter (a kernel that runs bitGen's Python HERE)
 * and Hugging Face (the downloads).
 * Tim (verbatim): "can we use a dropdown of our styles for the mode selected, image selected show image styles, add an all
 * button so that it shows all styles. then we send our styles workflow to the pod with our styles stand models, text
 * encoders and vaes, we reuse the same styles, no p_ but when in pod mode we use the pod that uses that style" + "if we are
 * in pod mode and a style is selected, check if that style has a pod assigned to it and create the pod with the comfy cuda
 * 13 template" + "allow the user to have a separate pod for each type of style, llm, vllm,image,video if they want to and can
 * afford too otherwise we use the one pod" */
"use strict";
const http = require("http"), fs = require("fs"), os = require("os"), path = require("path"), crypto = require("crypto"), Module = require("module");
const { spawn, spawnSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const rd = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------------- pure */
const SP = require("../lib/stylePods"), PP = require("../lib/podPrep"), SU = require("../lib/podSetup"), H = require("../static/podsetup.js"), A = require("../static/stylepodask.js");
check("kindOfStyle: video + music styles -> video (songs go with video), an edit graph -> image_edit, else image",
  SP.kindOfStyle({ kind: "video" }) === "video" && SP.kindOfStyle({ kind: "music" }) === "video" && SP.kindOfStyle({ kind: "image" }, () => true) === "image_edit" && SP.kindOfStyle({}, () => false) === "image");
const R0 = { style_pods: { s1: "podA", "s2!": "pod-B" }, pod_cfg: { podK: { kinds: ["image", "video"] }, podE: { kinds: ["image_edit"] } }, runpod: { pod_id: "podU", port: 3000 } };
check("cleanLinks: style ids and pod ids tidied (no stray characters)", JSON.stringify(SP.cleanLinks(R0.style_pods)) === JSON.stringify({ s1: "podA", s2: "podB" }));
check("podFor: 1. the style's own pod, 2. the pod ticked for its kind (Image edit -> the edit pod, else the Image pod), 3. the pod in use, else none",
  SP.podFor(R0, { id: "s1" }, "image").pod_id === "podA" && SP.podFor(R0, { id: "s1" }, "image").how === "style"
  && SP.podFor(R0, { id: "x" }, "video").pod_id === "podK" && SP.podFor(R0, { id: "x" }, "video").how === "kind"
  && SP.podFor(R0, { id: "x" }, "image_edit").pod_id === "podE" && SP.podFor({ pod_cfg: R0.pod_cfg }, { id: "x" }, "image_edit").pod_id === "podE"
  && SP.podFor({ pod_cfg: { podK: { kinds: ["image"] } } }, { id: "x" }, "image_edit").pod_id === "podK"
  && SP.podFor({ runpod: { pod_id: "podU" } }, { id: "x" }, "image").how === "shared" && SP.podFor({}, { id: "x" }, "image") === null);
const pods = { pods: true };
check("podJob: Remote = every render, Both = the Image / Video box ticked or the style has its own pod, Local / not Pods / off = never",
  SP.podJob(true, pods, { where: "remote" }, "image") && SP.podJob(true, pods, { where: "both", video: true }, "video") && !SP.podJob(true, pods, { where: "both", video: true }, "image")
  && SP.podJob(true, pods, { where: "both" }, "image", true) && !SP.podJob(true, pods, { where: "local" }, "image", true) && !SP.podJob(true, { pods: false }, { where: "remote" }, "image") && !SP.podJob(false, pods, { where: "remote" }, "image"));
const GPUS = [{ id: "A", memory: 16, price: 0.2, offered: true }, { id: "B", memory: 24, price: 0.44, offered: true }, { id: "C", memory: 24, price: 0.34, offered: false }, { id: "D", memory: 48, price: 0.69, offered: true }, { id: "E", memory: 80, price: 1.99, offered: true }];
check("pickGpu: the cheapest GPU offered with enough memory (one not free now is skipped); none big enough = the biggest offered",
  SP.pickGpu(GPUS, 24).id === "B" && SP.pickGpu(GPUS, 32).id === "D" && SP.pickGpu(GPUS, 141).id === "E" && SP.pickGpu([], 24) === null);
check("vramFor / volumeFor: a 22.5 GB model wants 48 GB, a 6 GB one 24 GB; the disk = the files + room (50 GB at least, 2000 at most)",
  SP.vramFor(22.5e9) === 48 && SP.vramFor(6e9) === 24 && SP.vramFor(0) === 24 && SP.volumeFor(0) === 50 && SP.volumeFor(40e9) === 80 && SP.volumeFor(5e12) === 2000);
const TPL = [{ id: "t1", name: "ComfyUI", source: "official" }, { id: "t2", name: "comfyui-cuda13 (community)", source: "community" }, { id: "t3", name: "ComfyUI CUDA 13", source: "official", image: "runpod/comfyui:cuda13" }, { id: "t4", name: "Stable Diffusion CUDA 13", source: "official" }];
check("cuda13Template: RunPod's \"ComfyUI CUDA 13\" by its name (Official first); none = null", SP.cuda13Template(TPL).id === "t3" && SP.cuda13Template(TPL.slice(0, 2)).id === "t2" && SP.cuda13Template([TPL[0], TPL[3]]) === null);
check("portOf: how bitGen made the pod, else the pod in use's port, else 8188", SP.portOf({ pod_made: { p1: { port: 3000 } } }, "p1") === 3000 && SP.portOf(R0, "podU") === 3000 && SP.portOf(R0, "zz") === 8188);
check("workflowsOf: an image style's own; a video style's own, else its modes' (own, the Settings template, comfy_workflows/<mode>.json)",
  PP.workflowsOf({ kind: "image", workflow: "w.json" }).join() === "w.json" && PP.workflowsOf({ kind: "image" }).length === 0
  && PP.workflowsOf({ kind: "video", workflows: { t2va: "a.json", ref2va: "" } }).join() === "a.json"
  && PP.workflowsOf({ kind: "video" }, { engine: { comfy: { workflows: { t2va: "T.json" } } } }).join() === "T.json,comfy_workflows/ref2va.json,comfy_workflows/fl2va.json");
const CAT = { models: [{ id: "m", repo: "o/r", file: "split/vae/v.safetensors", dest: "comfy/vae", size: 10 }, { id: "x", repo: "o/r", file: "x.bin", dest: "llm" }] };
const pl = PP.plan([{ name: "sub/v.safetensors", cat: "vae" }, { name: "here.safetensors", cat: "checkpoints" }, { name: "mine.safetensors", cat: "loras" }, { name: "lost.safetensors", cat: "diffusion_models" }, { name: "V.safetensors", cat: "vae" }],
  { checkpoints: ["a/here.safetensors"] }, CAT, (cats, n) => (n === "mine.safetensors" && cats.join() === "loras" ? { path: "/x" } : null));
check("plan: on the pod already = nothing; in bitGen's download list = downloaded ON the pod (its folder, Hugging Face address); on this computer = sent from here; else missing (each file once)",
  pl.there.join() === "here.safetensors" && pl.download.length === 1 && pl.download[0].folder === "vae" && /\/o\/r\/resolve\/main\/split\/vae\/v\.safetensors$/.test(pl.download[0].url)
  && pl.send.length === 1 && pl.send[0].cats.join() === "loras" && pl.missing.join() === "lost.safetensors", pl);
check("missingClasses / packsFor: the node classes the pod lacks -> the packs that add them; a class no pack adds is named",
  PP.missingClasses(["A", "B", "B", "C"], new Set(["A"])).join() === "B,C"
  && (() => { const r = PP.packsFor(["B", "C", "D"], [{ id: "p1", provides: ["B", "D"] }, { id: "p2", provides: ["Z"] }]); return r.packs.map((p) => p.id).join() === "p1" && r.unknown.join() === "C"; })());
{ const code = PP.nodeCode([{ id: "kj", folder: "ComfyUI-KJNodes", url: "https://github.com/kijai/ComfyUI-KJNodes.git" }, { id: "s", folder: "S", url: "u", subdir: "sub" }], "/workspace/ComfyUI");
  const f = path.join(os.tmpdir(), "nc763.py"); fs.writeFileSync(f, code);
  const r = spawnSync("python3", ["-c", "import ast,sys; ast.parse(open(sys.argv[1]).read()); print('ok')", f], { encoding: "utf8" });
  check("nodeCode: valid Python - git clone into custom_nodes (a sub-folder pack: the repo in .bitgen_src + a link), requirements with the Python running main.py, .bitgen_nodes.json",
    /ok/.test(r.stdout) && /git', 'clone', '--depth', '1'/.test(code) && /\.bitgen_src/.test(code) && /os\.symlink/.test(code) && /readlink\('\/proc\/' \+ p \+ '\/exe'\)/.test(code) && /\.bitgen_nodes\.json/.test(code), r.stderr); }
check("the page (pure): Save turns on for a tick or a style linked / taken off; the dropdown = the Generate mode's styles (🖼 image, 🎬 video, 🎶 music) or All, minus the linked ones and Serverless / API styles",
  H.isDirty({ saved: {}, cur: { styles: ["a"] } }) && !H.isDirty({ saved: { styles: ["a"] }, cur: { styles: ["a", "a"] } }) && H.isDirty({ saved: { kinds: ["image"] }, cur: {} })
  && H.kindOfMode("video") === "video" && H.kindOfMode("audio") === "music" && H.kindOfMode("image") === "image" && H.kindOfMode("chat") === "image"
  && H.listFor([{ id: "a", name: "B", kind: "image" }, { id: "b", name: "A", kind: "image" }, { id: "c", name: "C", kind: "video" }, { id: "d", name: "D", kind: "image", runs_on: "remote" }], "image", false, ["a"]).map((s) => s.id).join() === "b"
  && H.listFor([{ id: "a", name: "B", kind: "image" }, { id: "c", name: "C", kind: "video" }], "image", true, []).map((s) => s.id).join() === "a,c");
check("the ask box (pure): ⭐ on bitGen's pick, memory + $/h, 'none free now'; a question asked once per job list",
  A.gpuLabel({ id: "B", name: "RTX 4090", memory: 24, price: 0.44, offered: true }, "B") === "⭐ RTX 4090 · 24 GB · $0.44/h" && /none free now/.test(A.gpuLabel({ id: "C", name: "X", memory: 24, price: 0.3 }, "B"))
  && A.pending([{ pod_ask: "pa1", status: "queued" }, { pod_ask: "pa1", status: "queued" }, { pod_ask: "pa2", status: "running" }, { pod_ask: "pa3", status: "queued" }], { pa3: true }).join() === "pa1");
check("cleanSetup: the styles of a Save (ids, no repeats), no checkpoint / LoRA fields any more", JSON.stringify(SU.cleanSetup({ kinds: ["image", "nope"], styles: ["a", "a", "b!"], checkpoint: "x" }).styles) === '["a","b"]' && !("checkpoint" in SU.cleanSetup({})));
check("viewOf: a pod's styles from the links", SU.viewOf({ style_pods: { s1: "podA", s2: "podB", s3: "podA" } }, "podA").styles.join() === "s1,s3");

/* wiring */
const CORE = rd("lib", "core.js"), GS = rd("lib", "gpuSplit.js"), IDX = rd("routes", "index.js"), HTML = rd("static", "index.html"), RS = rd("lib", "rpslStyles.js"), PDS = rd("lib", "pods.js");
check("wiring: core.js asks stylePods.gate for a non-P_ / non-API style and puts params.pod_job on the job (+ job.pod_ask for the page); gpuSplit.forJob sends a pod_job to that pod's ComfyUI",
  /require\("\.\/stylePods"\)\.gate\(q0\.params\)/.test(CORE) && /q0\.params\.pod_job = \{ pod_id: g\.pod_id, port: g\.port \|\| 8188 \}/.test(CORE) && /pod_ask: job\.pod_ask \|\| null/.test(CORE)
  && /const pj = params && params\.pod_job;/.test(GS) && /require\("\.\/runpodApi"\)\.proxyUrl\(id, \+pj\.port \|\| 8188\)/.test(GS));
check("wiring: routes/stylePods.js mounted; index.html loads stylepodask.js and hands it the jobs; the style lists show your own styles on Pods (not only P_)",
  /require\("\.\/stylePods"\)\.mount\(app\)/.test(IDX) && /<script src="\/static\/stylepodask\.js"><\/script>/.test(HTML) && /H3StylePodAsk\.watchJobs\(list\)/.test(HTML)
  && !/only P_ pod styles show/.test(RS) && /a RunPod Serverless style - Basic Settings ▸ GPU is on RunPod Pods/.test(RS));
check("wiring: a pod made for a style asks RunPod for a CUDA 13 host (gpu.minCudaVersion) and keeps it in its recipe",
  /out\.gpu\.minCudaVersion = String\(o\.cuda\)/.test(PDS) && /cuda: body\.gpu\.minCudaVersion \|\| ""/.test(PDS) && require("../lib/pods").createBody({ templateId: "abcd1234", gpu: "G", cuda: "13.0" }).gpu.minCudaVersion === "13.0"
  && !("minCudaVersion" in require("../lib/pods").createBody({ templateId: "abcd1234", gpu: "G" }).gpu));
{ const RS2 = require("../lib/rpslStyles");
  check("hideWhy on Pods: your own styles + P_ show, a Serverless (R_) style hides; off Pods a P_ style still hides",
    RS2.hideWhy({ runs_on: "local" }, { ok: true }, { pods: true, where: "remote" }) === null && RS2.hideWhy({ runs_on: "pod" }, { ok: true }, { pods: true, where: "both" }) === null
    && /Serverless/.test(RS2.hideWhy({ runs_on: "remote" }, { ok: true }, { pods: true, where: "remote" }) || "") && /pod style/.test(RS2.hideWhy({ runs_on: "pod" }, { ok: true }, { pods: false, where: "local" }) || "")); }
{ const GSm = require("../lib/gpuSplit");
  const r = GSm.forJob({ engine: { comfy: { url: "http://127.0.0.1:8188" } }, rgpu: { runpod: { pod_id: "pX", cost_hr: 0.5 } } }, { mode: "image", style: { name: "Krea" }, pod_job: { pod_id: "pX", port: 3000 } });
  check("forJob with a pod_job: ComfyUI = that pod through RunPod's proxy, not started here; the note + the cost of the pod in use", /pX-3000/.test(r.config.engine.comfy.url) && r.config.engine.comfy.autostart === false && /Krea renders on RunPod pod pX/.test(r.note) && r.gpu.cost_hr === 0.5, r); }

/* ---------------- live: a studio of its own */
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "stylepods763-"));
for (const d of ["comfy_workflows", "lib", "styles"]) fs.mkdirSync(path.join(TMP, d), { recursive: true });
fs.symlinkSync(path.join(ROOT, "lib", "modelCatalog.json"), path.join(TMP, "lib", "modelCatalog.json"));
// a pack in a git repo of its own (git clone works on a folder)
const PACK = path.join(TMP, "packrepo");
fs.mkdirSync(PACK); fs.writeFileSync(path.join(PACK, "__init__.py"), "NODE_CLASS_MAPPINGS = {}\n");
spawnSync("git", ["init", "-q"], { cwd: PACK }); spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", "add", "-A"], { cwd: PACK }); spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", "x"], { cwd: PACK });
fs.writeFileSync(path.join(TMP, "lib", "nodePacks.json"), JSON.stringify({ packs: [{ id: "kjnodes", folder: "ComfyUI-KJNodes", url: PACK, provides: ["PathchSageAttentionKJ"] }] }));
// the style's workflow: catalogue files (a diffusion model, a text encoder, a VAE), a KJNodes node, and the style's LoRA
const DM = "minimax_h3_ref2va_pruned_int8_convrot.safetensors", TE = "gemma4_e2b_it_bf16.safetensors", VAE = "minimax_h3_audio_vae_fp32.safetensors";
fs.writeFileSync(path.join(TMP, "comfy_workflows", "img_t763.json"), JSON.stringify({
  1: { class_type: "UNETLoader", inputs: { unet_name: DM, weight_dtype: "default" } }, 2: { class_type: "CLIPLoader", inputs: { clip_name: TE, type: "qwen_image" } },
  3: { class_type: "VAELoader", inputs: { vae_name: VAE } }, 4: { class_type: "PathchSageAttentionKJ", inputs: { model: ["1", 0] } }, 5: { class_type: "KSampler", inputs: { model: ["4", 0] } } }));
const STYLE = { id: "st763", name: "Test style 763", kind: "image", engine: "comfy", workflow: "comfy_workflows/img_t763.json", loras: [{ path: "style_a.safetensors", weight: 1 }] };
const POD = path.join(TMP, "pod", "ComfyUI");
for (const d of ["diffusion_models", "text_encoders", "vae", "loras", "checkpoints"]) fs.mkdirSync(path.join(POD, "models", d), { recursive: true });
fs.mkdirSync(path.join(POD, "custom_nodes"), { recursive: true });
const LOCAL = path.join(TMP, "local", "ComfyUI");
fs.mkdirSync(path.join(LOCAL, "models", "loras"), { recursive: true });
const LO = crypto.randomBytes(70000); fs.writeFileSync(path.join(LOCAL, "models", "loras", "style_a.safetensors"), LO);
let CFG = { rgpu: { runpod: { key: "rpa_T763" }, enabled: true, engine: { provider: "runpod", runpod: "pods" }, split: { where: "remote" }, pod_jupyter: { pod763: "jup763" } },
  engine: { comfy: { dir: LOCAL } }, power: { currency: "AUD" }, fx: { code: "USD", rates: {} } };
const coreP = require.resolve("../lib/core");
const fake = new Module(coreP); fake.filename = coreP; fake.loaded = true;
fake.exports = { getConfig: () => CFG, setConfig: (c) => { CFG = c; }, STYLES_DIR: path.join(TMP, "styles"), BASE: TMP, resolvePath: (p) => path.resolve(p) };
require.cache[coreP] = fake;

const seen = [], PODS = [{ id: "pod763", name: "Pod 763", desiredStatus: "EXITED", costPerHr: 0.44, gpu: { id: "NVIDIA GeForce RTX 4090", count: 1 } }];
const CORE_NODES = ["UNETLoader", "CLIPLoader", "VAELoader", "LoraLoader", "CheckpointLoaderSimple", "KSampler"];
function wsSend(sock, obj) { const p = Buffer.from(JSON.stringify(obj)), h = p.length < 126 ? Buffer.from([0x81, p.length]) : Buffer.from([0x81, 126, p.length >> 8, p.length & 255]); sock.write(Buffer.concat([h, p])); }
function wsFrames(buf) {
  const out = []; let i = 0;
  while (i + 2 <= buf.length) {
    let len = buf[i + 1] & 127, off = i + 2;
    if (len === 126) { len = buf.readUInt16BE(off); off += 2; } else if (len === 127) { len = Number(buf.readBigUInt64BE(off)); off += 8; }
    const mask = buf.slice(off, off + 4); off += 4;
    if (off + len > buf.length) break;
    const d = Buffer.alloc(len); for (let k = 0; k < len; k++) d[k] = buf[off + k] ^ mask[k % 4];
    if ((buf[i] & 15) === 1) out.push(d.toString()); i = off + len;
  }
  return out;
}
const walk = (d, base) => { let out = []; try { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) out = out.concat(walk(p, base)); else if (!/^\./.test(f) && !/\.part$/.test(f)) out.push(path.relative(base, p).split(path.sep).join("/")); } } catch { /* none */ } return out; };
const LOADERS = { CheckpointLoaderSimple: ["ckpt_name", "checkpoints"], LoraLoader: ["lora_name", "loras"], VAELoader: ["vae_name", "vae"], UNETLoader: ["unet_name", "diffusion_models"], CLIPLoader: ["clip_name", "text_encoders"] };
const srv = http.createServer(async (q, s) => {
  let b = []; q.on("data", (d) => { b.push(d); }); await new Promise((r) => q.on("end", r)); b = Buffer.concat(b).toString();
  const send = (c, j) => { s.writeHead(c, { "Content-Type": "application/json" }); s.end(JSON.stringify(j)); };
  seen.push(q.method + " " + q.url);
  if (/^\/hf\//.test(q.url)) { s.writeHead(200, { "Content-Type": "application/octet-stream", "Content-Length": 4096 }); return s.end(Buffer.alloc(4096, 7)); }
  const m = /^\/proxy\/(\w+)-(\d+)(\/.*)$/.exec(q.url);
  if (m) {
    const [, id, port, p] = m, pod = PODS.find((x) => x.id === id);
    if (!pod || pod.desiredStatus !== "RUNNING" || (pod.ready || 0) > Date.now()) return send(502, {});
    const dir = id === "pod763" ? POD : path.join(TMP, "pod2", "ComfyUI");
    if (port === "8188") {
      if (p === "/system_stats") return send(200, { system: { argv: [path.join(dir, "main.py")] } });
      if (p === "/manager/queue/status") return send(200, { is_processing: false });
      if (p === "/manager/reboot") { seen.push("REBOOT"); pod.ready = Date.now() + 400; pod.rebooted = true; return send(200, {}); }
      const oi = /^\/object_info\/(\w+)$/.exec(p);
      if (oi && LOADERS[oi[1]]) { const [k, cat] = LOADERS[oi[1]]; return send(200, { [oi[1]]: { input: { required: { [k]: [walk(path.join(dir, "models", cat), path.join(dir, "models", cat))] } } } }); }
      if (p === "/object_info") { const o = {}; CORE_NODES.forEach((c) => { o[c] = {}; }); if (fs.existsSync(path.join(dir, "custom_nodes", "ComfyUI-KJNodes", "__init__.py")) && pod.rebooted) o.PathchSageAttentionKJ = {}; return send(200, o); }
      if (p.startsWith("/api/userdata")) return send(200, []);
      return send(404, {});
    }
    if (port === "8888") {
      if (q.headers.authorization !== "token " + CFG.rgpu.pod_jupyter[id]) return send(403, {});
      if (p === "/api/status") return send(200, {});
      if (p === "/api/kernels" && q.method === "POST") return send(201, { id: "k" + id });
      if (/^\/api\/contents\/\./.test(p) && q.method === "PUT") return send(400, { message: "Cannot create file or directory (hidden)" });   // 2.763.4: as Jupyter does
      const up = /^\/api\/contents\/(bitgen-upload-[^?]+)$/.exec(p);
      if (up && q.method === "PUT") { const j = JSON.parse(b), f = path.join(dir, "..", decodeURIComponent(up[1])); if (j.chunk === 1 || j.chunk === undefined) fs.writeFileSync(f, Buffer.from(j.content, "base64")); else fs.appendFileSync(f, Buffer.from(j.content, "base64")); return send(201, {}); }
      if (/^\/api\/contents\/\./.test(p)) return send(404, {});   // 2.763.4: Jupyter does not show hidden files - bitGen reads them through a kernel
    }
    return send(404, {});
  }
  if (q.headers.authorization !== "Bearer rpa_T763") return send(401, {});
  if (q.method === "GET" && /^\/v2\/pods\?limit=1000/.test(q.url)) return send(200, { pods: PODS });
  const one = /^\/v2\/pods\/(\w+)$/.exec(q.url); if (one && q.method === "GET") { const p = PODS.find((x) => x.id === one[1]); return p ? send(200, p) : send(404, {}); }
  if (q.method === "POST" && q.url === "/v2/pods") {
    const body = JSON.parse(b); seen.push("CREATE " + b);
    const p = { id: "pod763new", name: body.name, desiredStatus: "RUNNING", costPerHr: 0.34, gpu: { id: body.gpu.id, count: 1 }, ready: Date.now() + 500 };
    fs.mkdirSync(path.join(TMP, "pod2", "ComfyUI", "models"), { recursive: true }); fs.mkdirSync(path.join(TMP, "pod2", "ComfyUI", "custom_nodes"), { recursive: true });
    PODS.push(p); return send(201, p);
  }
  const act = /^\/v2\/pods\/(\w+)\/action$/.exec(q.url); if (act && q.method === "POST") { const p = PODS.find((x) => x.id === act[1]); if (p) { p.desiredStatus = JSON.parse(b).action === "start" ? "RUNNING" : "EXITED"; p.ready = Date.now() + 400; } seen.push("ACTION " + b); return send(200, p || {}); }
  if (/^\/v2\/catalog\/templates/.test(q.url)) return send(200, { templates: q.url.includes("official") ? [{ id: "tplComfy", name: "ComfyUI", ports: ["8188/http"] }, { id: "tplCu13", name: "ComfyUI CUDA 13", ports: ["8188/http", "8888/http", "8080/http"] }] : [], pagination: { hasNextPage: false } });
  if (/^\/v2\/catalog\/gpus/.test(q.url)) return send(200, { gpus: [{ id: "NVIDIA RTX A4000", name: "RTX A4000", memory: 16, price: { secure: 0.25, community: 0.17 }, availability: "HIGH", secure: true, community: true },
    { id: "NVIDIA GeForce RTX 4090", name: "RTX 4090", memory: 24, price: { secure: 0.69, community: 0.34 }, availability: "HIGH", secure: true, community: true },
    { id: "NVIDIA RTX A6000", name: "RTX A6000", memory: 48, price: { secure: 0.49, community: 0.33 }, availability: "MEDIUM", secure: true, community: true }] });
  send(404, {});
});
srv.on("upgrade", (q, sock) => {
  const m = /^\/proxy\/(\w+)-8888\/api\/kernels\/k\w+\/channels\?token=(.+)$/.exec(q.url);
  if (!m || decodeURIComponent(m[2]) !== CFG.rgpu.pod_jupyter[m[1]]) { sock.destroy(); return; }
  const dir = path.join(m[1] === "pod763" ? POD : path.join(TMP, "pod2", "ComfyUI"), "..");
  const acc = crypto.createHash("sha1").update(q.headers["sec-websocket-key"] + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").digest("base64");
  sock.write("HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: " + acc + "\r\n\r\n");
  let buf = Buffer.alloc(0);
  sock.on("data", (d) => {
    buf = Buffer.concat([buf, d]);
    for (const t of wsFrames(buf)) {
      buf = Buffer.alloc(0);
      const msg = JSON.parse(t); seen.push("KERNEL " + m[1]);
      // a kernel lives on: its background threads (downloads, node installs) finish before this stand-in's Python ends
      const py = spawn("python3", ["-u", "-c", msg.content.code + "\nimport threading\nfor _t in threading.enumerate():\n    if _t is not threading.main_thread(): _t.join()\n"], { cwd: dir });
      let out = "", sent = false;
      py.stdout.on("data", (x) => { out += x; if (!sent && /bitgen-(started|moved|made|folders|comfy|nodes-started|mirror-started|json )/.test(out)) { sent = true;
        wsSend(sock, { msg_type: "stream", parent_header: { msg_id: msg.header.msg_id }, content: { name: "stdout", text: out } });
        wsSend(sock, { msg_type: "execute_reply", parent_header: { msg_id: msg.header.msg_id }, content: { status: "ok" } }); } });
      py.stderr.on("data", (x) => { seen.push("PYERR " + String(x).slice(0, 300)); });
    }
  });
  sock.on("error", () => {});
});

srv.listen(0, "127.0.0.1", async () => {
  const P = srv.address().port;
  process.env.H3_RUNPOD_PROXY = "http://127.0.0.1:" + P + "/proxy/{id}-{port}";
  process.env.H3_RUNPOD_REST_API = "http://127.0.0.1:" + P + "/v2";
  process.env.H3_HF_BASE = "http://127.0.0.1:" + P + "/hf";
  process.env.H3_POD_REVIVE_POLL = "150"; process.env.H3_POD_CHUNK = "100000";
  // podModels read H3_HF_BASE when it was first required: again, with the stand-in
  for (const k of Object.keys(require.cache)) if (/lib[\\/](podModels|podPrep|stylePods|podSetup|podRevive|podSend|podStyles)\.js$/.test(k)) delete require.cache[k];
  const SPl = require("../lib/stylePods"), PPl = require("../lib/podPrep"), SUl = require("../lib/podSetup"), S = require("../lib/styles");
  // the style itself as a file (the ask box reads its name)
  let savedId = ""; try { savedId = S.save(path.join(TMP, "styles"), Object.assign({}, STYLE)).id; } catch (e) { console.log("note: style not saved - " + e.message); }
  const job = () => ({ mode: "image", style: Object.assign({}, STYLE) });
  const run = async (lim) => { let r; for (let i = 0; i < (lim || 400); i++) { r = SPl.gate(job()); if (!r || !r.wait || r.ask) return r; await sleep(120); } return r; };
  try {
    // no pod for the style: the job waits for the question
    let r = SPl.gate(job());
    check("pod mode, the style has no pod (its own / its kind's / the pod in use): the job WAITS and the page is asked (job.pod_ask)", r && r.wait > 0 && /^pa\d+$/.test(r.ask || "") && /no pod renders Test style 763 yet/.test(r.note), r);
    const ask = r.ask;
    const o = await SPl.offer(ask, "SECURE");
    check("the question's offer: the CUDA 13 template, GPUs with prices, bitGen's pick (the cheapest with enough memory), your pods, the disk",
      o.template && o.template.id === "tplCu13" && o.gpus.length === 3 && o.pick && o.need_gb >= 24 && o.volume_gb >= 50 && o.pods.some((p) => p.id === "pod763"), o);
    // Use one of your pods (stopped): linked, started, made ready - node pack, catalogue files on the pod, the LoRA from here
    const u = await SPl.answer(ask, { action: "use", pod_id: "pod763" });
    check("Use this pod: the style is linked to it (rgpu.style_pods)", u.state === "done" && CFG.rgpu.style_pods.st763 === "pod763", u);
    r = await run(600);
    const has = (cat, n) => fs.existsSync(path.join(POD, "models", cat, n));
    check("…the stopped pod is STARTED, waited for, and the style made ready on it - then the job goes there (pod_id + port)",
      r && r.pod_id === "pod763" && r.port === 8188 && seen.some((x) => /ACTION .*start/.test(x)), { r, seen: seen.filter((x) => /ACTION|PYERR|REBOOT/.test(x)), prep: PPl.status("pod763") });
    check("…its node pack (KJNodes, for PathchSageAttentionKJ) cloned into the pod's custom_nodes and ComfyUI restarted through ComfyUI-Manager",
      fs.existsSync(path.join(POD, "custom_nodes", "ComfyUI-KJNodes", "__init__.py")) && seen.includes("REBOOT"), { seen: seen.filter((x) => /KERNEL|REBOOT|PYERR/.test(x)) });
    check("…its catalogue files (diffusion model, text encoder, VAE) downloaded ON the pod into their folders; its LoRA sent from this computer, whole",
      has("diffusion_models", DM) && has("text_encoders", TE) && has("vae", VAE) && has("loras", "style_a.safetensors") && fs.readFileSync(path.join(POD, "models", "loras", "style_a.safetensors")).equals(LO), { prep: PPl.status("pod763"), files: walk(path.join(POD, "models"), path.join(POD, "models")) });
    const ps = PPl.status("pod763");
    check("…the making-ready says what it did (no problems)", ps && !ps.running && ps.done.join() === "Test style 763" && !ps.problems.length, ps);
    // next time: at once
    seen.length = 0;
    r = SPl.gate(job());
    check("next render of the style: straight to its pod, nothing asked or sent again", r && r.pod_id === "pod763" && !r.wait && !seen.some((x) => /KERNEL|bitgen-upload-|\/hf\//.test(x)), { r, seen });
    // the pod for a kind: another style with no pod of its own goes to the Image pod
    CFG.rgpu.pod_cfg = { pod763: { kinds: ["image"] } };
    const other = { mode: "image", style: { id: "st763b", name: "Other", kind: "image", engine: "comfy" } };
    let r2 = SPl.gate(other); for (let i = 0; i < 300 && r2 && r2.wait && !r2.ask; i++) { await sleep(120); r2 = SPl.gate(other); }
    check("a style with no pod of its own renders on the pod ticked for its kind (Image)", r2 && r2.pod_id === "pod763" && /the pod for image styles/.test(r2.note), r2);
    // Create: a style with no pod anywhere -> the CUDA 13 template on the picked GPU, linked, started
    CFG.rgpu.pod_cfg = {};
    const third = { mode: "image", style: { id: "st763c", name: "Third", kind: "image", engine: "comfy" } };
    CFG.rgpu.pod_jupyter.pod763new = "";   // its password comes from create()
    let r3 = SPl.gate(third);
    check("another style with no pod: asked", r3 && r3.ask, r3);
    seen.length = 0;
    const c = await SPl.answer(r3.ask, { action: "create", gpu: "NVIDIA RTX A6000", cloud: "COMMUNITY", volume: 80 });
    const body = JSON.parse((seen.find((x) => /^CREATE /.test(x)) || "CREATE {}").slice(7));
    check("Create pod: RunPod's ComfyUI CUDA 13 template, the GPU + cloud + disk picked, a CUDA 13 host (gpu.minCudaVersion), Jupyter on with bitGen's password; the style linked to the new pod",
      c.state === "done" && c.pod_id === "pod763new" && body.templateId === "tplCu13" && body.gpu.id === "NVIDIA RTX A6000" && body.gpu.minCudaVersion === "13.0" && body.cloud === "COMMUNITY"
      && body.mounts.persistent.size === 80 && body.env && body.env.JUPYTER_PASSWORD && body.ports.includes("8888/http") && CFG.rgpu.style_pods.st763c === "pod763new"
      && CFG.rgpu.pod_made.pod763new.cuda === "13.0", { c, body });
    r3 = SPl.gate(third); for (let i = 0; i < 300 && r3 && r3.wait; i++) { await sleep(120); r3 = SPl.gate(third); }
    check("…and the job then goes to the new pod", r3 && r3.pod_id === "pod763new", r3);
    // Cancel: the job goes the usual way
    const fourth = { mode: "image", style: { id: "st763d", name: "Fourth", kind: "image", engine: "comfy" } };
    let r4 = SPl.gate(fourth); await SPl.answer(r4.ask, { action: "cancel" }); r4 = SPl.gate(fourth);
    check("Cancel: the job stops waiting and says so (no pod of its own)", r4 && /you cancelled/.test(r4.error || ""), r4);
    // off pod mode: nothing to do with pods
    CFG.rgpu.split = { where: "local" };
    check("Basic Settings ▸ GPU Local: no pod is asked for", SPl.gate(fourth) === null);
    CFG.rgpu.split = { where: "remote" };
    check("an API_ / P_ / Serverless style is not this gate's", SPl.gate({ mode: "image", style: { id: "a", runs_on: "api" } }) === null && SPl.gate({ mode: "image", style: { id: "a", runs_on: "pod" } }) === null && SPl.gate({ mode: "export", style: { id: "a" } }) === null);
    // My pods ▸ 💾 Save: the styles + the kinds, one pod per kind
    CFG.rgpu.pod_cfg = { pod763new: { kinds: ["image", "video"] } };
    const sv = await SUl.save("pod763", { kinds: ["image"], styles: [savedId, "gone"], pod_name: "Pod 763", port: 8188 });
    check("💾 Save: the styles that exist linked to this pod, the Image tick taken from the other pod (one pod per kind), made ready now that it runs",
      sv.setup.styles.join() === savedId && CFG.rgpu.pod_cfg.pod763.kinds.join() === "image" && CFG.rgpu.pod_cfg.pod763new.kinds.join() === "video" && sv.preparing === true && !Object.values(CFG.rgpu.style_pods).includes("gone"), sv);
    for (let i = 0; i < 200 && (PPl.status("pod763") || {}).running; i++) await sleep(100);
    check("…the making-ready after Save finds everything there already (nothing sent again)", (PPl.status("pod763") || {}).problems.length === 0);
  } catch (e) { fail++; console.log("FAIL: crashed - " + (e && e.stack || e)); }
  srv.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
});
