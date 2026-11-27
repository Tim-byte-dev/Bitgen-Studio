// bitGen Studio — SETUP: the ComfyUI custom node packs (2.331.0).
//
// Tim: "comfyui nodes (if existing) if not existing install all the custom
// nodes used in this project". One list (lib/nodePacks.json). For a NEW
// ComfyUI every pack is installed; for an EXISTING one each pack is checked
// - by its folder name, or by any folder whose git remote is the same repo
// (people rename folders) - and only the missing ones are added. A pack is
// cloned with git (a GitHub zip when there is no git), then its
// requirements.txt goes into COMFYUI'S python and its install.py runs, the
// way ComfyUI-Manager installs a pack.
//
// 2.540.2 (Tim's first install from GitHub stopped after "Cloning into ...\bgsub-…\repo" - the first pack that
// lives in a SUBFOLDER of a bigger repo): a pack can never stop the setup now -
//   - git runs with no prompts (GIT_TERMINAL_PROMPT=0, GCM_INTERACTIVE=never), no background auto-pack (gc.auto=0,
//     which keeps .git files open while we delete them) and long paths on, and is stopped after CLONE_MS
//   - the temporary clone is removed with retries; a folder Windows will not let go of (read-only pack files, a virus
//     scanner holding them) is made writable and tried again, then left in %TEMP% with a warning - never a throw
//   - install() answers {ok:false, error} for anything that goes wrong, so the next pack still installs
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const X = require("./setupExec");
const unzip = require("./unzip");

const CLONE_MS = 15 * 60 * 1000;                    // one clone - ComfyUI itself is the biggest (~30 MB at --depth 1)

/** git with no prompts, no background gc, long paths (Windows) */
const GIT_ENV = (base) => Object.assign({}, base || process.env, { GIT_TERMINAL_PROMPT: "0", GCM_INTERACTIVE: "never" });
const cloneArgs = (url, dest) => ["-c", "gc.auto=0", "-c", "core.longpaths=true", "clone", "--depth", "1", url, dest];

/** Make every file under p writable (git's pack files are read-only on Windows). */
function writable(p) {
  try {
    const st = fs.lstatSync(p);
    if (st.isDirectory()) for (const n of fs.readdirSync(p)) writable(path.join(p, n));
    fs.chmodSync(p, st.isDirectory() ? 0o777 : 0o666);
  } catch { /* gone or locked */ }
}
/** Remove a folder; never throws -> true when it is gone. */
function safeRm(p, log) {
  if (!p || !fs.existsSync(p)) return true;
  for (let i = 0; i < 2; i++) {
    try { fs.rmSync(p, { recursive: true, force: true, maxRetries: 8, retryDelay: 250 }); return true; }
    catch (e) { if (i === 0) writable(p); else if (log) log(`[warn] could not remove ${p} (${e.code || e.message}) - it can be deleted by hand`, true); }
  }
  return false;
}

const LIST = JSON.parse(fs.readFileSync(path.join(__dirname, "nodePacks.json"), "utf8")).packs;

const norm = (u) => String(u || "").trim().toLowerCase().replace(/\.git$/, "").replace(/\/+$/, "")
  .replace(/^git@github\.com:/, "https://github.com/");

/** The git remote of a folder (reads .git/config - no git needed). */
function remoteOf(dir) {
  try {
    const cfg = fs.readFileSync(path.join(dir, ".git", "config"), "utf8");
    const m = /\[remote "origin"\][^[]*?url\s*=\s*(\S+)/.exec(cfg);
    return m ? norm(m[1]) : "";
  } catch { return ""; }
}

/** Every pack with present / where for a custom_nodes folder. */
function status(customNodes) {
  let names = [];
  try { names = fs.readdirSync(customNodes, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name); }
  catch { names = []; }
  const lower = new Map(names.map((n) => [n.toLowerCase(), n]));
  const remotes = new Map();
  for (const n of names) { const r = remoteOf(path.join(customNodes, n)); if (r) remotes.set(r, n); }
  return LIST.map((p) => {
    const byName = lower.get(p.folder.toLowerCase());
    const byRemote = remotes.get(norm(p.url));
    const where = byName || byRemote || "";
    // a pack installed DISABLED by the Manager (folder.disabled) is present but off
    const disabled = !where && lower.has((p.folder + ".disabled").toLowerCase());
    // 3.4.0: a bundled pack whose copy in custom_nodes is not bitGen's (an older Viggle Remake) counts as missing - Setup refreshes it
    const stale = !!(where && p.bundled && bundledStale(p, path.join(customNodes, where)));
    return { ...p, present: !!where && !stale, where, disabled, stale };
  });
}

/** The packs a custom_nodes folder still needs. */
function missing(customNodes) { return status(customNodes).filter((p) => !p.present); }

/** owner/repo of a GitHub URL. */
function ghRepo(url) {
  const m = /github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?\/?$/i.exec(String(url || ""));   // 2.594.0: a dot in the name (Ming-3.0-tts)
  return m ? { owner: m[1], repo: m[2] } : null;
}

/** Fetch a repo WITHOUT git: GitHub's zip of the default branch, extracted
 *  and its single top folder moved to `dest`. */
async function fetchZip(url, dest, log) {
  const gh = ghRepo(url);
  if (!gh) return { ok: false, error: `not a GitHub URL: ${url}` };
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bgpack-"));
  const zip = path.join(tmp, "repo.zip");
  const zurl = `https://codeload.github.com/${gh.owner}/${gh.repo}/zip/HEAD`;
  log(`downloading ${zurl} (no git on this machine)`, false);
  const r = await X.download(zurl, zip, {});
  if (!r.ok) { safeRm(tmp, log); return { ok: false, error: r.error }; }
  const out = path.join(tmp, "x");
  unzip.extract(zip, out);
  const tops = fs.readdirSync(out);
  const top = tops.length === 1 ? path.join(out, tops[0]) : out;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.cpSync(top, dest, { recursive: true });
  safeRm(tmp, log);                                   // 2.540.3: the zip path deletes safely too
  return { ok: true };
}

/** git clone --depth 1 (or the zip) into dest. */
async function fetchRepo(url, dest, ctx) {
  const log = ctx.log || (() => {});
  if (ctx.git) {
    const code = await X.run(ctx.git, cloneArgs(url, dest), { log, env: GIT_ENV(ctx.env), timeout: ctx.cloneTimeout || CLONE_MS });
    if (code === 0) return { ok: true, how: "git" };
    log(`git clone failed (${code === -2 ? "timed out" : code}) - trying the GitHub zip`, true);
    safeRm(dest, log);
  }
  try {
    const z = await fetchZip(url, dest, log);
    return z.ok ? { ok: true, how: "zip" } : z;
  } catch (e) { return { ok: false, error: `download failed: ${e.message || e}` }; }
}

/**
 * Install one pack into customNodes with ComfyUI's python.
 * ctx = {git, python, log, env}. -> {ok, error}
 */
async function install(pack, customNodes, ctx) {
  try { return await installPack(pack, customNodes, ctx); }
  catch (e) { (ctx.log || (() => {}))(`[warn] ${pack.folder}: ${e.message || e}`, true); return { ok: false, error: String(e.message || e) }; }
}
async function installPack(pack, customNodes, ctx) {
  const log = ctx.log || (() => {});
  const dest = path.join(customNodes, pack.folder);
  if (pack.bundled) return syncBundled(pack, customNodes, ctx);           // 3.4.0: a pack that ships inside bitGen
  if (fs.existsSync(dest)) { log(`[ok] ${pack.folder} already there`, false); return { ok: true, skipped: true }; }
  let r;
  if (pack.subdir) {
    // the pack is a folder INSIDE a bigger repo: fetch the repo aside, copy the folder
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bgsub-"));
    try {
      r = await fetchRepo(pack.url, path.join(tmp, "repo"), ctx);
      if (r.ok) {
        const src = path.join(tmp, "repo", ...pack.subdir.split("/"));
        if (!fs.existsSync(src)) r = { ok: false, error: `${pack.subdir} is not in ${pack.url}` };
        else { fs.cpSync(src, dest, { recursive: true }); log(`copied ${pack.subdir} -> ${dest}`, false); }
      }
    } finally { safeRm(tmp, log); }
  } else r = await fetchRepo(pack.url, dest, ctx);
  if (!r.ok) return { ok: false, error: r.error || "could not fetch" };
  const req = path.join(dest, "requirements.txt");
  if (ctx.python && fs.existsSync(req)) {
    const code = await X.run(ctx.python, ["-m", "pip", "install", "-r", req, "--progress-bar", "off"],
      { log, env: ctx.env, cwd: dest });
    if (code !== 0) return { ok: false, error: `pip install -r requirements.txt failed for ${pack.folder}` };
  }
  const inst = path.join(dest, "install.py");
  if (ctx.python && fs.existsSync(inst)) {
    const code = await X.run(ctx.python, [inst], { log, env: ctx.env, cwd: dest });
    if (code !== 0) log(`[warn] ${pack.folder}/install.py exited ${code} - the pack may still load`, true);
  }
  log(`[ok] ${pack.folder} installed (${r.how})`, false);
  return { ok: true };
}

/** 3.4.0: the files of a bundled pack (relative path -> Buffer), sorted (pure-ish: reads the folder) */
function filesOf(dir) {
  const out = {};
  const walk = (d, rel) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name === "__pycache__" || e.name.startsWith(".")) continue;
      const r = rel ? rel + "/" + e.name : e.name;
      if (e.isDirectory()) walk(path.join(d, e.name), r); else out[r] = fs.readFileSync(path.join(d, e.name));
    }
  };
  if (fs.existsSync(dir)) walk(dir, "");
  return out;
}
/** 3.4.0: a bundled pack's copy differs from bitGen's (pure-ish) */
function bundledStale(pack, dir, base) {
  try {
    const want = filesOf(path.join(base || require("./core").BASE, ...String(pack.bundled).split("/"))), have = filesOf(dir);
    return Object.keys(want).some((r) => !have[r] || !have[r].equals(want[r]));
  } catch { return false; }
}
/** 3.4.0: a pack bitGen ships (pack.bundled = its folder in the app, e.g. comfy_nodes/ComfyUI-Viggle-Remake) -> copied into
 *  custom_nodes; a copy already there with other contents is refreshed (bitGen's is the newer - Tim's updated node);
 *  ctx.base = the app folder (tests). -> {ok, error, skipped, updated} */
function syncBundled(pack, customNodes, ctx) {
  const log = (ctx && ctx.log) || (() => {});
  const base = (ctx && ctx.base) || require("./core").BASE;
  const src = path.join(base, ...String(pack.bundled).split("/")), dest = path.join(customNodes, pack.folder);
  const want = filesOf(src);
  if (!Object.keys(want).length) return { ok: false, error: `${pack.bundled} is not in this copy of bitGen - reinstall bitGen` };
  const have = filesOf(dest);
  const differ = Object.keys(want).filter((r) => !have[r] || !have[r].equals(want[r]));
  if (!differ.length) { log(`[ok] ${pack.folder} already there (bitGen's copy)`, false); return { ok: true, skipped: true }; }
  const was = fs.existsSync(dest);
  try {
    for (const r of differ) { const to = path.join(dest, ...r.split("/")); fs.mkdirSync(path.dirname(to), { recursive: true }); fs.writeFileSync(to, want[r]); }
    const pyc = path.join(dest, "__pycache__"); if (fs.existsSync(pyc)) safeRm(pyc, log);
  } catch (e) { return { ok: false, error: `could not write ${dest}: ${e.message || e}` }; }
  log(`[ok] ${pack.folder} ${was ? "updated to bitGen's copy (" + differ.join(", ") + ")" : "copied from bitGen"} - restart ComfyUI`, false);
  return { ok: true, updated: was };
}

/** The classes the workflows need -> the pack that provides each (the
 *  verification step's lookup). */
function packFor(cls) { return LIST.find((p) => (p.provides || []).includes(cls)) || null; }

module.exports = { syncBundled, filesOf, bundledStale, LIST, CLONE_MS, GIT_ENV, cloneArgs, safeRm, writable, norm, remoteOf, status, missing, ghRepo, fetchZip, fetchRepo, install, packFor };
