#!/usr/bin/env node
/* bitGen Studio — 2.540.6: YuE2 on Windows without symlink rights.
 * Tim's first YuE2 song: "OSError: [WinError 1314] A required privilege is not held by the client" from
 * huggingface_hub's os.symlink while it fetched m-a-p/YuE2-Vae. scripts/yue2_run.py runs the YuE2 CLI with the hub
 * told to copy instead (Windows; BITGEN_HF_SYMLINKS=0 anywhere) - checked here with a stand-in hub + yue2 package and
 * a real Python; music_worker.py launches it from the yue2 venv. */
"use strict";
const fs = require("fs"), os = require("os"), path = require("path");
const { spawnSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const py = ["python3", "python"].find((p) => { try { return spawnSync(p, ["--version"]).status === 0; } catch { return false; } });
const T = fs.mkdtempSync(path.join(os.tmpdir(), "yr5406-"));
try {
  if (!py) check("(no Python here - the runner checks did not run)", true);
  else {
    const w = (f, s) => { fs.mkdirSync(path.dirname(path.join(T, f)), { recursive: true }); fs.writeFileSync(path.join(T, f), s); };
    w("huggingface_hub/__init__.py", "");
    w("huggingface_hub/file_download.py", "_are_symlinks_supported_in_dir = {'C:/cache': True}\ndef are_symlinks_supported(cache_dir=None):\n    return True\n");
    w("yue2/__init__.py", "");
    w("yue2/cli.py", "import json, sys, os\ndef main(argv=None):\n    import huggingface_hub.file_download as fd\n    print(json.dumps({'argv': argv, 'symlinks': fd.are_symlinks_supported('x'), 'cache': fd._are_symlinks_supported_in_dir, 'warn': os.environ.get('HF_HUB_DISABLE_SYMLINKS_WARNING')}))\n    return 7\n");
    const run = (env) => spawnSync(py, [path.join(ROOT, "scripts", "yue2_run.py"), "generate", "--model", "m", "--request", "r.json"], { encoding: "utf8", env: Object.assign({}, process.env, { PYTHONPATH: T }, env) });
    const a = run({ BITGEN_HF_SYMLINKS: "0" });
    const ja = JSON.parse(a.stdout.trim().split("\n").pop() || "{}");
    check("symlinks off: the hub is told it cannot symlink (its per-folder answers cleared) BEFORE yue2's CLI runs; the arguments pass through; the CLI's exit code is the runner's; the hub's warning silenced",
      ja.symlinks === false && Object.keys(ja.cache || {}).length === 0 && JSON.stringify(ja.argv) === JSON.stringify(["generate", "--model", "m", "--request", "r.json"]) && a.status === 7 && ja.warn === "1" && /copied, not symlinked/.test(a.stderr), { ja, status: a.status, err: a.stderr });
    const b = run({ BITGEN_HF_SYMLINKS: "1" });
    const jb = JSON.parse(b.stdout.trim().split("\n").pop() || "{}");
    check("…BITGEN_HF_SYMLINKS=1 keeps the hub's own choice (and on Linux / macOS nothing changes by default)", jb.symlinks === true && b.status === 7, jb);
    if (process.platform !== "win32") { const c = run({}); check("…this OS (not Windows), no flag: untouched", JSON.parse(c.stdout.trim().split("\n").pop()).symlinks === true); }
  }
  const MW = fs.readFileSync(path.join(ROOT, "music_worker.py"), "utf8");
  check("music_worker.py: the venv's python runs scripts/yue2_run.py generate … (the plain yue2 CLI only when that python is missing)",
    /vpy = cli\.parent \/ \("python\.exe" if os\.name == "nt" else "python"\)/.test(MW) && /runner = Path\(__file__\)\.resolve\(\)\.parent \/ "scripts" \/ "yue2_run\.py"/.test(MW)
    && /head = \[str\(vpy\), str\(runner\)\] if vpy\.exists\(\) and runner\.exists\(\) else \[str\(cli\)\]/.test(MW) && /cmd = head \+ \["generate", "--model", model, "--request", str\(req_file\),/.test(MW));
} catch (e) { check("crashed: " + (e.stack || e), false); }
finally { try { fs.rmSync(T, { recursive: true, force: true }); } catch { /* fine */ } }
console.log(`\n${pass} passed, ${fail} failed`);
console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
process.exit(fail ? 1 : 0);
