// bitGen Studio — routes/solidcraft.js (2.578.0): the 📐 SolidCraft docker's server side (ext/solidcraftdock).
// Mounted from routes/index.js (never server.js). The add-on is lib/solidcraftAddon.js, the project's files
// lib/solidcraftFiles.js.
//   /solidcraft-app/*                     SolidCraft's browser build (<install>/solidcraft/web) - the docker's frame,
//                                         same origin as the app (its command API + private file storage reachable)
//   GET  /api/solidcraft/status           {installed, version, note, url}
//   GET  /api/solidcraft/latest           {version, url, size, newer} - the newest release (asked at most every 6 h)
//   POST /api/solidcraft/install          the download, as the Add-ons job (GET /api/addons/job shows it)
//   POST /api/solidcraft/install-zip      a solidcraft-web-<v>.zip you downloaded (raw bytes) - offline install
//   GET  /api/solidcraft/files            {dir, files: [{name, kind, size, mtime}]}
//   GET  /api/solidcraft/file/:name       a file from projects/<p>/solidcraft
//   POST /api/solidcraft/save?name=<n>    raw bytes -> {name, kind, size, mtime}
//   DELETE /api/solidcraft/file/:name     to the recycle bin
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const express = require("express");
const SA = require("../lib/solidcraftAddon");
const SF = require("../lib/solidcraftFiles");

let latestCache = null;   // {at, r}

/** "0.18.0" newer than "0.17.0"? (pure) */
function newer(a, b) {
  const pa = String(a || "").split(".").map((x) => parseInt(x, 10) || 0), pb = String(b || "").split(".").map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < 3; i++) { if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0); }
  return false;
}

function mount(app) {
  // the build: index.html / sw.js / build.json never cached (an update is seen at once), the rest by the browser
  app.use("/solidcraft-app", (req, res, next) => {
    if (!SA.status().installed) return res.status(404).type("html").send("<p style=\"font:14px sans-serif;padding:20px\">SolidCraft is not installed - install it in the 📐 SolidCraft docker or Settings ▸ Add-ons.</p>");
    next();
  }, (req, res, next) => express.static(SA.webDir(), {
    setHeaders: (r, p) => { if (/(index\.html|sw\.js|build\.json)$/.test(p)) r.setHeader("Cache-Control", "no-cache"); },
  })(req, res, next));

  app.get("/api/solidcraft/status", (_req, res) => res.json(Object.assign(SA.status(), { url: "/solidcraft-app/index.html" })));
  app.get("/api/solidcraft/latest", async (req, res) => {
    try {
      if (!latestCache || Date.now() - latestCache.at > 6 * 3600e3 || req.query.fresh) latestCache = { at: Date.now(), r: await SA.latest() };
      const st = SA.status(), r = latestCache.r;
      res.json(Object.assign({}, r, { installed: st.version, newer: !!(r.version && st.installed && newer(r.version, st.version)) }));
    } catch (e) { res.json({ error: String(e.message || e) }); }
  });
  const A = () => require("../lib/addons");
  app.post("/api/solidcraft/install", (_req, res) => {
    const r = A().start("solidcraft", "install", {});
    if (r.error) return res.status(/already/.test(r.error) ? 409 : 400).json(r);
    res.json({ ok: true });
  });
  app.post("/api/solidcraft/install-zip", express.raw({ type: () => true, limit: 200 * 1024 * 1024 }), (req, res) => {
    const buf = req.body;
    if (!Buffer.isBuffer(buf) || !buf.length) return res.status(400).json({ error: "no zip was sent" });
    const c = SA.checkZip(buf);
    if (!c.ok) return res.status(400).json({ error: c.error });
    const tmp = path.join(os.tmpdir(), `solidcraft-upload-${Date.now()}.zip`);
    fs.writeFileSync(tmp, buf);
    const r = A().startJob("solidcraft", "install", async (log) => { try { return await SA.install(log, { zip: tmp }); } finally { fs.rmSync(tmp, { force: true }); } });
    if (r.error) { fs.rmSync(tmp, { force: true }); return res.status(409).json(r); }
    res.json({ ok: true, version: c.version });
  });

  app.get("/api/solidcraft/files", (_req, res) => { try { res.json({ dir: SF.dir(), files: SF.list() }); } catch (e) { res.status(500).json({ error: e.message }); } });
  app.get("/api/solidcraft/file/:name", (req, res) => {
    try { res.set("Cache-Control", "no-store"); res.sendFile(SF.file(req.params.name)); } catch (e) { res.status(e.status || 404).json({ error: e.message }); }
  });
  app.post("/api/solidcraft/save", express.raw({ type: () => true, limit: SF.MAX }), (req, res) => {
    try { res.json(SF.save(req.query.name, req.body)); } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
  });
  app.delete("/api/solidcraft/file/:name", (req, res) => {
    try { res.json(SF.remove(req.params.name)); } catch (e) { res.status(e.status || 404).json({ error: e.message }); }
  });
}

module.exports = { mount, newer };
