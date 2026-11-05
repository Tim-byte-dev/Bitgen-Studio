// bitGen Studio — lib/exitSweep.js (2.669.0): WHEN bitGen Studio EXITS - ComfyUI cleared, every bitGen Studio process ended.
//
// Tim: "when bitgen exits run that script [misc\clear-comfy.bat], clear all bitgen process and close the terminal window".
// Run by the server when the app quits (POST /api/shutdown from Electron's before-quit), when its console window is closed /
// Ctrl+C (SIGHUP / SIGINT / SIGTERM) and when Electron vanishes (the parent watchdog in lib/comfy.js):
//   1. comfy.shutdownAll  - the ComfyUI bitGen Studio started, its tree (as before)
//   2. misc\clear-comfy.bat /nostart /nopause - every ComfyUI process, port 8188, temp / __pycache__ / Manager cache
//      (lib/clearComfy.js) - Settings ▸ ComfyUI ▸ "Clear ComfyUI completely when bitGen Studio exits" (default ON) - off:
//      "Leave ComfyUI running" decides as before
//   3. every process whose command line runs from the bitGen Studio folder (render / music / LLM workers, llama-server,
//      ffmpeg …) - not this server (it exits next), not Electron (it is quitting), not a console / shell (start.bat closes its
//      own window when the app is gone: its last line is `exit`), not a kept ComfyUI
// Only in the real server (misc/server.js), never in the e2e test server (H3_E2E=1) unless H3_EXIT_SWEEP=1 - there the
// folder's processes are the tests themselves.
//   run(reason, o) -> {swept, cleared, killed: [pid], skipped}     once per process
//   pure: targets(list, {base, self, parent, keepComfy, platform}) -> [pid]
"use strict";
const path = require("path");
const cp = require("child_process");

let done = null;
const KEEP_WIN = /^(cmd|conhost|powershell|pwsh|windowsterminal|openconsole|explorer|wt|electron|bitgen studio)(\.exe)?$/i;
const KEEP_POSIX = /^(sh|bash|zsh|fish|dash|ksh|tcsh|csh|login|tmux|screen|sudo|electron|gnome-terminal.*|konsole|xterm)$/i;
const COMFY = /ComfyUI[\\/].*main\.py|windows-standalone-build/i;

function base() { try { return require("./core").BASE; } catch { return path.join(__dirname, ".."); } }
const norm = (s, win) => { const t = String(s || "").replace(/\\/g, "/").replace(/\/+$/, ""); return win ? t.toLowerCase() : t; };

/** which of the listed processes go: [{pid, ppid, name, cmd}] -> [pid] */
function targets(list, o) {
  const opt = o || {}, win = (opt.platform || process.platform) === "win32", b = norm(opt.base || base(), win);
  if (!b || b.length < 4) return [];
  const keep = new Set([opt.self, opt.parent].concat(opt.keep || []).filter((x) => x != null).map(Number));
  return (list || []).filter((p) => {
    if (!p || !(p.pid > 0) || keep.has(+p.pid)) return false;
    const name = String(p.name || "").split(/[\\/]/).pop();
    if ((win ? KEEP_WIN : KEEP_POSIX).test(name)) return false;
    const c = norm(p.cmd, win); if (!c) return false;
    if (opt.keepComfy && COMFY.test(p.cmd)) return false;
    return c.includes(b + "/") || c.includes(b + "\"") || c.endsWith(b);
  }).map((p) => +p.pid);
}
/** the running processes */
function list(o) {
  const opt = o || {}, plat = opt.platform || process.platform;
  try {
    if (plat === "win32") {
      const ps = "Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,Name,CommandLine | ConvertTo-Json -Compress";
      const r = cp.spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", ps], { encoding: "utf8", windowsHide: true, timeout: 20000, maxBuffer: 64 * 1024 * 1024 });
      let j = []; try { j = JSON.parse(r.stdout || "[]"); } catch { j = []; } if (!Array.isArray(j)) j = [j];
      return j.map((x) => ({ pid: x.ProcessId, ppid: x.ParentProcessId, name: x.Name, cmd: x.CommandLine || "" }));
    }
    const out = cp.execSync("ps -eo pid=,ppid=,comm=,args=", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 10000, maxBuffer: 16 * 1024 * 1024 });
    return out.split("\n").map((l) => { const m = /^\s*(\d+)\s+(\d+)\s+(\S+)\s+(.*)$/.exec(l); return m ? { pid: +m[1], ppid: +m[2], name: m[3], cmd: m[4] } : null; }).filter(Boolean);
  } catch { return []; }
}
function kill(pids, plat) {
  const out = [];
  pids.forEach((pid) => {
    try {
      if ((plat || process.platform) === "win32") cp.spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], { windowsHide: true, timeout: 10000 });
      else process.kill(pid, "SIGKILL");
      out.push(pid);
    } catch { /* gone already */ }
  });
  return out;
}
const isServer = () => !!(require.main && /[\\/]server\.js$/.test(require.main.filename || ""));

/** bitGen Studio is exiting: sweep (once) */
function run(reason, o) {
  if (done) return done;
  const opt = o || {}, say = opt.log || ((l) => { try { console.log(l); } catch { /* closing */ } });
  const C = opt.comfy || require("./comfy");
  try { C.shutdownAll(reason || "app exit"); } catch { /* dying anyway */ }
  const allowed = opt.force || (isServer() && (process.env.H3_E2E !== "1" || process.env.H3_EXIT_SWEEP === "1"));
  if (!allowed) { done = { swept: false, skipped: "not the app's server" }; return done; }
  let keepAlive = false, clearOn = true; try { const cc = C.comfyCfg(); keepAlive = !!cc.keepAlive; clearOn = cc.clearOnExit !== false; } catch { keepAlive = false; }
  // 2.669.0: "Clear ComfyUI completely when bitGen Studio exits" (default on) outranks "Leave ComfyUI running"
  if (clearOn) keepAlive = false;
  done = { swept: true, cleared: false, killed: [] };
  if (!keepAlive) {
    say(`[exit] ${reason || "app exit"} - clearing ComfyUI (misc\\clear-comfy.bat)`);
    try { const r = (opt.clear || require("./clearComfy")).runSync({ log: (l) => say("[exit]   " + l) }); done.cleared = !!r.ok; } catch (e) { say("[exit] the ComfyUI clear failed: " + e.message); }
  } else say("[exit] Settings ▸ ComfyUI ▸ 'Leave ComfyUI running' is on - ComfyUI left as it is");
  const parent = parseInt(process.env.H3_PARENT_PID || "", 10);
  const t = targets(opt.list || list(), { base: opt.base || base(), self: opt.self != null ? opt.self : process.pid, parent: opt.parent != null ? opt.parent : parent > 0 ? parent : process.ppid, keepComfy: keepAlive, platform: opt.platform });
  done.killed = (opt.kill || kill)(t, opt.platform);
  say(`[exit] ${done.killed.length} bitGen Studio process(es) ended${done.killed.length ? " (" + done.killed.join(", ") + ")" : ""}`);
  return done;
}

module.exports = { run, targets, list, kill, isServer, _reset: () => { done = null; } };
