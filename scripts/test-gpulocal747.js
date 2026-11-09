#!/usr/bin/env node
/* bitGen Studio — 2.747.0 units: BASIC SETTINGS ▸ GPU LOCAL BY DEFAULT (lib/gpuSplit.js split / defaultLocal) + THE UPDATE
 * CHECK STAYS QUICK (lib/updater.js check).
 * Tim (verbatim): "the image and video styles are not showing, make local default" + "previous version would not let me
 * update inapp" -> "failed to fetch" (the check is one web request; Node drops a request after 5 min, and the check ran a
 * full git fetch - every release ~13 MB of PDFs).
 *   gpu      nothing saved = Local (even with a remote GPU in use); ONCE per install Remote / Both go to Local and ComfyUI's
 *            address back to this computer's (the remote stays set up); never again after (Use it -> Remote stays);
 *            a new install is marked so it never switches
 *   check    GitHub's newest commit by ls-remote (a few bytes, 30 s at most); not here -> a 60 s fetch at most; a fetch
 *            that times out still says "newer" (the update job downloads it, an hour allowed); here already -> counted
 *            without a fetch; the update's own fetch has an hour */
"use strict";
const fs = require("fs"), path = require("path"), os = require("os");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "gl747-"));
let CFG = null;
const corePath = require.resolve("../lib/core.js");
require.cache[corePath] = { id: corePath, filename: corePath, loaded: true, exports: { BASE: TMP, WORKSPACE: TMP, STYLES_DIR: path.join(TMP, "styles"),
  getConfig: () => JSON.parse(JSON.stringify(CFG)), setConfig: (c) => { CFG = JSON.parse(JSON.stringify(c)); } } };
const G = require("../lib/gpuSplit.js"), U = require("../lib/updater.js");

(async () => {
  /* ---- Local by default */
  CFG = { engine: { comfy: { url: "http://127.0.0.1:8311/rpsl", autostart: false } }, rgpu: { mode: "serverless", remote_mode: "serverless", prev: { url: "http://127.0.0.1:8188", autostart: true }, runpod: { key: "rpa_K" }, serverless: { endpoint: "epx" } } };
  check("nothing saved = Local, even with a remote GPU in use (it used to follow Remote GPU's Use it)", G.split().where === "local");
  CFG.rgpu.split = { where: "remote", image: true };
  const ch = G.defaultLocal();
  check("once per install: Remote -> Local, ComfyUI's address back to this computer's, the remote kept (key, endpoint, the boxes)", ch === true && CFG.rgpu.split.where === "local" && CFG.rgpu.mode === "local"
    && CFG.engine.comfy.url === "http://127.0.0.1:8188" && CFG.engine.comfy.autostart === true && CFG.rgpu.local_default_747 === true && CFG.rgpu.serverless.endpoint === "epx" && CFG.rgpu.split.image === true, CFG);
  CFG.rgpu.split.where = "remote";
  check("…never again: a Remote chosen after that stays Remote", G.defaultLocal() === false && CFG.rgpu.split.where === "remote");
  CFG = { engine: { comfy: { url: "http://127.0.0.1:8188" } } };
  check("a new install (no Remote GPU settings yet): marked, nothing else changes - it never switches later", G.defaultLocal() === false && CFG.rgpu.mode === "local" && CFG.rgpu.local_default_747 === true && G.split().where === "local", CFG);
  CFG = { rgpu: { mode: "local", split: { where: "both", video: true } } };
  check("an install on Both: Local once too (its boxes kept)", G.defaultLocal() === true && CFG.rgpu.split.where === "local" && CFG.rgpu.split.video === true);
  const RT = fs.readFileSync(path.join(ROOT, "routes", "gpuSplit.js"), "utf8");
  check("routes/gpuSplit.js runs it when the server starts (mount)", /function mount\(app\) \{\s*try \{ G\.defaultLocal\(\); \}/.test(RT));

  /* ---- the update check: quick, whatever the line */
  const inst = path.join(TMP, "inst");
  fs.mkdirSync(path.join(inst, ".git"), { recursive: true });
  fs.writeFileSync(path.join(inst, ".git", "config"), '[remote "origin"]\n\turl = https://github.com/Tim-byte-dev/Bitgen-Studio.git\n');
  fs.writeFileSync(path.join(inst, ".git", "HEAD"), "ref: refs/heads/main\n");
  fs.writeFileSync(path.join(inst, "package.json"), JSON.stringify({ version: "2.746.0" }));
  CFG = {};
  const NEW = "a".repeat(40), OLD = "b".repeat(40);
  const stub = (have, fetchCode) => { const seen = []; return { seen, run: async (cmd, args, opts) => {
    const a = args.slice(2), t = opts.timeout; seen.push([a[0], t]);
    const out = (l) => opts.log(l, false);
    if (a[0] === "ls-remote") { out(NEW + "\trefs/heads/main"); return 0; }
    if (a[0] === "rev-parse") { out(OLD); return 0; }
    if (a[0] === "cat-file") return have ? 0 : 1;
    if (a[0] === "fetch") { if (fetchCode === 0) have = true; return fetchCode; }
    if (a[0] === "rev-list") { out("0\t3"); return 0; }
    if (a[0] === "log") { out("c3 three"); out("c2 two"); out("c1 one"); return 0; }
    return 0;
  } }; };
  const gj = async () => ({ status: 200, json: { version: "2.747.0" } });
  let s = stub(false, -2);
  let c = await U.check({ base: inst, run: s.run, git: "git", getJson: gj });
  check("a slow line (the fetch stopped at its limit): still 'newer' - ⤓ Update now downloads it; no error", c.newer && c.latest === "2.747.0" && c.more === true && c.behind === 1 && !c.error, c);
  const lim = Object.fromEntries(s.seen.map(([k, t]) => [k, t]));
  check("…every git step has a short limit: ls-remote 30 s, the fetch 60 s - well inside the server's 5-minute request limit", lim["ls-remote"] === 30000 && lim.fetch === 60000 && s.seen.every(([, t]) => t <= 60000), s.seen);
  s = stub(true, 0);
  c = await U.check({ base: inst, run: s.run, git: "git", getJson: gj });
  check("GitHub's commit already here: counted without a fetch (3 behind, the commits listed)", c.behind === 3 && c.commits.length === 3 && !s.seen.some(([k]) => k === "fetch"), s.seen);
  s = stub(false, 0);
  c = await U.check({ base: inst, run: s.run, git: "git", getJson: gj });
  check("not here, a quick fetch: counted against GitHub's commit", c.behind === 3 && c.commits.length === 3 && s.seen.filter(([k]) => k === "fetch").length === 1);
  check("the update's own fetch (a background job, no request to time out) has an hour", U.UPDATE_FETCH_MS === 3600000 && /"fetch", "--progress", "origin", I\.branch\], Object\.assign\(\{ echo: true, timeout: UPDATE_FETCH_MS \}/.test(fs.readFileSync(path.join(ROOT, "lib", "updater.js"), "utf8")));
  const SU = fs.readFileSync(path.join(ROOT, "static", "updater.js"), "utf8");
  check("the Updates panel: the browser's \"Failed to fetch\" said as \"bitGen Studio stopped answering\"; Update now's own failure shown too", /failed to fetch\|networkerror\|load failed/.test(SU) && /stopped answering/.test(SU) && /post\("\/api\/update\/start"\)[\s\S]*?\.catch\(function \(e\) \{ \$\("upMsg"\)\.textContent = "✗ " \+ said\(e\)/.test(SU));

  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch { /* fine */ }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log("FAIL: crashed " + (e && e.stack || e)); process.exit(1); });
