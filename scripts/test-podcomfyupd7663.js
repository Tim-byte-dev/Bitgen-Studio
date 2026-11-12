#!/usr/bin/env node
/* bitGen Studio — 2.766.3: files go where the pod's ComfyUI reads them (its /internal/folder_paths - lib/podModels.js dirsOf /
 * modelDir; a copy left in <ComfyUI>/models moves), and a pod whose ComfyUI is too old for a style (a class built into a newer
 * ComfyUI - lib/podComfyUpdate.js) is updated: git pull, its requirements, ComfyUI restarted. The pod's Python runs here for
 * real (python3, a git repo as the "ComfyUI", a stand-in main.py that answers /system_stats).
 * Tim (verbatim): "[pod] qwen2_1 cannot render on the pod yet - these files are not on it: qwen_image_2.1_int8_convrot.safetensors,
 * qwen3vl_8b_int8_convrot.safetensors, qwen_image_2.1_vae_bf16.safetensors (this pod's ComfyUI cannot run qwen2_1 yet - no node
 * pack bitGen knows adds TextEncodeQwenImage21 …) but the files are already transferred" */
"use strict";
const fs = require("fs"), os = require("os"), path = require("path"), net = require("net"), Module = require("module");
const { spawnSync, spawn } = require("child_process");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let CFG = { rgpu: {} };
const coreP = require.resolve("../lib/core");
const fake = new Module(coreP); fake.filename = coreP; fake.loaded = true;
fake.exports = { getConfig: () => CFG, setConfig: (c) => { CFG = c; }, BASE: ROOT, STYLES_DIR: os.tmpdir() };
require.cache[coreP] = fake;
const PM = require("../lib/podModels"), CU = require("../lib/podComfyUpdate"), PJ = require("../lib/podJob"), PP = require("../lib/podPrep");
const freePort = () => new Promise((ok) => { const s = net.createServer().listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => ok(p)); }); });

(async () => {
  /* ---- pure */
  check("coreMissing: TextEncodeQwenImage21 is built into a newer ComfyUI (not a node pack); a pack's class is not", CU.coreMissing(["TextEncodeQwenImage21", "SomePackNode", "TextEncodeQwenImage21"]).join() === "TextEncodeQwenImage21");
  const dirs = PM.dirsOf({ diffusion_models: [["/workspace/models/diffusion_models", "/ComfyUI/models/unet"], [".safetensors"]], vae: ["/workspace/models/vae"], clip: [["/workspace/models/clip"], []], bad: [["relative/x"], []] });
  check("dirsOf: ComfyUI's /internal/folder_paths in both shapes ({k: [[paths], [exts]]} and {k: [paths]}); only absolute paths", dirs.diffusion_models[0] === "/workspace/models/diffusion_models" && dirs.vae[0] === "/workspace/models/vae" && !dirs.bad, dirs);
  const w = { comfy_dir: "/ComfyUI", model_dirs: dirs };
  check("modelDir: the first path ComfyUI gives for the kind + its sub-folder; text_encoders -> clip on an older ComfyUI; none -> <comfy>/models/<folder>",
    PM.modelDir(w, "diffusion_models/Krea") === "/workspace/models/diffusion_models/Krea" && PM.modelDir(w, "text_encoders") === "/workspace/models/clip" && PM.modelDir(w, "loras/x") === "/ComfyUI/models/loras/x" && PM.modelDir({ comfy_dir: "/c/" }, "vae") === "/c/models/vae");
  check("withDirs: each download job file gets its dir", PM.withDirs([{ name: "a", folder: "vae" }], w)[0].dir === "/workspace/models/vae");
  if (spawnSync("python3", ["--version"]).status !== 0 || spawnSync("git", ["--version"]).status !== 0) { console.log("SKIP: no python3 / git - the pod's Python is not run here"); }
  else {
    const T = fs.mkdtempSync(path.join(os.tmpdir(), "podcomfyupd7663-")), CWD = path.join(T, "jroot"); fs.mkdirSync(CWD);
    const kernel = (code) => spawnSync("python3", ["-c", code], { cwd: CWD, encoding: "utf8", timeout: 60000 });
    const status = (f) => { try { return JSON.parse(fs.readFileSync(path.join(CWD, f), "utf8")); } catch { return null; } };
    /* ---- 1. a file left in <ComfyUI>/models moves to the folder ComfyUI reads */
    const comfy = path.join(T, "ComfyUI"), models2 = path.join(T, "workspace_models", "vae");
    fs.mkdirSync(path.join(comfy, "models", "vae"), { recursive: true });
    fs.writeFileSync(path.join(comfy, "models", "vae", "qwen_image_2.1_vae_bf16.safetensors"), Buffer.alloc(5000, 1));
    const k1 = kernel(PJ.detach(PM.dlCode(PM.withDirs([{ name: "qwen_image_2.1_vae_bf16.safetensors", folder: "vae", url: "http://127.0.0.1:9/never", size: 5000 }], { comfy_dir: comfy, model_dirs: { vae: [models2] } }), comfy, "")));
    let s = null; for (let i = 0; i < 40; i++) { await sleep(150); s = status(".bitgen_dl.json"); if (s && !s.running) break; }
    check("the pod's job: the file already in <ComfyUI>/models/vae is MOVED to the folder ComfyUI reads (not downloaded again)", /bitgen-started/.test(k1.stdout) && s && s.files[0].state === "there already" && fs.existsSync(path.join(models2, "qwen_image_2.1_vae_bf16.safetensors")) && !fs.existsSync(path.join(comfy, "models", "vae", "qwen_image_2.1_vae_bf16.safetensors")), { out: k1.stdout + k1.stderr, s });

    /* ---- 2. ComfyUI updated and restarted */
    const origin = path.join(T, "origin.git"), work = path.join(T, "seed");
    const g = (args, cwd) => spawnSync("git", args, { cwd, encoding: "utf8" });
    g(["init", "-q", "--bare", origin], T); g(["clone", "-q", origin, work], T);
    g(["-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "--allow-empty", "-m", "v1"], work);
    const port = await freePort();
    fs.writeFileSync(path.join(work, "main.py"), `import http.server, json, sys\nclass H(http.server.BaseHTTPRequestHandler):\n    def do_GET(self):\n        self.send_response(200); self.end_headers(); self.wfile.write(json.dumps({'system': {'comfyui_version': open('VERSION').read().strip()}}).encode())\n    def log_message(self, *a): pass\nhttp.server.HTTPServer(('127.0.0.1', int(sys.argv[2])), H).serve_forever()\n`);
    fs.writeFileSync(path.join(work, "VERSION"), "0.34.0"); fs.writeFileSync(path.join(work, "requirements.txt"), "");
    g(["add", "-A"], work); g(["-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "-m", "old"], work); g(["push", "-q", "origin", "HEAD:master"], work);
    const cdir = path.join(T, "pod_ComfyUI"); g(["clone", "-q", "-b", "master", origin, cdir], T);
    fs.writeFileSync(path.join(work, "VERSION"), "0.36.0"); g(["-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qam", "new"], work); g(["push", "-q", "origin", "HEAD:master"], work);
    // the pod's ComfyUI: a venv Python running main.py (pip there works), its own session like a pod's
    const venv = path.join(T, "venv"), vr = spawnSync("python3", ["-m", "venv", venv], { encoding: "utf8" });
    const py = fs.existsSync(path.join(venv, "bin", "python")) && spawnSync(path.join(venv, "bin", "python"), ["-m", "pip", "--version"]).status === 0 ? path.join(venv, "bin", "python") : "";
    if (!py) console.log("SKIP: no venv with pip here - the update's restart is not run (" + (vr.stderr || "").slice(0, 120) + ")");
    else {
      const p0 = spawn(py, ["main.py", "--port", String(port)], { cwd: cdir, detached: true, stdio: "ignore" }); p0.unref();
      const up = async () => { try { const r = await fetch("http://127.0.0.1:" + port + "/system_stats"); return (await r.json()).system.comfyui_version; } catch { return ""; } };
      for (let i = 0; i < 40 && !(await up()); i++) await sleep(100);
      const v0 = await up();
      const k2 = kernel(PJ.detach(CU.updateCode(cdir, port)));
      let u = null; for (let i = 0; i < 400; i++) { await sleep(200); u = status(".bitgen_cupd.json"); if (u && !u.running) break; }
      const v1 = await up();
      check("updateCode (its own process): git pull on the pod's ComfyUI, pip install -r requirements.txt with ComfyUI's own Python, then ComfyUI stopped and started again with the same command - it answers as the new version",
        /bitgen-cupd-started/.test(k2.stdout) && v0 === "0.34.0" && u && u.state === "done" && v1 === "0.36.0" && /git pull --ff-only/.test(u.log) && new RegExp(py.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + " -m pip install -r").test(u.log), { v0, v1, u, out: k2.stdout + k2.stderr });
      try { const pid = spawnSync("bash", ["-c", `fuser -k ${port}/tcp 2>/dev/null; pkill -f "main.py --port ${port}"`]); void pid; } catch { /* fine */ }
    }
    const nogit = path.join(T, "plain"); fs.mkdirSync(nogit);
    kernel(PJ.detach(CU.updateCode(nogit, 1)));
    let u2 = null; for (let i = 0; i < 40; i++) { await sleep(150); u2 = status(".bitgen_cupd.json"); if (u2 && !u2.running) break; }
    check("…not a git checkout: said (update it with ComfyUI-Manager)", u2 && /not a git checkout/.test(u2.state), u2);
    fs.rmSync(T, { recursive: true, force: true });
  }

  /* ---- podPrep: a class built into a newer ComfyUI -> ComfyUI updated, not "no node pack bitGen knows" */
  const files = { diffusion_models: ["q.safetensors"] }; let upd = 0, info = {};
  const D = {
    ways: async () => ({ pod_id: "p", jupyter: true, manager: false, comfy_dir: "/ComfyUI", comfy_version: "0.34.0", jupyter_url: "j", comfy_url: "c" }),
    contents: async () => ({ models: JSON.parse(JSON.stringify(files)) }), download: async () => ({ started: 0 }), state: async () => ({ running: false, files: [] }),
    send: async () => ({}), local: () => null, objectInfo: async () => info, kernel: async () => "", nodeState: async () => null, reboot: async () => true,
    catalog: () => ({ models: [] }), packs: () => [], graph: () => ({}), classesOf: () => ["UNETLoader", "TextEncodeQwenImage21"], needs: () => [{ name: "q.safetensors", cat: "diffusion_models" }],
    cfg: () => ({}), localFolders: null, sleep: async () => {},
    updateComfy: async (ww, port, say) => { upd++; say("updating ComfyUI (git pull)"); info = { UNETLoader: {}, TextEncodeQwenImage21: {} }; return { ok: true, version: "0.36.0" }; },
  };
  info = { UNETLoader: {} };
  const said = [];
  process.env.H3_POD_REVIVE_POLL = "1";
  const r = await PP.prepare("p", 8188, [{ id: "s", name: "qwen2_1", kind: "image", workflow: "w.json" }], { deps: D, say: (t) => said.push(t) });
  check("prepare: TextEncodeQwenImage21 missing = the pod's ComfyUI (0.34.0) is older than qwen2_1 needs -> updated, said; no 'no node pack' problem", upd === 1 && said.some((t) => /this pod's ComfyUI 0\.34\.0 is older than qwen2_1 needs \(TextEncodeQwenImage21 is built into a newer one\) - updating ComfyUI on the pod/.test(t)) && said.some((t) => /updated to 0\.36\.0/.test(t)) && !r.problems.some((p) => /no node pack/.test(p)), { said, r });
  D.updateComfy = async () => ({ ok: false, why: "restart needed: ComfyUI is updated - it is the pod's main process, so restart the pod (PODS > My pods) to load it" });
  info = { UNETLoader: {} };
  const r2 = await PP.prepare("p", 8188, [{ id: "s", name: "qwen2_1", kind: "image", workflow: "w.json" }], { deps: D });
  check("…not updated: the reason in the problems (the job log)", r2.problems.some((p) => /older than qwen2_1 needs \(TextEncodeQwenImage21\) and was not updated: restart needed/.test(p)), r2.problems);
  const src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
  check("podModels: ways() reads where ComfyUI keeps each kind (/internal/folder_paths) + its version; downloads, uploads and new folders go there", /hit\(url \+ "\/internal\/folder_paths"/.test(src("lib/podModels.js")) && /dlCode\(withDirs\(hc\.ok, w\)/.test(src("lib/podModels.js")) && (src("lib/podModels.js").match(/modelDir\(w, folder\)/g) || []).length >= 2);
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log("FAIL: crashed " + (e && e.stack)); console.log("RESULT: FAIL"); process.exit(1); });
