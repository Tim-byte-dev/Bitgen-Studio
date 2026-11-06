// bitGen Studio — routes/help.js (2.530.0): the in-app help for the Ctrl+K command palette and the 📖 Help window
// (lib/helpDocs.js, static/palette.js). Mounted from routes/index.js (never server.js).
//   GET /api/help[?lang=zh-CN|ja]   {lang, stale, missing, sections: [{id, title, md, text, lang, stale, enTitle}],
//                                    shortcuts: {groups: [{title, rows: [[key, what]], lang, stale}]}}
//   GET /api/help/page?topic=timeline[&lang=…]   {html, lang, stale} - a ❔ help page (static/help/<lang>/<topic>.html)
// 2.703.0: the guide + help in Simplified Chinese and Japanese (lib/helpI18n.js - a section not translated comes in English).
"use strict";
const core = require("../lib/core");
const i18n = require("../lib/helpI18n");

function mount(app) {
  app.get("/api/help", (req, res) => {
    try { res.json(i18n.load(core.BASE, String((req.query && req.query.lang) || ""))); } catch (e) { res.status(500).json({ error: String((e && e.message) || e) }); }
  });
  app.get("/api/help/page", (req, res) => {
    try {
      const p = i18n.page(core.BASE, String((req.query && req.query.topic) || ""), String((req.query && req.query.lang) || ""));
      if (!p) return res.status(404).json({ error: "no help page " + String(req.query.topic || "") });
      res.json(p);
    } catch (e) { res.status(500).json({ error: String((e && e.message) || e) }); }
  });
}
module.exports = { mount };
