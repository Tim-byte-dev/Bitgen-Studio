// bitGen Studio — routes/pih3.js (3.5.0): pi-H3 - what is installed. Mounted from routes/index.js (never server.js).
// Tim: "can u add https://hanshengchen.com/blog/pi-h3/ , when asking the user to download, let user choose which model to dl".
//   GET /api/pih3 -> {installed, have: {dwd2, dwd4}, nodes, kjsol, items, note} (lib/pih3Addon.js status) - static/pih3gen.js
//   asks it before a pi-H3 style renders; static/needinstall.js's box lists the items to tick.
"use strict";
function mount(app) {
  app.get("/api/pih3", (_req, res) => {
    try { res.json(require("../lib/pih3Addon").status()); }
    catch (e) { res.json({ installed: false, have: {}, items: [], note: String(e.message || e) }); }
  });
}
module.exports = { mount };
