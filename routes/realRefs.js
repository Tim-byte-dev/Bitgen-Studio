// bitGen Studio — routes/realRefs.js (2.540.0): Blender / Unreal renders made real with the reference docker's pictures
// (lib/realRefs.js, static/realrefs.js). Mounted from routes/index.js (never server.js).
//   GET  /api/realrefs/styles                 the edit styles + how many pictures each takes [{id, name, slots, max}]
//   POST /api/realrefs/upload                 multipart ref0..ref6 + refs (JSON [{desc, role, name}]) -> {token, refs}
//   POST /api/realrefs/start                  multipart: frame (a PNG - the image editor's layer) + spec (JSON {kind,
//                                             token, items, style_id, prompt, source, video_asset?, seconds?, ltx?})
//                                             or JSON spec; kind video + video_asset (a Video asset - an Unreal clip):
//                                             its first frame is read with ffmpeg -> {id, edit, take, left, note, prompt}
//   GET  /api/realrefs/:id                    {state: edit | real | done | error, edit, real, picture, error, note}
"use strict";
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const core = require("../lib/core");
const RR = require("../lib/realRefs");

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 64 * 1024 * 1024, files: 9 } });
function mount(app) {
  const fail = (res, e) => res.status(e.status && e.status < 600 ? e.status : 500).json({ error: String((e && e.message) || e) });
  app.get("/api/realrefs/styles", (_req, res) => { try { res.json(RR.editStyles()); } catch (e) { fail(res, e); } });
  app.post("/api/realrefs/upload", upload.fields(Array.from({ length: RR.MAX_REFS }, (_, i) => ({ name: `ref${i}`, maxCount: 1 }))), (req, res) => {
    try {
      let meta = []; try { meta = JSON.parse((req.body || {}).refs || "[]"); } catch { meta = []; }
      const files = []; for (let i = 0; i < RR.MAX_REFS; i++) { const f = ((req.files || {})[`ref${i}`] || [])[0]; if (f) files.push(f); else break; }
      res.json(RR.upload(files, meta));
    } catch (e) { fail(res, e); }
  });
  app.post("/api/realrefs/start", upload.single("frame"), async (req, res) => {
    try {
      let spec = req.body || {};
      if (typeof spec.spec === "string") { try { spec = JSON.parse(spec.spec); } catch { return res.status(400).json({ error: "spec is not JSON" }); } }
      const d = RR.tokDir(spec.token);
      if (req.file && req.file.buffer) { const f = path.join(d, "frame-up.png"); fs.writeFileSync(f, req.file.buffer); spec.frame = f; }
      else if (spec.video_asset) {
        const v = path.join(core.pDir("video"), path.basename(String(spec.video_asset)));
        if (!fs.existsSync(v)) return res.status(404).json({ error: "the clip's video is not in the Video assets: " + path.basename(String(spec.video_asset)) });
        spec.video = v; spec.kind = "video";
        spec.frame = await RR.firstFrame(v, path.join(d, "frame-first.png"));
      } else spec.frame = null;
      res.json(RR.start(spec));
    } catch (e) { fail(res, e); }
  });
  app.get("/api/realrefs/:id", (req, res) => { try { res.json(RR.status(req.params.id)); } catch (e) { fail(res, e); } });
}
module.exports = { mount };
