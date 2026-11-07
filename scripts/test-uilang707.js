#!/usr/bin/env node
/* bitGen Studio — 2.707.0: THE DOCKERS IN 简体中文 / 繁體中文 / 日本語 - the image editor, timeline, Sketcher, SolidCraft and every
 * other docker. scripts/ui-dynamic.js reads ALL the app's code (static/*.js, ext/<docker>/*.js, index.html) including the
 * words the editors keep as data ({label: "…"}, ["id", "Label"], HTML built inside a .map); scripts/ui-strings.js opens every
 * docker's tabs / tools / menus and leaves out readouts; the guides name the editors' buttons as the app does now.
 * The browser: scripts/test-uilang707-ui.js.  Tim (verbatim): "ok, i guess we can do the dockers next" */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const rd = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const U = require(path.join(ROOT, "static", "uilang.js")), C = require(path.join(ROOT, "scripts", "i18n-ui.js")), Y = require(path.join(ROOT, "scripts", "ui-dynamic.js"));
const W = require(path.join(ROOT, "scripts", "ui-strings.js")), I = require(path.join(ROOT, "lib", "helpI18n.js"));

check("the editors' dockers are no longer left out (image editor, timeline, Sketcher, SolidCraft); the guide text, code and text boxes still are",
  !/imageeditdock|timelinedock|pushpulldock|solidcraftdock/.test(U.SKIP) && ["#hlpBody .hlpc", "code", "textarea", "[data-noi18n]"].every((x) => U.SKIP.includes(x)));
const files = Y.allFiles().map((f) => path.relative(ROOT, f).replace(/\\/g, "/"));
check("ui-dynamic reads all the app's code: every docker's ext/<id>/*.js and static/*.js (not the translation layer itself)",
  ["ext/imageeditdock/pcui.js", "ext/timelinedock/canvas.js", "ext/pushpulldock/pparch.js", "ext/solidcraftdock/scdock.js", "ext/videodock/storyboard.js", "static/modelmgr.js"].every((f) => files.includes(f)) && !files.includes("static/uilang.js"), files.length);
if (!Y.hasParser) console.log("SKIP: the extractor checks (no TypeScript compiler here - a developer tool; dynamic.json is checked below)");
else {
  const sample = `const TOOLS = [{ id: "lasso", label: "Lasso Tool", tip: "Draw a free selection" }, { id: "x", name: "KSampler_x" }];
    const MODES = [["pressure", "Pen pressure"], ["off", "Off"], ["a", "b"]];
    box.innerHTML = list.map((c) => \`<button class="sw" title="\${c} - click = foreground">\${c}</button>\`).join("");
    el.innerHTML = '<span title="' + t + '">Hi</span><input class="xp" value="' + v + '">';`;
  const got = Y.scan(sample, "x.js", null, true).map((r) => r.p);
  check("…the words the editors keep as data: {label / tip: …}, [id, \"Label\"] pairs, tooltips inside HTML built in a .map(); identifiers and tag pieces are not words",
    ["Lasso Tool", "Draw a free selection", "Pen pressure", "Off", "{0} - click = foreground"].every((x) => got.includes(x)) && !got.includes("KSampler_x") && !got.includes("b") && !got.some((x) => /=["']|class=/.test(x)), got);
}
const P = U.compile({ "{0} - click = foreground": "x", "Add {0}": "y", "{0} failed": "z" });
check("ui-strings leaves out readouts (sizes, levels, dates, colour codes) and what a pattern makes from a number; a pattern filled with words keeps its own entry",
  ["7.5 GB", "0.0 dB", "1.4/8GB", "11/05/2026, 3:02 AM", "00ff00", "120 px"].every((s) => W.junk(s, P)) && W.junk("00ff00 - click = foreground", P) && W.junk("3 failed", P)
  && !W.junk("Add character", P) && !W.junk("Lasso Tool", P) && !W.junk("2-Point Rectangle (R)", P));
const dyn = JSON.parse(rd("static/i18n/ui/dynamic.json"));
const from = (d) => dyn.strings.filter((x) => x.src.startsWith("ext/" + d + "/")).length + dyn.patterns.filter((x) => x.src.startsWith("ext/" + d + "/")).length;
check("dynamic.json covers all the code (scope all) - each editor's words are in it (image editor 500+, timeline 400+, Sketcher 100+, SolidCraft 10+)",
  dyn.scope === "all" && from("imageeditdock") > 500 && from("timelinedock") > 400 && from("pushpulldock") > 100 && from("solidcraftdock") > 10, { ie: from("imageeditdock"), tl: from("timelinedock"), pp: from("pushpulldock"), sc: from("solidcraftdock") });
const S = JSON.parse(rd("static/i18n/ui/strings.json"));
check("strings.json: the dockers collected from the running app too (5000+; the image editor's tool panel, the timeline's, the Sketcher's)",
  S.strings.length > 5000 && ["#ieKx", "#tl", "#pp"].every((w) => S.strings.some((x) => x.where.some((y) => y.includes(w)))));
check("the guides: every section and ❔ page names the buttons as the translated app shows them (EDITORS matches nothing, UI_EDITOR_PAGES empty; a ▸ menu path when every part is a word the app has)",
  ["The image editor with AI", "Editing on the timeline: speed", "📏 Sketcher - 3D modelling", "📐 SolidCraft"].every((t) => !I.EDITORS.test(t)) && /UI_EDITOR_PAGES = \[\]/.test(rd("lib/helpI18n.js"))
  && I.uiNames("按 **Lasso Tool**（套索） 再", { "Lasso Tool": "套索工具" }) === "按 **套索工具** 再"
  && I.uiNames("**View ▸ Dockers**（视图）", { View: "视图", Dockers: "面板" }) === "**视图 ▸ 面板**" && I.uiNames("**View ▸ Nope**（x）", { View: "视图" }) === "**View ▸ Nope**（x）");
check("StoryBoard's title still renamed when \"Video\" is already shown translated (ext/videodock/storyboard.js)", /H3UiLang\.state\(\)\.dict\.Video/.test(rd("ext/videodock/storyboard.js")));
for (const lang of ["zh-CN", "zh-TW", "ja"]) {
  const d = C.dictOf(lang), all = C.strings(), have = all.filter((s) => d[s] != null).length, pats = C.patsOf(lang), P2 = C.patterns(), ph = P2.filter((p) => pats[p] != null).length, pr = C.check(lang);
  const ie = dyn.strings.filter((x) => x.src.startsWith("ext/")), ieHave = ie.filter((x) => d[x.s] != null).length;
  check(`${lang}: the words ${have}/${all.length} (99%+), patterns ${ph}/${P2.length} (99%+), the dockers' own ${ieHave}/${ie.length}, check 0 problems`,
    have / all.length >= 0.99 && ph / P2.length >= 0.99 && ieHave / ie.length >= 0.99 && pr.length === 0, pr.slice(0, 5));
}
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
