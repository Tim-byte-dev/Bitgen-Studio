// lib/dbServer.js — 🗄 DATABASES: bitGen's own MariaDB for a project or for everything, or your MySQL / MariaDB server (2.842.0).
// Tim (verbatim): "allow user to create a mysql or mariadb inside the project or global, llm will create all of the tables,fields
// and views".
//   SCOPES   project  projects/<p>/db/data      a server of its own on 127.0.0.1:<3408 + the project's number>
//            global   <app>/db/data             127.0.0.1:3407
//            external your own server            host / port / user / database; the password kept encrypted (settings/keys.json)
//   THE SERVER  MariaDB's own program: found in <app>/mariadb/<version>/ (⬇ downloaded once, from archive.mariadb.org - the
//            Windows .zip / the Linux tarball), on the PATH, in /usr/sbin, Homebrew or Program Files. A data folder is made
//            with mariadb-install-db the first time; root gets a password of its own (kept encrypted); it listens on
//            127.0.0.1 only and is stopped when bitGen closes (lib/exitSweep.js).
//   conn(scope, db) -> a mysql2 connection (MIT).
"use strict";
const fs = require("fs"), path = require("path"), os = require("os"), crypto = require("crypto");
const { spawn, spawnSync } = require("child_process");
let BASE = null, PROJ = null;
function setBase(b, projDir) { BASE = b; PROJ = projDir || null; }   // tests
const base = () => BASE || require("./core").BASE;
const projDb = () => PROJ || require("./core").pDir("db");
const bad = (m, s) => Object.assign(new Error(m), { status: s || 400 });
const VERSION = "11.4.4";
const WIN = process.platform === "win32", EXE = WIN ? ".exe" : "";
/** where MariaDB comes from for this computer (null = not offered: macOS -> Homebrew) */
function downloadFor(plat, arch) {
  const p = plat || process.platform, a = arch || process.arch;
  if (p === "win32" && a === "x64") return { url: `https://archive.mariadb.org/mariadb-${VERSION}/winx64-packages/mariadb-${VERSION}-winx64.zip`, size: "about 90 MB", file: `mariadb-${VERSION}-winx64.zip` };
  if (p === "linux" && a === "x64") return { url: `https://archive.mariadb.org/mariadb-${VERSION}/bintar-linux-systemd-x86_64/mariadb-${VERSION}-linux-systemd-x86_64.tar.gz`, size: "about 330 MB", file: `mariadb-${VERSION}-linux-systemd-x86_64.tar.gz` };
  return null;
}
const exists = (p) => { try { return fs.statSync(p).isFile(); } catch (e) { return false; } };
/** MariaDB's server program on this computer -> {bin, installDb, base} | null */
function find() {
  const cands = [];
  const own = path.join(base(), "mariadb");
  if (fs.existsSync(own)) for (const d of fs.readdirSync(own).sort().reverse()) cands.push(path.join(own, d));
  for (const c of cands) for (const n of ["mariadbd", "mysqld"]) { const b = path.join(c, "bin", n + EXE); if (exists(b)) return { bin: b, base: c, installDb: [path.join(c, "bin", "mariadb-install-db" + EXE), path.join(c, "scripts", "mariadb-install-db"), path.join(c, "scripts", "mysql_install_db")].find(exists) || null, own: true }; }
  const dirs = (process.env.PATH || "").split(path.delimiter).concat(["/usr/sbin", "/usr/local/sbin", "/usr/local/bin", "/opt/homebrew/bin", "/opt/homebrew/sbin", "/usr/local/opt/mariadb/bin"]);
  if (WIN) for (const pf of [process.env.ProgramFiles, process.env["ProgramFiles(x86)"]].filter(Boolean)) { try { for (const d of fs.readdirSync(pf)) if (/^(MariaDB|MySQL)/i.test(d)) { const sub = path.join(pf, d); dirs.push(path.join(sub, "bin")); for (const e of fs.readdirSync(sub)) if (/^MySQL Server/i.test(e)) dirs.push(path.join(sub, e, "bin")); } } catch (e) { /* none */ } }
  for (const d of dirs) for (const n of ["mariadbd", "mysqld"]) {
    const b = path.join(d, n + EXE); if (!exists(b)) continue;
    const near = [path.join(d, "mariadb-install-db" + EXE), path.join(d, "mysql_install_db" + EXE), "/usr/bin/mariadb-install-db", "/usr/bin/mysql_install_db", "/usr/local/bin/mariadb-install-db", "/opt/homebrew/bin/mariadb-install-db"].find(exists) || null;
    return { bin: b, base: path.dirname(d), installDb: near, own: false };
  }
  return null;
}
/* ---- secrets: root passwords + the external server's */
const keys = () => require("./secrets").store(base());
const secretGet = (n) => keys().read()[n] || "";
const secretSet = (n, v) => keys().update([n], { [n]: v });
/* ---- scopes */
function projectName() { try { return require("./core").currentProject || path.basename(path.dirname(projDb())); } catch (e) { return "project"; } }
function scopeInfo(scope) {
  if (scope === "global") return { scope, dir: path.join(base(), "db"), port: 3407, key: "db.root.global" };
  if (scope === "project") { const dir = projDb(), h = crypto.createHash("sha1").update(path.resolve(dir)).digest().readUInt16BE(0) % 500; return { scope, dir, port: 3408 + h, key: "db.root.p." + crypto.createHash("sha1").update(path.resolve(dir)).digest("hex").slice(0, 12) }; }
  if (scope === "external") return { scope, external: true };
  throw bad("scope = project, global or external");
}
const RUN = new Map();          // dir -> {proc, port, started}
let install = { state: "idle" };
function externalCfg() {
  let c = {}; try { c = JSON.parse(fs.readFileSync(path.join(base(), "settings", "db_external.json"), "utf8")); } catch (e) { /* none yet */ }
  return { host: String(c.host || ""), port: +c.port || 3306, user: String(c.user || ""), database: String(c.database || ""), hasPassword: !!secretGet("db.external.password") };
}
function setExternal(o) {
  const a = o || {}, c = { host: String(a.host || "").trim().slice(0, 200), port: Math.max(1, Math.min(65535, +a.port || 3306)), user: String(a.user || "").slice(0, 100), database: String(a.database || "").replace(/[^\w$-]/g, "").slice(0, 64) };
  fs.mkdirSync(path.join(base(), "settings"), { recursive: true });
  fs.writeFileSync(path.join(base(), "settings", "db_external.json"), JSON.stringify(c, null, 2));
  if (typeof a.password === "string" && a.password) secretSet("db.external.password", a.password);
  return externalCfg();
}
function status() {
  const f = find(), out = { server: f ? { bin: f.bin, own: f.own } : null, download: downloadFor(), version: VERSION, install, external: externalCfg(), scopes: {} };
  for (const s of ["project", "global"]) { const i = scopeInfo(s), r = RUN.get(i.dir); out.scopes[s] = { dir: i.dir, port: i.port, made: fs.existsSync(path.join(i.dir, "data", "mysql")), running: !!(r && r.proc && r.proc.exitCode == null) }; }
  return out;
}
/* ---- ⬇ MariaDB downloaded + unpacked into <app>/mariadb/<version>/ */
function download() {
  if (install.state === "running") return install;
  const d = downloadFor(); if (!d) throw bad(process.platform === "darwin" ? "on a Mac install MariaDB with Homebrew (brew install mariadb) - bitGen finds it there" : "there is no MariaDB download for this computer - install MariaDB yourself (bitGen finds it on the PATH) or use your own server");
  const dest = path.join(base(), "mariadb"), file = path.join(dest, d.file);
  fs.mkdirSync(dest, { recursive: true });
  install = { state: "running", phase: "downloading", got: 0, total: 0, url: d.url, started: Date.now() };
  const get = (u, hops) => new Promise((ok, no) => {
    require(u.startsWith("https:") ? "https" : "http").get(u, { headers: { "User-Agent": "bitGen-Studio" } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && hops < 6) { res.resume(); return ok(get(new URL(res.headers.location, u).href, hops + 1)); }
      if (res.statusCode !== 200) { res.resume(); return no(new Error("the download answered HTTP " + res.statusCode)); }
      install.total = +res.headers["content-length"] || 0;
      const w = fs.createWriteStream(file + ".part");
      res.on("data", (c) => { install.got += c.length; }); res.pipe(w); w.on("finish", () => ok()); w.on("error", no); res.on("error", no);
    }).on("error", no);
  });
  get(d.url, 0).then(() => {
    fs.renameSync(file + ".part", file);
    install.phase = "unpacking";
    const r = spawnSync("tar", ["-xf", file, "-C", dest], { stdio: "ignore", timeout: 15 * 60 * 1000 });
    if (r.status !== 0) throw new Error("the download could not be unpacked (tar)");
    const top = fs.readdirSync(dest).find((x) => x.startsWith("mariadb-" + VERSION) && fs.statSync(path.join(dest, x)).isDirectory());
    if (top && top !== VERSION) { fs.rmSync(path.join(dest, VERSION), { recursive: true, force: true }); fs.renameSync(path.join(dest, top), path.join(dest, VERSION)); }
    fs.rmSync(file, { force: true });
    install = { state: "done", phase: "done", finished: Date.now() };
  }).catch((e) => { try { fs.rmSync(file + ".part", { force: true }); } catch (er) { /* fine */ } install = { state: "failed", error: e.message }; });
  return install;
}
/* ---- start / stop */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function mysql() { return require("mysql2/promise"); }
async function rootConn(i, pw, db) { return mysql().createConnection({ host: "127.0.0.1", port: i.port, user: "root", password: pw, database: db || undefined, connectTimeout: 4000, multipleStatements: false, dateStrings: true }); }
function initData(f, i) {
  const data = path.join(i.dir, "data"); fs.mkdirSync(data, { recursive: true });
  if (fs.existsSync(path.join(data, "mysql"))) return;
  const pw = crypto.randomBytes(18).toString("base64url");
  if (!f.installDb) {                                                  // MySQL (no install script): mysqld --initialize-insecure
    const r = spawnSync(f.bin, ["--no-defaults", "--initialize-insecure", "--datadir=" + data, "--basedir=" + f.base].concat(process.getuid && process.getuid() === 0 ? ["--user=root"] : []), { encoding: "utf8", timeout: 5 * 60 * 1000, cwd: f.base });
    if (r.status !== 0 || !fs.existsSync(path.join(data, "mysql"))) throw bad("the database folder could not be made (no mariadb-install-db beside " + f.bin + "): " + String(r.stderr || r.stdout || r.error || "").trim().split("\n").slice(-2).join(" "), 500);
    secretSet(i.key, ""); secretSet(i.key + ".next", pw); return;
  }
  const args = /\.exe$/i.test(f.installDb) ? ["--datadir=" + data, "--password=" + pw, "--port=" + i.port]
    : ["--no-defaults", "--datadir=" + data, "--basedir=" + f.base, "--auth-root-authentication-method=normal", "--skip-test-db"].concat(process.getuid && process.getuid() === 0 ? ["--user=root"] : []);
  const r = spawnSync(f.installDb, args, { encoding: "utf8", timeout: 5 * 60 * 1000, cwd: f.base });
  if (r.status !== 0) throw bad("the database folder could not be made: " + String(r.stderr || r.stdout || r.error || "").trim().split("\n").slice(-3).join(" "), 500);
  secretSet(i.key, /\.exe$/i.test(f.installDb) ? pw : "");          // a new folder: root has no password yet (set at the first start)
  if (!/\.exe$/i.test(f.installDb)) secretSet(i.key + ".next", pw);
}
async function start(scope) {
  const i = scopeInfo(scope); if (i.external) return { ok: true, external: true };
  const r0 = RUN.get(i.dir); if (r0 && r0.proc && r0.proc.exitCode == null) return { ok: true, port: i.port, already: true };
  const f = find(); if (!f) throw bad("MariaDB is not installed - ⬇ download it first", 409);
  initData(f, i);
  const data = path.join(i.dir, "data"), sock = WIN ? null : path.join(os.tmpdir(), "bitgen-db-" + i.port + ".sock");
  const args = ["--no-defaults", "--datadir=" + data, "--port=" + i.port, "--bind-address=127.0.0.1", "--skip-name-resolve", "--pid-file=" + path.join(i.dir, "mariadb.pid"), "--log-error=" + path.join(i.dir, "mariadb.log"), "--basedir=" + f.base]
    .concat(sock ? ["--socket=" + sock] : []).concat(process.getuid && process.getuid() === 0 ? ["--user=root"] : []);
  const proc = spawn(f.bin, args, { stdio: "ignore", windowsHide: true, cwd: f.base });
  RUN.set(i.dir, { proc, port: i.port, started: Date.now() });
  proc.on("exit", () => { const r = RUN.get(i.dir); if (r && r.proc === proc) RUN.delete(i.dir); });
  // ready = a connection; the first start sets root's own password
  let pw = secretGet(i.key), last = null;
  for (let t = 0; t < 60; t++) {
    if (proc.exitCode != null) break;
    try {
      const c = await rootConn(i, pw);
      const next = secretGet(i.key + ".next");
      if (next) { await c.query("ALTER USER 'root'@'localhost' IDENTIFIED BY ?", [next]); try { await c.query("ALTER USER 'root'@'127.0.0.1' IDENTIFIED BY ?", [next]); } catch (e) { /* only @localhost */ } secretSet(i.key, next); secretSet(i.key + ".next", ""); }
      await c.end(); return { ok: true, port: i.port };
    } catch (e) { last = e; await sleep(500); }
  }
  let tail = ""; try { tail = fs.readFileSync(path.join(i.dir, "mariadb.log"), "utf8").trim().split("\n").slice(-3).join(" "); } catch (e) { /* no log */ }
  try { proc.kill(); } catch (e) { /* gone */ }
  throw bad("the database server did not start: " + (tail || (last && last.message) || "no answer"), 500);
}
async function stop(scope) {
  const i = scopeInfo(scope); if (i.external) return { ok: true };
  const r = RUN.get(i.dir); if (!r) return { ok: true, was: false };
  try { const c = await rootConn(i, secretGet(i.key)); await c.query("SHUTDOWN"); await c.end(); } catch (e) { /* kill it */ }
  for (let t = 0; t < 30 && r.proc.exitCode == null; t++) await sleep(200);
  if (r.proc.exitCode == null) try { r.proc.kill(); } catch (e) { /* gone */ }
  RUN.delete(i.dir); return { ok: true, was: true };
}
function stopAll() { for (const [, r] of RUN) try { r.proc.kill(); } catch (e) { /* gone */ } RUN.clear(); }
/** a connection to a scope (started if it is not running), to database db (or none) */
async function conn(scope, db) {
  const i = scopeInfo(scope);
  if (i.external) {
    const c = externalCfg(); if (!c.host) throw bad("set up your server first (host, user, password)");
    return mysql().createConnection({ host: c.host, port: c.port, user: c.user, password: secretGet("db.external.password"), database: db || c.database || undefined, connectTimeout: 8000, dateStrings: true });
  }
  await start(scope);
  return rootConn(i, secretGet(i.key), db);
}
const SYSTEM_DBS = new Set(["mysql", "information_schema", "performance_schema", "sys"]);
const ident = (n) => { const s = String(n || ""); if (!/^[\w$]{1,64}$/.test(s)) throw bad("a name is letters, digits, _ or $ (at most 64)"); return s; };
async function withConn(scope, db, fn) { const c = await conn(scope, db); try { return await fn(c); } finally { try { await c.end(); } catch (e) { /* closed */ } } }
async function databases(scope) { return withConn(scope, null, async (c) => (await c.query("SHOW DATABASES"))[0].map((r) => Object.values(r)[0]).filter((n) => !SYSTEM_DBS.has(n))); }
async function createDb(scope, name) { const n = ident(name); return withConn(scope, null, async (c) => { await c.query("CREATE DATABASE IF NOT EXISTS `" + n + "` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"); return { ok: true, name: n }; }); }
async function dropDb(scope, name) { const n = ident(name); if (SYSTEM_DBS.has(n)) throw bad("that is MariaDB's own"); return withConn(scope, null, async (c) => { await c.query("DROP DATABASE `" + n + "`"); return { ok: true }; }); }
/** tables, views and their columns -> {tables: [{name, kind, rows, columns: [{name, type, null, key, default, extra}]}]} */
async function schema(scope, db) {
  const d = ident(db);
  return withConn(scope, d, async (c) => {
    const [ts] = await c.query("SELECT TABLE_NAME AS n, TABLE_TYPE AS t, TABLE_ROWS AS r FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? ORDER BY TABLE_TYPE, TABLE_NAME", [d]);
    const [cols] = await c.query("SELECT TABLE_NAME AS t, COLUMN_NAME AS n, COLUMN_TYPE AS ty, IS_NULLABLE AS nu, COLUMN_KEY AS k, COLUMN_DEFAULT AS df, EXTRA AS ex FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME, ORDINAL_POSITION", [d]);
    const [fks] = await c.query("SELECT TABLE_NAME AS t, COLUMN_NAME AS n, REFERENCED_TABLE_NAME AS rt, REFERENCED_COLUMN_NAME AS rc FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = ? AND REFERENCED_TABLE_NAME IS NOT NULL", [d]);
    return { db: d, tables: ts.map((t) => ({ name: t.n, kind: /VIEW/i.test(t.t) ? "view" : "table", rows: t.r == null ? null : +t.r,
      columns: cols.filter((x) => x.t === t.n).map((x) => { const fk = fks.find((f) => f.t === t.n && f.n === x.n); return { name: x.n, type: x.ty, null: x.nu === "YES", key: x.k || "", default: x.df, extra: x.ex || "", ref: fk ? fk.rt + "." + fk.rc : null }; }) })) };
  });
}
async function rows(scope, db, table, limit, offset) {
  const d = ident(db), t = ident(table), n = Math.max(1, Math.min(1000, +limit || 200)), o = Math.max(0, +offset || 0);
  return withConn(scope, d, async (c) => { const [r, f] = await c.query("SELECT * FROM `" + t + "` LIMIT " + n + " OFFSET " + o); const [[cnt]] = await c.query("SELECT COUNT(*) AS n FROM `" + t + "`"); return { columns: (f || []).map((x) => x.name), rows: r, total: +cnt.n }; });
}
/** run SQL statements one by one (split outside quotes / comments) -> [{sql, ok, rows?, affected?, error?}] - stops at the first error */
function splitSql(sql) {
  const out = []; let cur = "", q = null, i = 0; const s = String(sql || "");
  while (i < s.length) {
    const ch = s[i], nx = s[i + 1];
    if (!q && ch === "-" && nx === "-") { const e = s.indexOf("\n", i); i = e < 0 ? s.length : e; continue; }
    if (!q && ch === "#") { const e = s.indexOf("\n", i); i = e < 0 ? s.length : e; continue; }
    if (!q && ch === "/" && nx === "*") { const e = s.indexOf("*/", i + 2); i = e < 0 ? s.length : e + 2; continue; }
    if (q) { cur += ch; if (ch === "\\") { cur += nx || ""; i += 2; continue; } if (ch === q) q = null; i++; continue; }
    if (ch === "'" || ch === '"' || ch === "`") { q = ch; cur += ch; i++; continue; }
    if (ch === ";") { if (cur.trim()) out.push(cur.trim()); cur = ""; i++; continue; }
    cur += ch; i++;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}
async function run(scope, db, sql) {
  const list = splitSql(sql); if (!list.length) throw bad("no SQL to run");
  if (list.length > 500) throw bad("at most 500 statements at a time");
  return withConn(scope, db ? ident(db) : null, async (c) => {
    const out = [];
    for (const q of list) {
      try { const [r, f] = await c.query(q); out.push(Array.isArray(r) ? { sql: q, ok: true, columns: (f || []).map((x) => x.name), rows: r.slice(0, 1000), count: r.length } : { sql: q, ok: true, affected: r.affectedRows, insertId: r.insertId || undefined }); }
      catch (e) { out.push({ sql: q, ok: false, error: e.message }); break; }
    }
    return { results: out };
  });
}
module.exports = { setBase, VERSION, downloadFor, find, status, download, start, stop, stopAll, conn, databases, createDb, dropDb, schema, rows, run, splitSql, setExternal, externalCfg, scopeInfo, ident };
