#!/usr/bin/env node
/* bitGen Studio — 2.772.0: COMFYUI INSTALLED ON A BLANK POD (lib/podInstall.js) - the template picked, the pod made with port
 * 8188 + the install mark, and the pod's job RUN FOR REAL here with python3: a stand-in ComfyUI repo (git, file://) is cloned,
 * a venv that reuses this Python's packages is made, its requirements installed, a stand-in ComfyUI-Manager added, ComfyUI
 * started and waited for (it answers /system_stats); a second run skips every step and only starts ComfyUI again; ensure()
 * follows the steps into lib/podActivity.js (what the PODS docker shows).
 * Tim (verbatim): "is there an empty pod template that we can install our comfy ui on from scratch" + "lets do that, also in
 * the pod that is installing and being used show what is being done, then hide the completed tasks in a dropdown so the pods
 * details don't get too big. say what it is doing, downloading, loading, finding etc" */
"use strict";
const fs = require("fs"), os = require("os"), path = require("path"), net = require("net");
const { spawnSync } = require("child_process");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PI = require("../lib/podInstall"), P = require("../lib/pods"), PA = require("../lib/podActivity"), PJ = require("../lib/podJob");

// ---- pure: the template, CUDA, PyTorch
const T = (id, name, image, source, comfy) => ({ id, name, image, source: source || "official", comfy: !!comfy, ports: ["8888/http", "22/tcp"] });
const list = [
  T("c13", "ComfyUI - CUDA 13.0", "runpod/comfyui:cuda13.0", "official", true),
  T("p24", "Runpod Pytorch 2.4.0", "runpod/pytorch:2.4.0-py3.11-cuda12.4.1-devel-ubuntu22.04"),
  T("p28", "Runpod Pytorch 2.8.0", "runpod/pytorch:2.8.0-py3.11-cuda12.8.1-cudnn-devel-ubuntu22.04"),
  T("p28c", "PyTorch 2.8 (community copy)", "runpod/pytorch:2.8.0-py3.11-cuda12.8.1-cudnn-devel-ubuntu22.04", "community"),
  T("p29n", "Runpod Pytorch 2.9 CUDA 13", "runpod/pytorch:1.0.2-cu1300-torch290-ubuntu2404"),
  T("p28n", "Runpod Pytorch 2.8 new", "runpod/pytorch:1.0.2-cu1281-torch280-ubuntu2404"),
  T("tf", "Tensorflow", "tensorflow/tensorflow:latest-gpu"),
];
check("cudaOf: cuda12.8.1 -> 12.8, cu1281 -> 12.8, cu1300 -> 13.0, none -> ''",
  PI.cudaOf(list[2].image) === "12.8" && PI.cudaOf(list[5].image) === "12.8" && PI.cudaOf(list[4].image) === "13.0" && PI.cudaOf("tensorflow/tensorflow:latest-gpu") === "", [PI.cudaOf(list[2].image), PI.cudaOf(list[5].image), PI.cudaOf(list[4].image)]);
check("torchOf: 2.8.0-py3.11 -> 2.8.0, torch280 -> 2.8.0, torch290 -> 2.9.0", PI.torchOf(list[2].image) === "2.8.0" && PI.torchOf(list[5].image) === "2.8.0" && PI.torchOf(list[4].image) === "2.9.0");
const bt = PI.blankTemplate(list);
check("blankTemplate: RunPod's PyTorch, not a ComfyUI one - CUDA 12.8 before CUDA 13 (more hosts) and 12.4 (too old for RTX 50), Official before a copy, the newest PyTorch",
  bt && ["p28", "p28n"].includes(bt.id) && PI.blankTemplate(list.filter((t) => !/^p28/.test(t.id))).id === "p29n" && PI.blankTemplate([list[0], list[6]]) === null, bt);
// ---- the pod made: port 8188 opened, the install mark, CUDA from the image
{
  const b = P.createBody({ templateId: "p28abc", gpu: "NVIDIA GeForce RTX 4090", jupyter: "pw", ports: ["8888/http", "22/tcp"], install: true });
  check("createBody for a blank template: ComfyUI's 8188/http opened beside the template's ports + Jupyter's", JSON.stringify(b.ports) === JSON.stringify(["8888/http", "22/tcp", "8188/http"]) && b.env.JUPYTER_PASSWORD === "pw", b.ports);
  const b2 = P.createBody({ templateId: "c13abc", gpu: "x", jupyter: "pw", ports: ["8188/http"] });
  check("…a ComfyUI template keeps its own ports (+8888, no install)", JSON.stringify(b2.ports) === JSON.stringify(["8188/http", "8888/http"]), b2.ports);
  const b3 = P.createBody({ templateId: "p28abc", gpu: "x", jupyter: "pw", ports: [], install: true });
  check("…a blank template that lists no ports still gets 8188 + 8888", JSON.stringify(b3.ports) === JSON.stringify(["8188/http", "8888/http"]), b3.ports);
}
// ---- the job as the pod runs it
const code = PI.installCode({ dir: "/x/ComfyUI", port: 8188, repo: "file:///r", manager: "file:///m" });
check("installCode: a bitGen pod job (lib/podJob.js detach takes it: its status file, its marker, its thread line)",
  PJ.statusName(code) === ".bitgen_inst.json" && PJ.markerOf(code) === "bitgen-inst-started" && code.includes(PJ.THREAD) && /--system-site-packages/.test(code) && /'--listen', '0\.0\.0\.0'/.test(code), [PJ.statusName(code), PJ.markerOf(code)]);
check("…every step named: find, download, venv, pip, manager, start, load", ["'find'", "'download'", "'venv'", "'pip'", "'manager'", "'start'", "'load'"].every((k) => code.includes("st(" + k)));
check("…the real ComfyUI + ComfyUI-Manager by default", /github\.com\/comfyanonymous\/ComfyUI"/.test(PI.installCode({}).replace(/\\"/g, '"')) && /Comfy-Org\/ComfyUI-Manager/.test(PI.installCode({})));
check("stepsView: label + note, state, seconds", JSON.stringify(PI.stepsView({ steps: [{ key: "pip", label: "installing what ComfyUI needs", note: "collecting av (3)", state: "running", t0: 100, t1: 0 }] }, 130000)) === JSON.stringify([{ key: "pip", text: "installing what ComfyUI needs - collecting av (3)", state: "running", secs: 30 }]));

function freePort() { return new Promise((res) => { const s = net.createServer(); s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => res(p)); }); }); }
const git = (args, cwd) => spawnSync("git", args, { cwd, encoding: "utf8", env: Object.assign({}, process.env, { GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" }) });

(async () => {
  if (spawnSync("python3", ["--version"]).status !== 0 || spawnSync("git", ["--version"]).status !== 0) { console.log("SKIP: no python3 / git - the job did not run"); }
  else {
    const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "podinst772-")), CWD = path.join(TMP, "jroot"), REPO = path.join(TMP, "comfy-src"), MGR = path.join(TMP, "mgr-src"), DIR = path.join(TMP, "workspace", "ComfyUI");
    fs.mkdirSync(CWD); fs.mkdirSync(REPO); fs.mkdirSync(MGR); fs.mkdirSync(path.join(TMP, "workspace"));
    // a stand-in ComfyUI: answers /system_stats on --port after a short "load" (and logs while it loads)
    fs.writeFileSync(path.join(REPO, "main.py"), [
      "import sys, json, time, http.server",
      "port = int(sys.argv[sys.argv.index('--port') + 1])",
      "print('Total VRAM 24000 MB', flush=True); time.sleep(1.0); print('Import times for custom nodes:', flush=True); time.sleep(1.0)",
      "class H(http.server.BaseHTTPRequestHandler):",
      "    def do_GET(self):",
      "        b = json.dumps({'system': {'comfyui_version': '0.9.9', 'python_version': sys.version.split()[0]}, 'devices': []}).encode()",
      "        self.send_response(200); self.send_header('Content-Type', 'application/json'); self.end_headers(); self.wfile.write(b)",
      "    def log_message(self, *a): pass",
      "print('Starting server', flush=True)",
      "http.server.HTTPServer(('0.0.0.0', port), H).serve_forever()",
    ].join("\n"));
    fs.writeFileSync(path.join(REPO, "comfyui_version.py"), '__version__ = "0.9.9"\n');
    fs.writeFileSync(path.join(REPO, "folder_paths.py"), "# stand-in\n");
    fs.writeFileSync(path.join(REPO, "requirements.txt"), "# nothing to fetch in the test (the real one lists torch, av, …)\n");
    fs.mkdirSync(path.join(REPO, "models")); fs.writeFileSync(path.join(REPO, "models", ".keep"), "");
    fs.writeFileSync(path.join(MGR, "__init__.py"), "# stand-in manager\n"); fs.writeFileSync(path.join(MGR, "requirements.txt"), "\n");
    for (const d of [REPO, MGR]) { git(["init", "-q", "-b", "master"], d); git(["add", "."], d); git(["commit", "-q", "-m", "x"], d); }
    const PORT = await freePort();
    process.env.H3_POD_JOB_BEAT = "1"; process.env.H3_POD_INSTALL_POLL = "300";
    const kernel = (c) => { const r = spawnSync("python3", ["-c", c], { cwd: CWD, encoding: "utf8", timeout: 40000 }); return r.stdout + (r.status ? " " + r.stderr : ""); };
    const read = () => { try { return JSON.parse(fs.readFileSync(path.join(CWD, ".bitgen_inst.json"), "utf8")); } catch { return null; } };
    const answers = async () => { try { const r = await fetch("http://127.0.0.1:" + PORT + "/system_stats", { signal: AbortSignal.timeout(2000) }); const j = await r.json(); return j; } catch { return null; } };
    let pids = [];
    try {
      // the job straight from podJob.detach, as the kernel runs it
      const said = kernel(PJ.detach(PI.installCode({ dir: DIR, port: PORT, repo: "file://" + REPO, manager: "file://" + MGR, load_s: 60 })));
      check("the pod's kernel starts the install as its own process and answers at once", /bitgen-inst-started/.test(said), said);
      const notes = new Set();
      let s = null;
      for (let i = 0; i < 300; i++) { await sleep(300); s = read(); if (s && s.state) notes.add(s.state.replace(/ - .*/, "")); if (s && !s.running) break; }
      pids.push((s || {}).comfy_pid);
      const st = {}; for (const x of (s && s.steps) || []) st[x.key] = x.state;
      check("the job ends done: found, downloaded (git clone), venv made, requirements installed, ComfyUI-Manager installed, started, loaded",
        s && s.state === "done" && s.running === false && JSON.stringify(st) === JSON.stringify({ find: "done", download: "done", venv: "done", pip: "done", manager: "done", start: "done", load: "done" }), s && { state: s.state, st, log: String(s.log).slice(-600) });
      check("…ComfyUI is in the folder (main.py), its venv reuses this Python's packages (include-system-site-packages = true), ComfyUI-Manager in custom_nodes",
        fs.existsSync(path.join(DIR, "main.py")) && /include-system-site-packages = true/.test(fs.readFileSync(path.join(DIR, "venv", "pyvenv.cfg"), "utf8")) && fs.existsSync(path.join(DIR, "custom_nodes", "ComfyUI-Manager", "__init__.py")));
      const sys = await answers();
      check("…ComfyUI answers on its port (started with the venv's Python) and the job says its version", sys && sys.system && sys.system.comfyui_version === "0.9.9" && s.version === "0.9.9" && /venv\/bin\/python$/.test(s.python), [sys, s && s.version, s && s.python]);
      check("…the find step says what the pod has (Python, free space)", /Python \d+\.\d+/.test(((s.steps || [])[0] || {}).note || "") && /GB free/.test(((s.steps || [])[0] || {}).note || ""), (s.steps || [])[0]);
      check("…the requirements are marked installed for this ComfyUI commit (.bitgen_pip_ok - lib/podComfyUpdate.js skips them too), bitGen's mark in the folder",
        fs.readFileSync(path.join(DIR, ".bitgen_pip_ok"), "utf8").trim() === git(["rev-parse", "HEAD"], DIR).stdout.trim() && JSON.parse(fs.readFileSync(path.join(DIR, ".bitgen_install.json"), "utf8")).by === "bitGen");
      check("…it said what it was doing as it went (its status file, step by step - here the quick first steps can pass between two looks)", notes.size >= 3 && [...notes].some((x) => /^loading ComfyUI/.test(x)), [...notes]);
      // the pod restarted: ComfyUI stopped - the same job skips everything and starts it again
      try { process.kill((s || {}).comfy_pid); } catch { /* gone */ }
      for (let i = 0; i < 75 && await answers(); i++) await sleep(200);
      kernel(PJ.detach(PI.installCode({ dir: DIR, port: PORT, repo: "file://" + REPO, manager: "file://" + MGR, load_s: 60 })));
      let s2 = null; for (let i = 0; i < 200; i++) { await sleep(300); s2 = read(); if (s2 && !s2.running && (s2.steps || []).length) break; }
      pids.push((s2 || {}).comfy_pid);
      const st2 = {}; for (const x of (s2 && s2.steps) || []) st2[x.key] = x.state + (x.note ? ":" + x.note : "");
      check("run again after a restart: download / venv / requirements / Manager skipped (already there), ComfyUI started and loaded again",
        s2 && s2.state === "done" && /^skipped:already there/.test(st2.download) && /^skipped:already there/.test(st2.venv) && /^skipped:already installed/.test(st2.pip) && /^skipped:already there/.test(st2.manager) && /^done/.test(st2.start) && /^done/.test(st2.load) && !!(await answers()), st2);
      // running already: nothing started twice
      kernel(PJ.detach(PI.installCode({ dir: DIR, port: PORT, repo: "file://" + REPO, manager: "file://" + MGR, load_s: 60 })));
      let s3 = null; for (let i = 0; i < 200; i++) { await sleep(300); s3 = read(); if (s3 && !s3.running && (s3.steps || []).length) break; }
      check("…and with ComfyUI already running: start + load skipped (not started twice)", s3 && s3.state === "done" && (s3.steps || []).find((x) => x.key === "start").note === "already running", s3 && s3.steps);
      // a repo that does not clone: the reason, in words
      const BAD = path.join(TMP, "workspace", "Other");
      kernel(PJ.detach(PI.installCode({ dir: BAD, port: PORT + 1, repo: "file://" + path.join(TMP, "nope"), manager: "", load_s: 5 })));
      let s4 = null; for (let i = 0; i < 100; i++) { await sleep(300); s4 = read(); if (s4 && !s4.running && (s4.steps || []).length) break; }
      check("a ComfyUI that cannot be downloaded: failed - downloading ComfyUI - git clone did not work - <git's own words>", s4 && /^failed: downloading ComfyUI - git clone did not work - fatal: /.test(s4.state) && (s4.steps.find((x) => x.key === "download") || {}).state === "failed", s4 && s4.state);

      // ---- bitGen's side: ensure() follows the job into the pod's activity (what the PODS docker shows)
      try { process.kill((s2 || {}).comfy_pid); } catch { /* gone */ }
      for (let i = 0; i < 75 && await answers(); i++) await sleep(200);
      fs.rmSync(path.join(DIR, ".bitgen_pip_ok"));   // a new ComfyUI commit: its requirements again
      PA.clear("podX772");
      let waysN = 0; const marks = [], recs = [], said2 = [];
      const deps = {
        ways: async () => { waysN++; if (waysN === 1) { const e = new Error("the pod's ComfyUI is not answering yet"); e.code = "not_answering"; e.status = 409; throw e; } return { pod_id: "podX772", jupyter: true, jupyter_saved: true, comfy_answers: false, jupyter_url: "x" }; },
        kernel: async (w, c) => kernel(c),
        read: async () => read(), at: async () => { const j = await answers(); return j ? { url: "http://127.0.0.1:" + PORT, j } : { url: "" }; },
        mark: (id, f) => marks.push([id, f]), record: (o) => recs.push(o), sleep,
      };
      // (the job's own dir comes from the pod's record - here the test's folder, put in the code the kernel runs)
      const realCode = PI.installCode; PI.installCode = (o) => realCode(Object.assign({}, o, { dir: DIR, repo: "file://" + REPO, manager: "file://" + MGR, load_s: 60 }));
      const r = await PI.ensure("podX772", PORT, (t) => said2.push(t), Object.assign({}, deps, { kernel: async (w, c) => kernel(c) }));
      PI.installCode = realCode;
      pids.push((read() || {}).comfy_pid);
      check("ensure(): waits for the pod's Jupyter, runs the job, waits for ComfyUI -> ok with its version; ComfyUI started (no new download)", r.ok === true && r.version === "0.9.9" && r.fresh === false && waysN >= 2, r);
      check("…the pod is marked: its ComfyUI is fine (no update after it), where it is; the time it took goes to 📊 Statistics as an install",
        marks.length === 1 && marks[0][1].comfy_ok === true && marks[0][1].comfy_dir === DIR && recs.length === 1 && recs[0].kind === "install" && recs[0].pod === "podX772" && (recs[0].phases.start || 0) > 0, [marks, recs]);
      const v = PA.view("podX772");
      check("…the PODS docker's list: nothing running now, the steps done (Waiting for Jupyter, Finding, Downloading skipped, Installing requirements …, Loading), the result last: ✓ ComfyUI 0.9.9 started",
        v && v.now.length === 0 && v.last && v.last.ok && /ComfyUI 0\.9\.9 started/.test(v.last.text) && v.done[0].result === true
        && ["Waiting", "Finding", "Downloading", "Installing", "Starting", "Loading"].every((vb) => v.done.some((x) => x.verb === vb)) && v.done.some((x) => x.verb === "Downloading" && x.state === "skipped"), v && v.done.map((x) => x.verb + ":" + x.state + ":" + x.text));
      check("…and said each step to the caller (the render's line / the pod's setup note) - the loading line from THIS start's log (not the last start's 'Starting server')", said2.some((t) => /waiting for the pod's Jupyter/.test(t)) && said2.some((t) => /^loading ComfyUI|^ComfyUI loaded/.test(t)) && !said2.some((t) => /Starting server/.test(t) && said2.indexOf(t) < said2.findIndex((x) => /Total VRAM/.test(x))), said2);
      // a second caller while it runs waits for the same run
      try { process.kill((read() || {}).comfy_pid); } catch { /* gone */ }
      for (let i = 0; i < 75 && await answers(); i++) await sleep(200);
      let kN = 0;
      PI.installCode = (o) => realCode(Object.assign({}, o, { dir: DIR, repo: "file://" + REPO, manager: "file://" + MGR, load_s: 60 }));
      const d2 = Object.assign({}, deps, { ways: async () => ({ pod_id: "podY772", jupyter: true, jupyter_saved: true, comfy_answers: false }), kernel: async (w, c) => { kN++; return kernel(c); } });
      const [a1, a2] = await Promise.all([PI.ensure("podY772", PORT, null, d2), (async () => { await sleep(150); return PI.ensure("podY772", PORT, null, d2); })()]);
      PI.installCode = realCode;
      pids.push((read() || {}).comfy_pid);
      check("two callers at once (the setup and a render): ONE install on the pod, both get its result", kN === 1 && a1.ok && a2.ok, { kN, a1, a2 });
      const r3 = await PI.ensure("podZ772", PORT, null, Object.assign({}, deps, { ways: async () => ({ pod_id: "podZ772", jupyter: true, comfy_answers: true, comfy_version: "0.9.9" }) }));
      check("ComfyUI answering already: nothing to do (already)", r3.ok && r3.already === true, r3);
      const r4 = await PI.ensure("podW772", PORT, null, Object.assign({}, deps, { ways: async () => ({ pod_id: "podW772", jupyter: false, jupyter_saved: false, comfy_answers: false }) }));
      check("no Jupyter password for the pod: said (bitGen installs through its Jupyter)", !r4.ok && /no password/.test(r4.why), r4);
    } finally {
      for (const p of pids) try { if (p) process.kill(p); } catch { /* gone */ }
      fs.rmSync(TMP, { recursive: true, force: true });
    }
  }
  console.log("\n" + pass + " passed, " + fail + " failed");
  console.log("RESULT: " + (fail ? "FAIL" : "PASS"));
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log("FAIL: " + (e && e.stack || e)); console.log("RESULT: FAIL"); process.exit(1); });
