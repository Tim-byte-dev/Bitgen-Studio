// bitGen Studio — lib/mailStore.js (2.818.0): ✉ MAIL - THE ACCOUNTS AND THE LOCAL COPY OF THE MAIL.
//
// Tim (verbatim): "I would like a mail docker that resembles outlook but works with ai, our models should be able to read
// the emails and flag important ones and draft a reply. it should also help us construct an email." Agreed design: no
// cloud sign-up - bitGen talks to the user's own mailbox (IMAP to read, SMTP to send: lib/mailImap.js, lib/mailSend.js),
// the user's own LLM reads / flags / drafts (lib/mailAi.js).
//
//   ACCOUNTS   config.mail.accounts.<id> = {name, email, user, imap {host, port, secure}, smtp {host, port, secure},
//              tls_check, save_sent, sig}; the password at mail.accounts.<id>.pass is ENCRYPTED in settings/keys.json
//              (lib/secrets.js MAIL_KEY - never in custom.settings, never sent back to the page: view() leaves it out)
//   SETTINGS   config.mail.important ("what matters to me" - the flagging prompt reads it), auto_flag, check_min
//   THE COPY   <app>/mail/<id>/folders.json, <app>/mail/<id>/<folder key>/index.json {uidValidity, msgs: [{uid, from,
//              to, subject, date, seen, flagged, answered, size, ai?, snippet?}]}, <uid>.json (the body: text, html,
//              attachments), <uid>.att/<n> (the attachments' bytes). mail/ is this machine's (.gitignore, make_zips).
//
//   pure: cleanAccount(b, prev), view(id, a), presetFor(email), folderKey(path), mergeIndex(old, fresh, uidValidity)
"use strict";
const fs = require("fs");
const path = require("path");

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const clean = (v, n) => String(v == null ? "" : v).replace(/[\u0000-\u001f]/g, "").trim().slice(0, n || 200);
const portOf = (v, d) => { const n = parseInt(v, 10); return n > 0 && n < 65536 ? n : d; };
function bad(m, st) { const e = new Error(m); e.status = st || 400; return e; }

// the servers of the big mail services, found from the address (the user can change every field). The services that
// refuse a normal password from an app say so (app: true) - the account dialog tells the user to make an app password.
const PRESETS = [
  { re: /@(gmail|googlemail)\.com$/i, name: "Gmail", imap: ["imap.gmail.com", 993, true], smtp: ["smtp.gmail.com", 465, true], app: true, sent_auto: true },
  { re: /@(outlook|hotmail|live|msn)\.[a-z.]+$/i, name: "Outlook.com", imap: ["outlook.office365.com", 993, true], smtp: ["smtp-mail.outlook.com", 587, false], app: true },
  { re: /@(yahoo|ymail)\.[a-z.]+$/i, name: "Yahoo Mail", imap: ["imap.mail.yahoo.com", 993, true], smtp: ["smtp.mail.yahoo.com", 465, true], app: true },
  { re: /@(icloud|me|mac)\.com$/i, name: "iCloud Mail", imap: ["imap.mail.me.com", 993, true], smtp: ["smtp.mail.me.com", 587, false], app: true },
  { re: /@fastmail\.[a-z.]+$/i, name: "Fastmail", imap: ["imap.fastmail.com", 993, true], smtp: ["smtp.fastmail.com", 465, true], app: true },
  { re: /@zoho(mail)?\.[a-z.]+$/i, name: "Zoho Mail", imap: ["imap.zoho.com", 993, true], smtp: ["smtp.zoho.com", 465, true], app: true },
  { re: /@(gmx)\.[a-z.]+$/i, name: "GMX", imap: ["imap.gmx.com", 993, true], smtp: ["mail.gmx.com", 465, true] },
];
/** the servers for an address -> {name, imap {host, port, secure}, smtp {...}, app, sent_auto} | a guess (imap.<domain>) */
function presetFor(email) {
  const e = clean(email, 200).toLowerCase();
  const p = PRESETS.find((x) => x.re.test(e));
  const box = (a) => ({ host: a[0], port: a[1], secure: a[2] });
  if (p) return { name: p.name, imap: box(p.imap), smtp: box(p.smtp), app: !!p.app, sent_auto: !!p.sent_auto, known: true };
  const dom = (e.split("@")[1] || "").replace(/[^a-z0-9.-]/g, "");
  return { name: dom || "Mail", imap: { host: dom ? "imap." + dom : "", port: 993, secure: true }, smtp: { host: dom ? "smtp." + dom : "", port: 465, secure: true }, app: false, sent_auto: false, known: false };
}

function cleanServer(b, ports) {
  const o = isObj(b) ? b : {};
  const secure = o.secure === undefined ? true : (o.secure === true || o.secure === "true" || o.secure === 1 || o.secure === "1");
  return { host: clean(o.host, 200).replace(/[^A-Za-z0-9.:\-\[\]]/g, ""), port: portOf(o.port, secure ? ports[0] : ports[1]), secure };
}
/** a posted account -> the stored shape (pass handled apart: "" or missing = keep the old one) */
function cleanAccount(b, prev) {
  const o = isObj(b) ? b : {}, p = isObj(prev) ? prev : {};
  const email = clean(o.email !== undefined ? o.email : p.email, 200);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw bad("the email address does not look right");
  const pre = presetFor(email);
  const a = {
    name: clean(o.name !== undefined ? o.name : p.name, 60) || email,
    email,
    user: clean(o.user !== undefined ? o.user : p.user, 200) || email,
    imap: cleanServer(o.imap || p.imap || pre.imap, [993, 143]),
    smtp: cleanServer(o.smtp || p.smtp || pre.smtp, [465, 587]),
    tls_check: o.tls_check === undefined ? p.tls_check !== false : !!o.tls_check,
    save_sent: o.save_sent === undefined ? (p.save_sent === undefined ? !pre.sent_auto : !!p.save_sent) : !!o.save_sent,
    sig: String(o.sig !== undefined ? o.sig : (p.sig || "")).slice(0, 2000),
  };
  if (!a.imap.host) throw bad("the IMAP server (incoming mail) is missing");
  if (!a.smtp.host) throw bad("the SMTP server (outgoing mail) is missing");
  return a;
}
/** what the page sees - never the password */
function view(id, a) {
  const o = isObj(a) ? a : {};
  return { id, name: o.name || o.email || id, email: o.email || "", user: o.user || "", imap: o.imap || {}, smtp: o.smtp || {},
    tls_check: o.tls_check !== false, save_sent: o.save_sent !== false, sig: o.sig || "", has_pass: !!(o.pass && String(o.pass).length) };
}

/** a folder's path -> a safe directory name (readable + a short hash so "A/B" and "A_B" never share one) */
function folderKey(p) {
  const s = String(p || "INBOX");
  let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return s.replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 60) + "-" + h.toString(36);
}
/** the fresh headers from the server + what bitGen already knew (the AI flag, the snippet) -> the new index */
function mergeIndex(old, fresh, uidValidity) {
  const o = isObj(old) ? old : {};
  const same = o.uidValidity == null || uidValidity == null || String(o.uidValidity) === String(uidValidity);
  const was = new Map(same && Array.isArray(o.msgs) ? o.msgs.map((m) => [m.uid, m]) : []);
  const msgs = (fresh || []).map((m) => {
    const w = was.get(m.uid);
    return w ? Object.assign({}, m, w.ai ? { ai: w.ai } : {}, w.snippet ? { snippet: w.snippet } : {}) : m;
  }).sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0) || b.uid - a.uid);
  return { uidValidity: uidValidity == null ? o.uidValidity : uidValidity, synced: new Date().toISOString(), msgs, reset: !same };
}

// ---- the stored accounts (config) -------------------------------------------------------------------------------------
const core = () => require("./core");
function cfgMail() { const c = core().getConfig() || {}; return isObj(c.mail) ? c.mail : {}; }
function all() { const m = cfgMail(); return isObj(m.accounts) ? m.accounts : {}; }
function saveMail(next) { const c = core().getConfig(); c.mail = Object.assign({}, isObj(c.mail) ? c.mail : {}, next); core().setConfig(c); }
function newId() { return "m" + Date.now().toString(36).slice(-6) + Math.random().toString(36).slice(2, 5); }
function list() {
  const m = cfgMail();
  return { accounts: Object.entries(all()).map(([id, a]) => view(id, a)), settings: settings() };
}
function settings() {
  const m = cfgMail();
  return { important: String(m.important || "").slice(0, 1000), auto_flag: !!m.auto_flag, check_min: Math.max(0, Math.min(120, parseInt(m.check_min, 10) || 0)) || 5 };
}
function setSettings(b) {
  const o = isObj(b) ? b : {}, cur = settings();
  const next = {
    important: o.important !== undefined ? String(o.important).slice(0, 1000) : cur.important,
    auto_flag: o.auto_flag !== undefined ? !!o.auto_flag : cur.auto_flag,
    check_min: o.check_min !== undefined ? Math.max(1, Math.min(120, parseInt(o.check_min, 10) || 5)) : cur.check_min,
  };
  saveMail(next); return next;
}
function get(id) { const a = all()[id]; if (!a) throw bad("no mail account " + id, 404); return Object.assign({ id }, a); }
function add(b) {
  const a = cleanAccount(b);
  if (!b || !String(b.pass || "")) throw bad("the password (or app password) is missing");
  a.pass = String(b.pass);
  const id = newId(), A = Object.assign({}, all()); A[id] = a; saveMail({ accounts: A });
  return view(id, a);
}
function update(id, b) {
  const A = Object.assign({}, all()); if (!A[id]) throw bad("no mail account " + id, 404);
  const a = cleanAccount(b, A[id]);
  a.pass = b && String(b.pass || "") ? String(b.pass) : A[id].pass;
  A[id] = a; saveMail({ accounts: A });
  return view(id, a);
}
function remove(id) {
  const A = Object.assign({}, all()); if (!A[id]) throw bad("no mail account " + id, 404);
  delete A[id]; saveMail({ accounts: A });
  try { fs.rmSync(dirOf(id), { recursive: true, force: true }); } catch (e) { /* the copy can stay */ }
  return { ok: true };
}

// ---- the local copy ---------------------------------------------------------------------------------------------------
function root() { return path.join(core().BASE, "mail"); }
function dirOf(id, folder) {
  if (!/^[a-z0-9]{4,20}$/.test(String(id))) throw bad("bad account id");
  const d = path.join(root(), id);
  return folder === undefined ? d : path.join(d, folderKey(folder));
}
function readJson(p, d) { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch (e) { return d; } }
function writeJson(p, v) { fs.mkdirSync(path.dirname(p), { recursive: true }); const t = p + ".tmp"; fs.writeFileSync(t, JSON.stringify(v)); fs.renameSync(t, p); }
const folders = (id) => readJson(path.join(dirOf(id), "folders.json"), null);
const setFolders = (id, f) => writeJson(path.join(dirOf(id), "folders.json"), f);
const index = (id, folder) => readJson(path.join(dirOf(id, folder), "index.json"), { msgs: [] });
const setIndex = (id, folder, ix) => writeJson(path.join(dirOf(id, folder), "index.json"), ix);
function uidOk(uid) { const n = parseInt(uid, 10); if (!(n > 0)) throw bad("bad message uid"); return n; }
const body = (id, folder, uid) => readJson(path.join(dirOf(id, folder), uidOk(uid) + ".json"), null);
const setBody = (id, folder, uid, b) => writeJson(path.join(dirOf(id, folder), uidOk(uid) + ".json"), b);
function attDir(id, folder, uid) { return path.join(dirOf(id, folder), uidOk(uid) + ".att"); }
/** change one message's entry in the index (flags, the AI's verdict, the snippet) */
function patchMsg(id, folder, uid, fn) {
  const ix = index(id, folder), m = (ix.msgs || []).find((x) => x.uid === uidOk(uid));
  if (!m) return null;
  fn(m); setIndex(id, folder, ix); return m;
}
function dropMsg(id, folder, uid) {
  const ix = index(id, folder), n = uidOk(uid);
  ix.msgs = (ix.msgs || []).filter((x) => x.uid !== n); setIndex(id, folder, ix);
  try { fs.rmSync(path.join(dirOf(id, folder), n + ".json"), { force: true }); fs.rmSync(attDir(id, folder, n), { recursive: true, force: true }); } catch (e) { /* fine */ }
}

/** a copy of the config for the page: the mail accounts without their passwords (POST /api/config cannot write mail -
 *  its allow-list has no "mail" - so nothing the page sends back can lose one) */
function hidePasswords(cfg) {
  if (!isObj(cfg) || !isObj(cfg.mail) || !isObj(cfg.mail.accounts)) return cfg;
  const accounts = {};
  for (const [id, a] of Object.entries(cfg.mail.accounts)) { const c = Object.assign({}, a); if (c.pass) c.pass = ""; accounts[id] = c; }
  return Object.assign({}, cfg, { mail: Object.assign({}, cfg.mail, { accounts }) });
}

// one IMAP job at a time per account (two syncs writing the same index would lose one's changes)
const CHAIN = new Map();
function serial(id, fn) {
  const prev = CHAIN.get(id) || Promise.resolve();
  const next = prev.then(fn, fn);
  CHAIN.set(id, next.catch(() => {}));
  return next;
}

module.exports = { PRESETS, presetFor, cleanAccount, view, hidePasswords, folderKey, mergeIndex, list, settings, setSettings, all, get, add, update, remove,
  root, dirOf, folders, setFolders, index, setIndex, body, setBody, attDir, patchMsg, dropMsg, serial, bad };
