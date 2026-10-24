#!/usr/bin/env node
/* bitGen Studio — 2.540.6: YuE2 when PyTorch has no FlashAttention (the Windows wheels).
 * Tim's song: "RuntimeError: USE_FLASH_ATTENTION was not enabled for build." from yue2/cuda_graph.py - GraphAR's
 * attention_backend="auto" picks FlashAttention because the op name exists, but the build lacks it.
 * scripts/yue2_run.py asks PyTorch (is_flash_attention_available) and gives GraphAR cuDNN (sdpa when cuDNN does not
 * fit); music_worker.py retries an attention failure with sdpa, then --backend torch-eager, and remembers what worked.
 * Stand-in torch / yue2 packages + a stand-in yue2 CLI, a real Python. */
"use strict";
const fs = require("fs"), os = require("os"), path = require("path");
const { spawnSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const py = ["python3", "python"].find((p) => { try { return spawnSync(p, ["--version"]).status === 0; } catch { return false; } });
const T = fs.mkdtempSync(path.join(os.tmpdir(), "ya5406-"));
const w = (f, s) => { fs.mkdirSync(path.dirname(path.join(T, f)), { recursive: true }); fs.writeFileSync(path.join(T, f), s); };
try {
  if (!py) { check("(no Python here - the checks did not run)", true); }
  else {
    // ---- the runner: a stand-in torch + yue2
    w("pk/torch/__init__.py", "from . import backends\n");
    w("pk/torch/backends/__init__.py", "from . import cuda\n");
    w("pk/torch/backends/cuda.py", "import os\ndef is_flash_attention_available():\n    return os.environ.get('FAKE_FLASH') == '1'\n");
    w("pk/huggingface_hub/__init__.py", ""); w("pk/huggingface_hub/file_download.py", "def are_symlinks_supported(d=None):\n    return True\n");
    w("pk/yue2/__init__.py", "");
    w("pk/yue2/cuda_graph.py", "import os\nclass GraphAR:\n    def __init__(self, model, prefixes, max_tokens, *, capture=True, attention_backend='auto', fuse_projections=False):\n"
      + "        if attention_backend == 'cudnn' and os.environ.get('FAKE_CUDNN_FIT') == '0':\n            raise ValueError('cuDNN attention requires a supported CUDA dtype/head dimension')\n        self.attention_backend = attention_backend\n");
    w("pk/yue2/cli.py", "import json, sys\ndef main(argv=None):\n    from .cuda_graph import GraphAR\n    g = GraphAR('m', [[1]], 8)\n    h = GraphAR('m', [[1]], 8, attention_backend='flash')\n"
      + "    print(json.dumps({'att': g.attention_backend, 'explicit': h.attention_backend, 'argv': argv}))\n    return 0\n");
    const run = (env) => { const r = spawnSync(py, [path.join(ROOT, "scripts", "yue2_run.py"), "generate", "--quiet"], { encoding: "utf8", env: Object.assign({}, process.env, { PYTHONPATH: path.join(T, "pk"), BITGEN_HF_SYMLINKS: "1" }, env) });
      let j = {}; try { j = JSON.parse(r.stdout.trim().split("\n").pop()); } catch { /* shown */ } return { j, err: r.stderr, status: r.status }; };
    let r = run({ FAKE_FLASH: "0" });
    check("no FlashAttention in this PyTorch -> GraphAR gets cuDNN (said in the log); an explicit attention_backend is left alone; the arguments pass through",
      r.j.att === "cudnn" && r.j.explicit === "flash" && /YuE2 attention: cudnn \(this PyTorch build has no FlashAttention\)/.test(r.err) && JSON.stringify(r.j.argv) === '["generate","--quiet"]', r);
    r = run({ FAKE_FLASH: "0", FAKE_CUDNN_FIT: "0" });
    check("…cuDNN does not fit the model -> PyTorch's SDPA (said)", r.j.att === "sdpa" && /using PyTorch's SDPA/.test(r.err), r);
    r = run({ FAKE_FLASH: "1" });
    check("FlashAttention really there -> the pipeline's own choice (auto), nothing said", r.j.att === "auto" && !/YuE2 attention/.test(r.err), r);
    r = run({ FAKE_FLASH: "1", BITGEN_YUE2_ATTN: "sdpa" });
    check("BITGEN_YUE2_ATTN=sdpa forces it", r.j.att === "sdpa" && /attention: sdpa \(BITGEN_YUE2_ATTN\)/.test(r.err), r);

    // ---- music_worker.py: the retries
    const app = path.join(T, "app"), bin = path.join(app, "yue2", ".venv", process.platform === "win32" ? "Scripts" : "bin");
    fs.mkdirSync(bin, { recursive: true });
    const cliPath = path.join(bin, process.platform === "win32" ? "yue2.exe" : "yue2");
    // the stand-in CLI: logs how it was run; fails like Tim's Windows PyTorch unless told sdpa / torch-eager
    fs.writeFileSync(cliPath, `#!${spawnSync(py, ["-c", "import sys;print(sys.executable)"], { encoding: "utf8" }).stdout.trim()}\n`
      + "import sys, os, json\na = sys.argv[1:]\nway = 'torch-eager' if '--backend' in a else os.environ.get('BITGEN_YUE2_ATTN', 'auto')\n"
      + "open(os.environ['FAKE_LOG'], 'a').write(way + '\\n')\nmode = os.environ.get('FAKE_MODE', '')\n"
      + "if mode == 'oom':\n    print('torch.OutOfMemoryError: CUDA out of memory'); sys.exit(1)\n"
      + "ok = {'flash': ('sdpa', 'torch-eager'), 'all': ('torch-eager',)}[mode]\n"
      + "if way not in ok:\n    print('RuntimeError: USE_FLASH_ATTENTION was not enabled for build.' if way == 'auto' else 'RuntimeError: No available kernel. Aborting execution.'); sys.exit(1)\n"
      + "req = json.load(open(a[a.index('--request') + 1], encoding='utf-8'))\nd = os.path.join(a[a.index('--output') + 1], req['id']); os.makedirs(d, exist_ok=True)\nopen(os.path.join(d, 'audio.flac'), 'wb').write(b'fLaC-test')\n");
    fs.chmodSync(cliPath, 0o755);
    const drv = path.join(T, "drv.py");
    fs.writeFileSync(drv, "import sys, json\nsys.path.insert(0, sys.argv[1]); sys.path.insert(0, sys.argv[1] + '/misc')\nimport music_worker as M\nout = sys.argv[3]\nimport os\nos.makedirs(out, exist_ok=True)\n"
      + "r = M.run_yue2({'prompt': '[verse]\\nla la'}, {'_app_dir': sys.argv[2]}, {'caption': 'pop'}, __import__('pathlib').Path(out), 'song', 1, 7)\nprint('PRODUCED ' + json.dumps(r))\n");
    const song = (mode, log) => { const r = spawnSync(py, [drv, ROOT, app, path.join(T, "out")], { encoding: "utf8", env: Object.assign({}, process.env, { FAKE_MODE: mode, FAKE_LOG: log }) });
      return { out: r.stdout + r.stderr, status: r.status, tried: fs.existsSync(log) ? fs.readFileSync(log, "utf8").trim().split("\n") : [] }; };
    const state = path.join(app, "yue2", "bitgen-attention.txt");
    let s = song("flash", path.join(T, "l1"));
    check("the FlashAttention error -> retried with sdpa (said), the song is made, sdpa remembered in yue2/bitgen-attention.txt",
      s.status === 0 && s.tried.join() === "auto,sdpa" && /cannot run that attention kernel - trying sdpa/.test(s.out) && /PRODUCED \[/.test(s.out) && fs.readFileSync(state, "utf8") === "sdpa", s);
    s = song("flash", path.join(T, "l2"));
    check("…the next song starts with sdpa (no failed first try)", s.status === 0 && s.tried.join() === "sdpa", s);
    fs.unlinkSync(state);
    s = song("all", path.join(T, "l3"));
    check("both CUDA-graph ways fail -> --backend torch-eager (remembered)", s.status === 0 && s.tried.join() === "auto,sdpa,torch-eager" && fs.readFileSync(state, "utf8") === "torch-eager", s);
    fs.unlinkSync(state);
    s = song("oom", path.join(T, "l4"));
    check("a different error (out of memory) is not retried - the honest failure with its last lines", s.status === 1 && s.tried.join() === "auto" && /YuE2 exited with code 1/.test(s.out) && /out of memory/.test(s.out), s);
  }
} catch (e) { check("crashed: " + (e.stack || e), false); }
finally { try { fs.rmSync(T, { recursive: true, force: true }); } catch { /* fine */ } }
console.log(`\n${pass} passed, ${fail} failed`);
console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
process.exit(fail ? 1 : 0);
