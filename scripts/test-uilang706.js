#!/usr/bin/env node
/* bitGen Studio — 2.706.0: THE SETTINGS DIALOG IN 简体中文 / 繁體中文 / 日本語 - the words the app BUILDS while it runs:
 * dictionary patterns ({n} = a value), lines / " · " pieces translated one by one (static/uilang.js compile / tr / trAll),
 * scripts/ui-dynamic.js (the patterns read from the code that draws Settings), scripts/i18n-ui.js (patterns built, checked,
 * converted for zh-TW). The browser: scripts/test-uilang706-ui.js.
 * Tim (verbatim): "do the settings dialog next, the other dockers can go into the next edit" */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const U = require(path.join(ROOT, "static", "uilang.js")), C = require(path.join(ROOT, "scripts", "i18n-ui.js")), Y = require(path.join(ROOT, "scripts", "ui-dynamic.js"));
const P = U.compile({ "installed {0} — skipped {1}": "已安装 {0}，跳过 {1}", "{0}s → {1}s ({2}s) — short; 10-30s clones better": "{0} 秒 → {1} 秒（{2} 秒）——偏短", "{0} px high": "高 {0} px", "{0} ({1}) — scripts: {2}": "{0}（{1}）—— 脚本：{2}", "{1} out of {0}": "{0} 中的 {1}" });
const D = { floating: "浮动", "Image editor": "图像编辑器", checking: "检查中" };
check("patterns: the words round a value translated, the values kept (reordered when the translation puts them elsewhere), a value that is itself a word translated too",
  U.tr("✓ installed Sage — skipped Spectrum…", D, P) === "✓ 已安装 Sage，跳过 Spectrum…" && U.tr("12.3s → 10s (8s) — short; 10-30s clones better", D, P) === "12.3 秒 → 10 秒（8 秒）——偏短"
  && U.tr("3 out of 9", D, P) === "9 中的 3" && U.tr("Image editor (imageeditdock) — scripts: a.js", D, P) === "图像编辑器（imageeditdock）—— 脚本：a.js" && U.tr("nothing like it", D, P) === null);
check("trAll: a status built from lines or \" · \" pieces - each piece translated, a value never spans a piece", U.trAll("floating · 492 px high", D, P) === "浮动 · 高 492 px" && U.trAll("checking\nfloating", D, P) === "检查中\n浮动" && U.trAll("x · y", D, P) === null);
check("compile: a pattern needs a fixed word part of 3+ characters (\"{0} {1}\" would match anything)", U.compile({ "{0} {1}": "x", "ok {0}": "y" }).length === 0 && U.compile({ "done {0}": "z" }).length === 1);
// the extractor
const sample = `function paint(j){ $("s_box").textContent = j.ok ? \`installed \${j.name} (\${j.size})\` : "not installed — press Install"; $("s_box").title = "Click to " + (j.on ? "stop" : "start") + " it";
  const lines = []; lines.push("python: " + j.py); $("s_box").textContent = lines.join("\\n"); el.innerHTML = '<b>' + n + '</b> files ready'; $("other").textContent = "elsewhere"; }`;
const got = Y.hasParser ? Y.scan(sample, "x.js", new Set(["s_box"])).map((r) => r.p).sort() : null;
if (!got) console.log("SKIP: the extractor check (no TypeScript compiler here - a developer tool; dynamic.json is checked below)");
else check("ui-dynamic: every place the code writes words -> strings and {n} patterns (ternaries expanded, pushes of the same function, innerHTML pieces), only for the Settings dialog's elements",
  ["Click to start it", "Click to stop it", "installed {0} ({1})", "not installed — press Install", "python: {0}"].every((x) => got.includes(x)) && !got.includes("elsewhere"), got);
const dyn = JSON.parse(fs.readFileSync(path.join(ROOT, "static", "i18n", "ui", "dynamic.json"), "utf8"));
check("dynamic.json: the Settings code's words (100+ strings, 100+ patterns - e.g. the token check, the speech engines, the add-ons, the LLM engine line)",
  dyn.scope === "settings" && dyn.strings.length > 100 && dyn.patterns.length > 100 && dyn.patterns.some((x) => /^valid — signed in as \{0\}/.test(x.p)) && dyn.patterns.some((x) => /installed \{0\}/.test(x.p)));
check("i18n-ui check: a pattern's {n} must all survive", C.HOLES("a {1} b {0}") === C.HOLES("{0} 和 {1}") && C.HOLES("a {0}") !== C.HOLES("a"));
for (const lang of ["zh-CN", "zh-TW", "ja"]) {
  const pats = C.patsOf(lang), all = C.patterns(), have = all.filter((p) => pats[p] != null).length, pr = C.check(lang);
  const d = C.dictOf(lang), S = C.strings(), sh = S.filter((s) => d[s] != null).length;
  check(`${lang}: every Settings pattern translated (${have}/${all.length}), the words ${Math.round(sh / S.length * 100)}% (98%+), check 0 problems`, have === all.length && sh / S.length >= 0.98 && pr.length === 0, pr.slice(0, 5));
}
const UL = fs.readFileSync(path.join(ROOT, "static", "uilang.js"), "utf8");
check("wired: the page uses trAll with the compiled patterns for text and attributes", (UL.match(/trAll\(v, S\.dict, S\.pats\)/g) || []).length === 2 && /S\.pats = compile\(j && j\.patterns\)/.test(UL));
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
