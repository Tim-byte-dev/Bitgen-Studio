// bitGen Studio — lib/comfyUpdate.js (2.573.0): ⤓ UPDATE ComfyUI (Settings ▸ ComfyUI ▸ Engine ▸ ⟳ ComfyUI updates).
//
// Tim: "add update comfyui button to comfyui tab in settings. do an autocheck on startup for latest version of bitgen
// and comfyui". The ComfyUI folder set in Settings ▸ ComfyUI is updated the way its own kind of install is:
//   PORTABLE  (python_embeded + ComfyUI\ + update\update.py - the Windows portable build): ComfyUI's own updater, run
//             exactly as update\update_comfyui.bat runs it (update.py ..\ComfyUI\ [--stable], then once more when it
//             updated itself) - it pulls and installs the new requirements itself.
//   GIT       (a clone - the bitGen setup's own install, or a manual one): git fetch; "newest" = master fast-forwarded,
//             "stable" = the newest v* release tag; then pip install -r requirements.txt with ComfyUI's own python.
//             Files you changed in ComfyUI's tracked files are stashed first (git stash pop brings them back).
//   other     (the ComfyUI desktop app, a zip without .git): refused with the way to update it.
// A ComfyUI that bitGen Studio started is stopped first and started again after; one started some other way must be
// closed first (its python holds the packages pip has to replace). Custom node packs are not touched.
//   where(o)       {ok, error, root, main, portable, python, git, updater, version}
//   check(o)       {current, latest (newest release), master (master's version), newer, behind, channel, mode, error}
//                  o.fetch false = no git fetch (the quiet startup look reads the version files only)
//   start(o)       one at a time; job(): {state running | done | error, lines[], from, to, restarted}
//   pure: parseVersion(text), channelOf(cfg)
"use strict";
const fs = require("fs");
const path = require("path");
const core = require("./core");
const X = require("./setupExec");

const REPO = "Comfy-Org/ComfyUI";
const CHANNELS = ["latest", "stable"];
const cmp = (a, b) => require("./updater").cmpVersion(a, b);

/** comfyui_version.py's text -> "0.42.0" | "" */
function parseVersion(text) {
  const m = /__version__\s*=\s*["']([^"']+)["']/.exec(String(text || ""));
  return m ? m[1].trim() : "";
}
/** the update channel from the config: "latest" (master - what update_comfyui.bat does) | "stable" (release tags) */
function channelOf(cfg) {
  const c = String((((cfg || {}).update || {}).comfy_channel) || "").trim();
  return CHANNELS.includes(c) ? c : "latest";
}
function gitBin() {
  try { const SR = require("./setupRun"); return X.which("git", SR.runtimeDirs()) || ""; } catch { return X.which("git") || ""; }
}
const GIT_ENV = () => Object.assign({}, process.env, { GIT_TERMINAL_PROMPT: "0", GCM_INTERACTIVE: "never" });

/** which ComfyUI, and how it was installed */
function where(o) {
  const opt = o || {};
  let dir = opt.dir;
  if (dir == null) { try { dir = require("./comfy").comfyCfg().dir; } catch { dir = ""; } }
  if (!dir) return { ok: false, error: "no ComfyUI folder is set - Settings ▸ ComfyUI ▸ ComfyUI folder" };
  const abs = core.resolvePath(String(dir));
  const I = require("./setupComfy").inspectDir(abs);
  if (!I.ok) return { ok: false, error: I.error };
  let py = I.python;
  if (!py) { try { py = require("./comfy").comfyPython().exe; } catch { py = ""; } }
  const upd = path.join(I.root, "update", "update.py");
  let version = "";
  try { version = parseVersion(fs.readFileSync(path.join(I.main, "comfyui_version.py"), "utf8")); } catch { version = ""; }
  return { ok: true, root: I.root, main: I.main, portable: !!I.portable, python: py || "", how: I.how || "",
           git: fs.existsSync(path.join(I.main, ".git")), updater: I.portable && fs.existsSync(upd) ? upd : "", version };
}
function modeOf(W) { return W.updater ? "portable" : W.git ? "git" : "other"; }

async function git(args, o) {
  const out = [];
  const code = await (o.run || X.run)(o.git || gitBin(), ["-c", "gc.auto=0", "-C", o.cwd].concat(args), { env: GIT_ENV(), timeout: o.timeout || 10 * 60000,
    log: (l, err) => { const c = /^> /.test(l); if (!err && !c) out.push(l); if (o.log && (o.echo || (err && !c))) o.log(l, err); } });
  return { code, out };
}

/** is a newer ComfyUI out? */
async function check(o) {
  const opt = o || {};
  const W = opt.where || where(opt);
  const channel = opt.channel && CHANNELS.includes(opt.channel) ? opt.channel : channelOf(core.getConfig());
  const res = { current: W.version || "", latest: "", master: "", newer: false, behind: 0, channel, mode: W.ok ? modeOf(W) : "", error: W.ok ? "" : W.error, dir: W.root || "" };
  if (!W.ok) return res;
  const get = opt.getJson || X.getJson;
  const rel = await get(`https://api.github.com/repos/${REPO}/releases/latest`, { "User-Agent": "bitGen-Studio", Accept: "application/vnd.github+json" });
  if (rel.status === 200 && rel.json && rel.json.tag_name) res.latest = String(rel.json.tag_name).replace(/^v/i, "");
  const raw = await get(`https://raw.githubusercontent.com/${REPO}/master/comfyui_version.py`, { "Cache-Control": "no-cache" });
  if (raw.status === 200) res.master = parseVersion(raw.body);
  if (!res.latest && !res.master) res.error = `could not reach GitHub (${rel.error || raw.error || "HTTP " + (rel.status || raw.status)})`;
  if (W.git && opt.fetch !== false && (opt.git || gitBin())) {
    const g = { cwd: W.main, run: opt.run, git: opt.git, timeout: 3 * 60000 };
    const f = await git(["fetch", "--quiet", "--tags", "origin"], g);
    if (f.code === 0) {
      const b = await git(["rev-list", "--count", "HEAD..origin/master"], g);
      res.behind = parseInt(b.out.join(" "), 10) || 0;
    } else if (!res.error) res.error = "git fetch failed - check the network";
  }
  const target = channel === "stable" ? res.latest : (res.master || res.latest);
  res.newer = (!!target && !!res.current && cmp(target, res.current) > 0) || (channel === "latest" && res.behind > 0);
  return res;
}

/* ---------------- the update */
let J = null;
function job() { return J; }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function updatePortable(ctx) {
  const { W, log, run, channel } = ctx;
  const cwd = path.dirname(W.updater);
  const args = (extra) => [W.updater, W.main + path.sep].concat(extra, channel === "stable" ? ["--stable"] : []);
  log(`[..] ComfyUI's own updater (update\\update.py${channel === "stable" ? " --stable" : ""}) - the portable build's update_comfyui.bat`, false);
  let c = await run(W.python, args([]), { cwd, log, env: Object.assign({}, process.env, { PYTHONUTF8: "1" }), timeout: 30 * 60000 });
  if (c !== 0) return { ok: false, error: `update.py exited with code ${c} - see the log` };
  const nu = path.join(cwd, "update_new.py");
  if (fs.existsSync(nu)) {
    try { fs.renameSync(nu, W.updater); } catch (e) { fs.copyFileSync(nu, W.updater); fs.unlinkSync(nu); }
    log("[..] the updater updated itself - running it again", false);
    c = await run(W.python, args(["--skip_self_update"]), { cwd, log, env: Object.assign({}, process.env, { PYTHONUTF8: "1" }), timeout: 30 * 60000 });
    if (c !== 0) return { ok: false, error: `update.py (second run) exited with code ${c} - see the log` };
  }
  return { ok: true };
}

async function updateGit(ctx) {
  const { W, log, channel } = ctx;
  if (!(ctx.git || gitBin())) return { ok: false, error: "git is not installed here - install Git, or update with ComfyUI-Manager ▸ Update ComfyUI" };
  const g = { cwd: W.main, run: ctx.run, git: ctx.git, log };
  const st = await git(["status", "--porcelain", "--untracked-files=no"], g);
  if (st.out.filter(Boolean).length) {
    log(`[warn] ${st.out.filter(Boolean).length} ComfyUI file(s) you changed are put aside first (git stash) - "git stash pop" in ${W.main} brings them back`, true);
    if ((await git(["stash", "push", "-m", "bitgen-studio update " + new Date().toISOString()], Object.assign({ echo: true }, g))).code !== 0) return { ok: false, error: "git stash failed - see the log" };
  }
  log("[..] fetching ComfyUI from GitHub", false);
  if ((await git(["fetch", "--tags", "origin"], Object.assign({ echo: true }, g))).code !== 0) return { ok: false, error: "git fetch failed - check the network" };
  if (channel === "stable") {
    const t = await git(["tag", "-l", "v*", "--sort=-v:refname"], g);
    const tag = (t.out.find((x) => /^v\d+\.\d+\.\d+$/.test(x.trim())) || "").trim();
    if (!tag) return { ok: false, error: "no release tag found - try the Newest channel" };
    log(`[..] the newest release: ${tag}`, false);
    if ((await git(["checkout", "--quiet", tag], Object.assign({ echo: true }, g))).code !== 0) return { ok: false, error: `git checkout ${tag} failed - see the log` };
  } else {
    const br = await git(["rev-parse", "--abbrev-ref", "HEAD"], g);
    const cur = (br.out[0] || "").trim();
    if (cur !== "master") {
      const has = await git(["rev-parse", "--verify", "--quiet", "refs/heads/master"], g);
      const co = has.code === 0 ? ["checkout", "--quiet", "master"] : ["checkout", "--quiet", "-b", "master", "origin/master"];
      if ((await git(co, Object.assign({ echo: true }, g))).code !== 0) return { ok: false, error: "git checkout master failed - see the log" };
    }
    const m = await git(["merge", "--ff-only", "origin/master"], Object.assign({ echo: true }, g));
    if (m.code !== 0) return { ok: false, error: "ComfyUI's master has commits of its own here and cannot fast-forward - update it with git yourself" };
  }
  const req = path.join(W.main, "requirements.txt");
  if (W.python && fs.existsSync(req)) {
    log("[..] ComfyUI's Python packages (pip install -r requirements.txt)", false);
    const c = await (ctx.run || X.run)(W.python, ["-s", "-m", "pip", "install", "-r", req, "--progress-bar", "off"], { cwd: W.main, log, timeout: 30 * 60000 });
    if (c !== 0) log("[warn] pip install -r requirements.txt did not finish - see above (ComfyUI may still start)", true);
  } else log("[warn] ComfyUI's python was not found - run pip install -r requirements.txt in its environment yourself", true);
  return { ok: true };
}

/** start the update -> {ok} | {error} */
function start(o) {
  const opt = o || {};
  if (J && J.state === "running") return { error: "a ComfyUI update is already running" };
  const W = opt.where || where(opt);
  if (!W.ok) return { error: W.error };
  const mode = modeOf(W);
  if (mode === "other") return { error: `${W.main} is not a git clone and has no update\\update.py - update it with ComfyUI-Manager ▸ Update ComfyUI (or the ComfyUI desktop app's own updater)` };
  const channel = opt.channel && CHANNELS.includes(opt.channel) ? opt.channel : channelOf(core.getConfig());
  J = { state: "running", lines: [], from: W.version, to: "", mode, channel, restarted: false, error: "", started: Date.now() };
  const me = J;
  const log = (l, err) => { me.lines.push((err ? "! " : "") + String(l)); if (me.lines.length > 4000) me.lines.splice(0, me.lines.length - 4000); };
  const C = opt.comfy || require("./comfy");
  const run = opt.run || X.run;
  (async () => {
    log(`[..] ComfyUI ${W.version || "(version unknown)"} in ${W.root} - ${mode === "portable" ? "the portable build" : "a git clone"}, channel: ${channel === "stable" ? "stable releases" : "newest (master)"}`, false);
    let was = false;
    const s = await C.status();
    if (s.reachable || s.managed) {
      if (!s.managed && !opt.force) throw new Error("ComfyUI is running but bitGen Studio did not start it - close its window first (its python holds the packages the update replaces), then update");
      if (s.managed) { log("[..] stopping ComfyUI (bitGen Studio started it - it starts again after)", false); C.stop(); was = true; await sleep(opt.settle != null ? opt.settle : 3000); }
    }
    const r = mode === "portable" ? await updatePortable({ W, log, run, channel }) : await updateGit({ W, log, run, git: opt.git, channel });
    if (!r.ok) throw new Error(r.error);
    me.to = where({ dir: W.root }).version || W.version;
    log(me.to && me.to !== me.from ? `[ok] ComfyUI ${me.from} -> ${me.to}` : `[ok] ComfyUI ${me.to || ""} is up to date with ${channel === "stable" ? "the newest release" : "master"}`, false);
    if (was) {
      log("[..] starting ComfyUI again", false);
      try { await C.start(); me.restarted = true; log("[ok] ComfyUI is starting (its console streams into the app console)", false); }
      catch (e) { log("[warn] could not start ComfyUI again: " + e.message + " - ▶ Start ComfyUI", true); }
    } else log("[ok] start ComfyUI (▶ Start ComfyUI) to use the new version", false);
    me.state = "done";
  })().catch((e) => { me.state = "error"; me.error = String((e && e.message) || e); log("[failed] " + me.error, true); });
  return { ok: true };
}

/** the channel setting -> the saved value */
function setChannel(ch) {
  if (!CHANNELS.includes(ch)) return { error: `channel is one of ${CHANNELS.join(", ")}` };
  const c = core.getConfig();
  c.update = Object.assign({}, c.update || {}, { comfy_channel: ch });
  core.setConfig(c);
  return { ok: true, channel: ch };
}

module.exports = { REPO, CHANNELS, parseVersion, channelOf, where, check, start, job, setChannel, updatePortable, updateGit, _reset: () => { J = null; } };
