#!/usr/bin/env node
/* bitGen Studio — 2.432.0 units: THEMES (static/themes.js) + the UI size, and ⊞ DOCKER LAYOUT keeping what is on
 * screen + the floating panels (static/dockcfg.js, lib/dockerCfg.js, static/secfloat.js, ext/timelinedock/stagedock.js)
 *   1. the themes: every one sets every variable, varsFor + an accent, shade, clampScale
 *   2. the wiring: themes.js in <head>, the Themes tab (cards, accent, the UI size moved from General), the sliders
 *      60 - 175 %, the editor's bitGen theme built from the app's variables
 *   3. docker.cfg: a variant keeps vis (dockers / side docks), floats (cleaned like docker_status.json's), panels, cols;
 *      junk is dropped; the page saves / applies them
 * Tim: "create a themes tab in the settings dialog - have a ui size slider to adjust the size of fonts and the ui. save
 * the visibility status of the dockers as well, and their positions and sizes when save layout button under docker
 * layout". */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const T = require(path.join(ROOT, "static", "themes.js"));
const C = require(path.join(ROOT, "lib", "dockerCfg.js"));

/* ---- 1 */
check("five themes in order: Dark, Darker (OLED), Slate, Light, High contrast", T.ORDER.join() === "dark,darker,slate,light,contrast" && T.ORDER.every((k) => T.THEMES[k] && T.THEMES[k].name));
check("...each sets every colour variable (a hex each) and a color-scheme", T.ORDER.every((k) => T.VARS.every((v) => /^#[0-9a-f]{6}$/i.test(T.THEMES[k][v])) && ["dark", "light"].includes(T.THEMES[k].scheme)));
check("Dark = bitGen's own colours (the :root defaults)", (() => { const ix = read("static", "index.html"); const d = T.THEMES.dark; return ["ink", "panel", "panel-2", "line", "text", "dim", "tiger", "tiger-deep", "ok", "bad", "ui-hover", "ui-canvas", "ui-on"].every((k) => new RegExp("--" + k + ": " + d[k] + ";").test(ix)); })());
const v = T.varsFor("light", "#2266DD");
check("varsFor: the theme's variables (+ the same as --th-*, what the image editor reads); an accent of your own replaces --tiger (lower case) and --tiger-deep (a darker shade)", v["--panel"] === "#ffffff" && v["--tiger"] === "#2266dd" && v["--tiger-deep"] === T.shade("#2266DD", -0.22) && Object.keys(v).length === T.VARS.length * 2 && v["--th-tiger"] === "#2266dd");
check("...no accent / a bad one = the theme's; an unknown theme = Dark", T.varsFor("slate", "")["--tiger"] === T.THEMES.slate.tiger && T.varsFor("slate", "blue")["--tiger"] === T.THEMES.slate.tiger && T.varsFor("nope")["--ink"] === T.THEMES.dark.ink);
check("shade: darker / lighter / bad in = out", T.shade("#808080", -0.5) === "#404040" && T.shade("#000000", 0.5) === "#808080" && T.shade("red", 0.3) === "red");
check("clampScale: 60 - 175 %, junk = 100", T.clampScale(10) === 60 && T.clampScale(300) === 175 && T.clampScale("150") === 150 && T.clampScale("x") === 100);

/* ---- 2 */
const IX = read("static", "index.html"), IE = read("ext", "imageeditdock", "imageedit.js");
check("themes.js is loaded in <head> (the kept theme on <html> before the page paints)", IX.indexOf('<script src="/static/themes.js"></script>') > 0 && IX.indexOf('<script src="/static/themes.js"></script>') < IX.indexOf("</head>"));
check("Settings: a Themes tab after General - the cards (#s_themes), the accent (#s_accent + Reset), the UI size slider (moved from General)",
  /<button data-stab="general" class="active">General<\/button>\s*<button data-stab="themes">Themes<\/button>/.test(IX) && /<div class="stab" id="stab-themes">[\s\S]*?id="s_themes"[\s\S]*?id="s_accent"[\s\S]*?id="s_accentreset"[\s\S]*?id="s_uiscale" min="60" max="175"/.test(IX)
  && (IX.match(/id="s_uiscale"/g) || []).length === 1 && IX.indexOf('id="s_uiscale"') > IX.indexOf('id="stab-themes"') && IX.indexOf('id="s_uiscale"') < IX.indexOf('id="stab-general"'));
check("...the left dock's slider 60 - 175 % too; applyUiScale clamps through H3Theme", /id="uiscale" min="60" max="175"/.test(IX) && /v = window\.H3Theme \? H3Theme\.clampScale\(v\)/.test(IX));
check("the image editor's bitGen theme is built from the app's variables (it follows the theme)", /\.kx\[data-theme=bitgen\]\{--pc-bg:var\(--th-ink,#14120f\);--pc-panel:var\(--th-panel,#1d1a15\);[^}]*--pc-accent:var\(--th-tiger,#f59e2c\);--pc-hover:var\(--th-ui-hover,#2f2a21\);--pc-canvas:var\(--th-ui-canvas,#0f0d0b\);--pc-on:var\(--th-ui-on,#4a3414\);/.test(IE));

/* ---- 3 */
const cv = C.cleanVariant({ window: { w: 1700, h: 1000 }, col: { h: 800 }, docks: {},
  vis: { bottom: { musicdock: { gone: false, collapsed: true }, videodock: { gone: true }, bogus: { gone: true } }, side: { refs: true, ldock: false, nope: true, qdock: "yes" } },
  floats: { basic: { shown: true, x: 420, y: 260, w: 380, h: 300, evil: "<x>" }, "bad id!": { shown: true } },
  panels: { kgDlg: { shown: true, side: "L", x: 10, y: 20, w: 330, h: 500 }, tlTools: { side: "Q", x: "a" } }, cols: { L: 340, R: "x" } });
check("docker.cfg keeps what was on screen: the dockers (gone / collapsed), the side docks (hidden) - unknown ids / non-booleans dropped",
  JSON.stringify(cv.vis) === '{"bottom":{"videodock":{"gone":true,"collapsed":false},"musicdock":{"gone":false,"collapsed":true}},"side":{"ldock":false,"refs":true}}', cv.vis);
check("...the floating panels cleaned like docker_status.json's floats (bad ids dropped, no extra keys)", cv.floats && Object.keys(cv.floats).join() === "basic" && cv.floats.basic.shown === true && cv.floats.basic.x === 420 && cv.floats.basic.w === 380 && !("evil" in cv.floats.basic), cv.floats);
check("...the dockers beside the timeline canvas (shown, side L / R / '', x, y, w, h) and the columns' widths", cv.panels.kgDlg.side === "L" && cv.panels.kgDlg.w === 330 && cv.panels.tlTools.side === "" && cv.panels.tlTools.x === 0 && cv.cols.L === 340 && cv.cols.R === 0, [cv.panels, cv.cols]);
check("...an older variant (none of them) stays as it was", !("vis" in C.cleanVariant({ window: { w: 1, h: 1 } })) && !("floats" in C.cleanVariant({})));
const DC = read("static", "dockcfg.js"), SF = read("static", "secfloat.js"), SD = read("ext", "timelinedock", "stagedock.js");
check("the page: Save layout snapshots vis + floats (SecFloat.states) + panels (TlStageDock state) + cols; Load applies them (applyPanels) and the side docks from vis",
  /return \{ open: openIds\(\), window: winSize\(\), col: \{ h: colH\(\) \}, docks: docks, vis: vis, floats: floats, panels: panels, cols: cols,/.test(DC) && /applyPanels\(p\.variant\);/.test(DC)
  && /if \(vis && vis\.side && typeof vis\.side\[id\] === "boolean"\)/.test(DC) && /var inSet = want\.indexOf\(id\) >= 0, keepHead = !inSet && !!\(vb\[id\] && !vb\[id\]\.gone\);/.test(DC) && /💾 Save layout/.test(DC) && /Docker layout/.test(DC));
check("...SecFloat.states / applyStates; TlStageDock panels' state / apply + colW", /const states = \(\) =>/.test(SF) && /function applyStates\(m\)/.test(SF) && /function state\(\) \{ return \{ shown: shown\(\), side: side, x: x, y: y, w: w, h: h \}; \}/.test(SD) && /function colW\(s, v\)/.test(SD));
check("server.js untouched", !/themes\.js|applyStates|vis\.side/.test(read("misc/server.js")));

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
