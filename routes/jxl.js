/* bitGen Studio — routes/jxl.js (2.479.0): JPEG XL (.jxl) for the browser.
 * Tim (verbatim): "add jxl file support".
 *   (every request)       lib/jxl.js sendFileShim: a .jxl that a route sends to an <img> goes as a PNG
 *   POST /api/jxl/topng   the raw .jxl bytes -> image/png (X-Width / X-Height / X-Animated)
 *   GET  /api/jxl/png?path=<a file on this computer>   a .jxl file -> its PNG (cached) - the file dialog's previews
 *   GET  /api/jxl/status  {ok, cache}
 */
"use strict";
const fs = require("fs");
const path = require("path");
const express = require("express");
const jxl = require("../lib/jxl");

function mount(app) {
  app.use(jxl.sendFileShim);
  app.post("/api/jxl/topng", express.raw({ type: () => true, limit: 512 * 1024 * 1024 }), async (req, res) => {
    try {
      const r = await jxl.toPng(req.body || Buffer.alloc(0));
      res.set({ "X-Width": String(r.width), "X-Height": String(r.height), "X-Animated": r.animated ? "1" : "0", "Cache-Control": "no-store" });
      res.type("image/png").send(r.png);
    } catch (e) { res.status(415).json({ error: e.message }); }
  });
  app.get("/api/jxl/png", async (req, res) => {
    const p = String(req.query.path || "");
    if (!p || !jxl.isJxlName(p) || !path.isAbsolute(p) || !fs.existsSync(p)) return res.status(404).json({ error: "no such .jxl file" });
    try { const out = await jxl.pngFile(p); res.set("Cache-Control", "no-store"); res.type("image/png").sendFile(out, { dotfiles: "allow" }); }
    catch (e) { res.status(415).json({ error: e.message }); }
  });
  app.get("/api/jxl/status", (_req, res) => res.json({ ok: true, cache: jxl.cacheDir() }));
}
module.exports = { mount };
