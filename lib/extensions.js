/* bitGen Studio — EXTENSIONS (2.217.0, by instruction: "separate all the
 * dockers into extensions and put them into a ext folder, each extension
 * will go into a subfolder").
 *
 * ext/<id>/ is an extension: a folder holding an ext.json manifest, the
 * docker's HTML fragment (dock.html), and any scripts the docker owns.
 * static/index.html is now the SHELL — where a docker used to sit it holds
 * a one-line marker, and where the docker scripts used to be tagged it
 * holds one scripts marker:
 *
 *     <!-- ext:dock videodock -->          (one per docker, in column order)
 *     <!-- ext:scripts -->                 (once, before the inline script)
 *
 * pageHtml() splices every installed extension into its marker and emits a
 * <script src="/ext/<id>/<file>"> tag per declared script — the assembled
 * page is byte-equivalent to the old monolithic index.html, so the client
 * and every DOM contract are unchanged. A MISSING extension folder simply
 * resolves its marker to nothing: the docker is absent, the page still
 * works (that is the point of extensions — remove the folder, lose the
 * feature, break nothing).
 *
 * ext.json: { "id": "videodock", "name": "Video", "order": 30,
 *             "html": "dock.html", "scripts": ["characters.js"] }
 * `order` fixes script emission order (docks emit their scripts in column
 * order; the HTML order is the shell's marker order regardless).
 *
 * WHY THIS EXISTS beyond tidiness: the flat delivery is now CORE ONLY —
 * ext/ ships as one zip per extension — so the project-knowledge copy of
 * the app shrinks and sessions that never touch a docker's internals never
 * carry its bytes.
 */
"use strict";

const fs = require("fs");
const path = require("path");

function baseDir(base) { return base || require("./core").BASE; }
function extRoot(base) { return path.join(baseDir(base), "ext"); }

/** Every installed extension, manifest-validated, in emission order.
 *  A folder without a parseable ext.json is NOT an extension — ignored. */
function list(base) {
  const root = extRoot(base);
  let names = [];
  try {
    names = fs.readdirSync(root, { withFileTypes: true })
      .filter((d) => d.isDirectory()).map((d) => d.name);
  } catch { return []; }
  const out = [];
  for (const id of names) {
    let man;
    try { man = JSON.parse(fs.readFileSync(path.join(root, id, "ext.json"), "utf8")); }
    catch { continue; }
    if (!man || typeof man !== "object") continue;
    out.push({
      id,
      name: typeof man.name === "string" && man.name ? man.name : id,
      order: Number.isFinite(man.order) ? man.order : 999,
      html: typeof man.html === "string" && man.html ? man.html : null,
      scripts: Array.isArray(man.scripts) ? man.scripts.filter((s) => typeof s === "string") : [],
      // 2.589.0: an extension may bring its own server part (a module with mount(app)) - the Team render farm does
      server: typeof man.server === "string" && /^[A-Za-z0-9_./-]+\.js$/.test(man.server) && !man.server.includes("..") ? man.server : null,
      optional: !!man.optional, note: typeof man.note === "string" ? man.note : "",
      dir: path.join(root, id),
    });
  }
  out.sort((a, b) => (a.order - b.order) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return out;
}

/** The page the browser gets: the shell with every marker resolved. */
function pageHtml(base) {
  const b = baseDir(base);
  let html = fs.readFileSync(path.join(b, "static", "index.html"), "utf8");
  // 2.589.0: an extension with a server part shows only once that part is running (installed = after a restart)
  const exts = list(b).filter((e) => !e.server || mounted.some((m) => m.id === e.id && m.ok));
  const byId = new Map(exts.map((e) => [e.id, e]));

  const fragment = (e) => {
    if (!e || !e.html) return "";
    try { return fs.readFileSync(path.join(e.dir, e.html), "utf8"); }
    catch { return ""; }
  };
  const placed = new Set();
  html = html.replace(/[ \t]*<!-- ext:dock ([a-zA-Z0-9_-]+) -->[ \t]*\r?\n?/g, (_m, id) => {
    placed.add(id);
    return fragment(byId.get(id));
  });
  // the CATCH-ALL slot (2.218.0): an INSTALLED extension the shell has no
  // named marker for — i.e. a genuinely new docker dropped in via Settings →
  // Extensions — splices here, in manifest order. Without this, installing
  // a new extension listed it but could never show it.
  html = html.replace(/[ \t]*<!-- ext:dock \* -->[ \t]*\r?\n?/,
    exts.filter((e) => !placed.has(e.id)).map(fragment).join(""));

  const tags = [];
  for (const e of exts) for (const s of e.scripts)
    tags.push(`<script src="/ext/${e.id}/${s}"></script>`);
  html = html.replace(/[ \t]*<!-- ext:scripts -->[ \t]*\r?\n?/,
    tags.length ? tags.join("\n") + "\n" : "");
  // 2.242.0 (the "buttons are not working" lesson): VERSION-STAMP every
  // app-served script and stylesheet URL. A cache entry stored BEFORE the
  // 2.239.0 no-cache header keeps its old headers and can skip
  // revalidation for hours — the fresh markup then runs LAST release's
  // scripts (tabs work, the new buttons are dead: the exact field
  // symptom). A new version = a NEW URL = no cache anywhere, whatever its
  // headers, can ever serve last release's code. express.static ignores
  // the query when resolving the file.
  let ver = "0";
  try { ver = JSON.parse(fs.readFileSync(path.join(b, "package.json"), "utf8")).version || "0"; }
  catch { /* an unversioned tree still stamps, as 0 */ }
  html = html.replace(/((?:src|href)="\/(?:static|ext)\/[^"?]+)"/g,
    `$1?v=${ver}"`);
  return html;
}

/** Install every extension zip found in `dir` (2.218.0, by instruction:
 *  "allow user to select a folder and install all the extensions from that
 *  folder (zip files)").
 *
 *  A zip QUALIFIES by content, not by filename: only entries under
 *  ext/<id>/ are taken, and at least one taken ext/<id>/ext.json must be
 *  among them — a zip with none is reported skipped, never half-extracted.
 *  Existing files are overwritten, so pointing this at a folder of newer
 *  bitgen-ext-*.zip files IS the upgrade path. Nothing outside ext/ is
 *  ever written (the filter runs before the traversal guard even matters).
 *  The page assembles per request, so an install shows up on next reload —
 *  no restart. */
function installFromDir(dir, base) {
  const b = baseDir(base);
  const unzip = require("./unzip");
  let names = [];
  const st = fs.statSync(dir);                       // throws -> route's 400
  if (!st.isDirectory()) throw new Error("not a folder: " + dir);
  names = fs.readdirSync(dir).filter((n) => /\.zip$/i.test(n)).sort();
  const report = { installed: [], skipped: [] };
  const OK = /^ext\/[A-Za-z0-9_-]+\/.+/;
  for (const n of names) {
    const zp = path.join(dir, n);
    let ents;
    try { ents = unzip.entries(fs.readFileSync(zp)); }
    catch (e) { report.skipped.push({ zip: n, why: e.message }); continue; }
    const take = ents.map((e) => e.name.replace(/\\/g, "/"))
      .filter((nm) => OK.test(nm) && !unzip.unsafe(nm));
    const ids = [...new Set(take.map((nm) => nm.split("/")[1]))]
      .filter((id) => take.includes("ext/" + id + "/ext.json")).sort();
    if (!ids.length) { report.skipped.push({ zip: n, why: "no ext/<id>/ext.json inside — not an extension zip" }); continue; }
    const keep = take.filter((nm) => ids.includes(nm.split("/")[1]));
    try {
      const files = unzip.extract(zp, b, (nm) => keep.includes(nm.replace(/\\/g, "/")));
      report.installed.push({ zip: n, ids, files: files.length });
    } catch (e) { report.skipped.push({ zip: n, why: e.message }); }
  }
  return report;
}

/** 2.589.0: every installed extension's server part (ext.json "server": a module with mount(app)) - mounted once at
 *  start, in emission order; one that throws is reported and skipped (the app still starts). -> [{id, ok, error}] */
function mountServers(app, base) {
  const out = [];
  for (const e of list(base)) {
    if (!e.server) continue;
    try { require(path.join(e.dir, e.server)).mount(app); out.push({ id: e.id, ok: true }); }
    catch (err) { out.push({ id: e.id, ok: false, error: String((err && err.message) || err) }); console.error(`[extensions] ${e.id}: its server part did not load - ${(err && err.message) || err}`); }
  }
  mounted = out;
  return out;
}
let mounted = [];
const mountedServers = () => mounted.slice();
/** 2.589.0: one extension zip (its bytes) -> {installed: [ids], files} - Settings ▸ Add-ons' 📦 Install from a zip…;
 *  only = the id it must hold (another extension's zip is refused) */
function installZipBuffer(buf, only, base) {
  const b = baseDir(base);
  const unzip = require("./unzip");
  const ents = unzip.entries(buf);
  const OK = /^ext\/[A-Za-z0-9_-]+\/.+/;
  const take = ents.map((e) => e.name.replace(/\\/g, "/")).filter((nm) => OK.test(nm) && !unzip.unsafe(nm));
  let ids = [...new Set(take.map((nm) => nm.split("/")[1]))].filter((id) => take.includes("ext/" + id + "/ext.json")).sort();
  if (only) ids = ids.filter((id) => id === only);
  if (!ids.length) { const e = new Error(only ? `that zip does not hold ext/${only}/ - pick bitgen-ext-${only}-v<version>.zip` : "no ext/<id>/ext.json inside - not an extension zip"); e.status = 400; throw e; }
  const keep = take.filter((nm) => ids.includes(nm.split("/")[1]));
  const os = require("os");
  const tmp = path.join(os.tmpdir(), "bgext-" + Date.now().toString(36) + ".zip");
  fs.writeFileSync(tmp, buf);
  try { const files = unzip.extract(tmp, b, (nm) => keep.includes(nm.replace(/\\/g, "/"))); return { installed: ids, files: files.length }; }
  finally { try { fs.rmSync(tmp, { force: true }); } catch { /* temp */ } }
}
/** 2.589.0: remove an installed extension's folder -> {removed} */
function removeExt(id, base) {
  const safe = String(id || "").replace(/[^A-Za-z0-9_-]/g, "");
  const d = path.join(extRoot(base), safe);
  if (!safe || !fs.existsSync(path.join(d, "ext.json"))) { const e = new Error("no extension " + id); e.status = 404; throw e; }
  fs.rmSync(d, { recursive: true, force: true });
  return { removed: safe };
}
const installed = (id, base) => fs.existsSync(path.join(extRoot(base), String(id || "").replace(/[^A-Za-z0-9_-]/g, ""), "ext.json"));

module.exports = { extRoot, list, pageHtml, installFromDir, mountServers, mountedServers, installZipBuffer, removeExt, installed };
