// bitGen Studio — lib/llamaEngine.js (2.596.0): Settings ▸ LLM ▸ the llama.cpp ENGINE - which build is installed, the
// newest one, and Install / ⟳ Update run right there with their progress.
//
// Tim: "add update llama in llm tab in settings. when updating, loading saving, onlclick show the action is being done".
//   info()          {dir, exe, installed, version ("b10456" - VERSION.txt, else llama-server --version), running}
//   latest(force)   the newest llama.cpp release with a build for this computer {tag, url, at} | {error} (GitHub; kept
//                   15 min - the API allows 60 calls an hour without a token)
//   newer(a, b)     is tag b newer than a ("b10456" < "b10601") - pure
//   start(action)   "install" | "update" -> {ok, job} | {error}: ONE job at a time. Update first stops the LLM server
//                   and the vision model (Windows locks a running llama-server.exe) and waits for them to go, then
//                   puts the newest build over the engine folder Settings ▸ LLM points at: Windows = misc\get-llama.ps1
//                   -Dest <folder> -Cuda 13|12 (what the driver supports - nvidia-smi), macOS / Linux = llama.cpp's own
//                   release zip (lib/setupLlama.js, force). The models and settings are not touched.
//   job()           {action, state running | done | error, lines[], error, started, finished, before, after}
// Routes: routes/llamaEngine.js. The page: static/llmtab.js (+ static/busy.js for every button's "doing it" state).
"use strict";
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const core = require("./core");
const X = require("./setupExec");

const API = () => (process.env.BITGEN_GH_API || "https://api.github.com").replace(/\/$/, "");
const WIN_ASSET = /^llama-b\d+-bin-win-cuda-\d+\.\d+-x64\.zip$/;
let LATEST = null;                     // {at, value}
let J = null;
let deps = {};                         // tests: {run, getJson, install, stopAll, cuda}

function num(tag) { const m = /^b(\d+)$/.exec(String(tag || "").trim()); return m ? Number(m[1]) : 0; }
function newer(a, b) { return num(b) > num(a); }

function versionOf(dir, exe) {
  try { const t = fs.readFileSync(path.join(dir, "VERSION.txt"), "utf8").trim().split(/\s+/)[0]; if (num(t)) return t; } catch { /* ask the exe */ }
  if (!fs.existsSync(exe)) return "";
  try {
    const r = spawnSync(exe, ["--version"], { encoding: "utf8", timeout: 10000, windowsHide: true });
    const m = /version:\s*(\d+)/i.exec(String(r.stdout || "") + String(r.stderr || ""));
    return m ? "b" + m[1] : "";
  } catch { return ""; }
}
function info() {
  const { eng, exe } = core.llmPaths();
  const st = core.llamaState() || {};
  const installed = fs.existsSync(exe);
  return { dir: eng, exe, installed, version: installed ? versionOf(eng, exe) : "", running: !!st.proc, file: st.file || "" };
}

function assetFor(rel) {
  const a = rel && Array.isArray(rel.assets) ? rel.assets : [];
  if (process.platform === "win32") return a.find((x) => WIN_ASSET.test(x.name)) || null;
  return require("./setupLlama").pickAsset(a, process.platform, process.arch);
}
async function latest(force) {
  if (!force && LATEST && Date.now() - LATEST.at < 15 * 60000) return LATEST.value;
  let value;
  try {
    const r = await (deps.getJson || X.getJson)(`${API()}/repos/ggml-org/llama.cpp/releases?per_page=15`, { "User-Agent": "bitgen-studio" });
    if (r.status !== 200 || !Array.isArray(r.json)) value = { error: `GitHub did not answer (${r.status || r.error || "no reply"}${r.json && r.json.message ? ": " + String(r.json.message).split(".")[0] : ""}) - try again later` };
    else {
      const rel = r.json.find((x) => num(x.tag_name) && assetFor(x));
      value = rel ? { tag: rel.tag_name, url: rel.html_url || "", at: rel.published_at || "" } : { error: "no llama.cpp build for this computer in the recent releases" };
    }
  } catch (e) { value = { error: String((e && e.message) || e) }; }
  LATEST = { at: Date.now(), value };
  return value;
}

/** the CUDA generation the driver supports (the worker's 2.104.1 rule): 13 unless nvidia-smi says CUDA 12.x */
function cudaOfDriver() {
  if (deps.cuda) return deps.cuda;
  try { const r = spawnSync("nvidia-smi", [], { encoding: "utf8", timeout: 15000, windowsHide: true }); const m = /CUDA Version:\s*(\d+)\./.exec(String(r.stdout || "")); return m && Number(m[1]) < 13 ? "12" : "13"; }
  catch { return "13"; }
}
/** stop the LLM server and the vision model, and wait until they are gone (Windows keeps a running exe locked) */
async function stopAll(log) {
  if (deps.stopAll) return deps.stopAll(log);
  const was = (core.llamaState() || {}).proc;
  if (was) { log("[..] stopping the LLM server (it starts again with the new engine when a model is next used)", false); core.stopLlama(); }
  try { const c = require("./captioner"); if (c.state().proc) { log("[..] stopping the vision model", false); c.stop(); } } catch { /* none */ }
  for (let i = 0; i < 40; i++) {
    let capUp = false; try { capUp = !!require("./captioner").state().proc; } catch { capUp = false; }
    if (!(core.llamaState() || {}).proc && !capUp) break;
    await new Promise((r) => setTimeout(r, 250));
  }
  if (was) await new Promise((r) => setTimeout(r, 1500));      // the exe's file lock goes a moment after the process
}

function job() { return J; }
function start(action) {
  const act = action === "update" ? "update" : "install";
  if (J && J.state === "running") return { error: `llama.cpp is already being ${J.action === "update" ? "updated" : "installed"} - one at a time` };
  const before = info();
  if (act === "install" && before.installed) return { error: `llama.cpp is already installed (${before.version || "version unknown"}) - use ⟳ Update llama.cpp` };
  J = { action: act, state: "running", lines: [], error: "", started: Date.now(), finished: 0, before: before.version, after: "" };
  const me = J;
  const log = (line, err) => { me.lines.push((err ? "! " : "") + String(line)); if (me.lines.length > 3000) me.lines.splice(0, me.lines.length - 3000); };
  (async () => {
    log(`[..] ${act === "update" ? "updating" : "installing"} llama.cpp in ${before.dir}${before.version ? " (now " + before.version + ")" : ""}`, false);
    if (act === "update") await stopAll(log);
    const SR = (() => { try { return require("./setupRun"); } catch { return null; } })();
    const env = SR ? SR.env() : process.env;
    const r = await (deps.install || require("./setupLlama").install)(core.BASE, { log, env, dest: before.dir, force: act === "update", cuda: process.platform === "win32" ? cudaOfDriver() : "", run: deps.run });
    if (!r || !r.ok) throw new Error((r && r.error) || "the install stopped");
    const after = info();
    me.after = after.version;
    if (!after.installed) throw new Error(`llama-server is not in ${before.dir} after the ${act}`);
    log(`[ok] llama.cpp ${after.version || ""} is in ${before.dir}${act === "update" && before.version && before.version === after.version ? " (it was already the newest)" : ""} - pick a model and ▶ Start server`, false);
    LATEST = null;
    return true;
  })().then(() => { me.state = "done"; me.finished = Date.now(); }, (e) => { me.state = "error"; me.error = String((e && e.message) || e); me.finished = Date.now(); log("[failed] " + me.error, true); });
  return { ok: true, job: J };
}

module.exports = { info, latest, newer, num, start, job, versionOf, cudaOfDriver, WIN_ASSET,
  _set: (d) => { deps = d || {}; }, _reset: () => { J = null; LATEST = null; deps = {}; } };
