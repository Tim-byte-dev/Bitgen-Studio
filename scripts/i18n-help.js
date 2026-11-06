#!/usr/bin/env node
/* bitGen Studio — scripts/i18n-help.js (2.703.0): THE GUIDE + HELP TRANSLATIONS - prepare English for translating, put the
 * translations together, check them, and say what is out of date. The files and their markers: lib/helpI18n.js.
 *
 *   node scripts/i18n-help.js status   <lang>                          what is translated / stale / missing
 *   node scripts/i18n-help.js prep     <lang> <dir> [--size N] [--all]  English pieces to translate into <dir>:
 *        guide-NN.en.md (whole "## " sections with their marker lines, about N bytes each - default 40000),
 *        help-<topic>.en.html (marker + the page), shortcuts.en.json; without --all only what is stale or missing
 *   node scripts/i18n-help.js assemble <lang> <dir>                    the translated pieces into the app:
 *        guide-NN.<lang>[.partK].md -> docs/i18n/<lang>/USAGE.md (merged by section with what is there, English order)
 *        help-<topic>.<lang>.html -> static/help/<lang>/<topic>.html, shortcuts.<lang>.json -> docs/i18n/<lang>/shortcuts.json
 *   node scripts/i18n-help.js check    <lang> [--strict]               the structure kept (markers, code, links, pictures,
 *        tables, the help pages' tags + ids, the shortcut keys) and the text really translated; exit 1 on a problem
 * <lang>: zh-CN | ja.  Tim: "is it possible to translate help and the user guide into chinese and japanese as additional help
 * files?" (refreshed when he asks: `status`, then `prep` without --all gives only what changed in English).
 */
"use strict";
const fs = require("fs");
const path = require("path");
const I = require("../lib/helpI18n");
const HD = require("../lib/helpDocs");
const ROOT = path.join(__dirname, "..");
const P = {
  en: path.join(ROOT, "docs", "USAGE.md"), sc: path.join(ROOT, "docs", "shortcuts.json"), help: path.join(ROOT, "static", "help"),
  tr: (l) => path.join(ROOT, "docs", "i18n", l, "USAGE.md"), tsc: (l) => path.join(ROOT, "docs", "i18n", l, "shortcuts.json"),
  thelp: (l, t) => path.join(ROOT, "static", "help", l, t + ".html"),
};
const read = (p) => { try { return fs.readFileSync(p, "utf8"); } catch (e) { return null; } };
const write = (p, s) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, s); };
const topics = () => fs.readdirSync(P.help).filter((f) => /\.html$/.test(f)).map((f) => f.replace(/\.html$/, "")).sort();

/** a line broken between two CJK characters becomes one line (the app and the PDF join lines with a space - in Chinese /
 * Japanese that is a stray space mid-sentence); list items, headings, tables, code, markers and pictures are left alone */
const CJKC = "[\\u3040-\\u30ff\\u4e00-\\u9fff\\uff01-\\uff60\\u3001-\\u3002\\u300c-\\u300f]";
const CJK_END = new RegExp(CJKC + "\\s*$"), CJK_START = new RegExp("^\\s*" + CJKC), BLOCK = /^\s*([-*]|\d+\.|#|\||```|<!--|!\[)/;
function joinCjk(md) {
  const out = []; let fence = false;
  for (const line of String(md).split("\n")) {
    if (/^\s*```/.test(line)) { fence = !fence; out.push(line); continue; }
    const prev = out[out.length - 1];
    if (!fence && prev != null && line.trim() && prev.trim() && !BLOCK.test(line) && !/^\s*(```|\||<!--)/.test(prev) && CJK_END.test(prev) && CJK_START.test(line)) out[out.length - 1] = prev.replace(/\s+$/, "") + line.trim();
    else out.push(line);
  }
  return out.join("\n");
}
/** a translated guide's raw text -> {id: raw} by its marker lines */
function splitTranslated(md) {
  const out = {};
  for (const s of I.rawSections(md || "")) {
    const mk = s.raw.split("\n").map(I.parseMarker).find(Boolean);
    if (mk) out[mk.id] = s.raw.replace(/\s+$/, "");
  }
  return out;
}
function prep(lang, dir, o) {
  const md = read(P.en), R = I.rawSections(I.withMarkers(md)), rep = o.all ? null : I.report(ROOT, lang);
  const want = (id) => !rep || (id === "_top" ? rep.top !== "ok" : rep.sections.stale.includes(id) || rep.sections.missing.includes(id));
  fs.mkdirSync(dir, { recursive: true });
  const pieces = []; let cur = [], size = 0;
  for (const s of R) {
    if (!want(s.id)) continue;
    if (size && size + s.raw.length > o.size) { pieces.push(cur); cur = []; size = 0; }
    cur.push(s.raw.replace(/\s+$/, "")); size += s.raw.length;
  }
  if (cur.length) pieces.push(cur);
  pieces.forEach((p, i) => write(path.join(dir, `guide-${String(i + 1).padStart(2, "0")}.en.md`), p.join("\n\n") + "\n"));
  let hp = 0;
  for (const t of topics()) {
    if (rep && rep.pages[t] === "ok") continue;
    const en = read(path.join(P.help, t + ".html"));
    write(path.join(dir, `help-${t}.en.html`), `<!-- en: ${t} ${I.hash(en)} -->\n` + en); hp++;
  }
  let scN = 0;
  if (!rep || rep.shortcuts.stale.length || rep.shortcuts.missing.length) {
    const sc = JSON.parse(read(P.sc));
    write(path.join(dir, "shortcuts.en.json"), JSON.stringify({ lang, groups: sc.groups.map((g) => ({ en: I.groupHash(g), title: g.title, rows: g.rows })) }, null, 2) + "\n"); scN = 1;
  }
  console.log(`prep ${lang}: ${pieces.length} guide pieces (${pieces.reduce((n, p) => n + p.length, 0)} sections), ${hp} help pages, ${scN ? "the shortcuts" : "no shortcuts"} -> ${dir}`);
}
function assemble(lang, dir) {
  const files = fs.readdirSync(dir);
  const guide = files.filter((f) => new RegExp(`^guide-\\d+\\.${lang.replace(/[-]/g, "\\-")}(\\.part\\d+)?\\.md$`).test(f))
    .sort((a, b) => { const k = (f) => { const m = /^guide-(\d+)\.[^.]+(?:\.part(\d+))?\.md$/.exec(f); return +m[1] * 1000 + (+(m[2] || 0)); }; return k(a) - k(b); });
  let n = 0;
  if (guide.length) {
    const have = splitTranslated(read(P.tr(lang)) || ""), add = splitTranslated(guide.map((f) => read(path.join(dir, f))).join("\n\n"));
    Object.assign(have, add); n = Object.keys(add).length;
    const order = I.rawSections(read(P.en)).map((s) => s.id);
    write(P.tr(lang), joinCjk(order.filter((id) => have[id]).map((id) => have[id]).join("\n\n")) + "\n");
  }
  let hp = 0;
  const L = lang.replace(/[-]/g, "\\-"), num = (f) => +((/\.part(\d+)\./.exec(f) || [0, 0])[1]);
  const pages = {};                                  // help-<topic>.<lang>.html, or its pieces help-<topic>.<lang>.partK.html
  for (const f of files) { const m = new RegExp(`^help-([a-z0-9_-]+)\\.${L}(?:\\.part\\d+)?\\.html$`, "i").exec(f); if (m) (pages[m[1]] = pages[m[1]] || []).push(f); }
  for (const t of Object.keys(pages)) { const fs_ = pages[t].sort((a, b) => num(a) - num(b)); write(P.thelp(lang, t), fs_.map((f) => read(path.join(dir, f)).replace(/\s+$/, "")).join("\n") + "\n"); hp++; }
  let sc = files.includes(`shortcuts.${lang}.json`) ? read(path.join(dir, `shortcuts.${lang}.json`)) : null;
  const scParts = files.filter((f) => new RegExp(`^shortcuts\\.${L}\\.part\\d+\\.txt$`).test(f)).sort((a, b) => num(a) - num(b));
  if (!sc && scParts.length) sc = scParts.map((f) => read(path.join(dir, f))).join("");
  if (sc) { const j = JSON.parse(sc); j.lang = lang; write(P.tsc(lang), JSON.stringify(j, null, 2) + "\n"); }
  console.log(`assemble ${lang}: ${n} guide sections, ${hp} help pages${sc ? ", the shortcuts" : ""}`);
}
/* ---------------- check */
const CJK = /[぀-ヿ㐀-鿿＀-￯]/g;
const fences = (s) => (s.match(/^\s*```[\w-]*\s*$/gm) || []).length;          // a fence line (not prose that wraps onto ```)
const codes = (s) => (s.replace(/```[\s\S]*?```/g, "").match(/`[^`\n]+`/g) || []).sort();
const links = (s) => (s.match(/\]\(([^)\s]+)\)/g) || []).sort();
const pics = (s) => (s.match(/^!\[[^\]]*\]\([^)]*\)\s*$/gm) || []).length;
const tableRows = (s) => (s.match(/^\s*\|.*\|\s*$/gm) || []).length;
const headings = (s) => (s.match(/^#{1,6}\s/gm) || []).length;
const prose = (s) => s.replace(/```[\s\S]*?```/g, "").replace(/`[^`\n]+`/g, "").replace(/<!--[\s\S]*?-->/g, "").replace(/\]\([^)]*\)/g, "]").replace(/https?:\S+/g, "");
const kana = /[぀-ヿ]/;
function checkText(id, en, tr, lang, probs, strict) {
  const p = (w) => probs.push(`${id}: ${w}`);
  if (fences(en) !== fences(tr)) p(`code blocks ${fences(en)} -> ${fences(tr)}`);
  const ce = codes(en), ct = codes(tr);
  const lostCode = ce.filter((c) => !ct.includes(c));
  if (lostCode.length > (strict ? 0 : Math.max(1, ce.length * 0.1))) p(`inline code changed: ${lostCode.slice(0, 4).join(" ")}`);
  const le = links(en), lt = links(tr), lostLink = le.filter((l) => !lt.includes(l));
  if (lostLink.length) p(`links changed: ${lostLink.slice(0, 3).join(" ")}`);
  if (pics(en) !== pics(tr)) p(`pictures ${pics(en)} -> ${pics(tr)}`);
  if (tableRows(en) !== tableRows(tr)) p(`table rows ${tableRows(en)} -> ${tableRows(tr)}`);
  if (headings(en) !== headings(tr)) p(`headings ${headings(en)} -> ${headings(tr)}`);
  const pe = prose(en), pt = prose(tr), letters = (pe.match(/[A-Za-z]/g) || []).length, cjk = (pt.match(CJK) || []).length;
  if (letters > 120 && cjk < letters / 40) p(`looks untranslated (${cjk} CJK characters for ${letters} English letters)`);
  if (lang === "ja" && letters > 120 && !kana.test(pt)) p("no kana - is it Japanese?");
  if (lang === "zh-CN" && (pt.match(/[぀-ヿ]/g) || []).length > 3) p("kana in the Chinese text");
  if (joinCjk(tr) !== tr) p("a line broken between two CJK characters (a stray space when shown) - assemble joins them");
  if (lang === "zh-CN" && /[們這說個為與實開關體點邊際層畫題據]/.test(pt)) p("Traditional characters in the Simplified text");
}
const tagSeq = (h) => (h.replace(/<!--[\s\S]*?-->/g, "").match(/<\/?[a-z][a-z0-9]*/gi) || []).map((t) => t.toLowerCase()).join(" ");
const idsOf = (h) => (h.match(/\sid="[^"]*"/g) || []).sort().join(" ");
function check(lang, strict) {
  const probs = [], enMd = read(P.en), trMd = read(P.tr(lang));
  if (trMd == null) probs.push("no docs/i18n/" + lang + "/USAGE.md");
  else {
    const ER = I.rawSections(enMd), T = splitTranslated(trMd), H = I.enHashes(enMd);
    const order = trMd.split("\n").map(I.parseMarker).filter(Boolean).map((m) => m.id);
    const dup = order.filter((id, i) => order.indexOf(id) !== i); if (dup.length) probs.push("markers twice: " + dup.join(" "));
    const known = new Set(ER.map((s) => s.id)), unknown = order.filter((id) => !known.has(id)); if (unknown.length) probs.push("markers of no English section: " + unknown.join(" "));
    const pos = ER.map((s) => order.indexOf(s.id)).filter((i) => i >= 0); if (pos.some((v, i) => i && v < pos[i - 1])) probs.push("sections out of the English order");
    for (const s of ER) {
      const t = T[s.id]; if (!t) continue;
      const mk = t.split("\n").map(I.parseMarker).find(Boolean);
      if (mk.hash !== H[s.id]) continue;                                   // stale: checked when it is translated again
      if (s.id !== "_top" && !/^##\s/.test(t)) probs.push(`${s.id}: does not start with its "## " heading`);
      checkText(s.id, s.raw, t, lang, probs, strict);
    }
  }
  for (const t of topics()) {
    const tr = read(P.thelp(lang, t)); if (tr == null) { probs.push(`help ${t}: missing`); continue; }
    const en = read(path.join(P.help, t + ".html")), body = tr.split("\n").slice(1).join("\n");
    if (!I.parseMarker(tr.split("\n")[0])) probs.push(`help ${t}: no marker on the first line`);
    if (tagSeq(en) !== tagSeq(body)) probs.push(`help ${t}: the tags changed`);
    if (idsOf(en) !== idsOf(body)) probs.push(`help ${t}: the ids changed`);
    const txt = (h) => h.replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, "").replace(/<[^>]+>/g, " ");
    const letters = (txt(en).match(/[A-Za-z]/g) || []).length, cjk = (txt(body).match(CJK) || []).length;
    if (cjk < letters / 40) probs.push(`help ${t}: looks untranslated`);
  }
  const sc = (() => { try { return JSON.parse(read(P.tsc(lang))); } catch (e) { return null; } })(), esc = JSON.parse(read(P.sc));
  if (!sc) probs.push("no docs/i18n/" + lang + "/shortcuts.json");
  else esc.groups.forEach((g, i) => {
    const t = sc.groups[i]; if (!t) { probs.push(`shortcuts group ${i}: missing`); return; }
    if (t.rows.length !== g.rows.length) probs.push(`shortcuts group ${i}: rows ${g.rows.length} -> ${t.rows.length}`);
    else if (t.rows.some((r, j) => r[0] !== g.rows[j][0])) probs.push(`shortcuts group ${i}: a key changed`);
  });
  return probs;
}
/* ---------------- main */
if (require.main === module) {
  const a = process.argv.slice(2), cmd = a[0], lang = a[1];
  const opt = (k, d) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : d; };
  if (!cmd || !I.isLang(lang)) { console.log("usage: node scripts/i18n-help.js status|prep|assemble|check <" + I.LANGS.map((l) => l.id).join("|") + "> …"); process.exit(2); }
  if (cmd === "status") console.log(JSON.stringify(I.report(ROOT, lang), null, 1));
  else if (cmd === "prep") prep(lang, a[2], { size: +opt("--size", 40000), all: a.includes("--all") });
  else if (cmd === "assemble") assemble(lang, a[2]);
  else if (cmd === "check") { const pr = check(lang, a.includes("--strict")); pr.forEach((x) => console.log("PROBLEM: " + x)); console.log(`check ${lang}: ${pr.length} problems`); process.exit(pr.length ? 1 : 0); }
  else { console.log("unknown command " + cmd); process.exit(2); }
}
module.exports = { splitTranslated, checkText, check, tagSeq, joinCjk };
