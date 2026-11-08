#!/usr/bin/env node
/* bitGen Studio — 2.726.0: THE bitGen BRAIN PICTURE AS A STARTING IMAGE + THE NEURAL BLUE THEME - pure + wiring.
 * Tim (verbatim): "use this as one of the starting images and change the theme to match" (where: the website's home page,
 * the app's start-up splash, the Facebook page, a sample in the image tools; the theme: a blue one added, orange stays the
 * default).
 *   the Neural blue theme (static/themes.js - the picture's colours, every variable, after Slate, translated); the splash
 *   (static/splash.html: the film or the picture, at random, #film / #neural; the picture 1920 x 1080, 8 s, the credits);
 *   lib/samples.js (the picture in a fresh install's first project's Assets ▸ Images - never a later project, never twice,
 *   never over a file) + its call in lib/core.js ensureProject; the picture files. The real browser: test-ui726-ui.js. */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const rd = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

// ---- the theme
const T = require(path.join(ROOT, "static", "themes.js"));
const N = T.THEMES.neural;
check("Neural blue: a dark theme after Slate, before Light", N && N.name === "Neural blue" && N.scheme === "dark" && T.ORDER.indexOf("neural") === T.ORDER.indexOf("slate") + 1 && T.ORDER.indexOf("light") === T.ORDER.indexOf("neural") + 1);
check("…every colour variable a hex; the picture's navy (#020a17) and its electric blue as the accent (#52baff)", T.VARS.every((v) => /^#[0-9a-f]{6}$/.test(N[v])) && N.ink === "#020a17" && N.tiger === "#52baff" && N.line === "#1c3e62");
check("…varsFor(neural) puts it on the page (and --th-* for the image editor); an accent of your own still wins",
  T.varsFor("neural", "")["--ink"] === "#020a17" && T.varsFor("neural", "")["--th-tiger"] === "#52baff" && T.varsFor("neural", "#ff0000")["--tiger"] === "#ff0000");
check("…Dark stays the default (an unknown theme = Dark)", T.varsFor("nope", "")["--ink"] === T.THEMES.dark.ink && T.ORDER[0] === "dark");
const UI = (l) => { const d = JSON.parse(rd("static/i18n/ui/" + l + ".json")); return (d.strings || d)["Neural blue"]; };
check("…its name in 日本語 / 简体中文 / 繁體中文 (and collected in dynamic.json)", UI("ja") === "ニューラルブルー" && UI("zh-CN") === "神经蓝" && UI("zh-TW") === "神經藍" && /"Neural blue"/.test(rd("static/i18n/ui/dynamic.json")));

// ---- the splash
const SP = rd("static/splash.html");
check("splash: one of two at each start - the film or the picture, at random; #film / #neural picks", /const pick = want === "film" \|\| want === "neural" \? want : \(Math\.random\(\) < 0\.5 \? "film" : "neural"\);/.test(SP));
check("…the picture: static/splash-neural.jpg full window, a slow push-in, 8 s, the same credits (Timothy Nolan Paul, Claude Opus 5.5); a click / a key still skips",
  /<img id="pic" alt="" src="splash-neural\.jpg">/.test(SP) && /@keyframes push \{ to \{ transform: scale\(1\.06\); \} \}/.test(SP) && /setTimeout\(end, 8000\)/.test(SP)
  && /Produced and developed by<b>Timothy Nolan Paul<\/b>/.test(SP) && /Programmed by<b>Claude Opus 5\.5<\/b>/.test(SP) && /addEventListener\("keydown", end\)/.test(SP));
const jpgSize = (f) => { const b = fs.readFileSync(f); let i = 2; while (i < b.length) { if (b[i] !== 0xff) return null; const m = b[i + 1], L = b.readUInt16BE(i + 2); if (m >= 0xc0 && m <= 0xc3) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)]; i += 2 + L; } return null; };
check("…the picture is 1920 x 1080 (the splash window is 16:9); the original 1024 x 1024 in docs/images", JSON.stringify(jpgSize(path.join(ROOT, "static", "splash-neural.jpg"))) === "[1920,1080]" && JSON.stringify(jpgSize(path.join(ROOT, "docs", "images", "bitgen-neural.jpg"))) === "[1024,1024]");
check("…electron/main.js still closes any splash by 16.5 s", /setTimeout\(done, 16500\)/.test(rd("electron/main.js")));

// ---- the sample in a fresh install's first project
const S = require(path.join(ROOT, "lib", "samples.js"));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "nr726-")), proj = path.join(tmp, "projects");
const mk = (n) => { const d = path.join(proj, n); fs.mkdirSync(path.join(d, "images"), { recursive: true }); return d; };
const d1 = mk("default");
check("samples: a fresh install's first project gets the picture in Assets ▸ Images", JSON.stringify(S.seed(d1, proj, "default")) === JSON.stringify([path.join("images", "bitgen-neural.jpg")]) && fs.statSync(path.join(d1, "images", "bitgen-neural.jpg")).size === fs.statSync(path.join(ROOT, "misc", "samples", "bitgen-neural.jpg")).size);
check("…never twice into it (the file is there)", S.seed(d1, proj, "default").length === 0);
const d2 = mk("my film");
check("…a project made later (another one exists) gets nothing", S.seed(d2, proj, "my film").length === 0 && !fs.existsSync(path.join(d2, "images", "bitgen-neural.jpg")));
check("…a missing samples folder / an unreadable projects folder never throws", Array.isArray(S.seed(d2, path.join(tmp, "nope"), "x", path.join(tmp, "nosrc"))) && S.freshInstall(path.join(tmp, "nope"), "x") === true);
fs.rmSync(tmp, { recursive: true, force: true });
const CORE = rd("lib/core.js");
check("lib/core.js ensureProject: only a project it just CREATED is offered the sample (an existing one is never touched)",
  /const isNew = !fs\.existsSync\(d\);/.test(CORE) && /if \(isNew\) require\("\.\/samples"\)\.seed\(d, PROJECTS_DIR, path\.basename\(d\)\);/.test(CORE));

console.log(`\n${pass} passed, ${fail} failed`);
console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
process.exit(fail ? 1 : 0);
