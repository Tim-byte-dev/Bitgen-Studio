// bitGen Studio — lib/mailSend.js (2.818.0): ✉ MAIL - SENDING OVER THE USER'S OWN SMTP SERVER (nodemailer, MIT-0).
//
// The message is built ONCE (nodemailer's MailComposer -> raw RFC 822 bytes): the same bytes go to the SMTP server and,
// unless the service files sent mail itself (Gmail) or the account says not to, into the Sent folder over IMAP - so what
// is in Sent is exactly what was sent. A draft is the same build appended to Drafts with \Draft.
//
//   compose(acc, m) -> {raw, envelope, messageId}   pure apart from nodemailer (m: to, cc, bcc, subject, text, html,
//                                                   inReplyTo, references, attachments [{name, type, data base64}],
//                                                   forwardOf {folder, uid} - the original's attachments go too)
//   send(acc, m)    -> {ok, messageId, accepted, rejected, sent: {ok, folder} | null}
//   draft(acc, m)   -> {ok, folder}
//   test(acc)       -> {ok}   (connects + logs in, sends nothing)
//   pure: addrList(s), replySubject(s, kind), quoteOf(body, kind)
"use strict";
const MS = require("./mailStore");

/** "Ann <a@x.com>, b@y.org; c@z" -> ["Ann <a@x.com>", "b@y.org", "c@z"] (bad ones refused) */
function addrList(s) {
  const out = [];
  for (const part of String(s || "").split(/[,;\n]+/)) {
    const p = part.trim(); if (!p) continue;
    const m = /<([^<>\s]+@[^<>\s]+)>\s*$/.exec(p);
    const a = m ? m[1] : p;
    if (!/^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$/.test(a)) throw MS.bad(`"${p}" is not an email address`);
    out.push(p.slice(0, 300));
  }
  return out;
}
const bare = (a) => { const m = /<([^<>]+)>\s*$/.exec(a); return (m ? m[1] : a).trim(); };
/** Re: / Fwd: once, not "Re: Re: Re:" */
function replySubject(s, kind) {
  const base = String(s || "").replace(/^\s*((re|fw|fwd|aw|sv|wg)\s*(\[\d+\])?\s*:\s*)+/i, "").trim();
  return (kind === "forward" ? "Fwd: " : "Re: ") + base;
}
/** the original under a reply / forward, as plain text */
function quoteOf(b, kind) {
  const o = b || {}, who = o.from ? (o.from.name ? `${o.from.name} <${o.from.address}>` : o.from.address) : "";
  const when = o.date ? new Date(o.date).toUTCString() : "";
  const text = String(o.text || "").trim();
  if (kind === "forward") {
    const to = (o.to || []).map((x) => x.address).join(", ");
    return `\n\n---------- Forwarded message ----------\nFrom: ${who}\nDate: ${when}\nSubject: ${o.subject || ""}\nTo: ${to}\n\n${text}`;
  }
  return `\n\nOn ${when}, ${who} wrote:\n` + text.split("\n").map((l) => "> " + l).join("\n");
}

function fromOf(acc) { return acc.name && acc.name !== acc.email ? { name: acc.name, address: acc.email } : acc.email; }
async function compose(acc, m) {
  const MailComposer = require("nodemailer/lib/mail-composer");
  const o = m || {};
  const to = addrList(o.to), cc = addrList(o.cc), bcc = addrList(o.bcc);
  if (!o.draft && !to.length && !cc.length && !bcc.length) throw MS.bad("say who it goes to (To, Cc or Bcc)");
  const atts = (Array.isArray(o.attachments) ? o.attachments : []).slice(0, 20).map((a) => ({
    filename: String(a.name || "file").slice(0, 120), contentType: a.type || undefined, content: Buffer.from(String(a.data || ""), "base64"),
  }));
  // a forward carries the original's own attachments (the copies kept when it was opened)
  if (o.forwardOf && o.forwardOf.uid && acc.id) {
    const ob = MS.body(acc.id, o.forwardOf.folder || "INBOX", o.forwardOf.uid);
    for (const a of (ob && ob.attachments) || []) {
      try { atts.push({ filename: a.name, contentType: a.type, content: require("fs").readFileSync(require("path").join(MS.attDir(acc.id, o.forwardOf.folder || "INBOX", o.forwardOf.uid), String(a.i))) }); }
      catch (e) { /* not kept - the forward goes without it */ }
    }
  }
  const size = atts.reduce((n, a) => n + a.content.length, 0);
  if (size > 25 * 1024 * 1024) throw MS.bad("the attachments are over 25 MB - most mail servers refuse that");
  const mail = {
    from: fromOf(acc), to, cc, bcc, subject: String(o.subject || "").slice(0, 500),
    text: String(o.text || ""), html: o.html ? String(o.html) : undefined, attachments: atts,
    inReplyTo: o.inReplyTo || undefined, references: o.references && o.references.length ? o.references : undefined,
    headers: { "X-Mailer": "bitGen Studio" },
  };
  const node = new MailComposer(mail).compile();
  node.keepBcc = false;
  const raw = await node.build();
  return { raw, envelope: { from: acc.email, to: [...to, ...cc, ...bcc].map(bare) }, messageId: node.messageId() };
}

function transport(acc) {
  const nodemailer = require("nodemailer");
  const s = acc.smtp || {};
  return nodemailer.createTransport({
    host: s.host, port: s.port, secure: !!s.secure, requireTLS: !s.secure && s.port === 587,
    auth: { user: acc.user || acc.email, pass: acc.pass || "" },
    tls: { rejectUnauthorized: acc.tls_check !== false },
    connectionTimeout: Number(process.env.H3_MAIL_TIMEOUT) || 30000, greetingTimeout: 20000, socketTimeout: 120000,
  });
}
function smtpErr(acc, e) {
  const why = (e && (e.response || e.message)) || String(e);
  const auth = (e && (e.code === "EAUTH" || e.responseCode === 535)) || /auth|535/i.test(why);
  const err = new Error(auth ? `the outgoing mail server refused the login (${why}) - Gmail, Outlook.com, Yahoo and iCloud need an app password`
    : `sending failed at ${acc.smtp.host}:${acc.smtp.port} (${why})`);
  err.status = auth ? 401 : 502; return err;
}
async function test(acc) {
  const t = transport(acc);
  try { await t.verify(); return { ok: true }; } catch (e) { throw smtpErr(acc, e); } finally { t.close(); }
}
async function send(acc, m) {
  const c = await compose(acc, m);
  const t = transport(acc);
  let info;
  try { info = await t.sendMail({ envelope: c.envelope, raw: c.raw }); } catch (e) { throw smtpErr(acc, e); } finally { t.close(); }
  let sent = null;
  if (acc.save_sent !== false) {
    try { sent = await require("./mailImap").append(acc, "sent", c.raw, ["\\Seen"]); } catch (e) { sent = { ok: false, why: e.message }; }
  }
  // a reply marks the original as answered
  if (m && m.replyTo && m.replyTo.folder && m.replyTo.uid) {
    try { await require("./mailImap").setFlags(acc, m.replyTo.folder, m.replyTo.uid, { answered: true }); } catch (e) { /* a nicety */ }
  }
  return { ok: true, messageId: c.messageId, accepted: info.accepted || [], rejected: info.rejected || [], sent };
}
async function draft(acc, m) {
  const c = await compose(acc, Object.assign({}, m, { draft: true }));
  const r = await require("./mailImap").append(acc, "drafts", c.raw, ["\\Draft", "\\Seen"]);
  if (!r.ok) throw MS.bad("could not save the draft: " + r.why);
  return r;
}

module.exports = { addrList, replySubject, quoteOf, compose, send, draft, test };
