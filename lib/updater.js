// bitGen Studio — lib/updater.js (2.540.5): ⟳ UPDATE bitGen Studio FROM GITHUB (Settings ▸ General ▸ Updates).
//
// Tim: "add an update button to update bitgen from github". Two kinds of install:
//   GIT    the folder is a clone (Tim's D:\Bitgen-Studio from the repo): fetch, then the branch is moved to GitHub's
//          (reset --hard origin/<branch>) - after a COPY of every tracked file you changed goes to
//          backups/update-<time>/, and your own files the app writes (quick_prompts.json) are put back after. A folder
//          with commits of its own (a developer's repo, ahead of GitHub) is refused - git is for that.
//   ZIP    installed from the full zip (no .git): GitHub's zip of the branch, its files copied over the app's; your
//          projects, settings, models, venvs, ComfyUI are not in the repo so they are never touched; files the repo
//          deleted stay (harmless).
//   Then, when they changed: npm install (package-lock.json), pip install -r requirements.txt (the app's Python).
//   A restart finishes it (Electron: ⟳ Restart now; a browser: close the window running start.bat and start again).
//
//   info()               {version, mode, repo, branch, dir}
//   check()              {current, latest, newer, behind, commits[], mode, error}
//   start() / job()      one update at a time; job {state running | done | error, lines[], from, to, restart}
//   pure: cmpVersion(a, b), repoOf(url), USER_FILES
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const core = require("./core");
const X = require("./setupExec");

const DEFAULT_REPO = "Tim-byte-dev/bitgen-studio", DEFAULT_BRANCH = "main";
// files the app WRITES that the repo also carries - kept as they are on this machine
const USER_FILES = ["quick_prompts.json"];
const BASE = () => core.BASE;

/** "2.540.4" vs "2.540.10" -> -1 / 0 / 1 */
function cmpVersion(a, b) {
  const pa = String(a || "0").split(/[.+-]/).map((x) => parseInt(x, 10) || 0), pb = String(b || "0").split(/[.+-]/).map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length, 3); i++) { const d = (pa[i] || 0) - (pb[i] || 0); if (d) return d < 0 ? -1 : 1; }
  return 0;
}
/** a GitHub remote URL -> "owner/repo" | "" */
function repoOf(url) {
  const m = /github\.com[/:]([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/i.exec(String(url || "").trim());
  return m ? `${m[1]}/${m[2]}` : "";
}
function localVersion(base) { try { return JSON.parse(fs.readFileSync(path.join(base || BASE(), "package.json"), "utf8")).version || ""; } catch { return ""; } }
function cfg() { const u = (core.getConfig() || {}).update || {}; return { repo: String(u.repo || "").trim(), branch: String(u.branch || "").trim() }; }
function gitBin() {
  try { const SR = require("./setupRun"); return X.which("git", SR.runtimeDirs()) || ""; } catch { return X.which("git") || ""; }
}
const GIT_ENV = () => Object.assign({}, process.env, { GIT_TERMINAL_PROMPT: "0", GCM_INTERACTIVE: "never" });

/** run git and collect its stdout lines -> {code, out[]} */
async function git(args, opts) {
  const o = opts || {}, out = [];
  const code = await (o.run || X.run)(o.git || gitBin(), ["-c", "gc.auto=0"].concat(args), { cwd: o.cwd || BASE(), env: GIT_ENV(), timeout: o.timeout || 10 * 60000,
    log: (l, err) => { const cmd = /^> /.test(l); if (!err && !cmd) out.push(l); if (o.log && (o.echo || (err && !cmd))) o.log(l, err); } });
  return { code, out };
}

/** what this install is */
function info(base) {
  const b = base || BASE();
  const isGit = fs.existsSync(path.join(b, ".git"));
  const c = cfg();
  let repo = c.repo || "", branch = c.branch || "";
  if (isGit) {
    try {
      const conf = fs.readFileSync(path.join(b, ".git", "config"), "utf8");
      const m = /\[remote "origin"\][^[]*?url\s*=\s*(\S+)/.exec(conf);
      if (m && !repo) repo = repoOf(m[1]);
      const head = fs.readFileSync(path.join(b, ".git", "HEAD"), "utf8").trim();
      const hb = /^ref: refs\/heads\/(.+)$/.exec(head);
      if (hb && !branch) branch = hb[1];
    } catch { /* fall back */ }
  }
  return { version: localVersion(b), mode: isGit ? "git" : "zip", repo: repo || DEFAULT_REPO, branch: branch || DEFAULT_BRANCH, dir: b, git: isGit ? !!gitBin() : null };
}

/** is there something newer on GitHub? */
async function check(opts) {
  const o = opts || {};
  const I = info(o.base);
  const res = { current: I.version, latest: "", newer: false, behind: 0, ahead: 0, commits: [], mode: I.mode, repo: I.repo, branch: I.branch, error: "" };
  const get = o.getJson || X.getJson;
  const r = await get(`https://raw.githubusercontent.com/${I.repo}/${I.branch}/package.json`, { "Cache-Control": "no-cache" });
  if (r.status === 200 && r.json && r.json.version) res.latest = String(r.json.version);
  else res.error = r.status === 404 ? `${I.repo} (${I.branch}) has no package.json on GitHub - is the repo public and the branch right?` : `could not reach GitHub (${r.error || "HTTP " + r.status})`;
  if (I.mode === "git" && (o.git || gitBin())) {
    const f = await git(["fetch", "--quiet", "origin", I.branch], { cwd: I.dir, run: o.run, git: o.git });
    if (f.code === 0) {
      const b = await git(["rev-list", "--left-right", "--count", `HEAD...origin/${I.branch}`], { cwd: I.dir, run: o.run, git: o.git });
      const m = /(\d+)\s+(\d+)/.exec(b.out.join(" "));
      if (m) { res.ahead = +m[1]; res.behind = +m[2]; }
      const lg = await git(["log", "--oneline", "--no-decorate", "-n", "30", `HEAD..origin/${I.branch}`], { cwd: I.dir, run: o.run, git: o.git });
      res.commits = lg.out.filter(Boolean);
    } else if (!res.error) res.error = "git fetch failed - check the network";
  }
  res.newer = res.latest ? cmpVersion(res.latest, res.current) > 0 || res.behind > 0 : res.behind > 0;
  return res;
}

/* ---------------- the update */
function stamp() { return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19); }
function readSafe(p) { try { return fs.readFileSync(p); } catch { return null; } }

/** git mode: back up changes, move to origin/<branch>, put the user's files back -> {ok, error, changed[]} */
async function updateGit(ctx) {
  const { log, I } = ctx, o = { cwd: I.dir, run: ctx.run, git: ctx.git, log };
  if (!(ctx.git || gitBin())) return { ok: false, error: "git is not installed here - install Git, or update from the full zip" };
  log(`[..] fetching ${I.repo} (${I.branch})`, false);
  if ((await git(["fetch", "origin", I.branch], Object.assign({ echo: true }, o))).code !== 0) return { ok: false, error: "git fetch failed - check the network" };
  const cnt = await git(["rev-list", "--left-right", "--count", `HEAD...origin/${I.branch}`], o);
  const m = /(\d+)\s+(\d+)/.exec(cnt.out.join(" ")); const ahead = m ? +m[1] : 0, behind = m ? +m[2] : 0;
  if (ahead > 0) return { ok: false, error: `this folder has ${ahead} commit(s) of its own that are not on GitHub - it is a developer's copy; update it with git (pull / merge) instead` };
  if (!behind) { log("[ok] already up to date with GitHub", false); return { ok: true, changed: [], upToDate: true }; }
  const before = (await git(["rev-parse", "HEAD"], o)).out[0] || "";
  // the tracked files changed on this machine -> a copy first (the user's own files are put back after)
  const st = await git(["status", "--porcelain", "--untracked-files=no"], o);
  const changed = st.out.map((l) => l.slice(3).trim().replace(/^"|"$/g, "")).filter(Boolean);
  const keep = {};
  for (const f of USER_FILES) { const b = readSafe(path.join(I.dir, f)); if (b) keep[f] = b; }
  const others = changed.filter((f) => !USER_FILES.includes(f));
  if (others.length) {
    const bk = path.join(I.dir, "backups", "update-" + stamp());
    for (const f of others) {
      const src = path.join(I.dir, f), dst = path.join(bk, f);
      try { if (fs.existsSync(src)) { fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.copyFileSync(src, dst); } } catch { /* next */ }
    }
    log(`[warn] ${others.length} app file(s) you changed are replaced by GitHub's - a copy is in ${bk}: ${others.slice(0, 8).join(", ")}${others.length > 8 ? " …" : ""}`, true);
  }
  log(`[..] moving to GitHub's ${I.branch} (${behind} new commit(s))`, false);
  if ((await git(["reset", "--hard", `origin/${I.branch}`], Object.assign({ echo: true }, o))).code !== 0) return { ok: false, error: "git reset failed - see the log" };
  for (const f of Object.keys(keep)) { try { fs.writeFileSync(path.join(I.dir, f), keep[f]); } catch { /* read-only? */ } }
  const diff = await git(["diff", "--name-only", before, "HEAD"], o);
  return { ok: true, changed: diff.out.filter(Boolean) };
}

/** zip mode: GitHub's zip of the branch over the app (the user's files kept) -> {ok, error, changed[]} */
async function updateZip(ctx) {
  const { log, I } = ctx;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bgupd-"));
  try {
    const url = `https://codeload.github.com/${I.repo}/zip/refs/heads/${I.branch}`;
    log(`[..] downloading ${url}`, false);
    const zip = path.join(tmp, "repo.zip");
    const r = await (ctx.download || X.download)(url, zip, {});
    if (!r.ok) return { ok: false, error: `download failed (${r.error || r.status})` };
    const out = path.join(tmp, "x");
    require("./unzip").extract(zip, out);
    const tops = fs.readdirSync(out); const top = tops.length === 1 ? path.join(out, tops[0]) : out;
    if (!fs.existsSync(path.join(top, "package.json")) || !fs.existsSync(path.join(top, "server.js"))) return { ok: false, error: "the download does not look like bitGen Studio (no package.json / server.js)" };
    const changed = [];
    const walk = (rel) => {
      for (const e of fs.readdirSync(path.join(top, rel), { withFileTypes: true })) {
        const r2 = rel ? rel + "/" + e.name : e.name;
        if (e.isDirectory()) { if (r2 === ".git") continue; walk(r2); continue; }
        const dst = path.join(I.dir, ...r2.split("/"));
        if (USER_FILES.includes(r2) && fs.existsSync(dst)) continue;          // the user's own copy stays
        const nb = fs.readFileSync(path.join(top, ...r2.split("/"))), ob = readSafe(dst);
        if (ob && ob.equals(nb)) continue;
        fs.mkdirSync(path.dirname(dst), { recursive: true });
        fs.writeFileSync(dst, nb); changed.push(r2);
      }
    };
    walk("");
    log(`[ok] ${changed.length} file(s) updated`, false);
    return { ok: true, changed };
  } finally { require("./setupPacks").safeRm(tmp, log); }
}

/** after the files: npm / pip when their lists changed */
async function deps(ctx, changed) {
  const { log, I } = ctx, run = ctx.run || X.run;
  let SR = null; try { SR = require("./setupRun"); } catch { SR = null; }
  const env = SR ? SR.env() : process.env;
  if (changed.some((f) => f === "package-lock.json" || f === "package.json")) {
    const npm = X.which("npm", SR ? SR.runtimeDirs() : []);
    if (npm) {
      log("[..] the Node packages changed - npm install", false);
      const c = await run(npm, ["install", "--omit=dev", "--no-audit", "--no-fund"], { cwd: I.dir, env, log, shell: X.IS_WIN, timeout: 20 * 60000 });
      if (c !== 0) log("[warn] npm install did not finish - run start.bat again (it installs them)", true);
    } else log("[warn] the Node packages changed but npm was not found - start.bat installs them on the next start", true);
  }
  if (changed.includes("requirements.txt")) {
    const py = SR ? SR.appPython() : "";
    if (py) {
      log("[..] the Python packages changed - pip install -r requirements.txt", false);
      const c = await run(py, ["-m", "pip", "install", "-r", path.join(I.dir, "requirements.txt"), "--progress-bar", "off"], { cwd: I.dir, env, log, timeout: 30 * 60000 });
      if (c !== 0) log("[warn] pip install -r requirements.txt did not finish - see above", true);
    }
  }
}

let J = null;
function job() { return J; }
function start(opts) {
  const o = opts || {};
  if (J && J.state === "running") return { error: "an update is already running" };
  const I = info(o.base);
  J = { state: "running", lines: [], from: I.version, to: "", mode: I.mode, restart: false, error: "", started: Date.now() };
  const me = J;
  const log = (l, err) => { me.lines.push((err ? "! " : "") + String(l)); if (me.lines.length > 3000) me.lines.splice(0, me.lines.length - 3000); };
  const ctx = { log, I, run: o.run, git: o.git, download: o.download };
  (async () => {
    log(`[..] bitGen Studio ${I.version} - ${I.mode === "git" ? "a git clone" : "installed from a zip"} of ${I.repo} (${I.branch})`, false);
    const r = I.mode === "git" ? await updateGit(ctx) : await updateZip(ctx);
    if (!r.ok) throw new Error(r.error);
    if (r.changed && r.changed.length) await deps(ctx, r.changed);
    me.to = localVersion(I.dir);
    me.restart = !!(r.changed && r.changed.length);
    me.state = "done";
    log(r.upToDate ? `[done] already the newest (${me.to})` : `[done] updated ${me.from} -> ${me.to}${me.restart ? " - restart bitGen Studio to finish" : ""}`, false);
  })().catch((e) => { me.state = "error"; me.error = String((e && e.message) || e); log("[failed] " + me.error, true); });
  return { ok: true };
}

module.exports = { DEFAULT_REPO, DEFAULT_BRANCH, USER_FILES, cmpVersion, repoOf, info, check, start, job, updateGit, updateZip, localVersion, _reset: () => { J = null; } };
