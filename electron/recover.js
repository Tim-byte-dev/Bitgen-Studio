// bitGen Studio — electron/recover.js (2.891.0): THE DESKTOP APP PUTS ITSELF RIGHT AFTER A CRASH.
//
// Tim (verbatim): "bitgen crashed again until i reset the dockers and cache". Twice (2.829.0, 2.891.0) the window only came
// back after misc\reset-layout.bat deleted the desktop app's whole cache folder and the dockers' layout. The app now does
// that itself, in steps, and keeps everything it moves:
//   * a NEW VERSION started            the caches (HTTP, compiled code, GPU / shader) are cleared before the window opens - a
//                                      stale GPU / code cache after an update is the usual cause of a black or crashing window
//   * the last start never came up     (the page did not say "booted" - h3:booted, sent by static/safelayout.js once the
//                                      dockers are restored) the caches are cleared; the SECOND start in a row that does not
//                                      come up also resets the dockers: the layout files go to backups\layout-auto-<time>\
//                                      (lib/layoutRescue.js) and the page opens with ?safe-layout=1 (it backs up and clears
//                                      its own storage, then reloads clean)
//   * the window crashed / froze       a box: Reload, Reset the dockers and the cache then restart, Quit (froze: Wait / Reset);
//                                      written to logs\electron-crash.log; the next start clears the caches
//   * the GPU process crashed          the next start clears the caches
//   * Settings ▸ Dockers ▸ 🧯 Reset    the same reset now (h3:resetLayout), no restart
// The state is userData\bitgen-boot.json {version, pending, fails, force, gpu}.
// Pure (scripts/test-891.js): plan(state, version) -> {acts: ["caches", "layout"], state}.
"use strict";
const fs = require("fs");
const path = require("path");

const CACHES = ["Cache", "Code Cache", "GPUCache", "DawnCache", "DawnGraphiteCache", "DawnWebGPUCache", "GraphiteDawnCache", "ShaderCache",
  "GrShaderCache", path.join("Service Worker", "CacheStorage"), path.join("Service Worker", "ScriptCache")];
const FILE = "bitgen-boot.json";

/** what to do at this start (pure): st = the saved state, version = this app's */
function plan(st, version) {
  const s = st && typeof st === "object" ? st : {};
  const acts = new Set();
  let fails = s.pending ? (Number(s.fails) || 0) + 1 : 0;
  if (s.version && s.version !== version) acts.add("caches");
  if (s.gpu) acts.add("caches");
  if (fails >= 1) acts.add("caches");
  if (s.force || fails >= 2) { acts.add("caches"); acts.add("layout"); }
  if (acts.has("layout")) fails = 0;
  return { acts: [...acts], fails, state: { version, pending: false, fails, force: false, gpu: false, started: new Date().toISOString() } };
}
const fileOf = (ud) => path.join(ud, FILE);
function read(ud) { try { return JSON.parse(fs.readFileSync(fileOf(ud), "utf8")); } catch { return {}; } }
function write(ud, s) { try { fs.mkdirSync(ud, { recursive: true }); fs.writeFileSync(fileOf(ud), JSON.stringify(s, null, 1)); } catch { /* read-only */ } }
function patch(ud, p) { write(ud, Object.assign(read(ud), p)); }
function clearCaches(ud) {
  const gone = [];
  for (const c of CACHES) { const p = path.join(ud, c); try { if (fs.existsSync(p)) { fs.rmSync(p, { recursive: true, force: true }); gone.push(c); } } catch { /* in use */ } }
  return gone;
}
function logLine(root, text) {
  try { const d = path.join(root, "logs"); fs.mkdirSync(d, { recursive: true }); fs.appendFileSync(path.join(d, "electron-crash.log"), `${new Date().toISOString()} ${text}\n`); } catch { /* fine */ }
}
/** BEFORE the app is ready (the GPU process has not opened its cache yet) -> {safe, acts, gone, moved, dir} */
function start(app, root, version, say) {
  const ud = app.getPath("userData");
  const p = plan(read(ud), version), out = { safe: false, acts: p.acts, gone: [], moved: [], dir: "" };
  if (p.acts.includes("caches")) out.gone = clearCaches(ud);
  if (p.acts.includes("layout")) {
    try { const m = require(path.join(root, "lib", "layoutRescue")).moveFiles(root, "the window did not come up twice in a row (or Reset was pressed) - bitGen reset the dockers"); out.moved = m.moved; out.dir = m.dir; }
    catch (e) { logLine(root, "layout reset failed: " + e.message); }
    out.safe = true;
  }
  write(ud, p.state);
  if (p.acts.length) {
    const t = `start ${version}: ${p.acts.join(" + ")}${out.gone.length ? " - cleared " + out.gone.join(", ") : ""}${out.moved.length ? " - moved " + out.moved.join(", ") + " to " + out.dir : ""}`;
    logLine(root, t); if (say) say("[electron] " + t);
  }
  return out;
}
/** the main window is opening: until the page says booted, this start counts as one that did not come up (the setup
 *  window alone never arms it) */
function arm(app) { patch(app.getPath("userData"), { pending: true }); }
function booted(app) { patch(app.getPath("userData"), { pending: false, fails: 0 }); }
function requestReset(app) { patch(app.getPath("userData"), { force: true }); }
function markCrash(app, root, what, info) {
  patch(app.getPath("userData"), what === "gpu" ? { gpu: true } : { pending: true });
  logLine(root, `${what} gone: ${JSON.stringify(info || {})}`);
}
/** the reset NOW, in the running app: the session's caches + the layout files; the page then opens ?safe-layout=1 */
async function resetNow(session, root) {
  const s = session && session.defaultSession;
  try { if (s) { await s.clearCache(); if (s.clearCodeCaches) await s.clearCodeCaches({}); await s.clearStorageData({ storages: ["shadercache", "cachestorage", "serviceworkers"] }); } } catch (e) { logLine(root, "cache clear: " + e.message); }
  let m = { moved: [], dir: "" };
  try { m = require(path.join(root, "lib", "layoutRescue")).moveFiles(root, "Settings ▸ Dockers ▸ Reset the dockers and the cache"); } catch (e) { logLine(root, "layout reset: " + e.message); }
  logLine(root, "reset by hand - moved " + (m.moved.join(", ") || "nothing") + (m.dir ? " to " + m.dir : ""));
  return m;
}
/** the crash / freeze boxes on the main window (dialog, the window, what to do on Reset) */
function watch(o) {
  const { app, win, dialog, root, reload, resetAndRestart } = o;
  let crashes = 0, asking = false;
  win.webContents.on("render-process-gone", async (_e, d) => {
    if (!d || d.reason === "clean-exit") return;
    markCrash(app, root, "renderer", d);
    crashes++;
    if (asking || win.isDestroyed()) return;
    asking = true;
    try {
      const r = await dialog.showMessageBox(win, { type: "error", title: "bitGen Studio", noLink: true, defaultId: crashes > 1 ? 1 : 0, cancelId: 2,
        message: "bitGen Studio's window stopped (" + d.reason + (d.exitCode ? ", code " + d.exitCode : "") + ").",
        detail: "Reload tries again. If it keeps happening, Reset puts the dockers back to the default and clears the cache (what was there is kept in backups\\layout-auto-…), then restarts.",
        buttons: ["Reload", "Reset the dockers and the cache, then restart", "Quit"] });
      if (r.response === 0) reload(); else if (r.response === 1) resetAndRestart(); else app.quit();
    } finally { asking = false; }
  });
  win.on("unresponsive", async () => {
    if (asking || win.isDestroyed()) return;
    asking = true;
    logLine(root, "window not responding");
    try {
      const r = await dialog.showMessageBox(win, { type: "warning", title: "bitGen Studio", noLink: true, defaultId: 0, cancelId: 0,
        message: "bitGen Studio's window is not responding.",
        detail: "It may be busy - Wait. If it stays stuck, Reset puts the dockers back to the default and clears the cache (what was there is kept), then restarts.",
        buttons: ["Wait", "Reset the dockers and the cache, then restart"] });
      if (r.response === 1) resetAndRestart();
    } finally { asking = false; }
  });
  app.on("child-process-gone", (_e, d) => { if (d && d.type === "GPU" && d.reason !== "clean-exit") markCrash(app, root, "gpu", d); });
}
module.exports = { CACHES, FILE, plan, read, write, clearCaches, start, arm, booted, requestReset, markCrash, resetNow, watch, logLine };
