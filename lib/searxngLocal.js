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

/** Windows (or o.noUvloop): uvloop has no build there */
const noUvloop = (o) => (o && o.noUvloop != null ? !!o.noUvloop : IS_WIN);
const UVLOOP_SHIM = `# bitGen Studio (lib/searxngLocal.js): uvloop has no Windows build; SearXNG imports it only to call uvloop.install().
# This stand-in keeps Python's own asyncio event loop. Delete it if a real uvloop is ever installed here.
import asyncio
def install():
    pass
def new_event_loop():
    return asyncio.new_event_loop()
EventLoopPolicy = asyncio.DefaultEventLoopPolicy
`;
// 2.886.2 (Tim's next Windows log: "ModuleNotFoundError: No module named 'pwd'"): searx/valkeydb.py imports the Unix-only pwd
// module at the top (it uses it only to name the user when a Valkey database cannot be reached - valkey is off in bitGen's
// settings). A stand-in so the import works on Windows.
const PWD_SHIM = `# bitGen Studio (lib/searxngLocal.js): Windows has no pwd module; SearXNG's valkeydb.py imports it but only uses it when a
# Valkey database fails (valkey is off in bitGen's settings.yml). This stand-in answers with the Windows user's name.
import getpass, collections
struct_passwd = collections.namedtuple("struct_passwd", "pw_name pw_passwd pw_uid pw_gid pw_gecos pw_dir pw_shell")
def getpwuid(uid=0):
    return struct_passwd(getpass.getuser(), "x", 0, 0, "", "", "")
def getpwnam(name):
    return struct_passwd(name, "x", 0, 0, "", "", "")
def getpwall():
    return [getpwuid()]
`;
/** the Windows stand-ins (uvloop, pwd) in the environment - written at install and again before every start (an install
 *  from before a stand-in existed gets it) */
async function ensureShims(X, env, log) {
  const sp = await sitePackages(X, env); if (!sp) return false;
  for (const [f, body] of [["uvloop.py", UVLOOP_SHIM], ["pwd.py", PWD_SHIM]]) {
    const p = path.join(sp, f); if (!fs.existsSync(p) || fs.readFileSync(p, "utf8") !== body) { fs.writeFileSync(p, body); if (log) log(`[ok] the ${f.replace(".py", "")} stand-in`); }
  }
  return true;
}
/** simplexng's requirements for THIS Python (markers applied), uvloop left out */
async function depsOf(X, env) {
  const code = "import importlib.metadata as m\nfrom packaging.requirements import Requirement\nfor r in m.requires('simplexng') or []:\n    q = Requirement(r)\n    if q.name.lower() == 'uvloop' or (q.marker and not q.marker.evaluate({'extra': ''})): continue\n    print('DEP ' + str(q).split(';')[0].strip())";
  const out = [];
  await X.run(vpy(), ["-c", code], { log: (l) => { const m = /^DEP (.+)$/.exec(String(l).trim()); if (m) out.push(m[1]); }, env });
  if (!out.length) {   // no "packaging" in the venv: pip vendors one
    const code2 = code.replace("from packaging.requirements", "from pip._vendor.packaging.requirements");
    await X.run(vpy(), ["-c", code2], { log: (l) => { const m = /^DEP (.+)$/.exec(String(l).trim()); if (m) out.push(m[1]); }, env });
  }
  return out;
}
async function sitePackages(X, env) {
  let p = ""; await X.run(vpy(), ["-c", "import sysconfig; print('SP ' + sysconfig.get_paths()['purelib'])"], { log: (l) => { const m = /^SP (.+)$/.exec(String(l).trim()); if (m) p = m[1]; }, env });
  return p && fs.existsSync(p) ? p : "";
}
async function install(log0, o) {
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
  const pip = (args) => X.run(vpy(), ["-m", "pip", "install", ...args, "--progress-bar", "off"], { log, env, timeout: 20 * 60000 });
  if (!noUvloop(o)) {
    if (await pip(["--upgrade", "simplexng", ...EXTRA]) !== 0) return { ok: false, error: "pip could not install SearXNG - see the log" };
  } else {
    // 2.886.1 (Tim's Windows log: "RuntimeError: uvloop does not support Windows at the moment"): simplexng requires uvloop for
    // every system, and SearXNG imports it only to call uvloop.install(). So on Windows: simplexng without its dependencies, its
    // dependencies minus uvloop (the pinned versions first, the newest ones with wheels if a pin will not build), and a small
    // uvloop stand-in that keeps Python's own asyncio loop.
    if (await pip(["--upgrade", "--no-deps", "simplexng"]) !== 0) return { ok: false, error: "pip could not install SearXNG - see the log" };
    const deps = await depsOf(X, env);
    if (!deps.length) return { ok: false, error: "could not read SearXNG's dependency list" };
    log(`[..] its ${deps.length} dependencies without uvloop (no Windows build - Python's own event loop is used)`);
    if (await pip([...deps, ...EXTRA]) !== 0) {
      log("[warn] a pinned version would not install - trying the newest versions with ready-made wheels", true);
      if (await pip(["--upgrade", ...deps.map((d) => d.split(/[=<>!~;\[ ]/)[0] + (/\[[^\]]+\]/.exec(d) || [""])[0]), ...EXTRA]) !== 0) return { ok: false, error: "pip could not install SearXNG's dependencies - see the log" };
    }
    if (!(await ensureShims(X, env, log))) return { ok: false, error: "could not find the environment's site-packages" };
  }
  if (!fs.existsSync(settingsFile())) fs.writeFileSync(settingsFile(), settingsYml(crypto.randomBytes(24).toString("hex"), PORT));
  fs.writeFileSync(path.join(dir(), ".installed"), new Date().toISOString());
  log("[ok] SearXNG installed - starting it");
  const st = await start(o);
  return st.ok ? { ok: true, url: URL0 } : { ok: false, error: st.error };
}
/** start it (once) and wait until it answers JSON - {ok, url} */
async function start(o) {
  if (await answering(2000)) return { ok: true, url: URL0 };
  if (!installed()) return { ok: false, error: "SearXNG is not installed - Settings ▸ General ▸ 🌐 ⬇ Install SearXNG" };
  if (S.starting) return S.starting;
  S.starting = (async () => {
    if (noUvloop(o)) { try { await ensureShims(require("./setupExec"), Object.assign({}, process.env, { PYTHONUTF8: "1" }), say); } catch (e) { say("[warn] the stand-ins: " + e.message); } }
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
module.exports = { PWD_SHIM, UVLOOP_SHIM, noUvloop, PORT, URL0, settingsYml, status, install, start, stop, installed, dir };
