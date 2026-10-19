// bitGen Studio — routes/bgfiles.js (2.436.0): the image editor's .bgi and the timeline's .bgv in the project
// (lib/bgFiles.js, lib/bgVideo.js). Mounted from routes/index.js (never server.js).
//
//   POST /api/bgfile/:kind/save?name=<n>     the bytes (octet-stream) -> {name, size}        kind = bgi | bgv
//   GET  /api/bgfile/:kind/list              {files: [{name, size, mtime}]}
//   GET  /api/bgfile/:kind/file/:name        the file
//   POST /api/bgv/save   (text body: JSON {file, timeline, tl})  the open timeline as projects/<p>/bgv/<file>.bgv
//        -> {name, size, nested: [names], media: n, missing: [names]}   (+ its nested timelines, the media list)
//   POST /api/bgv/open?file=<n>.bgv | (text body: the .bgv's XML)   [&apply=1&as=<timeline name>]
//        -> {name, app, saved, project, clips, layers, nested: [{name, exists}], missing: [names], notes}
//        apply: the timeline saved as `as` (activated) + its nested timelines this project lacks -> + {applied: name}
"use strict";
const fs = require("fs");
const path = require("path");
const core = require("../lib/core");
const bgFiles = require("../lib/bgFiles");
const bgVideo = require("../lib/bgVideo");
const timelines = require("../lib/timelines");

const appVersion = () => { try { return require("../package.json").version || ""; } catch { return ""; } };
const fail = (res, e) => res.status(e.status || 500).json({ error: String((e && e.message) || e) });

/** a timeline's nested timelines, through nests inside nests (each once; the outer one itself never) */
function nestedOf(pdir, tl, outer) {
  const out = {}, todo = bgVideo.nestsOf(tl);
  while (todo.length) {
    const n = todo.shift();
    if (n === outer || out[n]) continue;
    const t = timelines.read(pdir, n); if (!t) continue;
    out[n] = t;
    todo.push(...bgVideo.nestsOf(t));
  }
  return out;
}

function mount(app) {
  const express = require("express");
  const T = express.text({ type: () => true, limit: "256mb" });
  app.post("/api/bgfile/:kind/save", express.raw({ type: () => true, limit: bgFiles.KINDS.bgi.max }), (req, res) => {
    try { res.json(bgFiles.save(req.params.kind, req.query.name, req.body)); } catch (e) { fail(res, e); }
  });
  app.get("/api/bgfile/:kind/list", (req, res) => { try { res.json({ files: bgFiles.list(req.params.kind) }); } catch (e) { fail(res, e); } });
  app.get("/api/bgfile/:kind/file/:name", (req, res) => {
    try { res.type("application/octet-stream").sendFile(bgFiles.file(req.params.kind, req.params.name)); } catch (e) { fail(res, Object.assign(e, { status: e.status || 404 })); }
  });

  app.post("/api/bgv/save", T, (req, res) => {
    try {
      const b = typeof req.body === "string" && req.body ? JSON.parse(req.body) : (req.body || {});
      if (!b.tl || typeof b.tl !== "object") throw Object.assign(new Error("no timeline sent"), { status: 400 });
      const pdir = core.projDir(core.getProject()), name = String(b.timeline || "main");
      const nested = nestedOf(pdir, b.tl, name);
      const find = bgVideo.finder(pdir);
      const media = bgVideo.mediaOf(b.tl, find);
      for (const t of Object.values(nested)) for (const m of bgVideo.mediaOf(t, find)) if (!media.some((x) => x.name === m.name)) media.push(m);
      const text = bgVideo.toXml({ tl: b.tl, name, project: core.getProject(), app: appVersion(), nested, media });
      const r = bgFiles.save("bgv", b.file || name, Buffer.from(text, "utf8"));
      res.json(Object.assign(r, { nested: Object.keys(nested), media: media.length, missing: media.filter((m) => !m.found).map((m) => m.name) }));
    } catch (e) { fail(res, Object.assign(e, { status: e.status || 400 })); }
  });

  app.post("/api/bgv/open", T, (req, res) => {
    try {
      const text = req.query.file ? fs.readFileSync(bgFiles.file("bgv", req.query.file), "utf8") : String(req.body || "");
      const v = bgVideo.fromXml(text);
      const pdir = core.projDir(core.getProject()), find = bgVideo.finder(pdir);
      const have = new Set(timelines.list(pdir).map((t) => t.name));
      const all = [v.tl, ...Object.values(v.nested)], seen = new Set(), missing = [];
      for (const t of all) for (const m of bgVideo.mediaOf(t, find)) if (!m.found && !seen.has(m.name)) { seen.add(m.name); missing.push(m.name); }
      const clips = bgVideo.clipsOf(v.tl).length;
      const out = { name: v.name, app: v.app, saved: v.saved, project: v.project, clips,
        layers: { video: 1 + (v.tl.vlayers || []).length, audio: (v.tl.audio || []).length, images: (v.tl.images || []).length },
        nested: Object.keys(v.nested).map((n) => ({ name: n, exists: have.has(n) })), missing, notes: [] };
      if (v.project && v.project !== core.getProject()) out.notes.push(`saved in the project "${v.project}"`);
      if (req.query.apply) {
        const as = timelines.safe(req.query.as || v.name);
        for (const [n, t] of Object.entries(v.nested)) if (!have.has(n) && n !== as) { timelines.write(pdir, n, t); out.notes.push(`added the nested timeline "${n}"`); }
        for (const x of out.nested) if (x.exists) out.notes.push(`kept this project's own "${x.name}" (the nest in the file was not written over it)`);
        timelines.write(pdir, as, v.tl);
        let d = {}; try { d = JSON.parse(fs.readFileSync(core.prjPath(core.getProject()), "utf8")) || {}; } catch { /* new */ }
        d.timeline = as; delete d.tl;
        fs.writeFileSync(core.prjPath(core.getProject()), JSON.stringify(d, null, 2));
        out.applied = as;
      }
      res.json(out);
    } catch (e) { fail(res, Object.assign(e, { status: e.status || 400 })); }
  });
}

module.exports = { mount, nestedOf };
