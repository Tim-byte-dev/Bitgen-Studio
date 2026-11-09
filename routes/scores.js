/* bitGen Studio — the project's sheet music (2.731.0, lib/scores.js). Mounted from routes/index.js (never server.js).
 *
 *   GET /api/scores    {files: [{name, size, mtime, audio?, stems?}], songs: [{name, src, mtime, size, layers?}]}  the
 *                      project's .abc scores, newest first; 2.738.0: its songs (any audio that is not a layer) and their layers (each one is read with
 *                      GET /outputs/:name and engraved in the page - static/abcscore.js; 💾 Save PDF posts the PDF to
 *                      POST /api/pdf/save, the project's pdf folder) */
"use strict";
const scores = require("../lib/scores");

function mount(app) {
  app.get("/api/scores", (_req, res) => {
    // 2.738.0: + the project's songs and their layers
    try { res.json({ files: scores.list(), songs: scores.songs() }); } catch (e) { res.status(500).json({ error: String((e && e.message) || e) }); }
  });
}

module.exports = { mount };
