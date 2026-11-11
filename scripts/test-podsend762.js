#!/usr/bin/env node
/* bitGen Studio — 2.762.0 units + LIVE: the pod's ONE checkpoint and its LoRAs from this computer's ComfyUI lists (lib/podSend.js),
 * the pod's P_ style from it with bitGen's workflow for its family (podStyles.makeFor), and Basic Settings' Override checkpoint
 * sent to the pod before a P_ render (podRevive.gate). Stand-ins: RunPod's REST API, the pods' ComfyUI + Jupyter (a kernel that
 * runs bitGen's Python here).
 * Tim (verbatim): "in pods for lora and checkpoint and folder filters use the same dropdown types like overide settings has.
 * we only upload 1 checkpoint for each pod then this pod becomes the style, if overide settings is selected and pods are
 * selected in basic settings then upload the selected checkpoint, the workflow for the style like a krea style will use our
 * krea workflow, if the model is already on the pod the just select it as the model to use. this can simplify user
 * experience" */
"use strict";
const http = require("http"), fs = require("fs"), os = require("os"), path = require("path"), crypto = require("crypto"), Module = require("module");
const { spawn } = require("child_process");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rd = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
// a studio of its own: the workflows and the download list read through links, everything it writes in a temp folder
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "pods761-"));
fs.mkdirSync(path.join(TMP, "comfy_workflows"), { recursive: true }); fs.mkdirSync(path.join(TMP, "lib")); fs.mkdirSync(path.join(TMP, "styles"));
for (const f of fs.readdirSync(path.join(ROOT, "comfy_workflows"))) if (/\.json$/.test(f)) fs.symlinkSync(path.join(ROOT, "comfy_workflows", f), path.join(TMP, "comfy_workflows", f));
fs.symlinkSync(path.join(ROOT, "lib", "modelCatalog.json"), path.join(TMP, "lib", "modelCatalog.json"));
const COMFY = { pod761: path.join(TMP, "podA", "ComfyUI"), pod761b: path.join(TMP, "podB", "ComfyUI") };
for (const d of Object.values(COMFY)) fs.mkdirSync(path.join(d, "models", "checkpoints"), { recursive: true });
fs.writeFileSync(path.join(COMFY.pod761, "models", "checkpoints", "sdxl_base_1.0.safetensors"), "x");
fs.writeFileSync(path.join(COMFY.pod761b, "models", "checkpoints", "sdxl_base_1.0.safetensors"), "x");   // the template brings it
let CFG = { rgpu: { runpod: { key: "rpa_T761", port: 3000, pod_id: "pod761", pod_name: "Pod A" }, enabled: true, engine: { provider: "runpod", runpod: "pods" },
  pod_jupyter: { pod761: "jupA761" }, pod_made: { pod761: { template_id: "tplA7610", template_name: "ComfyUI SDXL", gpu: "NVIDIA GeForce RTX 4090", count: 1, cloud: "SECURE", disk: 40, volume: 60, port: 3000, name: "Pod A" } } },
  power: { currency: "AUD" }, fx: { code: "AUD", rates: { AUD: 1.5 } } };
const coreP = require.resolve("../lib/core");
const fake = new Module(coreP); fake.filename = coreP; fake.loaded = true;
fake.exports = { getConfig: () => CFG, setConfig: (c) => { CFG = c; }, STYLES_DIR: path.join(TMP, "styles"), BASE: TMP, resolvePath: (p) => path.resolve(p) };
require.cache[coreP] = fake;

// this computer's ComfyUI: a Krea checkpoint in a sub-folder, a LoRA
const LOCAL = path.join(TMP, "local", "ComfyUI");
fs.mkdirSync(path.join(LOCAL, "models", "checkpoints", "Krea"), { recursive: true }); fs.mkdirSync(path.join(LOCAL, "models", "loras"), { recursive: true });
for (const d of ["diffusion_models", "unet", "vae", "text_encoders"]) fs.mkdirSync(path.join(LOCAL, "models", d), { recursive: true });
const CK = crypto.randomBytes(220000), LO = crypto.randomBytes(90000);
fs.writeFileSync(path.join(LOCAL, "models", "checkpoints", "Krea", "krea2_turbo_fp8.safetensors"), CK);
fs.writeFileSync(path.join(LOCAL, "models", "loras", "style_a.safetensors"), LO);
CFG.engine = { comfy: { dir: LOCAL } };
const SD = require("../lib/podSend"), PS = require("../lib/podStyles"), SU = require("../lib/podSetup"), RV = require("../lib/podRevive"), H = require("../static/podsetup.js");
/* ---------------- pure */
const scan = { categories: { checkpoints: { files: [{ name: "Krea\\krea2_turbo_fp8.safetensors", root: "/c/models/checkpoints" }, { name: "sdxl.safetensors", root: "/c/models/checkpoints" }] }, loras: { files: [{ name: "a/style_a.safetensors", root: "/c/models/loras" }] } } };
const f1 = SD.findLocal(scan, SD.CKPT_CATS, "Krea/krea2_turbo_fp8.safetensors"), f2 = SD.findLocal(scan, ["loras"], "style_a.safetensors");
check("findLocal: the file behind a name in this computer's lists (its root + the name, / or \\), else the same file name in another folder", f1 && f1.category === "checkpoints" && f1.rel === "Krea/krea2_turbo_fp8.safetensors" && f1.path === path.join("/c/models/checkpoints", "Krea", "krea2_turbo_fp8.safetensors")
  && f2 && f2.rel === "a/style_a.safetensors" && SD.findLocal(scan, ["loras"], "nope.safetensors") === null, { f1, f2 });
check("onPod: the pod's own name for one it has (same name, else the same file name elsewhere); none = \"\"", SD.onPod({ checkpoints: ["x/Krea/krea2_turbo_fp8.safetensors"] }, SD.CKPT_CATS, "Krea\\krea2_turbo_fp8.safetensors") === "x/Krea/krea2_turbo_fp8.safetensors"
  && SD.onPod({ diffusion_models: ["Krea/krea2_turbo_fp8.safetensors"] }, SD.CKPT_CATS, "Krea/krea2_turbo_fp8.safetensors") === "Krea/krea2_turbo_fp8.safetensors" && SD.onPod({ loras: ["b.safetensors"] }, ["loras"], "a.safetensors") === "");
check("folderFor: the same category and sub-folders on the pod (two at most)", SD.folderFor("checkpoints", "Krea/krea2.safetensors") === "checkpoints/Krea" && SD.folderFor("loras", "x.safetensors") === "loras" && SD.folderFor("loras", "a/b/c/x.safetensors") === "loras/a/b");
// 2.762.1 (Tim: "not made: Krea2/jibMixKrea_v60CarolinaReaper.safetensors (image) (bitGen has no image workflow for this model's family)")
check("2.762.1 starterOf: a fine-tune's folder names its family (Krea2/jibMix… -> Krea 2, flux krea/ccc_krea -> FLUX.1 dev), else the family the file itself says (sdxl -> SDXL, krea2 + gguf -> Krea 2 GGUF, turbo -> Turbo, qwen edit)",
  PS.starterOf("Krea2/jibMixKrea_v60CarolinaReaper.safetensors", "image") === "Krea 2 Raw" && PS.starterOf("flux krea/ccc_krea.safetensors", "image") === "R_FLUX.1 dev"
  && PS.starterOf("myMix.safetensors", "image", "sdxl") === "SDXL" && PS.starterOf("myMix.gguf", "image", "krea2") === "Krea 2 Raw GGUF" && PS.starterOf("myMix_turbo.safetensors", "image", "krea2") === "Krea 2 Turbo"
  && PS.starterOf("myMix.safetensors", "image_edit", "qwen-image") === "Qwen Image Edit 2511" && PS.starterOf("myMix.safetensors", "image", "") === "");
{ // 2.762.1 (Tim: "(the pod's ComfyUI did not say where it is installed)"): the pod's Jupyter finds the folder of a ComfyUI started as "python main.py"
  const PMx = require("../lib/podModels"), FC = path.join(TMP, "relcomfy", "ComfyUI");
  fs.mkdirSync(path.join(FC, "models"), { recursive: true }); fs.writeFileSync(path.join(FC, "main.py"), "import time\ntime.sleep(15)\n");
  const proc = spawn("python3", ["main.py", "--listen"], { cwd: FC });
  const r = require("child_process").spawnSync("python3", ["-c", PMx.FIND_COMFY], { encoding: "utf8" });
  proc.kill();
  check("2.762.1 FIND_COMFY (run by the pod's Jupyter): a ComfyUI started as 'python main.py' (no folder in /system_stats) - found from its process (cwd + main.py)",
    JSON.parse((/bitgen-comfy (\[.*\])/.exec(r.stdout) || [0, "[]"])[1]).includes(fs.realpathSync(FC)), r.stdout + r.stderr);
}
const PL = fs.readFileSync(path.join(ROOT, "static", "podsetup.js"), "utf8"), IDX = fs.readFileSync(path.join(ROOT, "routes", "index.js"), "utf8"), PLD = fs.readFileSync(path.join(ROOT, "static", "podload.js"), "utf8");
check("wiring (2.763.0: My pods picks styles now, not a checkpoint): a P_ render keeps Basic Settings' checkpoint and podload no longer locks it; core rewrites the job's model to the pod's name",
  !/FileDialog/.test(PL) && !/data-psnf/.test(PL) && /if \(podStyle\) \{ delete b\.extra_loras; delete b\.lora_weights; delete b\.mm_override; \}/.test(IDX)
  && /image: \["imgLoras", "tliRows"\]/.test(PLD) && /if \(g && g\.model\) st0\.model = g\.model;/.test(fs.readFileSync(path.join(ROOT, "lib", "core.js"), "utf8")));
/* ---------------- live */
const seen = [], PODS = [{ id: "pod761", name: "Pod A", desiredStatus: "RUNNING", costPerHr: 0.69, gpu: { id: "NVIDIA GeForce RTX 4090", count: 1 } }];
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
const walk = (d, base) => { let out = []; try { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) out = out.concat(walk(p, base)); else if (!/^\./.test(f)) out.push(path.relative(base, p).split(path.sep).join("/")); } } catch { /* none */ } return out; };
const LOADERS = { CheckpointLoaderSimple: ["ckpt_name", "checkpoints"], LoraLoader: ["lora_name", "loras"], VAELoader: ["vae_name", "vae"], UNETLoader: ["unet_name", "diffusion_models"], CLIPLoader: ["clip_name", "text_encoders"] };
const srv = http.createServer(async (q, s) => {
  let b = ""; q.on("data", (d) => { b += d; }); await new Promise((r) => q.on("end", r));
  const send = (c, j) => { s.writeHead(c, { "Content-Type": "application/json" }); s.end(JSON.stringify(j)); };
  seen.push(q.method + " " + q.url);
  const m = /^\/proxy\/(\w+)-(\d+)(\/.*)$/.exec(q.url);
  if (m) {
    const [, id, port, p] = m, dir = COMFY[id], pod = PODS.find((x) => x.id === id);
    if (!dir || !pod || pod.desiredStatus !== "RUNNING" || (pod.ready || 0) > Date.now()) return send(502, {});
    if (port === "8000") {
      if (p === "/v1/models") return send(200, { data: [{ id: "served-model" }] });
      if (p === "/v1/chat/completions") return send(200, { choices: [{ message: { content: "from the pod" } }] });
    }
    if (port === "3000") {
      if (p === "/system_stats") return send(200, { system: { argv: [path.join(dir, "main.py")] } });
      const oi = /^\/object_info\/(\w+)$/.exec(p);
      if (oi && LOADERS[oi[1]]) { const [k, cat] = LOADERS[oi[1]]; return send(200, { [oi[1]]: { input: { required: { [k]: [walk(path.join(dir, "models", cat), path.join(dir, "models", cat))] } } } }); }
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
      if (/^\/api\/contents\/\.bitgen_dl\.json/.test(p)) { const f = path.join(dir, "..", ".bitgen_dl.json"); return fs.existsSync(f) ? send(200, { content: fs.readFileSync(f, "utf8") }) : send(404, {}); }
    }
    return send(404, {});
  }
  if (q.headers.authorization !== "Bearer rpa_T761") return send(401, {});
  if (q.method === "GET" && /^\/v2\/pods\?limit=1000/.test(q.url)) return send(200, { pods: PODS });
  const one = /^\/v2\/pods\/(\w+)$/.exec(q.url); if (one && q.method === "GET") { const p = PODS.find((x) => x.id === one[1]); return p ? send(200, p) : send(404, {}); }
  if (q.method === "POST" && q.url === "/v2/pods") { const body = JSON.parse(b); seen.push("CREATE " + b); const p = { id: "pod761b", name: body.name, desiredStatus: "RUNNING", costPerHr: 0.69, gpu: { id: body.gpu.id, count: 1 }, ready: Date.now() + 700 }; PODS.push(p); return send(201, p); }
  const act = /^\/v2\/pods\/(\w+)\/action$/.exec(q.url); if (act && q.method === "POST") { const p = PODS.find((x) => x.id === act[1]); if (p) p.desiredStatus = JSON.parse(b).action === "start" ? "RUNNING" : "EXITED"; return send(200, p || {}); }
  if (/^\/v2\/catalog\/templates/.test(q.url)) return send(200, { templates: q.url.includes("official") ? [{ id: "tplA7610", name: "ComfyUI SDXL", ports: ["3000/http"] }] : [], pagination: { hasNextPage: false } });
  if (/^\/v2\/billing\/pods\?/.test(q.url)) {   // RunPod: startTime and endTime together (2.761.1)
    const u = new URL(q.url, "http://x"), bs = u.searchParams.get("bucketSize");
    if (!u.searchParams.get("startTime") !== !u.searchParams.get("endTime") || !u.searchParams.get("endTime")) return send(400, { title: "Bad Request", status: 400, detail: "startTime and endTime must be provided together" });
    const t0 = new Date(); t0.setHours(0, 0, 0, 0);
    if (bs === "day") return send(200, { records: [{ startTime: t0.toISOString(), podId: "pod761", totalAmount: 0.65 }], metadata: {} });   // the day row (RunPod's day) - today's comes from the hours
    return send(200, { records: [{ startTime: new Date(Math.max(t0.getTime(), Date.now() - 3600e3)).toISOString(), podId: "pod761", totalAmount: 0.3 }, { startTime: new Date().toISOString(), podId: "pod761", totalAmount: 0.4 }], metadata: {} });
  }
  send(404, {});
});
srv.on("upgrade", (q, sock) => {
  const m = /^\/proxy\/(\w+)-8888\/api\/kernels\/k\w+\/channels\?token=(.+)$/.exec(q.url);
  if (!m || decodeURIComponent(m[2]) !== CFG.rgpu.pod_jupyter[m[1]]) { sock.destroy(); return; }
  const dir = path.join(COMFY[m[1]], "..");
  const acc = crypto.createHash("sha1").update(q.headers["sec-websocket-key"] + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").digest("base64");
  sock.write("HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: " + acc + "\r\n\r\n");
  let buf = Buffer.alloc(0);
  sock.on("data", (d) => {
    buf = Buffer.concat([buf, d]);
    for (const t of wsFrames(buf)) {
      buf = Buffer.alloc(0);
      const msg = JSON.parse(t); seen.push("KERNEL " + m[1]);
      const py = spawn("python3", ["-c", msg.content.code], { cwd: dir });
      let out = "", sent = false;
      py.stdout.on("data", (x) => { out += x; if (!sent && /bitgen-(started|moved|made|folders|comfy)/.test(out)) { sent = true;
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
  process.env.H3_POD_REVIVE_POLL = "200"; process.env.H3_POD_CHUNK = "100000";
  const S = require("../lib/styles");
  const waitSend = async (id) => { let s; for (let i = 0; i < 200; i++) { s = SD.status(id); if (s && !s.running) return s; await new Promise((r) => setTimeout(r, 150)); } return s; };
  try {
    // 2.763.0: My pods' 💾 Save no longer makes a P_ style from a checkpoint - podStyles.makeFor + podSend.queue still do
    // (the P_ styles made before keep working)
    const items = [{ name: "Krea/krea2_turbo_fp8.safetensors", cats: SD.CKPT_CATS }, { name: "style_a.safetensors", cats: ["loras"] }];
    const sending = SD.queue("pod761", 3000, items).items;
    const mk = await PS.makeFor("pod761", { file: "Krea/krea2_turbo_fp8.safetensors", kinds: ["image"], pod_name: "Krea pod", port: 3000, loras: ["style_a.safetensors"], arch: "krea2" });
    const st = S.read(path.join(TMP, "styles")).find((x) => x.name === "P_Krea pod");
    const g = st ? JSON.parse(fs.readFileSync(path.join(TMP, st.workflow), "utf8")) : {};
    const unets = Object.values(g).filter((n) => /UNETLoader|CheckpointLoaderSimple/.test(n.class_type)).map((n) => n.inputs.unet_name || n.inputs.ckpt_name);
    check("a P_ style from a checkpoint (podStyles.makeFor): bitGen's Krea 2 Turbo workflow, the checkpoint by its name on the pod, the LoRA in it; both go to the pod in the background",
      mk.made.join() === "P_Krea pod" && st && st.arch === "krea2" && st.pod_model === "Krea/krea2_turbo_fp8.safetensors" && unets.length && unets.every((u) => u === "Krea/krea2_turbo_fp8.safetensors")
      && st.loras.map((l) => l.path).join() === "style_a.safetensors" && sending.length === 2, { mk, st: st && { arch: st.arch, pm: st.pod_model, loras: st.loras }, unets });
    const s1 = await waitSend("pod761");
    const ck = path.join(COMFY.pod761, "models", "checkpoints", "Krea", "krea2_turbo_fp8.safetensors"), lo = path.join(COMFY.pod761, "models", "loras", "style_a.safetensors");
    check("…sent: the checkpoint into models/checkpoints/Krea (the same sub-folder), the LoRA into models/loras, whole", s1 && !s1.running && s1.done.length === 2 && !s1.failed.length && fs.existsSync(ck) && fs.readFileSync(ck).equals(CK) && fs.existsSync(lo) && fs.readFileSync(lo).equals(LO), { s1, err: seen.filter((x) => /PYERR/.test(x)) });
    seen.length = 0;
    const mk2 = await PS.makeFor("pod761", { file: "sdxl_base_1.0.safetensors", kinds: ["image"], pod_name: "Krea pod", port: 3000, arch: "sdxl" });
    const st2 = S.read(path.join(TMP, "styles")).filter((x) => x.runs_on === "pod" && x.name === "P_Krea pod");
    check("a checkpoint the pod already has: nothing sent - the same P_ style now SDXL (bitGen's SDXL workflow)", mk2.made.join() === "P_Krea pod" && st2.length === 1 && st2[0].arch === "sdxl" && st2[0].pod_model === "sdxl_base_1.0.safetensors"
      && !seen.some((x) => /bitgen-upload-/.test(x)), { mk2, st2: st2.map((x) => [x.name, x.arch, x.pod_model]) });
    // Basic Settings ▸ Override style's checkpoint on a P_ render: the pod lacks it -> sent, then the job uses the pod's name
    fs.rmSync(path.join(COMFY.pod761, "models", "checkpoints", "Krea"), { recursive: true, force: true });
    const job = Object.assign({}, st2[0], { model: "Krea\\krea2_turbo_fp8.safetensors", model_override: true });
    let r = RV.gate(job); const first = r;
    for (let i = 0; i < 200 && r && r.wait; i++) { await new Promise((ok) => setTimeout(ok, 150)); r = RV.gate(job); }
    check("Override style + Pods: a checkpoint picked in Basic Settings is sent to the pod before the P_ job (it waits) and the job uses the pod's name for it",
      first && first.wait > 0 && r && r.model === "Krea/krea2_turbo_fp8.safetensors" && fs.existsSync(path.join(COMFY.pod761, "models", "checkpoints", "Krea", "krea2_turbo_fp8.safetensors")), { first, r });
    seen.length = 0;
    const r2 = RV.gate(job);
    check("…next time: on the pod already - go at once, nothing sent", r2 && r2.model === "Krea/krea2_turbo_fp8.safetensors" && !r2.wait && !seen.some((x) => /bitgen-upload-/.test(x)), r2);
    const job2 = Object.assign({}, st2[0], { model: "nowhere.safetensors", model_override: true });
    let r3 = RV.gate(job2); for (let i = 0; i < 100 && r3 && r3.wait; i++) { await new Promise((ok) => setTimeout(ok, 150)); r3 = RV.gate(job2); }
    check("…a checkpoint neither on the pod nor on this computer: said, not waited for forever", r3 && /not on the pod and not in this computer's ComfyUI models folders/.test(r3.error || ""), r3);
  } catch (e) { fail++; console.log("FAIL: crashed - " + (e && e.stack || e)); }
  srv.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
});
