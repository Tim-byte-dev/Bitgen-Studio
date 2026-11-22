// bitGen Studio — routes/appApi.js (2.909.0): the 📱 bitGen app's own endpoints (lib/appApi.js). Mounted from
// routes/index.js. Reached from the network only with the paired device's key (lib/remoteGuard.js); from this computer too
// (the tests).
//   GET  /api/app/info    {app, version, project, video_styles: [{id, name, arch, route}], image_styles, ui, defaults}
//   POST /api/app/video   multipart: prompt, style_id, width, height, seconds, steps, cfg, seed, override, negative,
//                         pictures (up to 9) -> the endpoint the style renders through (its answer + route / endpoint)
//   POST /api/app/song    {idea, style_id} -> {title, style, lyrics} (2.911.0: the PC's LLM, lib/songwriter.js)
"use strict";
const multer = require("multer");
const A = require("../lib/appApi");

function port() { return parseInt(process.env.H3_PORT, 10) || 8311; }

function mount(app) {
  const up = multer({ storage: multer.memoryStorage(), limits: { fileSize: 40 * 1024 * 1024, files: 9 } });
  app.get("/api/app/info", (_req, res) => {
    try {
      const RA = require("../lib/remoteAway");         // 2.913.0: ☁ away from the Wi-Fi for 6 hours - 2.914.0: the relay or a Cloudflare tunnel
      const relay = RA.forApp(); if (!relay && RA.mode() === "relay") require("../lib/relayLink").prepare().catch(() => { /* the Wi-Fi only */ });
      res.json(Object.assign(A.info(), { relay }));
    } catch (e) { res.status(500).json({ error: String((e && e.message) || e) }); }
  });
  app.post("/api/app/video", up.array("pictures", 9), async (req, res) => {
    try {
      const pics = (req.files || []).filter((f) => /^image\//.test(String(f.mimetype || "")))
        .map((f) => ({ name: f.originalname || "picture.png", mime: f.mimetype, buffer: f.buffer }));
      const r = await A.submitVideo(req.body || {}, pics, port());
      res.status(r.status).json(r.body);
    } catch (e) { res.status(500).json({ error: String((e && e.message) || e) }); }
  });
  // 2.912.0: ⬆ Update - the build on this PC (its id vs the app's own www/lib/build.js) and the APK itself (the app's key)
  app.get("/api/app/update", (_req, res) => { try { res.json(require("../lib/apkShare").buildInfo()); } catch (e) { res.status(500).json({ error: String(e.message || e) }); } });
  app.get("/api/app/apk", (_req, res) => {
    const f = require("../lib/apkShare").apkFile();
    if (!require("fs").existsSync(f)) return res.status(404).json({ error: "there is no build on the PC" });
    res.setHeader("Content-Type", "application/vnd.android.package-archive");
    res.sendFile(f);
  });
  // 2.911.0: ✨ Write the song - {idea, style_id} -> {title, style, lyrics} from the PC's LLM
  app.post("/api/app/song", async (req, res) => {
    try { const r = await A.writeSong((req.body || {}).idea, (req.body || {}).style_id); res.status(r.status).json(r.body); }
    catch (e) { res.status(500).json({ error: String((e && e.message) || e) }); }
  });
}
module.exports = { mount };
