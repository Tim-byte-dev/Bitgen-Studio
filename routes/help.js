// bitGen Studio — routes/help.js (2.530.0): the in-app help for the Ctrl+K command palette and the 📖 Help window
// (lib/helpDocs.js, static/palette.js). Mounted from routes/index.js (never server.js).
//   GET /api/help    {sections: [{id, title, md, text}], shortcuts: {groups: [{title, rows: [[key, what]]}]}}
"use strict";
const core = require("../lib/core");
const help = require("../lib/helpDocs");

function mount(app) {
  app.get("/api/help", (_req, res) => {
    try { res.json(help.load(core.BASE)); } catch (e) { res.status(500).json({ error: String((e && e.message) || e) }); }
  });
}
module.exports = { mount };
