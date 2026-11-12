#!/usr/bin/env node
/* bitGen Studio — 2.768.0: ComfyUI's update on the pod - the pip step uses ComfyUI's OWN Python even when the running ComfyUI
 * was started as a bare "python" (found on ComfyUI's PATH / venv / /proc/<pid>/exe), with ComfyUI's environment; a step
 * that raises says why (lib/podComfyUpdate.js pyof / run). The pod's Python runs here for real (python3, a venv, a git repo).
 * Tim (verbatim, the job's line): "✗ not updated: installing what the new ComfyUI needs (pip) - the pod's log ends: Reset
 * branch 'master' / branch 'master' set up to track 'origin/master'." */
"use strict";
const fs = require("fs"), os = require("os"), path = require("path"), net = require("net"), Module = require("module");
const { spawnSync, spawn } = require("child_process");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 1200))); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const coreP = require.resolve("../lib/core");
const fake = new Module(coreP); fake.filename = coreP; fake.loaded = true;
fake.exports = { getConfig: () => ({ rgpu: {} }), setConfig: () => {}, BASE: ROOT, STYLES_DIR: os.tmpdir() };
require.cache[coreP] = fake;
const CU = require("../lib/podComfyUpdate"), PJ = require("../lib/podJob");
const freePort = () => new Promise((ok) => { const s = net.createServer().listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => ok(p)); }); });

(async () => {
  const src = CU.updateCode("/ComfyUI", 8188);
  check("updateCode: pip with pyof(ComfyUI's process) and ComfyUI's environment; pip set up if missing; a step that raises is said",
    /py = pyof\(p\); env = dict\(p\[3\]\)/.test(src) && /'-m', 'pip', 'install', '-r', os\.path\.join\(c, 'requirements\.txt'\)\], cwd=c, env=env\)/.test(src) && /ensurepip/.test(src) && /def run\(\):\n    try: run0\(\)/.test(src));

  /* bitGen's side: a job that ended mid-step (Tim's line) says which step it stopped at */
  process.env.H3_POD_REVIVE_POLL = "1";
  const D = { kernel: async () => "bitgen-cupd-started", sleep: async () => {}, read: async () => ({ running: false, state: "installing what the new ComfyUI needs (pip)", log: "$ git checkout --force -B master origin/master\nReset branch 'master'\nbranch 'master' set up to track 'origin/master'." }), at: async () => ({ url: "" }) };
  const r = await CU.update({ pod_id: "p768", jupyter: true, comfy_dir: "/ComfyUI" }, 8188, null, Object.assign({ force: true }, D));
  check("…a job that stopped with no reason of its own: 'the update stopped while installing what the new ComfyUI needs (pip)' + the log's end", !r.ok && /^the update stopped while installing what the new ComfyUI needs \(pip\) - the pod's log ends: Reset branch/.test(r.why), r);

  if (spawnSync("python3", ["--version"]).status !== 0 || spawnSync("git", ["--version"]).status !== 0) { console.log("SKIP: no python3 / git"); }
  else {
    const T = fs.mkdtempSync(path.join(os.tmpdir(), "comfyupd768-")), CWD = path.join(T, "jroot"); fs.mkdirSync(CWD);
    const kernel = (code) => spawnSync("python3", ["-c", code], { cwd: CWD, encoding: "utf8", timeout: 60000, env: Object.assign({}, process.env, { PATH: "/usr/bin:/bin" }) });
    const status = (f) => { try { return JSON.parse(fs.readFileSync(path.join(CWD, f), "utf8")); } catch { return null; } };
    const wait = async (n) => { let u = null; for (let i = 0; i < n; i++) { await sleep(200); u = status(".bitgen_cupd.json"); if (u && !u.running) break; } return u; };
    /* a step that raises: said, not lost */
    const boom = CU.updateCode(path.join(T, "x"), 1).replace("    c = J['comfy']", "    S['state'] = 'installing what the new ComfyUI needs (pip)'; save(); raise FileNotFoundError(2, 'No such file or directory', 'python')\n    c = J['comfy']");
    kernel(PJ.detach(boom));
    const ub = await wait(60);
    check("a step that raises: 'failed: <the step> stopped - FileNotFoundError: …' (was: the job ended with the step's name only)", ub && /^failed: installing what the new ComfyUI needs \(pip\) stopped - FileNotFoundError: .*python/.test(ub.state) && !ub.running, ub);

    /* ComfyUI started as a bare "python" (venv on ComfyUI's PATH, not on the job's) - pip runs with the venv's Python */
    const origin = path.join(T, "origin.git"), work = path.join(T, "seed");
    const g = (args, cwd) => spawnSync("git", args, { cwd, encoding: "utf8" });
    g(["init", "-q", "--bare", origin], T); g(["clone", "-q", origin, work], T);
    fs.writeFileSync(path.join(work, "main.py"), `import http.server, json, sys\nclass H(http.server.BaseHTTPRequestHandler):\n    def do_GET(self):\n        self.send_response(200); self.end_headers(); self.wfile.write(json.dumps({'system': {'comfyui_version': open('VERSION').read().strip()}}).encode())\n    def log_message(self, *a): pass\nhttp.server.HTTPServer(('127.0.0.1', int(sys.argv[2])), H).serve_forever()\n`);
    fs.writeFileSync(path.join(work, "VERSION"), "0.30.0"); fs.writeFileSync(path.join(work, "requirements.txt"), "");
    g(["add", "-A"], work); g(["-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "-m", "old"], work); g(["push", "-q", "origin", "HEAD:master"], work);
    const cdir = path.join(T, "ComfyUI"); g(["clone", "-q", "-b", "master", origin, cdir], T);
    // the pod's checkout cannot fast-forward (Tim's log: "Reset branch 'master'") - a local commit of its own
    g(["-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "--allow-empty", "-m", "pod's own"], cdir);
    fs.writeFileSync(path.join(work, "VERSION"), "0.40.0"); g(["-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qam", "new"], work); g(["push", "-q", "origin", "HEAD:master"], work);
    const venv = path.join(T, "venv"); spawnSync("python3", ["-m", "venv", venv], { encoding: "utf8" });
    const vpy = path.join(venv, "bin", "python");
    if (!(fs.existsSync(vpy) && spawnSync(vpy, ["-m", "pip", "--version"]).status === 0)) console.log("SKIP: no venv with pip here");
    else {
      const port = await freePort();
      const p0 = spawn("python", ["main.py", "--port", String(port)], { cwd: cdir, detached: true, stdio: "ignore", env: Object.assign({}, process.env, { PATH: path.join(venv, "bin") + ":/usr/bin:/bin", VIRTUAL_ENV: venv }) }); p0.unref();
      const up = async () => { try { const r2 = await fetch("http://127.0.0.1:" + port + "/system_stats"); return (await r2.json()).system.comfyui_version; } catch { return ""; } };
      for (let i = 0; i < 50 && !(await up()); i++) await sleep(100);
      const v0 = await up();
      const k = kernel(PJ.detach(CU.updateCode(cdir, port)));
      const u = await wait(500);
      const v1 = await up();
      check("ComfyUI run as a bare 'python' from its venv (not on the job's PATH): pip with the venv's Python + ComfyUI's environment, ComfyUI restarted, the new version answers",
        /bitgen-cupd-started/.test(k.stdout) && v0 === "0.30.0" && u && u.state === "done" && v1 === "0.40.0" && u.python === vpy && u.log.includes(vpy + " -m pip install -r") && /checkout --force -B master origin\/master/.test(u.log), { v0, v1, u, out: k.stdout + k.stderr });
      try { spawnSync("bash", ["-c", `pkill -f "main.py --port ${port}"`]); } catch { /* fine */ }
    }
    fs.rmSync(T, { recursive: true, force: true });
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log("FAIL: crashed " + (e && e.stack)); console.log("RESULT: FAIL"); process.exit(1); });
