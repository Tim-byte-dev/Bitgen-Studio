#!/usr/bin/env node
/* bitGen Studio — 2.862.0 units: the 🧩 web skill cards in 日本語 / 简体中文 / 繁體中文 - every skill's name, description and group
 * (web/skills/<id>/skill.json) is an app word (static/i18n/ui/strings.json) translated in each language, so the cards change with the
 * language dropdown like the rest of the app (static/uilang.js tr - the icon kept in front). A new skill without them fails here. */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const K = require(path.join(ROOT, "lib/webSkills.js")), I = require(path.join(ROOT, "scripts/i18n-ui.js")), U = require(path.join(ROOT, "static/uilang.js"));
const S = new Set(JSON.parse(fs.readFileSync(path.join(ROOT, "static/i18n/ui/strings.json"), "utf8")).strings.map((x) => x.s));
const L = K.list().skills, words = [];
for (const s of L) words.push(s.name, s.description, s.group);
const uniq = [...new Set(words)];
const notListed = uniq.filter((w) => !S.has(w));
check(`every skill's name, description and group (${L.length} skills, ${uniq.length} words) is an app word in strings.json`, !notListed.length, notListed);
for (const lang of ["ja", "zh-CN", "zh-TW"]) {
  const d = I.dictOf(lang), miss = uniq.filter((w) => !d[w] || (d[w] === w && w !== "AJAX"));
  check(`...each translated in ${lang}`, !miss.length, miss);
}
const d = I.dictOf("ja"), b = L.find((s) => s.id === "booking");
check("the card's title '📅 Booking widget' comes out as '📅 予約ウィジェット' (the icon kept in front), its group 'Customers' as 顧客", U.tr("📅 Booking widget", d) === "📅 予約ウィジェット" && U.tr(b.group, d) === "顧客", U.tr("📅 Booking widget", d));
check("'⚠ needs PHP on the host' (the card's note) translated in every language", ["ja", "zh-CN", "zh-TW"].every((l) => U.tr("⚠ needs PHP on the host", I.dictOf(l)) && !/needs PHP/.test(U.tr("⚠ needs PHP on the host", I.dictOf(l)))));
check("the Design group (was 'Look' - which the app already says as an art style) for the theme and layout", L.filter((s) => s.group === "Design").map((s) => s.id).sort().join() === "layout,theme" && !L.some((s) => s.group === "Look"));
console.log(`\nRESULT: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
