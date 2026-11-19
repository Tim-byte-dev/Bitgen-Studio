// lib/searxngLocal.js — 2.886.0: 🔎 a SearXNG search server of bitGen's own, on this computer (Windows too).
// Tim: "it works but search is very limited, i was not using brave, fix the searxng".
// SearXNG has no Windows install of its own; SimpleXNG (PyPI "simplexng", AGPL-3.0 like SearXNG) bundles it and serves it with
// waitress on Windows, macOS and Linux. bitGen installs it in its own Python environment (<app>/searxng/.venv), writes its own
// settings.yml (the JSON answers on, 127.0.0.1 only, its own secret key, no rate limiter, safe search moderate) and starts it on
// 127.0.0.1:8888 when a search needs it (it stops with bitGen - lib/exitSweep ends the app folder's processes).
//   status() {installed, running, url, dir, log}   install(log) -> {ok | error}   start() -> {ok, url}   stop()
//   settingsYml(secret, port) is pure (scripts/test-886.js)
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const IS_WIN = process.platform === "win32";
const PORT = 8888;
// packages its code imports that its dependency list leaves out (newer anyio no longer brings sniffio - found on a real start)
const EXTRA = ["sniffio"];
const URL0 = `http://127.0.0.1:${PORT}`;
const base = () => { try { return require("./core").BASE || process.cwd(); } catch (e) { return process.cwd(); } };
const dir = () => path.join(base(), "searxng");
const venv = () => path.join(dir(), ".venv");
const vpy = () => path.join(venv(), IS_WIN ? "Scripts" : "bin", IS_WIN ? "python.exe" : "python");
const settingsFile = () => path.join(dir(), "settings.yml");
const S = { proc: null, log: [], starting: null };
const say = (l) => { S.log.push(String(l).slice(0, 400)); if (S.log.length > 200) S.log.splice(0, S.log.length - 200); };

/** bitGen's settings.yml for it (SearXNG reads the rest from its own defaults) */
function settingsYml(secret, port) {
  return ["# bitGen Studio - its own SearXNG (lib/searxngLocal.js). Changes here are kept.", "use_default_settings: true", "general:", "  debug: false", '  instance_name: "bitGen search"',
    "search:", "  safe_search: 1", "  autocomplete: ''", "  formats:", "    - html", "    - json", "server:", `  port: ${port || PORT}`, '  bind_address: "127.0.0.1"', `  secret_key: "${secret}"`,
    "  limiter: false", "  image_proxy: false", "  public_instance: false", "redis:", "  url: false", "valkey:", "  url: false", "ui:", "  static_use_hash: false", ""].join("\n");
}
const installed = () => fs.existsSync(vpy()) && fs.existsSync(settingsFile()) && fs.existsSync(path.join(dir(), ".installed"));
async function answering(timeout) {
  try { const r = await fetch(`${URL0}/search?q=bitgen&format=json`, { signal: AbortSignal.timeout(timeout || 4000) }); return r.ok; } catch (e) { return false; }
}
async function status() { return { installed: installed(), running: await answering(2500), url: URL0, dir: dir(), log: S.log.slice(-30) }; }

async function install(log0) {
  const log = (l, bad) => { say(l); if (log0) log0(l, bad); };
  const X = require("./setupExec");
  let python = ""; try { python = require("./setupRun").appPython(); } catch (e) { python = ""; }
  if (!python) return { ok: false, error: "no Python found - the app's setup installs one" };
  let ver = "";
  await X.run(python, ["-c", "import sys; print('PYV %d.%d' % sys.version_info[:2])"], { log: (l) => { const m = /PYV (\d+)\.(\d+)/.exec(l); if (m) ver = m[1] + "." + m[2]; } });
  const [maj, min] = ver.split(".").map(Number);
  if (maj !== 3 || min < 11) return { ok: false, error: `SearXNG needs Python 3.11 or newer; the app's Python is ${ver || "not runnable"}` };
  fs.mkdirSync(dir(), { recursive: true });
  const env = Object.assign({}, process.env, { PYTHONUTF8: "1", PIP_DISABLE_PIP_VERSION_CHECK: "1", PIP_NO_INPUT: "1" });
  if (!fs.existsSync(vpy())) {
    log(`[..] its own Python environment (${venv()})`);
    if (await X.run(python, ["-m", "venv", venv()], { log, env }) !== 0 || !fs.existsSync(vpy())) return { ok: false, error: "could not make the Python environment" };
  }
  log("[..] SearXNG (the simplexng package from PyPI - SearXNG bundled for Windows, macOS and Linux)");
  if (await X.run(vpy(), ["-m", "pip", "install", "--upgrade", "simplexng", ...EXTRA, "--progress-bar", "off"], { log, env, timeout: 20 * 60000 }) !== 0) return { ok: false, error: "pip could not install SearXNG - see the log" };
  if (!fs.existsSync(settingsFile())) fs.writeFileSync(settingsFile(), settingsYml(crypto.randomBytes(24).toString("hex"), PORT));
  fs.writeFileSync(path.join(dir(), ".installed"), new Date().toISOString());
  log("[ok] SearXNG installed - starting it");
  const st = await start();
  return st.ok ? { ok: true, url: URL0 } : { ok: false, error: st.error };
}
/** start it (once) and wait until it answers JSON - {ok, url} */
async function start() {
  if (await answering(2000)) return { ok: true, url: URL0 };
  if (!installed()) return { ok: false, error: "SearXNG is not installed - Settings ▸ General ▸ 🌐 ⬇ Install SearXNG" };
  if (S.starting) return S.starting;
  S.starting = (async () => {
    const { spawn } = require("child_process");
    const code = `import sys; sys.argv=['simplexng','--settings',${JSON.stringify(settingsFile())},'-p','${PORT}','-H','127.0.0.1']\nfrom simplexng.simplexng import main\nmain()`;
    say("[..] starting SearXNG on " + URL0);
    const p = spawn(vpy(), ["-c", code], { cwd: dir(), env: Object.assign({}, process.env, { SEARXNG_SETTINGS_PATH: settingsFile(), PYTHONUTF8: "1" }), windowsHide: true });
    S.proc = p;
    p.stdout.on("data", (d) => String(d).split(/\r?\n/).filter(Boolean).forEach(say));
    p.stderr.on("data", (d) => String(d).split(/\r?\n/).filter(Boolean).forEach(say));
    p.on("exit", (c) => { say(`[exit] SearXNG stopped (${c})`); if (S.proc === p) S.proc = null; });
    for (let i = 0; i < 90; i++) {
      if (await answering(1500)) { say("[ok] SearXNG answers on " + URL0); return { ok: true, url: URL0 }; }
      if (!S.proc) break;
      await new Promise((r) => setTimeout(r, 1000));
    }
    return { ok: false, error: "SearXNG did not start - " + (S.log.slice(-3).join(" · ") || "no output") };
  })();
  try { return await S.starting; } finally { S.starting = null; }
}
function stop() { if (S.proc) { try { S.proc.kill(); } catch (e) { /* gone */ } S.proc = null; return true; } return false; }
module.exports = { PORT, URL0, settingsYml, status, install, start, stop, installed, dir };
