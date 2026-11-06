#!/usr/bin/env node
/* bitGen Studio — 2.703.0: THE GUIDE AND HELP IN SIMPLIFIED CHINESE + JAPANESE - lib/helpI18n.js (markers, hashes, a section
 * newer in English = stale, not translated = English), scripts/i18n-help.js (check), static/helplang.js (the picked language),
 * the wiring (routes/help.js, palette.js, help.js, index.html, make_guide_pdf.py --lang), and the shipped translations'
 * structure. The browser: scripts/test-i18n703-ui.js.
 * Tim (verbatim): "is it possible to translate help and the user guide into chinese and japanese as additional help files?"
 * + "sorry it should be simplified chinese for mainland china" */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const I = require(path.join(ROOT, "lib", "helpI18n.js")), HD = require(path.join(ROOT, "lib", "helpDocs.js"));
const T = require(path.join(ROOT, "scripts", "i18n-help.js")), L = require(path.join(ROOT, "static", "helplang.js"));

check("two languages: Simplified Chinese (zh-CN, mainland) and Japanese", JSON.stringify(I.LANGS.map((l) => l.id)) === '["zh-CN","ja"]' && I.isLang("zh-CN") && !I.isLang("zh-TW") && !I.isLang("en"));
const EN = "# Guide\n\nIntro words.\n\n## First one\n\nAlpha text `code`.\n\n![pic](images/a.png)\n\n## Second\n\nBeta text.\n\n### Sub\n\nGamma.\n";
const R = I.rawSections(EN);
check("rawSections: the part before the first ## (_top) + each ## section, ids as lib/helpDocs gives them", R.map((s) => s.id).join() === "_top,first-one,second" && HD.sections(EN).map((s) => s.id).join() === "first-one,second" && /!\[pic\]/.test(R[1].raw));
const WM = I.withMarkers(EN), H = I.enHashes(EN);
check("withMarkers: a marker after the title and after each ## heading, the hash of what it was translated from", (WM.match(/<!-- en: /g) || []).length === 3 && WM.includes(`# Guide\n<!-- en: _top ${H._top} -->`) && WM.includes(`## Second\n<!-- en: second ${H.second} -->`));
check("parseMarker / hash: 12 hex, the same text the same hash, CRLF ignored", JSON.stringify(I.parseMarker("<!-- en: first-one 0123456789ab -->")) === '{"id":"first-one","hash":"0123456789ab"}' && !I.parseMarker("<!-- other -->") && /^[0-9a-f]{12}$/.test(I.hash("x")) && I.hash("a\r\nb") === I.hash("a\nb"));

// a little install: English + a Chinese translation of one section (the other not translated), shortcuts, a help page
const B = fs.mkdtempSync(path.join(os.tmpdir(), "i18n703-"));
const w = (p, s) => { fs.mkdirSync(path.dirname(path.join(B, p)), { recursive: true }); fs.writeFileSync(path.join(B, p), s); };
const SC = { groups: [{ title: "Anywhere", rows: [["Ctrl+K", "Find anything"], ["Esc", "Close"]] }, { title: "Timeline", rows: [["Space", "Play"]] }] };
w("docs/USAGE.md", EN); w("docs/shortcuts.json", JSON.stringify(SC));
w("docs/i18n/zh-CN/USAGE.md", `# 指南\n<!-- en: _top ${H._top} -->\n\n简介。\n\n## 第一部分\n<!-- en: first-one ${H["first-one"]} -->\n\nAlpha 文字 \`code\`。\n`);
w("docs/i18n/zh-CN/shortcuts.json", JSON.stringify({ lang: "zh-CN", groups: [{ en: I.groupHash(SC.groups[0]), title: "任意位置", rows: [["Ctrl+K", "查找任何内容"], ["Esc", "关闭"]] }, { en: "000000000000", title: "时间线", rows: [["Space", "播放"]] }] }));
w("static/help/x.html", "<h2>X help</h2><p>Words</p>\n"); w("static/help/zh-CN/x.html", `<!-- en: x ${I.hash("<h2>X help</h2><p>Words</p>\n")} -->\n<h2>X 帮助</h2><p>文字</p>\n`);
const Z = I.load(B, "zh-CN");
const s1 = Z.sections.find((s) => s.id === "first-one"), s2 = Z.sections.find((s) => s.id === "second");
check("load(zh-CN): a translated section in Chinese (its English id + title kept for links / search), the marker gone from its text",
  s1.lang === "zh-CN" && s1.title === "第一部分" && /Alpha 文字/.test(s1.md) && !/<!--/.test(s1.md) && s1.enTitle === "First one" && /First one/.test(s1.text) && !s1.stale, s1);
check("…a section not translated comes in English (lang en) and is counted missing", s2.lang === "en" && s2.title === "Second" && Z.missing >= 1);
check("…shortcuts: a group with a matching hash translated; one whose English changed = stale (still shown, flagged)", Z.shortcuts.groups[0].title === "任意位置" && Z.shortcuts.groups[0].rows[0][1] === "查找任何内容" && !Z.shortcuts.groups[0].stale && Z.shortcuts.groups[1].stale && Z.shortcuts.groups[1].rows[0][0] === "Space");
w("docs/USAGE.md", EN.replace("Alpha text", "Alpha text changed")); const Z2 = I.load(B, "zh-CN");
check("English changed after the translation -> that section is stale (the Help window says so); the others are not", Z2.sections.find((s) => s.id === "first-one").stale && Z2.stale >= 1);
check("load(en) / an unknown language = the English guide", I.load(B, "en").lang === "en" && I.load(B, "fr").sections[0].title === "First one");
const pg = I.page(B, "x", "zh-CN");
check("page(): the translated ❔ page without its marker; English when there is none; stale when the English page changed; no path tricks",
  pg.lang === "zh-CN" && /X 帮助/.test(pg.html) && !/<!--/.test(pg.html) && !pg.stale && I.page(B, "x", "ja").lang === "en" && I.page(B, "../x", "zh-CN") === null
  && (() => { w("static/help/x.html", "<h2>X help</h2><p>New words</p>\n"); return I.page(B, "x", "zh-CN").stale; })());
const rep = I.report(B, "zh-CN");
check("report(): what is ok / stale / missing (scripts/i18n-help.js status - refresh when asked)", rep.top === "ok" && rep.sections.stale.includes("first-one") && rep.sections.missing.includes("second") && rep.pages.x === "stale", rep);
fs.rmSync(B, { recursive: true, force: true });

// the checker
const probs = []; T.checkText("s", "## A\n\nRun `npm ci` - see [x](http://e.x).\n\n| a | b |\n|---|---|\n| c | d |\n", "## A\n\nRun `npm i` - see [x](http://e.y).\n\n| a | b |\n", "zh-CN", probs, true);
check("check: changed code, a changed link, a lost table row are found", probs.some((p) => /inline code/.test(p)) && probs.some((p) => /links/.test(p)) && probs.some((p) => /table rows/.test(p)), probs);
const LONG = "Some long English text that is long enough to count as prose for the check here. ".repeat(3); const p2 = []; T.checkText("s", LONG, LONG, "ja", p2);
const p3 = []; T.checkText("s", "x", "這個點", "zh-CN", p3);
check("…untranslated text, and Traditional characters in the Simplified text, are found", p2.some((p) => /untranslated/.test(p)) && p3.some((p) => /Traditional/.test(p)), [p2, p3]);

// the language picked
check("helplang: the system language picks the default - zh-CN / zh-Hans / zh-SG / zh -> zh-CN, zh-TW / zh-HK stay English, ja -> ja",
  L.fromSystem(["zh-CN"]) === "zh-CN" && L.fromSystem(["zh-Hans-CN"]) === "zh-CN" && L.fromSystem(["zh"]) === "zh-CN" && L.fromSystem(["zh-SG"]) === "zh-CN" && L.fromSystem(["zh-TW"]) === "en" && L.fromSystem(["ja-JP", "en"]) === "ja" && L.fromSystem(["en-AU"]) === "en" && L.fromSystem([]) === "en");
check("…the notes in each language (a section newer in English / not translated / the English button)", /英文/.test(L.say("stale", "zh-CN")) && /英語/.test(L.say("stale", "ja")) && L.say("english", "zh-CN") === "查看英文版" && /まだ翻訳/.test(L.say("missing", "ja")));

// wiring
const rd = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
check("wired: /api/help?lang + /api/help/page (routes/help.js - never server.js), palette.js asks in the picked language, ❔ help.js too, index.html loads helplang.js before palette.js",
  /i18n\.load\(core\.BASE/.test(rd("routes/help.js")) && /\/api\/help\/page/.test(rd("routes/help.js")) && !/helpI18n|helpDocs/.test(rd("misc/server.js"))
  && /"\/api\/help" \+ \(L === "en"/.test(rd("static/palette.js")) && /H3HelpLang\.picker\("hlplang"\)/.test(rd("static/palette.js")) && /data-hlpnote/.test(rd("static/palette.js"))
  && /\/api\/help\/page\?topic=/.test(rd("static/help.js")) && /helplang\.js"><\/script>[^\n]*\n<script src="\/static\/palette\.js">/.test(rd("static/index.html")));
check("…the Guide PDF in each language: make_guide_pdf.py --lang (Noto Sans CJK through scripts/cjkfont.py, CJK line breaking)", /def use_lang\(lang\)/.test(rd("scripts/make_guide_pdf.py")) && /WRAP, LANG = "CJK", lang/.test(rd("scripts/make_guide_pdf.py")) && /def cjk_ttf\(/.test(rd("scripts/cjkfont.py")));

// the shipped translations
for (const lang of ["zh-CN", "ja"]) {
  const r = I.report(ROOT, lang), pr = T.check(lang);
  check(`${lang}: the guide, the shortcuts and the three ❔ pages are there; every section kept its structure (markers, code, links, pictures, tables, tags, ids, keys)`,
    fs.existsSync(path.join(ROOT, "docs", "i18n", lang, "USAGE.md")) && r.sections.ok + r.sections.stale.length > 150 && Object.values(r.pages).every((v) => v !== "missing") && pr.length === 0, { pr: pr.slice(0, 8), ok: r.sections.ok, missing: r.sections.missing.length });
  check(`${lang}: the Guide PDF is there`, fs.existsSync(path.join(ROOT, "docs", `bitGen-Studio-Guide-${lang}.pdf`)));
}
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
