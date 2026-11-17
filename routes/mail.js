// bitGen Studio — ✉ Mail (2.818.0). Mounted from routes/index.js (never server.js). The work: lib/mailStore.js (accounts +
// the local copy), lib/mailImap.js (reading), lib/mailSend.js (sending), lib/mailAi.js (the LLM). The page:
// ext/maildock/.
//
//   GET    /api/mail/accounts                      {accounts (no passwords), settings, tones, presets}
//   GET    /api/mail/preset?email=                 the servers for an address
//   POST   /api/mail/accounts                      add {name, email, user, pass, imap, smtp, tls_check, save_sent, sig}
//   POST   /api/mail/accounts/:id                  change (pass "" = keep)
//   DELETE /api/mail/accounts/:id                  remove (and its local copy)
//   POST   /api/mail/test                          {…account, id?} - logs in to IMAP + SMTP, sends nothing
//   POST   /api/mail/settings                      {important, auto_flag, check_min}
//   GET    /api/mail/:id/folders[?refresh=1]       the folders (the kept list unless refresh / none yet)
//   POST   /api/mail/:id/sync                      {folder, limit} -> the index
//   GET    /api/mail/:id/list?folder=              the kept index (no server call)
//   GET    /api/mail/:id/message?folder=&uid=      the body (kept, or fetched once)
//   GET    /api/mail/:id/attachment?folder=&uid=&i=
//   POST   /api/mail/:id/flags                     {folder, uid, seen, flagged, answered}
//   POST   /api/mail/:id/delete                    {folder, uid}
//   POST   /api/mail/:id/move                      {folder, uid, to}
//   POST   /api/mail/:id/send                      {to, cc, bcc, subject, text, html, inReplyTo, references, attachments, replyTo}
//   POST   /api/mail/:id/draft                     the same -> Drafts
//   POST   /api/mail/:id/ai/flag                   {folder, uids?, redo?} -> {flagged, results}
//   POST   /api/mail/:id/ai/summary                {folder, uid}
//   POST   /api/mail/:id/ai/reply                  {folder, uid, ask, tone, all}
//   POST   /api/mail/ai/write                      {id?, notes, to, subject, tone}
//   POST   /api/mail/ai/rewrite                    {id?, text, how}
"use strict";
const express = require("express");
const fs = require("fs");
const path = require("path");
const MS = require("../lib/mailStore");
const IM = require("../lib/mailImap");
const SEND = require("../lib/mailSend");
const AI = require("../lib/mailAi");

function wrap(fn) {
  return async (req, res) => {
    try { res.json(await fn(req, res)); }
    catch (e) { res.status(e.status || 500).json({ error: e.message || String(e) }); }
  };
}
const acc = (req) => MS.get(req.params.id);
const B = (req) => req.body || {};

function mount(app) {
  const J = express.json({ limit: "40mb" });
  app.get("/api/mail/accounts", wrap(() => Object.assign(MS.list(), { tones: Object.keys(AI.TONES), presets: MS.PRESETS.map((p) => ({ name: p.name, app: !!p.app })) })));
  app.get("/api/mail/preset", wrap((req) => MS.presetFor(req.query.email)));
  app.post("/api/mail/accounts", J, wrap((req) => MS.add(B(req))));
  app.post("/api/mail/accounts/:id", J, wrap((req) => MS.update(req.params.id, B(req))));
  app.delete("/api/mail/accounts/:id", wrap((req) => MS.remove(req.params.id)));
  app.post("/api/mail/settings", J, wrap((req) => MS.setSettings(B(req))));
  app.post("/api/mail/test", J, wrap(async (req) => {
    const b = B(req);
    let a = MS.cleanAccount(b, b.id ? MS.all()[b.id] : undefined);
    a.pass = String(b.pass || "") || (b.id && MS.all()[b.id] ? MS.all()[b.id].pass : "");
    if (!a.pass) throw MS.bad("the password (or app password) is missing");
    a.id = b.id || "test0";
    const out = { imap: null, smtp: null };
    try { out.imap = await IM.test(a); } catch (e) { out.imap = { ok: false, error: e.message }; }
    try { out.smtp = await SEND.test(a); } catch (e) { out.smtp = { ok: false, error: e.message }; }
    out.ok = !!(out.imap.ok && out.smtp.ok);
    return out;
  }));

  app.get("/api/mail/:id/folders", wrap(async (req) => {
    const a = acc(req), kept = MS.folders(a.id);
    return { folders: kept && !req.query.refresh ? kept : await IM.folders(a) };
  }));
  app.post("/api/mail/:id/sync", J, wrap(async (req) => {
    const a = acc(req), b = B(req);
    if (!MS.folders(a.id)) await IM.folders(a);
    const ix = await IM.sync(a, b.folder || "INBOX", { limit: b.limit });
    return Object.assign({ folder: b.folder || "INBOX" }, ix, { folders: MS.folders(a.id) });
  }));
  app.get("/api/mail/:id/list", wrap((req) => { const a = acc(req); return Object.assign({ folder: req.query.folder || "INBOX" }, MS.index(a.id, req.query.folder || "INBOX")); }));
  app.get("/api/mail/:id/message", wrap((req) => IM.message(acc(req), req.query.folder || "INBOX", req.query.uid)));
  app.get("/api/mail/:id/attachment", (req, res) => {
    try {
      const a = acc(req), folder = req.query.folder || "INBOX";
      const b = MS.body(a.id, folder, req.query.uid);
      const at = b && (b.attachments || []).find((x) => String(x.i) === String(req.query.i));
      if (!at) throw MS.bad("no such attachment (open the message first)", 404);
      const f = path.join(MS.attDir(a.id, folder, req.query.uid), String(at.i));
      if (!fs.existsSync(f)) throw MS.bad("the attachment is not kept here - open the message again", 404);
      res.setHeader("Content-Type", at.type || "application/octet-stream");
      res.setHeader("Content-Disposition", (req.query.view ? "inline" : "attachment") + "; filename*=UTF-8''" + encodeURIComponent(at.name));
      fs.createReadStream(f).pipe(res);
    } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
  });
  app.post("/api/mail/:id/flags", J, wrap((req) => { const b = B(req); return IM.setFlags(acc(req), b.folder, b.uid, b); }));
  app.post("/api/mail/:id/delete", J, wrap((req) => { const b = B(req); return IM.remove(acc(req), b.folder, b.uid); }));
  app.post("/api/mail/:id/move", J, wrap((req) => { const b = B(req); if (!b.to) throw MS.bad("move it where?"); return IM.move(acc(req), b.folder, b.uid, String(b.to)); }));
  app.post("/api/mail/:id/send", J, wrap((req) => SEND.send(acc(req), B(req))));
  app.post("/api/mail/:id/draft", J, wrap((req) => SEND.draft(acc(req), B(req))));

  app.post("/api/mail/ai/write", J, wrap((req) => {
    const b = B(req), a = b.id && MS.all()[b.id] ? MS.all()[b.id] : null;
    return AI.write(Object.assign({}, b, { name: a ? a.name : b.name }));
  }));
  app.post("/api/mail/ai/rewrite", J, wrap((req) => {
    const b = B(req), a = b.id && MS.all()[b.id] ? MS.all()[b.id] : null;
    return AI.rewrite(Object.assign({}, b, { name: a ? a.name : b.name }));
  }));
  app.post("/api/mail/:id/ai/flag", J, wrap((req) => { const b = B(req); return AI.flag(acc(req), b.folder || "INBOX", b); }));
  app.post("/api/mail/:id/ai/summary", J, wrap((req) => { const b = B(req); return AI.summary(acc(req), b.folder || "INBOX", b.uid); }));
  app.post("/api/mail/:id/ai/reply", J, wrap((req) => { const b = B(req); return AI.reply(acc(req), b.folder || "INBOX", b.uid, b); }));
}

module.exports = { mount };
