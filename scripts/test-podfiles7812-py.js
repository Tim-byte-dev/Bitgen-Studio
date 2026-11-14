#!/usr/bin/env node
/* bitGen Studio — 2.781.2: the pod's Python run for real with python3 on a stand-in ComfyUI folder: the model files listed (links,
 * unfinished downloads, hidden folders left out, the disk), deleted (a link only the link; a folder that leads outside models
 * refused), the GPU memory flag chosen (24 GB+, the ComfyUI knows it), and the render log's ComfyUI time + loading lines
 * (scripts/comfy_client.py load_report). Gate leg (child_process). */
"use strict";
const fs = require("fs"), path = require("path"), os = require("os"), cp = require("child_process");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const PF = require("../lib/podFiles"), PV = require("../lib/podVram");
const T = fs.mkdtempSync(path.join(os.tmpdir(), "pf7812py-")), C = path.join(T, "ComfyUI"), M = path.join(C, "models"), OUT = path.join(T, "outside");
const py = (code, env) => cp.spawnSync("python3", ["-c", code], { encoding: "utf8", env: Object.assign({}, process.env, env || {}) });
for (const d of ["checkpoints", "loras/flux krea", "diffusion_models", ".cache", "vae"]) fs.mkdirSync(path.join(M, d), { recursive: true });
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(M, "checkpoints", "krea2.safetensors"), Buffer.alloc(3000));
fs.writeFileSync(path.join(M, "loras/flux krea", "B.safetensors"), Buffer.alloc(200));
fs.writeFileSync(path.join(M, "vae", "half.safetensors.part"), Buffer.alloc(50));
fs.writeFileSync(path.join(M, "vae", "notes.txt"), "x");
fs.writeFileSync(path.join(M, ".cache", "hidden.safetensors"), "x");
fs.writeFileSync(path.join(OUT, "precious.safetensors"), "keep me");
fs.symlinkSync(path.join(M, "checkpoints", "krea2.safetensors"), path.join(M, "diffusion_models", "krea2.safetensors"));
fs.symlinkSync(OUT, path.join(M, "evil"));
let r = py(PF.LIST_PY(C)), j = JSON.parse((/bitgen-files (\{.*\})/.exec(r.stdout) || [])[1] || "{}");
const paths = (j.files || []).map((f) => f.path).sort();
check("list: model files at any depth, the link marked, the unfinished download marked, not .txt / hidden folders / a linked folder leading outside; the disk",
  JSON.stringify(paths) === JSON.stringify(["checkpoints/krea2.safetensors", "diffusion_models/krea2.safetensors", "loras/flux krea/B.safetensors", "vae/half.safetensors.part"])
  && j.files.find((f) => f.path === "diffusion_models/krea2.safetensors").link && j.files.find((f) => f.path === "vae/half.safetensors.part").partial && j.disk && j.disk.free > 0, { paths, err: r.stderr });
r = py(PF.DEL_PY(C, PF.cleanPaths(["diffusion_models/krea2.safetensors", "evil/precious.safetensors", "loras/flux krea/B.safetensors", "loras/none.bin", "checkpoints"])));
j = JSON.parse((/bitgen-deleted (\{.*\})/.exec(r.stdout) || [])[1] || "{}");
check("delete: the link goes and its target stays; a file through a folder leading outside models is refused; a missing one said",
  JSON.stringify(j.deleted) === JSON.stringify(["diffusion_models/krea2.safetensors", "loras/flux krea/B.safetensors"])
  && !fs.existsSync(path.join(M, "diffusion_models", "krea2.safetensors")) && fs.existsSync(path.join(M, "checkpoints", "krea2.safetensors"))
  && fs.existsSync(path.join(OUT, "precious.safetensors")) && j.failed.some((f) => f.path === "evil/precious.safetensors" && /not in the models/.test(f.why)) && j.failed.some((f) => f.path === "loras/none.bin" && /not on the pod/.test(f.why)), { j, err: r.stderr });
// the GPU memory flag
const BIN = path.join(T, "bin"); fs.mkdirSync(BIN);
const smi = (mib) => fs.writeFileSync(path.join(BIN, "nvidia-smi"), "#!/bin/sh\necho " + mib + "\n", { mode: 0o755 });
fs.mkdirSync(path.join(C, "comfy")); fs.writeFileSync(path.join(C, "comfy", "cli_args.py"), "parser.add_argument('--disable-dynamic-vram', action='store_true')\n");
const extra = (mode) => { const o = py("import os\n" + PV.PY.join("\n") + `\nimport json\nprint(json.dumps(comfy_extra(${JSON.stringify(C)}, ${JSON.stringify(mode)})))`, { PATH: BIN + ":" + process.env.PATH }); return o.stdout.trim() || o.stderr; };
smi("49140");
check("an A40 (48 GB) + a ComfyUI that knows the flag: --disable-dynamic-vram; Dynamic VRAM picked: nothing", extra("gpu") === '["--disable-dynamic-vram"]' && extra("dynamic") === "[]", [extra("gpu"), extra("dynamic")]);
smi("12288");
check("…a 12 GB card: nothing (Dynamic VRAM suits it)", extra("gpu") === "[]");
smi("49140"); fs.writeFileSync(path.join(C, "comfy", "cli_args.py"), "parser.add_argument('--lowvram')\n");
check("…a ComfyUI without the flag (older, or after it is removed): nothing - an unknown flag would stop it starting", extra("gpu") === "[]");
// the log report
const LR = py([
  "import sys; sys.path.insert(0, " + JSON.stringify(path.join(__dirname)) + ")",
  "import comfy_client as cc",
  "logs = [[{'t': '1', 'm': 'old line loaded completely 9 MB'}], [{'t': '1', 'm': 'old line loaded completely 9 MB'}, {'t': '2', 'm': 'Requested to load Krea2'}, {'t': '3', 'm': '\\x1b[32mloaded partially 4120.5 9000.1 0\\x1b[0m'}, {'t': '4', 'm': '100%|##| 15/15 [00:20<00:00, 1.33s/it]'}, {'t': '5', 'm': 'Prompt executed in 98.20 seconds'}]]",
  "cc._log_entries = lambda base, timeout=4: logs.pop(0)",
  "cc.mark_log('http://pod')",
  "cc.load_report('http://pod', {'status': {'messages': [['execution_start', {'timestamp': 1000}], ['execution_success', {'timestamp': 99200}]]}})",
].join("\n"));
check("the render's log says ComfyUI's own time and its NEW loading lines only (colours stripped, the progress bar left out)",
  /\[comfy\] ComfyUI ran it in 98\.2 s/.test(LR.stdout) && /\[comfy log\] Requested to load Krea2/.test(LR.stdout) && /\[comfy log\] loaded partially 4120\.5/.test(LR.stdout) && /Prompt executed in 98\.20/.test(LR.stdout) && !/old line/.test(LR.stdout) && !/15\/15/.test(LR.stdout) && !/\x1b/.test(LR.stdout), LR.stdout + LR.stderr);
const NR = py(["import sys; sys.path.insert(0, " + JSON.stringify(path.join(__dirname)) + ")", "import comfy_client as cc", "cc._log_entries = lambda base, timeout=4: None", "cc.mark_log('http://x')", "cc.load_report('http://x', {})", "print('quiet')"].join("\n"));
check("…a ComfyUI with no log endpoint (older / a stand-in): nothing said, nothing fails", NR.stdout.trim() === "quiet", NR.stdout + NR.stderr);
fs.rmSync(T, { recursive: true, force: true });
console.log(`\nRESULT: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
