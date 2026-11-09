/* bitGen Studio — the project's sheet music (2.731.0, lib/scores.js). Mounted from routes/index.js (never server.js).
 *
 *   GET /api/scores    {files: [{name, size, mtime, audio?, stems?}]}  the project's .abc scores, newest first (each one is read with
 *                      GET /outputs/:name and engraved in the page - static/abcscore.js; 💾 Save PDF posts the PDF to
 *                      POST /api/pdf/save, the project's pdf folder) */
"use strict";
const scores = require("../lib/scores");

function mount(app) {
  app.get("/api/scores", (_req, res) => {
    try { res.json({ files: scores.list() }); } catch (e) { res.status(500).json({ error: String((e && e.message) || e) }); }
  });
}

module.exports = { mount };
