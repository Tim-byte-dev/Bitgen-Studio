#!/usr/bin/env node
/* bitGen Studio — 2.705.0: THE APP'S OWN WORDS IN 简体中文 / 繁體中文 / 日本語 - static/uilang.js (split / tr), the dictionaries
 * (static/i18n/ui/<lang>.json - scripts/i18n-ui.js check), the guides naming buttons as the translated UI does
 * (lib/helpI18n.js uiNames - not in the editors' sections yet), the wiring (the dropdown left of ⊞, one setting with the guide,
 * nothing decided by English words). The browser: scripts/test-uilang705-ui.js.
 * Tim (verbatim): "is it possible to add a language dropdown to the left of docker layout and change the language of the ui
 * on change?" */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const U = require(path.join(ROOT, "static", "uilang.js")), I = require(path.join(ROOT, "lib", "helpI18n.js")), C = require(path.join(ROOT, "scripts", "i18n-ui.js"));
const rd = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

check("split: the words between their icons / symbols - \"💾 Save…\" -> 💾 + Save + …; a bracket the words opened stays with them",
  JSON.stringify(U.split("💾 Save…")) === '{"pre":"💾 ","core":"Save","post":"…"}' && U.split("Zoom in (lens)").core === "Zoom in (lens)" && JSON.stringify(U.split("(top level)")) === '{"pre":"(","core":"top level","post":")"}' && U.split("Steps:").post === ":");
const D = { Save: "保存", Steps: "步数", "top level": "顶层", "Open the folder": "打开文件夹" };
check("tr: translated with its icon / colon / spaces kept; inner spaces collapsed for the lookup; unknown words -> null (they stay English)",
  U.tr("💾 Save", D) === "💾 保存" && U.tr("Steps:", D) === "步数:" && U.tr("(top level)", D) === "(顶层)" && U.tr("Open  the\n folder", D) === "打开文件夹" && U.tr("Delete", D) === null && U.tr("123", D) === null);
check("not translated: the guide's own text, code / kbd / pre, text boxes, [data-noi18n] (2.707.0: the editors' dockers ARE now)",
  ["#hlpBody .hlpc", "code", "kbd", "textarea", "[data-noi18n]"].every((x) => U.SKIP.includes(x)) && !/imageeditdock|timelinedock|pushpulldock|solidcraftdock/.test(U.SKIP) && JSON.stringify(U.ATTRS) === '["title","placeholder","aria-label"]');
check("guides: a bold name the UI dictionary has is shown as the app shows it, its old gloss （…） dropped; others untouched",
  I.uiNames("按 **💾 Save**（保存） 再 **Steps**（步数）：**Delete**（删除）", D) === "按 **💾 保存** 再 **步数**：**Delete**（删除）" && I.uiNamesHtml("<b>Save</b>（保存）<b>X</b>", D) === "<b>保存</b><b>X</b>" && I.uiNames("x", null) === "x");
check("…in the editors' sections / ❔ pages too since 2.707.0 (their UI is translated): EDITORS matches nothing, UI_EDITOR_PAGES is empty",
  ["The image editor with AI", "Editing on the timeline: speed", "📏 Sketcher - 3D modelling", "📐 SolidCraft"].every((t) => !I.EDITORS.test(t)) && /UI_EDITOR_PAGES = \[\]/.test(rd("lib/helpI18n.js")));
check("dictionary check: placeholders and ▸ menu paths must survive", C.PH("Open <project> {n} [0-2s] %s") === C.PH("打开 %s [0-2s] {n} <project>") && C.PH("a <x>") !== C.PH("一个"));

const IDX = rd("static/index.html");
check("wired: index.html loads uilang.js right after helplang.js (one language setting for the app and its guide)", /helplang\.js"><\/script>[^\n]*\n<script src="\/static\/uilang\.js">/.test(IDX) && /H3HelpLang\.onChange\(function \(l\) \{ apply\(l\); \}\)/.test(rd("static/uilang.js")));
check("…the dropdown sits left of ⊞ (inside #dockCfgWrap, before the button), its own words never translated", /wrap\.insertBefore\(s, wrap\.firstChild\)/.test(rd("static/uilang.js")) && /s\.id = "uiLangSel"; s\.setAttribute\("data-noi18n", ""\)/.test(rd("static/uilang.js")));
check("…nothing in the main window decides by English words any more: ComfyUI's start-on-click by data-state, the token note by a flag",
  /\$\("sbcomfy"\)\.dataset\.state === "down"/.test(IDX) && !/\$\("sbcomfy"\)\.textContent === /.test(IDX) && /!\$\("s_hfstatus"\)\.dataset\.checked/.test(IDX) && !/s_hfstatus"\)\.textContent === "not checked yet"/.test(IDX));
check("…the Guide PDF uses the same names (make_guide_pdf.py reads `node scripts/i18n-help.js render`)", /"i18n-help\.js"\), "render", lang\]/.test(rd("scripts/make_guide_pdf.py")) && /cmd === "render"/.test(rd("scripts/i18n-help.js")));

const S = JSON.parse(rd("static/i18n/ui/strings.json"));
check("strings.json: the main window's words collected from the running app (scripts/ui-strings.js) - 3000+", S.strings.length > 3000 && S.strings.every((x) => x.s && x.kinds.length));
for (const lang of ["zh-CN", "zh-TW", "ja"]) {
  const p = path.join(ROOT, "static", "i18n", "ui", lang + ".json"), j = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : null;
  const cov = j ? S.strings.filter((x) => j.strings[x.s] != null).length / S.strings.length : 0, pr = j ? C.check(lang) : ["missing"];
  check(`${lang}: the dictionary covers ${Math.round(cov * 100)}% of the words (90%+), every entry well formed (scripts/i18n-ui.js check)`, j && j.lang === lang && /^[0-9a-f]{12}$/.test(j.v) && cov >= 0.9 && pr.length === 0, pr.slice(0, 6));
}
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
