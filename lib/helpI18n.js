/* bitGen Studio — lib/helpI18n.js (2.703.0): THE GUIDE AND HELP IN OTHER LANGUAGES - Simplified Chinese (zh-CN, mainland China)
 * and Japanese (ja), as extra help files beside the English ones.
 *
 * Tim (verbatim): "is it possible to translate help and the user guide into chinese and japanese as additional help files?"
 * - then: instructions translated, Simplified Chinese for mainland China ("sorry it should be simplified chinese for mainland
 * china"), PDFs too, translations refreshed when he asks (a section newer in English says so).
 *
 * The files (English stays the source; the app's buttons and menus stay English, so the translations name them in English):
 *   docs/i18n/<lang>/USAGE.md        the guide - after every "## " heading a marker line  <!-- en: <id> <hash> -->
 *                                    (and one after the "# " title for the part before the first section: id _top)
 *   docs/i18n/<lang>/shortcuts.json  {lang, groups: [{en: <hash>, title, rows: [[key, what]]}]} - the English groups' order
 *   static/help/<lang>/<topic>.html  a ❔ help page - its first line  <!-- en: <topic> <hash> -->
 * <id> is the English section's id (lib/helpDocs.js slug), <hash> the first 12 hex of the SHA-256 of the English text it was
 * translated from - when English changes, the hash no longer matches and the section is "stale" (shown with a note + the
 * English one a click away). scripts/i18n-help.js prepares English for translating, puts translations together and checks them.
 *
 *   LANGS                          [{id, name, native}]
 *   hash(text)                     12 hex
 *   rawSections(md)                [{id, title, raw}] the English guide by "## " (id _top = before the first one), raw text
 *   enHashes(md)                   {id: hash} of what each section is translated from (_top: its raw text, else helpDocs md)
 *   withMarkers(md)                the English guide with the marker lines in (what a translator is given)
 *   parseMarker(line)              {id, hash} | null
 *   load(base, lang)               like helpDocs.load + {lang, stale: n, missing: n}; each section {id, title, md, text,
 *                                  lang, stale, enTitle}; a section not translated = the English one (lang "en")
 *   page(base, topic, lang)        {html, lang, stale} - the translated ❔ page, else the English one
 *   report(base, lang)             {sections: {ok, stale: [ids], missing: [ids]}, shortcuts: {...}, pages: {...}}
 *   uiDict(base, lang) / uiNames(md, dict) / uiNamesHtml(html, dict)   2.705.0 (Tim: the UI translated - "translate and update
 *                                  guides"): a name in bold (**X** / <b>X</b>) that the app's UI dictionary translates
 *                                  (static/i18n/ui/<lang>.json, the same lookup as static/uilang.js) is shown as the app shows
 *                                  it - and the old gloss after it, （…）, goes. Applied by load() / page() at read time, so the
 *                                  files keep the English names and a later UI dictionary change shows at once.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const HD = require("./helpDocs");
const UI = require("../static/uilang.js");          // 2.705.0: the UI translation's own lookup (split / tr)

// 2.715.0: the languages are LANGUAGE PACKS (lib/langPacks.js) - built in (docs/i18n/<id>/pack.json) or installed
// (Settings ▸ Languages); each pack says where its files are. LANGS is read from there each time.
const LP = require("./langPacks");
const langs = () => LP.list().map((p) => ({ id: p.id, name: p.name, native: p.native }));
const isLang = (l) => LP.isLang(l);
/** a language's files: the pack's (when base is the install the packs belong to), else the old layout under base */
function fileOf(base, lang, part) {
  if (path.resolve(base) === path.resolve(LP.baseDir())) { const f = LP.files(lang); if (f) return f[part]; }
  return { ui: path.join(base, "static", "i18n", "ui", lang + ".json"), usage: path.join(base, "docs", "i18n", lang, "USAGE.md"),
    shortcuts: path.join(base, "docs", "i18n", lang, "shortcuts.json"), help: path.join(base, "static", "help", lang) }[part];
}
// 2.715.0: a part still word for word the English (a master pack not translated there yet) counts as not translated
const flat = (x) => String(x || "").replace(/&gt;/g, ">").replace(/&lt;/g, "<").replace(/\s+/g, " ").trim();   // (a pack's help page is sanitised)
const same = (a, b) => flat(a) === flat(b);
const hash = (t) => crypto.createHash("sha256").update(String(t == null ? "" : t).replace(/\r\n/g, "\n"), "utf8").digest("hex").slice(0, 12);
const MARK = /^\s*<!--\s*en:\s*([A-Za-z0-9_-]+)\s+([0-9a-f]{12})\s*-->\s*$/;
const parseMarker = (line) => { const m = MARK.exec(String(line || "")); return m ? { id: m[1], hash: m[2] } : null; };

/** the guide by "## " headings, the raw lines kept (pictures too) - ids as lib/helpDocs.js gives them */
function rawSections(md) {
  const lines = String(md || "").replace(/\r\n/g, "\n").split("\n");
  const out = [{ id: "_top", title: "", raw: [] }], seen = {};
  for (const line of lines) {
    const m = /^##\s+(.+?)\s*$/.exec(line);
    if (m && !/^###/.test(line)) {
      let id = HD.slug(m[1]); if (seen[id]) id += "-" + (++seen[id]); else seen[id] = 1;
      out.push({ id, title: m[1].replace(/[*`]/g, ""), raw: [line] });
      continue;
    }
    out[out.length - 1].raw.push(line);
  }
  return out.map((s) => ({ id: s.id, title: s.title, raw: s.raw.join("\n") }));
}
/** what each section's hash is taken from: _top its raw text; a section its helpDocs md (pictures left out) */
function enHashes(md) {
  const h = { _top: hash(rawSections(md)[0].raw.trim()) };
  for (const s of HD.sections(md)) h[s.id] = hash(s.title + "\n" + s.md);
  return h;
}
/** the English guide with a marker line after each heading (the "# " title for _top) */
function withMarkers(md) {
  const H = enHashes(md), R = rawSections(md);
  return R.map((s) => {
    const lines = s.raw.split("\n");
    if (s.id === "_top") {
      const t = lines.findIndex((l) => /^#\s/.test(l));
      lines.splice(t >= 0 ? t + 1 : 0, 0, `<!-- en: _top ${H._top} -->`);
    } else lines.splice(1, 0, `<!-- en: ${s.id} ${H[s.id]} -->`);
    return lines.join("\n");
  }).join("\n");
}
const read = (p) => { try { return fs.readFileSync(p, "utf8"); } catch (e) { return null; } };
const mtime = (p) => { try { return fs.statSync(p).mtimeMs; } catch (e) { return 0; } };

/* ---------------- 2.705.0: the guides name the buttons as the translated UI shows them */
const UIC = {};
function uiDict(base, lang) {
  const p = fileOf(base, lang, "ui"), m = p ? mtime(p) : 0;
  if (!m) return null;
  if (UIC[lang] && UIC[lang].m === m && UIC[lang].p === p) return UIC[lang].d;
  let d = null; try { d = JSON.parse(read(p)).strings || null; } catch (e) { d = null; }
  if (d) for (const k of Object.keys(d)) if (d[k] === "") delete d[k];                 // "" = not translated (a pack's)
  UIC[lang] = { m, p, d }; return d;
}
// 2.707.0 (Tim: "ok, i guess we can do the dockers next"): the editors' dockers are translated too, so every section and
// ❔ page names the buttons as the app shows them. (2.705.0 kept them out while their UI was still English.) Kept, empty, for
// a docker whose UI is not translated yet: a section whose English title matches EDITORS keeps its glosses.
const EDITORS = /(?!)/;
const UI_EDITOR_PAGES = [];
const GLOSS = "(?:（[^）\\n]{1,40}）)?";
// a name as the app shows it: the dictionary's word, or a menu path whose every part is one ("View ▸ Dockers", 2.707.0)
function trName(x, dict) {
  const t = UI.tr(x, dict); if (t) return t;
  if (!/▸/.test(x)) return null;
  const parts = x.split(/(\s*▸\s*)/), out = [];
  for (let i = 0; i < parts.length; i++) { if (i % 2) { out.push(parts[i]); continue; } const u = UI.tr(parts[i], dict); if (!u) return null; out.push(u); }
  return out.join("");
}
function uiNames(md, dict) {
  if (!dict) return md;
  return String(md).replace(new RegExp("\\*\\*([^*\\n]{1,80}?)\\*\\*" + GLOSS, "g"), (all, x) => { const t = trName(x, dict); return t ? "**" + t + "**" : all; });
}
function uiNamesHtml(html, dict) {
  if (!dict) return html;
  return String(html).replace(new RegExp("<b>([^<\\n]{1,80})</b>" + GLOSS, "g"), (all, x) => { const t = trName(x, dict); return t ? "<b>" + t + "</b>" : all; });
}
/** a translated guide -> {id: {title, md}} by its markers */
function translatedSections(md) {
  const out = {};
  for (const s of HD.sections(md)) {
    const lines = s.md.split("\n"), i = lines.findIndex((l) => parseMarker(l));
    if (i < 0) continue;
    const mk = parseMarker(lines[i]); lines.splice(i, 1);
    const body = lines.join("\n").trim();
    out[mk.id] = { title: s.title, md: body, text: HD.plain(body).slice(0, 6000), hash: mk.hash };
  }
  return out;
}
function translatedShortcuts(sc) { return (sc && Array.isArray(sc.groups)) ? sc.groups : []; }
const groupHash = (g) => hash(JSON.stringify({ title: String(g.title || ""), rows: (g.rows || []).map((r) => [String(r[0]), String(r[1])]) }));

let CACHE = {};
function load(base, lang) {
  const en = HD.load(base);
  if (!isLang(lang)) return Object.assign({ lang: "en", stale: 0, missing: 0 }, en);
  const u = path.join(base, "docs", "USAGE.md"), tu = fileOf(base, lang, "usage");
  const k = path.join(base, "docs", "shortcuts.json"), tk = fileOf(base, lang, "shortcuts");
  const key = [u, tu, k, tk, fileOf(base, lang, "ui")].map(mtime).join(":") + ":" + [tu, tk].join("|");
  if (CACHE[lang] && CACHE[lang].key === key) return CACHE[lang].val;
  const enMd = read(u) || "", H = enHashes(enMd), T = translatedSections(read(tu) || ""), UD = uiDict(base, lang);
  let stale = 0, missing = 0;
  const sections = en.sections.map((s) => {
    const t = T[s.id] && !same(T[s.id].md, s.md) ? T[s.id] : null;
    if (!t) { missing++; return Object.assign({}, s, { lang: "en", stale: false, enTitle: s.title }); }
    const st = t.hash !== H[s.id]; if (st) stale++;
    const md = UD && !EDITORS.test(s.title) ? uiNames(t.md, UD) : t.md;            // 2.705.0: the buttons as the translated UI names them
    return { id: s.id, title: t.title, md, text: (HD.plain(md).slice(0, 6000) + " " + s.title).slice(0, 6200), lang, stale: st, enTitle: s.title };
  });
  let tsc = null; try { tsc = JSON.parse(read(tk) || "null"); } catch (e) { tsc = null; }
  const TG = translatedShortcuts(tsc);
  const groups = en.shortcuts.groups.map((g, i) => {
    const t = TG[i];
    if (!t || !Array.isArray(t.rows) || t.rows.length !== g.rows.length || (same(t.title, g.title) && t.rows.every((r, j) => same((r || [])[1], g.rows[j][1])))) { missing++; return Object.assign({}, g, { lang: "en", stale: false }); }
    const st = t.en !== groupHash(g); if (st) stale++;
    return { title: String(t.title || g.title), rows: g.rows.map((r, j) => [r[0], String((t.rows[j] || [])[1] || r[1])]), lang, stale: st, enTitle: g.title };
  });
  const val = { lang, stale, missing, sections, shortcuts: { groups } };
  CACHE[lang] = { key, val };
  return val;
}
const topicOk = (t) => /^[a-z0-9_-]{1,40}$/i.test(String(t || ""));
/** a ❔ help page in a language: {html, lang, stale} (the English page when there is no translation) */
function page(base, topic, lang) {
  if (!topicOk(topic)) return null;
  const enP = path.join(base, "static", "help", topic + ".html"), en = read(enP);
  if (en == null) return null;
  if (isLang(lang)) {
    const t = read(path.join(fileOf(base, lang, "help"), topic + ".html"));
    const first = t != null ? t.split("\n")[0] : "", mk = parseMarker(first);
    const body = t == null ? null : mk ? t.split("\n").slice(1).join("\n") : t;
    if (body != null && !same(body, en)) {
      return { html: UI_EDITOR_PAGES.includes(topic) ? body : uiNamesHtml(body, uiDict(base, lang)), lang, stale: !mk || mk.hash !== hash(en) };
    }
  }
  return { html: en, lang: "en", stale: false };
}
/** what is translated, out of date or missing (scripts/i18n-help.js status) */
function report(base, lang) {
  const L = load(base, lang);
  const sec = { ok: 0, stale: [], missing: [] };
  for (const s of L.sections) { if (s.lang === "en") sec.missing.push(s.id); else if (s.stale) sec.stale.push(s.id); else sec.ok++; }
  const enMd = read(path.join(base, "docs", "USAGE.md")) || "", tmd = read(fileOf(base, lang, "usage") || "") || "";
  const topLine = tmd.split("\n").map(parseMarker).find((m) => m && m.id === "_top");
  const top = !topLine ? "missing" : topLine.hash === enHashes(enMd)._top ? "ok" : "stale";
  const sc = { ok: 0, stale: [], missing: [] };
  L.shortcuts.groups.forEach((g, i) => { if (g.lang === "en") sc.missing.push(i); else if (g.stale) sc.stale.push(i); else sc.ok++; });
  const pages = {};
  let topics = []; try { topics = fs.readdirSync(path.join(base, "static", "help")).filter((f) => /\.html$/.test(f)).map((f) => f.replace(/\.html$/, "")); } catch (e) { topics = []; }
  for (const t of topics) { const p = page(base, t, lang); pages[t] = p.lang === "en" ? "missing" : p.stale ? "stale" : "ok"; }
  return { lang, top, sections: sec, shortcuts: sc, pages };
}
module.exports = { get LANGS() { return langs(); }, fileOf, EDITORS, uiDict, uiNames, uiNamesHtml, isLang, hash, parseMarker, rawSections, enHashes, withMarkers, translatedSections, groupHash, load, page, report };
