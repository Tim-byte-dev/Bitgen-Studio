// bitGen Studio — routes/apkBuild.js (2.911.0): Settings ▸ General ▸ Remote access ▸ 📱 the bitGen app - build it here and
// put it on the phone over Wi-Fi (lib/apkBuild.js). Mounted from routes/index.js. THIS COMPUTER ONLY: a paired phone's key
// (lib/remoteGuard.js) does not reach these - downloading tools and running builds is the PC's business.
//   GET  /api/apk/status            the tools found, the APK built, the phone remembered, the job (its log)
//   POST /api/apk/tools             ⬇ Java 21 / the Android SDK - only what is missing
//   POST /api/apk/build {install}   🔨 the APK (then onto the phone when install is true)
//   POST /api/apk/pair {address, code}   POST /api/apk/connect {address}   POST /api/apk/install {serial}
//   POST /api/apk/stop              GET /api/apk/file (the APK itself, to copy by hand)
//   POST /api/apk/paths {jdk, sdk, forget_phone}   the folders to use ("" = search), forget the paired phone
"use strict";
const fs = require("fs");
const A = require("../lib/apkBuild");

function mount(app) {
  const local = (req, res, next) => (req.remote ? res.status(403).json({ error: "building and installing the app is done on the PC itself" }) : next());
  const go = (fn) => (req, res) => {
    try {
      const j = A.job();
      if (j.state === "running") return res.status(409).json({ error: "bitGen is already " + (j.kind || "busy") + " - wait for it, or ■ Stop it" });
      Promise.resolve().then(() => fn(req.body || {})).catch(() => { /* the job carries its error */ });
      setTimeout(() => res.json(A.status()), 150);
    } catch (e) { res.status(e.status || 500).json({ error: String((e && e.message) || e) }); }
  };
  app.get("/api/apk/status", local, (_req, res) => { try { res.json(A.status()); } catch (e) { res.status(500).json({ error: String(e.message || e) }); } });
  app.post("/api/apk/tools", local, go(() => A.getTools()));
  app.post("/api/apk/build", local, go((b) => A.build(b.install ? "install" : "")));
  app.post("/api/apk/pair", local, go((b) => A.pair(b.address, b.code)));
  app.post("/api/apk/connect", local, go((b) => A.connect(b.address)));
  app.post("/api/apk/install", local, go((b) => A.install({ serial: b.serial })));
  app.post("/api/apk/paths", local, (req, res) => { try { res.json(A.setPaths(req.body || {})); } catch (e) { res.status(500).json({ error: String(e.message || e) }); } });
  app.post("/api/apk/stop", local, (_req, res) => { A.stop(); res.json(A.status()); });
  app.get("/api/apk/file", local, (_req, res) => {
    const f = A.apkOut();
    if (!fs.existsSync(f)) return res.status(404).json({ error: "there is no APK yet - 🔨 Build the app first" });
    res.download(f, "bitGen.apk");
  });
}
module.exports = { mount };
