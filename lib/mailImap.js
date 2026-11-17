// bitGen Studio — lib/mailImap.js (2.818.0): ✉ MAIL - READING THE USER'S OWN MAILBOX OVER IMAP (imapflow, MIT).
//
// One short connection per job (connect, do it, log out) - nothing stays logged in while the docker is closed. Every job
// on an account runs one at a time (lib/mailStore.js serial) and writes the local copy (mailStore index / body).
//
//   test(acc)                      -> {ok, folders, inbox}   (logs in, lists the folders)
//   folders(acc)                   -> [{path, name, special, unseen, total, delim}] (also kept in folders.json)
//   sync(acc, folder, {limit})     -> the index (the newest <limit> messages' headers + flags; the AI flags kept)
//   message(acc, folder, uid)      -> the body (parsed by mailparser: text, safe html, attachments) - kept as <uid>.json
//   setFlags(acc, folder, uid, {seen, flagged, answered})
//   remove(acc, folder, uid)       -> moved to Trash (or deleted when it is in Trash / there is none)
//   move(acc, folder, uid, dest)
//   append(acc, special, raw, flags) -> the raw message into Sent / Drafts (found by special use or name)
//   pure: specialOf(box), pickFolder(list, special), headOf(msg), safeHtml(html, cids)
"use strict";
const fs = require("fs");
const path = require("path");
const MS = require("./mailStore");

const SPECIALS = { "\\Inbox": "inbox", "\\Sent": "sent", "\\Drafts": "drafts", "\\Trash": "trash", "\\Junk": "junk", "\\Archive": "archive", "\\All": "all", "\\Flagged": "flagged", "\\Important": "important" };
const NAMES = { sent: /^(sent|sent items|sent mail|sent messages|gesendet|envoy[ée]s)$/i, drafts: /^(drafts?|entw[üu]rfe|brouillons)$/i, trash: /^(trash|deleted|deleted items|deleted messages|bin|papierkorb|corbeille)$/i, junk: /^(junk|spam|junk e-?mail|bulk mail)$/i, archive: /^(archive|archives)$/i };
/** a listed mailbox -> "inbox" | "sent" | … | "" */
function specialOf(b) {
  const o = b || {};
  if (String(o.path || "").toUpperCase() === "INBOX") return "inbox";
  if (o.specialUse && SPECIALS[o.specialUse]) return SPECIALS[o.specialUse];
  const name = String(o.name || String(o.path || "").split(o.delimiter || "/").pop() || "");
  for (const [k, re] of Object.entries(NAMES)) if (re.test(name)) return k;
  return "";
}
/** the folder for a role (sent / drafts / trash) from the stored list -> its path | null */
function pickFolder(list, special) {
  const L = Array.isArray(list) ? list : [];
  const byUse = L.find((f) => f.special === special && f.use);
  return (byUse || L.find((f) => f.special === special) || {}).path || null;
}
const addr = (a) => (a && a.length ? a.map((x) => ({ name: x.name || "", address: x.address || "" })) : []);
const dateOf = (d) => (d instanceof Date && !isNaN(d) ? d.toISOString() : (d ? String(d) : ""));
/** a fetched message (envelope + flags) -> an index entry */
function headOf(m) {
  const e = m.envelope || {}, f = m.flags instanceof Set ? m.flags : new Set(m.flags || []);
  return { uid: m.uid, from: addr(e.from)[0] || { name: "", address: "" }, to: addr(e.to), cc: addr(e.cc), subject: e.subject || "",
    date: dateOf(e.date || m.internalDate),
    seen: f.has("\\Seen"), flagged: f.has("\\Flagged"), answered: f.has("\\Answered"), size: m.size || 0, messageId: e.messageId || "" };
}

/** an email's HTML made safe to show in the reading pane: no scripts / frames / forms / event attributes / javascript:
 *  links; cid: pictures -> data: (the attachments it carries). The pane ALSO shows it in a sandboxed frame with a content
 *  policy (no scripts, remote pictures only when asked) - this is the second fence, not the only one. */
function safeHtml(html, cids) {
  let s = String(html || "");
  s = s.replace(/<!--[\s\S]*?-->/g, "");
  s = s.replace(/<(script|iframe|object|applet|frameset|noscript)\b[\s\S]*?<\/\1\s*>/gi, "");
  s = s.replace(/<\/?(script|iframe|frame|frameset|object|embed|applet|form|base|link|meta)\b[^>]*>/gi, "");
  s = s.replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  s = s.replace(/\b(href|src|action|formaction|xlink:href|background)\s*=\s*(["']?)\s*(javascript|vbscript|data:text\/html)[^"'\s>]*\2/gi, '$1="#"');
  s = s.replace(/expression\s*\(/gi, "x(");
  if (cids) s = s.replace(/(["'(])cid:([^"')\s>]+)/gi, (m, q, id) => { const d = cids[String(id).replace(/^<|>$/g, "")]; return d ? q + d : q + "about:blank"; });
  return s;
}

function client(acc) {
  const { ImapFlow } = require("imapflow");
  const im = acc.imap || {};
  return new ImapFlow({
    host: im.host, port: im.port, secure: !!im.secure,
    auth: { user: acc.user || acc.email, pass: acc.pass || "" },
    logger: false, tls: { rejectUnauthorized: acc.tls_check !== false },
    connectionTimeout: Number(process.env.H3_MAIL_TIMEOUT) || 30000, greetingTimeout: 20000, socketTimeout: 120000,
    clientInfo: { name: "bitGen Studio" },
  });
}
/** log in, run fn(c), log out - with the server's own words when it refuses */
async function withClient(acc, fn) {
  const c = client(acc);
  c.on("error", () => { /* a dropped socket - the job's own await reports it */ });
  try { await c.connect(); }
  catch (e) {
    const why = e && (e.responseText || e.response || e.message) || String(e);
    const auth = /auth|login|credentials|password/i.test(String(why)) || (e && e.authenticationFailed);
    const err = new Error(auth ? `the mail server refused the login (${why}) - check the user name and password; Gmail, Outlook.com, Yahoo and iCloud need an app password`
      : `could not reach ${acc.imap.host}:${acc.imap.port} (${why})`);
    err.status = auth ? 401 : 502; throw err;
  }
  try { return await fn(c); }
  finally { try { await c.logout(); } catch (e) { try { c.close(); } catch (e2) { /* gone */ } } }
}

async function listFolders(c) {
  let L;
  try { L = await c.list({ statusQuery: { messages: true, unseen: true } }); }
  catch (e) { L = await c.list(); }
  return L.filter((b) => !(b.flags && (b.flags.has ? b.flags.has("\\Noselect") : false)) && b.listed !== false).map((b) => ({
    path: b.path, name: b.name || b.path, delim: b.delimiter || "/", special: specialOf(b), use: !!b.specialUse,
    total: b.status && b.status.messages != null ? b.status.messages : null, unseen: b.status && b.status.unseen != null ? b.status.unseen : null,
  }));
}
const ORDER = ["inbox", "drafts", "sent", "archive", "junk", "trash"];
function sortFolders(F) {
  return F.slice().sort((a, b) => {
    const ia = ORDER.indexOf(a.special), ib = ORDER.indexOf(b.special);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.path.localeCompare(b.path);
  });
}

async function folders(acc) {
  return MS.serial(acc.id, () => withClient(acc, async (c) => {
    const F = sortFolders(await listFolders(c));
    MS.setFolders(acc.id, F); return F;
  }));
}
async function test(acc) {
  return withClient(acc, async (c) => {
    const F = await listFolders(c);
    return { ok: true, folders: F.length, inbox: (F.find((f) => f.special === "inbox") || {}).total };
  });
}

async function sync(acc, folder, opts) {
  const limit = Math.max(10, Math.min(2000, parseInt((opts || {}).limit, 10) || 200));
  const box = folder || "INBOX";
  return MS.serial(acc.id, () => withClient(acc, async (c) => {
    const lock = await c.getMailboxLock(box, { readOnly: true });
    let fresh = [], uv = null;
    try {
      const mb = c.mailbox || {};
      uv = mb.uidValidity != null ? String(mb.uidValidity) : null;
      const n = mb.exists || 0;
      if (n > 0) {
        const from = Math.max(1, n - limit + 1);
        for await (const m of c.fetch(`${from}:*`, { uid: true, flags: true, envelope: true, internalDate: true, size: true })) fresh.push(headOf(m));
      }
    } finally { lock.release(); }
    const ix = MS.mergeIndex(MS.index(acc.id, box), fresh, uv);
    MS.setIndex(acc.id, box, ix);
    // the folder list's counts follow
    const F = MS.folders(acc.id);
    if (Array.isArray(F)) { const f = F.find((x) => x.path === box); if (f) { f.total = ix.msgs.length; f.unseen = ix.msgs.filter((m) => !m.seen).length; MS.setFolders(acc.id, F); } }
    return ix;
  }));
}

const MAX_SRC = 40 * 1024 * 1024;
/** the raw message -> what the reading pane needs (and the attachments' bytes beside it) */
async function parse(id, folder, uid, src) {
  const { simpleParser } = require("mailparser");
  const p = await simpleParser(src, { skipImageLinks: true, skipTextToHtml: false });
  const atts = [], cids = {};
  const dir = MS.attDir(id, folder, uid);
  (p.attachments || []).forEach((a, i) => {
    const cid = a.contentId ? String(a.contentId).replace(/^<|>$/g, "") : "";
    if (cid && /^image\//.test(a.contentType || "") && a.size < 2 * 1024 * 1024 && a.content) cids[cid] = "data:" + a.contentType + ";base64," + a.content.toString("base64");
    if (a.related && cid && cids[cid]) return;   // an inline picture of the HTML - shown in it, not listed
    try { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, String(atts.length)), a.content || Buffer.alloc(0)); } catch (e) { /* listed anyway */ }
    atts.push({ i: atts.length, name: String(a.filename || ("attachment-" + (i + 1))).replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").slice(0, 120), type: a.contentType || "application/octet-stream", size: a.size || (a.content ? a.content.length : 0) });
  });
  const A = (v) => (v && v.value ? v.value.map((x) => ({ name: x.name || "", address: x.address || "" })) : []);
  const text = String(p.text || "").replace(/\r\n/g, "\n");
  return {
    uid: parseInt(uid, 10), subject: p.subject || "", date: p.date ? p.date.toISOString() : "", from: A(p.from)[0] || { name: "", address: "" },
    to: A(p.to), cc: A(p.cc), replyTo: A(p.replyTo), messageId: p.messageId || "", inReplyTo: p.inReplyTo || "",
    references: Array.isArray(p.references) ? p.references : (p.references ? [p.references] : []),
    text: text.slice(0, 500000), html: p.html ? safeHtml(p.html, cids).slice(0, 3000000) : "", attachments: atts,
  };
}
const snippetOf = (t) => String(t || "").replace(/\s+/g, " ").trim().slice(0, 160);

async function message(acc, folder, uid) {
  const box = folder || "INBOX";
  const kept = MS.body(acc.id, box, uid);
  if (kept) return kept;
  return MS.serial(acc.id, () => withClient(acc, async (c) => {
    const lock = await c.getMailboxLock(box, { readOnly: true });
    let src = null;
    try {
      const m = await c.fetchOne(String(uid), { source: { maxLength: MAX_SRC }, uid: true }, { uid: true });
      if (!m || !m.source) { const e = new Error("that message is no longer on the server"); e.status = 404; throw e; }
      src = m.source;
    } finally { lock.release(); }
    const b = await parse(acc.id, box, uid, src);
    MS.setBody(acc.id, box, uid, b);
    MS.patchMsg(acc.id, box, uid, (m) => { m.snippet = snippetOf(b.text); });
    return b;
  }));
}

async function setFlags(acc, folder, uid, f) {
  const box = folder || "INBOX", F = f || {};
  return MS.serial(acc.id, () => withClient(acc, async (c) => {
    const lock = await c.getMailboxLock(box);
    try {
      for (const [k, flag] of [["seen", "\\Seen"], ["flagged", "\\Flagged"], ["answered", "\\Answered"]]) {
        if (F[k] === undefined) continue;
        if (F[k]) await c.messageFlagsAdd(String(uid), [flag], { uid: true }); else await c.messageFlagsRemove(String(uid), [flag], { uid: true });
      }
    } finally { lock.release(); }
    return MS.patchMsg(acc.id, box, uid, (m) => { for (const k of ["seen", "flagged", "answered"]) if (F[k] !== undefined) m[k] = !!F[k]; });
  }));
}

function folderFor(acc, special) { return pickFolder(MS.folders(acc.id) || [], special); }
async function ensureFolders(acc) { if (!MS.folders(acc.id)) await folders(acc); }

async function move(acc, folder, uid, dest) {
  const box = folder || "INBOX";
  return MS.serial(acc.id, () => withClient(acc, async (c) => {
    const lock = await c.getMailboxLock(box);
    try { await c.messageMove(String(uid), dest, { uid: true }); } finally { lock.release(); }
    MS.dropMsg(acc.id, box, uid);
    return { ok: true, to: dest };
  }));
}
async function remove(acc, folder, uid) {
  await ensureFolders(acc);
  const box = folder || "INBOX", trash = folderFor(acc, "trash");
  if (trash && trash !== box) return move(acc, box, uid, trash);
  return MS.serial(acc.id, () => withClient(acc, async (c) => {
    const lock = await c.getMailboxLock(box);
    try { await c.messageDelete(String(uid), { uid: true }); } finally { lock.release(); }
    MS.dropMsg(acc.id, box, uid);
    return { ok: true, deleted: true };
  }));
}
/** a raw message into the role's folder (sent / drafts) -> {ok, folder} | {ok: false, why} */
async function append(acc, special, raw, flags) {
  await ensureFolders(acc);
  const box = folderFor(acc, special);
  if (!box) return { ok: false, why: `no ${special} folder on the server` };
  return MS.serial(acc.id, () => withClient(acc, async (c) => {
    const r = await c.append(box, raw, flags || [], new Date());
    return { ok: true, folder: box, uid: r && r.uid };
  }));
}

module.exports = { SPECIALS, specialOf, pickFolder, headOf, safeHtml, snippetOf, sortFolders, test, folders, sync, message, setFlags, move, remove, append, withClient, folderFor };
