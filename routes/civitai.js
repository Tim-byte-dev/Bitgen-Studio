// bitGen Studio — routes/civitai.js (2.518.0): Civitai search / download / look up (lib/civitai.js).
// Mounted from routes/index.js (never server.js).
//   GET  /api/civitai/test                       {ok, user, site} - is the key good
//   GET  /api/civitai/search?query&types&sort&baseModels&cursor   {items, next}
//   POST /api/civitai/download {version_id, file_id?, subfolder?, title?, folder?}   -> {download}  (2.538.0 folder = a model_folders.json key)
//   GET  /api/civitai/downloads                  [{id, name, status, got, total, cat, dest, note, error}]
//   POST /api/civitai/lookup   {key}             look a model you have up by its SHA-256
//   GET  /api/civitai/lookups                    [{key, status, got, total, error}]
//   GET  /api/civitai/img?u=<url>                one Civitai picture through the app (Civitai's hosts only)
"use strict";
const cv = require("../lib/civitai");

function mount(app) {
  const fail = (res, e) => res.status(e.status && e.status < 600 ? e.status : 500).json({ error: String((e && e.message) || e) });
  app.get("/api/civitai/test", async (_req, res) => { try { res.json(await cv.test()); } catch (e) { fail(res, e); } });
  app.get("/api/civitai/search", async (req, res) => { try { res.json(await cv.search(req.query || {})); } catch (e) { fail(res, e); } });
  app.post("/api/civitai/download", (req, res) => {
    try { const r = cv.download(req.body || {}); if (r.error) return res.status(400).json(r); res.json(r); } catch (e) { fail(res, e); }
  });
  app.get("/api/civitai/downloads", (_req, res) => { try { res.json(cv.downloads()); } catch (e) { fail(res, e); } });
  app.post("/api/civitai/lookup", (req, res) => {
    try { const r = cv.lookup(String((req.body || {}).key || "")); if (r.error) return res.status(400).json(r); res.json(r); } catch (e) { fail(res, e); }
  });
  app.get("/api/civitai/lookups", (_req, res) => { try { res.json(cv.lookupState()); } catch (e) { fail(res, e); } });
  app.get("/api/civitai/img", (req, res) => { cv.image(req.query.u, res); });
}
module.exports = { mount };
