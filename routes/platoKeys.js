// bitGen Studio — routes/platoKeys.js (3.4.0): BASIC SETTINGS ▸ TEXT ENCODER's LIST. Mounted from routes/index.js (never
// server.js).
// Tim: "add a text encoder dropdown in basic settings to overide the models own ... top option will be styles own".
//   GET /api/platokeys[?refresh=1] -> {encoders: [{file, families: [id], labels: [label]}], online, nodes, url, note}
//     the text encoders the ComfyUI renders go to has that a PlatoKeys key maps onto a style family (lib/platoKeys.js);
//     the page (static/samplerset.js) lists them under "— Style's own —".
"use strict";
function mount(app) {
  app.get("/api/platokeys", async (req, res) => {
    try { res.json(await require("../lib/platoKeys").options({ refresh: req.query.refresh === "1" })); }
    catch (e) { res.json({ encoders: [], online: false, nodes: false, note: String(e.message || e) }); }
  });
}
module.exports = { mount };
