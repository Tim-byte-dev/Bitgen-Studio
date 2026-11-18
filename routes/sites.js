// routes/sites.js — 🌐 websites from the image editor's pages (2.843.0, lib/siteBuild.js). Mounted from routes/index.js.
//   GET  /api/sites                  -> {sites}
//   POST /api/sites/save   {name, title, stack, lang, pages, assets}   -> {site}
//   POST /api/sites/build  {name, ai}                                 -> {pages: [{slug, by}], preview}
//   GET  /api/sites/zip?name=        -> the built website as a .zip
//   GET  /sites-preview/<name>/<file> the static preview
//   GET  /api/sites/products?name=   -> {products: [{name, slug, price, image, has}]}   2.853.0: the shop's planned products
//   GET  /api/sites/asset?name=&file= a picture of the site (its assets/)
//   POST /api/sites/product-picture {name, slug, b64, ext} -> {image}   a product's picture replaced (✏ edited in the studio)
"use strict";
const express = require("express");
function mount(app) {
  const S = () => require("../lib/siteBuild");
  const wrap = (fn) => async (req, res) => { try { res.json(await fn(req)); } catch (e) { res.status(e.status || 500).json({ error: e.message || String(e) }); } };
  app.get("/api/sites", wrap(() => ({ sites: S().list() })));
  app.post("/api/sites/save", express.json({ limit: "400mb" }), wrap((req) => ({ site: S().save(req.body) })));
  app.post("/api/sites/build", express.json({ limit: "1mb" }), wrap((req) => S().build(req.body.name, { ai: req.body.ai !== false })));
  app.get("/api/sites/zip", async (req, res) => { try { const b = await S().zip(req.query.name); res.set("Content-Disposition", `attachment; filename="${String(req.query.name).replace(/[^\w .-]/g, "_")}.zip"`).type("application/zip").send(b); } catch (e) { res.status(e.status || 500).json({ error: e.message }); } });
  app.get("/api/sites/products", wrap((req) => ({ products: S().products(req.query.name) })));
  app.get("/api/sites/asset", (req, res) => { try { res.set("Cache-Control", "no-store").sendFile(S().assetFile(req.query.name, req.query.file)); } catch (e) { res.status(e.status || 500).json({ error: e.message }); } });
  app.post("/api/sites/product-picture", express.json({ limit: "60mb" }), wrap((req) => S().putProductPicture(req.body)));
  app.get(/^\/sites-preview\/([^/]+)\/(.*)$/, (req, res) => { try { res.sendFile(S().previewFile(decodeURIComponent(req.params[0]), decodeURIComponent(req.params[1] || "index.html"))); } catch (e) { res.status(e.status || 500).type("text/plain").send(e.message); } });
}
module.exports = { mount };
