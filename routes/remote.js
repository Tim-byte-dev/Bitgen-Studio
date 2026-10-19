// bitGen Studio — the endpoints behind remote phone access.
//
// Mounted from routes/index.js, never from server.js. Everything a phone can
// reach is gated by `gate()`, which asks lib/remote.js whether the request's
// sealed cookie belongs to THE one live session. The desktop-side routes
// (/api/remote/link, /revoke, /enable) are reachable from the app itself.
//
// NOTE ON CAMERA AND MIC. Browsers only give getUserMedia/MediaRecorder to a
// secure context, and a LAN address on plain http is not one. The phone page
// therefore captures through file inputs with the `capture` attribute, which
// hand off to the phone's own camera and recorder apps and work over http. The
// in-page live preview is used only when the page happens to be secure.
const express = require("express");
const fs = require("fs");
const path = require("path");
const core = require("../lib/core");
const remote = require("../lib/remote");
const qrcode = require("../lib/qrcode");
const llmChat = require("../lib/llmChat");
const asr = require("../lib/asr");

const MAX_UPLOAD = 200 * 1024 * 1024;          // 200 MB: a phone video, not a disk
const OK_MIME = /^(image|video|audio)\//;

function port() { return parseInt(process.env.H3_PORT, 10) || 8311; }

/** Gate every phone-facing route on the single live session. */
function gate(req, res, next) {
  const s = remote.sessionOf(req.headers.cookie);
  if (!s) {
    return res.status(401).json({
      error: remote.enabled()
        ? "this device is not the connected phone - scan a new link from Settings"
        : "remote access is off",
    });
  }
  req.remote = s;
  next();
}

function mount(app) {
  const upload = require("../lib/tempUpload").tempUpload({ fileSize: MAX_UPLOAD });   // 2.378.0: the current project's temp/

  // ---- desktop side: make a link, see who is on, cut them off -------------
  app.get("/api/remote/status", (_req, res) => {
    const st = remote.status();
    res.json({ ...st, lan: remote.lanAddress(), port: port(),
               candidates: remote.lanCandidates() });
  });

  app.post("/api/remote/enable", (req, res) => {
    const on = remote.setEnabled(!!(req.body || {}).on);
    res.json({ ...remote.status(), lan: remote.lanAddress(), port: port(),
               restart_required: remote.restartNeeded(),
               note: on
                 ? "remote access is on. RESTART bitGen Studio so it listens on the "
                   + "network - until then it is still loopback-only. Windows will ask "
                   + "to allow it through the firewall; say yes for private networks."
                 : "remote access is off; the phone is disconnected." });
  });

  app.post("/api/remote/link", (req, res) => {
    if (!remote.enabled())
      return res.status(400).json({ error: "turn remote access on first" });
    // THE FAILURE TIM HIT. The listening socket is created once, at startup, so
    // ticking the box does not open the port - only a restart does. Handing out
    // a link that points at an address nothing is bound to is worse than
    // refusing, because the phone's "can't connect" says nothing about why.
    if (remote.restartNeeded())
      return res.status(409).json({
        restart_required: true,
        error: "remote access is on, but this app is still listening only on this "
             + "computer - the network port is opened when it starts. Close bitGen "
             + "Studio and start it again, then create the link. (The console line "
             + "should then read 'also on <address>:" + port() + " for your phone'.)" });
    const cands = remote.lanCandidates();
    if (!cands.length) return res.status(400).json({
      error: "this machine has no network address, so there is nowhere for the "
           + "phone to connect to. Check Wi-Fi or the network adapter is up." });
    const want = String((req.body || {}).ip || "");
    const chosen = cands.find((c) => c.ip === want) || cands[0];
    const { code, expires_at } = remote.mintPairing();
    const url = remote.linkFor(code, port(), chosen.ip);
    let qr = "";
    try { qr = qrcode.svg(url, { scale: 6 }); } catch (e) { qr = ""; }
    const others = cands.filter((c) => c.ip !== chosen.ip);
    res.json({ url, qr, expires_at, lan: chosen.ip, adapter: chosen.adapter,
               port: port(), candidates: cands,
               note: "This code works once and expires in 10 minutes; making another "
                   + "cancels it. The phone must be on the same Wi-Fi as this "
                   + "computer - not a guest network."
                   + (others.length
                      ? " This computer has " + (others.length + 1) + " network "
                        + "addresses; if the phone can't reach " + chosen.ip
                        + ", try another below."
                      : "") });
  });

  // e2e only: the suite cannot restart the server mid-run, and the whole point
  // of restartNeeded() is that it is decided at listen time. Guarded by the
  // H3_E2E flag the harness sets; it is absent in a normal run.
  if (process.env.H3_E2E === "1") {
    app.post("/api/remote/e2e-bound", (req, res) => {
      remote._setBound(String((req.body || {}).host || "0.0.0.0"));
      res.json(remote.status());
    });
  }

  app.post("/api/remote/revoke", (_req, res) => { remote.revoke(); res.json(remote.status()); });

  // ---- the phone page ----------------------------------------------------
  app.get("/remote", (req, res) => {
    const t = req.query.t;
    if (t) {
      const r = remote.redeem(t, req.headers["user-agent"] || "phone",
                             req.ip || req.socket.remoteAddress || "");
      if (r.error) return res.status(403).send(
        `<meta name=viewport content="width=device-width,initial-scale=1">`
        + `<body style="font:16px system-ui;padding:24px;background:#111;color:#eee">`
        + `<h2>Can't connect</h2><p>${r.error}.</p>`
        + `<p>Open Settings &rarr; General on the computer and create a new link.</p>`);
      res.setHeader("Set-Cookie",
        `${remote.COOKIE}=${encodeURIComponent(r.cookie)}; Path=/; HttpOnly; SameSite=Lax; `
        + `Max-Age=${Math.floor(remote.SESSION_TTL_MS / 1000)}`);
      return res.sendFile(path.join(core.BASE, "static", "remote.html"));
    }
    if (!remote.sessionOf(req.headers.cookie)) return res.status(403).send(
      `<meta name=viewport content="width=device-width,initial-scale=1">`
      + `<body style="font:16px system-ui;padding:24px;background:#111;color:#eee">`
      + `<h2>Not connected</h2><p>Scan a fresh link from Settings &rarr; General.</p>`);
    res.sendFile(path.join(core.BASE, "static", "remote.html"));
  });

  // ---- phone side: everything below needs the cookie ---------------------
  app.get("/api/remote/me", gate, (req, res) =>
    res.json({ ok: true, device: req.remote.device, project: core.getProject() }));

  app.post("/api/remote/upload", gate, upload.single("file"), (req, res) => {
    const f = req.file;
    if (!f) return res.status(400).json({ error: "no file" });
    const mime = String(f.mimetype || "");
    if (!OK_MIME.test(mime)) {
      fs.unlink(f.path, () => {});
      return res.status(400).json({ error: `only images, video and audio (got ${mime})` });
    }
    const ext = (path.extname(f.originalname || "") || "."
                 + (mime.split("/")[1] || "bin")).toLowerCase().slice(0, 8);
    const kind = core.kindOf(ext) || (mime.startsWith("image") ? "images"
               : mime.startsWith("video") ? "video" : "sound");
    const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 15);
    const name = `phone_${stamp}_${Math.random().toString(36).slice(2, 8)}${ext}`;
    const dest = path.join(core.pDir(kind), name);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.renameSync(f.path, dest);
    res.json({ ok: true, name, kind, project: core.getProject() });
  });

  app.post("/api/remote/chat", gate, async (req, res) => {
    const msgs = Array.isArray((req.body || {}).messages) ? req.body.messages : [];
    if (!msgs.length) return res.status(400).json({ error: "no messages" });
    try {
      const r = await llmChat.complete(core, { messages: msgs });
      if (!r || r.ok === false) return res.status(r?.status || 500).json({ error: r?.error || "llm failed" });
      res.json({ reply: llmChat.stripThinking(llmChat.readReply(r)) });
    } catch (e) { res.status(500).json({ error: String(e.message || e) }); }
  });

  // Voice: the phone's recording -> faster-whisper -> the LLM -> text back.
  // A thin composition of engines that already exist; no new engine code here.
  app.post("/api/remote/voice", gate, upload.single("file"), async (req, res) => {
    const f = req.file;
    if (!f) return res.status(400).json({ error: "no audio" });
    try {
      const text = String((await asr.transcribeFile(f.path)) || "").trim();
      fs.unlink(f.path, () => {});
      if (!text) return res.json({ heard: "", reply: "", note: "nothing was heard" });
      const hist = (() => { try { return JSON.parse(req.body.history || "[]"); } catch { return []; } })();
      const msgs = hist.concat([{ role: "user", content: text }]);
      const r = await llmChat.complete(core, { messages: msgs });
      const reply = (r && r.ok !== false)
        ? llmChat.stripThinking(llmChat.readReply(r)) : "";
      res.json({ heard: text, reply });
    } catch (e) {
      if (f) fs.unlink(f.path, () => {});
      res.status(500).json({ error: String(e.message || e) });
    }
  });
}

module.exports = { mount, gate, MAX_UPLOAD };
