// bitGen Studio — locating and running the per-tool Python venvs.
//
// OmniVoice and faster-whisper each get their OWN venv (venvs/omnivoice,
// venvs/whisper). They are kept apart deliberately: they pin different torch
// stacks, and one broken shared venv would take both features down. (2.264.0:
// venvs/openaudio is no longer created; an existing one is simply unused.)
// whenever either upgraded.
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const core = require("./core");

const IS_WIN = process.platform === "win32";

function venvDir(which, configured) {
  const d = configured && configured.trim() ? configured.trim() : path.join("venvs", which);
  return core.resolvePath(d);
}
function venvPython(dir) {
  return path.join(dir, IS_WIN ? "Scripts" : "bin", IS_WIN ? "python.exe" : "python");
}
function venvReady(which, configured) {
  const dir = venvDir(which, configured);
  const py = venvPython(dir);
  return { dir, python: py, ready: fs.existsSync(py) };
}

// Run a helper script inside a venv and parse the single JSON line it prints.
// stderr is streamed to `onLog` so a slow model load is visible rather than
// looking like a hang.
function runJson(python, script, job, opts) {
  const o = opts || {};
  return new Promise((resolve, reject) => {
    const tmp = path.join(require("os").tmpdir(), `h3job_${Date.now().toString(36)}.json`);
    fs.writeFileSync(tmp, JSON.stringify(job));
    const p = spawn(python, [script, tmp], { env: { ...process.env, ...(o.env || {}) } });
    let out = "", err = "";
    void out;
    // On timeout, hand back the last thing the child said. fish-speech's
    // launch_thread_safe_queue does init_event.wait() with NO timeout, so if
    // the model load throws inside its worker thread the event is never set
    // and the process hangs forever — the loguru traceback on stderr is the
    // only evidence of why, and it would otherwise be thrown away.
    const timer = setTimeout(() => {
      p.kill();
      const tail = err.trim().split("\n").filter(Boolean).slice(-6).join(" | ");
      reject(new Error(
        `gave up after ${Math.round((o.timeout_ms || 0) / 1000)}s`
        + (tail ? `. Last output: ${tail}` : ". The process produced no output at all.")));
    }, o.timeout_ms || 1800000);
    p.stdout.on("data", (d) => { out += d; });
    p.stderr.on("data", (d) => {
      err += d;
      if (o.onLog) String(d).split("\n").filter(Boolean).forEach(o.onLog);
    });
    p.on("error", (e) => { clearTimeout(timer); reject(new Error(
      `could not run ${path.basename(python)}: ${e.message}`)); });
    p.on("close", (code) => {
      clearTimeout(timer);
      try { fs.unlinkSync(tmp); } catch {}
      const line = out.trim().split("\n").filter(Boolean).pop() || "";
      let j = null;
      try { j = JSON.parse(line); } catch {}
      if (j && j.error) return reject(new Error(j.error));
      if (code !== 0 || !j) {
        const tail = (err.trim().split("\n").slice(-3).join(" | ")) || `exit ${code}`;
        return reject(new Error(tail));
      }
      resolve(j);
    });
  });
}

module.exports = { IS_WIN, venvDir, venvPython, venvReady, runJson };
