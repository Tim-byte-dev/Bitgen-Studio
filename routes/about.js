// bitGen Studio — routes/about.js (2.642.0): Settings ▸ About (static/about.js) - the version and the credits (lib/credits.js).
// Mounted from routes/index.js.
//   GET /api/about   {name, version, about, credits: [{role, name}], thanks, sections, licence}
"use strict";
const credits = require("../lib/credits");

function mount(app) {
  app.get("/api/about", (_req, res) => { try { res.json(credits.about()); } catch (e) { res.status(500).json({ error: String((e && e.message) || e) }); } });
}
module.exports = { mount };
