// bitGen Studio — routes/layerScene.js (3.14.0): 🏞 Scene in Layers (the image editor's ext/imageeditdock/pcscene.js).
//   POST /api/layerscene/plan {ask, mode "photo" | "poster"} -> {plan} - the LLM plans the layers (lib/layerScene.js)
// The pictures themselves go through the editor's usual /api/genimage (each layer) and /api/aiedit (photo: each object pulled
// out of the one scene by the edit model). Mounted from routes/index.js (never server.js).
"use strict";
function mount(app) {
  app.post("/api/layerscene/plan", require("express").json({ limit: "1mb" }), async (req, res) => {
    try { res.json(await require("../lib/layerScene").plan(req.body || {})); }
    catch (e) { res.status(e.status || 500).json({ error: String(e.message || e) }); }
  });
}
module.exports = { mount };
