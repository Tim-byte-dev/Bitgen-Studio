// bitGen Studio — lib/sceneCuts.js (2.408.0): SCENE-CUT DETECTION - where a clip's shots change (ffmpeg's scene score),
// so the timeline can split it there (Premiere's Scene Edit Detection).
// Tim: "... continue with the premier catchup - do whats most useful next".
//
// detect(file, {threshold 0.1..0.9 (0.3), min (seconds between cuts, 0.4)}) -> {cuts: [source seconds], cached}
// cached in <project>/temp/scenecuts/<stem>.json by the file's size + time + the threshold.
"use strict";
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

function bad(msg, status) { const e = new Error(msg); e.status = status || 400; return e; }

function run(file, threshold) {
  return new Promise((resolve, reject) => {
    const p = spawn("ffmpeg", ["-hide_banner", "-nostats", "-i", file, "-an", "-vf", `scale=320:-2,select='gt(scene,${threshold})',showinfo`, "-f", "null", "-"]);
    let err = "";
    p.stderr.on("data", (d) => { err += d; if (err.length > 8e6) err = err.slice(-4e6); });
    p.on("error", (e) => reject(bad("ffmpeg could not run: " + e.message, 500)));
    p.on("close", (code) => {
      if (code !== 0) return reject(bad("ffmpeg could not read " + path.basename(file) + ": " + err.trim().split("\n").pop(), 500));
      const cuts = [];
      err.replace(/Parsed_showinfo[^\n]*pts_time:\s*([\d.]+)/g, (_m, t) => { cuts.push(+t); return ""; });
      resolve(cuts);
    });
  });
}

async function detect(file, opts, cacheDir) {
  const o = opts || {};
  if (!file || !fs.existsSync(file)) throw bad("no such clip", 404);
  const threshold = Math.max(0.05, Math.min(0.9, Number(o.threshold) || 0.3));
  const min = Math.max(0.1, Math.min(10, Number(o.min) || 0.4));
  const st = fs.statSync(file);
  const key = `${st.size}:${Math.round(st.mtimeMs)}:${threshold}`;
  const cf = cacheDir ? path.join(cacheDir, path.basename(file).replace(/[^A-Za-z0-9._ -]+/g, "_") + ".scenecuts.json") : null;
  let raw = null, cached = false;
  if (cf) { try { const j = JSON.parse(fs.readFileSync(cf, "utf8")); if (j.key === key) { raw = j.cuts; cached = true; } } catch { /* none */ } }
  if (!raw) {
    raw = (await run(file, threshold)).map((t) => Math.round(t * 1000) / 1000);
    if (cf) { fs.mkdirSync(cacheDir, { recursive: true }); fs.writeFileSync(cf, JSON.stringify({ key, cuts: raw })); }
  }
  const cuts = [];
  raw.forEach((t) => { if (t > 0.1 && (!cuts.length || t - cuts[cuts.length - 1] >= min)) cuts.push(t); });   // min = between cuts
  return { cuts, threshold, cached };
}

module.exports = { detect };
