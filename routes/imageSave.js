// bitGen Studio — routes/imageSave.js (2.604.0): the image editor's 💾 Save to Images (lib/imageSave.js).
// Tim: "when user clicks save to images in image-editor, save all the visible the file as a tmp file then flatten the
// file and save as the image format selected, load it in gallery and assets".
//   POST /api/imagesave/tmp?name=<stem>                   body = PNG (all visible layers)  -> {ok, tmp}
//   POST /api/imagesave?name=<name>&ext=<png|jpg|…>&tmp=<tmp>  body = the flattened picture -> {ok, name, asset, gallery}
"use strict";
const express = require("express");
const S = require("../lib/imageSave");

function mount(app) {
  const raw = express.raw({ type: () => true, limit: 400 * 1024 * 1024 });
  const fail = (res, e) => res.status(e.status || 500).json({ error: String((e && e.message) || e) });
  app.post("/api/imagesave/tmp", raw, (req, res) => {
    try { res.json(S.tmp(req.body, String(req.query.name || "edited"))); } catch (e) { fail(res, e); }
  });
  app.post("/api/imagesave", raw, (req, res) => {
    try { res.json(S.finish(req.body, { name: String(req.query.name || "edited"), ext: String(req.query.ext || "png"), tmp: req.query.tmp ? String(req.query.tmp) : "" })); } catch (e) { fail(res, e); }
  });
}
module.exports = { mount };
