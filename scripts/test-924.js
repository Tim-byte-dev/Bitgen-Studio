#!/usr/bin/env node
// bitGen Studio 2.924.0 - the 📱 app built from bitGen wears the studio's theme colours.
// Tim: "when building the app from bitgen can we use the theme colors currently selected for the app?"
// Units: lib/apkTheme.js (the studio -> app colour map, the words on the accent, the file it writes) against every built-in
// studio theme (static/themes.js), and the wiring: the page sends the theme in use, the build writes it before cap sync,
// a build without bitGen gets the app's own look, the app loads it in <head> and sets the phone's bar icons.
// The browser run (a real build with stand-in tools, the built app opened): test-ui924-ui.js. Run: node scripts/test-924.js
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let P = 0, F = 0;
const check = (n, ok, got) => { if (ok) { P++; console.log("PASS:", n); } else { F++; console.log("FAIL:", n, got === undefined ? "" : JSON.stringify(got).slice(0, 600)); } };
const src = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const A = require("../lib/apkTheme"), TH = require("../static/themes.js");

// what static/apkui.js themeNow() sends for a theme
const sent = (id, accent, vars) => { const v = TH.varsFor(id, accent || "", vars || {}), o = {}; for (const k of Object.keys(v)) if (k.indexOf("--th-") !== 0) o[k.slice(2)] = v[k]; return { name: TH.THEMES[id].name, scheme: TH.THEMES[id].scheme, vars: o }; };

const all = Object.keys(TH.THEMES).map((id) => ({ id, c: A.clean(sent(id)), v: A.appVars(sent(id)) }));
check("every built-in studio theme (" + Object.keys(TH.THEMES).join(", ") + ") becomes the app's colours", all.every((x) => x.c && x.v && x.v["--bg"] === TH.THEMES[x.id].ink && x.v["--ink"] === TH.THEMES[x.id].text && x.v["--tiger"] === TH.THEMES[x.id].tiger), all.filter((x) => !x.c).map((x) => x.id));
check("...the map: the studio's ink (background) -> --bg, text -> --ink, panel / panel-2 / line / dim / ok / bad by name, tiger -> --tiger + --accent",
  A.MAP.ink === "--bg" && A.MAP.text === "--ink" && A.MAP.tiger === "--tiger" && all[0].v["--accent"] === all[0].v["--tiger"] && all[0].v["--panel-2"] === TH.THEMES[all[0].id]["panel-2"]);
check("...readable everywhere: the words on the accent at least 4.5:1, the text on the background at least 7:1", all.every((x) => A.contrast(x.v["--on-tiger"], x.v["--tiger"]) >= 4.5 && A.contrast(x.v["--ink"], x.v["--bg"]) >= 7),
  all.map((x) => [x.id, A.contrast(x.v["--on-tiger"], x.v["--tiger"]).toFixed(1), A.contrast(x.v["--ink"], x.v["--bg"]).toFixed(1)]));
const blue = A.appVars(sent("light", "#2b6cd6", { panel: "#fdfcf8" }));
check("your accent and your Customize colours come along; white words on a dark-enough accent, the app's dark brown on a light one",
  blue["--tiger"] === "#2b6cd6" && blue["--panel"] === "#fdfcf8" && blue["--on-tiger"] === "#ffffff" && A.onColor("#f59e2c") === "#1a1206", blue);
check("--accent-dim (the talk bubbles) and --banner (the ⬆ Update bar) mixed from the accent and the panel", /^#[0-9a-f]{6}$/.test(blue["--accent-dim"]) && blue["--banner"] === A.mix("#2b6cd6", "#fdfcf8", 0.14));
check("a light theme says light (the phone's bar icons dark), the others dark; no scheme = worked out from the background",
  A.clean(sent("light")).scheme === "light" && A.clean(sent("dark")).scheme === "dark" && A.clean(Object.assign(sent("light"), { scheme: undefined })).scheme === "light");
check("nothing usable (missing colours, not hex, nothing) = null - the app's own look", A.clean(null) === null && A.clean({ vars: { ink: "#000000" } }) === null && A.clean({ vars: Object.assign({}, sent("dark").vars, { text: "red" }) }) === null);
const s1 = A.script(sent("neural")), s0 = A.script(null);
check("theme.js: window.BG_THEME {name, scheme, css} and the variables on <html> before the first paint (+ color-scheme)",
  /window\.BG_THEME = \{"name":"Neural blue","scheme":"dark","css":\{"--bg":"#020a17"/.test(s1) && /s\.setProperty\(k, t\.css\[k\]\); s\.colorScheme = t\.scheme;/.test(s1) && /meta\[name="color-scheme"\]/.test(s1));
const hostile = A.script(Object.assign(sent("dark"), { name: "*/x<script>" }));
check("...a hostile name cannot break out of the comment (*/ and <> dropped there; in the data it is only a JSON string)", !/\*\/x/.test(hostile.split("\n")[0]) && !/[<>]/.test(hostile) && /"name":"\*\/xscript"/.test(hostile) && /window\.BG_THEME = null;/.test(s0));
const T = fs.mkdtempSync(path.join(os.tmpdir(), "bg924-"));
const w = A.write(T, sent("slate", "#ff3366"));
check("write(): mobile/www/lib/theme.js, the name / scheme / accent said for the build's log", w.name === "Slate" && w.scheme === "dark" && w.accent === "#ff3366" && /"--tiger":"#ff3366"/.test(fs.readFileSync(path.join(T, "www", "lib", "theme.js"), "utf8")), w);
const w0 = A.write(T, null);
check("...no theme sent = the app's own look written (BG_THEME null)", w0.name === null && /window\.BG_THEME = null;/.test(fs.readFileSync(path.join(T, "www", "lib", "theme.js"), "utf8")));
fs.rmSync(T, { recursive: true, force: true });

const ab = src("lib/apkBuild.js"), ui = src("static/apkui.js"), vd = src("mobile/scripts/vendor.js");
check("the build: theme -> www/lib/theme.js BEFORE scripts/vendor.js and cap sync, said in its log", /async function build\(then, theme\)/.test(ab) && ab.indexOf('require("./apkTheme").write(dir, theme)') > 0
  && ab.indexOf('require("./apkTheme").write(dir, theme)') < ab.indexOf('"scripts", "vendor.js"') && /🎨 the app's colours: bitGen Studio's theme/.test(ab));
check("the route passes it; 🔨 Build and 🔨 Build + install send the theme in use (H3Theme: the theme, your accent, your colours)",
  /A\.build\(b\.install \? "install" : "", b\.theme\)/.test(src("routes/apkBuild.js")) && /post\("\/api\/apk\/build", \{ theme: themeNow\(\) \}\)/.test(ui) && /post\("\/api\/apk\/build", \{ install: true, theme: themeNow\(\) \}\)/.test(ui)
  && /T\.varsFor\(c\.theme, c\.accent, c\.vars\)/.test(ui) && /k\.indexOf\("--th-"\) !== 0/.test(ui));
check("a build without bitGen (Android Studio / npx cap sync): vendor.js writes the app's own look when there is no theme.js; it is not in git",
  /if \(!fs\.existsSync\(theme\)\) fs\.writeFileSync\(theme, .*window\.BG_THEME = null;/.test(vd) && /www\/lib\/theme\.js/.test(src("mobile/.gitignore")));
const html = src("mobile/www/index.html"), css = src("mobile/www/app.css"), js = src("mobile/www/app.js");
check("the app: lib/theme.js in <head> after app.css (before the first paint)", html.indexOf('<script src="lib/theme.js"></script>') > html.indexOf('href="app.css"') && html.indexOf('<script src="lib/theme.js"></script>') < html.indexOf("</head>"));
check("...GENERATE's words and the ⬆ Update bar follow the theme (the old look when there is none)", /\.btn\.go \{ background: var\(--tiger\); color: var\(--on-tiger, #1a1206\);/.test(css) && /background: var\(--banner, #2a2214\)/.test(css));
check("...the phone's status / navigation bar icons: LIGHT style (dark icons) on a light theme, DARK otherwise (Capacitor 8 SystemBars)",
  /sb\.setStyle\(\{ style: t && t\.scheme === "light" \? "LIGHT" : "DARK" \}\)/.test(js) && /barStyle\(\);/.test(js));
check("the app's version 1.10.0", JSON.parse(src("mobile/package.json")).version === "1.10.0");
check("server.js untouched", !/apkTheme/.test(src("misc/server.js")));

console.log(`\nRESULT: ${P} passed, ${F} failed`);
process.exit(F ? 1 : 0);
