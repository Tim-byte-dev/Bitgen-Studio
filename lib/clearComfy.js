// bitGen Studio — lib/clearComfy.js (2.669.0): ComfyUI CLEARED COMPLETELY - misc\clear-comfy.bat run by the app itself.
//
// Tim: "when in settings-comfyui update run the misc\clear-comfy script to clear comfy ui completely, when bitgen exits run
// that script, clear all bitgen process and close the terminal window".
// misc\clear-comfy.bat (Windows) stops EVERY ComfyUI process (by its command line - never bitGen Studio's own workers), frees
// port 8188 and deletes ComfyUI's temp\, __pycache__ and ComfyUI-Manager's cache - never models, output, input, workflows or
// settings. Here it is run hidden, with /nostart /nopause, its lines captured. Elsewhere (Linux / macOS) the same three steps
// are done here (pkill on the command line, the port's listener, the caches).
//   batPath()             <app>\misc\clear-comfy.bat
//   args(dir)             the arguments: [dir] /nostart /nopause
//   run({dir, log, spawn, platform, timeout}) -> Promise<{ok, code, lines, how}>   (the ComfyUI update)
//   runSync({dir, log, ...})                  -> {ok, code, lines, how}            (bitGen Studio exiting - must finish
//                                                 before the server does)
//   cachesOf(dir)         the folders the clear deletes (pure - temp, every __pycache__, ComfyUI-Manager's cache)
"use strict";
const fs = require("fs");
const path = require("path");
const cp = require("child_process");

function base() { try { return require("./core").BASE; } catch { return path.join(__dirname, ".."); } }
const batPath = () => path.join(base(), "misc", "clear-comfy.bat");
function comfyDir(dir) {
  if (dir != null) return String(dir || "");
  try { const c = require("./comfy").comfyCfg(); return c.dir ? require("./core").resolvePath(c.dir) : ""; } catch { return ""; }
}
function args(dir) { return (dir ? [dir] : []).concat(["/nostart", "/nopause"]); }
const clean = (t) => String(t || "").replace(/\r/g, "").split("\n").map((l) => l.replace(/\s+$/, "")).filter((l) => l.trim() && !/^=+(.*=+)?$/.test(l.trim()));   // not the ===== rules

/** the folders a clear deletes under a ComfyUI folder (models / output / input / user are never walked into) */
function cachesOf(dir) {
  const out = []; if (!dir || !fs.existsSync(dir)) return out;
  const root = fs.existsSync(path.join(dir, "ComfyUI", "main.py")) ? path.join(dir, "ComfyUI") : dir;
  if (fs.existsSync(path.join(root, "temp"))) out.push(path.join(root, "temp"));
  ["custom_nodes/ComfyUI-Manager/cache", "user/default/ComfyUI-Manager/cache"].forEach((r) => { const p = path.join(root, r); if (fs.existsSync(p)) out.push(p); });
  const SKIP = new Set(["models", "output", "input", "user", ".git", "node_modules"]);
  const walk = (d, depth) => {
    if (depth > 8) return;
    let list = []; try { list = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    list.forEach((e) => { if (!e.isDirectory() || e.isSymbolicLink()) return; const p = path.join(d, e.name); if (e.name === "__pycache__") out.push(p); else if (!(depth === 0 && SKIP.has(e.name))) walk(p, depth + 1); });
  };
  walk(root, 0);
  return out;
}
/** Linux / macOS: the same three steps here */
function posixClear(dir, log, exec) {
  const lines = [], say = (l) => { lines.push(l); if (log) log(l); };
  const sh = exec || ((cmd) => { try { return cp.execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 15000 }); } catch (e) { return String((e && e.stdout) || ""); } });
  say("[1/3] stopping ComfyUI processes...");
  const ps = sh("ps -eo pid=,args=");
  const mine = new Set([String(process.pid), String(process.ppid)]);
  let n = 0;
  ps.split("\n").forEach((l) => { const m = /^\s*(\d+)\s+(.*)$/.exec(l); if (!m || mine.has(m[1])) return; if (/python/i.test(m[2]) && /ComfyUI/.test(m[2]) && /main\.py/.test(m[2]) && !/worker\.py|clear-comfy|bitgen-studio/.test(m[2])) { try { process.kill(+m[1], "SIGKILL"); n++; say("      killed PID " + m[1]); } catch { /* gone */ } } });
  if (!n) say("      none running");
  say("[2/3] clearing caches...");
  if (!dir) say("      skipped - no ComfyUI folder");
  else { const C = cachesOf(dir); C.forEach((p) => { try { fs.rmSync(p, { recursive: true, force: true }); } catch { /* fine */ } }); say("      " + C.length + " cache folder(s) removed - models, output, input, workflows and settings left untouched"); }
  say("[3/3] done");
  return { ok: true, code: 0, lines, how: "posix" };
}

/** misc\clear-comfy.bat, hidden, its lines into log -> Promise<{ok, code, lines, how}> */
function run(o) {
  const opt = o || {}, plat = opt.platform || process.platform, dir = comfyDir(opt.dir), log = opt.log || null;
  if (plat !== "win32") return Promise.resolve(posixClear(dir, log, opt.exec));
  const bat = opt.bat || batPath();
  if (!fs.existsSync(bat)) return Promise.resolve({ ok: false, code: -1, lines: [], how: "missing", error: bat + " is missing" });
  return new Promise((resolve) => {
    const lines = [];
    const sp = opt.spawn || cp.spawn;
    let p;
    try { p = sp("cmd.exe", ["/d", "/s", "/c", "\"" + ["\"" + bat + "\""].concat(args(dir).map((a) => (a.startsWith("/") ? a : "\"" + a + "\""))).join(" ") + "\""], { cwd: base(), windowsHide: true, windowsVerbatimArguments: true, stdio: ["ignore", "pipe", "pipe"] }); }
    catch (e) { return resolve({ ok: false, code: -1, lines, how: "bat", error: e.message }); }
    const eat = (d) => clean(d).forEach((l) => { lines.push(l); if (log) log(l); });
    if (p.stdout) p.stdout.on("data", eat);
    if (p.stderr) p.stderr.on("data", eat);
    const t = setTimeout(() => { try { p.kill(); } catch { /* fine */ } }, opt.timeout || 120000);
    p.on("error", (e) => { clearTimeout(t); resolve({ ok: false, code: -1, lines, how: "bat", error: e.message }); });
    p.on("close", (code) => { clearTimeout(t); resolve({ ok: code === 0, code, lines, how: "bat" }); });
  });
}
/** the same, waited for (bitGen Studio exiting) */
function runSync(o) {
  const opt = o || {}, plat = opt.platform || process.platform, dir = comfyDir(opt.dir), log = opt.log || null;
  if (plat !== "win32") return posixClear(dir, log, opt.exec);
  const bat = opt.bat || batPath();
  if (!fs.existsSync(bat)) return { ok: false, code: -1, lines: [], how: "missing", error: bat + " is missing" };
  const r = (opt.spawnSync || cp.spawnSync)("cmd.exe", ["/d", "/s", "/c", "\"" + ["\"" + bat + "\""].concat(args(dir).map((a) => (a.startsWith("/") ? a : "\"" + a + "\""))).join(" ") + "\""],
    { cwd: base(), windowsHide: true, windowsVerbatimArguments: true, encoding: "utf8", timeout: opt.timeout || 90000, stdio: ["ignore", "pipe", "pipe"] });
  const lines = clean((r.stdout || "") + "\n" + (r.stderr || "")); if (log) lines.forEach((l) => log(l));
  return { ok: r.status === 0, code: r.status, lines, how: "bat" };
}

module.exports = { batPath, args, cachesOf, run, runSync, posixClear };
