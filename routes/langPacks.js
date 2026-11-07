// bitGen Studio — routes/langPacks.js (2.715.0): LANGUAGE PACKS (lib/langPacks.js) - Settings ▸ Languages and the app's
// language list. Mounted from routes/index.js (never server.js).
// Tim: "lets do number 2, this way we don't have to create all the packs at once - if we could have a master pack so users
// can translate the strings and upload to tigerart for the community it would be ideal"
//   GET  /api/langpacks                 {packs: [{id, name, native, browser, keepAll, words, source, replaces, version, …}]}
//   GET  /api/langpacks/master.zip      the master pack (every part in English, id "xx") to translate
//   GET  /api/langpacks/:id/ui.json     a pack's app words (static/uilang.js loads it)
//   GET  /api/langpacks/:id/coverage    {ui, patterns, guide, shortcuts, help, features, site: {done, total}}
//   GET  /api/langpacks/:id/export.zip  the pack with today's English parts added, its translations kept
//   POST /api/langpacks/check           (the .zip as the body) {pack, warnings, installed} - read, nothing written
//   POST /api/langpacks/install[?replace=1]  (the .zip) {pack, warnings, coverage}; 409 {exists} when installed and no replace
//   POST /api/langpacks/remove          {id} -> {removed}
// 2.716.0 - the community's packs (tigerart.com.au's bitGen Community; lib/community.js packs, community/lib/act_packs.php):
//   GET  /api/langpacks/community       {ok, packs: [{id, code, native, version, by, counts, downloads, installed?: {source,
//                                        version}}], mine?, pending? (admins), signedIn, handle, error?}
//   POST /api/langpacks/community/install  {id, replace?} -> install()'s reply (409 {exists} as for a file)
//   POST /api/langpacks/:id/share       {note?} -> {id, pending, …} - the pack (as installed) to the community, as you
//   POST /api/langpacks/community/delete   {id} -> {deleted} - your upload (an admin: any)
"use strict";
const express = require("express");
const LP = require("../lib/langPacks");
const fail = (res, e) => res.status(e.status || 500).json(Object.assign({ error: String((e && e.message) || e) }, e && e.exists ? { exists: true, id: e.id, native: e.native } : {}));
const zipOut = (res, name, buf) => { res.set("Content-Type", "application/zip"); res.set("Content-Disposition", `attachment; filename="${name}"`); res.set("Cache-Control", "no-store"); res.send(buf); };
const CM = require("../lib/community");
const MAX_SHARE = 5 * 1024 * 1024;                  // the community server's limit (act_packs.php BGC_PACK_MAX)
const cmFail = (res, j) => res.status(j.status && j.status >= 400 ? j.status : 502).json({ error: j.error || "the community server did not answer", signedOut: !!j.signedOut });
const raw = express.raw({ type: () => true, limit: LP.MAX_ZIP + 1024 });

function mount(app) {
  app.get("/api/langpacks", (_req, res) => { try { res.set("Cache-Control", "no-store"); res.json({ packs: LP.list() }); } catch (e) { fail(res, e); } });
  app.get("/api/langpacks/master.zip", (_req, res) => { try { zipOut(res, "bitGen-language-pack-master.zip", LP.masterZip()); } catch (e) { fail(res, e); } });
  app.get("/api/langpacks/:id/ui.json", (req, res) => {
    try {
      const f = LP.files(req.params.id);
      if (!f) return res.status(404).json({ error: "no language pack " + req.params.id });
      res.set("Cache-Control", "no-cache"); res.type("application/json").sendFile(f.ui, (err) => { if (err && !res.headersSent) res.status(404).json({ error: "the pack has no ui.json" }); });
    } catch (e) { fail(res, e); }
  });
  app.get("/api/langpacks/:id/coverage", (req, res) => { try { res.json(LP.coverage(req.params.id)); } catch (e) { fail(res, e); } });
  app.get("/api/langpacks/:id/export.zip", (req, res) => { try { zipOut(res, "bitGen-language-pack-" + req.params.id.replace(/[^A-Za-z0-9-]/g, "") + ".zip", LP.exportZip(req.params.id)); } catch (e) { fail(res, e); } });
  app.post("/api/langpacks/check", raw, (req, res) => {
    try { const r = LP.check(req.body); const was = LP.get(r.pack.id); res.json({ pack: r.pack, warnings: r.warnings, installed: was ? { source: was.source, version: was.version } : null }); } catch (e) { fail(res, e); }
  });
  app.post("/api/langpacks/install", raw, (req, res) => { try { res.json(LP.install(req.body, { replace: String(req.query.replace || "") === "1" })); } catch (e) { fail(res, e); } });
  // ---- 2.716.0: the community's packs
  app.get("/api/langpacks/community", async (_req, res) => {
    try {
      const j = await CM.packs("pack_list", {}), st = CM.state();
      if (!j.ok) return res.json({ ok: false, error: j.error || "the community server did not answer", packs: [], signedIn: !!st.joined, handle: st.handle || "" });
      const mark = (p) => { const have = LP.get(p.code); return Object.assign(p, { installed: have ? { source: have.source, version: have.version } : null }); };
      res.set("Cache-Control", "no-store");
      res.json({ ok: true, packs: (j.packs || []).map(mark), mine: j.mine || null, pending: j.pending || null, signedIn: !!st.joined && !j.signedOut, handle: st.handle || "", maxBytes: j.max_bytes || MAX_SHARE });
    } catch (e) { fail(res, e); }
  });
  app.post("/api/langpacks/community/install", async (req, res) => {
    try {
      const b = req.body || {}, id = parseInt(b.id, 10);
      if (!(id > 0)) return res.status(400).json({ error: "which pack? (id)" });
      const j = await CM.packs("pack_get", { id });
      if (!j.ok || typeof j.zip !== "string") return cmFail(res, j);
      res.json(LP.install(Buffer.from(j.zip, "base64"), { replace: b.replace === true }));
    } catch (e) { fail(res, e); }
  });
  app.post("/api/langpacks/:id/share", async (req, res) => {
    try {
      const zip = LP.shareZip(req.params.id);
      if (zip.length > MAX_SHARE) return res.status(413).json({ error: `the pack is ${(zip.length / 1048576).toFixed(1)} MB - the community takes 5 MB at most` });
      const note = String((req.body || {}).note || "").replace(/\r\n/g, "\n").trim().slice(0, 500);
      const body = { zip: zip.toString("base64"), coverage: LP.coverage(req.params.id) };
      if (note) body.note = note;
      const j = await CM.packs("pack_upload", body);
      if (!j.ok) return cmFail(res, j);
      res.json({ id: j.id, pending: !!j.pending, code: j.code, native: j.native, version: j.version, counts: j.counts });
    } catch (e) { fail(res, e); }
  });
  app.post("/api/langpacks/community/delete", async (req, res) => {
    try { const j = await CM.packs("pack_delete", { id: parseInt((req.body || {}).id, 10) }); if (!j.ok) return cmFail(res, j); res.json({ deleted: j.deleted }); } catch (e) { fail(res, e); }
  });
  app.post("/api/langpacks/remove", (req, res) => { try { res.json(LP.remove((req.body || {}).id)); } catch (e) { fail(res, e); } });
}
module.exports = { mount };
