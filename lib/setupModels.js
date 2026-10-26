// bitGen Studio — SETUP: the models from Hugging Face (2.331.0).
//
// Tim: "after installing all the packages offer a list of models that can be
// downloaded from HF that we use in this project, before the list have an
// input for hf token. if no hf token only download non-gated models."
//
// The list is lib/modelCatalog.json. Nothing about a repo is assumed at run
// time: inspect() asks Hugging Face LIVE for each repo's gate and file sizes
// (a file that is not there says so instead of failing half an hour in),
// and - with a token - whether THIS account may download a gated file (the
// licence must have been accepted on the model page). No token = gated rows
// cannot be ticked. Downloads resume (lib/setupExec.download) and land where
// the workflows look: ComfyUI's models/<folder>, the app's llm-models /
// qwen3vl, or the Hugging Face cache for OmniVoice.
"use strict";
const fs = require("fs");
const path = require("path");
const X = require("./setupExec");
const HFC = require("./hfCli");
const Force = require("./reinstallForce");   // 2.601.0: ⟳ Reinstall / ⟳ Download again = fetch it again            // 2.341.0: the Hugging Face CLI as a downloader
const ENGINES = ["auto", "hf", "builtin"];   // auto = hf when it is installed, else built-in

const CATALOG = JSON.parse(fs.readFileSync(path.join(__dirname, "modelCatalog.json"), "utf8"));
const HF = () => (process.env.BITGEN_HF_BASE || "https://huggingface.co").replace(/\/$/, "");

const byId = (id) => CATALOG.models.find((m) => m.id === id) || null;
const auth = (token) => (token ? { Authorization: `Bearer ${String(token).trim()}` } : {});
const enc = (p) => String(p).split("/").map(encodeURIComponent).join("/");

/** Is this token good? -> {ok, name} / {ok:false, error} */
async function checkToken(token) {
  const t = String(token || "").trim();
  if (!t) return { ok: false, error: "no token" };
  const r = await X.getJson(`${HF()}/api/whoami-v2`, auth(t));
  if (r.status === 200 && r.json) return { ok: true, name: r.json.name || r.json.fullname || "your account" };
  if (r.status === 401) return { ok: false, error: "Hugging Face does not accept this token (401) - copy it again from huggingface.co/settings/tokens" };
  return { ok: false, error: r.status ? `Hugging Face answered ${r.status}` : `no connection to Hugging Face (${r.error || "offline?"})` };
}

/** Where an entry lands. paths = {comfyModels, app}. */
function destPath(m, paths) {
  if (m.dest === "hf-cache") return "";
  const [root, ...rest] = m.dest.split("/");
  // 2.593.0: "comfynodes/..." = ComfyUI's custom_nodes (the ControlNet preprocessors keep their models in
  // comfyui_controlnet_aux/ckpts/<repo>/) - paths.comfyNodes, else the folder beside ComfyUI's models
  const base = root === "comfy" ? paths.comfyModels
    : root === "comfynodes" ? (paths.comfyNodes || (paths.comfyModels ? path.join(path.dirname(paths.comfyModels), "custom_nodes") : ""))
    : paths.app;
  if (!base) return "";
  return path.join(base, ...rest, m.as || path.basename(m.file));
}

/** Already on disk (whole: a .part does not count). */
function present(m, paths, liveSize) {
  const p = destPath(m, paths);
  if (!p) return false;
  try {
    const st = fs.statSync(p);
    return st.size > 0 && (!liveSize || st.size === liveSize);
  } catch { return false; }
}

/**
 * Ask Hugging Face about every entry (one info + one tree call per repo).
 * -> [{...entry, gated, size, available, why, present}]
 *    gated: false | "auto" | "manual"; available: may be downloaded now.
 */
async function inspect(entries, token, paths) {
  const list = (entries || CATALOG.models).slice();
  const repos = [...new Set(list.map((m) => m.repo))];
  const info = {};
  await Promise.all(repos.map(async (repo) => {
    const i = await X.getJson(`${HF()}/api/models/${repo}`, auth(token));
    const t = await X.getJson(`${HF()}/api/models/${repo}/tree/main?recursive=1`, auth(token));
    const sizes = {};
    for (const f of Array.isArray(t.json) ? t.json : []) if (f && f.type === "file") sizes[f.path] = (f.lfs && f.lfs.size) || f.size || 0;
    info[repo] = { status: i.status, gated: i.json ? i.json.gated || false : null, used: i.json ? i.json.usedStorage || 0 : 0,
                   tree: t.status === 200, sizes, error: i.error };
  }));
  const out = [];
  for (const m of list) {
    const r = info[m.repo] || {};
    const row = { ...m, gated: r.gated == null ? false : r.gated, size: m.size, available: true, why: "" };
    if (!r.status) { row.available = false; row.why = `no connection to Hugging Face (${r.error || "offline?"})`; }
    else if (r.status === 404) { row.available = false; row.why = `${m.repo} is not on Hugging Face (moved or private)`; }
    else if (r.status === 401 && !token) { row.gated = "auto"; }
    if (row.available && m.file) {
      if (r.tree && !(m.file in r.sizes)) { row.available = false; row.why = `${m.file} is no longer in ${m.repo}`; }
      else if (r.sizes[m.file]) row.size = r.sizes[m.file];
    } else if (row.available && !m.file && r.used) row.size = r.used;
    if (row.available && row.gated && !token) { row.available = false; row.why = "gated - needs a Hugging Face token (and the licence accepted on its page)"; }
    else if (row.available && row.gated && token && m.file) {
      // may THIS account download it? (a 1-byte ranged GET, no body kept)
      try {
        const a = await X.open(`${HF()}/${m.repo}/resolve/main/${enc(m.file)}`, Object.assign({ Range: "bytes=0-0" }, auth(token)));
        a.res.resume();
        if (a.status === 401 || a.status === 403) {
          row.available = false;
          row.why = `your account has not accepted this licence yet - open huggingface.co/${m.repo}, agree, then Refresh`;
        }
      } catch (e) { row.available = false; row.why = e.message; }
    }
    row.present = paths ? present(m, paths, m.file && row.available ? row.size : 0) : false;
    out.push(row);
  }
  return out;
}

/** Download one entry. o = {token, paths, python, onProgress, log, env}. */
async function download(m, o) {
  const log = o.log || (() => {});
  const forced = !!o.force || Force.on();                 // 2.601.0: a reinstall fetches a file that is already there
  if (m.dest === "hf-cache") {
    // a SNAPSHOT into the Hugging Face cache, where the engine reads it on
    // first use (OmniVoice: k2-fsa/OmniVoice) - through huggingface_hub, so
    // the cache layout is exactly the library's own
    if (!o.python) return { ok: false, error: "no python for the Hugging Face cache download" };
    const code = await X.run(o.python, ["-c",
      "import os,sys\nfrom huggingface_hub import snapshot_download\n"
      + "p=snapshot_download(sys.argv[1], token=(os.environ.get('HF_TOKEN') or None), force_download=(sys.argv[2:3]==['1']))\nprint('cached in', p)",
      m.repo, forced ? "1" : "0"], { log, env: Object.assign({}, o.env || process.env, o.token ? { HF_TOKEN: o.token } : {}) });
    return code === 0 ? { ok: true } : { ok: false, error: `snapshot of ${m.repo} failed (exit ${code})` };
  }
  const dest = destPath(m, o.paths);
  if (forced && fs.existsSync(dest)) log(`[..] ${path.basename(dest)} is there - downloading it again (reinstall)`, false);
  if (!forced && present(m, o.paths, m.size && m.available ? m.size : 0)) { log(`[ok] ${path.basename(dest)} already downloaded`, false); return { ok: true, skipped: true, dest }; }
  // 2.341.0: through the Hugging Face CLI (`hf download`) - o.engine "hf",
  // or "auto" when it is installed; the built-in downloader otherwise (and
  // for a test server: BITGEN_HF_BASE is not huggingface.co)
  const engine = ENGINES.includes(o.engine) ? o.engine : "auto";
  if (engine === "hf" || (engine === "auto" && !process.env.BITGEN_HF_BASE)) {   // a test server (BITGEN_HF_BASE) = built-in unless hf is asked for
    const cli = o.cli !== undefined ? o.cli : await HFC.find(o.python, o.dirs, o.env);
    if (cli) {
      log(`downloading ${m.repo}/${m.file} with the Hugging Face CLI (${cli.how})`, false);
      return HFC.download(m, dest, { cli, token: o.token, log, onProgress: o.onProgress, env: o.env, size: m.size });
    }
    if (engine === "hf") log("the Hugging Face CLI is not installed - using the built-in downloader (Install hf CLI adds it)", true);
  }
  const url = `${HF()}/${m.repo}/resolve/main/${enc(m.file)}`;
  log(`downloading ${m.repo}/${m.file} -> ${dest}`, false);
  const r = await X.download(url, dest, { headers: auth(o.token), size: m.size, onProgress: o.onProgress });
  if (!r.ok) {
    const why = r.status === 401 || r.status === 403
      ? "Hugging Face refused it - it is gated: add a token and accept the licence on the model page"
      : r.error || "failed";
    return { ok: false, error: why };
  }
  return { ok: true, dest, resumed: r.resumed };
}

/** What a finished download changes in Settings (the LLM the prompt dock
 *  loads, the vision model + its projector). */
function settingsFor(done, paths) {
  const patch = {};
  const llm = done.filter((m) => m.llm);
  if (llm.length) {
    const best = llm.sort((a, b) => (b.size || 0) - (a.size || 0))[0];
    patch.llm = { last_file: path.basename(best.file) };
  }
  const vm = done.find((m) => m.vision === "model"), vp = done.find((m) => m.vision === "mmproj");
  if (vm && vp) patch.captioner = { model: destPath(vm, paths), mmproj: destPath(vp, paths), dir: path.dirname(destPath(vm, paths)) };
  return patch;
}

module.exports = { ENGINES, CATALOG, HF, byId, checkToken, destPath, present, inspect, download, settingsFor };
