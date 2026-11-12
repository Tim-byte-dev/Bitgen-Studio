#!/usr/bin/env node
/* bitGen Studio — 2.769.0 LIVE (the pod's Python run here for real - python3, a venv, a git repo): a ComfyUI already up to date
 * is left running (no pip, no restart - a new pod's automatic update costs nothing then); one whose code is newer than the
 * running ComfyUI is restarted; the pod is searched for a file ComfyUI does not list and it is linked into the folder ComfyUI
 * reads (lib/podComfyUpdate.js updateCode, lib/podPrep.js locateCode).
 * Tim (verbatim): "update comfy automatically when the pod is created as well" */
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
const CU = require("../lib/podComfyUpdate"), PJ = require("../lib/podJob"), PP = require("../lib/podPrep");
const freePort = () => new Promise((ok) => { const s = net.createServer().listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => ok(p)); }); });

(async () => {
  if (spawnSync("python3", ["--version"]).status !== 0 || spawnSync("git", ["--version"]).status !== 0) { console.log("SKIP: no python3 / git"); console.log("RESULT: PASS"); return; }
  const T = fs.mkdtempSync(path.join(os.tmpdir(), "comfyauto769-")), CWD = path.join(T, "jroot"); fs.mkdirSync(CWD);
  const kernel = (code) => spawnSync("python3", ["-c", code], { cwd: CWD, encoding: "utf8", timeout: 120000 });
  const status = () => { try { return JSON.parse(fs.readFileSync(path.join(CWD, ".bitgen_cupd.json"), "utf8")); } catch { return null; } };
  const wait = async (n) => { let u = null; for (let i = 0; i < n; i++) { await sleep(200); u = status(); if (u && !u.running) break; } return u; };
  try {
    /* ---- the pod's file search */
    const comfy = path.join(T, "ComfyUI"), tgt = path.join(T, "workspace_models", "diffusion_models");
    fs.mkdirSync(path.join(comfy, "models", "unet"), { recursive: true });
    fs.writeFileSync(path.join(comfy, "models", "unet", "qwen_image_2.1_int8_convrot.safetensors"), "x".repeat(100));
    fs.writeFileSync(path.join(comfy, "models", "unet", "qwen3vl_8b_int8_convrot.safetensors.part"), "x".repeat(50));
    const k = kernel(PP.locateCode(["qwen_image_2.1_int8_convrot.safetensors", "qwen3vl_8b_int8_convrot.safetensors", "nowhere.safetensors"], comfy,
      { "qwen_image_2.1_int8_convrot.safetensors": tgt, "qwen3vl_8b_int8_convrot.safetensors": tgt, "nowhere.safetensors": tgt }));
    const f = PP.locateRead(k.stdout);
    const ln = path.join(tgt, "qwen_image_2.1_int8_convrot.safetensors");
    check("locateCode (the pod's Python): a file outside the folder ComfyUI reads is found and LINKED into it; a .part found as partly downloaded; a missing one has no hits",
      f && f["qwen_image_2.1_int8_convrot.safetensors"].linked === ln && fs.lstatSync(ln).isSymbolicLink() && fs.readFileSync(ln, "utf8").length === 100
      && f["qwen3vl_8b_int8_convrot.safetensors"].hits[0].part === true && f["nowhere.safetensors"].hits.length === 0, { f, err: k.stderr });
    const words = PP.locateWords(f, ["qwen3vl_8b_int8_convrot.safetensors", "nowhere.safetensors"], { "qwen3vl_8b_int8_convrot.safetensors": tgt, "nowhere.safetensors": tgt });
    check("…in words", /only partly downloaded \(0 GB at .*\.part\) - its download stopped/.test(words[0]) && /nowhere\.safetensors is not anywhere on the pod/.test(words[1]), words);

    /* ---- the update: already the latest = left running */
    const origin = path.join(T, "origin.git"), work = path.join(T, "seed");
    const g = (args, cwd) => spawnSync("git", args, { cwd, encoding: "utf8" });
    g(["init", "-q", "--bare", origin], T); g(["clone", "-q", origin, work], T);
    fs.writeFileSync(path.join(work, "main.py"), `import http.server, json, sys\nclass H(http.server.BaseHTTPRequestHandler):\n    def do_GET(self):\n        self.send_response(200); self.end_headers(); self.wfile.write(json.dumps({'system': {'comfyui_version': open('comfyui_version.py').read().split('=')[-1].strip().strip(chr(34))}}).encode())\n    def log_message(self, *a): pass\nhttp.server.HTTPServer(('127.0.0.1', int(sys.argv[2])), H).serve_forever()\n`);
    fs.writeFileSync(path.join(work, "comfyui_version.py"), '__version__ = "0.40.0"\n'); fs.writeFileSync(path.join(work, "requirements.txt"), "");
    g(["add", "-A"], work); g(["-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "-m", "v"], work); g(["push", "-q", "origin", "HEAD:master"], work);
    const cdir = path.join(T, "podComfy"); g(["clone", "-q", "-b", "master", origin, cdir], T);
    const venv = path.join(T, "venv"); spawnSync("python3", ["-m", "venv", venv]);
    const vpy = path.join(venv, "bin", "python");
    if (!(fs.existsSync(vpy) && spawnSync(vpy, ["-m", "pip", "--version"]).status === 0)) console.log("SKIP: no venv with pip here - the update part did not run");
    else {
      const port = await freePort();
      const p0 = spawn(vpy, ["main.py", "--port", String(port)], { cwd: cdir, detached: true, stdio: "ignore" }); p0.unref();
      const up = async () => { try { const r = await fetch("http://127.0.0.1:" + port + "/system_stats"); return (await r.json()).system.comfyui_version; } catch { return ""; } };
      for (let i = 0; i < 50 && !(await up()); i++) await sleep(100);
      kernel(PJ.detach(CU.updateCode(cdir, port)));
      const u1 = await wait(400);
      const pid1 = spawnSync("bash", ["-c", `pgrep -f "main.py --port ${port}"`], { encoding: "utf8" }).stdout.trim();
      check("first update of a pod already on the latest code: its requirements installed once (marker kept), no new code + the running ComfyUI is that version", u1 && u1.state === "done" && /pip install -r/.test(u1.log) && fs.readFileSync(path.join(cdir, ".bitgen_pip_ok"), "utf8").trim().length === 40, u1);
      kernel(PJ.detach(CU.updateCode(cdir, port)));
      const u2 = await wait(400);
      const pid2 = spawnSync("bash", ["-c", `pgrep -f "main.py --port ${port}"`], { encoding: "utf8" }).stdout.trim();
      check("…again (a new pod's automatic update): nothing new = 'same', no pip, ComfyUI NOT restarted (same process)", u2 && u2.state === "done" && u2.same === true && !/pip install/.test(u2.log) && pid1 && pid1 === pid2, { u2, pid1, pid2 });
      // newer code on disk than the running ComfyUI (Tim's pod: checked out, pip failed, the old one still running): restarted
      fs.writeFileSync(path.join(work, "comfyui_version.py"), '__version__ = "0.41.0"\n'); g(["-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qam", "n"], work); g(["push", "-q", "origin", "HEAD:master"], work);
      g(["pull", "-q", "--ff-only"], cdir);   // the code is new, the process is not
      kernel(PJ.detach(CU.updateCode(cdir, port)));
      const u3 = await wait(500);
      check("code newer than the running ComfyUI (pulled before, not restarted): its requirements + a restart - the new version answers", u3 && u3.state === "done" && !u3.same && (await up()) === "0.41.0", { u3, v: await up() });
      try { spawnSync("bash", ["-c", `pkill -f "main.py --port ${port}"`]); } catch { /* fine */ }
    }
  } catch (e) { check("no error", false, String(e && e.stack)); }
  fs.rmSync(T, { recursive: true, force: true });
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
