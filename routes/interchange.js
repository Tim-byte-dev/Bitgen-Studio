// bitGen Studio — routes/interchange.js (2.407.0): the timeline OUT to other editors and IN from them
// (lib/interchange.js). Mounted from routes/index.js (never server.js). Bodies are sent as text/plain (a timeline or an
// XML can pass the app's 100 KB JSON limit).
//
//   POST /api/interchange/export  {tl, format: fcpxml | fcpx | edl | otio | aaf, fps, tc, w, h, name}
//        2.417.0: aaf -> {ok, file, tracks: {video, audio}, clips, notes} (lib/aaf.js - Avid Media Composer / Pro Tools)
//        -> {ok, file, text, luts}  (also kept as <project>/exports/<name>.<xml | fcpxml | edl | otio>; 2.414.0: each
//        graded clip's look baked as exports/<name>_luts/<clip>_<n>.cube - `luts` lists them)
//   GET  /api/interchange/file/<name>.aaf   2.417.0: the AAF (binary) from exports/
//   POST /api/interchange/import?filename=x.xml&fps=25   (the file's text as the body; .xml, .fcpxml or .edl)
//        -> {ok, tl, name, fps, missing, notes}   the page saves it as a new named timeline
"use strict";
const fs = require("fs");
const path = require("path");
const core = require("../lib/core");
const ix = require("../lib/interchange");
const fcpx = require("../lib/fcpxml");                   // 2.414.0
const aaf = require("../lib/aaf");                       // 2.417.0: Avid / Pro Tools
const clipFx = require("../lib/clipFx");
const FX = require("../static/clipfx.js");

const IMG = /\.(png|jpe?g|webp|bmp|gif|tiff?|jxl)$/i;
const EXT = { fcpxml: "xml", edl: "edl", otio: "otio", fcpx: "fcpxml", aaf: "aaf" };   // 2.414.0: fcpx = Final Cut Pro X's FCPXML; 2.417.0: aaf

function abs(x) {
  const n = path.basename(String(x.name));
  if (x.kind === "image") return path.join(core.pDir("images"), n);
  if (x.kind === "audio" && x.src !== "video") return path.join(core.pDir("sound"), n);   // 2.417.0: a video's sound on a sound layer is in video/
  return path.join(core.pDir(x.src === "video" ? "video" : "output"), n);
}
function find(name, kind) {
  const n = path.basename(String(name || ""));
  const has = (d) => { try { return fs.statSync(path.join(core.pDir(d), n)).isFile(); } catch { return false; } };
  if (IMG.test(n)) return has("images") ? { src: "images", kind: "image" } : null;
  if (kind === "audio") return has("sound") ? { src: "sound", kind: "audio" } : null;
  if (has("video")) return { src: "video", kind: "video" };
  if (has("output")) return { src: "output", kind: "video" };
  return null;
}

function mount(app) {
  const express = require("express");
  const T = express.text({ type: () => true, limit: "64mb" });
  const fail = (res, e) => res.status(e.status || 500).json({ ok: false, error: String((e && e.message) || e) });
  app.post("/api/interchange/export", T, (req, res) => {
    try {
      const b = typeof req.body === "string" && req.body ? JSON.parse(req.body) : (req.body || {});
      const fmt = EXT[b.format] ? b.format : "fcpxml";
      const o = { fps: Number(b.fps) || 25, tc: b.tc, w: +b.w || 1920, h: +b.h || 1080, name: String(b.name || core.getProject() || "timeline"), abs };
      const d = path.join(core.projDir(core.getProject()), "exports");
      fs.mkdirSync(d, { recursive: true });
      const stem = o.name.replace(/[^A-Za-z0-9._ -]+/g, "_").slice(0, 80);
      // 2.414.0: each graded clip's look baked into a .cube beside the XML (lib/fcp7Extras.js names it in the clip)
      const luts = [], baked = new Map();
      o.lut = (c, fx) => {
        const key = FX.lookKey(fx);
        if (baked.has(key)) return baked.get(key);
        const rel = stem + "_luts/" + path.basename(String(c.name)).replace(/\.[^.]+$/, "").replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 50) + "_" + (baked.size + 1) + ".cube";
        try {
          const f = clipFx.bakedLut(fx);
          fs.mkdirSync(path.join(d, stem + "_luts"), { recursive: true });
          fs.copyFileSync(f, path.join(d, rel));
          luts.push(rel); baked.set(key, rel);
          return rel;
        } catch { baked.set(key, null); return null; }
      };
      if (fmt === "aaf") {                                    // 2.417.0: a binary file, written by scripts/aaf_export.py
        const file = stem + ".aaf";
        return aaf.write(b.tl || {}, o, path.join(d, file))
          .then((r) => res.json({ ok: true, file, text: "", luts: [], tracks: { video: r.video_tracks, audio: r.audio_tracks }, clips: r.clips, notes: (r.notes || []).concat(r.skipped || []) }))
          .catch((e) => fail(res, e));
      }
      const text = fmt === "edl" ? ix.toEdl(b.tl || {}, o) : fmt === "otio" ? ix.toOtio(b.tl || {}, o)
        : fmt === "fcpx" ? fcpx.toFcpx(b.tl || {}, o) : ix.toFcpXml(b.tl || {}, o);
      const file = stem + "." + EXT[fmt];
      fs.writeFileSync(path.join(d, file), text);
      res.json({ ok: true, file, text, luts });
    } catch (e) { fail(res, Object.assign(e, { status: e.status || 400 })); }
  });
  // 2.417.0: a binary export (the .aaf) is fetched from the project's exports folder
  app.get("/api/interchange/file/:file", (req, res) => {
    const f = path.basename(String(req.params.file || ""));
    const p = path.join(core.projDir(core.getProject()), "exports", f);
    if (!/^[^/\\]+\.aaf$/i.test(f) || !fs.existsSync(p)) return res.status(404).json({ ok: false, error: "no such export" });
    res.download(p, f);
  });
  app.post("/api/interchange/import", T, (req, res) => {
    try {
      const text = typeof req.body === "string" ? req.body : "";
      const fn = String((req.query || {}).filename || "");
      const o = { fps: Number((req.query || {}).fps) || 25, find };
      const isX = /\.fcpxml$/i.test(fn) || /<fcpxml[\s>]/.test(text.slice(0, 4000));          // 2.414.0: Final Cut Pro X
      const isXml = !isX && (/\.xml$/i.test(fn) || /^\s*(<\?xml|<xmeml)/.test(text));
      if (!text.trim()) throw Object.assign(new Error("the file is empty"), { status: 400 });
      res.json({ ok: true, ...(isX ? fcpx.fromFcpx(text, o) : isXml ? ix.fromFcpXml(text, o) : ix.fromEdl(text, o)) });
    } catch (e) { fail(res, Object.assign(e, { status: e.status || 400 })); }
  });
}

module.exports = { mount };
