/* bitGen Studio — lib/langPacks.js (2.715.0): LANGUAGE PACKS - every language besides English is a pack, so a new one is
 * added without touching the code.
 *
 * Tim (verbatim): "is it too late to make the languages into language packs,so we can add a new language easily later?" -
 * then: "lets do number 2, this way we don't have to create all the packs at once - if we could have a master pack so users
 * can translate the strings and upload to tigerart for the community it would be ideal"
 *
 * A pack is a folder (or a .zip of one) with:
 *   pack.json        {format: 1, id: "ko", name: "Korean", native: "한국어", region?, browser: ["ko"] (the browser / system
 *                    languages that pick it - "zh-hant" matches zh-Hant-TW too; the longest match wins), keepAll? (CJK:
 *                    short labels break only at spaces), version, authors [], app? (made with), words {stale, missing,
 *                    english, lang} (the guide's notes in that language)}
 *   ui.json          {strings: {"English": "translation"}, patterns: {"installed {0}": "…{0}…"}} - the app's own words
 *                    (static/uilang.js); "" = not translated (shows English)
 *   USAGE.md         the guide - "## " sections, each with its  <!-- en: <id> <hash> -->  line (lib/helpI18n.js)
 *   shortcuts.json   {groups: [{en: <hash>, title, rows: [[key, what]]}]} - the English groups' order
 *   FEATURES.md      the feature list, line for line with docs/FEATURES.md (the website's Features page)
 *   site.json        {strings: {...}} the tigerart.com.au website's words (optional)
 *   help/<topic>.html  the ❔ help pages (first line <!-- en: <topic> <hash> -->) - only plain tags are kept (sanitizeHelp)
 * Any part may be missing or half done: whatever is not translated - or is still word for word the English - shows English.
 *
 * Where packs live: BUILT IN  docs/i18n/<id>/pack.json (zh-CN, zh-TW, ja - their "files" says where their older files
 * are: static/i18n/ui/<id>.json, static/help/<id>/); INSTALLED  <install>/langpacks/<id>/ (Settings ▸ Languages - an
 * installed pack with a built-in's id is used instead of it until removed).
 *
 *   list() / get(id) / isLang(id) / files(id) / client()     the packs ({id, name, native, browser, keepAll, words, source:
 *                                     "built-in" | "installed", replaces, ...}); files = absolute paths of each part
 *   englishUi()                      {strings: [...], patterns: [...]} - what ui.json translates (static/i18n/ui/strings.json +
 *                                     dynamic.json)
 *   coverage(id)                     {ui, patterns, guide, shortcuts, help, features, site: {done, total[, stale]}}
 *   check(zipBuf)                    {pack, files {name: Buffer}, warnings} - read and cleaned, nothing written (throws 400)
 *   install(zipBuf, {replace})       -> {pack, warnings, coverage} (409 {exists} when that id is installed and !replace)
 *   remove(id)                       -> {removed} (installed packs only)
 *   shareZip(id)                     2.716.0: the pack to share with the community - an installed one as it is (its own files),
 *                                     a built-in one as exportZip
 *   exportZip(id) / masterZip()      a pack to translate: every current English part, filled from the pack where it has
 *                                     a translation (exportZip) or all English (masterZip, id "xx") + TRANSLATING.txt
 *   sanitizeHelp(html)               only b i em strong code kbd p br ul ol li h1-h4 pre table parts span div, id="…" kept
 */
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const unzip = require("./unzip");
const zipWrite = require("./zipWrite");

const FORMAT = 1;
const ID_RE = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8}){0,2}$/;
const TAG_RE = /^[a-z]{2,3}(-[a-z0-9]{2,8}){0,3}$/;
const MAX_ZIP = 8 * 1024 * 1024, MAX_FILE = 8 * 1024 * 1024, MAX_TOTAL = 32 * 1024 * 1024, MAX_FILES = 500;
const LAYOUT = { ui: "ui.json", usage: "USAGE.md", shortcuts: "shortcuts.json", features: "FEATURES.md", site: "site.json", help: "help" };
const TOPIC = /^[a-z0-9_-]{1,40}$/i;

let BASE = null, USER = null, CACHE = null, GEN = 0;
/** tests: the install folder (docs/, static/ under it) and where installed packs go */
function setBase(b, user) { BASE = b || null; USER = user || null; CACHE = null; }
const base = () => BASE || require("./core").BASE;      // (lazily: the website's refresh builds the master pack from a bare checkout)
const baseDir = () => base();
const userDir = () => USER || path.join(base(), "langpacks");
const builtinDir = () => path.join(base(), "docs", "i18n");
const bad = (msg, status, extra) => Object.assign(new Error(msg), { status: status || 400 }, extra || {});
const readText = (p) => { try { return fs.readFileSync(p, "utf8"); } catch (e) { return null; } };
const readJson = (p) => { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch (e) { return null; } };
const mtime = (p) => { try { return fs.statSync(p).mtimeMs; } catch (e) { return 0; } };
const hash12 = (s) => crypto.createHash("sha256").update(s).digest("hex").slice(0, 12);
// eslint-disable-next-line no-control-regex
const text = (v, max) => (typeof v === "string" || typeof v === "number" ? String(v) : "").replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "").trim().slice(0, max);

/** pack.json -> the clean record, or {error} saying what is wrong */
function cleanMeta(j) {
  if (!j || typeof j !== "object") return { error: "pack.json is not a JSON object" };
  const id = text(j.id, 24);
  if (!ID_RE.test(id)) return { error: `pack.json "id" must be a language code like ko, es, pt-BR or zh-Hant (got "${id}")` };
  if (id.toLowerCase() === "en") return { error: "English is built in - give the pack another language's code" };
  if (id === "xx") return { error: 'pack.json still has the master pack\'s "id": "xx" - put your language\'s code there (like ko, es, pt-BR)' };
  const native = text(j.native, 40);
  if (!native || /^Your language/i.test(native)) return { error: 'pack.json needs "native": the language\'s name in its own words (like 한국어, Español)' };
  const browser = (Array.isArray(j.browser) ? j.browser : []).map((t) => text(t, 30).toLowerCase()).filter((t) => TAG_RE.test(t)).slice(0, 12);
  const words = {};
  const w = j.words && typeof j.words === "object" ? j.words : {};
  for (const k of ["stale", "missing", "english", "lang"]) { const v = text(w[k], 300); if (v) words[k] = v; }
  const name = text(j.name, 60);
  return {
    format: FORMAT, id, name: name && !/^Your language/i.test(name) ? name : native, native, region: text(j.region, 80),
    browser: browser.length ? browser : [id.toLowerCase()], keepAll: j.keepAll === true, rtl: j.rtl === true,
    version: text(j.version, 20) || "1", authors: (Array.isArray(j.authors) ? j.authors : []).map((a) => text(a, 60)).filter((a) => a && !/^Your name/i.test(a)).slice(0, 12),
    app: text(j.app, 20), madeFrom: text(j.madeFrom, 24), notes: text(j.notes, 500), order: Number.isFinite(+j.order) ? +j.order : 100, words,
  };
}

function scan() {
  const key = [mtime(builtinDir()), mtime(userDir()), GEN].join(":");
  if (CACHE && CACHE.key === key) return CACHE.packs;
  const out = new Map();
  const B = path.resolve(base());
  let dirs = [];
  try { dirs = fs.readdirSync(builtinDir()); } catch (e) { dirs = []; }
  for (const d of dirs) {
    const dir = path.join(builtinDir(), d), j = readJson(path.join(dir, "pack.json"));
    if (!j) continue;
    const m = cleanMeta(j);
    if (m.error || m.id !== d) continue;
    const files = {};
    for (const k of Object.keys(LAYOUT)) {
      const rel = j.files && typeof j.files[k] === "string" ? j.files[k] : LAYOUT[k];
      const abs = path.resolve(dir, rel);
      files[k] = abs.startsWith(B + path.sep) ? abs : path.join(dir, LAYOUT[k]);       // a built-in's own files stay inside the install
    }
    out.set(m.id, Object.assign(m, { source: "built-in", replaces: false, dir, files }));
  }
  try { dirs = fs.readdirSync(userDir()); } catch (e) { dirs = []; }
  for (const d of dirs) {
    if (d.startsWith(".")) continue;
    const dir = path.join(userDir(), d), m = cleanMeta(readJson(path.join(dir, "pack.json")));
    if (m.error || m.id !== d) continue;
    const files = {}; for (const k of Object.keys(LAYOUT)) files[k] = path.join(dir, LAYOUT[k]);
    const was = out.get(m.id);
    if (was && was.source === "built-in") m.order = was.order;
    out.set(m.id, Object.assign(m, { source: "installed", replaces: !!(was && was.source === "built-in"), dir, files, builtin: was && was.source === "built-in" ? was : null }));
  }
  const rank = (p) => (p.source === "built-in" || p.replaces ? 0 : 1);       // the built-in languages first, in their order
  const packs = [...out.values()].sort((a, b) => rank(a) - rank(b) || a.order - b.order || a.native.localeCompare(b.native));
  CACHE = { key, packs };
  return packs;
}
const pub = (p) => { const o = Object.assign({}, p); delete o.files; delete o.dir; delete o.builtin; return o; };
const list = () => scan().map(pub);
const getFull = (id) => scan().find((p) => p.id === id) || null;
const get = (id) => { const p = getFull(id); return p ? pub(p) : null; };
const isLang = (id) => typeof id === "string" && !!getFull(id);
const files = (id) => { const p = getFull(id); return p ? Object.assign({}, p.files) : null; };
/** what the page needs (static/helplang.js) */
const client = () => scan().map((p) => ({ id: p.id, name: p.name, native: p.native, browser: p.browser, keepAll: p.keepAll, words: p.words, source: p.source }));

/* ---------------- the English that a pack translates */
function englishUi() {
  const dir = path.join(base(), "static", "i18n", "ui");
  const st = readJson(path.join(dir, "strings.json")) || { strings: [] }, dy = readJson(path.join(dir, "dynamic.json")) || { strings: [], patterns: [] };
  const strings = [...new Set((st.strings || []).map((x) => x.s).concat((dy.strings || []).map((x) => x.s)).filter((s) => typeof s === "string"))];
  return { strings, patterns: (dy.patterns || []).map((x) => x.p).filter((s) => typeof s === "string") };
}
const englishTopics = () => { try { return fs.readdirSync(path.join(base(), "static", "help")).filter((f) => /\.html$/.test(f)).map((f) => f.replace(/\.html$/, "")).sort(); } catch (e) { return []; } };
const siteKeys = () => { const j = readJson(path.join(builtinDir(), "site-keys.json")); return j && Array.isArray(j.keys) ? j.keys.filter((k) => typeof k === "string") : null; };
const bullets = (md) => String(md || "").split("\n");

function coverage(id) {
  const p = getFull(id);
  if (!p) throw bad("no language pack " + id, 404);
  const I = require("./helpI18n");
  const E = englishUi(), ui = readJson(p.files.ui) || {}, S = ui.strings || {}, P = ui.patterns || {};
  const filled = (d, k) => typeof d[k] === "string" && d[k] !== "";
  const R = I.report(base(), id);
  const enF = bullets(readText(path.join(base(), "docs", "FEATURES.md"))), trF = bullets(readText(p.files.features));
  const feat = enF.map((l, i) => [l, trF[i]]).filter(([l]) => /^- \*\*/.test(l));
  const sk = siteKeys(), site = (readJson(p.files.site) || {}).strings || {};
  const pages = Object.values(R.pages);
  return {
    ui: { done: E.strings.filter((k) => filled(S, k)).length, total: E.strings.length },
    patterns: { done: E.patterns.filter((k) => filled(P, k)).length, total: E.patterns.length },
    guide: { done: R.sections.ok, stale: R.sections.stale.length, total: R.sections.ok + R.sections.stale.length + R.sections.missing.length },
    shortcuts: { done: R.shortcuts.ok, stale: R.shortcuts.stale.length, total: R.shortcuts.ok + R.shortcuts.stale.length + R.shortcuts.missing.length },
    help: { done: pages.filter((x) => x === "ok").length, stale: pages.filter((x) => x === "stale").length, total: pages.length },
    features: { done: trF.length === enF.length ? feat.filter(([a, b]) => b && b !== a && /^- \*\*/.test(b)).length : 0, total: feat.length },
    // (a pack without site.json - the built-in ones: the website keeps their words itself - says nothing about the site)
    site: !fs.existsSync(p.files.site) ? { done: 0, total: null } : { done: sk ? sk.filter((k) => filled(site, k)).length : Object.values(site).filter((v) => v).length, total: sk ? sk.length : null },
  };
}

/* ---------------- a ❔ help page from a pack: plain tags only (a pack is someone else's file) */
const OK_TAGS = new Set(["b", "i", "em", "strong", "code", "kbd", "p", "br", "ul", "ol", "li", "h1", "h2", "h3", "h4", "pre", "table", "thead", "tbody", "tr", "td", "th", "span", "div", "small", "sub", "sup", "hr"]);
function sanitizeHelp(html) {
  let s = String(html == null ? "" : html).replace(/\r\n/g, "\n");
  let first = "";
  const nl = s.indexOf("\n"), line0 = nl < 0 ? s : s.slice(0, nl);
  if (/^\s*<!--\s*en:\s*[A-Za-z0-9_-]+\s+[0-9a-f]{12}\s*-->\s*$/.test(line0)) { first = line0.trim() + "\n"; s = nl < 0 ? "" : s.slice(nl + 1); }
  s = s.replace(/<!--[\s\S]*?(-->|$)/g, "")
    .replace(/<(script|style|iframe|object|embed|template|svg|math|textarea|title|noscript)\b[\s\S]*?(<\/\1\s*>|$)/gi, "");
  // tags (a "<" then a letter or "/") are rebuilt from the allowed list or dropped; the text between them is escaped
  return first + s.split(/(<\/?[A-Za-z][^<>]*>?)/).map((tok, i) => {
    if (i % 2 === 0) return tok.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const m = /^<(\/?)([a-zA-Z][a-zA-Z0-9]*)([^>]*?)\/?>$/.exec(tok);
    if (!m || !OK_TAGS.has(m[2].toLowerCase())) return "";
    const name = m[2].toLowerCase();
    if (m[1]) return "</" + name + ">";
    const id = /(?:^|\s)id\s*=\s*"([A-Za-z0-9_-]{1,60})"/.exec(m[3] || "");
    return "<" + name + (id ? ' id="' + id[1] + '"' : "") + ">";
  }).join("");
}

/* ---------------- reading a pack .zip */
const holes = (s) => (String(s).match(/\{\d+\}/g) || []).sort().join(",");
function cleanDict(d, warn, what) {
  const out = {};
  let dropped = 0;
  if (!d || typeof d !== "object" || Array.isArray(d)) return out;
  for (const [k, v] of Object.entries(d)) {
    if (typeof v !== "string" || v === "" || k.length > 4000 || v.length > 8000) continue;
    if (holes(k) !== holes(v)) { dropped++; continue; }
    out[k] = v.replace(/\r\n/g, "\n");
  }
  if (dropped) warn.push(`${what}: ${dropped} translation(s) left out - their {0} {1} … are not the same as the English`);
  return out;
}
const PART_NAMES = new Set(["pack.json", "ui.json", "USAGE.md", "shortcuts.json", "FEATURES.md", "site.json"]);
function check(buf) {
  if (!Buffer.isBuffer(buf) || !buf.length) throw bad("no file - choose the language pack's .zip");
  if (buf.length > MAX_ZIP) throw bad(`the pack is ${(buf.length / 1048576).toFixed(1)} MB - the most is ${MAX_ZIP / 1048576} MB`, 413);
  let ents;
  try { ents = unzip.entries(buf); } catch (e) { throw bad("not a .zip file (" + e.message + ")"); }
  if (ents.length > MAX_FILES) throw bad(`the zip has ${ents.length} files - a language pack has a few dozen at most`);
  const names = ents.map((e) => e.name.replace(/\\/g, "/")).filter((n) => !/(^|\/)(__MACOSX|\.DS_Store|Thumbs\.db)(\/|$)/.test(n));
  // a zip of the folder: everything under one top folder ("ko/pack.json")
  let prefix = "";
  if (!names.includes("pack.json")) {
    const pj = names.filter((n) => /^[^/]+\/pack\.json$/.test(n));
    if (pj.length === 1) prefix = pj[0].slice(0, -"pack.json".length);
    else throw bad("no pack.json in the zip - a language pack has pack.json at its top (see TRANSLATING.txt in the master pack)");
  }
  const warn = [], got = {};
  let total = 0;
  for (const e of ents) {
    const n0 = e.name.replace(/\\/g, "/");
    if (unzip.unsafe(n0)) throw bad("refusing an unsafe path in the zip: " + n0);
    if (!n0.startsWith(prefix) || /(^|\/)(__MACOSX|\.DS_Store|Thumbs\.db)(\/|$)/.test(n0)) continue;
    const n = n0.slice(prefix.length);
    const help = /^help\/([^/]+)\.html$/.exec(n);
    if (!PART_NAMES.has(n) && !(help && TOPIC.test(help[1]))) { if (!/^(TRANSLATING|README)[^/]*$/i.test(n)) warn.push("left out (not part of a language pack): " + n); continue; }
    if (e.usize > MAX_FILE) throw bad(`${n} is too big (${(e.usize / 1048576).toFixed(1)} MB)`);
    total += e.usize;
    if (total > MAX_TOTAL) throw bad("the pack unpacks to more than " + MAX_TOTAL / 1048576 + " MB");
    let data;
    try { data = unzip.read(buf, e, MAX_FILE + 1); } catch (x) { throw bad(`could not read ${n} from the zip (${x.message})`); }
    got[n] = data.toString("utf8").replace(/^﻿/, "");
  }
  let pj;
  try { pj = JSON.parse(got["pack.json"]); } catch (e) { throw bad("pack.json is not valid JSON (" + e.message + ")"); }
  const meta = cleanMeta(pj);
  if (meta.error) throw bad(meta.error);
  if (meta.rtl) warn.push("right-to-left languages are not laid out right to left yet - the words will show, the layout stays left to right");
  const out = { "pack.json": Buffer.from(JSON.stringify(meta, null, 1) + "\n") };
  const json = (n) => { if (got[n] == null) return null; try { return JSON.parse(got[n]); } catch (e) { warn.push(`${n} left out - it is not valid JSON (${e.message})`); return null; } };
  const ui = json("ui.json");
  if (ui) {
    const S = cleanDict(ui.strings, warn, "ui.json strings"), P = cleanDict(ui.patterns, warn, "ui.json patterns");
    const body = { strings: S, patterns: P };
    out["ui.json"] = Buffer.from(JSON.stringify({ lang: meta.id, v: hash12(JSON.stringify(body)), count: Object.keys(S).length, patternCount: Object.keys(P).length, strings: S, patterns: P }));
  }
  const sc = json("shortcuts.json");
  if (sc) {
    const groups = (Array.isArray(sc.groups) ? sc.groups : []).slice(0, 200).map((g) => ({
      en: text(g && g.en, 12), title: text(g && g.title, 200),
      rows: (Array.isArray(g && g.rows) ? g.rows : []).slice(0, 400).map((r) => [text(r && r[0], 120), text(r && r[1], 1000)]),
    }));
    out["shortcuts.json"] = Buffer.from(JSON.stringify({ lang: meta.id, groups }, null, 1));
  }
  const site = json("site.json");
  if (site) out["site.json"] = Buffer.from(JSON.stringify({ lang: meta.id, strings: cleanDict(site.strings, warn, "site.json") }, null, 1));
  for (const n of ["USAGE.md", "FEATURES.md"]) if (got[n] != null) out[n] = Buffer.from(got[n].replace(/\r\n/g, "\n"));
  for (const n of Object.keys(got)) if (n.startsWith("help/")) out[n] = Buffer.from(sanitizeHelp(got[n]));
  if (Object.keys(out).length === 1) warn.push("the pack has only pack.json - nothing is translated yet");
  return { pack: meta, files: out, warnings: warn };
}

function rmrf(p) { try { fs.rmSync(p, { recursive: true, force: true }); } catch (e) { /* gone already */ } }
function install(buf, opts) {
  const r = check(buf), id = r.pack.id;
  const dest = path.join(userDir(), id);
  if (fs.existsSync(dest) && !(opts && opts.replace)) throw bad(`a ${r.pack.native} pack (${id}) is installed already - replace it?`, 409, { exists: true, id, native: r.pack.native });
  fs.mkdirSync(userDir(), { recursive: true });
  const tmp = path.join(userDir(), ".new-" + id + "-" + process.pid + "-" + Date.now());
  for (const [n, data] of Object.entries(r.files)) { const p = path.join(tmp, n); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, data); }
  const old = dest + ".old-" + Date.now();
  if (fs.existsSync(dest)) fs.renameSync(dest, path.join(userDir(), "." + path.basename(old)));
  fs.renameSync(tmp, dest);
  rmrf(path.join(userDir(), "." + path.basename(old)));
  GEN++; CACHE = null;
  return { pack: get(id), warnings: r.warnings, coverage: coverage(id) };
}
function remove(id) {
  const p = getFull(String(id || ""));
  if (!p) throw bad("no language pack " + id, 404);
  if (p.source !== "installed") throw bad(`${p.native} is built in - it cannot be removed`);
  rmrf(p.dir);
  GEN++; CACHE = null;
  return { removed: id, builtin: !!p.builtin };
}

/* ---------------- a pack to translate: the master (all English) or a pack brought up to date with today's English */
function guideFor(enMd, trMd) {
  const I = require("./helpI18n");
  const E = I.rawSections(I.withMarkers(enMd));
  const T = {};
  for (const s of I.rawSections(trMd || "")) {
    const mk = s.raw.split("\n").map(I.parseMarker).find(Boolean);
    if (mk) T[mk.id] = s.raw;
  }
  return E.map((s) => {
    const mk = s.raw.split("\n").map(I.parseMarker).find(Boolean);
    return mk && T[mk.id] != null ? T[mk.id] : s.raw;
  }).join("\n");
}
const TRANSLATING = `bitGen Studio - translating a language pack
============================================

Everything in this folder is in English. Translate what you can - anything you leave as it is (or empty) simply shows
in English, so a pack can be shared half done and finished later.

1. pack.json - the pack's details:
     "id"       your language's code: ko, es, fr, de, pt-BR, zh-Hant ... (not "xx")
     "name"     the language in English (Korean)        "native"  in its own words (한국어)
     "browser"  the system / browser languages that should pick it automatically: ["ko"], or ["pt-br"] ...
     "keepAll"  true for Chinese, Japanese and Korean (short labels then break only where there are spaces)
     "authors"  your name(s)    "version"  1, 2, ... (raise it each time you share an update)
     "words"    the four little notes the guide shows - translate the text after each ":"

2. ui.json - the app's own words. Each line is  "English": "translation" . Fill in the right-hand side; leave "" for
   anything you do not translate. Keep {0} {1} ... (the app puts numbers and names there) and keep symbols like ▸ … :
   "patterns" are sentences the app builds - "installed {0}" -> the {0} goes where it belongs in your language.

3. USAGE.md - the user guide. Translate the text under each "## " heading (the heading too). Keep every line that looks
   like  <!-- en: some-id 1a2b3c4d5e6f -->  exactly where it is: that is how the app knows which English section it is
   (and tells readers when the English is newer than your translation).

4. shortcuts.json - translate each "title" and the second text of every row (what the key does); keep the keys and "en".

5. help/*.html - the ❔ help pages. Translate the words between the tags; keep the tags and the first <!-- en: ... --> line.

6. FEATURES.md - the feature list (the website's Features page). One line per feature: keep the "- **Name** —" shape,
   translate the name and text, and keep *Where:* and *Since:* (translate what follows Where:, keep the version number).

7. site.json - the words of the tigerart.com.au website (optional). Like ui.json; keep any HTML tags and {0}.

To use it: zip the folder (the files at the top of the zip, or in one folder inside it) and in bitGen Studio open
Settings > Languages > Install a pack. The language then appears in the language list next to the docker layout menu.
To share it with everyone: upload it on tigerart.com.au (Language packs) - an admin checks it, then anyone can install it.
To carry on later with a newer bitGen Studio: Settings > Languages > Export for translating - the pack comes back with
the new English parts added, your translations kept.
`;
function buildZip(p, when) {
  const I = require("./helpI18n");
  const B = base(), F = p ? p.files : {};
  const meta = p ? pub(p) : {
    format: FORMAT, id: "xx", name: "Your language (in English)", native: "Your language (in its own words)", region: "", browser: ["xx"],
    keepAll: false, version: "1", authors: ["Your name"],
    words: { stale: "The English of this section is newer - the translation below may be out of date.", missing: "This section is not translated yet - here it is in English.", english: "Show the English", lang: "Language of the guide and help" },
  };
  const ver = (readJson(path.join(B, "package.json")) || {}).version || "";
  const m = Object.assign({}, meta, { app: ver });
  delete m.source; delete m.replaces; delete m.order;
  const E = englishUi(), ui = (p && readJson(F.ui)) || {}, S = ui.strings || {}, P = ui.patterns || {};
  const fill = (keys, d) => { const o = {}; for (const k of keys) o[k] = typeof d[k] === "string" ? d[k] : ""; return o; };
  const entries = [
    { name: "pack.json", data: JSON.stringify(m, null, 1) + "\n" },
    { name: "TRANSLATING.txt", data: TRANSLATING },
    { name: "ui.json", data: JSON.stringify({ strings: fill(E.strings, S), patterns: fill(E.patterns, P) }, null, 1), deflate: true },
  ];
  const enMd = readText(path.join(B, "docs", "USAGE.md")) || "";
  entries.push({ name: "USAGE.md", data: guideFor(enMd, p ? readText(F.usage) : ""), deflate: true });
  const enSc = readJson(path.join(B, "docs", "shortcuts.json")) || { groups: [] }, trSc = (p && readJson(F.shortcuts)) || { groups: [] };
  entries.push({ name: "shortcuts.json", deflate: true, data: JSON.stringify({ lang: m.id, groups: (enSc.groups || []).map((g, i) => {
    const t = (trSc.groups || [])[i];
    if (t && Array.isArray(t.rows) && t.rows.length === (g.rows || []).length) return { en: t.en, title: t.title, rows: g.rows.map((r, j) => [r[0], String((t.rows[j] || [])[1] || r[1])]) };
    return { en: I.groupHash(g), title: g.title, rows: g.rows };
  }) }, null, 1) });
  const enF = readText(path.join(B, "docs", "FEATURES.md")) || "", trF = p ? readText(F.features) : null;
  entries.push({ name: "FEATURES.md", data: trF && bullets(trF).length === bullets(enF).length ? trF : enF, deflate: true });
  for (const t of englishTopics()) {
    const en = readText(path.join(B, "static", "help", t + ".html")) || "", tr = p ? readText(path.join(F.help, t + ".html")) : null;
    entries.push({ name: "help/" + t + ".html", data: tr != null ? tr : "<!-- en: " + t + " " + I.hash(en) + " -->\n" + en, deflate: true });
  }
  const sk = siteKeys();
  if (sk) entries.push({ name: "site.json", data: JSON.stringify({ strings: fill(sk, ((p && readJson(F.site)) || {}).strings || {}) }, null, 1), deflate: true });
  return zipWrite.zip(entries, when);
}
function shareZip(id) {
  const p = getFull(id);
  if (!p) throw bad("no language pack " + id, 404);
  if (p.source !== "installed") return buildZip(p);
  const out = [];
  const walk = (dir, rel) => {
    for (const f of fs.readdirSync(dir).sort()) {
      const abs = path.join(dir, f), r = rel ? rel + "/" + f : f;
      if (fs.statSync(abs).isDirectory()) walk(abs, r);
      else out.push({ name: r, data: fs.readFileSync(abs), deflate: true });
    }
  };
  walk(p.dir, "");
  return zipWrite.zip(out);
}
function exportZip(id) { const p = getFull(id); if (!p) throw bad("no language pack " + id, 404); return buildZip(p); }
const masterZip = (when) => buildZip(null, when);          // when: the files' date (the website's copy: a fixed one, so it only changes with the English)

module.exports = { FORMAT, LAYOUT, MAX_ZIP, setBase, baseDir, cleanMeta, list, get, isLang, files, client, englishUi, englishTopics, coverage, sanitizeHelp, check, install, remove, shareZip, exportZip, masterZip };
