// bitGen Studio — routes/tlCanvas.js (2.377.0): the timeline's preview canvas.
//
// Tim: "Add a preview canvas to the timeline docker. user can drag videos, pictures and audio into the canvas and it
// gets placed on a separate layer. user will be able to enter text and edit text."
//
// 2.380.0: + the ✨ Fill's layer pictures and masked videos (below, lib/tlFill.js).
// A TEXT layer is an image clip whose picture the page draws (ext/timelinedock/canvas.js) - the canvas shows the same
// drawing live, and the compile overlays this PNG like any image layer (with the clip's position / scale / rotation).
//   POST /api/tlcanvas/text?id=<id>   body = the PNG bytes (Content-Type image/png - the app's JSON parser caps at
//                                     100 kB) -> projects/<p>/images/text_<id>.png, rewritten in place on every
//                                     edit, so a text layer never piles up copies
//   2.379.0: ?variant=w -> text_<id>_w.png, the same text with a WHITE fill (written when the layer's colour is
//                         keyframed): the compile tints it frame by frame to the tweened colour
// 2.382.0: + the 3D layers (lib/m3d.js; the page: static/m3d.js + ext/timelinedock/m3d.js)
//   POST /api/tlcanvas/model?name=<file>  raw bytes -> models3d/<file> (.fbx / .obj, or the .mtl / textures beside it)
//   GET  /api/tlcanvas/models             the project's models [{name, size}]
//   GET  /api/tlcanvas/textures           the pictures in models3d/ (2.385.0: a 3D material's texture)
//   GET  /api/tlcanvas/model/<file>       a model file (the loaders find an OBJ's .mtl and textures beside it)
//   GET  /api/tlcanvas/font?family=&bold=1&italic=1   the font file for 3D text (the machine's own fonts)
//   POST /api/tlcanvas/m3d/frame?id=&i=   raw PNG -> one baked frame (frame 0 starts the bake afresh)
//   POST /api/tlcanvas/m3d/encode         {id, fps, frames} -> video/m3d_<id>.webm (see-through) {name, dur, frames}
const fs = require("fs");
const path = require("path");
const core = require("../lib/core");

const MAX = 24 * 1024 * 1024;

function mount(app) {
  app.post("/api/tlcanvas/text", require("express").raw({ type: "image/png", limit: MAX }), (req, res) => {
    const id = String(req.query.id || "").replace(/[^A-Za-z0-9_-]+/g, "").slice(0, 40);
    if (!id) return res.status(400).json({ error: "a text layer id is required" });
    const buf = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    if (!buf.length) return res.status(400).json({ error: "send the text picture as image/png" });
    if (buf.slice(0, 8).toString("hex") !== "89504e470d0a1a0a") return res.status(400).json({ error: "not a PNG" });
    try {
      core.ensureProject(core.getProject());
      const dir = core.pDir("images");
      fs.mkdirSync(dir, { recursive: true });
      const name = `text_${id}${String(req.query.variant || "") === "w" ? "_w" : ""}.png`;
      fs.writeFileSync(path.join(dir, name), buf);
      res.json({ ok: true, name, bytes: buf.length });
    } catch (e) { res.status(500).json({ error: String(e && e.message || e) }); }
  });

  // 2.380.0 the ✨ Fill (ext/timelinedock/fill.js, lib/tlFill.js)
  //   POST /api/tlcanvas/layer?id=<id>    raw PNG -> images/layer_<id>.png (a filled area, its feathered mask as alpha;
  //                                       also the mask itself for a video fill)
  //   POST /api/tlcanvas/maskvideo        {id, output, mask, width, height} -> video/fillv_<id>.webm (alpha) {name, dur}
  app.post("/api/tlcanvas/layer", require("express").raw({ type: "image/png", limit: MAX }), (req, res) => {
    try { res.json({ ok: true, ...require("../lib/tlFill").saveLayer(req.query.id, req.body) }); }
    catch (e) { res.status(e.status || 500).json({ error: String(e && e.message || e) }); }
  });
  app.post("/api/tlcanvas/maskvideo", async (req, res) => {
    try { res.json({ ok: true, ...(await require("../lib/tlFill").maskVideo(req.body || {})) }); }
    catch (e) { res.status(e.status || 500).json({ error: String(e && e.message || e) }); }
  });

  // 2.382.0 the 3D layers
  const M = () => require("../lib/m3d");
  const fail = (res, e) => res.status(e.status || 500).json({ error: String(e && e.message || e) });
  app.post("/api/tlcanvas/model", require("express").raw({ type: () => true, limit: 512 * 1024 * 1024 }), (req, res) => {
    try { res.json({ ok: true, ...M().saveModel(req.query.name, req.body) }); } catch (e) { fail(res, e); }
  });
  app.get("/api/tlcanvas/models", (_req, res) => { try { res.json({ models: M().listModels() }); } catch (e) { fail(res, e); } });
  // 2.385.0: the pictures in models3d/ - a 3D material's texture
  app.get("/api/tlcanvas/textures", (_req, res) => { try { res.json({ textures: M().listTextures() }); } catch (e) { fail(res, e); } });
  app.get("/api/tlcanvas/model/:name", (req, res) => {
    const p = M().modelPath(req.params.name);
    if (!p) return res.status(404).json({ error: "no such file in this project's models3d" });
    res.sendFile(p);
  });
  app.get("/api/tlcanvas/font", (req, res) => {
    const f = M().fontFile(req.query.family, req.query.bold === "1", req.query.italic === "1");
    if (!f) return res.status(404).json({ error: "no font files on this computer" });
    res.set("X-Font-File", path.basename(f));
    res.sendFile(f);
  });
  app.post("/api/tlcanvas/m3d/frame", require("express").raw({ type: "image/png", limit: MAX }), (req, res) => {
    try { res.json({ ok: true, ...M().saveFrame(req.query.id, req.query.i, req.body) }); } catch (e) { fail(res, e); }
  });
  app.post("/api/tlcanvas/m3d/encode", async (req, res) => {
    const b = req.body || {};
    try { res.json({ ok: true, ...(await M().encode(b.id, b)) }); } catch (e) { fail(res, e); }
  });
}

module.exports = { mount };
