"use strict";
/**
 * bitGen Studio — lib/dazImport.js (2.993.0): ⤓ IMPORT DAZ CONTENT ZIPS INTO A LIBRARY FOLDER.
 * Tim: "in sketcher when daz dockers are visible add an import button next to my library, open a dialog, the dialog will have a
 * create new library folder, create a library structure in the selected folder (from folder select), add an import button, allow
 * user to select folders, look through all the folders for zip files, extract them to the right location."
 * Not a replacement for Daz Studio / DIM (Daz Install Manager) - light tasks: it unpacks product zips the way they are laid out.
 *
 * Where an entry goes (pure - mapEntry / planZip): a product zip holds the library's own top folders (data/, People/, Runtime/ …)
 * either at its root, under "Content/" (a DIM package, with Manifest.dsx / Supplement.dsx beside it) or under any wrapper
 * folders ("My Library/", "<product>/Content/"). The FIRST path part that is a known top folder starts the library path (its
 * name in Daz's own case); everything before it is dropped. Other files (readmes, the DIM notes, previews at the root) stay out
 * and are listed; a zip inside the zip is opened too (2 levels). Unsafe names ("..", absolute) are refused.
 *   STRUCTURE, TOP, makeStructure(dir), mapEntry(name), planZip(names), findZips(folders, {recursive}), names(zip),
 *   peek(zip), importZip(zip, lib, {overwrite, onEntry, cancelled}), importAll(zips, lib, opts)
 */
const fs = require("fs");
const path = require("path");
const os = require("os");

/** the folders a new library gets (Daz Studio's own "My Library" layout) */
const STRUCTURE = ["data", "Documentation", "Environments", "Light Presets", "People", "Props", "Render Presets", "Runtime/Libraries",
  "Runtime/Support", "Runtime/Textures", "Scripts", "Shader Presets", "Camera Presets"];
/** the top folders a product zip may bring (Daz Studio + Poser-style Runtime) - the case they are written in */
const TOP = ["data", "Runtime", "People", "Props", "Environments", "Light Presets", "Render Presets", "Shader Presets", "Camera Presets",
  "Scripts", "Documentation", "Animals", "Vehicles", "Scenes", "Scene Subsets", "Presets", "Lights", "Architecture", "aniBlocks",
  "ReadMe's", "Utilities", "Poses", "Materials", "Pose Presets"];
const TOPMAP = new Map(TOP.map((t) => [t.toLowerCase(), t]));
const DIM_NOTES = /^(manifest|supplement)\.dsx$/i;
const MAX_NEST = 2;

/** makes the library layout in `dir` (it may exist; nothing is removed) -> the folders made */
function makeStructure(dir) {
  const d = String(dir || "").trim(); if (!d) throw Object.assign(new Error("pick a folder first"), { status: 400 });
  fs.mkdirSync(d, { recursive: true });
  const made = [];
  for (const s of STRUCTURE) { const p = path.join(d, ...s.split("/")); if (!fs.existsSync(p)) { fs.mkdirSync(p, { recursive: true }); made.push(s); } }
  return made;
}
/** a new library folder `name` in `parent` + its layout -> {dir, made} */
function newLibrary(parent, name) {
  const pr = String(parent || "").trim(), nm = String(name || "").trim();
  if (!pr || !fs.existsSync(pr) || !fs.statSync(pr).isDirectory()) throw Object.assign(new Error("pick the folder the new library goes in"), { status: 400 });
  if (!nm || /[\\/:*?"<>|]/.test(nm) || nm === "." || nm === "..") throw Object.assign(new Error("a folder name without \\ / : * ? \" < > |"), { status: 400 });
  const dir = path.join(pr, nm);
  return { dir, existed: fs.existsSync(dir), made: makeStructure(dir) };
}

/** one zip entry -> {dest: "People/Genesis 9/…"} | {zip: true} (a zip inside) | {skip: why} | {dir: true} */
function mapEntry(name) {
  let n = String(name || "").replace(/\\/g, "/");
  if (!n || /\/$/.test(n)) return { dir: true };
  if (/^\//.test(n) || /^[a-z]:/i.test(n)) return { skip: "an absolute path" };
  n = n.replace(/^(\.\/)+/, "");
  const parts = n.split("/").filter((x) => x !== "" && x !== ".");
  if (parts.some((x) => x === "..")) return { skip: "an unsafe path (..)" };
  if (parts.some((x) => x === "__MACOSX") || /^\.ds_store$|^thumbs\.db$/i.test(parts[parts.length - 1])) return { skip: "system file" };
  for (let i = 0; i < parts.length - 1; i++) {
    const t = TOPMAP.get(parts[i].toLowerCase());
    if (t) return { dest: [t].concat(parts.slice(i + 1)).join("/") };
  }
  const base = parts[parts.length - 1];
  if (/\.zip$/i.test(base)) return { zip: true };
  if (DIM_NOTES.test(base)) return { skip: "the DIM package's notes" };
  return { skip: "not in a library folder" };
}
/** a zip's names -> {kind dim | daz | zips | none, files [{name, dest}], nested [names], skipped [{name, why}], tops [..]} */
function planZip(names) {
  const files = [], nested = [], skipped = [], tops = new Set();
  let dim = false;
  for (const nm of names || []) {
    const m = mapEntry(nm);
    if (m.dir) continue;
    if (m.dest) { files.push({ name: nm, dest: m.dest }); tops.add(m.dest.split("/")[0]); if (/^content\//i.test(String(nm).replace(/\\/g, "/"))) dim = true; }
    else if (m.zip) nested.push(nm);
    else { skipped.push({ name: nm, why: m.skip }); if (/^(manifest|supplement)\.dsx$/i.test(path.basename(String(nm)))) dim = true; }
  }
  const kind = files.length ? (dim ? "dim" : "daz") : nested.length ? "zips" : "none";
  return { kind, files, nested, skipped, tops: [...tops].sort() };
}

/** every .zip under the folders (recursive by default; hidden folders and node_modules skipped) -> [{path, size}] */
function findZips(folders, o) {
  const opt = o || {}, rec = opt.recursive !== false, max = opt.max || 5000, out = [], seen = new Set();
  const walk = (d, depth) => {
    let ents; try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { return; }
    for (const e of ents) {
      if (out.length >= max) return;
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (rec && depth < 12 && !/^\./.test(e.name) && e.name !== "node_modules" && e.name !== "__MACOSX") walk(p, depth + 1); }
      else if (e.isFile() && /\.zip$/i.test(e.name)) { const k = path.resolve(p); if (!seen.has(k)) { seen.add(k); let size = 0; try { size = fs.statSync(p).size; } catch (x) { /* gone */ } out.push({ path: p, size }); } }
    }
  };
  for (const f of folders || []) { const d = String(f || "").trim(); if (d && fs.existsSync(d) && fs.statSync(d).isDirectory()) walk(d, 0); }
  return out.sort((a, b) => a.path.localeCompare(b.path));
}

function yz() { return require("yauzl"); }
// names are read RAW (decodeStrings false): yauzl would refuse the whole zip for one "../" entry - mapEntry refuses just that one
function openZip(file) { return new Promise((ok, no) => yz().open(file, { lazyEntries: true, autoClose: true, decodeStrings: false }, (e, z) => (e ? no(e) : ok(z)))); }
function nameOf(e) { const b = e.fileName; return Buffer.isBuffer(b) ? b.toString((e.generalPurposeBitFlag & 0x800) ? "utf8" : "latin1") : String(b); }
/** the names in a zip (its directory only - quick even for a big one) */
async function names(file) {
  const z = await openZip(file);
  return new Promise((ok, no) => { const out = []; z.on("entry", (e) => { out.push(nameOf(e)); z.readEntry(); }); z.on("end", () => ok(out)); z.on("error", no); z.readEntry(); });
}
/** what a zip holds, for the list -> {kind, files, nested, skipped, tops} (counts) | {error} */
async function peek(file) {
  try { const p = planZip(await names(file)); return { kind: p.kind, files: p.files.length, nested: p.nested.length, skipped: p.skipped.length, tops: p.tops }; }
  catch (e) { return { kind: "bad", error: "can't read it as a zip (" + String(e.message || e).slice(0, 120) + ")" }; }
}

/** inside the library? (a mapped path never leaves it - checked anyway) */
function inside(lib, p) { const r = path.relative(path.resolve(lib), path.resolve(p)); return !!r && !r.startsWith("..") && !path.isAbsolute(r); }

/** unpacks one zip into the library -> {written, kept, skipped, nested, bytes, errors, kind} */
async function importZip(file, lib, o, depth) {
  const opt = o || {}, lv = depth || 0, res = { file, written: 0, kept: 0, skipped: 0, nested: 0, bytes: 0, errors: [], kind: "none" };
  const L = path.resolve(String(lib || "")); if (!fs.existsSync(L) || !fs.statSync(L).isDirectory()) throw Object.assign(new Error("the library folder is not there"), { status: 400 });
  const all = await names(file), plan = planZip(all); res.kind = plan.kind; res.skipped = plan.skipped.length;
  const want = new Map(plan.files.map((f) => [f.name, f.dest])), inner = new Set(plan.nested);
  if (!want.size && !inner.size) return res;
  const tmps = [];
  const z = await openZip(file);
  await new Promise((ok, no) => {
    const next = () => { if (opt.cancelled && opt.cancelled()) { z.close(); ok(); return; } z.readEntry(); };
    z.on("entry", (e) => {
      const nm = nameOf(e), dest = want.get(nm), isZip = lv < MAX_NEST && inner.has(nm);
      if (!dest && !isZip) return next();
      const to = dest ? path.join(L, ...dest.split("/")) : path.join(os.tmpdir(), "bitgen-dazimp-" + process.pid + "-" + Date.now() + "-" + tmps.length + ".zip");
      if (dest && !inside(L, to)) { res.errors.push(nm + ": outside the library - refused"); return next(); }
      if (dest && fs.existsSync(to) && !opt.overwrite) { res.kept++; return next(); }
      fs.mkdirSync(path.dirname(to), { recursive: true });
      z.openReadStream(e, (err, rs) => {
        if (err) { res.errors.push(nm + ": " + err.message); return next(); }
        const part = to + ".part", ws = fs.createWriteStream(part);
        let n = 0; rs.on("data", (c) => { n += c.length; });
        const bad = (x) => { res.errors.push(nm + ": " + (x.message || x)); try { fs.unlinkSync(part); } catch (y) { /* gone */ } next(); };
        rs.on("error", bad); ws.on("error", bad);
        ws.on("finish", () => {
          try { fs.renameSync(part, to); } catch (x) { return bad(x); }
          if (dest) { res.written++; res.bytes += n; if (opt.onEntry) opt.onEntry(dest); } else tmps.push(to);
          next();
        });
        rs.pipe(ws);
      });
    });
    z.on("end", ok); z.on("error", no);
    next();
  });
  for (const t of tmps) {   // a zip inside the zip: unpacked the same way
    try { const r = await importZip(t, L, opt, lv + 1); res.nested++; res.written += r.written; res.kept += r.kept; res.bytes += r.bytes; res.errors.push(...r.errors); if (r.kind !== "none" && res.kind === "zips") res.kind = r.kind; }
    catch (e) { res.errors.push(path.basename(t) + ": " + e.message); }
    try { fs.unlinkSync(t); } catch (e) { /* gone */ }
  }
  return res;
}

/* ---- the import job (one at a time; the dialog polls it) */
let JOB = null;
function job() { return JOB ? Object.assign({}, JOB, { results: JOB.results.slice(-400) }) : null; }
function start(zips, lib, o) {
  if (JOB && JOB.state === "running") throw Object.assign(new Error("an import is already running"), { status: 409 });
  const list = (Array.isArray(zips) ? zips : []).map(String).filter((z) => /\.zip$/i.test(z) && fs.existsSync(z));
  if (!list.length) throw Object.assign(new Error("no zip files picked"), { status: 400 });
  const L = String(lib || "").trim(); if (!L || !fs.existsSync(L) || !fs.statSync(L).isDirectory()) throw Object.assign(new Error("pick the library folder to import into"), { status: 400 });
  const J = JOB = { id: Date.now().toString(36), state: "running", library: L, total: list.length, done: 0, current: "", written: 0, kept: 0, bytes: 0, results: [], cancel: false };
  (async () => {
    for (const z of list) {
      if (J.cancel) break;
      J.current = path.basename(z);
      try { const r = await importZip(z, L, { overwrite: !!(o && o.overwrite), cancelled: () => J.cancel }); J.written += r.written; J.kept += r.kept; J.bytes += r.bytes; J.results.push(r); }
      catch (e) { J.results.push({ file: z, written: 0, kept: 0, skipped: 0, nested: 0, bytes: 0, errors: [String(e.message || e)], kind: "bad" }); }
      J.done++;
    }
    J.current = ""; J.state = J.cancel ? "cancelled" : "done";
  })();
  return job();
}
function cancel() { if (JOB && JOB.state === "running") JOB.cancel = true; return job(); }

module.exports = { STRUCTURE, TOP, makeStructure, newLibrary, mapEntry, planZip, findZips, names, peek, importZip, start, job, cancel, inside };
