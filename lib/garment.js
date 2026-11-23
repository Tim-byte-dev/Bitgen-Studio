// bitGen Studio — lib/garment.js (2.932.0): 👗 the Garment designer - sewing patterns made by GarmentCode's garment programs
// (the add-on: lib/garmentAddon.js; the Python side: scripts/garment_pattern.py; the shared rules: static/garmentspec.js).
//
//   schema()                    the design tree (the add-on's own copy when installed, else lib/garment/schema.json)
//   presets()                   bitGen's starting points (lib/garment/presets.json)
//   presetValues(id)            {path: v} of one preset
//   designFor(values, tree?)    the full design tree the garment programs read
//   mannequinBody(sex)          the display mannequin's 26 measurements (static/mannequins/mesh/<sex>.measure.json, cm)
//   bodyOf({sex, height, bust, waist, hips})   the mannequin moved onto your own measurements (H3GarmentSpec.bodyFor)
//   make({name, values, body}, deps)   -> {slug, name, panels, stitches, self_intersecting, size_cm, files {svg, outline, spec},
//                                          urls} - kept in projects/<p>/garments/<slug>/ with meta.json
//   list() / get(slug) / remove(slug) / fileOf(slug, name)
// deps (tests): {run, runtime} - run(cmd, args, {log, env, timeout}) -> exit code, the lines through log.
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const core = require("./core");
const spec = require("../static/garmentspec.js");

const HERE = __dirname;
const SEXES = ["female", "male"];
const FILES = ["pattern.svg", "pattern.png", "outline.json", "specification.json", "design.json", "body.yaml", "meta.json"];
const bad = (m, status) => Object.assign(new Error(m), { status: status || 400 });

function readJson(f) { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return null; } }
function schema() {
  const own = readJson(require("./garmentAddon").paths().schema);
  if (own && own.design && own.design.meta) return own.design;
  return readJson(path.join(HERE, "garment", "schema.json")).design;
}
function presets() { return readJson(path.join(HERE, "garment", "presets.json")).presets; }
function presetValues(id) { return spec.preset(presets(), id); }
function designFor(values, tree) { return spec.build(tree || schema(), values || {}); }
function mannequinBody(sex) {
  const s = SEXES.includes(sex) ? sex : "female";
  const m = readJson(path.join(core.BASE, "static", "mannequins", "mesh", `${s}.measure.json`));
  if (!m || !m.body) throw bad(`the ${s} mannequin's measurements are missing (static/mannequins/mesh/${s}.measure.json)`, 500);
  return m.body;
}
function mannequins() {
  const out = {};
  for (const s of SEXES) {
    const m = readJson(path.join(core.BASE, "static", "mannequins", "mesh", `${s}.measure.json`)) || {};
    out[s] = { height: (m.body || {}).height, bust: (m.body || {}).bust, waist: (m.body || {}).waist, hips: (m.body || {}).hips, note: m.note || "" };
  }
  return out;
}
function bodyOf(b) {
  const o = b || {};
  return spec.bodyFor(mannequinBody(o.sex), { height: o.height, bust: o.bust, waist: o.waist, hips: o.hips });
}

function slugOf(name) {
  const s = String(name || "").normalize("NFKD").replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").toLowerCase().slice(0, 48);
  return s || "garment";
}
function root() { return core.pDir("garments"); }
function dirOf(slug) {
  const s = String(slug || "");
  if (!/^[\w-]{1,64}$/.test(s)) throw bad("no such garment");
  return path.join(root(), s);
}
function fileOf(slug, name) {
  const dm = /^drape-(.+)$/.exec(String(name || ""));             // 2.933.0: the drape's files (lib/garmentDrape.js)
  if (dm) {
    if (!require("./garmentDrape").DRAPE_FILES.includes(dm[1])) throw bad("no such file", 404);
    const f = path.join(dirOf(slug), "drape", dm[1]);
    if (!fs.existsSync(f)) throw bad("no such file", 404);
    return f;
  }
  if (!FILES.includes(name) && !/^pattern-[a-z0-9]{1,8}-sa\d{1,2}mm\.pdf$/.test(String(name || ""))) throw bad("no such file", 404);
  const f = path.join(dirOf(slug), name);
  if (!fs.existsSync(f)) throw bad("no such file", 404);
  return f;
}
const urlOf = (slug, name) => `/api/garment/file/${encodeURIComponent(slug)}/${encodeURIComponent(name)}`;

/** run scripts/garment_pattern.py once -> its GARMENT answer */
async function runPattern(req, deps) {
  const d = deps || {};
  const rt = d.runtime || require("./garmentAddon").runtime();
  if (!fs.existsSync(rt.python)) throw bad("the Garment designer is not installed - Settings ▸ Add-ons ▸ Garment designer", 409);
  const run = d.run || require("./setupExec").run;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bggm-"));
  const f = path.join(tmp, "req.json");
  fs.writeFileSync(f, JSON.stringify(Object.assign({ src: rt.src }, req)));
  let res = null; const tail = [];
  try {
    const code = await run(rt.python, [rt.script, f], {
      env: Object.assign({}, process.env, { PYTHONUTF8: "1", PYTHONIOENCODING: "utf-8" }), timeout: 3 * 60000,
      log: (l) => { const m = /GARMENT (\{.*\})\s*$/.exec(String(l)); if (m) { try { res = JSON.parse(m[1]); } catch { /* not it */ } } else { tail.push(String(l)); if (tail.length > 12) tail.shift(); } } });
    if (!res) throw bad("the pattern script stopped" + (code === -2 ? " (it took over 3 minutes)" : "") + (tail.length ? ": " + tail.slice(-3).join(" | ").slice(0, 400) : ""), 500);
    return res;
  } finally { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* temp */ } }
}

async function make(o, deps) {
  const q = o || {};
  const name = String(q.name || "").trim().slice(0, 60) || "Garment";
  const values = spec.changed(schema(), q.values || {});
  const v = Object.assign(spec.valuesOf(schema()), values);
  if (!v["meta.upper"] && !v["meta.bottom"] && !v["meta.wb"]) throw bad("pick a top, a waistband or a bottom first");
  const bodyIn = Object.assign({ sex: "female" }, q.body || {});
  const body = bodyOf(bodyIn);
  const slug = slugOf(q.slug || name);
  const dir = dirOf(slug);
  const work = dir + ".part";
  try { fs.rmSync(work, { recursive: true, force: true }); } catch { /* none */ }
  fs.mkdirSync(work, { recursive: true });
  let r;
  try { r = await runPattern({ op: "make", name: slug.replace(/-/g, "_"), out: work, body, design: designFor(values) }, deps); }
  catch (e) { try { fs.rmSync(work, { recursive: true, force: true }); } catch { /* none */ } throw e; }
  if (!r.ok) { try { fs.rmSync(work, { recursive: true, force: true }); } catch { /* none */ } throw bad("GarmentCode could not make that garment: " + (r.error || "?"), 422); }
  const meta = { name, slug, values, body: bodyIn, measurements: body, made: new Date().toISOString(), panels: r.panels,
    stitches: r.stitches, self_intersecting: !!r.self_intersecting, size_cm: r.size_cm, files: r.files };
  fs.writeFileSync(path.join(work, "meta.json"), JSON.stringify(meta, null, 1));
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* none */ }
  fs.renameSync(work, dir);
  return view(meta);
}
function view(meta) {
  const m = Object.assign({}, meta);
  m.urls = {};
  for (const [k, f] of Object.entries(m.files || {})) m.urls[k] = urlOf(m.slug, f);
  try { m.pdfs = fs.readdirSync(dirOf(m.slug)).filter((f) => /^pattern-.*\.pdf$/.test(f)).map((f) => ({ name: f, url: urlOf(m.slug, f) })); }
  catch { m.pdfs = []; }
  if (m.drape && m.drape.files) {
    m.drape = Object.assign({}, m.drape, { urls: {} });
    for (const [k, f] of Object.entries(m.drape.files)) m.drape.urls[k] = urlOf(m.slug, "drape-" + f);
  }
  return m;
}
function get(slug) {
  const m = readJson(path.join(dirOf(slug), "meta.json"));
  if (!m) throw bad("no such garment", 404);
  return view(m);
}
function list() {
  let ds = [];
  try { ds = fs.readdirSync(root(), { withFileTypes: true }).filter((d) => d.isDirectory() && /^[\w-]+$/.test(d.name)); } catch { ds = []; }
  return ds.map((d) => { try { return get(d.name); } catch { return null; } }).filter(Boolean)
    .sort((a, b) => String(b.made).localeCompare(String(a.made)));
}
/** the pattern as a PDF at actual size -> {name, url, pages, sheets} (kept beside the garment as pattern-<paper>-sa<mm>.pdf) */
async function pdf(slug, o) {
  const opt = o || {};
  const P = require("./garmentPdf");
  const outline = readJson(path.join(dirOf(slug), "outline.json"));
  const meta = readJson(path.join(dirOf(slug), "meta.json"));
  if (!outline || !meta) throw bad("no such garment", 404);
  const paper = P.PAPERS[opt.paper] ? opt.paper : "a4";
  const sa = Math.max(0, Math.min(5, Math.round((+opt.sa || 0) * 10) / 10));
  const r = await P.pdf(outline, { paper, sa, title: meta.name, body: Object.assign({ sex: (meta.body || {}).sex }, meta.measurements || {}) });
  const name = `pattern-${paper}-sa${Math.round(sa * 10)}mm.pdf`;
  fs.writeFileSync(path.join(dirOf(slug), name), Buffer.from(r.bytes));
  return { name, url: urlOf(slug, name), pages: r.pages, sheets: r.sheets, paper, sa };
}
function remove(slug) {
  const d = dirOf(slug);
  if (!fs.existsSync(path.join(d, "meta.json"))) throw bad("no such garment", 404);
  fs.rmSync(d, { recursive: true, force: true });
  return { ok: true };
}

module.exports = { schema, presets, presetValues, designFor, mannequinBody, mannequins, bodyOf, slugOf, dirOf, fileOf, urlOf,
  runPattern, make, pdf, get, list, remove, SEXES };
