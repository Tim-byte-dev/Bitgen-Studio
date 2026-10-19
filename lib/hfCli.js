"use strict";
/**
 * hfCli.js — THE HUGGING FACE CLI (`hf`) AS A DOWNLOADER (2.341.0).
 *
 * Tim: "add the hf cli to download direct from hf". The catalog's files
 * (lib/modelCatalog.json) can come down through Hugging Face's own command
 * line tool instead of the built-in HTTP downloader: `hf download <repo>
 * <file> --local-dir <dir>` (huggingface_hub >= 0.34; its Xet / parallel
 * transfer is faster on big files and it resumes by itself).
 *
 *   find(python, dirs)  the CLI to run: an `hf` next to the app's Python
 *                       (python/Scripts/hf.exe, venv/bin/hf) or on PATH,
 *                       else the Python module itself when huggingface_hub
 *                       is installed there -> {cmd, args, how} | null
 *   install(python)     pip install -U "huggingface_hub[hf_xet]" into that
 *                       Python (the plain package when the extra fails)
 *   version(python)     the installed huggingface_hub version, or ""
 *   download(m, dest)   one catalog entry: into <dest's folder>/.hf-<id>
 *                       (the CLI's own resumable staging), then MOVED to
 *                       dest; progress = the size of the file being written
 *
 * The token goes in HF_TOKEN (never on the command line, where it would show
 * in the log and the process list).
 */
const fs = require("fs");
const path = require("path");
const X = require("./setupExec");

const MIN_VERSION = [0, 34, 0];                  // `hf` replaced `huggingface-cli` here
const MODULE_ARGS = ["-c", "import sys; from huggingface_hub.cli.hf import main; sys.argv[0] = 'hf'; main()"];
const PROGRESS_RE = /(\d+%\|)|(\bit\/s\b)|(\d+(\.\d+)?[kMG]?B\/s)/;

function cmp(a, b) { for (let i = 0; i < 3; i++) { const d = (a[i] || 0) - (b[i] || 0); if (d) return d; } return 0; }
const parseVer = (v) => String(v || "").split(/[.+-]/).slice(0, 3).map((x) => parseInt(x, 10) || 0);

/** The installed huggingface_hub version in that Python, or "". */
async function version(python, env) {
  if (!python) return "";
  let out = "";
  const code = await X.run(python, ["-c", "import huggingface_hub; print(huggingface_hub.__version__)"],
    { env: env || process.env, log: (l, err) => { if (!err) out = l.trim(); } });
  return code === 0 ? out : "";
}

/** The hf executable beside a Python (embedded / venv / system layouts). */
function besidePython(python) {
  if (!python) return "";
  const d = path.dirname(python);
  const names = X.IS_WIN ? ["hf.exe", "hf.cmd"] : ["hf"];
  for (const dir of [d, path.join(d, "Scripts"), path.join(d, "bin")])
    for (const n of names) { const p = path.join(dir, n); try { if (fs.statSync(p).isFile()) return p; } catch { /* next */ } }
  return "";
}

/** -> {cmd, args, how} | null */
async function find(python, dirs, env) {
  const near = besidePython(python);
  if (near) return { cmd: near, args: [], how: near };
  const onPath = X.which("hf", dirs || []);
  if (onPath) return { cmd: onPath, args: [], how: onPath };
  const v = await version(python, env);
  if (v && cmp(parseVer(v), MIN_VERSION) >= 0) return { cmd: python, args: MODULE_ARGS.slice(), how: `${python} (huggingface_hub ${v})` };
  return null;
}

/** pip install the CLI into that Python. -> {ok, version, error} */
async function install(python, o) {
  const opts = o || {};
  const log = opts.log || (() => {});
  if (!python) return { ok: false, error: "no Python to install the Hugging Face CLI into" };
  let code = await X.run(python, ["-m", "pip", "install", "-U", "huggingface_hub[hf_xet]"], { log, env: opts.env });
  if (code !== 0) code = await X.run(python, ["-m", "pip", "install", "-U", "huggingface_hub"], { log, env: opts.env });
  if (code !== 0) return { ok: false, error: `pip could not install huggingface_hub (exit ${code})` };
  const v = await version(python, opts.env);
  return { ok: !!v, version: v, error: v ? "" : "huggingface_hub installed but will not import" };
}

/** The bytes written so far under a staging dir (the CLI's .incomplete + the file). */
function bytesIn(dir) {
  let n = 0;
  const walk = (d) => {
    let es = [];
    try { es = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of es) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else { try { n = Math.max(n, fs.statSync(p).size); } catch { /* gone */ } }
    }
  };
  walk(dir);
  return n;
}

/** The staging folder for one entry (same drive as dest, so the move is a rename). */
const stageFor = (m, dest) => path.join(path.dirname(dest), `.hf-${String(m.id || "file").replace(/[^a-z0-9_-]/gi, "")}`);

/**
 * Download one catalog entry with the CLI. o = {cli, token, log, onProgress,
 * env, size}. -> {ok, dest, error}
 */
async function download(m, dest, o) {
  const opts = o || {};
  const log = opts.log || (() => {});
  if (!opts.cli) return { ok: false, error: "the Hugging Face CLI is not installed" };
  const stage = stageFor(m, dest);
  fs.mkdirSync(stage, { recursive: true });
  const env = Object.assign({}, opts.env || process.env, { HF_HUB_DISABLE_TELEMETRY: "1", PYTHONIOENCODING: "utf-8" });
  if (opts.token) env.HF_TOKEN = String(opts.token).trim();
  const args = opts.cli.args.concat(["download", m.repo, m.file, "--local-dir", stage]);
  const timer = opts.onProgress ? setInterval(() => opts.onProgress({ got: bytesIn(stage), total: opts.size || m.size || 0 }), 700) : null;
  let code;
  try {
    code = await X.run(opts.cli.cmd, args, { env, log: (l, err) => { if (!PROGRESS_RE.test(l)) log(l, err); } });
  } finally { if (timer) clearInterval(timer); }
  const got = path.join(stage, ...String(m.file).split("/"));
  if (code !== 0 || !fs.existsSync(got)) {
    return { ok: false, error: code === 0 ? `hf finished but ${m.file} is not in ${stage}`
      : `hf download exited ${code}` + (opts.token ? "" : " - a gated repo needs a token (and its licence accepted)") };
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  try { fs.renameSync(got, dest); }
  catch { fs.copyFileSync(got, dest); fs.rmSync(got, { force: true }); }
  fs.rmSync(stage, { recursive: true, force: true });
  if (opts.onProgress) { const s = fs.statSync(dest).size; opts.onProgress({ got: s, total: s }); }
  log(`[ok] hf: ${m.repo}/${m.file} -> ${dest}`, false);
  return { ok: true, dest };
}

module.exports = { MIN_VERSION, MODULE_ARGS, version, besidePython, find, install, download, bytesIn, stageFor, parseVer, cmp };
