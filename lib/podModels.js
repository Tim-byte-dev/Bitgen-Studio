// bitGen Studio — lib/podModels.js (2.759.0): ⬇ MODELS ONTO A RUNPOD POD, and PODS FOR A STYLE.
// Tim (verbatim): "if i select a pod, how do i choose what model comfyui template to use and to dl it?" (asked: "Both" -
// download onto the pod, and pick by style when creating).
//   plan(styles, catalog)    the files a bitGen style loads (lib/modelsFound.js needs) that bitGen's download list knows
//                            (lib/modelCatalog.json - Hugging Face repo + file + the ComfyUI folder) -> what to fetch
//   ways(pod)                how a pod can be given files - ComfyUI has no "download a file" call of its own:
//                              manager  ComfyUI-Manager's install_model (only the models in ITS list - its own safety rule)
//                              jupyter  the pod's Jupyter (a kernel runs the download - any file); its password: the one
//                                       bitGen set when it created the pod (rgpu.pod_jupyter.<id>, encrypted), or pasted
//   start(pod, files)        the downloads, in the background on the pod (Jupyter: a thread writing .bitgen_dl.json; Manager:
//                            its queue) -> state(pod) {files: [{name, done, size, state}], running, way}
//   templateScore(t, style)  how well a RunPod template's name / image fits a style (its model family's words) - the PODS
//                            docker's "For style" puts the best first, and a pod made that way gets the style's P_ style when
//                            it has loaded (lib/podStyles.js)
// ComfyUI's folder on the pod comes from its /system_stats (argv: .../ComfyUI/main.py). Under /workspace = kept while
// the pod is stopped; elsewhere = the container disk (wiped at stop) - said in the state.
// Pure (scripts/test-pods759.js): urlOf, folderOf, plan, managerMatch, comfyDir, dlCode, templateScore, WORDS.
"use strict";

const HF = (process.env.H3_HF_BASE || "https://huggingface.co").replace(/\/+$/, "");   // H3_HF_BASE = the tests' stand-in
/** a catalogue entry -> its download address (pure) */
function urlOf(m) { return `${HF}/${m.repo}/resolve/main/${String(m.file).split("/").map(encodeURIComponent).join("/")}`; }
/** "comfy/diffusion_models" -> "diffusion_models" (pure) - only ComfyUI model folders */
function folderOf(m) { const d = String((m && m.dest) || ""); return /^comfy\//.test(d) ? d.slice(6) : ""; }
const nameOf = (m) => String(m.as || String(m.file).split("/").pop());
/** the files the styles need that the catalogue can fetch (pure) -> {files: [{name, folder, url, size, repo, for}], unknown: [names]}
 *  styles = [{style, graph, kind}] */
function plan(styles, catalog) {
  const MF = require("./modelsFound"), out = [], unknown = [], seen = new Set();
  for (const s of styles || []) {
    for (const n of MF.needs(s.graph, s.style, s.kind || "image", {})) {
      const b = String(n.name).split(/[\\/]/).pop().toLowerCase();
      if (seen.has(b)) continue;
      seen.add(b);
      const m = ((catalog && catalog.models) || []).find((x) => x && x.file && nameOf(x).toLowerCase() === b && folderOf(x));
      if (m) out.push({ name: nameOf(m), folder: folderOf(m), url: urlOf(m), size: +m.size || 0, repo: m.repo, id: m.id });
      else unknown.push(n.name);
    }
  }
  return { files: out, unknown };
}
/** the ComfyUI-Manager list entry for a file, or null (pure) - Manager installs only what its list holds */
function managerMatch(file, list) {
  const f = String(file.name || "").toLowerCase();
  return ((list && list.models) || list || []).find((x) => x && String(x.filename || "").toLowerCase() === f && (!file.folder || !x.save_path || x.save_path === "default"
    || String(x.save_path).replace(/^models\//, "").split("/")[0] === file.folder || x.type)) || null;
}
/** ComfyUI's folder from its /system_stats (pure) -> "/workspace/ComfyUI" | "" */
function comfyDir(stats) {
  const argv = (((stats || {}).system || {}).argv) || [];
  const main = argv.find((a) => /(^|\/)main\.py$/.test(String(a)));
  return main && String(main).startsWith("/") ? String(main).replace(/\/main\.py$/, "") : "";
}
/** the Python the pod's Jupyter runs (pure): a background thread downloads each file to <comfy>/models/<folder>/<name>
 *  (a .part first, then renamed), writing its progress to <root>/.bitgen_dl.json; a file already there is skipped.
 *  token = the Hugging Face token for a gated file (or "") - sent only inside this call to the user's own pod */
function dlCode(files, comfy, token) {
  const job = JSON.stringify({ comfy, files: files.map((f) => ({ name: f.name, folder: f.folder, url: f.url, size: f.size || 0, token: f.token || "" })), token: token || "", hf: HF });
  return [
    "import json, os, threading, urllib.request, time",
    `J = json.loads(${JSON.stringify(job)})`,
    "P = os.path.join(os.getcwd(), '.bitgen_dl.json')",
    "S = {'running': True, 'comfy': J['comfy'], 'files': [{'name': f['name'], 'folder': f['folder'], 'size': f['size'], 'done': 0, 'state': 'waiting'} for f in J['files']]}",
    "def save():",
    "    t = P + '.tmp'",
    "    open(t, 'w').write(json.dumps(S)); os.replace(t, P)",
    "def run():",
    "    for i, f in enumerate(J['files']):",
    "        st = S['files'][i]; d = os.path.join(J['comfy'], 'models', f['folder']); os.makedirs(d, exist_ok=True); dst = os.path.join(d, f['name'])",
    "        if os.path.exists(dst) and os.path.getsize(dst) > 0:",
    "            st['state'] = 'there already'; st['done'] = st['size'] = os.path.getsize(dst); save(); continue",
    "        st['state'] = 'downloading'; save()",
    "        try:",
    "            h = {'User-Agent': 'bitGen-Studio'}",
    "            tk = f.get('token') or (J['token'] if f['url'].startswith(J['hf'] + '/') else '')",
    "            if tk: h['Authorization'] = 'Bearer ' + tk",
    "            with urllib.request.urlopen(urllib.request.Request(f['url'], headers=h), timeout=60) as r, open(dst + '.part', 'wb') as o:",
    "                st['size'] = int(r.headers.get('Content-Length') or st['size'] or 0); last = 0",
    "                while True:",
    "                    b = r.read(8 << 20)",
    "                    if not b: break",
    "                    o.write(b); st['done'] += len(b)",
    "                    if time.time() - last > 1: last = time.time(); save()",
    "            os.replace(dst + '.part', dst); st['state'] = 'done'",
    "        except Exception as e:",
    "            st['state'] = 'failed: ' + str(e)[:200]",
    "        save()",
    "    S['running'] = False; save()",
    "save(); threading.Thread(target=run, daemon=True).start()",
    "print('bitgen-started')",
  ].join("\n");
}
// the words a template's name / image carries for each family of styles (lower case)
const WORDS = { "qwen-image": ["qwen"], "z-image": ["z-image", "zimage", "z image", "zit", "z_image"], krea2: ["krea"], flux: ["flux"],
  flux2klein9b: ["flux.2", "flux2", "flux-2", "klein"], flux3klein: ["flux 3", "flux3", "klein"], sdxl: ["sdxl", "sd xl", "illustrious", "pony"], sd3: ["sd3", "sd 3"],
  "minimax-h3": ["h3", "minimax"], wan: ["wan"], "ltx-2.3": ["ltx"], ltx: ["ltx"], anima: ["anima"], moss: ["moss"], ph3: ["p-h3", "ph3"] };
/** how well a template fits a style (pure): 0 = no word of its family; + ComfyUI; the style's own model name words */
function templateScore(t, style) {
  const st = style || {}, hay = [t.name, t.image].join(" ").toLowerCase();
  const fam = WORDS[String(st.arch || "").toLowerCase()] || WORDS[String(st.arch || "").toLowerCase().split("-")[0]] || [];
  let s = 0;
  for (const w of fam) if (hay.includes(w)) s += 10;
  if (s && t.comfy) s += 3;
  return s;
}

/* ---------------- live */
function core() { return require("./core"); }
function rp() { return (((core().getConfig() || {}).rgpu) || {}).runpod || {}; }
function podUrl(id, port) { return require("./runpodApi").proxyUrl(id, +port || +rp().port || 8188); }
async function hit(url, o) {
  const r = await fetch(url, Object.assign({ signal: AbortSignal.timeout((o && o.ms) || 20000) }, o || {}));
  const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch { j = null; }
  return { status: r.status, j, t };
}
function jupyterOf(id) { const c = core().getConfig() || {}; return String((((c.rgpu || {}).pod_jupyter) || {})[id] || ""); }
function setJupyter(id, pw) {
  const c = core().getConfig(); c.rgpu = c.rgpu || {}; c.rgpu.pod_jupyter = Object.assign({}, c.rgpu.pod_jupyter || {});
  if (pw) c.rgpu.pod_jupyter[id] = String(pw).slice(0, 200); else delete c.rgpu.pod_jupyter[id];
  core().setConfig(c);
}
/** what this pod offers -> {comfy_url, comfy_dir, kept, manager, jupyter: bool, jupyter_url} */
async function ways(id, port) {
  const pid = String(id || "").replace(/[^A-Za-z0-9]/g, "");
  const url = podUrl(pid, port);
  const st = await hit(url + "/system_stats", { ms: 15000 }).catch(() => ({ status: 0 }));
  if (st.status !== 200) { const e = new Error("the pod's ComfyUI is not answering yet - wait for \"pod loaded\""); e.status = 409; throw e; }
  const dir = comfyDir(st.j);
  const mg = await hit(url + "/manager/queue/status", { ms: 10000 }).catch(() => ({ status: 0 }));
  const ju = podUrl(pid, 8888), pw = jupyterOf(pid);
  let jupyter = false;
  if (pw) { const k = await hit(ju + "/api/status", { headers: { Authorization: "token " + pw }, ms: 10000 }).catch(() => ({ status: 0 })); jupyter = k.status === 200; }
  // 2.762.1 (Tim: "not sent: Krea2/jibMix… (the pod's ComfyUI did not say where it is installed)"): a ComfyUI started as
  // "python main.py" (a relative path) gives no folder in /system_stats - the pod's Jupyter finds it then: the folder of the
  // main.py a running process has (its cwd + the argument), else the usual places (/workspace/ComfyUI, /ComfyUI …)
  let cdir = dir;
  if (!cdir && jupyter) { try { cdir = await findComfy(ju, pw, pid); } catch { cdir = ""; } }
  return { pod_id: pid, comfy_url: url, comfy_dir: cdir, kept: /^\/workspace\//.test(cdir + "/"), manager: mg.status === 200, jupyter, jupyter_url: ju, jupyter_saved: !!pw };
}
/** 2.762.1: the Python that finds ComfyUI's folder on the pod (pure) */
const FIND_COMFY = ["import os, json", "c = []",
  "for p in os.listdir('/proc'):",
  "    if not p.isdigit(): continue",
  "    try:",
  "        args = [a.decode('utf8', 'ignore') for a in open('/proc/' + p + '/cmdline', 'rb').read().split(b'\\0')]",
  "        cwd = os.readlink('/proc/' + p + '/cwd')",
  "    except Exception: continue",
  "    for a in args:",
  "        if a.endswith('main.py'):",
  "            d = os.path.dirname(os.path.realpath(a if os.path.isabs(a) else os.path.join(cwd, a)))",
  "            if os.path.isdir(os.path.join(d, 'models')) and d not in c: c.append(d)",
  "for d in ['/workspace/ComfyUI', '/ComfyUI', '/workspace/comfyui', '/comfyui', '/app/ComfyUI', '/opt/ComfyUI', '/root/ComfyUI', '/workspace/runpod-slim/ComfyUI', '/home/user/ComfyUI']:",
  "    if os.path.isfile(os.path.join(d, 'main.py')) and os.path.isdir(os.path.join(d, 'models')) and d not in c: c.append(d)",
  "print('bitgen-comfy ' + json.dumps(c))"].join("\n");
const CDIR = {};
async function findComfy(ju, pw, pid) {
  if (CDIR[pid]) return CDIR[pid];
  const said = await runKernel(ju, pw, FIND_COMFY);
  const m = /bitgen-comfy (\[.*\])/.exec(said);
  let list = []; try { list = JSON.parse(m ? m[1] : "[]"); } catch { list = []; }
  const d = String(list[0] || "");
  if (d) CDIR[pid] = d;
  return d;
}
/** a Jupyter kernel runs `code`; resolves with what it printed (Node 22's own WebSocket) */
async function runKernel(base, pw, code) {
  const H = { Authorization: "token " + pw, "Content-Type": "application/json" };
  const k = await hit(base + "/api/kernels", { method: "POST", headers: H, body: "{}" });
  if (k.status === 401 || k.status === 403) { const e = new Error("the pod's Jupyter refused the password"); e.status = 401; throw e; }
  if (!k.j || !k.j.id) { const e = new Error(`the pod's Jupyter did not start a kernel (HTTP ${k.status})`); e.status = 502; throw e; }
  const ws = new WebSocket(base.replace(/^http/, "ws") + "/api/kernels/" + k.j.id + "/channels?token=" + encodeURIComponent(pw));
  const msgId = "bitgen-" + Date.now();
  // 2.763.4: the kernel is shut down when it has answered - a kernel left running per call (the pod's stats every few
  // seconds, the downloads' progress) would fill the pod's memory
  const done = () => { hit(base + "/api/kernels/" + k.j.id, { method: "DELETE", headers: H, ms: 15000 }).catch(() => null); };
  return new Promise((ok0, no0) => {
    const ok = (v) => { done(); ok0(v); }, no = (e) => { done(); no0(e); };
    let out = "";
    const t = setTimeout(() => { try { ws.close(); } catch { /* gone */ } no(Object.assign(new Error("the pod's Jupyter did not answer"), { status: 504 })); }, 60000);
    ws.onopen = () => ws.send(JSON.stringify({ header: { msg_id: msgId, msg_type: "execute_request", username: "bitgen", session: msgId, version: "5.3" }, parent_header: {}, metadata: {},
      content: { code, silent: false, store_history: false, user_expressions: {}, allow_stdin: false }, channel: "shell" }));
    ws.onmessage = (ev) => {
      let m; try { m = JSON.parse(String(ev.data)); } catch { return; }
      if ((m.parent_header || {}).msg_id !== msgId) return;
      if (m.msg_type === "stream") out += (m.content || {}).text || "";
      if (m.msg_type === "error") { clearTimeout(t); try { ws.close(); } catch { /* gone */ } no(Object.assign(new Error("the pod's Python: " + ((m.content || {}).evalue || "error")), { status: 502 })); }
      if (m.msg_type === "execute_reply") { clearTimeout(t); try { ws.close(); } catch { /* gone */ } ok(out); }
    };
    ws.onerror = () => { clearTimeout(t); no(Object.assign(new Error("could not talk to the pod's Jupyter"), { status: 502 })); };
  });
}
const STATE = {};    // pod -> {way, at, files (manager)}
/** {files: [{name, folder, url, size}], jupyter_password?} -> {way, started: n} */
async function start(id, b) {
  const o = b || {}, w = await ways(id, o.port);
  if (o.jupyter_password) { setJupyter(w.pod_id, o.jupyter_password); return start(id, Object.assign({}, o, { jupyter_password: "" })); }
  const files = (o.files || []).filter((f) => f && f.name && f.folder && String(f.url || "").startsWith(HF + "/") && /^[\w.+ -]+$/.test(f.name) && /^[\w.-]+$/.test(f.folder));
  if (!files.length) { const e = new Error("nothing to download - tick a style or a file"); e.status = 400; throw e; }
  if (w.jupyter) {
    if (!w.comfy_dir) { const e = new Error("bitGen could not find the pod's ComfyUI folder (not in /system_stats, no running main.py, not in /workspace/ComfyUI or /ComfyUI)"); e.status = 502; throw e; }
    const token = String(((core().getConfig() || {}).hf || {}).token || "");
    const said = await runKernel(w.jupyter_url, jupyterOf(w.pod_id), dlCode(files, w.comfy_dir, token));
    if (!/bitgen-started/.test(said)) { const e = new Error("the pod's Jupyter did not start the downloads"); e.status = 502; throw e; }
    STATE[w.pod_id] = { way: "jupyter", at: Date.now(), kept: w.kept };
    putFiles(w.pod_id, files);
    return { way: "jupyter", started: files.length, kept: w.kept, comfy_dir: w.comfy_dir };
  }
  if (w.manager) {
    const list = await hit(w.comfy_url + "/externalmodel/getlist?mode=cache", { ms: 30000 });
    const ok = [], not = [];
    for (const f of files) {
      const m = managerMatch(f, list.j);
      if (!m) { not.push(f.name); continue; }
      const r = await hit(w.comfy_url + "/manager/queue/install_model", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.assign({ ui_id: "bitgen-" + f.name }, m)) });
      if (r.status === 200) ok.push(f); else not.push(f.name + (r.status === 403 ? " (ComfyUI-Manager's security setting refuses it)" : ""));
    }
    if (ok.length) { await hit(w.comfy_url + "/manager/queue/start", { method: "POST" }); putFiles(w.pod_id, ok); }
    STATE[w.pod_id] = { way: "manager", at: Date.now(), files: ok.map((f) => ({ name: f.name, folder: f.folder, size: f.size, done: 0, state: "queued" })), kept: w.kept };
    if (!ok.length) { const e = new Error("ComfyUI-Manager on this pod can only fetch models in its own list - none of these are (" + not.join(", ") + "). Paste the pod's Jupyter password to fetch any file."); e.status = 409; throw e; }
    return { way: "manager", started: ok.length, not, kept: w.kept };
  }
  const e = new Error("this pod has no way in for downloads: no ComfyUI-Manager, and no Jupyter password - paste the one RunPod shows under the pod's Connect button");
  e.status = 409; throw e;
}
/* 2.759.0 (Tim: "add mounting the model in the pod from the hdd or link?"): a file from ANY link (Civitai, Hugging Face, a
   web address) or from this computer's disk, into the pod's models/<folder> - both through the pod's Jupyter */
const FOLDERS = ["checkpoints", "diffusion_models", "unet", "loras", "vae", "text_encoders", "clip", "clip_vision", "controlnet", "upscale_models", "embeddings", "style_models", "latent_upscale_models"];
/** 2.761.0: a models folder or a folder inside one ("loras" | "loras/characters") -> the clean path, or "" (pure) */
function folderOk(f) {
  const parts = String(f || "").replace(/\\/g, "/").split("/").filter(Boolean);
  if (!parts.length || parts.length > 3 || !FOLDERS.includes(parts[0])) return "";
  return parts.slice(1).every((x) => /^[\w.+ -]{1,64}$/.test(x) && !/^\.+$/.test(x)) ? parts.join("/") : "";
}
/** a link -> the file name it saves as (pure): the last part of its path, else "model.safetensors" */
function nameFromLink(u) {
  let n = ""; try { n = decodeURIComponent(new URL(u).pathname.split("/").filter(Boolean).pop() || ""); } catch { n = ""; }
  n = n.replace(/[^\w.+ -]+/g, "_");
  return /\.(safetensors|gguf|ckpt|pt|pth|bin|sft|onnx)$/i.test(n) ? n : (n ? n + ".safetensors" : "model.safetensors");
}
async function needJupyter(id, port, pw) {
  if (pw) setJupyter(String(id || "").replace(/[^A-Za-z0-9]/g, ""), pw);
  const w = await ways(id, port);
  if (!w.jupyter) { const e = new Error("this needs the pod's Jupyter - paste its password (RunPod ▸ the pod ▸ Connect) in ⬇ Models first"); e.status = 409; throw e; }
  if (!w.comfy_dir) { const e = new Error("bitGen could not find the pod's ComfyUI folder (not in /system_stats, no running main.py, not in /workspace/ComfyUI or /ComfyUI)"); e.status = 502; throw e; }
  return w;
}
/** {url, folder, name?} -> the download started on the pod */
async function fromLink(id, b) {
  const o = b || {}, u = String(o.url || "").trim();
  if (!/^https?:\/\/[^\s]+$/i.test(u)) { const e = new Error("paste a web address (https://…)"); e.status = 400; throw e; }
  const folder = folderOk(o.folder);
  if (!folder) { const e = new Error("pick the folder it goes in"); e.status = 400; throw e; }
  const name = String(o.name || "").trim().replace(/[^\w.+ -]+/g, "_") || nameFromLink(u);
  const w = await needJupyter(id, o.port, o.jupyter_password), c = core().getConfig() || {};
  const token = /civitai\.com/i.test(u) ? String((c.civitai || {}).token || "") : /huggingface\.co/i.test(u) ? String((c.hf || {}).token || "") : "";
  const said = await runKernel(w.jupyter_url, jupyterOf(w.pod_id), dlCode([{ name, folder, url: u, size: 0, token }], w.comfy_dir, ""));
  if (!/bitgen-started/.test(said)) { const e = new Error("the pod's Jupyter did not start the download"); e.status = 502; throw e; }
  STATE[w.pod_id] = { way: "jupyter", at: Date.now(), kept: w.kept };
  putFiles(w.pod_id, [{ name, folder, url: u }]);
  return { way: "jupyter", started: 1, name, kept: w.kept };
}
const UP = {};   // pod -> {name, size, done, state}
/** {path (a file on this computer), folder, name?} -> the upload starts (in the background here) */
async function upload(id, b) {
  const fs = require("fs"), path = require("path"), o = b || {}, src = String(o.path || "");
  let st0; try { st0 = fs.statSync(src); } catch { st0 = null; }
  if (!st0 || !st0.isFile()) { const e = new Error("pick a file on this computer"); e.status = 400; throw e; }
  const folder = folderOk(o.folder);
  if (!folder) { const e = new Error("pick the folder it goes in"); e.status = 400; throw e; }
  const name = String(o.name || path.basename(src)).replace(/[^\w.+ -]+/g, "_");
  const w = await needJupyter(id, o.port, o.jupyter_password), pw = jupyterOf(w.pod_id);
  if (UP[w.pod_id] && UP[w.pod_id].state === "uploading") { const e = new Error("an upload to this pod is running - wait for it"); e.status = 409; throw e; }
  const job = UP[w.pod_id] = { name, folder, size: st0.size, done: 0, state: "uploading" };
  // 2.763.4 (Tim: "the pod's Jupyter refused part 1 (HTTP 400)"): Jupyter refuses to write a HIDDEN file (a name starting
  // with ".") - the part file is "bitgen-upload-<name>" in its folder, moved into models/ when whole
  const H = { Authorization: "token " + pw, "Content-Type": "application/json" }, tmp = "bitgen-upload-" + name;
  const CH = +(process.env.H3_POD_CHUNK || 16 << 20);
  (async () => {
    const fd = fs.openSync(src, "r");
    try {
      const n = Math.max(1, Math.ceil(st0.size / CH));
      for (let i = 0; i < n; i++) {
        const buf = Buffer.alloc(Math.min(CH, st0.size - i * CH)); fs.readSync(fd, buf, 0, buf.length, i * CH);
        const r = await hit(w.jupyter_url + "/api/contents/" + encodeURIComponent(tmp), { method: "PUT", headers: H, ms: 600000,
          body: JSON.stringify({ type: "file", format: "base64", name: tmp, path: tmp, content: buf.toString("base64"), chunk: i === n - 1 ? -1 : i + 1 }) });
        if (r.status >= 300) throw new Error(`the pod's Jupyter refused part ${i + 1} (HTTP ${r.status})`);
        job.done += buf.length;
      }
      const code = ["import os, shutil", `src = os.path.join(os.getcwd(), ${JSON.stringify(tmp)})`, `d = os.path.join(${JSON.stringify(w.comfy_dir)}, 'models', *${JSON.stringify(folder.split("/"))})`,
        "os.makedirs(d, exist_ok=True)", `shutil.move(src, os.path.join(d, ${JSON.stringify(name)}))`, "print('bitgen-moved')"].join("\n");
      const said = await runKernel(w.jupyter_url, pw, code);
      job.state = /bitgen-moved/.test(said) ? "done" : "failed: not moved into the models folder";
      if (job.state === "done") putFiles(w.pod_id, [{ name, folder, path: src }]);
    } catch (e) { job.state = "failed: " + String(e.message || e).slice(0, 200); }
    finally { try { fs.closeSync(fd); } catch { /* fine */ } }
  })();
  return { way: "upload", name, size: st0.size, kept: w.kept };
}
/** 2.761.0 (Tim: "add folder, checkpoint and add lora to each pod in my pod" - asked: a new folder on the pod): a folder made
 *  inside one of the pod's models folders {folder: "loras", name: "characters"} -> {ok, folder: "loras/characters"} */
async function newFolder(id, b) {
  const o = b || {}, base = folderOk(o.folder), nm = String(o.name || "").trim();
  if (!base) { const e = new Error("pick the models folder it goes in"); e.status = 400; throw e; }
  if (!/^[\w.+ -]{1,64}$/.test(nm) || /^\.+$/.test(nm)) { const e = new Error("a folder name: letters, numbers, spaces, . _ + - (up to 64)"); e.status = 400; throw e; }
  const folder = folderOk(base + "/" + nm);
  if (!folder) { const e = new Error("folders go at most three deep"); e.status = 400; throw e; }
  const w = await needJupyter(id, o.port, o.jupyter_password);
  const said = await runKernel(w.jupyter_url, jupyterOf(w.pod_id), ["import os", `d = os.path.join(${JSON.stringify(w.comfy_dir)}, 'models', *${JSON.stringify(folder.split("/"))})`,
    "os.makedirs(d, exist_ok=True)", "print('bitgen-made')"].join("\n"));
  if (!/bitgen-made/.test(said)) { const e = new Error("the pod's Jupyter did not make the folder"); e.status = 502; throw e; }
  return { ok: true, folder };
}
/** 2.761.0: the folders inside the pod's checkpoints and loras (two levels) -> {folders: ["checkpoints", "checkpoints/x", "loras", …]} */
async function folders(id, b) {
  const o = b || {}, w = await needJupyter(id, o.port, o.jupyter_password);
  const said = await runKernel(w.jupyter_url, jupyterOf(w.pod_id), ["import os, json", `root = os.path.join(${JSON.stringify(w.comfy_dir)}, 'models')`, "out = []",
    "for top in ('checkpoints', 'loras'):", "    out.append(top)", "    b = os.path.join(root, top)",
    "    for dp, dn, fn in os.walk(b):", "        rel = os.path.relpath(dp, root).replace(os.sep, '/')", "        if rel.count('/') >= 2: dn[:] = []",
    "        for d in sorted(dn):", "            if not d.startswith('.'): out.append(rel + '/' + d)",
    "print('bitgen-folders ' + json.dumps(out))"].join("\n"));
  const m = /bitgen-folders (\[.*\])/.exec(said);
  let list = []; try { list = JSON.parse(m ? m[1] : "[]"); } catch { list = []; }
  return { folders: [...new Set(list.map(folderOk).filter(Boolean))].sort() };
}
/** 2.761.0: what bitGen put on a pod and where it came from (a P_ style's recipe carries it - lib/podRevive.js puts them on
 *  a new pod again): rgpu.pod_files.<pod> = [{name, folder, path | url}] */
function putFiles(id, files) {
  try {
    const c = core().getConfig(), r = c.rgpu = c.rgpu || {}, p = String(id || "").replace(/[^A-Za-z0-9]/g, "");
    const all = Object.assign({}, r.pod_files || {}), list = (all[p] || []).filter((x) => !files.some((f) => f.name === x.name && f.folder === x.folder));
    all[p] = list.concat(files.map((f) => Object.assign({ name: String(f.name), folder: String(f.folder) }, f.path ? { path: String(f.path) } : {}, f.url ? { url: String(f.url) } : {}))).slice(-200);
    r.pod_files = all; core().setConfig(c);
  } catch { /* a nicety */ }
}
function filesOf(id) { const p = String(id || "").replace(/[^A-Za-z0-9]/g, ""); return ((((core().getConfig() || {}).rgpu || {}).pod_files || {})[p] || []).slice(); }
/** the downloads' progress -> {way, running, files, kept} */
async function state(id, port) {
  const pid = String(id || "").replace(/[^A-Za-z0-9]/g, ""), s0 = STATE[pid], up = UP[pid];
  const withUp = (r) => { if (up) { r.files = (r.files || []).concat([{ name: up.name + " (from this computer)", folder: up.folder, size: up.size, done: up.done, state: up.state }]); r.running = r.running || up.state === "uploading"; } return r; };
  if (!s0) return withUp({ way: up ? "upload" : "", running: false, files: [] });
  return withUp(await state0(pid, port, s0));
}
/** 2.763.3: a status file the pod's Python wrote in its working folder -> the object | null. Jupyter's file API first; when
 *  that does not find it (Jupyter's root is not the kernel's folder on some templates) a kernel reads it */
async function readCwdJson(pid, name) {
  const pw = jupyterOf(pid), ju = podUrl(pid, 8888);
  const r = await hit(ju + "/api/contents/" + encodeURIComponent(name) + "?content=1&type=file&format=text", { headers: { Authorization: "token " + pw } }).catch(() => ({ status: 0 }));
  let j = null; try { j = JSON.parse((r.j || {}).content || "null"); } catch { j = null; }
  if (j) return j;
  try {
    const said = await runKernel(ju, pw, ["import os", `p = os.path.join(os.getcwd(), ${JSON.stringify(name)})`, "print('bitgen-json ' + (open(p).read() if os.path.exists(p) else 'null'))"].join("\n"));
    const m = /bitgen-json ([\s\S]*)$/.exec(said); return m ? JSON.parse(m[1].trim()) : null;
  } catch { return null; }
}
async function state0(pid, port, s) {
  if (s.way === "jupyter") {
    const j = await readCwdJson(pid, ".bitgen_dl.json");
    return { way: "jupyter", running: !!(j && j.running), files: (j && j.files) || [], kept: s.kept };
  }
  const q = await hit(podUrl(pid, port) + "/manager/queue/status").catch(() => ({ j: null }));
  const busy = !!(q.j && q.j.is_processing), done = +((q.j || {}).done_count) || 0;
  s.files.forEach((f, i) => { f.state = i < done ? "done" : busy ? "downloading" : f.state; if (i < done) f.done = f.size; });
  return { way: "manager", running: busy, files: s.files, kept: s.kept };
}
/** the bitGen styles' files (ids) -> plan() with the styles' own workflows read from disk */
function planFor(styleIds) {
  const S = require("./styles"), C = core(), fs = require("fs"), path = require("path");
  const cat = JSON.parse(fs.readFileSync(path.join(C.BASE, "lib", "modelCatalog.json"), "utf8"));
  const list = [];
  for (const id of styleIds || []) {
    const st = S.byId(C.STYLES_DIR, String(id)); if (!st) continue;
    const wf = st.workflow || (st.workflows && (st.workflows.t2va || Object.values(st.workflows).find(Boolean))) || "";
    let g = null; try { g = wf ? JSON.parse(fs.readFileSync(path.isAbsolute(wf) ? wf : path.join(C.BASE, wf), "utf8")) : null; } catch { g = null; }
    list.push({ style: st, graph: g, kind: st.kind || "image" });
  }
  return plan(list, cat);
}
/** bitGen's download list, the ComfyUI files only -> [{id, label, group, name, folder, url, size}] */
function catalog() {
  const fs = require("fs"), path = require("path");
  const cat = JSON.parse(fs.readFileSync(path.join(core().BASE, "lib", "modelCatalog.json"), "utf8"));
  return (cat.models || []).filter((m) => m && m.file && m.repo && folderOf(m)).map((m) => ({ id: m.id, label: m.label || m.id, group: m.group || "", name: nameOf(m), folder: folderOf(m), url: urlOf(m), size: +m.size || 0 }));
}
module.exports = { readCwdJson, hit, FIND_COMFY, findComfy, putFiles, filesOf, folderOk, newFolder, folders, FOLDERS, nameFromLink, fromLink, upload, planFor, catalog, HF, urlOf, folderOf, plan, managerMatch, comfyDir, dlCode, WORDS, templateScore, ways, start, state, setJupyter, jupyterOf, runKernel };
