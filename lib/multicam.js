// bitGen Studio — lib/multicam.js (2.416.0): 🎥 MULTI-CAMERA - the angles synced by their sound (scripts/audiosync.py).
// Tim: "continue with the next part please the gap is getting smaller - soon bitgen should be superior".
//
//   sync(names) -> Promise {results: [{name, lag, score, ok, why}]}   names[0] = the reference; lag = seconds after the
//                  reference's start that the other's first second sits (static/multicam.js fromSync places them)
// routes/multicam.js serves POST /api/multicam/sync; the page side is ext/timelinedock/multicam.js (🎥).
"use strict";
const path = require("path");
const { spawn } = require("child_process");

function core() { return require("./core"); }
function bad(msg, status) { const e = new Error(msg); e.status = status || 400; return e; }

function sync(names) {
  const list = (Array.isArray(names) ? names : []).map((x) => path.basename(String(x || ""))).filter(Boolean);
  if (list.length < 2) return Promise.reject(bad("pick at least two angles (clips) to sync"));
  if (list.length > 9) return Promise.reject(bad("at most 9 angles (the keys 1 - 9)"));
  const asr = require("./asr");
  const files = list.map((n) => { const f = asr.findAsset(n); if (!f) throw bad("not in this project: " + n, 404); return f; });
  const c = core();
  const py = ((c.getConfig().paths || {}).python) || (process.platform === "win32" ? "python" : "python3");
  return new Promise((resolve, reject) => {
    const p = spawn(py, [path.join(c.resolvePath("scripts"), "audiosync.py")].concat(files), { stdio: ["ignore", "pipe", "pipe"] });
    let out = "", err = "";
    const kill = setTimeout(() => { try { p.kill(); } catch { /* gone */ } }, 180000);
    p.stdout.on("data", (d) => { out += d; });
    p.stderr.on("data", (d) => { err += d; });
    p.on("error", (e) => { clearTimeout(kill); reject(bad("could not start the sync: " + e.message, 500)); });
    p.on("close", (code) => {
      clearTimeout(kill);
      if (code !== 0) return reject(bad((err.trim().split("\n").pop() || "the sync failed").slice(0, 300), 500));
      try {
        const j = JSON.parse(out);
        resolve({ rate: j.rate, results: (j.results || []).map((r, i) => Object.assign({ name: list[i + 1] }, r, { file: undefined })) });
      } catch { reject(bad("the sync said nothing useful", 500)); }
    });
  });
}

module.exports = { sync };
