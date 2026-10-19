// bitGen Studio — routes/bgp.js (2.436.0): the whole project as a .bgp (lib/bgProject.js). Mounted from
// routes/index.js (never server.js). The page's 📦 button (static/bgp.js) saves the project's state first.
//
//   GET  /api/bgp/estimate?caches=1          {files, bytes, media, mediaBytes, embeddedBytes, manifestBytes, project}
//   POST /api/bgp/export {path?, mode: "embedded" | "manifest", caches}
//        -> {path, size, files, embedded, external, missing}   (no path: projects/<p>/exports/<p>.bgp)
//   GET  /api/bgp/file?path=<…>.bgp          the file (a download for a page that is not on this computer)
//   POST /api/bgp/peek {path}                the file's name / mode / saved / app + a free project name for it
//   POST /api/bgp/import {path, as}          -> a NEW project (never over one): {name, files, written, missing, rewritten, notes}
//   POST /api/bgp/upload?as=<name>           the .bgp's bytes (streamed to disk) -> imported like /import
"use strict";
const fs = require("fs");
const path = require("path");
const core = require("../lib/core");
const projects = require("../lib/projects");
const bgp = require("../lib/bgProject");

const appVersion = () => { try { return require("../package.json").version || ""; } catch { return ""; } };
const fail = (res, e) => res.status(e.status || 500).json({ error: String((e && e.message) || e) });
function bad(msg, status) { const e = new Error(msg); e.status = status || 400; return e; }

/** a project name that is free: the name, else "name (2)", "name (3)"… */
/** the name as its folder is called (core.projDir keeps letters, digits, . _ - and spaces) */
const folderSafe = (n) => String(n || "").replace(/[^A-Za-z0-9._ -]+/g, "_").replace(/^[.\s]+/, "").trim();
function freeName(want) {
  let base = folderSafe(want).slice(0, projects.MAX_NAME - 5) || "imported";
  if (projects.nameError(base)) base = "imported";
  if (!projects.exists(base)) return base;
  for (let i = 2; i < 1000; i++) { const n = `${base} ${i}`; if (!projects.exists(n)) return n; }
  return base + " " + Date.now();
}
function bgpPath(p) {
  const s = path.resolve(String(p || ""));
  if (!/\.bgp$/i.test(s)) throw bad("the file must end in .bgp");
  return s;
}

async function importInto(file, as, near) {
  const head = bgp.peek(file);
  const name = as ? folderSafe(as) : freeName(head.name);
  const err = projects.nameError(name); if (err) throw bad(err);
  if (projects.exists(name)) throw bad(`a project called "${name}" already exists - pick another name`, 409);
  const dst = core.projDir(name), work = dst + ".bgp-part";
  fs.rmSync(work, { recursive: true, force: true });
  let r;
  try { r = await bgp.importFrom(file, work, { near }); }
  catch (e) { fs.rmSync(work, { recursive: true, force: true }); throw e; }
  fs.renameSync(work, dst);
  const notes = [];
  // the project file is named after its folder (lib/projects.js copy() does the same)
  const oldPrj = path.join(dst, (r.name || "").replace(/[^A-Za-z0-9._ -]+/g, "_") + ".prj"), newPrj = core.prjPath(name);
  if (r.name && oldPrj !== newPrj && fs.existsSync(oldPrj) && !fs.existsSync(newPrj)) fs.renameSync(oldPrj, newPrj);
  if (!fs.existsSync(newPrj)) { const any = fs.readdirSync(dst).find((f) => /\.prj$/i.test(f)); if (any) fs.renameSync(path.join(dst, any), newPrj); else notes.push("the file had no project state (.prj) - the project opens empty"); }
  const rewritten = r.fromDir ? projects.rewritePaths(dst, r.fromDir, dst) : 0;
  core.ensureProject(name);
  if (r.missing.length) notes.push(`${r.missing.length} media file(s) were not found on this computer - they are listed in "missing"`);
  if (r.skipped.length) notes.push(`${r.skipped.length} entr(y/ies) with a path outside the project were left out`);
  return { name, files: r.files, written: r.written, missing: r.missing, rewritten, mode: r.mode, from: r.name, saved: r.saved, notes };
}

function mount(app) {
  const express = require("express");
  const J = express.json({ limit: "1mb" });
  app.get("/api/bgp/estimate", (req, res) => {
    try { res.json(Object.assign(bgp.estimate(core.projDir(core.getProject()), { caches: req.query.caches === "1" }), { project: core.getProject(), dir: core.projDir(core.getProject()) })); }
    catch (e) { fail(res, e); }
  });
  app.post("/api/bgp/export", J, async (req, res) => {
    try {
      const b = req.body || {}, p = core.getProject(), pdir = core.projDir(p);
      const out = b.path ? bgpPath(b.path) : path.join(pdir, "exports", p.replace(/[^A-Za-z0-9._ -]+/g, "_") + ".bgp");
      const r = await bgp.exportTo(pdir, out, { embed: b.mode !== "manifest", caches: !!b.caches, name: p, app: appVersion() });
      res.json(Object.assign(r, { project: p, mode: b.mode === "manifest" ? "manifest" : "embedded" }));
    } catch (e) { fail(res, e); }
  });
  app.get("/api/bgp/file", (req, res) => {
    try {
      const p = bgpPath(req.query.path);
      if (!fs.existsSync(p)) throw bad("no such file", 404);
      res.download(p, path.basename(p));
    } catch (e) { fail(res, e); }
  });
  app.post("/api/bgp/peek", J, (req, res) => {
    try {
      const p = bgpPath((req.body || {}).path);
      if (!fs.existsSync(p)) throw bad("no such file", 404);
      const h = bgp.peek(p);
      res.json({ name: h.name || "", mode: h.mode || "", saved: h.saved || "", app: h.app || "", files: +h.files || null, size: fs.statSync(p).size, suggest: freeName(h.name) });
    } catch (e) { fail(res, e); }
  });
  app.post("/api/bgp/import", J, async (req, res) => {
    try {
      const b = req.body || {}, p = bgpPath(b.path);
      if (!fs.existsSync(p)) throw bad("no such file", 404);
      res.json(await importInto(p, b.as));
    } catch (e) { fail(res, e); }
  });
  app.post("/api/bgp/upload", async (req, res) => {
    const tmp = path.join(core.PROJECTS_DIR, ".bgp-upload-" + Date.now() + ".bgp");
    try {
      await new Promise((ok, no) => { const w = fs.createWriteStream(tmp); req.pipe(w); w.on("finish", ok); w.on("error", no); req.on("error", no); });
      res.json(await importInto(tmp, req.query.as));
    } catch (e) { fail(res, e); }
    finally { fs.rmSync(tmp, { force: true }); }
  });
}

module.exports = { mount, freeName, importInto };
