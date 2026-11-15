// bitGen Studio — routes/famFilter.js (2.788.0): Basic Settings' Override lists filtered by the prompt docker's styles
// (lib/famFilter.js, static/famfilter.js).
//   POST /api/famfilter {image: <image style id>, video: <video style id>, files: [{cat, name}]}
//        -> {rules: {image, video}, info: {"<cat>|<name>": {family, category}}}
//        rules: famFilter.rule (families [] = no filter - no style picked, a custom architecture); info: each file's
//        family + type from the 🧩 Model manager's cards, else its name (5000 files at most)
"use strict";
const FF = require("../lib/famFilter");

function styleOf(kind, id) {
  if (!id) return null;
  try {
    const C = require("../lib/core"), S = require("../lib/styles");
    return S.read(C.STYLES_DIR, kind).find((s) => s && (s.id === id || s.name === id)) || null;
  } catch { return null; }
}

function mount(app) {
  app.post("/api/famfilter", (req, res) => {
    try {
      const b = req.body || {};
      const rules = { image: FF.rule(styleOf("image", String(b.image || "")), "image"),
                      video: FF.rule(styleOf("video", String(b.video || "")), "video") };
      const files = (Array.isArray(b.files) ? b.files : []).slice(0, 5000);
      const info = {};
      if (files.length) {
        const cards = FF.cards(), invs = FF.invs();
        for (const f of files) {
          if (!f || !f.name) continue;
          const k = String(f.cat || "") + "|" + String(f.name);
          if (!info[k]) info[k] = FF.info(String(f.cat || ""), String(f.name), cards, invs);
        }
      }
      res.json({ rules, info });
    } catch (e) { res.status(500).json({ error: String(e.message || e) }); }
  });
}
module.exports = { mount, styleOf };
