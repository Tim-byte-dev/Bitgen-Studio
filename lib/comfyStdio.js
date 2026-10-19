"use strict";
/* lib/comfyStdio.js — WHERE A ComfyUI WE LAUNCH WRITES ITS CONSOLE (2.100.0).
 *
 * THE BUG THIS EXISTS FOR. On Windows a ComfyUI started with PIPED stdio and
 * no console dies mid-sampling with `OSError: [Errno 22] Invalid argument`
 * (ComfyUI-Manager #2458): tqdm starts writing a progress bar to stderr the
 * moment the sampler runs, and the flush on that handle fails. Three
 * releases treated it as VRAM; 2.99.3's size sweep (a 3 s clip failing on an
 * empty card) closed that door. The env-var mitigations (PYTHONUNBUFFERED,
 * TQDM_DISABLE) only reach a ComfyUI that H3 spawns, and only avoid the flush
 * rather than making it legal.
 *
 * TWO WAYS OUT, both here, one setting (`engine.comfy.stdio`):
 *   "file"    (default) stdout+stderr go to a FILE (<H3>/comfy.log) that the
 *             app tails into its console. A file handle is always a valid
 *             stdio target — a write to it cannot raise [Errno 22] — and
 *             nothing depends on a pipe being drained.
 *   "console" ComfyUI gets a REAL console window of its own (detached +
 *             windowsHide:false). That is the configuration Tim's own hand-
 *             started ComfyUI has, and the one every render has survived in.
 *             Nothing is captured; the window IS the log.
 * Settings -> ComfyUI carries the choice and a "relaunch in a real console"
 * button (stop the managed one, start it again in console mode).
 *
 * Kept out of lib/comfy.js so the spawn-option logic is unit-testable without
 * spawning anything. Nothing here touches a ComfyUI file.
 */
const fs = require("fs");
const path = require("path");

const MODES = ["file", "console"];
const LOG_NAME = "comfy.log";
const TAIL_MS = 400;

/** Normalise engine.comfy.stdio; junk -> "file". */
function stdioMode(comfyCfg) {
  const v = String((comfyCfg || {}).stdio || "").trim().toLowerCase();
  return MODES.includes(v) ? v : "file";
}

function logPath(base) { return path.join(base, LOG_NAME); }

/** Truncate + open the log file for the child. Returns {fd, path}. */
function openLogFile(base) {
  const p = logPath(base);
  const fd = fs.openSync(p, "w");          // fresh file per launch
  return { fd, path: p };
}

/**
 * Spawn options for one launch. `env` is the launch environment built by
 * lib/comfy.js (PYTHONUNBUFFERED / PYTHONIOENCODING / TQDM_DISABLE).
 *  - file:    stdio ["ignore", fd, fd], windowsHide (no console at all).
 *  - console: stdio "ignore", detached, windowsHide:false -> on Windows the
 *             child gets its own console window (CREATE_NEW_CONSOLE via
 *             detached). TQDM_DISABLE is NOT forced there: a real console can
 *             take a progress bar, and the decisive Errno-22 test wants tqdm
 *             running. The user's own TQDM_DISABLE, if set, still applies.
 */
function spawnOptions(mode, { cwd, env, fd, userEnv = process.env } = {}) {
  if (mode === "console") {
    const e = { ...env };
    if (!userEnv.TQDM_DISABLE) delete e.TQDM_DISABLE;
    return { cwd, env: e, stdio: "ignore", detached: true, windowsHide: false };
  }
  return { cwd, env, stdio: ["ignore", fd, fd], windowsHide: true };
}

/**
 * Tail a file into `onLine`, from `fromByte`. Polling, not fs.watch: on
 * Windows fs.watch fires unreliably for a file another process holds open.
 * Returns stop(). Never throws once started — a vanished file is just quiet.
 */
function tailFile(p, onLine, fromByte = 0) {
  let pos = fromByte, rest = "", stopped = false;
  const tick = (final) => {
    if (stopped && !final) return;
    try {
      const st = fs.statSync(p);
      if (st.size < pos) { pos = 0; rest = ""; }        // truncated: restart
      if (st.size > pos) {
        const fd = fs.openSync(p, "r");
        try {
          const buf = Buffer.alloc(st.size - pos);
          const n = fs.readSync(fd, buf, 0, buf.length, pos);
          pos += n;
          rest += buf.toString("utf8", 0, n);
        } finally { fs.closeSync(fd); }
        const lines = rest.split(/\r?\n|\r/);
        rest = lines.pop();
        for (const l of lines) if (l.length) onLine(l);
      }
    } catch { /* not there yet / being rotated: try again next tick */ }
  };
  const t = setInterval(tick, TAIL_MS);
  if (t.unref) t.unref();
  return () => { if (stopped) return; stopped = true; clearInterval(t); tick(true);
                 if (rest) { onLine(rest); rest = ""; } };
}

/** Last `n` lines of the log file (for a status reply after the tail is gone). */
function tailLines(base, n = 40) {
  try {
    const s = fs.readFileSync(logPath(base), "utf8");
    return s.split(/\r?\n/).filter(Boolean).slice(-n);
  } catch { return []; }
}

module.exports = { MODES, LOG_NAME, stdioMode, logPath, openLogFile, spawnOptions, tailFile, tailLines };
