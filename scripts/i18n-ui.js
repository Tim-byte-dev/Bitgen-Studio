#!/usr/bin/env node
/* bitGen Studio — scripts/i18n-ui.js (2.705.0): THE UI DICTIONARIES (static/i18n/ui/<lang>.json, read by static/uilang.js).
 *
 *   node scripts/i18n-ui.js build  <lang> <dir>   the translators' <dir>/chunk*.<lang>[.partX].json merged into the dictionary
 *                                                 (kept: what is there; added / replaced: theirs), keys = the English strings
 *   node scripts/i18n-ui.js status <lang>         how many of static/i18n/ui/strings.json it has (the rest shows English)
 *   node scripts/i18n-ui.js check  <lang>         every key a collected string, placeholders kept (<x>, {x}, %s, [..], ▸ count),
 *                                                 the right script (no kana in Chinese, no Simplified in zh-TW), no empty value
 * strings.json is made by scripts/ui-strings.js (the running app, English). zh-TW is made from zh-CN:
 * python3 scripts/i18n-zhtw.py --ui. Tim: "is it possible to add a language dropdown to the left of docker layout and change
 * the language of the ui on change?"
 */
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const ROOT = path.join(__dirname, "..");
const DIR = path.join(ROOT, "static", "i18n", "ui");
const LANGS = ["zh-CN", "zh-TW", "ja"];
const read = (p) => { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch (e) { return null; } };
// 2.706.0: + the words the app builds (static/i18n/ui/dynamic.json - scripts/ui-dynamic.js): strings, and patterns with {n}
const dyn = () => read(path.join(DIR, "dynamic.json")) || { strings: [], patterns: [] };
const strings = () => [...new Set((read(path.join(DIR, "strings.json")) || { strings: [] }).strings.map((x) => x.s).concat(dyn().strings.map((x) => x.s)))];
const patterns = () => dyn().patterns.map((x) => x.p);
const fileOf = (lang) => read(path.join(DIR, lang + ".json")) || { strings: {}, patterns: {} };
const dictOf = (lang) => fileOf(lang).strings;
const patsOf = (lang) => fileOf(lang).patterns || {};
function save(lang, d, pats) {
  const S = new Set(strings()), PS = new Set(patterns());   // only what the app has now (a word gone from the app goes from here)
  if (pats == null) pats = patsOf(lang);
  const sorted = {}; Object.keys(d).sort().forEach((k) => { if (!S.size || S.has(k)) sorted[k] = d[k]; });
  const sp = {}; Object.keys(pats).sort().forEach((k) => { if (PS.has(k)) sp[k] = pats[k]; });
  const v = crypto.createHash("sha256").update(JSON.stringify([sorted, sp])).digest("hex").slice(0, 12);
  fs.writeFileSync(path.join(DIR, lang + ".json"), JSON.stringify({ lang, v, count: Object.keys(sorted).length, patternCount: Object.keys(sp).length, strings: sorted, patterns: sp }, null, 1) + "\n");
  return v;
}
const PH = (s) => [...String(s).matchAll(/<[^<>\s]{1,30}>|\{[^{}]{1,20}\}|%[sd]|\[[^\]\s]{1,12}\]/g)].map((m) => m[0]).sort().join(" ");
const ARTICLE = /^(the|a|an)$/i;          // a bare article may translate to nothing (Japanese / Chinese have none)
const ARROWS = (s) => (String(s).match(/▸/g) || []).length;
const HOLES = (s) => (String(s).match(/\{\d+\}/g) || []).sort().join(" ");
function check(lang) {
  const d = dictOf(lang), S = new Set(strings()), probs = [], pats = patsOf(lang), PS = new Set(patterns());
  for (const [k, v] of Object.entries(pats)) {
    if (!PS.has(k)) probs.push(`not a pattern the code makes: ${k.slice(0, 60)}`);
    if (typeof v !== "string" || !v.trim()) probs.push(`empty pattern: ${k.slice(0, 60)}`);
    else if (HOLES(k) !== HOLES(v)) probs.push(`pattern's {n} changed: ${k.slice(0, 50)} -> ${v.slice(0, 50)}`);
    else if (/^zh/.test(lang) && (v.match(/[\u3040-\u30ff]/g) || []).length > 2) probs.push(`kana in Chinese: ${v.slice(0, 50)}`);
    else if (lang === "zh-TW" && /[们这说个为与实开关体点边际层画题据认将从过还选击设动视频]/.test(v)) probs.push(`Simplified in zh-TW: ${v.slice(0, 50)}`);
  }
  for (const [k, v] of Object.entries(d)) {
    if (!S.has(k)) probs.push(`not a collected string: ${k.slice(0, 60)}`);
    if (typeof v !== "string" || (!v.trim() && !ARTICLE.test(k))) { probs.push(`empty: ${k.slice(0, 60)}`); continue; }
    if (PH(k) !== PH(v)) probs.push(`placeholders changed: ${k.slice(0, 50)} -> ${v.slice(0, 50)}`);
    if (ARROWS(k) !== ARROWS(v)) probs.push(`▸ menu path changed: ${k.slice(0, 50)}`);
    if (/^zh/.test(lang) && (v.match(/[぀-ヿ]/g) || []).length > 2) probs.push(`kana in Chinese: ${v.slice(0, 50)}`);
    if (lang === "zh-TW" && /[们这说个为与实开关体点边际层画题据认将从过还选击设动视频]/.test(v.replace(/简体中文/g, ""))) probs.push(`Simplified in zh-TW: ${v.slice(0, 50)}`);
    if (lang === "zh-CN" && /[們這說個為與實開關體點邊際層畫題據]/.test(v.replace(/繁體中文/g, ""))) probs.push(`Traditional in zh-CN: ${v.slice(0, 50)}`);
  }
  return probs;
}
if (require.main === module) {
  const [cmd, lang, dir] = process.argv.slice(2);
  if (!cmd || !LANGS.includes(lang)) { console.log("usage: node scripts/i18n-ui.js build|status|check <" + LANGS.join("|") + "> [dir]"); process.exit(2); }
  if (cmd === "build") {
    const d = dictOf(lang), S = new Set(strings()), pats = patsOf(lang), PS = new Set(patterns());
    const files = fs.readdirSync(dir).filter((f) => new RegExp(`^chunk\\d+\\.${lang.replace("-", "\\-")}(\\.part\\w+)?\\.json$`).test(f)).sort();
    let n = 0, bad = 0;
    for (const f of files) { const j = read(path.join(dir, f)); if (!j) { console.log("not JSON: " + f); bad++; continue; } for (const [k, v] of Object.entries(j)) { if (typeof v !== "string") continue; if (PS.has(k) && v.trim()) { pats[k] = v; n++; } else if (S.has(k) && (v.trim() || ARTICLE.test(k))) { d[k] = v; n++; } } }
    fs.mkdirSync(DIR, { recursive: true });
    console.log(`build ${lang}: ${files.length} files, ${n} strings / patterns${bad ? `, ${bad} unreadable` : ""} -> v ${save(lang, d, pats)}`);
  } else if (cmd === "status") {
    const d = dictOf(lang), all = strings(), have = all.filter((s) => d[s] != null).length, P = patterns(), pp = patsOf(lang), ph = P.filter((x) => pp[x] != null).length;
    console.log(JSON.stringify({ lang, strings: all.length, translated: have, english: all.length - have, patterns: P.length, patternsTranslated: ph }));
  } else if (cmd === "check") { const pr = check(lang); pr.slice(0, 40).forEach((x) => console.log("PROBLEM: " + x)); console.log(`check ${lang}: ${pr.length} problems`); process.exit(pr.length ? 1 : 0); }
}
module.exports = { check, PH, HOLES, save, dictOf, patsOf, strings, patterns, LANGS };
