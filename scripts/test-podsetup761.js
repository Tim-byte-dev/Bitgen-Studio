#!/usr/bin/env node
/* bitGen Studio — 2.761.0 units + LIVE: My pods as items (what a pod is for, 📁 / ➕ Checkpoint / ➕ LoRA, 💾 Save -> P_ styles,
 * the pod's LLM server), the pods' cost (RunPod's bill -> Basic Settings + 📊 Usage), and a P_ style making its pod again.
 * Stand-ins: RunPod's REST API (H3_RUNPOD_REST_API), the pods' ComfyUI + Jupyter (H3_RUNPOD_PROXY; the kernel runs bitGen's
 * Python here with python3).
 * Tim (verbatim): "make each pod name in my pods a accordian menuitem, add folder, checkpoint and add lora to each pod in my
 * pod upload those files to the checkpoint and lora folder in the runpod pod comfyui space , add checkboxes under the pod name
 * to tell if it is a video,llm,vllm,image,image-edit style. add a save button to the menu item that is disabled until changes
 * are made and disabled again after save unless new changes are made. this will save the style P_ when pods are selected in
 * basic settings only show pod styles, add the cost in basics settings refresh after every minute to show total cost, keep
 * track of all costs like we do with electricity" + "when the style is created store the runpod template used and models
 * etc, create a new pod if the pod doesn't exist for the style and start it automatically and upload the models + loras or
 * get them from the link if the model is not on the computer" */
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
fake.exports = { getConfig: () => CFG, setConfig: (c) => { CFG = c; }, STYLES_DIR: path.join(TMP, "styles"), BASE: TMP };
require.cache[coreP] = fake;

/* ---------------- pure */
const PS = require("../lib/podStyles"), PM = require("../lib/podModels"), SU = require("../lib/podSetup"), RV = require("../lib/podRevive"), PC = require("../lib/podCosts");
const U = require("../lib/usageLog"), H = require("../static/podsetup.js");
check("starterOf: the kind decides bitGen's workflow - Qwen 2.1 image / edit, Wan 2.2 video, SDXL has no video, Kontext = edit",
  PS.starterOf("qwen_image_2.1_bf16.safetensors", "image") === "qwen2_1" && PS.starterOf("qwen_image_2.1_bf16.safetensors", "image_edit") === "Qwen Image 2.1 edit"
  && PS.starterOf("wan2.2_t2v_14B.safetensors", "video") === "Wan 2.2" && PS.starterOf("sdxl_base.safetensors", "video") === "" && PS.starterOf("flux1-kontext-dev.safetensors", "image_edit") === "FLUX.1 Kontext edit");
check("folderOk: a models folder or a folder in it, three deep at most, no ..", PM.folderOk("loras") === "loras" && PM.folderOk("loras/characters") === "loras/characters"
  && PM.folderOk("loras/../x") === "" && PM.folderOk("nope") === "" && PM.folderOk("loras/a/b/c") === "");
check("cleanSetup: the five ticks in order, unknown ones dropped, port 8000 by default", JSON.stringify(SU.cleanSetup({ kinds: ["image", "xx", "llm", "video"], llm: { port: "0" } })) === JSON.stringify({ kinds: ["video", "llm", "image"], llm: { port: 8000, model: "", vlm_model: "" }, checkpoint: "", loras: [] }));   // 2.762.0: + the pod's checkpoint and LoRAs
const vw = SU.viewOf({ pod_cfg: { a: { kinds: ["llm", "image"] } }, pod_llm: { pod_id: "b" } }, "a");
check("viewOf: LLM is ticked only on the pod the LLM really is on (another pod's Save moved it)", vw.kinds.join() === "image" && !vw.llm_here, vw);
const lt = SU.llmTargetOf({ pod_llm: { pod_id: "pod761", pod_name: "A", port: 8000, model: "qwen3" } }, "llm", (id, p) => `https://${id}-${p}.proxy.runpod.net`, true);
check("llmTargetOf: the pod's OpenAI-compatible server through RunPod's proxy (/v1/chat/completions); off = none", lt.url === "https://pod761-8000.proxy.runpod.net/v1/chat/completions" && lt.model === "qwen3"
  && SU.llmTargetOf({ pod_llm: { pod_id: "x" } }, "llm", () => "u", false) === null && SU.llmTargetOf({}, "vlm", () => "u", true) === null, lt);
const rc = RV.cleanRecipe({ template_id: "tpl-123", gpu: "RTX", cloud: "community", disk: 5, volume: 99999, port: 3000, files: [{ name: "a b.safetensors", folder: "loras", path: "/x/a b.safetensors" }, { name: "c", folder: "vae", url: "ftp://x" }, { folder: "x" }] });
check("cleanRecipe: the template (no template = no recipe), sizes in range, files with a name + folder, a path or an http link", rc.template_id === "tpl123" && rc.cloud === "COMMUNITY" && rc.disk === 50 && rc.volume === 50
  && rc.files.length === 2 && rc.files[0].path && !rc.files[1].url && RV.cleanRecipe({ files: [] }) === null, rc);
const r0 = RV.recipeOf(CFG.rgpu, "pod761", null), r1 = RV.recipeOf({}, "zz", { templateId: "tplRaw01", gpu: { id: "A40", count: 2 }, cloudType: "COMMUNITY", containerDiskInGb: 30, volumeInGb: 80, name: "raw" });
check("recipeOf: how bitGen made the pod (rgpu.pod_made), else what RunPod's own record says", r0.template_id === "tplA7610" && r0.gpu === "NVIDIA GeForce RTX 4090" && r0.volume === 60
  && r1.template_id === "tplRaw01" && r1.gpu === "A40" && r1.count === 2 && r1.cloud === "COMMUNITY" && r1.disk === 30, { r0, r1 });
check("missingOf / sourceOf: what the pod lacks; from this computer while the file is there, else its link, else bitGen's list",
  RV.missingOf([{ name: "a.safetensors" }, { name: "b.safetensors" }], { loras: ["chars/a.safetensors"] }).map((f) => f.name).join() === "b.safetensors"
  && RV.sourceOf({ path: "/p", url: "u" }, () => true).how === "path" && RV.sourceOf({ path: "/p", url: "https://u" }, () => false).url === "https://u"
  && RV.sourceOf({ name: "n" }, () => false, () => "https://cat").catalog && RV.sourceOf({ name: "n" }, () => false, () => "").how === "");
const now = new Date(2026, 10, 11, 15, 0);
const sb = PC.sumBilling(PC.recordsOf({ records: [{ startTime: new Date(2026, 10, 11, 9).toISOString(), podId: "a", totalAmount: 0.5 }, { startTime: new Date(2026, 10, 11, 10).toISOString(), podId: "b", totalAmount: 0.25 },
  { startTime: new Date(2026, 10, 3, 10).toISOString(), podId: "a", totalAmount: 2 }, { startTime: "bad", totalAmount: 9 }] }), now);
check("sumBilling: RunPod's hour rows -> each local day, today, this month, per pod", sb.today === 0.75 && sb.month === 2.75 && sb.days["2026-11-03"] === 2 && sb.pods.a.today === 0.5 && sb.pods.a.month === 2.5, sb);
const mb = PC.mergeBilling({ days: { "2026-11-03": 2, "2026-11-11": 0.9 }, pods: { a: { today: 0.9, month: 2.9 } }, today: 0.9, month: 2.9 }, { days: { "2026-11-11": 0.75 }, pods: { a: { today: 0.5, month: 0.5 }, b: { today: 0.25, month: 0.25 } }, today: 0.75, month: 0.75 }, "2026-11-11");
check("mergeBilling (2.761.1): today and each pod's today from the hours, the month = the other days + today's hours", mb.today === 0.75 && mb.month === 2.75 && mb.days["2026-11-11"] === 0.75 && mb.pods.a.month === 2.5 && mb.pods.b.month === 0.25, mb);
const sum = U.summarize([], { "2026-11-11": { wh: 1000, wh_peak: 0, secs: 3600, cost_energy: 0.3, pods_cost: 1.2, pods_usd: 0.8 }, "2026-11-10": { pods_cost: 2, pods_usd: 1.33 } }, { supply_day: 1, currency: "AUD" });
check("usage log: a day's bill = energy + supply + remote + RunPod's pods (a day with pods only counts too); totals carry pods_cost",
  sum.days.find((d) => d.day === "2026-11-11").total === 2.5 && sum.days.find((d) => d.day === "2026-11-10").total === 3 && sum.totals.pods_cost === 3.2 && /pods_cost/.test(U.toCsv("days", sum.days).split("\n")[0]), sum);
check("the page's Save: off until a tick / a field changes or a file went to the pod; off again once saved (the same as saved)",
  !H.isDirty({ saved: { kinds: ["image"] }, cur: { kinds: ["image"] } }) && H.isDirty({ saved: { kinds: ["image"] }, cur: { kinds: ["image", "video"] } })
  && H.isDirty({ saved: {}, cur: {}, touched: true }) && H.isDirty({ saved: { kinds: ["llm"], llm: { port: 8000 } }, cur: { kinds: ["llm"], llm: { port: 8001 } } }) && H.KINDS.map((k) => k[1]).join() === "Video,LLM,vLLM,Image,Image edit");
const D = rd("static", "podsdock.js"), C0 = rd("lib", "core.js"), G0 = rd("lib", "gpuSplit.js"), R0 = rd("routes", "pods.js"), ST = rd("lib", "styles.js");
check("wiring: My pods items (.pdAcc / .pdHead / H3PodSetup), 💲 in Basic Settings once a minute, core asks podRevive.gate before a P_ job, gpuSplit's LLM asks the pod, the routes before /:id/:action, styles keep pod_recipe / pod_setup / pod_kind",
  /class="pdRow pdAcc/.test(D) && /class="pdHead"/.test(D) && /H3PodSetup\.html\(p\)/.test(D) && /id = "gpuPodCost"/.test(D) && /setInterval\(costLine, \+\(root\.H3_POD_COST_POLL \|\| 60000\)\)/.test(D)
  && /require\("\.\/podRevive"\)\.gate\(st0\)/.test(C0) && /require\("\.\/podSetup"\)\.llmTarget\(kind\)/.test(G0)
  && ["/api/pods/costs", "/api/pods/:id/setup", "/api/pods/:id/folders", "/api/pods/:id/folder"].every((r) => R0.indexOf('"' + r + '"') > 0 && R0.indexOf('"' + r + '"') < R0.indexOf('"/api/pods/:id/:action"'))
  && /out\.pod_recipe = rc/.test(ST) && /out\.pod_setup = /.test(ST) && !/podSetup|podRevive|podCosts/.test(rd("misc", "server.js")));

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
      const up = /^\/api\/contents\/(\.bitgen_up_[^?]+)$/.exec(p);
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
      py.stdout.on("data", (x) => { out += x; if (!sent && /bitgen-(started|moved|made|folders)/.test(out)) { sent = true;
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
  process.env.H3_POD_REVIVE_POLL = "250"; process.env.H3_POD_CHUNK = "100000";
  const S = require("../lib/styles");
  try {
    // 📁 New folder + the folders list
    const nf = await SU && await PM.newFolder("pod761", { folder: "loras", name: "characters", port: 3000 });
    const fl = await PM.folders("pod761", { port: 3000 });
    check("📁 New folder: models/loras/characters made on the pod (its Jupyter); the folder list has it", nf.folder === "loras/characters" && fs.existsSync(path.join(COMFY.pod761, "models", "loras", "characters"))
      && fl.folders.includes("loras/characters") && fl.folders.includes("checkpoints"), { nf, fl, err: seen.filter((x) => /PYERR/.test(x)) });
    // ➕ LoRA from this computer into it
    const SRC = path.join(TMP, "mylora_v1.safetensors"); fs.writeFileSync(SRC, crypto.randomBytes(250000));
    const up = await PM.upload("pod761", { path: SRC, folder: "loras/characters", port: 3000 });
    let st; for (let i = 0; i < 80; i++) { st = await PM.state("pod761", 3000); if (!st.running) break; await sleep(150); }
    const dst = path.join(COMFY.pod761, "models", "loras", "characters", "mylora_v1.safetensors");
    check("➕ LoRA: sent in parts into models/loras/characters, whole; remembered with where it came from (rgpu.pod_files)", up.name === "mylora_v1.safetensors" && fs.existsSync(dst) && fs.readFileSync(dst).equals(fs.readFileSync(SRC))
      && (CFG.rgpu.pod_files.pod761 || []).some((f) => f.name === "mylora_v1.safetensors" && f.folder === "loras/characters" && f.path === SRC), { up, st, files: CFG.rgpu.pod_files });
    // 💾 Save: image + video + LLM
    const sv = await SU.save("pod761", { kinds: ["image", "video", "llm"], llm: { port: 8000, model: "" }, pod_name: "Pod A", port: 3000 });
    const ps = S.read(path.join(TMP, "styles")).filter((x) => x.runs_on === "pod");
    const sdxl = ps.find((x) => x.name === "P_sdxl_base_1.0");
    check("💾 Save (Image ticked): P_sdxl_base_1.0 from the pod's checkpoint - SDXL's own workflow, pod_setup, kind image; SDXL has no video workflow so none for Video, said",
      sv.made.includes("P_sdxl_base_1.0") && sdxl && sdxl.pod_setup === true && sdxl.pod_kind === "image" && sdxl.pod_id === "pod761" && !ps.some((x) => /video$/.test(x.name)), { sv, ps: ps.map((x) => x.name) });
    check("…the style keeps its recipe: the template, GPU, cloud, sizes, port and the LoRA from this computer", sdxl.pod_recipe && sdxl.pod_recipe.template_id === "tplA7610" && sdxl.pod_recipe.gpu === "NVIDIA GeForce RTX 4090"
      && sdxl.pod_recipe.volume === 60 && sdxl.pod_recipe.files.some((f) => f.name === "mylora_v1.safetensors" && f.path === SRC), sdxl && sdxl.pod_recipe);
    check("…LLM ticked: the app's LLM goes to this pod's server (rgpu.pod_llm, port 8000); the setup kept", sv.llm === true && CFG.rgpu.pod_llm.pod_id === "pod761" && CFG.rgpu.pod_llm.port === 8000
      && CFG.rgpu.pod_cfg.pod761.kinds.join() === "video,llm,image");
    const t = await require("../lib/gpuSplit").llmTarget("llm");
    check("gpuSplit.llmTarget: the pod's /v1/chat/completions through the proxy, the model asked of the server (/v1/models) when none is typed",
      t && t.url === "http://127.0.0.1:" + P + "/proxy/pod761-8000/v1/chat/completions" && t.model === "served-model", t);
    const sv2 = await SU.save("pod761", { kinds: ["video"], llm: { port: 8000 }, pod_name: "Pod A", port: 3000 });
    check("💾 Save again with Image + LLM unticked: its image P_ style removed (only Save's own), the LLM back where it was", sv2.removed.includes("P_sdxl_base_1.0") && !CFG.rgpu.pod_llm
      && !S.read(path.join(TMP, "styles")).some((x) => x.name === "P_sdxl_base_1.0"), sv2);
    await SU.save("pod761", { kinds: ["image"], pod_name: "Pod A", port: 3000 });
    // the pod is gone: a P_ job makes it again
    const style = S.read(path.join(TMP, "styles")).find((x) => x.name === "P_sdxl_base_1.0");
    PODS.splice(0, 1);
    const g1 = RV.gate(style);
    check("a P_ job whose pod is gone: the queue waits ('[pod] …')", g1 && g1.wait > 0 && /checking/.test(g1.note), g1);
    let g = g1; const notes = [];
    for (let i = 0; i < 240 && g && g.wait; i++) { await sleep(250); g = RV.gate(style); if (g && g.note && notes[notes.length - 1] !== g.note) notes.push(g.note); }
    const created = seen.find((x) => /^CREATE /.test(x)) || "";
    let body = {}; try { body = JSON.parse(created.slice(7)); } catch { body = {}; }
    check("…a new pod from the recipe: the same template, GPU, cloud, disk and /workspace; then its ComfyUI waited for", body.templateId === "tplA7610" && body.gpu.id === "NVIDIA GeForce RTX 4090" && body.cloud === "SECURE"
      && body.disk === 40 && body.mounts.persistent.size === 60 && notes.some((n) => /waiting for its ComfyUI/.test(n)), { body, notes });
    const dst2 = path.join(COMFY.pod761b, "models", "loras", "characters", "mylora_v1.safetensors");
    check("…the LoRA the new pod lacks uploaded from this computer into the same folder; the checkpoint the template brings left alone", fs.existsSync(dst2) && fs.readFileSync(dst2).equals(fs.readFileSync(SRC))
      && notes.some((n) => /uploading mylora_v1/.test(n)), { notes, err: seen.filter((x) => /PYERR/.test(x)) });
    check("…the job goes on the new pod; every P_ style of the old one + Remote generation's pod moved to it", g && g.pod_id === "pod761b" && S.read(path.join(TMP, "styles")).filter((x) => x.runs_on === "pod").every((x) => x.pod_id === "pod761b")
      && CFG.rgpu.runpod.pod_id === "pod761b", { g, rp: CFG.rgpu.runpod });
    // the pod's file gone from this computer: its link, else bitGen's list
    fs.unlinkSync(SRC);
    check("…a file no longer on this computer comes from its link (or bitGen's download list by its name)", RV.sourceOf({ name: "mylora_v1.safetensors", path: SRC, url: "https://civitai.com/api/download/models/1" }, (p) => fs.existsSync(p)).how === "url");
    // the cost
    const c = await PC.costs(true);
    const days = JSON.parse(fs.readFileSync(path.join(TMP, "usage", "days.json"), "utf8"));
    const today = Object.keys(days).sort().pop();
    check("costs (2.761.1: startTime AND endTime - RunPod refuses one alone; the month by day, today by hour): the running pods' $/h + RunPod's bill (today, this month, per pod); each day into usage/days.json in the bill's currency (A$ at 1.5)",
      !c.error && seen.filter((x) => /billing\/pods\?bucketSize=(day|hour)&startTime=[^&]+&endTime=/.test(x)).length === 2
      && c.running === 1 && c.running_hr === 0.69 && c.month_usd === 0.7 && c.pods.pod761.month === 0.7 && Object.values(days).reduce((a, d) => a + (d.pods_usd || 0), 0) === 0.7
      && Math.abs(Object.values(days).reduce((a, d) => a + (d.pods_cost || 0), 0) - 1.05) < 1e-9, { c, days, today });
  } catch (e) { fail++; console.log("FAIL: crashed - " + (e && e.stack || e)); }
  srv.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
});
