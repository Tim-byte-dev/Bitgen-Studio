/* bitGen Studio — lib/podLlm.js (2.767.0): YOUR LLM / VISION LLM ON YOUR RUNPOD POD - llama.cpp's llama-server there with the
 * same GGUF as the LLM / Vision dropdowns, reached through the pod's ComfyUI address (no extra port to open).
 *
 * Tim (verbatim): "when in remote mode, prepare the llm and video models for remote use" + (asked how the LLM runs remotely)
 * "give user option to use openrouter or runpod for llm/vllm or local"
 *
 *   WHERE        rgpu.llm_where = {llm, vlm}: "local" (llama-server on this computer) | "openrouter" | "runpod" | "" (as
 *                before) - lib/gpuSplit.js llmTarget uses it while remote generation is on (Basic Settings ▸ GPU Remote/Both);
 *                "runpod" with Pods = here; with Serverless = the RunPod vLLM endpoint (Settings ▸ Remote generation)
 *   THE POD      the pod ticked LLM / vLLM in My pods (rgpu.pod_llm / pod_vlm), else the pod for image styles, else the pod in
 *                use, else the first ticked pod
 *   THE MODEL    LLM: the GGUF llama-server runs here (the LLM dropdown); Vision: Settings ▸ LLM's vision model + its mmproj.
 *                Where the pod gets it: bitGen's download list (Hugging Face), runpod/pods/remote_models.json (folder "llm"),
 *                else put ONCE in your private Hugging Face repo (lib/hfUpload.js - a token that can write) - never 17 GB
 *                over this computer's line to each pod
 *   THE JOB      (its own process on the pod - lib/podJob.js; status .bitgen_llm_<kind>.json) in /workspace/bitgen_llm (kept
 *                when the pod stops):
 *                  1. llama-server: built once from llama.cpp's own source for the pod's GPU (needs the CUDA compiler the
 *                     ComfyUI CUDA images carry); none -> the prebuilt llama-cpp-python CUDA wheel (its server)
 *                  2. the GGUF (+ mmproj) downloaded - a bar each (lib/podTransfers.js)
 *                  3. a tiny ComfyUI node (custom_nodes/bitgen_llm_proxy) passes /bitgen_llm/<kind>/… on to the server -
 *                     ComfyUI restarted ONCE to load it (lib/podComfyUpdate.js's restart)
 *                  4. llama-server started on 127.0.0.1:8080 (LLM) / :8081 (Vision), every layer on the GPU, waited for
 *                -> the LLM's address: https://<pod>-<comfy port>.proxy.runpod.net/bitgen_llm/<kind>/v1/chat/completions
 *   target(kind) ready -> {url, model, label}; not yet -> it starts / goes on preparing, and says so (the chat waits)
 * Pure (scripts/test-podllm767.js): whereOf, cleanWhere, sourceFor, proxyNodeCode, jobCode.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const KINDS = ["llm", "vlm"];
const WHERE = ["local", "openrouter", "runpod"];
const PORT = { llm: 8080, vlm: 8081 };
const ROOT = "/workspace/bitgen_llm";
const pid = (id) => String(id || "").replace(/[^A-Za-z0-9]/g, "").slice(0, 40);

/* ---------------- pure */
function cleanWhere(w) { const o = w || {}, out = {}; for (const k of KINDS) out[k] = WHERE.includes(o[k]) ? o[k] : ""; return out; }
/** where a kind runs (pure): rgpu -> "local" | "openrouter" | "runpod" | "" */
function whereOf(rgpu, kind) { return cleanWhere((rgpu || {}).llm_where)[kind] || ""; }
/** where the pod downloads a GGUF from (pure): bitGen's download list, else remote_models.json (folder "llm") -> {url, size} | null */
function sourceFor(name, catalog, remote, hfBase) {
  const b = String(name || "").split(/[\\/]/).pop().toLowerCase(), HF = String(hfBase || "https://huggingface.co").replace(/\/+$/, "");
  if (!b) return null;
  const m = (catalog || []).find((x) => x && x.repo && x.file && String(x.as || String(x.file).split("/").pop()).toLowerCase() === b);
  if (m) return { url: `${HF}/${m.repo}/resolve/main/${String(m.file).split("/").map(encodeURIComponent).join("/")}`, size: +m.size || 0, from: "Hugging Face" };
  const r = (remote || []).find((e) => e && e.url && String(e.name).toLowerCase() === b);
  if (r) return { url: r.url, size: +r.size || 0, from: r.source === "civitai" ? "Civitai" : r.source === "your-hf" ? "your Hugging Face" : "its link" };
  return null;
}
/** the ComfyUI node that passes /bitgen_llm/<kind>/… on to the pod's llama-server (pure) */
function proxyNodeCode() {
  return [
    "# bitGen Studio - passes /bitgen_llm/<kind>/... on to the llama-server bitGen started on this pod (lib/podLlm.js)",
    "from aiohttp import web, ClientSession, ClientTimeout",
    "from server import PromptServer",
    `PORTS = ${JSON.stringify(PORT)}`,
    "R = PromptServer.instance.routes",
    "@R.get('/bitgen_llm/ping')",
    "async def bitgen_llm_ping(request):",
    "    return web.json_response({'ok': True, 'ports': PORTS})",
    "@R.route('*', '/bitgen_llm/{kind}/{tail:.*}')",
    "async def bitgen_llm(request):",
    "    port = PORTS.get(request.match_info['kind'])",
    "    if not port: return web.json_response({'error': 'unknown'}, status=404)",
    "    url = 'http://127.0.0.1:%d/%s' % (port, request.match_info['tail'])",
    "    if request.query_string: url += '?' + request.query_string",
    "    body = await request.read()",
    "    try:",
    "        async with ClientSession(timeout=ClientTimeout(total=None, sock_connect=10, sock_read=900)) as s:",
    "            async with s.request(request.method, url, data=body if body else None, headers={'Content-Type': request.headers.get('Content-Type', 'application/json')}) as r:",
    "                out = web.StreamResponse(status=r.status, headers={'Content-Type': r.headers.get('Content-Type', 'application/json')})",
    "                await out.prepare(request)",
    "                async for chunk in r.content.iter_any():",
    "                    await out.write(chunk)",
    "                await out.write_eof()",
    "                return out",
    "    except Exception as e:",
    "        return web.json_response({'error': 'the LLM server on the pod is not answering: ' + str(e)[:200]}, status=502)",
    "NODE_CLASS_MAPPINGS = {}",
    "NODE_DISPLAY_NAME_MAPPINGS = {}",
  ].join("\n") + "\n";
}
/** the pod's job (pure): spec = {kind, comfy_dir, comfy_port, files: [{name, url, token, size}], model, mmproj, ctx, alias, hf} */
function jobCode(spec) {
  const s = Object.assign({ root: ROOT, port: PORT[spec.kind] || 8080, ctx: 16384 }, spec || {});
  const RP = require("./podComfyUpdate").RESTART_PY;
  return [
    "import json, os, subprocess, sys, threading, time, signal, shutil, glob, urllib.request",
    `J = json.loads(${JSON.stringify(JSON.stringify(s))})`,
    `NODE = ${JSON.stringify(proxyNodeCode())}`,
    `P = os.path.join(os.getcwd(), '.bitgen_llm_${s.kind === "vlm" ? "vlm" : "llm"}.json')`,
    "S = {'running': True, 'state': 'waiting', 'log': '', 'files': [{'name': f['name'], 'size': f.get('size', 0), 'done': 0, 'state': 'waiting'} for f in J['files']]}",
    "def save():",
    "    t = P + '.tmp'",
    "    open(t, 'w').write(json.dumps(S)); os.replace(t, P)",
    "def sh(cmd, cwd=None, env=None, t=3600):",
    "    try:",
    "        r = subprocess.run(cmd, cwd=cwd, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=t)",
    "        out, rc = r.stdout or '', r.returncode",
    "    except Exception as e: out, rc = str(e), 1",
    "    S['log'] = (S['log'] + '\\n$ ' + ' '.join(cmd) + '\\n' + out)[-4000:]; save()",
    "    return rc, out",
  ].concat(RP).concat([
    "def nvcc():",
    "    n = shutil.which('nvcc')",
    "    if n: return n",
    "    for c in sorted(glob.glob('/usr/local/cuda*/bin/nvcc'), reverse=True): return c",
    "    return ''",
    "def server():",
    "    root = J['root']; os.makedirs(root, exist_ok=True)",
    "    srv = os.path.join(root, 'llama.cpp', 'build', 'bin', 'llama-server')",
    "    if os.path.exists(srv): return srv, 'llama'",
    "    src = os.path.join(root, 'llama.cpp')",
    "    nv = nvcc()",
    "    if nv:",
    "        S['state'] = 'getting llama.cpp'; save()",
    "        if not os.path.isdir(os.path.join(src, '.git')): sh(['git', 'clone', '--depth', '1', 'https://github.com/ggml-org/llama.cpp', src])",
    "        cm = shutil.which('cmake')",
    "        if not cm:",
    "            sh([sys.executable, '-m', 'pip', 'install', 'cmake'])",
    "            cm = shutil.which('cmake') or os.path.join(os.path.dirname(sys.executable), 'cmake')",
    "        env = dict(os.environ); env['PATH'] = os.path.dirname(nv) + ':' + env.get('PATH', '')",
    "        S['state'] = 'building llama.cpp for the pod\\'s GPU (5-10 minutes, once - it is kept in /workspace)'; save()",
    "        b = os.path.join(src, 'build')",
    "        sh([cm, '-S', src, '-B', b, '-DGGML_CUDA=ON', '-DLLAMA_CURL=OFF', '-DCMAKE_BUILD_TYPE=Release'], env=env)",
    "        sh([cm, '--build', b, '--config', 'Release', '-j', str(os.cpu_count() or 8), '--target', 'llama-server'], env=env, t=5400)",
    "        if os.path.exists(srv): return srv, 'llama'",
    "    S['state'] = 'installing llama-cpp-python (a prebuilt CUDA build - the pod has no CUDA compiler)'; save()",
    "    rc, out = sh([sys.executable, '-m', 'pip', 'install', 'llama-cpp-python[server]', '--prefer-binary', '--extra-index-url', 'https://abetlen.github.io/llama-cpp-python/whl/cu124'], t=3600)",
    "    if rc == 0: return sys.executable, 'python'",
    "    raise Exception('no LLM server could be set up on the pod: no CUDA compiler (nvcc) for llama.cpp, and llama-cpp-python did not install')",
    "def fetch(i, f):",
    "    st = S['files'][i]; d = os.path.join(J['root'], 'models'); os.makedirs(d, exist_ok=True); dst = os.path.join(d, f['name'])",
    "    if os.path.exists(dst) and os.path.getsize(dst) > 0:",
    "        st['state'] = 'there already'; st['done'] = st['size'] = os.path.getsize(dst); save(); return dst",
    "    st['state'] = 'downloading'; save()",
    "    h = {'User-Agent': 'bitGen-Studio'}",
    "    if f.get('token'): h['Authorization'] = 'Bearer ' + f['token']",
    "    with urllib.request.urlopen(urllib.request.Request(f['url'], headers=h), timeout=60) as r, open(dst + '.part', 'wb') as o:",
    "        st['size'] = int(r.headers.get('Content-Length') or st['size'] or 0); last = 0",
    "        while True:",
    "            b = r.read(8 << 20)",
    "            if not b: break",
    "            o.write(b); st['done'] += len(b)",
    "            if time.time() - last > 1: save(); last = time.time()",
    "    os.replace(dst + '.part', dst); st['state'] = 'done'; save(); return dst",
    "def up(port, path='/health'):",
    "    try:",
    "        with urllib.request.urlopen('http://127.0.0.1:%d%s' % (port, path), timeout=5) as r: return r.status == 200",
    "    except Exception: return False",
    "def proxy():",
    "    d = os.path.join(J['comfy_dir'], 'custom_nodes', 'bitgen_llm_proxy'); os.makedirs(d, exist_ok=True)",
    "    f = os.path.join(d, '__init__.py'); old = open(f).read() if os.path.exists(f) else ''",
    "    if old != NODE: open(f, 'w').write(NODE)",
    "    if up(J['comfy_port'], '/bitgen_llm/ping'): return 'loaded'",
    "    S['state'] = 'restarting ComfyUI on the pod once (to load bitGen\\'s LLM route)'; save()",
    "    return restart_comfy(J['comfy_dir'], J['comfy_port'])",
    "def run():",
    "    try:",
    "        srv, how = server()",
    "        paths = [fetch(i, f) for i, f in enumerate(J['files'])]",
    "        model = os.path.join(J['root'], 'models', J['model']); mm = os.path.join(J['root'], 'models', J['mmproj']) if J.get('mmproj') else ''",
    "        r = proxy()",
    "        if r not in ('loaded', 'done'):",
    "            S['state'] = 'failed: ' + r; S['running'] = False; save(); return",
    "        pf = os.path.join(J['root'], J['kind'] + '.pid')",
    "        try: os.kill(int(open(pf).read().strip()), signal.SIGTERM); time.sleep(3)",
    "        except Exception: pass",
    "        if how == 'llama':",
    "            cmd = [srv, '-m', model, '--host', '127.0.0.1', '--port', str(J['port']), '-ngl', '999', '-c', str(J['ctx']), '--alias', J['alias'], '--jinja'] + (['--mmproj', mm] if mm else [])",
    "        else:",
    "            cmd = [srv, '-m', 'llama_cpp.server', '--model', model, '--host', '127.0.0.1', '--port', str(J['port']), '--n_gpu_layers', '-1', '--n_ctx', str(J['ctx']), '--model_alias', J['alias']] + (['--clip_model_path', mm] if mm else [])",
    "        S['state'] = 'starting the LLM server (loading the model onto the GPU)'; save()",
    "        lg = open(os.path.join(J['root'], J['kind'] + '.log'), 'ab')",
    "        p = subprocess.Popen(cmd, stdin=subprocess.DEVNULL, stdout=lg, stderr=subprocess.STDOUT, start_new_session=True)",
    "        open(pf, 'w').write(str(p.pid))",
    "        for i in range(900):",
    "            if up(J['port'], '/health' if how == 'llama' else '/v1/models'): break",
    "            if p.poll() is not None: break",
    "            time.sleep(1)",
    "        if up(J['port'], '/health' if how == 'llama' else '/v1/models'): S['state'] = 'ready'; S['server'] = how",
    "        else: S['state'] = 'failed: the LLM server did not start (see ' + os.path.join(J['root'], J['kind'] + '.log') + ' on the pod)'",
    "    except Exception as e:",
    "        S['state'] = 'failed: ' + str(e)[:300]",
    "    S['running'] = False; save()",
    "save(); threading.Thread(target=run, daemon=True).start()",
    "print('bitgen-llm-started')",
  ]).join("\n");
}

/* ---------------- live */
function core() { return require("./core"); }
function rg() { return ((core().getConfig() || {}).rgpu) || {}; }
const STATE = {};   // kind -> {pod, phase: preparing | ready | failed, note, url, model, at, file}
function view(kind) { const s = STATE[kind]; return s ? { pod: s.pod, pod_name: s.pod_name || "", phase: s.phase, note: s.note || "", file: s.file || "", at: s.at } : null; }
function setWhere(w) {
  const c = core().getConfig(); c.rgpu = c.rgpu || {};
  c.rgpu.llm_where = Object.assign(cleanWhere(c.rgpu.llm_where), Object.fromEntries(Object.entries(cleanWhere(w)).filter(([k]) => (w || {})[k] !== undefined)));
  core().setConfig(c); return c.rgpu.llm_where;
}
/** the pod for the LLM / vision LLM */
function podFor(kind) {
  const r = rg(), t = (kind === "vlm" ? r.pod_vlm : r.pod_llm) || {};
  if (t.pod_id) return { id: pid(t.pod_id), name: t.pod_name || "" };
  const SP = require("./stylePods"), k = SP.kindPod(r, "image");
  if (k) return { id: pid(k), name: "" };
  if ((r.runpod || {}).pod_id) return { id: pid(r.runpod.pod_id), name: r.runpod.pod_name || "" };
  const sel = Array.isArray(r.pod_selected) ? r.pod_selected : [];
  return sel[0] ? { id: pid(sel[0].id), name: sel[0].name || "" } : null;
}
/** the GGUF (+ mmproj) this computer uses for the kind -> {model, mmproj, dir} | null */
function filesFor(kind, given) {
  const C = core();
  // 2.768.0: the GGUF picked in the prompt docker's list in remote mode (lib/remoteLlm.js) - downloaded by the pod
  const pk = given ? null : require("./remoteLlm").fileFor(kind === "vlm" ? "vlm" : "llm");
  if (pk) {
    let dir = ""; try { dir = kind === "vlm" ? "" : C.llmPaths().dir; } catch { dir = ""; }
    const abs = dir && fs.existsSync(path.join(dir, pk.model)) ? path.join(dir, pk.model) : "";
    return { model: pk.model, mmproj: pk.mmproj, abs, mmAbs: "" };
  }
  if (kind === "vlm") {
    try {
      const CP = require("./captioner"), c = (C.getConfig() || {}).captioner || {};
      const list = CP.scan(C) || [], want = path.basename(String(c.model || ""));
      const pick = list.find((x) => path.basename(x.model) === want) || list.find((x) => x.mmproj) || list[0];
      if (!pick) return null;
      const mm = c.mmproj && path.basename(pick.model) === want ? String(c.mmproj) : pick.mmproj || "";
      return { model: path.basename(pick.model), mmproj: mm ? path.basename(mm) : "", abs: pick.model, mmAbs: mm && path.isAbsolute(mm) ? mm : mm ? path.join(path.dirname(pick.model), path.basename(mm)) : "" };
    } catch { return null; }
  }
  let f = String(given || "");
  if (!f) { try { f = String((((C.getConfig() || {}).llm) || {}).last_file || ""); } catch { f = ""; } }   // the LLM dropdown's pick
  if (!f) { try { const st = C.llamaState() || {}; f = st.file || ""; } catch { f = ""; } }
  if (!f) { try { const d = C.llmPaths().dir; f = fs.readdirSync(d).filter((x) => /\.gguf$/i.test(x)).sort()[0] || ""; } catch { f = ""; } }
  if (!f) return null;
  let abs = ""; try { abs = path.join(C.llmPaths().dir, path.basename(f)); } catch { abs = ""; }
  return { model: path.basename(f), mmproj: "", abs };
}
function catalogRaw() { try { return JSON.parse(fs.readFileSync(path.join(core().BASE, "lib", "modelCatalog.json"), "utf8")).models || []; } catch { return []; } }
async function linkFor(name, abs, say) {
  const PM = require("./podModels"), RM = require("./remoteModels");
  const s = sourceFor(name, catalogRaw(), RM.load(), PM.HF);
  if (s) return s;
  if (!abs || !fs.existsSync(abs)) throw new Error(`${name} has no download link and is not on this computer`);
  const tok = String((((core().getConfig() || {}).hf) || {}).token || "");
  if (!tok) throw new Error(`${name} has no download link - add a Hugging Face token that can write (Settings ▸ Models): bitGen then puts it once in your private repo and the pod downloads it from there`);
  const PT = require("./podTransfers"), x = PT.begin({ pod: "", name, how: "hf", from: "this computer", size: fs.statSync(abs).size });
  try {
    if (say) say(`putting ${name} in your private Hugging Face repo (once)`);
    const r = await require("./hfUpload").upload(abs, { token: tok, folder: "", name, onProgress: (n) => PT.step(x, n) });
    PT.end(x, "done");
    try { RM.add({ label: name.replace(/\.gguf$/i, ""), folder: "llm", name, url: r.url, source: "your-hf", sha256: r.sha256, size: r.size }); } catch { /* a nicety */ }
    return { url: r.url, size: r.size, from: "your Hugging Face" };
  } catch (e) { PT.end(x, "failed: " + String((e && e.message) || e)); throw e; }
}
/** the LLM / vision LLM made ready on its pod (in the background - STATE says how far) -> the state */
function prepare(kind, opts) {
  const k = kind === "vlm" ? "vlm" : "llm", o = opts || {};
  const cur = STATE[k];
  if (cur && cur.phase === "preparing") return view(k);
  const pod = podFor(k);
  if (!pod) { STATE[k] = { phase: "failed", note: "no pod yet - create one in PODS (or tick LLM / vLLM on a pod in My pods)", at: Date.now() }; return view(k); }
  const fl = filesFor(k, o.file);
  if (!fl) { STATE[k] = { pod: pod.id, phase: "failed", note: k === "vlm" ? "no vision model on this computer (Settings ▸ LLM)" : "no LLM picked (the LLM dropdown)", at: Date.now() }; return view(k); }
  if (cur && cur.phase === "ready" && cur.pod === pod.id && cur.file === fl.model && !o.force) return view(k);
  const S = STATE[k] = { pod: pod.id, pod_name: pod.name, phase: "preparing", note: "starting", file: fl.model, at: Date.now() };
  const say = (t) => { S.note = t; S.at = Date.now(); };
  (async () => {
    const PM = require("./podModels"), PJ = require("./podJob"), PT = require("./podTransfers");
    try {
      say("asking the pod what it has");
      const w = await require("./podSend").whenUp(() => PM.ways(pod.id, 0), (why) => say("waiting for the pod - " + why));
      if (!w.jupyter || !w.comfy_dir || !w.comfy_url) throw new Error("bitGen sets up the LLM through the pod's Jupyter and ComfyUI - paste its Jupyter password in ⬇ Models");
      const names = [fl.model].concat(fl.mmproj ? [fl.mmproj] : []), files = [];
      for (const n of names) {
        const abs = n === fl.model ? fl.abs : fl.mmAbs || "";
        const s = await linkFor(n, abs, say);
        files.push({ name: n, url: s.url, size: s.size, from: s.from, token: s.url.startsWith(PM.HF + "/") || /huggingface\.co/.test(s.url) ? String((((core().getConfig() || {}).hf) || {}).token || "") : "" });
      }
      const alias = fl.model.replace(/\.gguf$/i, "");
      const spec = { kind: k, comfy_dir: w.comfy_dir, comfy_port: w.comfy_port || 8188, files, model: fl.model, mmproj: fl.mmproj, alias, ctx: +(((core().getConfig() || {}).llm || {}).ctx) || 16384 };
      const said = await PM.runKernel(w.jupyter_url, PM.jupyterOf(w.pod_id), PJ.detach(jobCode(spec)));
      if (PJ.failed(said) || !/bitgen-llm-started/.test(said)) throw new Error("the pod did not start setting up the LLM" + (PJ.failed(said) ? ": " + PJ.failed(said) : ""));
      const bars = files.map((f) => PT.begin({ pod: pod.id, pod_name: pod.name, name: f.name, how: "download", from: f.from, size: f.size }));
      const mem = {}, POLL = +(process.env.H3_POD_REVIVE_POLL || 5000);
      let st = null;
      for (let i = 0; i < Math.ceil(5400000 / POLL); i++) {
        await new Promise((r) => setTimeout(r, POLL));
        st = PJ.track(mem, await PM.readCwdJson(pod.id, `.bitgen_llm_${k}.json`).catch(() => null), Date.now());
        if (!st) continue;
        (st.files || []).forEach((f, j) => { const b = bars[j]; if (!b) return; if (/^(done|there already)$/.test(f.state)) PT.end(b, "done"); else if (/^failed/.test(String(f.state))) PT.end(b, f.state); else PT.step(b, f.done || 0, f.size); });
        const cur2 = (st.files || []).find((f) => f.state === "downloading");
        say(cur2 ? `downloading ${cur2.name} on the pod${cur2.size ? " - " + Math.floor(100 * (cur2.done || 0) / cur2.size) + "%" : ""}` : String(st.state || "working"));
        if (!st.running) break;
      }
      bars.forEach((b) => PT.end(b, st && st.state === "ready" ? "done" : "failed: " + String((st && st.state) || "stopped")));
      if (!st || st.running) throw new Error("setting up the LLM did not finish in 90 minutes");
      if (st.dead) throw new Error(st.dead);
      if (st.state !== "ready") throw new Error(String(st.state).replace(/^failed: /, ""));
      S.url = w.comfy_url.replace(/\/+$/, "") + "/bitgen_llm/" + k + "/v1/chat/completions"; S.model = alias; S.server = st.server || "llama";
      S.phase = "ready"; say(`ready on the pod - ${alias}`);
    } catch (e) { S.phase = "failed"; say(String((e && e.message) || e).slice(0, 400)); }
  })();
  return view(k);
}
/** the address the chat / describe use (lib/gpuSplit.js llmTarget). 2.767.0 (Tim: "when user presses enter button to send
 *  prompt to llm"): the first prompt sent sets it up on the pod and WAITS for it (H3_POD_LLM_WAIT, 15 min) - Basic Settings ▸
 *  GPU shows how far; a failure says why */
async function target(kind, opts) {
  const k = kind === "vlm" ? "vlm" : "llm", pod = podFor(k), M = module.exports;
  const ok = (s) => s && s.phase === "ready" && pod && s.pod === pod.id;
  if (ok(STATE[k])) { const s = STATE[k]; return { url: s.url, model: s.model, headers: {}, label: `RunPod pod ${s.pod_name || s.pod} (llama.cpp)` }; }
  if (!STATE[k] || STATE[k].phase !== "preparing") M.prepare(k);
  const t0 = Date.now(), MAX = +(process.env.H3_POD_LLM_WAIT || 900000), STEP = +(process.env.H3_POD_LLM_STEP || 3000), say = (opts || {}).say;
  for (;;) {
    const s = STATE[k] || {};
    if (ok(s)) return { url: s.url, model: s.model, headers: {}, label: `RunPod pod ${s.pod_name || s.pod} (llama.cpp)` };
    if (s.phase === "failed") { const e = new Error(`the ${k === "vlm" ? "vision LLM" : "LLM"} could not be set up on the pod: ${s.note}`); e.status = 502; throw e; }
    if (Date.now() - t0 >= MAX) { const e = new Error(`the ${k === "vlm" ? "vision LLM" : "LLM"} is still being set up on your pod (${s.note || "starting"}) - send again in a few minutes; Basic Settings ▸ GPU shows how far`); e.status = 503; throw e; }
    if (say) try { say(s.note || "setting up the LLM on the pod"); } catch { /* fine */ }
    await new Promise((r) => setTimeout(r, STEP));
  }
}
module.exports = { KINDS, WHERE, PORT, ROOT, cleanWhere, whereOf, sourceFor, proxyNodeCode, jobCode, STATE, view, setWhere, podFor, filesFor, prepare, target };
