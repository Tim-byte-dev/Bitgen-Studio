// lib/hostFtp.js — 2.860.0 📤 the www folder straight onto your host (Tim: "i have another host with godaddy, uses cpanel domain is
// tigerart.shop... i will use that one for testing"). cPanel (GoDaddy and most shared hosts) and Plesk both take FTP / FTPS:
//   SETTINGS projects/<p>/web/host.json {host, port, user, dir (public_html / httpdocs), secure, anyName}; the password kept
//            encrypted on this computer (lib/secrets.js store, SITE_FTP_PASS_<sha1(host|user)>) - never in the project
//   TEST     log in, go into the folder, list it -> {pwd, count, hasIndex, hasConfig}
//   SEND     only the files that changed since the last send to that host + folder (projects/<p>/web/host-sent.json: sha1 per file);
//            files bitGen sent before and you deleted are taken off the host (only those); ☐ every file again
//   CONFIG   inc/config.php (the database settings, the admin's setup key) goes only when the host has none, or when asked; with
//            ☐ the database password its DB_PASS is filled from the CRM's 🌐 server (kept encrypted here) - on the host only
// Basic FTP over TLS (basic-ftp, MIT). Progress: GET /api/web/host/progress.
"use strict";
const fs = require("fs"), path = require("path"), crypto = require("crypto");
const bad = (m, s) => Object.assign(new Error(m), { status: s || 400 });
let W = () => require("./webProject");
let FTP = () => require("basic-ftp");
let BASE = null;
function setBase(b) { BASE = b; }
function setFtp(f) { FTP = () => f; }   // tests
const base = () => BASE || require("./core").BASE;
const keys = () => require("./secrets").store(base());
const webDir = () => path.join(path.dirname(W().root()), "web");
const setFile = () => path.join(webDir(), "host.json"), sentFile = () => path.join(webDir(), "host-sent.json");
const readJ = (f, d) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch (e) { return d; } };
const passKey = (c) => "SITE_FTP_PASS_" + crypto.createHash("sha1").update(String(c.host).toLowerCase() + "|" + c.user).digest("hex").slice(0, 16);
const HOST_RE = /^[A-Za-z0-9.-]{1,253}$|^\[?[0-9a-fA-F:.]{2,45}\]?$/;
const SKIP = /(^|\/)(\.DS_Store|Thumbs\.db|desktop\.ini)$/i;

function clean(o) {
  const a = o || {}, host = String(a.host || "").trim().replace(/^s?ftps?:\/\//i, "").replace(/\/.*$/, "");
  if (host && !HOST_RE.test(host)) throw bad("that server name does not look right - e.g. ftp.yourdomain.com or the host's IP");
  const dir = String(a.dir == null ? "public_html" : a.dir).trim().replace(/\\/g, "/").replace(/\/+$/, "") || ".";
  if (/(^|\/)\.\.(\/|$)/.test(dir)) throw bad("the folder cannot go up (..)");
  return { host, port: Math.max(1, Math.min(65535, parseInt(a.port, 10) || 21)), user: String(a.user || "").trim().slice(0, 200), dir: dir.slice(0, 300), secure: a.secure !== false, anyName: !!a.anyName };
}
function settings() {
  const c = Object.assign(clean({}), readJ(setFile(), {}));
  return { host: c.host, port: c.port, user: c.user, dir: c.dir, secure: c.secure !== false, anyName: !!c.anyName, hasPassword: !!(c.host && c.user && keys().read()[passKey(c)]), last: c.last || null };
}
/** save the settings (+ the password, encrypted here) */
function save(o) {
  const a = o || {}, c = clean(Object.assign({}, settings(), a));
  const keep = readJ(setFile(), {});
  fs.mkdirSync(webDir(), { recursive: true });
  fs.writeFileSync(setFile(), JSON.stringify(Object.assign({}, { last: keep.last || null }, c), null, 2));
  if (typeof a.password === "string" && a.password) keys().update([passKey(c)], { [passKey(c)]: a.password });
  if (a.forget) keys().update([passKey(c)], {});
  return settings();
}
async function connect(c) {
  if (!c.host || !c.user) throw bad("give the server and the FTP user first (cPanel ▸ FTP Accounts, or your cPanel login)", 412);
  const pw = keys().read()[passKey(c)]; if (!pw) throw bad("give the FTP password first", 412);
  const F = FTP(), cl = new F.Client(30000);
  // the chain is always checked; "another name" skips only the name check. Otherwise a mismatch carries the names the cert IS for.
  const tls = { checkServerIdentity: c.anyName ? () => undefined : (h, cert) => { const err = require("tls").checkServerIdentity(h, cert); if (err && cert && cert.subjectaltname) err.message += " [cert " + cert.subjectaltname + "]"; return err; } };
  try { await cl.access({ host: c.host, port: c.port, user: c.user, password: pw, secure: c.secure ? true : false, secureOptions: tls }); }
  catch (e) { cl.close(); throw explain(e, c); }
  return cl;
}
/** a failure in words the user can act on */
function explain(e, c) {
  const m = String(e && e.message || e), x = (t) => bad(t + "  (" + m.slice(0, 300) + ")", 502);
  if (/altnames|does not match|ERR_TLS_CERT_ALTNAME/i.test(m)) { const d = /DNS:([^,\s]+)/.exec(m); return x(`the host's certificate is made out to ${d ? d[1] : "another name"} - use that name as the server (cPanel ▸ FTP Accounts ▸ Configure FTP Client shows it), or tick "Accept the certificate under another name"`); }
  if (/self.signed|unable to verify|certificate/i.test(m)) return x("the host's certificate could not be checked - untick 🔒 FTPS only if you trust this network (the password then goes unencrypted)");
  if (/530|login|authentication|password/i.test(m)) return x("the host refused the login - check the FTP user (cPanel's look like name@yourdomain.com) and its password");
  if (/ENOTFOUND|EAI_AGAIN/i.test(m)) return x(`no server called ${c.host} - for cPanel it is usually ftp.yourdomain.com or the server's IP (cPanel ▸ FTP Accounts ▸ Configure FTP Client)`);
  if (/ECONNREFUSED|ETIMEDOUT|Timeout|ECONNRESET/i.test(m)) return x(`${c.host}:${c.port} did not answer - check the port (21 for FTP / FTPS) and that your network lets FTP out`);
  if (/AUTH TLS|TLS not available|534|500 AUTH/i.test(m)) return x("the host does not offer FTPS - untick 🔒 FTPS (the password then goes unencrypted)");
  return x("the host could not be reached");
}
async function enter(cl, c) {
  try { await cl.cd(c.dir); } catch (e) { throw bad(`there is no folder ${c.dir} on the host - cPanel's website folder is public_html (an add-on domain has its own, e.g. public_html/tigerart.shop)`, 404); }
  return cl.pwd();
}
/** ✓ Test: log in, the folder, what is in it */
async function test(o) {
  const c = clean(Object.assign({}, settings(), o || {}));
  if (o && typeof o.password === "string" && o.password) save(Object.assign({}, c, { password: o.password }));
  const cl = await connect(c);
  try {
    const pwd = await enter(cl, c), list = await cl.list();
    let hasConfig = false; try { hasConfig = (await cl.size("inc/config.php")) >= 0; } catch (e) { /* none */ }
    return { ok: true, pwd, count: list.length, hasIndex: list.some((f) => /^index\.(html?|php)$/i.test(f.name)), hasConfig, secure: c.secure };
  } finally { cl.close(); }
}
const sha = (buf) => crypto.createHash("sha1").update(buf).digest("hex");
function localFiles() {
  const out = [], rootDir = W().root();
  const walk = (d, rel) => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const r = rel ? rel + "/" + f.name : f.name; if (f.isDirectory()) walk(path.join(d, f.name), r); else if (f.isFile() && !SKIP.test(r)) out.push(r); } };
  walk(rootDir, ""); return out.sort();
}
/** inc/config.php as it goes to the host - with the CRM's server password when asked (never written to the project) */
function configFor(withPass) {
  const f = path.join(W().root(), "inc", "config.php"); let t = fs.readFileSync(f, "utf8");
  if (!withPass) return { text: t, pass: false };
  const L = require("./webDb").link();
  const pw = L && L.scope === "external" ? keys().read()["db.external.password"] || "" : "";
  if (!pw) return { text: t, pass: false };
  const v = String(pw).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  t = /define\('DB_PASS'[^;]*;/.test(t) ? t.replace(/define\('DB_PASS'[^;]*;/, `define('DB_PASS', getenv('DB_PASS') ?: '${v}');`) : t + `define('DB_PASS', getenv('DB_PASS') ?: '${v}');\n`;
  return { text: t, pass: true };
}

/* ---------------- 📤 send (one at a time; the docker polls progress) */
let JOB = null;
function progress() { return JOB ? Object.assign({}, JOB) : { running: false }; }
function start(o) {
  if (JOB && JOB.running) throw bad("sending already - wait for it to finish", 409);
  if (!W().has()) throw bad("this project has no www folder yet", 404);
  JOB = { running: true, total: 0, done: 0, bytes: 0, file: "", started: new Date().toISOString() };
  const j = JOB;
  send(o || {}, j).then((r) => { j.result = r; }, (e) => { j.error = e.message || String(e); }).finally(() => { j.running = false; j.file = ""; });
  return progress();
}
async function send(o, j) {
  j = j || { total: 0, done: 0, bytes: 0 };
  const c = clean(Object.assign({}, settings(), o));
  if (typeof o.password === "string" && o.password) save(Object.assign({}, c, { password: o.password }));
  const key = `${c.host.toLowerCase()}|${c.user}|${c.dir}`, all = readJ(sentFile(), {}), before = o.full ? {} : Object.assign({}, all[key] || {});
  const files = localFiles(), rootDir = W().root(), now = {}, todo = [];
  for (const r of files) { if (r === "inc/config.php") continue; const h = sha(fs.readFileSync(path.join(rootDir, r))); now[r] = h; if (before[r] !== h) todo.push(r); }
  const gone = o.keepGone ? [] : Object.keys(all[key] || {}).filter((r) => !(r in now) && r !== "inc/config.php");
  const cl = await connect(c);
  let sent = 0, removed = 0, config = "kept";
  const save1 = () => { all[key] = Object.assign({}, all[key] || {}, before); fs.mkdirSync(webDir(), { recursive: true }); fs.writeFileSync(sentFile(), JSON.stringify(all, null, 1)); };
  try {
    const home = await enter(cl, c);
    // inc/config.php: when the host has none, or asked
    const hasCfg = files.includes("inc/config.php");
    let onHost = false; if (hasCfg) { try { onHost = (await cl.size("inc/config.php")) >= 0; } catch (e) { /* none */ } }
    const cfgMode = o.config === "always" ? "always" : o.config === "never" ? "never" : "missing";
    const sendCfg = hasCfg && (cfgMode === "always" || (cfgMode === "missing" && !onHost));
    j.total = todo.length + (sendCfg ? 1 : 0) + gone.length;
    const dirs = new Set();
    const put = async (rel, body) => {
      const d = path.posix.dirname(rel);
      if (d !== "." && !dirs.has(d)) { await cl.ensureDir(d); await cl.cd(home); dirs.add(d); }
      j.file = rel;
      await cl.uploadFrom(typeof body === "string" ? require("stream").Readable.from([Buffer.from(body)]) : path.join(rootDir, rel), rel);
      j.done++; j.bytes += typeof body === "string" ? Buffer.byteLength(body) : fs.statSync(path.join(rootDir, rel)).size;
    };
    for (const r of todo) { await put(r); before[r] = now[r]; sent++; if (sent % 25 === 0) save1(); }
    if (sendCfg) { const cf = configFor(!!o.withPassword); await put("inc/config.php", cf.text); config = cf.pass ? "sent with the password" : "sent (no password in it)"; }
    else if (hasCfg && onHost) config = cfgMode === "never" ? "not sent" : "kept the host's";
    for (const r of gone) { j.file = r; try { await cl.remove(r); removed++; } catch (e) { /* already gone */ } delete before[r]; j.done++; }
    for (const r of Object.keys(before)) if (!(r in now)) delete before[r];
    all[key] = before; fs.mkdirSync(webDir(), { recursive: true }); fs.writeFileSync(sentFile(), JSON.stringify(all, null, 1));
  } finally { cl.close(); }
  const last = { at: new Date().toISOString(), host: c.host, dir: c.dir, sent, removed, same: files.length - todo.length - (files.includes("inc/config.php") ? 1 : 0) };
  const s = readJ(setFile(), {}); s.last = last; fs.writeFileSync(setFile(), JSON.stringify(Object.assign({}, clean(s), { last }), null, 2));
  return Object.assign({ config, nothing: !sent && !removed && config !== "sent with the password" && !/^sent/.test(config) }, last);
}
module.exports = { setBase, setFtp, clean, settings, save, test, start, send, progress, explain, configFor, localFiles, passKey };
