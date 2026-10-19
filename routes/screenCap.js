// bitGen Studio — SCREEN CAPTURE + SCREEN RECORD (2.367.0). Mounted by routes/index.js (never server.js); the
// files are lib/screenCap.js, the two buttons are static/screencap.js (the left dock's menu bar), the Electron
// side (which window / screen, system sound) is electron/capture.js.
//
//   POST /api/screencap/shot              raw image/png body  -> {name, note}   (projects/<p>/output)
//   POST /api/screencap/rec/start                              -> {id}
//   POST /api/screencap/rec/:id/chunk     raw body (one MediaRecorder chunk, in order) -> {chunks, bytes}
//   POST /api/screencap/rec/:id/finish                         -> {name, seconds, note}  (the mp4)
//   POST /api/screencap/rec/:id/cancel                         -> {cancelled}
// The bodies are read as streams here (never express.json / a global raw parser), so a chunk of any size works.
"use strict";
const sc = require("../lib/screenCap");

const MAX_SHOT = 256 * 1024 * 1024;
const MAX_CHUNK = 512 * 1024 * 1024;

function body(req, max) {
  return new Promise((resolve, reject) => {
    const parts = []; let n = 0;
    req.on("data", (c) => {
      n += c.length;
      if (n > max) { reject(Object.assign(new Error("the upload is too large"), { status: 413 })); req.destroy(); return; }
      parts.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(parts)));
    req.on("error", reject);
  });
}

function send(res, r) {
  if (r && r.error) return res.status(r.status || 400).json({ error: r.error });
  res.json({ ok: true, ...r });
}

function fail(res, e) { res.status(e.status || 500).json({ error: e.message }); }

function mount(app) {
  app.post("/api/screencap/shot", async (req, res) => {
    try { send(res, sc.savePng(await body(req, MAX_SHOT))); } catch (e) { fail(res, e); }
  });
  app.post("/api/screencap/rec/start", (_req, res) => {
    try { send(res, sc.start()); } catch (e) { fail(res, e); }
  });
  app.post("/api/screencap/rec/:id/chunk", async (req, res) => {
    try { send(res, sc.append(req.params.id, await body(req, MAX_CHUNK))); } catch (e) { fail(res, e); }
  });
  app.post("/api/screencap/rec/:id/finish", async (req, res) => {
    try { send(res, await sc.finish(req.params.id)); } catch (e) { fail(res, e); }
  });
  app.post("/api/screencap/rec/:id/cancel", (req, res) => {
    try { send(res, sc.cancel(req.params.id)); } catch (e) { fail(res, e); }
  });
}

module.exports = { mount };
