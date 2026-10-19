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
  const exts = list(b);
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

module.exports = { extRoot, list, pageHtml, installFromDir };
