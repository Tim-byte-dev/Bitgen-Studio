// bitGen Studio — the laser connection (2.804.0): USB (serial) or Wi-Fi (TCP), held by bitGen's own server. Mounted from
// routes/index.js (never server.js); the work is lib/laserLink.js. The image editor's Laser panel (pclaser.js) drives it.
//
//   GET  /api/laser/link/status          {connected, kind, target, flavor, machine, job, log, serial}
//   GET  /api/laser/link/ports           {serial, ports: [{path, maker, id}]}
//   POST /api/laser/link/connect         {kind: "serial", path, baud} | {kind: "tcp", host, port}, flavor
//   POST /api/laser/link/disconnect
//   POST /api/laser/link/send            {line}
//   POST /api/laser/link/start           {name} (a file in projects/<p>/laser) | {code, name}
//   POST /api/laser/link/pause | resume | stop | home | unlock
//   POST /api/laser/link/frame           {box: {x0, y0, x1, y1} mm, power 0..1, speed, sMax}
"use strict";
const express = require("express");
const fs = require("fs");
const link = require("../lib/laserLink");
const laserStore = require("../lib/laserStore");

function mount(app) {
  link.hookExit();
  const json = express.json({ limit: "64mb" });
  const wrap = (f) => async (req, res) => { try { res.json(await f(req.body || {}, req)); } catch (e) { res.status(e.status || 500).json({ error: e.message, status: link.status() }); } };
  app.get("/api/laser/link/status", (_req, res) => res.json(link.status()));
  app.get("/api/laser/link/ports", wrap(() => link.ports()));
  app.post("/api/laser/link/connect", json, wrap((b) => link.connect(b, b.flavor)));
  app.post("/api/laser/link/disconnect", json, wrap(() => link.disconnect()));
  app.post("/api/laser/link/send", json, wrap((b) => link.send(b.line)));
  app.post("/api/laser/link/start", json, wrap((b) => {
    const code = b.code != null ? String(b.code) : fs.readFileSync(laserStore.file(b.name), "utf8");
    return link.start(code, b.name || "job");
  }));
  app.post("/api/laser/link/pause", json, wrap(() => link.pause()));
  app.post("/api/laser/link/resume", json, wrap(() => link.resume()));
  app.post("/api/laser/link/stop", json, wrap(() => link.stop()));
  app.post("/api/laser/link/home", json, wrap(() => link.home()));
  app.post("/api/laser/link/unlock", json, wrap(() => link.unlock()));
  app.post("/api/laser/link/frame", json, wrap((b) => link.frame(b.box, { power: b.power, speed: b.speed, sMax: b.sMax })));
}

module.exports = { mount };
