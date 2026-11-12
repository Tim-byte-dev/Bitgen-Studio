#!/usr/bin/env node
/* bitGen Studio — 2.767.0: the LLM / Vision LLM in remote mode - Local, OpenRouter or RunPod (lib/gpuSplit.js llmTarget,
 * lib/podLlm.js), the pod's job run here for real (python3: the GGUF downloaded, bitGen's ComfyUI route written, ComfyUI
 * restarted to load it, the LLM server started and answering THROUGH ComfyUI's address), the LLM start not done here when
 * the LLM is remote (routes/remotePrep.js), the video style prepared ahead (lib/remotePrep.js).
 * Tim (verbatim): "when in remote mode, prepare the llm and video models for remote use" + "give user option to use openrouter
 * or runpod for llm/vllm or local" */
"use strict";
const http = require("http"), fs = require("fs"), os = require("os"), path = require("path"), net = require("net"), Module = require("module");
const { spawnSync, spawn } = require("child_process");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const T = fs.mkdtempSync(path.join(os.tmpdir(), "podllm767-"));
process.env.H3_REMOTE_MODELS = path.join(T, "remote_models.json");
let CFG = { rgpu: { enabled: true, engine: { provider: "runpod", runpod: "pods" }, split: { where: "remote" }, runpod: { key: "k", pod_id: "podA", pod_name: "A" } }, llm: { last_file: "Qwen3-8B-Q4_K_M.gguf" } };
const coreP = require.resolve("../lib/core");
const fake = new Module(coreP); fake.filename = coreP; fake.loaded = true;
fake.exports = { getConfig: () => CFG, setConfig: (c) => { CFG = c; }, BASE: ROOT, STYLES_DIR: T, llmPaths: () => ({ dir: T }), llamaState: () => ({}) };
require.cache[coreP] = fake;
const PL = require("../lib/podLlm"), G = require("../lib/gpuSplit");
const freePort = () => new Promise((ok) => { const s = net.createServer().listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => ok(p)); }); });

(async () => {
  /* ---- pure */
  check("cleanWhere / whereOf: local | openrouter | runpod per kind, anything else = '' (as before)", JSON.stringify(PL.cleanWhere({ llm: "runpod", vlm: "nope" })) === '{"llm":"runpod","vlm":""}' && PL.whereOf({ llm_where: { vlm: "openrouter" } }, "vlm") === "openrouter");
  const cat = JSON.parse(fs.readFileSync(path.join(ROOT, "lib", "modelCatalog.json"), "utf8")).models;
  const s1 = PL.sourceFor("Qwen3-8B-Q4_K_M.gguf", cat, [], "https://huggingface.co"), s2 = PL.sourceFor("mine.gguf", cat, [{ name: "mine.gguf", url: "https://huggingface.co/tim/bitgen-models/resolve/main/mine.gguf", source: "your-hf", size: 9 }]);
  check("sourceFor: bitGen's download list (Hugging Face) for a known GGUF; remote_models.json for one of yours; else null", s1 && s1.url === "https://huggingface.co/unsloth/Qwen3-8B-GGUF/resolve/main/Qwen3-8B-Q4_K_M.gguf" && s2 && s2.from === "your Hugging Face" && PL.sourceFor("unknown.gguf", cat, []) === null, { s1, s2 });
  const vm = PL.sourceFor("Qwen3-VL-8B-NSFW-Caption-V4.mmproj-f16.gguf", cat, []);
  check("…the vision model's mmproj too", vm && /mmproj-f16\.gguf$/.test(vm.url));
  const pyc = (code, n) => { const f = path.join(T, n); fs.writeFileSync(f, code); return spawnSync("python3", ["-m", "py_compile", f], { encoding: "utf8" }); };
  const hasPy = spawnSync("python3", ["--version"]).status === 0;
  if (hasPy) {
    check("proxyNodeCode + jobCode are valid Python", pyc(PL.proxyNodeCode(), "n.py").status === 0 && pyc(PL.jobCode({ kind: "vlm", comfy_dir: "/c", comfy_port: 8188, files: [], model: "m.gguf", mmproj: "mm.gguf", alias: "m" }), "j.py").status === 0);
  }
  const jc = PL.jobCode({ kind: "llm", comfy_dir: "/c", comfy_port: 8188, files: [], model: "m.gguf", alias: "m" });
  check("jobCode: llama.cpp built from its own source with CUDA (kept in /workspace/bitgen_llm), else the prebuilt llama-cpp-python CUDA wheel; every layer on the GPU; ComfyUI restarted once to load the route",
    /'git', 'clone', '--depth', '1', 'https:\/\/github\.com\/ggml-org\/llama\.cpp'/.test(jc) && /-DGGML_CUDA=ON/.test(jc) && /llama-cpp-python\[server\]/.test(jc) && /'-ngl', '999'/.test(jc) && jc.includes('\\"root\\":\\"/workspace/bitgen_llm\\"') && /return restart_comfy\(J\['comfy_dir'\], J\['comfy_port'\]\)/.test(jc));

  /* ---- where the LLM runs (gpuSplit.llmTarget) */
  const realTarget = PL.target; let asked = "";
  PL.target = async (k) => { asked = k; return { url: "https://podA-8188.proxy.runpod.net/bitgen_llm/" + k + "/v1/chat/completions", model: "m", headers: {}, label: "pod" }; };
  CFG.rgpu.llm_where = { llm: "runpod", vlm: "local" };
  const t1 = await G.llmTarget("llm"), t2 = await G.llmTarget("vlm");
  check("RunPod + Pods: the LLM goes to the pod's server (through its ComfyUI address); Local: llama-server here (null)", asked === "llm" && /\/bitgen_llm\/llm\/v1\/chat\/completions$/.test(t1.url) && t2 === null, { t1, t2 });
  CFG.rgpu.llm_where = { llm: "openrouter" };
  let e1 = null; try { await G.llmTarget("llm"); } catch (e) { e1 = e; }
  check("OpenRouter not set up: said where to set it up", e1 && /OpenRouter is not set up - add its API key .*Settings ▸ Remote generation/.test(e1.message));
  CFG.rgpu.openrouter = { key: "or_k", model: "openai/gpt-x" };
  const t3 = await G.llmTarget("llm");
  check("OpenRouter set up: its model", t3 && t3.model === "openai/gpt-x" && /openrouter/.test(t3.url), t3);
  CFG.rgpu.llm_where = { llm: "runpod" }; CFG.rgpu.engine.runpod = "serverless";
  let e2 = null; try { await G.llmTarget("llm"); } catch (e) { e2 = e; }
  check("RunPod + Serverless with no vLLM endpoint: said (or pick Pods)", e2 && /the RunPod vLLM endpoint is not set up/.test(e2.message));
  CFG.rgpu.engine.runpod = "pods"; CFG.rgpu.split.where = "local";
  check("Local in Basic Settings ▸ GPU: the choice does not apply (this computer, as before)", (await G.llmTarget("llm")) === null);
  CFG.rgpu.split.where = "remote"; PL.target = realTarget;

  /* ---- target(): the first prompt sets it up on the pod and waits for it */
  process.env.H3_POD_LLM_STEP = "5"; process.env.H3_POD_LLM_WAIT = "3000";
  const realPrep = PL.prepare; let prepped = "", n = 0;
  PL.prepare = (k) => { prepped = k; PL.STATE[k] = { phase: "preparing", note: "building llama.cpp for the pod's GPU", pod: "podA" }; return PL.view(k); };
  const notes = [];
  setTimeout(() => { PL.STATE.llm = { phase: "ready", pod: "podA", pod_name: "A", url: "https://x/bitgen_llm/llm/v1/chat/completions", model: "Qwen3-8B-Q4_K_M" }; }, 60);
  const t4 = await PL.target("llm", { say: (t) => notes.push(t) });
  check("target(): the first prompt sent starts setting it up on the pod and WAITS (saying how far) - then its address and model", prepped === "llm" && notes.some((t) => /building llama\.cpp/.test(t)) && t4.url === "https://x/bitgen_llm/llm/v1/chat/completions" && t4.model === "Qwen3-8B-Q4_K_M" && /RunPod pod A/.test(t4.label), { prepped, notes, t4 });
  PL.STATE.vlm = null; PL.prepare = (k) => { PL.STATE[k] = { phase: "failed", note: "no vision model on this computer (Settings ▸ LLM)", pod: "podA" }; return PL.view(k); };
  let e3 = null; try { await PL.target("vlm"); } catch (e) { e3 = e; }
  check("…it could not be set up: why", e3 && /the vision LLM could not be set up on the pod: no vision model/.test(e3.message));
  PL.prepare = (k) => { PL.STATE[k] = { phase: "preparing", note: "downloading x - 3%", pod: "podA" }; return PL.view(k); }; PL.STATE.vlm = null;
  process.env.H3_POD_LLM_WAIT = "30";
  let e5 = null; try { await PL.target("vlm"); } catch (e) { e5 = e; }
  check("…still not ready after the wait (15 min in the app): send again later, how far", e5 && e5.status === 503 && /still being set up on your pod \(downloading x - 3%\)/.test(e5.message));
  PL.prepare = realPrep;
  check("filesFor(llm): the LLM dropdown's pick (config llm.last_file)", PL.filesFor("llm").model === "Qwen3-8B-Q4_K_M.gguf");
  check("podFor: the pod ticked LLM in My pods, else the image pod, else the pod in use", PL.podFor("llm").id === "podA" && (() => { CFG.rgpu.pod_llm = { pod_id: "podL", pod_name: "L" }; const p = PL.podFor("llm").id; delete CFG.rgpu.pod_llm; return p === "podL"; })());

  /* ---- the routes: the LLM not started here when it is remote */
  const express = require("express"), app = express(); app.use(express.json());
  require("../routes/remotePrep").mount(app);
  let localStart = 0; app.post("/api/llm/start", (req, res) => { localStart++; res.json({ ok: true, local: true }); });
  const s0 = app.listen(0, "127.0.0.1"); await new Promise((r) => s0.once("listening", r));
  const B = "http://127.0.0.1:" + s0.address().port, pj = async (u, b) => (await fetch(B + u, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b || {}) })).json();
  CFG.rgpu.llm_where = { llm: "runpod" }; PL.STATE.llm = { phase: "ready", pod: "podA", file: "Qwen3-8B-Q4_K_M.gguf" };
  const st1 = await pj("/api/llm/start", { file: "gemma.gguf" });
  check("POST /api/llm/start in remote mode with the LLM on RunPod: not started here; the pod's LLM set up again with the new pick at the next prompt", st1.remote === "runpod" && localStart === 0 && PL.STATE.llm.phase === "stale" && /when you send a prompt/.test(st1.note), { st1, s: PL.STATE.llm });
  CFG.rgpu.llm_where = { llm: "local" };
  await pj("/api/llm/start", { file: "gemma.gguf" });
  check("…LLM on Local: started here as before", localStart === 1);
  const w1 = await pj("/api/remoteprep/where", { vlm: "openrouter" });
  check("POST /api/remoteprep/where: kept (rgpu.llm_where), the status back", CFG.rgpu.llm_where.vlm === "openrouter" && CFG.rgpu.llm_where.llm === "local" && w1.where.vlm === "openrouter" && w1.pods_mode === true, w1);
  s0.close(); PL.prepare = realPrep;

  /* ---- the pod's job for real: download, the ComfyUI route, ComfyUI restarted, the server answering through ComfyUI */
  if (!hasPy) console.log("SKIP: no python3 - the pod's job is not run here");
  else {
    const CWD = path.join(T, "jroot"), root = path.join(T, "bitgen_llm"), comfy = path.join(T, "ComfyUI"); fs.mkdirSync(CWD); fs.mkdirSync(path.join(comfy, "custom_nodes"), { recursive: true });
    const cport = await freePort(), lport = await freePort();
    // a stand-in llama-server (its build already there) and a stand-in ComfyUI that loads bitgen_llm_proxy like ComfyUI would
    fs.mkdirSync(path.join(root, "llama.cpp", "build", "bin"), { recursive: true });
    const srv = path.join(root, "llama.cpp", "build", "bin", "llama-server");
    fs.writeFileSync(srv, `#!/usr/bin/env python3\nimport http.server, json, sys\nport = int(sys.argv[sys.argv.index('--port') + 1]); model = sys.argv[sys.argv.index('-m') + 1]\nclass H(http.server.BaseHTTPRequestHandler):\n    def do_GET(self):\n        self.send_response(200); self.end_headers(); self.wfile.write(b'{"status":"ok"}')\n    def do_POST(self):\n        n = int(self.headers.get('Content-Length') or 0); b = json.loads(self.rfile.read(n) or b'{}')\n        self.send_response(200); self.send_header('Content-Type', 'application/json'); self.end_headers()\n        self.wfile.write(json.dumps({'choices': [{'message': {'content': 'hi from ' + model.split('/')[-1]}}], 'args': sys.argv[1:]}).encode())\n    def log_message(self, *a): pass\nhttp.server.HTTPServer(('127.0.0.1', port), H).serve_forever()\n`);
    fs.chmodSync(srv, 0o755);
    fs.writeFileSync(path.join(comfy, "main.py"), `import http.server, sys, os, urllib.request\nport = int(sys.argv[sys.argv.index('--port') + 1])\nP = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'custom_nodes', 'bitgen_llm_proxy', '__init__.py')\nLOADED = os.path.exists(P)\nPORTS = {'llm': ${lport}}\nclass H(http.server.BaseHTTPRequestHandler):\n    def go(self, m):\n        if self.path == '/system_stats': self.send_response(200); self.end_headers(); self.wfile.write(b'{}'); return\n        if LOADED and self.path == '/bitgen_llm/ping': self.send_response(200); self.end_headers(); self.wfile.write(b'{"ok":true}'); return\n        if LOADED and self.path.startswith('/bitgen_llm/llm/'):\n            n = int(self.headers.get('Content-Length') or 0); b = self.rfile.read(n) if n else None\n            r = urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:%d/' % PORTS['llm'] + self.path[len('/bitgen_llm/llm/'):], data=b, method=m, headers={'Content-Type': 'application/json'}))\n            self.send_response(r.status); self.end_headers(); self.wfile.write(r.read()); return\n        self.send_response(404); self.end_headers()\n    def do_GET(self): self.go('GET')\n    def do_POST(self): self.go('POST')\n    def log_message(self, *a): pass\nhttp.server.HTTPServer(('127.0.0.1', port), H).serve_forever()\n`);
    const c0 = spawn("python3", ["main.py", "--port", String(cport)], { cwd: comfy, detached: true, stdio: "ignore" }); c0.unref();
    const blob = Buffer.alloc(300000, 3);
    const hs = http.createServer((q, s) => { s.writeHead(200, { "Content-Length": blob.length }); s.end(blob); }); await new Promise((r) => hs.listen(0, "127.0.0.1", r));
    for (let i = 0; i < 40; i++) { try { if ((await fetch("http://127.0.0.1:" + cport + "/system_stats")).ok) break; } catch { /* starting */ } await sleep(100); }
    const PJ = require("../lib/podJob");
    const code = PJ.detach(PL.jobCode({ kind: "llm", root, port: lport, comfy_dir: comfy, comfy_port: cport, files: [{ name: "Qwen3-8B-Q4_K_M.gguf", url: "http://127.0.0.1:" + hs.address().port + "/q.gguf", size: blob.length }], model: "Qwen3-8B-Q4_K_M.gguf", alias: "Qwen3-8B-Q4_K_M", ctx: 4096 }));
    const k = spawnSync("python3", ["-c", code], { cwd: CWD, encoding: "utf8", timeout: 60000 });
    let st = null; for (let i = 0; i < 300; i++) { await sleep(200); try { st = JSON.parse(fs.readFileSync(path.join(CWD, ".bitgen_llm_llm.json"), "utf8")); } catch { st = null; } if (st && !st.running) break; }
    check("the pod's job: the GGUF downloaded into /workspace/bitgen_llm/models, bitGen's route written into ComfyUI's custom_nodes, ComfyUI restarted (it was not loaded), the server started - ready",
      /bitgen-llm-started/.test(k.stdout) && st && st.state === "ready" && st.files[0].state === "done" && fs.statSync(path.join(root, "models", "Qwen3-8B-Q4_K_M.gguf")).size === blob.length && fs.existsSync(path.join(comfy, "custom_nodes", "bitgen_llm_proxy", "__init__.py")), { out: k.stdout + k.stderr, st });
    let chat = null; try { chat = await (await fetch("http://127.0.0.1:" + cport + "/bitgen_llm/llm/v1/chat/completions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: [{ role: "user", content: "hi" }] }) })).json(); } catch (e) { chat = String(e); }
    check("…the LLM answers THROUGH the pod's ComfyUI address (/bitgen_llm/llm/v1/chat/completions); llama-server ran the model with every layer on the GPU", chat && chat.choices && chat.choices[0].message.content === "hi from Qwen3-8B-Q4_K_M.gguf" && chat.args.includes("-ngl") && chat.args.includes("999") && chat.args.includes("--jinja"), chat);
    hs.close();
    spawnSync("bash", ["-c", `pkill -f "main.py --port ${cport}"; pkill -f "llama-server.*--port ${lport}"`]);
  }
  /* ---- the video style made ready ahead (lib/remotePrep.js) */
  const S = require("../lib/styles"), RP = require("../lib/remotePrep"), PP = require("../lib/podPrep");
  const realById = S.byId, realPP = PP.prepare; let ppArgs = null;
  S.byId = (dir, id) => (id === "vid1" ? { id: "vid1", name: "MiniMax H3 Long", kind: "video" } : null);
  PP.prepare = async (pod, port, styles, o) => { ppArgs = { pod, port, styles: styles.map((x) => x.id) }; o.say("downloading minimax.safetensors on the pod - 40%"); return { done: ["MiniMax H3 Long"], problems: [], notThere: [], lacks: [] }; };
  CFG.rgpu.pod_cfg = { podV: { kinds: ["video"] } };
  const rs = RP.start({ video_style_id: "vid1", llm_file: "x.gguf" });
  await sleep(20);
  check("start(): the picked Video style made ready on the pod for video styles (its files, LoRAs, node packs - podPrep), ahead of the render", ppArgs && ppArgs.pod === "podV" && ppArgs.styles.join() === "vid1" && RP.status().video.phase === "ready" && rs.pods_mode === true, { ppArgs, v: RP.status().video });
  RP.VIDEO.state = null; CFG.rgpu.pod_cfg = {}; CFG.rgpu.runpod.pod_id = "";
  RP.start({ video_style_id: "vid1" });
  check("…no pod for video styles: said where to tick one", /no pod for video styles yet - tick Video on a pod in PODS ▸ My pods/.test(RP.status().video.note));
  CFG.rgpu.runpod.pod_id = "podA"; S.byId = realById; PP.prepare = realPP;
  check("routes/index.js mounts routes/remotePrep.js before its own LLM start; index.html loads remoteprep.js", /require\("\.\/remotePrep"\)\.mount\(app\);/.test(fs.readFileSync(path.join(ROOT, "routes", "index.js"), "utf8")) && /static\/remoteprep\.js/.test(fs.readFileSync(path.join(ROOT, "static", "index.html"), "utf8")));
  const RPs = require("../static/remoteprep.js");
  check("remoteprep lineOf: ✓ / ✗ / ⏳ + the note", RPs.lineOf("on the pod", { phase: "ready", note: "ready on the pod - m" }) === "✓ on the pod: ready on the pod - m" && /^⏳ /.test(RPs.lineOf("x", { phase: "preparing" })) && RPs.lineOf("x", null) === "");
  fs.rmSync(T, { recursive: true, force: true });
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log("FAIL: crashed " + (e && e.stack)); console.log("RESULT: FAIL"); process.exit(1); });
