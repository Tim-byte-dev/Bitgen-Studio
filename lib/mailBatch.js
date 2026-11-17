// bitGen Studio — lib/mailBatch.js (2.820.0): ✉ MAIL - SEVERAL EMAILS AT ONCE, SEARCH ON THE SERVER, CONTACTS, NEW FOLDERS.
//
// Tim (verbatim): "finish the mail client, it logs in successfully but the account dissapears when i close the dialog, it
// looks like it is just the start". The reading / sending core is lib/mailImap.js + lib/mailSend.js; this adds what a mail
// program is expected to do beyond one email at a time:
//   batch(acc, folder, uids, op, to)   op = seen | unseen | flag | unflag | move | delete - ONE login, the uids as a set;
//                                      delete = to Trash (in Trash: gone); the local copy follows
//   search(acc, folder, q, opts)       the whole folder on the server (IMAP SEARCH: from / to / subject / body text), the
//                                      newest 200 hits' headers -> {msgs, total} - not kept in the index (a view)
//   contacts(id, q)                    the addresses in every kept folder's index (from / to / cc), counted, newest first
//                                      - the composer's To / Cc / Bcc suggestions
//   createFolder(acc, name, parent)    a new folder on the server (+ the folder list again)
//
//   pure: uidSet(uids), opFlags(op), contactsOf(indexes, me), matchContacts(list, q, n)
"use strict";
const fs = require("fs");
const path = require("path");
const MS = require("./mailStore");
const IM = require("./mailImap");

const OPS = ["seen", "unseen", "flag", "unflag", "move", "delete"];
/** a list of uids -> "1,2,5" (unique, positive, at most 2000) */
function uidSet(uids) {
  const L = [...new Set((Array.isArray(uids) ? uids : String(uids || "").split(",")).map((u) => parseInt(u, 10)).filter((n) => n > 0))].slice(0, 2000);
  if (!L.length) throw MS.bad("no emails picked");
  return L;
}
/** a flag op -> [add?, flag, key, value] */
function opFlags(op) {
  return { seen: [true, "\\Seen", "seen", true], unseen: [false, "\\Seen", "seen", false], flag: [true, "\\Flagged", "flagged", true], unflag: [false, "\\Flagged", "flagged", false] }[op] || null;
}

async function batch(acc, folder, uids, op, to) {
  if (!OPS.includes(op)) throw MS.bad("what should happen to them? (" + OPS.join(" / ") + ")");
  const box = folder || "INBOX", L = uidSet(uids), set = L.join(",");
  if (op === "delete") {
    if (!MS.folders(acc.id)) await IM.folders(acc);
    const trash = IM.folderFor(acc, "trash");
    if (trash && trash !== box) return batch(acc, box, L, "move", trash);
  }
  if (op === "move" && (!to || String(to) === box)) throw MS.bad("move them where?");
  return MS.serial(acc.id, () => IM.withClient(acc, async (c) => {
    const lock = await c.getMailboxLock(box);
    try {
      const f = opFlags(op);
      if (f) { if (f[0]) await c.messageFlagsAdd(set, [f[1]], { uid: true }); else await c.messageFlagsRemove(set, [f[1]], { uid: true }); }
      else if (op === "move") await c.messageMove(set, String(to), { uid: true });
      else await c.messageDelete(set, { uid: true });
    } finally { lock.release(); }
    const f = opFlags(op);
    if (f) for (const u of L) MS.patchMsg(acc.id, box, u, (m) => { m[f[2]] = f[3]; });
    else for (const u of L) MS.dropMsg(acc.id, box, u);
    const F = MS.folders(acc.id);
    if (Array.isArray(F)) { const ix = MS.index(acc.id, box), x = F.find((y) => y.path === box); if (x) { x.total = (ix.msgs || []).length; x.unseen = (ix.msgs || []).filter((m) => !m.seen).length; MS.setFolders(acc.id, F); } }
    return { ok: true, op, n: L.length, to: op === "move" ? String(to) : undefined, deleted: op === "delete" };
  }));
}

async function search(acc, folder, q, opts) {
  const box = folder || "INBOX", max = Math.max(10, Math.min(500, parseInt((opts || {}).limit, 10) || 200));
  const words = String(q || "").trim();
  if (!words) throw MS.bad("search for what?");
  const terms = (words.match(/(\w+:)?"[^"]*"|\S+/g) || []).map((p) => {
    const m = /^(from|to|cc|subject|body):(.*)$/i.exec(p), v = (m ? m[2] : p).replace(/^"|"$/g, "");
    return v ? (m ? { [m[1].toLowerCase()]: v } : { or: [{ from: v }, { to: v }, { cc: v }, { subject: v }, { body: v }] }) : null;
  }).filter(Boolean);
  return MS.serial(acc.id, () => IM.withClient(acc, async (c) => {
    const lock = await c.getMailboxLock(box, { readOnly: true });
    try {
      // every term must match: the uids of each term, intersected (servers differ on nested AND / OR - one term at a time works everywhere)
      let hit = null;
      for (const t of terms) {
        const u = await c.search(t, { uid: true }) || [];
        const s = new Set(u);
        hit = hit === null ? s : new Set([...hit].filter((x) => s.has(x)));
        if (!hit.size) break;
      }
      const all = [...(hit || [])].sort((a, b) => b - a), take = all.slice(0, max), msgs = [];
      if (take.length) for await (const m of c.fetch(take.join(","), { uid: true, flags: true, envelope: true, internalDate: true, size: true }, { uid: true })) msgs.push(IM.headOf(m));
      // what bitGen already knew about them (the AI's flag, the snippet)
      const known = new Map((MS.index(acc.id, box).msgs || []).map((m) => [m.uid, m]));
      for (const m of msgs) { const k = known.get(m.uid); if (k) { if (k.ai) m.ai = k.ai; if (k.snippet) m.snippet = k.snippet; } }
      msgs.sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0) || b.uid - a.uid);
      return { folder: box, q: words, total: all.length, msgs };
    } finally { lock.release(); }
  }));
}

/** every address in the indexes -> [{name, address, n, last}] - me left out, the most used / newest first */
function contactsOf(indexes, me) {
  const by = new Map(), mine = String(me || "").toLowerCase();
  for (const ix of indexes || []) for (const m of (ix && ix.msgs) || []) {
    const t = Date.parse(m.date) || 0;
    for (const a of [m.from].concat(m.to || [], m.cc || [])) {
      const ad = a && String(a.address || "").trim().toLowerCase();
      if (!ad || !/@/.test(ad) || ad === mine) continue;
      const o = by.get(ad) || { name: "", address: ad, n: 0, last: 0 };
      o.n++; if (t >= o.last) { o.last = t; if (a.name) o.name = String(a.name).slice(0, 80); } else if (!o.name && a.name) o.name = String(a.name).slice(0, 80);
      by.set(ad, o);
    }
  }
  return [...by.values()].sort((a, b) => b.n - a.n || b.last - a.last);
}
/** the contacts a few typed letters fit (name or address, from the start of a word) */
function matchContacts(list, q, n) {
  const s = String(q || "").trim().toLowerCase();
  const L = s ? list.filter((c) => c.address.includes(s) || c.name.toLowerCase().split(/[\s.,]+/).some((w) => w.startsWith(s)) || c.name.toLowerCase().startsWith(s)) : list;
  return L.slice(0, n || 12);
}
function contacts(id, q, me) {
  const root = MS.dirOf(id), ixs = [];
  try {
    for (const d of fs.readdirSync(root, { withFileTypes: true })) {
      if (!d.isDirectory()) continue;
      try { ixs.push(JSON.parse(fs.readFileSync(path.join(root, d.name, "index.json"), "utf8"))); } catch (e) { /* not a folder copy */ }
    }
  } catch (e) { /* nothing kept yet */ }
  return { contacts: matchContacts(contactsOf(ixs, me), q, 12) };
}

async function createFolder(acc, name, parent) {
  const n = String(name || "").replace(/[\u0000-\u001f]/g, "").trim().slice(0, 80);
  if (!n || /[\/\\*%]/.test(n)) throw MS.bad("a folder name without / \\ * %");
  await MS.serial(acc.id, () => IM.withClient(acc, async (c) => {
    let full = n;
    if (parent) { const L = await c.list(); const p = L.find((x) => x.path === parent); full = p ? parent + (p.delimiter || "/") + n : n; }
    await c.mailboxCreate(full);
  }));
  const F = await IM.folders(acc);
  return { ok: true, folders: F };
}

module.exports = { OPS, uidSet, opFlags, batch, search, contactsOf, matchContacts, contacts, createFolder };
